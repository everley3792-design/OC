package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.sim.social.Recipes
import app.ocshimeji.sim.social.Tools
import app.ocshimeji.sim.social.Trips
import kotlin.math.min

/**
 * 1.9.0 (R7 last batch) 「家與小鎮」: the recipe book (I-03), the town feed (Q-01), day trips (Q-03), your little tools (Q-02),
 * someone's keepsake cabinet (Q-11). Everything the life keeps goes through `sim.days` (`life/Days`).
 */

/** I-03: what storage can make; a recipe is learned the first time someone cooks it */
class RecipesPage(val ws: WorldScreen) : Page("食譜") {
    override val nav get() = ws to "town"
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val l = Widgets.wrap(g, "收納裡有材料時，會煮飯的人到了吃飯時間就會用它做菜。材料來自菜園、公園和市集。", Dim.FS_S, w - 8, 3)
        l.forEachIndexed { i, s -> g.text(s, x + 4, y + 16 + i * 20f, Dim.FS_S, app.theme.ink2) }; return l.size * 20f + 14
    }
    override fun rows(): List<Row> = Recipes.ALL.values.map { rc -> val known = rc.id in ws.sim.life.days.recipes; val miss = ws.sim.days.missing(rc)
        Row("rc:${rc.id}", rc.zh + if (known) "" else "（還沒做過）", (if (miss.isEmpty()) "材料都有了！" else "還缺：" + miss.joinToString("、")) + "・需要${rc.hint}",
            icon = "food", tint = if (known) 0xFFF8E0A8.toInt() else if (miss.isEmpty()) 0xFFCDE6D6.toInt() else null) }
    override fun tap(id: String) { if (Nav.tap(app, ws, id)) return; if (id == "back") app.pop() }
}

/** Q-01: what everyone posted about their days; tap the heart to like */
class FeedPage(val ws: WorldScreen) : Page("小鎮動態") {
    override val nav get() = ws to "town"
    override fun rows(): List<Row> = emptyList()
    override val empty = ""
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val t = app.theme; val ps = ws.sim.days.feed().take(40); var yy = y
        if (ps.isEmpty()) { Widgets.emptyArt(g, t, x + w / 2, yy + 40); g.text("每天早上，大家會把前一天的事貼上來", x + w / 2, yy + 100, Dim.FS_S, t.ink3, FontKind.UI, Align.CENTER); return 130f }
        for (po in ps) { val p = ws.sim.person(po.who)
            val ls = Widgets.wrap(g, po.text, Dim.FS_S + 1, w - 80, 3); val h = 64f + ls.size * 22f
            Widgets.card(g, t, x, yy, w, h, 18f)
            Widgets.face(g, t, p?.let { app.charImg(ws.libOf(it), 128) }, x + 30, yy + 32, 18f)
            g.text(p?.name ?: "（搬走的人）", x + 58, yy + 28, Dim.FS_S, t.ink2)
            val m0 = ((po.minute % 1440) + 1440) % 1440; g.text("第 ${dayOf(ws, po.minute)} 天 %02d:%02d".format((m0 / 60).toInt(), (m0 % 60).toInt()), x + w - 14, yy + 28, Dim.FS_S - 2, t.ink3, FontKind.UI, Align.RIGHT)
            ls.forEachIndexed { i, l -> g.text(l, x + 58, yy + 52 + i * 22f, Dim.FS_S + 1, t.ink) }
            val liked = "you" in po.likes; val hy = yy + h - 18
            Widgets.heart(g, x + 66, hy, 6f, if (liked) 0xFFF0705A.toInt() else t.lip)
            val who = po.likes.filter { it != "you" }.mapNotNull { ws.sim.person(it)?.name }
            g.text(Widgets.fit(g, (if (liked) "你" + (if (who.isNotEmpty()) "、" else "") else "") + who.joinToString("、") + if (po.likes.isEmpty()) "按個讚吧" else " 說讚", Dim.FS_S - 1, w - 110), x + 80, hy + 5, Dim.FS_S - 1, t.ink2)
            app.zone("lk:${po.id}", x + 44, hy - 20, w - 60, 40f)
            yy += h + 10 }
        return yy - y
    }
    override fun tap(id: String) {
        if (Nav.tap(app, ws, id)) return
        if (id == "back") { app.pop(); return }
        if (id.startsWith("lk:")) { if (ws.sim.days.like(id.removePrefix("lk:").toInt())) { app.platform.sound("pop"); ws.flush() } }
    }
}

/** Q-03: who goes where for the day (they leave in the morning, come back in the evening with a souvenir and a photo) */
class TripPage(val ws: WorldScreen) : Page("一日小旅行") {
    override val nav get() = ws to "town"
    private var place = Trips.ALL.keys.first()
    private val who = LinkedHashSet<String>()
    override fun rows(): List<Row> = emptyList()
    override val empty = ""
    override val primary get() = "go" to "出發"
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val t = app.theme; val sim = ws.sim; var yy = y
        sim.days.trip()?.let { tr -> val pl = Trips.ALL[tr.place]
            Widgets.card(g, t, x, yy, w, 76f, 18f, t.surface2); g.text("${tr.who.mapNotNull { sim.person(it)?.name }.joinToString("、")}正在${pl?.zh ?: ""}", x + 16, yy + 30, Dim.FS_M, t.ink)
            val left = ((tr.until - sim.life.minute) / 60).coerceAtLeast(0.0); g.text("大約 ${"%.1f".format(left)} 小時後回來", x + 16, yy + 56, Dim.FS_S, t.ink2); yy += 90 }
        g.text("去哪裡", x + 4, yy + 16, Dim.FS_S, t.ink2); yy += 24; var cx = x
        for (pl in Trips.ALL.values) { val lb = "${pl.zh}・${pl.cost}"; if (cx + g.measure(lb, Dim.FS_S + 1) + 28 > x + w) { cx = x; yy += 44 }; cx += Widgets.chip(g, app, "pl:${pl.id}", cx, yy, lb, place == pl.id, 38f) + 8 }
        yy += 46; Trips.ALL[place]?.let { pl -> g.text(Widgets.fit(g, "約 ${pl.hours.toInt()} 小時・每人車票 ${pl.cost} 星幣・帶回：${pl.souvenir}" + if (pl.weather.isNotEmpty()) "・晴天或陰天" else "", Dim.FS_S, w - 8), x + 4, yy + 14, Dim.FS_S, t.accentLip) }
        yy += 30; g.text("誰要去", x + 4, yy + 16, Dim.FS_S, t.ink2); yy += 24; cx = x
        for (p in sim.life.people) { if (cx + g.measure(p.name, Dim.FS_S + 1) + 28 > x + w) { cx = x; yy += 44 }; cx += Widgets.chip(g, app, "who:${p.id}", cx, yy, p.name, p.id in who, 38f) + 8 }
        yy += 50
        val why = sim.days.tripProblem(place, who.toList())
        for (l in Widgets.wrap(g, why ?: "可以出發了！回來時會帶紀念品，相簿也會多一張照片。", Dim.FS_S + 1, w - 8, 2)) { g.text(l, x + 4, yy + 16, Dim.FS_S + 1, if (why == null) t.ink else t.ink3); yy += 22 }
        val past = sim.life.days.trips.filter { it.back }.asReversed().take(5)
        if (past.isNotEmpty()) { yy += 14; g.text("去過的地方", x + 4, yy + 16, Dim.FS_S, t.ink2); yy += 24
            for (tr in past) { g.text(Widgets.fit(g, "第 ${dayOf(ws, tr.start)} 天・${Trips.ALL[tr.place]?.zh ?: ""}・${tr.who.mapNotNull { sim.person(it)?.name }.joinToString("、")}", Dim.FS_S, w - 8), x + 4, yy + 16, Dim.FS_S, t.ink); yy += 24 } }
        return yy - y + 10
    }
    override fun tap(id: String) {
        if (Nav.tap(app, ws, id)) return
        when {
            id == "back" -> app.pop()
            id.startsWith("pl:") -> place = id.removePrefix("pl:")
            id.startsWith("who:") -> { val p = id.removePrefix("who:"); if (!who.remove(p)) who += p }
            id == "go" -> { val e = ws.sim.days.startTrip(place, who.toList()); if (e != null) app.toast(e) else { app.platform.sound("chime"); ws.flush(); app.toast("出發了！傍晚回來"); who.clear() } }
        }
    }
}

/** Q-02: four little tools, each once a day */
fun toolsSheet(app: UiApp, ws: WorldScreen) {
    val rows = Tools.ALL.values.map { t -> t.id to (t.zh + "：" + t.desc + if (ws.sim.days.toolReady(t.id)) "" else "（今天用過了）") }
    app.show(ListSheet("神明的小道具", rows, subtitle = "每一樣一天可以用一次") { id -> val m = ws.sim.days.useTool(id); app.platform.sound("chime"); app.toast(m); ws.flush() })
}

/** Q-11: what someone keeps in their cabinet */
class CabinetSheet(val ws: WorldScreen, val pid: String) : Overlay() {
    private val slide = Spring(0f, 1f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val W = app.w; val G = Dim.GUTTER; val p = ws.sim.person(pid) ?: run { app.closeOverlay(); return }
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, (s * 0.4f).coerceIn(0f, 1f)))
        val ks = ws.sim.days.cabinet(pid); val cw = (W - G * 2 - 24) / 3; val rows = ((ks.size + 2) / 3).coerceAtLeast(1)
        val h = min(app.h - app.insetTop - 40, 120f + rows * (cw + 40) + app.insetBottom); val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("cb:body", 0f, y, W, h)
        g.text("${p.name}的收藏櫃", G + 4, y + 40, Dim.FS_L, t.ink); g.text("旅行的紀念品、捨不得用的東西（最多 12 件）", G + 4, y + 64, Dim.FS_S, t.ink2)
        if (ks.isEmpty()) { g.text("還是空的：去旅行、在公園撿東西就會慢慢變多", W / 2, y + 120, Dim.FS_S + 1, t.ink3, FontKind.UI, Align.CENTER); return }
        ks.forEachIndexed { i, k -> val cx = G + (i % 3) * (cw + 12); val cy = y + 84 + (i / 3) * (cw + 40)
            g.fillRound(cx, cy, cw, cw, 16f, 0xFFF3E3C8.toInt()); g.fillRect(cx + 8, cy + cw - 14, cw - 16, 6f, 0xFFC9A878.toInt())
            Widgets.icon(g, k.icon, cx + cw / 2, cy + cw / 2 - 6, cw * 0.32f, t.ink2)
            g.text(Widgets.fit(g, k.zh, Dim.FS_S - 1, cw), cx + cw / 2, cy + cw + 16, Dim.FS_S - 1, t.ink, FontKind.UI, Align.CENTER)
            g.text(Widgets.fit(g, "第 ${k.day} 天", Dim.FS_S - 2, cw), cx + cw / 2, cy + cw + 32, Dim.FS_S - 2, t.ink3, FontKind.UI, Align.CENTER) }
    }
    override fun tap(id: String) {}
}

/** F-13: what the home-screen widget says — the home's name and day, then what each one is doing now (pure, tested) */
object WidgetLines {
    fun doing(sim: app.ocshimeji.sim.life.LifeSim, p: app.ocshimeji.sim.life.Person): String = when {
        p.desk -> "在手機桌面上"
        p.out?.stage == "trip" -> "去${Trips.ALL[p.out!!.place.removePrefix("trip:")]?.zh ?: "旅行"}了"
        p.out != null -> "在小鎮" + (app.ocshimeji.sim.town.Town.act(p.out!!.act)?.zh ?: "")
        sim.asleep(p) -> "在睡覺"
        p.act != null -> "在" + (app.ocshimeji.sim.life.Acts[p.act!!]?.zh ?: "忙")
        else -> "在發呆"
    }
    fun of(sim: app.ocshimeji.sim.life.LifeSim): Pair<String, String> =
        "${sim.life.homeName}・第 ${sim.life.day} 天" to sim.life.people.take(4).joinToString("\n") { "${it.name}${doing(sim, it)}" }.ifBlank { "還沒有人住進來" }
}
