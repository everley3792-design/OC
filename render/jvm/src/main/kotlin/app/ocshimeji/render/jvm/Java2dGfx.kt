package app.ocshimeji.render.jvm

import app.ocshimeji.render.Align
import app.ocshimeji.render.Assets
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import java.awt.AlphaComposite
import java.awt.BasicStroke
import java.awt.Color
import java.awt.Font
import java.awt.GradientPaint
import java.awt.Graphics2D
import java.awt.RenderingHints
import java.awt.geom.Ellipse2D
import java.awt.geom.Line2D
import java.awt.geom.Rectangle2D
import java.awt.geom.RoundRectangle2D
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO

class JImg(val bi: BufferedImage) : Img { override val w get() = bi.width; override val h get() = bi.height }

/** fonts and images from the repository's art/ directory (the APK ships the same files) */
class JvmAssets(private val artDir: File) : Assets {
    private val cache = HashMap<String, JImg?>()
    override fun image(path: String, maxSide: Int): Img? = cache.getOrPut("$path@$maxSide") {
        val f = File(artDir, path); if (!f.isFile) null else ImageIO.read(f)?.let { JImg(downscale(it, maxSide)) }
    }
    override fun pixels(w: Int, h: Int, px: IntArray, reuse: Img?): Img {
        val bi = (reuse as? JImg)?.bi?.takeIf { it.width == w && it.height == h } ?: BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB)
        bi.setRGB(0, 0, w, h, px, 0, w); return (reuse as? JImg)?.takeIf { it.bi === bi } ?: JImg(bi)
    }
    override fun decode(key: String, maxSide: Int, bytes: () -> ByteArray?): Img? = cache.getOrPut(key) { bytes()?.let { b -> ImageIO.read(java.io.ByteArrayInputStream(b))?.let { JImg(downscale(it, maxSide)) } } }
    val ui: Font by lazy { Font.createFont(Font.TRUETYPE_FONT, File(artDir, "fonts/Huninn-Regular.ttf")) }
    val num: Font by lazy { Font.createFont(Font.TRUETYPE_FONT, File(artDir, "fonts/Nunito-ExtraBold.ttf")) }
    private fun downscale(src: BufferedImage, max: Int): BufferedImage {
        var img = src; while (maxOf(img.width, img.height) > max) { val w = maxOf(1, img.width / 2); val h = maxOf(1, img.height / 2)
            val n = BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB); n.createGraphics().apply { setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR); drawImage(img, 0, 0, w, h, null); dispose() }; img = n }
        return img
    }
}

/** Java2D implementation of Gfx (dp → px by `density`) */
class Java2dGfx(private val g: Graphics2D, override val width: Float, override val height: Float, density: Float, private val assets: JvmAssets) : Gfx {
    private data class St(val tx: java.awt.geom.AffineTransform, val clip: java.awt.Shape?, val alpha: Float)
    private val stack = ArrayList<St>()
    private var a = 1f
    init {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON)
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR)
        g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON)
        g.scale(density.toDouble(), density.toDouble())
    }
    private fun col(c: Int) = Color((c shr 16) and 0xFF, (c shr 8) and 0xFF, c and 0xFF, (((c ushr 24) and 0xFF) * a).toInt().coerceIn(0, 255))
    override fun save() { stack += St(g.transform, g.clip, a) }
    override fun restore() { val s = stack.removeAt(stack.size - 1); g.transform = s.tx; g.clip = s.clip; a = s.alpha; g.composite = AlphaComposite.SrcOver }
    override fun translate(x: Float, y: Float) = g.translate(x.toDouble(), y.toDouble())
    override fun scale(sx: Float, sy: Float) = g.scale(sx.toDouble(), sy.toDouble())
    override fun rotate(radians: Float) = g.rotate(radians.toDouble())
    override fun alpha(a: Float) { this.a *= a }
    override fun pxPerDp(): Float { val t = g.transform; return Math.hypot(t.scaleX, t.shearY).toFloat() }
    override fun offscreen(wPx: Int, hPx: Int, draw: (Gfx) -> Unit): Img? {
        if (wPx <= 0 || hPx <= 0) return null
        val bi = BufferedImage(wPx, hPx, BufferedImage.TYPE_INT_ARGB); val g2 = bi.createGraphics()
        try { draw(Java2dGfx(g2, wPx.toFloat(), hPx.toFloat(), 1f, assets)) } finally { g2.dispose() }
        return JImg(bi)
    }
    override fun clip(x: Float, y: Float, w: Float, h: Float) = g.clip(Rectangle2D.Float(x, y, w, h))
    override fun fillRect(x: Float, y: Float, w: Float, h: Float, color: Int) { g.color = col(color); g.fill(Rectangle2D.Float(x, y, w, h)) }
    override fun fillRound(x: Float, y: Float, w: Float, h: Float, r: Float, color: Int) { g.color = col(color); g.fill(RoundRectangle2D.Float(x, y, w, h, r * 2, r * 2)) }
    override fun strokeRound(x: Float, y: Float, w: Float, h: Float, r: Float, width: Float, color: Int) { g.color = col(color); g.stroke = BasicStroke(width); g.draw(RoundRectangle2D.Float(x, y, w, h, r * 2, r * 2)) }
    override fun fillCircle(cx: Float, cy: Float, r: Float, color: Int) { g.color = col(color); g.fill(Ellipse2D.Float(cx - r, cy - r, r * 2, r * 2)) }
    override fun fillGradientV(x: Float, y: Float, w: Float, h: Float, top: Int, bottom: Int) { g.paint = GradientPaint(x, y, col(top), x, y + h, col(bottom)); g.fill(Rectangle2D.Float(x, y, w, h)) }
    override fun line(x1: Float, y1: Float, x2: Float, y2: Float, width: Float, color: Int) { g.color = col(color); g.stroke = BasicStroke(width, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND); g.draw(Line2D.Float(x1, y1, x2, y2)) }
    override fun image(img: Img, x: Float, y: Float, w: Float, h: Float) {
        val bi = (img as JImg).bi; g.composite = AlphaComposite.getInstance(AlphaComposite.SRC_OVER, a)
        val t = g.transform; g.translate(x.toDouble(), y.toDouble()); g.scale((w / bi.width).toDouble(), (h / bi.height).toDouble()); g.drawImage(bi, 0, 0, null); g.transform = t
        g.composite = AlphaComposite.SrcOver
    }
    /** each cell drawn with the affine map that sends its corners (top-left, top-right, bottom-left) where the grid says */
    override fun imageMesh(img: Img, cols: Int, rows: Int, verts: FloatArray) {
        val bi = (img as JImg).bi; g.composite = AlphaComposite.getInstance(AlphaComposite.SRC_OVER, a)
        val cw = bi.width.toDouble() / cols; val ch = bi.height.toDouble() / rows; val t0 = g.transform
        for (r in 0 until rows) for (c in 0 until cols) {
            fun v(i: Int, j: Int) = (j * (cols + 1) + i) * 2
            val p0 = v(c, r); val p1 = v(c + 1, r); val p2 = v(c, r + 1)
            val sx0 = (c * cw).toInt(); val sy0 = (r * ch).toInt(); val sw = maxOf(1, ((c + 1) * cw).toInt() - sx0); val sh = maxOf(1, ((r + 1) * ch).toInt() - sy0)
            val m = java.awt.geom.AffineTransform((verts[p1] - verts[p0]) / sw.toDouble(), (verts[p1 + 1] - verts[p0 + 1]) / sw.toDouble(), (verts[p2] - verts[p0]) / sh.toDouble(), (verts[p2 + 1] - verts[p0 + 1]) / sh.toDouble(), verts[p0].toDouble(), verts[p0 + 1].toDouble())
            g.transform = t0; g.transform(m); g.drawImage(bi.getSubimage(sx0, sy0, minOf(sw + 1, bi.width - sx0), minOf(sh + 1, bi.height - sy0)), 0, 0, null)
        }
        g.transform = t0; g.composite = AlphaComposite.SrcOver
    }
    private fun font(kind: FontKind, size: Float) = (if (kind == FontKind.NUM) assets.num else assets.ui).deriveFont(size)
    override fun text(s: String, x: Float, y: Float, size: Float, color: Int, font: FontKind, align: Align) {
        g.font = font(font, size); g.color = col(color)
        val w = g.fontMetrics.stringWidth(s).toFloat() * 0 + measure(s, size, font)
        val dx = when (align) { Align.LEFT -> 0f; Align.CENTER -> -w / 2; Align.RIGHT -> -w }
        g.drawString(s, x + dx, y)
    }
    override fun measure(s: String, size: Float, font: FontKind): Float = font(font, size).getStringBounds(s, g.fontRenderContext).width.toFloat()

    companion object {
        /** draw something into a PNG (width/height in dp) */
        fun render(w: Int, h: Int, density: Float, assets: JvmAssets, draw: (Gfx) -> Unit): BufferedImage {
            val img = BufferedImage((w * density).toInt(), (h * density).toInt(), BufferedImage.TYPE_INT_ARGB)
            val g = img.createGraphics(); draw(Java2dGfx(g, w.toFloat(), h.toFloat(), density, assets)); g.dispose(); return img
        }
        fun writePng(img: BufferedImage, f: File) { f.parentFile.mkdirs(); ImageIO.write(img, "png", f) }
    }
}
