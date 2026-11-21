package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.desk.DeskContext
import app.ocshimeji.sim.desk.DeskGestures
import app.ocshimeji.sim.desk.DeskPet
import app.ocshimeji.sim.desk.DeskScreen
import app.ocshimeji.sim.desk.DeskState
import app.ocshimeji.sim.desk.Side
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** M3 (plan): JVM tests for the desktop pet's physics and gestures, and that the desktop and the home share one set of needs */
class DeskTest {
    private val s = DeskScreen(360f, 780f, 24f, 48f)
    private fun pet(seed: Long = 1) = DeskPet("p", 110f, 0.8f, seed).also { it.place(s, 180f) }
    private fun run(p: DeskPet, sec: Float, c: DeskContext = DeskContext(), check: (DeskPet) -> Unit = {}) { var t = 0f; while (t < sec) { p.step(1 / 30f, s, c); check(p); t += 1 / 30f } }
    private fun inside(p: DeskPet) { val b = p.bounds(0f); assertTrue(!b[0].isNaN() && !b[1].isNaN()); assertTrue(b[0] > -p.height && b[0] + b[2] < s.w + p.height, "x ${p.x} ${p.state}"); assertTrue(b[1] >= s.top - 1 && b[1] + b[3] <= s.h + 1, "y ${p.y} ${p.state} ${p.side}") }

    @Test fun fallsOntoTheGroundAndNeverLeavesTheScreen() {
        val p = pet(); run(p, 2f); assertEquals(s.ground, p.y); assertTrue(p.state != DeskState.FALL)
        for (seed in 1L..12L) { val q = pet(seed); run(q, 240f, DeskContext(active = 0.8f)) { inside(it) } }
    }
    @Test fun throwBouncesOffWallsAndLandsWithAReaction() {
        val p = pet(); run(p, 2f); p.events.clear()
        p.grab(p.x, p.y - 40); assertEquals(DeskState.HELD, p.state); assertEquals(60, p.fps)
        p.drag(300f, 300f, s); assertEquals(300f, p.x, 0.5f)
        p.release(4000f, -1500f); assertEquals(DeskState.THROWN, p.state)
        var bounced = false; run(p, 4f) { inside(it); if (it.events.any { e -> e.kind == "sound" && e.text == "bounce" }) bounced = true }
        assertTrue(bounced, "hit a wall"); assertTrue(p.events.any { it.kind == "land" }, "landed hard → the simulation reacts"); assertEquals(s.ground, p.y)
        val q = pet(2); run(q, 2f); q.grab(q.x, q.y); q.release(50f, 0f); assertEquals(DeskState.FALL, q.state, "a gentle let go just drops")
    }
    @Test fun climbsWallsHangsFromTheTopAndLetsGo() {
        var sides = HashSet<Side>(); var states = HashSet<DeskState>()
        for (seed in 1L..30L) { val p = pet(seed); run(p, 300f) { sides += it.side; states += it.state; inside(it) } }
        assertTrue(Side.LEFT in sides || Side.RIGHT in sides, "climbs a wall"); assertTrue(Side.TOP in sides, "hangs from the top")
        for (st in listOf(DeskState.WALK, DeskState.RUN, DeskState.SIT, DeskState.STRETCH, DeskState.CLIMB, DeskState.HANG, DeskState.PEEK)) assertTrue(st in states, "does $st")
        val p = pet(); assertEquals(0f, p.rotation)
    }
    @Test fun needsThePhoneAndTheHour() {
        val hungry = pet(); run(hungry, 3f); run(hungry, 20f, DeskContext(food = 10f)); assertTrue(hungry.events.any { it.kind == "ask" && it.text == "food" }, "asks for food")
        val sleepy = pet(); run(sleepy, 30f, DeskContext(energy = 10f)); assertTrue(sleepy.state == DeskState.SLEEP); assertEquals(1, sleepy.fps); assertTrue(sleepy.events.any { it.kind == "rest" })
        sleepy.tap(); assertEquals(DeskState.IDLE, sleepy.state, "a tap wakes it")
        val low = pet(); run(low, 30f, DeskContext(battery = 8)); assertEquals(DeskState.DOZE, low.state)
        val charge = pet(); run(charge, 3f); run(charge, 1f, DeskContext(charging = true)); assertTrue(charge.events.any { it.kind == "say" && it.text == "charging" })
        val night = pet(); run(night, 120f, DeskContext(hour = 1.0)); assertTrue(night.events.any { it.text == "night" })
    }
    @Test fun hidesInFullscreenAndComesBack() {
        val p = pet(); run(p, 3f); run(p, 1f, DeskContext(fullscreen = true)); assertTrue(p.hidden); assertEquals(0, p.fps)
        run(p, 0.1f); assertFalse(p.hidden); assertTrue(p.events.any { it.text == "back" }); run(p, 3f) { inside(it) }
    }
    @Test fun aReminderPeeksFromTheEdgeUntilTapped() {
        val p = pet(); run(p, 3f); run(p, 8f, DeskContext(reminderDue = true)); assertEquals(DeskState.PEEK, p.state)
        assertTrue(p.x < 0 || p.x > s.w, "half out of the edge"); p.tap(); assertTrue(p.events.any { it.kind == "ack" }); assertTrue(p.state != DeskState.PEEK)
    }
    @Test fun sameSeedSameDay() { val a = pet(5); val b = pet(5); run(a, 120f); run(b, 120f); assertEquals(a.x, b.x); assertEquals(a.state, b.state) }

    @Test fun gestures() {
        val g = DeskGestures()
        g.down(0f, 100f, 100f); g.up(0.1f, 101f, 100f); assertTrue(g.out.last() is DeskGestures.G.Tap)
        g.down(0.25f, 100f, 100f); g.up(0.32f, 100f, 100f); assertTrue(g.out.last() is DeskGestures.G.DoubleTap)
        g.out.clear(); g.down(2f, 50f, 50f); g.tick(2.3f); assertTrue(g.out.isEmpty()); g.tick(2.55f); assertTrue(g.out.last() is DeskGestures.G.LongPress); g.up(2.7f, 50f, 50f); assertEquals(1, g.out.size, "no tap after a long press")
        g.out.clear(); g.down(5f, 100f, 100f); var t = 5f; for (i in 0 until 10) { t += 0.04f; g.move(t, 100f + if (i % 2 == 0) 16f else -16f, 100f) }; g.up(t, 100f, 100f)
        assertTrue(g.out.any { it is DeskGestures.G.Rub }); assertTrue(g.out.last() is DeskGestures.G.RubEnd)
        g.out.clear(); g.down(9f, 100f, 100f); t = 9f; for (i in 1..10) { t += 0.016f; g.move(t, 100f + i * 20f, 100f - i * 5f) }; g.up(t, 300f, 50f)
        assertTrue(g.out.first() is DeskGestures.G.DragStart); val r = g.out.last() as DeskGestures.G.Release; assertTrue(r.vx > 800f && r.vy < 0f, "flick speed ${r.vx}, ${r.vy}")
    }

    @Test fun theDesktopAndTheHomeShareOneSetOfNeeds() {
        val h = Houses.COTTAGE; val ts = listOf(Tenant("a", "甲", true), Tenant("b", "乙", true))
        val life = LifeSim.create(3, h, ts, Houses.autoRooms(h, ts), mapOf("a" to "a", "b" to "b"), mapOf("a" to CharSpec(name = "甲"), "b" to CharSpec(name = "乙")), "鎮", "家", 20000.0 * 1440 + 600, 0)
        life.arriving = false; val sim = LifeSim(life); val a = sim.person("a")!!
        assertTrue(sim.toDesk("a")); assertTrue(a.desk); assertEquals(null, a.act)
        val f0 = a.need(Need.FOOD); life.clockMode = "GAME"; life.speed = 60.0
        var t = 0f; while (t < 120f) { sim.update(0.1f); t += 0.1f; assertEquals(null, a.act, "no home activities while on the desktop"); assertTrue(life.people[1].with != "a") }
        assertTrue(a.need(Need.FOOD) < f0, "needs keep going down on the desktop")
        val att = a.need(Need.ATTENTION); sim.pet("a", 1.2f, "頭"); sim.petEnd("a"); assertTrue(a.need(Need.ATTENTION) > att, "petting on the desktop is the same person")
        a.setNeed(Need.FOOD, 30f); sim.feed("a", "cookie"); assertTrue(a.need(Need.FOOD) > 30f)
        a.setNeed(Need.ENERGY, 20f); sim.deskRest("a", true); t = 0f; while (t < 60f) { sim.update(0.1f); t += 0.1f }; assertTrue(a.need(Need.ENERGY) > 30f, "sleeping on the desktop rests")
        sim.deskLift("a"); sim.deskLand("a", true); assertTrue(a.moods.any { it.id == "thrown" || it.id == "thrownfun" })
        sim.fromDesk("a"); assertFalse(a.desk); assertEquals(h.entrance.x + 0.5f, a.x); assertTrue(life.log.any { it.text.contains("桌面") })
        // the catch-up leaves a desktop resident alone
        sim.toDesk("a"); sim.catchUp(life.minute + 600); assertEquals(null, a.act)
    }
}
