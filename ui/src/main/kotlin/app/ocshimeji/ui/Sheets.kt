package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx

/** a bottom sheet: title, rows (each one tap), slides up with a spring; outside / back closes it */
open class ListSheet(val title: String, val rows: List<Pair<String, String>>, val subtitle: String? = null, val danger: Set<String> = emptySet(), val onPick: (String) -> Unit) : Overlay() {
    private val slide = Spring(0f, 1f)
    /** R1 (U7): a long list scrolls inside the sheet (it used to turn pages) */
    private val scroll = Scroller()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt)
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        /* 2.1.0 (#05): a long row wraps and the row grows; a long subtitle wraps too */
        val tw = app.w - Dim.GUTTER * 2 - 16
        val wrapped = rows.map { (_, label) -> Widgets.wrap(g, label, Dim.FS_M + 1, tw) }
        val heights = wrapped.map { maxOf(56f, 20f + it.size * 22f) }; val total = heights.sum()
        val subL = subtitle?.let { Widgets.wrap(g, it, Dim.FS_S, app.w - 40) } ?: emptyList()
        val head = if (subL.isNotEmpty()) 64f + subL.size * 20f else 64f
        val maxList = app.h - app.insetTop - 40 - head - 16 - app.insetBottom
        val listH = minOf(total, maxList)
        val h = head + listH + 16 + app.insetBottom
        val y = app.h - h * s
        g.fillRound(0f, y, app.w, h + 40, Dim.RADIUS_L, t.surface)
        g.fillRound(app.w / 2 - 20, y + 10, 40f, 5f, 3f, t.line)
        g.text(title, Dim.GUTTER + 4, y + 44, Dim.FS_L, t.ink)
        subL.forEachIndexed { i, l -> g.text(l, Dim.GUTTER + 4, y + 68 + i * 20f, Dim.FS_S, t.ink2) }
        app.zone("sheet:body", 0f, y, app.w, h)
        scroll.max = maxOf(0f, total - listH); val sc = scroll.step(dt)
        val top = y + head
        g.save(); g.clip(0f, top, app.w, listH); app.zoneDy = -sc; app.zoneClip = floatArrayOf(0f, top, app.w, listH)
        var acc = 0f
        rows.forEachIndexed { i, (id, _) -> val rowH = heights[i]
            val ry = top + acc - sc; acc += rowH; if (ry + rowH < top || ry > top + listH) return@forEachIndexed
            val down = app.pressed == "row:$id"
            if (down) g.fillRound(8f, ry, app.w - 16, rowH - 4, 16f, t.surface2)
            val ls = wrapped[i]; val ly0 = ry + rowH / 2 + 4 - (ls.size - 1) * 11f
            ls.forEachIndexed { k, l -> g.text(l, Dim.GUTTER + 8, ly0 + k * 22f, Dim.FS_M + 1, if (id in danger) t.alert else t.ink) }
            app.zone("row:$id", 8f, ry + sc, app.w - 16, rowH - 4)
        }
        app.zoneDy = 0f; g.restore()
        if (scroll.max > 0) { val k = listH / total; val bh = listH * k; g.fillRound(app.w - 6, top + (listH - bh) * (sc / scroll.max).coerceIn(0f, 1f), 3f, bh, 1.5f, t.line) }   /* a thin scroll hint */
    }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    override fun tap(id: String) { if (id.startsWith("row:")) { app.closeOverlay(); onPick(id.removePrefix("row:")) } }
}

/** asks before something that cannot be undone (deleting) — the only kind of question the UI asks (plan 6.2) */
class Confirm(val title: String, val body: String, val ok: String, val onOk: () -> Unit) : Overlay() {
    private val pop = Spring(0f, 1f, 300f, 22f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = pop.step(dt)
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val w = minOf(app.w - 48, 340f); val bl = Widgets.wrap(g, body, Dim.FS_S, w - 32); val h = 180f + bl.size * 20f; val x = (app.w - w) / 2; val y = (app.h - h) / 2
        g.save(); g.translate(app.w / 2, app.h / 2); val k = 0.85f + 0.15f * s; g.scale(k, k); g.translate(-app.w / 2, -app.h / 2)
        Widgets.card(g, t, x, y, w, h)
        g.text(title, x + w / 2, y + 44, Dim.FS_L, t.ink, FontKind.UI, Align.CENTER)
        bl.forEachIndexed { i, l -> g.text(l, x + w / 2, y + 76 + i * 20f, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER) }
        app.zone("confirm:body", x, y, w, h)
        val bw = (w - 48) / 2
        Widgets.button(g, app, "confirm:no", x + 16, y + h - 72, bw, 52f, "取消")
        Widgets.button(g, app, "confirm:ok", x + 32 + bw, y + h - 72, bw, 52f, ok, Kind.DANGER)
        g.restore()
    }
    override fun tap(id: String) { when (id) { "confirm:no" -> app.closeOverlay(); "confirm:ok" -> { app.closeOverlay(); onOk() } } }
}
