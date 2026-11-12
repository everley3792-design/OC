package app.ocshimeji.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.view.Choreographer
import android.view.WindowInsets
import android.view.WindowManager
import app.ocshimeji.MainActivity
import app.ocshimeji.Prefs
import app.ocshimeji.R
import app.ocshimeji.core.pet.AnimClip
import app.ocshimeji.core.pet.AppContext
import app.ocshimeji.core.pet.PetSocial
import app.ocshimeji.widget.PetWidget
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * System-level desktop pets (Shimeji-style), drawn over other apps.
 *
 * Android-supported mechanism only: SYSTEM_ALERT_WINDOW ("display over other apps", granted by the
 * user in Settings) + TYPE_APPLICATION_OVERLAY windows owned by a foreground service of type
 * `specialUse` (Android 14+, declared in the manifest with PROPERTY_SPECIAL_USE_FGS_SUBTYPE).
 *
 *  - every pet has its own window, only as large as the pet; bubbles and the menu are separate
 *    small windows → no full-screen transparent layer, touches elsewhere reach the app below;
 *  - optional touch-passthrough (FLAG_NOT_TOUCHABLE, ≤ 80 % opacity as Android 12+ requires);
 *  - frame loop on Choreographer, capped (60/30 fps, lower when everyone rests), fully stopped while
 *    the screen is off or the pets are paused; no wake locks, no alarms, START_NOT_STICKY;
 *  - the overlay permission is re-checked; if the user revokes it the service stops and says why;
 *  - the system may hide overlays on secure screens (HIDE_OVERLAY_WINDOWS) — we never fight that.
 */
class OverlayPetService : Service() {
    lateinit var wm: WindowManager; private set
    /** context for overlay views: a WindowContext of type TYPE_APPLICATION_OVERLAY on Android 11+ (the supported way to
     *  add windows from a Service; it also gives the views the display's real configuration), the service itself before */
    lateinit var uiCtx: Context; private set
    private val pets = LinkedHashMap<String, PetWindow>()
    private val social = PetSocial()
    /** 12.0: the desktop pets' own sounds (core:pet PetSound decides when; this plays the clips) */
    val sounds by lazy { PetSounds(this) }
    var soundQuiet = true; private set
    private var quietAt = 0L
    private val app = AppContext()
    private val main = Handler(Looper.getMainLooper())
    private var lastFrameNs = 0L
    private var looping = false
    var paused = false; private set
    private var screenOn = true
    private var global = JSONObject()
    var screenW = 1080; private set
    var screenH = 1920; private set
    private var insetTop = 0; private var insetBottom = 0
    var hour = 12; private set
    var haptics = true; private set
    var theme = PetTheme.of(false); private set
    private var fpsCap = 30
    private var pauseScreenOff = true
    private var maxPets = MAX_PETS
    private var removedThisSession = HashSet<String>()
    private var lastError = ""
    // diagnostics
    private var frames = 0; private var frameNsSum = 0L; private var measuredFps = 0f; private var fpsWindowStart = 0L
    private var usage: UsageWatcher? = null
    private var appHidden = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        uiCtx = if (Build.VERSION.SDK_INT >= 30) runCatching {
            val dm = getSystemService(android.hardware.display.DisplayManager::class.java)!!
            createDisplayContext(dm.getDisplay(android.view.Display.DEFAULT_DISPLAY)).createWindowContext(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, null)
        }.getOrElse { this } else this
        wm = uiCtx.getSystemService(WINDOW_SERVICE) as WindowManager
        instance = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopEverything("stopped by user"); return START_NOT_STICKY }
            ACTION_PAUSE -> { setPaused(!paused); return START_NOT_STICKY }
            ACTION_PASSTHROUGH -> { togglePassthrough(); return START_NOT_STICKY }
        }
        if (!canDrawOverlays(this)) {
            status("no-permission", "沒有「顯示在其他應用程式上層」權限")
            runCatching { goForeground() }   // startForegroundService() must always be answered, even when we stop at once
            runCatching { stopForeground(STOP_FOREGROUND_REMOVE) }; stopSelf(); return START_NOT_STICKY
        }
        // Android 15: an app holding SYSTEM_ALERT_WINDOW may start a foreground service from the background only while
        // it has a visible overlay window → add the pet windows first, then promote to foreground.
        if (!running) {
            running = true
            reload()
            val ok = runCatching { goForeground() }
            if (ok.isFailure) {
                lastError = "startForeground: " + (ok.exceptionOrNull()?.javaClass?.simpleName ?: "?")
                status("blocked", "系統不允許現在啟動前景服務（${ok.exceptionOrNull()?.javaClass?.simpleName}）。請從 App 內再啟動一次。")
                stopEverything(lastError); return START_NOT_STICKY
            }
            registerScreen()
            ensureLoop()
        } else reload()
        intent?.getStringExtra(EXTRA_TEST_OC)?.let { oc -> intent.getStringExtra(EXTRA_TEST_ANIM)?.let { test(oc, it) } }
        return START_NOT_STICKY   // no restart-after-kill keep-alive: the player starts the pets again
    }

    private fun goForeground() {
        val n = buildNotification()
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        else startForeground(NOTIF_ID, n)
    }

    // ---------------------------------------------------------------- config
    /** (re)read config.json written by the game: pets, settings, lines, foods, relationships, app rules */
    fun reload() {
        val cfg = PetFiles.readConfig(this)
        global = cfg.optJSONObject("global") ?: JSONObject()
        updateScreen()
        val dark = when (global.optString("theme", Prefs(this).themeMode)) { "dark" -> true; "light" -> false; else -> (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES }
        theme = PetTheme.of(dark)
        fpsCap = if (global.optInt("fps", 30) >= 60) 60 else 30
        pauseScreenOff = global.optBoolean("pauseScreenOff", true)
        haptics = global.optBoolean("haptics", true)
        maxPets = global.optInt("maxPets", MAX_PETS).coerceIn(1, MAX_PETS)
        PetSprites.applyBudget(global.optInt("cacheMB", 24))
        // relationships → pet-to-pet meetings
        val aff = HashMap<String, Float>(); cfg.optJSONObject("aff")?.let { a -> for (k in a.keys()) aff[k] = a.optDouble(k, 0.0).toFloat() }
        social.affinity = aff
        // app context (opt-in)
        global.optJSONObject("app").let { a ->
            app.enabled = a?.optBoolean("enabled", false) == true
            app.useSystemCategory = a?.optBoolean("useSystem", true) != false
            app.hideOverExcluded = a?.optBoolean("hide", false) == true
            val rules = HashMap<String, String>(); a?.optJSONObject("rules")?.let { r -> for (k in r.keys()) rules[k] = r.optString(k) }
            app.rules = rules
            app.exclude = a?.optJSONArray("exclude")?.let { ex -> (0 until ex.length()).map { ex.optString(it) }.toSet() } ?: emptySet()
        }
        val list = cfg.optJSONArray("pets") ?: JSONArray()
        val want = LinkedHashMap<String, JSONObject>()
        for (i in 0 until list.length()) { val p = list.optJSONObject(i) ?: continue; val id = p.optString("id"); if (id.isNotEmpty() && id !in removedThisSession && want.size < maxPets) want[id] = p }
        if (want.isEmpty() && list.length() == 0) want["legacy"] = JSONObject().put("id", "legacy").put("name", "OC")  // pre-0.7 export
        // remove pets no longer wanted
        for (id in pets.keys.toList()) if (id !in want) { pets.remove(id)?.detach() }
        val data = cfg.optJSONObject("data") ?: JSONObject()
        var seed = 1
        for ((id, p) in want) {
            val w = pets.getOrPut(id) { PetWindow(this, id, (SystemClock.uptimeMillis() % 9973).toInt() + seed * 31) }
            seed++
            val sprites = if (id == "legacy") PetSprites.legacy(this) else PetSprites.load(this, id)
            w.configure(p, data.optJSONObject(id), global, sprites, screenW, screenH, insetTop, insetBottom)
            if (!w.attached && !w.attach()) { lastError = "addView failed for $id"; if (!canDrawOverlays(this)) { revoked(); return } }
        }
        if (app.enabled && UsageWatcher.granted(this)) { if (usage == null) usage = UsageWatcher(this) } else usage = null
        if (running) { notifyUpdate(); writeStatus() }
    }

    private fun updateScreen() {
        if (Build.VERSION.SDK_INT >= 30) {
            val m = wm.currentWindowMetrics; screenW = m.bounds.width(); screenH = m.bounds.height()
            val ins = m.windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            insetTop = ins.top; insetBottom = ins.bottom
        } else @Suppress("DEPRECATION") {
            val dm = android.util.DisplayMetrics(); wm.defaultDisplay.getRealMetrics(dm); screenW = dm.widthPixels; screenH = dm.heightPixels
            val res = resources.getIdentifier("status_bar_height", "dimen", "android"); insetTop = if (res > 0) resources.getDimensionPixelSize(res) else 0
            val nb = resources.getIdentifier("navigation_bar_height", "dimen", "android"); insetBottom = if (nb > 0) resources.getDimensionPixelSize(nb) else 0
        }
    }

    // ---------------------------------------------------------------- frame loop
    private val frame = object : Choreographer.FrameCallback {
        override fun doFrame(nowNs: Long) {
            if (!looping) return
            val resting = pets.values.all { it.brain.isResting } && !pets.values.any { it.brain.isDragging }
            val cap = when { paused -> 10; resting -> 15; else -> fpsCap }
            val interval = 1_000_000_000L / cap
            if (lastFrameNs == 0L || nowNs - lastFrameNs >= interval - 2_000_000L) {
                val dt = if (lastFrameNs == 0L) 0f else ((nowNs - lastFrameNs) / 1e9f).coerceAtMost(0.1f)
                lastFrameNs = nowNs
                val t0 = System.nanoTime(); val now = SystemClock.uptimeMillis()
                if (now - quietAt > 1500) { quietAt = now; soundQuiet = !screenOn || (global.optBoolean("sound", false) && sounds.quiet()) }
                for (w in pets.values) w.frame(dt, now, screenW, insetTop, paused, theme)
                if (!paused && pets.size > 1) for (m in social.step(pets.map { PetSocial.Member(it.key, it.value.brain) }, dt)) meeting(m, now)
                frames++; frameNsSum += System.nanoTime() - t0
                if (now - fpsWindowStart > 2000) { measuredFps = frames * 1000f / (now - fpsWindowStart).coerceAtLeast(1); fpsWindowStart = now; avgFrameMs = if (frames > 0) frameNsSum / 1e6f / frames else 0f; frames = 0; frameNsSum = 0; housekeeping() }
            }
            Choreographer.getInstance().postFrameCallback(this)
        }
    }
    private var avgFrameMs = 0f

    private fun ensureLoop() {
        val want = running && screenOn && pets.isNotEmpty()
        if (want && !looping) { looping = true; lastFrameNs = 0L; fpsWindowStart = SystemClock.uptimeMillis(); Choreographer.getInstance().postFrameCallback(frame) }
        else if (!want && looping) { looping = false; Choreographer.getInstance().removeFrameCallback(frame) }
    }

    private var lastHousekeeping = 0L
    private fun housekeeping() {
        val c = Calendar.getInstance(); hour = c.get(Calendar.HOUR_OF_DAY)
        for (w in pets.values) w.brain.hour = hour
        if (!canDrawOverlays(this)) { revoked(); return }
        usage?.poll()?.let { onApp(it) }
        val now = SystemClock.uptimeMillis()
        if (now - lastHousekeeping > 10_000) { lastHousekeeping = now; writeStatus() }
    }

    // ---------------------------------------------------------------- app context (opt-in, package name only)
    private var lastPkg = ""
    private fun onApp(pkg: String) {
        if (pkg == lastPkg || pkg == packageName) return
        lastPkg = pkg
        val sysCat = UsageWatcher.systemCategory(this, pkg)
        val hit = app.classify(pkg, sysCat)
        val hide = hit.excluded && app.hideOverExcluded
        if (hide != appHidden) { appHidden = hide; for (w in pets.values) w.setHidden(hide) }
        val cat = hit.category ?: return
        if (paused) return
        val w = pets.values.firstOrNull { it.actor.talk.has("app_$cat") } ?: return
        w.sayCat("app_$cat", SystemClock.uptimeMillis(), chatter = true)
    }

    // ---------------------------------------------------------------- interactions

    private fun meeting(m: PetSocial.Meeting, now: Long) {
        val a = pets[m.a] ?: return; val b = pets[m.b] ?: return
        val cat = PetSocial.KINDS[m.kind]?.lines ?: "friend"
        a.sayCat(cat, now); main.postDelayed({ b.sayCat(cat, SystemClock.uptimeMillis()) }, 1200)
        a.meetingSound(m.kind)   // 12.0: the warm or the low two-tone, once per meeting
        PetFiles.event(this, m.a, "meet", JSONObject().put("with", m.b).put("kind", m.kind))
    }

    /** is this pet in a paired action with another one right now? (routines wait) */
    fun pairBusy(id: String) = social.isBusy(id)

    fun later(ms: Long, r: () -> Unit) { main.postDelayed({ if (running) r() }, ms) }

    fun openApp(page: String) {
        for (w in pets.values) w.closePopups()
        runCatching { startActivity(Intent(this, MainActivity::class.java).putExtra(MainActivity.EXTRA_PAGE, page).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)) }
    }

    fun removePet(id: String) {
        removedThisSession += id; pets.remove(id)?.detach()
        if (pets.isEmpty()) stopEverything("all pets put away") else { notifyUpdate(); writeStatus() }
    }

    /** "test on desktop": the first two pets walk to each other and play a paired action (12.0) */
    fun testPair(kind: String) {
        val l = pets.values.toList(); if (l.size < 2 || PetSocial.KINDS[kind] == null) return
        val a = l[0]; val b = l[1]
        b.brain.goTo(a.brain.x + a.sizePx * 0.7f * (if (b.brain.x >= a.brain.x) 1 else -1))
        fun tryStart(left: Int) {
            if (!running) return
            val m = social.start(kind, PetSocial.Member(a.id, a.brain), PetSocial.Member(b.id, b.brain))
            if (m != null) { meeting(m, SystemClock.uptimeMillis()); return }
            if (left > 0) later(500) { tryStart(left - 1) }
        }
        later(900) { tryStart(20) }
    }

    /** "test on desktop": play an animation on a pet right now */
    fun test(oc: String, anim: String) {
        val w = pets[oc] ?: pets.values.firstOrNull() ?: return
        val dur = w.view.sprites?.set(anim)?.clip?.seconds()?.coerceIn(1f, 6f) ?: 2f
        when (anim) {
            "walk", "run" -> w.brain.goTo(if (w.brain.x > screenW / 2) w.brain.minX else w.brain.maxX, anim == "run")
            "jump" -> w.brain.jump(0f)
            else -> w.brain.react(anim, dur * if (w.view.sprites?.set(anim)?.clip?.loop == AnimClip.Loop.LOOP) 2 else 1)
        }
        w.say("▶ $anim", SystemClock.uptimeMillis())
    }

    /** a reminder / pomodoro fired → the pet says it (the notification is posted separately) */
    fun announce(cat: String, text: String?) {
        val w = pets.values.firstOrNull() ?: return
        val now = SystemClock.uptimeMillis()
        val line = w.actor.talk.react(cat, 0f)
        w.brain.react(if (cat == "timer_done") "cheer" else "greet", 2f)
        w.say(listOfNotNull(text, line).joinToString("\n").ifBlank { "⏰" }, now)
    }

    fun setPaused(p: Boolean) {
        paused = p
        for (w in pets.values) { w.closePopups(); if (p) w.brain.settle() }
        notifyUpdate(); writeStatus()
    }

    private fun togglePassthrough() {
        val cfg = PetFiles.readConfig(this); val g = cfg.optJSONObject("global") ?: JSONObject()
        g.put("passthrough", !g.optBoolean("passthrough", false)); cfg.put("global", g)
        PetFiles.writeConfig(this, cfg.toString())
        PetFiles.event(this, "", "setting", JSONObject().put("passthrough", g.optBoolean("passthrough")))   // the game mirrors it into its save
        reload()
    }

    // ---------------------------------------------------------------- system events
    private var screenReceiver: BroadcastReceiver? = null
    private fun registerScreen() {
        screenOn = (getSystemService(POWER_SERVICE) as PowerManager).isInteractive
        val r = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                screenOn = i.action != Intent.ACTION_SCREEN_OFF
                if (!pauseScreenOff && !screenOn) return
                for (w in pets.values) w.closePopups()
                ensureLoop(); writeStatus()
            }
        }
        val f = IntentFilter().apply { addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_SCREEN_ON) }
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(r, f, Context.RECEIVER_NOT_EXPORTED) else registerReceiver(r, f)
        screenReceiver = r
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (!running) return
        updateScreen()
        for (w in pets.values) w.resize(screenW, screenH, insetTop, insetBottom)
        reload()   // theme may have changed (system dark mode)
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) PetSprites.cache.evictAll()   // frames are decoded again lazily
    }

    override fun onLowMemory() { super.onLowMemory(); PetSprites.cache.evictAll() }

    private fun revoked() {
        lastError = "overlay permission revoked"
        status("revoked", "「顯示在其他應用程式上層」權限被關閉，桌寵已收起。")
        stopEverything(lastError)
    }

    private fun stopEverything(why: String) {
        running = false
        looping = false; Choreographer.getInstance().removeFrameCallback(frame)
        main.removeCallbacksAndMessages(null)
        for (w in pets.values) w.detach(); pets.clear()
        screenReceiver?.let { runCatching { unregisterReceiver(it) } }; screenReceiver = null
        usage = null
        if (why.isNotEmpty() && lastStatusCode !in setOf("revoked", "blocked", "no-permission")) status("stopped", why)
        runCatching { if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true) }
        stopSelf()
        PetWidget.refresh(this)
    }

    override fun onDestroy() {
        if (running) stopEverything("")
        instance = null
        runCatching { sounds.release() }
        PetSprites.cache.evictAll()
        super.onDestroy()
    }

    // ---------------------------------------------------------------- notification & status
    private fun buildNotification(): Notification {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.pet_channel), NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).putExtra(MainActivity.EXTRA_PAGE, "petcenter"), flags)
        fun svc(action: String, rc: Int) = PendingIntent.getService(this, rc, Intent(this, OverlayPetService::class.java).setAction(action), flags)
        val names = pets.values.joinToString("、") { it.name }.ifEmpty { "OC" }
        val pass = global.optBoolean("passthrough", false)
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_pet)
            .setContentTitle(if (paused) getString(R.string.pet_notif_paused, names) else getString(R.string.pet_notif_title, names))
            .setContentText(getString(if (pass) R.string.pet_notif_text_pass else R.string.pet_notif_text))
            .setContentIntent(open)
            .setOngoing(true).setShowWhen(false).setCategory(Notification.CATEGORY_SERVICE)
            .addAction(Notification.Action.Builder(null, getString(if (paused) R.string.pet_resume else R.string.pet_pause), svc(ACTION_PAUSE, 2)).build())
            .addAction(Notification.Action.Builder(null, getString(if (pass) R.string.pet_touch_on else R.string.pet_touch_off), svc(ACTION_PASSTHROUGH, 3)).build())
            .addAction(Notification.Action.Builder(null, getString(R.string.pet_stop), svc(ACTION_STOP, 1)).build())
            .build()
    }

    private fun notifyUpdate() {
        if (!running) return
        runCatching { (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIF_ID, buildNotification()) }
        PetWidget.refresh(this)
    }

    private var lastStatusCode = ""
    private fun status(code: String, msg: String) {
        lastStatusCode = code
        PetFiles.writeStatus(this, JSONObject().put("code", code).put("msg", msg).put("at", System.currentTimeMillis()))
    }

    private fun writeStatus() {
        lastStatusCode = if (paused) "paused" else "running"
        PetFiles.writeStatus(this, diag())
    }

    /** what is really happening (management center + diagnostics page) */
    fun diag(): JSONObject = JSONObject()
        .put("code", if (!running) lastStatusCode.ifEmpty { "stopped" } else if (paused) "paused" else "running")
        .put("at", System.currentTimeMillis())
        .put("paused", paused).put("screenOn", screenOn).put("looping", looping)
        .put("pets", JSONArray().apply { for (w in pets.values) put(JSONObject().put("id", w.id).put("name", w.name).put("state", w.brain.state.name).put("anim", w.brain.anim).put("surface", w.brain.surface.name).put("x", w.brain.x.toInt()).put("y", w.brain.y.toInt()).put("size", w.sizePx).put("hidden", w.hidden).put("sprites", w.view.sprites?.keys?.size ?: 0).put("draws", w.view.draws)) })
        .put("fpsCap", fpsCap).put("fps", Math.round(measuredFps * 10) / 10.0).put("frameMs", Math.round(avgFrameMs * 100) / 100.0)
        .put("cacheKB", PetSprites.cacheBytes() / 1024).put("cacheBudgetKB", PetSprites.budgetBytes / 1024)
        .put("screen", "${screenW}x$screenH").put("insets", "$insetTop/$insetBottom")
        .put("events", PetFiles.pendingCount(this)).put("dropped", PetFiles.dropped(this))
        .put("app", JSONObject().put("enabled", app.enabled).put("granted", UsageWatcher.granted(this)).put("watching", usage != null).put("hidden", appHidden))
        .put("fgsType", if (Build.VERSION.SDK_INT >= 34) "specialUse" else "none (Android < 14)")
        .put("error", lastError)

    companion object {
        private const val CHANNEL = "pet"
        private const val NOTIF_ID = 7
        /** hard cap (memory / battery); the player may choose fewer */
        const val MAX_PETS = 3
        const val ACTION_STOP = "app.ocshimeji.pet.STOP"
        const val ACTION_PAUSE = "app.ocshimeji.pet.PAUSE"
        const val ACTION_PASSTHROUGH = "app.ocshimeji.pet.PASSTHROUGH"
        const val EXTRA_TEST_OC = "testOc"; const val EXTRA_TEST_ANIM = "testAnim"
        @Volatile var running = false; private set
        @Volatile var instance: OverlayPetService? = null; private set

        fun canDrawOverlays(ctx: Context) = Settings.canDrawOverlays(ctx)
        fun permissionIntent(ctx: Context) = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${ctx.packageName}"))
        /** must be called from a foreground context (activity / widget click / notification action) */
        fun start(ctx: Context): Boolean {
            if (!canDrawOverlays(ctx)) return false
            return runCatching { ctx.startForegroundService(Intent(ctx, OverlayPetService::class.java)); true }.getOrElse { false }
        }
        fun stop(ctx: Context) { val s = instance; if (s != null) s.main.post { s.stopEverything("stopped by user") } else ctx.stopService(Intent(ctx, OverlayPetService::class.java)) }
        /** config or sprites changed (the game exported) → re-read */
        fun reload() { instance?.let { s -> s.main.post { if (running) s.reload() } } }
        fun pause(p: Boolean) { instance?.let { s -> s.main.post { if (running) s.setPaused(p) } } }
        /** 12.0: the first two pets play a paired action (only while the service is running) */
        fun testPair(kind: String) { val s = instance; if (s != null && running) s.main.post { s.testPair(kind) } }
        fun test(ctx: Context, oc: String, anim: String) {
            val s = instance
            if (s != null && running) s.main.post { s.test(oc, anim) }
            else if (canDrawOverlays(ctx)) runCatching { ctx.startForegroundService(Intent(ctx, OverlayPetService::class.java).putExtra(EXTRA_TEST_OC, oc).putExtra(EXTRA_TEST_ANIM, anim)) }
        }
        fun announce(cat: String, text: String?) { instance?.let { s -> s.main.post { if (running) s.announce(cat, text) } } }
        fun diagJson(ctx: Context): JSONObject {
            instance?.takeIf { running }?.let { return it.diag() }
            // not running: report the last reason (a "running" status left by a killed process is reported as stopped)
            val st = PetFiles.readStatus(ctx); val code = st.optString("code", "stopped")
            return st.put("code", if (code == "running" || code == "paused") "stopped" else code).put("pets", JSONArray())
        }
    }
}
