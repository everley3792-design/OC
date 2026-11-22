package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.RoomKind
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.WorldItem
import app.ocshimeji.sim.town.Goods
import app.ocshimeji.sim.town.Town
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** M7 (first batch of 1.0): diary, titles, dreams, achievements, the book, plants and garden, gathering, market day, festivals, series, stickers, the café */
class JournalTest {
    private val day0 = 20000.0 * 1440
    private val specs = listOf(CharSpec(name = "阿光", age = 24, axes = listOf(0.6f, 0.5f, 0.2f, 0.4f, 0.3f), likes = listOf("花")), CharSpec(name = "小雨", age = 22), CharSpec(name = "團子", age = 30))
    private fun world(house: String = "bungalow", at: Double = day0 + 8 * 60, seed: Long = 7): LifeSim {
        val h = Houses.get(house); val ts = specs.mapIndexed { i, s -> Tenant("p${i + 1}", s.name, s.adult) }
        val life = LifeSim.create(seed, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to "lib${it.id}" }, ts.indices.associate { "p${it + 1}" to specs[it] }, "鎮", "家", at, 0)
        life.clockMode = "GAME"; life.speed = 60.0; life.arriving = false
        return LifeSim(life)
    }
    private fun run(s: LifeSim, min: Double) { val end = s.life.minute + min; while (s.life.minute < end) { s.update(0.1f); s.events.clear() } }

    @Test fun aDayLeavesADiaryDreamsAndCounts() {
        val s = world(); run(s, 2 * 1440.0)
        val pr = s.life.prog
        assertTrue(pr.diary.isNotEmpty(), "diary"); assertTrue(pr.diary.all { it.lines.size >= 2 })
        assertTrue(pr.dreams.isNotEmpty(), "dreams"); assertTrue(pr.dreams.any { it.told }, "told when they woke")
        assertTrue(s.journal.total("act:sleep") >= 3 && s.journal.total("act:meal") >= 1, "counts ${pr.counts.keys.take(10)}")
        assertTrue(s.economy.consistent())
    }

    @Test fun titlesAchievementsAndTheBook() {
        val s = world(); val p = s.life.people[0]
        repeat(8) { s.journal.did(p.id, "town") }
        assertTrue(s.journal.titlesOf(p.id).any { it.id == "town" }); assertTrue(s.life.log.any { it.text.contains("小鎮通") })
        val a = s.journal.ACHIEVEMENTS.first { it.id == "town1" }; assertTrue(s.journal.claimable(a))
        val w = s.economy.wallet; assertNull(s.journal.claim("town1")); assertEquals(w + a.reward, s.economy.wallet); assertNotNull(s.journal.claim("town1"), "once")
        assertNotNull(s.journal.claim("day30"), "not yet")
        val food = s.townLife.stock("grocery").first(); s.townLife.buy(food.id); assertEquals(3, s.life.prog.book[food.id], "owned")
        assertTrue(s.journal.entries.size >= 50); assertTrue(s.economy.consistent())
    }

    @Test fun plantsGrowAndTheGardenGivesFood() {
        val s = world(); val p = s.life.people[0]
        val plant = s.house.pieces.indexOfFirst { it.kind == "plant" }; assertTrue(plant >= 0)
        p.actPiece = plant; repeat(6) { s.journal.actDone(p, Acts["water"]!!) }
        val pc = s.house.pieces[plant]; assertEquals(3, s.journal.plantStage(pc.x, pc.y), "flowering")
        s.life.minute += 4 * 1440; assertEquals(-1, s.journal.plantStage(pc.x, pc.y), "drooping when forgotten")
        repeat(3) { s.journal.actDone(p, Acts["garden"]!!) }
        assertTrue(s.life.bag.keys.any { it.startsWith("v:") }, "harvest in the bag"); assertEquals("", s.feed(p.id, s.life.bag.keys.first { it.startsWith("v:") }).let { if (it.contains("吃不下")) "" else it })
        assertTrue(s.economy.consistent())
    }

    @Test fun marketDayAndFestivals() {
        val market = (0 until 7L).first { Town.marketDay(20000 + it) } + 20000
        assertEquals(8, Goods.grocery(7, market).count { it.kind != "desk" }); assertEquals(6, Goods.grocery(7, market + 1).count { it.kind != "desk" })
        val petal = java.time.LocalDate.of(2026, 4, 15).toEpochDay()
        assertEquals("petal", Town.festival(petal)?.id); assertNull(Town.festival(petal + 1))
        val s = world(at = petal * 1440.0 + 14 * 60); run(s, 9 * 60.0)
        assertTrue(s.life.town.news.any { it.contains("花瓣夜") } || s.life.log.any { it.text.contains("花瓣夜") }, "news ${s.life.town.news}")
        assertTrue(s.journal.total("festival") >= 1, "someone went to the festival: ${s.life.log.takeLast(30).map { it.text }}")
        assertTrue(s.economy.consistent())
        run(s, 3 * 60.0); assertTrue(s.life.people.all { it.out == null || it.out!!.stage == "back" }, "home after the festival")
    }

    @Test fun gatheringInTheParkAndTreatingAtTheCafe() {
        val s = world(); val p = s.life.people[0]
        s.townLife.leave(p); p.out!!.act = "gather"; p.out!!.place = "park"; run(s, 90.0)
        assertTrue(s.life.bag.keys.any { it.startsWith("w:") } || s.journal.total("gather") >= 1, "found something")
        val q = s.life.people[1]; s.townLife.leave(q); q.out!!.act = "coffee"; q.out!!.place = "cafe"; q.out!!.stage = "at"; q.out!!.until = s.life.minute + 30
        val w = s.economy.wallet; assertNull(s.townLife.treat()); assertTrue(s.economy.wallet < w); assertTrue(q.moods.any { it.id == "treated" })
        assertTrue(s.economy.consistent())
    }

    @Test fun seriesStickersFlipAndRoomLines() {
        val s = world()
        s.life.items += WorldItem("cup1", "藍杯子", "decor", w = 1, h = 1, price = 20, series = "藍色系"); s.life.items += WorldItem("cup2", "藍盤子", "decor", w = 1, h = 1, price = 20, series = "藍色系")
        s.life.items += WorldItem("st", "星星貼紙", "sticker", w = 1, h = 1)
        s.relayout()
        for (k in listOf("item:cup1", "item:cup2", "item:st")) s.economy.move(k, 1, "測試")
        val living = s.house.rooms.first { it.kind == RoomKind.LIVING }
        val before = s.townLife.roomScore(living.id).second
        for (k in listOf("item:cup1", "item:cup2")) { var ok = false; for (y in living.y + 1 until living.y + living.h) { for (x in living.x until living.x + living.w) if (s.decorate.place(k, x, y) == null) { ok = true; break }; if (ok) break }; assertTrue(ok, k) }
        assertTrue(s.journal.setsIn(living.id).isNotEmpty()); assertTrue(s.townLife.roomScore(living.id).second > before, "series makes it prettier")
        assertTrue(s.life.log.any { it.text.contains("系列湊成一套") })
        assertNotNull(s.decorate.place("item:st", living.x + 2, living.y + 2), "a sticker is not for the floor")
        assertTrue((living.x until living.x + living.w).any { x -> s.decorate.place("item:st", x, living.y) == null }, "on the wall")
        val i = s.decorate.pieces().indexOfFirst { it.kind == "sofa" || it.kind == "table" }; assertNull(s.decorate.flip(i)); assertTrue(s.house.pieces[i].flip)
        assertTrue(s.journal.roomLine(living.id).isNotBlank()); assertTrue(s.economy.consistent())
    }

    @Test fun statsAndTheStarOfTheWeek() {
        val s = world(); run(s, 8 * 1440.0)
        assertTrue(s.journal.stats().isNotEmpty(), "stats"); assertTrue(s.life.prog.stars.isNotEmpty(), "a star after a week")
        assertTrue(s.life.log.any { it.text.contains("本週之星") })
    }
}
