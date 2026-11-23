package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.Dims
import app.ocshimeji.sim.social.Appt
import app.ocshimeji.sim.social.First
import app.ocshimeji.sim.social.GoalRec
import app.ocshimeji.sim.social.InnerData
import app.ocshimeji.sim.social.InnerNeeds
import app.ocshimeji.sim.social.Memo
import app.ocshimeji.sim.social.Routine
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.pow

/**
 * 2.2.0 (expansion phase 2): the inner life of each resident — the needs beyond the body (time alone, feeling safe, making
 * something, getting something done, belonging, curiosity, missing someone), memories that fade and come back, first
 * impressions and chemistry, habits that form by themselves, "my seat", goals, invitations and promises, the one they think of
 * first, being changed a little by the people they love, and a personal timeline of firsts.
 *
 * Like `Drama`: every 15 game minutes and once a day, live and in catch-up, always with its own `Rng.of(seed, "inner:…")`.
 * Relationships only change through `Society.relUpdate`; personality only comes from `CharSpec` (`Dims`, traits).
 */
class Inner(private val sim: LifeSim) {
    private val life get() = sim.life
    val st get() = life.inner
    private val day get() = life.day
    private fun home() = life.people.filter { !it.desk && it.out == null }
    private fun like(a: Person, b: Person) = sim.rel(a.id, b.id)?.like ?: 30
    private fun key(a: String, b: String) = if (a < b) "$a|$b" else "$b|$a"
    /** tests: switch it off to compare */
    var enabled = true

    // ================= the clock =================
    internal fun step(live: Boolean) {
        if (life.arriving || !enabled) return
        if (st.lastDay < 0) { st.lastDay = day; firstLook() }
        if (day != st.lastDay) { st.lastDay = day; newDay(live) }
        if (life.minute - st.lastTick < 15) return
        st.lastTick = life.minute
        tick(live, Rng.of(life.seed, "inner:${(life.minute / 15).toLong()}"))
    }

    // ================= #22 the inner needs =================
    fun need(p: Person, id: String): Float = st.needs[p.id]?.get(id) ?: 70f
    private fun setNeed(p: Person, id: String, v: Float) { st.needs.getOrPut(p.id) { mutableMapOf() }[id] = v.coerceIn(0f, 100f) }
    private fun add(p: Person, id: String, d: Float) = setNeed(p, id, need(p, id) + d)
    /** how much `p` needs time alone (0.3 … 2) */
    fun aloneNeed(p: Person): Float { val s = p.spec; var k = 1f + 0.8f * s.dim("獨立") - 0.4f * s.dim("外向"); if (s.has("獨行俠") || s.has("獨立")) k += 0.4f; if (s.has("愛熱鬧") || s.has("怕寂寞")) k -= 0.4f; return k.coerceIn(0.3f, 2f) }

    private fun tick(live: Boolean, r: Rng) {
        val here = home(); val h = 0.25f
        for (p in life.people) {
            if (p.desk || p.out != null) continue
            val s = p.spec; val asleep = sim.asleep(p); val room = sim.roomOf(p)
            if (asleep) { add(p, "SAFETY", 3f); add(p, "ALONE", 2f); continue }
            val company = here.count { it !== p && !sim.asleep(it) && sim.roomOf(it) == room }
            val ak = aloneNeed(p)
            add(p, "ALONE", if (company == 0) 5f else -(0.5f + 0.3f * company) * ak)
            val dark = (sim.hour >= 20 || sim.hour < 6) && sim.house.pieces.none { it.room == room && it.kind == "lamp" }
            val scary = sim.weather() == "storm" || sim.society.inFeud(p.id) || (dark && "dark" in sim.mods(p).flags)
            add(p, "SAFETY", if (scary) -3f * (1f + 0.4f * s.dim("敏感")) else if (room == p.room) 0.6f else -0.3f)
            add(p, "CREATE", -0.9f * (1f + 0.8f * s.dim("創造")).coerceAtLeast(0.2f))
            add(p, "ACHIEVE", -0.7f * (1f + 0.4f * s.dim("責任") + 0.4f * s.dim("競爭")).coerceAtLeast(0.2f))
            add(p, "BELONG", -0.7f * (1f + 0.6f * s.dim("依賴")).coerceAtLeast(0.2f) + if (company > 0) 0.4f else 0f)
            add(p, "CURIOUS", -0.9f * (1f + 0.8f * s.dim("好奇")).coerceAtLeast(0.2f))
            for (n in InnerNeeds.ALL) if (need(p, n.id) < 22f) sim.addMood(p, n.mood)
            missCheck(p, live)
            confide(p, live, r)
        }
        // being at home together
        for (a in here) for (b in here) if (a.id < b.id) st.together[key(a.id, b.id)] = life.minute
        appointments(live, r)
    }
    /** what an activity means now for the inner needs (a multiplier on its appeal; no dice) */
    fun appealK(p: Person, a: Activity): Float {
        if (!enabled) return 1f
        var k = 1f
        for ((id, acts) in InnerNeeds.PULL) { val v = need(p, id); if (v < 50f && a.id in acts) k *= 1f + (50f - v) / 50f * 0.8f }
        if (a.id == "chat" && need(p, "ALONE") < 25f && aloneNeed(p) > 1.1f) k *= 0.6f
        st.routines.firstOrNull { it.who == p.id && it.act == a.id && it.slot == slot() }?.let { k *= 1.6f }
        st.goals.firstOrNull { it.who == p.id && !it.done && a.id in it.acts && (it.long || it.day == day) }?.let { k *= if (it.long) 1.2f else 1.7f }
        st.appts.firstOrNull { it.state == "ok" && it.act == a.id && (it.from == p.id || it.to == p.id) && abs(life.minute - it.at) < 60 }?.let { k *= 2.5f }
        return k
    }
    private fun slot() = (sim.hour / 3).toInt().coerceIn(0, 7)

    // ---- missing someone (the one closest to them, away for a day)
    fun bondOf(p: Person): Person? = life.people.filter { it !== p && sim.society.feud(p.id, it.id) == null }.maxByOrNull { q ->
        val r = sim.rel(p.id, q.id); (r?.like ?: 30) + (r?.familiar ?: 30) / 2f + st.memos.filter { it.who == p.id && it.with == q.id }.sumOf { strength(it).toDouble() }.toFloat() * 5f }
        ?.takeIf { like(p, it) >= 55 }
    private fun missCheck(p: Person, live: Boolean) {
        val q = bondOf(p) ?: return
        val away = q.out != null || q.desk
        val last = st.together[key(p.id, q.id)] ?: return
        if (away && life.minute - last > 20 * 60) {
            sim.addMood(p, "missing")
            if (st.missing[p.id] != q.id) { st.missing[p.id] = q.id; sim.log(p, "好想${sim.society.nickBy(p, q)}……${q.spec.pronoun}今天都不在", kind = "life", weight = 2, with = q.id); if (live) sim.say(p, "不知道${sim.society.nickBy(p, q)}現在在做什麼。") }
        } else if (!away && st.missing[p.id] == q.id) {
            st.missing.remove(p.id); sim.addMood(p, "reunited"); sim.log(p, "${q.name}回來了，終於又見到了", kind = "social", weight = 2, with = q.id)
            note(p, q.id, "等到${q.name}回來", "warm", 1)
        }
    }

    // ================= #49 the one they think of first =================
    private fun confide(p: Person, live: Boolean, r: Rng) {
        if (sim.moodValue(p) > -3 || "confide:${p.id}:$day" in st.once) return
        val q = bondOf(p) ?: return
        if (q.desk || q.out != null || sim.asleep(q) || !r.chance(0.5)) return
        if (live) { if (!sim.free(p) || !sim.free(q)) return; if (!sim.startTogether(p, q, "deep", listOf("心情不好，想找${q.name}說說"))) return }
        st.once += "confide:${p.id}:$day"
        sim.log(p, "心情不好的時候，第一個想到的是${q.name}", kind = "social", weight = 2, with = q.id)
        if (!live) { sim.society.relUpdate(q, p) { it.copy(trust = it.trust + 3) }; sim.addMood(p, "listened") }
        first(p, "confide", "第一次對${q.name}說出心裡話")
    }

    // ================= #21 memories =================
    fun note(p: Person, with: String, what: String, emo: String, imp: Int, obj: String = ""): Memo {
        val m = Memo(st.nextId++, p.id, with, what, emo, imp.coerceIn(1, 3), life.minute, obj); st.memos += m
        if (st.memos.size > 300) st.memos.removeAt(st.memos.indexOfFirst { it.imp < 3 }.coerceAtLeast(0))
        return m
    }
    /** how strongly it is still remembered: big ones fade slowly, being recalled makes it stay */
    fun strength(m: Memo): Float {
        val days = (life.minute - max(m.minute, m.lastRecall)) / 1440.0
        val half = 3.0 * m.imp * m.imp + 4.0 * m.recalls
        val s = (m.imp * 0.5.pow(days / half)).toFloat()
        return if (m.imp >= 3) max(1f, s) else s
    }
    fun memosOf(id: String): List<Memo> = st.memos.filter { it.who == id }.sortedByDescending { strength(it) }
    /** seeing a thing (the activity they just did, the furniture it was on) brings back a memory of someone */
    private fun remind(p: Person, a: Activity) {
        val kind = sim.house.pieces.getOrNull(p.actPiece)?.kind
        val m = st.memos.filter { it.who == p.id && it.with.isNotEmpty() && it.obj.isNotEmpty() && life.minute - it.lastRecall > 1440 &&
            (a.id == it.obj || InnerData.REMIND[it.obj].orEmpty().let { s -> a.id in s || (kind != null && kind in s) }) }.maxByOrNull { strength(it) } ?: return
        if (strength(m) < 0.4f) return
        val q = sim.person(m.with) ?: return
        val r = Rng.of(life.seed, "inner:remind:${p.id}:${life.minute.toLong()}"); if (!r.chance(0.6)) return
        m.recalls++; m.lastRecall = life.minute
        sim.addMood(p, if (m.emo == "angry" || m.emo == "sad") "badchat" else "nostalgic")
        sim.log(p, "${a.zh}的時候，想起了${m.what}", kind = "life", weight = 2, with = q.id)
        if (m.emo == "warm" || m.emo == "happy") sim.society.relUpdate(p, q) { it.copy(like = it.like + 1) }
    }
    /** a social act just happened (`Society.applyAct`) */
    internal fun onSocial(p: Person, q: Person, act: String, cat: String, good: Boolean, bad: Boolean, gift: String?, giftZh: String) {
        if (!enabled) return
        if (good) { add(p, "BELONG", 6f); add(q, "BELONG", 8f) } else if (bad) add(q, "SAFETY", -6f)
        when {
            act == "gift" && good && gift != null -> { note(q, p.id, "${p.name}送的$giftZh", "warm", 2, gift.removePrefix("item:")); first(q, "gift", "第一次收到禮物（${p.name}送的$giftZh）") }
            act in setOf("comfort", "deep") && good -> { note(q, p.id, "${p.name}${if (act == "deep") "跟我談心" else "安慰我"}的那天", "warm", 2); first(p, "deep:${q.id}", "和${q.name}第一次談心") }
            (act == "argue" || cat == "衝突") && bad -> { note(q, p.id, "和${p.name}吵架", "angry", 2); first(q, "quarrel", "第一次和人吵架（${p.name}）") }
            act in setOf("apologize", "makeup") && good -> { note(p, q.id, "和${q.name}和好", "warm", 3); note(q, p.id, "和${p.name}和好", "warm", 3); first(p, "makeup", "第一次和好（${q.name}）") }
            act == "joke" && good -> note(q, p.id, "${p.name}講的笑話", "happy", 1)
        }
        first(p, "met:${q.id}", "第一次和${q.name}說話"); first(q, "met:${p.id}", "第一次和${p.name}說話")
    }
    /** an activity was finished (`LifeSim.hooks`) */
    internal fun actDone(p: Person, a: Activity) {
        if (!enabled) return
        for ((id, v) in InnerNeeds.FILL) if (a.id in v.first) add(p, id, v.second)
        if (a.id == "meal" && home().count { it !== p && it.act == "meal" } > 0) add(p, "BELONG", 10f)
        remind(p, a); habit(p, a); seat(p, a); goalStep(p, a); apptStep(p, a)
    }

    // ================= #31 habits that form by themselves =================
    private fun habit(p: Person, a: Activity) {
        if (a.id in InnerData.NOT_HABIT) return
        val sl = ((p.actStart.takeIf { it > 0 } ?: life.minute) % 1440 / 180).toInt().coerceIn(0, 7)
        val k = "${p.id}|${a.id}|$sl"; val ds = st.habDays.getOrPut(k) { mutableListOf() }
        st.routines.firstOrNull { it.who == p.id && it.act == a.id && it.slot == sl }?.let { it.last = day; return }
        if (ds.lastOrNull() != day) ds += day
        ds.removeAll { it < day - 13 }
        val s = p.spec
        var need = 5 - (if (s.dim("責任") > 0.3f) 1 else 0) - (if (s.has("規律")) 1 else 0) + (if (s.dim("衝動") > 0.3f) 1 else 0)
        val from = life.people.firstOrNull { it !== p && like(p, it) >= 65 && st.routines.any { r -> r.who == it.id && r.act == a.id } }
        if (from != null) need--
        if (ds.size >= need.coerceAtLeast(2) && st.routines.count { it.who == p.id } < 5) {
            st.routines += Routine(p.id, a.id, sl, day, day, from?.id ?: "")
            val txt = "養成了一個習慣：每天${InnerData.SLOT_ZH[sl]}${a.zh}" + (from?.let { "（跟${it.name}學的）" } ?: "")
            sim.log(p, txt, kind = "life", weight = 2, with = from?.id ?: ""); first(p, "habit", "第一個自己養成的習慣：${InnerData.SLOT_ZH[sl]}${a.zh}")
        }
    }
    fun routinesOf(id: String) = st.routines.filter { it.who == id }

    // ================= #34 my seat =================
    private fun seat(p: Person, a: Activity) {
        val piece = sim.house.pieces.getOrNull(p.actPiece) ?: return
        if (piece.kind !in InnerData.SEATS) return
        val pk = sim.pieceKey(p.actPiece); val k = "${p.id}|$pk"; st.seatUse[k] = (st.seatUse[k] ?: 0) + 1
        val owner = st.owners[pk]
        if (owner == null || owner == p.id) {
            val mine = st.seatUse[k]!!; val second = life.people.filter { it !== p }.maxOfOrNull { st.seatUse["${it.id}|$pk"] ?: 0 } ?: 0
            if (owner == null && mine >= 8 && mine >= second * 2) { st.owners[pk] = p.id; val zh = app.ocshimeji.sim.house.Furniture.kind(piece.kind).zh
                sim.log(p, "${zh}的那個位置，變成了${p.spec.pronoun}的老位子", kind = "life", weight = 2); first(p, "seat", "有了自己的老位子（$zh）") }
            return
        }
        val o = sim.person(owner) ?: return
        if (o.desk || o.out != null || sim.asleep(o)) return
        val r = Rng.of(life.seed, "inner:seat:${p.id}:${life.minute.toLong()}"); if (!r.chance(0.5)) return
        val zh = app.ocshimeji.sim.house.Furniture.kind(piece.kind).zh
        if (like(o, p) >= 70) sim.log(o, "${p.name}坐了我在${zh}的老位子……算了，讓${p.spec.pronoun}坐", kind = "social", weight = 1, with = p.id)
        else { sim.addMood(o, "myseat"); sim.society.relUpdate(o, p) { it.copy(conflict = it.conflict + 1) }; sim.log(o, "${p.name}又坐了我在${zh}的老位子", kind = "social", weight = 1, with = p.id) }
    }
    fun seatsOf(id: String): List<String> = st.owners.filterValues { it == id }.keys.map { app.ocshimeji.sim.house.Furniture.kind(it.substringBefore("@")).zh }

    // ================= #02 goals =================
    private fun goals(p: Person, r: Rng) {
        st.goals.removeAll { !it.long && it.day < day }
        val s = p.spec
        fun weight(g: InnerData.GoalDef) = 0.3f + g.dims.sumOf { max(0f, s.dim(it)).toDouble() }.toFloat() + g.traits.count { s.has(it) } * 1.2f + (if (g.skill.isNotEmpty()) s.skill(g.skill) * 0.3f else 0f)
        val can = { g: InnerData.GoalDef -> g.acts.any { id -> Acts[id]?.let { sim.canDo(p, it) && (it.kind == null || sim.house.pieces.any { pc -> LifeSim.fits(it.kind, pc.kind) }) } == true } }
        if (r.chance(0.7)) { val pool = InnerData.SHORT.filter(can); if (pool.isNotEmpty()) { val g = r.weighted(pool) { weight(it).toDouble() }!!
            st.goals += GoalRec(p.id, g.id, g.text, g.acts, g.need, day = day) } }
        if (st.goals.none { it.who == p.id && it.long }) {
            val pool = InnerData.LONG.filter(can).filter { g -> "long:${p.id}:${g.id}" !in st.once }
            if (pool.isNotEmpty()) { val g = pool.maxByOrNull { weight(it) + Rng.of(life.seed, "inner:lg:${p.id}:${it.id}").nextFloat() * 0.5f }!!
                st.goals += GoalRec(p.id, g.id, g.text, g.acts, g.need, day = day, long = true); sim.log(p, "給自己定了一個目標：${g.text}", kind = "life", weight = 2) }
        }
    }
    private fun goalStep(p: Person, a: Activity) {
        for (g in st.goals.filter { it.who == p.id && !it.done && a.id in it.acts && (it.long || it.day == day) }) {
            g.got++
            if (g.got >= g.need) { g.done = true; add(p, "ACHIEVE", if (g.long) 60f else 30f)
                if (g.long) { st.once += "long:${p.id}:${g.id}"; sim.addMood(p, "longgoal"); sim.log(p, "達成了長期目標：${g.text}", kind = "event", weight = 3); first(p, "longgoal", "第一次達成長期目標：${g.text}") }
                else { sim.addMood(p, "goaldone"); sim.log(p, "完成了今天的目標（${g.text.removePrefix("今天")}）", kind = "life", weight = 2) } }
        }
    }
    fun goalsOf(id: String) = st.goals.filter { it.who == id && (it.long || it.day == day) }

    // ================= #47 invitations and promises =================
    private fun invite(p: Person, r: Rng, live: Boolean) {
        val s = p.spec
        val k = 0.12f + 0.25f * max(0f, s.dim("主動")) + 0.15f * max(0f, s.dim("外向")) + (if (s.has("愛熱鬧") || s.has("自來熟")) 0.15f else 0f)
        if (!r.chance(k.toDouble())) return
        val qs = home().filter { it !== p && like(p, it) >= 45 && sim.society.feud(p.id, it.id) == null && st.appts.none { a -> a.state == "ok" && (a.from == it.id || a.to == it.id) } }
        if (qs.isEmpty()) return
        val q = r.weighted(qs) { like(p, it).toDouble() } ?: return
        val acts = InnerData.TOGETHER.mapNotNull { Acts[it] }.filter { a -> sim.canDo(p, a) && sim.canDo(q, a) && (a.kind == null || sim.house.pieces.any { LifeSim.fits(a.kind, it.kind) }) }
        if (acts.isEmpty()) return
        val a = r.weighted(acts) { (sim.appeal(p, it).first + sim.appeal(q, it).first).toDouble() } ?: return
        val hour = if (a.id == "stargaze") 20 + r.nextInt(3) else 10 + r.nextInt(10)
        var at = floor(life.minute / 1440) * 1440 + hour * 60.0; if (at < life.minute + 90) at += 1440
        val id = st.nextId++
        // their answer: how much they like the one asking, how they are, whether they need time alone
        val yes = like(q, p) / 100f + 0.2f * q.spec.dim("外向") - (if (need(q, "ALONE") < 30f) 0.3f else 0f) + (if (q.spec.has("老好人")) 0.3f else 0f)
        val zh = a.zh; val when_ = "${if (at - floor(life.minute / 1440) * 1440 >= 1440) "明天" else "今天"}${hour} 點"
        when {
            yes >= 0.5f -> { st.appts += Appt(id, p.id, q.id, a.id, at, "ok", made = life.minute)
                sim.log(p, "約了${q.name}$when_ 一起$zh，${q.spec.pronoun}答應了", kind = "social", weight = 2, with = q.id); if (live) sim.say(p, "${sim.society.nickBy(p, q)}，$when_ 要不要一起$zh？", to = q) }
            yes >= 0.3f -> { st.appts += Appt(id, p.id, q.id, a.id, at + 1440, "ok", moved = true, made = life.minute)
                sim.log(p, "約${q.name}一起$zh，${q.spec.pronoun}說改成隔天", kind = "social", weight = 1, with = q.id) }
            else -> { sim.addMood(p, "rejected"); sim.log(p, "約${q.name}一起$zh，被婉拒了", kind = "social", weight = 1, with = q.id) }
        }
    }
    private fun appointments(live: Boolean, r: Rng) {
        for (ap in st.appts.filter { it.state == "ok" }) {
            val a = sim.person(ap.from) ?: continue; val b = sim.person(ap.to) ?: continue
            val act = Acts[ap.act] ?: continue
            if (life.minute >= ap.at - 20 && life.minute < ap.at + 60) {
                for (x in listOf(a, b)) if (x.out == null && !x.desk && x.plan.firstOrNull() != ap.act && "plan:${ap.id}:${x.id}" !in st.once) {
                    st.once += "plan:${ap.id}:${x.id}"; x.plan.add(0, ap.act)
                    sim.log(x, "為了和${(if (x === a) b else a).name}的約定，把現在的事先放下", kind = "life", weight = 1)
                }
            }
            if (life.minute >= ap.at + 120) {   /* the window is over */
                val came = ap.doneBy.toSet()
                if (came.size >= 2) continue
                ap.state = "missed"
                val waited = listOf(a, b).firstOrNull { it.id in came || (it.out == null && !it.desk) }
                val other = if (waited === a) b else a
                if (waited != null && other.id !in came) {
                    sim.addMood(waited, "stoodup"); sim.society.relUpdate(waited, other) { it.copy(like = it.like - 2, trust = it.trust - 3) }
                    sim.log(waited, "等了${other.name}，約好的${act.zh}沒有成", kind = "social", weight = 2, with = other.id); note(waited, other.id, "被${other.name}放鴿子", "sad", 1)
                    first(waited, "stoodup", "第一次被放鴿子（${other.name}）")
                }
            }
        }
        st.appts.removeAll { it.state != "ok" && life.minute - it.at > 3 * 1440 }
    }
    private fun apptStep(p: Person, a: Activity) {
        val ap = st.appts.firstOrNull { it.state == "ok" && it.act == a.id && (it.from == p.id || it.to == p.id) && life.minute >= it.at - 30 && life.minute < it.at + 150 } ?: return
        if (p.id !in ap.doneBy) ap.doneBy += p.id
        if (ap.doneBy.size < 2) return
        ap.state = "done"
        val x = sim.person(ap.from)!!; val y = sim.person(ap.to)!!
        for ((u, v) in listOf(x to y, y to x)) { sim.addMood(u, "promise"); sim.society.relUpdate(u, v) { it.copy(like = it.like + 2, trust = it.trust + 2) }; note(u, v.id, "和${v.name}一起${a.zh}", "happy", 2, a.id) }
        sim.log(x, "和${y.name}照約定一起${a.zh}了", kind = "social", weight = 2, with = y.id)
        first(x, "promise", "第一次守住和別人的約定（${y.name}）"); first(y, "promise", "第一次守住和別人的約定（${x.name}）")
    }
    fun apptsOf(id: String) = st.appts.filter { it.state == "ok" && (it.from == id || it.to == id) }

    // ================= once a day =================
    private fun firstLook() { for (p in life.people) for (n in InnerNeeds.ALL) if (st.needs[p.id]?.get(n.id) == null) setNeed(p, n.id, 60f + Rng.of(life.seed, "inner:n:${p.id}:${n.id}").nextFloat() * 25f) }
    private fun newDay(live: Boolean) {
        val r = Rng.of(life.seed, "inner:day:$day")
        val ppl = life.people.toList()
        for (p in ppl) {
            st.needs.getOrPut(p.id) { mutableMapOf() }.let { if (it.isEmpty()) InnerNeeds.ALL.forEach { n -> it[n.id] = 70f } }
            goals(p, Rng.of(life.seed, "inner:goal:$day:${p.id}"))
            if (!p.desk && p.out == null) invite(p, Rng.of(life.seed, "inner:inv:$day:${p.id}"), live)
            st.routines.filter { it.who == p.id && it.last < day - 7 }.forEach { ro -> st.routines.remove(ro); sim.log(p, "不再每天${InnerData.SLOT_ZH[ro.slot]}${Acts[ro.act]?.zh ?: ro.act}了", kind = "life", weight = 1) }
            bonds(p)
        }
        for (a in ppl) for (b in ppl) if (a.id < b.id) pairDay(a, b, r)
        st.memos.removeAll { it.imp < 3 && strength(it) < 0.12f }
    }
    /** #03: first impressions, rapport, clashing values, two shy ones, jealousy; #45: being changed by someone close */
    private fun pairDay(a: Person, b: Person, r: Rng) {
        val pk = key(a.id, b.id); val n = sim.society.pair(a.id, b.id).n["all"] ?: 0; val before = st.pairSeen[pk] ?: n; st.pairSeen[pk] = n; val talked = n - before
        val alike = Dims.likeness(a.spec, b.spec)
        for ((x, y) in listOf(a to b, b to a)) if (st.impressions["${x.id}>${y.id}"] == null) {
            val shared = x.spec.likes.count { l -> y.spec.likes.any { it == l } } + x.spec.values.count { it in y.spec.values }
            val clash = InnerData.VALUE_CLASH.count { (u, v) -> (u in x.spec.values && v in y.spec.values) || (v in x.spec.values && u in y.spec.values) }
            val score = ((alike - 0.75f) * 24f + shared * 1.5f - clash * 2f + 2f * y.spec.dim("外向") * x.spec.dim("外向").coerceAtLeast(0f)).toInt().coerceIn(-6, 6)
            st.impressions["${x.id}>${y.id}"] = score
            if (score != 0) sim.society.relUpdate(x, y) { it.copy(like = it.like + score, fit = it.fit + score) }
            sim.log(x, "對${y.name}的第一印象：" + when { score >= 3 -> "好像很合得來"; score <= -3 -> "好像不太合"; else -> "還說不上來" }, kind = "social", weight = 1, with = y.id)
            first(x, "impress:${y.id}", "第一次對${y.name}有了印象")
        }
        if (talked > 0) {
            val gain = (talked * (alike - 0.5f) * 2f).toInt()
            if (gain != 0) { sim.society.relUpdate(a, b) { it.copy(familiar = it.familiar + gain) }; sim.society.relUpdate(b, a) { it.copy(familiar = it.familiar + gain) } }
            if (alike > 0.78f && (sim.rel(a.id, b.id)?.familiar ?: 0) >= 60 && "rapport:$pk" !in st.once) { st.once += "rapport:$pk"
                sim.log(a, "和${b.name}越來越有默契了，不用說也知道對方在想什麼", kind = "social", weight = 2, with = b.id); first(a, "rapport:${b.id}", "和${b.name}有了默契"); first(b, "rapport:${a.id}", "和${a.name}有了默契") }
        }
        // clashing values: a small friction now and then
        if (InnerData.VALUE_CLASH.any { (u, v) -> (u in a.spec.values && v in b.spec.values) || (v in a.spec.values && u in b.spec.values) } && r.chance(0.12)) {
            sim.society.relUpdate(a, b) { it.copy(conflict = it.conflict + 2) }; sim.society.relUpdate(b, a) { it.copy(conflict = it.conflict + 2) }
            sim.log(a, "和${b.name}聊到在意的事，想法不太一樣", kind = "social", weight = 1, with = b.id)
        }
        // two shy ones who like each other but cannot start talking
        fun shy(p: Person) = p.spec.shy > 0.3f || p.spec.has("害羞") || p.spec.has("慢熟") || p.spec.dim("主動") < -0.4f
        if (shy(a) && shy(b) && like(a, b) >= 55 && like(b, a) >= 55 && talked <= 1) {
            for ((x, y) in listOf(a to b, b to a)) { sim.addMood(x, "tonguetied"); sim.society.relUpdate(x, y) { it.copy(like = it.like + 1) } }
            if (r.chance(0.6)) sim.log(a, "想跟${b.name}說話，又不知道怎麼開口；${b.name}好像也一樣", kind = "social", weight = 2, with = b.id)
        }
        for ((x, y) in listOf(a to b, b to a)) { jealous(x, y, r); influence(x, y, talked, r) }
    }
    private fun jealous(x: Person, y: Person, r: Rng) {
        /* x watches y (the one they like most) spend the day with someone else */
        val s = x.spec; val k = 0.5f * s.dim("依賴") + 0.3f * s.dim("敏感") - 0.3f * s.dim("穩定") + (if (s.has("吃醋精")) 0.8f else 0f) + (if (s.has("黏人")) 0.3f else 0f)
        if (k < 0.35f || like(x, y) < 65 || bondOf(x) !== y) return
        val mine = st.pairSeen[key(x.id, y.id)] ?: 0
        val rival = life.people.filter { it !== x && it !== y }.maxByOrNull { (sim.society.pair(y.id, it.id).n["all"] ?: 0) } ?: return
        val theirs = sim.society.pair(y.id, rival.id).n["all"] ?: 0
        val ok = "jeal:${x.id}:${rival.id}:${theirs / 6}" !in st.once
        if (theirs >= mine + 4 && ok && r.chance(0.7)) {
            st.once += "jeal:${x.id}:${rival.id}:${theirs / 6}"
            sim.addMood(x, "jealous"); sim.society.relUpdate(x, rival) { it.copy(like = it.like - 2, conflict = it.conflict + 2) }
            sim.log(x, "看到${y.name}和${rival.name}那麼要好，心裡有點酸", kind = "social", weight = 2, with = rival.id); first(x, "jealous", "第一次吃醋（${y.name}和${rival.name}）")
        }
    }
    private fun influence(x: Person, y: Person, talked: Int, r: Rng) {
        val rel = sim.rel(x.id, y.id) ?: return
        if (rel.like < 65 || rel.familiar < 55 || talked <= 0) return
        val got = st.picked.getOrPut(x.id) { mutableListOf() }; if (got.size >= 3) return
        val cand = y.spec.likes.filter { it !in x.spec.likes && it !in x.spec.dislikes }
        if (cand.isEmpty() || !r.chance(0.06 * (1.0 + max(0f, x.spec.dim("依賴")) + rel.trust / 200.0))) return
        val w = r.pick(cand); got += w
        sim.editSpec(x.id, x.spec.copy(likes = x.spec.likes + w))
        sim.log(x, "受${y.name}影響，慢慢喜歡上了「$w」", kind = "social", weight = 2, with = y.id); first(x, "picked", "第一次被別人影響（${y.name}，$w）")
    }
    private fun bonds(p: Person) {
        val q = bondOf(p) ?: return
        val now = like(q, p); val was = st.bondLike["${p.id}>${q.id}"]; st.bondLike["${p.id}>${q.id}"] = now
        if (was != null && was - now >= 10) { sim.addMood(p, "drifting"); sim.log(p, "覺得和${q.name}好像變遠了", kind = "social", weight = 2, with = q.id) }
        // standing up for them in a quarrel
        for (f in life.soc.feuds) { val other = when (q.id) { f.a -> f.b; f.b -> f.a; else -> null } ?: continue; if (other == p.id) continue
            val o = sim.person(other) ?: continue; val k = "defend:${p.id}:${other}:${f.since.toLong()}"; if (k in st.once) continue; st.once += k
            sim.society.relUpdate(p, o) { it.copy(like = it.like - 2) }; sim.log(p, "站在${q.name}這邊，對${o.name}有點不滿", kind = "social", weight = 2, with = o.id) }
        if (st.once.size > 600) st.once.subList(0, 200).clear()
    }

    // ================= #40 the personal timeline =================
    fun first(p: Person, key: String, text: String) {
        if (st.firsts.any { it.who == p.id && it.key == key }) return
        st.firsts += First(p.id, life.minute, key, text)
    }
    fun timeline(id: String): List<First> = st.firsts.filter { it.who == id }.sortedBy { it.minute }
}
