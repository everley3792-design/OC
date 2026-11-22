package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.Person
import app.ocshimeji.sim.social.Contests
import app.ocshimeji.sim.social.Events
import app.ocshimeji.sim.social.Groups
import app.ocshimeji.sim.social.Nicks
import app.ocshimeji.sim.social.Tunes
import app.ocshimeji.sim.social.Whim
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** 1.7.0 (R7 first batch): one test per item — the bigger stories of `life/Drama` */
class DramaTest {
    private val day0 = 20000.0 * 1440
    private val A = CharSpec(name = "阿光", traits = listOf("健談", "好勝"), age = 22)
    private val B = CharSpec(name = "小雨", traits = listOf("害羞"), age = 21)
    private val C = CharSpec(name = "團子", traits = listOf("貪吃"), age = 20)
    private fun world(specs: List<CharSpec> = listOf(A, B, C), hour: Double = 10.0, like: Int = 0, romance: Boolean = false, seed: Long = 5): LifeSim {
        val h = Houses.APARTMENT; val ts = specs.mapIndexed { i, s -> Tenant("p${i + 1}", s.name, s.adult) }
        val rels = if (like > 0) ts.flatMap { a -> ts.filter { it !== a }.map { b -> Rel(a.id, b.id, "好友", like = like, familiar = like, trust = like) } } else emptyList()
        val life = LifeSim.create(seed, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to "lib${it.id}" }, ts.indices.associate { "p${it + 1}" to specs[it] }, "鎮", "家", day0 + hour * 60, 0, rels, romance)
        life.clockMode = "GAME"; life.speed = 60.0; life.arriving = false
        return LifeSim(life).also { s -> s.life.people.forEach { it.recent["outing"] = s.life.minute + 30 * 1440.0 } }
    }
    private fun days(s: LifeSim, n: Int) { s.catchUp(s.life.minute + n * 1440.0, summarize = false) }
    private fun live(s: LifeSim, gameMin: Double) { val end = s.life.minute + gameMin; while (s.life.minute < end) { s.update(0.1f); s.events.clear() } }
    private fun at(s: LifeSim, hour: Double) { s.life.minute = Math.floor(s.life.minute / 1440) * 1440 + hour * 60 }
    private fun log(s: LifeSim, w: String) = s.life.log.any { w in it.text }
    private fun date(s: LifeSim, plus: Int): String { val d = java.time.LocalDate.ofEpochDay((s.life.minute / 1440).toLong() + plus); return "%02d-%02d".format(d.monthValue, d.dayOfMonth) }

    @Test fun a08DreamsComeTrueStepByStep() {
        val s = world(listOf(A.copy(dream = "做出最好吃的蛋糕"), B)); val p = s.life.people[0]
        s.journal.did(p.id, "act:cook", 5); days(s, 1); assertTrue(s.drama.dreamOf(p)!!.second.step >= 1, "one step closer"); assertTrue(log(s, "離夢想"))
        s.journal.did(p.id, "act:cook", 10); days(s, 2); assertTrue(s.drama.dreamOf(p)!!.second.done, "dream came true"); assertTrue(log(s, "實現了")); assertTrue(s.life.soc.mail.any { it.kind == "dream" })
    }
    @Test fun a11FearsAndGettingBraver() {
        val s = world(listOf(A.copy(fears = listOf("打雷")), B), like = 70); val p = s.life.people[0]
        assertNull(s.env.setWeather("storm")); at(s, 14.0); live(s, 30.0)
        assertTrue(log(s, "怕打雷"), "scared when it thunders"); assertTrue(log(s, "陪在身邊"), "a friend stayed with them")
        repeat(3) { s.addMood(p, "afraid"); s.drama.comfort(p.id) }
        assertTrue(s.drama.fearsOf(p).isEmpty(), "three times and it is better"); assertTrue(log(s, "克服了對打雷的害怕"))
    }
    @Test fun a14BirthdaysAndGrowingOlderOnlyWithYou() {
        val s = world(listOf(A, B.copy(age = 16), C)); val (a, b, _) = s.life.people
        a.spec = a.spec.copy(birthday = date(s, 1)); b.spec = b.spec.copy(birthday = date(s, 1)); days(s, 1)
        val grow = s.drama.pending().filter { it.kind == "grow" }; assertEquals(2, grow.size, "asked about both")
        s.drama.decide(grow.first { it.who == a.id }.id, 0); assertEquals(23, a.spec.age)
        s.drama.decide(grow.first { it.who == b.id }.id, 1); assertEquals(16, b.spec.age, "only when you say yes")
    }
    @Test fun b09SicknessFriendsCareAndItPasses() {
        val s = world(like = 70); val p = s.life.people[1]
        s.drama.fallSick(p, "cold"); assertNotNull(s.drama.sickOf(p)); assertTrue(p.moods.any { it.id == "sick" })
        val run = Acts["dance"]!!; assertTrue(s.drama.appealK(p, run) < 1f || "active" !in run.tags)
        at(s, 10.0); live(s, 360.0); assertTrue(log(s, "照顧生病的小雨"), "friends come to help")
        days(s, 3); assertNull(s.drama.sickOf(p), "a few days and it is gone"); assertTrue(log(s, "感冒好了"))
        val q = s.life.people[2]; q.setNeed(Need.FOOD, 100f); var n = 0; while (s.drama.sickOf(q) == null && n++ < 200) { s.life.minute += 1.0; s.drama.onAte(q) }
        assertEquals("tummy", s.drama.sickOf(q)?.kind, "eating when already full")
    }
    @Test fun b13CrazesCatchOn() {
        val s = world(like = 80); val p = s.life.people[0]
        s.drama.startCraze(p, "doodle"); assertEquals(2f, s.drama.appealK(p, Acts["doodle"]!!))
        for (q in s.life.people.drop(1)) s.life.drama.crazes.remove(q.id)
        at(s, 9.0); var k = 0; while (s.life.drama.crazes.values.none { it.from == p.id } && k++ < 48) { for (q in s.life.people.drop(1)) if (s.life.drama.crazes[q.id]?.from != p.id) s.life.drama.crazes.remove(q.id)
            if (s.drama.crazeOf(p) == null) s.drama.startCraze(p, "doodle"); live(s, 60.0) }
        assertTrue(s.life.drama.crazes.values.any { it.from == p.id } || s.life.log.any { it.text.contains("傳染") }, "a friend caught it: ${s.life.drama.crazes.mapValues { it.value.act }}")
    }
    @Test fun d02WhimsForADay() {
        val s = world(); val p = s.life.people[0]; s.life.drama.whims[p.id] = Whim("偵探", s.life.day)
        val r = Rng(3); val lines = (0 until 40).mapNotNull { s.drama.idleLine(p, r) }; assertTrue(lines.any { it.contains("線索") || it.contains("真相") || it.contains("放大鏡") }, "$lines")
        val d0 = s.life.day; days(s, 1); assertTrue(s.drama.whimOf(p)?.role != "偵探" || s.life.drama.whims[p.id]!!.day != d0, "only that day")
        days(s, 60); assertTrue(log(s, "突發奇想"), "it happens on its own")
    }
    @Test fun d03Misunderstandings() {
        val ids = listOf("misread", "mishear", "misgift"); assertTrue(Events.DAILY.map { it.id }.containsAll(ids))
        val s = world(); at(s, 14.0); val (a, b, _) = s.life.people
        for (id in ids) assertTrue(s.society.eventOk(Events.DAILY.first { it.id == id }, a, b), id)
        assertTrue(Events.DAILY.first { it.id == "misread" }.beats.last().text.contains("對不起"), "it clears up in the end")
    }
    @Test fun d04DebatesYouJudge() {
        val s = world(); at(s, 15.0); s.drama.debate(Rng(4), live = true, x = s.life.people[0], y = s.life.people[1])
        val d = s.drama.pending().first { it.kind == "debate" }; assertEquals(3, d.options.size); assertTrue(log(s, "爭論"))
        val win = s.person(d.who)!!; s.drama.decide(d.id, 0); assertTrue(win.moods.any { it.id == "debatewin" }); assertTrue(s.person(d.other)!!.moods.any { it.id == "debatelose" })
        assertTrue(s.drama.pending().none { it.kind == "debate" })
    }
    @Test fun d05ImprovisedSongs() {
        val s = world(); val p = s.life.people[0]; at(s, 15.0); s.addMood(p, "dreamcome"); s.addMood(p, "party"); p.act = "hum"
        s.life.drama.lastTick = -1.0; s.drama.step(true)
        assertTrue(s.events.any { it.kind == "song" && it.who == p.id } || log(s, "即興唱了一首"), "sang"); assertTrue(log(s, "即興唱了一首〈"))
        assertTrue(Tunes.improv(1, "a:1", 1f).contentEquals(Tunes.improv(1, "a:1", 1f)), "the same world, the same song"); assertFalse(Tunes.improv(1, "a:1", 1f).contentEquals(Tunes.improv(1, "a:2", 1f)), "a different day, a different song")
    }
    @Test fun d08WhatIfQuestionsAreRemembered() {
        assertTrue(s0().society.QUESTIONS.size >= 30, "at least 30 questions"); val s = s0(); val p = s.life.people[0]
        s.society.answerQuestion(p.id, "if_food", "布丁"); assertEquals("布丁", p.knows["if_food"])
        val r = Rng(9); assertTrue((0 until 200).mapNotNull { s.drama.idleLine(p, r) }.any { it.contains("布丁") && it.contains("記得") }, "it comes back later")
    }
    private fun s0() = world()
    @Test fun n04ThemeMelodies() {
        assertTrue(Tunes.theme("阿光", 1f).contentEquals(Tunes.theme("阿光", 1f))); assertFalse(Tunes.theme("阿光", 1f).contentEquals(Tunes.theme("小雨", 1f)))
        val s = world(); val p = s.life.people[0]; s.toDesk(p.id); assertTrue(s.events.any { it.kind == "song" && it.who == p.id }, "played when they go out on the desktop")
    }
    @Test fun c05GossipTravelsAndChanges() {
        val s = world(like = 75); val (a, b, c) = s.life.people
        s.log(a, "和${b.name}大吵一架", kind = "event", weight = 3, with = b.id); val g = s.life.drama.gossip.last(); assertEquals(listOf(a.id, b.id), g.known.toList())
        at(s, 9.0); var k = 0; while (c.id !in g.known && k++ < 40) live(s, 60.0)
        assertTrue(c.id in g.known, "news reached the third friend"); assertTrue(s.life.log.any { it.who == c.id && it.text.contains("聽說") })
        val r = Rng(2); assertNotEquals("和小雨一起看書", app.ocshimeji.sim.social.Rumors.garble("和小雨一起看書", r), "passed on, it changes")
    }
    @Test fun c07Nicknames() {
        val s = world(like = 80); at(s, 10.0); live(s, 60.0); val (a, b, _) = s.life.people
        val n = s.drama.nickFor(a, b); assertNotNull(n); assertEquals(n, s.society.nickBy(a, b), "and they use it"); assertTrue(log(s, "開始叫"))
        assertFalse(Nicks.make("阿光", Rng(1)).startsWith("阿阿")); assertTrue((1..30L).map { Nicks.make("阿光", Rng(it)) }.none { it.contains("阿阿") })
    }
    @Test fun c08SharedSecrets() {
        val s = world(listOf(A, B), like = 92); at(s, 9.0); var k = 0; while (s.life.drama.secrets.isEmpty() && k++ < 60) live(s, 60.0)
        assertTrue(s.life.drama.secrets.isNotEmpty(), "close friends share a secret"); assertTrue(s.life.log.any { it.kind == "secret" })
        val sc = s.life.drama.secrets[0]; sc.lastGlance = -1e9; k = 0; while (!log(s, "互看了一眼") && k++ < 60) live(s, 60.0); assertTrue(log(s, "互看了一眼"), "when it comes up, they look at each other")
    }
    @Test fun c09Cliques() {
        val s = world(like = 70); s.drama.findCliques(Rng(1)); val c = s.life.drama.cliques.single(); assertEquals(3, c.members.size); assertTrue(log(s, "組成了「${c.name}」"))
        at(s, 15.0); assertTrue(s.drama.groupOk(Groups.ALL["meetup"]!!, s.life.people), "they meet regularly")
        val s2 = world(like = 20); s2.drama.findCliques(Rng(1)); assertTrue(s2.life.drama.cliques.isEmpty(), "not with people who are not close")
    }
    @Test fun c10GroupActivities() {
        val s = world(like = 40); at(s, 11.0); assertNull(s.env.setWeather("sunny")); val ppl = s.life.people
        assertTrue(s.drama.groupOk(Groups.ALL["picnic"]!!, ppl)); assertFalse(s.drama.groupOk(Groups.ALL["picnic"]!!, ppl.take(2)), "it needs three or more")
        val l0 = s.rel(ppl[0].id, ppl[1].id)!!.like; s.drama.doGroup(Groups.ALL["picnic"]!!, ppl, Rng(1))
        assertTrue(log(s, "一起：野餐")); assertTrue(ppl.all { it.moods.any { m -> m.id == "party" } }); assertTrue(s.rel(ppl[0].id, ppl[1].id)!!.like > l0)
        assertFalse(s.drama.groupOk(Groups.ALL["pajama"]!!.copy(from = 0, to = 24), ppl), "one get-together a day")
        days(s, 20); assertTrue(s.life.log.count { it.text.contains(" 一起：") } >= 3, "they happen on their own")
    }
    @Test fun c13RivalsAndContests() {
        val s = world(); val (a, b, _) = s.life.people; val r = Rng(8)
        repeat(3) { s.drama.runContest(a, b, Contests.ALL[it], r) }
        assertEquals(3, s.drama.winsOf(a.id, b.id) + s.drama.winsOf(b.id, a.id)); assertTrue("對手" in s.rel(a.id, b.id)!!.flavor, "rivals now"); assertTrue(log(s, "比"))
    }
    @Test fun c14RomanceIsStagedOnlyWhenAllowed() {
        val off = world(listOf(A, B), like = 90); days(off, 25); assertTrue(off.drama.pending().none { it.kind == "confess" }, "romance off: never"); assertEquals(0, off.rel("p1", "p2")!!.crush)
        val minor = world(listOf(A, B.copy(age = 16)), like = 90, romance = true); days(minor, 25); assertTrue(minor.drama.pending().none { it.kind == "confess" }, "a minor: never")
        val on = world(listOf(A, B), like = 90, romance = true); var k = 0; while (on.drama.pending().none { it.kind == "confess" } && k++ < 30) days(on, 1)
        val d = on.drama.pending().first { it.kind == "confess" }; assertTrue(on.life.log.any { it.text.contains("心跳") }, "a crush first")
        on.drama.decide(d.id, 0); assertEquals("戀人", on.rel("p1", "p2")!!.kind); assertEquals("戀人", on.rel("p2", "p1")!!.kind)
    }
    @Test fun q08CookOffs() {
        val s = world(listOf(A.copy(skills = mapOf("料理" to 4)), B.copy(skills = mapOf("料理" to 3)), C.copy(likes = listOf("甜"))))
        val (a, b, c) = s.life.people; c.setNeed(Need.FOOD, 30f); val w = s.drama.runCookOff(a, b, listOf(c), Rng(2))
        assertTrue(w === a || w === b); assertTrue(c.need(Need.FOOD) > 30f, "the taster ate"); assertTrue(log(s, "料理對決")); assertTrue(w.moods.any { it.id == "contestwin" })
    }
    @Test fun q09BlackoutNights() {
        val s = world(like = 50); s.life.drama.night = "blackout"; s.life.drama.nightDay = s.life.day
        at(s, 20.5); s.update(0.5f); s.life.things["lamp@1,1"] = "on"; s.life.drama.lastTick = -1.0; s.drama.step(true); assertEquals("off", s.life.things["lamp@1,1"], "the lights went out")
        assertTrue(s.drama.groupOk(Groups.ALL["ghosts"]!!, s.life.people), "everyone gathers with candles"); s.drama.doGroup(Groups.ALL["ghosts"]!!, s.life.people, Rng(1)); assertTrue(log(s, "鬼故事"))
    }
    @Test fun q14SurpriseParties() {
        val s = world(like = 60); val star = s.life.people[0]; star.spec = star.spec.copy(birthday = date(s, 4)); days(s, 1)
        assertTrue(s.life.drama.parties.any { it.who == star.id }, "preparing three days before"); assertTrue(s.life.log.any { it.text.contains("驚喜派對") && it.who != star.id })
        days(s, 3); s.addMood(star, "birthday"); at(s, 18.0); s.drama.doGroup(Groups.ALL["birthdayparty"]!!, s.life.people, Rng(1))
        assertTrue(star.moods.any { it.id == "surprised" }, "surprised!"); assertTrue(log(s, "驚喜派對"))
    }
    @Test fun storiesAreDeterministic() {
        fun go(): List<String> { val s = world(like = 70); days(s, 10); return s.life.log.map { it.text } }
        assertEquals(go(), go())
    }
    @Suppress("unused") private fun unused(p: Person) = p
}
