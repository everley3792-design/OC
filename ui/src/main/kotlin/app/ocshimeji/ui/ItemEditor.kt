package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import app.ocshimeji.save.ItemSlot
import app.ocshimeji.save.Items
import app.ocshimeji.save.LibItem
import app.ocshimeji.save.Studio
import app.ocshimeji.save.media.Raster
import app.ocshimeji.save.paint.PaintDoc
import app.ocshimeji.save.paint.Template

/**
 * The item editor (plan 12.6): kind, pictures (front, back, side — drawn or imported), and what the kind needs: furniture gets its
 * footprint, interaction spots (tap a cell: sit → lie → stand → none) and what it offers; food its taste and how filling it is;
 * gifts the words of the people who like them. Checked before saving; warnings are shown, problems block.
 */
class ItemEditor(val orig: LibItem?, picture: Raster?) : Screen() {
    private var it0 = orig ?: LibItem("", "新物品", "food", taste = "甜")
    private var front: Raster? = picture; private var back: Raster? = null; private var side: Raster? = null
    private var dirty = picture != null
    private val scroll = Scroller()
    override val animating get() = true
    private val cache = HashMap<Raster, Img>()
    private fun img(r: Raster?): Img? = r?.let { cache.getOrPut(it) { app.assets.pixels(it.w, it.h, it.px) } }
    private fun libImg(p: String): Img? = if (p.isBlank()) null else app.assets.decode("lib:${p.removePrefix("lib:")}@256", 256) { app.saves.readFile(p.removePrefix("lib:")) }
    private val furn get() = it0.kind in setOf("furniture", "rug", "plant", "decor", "toy")

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, H, t.bg)
        val listTop = top + 70; val btnY = H - app.insetBottom - 76; val sc = scroll.step(dt)
        g.save(); g.clip(0f, listTop, W, btnY - 12 - listTop); g.translate(0f, -sc); app.zoneDy = -sc; app.zoneClip = floatArrayOf(0f, listTop, W, btnY - 12 - listTop)
        var y = listTop + 6
        fun title(s: String) { g.text(s, G + 4, y + 18, Dim.FS_S, t.ink2); y += 28 }
        // ---- pictures
        val pw = (W - G * 2 - 16) / 3
        listOf("front" to "正面", "back" to "背面", "side" to "側面").forEachIndexed { i, (k, zh) ->
            val x = G + i * (pw + 8); Widgets.card(g, t, x, y, pw, pw + 24, 16f, if (app.pressed == "pic:$k") t.surface2 else t.surface)
            val im = when (k) { "front" -> img(front) ?: libImg(it0.image); "back" -> img(back) ?: libImg(it0.back); else -> img(side) ?: libImg(it0.side) }
            if (im != null) { val kk = minOf((pw - 16) / im.w, (pw - 16) / im.h); g.image(im, x + pw / 2 - im.w * kk / 2, y + 8 + (pw - 16) / 2 - im.h * kk / 2, im.w * kk, im.h * kk) }
            else Widgets.icon(g, "plus", x + pw / 2, y + pw / 2, 18f, t.ink3)
            g.text(zh + if (k == "front") "（必要）" else "", x + pw / 2, y + pw + 14, 11f, t.ink2, FontKind.UI, Align.CENTER)
            app.zone("pic:$k", x, y, pw, pw + 24) }
        y += pw + 40
        // ---- name and kind
        title("名字"); Widgets.chip(g, app, "name", G, y, it0.name, false, 42f, W - G * 2); y += 54
        title("種類"); var x = G
        for ((k, zh) in Items.KINDS) { val w0 = g.measure(zh, Dim.FS_S + 1) + 28; if (x + w0 > W - G) { x = G; y += 48 }; x += Widgets.chip(g, app, "kind:$k", x, y, zh, it0.kind == k, 38f) + 6 }
        y += 50; Widgets.wrap(g, Items.use(it0.kind), Dim.FS_S, W - G * 2, 2).forEach { g.text(it, G + 4, y + 14, Dim.FS_S, t.accentLip); y += 20 }; y += 8
        // ---- what the kind needs
        when {
            it0.kind in setOf("food", "drink") -> {
                title("口味"); x = G; for (ts in Items.TASTES) x += Widgets.chip(g, app, "taste:$ts", x, y, ts, it0.taste == ts, 38f, 52f) + 6; y += 52
                title("飽足 ${it0.full.toInt()}（5～60）"); Widgets.round(g, app, "full:-", G + 24, y + 20, 18f, "minus"); Widgets.round(g, app, "full:+", G + 74, y + 20, 18f, "plus")
                Widgets.chip(g, app, "hot", G + 110, y, if (it0.hot) "熱的" else "冷的", it0.hot, 38f); y += 52
            }
            it0.kind == "gift" -> { title("誰會喜歡（喜好裡有這些詞的人）"); x = G
                it0.likedBy.forEachIndexed { i, s0 -> x += Widgets.chip(g, app, "rmlike:$i", x, y, s0, true, 38f) + 6 }; Widgets.chip(g, app, "addlike", x, y, "＋新增", false, 38f); y += 52 }
            furn -> {
                title("佔地 ${it0.w}×${it0.h} 格・點格子設定互動位子（坐 → 躺 → 站 → 無）")
                Widgets.round(g, app, "w:-", G + 24, y + 20, 18f, "minus"); g.text("寬", G + 50, y + 25, Dim.FS_S, t.ink2); Widgets.round(g, app, "w:+", G + 86, y + 20, 18f, "plus")
                Widgets.round(g, app, "h:-", G + 140, y + 20, 18f, "minus"); g.text("深", G + 166, y + 25, Dim.FS_S, t.ink2); Widgets.round(g, app, "h:+", G + 202, y + 20, 18f, "plus"); y += 50
                val cell = 52f
                for (j in 0 until it0.h) for (i in 0 until it0.w) { val cx = G + i * (cell + 4); val cy = y + j * (cell + 4)
                    val s = it0.slots.firstOrNull { it.dx.toInt() == i && it.dy.toInt() == j }
                    g.fillRound(cx, cy, cell, cell, 10f, if (s != null) Colors.mix(t.select, t.surface, 0.3f) else t.surface)
                    g.text(when (s?.pose) { "sit" -> "坐"; "lie" -> "躺"; "stand" -> "站"; else -> "" }, cx + cell / 2, cy + cell / 2 + 6, Dim.FS_M, t.ink, FontKind.UI, Align.CENTER)
                    app.zone("cell:$i:$j", cx, cy, cell, cell) }
                y += it0.h * (cell + 4) + 10
                title("提供的活動"); x = G; for ((k, zh) in Items.OFFERS) { val w0 = g.measure(zh, Dim.FS_S + 1) + 28; if (x + w0 > W - G) { x = G; y += 48 }; x += Widgets.chip(g, app, "offer:$k", x, y, zh, k in it0.offers, 38f) + 6 }; y += 52
                title("系列"); Widgets.chip(g, app, "series", G, y, it0.series.ifBlank { "（沒有）" }, false, 38f, W - G * 2); y += 52
            }
        }
        title("價格 ${it0.price} 星幣（市集攤位的建議價）"); Widgets.round(g, app, "price:-", G + 24, y + 20, 18f, "minus"); Widgets.round(g, app, "price:+", G + 74, y + 20, 18f, "plus"); y += 52
        title("說明"); Widgets.chip(g, app, "desc", G, y, it0.desc.ifBlank { "（點一下寫說明）" }, false, 40f, W - G * 2); y += 56
        // ---- checks
        val (bad, warn) = Items.check(it0.copy(image = if (front != null || it0.image.isNotBlank()) "x" else ""))
        (bad.map { "還不能存：$it" } + warn.map { "提醒：$it" }).forEach { s0 -> Widgets.wrap(g, s0, Dim.FS_S, W - G * 2).forEach { l -> g.text(l, G + 4, y + 14, Dim.FS_S, if (s0.startsWith("還")) t.alert else t.accentLip); y += 20 } }
        if (orig != null) { y += 12; val bw = (W - G * 2 - 8) / 2; Widgets.button(g, app, "export", G, y, bw, 48f, "匯出 .ocitem"); Widgets.button(g, app, "delete", G + bw + 8, y, bw, 48f, "刪除", Kind.DANGER); y += 60 }
        g.restore(); app.zoneDy = 0f; scroll.max = maxOf(0f, y + 20 - (btnY - 12))
        g.fillRect(0f, 0f, W, listTop, t.bg); Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back"); g.text(if (orig == null) "新物品" else it0.name, G + 60, top + 42, Dim.FS_L, t.ink)
        g.fillRect(0f, btnY - 12, W, H, t.bg); Widgets.button(g, app, "save", G, btnY, W - G * 2, 56f, "儲存", Kind.PRIMARY, Dim.FS_L)
    }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    private fun set(f: (LibItem) -> LibItem) { it0 = f(it0); dirty = true }
    override fun tap(id: String) {
        val studio = Studio(app.saves)
        when {
            id == "back" -> if (dirty) app.show(ListSheet("還沒儲存", listOf("save" to "儲存", "drop" to "不要了，離開"), danger = setOf("drop")) { if (it == "save") save(studio) else app.pop() }) else app.pop()
            id.startsWith("pic:") -> { val k = id.removePrefix("pic:")
                app.show(ListSheet("圖片", listOf("draw" to "畫一張", "import" to "匯入圖片") + (if (k != "front") listOf("clear" to "不要這張") else emptyList())) { a ->
                    when (a) {
                        "draw" -> { val doc = PaintDoc.of(Template.ITEM); (when (k) { "front" -> front; "back" -> back; else -> side })?.let { doc.importLayer(it, "原本的圖") }
                            app.push(PaintScreen(doc, name = it0.name, target = "item") { d -> d.trimmed()?.let { r -> setPic(k, r) } }) }
                        "import" -> app.platform.pickImage { im, err -> if (im == null) err?.let { app.toast(it) } else setPic(k, Raster(im.w, im.h, im.px)) }
                        "clear" -> { if (k == "back") { back = null; set { it.copy(back = "") } } else { side = null; set { it.copy(side = "") } } }
                    } }) }
            id == "name" -> app.platform.prompt("物品的名字", it0.name, 20) { s -> s?.trim()?.takeIf { it.isNotEmpty() }?.let { n -> set { it.copy(name = n) } } }
            id.startsWith("kind:") -> set { it.copy(kind = id.removePrefix("kind:")) }
            id.startsWith("taste:") -> set { it.copy(taste = id.removePrefix("taste:")) }
            id == "full:-" -> set { it.copy(full = (it.full - 5f).coerceIn(5f, 60f)) }; id == "full:+" -> set { it.copy(full = (it.full + 5f).coerceIn(5f, 60f)) }
            id == "hot" -> set { it.copy(hot = !it.hot) }
            id == "addlike" -> app.platform.prompt("喜歡這個的人，喜好裡會有的詞（例如：星星）", "", 10) { s -> s?.trim()?.takeIf { it.isNotEmpty() }?.let { w -> set { it.copy(likedBy = (it.likedBy + w).distinct().take(8)) } } }
            id.startsWith("rmlike:") -> { val i = id.removePrefix("rmlike:").toInt(); set { it.copy(likedBy = it.likedBy.filterIndexed { j, _ -> j != i }) } }
            id == "w:-" -> set { it.copy(w = (it.w - 1).coerceIn(1, 4), slots = it.slots.filter { s -> s.dx < it.w - 1 }) }; id == "w:+" -> set { it.copy(w = (it.w + 1).coerceIn(1, 4)) }
            id == "h:-" -> set { it.copy(h = (it.h - 1).coerceIn(1, 4), slots = it.slots.filter { s -> s.dy < it.h - 1 }) }; id == "h:+" -> set { it.copy(h = (it.h + 1).coerceIn(1, 4)) }
            id.startsWith("cell:") -> { val (i, j) = id.removePrefix("cell:").split(":").map { it.toInt() }
                set { item -> val s = item.slots.firstOrNull { it.dx.toInt() == i && it.dy.toInt() == j }; val rest = item.slots - listOfNotNull(s)
                    val next = when (s?.pose) { null -> "sit"; "sit" -> "lie"; "lie" -> "stand"; else -> null }
                    item.copy(slots = rest + listOfNotNull(next?.let { ItemSlot(i + 0.5f, j + 0.5f, it) })) } }
            id.startsWith("offer:") -> { val k = id.removePrefix("offer:"); set { it.copy(offers = if (k in it.offers) it.offers - k else it.offers + k) } }
            id == "series" -> app.platform.prompt("系列名稱（同系列擺在一起的加成在 M7 製作）", it0.series, 12) { s -> s?.let { v -> set { it.copy(series = v.trim()) } } }
            id == "price:-" -> set { it.copy(price = (it.price - 10).coerceIn(0, 9999)) }; id == "price:+" -> set { it.copy(price = (it.price + 10).coerceIn(0, 9999)) }
            id == "desc" -> app.platform.prompt("說明", it0.desc, 60) { s -> s?.let { v -> set { it.copy(desc = v.trim()) } } }
            id == "export" -> runCatching { studio.exportItem(it0.id) }.onSuccess { d -> app.platform.saveFile(it0.name + ".ocitem", "application/octet-stream", d) { ok -> app.toast(if (ok) "匯出了「${it0.name}」" else "沒有匯出") } }.onFailure { app.toast(it.message ?: "匯出失敗") }
            id == "delete" -> app.show(Confirm("刪除「${it0.name}」？", "這個物品和它的圖會消失。", "刪除") { studio.deleteItem(it0.id)?.let { app.toast(it) } ?: app.pop() })
            id == "save" -> save(studio)
        }
    }
    private fun setPic(k: String, r: Raster) { cache.clear(); when (k) { "front" -> front = r; "back" -> back = r; else -> side = r }; dirty = true }
    private fun save(studio: Studio) {
        runCatching { studio.saveItem(it0, front, back, side) }.onSuccess { s -> it0 = s; dirty = false; app.toast("存好了：${s.name}"); app.pop() }.onFailure { app.toast(it.message ?: "沒辦法存") }
    }
    override fun back(): Boolean { tap("back"); return true }
}
