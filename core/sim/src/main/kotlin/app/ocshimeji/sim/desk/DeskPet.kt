package app.ocshimeji.sim.desk

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.life.Pose
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/** where the pet is standing (plan 2.4: the bottom is the ground, the sides are walls to climb, the top is a ceiling to hang from) */
enum class Side { FLOOR, LEFT, RIGHT, TOP }
enum class DeskState { FALL, IDLE, WALK, RUN, SIT, SLEEP, STRETCH, CLIMB, HANG, PEEK, HELD, THROWN, LAND, ASK, HAPPY, DOZE, HIDDEN, CROUCH, READ, EAT, WATER, GREET, FOLLOW }

/** the phone screen in dp; `top` / `bottom` = status bar and gesture / navigation bar (the ground is above the bottom one) */
class DeskScreen(var w: Float, var h: Float, var top: Float = 24f, var bottom: Float = 48f) { val ground get() = h - bottom }

/** what the pet knows about the world this frame: the resident's needs (from the one simulation), the phone, the hour, the desktop */
data class DeskContext(
    val hour: Double = 12.0, val charging: Boolean = false, val battery: Int = 80, val fullscreen: Boolean = false,
    val food: Float = 70f, val energy: Float = 70f, val attention: Float = 70f, val active: Float = 0f,
    val reminderDue: Boolean = false, val live: String? = null, val asleepAtHome: Boolean = false,
    /** R6: things on the desktop (F-05, F-06), the other pets (F-07), the focus timer: "work" / "break" / null (F-08) */
    val props: List<DeskThing> = emptyList(), val others: List<DeskOther> = emptyList(), val focus: String? = null,
)

/** something for the host to do: a line to say (by key, through the character's speech), a sound, a touch result for the simulation */
data class DeskEvent(val kind: String, val text: String = "", val value: Float = 0f)

/**
 * One pet on the phone's desktop (plan 2.4, B-1). Pure: positions in dp, time in seconds, randomness from its own `Rng`. The host
 * (an Android service) only moves a small window to `bounds()` and draws `pose` rotated by `rotation`.
 *
 * R6: three layers. Every 0.5 s the drives are read and turned into candidate **intents** (`DeskIntents`, each with a level); a
 * candidate only cuts in when its level is above the current one. An intent becomes a **plan**: maybe walk somewhere, then one
 * **action** (`DeskActs`). Actions change only along the table — sitting starts by crouching, a pet on the wall lets go and falls
 * before doing anything else — and every action has an end, so nothing can get stuck (`DeskTest` runs 100 hours).
 */
class DeskPet(val id: String, var height: Float, var aspect: Float, seed: Long) {
    private val rng = Rng(seed)
    var persona = DeskPersona()
    var x = 0f; var y = 0f; var vx = 0f; var vy = 0f
    var side = Side.FLOOR; private set
    var state = DeskState.FALL; private set
    var facing = 1
    var t = 0f; private set
    private var len = 1f
    private var target = 0f; private var moving = false
    private var after: DeskState? = null; private var afterLen = 0f
    private var remind = false
    private var wasCharging = false; private var lastSay = -99f; private var clock = 0f; private var lastLive = -60f
    private var grabDx = 0f; private var grabDy = 0f
    private var thinkT = 0f; private var fsT = 0f
    val events = ArrayList<DeskEvent>()
    val width get() = height * aspect

    // ---- the intent layer
    private class Plan(val intent: String, val level: Int, var tx: Float? = null, val run: Boolean = false, val act: DeskState = DeskState.IDLE, val len: Float = 2f,
                       val prop: String? = null, val partner: String? = null, val together: String? = null, val climb: Boolean = false, val peek: Boolean = false)
    private var plan: Plan? = null
    /** what it wants now (`DeskIntents`) and that intent's level */
    var intent = "fall"; private set
    val level get() = plan?.level ?: DeskIntents[intent].level
    /** tests and the diary: seconds spent per intent, how often each action started, and changes that broke the table (must stay 0) */
    val intentTime = HashMap<String, Float>(); val actCount = HashMap<DeskState, Int>(); var illegal = 0; private set; var rescues = 0; private set
    val illegalSeen = HashSet<String>()
    private val cool = HashMap<String, Float>()
    private fun ready(k: String, sec: Float) = clock - (cool[k] ?: -1e9f) > sec
    private fun used(k: String) { cool[k] = clock }

    fun place(s: DeskScreen, px: Float) { x = px.coerceIn(width / 2, s.w - width / 2); y = s.top + height; vx = 0f; vy = 0f; side = Side.FLOOR; plan = null; intent = "fall"; set(DeskState.FALL, 20f) }

    // ---------------- what the host draws ----------------
    val pose: Pose get() = when {
        (state == DeskState.FOLLOW || state == DeskState.WALK || state == DeskState.RUN) && !moving -> Pose.LOOK
        else -> DeskActs[state].pose
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
    /** how often it is worth drawing (plan 2.4 power budget): from the action table (moving 30, dragged 60, resting 6, asleep 1, hidden 0) */
    val fps: Int get() = if (!moving && state in MOVERS) 12 else DeskActs[state].fps

    // ---------------- the action layer ----------------
    /** change action along the table: a missing first step is taken first (crouch before sitting), anything else lets go and falls */
    private fun enter(s: DeskState, l: Float) {
        if (DeskActs.can(state, s)) { set(s, l); return }
        val h = DeskActs.hop(state, s)
        if (h != null) { set(h, if (h == DeskState.IDLE) 0.3f else DeskActs[h].minT); after = s; afterLen = l; return }
        illegal++; illegalSeen += "route:$state>$s"; set(DeskState.FALL, 20f)
    }
    private fun set(s: DeskState, l: Float) {
        if (s != state && !DeskActs.can(state, s)) { illegal++; illegalSeen += "$state>$s" }
        val a = DeskActs[s]; state = s; t = 0f; len = l.coerceIn(a.minT, a.maxT); moving = false
        actCount[s] = (actCount[s] ?: 0) + 1
        if (s in AIR || s == DeskState.HIDDEN) after = null
    }
    private fun curLevel() = max(plan?.level ?: 0, DeskActs[state].guard)

    // ---------------- touch (results of DeskGestures) ----------------
    fun grab(px: Float, py: Float) { if (hidden) return; grabDx = x - px; grabDy = y - py; side = Side.FLOOR; plan = null; intent = "held"; set(DeskState.HELD, 600f); events += DeskEvent("lift") }
    fun drag(px: Float, py: Float, s: DeskScreen) { if (state != DeskState.HELD) return; val nx = px + grabDx; if (abs(nx - x) > 1f) facing = if (nx > x) 1 else -1; x = nx.coerceIn(0f, s.w); y = (py + grabDy).coerceIn(s.top + height, s.ground) }
    /** let go: a flick (dp/s) throws it, otherwise it just drops */
    fun release(rvx: Float, rvy: Float) {
        if (state != DeskState.HELD) return
        val sp = hypot(rvx, rvy); val k = min(1f, 2600f / max(sp, 1f)); vx = rvx * k; vy = rvy * k; intent = "fall"
        if (sp > 600f) { set(DeskState.THROWN, 20f); events += DeskEvent("say", "thrown"); events += DeskEvent("sound", "whoosh") } else set(DeskState.FALL, 20f)
    }
    fun tap() {
        if (hidden) return
        when (state) {
            DeskState.SLEEP, DeskState.DOZE -> { plan = null; intent = "wake"; enter(DeskState.STRETCH, 2f); events += DeskEvent("say", "wake") }
            DeskState.PEEK -> if (remind) { remind = false; events += DeskEvent("ack"); events += DeskEvent("say", "ackReminder"); plan = null; enter(DeskState.IDLE, 2f) }
            DeskState.ASK -> events += DeskEvent("menu")
            else -> { events += DeskEvent("tap"); events += DeskEvent("sound", "pop")
                if (curLevel() < Lv.YOU && side == Side.FLOOR && state !in AIR) { plan = Plan("wake", Lv.YOU, act = DeskState.HAPPY, len = 1.2f); intent = "wake"; enter(DeskState.HAPPY, 1.2f) } }
        }
    }
    fun doubleTap() { if (hidden || state == DeskState.HELD) return; plan = null; intent = "fall"; if (side == Side.FLOOR) { vy = -700f; vx = facing * 60f; set(DeskState.FALL, 20f); events += DeskEvent("say", "jump") } else { vx = if (side == Side.LEFT) 120f else if (side == Side.RIGHT) -120f else 0f; vy = 0f; side = Side.FLOOR; set(DeskState.FALL, 20f) } }
    fun rub(sec: Float) { if (!hidden) events += DeskEvent("pet", value = sec) }
    fun rubEnd() { events += DeskEvent("petEnd") }

    // ---- F-04: a finger held near it — it comes after the finger
    private var followX: Float? = null; private var following = false
    fun follow(px: Float) {
        if (hidden || state == DeskState.HELD) return
        followX = px; following = true
        if (intent != "follow" && Lv.YOU > curLevel() && state !in AIR) adopt(Plan("follow", Lv.YOU, act = DeskState.FOLLOW, len = 120f))
    }
    fun followEnd() { following = false }

    // ---- F-07: another pet asks this one to do something together; true = it says yes
    fun invited(kind: String, from: String, fromX: Float, s: DeskScreen): Boolean {
        val tg = DeskTogethers.ALL[kind] ?: return false
        val busy = curLevel() > Lv.SELF || (plan?.level ?: 0) >= Lv.SELF
        if (hidden || side != Side.FLOOR || state in AIR || busy) return false
        facing = if (fromX >= x) 1 else -1
        val p = when (kind) {
            "chase" -> Plan("invited", Lv.SELF, tx = if (fromX < x) s.w - width / 2 else width / 2, run = true, act = DeskState.HAPPY, len = 1.5f, partner = from)
            else -> Plan("invited", Lv.SELF, act = tg.theirs, len = tg.len, partner = from)
        }
        adopt(p); return true
    }
    /** the other one said no */
    fun declined() { if (plan?.together != null) { plan = null; intent = "rest"; enter(DeskState.IDLE, 1f) } }

    // ---------------- every frame ----------------
    private var lastW = 360f
    private var lastFocus: String? = null
    fun step(dt0: Float, s: DeskScreen, c: DeskContext) {
        lastW = s.w; val dt = dt0.coerceIn(0f, 0.1f); t += dt; clock += dt; thinkT += dt
        intentTime[intent] = (intentTime[intent] ?: 0f) + dt
        // ---- reflex: a full-screen app (shy characters hide sooner)
        if (c.fullscreen && state != DeskState.HELD) {
            fsT += dt; val delay = 0.8f / persona.hide.coerceAtLeast(0.25f)
            if (state != DeskState.HIDDEN && fsT >= delay) { plan = null; intent = "hide"; set(DeskState.HIDDEN, 1e9f) }
            if (state == DeskState.HIDDEN) return
        } else fsT = 0f
        if (state == DeskState.HIDDEN) { place(s, x); events += DeskEvent("say", "back") }
        if (c.charging && !wasCharging && state !in BUSY && curLevel() < Lv.CARE) { plan = null; intent = "wake"; enter(DeskState.HAPPY, 3f); events += DeskEvent("say", "charging"); events += DeskEvent("sound", "chime") }
        wasCharging = c.charging
        // ---- plans that end because the world changed
        plan?.let { p ->
            if (p.intent == "focus" && c.focus != "work") endPlan()
            else if (p.intent == "lowBattery" && (c.charging || c.battery > 15)) endPlan()
            else if (p.prop != null && c.props.none { it.id == p.prop }) endPlan()
        }
        if (c.focus != lastFocus) { if (lastFocus == "work" && c.focus == "break") cool.remove("break"); lastFocus = c.focus }
        // ---- the action
        when (state) {
            DeskState.FALL -> fall(dt, s)
            DeskState.THROWN -> thrown(dt, s)
            DeskState.HELD -> {}
            DeskState.WALK, DeskState.RUN -> walk(dt, s, c)
            DeskState.FOLLOW -> followStep(dt, s)
            DeskState.CLIMB -> climb(dt, s)
            DeskState.HANG -> hang(dt, s)
            DeskState.PEEK -> { x = if (x < s.w / 2) -width * 0.18f else s.w + width * 0.18f
                if (!remind && t > len) { x = x.coerceIn(width / 2, s.w - width / 2); finish(s, c) }
                if (remind && t > 25f) { remind = false; x = x.coerceIn(width / 2, s.w - width / 2); finish(s, c) } }
            DeskState.SLEEP -> if (t > len || (c.energy > 92f && plan?.together == null && plan?.intent != "invited")) { plan?.let { if (it.intent == "sleep" && it.prop != null) events += DeskEvent("nest", it.prop) }; plan = null; intent = "wake"; enter(DeskState.STRETCH, 2f); events += DeskEvent("say", "wake") }
            DeskState.READ -> if (t > len && plan?.intent == "focus") t = 0f else if (t > len) finish(s, c)
            else -> if (t > len) finish(s, c)
        }
        // ---- the drives, twice a second
        if (thinkT >= 0.5f) { thinkT = 0f; if (state !in FLYING) think(s, c, free = false) }   /* on a wall it still thinks: care makes it let go */
        if (state == DeskState.SLEEP || state == DeskState.DOZE) events += DeskEvent("rest", value = dt)
        keepOnScreen(s); watchdog(s)
        if (c.live != null && clock - lastLive > 120f && state in CALM) { lastLive = clock; events += DeskEvent("live", c.live) }
    }
    private fun endPlan() { plan = null; intent = "rest"; if (state !in AIR) enter(if (state in UP_FROM_REST) DeskState.STRETCH else DeskState.IDLE, 1f) }
    /** an action ran its time: the next step of the plan, or a fresh choice */
    private fun finish(s: DeskScreen, c: DeskContext) {
        after?.let { a -> after = null; enter(a, afterLen); return }
        val p = plan
        if (p != null && state == p.act && t > 0f) { done(p); plan = null }
        else if (p != null && state != p.act && state !in MOVERS && state != DeskState.CROUCH && state !in AIR) { begin(p); if (plan === p) return }
        think(s, c, free = true)
        if (plan == null) { intent = "rest"; enter(DeskState.IDLE, 1f + rng.nextFloat() * 2f) }
    }
    /** what a finished plan leaves behind (for the host: eat the snack, water the plant, the memory of doing it together) */
    private fun done(p: Plan) {
        when (p.intent) {
            "eat" -> p.prop?.let { events += DeskEvent("eat", it) }
            "water" -> p.prop?.let { events += DeskEvent("water", it) }
            "read" -> p.prop?.let { events += DeskEvent("read", it) }
            "focus" -> {}
        }
    }

    // ---------------- the intent layer ----------------
    private class Cand(val intent: String, val level: Int, val score: Float, val make: () -> Plan?)
    private fun think(s: DeskScreen, c: DeskContext, free: Boolean) {
        if (side != Side.FLOOR && free) { side = Side.FLOOR; intent = "fall"; set(DeskState.FALL, 20f); return }
        val cs = candidates(s, c, free).filter { it.score > 0f }
        if (cs.isEmpty()) return
        val top = cs.maxOf { it.level }
        val pool = if (free) (if (top >= Lv.YOU) cs.filter { it.level == top } else cs) else cs.filter { it.level == top && it.intent != intent }
        if (pool.isEmpty()) return
        if (!free) { if (top <= curLevel()) return; if (top == Lv.SELF && !rng.chance(0.08)) return }
        var r = rng.nextFloat() * pool.sumOf { it.score.toDouble() }.toFloat(); var pick = pool.last()
        for (cd in pool) { r -= cd.score; if (r <= 0f) { pick = cd; break } }
        pick.make()?.let { adopt(it) }
    }
    private fun adopt(p: Plan) {
        plan = p; intent = p.intent; after = null
        if (side != Side.FLOOR || state in AIR) { if (state != DeskState.FALL && state != DeskState.THROWN) { side = Side.FLOOR; vx = 0f; vy = 0f; set(DeskState.FALL, 20f); events += DeskEvent("say", "letGo") }; return }
        begin(p)
    }
    private fun begin(p: Plan) {
        val tx = p.tx
        if (p.act == DeskState.FOLLOW) { enter(DeskState.FOLLOW, p.len); return }
        if (tx != null && abs(tx - x) > 3f) { target = tx.coerceIn(width / 2, max(width / 2, lastW - width / 2)); facing = if (target >= x) 1 else -1; enter(if (p.run) DeskState.RUN else DeskState.WALK, 30f); return }
        arrive(p, null)
    }
    private fun arrive(p: Plan, s: DeskScreen?) {
        val w = s?.w ?: lastW
        when {
            (p.climb && !DeskActs.can(state, DeskState.CLIMB)) || (p.peek && !DeskActs.can(state, DeskState.PEEK)) -> enter(DeskState.IDLE, 0.3f)   /* stand up first */
            p.climb -> { val left = x < w / 2; side = if (left) Side.LEFT else Side.RIGHT; x = if (left) 0f else w; y = (s?.ground ?: y) - width / 2; set(DeskState.CLIMB, 8f + rng.nextFloat() * 16f) }
            p.peek -> set(DeskState.PEEK, if (remind) 30f else 3f + rng.nextFloat() * 3f)
            else -> { p.together?.let { events += DeskEvent("together", "$it|${p.partner}") }; enter(p.act, p.len) }
        }
    }
    private fun candidates(s: DeskScreen, c: DeskContext, free: Boolean): List<Cand> {
        val out = ArrayList<Cand>(); val night = c.hour >= 23 || c.hour < 5
        fun thing(gives: String) = c.props.filter { DeskProps[it.kind]?.gives == gives }.minByOrNull { abs(it.x - x) }
        // ---- care (4)
        if (c.focus == "work") out += Cand("focus", Lv.CARE, 1f) { val left = x < s.w / 2; val k = c.others.count { o -> o.id < id && (o.x < s.w / 2) == left } * width * 0.9f   /* side by side, not on top of each other */
            Plan("focus", Lv.CARE, tx = if (left) width * 0.9f + k else s.w - width * 0.9f - k, act = DeskState.READ, len = 1800f).also { if (intent != "focus") events += DeskEvent("say", "focusStart") } }
        if (c.focus == "break" && ready("break", 1e8f)) out += Cand("break", Lv.CARE, 1f) { used("break"); events += DeskEvent("say", "breakTime"); Plan("break", Lv.CARE, act = DeskState.STRETCH, len = 2.5f) }
        if (c.food < 45f) thing("eat")?.let { f -> out += Cand("eat", Lv.CARE, 1f) { Plan("eat", Lv.CARE, tx = f.x, act = DeskState.EAT, len = 4f, prop = f.id) } }
        if (c.food < 30f && thing("eat") == null && ready("askFood", 30f)) out += Cand("askFood", Lv.CARE, 1f) { used("askFood"); events += DeskEvent("say", "hungry"); events += DeskEvent("ask", "food"); Plan("askFood", Lv.CARE, act = DeskState.ASK, len = 8f) }
        if (!c.charging && c.battery in 0..15) out += Cand("lowBattery", Lv.CARE, 1f) { if (ready("lowBattery", 60f)) { used("lowBattery"); events += DeskEvent("say", "lowBattery") }; Plan("lowBattery", Lv.CARE, act = DeskState.DOZE, len = 30f) }
        val sleepy = c.energy < 25f || (night && free && rng.chance(0.35))
        if (sleepy) out += Cand("sleep", Lv.CARE, 1f) {
            if (night && ready("night", 90f)) { used("night"); events += DeskEvent("say", "night") }
            val bed = thing("home") ?: thing("sleep"); Plan("sleep", Lv.CARE, tx = bed?.x, act = DeskState.SLEEP, len = 40f + rng.nextFloat() * 80f, prop = bed?.id) }
        if (c.reminderDue && !remind && state !in BUSY) out += Cand("remind", Lv.CARE, 1f) { remind = true; Plan("remind", Lv.CARE, tx = if (x < s.w / 2) width * 0.2f else s.w - width * 0.2f, peek = true, act = DeskState.PEEK, len = 30f) }
        // ---- you (3): following the finger is started by `follow`
        // ---- its own things (2)
        thing("home")?.let { n -> val k = persona.nest; if (ready("nest", 40f / (k * k))) out += Cand("nest", Lv.SELF, 0.1f * k * k * k) { used("nest"); Plan("nest", Lv.SELF, tx = n.x, act = DeskState.SIT, len = 4f + rng.nextFloat() * 8f * k, prop = n.id) } }
        thing("water")?.let { pl -> if (ready("water", 90f)) out += Cand("water", Lv.SELF, 0.3f) { used("water"); Plan("water", Lv.SELF, tx = pl.x, act = DeskState.WATER, len = 4f, prop = pl.id) } }
        thing("read")?.let { n -> if (ready("read", 60f)) out += Cand("read", Lv.SELF, 0.2f) { used("read"); Plan("read", Lv.SELF, tx = n.x, act = DeskState.READ, len = 8f + rng.nextFloat() * 8f, prop = n.id) } }
        if (ready("social", 30f)) {
            val friends = c.others.filter { it.floor && it.state !in setOf(DeskState.HIDDEN, DeskState.HELD, DeskState.THROWN, DeskState.FALL, DeskState.CLIMB, DeskState.HANG) }
            if (friends.isNotEmpty()) out += Cand("social", Lv.SELF, 0.3f * persona.social) social@{
                used("social"); val f = friends.maxByOrNull { it.like + rng.nextFloat() * 30f }!!
                val ok = DeskTogethers.ALL.values.filter { tg -> f.like >= tg.like && when (tg.id) { "leanSleep" -> night || c.energy < 45f; "chase" -> c.energy > 40f && persona.active > -0.5f; "sitTogether" -> true; else -> true } }
                val tg = ok.lastOrNull { rng.chance(0.55) } ?: ok.firstOrNull() ?: return@social null
                events += DeskEvent("invite", "${tg.id}|${f.id}", x)
                val sd = if (f.x >= x) -1 else 1
                Plan("social", Lv.SELF, tx = (f.x + sd * width * 0.85f), run = tg.id == "chase", act = tg.mine, len = tg.len, partner = f.id, together = tg.id) }
        }
        if (ready("nearYou", 24f / (persona.cling * persona.cling))) out += Cand("nearYou", Lv.SELF, 0.08f * persona.cling * persona.cling * persona.cling) { used("nearYou"); events += DeskEvent("look"); Plan("nearYou", Lv.SELF, tx = s.w / 2 + (rng.nextFloat() - 0.5f) * 60f, act = DeskState.ASK, len = 3f + rng.nextFloat() * 5f * persona.cling) }
        if (c.attention < 25f && ready("lonely", 40f)) out += Cand("lonely", Lv.SELF, 0.8f * persona.cling) { used("lonely"); events += DeskEvent("say", "lonely"); Plan("lonely", Lv.SELF, act = DeskState.ASK, len = 6f) }
        // ---- idling (1): only when it is free to choose
        if (free) {
            val act = (persona.active + 1f) / 2f; val far = width / 2 + rng.nextFloat() * (s.w - width)
            out += Cand("wander", Lv.IDLE, 0.3f) { Plan("wander", Lv.IDLE, tx = far, act = DeskState.IDLE, len = 1f + rng.nextFloat() * 3f) }
            out += Cand("run", Lv.IDLE, 0.15f * act * persona.climb) { Plan("run", Lv.IDLE, tx = width / 2 + rng.nextFloat() * (s.w - width), run = true, act = DeskState.IDLE, len = 1f) }
            out += Cand("sit", Lv.IDLE, 0.32f / persona.climb.coerceAtLeast(0.5f)) { Plan("sit", Lv.IDLE, act = DeskState.SIT, len = 4f + rng.nextFloat() * 8f) }
            out += Cand("stretch", Lv.IDLE, 0.08f) { Plan("stretch", Lv.IDLE, act = DeskState.STRETCH, len = 2f) }
            out += Cand("climb", Lv.IDLE, 0.12f * persona.climb) { Plan("climb", Lv.IDLE, tx = if (rng.chance(0.5)) width / 2 else s.w - width / 2, climb = true, act = DeskState.CLIMB, len = 20f) }
            out += Cand("peek", Lv.IDLE, 0.08f * persona.hide) { Plan("peek", Lv.IDLE, tx = if (x < s.w / 2) width / 2 else s.w - width / 2, peek = true, act = DeskState.PEEK, len = 5f) }
            out += Cand("rest", Lv.IDLE, 0.1f) { Plan("rest", Lv.IDLE, act = DeskState.IDLE, len = 2f + rng.nextFloat() * 4f) }
        }
        return out
    }

    // ---------------- moving ----------------
    private fun keepOnScreen(s: DeskScreen) {
        if (x.isNaN() || y.isNaN()) { x = s.w / 2; y = s.top + height; vx = 0f; vy = 0f; side = Side.FLOOR; plan = null; set(DeskState.FALL, 20f) }
        if (state != DeskState.PEEK && state != DeskState.HELD && side == Side.FLOOR) x = x.coerceIn(width / 2, s.w - width / 2)
        if (y > s.ground + 1f && side == Side.FLOOR) y = s.ground
        if (side == Side.FLOOR && y < s.top + height) { y = s.top + height; if (vy < 0) vy = 0f }
    }
    /** never stuck: an action that ran far past its longest time is ended (counted; the 100-hour test expects none) */
    private fun watchdog(s: DeskScreen) {
        val a = DeskActs[state]
        if (state != DeskState.HELD && state != DeskState.HIDDEN && t > a.maxT + 2f) { rescues++; plan = null; after = null; side = Side.FLOOR; vx = 0f; vy = 0f; set(DeskState.FALL, 20f) }
    }
    private fun walk(dt: Float, s: DeskScreen, c: DeskContext) {
        val p = plan
        if (p?.together == "chase" && p.partner != null) c.others.firstOrNull { it.id == p.partner }?.let { o -> target = o.x.coerceIn(width / 2, s.w - width / 2)
            if (abs(o.x - x) < width * 0.6f) { events += DeskEvent("together", "chase|${p.partner}"); plan = Plan("social", Lv.SELF, act = DeskState.GREET, len = 1.5f); intent = "social"; enter(DeskState.GREET, 1.5f); return } }
        val sp = (if (state == DeskState.RUN) RUN else WALK) * (if (p?.intent == "nearYou" || p?.intent == "follow") 0.8f + 0.2f * persona.cling else 1f); val d = target - x
        if (abs(d) <= sp * dt || t > len) {
            x = target.coerceIn(width / 2, s.w - width / 2); moving = false
            if (p != null) arrive(p, s) else { intent = "rest"; enter(DeskState.IDLE, 1f + rng.nextFloat() * 3f) }
            return
        }
        moving = true; facing = if (d > 0) 1 else -1; x += facing * sp * dt
    }
    private fun followStep(dt: Float, s: DeskScreen) {
        val fx = followX ?: x; val d = fx - x
        if (!following && (abs(d) < 8f || t > len)) { followX = null; plan = Plan("follow", Lv.YOU, act = DeskState.HAPPY, len = 1.2f); enter(DeskState.HAPPY, 1.2f); if (ready("caught", 20f)) { used("caught"); events += DeskEvent("say", "caught") }; return }
        if (t > len) { following = false }
        if (abs(d) < 6f) { moving = false; return }
        val sp = (if (abs(d) > 90f) RUN else WALK * 1.6f) * (0.8f + 0.2f * persona.cling)
        moving = true; facing = if (d > 0) 1 else -1; x += facing * min(sp * dt, abs(d)); x = x.coerceIn(width / 2, s.w - width / 2)
    }
    private fun climb(dt: Float, s: DeskScreen) {
        y -= CLIMB * dt
        if (y - width / 2 <= s.top) { side = Side.TOP; x = if (x < s.w / 2) width / 2 + 4f else s.w - width / 2 - 4f; y = s.top; facing = if (x < s.w / 2) 1 else -1; set(DeskState.HANG, 5f + rng.nextFloat() * 8f); return }
        if (t > len) { side = Side.FLOOR; vx = if (x < s.w / 2) 80f else -80f; vy = 0f; x = if (x < s.w / 2) width / 2 else s.w - width / 2; plan = null; intent = "fall"; set(DeskState.FALL, 20f); events += DeskEvent("say", "letGo") }
    }
    private fun hang(dt: Float, s: DeskScreen) {
        x += facing * HANG * dt; if (x < width / 2 || x > s.w - width / 2) { facing = -facing; x = x.coerceIn(width / 2, s.w - width / 2) }
        if (t > len) { side = Side.FLOOR; y = s.top + height; vx = 0f; vy = 0f; plan = null; intent = "fall"; set(DeskState.FALL, 20f); events += DeskEvent("say", "letGo") }
    }
    /** on the ground again: the plan that was waiting (it let go of the wall for it), or a fresh choice */
    private fun landed(s: DeskScreen, hard: Boolean) {
        if (hard) { set(DeskState.LAND, 2f); events += DeskEvent("land", value = 1f); return }
        val p = plan
        if (p != null && p.intent != "fall") { set(DeskState.IDLE, 0.3f); begin(p) } else { intent = "rest"; set(DeskState.IDLE, 1f + rng.nextFloat() * 2f) }
    }
    private fun fall(dt: Float, s: DeskScreen) {
        side = Side.FLOOR; vy += G * dt; x += vx * dt; y += vy * dt; vx *= 0.995f
        if (x < width / 2) { x = width / 2; vx = abs(vx) * 0.5f }; if (x > s.w - width / 2) { x = s.w - width / 2; vx = -abs(vx) * 0.5f }
        if (y >= s.ground) { y = s.ground; val hard = vy > 1500f; vy = 0f; vx = 0f; events += DeskEvent("sound", "land"); landed(s, hard) }
    }
    private fun thrown(dt: Float, s: DeskScreen) {
        side = Side.FLOOR; vy += G * dt; x += vx * dt; y += vy * dt
        if (x < width / 2) { x = width / 2; vx = abs(vx) * 0.5f; events += DeskEvent("sound", "bounce") }
        if (x > s.w - width / 2) { x = s.w - width / 2; vx = -abs(vx) * 0.5f; events += DeskEvent("sound", "bounce") }
        if (y < s.top + height) { y = s.top + height; vy = abs(vy) * 0.4f }
        if (y >= s.ground) { y = s.ground
            if (vy > 900f) { vy = -vy * 0.35f; vx *= 0.6f; events += DeskEvent("sound", "bounce") }
            else { vy = 0f; vx = 0f; plan = null; intent = "fall"; set(DeskState.LAND, 2.2f); events += DeskEvent("sound", "land"); events += DeskEvent("land", value = 1f) } }
    }

    companion object {
        const val G = 2400f; const val WALK = 45f; const val RUN = 120f; const val CLIMB = 60f; const val HANG = 26f
        private val BUSY = setOf(DeskState.HELD, DeskState.THROWN, DeskState.FALL, DeskState.HIDDEN, DeskState.CLIMB, DeskState.HANG)
        private val AIR = setOf(DeskState.HELD, DeskState.THROWN, DeskState.FALL, DeskState.CLIMB, DeskState.HANG)
        private val FLYING = setOf(DeskState.HELD, DeskState.THROWN, DeskState.FALL, DeskState.HIDDEN)
        private val CALM = setOf(DeskState.IDLE, DeskState.SIT, DeskState.WALK)
        private val MOVERS = setOf(DeskState.WALK, DeskState.RUN, DeskState.FOLLOW)
        private val UP_FROM_REST = setOf(DeskState.SIT, DeskState.SLEEP, DeskState.DOZE, DeskState.READ)
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
