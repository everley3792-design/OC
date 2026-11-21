package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx

/** a bottom sheet: title, rows (each one tap), slides up with a spring; outside / back closes it */
open class ListSheet(val title: String, val rows: List<Pair<String, String>>, val subtitle: String? = null, val danger: Set<String> = emptySet(), val onPick: (String) -> Unit) : Overlay() {
    private val slide = Spring(0f, 1f)
    /** long lists come in pages (an overlay does not scroll): the last row turns the page */
    private var page = 0
    private fun shown(per: Int): List<Pair<String, String>> {
        if (rows.size <= per) return rows
        val n = per - 1; val pages = (rows.size + n - 1) / n; val p = page % pages
        return rows.drop(p * n).take(n) + ("__next" to "下一頁（${p + 1}／$pages）")
    }
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt)
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val rowH = 56f; val head = if (subtitle != null) 84f else 64f
        val per = ((app.h - app.insetTop - 40 - head - 16 - app.insetBottom) / rowH).toInt().coerceAtLeast(3)
        val rows = shown(per)
        val h = head + rows.size * rowH + 16 + app.insetBottom
        val y = app.h - h * s
        g.fillRound(0f, y, app.w, h + 40, Dim.RADIUS_L, t.surface)
        g.fillRound(app.w / 2 - 20, y + 10, 40f, 5f, 3f, t.line)
        g.text(title, Dim.GUTTER + 4, y + 44, Dim.FS_L, t.ink)
        subtitle?.let { g.text(Widgets.fit(g, it, Dim.FS_S, app.w - 40), Dim.GUTTER + 4, y + 68, Dim.FS_S, t.ink2) }
        app.zone("sheet:body", 0f, y, app.w, h)
        rows.forEachIndexed { i, (id, label) ->
            val ry = y + head + i * rowH; val down = app.pressed == "row:$id"
            if (down) g.fillRound(8f, ry, app.w - 16, rowH - 4, 16f, t.surface2)
            g.text(label, Dim.GUTTER + 8, ry + rowH / 2 + 4, Dim.FS_M + 1, if (id in danger) t.alert else t.ink)
            app.zone("row:$id", 8f, ry, app.w - 16, rowH - 4)
        }
    }
    override fun tap(id: String) { if (id == "row:__next") { page++; return }; if (id.startsWith("row:")) { app.closeOverlay(); onPick(id.removePrefix("row:")) } }
}

/** asks before something that cannot be undone (deleting) — the only kind of question the UI asks (plan 6.2) */
class Confirm(val title: String, val body: String, val ok: String, val onOk: () -> Unit) : Overlay() {
    private val pop = Spring(0f, 1f, 300f, 22f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = pop.step(dt)
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val w = minOf(app.w - 48, 340f); val h = 200f; val x = (app.w - w) / 2; val y = (app.h - h) / 2
        g.save(); g.translate(app.w / 2, app.h / 2); val k = 0.85f + 0.15f * s; g.scale(k, k); g.translate(-app.w / 2, -app.h / 2)
        Widgets.card(g, t, x, y, w, h)
        g.text(title, x + w / 2, y + 44, Dim.FS_L, t.ink, FontKind.UI, Align.CENTER)
        g.text(Widgets.fit(g, body, Dim.FS_S, w - 32), x + w / 2, y + 76, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER)
        app.zone("confirm:body", x, y, w, h)
        val bw = (w - 48) / 2
        Widgets.button(g, app, "confirm:no", x + 16, y + h - 72, bw, 52f, "取消")
        Widgets.button(g, app, "confirm:ok", x + 32 + bw, y + h - 72, bw, 52f, ok, Kind.DANGER)
        g.restore()
    }
    override fun tap(id: String) { when (id) { "confirm:no" -> app.closeOverlay(); "confirm:ok" -> { app.closeOverlay(); onOk() } } }
}
