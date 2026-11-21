package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.save.World

/**
 * One world (a save). M0: the residents stand in a plain room so the save is real (it opens, keeps play time, and is saved on
 * leaving); the house, needs and life arrive in M1 — the card on screen says that plainly.
 */
class WorldScreen(val slotId: String) : Screen() {
    private var world: World? = null
    private var playT = 0f
    private val bounce = HashMap<String, Float>()
    private var said: Pair<String, Float>? = null
    override val animating get() = true
    override fun enter() { world = app.saves.loadWorld(slotId) }
    override fun leave() { flush() }
    override fun pause() { flush() }
    private fun flush() { val w = world ?: return; val s = playT.toLong(); if (s <= 0) return; playT -= s; app.saves.saveWorld(slotId, w, s) }

    override fun frame(g: Gfx, dt: Float) {
        playT += dt
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val w = world
        // room: wall, window, floor
        val floorY = H * 0.58f
        g.fillRect(0f, 0f, W, floorY, t.surface2)
        var sx = 0f; while (sx < W) { g.fillRect(sx, 0f, 14f, floorY, app.render0(t.lip, 0.35f)); sx += 44 }
        g.fillRound(W / 2 - 70, top + 90, 140f, 110f, 18f, t.lip); g.fillRound(W / 2 - 62, top + 98, 124f, 94f, 12f, t.skyTop)
        g.fillRect(0f, floorY, W, H - floorY, t.lip); var fy = floorY + 26; while (fy < H) { g.fillRect(0f, fy, W, 2f, app.render0(t.ink3, 0.25f)); fy += 34 }
        g.fillRect(0f, floorY - 6, W, 8f, app.render0(t.ink3, 0.5f))
        // residents
        val rs = w?.residents ?: emptyList(); val n = maxOf(1, rs.size)
        rs.forEachIndexed { i, r ->
            val c = app.saves.libChar(r.libId) ?: return@forEachIndexed
            val x = W * (i + 1) / (n + 1); val y = floorY + 190
            val b = (bounce[r.id] ?: 0f).let { maxOf(0f, it - dt) }; bounce[r.id] = b
            val hop = if (b > 0) kotlin.math.sin((0.5f - b) / 0.5f * Math.PI.toFloat()) * 26 else 0f
            Widgets.footShadow(g, t, x, y, 90f)
            Widgets.character(g, app.assets.image(c.image.removePrefix("asset:"), 512), c, x, y - hop, 150f, app.time, i * 1.3f)
            app.zone("char:${r.id}", x - 60, y - 160, 120f, 170f)
        }
        said?.let { (text, at) -> if (app.time - at > 2.5f) said = null else { val bw = g.measure(text, Dim.FS_M) + 32; val bx = (W - bw) / 2; val by = floorY - 60
            Widgets.card(g, t, bx, by, bw, 48f, 24f); g.text(text, W / 2, by + 30, Dim.FS_M, t.ink, FontKind.UI, Align.CENTER) } }
        // top bar
        Widgets.round(g, app, "back", Dim.GUTTER + 24, top + 34, 24f, "back")
        val m = app.saves.slot(slotId); val name = m?.name ?: ""
        val pw = minOf(W - 120, g.measure(name, Dim.FS_M) + 36); Widgets.card(g, t, (W - pw) / 2, top + 12, pw, 44f, 22f)
        g.text(Widgets.fit(g, name, Dim.FS_M, pw - 24), W / 2, top + 40, Dim.FS_M, t.ink, FontKind.UI, Align.CENTER)
        // honest status card
        val cy = H - app.insetBottom - 108
        Widgets.card(g, t, Dim.GUTTER, cy, W - Dim.GUTTER * 2, 88f, Dim.RADIUS_L)
        g.text("這是 M0（地基）版本", Dim.GUTTER + 18, cy + 34, Dim.FS_M, t.ink)
        g.text("家、需求與生活在 M1 製作；可以點角色。", Dim.GUTTER + 18, cy + 60, Dim.FS_S, t.ink2)
    }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id.startsWith("char:") -> { val rid = id.removePrefix("char:"); bounce[rid] = 0.5f; app.platform.haptic("soft")
                val r = world?.residents?.firstOrNull { it.id == rid }; if (r != null) said = "${r.name}看著你" to app.time }
        }
    }
}
