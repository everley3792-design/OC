package app.ocshimeji.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** 2.0.0 (R8, plan O-02) 效能分級 */
class PerfTest {
    @Test fun thePhonesClassPicksTheTier() {
        assertEquals(Tier.LOW, Perf.choose(512, 8, true), "Android's low-RAM flag"); assertEquals(Tier.LOW, Perf.choose(128, 8, false)); assertEquals(Tier.LOW, Perf.choose(512, 4, false))
        assertEquals(Tier.MID, Perf.choose(256, 8, false)); assertEquals(Tier.MID, Perf.choose(512, 6, false)); assertEquals(Tier.HIGH, Perf.choose(512, 8, false))
        assertTrue(Tier.LOW.particles < Tier.MID.particles && Tier.MID.particles < Tier.HIGH.particles && Tier.LOW.fpsCap == 30 && Tier.LOW.cacheMb < Tier.HIGH.cacheMb)
    }
    @Test fun slowFramesStepDownFastFramesStepBackUp() {
        val p = Perf(); repeat(600) { p.sample(40f, 1 / 60f) }; assertEquals(Tier.HIGH, p.tier, "no phone class (tests): never adapts")
        p.setDevice(Tier.HIGH); repeat(30 * 4) { p.sample(40f, 1 / 30f) }; assertEquals(Tier.MID, p.tier, "about 3 s of slow frames → one down")
        repeat(60 * 8) { p.sample(40f, 1 / 30f) }; assertEquals(Tier.LOW, p.tier); repeat(60 * 8) { p.sample(40f, 1 / 30f) }; assertEquals(Tier.LOW, p.tier, "not below the lowest")
        repeat(60 * 25) { p.sample(5f, 1 / 60f) }; assertEquals(Tier.MID, p.tier, "20 s of fast frames → one up")
        repeat(60 * 25) { p.sample(5f, 1 / 60f) }; assertEquals(Tier.HIGH, p.tier); val mid = Perf().apply { setDevice(Tier.MID) }; repeat(60 * 60) { mid.sample(5f, 1 / 60f) }; assertEquals(Tier.MID, mid.tier, "never above the phone's class")
        p.force(Tier.LOW); repeat(60 * 60) { p.sample(5f, 1 / 60f) }; assertEquals(Tier.LOW, p.tier, "your choice stays"); p.force(null); assertEquals(Tier.HIGH, p.tier)
        assertEquals(Tier.MID, Perf.fromFlags { it == "perf:mid" }); assertEquals(null, Perf.fromFlags { false })
    }
}
