package app.ocshimeji.core.pet

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PetBrainTest {
    private fun brain() = PetBrain(3).apply { reset(1080, 2340, 300) }

    @Test fun staysOnScreenWhileWandering() {
        val b = brain()
        repeat(60 * 600) { b.update(1f / 60f); assertTrue(b.x in 0f..780f, "x out of bounds: ${b.x}") }
    }

    @Test fun dragThenReleaseFallsAndLands() {
        val b = brain()
        b.drag(400f, 900f); b.drag(460f, 700f)
        assertEquals(PetBrain.State.DRAG, b.state); assertEquals(PetBrain.Anim.DRAG, run { b.update(0.016f); b.anim })
        b.release()
        var landed = false
        repeat(300) { b.update(1f / 60f); if (b.state == PetBrain.State.LAND) landed = true }
        assertTrue(landed, "pet should land after release")
        assertEquals(b.floorY, b.y, 0.01f)
    }

    @Test fun dragDirectionSetsFacingAndSwing() {
        val b = brain()
        b.drag(300f, 800f); b.drag(380f, 800f); b.update(0.016f)
        assertEquals(1f, b.facing); assertTrue(b.swing < 0f, "moving right swings the body left")
    }

    @Test fun pokeReactsHappily() {
        val b = brain(); b.update(0.016f)
        b.poke(); b.update(0.016f)
        assertEquals(PetBrain.Anim.HAPPY, b.anim)
    }

    @Test fun deterministicForSeed() {
        val a = brain(); val c = brain()
        repeat(5000) { a.update(0.016f); c.update(0.016f) }
        assertEquals(a.x, c.x); assertEquals(a.state, c.state)
    }

    @Test fun resizeKeepsPetVisible() {
        val b = brain(); repeat(100) { b.update(0.016f) }
        b.resize(720, 1280)
        assertTrue(b.x <= 720 - 300)
    }
}
