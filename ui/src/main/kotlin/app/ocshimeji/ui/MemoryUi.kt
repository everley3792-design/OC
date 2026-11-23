package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.sim.life.LogLine
import kotlin.math.floor

/**
 * 回憶 (R1, from the observation genre: a day is many small things). Two tabs:
 * - **回放**: one day's memories on a timeline — play them back at 1× … 1024×, scrub, filter by person or the starred moments;
 * - **收藏**: every starred moment.
 * A line = the time, who, what, a sound, one line of narration, how long. Tap a line to star it (a 名場面).
 * Screen-only: it reads the life's timeline and never changes the life (except the star, which is yours).
 */
class MemoryScreen(val ws: WorldScreen) : Screen() {
    override val animating get() = true
    private var tab = "replay"; private var who = "all"; private var dayOff = 0
    private val speeds = listOf(1, 8, 16, 64, 256, 1024)
    private var speed = 64; private var playing = false
    /** the replay's clock (game minutes from the start of the day); null = show the whole day */
    private var cursor: Double? = null
    private val scroll = Scroller()
    private val life get() = ws.sim.life
    private fun dayStart(): Double = (floor(life.minute / 1440) - dayOff) * 1440
    private fun lines(): List<LogLine> {
        val base = if (tab == "fav") life.log.filter { it.fav } else { val s0 = dayStart(); life.log.filter { it.minute >= s0 && it.minute < s0 + 1440 } }
        return base.filter { l -> when (who) { "all" -> true; "fav" -> l.fav; else -> l.who == who || l.with == who } }.sortedBy { it.minute }
    }
    private fun hm(m: Double): String { val x = ((m % 1440) + 1440) % 1440; return "%02d:%02d".format((x / 60).toInt(), (x % 60).toInt()) }

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        ws.driveElsewhere(dt)
        g.fillRect(0f, 0f, W, H, t.bg)
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back"); g.text("回憶", G + 60, top + 42, Dim.FS_L, t.ink)
        // tabs (segmented)
        val sw = (W - G * 2) / 2; val ty = top + 70; g.fillRound(G, ty, W - G * 2, 40f, 20f, t.surface2)
        for ((i, k) in listOf("replay" to "回放一天", "fav" to "我的收藏").withIndex()) { val x0 = G + i * sw
            if (tab == k.first) Widgets.card(g, t, x0 + 3, ty + 3, sw - 6, 34f, 17f, t.surface, t.lip); g.text(k.second, x0 + sw / 2, ty + 26, Dim.FS_S + 1, if (tab == k.first) t.ink else t.ink2, FontKind.UI, Align.CENTER); app.zone("tab:${k.first}", x0, ty, sw, 40f) }
        var y = ty + 52
        val ls = lines()
        if (tab == "replay") {
            // which day, how many little things
            var x = G; for ((k, zh) in listOf(0 to "今天", 1 to "昨天", 2 to "前天")) x += Widgets.chip(g, app, "day:$k", x, y, zh, dayOff == k, 34f) + 6
            g.text("${ls.size} 件小事", W - G - 4, y + 22, Dim.FS_S, t.ink3, FontKind.UI, Align.RIGHT); y += 44
            // the scrubber
            val cur = cursor ?: 0.0; val bx = G + 64; val bw = W - G - bx - 4
            g.text(hm(dayStart() + cur), G, y + 20, Dim.FS_M, t.ink, FontKind.NUM)
            g.fillRound(bx, y + 12, bw, 6f, 3f, t.surface2); g.fillRound(bx, y + 12, bw * (cur / 1440).toFloat(), 6f, 3f, t.accent)
            g.fillCircle(bx + bw * (cur / 1440).toFloat(), y + 15, 9f, t.accentLip); app.zone("scrub", bx - 8, y - 6, bw + 16, 42f); y += 40
            // play + speeds
            val down = app.pressed == "play"; Widgets.card(g, t, G, y, 56f, 48f, 16f, t.accentLip, Colors.mix(t.accentLip, 0xFF000000.toInt(), 0.2f), if (down) 2f else 0f)
            if (playing) { g.fillRect(G + 21, y + 15, 5f, 18f, t.onAccent); g.fillRect(G + 31, y + 15, 5f, 18f, t.onAccent) } else Widgets.icon(g, "next", G + 30, y + 24, 16f, t.onAccent)
            app.zone("play", G, y, 56f, 52f)
            val segX = G + 64; val segW = (W - G - segX) / speeds.size; g.fillRound(segX, y, segW * speeds.size, 48f, 16f, t.surface2)
            speeds.forEachIndexed { i, sp -> val x0 = segX + i * segW; if (sp == speed) Widgets.card(g, t, x0 + 3, y + 4, segW - 6, 40f, 13f, t.surface, t.lip)
                g.text("${sp}×", x0 + segW / 2, y + 30, Dim.FS_S - 1, if (sp == speed) t.ink else t.ink3, FontKind.NUM, Align.CENTER); app.zone("spd:$sp", x0, y, segW, 48f) }
            y += 58
        }
        // filters: everyone / starred / each person
        var fx = G
        for ((k, zh) in listOf("all" to "全部", "fav" to "名場面") + life.people.map { it.id to it.name }) { val w0 = g.measure(zh, Dim.FS_S + 1) + 28; if (fx + w0 > W - G) break; fx += Widgets.chip(g, app, "who:$k", fx, y, zh, who == k, 34f) + 6 }
        y += 46
        // playing: the cursor moves; only what already happened is shown, and the list follows it
        if (playing) { cursor = (cursor ?: 0.0) + dt * speed / 60.0   /* speed× real time: real seconds × speed → game seconds → minutes */
            if (cursor!! >= 1440) { cursor = 1440.0; playing = false } }
        val shown = if (tab == "replay" && cursor != null) ls.filter { it.minute - dayStart() <= cursor!! } else ls
        val listTop = y; val listH = H - listTop - app.insetBottom
        /* a line with narration or a length is taller than a plain one */
        val hs = shown.map { if (it.aside.isNotBlank() || it.dur >= 1) 78f else 54f }; val tops = hs.runningFold(0f) { a, b -> a + b }
        scroll.max = maxOf(0f, tops.last() - listH + 20)
        if (playing) scroll.toEnd()
        val sc = scroll.step(dt)
        if (shown.isEmpty()) g.text(if (tab == "fav") "還沒有收藏的名場面：點一件事就能收藏" else if (cursor != null) "按播放，這一天會一件一件出現" else "這一天還沒有記下什麼", W / 2, listTop + 50, Dim.FS_S + 1, t.ink3, FontKind.UI, Align.CENTER)
        g.save(); g.clip(0f, listTop, W, listH); app.zoneDy = -sc; app.zoneClip = floatArrayOf(0f, listTop, W, listH)
        g.fillRect(G + 58, listTop - sc, 2f, tops.last(), t.line)   /* the time line */
        shown.forEachIndexed { i, l ->
            val rowH = hs[i]; val ry = listTop + tops[i] - sc; if (ry + rowH < listTop || ry > listTop + listH) return@forEachIndexed
            val p = ws.sim.person(l.who); val tint = p?.spec?.tint?.takeIf { it.matches(Regex("#[0-9A-Fa-f]{6}")) }?.let { Colors.hex(it) } ?: t.accent
            g.text(hm(l.minute), G, ry + 30, Dim.FS_S, t.ink3, FontKind.NUM)
            g.fillCircle(G + 59, ry + 26, 7f, t.bg); g.fillCircle(G + 59, ry + 26, 5f, if (l.fav) 0xFFF4B740.toInt() else tint)
            val cx = G + 72; val cw = W - G - cx
            if (l.fav) Widgets.card(g, t, cx, ry + 2, cw, rowH - 8, 16f, Colors.mix(t.surface, 0xFFFFE9A8.toInt(), 0.5f), 0xFFF0D080.toInt())
            Widgets.face(g, t, p?.let { app.charImg(ws.libOf(it), 128) }, cx + 22, ry + 26, 15f)
            val text = l.text.substringAfter("：").let { if (p != null) p.name + it else it }
            val main = text + if (l.sound.isNotBlank()) "　「${l.sound}」" else ""
            g.text(Widgets.fit(g, main, Dim.FS_S + 1, cw - 64 - (if (l.fav) 22 else 0)), cx + 44, ry + 30, Dim.FS_S + 1, t.ink)
            if (l.aside.isNotBlank()) g.text(Widgets.fit(g, "“${l.aside}”", Dim.FS_S, cw - 120), cx + 44, ry + 54, Dim.FS_S, t.ink2)
            if (l.dur >= 1) { val d = if (l.dur >= 60) "${(l.dur / 60).toInt()} 小時" else "${l.dur.toInt()} 分鐘"; val dw = g.measure(d, Dim.FS_S - 1) + 18
                g.fillRound(W - G - dw - 4, ry + 40, dw, 24f, 12f, t.surface2); g.text(d, W - G - dw / 2 - 4, ry + 57, Dim.FS_S - 1, t.ink2, FontKind.UI, Align.CENTER) }
            if (l.fav) Widgets.icon(g, "star", W - G - 18, ry + 22, 13f, 0xFFF4B740.toInt())
            app.zone("l:${life.log.indexOf(l)}", cx, ry + sc, cw, rowH - 8)
        }
        app.zoneDy = 0f; g.restore()
    }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id.startsWith("tab:") -> { tab = id.removePrefix("tab:"); playing = false; cursor = null; scroll.reset() }
            id.startsWith("day:") -> { dayOff = id.removePrefix("day:").toInt(); playing = false; cursor = null; scroll.reset() }
            id.startsWith("who:") -> { who = id.removePrefix("who:"); scroll.reset() }
            id.startsWith("spd:") -> speed = id.removePrefix("spd:").toInt()
            id == "play" -> { if (!playing && (cursor == null || cursor!! >= 1440)) { cursor = startAt(); scroll.reset() }; playing = !playing }
            id == "scrub" -> { val bx = Dim.GUTTER + 64; val bw = app.w - Dim.GUTTER - bx - 4; cursor = ((app.tapX - bx) / bw * 1440).toDouble().coerceIn(0.0, 1440.0); playing = false }
            id.startsWith("l:") -> life.log.getOrNull(id.removePrefix("l:").toInt())?.let { it.fav = !it.fav; app.toast(if (it.fav) "收藏成名場面了" else "取消收藏"); ws.flush() }
        }
    }
    /** tests: play from the start at a speed for some real seconds */
    fun playFor(sp: Int) { speed = sp; cursor = startAt(); playing = true }
    /** playback starts a few minutes before the day's first small thing (not at an empty midnight) */
    private fun startAt(): Double = lines().firstOrNull()?.let { (it.minute - dayStart() - 5).coerceIn(0.0, 1440.0) } ?: 0.0
    val shownCount get() = lines().count { cursor == null || it.minute - dayStart() <= cursor!! }
}
