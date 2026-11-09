package app.ocshimeji.core.pet

import kotlin.test.Test
import kotlin.math.abs
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GesturesTest {
    private fun kinds(l: List<Gestures.Ev>) = l.map { it.kind }

    @Test fun tapAndDoubleTap() {
        val g = Gestures()
        g.down(100f, 100f, 0); assertEquals(listOf(Gestures.Kind.TAP), kinds(g.up(102f, 101f, 90)))
        g.down(100f, 100f, 200); assertEquals(listOf(Gestures.Kind.DOUBLE_TAP), kinds(g.up(100f, 100f, 260)))
        // a third tap starts a new pair
        g.down(100f, 100f, 400); assertEquals(listOf(Gestures.Kind.TAP), kinds(g.up(100f, 100f, 450)))
    }

    @Test fun longPressFiresOnceAndNoTap() {
        val g = Gestures()
        g.down(50f, 50f, 0)
        assertTrue(g.tick(300).isEmpty())
        assertEquals(listOf(Gestures.Kind.LONG_PRESS), kinds(g.tick(560)))
        assertTrue(g.tick(900).isEmpty())
        assertTrue(g.up(50f, 50f, 1000).isEmpty())
    }

    @Test fun strokeIsPettingNotDrag() {
        val g = Gestures(); var strokes = 0; var drag = false
        g.down(200f, 200f, 0)
        var x = 200f; var t = 0L
        for (i in 0 until 12) { val to = if (i % 2 == 0) 250f else 160f; while (x != to) { x += if (to > x) 5f else -5f; t += 8; g.move(x, 202f, t).forEach { if (it.kind == Gestures.Kind.STROKE) strokes++; if (it.kind == Gestures.Kind.DRAG_START) drag = true } } }
        assertTrue(strokes >= 4, "strokes=$strokes"); assertTrue(!drag)
        assertTrue(g.up(x, 202f, t + 10).isEmpty())
    }

    @Test fun dragAndFling() {
        val g = Gestures(); val all = ArrayList<Gestures.Ev>()
        g.down(100f, 500f, 0)
        for (i in 1..20) all += g.move(100f + i * 20f, 500f - i * 5f, i * 10L)
        assertTrue(Gestures.Kind.DRAG_START in kinds(all))
        val drop = g.up(500f, 400f, 210).single()
        assertEquals(Gestures.Kind.DROP, drop.kind); assertTrue(drop.vx > 1000f, "vx=${drop.vx}")
    }

    @Test fun cancelEndsDrag() {
        val g = Gestures(); g.down(0f, 0f, 0); g.move(200f, 0f, 50)
        assertEquals(listOf(Gestures.Kind.DROP), kinds(g.cancel()))
    }
}

class AnimClipTest {
    private fun seq(c: AnimClip, stepMs: Int, n: Int) = (0 until n).joinToString("") { c.at(it * stepMs / 1000f).i.toString() }

    @Test fun matchesGameFrameAt() {
        // the same sequences the game's OC.Anim.frameAt tests use (docs/animation-system.md)
        assertEquals("0123012", seq(AnimClip(IntArray(4) { 100 }), 100, 7))
        assertEquals("012321012", seq(AnimClip(IntArray(4) { 100 }, AnimClip.Loop.PINGPONG), 100, 9))
        assertEquals("0123333", seq(AnimClip(IntArray(4) { 100 }, AnimClip.Loop.ONCE), 100, 7))
        assertEquals("0001230", seq(AnimClip(intArrayOf(300, 100, 100, 100)), 100, 7))
    }

    @Test fun repeatAndDone() {
        val c = AnimClip(IntArray(3) { 100 }, repeat = 2)
        assertTrue(!c.at(0.5f).done); assertTrue(c.at(0.61f).done); assertEquals(2, c.at(0.61f).i)
        assertEquals(0.6f, c.seconds(), 0.001f)
    }

    @Test fun eventsCrossed() {
        val c = AnimClip(IntArray(4) { 100 }, events = listOf(AnimClip.Event(2, "bubble", "hi"), AnimClip.Event(0, "sound", "step")))
        assertEquals(listOf("bubble"), c.eventsBetween(1, 2).map { it.type })
        assertEquals(listOf("sound"), c.eventsBetween(3, 0).map { it.type })
        assertTrue(c.eventsBetween(2, 2).isEmpty())
    }
}

class PetTalkTest {
    @Test fun frequencyMuteAndCooldown() {
        val t = PetTalk().apply { pools = mapOf("idle" to listOf("a", "b"), "tap" to listOf("hi")); freq = PetTalk.Freq.NORMAL }
        assertNull(t.chatter("idle"))             // not before the gap
        t.update(200f); assertNotNull(t.chatter("idle"))
        assertNull(t.chatter("idle"))             // gap restarts
        assertEquals("hi", t.react("tap")); assertNull(t.react("tap")) // per-category cooldown
        t.update(10f); assertEquals("hi", t.react("tap"))
        t.muted = true; t.update(500f); assertNull(t.chatter("idle")); assertNull(t.react("tap"))
        t.muted = false; t.freq = PetTalk.Freq.OFF; t.update(500f); assertNull(t.chatter("idle")); assertNotNull(t.react("tap"))
    }

    @Test fun noImmediateRepeat() {
        val t = PetTalk(3).apply { pools = mapOf("tap" to listOf("a", "b")) }
        var last: String? = null
        repeat(20) { t.update(10f); val s = t.react("tap", 0f); assertTrue(s != last); last = s }
    }

    @Test fun moodCategory() {
        val t = PetTalk()
        assertEquals("sleepy", t.moodCategory(2, PetBrain.Mood()))
        assertEquals("hungry", t.moodCategory(14, PetBrain.Mood(hunger = 0.1f)))
        assertEquals("morning", t.moodCategory(7, PetBrain.Mood()))
    }

    @Test fun appContextRulesAndExclusions() {
        val a = AppContext().apply { rules = mapOf("com.example.game" to "game", "com.example.bank" to "none"); exclude = setOf("com.example.chat") }
        assertEquals("game", a.classify("com.example.game", null).category)
        assertNull(a.classify("com.example.bank", "work").category)
        assertTrue(a.classify("com.example.chat", "social").excluded)
        assertEquals("music", a.classify("com.x.player", AppContext.fromSystem(1)).category)
        a.useSystemCategory = false; assertNull(a.classify("com.x.player", "music").category)
    }
}

class PetSocialTest {
    @Test fun petsMeetAndDoNotStack() {
        val a = PetBrain(1).apply { reset(1080, 2000, 200, startX = 400f) }
        val b = PetBrain(2).apply { reset(1080, 2000, 200, startX = 480f) }
        val s = PetSocial().apply { affinity = mapOf("a>b" to 0.8f, "b>a" to 0.6f) }
        val members = listOf(PetSocial.Member("a", a), PetSocial.Member("b", b))
        var met: PetSocial.Meeting? = null
        repeat(60 * 60) { a.update(1f / 60f); b.update(1f / 60f); s.step(members, 1f / 60f).firstOrNull()?.let { if (met == null) met = it } }
        assertNotNull(met); assertEquals("hug", met!!.kind)
    }
}

/** 12.0: paired actions between two desktop pets */
class PetPairedActionsTest {
    private fun pair(sepX: Float = 80f): Triple<PetBrain, PetBrain, PetSocial> {
        val a = PetBrain(1).apply { reset(1080, 2000, 200, startX = 400f) }
        val b = PetBrain(2).apply { reset(1080, 2000, 200, startX = 400f + sepX) }
        return Triple(a, b, PetSocial())
    }
    private fun members(a: PetBrain, b: PetBrain) = listOf(PetSocial.Member("a", a), PetSocial.Member("b", b))
    private fun runFor(a: PetBrain, b: PetBrain, s: PetSocial, sec: Float, check: () -> Unit = {}) {
        val m = members(a, b); var t = 0f
        while (t < sec) { a.update(1f / 60f); b.update(1f / 60f); s.step(m, 1f / 60f); check(); t += 1f / 60f }
    }

    @Test fun everyKindUsesKnownAnimations() {
        assertTrue(PetBrain.ANIMS.containsAll(PetSocial.ANIMS), "unknown: ${PetSocial.ANIMS - PetBrain.ANIMS.toSet()}")
        assertTrue(PetSocial.KINDS.keys.containsAll(listOf("greet", "chat", "hug", "highfive", "sidebyside", "share", "comfort", "chase", "huff", "argue", "apologize")))
    }

    @Test fun eachKindPlaysBothSidesAndEnds() {
        for ((id, kind) in PetSocial.KINDS) {
            val (a, b, s) = pair(); val m = members(a, b)
            val met = s.start(id, m[0], m[1]); assertNotNull(met, id); assertEquals(id, met!!.kind)
            // the first beat plays at once, with complementary animations
            val first = kind.beats.first(); a.update(0.001f); b.update(0.001f)
            if (first.a != null) assertEquals(first.a, a.anim, "$id initiator"); if (first.b != null) assertEquals(first.b, b.anim, "$id other")
            assertTrue(s.isBusy("a") && s.isBusy("b"))
            val total = kind.beats.maxOf { it.at + it.dur }
            runFor(a, b, s, total + 3f) { assertTrue(a.anim in PetBrain.ANIMS && b.anim in PetBrain.ANIMS, "$id: ${a.anim}/${b.anim}") }
            assertFalse(s.isBusy("a") || s.isBusy("b"), "$id still busy")
            assertTrue(a.state != PetBrain.State.REACT && b.state != PetBrain.State.REACT, "$id left a pet stuck in REACT")
            assertTrue(a.x in a.minX..a.maxX && b.x in b.minX..b.maxX, "$id left the screen")
        }
    }

    @Test fun theOneWhoIsNotDownComforts() {
        val (a, b, s) = pair(); a.mood = PetBrain.Mood(emotion = "sad"); b.mood = PetBrain.Mood(emotion = "happy")
        s.affinity = mapOf("a>b" to 0.4f, "b>a" to 0.4f)
        val m = members(a, b)
        assertEquals("comfort", s.choose(m[0], m[1]))
        val met = s.start("comfort", m[0], m[1])!!
        assertEquals("b", met.a, "the pet that is fine comforts"); assertEquals("a", met.b)
        a.update(0.001f); b.update(0.001f); assertEquals("comfort", b.anim); assertEquals("comforted", a.anim)
    }

    @Test fun aQuarrelIsFollowedByAnApology() {
        val (a, b, s) = pair(); s.affinity = mapOf("a>b" to -0.6f, "b>a" to -0.5f); s.pairCooldown = 5f
        val m = members(a, b); val seen = ArrayList<String>()
        // they dislike each other: they argue (or sulk)
        var t = 0f; while (t < 120f && seen.isEmpty()) { a.update(1f / 60f); b.update(1f / 60f); s.step(m, 1f / 60f).forEach { seen += it.kind }; t += 1f / 60f }
        assertTrue(seen.firstOrNull() in listOf("argue", "huff"), "first: $seen")
        // time passes and they stop hating each other: the next meeting is a first step towards making up
        runFor(a, b, s, 8f); s.affinity = mapOf("a>b" to 0.1f, "b>a" to 0.2f)
        var next: String? = null; t = 0f
        while (t < 300f && next == null) {
            a.update(1f / 20f); b.update(1f / 20f); s.step(m, 1f / 20f).firstOrNull()?.let { next = it.kind }; t += 1f / 20f
            if (next == null && !s.isBusy("a") && abs(a.x - b.x) > 100f) b.goTo(a.x + 70f)   // they wander back towards each other
        }
        assertEquals("apologize", next)
        a.update(0.001f); b.update(0.001f); assertTrue("apologize" in listOf(a.anim, b.anim) && "accept" in listOf(a.anim, b.anim), "${a.anim}/${b.anim}")
    }

    @Test fun chaseMovesBothAndTheyEndUp() {
        val (a, b, s) = pair(); val m = members(a, b); val ax = a.x; val bx = b.x
        s.start("chase", m[0], m[1]); runFor(a, b, s, 2f)
        assertTrue(abs(a.x - ax) > 40f && abs(b.x - bx) > 40f, "both moved: ${a.x - ax}, ${b.x - bx}")
        runFor(a, b, s, 8f); assertFalse(s.isBusy("a"))
    }

    @Test fun pickingAPetUpCancelsThePairedAction() {
        val (a, b, s) = pair(); val m = members(a, b)
        s.start("hug", m[0], m[1]); assertTrue(s.isBusy("a"))
        a.drag(200f, 300f); s.step(m, 1f / 60f)
        assertFalse(s.isBusy("a") || s.isBusy("b"))
        a.release(); runFor(a, b, s, 6f)   // lands; nothing throws, nobody is stuck
        assertTrue(b.state != PetBrain.State.REACT)
    }

    @Test fun nothingStartsWhileBusyOrInTheAir() {
        val (a, b, s) = pair(); val m = members(a, b)
        assertNotNull(s.start("hug", m[0], m[1])); assertNull(s.start("highfive", m[0], m[1]), "already busy")
        val (c, d, s2) = pair(); c.jump(); assertNull(s2.start("hug", members(c, d)[0], members(c, d)[1]), "in the air")
        assertNull(s2.start("not-a-kind", members(d, d)[0], members(d, d)[1]))
    }

    @Test fun manyMeetingsOnlyEverUseKnownKinds() {
        val (a, b, s) = pair(); s.pairCooldown = 3f; s.affinity = mapOf("a>b" to 0.35f, "b>a" to 0.3f)
        a.mood = PetBrain.Mood(energy = 0.9f); b.mood = PetBrain.Mood(energy = 0.9f, hunger = 0.3f)
        val m = members(a, b); val kinds = HashSet<String>(); var t = 0f
        while (t < 1500f) { a.update(1f / 20f); b.update(1f / 20f); s.step(m, 1f / 20f).forEach { kinds += it.kind }; t += 1f / 20f; if (abs(a.x - b.x) > 160f && !s.isBusy("a")) { b.goTo(a.x + 60f) } }
        assertTrue(kinds.isNotEmpty() && kinds.all { it in PetSocial.KINDS }, "$kinds"); assertTrue(kinds.size >= 2, "variety: $kinds")
    }
}

/** 12.0: when a desktop pet makes a sound */
class PetSoundTest {
    private fun sound(on: Boolean = true) = PetSound(1).apply { this.on = on; volume = 0.8f }
    private fun PetSound.wait(s: Float) = update(s)

    @Test fun offByDefaultAndWhenQuiet() {
        assertNull(PetSound().cue(PetSound.Ev.TAP))
        val s = sound(); s.quiet = true; assertNull(s.cue(PetSound.Ev.TAP)); s.quiet = false; assertNotNull(s.cue(PetSound.Ev.TAP))
        val z = sound(); z.volume = 0f; assertNull(z.cue(PetSound.Ev.TAP))
    }

    @Test fun gapsAndCooldowns() {
        val s = sound(); assertNotNull(s.cue(PetSound.Ev.TAP))
        s.wait(0.1f); assertNull(s.cue(PetSound.Ev.JUMP), "global gap")
        s.wait(0.15f); assertNull(s.cue(PetSound.Ev.TAP), "tap cool-down (0.35 s)")
        s.wait(0.2f); assertNotNull(s.cue(PetSound.Ev.TAP))
        s.wait(0.9f); assertNotNull(s.cue(PetSound.Ev.JUMP)); s.wait(0.5f); assertNull(s.cue(PetSound.Ev.JUMP), "jump cool-down (0.8 s)")
    }

    @Test fun aSleepingPetOnlyWakesOrPurrs() {
        val s = sound()
        assertNull(s.cue(PetSound.Ev.TAP, asleep = true)); s.wait(1f); assertNull(s.cue(PetSound.Ev.TALK, asleep = true)); s.wait(1f)
        assertNotNull(s.cue(PetSound.Ev.WAKE, asleep = true)); s.wait(3f); assertNotNull(s.cue(PetSound.Ev.PET, asleep = true))
    }

    @Test fun neverTheSameVariantTwiceInARow() {
        val s = sound(); var last: String? = null
        repeat(60) { s.wait(2f); val c = s.cue(PetSound.Ev.TALK)!!; assertTrue(c.clip != last, "repeat ${c.clip}"); last = c.clip }
    }

    @Test fun moodShapesPitchAndLoudnessButNeverAboveTheVolume() {
        val happy = sound().cue(PetSound.Ev.TAP, "happy")!!; val sad = sound().cue(PetSound.Ev.TAP, "sad")!!
        assertTrue(happy.rate > sad.rate, "${happy.rate} vs ${sad.rate}"); assertTrue(happy.volume > sad.volume)
        repeat(50) { val s = sound(); s.volume = 0.7f; val c = s.cue(PetSound.Ev.GIFT, "excited")!!; assertTrue(c.volume <= 0.7f + 1e-6f && c.rate in 0.5f..2f) }
    }

    @Test fun onlyClipsThatExistAreUsed() {
        val s = sound(); s.available = setOf("tap_b"); repeat(10) { s.wait(1f); assertEquals("tap_b", s.cue(PetSound.Ev.TAP)!!.clip) }
        s.available = emptySet(); s.wait(1f); assertNull(s.cue(PetSound.Ev.TAP))
        assertTrue(PetSound.Ev.values().flatMap { it.clips }.all { it in PetSound.CLIPS }, "every event clip is in CLIPS")
        assertEquals(PetSound.CLIPS.size, PetSound.CLIPS.toSet().size)
    }

    @Test fun meetingsSoundWarmOrLow() {
        val s = sound()
        assertEquals("meet_good", s.meeting("hug")!!.clip); s.wait(7f); assertEquals("meet_bad", s.meeting("argue")!!.clip); s.wait(7f)
        assertEquals("meet_good", s.meeting("apologize")!!.clip); assertNull(s.meeting("nonsense"))
    }
}
