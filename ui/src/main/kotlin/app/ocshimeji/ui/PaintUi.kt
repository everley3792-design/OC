package app.ocshimeji.ui

import app.ocshimeji.save.LibItem
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.save.media.Png
import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import app.ocshimeji.save.Studio
import app.ocshimeji.save.media.Raster
import app.ocshimeji.save.paint.Layer
import app.ocshimeji.save.paint.PaintDoc
import app.ocshimeji.save.paint.Tool
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * The paint workshop (plan 12.6). One finger draws; two fingers move, zoom and turn the canvas (a second finger right after the
 * first cancels that stroke). Tools in two rows at the bottom, colour, size and opacity, layers and everything else in sheets.
 * Drafts save on their own every 20 seconds of changes; leaving with unsaved changes asks first.
 *
 * `onDone` (drawing an animation frame or an item picture): the "完成" button hands the drawing back instead of the export menu.
 */
class PaintScreen(val doc: PaintDoc, var draftId: String? = null, var name: String = "新畫布", val target: String = "", val onDone: ((PaintDoc) -> Unit)? = null) : Screen() {
    private val studio get() = Studio(app.saves)
    override val animating get() = true
    override val fps get() = 60
    // the view: canvas pixel → screen = centre + rot(scale · (p − size / 2)) + pan
    private var zoom = 1f; private var rot = 0f; private var panX = 0f; private var panY = 0f; private var fitK = 1f
    private var areaTop = 0f; private var areaBottom = 0f
    private val cx get() = app.w / 2 + panX; private val cy get() = (areaTop + areaBottom) / 2 + panY
    private val k get() = fitK * zoom
    fun toCanvas(x: Float, y: Float): Pair<Float, Float> { val dx = x - cx; val dy = y - cy; val c = cos(-rot); val s = sin(-rot); return ((dx * c - dy * s) / k + doc.w / 2f) to ((dx * s + dy * c) / k + doc.h / 2f) }
    private val imgs = HashMap<Layer, Pair<Int, Img>>()
    private fun imgOf(l: Layer): Img { val c = imgs[l]; if (c != null && c.first == l.rev) return c.second; val i = app.assets.pixels(doc.w, doc.h, l.r.px, c?.second); imgs[l] = l.rev to i; return i }
    private var saveT = 0f

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        areaTop = top + 64; areaBottom = H - app.insetBottom - 188
        fitK = min((W - 24) / doc.w, (areaBottom - areaTop - 16) / doc.h)
        if (doc.dirty) { saveT += dt; if (saveT > 20f && !doc.drawing) { autosave(); saveT = 0f } }
        g.fillRect(0f, 0f, W, H, t.surface2)
        // ---- the canvas (seamless canvases show their neighbours faintly)
        g.save(); g.clip(0f, areaTop, W, areaBottom - areaTop)
        g.translate(cx, cy); g.rotate(rot); g.scale(k, k); g.translate(-doc.w / 2f, -doc.h / 2f)
        val reps = if (doc.tile) -1..1 else 0..0
        for (ry in reps) for (rx in reps) { g.save(); g.translate(rx * doc.w.toFloat(), ry * doc.h.toFloat()); if (rx != 0 || ry != 0) g.alpha(0.35f)
            checker(g, doc.w.toFloat(), doc.h.toFloat())
            for (l in doc.layers) if (l.visible) { g.save(); g.alpha(l.opacity); g.image(imgOf(l), 0f, 0f, doc.w.toFloat(), doc.h.toFloat()); g.restore() }
            g.restore() }
        doc.selection?.let { s -> dashed(g, s[0].toFloat(), s[1].toFloat(), (s[2] - s[0]).toFloat(), (s[3] - s[1]).toFloat(), 1.5f / k, t.accentLip) }
        doc.dragLine?.let { d -> if (doc.brush.tool == Tool.SELECT) dashed(g, min(d[0], d[2]), min(d[1], d[3]), kotlin.math.abs(d[2] - d[0]), kotlin.math.abs(d[3] - d[1]), 1.5f / k, t.accentLip) else g.line(d[0], d[1], d[2], d[3], 2f / k, t.accentLip) }
        if (doc.brush.symmetry == "mirror") g.line(doc.w / 2f, 0f, doc.w / 2f, doc.h.toFloat(), 1f / k, Colors.withAlpha(t.accent, 0.5f))
        g.restore()
        // ---- top: back, name, undo / redo, save or done
        g.fillRect(0f, 0f, W, areaTop, t.bg)
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back")
        g.text(Widgets.fit(g, name, Dim.FS_M, W - 260), G + 58, top + 32, Dim.FS_M, t.ink); g.text("${doc.template.zh}・${doc.w}×${doc.h}" + if (doc.dirty) "・未存" else "", G + 58, top + 52, 11f, t.ink2)
        app.zone("rename", G + 52, top + 10, W - 280, 50f)
        Widgets.round(g, app, "undo", W - G - 152, top + 34, 20f, "undo"); if (!doc.canUndo) g.fillCircle(W - G - 152, top + 34, 20f, Colors.withAlpha(t.bg, 0.5f))
        Widgets.round(g, app, "redo", W - G - 106, top + 34, 20f, "redo"); if (!doc.canRedo) g.fillCircle(W - G - 106, top + 34, 20f, Colors.withAlpha(t.bg, 0.5f))
        Widgets.button(g, app, "done", W - G - 76, top + 12, 76f, 44f, if (onDone != null) "完成" else "存", Kind.PRIMARY, Dim.FS_S + 1)
        // ---- bottom: tools (two rows), then colour, size, opacity, layers, more
        g.fillRect(0f, areaBottom, W, H - areaBottom, t.bg)
        val tools = Tool.values(); val tw = (W - G * 2 - 16) / 5
        tools.forEachIndexed { i, tool -> val x = G + (i % 5) * (tw + 4); val y = areaBottom + 10 + (i / 5) * 44
            Widgets.chip(g, app, "tool:${tool.name}", x, y, tool.zh, doc.brush.tool == tool, 38f, tw) }
        val y2 = areaBottom + 104
        g.fillCircle(G + 24, y2 + 24, 22f, t.lip); g.fillCircle(G + 24, y2 + 22, 20f, Colors.withAlpha(0xFFFFFFFF.toInt(), 1f)); g.fillCircle(G + 24, y2 + 22, 20f, doc.brush.color)
        app.zone("color", G, y2, 48f, 48f)
        stepper(g, "size", G + 54, y2, "${doc.brush.size.toInt()}px")
        stepper(g, "alpha", G + 142, y2, "${(doc.brush.opacity * 100).toInt()}%")
        Widgets.round(g, app, "layers", W - G - 70, y2 + 24, 22f, "list")
        Widgets.round(g, app, "more", W - G - 22, y2 + 24, 22f, "more")
    }
    private fun stepper(g: Gfx, id: String, x: Float, y: Float, v: String) {
        val t = app.theme; g.fillRound(x, y + 2, 84f, 44f, 22f, t.surface)
        Widgets.icon(g, "minus", x + 15, y + 24, 9f, t.ink2); app.zone("$id:-", x, y, 30f, 48f)
        g.text(v, x + 42, y + 29, Dim.FS_S - 1, t.ink, FontKind.NUM, Align.CENTER)
        Widgets.icon(g, "plus", x + 69, y + 24, 9f, t.ink2); app.zone("$id:+", x + 54, y, 30f, 48f)
    }
    private fun checker(g: Gfx, w: Float, h: Float) { g.fillRect(0f, 0f, w, h, 0xFFFFFFFF.toInt()); val s = maxOf(8f, w / 32); var y = 0f; var r = 0; while (y < h) { var x = if (r % 2 == 0) 0f else s; while (x < w) { g.fillRect(x, y, s, s, 0xFFEDE7E0.toInt()); x += s * 2 }; y += s; r++ } }
    private fun dashed(g: Gfx, x: Float, y: Float, w: Float, h: Float, lw: Float, c: Int) { g.line(x, y, x + w, y, lw, c); g.line(x + w, y, x + w, y + h, lw, c); g.line(x + w, y + h, x, y + h, lw, c); g.line(x, y + h, x, y, lw, c) }

    // ---------------- fingers ----------------
    private var downT = 0f; private var drawingFinger = false
    private var p1x = 0f; private var p1y = 0f; private var p2x = 0f; private var p2y = 0f
    private var pinch: FloatArray? = null   /* d0, angle0, zoom0, rot0, mid x, mid y, pan x, pan y */
    override fun pointer(kind: Int, x: Float, y: Float): Boolean {
        when (kind) {
            0 -> { if (y < areaTop || y > areaBottom) return false; p1x = x; p1y = y; downT = app.time; drawingFinger = true; val (u, v) = toCanvas(x, y); doc.down(u, v, app.pressure); return true }
            1 -> { p1x = x; p1y = y; if (pinch != null) { pinchMove(); return true }; if (drawingFinger) { val (u, v) = toCanvas(x, y); doc.move(u, v, app.pressure) } }
            2 -> { if (drawingFinger) { val (u, v) = toCanvas(x, y); doc.up(u, v) }; drawingFinger = false; pinch = null }
            3 -> { if (drawingFinger) doc.cancel(); drawingFinger = false; pinch = null }
            10 -> { p2x = x; p2y = y; if (drawingFinger) { doc.cancel(); drawingFinger = false }
                pinch = floatArrayOf(max(20f, hypot(p2x - p1x, p2y - p1y)), atan2(p2y - p1y, p2x - p1x), zoom, rot, (p1x + p2x) / 2, (p1y + p2y) / 2, panX, panY) }
            11 -> { p2x = x; p2y = y; pinchMove() }
            12 -> pinch = null
        }
        return true
    }
    private fun pinchMove() {
        val p = pinch ?: return
        zoom = (p[2] * hypot(p2x - p1x, p2y - p1y) / p[0]).coerceIn(0.3f, 12f)
        rot = p[3] + (atan2(p2y - p1y, p2x - p1x) - p[1]).let { if (kotlin.math.abs(it) < 0.08f) 0f else it }   /* a little dead zone: zooming should not turn it */
        panX = p[6] + (p1x + p2x) / 2 - p[4]; panY = p[7] + (p1y + p2y) / 2 - p[5]
    }

    // ---------------- buttons ----------------
    override fun tap(id: String) {
        val b = doc.brush
        when {
            id == "back" -> askLeave()
            id == "undo" -> doc.undo()
            id == "redo" -> doc.redo()
            id == "rename" -> app.platform.prompt("畫布的名字", name, 24) { it?.trim()?.takeIf { s -> s.isNotEmpty() }?.let { s -> name = s; doc.dirty = true } }
            id == "done" -> if (onDone != null) { doc.dirty = false; app.pop(); onDone.invoke(doc) } else { autosave(); app.toast("存成草稿了：$name") }
            id.startsWith("tool:") -> { b.tool = Tool.valueOf(id.removePrefix("tool:")); if (b.tool != Tool.SELECT) doc.clearSelection() }
            id == "color" -> app.show(ColorSheet(doc))
            id == "size:-" -> b.size = max(1f, b.size - if (b.size > 20) 4f else 1f)
            id == "size:+" -> b.size = min(200f, b.size + if (b.size >= 20) 4f else 1f)
            id == "alpha:-" -> b.opacity = max(0.05f, b.opacity - 0.1f)
            id == "alpha:+" -> b.opacity = min(1f, b.opacity + 0.1f)
            id == "layers" -> app.show(LayerSheet(this))
            id == "more" -> more()
        }
    }
    fun autosave() { draftId = studio.saveDraft(draftId, doc, name, target) }
    /** leaving with changes: keep them as a draft, or leave them (the only question this screen asks) */
    private fun askLeave() {
        if (!doc.dirty) { app.pop(); return }
        app.show(ListSheet("還沒存的變更", listOf("keep" to "存成草稿再離開", "drop" to "不要了，直接離開"), subtitle = "這次畫的東西還沒有存下來", danger = setOf("drop")) { a ->
            if (a == "keep") autosave(); doc.dirty = false; app.pop() })
    }
    override fun back(): Boolean { askLeave(); return true }

    private fun more() {
        val b = doc.brush; val sel = doc.selection != null
        val rows = ArrayList<Pair<String, String>>()
        rows += "sym" to "對稱：" + when (b.symmetry) { "mirror" -> "左右"; "radial" -> "放射 ${b.radial} 份"; else -> "無" }
        rows += "stab" to "防手震：" + when { b.stabilize < 0.15f -> "關"; b.stabilize < 0.5f -> "輕"; b.stabilize < 0.75f -> "中"; else -> "強" }
        rows += "color2" to (if (b.color2 == 0) "漸層：顏色 → 透明（點一下改成顏色 → 目前顏色）" else "漸層：兩種顏色（點一下改回透明）")
        if (sel) { rows += "s:big" to "選取範圍放大"; rows += "s:small" to "選取範圍縮小"; rows += "s:rot" to "選取範圍轉 90°"; rows += "s:flip" to "選取範圍左右翻轉"; rows += "s:none" to "取消選取" }
        else rows += "s:all" to "全選（再用選取工具拖就能移動）"
        rows += "flipH" to "整個圖層左右翻轉"; rows += "clear" to "清空這個圖層"
        rows += "import" to "匯入圖片當新圖層"; rows += "trace" to "匯入描圖底稿（淡淡的，不會匯出）"
        if (onDone == null) { rows += "png" to "匯出 PNG"; rows += "char" to "存成新角色"; rows += "face" to "存成某個角色的表情"; rows += "item" to "做成物品的圖"; rows += "deco" to "存成壁紙或地板" }
        app.show(ListSheet("更多", rows, danger = setOf("clear")) { a -> moreAction(a) })
    }
    private fun moreAction(a: String) {
        val b = doc.brush
        when (a) {
            "sym" -> b.symmetry = when (b.symmetry) { "none" -> "mirror"; "mirror" -> "radial"; else -> "none" }
            "stab" -> b.stabilize = when { b.stabilize < 0.15f -> 0.3f; b.stabilize < 0.5f -> 0.6f; b.stabilize < 0.75f -> 0.85f; else -> 0f }
            "color2" -> b.color2 = if (b.color2 == 0) b.color else 0
            "s:big" -> doc.transform(scaleX = 1.25f, scaleY = 1.25f); "s:small" -> doc.transform(scaleX = 0.8f, scaleY = 0.8f)
            "s:rot" -> doc.transform(angle = (Math.PI / 2).toFloat()); "s:flip" -> doc.transform(flipH = true); "s:none" -> doc.clearSelection(); "s:all" -> { doc.selectAll(); b.tool = Tool.SELECT }
            "flipH" -> doc.flipLayer(true); "clear" -> doc.clearLayer()
            "import", "trace" -> app.platform.pickImage { img, err -> if (img == null) { err?.let { app.toast(it) }; return@pickImage }
                runCatching { doc.importLayer(Raster(img.w, img.h, img.px), if (a == "trace") "描圖底稿" else "匯入的圖", trace = a == "trace") }.onFailure { app.toast(it.message ?: "沒辦法加圖層") } }
            "png" -> { val data = Png.encode(doc.flatten()); app.platform.saveFile("$name.png", "image/png", data) { ok -> app.toast(if (ok) "匯出了 $name.png" else "沒有匯出") } }
            "char" -> runCatching { val c = studio.charFromDrawing(doc, CharSpec(name = name)); app.toast("收藏庫多了「${c.name}」"); autosave() }.onFailure { app.toast(it.message ?: "沒辦法存") }
            "face" -> { val own = app.saves.library().chars.filter { it.source != "preset" }
                if (own.isEmpty()) { app.toast("收藏庫還沒有可以改的角色"); return }
                app.show(ListSheet("誰的表情？", own.map { it.id to it.name }) { cid -> app.show(ListSheet("哪一種表情？", FACES.map { it.key to it.value }) { e ->
                    app.toast(studio.faceFromDrawing(cid, e, doc) ?: "存好了：${app.saves.libChar(cid)?.name}的「${FACES[e]}」") }) }) }
            "item" -> doc.trimmed()?.let { pic -> app.push(ItemEditor(null, pic)) } ?: app.toast("畫布是空的")
            "deco" -> app.show(ListSheet("存成", listOf("wallpaper" to "壁紙", "floor" to "地板"), subtitle = if (PaintDoc.seamless(doc.flatten())) "接縫看起來很好" else "提醒：左右或上下的邊接起來不太一樣，貼起來會看到接縫") { kind ->
                runCatching { studio.saveItem(LibItem("", name, kind), doc.flatten()) }.onSuccess { app.toast("存好了：$name（可以在家裡的「佈置」貼上）") }.onFailure { app.toast(it.message ?: "沒辦法存") } })
        }
    }
    companion object { val FACES = linkedMapOf("happy" to "開心", "angry" to "生氣", "sad" to "難過", "shy" to "害羞", "sleep" to "睡覺", "surprised" to "驚訝") }
}

/** colours (plan 12.6 調色盤＋滴管＋色票): a palette, your swatches, and a hue bar with a saturation / brightness square */
class ColorSheet(val doc: PaintDoc) : Overlay() {
    private val slide = Spring(0f, 1f)
    private var hue = 0f; private var sat = 0.6f; private var v = 0.8f
    init { val c = doc.brush.color; val hsv = rgb2hsv(c); hue = hsv[0]; sat = hsv[1]; v = hsv[2] }
    private var sq = floatArrayOf(0f, 0f, 0f); private var bar = floatArrayOf(0f, 0f, 0f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val G = Dim.GUTTER; val W = app.w
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, (s * 0.4f).coerceIn(0f, 1f)))
        val h = 440f + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("cs:body", 0f, y, W, h)
        g.text("顏色", G + 4, y + 40, Dim.FS_L, t.ink); g.fillCircle(W - G - 24, y + 32, 18f, doc.brush.color)
        val cols = PALETTE + doc.swatches; val cw = (W - G * 2) / 12
        cols.take(36).forEachIndexed { i, c -> val cx = G + (i % 12) * cw + cw / 2; val cy = y + 74 + (i / 12) * (cw + 2); g.fillCircle(cx, cy, cw / 2 - 2, c); app.zone("c:$i", cx - cw / 2, cy - cw / 2, cw, cw) }
        val rows = (min(cols.size, 36) + 11) / 12; val sy = y + 64 + rows * (cw + 2) + 10
        // the square: saturation → right, brightness → up
        val sw = W - G * 2 - 60; val sh = 150f; sq = floatArrayOf(G, sy, sw); val n = 12
        for (j in 0 until n) for (i in 0 until n) g.fillRect(G + i * sw / n, sy + j * sh / n, sw / n + 1, sh / n + 1, hsv2rgb(hue, (i + 0.5f) / n, 1f - (j + 0.5f) / n))
        g.strokeRound(G + sat * sw - 7, sy + (1 - v) * sh - 7, 14f, 14f, 7f, 3f, 0xFFFFFFFF.toInt()); app.zone("sv", G, sy, sw, sh)
        val bx = G + sw + 16; bar = floatArrayOf(bx, sy, sh)
        for (j in 0 until 24) g.fillRect(bx, sy + j * sh / 24, 40f, sh / 24 + 1, hsv2rgb(j / 24f * 360f, 0.8f, 0.95f))
        g.fillRect(bx - 2, sy + hue / 360f * sh - 2, 44f, 4f, t.ink); app.zone("hue", bx, sy, 40f, sh)
        Widgets.button(g, app, "keep", G, sy + sh + 16, (W - G * 2 - 8) / 2, 48f, "存成色票"); Widgets.button(g, app, "ok", G + (W - G * 2 + 8) / 2, sy + sh + 16, (W - G * 2 - 8) / 2, 48f, "好", Kind.PRIMARY)
    }
    override fun tap(id: String) {
        val cols = PALETTE + doc.swatches
        when {
            id.startsWith("c:") -> { doc.brush.color = cols[id.removePrefix("c:").toInt()]; val hsv = rgb2hsv(doc.brush.color); hue = hsv[0]; sat = hsv[1]; v = hsv[2] }
            id == "sv" -> { sat = ((app.tapX - sq[0]) / sq[2]).coerceIn(0f, 1f); v = (1f - (app.tapY - sq[1]) / 150f).coerceIn(0f, 1f); doc.brush.color = hsv2rgb(hue, sat, v) }
            id == "hue" -> { hue = ((app.tapY - bar[1]) / bar[2] * 360f).coerceIn(0f, 359f); doc.brush.color = hsv2rgb(hue, sat, v) }
            id == "keep" -> { doc.keepSwatch(doc.brush.color); app.toast("存成色票了") }
            id == "ok" -> app.closeOverlay()
        }
    }
    companion object {
        /** an original palette: warm browns, creams, soft pastels and a few strong colours */
        val PALETTE = listOf(0xFF4A3A30, 0xFF7A5A48, 0xFFB08868, 0xFFE8C9A8, 0xFFFFF4E4, 0xFFFFFFFF, 0xFFE05A50, 0xFFF08C6A, 0xFFF4B860, 0xFFFFE08A, 0xFF9AD08A, 0xFF5DB58A,
            0xFF6EC6C0, 0xFF7AAAD6, 0xFF5A78C0, 0xFF9A86D0, 0xFFE08AB8, 0xFFF6B2C8, 0xFF2E2A3A, 0xFF6A6478, 0xFFA8A2B4, 0xFFD8D4E0, 0xFF3A6A4A, 0xFF8A5A3A).map { it.toInt() }
        fun hsv2rgb(h: Float, s: Float, v: Float): Int { val c = v * s; val x = c * (1 - kotlin.math.abs((h / 60f) % 2 - 1)); val m = v - c
            val (r, g, b) = when { h < 60 -> Triple(c, x, 0f); h < 120 -> Triple(x, c, 0f); h < 180 -> Triple(0f, c, x); h < 240 -> Triple(0f, x, c); h < 300 -> Triple(x, 0f, c); else -> Triple(c, 0f, x) }
            fun ch(f: Float): Int { return ((f + m) * 255).toInt().coerceIn(0, 255) }
            return (0xFF shl 24) or (ch(r) shl 16) or (ch(g) shl 8) or ch(b) }
        fun rgb2hsv(c: Int): FloatArray { val r = ((c shr 16) and 255) / 255f; val g = ((c shr 8) and 255) / 255f; val b = (c and 255) / 255f
            val mx = maxOf(r, g, b); val mn = minOf(r, g, b); val d = mx - mn
            val h = when { d == 0f -> 0f; mx == r -> 60 * (((g - b) / d) % 6); mx == g -> 60 * ((b - r) / d + 2); else -> 60 * ((r - g) / d + 4) }.let { if (it < 0) it + 360 else it }
            return floatArrayOf(h, if (mx == 0f) 0f else d / mx, mx) }
    }
}

/** layers (plan 12.6): pick, show / hide, opacity, order, merge down, add, delete */
class LayerSheet(val ps: PaintScreen) : Overlay() {
    private val slide = Spring(0f, 1f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val doc = ps.doc; val G = Dim.GUTTER; val W = app.w
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, (s * 0.4f).coerceIn(0f, 1f)))
        val rowH = 58f; val h = 140f + doc.layers.size * rowH + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("ls:body", 0f, y, W, h)
        g.text("圖層", G + 4, y + 40, Dim.FS_L, t.ink); g.text("${doc.layers.size}／${PaintDoc.MAX_LAYERS}", W - G, y + 40, Dim.FS_S, t.ink2, FontKind.UI, Align.RIGHT)
        doc.layers.indices.reversed().forEachIndexed { row, i -> val l = doc.layers[i]; val ry = y + 60 + row * rowH
            if (i == doc.current) g.fillRound(G - 6, ry, W - G * 2 + 12, rowH - 6, 14f, Colors.mix(t.select, t.surface, 0.5f))
            app.zone("pick:$i", G - 6, ry, W - G * 2 - 150, rowH - 6)
            g.text(Widgets.fit(g, l.name + if (l.trace) "（描圖）" else "", Dim.FS_S + 1, W - 250), G + 6, ry + 22, Dim.FS_S + 1, if (l.visible) t.ink else t.ink3)
            g.text("不透明度 ${(l.opacity * 100).toInt()}%", G + 6, ry + 42, 11f, t.ink2)
            Widgets.round(g, app, "vis:$i", W - G - 148, ry + 26, 18f, if (l.visible) "eye" else "minus")
            Widgets.round(g, app, "op:$i", W - G - 104, ry + 26, 18f, "dots")
            Widgets.round(g, app, "up:$i", W - G - 60, ry + 26, 18f, "plus")
            Widgets.round(g, app, "dn:$i", W - G - 16, ry + 26, 18f, "minus") }
        val by = y + h - app.insetBottom - 64; val bw = (W - G * 2 - 16) / 3
        Widgets.button(g, app, "add", G, by, bw, 48f, "新圖層"); Widgets.button(g, app, "merge", G + bw + 8, by, bw, 48f, "向下合併"); Widgets.button(g, app, "del", G + (bw + 8) * 2, by, bw, 48f, "刪除", Kind.DANGER)
    }
    override fun tap(id: String) {
        val doc = ps.doc; val i = id.substringAfter(":").toIntOrNull() ?: -1
        when {
            id.startsWith("pick:") -> doc.current = i
            id.startsWith("vis:") -> doc.setVisible(i, !doc.layers[i].visible)
            id.startsWith("op:") -> doc.setOpacity(i, if (doc.layers[i].opacity <= 0.25f) 1f else doc.layers[i].opacity - 0.25f)
            id.startsWith("up:") -> if (i < doc.layers.size - 1) doc.moveLayer(i, i + 1)
            id.startsWith("dn:") -> if (i > 0) doc.moveLayer(i, i - 1)
            id == "add" -> runCatching { doc.addLayer() }.onFailure { app.toast(it.message ?: "") }
            id == "merge" -> if (!doc.mergeDown()) app.toast("最下面的圖層沒辦法再往下合併")
            id == "del" -> if (!doc.removeLayer()) app.toast("至少要留一個圖層")
        }
    }
}
