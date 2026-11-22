package app.ocshimeji.render

/**
 * Everything on screen is drawn through this (plan 2.2). Two implementations: Android Canvas (hardware accelerated) on the phone and
 * Java2D on the JVM for screenshot tests — the screens are the same code, so a screenshot taken in a test is what the phone draws
 * (only the font rasteriser differs). Units are density-independent "dp"; the backend scales to pixels.
 * Colors are ARGB ints (0xAARRGGBB).
 */
interface Gfx {
    val width: Float
    val height: Float
    fun save()
    fun restore()
    fun translate(x: Float, y: Float)
    fun scale(sx: Float, sy: Float)
    fun rotate(radians: Float)
    /** multiplies the alpha of everything drawn until the matching restore() */
    fun alpha(a: Float)
    fun clip(x: Float, y: Float, w: Float, h: Float)

    fun fillRect(x: Float, y: Float, w: Float, h: Float, color: Int)
    fun fillRound(x: Float, y: Float, w: Float, h: Float, r: Float, color: Int)
    fun strokeRound(x: Float, y: Float, w: Float, h: Float, r: Float, width: Float, color: Int)
    fun fillCircle(cx: Float, cy: Float, r: Float, color: Int)
    /** vertical gradient from top to bottom */
    fun fillGradientV(x: Float, y: Float, w: Float, h: Float, top: Int, bottom: Int)
    fun line(x1: Float, y1: Float, x2: Float, y2: Float, width: Float, color: Int)
    /** an image into a rectangle (null = whole image) */
    fun image(img: Img, x: Float, y: Float, w: Float, h: Float)
    /**
     * an image bent over a grid (plan 13.3 網格變形): `verts` holds (cols + 1) × (rows + 1) points (x, y pairs, row by row) where the
     * evenly spaced grid points of the picture land. Without a mesh-capable backend it is drawn into the grid's bounding box.
     */
    fun imageMesh(img: Img, cols: Int, rows: Int, verts: FloatArray) {
        var x0 = Float.MAX_VALUE; var y0 = Float.MAX_VALUE; var x1 = -Float.MAX_VALUE; var y1 = -Float.MAX_VALUE
        for (i in 0 until verts.size / 2) { x0 = minOf(x0, verts[i * 2]); x1 = maxOf(x1, verts[i * 2]); y0 = minOf(y0, verts[i * 2 + 1]); y1 = maxOf(y1, verts[i * 2 + 1]) }
        image(img, x0, y0, x1 - x0, y1 - y0)
    }

    /** 1.5.1: device pixels per dp under the current transform (a bitmap cache sizes itself from it); 0 = this backend can't say */
    fun pxPerDp(): Float = 0f
    /** 1.5.1: draw into a new transparent picture of wPx × hPx pixels (`draw` gets a Gfx whose units are those pixels); null = can't */
    fun offscreen(wPx: Int, hPx: Int, draw: (Gfx) -> Unit): Img? = null

    fun text(s: String, x: Float, y: Float, size: Float, color: Int, font: FontKind = FontKind.UI, align: Align = Align.LEFT)
    fun measure(s: String, size: Float, font: FontKind = FontKind.UI): Float
}

enum class FontKind { UI, NUM }
enum class Align { LEFT, CENTER, RIGHT }

/** a decoded image the backend owns */
interface Img { val w: Int; val h: Int }

/** images and fonts by path inside the app's assets ("chars/cinnamon/idle.png"); `maxSide` lets the backend decode a smaller copy */
interface Assets {
    fun image(path: String, maxSide: Int = 2048): Img?
    /** decode bytes that live elsewhere (the player's library), cached by key; `bytes` is only called on a cache miss */
    fun decode(key: String, maxSide: Int, bytes: () -> ByteArray?): Img?
    /** an image made from ARGB pixels (the paint canvas); `reuse` = the previous image of the same size, updated in place */
    fun pixels(w: Int, h: Int, px: IntArray, reuse: Img? = null): Img
}

object Colors {
    fun argb(a: Int, r: Int, g: Int, b: Int) = (a shl 24) or (r shl 16) or (g shl 8) or b
    fun hex(s: String): Int { val v = s.removePrefix("#").toLong(16); return if (s.length <= 7) (0xFF000000 or v).toInt() else v.toInt() }
    fun withAlpha(c: Int, a: Float) = ((((c ushr 24) and 0xFF) * a).toInt().coerceIn(0, 255) shl 24) or (c and 0xFFFFFF)
    fun mix(a: Int, b: Int, t: Float): Int {
        fun ch(c: Int, s: Int) = (c ushr s) and 0xFF
        fun m(s: Int) = (ch(a, s) + (ch(b, s) - ch(a, s)) * t).toInt().coerceIn(0, 255)
        return (m(24) shl 24) or (m(16) shl 16) or (m(8) shl 8) or m(0)
    }
}
