package app.ocshimeji.ui

import app.ocshimeji.render.Colors
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import app.ocshimeji.save.LibChar
import app.ocshimeji.sim.life.Pose
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * One picture, many poses (plan 3.2 「系統預設動畫」): until the animation studio (M5) gives a character its own frames, every pose is a
 * procedural motion of the single standing picture — bob, squash, lean, sway, lie down, sink into the bath. The same code draws any
 * imported character, so everyone can do everything from day one.
 */
object Actors {
    /**
     * Draw `c` with its feet at (x, y) (base dp), `h` dp tall. `facing` = where it should look (1 right, −1 left); the picture is
     * mirrored when that differs from the way it was drawn. `lift` raises the body (held, flying, sitting on something).
     * `where` = the furniture kind it is using (bed, sofa, tub…), which changes how lying and bathing look.
     */
    fun draw(g: Gfx, img: Img?, c: LibChar, x: Float, y: Float, h: Float, pose: Pose, time: Float, phase: Float, facing: Int, lift: Float, where: String?, asleep: Boolean) {
        if (img == null) return
        var flip = if (facing == c.facing) 1f else -1f
        val w = h * img.w / img.h
        val breath = 1f + (if (asleep) 0.03f else 0.018f) * sin((time + phase) * (if (asleep) 1.3f else 2.4f))
        var sx = 1f; var sy = 1f; var rot = 0f; var dy = 0f; var pivotTop = false; var clipBottom = 0f
        val tt = time + phase
        when (pose) {
            Pose.WALK -> { dy = -abs(sin(tt * 10f)) * 3.2f; rot = sin(tt * 10f) * 0.05f }
            Pose.SIT, Pose.WATCH -> { sy = 0.86f; sx = 1.04f; if (pose == Pose.WATCH) rot = sin(tt * 0.7f) * 0.02f }
            Pose.EAT -> { sy = 0.87f + 0.03f * sin(tt * 9f); sx = 1.04f; dy = -abs(sin(tt * 4.5f)) * 1.5f }
            Pose.READ -> { rot = 0.07f * flip; sy = 0.97f }
            Pose.HAPPY -> { dy = -abs(sin(tt * 6.5f)) * 7f; sy = 1f + 0.04f * sin(tt * 13f) }
            Pose.PETTED -> { val k = sin(tt * 12f); sx = 1f + 0.05f * k; sy = 1f - 0.05f * k }
            Pose.DIZZY -> { rot = sin(tt * 7f) * 0.14f }
            Pose.HELD -> { rot = sin(tt * 3.2f) * 0.16f; pivotTop = true; sy = 1.04f; sx = 0.97f }
            Pose.FLY -> { rot = sin(tt * 11f) * 0.45f }
            Pose.TIDY -> { rot = sin(tt * 6f) * 0.1f; dy = -abs(sin(tt * 6f)) * 1.5f }
            Pose.WATER -> rot = 0.12f * flip
            Pose.LOOK -> { if (sin(tt * 0.8f) < -0.3f) flip = -flip }
            Pose.PRIMP -> { if (sin(tt * 1.6f) < 0f) flip = -flip; dy = -abs(sin(tt * 3.2f)) * 1.5f }
            Pose.DAYDREAM -> { rot = sin(tt * 1.1f) * 0.05f }
            Pose.BATHE -> { clipBottom = h * 0.5f; dy = h * 0.28f }
            Pose.LIE, Pose.STAND -> {}
        }
        g.save(); g.translate(x, y - lift + dy)
        if (pose == Pose.LIE) {
            if (where == "bed" || where == "bed2") { g.translate(0f, h * 0.2f); g.scale(flip * 0.92f, 0.92f * breath) }   /* in bed: upright, the blanket covers the body */
            else { g.translate(0f, -h * 0.16f); g.rotate((-PI / 2).toFloat() * flip); g.scale(flip * 0.9f, 0.9f * breath); g.translate(0f, h * 0.45f) }   /* on a sofa or the floor: on its side */
            g.image(img, -w * c.footX, -h * c.footY, w, h); g.restore(); return
        }
        if (clipBottom > 0f) g.clip(-w, -h * 1.2f - dy, w * 2, h * 1.2f - clipBottom + dy * 0f)
        if (pivotTop) { g.translate(0f, -h * 0.9f); g.rotate(rot); g.translate(0f, h * 0.9f) } else g.rotate(rot)
        g.scale(flip * sx / sqrt(breath), sy * breath)
        g.image(img, -w * c.footX, -h * c.footY, w, h)
        g.restore()
    }

    /** small things around a character: Zz while asleep, stars when dizzy, bubbles in the bath, drops when watering, a book */
    fun extras(g: Gfx, t: Theme, pose: Pose, x: Float, y: Float, h: Float, time: Float, phase: Float, facing: Int, asleep: Boolean) {
        val tt = time + phase
        if (asleep) for (i in 0 until 3) { val k = ((tt * 0.45f + i / 3f) % 1f); val s = 7f + k * 6f
            g.save(); g.alpha(1f - k); val zx = x + h * 0.3f + k * 14f; val zy = y - h * 0.75f - k * 26f
            g.line(zx, zy, zx + s, zy, 1.8f, t.ink2); g.line(zx + s, zy, zx, zy + s, 1.8f, t.ink2); g.line(zx, zy + s, zx + s, zy + s, 1.8f, t.ink2); g.restore() }
        when (pose) {
            Pose.DIZZY -> for (i in 0 until 3) { val a = tt * 4f + i * 2.09f; drawStar(g, x + kotlin.math.cos(a) * h * 0.3f, y - h * 1.02f + sin(a) * 5f, 4f, 0xFFFFC857.toInt()) }
            Pose.BATHE -> for (i in 0 until 4) { val k = (tt * 0.6f + i * 0.25f) % 1f; g.save(); g.alpha(1f - k); g.fillCircle(x - h * 0.35f + i * h * 0.22f, y - h * 0.25f - k * 20f, 3f + i % 2 * 2f, 0xFFFFFFFF.toInt()); g.restore() }
            Pose.WATER -> for (i in 0 until 3) { val k = (tt * 1.5f + i / 3f) % 1f; g.fillCircle(x + facing * h * 0.45f + i * 2f, y - h * 0.35f + k * h * 0.3f, 2f, 0xFF7AAAD6.toInt()) }
            Pose.READ -> { val bx = x + facing * h * 0.18f; g.fillRound(bx - 8, y - h * 0.5f, 16f, 11f, 2f, 0xFFF0705A.toInt()); g.fillRect(bx - 0.6f, y - h * 0.5f, 1.2f, 11f, 0xFFFFFDF7.toInt()) }
            Pose.EAT -> { if (sin(tt * 4.5f) > 0.6f) g.fillCircle(x + facing * h * 0.16f, y - h * 0.5f, 2f, 0xFFD9A472.toInt()) }
            Pose.PETTED -> { g.fillCircle(x - h * 0.14f, y - h * 0.62f, 4f, Colors.withAlpha(0xFFF6A0A0.toInt(), 0.6f)); g.fillCircle(x + h * 0.14f, y - h * 0.62f, 4f, Colors.withAlpha(0xFFF6A0A0.toInt(), 0.6f)) }
            else -> {}
        }
    }
    private fun drawStar(g: Gfx, cx: Float, cy: Float, r: Float, c: Int) {
        g.save(); g.translate(cx, cy); for (i in 0 until 2) { g.rotate((PI / 4).toFloat()); g.fillRect(-r * 0.35f, -r, r * 0.7f, r * 2, c) }; g.restore()
    }
}
