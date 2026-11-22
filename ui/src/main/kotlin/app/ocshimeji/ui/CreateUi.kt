package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import app.ocshimeji.save.Items
import app.ocshimeji.save.Sounds
import app.ocshimeji.save.Studio
import app.ocshimeji.save.paint.PaintDoc
import app.ocshimeji.save.paint.Template
import app.ocshimeji.sim.chars.CustomTag

/** one row of a list page */
class Row(val id: String, val title: String, val sub: String = "", val img: Img? = null, val icon: String? = null, val tint: Int? = null)

/** a page: back, title, round buttons on the right, an optional header, a scrolling list of rows and one primary button */
abstract class Page(val title: String) : Screen() {
    protected val scroll = Scroller()
    override val animating get() = true
    protected val studio get() = Studio(app.saves)
    abstract fun rows(): List<Row>
    open val primary: Pair<String, String>? = null
    open val tools: List<Pair<String, String>> = emptyList()
    open val empty: String = "還沒有東西"
    /** a page inside a world shows the bottom navigation (R2): the world and which tab it is */
    open val nav: Pair<WorldScreen, String>? = null
    /** drawn above the rows; returns its height */
    open fun header(g: Gfx, x: Float, y: Float, w: Float): Float = 0f
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, H, t.bg); g.fillGradientV(0f, 0f, W, top + 120, t.skyTop, t.bg)
        val navH = if (nav != null) Nav.height(app) else 0f
        val btnY = H - app.insetBottom - 76 - navH + (if (nav != null) app.insetBottom else 0f); val listTop = top + 70; val bottom = if (primary != null) btnY - 12 else H - app.insetBottom - navH + (if (nav != null) app.insetBottom else 0f)
        val sc = scroll.step(dt)
        g.save(); g.clip(0f, listTop, W, bottom - listTop); g.translate(0f, -sc); app.zoneDy = -sc
        var y = listTop + 6 + header(g, G, listTop + 6, W - G * 2)
        val rs = rows()
        if (rs.isEmpty() && empty.isNotEmpty()) { Widgets.emptyArt(g, t, W / 2, y + 40); for ((i, l) in Widgets.wrap(g, empty, Dim.FS_M, W - 64).withIndex()) g.text(l, W / 2, y + 100 + i * 24f, Dim.FS_M, t.ink3, FontKind.UI, Align.CENTER) }
        for (r in rs) {
            val sink = if (app.pressed == r.id) Dim.LIP - 1 else 0f
            /* 2.1.0 (#05): titles and lines wrap, the row grows (it used to cut them with an ellipsis) */
            val tx0 = if (r.img != null || r.icon != null) G + 64 else G + 16
            val tl = Widgets.wrap(g, r.title, Dim.FS_M, W - tx0 - G - 50); val sl = if (r.sub.isEmpty()) emptyList() else Widgets.wrap(g, r.sub, Dim.FS_S - 1, W - tx0 - G - 50)
            val rh = maxOf(64f, 18f + tl.size * 21f + sl.size * 18f + 8f)
            Widgets.card(g, t, G, y, W - G * 2, rh, 18f, t.surface, t.lip, sink)
            var tx = G + 16
            if (r.img != null) { val k = minOf(44f / r.img.w, 44f / r.img.h); g.fillRound(G + 10, y + 10 + sink, 44f, 44f, 10f, r.tint ?: t.surface2); g.image(r.img, G + 32 - r.img.w * k / 2, y + 32 + sink - r.img.h * k / 2, r.img.w * k, r.img.h * k); tx = G + 64 }
            else if (r.icon != null) { g.fillCircle(G + 32, y + 32 + sink, 20f, r.tint ?: t.surface2); Widgets.icon(g, r.icon, G + 32, y + 32 + sink, 16f, t.ink2); tx = G + 64 }
            if (tl.size == 1 && sl.size <= 1) { g.text(tl[0], tx, y + 28 + sink, Dim.FS_M, t.ink); sl.firstOrNull()?.let { g.text(it, tx, y + 50 + sink, Dim.FS_S - 1, t.ink2) } }
            else { var ly = y + 26 + sink; tl.forEach { g.text(it, tx, ly, Dim.FS_M, t.ink); ly += 21 }; ly += 1; sl.forEach { g.text(it, tx, ly, Dim.FS_S - 1, t.ink2); ly += 18 } }
            Widgets.icon(g, "next", W - G - 20, y + rh / 2 + sink, 12f, t.ink3)
            app.zone(r.id, G, y, W - G * 2, rh + 4); y += rh + 12
        }
        g.restore(); app.zoneDy = 0f; scroll.max = maxOf(0f, y + 20 - bottom)
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back")
        g.text(title, G + 60, top + 42, Dim.FS_L, t.ink)
        tools.forEachIndexed { i, (id, icon) -> Widgets.round(g, app, id, W - G - 24 - i * 52, top + 34, 22f, icon) }
        primary?.let { (id, label) -> g.fillRect(0f, btnY - 12, W, H - btnY + 12, t.bg); Widgets.button(g, app, id, G, btnY, W - G * 2, 56f, label, Kind.PRIMARY, Dim.FS_L) }
        nav?.let { (ws, tab) -> Nav.draw(g, app, tab, Nav.badges(ws)) }
    }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    override fun resume() { scroll.reset() }
}

/** the creator suite (plan 12.6 / 12.11 M5) */
class CreateHub : Page("創作") {
    override fun rows() = listOf(
        Row("paint", "繪圖工坊", "新畫布（角色、物品、壁紙、地板、貼紙、表情）・${studio.drafts().size} 份草稿", icon = "edit", tint = 0xFFF6D0B8.toInt()),
        Row("anim", "動畫工作室", "幫收藏庫的角色做動作：影格、時間、洋蔥皮、影格事件", icon = "image", tint = 0xFFCDE6D6.toInt()),
        Row("items", "自訂物品", "食物、飲料、禮物、壁紙、地板、家具…・${studio.items().size} 個", icon = "gift", tint = 0xFFF8E0A8.toInt()),
        Row("sounds", "聲音", "匯入角色的聲音、音效、家裡的音樂・${studio.sounds().size} 個", icon = "note2", tint = 0xFFD6D0F0.toInt()),
        Row("scripts", "劇本", "自己寫的事件：積木或文字・${studio.scripts().size} 個", icon = "list", tint = 0xFFF0C8D8.toInt()),
        Row("tags", "標籤", "自己定義標籤的效果・${studio.tags().size} 個", icon = "star", tint = 0xFFCFE2F2.toInt()),
        Row("pack", "內容包工坊", "把角色、物品、劇本、標籤打包成一個 .ocmod 分享，或匯入別人的", icon = "share", tint = 0xFFE6E0F4.toInt()),
        Row("space", "空間使用", "看看哪些東西佔空間，清掉沒用到的檔案", icon = "dots"),
    )
    override fun tap(id: String) {
        when (id) {
            "back" -> app.pop()
            "paint" -> app.push(DraftsPage())
            "anim" -> { val own = app.saves.library().chars.filter { it.source != "preset" }
                if (own.isEmpty()) app.toast("收藏庫還沒有可以改的角色（內建角色可以先複製一份）")
                else app.show(ListSheet("幫誰做動畫？", own.map { it.id to it.name }) { c -> app.saves.libChar(c)?.let { app.push(AnimStudio(it)) } }) }
            "items" -> app.push(ItemsPage()); "sounds" -> app.push(SoundsPage()); "scripts" -> app.push(ScriptsPage()); "tags" -> app.push(TagsPage()); "space" -> app.push(SpacePage()); "pack" -> app.push(PackPage())
        }
    }
}

/** drafts and new canvases */
class DraftsPage : Page("繪圖工坊") {
    override val primary = "new" to "新畫布"
    override val empty = "還沒有草稿：按下面的「新畫布」開始畫"
    override fun rows() = studio.drafts().map { (id, m) -> Row("d:$id", m.name, "${Template.values().firstOrNull { it.name == m.template }?.zh ?: ""}・${m.w}×${m.h}・${m.layers.size} 個圖層" + if (m.target.isNotEmpty()) "・動畫影格" else "", icon = "edit") }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id == "new" -> app.show(ListSheet("新畫布", Template.values().map { it.name to "${it.zh}（${it.w}×${it.h}${if (it.tile) "，無縫拼接" else ""}）" }) { t ->
                val tp = Template.valueOf(t); app.push(PaintScreen(PaintDoc.of(tp), name = "新的${tp.zh}")) })
            id.startsWith("d:") -> { val did = id.removePrefix("d:")
                app.show(ListSheet(studio.drafts().firstOrNull { it.first == did }?.second?.name ?: "草稿", listOf("open" to "打開", "delete" to "刪除"), danger = setOf("delete")) { a ->
                    if (a == "open") runCatching { val (doc, m) = studio.loadDraft(did); app.push(PaintScreen(doc, did, m.name, m.target)) }.onFailure { app.toast(it.message ?: "打不開") }
                    else app.show(Confirm("刪除草稿？", "這份草稿會消失。", "刪除") { studio.deleteDraft(did) }) }) }
        }
    }
}

/** custom items (plan 12.6) */
class ItemsPage : Page("自訂物品") {
    override val primary = "new" to "新物品"
    override val tools = listOf("import" to "import")
    override val empty = "還沒有物品：可以畫一個，或匯入 .ocitem"
    override fun rows() = studio.items().map { i -> Row("i:${i.id}", i.name, "${Items.KINDS[i.kind]}・${Items.use(i.kind)}", app.assets.decode("lib:${i.image.removePrefix("lib:")}@128", 128) { app.saves.readFile(i.image.removePrefix("lib:")) }) }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id == "new" -> app.push(ItemEditor(null, null))
            id == "import" -> app.platform.openFile("application/octet-stream") { b -> if (b == null) return@openFile
                runCatching { studio.importItem(b, app.platform.codec) }.onSuccess { app.toast("匯入了「${it.name}」") }.onFailure { app.toast(it.message ?: "匯入失敗") } }
            id.startsWith("i:") -> studio.item(id.removePrefix("i:"))?.let { app.push(ItemEditor(it, null)) }
        }
    }
}

/** imported sounds (plan 12.6): voice clips for characters, effects, music for a home */
class SoundsPage : Page("聲音") {
    override val primary = "import" to "匯入聲音"
    override val empty = "還沒有聲音：可以匯入 WAV、OGG、MP3、M4A"
    override fun rows() = studio.sounds().map { s -> Row("s:${s.id}", s.name, "${Sounds.KINDS[s.kind]}・${s.format.uppercase()}" + (if (s.ms > 0) "・%.1f 秒".format(s.ms / 1000f) else "") + "・${s.bytes / 1024} KB", icon = "note2") }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id == "import" -> app.show(ListSheet("要當作什麼？", Sounds.KINDS.map { (k, zh) -> k to "$zh（最多 ${(Sounds.MAX_MS[k] ?: 0) / 1000} 秒）" }) { kind ->
                app.platform.pickFiles(false) { files, err -> val f = files?.firstOrNull() ?: run { err?.let { app.toast(it) }; return@pickFiles }
                    runCatching { studio.importSound(f.name, f.bytes, kind) }.onSuccess { app.toast("匯入了「${it.name}」") }.onFailure { app.toast(it.message ?: "匯入失敗") } } })
            id.startsWith("s:") -> { val s = studio.sounds().firstOrNull { it.id == id.removePrefix("s:") } ?: return
                val rows = listOf("play" to "播放") + (if (s.kind == "voice") listOf("voice" to "設為某個角色的聲音") else emptyList()) + listOf("delete" to "刪除")
                app.show(ListSheet(s.name, rows, danger = setOf("delete")) { a ->
                    when (a) {
                        "play" -> app.platform.clip(s.path)
                        "voice" -> { val own = app.saves.library().chars.filter { it.source != "preset" }
                            app.show(ListSheet("誰的聲音？", own.map { it.id to (it.name + if (s.id in it.voices) "（已經是）" else "") }) { cid -> val c = app.saves.libChar(cid) ?: return@ListSheet
                                studio.setVoices(cid, (c.voices + s.id).distinct()); app.toast("${c.name}說話時會用這個聲音") }) }
                        "delete" -> app.show(Confirm("刪除「${s.name}」？", "聲音檔會消失。", "刪除") { studio.deleteSound(s.id)?.let { app.toast(it) } })
                    } }) }
        }
    }
}

/** the player's tags (plan 13.9 標籤編輯器) */
class TagsPage : Page("標籤") {
    override val primary = "new" to "新標籤"
    override val empty = "還沒有自己的標籤"
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val t = app.theme; Widgets.wrap(g, "在角色的「標籤」裡寫上同樣的名字，這個標籤的效果就會作用在牠身上（下次打開那個世界時生效）。", Dim.FS_S, w, 3).forEachIndexed { i, l -> g.text(l, x + 4, y + 14 + i * 20f, Dim.FS_S, t.ink2) }
        return 76f
    }
    override fun rows() = studio.tags().map { tg -> Row("t:${tg.id}", tg.id, tg.note.ifBlank { "${tg.act.size} 個加減分・${tg.lines.size} 句台詞・${tg.concepts.size} 個概念" }, icon = "star") }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id == "new" -> app.platform.prompt("標籤的名字（最多 12 字）", "", 12) { n -> n?.trim()?.takeIf { it.isNotEmpty() }?.let { app.push(TagEditor(CustomTag(it))) } }
            id.startsWith("t:") -> studio.tags().firstOrNull { it.id == id.removePrefix("t:") }?.let { app.push(TagEditor(it)) }
        }
    }
}

/** one tag's effects */
class TagEditor(var tag: CustomTag) : Screen() {
    private val scroll = Scroller(); private var dirty = false
    override val animating get() = true
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, H, t.bg)
        val listTop = top + 70; val btnY = H - app.insetBottom - 76; val sc = scroll.step(dt)
        g.save(); g.clip(0f, listTop, W, btnY - 12 - listTop); g.translate(0f, -sc); app.zoneDy = -sc
        var y = listTop + 8
        fun title(s: String) { g.text(s, G + 4, y + 18, Dim.FS_S, t.ink2); y += 28 }
        title("說明"); Widgets.chip(g, app, "note", G, y, tag.note.ifBlank { "（點一下寫說明）" }, false, 40f, W - G * 2); y += 52
        title("喜歡做的事（加減分 0.2～3 倍）")
        for ((k, zh) in CustomTag.ACT_KEYS) { val v = tag.act[k] ?: 1f
            g.text(zh, G + 4, y + 26, Dim.FS_S + 1, t.ink); g.text("×%.1f".format(v), W - G - 100, y + 26, Dim.FS_S + 1, if (v > 1f) t.accentLip else if (v < 1f) t.alert else t.ink3, FontKind.NUM, Align.RIGHT)
            Widgets.round(g, app, "a-:$k", W - G - 70, y + 20, 16f, "minus"); Widgets.round(g, app, "a+:$k", W - G - 20, y + 20, 16f, "plus"); y += 44 }
        for ((label, list, key) in listOf(Triple("台詞（沒事時會說）", tag.lines, "line"), Triple("聊天話題", tag.topics, "topic"), Triple("概念（話題碰撞用）", tag.concepts, "concept"))) {
            title(label); var x = G
            list.forEachIndexed { i, s0 -> val w0 = g.measure(s0, Dim.FS_S + 1) + 28; if (x + w0 > W - G) { x = G; y += 48 }; x += Widgets.chip(g, app, "rm:$key:$i", x, y, s0, true, 38f) + 6 }
            if (x + 70 > W - G) { x = G; y += 48 }; Widgets.chip(g, app, "add:$key", x, y, "＋新增", false, 38f); y += 54
        }
        title("會在意的情況"); var x = G
        for ((k, zh) in CustomTag.FLAGS) { val w0 = g.measure(zh, Dim.FS_S + 1) + 28; if (x + w0 > W - G) { x = G; y += 48 }; x += Widgets.chip(g, app, "f:$k", x, y, zh, k in tag.flags, 38f) + 6 }
        y += 60
        Widgets.button(g, app, "delete", G, y, W - G * 2, 48f, "刪除這個標籤", Kind.DANGER); y += 70
        g.restore(); app.zoneDy = 0f; scroll.max = maxOf(0f, y - (btnY - 12))
        g.fillRect(0f, 0f, W, listTop, t.bg); Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back"); g.text("標籤：${tag.id}", G + 60, top + 42, Dim.FS_L, t.ink)
        g.fillRect(0f, btnY - 12, W, H, t.bg); Widgets.button(g, app, "save", G, btnY, W - G * 2, 56f, "儲存", Kind.PRIMARY, Dim.FS_L)
    }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    override fun tap(id: String) {
        val studio = Studio(app.saves)
        fun list(k: String) = when (k) { "line" -> tag.lines; "topic" -> tag.topics; else -> tag.concepts }
        fun setList(k: String, l: List<String>) { tag = when (k) { "line" -> tag.copy(lines = l); "topic" -> tag.copy(topics = l); else -> tag.copy(concepts = l) }; dirty = true }
        when {
            id == "back" -> if (dirty) app.show(ListSheet("還沒儲存", listOf("save" to "儲存再離開", "drop" to "不要了"), danger = setOf("drop")) { if (it == "save") save(studio) else app.pop() }) else app.pop()
            id == "note" -> app.platform.prompt("說明", tag.note, 40) { it?.let { s -> tag = tag.copy(note = s.trim()); dirty = true } }
            id.startsWith("a-:") || id.startsWith("a+:") -> { val k = id.substring(3); val v = ((tag.act[k] ?: 1f) + if (id.startsWith("a+")) 0.2f else -0.2f).coerceIn(0.2f, 3f)
                tag = tag.copy(act = if (kotlin.math.abs(v - 1f) < 0.05f) tag.act - k else tag.act + (k to (Math.round(v * 10) / 10f))); dirty = true }
            id.startsWith("add:") -> { val k = id.removePrefix("add:"); app.platform.prompt(if (k == "line") "一句台詞（用「我」「你」寫）" else "一個詞", "", if (k == "line") 40 else 20) { s -> s?.trim()?.takeIf { it.isNotEmpty() }?.let { setList(k, list(k) + it) } } }
            id.startsWith("rm:") -> { val (k, i) = id.removePrefix("rm:").split(":").let { it[0] to it[1].toInt() }; setList(k, list(k).filterIndexed { j, _ -> j != i }) }
            id.startsWith("f:") -> { val k = id.removePrefix("f:"); tag = tag.copy(flags = if (k in tag.flags) tag.flags - k else tag.flags + k); dirty = true }
            id == "delete" -> app.show(Confirm("刪除標籤「${tag.id}」？", "角色身上的這個名字會變回沒有效果的文字。", "刪除") { studio.deleteTag(tag.id); app.pop() })
            id == "save" -> save(studio)
        }
    }
    private fun save(studio: Studio) { val err = studio.saveTag(tag); if (err != null) app.toast(err) else { dirty = false; app.toast("存好了：${tag.id}"); app.pop() } }
    override fun back(): Boolean { tap("back"); return true }
}

/** the space page (plan P-16) */
class SpacePage : Page("空間使用") {
    private var u: Studio.Usage? = null
    override val primary = "clean" to "清掉沒用到的檔案"
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val t = app.theme; val us = u ?: studio.usage().also { u = it }; val total = us.total.coerceAtLeast(1)
        g.text("全部 ${mb(us.total)}", x + 4, y + 22, Dim.FS_M, t.ink); var yy = y + 40
        val colors = listOf(0xFFF4A259, 0xFF5DB58A, 0xFF7AAAD6, 0xFF9A86D0, 0xFFE08AB8, 0xFFB08868).map { it.toInt() }
        var bx = x; us.parts.forEachIndexed { i, (_, b, _) -> val bw = w * b / total; g.fillRect(bx, yy, bw, 16f, colors[i % colors.size]); bx += bw }; yy += 30
        us.parts.forEachIndexed { i, (zh, b, n) -> g.fillCircle(x + 10, yy + 8, 6f, colors[i % colors.size]); g.text("$zh　${mb(b)}・$n 個檔案", x + 24, yy + 13, Dim.FS_S, t.ink); yy += 26 }
        yy += 8; g.text("沒用到的檔案：${mb(us.unusedBytes)}（${us.unused.size} 個）", x + 4, yy + 14, Dim.FS_S, t.ink2)
        g.text("匯入時保留的原圖：${mb(us.originalsBytes)}", x + 4, yy + 38, Dim.FS_S, t.ink2)
        Widgets.button(g, app, "originals", x, yy + 54, w, 48f, "刪除匯入的原圖（工作圖會保留）", Kind.SECONDARY, Dim.FS_S + 1)
        return yy + 120 - y
    }
    override fun rows(): List<Row> = emptyList()
    override val empty = ""
    private fun mb(b: Long) = if (b < 1024 * 1024) "${b / 1024} KB" else "%.1f MB".format(b / 1048576f)
    override fun tap(id: String) {
        when (id) {
            "back" -> app.pop()
            "clean" -> app.show(Confirm("清掉沒用到的檔案？", "已經沒有任何角色或物品用到的圖和聲音會被刪除。", "清掉") { app.toast("清出了 ${mb(studio.cleanup(false))}"); u = null })
            "originals" -> app.show(Confirm("刪除匯入的原圖？", "之後就沒辦法用原圖重新處理，角色會照常顯示。", "刪除") { app.toast("清出了 ${mb(studio.cleanup(true))}"); u = null })
        }
    }
}


/** P-15 (1.8.0) 內容包工坊: choose what goes in, name it, export one `.ocmod`; or import one (characters, items, scripts, tags) */
class PackPage : Page("內容包工坊") {
    private val pick = LinkedHashSet<String>()
    override fun rows(): List<Row> = emptyList()
    override val empty = ""
    override val tools get() = listOf("import" to "import")
    override val primary get() = "export" to if (pick.isEmpty()) "選好再打包" else "打包 ${pick.size} 樣"
    private fun groups(): List<Pair<String, List<Pair<String, String>>>> = listOf(
        "角色" to app.saves.library().chars.filter { it.source != "preset" }.map { "c:${it.id}" to it.name },
        "物品" to studio.items().map { "i:${it.id}" to it.name },
        "劇本" to studio.scripts().map { "s:${it.id}" to it.name },
        "標籤" to studio.tags().map { "t:${it.id}" to it.id })
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val t = app.theme; var yy = y
        for (l in Widgets.wrap(g, "包裡只有資料和圖片，沒有可以執行的程式。內建角色每個人都有，不用打包。", Dim.FS_S, w - 8)) { g.text(l, x + 4, yy + 14, Dim.FS_S, t.ink2); yy += 20 }
        yy += 8
        for ((head, xs) in groups()) {
            g.text(head, x + 4, yy + 16, Dim.FS_M, t.ink); yy += 26
            if (xs.isEmpty()) { g.text("（還沒有）", x + 8, yy + 14, Dim.FS_S, t.ink3); yy += 30; continue }
            var cx = x
            for ((id, name) in xs) { val label = Widgets.fit(g, name, Dim.FS_S + 1, w - 60); if (cx + g.measure(label, Dim.FS_S + 1) + 28 > x + w) { cx = x; yy += 44 }
                cx += Widgets.chip(g, app, "pk:$id", cx, yy, label, id in pick, 38f) + 8 }
            yy += 52 }
        return yy - y
    }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id.startsWith("pk:") -> { val k = id.removePrefix("pk:"); if (!pick.remove(k)) pick += k; app.platform.sound("tick") }
            id == "export" -> { if (pick.isEmpty()) { app.toast("至少選一樣東西"); return }
                app.platform.prompt("內容包的名字", "我的內容包", 20) { n -> if (n == null) return@prompt
                    fun of(p: String) = pick.filter { it.startsWith(p) }.map { it.drop(2) }
                    val b = runCatching { studio.exportPack(n.trim(), "", of("c:"), of("i:"), of("s:"), of("t:")) }.getOrElse { app.toast(it.message ?: "打包失敗"); return@prompt }
                    app.platform.saveFile("${n.trim().ifBlank { "pack" }}.ocmod", "application/zip", b) { ok -> app.toast(if (ok) "打包好了" else "沒有存") } } }
            id == "import" -> app.platform.openFile("application/zip") { b -> if (b == null) return@openFile
                val p = runCatching { studio.readMod(b) }.getOrElse { app.toast(it.message ?: "匯入失敗"); return@openFile }
                val parts = runCatching { studio.importPackParts(b, app.platform.codec) }.getOrElse { app.toast(it.message ?: "匯入失敗"); return@openFile }
                val remap = p.needs.filter { !studio.has(it) }.associateWith { "any" }   /* a role nobody here fits → anyone */
                val n = studio.importMod(p, remap)
                app.toast("「${p.name}」：角色 ${parts.first}、物品 ${parts.second}、劇本 $n、標籤 ${p.tags.size}" + if (remap.isNotEmpty()) "（有 ${remap.size} 個角色條件改成任何人）" else "") }
        }
    }
}
