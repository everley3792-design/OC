package app.ocshimeji.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.Canvas
import android.graphics.PixelFormat
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Choreographer
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.Toast
import app.ocshimeji.save.media.Codec
import app.ocshimeji.sim.desk.DeskScreen
import app.ocshimeji.ui.DeskMenuScreen
import app.ocshimeji.ui.DeskStage
import app.ocshimeji.ui.Phone
import app.ocshimeji.ui.Platform
import app.ocshimeji.ui.Theme
import app.ocshimeji.ui.UiApp

/**
 * The desktop pets (plan 2.4, M3). A foreground service of type specialUse that is alive only while a pet is visible:
 * - one small overlay window per pet (never a full-screen layer), its bubble in another small window, the long-press menu in a third;
 * - every window FLAG_NOT_FOCUSABLE; touch-through mode = FLAG_NOT_TOUCHABLE and alpha 0.8 (Android 12 rule);
 * - the windows are added before startForeground (Android 15); START_NOT_STICKY; no wake lock; drawing stops while the screen is off;
 * - frame rate follows the pets (moving 30, dragged 60, resting 6, asleep 1).
 * Everything the pets do is decided by `DeskStage` (pure, tested); this only hosts windows and reports the phone's state.
 */
class DeskService : Service() {
    private lateinit var wm: WindowManager
    private lateinit var app: UiApp
    private var stage: DeskStage? = null
    private val density get() = resources.displayMetrics.density
    private val petViews = HashMap<String, PetView>()
    private val bubbleViews = HashMap<String, BubbleView>()
    /** R6: one small window per thing on the desktop (F-05, F-06) */
    private val propViews = HashMap<String, PropView>()
    private var menu: MenuView? = null
    private var through = false
    private var phone = Phone()
    private var screenOn = true
    private var fullscreen = false
    private val gfx by lazy { AndroidGfx(OcRuntime.assets) }
    private val handler = Handler(Looper.getMainLooper())
    private var lastNs = 0L; private var looping = false

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onCreate() {
        super.onCreate(); OcRuntime.init(this); wm = getSystemService(WINDOW_SERVICE) as WindowManager; running = true
        val platform = object : Platform {
            override fun now() = System.currentTimeMillis()
            override fun prompt(title: String, initial: String, maxLength: Int, done: (String?) -> Unit) = done(null)
            override fun sound(name: String) { OcRuntime.sounds.play(name) }
            override fun voice(v: app.ocshimeji.sim.chars.Voice, text: String) { OcRuntime.sounds.voice(v.pitch, v.speed, v.timbre, v.bright, text) }
            override val codec: Codec = Codec { null }
        }
        app = UiApp(OcRuntime.saves, OcRuntime.assets, platform, OcRuntime.host)
        app.theme = if ((resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES) Theme.DARK else Theme.LIGHT
        val f = IntentFilter().apply { addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_SCREEN_ON); addAction(Intent.ACTION_BATTERY_CHANGED) }
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, f, Context.RECEIVER_NOT_EXPORTED) else @Suppress("UnspecifiedRegisterReceiverFlag") registerReceiver(receiver, f)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val slot = intent?.getStringExtra(EXTRA_SLOT); val person = intent?.getStringExtra(EXTRA_PERSON)
        when (intent?.action) {
            ACTION_ADD -> if (slot != null && person != null) add(slot, person)
            ACTION_REMOVE -> if (person != null) { stage?.remove(person); dropPet(person) }
            ACTION_THROUGH -> setThrough(true)
            ACTION_TOUCH -> setThrough(false)
            ACTION_STOP -> { stopEverything(); return START_NOT_STICKY }
        }
        if (stage?.pets.isNullOrEmpty()) stopEverything() else notifyUpdate()
        return START_NOT_STICKY
    }

    private fun add(slot: String, person: String) {
        if (!Settings.canDrawOverlays(this)) { toast("需要「顯示在其他應用程式上層」的權限"); return }
        stage?.let { if (it.slotId != slot) { for (id in it.pets.keys.toList()) dropPet(id); it.close(); stage = null } }
        val st = stage ?: try { DeskStage(app, slot, screenSize()).also { stage = it } } catch (e: IllegalArgumentException) { toast(e.message ?: "打不開這個世界"); return }
        st.add(person)?.let { toast(it); return }
        val v = PetView(person); petViews[person] = v
        wm.addView(v, params(st.windowOf(person)!!, touchable = !through))
        startForegroundNow()                       /* after the first window exists (Android 15) */
        loop()
    }
    private fun startForegroundNow() {
        val n = notification()
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(NOTE_ID, n)
    }
    private fun dropPet(id: String) {
        petViews.remove(id)?.let { runCatching { wm.removeView(it) } }; bubbleViews.remove(id)?.let { runCatching { wm.removeView(it) } }
        if (menu?.id == id) closeMenu()
        if (stage?.pets.isNullOrEmpty()) stopEverything() else notifyUpdate()
    }
    private fun stopEverything() {
        looping = false; closeMenu()
        for (v in petViews.values + bubbleViews.values + propViews.values) runCatching { wm.removeView(v) }
        petViews.clear(); bubbleViews.clear(); propViews.clear()
        stage?.close(); stage = null
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
        stopSelf()
    }
    override fun onDestroy() { running = false; runCatching { unregisterReceiver(receiver) }; if (stage != null) stopEverything(); super.onDestroy() }

    // ---------------- the frame loop (stops while the screen is off) ----------------
    private val tick = object : Choreographer.FrameCallback { override fun doFrame(ns: Long) { frame(ns) } }
    private fun loop() { if (looping || !screenOn) return; looping = true; lastNs = 0L; Choreographer.getInstance().postFrameCallback(tick) }
    private fun frame(ns: Long) {
        if (!looping) return
        val st = stage ?: run { looping = false; return }
        val dt = if (lastNs == 0L) 1f / 30 else ((ns - lastNs) / 1e9f).coerceIn(0f, 0.25f); lastNs = ns
        st.screen.apply { val s = screenSize(); w = s.w; h = s.h; top = s.top; bottom = s.bottom }
        st.frame(dt, phone.copy(fullscreen = fullscreen))
        for ((id, v) in petViews) { val b = st.windowOf(id) ?: continue; v.place(b, st.pets[id]?.pet?.hidden == true); v.invalidate() }
        bubbles(st); props(st)
        st.menuFor?.let { st.menuFor = null; openMenu(it) }
        if (st.pets.isEmpty()) { stopEverything(); return }
        val fps = st.fps.coerceAtLeast(2)
        if (!screenOn) { looping = false; return }
        if (fps >= 30) Choreographer.getInstance().postFrameCallback(tick)
        else handler.postDelayed({ if (looping) Choreographer.getInstance().postFrameCallback(tick) }, 1000L / fps)
    }
    private fun bubbles(st: DeskStage) {
        for (id in st.pets.keys) {
            val text = st.bubbleOf(id)
            val v = bubbleViews[id]
            if (text == null) { if (v != null) { runCatching { wm.removeView(v) }; bubbleViews.remove(id) }; continue }
            val r = st.bubbleWindow(measureG, id) ?: continue
            if (v == null) { val nv = BubbleView(id); bubbleViews[id] = nv; wm.addView(nv, params(r, touchable = st.isLive(id) && !through)) } else { v.place(r); v.invalidate() }
        }
    }
    private fun props(st: DeskStage) {
        val ids = st.propIds.toSet()
        for (id in propViews.keys.toList()) if (id !in ids) propViews.remove(id)?.let { runCatching { wm.removeView(it) } }
        for (id in ids) { val b = st.propWindow(id) ?: continue; val v = propViews[id]
            if (v == null) { val nv = PropView(id); propViews[id] = nv; runCatching { wm.addView(nv, params(b, touchable = !through)) } } else { v.place(b); v.invalidate() } }
    }
    /** a Gfx that only measures text (bubble sizes are computed before there is a canvas) */
    private val measureG by lazy { AndroidGfx(OcRuntime.assets).also { it.measureOnly(resources.displayMetrics.widthPixels / density, resources.displayMetrics.heightPixels / density) } }

    // ---------------- windows ----------------
    private fun params(b: FloatArray, touchable: Boolean): WindowManager.LayoutParams {
        val type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        var f = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
        if (!touchable) f = f or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        return WindowManager.LayoutParams((b[2] * density).toInt(), (b[3] * density).toInt(), type, f, PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.TOP or Gravity.START; x = (b[0] * density).toInt(); y = (b[1] * density).toInt()
            if (!touchable) alpha = 0.8f
            if (Build.VERSION.SDK_INT >= 28) layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
    }
    private fun setThrough(on: Boolean) {
        through = on
        for ((id, v) in petViews) { val b = stage?.windowOf(id) ?: continue; runCatching { wm.updateViewLayout(v, params(b, touchable = !on)) } }
        for ((id, v) in propViews) { val b = stage?.propWindow(id) ?: continue; runCatching { wm.updateViewLayout(v, params(b, touchable = !on)) } }
        if (on) toast("手指會穿過桌寵；從通知可以恢復")
        notifyUpdate()
    }
    inner class PetView(val id: String) : View(this@DeskService) {
        private var last = floatArrayOf(Float.NaN, 0f, 0f, 0f)
        init {
            setOnApplyWindowInsetsListener { _, insets ->
                /* full screen = the status bar is hidden by the app in front (plan F-14). Not every phone reports this to an overlay. */
                if (Build.VERSION.SDK_INT >= 30) fullscreen = !insets.isVisible(WindowInsets.Type.statusBars())
                insets
            }
        }
        fun place(b: FloatArray, hidden: Boolean) {
            visibility = if (hidden) View.INVISIBLE else View.VISIBLE
            if (kotlin.math.abs(b[0] - last[0]) < 0.5f && kotlin.math.abs(b[1] - last[1]) < 0.5f && b[2] == last[2] && b[3] == last[3]) return
            last = b.copyOf(); val lp = layoutParams as? WindowManager.LayoutParams ?: return
            lp.x = (b[0] * density).toInt(); lp.y = (b[1] * density).toInt(); lp.width = (b[2] * density).toInt(); lp.height = (b[3] * density).toInt()
            runCatching { wm.updateViewLayout(this, lp) }
        }
        override fun onDraw(canvas: Canvas) { val st = stage ?: return; gfx.begin(canvas, density); try { st.drawPet(gfx, id) } finally { gfx.end() } }
        override fun onTouchEvent(e: MotionEvent): Boolean {
            val st = stage ?: return false; val x = e.rawX / density; val y = e.rawY / density
            when (e.actionMasked) { MotionEvent.ACTION_DOWN -> st.touch(id, 0, x, y); MotionEvent.ACTION_MOVE -> st.touch(id, 1, x, y); MotionEvent.ACTION_UP -> st.touch(id, 2, x, y); MotionEvent.ACTION_CANCEL -> st.touch(id, 3, x, y) }
            loop(); return true
        }
    }
    inner class PropView(val id: String) : View(this@DeskService) {
        private var last = floatArrayOf(Float.NaN, 0f, 0f, 0f)
        fun place(b: FloatArray) {
            if (kotlin.math.abs(b[0] - last[0]) < 0.5f && kotlin.math.abs(b[1] - last[1]) < 0.5f) return
            last = b.copyOf(); val lp = layoutParams as? WindowManager.LayoutParams ?: return
            lp.x = (b[0] * density).toInt(); lp.y = (b[1] * density).toInt(); lp.width = (b[2] * density).toInt(); lp.height = (b[3] * density).toInt(); runCatching { wm.updateViewLayout(this, lp) }
        }
        override fun onDraw(canvas: Canvas) { val st = stage ?: return; gfx.begin(canvas, density); try { st.drawProp(gfx, id) } finally { gfx.end() } }
        override fun onTouchEvent(e: MotionEvent): Boolean {
            val st = stage ?: return false; val x = e.rawX / density; val y = e.rawY / density
            when (e.actionMasked) { MotionEvent.ACTION_DOWN -> st.touchProp(id, 0, x, y); MotionEvent.ACTION_MOVE -> st.touchProp(id, 1, x, y); MotionEvent.ACTION_UP -> st.touchProp(id, 2, x, y); MotionEvent.ACTION_CANCEL -> st.touchProp(id, 3, x, y) }
            loop(); return true
        }
    }
    inner class BubbleView(val id: String) : View(this@DeskService) {
        fun place(b: FloatArray) { val lp = layoutParams as? WindowManager.LayoutParams ?: return
            lp.x = (b[0] * density).toInt(); lp.y = (b[1] * density).toInt(); lp.width = (b[2] * density).toInt(); lp.height = (b[3] * density).toInt(); runCatching { wm.updateViewLayout(this, lp) } }
        override fun onDraw(canvas: Canvas) { val st = stage ?: return; gfx.begin(canvas, density); try { st.drawBubble(gfx, id) } finally { gfx.end() } }
        override fun onTouchEvent(e: MotionEvent): Boolean { if (e.actionMasked == MotionEvent.ACTION_UP) openApp(); return true }   /* a live bubble from home: open it */
    }
    inner class MenuView(val id: String, val ui: UiApp) : View(this@DeskService) {
        override fun onDraw(canvas: Canvas) { gfx.begin(canvas, density); try { ui.frame(gfx, 1 / 30f) } finally { gfx.end() }; if (ui.animating) postInvalidateOnAnimation() }
        override fun onTouchEvent(e: MotionEvent): Boolean {
            val x = e.x / density; val y = e.y / density
            when (e.actionMasked) { MotionEvent.ACTION_DOWN -> ui.down(x, y); MotionEvent.ACTION_MOVE -> ui.move(x, y); MotionEvent.ACTION_UP -> ui.up(x, y); MotionEvent.ACTION_CANCEL -> ui.cancel()
                MotionEvent.ACTION_OUTSIDE -> closeMenu() }
            invalidate(); return true
        }
    }
    private fun openMenu(id: String) {
        closeMenu(); val st = stage ?: return; val b = st.windowOf(id) ?: return
        val ui = UiApp(OcRuntime.saves, OcRuntime.assets, app.platform, OcRuntime.host); ui.theme = app.theme
        ui.push(DeskMenuScreen(st, id) { a -> when (a) { "close" -> closeMenu(); "home" -> { closeMenu(); dropPet(id) }; "app" -> { closeMenu(); openApp() }; "through" -> { closeMenu(); setThrough(true) } } })
        val v = MenuView(id, ui); val s = st.screen
        val x = (b[0] + b[2] / 2 - DeskMenuScreen.W / 2).coerceIn(4f, s.w - DeskMenuScreen.W - 4); var y = b[1] - DeskMenuScreen.H - 4; if (y < s.top) y = (b[1] + b[3] + 4).coerceAtMost(s.h - DeskMenuScreen.H - 4)
        val lp = params(floatArrayOf(x, y, DeskMenuScreen.W, DeskMenuScreen.H), touchable = true).apply { flags = flags or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH; alpha = 1f }
        menu = v; wm.addView(v, lp)
    }
    private fun closeMenu() { menu?.let { runCatching { wm.removeView(it) } }; menu = null }
    private fun openApp() { startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)) }

    // ---------------- the phone's state ----------------
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            when (i.action) {
                Intent.ACTION_SCREEN_OFF -> { screenOn = false; looping = false; stage?.let { OcRuntime.host.save(it.open) } }
                Intent.ACTION_SCREEN_ON -> { screenOn = true; loop() }
                Intent.ACTION_BATTERY_CHANGED -> {
                    val lvl = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1); val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
                    val st = i.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
                    phone = phone.copy(battery = if (lvl >= 0 && scale > 0) lvl * 100 / scale else 80, charging = st == BatteryManager.BATTERY_STATUS_CHARGING || st == BatteryManager.BATTERY_STATUS_FULL)
                }
            }
        }
    }
    private fun screenSize(): DeskScreen {
        val d = density
        return if (Build.VERSION.SDK_INT >= 30) {
            val m = wm.currentWindowMetrics; val ins = m.windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            DeskScreen(m.bounds.width() / d, m.bounds.height() / d, ins.top / d, ins.bottom / d)
        } else { val dm = resources.displayMetrics; DeskScreen(dm.widthPixels / d, dm.heightPixels / d, 24f, 48f) }
    }

    // ---------------- the notification (always visible while a pet is out) ----------------
    private fun notification(): Notification {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL) == null) nm.createNotificationChannel(NotificationChannel(CHANNEL, "桌面上的角色", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        val names = stage?.pets?.keys?.mapNotNull { stage?.sim?.person(it)?.name }.orEmpty()
        fun pi(action: String, code: Int) = PendingIntent.getService(this, code, Intent(this, DeskService::class.java).setAction(action), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val open = PendingIntent.getActivity(this, 9, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE)
        val b = Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.star_on).setOngoing(true).setContentIntent(open)
            .setContentTitle(if (names.isEmpty()) "桌面" else names.joinToString("、") + " 在桌面上").setContentText(if (through) "手指會穿過牠們" else "點這裡打開小鎮")
            .addAction(Notification.Action.Builder(null, "收回", pi(ACTION_STOP, 1)).build())
            .addAction(Notification.Action.Builder(null, if (through) "恢復觸控" else "讓手指穿過", pi(if (through) ACTION_TOUCH else ACTION_THROUGH, 2)).build())
        return b.build()
    }
    private fun notifyUpdate() { if (stage?.pets.isNullOrEmpty()) return; (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NOTE_ID, notification()) }
    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_SHORT).show()

    companion object {
        const val ACTION_ADD = "app.ocshimeji.desk.ADD"; const val ACTION_REMOVE = "app.ocshimeji.desk.REMOVE"; const val ACTION_STOP = "app.ocshimeji.desk.STOP"
        const val ACTION_THROUGH = "app.ocshimeji.desk.THROUGH"; const val ACTION_TOUCH = "app.ocshimeji.desk.TOUCH"
        const val EXTRA_SLOT = "slot"; const val EXTRA_PERSON = "person"; const val CHANNEL = "desk"; const val NOTE_ID = 7
        @Volatile var running = false; private set
        fun send(ctx: Context, action: String, slot: String?, person: String?) {
            val i = Intent(ctx, DeskService::class.java).setAction(action).putExtra(EXTRA_SLOT, slot).putExtra(EXTRA_PERSON, person)
            if (action == ACTION_ADD) ctx.startForegroundService(i) else if (running) ctx.startService(i)
        }
    }
}
