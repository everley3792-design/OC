package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import app.ocshimeji.save.LibChar
import app.ocshimeji.save.Studio
import app.ocshimeji.save.media.Actions
import app.ocshimeji.save.media.Pixels
import app.ocshimeji.save.media.Raster
import app.ocshimeji.save.media.safe
import app.ocshimeji.save.paint.PaintDoc
import app.ocshimeji.save.paint.Template

/**
 * The animation studio (plan 12.6): one action at a time — frames on a timeline with their own times, loop / once / there-and-back,
 * draw a frame with the onion skin (the frames before and after shown faintly), the feet of every frame, frame events (a footstep,
 * a sound, an effect), copy from another action, mirror, batch import by file names, the procedural layers, a stage or desktop
 * preview, and the fallback chain (狀態機檢視). Nothing is saved until 儲存; leaving with changes asks first.
 */
class AnimStudio(c0: LibChar) : Screen() {
    private var c = c0
    private val studio get() = Studio(app.saves)
    private var action = "idle"
    private val frames = ArrayList<Raster>(); private val ms = ArrayList<Int>(); private val anchors = ArrayList<List<Float>>()
    private var events = HashMap<String, String>(); private var mode = "loop"
    private var sel = 0; private var dirty = false; private var onion = true; private var desk = false; private var page = 0
    override val animating get() = true
    private val thumbs = HashMap<Raster, Img>(); private val fulls = HashMap<Raster, Img>()
    private fun thumb(r: Raster) = thumbs.getOrPut(r) { val (w, h) = Pixels.fit(r.w, r.h, 96); val s = Pixels.resize(r, w, h); app.assets.pixels(s.w, s.h, s.px) }
    private fun full(r: Raster) = fulls.getOrPut(r) { val (w, h) = Pixels.fit(r.w, r.h, 384); val s = Pixels.resize(r, w, h); app.assets.pixels(s.w, s.h, s.px) }
    private fun decode(p: String): Raster? = app.saves.readFile(p.removePrefix("lib:"))?.let { app.platform.codec.safe(it) }

    override fun enter() { load("idle") }
    private fun load(a: String) {
        action = a; frames.clear(); ms.clear(); anchors.clear(); events.clear(); sel = 0; page = 0; thumbs.clear(); fulls.clear()
        val an = c.anims[a]
        if (an != null) { an.frames.forEach { p -> decode(p)?.let { frames += it } }; ms += an.ms; anchors += an.anchors; events.putAll(an.events); mode = an.playMode }
        else { mode = "loop"; if (a == "idle") decode(c.image)?.let { frames += it; ms += 400 } }
        while (ms.size < frames.size) ms += ms.lastOrNull() ?: 120
        dirty = false
    }
    private fun blank(): Raster { val f = frames.firstOrNull(); return Raster(f?.w ?: 512, f?.h ?: 512) }

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, H, t.bg)
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back")
        g.text(Widgets.fit(g, "動畫：${c.name}", Dim.FS_L, W - 180), G + 60, top + 42, Dim.FS_L, t.ink)
        Widgets.round(g, app, "chain", W - G - 24, top + 34, 22f, "list")
        // ---- preview: a little stage, or the bottom of a phone (the desktop pet)
        val py = top + 70; val ph = 200f
        if (desk) { g.fillRound(G + 40, py, W - G * 2 - 80, ph, 24f, 0xFF2E3A66.toInt()); g.fillRound(G + 52, py + 12, W - G * 2 - 104, ph - 24, 14f, 0xFF5A78C0.toInt())
            for (i in 0 until 8) g.fillRound(G + 70 + (i % 4) * 50f, py + 30 + (i / 4) * 52f, 34f, 34f, 9f, Colors.withAlpha(0xFFFFFFFF.toInt(), 0.25f)) }
        else { Widgets.card(g, t, G, py, W - G * 2, ph, 20f); g.fillRect(G + 10, py + ph - 34, W - G * 2 - 20, 2f, t.line) }
        if (frames.isNotEmpty()) {
            val i = Actors.frameIndex(frames.size, ms, mode, app.time); val f = frames[i]; val im = full(f)
            val hh = if (desk) 80f else ph - 56; val ww = hh * f.w / f.h; val a = anchors.getOrNull(i) ?: listOf(c.footX, c.footY)
            val fx = W / 2; val fy = py + ph - (if (desk) 14f else 34f)
            if (!desk) Widgets.footShadow(g, t, fx, fy, hh * 0.4f)
            g.image(im, fx - ww * a[0], fy - hh * a[1], ww, hh)
            events[i.toString()]?.let { e -> g.text(eventZh(e), W - G - 14, py + 24, Dim.FS_S, t.accentLip, FontKind.UI, Align.RIGHT) }
        } else g.text("這個動作還沒有影格", W / 2, py + ph / 2, Dim.FS_M, t.ink3, FontKind.UI, Align.CENTER)
        Widgets.chip(g, app, "desk", G + 10, py + 10, if (desk) "桌面預覽" else "舞台預覽", desk, 34f)
        // ---- the action and which animation plays for it
        var y = py + ph + 12
        val use = c.animUse[action] ?: (c.animSource != "系統預設")
        Widgets.chip(g, app, "action", G, y, "動作：${Actions.ZH[action]}（${frames.size} 格）", false, 40f)
        Widgets.chip(g, app, "use", W - G - 128, y, if (use) "用我的動畫" else "用系統的動作", use, 40f, 128f); y += 52
        // ---- the timeline (six frames a page)
        val tw = (W - G * 2 - 5 * 6) / 6; val pages = (frames.size + 1 + 5) / 6
        for (k in 0 until 6) { val i = page * 6 + k; val x = G + k * (tw + 6)
            if (i < frames.size) { val on = i == sel; Widgets.card(g, t, x, y, tw, tw + 20, 10f, if (on) Colors.mix(t.select, t.surface, 0.4f) else t.surface)
                val im = thumb(frames[i]); val kk = minOf((tw - 8) / im.w, (tw - 8) / im.h); g.image(im, x + tw / 2 - im.w * kk / 2, y + 4 + (tw - 8) / 2 - im.h * kk / 2, im.w * kk, im.h * kk)
                g.text("${ms[i]}ms", x + tw / 2, y + tw + 14, 10f, t.ink2, FontKind.NUM, Align.CENTER)
                if (events.containsKey(i.toString())) g.fillCircle(x + tw - 8, y + 8, 4f, t.accent)
                app.zone("f:$i", x, y, tw, tw + 20) }
            else if (i == frames.size) { g.fillRound(x, y, tw, tw + 20, 10f, t.surface2); Widgets.icon(g, "plus", x + tw / 2, y + (tw + 20) / 2, 14f, t.ink2); app.zone("addframe", x, y, tw, tw + 20) } }
        if (pages > 1) { g.text("${page + 1}/$pages", W - G, y - 6, 10f, t.ink3, FontKind.NUM, Align.RIGHT); app.zone("page", W - G - 40, y - 20, 40f, 20f) }
        y += tw + 30
        // ---- this frame
        val bw = (W - G * 2 - 4 * 6) / 5
        listOf("draw" to "畫這格", "dup" to "複製", "del" to "刪除", "left" to "往前", "right" to "往後").forEachIndexed { i, (id, zh) -> Widgets.button(g, app, id, G + i * (bw + 6), y, bw, 40f, zh, Kind.SECONDARY, Dim.FS_S) }
        y += 50
        Widgets.round(g, app, "ms:-", G + 20, y + 20, 18f, "minus"); g.text("${ms.getOrNull(sel) ?: 0}ms", G + 66, y + 26, Dim.FS_S, t.ink, FontKind.NUM, Align.CENTER); Widgets.round(g, app, "ms:+", G + 112, y + 20, 18f, "plus")
        Widgets.chip(g, app, "event", G + 140, y, "事件：" + (events[sel.toString()]?.let { eventZh(it) } ?: "無"), events.containsKey(sel.toString()), 40f, W - G * 2 - 140); y += 52
        // ---- the whole action
        var x = G
        for ((k, zh) in listOf("loop" to "循環", "once" to "播一次", "pingpong" to "來回")) x += Widgets.chip(g, app, "mode:$k", x, y, zh, mode == k, 38f) + 6
        Widgets.chip(g, app, "onion", W - G - 92, y, "洋蔥皮", onion, 38f, 92f); y += 48
        x = G; for ((id, zh) in listOf("align" to "自動對齊腳底", "mirror" to "左右鏡像", "copy" to "從別的動作複製", "batch" to "批次匯入")) { val w0 = g.measure(zh, Dim.FS_S + 1) + 28; if (x + w0 > W - G) { x = G; y += 46 }; x += Widgets.chip(g, app, id, x, y, zh, false, 38f) + 6 }
        y += 48
        g.text("程序動作層", G + 4, y + 24, Dim.FS_S, t.ink2); x = G + 96
        for ((k, zh) in listOf("breath" to "呼吸", "bounce" to "彈跳", "sway" to "擺盪")) x += Widgets.chip(g, app, "layer:$k", x, y, zh, k in c.procedural, 38f) + 6
        // ---- save
        val btnY = H - app.insetBottom - 70
        Widgets.button(g, app, "save", G, btnY, W - G * 2, 54f, if (dirty) "儲存「${Actions.ZH[action]}」" else "已儲存", Kind.PRIMARY, Dim.FS_M)
    }
    private fun eventZh(e: String) = when { e == "step" -> "腳步聲"; e.startsWith("sound:") -> "聲音：" + (studio.sounds().firstOrNull { it.id == e.drop(6) }?.name ?: "？"); e.startsWith("fx:") -> "特效：" + (FX_ZH[e.drop(3)] ?: e.drop(3)); else -> e }

    override fun tap(id: String) {
        when {
            id == "back" -> if (dirty) app.show(ListSheet("「${Actions.ZH[action]}」還沒儲存", listOf("save" to "儲存再離開", "drop" to "不要了，離開"), danger = setOf("drop")) { if (it == "save") { save(); app.pop() } else app.pop() }) else app.pop()
            id == "chain" -> app.show(ListSheet("每個動作現在用什麼（狀態機）", Studio.chain(c).map { (a, r) -> a to "${Actions.ZH[a]} → " + (if (r == null) "系統的程序動作" else if (r == a) "自己的動畫" else "借用「${Actions.ZH[r]}」") }) { a -> switchTo(a) })
            id == "desk" -> desk = !desk
            id == "action" -> app.show(ListSheet("哪個動作", Actions.ALL.map { a -> a to (Actions.ZH[a] + (c.anims[a]?.let { "（${it.frames.size} 格）" } ?: "")) }) { a -> switchTo(a) })
            id == "use" -> { val now = c.animUse[action] ?: (c.animSource != "系統預設"); c = c.copy(animUse = c.animUse + (action to !now)); app.saves.addLibChar(c) }
            id.startsWith("f:") -> sel = id.removePrefix("f:").toInt()
            id == "page" -> page = (page + 1) % ((frames.size + 1 + 5) / 6)
            id == "addframe" -> { frames += blank(); ms += ms.lastOrNull() ?: 120; sel = frames.size - 1; page = sel / 6; dirty = true; draw() }
            id == "draw" -> if (frames.isNotEmpty()) draw()
            id == "dup" -> if (frames.isNotEmpty()) { frames.add(sel + 1, frames[sel].copy()); ms.add(sel + 1, ms[sel]); if (anchors.size > sel) anchors.add(sel + 1, anchors[sel]); shiftEvents(sel + 1, 1); sel++; dirty = true }
            id == "del" -> if (frames.size > 1) { frames.removeAt(sel); ms.removeAt(sel); if (anchors.size > sel) anchors.removeAt(sel); events.remove(sel.toString()); shiftEvents(sel + 1, -1); sel = sel.coerceAtMost(frames.size - 1); dirty = true } else app.toast("至少要留一格")
            id == "left" -> if (sel > 0) { swap(sel, sel - 1); sel-- }
            id == "right" -> if (sel < frames.size - 1) { swap(sel, sel + 1); sel++ }
            id == "ms:-" -> if (ms.isNotEmpty()) { ms[sel] = (ms[sel] - if (ms[sel] > 200) 50 else 20).coerceAtLeast(20); dirty = true }
            id == "ms:+" -> if (ms.isNotEmpty()) { ms[sel] = (ms[sel] + if (ms[sel] >= 200) 50 else 20).coerceAtMost(5000); dirty = true }
            id == "event" -> app.show(ListSheet("第 ${sel + 1} 格發生的事", listOf("none" to "沒有", "step" to "腳步聲") + FX_ZH.map { "fx:${it.key}" to "特效：${it.value}" } + studio.sounds().filter { it.kind != "music" }.map { "sound:${it.id}" to "聲音：${it.name}" }) { e ->
                if (e == "none") events.remove(sel.toString()) else events[sel.toString()] = e; dirty = true })
            id.startsWith("mode:") -> { mode = id.removePrefix("mode:"); dirty = true }
            id == "onion" -> onion = !onion
            id == "align" -> { anchors.clear(); anchors += Studio.autoAnchors(frames); dirty = true; app.toast("每一格的腳底都對齊了") }
            id == "mirror" -> { val m = Studio.mirror(frames); frames.clear(); frames += m; anchors.replaceAll { listOf(1f - it[0], it[1]) }; thumbs.clear(); fulls.clear(); dirty = true }
            id == "copy" -> app.show(ListSheet("從哪個動作複製？", c.anims.keys.filter { it != action }.map { it to "${Actions.ZH[it]}（${c.anims[it]!!.frames.size} 格）" }) { a ->
                val an = c.anims[a] ?: return@ListSheet; frames.clear(); ms.clear(); anchors.clear(); events.clear(); an.frames.forEach { p -> decode(p)?.let { frames += it } }; ms += an.ms; anchors += an.anchors; events.putAll(an.events); mode = an.playMode; sel = 0; dirty = true })
            id == "batch" -> app.platform.pickFiles(true) { files, err -> if (files == null) { err?.let { app.toast(it) }; return@pickFiles }
                if (dirty) save()
                runCatching { studio.batchImport(c.id, files, app.platform.codec) }.onSuccess { got -> c = app.saves.libChar(c.id)!!; load(action); app.toast("匯入了：" + got.joinToString("、") { Actions.ZH[it] ?: it }) }.onFailure { app.toast(it.message ?: "匯入失敗") } }
            id.startsWith("layer:") -> { val k = id.removePrefix("layer:"); studio.setProcedural(c.id, if (k in c.procedural) c.procedural - k else c.procedural + k); c = app.saves.libChar(c.id)!! }
            id == "save" -> if (dirty) save()
        }
    }
    private fun switchTo(a: String) { if (dirty) app.show(ListSheet("「${Actions.ZH[action]}」還沒儲存", listOf("save" to "儲存再換", "drop" to "不要了"), danger = setOf("drop")) { if (it == "save") save(); load(a) }) else load(a) }
    private fun swap(a: Int, b: Int) { java.util.Collections.swap(frames, a, b); java.util.Collections.swap(ms, a, b); if (anchors.size > maxOf(a, b)) java.util.Collections.swap(anchors, a, b)
        val ea = events[a.toString()]; val eb = events[b.toString()]; events.remove(a.toString()); events.remove(b.toString()); ea?.let { events[b.toString()] = it }; eb?.let { events[a.toString()] = it }; dirty = true }
    private fun shiftEvents(from: Int, by: Int) { val moved = events.filterKeys { (it.toIntOrNull() ?: -1) >= from }; moved.keys.forEach { events.remove(it) }; moved.forEach { (k, v) -> events[(k.toInt() + by).toString()] = v } }
    /** paint this frame; the onion skin = the frames before and after as faint tracing layers (never part of the frame) */
    private fun draw() {
        val f = frames[sel]; val doc = PaintDoc(f.w, f.h, Template.CHARACTER, false)
        doc.layers[0].r.px.let { System.arraycopy(f.px, 0, it, 0, minOf(it.size, f.px.size)) }; doc.layers[0].name = "第 ${sel + 1} 格"
        if (onion) { if (sel > 0) doc.addLayer("前一格", frames[sel - 1].copy(), trace = true).opacity = 0.25f; if (sel < frames.size - 1) doc.addLayer("後一格", frames[sel + 1].copy(), trace = true).opacity = 0.15f; doc.current = 0 }
        doc.dirty = false; val at = sel
        app.push(PaintScreen(doc, name = "${c.name}・${Actions.ZH[action]}・第 ${sel + 1} 格", target = "char:${c.id}:$action:$sel") { d -> val r = d.flatten(); frames[at] = r; thumbs.remove(f); fulls.remove(f); dirty = true })
    }
    private fun save() {
        runCatching { studio.saveAnim(c.id, action, frames, ms, mode, anchors, events) }.onSuccess { c = it; dirty = false; app.toast("存好了：${Actions.ZH[action]}") }.onFailure { app.toast(it.message ?: "沒辦法存") }
    }
    override fun back(): Boolean { tap("back"); return true }
    companion object { val FX_ZH = linkedMapOf("heart" to "愛心", "sweat" to "汗滴", "anger" to "怒氣", "sparkle" to "閃亮", "shock" to "震驚", "gloom" to "黑線", "fire" to "燃燒", "soul" to "靈魂出竅", "chill" to "冷風", "stone" to "石化") }
}
