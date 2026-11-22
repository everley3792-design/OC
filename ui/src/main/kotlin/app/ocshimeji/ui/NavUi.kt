package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.sim.life.Economy
import app.ocshimeji.sim.life.Env
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.town.TownState
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.town.Goods
import app.ocshimeji.sim.town.Weather
import kotlin.math.sin

/**
 * The bottom navigation (R2, plan C-2): five fixed entries — 家、小鎮、住民、收納、紀錄. The home is the root; the other four are
 * screens over it, and switching between them returns to the home first (so 返回 always leads home).
 */
object Nav {
    const val H = 66f
    val TABS = listOf("home" to ("家" to "home"), "town" to ("小鎮" to "town"), "people" to ("住民" to "people"), "storage" to ("收納" to "bag"), "records" to ("紀錄" to "list"))
    fun height(app: UiApp) = H + app.insetBottom
    fun draw(g: Gfx, app: UiApp, current: String, badges: Map<String, Int> = emptyMap()) {
        val t = app.theme; val W = app.w; val y = app.h - height(app)
        g.fillRect(0f, y - 1, W, 1f, Colors.withAlpha(t.line, 0.8f))
        g.fillRect(0f, y, W, height(app), Colors.withAlpha(t.surface, 0.97f))
        val w = W / TABS.size
        TABS.forEachIndexed { i, (id, v) -> val (zh, icon) = v; val cx = w * i + w / 2; val on = id == current; val down = app.pressed == "nav:$id"
            if (on) g.fillRound(cx - 26, y + 7, 52f, 30f, 15f, Colors.mix(t.select, t.surface, 0.35f))
            Widgets.icon(g, icon, cx, y + 22 + (if (down) 1f else 0f), 17f, if (on) t.ink else t.ink3)
            g.text(zh, cx, y + 54, 11f, if (on) t.ink else t.ink3, FontKind.UI, Align.CENTER)
            badges[id]?.takeIf { it > 0 }?.let { n -> g.fillCircle(cx + 16, y + 12, 8f, t.alert); g.text("${minOf(99, n)}", cx + 16, y + 16, 10f, t.onAlert, FontKind.NUM, Align.CENTER) }
            app.zone("nav:$id", w * i, y, w, H) }
    }
    /** handle a nav tap from any screen of this world; true = handled */
    fun tap(app: UiApp, ws: WorldScreen, id: String): Boolean {
        if (!id.startsWith("nav:")) return false
        val to = id.removePrefix("nav:")
        while (app.screen !== ws && app.screens.size > 1) app.pop()
        if (ws.placing) ws.setPlacing(false)
        when (to) { "town" -> app.push(TownScreen(ws)); "people" -> app.push(ResidentsPage(ws)); "storage" -> app.push(StoragePage(ws)); "records" -> app.push(JournalHub(ws)) }
        app.transition("fade"); return true
    }
    fun badges(ws: WorldScreen) = mapOf("records" to ws.sim.society.unreadMail() + ws.sim.journal.ACHIEVEMENTS.count { ws.sim.journal.claimable(it) }, "people" to ws.sim.life.people.count { it.worry?.shown == true || it.ask != null })
}

/** 環境面板 (R2, plan B-4): the clock, its speed and a pause; the hour (game time); today's weather including special skies; the season */
class EnvSheet(val ws: WorldScreen) : Overlay() {
    private val slide = Spring(0f, 1f)
    private val scroll = Scroller()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val G = Dim.GUTTER; val W = app.w; val sim = ws.sim; val life = sim.life; val env = life.env
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, (s * 0.4f).coerceIn(0f, 1f)))
        val hh = minOf(app.h - app.insetTop - 30, 600f + app.insetBottom); val y = app.h - hh * s
        g.fillRound(0f, y, W, hh + 40, Dim.RADIUS_L, t.surface); g.fillRound(W / 2 - 20, y + 10, 40f, 5f, 3f, t.line); app.zone("env:body", 0f, y, W, hh)
        g.text("環境", G + 4, y + 44, Dim.FS_L, t.ink)
        g.text("${ws.timeText()}・${Weather.SEASON_ZH[sim.season()]}天・${Env.zh(sim.sky())}" + if (env.paused) "・暫停中" else "", G + 4, y + 68, Dim.FS_S, t.ink2)
        val top = y + 84; val listH = hh - 84 - app.insetBottom
        scroll.max = maxOf(0f, 560f - listH); val sc = scroll.step(dt)
        g.save(); g.clip(0f, top, W, listH); app.zoneDy = -sc; g.translate(0f, -sc)
        var yy = top
        fun head(s0: String) { g.text(s0, G + 4, yy + 16, Dim.FS_S, t.ink3); yy += 26 }
        fun chips(items: List<Pair<String, String>>, on: (String) -> Boolean) { var x = G
            for ((id, zh) in items) { val w0 = g.measure(zh, Dim.FS_S + 1) + 28; if (x + w0 > W - G) { x = G; yy += 46 }; x += Widgets.chip(g, app, id, x, yy, zh, on(id), 38f) + 6 }; yy += 52 }
        head("時間")
        chips(listOf("t:real" to "現實時間", "t:1" to "遊戲 1×", "t:10" to "10×", "t:30" to "30×", "t:60" to "60×", "t:pause" to if (env.paused) "繼續" else "暫停")) { id ->
            when (id) { "t:real" -> life.clockMode == "REAL"; "t:pause" -> env.paused; else -> life.clockMode == "GAME" && life.speed.toInt() == id.removePrefix("t:").toInt() } }
        head("撥到（只有遊戲時間）")
        chips(listOf("j:7" to "早上 7 點", "j:12" to "中午", "j:17" to "傍晚", "j:21" to "晚上", "now" to "回到現在")) { false }
        head("今天的天氣")
        chips(listOf("w:auto" to "自然") + Env.ALL.map { "w:$it" to Env.zh(it) }) { id -> if (id == "w:auto") env.weather[sim.env.day()] == null else env.weather[sim.env.day()] == id.removePrefix("w:") }
        head("季節")
        chips(listOf("s:auto" to "跟著日期") + Weather.SEASON_ZH.map { "s:${it.key}" to "${it.value}天" }) { id -> if (id == "s:auto") env.season.isEmpty() else env.season == id.removePrefix("s:") }
        g.text("你做的每一個改變都會記在存檔裡，同一個存檔重開也一樣。", G + 4, yy + 10, Dim.FS_S - 1, t.ink3)
        app.zoneDy = 0f; g.restore()
    }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    override fun tap(id: String) {
        val sim = ws.sim; val life = sim.life
        val r: String? = when {
            id == "t:real" -> { life.clockMode = "REAL"; life.speed = 1.0; val behind = app.platform.realMinute() - life.minute
                if (behind >= 1) { sim.catchUp(app.platform.realMinute(), summarize = false); "時鐘追上了現在" } else if (behind < -1) "世界比手機快了 ${LifeSim.fmtSpan(-behind)}：時間先停著，等手機追上" else "現實時間" }
            id == "t:pause" -> { sim.env.setPaused(!life.env.paused); null }
            id.startsWith("t:") -> { life.clockMode = "GAME"; life.speed = id.removePrefix("t:").toDouble(); "遊戲時間 ${life.speed.toInt()}×" }
            id.startsWith("j:") -> sim.env.jumpTo(id.removePrefix("j:").toDouble())
            id == "now" -> { val behind = app.platform.realMinute() - life.minute
                if (behind >= 1) { sim.catchUp(app.platform.realMinute(), summarize = false); life.clockMode = "REAL"; life.speed = 1.0; "回到現在了" } else { life.clockMode = "REAL"; life.speed = 1.0; if (behind < -1) "世界比手機快：等手機追上" else "現在就是現在" } }
            id == "w:auto" -> sim.env.setWeather(null)
            id.startsWith("w:") -> sim.env.setWeather(id.removePrefix("w:"))
            id == "s:auto" -> sim.env.setSeason(null)
            id.startsWith("s:") -> sim.env.setSeason(id.removePrefix("s:"))
            else -> return
        }
        r?.let { app.toast(it) }; ws.flush()
    }
}

/** item pictures for the storage grid (R2): drawn shapes, original; anything unknown gets a soft tile with its first character */
object ItemArt {
    fun draw(g: Gfx, t: Theme, life: app.ocshimeji.sim.life.Life, id: String, cx: Float, cy: Float, s: Float, app: UiApp? = null) {
        val u = s / 40f
        fun c(hex: Long) = hex.toInt()
        if (id.startsWith("d:")) { g.fillCircle(cx, cy, 16 * u, c(0xFFF3E6D2)); Widgets.icon(g, when (id) { "d:blanket" -> "bed"; "d:plant" -> "plant"; else -> "note" }, cx, cy, 20 * u, t.ink2); return }   /* desktop things */
        when (id) {
            "pudding", "m:honey" -> { g.fillRound(cx - 14 * u, cy - 6 * u, 28 * u, 20 * u, 8 * u, c(0xFFF8D888)); g.fillRound(cx - 12 * u, cy - 12 * u, 24 * u, 9 * u, 4 * u, c(0xFFA0603A)); g.fillRound(cx - 16 * u, cy + 12 * u, 32 * u, 4 * u, 2 * u, c(0xFFFFFFFF)) }
            "onigiri", "m:bread" -> { g.fillCircle(cx, cy, 16 * u, c(0xFFE8DCC8)); g.fillCircle(cx, cy, 15 * u, c(0xFFFFFCF4)); g.fillRound(cx - 8 * u, cy + 2 * u, 16 * u, 12 * u, 2 * u, c(0xFF3A4A3A)) }
            "cake", "e:petal" -> { g.fillRound(cx - 14 * u, cy - 4 * u, 28 * u, 18 * u, 4 * u, c(0xFFFFF4E8)); g.fillRect(cx - 14 * u, cy + 3 * u, 28 * u, 3 * u, c(0xFFF6B2C8)); g.fillCircle(cx, cy - 8 * u, 5 * u, c(0xFFE04050)) }
            "tea", "coffee", "e:cocoa", "juice" -> { val liq = when (id) { "tea" -> 0xFFB8D890; "coffee" -> 0xFF6B4A35; "juice" -> 0xFFF8A040; else -> 0xFF8A5A40 }; g.fillRound(cx - 11 * u, cy - 10 * u, 22 * u, 24 * u, 5 * u, c(0xFFFFFDF7)); g.fillRect(cx - 9 * u, cy - 7 * u, 18 * u, 6 * u, c(liq)); g.strokeRound(cx + 10 * u, cy - 4 * u, 7 * u, 9 * u, 3 * u, 2.5f * u, c(0xFFFFFDF7)) }
            "chips" -> { g.fillRound(cx - 12 * u, cy - 15 * u, 24 * u, 30 * u, 5 * u, c(0xFFE04A3A)); g.fillCircle(cx, cy, 6 * u, c(0xFFFFD866)) }
            "berry", "v:tomato", "w:berry" -> for ((dx, dy) in listOf(-6f to 2f, 6f to 2f, 0f to -6f)) { g.fillCircle(cx + dx * u, cy + dy * u, 7 * u, c(if (id == "v:tomato") 0xFFE84A3A else 0xFFE04050)); g.fillCircle(cx + dx * u, cy + dy * u - 6 * u, 2 * u, c(0xFF5EA56E)) }
            "ramen" -> { g.fillRound(cx - 13 * u, cy - 10 * u, 26 * u, 24 * u, 4 * u, c(0xFFFFFDF7)); g.fillRect(cx - 13 * u, cy - 3 * u, 26 * u, 6 * u, c(0xFFE04A3A)) }
            "choco" -> { g.fillRound(cx - 14 * u, cy - 10 * u, 28 * u, 20 * u, 3 * u, c(0xFF6B4030)); for (i in 0..2) g.fillRect(cx - 14 * u + i * 9.3f * u, cy - 10 * u, 1.2f * u, 20 * u, c(0xFF4A2A20)) }
            "bun" -> { g.fillCircle(cx, cy + 2 * u, 14 * u, c(0xFFFFF4E4)); g.line(cx - 4 * u, cy - 8 * u, cx + 4 * u, cy - 8 * u, 2 * u, c(0xFFE0D0B8)) }
            "candy", "m:jam" -> { g.fillCircle(cx, cy, 10 * u, c(0xFFF6B2C8)); g.fillCircle(cx - 4 * u, cy - 4 * u, 3 * u, c(0xFFFFFFFF)) }
            "v:carrot" -> { g.line(cx - 10 * u, cy + 12 * u, cx + 8 * u, cy - 8 * u, 9 * u, c(0xFFF08A3A)); g.fillCircle(cx + 11 * u, cy - 11 * u, 5 * u, c(0xFF5EA56E)) }
            "v:pea", "m:pickle" -> { g.fillRound(cx - 14 * u, cy - 6 * u, 28 * u, 12 * u, 6 * u, c(0xFF7CC48A)); for (i in -1..1) g.fillCircle(cx + i * 8 * u, cy, 3.5f * u, c(0xFFA8E0A0)) }
            "v:pumpkin", "e:yam" -> { g.fillCircle(cx - 6 * u, cy + 2 * u, 11 * u, c(0xFFF09A3A)); g.fillCircle(cx + 6 * u, cy + 2 * u, 11 * u, c(0xFFF09A3A)); g.fillCircle(cx, cy + 2 * u, 11 * u, c(0xFFF4A848)); g.fillRect(cx - 1.5f * u, cy - 14 * u, 3 * u, 6 * u, c(0xFF5EA56E)) }
            "w:flower" -> { for (k in 0 until 5) { val a = k * 1.2566f; g.fillCircle(cx + kotlin.math.cos(a) * 7 * u, cy + kotlin.math.sin(a) * 7 * u, 5 * u, c(0xFFF6B2C8)) }; g.fillCircle(cx, cy, 4 * u, c(0xFFFFD866)) }
            "w:stone" -> { g.fillRound(cx - 13 * u, cy - 8 * u, 26 * u, 18 * u, 9 * u, c(0xFFA8B4C8)); g.fillCircle(cx - 4 * u, cy - 3 * u, 3 * u, c(0xFFE8F0FF)) }
            "w:acorn", "w:shell" -> { g.fillCircle(cx, cy + 3 * u, 9 * u, c(0xFFC08A50)); g.fillRound(cx - 10 * u, cy - 9 * u, 20 * u, 9 * u, 4 * u, c(0xFF8A5A30)) }
            "w:leaf" -> { g.fillRound(cx - 12 * u, cy - 7 * u, 24 * u, 14 * u, 7 * u, c(0xFFE06A3A)); g.line(cx - 12 * u, cy, cx + 12 * u, cy, 1.5f * u, c(0xFFA04020)) }
            "e:ice" -> { g.fillRound(cx - 12 * u, cy - 4 * u, 24 * u, 16 * u, 4 * u, c(0xFFB8E0F8)); g.fillCircle(cx, cy - 6 * u, 10 * u, c(0xFFF8C8D8)) }
            else -> {
                val kind = if (id.startsWith("f:")) id.removePrefix("f:") else if (id.startsWith("item:")) id else ""
                val img = if (id.startsWith("item:")) life.items.firstOrNull { "item:" + it.id == id }?.image?.takeIf { it.isNotBlank() }?.let { p -> app?.assets?.decode("lib:${p.removePrefix("lib:")}@128", 128) { app.saves.readFile(p.removePrefix("lib:")) } } else null
                if (img != null) { val k = minOf(s * 0.8f / img.w, s * 0.8f / img.h); g.image(img, cx - img.w * k / 2, cy - img.h * k / 2, img.w * k, img.h * k); return }
                if (kind.isNotEmpty() && !kind.startsWith("item:")) { furniture(g, t, kind, cx, cy, u); return }
                g.fillRound(cx - 15 * u, cy - 15 * u, 30 * u, 30 * u, 10 * u, t.surface2); g.text(Economy.nameOf(life, id).take(1), cx, cy + 6 * u, 16 * u, t.ink2, FontKind.UI, Align.CENTER)
            }
        }
    }
    /** a small furniture icon */
    private fun furniture(g: Gfx, t: Theme, kind: String, cx: Float, cy: Float, u: Float) {
        fun c(hex: Long) = hex.toInt()
        when (kind) {
            "bed", "bed2" -> { g.fillRound(cx - 15 * u, cy - 6 * u, 30 * u, 16 * u, 4 * u, c(0xFFFBF6EE)); g.fillRound(cx - 15 * u, cy + 2 * u, 30 * u, 8 * u, 4 * u, c(0xFFF6B2A8)); g.fillRound(cx - 15 * u, cy - 12 * u, 30 * u, 7 * u, 3 * u, c(0xFFA8703F)) }
            "sofa", "bench" -> { g.fillRound(cx - 15 * u, cy - 10 * u, 30 * u, 10 * u, 4 * u, c(0xFF6CB596)); g.fillRound(cx - 15 * u, cy - 2 * u, 30 * u, 12 * u, 4 * u, c(0xFF8ED1B4)) }
            "table" -> { g.fillRound(cx - 15 * u, cy - 6 * u, 30 * u, 6 * u, 2 * u, c(0xFFD9A472)); g.fillRect(cx - 12 * u, cy, 3 * u, 12 * u, c(0xFFA8703F)); g.fillRect(cx + 9 * u, cy, 3 * u, 12 * u, c(0xFFA8703F)) }
            "shelf" -> { g.fillRound(cx - 11 * u, cy - 15 * u, 22 * u, 30 * u, 2 * u, c(0xFFC98F5E)); for (i in 0..2) g.fillRect(cx - 8 * u, cy - 11 * u + i * 9 * u, 16 * u, 6 * u, c(listOf(0xFFF6B2A8, 0xFF9DC8EE, 0xFF8ED1B4)[i])) }
            "plant", "garden" -> { g.fillRound(cx - 7 * u, cy + 2 * u, 14 * u, 12 * u, 3 * u, c(0xFFD9774E)); g.fillCircle(cx - 5 * u, cy - 4 * u, 7 * u, c(0xFF5EA56E)); g.fillCircle(cx + 5 * u, cy - 6 * u, 7 * u, c(0xFF7CC48A)) }
            "lamp", "lantern" -> { g.fillRect(cx - 1 * u, cy - 8 * u, 2 * u, 20 * u, c(0xFF8A7A70)); g.fillRound(cx - 9 * u, cy - 16 * u, 18 * u, 12 * u, 4 * u, c(if (kind == "lantern") 0xFFF6B2A8 else 0xFFFBE3A8)) }
            "rug" -> g.fillRound(cx - 16 * u, cy - 9 * u, 32 * u, 18 * u, 9 * u, c(0xFFC9B8E8))
            "tv" -> { g.fillRound(cx - 14 * u, cy - 11 * u, 28 * u, 18 * u, 3 * u, c(0xFF5B4A52)); g.fillRound(cx - 12 * u, cy - 9 * u, 24 * u, 14 * u, 2 * u, c(0xFF9DC8EE)) }
            "mirror" -> { g.fillRound(cx - 8 * u, cy - 14 * u, 16 * u, 28 * u, 8 * u, c(0xFFE8C27A)); g.fillRound(cx - 6 * u, cy - 12 * u, 12 * u, 24 * u, 6 * u, c(0xFFCFE9F3)) }
            "line" -> { g.line(cx - 14 * u, cy - 8 * u, cx + 14 * u, cy - 8 * u, 1.5f * u, t.ink2); g.fillRound(cx - 10 * u, cy - 8 * u, 8 * u, 12 * u, 2 * u, c(0xFF9DC8EE)); g.fillRound(cx + 2 * u, cy - 8 * u, 8 * u, 12 * u, 2 * u, c(0xFFF6B2A8)) }
            else -> g.fillRound(cx - 13 * u, cy - 10 * u, 26 * u, 20 * u, 4 * u, c(0xFFD9A472))
        }
    }
}

/** 收納 (R2, plan C-3): everything you have, as a grid with pictures; tap one for what you can do with it */
class StoragePage(val ws: WorldScreen) : Screen() {
    override val animating get() = true
    private var tab = "all"
    private val scroll = Scroller()
    private val TABS = listOf("all" to "全部", "food" to "食物", "furn" to "家具", "work" to "作品", "found" to "撿到的")
    private fun group(id: String) = when { Goods.ALL[id]?.kind == "food" -> "food"; id.startsWith("f:") -> "furn"; id.startsWith("item:") -> "work"; id.startsWith("w:") -> "found"; else -> "work" }
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER; val life = ws.sim.life
        ws.driveElsewhere(dt)
        g.fillRect(0f, 0f, W, H, t.bg)
        g.text("收納", G + 4, top + 42, Dim.FS_L, t.ink)
        wallet(g, app, ws, W - G - 104, top + 14)
        var x = G; for ((k, zh) in TABS) x += Widgets.chip(g, app, "tab:$k", x, top + 64, zh, tab == k, 36f) + 6
        // quick links
        val links = listOf("ledger" to "帳本", "decor" to "壁紙地板音樂", "place" to "擺家具", "book" to "圖鑑")
        x = G; val ly = top + 110; for ((k, zh) in links) x += Widgets.chip(g, app, k, x, ly, zh, false, 34f) + 6
        val items = life.bag.entries.filter { tab == "all" || group(it.key) == tab }.sortedBy { group(it.key) + Economy.nameOf(life, it.key) }
        val listTop = top + 156; val listH = H - listTop - Nav.height(app); val cols = 3; val cw = (W - G * 2 - 16) / cols; val ch = cw + 28
        scroll.max = maxOf(0f, ((items.size + cols - 1) / cols) * (ch + 8) - listH + 10); val sc = scroll.step(dt)
        if (items.isEmpty()) g.text(if (life.bag.isEmpty()) "收納是空的：在小鎮的店裡買東西、撿東西、或委託住民做" else "這一類還沒有東西", W / 2, listTop + 60, Dim.FS_S + 1, t.ink3, FontKind.UI, Align.CENTER)
        g.save(); g.clip(0f, listTop, W, listH); app.zoneDy = -sc; g.translate(0f, -sc)
        items.forEachIndexed { i, (id, n) -> val cx0 = G + (i % cols) * (cw + 8); val cy0 = listTop + (i / cols) * (ch + 8); val down = app.pressed == "it:$id"
            Widgets.card(g, t, cx0, cy0, cw, ch, 18f, t.surface, t.lip, if (down) Dim.LIP - 1 else 0f)
            ItemArt.draw(g, t, life, id, cx0 + cw / 2, cy0 + cw / 2 - 2, cw * 0.62f, app)
            g.text(Widgets.fit(g, Economy.nameOf(life, id), Dim.FS_S, cw - 12), cx0 + cw / 2, cy0 + ch - 12, Dim.FS_S, t.ink, FontKind.UI, Align.CENTER)
            if (n > 1) { g.fillRound(cx0 + cw - 34, cy0 + 8, 26f, 20f, 10f, t.surface2); g.text("×$n", cx0 + cw - 21, cy0 + 23, 11f, t.ink2, FontKind.NUM, Align.CENTER) }
            app.zone("it:$id", cx0, cy0, cw, ch) }
        app.zoneDy = 0f; g.restore()
        Nav.draw(g, app, "storage", Nav.badges(ws))
    }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    override fun back(): Boolean { app.pop(); return true }
    override fun tap(id: String) {
        if (Nav.tap(app, ws, id)) return
        when {
            id.startsWith("tab:") -> { tab = id.removePrefix("tab:"); scroll.reset() }
            id == "ledger" -> app.push(LedgerPage(ws)); id == "book" -> app.push(BookPage(ws)); id == "decor" -> app.show(DecorSheet(ws))
            id == "place" -> { app.pop(); ws.setPlacing(true) }
            id.startsWith("it:") -> app.show(ItemSheet(ws, id.removePrefix("it:")))
        }
    }
}

/** one thing in storage: a big picture, what it is, where it came from, what you can do with it */
class ItemSheet(val ws: WorldScreen, val item: String) : Overlay() {
    private val slide = Spring(0f, 1f)
    private fun actions(): List<Pair<String, String>> { val g = Goods.ALL[item]; val furn = item.startsWith("f:") || ws.sim.decorate.placeable().any { it.first == item }
        return buildList { if (g?.kind == "food" || ws.sim.foodOf(item) != null) { add("feed" to "給誰吃"); add("drag" to "拿到家裡，拖給誰") }; if (furn) add("place" to "擺到家裡")
            if (item.startsWith("item:") || item.startsWith("f:") || item.startsWith("w:")) { add("stall" to "放上市集攤位"); add("corner" to "放到公共角落") } } }
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val G = Dim.GUTTER; val W = app.w; val life = ws.sim.life
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, (s * 0.4f).coerceIn(0f, 1f)))
        val acts = actions(); val hh = 236f + maxOf(1, acts.size) * 60f + app.insetBottom; val y = app.h - hh * s
        g.fillRound(0f, y, W, hh + 40, Dim.RADIUS_L, t.surface); g.fillRound(W / 2 - 20, y + 10, 40f, 5f, 3f, t.line); app.zone("is:body", 0f, y, W, hh)
        g.fillRound(G, y + 28, 120f, 120f, 26f, t.surface2); ItemArt.draw(g, t, life, item, G + 60, y + 88, 96f, app)
        g.text(Widgets.fit(g, Economy.nameOf(life, item), Dim.FS_L, W - G * 2 - 140), G + 136, y + 60, Dim.FS_L, t.ink)
        val good = Goods.ALL[item]
        val desc = when { good?.kind == "food" -> "食物・${good.taste}・飽足 ${good.full.toInt()}"; item.startsWith("f:") -> "家具・${Furniture.kind(item.removePrefix("f:")).w}×${Furniture.kind(item.removePrefix("f:")).h} 格"; item.startsWith("w:") -> "在公園撿到的"; else -> "你的作品" }
        g.text(desc, G + 136, y + 86, Dim.FS_S, t.ink2); g.text("有 ${ws.sim.economy.count(item)} 個", G + 136, y + 110, Dim.FS_S, t.ink2)
        val from = life.ledger.lastOrNull { it.item == item && it.qty > 0 }?.reason ?: ""
        if (from.isNotEmpty()) g.text(Widgets.fit(g, "來源：$from", Dim.FS_S - 1, W - G * 2), G + 4, y + 176, Dim.FS_S - 1, t.ink3)
        acts.forEachIndexed { i, (k, zh) -> Widgets.button(g, app, "ia:$k", G, y + 196 + i * 60f, W - G * 2, 52f, zh, if (i == 0) Kind.PRIMARY else Kind.SECONDARY) }
        if (acts.isEmpty()) g.text("這個東西放著收藏就好", W / 2, y + 220, Dim.FS_S + 1, t.ink3, FontKind.UI, Align.CENTER)
    }
    override fun tap(id: String) {
        val sim = ws.sim
        when (id) {
            "ia:feed" -> { val who = sim.life.people.filter { !it.desk && it.out == null }
                app.show(ListSheet("給誰吃？", who.map { it.id to it.name + "（飽足 ${it.need(Need.FOOD).toInt()}）" }) { pid -> val r = sim.feed(pid, item); if (r.isNotEmpty()) app.toast(r) else app.toast("${sim.person(pid)?.name}吃了"); ws.flush() }) }
            "ia:place" -> { app.closeOverlay(); while (app.screen !== ws && app.screens.size > 1) app.pop(); ws.setPlacing(true, item) }
            "ia:drag" -> { app.closeOverlay(); while (app.screen !== ws && app.screens.size > 1) app.pop(); ws.setGiving(item) }
            "ia:stall" -> { val base = sim.townLife.basePrice(item)
                app.show(ListSheet("標價", listOf(base * 2 / 3, base, base * 3 / 2, base * 2).map { "${it.coerceAtLeast(1)}" to "${it.coerceAtLeast(1)} 星幣" + if (it == base) "（建議）" else "" }) { pr -> sim.townLife.list(item, pr.toInt())?.let { app.toast(it) } ?: run { app.toast("擺上攤位了"); ws.flush() } }) }
            "ia:corner" -> app.show(ListSheet("放到哪裡？", TownState.CORNERS.filterKeys { !sim.life.town.corners.containsKey(it) }.map { it.key to it.value }) { k -> sim.townLife.putCorner(k, item)?.let { app.toast(it) } ?: run { app.toast("放好了"); ws.flush() } })
        }
    }
}

/** 住民 (R2): everyone in this home at a glance — what they are doing, their mood, worries and requests; tap for their card */
class ResidentsPage(val ws: WorldScreen) : Screen() {
    override val animating get() = true
    private val scroll = Scroller()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER; val sim = ws.sim
        ws.driveElsewhere(dt)
        g.fillRect(0f, 0f, W, H, t.bg)
        g.text("住民", G + 4, top + 42, Dim.FS_L, t.ink); g.text("${sim.life.people.size} 位・${sim.house.zh}", G + 4, top + 64, Dim.FS_S, t.ink2)
        var x = G; for ((k, zh) in listOf("rels" to "關係圖", "lib" to "收藏庫與創角")) x += Widgets.chip(g, app, k, x, top + 80, zh, false, 36f) + 6
        val listTop = top + 128; val listH = H - listTop - Nav.height(app); val rowH = 96f
        scroll.max = maxOf(0f, sim.life.people.size * rowH - listH + 10); val sc = scroll.step(dt)
        g.save(); g.clip(0f, listTop, W, listH); app.zoneDy = -sc; g.translate(0f, -sc)
        sim.life.people.forEachIndexed { i, p -> val y = listTop + i * rowH; val id = "p:${p.id}"
            Widgets.card(g, t, G, y, W - G * 2, rowH - 10, 20f, t.surface, t.lip, if (app.pressed == id) Dim.LIP - 1 else 0f)
            Widgets.face(g, t, app.charImg(ws.libOf(p), 256), G + 40, y + 43, 26f); Widgets.sky(g, t, sim.moodSky(p), G + 62, y + 20, 8f)
            g.text(p.name + (sim.journal.titlesOf(p.id).lastOrNull()?.let { "・${it.zh}" } ?: ""), G + 80, y + 34, Dim.FS_M, t.ink)
            g.text(Widgets.fit(g, ws.doing(p) + "・" + sim.moodLabel(p), Dim.FS_S, W - G * 2 - 100), G + 80, y + 58, Dim.FS_S, t.ink2)
            val note = p.worry?.takeIf { it.shown }?.let { "有煩惱" } ?: p.ask?.let { "有請求" }
            if (note != null) { val nw = g.measure(note, 11f) + 16; g.fillRound(W - G - nw - 12, y + 14, nw, 20f, 10f, t.alert); g.text(note, W - G - 12 - nw / 2, y + 28, 11f, t.onAlert, FontKind.UI, Align.CENTER) }
            app.zone(id, G, y, W - G * 2, rowH - 10) }
        app.zoneDy = 0f; g.restore()
        Nav.draw(g, app, "people", Nav.badges(ws))
    }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    override fun back(): Boolean { app.pop(); return true }
    override fun tap(id: String) {
        if (Nav.tap(app, ws, id)) return
        when {
            id.startsWith("p:") -> app.show(PersonCard(ws, id.removePrefix("p:")))
            id == "rels" -> openWorldRelations(app, ws)
            id == "lib" -> app.push(LibraryScreen())
        }
    }
}
