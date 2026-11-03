package app.ocshimeji.core.anim

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.sin

/**
 * Motion primitives ported 1:1 from the Phase-1 prototype (prototype/shared/core.js)
 * so the shipped game moves exactly like the approved concept video.
 * All functions are pure: f(time) -> value. No allocation per frame.
 */
object Ease {
    fun inOutCubic(t: Float): Float = if (t < 0.5f) 4 * t * t * t else 1 - (-2 * t + 2).pow(3) / 2
    fun outCubic(t: Float): Float = 1 - (1 - t).pow(3)
    fun inOutSine(t: Float): Float = (-(cos(PI * t) - 1) / 2).toFloat()
    /** Soft overshoot (c1 = 1.2, not the usual 1.70158): "lively, never bouncy". */
    fun outBack(t: Float, c1: Float = 1.2f): Float { val c3 = c1 + 1; return 1 + c3 * (t - 1).pow(3) + c1 * (t - 1).pow(2) }
}

object Motion {
    private const val TAU = (2 * PI).toFloat()

    /** Damped-spring step response 0 -> 1 (pops, settles). */
    fun spring(t: Float, freq: Float = 2.2f, damp: Float = 6f): Float =
        if (t <= 0f) 0f else 1f - exp(-damp * t) * cos(TAU * freq * t)

    /** Damped oscillation: follow-through of ears, tails, scarves after a stop or turn. */
    fun wobble(t: Float, freq: Float = 3f, damp: Float = 5f): Float =
        if (t <= 0f) 0f else exp(-damp * t) * sin(TAU * freq * t)

    /** Breathing -1..1: slow inhale (55%), quicker exhale. */
    fun breath(t: Float, rate: Float = 0.38f, phase: Float = 0f): Float {
        val p = ((t * rate + phase) % 1f + 1f) % 1f
        return if (p < 0.55f) sin((p / 0.55f) * PI.toFloat() / 2) * 2 - 1
        else cos(((p - 0.55f) / 0.45f) * PI.toFloat() / 2) * 2 - 1
    }

    /** Quantize time for stylised timing: 12 = "on twos" (Inkpot), 8 = pixel walk. */
    fun stepped(t: Float, fps: Int): Float = floor(t * fps) / fps
}

/**
 * Natural blink scheduler: irregular 2.2–4.8 s gaps, 18% chance of a double blink,
 * fast close (70 ms) and slower open (150 ms). Deterministic per seed.
 */
class BlinkClock(seed: Int) {
    private var state = seed * 9973 + 1
    private val times = FloatArray(64)

    init {
        var at = 0.6f + rand() * 1.2f
        for (i in times.indices) { times[i] = at; at += if (rand() < 0.18f) 0.32f else 2.2f + rand() * 2.6f }
    }

    private fun rand(): Float { state = state * 1103515245 + 12345; return ((state ushr 8) and 0xFFFF) / 65535f }

    /** 0 = open, 1 = closed. Loops every 64 blinks. */
    fun closedness(t: Float): Float {
        val span = times.last() + 3f
        val tt = t % span
        for (b in times) {
            val d = tt - b
            if (d in 0f..0.22f) return if (d < 0.07f) (d / 0.07f).pow(2) else 1 - Ease.outCubic((d - 0.07f) / 0.15f)
            if (b > tt) break
        }
        return 0f
    }
}
