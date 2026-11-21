package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.save.Presets
import app.ocshimeji.save.SlotMeta

/**
 * The first screen (plan 12.1 「觀察日誌」): every save as a card (newest first) and 「開始新的觀察」 on top.
 * A card opens its world; ⋯ gives 繼續 / 改名 / 複製 / 分支 / 刪除 (only deleting asks first).
 */
class TitleScreen : Screen() {
    private var slots: List<SlotMeta> = emptyList()
    private val scroll = Spring(0f, 0f, 300f, 30f)
    private var dragFrom = 0f; private var dragging = false; private var lastY = 0f; private var vel = 0f; private var maxScroll = 0f
    private val intro = Spring(0f, 1f, 160f, 20f)

    override fun enter() { reload() }
    override fun resume() { reload() }
    fun reload() { slots = app.saves.slots() }
    override val animating: Boolean get() = true   /* the hero breathes */

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop
        if (!dragging) { if (scroll.target < 0) scroll.target = 0f; if (scroll.target > maxScroll) scroll.target = maxScroll; if (kotlin.math.abs(vel) > 1) { scroll.target = (scroll.target + vel * dt).coerceIn(-40f, maxScroll + 40); vel *= 0.92f } }
        val sc = if (dragging) scroll.value else scroll.step(dt); val k = intro.step(dt)
        g.fillRect(0f, 0f, W, H, t.bg)
        g.fillGradientV(0f, 0f, W, top + 330 - sc * 0.5f, t.skyTop, t.skyBottom)
        clouds(g, t, sc)
        g.save(); g.translate(0f, -sc); app.zoneDy = -sc
        // ---- header
        g.text("觀察日誌", W / 2, top + 46, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER)
        g.text("OC Shimeji", W / 2, top + 88, 36f, t.ink, FontKind.NUM, Align.CENTER)
        // ---- hero: the preset character on a little hill (just decoration here; choosing it is in 開始新的觀察)
        val hy = top + 232f
        g.save(); g.translate(W / 2, hy + 8); g.scale(1f, 0.26f); g.fillCircle(0f, 6f, W * 0.62f, t.grassLip); g.fillCircle(0f, 0f, W * 0.62f, t.grass); g.restore()
        Widgets.footShadow(g, t, W / 2, hy, 96f)
        val img = app.assets.image("chars/cinnamon/idle.png", 512)
        g.save(); g.translate(0f, (1 - k) * 30); Widgets.character(g, img, Presets.CINNAMON, W / 2, hy, 120f, app.time); g.restore()
        // ---- list
        var y = hy + 34
        val nw = W - Dim.GUTTER * 2; val down = app.pressed == "new"; val sink = if (down) Dim.LIP - 1 else 0f
        Widgets.card(g, t, Dim.GUTTER, y, nw, 84f, Dim.RADIUS_L, t.accent, t.accentLip, sink)
        g.fillCircle(Dim.GUTTER + 42, y + 42 + sink, 22f, t.surface); Widgets.icon(g, "plus", Dim.GUTTER + 42, y + 42 + sink, 22f, t.accentLip)
        g.text("開始新的觀察", Dim.GUTTER + 78, y + 38 + sink, Dim.FS_L, t.onAccent)
        g.text("選住民，看牠們自己過日子", Dim.GUTTER + 78, y + 62 + sink, Dim.FS_S, t.onAccent)
        app.zone("new", Dim.GUTTER, y, nw, 88f)
        y += 116
        g.text(if (slots.isEmpty()) "你的觀察" else "你的觀察（${slots.size}）", Dim.GUTTER + 4, y, Dim.FS_M, t.ink2)
        y += 14
        if (slots.isEmpty()) {
            Widgets.card(g, t, Dim.GUTTER, y, nw, 84f, Dim.RADIUS_L, t.surface2, t.surface2)
            g.text("還沒有任何觀察。", W / 2, y + 38, Dim.FS_M, t.ink2, FontKind.UI, Align.CENTER)
            g.text("按上面的「開始新的觀察」開始第一個。", W / 2, y + 62, Dim.FS_S, t.ink3, FontKind.UI, Align.CENTER)
            y += 100
        }
        for (s in slots) { slotCard(g, s, y, sc); y += 112 }
        g.text("0.1.0-reboot（M0）", W / 2, y + 30, Dim.FS_S, t.ink3, FontKind.UI, Align.CENTER)
        g.restore(); app.zoneDy = 0f
        maxScroll = maxOf(0f, y + 60 - (H - app.insetBottom))
    }
    private fun slotCard(g: Gfx, s: SlotMeta, y: Float, @Suppress("UNUSED_PARAMETER") sc: Float) {
        val t = app.theme; val x = Dim.GUTTER; val w = app.w - Dim.GUTTER * 2; val h = 96f
        val id = "slot:${s.id}"; val sink = if (app.pressed == id) Dim.LIP - 1 else 0f
        Widgets.card(g, t, x, y, w, h, Dim.RADIUS_L, t.surface, t.lip, sink)
        app.zone(id, x, y, w - 56, h + Dim.LIP)
        // faces
        val faces = s.residents.take(3)
        faces.forEachIndexed { i, lid -> val c = app.saves.libChar(lid); val img = c?.image?.removePrefix("asset:")?.let { app.assets.image(it, 256) }; Widgets.face(g, t, img, x + 36 + i * 22f, y + 48 + sink, 22f) }
        if (faces.isEmpty()) Widgets.face(g, t, null, x + 36, y + 48 + sink, 22f)
        val tx = x + 36 + (maxOf(1, faces.size) - 1) * 22f + 36
        g.text(Widgets.fit(g, s.name, Dim.FS_L, w - (tx - x) - 64), tx, y + 42 + sink, Dim.FS_L, t.ink)
        val sub = "第 ${s.day} 天・${s.residents.size} 位住民・${Format.ago(s.lastPlayed, app.platform.now())}"
        g.text(Widgets.fit(g, sub, Dim.FS_S, w - (tx - x) - 64), tx, y + 68 + sink, Dim.FS_S, t.ink2)
        Widgets.round(g, app, "more:${s.id}", x + w - 32, y + 48, 20f, "more")
    }
    private fun clouds(g: Gfx, t: Theme, sc: Float) {
        val tt = app.time; val top = app.insetTop
        for (i in 0 until 3) { val cx = ((tt * (6 + i * 3) + i * 140) % (app.w + 160)) - 80; val cy = top + 130f + i * 46 - sc * 0.4f
            g.fillCircle(cx, cy, 18f, t.cloud); g.fillCircle(cx + 20, cy - 8, 22f, t.cloud); g.fillCircle(cx + 44, cy, 17f, t.cloud); g.fillRound(cx - 8, cy, 66f, 18f, 9f, t.cloud) }
    }

    override fun tap(id: String) {
        when {
            id == "new" -> app.show(NewObservationSheet { reload() })
            id.startsWith("slot:") -> open(id.removePrefix("slot:"))
            id.startsWith("more:") -> actions(id.removePrefix("more:"))
        }
    }
    fun open(id: String) { val m = app.saves.slot(id) ?: return; app.saves.touch(id); app.push(WorldScreen(m.id)) }
    private fun actions(id: String) {
        val s = app.saves.slot(id) ?: return
        app.show(ListSheet(s.name, listOf("open" to "繼續", "rename" to "改名", "copy" to "複製", "branch" to "分支（從今天開出另一個「如果」）", "delete" to "刪除"),
            subtitle = "第 ${s.day} 天・玩了 ${Format.played(s.playSeconds)}", danger = setOf("delete")) { act ->
            when (act) {
                "open" -> open(id)
                "rename" -> app.platform.prompt("改名", s.name, 20) { n -> if (!n.isNullOrBlank()) { app.saves.rename(id, n); reload(); app.toast("改好了") } }
                "copy" -> { app.saves.copy(id); reload(); app.toast("複製了一份") }
                "branch" -> { app.saves.branch(id); reload(); app.toast("開出了一個「如果」") }
                "delete" -> app.show(Confirm("刪除「${s.name}」？", "這個存檔會消失，無法復原。", "刪除") { app.saves.delete(id); reload(); app.toast("刪除了") })
            }
        })
    }

    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) {
        if (start) { dragFrom = scroll.value; lastY = y; vel = 0f; return }
        dragging = true; val raw = dragFrom - dy
        scroll.snap(if (raw < 0) raw * 0.4f else if (raw > maxScroll) maxScroll + (raw - maxScroll) * 0.4f else raw)
        vel = (lastY - y) * 60f * 0.5f + vel * 0.5f; lastY = y
    }
    override fun release() { dragging = false; scroll.target = scroll.value }
    override fun back(): Boolean = false
}
