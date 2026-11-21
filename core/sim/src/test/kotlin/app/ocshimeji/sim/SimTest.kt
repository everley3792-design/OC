package app.ocshimeji.sim

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SimTest {
    @Test fun sameSeedSameNumbers() {
        val a = Rng(42); val b = Rng(42)
        repeat(1000) { assertEquals(a.nextLong(), b.nextLong()) }
    }
    @Test fun keyedStreamsAreIndependentAndStable() {
        val x = Rng.of(7, "weather").nextLong(); val y = Rng.of(7, "ai").nextLong()
        assertTrue(x != y); assertEquals(x, Rng.of(7, "weather").nextLong())
    }
    @Test fun rangesAndWeights() {
        val r = Rng(1); repeat(10000) { val d = r.nextDouble(); assertTrue(d >= 0 && d < 1); val i = r.nextInt(3); assertTrue(i in 0..2) }
        val counts = IntArray(3); repeat(30000) { counts[r.weighted(listOf(0, 1, 2)) { if (it == 0) 0.0 else it.toDouble() }!!]++ }
        assertEquals(0, counts[0]); assertTrue(counts[2] in 18000..22000)
    }
    @Test fun realClockNeverGoesBack() {
        val c = GameClock(GameClock.Mode.REAL, minute = 1000.0)
        assertEquals(0.0, c.advance(1.0, 900.0)); assertEquals(1000.0, c.minute)
        assertEquals(5.0, c.advance(1.0, 1005.0))
    }
    @Test fun gameClockSpeed() {
        val c = GameClock(GameClock.Mode.GAME, speed = 60.0); c.advance(60.0, 0.0)
        assertEquals(60.0, c.minute); assertEquals(1.0, c.hour, 1e-9); assertEquals(0L, c.day)
    }
}
