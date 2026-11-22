package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.desk.DeskActs
import app.ocshimeji.sim.desk.DeskContext
import app.ocshimeji.sim.desk.DeskIntents
import app.ocshimeji.sim.desk.DeskOther
import app.ocshimeji.sim.desk.DeskPersona
import app.ocshimeji.sim.desk.DeskThing
import app.ocshimeji.sim.desk.Lv
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
        sleepy.tap(); assertEquals(DeskState.STRETCH, sleepy.state, "a tap wakes it (stretching first: lying down → up goes through the table)")
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

    // ================= R6: three layers, things on the desktop, together, company, personality =================
    @Test fun theActionTableAlwaysLeadsBackToIdling() {
        for (st in DeskState.values()) assertTrue(DeskActs.reachesIdle(st), "$st has a way back to idling")
        assertTrue(DeskActs.can(DeskState.IDLE, DeskState.CROUCH) && !DeskActs.can(DeskState.IDLE, DeskState.SIT), "sitting starts by crouching")
        assertEquals(setOf(DeskState.FALL), DeskActs[DeskState.HANG].next, "from hanging only by letting go")
        for (i in DeskIntents.ALL.values) assertTrue(i.level in Lv.IDLE..Lv.REFLEX)
        // a pet that wants to sit really crouches first
        val p = pet(3); var crouched = false; run(p, 300f) { if (it.state == DeskState.CROUCH) crouched = true }; assertTrue(crouched); assertEquals(0, p.illegal, "${p.illegalSeen}")
    }
    @Test fun higherLevelsCutInLowerOnesWait() {
        // care (4) cuts into idling: a hungry pet with a snack on the desktop goes and eats it
        val p = pet(4); run(p, 3f); val snack = DeskThing("dp1", "food", 60f)
        var ate = false; run(p, 20f, DeskContext(food = 20f, props = listOf(snack))) { if (it.events.any { e -> e.kind == "eat" && e.text == "dp1" }) ate = true; it.events.clear() }
        assertTrue(ate, "went to the snack and ate it"); assertEquals(0, p.illegal, "${p.illegalSeen}")
        // on the wall: care makes it let go first (the table), then it eats
        val q = pet(6); var onWall = false; var t = 0f
        while (t < 600f && !onWall) { q.step(1 / 30f, s, DeskContext(active = 1f)); onWall = q.side != Side.FLOOR; t += 1 / 30f }
        assertTrue(onWall, "climbed"); var fell = false; ate = false
        run(q, 25f, DeskContext(food = 10f, props = listOf(snack))) { if (it.state == DeskState.FALL) fell = true; if (it.events.any { e -> e.kind == "eat" }) ate = true; it.events.clear() }
        assertTrue(fell && ate, "let go, then ate"); assertEquals(0, q.illegal, "${q.illegalSeen}")
        // asleep: a friend's invitation (2) and the finger (3) do not wake it
        val z = pet(7); run(z, 40f, DeskContext(energy = 10f)); assertEquals(DeskState.SLEEP, z.state)
        assertFalse(z.invited("greet", "other", 50f, s)); assertEquals(DeskState.SLEEP, z.state)
        z.follow(300f); assertEquals(DeskState.SLEEP, z.state, "following the finger (3) does not wake it either")
        run(z, 3f, DeskContext(energy = 10f, reminderDue = true)); assertEquals("sleep", z.intent, "sleep is care (4): a reminder, also care, waits")
        run(z, 1.5f, DeskContext(energy = 10f, fullscreen = true)); assertTrue(z.hidden, "a reflex (5) cuts into anything")
    }
    @Test fun itComesAfterYourFinger() {
        val p = pet(8); run(p, 3f); p.x = 60f; run(p, 0.1f)
        p.follow(300f); assertEquals("follow", p.intent); run(p, 4f) { it.follow(300f) }; assertEquals(300f, p.x, 12f)
        p.followEnd(); run(p, 2f); assertTrue(p.state == DeskState.HAPPY || p.intent != "follow")
    }
    @Test fun thingsOnTheDesktopAndTheNest() {
        val things = listOf(DeskThing("n", "nest", 40f), DeskThing("pl", "plant", 300f), DeskThing("no", "note", 200f))
        val p = pet(9); val seen = HashSet<String>(); var sleptAt = -1f
        run(p, 1200f, DeskContext(props = things)) { for (e in it.events) seen += e.kind; if (it.state == DeskState.SLEEP && sleptAt < 0) sleptAt = it.x; it.events.clear() }
        assertTrue("water" in seen, "watered the plant"); assertTrue("read" in seen, "read the note")
        val q = pet(10); run(q, 3f); run(q, 30f, DeskContext(energy = 10f, props = things)) { if (it.state == DeskState.SLEEP && sleptAt < 0) sleptAt = it.x }
        assertEquals(40f, sleptAt, 25f, "sleepy: goes back to the nest to sleep")
    }
    @Test fun theirOwnLittleEventsHappenOnTheDesktopToo() {
        val p = pet(13); var n = 0; run(p, 1200f, DeskContext(habits = 2)) { n += it.events.count { e -> e.kind == "habit" && e.value in 0f..1f }; it.events.clear() }; assertTrue(n >= 3, "habits: $n")
        val q = pet(13); var m = 0; run(q, 1200f) { m += it.events.count { e -> e.kind == "habit" }; it.events.clear() }; assertEquals(0, m, "none without custom events")
    }
    @Test fun keepingYouCompany() {
        val p = pet(11); run(p, 3f); p.events.clear()
        run(p, 20f, DeskContext(focus = "work")); assertEquals(DeskState.READ, p.state); assertTrue(p.x < 120f || p.x > 240f, "reads off to one side"); assertTrue(p.events.any { it.text == "focusStart" })
        run(p, 600f, DeskContext(focus = "work")); assertEquals(DeskState.READ, p.state, "keeps you company for the whole session")
        p.events.clear(); run(p, 3f, DeskContext(focus = "break")); assertTrue(p.events.any { it.text == "breakTime" }); assertTrue(p.intent == "break" || p.state == DeskState.STRETCH || p.intent != "focus")
    }
    /** the host's job, done here: tell each pet where the others are, pass invitations on */
    private class Host(val pets: List<DeskPet>, val like: Int = 80) {
        val together = HashMap<String, Int>()
        fun ctx(p: DeskPet, base: DeskContext) = base.copy(others = pets.filter { it !== p }.map { DeskOther(it.id, it.x, it.side == Side.FLOOR, it.state, like) })
        fun step(s: DeskScreen, dt: Float, base: DeskContext) {
            for (p in pets) {
                p.step(dt, s, ctx(p, base))
                for (e in p.events.toList()) when (e.kind) {
                    "invite" -> { val (k, who) = e.text.split("|"); val o = pets.first { it.id == who }; if (!o.invited(k, p.id, p.x, s)) p.declined() }
                    "together" -> { val k = e.text.substringBefore("|"); together[k] = (together[k] ?: 0) + 1 }
                }
                p.events.clear()
            }
        }
    }
    @Test fun petsDoThingsTogether() {
        val pets = (1..3).map { DeskPet("p$it", 110f, 0.8f, 100L + it).also { p -> p.place(s, 60f + it * 80f) } }
        val h = Host(pets); var t = 0f; while (t < 3600f) { h.step(s, 1 / 15f, DeskContext(hour = if (t > 2400f) 23.5 else 15.0, energy = if (t > 2400f) 40f else 70f)); t += 1 / 15f }
        assertTrue(h.together.keys.containsAll(listOf("greet", "sitTogether")), "${h.together}"); assertTrue((h.together["chase"] ?: 0) + (h.together["leanSleep"] ?: 0) > 0, "${h.together}")
        assertTrue(pets.all { it.illegal == 0 && it.rescues == 0 })
        // sitting or sleeping together, they lean toward each other
        var leaned = false; t = 0f; while (t < 3600f && !leaned) { h.step(s, 1 / 15f, DeskContext(hour = 23.5, energy = 40f)); if (pets.any { it.lean != 0 }) leaned = true; t += 1 / 15f }
        assertTrue(leaned, "leaning together")
        val strangers = (1..2).map { DeskPet("s$it", 110f, 0.8f, 200L + it).also { p -> p.place(s, 100f + it * 100f) } }
        val h2 = Host(strangers, like = 10); t = 0f; while (t < 1800f) { h2.step(s, 1 / 15f, DeskContext()); t += 1 / 15f }
        assertEquals(setOf("greet"), h2.together.keys.ifEmpty { setOf("greet") }, "strangers only say hello")
    }
    /** plan B-1: different characters behave measurably differently */
    @Test fun personalityShowsOnTheDesktop() {
        fun persona(vararg traits: String) = DeskPersona.of(CharSpec(name = "x", traits = traits.toList()))
        fun share(p: DeskPersona, intent: String, seed: Long): Float { val d = DeskPet("p", 110f, 0.8f, seed).also { it.persona = p; it.place(s, 180f) }
            var t = 0f; val c = DeskContext(props = listOf(DeskThing("n", "nest", 40f))); while (t < 6 * 3600f) { d.step(0.1f, s, c); d.events.clear(); t += 0.1f }
            return (d.intentTime[intent] ?: 0f) / t }
        val plain = DeskPersona(); val cling = persona("黏人"); val lone = persona("獨立"); val busy = persona("勤快", "好奇"); val shy = persona("害羞")
        assertTrue(cling.cling > 1.5f && lone.nest > 1.5f && busy.climb > 1.5f && shy.hide > 1.5f, "from Catalog effects")
        val near = (1..3).map { share(cling, "nearYou", it.toLong()) }.average(); val near0 = (1..3).map { share(plain, "nearYou", it.toLong()) }.average()
        assertTrue(near > near0 * 1.8, "黏人 stays near you longer: $near vs $near0")
        val nest = (1..3).map { share(lone, "nest", it.toLong()) }.average(); val nest0 = (1..3).map { share(plain, "nest", it.toLong()) }.average()
        assertTrue(nest > nest0 * 1.5, "獨立 goes back to its nest: $nest vs $nest0")
        val climb = (1..3).map { share(busy, "climb", it.toLong()) }.average(); val climb0 = (1..3).map { share(plain, "climb", it.toLong()) }.average()
        assertTrue(climb > climb0 * 1.5, "勤快好奇 climbs more: $climb vs $climb0")
        fun hideAfter(p: DeskPersona): Float { val d = pet(12).also { it.persona = p }; run(d, 3f); var t = 0f; while (!d.hidden && t < 5f) { d.step(1 / 30f, s, DeskContext(fullscreen = true)); t += 1 / 30f }; return t }
        assertTrue(hideAfter(shy) < hideAfter(plain) * 0.7f, "害羞 hides sooner when an app goes full screen")
    }
    /** plan B-1 acceptance: 100 hours of everything at once and nothing gets stuck */
    @Test fun aHundredHoursWithoutGettingStuck() {
        val pets = (1..3).map { DeskPet("h$it", 100f + it * 10, 0.8f, 900L + it).also { p -> p.place(s, 90f * it); p.persona = listOf(DeskPersona(), DeskPersona(cling = 1.8f, nest = 0.6f), DeskPersona(climb = 1.6f, hide = 1.8f, active = 0.8f))[it - 1] } }
        val h = Host(pets, 75); val r = Rng(42); var t = 0f; val dt = 0.1f
        val longest = HashMap<DeskState, Float>()
        var props = mutableListOf(DeskThing("n", "nest", 30f), DeskThing("pl", "plant", 320f))
        var held: DeskPet? = null
        while (t < 100 * 3600f) {
            val hour = (t / 3600f + 8f) % 24f
            if (r.chance(0.0004)) props = (props.filter { it.kind != "food" } + DeskThing("f${t.toInt()}", "food", 40f + r.nextFloat() * 280f)).toMutableList()
            val c = DeskContext(hour = hour.toDouble(), food = 50f + 45f * kotlin.math.sin(t / 5000f), energy = 50f + 45f * kotlin.math.cos(t / 7000f), attention = 60f,
                battery = ((t / 600f) % 100).toInt(), charging = (t / 9000f).toInt() % 3 == 0, fullscreen = (t / 1300f).toInt() % 11 == 0,
                reminderDue = (t / 3600f).toInt() % 2 == 0 && (t % 3600f) < 60f, focus = when ((t / 1800f).toInt() % 6) { 1 -> "work"; 2 -> "break"; else -> null }, props = props)
            // fingers: pick one up now and then, throw it, rub, tap, follow
            if (held == null && r.chance(0.0003)) { held = pets[r.nextInt(3)]; held.grab(held.x, held.y - 30) }
            else if (held != null && r.chance(0.01)) { held.drag(r.nextFloat() * s.w, 200f + r.nextFloat() * 400f, s); if (r.chance(0.3)) { held.release(r.nextFloat() * 4000f - 2000f, -r.nextFloat() * 2000f); held = null } }
            if (r.chance(0.0005)) pets[r.nextInt(3)].tap()
            if (r.chance(0.0002)) pets[r.nextInt(3)].let { p -> p.follow(r.nextFloat() * s.w) }
            if (r.chance(0.002)) pets.forEach { it.followEnd() }
            h.step(s, dt, c)
            for (p in pets) {
                for (e in p.events) if (e.kind == "eat") props.removeAll { it.id == e.text }
                inside(p)
                if (p.state != DeskState.HELD && p.state != DeskState.HIDDEN) longest[p.state] = maxOf(longest[p.state] ?: 0f, p.t)   /* this action's own time */
            }
            t += dt
        }
        held?.release(0f, 0f)
        for (p in pets) { assertEquals(0, p.illegal, "${p.id}: every change followed the table ${p.illegalSeen}"); assertEquals(0, p.rescues, "${p.id}: the watchdog never had to step in") }
        for ((st, sec) in longest) assertTrue(sec <= DeskActs[st].maxT + 2f, "$st lasted $sec s (max ${DeskActs[st].maxT})")
        val did = pets.flatMap { it.actCount.keys }.toSet(); assertTrue(did.containsAll(listOf(DeskState.EAT, DeskState.WATER, DeskState.READ, DeskState.SLEEP, DeskState.CLIMB, DeskState.HANG, DeskState.GREET, DeskState.FOLLOW, DeskState.PEEK, DeskState.DOZE)), "$did")
    }
}
