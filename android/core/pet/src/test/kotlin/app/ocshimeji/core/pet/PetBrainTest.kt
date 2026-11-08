package app.ocshimeji.core.pet

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PetBrainTest {
    private fun brain(seed: Int = 3) = PetBrain(seed).apply { reset(1080, 2340, 300, topInset = 80, bottomInset = 120) }

    @Test fun staysOnScreenWhileWandering() {
        for (seed in 1..6) {
            val b = brain(seed).apply { traits = PetBrain.Traits(energy = 0.9f, curious = 0.9f, shy = 0.6f); allow = PetBrain.Allow(level = 2) }
            repeat(60 * 900) {
                b.update(1f / 60f)
                // PEEK may hide up to 45 % of the body at a side edge; never more, never off the top/bottom
                assertTrue(b.x >= -300 * 0.46f && b.x <= 780 + 300 * 0.46f, "x out of bounds: ${b.x} (${b.state})")
                assertTrue(b.y >= 80f - 0.01f && b.y <= b.floorY + 0.01f, "y out of bounds: ${b.y} (${b.state})")
            }
        }
    }

    @Test fun usesEveryShimejiSurface() {
        val seen = HashSet<PetBrain.State>(); val surfaces = HashSet<PetBrain.Surface>()
        for (seed in 1..8) {
            val b = brain(seed).apply { traits = PetBrain.Traits(energy = 0.9f, curious = 1f, shy = 0.8f); allow = PetBrain.Allow(level = 2) }
            repeat(60 * 1200) { b.update(1f / 60f); seen += b.state; surfaces += b.surface }
        }
        for (s in listOf(PetBrain.State.WALK, PetBrain.State.RUN, PetBrain.State.SIT, PetBrain.State.JUMP, PetBrain.State.CLIMB, PetBrain.State.HANG, PetBrain.State.FALL, PetBrain.State.PEEK))
            assertTrue(s in seen, "never reached $s (saw $seen)")
        assertTrue(PetBrain.Surface.LEFT in surfaces || PetBrain.Surface.RIGHT in surfaces)
        assertTrue(PetBrain.Surface.CEIL in surfaces)
    }

    @Test fun disabledBehavioursNeverHappen() {
        val b = brain().apply { traits = PetBrain.Traits(energy = 1f, curious = 1f, shy = 1f); allow = PetBrain.Allow(level = 2, climb = false, ceiling = false, peek = false, run = false, jump = false) }
        repeat(60 * 1500) {
            b.update(1f / 60f)
            assertFalse(b.state in setOf(PetBrain.State.CLIMB, PetBrain.State.HANG, PetBrain.State.PEEK, PetBrain.State.RUN, PetBrain.State.JUMP), "disabled ${b.state}")
            assertEquals(PetBrain.Surface.FLOOR, b.surface)
        }
    }

    @Test fun calmPetDoesNotRunOrClimb() {
        val b = brain().apply { allow = PetBrain.Allow(level = 0) }
        repeat(60 * 900) { b.update(1f / 60f); assertFalse(b.state == PetBrain.State.RUN || b.state == PetBrain.State.CLIMB || b.state == PetBrain.State.JUMP) }
    }

    @Test fun tiredAtNightSleepsMore() {
        fun sleepShare(hour: Int, energy: Float): Float {
            var n = 0; val b = brain(9).apply { this.hour = hour; mood = PetBrain.Mood(energy = energy) }
            repeat(60 * 1800) { b.update(1f / 60f); if (b.state == PetBrain.State.SLEEP) n++ }
            return n / (60f * 1800f)
        }
        assertTrue(sleepShare(1, 0.15f) > sleepShare(14, 0.95f) + 0.15f)
    }

    @Test fun dragThenReleaseFallsAndLands() {
        val b = brain()
        b.drag(400f, 900f); b.drag(460f, 700f)
        assertEquals(PetBrain.State.DRAG, b.state); b.update(0.016f); assertEquals("drag", b.anim)
        b.release()
        var landed = false
        repeat(300) { b.update(1f / 60f); if (b.state == PetBrain.State.LAND) landed = true }
        assertTrue(landed, "pet should land after release")
        assertEquals(b.floorY, b.y, 0.01f)
    }

    @Test fun throwBouncesOrGrabsWall() {
        val b = brain()
        b.drag(500f, 900f); b.release(6000f, -500f)
        assertEquals(PetBrain.State.THROWN, b.state)
        var wall = false
        repeat(600) { b.update(1f / 60f); if (b.surface == PetBrain.Surface.RIGHT) wall = true; assertTrue(b.x <= b.maxX + 0.01f) }
        assertTrue(wall || b.state == PetBrain.State.LAND || b.onFloor, "thrown pet should grab the wall or land (${b.state})")
    }

    @Test fun dragDirectionSetsFacingAndSwing() {
        val b = brain()
        b.drag(300f, 800f); b.drag(380f, 800f); b.update(0.016f)
        assertEquals(1f, b.facing); assertTrue(b.swing < 0f, "moving right swings the body left")
    }

    @Test fun reactionsPlayThenReturn() {
        val b = brain(); b.update(0.016f)
        b.poke(); b.update(0.016f); assertEquals("happy", b.anim)
        b.react("eat", 1.5f); b.update(0.016f); assertEquals("eat", b.anim)
        repeat(120) { b.update(1f / 60f) }
        assertTrue(b.state != PetBrain.State.REACT)
    }

    @Test fun goToWalksThere() {
        val b = brain(); repeat(10) { b.update(0.016f) }
        while (!b.onFloor || b.state == PetBrain.State.REACT || b.state == PetBrain.State.LAND) b.update(0.016f)
        b.goTo(100f)
        repeat(60 * 20) { b.update(1f / 60f) }
        assertTrue(b.x < 500f)
    }

    @Test fun deterministicForSeed() {
        val a = brain(); val c = brain()
        repeat(5000) { a.update(0.016f); c.update(0.016f) }
        assertEquals(a.x, c.x); assertEquals(a.state, c.state)
    }

    @Test fun resizeKeepsPetVisible() {
        val b = brain(); repeat(100) { b.update(0.016f) }
        b.resize(2340, 1080, 0, 0)    // rotated to landscape
        assertTrue(b.x <= 2340 - 300 && b.y <= 1080 - 300)
        repeat(200) { b.update(1f / 60f) }
        assertTrue(b.y <= b.floorY + 0.01f)
    }

    @Test fun fidgetsFollowMoodAndCharacter() {
        fun seen(mood: PetBrain.Mood, tr: PetBrain.Traits): Set<String> {
            val out = HashSet<String>()
            for (seed in 1..6) { val b = brain(seed).apply { this.mood = mood; traits = tr; allow = PetBrain.Allow(level = 1) }; repeat(60 * 1200) { b.update(1f / 60f); if (b.state == PetBrain.State.REACT) out.add(b.anim) } }
            return out
        }
        val happy = seen(PetBrain.Mood(emotion = "happy"), PetBrain.Traits(energy = 0.9f, social = 0.9f))
        val sad = seen(PetBrain.Mood(emotion = "sad"), PetBrain.Traits(social = 0.9f))
        val shy = seen(PetBrain.Mood(emotion = "neutral"), PetBrain.Traits(shy = 0.9f, social = 0.9f))
        assertTrue(happy.intersect(setOf("giggle", "wiggle", "spin", "clap", "wave", "cheer")).size >= 3, "happy fidgets: $happy")
        assertTrue(sad.containsAll(setOf("sad", "sigh")) && "cheer" !in sad && "giggle" !in sad, "sad fidgets: $sad")
        assertTrue("bow" in shy || "shy" in shy, "shy fidgets: $shy")
        assertTrue(PetBrain.ANIMS.containsAll(listOf("wave", "clap", "giggle", "sigh", "sneeze", "hiccup", "aha", "bow", "spin", "wiggle")))
    }

    @Test fun everyAnimIsKnown() {
        for (seed in 1..4) {
            val b = brain(seed).apply { allow = PetBrain.Allow(level = 2) }
            repeat(60 * 600) { b.update(1f / 60f); assertTrue(b.anim in PetBrain.ANIMS, "unknown anim ${b.anim}") }
        }
    }
}
