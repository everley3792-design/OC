package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.save.Presets
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.save.SlotMeta

/**
 * The first screen (plan 12.1 「觀察日誌」): every save as a card (newest first) and 「開始新的觀察」 on top.
 * A card opens its world; ⋯ gives 繼續 / 改名 / 複製 / 分支 / 刪除 (only deleting asks first).
 */
class TitleScreen : Screen() {
    private var slots: List<SlotMeta> = emptyList()
    private val scroll = Spring(0f, 0f, 300f, 30f)
    private var dragFrom = 0f; private var dragging = false; private var lastY = 0f; private var vel = 0f; private var maxScroll = 0f
    private val intro = Spring(0f, 1f, 160f, 20f)

    override fun enter() { reload() }
    override fun resume() { reload() }
    fun reload() { slots = app.saves.slots() }
    override val animating: Boolean get() = true   /* the hero breathes */

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop
        if (!dragging) { if (scroll.target < 0) scroll.target = 0f; if (scroll.target > maxScroll) scroll.target = maxScroll; if (kotlin.math.abs(vel) > 1) { scroll.target = (scroll.target + vel * dt).coerceIn(-40f, maxScroll + 40); vel *= 0.92f } }
        val sc = if (dragging) scroll.value else scroll.step(dt); val k = intro.step(dt)
        g.fillRect(0f, 0f, W, H, t.bg)
        g.fillGradientV(0f, 0f, W, top + 330 - sc * 0.5f, t.skyTop, t.skyBottom)
        clouds(g, t, sc)
        g.save(); g.translate(0f, -sc); app.zoneDy = -sc
        // ---- header
        g.text("觀察日誌", W / 2, top + 46, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER)
        g.text("OC Shimeji", W / 2, top + 88, 36f, t.ink, FontKind.NUM, Align.CENTER)
        Widgets.round(g, app, "a11y", W - Dim.GUTTER - 24, top + 40, 20f, "eye")
        // ---- hero: the preset character on a little hill (just decoration here; choosing it is in 開始新的觀察)
        val hy = top + 232f
        g.save(); g.translate(W / 2, hy + 8); g.scale(1f, 0.26f); g.fillCircle(0f, 6f, W * 0.62f, t.grassLip); g.fillCircle(0f, 0f, W * 0.62f, t.grass); g.restore()
        Widgets.footShadow(g, t, W / 2, hy, 96f)
        val img = app.assets.image("chars/cinnamon/idle.png", 512)
        g.save(); g.translate(0f, (1 - k) * 30); Widgets.character(g, img, Presets.CINNAMON, W / 2, hy, 120f, app.time); g.restore()
        // ---- list
        var y = hy + 34
        val nw = W - Dim.GUTTER * 2; val down = app.pressed == "new"; val sink = if (down) Dim.LIP - 1 else 0f
        Widgets.card(g, t, Dim.GUTTER, y, nw, 84f, Dim.RADIUS_L, t.accent, t.accentLip, sink)
        g.fillCircle(Dim.GUTTER + 42, y + 42 + sink, 22f, t.surface); Widgets.icon(g, "plus", Dim.GUTTER + 42, y + 42 + sink, 22f, t.accentLip)
        g.text("開始新的觀察", Dim.GUTTER + 78, y + 38 + sink, Dim.FS_L, t.onAccent)
        g.text("選房子和住民，看牠們自己過日子", Dim.GUTTER + 78, y + 62 + sink, Dim.FS_S, t.onAccent)
        app.zone("new", Dim.GUTTER, y, nw, 88f)
        y += 116
        g.text(if (slots.isEmpty()) "你的觀察" else "你的觀察（${slots.size}）", Dim.GUTTER + 4, y, Dim.FS_M, t.ink2)
        val iw = g.measure("匯入存檔", Dim.FS_S + 1) + 28; Widgets.chip(g, app, "importSave", W - Dim.GUTTER - iw, y - 28, "匯入存檔", false, 36f)
        val lw = g.measure("收藏庫", Dim.FS_S + 1) + 28; Widgets.chip(g, app, "library", W - Dim.GUTTER - iw - lw - 8, y - 28, "收藏庫", false, 36f)
        y += 14
        if (slots.isEmpty()) {
            Widgets.card(g, t, Dim.GUTTER, y, nw, 84f, Dim.RADIUS_L, t.surface2, t.surface2)
            g.text("還沒有任何觀察。", W / 2, y + 38, Dim.FS_M, t.ink2, FontKind.UI, Align.CENTER)
            g.text("按上面的「開始新的觀察」開始第一個。", W / 2, y + 62, Dim.FS_S, t.ink3, FontKind.UI, Align.CENTER)
            y += 100
        }
        for (s in slots) { slotCard(g, s, y, sc); y += 112 }
        g.text("1.5.1（R5 補完）", W / 2, y + 30, Dim.FS_S, t.ink3, FontKind.UI, Align.CENTER)
        g.restore(); app.zoneDy = 0f
        maxScroll = maxOf(0f, y + 60 - (H - app.insetBottom))
    }
    private fun slotCard(g: Gfx, s: SlotMeta, y: Float, @Suppress("UNUSED_PARAMETER") sc: Float) {
        val t = app.theme; val x = Dim.GUTTER; val w = app.w - Dim.GUTTER * 2; val h = 96f
        val id = "slot:${s.id}"; val sink = if (app.pressed == id) Dim.LIP - 1 else 0f
        Widgets.card(g, t, x, y, w, h, Dim.RADIUS_L, t.surface, t.lip, sink)
        app.zone(id, x, y, w - 148, h + Dim.LIP)
        // faces
        val faces = s.residents.take(3)
        faces.forEachIndexed { i, lid -> Widgets.face(g, t, app.charImg(app.saves.libChar(lid), 256), x + 36 + i * 22f, y + 48 + sink, 22f) }
        if (faces.isEmpty()) Widgets.face(g, t, null, x + 36, y + 48 + sink, 22f)
        val tx = x + 36 + (maxOf(1, faces.size) - 1) * 22f + 36
        g.text(Widgets.fit(g, s.name, Dim.FS_L, w - (tx - x) - 150), tx, y + 42 + sink, Dim.FS_L, t.ink)
        val sub = "第 ${s.day} 天・${s.residents.size} 位住民・${Format.ago(s.lastPlayed, app.platform.now())}"
        g.text(Widgets.fit(g, sub, Dim.FS_S, w - (tx - x) - 150), tx, y + 68 + sink, Dim.FS_S, t.ink2)
        /* R4: edit the world or its residents without going in */
        Widgets.round(g, app, "eww:${s.id}", x + w - 124, y + 48, 20f, "home"); Widgets.round(g, app, "ewc:${s.id}", x + w - 78, y + 48, 20f, "edit")
        Widgets.round(g, app, "more:${s.id}", x + w - 32, y + 48, 20f, "more")
    }
    private fun clouds(g: Gfx, t: Theme, sc: Float) {
        val tt = app.time; val top = app.insetTop
        for (i in 0 until 3) { val cx = ((tt * (6 + i * 3) + i * 140) % (app.w + 160)) - 80; val cy = top + 130f + i * 46 - sc * 0.4f
            g.fillCircle(cx, cy, 18f, t.cloud); g.fillCircle(cx + 20, cy - 8, 22f, t.cloud); g.fillCircle(cx + 44, cy, 17f, t.cloud); g.fillRound(cx - 8, cy, 66f, 18f, 9f, t.cloud) }
    }

    override fun tap(id: String) {
        when {
            id == "new" -> app.push(OpeningScreen())
            id == "a11y" -> app.show(A11ySheet())
            id == "library" -> app.push(LibraryScreen())
            id == "importSave" -> app.platform.openFile("application/octet-stream") { bytes -> if (bytes != null) {
                try { val m = app.saves.importSave(bytes); reload(); app.toast("匯入了「${m.name}」") } catch (e: IllegalArgumentException) { app.toast(e.message ?: "匯入失敗") } } }
            id.startsWith("slot:") -> open(id.removePrefix("slot:"))
            id.startsWith("more:") -> actions(id.removePrefix("more:"))
            id.startsWith("eww:") -> editWorld(id.removePrefix("eww:"))
            id.startsWith("ewc:") -> editChars(id.removePrefix("ewc:"))
        }
    }
    fun open(id: String) { val m = app.saves.slot(id) ?: return; app.saves.touch(id); app.push(WorldScreen(m.id)) }
    /** R4: 編輯世界 — name, relationships and romance, the clock; a backup is made before anything changes */
    fun editWorld(id: String) {
        val s = app.saves.slot(id) ?: return; val w = app.saves.loadWorld(id) ?: run { app.toast("找不到這個存檔"); return }; val life = w.life ?: run { app.toast("這個存檔要先打開一次"); return }
        app.show(ListSheet("編輯世界：${s.name}", listOf("name" to "名字：${s.name}", "rels" to "關係與戀愛（${life.people.size} 位住民）",
            "clock" to "時間：" + if (life.clockMode == "REAL") "現實時間（點一下改成遊戲時間）" else "遊戲時間（點一下改成現實時間）",
            "house" to "房子：${Houses.get(life.houseId).zh}（搬家）", "in" to "有人搬進來", "out" to "有人搬出去"), subtitle = "不用進去也能改；改之前會先備份") { k ->
            when (k) {
                "name" -> app.platform.prompt("改名", s.name, 20) { n -> if (!n.isNullOrBlank()) { app.saves.rename(id, n); reload(); app.toast("改好了") } }
                "rels" -> { if (life.people.size < 2) { app.toast("這裡只住了一位"); return@ListSheet }
                    val people = life.people.map { Triple(it.id, it.spec, app.saves.libChar(it.libId)) }
                    app.push(RelationsScreen(people, life.rels, life.romance) { r, rom -> app.host.edit(id) { sim -> applyRels(sim, r, rom) } }) }
                "clock" -> { val r = app.host.edit(id) { sim -> sim.life.clockMode = if (sim.life.clockMode == "REAL") "GAME" else "REAL"; sim.life.speed = 1.0; null }
                    app.toast(r ?: "改好了（之後打開時會先補上你不在的時間）") }
                "house" -> houseFor(id, life.houseId)
                "in" -> { val here = life.people.map { it.libId }.toSet(); val can = app.saves.library().chars.filter { it.id !in here }
                    if (can.isEmpty()) { app.toast("收藏庫裡的角色都住在這裡了"); return@ListSheet }
                    app.show(ListSheet("誰搬進來？", can.map { it.id to it.name }, subtitle = "房客規則照舊：床位、未成年要和成年的人同住") { cid ->
                        val c = app.saves.libChar(cid) ?: return@ListSheet
                        val r = app.host.edit(id) { sim -> sim.decorate.addResident("r_" + c.id, c.id, c.specOf()) }; reload(); app.toast(r ?: "${c.name}搬進來了") }) }
                "out" -> app.show(ListSheet("誰搬出去？", life.people.map { it.id to it.name }, subtitle = "牠和大家的關係會一起移除；收藏庫的原版還在") { pid ->
                    val n = life.people.firstOrNull { it.id == pid }?.name ?: return@ListSheet
                    app.show(Confirm("讓${n}搬出去？", "牠在這個世界的關係和排程會移除，無法復原（改之前有備份）。", "搬出去") {
                        val r = app.host.edit(id) { sim -> sim.decorate.removeResident(pid) }; reload(); app.toast(r ?: "${n}搬出去了") }) })
            }
        })
    }
    /** 1.5.1: move house without going in — the same rules as moving from the town (rooms, minors, the mansion opens at 5 residents) */
    private fun houseFor(id: String, current: String) {
        val all = Houses.ALL.filter { it.id != current }
        app.show(ListSheet("搬去哪裡？", all.map { h -> h.id to "${h.zh}（最多 ${h.capacity} 位）" }, subtitle = "家具會收進背包；改之前會先備份") { hid ->
            val h = Houses.get(hid); val open = app.saves.slots().any { it.residents.size >= 5 }
            val r = app.host.edit(id) { sim -> sim.decorate.moveTo(h, allowLocked = open) }; reload(); app.toast(r ?: "搬到${h.zh}了")
        })
    }
    /** R4: 編輯角色 — straight into a resident's own settings in that world */
    fun editChars(id: String) {
        val w = app.saves.loadWorld(id) ?: run { app.toast("找不到這個存檔"); return }; val life = w.life ?: run { app.toast("這個存檔要先打開一次"); return }
        app.show(ListSheet("編輯角色", life.people.map { it.id to it.name }, subtitle = "改的是這個世界裡的牠；收藏庫的原版不變") { pid ->
            val p = life.people.firstOrNull { it.id == pid } ?: return@ListSheet; val c = app.saves.libChar(p.libId) ?: return@ListSheet
            app.push(CharacterEditor(c, p.spec, world = true, title = p.name, houseId = life.houseId, housemates = life.people.size, others = life.people.filter { it.id != pid }.map { it.libId to it.name }) { spec, _ ->
                app.host.edit(id) { sim -> sim.editSpec(pid, spec); null } })
        })
    }
    private fun actions(id: String) {
        val s = app.saves.slot(id) ?: return
        app.show(ListSheet(s.name, listOf("open" to "繼續", "editWorld" to "編輯世界", "editChars" to "編輯角色", "rename" to "改名", "copy" to "複製", "branch" to "分支（從今天開出另一個「如果」）", "export" to "匯出成檔案（.ocsave）", "delete" to "刪除"),
            subtitle = "第 ${s.day} 天・玩了 ${Format.played(s.playSeconds)}", danger = setOf("delete")) { act ->
            when (act) {
                "open" -> open(id)
                "editWorld" -> editWorld(id); "editChars" -> editChars(id)
                "rename" -> app.platform.prompt("改名", s.name, 20) { n -> if (!n.isNullOrBlank()) { app.saves.rename(id, n); reload(); app.toast("改好了") } }
                "copy" -> { app.saves.copy(id); reload(); app.toast("複製了一份") }
                "branch" -> { app.saves.branch(id); reload(); app.toast("開出了一個「如果」") }
                "export" -> { val data = try { app.saves.exportSave(id) } catch (e: Exception) { app.toast("匯出失敗：${e.message}"); return@ListSheet }
                    app.platform.saveFile(s.name + ".ocsave", "application/octet-stream", data) { ok -> app.toast(if (ok) "匯出了「${s.name}」" else "沒有匯出") } }
                "delete" -> app.show(Confirm("刪除「${s.name}」？", "這個存檔會消失，無法復原。", "刪除") { app.saves.delete(id); reload(); app.toast("刪除了") })
            }
        })
    }

    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) {
        if (start) { dragFrom = scroll.value; lastY = y; vel = 0f; return }
        dragging = true; val raw = dragFrom - dy
        scroll.snap(if (raw < 0) raw * 0.4f else if (raw > maxScroll) maxScroll + (raw - maxScroll) * 0.4f else raw)
        vel = (lastY - y) * 60f * 0.5f + vel * 0.5f; lastY = y
    }
    override fun release() { dragging = false; scroll.target = scroll.value }
    override fun back(): Boolean = false
}
