package app.ocshimeji.core.pet

import app.ocshimeji.core.anim.Motion
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * Shimeji-style floating-pet behaviour (pure Kotlin, no Android types → unit-testable on the JVM).
 *
 * Coordinates are screen pixels of the pet window's top-left corner; `size` is the square pet
 * box. The brain decides *where* the pet is, *which surface* it is on and *which animation* to
 * show; the Android layer only draws and feeds touches.
 *
 * Surfaces: the floor (bottom of the usable area), the left/right screen edges (climbing) and the
 * ceiling (hanging). Everything is clamped to [area] so a pet can never leave the screen except
 * for the deliberate half-hidden PEEK at a side edge.
 *
 * It is a *simplified* decision loop that shares data with the game's life AI rather than running
 * it: personality ([Traits]), the last needs/emotion snapshot ([mood]) and the hour of day bias
 * the weights. It never changes needs (the game is the only simulation → no double decay).
 */
class PetBrain(seed: Int = 7) {
    enum class State { IDLE, WALK, RUN, SIT, SLEEP, JUMP, FALL, LAND, CLIMB, WALL, HANG, PEEK, DRAG, THROWN, REACT }
    enum class Surface { FLOOR, LEFT, RIGHT, CEIL, AIR }

    /** personality 0..1 (from the OC's character data) */
    data class Traits(val energy: Float = 0.5f, val social: Float = 0.5f, val curious: Float = 0.5f, val shy: Float = 0.3f, val pace: Float = 0.5f)
    /** last needs/emotion snapshot from the game (0..1; emotion is the game's dominant emotion id) */
    data class Mood(val energy: Float = 0.7f, val play: Float = 0.6f, val hunger: Float = 0.7f, val social: Float = 0.6f, val emotion: String = "neutral")
    /** which autonomous behaviours the player allows; level 0 = calm, 1 = normal, 2 = lively, -1 = stays put */
    data class Allow(val level: Int = 1, val climb: Boolean = true, val ceiling: Boolean = true, val peek: Boolean = true, val run: Boolean = true, val jump: Boolean = true)

    var traits = Traits()
    var mood = Mood()
    var allow = Allow()
    /** local hour 0..23 (set by the host once a minute) */
    var hour = 12

    var x = 0f; private set
    var y = 0f; private set
    var state = State.IDLE; private set
    var surface = Surface.FLOOR; private set
    /** -1 = facing left, 1 = facing right */
    var facing = 1f; private set
    /** pendulum angle while dragged (radians) */
    var swing = 0f; private set
    /** vertical squash (1 = none) */
    var squash = 1f; private set
    /** animation key (game action name) — see [ANIMS] */
    var anim = "idle"; private set
    /** seconds since [anim] started */
    var animTime = 0f; private set
    /** body rotation for generic sprites on walls/ceiling (degrees; 0 on the floor) */
    val rotation: Float get() = when (surface) { Surface.LEFT -> 90f; Surface.RIGHT -> -90f; Surface.CEIL -> 180f; else -> 0f }

    val isDragging get() = state == State.DRAG
    /** resting states let the host lower its frame rate */
    val isResting get() = state == State.SLEEP || state == State.SIT || state == State.IDLE || state == State.WALL || state == State.PEEK
    val onFloor get() = surface == Surface.FLOOR && state != State.DRAG
    val size get() = sz

    private val rnd = Random(seed)
    private var left = 0f; private var top = 0f; private var right = 1080f; private var bottom = 1920f
    private var sz = 288f
    private var vx = 0f; private var vy = 0f
    private var stateT = 0f; private var stateLen = 3f
    private var swingVel = 0f
    private var lastDragX = Float.NaN
    private var goalY = 0f
    private var reactAnim = "happy"
    private var reactNext: State = State.IDLE
    /** target x on the floor the pet is walking to (NaN = wander) */
    private var walkTo = Float.NaN
    private var peekSide = 0

    val floorY get() = bottom - sz
    val minX get() = left
    val maxX get() = right - sz

    /** usable screen area (status / navigation bars excluded by the host) and pet box size */
    fun reset(screenW: Int, screenH: Int, sizePx: Int, startX: Float = screenW * 0.6f, topInset: Int = 0, bottomInset: Int = 0) {
        sz = sizePx.toFloat(); left = 0f; right = screenW.toFloat(); top = topInset.toFloat(); bottom = (screenH - bottomInset).toFloat()
        x = startX.coerceIn(minX, max(minX, maxX)); y = floorY; surface = Surface.FLOOR
        set(State.IDLE)
    }

    /** rotation / resize / bars changed: keep the pet on screen and let it fall to the new floor */
    fun resize(screenW: Int, screenH: Int, topInset: Int = top.toInt(), bottomInset: Int = 0, sizePx: Int = sz.toInt()) {
        sz = sizePx.toFloat(); right = screenW.toFloat(); top = topInset.toFloat(); bottom = (screenH - bottomInset).toFloat()
        x = x.coerceIn(minX, max(minX, maxX)); y = y.coerceIn(top, floorY)
        if (state != State.DRAG) { vx = 0f; vy = 0f; surface = Surface.AIR; set(State.FALL) }
    }

    // ------------------------------------------------------------------ control
    private fun set(s: State, len: Float = -1f) {
        state = s; stateT = 0f
        stateLen = if (len > 0) len else when (s) {
            State.WALK -> 3f + rnd.nextFloat() * 5f
            State.RUN -> 1.5f + rnd.nextFloat() * 2f
            State.IDLE -> 2f + rnd.nextFloat() * 3f
            State.SIT -> 6f + rnd.nextFloat() * 8f
            State.SLEEP -> 25f + rnd.nextFloat() * 35f
            State.LAND -> 0.45f
            State.WALL -> 2f + rnd.nextFloat() * 3f
            State.HANG -> 3f + rnd.nextFloat() * 4f
            State.PEEK -> 3f + rnd.nextFloat() * 4f
            State.CLIMB -> 8f
            else -> Float.MAX_VALUE
        }
    }

    fun drag(nx: Float, ny: Float) {
        if (state != State.DRAG) { set(State.DRAG); lastDragX = nx; surface = Surface.AIR }
        val dx = nx - lastDragX
        lastDragX = nx
        swingVel += -dx * 0.0025f
        if (abs(dx) > 0.5f) facing = if (dx > 0) 1f else -1f
        x = nx.coerceIn(minX - sz * 0.3f, maxX + sz * 0.3f)
        y = ny.coerceIn(top - sz * 0.2f, floorY)
    }

    /** let go: [fvx]/[fvy] = finger velocity (px/s) → a gentle throw (capped) */
    fun release(fvx: Float = 0f, fvy: Float = 0f) {
        lastDragX = Float.NaN
        val cap = sz * 9f
        vx = fvx.coerceIn(-cap, cap) * 0.6f; vy = fvy.coerceIn(-cap, cap) * 0.6f
        surface = Surface.AIR
        set(if (abs(vx) + abs(vy) > sz * 1.5f) State.THROWN else State.FALL)
    }

    /** a one-shot reaction (tap, petting, eating, talking …) that returns to a sensible state after [dur] seconds */
    fun react(anim: String, dur: Float = 1f) {
        if (state == State.DRAG || state == State.FALL || state == State.THROWN || state == State.JUMP) return
        reactAnim = anim
        reactNext = when (surface) { Surface.FLOOR -> if (state == State.SLEEP || state == State.SIT) State.SIT else State.IDLE; Surface.CEIL -> State.HANG; Surface.LEFT, Surface.RIGHT -> State.WALL; Surface.AIR -> State.FALL }
        set(State.REACT, dur)
    }

    /** tap: hop / wake up */
    fun poke() = react(if (state == State.SLEEP) "surprised" else "happy", 0.9f)

    /** walk (or run) to a floor x (social approach, "come here") */
    fun goTo(fx: Float, run: Boolean = false) {
        if (!onFloor || state == State.REACT) return
        walkTo = fx.coerceIn(minX, maxX); facing = if (walkTo > x) 1f else -1f
        set(if (run && allow.run) State.RUN else State.WALK, 12f)
    }

    /** face a point (used by pet-to-pet interactions) */
    fun face(px: Float) { facing = if (px > x) 1f else -1f }

    /** hop in place or toward a side */
    fun jump(dir: Float = 0f, height: Float = sz * 1.2f) {
        if (!onFloor) return
        vy = -sqrt(2f * g() * height); vx = dir * sz * 1.4f; if (dir != 0f) facing = dir
        surface = Surface.AIR; set(State.JUMP)
    }

    /** stop autonomous moves (paused pet): sit down where it is */
    fun settle() { if (onFloor && state != State.REACT) set(State.SIT, 3600f) }

    private fun g() = sz * 9f

    // ------------------------------------------------------------------ update
    fun update(dt: Float) {
        stateT += dt; animTime += dt
        swingVel += (-swing * 60f - swingVel * 6f) * dt
        swing = (swing + swingVel * dt).coerceIn(-0.7f, 0.7f)
        squash = 1f
        val speed = sz * (0.35f + traits.pace * 0.3f)
        when (state) {
            State.IDLE, State.SIT, State.SLEEP -> if (stateT > stateLen) decide()
            State.WALK, State.RUN -> {
                val v = if (state == State.RUN) speed * 2.4f else speed
                x += facing * v * dt
                if (!walkTo.isNaN() && ((facing > 0 && x >= walkTo) || (facing < 0 && x <= walkTo))) { x = walkTo; walkTo = Float.NaN; set(State.IDLE) }
                else if (x <= minX || x >= maxX) {
                    x = x.coerceIn(minX, maxX); walkTo = Float.NaN
                    val side = if (x <= minX) -1 else 1
                    when {
                        allow.climb && allow.level >= 1 && rnd.nextFloat() < 0.25f + traits.curious * 0.3f -> startClimb(side)
                        allow.peek && allow.level >= 1 && rnd.nextFloat() < 0.2f + traits.shy * 0.4f -> { peekSide = side; set(State.PEEK) }
                        else -> facing = -facing
                    }
                } else if (stateT > stateLen) { walkTo = Float.NaN; set(State.IDLE) }
            }
            State.PEEK -> {
                // slide half out of the screen, wait, come back
                val out = if (peekSide < 0) minX - sz * 0.45f else maxX + sz * 0.45f
                val home = if (peekSide < 0) minX + sz * 0.1f else maxX - sz * 0.1f
                facing = if (peekSide < 0) -1f else 1f
                x = if (stateT < stateLen) approach(x, out, speed * 0.6f * dt) else approach(x, home, speed * 0.8f * dt)
                if (stateT > stateLen && abs(x - home) < 1f) { facing = -facing; set(State.WALK) }
            }
            State.CLIMB -> {
                y -= speed * 0.6f * dt * (if (goalY < y) 1f else -1f)
                val reached = abs(y - goalY) < speed * 0.6f * dt + 1f
                if (y <= top) {
                    y = top
                    if (allow.ceiling && rnd.nextFloat() < 0.5f + traits.curious * 0.3f) { surface = Surface.CEIL; x = x.coerceIn(minX, maxX); facing = if (x < (minX + maxX) / 2) 1f else -1f; set(State.HANG) }
                    else set(State.WALL)
                } else if (reached || y >= floorY) {
                    if (y >= floorY) { y = floorY; surface = Surface.FLOOR; set(State.IDLE) } else set(State.WALL)
                }
            }
            State.WALL -> if (stateT > stateLen) {
                val r = rnd.nextFloat()
                when {
                    r < 0.4f -> { goalY = top + rnd.nextFloat() * (floorY - top) * 0.6f; set(State.CLIMB) }
                    r < 0.7f -> { goalY = floorY; set(State.CLIMB) }
                    else -> letGo()
                }
            }
            State.HANG -> {
                x += facing * speed * 0.5f * dt
                if (x <= minX || x >= maxX) { x = x.coerceIn(minX, maxX); facing = -facing }
                if (stateT > stateLen) letGo()
            }
            State.JUMP, State.FALL, State.THROWN -> ballistic(dt)
            State.LAND -> { squash = 1f - Motion.wobble(stateT, 2.4f, 5f) * 0.18f; if (stateT > stateLen) set(if (rnd.nextFloat() < 0.5f) State.IDLE else State.SIT) }
            State.REACT -> {
                if (reactAnim == "happy" || reactAnim == "surprised" || reactAnim == "jump") squash = 1f + Motion.wobble(stateT, 3f, 5f) * 0.12f
                if (stateT > stateLen) set(reactNext)
            }
            State.DRAG -> Unit
        }
        val next = animFor()
        if (next != anim) { anim = next; animTime = 0f }
    }

    private fun approach(v: Float, to: Float, step: Float) = if (abs(to - v) <= step) to else v + step * (if (to > v) 1f else -1f)

    private fun startClimb(side: Int) {
        surface = if (side < 0) Surface.LEFT else Surface.RIGHT
        x = if (side < 0) minX else maxX
        // curious pets go all the way up (→ ceiling), others stop somewhere on the wall
        goalY = if (allow.ceiling && rnd.nextFloat() < 0.3f + traits.curious * 0.4f) top - sz else top + rnd.nextFloat() * (floorY - top) * 0.7f
        set(State.CLIMB)
    }

    private fun letGo() { vx = 0f; vy = 0f; surface = Surface.AIR; if (x <= minX) x = minX + 1f; if (x >= maxX) x = maxX - 1f; set(State.FALL) }

    private fun ballistic(dt: Float) {
        vy += g() * dt; x += vx * dt; y += vy * dt
        if (vx != 0f) facing = if (vx > 0) 1f else -1f
        if (x < minX || x > maxX) {
            x = x.coerceIn(minX, maxX)
            val side = if (x <= minX) -1 else 1
            // a strong throw into a wall: grab it (if climbing is allowed), else bounce softly
            if (state == State.THROWN && allow.climb && abs(vx) > sz * 2f && y < floorY - sz * 0.5f) { vx = 0f; vy = 0f; startClimb(side); goalY = y; set(State.WALL); return }
            vx = -vx * 0.35f
        }
        if (y < top) { y = top; vy = abs(vy) * 0.3f }
        if (y >= floorY) {
            y = floorY; vy = 0f; vx = 0f; surface = Surface.FLOOR
            set(State.LAND)
        }
    }

    /** autonomous choice on the floor — weights from personality, needs snapshot, hour and autonomy */
    /** 11.0: a little moment on its own, chosen by mood, time of day and character (the game exports a frame set for each) */
    private fun fidget(night: Boolean, tired: Float): String {
        fun pick(vararg a: String) = a[rnd.nextInt(a.size)]
        return when {
            night && tired > 0.8f -> pick("yawn", "yawn", "sigh")
            mood.emotion in SAD -> pick("sad", "sigh", "sad")
            mood.emotion == "surprised" -> pick("aha", "surprised")
            mood.emotion in HAPPY && traits.energy > 0.55f -> pick("cheer", "giggle", "wiggle", "spin", "clap", "wave")
            mood.emotion in HAPPY -> pick("giggle", "wave", "happy", "clap")
            traits.shy > 0.6f -> pick("shy", "shy", "bow", "sigh")
            traits.curious > 0.6f && rnd.nextFloat() < 0.5f -> pick("aha", "wave")
            rnd.nextFloat() < 0.08f -> pick("sneeze", "hiccup")
            else -> pick("greet", "wave", "bow", "wiggle")
        }
    }

    private fun decide() {
        if (allow.level < 0) { set(State.SIT, 30f); return }
        val night = hour >= 23 || hour < 7
        val tired = (1f - mood.energy) + if (night) 0.6f else 0f
        val lively = (traits.energy * 0.6f + mood.play * 0.2f + (if (mood.emotion in HAPPY) 0.3f else 0f)) * (0.6f + allow.level * 0.3f)
        val w = linkedMapOf(
            State.WALK to 1.2f + lively,
            State.RUN to if (allow.run && allow.level >= 1) lively * 0.5f else 0f,
            State.IDLE to 0.8f,
            State.SIT to 0.6f + tired * 0.8f + traits.shy * 0.3f,
            State.SLEEP to if (state == State.SIT || night) tired * 1.4f else tired * 0.2f,
            State.JUMP to if (allow.jump && allow.level >= 1) lively * 0.35f else 0f,
            State.CLIMB to if (allow.climb && allow.level >= 1) (traits.curious * 0.4f + lively * 0.2f) else 0f,
            State.PEEK to if (allow.peek && allow.level >= 1) traits.shy * 0.35f + traits.curious * 0.15f else 0f,
            // 8.0: little moments on its own — a wave at you, a yawn at night, a happy cheer, a shy fidget
            State.REACT to 0.25f + traits.social * 0.25f,
        )
        if (allow.level == 0) { w[State.RUN] = 0f; w[State.JUMP] = 0f; w[State.CLIMB] = 0f; w[State.WALK] = (w[State.WALK] ?: 0f) * 0.5f }
        if (state == State.SLEEP && !night) w[State.SLEEP] = 0.1f
        val total = w.values.sum(); var r = rnd.nextFloat() * total; var pick = State.IDLE
        for ((k, v) in w) { r -= v; if (r <= 0f) { pick = k; break } }
        when (pick) {
            State.WALK, State.RUN -> { walkTo = Float.NaN; facing = if (rnd.nextBoolean()) 1f else -1f; set(pick) }
            State.JUMP -> jump(if (rnd.nextBoolean()) 0f else facing)
            State.CLIMB -> { facing = if (x < (minX + maxX) / 2) -1f else 1f; walkTo = if (facing < 0) minX else maxX; set(State.WALK, 30f) }  // walk to the nearest edge; the edge decides climb/peek/turn
            State.PEEK -> { facing = if (x < (minX + maxX) / 2) -1f else 1f; walkTo = Float.NaN; set(State.WALK, 30f) }
            State.REACT -> react(fidget(night, tired), 1.6f)
            else -> set(pick)
        }
    }

    private fun animFor(): String = when (state) {
        State.IDLE -> if (mood.emotion in SAD) "sad" else "idle"
        State.WALK -> "walk"
        State.RUN -> "run"
        State.SIT -> "sit"
        State.SLEEP -> "sleep"
        State.JUMP -> "jump"
        State.FALL, State.THROWN -> "fall"
        State.LAND -> "jump"
        State.CLIMB, State.WALL -> "climb"
        State.HANG -> "hang"
        State.PEEK -> "peek"
        State.DRAG -> "drag"
        State.REACT -> reactAnim
    }

    /** frame index for an animation with [count] frames at [fps] (simple sets without per-frame timing) */
    fun frame(count: Int, fps: Float): Int = if (count <= 1) 0 else ((animTime * fps).toInt() % count)

    /** debug / persistence */
    fun place(nx: Float, ny: Float) { x = nx.coerceIn(minX, max(minX, maxX)); y = min(ny, floorY); if (y < floorY) { surface = Surface.AIR; set(State.FALL) } }

    companion object {
        /** every animation key the brain can request (game action names; the game exports a frame set for each) */
        val ANIMS = listOf("idle", "walk", "run", "sit", "sleep", "jump", "fall", "climb", "hang", "peek", "drag", "happy", "pet", "eat", "surprised", "talk", "greet", "sad", "yawn", "shy", "cheer",
            // 11.0: richer little moments (the game exports these from its action library)
            "wave", "clap", "giggle", "sigh", "sneeze", "hiccup", "aha", "bow", "spin", "wiggle",
            // 12.0: paired actions between two desktop pets (one side hugs, the other is hugged …) — see PetSocial.KINDS
            "hug", "hugme", "highfive", "comfort", "comforted", "feedbite", "bitefed", "sidebyside", "chase", "argue", "upset", "apologize", "accept", "turnaway", "listen")
        private val HAPPY = setOf("happy", "excited", "calm", "proud", "content", "love")
        private val SAD = setOf("lonely", "down", "sad")
    }
}
