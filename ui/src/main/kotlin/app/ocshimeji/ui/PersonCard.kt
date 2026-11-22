package app.ocshimeji.ui

import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.social.Worries
import app.ocshimeji.sim.social.Sickness
import app.ocshimeji.sim.social.Crazes
import app.ocshimeji.sim.social.Fears
import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.sim.life.Moods
import app.ocshimeji.sim.life.Need
import kotlin.math.floor
import kotlin.math.min

/**
 * 人物卡 (plan A-07, 4.2): what this character is doing and why, the eight needs, the mood cards behind its mood, today's diary,
 * and a snack from you. It reads the live sim every frame, so it changes while you watch.
 */
class PersonCard(val ws: WorldScreen, val id: String) : Overlay() {
    private val slide = Spring(0f, 1f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val sim = ws.sim; val p = sim.person(id) ?: run { app.closeOverlay(); return }
        val b = sim.body(id)
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, (s * 0.45f).coerceIn(0f, 1f)))
        val h = min(app.h - app.insetTop - 24, 640f + app.insetBottom); val y = app.h - h * s; val W = app.w; val G = Dim.GUTTER
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); g.fillRound(W / 2 - 20, y + 10, 40f, 5f, 3f, t.line)
        app.zone("card:body", 0f, y, W, h)
        // ---- who
        Widgets.face(g, t, app.charImg(ws.libOf(p), 256), G + 30, y + 52, 26f)
        g.text(Widgets.fit(g, p.name, Dim.FS_L, W - 210), G + 68, y + 48, Dim.FS_L, t.ink)
        val room = sim.house.rooms.firstOrNull { it.id == p.room }?.zh ?: ""
        g.text(Widgets.fit(g, "${sim.moodLabel(p)}・$room" + if (!p.adult) "・未成年" else "", Dim.FS_S, W - G - 150 - (G + 68)), G + 68, y + 72, Dim.FS_S, t.ink2)
        Widgets.round(g, app, "card:edit", W - G - 24, y + 48, 20f, "edit"); Widgets.round(g, app, "card:rels", W - G - 74, y + 48, 20f, "people"); Widgets.round(g, app, "card:desk", W - G - 124, y + 48, 20f, "phone")
        Widgets.sky(g, t, sim.moodSky(p), G + 50, y + 34, 9f)
        for (i in 0 until 5) Widgets.heart(g, G + 74 + i * 15f, y + 84, 4.2f, if (p.affinity >= (i + 1) * 20 - 10) 0xFFF0705A.toInt() else t.lip)
        val sp = listOfNotNull(p.spec.species.takeIf { it != "未知" }, "喜歡被摸${p.found.joinToString("、")}".takeIf { p.found.isNotEmpty() }).joinToString("・")
        if (sp.isNotEmpty()) g.text(Widgets.fit(g, sp, Dim.FS_S - 2, W - 190), G + 154, y + 88, Dim.FS_S - 2, t.ink3)
        val so = sim.society
        // ---- R3: three pages — now, relationships, records
        var tx = G
        for ((k, zh) in listOf("now" to "現在", "rels" to "關係", "log" to "紀錄")) tx += Widgets.chip(g, app, "ptab:$k", tx, y + 98, zh, tab == k, 36f, 72f) + 8
        if (tab == "rels") { relsPage(g, t, y + 146, y + h); return }
        if (tab == "log") { logPage(g, t, y + 146, y + h); return }
        // ---- now + why
        var yy = y + 142
        g.fillRound(G, yy, W - G * 2, 62f, 16f, t.surface2)
        g.text("現在", G + 14, yy + 25, Dim.FS_S, t.accentLip); g.text(Widgets.fit(g, ws.doing(p, b), Dim.FS_M, W - G * 2 - 70), G + 56, yy + 25, Dim.FS_M, t.ink)
        val why = if (p.why.isEmpty()) "沒有特別的理由，隨意地過著" else "因為：" + p.why.joinToString("、")
        g.text(Widgets.fit(g, why, Dim.FS_S, W - G * 2 - 28), G + 14, yy + 48, Dim.FS_S, t.ink2)
        yy += 70
        // ---- what it looks like (plan 13.3 敘事描寫), today's status, wish, worry / request
        so.narrate(id)?.let { n -> Widgets.wrap(g, n, Dim.FS_S, W - G * 2 - 8, 2).forEachIndexed { i, l -> g.text(l, G + 4, yy + 16 + i * 20f, Dim.FS_S, t.ink2) }; yy += 46 }
        val st = so.statusOf(p); val wish = p.wish?.takeIf { !it.done }
        val titles = sim.journal.titlesOf(id); val star = sim.journal.starNow()?.takeIf { it.who == id }
        val info = listOfNotNull(star?.let { "本週之星" }, titles.lastOrNull()?.let { "稱號：${it.zh}" }, st?.let { "今天：${it.zh}" }, wish?.let { "心願：${it.text}" }, p.worry?.let { "煩惱：${Worries.ALL[it.kind]?.zh}" }, p.ask?.let { "請求：${it.text}" },
            p.plan.firstOrNull()?.let { "計畫：" + p.plan.joinToString("→") { a -> Acts[a]?.zh ?: a } })
        var ix = G
        for (s0 in info.take(4)) { val w0 = g.measure(s0, Dim.FS_S - 1) + 20; if (ix + w0 > W - G) break; g.fillRound(ix, yy, w0, 26f, 13f, if (s0.startsWith("煩惱")) Colors.mix(t.alert, t.surface, 0.6f) else t.surface2)
            g.text(s0, ix + 10, yy + 18, Dim.FS_S - 1, t.ink); ix += w0 + 6 }
        if (info.isNotEmpty()) yy += 34
        // ---- 1.7.0: their bigger stories — a dream, being ill, a craze, today's whim, a fear they are working on
        val dr = sim.drama
        val story = listOfNotNull(dr.dreamOf(p)?.let { (_, s) -> "夢想：${p.spec.dream}（${s.step}/3）" + if (s.done) "實現了" else "" }, dr.sickOf(p)?.let { "生病：${Sickness.ALL[it.kind]?.zh}" },
            dr.crazeOf(p)?.let { "最近迷上${Crazes.ACTS[it.act]}" }, dr.whimOf(p)?.let { "今天是${it.role}" },
            dr.fearsOf(p).firstOrNull()?.let { f -> "怕${f.zh}（${sim.life.drama.courage["${p.id}:${f.id}"] ?: 0}/${Fears.COURAGE}）" })
        ix = G
        for (s0 in story) { val w0 = g.measure(s0, Dim.FS_S - 1) + 20; if (ix + w0 > W - G) { ix = G; yy += 32 }; g.fillRound(ix, yy, w0, 26f, 13f, Colors.mix(t.accent, t.surface, 0.75f))
            g.text(s0, ix + 10, yy + 18, Dim.FS_S - 1, t.ink); ix += w0 + 6 }
        if (story.isNotEmpty()) yy += 34
        // ---- what you can do together (plan E-04 / E-05 / E-08)
        val acts = listOf("card:talk" to "聊天", "card:suggest" to when (p.control) { "observe" -> "觀察中"; "suggest" -> "建議"; else -> "操控" }, "card:rps" to "猜拳", "card:hide" to "躲貓貓", "card:feed" to "點心")
        val aw = (W - G * 2 - 24) / 5
        acts.forEachIndexed { i, (k, zh) -> Widgets.button(g, app, k, G + i * (aw + 6), yy, aw, 44f, zh, Kind.SECONDARY, Dim.FS_S) }
        yy += 60
        // ---- needs (two columns)
        val colW = (W - G * 2 - 16) / 2
        Need.values().forEachIndexed { i, n ->
            val cx = G + (i % 2) * (colW + 16); val cy = yy + (i / 2) * 32f; val v = p.need(n)
            g.text(n.zh, cx, cy + 12, Dim.FS_S, t.ink2)
            val bx = cx + 44; val bw = colW - 44
            g.fillRound(bx, cy + 2, bw, 12f, 6f, t.surface2)
            val col = when { v < 25 -> t.alert; v < 55 -> t.accent; else -> t.select }
            if (v > 1) g.fillRound(bx, cy + 2, maxOf(12f, bw * v / 100f), 12f, 6f, col)
        }
        yy += 4 * 32f + 10
        // ---- mood cards
        g.text("心情小卡", G + 2, yy + 14, Dim.FS_S, t.ink2); yy += 24
        var mx = G; var rows = 0
        val moods = p.moods.mapNotNull { m -> Moods.ALL[m.id]?.let { it to m } }.sortedByDescending { kotlin.math.abs(it.first.value) }
        if (moods.isEmpty()) { g.text("（沒有特別的心情）", G + 2, yy + 18, Dim.FS_S, t.ink3); yy += 34 }
        else {
            for ((d, _) in moods) {
                val label = d.zh + if (d.value > 0) " +${d.value}" else " ${d.value}"; val w = g.measure(label, Dim.FS_S) + 22
                if (mx + w > W - G) { mx = G; rows++; if (rows >= 2) break }
                val c = if (d.value > 0) Colors.mix(t.select, t.surface, 0.45f) else Colors.mix(t.alert, t.surface, 0.62f)
                g.fillRound(mx, yy + rows * 34f, w, 28f, 14f, c); g.text(label, mx + w / 2, yy + rows * 34f + 19, Dim.FS_S, t.ink, FontKind.UI, Align.CENTER); mx += w + 6
            }
            yy += (min(rows, 1) + 1) * 34f
        }
        if (p.worry != null) Widgets.button(g, app, "card:worry", G, yy + 4, W - G * 2, 44f, "處理煩惱：${Worries.ALL[p.worry!!.kind]?.zh}", Kind.PRIMARY, Dim.FS_S + 1)
    }
    /** who they are to everyone else in the house: the step, how much they like and trust them, what life has called the two */
    private fun relsPage(g: Gfx, t: Theme, y0: Float, bottom: Float) {
        val sim = ws.sim; val W = app.w; val G = Dim.GUTTER; var yy = y0
        val others = sim.life.people.filter { it.id != id }
        if (others.isEmpty()) { g.text("這裡只住了${sim.person(id)?.name ?: ""}", W / 2, yy + 40, Dim.FS_M, t.ink3, FontKind.UI, Align.CENTER); return }
        for (q in others) { if (yy + 96 > bottom - 70) break
            val r = sim.rel(id, q.id); val back = sim.rel(q.id, id)
            Widgets.card(g, t, G, yy, W - G * 2, 88f, 18f, t.surface2, t.lip)
            Widgets.face(g, t, app.charImg(ws.libOf(q), 256), G + 30, yy + 32, 18f)
            g.text(Widgets.fit(g, q.name, Dim.FS_M, 120f), G + 58, yy + 28, Dim.FS_M, t.ink)
            g.text((r?.kind ?: "陌生") + (r?.identity?.takeIf { it.isNotBlank() }?.let { "・$it" } ?: ""), W - G - 16, yy + 28, Dim.FS_S, t.accentLip, FontKind.UI, Align.RIGHT)
            fun bar(label: String, v: Int, bx: Float, by: Float, col: Int) { g.text(label, bx, by + 10, Dim.FS_S - 2, t.ink2); val w0 = (W - G * 2 - 90) / 3 - 30
                g.fillRound(bx + 28, by + 2, w0, 9f, 5f, t.surface); g.fillRound(bx + 28, by + 2, maxOf(9f, w0 * v.coerceIn(0, 100) / 100f), 9f, 5f, col) }
            val cw = (W - G * 2 - 70) / 3
            bar("喜歡", r?.like ?: 0, G + 58, yy + 40, t.select); bar("信任", r?.trust ?: 0, G + 58 + cw, yy + 40, t.accent); bar("熟悉", r?.familiar ?: 0, G + 58 + cw * 2, yy + 40, t.lip)
            val tags = (r?.flavor.orEmpty() + r?.tags.orEmpty()).distinct().take(3).joinToString("・")
            val note = listOfNotNull(tags.ifBlank { null }, back?.let { "對方覺得是「${it.kind}」" }, sim.society.feud(id, q.id)?.let { "冷戰中" }).joinToString("　")
            g.text(Widgets.fit(g, note, Dim.FS_S - 1, W - G * 2 - 74), G + 58, yy + 76, Dim.FS_S - 1, t.ink2)
            yy += 96 }
        Widgets.button(g, app, "card:rels", G, bottom - app.insetBottom - 62, W - G * 2, 48f, "關係圖")
    }
    /** what they did lately (the timeline, their lines only), titles and the things they do most */
    private fun logPage(g: Gfx, t: Theme, y0: Float, bottom: Float) {
        val sim = ws.sim; val W = app.w; val G = Dim.GUTTER; var yy = y0
        val titles = sim.journal.titlesOf(id)
        if (titles.isNotEmpty()) { g.text(Widgets.fit(g, "稱號：" + titles.joinToString("、") { it.zh }, Dim.FS_S, W - G * 2), G + 4, yy + 14, Dim.FS_S, t.accentLip); yy += 28 }
        val top = sim.life.prog.counts.filterKeys { it.startsWith("$id:") }.entries.sortedByDescending { it.value }.take(4)
            .mapNotNull { (k, n) -> Acts[k.substringAfter(":")]?.let { "${it.zh} $n 次" } }
        if (top.isNotEmpty()) { g.text(Widgets.fit(g, "最常做：" + top.joinToString("・"), Dim.FS_S, W - G * 2), G + 4, yy + 14, Dim.FS_S, t.ink2); yy += 30 }
        val lines = sim.life.log.asReversed().asSequence().filter { it.who == id || it.with == id }.take(14).toList()
        if (lines.isEmpty()) { g.text("還沒有紀錄", W / 2, yy + 40, Dim.FS_M, t.ink3, FontKind.UI, Align.CENTER); return }
        for (l in lines) { if (yy + 30 > bottom - app.insetBottom - 70) break
            val m = ((l.minute % 1440) + 1440) % 1440; val hm = "%02d:%02d".format((m / 60).toInt(), (m % 60).toInt())
            g.text(hm, G + 4, yy + 18, Dim.FS_S - 1, t.ink3, FontKind.NUM)
            g.text(Widgets.fit(g, (if (l.who != id) (sim.person(l.who)?.name ?: "") + "：" else "") + l.text + if (l.sound.isNotEmpty()) "　${l.sound}" else "", Dim.FS_S, W - G * 2 - 56), G + 50, yy + 18, Dim.FS_S, if (l.fav) t.accentLip else t.ink)
            yy += 28 }
        Widgets.button(g, app, "card:mem", G, bottom - app.insetBottom - 62, W - G * 2, 48f, "記憶與更多紀錄")
    }
    /** which page shows (R3) */
    var tab = "now"
    override fun tap(id: String) {
        if (id.startsWith("ptab:")) { tab = id.removePrefix("ptab:"); app.platform.sound("tick"); return }
        if (id == "card:feed") { val pid = this.id; app.closeOverlay(); app.show(ListSheet("給${ws.sim.person(pid)?.name ?: ""}點心", listOf("cookie" to "餅乾", "apple" to "蘋果", "milk" to "牛奶")) { k -> val m = ws.sim.feed(pid, k); if (m.isNotEmpty()) app.toast(m); ws.flush() }); return }
        if (id == "card:edit") { edit(); return }
        if (id == "card:rels") { rels(); return }
        if (id == "card:desk") { val p = ws.sim.person(this.id) ?: return; app.closeOverlay(); app.show(DeskSheet(ws.slotId, p.id, p.name) { ws.sim.person(this.id)?.desk == true }); return }
        when (id) {
            "card:talk" -> { app.closeOverlay(); app.show(TalkSheet(ws, this.id)); return }
            "card:suggest" -> { app.closeOverlay(); app.show(SuggestSheet(ws, this.id)); return }
            "card:rps" -> { if (ws.sim.asleep(ws.sim.person(this.id) ?: return)) { app.toast("睡著了"); return }; app.closeOverlay(); app.show(RpsSheet(ws, this.id)); return }
            "card:hide" -> { app.closeOverlay(); if (ws.sim.society.hideStart(this.id)) app.toast("躲起來了！點家具找找看") else app.toast("現在沒辦法玩"); return }
            "card:worry" -> { app.closeOverlay(); app.show(WorrySheet(ws, this.id)); return }
            "card:mem" -> { app.closeOverlay(); app.show(MemorySheet(ws, this.id)); return }
        }
        if (id.startsWith("feed:")) { val msg = ws.sim.feed(this.id, id.removePrefix("feed:")); app.closeOverlay(); if (msg.isNotEmpty()) app.toast(msg) }
    }

    /** edit this resident (their own copy in this world) */
    private fun edit() { app.closeOverlay(); editResident(app, ws, id) }
    /** this world's relationships */
    private fun rels() { if (ws.sim.life.people.size >= 2) app.closeOverlay(); openWorldRelations(app, ws) }

}

/** edit a resident (their own copy in this world) */
fun editResident(app: UiApp, ws: WorldScreen, id: String) {
    val p = ws.sim.person(id) ?: return; val c = ws.libOf(p) ?: return
    app.push(CharacterEditor(c, p.spec, world = true, title = p.name, houseId = ws.sim.house.id, housemates = ws.sim.life.people.size,
        others = ws.sim.life.people.filter { it.id != id }.map { it.libId to it.name }) { s, _ ->
        ws.sim.editSpec(id, s); ws.refresh(); ws.flush(); null })
}
/** the relationship map's result applied to a world (the rules decide; on a refusal nothing changes) */
fun applyRels(sim: app.ocshimeji.sim.life.LifeSim, r: List<app.ocshimeji.sim.chars.Rel>, rom: Boolean): String? {
    val keep = sim.life.rels.toList(); val keepRom = sim.life.romance
    sim.life.romance = rom; sim.life.rels.clear()
    val err = r.firstNotNullOfOrNull { sim.setRel(it) }
    if (err != null) { sim.life.rels.clear(); sim.life.rels += keep; sim.life.romance = keepRom }
    return err
}

/** the relationship map of this home (edits go through LifeSim.setRel → the relationship rules) */
fun openWorldRelations(app: UiApp, ws: WorldScreen) {
    val sim = ws.sim; if (sim.life.people.size < 2) { app.toast("這裡只住了一位"); return }
    val people = sim.life.people.map { Triple(it.id, it.spec, ws.libOf(it)) }
    app.push(RelationsScreen(people, sim.life.rels, sim.life.romance) { r, rom -> applyRels(sim, r, rom) ?: run { ws.flush(); null } })
}
