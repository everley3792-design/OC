package app.ocshimeji.sim.desk

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.life.Pose
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/** where the pet is standing (plan 2.4: the bottom is the ground, the sides are walls to climb, the top is a ceiling to hang from) */
enum class Side { FLOOR, LEFT, RIGHT, TOP }
enum class DeskState { FALL, IDLE, WALK, RUN, SIT, SLEEP, STRETCH, CLIMB, HANG, PEEK, HELD, THROWN, LAND, ASK, HAPPY, DOZE, HIDDEN }

/** the phone screen in dp; `top` / `bottom` = status bar and gesture / navigation bar (the ground is above the bottom one) */
class DeskScreen(var w: Float, var h: Float, var top: Float = 24f, var bottom: Float = 48f) { val ground get() = h - bottom }

/** what the pet knows about the world this frame: the resident's needs (from the one simulation), the phone, the hour */
data class DeskContext(
    val hour: Double = 12.0, val charging: Boolean = false, val battery: Int = 80, val fullscreen: Boolean = false,
    val food: Float = 70f, val energy: Float = 70f, val attention: Float = 70f, val active: Float = 0f,
    val reminderDue: Boolean = false, val live: String? = null, val asleepAtHome: Boolean = false,
)

/** something for the host to do: a line to say (by key, through the character's speech), a sound, a touch result for the simulation */
data class DeskEvent(val kind: String, val text: String = "", val value: Float = 0f)

/**
 * One pet on the phone's desktop (plan 2.4, F-01, F-09, F-14, 13.6). Pure: positions in dp, time in seconds, randomness from its
 * own `Rng`. The host (an Android service) only moves a small window to `bounds()` and draws `pose` rotated by `rotation`.
 * Needs come from the shared life simulation through `DeskContext`; what the pet does to the person goes back as events.
 *
 * Never stuck (the old version's lesson): every state has an end; HELD ends when the finger is gone (the host calls `release`),
 * and a pet that somehow leaves the screen falls back onto the ground.
 */
class DeskPet(val id: String, var height: Float, var aspect: Float, seed: Long) {
    private val rng = Rng(seed)
    var x = 0f; var y = 0f; var vx = 0f; var vy = 0f
    var side = Side.FLOOR; private set
    var state = DeskState.FALL; private set
    var facing = 1
    var t = 0f; private set
    private var len = 1f
    private var target = 0f
    private var climbAfter = false; private var peekAfter = false
    private var remind = false
    private var wasCharging = false; private var lastSay = -99f; private var clock = 0f; private var lastLive = -60f
    private var grabDx = 0f; private var grabDy = 0f
    val events = ArrayList<DeskEvent>()
    val width get() = height * aspect

    fun place(s: DeskScreen, px: Float) { x = px.coerceIn(width / 2, s.w - width / 2); y = s.top + height; vx = 0f; vy = 0f; side = Side.FLOOR; go(DeskState.FALL, 99f) }

    // ---------------- what the host draws ----------------
    val pose: Pose get() = when (state) {
        DeskState.WALK, DeskState.CLIMB, DeskState.HANG -> Pose.WALK; DeskState.RUN -> Pose.WALK; DeskState.SIT -> Pose.SIT; DeskState.SLEEP, DeskState.DOZE -> Pose.LIE
        DeskState.STRETCH, DeskState.HAPPY -> Pose.HAPPY; DeskState.HELD -> Pose.HELD; DeskState.THROWN -> Pose.FLY; DeskState.LAND -> Pose.DIZZY; DeskState.ASK -> Pose.LOOK
        DeskState.PEEK -> Pose.LOOK; else -> Pose.STAND
    }
    /** degrees: 0 standing, 90 on the left wall, −90 on the right wall, 180 hanging from the top */
    val rotation: Float get() = when (side) { Side.FLOOR -> 0f; Side.LEFT -> 90f; Side.RIGHT -> -90f; Side.TOP -> 180f }
    val hidden get() = state == DeskState.HIDDEN
    /** the window rectangle (left, top, width, height) in dp, with a margin */
    fun bounds(margin: Float = 8f): FloatArray {
        val w = width; val h = height
        return when (side) {
            Side.FLOOR -> floatArrayOf(x - w / 2 - margin, y - h - margin, w + margin * 2, h + margin * 2)
            Side.LEFT -> floatArrayOf(x - margin, y - w / 2 - margin, h + margin * 2, w + margin * 2)
            Side.RIGHT -> floatArrayOf(x - h - margin, y - w / 2 - margin, h + margin * 2, w + margin * 2)
            Side.TOP -> floatArrayOf(x - w / 2 - margin, y - margin, w + margin * 2, h + margin * 2)
        }
    }
    /** how often it is worth drawing (plan 2.4 power budget): moving 30, dragged 60, resting 6, asleep 1, hidden 0 */
    val fps: Int get() = when (state) {
        DeskState.HELD -> 60; DeskState.FALL, DeskState.THROWN, DeskState.WALK, DeskState.RUN, DeskState.CLIMB, DeskState.HANG, DeskState.LAND -> 30
        DeskState.SLEEP, DeskState.DOZE -> 1; DeskState.HIDDEN -> 0; else -> 6
    }

    // ---------------- touch (results of DeskGestures) ----------------
    fun grab(px: Float, py: Float) { if (hidden) return; grabDx = x - px; grabDy = y - py; side = Side.FLOOR; go(DeskState.HELD, 999f); events += DeskEvent("lift") }
    fun drag(px: Float, py: Float, s: DeskScreen) { if (state != DeskState.HELD) return; val nx = px + grabDx; if (abs(nx - x) > 1f) facing = if (nx > x) 1 else -1; x = nx.coerceIn(0f, s.w); y = (py + grabDy).coerceIn(s.top + height, s.ground) }
    /** let go: a flick (dp/s) throws it, otherwise it just drops */
    fun release(rvx: Float, rvy: Float) {
        if (state != DeskState.HELD) return
        val sp = hypot(rvx, rvy); val k = min(1f, 2600f / max(sp, 1f)); vx = rvx * k; vy = rvy * k
        if (sp > 600f) { go(DeskState.THROWN, 99f); events += DeskEvent("say", "thrown"); events += DeskEvent("sound", "whoosh") } else go(DeskState.FALL, 99f)
    }
    fun tap() {
        if (hidden) return
        when (state) {
            DeskState.SLEEP, DeskState.DOZE -> { go(DeskState.IDLE, 2f); events += DeskEvent("say", "wake") }
            DeskState.PEEK -> if (remind) { remind = false; events += DeskEvent("ack"); events += DeskEvent("say", "ackReminder"); go(DeskState.IDLE, 2f) }
            DeskState.ASK -> events += DeskEvent("menu")
            else -> { events += DeskEvent("tap"); events += DeskEvent("sound", "pop") }
        }
    }
    fun doubleTap() { if (hidden || state == DeskState.HELD) return; if (side == Side.FLOOR) { vy = -700f; vx = facing * 60f; go(DeskState.FALL, 99f); events += DeskEvent("say", "jump") } else { vx = if (side == Side.LEFT) 120f else if (side == Side.RIGHT) -120f else 0f; vy = 0f; side = Side.FLOOR; go(DeskState.FALL, 99f) } }
    fun rub(sec: Float) { if (!hidden) events += DeskEvent("pet", value = sec) }
    fun rubEnd() { events += DeskEvent("petEnd") }

    private fun go(s: DeskState, l: Float) { state = s; t = 0f; len = l }

    // ---------------- every frame ----------------
    private var lastW = 360f
    fun step(dt0: Float, s: DeskScreen, c: DeskContext) {
        lastW = s.w; val dt = dt0.coerceIn(0f, 0.1f); t += dt; clock += dt
        if (c.fullscreen && state != DeskState.HELD) { if (state != DeskState.HIDDEN) { go(DeskState.HIDDEN, 999f) }; return }
        if (state == DeskState.HIDDEN) { place(s, x); events += DeskEvent("say", "back") }
        if (c.charging && !wasCharging && state !in BUSY) { go(DeskState.HAPPY, 3f); events += DeskEvent("say", "charging"); events += DeskEvent("sound", "chime") }
        wasCharging = c.charging
        if (c.reminderDue && !remind && state !in BUSY) { remind = true; peekAfter = true; walkTo(if (x < s.w / 2) width * 0.2f else s.w - width * 0.2f, run = false) }
        when (state) {
            DeskState.FALL -> fall(dt, s)
            DeskState.THROWN -> thrown(dt, s)
            DeskState.HELD -> {}
            DeskState.WALK, DeskState.RUN -> walk(dt, s)
            DeskState.CLIMB -> climb(dt, s)
            DeskState.HANG -> hang(dt, s)
            DeskState.PEEK -> { x = if (x < s.w / 2) -width * 0.18f else s.w + width * 0.18f; if (!remind && t > len) { x = x.coerceIn(width / 2, s.w - width / 2); next(s, c) }; if (remind && t > 25f) { remind = false; go(DeskState.IDLE, 1f) } }
            DeskState.SLEEP -> if (t > len || c.energy > 92f) { go(DeskState.STRETCH, 2f); events += DeskEvent("say", "wake") }
            else -> if (t > len) next(s, c)
        }
        if (state == DeskState.SLEEP || state == DeskState.DOZE) events += DeskEvent("rest", value = dt)
        keepOnScreen(s)
        if (c.live != null && clock - lastLive > 120f && state in CALM) { lastLive = clock; events += DeskEvent("live", c.live) }
    }
    private fun keepOnScreen(s: DeskScreen) {
        if (x.isNaN() || y.isNaN()) { x = s.w / 2; y = s.top + height; vx = 0f; vy = 0f; side = Side.FLOOR; go(DeskState.FALL, 99f) }
        if (state != DeskState.PEEK && state != DeskState.HELD && side == Side.FLOOR) x = x.coerceIn(width / 2, s.w - width / 2)
        if (y > s.ground + 1f && side == Side.FLOOR) y = s.ground
        if (side == Side.FLOOR && y < s.top + height) { y = s.top + height; if (vy < 0) vy = 0f }
    }
    /** choose what to do next (needs, the hour, the phone, a bit of personality and chance) */
    private fun next(s: DeskScreen, c: DeskContext) {
        val night = c.hour >= 23 || c.hour < 5
        if (side != Side.FLOOR) { side = Side.FLOOR; go(DeskState.FALL, 99f); return }
        if (c.food < 30f && clock - lastSay > 30f) { lastSay = clock; go(DeskState.ASK, 8f); events += DeskEvent("say", "hungry"); events += DeskEvent("ask", "food"); return }
        if (c.attention < 25f && clock - lastSay > 40f) { lastSay = clock; go(DeskState.ASK, 6f); events += DeskEvent("say", "lonely"); return }
        if (!c.charging && c.battery in 0..15) { go(DeskState.DOZE, 30f); if (clock - lastSay > 60f) { lastSay = clock; events += DeskEvent("say", "lowBattery") }; return }
        if (c.energy < 25f || (night && rng.chance(0.35))) { go(DeskState.SLEEP, 40f + rng.nextFloat() * 80f); if (night && clock - lastSay > 90f) { lastSay = clock; events += DeskEvent("say", "night") }; return }
        val r = rng.nextFloat() * 10f; val active = (c.active + 1f) / 2f
        when {
            r < 3f -> walkTo(width / 2 + rng.nextFloat() * (s.w - width), run = false)
            r < 3f + 1.5f * active -> walkTo(width / 2 + rng.nextFloat() * (s.w - width), run = true)
            r < 6.2f -> go(DeskState.SIT, 4f + rng.nextFloat() * 8f)
            r < 7f -> go(DeskState.STRETCH, 2f)
            r < 8.2f -> { climbAfter = true; walkTo(if (rng.chance(0.5)) width / 2 else s.w - width / 2, run = false) }
            r < 9f -> { peekAfter = true; walkTo(if (x < s.w / 2) width / 2 else s.w - width / 2, run = false) }
            else -> go(DeskState.IDLE, 2f + rng.nextFloat() * 4f)
        }
    }
    private fun walkTo(tx: Float, run: Boolean) { target = tx.coerceIn(width / 2, max(width / 2, lastW - width / 2)); facing = if (tx >= x) 1 else -1; go(if (run) DeskState.RUN else DeskState.WALK, 30f) }
    private fun walk(dt: Float, s: DeskScreen) {
        val sp = if (state == DeskState.RUN) RUN else WALK; val d = target - x
        if (abs(d) <= sp * dt || t > len) {
            x = target.coerceIn(width / 2, s.w - width / 2)
            when {
                climbAfter -> { climbAfter = false; val left = x < s.w / 2; side = if (left) Side.LEFT else Side.RIGHT; x = if (left) 0f else s.w; y = s.ground - width / 2; go(DeskState.CLIMB, 8f + rng.nextFloat() * 16f) }
                peekAfter -> { peekAfter = false; go(DeskState.PEEK, 3f + rng.nextFloat() * 3f) }
                else -> go(DeskState.IDLE, 1f + rng.nextFloat() * 3f)
            }
            return
        }
        facing = if (d > 0) 1 else -1; x += facing * sp * dt
    }
    private fun climb(dt: Float, s: DeskScreen) {
        y -= CLIMB * dt
        if (y - width / 2 <= s.top) { side = Side.TOP; x = if (x < s.w / 2) width / 2 + 4f else s.w - width / 2 - 4f; y = s.top; facing = if (x < s.w / 2) 1 else -1; go(DeskState.HANG, 5f + rng.nextFloat() * 8f); return }
        if (t > len) { side = Side.FLOOR; vx = if (x < s.w / 2) 80f else -80f; vy = 0f; x = if (x < s.w / 2) width / 2 else s.w - width / 2; go(DeskState.FALL, 99f); events += DeskEvent("say", "letGo") }
    }
    private fun hang(dt: Float, s: DeskScreen) {
        x += facing * HANG * dt; if (x < width / 2 || x > s.w - width / 2) { facing = -facing; x = x.coerceIn(width / 2, s.w - width / 2) }
        if (t > len) { side = Side.FLOOR; y = s.top + height; vx = 0f; vy = 0f; go(DeskState.FALL, 99f); events += DeskEvent("say", "letGo") }
    }
    private fun fall(dt: Float, s: DeskScreen) {
        side = Side.FLOOR; vy += G * dt; x += vx * dt; y += vy * dt; vx *= 0.995f
        if (x < width / 2) { x = width / 2; vx = abs(vx) * 0.5f }; if (x > s.w - width / 2) { x = s.w - width / 2; vx = -abs(vx) * 0.5f }
        if (y >= s.ground) { y = s.ground; val hard = vy > 1500f; vy = 0f; vx = 0f; events += DeskEvent("sound", "land")
            if (hard) { go(DeskState.LAND, 2f); events += DeskEvent("land", value = 1f) } else go(DeskState.IDLE, 1f + rng.nextFloat() * 2f) }
    }
    private fun thrown(dt: Float, s: DeskScreen) {
        side = Side.FLOOR; vy += G * dt; x += vx * dt; y += vy * dt
        if (x < width / 2) { x = width / 2; vx = abs(vx) * 0.5f; events += DeskEvent("sound", "bounce") }
        if (x > s.w - width / 2) { x = s.w - width / 2; vx = -abs(vx) * 0.5f; events += DeskEvent("sound", "bounce") }
        if (y < s.top + height) { y = s.top + height; vy = abs(vy) * 0.4f }
        if (y >= s.ground) { y = s.ground
            if (vy > 900f) { vy = -vy * 0.35f; vx *= 0.6f; events += DeskEvent("sound", "bounce") }
            else { vy = 0f; vx = 0f; go(DeskState.LAND, 2.2f); events += DeskEvent("sound", "land"); events += DeskEvent("land", value = 1f) } }
    }

    companion object {
        const val G = 2400f; const val WALK = 45f; const val RUN = 120f; const val CLIMB = 60f; const val HANG = 26f
        private val BUSY = setOf(DeskState.HELD, DeskState.THROWN, DeskState.FALL, DeskState.HIDDEN, DeskState.CLIMB, DeskState.HANG)
        private val CALM = setOf(DeskState.IDLE, DeskState.SIT, DeskState.WALK)
    }
}

/**
 * Finger → gesture (plan F-02), the same rules on every phone and testable: a tap, a double tap, a long press (the menu), a rub
 * (back and forth over the pet = petting), a drag (pick up) and the release speed (a flick = a throw). Times in seconds, dp.
 */
class DeskGestures {
    sealed class G { object Tap : G(); object DoubleTap : G(); object LongPress : G(); class Rub(val sec: Float) : G(); object RubEnd : G()
        class DragStart(val x: Float, val y: Float) : G(); class Drag(val x: Float, val y: Float) : G(); class Release(val vx: Float, val vy: Float) : G() }
    private enum class Mode { NONE, MAYBE, RUB, DRAG, LONG }
    private var mode = Mode.NONE; private var t0 = 0f; private var x0 = 0f; private var y0 = 0f
    private var lastT = 0f; private var lastX = 0f; private var lastY = 0f; private var dirX = 0; private var dirY = 0; private var turns = 0; private var maxD = 0f
    private val samples = ArrayList<FloatArray>(); private var lastTap = -9f
    val out = ArrayList<G>()
    fun down(t: Float, x: Float, y: Float) { mode = Mode.MAYBE; t0 = t; x0 = x; y0 = y; lastT = t; lastX = x; lastY = y; dirX = 0; dirY = 0; turns = 0; maxD = 0f; samples.clear(); samples += floatArrayOf(t, x, y) }
    /** call every frame: a still finger becomes a long press */
    fun tick(t: Float) { if (mode == Mode.MAYBE && maxD < 10f && t - t0 >= LONG) { mode = Mode.LONG; out += G.LongPress } }
    fun move(t: Float, x: Float, y: Float) {
        if (mode == Mode.NONE || mode == Mode.LONG) return
        val d = hypot(x - x0, y - y0); maxD = max(maxD, d)
        val dx = x - lastX; val dy = y - lastY
        if (abs(dx) > 2f) { val s = if (dx > 0) 1 else -1; if (dirX != 0 && s != dirX) turns++; dirX = s }
        if (abs(dy) > 2f) { val s = if (dy > 0) 1 else -1; if (dirY != 0 && s != dirY) turns++; dirY = s }
        samples += floatArrayOf(t, x, y); while (samples.size > 2 && t - samples[0][0] > 0.1f) samples.removeAt(0)
        when (mode) {
            Mode.MAYBE -> when {
                turns >= 2 && maxD < 60f -> { mode = Mode.RUB; out += G.Rub(t - lastT) }
                d > 28f && turns < 2 -> { mode = Mode.DRAG; out += G.DragStart(x0, y0); out += G.Drag(x, y) }
            }
            Mode.RUB -> out += G.Rub(t - lastT)
            Mode.DRAG -> out += G.Drag(x, y)
            else -> {}
        }
        lastT = t; lastX = x; lastY = y
    }
    fun up(t: Float, x: Float, y: Float) {
        when (mode) {
            Mode.DRAG -> { samples += floatArrayOf(t, x, y); val a = samples.first(); val b = samples.last(); val dt = max(0.016f, b[0] - a[0]); out += G.Release((b[1] - a[1]) / dt, (b[2] - a[2]) / dt) }
            Mode.RUB -> out += G.RubEnd
            Mode.MAYBE -> if (t - t0 < 0.35f && maxD < 10f) { if (t - lastTap < 0.3f) { out += G.DoubleTap; lastTap = -9f } else { out += G.Tap; lastTap = t } }
            else -> {}
        }
        mode = Mode.NONE
    }
    fun cancel() { if (mode == Mode.DRAG) out += G.Release(0f, 0f); if (mode == Mode.RUB) out += G.RubEnd; mode = Mode.NONE }
    companion object { const val LONG = 0.5f }
}
