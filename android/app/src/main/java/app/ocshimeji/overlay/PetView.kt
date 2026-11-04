package app.ocshimeji.overlay

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import app.ocshimeji.core.pet.PetBrain

/**
 * Draws the pet in its overlay window with a plain software Canvas (no GL context to keep
 * alive over other apps). Frames come from [PetSprites]; the view adds the contact shadow,
 * left/right mirroring, landing squash and the pendulum swing while dragged.
 */
class PetView(context: Context) : View(context) {
    var sprites: PetSprites = PetSprites.EMPTY
    private var anim = PetBrain.Anim.IDLE
    private var frameIdx = 0
    private var facing = 1f
    private var swing = 0f
    private var squash = 1f
    private var dragging = false
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x33302A40 }
    private val dst = RectF()

    fun render(b: PetBrain) {
        anim = b.anim; facing = b.facing; swing = b.swing; squash = b.squash; dragging = b.isDragging
        val set = sprites.get(anim.key)
        frameIdx = if (set == null) 0 else b.frame(set.frames.size, set.fps)
        invalidate()
    }

    override fun onDraw(c: Canvas) {
        val w = width.toFloat(); val h = height.toFloat()
        if (!dragging) c.drawOval(w * 0.28f, h * 0.9f, w * 0.72f, h * 0.97f, shadow)
        c.save()
        if (dragging) c.rotate(Math.toDegrees(swing.toDouble()).toFloat(), w / 2f, h * 0.12f)
        c.scale(facing * (1f / kotlin.math.sqrt(squash)), squash, w / 2f, h * 0.94f)
        val bmp = sprites.get(anim.key)?.frames?.getOrNull(frameIdx) ?: sprites.get("idle")?.frames?.firstOrNull()
        if (bmp != null) {
            dst.set(0f, 0f, w, h); c.drawBitmap(bmp, null, dst, paint)
        } else {
            // fallback before the game has exported sprites: a simple round critter
            paint.color = 0xFFFFF6EC.toInt(); c.drawOval(w * 0.3f, h * 0.55f, w * 0.7f, h * 0.92f, paint)
            c.drawOval(w * 0.18f, h * 0.2f, w * 0.82f, h * 0.66f, paint)
            paint.color = 0xFF3B2B25.toInt(); c.drawCircle(w * 0.4f, h * 0.44f, w * 0.035f, paint); c.drawCircle(w * 0.6f, h * 0.44f, w * 0.035f, paint)
        }
        c.restore()
    }
}
