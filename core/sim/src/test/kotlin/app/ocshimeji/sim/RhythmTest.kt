package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.LifeSim
import kotlin.test.Test
import kotlin.test.assertTrue

/** R1: the shape of a day — no midnight cooking or evening naps, more kinds of small things, everyone their own hours */
class RhythmTest {
    private val day0 = 20000.0 * 1440
    @Test fun aWeekOfThreePlainResidents() {
        val specs = listOf(CharSpec(name = "甲", age = 24), CharSpec(name = "乙", age = 22), CharSpec(name = "丙", age = 30))
        val h = Houses.APARTMENT; val ts = specs.mapIndexed { i, s -> Tenant("p$i", s.name, true) }
        val life = LifeSim.create(7, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to it.id }, ts.indices.associate { "p$it" to specs[it] }, "鎮", "家", day0 + 8 * 60, 0)
        life.clockMode = "GAME"; life.speed = 60.0; life.arriving = false; val s = LifeSim(life)
        val starts = ArrayList<Pair<String, Double>>(); val last = HashMap<String, String?>()
        val end = life.minute + 7 * 1440
        while (life.minute < end) { s.update(0.1f); s.events.clear()
            for (p in life.people) { val a = if (s.body(p.id).arrivedAct) p.act else null; if (a != null && last[p.id] != a) starts += a to ((life.minute % 1440) / 60); last[p.id] = a } }
        val kinds = starts.map { it.first }.toSet()
        val cooks = starts.count { it.first == "cook" }; val lateNaps = starts.count { (it.first == "nap" || it.first == "sofanap") && it.second >= 20.0 }
        val nightCook = starts.count { it.first == "cook" && (it.second < 6.0 || it.second >= 22.0) }
        val msg = "kinds=${kinds.size} $kinds cooks=$cooks lateNaps=$lateNaps nightCook=$nightCook"
        assertTrue(kinds.size >= 25, msg); assertTrue(cooks <= 7 * 4, msg)   /* about three meals a day for the household (was ~7.7) */; assertTrue(lateNaps == 0, msg); assertTrue(nightCook == 0, msg)
        assertTrue(life.people.map { s.wakeOf(it) }.toSet().size >= 2, "own hours: ${life.people.map { s.wakeOf(it) }}")
    }
}

/** R1: the clock (T1 waiting when ahead, T4 more than 30 days away) */
class ClockTest {
    private fun world(): LifeSim { val h = Houses.STUDIO; val ts = listOf(Tenant("p0", "甲", true))
        val life = LifeSim.create(3, h, ts, Houses.autoRooms(h, ts), mapOf("p0" to "p0"), mapOf("p0" to CharSpec(name = "甲")), "鎮", "家", 20000.0 * 1440 + 600, 0)
        life.arriving = false; return LifeSim(life) }
    @Test fun aheadOfThePhoneTheClockWaits() {
        val s = world(); val m = s.life.minute; s.hold = true; repeat(100) { s.update(0.1f) }
        assertTrue(s.life.minute == m, "held"); s.hold = false; repeat(100) { s.update(0.1f) }; assertTrue(s.life.minute > m)
    }
    @Test fun moreThanThirtyDaysAwayIsSkippedAndSaid() {
        val s = world(); val to = s.life.minute + 45 * 1440.0; val sum = s.catchUp(to)!!
        assertTrue(kotlin.math.abs(s.life.minute - to) < 1e-6, "the clock is now"); assertTrue(sum.lines.first().contains("跳過"), sum.lines.toString())
    }
}
