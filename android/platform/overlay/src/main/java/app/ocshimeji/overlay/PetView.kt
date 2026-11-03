package app.ocshimeji.overlay

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.view.View
import app.ocshimeji.core.anim.RigPose

/**
 * Lightweight software-canvas pet renderer for the overlay window (no GL context:
 * cheaper to keep alive over other apps). Draws pre-baked part bitmaps from the
 * selected art direction's part sheet (docs/asset-format.md) according to [RigPose].
 *
 * Phase 1 placeholder: draws a simple silhouette so the service can be smoke-tested
 * on device; the real part compositor lands with the chosen art direction in Phase 2.
 */
class PetView(context: Context) : View(context) {
    private var pose = RigPose()
    private var swing = 0f
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    var parts: Map<String, Bitmap> = emptyMap()

    fun render(p: RigPose, swingRad: Float) { pose = p; swing = swingRad; invalidate() }

    override fun onDraw(c: Canvas) {
        val s = width / 64f
        c.save()
        c.rotate(Math.toDegrees(swing.toDouble()).toFloat(), width / 2f, height * 0.2f)
        c.translate(width / 2f, height * 0.92f - pose.lift * s)
        c.scale(1f / kotlin.math.sqrt(pose.squash), pose.squash)
        paint.color = 0xFFFFF6EC.toInt()
        c.drawOval(-11 * s, -22 * s, 11 * s, 0f, paint)                         // body
        c.drawOval(-17 * s, (-46 + pose.breath) * s, 17 * s, (-17 + pose.breath) * s, paint) // head
        paint.color = 0xFF4F3A47.toInt()
        val eyeH = (4.2f * (1 - pose.blink)).coerceAtLeast(0.6f) * s
        c.drawOval((-10 + pose.face * 6) * s, -31 * s - eyeH, (-4 + pose.face * 6) * s, -31 * s + eyeH, paint)
        c.drawOval((4 + pose.face * 6) * s, -31 * s - eyeH, (10 + pose.face * 6) * s, -31 * s + eyeH, paint)
        c.restore()
    }
}
