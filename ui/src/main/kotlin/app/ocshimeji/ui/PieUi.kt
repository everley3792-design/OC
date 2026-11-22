package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/** one slice: an action (`id`), or a group that opens a second ring (`kids`); `why` = greyed out, and tapping it says why */
class PieItem(val id: String, val zh: String, val icon: String, val why: String? = null, val kids: List<PieItem>? = null)

/**
 * 環狀選單 (R3): tap anything in the house and what can be done with it opens around your finger.
 * At most 8 slices per ring; more = groups (a second ring) and 「更多」 pages. The ring is kept on screen; tap the middle to go back a ring,
 * outside to close. Disabled entries stay visible with their reason (plan: no fake buttons, but no hidden rules either).
 */
class PieMenu(val title: String, cx: Float, cy: Float, items: List<PieItem>, val onPick: (String) -> Unit) : Overlay() {
    private val stack = ArrayList<Pair<String, List<PieItem>>>().apply { add(title to fit(items)) }
    private var pop = Spring(0f, 1f, 320f, 24f)
    private val ax = cx; private val ay = cy
    /** the ring shown now (tests read it) */
    val ring: List<PieItem> get() = stack.last().second
    val level get() = stack.size
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val k = pop.step(dt).coerceIn(0f, 1.1f); val calm = app.saves.flag("a11y:calm")
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, 0.22f * min(1f, k)))
        val items = ring; val n = items.size; val R = if (n <= 4) 84f else 100f; val br = 27f
        val cx = ax.coerceIn(R + br + 18, app.w - R - br - 18); val cy = ay.coerceIn(app.insetTop + R + br + 30, app.h - app.insetBottom - R - br - 40)
        val rr = if (calm) R else R * (0.55f + 0.45f * k)
        // the middle: what this is, and back / close
        g.fillCircle(cx, cy + 3, 38f, t.shadow); g.fillCircle(cx, cy, 38f, t.surface)
        val head = stack.last().first
        Widgets.wrap(g, head, Dim.FS_S - 1, 64f, 2).let { ls -> ls.forEachIndexed { i, l -> g.text(l, cx, cy - 4 + (i - (ls.size - 1) / 2f) * 16 - 6, Dim.FS_S - 1, t.ink, FontKind.UI, Align.CENTER) } }
        Widgets.icon(g, if (stack.size > 1) "back" else "close", cx, cy + 22, 9f, t.ink3)
        app.zone("pie:mid", cx - 38, cy - 38, 76f, 76f)
        items.forEachIndexed { i, it ->
            val ang = -PI / 2 + 2 * PI * i / n; val x = cx + (cos(ang) * rr).toFloat(); val y = cy + (sin(ang) * rr).toFloat()
            val off = it.why != null; val id = "pie:$i"; val sink = if (app.pressed == id) Dim.LIP - 1 else 0f
            g.save(); if (off) g.alpha(0.55f)
            g.fillCircle(x, y + Dim.LIP, br, if (it.kids != null) t.accentLip else t.lip); g.fillCircle(x, y + sink, br, if (it.kids != null) t.accent else t.surface)
            if (it.icon in SKY) Widgets.sky(g, t, it.icon, x, y + sink, 11f) else Widgets.icon(g, it.icon, x, y + sink, 17f, if (it.kids != null) t.onAccent else t.ink2)
            val lw = g.measure(it.zh, Dim.FS_S - 1).coerceAtMost(96f) + 14
            g.fillRound(x - lw / 2, y + br + 2, lw, 22f, 11f, Colors.withAlpha(t.surface, 0.96f))
            g.text(Widgets.fit(g, it.zh, Dim.FS_S - 1, 96f), x, y + br + 18, Dim.FS_S - 1, if (off) t.ink3 else t.ink, FontKind.UI, Align.CENTER)
            g.restore()
            app.zone(id, x - 34, y - 34, 68f, 68f + br)
        }
    }
    override fun tap(id: String) {
        if (id == "pie:mid") { if (stack.size > 1) { stack.removeAt(stack.size - 1); pop = Spring(0.6f, 1f, 320f, 24f) } else app.closeOverlay(); return }
        val it = ring.getOrNull(id.removePrefix("pie:").toIntOrNull() ?: return) ?: return
        if (it.why != null) { app.toast(it.why); app.platform.haptic("tick"); return }
        if (it.kids != null) { stack += it.zh to fit(it.kids); pop = Spring(0.6f, 1f, 320f, 24f); app.platform.sound("tick"); return }
        app.closeOverlay(); app.platform.sound("pop"); onPick(it.id)
    }
    /** tests: tap the slice with this label */
    fun pick(label: String): Boolean { val i = ring.indexOfFirst { it.zh == label }; if (i < 0) return false; tap("pie:$i"); return true }

    companion object {
        const val MAX = 8
        /** weather pictures are drawn by Widgets.sky, not as line icons */
        private val SKY = setOf("sun", "cloud", "rain", "snow", "fog", "moon", "drizzle", "rainbow")
        /** at most MAX per ring: the rest goes behind 「更多」 */
        fun fit(items: List<PieItem>): List<PieItem> =
            if (items.size <= MAX) items else items.take(MAX - 1) + PieItem("more", "更多", "more", kids = items.drop(MAX - 1))
        /** many items → one slice per group (in first-seen order); a group of one is shown as itself */
        fun grouped(items: List<Pair<String, PieItem>>, icon: (String) -> String): List<PieItem> {
            if (items.size <= MAX) return items.map { it.second }
            return items.groupBy({ it.first }, { it.second }).map { (cat, xs) -> if (xs.size == 1) xs[0] else PieItem("cat:$cat", cat, icon(cat), null, xs) }
        }
    }
}
