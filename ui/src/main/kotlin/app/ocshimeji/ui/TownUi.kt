package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.house.HouseType
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.life.Economy
import app.ocshimeji.sim.life.Pose
import app.ocshimeji.sim.life.Env as EnvZh
import app.ocshimeji.sim.life.SimEvent
import app.ocshimeji.sim.town.Goods
import app.ocshimeji.sim.town.Town
import app.ocshimeji.sim.town.TownState
import app.ocshimeji.sim.town.Weather
import kotlin.math.min
import kotlin.math.sin

/** weather and seasons on screen (plan J-02): rain, snow, fog over a scene; the grass of each season; the sky of the weather */
object Wx {
    fun icon(w: String) = when (w) { "sunny", "petals" -> "sun"; "cloudy", "aurora" -> "cloud"; "rain", "storm" -> "rain"; "snow" -> "snow"; "fog" -> "fog"; "stars" -> "moon"; else -> "sun" }
    /** the grass under everything, by season */
    fun grass(t: Theme, season: String): Int = when (season) {
        "winter" -> Colors.mix(t.grass, if (t.dark) 0xFF8C8AA8.toInt() else 0xFFF4F6F8.toInt(), 0.62f)
        "autumn" -> Colors.mix(t.grass, 0xFFE0B060.toInt(), 0.38f)
        "spring" -> Colors.mix(t.grass, 0xFFB8E6A0.toInt(), 0.25f)
        else -> t.grass
    }
    fun sky(t: Theme, w: String, light: Float): Int {
        val base = Colors.mix(t.skyTop, if (t.dark) 0xFF141A33.toInt() else 0xFF2E3A66.toInt(), (1 - light) * 0.7f)
        return when (w) { "storm" -> Colors.mix(base, 0xFF4A5266.toInt(), 0.6f); "stars" -> Colors.mix(base, 0xFF1A2050.toInt(), 0.55f); "aurora" -> Colors.mix(base, 0xFF20406A.toInt(), 0.45f); "petals" -> Colors.mix(base, 0xFFF8D8E4.toInt(), 0.3f)
            "rain" -> Colors.mix(base, 0xFF8A94A6.toInt(), 0.45f); "cloudy", "fog" -> Colors.mix(base, 0xFFC4CAD4.toInt(), 0.35f); "snow" -> Colors.mix(base, 0xFFE4E8F0.toInt(), 0.35f); else -> base }
    }
    /** falling rain / snow and drifting fog over the whole screen (screen-side decoration, never touches the life) */
    /** 減少動態 (plan O-04): no falling particles */
    var calm = false
    fun draw(g: Gfx, W: Float, H: Float, w: String, time: Float) {
        when (w) {
            "storm" -> { draw(g, W, H, "rain", time); if (!calm && ((time * 0.37f) % 7f) < 0.12f) g.fillRect(0f, 0f, W, H, Colors.withAlpha(0xFFFFFFFF.toInt(), 0.35f)) }   /* lightning now and then */
            "petals" -> { if (calm) return; for (i in 0 until 40) { val x0 = ((i * 151) % 991) / 991f * W; val y = (((i * 241) % 1013) / 1013f * (H + 20) + time * (40f + (i % 5) * 10)) % (H + 20) - 10
                val x = x0 + sin(time * 1.1f + i) * 16; g.fillRound(x - 3, y - 2, 6f, 4f, 2f, if (i % 3 == 0) 0xFFFFFFFF.toInt() else 0xFFF6B2C8.toInt()) } }
            "stars" -> { for (i in 0 until 30) { val x = ((i * 137) % 997) / 997f * W; val y = ((i * 263) % 1009) / 1009f * H * 0.3f; g.fillCircle(x, y, if (i % 4 == 0) 1.6f else 1f, Colors.withAlpha(0xFFFFFFFF.toInt(), 0.5f + 0.5f * sin(time * 2 + i))) }
                if (!calm) for (k in 0 until 2) { val ph = ((time * 0.5f + k * 0.5f) % 1f); val sx = W * (0.2f + 0.5f * k) + ph * 120; val sy = H * 0.05f + ph * 70; g.line(sx, sy, sx - 30, sy - 18, 2f, Colors.withAlpha(0xFFFFFFFF.toInt(), 1 - ph)) } }
            "aurora" -> for (i in 0 until 3) { val y = H * (0.05f + i * 0.05f) + sin(time * 0.4f + i) * 8; g.fillRound(-40f, y, W + 80, 22f, 11f, Colors.withAlpha(if (i == 1) 0xFF8AF0C8.toInt() else 0xFF9AB8F8.toInt(), 0.22f)) }
            "rain" -> { if (calm) return; val c = Colors.withAlpha(0xFFB8D4EE.toInt(), 0.55f)
                for (i in 0 until 70) { val x0 = ((i * 137) % 997) / 997f * (W + 60) - 30; val sp = 520f + (i % 7) * 40; val y = ((i * 263) % 1009) / 1009f * (H + 40) + time * sp
                    val yy = (y % (H + 40)) - 20; val xx = x0 - (yy * 0.18f); g.line(xx, yy, xx - 4f, yy + 16f, 1.6f, c) } }
            "snow" -> { if (calm) return; val c = Colors.withAlpha(0xFFFFFFFF.toInt(), 0.9f)
                for (i in 0 until 60) { val x0 = ((i * 151) % 991) / 991f * W; val sp = 30f + (i % 5) * 12; val y = (((i * 241) % 1013) / 1013f * (H + 20) + time * sp) % (H + 20) - 10
                    g.fillCircle(x0 + sin(time * 1.3f + i) * 8, y, 1.8f + (i % 3) * 0.8f, c) } }
            "fog" -> for (i in 0 until 5) { val y = H * (0.2f + i * 0.16f); val dx = sin(time * 0.15f + i) * 40
                g.fillRound(-60 + dx, y, W + 120, 46f, 23f, Colors.withAlpha(0xFFF2F2F4.toInt(), 0.16f)) }
        }
    }
}

/**
 * The town (plan 12.11 M6 / H-01): five places on one picture, the road home, who is out and what they are doing. Tap a place to
 * shop, read the board, use the market stall or the public corners; the workshop and moving house are here too. Time keeps
 * running while you look (the same life as the house).
 */
class TownScreen(val ws: WorldScreen) : Screen() {
    override val animating get() = true
    private class Said(val text: String, val born: Float)
    private val said = HashMap<String, Said>()
    private val sim get() = ws.sim
    /** where a place is on screen */
    private fun px(x: Float) = Dim.GUTTER + x * (app.w - Dim.GUTTER * 2)
    private fun py(y: Float) = mapTop + y * mapH
    private val mapTop get() = app.insetTop + 112f
    private val mapH get() = app.h * 0.6f - mapTop + 20
    private val home get() = 0.5f to 1.02f

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        for (e in ws.driveElsewhere(dt)) when (e.kind) {
            "say" -> if (sim.person(e.who)?.out != null) said[e.who] = Said(e.text, app.time)
            "goal" -> app.toast("完成小目標：${e.text}")
        }
        val w = sim.sky(); val season = sim.season(); val lt = ws.light(sim.hour)
        g.fillRect(0f, 0f, W, H, Wx.grass(t, season))
        g.fillGradientV(0f, 0f, W, mapTop + 30, Wx.sky(t, w, lt), Wx.grass(t, season))
        // ---- roads: home → plaza → every place
        val road = Colors.mix(Wx.grass(t, season), if (t.dark) 0xFF8A8296.toInt() else 0xFFF2E2C8.toInt(), 0.7f)
        val plaza = Town.place("plaza")
        g.line(px(home.first), py(home.second), px(plaza.x), py(plaza.y), 22f, road)
        for (p in Town.PLACES) if (p.id != "plaza") g.line(px(plaza.x), py(plaza.y), px(p.x), py(p.y), 18f, road)
        // ---- places
        for (p in Town.PLACES) place(g, t, p.id, px(p.x), py(p.y), season)
        // home at the bottom of the road
        val hx = px(home.first); val hy = py(home.second)
        g.fillRound(hx - 22, hy - 18, 44f, 30f, 6f, t.surface); g.fillRound(hx - 26, hy - 30, 52f, 14f, 6f, t.accent); Widgets.icon(g, "home", hx, hy - 3, 12f, t.ink2)
        g.text(sim.life.homeName.ifBlank { "家" }, hx, hy + 30, Dim.FS_S, t.ink, FontKind.UI, Align.CENTER)
        // ---- who is out
        val out = sim.townLife.inTown()
        out.forEachIndexed { i, (p, o) ->
            val pl = Town.place(o.place); val k = ((o.until - sim.life.minute) / Town.TRAVEL).toFloat().coerceIn(0f, 1f)
            val (fx, fy) = when (o.stage) {
                "go" -> lerp(pl.x, pl.y, home.first, home.second, k)
                "back" -> lerp(home.first, home.second, pl.x, pl.y, k)
                else -> (pl.x + ((i % 3) - 1) * 0.1f) to pl.y
            }
            /* the whole person, walking on the road or doing their thing at the place (feet at cy + 18) */
            val cx = px(fx); val feet = py(fy) + (if (o.stage == "at") 96f else 18f); val CH = 52f; val look = ws.lookOf(p)
            val pose = if (o.stage == "at") Town.act(o.act)?.pose ?: Pose.STAND else Pose.WALK
            val face = if (o.stage == "back") (if (home.first < pl.x) -1 else 1) else if (o.stage == "go") (if (pl.x < home.first) -1 else 1) else 1
            Widgets.footShadow(g, t, cx, feet, CH * 0.5f)
            if (look != null) Actors.draw(g, look, cx, feet, CH, pose, app.time, i * 1.37f, face, 0f, null, false, sim.moodSky(p)) else Widgets.face(g, t, app.charImg(ws.libOf(p), 256), cx, feet - 20, 17f)
            val cy = feet - CH * 0.55f
            g.text(Widgets.fit(g, p.name, 11f, 70f), cx, feet + 14, 11f, t.ink, FontKind.UI, Align.CENTER)
            if (w == "rain") { g.fillRound(cx - 22, feet - CH - 16, 44f, 12f, 6f, 0xFF7AAAD6.toInt()); g.line(cx, feet - CH - 6, cx, feet - CH + 10, 2f, t.ink2) }
            said[p.id]?.let { s -> if (app.time - s.born < 3f) { val tw = min(g.measure(s.text, Dim.FS_S) + 20, W - 40); val bx = (cx - tw / 2).coerceIn(8f, W - tw - 8)
                g.fillRound(bx, cy - 66, tw, 28f, 14f, t.surface); g.text(Widgets.fit(g, s.text, Dim.FS_S, tw - 16), bx + tw / 2, cy - 47, Dim.FS_S, t.ink, FontKind.UI, Align.CENTER) } }
        }
        Wx.draw(g, W, H, w, app.time)
        if (lt < 1f) g.fillRect(0f, 0f, W, H, Colors.withAlpha(0xFF1E2550.toInt(), (1 - lt) * 0.2f))
        // ---- top: back, the name, the weather, the wallet
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back")
        g.text("${sim.life.townName.ifBlank { "小鎮" }}", G + 60, top + 34, Dim.FS_L, t.ink)
        g.text("${Weather.SEASON_ZH[season]}天・${EnvZh.zh(w)}・${ws.timeText()}", G + 60, top + 56, Dim.FS_S, t.ink2)
        Widgets.sky(g, t, Wx.icon(w), W - G - 130, top + 34, 13f)
        wallet(g, app, ws, W - G - 104, top + 14)
        if (sim.weather() == "rain" && sim.env.rainbow()) Widgets.sky(g, t, "rainbow", W / 2, top + 92, 22f)
        // ---- bottom: who is out, the four town things
        val by = H - Nav.height(app) - 146
        Widgets.card(g, t, G, by, W - G * 2, 138f, Dim.RADIUS_L)
        val names = out.map { (p, o) -> p.name + "（" + when (o.stage) { "go" -> "路上"; "back" -> "回家路上"; else -> Town.act(o.act)?.zh ?: "" } + "）" }
        g.text(Widgets.fit(g, if (names.isEmpty()) "現在大家都在家裡" else "在小鎮：" + names.joinToString("、"), Dim.FS_S + 1, W - G * 2 - 32), G + 16, by + 30, Dim.FS_S + 1, t.ink)
        val jobs = sim.life.town.jobs; g.text(Widgets.fit(g, if (jobs.isEmpty()) "點地點：買東西、看布告欄、擺東西" else "工坊：" + jobs.joinToString("、") { j -> "${sim.person(j.maker)?.name ?: ""}在做${sim.life.items.firstOrNull { it.id == j.item }?.name ?: "作品"} ${(j.worked * 100 / j.need).toInt().coerceAtMost(99)}%" }, Dim.FS_S, W - G * 2 - 32), G + 16, by + 52, Dim.FS_S, t.ink2)
        val bw = (W - G * 2 - 24 - 24) / 4
        listOf("stall" to "市集攤位", "work" to "工坊委託", "board" to "布告欄", "move" to "搬家").forEachIndexed { i, (id, s) -> Widgets.button(g, app, id, G + 12 + i * (bw + 8), by + 70, bw, 52f, s, size = Dim.FS_S + 1) }
        Nav.draw(g, app, "town", Nav.badges(ws))
    }
    private fun lerp(ax: Float, ay: Float, bx: Float, by: Float, k: Float) = (ax + (bx - ax) * (1 - k)) to (ay + (by - ay) * (1 - k))
    /** one place, drawn from simple shapes (original) */
    private fun place(g: Gfx, t: Theme, id: String, cx: Float, cy: Float, season: String) {
        val p = HouseView.Pal(t); val down = app.pressed == "place:$id"; val s = if (down) 2f else 0f
        when (id) {
            "plaza" -> { g.fillCircle(cx, cy + s, 46f, Colors.mix(p.base, p.white, 0.4f)); g.fillCircle(cx, cy + s, 22f, p.whiteLip); g.fillCircle(cx, cy - 2 + s, 18f, p.water)
                g.fillCircle(cx, cy - 10 + s - (app.time * 20) % 8, 3f, Colors.withAlpha(p.white, 0.9f))
                for (k in TownState.CORNERS.keys.filter { it.startsWith("plaza") }) sim.life.town.corners[k]?.let { item -> val ox = if (k == "plaza1") 38f else -38f; g.fillRound(cx + ox - 9, cy + 16, 18f, 14f, 4f, p.wood); Widgets.icon(g, "gift", cx + ox, cy + 22, 10f, p.white) } }
            "park" -> { val leaf = when (season) { "autumn" -> 0xFFE09A50.toInt(); "winter" -> p.white; "spring" -> 0xFFF6B2C8.toInt(); else -> p.leaf }
                g.fillRound(cx - 64, cy - 20 + s, 128f, 60f, 30f, Colors.mix(p.leaf, p.leafLip, 0.3f))
                for ((dx, dy) in listOf(-44f to -14f, 40f to -18f, -10f to -30f, 22f to 10f)) { g.fillRect(cx + dx - 2, cy + dy + s, 4f, 14f, p.woodLip); g.fillCircle(cx + dx, cy + dy - 4 + s, 13f, leaf) }
                for (k in listOf("park1", "park2")) sim.life.town.corners[k]?.let { item -> val ox = if (k == "park1") -26f else 50f; g.fillRound(cx + ox - 9, cy + 18, 18f, 14f, 4f, p.wood); Widgets.icon(g, "gift", cx + ox, cy + 24, 10f, p.white) } }
            else -> { val (wall, roof) = when (id) { "grocery" -> p.sun to p.coralLip; "furniture" -> p.white to p.mintLip; else -> p.coral to p.woodLip }
                g.fillRound(cx - 40, cy - 30 + s, 80f, 52f, 6f, Colors.mix(wall, 0xFF000000.toInt(), 0.08f)); g.fillRound(cx - 40, cy - 30 + s, 80f, 48f, 6f, wall)
                g.fillRound(cx - 46, cy - 46 + s, 92f, 20f, 8f, roof)
                for (k in 0 until 4) g.fillRect(cx - 40 + k * 22f, cy - 26 + s, 11f, 6f, if (k % 2 == 0) Colors.withAlpha(p.white, 0.8f) else roof)   /* awning stripes */
                g.fillRound(cx - 10, cy - 4 + s, 20f, 26f, 4f, p.woodLip); g.fillRound(cx - 34, cy - 10 + s, 18f, 14f, 3f, p.glass); g.fillRound(cx + 16, cy - 10 + s, 18f, 14f, 3f, p.glass) }
        }
        val name = Town.place(id).zh; val nw = g.measure(name, Dim.FS_S + 1) + 20
        g.fillRound(cx - nw / 2, cy + 30 + s, nw, 26f, 13f, Colors.withAlpha(t.surface, 0.95f)); g.text(name, cx, cy + 48 + s, Dim.FS_S + 1, t.ink, FontKind.UI, Align.CENTER)
        app.zone("place:$id", cx - 60, cy - 50, 120f, 110f)
    }

    override fun tap(id: String) {
        val tl = sim.townLife
        if (Nav.tap(app, ws, id)) return
        when {
            id == "back" -> app.pop()
            id == "wallet" -> app.show(BoardSheet(ws, false))
            id == "board" -> app.show(BoardSheet(ws, true))
            id == "place:grocery" || id == "place:furniture" -> shop(id.removePrefix("place:"))
            id == "place:plaza" -> app.show(ListSheet("廣場", listOf("board" to "看布告欄", "plaza1" to cornerLabel("plaza1"), "plaza2" to cornerLabel("plaza2")), subtitle = "公共角落：放一件家具或作品，住民經過會注意到") { pick -> if (pick == "board") app.show(BoardSheet(ws, true)) else corner(pick) })
            id == "place:park" -> app.show(ListSheet("公園", listOf("park1" to cornerLabel("park1"), "park2" to cornerLabel("park2")), subtitle = "晴天野餐、雨天踩水坑、冬天堆雪人：住民自己會來") { corner(it) })
            id == "place:cafe" -> { val here = tl.inTown().filter { it.second.place == "cafe" && it.second.stage == "at" }.map { it.first.name }
                app.show(ListSheet("咖啡館", if (here.isEmpty()) listOf("none" to "現在沒有人（住民會自己來，一杯 8 星幣）") else listOf("treat" to "請在場的人喝一杯（${8 * here.size} 星幣）"),
                    subtitle = if (here.isEmpty()) "今天的特調：${listOf("蜂蜜拿鐵", "焦糖奶茶", "柚子氣泡水", "抹茶歐蕾", "熱可可", "黑糖牛奶", "檸檬紅茶")[(Weather.dayOf(sim.life.minute) % 7).toInt()]}" else "在這裡：${here.joinToString("、")}") { pick ->
                    if (pick == "treat") { tl.treat()?.let { app.toast(it) } ?: run { app.platform.sound("chime"); app.toast("大家都很開心"); ws.flush() } } }) }
            id == "stall" -> stall()
            id == "work" -> workshop()
            id == "move" -> moveHouse()
        }
    }
    private fun cornerLabel(k: String) = TownState.CORNERS[k]!! + "：" + (sim.life.town.corners[k]?.let { "放著${Economy.nameOf(sim.life, it)}（收回）" } ?: "空著（放東西）")
    private fun bagRows(filter: (String) -> Boolean = { true }) = sim.life.bag.entries.filter { filter(it.key) }.map { it.key to "${Economy.nameOf(sim.life, it.key)} ×${it.value}" }
    private fun corner(k: String) {
        val tl = sim.townLife
        if (sim.life.town.corners.containsKey(k)) { tl.takeCorner(k); app.toast("收回背包了"); ws.flush(); return }
        val rows = bagRows { !(Goods.ALL[it]?.kind == "food") }
        if (rows.isEmpty()) { app.toast("背包裡沒有可以放的家具或作品"); return }
        app.show(ListSheet("放在${TownState.CORNERS[k]}", rows) { item -> tl.putCorner(k, item)?.let { app.toast(it) } ?: run { app.toast("放好了"); ws.flush() } })
    }
    private fun shop(place: String) {
        val tl = sim.townLife; val stock = tl.stock(place)
        app.show(ListSheet(Town.place(place).zh, stock.map { g -> g.id to "${g.zh}　${g.price} 星幣" + (sim.economy.count(g.id).takeIf { it > 0 }?.let { "（有 $it）" } ?: "") },
            subtitle = "錢包 ${sim.economy.wallet} 星幣・" + if (place == "grocery") "每天換貨" else "每週換貨") { pick ->
            val r = tl.buy(pick); if (r != null) app.toast(r) else { app.platform.sound("chime"); app.toast("買了${Goods.ALL[pick]?.zh}，放進背包"); ws.flush() } })
    }
    private fun stall() {
        val tl = sim.townLife; val life = sim.life
        val rows = life.town.stall.map { (item, price) -> "un:$item" to "收回 ${Economy.nameOf(life, item)}（標價 $price）" } + bagRows { it.startsWith("item:") || it.startsWith("f:") || it.startsWith("w:") }.map { (k, v) -> "sell:$k" to "擺上 $v" }
        if (rows.isEmpty()) { app.toast("背包裡沒有可以賣的：先在工坊委託做一件作品"); return }
        app.show(ListSheet("市集攤位", rows, subtitle = "每天早上結算：標價越接近建議價越容易賣出") { pick ->
            if (pick.startsWith("un:")) { tl.unlist(pick.removePrefix("un:")); ws.flush(); return@ListSheet }
            val item = pick.removePrefix("sell:"); val base = tl.basePrice(item)
            app.show(ListSheet("標價：${Economy.nameOf(life, item)}", listOf(base * 2 / 3, base, base * 3 / 2, base * 2).map { "${it.coerceAtLeast(1)}" to "${it.coerceAtLeast(1)} 星幣" + if (it == base) "（建議）" else "" }) { pr ->
                tl.list(item, pr.toInt())?.let { app.toast(it) } ?: run { app.toast("擺上攤位了"); ws.flush() } })
        })
    }
    private fun workshop() {
        val life = sim.life; val tl = sim.townLife
        if (life.items.isEmpty() && life.town.works.isEmpty()) { app.toast("先在「創作 → 自訂物品」做一個物品，才能委託住民做出來"); return }
        app.show(ListSheet("工坊：要做什麼？", listOf("__works" to "看作品集（做過、賣出、評語）") + life.items.map { it.id to "${it.name}（材料 ${tl.commissionCost(it.id)} 星幣）" + (life.town.works[it.id]?.let { w -> "・做過 ${w.made}" } ?: "") },
            subtitle = "住民會在家裡做幾個小時，做好放進背包") { item ->
            if (item == "__works") { app.push(PortfolioPage(ws)); return@ListSheet }
            val who = life.people.filter { !it.desk }
            app.show(ListSheet("請誰做？", who.map { p -> p.id to p.name + (p.spec.skills.maxByOrNull { it.value }?.let { "（${it.key} ${it.value}）" } ?: "") + if (life.town.jobs.any { it.maker == p.id }) "・忙著" else "" }) { m ->
                tl.commission(item, m)?.let { app.toast(it) } ?: run { app.toast("委託好了"); ws.flush() } })
        })
    }
    private fun moveHouse() {
        val others = Houses.ALL.filter { it.id != sim.life.houseId }
        app.show(ListSheet("搬家：搬去哪裡？", others.map { h -> h.id to "${h.zh}（最多 ${h.capacity} 位）" + if (locked(h)) "・還沒開放" else "" }, subtitle = "家具會收進背包，大家會說說自己的想法") { id ->
            val h = Houses.get(id); if (locked(h)) { app.toast(h.locked); return@ListSheet }
            app.show(MoveSheet(ws, h))
        })
    }
    /** the mansion opens once any home of yours has 5 or more residents */
    private fun locked(h: HouseType) = h.locked.isNotEmpty() && app.saves.slots().none { it.residents.size >= 5 } && sim.life.people.size < 5
}

/** what everyone thinks before moving (plan 12.3), then move */
class MoveSheet(val ws: WorldScreen, val h: HouseType) : Overlay() {
    private val slide = Spring(0f, 1f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val G = Dim.GUTTER; val W = app.w
        val ops = ws.sim.decorate.opinions(h).take(6)
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, (s * 0.4f).coerceIn(0f, 1f)))
        val hh = 170f + ops.size * 56f + app.insetBottom; val y = app.h - hh * s
        g.fillRound(0f, y, W, hh + 40, Dim.RADIUS_L, t.surface); app.zone("mv:body", 0f, y, W, hh)
        g.text("搬到${h.zh}？", G + 4, y + 40, Dim.FS_L, t.ink); g.text(Widgets.fit(g, h.blurb, Dim.FS_S, W - G * 2), G + 4, y + 62, Dim.FS_S, t.ink2)
        ops.forEachIndexed { i, o -> val p = ws.sim.person(o.who) ?: return@forEachIndexed; val ry = y + 80 + i * 56f
            Widgets.face(g, t, app.charImg(ws.libOf(p), 256), G + 24, ry + 24, 18f)
            g.text(p.name + "・" + o.stance, G + 52, ry + 18, Dim.FS_S, t.ink2); g.text(Widgets.fit(g, "「${o.line}」", Dim.FS_S + 1, W - G * 2 - 60), G + 52, ry + 40, Dim.FS_S + 1, t.ink) }
        val bw = (W - G * 2 - 12) / 2; val by = y + hh - app.insetBottom - 72
        Widgets.button(g, app, "mv:no", G, by, bw, 54f, "再想想"); Widgets.button(g, app, "mv:yes", G + bw + 12, by, bw, 54f, "搬家", Kind.PRIMARY)
    }
    override fun tap(id: String) {
        when (id) {
            "mv:no" -> app.closeOverlay()
            "mv:yes" -> { app.closeOverlay(); val r = ws.sim.decorate.moveTo(h, allowLocked = true); if (r != null) app.toast(r) else { ws.flush(); app.toast("搬到${h.zh}了！家具都收進背包"); app.pop() } }
        }
    }
}

/** the wallet chip (top right): coins, tap = goals and the ledger */
fun wallet(g: Gfx, app: UiApp, ws: WorldScreen, x: Float, y: Float) {
    val t = app.theme; val s = "${ws.shownCoins()}"; val w = g.measure(s, Dim.FS_M, FontKind.NUM) + 50; val sink = if (app.pressed == "wallet") Dim.LIP - 1 else 0f   /* 1.5.1: the number rolls */
    Widgets.card(g, t, x + 104 - w, y, w, 40f, 20f, t.surface, t.lip, sink)
    Widgets.icon(g, "coin", x + 104 - w + 20, y + 20 + sink, 14f, 0xFFE0A030.toInt())
    g.text(s, x + 104 - w + 34, y + 27 + sink, Dim.FS_M, t.ink, FontKind.NUM)
    val left = ws.sim.life.goals.count { !it.done }; if (left > 0) { g.fillCircle(x + 100, y + 4, 8f, t.alert); g.text("$left", x + 100, y + 8, 10f, t.onAlert, FontKind.NUM, Align.CENTER) }
    app.zone("wallet", x + 104 - w, y - 4, w, 48f)
}

/** the bulletin board (news) and today's goals (plan I-09, 13.9), with the way to the ledger */
class BoardSheet(val ws: WorldScreen, val news: Boolean) : Overlay() {
    private val slide = Spring(0f, 1f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val G = Dim.GUTTER; val W = app.w; val life = ws.sim.life
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, (s * 0.4f).coerceIn(0f, 1f)))
        val lines = if (news) life.town.news.flatMap { Widgets.wrap(g, it, Dim.FS_S + 1, W - G * 2 - 16, 2) }.take(8) else emptyList()
        val hh = 200f + life.goals.size * 52f + (if (news) 40f + lines.size * 24f else 0f) + app.insetBottom; val y = app.h - hh * s
        g.fillRound(0f, y, W, hh + 40, Dim.RADIUS_L, t.surface); app.zone("bd:body", 0f, y, W, hh)
        g.text(if (news) "布告欄" else "錢包與小目標", G + 4, y + 40, Dim.FS_L, t.ink)
        g.text("錢包 ${ws.sim.economy.wallet} 星幣・背包 ${life.bag.values.sum()} 件", G + 4, y + 62, Dim.FS_S, t.ink2)
        var yy = y + 84
        if (news) { g.text("新聞", G + 4, yy + 14, Dim.FS_S, t.ink3); yy += 26
            if (lines.isEmpty()) { g.text("明天早上會有新的消息", G + 8, yy + 14, Dim.FS_S + 1, t.ink2); yy += 24 }
            lines.forEach { g.text(it, G + 8, yy + 14, Dim.FS_S + 1, t.ink); yy += 24 }; yy += 14 }
        g.text("今天的小目標", G + 4, yy + 14, Dim.FS_S, t.ink3); yy += 24
        if (life.goals.isEmpty()) { g.text("明天早上會有新的小目標", G + 8, yy + 20, Dim.FS_S + 1, t.ink2); yy += 52 }
        for (gl in life.goals) { g.fillRound(G, yy, W - G * 2, 44f, 14f, if (gl.done) Colors.mix(t.select, t.surface, 0.5f) else t.surface2)
            if (gl.done) Widgets.icon(g, "check", G + 22, yy + 22, 14f, t.ink) else g.strokeRound(G + 14, yy + 14, 16f, 16f, 5f, 2f, t.ink3)
            g.text(gl.text, G + 40, yy + 28, Dim.FS_S + 1, if (gl.done) t.ink2 else t.ink); g.text("+${gl.reward}", W - G - 14, yy + 28, Dim.FS_S + 1, t.ink2, FontKind.NUM, Align.RIGHT); yy += 52 }
        val bw = (W - G * 2 - 10) / 2
        Widgets.button(g, app, "bd:ledger", G, y + hh - app.insetBottom - 70, bw, 52f, "背包與帳本"); Widgets.button(g, app, "bd:journal", G + bw + 10, y + hh - app.insetBottom - 70, bw, 52f, "生活紀錄")
    }
    override fun tap(id: String) { if (id == "bd:ledger") { app.closeOverlay(); app.push(LedgerPage(ws)) }; if (id == "bd:journal") { app.closeOverlay(); app.push(JournalHub(ws)) } }
}

/** the bag and every line of the ledger (plan I-01): the wallet always equals the sum of what is written here */
class LedgerPage(val ws: WorldScreen) : Page("背包與帳本") {
    override fun rows(): List<Row> = emptyList()
    override val empty = ""
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val t = app.theme; val life = ws.sim.life; var yy = y
        Widgets.card(g, t, x, yy, w, 72f); Widgets.icon(g, "coin", x + 34, yy + 36, 22f, 0xFFE0A030.toInt())
        g.text("${ws.sim.economy.wallet}", x + 62, yy + 44, Dim.FS_L + 6, t.ink, FontKind.NUM); g.text("星幣", x + w - 16, yy + 44, Dim.FS_S, t.ink2, FontKind.UI, Align.RIGHT); yy += 86
        g.text("背包", x + 4, yy + 16, Dim.FS_S, t.ink3); yy += 26
        if (life.bag.isEmpty()) { g.text("空的：在小鎮的店裡買東西，或委託住民做", x + 8, yy + 16, Dim.FS_S + 1, t.ink2); yy += 30 }
        for ((k, n) in life.bag) { val kind = when { Goods.ALL[k]?.kind == "food" -> "食物：餵給住民"; k.startsWith("f:") -> "家具：在家裡「擺家具」"; else -> "作品" }
            g.fillRound(x, yy, w, 44f, 14f, t.surface); g.text(Economy.nameOf(life, k), x + 16, yy + 28, Dim.FS_S + 1, t.ink); g.text("$kind ×$n", x + w - 14, yy + 28, Dim.FS_S, t.ink2, FontKind.UI, Align.RIGHT); yy += 50 }
        yy += 10; g.text("帳本（最新的在上面）", x + 4, yy + 16, Dim.FS_S, t.ink3); yy += 26
        for (tx in life.ledger.asReversed().take(150)) {
            g.fillRound(x, yy, w, 48f, 14f, t.surface)
            g.text(Widgets.fit(g, tx.reason, Dim.FS_S + 1, w - 110), x + 14, yy + 22, Dim.FS_S + 1, t.ink)
            val m = ((tx.minute % 1440) + 1440) % 1440; g.text("第 ${Weather.dayOf(tx.minute) - Weather.dayOf(life.startMinute) + 1} 天 %02d:%02d".format((m / 60).toInt(), (m % 60).toInt()) + if (tx.qty != 0) "・${if (tx.qty > 0) "+" else ""}${tx.qty} 件" else "", x + 14, yy + 40, 11f, t.ink3)
            if (tx.amount != 0) g.text((if (tx.amount > 0) "+" else "") + tx.amount, x + w - 14, yy + 30, Dim.FS_M, if (tx.amount > 0) t.accentLip else t.ink2, FontKind.NUM, Align.RIGHT)
            yy += 54 }
        return yy - y + 10
    }
    override fun tap(id: String) { if (id == "back") app.pop() }
}

/** placing furniture in the home (plan G-01): the bottom of WorldScreen while it is on */
object Placing {
    fun bar(g: Gfx, app: UiApp, ws: WorldScreen, sel: Int, bagSel: String?) {
        val t = app.theme; val G = Dim.GUTTER; val W = app.w; val by = app.h - app.insetBottom - 176; val d = ws.sim.decorate
        Widgets.card(g, t, G, by, W - G * 2, 164f, Dim.RADIUS_L)
        val pcs = d.pieces()
        val msg = when { bagSel != null -> "點地板，把${Economy.nameOf(ws.sim.life, bagSel)}放上去"; sel >= 0 && sel < pcs.size -> "${Furniture.kind(pcs[sel].kind).zh}：點地板移過去，或收起來"; else -> "點家具選起來，或從下面選背包裡的家具" }
        g.text(Widgets.fit(g, msg, Dim.FS_S + 1, W - G * 2 - 28), G + 14, by + 28, Dim.FS_S + 1, t.ink)
        var x = G + 12; val items = d.placeable()
        if (items.isEmpty()) g.text("背包裡沒有家具：小鎮的家具店每週換貨", G + 14, by + 64, Dim.FS_S, t.ink3)
        for ((k, _) in items) { val label = "${Economy.nameOf(ws.sim.life, k)}×${ws.sim.economy.count(k)}"; if (x + g.measure(label, Dim.FS_S + 1) + 28 > W - G - 8) break
            x += Widgets.chip(g, app, "pl:$k", x, by + 44, label, bagSel == k, 38f) + 6 }
        val bw = (W - G * 2 - 24 - 24) / 4
        Widgets.button(g, app, "pl:undo", G + 12, by + 98, bw, 52f, "復原", size = Dim.FS_S + 1)
        Widgets.button(g, app, "pl:flip", G + 20 + bw, by + 98, bw, 52f, "翻面", size = Dim.FS_S + 1)
        Widgets.button(g, app, "pl:remove", G + 28 + bw * 2, by + 98, bw, 52f, "收起", size = Dim.FS_S + 1)
        Widgets.button(g, app, "pl:done", G + 36 + bw * 3, by + 98, bw, 52f, "完成", Kind.PRIMARY, Dim.FS_S + 1)
        /* the room you are working on: its line and its three scores (plan G-03, P-10) */
        val room = pcs.getOrNull(sel)?.room ?: ws.placeRoom
        ws.sim.house.rooms.firstOrNull { it.id == room }?.let { r -> val (a, b, c) = ws.sim.townLife.roomScore(r.id)
            val s1 = "${r.zh}：${ws.sim.journal.roomLine(r.id)}"; val s2 = "整潔 $a・好看 $b・舒服 $c"; val tw = minOf(maxOf(g.measure(s1, Dim.FS_S), g.measure(s2, Dim.FS_S)) + 32, W - G * 2)
            g.fillRound((W - tw) / 2, by - 58, tw, 50f, 18f, Colors.withAlpha(t.surface, 0.95f))
            g.text(Widgets.fit(g, s1, Dim.FS_S, tw - 20), W / 2, by - 38, Dim.FS_S, t.ink, FontKind.UI, Align.CENTER); g.text(s2, W / 2, by - 17, Dim.FS_S - 1, t.ink2, FontKind.UI, Align.CENTER) }
    }
}
