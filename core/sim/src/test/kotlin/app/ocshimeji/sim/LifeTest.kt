package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.Grid
import app.ocshimeji.sim.life.Life
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.Pose
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LifeTest {
    private val json = Json { encodeDefaults = true }
    private val day0 = 20000.0 * 1440   /* some day, 00:00 */
    private fun world(houseId: String = "apartment", n: Int = 3, hour: Double = 10.0): LifeSim {
        val h = Houses.get(houseId)
        val ts = (1..n).map { Tenant("p$it", "角色$it", true) }
        val rooms = Houses.autoRooms(h, ts)
        val specs = mapOf("p1" to CharSpec.fromWords("角色1", true, listOf("好奇", "溫和"), listOf("甜點")), "p2" to CharSpec.fromWords("角色2", true, listOf("慵懶"), emptyList()))
        val life = LifeSim.create(42, h, ts, rooms, ts.associate { it.id to "lib${it.id}" }, specs, "鎮", "家", day0 + hour * 60, 0)
        life.clockMode = "GAME"; life.speed = 60.0
        return LifeSim(life)
    }
    private fun run(s: LifeSim, realSec: Float) { var t = 0f; while (t < realSec) { s.update(0.1f); t += 0.1f } }

    @Test fun everyPieceIsReachableFromTheDoorInEveryHouse() {
        for (h in Houses.ALL) {
            val g = Grid(h); val d = g.distances(h.entrance.x, h.entrance.y)
            for (p in h.pieces) for (s in Furniture.kind(p.kind).slots) {
                val sx = p.x + s.dx; val sy = p.y + s.dy
                val (ax, ay) = if (g.walkable(sx.toInt(), sy.toInt())) sx.toInt() to sy.toInt() else g.nearestWalkable(sx, sy)
                assertTrue(d[ay * g.w + ax] >= 0, "${h.id}: ${p.kind} at ${p.x},${p.y} cannot be reached")
            }
            for (r in h.rooms) assertTrue(g.walkableTiles(h.rooms.indexOf(r)).any { d[it.second * g.w + it.first] >= 0 }, "${h.id}: room ${r.id} is cut off")
        }
    }
    @Test fun everyBedroomInEveryHouseCanBeSleptIn() {   /* M1 bug: the double bed (bed2) was never chosen for sleeping */
        for (h in Houses.ALL) for (room in h.bedrooms) {
            val t = Tenant("s", "睡", true)
            val life = LifeSim.create(3, h, listOf(t), mapOf("s" to room.id), mapOf("s" to "s"), mapOf("s" to CharSpec(name = "睡")), "鎮", "家", day0 + 23.5 * 60, 0)
            life.arriving = false; life.clockMode = "GAME"; life.speed = 60.0; val s = LifeSim(life); val p = life.people[0]
            for (n in Need.values()) p.setNeed(n, 90f); p.setNeed(Need.ENERGY, 10f)
            run(s, 90f); assertEquals("sleep", p.act, "${h.id}/${room.id}"); assertEquals(room.id, h.pieces[p.actPiece].room)
        }
    }
    @Test fun houseRules() {
        val ad = Tenant("a", "大人", true); val kid = Tenant("k", "小孩", false)
        assertNull(Houses.check(Houses.STUDIO, listOf(ad)))
        assertTrue(Houses.check(Houses.STUDIO, listOf(ad, Tenant("b", "B", true)))!!.contains("最多住 1 位"))
        assertTrue(Houses.check(Houses.COTTAGE, listOf(kid))!!.contains("成年"))
        assertNull(Houses.check(Houses.COTTAGE, listOf(kid, ad)))
        val five = (1..5).map { Tenant("t$it", "T$it", true) }; assertTrue(Houses.check(Houses.APARTMENT, five)!!.contains("最多住 4 位"))
        val four = five.take(4); val r = Houses.autoRooms(Houses.APARTMENT, four); assertEquals(4, r.size); assertNull(Houses.checkRooms(Houses.APARTMENT, four, r))
        assertTrue(Houses.checkRooms(Houses.APARTMENT, four, r + ("t4" to "bed2") + ("t3" to "bed2"))!!.contains("只睡得下"))
        assertTrue(Houses.checkRooms(Houses.COTTAGE, listOf(kid, ad), mapOf("k" to "bedA", "a" to "bedA"))!!.contains("未成年"))
    }
    @Test fun moveInThenEveryoneLivesAndNobodyGetsStuck() {
        val s = world(); val seen = HashMap<String, HashSet<String>>()
        assertTrue(s.life.arriving)
        repeat(1800) { s.update(0.1f); for (p in s.life.people) { p.act?.let { a -> seen.getOrPut(p.id) { HashSet() } += a }
            val b = s.body(p.id); if (!b.flying && !b.held && b.path == null && p.act == null) assertTrue(s.grid.walkable(p.x.toInt(), p.y.toInt()), "${p.name} stands in a wall at ${p.x},${p.y}") } }
        assertTrue(!s.life.arriving, "move-in day ended")
        for (p in s.life.people) assertTrue((seen[p.id]?.size ?: 0) >= 2, "${p.name} did ${seen[p.id]}")
        assertTrue(s.life.log.any { it.text.contains("搬進了") })
    }
    @Test fun hungryEatsTiredSleepsInOwnBedAtNight() {
        val s = world(hour = 13.0); val p = s.life.people[0]; for (n in Need.values()) p.setNeed(n, 90f); p.setNeed(Need.FOOD, 3f)
        s.life.arriving = false; run(s, 25f)
        assertTrue(p.recent.keys.any { it in setOf("snack", "cook", "meal") } || p.act in setOf("snack", "cook", "meal"), "hungry → food, did ${p.recent.keys} now ${p.act}")
        val n = world(hour = 23.5); n.life.arriving = false; val q = n.life.people[1]; q.setNeed(Need.ENERGY, 30f)
        run(n, 40f)
        assertEquals("sleep", q.act, "night + tired → sleep (why ${q.why})")
        assertEquals(q.room, n.house.pieces[q.actPiece].room, "in their own bedroom")
        assertTrue(q.why.contains("到了睡覺的時間"))
    }
    @Test fun petLiftThrowFeed() {
        val s = world("cottage", 2); s.life.arriving = false; s.life.people.forEach { it.recent["outing"] = s.life.minute }; run(s, 3f)   /* stay home for this one */
        val p = s.life.people[0]; p.setNeed(Need.ATTENTION, 10f)
        s.pet(p.id, 2f); s.petEnd(p.id); assertTrue(p.need(Need.ATTENTION) > 30f); assertTrue(p.moods.any { it.id == "petted" })
        s.lift(p.id); assertTrue(s.body(p.id).held); assertNull(p.act)
        s.hold(p.id, 2.2f, 1.6f)            /* over the double bed (not walkable) */
        s.drop(p.id, 14f, 3f); run(s, 3f)
        assertTrue(!s.body(p.id).flying && s.grid.walkable(p.x.toInt(), p.y.toInt()), "landed on the floor at ${p.x},${p.y}")
        assertTrue(p.moods.any { it.id == "thrown" || it.id == "thrownfun" })
        p.setNeed(Need.FOOD, 40f); s.feed(p.id, "cookie"); assertTrue(p.moods.any { it.id == "tasty" }, "p1 likes 甜點 → the cookie is tasty")
        p.setNeed(Need.FOOD, 99f); assertTrue(s.feed(p.id, "apple").contains("吃不下"))
        s.events.clear()
    }
    @Test fun sleepersCanBePettedWithoutWaking() {
        val s = world(hour = 23.5); s.life.arriving = false; val p = s.life.people[0]; p.setNeed(Need.ENERGY, 20f); run(s, 40f)
        assertEquals("sleep", p.act); s.pet(p.id, 1.5f); s.petEnd(p.id); assertEquals("sleep", p.act); assertTrue(p.moods.any { it.id == "pettedsleep" })
    }
    @Test fun catchUpIsDeterministicCappedAndSummarised() {
        val s = world(); run(s, 10f); s.life.arriving = false
        val snap = json.encodeToString(s.life)
        val a = LifeSim(json.decodeFromString<Life>(snap)); val b = LifeSim(json.decodeFromString<Life>(snap))
        val to = s.life.minute + 3 * 1440
        val sa = a.catchUp(to); b.catchUp(to)
        assertEquals(json.encodeToString(a.life), json.encodeToString(b.life), "same save + same absence = same story")
        assertNotNull(sa); assertEquals(3, sa.lines.size); assertTrue(sa.lines.all { it.contains("：") })
        assertTrue(a.life.people.all { p -> Need.values().all { p.need(it) in 0f..100f } })
        assertTrue(a.life.people.all { it.recent.containsKey("sleep") }, "everyone slept during three days")
        val c = LifeSim(json.decodeFromString<Life>(snap)); val start = c.life.minute; val s90 = c.catchUp(start + 90 * 1440.0)!!
        assertEquals(start + 90 * 1440.0, c.life.minute, 1e-6)   /* R1 T4: 30 days are lived, the rest is skipped and said */
        assertTrue(s90.lines.first().contains("跳過"))
    }
    @Test fun liveStepsAreDeterministicToo() {
        val a = world(); val b = world(); run(a, 60f); run(b, 60f)
        assertEquals(json.encodeToString(a.life), json.encodeToString(b.life))
    }
    @Test fun everyActivityHasValidData() {
        for (act in Acts.ALL.values) { assertTrue(act.min > 0); act.kind?.let { assertNotNull(Furniture.KINDS[it], "${act.id}: furniture $it") } }
        assertTrue(Pose.values().size > 10)
    }
}
