package app.ocshimeji.sim

/**
 * The only source of randomness in the simulation (SplitMix64). Same seed → same numbers on every device, so the same save and
 * the same stretch of time always tell the same story (catch-up after an absence, forecasts, tests).
 * Never use kotlin.random / Math.random / the clock inside the simulation.
 */
class Rng(seed: Long) {
    var state: Long = seed
        private set

    fun nextLong(): Long {
        state += -0x61c8864680b583ebL
        var z = state
        z = (z xor (z ushr 30)) * -0x40a7b892e31b1a47L
        z = (z xor (z ushr 27)) * -0x6b2fb644ecceee15L
        return z xor (z ushr 31)
    }
    /** 0 ≤ x < 1 */
    fun nextDouble(): Double = (nextLong() ushr 11) * (1.0 / (1L shl 53))
    fun nextFloat(): Float = nextDouble().toFloat()
    /** 0 ≤ x < bound */
    fun nextInt(bound: Int): Int { require(bound > 0); return (nextDouble() * bound).toInt().coerceAtMost(bound - 1) }
    fun chance(p: Double): Boolean = nextDouble() < p
    fun <T> pick(list: List<T>): T = list[nextInt(list.size)]
    /** pick with weights (≤ 0 weights are never picked); null when nothing has weight */
    fun <T> weighted(items: List<T>, weight: (T) -> Double): T? {
        var total = 0.0; for (x in items) total += weight(x).coerceAtLeast(0.0)
        if (total <= 0.0) return null
        var r = nextDouble() * total
        for (x in items) { r -= weight(x).coerceAtLeast(0.0); if (r < 0) return x }
        return items.last { weight(it) > 0 }
    }

    companion object {
        /** a stable seed from text (ids, keys) — FNV-1a 64 */
        fun hash(text: String): Long { var h = -0x340d631b7bdddcdbL; for (ch in text) { h = h xor ch.code.toLong(); h *= 0x100000001b3L }; return h }
        /** a new generator for one named purpose, independent of every other purpose */
        fun of(seed: Long, key: String) = Rng(seed xor hash(key))
    }
}
