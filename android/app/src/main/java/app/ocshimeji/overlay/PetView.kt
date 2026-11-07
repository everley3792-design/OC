package app.ocshimeji.overlay

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import app.ocshimeji.core.pet.PetBrain

/**
 * Draws one pet in its own small overlay window with a plain software Canvas (no GL context kept
 * alive over other apps). The frame comes from the OC's exported animation; the view adds the
 * contact shadow, left/right mirroring, landing squash, the pendulum swing while dragged and — for
 * sprites that are not drawn for a wall/ceiling — rotates them onto the surface.
 */
class PetView(context: Context) : View(context) {
    var sprites: PetSprites? = null
    var filter = true
        set(v) { field = v; paint.isFilterBitmap = v }
    private var set: PetSprites.Set? = null
    private var frame = 0
    private var facing = 1f; private var swing = 0f; private var squash = 1f; private var rot = 0f
    private var dragging = false; private var floor = true
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x33302A40 }
    private val dst = RectF()
    /** for diagnostics */
    var draws = 0L; private set

    /** returns true when something visible changed (→ invalidate) */
    fun show(b: PetBrain, s: PetSprites.Set?, f: Int): Boolean {
        val r = if (s != null && s.oriented) 0f else b.rotation
        val changed = s !== set || f != frame || b.facing != facing || b.swing != swing || b.squash != squash || r != rot || b.isDragging != dragging
        set = s; frame = f; facing = b.facing; swing = b.swing; squash = b.squash; rot = r; dragging = b.isDragging; floor = b.surface == PetBrain.Surface.FLOOR
        if (changed) invalidate()
        return changed
    }

    override fun onDraw(c: Canvas) {
        draws++
        val w = width.toFloat(); val h = height.toFloat()
        if (floor && !dragging) c.drawOval(w * 0.28f, h * 0.9f, w * 0.72f, h * 0.97f, shadow)
        c.save()
        if (rot != 0f) c.rotate(rot, w / 2f, h / 2f)
        if (dragging) c.rotate(Math.toDegrees(swing.toDouble()).toFloat(), w / 2f, h * 0.12f)
        c.scale(facing * (1f / kotlin.math.sqrt(squash)), squash, w / 2f, h * 0.94f)
        val sp = sprites; val st = set
        val bmp = if (sp != null && st != null) sp.bitmap(st, frame) else null
        if (bmp != null) {
            dst.set(0f, 0f, w, h); c.drawBitmap(bmp, null, dst, paint)
        } else {
            // before the game has exported this OC: a simple round critter (never an empty window)
            paint.color = 0xFFFFF6EC.toInt(); c.drawOval(w * 0.3f, h * 0.55f, w * 0.7f, h * 0.92f, paint)
            c.drawOval(w * 0.18f, h * 0.2f, w * 0.82f, h * 0.66f, paint)
            paint.color = 0xFF3B2B25.toInt(); c.drawCircle(w * 0.4f, h * 0.44f, w * 0.035f, paint); c.drawCircle(w * 0.6f, h * 0.44f, w * 0.035f, paint)
        }
        c.restore()
    }
}
