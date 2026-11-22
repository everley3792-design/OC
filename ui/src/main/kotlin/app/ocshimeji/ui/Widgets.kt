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
            /* ---- 1.5.1: 30 more drawn icons (furniture, things, feelings) ---- */
            "bed" -> { g.fillRound(cx - 4.5f * u, cy - 1f * u, 9f * u, 3.6f * u, 1f * u, color); g.fillRect(cx - 4.5f * u, cy - 3.6f * u, 1.4f * u, 7f * u, color); g.fillRound(cx - 2.8f * u, cy - 2.6f * u, 2.6f * u, 1.6f * u, 0.8f * u, color) }
            "sofa" -> { g.fillRound(cx - 4f * u, cy - 2.6f * u, 8f * u, 3f * u, 1.2f * u, color); g.fillRound(cx - 4.8f * u, cy - 0.6f * u, 9.6f * u, 3f * u, 1.2f * u, color); g.fillRect(cx - 4f * u, cy + 2.4f * u, 1f * u, 1.4f * u, color); g.fillRect(cx + 3f * u, cy + 2.4f * u, 1f * u, 1.4f * u, color) }
            "lamp" -> { g.fillRound(cx - 2.6f * u, cy - 4.4f * u, 5.2f * u, 3.2f * u, 1f * u, color); g.fillRect(cx - 0.5f * u, cy - 1.2f * u, 1f * u, 4.6f * u, color); g.fillRound(cx - 2.4f * u, cy + 3.2f * u, 4.8f * u, 1.2f * u, 0.6f * u, color) }
            "window" -> { g.strokeRound(cx - 4f * u, cy - 4f * u, 8f * u, 8f * u, 1f * u, 1.2f * u, color); g.line(cx, cy - 4f * u, cx, cy + 4f * u, 1.1f * u, color); g.line(cx - 4f * u, cy, cx + 4f * u, cy, 1.1f * u, color) }
            "tv" -> { g.strokeRound(cx - 4.4f * u, cy - 3.2f * u, 8.8f * u, 6f * u, 1f * u, 1.3f * u, color); g.line(cx - 2f * u, cy + 4f * u, cx + 2f * u, cy + 4f * u, 1.2f * u, color) }
            "bath" -> { g.fillRound(cx - 4.6f * u, cy - 0.6f * u, 9.2f * u, 4f * u, 1.8f * u, color); g.fillCircle(cx - 1.6f * u, cy - 2.4f * u, 1f * u, color); g.fillCircle(cx + 1f * u, cy - 3.4f * u, 0.8f * u, color) }
            "stove" -> { g.strokeRound(cx - 4f * u, cy - 4f * u, 8f * u, 8f * u, 1f * u, 1.2f * u, color); g.fillCircle(cx - 1.8f * u, cy - 1.4f * u, 1.2f * u, color); g.fillCircle(cx + 1.8f * u, cy - 1.4f * u, 1.2f * u, color); g.fillRect(cx - 2.4f * u, cy + 1.6f * u, 4.8f * u, 1f * u, color) }
            "fridge" -> { g.strokeRound(cx - 3f * u, cy - 4.6f * u, 6f * u, 9.2f * u, 1f * u, 1.2f * u, color); g.line(cx - 3f * u, cy - 1f * u, cx + 3f * u, cy - 1f * u, 1f * u, color); g.line(cx + 1.6f * u, cy - 3.4f * u, cx + 1.6f * u, cy - 2f * u, 1f * u, color) }
            "plant" -> { g.fillRound(cx - 2.2f * u, cy + 0.8f * u, 4.4f * u, 3.4f * u, 0.8f * u, color); g.fillCircle(cx - 1.6f * u, cy - 1.4f * u, 1.8f * u, color); g.fillCircle(cx + 1.6f * u, cy - 1.8f * u, 1.8f * u, color); g.fillCircle(cx, cy - 3.2f * u, 1.8f * u, color) }
            "book" -> { g.fillRound(cx - 4f * u, cy - 3f * u, 3.8f * u, 6.4f * u, 0.8f * u, color); g.fillRound(cx + 0.2f * u, cy - 3f * u, 3.8f * u, 6.4f * u, 0.8f * u, color) }
            "cup" -> { g.fillRound(cx - 3f * u, cy - 2.4f * u, 5f * u, 5.6f * u, 1.2f * u, color); g.strokeRound(cx + 1.6f * u, cy - 1.4f * u, 2.4f * u, 2.6f * u, 1.2f * u, 1f * u, color); g.line(cx - 1f * u, cy - 4.6f * u, cx - 0.4f * u, cy - 3.2f * u, 0.8f * u, color) }
            "broom" -> { g.line(cx + 3.4f * u, cy - 4.4f * u, cx - 1f * u, cy + 1f * u, 1.1f * u, color); g.fillRound(cx - 4.6f * u, cy + 0.2f * u, 5f * u, 3.6f * u, 1f * u, color) }
            "note" -> { g.fillCircle(cx - 2f * u, cy + 2.6f * u, 1.7f * u, color); g.line(cx - 0.4f * u, cy + 2.6f * u, cx - 0.4f * u, cy - 4f * u, 1f * u, color); g.line(cx - 0.4f * u, cy - 4f * u, cx + 3f * u, cy - 2.6f * u, 1.2f * u, color) }
            "brush" -> { g.line(cx + 3.6f * u, cy - 3.6f * u, cx - 1f * u, cy + 1f * u, 1.2f * u, color); g.fillCircle(cx - 2f * u, cy + 2.2f * u, 2f * u, color) }
            "camera" -> { g.fillRound(cx - 4.4f * u, cy - 2.4f * u, 8.8f * u, 6f * u, 1.2f * u, color); g.fillRound(cx - 1.6f * u, cy - 3.8f * u, 3.2f * u, 1.8f * u, 0.6f * u, color); g.fillCircle(cx, cy + 0.6f * u, 1.6f * u, 0x66FFFFFF) }
            "bell" -> { g.fillRound(cx - 3f * u, cy - 3f * u, 6f * u, 5.6f * u, 3f * u, color); g.fillRect(cx - 4f * u, cy + 2f * u, 8f * u, 1.2f * u, color); g.fillCircle(cx, cy + 3.8f * u, 1f * u, color) }
            "leaf" -> { g.save(); g.translate(cx, cy); g.rotate(-0.7f); g.fillRound(-2f * u, -4.2f * u, 4f * u, 8.4f * u, 2f * u, color); g.restore(); g.line(cx - 3f * u, cy + 3f * u, cx + 1.8f * u, cy - 1.8f * u, 0.8f * u, 0x66FFFFFF) }
            "flower" -> { for (k in 0 until 5) { val a = k * 1.2566f; g.fillCircle(cx + kotlin.math.cos(a) * 2.2f * u, cy + kotlin.math.sin(a) * 2.2f * u, 1.7f * u, color) }; g.fillCircle(cx, cy, 1.2f * u, 0x88FFFFFF.toInt()) }
            "crane" -> { g.line(cx - 4.4f * u, cy + 1.6f * u, cx, cy - 1f * u, 1.3f * u, color); g.line(cx, cy - 1f * u, cx + 4.4f * u, cy + 1.6f * u, 1.3f * u, color); g.line(cx, cy - 1f * u, cx + 1.6f * u, cy - 4.2f * u, 1.1f * u, color); g.line(cx - 2f * u, cy + 0.4f * u, cx + 2f * u, cy + 3f * u, 1f * u, color) }
            "shoe" -> { g.fillRound(cx - 4.2f * u, cy - 0.2f * u, 8.4f * u, 3.2f * u, 1.4f * u, color); g.fillRound(cx - 4.2f * u, cy - 3f * u, 3.8f * u, 4f * u, 1.2f * u, color) }
            "wallclock" -> { g.strokeRound(cx - 4f * u, cy - 4f * u, 8f * u, 8f * u, 4f * u, 1.2f * u, color); g.line(cx, cy, cx, cy - 2.6f * u, 1f * u, color); g.line(cx, cy, cx + 2f * u, cy + 0.6f * u, 1f * u, color) }
            "umbrella" -> { g.fillRound(cx - 4.6f * u, cy - 3.6f * u, 9.2f * u, 4f * u, 2f * u, color); g.line(cx, cy, cx, cy + 3.4f * u, 1f * u, color); g.line(cx, cy + 3.4f * u, cx - 1.4f * u, cy + 3.4f * u, 1f * u, color) }
            "ticket" -> { g.fillRound(cx - 4.4f * u, cy - 2.6f * u, 8.8f * u, 5.2f * u, 1f * u, color); g.fillCircle(cx - 4.4f * u, cy, 1f * u, 0xFFFFFFFF.toInt()); g.fillCircle(cx + 4.4f * u, cy, 1f * u, 0xFFFFFFFF.toInt()) }
            "key" -> { g.strokeRound(cx - 4.2f * u, cy - 2f * u, 4f * u, 4f * u, 2f * u, 1.2f * u, color); g.line(cx - 0.2f * u, cy, cx + 4.4f * u, cy, 1.2f * u, color); g.line(cx + 3f * u, cy, cx + 3f * u, cy + 1.8f * u, 1f * u, color) }
            "letter" -> { g.strokeRound(cx - 4.4f * u, cy - 3f * u, 8.8f * u, 6f * u, 0.8f * u, 1.1f * u, color); g.line(cx - 4.2f * u, cy - 2.6f * u, cx, cy + 0.6f * u, 1f * u, color); g.line(cx + 4.2f * u, cy - 2.6f * u, cx, cy + 0.6f * u, 1f * u, color) }
            "cake" -> { g.fillRound(cx - 4f * u, cy - 0.6f * u, 8f * u, 4.4f * u, 1f * u, color); g.fillRect(cx - 0.4f * u, cy - 3.8f * u, 0.8f * u, 3f * u, color); g.fillCircle(cx, cy - 4.4f * u, 0.8f * u, 0xFFF4A259.toInt()) }
            "smile" -> { g.strokeRound(cx - 4f * u, cy - 4f * u, 8f * u, 8f * u, 4f * u, 1.1f * u, color); g.fillCircle(cx - 1.5f * u, cy - 1f * u, 0.7f * u, color); g.fillCircle(cx + 1.5f * u, cy - 1f * u, 0.7f * u, color); g.line(cx - 1.6f * u, cy + 1.6f * u, cx + 1.6f * u, cy + 1.6f * u, 1f * u, color) }
            "zzz" -> { for ((k, s) in listOf(0f to 1f, 3f to 0.7f)) { val x = cx - 3f * u + k * u; val y = cy - k * u; val w = 3.6f * u * s
                g.line(x, y - w, x + w, y - w, 1f * u, color); g.line(x + w, y - w, x, y, 1f * u, color); g.line(x, y, x + w, y, 1f * u, color) } }
            "paw" -> { g.fillCircle(cx, cy + 1.4f * u, 2.4f * u, color); for (k in 0 until 3) g.fillCircle(cx - 2.6f * u + k * 2.6f * u, cy - 2.4f * u + (if (k == 1) -0.8f else 0f) * u, 1.1f * u, color) }
            "more" -> for (i in -1..1) g.fillCircle(cx + i * 3.2f * u, cy, 1.25f * u, color)
            "check" -> { g.line(cx - 3.6f * u, cy + 0.2f * u, cx - 1f * u, cy + 2.8f * u, 1.6f * u, color); g.line(cx - 1f * u, cy + 2.8f * u, cx + 4f * u, cy - 3f * u, 1.6f * u, color) }
            "back" -> { g.line(cx + 1.2f * u, cy - 3.6f * u, cx - 2.4f * u, cy, 1.6f * u, color); g.line(cx - 2.4f * u, cy, cx + 1.2f * u, cy + 3.6f * u, 1.6f * u, color) }
            "plus" -> { g.line(cx - 4f * u, cy, cx + 4f * u, cy, 1.7f * u, color); g.line(cx, cy - 4f * u, cx, cy + 4f * u, 1.7f * u, color) }
            "phone" -> { g.strokeRound(cx - 3f * u, cy - 4.6f * u, 6f * u, 9.2f * u, 1.4f * u, 1.3f * u, color); g.fillRect(cx - 1f * u, cy + 3f * u, 2f * u, 0.8f * u, color) }
            "minus" -> g.line(cx - 4f * u, cy, cx + 4f * u, cy, 1.7f * u, color)
            "undo" -> { g.line(cx - 3.6f * u, cy - 1f * u, cx + 2f * u, cy - 1f * u, 1.5f * u, color); g.line(cx - 3.6f * u, cy - 1f * u, cx - 1.2f * u, cy - 3.4f * u, 1.5f * u, color); g.line(cx - 3.6f * u, cy - 1f * u, cx - 1.2f * u, cy + 1.4f * u, 1.5f * u, color); g.line(cx + 2f * u, cy - 1f * u, cx + 3.6f * u, cy + 1.4f * u, 1.5f * u, color); g.line(cx + 3.6f * u, cy + 1.4f * u, cx + 1.6f * u, cy + 3.6f * u, 1.5f * u, color) }
            "redo" -> { g.line(cx + 3.6f * u, cy - 1f * u, cx - 2f * u, cy - 1f * u, 1.5f * u, color); g.line(cx + 3.6f * u, cy - 1f * u, cx + 1.2f * u, cy - 3.4f * u, 1.5f * u, color); g.line(cx + 3.6f * u, cy - 1f * u, cx + 1.2f * u, cy + 1.4f * u, 1.5f * u, color); g.line(cx - 2f * u, cy - 1f * u, cx - 3.6f * u, cy + 1.4f * u, 1.5f * u, color); g.line(cx - 3.6f * u, cy + 1.4f * u, cx - 1.6f * u, cy + 3.6f * u, 1.5f * u, color) }
            "dice" -> { g.strokeRound(cx - 4f * u, cy - 4f * u, 8f * u, 8f * u, 2f * u, 1.4f * u, color); g.fillCircle(cx - 1.8f * u, cy - 1.8f * u, 0.9f * u, color); g.fillCircle(cx + 1.8f * u, cy + 1.8f * u, 0.9f * u, color); g.fillCircle(cx, cy, 0.9f * u, color) }
            "people" -> { g.fillCircle(cx - 2f * u, cy - 2f * u, 1.8f * u, color); g.fillCircle(cx + 2.4f * u, cy - 1.6f * u, 1.5f * u, color); g.fillRound(cx - 4.6f * u, cy + 0.4f * u, 5.2f * u, 3.6f * u, 1.8f * u, color); g.fillRound(cx + 0.4f * u, cy + 0.6f * u, 4.2f * u, 3.2f * u, 1.6f * u, color) }
            "edit" -> { g.line(cx - 3.4f * u, cy + 3.4f * u, cx + 2.6f * u, cy - 2.6f * u, 2f * u, color); g.fillCircle(cx - 3.6f * u, cy + 3.6f * u, 0.9f * u, color) }
            "close" -> { g.line(cx - 3.4f * u, cy - 3.4f * u, cx + 3.4f * u, cy + 3.4f * u, 1.6f * u, color); g.line(cx + 3.4f * u, cy - 3.4f * u, cx - 3.4f * u, cy + 3.4f * u, 1.6f * u, color) }
            "next" -> { g.line(cx - 1.2f * u, cy - 3.6f * u, cx + 2.4f * u, cy, 1.6f * u, color); g.line(cx + 2.4f * u, cy, cx - 1.2f * u, cy + 3.6f * u, 1.6f * u, color) }
            "clock" -> { g.fillCircle(cx, cy, 4.6f * u, color); g.fillCircle(cx, cy, 3.4f * u, 0xFFFFFDF7.toInt()); g.line(cx, cy, cx, cy - 2.4f * u, 1f * u, color); g.line(cx, cy, cx + 1.8f * u, cy, 1f * u, color) }
            "image" -> { g.strokeRound(cx - 4.4f * u, cy - 3.6f * u, 8.8f * u, 7.2f * u, 1.4f * u, 1.3f * u, color); g.fillCircle(cx + 1.8f * u, cy - 1.2f * u, 1f * u, color); g.line(cx - 3.4f * u, cy + 2.4f * u, cx - 0.8f * u, cy - 0.2f * u, 1.2f * u, color); g.line(cx - 0.8f * u, cy - 0.2f * u, cx + 3.4f * u, cy + 2.6f * u, 1.2f * u, color) }
            "eye" -> { g.fillCircle(cx, cy, 4.6f * u, color); g.fillCircle(cx, cy, 3.2f * u, 0xFFFFFDF7.toInt()); g.fillCircle(cx, cy, 1.7f * u, color); g.line(cx - 5.2f * u, cy, cx - 4.4f * u, cy, 1.2f * u, color); g.line(cx + 4.4f * u, cy, cx + 5.2f * u, cy, 1.2f * u, color) }
            "mail" -> { g.strokeRound(cx - 4.6f * u, cy - 3.2f * u, 9.2f * u, 6.4f * u, 1f * u, 1.3f * u, color); g.line(cx - 4f * u, cy - 2.4f * u, cx, cy + 0.6f * u, 1.2f * u, color); g.line(cx + 4f * u, cy - 2.4f * u, cx, cy + 0.6f * u, 1.2f * u, color) }
            "star" -> { for (i in 0 until 5) { val a = -Math.PI.toFloat() / 2 + i * 2 * Math.PI.toFloat() / 5; g.line(cx, cy, cx + kotlin.math.cos(a) * 4.6f * u, cy + kotlin.math.sin(a) * 4.6f * u, 2.2f * u, color) }; g.fillCircle(cx, cy, 2f * u, color) }
            "ff" -> { for (k in 0..1) { val ox = cx - 3.6f * u + k * 4f * u; g.line(ox, cy - 3.4f * u, ox + 3f * u, cy, 1.5f * u, color); g.line(ox + 3f * u, cy, ox, cy + 3.4f * u, 1.5f * u, color) } }
            "chat" -> { g.fillRound(cx - 4.6f * u, cy - 3.8f * u, 9.2f * u, 6.4f * u, 2.6f * u, color); g.line(cx - 2f * u, cy + 2f * u, cx - 3.4f * u, cy + 4.4f * u, 1.4f * u, color) }
            "game" -> { g.fillRound(cx - 4.8f * u, cy - 2.6f * u, 9.6f * u, 5.4f * u, 2.6f * u, color); g.fillCircle(cx - 2.4f * u, cy, 0.9f * u, 0xFFFFFDF7.toInt()); g.fillCircle(cx + 2.2f * u, cy - 0.8f * u, 0.7f * u, 0xFFFFFDF7.toInt()); g.fillCircle(cx + 3.2f * u, cy + 0.6f * u, 0.7f * u, 0xFFFFFDF7.toInt()) }
            "list" -> for (i in -1..1) { g.fillCircle(cx - 3.6f * u, cy + i * 3f * u, 0.9f * u, color); g.line(cx - 1.6f * u, cy + i * 3f * u, cx + 4.2f * u, cy + i * 3f * u, 1.3f * u, color) }
            "heart" -> heart(g, cx, cy + 0.4f * u, 3.6f * u, color)
            "anger" -> for ((sx, sy) in listOf(-1 to -1, 1 to -1, -1 to 1, 1 to 1)) { val ox = cx + sx * 2.2f * u; val oy = cy + sy * 2.2f * u; g.line(ox, oy, ox + sx * 2f * u, oy, 1.4f * u, color); g.line(ox, oy, ox, oy + sy * 2f * u, 1.4f * u, color) }
            "food" -> { g.fillRound(cx - 4.2f * u, cy - 0.4f * u, 8.4f * u, 3.6f * u, 1.8f * u, color); g.line(cx - 4.8f * u, cy - 0.6f * u, cx + 4.8f * u, cy - 0.6f * u, 1.2f * u, color); g.line(cx - 1f * u, cy - 1.6f * u, cx - 0.4f * u, cy - 4.2f * u, 1f * u, color); g.line(cx + 1.4f * u, cy - 1.6f * u, cx + 2f * u, cy - 4.2f * u, 1f * u, color) }
            "cloud" -> { g.fillCircle(cx - 2.4f * u, cy + 0.6f * u, 2.4f * u, color); g.fillCircle(cx + 0.4f * u, cy - 1f * u, 3f * u, color); g.fillCircle(cx + 3f * u, cy + 0.8f * u, 2.2f * u, color); g.fillRect(cx - 2.4f * u, cy + 0.6f * u, 5.4f * u, 2.4f * u, color) }
            "drop" -> { g.fillCircle(cx, cy + 1.4f * u, 2.8f * u, color); g.save(); g.translate(cx, cy - 0.6f * u); g.rotate((Math.PI / 4).toFloat()); g.fillRect(-2f * u, -2f * u, 2.8f * u, 2.8f * u, color); g.restore() }
            "gift" -> { g.fillRect(cx - 4f * u, cy - 1f * u, 8f * u, 5f * u, color); g.fillRect(cx - 4.6f * u, cy - 3f * u, 9.2f * u, 2f * u, color); g.fillRect(cx - 0.6f * u, cy - 3f * u, 1.2f * u, 7f * u, 0xFFFFFDF7.toInt()); g.fillCircle(cx - 1.6f * u, cy - 4f * u, 1.2f * u, color); g.fillCircle(cx + 1.6f * u, cy - 4f * u, 1.2f * u, color) }
            "dots" -> for (i in -1..1) g.fillCircle(cx + i * 3f * u, cy + 1f * u, 1.1f * u, color)
            "town" -> { for ((ox, hh) in listOf(-2.4f to 3.6f, 2.4f to 5f)) { val l = cx + ox * u - 2.2f * u; g.fillRect(l, cy + 4.4f * u - hh * u, 4.4f * u, hh * u, color)
                    g.line(l - 0.4f * u, cy + 4.6f * u - hh * u, cx + ox * u, cy + 2f * u - hh * u, 1.3f * u, color); g.line(cx + ox * u, cy + 2f * u - hh * u, l + 4.8f * u, cy + 4.6f * u - hh * u, 1.3f * u, color) } }
            "bag" -> { g.fillRound(cx - 4.2f * u, cy - 1.8f * u, 8.4f * u, 6.4f * u, 1.8f * u, color); g.strokeRound(cx - 2.2f * u, cy - 4.6f * u, 4.4f * u, 4.6f * u, 2f * u, 1.3f * u, color) }
            "move" -> { g.line(cx - 4.2f * u, cy, cx + 4.2f * u, cy, 1.4f * u, color); g.line(cx, cy - 4.2f * u, cx, cy + 4.2f * u, 1.4f * u, color)
                for ((dx, dy) in listOf(1f to 0f, -1f to 0f, 0f to 1f, 0f to -1f)) { val tx = cx + dx * 4.4f * u; val ty = cy + dy * 4.4f * u
                    g.line(tx, ty, tx - dx * 1.8f * u - dy * 1.6f * u, ty - dy * 1.8f * u - dx * 1.6f * u, 1.3f * u, color); g.line(tx, ty, tx - dx * 1.8f * u + dy * 1.6f * u, ty - dy * 1.8f * u + dx * 1.6f * u, 1.3f * u, color) } }
            "home" -> { g.fillRect(cx - 3.4f * u, cy - 0.6f * u, 6.8f * u, 5f * u, color); g.line(cx - 5f * u, cy + 0.4f * u, cx, cy - 4.4f * u, 1.6f * u, color); g.line(cx, cy - 4.4f * u, cx + 5f * u, cy + 0.4f * u, 1.6f * u, color) }
            "coin" -> { g.fillCircle(cx, cy, 4.6f * u, color); g.fillCircle(cx, cy, 3.4f * u, 0xFFFFE29A.toInt()); icon(g, "star", cx, cy, size * 0.55f, color) }
            "pinky" -> { g.line(cx - 3.6f * u, cy + 2f * u, cx - 0.6f * u, cy - 1f * u, 1.6f * u, color); g.line(cx + 3.6f * u, cy + 2f * u, cx + 0.6f * u, cy - 1f * u, 1.6f * u, color); g.strokeRound(cx - 1.6f * u, cy - 3f * u, 3.2f * u, 3.2f * u, 1.6f * u, 1.2f * u, color) }
            "import" -> { g.line(cx, cy - 4f * u, cx, cy + 1.6f * u, 1.5f * u, color); g.line(cx - 2.6f * u, cy - 1f * u, cx, cy + 1.8f * u, 1.5f * u, color); g.line(cx + 2.6f * u, cy - 1f * u, cx, cy + 1.8f * u, 1.5f * u, color); g.line(cx - 4f * u, cy + 4f * u, cx + 4f * u, cy + 4f * u, 1.5f * u, color) }
            "note2" -> { g.fillCircle(cx - 1.6f * u, cy + 2.6f * u, 2.2f * u, color); g.fillRect(cx + 0.2f * u, cy - 4.4f * u, 1.3f * u, 7f * u, color); g.fillRect(cx + 0.2f * u, cy - 4.4f * u, 3.6f * u, 1.6f * u, color) }
            "share" -> { g.line(cx, cy + 2.6f * u, cx, cy - 3.6f * u, 1.5f * u, color); g.line(cx - 2.6f * u, cy - 1.2f * u, cx, cy - 3.8f * u, 1.5f * u, color); g.line(cx + 2.6f * u, cy - 1.2f * u, cx, cy - 3.8f * u, 1.5f * u, color); g.line(cx - 4f * u, cy + 4f * u, cx + 4f * u, cy + 4f * u, 1.5f * u, color) }
        }
    }
    /** 1.5.1: at the top (under the time capsule), up to two lines, tap to dismiss; returns where it is */
    /** 2.1.0 (#05): how long a toast stays — longer text, longer time */
    fun toastStay(text: String) = 3.0f + (text.length - 24).coerceAtLeast(0) * 0.05f
    fun toast(g: Gfx, app: UiApp, text: String, age: Float): FloatArray {
        val t = app.theme; val inA = Ease.outBack(minOf(1f, age / 0.3f)); val stay = toastStay(text); val out = if (age > stay) 1 - (age - stay) / 0.4f else 1f
        val lines = wrap(g, text, Dim.FS_S + 1, app.w - 96); val w = minOf(app.w - 48, lines.maxOf { g.measure(it, Dim.FS_S + 1) } + 48); val h = 26f + lines.size * 20f
        val x = (app.w - w) / 2; val y = app.insetTop + 114 - (1 - inA) * 24
        g.save(); g.alpha(out.coerceIn(0f, 1f)); card(g, t, x, y, w, h, 22f, t.ink, Colors.mix(t.ink, 0xFF000000.toInt(), 0.3f))
        lines.forEachIndexed { i, l -> g.text(l, app.w / 2, y + 28 + i * 20f, Dim.FS_S + 1, t.bg, FontKind.UI, Align.CENTER) }; g.restore()
        return floatArrayOf(x, y, w, h)
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
    /** a pill that can be on (mint) or off; one tap toggles / picks */
    fun chip(g: Gfx, app: UiApp, id: String, x: Float, y: Float, label: String, on: Boolean, h: Float = 40f, minW: Float = 0f, enabled: Boolean = true): Float {
        val t = app.theme; val w = maxOf(minW, g.measure(label, Dim.FS_S + 1) + 28); val sink = if (app.pressed == id) Dim.LIP - 1 else 0f
        if (!enabled) { g.fillRound(x, y, w, h, h / 2, t.surface2); g.text(label, x + w / 2, y + h / 2 + 5, Dim.FS_S + 1, t.ink3, FontKind.UI, Align.CENTER); return w }
        card(g, t, x, y, w, h, h / 2, if (on) t.select else t.surface, if (on) Colors.mix(t.select, 0xFF000000.toInt(), 0.18f) else t.lip, sink)
        g.text(label, x + w / 2, y + sink + h / 2 + 5, Dim.FS_S + 1, t.ink, FontKind.UI, Align.CENTER)
        app.zone(id, x, y - maxOf(0f, (Dim.TOUCH - h) / 2), w, maxOf(h + Dim.LIP, Dim.TOUCH)); return w
    }
    /** 1.5.1: the little picture over an empty list — a cloud asleep */
    fun emptyArt(g: Gfx, t: Theme, cx: Float, cy: Float) {
        val c = Colors.mix(t.surface2, t.ink3, 0.18f)
        g.fillCircle(cx - 16, cy + 2, 14f, c); g.fillCircle(cx + 2, cy - 8, 18f, c); g.fillCircle(cx + 20, cy + 2, 13f, c); g.fillRound(cx - 28, cy + 2, 58f, 14f, 7f, c)
        g.line(cx - 8, cy - 2, cx - 3, cy - 2, 1.6f, t.ink3); g.line(cx + 6, cy - 2, cx + 11, cy - 2, 1.6f, t.ink3); icon(g, "zzz", cx + 30, cy - 22, 12f, t.ink3)
    }
    /** a heart (two circles and a turned square) */
    fun heart(g: Gfx, cx: Float, cy: Float, s: Float, color: Int) {
        g.fillCircle(cx - s * 0.5f, cy - s * 0.2f, s * 0.55f, color); g.fillCircle(cx + s * 0.5f, cy - s * 0.2f, s * 0.55f, color)
        g.save(); g.translate(cx, cy + s * 0.25f); g.rotate((Math.PI / 4).toFloat()); g.fillRect(-s * 0.68f, -s * 0.68f, s * 1.36f, s * 1.36f, color); g.restore()
    }
    /** the little weather of a mood (plan A-04): sun, cloud, drizzle, rain, rainbow, moon — drawn, never a glyph */
    fun sky(g: Gfx, t: Theme, kind: String, cx: Float, cy: Float, s: Float) {
        val sun = 0xFFFFC857.toInt(); val cloud = if (t.dark) 0xFFD9D4E8.toInt() else 0xFFFFFFFF.toInt(); val cloudLip = 0xFFB8C4D6.toInt(); val drop = 0xFF7AAAD6.toInt()
        fun cl(x: Float, y: Float, k: Float, c: Int = cloud) { g.fillCircle(x - s * 0.42f * k, y + s * 0.08f * k, s * 0.34f * k, c); g.fillCircle(x, y - s * 0.12f * k, s * 0.44f * k, c); g.fillCircle(x + s * 0.44f * k, y + s * 0.08f * k, s * 0.32f * k, c); g.fillRound(x - s * 0.72f * k, y + s * 0.05f * k, s * 1.44f * k, s * 0.38f * k, s * 0.19f * k, c) }
        when (kind) {
            "sun" -> { for (i in 0 until 8) { val a = i * Math.PI.toFloat() / 4; g.line(cx + kotlin.math.cos(a) * s * 0.55f, cy + kotlin.math.sin(a) * s * 0.55f, cx + kotlin.math.cos(a) * s * 0.8f, cy + kotlin.math.sin(a) * s * 0.8f, s * 0.14f, sun) }; g.fillCircle(cx, cy, s * 0.42f, sun) }
            "rainbow" -> { val cs = intArrayOf(0xFFF0705A.toInt(), 0xFFF4A259.toInt(), 0xFFFFD166.toInt(), 0xFF8ED1B4.toInt(), 0xFF7AAAD6.toInt())
                g.save(); g.clip(cx - s, cy - s, s * 2, s * 1.05f); cs.forEachIndexed { i, c -> g.fillCircle(cx, cy + s * 0.2f, s * (0.9f - i * 0.12f), c) }; g.fillCircle(cx, cy + s * 0.2f, s * 0.3f, t.surface); g.restore(); cl(cx - s * 0.62f, cy + s * 0.12f, 0.45f); cl(cx + s * 0.62f, cy + s * 0.12f, 0.45f) }
            "cloud" -> { cl(cx, cy + s * 0.04f, 1f, cloudLip); cl(cx, cy - s * 0.02f, 1f) }
            "drizzle" -> { cl(cx, cy - s * 0.12f, 0.95f, cloudLip); cl(cx, cy - s * 0.17f, 0.95f); g.line(cx, cy + s * 0.38f, cx - s * 0.06f, cy + s * 0.62f, s * 0.12f, drop) }
            "rain" -> { cl(cx, cy - s * 0.15f, 0.95f, 0xFF9AA6B8.toInt()); cl(cx, cy - s * 0.2f, 0.95f, 0xFFC9D1DD.toInt()); for (i in -1..1) g.line(cx + i * s * 0.32f, cy + s * 0.32f, cx + i * s * 0.32f - s * 0.07f, cy + s * 0.6f, s * 0.12f, drop) }
            "moon" -> { g.fillCircle(cx, cy, s * 0.5f, 0xFFFFE29A.toInt()); g.fillCircle(cx + s * 0.24f, cy - s * 0.16f, s * 0.42f, t.surface) }
            "snow" -> { cl(cx, cy - s * 0.15f, 0.95f, cloudLip); cl(cx, cy - s * 0.2f, 0.95f); for (i in -1..1) g.fillCircle(cx + i * s * 0.32f, cy + s * 0.48f + (if (i == 0) s * 0.1f else 0f), s * 0.09f, drop) }
            "fog" -> { for (i in 0..2) g.fillRound(cx - s * 0.7f + i * s * 0.12f, cy - s * 0.35f + i * s * 0.3f, s * 1.3f, s * 0.16f, s * 0.08f, cloudLip) }
        }
    }
    /** break text into lines that fit a width (Chinese breaks anywhere; a word with spaces stays whole when it can) */
    private const val NO_START = "）」』】〉》，。、：；！？…・)]}.,:;!?%"
    fun wrap(g: Gfx, s: String, size: Float, maxW: Float, maxLines: Int = 99): List<String> {
        val out = ArrayList<String>(); var line = StringBuilder()
        for (ch in s) { if (ch == '\n') { out += line.toString(); line = StringBuilder(); continue }
            if (g.measure(line.toString() + ch, size) > maxW && line.isNotEmpty()) {
                /* keep a run of latin letters / digits (1024, px, M2) together on the next line */
                var cut = line.length; if (ch.isLetterOrDigit() && ch.code < 128) while (cut > 0 && line[cut - 1].isLetterOrDigit() && line[cut - 1].code < 128) cut--
                if (ch in NO_START && cut == line.length && line.length > 1) cut = line.length - 1   /* 2.1.0: a closing mark never starts a line — the last character goes down with it */
                if (cut == 0 || cut == line.length) { out += line.toString(); line = StringBuilder() } else { out += line.substring(0, cut); line = StringBuilder(line.substring(cut)) }
                if (ch == ' ' && line.isEmpty()) continue }
            line.append(ch) }
        if (line.isNotEmpty()) out += line.toString()
        if (out.size > maxLines) { cut(s); val keep = out.take(maxLines).toMutableList(); keep[maxLines - 1] = fit(g, keep[maxLines - 1] + "…", size, maxW); return keep }
        return out
    }
    /** 2.1.0 (#05): every text that had to be cut (tests check that long sentences never are); the last 64 */
    val cuts = ArrayDeque<String>()
    private fun cut(s: String) { cuts.addLast(s); while (cuts.size > 64) cuts.removeFirst() }
    /** text cut to a width with an ellipsis — only for names and short labels in fixed places; sentences wrap */
    fun fit(g: Gfx, s: String, size: Float, maxW: Float, font: FontKind = FontKind.UI): String {
        if (g.measure(s, size, font) <= maxW) return s
        cut(s)
        var n = s.length; while (n > 0 && g.measure(s.take(n) + "…", size, font) > maxW) n--
        return s.take(n) + "…"
    }
}

internal fun UiApp.render0(c: Int, a: Float) = app.ocshimeji.render.Colors.withAlpha(c, a.coerceIn(0f, 1f))
internal fun UiApp.mix(c: Int) = app.ocshimeji.render.Colors.mix(c, 0xFF000000.toInt(), 0.18f)
