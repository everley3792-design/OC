package app.ocshimeji.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** colours for native overlay UI, following the app's theme setting (light / dark / system) */
data class PetTheme(val bg: Int, val fg: Int, val sub: Int, val accent: Int, val line: Int) {
    companion object {
        fun of(dark: Boolean) = if (dark) PetTheme(0xF023253F.toInt(), 0xFFEEEBFF.toInt(), 0xFFB3AFD6.toInt(), 0xFF9A9EFF.toInt(), 0x33FFFFFF)
        else PetTheme(0xF5FFFFFF.toInt(), 0xFF3F3B5E.toInt(), 0xFF7A769C.toInt(), 0xFF7378F0.toInt(), 0x2250488C)
    }
}

internal fun overlayParams(w: Int, h: Int, flags: Int) = WindowManager.LayoutParams(
    w, h, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED or flags,
    PixelFormat.TRANSLUCENT,
).apply { gravity = Gravity.TOP or Gravity.START }

/**
 * Speech bubble in its own small window above the pet's head. It is only as large as the text, so
 * it never covers more than it shows; tapping it dismisses it. In touch-passthrough mode it is not
 * touchable and kept at ≤ 80 % opacity (Android 12+ blocks touches that pass through more opaque
 * overlay windows of another app).
 */
@SuppressLint("ViewConstructor")
class Bubble(private val ctx: Context, private val wm: WindowManager) {
    private var tv: TextView? = null
    private var lp: WindowManager.LayoutParams? = null
    private var until = 0L
    val showing get() = tv != null

    fun show(text: String, theme: PetTheme, passthrough: Boolean, now: Long) {
        hide()
        val d = ctx.resources.displayMetrics.density
        val t = TextView(ctx).apply {
            this.text = text; setTextColor(theme.fg); textSize = 13f; maxWidth = (220 * d).toInt(); maxLines = 4; ellipsize = TextUtils.TruncateAt.END
            setPadding((12 * d).toInt(), (8 * d).toInt(), (12 * d).toInt(), (8 * d).toInt())
            background = GradientDrawable().apply { cornerRadius = 16 * d; setColor(theme.bg); setStroke((1 * d).toInt().coerceAtLeast(1), theme.line) }
            setOnClickListener { hide() }
        }
        val p = overlayParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, if (passthrough) WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE else 0)
        p.title = "OC pet bubble"; if (passthrough) p.alpha = 0.8f
        p.x = -10000; p.y = -10000
        if (runCatching { wm.addView(t, p) }.isFailure) return
        tv = t; lp = p; until = now + 2600 + text.length * 70L
    }

    /** keep the bubble above (or below, near the top) the pet; auto-hide */
    fun follow(px: Float, py: Float, size: Int, screenW: Int, top: Int, now: Long) {
        val t = tv ?: return; val p = lp ?: return
        if (now > until) { hide(); return }
        val w = t.width; val h = t.height; if (w == 0) return
        val nx = (px + size / 2f - w / 2f).toInt().coerceIn(4, (screenW - w - 4).coerceAtLeast(4))
        var ny = (py + size * 0.08f - h).toInt()
        if (ny < top + 4) ny = (py + size * 0.9f).toInt()
        if (nx != p.x || ny != p.y) { p.x = nx; p.y = ny; runCatching { wm.updateViewLayout(t, p) } }
    }

    fun hide() { tv?.let { runCatching { wm.removeView(it) } }; tv = null; lp = null }
}

/**
 * Long-press menu: a small touchable card next to the pet (closes on any touch outside it).
 * Items are plain text buttons (≥ 48 dp tall).
 */
class PetMenu(private val ctx: Context, private val wm: WindowManager) {
    data class Item(val label: String, val sub: String? = null, val enabled: Boolean = true, val action: () -> Unit)
    private var root: View? = null
    val showing get() = root != null

    @SuppressLint("ClickableViewAccessibility")
    fun show(title: String, items: List<Item>, theme: PetTheme, anchorX: Float, anchorY: Float, size: Int, screenW: Int, screenH: Int) {
        hide()
        val d = ctx.resources.displayMetrics.density
        val list = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        list.addView(TextView(ctx).apply { text = title; setTextColor(theme.sub); textSize = 12f; setPadding((14 * d).toInt(), (10 * d).toInt(), (14 * d).toInt(), (4 * d).toInt()) })
        for (it in items) list.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL; minimumHeight = (48 * d).toInt(); gravity = Gravity.CENTER_VERTICAL
            setPadding((14 * d).toInt(), (6 * d).toInt(), (14 * d).toInt(), (6 * d).toInt())
            addView(TextView(ctx).apply { text = it.label; setTextColor(if (it.enabled) theme.fg else theme.sub); textSize = 15f; typeface = Typeface.DEFAULT_BOLD })
            if (it.sub != null) addView(TextView(ctx).apply { text = it.sub; setTextColor(theme.sub); textSize = 12f })
            isEnabled = it.enabled; isClickable = it.enabled
            background = GradientDrawable().apply { cornerRadius = 10 * d; setColor(0) }
            setOnClickListener { _ -> hide(); it.action() }
        })
        val scroll = ScrollView(ctx).apply {
            addView(list)
            background = GradientDrawable().apply { cornerRadius = 18 * d; setColor(theme.bg); setStroke((1 * d).toInt().coerceAtLeast(1), theme.line) }
            elevation = 8 * d
            setOnTouchListener { _, e -> if (e.actionMasked == MotionEvent.ACTION_OUTSIDE) { hide(); true } else false }
        }
        val w = (210 * d).toInt(); val maxH = (screenH * 0.6f).toInt()
        scroll.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(maxH, View.MeasureSpec.AT_MOST))
        val h = scroll.measuredHeight.coerceAtMost(maxH)
        val p = overlayParams(w, h, WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL)
        p.title = "OC pet menu"
        p.x = (if (anchorX + size + w < screenW) anchorX + size * 0.8f else anchorX - w + size * 0.2f).toInt().coerceIn(4, (screenW - w - 4).coerceAtLeast(4))
        p.y = (anchorY + size / 2f - h / 2f).toInt().coerceIn(4, (screenH - h - 4).coerceAtLeast(4))
        if (runCatching { wm.addView(scroll, p) }.isSuccess) root = scroll
    }

    fun hide() { root?.let { runCatching { wm.removeView(it) } }; root = null }
}
