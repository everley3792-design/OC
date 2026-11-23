package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import app.ocshimeji.save.LibChar
import app.ocshimeji.save.media.Actions
import app.ocshimeji.save.media.Clip
import app.ocshimeji.save.media.Imported
import app.ocshimeji.save.media.Importer
import app.ocshimeji.save.media.Pixels
import app.ocshimeji.save.media.Png
import app.ocshimeji.save.media.Prepared
import app.ocshimeji.save.media.Raster
import app.ocshimeji.sim.chars.CharSpec

/**
 * 匯入工作室 (plan 3.2, five steps on the phone): 1 pick files → 2 check and remove the background (flood fill + finger brush)
 * → 3 framing (feet, size, which way it faces) → 4 which frames are which action (what is missing is shown as "the system's
 * motion") → 5 name and personality, then a little move-in moment in the character editor.
 * `edit` = new pictures for an existing character (its settings stay).
 */
class ImportStudio(val edit: LibChar? = null, val spec: CharSpec? = null, val onDone: ((LibChar) -> Unit)? = null) : Screen() {
    var step = 0; private set
    private var sources: List<Importer.Source> = emptyList()
    var imported: Imported? = null; private set
    var prep: Prepared? = null; private set
    private var removeBg: Boolean? = null; private var tolerance = 40
    private var cols = 4; private var rows = 1; private var ms = 120
    private var brush = "off"; private var brushR = 14f
    private var foot: Pair<Float, Float>? = null; private var facing = edit?.facing ?: 1; private var flip = edit?.flip ?: true
    private var name = spec?.name ?: edit?.name ?: "新角色"; private var height = spec?.height ?: 100
    private var original: Raster? = null
    private val list = Scroller()
    private val titles = listOf("選檔案", "檢查與去背", "取景", "分配動作", "名字")
    override val animating get() = true
    private var box = floatArrayOf(0f, 0f, 1f, 1f)
    private var preview: Img? = null; private var previewKey = 0

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, H, t.bg); g.fillGradientV(0f, 0f, W, top + 140, t.skyTop, t.bg)
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back")
        for (i in 0 until 5) g.fillRound(W / 2 - 58 + i * 24f, top + 30, if (i == step) 20f else 8f, 8f, 4f, if (i <= step) t.accent else t.lip)
        g.text(if (edit != null) "換圖片" else "匯入角色", W - G, top + 40, Dim.FS_S, t.ink2, FontKind.UI, Align.RIGHT)
        g.text(titles[step], G + 4, top + 92, Dim.FS_TITLE - 4, t.ink)
        val y0 = top + 112; val btnY = H - app.insetBottom - 76
        when (step) { 0 -> pick(g, y0); 1 -> clean(g, y0, btnY); 2 -> frameStep(g, y0, btnY); 3 -> assign(g, y0, btnY, dt); else -> naming(g, y0) }
        if (step > 0) {
            g.fillRect(0f, btnY - 12, W, H - btnY + 12, t.bg)
            Widgets.button(g, app, "next", G, btnY, W - G * 2, 56f, if (step == 4) (if (edit != null) "換好了" else "搬進收藏庫") else "下一步", Kind.PRIMARY, Dim.FS_L)
        }
    }
    // ---- 1 pick
    private fun pick(g: Gfx, y0: Float) {
        val t = app.theme; val G = Dim.GUTTER; val f = Form(app, g, G, app.w - G * 2, y0)
        f.note("支援：PNG、WebP、JPEG（單張）；PNG 序列（多選或 ZIP，用檔名分動作，例如 walk_01.png）；GIF、APNG、動態 WebP；Sprite Sheet（格子或 JSON 圖集）；角色包 .ocpkg。")
        f.button("files", "選圖片或動畫（可以多選）", Kind.PRIMARY); f.button("zip", "選 ZIP 或角色包（.ocpkg）")
        f.header("Sprite Sheet（均勻格子）", "先設好格子再選圖；有 JSON 圖集的請和圖片一起多選")
        f.stepper("cols", "每列幾格", "$cols"); f.stepper("rows", "共幾列", "$rows"); f.stepper("ms", "每格時間", "$ms ms"); f.button("sheet", "選 Sprite Sheet")
        f.note("限制：單張最大 4096 px、一個角色最多 600 格、檔案合計 64 MB。原圖會原封不動保存。", t.ink3)
    }
    // ---- 2 clean
    private fun clean(g: Gfx, y0: Float, btnY: Float) {
        val t = app.theme; val G = Dim.GUTTER; val W = app.w; val p = prep ?: return
        val avail = btnY - 12 - y0 - 200
        picture(g, y0, avail, showFoot = false)
        val f = Form(app, g, G, W - G * 2, y0 + avail + 10)
        f.chips("bg", listOf("自動去背", "保留背景"), setOf(if (removeBg == false) "保留背景" else "自動去背"))
        f.stepper("tol", "去背的範圍", "$tolerance", "背景沒去乾淨就調高")
        val single = p.clips.values.sumOf { it.frames.size } == 1
        if (single) f.chips("brush", listOf("不用筆刷", "擦掉", "補回"), setOf(when (brush) { "erase" -> "擦掉"; "restore" -> "補回"; else -> "不用筆刷" }))
        else f.note("動畫的每一格不一樣，筆刷只能用在單張圖。", t.ink3)
        for (w in p.warnings.take(2)) f.note(w, t.ink2)
    }
    /** the working picture on a checkerboard (so transparency is visible) */
    private fun picture(g: Gfx, y: Float, h: Float, showFoot: Boolean) {
        val t = app.theme; val G = Dim.GUTTER; val W = app.w; val p = prep ?: return
        g.fillRound(G, y, W - G * 2, h, 20f, t.surface2)
        g.save(); g.clip(G, y, W - G * 2, h); var cy = y; var row = 0; while (cy < y + h) { var cx = G + (row % 2) * 12f; while (cx < W - G) { g.fillRect(cx, cy, 12f, 12f, Colors.withAlpha(t.lip, 0.35f)); cx += 24 }; cy += 12; row++ }; g.restore()
        val img = preview ?: return; val k = minOf((W - G * 2 - 24) / img.w, (h - 24) / img.h); val iw = img.w * k; val ih = img.h * k; val ix = (W - iw) / 2; val iy = y + (h - ih) / 2
        box = floatArrayOf(ix, iy, iw, ih)
        g.image(img, ix, iy, iw, ih)
        app.zone("pic", ix, iy, iw, ih)
        if (showFoot) { val (fx, fy) = footNow(); g.fillCircle(ix + fx * iw, iy + fy * ih, 9f, t.accent); g.line(ix, iy + fy * ih, ix + iw, iy + fy * ih, 1.5f, Colors.withAlpha(t.accentLip, 0.7f)) }
    }
    fun footNow(): Pair<Float, Float> { val i = prep!!.info; return foot ?: if (i.transparent) (i.left + i.footX * (i.right - i.left)) / i.w to (i.bottom + 1f) / i.h else 0.5f to 1f }
    // ---- 3 framing
    private fun frameStep(g: Gfx, y0: Float, btnY: Float) {
        val G = Dim.GUTTER; val W = app.w; val avail = btnY - 12 - y0 - 230
        picture(g, y0, avail, showFoot = true)
        val f = Form(app, g, G, W - G * 2, y0 + avail + 8)
        f.note("點圖上的位置＝腳底（角色站在地上的點）。所有動作共用同一個比例。")
        f.stepper("height", "大小", "$height", "比其他角色高或矮")
        f.chips("facing", listOf("圖上朝左", "圖上朝右"), setOf(if (facing < 0) "圖上朝左" else "圖上朝右")); f.toggle("flip", "往另一邊走時翻轉", flip)
    }
    // ---- 4 actions
    private fun assign(g: Gfx, y0: Float, btnY: Float, dt: Float) {
        val t = app.theme; val G = Dim.GUTTER; val W = app.w; val p = prep ?: return
        val sc = list.step(dt); g.save(); g.clip(0f, y0, W, btnY - 12 - y0); g.translate(0f, -sc); app.zoneDy = -sc; app.zoneClip = floatArrayOf(0f, y0, W, btnY - 12 - y0)
        val f = Form(app, g, G, W - G * 2, y0)
        f.note("點一列可以改成別的動作。沒有的動作會用系統的程序動畫代替（照備用鏈）。")
        for ((a, c) in p.clips) { val id = "clip:$a"; val sink = if (app.pressed == id) 2f else 0f
            Widgets.card(g, t, G, f.y, W - G * 2, 60f, 18f, t.surface, t.lip, sink)
            g.text("${Actions.ZH[a] ?: a}（$a）", G + 16, f.y + 26 + sink, Dim.FS_M, t.ink); g.text("${c.frames.size} 格${if (c.frames.size > 1) "・每格約 ${c.ms.average().toInt()} ms" else ""}", G + 16, f.y + 47 + sink, Dim.FS_S - 1, t.ink2)
            app.zone(id, G, f.y, W - G * 2, 64f); f.y += 70 }
        val missing = listOf("walk", "sit", "sleep", "eat", "happy", "held").filter { it !in p.clips }
        if (missing.isNotEmpty()) f.note("用系統動作代替：" + missing.joinToString("、") { (Actions.ZH[it] ?: it) + (Actions.resolve(it) { x -> x in p.clips }?.takeIf { r -> r != "idle" }?.let { r -> "→${Actions.ZH[r]}" } ?: "") }, t.ink3)
        g.restore(); app.zoneDy = 0f; list.max = maxOf(0f, f.y + 20 - (btnY - 12))
    }
    // ---- 5 name
    private fun naming(g: Gfx, y0: Float) {
        val G = Dim.GUTTER; val f = Form(app, g, G, app.w - G * 2, y0)
        if (edit != null) { f.note("「${edit.name}」的設定不變，只換圖片與動作。"); return }
        f.row("name", "名字", name)
        f.note("下一步會打開角色設定：可以做性格問答、隨機、套用範本，也可以慢慢填 9 個分頁。")
    }

    // ---------------- input ----------------
    override fun tap(id: String) {
        when {
            id == "back" -> if (step == 0) app.pop() else step--
            id == "btn:files" -> app.platform.pickFiles(true) { files, err -> got(files, err, Importer.Options(removeBg = removeBg, tolerance = tolerance)) }
            id == "btn:zip" -> app.platform.pickFiles(false) { files, err -> got(files, err, Importer.Options(removeBg = removeBg, tolerance = tolerance)) }
            id == "btn:sheet" -> app.platform.pickFiles(false) { files, err -> got(files, err, Importer.Options(cols, rows, ms, removeBg = removeBg, tolerance = tolerance)) }
            id.startsWith("step:") -> { val r = id.removePrefix("step:"); val d = if (r.endsWith("+")) 1 else -1
                when (r.substringBeforeLast(':')) { "cols" -> cols = (cols + d).coerceIn(1, 32); "rows" -> rows = (rows + d).coerceIn(1, 32); "ms" -> ms = (ms + 20 * d).coerceIn(20, 2000)
                    "tol" -> { tolerance = (tolerance + 10 * d).coerceIn(0, 200); reprepare() }; "height" -> height = (height + 5 * d).coerceIn(60, 200) } }
            id == "chip:bg:自動去背" -> { removeBg = true; reprepare() }; id == "chip:bg:保留背景" -> { removeBg = false; reprepare() }
            id.startsWith("chip:brush:") -> brush = when (id.removePrefix("chip:brush:")) { "擦掉" -> "erase"; "補回" -> "restore"; else -> "off" }
            id.startsWith("chip:facing:") -> facing = if (id.endsWith("朝左")) -1 else 1
            id == "tog:flip" -> flip = !flip
            id == "pic" -> if (step == 2) foot = ((app.tapX - box[0]) / box[2]).coerceIn(0f, 1f) to ((app.tapY - box[1]) / box[3]).coerceIn(0f, 1f) else if (step == 1 && brush != "off") paint(app.tapX, app.tapY)
            id.startsWith("clip:") -> reassign(id.removePrefix("clip:"))
            id == "row:name" -> app.platform.prompt("角色的名字", name, 20) { v -> if (!v.isNullOrBlank()) name = v.trim() }
            id == "next" -> next()
        }
    }
    /** files picked: read them (every problem is said plainly), then prepare */
    fun got(files: List<Importer.Source>?, err: String?, o: Importer.Options) {
        if (err != null) { app.toast(err); return }; if (files.isNullOrEmpty()) return
        try { val im = Importer.read(files, app.platform.codec, o); sources = files; imported = im; prepare(o); step = 1 }
        catch (e: IllegalArgumentException) { app.show(ListSheet("沒辦法匯入", listOf("ok" to "好"), subtitle = e.message ?: "檔案有問題") {}) }
    }
    private fun prepare(o: Importer.Options) {
        val p = Importer.prepare(imported!!, o); prep = p; original = Importer.prepare(imported!!, Importer.Options(removeBg = false)).let { it.clips["idle"]?.frames?.firstOrNull() ?: it.clips.values.first().frames[0] }
        imported!!.pkg?.let { m -> name = m.spec?.name ?: m.name.ifBlank { name }; facing = m.facing; flip = m.flip; m.foot.takeIf { it.size == 2 }?.let { foot = it[0] to it[1] } }
        refreshPreview()
    }
    private fun reprepare() { if (imported != null) prepare(Importer.Options(removeBg = removeBg, tolerance = tolerance)) }
    private fun refreshPreview() { val p = prep ?: return; val f = p.clips["idle"]?.frames?.firstOrNull() ?: p.clips.values.first().frames[0]; previewKey++; val bytes = Png.encode(f); preview = app.assets.decode("studio:${hashCode()}:$previewKey", 512) { bytes } }
    private fun paint(x: Float, y: Float) {
        val p = prep ?: return; val f = p.clips["idle"]?.frames?.firstOrNull() ?: return; val o = original ?: return
        val px = (x - box[0]) / box[2] * f.w; val py = (y - box[1]) / box[3] * f.h
        Pixels.brush(f, if (o.w == f.w && o.h == f.h) o else f, px, py, brushR * f.w / box[2], brush == "erase"); refreshPreview()
    }
    private fun reassign(from: String) {
        app.show(ListSheet("「${Actions.ZH[from] ?: from}」改成…", Actions.ALL.map { it to "${Actions.ZH[it]}（$it）" }) { to ->
            val p = prep ?: return@ListSheet; if (to == from) return@ListSheet
            val c = p.clips.remove(from) ?: return@ListSheet; val ex = p.clips[to]
            if (ex != null) { ex.frames += c.frames; ex.ms += c.ms } else p.clips[to] = c
            if ("idle" !in p.clips) { val first = p.clips.keys.first(); p.clips["idle"] = Clip(mutableListOf(p.clips[first]!!.frames[0]), mutableListOf(120)); app.toast("沒有待機了：用「${Actions.ZH[first]}」的第一格當待機") }
            refreshPreview()
        })
    }
    private fun next() {
        when (step) {
            in 1..3 -> { step++; list.reset() }
            4 -> finish()
        }
    }
    private fun finish() {
        val p = prep ?: return
        val base = spec ?: edit?.specOf() ?: CharSpec(name = name)
        val s = (if (edit == null) base.copy(name = name) else base).copy(height = height)
        val c = app.saves.saveCharacter(p, s, facing, flip, edit?.marks ?: imported?.pkgMarks.orEmpty(), sources, edit, foot)
        if (edit != null) { app.toast("換好了"); app.pop(); return }
        onDone?.invoke(c)
        val editor = CharacterEditor(c, c.specOf(), title = "新角色") { sp, ch -> app.saves.updateLibChar(ch.copy(spec = sp)) }
        app.replace(editor); editor.preview("早安"); app.toast("${c.name}搬進了收藏庫")
    }
    override fun back(): Boolean { if (step > 0) { step--; return true }; return false }
    private var brushing = false
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) {
        if (step == 1 && brush != "off") { if (start) brushing = x >= box[0] && x <= box[0] + box[2] && y >= box[1] && y <= box[1] + box[3]; if (brushing && !start) paint(x, y); return }
        if (step == 3) list.drag(dy, y, start)
    }
    override fun release() { brushing = false; list.release() }
}
