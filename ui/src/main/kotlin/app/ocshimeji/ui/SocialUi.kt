package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.save.Mark
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.LogLine
import app.ocshimeji.sim.life.Society
import app.ocshimeji.sim.social.DayCard
import app.ocshimeji.sim.social.Rps
import app.ocshimeji.sim.social.SocialActs
import app.ocshimeji.sim.social.Worries
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * Exaggerated effects over a character (plan 13.1): original shapes drawn on top, the picture itself is never changed.
 * heart, sweat, anger, gloom (黑線), shock (放射線), sparkle, fire, soul (靈魂出竅), chill (冷風), stone (石化).
 */
object Fx {
    const val LIFE = 1.8f
    /** `cx` = the middle of the head, `top` = the top of the head, `s` = the character's height on screen; `age` in seconds */
    fun draw(g: Gfx, t: Theme, kind: String, cx: Float, top: Float, s: Float, age: Float) {
        val k = (age / LIFE).coerceIn(0f, 1f); val a = if (k > 0.75f) (1 - k) / 0.25f else 1f; val u = s / 60f
        g.save(); g.alpha(a.coerceIn(0f, 1f))
        when (kind) {
            "heart" -> for (i in 0 until 3) Widgets.heart(g, cx + (i - 1) * 12 * u, top - 6 * u - k * 28 * u - i * 5 * u, (4.5f + i) * u, 0xFFF0705A.toInt())
            "sweat" -> { val x = cx + 14 * u; val y = top + 6 * u + k * 8 * u; g.fillCircle(x, y + 3 * u, 3.4f * u, 0xFF8EC3EA.toInt()); g.save(); g.translate(x, y); g.rotate((Math.PI / 4).toFloat()); g.fillRect(-2.4f * u, -2.4f * u, 3.4f * u, 3.4f * u, 0xFF8EC3EA.toInt()); g.restore() }
            "anger" -> Widgets.icon(g, "anger", cx + 13 * u, top + 2 * u, 12 * u * (1f + 0.15f * sin(age * 18)), 0xFFE0524A.toInt())
            "gloom" -> for (i in 0 until 4) g.line(cx - 9 * u + i * 6 * u, top + 2 * u, cx - 9 * u + i * 6 * u, top + (12 + 4 * k) * u, 1.6f * u, Colors.withAlpha(0xFF3A3550.toInt(), 0.7f))
            "shock" -> { for (i in 0 until 10) { val an = i * Math.PI.toFloat() / 5; val r0 = 16 * u; val r1 = (24 + 6 * k) * u
                    g.line(cx + cos(an) * r0, top + 8 * u + sin(an) * r0, cx + cos(an) * r1, top + 8 * u + sin(an) * r1, 1.6f * u, 0xFF3A3550.toInt()) }
                g.text("！？", cx + 18 * u, top - 4 * u, 12 * u, 0xFFE0524A.toInt(), FontKind.UI) }
            "sparkle" -> for (i in 0 until 4) { val an = i * 1.7f + age * 2; val x = cx + cos(an) * 16 * u; val y = top + 4 * u + sin(an) * 10 * u; star(g, x, y, (2.5f + (i % 2) * 1.5f) * u * (0.6f + 0.4f * sin(age * 9 + i)), 0xFFFFD166.toInt()) }
            "fire" -> for (i in 0 until 6) { val x = cx + (i - 2.5f) * 6 * u + sin(age * 11 + i) * 2 * u; val y = top + 10 * u - ((age * 40 + i * 7) % 26) * u
                g.fillCircle(x, y, (4.2f - ((age * 40 + i * 7) % 26) / 8f).coerceAtLeast(0.6f) * u, if (i % 2 == 0) 0xFFF4A259.toInt() else 0xFFE0524A.toInt()) }
            "soul" -> { val y = top - 4 * u - k * 26 * u; val x = cx + sin(age * 4) * 4 * u
                g.fillCircle(x, y, 6 * u, Colors.withAlpha(0xFFFFFFFF.toInt(), 0.9f)); g.fillCircle(x - 3 * u, y + 5 * u, 3 * u, Colors.withAlpha(0xFFFFFFFF.toInt(), 0.8f))
                g.fillCircle(x - 2 * u, y - 1 * u, 0.9f * u, 0xFF3A3550.toInt()); g.fillCircle(x + 2 * u, y - 1 * u, 0.9f * u, 0xFF3A3550.toInt()) }
            "chill" -> for (i in 0 until 3) { val y = top + 4 * u + i * 6 * u; val x0 = cx - 22 * u + k * 10 * u; g.line(x0, y, x0 + 14 * u, y, 1.4f * u, 0xFF9FC8E6.toInt()); g.fillCircle(x0 + 15 * u, y - 1.2f * u, 1.4f * u, 0xFF9FC8E6.toInt()) }
            "stone" -> { g.fillRound(cx - 14 * u, top, 28 * u, s * 0.9f, 8 * u, Colors.withAlpha(0xFF9A96A0.toInt(), 0.55f)); g.line(cx - 4 * u, top + 6 * u, cx + 2 * u, top + 16 * u, 1.2f * u, 0xFF5A5660.toInt()); g.line(cx + 2 * u, top + 16 * u, cx - 3 * u, top + 26 * u, 1.2f * u, 0xFF5A5660.toInt()) }
        }
        g.restore()
    }
    fun star(g: Gfx, x: Float, y: Float, r: Float, c: Int) { g.line(x - r, y, x + r, y, r * 0.5f, c); g.line(x, y - r * 1.4f, x, y + r * 1.4f, r * 0.5f, c); g.fillCircle(x, y, r * 0.45f, c) }
}

/** a close-up portrait (plan 13.1 大頭特寫): a face picture for the emotion if there is one, otherwise the face area of the standing picture */
object Portrait {
    fun draw(g: Gfx, t: Theme, look: Look?, cx: Float, cy: Float, r: Float, emotion: String) {
        g.fillCircle(cx, cy + 3, r + 4, t.shadow); g.fillCircle(cx, cy, r + 4, t.surface); g.fillCircle(cx, cy, r, t.surface2)
        val face = look?.face(emotion); val img = face ?: look?.base ?: return
        g.save(); g.clip(cx - r * 0.72f, cy - r * 0.72f, r * 1.44f, r * 1.44f)
        if (face != null) { val s = r * 1.5f / maxOf(img.w, img.h); g.image(img, cx - img.w * s / 2, cy - img.h * s / 2, img.w * s, img.h * s) }
        else {
            val m = look!!.mark("臉") ?: look.mark("頭")
            if (m == null) { val s = r * 1.42f / maxOf(img.w, img.h); g.image(img, cx - img.w * s / 2, cy - img.h * s / 2, img.w * s, img.h * s) }   /* no face marked: the whole picture */
            else { val side = maxOf(img.w, img.h).toFloat(); val s = r * 0.95f / (m.r * side).coerceAtLeast(1f); g.image(img, cx - m.x * img.w * s, cy - m.y * img.h * s, img.w * s, img.h * s) }
        }
        g.restore()
    }
}

/** a worry bubble tapped (plan D-01 / 13.1): what is wrong, 2–4 ways to help, or a line you write yourself */
class WorrySheet(val ws: WorldScreen, val id: String) : Overlay() {
    private val slide = Spring(0f, 1f)
    private var answer: String? = null
    private val w0 = ws.sim.person(id)?.worry
    private val line0 = w0?.let { ws.sim.society.worryLine(ws.sim.person(id)!!, it) } ?: ""
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val sim = ws.sim; val p = sim.person(id) ?: run { app.closeOverlay(); return }
        val w = p.worry ?: w0; val choices = if (answer == null) sim.society.worryChoices(id) else emptyList()
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, (s * 0.5f).coerceIn(0f, 1f)))
        val G = Dim.GUTTER; val h = 168f + choices.size * 60f + (if (answer != null) 90f else 0f) + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, app.w, h + 40, Dim.RADIUS_L, t.surface); g.fillRound(app.w / 2 - 20, y + 10, 40f, 5f, 3f, t.line); app.zone("worry:body", 0f, y, app.w, h)
        Portrait.draw(g, t, ws.lookOf(p), G + 34, y + 60, 28f, if (w?.kind in setOf("fight")) "angry" else "sad")
        val kind = w?.let { Worries.ALL[it.kind] }
        g.text(kind?.zh ?: "煩惱", G + 76, y + 50, Dim.FS_L, t.ink)
        g.text(Widgets.fit(g, p.name, Dim.FS_S, app.w - 120), G + 76, y + 74, Dim.FS_S, t.ink2)
        val line = line0
        Widgets.wrap(g, "「$line」", Dim.FS_M, app.w - G * 2 - 8, 2).forEachIndexed { i, l -> g.text(l, G + 4, y + 118 + i * 24f, Dim.FS_M, t.ink) }
        var yy = y + 156f
        if (answer != null) {
            g.fillRound(G, yy, app.w - G * 2, 52f, 16f, t.surface2); g.text(Widgets.fit(g, "${p.name}：「$answer」", Dim.FS_S + 1, app.w - G * 2 - 24), G + 12, yy + 32, Dim.FS_S + 1, t.ink); yy += 64
            Widgets.button(g, app, "worry:ok", G, yy, app.w - G * 2, 52f, "好", Kind.PRIMARY); return
        }
        for (c in choices) { Widgets.button(g, app, "wc:${c.key}", G, yy, app.w - G * 2, 50f, c.zh + if (c.line) "（自己寫）" else "", if (c == choices.first()) Kind.PRIMARY else Kind.SECONDARY, Dim.FS_S + 2); yy += 60 }
    }
    override fun tap(id: String) {
        if (id == "worry:ok") { app.closeOverlay(); return }
        if (!id.startsWith("wc:")) return
        val key = id.removePrefix("wc:"); val sim = ws.sim
        val c = sim.society.worryChoices(this.id).firstOrNull { it.key == key } ?: return
        if (c.line) app.platform.prompt("想讓${sim.person(this.id)?.name ?: "牠"}說什麼？（最多 40 字）", "", 40) { text ->
            if (text == null) return@prompt
            val r = sim.society.answerWorry(this.id, key, text)
            if (sim.person(this.id)?.worry != null) app.toast(r) else { answer = r; ws.flush() } }
        else { answer = sim.society.answerWorry(this.id, key); ws.flush() }
    }
}

/** rock-paper-scissors with you (plan L-01): watch their hands — each has a habit, and a little gesture gives it away */
class RpsSheet(val ws: WorldScreen, val id: String) : Overlay() {
    private val slide = Spring(0f, 1f)
    private var tell: String? = ws.sim.society.rpsStart(id)
    private var last: Society.RpsRound? = null
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val p = ws.sim.person(id) ?: run { app.closeOverlay(); return }
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, (s * 0.5f).coerceIn(0f, 1f)))
        val G = Dim.GUTTER; val h = 360f + app.insetBottom; val y = app.h - h * s; val W = app.w
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("rps:body", 0f, y, W, h)
        g.text("和${p.name}猜拳", G + 4, y + 44, Dim.FS_L, t.ink); g.text("三戰兩勝・看看牠的小動作", G + 4, y + 68, Dim.FS_S, t.ink2)
        val r = last
        Portrait.draw(g, t, ws.lookOf(p), W / 2, y + 128, 36f, when { r == null -> "idle"; r.result < 0 -> "happy"; r.result > 0 -> "sad"; else -> "idle" })
        g.text("你 ${r?.you ?: 0} ： ${r?.them ?: 0} ${p.name}", W / 2, y + 190, Dim.FS_M, t.ink, FontKind.UI, Align.CENTER)
        val msg = when { r == null -> tell ?: "（牠握著手，看不出來）"; r.over -> r.line; else -> "牠出了${Rps.ZH[r.theirs]}。${r.line}" + (r.nextTell?.let { "　$it" } ?: "") }
        Widgets.wrap(g, msg, Dim.FS_S + 1, W - G * 2, 2).forEachIndexed { i, l -> g.text(l, W / 2, y + 220 + i * 22f, Dim.FS_S + 1, t.ink2, FontKind.UI, Align.CENTER) }
        val bw = (W - G * 2 - 16) / 3; val by = y + h - app.insetBottom - 76
        if (r?.over == true) Widgets.button(g, app, "rps:done", G, by, W - G * 2, 52f, "好", Kind.PRIMARY)
        else Rps.ZH.forEachIndexed { i, zh -> Widgets.button(g, app, "rps:$i", G + i * (bw + 8), by, bw, 52f, zh) }
    }
    override fun tap(id: String) {
        if (id == "rps:done") { app.closeOverlay(); ws.flush(); return }
        val hand = id.removePrefix("rps:").toIntOrNull() ?: return
        last = ws.sim.society.rpsPlay(this.id, hand)
    }
}

/** talk with them (plan E-04): pick a topic, they answer in their own words; sometimes they ask you something */
class TalkSheet(val ws: WorldScreen, val id: String) : Overlay() {
    private val slide = Spring(0f, 1f)
    private var lines: List<String> = emptyList()
    private var q = ws.sim.society.question(id)
    private var asking = false
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val sim = ws.sim; val p = sim.person(id) ?: run { app.closeOverlay(); return }
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, (s * 0.5f).coerceIn(0f, 1f)))
        val G = Dim.GUTTER; val W = app.w; val h = 380f + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("talk:body", 0f, y, W, h)
        Portrait.draw(g, t, ws.lookOf(p), G + 34, y + 54, 28f, "happy")
        g.text("和${p.name}聊天", G + 76, y + 50, Dim.FS_L, t.ink); g.text("選一個話題", G + 76, y + 72, Dim.FS_S, t.ink2)
        var yy = y + 104f
        val shown = if (asking) listOf(q!!.text) else lines
        if (shown.isEmpty()) { g.text("（牠在等你開口）", G + 4, yy + 18, Dim.FS_S + 1, t.ink3); yy += 34 }
        for (l in shown.take(3)) { val ls = Widgets.wrap(g, l, Dim.FS_S + 1, W - G * 2 - 24, 2); g.fillRound(G, yy, W - G * 2, 14f + ls.size * 22f, 14f, t.surface2)
            ls.forEachIndexed { i, x -> g.text(x, G + 12, yy + 23 + i * 22f, Dim.FS_S + 1, t.ink) }; yy += 22f + ls.size * 22f }
        var x = G; var cy = y + h - app.insetBottom - 116
        val opts = if (asking) q!!.options.map { "ans:$it" to it } else sim.society.YOU_TOPICS.map { "topic:$it" to it } + listOfNotNull(q?.let { "ask" to "牠好像想問你什麼" })
        for ((k, zh) in opts) { val w = g.measure(zh, Dim.FS_S + 1) + 28; if (x + w > W - G) { x = G; cy += 52 }; x += Widgets.chip(g, app, k, x, cy, zh, k == "ask") + 8 }
    }
    override fun tap(id: String) {
        val so = ws.sim.society
        when {
            id.startsWith("topic:") -> lines = so.youChat(this.id, id.removePrefix("topic:"))
            id == "ask" -> asking = true
            id.startsWith("ans:") -> { val qq = q ?: return; lines = listOf(so.answerQuestion(this.id, qq.key, id.removePrefix("ans:"))); asking = false; q = so.question(this.id); ws.flush() }
        }
    }
}

/** how much they follow you (plan 4.2) and what you suggest or tell them to do (E-05) */
class SuggestSheet(val ws: WorldScreen, val id: String) : Overlay() {
    private val slide = Spring(0f, 1f)
    private var reply: String? = null
    private val scroll = Scroller()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val sim = ws.sim; val p = sim.person(id) ?: run { app.closeOverlay(); return }
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, (s * 0.5f).coerceIn(0f, 1f)))
        val G = Dim.GUTTER; val W = app.w; val h = min(app.h - app.insetTop - 60, 560f) + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("sug:body", 0f, y, W, h)
        g.text("${p.name}要聽誰的？", G + 4, y + 44, Dim.FS_L, t.ink)
        var x = G
        for ((k, zh) in listOf("observe" to "觀察（全自主）", "suggest" to "建議", "command" to "操控")) x += Widgets.chip(g, app, "mode:$k", x, y + 60, zh, p.control == k) + 8
        val note = when (p.control) { "observe" -> "牠完全照自己的意思過日子；你可以處理煩惱、聊天、玩遊戲"; "suggest" -> "你可以提議，牠依意願接受或婉拒，並說原因"; else -> "牠照你說的做（睡著、做不到、違反規則的除外）" }
        g.text(Widgets.fit(g, note, Dim.FS_S, W - G * 2), G + 4, y + 124, Dim.FS_S, t.ink2)
        reply?.let { g.fillRound(G, y + 138, W - G * 2, 40f, 14f, t.surface2); g.text(Widgets.fit(g, it, Dim.FS_S + 1, W - G * 2 - 24), G + 12, y + 164, Dim.FS_S + 1, t.ink) }
        if (p.control == "observe") return
        val listTop = y + 190; val listH = h - 200 - app.insetBottom
        val rows = ArrayList<Pair<String, String>>()
        for (a in sim.society.suggestable(id)) rows += "act:$a" to "去${Acts[a]!!.zh}"
        for (q in sim.life.people) if (q !== p && !q.desk) for (a in listOf("chat", "greet", "gift", "compliment", "invite_tv", "invite_rps", "comfort", "apologize")) {
            val act = SocialActs[a]!!; if (act.cond == "feud" && sim.society.feud(p.id, q.id) == null) continue
            rows += "soc:$a:${q.id}" to "找${q.name}${act.zh}"
        }
        scroll.max = maxOf(0f, rows.size * 52f - listH)
        g.save(); g.clip(0f, listTop, W, listH); val dy = -scroll.step(dt); g.translate(0f, dy); app.zoneDy = dy
        rows.forEachIndexed { i, (k, zh) -> val ry = listTop + i * 52f; if (ry + dy > listTop - 52 && ry + dy < listTop + listH) {
            if (app.pressed == "row:$k") g.fillRound(G - 6, ry, W - G * 2 + 12, 46f, 14f, t.surface2)
            g.text(zh, G + 6, ry + 30, Dim.FS_M, t.ink); app.zone("row:$k", G - 6, ry, W - G * 2 + 12, 46f) } }
        app.zoneDy = 0f; g.restore()
    }
    override fun tap(id: String) {
        val so = ws.sim.society
        when {
            id.startsWith("mode:") -> { so.setControl(this.id, id.removePrefix("mode:")); reply = null; ws.flush() }
            id.startsWith("row:act:") -> reply = so.suggest(this.id, id.removePrefix("row:act:"))
            id.startsWith("row:soc:") -> { val parts = id.removePrefix("row:soc:").split(":"); reply = so.suggest(this.id, "soc:${parts[0]}", parts[1]) }
        }
    }
}

/** the end of a day (plan J-06): three things, as a card */
class DayCardSheet(val card: DayCard, val home: String) : Overlay() {
    private val pop = Spring(0f, 1f, 260f, 22f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val k = pop.step(dt)
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, k.coerceIn(0f, 1f)))
        val w = min(app.w - 32, 360f); val x = (app.w - w) / 2
        val lines = card.lines.map { Widgets.wrap(g, it, Dim.FS_S + 1, w - 64, 2) }
        val h = 150f + lines.sumOf { it.size } * 22f + lines.size * 14f + 70; val y = (app.h - h) / 2
        g.save(); g.translate(app.w / 2, app.h / 2); val sc = 0.86f + 0.14f * k; g.scale(sc, sc); g.translate(-app.w / 2, -app.h / 2)
        Widgets.card(g, t, x, y, w, h); app.zone("dc:body", x, y, w, h)
        Widgets.sky(g, t, "moon", x + w - 40, y + 38, 16f)
        g.text("第 ${card.day} 天的結束", x + 20, y + 42, Dim.FS_L, t.ink); g.text("${home.ifBlank { "家裡" }}今天的三件事", x + 20, y + 68, Dim.FS_S, t.ink2)
        var yy = y + 100f
        lines.forEachIndexed { i, ls -> g.fillCircle(x + 30, yy + 10, 11f, t.select); g.text("${i + 1}", x + 30, yy + 15, Dim.FS_S, t.ink, FontKind.NUM, Align.CENTER)
            ls.forEachIndexed { j, l -> g.text(l, x + 50, yy + 15 + j * 22f, Dim.FS_S + 1, t.ink) }; yy += ls.size * 22f + 14 }
        Widgets.button(g, app, "dc:ok", x + 20, y + h - 70, w - 40, 52f, "晚安", Kind.PRIMARY)
        g.restore()
    }
    override fun tap(id: String) { if (id == "dc:ok") app.closeOverlay() }
}

/**
 * The timeline (plan K-03) and the mailbox (plan 4.5): every line of the world's life with filters and favourites (tap = keep it),
 * and what was sent to you — worries that waited too long, requests, day-end cards, the serial drama.
 */
class TimelineScreen(val ws: WorldScreen) : Screen() {
    private var tab = "mail"; private var filter = "all"
    private val scroll = Scroller()
    override val animating get() = true
    private val FILTERS = listOf("all" to "全部", "social" to "社交", "event" to "事件", "worry" to "煩惱", "you" to "你", "fav" to "收藏")
    private fun lines(): List<LogLine> = ws.sim.life.log.filter { l -> when (filter) { "all" -> true; "fav" -> l.fav; else -> l.kind == filter } }.reversed()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER; val so = ws.sim.society
        g.fillRect(0f, 0f, W, H, t.bg)
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back")
        g.text(if (tab == "mail") "信箱" else "時間線", G + 60, top + 42, Dim.FS_L, t.ink)
        var x = W - G - 180f
        x += Widgets.chip(g, app, "tab:mail", x, top + 14, "信箱" + so.unreadMail().let { if (it > 0) "（$it）" else "" }, tab == "mail") + 8
        Widgets.chip(g, app, "tab:log", x, top + 14, "時間線", tab == "log")
        var listTop = top + 72
        if (tab == "mail") {   /* how lively the house may be: how many things a while may ask for you (plan 4.5 打擾預算) */
            g.text("熱鬧程度", G + 4, listTop + 24, Dim.FS_S, t.ink2); var lx = G + 76f
            listOf("安靜", "普通", "熱鬧").forEachIndexed { i, zh -> lx += Widgets.chip(g, app, "lively:$i", lx, listTop, zh, ws.sim.life.soc.lively == i, 36f) + 6 }
            listTop += 50 }
        if (tab == "log") {   /* a segmented row: six equal parts */
            val sw = (W - G * 2) / FILTERS.size; g.fillRound(G, listTop, W - G * 2, 38f, 19f, t.surface2)
            FILTERS.forEachIndexed { i, (k, zh) -> val x0 = G + i * sw; if (filter == k) Widgets.card(g, t, x0 + 2, listTop + 2, sw - 4, 34f, 17f, t.select, Colors.mix(t.select, 0xFF000000.toInt(), 0.18f))
                g.text(zh, x0 + sw / 2, listTop + 24, Dim.FS_S, t.ink, FontKind.UI, Align.CENTER); app.zone("f:$k", x0, listTop - 4, sw, 46f) }
            listTop += 54 }
        val listH = H - listTop - app.insetBottom - 8
        val rows: List<Triple<String, String, String>> = if (tab == "mail") ws.sim.life.soc.mail.reversed().map { Triple("m:${it.id}", it.title, it.text + if (!it.read) "・新" else "") }
            else lines().take(200).mapIndexed { i, l -> val m = ((l.minute % 1440) + 1440) % 1440
                Triple("l:${ws.sim.life.log.indexOf(l)}", "%02d:%02d".format((m / 60).toInt(), (m % 60).toInt()) + (if (l.away) "・不在時" else "") + (if (l.fav) "・收藏" else ""), l.text) }
        val rowH = 64f
        scroll.max = maxOf(0f, rows.size * rowH - listH)
        if (rows.isEmpty()) g.text(if (tab == "mail") "信箱是空的" else "還沒有這類的事", W / 2, listTop + 60, Dim.FS_M, t.ink3, FontKind.UI, Align.CENTER)
        g.save(); g.clip(0f, listTop, W, listH); val dy = -scroll.step(dt); g.translate(0f, dy); app.zoneDy = dy
        rows.forEachIndexed { i, (k, a, b) -> val ry = listTop + i * rowH; if (ry + dy < listTop - rowH || ry + dy > listTop + listH) return@forEachIndexed
            Widgets.card(g, t, G, ry, W - G * 2, rowH - 10, 16f, if (app.pressed == k) t.surface2 else t.surface)
            g.text(Widgets.fit(g, a, Dim.FS_S - 1, W - G * 2 - 24), G + 14, ry + 20, Dim.FS_S - 1, t.ink3)
            g.text(Widgets.fit(g, b.replace("\n", "；"), Dim.FS_S + 1, W - G * 2 - 24), G + 14, ry + 42, Dim.FS_S + 1, t.ink)
            app.zone(k, G, ry, W - G * 2, rowH - 10) }
        app.zoneDy = 0f; g.restore()
    }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    override fun tap(id: String) {
        val life = ws.sim.life
        when {
            id == "back" -> app.pop()
            id.startsWith("tab:") -> { tab = id.removePrefix("tab:"); scroll.reset() }
            id.startsWith("lively:") -> { life.soc.lively = id.removePrefix("lively:").toInt(); app.toast(listOf("安靜：每 10 分鐘最多 1 件事找你", "普通：每 10 分鐘最多 2 件事找你", "熱鬧：每 10 分鐘最多 4 件事找你")[life.soc.lively]); ws.flush() }
            id.startsWith("f:") -> { filter = id.removePrefix("f:"); scroll.reset() }
            id.startsWith("l:") -> life.log.getOrNull(id.removePrefix("l:").toInt())?.let { it.fav = !it.fav; app.toast(if (it.fav) "收藏了" else "取消收藏"); ws.flush() }
            id.startsWith("m:") -> { val m = life.soc.mail.firstOrNull { it.id == id.removePrefix("m:").toInt() } ?: return; m.read = true
                val p = ws.sim.person(m.who)
                when {
                    m.kind == "worry" && p?.worry != null -> { app.pop(); app.show(WorrySheet(ws, p.id)) }
                    m.kind == "day" -> life.soc.cards.firstOrNull { "第 ${it.day} 天" in m.title }?.let { app.show(DayCardSheet(it, life.homeName)) }
                    else -> app.toast(m.text.replace("\n", "；").let { if (it.length > 22) it.take(21) + "…" else it })
                }; ws.flush() }
        }
    }
}

/** the memory ledger (plan 13.9): who they owe, who they hold a grudge against, the ideas you gave; flavours of their relationships */
class MemorySheet(val ws: WorldScreen, val id: String) : Overlay() {
    private val slide = Spring(0f, 1f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val sim = ws.sim; val p = sim.person(id) ?: run { app.closeOverlay(); return }
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, (s * 0.5f).coerceIn(0f, 1f)))
        val G = Dim.GUTTER; val W = app.w
        val mem = sim.society.memoriesOf(id).take(8)
        val rels = sim.life.rels.filter { it.from == id }.mapNotNull { r -> sim.person(r.to)?.let { q -> "${q.name}：${r.kind}" + (if (r.flavor.isNotEmpty()) "・" + r.flavor.joinToString("、") else "") + (r.pend.takeIf { it.isNotEmpty() }?.let { "（快要變成$it）" } ?: "") } }
        val h = 120f + (mem.size.coerceAtLeast(1)) * 30f + rels.size * 26f + 30 + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("mem:body", 0f, y, W, h)
        g.text("${p.name}記得的事", G + 4, y + 44, Dim.FS_L, t.ink)
        var yy = y + 76f
        if (mem.isEmpty()) { g.text("（還沒有特別記得的事）", G + 4, yy + 16, Dim.FS_S, t.ink3); yy += 30 }
        for (m in mem) { val who = if (m.about == "player") "你" else sim.person(m.about)?.name ?: "某人"
            val tag = when (m.kind) { "favor" -> "恩情"; "grudge" -> "記仇"; else -> "你的主意" }
            val col = when (m.kind) { "favor" -> t.select; "grudge" -> Colors.mix(t.alert, t.surface, 0.5f); else -> t.surface2 }
            g.fillRound(G, yy + 2, 64f, 22f, 11f, col); g.text(tag, G + 32, yy + 18, Dim.FS_S - 2, t.ink, FontKind.UI, Align.CENTER)
            g.text(Widgets.fit(g, (if (m.kind == "idea") m.what.removePrefix("你的主意：") else "$who：${m.what}") + if (m.settled) "（已經過去了）" else "", Dim.FS_S, W - G * 2 - 80), G + 72, yy + 18, Dim.FS_S, if (m.settled) t.ink3 else t.ink); yy += 30 }
        yy += 10; g.text("關係", G + 4, yy + 14, Dim.FS_S, t.ink2); yy += 22
        for (r in rels) { g.text(Widgets.fit(g, r, Dim.FS_S, W - G * 2), G + 4, yy + 14, Dim.FS_S, t.ink); yy += 26 }
    }
    override fun tap(id: String) {}
}
