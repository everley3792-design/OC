package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.house.HouseType
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * The life of one world (plan 4.1–4.2): needs, mood cards, the utility AI (each piece of furniture advertises what it offers;
 * every candidate is scored by need × personality × schedule × distance × "did that lately" × a little noise, then one of the
 * best three is picked), walking, idle micro-behaviours, touch (pet, lift, throw, feed) and the catch-up of time spent away.
 *
 * Deterministic: live steps use `life.rngState`; the catch-up uses keyed generators (`Rng.of(seed, "away:<chunk>:<who>")`), so
 * the same save and the same absence always tell the same story. Time is game minutes; walking is in real seconds.
 */
class LifeSim(val life: Life) {
    val house: HouseType = Houses.get(life.houseId)
    val grid = Grid(house)
    private val rng = Rng(life.rngState)
    val events = ArrayList<SimEvent>()

    /** what the body is doing right now (never saved: a reopened world starts everyone standing where they were) */
    class Body {
        var path: ArrayList<FloatArray>? = null
        var think = 0f
        var micro: Micro? = null; var microT = 0f
        var pose = Pose.STAND
        var held = false; var flying = false
        var z = 0f; var vx = 0f; var vy = 0f; var vz = 0f
        var petAcc = 0f; var petting = false
        var arrivedAct = false
        var poseT = 0f
        var bounced = false
    }
    private val bodies = HashMap<String, Body>()
    fun body(id: String) = bodies.getOrPut(id) { Body() }
    private val reserved = HashMap<String, String>()   /* "piece:slot" → person id */
    private val arrived = HashSet<String>()

    init {
        for (p in life.people) if (p.act != null && p.actPiece >= 0) { reserved["${p.actPiece}:${p.actSlot}"] = p.id; body(p.id).arrivedAct = true; body(p.id).pose = Acts[p.act!!]?.pose ?: Pose.STAND }
        if (life.arriving) life.people.forEachIndexed { i, p -> val b = body(p.id); b.think = 1.2f + i * 2.4f; p.x = house.entrance.x + 0.5f; p.y = house.entrance.y + 0.5f }
    }

    // ---------------- time ----------------
    val hour: Double get() = ((life.minute % 1440) + 1440) % 1440 / 60.0
    private fun night(p: Person, h: Double = hour) = if (p.sleep > p.wake) (h >= p.sleep || h < p.wake) else (h >= p.sleep && h < p.wake)
    fun rate(): Double = if (life.clockMode == "GAME") life.speed else 1.0

    /** live: advance by real seconds (fixed steps of 0.1 s) */
    private var acc = 0f
    fun update(realSec: Float) {
        acc += realSec.coerceIn(0f, 0.5f)
        while (acc >= STEP) { acc -= STEP; step(STEP) }
        life.rngState = rng.state
    }
    private fun step(dt: Float) {
        val dm = dt / 60.0 * rate()
        life.minute += dm
        for (p in life.people) tick(p, dm, dt)
        if (life.arriving && arrived.size >= life.people.size && life.people.all { body(it.id).path == null }) life.arriving = false
    }

    private fun tick(p: Person, dm: Double, dt: Float) {
        val b = body(p.id); b.poseT += dt
        needs(p, dm)
        moods(p)
        if (b.held) { b.pose = Pose.HELD; return }
        if (b.flying) { fly(p, b, dt); return }
        b.micro?.let { _ -> b.microT -= dt; if (b.microT <= 0f) { b.micro = null; b.pose = if (p.act != null && b.arrivedAct) Acts[p.act!!]!!.pose else Pose.STAND } else return }
        b.path?.let { walk(p, b, dt); return }
        val act = p.act?.let { Acts[it] }
        if (act != null && b.arrivedAct) {
            if (life.minute >= p.actEnd || (act.id == "sleep" && !night(p) && p.need(Need.ENERGY) > 95f)) finish(p, act)
            return
        }
        b.think -= dt
        if (b.think <= 0f) {
            if (life.arriving && p.id !in arrived) { arrive(p, b); return }
            decide(p, b)
        }
    }

    // ---------------- needs and moods ----------------
    fun asleep(p: Person) = p.act in SLEEPY && body(p.id).arrivedAct
    private fun needs(p: Person, dm: Double) {
        val h = (dm / 60.0).toFloat(); val sl = asleep(p)
        for (n in Need.values()) {
            if (n == Need.ROOM) continue
            var d = -n.decay * h
            if (sl) d = when (n) { Need.FOOD -> d * 0.5f; Need.HYGIENE -> d * 0.5f; else -> 0f }
            p.setNeed(n, p.need(n) + d)
        }
        val act = p.act?.let { Acts[it] }
        if (act != null && body(p.id).arrivedAct) for ((n, v) in act.per) if (n == Need.ROOM) tidyRoom(p, v * h) else p.setNeed(n, p.need(n) + v * h)
        val r = roomOf(p); if (!sl) life.mess[r] = ((life.mess[r] ?: 10f) + 0.6f * h).coerceIn(0f, 100f)
        p.setNeed(Need.ROOM, 100f - (life.mess[r] ?: 10f))
    }
    private fun tidyRoom(p: Person, amount: Float) { val r = roomOf(p); life.mess[r] = ((life.mess[r] ?: 10f) - amount).coerceIn(0f, 100f) }
    fun roomOf(p: Person): String = house.roomAt(p.x.toInt(), p.y.toInt())?.id ?: p.room
    private fun moods(p: Person) {
        p.moods.removeAll { it.until < life.minute }
        fun cond(id: String, on: Boolean) { if (on) addMood(p, id) }
        if (!asleep(p)) {
            cond("hungry", p.need(Need.FOOD) < 20); cond("tired", p.need(Need.ENERGY) < 15); cond("dirty", p.need(Need.HYGIENE) < 20)
            cond("bored", p.need(Need.FUN) < 20); cond("messy", p.need(Need.ROOM) < 30); cond("ignored", p.need(Need.ATTENTION) < 15); cond("lonely", p.need(Need.SOCIAL) < 15)
        }
    }
    fun addMood(p: Person, id: String) { val d = Moods.ALL[id] ?: return; val until = life.minute + d.hours * 60; val ex = p.moods.firstOrNull { it.id == id }; if (ex != null) ex.until = max(ex.until, until) else p.moods += MoodState(id, until) }
    /** the mood: mood cards plus how well the needs are met */
    fun moodValue(p: Person): Int {
        val avg = Need.values().map { p.need(it) }.average().toFloat()
        return p.moods.sumOf { Moods.ALL[it.id]?.value ?: 0 } + ((avg - 55f) / 15f).toInt()
    }
    fun moodLabel(p: Person): String = when { asleep(p) -> "睡著了"; moodValue(p) >= 4 -> "很開心"; moodValue(p) >= 1 -> "心情不錯"; moodValue(p) >= -1 -> "平靜"; moodValue(p) >= -3 -> "有點悶"; else -> "不開心" }
    /** the little cloud above the head (plan A-04) */
    fun moodSky(p: Person): String = when { asleep(p) -> "moon"; moodValue(p) >= 4 -> "rainbow"; moodValue(p) >= 1 -> "sun"; moodValue(p) >= -1 -> "cloud"; moodValue(p) >= -3 -> "drizzle"; else -> "rain" }

    // ---------------- deciding (utility AI) ----------------
    private class Cand(val act: Activity, val piece: Int, val slot: Int, val tx: Float, val ty: Float, val score: Float, val why: List<String>)
    private fun gain(p: Person, a: Activity): Pair<Float, List<String>> {
        var s = 0f; val hours = a.min / 60f; val parts = ArrayList<Pair<Float, String>>()
        for ((n, v) in a.per) {
            val cur = p.need(n); val g = if (v >= 0) min(v * hours, 100f - cur) else v * hours * 0.5f
            val w = 1f + 4f * ((100f - cur) / 100f).let { it * it }
            val c = g * w / 10f; s += c; if (c > 1.5f && cur < 60f) parts += c to n.low
        }
        if (a.id == "cook") { val (m, _) = gain(p, Acts["meal"]!!); s += m * 0.9f; if (p.need(Need.FOOD) < 60) parts += m to "肚子餓了，想好好吃一頓" }
        return s to parts.sortedByDescending { it.first }.map { it.second }
    }
    private fun personality(p: Person, a: Activity): Float {
        var m = 1f; val ax = p.axes
        for (t in a.tags) m *= when (t) {
            "active" -> 1f + 0.4f * ax[Axis.ACTIVE]; "lazy" -> 1f - 0.35f * ax[Axis.ACTIVE]; "calm" -> 1f - 0.25f * ax[Axis.ACTIVE]
            "tidy" -> 1f + 0.5f * ax[Axis.DILIGENT]; "smart" -> 1f + 0.3f * ax[Axis.DILIGENT]; "dreamy" -> 1f - 0.3f * ax[Axis.FRANK]
            "vain" -> 1f + 0.3f * ax[Axis.OUTGOING]; "food" -> if (p.likes.any { it.contains("吃") || it.contains("甜") || it.contains("料理") }) 1.25f else 1f
            else -> 1f
        }
        return m
    }
    private fun candidates(p: Person, dist: IntArray?, r: Rng, abstract: Boolean): List<Cand> {
        val h = hour; val isNight = night(p, h); val out = ArrayList<Cand>()
        for (a in Acts.ALL.values) {
            if (a.night && !isNight) continue
            if (a.day && isNight) continue
            if (a.id == "meal" && p.next != "meal") continue
            if (a.id == "tidy" && p.need(Need.ROOM) > 70) continue
            var (g, why) = gain(p, a)
            if (a.id == "sleep") { g += 30f; why = listOf("到了睡覺的時間") + why }
            if (isNight && a.id != "sleep" && a.id != "snack") g *= 0.25f
            g *= personality(p, a)
            if (life.minute - (p.recent[a.id] ?: -1e9) < 120) g *= 0.4f
            if (g <= 0.05f) continue
            if (a.kind == null) {
                val tiles = grid.walkableTiles(house.rooms.indexOfFirst { it.id == roomOf(p) }.coerceAtLeast(0)); if (tiles.isEmpty()) continue
                val t = tiles[r.nextInt(tiles.size)]; val d = dist?.get(t.second * grid.w + t.first) ?: 0; if (dist != null && d < 0) continue
                out += Cand(a, -1, -1, t.first + 0.5f, t.second + 0.5f, g / (1f + d / 14f) * (0.85f + 0.3f * r.nextFloat()), why); continue
            }
            house.pieces.forEachIndexed { pi, piece ->
                if (piece.kind != a.kind) return@forEachIndexed
                if (a.sameRoomAs != null && house.pieces.none { it.kind == a.sameRoomAs && it.room == piece.room }) return@forEachIndexed
                if (a.id in SLEEPY && a.kind == "bed" && piece.room != p.room) return@forEachIndexed   /* only one's own bed */
                val k = Furniture.kind(piece.kind)
                k.slots.forEachIndexed { si, s ->
                    val who = reserved["$pi:$si"]; if (who != null && who != p.id) return@forEachIndexed
                    val sx = piece.x + s.dx; val sy = piece.y + s.dy
                    val d = if (dist == null) 0 else { val (ax, ay) = approach(sx, sy); dist[ay * grid.w + ax] }
                    if (d < 0) return@forEachIndexed
                    val near = if (dist != null && d <= 3) listOf("剛好在附近") else emptyList()
                    out += Cand(a, pi, si, sx, sy, g / (1f + (if (abstract) 0 else d) / 14f) * (0.85f + 0.3f * r.nextFloat()), why + near)
                }
            }
        }
        return out
    }
    private fun approach(sx: Float, sy: Float): Pair<Int, Int> { val tx = sx.toInt(); val ty = sy.toInt(); return if (grid.walkable(tx, ty)) tx to ty else grid.nearestWalkable(sx, sy) }
    private fun pick(c: List<Cand>, r: Rng): Cand? { val top = c.sortedByDescending { it.score }.take(3); if (top.isEmpty()) return null; return r.weighted(top) { (it.score * it.score).toDouble() } }

    private fun decide(p: Person, b: Body) {
        val tx = p.x.toInt(); val ty = p.y.toInt()
        val dist = grid.distances(tx, ty)
        val c = candidates(p, dist, rng, false); val best = pick(c, rng)
        if (best == null || best.score < 1.2f) { idle(p, b); return }
        if (best.piece >= 0) reserved["${best.piece}:${best.slot}"] = p.id
        p.act = best.act.id; p.actPiece = best.piece; p.actSlot = best.slot; p.why = best.why.distinct().take(2).ifEmpty { listOf("想做就做") }
        b.arrivedAct = false
        val (ax, ay) = approach(best.tx, best.ty)
        val tiles = grid.path(tx, ty, ax, ay)
        if (tiles == null) { release(p); p.act = null; idle(p, b); return }
        b.path = ArrayList(tiles.drop(1).map { floatArrayOf(it.first + 0.5f, it.second + 0.5f) }).apply { add(floatArrayOf(best.tx, best.ty)) }
        b.pose = Pose.WALK
    }
    private fun idle(p: Person, b: Body) {
        p.why = emptyList()
        val low = Need.values().filter { it != Need.ROOM && p.need(it) < 35 }
        val pool = Micros.ALL.filter { it.needs == null || it.needs in low }
        if (rng.chance(0.55)) {
            val m = rng.pick(pool); b.micro = m; b.microT = m.sec; b.pose = m.pose; b.poseT = 0f
            if (m.line != null && rng.chance(0.6)) events += SimEvent("say", p.id, m.line)
        } else {
            val tiles = grid.walkableTiles(house.rooms.indexOfFirst { it.id == roomOf(p) }.coerceAtLeast(0))
            if (tiles.isNotEmpty()) { val t = tiles[rng.nextInt(tiles.size)]; grid.path(p.x.toInt(), p.y.toInt(), t.first, t.second)?.let { path -> b.path = ArrayList(path.drop(1).map { floatArrayOf(it.first + 0.5f, it.second + 0.5f) }); b.pose = Pose.WALK } }
        }
        b.think = 3f + rng.nextFloat() * 5f
    }
    private fun arrive(p: Person, b: Body) {
        val home = house.room(p.room); val tiles = grid.walkableTiles(house.rooms.indexOf(home))
        val t = if (tiles.isEmpty()) grid.nearestWalkable(p.x, p.y) else tiles[rng.nextInt(tiles.size)]
        grid.path(p.x.toInt(), p.y.toInt(), t.first, t.second)?.let { path -> b.path = ArrayList(path.drop(1).map { floatArrayOf(it.first + 0.5f, it.second + 0.5f) }); b.pose = Pose.WALK }
        arrived += p.id; events += SimEvent("say", p.id, rng.pick(Lines.M["arrive"]!!)); p.why = listOf("搬進新家")
        log(p, "搬進了${house.room(p.room).zh}")
        b.think = 2f
    }
    private fun walk(p: Person, b: Body, dt: Float) {
        val path = b.path!!; var left = SPEED * dt
        while (left > 0 && path.isNotEmpty()) {
            val t = path[0]; val dx = t[0] - p.x; val dy = t[1] - p.y; val d = hypot(dx, dy)
            if (abs(dx) > 0.05f) p.facing = if (dx > 0) 1 else -1
            if (d <= left) { p.x = t[0]; p.y = t[1]; path.removeAt(0); left -= d } else { p.x += dx / d * left; p.y += dy / d * left; left = 0f }
        }
        b.pose = Pose.WALK
        if (path.isEmpty()) {
            b.path = null
            val a = p.act?.let { Acts[it] }
            if (a != null) begin(p, b, a) else { b.pose = Pose.STAND; b.think = max(b.think, 1f) }
        }
    }
    private fun begin(p: Person, b: Body, a: Activity) {
        b.arrivedAct = true; b.pose = a.pose; b.poseT = 0f
        p.actStart = life.minute
        p.actEnd = if (a.id == "sleep") life.minute + minutesUntil(p.wake.toDouble()) + rng.nextInt(20) else life.minute + a.min * (0.85 + 0.3 * rng.nextDouble())
        if (a.pose == Pose.LIE || a.pose == Pose.SIT) Furniture.kind(house.pieces.getOrNull(p.actPiece)?.kind ?: "rug").let { if (it.id == "sofa" || it.id == "table") p.facing = 1 }
    }
    private fun minutesUntil(h: Double): Double { val now = hour; var d = (h - now) * 60; if (d <= 0) d += 1440; return d }
    private fun finish(p: Person, a: Activity) {
        release(p); p.recent[a.id] = life.minute
        a.finish?.let { addMood(p, it) }
        if (a.id == "sleep") { if (p.need(Need.ENERGY) < 60) { p.moods.removeAll { it.id == "slept" }; addMood(p, "badsleep") }; events += SimEvent("say", p.id, rng.pick(Lines.M["wake"]!!)) }
        if (a.id in NOTABLE) log(p, a.zh)
        p.act = null; p.why = emptyList()
        if (a.id == "cook") p.next = "meal" else if (a.id == "meal") p.next = null
        val b = body(p.id); b.arrivedAct = false; b.pose = Pose.STAND; b.think = 1f + rng.nextFloat() * 2f
        if (a.kind != null) { val (ax, ay) = approach(p.x, p.y); if (!grid.walkable(p.x.toInt(), p.y.toInt())) { p.x = ax + 0.5f; p.y = ay + 0.5f } }
    }
    private fun release(p: Person) { reserved.entries.removeAll { it.value == p.id } }
    private fun log(p: Person, text: String, away: Boolean = false) { life.log += LogLine(life.minute, p.id, "${p.name}：$text", away); if (life.log.size > 300) life.log.removeAt(0) }

    // ---------------- touch (plan E-01…E-03) ----------------
    fun person(id: String) = life.people.firstOrNull { it.id == id }
    /** a finger rubbing back and forth on the character (seconds of real stroking) */
    fun pet(id: String, sec: Float) { val p = person(id) ?: return; val b = body(id); if (b.held || b.flying) return; b.petting = true; b.petAcc += sec; if (!asleep(p)) b.pose = Pose.PETTED; if (b.petAcc > 0.3f && rng.chance(sec * 1.5)) events += SimEvent("heart", id) }
    /** the stroke ended: the data changes once per stroke */
    fun petEnd(id: String) {
        val p = person(id) ?: return; val b = body(id); if (!b.petting) return; b.petting = false; val acc = b.petAcc; b.petAcc = 0f
        if (!asleep(p)) b.pose = if (p.act != null && b.arrivedAct) Acts[p.act!!]!!.pose else Pose.STAND
        if (acc < 0.5f) return
        val cool = life.minute - p.lastPet < 10
        p.setNeed(Need.ATTENTION, p.need(Need.ATTENTION) + min(40f, acc * 12f) * (if (cool) 0.3f else 1f)); p.setNeed(Need.SOCIAL, p.need(Need.SOCIAL) + min(15f, acc * 4f))
        p.lastPet = life.minute
        if (asleep(p)) { addMood(p, "pettedsleep"); events += SimEvent("say", id, rng.pick(Lines.M["pettedsleep"]!!)) }
        else { addMood(p, "petted"); events += SimEvent("say", id, rng.pick(Lines.M["petted"]!!)); if (!cool) log(p, "被你摸摸了") }
    }
    /** picked up: whatever it was doing stops (sleep → woken up) */
    fun lift(id: String) {
        val p = person(id) ?: return; val b = body(id)
        if (asleep(p)) { addMood(p, "badsleep"); p.moods.removeAll { it.id == "slept" } }
        release(p); p.act = null; p.why = emptyList(); b.arrivedAct = false; b.path = null; b.micro = null
        b.held = true; b.flying = false; b.z = 1.1f; b.pose = Pose.HELD
        addMood(p, "lifted"); events += SimEvent("say", id, rng.pick(Lines.M["lifted"]!!)); events += SimEvent("sound", id, "lift")
    }
    fun hold(id: String, x: Float, y: Float) { val p = person(id) ?: return; if (!body(id).held) return; if (abs(x - p.x) > 0.02f) p.facing = if (x > p.x) 1 else -1; p.x = x.coerceIn(0f, house.w.toFloat()); p.y = y.coerceIn(0f, house.h.toFloat()) }
    /** let go with a velocity (tiles per second): a gentle drop, or a throw with an arc and a bounce */
    fun drop(id: String, vx: Float, vy: Float) {
        val p = person(id) ?: return; val b = body(id); if (!b.held) return
        b.held = false; b.flying = true; b.bounced = false
        val sp = hypot(vx, vy); val k = min(1f, 9f / max(sp, 0.001f))
        b.vx = vx * k * 0.6f; b.vy = vy * k * 0.6f; b.vz = min(7f, sp * 0.35f); b.pose = Pose.FLY
        if (sp > 4f) { events += SimEvent("say", id, rng.pick(Lines.M["thrown"]!!)); events += SimEvent("sound", id, "whoosh") }
        b.petAcc = sp
    }
    private fun fly(p: Person, b: Body, dt: Float) {
        p.x += b.vx * dt; p.y += b.vy * dt; b.vz -= G * dt; b.z += b.vz * dt
        p.x = p.x.coerceIn(0.5f, house.w - 0.5f); p.y = p.y.coerceIn(0.5f, house.h - 0.5f)
        if (b.z <= 0f) {
            b.z = 0f
            if (!b.bounced && b.vz < -5f) { b.bounced = true; b.vz = -b.vz * 0.35f; b.vx *= 0.5f; b.vy *= 0.5f; events += SimEvent("sound", p.id, "bounce"); return }
            b.flying = false; val strong = b.petAcc > 4f; b.petAcc = 0f
            if (!grid.walkable(p.x.toInt(), p.y.toInt())) { val (tx, ty) = grid.nearestWalkable(p.x, p.y); p.x = tx + 0.5f; p.y = ty + 0.5f }
            events += SimEvent("sound", p.id, "land")
            if (strong) {
                val likes = p.axes[Axis.ACTIVE] > 0.25f
                addMood(p, if (likes) "thrownfun" else "thrown"); if (!likes) addMood(p, "dizzy")
                val m = Micro("dizzy", if (likes) Pose.HAPPY else Pose.DIZZY, 2.2f); b.micro = m; b.microT = m.sec; b.pose = m.pose
                events += SimEvent("say", p.id, if (likes) "再一次！" else rng.pick(Lines.M["landed"]!!)); log(p, if (likes) "被丟出去，覺得很好玩" else "被丟出去，頭暈了")
            } else { b.pose = Pose.STAND }
            b.think = 1.5f
        }
    }
    /** player's snacks (M1: free; the shop and inventory arrive in M5/M6) */
    fun feed(id: String, food: String): String {
        val p = person(id) ?: return ""; val f = FOODS[food] ?: return ""; val b = body(id)
        if (b.held || b.flying) return ""
        if (asleep(p)) return "${p.name}睡著了"
        if (p.need(Need.FOOD) > 92) { events += SimEvent("say", id, rng.pick(Lines.M["full"]!!)); return "${p.name}吃不下了" }
        p.setNeed(Need.FOOD, p.need(Need.FOOD) + f.second); p.setNeed(Need.ATTENTION, p.need(Need.ATTENTION) + 10f)
        val liked = p.likes.any { f.first.contains(it) || it.contains(f.first) }
        addMood(p, if (liked) "tasty" else "snack")
        if (p.act != null && !b.arrivedAct) { release(p); p.act = null; b.path = null }
        b.micro = Micro("eat", Pose.EAT, 3f); b.microT = 3f; b.pose = Pose.EAT
        events += SimEvent("say", id, rng.pick(Lines.M[if (liked) "tasty" else "snackok"]!!)); events += SimEvent("sound", id, "munch")
        log(p, "吃了你給的${FOOD_ZH[food]}")
        return ""
    }

    // ---------------- while you were away (plan J-05) ----------------
    /** advance to `toMinute` without a screen: 10-minute chunks, no walking, no touch, nothing that needs you; capped at 30 days */
    fun catchUp(toMinute: Double, summarize: Boolean = true): AwaySummary? {
        val from = life.minute; val to = min(toMinute, from + MAX_AWAY_MIN)
        if (to - from < 1) return null
        val counts = HashMap<String, HashMap<String, Int>>()
        var chunk = 0
        for (p in life.people) { body(p.id).path = null; body(p.id).micro = null; body(p.id).held = false; body(p.id).flying = false }
        while (life.minute < to - 1e-6) {
            val dm = min(CHUNK, to - life.minute)
            for (p in life.people) {
                val r = Rng.of(life.seed, "away:${(life.minute / CHUNK).toLong()}:${p.id}")
                val a = p.act?.let { Acts[it] }
                if (a != null && body(p.id).arrivedAct && life.minute >= p.actEnd) { counts.getOrPut(p.id) { HashMap() }.merge(a.zh, 1, Int::plus); finishQuiet(p, a) }
                if (p.act == null) {
                    val c = candidates(p, null, r, true); val best = pick(c, r)
                    if (best != null && best.score >= 1.2f) {
                        if (best.piece >= 0) reserved["${best.piece}:${best.slot}"] = p.id
                        p.act = best.act.id; p.actPiece = best.piece; p.actSlot = best.slot; p.x = best.tx; p.y = best.ty
                        body(p.id).arrivedAct = true; body(p.id).pose = best.act.pose
                        p.actStart = life.minute; p.actEnd = if (best.act.id == "sleep") life.minute + minutesUntil(p.wake.toDouble()) + r.nextInt(20) else life.minute + best.act.min * (0.85 + 0.3 * r.nextDouble())
                    }
                }
            }
            life.minute += dm
            for (p in life.people) { needs(p, dm); moods(p) }
            chunk++
        }
        for (p in life.people) { val a = p.act?.let { Acts[it] }; if (a != null && life.minute >= p.actEnd) { counts.getOrPut(p.id) { HashMap() }.merge(a.zh, 1, Int::plus); finishQuiet(p, a) }
            if (!grid.walkable(p.x.toInt(), p.y.toInt()) && p.act == null) { val (x, y) = grid.nearestWalkable(p.x, p.y); p.x = x + 0.5f; p.y = y + 0.5f } }
        life.arriving = false
        val lines = life.people.map { p ->
            val c = counts[p.id].orEmpty().entries.sortedByDescending { it.value }.take(3)
            if (c.isEmpty()) "${p.name}：一直在${p.act?.let { Acts[it]?.zh } ?: "休息"}" else "${p.name}：" + c.joinToString("、") { "${it.key}${if (it.value > 1) " ${it.value} 次" else ""}" }
        }
        val s = AwaySummary(from, to, lines); if (!summarize) return s
        life.away = s
        life.log += LogLine(to, "", "你不在的 ${fmtSpan(to - from)} 裡：" + lines.joinToString("；"), away = true); while (life.log.size > 300) life.log.removeAt(0)
        return s
    }
    private fun finishQuiet(p: Person, a: Activity) {
        release(p); p.recent[a.id] = life.minute; a.finish?.let { addMood(p, it) }
        if (a.id == "cook") p.next = "meal" else if (a.id == "meal") p.next = null
        p.act = null; p.why = emptyList(); body(p.id).arrivedAct = false; body(p.id).pose = Pose.STAND
        if (!grid.walkable(p.x.toInt(), p.y.toInt())) { val (x, y) = grid.nearestWalkable(p.x, p.y); p.x = x + 0.5f; p.y = y + 0.5f }
    }

    companion object {
        const val STEP = 0.1f
        const val SPEED = 1.8f            /* tiles per real second */
        const val G = 30f
        const val CHUNK = 10.0            /* game minutes per catch-up step */
        const val MAX_AWAY_MIN = 30.0 * 1440
        val SLEEPY = setOf("sleep", "nap", "sofanap")
        val NOTABLE = setOf("sleep", "meal", "cook", "bathe", "read", "water", "tidy", "nap")
        val FOODS = mapOf("cookie" to ("甜點" to 25f), "apple" to ("水果" to 30f), "milk" to ("牛奶" to 18f))
        val FOOD_ZH = mapOf("cookie" to "餅乾", "apple" to "蘋果", "milk" to "牛奶")
        fun fmtSpan(min: Double): String = when { min < 60 -> "${min.toInt()} 分鐘"; min < 1440 -> "${(min / 60).toInt()} 小時"; else -> "${(min / 1440).toInt()} 天" }

        /** a new world's life: everyone at the door, move-in day to be played */
        fun create(seed: Long, h: HouseType, tenants: List<Tenant>, rooms: Map<String, String>, libIds: Map<String, String>, likes: Map<String, List<String>>, traits: Map<String, List<String>>,
                   town: String, home: String, nowMinute: Double, nowMs: Long): Life {
            val r = Rng.of(seed, "create")
            val life = Life(h.id, town, home, nowMinute, seed = seed, rngState = Rng.hash("live:$seed"), lastRealMs = nowMs, arriving = true, startMinute = nowMinute)
            for (t in tenants) {
                val p = Person(t.id, libIds[t.id] ?: t.id, t.name, t.adult, rooms[t.id] ?: h.bedrooms.first().id, axes = Axis.fromWords(traits[t.id].orEmpty()), likes = likes[t.id].orEmpty())
                for (n in Need.values()) p.setNeed(n, 60f + r.nextFloat() * 25f)
                p.x = h.entrance.x + 0.5f; p.y = h.entrance.y + 0.5f
                p.moods += MoodState("newhome", nowMinute + 24 * 60)
                life.people += p
            }
            for (room in h.rooms) life.mess[room.id] = 5f
            return life
        }
    }
}
