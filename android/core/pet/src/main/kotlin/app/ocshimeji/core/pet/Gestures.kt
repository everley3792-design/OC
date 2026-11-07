package app.ocshimeji.core.pet

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.sign

/**
 * Touch classifier for one pet window (pure, timestamp-driven → unit-testable).
 *
 * Feed it raw pointer samples in screen pixels with their event time (ms). It reports:
 *  - TAP (immediately on a short still touch) and DOUBLE_TAP (second tap within [doubleMs])
 *  - LONG_PRESS (still for [longMs]; reported from [tick] so a slow frame never turns a tap into one)
 *  - STROKE for every back-and-forth while the finger stays roughly in place (petting)
 *  - DRAG_START / DRAG_MOVE / DROP(vx, vy) for picking the pet up and throwing it
 */
class Gestures(private val slop: Float = 24f, private val dragDist: Float = 90f, private val longMs: Long = 520L, private val doubleMs: Long = 320L) {
    enum class Kind { TAP, DOUBLE_TAP, LONG_PRESS, STROKE, DRAG_START, DRAG_MOVE, DROP, CANCEL }
    data class Ev(val kind: Kind, val x: Float = 0f, val y: Float = 0f, val vx: Float = 0f, val vy: Float = 0f, val count: Int = 0)

    private var down = false
    private var dx0 = 0f; private var dy0 = 0f; private var t0 = 0L
    private var lx = 0f; private var ly = 0f
    private var dragging = false; private var longFired = false; private var moved = false
    private var path = 0f; private var dirX = 0f; private var reversals = 0; private var strokes = 0
    private var lastTapT = -10_000L; private var lastTapX = 0f; private var lastTapY = 0f
    private val hist = ArrayDeque<FloatArray>()   // (x, y, t)

    val isDragging get() = dragging
    val isDown get() = down

    fun down(x: Float, y: Float, t: Long): List<Ev> {
        down = true; dragging = false; longFired = false; moved = false
        dx0 = x; dy0 = y; t0 = t; lx = x; ly = y; path = 0f; dirX = 0f; reversals = 0; strokes = 0
        hist.clear(); hist.addLast(floatArrayOf(x, y, t.toFloat()))
        return emptyList()
    }

    fun move(x: Float, y: Float, t: Long): List<Ev> {
        if (!down) return emptyList()
        val out = ArrayList<Ev>(2)
        val ddx = x - lx; path += hypot(ddx, y - ly)
        if (abs(ddx) > 3f) { val s = sign(ddx); if (dirX != 0f && s != dirX) reversals++; dirX = s }
        lx = x; ly = y
        hist.addLast(floatArrayOf(x, y, t.toFloat())); while (hist.size > 2 && t - hist.first()[2] > 100f) hist.removeFirst()
        val net = hypot(x - dx0, y - dy0)
        if (net > slop) moved = true
        if (dragging) { out += Ev(Kind.DRAG_MOVE, x, y); return out }
        // petting: the finger goes back and forth but stays near where it started
        if (reversals >= 2 && net < dragDist && abs(y - dy0) < dragDist * 0.6f) {
            val n = reversals / 2
            if (n > strokes) { strokes = n; out += Ev(Kind.STROKE, x, y, count = strokes) }
            return out
        }
        // pick up: clearly moved away (or moved after a long press)
        if (net > dragDist || (longFired && net > slop) || (moved && strokes == 0 && t - t0 > 260 && net > slop * 1.5f)) {
            dragging = true; out += Ev(Kind.DRAG_START, x, y); out += Ev(Kind.DRAG_MOVE, x, y)
        }
        return out
    }

    /** call every frame while a finger is down: fires LONG_PRESS once */
    fun tick(t: Long): List<Ev> {
        if (!down || dragging || longFired || moved || strokes > 0) return emptyList()
        if (t - t0 >= longMs) { longFired = true; return listOf(Ev(Kind.LONG_PRESS, lx, ly)) }
        return emptyList()
    }

    fun up(x: Float, y: Float, t: Long): List<Ev> {
        if (!down) return emptyList()
        down = false
        if (dragging) {
            dragging = false
            val first = hist.firstOrNull() ?: floatArrayOf(x, y, t.toFloat())
            val dt = ((t - first[2]) / 1000f).coerceAtLeast(0.016f)
            return listOf(Ev(Kind.DROP, x, y, (x - first[0]) / dt, (y - first[1]) / dt))
        }
        if (strokes > 0 || longFired || moved) return emptyList()
        val isDouble = t - lastTapT < doubleMs && hypot(x - lastTapX, y - lastTapY) < dragDist
        lastTapT = if (isDouble) -10_000L else t; lastTapX = x; lastTapY = y
        return listOf(Ev(if (isDouble) Kind.DOUBLE_TAP else Kind.TAP, x, y))
    }

    fun cancel(): List<Ev> {
        val was = down && dragging
        down = false; dragging = false
        return if (was) listOf(Ev(Kind.DROP)) else listOf(Ev(Kind.CANCEL))
    }
}
