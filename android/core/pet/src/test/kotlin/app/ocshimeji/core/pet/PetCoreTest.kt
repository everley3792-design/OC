package app.ocshimeji.core.pet

import kotlin.test.Test
import kotlin.test.assertEquals
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
