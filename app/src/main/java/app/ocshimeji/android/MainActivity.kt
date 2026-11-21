package app.ocshimeji.android

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
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
        val assets = AndroidAssets(assets)
        val platform = object : Platform {
            override fun now() = System.currentTimeMillis()
            override fun haptic(kind: String) { runCatching { view.performHapticFeedback(if (kind == "soft") HapticFeedbackConstants.CONTEXT_CLICK else HapticFeedbackConstants.KEYBOARD_TAP) } }
            override fun prompt(title: String, initial: String, maxLength: Int, done: (String?) -> Unit) = askText(title, initial, maxLength, done)
            override fun exit() { finish() }
        }
        ui = UiApp(SaveSystem(FileStorage(filesDir)), assets, platform)
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
    override fun onResume() { super.onResume(); view.kick() }
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (!ui.back()) @Suppress("DEPRECATION") super.onBackPressed() else view.kick() }

    private fun askText(title: String, initial: String, maxLength: Int, done: (String?) -> Unit) {
        val pad = (20 * resources.displayMetrics.density).toInt()
        val edit = EditText(this).apply { setText(initial); setSelection(initial.length); filters = arrayOf(InputFilter.LengthFilter(maxLength)); isSingleLine = true }
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
    private val density = resources.displayMetrics.density
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
        if (ui.animating) postInvalidateOnAnimation() else postDelayed({ invalidate() }, 250)
    }
    override fun onTouchEvent(e: MotionEvent): Boolean {
        val x = e.x / density; val y = e.y / density
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> ui.down(x, y)
            MotionEvent.ACTION_MOVE -> if (e.getPointerId(e.actionIndex) == e.getPointerId(0)) ui.move(x, y)
            MotionEvent.ACTION_UP -> ui.up(x, y)
            MotionEvent.ACTION_CANCEL -> ui.cancel()
        }
        kick(); return true
    }
}
