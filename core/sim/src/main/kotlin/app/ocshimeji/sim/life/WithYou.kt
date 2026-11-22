package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.CustomLine
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.social.Capsule
import app.ocshimeji.sim.social.Capsules
import app.ocshimeji.sim.social.Crazes
import app.ocshimeji.sim.social.Decision
import app.ocshimeji.sim.social.HouseRules
import app.ocshimeji.sim.social.Messages
import app.ocshimeji.sim.social.Msg
import app.ocshimeji.sim.social.Notes
import app.ocshimeji.sim.social.Photo
import app.ocshimeji.sim.social.RuleDef

/**
 * 1.8.0 (R7 second batch, 「和你」): what passes between you and the residents — their messages (E-07), the photos you take (E-09),
 * your notes (P-03), time capsules (P-04), house rules (P-11), asking to change rooms (P-13), the little games (L-03, L-04),
 * their own lines (M-04). Runs every 15 game minutes and once a day with its own `Rng.of(seed, "you:…")`.
 */
class WithYou(private val sim: LifeSim) {
    private val life get() = sim.life
    val st get() = life.you
    private val day get() = life.day
    private fun home() = life.people.filter { !it.desk && it.out == null }

    internal fun step(live: Boolean) {
        if (life.arriving) return
        if (st.lastDay < 0) st.lastDay = day
        if (day != st.lastDay) { st.lastDay = day; newDay(live) }
        if (life.minute - st.lastTick < 15) return
        st.lastTick = life.minute
        tick(live, Rng.of(life.seed, "you:${(life.minute / 15).toLong()}"))
    }
    private fun newDay(live: Boolean) {
        val r = Rng.of(life.seed, "youday:$day")
        for (c in st.capsules) if (!c.opened && day >= c.openDay) openCapsule(c, live)
        if ("dishes" in st.rules) dishesTurn()?.let { p -> sim.log(p, "今天輪到${p.name}洗碗（家規）", kind = "you", weight = 1) }
        roomRequests(live, r)
    }

    // ---------------- E-07 messages ----------------
    fun messages(): List<Msg> = st.messages.asReversed()
    fun unread() = st.messages.count { it.reply < 0 }
    private fun sentToday(p: Person) = st.messages.count { it.from == p.id && (it.minute / 1440).toLong() == (life.minute / 1440).toLong() }
    private fun tick(live: Boolean, r: Rng) {
        val h = sim.hour
        for (p in life.people) {
            if (sentToday(p) >= 2 || sim.asleep(p)) continue
            when {
                h in 22.0..23.5 && p.affinity >= 40 && st.messages.none { it.from == p.id && it.kind == "goodnight" && (it.minute / 1440).toLong() == (life.minute / 1440).toLong() } && r.chance(0.35) ->
                    send(p, "goodnight", r.pick(Messages.GOODNIGHT), Messages.OPTIONS["goodnight"]!!, live)
                sim.moodValue(p) <= -2 && r.chance(0.08) -> { val m = p.moods.filter { (Moods.ALL[it.id]?.value ?: 0) < 0 }.mapNotNull { Moods.ALL[it.id]?.zh }.firstOrNull() ?: "有點累"
                    send(p, "complain", r.pick(Messages.COMPLAIN).replace("{心情}", m), Messages.OPTIONS["complain"]!!, live) }
                h in 9.0..21.0 && r.chance(0.015) -> life.log.lastOrNull { it.who == p.id && it.weight >= 2 && it.kind != "you" && life.minute - it.minute < 240 }?.let { l ->
                    send(p, "share", r.pick(Messages.SHARE).replace("{事}", l.text.substringAfter("：")), Messages.OPTIONS["share"]!!, live) }
                h in 10.0..20.0 && r.chance(0.01) -> sim.society.question(p.id)?.let { q -> send(p, "question", q.text, q.options, live, q.key) }
            }
        }
    }
    private fun send(p: Person, kind: String, text: String, options: List<String>, live: Boolean, key: String = "") {
        val m = Msg(st.nextId++, p.id, life.minute, kind, text, options, key = key); st.messages += m; while (st.messages.size > 100) st.messages.removeAt(0)
        if (live) sim.events += SimEvent("message", p.id, m.id.toString())
    }
    /** your answer; returns what they say back */
    fun reply(id: Int, i: Int): String {
        val m = st.messages.firstOrNull { it.id == id } ?: return ""; if (m.reply >= 0) return ""; val p = sim.person(m.from) ?: return ""
        m.reply = i.coerceIn(0, m.options.size - 1); p.affinity = (p.affinity + 2).coerceIn(0, 100); p.setNeed(Need.ATTENTION, p.need(Need.ATTENTION) + 15f)
        if (m.kind == "complain") sim.addMood(p, "chatted")
        if (m.kind == "question" && m.key.isNotEmpty()) return sim.society.answerQuestion(p.id, m.key, m.options[m.reply])
        sim.log(p, "收到你的回覆：「${m.options[m.reply]}」", kind = "you", weight = 1)
        return Messages.REPLIES[m.kind] ?: "嘿嘿。"
    }

    // ---------------- P-03 notes (yours, on someone or on the day; kept forever) ----------------
    fun note(who: String?, text: String, tag: String = ""): String? {
        if (text.isBlank()) return "寫點什麼吧"
        val p = who?.let { sim.person(it) } ?: life.people.firstOrNull() ?: return "沒有住民"
        val t = (if (tag.isNotEmpty() && tag in Notes.TAGS) "#$tag " else "") + text.trim().take(120)
        sim.log(p, "你的筆記：$t", kind = "note", weight = 2); life.log.last().fav = true
        return null
    }
    fun notes(who: String? = null) = life.log.filter { it.kind == "note" && (who == null || it.who == who) }

    // ---------------- E-09 photos (who, poses, frame, filter, stickers) ----------------
    fun takePhoto(who: List<String>, poses: List<String>, filter: String, frame: String, stickers: List<String>, caption: String = ""): Photo? {
        val ppl = who.mapNotNull { sim.person(it) }.filter { !it.desk && it.out == null }; if (ppl.isEmpty()) return null
        val ph = Photo(st.nextId++, life.minute, ppl.map { it.id }, ppl.indices.map { poses.getOrElse(it) { "HAPPY" } }, filter, frame, stickers.take(6), sim.sky(), sim.hour, caption.take(30))
        st.photos += ph; while (st.photos.size > 60) st.photos.removeAt(0)
        for (p in ppl) { sim.addMood(p, "photo"); p.setNeed(Need.ATTENTION, p.need(Need.ATTENTION) + 8f) }
        sim.log(ppl[0], "你幫${ppl.joinToString("、") { it.name }}拍了一張照片" + if (caption.isNotBlank()) "：「$caption」" else "", kind = "you", weight = 2)
        sim.journal.did("", "photo"); return ph
    }
    fun deletePhoto(id: Int) = st.photos.removeAll { it.id == id }

    // ---------------- P-04 time capsules ----------------
    fun capsuleOpen() = st.capsules.firstOrNull { !it.opened }
    fun bury(yours: String): String? {
        if (capsuleOpen() != null) return "已經埋了一個，打開之後才能再埋"
        if (yours.isBlank()) return "寫一封信給三十天後吧"
        val c = Capsule(st.nextId++, day, day + Capsules.DAYS, yours.trim().take(200)); val r = Rng.of(life.seed, "capsule:${c.id}")
        for (p in life.people) c.theirs[p.id] = r.pick(Capsules.LINES).replace("{近況}", nowOf(p))
        st.capsules += c; sim.log(life.people.first(), "和大家一起埋了時光膠囊，${Capsules.DAYS} 天後打開", kind = "you", weight = 3)
        return null
    }
    private fun nowOf(p: Person): String {
        sim.drama.crazeOf(p)?.let { return "最近迷上了${Crazes.ACTS[it.act]}" }
        if (p.spec.dream.isNotBlank()) return "還在朝著「${p.spec.dream}」努力"
        life.people.filter { it !== p }.maxByOrNull { sim.rel(p.id, it.id)?.like ?: 0 }?.let { q -> if ((sim.rel(p.id, q.id)?.like ?: 0) >= 60) return "和${q.name}很要好" }
        return "每天都過得很開心"
    }
    private fun openCapsule(c: Capsule, live: Boolean) {
        c.opened = true
        sim.society.mail(life.people.first().id, "capsule", "時光膠囊打開了", "你寫的：${c.yours}\n" + c.theirs.entries.joinToString("\n") { (id, t) -> "${sim.person(id)?.name ?: "（搬走的人）"}：$t" })
        for (p in home()) { sim.addMood(p, "capsule"); if (live) sim.say(p, "還記得我們埋膠囊的那天嗎？") }
        sim.log(life.people.first(), "大家一起打開了 ${Capsules.DAYS} 天前埋的時光膠囊", kind = "you", weight = 3)
        if (live) sim.events += SimEvent("capsule", life.people.first().id, c.id.toString())
    }

    // ---------------- P-11 house rules ----------------
    /** will they keep it? (diligent and gentle keep rules; a temper, 嘴硬心軟, 好勝, 急性子 push back) */
    fun keeps(p: Person, rule: String): Boolean {
        val s = p.spec; var k = 0.5f + 0.35f * s.axis(Axis.DILIGENT) + 0.2f * s.axis(Axis.GENTLE) - 0.3f * s.temper
        for (t in listOf("嘴硬心軟", "好勝", "急性子")) if (s.has(t)) k -= 0.2f
        if (rule == "outside" && s.axis(Axis.ACTIVE) < -0.2f) k -= 0.3f
        return k >= 0.4f
    }
    fun setRule(id: String, on: Boolean): String? {
        val def = HouseRules.ALL[id] ?: return "沒有這條家規"
        if (!on) { st.rules.remove(id); sim.log(life.people.first(), "你拿掉了家規「${def.zh}」", kind = "you", weight = 1); return null }
        if (id in st.rules) return null; if (st.rules.size >= HouseRules.MAX) return "家規最多 ${HouseRules.MAX} 條"
        st.rules += id; sim.log(life.people.first(), "你定了家規：「${def.zh}」", kind = "you", weight = 2)
        for (p in home()) if (keeps(p, id)) sim.say(p, "好，我會遵守。") else { sim.say(p, def.protest); sim.addMood(p, "annoyed"); sim.log(p, "抗議家規「${def.zh}」", kind = "event", weight = 1) }
        return null
    }
    private fun dishesTurn(): Person? { val ppl = life.people.sortedBy { it.id }; if (ppl.isEmpty()) return null; return ppl[(day % ppl.size).toInt()] }
    /** what the house rules do to wanting an activity now */
    fun appealK(p: Person, a: Activity): Float {
        var k = 1f; val h = sim.hour.toInt()
        for (id in st.rules) { val d = HouseRules.ALL[id] ?: continue; if (a.id !in d.acts) continue
            val inHours = if (d.from <= d.to) h >= d.from && h < d.to else h >= d.from || h < d.to; if (!inHours) continue
            if (id == "dishes" && dishesTurn() !== p) continue
            if (keeps(p, id)) k *= d.k }
        return k
    }
    fun rule(id: String): RuleDef? = HouseRules.ALL[id]

    // ---------------- P-13 asking to change rooms (you decide) ----------------
    private fun roomRequests(live: Boolean, r: Rng) {
        if (sim.drama.pending().any { it.kind == "room" }) return
        for (a in life.people) for (b in life.people) { if (a === b || a.room != b.room) continue
            val rel = sim.rel(a.id, b.id) ?: continue; if (rel.conflict < 40 && rel.like >= 25) continue
            if (!r.chance(0.5)) continue
            val text = "${a.name}想換房間（和${b.name}住同一間處不來）。要讓牠換嗎？"
            sim.drama.askFrom("room", a, b, text, listOf("幫牠換房間", "再忍耐一下"), live); return }
    }
    /** your answer to a room request */
    internal fun decide(d: Decision, option: Int): String {
        if (d.kind != "room") return ""
        val a = sim.person(d.who) ?: return ""
        if (option != 0) { sim.addMood(a, "annoyed"); sim.log(a, "決定再忍耐一下，不換房間", kind = "you", weight = 1); return "${a.name}再忍耐一下" }
        val zh = moveRoom(a) ?: return "沒有空的房間可以換"
        sim.addMood(a, "newroom"); sim.log(a, "搬到了$zh", kind = "event", weight = 2); return "${a.name}搬到了$zh"
    }
    /** to another bedroom with a free bed (house rules checked); null = nowhere to go */
    fun moveRoom(a: Person): String? {
        val h = sim.house; val ts = life.people.map { Tenant(it.id, it.name, it.adult) }
        for (room in h.bedrooms) { if (room.id == a.room) continue
            val rooms = life.people.associate { it.id to (if (it === a) room.id else it.room) }
            if (Houses.checkRooms(h, ts, rooms) { x, y -> app.ocshimeji.sim.chars.Relations.family(life.rels, x, y) } == null) { a.room = room.id; sim.relayout(); return room.zh } }
        return null
    }

    // ---------------- L-03 / L-04 the little games ----------------
    /** a game played with someone: stars, coins (through the ledger), fun and closeness */
    fun reward(game: String, pid: String, score: Int): Int {
        val p = sim.person(pid); val coins = when (game) { "catch" -> (score / 2).coerceIn(0, 30); else -> (score * 5).coerceIn(0, 15) }
        if (coins > 0) sim.economy.earn(coins, if (game == "catch") "接點心遊戲" else "翻牌遊戲")
        if (score > (st.best[game] ?: 0)) st.best[game] = score
        p?.let { it.setNeed(Need.FUN, it.need(Need.FUN) + 20f); it.affinity = (it.affinity + 3).coerceIn(0, 100); sim.log(it, (if (game == "catch") "和你玩接點心，接到 $score 個" else "和你玩翻牌，拿到 $score 顆星"), kind = "you", weight = 2) }
        sim.journal.did(pid, "game:$game"); return coins
    }

    // ---------------- M-04 their own lines ----------------
    fun situation(p: Person): Set<String> {
        val h = sim.hour; val out = HashSet<String>(); out += "any"
        if (h in 6.0..10.0) out += "morning"; if (h >= 20 || h < 2) out += "night"
        val m = sim.moodValue(p); if (m >= 2) out += "happy"; if (m <= -2) out += "sad"
        if (sim.weather() == "rain") out += "rain"; if (p.need(Need.FOOD) < 30) out += "hungry"
        return out
    }
    /** one of their own lines for now (null = none fits) */
    fun customLine(p: Person, r: Rng, extra: String? = null): String? {
        if (p.spec.lines.isEmpty()) return null
        val now = if (extra != null) setOf(extra) else situation(p)
        val fit = p.spec.lines.filter { it.whenKey in now }; if (fit.isEmpty()) return null
        return r.pick(fit.filter { it.whenKey != "any" }.ifEmpty { fit }).text
    }
    @Suppress("unused") private val keepImport = CustomLine("")
}
