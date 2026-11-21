package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import app.ocshimeji.save.LibChar

enum class Kind { PRIMARY, SECONDARY, DANGER, GHOST }

/** the components (plan 6.1). Each registers its own tap zone; pressed ones sink onto their lip. */
object Widgets {
    /** a raised surface with a lip and a soft shadow */
    fun card(g: Gfx, t: Theme, x: Float, y: Float, w: Float, h: Float, r: Float = Dim.RADIUS_L, color: Int = t.surface, lip: Int = t.lip, sink: Float = 0f) {
        g.fillRound(x, y + Dim.LIP + 3f, w, h, r, t.shadow)
        g.fillRound(x, y + Dim.LIP, w, h, r, lip)
        g.fillRound(x, y + sink, w, h, r, color)
    }
    fun button(g: Gfx, app: UiApp, id: String, x: Float, y: Float, w: Float, h: Float, label: String, kind: Kind = Kind.SECONDARY, size: Float = Dim.FS_M) {
        val t = app.theme; val down = app.pressed == id; val sink = if (down) Dim.LIP - 1 else 0f
        val (bg, lip, fg) = when (kind) {
            Kind.PRIMARY -> Triple(t.accent, t.accentLip, t.onAccent)
            Kind.DANGER -> Triple(t.alert, Colors.mix(t.alert, 0xFF000000.toInt(), 0.2f), t.onAlert)
            Kind.SECONDARY -> Triple(t.surface, t.lip, t.ink)
            Kind.GHOST -> Triple(t.surface2, t.surface2, t.ink2)
        }
        if (kind == Kind.GHOST) g.fillRound(x, y, w, h, h / 2, bg) else card(g, t, x, y, w, h, h / 2, bg, lip, sink)
        g.text(label, x + w / 2, y + sink + h / 2 + size * 0.36f, size, fg, FontKind.UI, Align.CENTER)
        app.zone(id, x, y, w, h + Dim.LIP)
    }
    /** a round button with a drawn icon (icons are shapes, not font glyphs: every font has them then) */
    fun round(g: Gfx, app: UiApp, id: String, cx: Float, cy: Float, r: Float, icon: String) {
        val t = app.theme; val sink = if (app.pressed == id) Dim.LIP - 1 else 0f
        card(g, t, cx - r, cy - r, r * 2, r * 2, r, t.surface, t.lip, sink)
        icon(g, icon, cx, cy + sink, r * 0.9f, t.ink2)
        app.zone(id, cx - maxOf(r, Dim.TOUCH / 2), cy - maxOf(r, Dim.TOUCH / 2), maxOf(r, Dim.TOUCH / 2) * 2, maxOf(r, Dim.TOUCH / 2) * 2)
    }
    /** simple drawn icons: more (⋯), check, back (‹), plus */
    fun icon(g: Gfx, name: String, cx: Float, cy: Float, size: Float, color: Int) {
        val u = size / 10f
        when (name) {
            "more" -> for (i in -1..1) g.fillCircle(cx + i * 3.2f * u, cy, 1.25f * u, color)
            "check" -> { g.line(cx - 3.6f * u, cy + 0.2f * u, cx - 1f * u, cy + 2.8f * u, 1.6f * u, color); g.line(cx - 1f * u, cy + 2.8f * u, cx + 4f * u, cy - 3f * u, 1.6f * u, color) }
            "back" -> { g.line(cx + 1.2f * u, cy - 3.6f * u, cx - 2.4f * u, cy, 1.6f * u, color); g.line(cx - 2.4f * u, cy, cx + 1.2f * u, cy + 3.6f * u, 1.6f * u, color) }
            "plus" -> { g.line(cx - 4f * u, cy, cx + 4f * u, cy, 1.7f * u, color); g.line(cx, cy - 4f * u, cx, cy + 4f * u, 1.7f * u, color) }
        }
    }
    fun toast(g: Gfx, app: UiApp, text: String, age: Float) {
        val t = app.theme; val inA = Ease.outBack(minOf(1f, age / 0.3f)); val out = if (age > 2.2f) 1 - (age - 2.2f) / 0.4f else 1f
        val w = minOf(app.w - 48, g.measure(text, Dim.FS_M) + 44); val x = (app.w - w) / 2; val y = app.h - app.insetBottom - 96 + (1 - inA) * 30
        g.save(); g.alpha(out.coerceIn(0f, 1f)); card(g, t, x, y, w, 48f, 24f, t.ink, Colors.mix(t.ink, 0xFF000000.toInt(), 0.3f)); g.text(text, app.w / 2, y + 30, Dim.FS_M, t.bg, FontKind.UI, Align.CENTER); g.restore()
    }
    /** a character standing on its feet at (x, y), `height` dp tall, breathing (the procedural idle every character has) */
    fun character(g: Gfx, img: Img?, c: LibChar, x: Float, y: Float, height: Float, time: Float, phase: Float = 0f) {
        if (img == null) return
        val w = height * img.w / img.h; val breath = 1f + 0.018f * kotlin.math.sin((time + phase) * 2.4f)
        g.save(); g.translate(x, y); g.scale(1f / kotlin.math.sqrt(breath), breath)
        g.image(img, -w * c.footX, -height * c.footY, w, height); g.restore()
    }
    /** the soft shadow under a character's feet */
    fun footShadow(g: Gfx, t: Theme, x: Float, y: Float, w: Float) { g.save(); g.translate(x, y); g.scale(1f, 0.28f); g.fillCircle(0f, 0f, w / 2, t.shadow); g.restore() }
    /** a round portrait (the character fitted into a circle) */
    fun face(g: Gfx, t: Theme, img: Img?, cx: Float, cy: Float, r: Float) {
        g.fillCircle(cx, cy, r + 2, t.surface); g.fillCircle(cx, cy, r, t.surface2)
        if (img == null) return
        val s = r * 1.7f / maxOf(img.w, img.h); val w = img.w * s; val h = img.h * s
        g.image(img, cx - w / 2, cy - h / 2 + r * 0.05f, w, h)
    }
    /** text cut to a width with an ellipsis */
    fun fit(g: Gfx, s: String, size: Float, maxW: Float, font: FontKind = FontKind.UI): String {
        if (g.measure(s, size, font) <= maxW) return s
        var n = s.length; while (n > 0 && g.measure(s.take(n) + "…", size, font) > maxW) n--
        return s.take(n) + "…"
    }
}
