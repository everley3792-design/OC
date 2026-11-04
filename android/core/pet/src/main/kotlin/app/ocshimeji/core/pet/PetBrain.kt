package app.ocshimeji.core.pet

import app.ocshimeji.core.anim.Motion
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

/**
 * Floating-pet behaviour (pure Kotlin, no Android types → unit-testable on the JVM).
 *
 * Coordinates are window pixels of the pet's top-left corner; `size` is the square
 * window size. The brain decides *where* the pet is and *which sprite animation* to
 * show; PetView only draws. All randomness is seeded so behaviour is reproducible.
 */
class PetBrain(seed: Int = 7) {
    enum class State { WALK, IDLE, DRAG, FALL, LAND, SIT, SLEEP, REACT }

    /** Sprite animation names; must match the frame sets exported by the game (PetSprites). */
    enum class Anim(val key: String) { IDLE("idle"), WALK("walk"), DRAG("drag"), SIT("sit"), SLEEP("sleep"), HAPPY("happy") }

    var x = 0f; private set
    var y = 0f; private set
    var state = State.IDLE; private set
    /** -1 = facing left, 1 = facing right (sprite is mirrored for left). */
    var facing = 1f; private set
    /** Pendulum angle while dragged (radians). */
    var swing = 0f; private set
    /** Vertical squash for landing / tap reactions (1 = none). */
    var squash = 1f; private set
    var anim = Anim.IDLE; private set
    var animTime = 0f; private set

    val isDragging get() = state == State.DRAG
    /** Resting states let the host drop to a low frame rate to save battery. */
    val isResting get() = state == State.SLEEP || state == State.SIT || state == State.IDLE

    private val rnd = Random(seed)
    private var w = 1080; private var h = 1920; private var size = 288
    private var vy = 0f
    private var t = 0f; private var stateT = 0f
    private var stateLen = 4f
    private var swingVel = 0f
    private var lastDragX = Float.NaN
    private var floorOverride = Float.NaN

    val floorY get() = if (floorOverride.isNaN()) h - size * 1.05f else floorOverride

    fun reset(screenW: Int, screenH: Int, sizePx: Int, startX: Float = screenW * 0.6f) {
        w = screenW; h = screenH; size = sizePx
        x = startX.coerceIn(0f, (w - size).toFloat()); y = floorY
        set(State.WALK)
    }

    /** Screen rotated / resized: keep the pet on screen. */
    fun resize(screenW: Int, screenH: Int) {
        w = screenW; h = screenH
        x = x.coerceIn(0f, max(0f, (w - size).toFloat())); y = min(y, floorY)
        if (state != State.DRAG) { vy = 0f; set(State.FALL) }
    }

    private fun set(s: State) {
        state = s; stateT = 0f
        stateLen = when (s) {
            State.WALK -> 3f + rnd.nextFloat() * 4f
            State.IDLE -> 2f + rnd.nextFloat() * 3f
            State.SIT -> 6f + rnd.nextFloat() * 6f
            State.SLEEP -> 20f + rnd.nextFloat() * 20f
            State.LAND -> 0.45f
            State.REACT -> 0.9f
            else -> Float.MAX_VALUE
        }
        if (s == State.WALK) facing = if (rnd.nextBoolean()) 1f else -1f
    }

    fun drag(nx: Float, ny: Float) {
        if (state != State.DRAG) { set(State.DRAG); lastDragX = nx }
        val dx = nx - lastDragX
        lastDragX = nx
        swingVel += -dx * 0.0025f // finger acceleration pushes the body the other way
        if (abs(dx) > 0.5f) facing = if (dx > 0) 1f else -1f
        x = nx.coerceIn(-size * 0.3f, w - size * 0.7f)
        y = ny.coerceIn(-size * 0.2f, floorY)
    }

    fun release() { vy = 0f; lastDragX = Float.NaN; set(State.FALL) }

    /** Tap: a small happy hop (or wake up). */
    fun poke() { if (state != State.DRAG && state != State.FALL) set(State.REACT) }

    fun update(dt: Float) {
        t += dt; stateT += dt; animTime += dt
        // pendulum integration (damped spring) — only meaningful while dragged
        swingVel += (-swing * 60f - swingVel * 6f) * dt
        swing = (swing + swingVel * dt).coerceIn(-0.7f, 0.7f)
        squash = 1f
        when (state) {
            State.WALK -> {
                x += facing * size * 0.5f * dt
                if (x < 0f || x > w - size) { facing = -facing; x = x.coerceIn(0f, (w - size).toFloat()) }
                if (stateT > stateLen) set(if (rnd.nextFloat() < 0.35f) State.SIT else State.IDLE)
            }
            State.IDLE -> if (stateT > stateLen) set(if (rnd.nextFloat() < 0.7f) State.WALK else State.SIT)
            State.DRAG -> Unit
            State.FALL -> {
                vy += size * 9f * dt; y += vy * dt
                if (y >= floorY) { y = floorY; vy = 0f; set(State.LAND) }
            }
            State.LAND -> { squash = 1f - Motion.wobble(stateT, 2.4f, 5f) * 0.18f; if (stateT > stateLen) set(State.SIT) }
            State.REACT -> { squash = 1f + Motion.wobble(stateT, 3f, 5f) * 0.12f; if (stateT > stateLen) set(State.IDLE) }
            State.SIT -> if (stateT > stateLen) set(if (rnd.nextFloat() < 0.5f) State.SLEEP else State.WALK)
            State.SLEEP -> if (stateT > stateLen) set(State.WALK)
        }
        val next = when (state) {
            State.WALK -> Anim.WALK
            State.DRAG, State.FALL -> Anim.DRAG
            State.LAND, State.REACT -> Anim.HAPPY
            State.SIT -> Anim.SIT
            State.SLEEP -> Anim.SLEEP
            State.IDLE -> Anim.IDLE
        }
        if (next != anim) { anim = next; animTime = 0f }
    }

    /** Frame index for an animation with [count] frames at [fps]. */
    fun frame(count: Int, fps: Float): Int = if (count <= 1) 0 else ((animTime * fps).toInt() % count)
}
