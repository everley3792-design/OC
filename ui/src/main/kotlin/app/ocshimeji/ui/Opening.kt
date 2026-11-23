package app.ocshimeji.ui

import app.ocshimeji.sim.social.Scenarios

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import app.ocshimeji.save.ImageCheck
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.chars.Relations
import app.ocshimeji.sim.house.HouseType
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant

/** a vertical list that follows the finger and settles with a spring */
class Scroller {
    private val s = Spring(0f, 0f, 300f, 30f)
    var max = 0f; private var dragging = false; private var from = 0f; private var lastY = 0f; private var vel = 0f
    val value get() = s.value
    fun step(dt: Float): Float {
        if (!dragging) { if (s.target < 0) s.target = 0f; if (s.target > max) s.target = max; if (kotlin.math.abs(vel) > 1) { s.target = (s.target + vel * dt).coerceIn(-40f, max + 40); vel *= 0.92f } }
        return if (dragging) s.value else s.step(dt)
    }
    fun drag(dy: Float, y: Float, start: Boolean) {
        if (start) { from = s.value; lastY = y; vel = 0f; return }
        dragging = true; val raw = from - dy
        s.snap(if (raw < 0) raw * 0.4f else if (raw > max) max + (raw - max) * 0.4f else raw)
        vel = (lastY - y) * 60f * 0.5f + vel * 0.5f; lastY = y
    }
    fun release() { dragging = false; s.target = s.value }
    fun reset() { s.snap(0f); vel = 0f }
    /** jump to a position (tests, "go to section") */
    fun jump(to: Float) { s.snap(to.coerceIn(0f, max)); s.target = s.value; vel = 0f }
    /** follow the end of a growing list (replay) */
    fun toEnd() { if (!dragging) { s.target = max; vel = 0f } }
}

/** draw a house type into a box (centred), with optional faces standing in rooms and room names */
fun drawHousePreview(g: Gfx, app: UiApp, h: HouseType, x: Float, y: Float, w: Float, hh: Float, faces: Map<String, List<Img?>> = emptyMap(), labels: Boolean = false) {
    val v = HouseView(h); val k = minOf(w / (v.width + 16), hh / (v.height + 60))
    val ox = x + (w - v.width * k) / 2; val oy = y + (hh - v.height * k) / 2 + 22 * k
    g.save(); g.translate(ox, oy); g.scale(k, k); v.draw(g, app.theme, app.time, 1f); g.restore()
    for (r in h.rooms) {
        val cx = ox + (r.x + r.w / 2f) * v.T * k; val cy = oy + (r.y + 1 + (r.h - 1) / 2f) * v.T * v.K * k
        val fs = faces[r.id].orEmpty()
        if (labels && r.sleeps > 0) { val s = r.zh; val tw = g.measure(s, 12f) + 14; g.fillRound(cx - tw / 2, cy - (if (fs.isEmpty()) 10f else 34f), tw, 20f, 10f, Colors.withAlpha(app.theme.surface, 0.9f)); g.text(s, cx, cy - (if (fs.isEmpty()) -4f else 20f), 12f, app.theme.ink2, FontKind.UI, Align.CENTER) }
        fs.forEachIndexed { i, img -> Widgets.face(g, app.theme, img, cx + (i - (fs.size - 1) / 2f) * 28f, cy + 4, 13f) }
    }
}

/**
 * 開始新的觀察 (plan 12.2): name the place → choose a house (its rules and how many it holds) → who moves in (the library, or a new
 * character from one picture) → who sleeps where (the rules are checked as you choose) → move-in day.
 * One primary button at the bottom on every step; back goes one step back.
 */
class OpeningScreen : Screen() {
    var step = 0; private set
    var town = "楓糖鎮"; var home = "我們的家"
    var house: HouseType = Houses.COTTAGE
    val chosen = LinkedHashSet<String>()
    val rooms = HashMap<String, String>()
    /** relationships between the chosen characters (library ids) and whether romance is on (plan 12.5) */
    val rels = ArrayList<Rel>(); var romance = false
    /** P-05 (1.8.0): a scenario start — a house, how many, and how everyone knows each other (you can still change it all) */
    var scenario: String? = null
    private val list = Scroller()
    private val enterK = Spring(0f, 1f, 200f, 22f)
    override val animating get() = true
    private val titles = listOf("替這裡取名字", "選一間房子", "誰要住進來？", "安排房間")

    private fun tenants() = chosen.mapNotNull { app.saves.libChar(it) }.map { Tenant(it.id, it.name, it.adult) }
    fun problem(): String? = when (step) {
        1 -> null
        2 -> Houses.check(house, tenants()) ?: scenario?.let { Scenarios.ALL[it] }?.let { sc -> when { chosen.size < sc.min -> "「${sc.zh}」要 ${sc.min} 位以上"; chosen.size > sc.max -> "「${sc.zh}」最多 ${sc.max} 位"; else -> null } }
        3 -> Houses.checkRooms(house, tenants(), rooms) { a, b -> Relations.family(rels, a, b) }
        else -> null
    }

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER; val k = enterK.step(dt)
        g.fillRect(0f, 0f, W, H, t.bg)
        g.fillGradientV(0f, 0f, W, top + 160, t.skyTop, t.bg)
        val btnY = H - app.insetBottom - 76
        val cTop = top + 112
        g.save(); g.translate((1 - k) * 40, 0f); g.alpha(k.coerceIn(0f, 1f))
        when (step) { 0 -> names(g, cTop); 1 -> houses(g, cTop, btnY); 2 -> people(g, cTop, btnY, dt); 3 -> roomsStep(g, cTop, btnY, dt) }
        g.restore()
        // header (drawn last: above scrolled lists)
        g.fillRect(0f, 0f, W, cTop - 8, Colors.withAlpha(t.bg, 0f))
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back")
        for (i in 0 until 4) g.fillRound(W / 2 - 46 + i * 24f, top + 30, if (i == step) 20f else 8f, 8f, 4f, if (i <= step) t.accent else t.lip)
        g.text("開始新的觀察", W - G, top + 40, Dim.FS_S, t.ink2, FontKind.UI, Align.RIGHT)
        g.text(titles[step], G + 4, top + 92, Dim.FS_TITLE - 4, t.ink)
        // bottom: the one main button (or why it cannot be pressed yet)
        g.fillRect(0f, btnY - 16, W, H - btnY + 16, t.bg)
        val why = problem()
        if (why != null) { g.fillRound(G, btnY, W - G * 2, 56f, 28f, t.surface2); g.text(Widgets.fit(g, why, Dim.FS_S + 1, W - G * 2 - 24), W / 2, btnY + 33, Dim.FS_S + 1, t.ink2, FontKind.UI, Align.CENTER) }
        else Widgets.button(g, app, "next", G, btnY, W - G * 2, 56f, if (step == 3) "搬進去！" else "下一步", Kind.PRIMARY, Dim.FS_L)
    }

    // ---- 0: names
    private fun names(g: Gfx, y0: Float) {
        val t = app.theme; val G = Dim.GUTTER; val W = app.w
        g.text("這是牠們要生活的地方。", G + 4, y0 + 8, Dim.FS_S + 1, t.ink2)
        field(g, "name:town", "小鎮", town, y0 + 28); field(g, "name:home", "家", home, y0 + 116)
        Widgets.wrap(g, "點一下就能改。存檔的名字＝家的名字，之後也能在選單改名。", Dim.FS_S, W - G * 2 - 8, 2).forEachIndexed { i, l -> g.text(l, G + 4, y0 + 222 + i * 20f, Dim.FS_S, t.ink3) }
        drawHousePreview(g, app, house, G, y0 + 256, W - G * 2, 210f)
    }
    private fun field(g: Gfx, id: String, label: String, value: String, y: Float) {
        val t = app.theme; val G = Dim.GUTTER; val w = app.w - G * 2; val sink = if (app.pressed == id) Dim.LIP - 1 else 0f
        Widgets.card(g, t, G, y, w, 72f, Dim.RADIUS_L, t.surface, t.lip, sink)
        g.text(label, G + 18, y + 28 + sink, Dim.FS_S, t.ink2); g.text(Widgets.fit(g, value, Dim.FS_L, w - 80), G + 18, y + 55 + sink, Dim.FS_L, t.ink)
        Widgets.icon(g, "next", G + w - 28, y + 36 + sink, 16f, t.ink3)
        app.zone(id, G, y, w, 76f)
    }

    /** the mansion opens once one of your homes has 5 or more residents (plan 12.3) */
    private fun locked(h: HouseType) = h.locked.isNotEmpty() && app.saves.slots().none { it.residents.size >= 5 }
    // ---- 1: house type
    private fun houses(g: Gfx, y0: Float, btnY: Float) {
        val t = app.theme; val G = Dim.GUTTER; val W = app.w
        var x = G; var cy = y0
        g.text("情境開局（可以不選）", G + 4, cy + 10, Dim.FS_S, t.ink2); cy += 20
        for (sc in Scenarios.ALL.values) { if (x + g.measure(sc.zh, Dim.FS_S + 1) + 28 > W - G) { x = G; cy += 44 }
            x += Widgets.chip(g, app, "scn:${sc.id}", x, cy, sc.zh, scenario == sc.id, 38f) + 8 }
        scenario?.let { Scenarios.ALL[it] }?.let { sc -> cy += 50; g.text(Widgets.fit(g, "${sc.desc}（${sc.min}～${sc.max} 位）", Dim.FS_S, W - G * 2 - 8), G + 4, cy, Dim.FS_S, t.accentLip); cy -= 6 }
        x = G; cy += 52
        for (h in Houses.ALL) { val label = h.zh + if (locked(h)) "（未開放）" else ""; if (x + g.measure(label, Dim.FS_S + 1) + 28 > W - G) { x = G; cy += 48 }
            x += Widgets.chip(g, app, "house:${h.id}", x, cy, label, h == house, 40f) + 8 }
        val top = cy + 56
        val ph = minOf(230f, btnY - top - 194)
        g.fillRound(G, top, W - G * 2, ph, Dim.RADIUS_L, t.surface2)
        drawHousePreview(g, app, house, G, top, W - G * 2, ph)
        var y = top + ph + 30
        g.text(house.zh, G + 4, y, Dim.FS_L, t.ink); g.text("最多 ${house.capacity} 位", W - G - 4, y, Dim.FS_M, t.accentLip, FontKind.UI, Align.RIGHT)
        y += 24; g.text(house.blurb, G + 4, y, Dim.FS_S + 1, t.ink2); y += 12
        for (r in house.rules) { y += 24; g.fillCircle(G + 9, y - 5, 3f, t.accent); g.text(Widgets.fit(g, r, Dim.FS_S, W - G * 2 - 24), G + 20, y, Dim.FS_S, t.ink2) }
        y += 24; g.text("房間：" + house.rooms.joinToString("、") { it.zh + if (it.sleeps > 0) "（${it.sleeps} 床）" else "" }, G + 4, y, Dim.FS_S, t.ink3)
    }

    // ---- 2: residents
    private fun people(g: Gfx, y0: Float, btnY: Float, dt: Float) {
        val t = app.theme; val G = Dim.GUTTER; val W = app.w; val lib = app.saves.library().chars
        g.text("從收藏庫選，或用一張圖片做一位新角色。已選 ${chosen.size}／${house.capacity}", G + 4, y0 + 8, Dim.FS_S, t.ink2)
        val top = y0 + 22; val sc = list.step(dt)
        g.save(); g.clip(0f, top, W, btnY - 16 - top); g.translate(0f, -sc); app.zoneDy = -sc; app.zoneClip = floatArrayOf(0f, top, W, btnY - 16 - top)
        var y = top + 6; val rowH = 80f
        for (c in lib) {
            val on = c.id in chosen; val id = "pick:${c.id}"; val sink = if (app.pressed == id) Dim.LIP - 1 else 0f
            Widgets.card(g, t, G, y, W - G * 2, rowH - 14, 20f, if (on) t.select else t.surface, if (on) app.mix(t.select) else t.lip, sink)
            Widgets.face(g, t, app.charImg(c, 256), G + 36, y + 33 + sink, 23f)
            g.text(Widgets.fit(g, c.name, Dim.FS_M + 1, W - 170), G + 70, y + 30 + sink, Dim.FS_M + 1, t.ink)
            val sub = (listOf(c.species, if (c.adult) "成年" else "未成年") + c.traits.take(2)).joinToString("・") + if (c.source == "preset") "・內建" else ""
            g.text(Widgets.fit(g, sub, Dim.FS_S, W - 170), G + 70, y + 52 + sink, Dim.FS_S, t.ink2)
            if (on) { g.fillCircle(W - G - 32, y + 33 + sink, 15f, t.surface); Widgets.icon(g, "check", W - G - 32, y + 33 + sink, 14f, t.ink) }
            app.zone(id, G, y, W - G * 2, rowH - 10); y += rowH
        }
        val sink = if (app.pressed == "import") Dim.LIP - 1 else 0f
        g.strokeRound(G + 1, y + sink, W - G * 2 - 2, rowH - 14, 20f, 2f, t.lip)
        g.fillCircle(G + 36, y + 33 + sink, 23f, t.surface2); Widgets.icon(g, "image", G + 36, y + 33 + sink, 22f, t.ink2)
        g.text("匯入新角色", G + 70, y + 30 + sink, Dim.FS_M + 1, t.ink); g.text("圖片、動畫、Sprite Sheet 或角色包", G + 70, y + 52 + sink, Dim.FS_S, t.ink3)
        app.zone("import", G, y, W - G * 2, rowH - 10); y += rowH
        g.restore(); app.zoneDy = 0f
        list.max = maxOf(0f, y - (btnY - 16))
    }

    // ---- 3: rooms
    private fun roomsStep(g: Gfx, y0: Float, btnY: Float, dt: Float) {
        val t = app.theme; val G = Dim.GUTTER; val W = app.w
        val faces = HashMap<String, MutableList<Img?>>(); for (lid in chosen) rooms[lid]?.let { faces.getOrPut(it) { ArrayList() } += app.charImg(app.saves.libChar(lid), 256) }
        g.fillRound(G, y0, W - G * 2, 190f, Dim.RADIUS_L, t.surface2)
        drawHousePreview(g, app, house, G, y0, W - G * 2, 190f, faces, labels = true)
        val top = y0 + 202; val sc = list.step(dt)
        g.save(); g.clip(0f, top, W, btnY - 16 - top); g.translate(0f, -sc); app.zoneDy = -sc; app.zoneClip = floatArrayOf(0f, top, W, btnY - 16 - top)
        var y = top + 4
        if (chosen.size >= 2) { val f = Form(app, g, G, W - G * 2, y); f.button("rels", "設定他們的關係（選用）${if (rels.isNotEmpty()) "・已設定 ${rels.size / 2} 組" else ""}"); y = f.y }
        for (lid in chosen) {
            val c = app.saves.libChar(lid) ?: continue
            Widgets.face(g, t, app.charImg(c, 256), G + 22, y + 22, 18f)
            g.text(Widgets.fit(g, c.name, Dim.FS_M, 120f), G + 48, y + 28, Dim.FS_M, t.ink)
            var x = G + 48 + minOf(120f, g.measure(c.name, Dim.FS_M)) + 12; var yy = y + 4
            for (r in house.bedrooms) { val w = g.measure(r.zh, Dim.FS_S + 1) + 28; if (x + w > W - G) { x = G + 48; yy += 48 }
                Widgets.chip(g, app, "room:$lid:${r.id}", x, yy, r.zh, rooms[lid] == r.id, 38f); x += w + 6 }
            y = yy + 56
        }
        g.restore(); app.zoneDy = 0f
        list.max = maxOf(0f, y - (btnY - 16))
    }

    override fun tap(id: String) {
        when {
            id == "back" -> back0()
            id == "next" && problem() == null -> next()
            id == "name:town" -> app.platform.prompt("小鎮的名字", town, 12) { n -> if (!n.isNullOrBlank()) town = n.trim() }
            id == "name:home" -> app.platform.prompt("家的名字", home, 12) { n -> if (!n.isNullOrBlank()) home = n.trim() }
            id.startsWith("scn:") -> { val sc = Scenarios.ALL[id.removePrefix("scn:")] ?: return
                if (scenario == sc.id) { scenario = null; return }
                val h = Houses.get(sc.house); if (locked(h)) { app.toast(h.locked); return }
                scenario = sc.id; house = h; rooms.clear(); app.platform.sound("pop") }
            id.startsWith("house:") -> { val h = Houses.get(id.removePrefix("house:")); if (locked(h)) app.toast(h.locked) else { house = h; rooms.clear(); if (scenario?.let { Scenarios.ALL[it]?.house } != h.id) scenario = null } }
            id.startsWith("pick:") -> { val c = id.removePrefix("pick:")
                if (!chosen.remove(c)) { if (chosen.size >= house.capacity) app.toast("${house.zh}最多住 ${house.capacity} 位") else chosen += c } }
            id == "import" -> pickImage()
            id == "btn:rels" -> editRels()
            id.startsWith("room:") -> { val (lid, rid) = id.removePrefix("room:").split(":"); rooms[lid] = rid }
        }
    }
    private fun pickImage() {
        if (chosen.size >= house.capacity) { app.toast("${house.zh}最多住 ${house.capacity} 位"); return }
        app.push(ImportStudio(onDone = { c -> if (chosen.size < house.capacity) chosen += c.id }))
    }
    private fun editRels() {
        val people = chosen.mapNotNull { app.saves.libChar(it) }.map { Triple(it.id, it.specOf(), it) }
        app.push(RelationsScreen(people, rels, romance) { r, rom -> rels.clear(); rels += r; romance = rom; null })
    }
    private fun next() {
        when (step) {
            2 -> { scenario?.let { sc -> val have = rels.map { it.from to it.to }.toSet(); rels += Scenarios.rels(sc, chosen.toList()).filter { (it.from to it.to) !in have } }   /* the scenario's ties, under any you drew yourself */
                val auto = Houses.autoRooms(house, tenants()); rooms.keys.retainAll(chosen); for (lid in chosen) if (house.bedrooms.none { it.id == rooms[lid] }) auto[lid]?.let { rooms[lid] = it } }
            3 -> { finish(); return }
        }
        step++; list.reset(); enterK.snap(0f); enterK.target = 1f
    }
    private fun finish() {
        try {
            val m = app.saves.createWorld(home, town, home, house, chosen.toList(), rooms, app.platform.realMinute(), rels.filter { it.from in chosen && it.to in chosen }, romance)
            app.replace(WorldScreen(m.id))
        } catch (e: IllegalArgumentException) { app.toast(e.message ?: "沒辦法搬進去") }
    }
    private fun back0() { if (step == 0) app.pop() else { step--; list.reset() } }
    override fun back(): Boolean { if (step == 0) return false; step--; list.reset(); return true }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) { if (step >= 2) list.drag(dy, y, start) }
    override fun release() { list.release() }
}

