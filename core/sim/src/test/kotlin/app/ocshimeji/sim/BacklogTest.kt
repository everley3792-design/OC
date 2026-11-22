package app.ocshimeji.sim

import app.ocshimeji.sim.act.Interactions
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Litter
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** 1.5.1: what R1–R5 left undone — memories for every kind of line, catchphrases that rub off, your hand on things, time zones, queue order */
class BacklogTest {
    private fun world(rels: List<Rel> = emptyList(), b: CharSpec = CharSpec(name = "乙")): LifeSim { val h = Houses.COTTAGE; val ts = listOf(Tenant("a", "甲", true), Tenant("b", "乙", true))
        val life = LifeSim.create(11, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to it.id }, mapOf("a" to CharSpec(name = "甲"), "b" to b), "鎮", "家", 20000.0 * 1440 + 600, 0, rels)
        life.arriving = false; life.clockMode = "GAME"; life.speed = 60.0; for (p in life.people) p.recent["outing"] = life.minute; return LifeSim(life) }

    @Test fun everyMemoryHasASoundOrALine() {
        val s = world(); repeat(4 * 864) { s.update(10f) }
        val social = s.life.log.filter { it.kind == "social" || it.kind == "event" }
        assertTrue(social.isNotEmpty() && social.all { it.sound.isNotEmpty() || it.aside.isNotEmpty() }, "social and event lines are memories too")
        assertTrue(Interactions.ALL.size >= 148, "about 150 interactions: ${Interactions.ALL.size}")
    }
    @Test fun catchphrasesRubOffOnCloseFriends() {
        val friends = listOf(Rel("a", "b", "知己", like = 95, familiar = 95, trust = 90), Rel("b", "a", "知己", like = 95, familiar = 95, trust = 90))
        val s = world(friends, CharSpec(name = "乙", catchphrases = listOf("就是說啊")))
        var n = 0; while (n++ < 40 * 864 && s.person("a")!!.borrowed.isEmpty()) s.update(10f)
        assertEquals(listOf("就是說啊"), s.person("a")!!.borrowed, "picked up after a lot of talking")
        assertTrue(s.life.log.any { it.text.contains("學會了") })
    }
    @Test fun yourHandOnThings() {
        val s = world(); val lamp = s.house.pieces.indices.firstOrNull { s.house.pieces[it].kind == "lamp" }
        if (lamp != null) { val before = s.stateOf(lamp); assertNull(s.youSet(lamp, "lamp")); assertTrue(s.stateOf(lamp) != before) }
        val win = s.house.pieces.indices.first { s.house.pieces[it].kind == "window" }; assertNull(s.youSet(win, "curtain")); assertEquals("closed", s.stateOf(win))
        val bed = s.house.pieces.indices.first { s.house.pieces[it].kind.startsWith("bed") }; assertTrue(s.youSet(bed, "makebed")!!.contains("整齊"))
        s.life.things[s.pieceKey(bed)] = "messy"; assertNull(s.youSet(bed, "makebed")); assertEquals("tidy", s.stateOf(bed))
        s.life.litter += Litter("wrapper", 2, 3); assertNull(s.youPickUp(2, 3)); assertTrue(s.life.litter.isEmpty())
        repeat(2 * 864) { s.update(10f) }; assertEquals("open", s.world(win), "your curtains last until the morning")
    }
    private fun LifeSim.world(pi: Int) = if (hour >= 6.5 && hour < 20) stateOf(pi) else "open"
    @Test fun timeZonesAndQueueOrder() {
        val s = world(); s.life.clockMode = "REAL"; val m = s.life.minute
        s.zoneShift(60); assertEquals(m + 60, s.life.minute, 1e-9); s.zoneShift(-60); assertEquals(m + 60, s.life.minute, 1e-9, "never turned back")
        assertTrue(s.life.log.count { it.text.contains("時區") } == 2)
        s.life.clockMode = "GAME"; val so = s.society; so.setControl("a", "command")
        for (w in listOf("music", "hum", "dance")) so.suggest("a", w, queue = true)
        assertTrue(so.moveOrder("a", 2, -1)); assertEquals(listOf("act:music", "act:dance", "act:hum"), so.pending(s.person("a")!!))
        assertTrue(!so.moveOrder("a", 0, -1))
    }
}
