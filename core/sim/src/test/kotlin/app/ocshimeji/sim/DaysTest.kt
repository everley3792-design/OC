package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.social.Keepsake
import app.ocshimeji.sim.town.Goods
import app.ocshimeji.sim.town.Town
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** 1.9.0 (R7 last batch, 「家與小鎮」): one test per item */
class DaysTest {
    private val day0 = 20000.0 * 1440
    private val A = CharSpec(name = "阿光", age = 22, skills = mapOf("料理" to 3))
    private val B = CharSpec(name = "小雨", age = 21)
    private val C = CharSpec(name = "團子", age = 20)
    private fun world(specs: List<CharSpec> = listOf(A, B, C), hour: Double = 10.0, rels: List<Rel> = emptyList(), seed: Long = 5): LifeSim {
        val h = Houses.get("apartment"); val ts = specs.mapIndexed { i, s -> Tenant("p${i + 1}", s.name, s.adult) }
        val life = LifeSim.create(seed, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to "lib${it.id}" }, ts.indices.associate { "p${it + 1}" to specs[it] }, "鎮", "家", day0 + hour * 60, 0, rels)
        life.clockMode = "GAME"; life.speed = 60.0; life.arriving = false
        return LifeSim(life).also { s -> s.life.people.forEach { it.recent["outing"] = s.life.minute + 30 * 1440.0 } }
    }
    private fun days(s: LifeSim, n: Double) { s.catchUp(s.life.minute + n * 1440.0, summarize = false) }
    private fun log(s: LifeSim, w: String) = s.life.log.any { w in it.text }

    @Test fun i03RecipesFromStorage() {
        val s = world(); assertNull(s.days.recipeFor(false), "nothing in storage, no recipe")
        assertTrue(s.economy.move("v:pumpkin", 1, "test")); assertEquals("pumpkinsoup", s.days.recipeFor(false)?.id)
        assertEquals(listOf("紅蘿蔔 ×2"), s.days.missing(app.ocshimeji.sim.social.Recipes.ALL["carrotcake"]!!))
        days(s, 4.0)
        assertTrue("pumpkinsoup" in s.life.days.recipes, "the pumpkin was cooked: ${s.life.days.recipes}"); assertEquals(0, s.economy.count("v:pumpkin"))
        assertTrue(log(s, "學會了新菜：南瓜濃湯")); assertTrue(s.economy.consistent())
    }
    @Test fun j04AnniversariesAndDates() {
        val s = world(); s.life.romance = true
        assertNull(s.setRel(Rel("p1", "p2", "戀人", like = 90, familiar = 80, trust = 80))); assertNull(s.setRel(Rel("p2", "p1", "戀人", like = 90, familiar = 80, trust = 80))); days(s, 0.1)
        assertEquals(0L, s.days.daysSince("p:p1")); assertEquals(0L, s.days.daysSince("p1|p2|戀人"))
        s.life.days.since["p:p1"] = s.life.day - 29; s.life.days.since["p1|p2|戀人"] = s.life.day - 29
        days(s, 6.0)
        assertTrue(log(s, "搬進來滿 1 個月")); assertTrue(log(s, "在一起滿 1 個月")); assertTrue(s.life.soc.mail.any { it.kind == "anniv" })
        assertTrue(log(s, "約會："), "lovers go on dates")
        val minor = world(listOf(A, B.copy(age = 15)), rels = listOf(Rel("p1", "p2", "朋友"), Rel("p2", "p1", "朋友"))); minor.life.romance = true; days(minor, 6.0)
        assertFalse(log(minor, "約會"), "never with a minor")
    }
    @Test fun q01TheTownFeed() {
        val s = world(); days(s, 4.0)
        val f = s.days.feed(); assertTrue(f.isNotEmpty(), "posts"); val po = f.first()
        assertTrue(s.days.like(po.id)); assertTrue("you" in po.likes); assertFalse(s.days.like(po.id), "once")
    }
    @Test fun q02YourLittleTools() {
        val s = world(); val n0 = s.life.bag.values.sum()
        assertTrue(s.days.useTool("gift").contains("收納")); assertEquals(n0 + 1, s.life.bag.values.sum()); assertTrue(s.days.useTool("gift").contains("用過了"))
        assertTrue(s.days.useTool("star").contains("晚上")); assertTrue(s.days.toolReady("star"), "not used when refused")
        s.days.useTool("luck"); assertTrue(s.life.people.all { p -> p.moods.any { it.id == "lucky" } })
        s.days.useTool("dream"); days(s, 1.0); assertTrue(log(s, "做了一個好夢")); assertTrue(s.economy.consistent())
    }
    @Test fun q03DayTripsAndQ11Keepsakes() {
        val s = world(hour = 8.0); s.economy.earn(300, "test")
        assertNotNull(s.days.tripProblem("forest", emptyList()))
        assertNull(s.days.startTrip("forest", listOf("p1", "p2"))); val p1 = s.person("p1")!!
        assertEquals("trip", p1.out?.stage); assertTrue(s.townLife.inTown().none { it.first === p1 }, "not shown in town"); assertNotNull(s.days.tripProblem("beach", listOf("p3")), "one trip at a time")
        val like0 = s.rel("p1", "p2")?.like ?: 0; val photos0 = s.you.st.photos.size
        days(s, 0.5)
        assertNull(p1.out); assertTrue(log(s, "在森林小屋")); assertEquals("一片很大的葉子", s.days.cabinet("p1").single().zh)
        assertEquals(photos0 + 1, s.you.st.photos.size); assertTrue((s.rel("p1", "p2")?.like ?: 0) > like0); assertTrue(s.economy.consistent())
        repeat(20) { s.days.keep(p1, Keepsake("k$it", "小東西", "star", it.toLong(), "test")) }; assertEquals(12, s.days.cabinet("p1").size, "a cabinet holds twelve")
    }
    @Test fun g08TheMemoryFrame() {
        assertTrue(Furniture.known("frame") && Furniture.kind("frame").againstWall); assertEquals("frame", Goods.ALL["f:frame"]?.furniture)
        val s = world(); s.you.takePhoto(listOf("p1"), listOf("HAPPY"), "none", "none", emptyList(), "海邊的那天")
        s.days.frameLook(s.person("p1")!!); assertTrue(log(s, "海邊的那天"))
    }
    @Test fun g05TheyMoveLittleThings() {
        val s = world(); val before = s.decorate.pieces().map { "${it.kind}@${it.x},${it.y}" }
        days(s, 40.0); val after = s.decorate.pieces().map { "${it.kind}@${it.x},${it.y}" }
        assertTrue(log(s, "挪了一下位置"), "someone moved a little thing"); assertTrue(before != after); assertNull(s.decorate.problem(s.decorate.pieces()))
    }
    @Test fun f12TheDesktopDiary() {
        val s = world(); days(s, 0.1); s.life.days.deskMin["p1"] = 95.0; days(s, 1.0)
        assertTrue(s.life.prog.diary.any { it.who == "p1" && it.lines.first().contains("桌面日記") && it.lines.first().contains("1 小時") })
    }
    @Test fun h07TheTownAtNight() {
        assertTrue(Town.acts("sunny", "summer", 1, 19.5).all { it.night }); assertTrue(Town.acts("sunny", "summer", 1, 19.5).any { it.id == "stars" })
        assertTrue(Town.acts("sunny", "summer", 1).none { it.night }); assertTrue(Town.acts("rain", "summer", 1, 19.5).none { it.id == "stars" })
        val s = world(hour = 18.0); s.life.people.forEach { it.recent.remove("outing") }; s.economy.earn(200, "test")
        var night = false; repeat(6) { days(s, 1.0); if (s.life.log.any { it.text.contains("看星星") || it.text.contains("吃宵夜") || it.text.contains("夜裡散步") }) night = true }
        assertTrue(night, "someone went out in the evening")
    }
    @Test fun r8BreakupAndReunionOnlyWithYou() {
        val s = world(); s.life.romance = true
        assertNull(s.setRel(Rel("p1", "p2", "戀人", like = 50, familiar = 80, trust = 50, conflict = 70))); assertNull(s.setRel(Rel("p2", "p1", "戀人", like = 50, familiar = 80, trust = 50, conflict = 70)))
        days(s, 4.0); val d = s.drama.pending().firstOrNull { it.kind == "breakup" }; assertNotNull(d, "you are asked")
        assertEquals("戀人", s.rel("p1", "p2")?.kind, "while you are away nothing happens without you")
        s.drama.decide(d.id, 0); assertEquals("前任", s.rel("p1", "p2")?.kind); assertEquals("前任", s.rel("p2", "p1")?.kind)
        for ((a, b) in listOf("p1" to "p2", "p2" to "p1")) s.society.relUpdate(s.person(a)!!, s.person(b)!!) { it.copy(like = 92, conflict = 0) }
        s.drama.st.seen["parted:p1:p2"] = s.life.minute - 11 * 1440; days(s, 1.0)
        val r = s.drama.pending().firstOrNull { it.kind == "reunion" }; assertNotNull(r); s.drama.decide(r.id, 0); assertEquals("戀人", s.rel("p1", "p2")?.kind)
        val off = world(); off.life.romance = false; days(off, 3.0); assertTrue(off.drama.pending().none { it.kind == "breakup" || it.kind == "reunion" })
    }
    @Test fun daysAreDeterministic() {
        fun run(): List<String> { val s = world(seed = 9); s.economy.move("v:tomato", 2, "t"); days(s, 8.0); return s.life.log.map { it.text } + s.days.feed().map { it.text } }
        assertEquals(run(), run())
    }
}
