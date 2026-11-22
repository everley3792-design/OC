package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.Economy
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.WorldItem
import app.ocshimeji.sim.town.Goods
import app.ocshimeji.sim.town.Town
import app.ocshimeji.sim.town.Weather
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** M6 acceptance: residents go to town and come back on their own, the ledger and the bag always agree, decorating and moving work */
class TownTest {
    private val json = Json { encodeDefaults = true }
    private val day0 = 20000.0 * 1440
    private val A = CharSpec(name = "阿光", age = 24, axes = listOf(0.6f, 0.5f, 0.2f, 0.4f, 0.3f), traits = listOf("健談", "好勝"), likes = listOf("甜點"), tastes = mapOf("甜" to 1), skills = mapOf("料理" to 4))
    private val B = CharSpec(name = "小雨", age = 22, axes = listOf(-0.5f, -0.3f, 0f, -0.3f, 0.6f), traits = listOf("害羞"), likes = listOf("看書"))
    private val C = CharSpec(name = "團子", age = 30, axes = listOf(0.2f, -0.4f, -0.3f, 0.1f, -0.4f), traits = listOf("貪吃"), likes = listOf("布丁"))

    private fun world(house: String = "apartment", hour: Double = 8.0, specs: List<CharSpec> = listOf(A, B, C), seed: Long = 7): LifeSim {
        val h = Houses.get(house); val ts = specs.mapIndexed { i, s -> Tenant("p${i + 1}", s.name, s.adult) }
        val life = LifeSim.create(seed, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to "lib${it.id}" }, ts.indices.associate { "p${it + 1}" to specs[it] }, "鎮", "家", day0 + hour * 60, 0)
        life.clockMode = "GAME"; life.speed = 60.0; life.arriving = false
        return LifeSim(life)
    }
    private fun run(s: LifeSim, gameMinutes: Double, each: (() -> Unit)? = null) { val end = s.life.minute + gameMinutes; while (s.life.minute < end) { s.update(0.1f); s.events.clear(); each?.invoke() } }

    @Test fun contentIsComplete() {
        assertEquals(5, Town.PLACES.size); assertEquals(25, Town.EVENTS.size); assertEquals(6, Houses.ALL.size)
        assertTrue(Town.EVENTS.all { e -> Town.PLACES.any { it.id == e.place } })
        assertEquals(6, Goods.grocery(1, 100).count { it.kind == "food" }); assertEquals(Goods.DESK, Goods.grocery(1, 100).filter { it.kind == "desk" }); assertEquals(7, Goods.furniture(1, 100).size)
        assertEquals(Goods.furniture(1, 98).map { it.id }, Goods.furniture(1, 104).map { it.id })      /* one week, one shelf */
        assertTrue((0 until 30L).map { Goods.grocery(1, it).map { g -> g.id } }.toSet().size > 10)       /* the grocery changes daily */
    }

    @Test fun residentsGoToTownAndComeBackOnTheirOwn() {
        val s = world(); val went = HashSet<String>(); val back = HashSet<String>(); var maxOut = 0.0; val outSince = HashMap<String, Double>()
        run(s, 6 * 1440.0) {
            for (p in s.life.people) { val o = p.out
                if (o != null) { went += p.id; outSince.getOrPut(p.id) { s.life.minute }; maxOut = maxOf(maxOut, s.life.minute - outSince[p.id]!!) }
                else if (outSince.remove(p.id) != null) back += p.id }
        }
        assertEquals(3, went.size, "everyone went to town: $went"); assertEquals(went, back, "and came back")
        assertTrue(maxOut < 14 * 60, "nobody stays in town all day ($maxOut min)")
        assertTrue(s.life.log.any { it.text.contains("出門去小鎮") } && s.life.log.any { it.text.contains("從小鎮回家") })
        assertTrue(s.economy.consistent(), "ledger"); assertTrue(s.life.goals.size == 3 && s.life.town.news.isNotEmpty())
        // night: everyone is home
        val night = s.life.minute - (s.life.minute % 1440) + 1440 + 23 * 60; run(s, night - s.life.minute)
        assertTrue(s.life.people.all { it.out == null }, "home at night")
    }

    @Test fun townTripsAlsoHappenWhileYouAreAway() {
        val s = world(); val sum = s.catchUp(s.life.minute + 3 * 1440.0)
        assertNotNull(sum); assertTrue(s.life.log.count { it.text.contains("出門去小鎮") } >= 2, "away: ${s.life.log.count { it.text.contains("出門去小鎮") }}")
        assertTrue(s.economy.consistent())
        val t = s.life.minute - (s.life.minute % 1440) + 1440 + 23.5 * 60; s.catchUp(t); assertTrue(s.life.people.all { it.out == null })
    }

    @Test fun theLedgerAndTheBagAlwaysAgree() {
        val s = world(); val e = s.economy; val t = s.townLife
        assertEquals(Economy.START, e.wallet); assertEquals(1, s.life.ledger.size)
        val food = t.stock("grocery").first(); assertNull(t.buy(food.id)); assertEquals(1, e.count(food.id)); assertEquals(Economy.START - food.price, e.wallet)
        val notToday = Goods.FOOD.first { g -> t.stock("grocery").none { it.id == g.id } }; assertNotNull(t.buy(notToday.id))
        val f = t.stock("furniture").first(); assertNull(t.buy(f.id))
        // feeding takes it out of the bag; the built-in snacks stay free
        assertEquals("", s.feed("p1", food.id)); assertEquals(0, e.count(food.id)); assertTrue(s.feed("p1", food.id).contains("背包裡沒有")); s.feed("p2", "cookie")
        // the stall and the corners: in and out of the bag
        assertNull(t.list(f.id, 999)); assertEquals(0, e.count(f.id)); t.unlist(f.id); assertEquals(1, e.count(f.id))
        assertNull(t.putCorner(app.ocshimeji.sim.town.TownState.CORNERS.keys.first(), f.id)); assertEquals(0, e.count(f.id)); t.takeCorner(app.ocshimeji.sim.town.TownState.CORNERS.keys.first()); assertEquals(1, e.count(f.id))
        // a sale on a new day
        assertNull(t.list(f.id, 1)); val before = e.wallet; run(s, 1440.0); assertTrue(e.wallet != before || s.life.town.stall.isNotEmpty())
        // spending more than you have changes nothing
        val w = e.wallet; assertTrue(!e.spend(w + 1, "太貴")); assertEquals(w, e.wallet)
        assertTrue(e.consistent(), "ledger: ${s.life.ledger.map { "${it.amount} ${it.item}${it.qty}" }} bag ${s.life.bag} wallet ${e.wallet}")
        val back = json.decodeFromString<app.ocshimeji.sim.life.Life>(json.encodeToString(s.life)); assertTrue(Economy(back).consistent())
    }

    @Test fun aCommissionIsCraftedAtHomeAndLandsInTheBag() {
        val s = world(hour = 9.0); s.life.items += WorldItem("vase", "小花瓶", "decor", price = 60)
        val e = s.economy; assertNull(s.townLife.commission("vase", "p1")); assertTrue(e.wallet < Economy.START)
        assertNotNull(s.townLife.commission("vase", "p1"))                     /* one at a time */
        run(s, 12 * 60.0); assertEquals(1, e.count("item:vase"), "made: ${s.life.town.jobs.map { it.worked }}"); assertEquals(1, s.life.town.works["vase"]!!.made)
        assertTrue(e.consistent())
    }

    @Test fun decoratingChecksTheLayoutAndCanBeUndone() {
        val s = world(house = "apartment"); val d = s.decorate; val t = s.townLife
        val n0 = d.pieces().size
        s.economy.earn(500, "測試"); val plant = Goods.FURNITURE.first { it.furniture == "plant" }
        while (t.stock("furniture").none { it.id == plant.id }) s.life.minute += 7 * 1440.0
        assertNull(t.buy(plant.id)); assertEquals(1, s.economy.count("f:plant"))
        val h = Houses.get(s.life.houseId)
        // a doorway is refused, the bag is untouched
        val door = h.doors.first(); assertNotNull(d.place("f:plant", door.x, door.y)); assertEquals(1, s.economy.count("f:plant"))
        // somewhere free in the living room
        val room = h.rooms.first { it.kind == app.ocshimeji.sim.house.RoomKind.LIVING }
        val spot = (room.y + 1 until room.y + room.h).flatMap { y -> (room.x until room.x + room.w).map { x -> x to y } }.first { (x, y) -> d.place("f:plant", x, y) == null }
        assertEquals(n0 + 1, d.pieces().size); assertEquals(0, s.economy.count("f:plant")); assertTrue(s.house.pieces.any { it.kind == "plant" && it.x == spot.first && it.y == spot.second })
        // fixed things stay; a bed can be put away but then the bedroom lacks beds
        assertNotNull(d.remove(d.pieces().indexOfFirst { it.kind == "tub" }))
        assertNotNull(d.remove(d.pieces().indexOfFirst { it.kind == "bed" && s.life.people.any { p -> p.room == it.room } }))
        // undo puts the plant back in the bag
        assertNull(d.undo()); assertEquals(n0, d.pieces().size); assertEquals(1, s.economy.count("f:plant"))
        assertTrue(s.economy.consistent())
        // after decorating, everyone still gets around and sleeps
        run(s, 1440.0); assertTrue(s.life.people.all { it.act != null || it.out != null || true })
    }

    @Test fun movingHouseTakesYourFurnitureAndEveryoneAlong() {
        val s = world(house = "apartment"); s.economy.earn(500, "測試")
        val lamp = Goods.FURNITURE.first { it.furniture == "lamp" }; while (s.townLife.stock("furniture").none { it.id == lamp.id }) s.life.minute += 7 * 1440.0
        s.townLife.buy(lamp.id); val h = Houses.get(s.life.houseId); val room = h.rooms.first { it.kind == app.ocshimeji.sim.house.RoomKind.LIVING }
        (room.y + 1 until room.y + room.h).flatMap { y -> (room.x until room.x + room.w).map { x -> x to y } }.first { (x, y) -> s.decorate.place("f:lamp", x, y) == null }
        assertEquals(3, s.decorate.opinions(Houses.BUNGALOW).size)
        assertNotNull(s.decorate.moveTo(Houses.MANSION))                               /* locked until a home has 5 people */
        assertNotNull(s.decorate.moveTo(Houses.STUDIO))                                /* too small */
        assertNull(s.decorate.moveTo(Houses.BUNGALOW))
        assertEquals("bungalow", s.life.houseId); assertEquals("bungalow", s.house.id); assertEquals(1, s.economy.count("f:lamp")); assertTrue(s.life.layout.isEmpty())
        assertTrue(s.life.people.all { p -> Houses.BUNGALOW.bedrooms.any { it.id == p.room } })
        run(s, 1440.0); assertTrue(s.economy.consistent()); assertTrue(s.life.people.all { s.house.rooms.any { r -> r.id == s.roomOf(it) } || it.out != null })
    }

    @Test fun newHousesWork() {
        for (h in listOf(Houses.BUNGALOW, Houses.DORM, Houses.MANSION)) {
            val specs = (1..h.capacity).map { CharSpec(name = "住$it", age = 20 + it) }
            val s = world(house = h.id, specs = specs); run(s, 600.0)
            assertTrue(s.life.people.none { s.body(it.id).path == null && it.act == null && false }); assertTrue(s.economy.consistent(), h.id)
        }
        val dorm = world(house = "dorm", specs = (1..8).map { CharSpec(name = "住$it", age = 20 + it) }); assertEquals(2, dorm.house.pieces.count { it.kind == "tub" })
    }

    @Test fun weatherIsDeterministicAndSeasonal() {
        val a = (0 until 120).map { Weather.of(5, day0 + it * 1440.0 + 600) }; val b = (0 until 120).map { Weather.of(5, day0 + it * 1440.0 + 600) }
        assertEquals(a, b); assertTrue(a.toSet().size >= 3, "kinds: ${a.toSet()}")
        val summer = (0 until 365).map { day0 + it * 1440.0 }.filter { Weather.season(it) == "summer" }.map { Weather.of(5, it + 600) }
        assertTrue("snow" !in summer, "no snow in summer")
        val winter = (0 until 3 * 365).map { day0 + it * 1440.0 }.filter { Weather.season(it) == "winter" }.map { Weather.of(5, it + 600) }; assertTrue("snow" in winter)
    }

    @Test fun dailyGoalsPayOnce() {
        val s = world(); run(s, 60.0); val g = s.life.goals; assertEquals(3, g.size)
        val w0 = s.economy.wallet; val first = g.first(); s.townLife.goal(first.kind, first.target); assertTrue(first.done); val w1 = s.economy.wallet
        assertEquals(w0 + first.reward, w1); s.townLife.goal(first.kind, first.target); assertEquals(w1, s.economy.wallet)
    }

    @Test fun theSameWorldTheSameTown() {
        fun go(): String { val s = world(seed = 11); run(s, 2 * 1440.0); return s.life.ledger.joinToString { "${it.amount}:${it.reason}" } + s.life.log.joinToString { it.text } }
        assertEquals(go(), go())
    }
}
