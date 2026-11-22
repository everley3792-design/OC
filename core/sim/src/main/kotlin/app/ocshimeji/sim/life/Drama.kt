package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.social.Clique
import app.ocshimeji.sim.social.Cliques
import app.ocshimeji.sim.social.Contests
import app.ocshimeji.sim.social.Craze
import app.ocshimeji.sim.social.Crazes
import app.ocshimeji.sim.social.Debates
import app.ocshimeji.sim.social.Decision
import app.ocshimeji.sim.social.Dream
import app.ocshimeji.sim.social.Dreams
import app.ocshimeji.sim.social.Fears
import app.ocshimeji.sim.social.Gossip
import app.ocshimeji.sim.social.GroupDef
import app.ocshimeji.sim.social.Groups
import app.ocshimeji.sim.social.Nicks
import app.ocshimeji.sim.social.Party
import app.ocshimeji.sim.social.Rumors
import app.ocshimeji.sim.social.SharedSecret
import app.ocshimeji.sim.social.Secrets
import app.ocshimeji.sim.social.Sick
import app.ocshimeji.sim.social.Sickness
import app.ocshimeji.sim.social.Tunes
import app.ocshimeji.sim.social.Whim
import app.ocshimeji.sim.social.Whims
import app.ocshimeji.sim.social.Will
import app.ocshimeji.sim.social.WhatIf
import kotlin.math.floor

/**
 * 1.7.0 (R7 first batch): the bigger stories of life — kept apart from `LifeSim` and `Society` (which were getting too big).
 * Runs every 15 game minutes and once a day, live and in catch-up, always with its own `Rng.of(seed, "drama:…")` (it never draws from the live stream).
 * Anything that needs you (a debate to judge, growing a year older, a confession) is a `Decision`: shown when you are watching,
 * otherwise it waits (and after six hours the gentle default is taken). Relationships only change through `Society.relUpdate`.
 */
class Drama(private val sim: LifeSim) {
    private val life get() = sim.life
    val st get() = life.drama
    private val day get() = life.day
    private fun home() = life.people.filter { !it.desk && it.out == null }
    private fun awake() = home().filter { !sim.asleep(it) }
    private fun freeNow() = awake().filter { sim.free(it) }
    private fun like(a: Person, b: Person) = sim.rel(a.id, b.id)?.like ?: 30

    // ---------------- the clock ----------------
    /** tests: switch the stories off to compare */
    var enabled = true
    /** tests: parts switched off ("fears", "sick", "craze", "songs", "gossip", "secrets", "nicks", "debate", "contest", "cook", "group") */
    val off = HashSet<String>()
    internal fun step(live: Boolean) {
        if (life.arriving || !enabled) return
        if (st.lastDay < 0) st.lastDay = day
        if (day != st.lastDay) { st.lastDay = day; newDay(live) }
        if (life.minute - st.lastTick < 15) return
        st.lastTick = life.minute
        tick(live, Rng.of(life.seed, "drama:${(life.minute / 15).toLong()}"))   /* its own stream: the stories never reshuffle the rest of life */
    }
    private fun dateIn(n: Int): String { val d = java.time.LocalDate.ofEpochDay(floor(life.minute / 1440).toLong() + n); return "%02d-%02d".format(d.monthValue, d.dayOfMonth) }

    // ---------------- once a day ----------------
    private fun newDay(live: Boolean) {
        val r = Rng.of(life.seed, "dramaday:$day")
        for (p in life.people) {
            if (sim.moodValue(p) > 0) sim.journal.did(p.id, "gooddays")
            dreamCheck(p)
            st.sick[p.id]?.let { s -> if (day >= s.until) { st.sick.remove(p.id); sim.addMood(p, "well"); Sickness.ALL[s.kind]?.let { sim.say(p, it.well); sim.log(p, it.well.trimEnd('。', '！'), kind = "event", weight = 2) } } }
            st.crazes[p.id]?.let { if (day > it.until) { st.crazes.remove(p.id); sim.log(p, "對${Crazes.ACTS[it.act]}的熱潮過去了", kind = "life") } }
            if (st.crazes[p.id] == null && r.chance(0.05)) startCraze(p, r, from = "")
            st.whims[p.id]?.let { if (it.day != day) st.whims.remove(p.id) }
            if (r.chance(0.06)) { val w = r.pick(Whims.ALL); st.whims[p.id] = Whim(w.role, day); sim.addMood(p, "whim"); sim.log(p, "突發奇想：「${w.start.trimEnd('！', '。')}」", kind = "event", weight = 2); if (live) sim.say(p, w.start, toPlayer = true) }
            // Q-14: a birthday in three days — the others start preparing (you can see it; the birthday one cannot)
            if (p.spec.birthday.isNotBlank() && p.spec.birthday == dateIn(3) && st.parties.none { it.who == p.id && it.day == day + 3 }) {
                val helpers = life.people.filter { it !== p && like(it, p) >= 40 }.map { it.id }
                if (helpers.size >= 2) { st.parties += Party(p.id, day + 3, helpers.toMutableList()); val h = sim.person(helpers[0])!!
                    sim.log(h, "和大家偷偷準備${p.name}三天後的驚喜派對（不要說出去）", kind = "event", weight = 2, with = p.id); sim.society.mail(h.id, "party", "驚喜派對", "${helpers.mapNotNull { sim.person(it)?.name }.joinToString("、")}在偷偷準備${p.name}的生日驚喜派對。噓——") }
            }
            // A-14: on the birthday, growing a year older is your choice
            if (p.spec.birthday.isNotBlank() && p.spec.birthday == dateIn(0) && st.decisions.none { it.kind == "grow" && it.who == p.id })
                ask("grow", p, null, "今天是${p.name}的生日。要讓${p.name}長大一歲嗎？（現在 ${p.spec.age} 歲）", listOf("長大一歲", "維持現在的年紀"), live)
        }
        // C-09: friends who are always together become a clique (looked at once a week)
        if (day % 7 == 0L) findCliques(r)
        // Q-09: a stormy night (or now and then) the lights go out
        if (sim.sky() == "storm" && r.chance(0.6) || r.chance(0.03)) { st.night = "blackout"; st.nightDay = day }
        // C-14: two adults who like each other very much (only with romance on) slowly fall for each other
        if (life.romance) for (a in home()) for (b in home()) { if (a === b || a.id > b.id || !a.adult || !b.adult) continue
            val ra = sim.rel(a.id, b.id) ?: continue; val rb = sim.rel(b.id, a.id) ?: continue
            if (ra.kind in Rel.ROMANTIC || ra.kind == "家人" || ra.like < 75 || rb.like < 75) continue
            for ((x, y) in listOf(a to b, b to a)) sim.society.relUpdate(x, y) { it.copy(crush = it.crush + 4) }
            val ca = sim.rel(a.id, b.id)?.crush ?: 0; val cb = sim.rel(b.id, a.id)?.crush ?: 0
            if (ca >= 20 && st.seen["blush:${a.id}:${b.id}"] == null) { st.seen["blush:${a.id}:${b.id}"] = life.minute; sim.log(a, "看到${b.name}時，心跳好像快了一點", kind = "event", weight = 2, with = b.id) }
            if (ca >= 60 && cb >= 60 && st.decisions.none { it.kind == "confess" }) ask("confess", a, b, "${a.name}好像想對${b.name}告白……要讓牠說出口嗎？", listOf("讓牠說", "再等等"), live)
        }
    }

    // ---------------- every 15 minutes ----------------
    private fun tick(live: Boolean, r: Rng) {
        if (live) for (d in st.decisions.toList()) if (life.minute - d.since > 6 * 60) decide(d.id, d.options.size - 1)   /* six hours while you watch and no answer: the gentle default (while you are away it waits for you) */
        if (st.night == "blackout" && st.nightDay == day) { if (sim.hour >= 20 || sim.hour < 5) for (k in life.things.keys.toList()) if (k.startsWith("lamp@")) life.things[k] = "off" }
        else if (st.night.isNotEmpty() && st.nightDay != day) st.night = ""
        if ("fears" !in off) fears(r)
        if ("sick" !in off) sickness(r)
        if ("craze" !in off) crazeSpread(r)
        if ("songs" !in off) songs(live)
        if ("gossip" !in off) gossip(r)
        if ("secrets" !in off) secrets(r)
        if ("nicks" !in off) nicknames(live)
        if (live && "debate" !in off && r.chance(0.025)) debate(r, live)
        if ("contest" !in off && r.chance(0.015)) contest(r)
        if ("cook" !in off && r.chance(0.02)) cookOff(r)
        if ("group" !in off && r.chance(if (live) 0.04 else 0.03)) group(r)
    }

    // ---- A-08 dreams
    fun dreamOf(p: Person) = Dreams.of(p.spec.dream)?.let { d -> d to (st.dreams[p.id] ?: Dream(d.id)) }
    fun dreamProgress(p: Person): Int { val d = Dreams.of(p.spec.dream) ?: return 0; return when (d.metric) {
        "friends" -> life.people.count { it !== p && like(p, it) >= 60 }; else -> sim.journal.count(p.id, d.metric) } }
    private fun dreamCheck(p: Person) {
        val d = Dreams.of(p.spec.dream) ?: return; val ds = st.dreams.getOrPut(p.id) { Dream(d.id) }; if (ds.done || ds.id != d.id) { if (ds.id != d.id) st.dreams[p.id] = Dream(d.id); return }
        val n = dreamProgress(p); val want = ((ds.step + 1) * d.target + 2) / 3
        if (n >= want) { val line = d.steps[ds.step]; ds.step++; sim.say(p, line); sim.addMood(p, if (ds.step >= 3) "dreamcome" else "dreamstep")
            if (ds.step >= 3) { ds.done = true; sim.log(p, "夢想「${p.spec.dream}」實現了！", kind = "event", weight = 3); sim.society.mail(p.id, "dream", "${p.name}的夢想", "「${p.spec.dream}」實現了。$line") }
            else sim.log(p, "離夢想「${p.spec.dream}」又近了一步（${ds.step}/3）", kind = "event", weight = 2) }
    }

    // ---- A-11 fears: scared when it happens; someone staying with them helps; three times and it is better
    fun fearsOf(p: Person) = p.spec.fears.mapNotNull { Fears.of(it) }.filter { it.id !in (st.beaten[p.id] ?: emptyList<String>()) }
    fun scared(p: Person) = p.moods.any { it.id == "afraid" }
    private fun fears(r: Rng) {
        val ppl = awake(); val h = sim.hour
        for (p in ppl) for (f in fearsOf(p)) {
            val now = when (f.id) { "thunder" -> sim.sky() == "storm"; "dark" -> (h >= 21 || h < 5) && st.night == "blackout"; "alone" -> ppl.size == 1 && r.chance(0.2); "bug" -> h in 9.0..18.0 && r.chance(0.01); else -> false }
            if (!now || life.minute - (st.seen["fear:${p.id}"] ?: -1e9) < 180) continue
            st.seen["fear:${p.id}"] = life.minute; sim.addMood(p, "afraid"); sim.say(p, f.line); sim.events += SimEvent("fx", p.id, "sweat")
            sim.log(p, "怕${f.zh}，躲了起來", kind = "event", weight = 2)
            ppl.filter { it !== p && like(it, p) >= 50 }.maxByOrNull { like(it, p) }?.let { q -> sim.say(q, "別怕，我在這裡。", to = p); comfort(p.id, q) }
        }
    }
    /** someone (you, or a friend) stays with a scared one */
    fun comfort(id: String, by: Person? = null): Boolean {
        val p = sim.person(id) ?: return false; if (!scared(p)) return false
        val f = fearsOf(p).firstOrNull() ?: return false; val k = "${p.id}:${f.id}"; st.courage[k] = (st.courage[k] ?: 0) + 1
        p.moods.removeAll { it.id == "afraid" }; sim.log(p, (by?.let { "${it.name}陪在身邊" } ?: "你陪在身邊") + "，比較不怕${f.zh}了", kind = "event", weight = 1, with = by?.id ?: "")
        if (st.courage[k]!! >= Fears.COURAGE) { st.beaten.getOrPut(p.id) { mutableListOf() } += f.id; sim.addMood(p, "brave"); sim.say(p, f.brave); sim.log(p, "克服了對${f.zh}的害怕", kind = "event", weight = 3) }
        return true
    }

    // ---- B-09 sickness (never worse than a few days in bed; friends come to help)
    fun sickOf(p: Person) = st.sick[p.id]
    private fun sickness(r: Rng) {
        val h = sim.hour
        for (p in life.people) {
            if (st.sick[p.id] != null) continue
            if (p.out != null && (sim.weather() == "rain" || sim.weather() == "storm") && r.chance(0.06)) fallSick(p, "cold")
            else if (h in 2.0..4.5 && !p.desk && !sim.asleep(p) && p.out == null && r.chance(0.08)) fallSick(p, "tired")
        }
        for (p in home()) { val s = st.sick[p.id] ?: continue; if (s.cared >= 2) continue
            val q = freeNow().filter { it !== p && like(it, p) >= 45 }.maxByOrNull { like(it, p) } ?: continue
            if (!r.chance(0.3)) continue
            s.cared++; sim.say(q, "你躺好，我煮了熱粥。", to = p); sim.say(p, "……謝謝你。", to = q)
            p.setNeed(Need.ENERGY, p.need(Need.ENERGY) + 15f); for ((a, b) in listOf(p to q, q to p)) sim.society.relUpdate(a, b) { it.copy(like = it.like + 2, trust = it.trust + 2) }
            sim.log(q, "照顧生病的${p.name}", kind = "event", weight = 2, with = p.id)
            if (s.cared == 2 && s.until > day + 1) st.sick[p.id] = Sick(s.kind, s.until - 1, s.cared)   /* being looked after makes it pass sooner */
        }
    }
    fun fallSick(p: Person, kind: String) {
        val d = Sickness.ALL[kind] ?: return; if (st.sick[p.id] != null) return
        st.sick[p.id] = Sick(kind, day + d.days); sim.addMood(p, "sick"); sim.say(p, d.line); sim.log(p, "${d.zh}了，要休息${d.days}天", kind = "event", weight = 2)
        sim.society.mail(p.id, "sick", "${p.name}${d.zh}了", d.line)
    }
    /** they ate after they were already full */
    internal fun onAte(p: Person) { if (p.need(Need.FOOD) >= 99f && Rng.of(life.seed, "tummy:${life.minute.toLong()}:${p.id}").chance(0.3)) fallSick(p, "tummy") }

    // ---- B-13 crazes
    fun crazeOf(p: Person) = st.crazes[p.id]
    private fun startCraze(p: Person, r: Rng, from: String) {
        val opts = Crazes.ACTS.keys.filter { a -> Acts[a]?.let { sim.canDo(p, it) } == true }; if (opts.isEmpty()) return
        val a = if (from.isNotEmpty()) st.crazes[from]?.act?.takeIf { it in opts } ?: return else r.pick(opts)
        st.crazes[p.id] = Craze(a, day + 1 + r.nextInt(2), from); sim.addMood(p, "craze")
        sim.log(p, if (from.isEmpty()) "突然迷上了${Crazes.ACTS[a]}" else "被${sim.person(from)?.name}傳染，也迷上了${Crazes.ACTS[a]}", kind = "event", weight = 2, with = from)
    }
    fun startCraze(p: Person, act: String) { st.crazes[p.id] = Craze(act, day + 2); sim.addMood(p, "craze"); sim.log(p, "突然迷上了${Crazes.ACTS[act]}", kind = "event", weight = 2) }
    private fun crazeSpread(r: Rng) {
        for (p in freeNow()) { if (st.crazes[p.id] != null) continue
            val src = awake().firstOrNull { q -> q !== p && st.crazes[q.id] != null && st.crazes[q.id]!!.from != p.id && like(p, q) >= 60 && sim.roomOf(p) == sim.roomOf(q) } ?: continue   /* seeing a friend do it */
            if (r.chance(0.12)) startCraze(p, r, src.id) }
    }
    /** how much more (or less) they want an activity because of a craze or being sick */
    fun appealK(p: Person, a: Activity): Float {
        var k = 1f; if (!enabled) return k
        if (st.crazes[p.id]?.act == a.id) k *= 2f
        if (st.sick[p.id] != null) { if ("active" in a.tags) k *= 0.25f; if (a.id in setOf("sleep", "nap", "relax", "sofanap", "rest")) k *= 1.6f }
        return k
    }

    // ---- D-02 whims, D-08 what-if answers, dreams: things they say
    fun whimOf(p: Person) = st.whims[p.id]?.takeIf { it.day == day }
    fun idleLine(p: Person, r: Rng): String? {
        whimOf(p)?.let { w -> if (r.chance(0.5)) return Whims.ALL.first { it.role == w.role }.lines.let { r.pick(it) } }
        val ifs = p.knows.entries.filter { it.key.startsWith("if_") }
        if (ifs.isNotEmpty() && r.chance(0.12)) { val (k, v) = r.pick(ifs.toList()); val q = WhatIf.ALL.firstOrNull { it.first == k } ?: return null
            return "你說過「${q.second.removeSuffix("？")}」的話會選「$v」，我一直記得。" }
        if (p.spec.dream.isNotBlank() && r.chance(0.05)) return "總有一天，我要${p.spec.dream}。"
        return null
    }

    // ---- D-05 songs, N-04 themes (the notes go to the screen to be played; the memory keeps the title)
    private fun songs(live: Boolean) {
        for (p in awake()) {
            if (p.act !in setOf("hum", "dance", "music") || sim.moodValue(p) < 2 || (st.seen["song:${p.id}"] ?: -1e9) >= day.toDouble()) continue
            st.seen["song:${p.id}"] = day.toDouble()
            val thing = (p.spec.likes + listOf("今天", "晴天", "大家")).let { Rng.of(life.seed, "songname:${p.id}:$day").pick(it) }
            val title = Rng.of(life.seed, "songtitle:${p.id}:$day").pick(Tunes.TITLES).replace("{物}", thing)
            val notes = Tunes.improv(life.seed, "${p.id}:$day", p.spec.voice.pitch)
            sim.addMood(p, "sang"); sim.log(p, "即興唱了一首〈$title〉", kind = "life", weight = 2, sound = "♪")
            if (live) sim.events += SimEvent("song", p.id, notes.joinToString(",") + "|" + p.spec.voice.pitch)
        }
    }
    fun theme(p: Person): IntArray = Tunes.theme(p.name, p.spec.voice.pitch)
    /** play their theme (out on the desktop, on their birthday) */
    fun playTheme(p: Person) { sim.events += SimEvent("song", p.id, theme(p).joinToString(",") + "|" + p.spec.voice.pitch) }

    // ---- C-05 gossip: news travels between friends, and changes on the way
    internal fun onLog(line: LogLine) {
        if (line.weight < 3 || line.with.isEmpty() || line.kind !in setOf("event", "desk")) return
        val g = Gossip(st.nextId++, line.who, line.text, mutableListOf(line.who, line.with), 0, life.minute)
        st.gossip += g; while (st.gossip.size > 20) st.gossip.removeAt(0)
    }
    private fun gossip(r: Rng) {
        val ppl = freeNow(); if (ppl.size < 2) return
        for (g in st.gossip) { if (life.minute - g.minute > 3 * 1440) continue
            val k = ppl.firstOrNull { it.id in g.known } ?: continue
            val o = ppl.firstOrNull { it.id !in g.known && like(k, it) >= 40 } ?: continue
            if (!r.chance(0.12)) continue
            if (r.chance(0.3)) { g.text = Rumors.garble(g.text, r); g.version++ }
            g.known += o.id; sim.say(k, "跟你說喔，聽說……", to = o)
            sim.log(o, "從${k.name}那裡聽說：${g.text}", kind = "gossip", weight = 1, with = k.id)
            if (g.about == o.id) sim.addMood(o, "gossiped")
            return
        }
    }

    // ---- C-07 nicknames, C-08 shared secrets
    fun nickFor(by: Person, q: Person) = st.nicks["${by.id}>${q.id}"]
    private fun nicknames(live: Boolean) {
        for (a in awake()) for (b in awake()) { if (a === b || st.nicks.containsKey("${a.id}>${b.id}") || a.spec.address.others[b.libId]?.name?.isNotBlank() == true) continue
            val rel = sim.rel(a.id, b.id) ?: continue; if (rel.like < 70 || rel.familiar < 60) continue
            val n = b.spec.nickname.ifBlank { Nicks.make(b.name, Rng.of(life.seed, "nick:${a.id}:${b.id}")) }; st.nicks["${a.id}>${b.id}"] = n
            if (live) sim.say(a, "以後叫你「$n」好不好？", to = b)
            sim.log(a, "開始叫${b.name}「$n」", kind = "event", weight = 2, with = b.id); return
        }
    }
    fun secretsOf(id: String) = st.secrets.filter { it.a == id || it.b == id }
    private fun secrets(r: Rng) {
        val ppl = awake()
        for (s in st.secrets) { val a = ppl.firstOrNull { it.id == s.a } ?: continue; val b = ppl.firstOrNull { it.id == s.b } ?: continue
            if (sim.roomOf(a) != sim.roomOf(b) || life.minute - s.lastGlance < 1440 || !r.chance(0.25)) continue
            s.lastGlance = life.minute; sim.say(a, "（偷偷看了${b.name}一眼）"); sim.say(b, "（忍住不笑）")
            sim.log(a, "想起了「${s.text}」，和${b.name}互看了一眼", kind = "event", weight = 1, with = b.id); return }
        for (a in ppl) for (b in ppl) { if (a.id >= b.id || st.secrets.any { (it.a == a.id && it.b == b.id) || (it.a == b.id && it.b == a.id) }) continue
            if (Will.stageFrom(sim.rel(a.id, b.id)) < 3 || !r.chance(0.02)) continue
            val t = r.pick(Secrets.ALL); st.secrets += SharedSecret(a.id, b.id, t, life.minute)
            sim.log(a, "和${b.name}有了只有彼此知道的事：「$t」", kind = "secret", weight = 2, with = b.id); return }
    }

    // ---- C-09 cliques
    fun findCliques(r: Rng) {
        val ppl = life.people; if (ppl.size < 3) return
        fun close(a: Person, b: Person) = like(a, b) >= 55 && like(b, a) >= 55
        for (i in ppl.indices) for (j in i + 1 until ppl.size) for (k in j + 1 until ppl.size) {
            val g = listOf(ppl[i], ppl[j], ppl[k]); if (!(close(g[0], g[1]) && close(g[1], g[2]) && close(g[0], g[2]))) continue
            val ids = g.map { it.id }.sorted(); if (st.cliques.any { it.members.containsAll(ids) }) continue
            val name = Cliques.NAMES.filter { n -> st.cliques.none { it.name == n } }.let { if (it.isEmpty()) "好朋友會" else r.pick(it) }
            st.cliques += Clique(name, ids, day); sim.log(g[0], "${g.joinToString("、") { it.name }}組成了「$name」", kind = "event", weight = 3); return
        }
    }

    // ---- C-10 group activities (and Q-09, Q-14, A-14 through them)
    fun groupOk(g: GroupDef, ppl: List<Person>): Boolean {
        val h = sim.hour; if (!(if (g.from <= g.to) h >= g.from && h < g.to else h >= g.from || h < g.to)) return false
        if ((st.seen["group:${g.id}"] ?: -1e9) >= day.toDouble()) return false
        if ((st.seen["group"] ?: -1e9) >= day.toDouble() && g.cond !in setOf("birthday", "blackout")) return false   /* one get-together a day is plenty (birthdays and blackouts aside) */
        return when (g.cond) {
            "" -> ppl.size >= 3; "sunny" -> sim.weather() == "sunny" && ppl.size >= 3; "clear" -> sim.weather() in setOf("sunny", "cloudy") && ppl.size >= 3
            "messy" -> ppl.size >= 3 && life.mess.values.any { it > 55f }
            "birthday" -> ppl.size >= 2 && ppl.any { it.moods.any { m -> m.id == "birthday" } }
            "blackout" -> ppl.size >= 2 && st.night == "blackout" && st.nightDay == day
            "clique" -> st.cliques.any { c -> day - c.lastMeet >= 7 && c.members.all { id -> ppl.any { it.id == id } } }
            else -> false
        }
    }
    private fun group(r: Rng) {
        val ppl = awake(); if (ppl.size < 2) return   /* everyone awake at home comes over */
        val g = Groups.ALL.values.filter { groupOk(it, ppl) }.let { if (it.isEmpty()) return else r.pick(it) }
        doGroup(g, ppl, r)
    }
    fun doGroup(g: GroupDef, ppl0: List<Person>, r: Rng) {
        var ppl = ppl0
        if (g.cond == "clique") st.cliques.firstOrNull { c -> c.members.all { id -> ppl.any { it.id == id } } }?.let { c -> c.lastMeet = day; ppl = ppl.filter { it.id in c.members } }
        st.seen["group:${g.id}"] = day.toDouble(); st.seen["group"] = day.toDouble()
        ppl.forEachIndexed { i, p -> p.setNeed(Need.FUN, p.need(Need.FUN) + g.fun_); p.setNeed(Need.SOCIAL, p.need(Need.SOCIAL) + 30f); sim.addMood(p, "party"); sim.say(p, g.lines[i % g.lines.size]) }
        for (a in ppl) for (b in ppl) if (a !== b) sim.society.relUpdate(a, b) { it.copy(like = it.like + 1, familiar = it.familiar + 2) }
        if (g.id == "cleanup") for (k in life.mess.keys.toList()) life.mess[k] = 5f
        if (g.id == "birthdayparty") ppl.firstOrNull { it.moods.any { m -> m.id == "birthday" } }?.let { star ->
            val party = st.parties.firstOrNull { it.who == star.id && it.day == day && !it.done }
            if (party != null) { party.done = true; sim.addMood(star, "surprised")
                sim.say(star, when { star.spec.cry > 0.3f -> "嗚嗚……你們、你們居然偷偷準備……謝謝大家！"; star.spec.shy > 0.3f -> "……（臉紅到說不出話）……謝、謝謝。"; else -> "哇！是驚喜派對！我完全不知道！" })
                sim.log(star, "收到了大家偷偷準備的驚喜派對", kind = "event", weight = 3) }
            playTheme(star)
        }
        val names = ppl.joinToString("、") { it.name }
        sim.log(ppl[0], "$names 一起：${g.zh}", kind = "event", weight = 3); sim.events += SimEvent("group", ppl[0].id, g.zh)
        sim.journal.did("", "group:${g.id}")
    }

    // ---- C-13 contests (someone 好勝 picks someone to beat), Q-08 cook-offs
    fun winsOf(a: String, b: String) = st.wins["$a>$b"] ?: 0
    private fun contest(r: Rng) {
        val ppl = freeNow(); val a = ppl.firstOrNull { it.spec.has("好勝") && (st.seen["contest:${it.id}"] ?: -1e9) < day.toDouble() } ?: return; val b = ppl.filter { it !== a }.let { if (it.isEmpty()) return else r.pick(it) }
        st.seen["contest:${a.id}"] = day.toDouble()   /* once a day is competitive enough */
        runContest(a, b, r.pick(Contests.ALL), r)
    }
    fun runContest(a: Person, b: Person, c: app.ocshimeji.sim.social.ContestDef, r: Rng): Person {
        fun power(p: Person) = r.nextFloat() * 4f + (c.skill?.let { p.spec.skill(it) } ?: 0) * 0.6f + p.spec.axis(c.axis.coerceIn(0, 4)) * 1.2f
        val (w, l) = if (power(a) >= power(b)) a to b else b to a
        st.wins["${w.id}>${l.id}"] = winsOf(w.id, l.id) + 1; sim.addMood(w, "contestwin"); sim.addMood(l, "contestlose")
        sim.say(a, "${c.zh}！我不會輸的！", to = b); sim.say(w, "我贏了！"); sim.say(l, if (l.spec.has("好勝")) "下次一定贏你！" else "你好厲害。")
        sim.log(a, "和${b.name}${c.zh}：${w.name}贏了", kind = "event", weight = 2, with = b.id)
        if (winsOf(a.id, b.id) + winsOf(b.id, a.id) >= 3) for ((x, y) in listOf(a to b, b to a)) sim.society.relUpdate(x, y) { if ("對手" in it.flavor) it else it.copy(flavor = it.flavor + "對手") }
        return w
    }
    private fun cookOff(r: Rng) {
        val ppl = freeNow(); if (ppl.size < 3 || sim.hour !in 11.0..19.0) return
        val cooks = ppl.filter { it.spec.skill("料理") >= 2 || it.spec.has("美食家") }.take(2); if (cooks.size < 2) return
        runCookOff(cooks[0], cooks[1], ppl.filter { it !in cooks }, r)
    }
    /** two cooks make a dish each; the others taste and score by their taste */
    fun runCookOff(a: Person, b: Person, tasters: List<Person>, r: Rng): Person {
        val dishes = listOf(a, b).map { r.pick(Contests.DISHES) }
        fun score(i: Int, cook: Person) = cook.spec.skill("料理") * 2f + r.nextFloat() * 3f + tasters.sumOf { t -> (if (t.spec.likes.any { it.contains(dishes[i].second) || it.contains(dishes[i].first) }) 3.0 else 1.0) + if (t.spec.dislikes.any { it.contains(dishes[i].second) }) -2.0 else 0.0 }.toFloat()
        val sa = score(0, a); val sb = score(1, b); val (w, l) = if (sa >= sb) a to b else b to a
        for (t in tasters) { t.setNeed(Need.FOOD, t.need(Need.FOOD) + 15f); sim.say(t, "嗯……兩道都好好吃！可是我投給${w.name}。") }
        sim.addMood(w, "contestwin"); sim.addMood(l, "contestlose"); sim.say(w, "太好了！"); sim.say(l, "下次我會做得更好。")
        sim.log(a, "和${b.name}料理對決（${dishes[0].first} vs ${dishes[1].first}）：${tasters.joinToString("、") { it.name }}試吃，${w.name}贏了", kind = "event", weight = 3, with = b.id)
        return w
    }

    // ---- D-04 debates (you judge)
    fun debate(r: Rng, live: Boolean, x: Person? = null, y: Person? = null) {
        val ppl = freeNow(); if ((x == null && ppl.size < 2) || st.decisions.any { it.kind == "debate" }) return
        val a = x ?: r.pick(ppl); val b = y ?: r.pick(ppl.filter { it !== a })
        val d = Debates.ALL.filter { (st.seen["debate:${it.topic}"] ?: -1e9) < life.minute - 3 * 1440 }.let { if (it.isEmpty()) return else r.pick(it) }
        st.seen["debate:${d.topic}"] = life.minute
        sim.say(a, "${d.a}！", to = b); sim.say(b, "不對，${d.b}！", to = a)
        sim.log(a, "和${b.name}爭論「${d.topic}」", kind = "event", weight = 2, with = b.id)
        ask("debate", a, b, "${a.name}和${b.name}在爭論「${d.topic}」，請你當裁判：", listOf("${a.name}：${d.a}", "${b.name}：${d.b}", "都有道理"), live, d.topic)
    }

    // ---------------- decisions (things only you decide) ----------------
    fun pending() = st.decisions.toList()
    private fun ask(kind: String, a: Person, b: Person?, text: String, options: List<String>, live: Boolean, data: String = "") {
        val d = Decision(st.nextId++, kind, a.id, b?.id ?: "", text, options, life.minute, data); st.decisions += d
        sim.society.mail(a.id, "decision", "等你決定", text)
        if (live) sim.events += SimEvent("decision", a.id, d.id.toString())
    }
    /** for other parts of life that need you (1.8.0 room requests) */
    fun askFrom(kind: String, a: Person, b: Person?, text: String, options: List<String>, live: Boolean) = ask(kind, a, b, text, options, live)
    /** your answer (option index); returns what happened */
    fun decide(id: Int, option: Int): String {
        val d = st.decisions.firstOrNull { it.id == id } ?: return ""; st.decisions.remove(d)
        val a = sim.person(d.who) ?: return ""; val b = sim.person(d.other)
        return when (d.kind) {
            "grow" -> if (option == 0) { val age = a.spec.age + 1; a.spec = a.spec.copy(age = age); sim.addMood(a, "grown")
                    sim.log(a, "長大了一歲（$age 歲）" + if (age == 18) "，成年了" else "", kind = "event", weight = 3); "${a.name}長大一歲了" }
                else { sim.log(a, "決定維持現在的年紀（${a.spec.age} 歲）", kind = "you", weight = 1); "${a.name}還是 ${a.spec.age} 歲" }
            "debate" -> { b ?: return ""
                when (option) { 0, 1 -> { val (w, l) = if (option == 0) a to b else b to a; sim.addMood(w, "debatewin"); sim.addMood(l, "debatelose"); sim.say(w, "你看吧！"); sim.say(l, "……好啦，算你有道理。")
                        sim.log(w, "在「${d.data}」的爭論中，你判${w.name}贏", kind = "you", weight = 2, with = l.id); "${w.name}贏了" }
                    else -> { for (x in listOf(a, b)) sim.addMood(x, "chatted"); sim.say(a, "……那就各吃各的吧。"); sim.log(a, "「${d.data}」的爭論，你說都有道理，兩人笑了出來", kind = "you", weight = 1, with = b.id); "兩個人都笑了" } } }
            "confess" -> { b ?: return ""
                if (option == 0 && Relations0.ok(sim, a, b)) {
                    sim.say(a, "……其實，我一直很喜歡你。", to = b); sim.say(b, "……我也是。", to = a)
                    for ((x, y) in listOf(a to b, b to a)) sim.society.relUpdate(x, y) { it.copy(kind = "戀人", crush = it.crush + 10) }
                    if (sim.rel(a.id, b.id)?.kind == "戀人") { for (x in listOf(a, b)) sim.addMood(x, "inlove"); sim.log(a, "向${b.name}告白，兩人在一起了", kind = "event", weight = 3, with = b.id); "${a.name}和${b.name}在一起了" } else "沒有成功"
                } else { sim.log(a, "把想說的話又放回心裡", kind = "you", weight = 1, with = b.id); "再等等" } }
            else -> sim.you.decide(d, option)   /* 1.8.0: a room request */
        }
    }
    /** the romance rule, the same as everywhere (adults only, romance on) */
    private object Relations0 { fun ok(sim: LifeSim, a: Person, b: Person) = sim.life.romance && a.adult && b.adult }
}
