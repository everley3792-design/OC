package app.ocshimeji.core.anim

import kotlinx.serialization.Serializable

/**
 * Rig pose: the shared contract between the life sim, the world renderer, the
 * animation studio and the floating pet. Same fields as the prototype state object.
 * Renderers decide how to *draw* a pose (vector clay / pixel sprite / ink), never what it is.
 */
@Serializable
data class RigPose(
    val face: Float = 0f,        // -1 left … 1 right (3/4 turn by sliding facial features)
    val back: Float = 0f,        // 0 front … 1 rear
    val walk: Float = 0f,        // blend 0..1
    val phase: Float = 0f,       // steps travelled (distance / stride) → feet never slide
    val breath: Float = 0f,
    val blink: Float = 0f,
    val eyes: String = "round",
    val brows: String? = null,
    val mouth: String = "cat",
    val blush: Float = 0f,
    val ear: Float = 0f, val earL: Float = 0f, val earR: Float = 0f,
    val tail: Float = 0f,
    val armL: Float? = null, val armR: Float? = null,
    val squash: Float = 1f,      // y-scale, x = 1/sqrt(squash) (volume preserving)
    val lift: Float = 0f,
    val tilt: Float = 0f,
    val emote: String? = null,
)

/** A frame-by-frame clip authored in the Animation Studio or shipped as a preset. */
@Serializable
data class FrameClip(
    val id: String,
    val fps: Int = 8,
    val loop: Boolean = true,
    /** Each frame references drawn layers (PNG) and/or a rig pose override. */
    val frames: List<ClipFrame>,
) {
    init { require(fps in 1..60) { "fps out of range" }; require(frames.isNotEmpty()) { "empty clip" } }
    val durationSec: Float get() = frames.sumOf { it.hold } / fps.toFloat()

    /** Frame index at time t, honouring per-frame holds (a hold of 2 = "on twos"). */
    fun frameAt(t: Float): Int {
        val total = frames.sumOf { it.hold }
        var tick = (t * fps).toInt()
        tick = if (loop) ((tick % total) + total) % total else tick.coerceIn(0, total - 1)
        var acc = 0
        frames.forEachIndexed { i, f -> acc += f.hold; if (tick < acc) return i }
        return frames.lastIndex
    }
}

@Serializable
data class ClipFrame(val layers: List<String> = emptyList(), val pose: RigPose? = null, val hold: Int = 1)
