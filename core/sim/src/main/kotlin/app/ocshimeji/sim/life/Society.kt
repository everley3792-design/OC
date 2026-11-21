package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.chars.Relations
import app.ocshimeji.sim.chars.Speech
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.social.Ask
import app.ocshimeji.sim.social.Beat
import app.ocshimeji.sim.social.Chemistry
import app.ocshimeji.sim.social.DayCard
import app.ocshimeji.sim.social.DayStatus
import app.ocshimeji.sim.social.DayStatuses
import app.ocshimeji.sim.social.Dishes
import app.ocshimeji.sim.social.EventDef
import app.ocshimeji.sim.social.Events
import app.ocshimeji.sim.social.Feud
import app.ocshimeji.sim.social.Gift
import app.ocshimeji.sim.social.Gifts
import app.ocshimeji.sim.social.HideSeek
import app.ocshimeji.sim.social.Mail
import app.ocshimeji.sim.social.Memory
import app.ocshimeji.sim.social.Narrate
import app.ocshimeji.sim.social.PairStat
import app.ocshimeji.sim.social.Pot
import app.ocshimeji.sim.social.Reaction
import app.ocshimeji.sim.social.Rps
import app.ocshimeji.sim.social.Script
import app.ocshimeji.sim.social.SocialAct
import app.ocshimeji.sim.social.SocialActs
import app.ocshimeji.sim.social.Spark
import app.ocshimeji.sim.social.Sparks
import app.ocshimeji.sim.social.Topics
import app.ocshimeji.sim.social.Will
import app.ocshimeji.sim.social.Wish
import app.ocshimeji.sim.social.Wishes
import app.ocshimeji.sim.social.Worries
import app.ocshimeji.sim.social.Worry
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * The social life of one world (plan M4): social acts with willingness and a reaction spectrum, topic collisions, the chemistry
 * table and clash sparks, gifts, the memory ledger, quarrels and making up, the daily settlement of relationships (two-day rule,
 * fading, flavour tags), worry bubbles, wishes, requests, today's status, cooking for everyone, chores, the event pool with a
 * disturbance budget and a mailbox, the day-end card, your suggestions and commands, and the two minigames.
 *
 * It belongs to one `LifeSim` and only moves the life through it (same clock, same Rng, same log). Scenes that are playing are not
 * saved (a reopened world starts calm), everything they change is.
 */
class Society(private val sim: LifeSim) {
    private val life get() = sim.life
    private val st get() = life.soc

    // ================= the memory ledger =================
    fun remember(who: Person, about: String, kind: String, what: String, weight: Int, cause: Int = -1): Memory {
        val m = Memory(st.nextId++, who.id, about, kind, what, life.minute, weight, cause = cause); st.memories += m
        while (st.memories.size > 400) { val i = st.memories.indexOfFirst { it.settled }.let { if (it < 0) 0 else it }; st.memories.removeAt(i) }
        return m
    }
    fun owed(who: String, about: String) = st.memories.lastOrNull { it.who == who && it.about == about && it.kind == Memory.FAVOR && !it.settled }
    fun grudge(who: String, about: String) = st.memories.lastOrNull { it.who == who && it.about == about && it.kind == Memory.GRUDGE && !it.settled }
    /** favours − grudges `who` holds about `about` */
    fun ledger(who: String, about: String): Int = st.memories.filter { it.who == who && it.about == about && !it.settled }.sumOf { when (it.kind) { Memory.FAVOR -> it.weight; Memory.GRUDGE -> -it.weight; else -> 0 } }
    fun memoriesOf(id: String): List<Memory> = st.memories.filter { it.who == id }.sortedByDescending { it.minute }

    // ================= pairs, quarrels =================
    fun pair(a: String, b: String): PairStat { val (x, y) = if (a < b) a to b else b to a; return st.pairs.firstOrNull { it.a == x && it.b == y } ?: PairStat(x, y).also { st.pairs += it } }
    private fun count(a: String, b: String, key: String, n: Int = 1) { val ps = pair(a, b); ps.n[key] = (ps.n[key] ?: 0) + n; ps.lastDay = life.day }
    fun feud(a: String, b: String): Feud? = st.feuds.firstOrNull { (it.a == a && it.b == b) || (it.a == b && it.b == a) }
    fun inFeud(id: String) = st.feuds.any { it.a == id || it.b == id }

    /** every relationship change made by life goes through the same rules as the editor's (`Relations.problem`) */
    fun relUpdate(a: Person, b: Person, f: (Rel) -> Rel) {
        val old = sim.rel(a.id, b.id) ?: Rel(a.id, b.id)
        if (old.locked) return
        var r = f(old).let { it.copy(fit = it.fit.coerceIn(0, 100), familiar = it.familiar.coerceIn(0, 100), like = it.like.coerceIn(0, 100), trust = it.trust.coerceIn(0, 100), crush = it.crush.coerceIn(0, 100), conflict = it.conflict.coerceIn(0, 100)) }
        if (Relations.problem(r, a.spec, b.spec, life.romance) != null) r = r.copy(crush = 0, kind = if (r.kind in Rel.ROMANTIC) old.kind.takeIf { it !in Rel.ROMANTIC } ?: "朋友" else r.kind, flavor = r.flavor.filter { it !in Rel.ROMANTIC_FLAVORS })
        if (Relations.problem(r, a.spec, b.spec, life.romance) != null) return
        life.rels.removeAll { it.from == a.id && it.to == b.id }; life.rels += r
    }
    /** two adults and romance on (the same rule as everywhere else) */
    fun romanceOk(a: Person, b: Person) = life.romance && a.adult && b.adult

    // ================= choosing a social act (plan C-01) =================
    class Pick(val act: SocialAct, val w: Float, val why: String)
    private fun nick(p: Person) = p.spec.nickname.ifBlank { p.name }
    fun statusOf(p: Person): DayStatus? = if (p.statusDay == life.day) DayStatuses.ALL[p.status] else null
    private fun hourIn(a: Int, b: Int): Boolean { val h = sim.hour; return if (a <= b) h >= a && h < b else h >= a || h < b }
    fun condOk(act: SocialAct, p: Person, q: Person): Boolean {
        val fe = feud(p.id, q.id) != null
        if (fe && act.cat != "和好" && act.id != "sulk") return false
        return when (act.cond) {
            "" -> true
            "morning" -> hourIn(5, 10)
            "third" -> life.people.count { !it.desk } >= 3
            "notSad" -> sim.moodValue(q) > -2
            "ateTheirCooking" -> st.pot?.let { it.cook == q.id && p.id in it.eaters && life.minute - it.minute < 180 } == true
            "owes" -> owed(p.id, q.id) != null
            "bad" -> sim.moodValue(p) <= -1
            "chores" -> st.dishes >= 2 || st.memories.any { it.who == p.id && it.about == q.id && !it.settled && it.what.contains("家事") }
            "grudge" -> (grudge(p.id, q.id)?.weight ?: 0) >= 2
            "feud" -> fe
            "wronged" -> grudge(p.id, q.id) != null
            "rival" -> sim.rel(p.id, q.id)?.kind == "對手" || p.spec.axis(Axis.GENTLE) < -0.2f
            "tvRoom" -> sim.house.pieces.any { it.kind == "tv" }
            "pot" -> st.pot?.let { it.servings > 0 && q.id !in it.eaters } == true
            "day" -> hourIn(9, 19)
            "seated" -> q.act in setOf("relax", "tv", "sofanap", "sitrug", "tvrug")
            "targetSad" -> sim.moodValue(q) <= -2
            "playerOnly" -> false
            else -> true
        }
    }
    fun chooseAct(p: Person, q: Person, r: Rng): Pick? {
        val m = sim.mods(p); val s = p.spec; val list = ArrayList<Pair<SocialAct, Float>>()
        for (act in SocialActs.ALL.values) {
            if (!condOk(act, p, q)) continue
            if (act.romance && (!romanceOk(p, q) || (act.id == "flirt" && (sim.rel(p.id, q.id)?.crush ?: 0) < 30))) continue
            var w = m.act("s:" + act.cat) * (statusOf(p)?.act?.get("s:" + act.cat) ?: 1f)
            w *= when (act.cat) {
                "聊天", "玩笑" -> 1f + 0.4f * s.axis(Axis.OUTGOING); "照顧", "和好" -> 1f + 0.5f * s.axis(Axis.GENTLE)
                "衝突" -> 0.45f - 0.4f * s.axis(Axis.GENTLE) + 0.4f * s.temper; "稱讚" -> 1f + 0.3f * s.axis(Axis.FRANK)
                "肢體" -> 1f + 0.3f * s.axis(Axis.OUTGOING) - 0.4f * s.shy; else -> 1f
            }.coerceAtLeast(0.05f)
            w *= when (act.cond) { "owes" -> 3f; "grudge" -> 1.5f + s.temper; "feud" -> 2f; "targetSad" -> 4f; "chores" -> 1.5f; "pot" -> 3f; "ateTheirCooking" -> 3f; else -> 1f }
            if (act.id in setOf("gift", "help", "bring_tea") && owed(p.id, q.id) != null) w *= 2.5f
            if (act.id == "prank" && grudge(p.id, q.id) != null && s.axis(Axis.GENTLE) < 0.4f) w *= 3f
            if (act.id == "chat") w *= 3f
            if (act.id == "apologize" || act.id == "makeup") feud(p.id, q.id)?.let { w *= 1f + ((life.minute - it.since) / 1440.0).toFloat() }
            if (life.minute - (st.seen["${act.id}:${p.id}:${q.id}"] ?: -1e9) < 240) w *= 0.2f
            if (act.id in setOf("greet", "morning") && pair(p.id, q.id).lastDay == life.day) w *= 0.15f
            list += act to w
        }
        val (act, _) = r.weighted(list) { it.second.toDouble() } ?: return null
        val qn = nick(q)
        val why = when (act.cond) {
            "owes" -> "想還${qn}人情"; "grudge" -> "還在氣${qn}"; "targetSad" -> "${qn}看起來很難過"; "chores" -> "家事又堆起來了"; "pot" -> "飯煮好了，想叫${qn}"
            "feud" -> if (act.id == "sulk") "還在跟${qn}冷戰" else "想跟${qn}和好"
            else -> if (act.id == "chat") (sim.rel(p.id, q.id)?.let { if (Rel.chatWeight(it) >= 1.4f) "想找${it.kind}${qn}聊天" else null } ?: "想跟${qn}聊聊") else "想跟${qn}${act.zh}"
        }
        return Pick(act, if (act.cond in setOf("owes", "targetSad", "feud", "grudge", "pot")) 1.3f else 1f, why)
    }

    /** someone to do something with: awake, at home, not busy with something that cannot be interrupted */
    internal fun socialCands(p: Person, a: Activity, dist: IntArray, r: Rng, isNight: Boolean, out: ArrayList<LifeSim.Cand>) {
        if (isNight || life.minute - (p.recent["chat"] ?: -1e9) < 45) return
        for (q in life.people) {
            if (q === p || !sim.free(q) || sim.isNight(q)) continue
            val (tx, ty) = sim.besideOf(q, p) ?: continue
            val d = dist[ty * sim.grid.w + tx]; if (d < 0) continue
            val pick = chooseAct(p, q, r) ?: continue
            var (g, why) = sim.gain(p, a); val (k, pw) = sim.appeal(p, a)
            var w = Rel.chatWeight(sim.rel(p.id, q.id)) * pick.w
            if (feud(p.id, q.id) != null) w = if (pick.act.cat == "和好") 1.1f else 0.1f
            g *= k * w * sim.mods(q).act("chat").coerceAtLeast(0.3f) * (statusOf(p)?.act?.get("chat") ?: 1f)
            out += LifeSim.Cand(a, -1, -1, tx + 0.5f, ty + 0.5f, g / (1f + d / 14f) * (0.85f + 0.3f * r.nextFloat()), listOf(pick.why) + why + listOfNotNull(pw), q.id, pick.act.id)
        }
    }

    // ================= scenes (what plays while two are together) =================
    class Run(val id: String, val act: SocialAct?, val a: String, val b: String, val beats: List<Beat>, val re: Reaction, val closeup: Boolean,
              val thing: String = "", val third: String = "", var idea: Memory? = null, val apply: () -> Unit) { var i = 0; var t = 0.5f }
    private val scenes = HashMap<String, Run>()
    fun scene(id: String): Run? = scenes[id] ?: scenes.values.firstOrNull { it.b == id }
    /** an idea of yours waiting for the next scene of this person (worry advice) */
    private val ideas = HashMap<String, Memory>()

    internal fun startScene(p: Person, q: Person) {
        val id = p.soc ?: "chat"
        val run = build(p, q, id, sim.rng)
        run.idea = ideas.remove(p.id)
        scenes[p.id] = run
        if (run.closeup) sim.events += SimEvent("closeup", p.id, q.id)
    }
    /** one beat at a time; true when the scene is over */
    internal fun play(p: Person, dt: Float): Boolean {
        val run = scenes[p.id] ?: return scenes.values.none { it.b == p.id }   /* the other one just listens; the one who started plays the beats */
        run.t -= dt; if (run.t > 0f) return false
        if (run.i >= run.beats.size) return true
        val bt = run.beats[run.i++]
        val who = sim.person(if (bt.who == 0) run.a else run.b) ?: return true
        val other = sim.person(if (bt.who == 0) run.b else run.a) ?: return true
        val text = fill(bt.text, other, run)
        if (text.isNotBlank()) sim.say(who, text)
        val pose = bt.pose ?: if (bt.who == 1 && run.act != null) run.re.pose else Pose.TALK
        sim.body(who.id).pose = pose; sim.body(who.id).poseT = 0f
        val fx = bt.fx ?: if (bt.who == 1 && run.act != null) run.re.fx else null
        fx?.let { sim.events += SimEvent("fx", who.id, it) }
        run.t = if (text.isBlank()) 0.8f else min(4.6f, 2.4f + text.length * 0.07f)
        return false
    }
    /** `id` = either of the two */
    internal fun finishScene(id: String, done: Boolean) {
        val run = scene(id) ?: return; scenes.remove(run.a)
        if (run.closeup) sim.events += SimEvent("closeupEnd", run.a, run.b)
        if (done) { run.apply(); ideaResult(run) } else run.idea?.let { ideas[run.a] = it }
    }
    private fun fill(t: String, other: Person, run: Run) = t.replace("{對方}", nick(other)).replace("{物}", run.thing.ifBlank { "那個" }).replace("{第三人}", sim.person(run.third)?.let { nick(it) } ?: "大家")

    /** builds the scene and what it changes (used live, and at once while you are away) */
    internal fun build(p: Person, q: Person, id: String, r: Rng): Run {
        if (id.startsWith("ev:")) return eventRun(p, q, id.removePrefix("ev:"), r)
        if (id.startsWith("say:")) return sayRun(p, q, id.removePrefix("say:"), r)
        val act = SocialActs[id] ?: SocialActs["chat"]!!
        var re = Will.react(act, ctx(q, p, act), r)
        var thing = ""; var third = ""; var gift: Gift? = null
        when (act.id) {
            "gift" -> { gift = pickGift(p, q, r); thing = gift.zh; val fit = giftFit(q, gift); re = shift(re, if (fit > 0) 1 else if (fit < 0) -2 else 0) }
            "recommend", "show", "share_snack" -> thing = (Topics.conceptsOf(p.spec, life.tags) + p.spec.likes).ifEmpty { listOf("這個") }.let { r.pick(it) }
            "compete" -> thing = r.pick(listOf("吃完點心", "跑到門口", "數到一百", "憋氣"))
            "joke" -> thing = r.pick(listOf("冰箱", "枕頭", "盆栽", "襪子"))
            "praise_cook" -> thing = st.pot?.let { Dishes.ALL[it.dish]?.zh } ?: "飯"
            "complain" -> thing = r.pick(listOf("天氣", "家事", "鬧鐘", "冰箱的聲音"))
            "gossip" -> { val o = life.people.filter { it !== p && it !== q && !it.desk }; if (o.isNotEmpty()) third = r.pick(o).id }
        }
        val beats = ArrayList<Beat>()
        val qn = nick(q)
        if (act.id == "chat") chatBeats(p, q, re, r, beats).also { thing = it }
        else {
            val open = r.pick(act.open)
            beats += Beat(0, open, act.pose, act.fx)
            if (act.id == "gift" && gift != null) beats += Beat(0, "是${gift.zh}喔。")
            if (act.id == "gossip" && third.isNotEmpty()) sim.person(third)?.let { t -> life.log.lastOrNull { it.who == t.id }?.let { l -> beats += Beat(0, "聽說${nick(t)}${l.text.substringAfter("：")}。") } }
            val reply = when {
                act.id == "gift" && gift != null && re.good -> if (giftFit(q, gift) > 0) "是${gift.zh}！我最喜歡這個了！" else "謝謝……我會好好收著的。"
                act.id == "gift" && gift != null && re.bad -> "……我不需要這個。"
                act.id == "invite_rps" && re.good -> null
                else -> (act.reply[re] ?: SocialActs.REPLY[re]!!).let { r.pick(it) }
            }
            if (reply != null) beats += Beat(1, reply)
            if (act.id == "invite_rps" && re.good) {
                val ha = Rps.pick(p.spec, null, r); val hb = Rps.pick(q.spec, null, r); val j = Rps.judge(ha, hb)
                beats += Beat(1, "好啊！剪刀、石頭——"); beats += Beat(0, "${Rps.ZH[ha]}！", Pose.SWING); beats += Beat(1, "${Rps.ZH[hb]}！", Pose.SWING)
                beats += if (j > 0) Beat(0, "我贏了！", Pose.HAPPY, "sparkle") else if (j < 0) Beat(1, "我贏了！", Pose.HAPPY, "sparkle") else Beat(0, "平手！再一次！", Pose.HAPPY)
                thing = if (j > 0) nick(p) else if (j < 0) qn else "平手"
            }
            if (re == Reaction.WARM) beats += Beat(0, r.pick(listOf("嘿嘿。", "太好了！", "（開心地笑了）")), Pose.HAPPY, "heart")
            else if (re.bad) beats += Beat(0, r.pick(listOf("……這樣啊。", "好吧……", "哼。")), if (re == Reaction.ANGRY && act.hostile) Pose.ANGRY else Pose.SAD)
        }
        val g = gift; val th = thing; val td = third
        return Run(act.id, act, p.id, q.id, beats, re, act.closeup || re == Reaction.CRY || (re == Reaction.ANGRY && act.hostile), th, td) { applyAct(p, q, act, re, th, g) }
    }
    private fun shift(re: Reaction, by: Int): Reaction { val all = Reaction.values(); return all[(re.ordinal - by).coerceIn(0, all.size - 1)] }
    private fun ctx(target: Person, asker: Person, act: SocialAct): Will.Ctx {
        val room = sim.roomOf(target)
        return Will.Ctx(target.spec, sim.rel(target.id, asker.id), sim.moodValue(target), target.need(Need.SOCIAL), target.need(Need.ENERGY),
            life.people.count { !it.desk && sim.roomOf(it) == room }, ledger(target.id, asker.id), feud(target.id, asker.id) != null,
            sim.mods(target).act("r:" + act.cat) * (statusOf(target)?.act?.get("r:" + act.cat) ?: 1f))
    }
    /** a chat: a collision of their worlds, or something from around them; disagreement is remembered */
    private fun chatBeats(p: Person, q: Person, re: Reaction, r: Rng, out: ArrayList<Beat>): String {
        val col = if (r.chance(0.5)) Topics.collide(p.spec, q.spec, r, life.tags) else null
        if (col != null) {
            out += Beat(0, col.first)
            out += Beat(1, if (re.good || re == Reaction.OK) col.second else (SocialActs.REPLY[re]!!).let { r.pick(it) }, if (!col.third && re.good) Pose.ANGRY else null, if (!col.third && re.good) "sweat" else null)
            if (re.good) { out += Beat(0, r.pick(listOf("我是認真的。", "對吧！我就說嘛。", "那下次我們試試看。"))); out += Beat(1, r.pick(Topics.REPLY_AGREE)) }
            return col.first.take(14).trimEnd('？', '。') + "……"
        }
        val pool = ArrayList<String>()
        pool += Speech.topics(p.spec, life.tags)
        p.spec.likes.filter { l -> q.spec.likes.any { it.contains(l) || l.contains(it) } }.forEach { pool += "${it}的事"; pool += "${it}的事" }
        sim.rel(p.id, q.id)?.story?.takeIf { it.isNotBlank() }?.let { pool += it }
        st.pot?.let { pot -> if (p.id in pot.eaters) Dishes.ALL[pot.dish]?.let { pool += "剛剛的${it.zh}" } }
        p.recent.entries.maxByOrNull { it.value }?.let { (k, v) -> if (life.minute - v < 120) Acts[k]?.let { pool += "剛剛${it.zh}的事" } }
        val topic = if (pool.isEmpty()) "今天的事" else r.pick(pool)
        out += Beat(0, r.pick(Topics.OPEN).replace("{話題}", topic))
        val agree = re.good || (re == Reaction.OK && r.chance(0.6))
        out += Beat(1, if (re.bad || re == Reaction.MEH || re == Reaction.NO) r.pick(SocialActs.REPLY[re]!!) else if (agree) r.pick(Topics.REPLY_AGREE) else r.pick(Topics.REPLY_DISAGREE))
        if (re.good) { out += Beat(0, r.pick(listOf("對吧！", "下次再跟你說更多。", "跟你聊天好開心。"))) }
        return topic
    }

    /** what a social act changes, for both of them */
    private fun applyAct(p: Person, q: Person, act: SocialAct, re: Reaction, thing: String, gift: Gift?) {
        val good = re.good
        for (x in listOf(p, q)) { x.setNeed(Need.SOCIAL, x.need(Need.SOCIAL) + act.social * (if (re.k > 0f) 1f else 0.4f)); x.setNeed(Need.FUN, x.need(Need.FUN) + act.joy * (if (re.k > 0f) 1f else 0.3f)) }
        val d = Will.delta(act, re)
        relUpdate(q, p) { it.copy(like = it.like + d.like, trust = it.trust + d.trust, conflict = it.conflict + d.conflict, familiar = it.familiar + d.familiar, seenDay = life.day) }
        relUpdate(p, q) { it.copy(like = it.like + (if (re.bad) -1 else d.like / 2), conflict = it.conflict + d.conflict / 2, familiar = it.familiar + 2, seenDay = life.day) }
        if ((act.intimate || act.id == "deep" || act.id == "flirt") && good && romanceOk(p, q) && (sim.rel(q.id, p.id)?.fit ?: 50) >= 55) {
            relUpdate(q, p) { it.copy(crush = it.crush + 2) }; relUpdate(p, q) { it.copy(crush = it.crush + 1) }
        }
        when (re) { Reaction.WARM, Reaction.HAPPY -> sim.addMood(q, "socgood"); Reaction.ANGRY -> sim.addMood(q, "angry"); Reaction.CRY -> sim.addMood(q, "cried"); else -> {} }
        if (re.bad || re == Reaction.NO) sim.addMood(p, "rejected") else if (good) sim.addMood(p, "socgood")
        if (act.id == "gift" && good) sim.addMood(q, "gift")
        if (act.id == "comfort" && good || act.id == "deep" && good) sim.addMood(q, "listened")
        st.seen["${act.id}:${p.id}:${q.id}"] = life.minute
        count(p.id, q.id, "all"); count(p.id, q.id, act.cat)
        if (act.cat == "衝突" && re.bad) count(p.id, q.id, "quarrel")
        var cause = -1; var weight = if (act.closeup || re.bad) 2 else 1; var text = when (act.id) {
            "chat" -> "和${q.name}聊了$thing" + if (re.bad) "，${q.name}${re.zh}了" else ""
            "gift" -> "送${q.name}$thing，${q.name}${if (good) "很開心" else re.zh}"
            "invite_rps" -> if (good) "找${q.name}猜拳，${if (thing == "平手") "平手" else "$thing 贏了"}" else "找${q.name}猜拳，${q.name}${re.zh}"
            else -> "對${q.name}${act.zh}，${q.name}的反應：${re.zh}"
        }
        // ---- the ledger: favours, paying back, grudges, revenge
        if (act.favor && good) remember(q, p.id, Memory.FAVOR, act.zh, 2)
        owed(p.id, q.id)?.let { m -> if ((act.favor || act.id == "thank") && good) { m.settled = true; cause = m.id; text = "還了${q.name}的人情（$text）"; weight = 2 } }
        if (act.hostile && (re.bad || re == Reaction.NO)) { val g = remember(q, p.id, Memory.GRUDGE, act.zh, 2, grudge(p.id, q.id)?.id ?: -1); cause = g.cause }
        if (act.id == "prank") grudge(p.id, q.id)?.let { m -> if (!re.bad) { m.settled = true; cause = m.id; text = "小小地報復了${q.name}（${m.what}的仇），氣消了"; weight = 2 } }
        when (act.id) {
            "argue" -> { val g = grudge(p.id, q.id); cause = g?.id ?: cause
                if (good) { g?.settled = true; relUpdate(p, q) { it.copy(conflict = it.conflict - 6) }; text = "和${q.name}把話說開了"; weight = 3 }
                else if (re.bad) { if (feud(p.id, q.id) == null) st.feuds += Feud(p.id, q.id, life.minute, g?.what ?: "吵架"); text = "和${q.name}吵架了，兩個人開始冷戰"; weight = 3 } }
            "apologize", "makeup" -> if (good) { feud(p.id, q.id)?.let { st.feuds.remove(it) }; for (x in listOf(p, q)) sim.addMood(x, "madeup"); count(p.id, q.id, "makeup")
                grudge(p.id, q.id)?.settled = true; grudge(q.id, p.id)?.settled = true; text = "和${q.name}和好了"; weight = 3 }
            "forgive" -> { grudge(p.id, q.id)?.settled = true; text = "原諒了${q.name}" }
            "help" -> { st.dishes = max(0, st.dishes - 2); st.chores[p.id] = (st.chores[p.id] ?: 0) + 1 }
            "nag" -> if (good) q.order = "act:dishes"
            "invite_tv" -> if (good) { p.order = "act:tv"; q.order = "act:tv" }
            "invite_meal" -> if (good) q.order = "act:meal"
            "invite_rps", "invite_hide" -> if (good) { sim.addMood(p, "played"); sim.addMood(q, "played") }
            "confess" -> if (good) {
                relUpdate(p, q) { it.copy(kind = "戀人", crush = max(it.crush, 60)) }; relUpdate(q, p) { it.copy(kind = "戀人", crush = max(it.crush, 60)) }
                if (sim.rel(p.id, q.id)?.kind == "戀人") { for (x in listOf(p, q)) sim.addMood(x, "together"); text = "向${q.name}告白，兩個人在一起了"; weight = 3 }
            } else { sim.addMood(p, "heartbroken"); text = "向${q.name}告白，被溫柔地拒絕了"; weight = 3 }
        }
        p.wish?.let { w -> if (!w.done && w.kind == "talk" && w.target == q.id && good) wishDone(p, w) }
        if (act.id == "invite_hide" && good) p.wish?.let { w -> if (!w.done && w.kind == "hide") wishDone(p, w) }
        sim.log(p, text, kind = "social", weight = weight, cause = cause, with = q.id)
    }
    private fun pickGift(p: Person, q: Person, r: Rng): Gift {
        val knows = (sim.rel(p.id, q.id)?.familiar ?: 30) >= 40
        val pool = Gifts.ALL + life.items.filter { it.kind == "gift" }.map { Gift("item:" + it.id, it.name, it.words.ifEmpty { listOf(it.name) }, it.taste.ifBlank { null }) }
        val liked = pool.filter { giftFit(q, it) > 0 }
        return if (knows && liked.isNotEmpty() && r.chance(0.8)) r.pick(liked) else r.pick(pool)
    }
    /** 1 = they love it, −1 = they dislike it */
    fun giftFit(q: Person, g: Gift): Int {
        val s = q.spec
        if (s.dislikes.any { d -> g.words.any { d.contains(it) || it.contains(d) } } || (g.taste != null && (s.tastes[g.taste] ?: 0) < 0)) return -1
        if ((s.likes + s.hobbies).any { l -> g.words.any { l.contains(it) || it.contains(l) } } || (g.taste != null && (s.tastes[g.taste] ?: 0) > 0)) return 1
        return 0
    }

    // ================= events: chemistry, sparks, everyday, the serial, the last piece =================
    private fun eventRun(p: Person, q: Person, id: String, r: Rng): Run {
        val kind = id.substringBefore(":"); val key = id.substringAfter(":")
        val things = (Topics.conceptsOf(p.spec, life.tags) + p.spec.likes).ifEmpty { listOf("鑰匙", "襪子", "髮夾") }
        val thing = r.pick(listOf("鑰匙", "襪子", "髮夾", "眼鏡") + things.take(2))
        val third = life.people.filter { it !== p && it !== q && !it.desk }.let { if (it.isEmpty()) "" else r.pick(it).id }
        when (kind) {
            "chem" -> { val c = Chemistry.ALL.first { it.id == key }
                return Run(id, null, p.id, q.id, c.beats, Reaction.HAPPY, c.closeup, thing, third) {
                    for ((a, b) in listOf(p to q, q to p)) { relUpdate(a, b) { it.copy(like = it.like + c.like, conflict = it.conflict + c.conflict, familiar = it.familiar + 3, seenDay = life.day) }; a.setNeed(Need.FUN, a.need(Need.FUN) + c.fun_); a.setNeed(Need.SOCIAL, a.need(Need.SOCIAL) + 20f) }
                    count(p.id, q.id, "all"); count(p.id, q.id, "chem")
                    sim.log(p, "和${q.name}：${c.zh}", kind = "event", weight = 2, with = q.id) } }
            "spark" -> { val def = Sparks.ALL.first { it.id == key }; val sp = st.sparks.first { it.id == key && it.a == p.id && it.b == q.id }
                val stage = sp.stage.coerceAtMost(1).let { if (sp.stage >= 1 && sp.heat >= 2) if (likeBoth(p, q) >= 45) 2 else 3 else it }
                return Run(id, null, p.id, q.id, def.stages[stage], if (stage == 1) Reaction.ANGRY else Reaction.HAPPY, stage >= 1, thing, third) {
                    sp.lastMinute = life.minute
                    when (stage) {
                        0 -> { sp.stage = 1; sp.heat = 0; relUpdate(q, p) { it.copy(conflict = it.conflict + 3) }; sim.log(p, "和${q.name}的小摩擦（${def.zh}）", kind = "event", weight = 1, with = q.id) }
                        1 -> { sp.heat++; for ((a, b) in listOf(p to q, q to p)) relUpdate(a, b) { it.copy(conflict = it.conflict + 8, like = it.like - 2) }
                            val g = remember(q, p.id, Memory.GRUDGE, def.zh, 1); sim.log(p, "和${q.name}起了衝突（${def.zh}）", kind = "event", weight = 3, cause = g.id, with = q.id) }
                        2 -> { sp.stage = 2; for ((a, b) in listOf(p to q, q to p)) relUpdate(a, b) { it.copy(conflict = it.conflict - 15, like = it.like + 4, trust = it.trust + 3) }
                            sim.log(p, "和${q.name}磨合好了，立下家規：「${def.rule}」", kind = "event", weight = 3, with = q.id) }
                        else -> { sp.stage = 3; for ((a, b) in listOf(p to q, q to p)) relUpdate(a, b) { it.copy(familiar = it.familiar - 5) }; sim.log(p, "和${q.name}決定保持距離", kind = "event", weight = 3, with = q.id) }
                    }
                } }
            "serial" -> { val n = key.toInt(); val e = Events.SERIAL[n]
                return Run(id, null, p.id, q.id, e.beats, Reaction.HAPPY, e.closeup, thing, third) {
                    st.serial.episode = n + 1; st.serial.nextDay = life.day + 1; st.serial.flags += "ep${n + 1}"
                    for ((a, b) in listOf(p to q, q to p)) relUpdate(a, b) { it.copy(like = it.like + e.like, familiar = it.familiar + 2) }
                    sim.log(p, "連續劇「${Events.SERIAL_ZH}」第 ${n + 1} 集：${e.zh.substringAfter("）")}", kind = "event", weight = 3, with = q.id)
                    mail(p.id, "serial", "連續劇「${Events.SERIAL_ZH}」（${n + 1}/5）", "${p.name}和${q.name}：${e.zh.substringAfter("）")}") } }
            "last" -> return lastPiece(p, q, r)
            "script" -> return scriptRun(p, q, key.substringBefore(":"), key.substringAfter(":", "").toIntOrNull())
            else -> { val e = Events.DAILY.first { it.id == key }
                return Run(id, null, p.id, q.id, e.beats, Reaction.HAPPY, e.closeup, thing, third) {
                    for ((a, b) in listOf(p to q, q to p)) { relUpdate(a, b) { it.copy(like = it.like + e.like, familiar = it.familiar + 2, seenDay = life.day) }; a.setNeed(Need.FUN, a.need(Need.FUN) + e.fun_); a.setNeed(Need.SOCIAL, a.need(Need.SOCIAL) + 18f) }
                    if (e.id == "overheard" && third.isNotEmpty()) sim.person(third)?.let { t -> relUpdate(t, p) { it.copy(like = it.like + 3) } }
                    count(p.id, q.id, "all"); count(p.id, q.id, "event")
                    sim.log(p, "和${q.name}：${e.zh}", kind = "event", weight = 2, with = q.id) } }
        }
    }
    private fun likeBoth(p: Person, q: Person) = ((sim.rel(p.id, q.id)?.like ?: 30) + (sim.rel(q.id, p.id)?.like ?: 30)) / 2
    /** the last piece (plan D-10): give way, split, grab or sneak it — personality decides */
    private fun lastPiece(p: Person, q: Person, r: Rng): Run {
        val pot = st.pot; val dish = pot?.let { Dishes.ALL[it.dish]?.zh } ?: "蛋糕"
        val greedy = sim.mods(p).act("food") > 1.25f || p.spec.temper > 0.3f
        val how = when { p.spec.axis(Axis.GENTLE) > 0.3f -> "give"; q.spec.axis(Axis.GENTLE) >= 0f && p.spec.axis(Axis.GENTLE) >= 0f && p.spec.axis(Axis.FRANK) >= 0f -> "split"
            greedy && p.spec.axis(Axis.FRANK) < 0f -> "sneak"; greedy -> "grab"; else -> if (r.chance(0.5)) "split" else "give" }
        val script = when (how) {
            "give" -> "A:最後一塊${dish}了……你吃吧。 / B:真的嗎？那……謝謝！@EAT#heart / A:（其實有點想吃）@SAD"
            "split" -> "A:最後一塊${dish}耶。 / B:那……一人一半？ / A:好！@HAPPY#sparkle / B:（分得剛剛好）@EAT"
            "sneak" -> "A:（趁{對方}不注意，偷偷吃掉了最後一塊${dish}）@EAT / B:……咦？最後一塊呢？#shock / A:不、不知道耶。#sweat"
            else -> "A:最後一塊是我的！（一把抓走）@EAT / B:喂！我也想吃！@ANGRY#anger / A:先搶先贏！#fire"
        }
        return Run("ev:last", null, p.id, q.id, Script.parse(script), if (how == "grab") Reaction.ANGRY else Reaction.HAPPY, true, dish) {
            pot?.let { it.servings = 0 }
            when (how) {
                "give" -> { q.setNeed(Need.FOOD, q.need(Need.FOOD) + 25f); relUpdate(q, p) { it.copy(like = it.like + 4) }; remember(q, p.id, Memory.FAVOR, "讓了最後一塊$dish", 2) }
                "split" -> { for (x in listOf(p, q)) x.setNeed(Need.FOOD, x.need(Need.FOOD) + 12f); for ((a, b) in listOf(p to q, q to p)) relUpdate(a, b) { it.copy(like = it.like + 2) } }
                "sneak" -> { p.setNeed(Need.FOOD, p.need(Need.FOOD) + 25f); sim.addMood(q, "lostlast"); if (r.chance(0.5)) remember(q, p.id, Memory.GRUDGE, "偷吃了最後一塊$dish", 1) }
                else -> { p.setNeed(Need.FOOD, p.need(Need.FOOD) + 25f); sim.addMood(q, "lostlast"); relUpdate(q, p) { it.copy(conflict = it.conflict + 5) }; remember(q, p.id, Memory.GRUDGE, "搶走了最後一塊$dish", 2) }
            }
            sim.log(p, "和${q.name}搶最後一塊$dish：" + mapOf("give" to "${p.name}讓給了${q.name}", "split" to "一人一半", "sneak" to "${p.name}偷偷吃掉了", "grab" to "${p.name}搶走了")[how], kind = "event", weight = 2, with = q.id)
        }
    }
    fun eventOk(e: EventDef, a: Person, b: Person): Boolean {
        if (!hourIn(e.from, e.to)) return false
        val h = sim.house
        return when (e.cond) {
            "" -> true
            "window" -> h.pieces.any { it.kind == "window" }
            "plant" -> h.pieces.any { it.kind == "plant" }
            "sleepyPair" -> a.need(Need.ENERGY) < 55 && b.need(Need.ENERGY) < 55
            "active" -> a.spec.axis(Axis.ACTIVE) > 0.2f
            "someoneSad" -> sim.moodValue(b) <= -2
            "glutton" -> sim.mods(a).act("food") > 1.2f || sim.mods(a).act("snack") > 1.2f
            "bathMorning" -> h.pieces.count { it.kind == "tub" } == 1 && life.people.count { !it.desk } >= 3
            "crier" -> a.spec.cry > 0.2f
            "third" -> life.people.count { !it.desk } >= 3
            "strangers" -> (sim.rel(a.id, b.id)?.familiar ?: 30) < 25
            "close" -> Will.stageFrom(sim.rel(a.id, b.id)) >= 3
            "birthday" -> b.moods.any { it.id == "birthday" }
            else -> false
        }
    }
    /** what could happen between two free people now, with weights */
    private fun eventChoices(r: Rng): List<Triple<Person, Person, String>> {
        val out = ArrayList<Triple<Person, Person, String>>(); val ws = ArrayList<Double>()
        val ppl = life.people.filter { !it.desk && sim.free(it) && !sim.isNight(it) && !sim.asleep(it) }
        val day = 1440.0
        for (a in ppl) for (b in ppl) {
            if (a === b) continue
            for (c in Chemistry.ALL) if (a.spec.has(c.a) && b.spec.has(c.b) && life.minute - (st.seen["chem:${c.id}:${a.id}:${b.id}"] ?: -1e9) > 2 * day) { out += Triple(a, b, "chem:${c.id}"); ws += 3.0 }
            for (sp in st.sparks) if (sp.a == a.id && sp.b == b.id && sp.stage < 2 && life.minute - sp.lastMinute > day * 0.75) { out += Triple(a, b, "spark:${sp.id}"); ws += 4.0 }
            for (e in Events.DAILY) if (life.minute - (st.seen["day:${e.id}"] ?: -1e9) > day && eventOk(e, a, b)) { out += Triple(a, b, "day:${e.id}"); ws += 1.0 }
            val se = st.serial
            if (se.episode < Events.SERIAL.size && life.day >= se.nextDay && (se.cast.isEmpty() || (se.cast[0] == a.id && se.cast[1] == b.id)) && eventOk(Events.SERIAL[se.episode], a, b)) { out += Triple(a, b, "serial:${se.episode}"); ws += 5.0 }
            st.pot?.let { pot -> val d = Dishes.ALL[pot.dish]; if (d?.sweet == true && pot.servings == 1 && a.id !in pot.eaters && b.id !in pot.eaters) { out += Triple(a, b, "last"); ws += 8.0 } }
            for (sc in life.scripts) if (scriptOk(sc, a, b)) { out += Triple(a, b, "script:${sc.id}"); ws += sc.trigger.chance / 8.0 }
        }
        if (out.isEmpty()) return emptyList()
        val i = r.weighted(out.indices.toList()) { ws[it] } ?: return emptyList()
        return listOf(out[i])
    }
    private fun markSeen(a: Person, b: Person, id: String) {
        when { id.startsWith("chem:") -> st.seen["$id:${a.id}:${b.id}"] = life.minute; id.startsWith("day:") -> st.seen[id] = life.minute
            id.startsWith("serial:") -> if (st.serial.cast.isEmpty()) st.serial.cast = listOf(a.id, b.id)
            id.startsWith("script:") -> st.seen[id.substringBeforeLast(":").let { if (it == "script") id else it }] = life.minute }
    }

    // ================= the player's scripts (plan 13.3) =================
    fun matches(p: Person, m: String): Boolean = when {
        m == "any" -> true
        m.startsWith("tag:") -> m.drop(4) in p.spec.tags
        m.startsWith("trait:") -> m.drop(6) in p.spec.traits || m.drop(6) in p.spec.quirks
        m.startsWith("name:") -> p.name == m.drop(5) || p.spec.nickname == m.drop(5)
        else -> false
    }
    /** can this script play with `a` as A and `b` as B now? Romance in a script = two adults with romance on, like everywhere else */
    fun scriptOk(sc: app.ocshimeji.sim.script.ScriptDef, a: Person, b: Person): Boolean {
        if (!sc.enabled || app.ocshimeji.sim.script.Scripts.problems(sc).isNotEmpty()) return false
        if (sc.romantic && !romanceOk(a, b)) return false
        val ra = sc.roles.firstOrNull { it.key == "A" }?.match ?: "any"; val rb = sc.roles.firstOrNull { it.key == "B" }?.match ?: "any"
        if (!matches(a, ra) || !matches(b, rb)) return false
        val t = sc.trigger; if (!hourIn(t.from, t.to)) return false
        val like = sim.rel(a.id, b.id)?.like ?: 30; if (like < t.minLike || like > t.maxLike) return false
        if (t.flag.isNotBlank() && t.flag !in st.flags) return false
        if (t.notFlag.isNotBlank() && t.notFlag in st.flags) return false
        if (t.mood == "good" && sim.moodValue(a) < 1) return false
        if (t.mood == "bad" && sim.moodValue(a) > -1) return false
        return life.minute - (st.seen["script:${sc.id}"] ?: -1e9) > sc.cooldownDays * 1440.0
    }
    private fun scriptRun(p: Person, q: Person, id: String, option: Int?): Run {
        val sc = life.scripts.first { it.id == id }
        val opt = option?.let { sc.choice?.options?.getOrNull(it) }
        val steps = sc.steps + (opt?.steps ?: emptyList()); val results = sc.results + (opt?.results ?: emptyList())
        val beats = steps.map { st -> Beat(if (st.role == "B") 1 else 0, if (st.kind == "say") st.text else "", st.pose.takeIf { it.isNotBlank() }?.let { runCatching { Pose.valueOf(it) }.getOrNull() }, st.fx.ifBlank { null }) }
        return Run("ev:script:$id", null, p.id, q.id, beats, Reaction.HAPPY, sc.closeup) {
            for (r in results) {
                val from = if (r.role == "B") q else p; val to = if (r.to == "A") p else q
                when (r.kind) {
                    "like" -> relUpdate(from, to) { it.copy(like = it.like + r.value, seenDay = life.day) }
                    "trust" -> relUpdate(from, to) { it.copy(trust = it.trust + r.value) }
                    "conflict" -> relUpdate(from, to) { it.copy(conflict = it.conflict + r.value) }
                    "crush" -> if (romanceOk(from, to)) relUpdate(from, to) { it.copy(crush = it.crush + r.value) }
                    "mood" -> if (Moods.ALL.containsKey(r.text)) sim.addMood(from, r.text)
                    "memory" -> remember(from, if (from === p) q.id else p.id, if (r.value >= 0) Memory.FAVOR else Memory.GRUDGE, r.text, kotlin.math.abs(r.value).coerceIn(1, 5))
                    "flag" -> { if (r.text !in st.flags) st.flags += r.text; while (st.flags.size > 200) st.flags.removeAt(0) }
                }
            }
            count(p.id, q.id, "all"); count(p.id, q.id, "event")
            sim.log(p, "和${q.name}：${sc.name}" + (opt?.let { "（你選了：${it.label}）" } ?: ""), kind = "event", weight = 2, with = q.id)
        }
    }
    /** the waiting script question (null when none) */
    fun pendingChoice(): Pair<app.ocshimeji.sim.script.ScriptDef, app.ocshimeji.sim.social.PendingChoice>? { val c = st.choice ?: return null; val sc = life.scripts.firstOrNull { it.id == c.script } ?: run { st.choice = null; return null }; return sc to c }
    /** you answered: the scene plays (or, if one of them is busy, it waits for the next chance) */
    fun answerChoice(option: Int): Boolean {
        val (sc, c) = pendingChoice() ?: return false; st.choice = null
        val a = sim.person(c.a) ?: return false; val b = sim.person(c.b) ?: return false
        if (option !in sc.choice!!.options.indices) return false
        if (sim.startTogether(a, b, "ev:script:${sc.id}:$option", listOf(sc.name))) return true
        build(a, b, "ev:script:${sc.id}:$option", sim.rng).apply(); return true
    }

    // ================= the scan: worries, requests, events (every 15 game minutes live; every chunk away) =================
    private var lastScan = -1e9
    internal fun step(live: Boolean, realSec: Float) {
        if (live) st.realSec += realSec
        if (st.settledDay < 0) { st.settledDay = life.day; newDay(); }
        if (life.day != st.settledDay) settle()
        if (sim.hour >= 22 && st.cards.none { it.day == life.day }) dayCard(life.day)
        if (life.minute - lastScan < 15) return
        lastScan = life.minute
        scan(live, if (live) sim.rng else Rng.of(life.seed, "scan:${(life.minute / 15).toLong()}"))
    }
    private fun budgetMax() = listOf(1, 2, 4)[st.lively.coerceIn(0, 2)]
    private fun budgetOk(): Boolean = budgetLeft() && life.people.none { it.worry?.shown == true }
    /** the disturbance budget alone (a script question may wait beside a worry bubble) */
    private fun budgetLeft(): Boolean {
        if (st.realSec - st.windowStart >= 600) { st.windowStart = st.realSec; st.windowUsed = 0 }
        return st.windowUsed < budgetMax()
    }
    private fun scan(live: Boolean, r: Rng) {
        if (life.arriving) return   /* move-in day: nobody has worries yet */
        for (p in life.people) {
            if (p.desk) continue
            p.worry?.let { w -> if (resolved(p, w) || life.minute - w.since > 16 * 60) { p.worry = null } }
            p.ask?.let { a -> if (life.minute - a.since > 6 * 60) { p.ask = null; sim.addMood(p, "ignoredask") } }
            if (sim.asleep(p)) continue
            if (p.worry == null && life.minute - p.lastWorry > 240 && r.chance(0.3)) worryFor(p, r)?.let { p.worry = it; p.lastWorry = life.minute; sim.log(p, "有煩惱：${Worries.ALL[it.kind]!!.zh}", kind = "worry", weight = 1) }
            if (p.ask == null && life.minute - p.lastAsk > 360 && r.chance(0.12)) askFor(p, r)?.let { p.ask = it; p.lastAsk = life.minute }
        }
        if (live) {
            /* one thing that needs you at a time; the rest waits, and after two hours goes to the mailbox */
            for (p in life.people) {
                val w = p.worry ?: continue
                if (!w.shown && !w.mailed && budgetOk()) { w.shown = true; st.windowUsed++; sim.events += SimEvent("worry", p.id, w.kind); sim.say(p, worryLine(p, w), toPlayer = true) }
                else if (!w.shown && !w.mailed && life.minute - w.since > 120) { w.mailed = true; mail(p.id, "worry", "${p.name}的煩惱", worryLine(p, w)) }
            }
            for (p in life.people) { val a = p.ask ?: continue; if (a.since == life.minute || life.minute - a.since < 15) { if (budgetOk()) { st.windowUsed++; sim.events += SimEvent("ask", p.id, a.text); sim.say(p, a.text, toPlayer = true) } else mail(p.id, "ask", "${p.name}的請求", a.text) } }
        }
        // sparks warm up when the two share a room
        for (def in Sparks.ALL) for (a in life.people) for (b in life.people) {
            if (a === b || !a.spec.has(def.a) || !b.spec.has(def.b)) continue
            val sp = st.sparks.firstOrNull { it.id == def.id && it.a == a.id && it.b == b.id } ?: Spark(def.id, a.id, b.id).also { st.sparks += it }
            if (sp.stage >= 1 && sp.stage < 2 && sim.roomOf(a) == sim.roomOf(b) && !a.desk && !b.desk) sp.heat = min(sp.heat + 1, 99)
        }
        st.choice?.let { c -> if (life.minute - c.since > 120) answerChoice(0) }   /* nobody answered: the first answer */
        if (live && scenes.isNotEmpty()) return     /* one scene at a time is enough to watch */
        val chance = listOf(0.1, 0.2, 0.32)[st.lively.coerceIn(0, 2)] * (if (live) 1.0 else 0.6)
        if (!r.chance(chance)) return
        val (a, b, id) = eventChoices(r).firstOrNull() ?: return
        markSeen(a, b, id)
        val sc = if (id.startsWith("script:")) life.scripts.firstOrNull { it.id == id.removePrefix("script:") } else null
        if (sc?.choice != null) {   /* it asks you first (live: a bubble and the mailbox; away: the first answer) */
            if (!live) { build(a, b, "ev:$id:0", r).apply(); return }
            if (st.choice != null || !budgetLeft()) return
            st.choice = app.ocshimeji.sim.social.PendingChoice(sc.id, a.id, b.id, life.minute); st.windowUsed++
            sim.events += SimEvent("choice", a.id, sc.choice.prompt); mail(a.id, "choice", "劇本「${sc.name}」", sc.choice.prompt); return
        }
        if (live) sim.startTogether(a, b, "ev:$id", listOf(eventName(id)))
        else build(a, b, "ev:$id", r).apply()
    }
    fun eventName(id: String): String = when {
        id.startsWith("chem:") -> Chemistry.ALL.first { it.id == id.substringAfter(":") }.zh
        id.startsWith("spark:") -> Sparks.ALL.first { it.id == id.substringAfter(":") }.zh
        id.startsWith("day:") -> Events.DAILY.first { it.id == id.substringAfter(":") }.zh
        id.startsWith("serial:") -> "連續劇「${Events.SERIAL_ZH}」"
        id == "last" -> "搶最後一塊"
        id.startsWith("script:") -> life.scripts.firstOrNull { it.id == id.removePrefix("script:").substringBefore(":") }?.name ?: "劇本"
        else -> "一件小事"
    }

    /** while you are away: two free people sometimes do something together, at once (no walking, no lines) */
    internal fun awayChunk(chunk: Long) {
        val r = Rng.of(life.seed, "awaysoc:$chunk")
        val ppl = life.people.filter { !it.desk && !sim.asleep(it) && !sim.isNight(it) && (it.act == null || it.act in LifeSim.INTERRUPTIBLE) }
        if (ppl.size < 2 || !r.chance(0.16)) return
        val p = r.pick(ppl); val q = r.pick(ppl.filter { it !== p })
        if (life.minute - (p.recent["chat"] ?: -1e9) < 45) return
        val pick = chooseAct(p, q, r) ?: return
        build(p, q, pick.act.id, r).apply()
        p.recent["chat"] = life.minute; q.recent["chat"] = life.minute
    }

    // ================= worries (plan D-01) =================
    private fun worryFor(p: Person, r: Rng): Worry? {
        val others = life.people.filter { it !== p && !it.desk }
        st.feuds.firstOrNull { (it.a == p.id || it.b == p.id) && life.minute - it.since > 720 }?.let { f -> return Worry("makeup", if (f.a == p.id) f.b else f.a, since = life.minute) }
        others.firstOrNull { (grudge(p.id, it.id)?.weight ?: 0) >= 3 && feud(p.id, it.id) == null }?.let { return Worry("fight", it.id, since = life.minute) }
        others.firstOrNull { romanceOk(p, it) && (sim.rel(p.id, it.id)?.crush ?: 0) >= 60 && sim.rel(p.id, it.id)?.kind != "戀人" }?.let { return Worry("confess", it.id, since = life.minute) }
        if (p.need(Need.FOOD) < 25 && st.pot == null) return Worry("hungry", since = life.minute)
        if (life.minute - (p.recent["sleep"] ?: -1e9) < 40 && (p.moods.any { it.id == "badsleep" } || r.chance(0.12 + 0.2 * p.spec.cry.coerceAtLeast(0f)))) { sim.addMood(p, "nightmare"); return Worry("nightmare", since = life.minute) }
        if (sim.moodValue(p) <= -3) return Worry("heart", since = life.minute)
        if (p.need(Need.FUN) < 25) return Worry("bored", since = life.minute)
        if (p.spec.axis(Axis.OUTGOING) >= -0.2f) others.firstOrNull { (sim.rel(p.id, it.id)?.familiar ?: 30) < 35 }?.let { return Worry("friend", it.id, since = life.minute) }
        if (p.spec.likes.isNotEmpty() && r.chance(0.06)) return Worry("want", thing = r.pick(p.spec.likes), since = life.minute)
        return null
    }
    private fun resolved(p: Person, w: Worry): Boolean = when (w.kind) {
        "makeup" -> feud(p.id, w.about) == null
        "fight" -> grudge(p.id, w.about) == null
        "hungry" -> p.need(Need.FOOD) > 60
        "bored" -> p.need(Need.FUN) > 60
        "heart" -> sim.moodValue(p) >= 0
        "friend" -> (sim.rel(p.id, w.about)?.familiar ?: 30) >= 45
        "confess" -> sim.rel(p.id, w.about)?.kind == "戀人"
        else -> false
    }
    fun worryLine(p: Person, w: Worry): String = Worries.ALL[w.kind]!!.line.replace("{對方}", sim.person(w.about)?.let { nick(it) } ?: "大家").replace("{物}", w.thing.ifBlank { "什麼" })
    /** a choice for a worry (2–4, by the situation); `line` = this choice lets you write what they say */
    data class Choice(val key: String, val zh: String, val line: Boolean = false)
    fun worryChoices(id: String): List<Choice> {
        val p = sim.person(id) ?: return emptyList(); val w = p.worry ?: return emptyList()
        val o = sim.person(w.about); val on = o?.let { nick(it) } ?: ""
        val close = life.people.filter { it !== p && !it.desk }.maxByOrNull { sim.rel(p.id, it.id)?.like ?: 30 }
        return when (w.kind) {
            "friend" -> listOf(Choice("soc:greet", "去跟${on}打招呼吧"), Choice("soc:gift", "送${on}一個小禮物"), Choice("say:chat", "你想跟${on}說什麼？", true), Choice("wait", "先別勉強"))
            "confess" -> listOf(Choice("soc:confess", "鼓起勇氣告白"), Choice("soc:invite_tv", "先約${on}一起看電視"), Choice("say:flirt", "寫一句話告訴${on}", true), Choice("wait", "再等等"))
            "fight" -> listOf(Choice("soc:argue", "去跟${on}說清楚"), Choice("forgive", "原諒${on}吧"), Choice("calm", "吃點甜的冷靜一下"))
            "hungry" -> listOf(Choice("feed", "我給你點心"), Choice("act:cook", "去煮飯吧"), Choice("act:snack", "冰箱裡有吃的"))
            "nightmare" -> listOf(Choice("pat", "摸摸頭安慰"), Choice("youSay", "跟你說一句話", true)) + listOfNotNull(close?.let { Choice("soc:chat:${it.id}", "去找${nick(it)}聊聊") })
            "heart" -> listOf(Choice("listen", "我聽你說")) + listOfNotNull(close?.let { Choice("soc:deep:${it.id}", "去找${nick(it)}談心") }) + Choice("youSay", "跟你說一句話", true)
            "want" -> listOf(Choice("give", "我幫你找找看"), Choice("wait", "下次吧"))
            "bored" -> listOfNotNull(close?.let { Choice("soc:invite_rps:${it.id}", "去找${nick(it)}猜拳") }) + Choice("act:tv", "看電視吧") + Choice("rps", "我陪你猜拳")
            "makeup" -> listOf(Choice("soc:apologize", "去道歉吧"), Choice("soc:gift", "送個小禮物"), Choice("say:makeup", "寫一句話給${on}", true), Choice("wait", "再給彼此一點時間"))
            else -> listOf(Choice("wait", "好"))
        }
    }
    /** words that need romance on and two adults */
    val ROMANCE_WORDS = listOf("喜歡你", "愛你", "交往", "告白", "約會", "結婚", "親親", "接吻", "嫁給", "娶", "在一起")
    /** a line you wrote for them: null = fine, otherwise why not (shown as it is) */
    fun checkLine(speaker: Person, to: Person?, text: String): String? {
        val t = text.trim()
        if (t.isEmpty()) return "還沒有寫要說的話"
        if (t.length > 40) return "最多 40 個字"
        if (ROMANCE_WORDS.any { t.contains(it) } && (to == null || !romanceOk(speaker, to))) return "這句話和戀愛有關：只有兩位成年角色、而且這個世界打開了「戀愛」才可以說"
        return null
    }
    /** you chose how to help; the answer they give now (what happens next plays in the house) */
    fun answerWorry(id: String, key: String, line: String? = null): String {
        val p = sim.person(id) ?: return ""; val w = p.worry ?: return ""
        val o = sim.person(w.about)
        val idea = remember(p, "player", Memory.IDEA, "你的主意：" + (worryChoices(id).firstOrNull { it.key == key }?.zh ?: key), 1)
        fun done(text: String, good: Boolean? = null): String {
            p.worry = null; sim.log(p, "你幫忙處理了煩惱「${Worries.ALL[w.kind]!!.zh}」", kind = "you", weight = 2, cause = idea.id)
            if (good == true) { sim.addMood(p, "idea"); p.affinity = (p.affinity + 3).coerceIn(0, 100) } else if (good == false) sim.addMood(p, "ideabad")
            if (good != null) idea.weight = if (good) 2 else -1
            return Speech.say(p.spec, text, sim.rng, p.affinity, toPlayer = true)
        }
        if (line != null) checkLine(p, o, line)?.let { return it }
        val parts = key.split(":")
        when (parts[0]) {
            "soc" -> {
                val target = if (parts.size > 2) sim.person(parts[2]) else o
                if (target == null) return done("……算了。")
                val act = parts[1]
                ideas[p.id] = idea; p.order = "soc:$act:${target.id}"; sim.nudge(p)
                return done("好，我去試試看。")
            }
            "say" -> {
                val target = o ?: return done("……算了。")
                ideas[p.id] = idea; p.order = "say:${parts[1]}:${target.id}"; pendingLine[p.id] = line ?: ""; sim.nudge(p)
                return done("好……我會跟${nick(target)}說的。")
            }
            "act" -> { p.order = "act:${parts[1]}"; sim.nudge(p); return done("嗯，就這麼辦。") }
            "feed" -> { sim.feed(id, "cookie"); return done("謝謝你！", true) }
            "pat", "listen" -> { p.setNeed(Need.ATTENTION, p.need(Need.ATTENTION) + 30f); sim.addMood(p, "listened"); p.affinity = (p.affinity + 2).coerceIn(0, 100); return done(if (parts[0] == "pat") "……嗯，好多了。" else "說出來，心裡輕鬆多了。", true) }
            "youSay" -> { val l = line ?: ""; sim.events += SimEvent("say", "player", l); sim.addMood(p, "listened"); p.affinity = (p.affinity + 2).coerceIn(0, 100); return done(if (p.spec.cry > 0.3f) "（眼淚又掉下來了）……謝謝你。" else "……謝謝你這麼說。", true) }
            "forgive" -> { o?.let { grudge(p.id, it.id)?.settled = true }; return done("……好吧，我不氣了。", true) }
            "calm" -> { o?.let { q -> grudge(p.id, q.id)?.let { it.weight = max(0, it.weight - 2) } }; p.setNeed(Need.FOOD, p.need(Need.FOOD) + 15f); return done("……甜的東西果然有用。", true) }
            "give" -> { val ok = p.spec.likes.isNotEmpty(); if (ok) { sim.addMood(p, "gift"); p.affinity = (p.affinity + 2).coerceIn(0, 100) }; return done("真的嗎！你最好了！", ok) }
            "rps" -> { sim.events += SimEvent("rps", p.id); return done("好！來猜拳！") }
            else -> return done("嗯……再看看吧。")
        }
    }
    private val pendingLine = HashMap<String, String>()

    // ================= your suggestions and commands (plan 4.2, E-05) =================
    /** what you can ask them to do (activity ids they could do now) */
    fun suggestable(id: String): List<String> { val p = sim.person(id) ?: return emptyList(); return Acts.ALL.values.filter { it.id !in setOf("chat", "queue", "meal", "dishes") && sim.canDo(p, it) }.map { it.id } }
    /** observe / suggest / command */
    fun setControl(id: String, mode: String) { sim.person(id)?.let { it.control = mode; sim.log(it, "切換成「${CONTROL_ZH[mode]}」模式", kind = "you", weight = 1) } }
    /** `what` = activity id, or "soc:<act>" with `target`. Returns what they answer (accepted or why not). */
    fun suggest(id: String, what: String, target: String? = null): String {
        val p = sim.person(id) ?: return ""
        if (p.control == "observe") return "現在是觀察模式：切換到「建議」或「操控」才能請${p.name}做事"
        if (sim.asleep(p)) return "${p.name}睡著了"
        if (p.desk) return "${p.name}在手機桌面上"
        val cmd = p.control == "command"
        if (what.startsWith("soc:")) {
            val act = SocialActs[what.removePrefix("soc:")] ?: return ""; val q = target?.let { sim.person(it) } ?: return ""
            if (act.romance && !romanceOk(p, q)) return "這是戀愛的互動：只有兩位成年角色、而且打開了「戀愛」才可以"
            if (act.cond == "playerOnly") return "告白要從煩惱泡泡「想告白」裡由你決定"
            if (!cmd) { val w = Will.score(act, ctx(p, q, act).let { Will.Ctx(p.spec, sim.rel(p.id, q.id), it.mood, it.social, it.energy, it.crowd, ledger(p.id, q.id), it.feud, sim.mods(p).act("s:" + act.cat)) }, 0f)
                if (w < 0.42f) return answer(p, if (feud(p.id, q.id) != null) "我現在不想理${nick(q)}。" else "現在不想${act.zh}……", false) }
            p.order = "soc:${act.id}:${q.id}"; sim.nudge(p); return answer(p, if (cmd) "好。" else "好啊，我去找${nick(q)}。", true)
        }
        val a = Acts[what] ?: return ""
        if (!sim.canDo(p, a)) return answer(p, "我做不到${a.zh}。", false)
        if (!cmd) {
            val (k, _) = sim.appeal(p, a)
            val low = Need.values().filter { it != Need.ROOM && p.need(it) < 20 }.firstOrNull { n -> (a.per[n] ?: 0f) <= 0f }
            if (low != null) return answer(p, "現在不行，我${low.low}。", false)
            if (a.id in sim.mods(p).hate || k < 0.5f) return answer(p, "我不太想${a.zh}……", false)
        }
        p.order = "act:${a.id}"; sim.nudge(p); return answer(p, if (cmd) "好。" else "嗯，那我去${a.zh}。", true)
    }
    private fun answer(p: Person, text: String, ok: Boolean): String {
        sim.log(p, if (ok) "答應了你的建議" else "婉拒了你的建議：$text", kind = "you", weight = 1)
        return Speech.say(p.spec, text, sim.rng, p.affinity, toPlayer = true)
    }
    /** carry out a waiting order; true when something was started */
    internal fun followOrder(p: Person, dist: IntArray): Boolean {
        val o = p.order ?: return false; val parts = o.split(":")
        val by = if (ideas.containsKey(p.id)) "照你的主意" else if (p.control == "command") "你要我做的" else "你建議的"
        if (parts[0] == "act") {
            p.order = null
            val c = sim.candidatesFor(p, dist, parts[1]) ?: run { if (parts[1] != "meal" && parts[1] != "dishes") sim.say(p, "現在沒辦法${Acts[parts[1]]?.zh ?: "做那個"}。"); return false }
            return sim.commit(p, c, listOf(by))
        }
        val q = sim.person(parts.getOrNull(2) ?: "") ?: run { p.order = null; return false }
        val tries = (orderTries[p.id] ?: 0) + 1; orderTries[p.id] = tries
        if (!sim.free(q) && !sim.asleep(q) && tries == 2 && q.with == null) sim.nudge(q)   /* the other one is asked to wait a moment */
        if (!sim.free(q) || sim.asleep(q)) { if (tries > 8) { p.order = null; orderTries.remove(p.id); ideas.remove(p.id); sim.say(p, "${nick(q)}好像在忙……下次吧。") }; return false }
        p.order = null; orderTries.remove(p.id)
        val soc = if (parts[0] == "say") "say:${parts[1]}" else parts[1]
        return sim.startTogether(p, q, soc, listOf(by))
    }
    private val orderTries = HashMap<String, Int>()
    /** a scene with your own line in it (worry → "write what they say") */
    internal fun sayRun(p: Person, q: Person, kind: String, r: Rng): Run {
        val line = pendingLine.remove(p.id).orEmpty()
        val act = when (kind) { "flirt" -> SocialActs["flirt"]!!; "makeup" -> SocialActs["makeup"]!!; else -> SocialActs["chat"]!! }
        var re = Will.react(act, ctx(q, p, act), r)
        if (kind == "makeup" && feud(p.id, q.id) == null) re = Reaction.HAPPY
        val beats = listOf(Beat(0, line.ifBlank { "……" }), Beat(1, (act.reply[re] ?: SocialActs.REPLY[re]!!).let { r.pick(it) }))
        return Run("say", act, p.id, q.id, beats, re, true) {
            if (kind == "makeup" && re.good) { feud(p.id, q.id)?.let { st.feuds.remove(it) }; for (x in listOf(p, q)) sim.addMood(x, "madeup"); count(p.id, q.id, "makeup") }
            for ((a, b) in listOf(q to p, p to q)) relUpdate(a, b) { it.copy(like = it.like + Will.delta(act, re).like.coerceAtLeast(-3), familiar = it.familiar + 2, seenDay = life.day) }
            if (kind == "flirt" && re.good && romanceOk(p, q)) relUpdate(q, p) { it.copy(crush = it.crush + 5) }
            if (re.good) sim.addMood(p, "socgood") else sim.addMood(p, "rejected")
            sim.log(p, "對${q.name}說了你寫的話：「$line」，${q.name}的反應：${re.zh}", kind = "you", weight = 3, with = q.id)
        }
    }
    /** after a scene that came from your idea: both remember it was yours */
    internal fun ideaResult(run: Run) {
        val m = run.idea ?: return; val p = sim.person(run.a) ?: return; val q = sim.person(run.b) ?: return
        val good = run.re.good; m.weight = if (good) 2 else -1
        remember(q, "player", Memory.IDEA, "${p.name}照你的主意來找我（${if (good) "很順利" else "不太順利"}）", if (good) 1 else -1, m.id)
        sim.addMood(p, if (good) "idea" else "ideabad"); p.affinity = (p.affinity + if (good) 3 else -1).coerceIn(0, 100)
        sim.log(p, "照你的主意去找${q.name}，結果${if (good) "很順利" else "不太順利"}", kind = "you", weight = 3, cause = m.id, with = q.id)
    }

    // ================= requests (plan E-06) =================
    private fun askFor(p: Person, r: Rng): Ask? {
        if (p.need(Need.ATTENTION) < 30) return Ask("pet", text = "可以摸摸我嗎？", since = life.minute)
        if (p.need(Need.FOOD) < 40) { val food = LifeSim.FOODS.keys.firstOrNull { sim.taste(p, it) > 0 } ?: "cookie"; return Ask("snack", food, "可以給我${LifeSim.FOOD_ZH[food]}嗎？", life.minute) }
        if (p.need(Need.FUN) < 45) return if (r.chance(0.6)) Ask("rps", text = "陪我猜拳好不好？", since = life.minute) else Ask("hide", text = "陪我玩躲貓貓！", since = life.minute)
        return null
    }
    private fun askDone(p: Person, kind: String, thing: String = "") {
        val a = p.ask ?: return; if (a.kind != kind || (a.thing.isNotEmpty() && a.thing != thing)) return
        p.ask = null; sim.addMood(p, "helped"); p.affinity = (p.affinity + 4).coerceIn(0, 100)
        sim.log(p, "你答應了${p.name}的請求：${a.text}", kind = "you", weight = 2)
    }

    // ================= wishes (plan A-07), statuses (A-05), plans (B-03) =================
    private fun newWish(p: Person, r: Rng) {
        val others = life.people.filter { it !== p && !it.desk }
        val opts = ArrayList<Wish>()
        LifeSim.FOODS.keys.filter { sim.taste(p, it) >= 0 }.let { if (it.isNotEmpty()) { val f = r.pick(it); opts += Wish("eat", thing = f, text = "想吃${LifeSim.FOOD_ZH[f]}", day = life.day) } }
        if (others.isNotEmpty()) { val o = others.minByOrNull { sim.rel(p.id, it.id)?.familiar ?: 30 }!!; val fam = sim.rel(p.id, o.id)?.familiar ?: 30
            opts += Wish("close", o.id, text = "想跟${o.name}變熟", day = life.day, base = fam); opts += Wish("talk", r.pick(others).id, text = "", day = life.day) }
        if (p.spec.axis(Axis.DILIGENT) > 0f || p.spec.roomPref == "整齊") opts += Wish("tidy", text = Wishes.TEXT["tidy"]!!, day = life.day)
        opts += Wish("rps", text = Wishes.TEXT["rps"]!!, day = life.day); opts += Wish("petted", text = Wishes.TEXT["petted"]!!, day = life.day)
        val w = r.pick(opts)
        p.wish = if (w.kind == "talk") Wish("talk", w.target, text = "想跟${sim.person(w.target)!!.name}好好聊一次", day = life.day) else w
        sim.log(p, "許了一個心願：${p.wish!!.text}", kind = "life", weight = 1)
    }
    private fun wishDone(p: Person, w: Wish) {
        w.done = true; sim.addMood(p, "wishdone"); p.affinity = (p.affinity + 3).coerceIn(0, 100)
        sim.log(p, "心願實現了：${w.text}", kind = "life", weight = 3)
    }
    private fun checkWishes() {
        for (p in life.people) { val w = p.wish ?: continue; if (w.done) continue
            when (w.kind) {
                "close" -> if ((sim.rel(p.id, w.target)?.familiar ?: 0) >= w.base + 15) wishDone(p, w)
                "tidy" -> if (sim.house.rooms.all { (life.mess[it.id] ?: 10f) < 25f }) wishDone(p, w)
            } }
    }
    private fun makePlan(p: Person, r: Rng) {
        p.plan.clear(); val s = p.spec; val steps = ArrayList<String>()
        if (s.hygiene > 0.2f || s.has("愛乾淨")) steps += "bathe"
        if (s.skill("料理") >= 3) steps += "cook"
        if (s.axis(Axis.DILIGENT) > 0.2f) steps += "tidy"
        if (s.skill("閱讀") >= 2 || sim.mods(p).act("read") > 1.3f) steps += "read"
        if (s.roomPref == "要有植物" || sim.mods(p).act("water") > 1.3f) steps += "water"
        if (steps.size < 2) steps += r.pick(listOf("read", "window", "tv", "relax"))
        p.plan += steps.distinct().filter { Acts[it]?.let { a -> sim.canDo(p, a) } == true }.take(3)
    }
    private fun newDay() {
        for (p in life.people) {
            val r = Rng.of(life.seed, "day:${life.day}:${p.id}")
            if (r.chance(0.85)) { val s = r.pick(DayStatuses.ALL.values.toList()); p.status = s.id; p.statusDay = life.day; if (s.mood > 0) sim.addMood(p, "dayup") else if (s.mood < 0) sim.addMood(p, "daydown") }
            makePlan(p, r)
            if (p.wish == null || p.wish!!.done || life.day - p.wish!!.day > 3) { if (r.chance(0.5)) newWish(p, r) else if (p.wish?.done == true) p.wish = null }
        }
    }
    /** the daily settlement (plan C-04): steps need two days in a row, unused friendships fade, flavour tags, quarrels cool off */
    internal fun settle() {
        val yesterday = if (st.settledDay < 0) life.day - 1 else st.settledDay
        if (st.cards.none { it.day == yesterday }) dayCard(yesterday)
        st.settledDay = life.day
        val ppl = life.people
        for (a in ppl) for (b in ppl) {
            if (a === b) continue
            val r0 = sim.rel(a.id, b.id) ?: continue
            if (r0.locked) continue
            var r = r0
            val met = pair(a.id, b.id).lastDay.let { it >= 0 && it >= yesterday }
            if (met) r = r.copy(seenDay = yesterday)
            val gap = (life.day - 1) - (if (r.seenDay < 0) life.day - 1 else r.seenDay)
            if (gap >= 3) r = r.copy(familiar = r.familiar - 1, like = if (r.like > 30) r.like - 1 else r.like)
            if (r.kind in SocialActs.LADDER) {
                val target = SocialActs.LADDER[Will.stageFrom(r)]
                r = if (target == r.kind) r.copy(pend = "", pendDays = 0)
                else if (r.pend == target) r.copy(pendDays = r.pendDays + 1) else r.copy(pend = target, pendDays = 1)
                if (r.pend.isNotEmpty() && r.pendDays >= 2) {
                    val up = SocialActs.LADDER.indexOf(r.pend) > SocialActs.LADDER.indexOf(r.kind)
                    sim.log(a, if (up) "覺得${b.name}是「${r.pend}」了" else "和${b.name}的關係淡了（${r.kind} → ${r.pend}）", kind = "social", weight = if (up) 3 else 2, with = b.id)
                    r = r.copy(kind = r.pend, pend = "", pendDays = 0)
                }
            }
            r = r.copy(flavor = flavors(a, b, r))
            val rr = r; relUpdate(a, b) { rr }
        }
        // quarrels cool off after three days: make up, or drift apart
        for (f in st.feuds.toList()) if (life.minute - f.since > 3 * 1440) {
            val a = sim.person(f.a) ?: continue; val b = sim.person(f.b) ?: continue
            st.feuds.remove(f)
            if ((a.spec.axis(Axis.GENTLE) + b.spec.axis(Axis.GENTLE)) > 0f || likeBoth(a, b) >= 50) { for (x in listOf(a, b)) sim.addMood(x, "madeup"); sim.log(a, "和${b.name}的冷戰，時間沖淡了，又說話了", kind = "social", weight = 2, with = b.id); count(a.id, b.id, "makeup") }
            else { for ((x, y) in listOf(a to b, b to a)) relUpdate(x, y) { it.copy(familiar = it.familiar - 6, like = it.like - 3) }; sim.log(a, "和${b.name}漸漸疏遠了", kind = "social", weight = 2, with = b.id) }
        }
        // chores: the one who did everything remembers it (plan B-05)
        st.choresYesterday.clear(); st.choresYesterday.putAll(st.chores); st.chores.clear()
        for (a in ppl) for (b in ppl) {
            if (a === b) continue
            if ((st.choresYesterday[a.id] ?: 0) >= 3 && (st.choresYesterday[b.id] ?: 0) == 0 && !a.desk && !b.desk) {
                val g = grudge(a.id, b.id)?.takeIf { it.what.contains("家事") }
                if (g != null) g.weight++ else remember(a, b.id, Memory.GRUDGE, "家事都是我在做", 1)
                st.sparks.filter { it.a == a.id && it.b == b.id }.forEach { it.heat++ }
            }
        }
        checkWishes()
        newDay()
    }
    private fun flavors(a: Person, b: Person, r: Rel): List<String> {
        val n = pair(a.id, b.id).n; fun c(k: String) = n[k] ?: 0
        val back = sim.rel(b.id, a.id); val out = ArrayList<String>()
        if (c("all") >= 30 && r.like >= 70 && (back?.like ?: 0) >= 70) out += "死黨"
        if (c("quarrel") >= 4 && r.like < 35) out += "宿敵"
        if (c("quarrel") >= 3 && r.like >= 60) out += "相愛相殺"
        if (c("meal") >= 5) out += "飯友"
        if (c("稱讚") >= 6) out += "商業互吹"
        if (c("makeup") >= 2) out += "莫名其妙絕交又火速和好"
        if (c("ask") >= 6 || c("聊天") >= 25 && a.spec.age > b.spec.age + 10) out += "師徒"
        if (romanceOk(a, b) && r.kind != "戀人") { if (r.crush >= 40 && (back?.crush ?: 0) >= 40) out += "雙向暗戀" else if (r.crush >= 40 && (back?.crush ?: 0) < 10) out += "單戀" }
        return out
    }
    /** the day-end card (plan J-06): the three biggest things of the day */
    internal fun dayCard(day: Long) {
        if (day < 1 || st.cards.any { it.day == day }) return
        val from = floor(life.startMinute / 1440) * 1440 + (day - 1) * 1440; val to = from + 1440
        val lines = life.log.filter { it.minute >= from && it.minute < to && it.who.isNotEmpty() && it.weight >= 2 }.sortedWith(compareByDescending<LogLine> { it.weight }.thenBy { it.minute }).take(3).map { it.text }
        val card = DayCard(day, lines.ifEmpty { listOf("平靜的一天。大家都過得很好。") })
        st.cards += card; while (st.cards.size > 30) st.cards.removeAt(0)
        mail("", "day", "第 $day 天結束了", card.lines.joinToString("\n"))
    }
    fun mail(who: String, kind: String, title: String, text: String) { st.mail += Mail(st.nextId++, life.minute, who, kind, title, text); while (st.mail.size > 100) st.mail.removeAt(0) }

    // ================= cooking for everyone (B-06), tasting (A-10), chores (B-05) =================
    fun mealTime() = sim.hour in 10.5..13.5 || sim.hour in 17.0..20.0
    fun canEat(p: Person) = st.pot?.let { it.servings > 0 && p.id !in it.eaters && life.minute - it.minute < 300 } == true
    /** extra weight for an activity from today's status, the plan, the shared pot and the house (sleepers, quarrels) */
    internal fun extra(p: Person, a: Activity, room: String): Pair<Float, String?> {
        var k = 1f; var why: String? = null
        statusOf(p)?.let { s -> k *= s.act[a.id] ?: 1f; for (t in a.tags) k *= s.act[t] ?: 1f; if ((s.act[a.id] ?: 1f) > 1.3f) why = "今天${s.zh}" }
        if (p.plan.firstOrNull() == a.id) { k *= 2.2f; why = "照計畫：" + p.plan.take(2).joinToString("，再") { "先" + (Acts[it]?.zh ?: it) }.replaceFirst("，再先", "，再") }
        if (a.id in NOISY && life.people.any { it !== p && sim.asleep(it) && sim.roomOf(it) == room }) k *= 0.15f
        if (a.id == "cook" && mealTime() && st.pot == null && life.people.count { !it.desk } >= 2) { k *= 1.5f + 0.2f * p.spec.skill("料理") + 0.4f * (sim.mods(p).act("s:照顧") - 1f).coerceAtLeast(0f); why = "到了飯點，想煮給大家吃" }
        if (a.id == "meal" && canEat(p)) { k *= 2f; why = "${sim.person(st.pot!!.cook)?.name ?: "有人"}煮了飯" }
        if (a.id == "dishes" && st.dishes >= 3) { k *= 1f + 0.5f * p.spec.axis(Axis.DILIGENT); why = "水槽裡堆了 ${st.dishes} 個碗" }
        st.feuds.forEach { f -> val other = if (f.a == p.id) f.b else if (f.b == p.id) f.a else null; if (other != null && sim.person(other)?.let { sim.roomOf(it) } == room) k *= 0.5f }
        return k to why
    }
    /** the bathroom is taken: wait outside (plan 12.11 共用設施排隊) */
    internal fun queueCand(p: Person, dist: IntArray, out: ArrayList<LifeSim.Cand>) {
        if (p.need(Need.HYGIENE) > 45) return
        val tubs = sim.house.pieces.indices.filter { sim.house.pieces[it].kind == "tub" }
        if (tubs.isEmpty() || tubs.any { sim.reservedBy(it, 0) == null || sim.reservedBy(it, 0) == p.id }) return
        val tub = sim.house.pieces[tubs[0]]
        val (tx, ty) = sim.grid.nearestWalkable(tub.x + 0.5f, tub.y + 2.2f)
        if (dist[ty * sim.grid.w + tx] < 0) return
        out += LifeSim.Cand(Acts["queue"]!!, -1, -1, tx + 0.5f, ty + 0.5f, 3f + (45f - p.need(Need.HYGIENE)) / 10f, listOf("浴室有人，在外面排隊"))
    }
    internal fun cooked(p: Person, a: Activity, r: Rng): Boolean {
        val n = life.people.count { !it.desk }
        if (n < 2 || (a.id == "cook" && !mealTime())) return false
        val sweet = a.id == "bake"
        val pool = Dishes.ALL.values.filter { it.sweet == sweet && it.skill <= p.spec.skill("料理") + 1 }
        val dish = pool.maxByOrNull { (p.spec.tastes[it.taste] ?: 0) * 2 + r.nextFloat() } ?: return false
        st.pot = Pot(dish.id, p.id, n, (1 + p.spec.skill("料理") / 2 + r.nextInt(2)).coerceIn(1, 4), life.minute)
        sim.say(p, if (sweet) "${dish.zh}做好了，大家來吃！" else "飯煮好了，大家來吃${dish.zh}！")
        sim.log(p, "煮了一大鍋${dish.zh}給大家", kind = "life", weight = 2)
        return true
    }
    /** the first bite of the shared pot: taste, a line, a discovery; the cook gets the thanks (or not) */
    internal fun ate(p: Person) {
        val pot = st.pot ?: return; if (p.id in pot.eaters || pot.servings <= 0) return
        pot.servings--; pot.eaters += p.id; st.dishes++
        val d = Dishes.ALL[pot.dish] ?: return
        val t = (p.spec.tastes[d.taste] ?: 0) + (if (p.spec.likes.any { it.contains(d.zh) || d.zh.contains(it) }) 1 else 0) - (if (p.spec.dislikes.any { it.contains(d.zh) || it.contains(d.taste) }) 2 else 0)
        val score = t + (pot.quality - 2)
        p.tasted["dish:${d.id}"] = t.coerceIn(-1, 1)
        sim.addMood(p, if (score >= 1) "tasty" else if (score < 0) "yuck" else "meal")
        if (p.id != pot.cook) sim.say(p, when { score >= 2 -> "好好吃！這是什麼魔法？"; score >= 1 -> "嗯！${d.zh}很好吃。"; score >= 0 -> "還不錯。"; else -> "……這個${d.taste}味，我不太行。" })
        val cook = sim.person(pot.cook)
        if (cook != null && cook !== p) {
            count(p.id, cook.id, "meal")
            if (score >= 1) { remember(p, cook.id, Memory.FAVOR, "煮了好吃的${d.zh}", 1); sim.addMood(cook, "praised"); relUpdate(p, cook) { it.copy(like = it.like + 2) } }
        }
        for (o in pot.eaters) if (o != p.id && o != pot.cook) count(p.id, o, "meal")
        sim.log(p, "吃了${cook?.name ?: "大家"}煮的${d.zh}" + when { score >= 1 -> "，很喜歡"; score < 0 -> "，不太合口味"; else -> "" }, kind = "life", weight = 1)
        if (pot.servings <= 0 && !d.sweet) st.pot = null
    }
    internal fun chore(p: Person, what: String) { if (what == "dishes") st.dishes = 0; st.chores[p.id] = (st.chores[p.id] ?: 0) + 1 }
    internal fun actDone(p: Person, id: String) { if (p.plan.firstOrNull() == id) p.plan.removeAt(0) }
    /** they would not do it (several times): the plan step is dropped, with the reason */
    internal fun planSkipped(p: Person) { val s = p.plan.removeFirstOrNull() ?: return; sim.log(p, "本來想${Acts[s]?.zh ?: s}，後來改變主意了", kind = "life", weight = 1) }
    internal fun fed(p: Person, food: String, t: Int) {
        p.tasted[food] = t
        askDone(p, "snack", food)
        p.wish?.let { w -> if (!w.done && w.kind == "eat" && w.thing == food) wishDone(p, w) }
        p.worry?.let { if (it.kind == "hungry" && p.need(Need.FOOD) > 50) p.worry = null }
    }
    internal fun petted(p: Person, part: String) {
        askDone(p, "pet")
        p.wish?.let { w -> if (!w.done && w.kind == "petted" && part == "頭") wishDone(p, w) }
    }
    internal fun woke(p: Person) {
        statusOf(p)?.let { s -> if (life.minute - (p.recent["statusSaid"] ?: -1e9) > 600) { p.recent["statusSaid"] = life.minute; sim.say(p, s.line) } }
    }

    // ================= talking with you (plan E-04) =================
    val YOU_TOPICS = listOf("最近怎麼樣", "喜歡什麼", "家裡的人", "你的事")
    fun youChat(id: String, topic: String): List<String> {
        val p = sim.person(id) ?: return emptyList(); val r = sim.rng; val s = p.spec
        val first = life.minute - p.lastYouChat > 30
        val lines = when (topic) {
            "最近怎麼樣" -> { val top = p.moods.maxByOrNull { kotlin.math.abs(Moods.ALL[it.id]?.value ?: 0) }?.let { Moods.ALL[it.id] }
                listOf(if (top == null) "很平常的一天。" else if (top.value >= 0) "${top.zh}，所以心情不錯。" else "嗯……${top.zh}。") + (statusOf(p)?.let { listOf("而且今天${it.zh}。") } ?: emptyList()) }
            "喜歡什麼" -> listOf(if (s.likes.isEmpty()) "我也不知道自己喜歡什麼……你覺得呢？" else "我喜歡${s.likes.take(2).joinToString("和")}。", if (s.dream.isNotBlank()) "總有一天，我要${s.dream}。" else "你呢？你喜歡什麼？")
            "家裡的人" -> { val o = life.people.filter { it !== p && !it.desk }
                if (o.isEmpty()) listOf("這裡只有我一個人……不過有你在。") else { val q = r.pick(o); val rel = sim.rel(p.id, q.id)
                    listOf("${nick(q)}啊……" + when { rel == null -> "還不太熟。"; feud(p.id, q.id) != null -> "我們現在在冷戰。哼。"; rel.like >= 70 -> "是我很重要的人。"; rel.like >= 45 -> "人很好喔。"; rel.like < 25 -> "我們……不太合。"; else -> "還可以吧。" }) } }
            else -> listOf(if (s.story.isNotBlank()) s.story.take(40) else "我的事？沒什麼特別的啦。", s.memories.firstOrNull()?.let { "我還記得$it。" } ?: "你要多來陪我喔。")
        }
        if (first) { p.affinity = (p.affinity + 1).coerceIn(0, 100); p.setNeed(Need.ATTENTION, p.need(Need.ATTENTION) + 12f); p.lastYouChat = life.minute }
        p.knows.entries.firstOrNull()?.let { (k, v) -> if (r.chance(0.3)) return lines.map { Speech.say(s, it, r, p.affinity, true) } + Speech.say(s, "你說過你${QUESTION_ZH[k] ?: ""}$v，我記得喔。", r, p.affinity, true) }
        return lines.map { Speech.say(s, it, r, p.affinity, true) }
    }
    data class Question(val key: String, val text: String, val options: List<String>)
    val QUESTIONS = listOf(Question("taste", "你喜歡甜的還是鹹的？", listOf("甜的", "鹹的")), Question("time", "早上和晚上，你比較喜歡哪個？", listOf("早上", "晚上")),
        Question("place", "如果可以去任何地方，你想去哪？", listOf("海邊", "山上", "待在家")), Question("rain", "你喜歡下雨天嗎？", listOf("喜歡", "不喜歡")),
        Question("pet", "你喜歡貓還是狗？", listOf("貓", "狗", "都喜歡")))
    val QUESTION_ZH = mapOf("taste" to "喜歡", "time" to "喜歡", "place" to "想去", "rain" to "對下雨天：", "pet" to "喜歡")
    /** they ask you something (once per question) */
    fun question(id: String): Question? { val p = sim.person(id) ?: return null; return QUESTIONS.firstOrNull { it.key !in p.knows } }
    fun answerQuestion(id: String, key: String, option: String): String {
        val p = sim.person(id) ?: return ""; p.knows[key] = option; p.affinity = (p.affinity + 2).coerceIn(0, 100)
        sim.log(p, "你告訴${p.name}：${QUESTION_ZH[key]}$option", kind = "you", weight = 1)
        val same = when (key) { "taste" -> (p.spec.tastes[option.take(1)] ?: 0) > 0; "time" -> (option == "早上") == (p.spec.wake <= 7); else -> false }
        return Speech.say(p.spec, if (same) "真的嗎！我也是！" else "原來你$option，我記住了。", sim.rng, p.affinity, true)
    }

    // ================= minigames with you (plan L-01, L-02) =================
    class RpsGame(var you: Int = 0, var them: Int = 0, var last: Pair<Int, Int>? = null, var hand: Int = 0)
    private val rpsGames = HashMap<String, RpsGame>()
    /** start: the first hand is already chosen; returns the tell (or null when there is none this time) */
    fun rpsStart(id: String): String? { val p = sim.person(id) ?: return null; val g = RpsGame(); g.hand = Rps.pick(p.spec, null, sim.rng); rpsGames[id] = g; return Rps.tell(g.hand, sim.rng) }
    class RpsRound(val theirs: Int, val result: Int, val you: Int, val them: Int, val over: Boolean, val line: String, val nextTell: String?)
    fun rpsPlay(id: String, yours: Int): RpsRound? {
        val p = sim.person(id) ?: return null; val g = rpsGames[id] ?: return null
        val theirs = g.hand; val j = Rps.judge(yours, theirs)
        if (j > 0) g.you++ else if (j < 0) g.them++
        g.last = theirs to yours
        val over = g.you >= 2 || g.them >= 2
        val line = when { over && g.you >= 2 -> "輸了……再來一次啦！"; over -> "我贏了！嘿嘿。"; j > 0 -> "嗚，被你猜中了。"; j < 0 -> "這局我贏！"; else -> "平手！" }
        var tell: String? = null
        if (over) {
            rpsGames.remove(id); p.setNeed(Need.FUN, p.need(Need.FUN) + 25f); p.setNeed(Need.ATTENTION, p.need(Need.ATTENTION) + 15f); sim.addMood(p, "played"); p.affinity = (p.affinity + 2).coerceIn(0, 100)
            askDone(p, "rps"); p.wish?.let { w -> if (!w.done && w.kind == "rps") wishDone(p, w) }; p.worry?.let { if (it.kind == "bored") p.worry = null }
            sim.log(p, "和你猜拳，${if (g.you >= 2) "你贏了" else "${p.name}贏了"}（${g.you}：${g.them}）", kind = "you", weight = 2)
        } else { g.hand = Rps.pick(p.spec, g.last, sim.rng); tell = Rps.tell(g.hand, sim.rng) }
        return RpsRound(theirs, j, g.you, g.them, over, Speech.say(p.spec, line, sim.rng, p.affinity, true), tell)
    }
    class HideGame(val piece: Int, var misses: Int = 0)
    private val hideGames = HashMap<String, HideGame>()
    /** they hide (the screen stops drawing them until found) */
    fun hideStart(id: String): Boolean {
        val p = sim.person(id) ?: return false; if (sim.asleep(p) || p.desk) return false
        sim.breakFor(p); hideGames[id] = HideGame(HideSeek.spot(p.spec, sim.house, sim.rng)); return true
    }
    fun hiding(id: String): Int? = hideGames[id]?.piece
    class HideResult(val found: Boolean, val over: Boolean, val line: String)
    fun hideSearch(id: String, piece: Int): HideResult? {
        val p = sim.person(id) ?: return null; val g = hideGames[id] ?: return null
        val found = piece == g.piece
        if (!found) g.misses++
        val over = found || g.misses >= 4
        val line = when { found -> "被找到了！你好厲害！"; over -> "我在這裡！（從${Furniture.kind(sim.house.pieces[g.piece].kind).zh}後面跳出來）"; g.misses >= 2 -> HideSeek.hint(sim.house, g.piece); else -> "（沒有人……）" }
        if (over) {
            hideGames.remove(id)
            val pc = sim.house.pieces[g.piece]; val (tx, ty) = sim.grid.nearestWalkable(pc.x + 0.5f, pc.y + 1.5f); p.x = tx + 0.5f; p.y = ty + 0.5f
            p.setNeed(Need.FUN, p.need(Need.FUN) + 25f); sim.addMood(p, "played"); p.affinity = (p.affinity + 2).coerceIn(0, 100)
            askDone(p, "hide"); p.wish?.let { w -> if (!w.done && w.kind == "hide") wishDone(p, w) }
            sim.log(p, "和你玩躲貓貓，${if (found) "躲在${Furniture.kind(pc.kind).zh}被你找到了" else "躲在${Furniture.kind(pc.kind).zh}沒被找到"}", kind = "you", weight = 2)
        }
        return HideResult(found, over, if (line.startsWith("（")) line else Speech.say(p.spec, line, sim.rng, p.affinity, true))
    }

    // ================= what the screen reads =================
    /** a short paragraph about what they are doing (plan 13.3; null when not one of the ten activities) */
    fun narrate(id: String): String? {
        val p = sim.person(id) ?: return null; val a = p.act ?: return null
        if (!sim.body(id).arrivedAct) return null
        val m = sim.moodValue(p).let { if (it >= 2) 1 else if (it <= -2) -1 else 0 }
        return Narrate.describe(p.name, if (a == "tvrug") "tv" else if (a == "sitrug") "daydream" else a, m, Topics.conceptsOf(p.spec, life.tags), Rng.of(life.seed, "narr:${p.id}:${p.actStart.toLong()}"))
    }
    fun cardFor(day: Long) = st.cards.firstOrNull { it.day == day }
    fun unreadMail() = st.mail.count { !it.read }

    companion object {
        val NOISY = setOf("tv", "tvrug", "sing", "game", "workout", "posing", "sword", "magic")
        val CONTROL_ZH = mapOf("observe" to "觀察", "suggest" to "建議", "command" to "操控")
        const val LIVELY_ZH = "安靜／普通／熱鬧"
    }
}
