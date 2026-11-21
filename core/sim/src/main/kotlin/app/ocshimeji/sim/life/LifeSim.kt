package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.Catalog
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Effect
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.chars.Relations
import app.ocshimeji.sim.chars.Speech
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.house.HouseType
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The life of one world (plan 4.1–4.2): needs, mood cards, the utility AI (each piece of furniture advertises what it offers;
 * every candidate is scored by need × personality × schedule × distance × "did that lately" × a little noise, then one of the
 * best three is picked), walking, idle micro-behaviours, chatting, touch (pet, lift, throw, feed) and the catch-up of time away.
 *
 * Who someone is comes from their `CharSpec` (plan 12.4): tags, traits, quirks and values are bundles of effects (`Catalog`),
 * likes and skills change what they choose and how well it goes, and every line passes through `Speech`.
 *
 * Deterministic: live steps use `life.rngState`; the catch-up uses keyed generators (`Rng.of(seed, "away:<chunk>:<who>")`), so
 * the same save and the same absence always tell the same story. Time is game minutes; walking is in real seconds.
 */
class LifeSim(val life: Life) {
    /** the house as built, with the furniture as you arranged it (plan G-01); changes through `relayout` only */
    var house: HouseType = build(); private set
    var grid = Grid(house); private set
    private fun build(): HouseType {
        for (it0 in life.items) if (it0.kind in FURNITURE_KINDS) Furniture.register(furnitureOf(it0))
        val base = Houses.get(life.houseId)
        return if (life.layout.isEmpty()) base else base.copy(pieces = life.layout.map { app.ocshimeji.sim.house.Piece(it.kind, it.x, it.y, it.room, it.flip) })
    }
    /** a new arrangement: nobody keeps using furniture that moved; everyone stands on the floor */
    internal fun relayout() {
        house = build(); grid = Grid(house); reserved.clear()
        for (p in life.people) { val b = body(p.id); if (p.actPiece >= 0 || b.path != null) { if (p.with == null) { p.act = null; b.arrivedAct = false }; b.path = null; p.actPiece = -1 }; unstick(p) }
    }
    /** the ledger (money and things), trips to town, the daily goals, the workshop (M6) */
    val economy = Economy(life)
    val townLife = TownLife(this)
    val journal = Journal(this)
    val decorate = Decorate(this)
    /** today's weather and the season (plan J-02) */
    fun weather(): String = app.ocshimeji.sim.town.Weather.of(life.seed, life.minute)
    fun season(): String = app.ocshimeji.sim.town.Weather.season(life.minute)
    internal val rng = Rng(life.rngState)
    val events = ArrayList<SimEvent>()

    /** what the body is doing right now (never saved: a reopened world starts everyone standing where they were) */
    class Body {
        var path: ArrayList<FloatArray>? = null
        var think = 0f
        var micro: Micro? = null; var microT = 0f
        var pose = Pose.STAND
        var held = false; var flying = false
        var z = 0f; var vx = 0f; var vy = 0f; var vz = 0f
        var petAcc = 0f; var petting = false; var petPart = "身體"
        var arrivedAct = false
        var poseT = 0f
        var bounced = false
        /** chat: real seconds until the next line / waiting for the partner */
        var talkT = 0f; var waitT = 0f; var talkTurn = 0
        /** asleep on the desktop (the desk pet says so) */
        var deskSleep = false
        /** decisions that skipped the plan's next step */
        var planMiss = 0
    }
    private val bodies = HashMap<String, Body>()
    fun body(id: String) = bodies.getOrPut(id) { Body() }
    private val reserved = HashMap<String, String>()   /* "piece:slot" → person id */
    internal fun reservedBy(piece: Int, slot: Int) = reserved["$piece:$slot"]
    private val arrived = HashSet<String>()
    /** the social life (M4): acts, scenes, events, worries, the daily settlement */
    val society = Society(this)

    init {
        for (p in life.people) if (p.act != null && p.actPiece >= 0) { reserved["${p.actPiece}:${p.actSlot}"] = p.id; body(p.id).arrivedAct = true; body(p.id).pose = Acts[p.act!!]?.pose ?: Pose.STAND }
        for (p in life.people) if (p.act == "chat" || p.with != null) { p.act = null; p.with = null }   /* a chat is not resumed after reopening */
        if (life.arriving) life.people.forEachIndexed { i, p -> val b = body(p.id); b.think = 1.2f + i * 2.4f; p.x = house.entrance.x + 0.5f; p.y = house.entrance.y + 0.5f }
    }

    // ---------------- who they are: effects of their spec (cached per spec) ----------------
    class Mods(val fx: List<Effect>, val s: CharSpec) {
        fun act(key: String) = fx.fold(1f) { m, e -> m * (e.act[key] ?: 1f) }
        fun decay(n: Need) = fx.fold(1f) { m, e -> m * (e.decay[n] ?: 1f) }
        val wake = fx.sumOf { it.wake }; val sleep = fx.sumOf { it.sleep }
        val pos = fx.fold(1f) { m, e -> m * e.moodPos }; val neg = fx.fold(1f) { m, e -> m * e.moodNeg }
        val speed = fx.fold(1f) { m, e -> m * e.speed }; val duration = fx.fold(1f) { m, e -> m * e.duration }
        val hate: Set<String> = fx.flatMap { it.hate }.toSet() + ACT_WORDS.filter { (_, w) -> s.dislikes.any { d -> w.any { d.contains(it) } } }.keys
        val flags: Set<String> = fx.flatMap { it.flags }.toSet() + s.fears.flatMap { f -> FEAR_FLAGS.filter { (w, _) -> f.contains(w) }.values }
        val render: Set<String> = fx.flatMap { it.render }.toSet()
        val owns: Set<String> = (s.tags + s.traits + s.quirks).toSet()
    }
    private val modCache = HashMap<String, Pair<CharSpec, Mods>>()
    fun mods(p: Person): Mods { val c = modCache[p.id]; if (c != null && c.first === p.spec) return c.second; val m = Mods(Catalog.effects(p.spec, life.tags), p.spec); modCache[p.id] = p.spec to m; return m }
    /** change who someone is (the editor); takes effect at once */
    fun editSpec(id: String, spec: CharSpec) { person(id)?.let { it.spec = spec; modCache.remove(id) } }

    // ---------------- time ----------------
    val hour: Double get() = ((life.minute % 1440) + 1440) % 1440 / 60.0
    fun wakeOf(p: Person) = Math.floorMod(p.spec.wake + mods(p).wake + rhythm(p), 24)
    fun sleepOf(p: Person) = Math.floorMod(p.spec.sleep + mods(p).sleep + (p.spec.nightOwl * 2).roundToInt() + rhythm(p), 24)
    /** a resident whose hours were left at the default (7 / 23) still has their own rhythm: −1, 0 or +1 hour, fixed per person and world (R1 L4) */
    private fun rhythm(p: Person): Int = if (p.spec.wake == 7 && p.spec.sleep == 23) Math.floorMod(Rng.hash("rhythm:${life.seed}:${p.id}"), 3L).toInt() - 1 else 0
    internal fun isNight(p: Person) = night(p)
    private fun night(p: Person, h: Double = hour): Boolean { val w = wakeOf(p); val s = sleepOf(p); return if (s > w) (h >= s || h < w) else (h >= s && h < w) }
    fun rate(): Double = if (hold) 0.0 else if (life.clockMode == "GAME") life.speed else 1.0
    /** the clock waits (R1 T1): in real-time mode the world got ahead of the phone (after fast game time); everyone keeps moving, time does not */
    var hold = false
    /** today as MM-DD (game minutes are local minutes since 1970) */
    fun today(): String { val d = java.time.LocalDate.ofEpochDay(floor(life.minute / 1440).toLong()); return "%02d-%02d".format(d.monthValue, d.dayOfMonth) }

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
        society.step(true, dt)
        townLife.step(true)
        if (life.arriving && arrived.size >= life.people.size && life.people.all { body(it.id).path == null }) life.arriving = false
    }

    private fun tick(p: Person, dm: Double, dt: Float) {
        val b = body(p.id); b.poseT += dt
        needs(p, dm)
        moods(p, live = true)
        if (p.desk) { b.micro = null; b.path = null; return }   /* on the desktop: the desk pet moves them */
        if (p.out != null) { b.micro = null; b.path = null; return }   /* in town: the town moves them */
        if (b.held) { b.pose = Pose.HELD; return }
        if (b.flying) { fly(p, b, dt); return }
        b.micro?.let { _ -> b.microT -= dt; if (b.microT <= 0f) { b.micro = null; b.pose = restPose(p) } else return }
        b.path?.let { walk(p, b, dt); return }
        val act = p.act?.let { Acts[it] }
        if (act != null && act.id == "chat" && !b.arrivedAct) { waitForChat(p, b, dt); return }
        if (act != null && b.arrivedAct) {
            if (act.id == "chat") talk(p, b, dt)
            if (life.minute >= p.actEnd || (act.id == "sleep" && !night(p) && p.need(Need.ENERGY) > 95f)) finish(p, act)
            return
        }
        b.think -= dt
        if (b.think <= 0f) {
            if (life.arriving && p.id !in arrived) { arrive(p, b); return }
            decide(p, b)
        }
    }
    private fun restPose(p: Person) = if (p.act != null && body(p.id).arrivedAct) Acts[p.act!!]!!.pose else Pose.STAND

    // ---------------- needs and moods ----------------
    fun asleep(p: Person) = (p.act in SLEEPY && body(p.id).arrivedAct) || (p.desk && body(p.id).deskSleep)
    /** how fast a need drops for them (per game hour) */
    fun decayOf(p: Person, n: Need): Float { var d = n.decay * mods(p).decay(n); if (n == Need.HYGIENE) d *= (1f - 0.25f * p.spec.hygiene); return d }
    private fun needs(p: Person, dm: Double) {
        val h = (dm / 60.0).toFloat(); val sl = asleep(p)
        for (n in Need.values()) {
            if (n == Need.ROOM) continue
            var d = -decayOf(p, n) * h
            if (sl) d = when (n) { Need.FOOD -> d * 0.5f; Need.HYGIENE -> d * 0.5f; else -> 0f }
            p.setNeed(n, p.need(n) + d)
        }
        if (p.desk && body(p.id).deskSleep) { p.setNeed(Need.ENERGY, p.need(Need.ENERGY) + 16f * h); p.setNeed(Need.COMFORT, p.need(Need.COMFORT) + 4f * h) }
        val act = p.act?.let { Acts[it] }
        if (act != null && body(p.id).arrivedAct) for ((n, v) in act.per) { val g = v * h * skillGain(p, act, n); if (n == Need.ROOM) tidyRoom(p, g) else p.setNeed(n, p.need(n) + g) }
        val r = roomOf(p); if (!sl) life.mess[r] = ((life.mess[r] ?: 10f) + 0.6f * h).coerceIn(0f, 100f)
        p.setNeed(Need.ROOM, 100f - (life.mess[r] ?: 10f))
    }
    private fun tidyRoom(p: Person, amount: Float) { val r = roomOf(p); life.mess[r] = ((life.mess[r] ?: 10f) - amount).coerceIn(0f, 100f) }
    fun roomOf(p: Person): String = house.roomAt(p.x.toInt(), p.y.toInt())?.id ?: p.room
    private fun roomHas(room: String, kind: String) = house.pieces.any { it.room == room && it.kind == kind }
    private fun moods(p: Person, live: Boolean) {
        p.moods.removeAll { it.until < life.minute }
        fun cond(id: String, on: Boolean) { if (on) addMood(p, id) }
        val m = mods(p); val awake = !asleep(p); val h = hour; val room = roomOf(p)
        if (awake) {
            val messy = when (p.spec.roomPref) { "整齊" -> 50; "隨性" -> 15; else -> 30 }
            cond("hungry", p.need(Need.FOOD) < 20); cond("tired", p.need(Need.ENERGY) < 15); cond("dirty", p.need(Need.HYGIENE) < 20)
            cond("bored", p.need(Need.FUN) < 20); cond("messy", p.need(Need.ROOM) < messy); cond("ignored", p.need(Need.ATTENTION) < 15); cond("lonely", p.need(Need.SOCIAL) < 15)
            cond("plants", p.spec.roomPref == "要有植物" && roomHas(room, "plant"))
            cond("dark", "dark" in m.flags && (h >= 20 || h < 6) && !roomHas(room, "lamp"))
            cond("sunburn", "sunlight" in m.flags && p.act == "window" && body(p.id).arrivedAct && h in 7.0..17.0)
            cond("noisy", "crowd" in m.flags && life.people.count { roomOf(it) == room } >= 3)
            cond("lonely", "alone" in m.flags && p.need(Need.SOCIAL) < 50 && life.people.none { it !== p && !asleep(it) })
            cond("feud", society.inFeud(p.id))
            val wx = weather(); val wzh = app.ocshimeji.sim.town.Weather.ZH[wx] ?: ""
            cond("goodweather", p.spec.weather.isNotBlank() && wzh.contains(p.spec.weather.take(1)))
            cond("rainy", wx == "rain" && p.spec.weather.isNotBlank() && !p.spec.weather.contains("雨") && p.spec.axis(Axis.ACTIVE) > 0.2f)
            if (p.out == null && !p.desk) townLife.roomMood(p)?.let { cond(it, true) }
            val day = floor(life.minute / 1440).toLong()
            if (p.spec.birthday.isNotBlank() && p.birthdayDay != day && p.spec.birthday == today()) {
                p.birthdayDay = day; addMood(p, "birthday"); log(p, "今天是${p.spec.pronoun}的生日"); if (live) say(p, rng.pick(Lines.M["birthday"]!!), toPlayer = true)
            }
            if (live && p.spec.secret.isNotBlank() && !p.secretTold && p.affinity >= 85 && body(p.id).path == null) {
                p.secretTold = true; addMood(p, "secret"); say(p, "其實……我只告訴你喔：" + p.spec.secret, toPlayer = true); log(p, "把秘密告訴了你")
            }
        }
    }
    fun addMood(p: Person, id: String) { val d = Moods.ALL[id] ?: return; val until = life.minute + d.hours * 60; val ex = p.moods.firstOrNull { it.id == id }; if (ex != null) ex.until = max(ex.until, until) else p.moods += MoodState(id, until) }
    /** a mood card's weight for this person: personality and how strongly feelings show */
    fun moodWeight(p: Person, value: Int): Float { val m = mods(p); return if (value >= 0) value * m.pos else value * m.neg * (1f + 0.4f * p.spec.cry) }
    /** the mood: mood cards plus how well the needs are met */
    fun moodValue(p: Person): Int {
        val avg = Need.values().map { p.need(it) }.average().toFloat()
        return p.moods.sumOf { (moodWeight(p, Moods.ALL[it.id]?.value ?: 0).toDouble()) }.roundToInt() + ((avg - 55f) / 15f).toInt()
    }
    fun moodLabel(p: Person): String = when { asleep(p) -> "睡著了"; moodValue(p) >= 4 -> "很開心"; moodValue(p) >= 1 -> "心情不錯"; moodValue(p) >= -1 -> "平靜"; moodValue(p) >= -3 -> "有點悶"; else -> "不開心" }
    /** the little cloud above the head (plan A-04) */
    fun moodSky(p: Person): String = when { asleep(p) -> "moon"; moodValue(p) >= 4 -> "rainbow"; moodValue(p) >= 1 -> "sun"; moodValue(p) >= -1 -> "cloud"; moodValue(p) >= -3 -> "drizzle"; else -> "rain" }

    // ---------------- deciding (utility AI) ----------------
    internal class Cand(val act: Activity, val piece: Int, val slot: Int, val tx: Float, val ty: Float, val score: Float, val why: List<String>, val partner: String? = null, val soc: String? = null)
    internal fun gain(p: Person, a: Activity): Pair<Float, List<String>> {
        var s = 0f; val hours = a.min / 60f; val parts = ArrayList<Pair<Float, String>>()
        for ((n, v) in a.per) {
            val cur = p.need(n); val g = if (v >= 0) min(v * hours * skillGain(p, a, n), 100f - cur) else v * hours * 0.5f
            val w = 1f + 4f * ((100f - cur) / 100f).let { it * it }
            val c = g * w / 10f; s += c; if (c > 1.5f && cur < 60f) parts += c to n.low
        }
        if (a.id == "cook") { val (m, _) = gain(p, Acts["meal"]!!); s += m * 0.9f; if (p.need(Need.FOOD) < 60) parts += m to "肚子餓了，想好好吃一頓" }
        return s to parts.sortedByDescending { it.first }.map { it.second }
    }
    /** what one activity means to this person, apart from needs (personality, tags, traits, values, likes, habits, skills) */
    fun appeal(p: Person, a: Activity): Pair<Float, String?> {
        val s = p.spec; val m = mods(p); var k = 1f; var why: String? = null
        for (t in a.tags) k *= when (t) {
            "active" -> 1f + 0.4f * s.axis(Axis.ACTIVE); "lazy" -> 1f - 0.35f * s.axis(Axis.ACTIVE); "calm" -> 1f - 0.25f * s.axis(Axis.ACTIVE)
            "tidy" -> 1f + 0.5f * s.axis(Axis.DILIGENT); "smart" -> 1f + 0.3f * s.axis(Axis.DILIGENT); "dreamy" -> 1f - 0.3f * s.axis(Axis.FRANK)
            "vain" -> 1f + 0.3f * s.axis(Axis.OUTGOING); "chat" -> 1f + 0.5f * s.axis(Axis.OUTGOING)
            else -> 1f
        }
        val fxk = m.act(a.id) * a.tags.fold(1f) { acc, t -> acc * m.act(t) }
        if (fxk > 1.25f) why = "${s.name}就是這樣的個性" ; k *= fxk
        val words = ACT_WORDS[a.id].orEmpty()
        if (words.isNotEmpty() && (s.likes + s.hobbies).any { l -> words.any { l.contains(it) } }) { k *= 1.6f; why = "喜歡${(s.likes + s.hobbies).first { l -> words.any { l.contains(it) } }}" }
        if (a.id in m.hate) k *= 0.4f
        if (a.id == "bathe") k *= 1f + 0.5f * s.hygiene
        if (a.id == "tidy") k *= when (s.roomPref) { "整齊" -> 1.4f; "隨性" -> 0.7f; else -> 1f } * (1f + 0.4f * s.hygiene)
        if (a.id == "water" && s.roomPref == "要有植物") k *= 1.5f
        if ("food" in a.tags && s.likes.any { it.contains("吃") || it.contains("甜") || it.contains("料理") }) k *= 1.25f
        SKILL_OF[a.id]?.let { k *= 1f + 0.05f * s.skill(it) }
        return max(0f, k) to why
    }
    /** skills (plan 12.4 能力): the activity gives more */
    private fun skillGain(p: Person, a: Activity, n: Need): Float { val sk = SKILL_OF[a.id] ?: return 1f; if (n == Need.FOOD || n == Need.ENERGY) return 1f; return 1f + 0.1f * p.spec.skill(sk) * (if (a.id == "tidy" && n == Need.ROOM) 1.2f else 1f) }
    /** could they do this at all (only-for tags, naps)? */
    internal fun canDo(p: Person, a: Activity) = allowed(p, a)
    private fun allowed(p: Person, a: Activity): Boolean {
        if (a.only.isNotEmpty() && a.only.none { it in mods(p).owns }) return false
        if (!p.spec.nap && (a.id == "nap" || a.id == "sofanap")) return false
        return true
    }
    private fun candidates(p: Person, dist: IntArray?, r: Rng, abstract: Boolean): List<Cand> {
        val h = hour; val isNight = night(p, h); val out = ArrayList<Cand>()
        val tired = p.need(Need.ENERGY) < 28 && Math.floorMod((sleepOf(p) - h.toInt()), 24) <= 3   /* very tired: bed a little early instead of a late nap (R1 L2) */
        val potFresh = life.soc.pot?.let { life.minute - it.minute < 240 } == true || life.people.any { it !== p && it.act == "cook" }
        for (a in Acts.ALL.values) {
            if (a.night && !isNight && !(a.id == "sleep" && tired)) continue
            if (!a.inHours(h)) continue
            if (a.id == "cook" && (potFresh || (p.need(Need.FOOD) > 45 && !society.mealTime()))) continue   /* one pot at a time, and only when it is time to eat (R1 L1) */
            if (a.day && isNight) continue
            if (a.id == "meal" && p.next != "meal" && !society.canEat(p)) continue
            if (a.id == "tidy" && p.need(Need.ROOM) > 70) continue
            if (a.id == "dishes" && life.soc.dishes <= 0) continue
            if (a.id == "queue") { if (!abstract && dist != null && !isNight) society.queueCand(p, dist, out); continue }
            if (a.weather.isNotEmpty() && weather() !in a.weather) continue
            if (a.id == "craft" && life.town.jobs.none { it.maker == p.id }) continue
            if (a.id == "outing") { townLife.outingCand(p, a, dist, r, abstract, isNight, out); continue }
            if (!allowed(p, a)) continue
            if (a.id == "chat") { if (!abstract && dist != null) society.socialCands(p, a, dist, r, isNight, out); continue }
            var (g, why) = gain(p, a)
            if (a.id == "sleep") { g += 30f; why = listOf("到了睡覺的時間") + why }
            if (isNight && a.id != "sleep" && a.id != "snack") g *= 0.25f
            val (k, pw) = appeal(p, a); g *= k; if (pw != null) why = why + pw
            if (life.minute - (p.recent[a.id] ?: -1e9) < 120) g *= 0.4f
            if (a.id !in ROUTINE) { val n = p.today[a.id] ?: 0; g *= if (n == 0) 1.25f else 1f / (1f + 0.6f * n) }   /* the same thing over and over gets boring; something new today is nice (R1 L3) */
            if (g <= 0.05f) continue
            val exHere = society.extra(p, a, roomOf(p))
            if (a.kind == null) {
                g *= exHere.first; exHere.second?.let { why = listOf(it) + why }
                val tiles = grid.walkableTiles(house.rooms.indexOfFirst { it.id == roomOf(p) }.coerceAtLeast(0)); if (tiles.isEmpty()) continue
                val t = tiles[r.nextInt(tiles.size)]; val d = dist?.get(t.second * grid.w + t.first) ?: 0; if (dist != null && d < 0) continue
                out += Cand(a, -1, -1, t.first + 0.5f, t.second + 0.5f, g / (1f + d / 14f) * (0.85f + 0.3f * r.nextFloat()), why); continue
            }
            house.pieces.forEachIndexed { pi, piece ->
                if (!fits(a.kind, piece.kind)) return@forEachIndexed
                if (a.sameRoomAs != null && house.pieces.none { it.kind == a.sameRoomAs && it.room == piece.room }) return@forEachIndexed
                if (a.id in SLEEPY && a.kind == "bed" && piece.room != p.room) return@forEachIndexed   /* only one's own bed (single or double) */
                val k2 = Furniture.kind(piece.kind)
                k2.slots.forEachIndexed { si, s ->
                    val who = reserved["$pi:$si"]; if (who != null && who != p.id) return@forEachIndexed
                    val sx = piece.x + s.dx; val sy = piece.y + s.dy
                    val d = if (dist == null) 0 else { val (ax, ay) = approach(sx, sy); dist[ay * grid.w + ax] }
                    if (d < 0) return@forEachIndexed
                    val near = if (dist != null && d <= 3) listOf("剛好在附近") else emptyList()
                    val ex = if (piece.room == roomOf(p)) exHere else society.extra(p, a, piece.room)
                    out += Cand(a, pi, si, sx, sy, g * ex.first / (1f + (if (abstract) 0 else d) / 14f) * (0.85f + 0.3f * r.nextFloat()), listOfNotNull(ex.second) + why + near)
                }
            }
        }
        return out
    }
    internal fun free(q: Person): Boolean {
        val b = body(q.id); if (q.desk || q.out != null || b.held || b.flying || b.petting || q.with != null || life.arriving || society.hiding(q.id) != null) return false
        val a = q.act ?: return true
        return b.arrivedAct && a in INTERRUPTIBLE
    }
    internal fun besideOf(q: Person, from: Person): Pair<Int, Int>? {
        val qx = q.x.toInt(); val qy = q.y.toInt(); var best: Pair<Int, Int>? = null; var bd = Float.MAX_VALUE
        for ((dx, dy) in listOf(1 to 0, -1 to 0, 0 to 1, 0 to -1, 1 to 1, -1 to 1)) { val x = qx + dx; val y = qy + dy
            if (!grid.walkable(x, y) || grid.roomIndex(x, y) != grid.roomIndex(qx, qy)) continue
            val dd = hypot(x - from.x, y - from.y); if (dd < bd) { bd = dd; best = x to y } }
        return best
    }
    private fun approach(sx: Float, sy: Float): Pair<Int, Int> { val tx = sx.toInt(); val ty = sy.toInt(); return if (grid.walkable(tx, ty)) tx to ty else grid.nearestWalkable(sx, sy) }
    private fun pick(c: List<Cand>, r: Rng): Cand? { val top = c.sortedByDescending { it.score }.take(3); if (top.isEmpty()) return null; return r.weighted(top) { (it.score * it.score).toDouble() } }

    private fun decide(p: Person, b: Body) {
        val tx = p.x.toInt(); val ty = p.y.toInt()
        val dist = grid.distances(tx, ty)
        if (p.order != null && society.followOrder(p, dist)) return
        val c = candidates(p, dist, rng, false); val best = pick(c, rng)
        if (best == null || best.score < 1.2f) { idle(p, b); return }
        p.plan.firstOrNull()?.let { step -> if (best.act.id != step) { b.planMiss++; if (b.planMiss >= 5) { b.planMiss = 0; society.planSkipped(p) } } else b.planMiss = 0 }
        if (!commit(p, best, null)) idle(p, b)
    }
    /** start walking to a chosen candidate (and call the partner over); false when there is no way there */
    internal fun commit(p: Person, best: Cand, why: List<String>?): Boolean {
        val b = body(p.id); val tx = p.x.toInt(); val ty = p.y.toInt()
        if (best.piece >= 0) reserved["${best.piece}:${best.slot}"] = p.id
        p.act = best.act.id; p.actPiece = best.piece; p.actSlot = best.slot; p.why = (why.orEmpty() + best.why).distinct().take(2).ifEmpty { listOf("想做就做") }
        b.arrivedAct = false; b.micro = null
        val (ax, ay) = approach(best.tx, best.ty)
        val tiles = grid.path(tx, ty, ax, ay)
        if (tiles == null) { release(p); p.act = null; return false }
        b.path = ArrayList(tiles.drop(1).map { floatArrayOf(it.first + 0.5f, it.second + 0.5f) }).apply { add(floatArrayOf(best.tx, best.ty)) }
        b.pose = Pose.WALK
        p.soc = best.soc
        best.partner?.let { qid -> val q = person(qid)!!; p.with = qid; stopFor(q); q.act = "chat"; q.with = p.id; q.soc = null; q.why = listOf("${p.name}來找${q.spec.pronoun}"); body(qid).waitT = 0f; body(qid).pose = Pose.STAND }
        return true
    }
    /** the best way to do one particular activity now (your suggestions), or null */
    internal fun candidatesFor(p: Person, dist: IntArray, actId: String): Cand? = candidates(p, dist, rng, false).filter { it.act.id == actId && it.partner == null }.maxByOrNull { it.score }
    /** `a` goes to `b` for a social act or an event (`soc`); both must be free */
    internal fun startTogether(a: Person, b: Person, soc: String, why: List<String>): Boolean {
        if (!free(a) || !free(b) || a === b) return false
        val (tx, ty) = besideOf(b, a) ?: return false
        stopFor(a)
        return commit(a, Cand(Acts["chat"]!!, -1, -1, tx + 0.5f, ty + 0.5f, 1f, why, b.id, soc), why)
    }
    /** your suggestion was accepted: stop what they are doing (not sleep, not being held) and decide again right away */
    internal fun nudge(p: Person) { val b = body(p.id); if (asleep(p) || b.held || b.flying || p.desk) return; if (p.with != null) return; release(p); p.act = null; b.arrivedAct = false; b.path = null; b.micro = null; b.pose = Pose.STAND; unstick(p); b.think = 0.2f }
    /** stop everything (a minigame with you) */
    internal fun breakFor(p: Person) { breakChat(p); stopFor(p) }
    /** stop what they are doing to talk */
    private fun stopFor(q: Person) { release(q); q.act = null; val b = body(q.id); b.arrivedAct = false; b.path = null; b.micro = null; b.pose = Pose.STAND; unstick(q) }
    /** someone who stopped on a piece of furniture steps off it */
    private fun unstick(p: Person) { if (!grid.walkable(p.x.toInt(), p.y.toInt())) { val (x, y) = grid.nearestWalkable(p.x, p.y); p.x = x + 0.5f; p.y = y + 0.5f } }
    private fun idle(p: Person, b: Body) {
        p.why = emptyList()
        val low = Need.values().filter { it != Need.ROOM && p.need(it) < 35 }
        val pool = ArrayList(Micros.ALL.filter { it.needs == null || it.needs in low })
        for (q in p.spec.quirks) Catalog.QUIRKS[q]?.fx?.micro?.let { m -> val mm = Micro("quirk:$q", m.pose, m.sec, m.line, prop = m.prop); repeat(6) { pool += mm } }   /* quirks show often */
        if (p.affinity < 40) pool.removeAll { it.needs == Need.ATTENTION }                                                                           /* not close: does not seek you */
        else if (p.affinity >= 70) repeat(3) { pool += Micros.ALL.first { it.id == "wave" } }
        if (p.affinity >= 65 && rng.chance(p.affinity / 400.0) && comeToYou(p, b)) return
        if (rng.chance(0.55)) {
            val m = rng.pick(pool); b.micro = m; b.microT = m.sec; b.pose = m.pose; b.poseT = 0f
            if (m.line != null && rng.chance(0.6)) say(p, m.line, toPlayer = m.needs == Need.ATTENTION)
            else if (rng.chance(0.3)) Speech.idle(p.spec, rng, life.tags)?.let { events += SimEvent("say", p.id, it) }
        } else {
            val tiles = grid.walkableTiles(house.rooms.indexOfFirst { it.id == roomOf(p) }.coerceAtLeast(0))
            if (tiles.isNotEmpty()) { val t = tiles[rng.nextInt(tiles.size)]; grid.path(p.x.toInt(), p.y.toInt(), t.first, t.second)?.let { path -> b.path = ArrayList(path.drop(1).map { floatArrayOf(it.first + 0.5f, it.second + 0.5f) }); b.pose = Pose.WALK } }
        }
        b.think = 3f + rng.nextFloat() * 5f
    }
    /** close to you: walks to the front of the room (nearest the screen) and waves (plan A-13) */
    private fun comeToYou(p: Person, b: Body): Boolean {
        val tiles = grid.walkableTiles(house.rooms.indexOfFirst { it.id == roomOf(p) }.coerceAtLeast(0)); if (tiles.isEmpty()) return false
        val front = tiles.maxOf { it.second }; val t = tiles.filter { it.second == front }.minByOrNull { abs(it.first + 0.5f - p.x) } ?: return false
        val path = grid.path(p.x.toInt(), p.y.toInt(), t.first, t.second) ?: return false
        if (path.size <= 1) return false
        b.path = ArrayList(path.drop(1).map { floatArrayOf(it.first + 0.5f, it.second + 0.5f) }); b.pose = Pose.WALK; p.why = listOf("想見你")
        say(p, rng.pick(Lines.M["come"]!!), toPlayer = true); pendingWave += p.id; b.think = 4f; return true
    }
    private val pendingWave = HashSet<String>()
    private fun arrive(p: Person, b: Body) {
        val home = house.room(p.room); val tiles = grid.walkableTiles(house.rooms.indexOf(home))
        val t = if (tiles.isEmpty()) grid.nearestWalkable(p.x, p.y) else tiles[rng.nextInt(tiles.size)]
        grid.path(p.x.toInt(), p.y.toInt(), t.first, t.second)?.let { path -> b.path = ArrayList(path.drop(1).map { floatArrayOf(it.first + 0.5f, it.second + 0.5f) }); b.pose = Pose.WALK }
        arrived += p.id; say(p, p.spec.greeting.ifBlank { rng.pick(Lines.M["arrive"]!!) }); p.why = listOf("搬進新家")
        log(p, "搬進了${house.room(p.room).zh}")
        b.think = 2f
    }
    fun speedOf(p: Person) = SPEED * mods(p).speed * (society.statusOf(p)?.speed ?: 1f)
    private fun walk(p: Person, b: Body, dt: Float) {
        val path = b.path!!; var left = speedOf(p) * dt
        while (left > 0 && path.isNotEmpty()) {
            val t = path[0]; val dx = t[0] - p.x; val dy = t[1] - p.y; val d = hypot(dx, dy)
            if (abs(dx) > 0.05f) p.facing = if (dx > 0) 1 else -1
            if (d <= left) { p.x = t[0]; p.y = t[1]; path.removeAt(0); left -= d } else { p.x += dx / d * left; p.y += dy / d * left; left = 0f }
        }
        b.pose = Pose.WALK
        if (path.isEmpty()) {
            b.path = null
            val a = p.act?.let { Acts[it] }
            if (a != null) begin(p, b, a)
            else if (pendingWave.remove(p.id)) { val m = Micros.ALL.first { it.id == "wave" }; b.micro = m; b.microT = m.sec; b.pose = m.pose }
            else { b.pose = Pose.STAND; b.think = max(b.think, 1f) }
        }
    }
    /** how long an activity takes them (game minutes) */
    fun durationOf(p: Person, a: Activity): Double { var k = mods(p).duration.toDouble(); if (a.id == "cook") k *= 1.0 - 0.06 * p.spec.skill("料理"); return a.min * k }
    private fun begin(p: Person, b: Body, a: Activity) {
        b.arrivedAct = true; b.pose = a.pose; b.poseT = 0f
        p.actStart = life.minute
        p.actEnd = if (a.id == "chat") life.minute + 1e6 else if (a.id == "sleep") life.minute + minutesUntil(wakeOf(p).toDouble()) + p.spec.oversleep * 90 + rng.nextInt(20) else life.minute + durationOf(p, a) * (0.85 + 0.3 * rng.nextDouble())
        if (a.pose == Pose.LIE || a.pose == Pose.SIT) Furniture.kind(house.pieces.getOrNull(p.actPiece)?.kind ?: "rug").let { if (it.id == "sofa" || it.id == "table") p.facing = 1 }
        if (a.id in mods(p).hate) { addMood(p, "hate"); say(p, "……雖然不想，還是${a.zh}吧。") }
        if (a.id == "queue") { addMood(p, "waiting"); say(p, rng.pick(listOf("還沒好嗎？", "我也要用浴室……", "（敲敲門）"))) }
        if (a.id == "outing") { townLife.leave(p); return }
        if (a.id == "sleep") journal.dream(p)
        if (a.id == "chat") startChat(p, b)
    }
    private fun minutesUntil(h: Double): Double { val now = hour; var d = (h - now) * 60; if (d <= 0) d += 1440; return d }
    private fun finish(p: Person, a: Activity) {
        if (a.id == "chat") { endChat(p, true); return }
        release(p); p.recent[a.id] = life.minute; p.today[a.id] = (p.today[a.id] ?: 0) + 1
        a.finish?.let { addMood(p, it) }
        if (a.id == "sleep") { if (p.need(Need.ENERGY) < 60) { p.moods.removeAll { it.id == "slept" }; addMood(p, "badsleep") }; say(p, rng.pick(Lines.M["wake"]!!)) }
        memory(p, a, rng)
        hooks(p, a, rng)
        p.act = null; p.why = emptyList()
        if (a.id == "cook") p.next = "meal" else if (a.id == "meal") p.next = null
        val b = body(p.id); b.arrivedAct = false; b.pose = Pose.STAND; b.think = 1f + rng.nextFloat() * 2f
        if (a.kind != null) { val (ax, ay) = approach(p.x, p.y); if (!grid.walkable(p.x.toInt(), p.y.toInt())) { p.x = ax + 0.5f; p.y = ay + 0.5f } }
    }
    /** what finishing an activity means for the household (the pot, chores, the plan, today's status) */
    private fun hooks(p: Person, a: Activity, r: Rng) {
        if (a.id == "cook" || a.id == "bake") society.cooked(p, a, r)
        if (a.id == "meal") society.ate(p)
        if (a.id == "dishes" || a.id == "tidy") society.chore(p, a.id)
        if (a.id == "sleep") { society.woke(p); if (!catching) journal.woke(p) }
        society.actDone(p, a.id)
        journal.actDone(p, a)
    }
    internal fun release(p: Person) { reserved.entries.removeAll { it.value == p.id } }
    /** the timeline (plan K-03); favourites are never dropped */
    internal fun log(p: Person, text: String, away: Boolean = false, kind: String = "life", weight: Int = 1, cause: Int = -1, with: String = "", sound: String = "", aside: String = "", dur: Double = 0.0, at: Double = life.minute) {
        life.log += LogLine(at, p.id, "${p.name}：$text", away || catching, kind, weight, cause = cause, with = with, sound = sound, aside = aside, dur = dur)
        trimLog()
    }
    private var catching = false
    /** a line in this character's own way of talking; quietly when someone sleeps in the same room (plan B-08) */
    internal fun say(p: Person, base: String, toPlayer: Boolean = false) {
        if (catching) return
        var t = Speech.say(p.spec, base, rng, p.affinity, toPlayer)
        if (!t.startsWith("（") && life.people.any { it !== p && asleep(it) && roomOf(it) == roomOf(p) }) t = "（小聲）$t"
        events += SimEvent("say", p.id, t)
    }

    // ---------------- chatting (two people; plan 4.4, the first small piece of M4) ----------------
    fun rel(a: String, b: String): Rel? = life.rels.firstOrNull { it.from == a && it.to == b }
    /** set one direction of a relationship; refused (with the reason) when it breaks a rule (romance off, minors) */
    fun setRel(r: Rel): String? {
        val a = person(r.from)?.spec ?: return "沒有這個人"; val b = person(r.to)?.spec ?: return "沒有這個人"
        Relations.problem(r, a, b, life.romance)?.let { return it }
        life.rels.removeAll { it.from == r.from && it.to == r.to }; life.rels += r; return null
    }
    private fun waitForChat(q: Person, b: Body, dt: Float) {
        b.waitT += dt; val p = q.with?.let { person(it) }
        if (p == null || p.with != q.id || p.act != "chat" || b.waitT > 25f) { q.act = null; q.with = null; q.why = emptyList(); if (p != null && p.with == q.id) { p.act = null; p.with = null; p.soc = null; body(p.id).path = null; body(p.id).pose = Pose.STAND; body(p.id).think = 1f }; b.think = 1f; return }
        if (abs(p.x - q.x) > 0.05f) q.facing = if (p.x > q.x) 1 else -1
    }
    private fun startChat(p: Person, b: Body) {
        val q = p.with?.let { person(it) }
        if (q == null || q.with != p.id) { p.act = null; p.with = null; b.arrivedAct = false; b.pose = Pose.STAND; b.think = 1f; return }
        val qb = body(q.id); qb.arrivedAct = true; qb.pose = Pose.TALK; q.actStart = p.actStart; q.actEnd = p.actEnd
        p.facing = if (q.x > p.x) 1 else -1; q.facing = -p.facing
        society.startScene(p, q)
    }
    private fun talk(p: Person, b: Body, dt: Float) { if (society.play(p, dt)) endChat(p, true) }
    private fun endChat(p: Person, done: Boolean) {
        val q = p.with?.let { person(it) }
        society.finishScene(p.id, done)
        for (x in listOfNotNull(p, q)) { release(x); unstick(x); x.act = null; x.with = null; x.soc = null; x.why = emptyList(); val xb = body(x.id); xb.arrivedAct = false; xb.pose = Pose.STAND; xb.think = 1f + rng.nextFloat() * 2f; x.recent["chat"] = life.minute }
    }
    /** someone picked up / fed in the middle of a chat: the other one stops too */
    private fun breakChat(p: Person) { if (p.with != null || p.act == "chat") endChat(p, false) }

    // ---------------- touch (plan E-01…E-03) ----------------
    fun person(id: String) = life.people.firstOrNull { it.id == id }
    /** a finger rubbing back and forth on the character (seconds of real stroking); `part` = where (頭 / 身體 / 耳朵 / 尾巴) */
    fun pet(id: String, sec: Float, part: String = "身體") {
        val p = person(id) ?: return; val b = body(id); if (b.held || b.flying) return
        b.petting = true; b.petAcc += sec; b.petPart = part
        if (!asleep(p)) b.pose = if (p.affinity < 25 || p.spec.shy > 0.5f) Pose.SHY else Pose.PETTED
        if (b.petAcc > 0.3f && rng.chance(sec * (if (part == p.spec.petSpot) 2.5 else 1.5))) events += SimEvent("heart", id)
    }
    /** the stroke ended: the data changes once per stroke */
    fun petEnd(id: String) {
        val p = person(id) ?: return; val b = body(id); if (!b.petting) return; b.petting = false; val acc = b.petAcc; b.petAcc = 0f
        if (!asleep(p)) b.pose = restPose(p)
        if (acc < 0.5f) return
        val cool = life.minute - p.lastPet < 10; val part = b.petPart; val s = p.spec
        if (asleep(p)) { addMood(p, "pettedsleep"); say(p, rng.pick(Lines.M["pettedsleep"]!!)); p.lastPet = life.minute; return }
        if (part == "尾巴" && s.petSpot != "尾巴" && s.temper > 0.3f) { addMood(p, "annoyed"); say(p, rng.pick(Lines.M["annoyed"]!!), toPlayer = true); p.affinity = (p.affinity - 1).coerceIn(0, 100); return }
        val spot = part == s.petSpot
        var gainA = min(40f, acc * 12f) * (if (cool) 0.3f else 1f) * (if (spot) 1.5f else 1f) * (if (p.affinity < 25) 0.6f else 1f)
        p.setNeed(Need.ATTENTION, p.need(Need.ATTENTION) + gainA); p.setNeed(Need.SOCIAL, p.need(Need.SOCIAL) + min(15f, acc * 4f))
        p.lastPet = life.minute
        if (!cool) p.affinity = (p.affinity + if (spot) 3 else 2).coerceIn(0, 100)
        society.petted(p, part)
        townLife.goal("pet", p.id)
        when {
            spot -> { addMood(p, "spot"); say(p, rng.pick(Lines.M["spot"]!!), toPlayer = true)
                if (part !in p.found) { p.found += part; log(p, "發現了：${p.name}最喜歡被摸${part}") } }
            p.affinity < 25 -> { addMood(p, "petted"); say(p, rng.pick(Lines.M["stranger"]!!), toPlayer = true) }
            else -> { addMood(p, "petted"); say(p, rng.pick(Lines.M["petted"]!!), toPlayer = true); if (!cool) log(p, "被你摸摸了，${s.pronoun}很開心") }
        }
    }
    /** picked up: whatever it was doing stops (sleep → woken up) */
    fun lift(id: String) {
        val p = person(id) ?: return; val b = body(id); breakChat(p)
        if (asleep(p)) { addMood(p, "badsleep"); p.moods.removeAll { it.id == "slept" } }
        release(p); p.act = null; p.why = emptyList(); b.arrivedAct = false; b.path = null; b.micro = null
        b.held = true; b.flying = false; b.z = 1.1f; b.pose = Pose.HELD
        if ("height" in mods(p).flags) { addMood(p, "scared"); p.affinity = (p.affinity - 2).coerceIn(0, 100); say(p, rng.pick(Lines.M["scared"]!!), toPlayer = true) }
        else { addMood(p, "lifted"); say(p, rng.pick(Lines.M["lifted"]!!), toPlayer = true) }
        events += SimEvent("sound", id, "lift")
    }
    fun hold(id: String, x: Float, y: Float) { val p = person(id) ?: return; if (!body(id).held) return; if (abs(x - p.x) > 0.02f) p.facing = if (x > p.x) 1 else -1; p.x = x.coerceIn(0f, house.w.toFloat()); p.y = y.coerceIn(0f, house.h.toFloat()) }
    /** let go with a velocity (tiles per second): a gentle drop, or a throw with an arc and a bounce */
    fun drop(id: String, vx: Float, vy: Float) {
        val p = person(id) ?: return; val b = body(id); if (!b.held) return
        b.held = false; b.flying = true; b.bounced = false
        val sp = hypot(vx, vy); val k = min(1f, 9f / max(sp, 0.001f))
        b.vx = vx * k * 0.6f; b.vy = vy * k * 0.6f; b.vz = min(7f, sp * 0.35f); b.pose = Pose.FLY
        if (sp > 4f) { say(p, rng.pick(Lines.M["thrown"]!!)); events += SimEvent("sound", id, "whoosh") }
        b.petAcc = sp
    }
    /** how they take being thrown: fun, dizzy or angry (personality, tags, temper) */
    fun throwReaction(p: Person): String = when { "dizzy" in mods(p).flags -> "dizzy"; p.spec.axis(Axis.ACTIVE) > 0.25f || p.spec.has("不怕痛") -> "fun"; p.spec.temper > 0.3f -> "angry"; else -> "dizzy" }
    private fun fly(p: Person, b: Body, dt: Float) {
        p.x += b.vx * dt; p.y += b.vy * dt; b.vz -= G * dt; b.z += b.vz * dt
        p.x = p.x.coerceIn(0.5f, house.w - 0.5f); p.y = p.y.coerceIn(0.5f, house.h - 0.5f)
        if (b.z <= 0f) {
            b.z = 0f
            if (!b.bounced && b.vz < -5f) { b.bounced = true; b.vz = -b.vz * 0.35f; b.vx *= 0.5f; b.vy *= 0.5f; events += SimEvent("sound", p.id, "bounce"); return }
            b.flying = false; val strong = b.petAcc > 4f; b.petAcc = 0f
            if (!grid.walkable(p.x.toInt(), p.y.toInt())) { val (tx, ty) = grid.nearestWalkable(p.x, p.y); p.x = tx + 0.5f; p.y = ty + 0.5f }
            events += SimEvent("sound", p.id, "land")
            if (strong) landReaction(p, b) else { b.pose = Pose.STAND }
            b.think = 1.5f
        }
    }
    /** after a hard landing: fun, dizzy or angry (personality); the same at home and on the desktop */
    private fun landReaction(p: Person, b: Body) {
            run {
                val how = throwReaction(p)
                when (how) {
                    "fun" -> { addMood(p, "thrownfun"); p.affinity = (p.affinity + 1).coerceIn(0, 100) }
                    "angry" -> { addMood(p, "thrown"); addMood(p, "angry"); p.affinity = (p.affinity - 5).coerceIn(0, 100) }
                    else -> { addMood(p, "thrown"); addMood(p, "dizzy"); p.affinity = (p.affinity - 3).coerceIn(0, 100) }
                }
                val m = Micro("landed", when (how) { "fun" -> Pose.HAPPY; "angry" -> Pose.ANGRY; else -> Pose.DIZZY }, 2.2f); b.micro = m; b.microT = m.sec; b.pose = m.pose
                say(p, when (how) { "fun" -> "再一次！"; "angry" -> rng.pick(Lines.M["angry"]!!); else -> rng.pick(Lines.M["landed"]!!) }, toPlayer = true)
                log(p, when (how) { "fun" -> "被丟出去，覺得很好玩"; "angry" -> "被丟出去，生氣了"; else -> "被丟出去，頭暈了" })
            }
    }

    // ---------------- the desktop (plan 2.3 / M3): the same person, watched on the phone's desktop ----------------
    /** go out to the desktop: whatever they were doing stops; at home they are simply not there */
    fun toDesk(id: String): Boolean {
        val p = person(id) ?: return false; if (p.desk) return true
        breakChat(p); release(p); p.act = null; p.why = listOf("在手機桌面上"); val b = body(id); b.path = null; b.micro = null; b.arrivedAct = false; b.held = false; b.flying = false
        p.desk = true; log(p, "跑到手機桌面上了"); say(p, rng.pick(Lines.M["deskOut"]!!), toPlayer = true); return true
    }
    /** back home: they come in through the front door */
    fun fromDesk(id: String) {
        val p = person(id) ?: return; if (!p.desk) return
        p.desk = false; val b = body(id); b.held = false; b.flying = false; b.deskSleep = false; b.petting = false; b.pose = Pose.STAND; b.think = 1f
        p.x = house.entrance.x + 0.5f; p.y = house.entrance.y + 0.5f; p.why = emptyList(); log(p, "從桌面回家了"); say(p, rng.pick(Lines.M["deskBack"]!!))
    }
    /** a line on the desktop, in their own way of talking */
    fun deskSay(id: String, key: String) { val p = person(id) ?: return; Lines.M[key]?.let { say(p, rng.pick(it), toPlayer = true) } }
    /** picked up / landed on the desktop: the same feelings as at home */
    fun deskLift(id: String) { val p = person(id) ?: return; if (!p.desk) return; lift(id) }
    fun deskLand(id: String, strong: Boolean) { val p = person(id) ?: return; val b = body(id); b.held = false; b.flying = false; b.z = 0f; if (strong) landReaction(p, b) }
    /** asleep on the desktop (energy comes back like a nap) */
    fun deskRest(id: String, sleeping: Boolean) { val p = person(id) ?: return; body(id).deskSleep = sleeping && p.desk }
    val onDesk: List<Person> get() = life.people.filter { it.desk }
    /** what one of your snacks tastes like to them: 1 liked, 0 fine, −1 disliked */
    fun taste(p: Person, food: String): Int {
        val f = foodOf(food) ?: return 0; val cat = f.cat; val zh = f.zh
        if (p.spec.dislikes.any { cat.contains(it) || it.contains(cat) || it.contains(zh) }) return -1
        if (p.spec.likes.any { cat.contains(it) || it.contains(cat) || it.contains(zh) }) return 1
        return p.spec.tastes[f.taste] ?: 0
    }
    /** a snack you can give: the three built-in ones, or a food / drink the player made ("item:<id>", plan 12.6) */
    class Food(val cat: String, val full: Float, val zh: String, val taste: String)
    fun foodOf(food: String): Food? {
        if (food.startsWith("item:")) { val it0 = life.items.firstOrNull { "item:" + it.id == food && (it.kind == "food" || it.kind == "drink") } ?: return null
            return Food(if (it0.kind == "drink") "飲料" else "料理", it0.full.coerceIn(5f, 60f), it0.name, it0.taste) }
        app.ocshimeji.sim.town.Goods.ALL[food]?.takeIf { it.kind == "food" }?.let { g -> return Food(if (g.taste == "苦" || g.id == "juice") "飲料" else "料理", g.full, g.zh, g.taste) }
        val (cat, full) = FOODS[food] ?: return null; return Food(cat, full, FOOD_ZH[food] ?: food, FOOD_TASTE[food] ?: "")
    }
    /** every snack you can give in this world */
    val snacks: List<Pair<String, String>> get() = FOOD_ZH.entries.map { it.key to it.value } + life.items.filter { it.kind == "food" || it.kind == "drink" }.map { "item:${it.id}" to it.name } +
        life.bag.entries.filter { app.ocshimeji.sim.town.Goods.ALL[it.key]?.kind == "food" }.map { it.key to "${app.ocshimeji.sim.town.Goods.ALL[it.key]!!.zh} ×${it.value}" }
    /** player's snacks: the three everyday ones and your own recipes are always there; what you bought in town comes out of the bag */
    fun feed(id: String, food: String): String {
        val p = person(id) ?: return ""; val f = foodOf(food) ?: return ""; val b = body(id)
        if (b.held || b.flying) return ""
        if (p.out != null) return "${p.name}去小鎮了"
        val bought = app.ocshimeji.sim.town.Goods.ALL.containsKey(food)
        if (bought && economy.count(food) <= 0) return "背包裡沒有${f.zh}了"
        if (asleep(p)) return "${p.name}睡著了"
        if (p.need(Need.FOOD) > 92) { say(p, rng.pick(Lines.M["full"]!!), toPlayer = true); return "${p.name}吃不下了" }
        breakChat(p)
        val t = taste(p, food)
        p.setNeed(Need.FOOD, p.need(Need.FOOD) + f.full * (if (t < 0) 0.5f else 1f)); p.setNeed(Need.ATTENTION, p.need(Need.ATTENTION) + 10f)
        addMood(p, when (t) { 1 -> "tasty"; -1 -> "yuck"; else -> "snack" })
        society.fed(p, food, t)
        if (bought) economy.move(food, -1, "${p.name}吃了${f.zh}", p.id)
        townLife.goal("feed", p.id)
        p.affinity = (p.affinity + when (t) { 1 -> 5; -1 -> -2; else -> 3 }).coerceIn(0, 100)
        if (p.act != null && !b.arrivedAct) { release(p); p.act = null; b.path = null }
        b.micro = Micro("eat", if (t < 0) Pose.SAD else Pose.EAT, 3f); b.microT = 3f; b.pose = b.micro!!.pose
        say(p, rng.pick(Lines.M[when (t) { 1 -> "tasty"; -1 -> "yuckfood"; else -> "snackok" }]!!), toPlayer = true); events += SimEvent("sound", id, "munch")
        log(p, "吃了你給的${f.zh}" + when (t) { 1 -> "，很喜歡"; -1 -> "，不太喜歡"; else -> "" })
        return ""
    }
    /** what they hold in their hands now (drawn by the screen) */
    fun propOf(p: Person): String? { val b = body(p.id); b.micro?.let { return it.prop }; return if (b.arrivedAct) p.act?.let { Acts[it]?.prop } else null }

    // ---------------- while you were away (plan J-05) ----------------
    /** advance to `toMinute` without a screen: 10-minute chunks, no walking, no touch, nothing that needs you; capped at 30 days */
    fun catchUp(toMinute: Double, summarize: Boolean = true): AwaySummary? {
        val from = life.minute; val to = min(toMinute, from + MAX_AWAY_MIN)
        if (to - from < 1) return null
        val counts = HashMap<String, HashMap<String, Int>>()
        for (p in life.people) { breakChat(p); body(p.id).path = null; body(p.id).micro = null; body(p.id).held = false; body(p.id).flying = false }
        catching = true
        while (life.minute < to - 1e-6) {
            val dm = min(CHUNK, to - life.minute)
            for (p in life.people) {
                val r = Rng.of(life.seed, "away:${(life.minute / CHUNK).toLong()}:${p.id}")
                val a = p.act?.let { Acts[it] }
                if (a != null && body(p.id).arrivedAct && life.minute >= p.actEnd) { counts.getOrPut(p.id) { HashMap() }.merge(a.zh, 1, Int::plus); finishQuiet(p, a) }
                if (p.act == null && !p.desk && p.out == null) {
                    val c = candidates(p, null, r, true); val best = pick(c, r)
                    if (best != null && best.score >= 1.2f) {
                        if (best.piece >= 0) reserved["${best.piece}:${best.slot}"] = p.id
                        p.act = best.act.id; p.actPiece = best.piece; p.actSlot = best.slot; p.x = best.tx; p.y = best.ty
                        body(p.id).arrivedAct = true; body(p.id).pose = best.act.pose
                        if (best.act.id == "outing") { townLife.leave(p); continue }
                        p.actStart = life.minute; p.actEnd = if (best.act.id == "sleep") life.minute + minutesUntil(wakeOf(p).toDouble()) + p.spec.oversleep * 90 + r.nextInt(20) else life.minute + durationOf(p, best.act) * (0.85 + 0.3 * r.nextDouble())
                    }
                }
            }
            society.awayChunk((life.minute / CHUNK).toLong())
            townLife.step(false)
            life.minute += dm
            for (p in life.people) { needs(p, dm); moods(p, live = false) }
            society.step(false, 0f)
        }
        catching = false
        for (p in life.people) { val a = p.act?.let { Acts[it] }; if (a != null && life.minute >= p.actEnd) { counts.getOrPut(p.id) { HashMap() }.merge(a.zh, 1, Int::plus); finishQuiet(p, a) }
            if (!grid.walkable(p.x.toInt(), p.y.toInt()) && p.act == null) { val (x, y) = grid.nearestWalkable(p.x, p.y); p.x = x + 0.5f; p.y = y + 0.5f } }
        life.arriving = false
        /* more than 30 days away (R1 T4): the rest is skipped — the clock jumps to now and the summary says so */
        val skipped = toMinute - to
        if (skipped >= 1) { life.minute = toMinute; for (p in life.people) { p.act = null; p.actPiece = -1; p.out = null; body(p.id).arrivedAct = false } }
        val lines = (if (skipped >= 1) listOf("離開太久了：超過 30 天的 ${fmtSpan(skipped)} 大家都在睡大覺，直接跳過") else emptyList()) + life.people.map { p ->
            val c = counts[p.id].orEmpty().entries.sortedByDescending { it.value }.take(3)
            if (c.isEmpty()) "${p.name}：一直在${p.act?.let { Acts[it]?.zh } ?: "休息"}" else "${p.name}：" + c.joinToString("、") { "${it.key}${if (it.value > 1) " ${it.value} 次" else ""}" }
        }
        val s = AwaySummary(from, life.minute, lines); if (!summarize) return s
        life.away = s
        life.log += LogLine(to, "", "你不在的 ${fmtSpan(to - from)} 裡：" + lines.joinToString("；"), away = true); trimLog()
        return s
    }
    /** the timeline keeps the last LOG_MAX lines; favourites and big moments are kept longest (R1: the away summary used to cut it to 300, favourites included) */
    private fun trimLog() {
        while (life.log.size > LOG_MAX) { val i = life.log.indexOfFirst { !it.fav && it.weight <= 1 && it.kind == "life" }.let { if (it >= 0) it else life.log.indexOfFirst { l -> !l.fav } }; if (i < 0) break; life.log.removeAt(i) }
    }
    /** every finished small thing is a memory: when it started, what, a sound, a line, how long (R1) */
    private fun memory(p: Person, a: Activity, r: Rng) {
        if (a.id == "chat" || a.id == "queue" || a.id == "outing") return
        if (!(a.id in NOTABLE || a.only.isNotEmpty() || Flavor.has(a.id))) return
        val (snd, aside) = Flavor.pick(a.id, r); val dur = max(1.0, life.minute - p.actStart)
        log(p, a.zh, sound = snd, aside = aside, dur = dur, at = p.actStart.takeIf { it > 0 && it <= life.minute } ?: life.minute)
    }
    private fun finishQuiet(p: Person, a: Activity) {
        memory(p, a, Rng.of(life.seed, "mem:${p.id}:${life.minute.toLong()}"))
        release(p); p.recent[a.id] = life.minute; p.today[a.id] = (p.today[a.id] ?: 0) + 1; a.finish?.let { addMood(p, it) }
        hooks(p, a, Rng.of(life.seed, "quiet:${p.id}:${life.minute.toLong()}"))
        if (a.id == "cook") p.next = "meal" else if (a.id == "meal") p.next = null
        p.act = null; p.with = null; p.why = emptyList(); body(p.id).arrivedAct = false; body(p.id).pose = Pose.STAND
        if (!grid.walkable(p.x.toInt(), p.y.toInt())) { val (x, y) = grid.nearestWalkable(p.x, p.y); p.x = x + 0.5f; p.y = y + 0.5f }
    }

    companion object {
        const val STEP = 0.1f
        const val SPEED = 1.8f            /* tiles per real second */
        const val G = 30f
        const val CHUNK = 10.0            /* game minutes per catch-up step */
        const val MAX_AWAY_MIN = 30.0 * 1440
        val SLEEPY = setOf("sleep", "nap", "sofanap")
        /** what people do every day anyway (no boredom from doing them again) */
        val ROUTINE = setOf("sleep", "meal", "snack", "bathe", "chat", "queue", "outing", "dishes")
        val FURNITURE_KINDS = setOf("furniture", "rug", "plant", "decor", "toy", "sticker")
        /** the player's furniture as a furniture kind: its spots, and which built-in kinds' activities it offers */
        fun furnitureOf(i: WorldItem): app.ocshimeji.sim.house.FurnitureKind {
            val acts = i.offers.mapNotNull { when (it) { "sit" -> "sofa"; "sleep" -> "bed"; "read" -> "shelf"; "eat" -> "table"; "play" -> "rug"; "watch" -> "sofa"; "work" -> "stove"; else -> null } }.toSet()
            val slots = i.spots.map { app.ocshimeji.sim.house.Slot(it[0], it[1], when (it.getOrElse(2) { 0f }.toInt()) { 1 -> app.ocshimeji.sim.house.Spot.LIE; 2 -> app.ocshimeji.sim.house.Spot.STAND; else -> app.ocshimeji.sim.house.Spot.SIT }) }
            if (i.kind == "sticker") return app.ocshimeji.sim.house.FurnitureKind("item:" + i.id, i.name, i.w.coerceIn(1, 3), 1, false, emptyList(), image = i.image, wall = true)
            return app.ocshimeji.sim.house.FurnitureKind("item:" + i.id, i.name, i.w.coerceIn(1, 4), i.h.coerceIn(1, 4), i.kind != "rug", slots, actsAs = acts, image = i.image)
        }
        const val LOG_MAX = 1500
        val NOTABLE = setOf("sleep", "meal", "cook", "bathe", "read", "water", "tidy", "nap")
        /** what can be dropped for a chat */
        /** a double bed is a bed */
        fun fits(want: String?, kind: String) = want == kind || (want == "bed" && kind == "bed2") || (want != null && want in Furniture.kind(kind).actsAs)
        val INTERRUPTIBLE = setOf("relax", "tv", "tvrug", "sitrug", "daydream", "window", "read", "water", "primp")
        val FOODS = mapOf("cookie" to ("甜點" to 25f), "apple" to ("水果" to 30f), "milk" to ("牛奶" to 18f))
        val FOOD_ZH = mapOf("cookie" to "餅乾", "apple" to "蘋果", "milk" to "牛奶")
        val FOOD_TASTE = mapOf("cookie" to "甜", "apple" to "酸", "milk" to "甜")
        val SKILL_OF = mapOf("cook" to "料理", "meal" to "料理", "bake" to "料理", "water" to "園藝", "read" to "閱讀", "tidy" to "打掃", "chat" to "聊天")
        /** words in likes / hobbies / dislikes that point at an activity */
        val ACT_WORDS = mapOf(
            "tea" to listOf("茶", "喝茶"), "diary" to listOf("日記", "寫字"), "music" to listOf("音樂", "聽歌", "唱歌"), "stretch" to listOf("運動", "瑜伽", "伸展"),
            "phone" to listOf("手機", "網路"), "puzzle" to listOf("拼圖", "樂高", "益智"), "album" to listOf("照片", "拍照", "回憶"), "letter" to listOf("寫信", "朋友"),
            "plantchat" to listOf("植物", "花", "養花"), "hum" to listOf("唱歌", "音樂"), "fold" to listOf("家務", "洗衣"), "makebed" to listOf("整理", "家務"),
            "read" to listOf("看書", "書", "閱讀"), "tv" to listOf("電視", "電影", "節目"), "tvrug" to listOf("電視"), "cook" to listOf("煮飯", "料理", "下廚"),
            "water" to listOf("植物", "花", "園藝"), "bathe" to listOf("洗澡", "泡澡"), "window" to listOf("窗", "曬太陽", "天空", "雲"), "primp" to listOf("打扮", "鏡子", "化妝"),
            "tidy" to listOf("整理", "打掃"), "snack" to listOf("點心", "甜點", "零食", "布丁", "蛋糕"), "nap" to listOf("午睡", "睡午覺"), "relax" to listOf("沙發", "毛毯", "放鬆"),
            "meal" to listOf("吃飯"), "chat" to listOf("聊天", "朋友"), "sitrug" to listOf("地毯"), "daydream" to listOf("發呆", "想像"))
        val FEAR_FLAGS = mapOf("黑" to "dark", "一個人" to "alone", "孤單" to "alone", "高" to "height", "吵" to "crowd", "人多" to "crowd")
        fun fmtSpan(min: Double): String = when { min < 60 -> "${min.toInt()} 分鐘"; min < 1440 -> "${(min / 60).toInt()} 小時"; else -> "${(min / 1440).toInt()} 天" }
        fun affinityFrom(attitude: String) = when (attitude) { "陌生" -> 10; "有禮" -> 25; "害羞" -> 30; "黏人" -> 70; else -> 50 }

        /** a new world's life: everyone at the door, move-in day to be played */
        fun create(seed: Long, h: HouseType, tenants: List<Tenant>, rooms: Map<String, String>, libIds: Map<String, String>, specs: Map<String, CharSpec>,
                   town: String, home: String, nowMinute: Double, nowMs: Long, rels: List<Rel> = emptyList(), romance: Boolean = false): Life {
            val r = Rng.of(seed, "create")
            val life = Life(h.id, town, home, nowMinute, seed = seed, rngState = Rng.hash("live:$seed"), lastRealMs = nowMs, arriving = true, startMinute = nowMinute, romance = romance)
            for (t in tenants) {
                val spec = specs[t.id] ?: CharSpec(name = t.name, age = if (t.adult) 20 else 12)
                val p = Person(t.id, libIds[t.id] ?: t.id, spec, rooms[t.id] ?: h.bedrooms.first().id, affinity = affinityFrom(spec.attitude))
                for (n in Need.values()) p.setNeed(n, 60f + r.nextFloat() * 25f)
                p.x = h.entrance.x + 0.5f; p.y = h.entrance.y + 0.5f
                p.moods += MoodState("newhome", nowMinute + 24 * 60)
                life.people += p
            }
            val specOf = life.people.associate { it.id to it.spec }
            for (x in rels) { val a = specOf[x.from] ?: continue; val b = specOf[x.to] ?: continue; if (Relations.problem(x, a, b, romance) == null) life.rels += x }
            for (room in h.rooms) life.mess[room.id] = 5f
            Economy(life).earn(Economy.START, "開始的星幣")
            return life
        }
    }
}
