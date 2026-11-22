package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.CustomLine
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.chars.Relations
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.social.HouseRules
import app.ocshimeji.sim.social.Scenarios
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** 1.8.0 (R7 second batch, 「和你」): one test per item */
class YouTest {
    private val day0 = 20000.0 * 1440
    private val A = CharSpec(name = "阿光", traits = listOf("勤快", "溫和"), age = 22)
    private val B = CharSpec(name = "小雨", traits = listOf("嘴硬心軟", "急性子"), age = 21, temper = 0.6f)
    private val C = CharSpec(name = "團子", age = 20)
    private fun world(specs: List<CharSpec> = listOf(A, B, C), hour: Double = 10.0, house: String = "apartment", rooms: Map<String, String>? = null, rels: List<Rel> = emptyList()): LifeSim {
        val h = Houses.get(house); val ts = specs.mapIndexed { i, s -> Tenant("p${i + 1}", s.name, s.adult) }
        val life = LifeSim.create(5, h, ts, rooms ?: Houses.autoRooms(h, ts), ts.associate { it.id to "lib${it.id}" }, ts.indices.associate { "p${it + 1}" to specs[it] }, "鎮", "家", day0 + hour * 60, 0, rels)
        life.clockMode = "GAME"; life.speed = 60.0; life.arriving = false
        return LifeSim(life).also { s -> s.life.people.forEach { it.recent["outing"] = s.life.minute + 30 * 1440.0 } }
    }
    private fun days(s: LifeSim, n: Int) { s.catchUp(s.life.minute + n * 1440.0, summarize = false) }
    private fun log(s: LifeSim, w: String) = s.life.log.any { w in it.text }

    @Test fun e07MessagesAndReplies() {
        val s = world(); s.life.people.forEach { it.affinity = 60 }; days(s, 6)
        val ms = s.you.messages(); assertTrue(ms.any { it.kind == "goodnight" }, "goodnight messages: ${ms.map { it.kind }}")
        assertTrue(ms.map { it.kind }.toSet().size >= 2, "more than one kind: ${ms.map { it.kind }.toSet()}")
        assertTrue(ms.groupBy { it.from to (it.minute / 1440).toLong() }.values.all { it.size <= 2 }, "at most two a day each")
        val m = ms.first { it.reply < 0 }; val p = s.person(m.from)!!; val a0 = p.affinity
        assertTrue(s.you.reply(m.id, 0).isNotEmpty()); assertEquals(0, m.reply); assertTrue(p.affinity > a0); assertEquals("", s.you.reply(m.id, 1), "answered once")
    }
    @Test fun e09PhotosKeepWhoAndHow() {
        val s = world(); val ids = s.life.people.take(2).map { it.id }
        val ph = s.you.takePhoto(ids, listOf("HAPPY", "SHY"), "warm", "polaroid", listOf("heart"), "第一張合照")!!
        assertEquals(ids, ph.who); assertEquals(listOf("HAPPY", "SHY"), ph.poses); assertTrue(log(s, "拍了一張照片")); assertTrue(s.person(ids[0])!!.moods.any { it.id == "photo" })
        assertNull(s.you.takePhoto(emptyList(), emptyList(), "none", "none", emptyList())); assertTrue(s.you.deletePhoto(ph.id)); assertTrue(s.life.you.photos.isEmpty())
    }
    @Test fun m04TheirOwnLines() {
        val s = world(listOf(A.copy(lines = listOf(CustomLine("早安，今天也要加油！", "morning"), CustomLine("嘿嘿，好舒服。", "petted"), CustomLine("隨便說說。", "any"))), C), hour = 8.0)
        val p = s.life.people[0]; val r = Rng(1)
        assertEquals("早安，今天也要加油！", s.you.customLine(p, r), "the morning one in the morning"); assertEquals("嘿嘿，好舒服。", s.you.customLine(p, r, "petted"))
        assertNull(s.you.customLine(s.life.people[1], r), "nothing without lines")
        var said = false; repeat(20) { s.pet(p.id, 1.5f, "頭"); s.petEnd(p.id); if (s.events.any { it.kind == "say" && it.text.contains("好舒服") }) said = true; s.events.clear(); s.life.minute += 15 }
        assertTrue(said, "petted: their own line")
    }
    @Test fun p03NotesOnTheTimeline() {
        val s = world(); assertNull(s.you.note("p2", "今天小雨偷偷幫大家洗了碗", "感動"))
        val n = s.you.notes("p2").single(); assertTrue(n.text.contains("#感動")); assertTrue(n.fav, "kept forever"); assertNotNull(s.you.note(null, " "))
        repeat(700) { s.log(s.life.people[0], "填充 $it") }; s.trimLog(); assertEquals(1, s.you.notes().size, "never trimmed away")
    }
    @Test fun p04TimeCapsules() {
        val s = world(listOf(A.copy(dream = "寫一本書"), C)); assertNull(s.you.bury("給三十天後的我們：還好嗎？")); assertNotNull(s.you.bury("第二個"), "one at a time")
        val c = s.you.capsuleOpen()!!; assertEquals(2, c.theirs.size); assertTrue(c.theirs["p1"]!!.contains("寫一本書"))
        days(s, 29); assertFalse(c.opened); days(s, 2); assertTrue(c.opened, "thirty days later"); assertTrue(s.life.soc.mail.any { it.kind == "capsule" }); assertTrue(log(s, "打開了"))
    }
    @Test fun p05ScenarioStarts() {
        assertTrue(Scenarios.ALL.size >= 5); val ids = listOf("a", "b", "c")
        for (sc in Scenarios.ALL.values) { val rs = Scenarios.rels(sc.id, ids); assertEquals(6, rs.size)
            for (r in rs) assertNull(Relations.problem(r, CharSpec(age = 20), CharSpec(age = 20), false), "${sc.id}: ${r.kind}")
            assertTrue(Houses.ALL.any { it.id == sc.house } && sc.min <= sc.max && sc.max <= Houses.get(sc.house).capacity) }
        assertTrue(Scenarios.rels("rivals", listOf("a", "b")).all { it.conflict >= 40 && "對手" in it.flavor })
    }
    @Test fun p11HouseRules() {
        val s = world(hour = 23.5); val (a, b, _) = s.life.people
        assertNull(s.you.setRule("quiet", true)); assertTrue(s.you.keeps(a, "quiet")); assertFalse(s.you.keeps(b, "quiet"), "a temper and 嘴硬心軟 push back")
        assertTrue(log(s, "抗議家規")); val tv = Acts["tv"]!!
        assertTrue(s.you.appealK(a, tv) < 0.5f, "after eleven, the one who keeps it watches less TV"); assertEquals(1f, s.you.appealK(b, tv))
        s.life.minute = Math.floor(s.life.minute / 1440) * 1440 + 15 * 60; assertEquals(1f, s.you.appealK(a, tv), "only at night")
        for (id in listOf("dishes", "tidy", "bed")) s.you.setRule(id, true); assertNotNull(s.you.setRule("outside", true), "at most four"); assertEquals(HouseRules.MAX, s.life.you.rules.size)
        days(s, 2); assertTrue(log(s, "輪到")); s.you.setRule("quiet", false); assertFalse("quiet" in s.life.you.rules)
    }
    @Test fun p13AskingToChangeRooms() {
        val rels = listOf(Rel("p1", "p2", "認識", like = 10, conflict = 70), Rel("p2", "p1", "認識", like = 10, conflict = 70))
        val s = world(listOf(A, B), house = "apartment", rooms = mapOf("p1" to "bed1", "p2" to "bed1"), rels = rels)
        var k = 0; while (s.drama.pending().none { it.kind == "room" } && k++ < 10) days(s, 1)
        val d = s.drama.pending().first { it.kind == "room" }; val a = s.person(d.who)!!; val before = a.room
        assertTrue(s.drama.decide(d.id, 0).contains("搬到")); assertNotEquals(before, a.room); assertTrue(log(s, "搬到了"))
    }
    private fun assertNotEquals(a: Any?, b: Any?) = assertTrue(a != b, "$a should differ from $b")
    @Test fun r21TopicsFollowTheMoment() {   /* 2.1.0 (#07): what you can talk about comes from now, not a fixed list */
        val s = world(hour = 10.0); val p = s.person("p1")!!
        val day = s.society.topicsFor("p1").map { it.id }; assertTrue("how" in day && day.size in 2..6, "$day")
        s.env.setWeather("rain"); p.affinity = 80; s.env.jumpTo(21.0)
        val night = s.society.topicsFor("p1").map { it.id }; assertTrue("weather" in night && "night" in night, "$night"); assertTrue(night != day, "a different moment, different topics")
        assertTrue(s.society.youChat("p1", "weather").isNotEmpty()); assertTrue(s.society.youChat("p1", night.first { it.startsWith("friend:") }).isNotEmpty())
    }

}
