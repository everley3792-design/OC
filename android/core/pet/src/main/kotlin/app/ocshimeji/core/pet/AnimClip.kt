package app.ocshimeji.core.pet

/**
 * Timing of one exported animation (the player's frame animation or the built-in rig), matching
 * `OC.Anim.frameAt` in the game exactly: per-frame durations, loop / once / ping-pong, repeat
 * count, speed, frame events. Pure → unit-tested against the same sequences as the game.
 */
class AnimClip(
    val durs: IntArray,
    val loop: Loop = Loop.LOOP,
    val repeat: Int = 0,
    val speed: Float = 1f,
    val events: List<Event> = emptyList(),
    val priority: Int = 0,
    val interruptible: Boolean = true,
) {
    enum class Loop { LOOP, ONCE, PINGPONG; companion object { fun of(s: String?) = when (s) { "once" -> ONCE; "pingpong" -> PINGPONG; else -> LOOP } } }
    data class Event(val frame: Int, val type: String, val data: String = "")
    data class At(val i: Int, val done: Boolean)

    val count get() = durs.size
    private fun dur(i: Int) = durs[i].coerceAtLeast(10)
    val total: Int get() { var t = 0; for (i in durs.indices) t += dur(i); return t }

    /** frame at [tSec] seconds since start */
    fun at(tSec: Float): At {
        val n = count; if (n == 0) return At(0, true)
        val T = total.toFloat()
        val ms = (tSec * 1000f * speed).coerceAtLeast(0f)
        var k: Float; val cycle: Int; var rev = false
        if (loop == Loop.PINGPONG && n > 1) {
            val span = T * 2 - dur(0) - dur(n - 1)
            cycle = (ms / span).toInt(); k = ms % span
            if (k >= T) { k -= T; rev = true }
        } else { cycle = (ms / T).toInt(); k = ms % T }
        val finite = loop == Loop.ONCE || repeat > 0
        val cycles = if (loop == Loop.ONCE) 1 else repeat
        if (finite && cycle >= cycles) return At(if (rev) 0 else n - 1, true)
        var i: Int; var acc = 0f
        if (!rev) { i = 0; while (i < n) { acc += dur(i); if (k < acc) break; i++ } }
        else { i = n - 2; while (i > 0) { acc += dur(i); if (k < acc) break; i-- } }
        return At(i.coerceIn(0, n - 1), false)
    }

    /** events crossed when the shown frame changes from [from] to [to] (same rule as the game) */
    fun eventsBetween(from: Int, to: Int): List<Event> {
        if (events.isEmpty() || from == to) return emptyList()
        return events.filter { e -> if (from < to) e.frame in (from + 1)..to else e.frame > from || e.frame <= to }
    }

    /** seconds one full play takes (for one-shot reactions); loops report one cycle */
    fun seconds(): Float = (if (loop == Loop.PINGPONG && count > 1) total * 2 - dur(0) - dur(count - 1) else total).toFloat() / 1000f / speed * (if (repeat > 0) repeat else 1)

    companion object {
        fun uniform(n: Int, fps: Float, loop: Loop = Loop.LOOP) = AnimClip(IntArray(n) { (1000f / fps.coerceAtLeast(0.5f)).toInt() }, loop)
    }
}
