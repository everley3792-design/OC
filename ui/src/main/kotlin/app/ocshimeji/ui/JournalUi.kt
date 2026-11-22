package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx

/** 生活紀錄 (M7): everyone's diary, titles, achievements you claim, the collection book, this week's numbers */
class JournalHub(val ws: WorldScreen) : Page("紀錄") {
    override val nav get() = ws to "records"
    private val j get() = ws.sim.journal
    override fun rows(): List<Row> {
        val life = ws.sim.life; val ready = j.ACHIEVEMENTS.count { j.claimable(it) }
        return listOf(
            Row("timeline", "時間線與信箱", "發生過的每一件事・信箱" + ws.sim.society.unreadMail().let { if (it > 0) "（$it 封新的）" else "" }, icon = "mail", tint = 0xFFE6E0F4.toInt()),
            Row("you", "和你", "訊息、拍照、小遊戲、角色卡、時光膠囊、家規" + ws.sim.you.unread().let { if (it > 0) "（$it 則新訊息）" else "" }, icon = "heart", tint = 0xFFF6D0B8.toInt()),
            Row("memory", "回憶", "回放一天的小事、收藏名場面・${life.log.count { it.fav }} 個名場面", icon = "clock", tint = 0xFFFFE9A8.toInt()),
            Row("diary", "日記", "每個人每天睡前寫的・${life.prog.diary.size} 篇", icon = "edit", tint = 0xFFF6D0B8.toInt()),
            Row("titles", "稱號", "做久了就會得到・${life.prog.titles.values.sumOf { it.size }} 個", icon = "star", tint = 0xFFF8E0A8.toInt()),
            Row("ach", "成就", if (ready > 0) "有 $ready 個可以領取" else "${life.prog.claimed.size}／${j.ACHIEVEMENTS.size} 已領取", icon = "check", tint = 0xFFCDE6D6.toInt()),
            Row("book", "圖鑑", "看過 ${life.prog.book.values.count { it >= 2 }}・擁有 ${life.prog.book.values.count { it >= 3 }}／${j.entries.size}", icon = "list", tint = 0xFFCFE2F2.toInt()),
            Row("stats", "這週的統計", j.starNow()?.let { s -> "本週之星：${ws.sim.person(s.who)?.name ?: ""}（${s.why}）" } ?: "誰最常做什麼", icon = "eye", tint = 0xFFD6D0F0.toInt()),
            Row("works", "作品集", "委託做過的作品・${life.town.works.size} 件", icon = "gift", tint = 0xFFF0C8D8.toInt()),
        )
    }
    override fun tap(id: String) {
        if (Nav.tap(app, ws, id)) return
        when (id) {
            "back" -> app.pop(); "you" -> app.push(YouHub(ws)); "timeline" -> app.push(TimelineScreen(ws)); "memory" -> app.push(MemoryScreen(ws)); "diary" -> app.push(DiaryPage(ws)); "titles" -> app.push(TitlesPage(ws)); "ach" -> app.push(AchievementsPage(ws))
            "book" -> app.push(BookPage(ws)); "stats" -> app.push(StatsPage(ws)); "works" -> app.push(PortfolioPage(ws))
        }
    }
}

/** a page that is one long text column (diary, stats): drawn in the header so it scrolls */
abstract class TextPage(title: String) : Page(title) {
    override fun rows(): List<Row> = emptyList()
    override val empty = ""
    abstract fun blocks(): List<Pair<String, List<String>>>
    open val none = "還沒有內容"
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val t = app.theme; var yy = y; val bs = blocks()
        if (bs.isEmpty()) { g.text(none, x + w / 2, yy + 60, Dim.FS_M, t.ink3, FontKind.UI, Align.CENTER); return 100f }
        for ((head, lines) in bs) {
            val ls = lines.flatMap { Widgets.wrap(g, it, Dim.FS_S + 1, w - 32, 4) }
            val h = 44f + ls.size * 23f
            Widgets.card(g, t, x, yy, w, h, 18f); g.text(head, x + 16, yy + 28, Dim.FS_S, t.accentLip)
            ls.forEachIndexed { i, l -> g.text(l, x + 16, yy + 54 + i * 23f, Dim.FS_S + 1, t.ink) }
            yy += h + 12
        }
        return yy - y
    }
    override fun tap(id: String) { if (id == "back") app.pop() }
}

class DiaryPage(val ws: WorldScreen) : TextPage("日記") {
    override val none = "第一篇日記會在明天早上出現"
    override fun blocks() = ws.sim.life.prog.diary.asReversed().take(40).map { d -> "第 ${d.day} 天・${ws.sim.person(d.who)?.name ?: ""}" to d.lines }
}
class StatsPage(val ws: WorldScreen) : TextPage("這週的統計") {
    override val none = "這週剛開始，過幾天再來看"
    override fun blocks(): List<Pair<String, List<String>>> {
        val j = ws.sim.journal
        val star = j.starNow()?.let { s -> listOf("本週之星" to listOf("${ws.sim.person(s.who)?.name ?: ""}：${s.why}")) } ?: emptyList()
        return star + j.stats().map { (title, who, n) -> title to listOf("$who（$n 次）") }
    }
}
class TitlesPage(val ws: WorldScreen) : TextPage("稱號") {
    override fun blocks(): List<Pair<String, List<String>>> = ws.sim.life.people.map { p ->
        val have = ws.sim.journal.titlesOf(p.id)
        p.name to (if (have.isEmpty()) listOf("還沒有稱號") else have.map { "「${it.zh}」${it.desc}" })
    } + ("還沒有人得到的" to ws.sim.journal.TITLES.values.filter { t -> ws.sim.life.prog.titles.values.none { t.id in it } }.map { "「${it.zh}」${it.desc}" }.ifEmpty { listOf("全部都有人得到了！") })
}
class PortfolioPage(val ws: WorldScreen) : TextPage("作品集") {
    override val none = "還沒有作品：在小鎮的「工坊委託」請住民做"
    override fun blocks() = ws.sim.life.town.works.map { (id, w) ->
        val name = ws.sim.life.items.firstOrNull { it.id == id }?.name ?: "作品"
        val avg = if (w.ratings.isEmpty()) "還沒有評分" else "評分 %.1f".format(w.ratings.average())
        name to (listOf("做了 ${w.made} 個・賣出 ${w.sold} 個・$avg") + w.comments.takeLast(3).ifEmpty { listOf("還沒有評語") })
    }
}

/** achievements: only you claim them (plan I-08) */
class AchievementsPage(val ws: WorldScreen) : Page("成就") {
    private val j get() = ws.sim.journal
    override fun rows() = j.ACHIEVEMENTS.map { a -> val got = a.id in ws.sim.life.prog.claimed; val ready = j.claimable(a)
        Row("a:${a.id}", a.zh + if (got) "（已領取）" else if (ready) "（可以領取）" else "", "${a.desc}・${a.reward} 星幣", icon = if (got || ready) "check" else "dots", tint = if (ready) 0xFFF8E0A8.toInt() else null) }
    override fun tap(id: String) {
        if (id == "back") { app.pop(); return }
        val a = id.removePrefix("a:"); val r = j.claim(a); if (r != null) app.toast(r) else { app.platform.sound("chime"); app.toast("領到了 ${j.ACHIEVEMENTS.first { it.id == a }.reward} 星幣"); ws.flush() }
    }
}

/** the collection book (plan I-07): four states — never seen, heard of, seen, owned */
class BookPage(val ws: WorldScreen) : Page("圖鑑") {
    override fun rows(): List<Row> = emptyList()
    override val empty = ""
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val t = app.theme; val book = ws.sim.life.prog.book; var yy = y
        g.text("沒見過＝？・聽說過＝淡淡的・見過＝有名字・擁有＝打勾", x + 4, yy + 16, Dim.FS_S - 1, t.ink3); yy += 30
        for ((group, items) in ws.sim.journal.entries.groupBy { it.third }) {
            g.text(group, x + 4, yy + 18, Dim.FS_S, t.accentLip); yy += 28
            val cw = (w - 12) / 3; var i = 0
            for ((id, zh, _) in items) { val st = book[id] ?: 0; val cx = x + (i % 3) * (cw + 6); val cy = yy + (i / 3) * 50f
                g.fillRound(cx, cy, cw, 44f, 14f, if (st >= 2) t.surface else Colors.mix(t.surface, t.surface2, 0.6f))
                val label = when (st) { 0 -> "？"; 1 -> zh; else -> zh }
                g.text(Widgets.fit(g, label, Dim.FS_S, cw - (if (st >= 3) 34 else 16)), cx + 10, cy + 28, Dim.FS_S, if (st == 0) t.ink3 else if (st == 1) t.ink3 else t.ink)
                if (st >= 3) Widgets.icon(g, "check", cx + cw - 16, cy + 22, 12f, t.accentLip)
                i++ }
            yy += ((items.size + 2) / 3) * 50f + 10
        }
        return yy - y
    }
    override fun tap(id: String) { if (id == "back") app.pop() }
}

/** accessibility (plan O-04): bigger text, calmer motion, how strong the vibration is */
class A11ySheet : Overlay() {
    private val slide = Spring(0f, 1f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val G = Dim.GUTTER; val W = app.w
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, (s * 0.4f).coerceIn(0f, 1f)))
        val h = 536f + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("ax:body", 0f, y, W, h)
        g.text("設定：好讀、好用", G + 4, y + 40, Dim.FS_L, t.ink)
        var yy = y + 64
        fun row(id: String, title: String, sub: String, on: Boolean) {
            g.fillRound(G, yy, W - G * 2, 64f, 18f, t.surface2); g.text(title, G + 16, yy + 28, Dim.FS_M, t.ink); g.text(Widgets.fit(g, sub, Dim.FS_S - 1, W - G * 2 - 100), G + 16, yy + 50, Dim.FS_S - 1, t.ink2)
            val sx = W - G - 70; g.fillRound(sx, yy + 18, 52f, 28f, 14f, if (on) t.select else t.lip); g.fillCircle(if (on) sx + 38 else sx + 14, yy + 32, 11f, t.surface)
            app.zone(id, G, yy, W - G * 2, 64f); yy += 72
        }
        row("ax:big", "大字", "所有文字和按鈕放大一些（重新打開 App 後生效）", app.saves.flag("a11y:big"))
        row("ax:calm", "減少動態", "不畫雨雪粒子、少一點晃動", app.saves.flag("a11y:calm"))
        row("ax:cb", "色弱友善配色", "選取改成藍色、提醒改成深橘紅，靠深淺也分得出來", app.saves.flag("a11y:cb"))
        g.text("震動", G + 4, yy + 22, Dim.FS_S, t.ink2); var x = G + 56
        val cur = when { app.saves.flag("a11y:vib0") -> "0"; app.saves.flag("a11y:vib1") -> "1"; else -> "2" }
        for ((k, zh) in listOf("0" to "關", "1" to "弱", "2" to "標準")) x += Widgets.chip(g, app, "ax:vib$k", x, yy, zh, cur == k, 38f, 64f) + 8
        /* 2.0.0 效能分級: automatic, or fixed by you */
        yy += 56; val pf = app.perf; val forced = pf.forced
        g.text("畫面品質", G + 4, yy + 22, Dim.FS_S, t.ink2); x = G + 72
        for ((k, zh) in listOf("auto" to "自動", "low" to "省電", "mid" to "標準", "high" to "高")) { val on = if (k == "auto") forced == null else forced?.name?.lowercase() == k
            x += Widgets.chip(g, app, "ax:perf:$k", x, yy, zh, on, 38f, 52f) + 6 }
        g.text(Widgets.fit(g, "現在：${pf.tier.zh}" + (if (pf.adaptive) "（這支手機：${pf.device.zh}）・每幀約 ${pf.frameMs.toInt()} 毫秒" else "") + if (forced == null && pf.adaptive) "・太慢會自動降一級" else "", Dim.FS_S - 1, W - G * 2 - 8), G + 4, yy + 62, Dim.FS_S - 1, t.ink3)
    }
    override fun tap(id: String) {
        val f = app.saves
        when (id) {
            "ax:big" -> { if (f.flag("a11y:big")) f.clearFlag("a11y:big") else f.setFlag("a11y:big"); app.toast("重新打開 App 後生效") }
            "ax:calm" -> if (f.flag("a11y:calm")) f.clearFlag("a11y:calm") else f.setFlag("a11y:calm")
            "ax:perf:auto", "ax:perf:low", "ax:perf:mid", "ax:perf:high" -> { for (k in listOf("low", "mid", "high")) f.clearFlag("perf:$k"); val k = id.removePrefix("ax:perf:"); if (k != "auto") f.setFlag("perf:$k") }
            "ax:cb" -> if (f.flag("a11y:cb")) f.clearFlag("a11y:cb") else f.setFlag("a11y:cb")
            "ax:vib0", "ax:vib1", "ax:vib2" -> { f.clearFlag("a11y:vib0"); f.clearFlag("a11y:vib1"); if (id != "ax:vib2") f.setFlag("a11y:" + id.removePrefix("ax:")); app.platform.haptic("tick") }
        }
    }
}
