package app.ocshimeji.save.paint

import app.ocshimeji.save.media.Pixels
import app.ocshimeji.save.media.Raster
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * The paint workshop's engine (plan 12.6): layers, brushes, symmetry, a stabiliser, selection with move / scale / rotate / flip,
 * fill, gradient, eyedropper, 100 steps of undo, canvas templates (wallpapers and floors draw seamlessly across the edges),
 * flattening for export. Pure Kotlin on ARGB pixels: the phone and the tests run exactly this; the screen only shows it.
 *
 * Every stroke paints a coverage mask (0..1 per pixel) over the layer as it was when the stroke began, so a stroke never piles up on
 * itself (markers stay even) and one stroke = one undo step.
 */
class Layer(var name: String, val r: Raster, var opacity: Float = 1f, var visible: Boolean = true, /** a tracing reference: shown faintly, never exported */ var trace: Boolean = false) {
    /** goes up whenever its pixels change (the screen re-uploads only changed layers) */
    var rev = 0
}

enum class Tool(val zh: String) { PENCIL("鉛筆"), PEN("沾水筆"), MARKER("馬克筆"), AIRBRUSH("噴槍"), WATERCOLOR("水彩"), ERASER("橡皮擦"), FILL("填色"), GRADIENT("漸層"), PICK("滴管"), SELECT("選取") }

/** canvas templates (plan 12.6) */
enum class Template(val zh: String, val w: Int, val h: Int, val tile: Boolean) {
    CHARACTER("角色", 1024, 1024, false), ITEM("物品", 512, 512, false), WALLPAPER("壁紙", 256, 256, true), FLOOR("地板", 256, 256, true), STICKER("貼紙", 256, 256, false), FACE("表情", 512, 512, false)
}

/** brush settings; `size` in pixels, `opacity` 0..1, `stabilize` 0..1 (more = smoother, laggier), symmetry "none" / "mirror" / "radial" with `radial` arms */
class Brush(var tool: Tool = Tool.PEN, var color: Int = 0xFF4A3A30.toInt(), var size: Float = 12f, var opacity: Float = 1f, var stabilize: Float = 0.3f,
            var symmetry: String = "none", var radial: Int = 6, var tolerance: Int = 32, var color2: Int = 0)

class PaintDoc(val w: Int, val h: Int, val template: Template = Template.CHARACTER, val tile: Boolean = template.tile) {
    val layers = ArrayList<Layer>()
    var current = 0
    val layer: Layer get() = layers[current]
    val brush = Brush()
    /** colour swatches the player keeps */
    val swatches = ArrayList<Int>()
    /** something changed since the last save (the leave warning) */
    var dirty = false

    init { layers += Layer("圖層 1", Raster(w, h)) }

    // ================= history =================
    private class Op(val undo: () -> Unit, val redo: () -> Unit, val bytes: Long)
    private val undos = ArrayList<Op>(); private val redos = ArrayList<Op>()
    val canUndo get() = undos.isNotEmpty(); val canRedo get() = redos.isNotEmpty()
    val undoCount get() = undos.size
    private fun push(op: Op) {
        undos += op; redos.clear(); dirty = true
        while (undos.size > MAX_UNDO || undos.sumOf { it.bytes } > MAX_UNDO_BYTES) undos.removeAt(0)
    }
    fun undo(): Boolean { val op = undos.removeLastOrNull() ?: return false; op.undo(); redos += op; dirty = true; return true }
    fun redo(): Boolean { val op = redos.removeLastOrNull() ?: return false; op.redo(); undos += op; dirty = true; return true }
    /** a pixel change inside `rect` of one layer, recorded as before / after */
    private fun patch(l: Layer, x0: Int, y0: Int, x1: Int, y1: Int, before: IntArray, onUndo: () -> Unit = {}, onRedo: () -> Unit = {}) {
        val rw = x1 - x0; val rh = y1 - y0; if (rw <= 0 || rh <= 0) return
        val after = IntArray(rw * rh); for (y in 0 until rh) System.arraycopy(l.r.px, (y0 + y) * w + x0, after, y * rw, rw)
        if (before.contentEquals(after)) return
        fun put(a: IntArray) { for (y in 0 until rh) System.arraycopy(a, y * rw, l.r.px, (y0 + y) * w + x0, rw); l.rev++ }
        push(Op({ put(before); onUndo() }, { put(after); onRedo() }, (rw * rh * 8L)))
    }
    private fun grab(l: Layer, x0: Int, y0: Int, x1: Int, y1: Int): IntArray { val rw = x1 - x0; val out = IntArray(rw * (y1 - y0)); for (y in y0 until y1) System.arraycopy(l.r.px, y * w + x0, out, (y - y0) * rw, rw); return out }
    private fun whole(l: Layer, onUndo: () -> Unit = {}, onRedo: () -> Unit = {}, change: () -> Unit) { val before = l.r.px.copyOf(); change(); l.rev++; patch(l, 0, 0, w, h, before, onUndo, onRedo) }

    // ================= layers =================
    fun addLayer(name: String = "圖層 ${layers.size + 1}", r: Raster = Raster(w, h), trace: Boolean = false): Layer {
        require(layers.size < MAX_LAYERS) { "圖層最多 $MAX_LAYERS 個" }
        val l = Layer(name, r, if (trace) 0.4f else 1f, true, trace); val at = current + 1
        layers.add(at, l); val prev = current; current = at
        push(Op({ layers.remove(l); current = prev.coerceIn(0, layers.size - 1) }, { layers.add(at, l); current = at }, w * h * 4L)); return l
    }
    fun removeLayer(i: Int = current): Boolean {
        if (layers.size <= 1) return false
        val l = layers.removeAt(i); val prev = current; current = current.coerceAtMost(layers.size - 1)
        push(Op({ layers.add(i, l); current = prev }, { layers.remove(l); current = current.coerceAtMost(layers.size - 1) }, w * h * 4L)); return true
    }
    fun moveLayer(from: Int, to: Int) {
        if (from == to || to !in layers.indices) return
        fun mv(a: Int, b: Int) { val l = layers.removeAt(a); layers.add(b, l); current = b }
        mv(from, to); push(Op({ mv(to, from) }, { mv(from, to) }, 16))
    }
    fun mergeDown(i: Int = current): Boolean {
        if (i <= 0) return false
        val top = layers[i]; val below = layers[i - 1]; val before = below.r.px.copyOf()
        if (top.visible) composite(below.r, top.r, top.opacity); below.rev++
        val after = below.r.px.copyOf(); layers.removeAt(i); current = i - 1
        push(Op({ System.arraycopy(before, 0, below.r.px, 0, before.size); below.rev++; layers.add(i, top); current = i }, { System.arraycopy(after, 0, below.r.px, 0, after.size); below.rev++; layers.remove(top); current = i - 1 }, w * h * 8L)); return true
    }
    fun setOpacity(i: Int, a: Float) { val l = layers[i]; val old = l.opacity; val n = a.coerceIn(0f, 1f); l.opacity = n; push(Op({ l.opacity = old }, { l.opacity = n }, 8)) }
    fun setVisible(i: Int, v: Boolean) { val l = layers[i]; val old = l.visible; l.visible = v; push(Op({ l.visible = old }, { l.visible = v }, 8)) }
    /** a picture as a new layer (fitted inside the canvas, centred); `trace` = a faint reference that is never exported */
    fun importLayer(src: Raster, name: String = "匯入的圖", trace: Boolean = false): Layer {
        val (fw, fh) = Pixels.fit(src.w, src.h, min(w, h)).let { (a, b) -> if (a > w || b > h) Pixels.fit(a, b, min(w, h)) else a to b }
        val fitted = if (fw != src.w || fh != src.h) Pixels.resize(src, fw, fh) else src
        val r = Raster(w, h); Pixels.over(r, fitted, (w - fw) / 2, (h - fh) / 2, blend = false)
        return addLayer(name, r, trace)
    }

    // ================= strokes =================
    private var mask: FloatArray? = null; private var base: IntArray? = null
    private var bx0 = 0; private var by0 = 0; private var bx1 = 0; private var by1 = 0
    private var lx = 0f; private var ly = 0f; private var sx = 0f; private var sy = 0f; private var lastP = 1f; private var carry = 0f
    private var stroking = false
    /** the first point of a stroke (canvas pixels; pressure 0..1, 1 without a stylus) */
    fun down(x: Float, y: Float, pressure: Float = 1f) {
        val b = brush
        when (b.tool) {
            Tool.FILL -> { fill(x.toInt(), y.toInt()); return }
            Tool.PICK -> { pick(x.toInt(), y.toInt())?.let { b.color = it }; return }
            Tool.GRADIENT, Tool.SELECT -> { gx0 = x; gy0 = y; return }
            else -> {}
        }
        if (!layer.visible) return
        mask = FloatArray(w * h); base = layer.r.px.copyOf(); bx0 = w; by0 = h; bx1 = 0; by1 = 0
        lx = x; ly = y; sx = x; sy = y; lastP = pressure; carry = 0f; stroking = true
        dab(x, y, pressure)
    }
    fun move(x: Float, y: Float, pressure: Float = 1f) {
        if (!stroking) { gx1 = x; gy1 = y; return }
        /* the stabiliser: the brush follows the finger on a lazy string */
        val k = 1f - brush.stabilize.coerceIn(0f, 0.95f) * 0.9f
        sx += (x - sx) * k; sy += (y - sy) * k
        segment(lx, ly, lastP, sx, sy, pressure); lx = sx; ly = sy; lastP = pressure
    }
    fun up(x: Float, y: Float) {
        val b = brush
        if (!stroking) { when (b.tool) { Tool.GRADIENT -> gradient(gx0, gy0, x, y); Tool.SELECT -> select(gx0, gy0, x, y); else -> {} }; return }
        segment(lx, ly, lastP, x, y, lastP)
        stroking = false
        val bb = base ?: return
        if (bx1 > bx0 && by1 > by0) {
            val rw = bx1 - bx0; val before = IntArray(rw * (by1 - by0)); for (y0 in by0 until by1) System.arraycopy(bb, y0 * w + bx0, before, (y0 - by0) * rw, rw)
            patch(layer, bx0, by0, bx1, by1, before)
        }
        mask = null; base = null
    }
    private var gx0 = 0f; private var gy0 = 0f; private var gx1 = 0f; private var gy1 = 0f
    /** a second finger arrived right after the first: the stroke was not meant (no undo step, nothing left) */
    fun cancel() { val bb = base ?: run { stroking = false; return }; System.arraycopy(bb, 0, layer.r.px, 0, bb.size); layer.rev++; stroking = false; mask = null; base = null }
    val drawing: Boolean get() = stroking
    /** the drag of a gradient or selection, for the screen to show while the finger is down */
    val dragLine: FloatArray? get() = if (!stroking && (brush.tool == Tool.GRADIENT || brush.tool == Tool.SELECT)) floatArrayOf(gx0, gy0, gx1, gy1) else null
    private fun spacing(): Float = max(0.5f, brush.size * when (brush.tool) { Tool.AIRBRUSH -> 0.12f; Tool.WATERCOLOR -> 0.18f; else -> 0.22f })
    private fun segment(x0: Float, y0: Float, p0: Float, x1: Float, y1: Float, p1: Float) {
        val d = hypot(x1 - x0, y1 - y0); if (d < 1e-3f) return
        val step = spacing(); var t = step - carry
        while (t <= d) { val k = t / d; dab(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, p0 + (p1 - p0) * k); t += step }
        carry = d - (t - step)
    }
    /** one brush stamp, repeated for symmetry */
    private fun dab(x: Float, y: Float, p: Float) {
        val b = brush; val cx = w / 2f; val cy = h / 2f
        when (b.symmetry) {
            "mirror" -> { stamp(x, y, p); stamp(w - 1 - x, y, p) }
            "radial" -> { val n = b.radial.coerceIn(2, 16); val dx = x - cx; val dy = y - cy
                for (i in 0 until n) { val a = (2 * Math.PI * i / n).toFloat(); stamp(cx + dx * cos(a) - dy * sin(a), cy + dx * sin(a) + dy * cos(a), p) } }
            else -> stamp(x, y, p)
        }
    }
    private fun stamp(x: Float, y: Float, p: Float) {
        val b = brush; val m = mask ?: return
        val pr = p.coerceIn(0.05f, 1f)
        val r = when (b.tool) { Tool.PEN -> b.size * (0.25f + 0.75f * pr); Tool.PENCIL -> max(0.5f, b.size * (0.6f + 0.4f * pr)); else -> b.size } / 2f
        val strength = when (b.tool) { Tool.AIRBRUSH -> 0.08f * pr; Tool.WATERCOLOR -> 0.5f * pr; Tool.MARKER -> 0.7f; Tool.PENCIL -> 0.9f * (0.5f + 0.5f * pr); else -> 1f }
        val ri = ceil(r + 1).toInt()
        for (oy in -ri..ri) for (ox in -ri..ri) {
            var px = floor(x).toInt() + ox; var py = floor(y).toInt() + oy
            if (tile) { px = Math.floorMod(px, w); py = Math.floorMod(py, h) } else if (px !in 0 until w || py !in 0 until h) continue
            val d = hypot(floor(x) + ox + 0.5f - x, floor(y) + oy + 0.5f - y)
            val cov = when (b.tool) {
                Tool.PENCIL -> if (d <= r) 1f else 0f
                Tool.AIRBRUSH -> exp(-(d * d) / (r * r * 0.45f)).let { if (d > r) 0f else it }
                Tool.WATERCOLOR -> if (d > r) 0f else (1f - (d / r)).let { it * it * 0.7f + 0.3f * (if (d > r * 0.8f) 1f else 0.5f) }
                else -> ((r + 0.5f - d).coerceIn(0f, 1f))
            } * strength
            if (cov <= 0f) continue
            val i = py * w + px
            m[i] = if (b.tool == Tool.AIRBRUSH) min(1f, m[i] + cov) else max(m[i], cov)
            paintPixel(i)
            if (px < bx0) bx0 = px; if (py < by0) by0 = py; if (px + 1 > bx1) bx1 = px + 1; if (py + 1 > by1) by1 = py + 1
        }
        layer.rev++
    }
    /** layer pixel = the pixel before the stroke with the brush laid over it by the mask */
    private fun paintPixel(i: Int) {
        val b = brush; val k = (mask!![i] * b.opacity).coerceIn(0f, 1f); val src = base!![i]
        layer.r.px[i] = if (b.tool == Tool.ERASER) {
            val a = ((src ushr 24) and 255) * (1f - k); (a.roundToInt() shl 24) or (src and 0xFFFFFF)
        } else over(src, b.color, k)
    }

    // ================= fill, gradient, pick =================
    /** flood fill on the current layer: neighbours within `tolerance` of the tapped colour (wraps on seamless canvases) */
    fun fill(x: Int, y: Int) {
        if (x !in 0 until w || y !in 0 until h) return
        val l = layer; val px = l.r.px; val target = px[y * w + x]; val c = brush.color
        if (target == c) return
        val before = px.copyOf(); val seen = BooleanArray(w * h); val q = IntArray(w * h); var qh = 0; var qt = 0
        q[qt++] = y * w + x; seen[y * w + x] = true
        while (qh < qt) {
            val i = q[qh++]; px[i] = over(before[i], c, brush.opacity); if (qh == 1) l.rev++
            val ix = i % w; val iy = i / w
            for ((nx0, ny0) in arrayOf(ix + 1 to iy, ix - 1 to iy, ix to iy + 1, ix to iy - 1)) {
                val nx = if (tile) Math.floorMod(nx0, w) else nx0; val ny = if (tile) Math.floorMod(ny0, h) else ny0
                if (nx !in 0 until w || ny !in 0 until h) continue
                val j = ny * w + nx; if (!seen[j] && near(before[j], target, brush.tolerance)) { seen[j] = true; q[qt++] = j }
            }
        }
        patch(l, 0, 0, w, h, before)
    }
    /** a linear gradient from colour to colour2 (transparent when colour2 is 0), inside the selection if there is one */
    fun gradient(x0: Float, y0: Float, x1: Float, y1: Float) {
        val dx = x1 - x0; val dy = y1 - y0; val len2 = dx * dx + dy * dy; if (len2 < 1f) return
        val s = selection; val (ax, ay, bx, by) = if (s != null) intArrayOf(s[0], s[1], s[2], s[3]).toList() else listOf(0, 0, w, h)
        whole(layer) {
            for (y in ay until by) for (x in ax until bx) {
                val t = (((x - x0) * dx + (y - y0) * dy) / len2).coerceIn(0f, 1f)
                val c = lerpColor(brush.color, if (brush.color2 == 0) brush.color and 0xFFFFFF else brush.color2, t)
                val i = y * w + x; layer.r.px[i] = over(layer.r.px[i], c, brush.opacity)
            }
        }
    }
    /** the colour under a point, from everything visible */
    fun pick(x: Int, y: Int): Int? { if (x !in 0 until w || y !in 0 until h) return null; val c = flatten(includeTrace = true).px[y * w + x]; return if ((c ushr 24) < 8) null else c or (0xFF shl 24) }
    fun keepSwatch(c: Int) { if (c !in swatches) { swatches.add(0, c); while (swatches.size > 24) swatches.removeAt(swatches.size - 1) } }

    // ================= selection: move, scale, rotate, flip =================
    /** x0, y0, x1, y1 (exclusive) */
    var selection: IntArray? = null; private set
    fun select(ax: Float, ay: Float, bx: Float, by: Float) {
        val x0 = min(ax, bx).toInt().coerceIn(0, w); val x1 = ceil(max(ax, bx)).toInt().coerceIn(0, w)
        val y0 = min(ay, by).toInt().coerceIn(0, h); val y1 = ceil(max(ay, by)).toInt().coerceIn(0, h)
        selection = if (x1 - x0 >= 2 && y1 - y0 >= 2) intArrayOf(x0, y0, x1, y1) else null
    }
    fun selectAll() { selection = intArrayOf(0, 0, w, h) }
    fun clearSelection() { selection = null }
    /**
     * transform what is inside the selection (one undo step): moved by (dx, dy), scaled by (sx, sy) and rotated by `angle` radians
     * around its centre, flipped if asked. What was under it is left empty.
     */
    fun transform(dx: Float = 0f, dy: Float = 0f, scaleX: Float = 1f, scaleY: Float = 1f, angle: Float = 0f, flipH: Boolean = false, flipV: Boolean = false) {
        val s = selection ?: intArrayOf(0, 0, w, h)
        val sw = s[2] - s[0]; val sh = s[3] - s[1]; val l = layer
        val piece = IntArray(sw * sh); for (y in 0 until sh) System.arraycopy(l.r.px, (s[1] + y) * w + s[0], piece, y * sw, sw)
        val cx = s[0] + sw / 2f; val cy = s[1] + sh / 2f; val ncx = cx + dx; val ncy = cy + dy
        val fx = if (flipH) -scaleX else scaleX; val fy = if (flipV) -scaleY else scaleY
        val ca = cos(angle); val sa = sin(angle)
        /* where the corners go → the box to fill */
        val cs = listOf(-sw / 2f to -sh / 2f, sw / 2f to -sh / 2f, -sw / 2f to sh / 2f, sw / 2f to sh / 2f).map { (u, v) -> val a = u * fx; val b = v * fy; (ncx + a * ca - b * sa) to (ncy + a * sa + b * ca) }
        val x0 = floor(cs.minOf { it.first }).toInt().coerceIn(0, w); val x1 = ceil(cs.maxOf { it.first }).toInt().coerceIn(0, w)
        val y0 = floor(cs.minOf { it.second }).toInt().coerceIn(0, h); val y1 = ceil(cs.maxOf { it.second }).toInt().coerceIn(0, h)
        val oldSel = selection; val newSel = intArrayOf(x0, y0, max(x0 + 1, x1), max(y0 + 1, y1))
        whole(l, { selection = oldSel }, { selection = newSel }) {
            for (y in s[1] until s[3]) for (x in s[0] until s[2]) l.r.px[y * w + x] = 0
            for (y in y0 until y1) for (x in x0 until x1) {
                val rx = x + 0.5f - ncx; val ry = y + 0.5f - ncy
                val u = (rx * ca + ry * sa) / fx; val v = (-rx * sa + ry * ca) / fy   /* back into the piece */
                val px = floor(u + sw / 2f).toInt(); val py = floor(v + sh / 2f).toInt()
                if (px in 0 until sw && py in 0 until sh) { val c = piece[py * sw + px]; if ((c ushr 24) > 0) l.r.px[y * w + x] = over(l.r.px[y * w + x], c, 1f) }
            }
        }
        selection = newSel
    }
    fun flipLayer(horizontal: Boolean) { val l = layer; whole(l) { val c = l.r.px.copyOf(); for (y in 0 until h) for (x in 0 until w) l.r.px[y * w + x] = if (horizontal) c[y * w + (w - 1 - x)] else c[(h - 1 - y) * w + x] } }
    fun clearLayer() { val l = layer; whole(l) { java.util.Arrays.fill(l.r.px, 0) } }

    // ================= output =================
    /** everything visible as one picture (tracing layers left out unless asked) */
    fun flatten(includeTrace: Boolean = false): Raster { val out = Raster(w, h); for (l in layers) if (l.visible && (includeTrace || !l.trace)) composite(out, l.r, l.opacity); return out }
    /** the drawn part only (transparent margins cut away, with a little room) — for characters and items */
    fun trimmed(pad: Int = 4): Raster? {
        val f = flatten(); var l = w; var t = h; var r = -1; var b = -1
        for (y in 0 until h) for (x in 0 until w) if ((f.px[y * w + x] ushr 24) > 8) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y }
        if (r < 0) return null
        val x0 = max(0, l - pad); val y0 = max(0, t - pad); val x1 = min(w, r + pad + 1); val y1 = min(h, b + pad + 1)
        val o = Raster(x1 - x0, y1 - y0); for (y in y0 until y1) System.arraycopy(f.px, y * w + x0, o.px, (y - y0) * o.w, o.w); return o
    }
    val empty: Boolean get() = layers.all { l -> l.r.px.all { (it ushr 24) == 0 } }

    companion object {
        const val MAX_UNDO = 100
        const val MAX_UNDO_BYTES = 160L * 1024 * 1024
        const val MAX_LAYERS = 12
        fun of(t: Template) = PaintDoc(t.w, t.h, t, t.tile)
        /** `c` over `dst` with extra strength k (0..1), straight alpha */
        fun over(dst: Int, c: Int, k: Float): Int {
            val sa = ((c ushr 24) and 255) / 255f * k; if (sa <= 0f) return dst
            val da = ((dst ushr 24) and 255) / 255f; val oa = sa + da * (1 - sa); if (oa <= 0f) return 0
            fun ch(s: Int) = ((((c shr s) and 255) * sa + ((dst shr s) and 255) * da * (1 - sa)) / oa).roundToInt().coerceIn(0, 255)
            return ((oa * 255).roundToInt() shl 24) or (ch(16) shl 16) or (ch(8) shl 8) or ch(0)
        }
        fun composite(dst: Raster, src: Raster, opacity: Float) { for (i in 0 until min(dst.px.size, src.px.size)) { val s = src.px[i]; if ((s ushr 24) != 0) dst.px[i] = over(dst.px[i], s, opacity) } }
        fun lerpColor(a: Int, b: Int, t: Float): Int {
            fun ch(s: Int): Int { val x = (a shr s) and 255; val y = (b shr s) and 255; return (x + (y - x) * t).roundToInt().coerceIn(0, 255) }
            return (ch(24) shl 24) or (ch(16) shl 16) or (ch(8) shl 8) or ch(0)
        }
        fun near(a: Int, b: Int, tol: Int): Boolean { if ((a ushr 24) < 16 && (b ushr 24) < 16) return true; for (s in intArrayOf(24, 16, 8, 0)) if (abs(((a shr s) and 255) - ((b shr s) and 255)) > tol) return false; return true }
        /** does a seamless picture really tile? (left matches right, top matches bottom) — the wallpaper check */
        fun seamless(r: Raster, tol: Int = 48): Boolean {
            var bad = 0; for (y in 0 until r.h) if (!near(r.px[y * r.w], r.px[y * r.w + r.w - 1], tol)) bad++; for (x in 0 until r.w) if (!near(r.px[x], r.px[(r.h - 1) * r.w + x], tol)) bad++
            return bad <= (r.w + r.h) / 10
        }
    }
}
