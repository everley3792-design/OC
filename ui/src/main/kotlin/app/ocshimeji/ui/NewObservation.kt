package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx

/**
 * 開始新的觀察 — M0 version: choose who moves in (the library: for now the preset 肉桂捲; importing comes in M2) and start.
 * The full opening (town name, house type, rooms, relationships, moving-in day) is M1; the sheet says so instead of pretending.
 */
class NewObservationSheet(val created: () -> Unit) : Overlay() {
    private val slide = Spring(0f, 1f)
    private val chosen = LinkedHashSet<String>()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val lib = app.saves.library().chars
        g.fillRect(0f, 0f, app.w, app.h, app.render0(t.scrim, s))
        val rowH = 76f; val h = 176f + lib.size * rowH + 84 + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, app.w, h + 40, Dim.RADIUS_L, t.surface)
        g.fillRound(app.w / 2 - 20, y + 10, 40f, 5f, 3f, t.line)
        app.zone("sheet:body", 0f, y, app.w, h)
        g.text("開始新的觀察", Dim.GUTTER + 4, y + 46, Dim.FS_L, t.ink)
        g.text("選誰要住進來（可以選很多位）", Dim.GUTTER + 4, y + 72, Dim.FS_S, t.ink2)
        Widgets.card(g, t, Dim.GUTTER, y + 88, app.w - Dim.GUTTER * 2, 56f, 16f, t.surface2, t.surface2)
        g.text("命名小鎮、選房型、安排房間在 M1 加入", Dim.GUTTER + 14, y + 112, Dim.FS_S, t.ink2)
        g.text("匯入或自己畫角色在 M2 加入", Dim.GUTTER + 14, y + 134, Dim.FS_S, t.ink2)
        lib.forEachIndexed { i, c ->
            val ry = y + 160 + i * rowH; val on = c.id in chosen; val id = "pick:${c.id}"; val sink = if (app.pressed == id) Dim.LIP - 1 else 0f
            Widgets.card(g, t, Dim.GUTTER, ry, app.w - Dim.GUTTER * 2, rowH - 12, 18f, if (on) t.select else t.surface, if (on) app.mix(t.select) else t.lip, sink)
            val img = app.assets.image(c.image.removePrefix("asset:"), 256)
            Widgets.face(g, t, img, Dim.GUTTER + 34, ry + 32 + sink, 22f)
            g.text(c.name, Dim.GUTTER + 68, ry + 30 + sink, Dim.FS_M + 1, t.ink)
            g.text(listOf(c.species).plus(c.traits.take(2)).joinToString("・") + if (c.source == "preset") "・內建" else "", Dim.GUTTER + 68, ry + 50 + sink, Dim.FS_S, t.ink2)
            if (on) { g.fillCircle(app.w - Dim.GUTTER - 30, ry + 32 + sink, 15f, t.surface); Widgets.icon(g, "check", app.w - Dim.GUTTER - 30, ry + 32 + sink, 14f, t.ink) }
            app.zone(id, Dim.GUTTER, ry, app.w - Dim.GUTTER * 2, rowH - 8)
        }
        val by = y + 160 + lib.size * rowH + 6
        if (chosen.isEmpty()) { g.fillRound(Dim.GUTTER, by, app.w - Dim.GUTTER * 2, 56f, 28f, t.surface2); g.text("先選至少一位住民", app.w / 2, by + 34, Dim.FS_M, t.ink3, FontKind.UI, Align.CENTER) }
        else Widgets.button(g, app, "start", Dim.GUTTER, by, app.w - Dim.GUTTER * 2, 56f, "開始（${chosen.size} 位住民）", Kind.PRIMARY, Dim.FS_L)
    }
    override fun tap(id: String) {
        when {
            id.startsWith("pick:") -> { val c = id.removePrefix("pick:"); if (!chosen.remove(c)) chosen += c }
            id == "start" && chosen.isNotEmpty() -> {
                val n = app.saves.slots().size + 1
                val m = app.saves.create("第 $n 個小鎮", chosen.toList())
                app.closeOverlay(); created(); app.push(WorldScreen(m.id))
            }
        }
    }
}

internal fun UiApp.render0(c: Int, a: Float) = app.ocshimeji.render.Colors.withAlpha(c, a.coerceIn(0f, 1f))
internal fun UiApp.mix(c: Int) = app.ocshimeji.render.Colors.mix(c, 0xFF000000.toInt(), 0.18f)
