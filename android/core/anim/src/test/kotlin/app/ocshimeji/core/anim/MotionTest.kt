package app.ocshimeji.core.anim

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MotionTest {
    @Test fun springSettlesToOneWithBoundedOvershoot() {
        assertEquals(0f, Motion.spring(0f))
        // default spring (2.2 Hz, damp 6) peaks at ~1.280; used only on small rig params (turn, rise)
        val peak = (1..400).maxOf { Motion.spring(it / 400f) }
        assertEquals(1.280f, peak, 0.005f)
        assertEquals(1f, Motion.spring(3f), 0.001f)
    }

    @Test fun uiPopOvershootStaysUnderSixPercent() {
        val peak = (1..400).maxOf { Ease.outBack(it / 400f) }
        assertTrue(peak in 1.0f..1.06f, "UI pop overshoot was $peak")
    }

    @Test fun wobbleDecays() {
        assertTrue(kotlin.math.abs(Motion.wobble(2f)) < 0.001f)
    }

    @Test fun breathStaysInRange() {
        for (i in 0..1000) assertTrue(Motion.breath(i / 37f) in -1.0001f..1.0001f)
    }

    @Test fun blinkIsDeterministicAndBrief() {
        val a = BlinkClock(3); val b = BlinkClock(3)
        var closedFrames = 0
        for (i in 0 until 30 * 60) { val t = i / 30f; assertEquals(a.closedness(t), b.closedness(t)); if (a.closedness(t) > 0.5f) closedFrames++ }
        // ~13-27 blinks a minute, each ~3 frames closed
        assertTrue(closedFrames in 15..120, "closed frames per minute = $closedFrames")
    }

    @Test fun clipHoldsAndLoops() {
        val clip = FrameClip("ear-wave", fps = 8, frames = listOf(ClipFrame(hold = 2), ClipFrame(), ClipFrame()))
        assertEquals(0, clip.frameAt(0f)); assertEquals(0, clip.frameAt(0.13f))
        assertEquals(1, clip.frameAt(0.26f)); assertEquals(2, clip.frameAt(0.38f))
        assertEquals(0, clip.frameAt(0.5f)) // looped
        assertEquals(0.5f, clip.durationSec)
    }
}
