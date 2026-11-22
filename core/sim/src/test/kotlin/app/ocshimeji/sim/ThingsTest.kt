package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.Life
import app.ocshimeji.sim.life.LifeSim
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** R5: furniture has looks that follow life — a bed gets messy when slept in and neat when made, books come out, tidying clears the floor */
class ThingsTest {
    private val json = Json { encodeDefaults = true }
    private fun world(hour: Double = 10.0): LifeSim { val h = Houses.COTTAGE; val ts = listOf(Tenant("a", "甲", true))
        val life = LifeSim.create(4, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to it.id }, mapOf("a" to CharSpec(name = "甲")), "鎮", "家", 20000.0 * 1440 + hour * 60, 0)
        life.arriving = false; life.clockMode = "GAME"; life.speed = 60.0; for (p in life.people) p.recent["outing"] = life.minute; return LifeSim(life) }
    private fun doIt(s: LifeSim, what: String, piece: Int? = null) { val so = s.society; so.setControl("a", "command"); so.suggest("a", what + (piece?.let { "@$it" } ?: ""))
        val a = s.person("a")!!; var started = false; var n = 0; while (n++ < 30000 && !(started && a.act != what)) { s.update(0.1f); if (a.act == what && s.body("a").arrivedAct) started = true } }

    @Test fun bedsShelvesAndTheFloor() {
        val s = world(); val a = s.person("a")!!
        val bed = s.house.pieces.indices.first { (s.house.pieces[it].kind == "bed" || s.house.pieces[it].kind == "bed2") && s.house.pieces[it].room == a.room }
        assertEquals("tidy", s.stateOf(bed))
        s.society.setControl("a", "command"); s.society.suggest("a", "nap@$bed"); var sleeping = false
        var n = 0; while (n++ < 30000 && !(sleeping && a.act != "nap")) { s.update(0.1f); if (s.stateOf(bed) == "sleeping") sleeping = true }
        assertTrue(sleeping, "someone asleep in it"); assertEquals("messy", s.stateOf(bed), "slept in, not made")
        doIt(s, "makebed"); assertEquals("tidy", s.stateOf(bed), "made again")
        // things on the floor go away when the room is tidied
        val room = s.roomOf(a); s.life.litter += app.ocshimeji.sim.life.Litter("wrapper", a.x.toInt(), a.y.toInt())
        val shelf = s.house.pieces.indices.first { s.house.pieces[it].kind == "shelf" }; s.life.things[s.pieceKey(shelf)] = "out"
        assertEquals("out", s.stateOf(shelf))
        val back = LifeSim(json.decodeFromString<Life>(json.encodeToString(s.life))); assertEquals("out", back.stateOf(shelf)); assertEquals(1, back.life.litter.size)
        s.person("a")!!.setNeed(app.ocshimeji.sim.life.Need.ROOM, 20f); doIt(s, "tidy")
        assertTrue(s.life.litter.none { s.house.roomAt(it.x, it.y)?.id == s.roomOf(a) } || s.roomOf(a) != room, "tidied")
    }
    @Test fun statesThatFollowWhatIsHappening() {
        val s = world(21.0)
        val lamp = s.house.pieces.indices.firstOrNull { s.house.pieces[it].kind == "lamp" }
        if (lamp != null) { val p = s.person("a")!!; val pc = s.house.pieces[lamp]; val r = s.house.rooms.first { it.id == pc.room }
            p.x = r.x + 1.5f; p.y = r.y + 1.5f; assertEquals("on", s.stateOf(lamp), "someone awake in the room at night") }
        val win = s.house.pieces.indices.first { s.house.pieces[it].kind == "window" }; assertEquals("closed", s.stateOf(win))
        assertEquals("open", world(10.0).let { w -> w.stateOf(win) })
        val table = s.house.pieces.indices.first { s.house.pieces[it].kind == "table" }; s.life.soc.dishes = 2; assertEquals("dishes", s.stateOf(table))
    }
    @Test fun aWeekOfLivingLeavesTheSameTraces() {
        fun go(): String { val s = world(); repeat(3 * 864) { s.update(10f) }; return s.life.things.toSortedMap().toString() + s.life.litter.joinToString { "${it.kind}${it.x},${it.y}" } }
        val a = go(); assertEquals(a, go()); assertTrue(a.isNotEmpty())
    }
}
