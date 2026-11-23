package app.ocshimeji.sim

import app.ocshimeji.sim.chars.Address
import app.ocshimeji.sim.chars.Call
import app.ocshimeji.sim.chars.Catalog
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Dims
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.chars.Speech
import app.ocshimeji.sim.chars.TalkStyle
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.social.Appt
import app.ocshimeji.sim.social.InnerState
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/** 2.2.0 (expansion plan, phase 2): personality dimensions, more traits, ways of talking, and the inner life */
class InnerTest {
    private val day0 = 20000.0 * 1440
    private fun world(specs: List<CharSpec>, hour: Double = 10.0, rels: List<Rel> = emptyList(), seed: Long = 5, house: String = "apartment"): LifeSim {
        val h = Houses.get(house); val ts = specs.mapIndexed { i, s -> Tenant("p${i + 1}", s.name, s.adult) }
        val life = LifeSim.create(seed, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to "lib${it.id}" }, ts.indices.associate { "p${it + 1}" to specs[it] }, "鎮", "家", day0 + hour * 60, 0, rels)
        life.clockMode = "GAME"; life.speed = 60.0; life.arriving = false
        return LifeSim(life)
    }
    private fun friends(a: String, b: String, like: Int = 80, fam: Int = 70, trust: Int = 50) = listOf(Rel(a, b, "朋友", like = like, familiar = fam, trust = trust), Rel(b, a, "朋友", like = like, familiar = fam, trust = trust))
    /** run the inner clock by hand: `days` new days, ticks in between (catch-up style, nothing live) */
    private fun days(s: LifeSim, n: Int, each: (Int) -> Unit = {}) { for (d in 0 until n) { each(d); s.life.minute += 1440; s.life.inner.lastTick = -1e9; s.inner.step(false) } }
    private fun tick(s: LifeSim, minutes: Double = 15.0) { s.life.minute += minutes; s.life.inner.lastTick = -1e9; s.inner.step(false) }

    // ---------------- #14 personality ----------------
    @Test fun twentyDimensionsEachDoSomething() {
        assertTrue(Dims.ALL.size >= 20, "dimensions: ${Dims.ALL.size}")
        val base = CharSpec(name = "測")
        for (d in Dims.ALL) {
            val hi = base.withDim(d.id, 1f); val lo = base.withDim(d.id, -1f)
            assertEquals(1f, hi.dim(d.id)); assertEquals(-1f, lo.dim(d.id))
            if (d.axis >= 0) { assertEquals(1f, hi.axis(d.axis), d.id); continue }   /* the five axes are read by the life directly (SpecEffectsTest) */
            assertNotEquals(Catalog.effects(hi), Catalog.effects(lo), "${d.id}: both ends do the same")
            assertTrue(Catalog.effects(hi).isNotEmpty() && Catalog.effects(lo).isNotEmpty(), d.id)
        }
        assertEquals(emptyList(), Catalog.effects(base), "in the middle: no effect")
    }
    @Test fun dimensionsChangeChoices() {
        fun appeal(spec: CharSpec, act: String) = world(listOf(spec)).let { it.appeal(it.person("p1")!!, Acts[act]!!).first }
        val b = CharSpec(name = "測")
        assertTrue(appeal(b.withDim("創造", 1f), "doodle") > appeal(b.withDim("創造", -1f), "doodle") * 2f, "creative people draw")
        assertTrue(appeal(b.withDim("冒險", 1f), "outing") > appeal(b.withDim("冒險", -1f), "outing") * 2f, "adventurous people go out")
        assertTrue(appeal(b.withDim("耐心", 1f), "puzzle") > appeal(b.withDim("耐心", -1f), "puzzle") * 2f, "patient people do puzzles")
        val calm = world(listOf(b.withDim("穩定", 1f))); val wobbly = world(listOf(b.withDim("穩定", -1f)))
        assertTrue(calm.moodWeight(calm.person("p1")!!, -3) > wobbly.moodWeight(wobbly.person("p1")!!, -3), "steady people feel bad things less")
    }
    @Test fun theSituationalQuiz() {
        assertTrue(Dims.QUIZ.size >= 20 && Dims.QUIZ.all { it.answers.size == 4 })
        val known = Dims.ALL.map { it.id }.toSet()
        for (q in Dims.QUIZ) for ((_, d) in q.answers) assertTrue(d.keys.all { it in known }, "${q.ask}: ${d.keys}")
        val party = Dims.quiz(CharSpec(name = "測"), List(Dims.QUIZ.size) { 0 }); val home = Dims.quiz(CharSpec(name = "測"), List(Dims.QUIZ.size) { 3 })
        assertTrue(party.dim("外向") > 0.3f && home.dim("外向") < party.dim("外向") - 0.4f, "${party.dim("外向")} ${home.dim("外向")}")
        assertTrue(home.dim("獨立") > party.dim("獨立"))
        assertTrue(Dims.QUIZ.flatMap { q -> q.answers.flatMap { it.second.keys } }.toSet().size >= 20, "the quiz reaches most dimensions")
    }
    @Test fun eightyTraitsEachABundleOfEffects() {
        assertTrue(Catalog.TRAITS.size >= 80, "traits: ${Catalog.TRAITS.size}")
        val plain = Catalog.effects(CharSpec(name = "測"))
        for ((id, t) in Catalog.TRAITS) {
            val e = t.fx; assertTrue(e.act.isNotEmpty() || e.decay.isNotEmpty() || e.wake != 0 || e.sleep != 0 || e.moodPos != 1f || e.moodNeg != 1f || e.speed != 1f || e.duration != 1f || e.flags.isNotEmpty(), "$id does nothing")
            assertNotEquals(plain, Catalog.effects(CharSpec(name = "測", traits = listOf(id))), id)
        }
        for ((a, b) in Catalog.CONFLICTS) assertTrue(Catalog.TRAITS.containsKey(a) && Catalog.TRAITS.containsKey(b), "$a / $b")
        for (w in listOf("收集癖", "健忘", "偷偷觀察", "可愛控", "雨天派", "怕被碰", "夜間活躍", "被誇就害羞", "愛分享", "小儀式", "愛離題", "記得喜好", "惡作劇王", "獨行俠", "好勝", "心軟", "喜新")) assertTrue(w in Catalog.TRAITS, w)
    }

    // ---------------- #39 ways of talking ----------------
    @Test fun waysOfTalkingKeepWholeSentences() {
        val lines = listOf("謝謝你，我很開心。", "今天天氣真好！", "我想吃點心", "這個是什麼？", "嗯，好啊，那我們走吧。")
        var n = 0
        for ((k, _) in TalkStyle.FIELDS) for (style in CharSpec.STYLES) for (base in lines) for (to in listOf(true, false)) for (seed in 1L..6L) {
            val spec = CharSpec(name = "測", style = style, talk = TalkStyle().with(k, 1f), banned = listOf("餓"), address = Address(close = "小主"))
            val t = Speech.say(spec, base, Rng(seed + n), 60, to, if (to) null else Call("阿雨", "普通"), null)
            assertTrue(t.isNotBlank() && t.last() !in "，、", "$k $style: $t"); assertFalse(t.contains("{"), t)
            if (to) assertFalse(t.contains("你"), "$k: how they call you: $t")
            n++
        }
        val all = TalkStyle(1f, 1f, 1f, 1f, 1f, 1f, 1f, 1f)
        for (seed in 1L..200L) { val t = Speech.say(CharSpec(name = "測", talk = all, address = Address(close = "小主")), "謝謝你，我很開心。", Rng(seed), 60, true); assertTrue(t.isNotBlank() && !t.contains("你"), t) }
    }
    @Test fun eachWayOfTalkingShows() {
        val base = "嗯，好啊，那我們走吧。"
        fun said(k: TalkStyle) = (1L..60L).map { Speech.say(CharSpec(name = "測", talk = k), base, Rng(it), 50, false) }.toSet()
        val plain = said(TalkStyle()); assertEquals(1, plain.size, "no style: no dice, the same line")
        for ((k, zh) in TalkStyle.FIELDS) { if (k == "jokeShy") continue; assertTrue(said(TalkStyle().with(k, 1f)).any { it !in plain }, "$zh shows") }
        assertTrue((1L..60L).map { Speech.say(CharSpec(name = "測", talk = TalkStyle(jokeShy = 1f)), "謝謝，我很開心。", Rng(it), 50, false) }.any { it.contains("開玩笑") }, "covering shyness with a joke")
        assertTrue(said(TalkStyle(stutter = 1f)).any { it.startsWith("嗯、嗯") }); assertTrue(said(TalkStyle(blunt = 1f)).any { it == "嗯。" })
    }

    // ---------------- #22 inner needs, missing someone ----------------
    @Test fun aLonerStillMissesTheirFriend() {
        val loner = CharSpec(name = "甲", traits = listOf("獨行俠")).withDim("獨立", 1f)
        val s = world(listOf(loner, CharSpec(name = "乙")), rels = friends("p1", "p2"))
        val a = s.person("p1")!!; val b = s.person("p2")!!
        tick(s); assertTrue(s.inner.aloneNeed(a) > s.inner.aloneNeed(b), "needs time alone more")
        b.desk = true   /* away the whole day */
        for (i in 0 until 90) tick(s)
        assertTrue(a.moods.any { it.id == "missing" }, "misses them"); assertTrue(s.life.log.any { it.text.contains("好想") && it.with == "p2" })
        b.desk = false; tick(s)
        assertTrue(a.moods.any { it.id == "reunited" }); assertTrue(s.life.log.any { it.text.contains("回來了") })
    }
    @Test fun innerNeedsFallAndFill() {
        val s = world(listOf(CharSpec(name = "甲").withDim("創造", 1f), CharSpec(name = "乙").withDim("創造", -1f)))
        tick(s); val a = s.person("p1")!!; val b = s.person("p2")!!
        val a0 = s.inner.need(a, "CREATE"); val b0 = s.inner.need(b, "CREATE")
        for (i in 0 until 20) tick(s)
        assertTrue(a0 - s.inner.need(a, "CREATE") > b0 - s.inner.need(b, "CREATE"), "the creative one wants to make something sooner")
        val before = s.inner.need(a, "CREATE"); s.inner.actDone(a, Acts["doodle"]!!); assertTrue(s.inner.need(a, "CREATE") > before)
        s.life.inner.needs["p1"]!!["CREATE"] = 5f
        assertTrue(s.appeal(a, Acts["doodle"]!!).first > s.appeal(b, Acts["doodle"]!!).first * 2f, "a low need pulls towards what fills it")
        tick(s); assertTrue(a.moods.any { it.id == "itchy" })
    }

    // ---------------- #21 memories ----------------
    @Test fun seeingAFlowerBringsBackWhoGaveIt() {
        val s = world(listOf(CharSpec(name = "甲"), CharSpec(name = "乙")), rels = friends("p1", "p2", like = 60))
        val giver = s.person("p1")!!; val got = s.person("p2")!!
        s.inner.onSocial(giver, got, "gift", "送禮", true, false, "flower", "一朵小花")
        assertEquals("flower", s.inner.memosOf("p2").first().obj)
        s.life.minute += 2 * 1440
        val plant = s.house.pieces.indexOfFirst { it.kind == "plant" }; assertTrue(plant >= 0)
        val like0 = s.rel("p2", "p1")!!.like
        for (i in 0 until 20) { got.actPiece = plant; s.inner.actDone(got, Acts["water"]!!); s.life.minute += 7; if (s.life.log.any { it.text.contains("想起了") }) break }
        assertTrue(s.life.log.any { it.text.contains("想起了乙送的一朵小花") || it.text.contains("想起了甲送的一朵小花") }, s.life.log.takeLast(5).joinToString { it.text })
        assertTrue(s.rel("p2", "p1")!!.like > like0, "a warm memory warms the relationship")
    }
    @Test fun memoriesFadeButBigOnesStay() {
        val s = world(listOf(CharSpec(name = "甲"), CharSpec(name = "乙")))
        val a = s.person("p1")!!
        val small = s.inner.note(a, "p2", "小事", "happy", 1); val big = s.inner.note(a, "p2", "大事", "warm", 3)
        val s0 = s.inner.strength(small); s.life.minute += 10 * 1440
        assertTrue(s.inner.strength(small) < s0 * 0.2f, "a small thing fades"); assertTrue(s.inner.strength(big) >= 1f, "a big one stays")
        days(s, 2); assertTrue(s.life.inner.memos.none { it.id == small.id } && s.life.inner.memos.any { it.id == big.id }, "forgotten ones are let go")
    }

    // ---------------- #03 chemistry ----------------
    @Test fun firstImpressionsFollowWhoTheyAre() {
        val me = CharSpec(name = "甲", likes = listOf("看書", "紅茶")).withDim("外向", -0.8f).withDim("好奇", 0.8f).withDim("耐心", 0.8f)
        val twin = me.copy(name = "乙"); val other = CharSpec(name = "丙", likes = listOf("熱鬧")).withDim("外向", 0.9f).withDim("好奇", -0.9f).withDim("耐心", -0.9f).withDim("衝動", 1f)
        val s = world(listOf(me, twin, other)); tick(s); days(s, 1)
        val imp = s.life.inner.impressions
        assertTrue(imp["p1>p2"]!! > imp["p1>p3"]!!, "$imp"); assertTrue(s.rel("p1", "p2")!!.like > s.rel("p1", "p3")!!.like)
        assertTrue(s.life.log.any { it.text.contains("第一印象") })
    }
    @Test fun twoShyOnesWhoLikeEachOther() {
        val shy = CharSpec(name = "甲", traits = listOf("害羞"), shy = 0.6f)
        val s = world(listOf(shy, shy.copy(name = "乙")), rels = friends("p1", "p2", like = 65, fam = 30))
        tick(s); days(s, 3)
        assertTrue(s.person("p1")!!.moods.any { it.id == "tonguetied" } && s.person("p2")!!.moods.any { it.id == "tonguetied" })
        assertTrue(s.life.log.any { it.text.contains("不知道怎麼開口") })
    }
    @Test fun jealousyWhenTheirPersonIsWithSomeoneElse() {
        val s = world(listOf(CharSpec(name = "甲", traits = listOf("吃醋精")).withDim("依賴", 0.8f), CharSpec(name = "乙"), CharSpec(name = "丙")),
            rels = friends("p1", "p2", like = 85) + friends("p2", "p3", like = 70) + friends("p1", "p3", like = 50))
        tick(s)
        days(s, 10) { s.society.pair("p2", "p3").n["all"] = (s.society.pair("p2", "p3").n["all"] ?: 0) + 6 }
        assertTrue(s.life.log.any { it.text.contains("心裡有點酸") }, "jealous"); assertTrue(s.rel("p1", "p3")!!.like < 50)
        assertTrue(s.inner.timeline("p1").any { it.key == "jealous" })
    }

    // ---------------- #31 habits ----------------
    @Test fun habitsFormByThemselvesInAMonth() {
        val s = world(listOf(CharSpec(name = "甲", traits = listOf("規律")).withDim("責任", 0.6f), CharSpec(name = "乙"), CharSpec(name = "丙")), hour = 8.0, house = "cottage")
        s.catchUp(s.life.minute + 30 * 1440, summarize = false)
        assertTrue(s.life.inner.routines.isNotEmpty(), "at least one habit in 30 days")
        assertTrue(s.life.log.any { it.text.contains("養成了一個習慣") }, "and it is in the timeline")
        assertTrue(s.life.inner.firsts.any { it.key == "habit" })
    }

    // ---------------- #34 my seat ----------------
    @Test fun mySeat() {
        val s = world(listOf(CharSpec(name = "甲"), CharSpec(name = "乙")), rels = friends("p1", "p2", like = 40))
        val a = s.person("p1")!!; val b = s.person("p2")!!; val sofa = s.house.pieces.indexOfFirst { it.kind == "sofa" }; assertTrue(sofa >= 0)
        repeat(8) { a.actPiece = sofa; s.inner.actDone(a, Acts["relax"]!!) }
        assertEquals(listOf("沙發"), s.inner.seatsOf("p1")); assertTrue(s.life.log.any { it.text.contains("老位子") })
        for (i in 0 until 12) { b.actPiece = sofa; s.life.minute += 3; s.inner.actDone(b, Acts["relax"]!!) }
        assertTrue(s.life.log.any { it.text.contains("又坐了我在沙發的老位子") }); assertTrue(a.moods.any { it.id == "myseat" })
    }

    // ---------------- #02 goals ----------------
    @Test fun goalsShortAndLong() {
        val s = world(listOf(CharSpec(name = "甲", traits = listOf("書蟲")).withDim("好奇", 1f), CharSpec(name = "乙")), house = "cottage")
        tick(s); var d = 0; while (s.inner.goalsOf("p1").none { !it.long } && d++ < 10) days(s, 1)
        val p = s.person("p1")!!
        val short = s.inner.goalsOf("p1").first { !it.long }; val long = s.inner.goalsOf("p1").first { it.long }
        assertTrue(s.appeal(p, Acts[short.acts.first()]!!).first > 0f)
        repeat(short.need) { s.inner.actDone(p, Acts[short.acts.first()]!!) }
        assertTrue(short.done && p.moods.any { it.id == "goaldone" }); assertTrue(s.life.log.any { it.text.contains("完成了今天的目標") })
        repeat(long.need) { s.inner.actDone(p, Acts[long.acts.first()]!!) }
        assertTrue(long.done && s.life.log.any { it.text.contains("達成了長期目標") } && s.inner.timeline("p1").any { it.key == "longgoal" })
    }

    // ---------------- #47 invitations and promises ----------------
    @Test fun promisesKeptAndBroken() {
        val s = world(listOf(CharSpec(name = "甲"), CharSpec(name = "乙")), rels = friends("p1", "p2"))
        val a = s.person("p1")!!; val b = s.person("p2")!!; tick(s)
        s.life.inner.appts += Appt(900, "p1", "p2", "tv", s.life.minute)
        tick(s); assertEquals("tv", a.plan.firstOrNull(), "the promise changes their plan"); assertTrue(s.life.log.any { it.text.contains("為了和") })
        val like0 = s.rel("p2", "p1")!!.like
        s.inner.actDone(a, Acts["tv"]!!); s.inner.actDone(b, Acts["tv"]!!)
        assertTrue(a.moods.any { it.id == "promise" } && s.rel("p2", "p1")!!.like > like0); assertTrue(s.life.log.any { it.text.contains("照約定") })
        s.life.inner.appts += Appt(901, "p1", "p2", "tea", s.life.minute - 200)
        b.desk = true; tick(s)
        assertTrue(a.moods.any { it.id == "stoodup" }); assertTrue(s.life.log.any { it.text.contains("沒有成") })
    }
    @Test fun theyInviteEachOtherOnTheirOwn() {
        val bold = CharSpec(name = "甲", traits = listOf("自來熟")).withDim("主動", 1f).withDim("外向", 0.8f)
        val s = world(listOf(bold, CharSpec(name = "乙").withDim("外向", 0.5f)), rels = friends("p1", "p2", like = 75), house = "cottage")
        tick(s); days(s, 20)
        assertTrue(s.life.log.any { it.text.contains("約了") || it.text.contains("被婉拒") || it.text.contains("改成隔天") }, "invitations happen")
    }

    // ---------------- #45 influence, #49 bonds ----------------
    @Test fun closeFriendsRubOffButStayThemselves() {
        val s = world(listOf(CharSpec(name = "甲", traits = listOf("書蟲"), likes = listOf("看書")).withDim("依賴", 1f), CharSpec(name = "乙", likes = listOf("音樂", "畫畫", "星星", "紅茶", "散步"))),
            rels = friends("p1", "p2", like = 90, fam = 90, trust = 100))
        tick(s); days(s, 200) { s.society.pair("p1", "p2").n["all"] = (s.society.pair("p1", "p2").n["all"] ?: 0) + 3 }
        val a = s.person("p1")!!
        assertTrue(s.life.inner.picked["p1"].orEmpty().isNotEmpty(), "picked something up"); assertTrue(s.life.inner.picked["p1"]!!.size <= 3, "at most three")
        assertTrue("看書" in a.spec.likes && a.spec.traits == listOf("書蟲"), "still who they were"); assertTrue(s.life.log.any { it.text.contains("影響") })
    }
    @Test fun whenSadTheyGoToTheirPerson() {
        val s = world(listOf(CharSpec(name = "甲"), CharSpec(name = "乙"), CharSpec(name = "丙")), rels = friends("p1", "p2", like = 90) + friends("p1", "p3", like = 56))
        val a = s.person("p1")!!; tick(s)
        assertEquals("p2", s.inner.bondOf(a)?.id, "the one they think of first")
        for (i in 0 until 12) { a.moods.removeAll { it.id == "newhome" }; s.addMood(a, "heartbroken"); s.addMood(a, "cried"); tick(s); if (s.life.log.any { it.text.contains("第一個想到的是") }) break }
        assertTrue(s.life.log.any { it.text.contains("第一個想到的是乙") }, "mood ${s.moodValue(a)} bond ${s.inner.bondOf(a)?.id} ${s.life.log.takeLast(4).map { it.text }}"); assertTrue(s.inner.timeline("p1").any { it.key == "confide" })
    }

    // ---------------- #40, determinism ----------------
    @Test fun theSameWorldLivesTheSameInnerLife() {
        fun run(): String { val s = world(listOf(CharSpec(name = "甲").withDim("主動", 1f), CharSpec(name = "乙"), CharSpec(name = "丙").withDim("獨立", 1f)), hour = 8.0, seed = 11, house = "cottage")
            s.catchUp(s.life.minute + 6 * 1440, summarize = false); return Json.encodeToString(InnerState.serializer(), s.life.inner) + s.life.log.joinToString { it.text } }
        val a = run(); assertEquals(a, run()); assertTrue(a.contains("firsts"))
    }
}
