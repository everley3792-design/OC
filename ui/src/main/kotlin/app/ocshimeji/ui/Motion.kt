package app.ocshimeji.ui

/** a damped spring (critically damped by default) — every UI movement uses this, so things settle the same way everywhere */
class Spring(var value: Float = 0f, var target: Float = value, private val stiffness: Float = 220f, private val damping: Float = 26f) {
    var velocity = 0f
    fun step(dt: Float): Float {
        var t = dt.coerceIn(0f, 0.05f)
        while (t > 0f) { val h = minOf(t, 1f / 120f); val f = -stiffness * (value - target) - damping * velocity; velocity += f * h; value += velocity * h; t -= h }
        return value
    }
    val settled: Boolean get() = kotlin.math.abs(value - target) < 0.001f && kotlin.math.abs(velocity) < 0.01f
    fun snap(v: Float) { value = v; target = v; velocity = 0f }
}

/** easing helpers */
object Ease {
    fun outBack(t: Float): Float { val c = 1.70158f; val x = t.coerceIn(0f, 1f) - 1; return 1 + (c + 1) * x * x * x + c * x * x }
    fun outCubic(t: Float): Float { val x = 1 - t.coerceIn(0f, 1f); return 1 - x * x * x }
}
