package app.ocshimeji.overlay

import app.ocshimeji.core.anim.BlinkClock
import app.ocshimeji.core.anim.Motion
import app.ocshimeji.core.anim.RigPose
import kotlin.math.abs
import kotlin.math.sign

/**
 * Floating-pet behaviour (pure logic, no Android types → unit-testable).
 * States mirror the concept video: walk along the bottom edge, picked up & dangling with a
 * pendulum swing, falling with gravity, landing squash, sitting, yawning, sleeping.
 */
class PetBrain {
    enum class State { WALK, IDLE, DRAG, FALL, LAND, SIT, SLEEP }

    var x = 0f; private set
    var y = 0f; private set
    var state = State.IDLE; private set
    var pose = RigPose(); private set
    /** Pendulum angle while dragged (radians), consumed by the renderer. */
    var swing = 0f; private set

    val isDragging get() = state == State.DRAG
    val isResting get() = state == State.SLEEP || state == State.SIT

    private var w = 1080; private var h = 1920; private var size = 288
    private var vx = 0f; private var vy = 0f
    private var t = 0f; private var stateT = 0f
    private var dir = -1f
    private var lastDragX = 0f
    private var swingVel = 0f
    private val blink = BlinkClock(1)

    private val floorY get() = (h - size * 1.15f)

    fun reset(screenW: Int, screenH: Int, sizePx: Int) { w = screenW; h = screenH; size = sizePx; x = w * 0.6f; y = floorY; set(State.WALK) }

    private fun set(s: State) { state = s; stateT = 0f }

    fun drag(nx: Float, ny: Float) {
        if (state != State.DRAG) set(State.DRAG)
        val dx = nx - lastDragX
        lastDragX = nx
        // pendulum: finger acceleration pushes the body the other way, spring brings it back
        swingVel += -dx * 0.0025f
        x = nx.coerceIn(-size * 0.3f, w - size * 0.7f); y = ny.coerceIn(0f, floorY)
    }

    fun release() { vy = 0f; set(State.FALL) }
    fun poke() { if (state != State.DRAG) set(State.LAND) } // reuse the squash reaction

    fun update(dt: Float) {
        t += dt; stateT += dt
        // pendulum integration (damped spring)
        swingVel += (-swing * 60f - swingVel * 6f) * dt
        swing = (swing + swingVel * dt).coerceIn(-0.7f, 0.7f)
        when (state) {
            State.WALK -> {
                x += dir * size * 0.55f * dt
                if (x < 0f || x > w - size) { dir = -dir; x = x.coerceIn(0f, (w - size).toFloat()) }
                if (stateT > 6f) set(State.IDLE)
            }
            State.IDLE -> if (stateT > 3f) { dir = if (Math.random() < 0.5) -1f else 1f; set(if (Math.random() < 0.3) State.SIT else State.WALK) }
            State.DRAG -> Unit
            State.FALL -> { vy += size * 9f * dt; y += vy * dt; if (y >= floorY) { y = floorY; set(State.LAND) } }
            State.LAND -> if (stateT > 0.45f) set(State.SIT)
            State.SIT -> if (stateT > 8f) set(State.SLEEP)
            State.SLEEP -> if (stateT > 30f) set(State.WALK)
        }
        pose = poseFor()
    }

    private fun poseFor(): RigPose {
        val base = RigPose(breath = Motion.breath(t), blink = blink.closedness(t), tail = kotlin.math.sin(t * 2.1f) * 0.16f)
        return when (state) {
            State.WALK -> base.copy(face = dir * 0.85f, walk = 1f, phase = x / (size * 0.28f) * sign(dir).let { abs(it) })
            State.DRAG -> base.copy(eyes = "wide", mouth = "o", brows = "up", walk = 1f, phase = t * 7f, armL = -2.6f, armR = -2.6f)
            State.FALL -> base.copy(eyes = "wide", mouth = "o", armL = -2.6f, armR = -2.6f)
            State.LAND -> base.copy(squash = 1f - Motion.wobble(stateT, 2.4f, 5f) * 0.14f, eyes = "happy", earL = Motion.wobble(stateT, 3f, 4f) * 0.5f, earR = Motion.wobble(stateT - 0.04f, 3f, 4f) * 0.5f)
            State.SIT -> base.copy(eyes = if (stateT in 4f..4.6f) "happy" else "round", mouth = if (stateT in 4f..4.6f) "open" else "cat", blush = 1f)
            State.SLEEP -> base.copy(eyes = "sleepy", mouth = "flat", emote = "zzz")
            State.IDLE -> base
        }
    }
}
