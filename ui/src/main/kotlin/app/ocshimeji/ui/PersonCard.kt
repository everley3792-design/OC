package app.ocshimeji.ui

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
        val h = min(app.h - app.insetTop - 40, 560f + app.insetBottom); val y = app.h - h * s; val W = app.w; val G = Dim.GUTTER
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); g.fillRound(W / 2 - 20, y + 10, 40f, 5f, 3f, t.line)
        app.zone("card:body", 0f, y, W, h)
        // ---- who
        Widgets.face(g, t, app.charImg(ws.libOf(p), 256), G + 30, y + 52, 26f)
        g.text(Widgets.fit(g, p.name, Dim.FS_L, W - 160), G + 68, y + 48, Dim.FS_L, t.ink)
        val room = sim.house.rooms.firstOrNull { it.id == p.room }?.zh ?: ""
        g.text("${sim.moodLabel(p)}・住在$room" + if (!p.adult) "・未成年" else "", G + 68, y + 72, Dim.FS_S, t.ink2)
        Widgets.round(g, app, "card:edit", W - G - 24, y + 48, 20f, "edit"); Widgets.round(g, app, "card:rels", W - G - 74, y + 48, 20f, "people")
        Widgets.sky(g, t, sim.moodSky(p), G + 50, y + 34, 9f)
        for (i in 0 until 5) Widgets.heart(g, G + 74 + i * 15f, y + 84, 4.2f, if (p.affinity >= (i + 1) * 20 - 10) 0xFFF0705A.toInt() else t.lip)
        val sp = listOfNotNull(p.spec.species.takeIf { it != "未知" }, "喜歡被摸${p.found.joinToString("、")}".takeIf { p.found.isNotEmpty() }).joinToString("・")
        if (sp.isNotEmpty()) g.text(Widgets.fit(g, sp, Dim.FS_S - 2, W - 190), G + 154, y + 88, Dim.FS_S - 2, t.ink3)
        // ---- now + why
        var yy = y + 100
        g.fillRound(G, yy, W - G * 2, 62f, 16f, t.surface2)
        g.text("現在", G + 14, yy + 25, Dim.FS_S, t.accentLip); g.text(Widgets.fit(g, ws.doing(p, b), Dim.FS_M, W - G * 2 - 70), G + 56, yy + 25, Dim.FS_M, t.ink)
        val why = if (p.why.isEmpty()) "沒有特別的理由，隨意地過著" else "因為：" + p.why.joinToString("、")
        g.text(Widgets.fit(g, why, Dim.FS_S, W - G * 2 - 28), G + 14, yy + 48, Dim.FS_S, t.ink2)
        yy += 78
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
        // ---- today
        yy += 4
        g.text("今天", G + 2, yy + 14, Dim.FS_S, t.ink2); yy += 22
        val today = floor(sim.life.minute / 1440)
        val lines = sim.life.log.filter { it.who == id && floor(it.minute / 1440) == today }.takeLast(3)
        if (lines.isEmpty()) { g.text("（今天還沒有什麼事）", G + 2, yy + 16, Dim.FS_S, t.ink3); yy += 24 }
        for (l in lines) { val m = ((l.minute % 1440) + 1440) % 1440
            g.text("%02d:%02d".format((m / 60).toInt(), (m % 60).toInt()), G + 2, yy + 16, Dim.FS_S, t.ink3, FontKind.NUM)
            g.text(Widgets.fit(g, l.text.substringAfter("："), Dim.FS_S, W - G * 2 - 56), G + 50, yy + 16, Dim.FS_S, t.ink); yy += 22 }
        // ---- a snack from you (bottom: the hand reaches it)
        val fy = y + h - app.insetBottom - 64; val bw = (W - G * 2 - 16) / 3
        g.text("給點心", G + 2, fy - 8, Dim.FS_S, t.ink2)
        listOf("cookie" to "餅乾", "apple" to "蘋果", "milk" to "牛奶").forEachIndexed { i, (k, zh) -> Widgets.button(g, app, "feed:$k", G + i * (bw + 8), fy, bw, 48f, zh) }
    }
    override fun tap(id: String) {
        if (id == "card:edit") { edit(); return }
        if (id == "card:rels") { rels(); return }
        if (id.startsWith("feed:")) { val msg = ws.sim.feed(this.id, id.removePrefix("feed:")); app.closeOverlay(); if (msg.isNotEmpty()) app.toast(msg) }
    }

    /** edit this resident (their own copy in this world) */
    private fun edit() {
        val p = ws.sim.person(id) ?: return; val c = ws.libOf(p) ?: return; app.closeOverlay()
        app.push(CharacterEditor(c, p.spec, world = true, title = p.name, houseId = ws.sim.house.id, housemates = ws.sim.life.people.size) { s, _ ->
            ws.sim.editSpec(id, s); ws.refresh(); ws.flush(); null })
    }
    /** this world's relationships */
    private fun rels() {
        val sim = ws.sim; if (sim.life.people.size < 2) { app.toast("這裡只住了一位"); return }
        app.closeOverlay()
        val people = sim.life.people.map { Triple(it.id, it.spec, ws.libOf(it)) }
        app.push(RelationsScreen(people, sim.life.rels, sim.life.romance) { r, rom ->
            val keep = sim.life.rels.toList(); val keepRom = sim.life.romance
            sim.life.romance = rom; sim.life.rels.clear()
            val err = r.firstNotNullOfOrNull { sim.setRel(it) }
            if (err != null) { sim.life.rels.clear(); sim.life.rels += keep; sim.life.romance = keepRom; err } else { ws.flush(); null } })
    }
}
