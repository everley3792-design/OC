package app.ocshimeji.android

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import app.ocshimeji.render.Align
import app.ocshimeji.render.Assets
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img

class AImg(val bmp: Bitmap) : Img { override val w get() = bmp.width; override val h get() = bmp.height }

/** images from the APK's assets, decoded no bigger than needed (a 3072 px drawing is never held at full size) */
class AndroidAssets(private val am: AssetManager) : Assets {
    /* least recently used first; bitmaps of the app's own art are small, the player's frames can be many — keep about 48 MB */
    private val cache = object : LinkedHashMap<String, AImg?>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, AImg?>?): Boolean {
            var bytes = 0L; for (v in values) bytes += v?.bmp?.byteCount?.toLong() ?: 0L
            return bytes > 48L * 1024 * 1024 && size > 8
        }
    }
    val ui: Typeface by lazy { runCatching { Typeface.createFromAsset(am, "fonts/Huninn-Regular.ttf") }.getOrDefault(Typeface.DEFAULT) }
    val num: Typeface by lazy { runCatching { Typeface.createFromAsset(am, "fonts/Nunito-ExtraBold.ttf") }.getOrDefault(Typeface.DEFAULT_BOLD) }
    override fun image(path: String, maxSide: Int): Img? = cache.getOrPut("$path@$maxSide") {
        runCatching {
            val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }; am.open(path).use { BitmapFactory.decodeStream(it, null, o) }
            var s = 1; while (maxOf(o.outWidth, o.outHeight) / (s * 2) >= maxSide) s *= 2
            val opt = BitmapFactory.Options().apply { inSampleSize = s; inPreferredConfig = Bitmap.Config.ARGB_8888 }
            am.open(path).use { BitmapFactory.decodeStream(it, null, opt) }?.let { AImg(it) }
        }.getOrNull()
    }
    override fun decode(key: String, maxSide: Int, bytes: () -> ByteArray?): Img? = cache.getOrPut(key) {
        runCatching {
            val b = bytes() ?: return@runCatching null
            val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeByteArray(b, 0, b.size, o)
            var s = 1; while (maxOf(o.outWidth, o.outHeight) / (s * 2) >= maxSide) s *= 2
            BitmapFactory.decodeByteArray(b, 0, b.size, BitmapFactory.Options().apply { inSampleSize = s; inPreferredConfig = Bitmap.Config.ARGB_8888 })?.let { AImg(it) }
        }.getOrNull()
    }
}

/** render:api on a (hardware-accelerated) Android Canvas; everything in dp, scaled by the display density */
class AndroidGfx(private val assets: AndroidAssets) : Gfx {
    private lateinit var c: Canvas
    private var density = 1f
    override var width = 0f; private set
    override var height = 0f; private set
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
    private val bmpPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG)
    private val rect = RectF()
    private val alphas = FloatArray(64); private var depth = 0; private var a = 1f

    fun begin(canvas: Canvas, density: Float) { c = canvas; this.density = density; width = canvas.width / density; height = canvas.height / density; depth = 0; a = 1f; c.save(); c.scale(density, density) }
    fun end() { c.restore() }

    private fun col(p: Paint, color: Int) { p.shader = null; p.color = color; p.alpha = (((color ushr 24) and 0xFF) * a).toInt().coerceIn(0, 255) }
    override fun save() { c.save(); alphas[depth++] = a }
    override fun restore() { c.restore(); a = alphas[--depth] }
    override fun translate(x: Float, y: Float) = c.translate(x, y)
    override fun scale(sx: Float, sy: Float) = c.scale(sx, sy)
    override fun rotate(radians: Float) = c.rotate(Math.toDegrees(radians.toDouble()).toFloat())
    override fun alpha(a: Float) { this.a *= a }
    override fun clip(x: Float, y: Float, w: Float, h: Float) { c.clipRect(x, y, x + w, y + h) }
    override fun fillRect(x: Float, y: Float, w: Float, h: Float, color: Int) { col(fill, color); c.drawRect(x, y, x + w, y + h, fill) }
    override fun fillRound(x: Float, y: Float, w: Float, h: Float, r: Float, color: Int) { col(fill, color); rect.set(x, y, x + w, y + h); val rr = minOf(r, w / 2, h / 2); c.drawRoundRect(rect, rr, rr, fill) }
    override fun strokeRound(x: Float, y: Float, w: Float, h: Float, r: Float, width: Float, color: Int) { col(stroke, color); stroke.strokeWidth = width; rect.set(x, y, x + w, y + h); val rr = minOf(r, w / 2, h / 2); c.drawRoundRect(rect, rr, rr, stroke) }
    override fun fillCircle(cx: Float, cy: Float, r: Float, color: Int) { col(fill, color); c.drawCircle(cx, cy, r, fill) }
    override fun fillGradientV(x: Float, y: Float, w: Float, h: Float, top: Int, bottom: Int) {
        fill.shader = LinearGradient(0f, y, 0f, y + h, top, bottom, Shader.TileMode.CLAMP); fill.alpha = (255 * a).toInt(); c.drawRect(x, y, x + w, y + h, fill); fill.shader = null
    }
    override fun line(x1: Float, y1: Float, x2: Float, y2: Float, width: Float, color: Int) { col(stroke, color); stroke.strokeWidth = width; c.drawLine(x1, y1, x2, y2, stroke) }
    override fun image(img: Img, x: Float, y: Float, w: Float, h: Float) { bmpPaint.alpha = (255 * a).toInt().coerceIn(0, 255); rect.set(x, y, x + w, y + h); c.drawBitmap((img as AImg).bmp, null, rect, bmpPaint) }
    private fun tp(size: Float, font: FontKind) { textPaint.textSize = size; textPaint.typeface = if (font == FontKind.NUM) assets.num else assets.ui }
    override fun text(s: String, x: Float, y: Float, size: Float, color: Int, font: FontKind, align: Align) {
        tp(size, font); col(textPaint, color)
        textPaint.textAlign = when (align) { Align.LEFT -> Paint.Align.LEFT; Align.CENTER -> Paint.Align.CENTER; Align.RIGHT -> Paint.Align.RIGHT }
        c.drawText(s, x, y, textPaint)
    }
    override fun measure(s: String, size: Float, font: FontKind): Float { tp(size, font); return textPaint.measureText(s) }
}
