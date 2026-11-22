package app.ocshimeji.sim

import app.ocshimeji.sim.chars.Catalog
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.social.Chemistry
import app.ocshimeji.sim.social.Events
import app.ocshimeji.sim.social.Memory
import app.ocshimeji.sim.social.Reaction
import app.ocshimeji.sim.social.Rps
import app.ocshimeji.sim.social.SocialActs
import app.ocshimeji.sim.social.Sparks
import app.ocshimeji.sim.social.Will
import app.ocshimeji.sim.social.Worries
import app.ocshimeji.sim.social.Worry
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SocialTest {
    private val json = Json { encodeDefaults = true }
    private val day0 = 20000.0 * 1440
    private val A = CharSpec(name = "阿光", age = 24, axes = listOf(0.6f, 0.5f, 0.2f, 0.4f, 0.3f), traits = listOf("健談", "好勝", "愛乾淨"), tags = listOf("劍修"), likes = listOf("甜點"), tastes = mapOf("甜" to 1), skills = mapOf("料理" to 4))
    private val B = CharSpec(name = "小雨", age = 22, axes = listOf(-0.5f, -0.3f, 0f, -0.3f, 0.6f), traits = listOf("害羞", "邋遢", "愛哭"), tags = listOf("社畜"), likes = listOf("看書"), cry = 0.5f, shy = 0.4f)
    private val C = CharSpec(name = "團子", age = 30, axes = listOf(0.2f, -0.4f, -0.3f, 0.1f, -0.4f), traits = listOf("好勝", "貪吃", "夜貓子"), tags = listOf("吸血鬼"), likes = listOf("布丁"), temper = 0.4f)

    private fun world(specs: List<CharSpec> = listOf(A, B, C), hour: Double = 8.0, romance: Boolean = false, house: String = "apartment", rels: List<Rel> = emptyList()): LifeSim {
        val h = Houses.get(house)
        val ts = specs.mapIndexed { i, s -> Tenant("p${i + 1}", s.name, s.adult) }
        val life = LifeSim.create(7, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to "lib${it.id}" }, ts.indices.associate { "p${it + 1}" to specs[it] }, "鎮", "家", day0 + hour * 60, 0, rels, romance)
        life.clockMode = "GAME"; life.speed = 60.0
        return LifeSim(life)
    }
    private fun run(s: LifeSim, gameMinutes: Double, each: ((Double) -> Unit)? = null) {
        val end = s.life.minute + gameMinutes; var next = s.life.minute
        while (s.life.minute < end) { s.update(0.1f); s.events.clear(); if (each != null && s.life.minute >= next) { each(s.life.minute); next += 30.0 } }
    }

    @Test fun contentTablesAreCompleteAndPointAtRealTraitsAndTags() {
        assertTrue(SocialActs.ALL.size >= 40, "social acts: ${SocialActs.ALL.size}")
        assertEquals(30, Chemistry.ALL.size); assertEquals(15, Sparks.ALL.size); assertEquals(23, Events.DAILY.size); assertEquals(5, Events.SERIAL.size); assertEquals(9, Worries.ALL.size)
        val known = Catalog.TRAITS.keys + Catalog.TAGS.keys + Catalog.QUIRKS.keys
        for (c in Chemistry.ALL) { assertTrue(c.a in known && c.b in known, "chemistry ${c.id}: ${c.a} / ${c.b}"); assertTrue(c.beats.size >= 3) }
        for (k in Sparks.ALL) { assertTrue(k.a in known && k.b in known, "spark ${k.id}: ${k.a} / ${k.b}"); assertEquals(4, k.stages.size); k.stages.forEach { assertTrue(it.size >= 2, k.id) } }
        for (e in Events.DAILY + Events.SERIAL) assertTrue(e.beats.size >= 3, e.id)
        assertTrue(Catalog.QUIRKS.size >= 20, "quirks: ${Catalog.QUIRKS.size}")
        assertTrue(SocialActs.ALL.values.filter { it.romance }.all { it.cat == "戀愛" })
    }

    @Test fun threeResidentsSevenDaysEveryoneSocialNobodyStuckEventsSpread() {
        val s = world()
        val seen = HashMap<String, ArrayList<String>>()
        run(s, 7 * 1440.0) { _ ->
            for (p in s.life.people) seen.getOrPut(p.id) { ArrayList() } += if (s.asleep(p)) "sleep" else "${p.act}@${p.x.toInt()},${p.y.toInt()}"
        }
        val soc = s.life.soc
        for (p in s.life.people) {
            val withOthers = soc.pairs.filter { it.a == p.id || it.b == p.id }.sumOf { it.n["all"] ?: 0 }
            assertTrue(withOthers >= 5, "${p.name} had only $withOthers social contacts in 7 days")
            /* stuck = the same awake state for 4 game hours in a row */
            var runLen = 1; val xs = seen[p.id]!!
            for (i in 1 until xs.size) { runLen = if (xs[i] == xs[i - 1] && xs[i] != "sleep") runLen + 1 else 1; assertTrue(runLen < 8, "${p.name} stuck as ${xs[i]} around sample $i") }
        }
        val events = s.life.log.filter { it.kind == "event" }
        val social = s.life.log.filter { it.kind == "social" }
        assertTrue(social.size >= 30, "social lines: ${social.size}")
        assertTrue(events.size >= 6, "events: ${events.size}")
        val byName = events.groupingBy { it.text.substringAfter("：").substringAfter("：") }.eachCount()
        assertTrue(byName.size >= 4, "distinct events: $byName")
        assertTrue(byName.values.max() <= events.size * 0.5, "one event dominates: $byName")
        assertTrue(s.life.log.any { it.kind == "worry" }, "no worries in a week")
        assertTrue(soc.cards.size >= 6, "day cards: ${soc.cards.size}")
        assertTrue(s.life.rels.isNotEmpty())
    }

    @Test fun sameSaveSameWeek() {
        val a = world(); val b = world()
        run(a, 1440.0); run(b, 1440.0)
        assertEquals(json.encodeToString(a.life), json.encodeToString(b.life))
        val c = world(); val d = world()
        c.catchUp(c.life.minute + 5 * 1440); d.catchUp(d.life.minute + 5 * 1440)
        assertEquals(json.encodeToString(c.life), json.encodeToString(d.life))
        assertTrue(c.life.log.any { it.kind == "social" && it.away }, "nobody met anyone while you were away")
    }

    @Test fun minorsNeverRomance() {
        val kid1 = CharSpec(name = "小可", age = 12, axes = listOf(0.8f, 0.6f, 0f, 0.5f, 0.6f), traits = listOf("黏人", "健談"))
        val kid2 = CharSpec(name = "小安", age = 15, axes = listOf(0.5f, 0.2f, 0f, 0.2f, 0.7f), traits = listOf("溫和"))
        val rels = listOf(Rel("p1", "p2", "戀人", crush = 80), Rel("p3", "p4", "知己", like = 90, familiar = 90, trust = 90))
        val s = world(listOf(A.copy(traits = listOf("健談")), C, kid1, kid2), romance = true, rels = rels)
        val kids = setOf("p3", "p4")
        val forbidden = SocialActs.ALL.values.filter { it.romance }.map { it.zh }
        repeat(3) { run(s, 1440.0); s.catchUp(s.life.minute + 1440) }
        for (r in s.life.rels) if (r.from in kids || r.to in kids) {
            assertEquals(0, r.crush, "$r"); assertTrue(r.kind !in Rel.ROMANTIC, "$r"); assertTrue(r.flavor.none { it in Rel.ROMANTIC_FLAVORS }, "$r")
        }
        for (l in s.life.log) if (l.who in kids || l.with in kids) assertTrue(forbidden.none { l.text.contains(it) } && !l.text.contains("在一起"), l.text)
        /* the chooser never offers a romantic act to a minor, the line check refuses romantic words */
        val p3 = s.person("p3")!!; val p4 = s.person("p4")!!; val r = Rng(1)
        repeat(300) { val pick = s.society.chooseAct(p3, p4, r); assertTrue(pick == null || !pick.act.romance) }
        assertNotNull(s.society.checkLine(p3, p4, "我喜歡你，我們交往吧"))
        assertNull(s.society.checkLine(s.person("p1")!!, s.person("p2")!!, "我喜歡你"))
        /* setting one by hand is refused too */
        assertNotNull(s.setRel(Rel("p3", "p1", crush = 10)))
    }

    @Test fun reactionSpectrumHasConsequences() {
        val warm = Will.Ctx(A, Rel("p1", "p2", "好友", like = 90, trust = 80, familiar = 90), 4, 20f, 80f, 2, 4, false, 1f)
        val cold = Will.Ctx(C, Rel("p3", "p1", "對手", like = 5, trust = 5, conflict = 80), -4, 90f, 10f, 3, -6, true, 1f)
        val hug = SocialActs["hug"]!!; val mock = SocialActs["mock"]!!
        assertEquals(Reaction.WARM, Will.reaction(Will.score(SocialActs["chat"]!!, warm, 0f), A, Rng(1)))
        val bad = Will.reaction(Will.score(mock, cold, 0f), C, Rng(1)); assertTrue(bad == Reaction.ANGRY || bad == Reaction.CRY, "$bad")
        assertTrue(Will.delta(hug, Reaction.WARM).like > 0); assertTrue(Will.delta(hug, Reaction.CRY).like < 0)
        assertTrue(Will.delta(mock, Reaction.ANGRY).conflict > Will.delta(mock, Reaction.WARM).conflict)
        assertTrue(Will.delta(SocialActs["apologize"]!!, Reaction.HAPPY).conflict < 0)
        /* a shy one minds a hug from a stranger more than an outgoing one does */
        val shyCtx = Will.Ctx(B, null, 0, 60f, 60f, 3, 0, false, 1f); val boldCtx = Will.Ctx(A, null, 0, 60f, 60f, 3, 0, false, 1f)
        assertTrue(Will.score(hug, shyCtx, 0f) < Will.score(hug, boldCtx, 0f))
    }

    @Test fun ledgerQuarrelAndMakingUp() {
        val s = world(); val so = s.society; val p1 = s.person("p1")!!; val p2 = s.person("p2")!!
        so.remember(p1, "p2", Memory.FAVOR, "端茶", 2)
        assertNotNull(so.owed("p1", "p2"))
        assertTrue(so.chooseAct(p1, p2, Rng(3)) != null)
        /* paying back: a favour act with a good answer settles it */
        val thank = (0 until 200).asSequence().map { so.build(p1, p2, "thank", Rng(it.toLong())) }.first { it.re.good }
        thank.apply(); assertNull(so.owed("p1", "p2"))
        /* a grudge → an argument that goes badly → a cold war → making up ends it */
        so.remember(p2, "p1", Memory.GRUDGE, "把襪子亂丟", 3)
        val argue = (0 until 400).asSequence().map { so.build(p2, p1, "argue", Rng(it.toLong())) }.first { it.re.bad }
        argue.apply(); assertNotNull(so.feud("p1", "p2")); assertTrue(s.life.log.last().text.contains("冷戰"))
        val p1Pick = (0 until 50).mapNotNull { so.chooseAct(p1, p2, Rng(it.toLong())) }.map { it.act.cat }.toSet()
        assertTrue(p1Pick.all { it == "和好" || it == "衝突" }, "during a cold war only making up or sulking: $p1Pick")
        val make = (0 until 400).asSequence().map { so.build(p1, p2, "makeup", Rng(it.toLong())) }.first { it.re.good }
        make.apply(); assertNull(so.feud("p1", "p2"))
    }

    @Test fun dailySettlementNeedsTwoDaysAndFades() {
        val s = world(); val so = s.society
        s.setRel(Rel("p1", "p2", "認識", familiar = 70, like = 70, trust = 40))
        s.setRel(Rel("p2", "p3", "朋友", familiar = 45, like = 45, seenDay = 1))
        so.settle()                                                   /* day 1 → pending */
        assertEquals("認識", s.rel("p1", "p2")!!.kind); assertEquals("好友", s.rel("p1", "p2")!!.pend)
        so.settle()
        assertEquals("好友", s.rel("p1", "p2")!!.kind, "a new step after two settlements in a row")
        val before = s.rel("p2", "p3")!!.familiar
        s.life.minute += 5 * 1440; so.settle()
        assertTrue(s.rel("p2", "p3")!!.familiar < before, "unused friendships fade")
    }

    @Test fun worriesBudgetMailboxAndYourOwnLine() {
        val s = world(); val so = s.society; val p1 = s.person("p1")!!; val p2 = s.person("p2")!!; val p3 = s.person("p3")!!
        s.life.soc.lively = 0
        for (p in listOf(p1, p2, p3)) p.worry = Worry("bored", since = s.life.minute)
        run(s, 300.0)
        val shownOrMailed = listOf(p1, p2, p3).mapNotNull { it.worry }
        assertTrue(shownOrMailed.count { it.shown } <= 1, "more than one bubble at once")
        assertTrue(s.life.soc.mail.any { it.kind == "worry" } || shownOrMailed.size < 3, "nothing went to the mailbox")
        p1.worry = Worry("friend", "p2", since = s.life.minute)
        val ch = so.worryChoices("p1"); assertTrue(ch.size in 2..4, "$ch"); assertTrue(ch.any { it.line })
        assertTrue(so.answerWorry("p1", "say:chat", "我們交往吧").contains("戀愛"), "a romantic line with romance off is refused")
        val ans = so.answerWorry("p1", "say:chat", "一起吃布丁吧！")
        assertTrue(ans.isNotBlank()); assertNull(p1.worry); assertTrue(p1.order!!.startsWith("say:"))
        assertTrue(s.life.soc.memories.any { it.who == "p1" && it.about == "player" && it.kind == Memory.IDEA })
    }

    @Test fun controlModesSuggestAndCommand() {
        val s = world(); val so = s.society; val p = s.person("p2")!!   /* 邋遢: hates tidying */
        for (n in Need.values()) p.setNeed(n, 80f)
        assertTrue(so.suggest("p2", "tidy").contains("觀察模式"))
        so.setControl("p2", "suggest")
        val no = so.suggest("p2", "tidy"); assertNull(p.order, "a messy one declines tidying when asked nicely: $no")
        so.setControl("p2", "command"); so.suggest("p2", "tidy"); assertEquals("act:tidy", p.order)
        run(s, 30.0); assertTrue(p.act == "tidy" || s.life.log.any { it.who == "p2" && it.text.contains("整理") } || p.order == null)
    }

    @Test fun rockPaperScissorsHabitsAndHideAndSeek() {
        val active = CharSpec(axes = listOf(0f, 0.8f, 0f, 0f, 0f)); val gentle = CharSpec(axes = listOf(0f, 0f, 0f, 0f, 0.8f))
        assertEquals(Rps.ROCK, Rps.favourite(active)); assertEquals(Rps.PAPER, Rps.favourite(gentle))
        val r = Rng(5); val throws = (0 until 300).map { Rps.pick(active, null, r) }
        assertTrue(throws.count { it == Rps.ROCK } > 130, "active ones love rock")
        assertEquals(1, Rps.judge(Rps.ROCK, Rps.SCISSORS)); assertEquals(-1, Rps.judge(Rps.ROCK, Rps.PAPER))
        val s = world(); val so = s.society
        so.rpsStart("p1"); var round = so.rpsPlay("p1", Rps.ROCK)!!
        var n = 1; while (!round.over && n < 20) { round = so.rpsPlay("p1", Rps.PAPER)!!; n++ }
        assertTrue(round.over); assertTrue(s.life.log.any { it.kind == "you" && it.text.contains("猜拳") })
        assertTrue(so.hideStart("p2")); val spot = so.hiding("p2")!!
        assertTrue(!s.society.let { s.person("p2")!!.let { p -> so.hiding(p.id) == null } })
        val miss = (0 until s.house.pieces.size).first { it != spot }
        assertTrue(!so.hideSearch("p2", miss)!!.found)
        assertTrue(so.hideSearch("p2", spot)!!.found); assertNull(so.hiding("p2"))
    }

    @Test fun cookingForEveryoneTastesAndDishes() {
        val s = world(hour = 11.5); val so = s.society
        s.life.arriving = false
        for (p in s.life.people) { for (n in Need.values()) p.setNeed(n, 80f); p.setNeed(Need.FOOD, 30f) }
        run(s, 6 * 60.0)
        assertTrue(s.life.log.any { it.text.contains("煮了一大鍋") }, "nobody cooked for everyone at lunch")
        assertTrue(s.life.people.any { p -> p.tasted.keys.any { it.startsWith("dish:") } }, "nobody tasted the pot")
        assertTrue(s.life.log.any { it.text.contains("吃了") && it.text.contains("煮的") })
        assertTrue(so.narrate("p1") == null || so.narrate("p1")!!.isNotBlank())
    }
}
