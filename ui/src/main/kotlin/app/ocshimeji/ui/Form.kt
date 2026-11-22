package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx

/**
 * A little immediate-mode form for settings panels: each call draws one row at `y`, registers its tap zones and moves `y` down.
 * Ids follow a pattern the screen's tap() reads back: "row:<key>", "chip:<key>:<value>", "step:<key>:+/-", "tog:<key>", "add:<key>", "del:<key>:<i>", "btn:<key>".
 */
class Form(val app: UiApp, val g: Gfx, val x: Float, val w: Float, var y: Float) {
    private val t get() = app.theme
    fun header(text: String, sub: String? = null) { y += 14; g.text(text, x + 2, y + 16, Dim.FS_M, t.ink); if (sub != null) g.text(Widgets.fit(g, sub, Dim.FS_S - 1, w - 4), x + 2, y + 36, Dim.FS_S - 1, t.ink3); y += if (sub != null) 46f else 28f }
    fun note(text: String, color: Int = t.ink3) { for (l in Widgets.wrap(g, text, Dim.FS_S, w - 8)) { g.text(l, x + 4, y + 16, Dim.FS_S, color); y += 20 }; y += 4 }
    /** a row that opens the keyboard */
    fun row(key: String, label: String, value: String, placeholder: String = "（點一下填寫）") {
        val id = "row:$key"; val sink = if (app.pressed == id) Dim.LIP - 1 else 0f
        Widgets.card(g, t, x, y, w, 56f, 18f, t.surface, t.lip, sink)
        g.text(label, x + 14, y + 22 + sink, Dim.FS_S - 1, t.ink2)
        g.text(Widgets.fit(g, value.ifBlank { placeholder }, Dim.FS_M, w - 52), x + 14, y + 44 + sink, Dim.FS_M, if (value.isBlank()) t.ink3 else t.ink)
        Widgets.icon(g, "next", x + w - 22, y + 30 + sink, 14f, t.ink3); app.zone(id, x, y, w, 60f); y += 66
    }
    /** chips that wrap; `on` = selected values; `off` = disabled values with the reason shown under them when tapped */
    fun chips(key: String, options: List<String>, on: Set<String>, off: Set<String> = emptySet(), label: String? = null) {
        if (label != null) { g.text(label, x + 2, y + 14, Dim.FS_S, t.ink2); y += 22 }
        var cx = x; var cy = y
        for (o in options) { val cw = g.measure(o, Dim.FS_S + 1) + 28; if (cx + cw > x + w && cx > x) { cx = x; cy += 46 }
            Widgets.chip(g, app, "chip:$key:$o", cx, cy, o, o in on, 38f, enabled = o !in off); cx += cw + 6 }
        y = cy + 50
    }
    /** − value + */
    fun stepper(key: String, label: String, value: String, sub: String? = null) {
        Widgets.card(g, t, x, y, w, 56f, 18f, t.surface2, t.surface2)
        g.text(label, x + 14, y + (if (sub == null) 34f else 24f), Dim.FS_S + 1, t.ink); if (sub != null) g.text(Widgets.fit(g, sub, Dim.FS_S - 2, w - 190), x + 14, y + 44, Dim.FS_S - 2, t.ink3)
        Widgets.round(g, app, "step:$key:-", x + w - 128, y + 28, 18f, "minus")
        g.text(value, x + w - 74, y + 34, Dim.FS_M, t.ink, FontKind.UI, Align.CENTER)
        Widgets.round(g, app, "step:$key:+", x + w - 22, y + 28, 18f, "plus"); y += 64
    }
    /** a bar from −1 to 1 (or 0..1) with − / + — for personality axes and tendencies */
    /** 1.5.1: where each slider's bar is (x, width, signed) so the screen can drag it */
    var bars: MutableMap<String, FloatArray>? = null
    fun meter(key: String, left: String, right: String, v: Float, signed: Boolean = true) {
        Widgets.card(g, t, x, y, w, 56f, 18f, t.surface2, t.surface2)
        g.text(left, x + 14, y + 22, Dim.FS_S - 1, t.ink2); g.text(right, x + w - 132, y + 22, Dim.FS_S - 1, t.ink2, FontKind.UI, Align.RIGHT)
        val bx = x + 14; val bw = w - 160; val by = y + 34
        g.fillRound(bx, by, bw, 10f, 5f, t.lip); val k = if (signed) (v + 1) / 2 else v
        g.fillCircle(bx + bw * k.coerceIn(0f, 1f), by + 5, 8f, t.accent)
        if (signed) g.fillRect(bx + bw / 2 - 1, by - 2, 2f, 14f, t.ink3)
        bars?.let { it[key] = floatArrayOf(bx, bw, if (signed) 1f else 0f); app.zone("meter:$key", bx - 12, y + 8, bw + 24, 48f) }
        Widgets.round(g, app, "step:$key:-", x + w - 104, y + 28, 18f, "minus"); Widgets.round(g, app, "step:$key:+", x + w - 22, y + 28, 18f, "plus"); y += 64
    }
    fun toggle(key: String, label: String, on: Boolean, sub: String? = null) {
        val id = "tog:$key"; Widgets.card(g, t, x, y, w, 56f, 18f, t.surface2, t.surface2)
        g.text(label, x + 14, y + (if (sub == null) 34f else 24f), Dim.FS_S + 1, t.ink); if (sub != null) g.text(Widgets.fit(g, sub, Dim.FS_S - 2, w - 90), x + 14, y + 44, Dim.FS_S - 2, t.ink3)
        val sx = x + w - 66; g.fillRound(sx, y + 16, 52f, 26f, 13f, if (on) t.select else t.lip); g.fillCircle(if (on) sx + 39 else sx + 13, y + 29, 10f, t.surface)
        app.zone(id, x, y, w, 56f); y += 64
    }
    /** a list of words: tap one to remove it, ＋ to add */
    fun list(key: String, label: String, items: List<String>, max: Int = 10) {
        g.text("$label（${items.size}／$max）", x + 2, y + 14, Dim.FS_S, t.ink2); y += 22
        var cx = x; var cy = y
        items.forEachIndexed { i, s -> val txt = Widgets.fit(g, s, Dim.FS_S + 1, w - 60); val cw = g.measure(txt, Dim.FS_S + 1) + 44; if (cx + cw > x + w && cx > x) { cx = x; cy += 46 }
            val id = "del:$key:$i"; val sink = if (app.pressed == id) 2f else 0f
            Widgets.card(g, t, cx, cy, cw, 38f, 19f, t.surface, t.lip, sink); g.text(txt, cx + 14, cy + 24 + sink, Dim.FS_S + 1, t.ink); Widgets.icon(g, "close", cx + cw - 16, cy + 19 + sink, 9f, t.ink3)
            app.zone(id, cx, cy - 4, cw, 46f); cx += cw + 6 }
        if (items.size < max) { val cw = 64f; if (cx + cw > x + w && cx > x) { cx = x; cy += 46 }
            val id = "add:$key"; g.strokeRound(cx + 1, cy + 1, cw - 2, 36f, 18f, 2f, t.lip); Widgets.icon(g, "plus", cx + cw / 2, cy + 19, 14f, t.ink2); app.zone(id, cx, cy - 4, cw, 46f) }
        y = cy + 52
    }
    fun button(key: String, label: String, kind: Kind = Kind.SECONDARY) { Widgets.button(g, app, "btn:$key", x, y, w, 50f, label, kind); y += 62 }
    /** colour swatches (the representative colour) */
    fun swatches(key: String, colors: List<String>, on: String) {
        var cx = x + 20
        for (c in colors) { val id = "chip:$key:$c"; val col = if (c.isEmpty()) t.surface2 else Colors.hex(c)
            g.fillCircle(cx, y + 22, if (c == on) 19f else 16f, if (c == on) t.ink else t.lip); g.fillCircle(cx, y + 22, 15f, col)
            if (c.isEmpty()) Widgets.icon(g, "close", cx, y + 22, 10f, t.ink3)
            app.zone(id, cx - 22, y - 2, 44f, 48f); cx += 44 }
        y += 54
    }
}
