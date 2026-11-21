package app.ocshimeji.android

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.content.pm.PackageManager
import android.provider.Settings
import app.ocshimeji.ui.DeskStage
import android.content.res.Configuration
import android.graphics.Canvas
import android.os.Build
import android.os.Bundle
import android.text.InputFilter
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.EditText
import android.widget.FrameLayout
import app.ocshimeji.save.FileStorage
import app.ocshimeji.save.SaveSystem
import app.ocshimeji.save.media.Codec
import app.ocshimeji.save.media.Importer
import app.ocshimeji.save.media.Raster
import app.ocshimeji.sim.chars.Voice
import app.ocshimeji.ui.PickedImage
import app.ocshimeji.ui.Platform
import app.ocshimeji.ui.Theme
import app.ocshimeji.ui.TitleScreen
import app.ocshimeji.ui.UiApp

/**
 * The whole app is one view drawing the game's UI (module :ui) through AndroidGfx. Saves live in the app's private files
 * directory (no storage permission). Safe areas come from window insets; dark mode follows the system.
 */
class MainActivity : Activity() {
    private lateinit var ui: UiApp
    private lateinit var view: GameView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        OcRuntime.init(this)
        val assets = OcRuntime.assets
        val platform = object : Platform {
            override fun now() = System.currentTimeMillis()
            override fun haptic(kind: String) { runCatching {
                val s = OcRuntime.saves; if (s.flag("a11y:vib0")) return@runCatching   /* plan O-04: vibration off / weak / normal */
                val weak = s.flag("a11y:vib1")
                view.performHapticFeedback(when { weak -> HapticFeedbackConstants.KEYBOARD_TAP; kind == "soft" -> HapticFeedbackConstants.CONTEXT_CLICK; kind == "heavy" -> HapticFeedbackConstants.LONG_PRESS; else -> HapticFeedbackConstants.KEYBOARD_TAP }) } }
            override fun prompt(title: String, initial: String, maxLength: Int, done: (String?) -> Unit) = askText(title, initial, maxLength, done)
            override fun exit() { finish() }
            override fun pickImage(done: (PickedImage?, String?) -> Unit) = pick(done)
            override fun saveFile(name: String, mime: String, data: ByteArray, done: (Boolean) -> Unit) = create(name, mime, data, done)
            override fun openFile(mime: String, done: (ByteArray?) -> Unit) = open(done)
            override fun sound(name: String) { OcRuntime.sounds.play(name) }
            override fun voice(v: Voice, text: String) { OcRuntime.sounds.voice(v.pitch, v.speed, v.timbre, v.bright, text) }
            override fun clip(path: String, music: Boolean) { OcRuntime.sounds.clip(java.io.File(filesDir, path.removePrefix("lib:")), music) }
            override fun stopMusic() { OcRuntime.sounds.stopMusic() }
            override fun bgm(kind: String) { OcRuntime.sounds.bgm(kind) }
            override fun pickFiles(multiple: Boolean, done: (List<Importer.Source>?, String?) -> Unit) = pickMany(multiple, done)
            override val codec: Codec = Codec { b -> decodeRaster(b) }
            override fun canOverlay() = Settings.canDrawOverlays(this@MainActivity)
            override fun openOverlaySettings() { runCatching { startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))) } }
            override fun deskStart(slotId: String, personId: String): String? {
                val o = OcRuntime.host.get(slotId); if (o != null && o.sim.onDesk.size >= DeskStage.MAX && o.sim.person(personId)?.desk != true) return "桌面上最多 ${DeskStage.MAX} 位"
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    runCatching { requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 42) }
                return try { DeskService.send(this@MainActivity, DeskService.ACTION_ADD, slotId, personId); null } catch (e: Exception) { "沒辦法開始：${e.message}" }
            }
            override fun deskStop(slotId: String, personId: String) { DeskService.send(this@MainActivity, DeskService.ACTION_REMOVE, slotId, personId) }
            override fun deskRunning(slotId: String) = DeskService.running
        }
        ui = UiApp(OcRuntime.saves, assets, platform, OcRuntime.host)
        ui.theme = themeFor(resources.configuration)
        ui.push(TitleScreen())
        view = GameView(this, ui, AndroidGfx(assets))
        setContentView(view)
        edgeToEdge()
    }
    /* (insetsController only after setContentView — calling it earlier crashes on some Android 11 builds; the old version learned this) */
    private fun edgeToEdge() {
        runCatching {
            if (Build.VERSION.SDK_INT >= 30) {
                window.setDecorFitsSystemWindows(false)
                val light = !ui.theme.dark; val mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                window.decorView.windowInsetsController?.setSystemBarsAppearance(if (light) mask else 0, mask)
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    (if (!ui.theme.dark) View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR else 0)
            }
        }
    }
    private fun themeFor(c: Configuration) = if ((c.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES) Theme.DARK else Theme.LIGHT
    override fun onConfigurationChanged(newConfig: Configuration) { super.onConfigurationChanged(newConfig); ui.theme = themeFor(newConfig); edgeToEdge(); view.invalidate() }
    override fun onPause() { super.onPause(); ui.pause() }
    override fun onResume() { super.onResume(); if (started) ui.wake(); started = true; view.kick() }
    override fun onDestroy() { super.onDestroy(); if (!DeskService.running) OcRuntime.sounds.release() }
    private var started = false

    // ---------------- files the player chooses (Storage Access Framework: no storage permission) ----------------
    private var pending: ((Intent?) -> Unit)? = null
    private fun ask(i: Intent, then: (Intent?) -> Unit) {
        pending = then
        try { @Suppress("DEPRECATION") startActivityForResult(i, 41) } catch (e: Exception) { pending = null; then(null); ui.toast("這支手機沒有可以選檔案的 App") }
    }
    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION") super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 41) return; val p = pending; pending = null
        p?.invoke(if (resultCode == RESULT_OK) data else null); view.kick()
    }
    private fun readAll(uri: Uri, limit: Long): ByteArray? = contentResolver.openInputStream(uri)?.use { ins ->
        val out = java.io.ByteArrayOutputStream(); val buf = ByteArray(64 * 1024); var total = 0L
        while (true) { val n = ins.read(buf); if (n < 0) break; total += n; if (total > limit) return null; out.write(buf, 0, n) }
        out.toByteArray()
    }
    /** work off the UI thread, answer on it */
    private fun background(work: () -> Unit) { Thread { work() }.apply { isDaemon = true }.start() }
    private fun pick(done: (PickedImage?, String?) -> Unit) {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "image/*" }
        ask(i) { data -> val uri = data?.data ?: run { done(null, null); return@ask }
            background {
                val r = runCatching {
                    val bytes = readAll(uri, 30L * 1024 * 1024) ?: return@runCatching null to "圖片太大（上限 30 MB）"
                    val mime = contentResolver.getType(uri) ?: ""
                    val ext = when { mime.contains("png") -> "png"; mime.contains("webp") -> "webp"; mime.contains("gif") -> "gif"; mime.contains("jpeg") || mime.contains("jpg") -> "jpg"; else -> "img" }
                    val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeByteArray(bytes, 0, bytes.size, o)
                    if (o.outWidth <= 0) return@runCatching null to "看不懂這張圖片"
                    var s = 1; while (maxOf(o.outWidth, o.outHeight) / s > 2048) s *= 2
                    val big = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = s; inPreferredConfig = Bitmap.Config.ARGB_8888 }) ?: return@runCatching null to "看不懂這張圖片"
                    val k = minOf(1f, 1024f / maxOf(big.width, big.height))
                    val bmp = if (k < 1f) Bitmap.createScaledBitmap(big, maxOf(1, (big.width * k).toInt()), maxOf(1, (big.height * k).toInt()), true) else big
                    val png = java.io.ByteArrayOutputStream().also { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
                    val px = IntArray(bmp.width * bmp.height).also { bmp.getPixels(it, 0, bmp.width, 0, 0, bmp.width, bmp.height) }
                    PickedImage(bytes, ext, png, bmp.width, bmp.height, px) to null
                }.getOrElse { null to "讀不到這張圖片" }
                view.post { done(r.first, r.second); view.kick() }
            }
        }
    }
    private fun create(name: String, mime: String, data: ByteArray, done: (Boolean) -> Unit) {
        val i = Intent(Intent.ACTION_CREATE_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = mime; putExtra(Intent.EXTRA_TITLE, name) }
        ask(i) { d -> val uri = d?.data ?: run { done(false); return@ask }
            background { val ok = runCatching { contentResolver.openOutputStream(uri, "w")?.use { it.write(data) } != null }.getOrDefault(false); view.post { done(ok); view.kick() } } }
    }
    /** any still picture the phone can decode → ARGB pixels (the importer has already refused anything over 4096 px) */
    private fun decodeRaster(b: ByteArray): Raster? {
        val bmp = BitmapFactory.decodeByteArray(b, 0, b.size, BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888; inPremultiplied = false }) ?: return null
        val px = IntArray(bmp.width * bmp.height); bmp.getPixels(px, 0, bmp.width, 0, 0, bmp.width, bmp.height)
        return Raster(bmp.width, bmp.height, px).also { bmp.recycle() }
    }
    /** one or several files (pictures, animations, ZIP, .ocpkg, a JSON atlas) through the system picker */
    private fun pickMany(multiple: Boolean, done: (List<Importer.Source>?, String?) -> Unit) {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "*/*"; putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple) }
        ask(i) { data -> if (data == null) { done(null, null); return@ask }
            val uris = ArrayList<Uri>(); data.clipData?.let { c -> for (k in 0 until c.itemCount) uris += c.getItemAt(k).uri }; if (uris.isEmpty()) data.data?.let { uris += it }
            if (uris.isEmpty()) { done(null, null); return@ask }
            background {
                var total = 0L; var err: String? = null; val out = ArrayList<Importer.Source>()
                for (u in uris) { val b = runCatching { readAll(u, 64L * 1024 * 1024) }.getOrNull(); if (b == null) { err = "檔案太大或讀不到（上限 64 MB）"; break }
                    total += b.size; if (total > 64L * 1024 * 1024) { err = "檔案加起來超過 64 MB"; break }; out += Importer.Source(nameOf(u), b) }
                view.post { if (err != null) done(null, err) else done(out, null); view.kick() }
            }
        }
    }
    private fun nameOf(u: Uri): String = runCatching { contentResolver.query(u, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null } }.getOrNull() ?: u.lastPathSegment ?: "file"
    private fun open(done: (ByteArray?) -> Unit) {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "*/*" }
        ask(i) { d -> val uri = d?.data ?: run { done(null); return@ask }
            background { val b = runCatching { readAll(uri, 200L * 1024 * 1024) }.getOrNull(); view.post { if (b == null) ui.toast("檔案太大或讀不到"); done(b); view.kick() } } }
    }
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (!ui.back()) @Suppress("DEPRECATION") super.onBackPressed() else view.kick() }

    private fun askText(title: String, initial: String, maxLength: Int, done: (String?) -> Unit) {
        val pad = (20 * resources.displayMetrics.density).toInt()
        val edit = EditText(this).apply { setText(initial); setSelection(initial.length); filters = arrayOf(InputFilter.LengthFilter(maxLength))
            if (maxLength > 200) { isSingleLine = false; minLines = 6; maxLines = 14; gravity = android.view.Gravity.TOP } else isSingleLine = true }   /* long texts (scripts) get a multi-line box */
        val box = FrameLayout(this).apply { setPadding(pad, pad / 2, pad, 0); addView(edit) }
        AlertDialog.Builder(this).setTitle(title).setView(box)
            .setPositiveButton("好") { _, _ -> done(edit.text.toString()); view.kick() }
            .setNegativeButton("取消") { _, _ -> done(null) }
            .setOnCancelListener { done(null) }.show()
    }
}

/** draws the UI; full frame rate only while something moves, otherwise a few frames a second (battery) */
class GameView(ctx: Context, private val ui: UiApp, private val gfx: AndroidGfx) : View(ctx) {
    private var last = 0L
    /* plan O-04 大字: everything drawn 15% larger (fewer dp on the screen) */
    private val density = resources.displayMetrics.density * (if (runCatching { OcRuntime.saves.flag("a11y:big") }.getOrDefault(false)) 1.15f else 1f)
    init {
        isFocusable = true
        setOnApplyWindowInsetsListener { _, insets ->
            if (Build.VERSION.SDK_INT >= 30) { val i = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout()); ui.insetTop = i.top / density; ui.insetBottom = i.bottom / density }
            else { @Suppress("DEPRECATION") run { ui.insetTop = insets.systemWindowInsetTop / density; ui.insetBottom = insets.systemWindowInsetBottom / density } }
            insets
        }
    }
    fun kick() { last = 0L; invalidate() }
    override fun onDraw(canvas: Canvas) {
        val now = System.nanoTime(); val dt = if (last == 0L) 1f / 60 else ((now - last) / 1e9f).coerceIn(0f, 0.1f); last = now
        gfx.begin(canvas, density); try { ui.frame(gfx, dt) } finally { gfx.end() }
        when {
            !ui.animating -> postDelayed({ invalidate() }, 250)
            ui.fps < 60 -> postDelayed({ invalidate() }, (1000L / ui.fps) - 4)
            else -> postInvalidateOnAnimation()
        }
    }
    /* fingers: the first one is "the" finger (taps, drags, touching characters); a second one only pinches */
    private var first = -1; private var second = -1
    override fun onTouchEvent(e: MotionEvent): Boolean {
        fun px(i: Int): Float = e.getX(i) / density
        fun py(i: Int): Float = e.getY(i) / density
        fun pr(i: Int): Float = if (e.getToolType(i) == MotionEvent.TOOL_TYPE_STYLUS) e.getPressure(i).coerceIn(0.05f, 1f) else 1f   /* fingers report noise, a stylus the real thing */
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> { first = e.getPointerId(0); second = -1; ui.pressure = pr(0); ui.down(px(0), py(0)) }
            MotionEvent.ACTION_POINTER_DOWN -> if (second < 0) { second = e.getPointerId(e.actionIndex); ui.second(0, px(e.actionIndex), py(e.actionIndex)) }
            MotionEvent.ACTION_MOVE -> {
                val a = e.findPointerIndex(first); if (a >= 0) { ui.pressure = pr(a); ui.move(px(a), py(a)) }
                val b = if (second >= 0) e.findPointerIndex(second) else -1; if (b >= 0) ui.second(1, px(b), py(b))
            }
            MotionEvent.ACTION_POINTER_UP -> { val id = e.getPointerId(e.actionIndex)
                if (id == second) { ui.second(2, px(e.actionIndex), py(e.actionIndex)); second = -1 }
                else if (id == first && second >= 0) { val b = e.findPointerIndex(second); ui.second(2, px(b), py(b)); first = second; second = -1 } }
            MotionEvent.ACTION_UP -> { val a = e.findPointerIndex(first).coerceAtLeast(0); ui.up(px(a), py(a)); first = -1; second = -1 }
            MotionEvent.ACTION_CANCEL -> { ui.cancel(); first = -1; second = -1 }
        }
        kick(); return true
    }
}
