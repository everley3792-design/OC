package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.save.LibChar
import app.ocshimeji.save.media.Importer
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.chars.Relations
import kotlin.math.cos
import kotlin.math.sin

/**
 * 收藏庫 (plan 12.1): every character shared by all saves. Tap one to edit it; ⋯ = 編輯, 複製一份, 匯出 .ocpkg, 刪除 (a character
 * still living in a save cannot be deleted — the save would lose it). The preset can be copied, not changed.
 */
class LibraryScreen : Screen() {
    private val scroll = Scroller()
    override val animating get() = true
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, H, t.bg); g.fillGradientV(0f, 0f, W, top + 140, t.skyTop, t.bg)
        val sc = scroll.step(dt); val listTop = top + 108; val btnY = H - app.insetBottom - 76
        g.save(); g.clip(0f, listTop, W, btnY - 12 - listTop); g.translate(0f, -sc); app.zoneDy = -sc; app.zoneClip = floatArrayOf(0f, listTop, W, btnY - 12 - listTop)
        val chars = app.saves.library().chars; val cw = (W - G * 2 - 12) / 2; var y = listTop + 6
        chars.forEachIndexed { i, c ->
            val x = G + (i % 2) * (cw + 12); if (i % 2 == 0 && i > 0) y += 214
            val id = "char:${c.id}"; val sink = if (app.pressed == id) Dim.LIP - 1 else 0f
            Widgets.card(g, t, x, y, cw, 200f, Dim.RADIUS_L, t.surface, t.lip, sink)
            val s = c.specOf(); val tint = s.tint.takeIf { it.matches(Regex("#[0-9A-Fa-f]{6}")) }?.let { Colors.hex(it) }
            g.fillRound(x + 10, y + 10 + sink, cw - 20, 120f, 16f, tint?.let { Colors.mix(it, t.surface, 0.75f) } ?: t.surface2)
            app.charImg(c, 256)?.let { img -> val k = minOf((cw - 40) / img.w, 104f / img.h); g.image(img, x + cw / 2 - img.w * k / 2, y + 122 + sink - img.h * k, img.w * k, img.h * k) }
            g.text(Widgets.fit(g, c.name, Dim.FS_M + 1, cw - 24), x + 14, y + 156 + sink, Dim.FS_M + 1, t.ink)
            val sub = (listOf(s.stage, s.species) + if (c.source == "preset") listOf("內建") else emptyList<String>()).joinToString("・") + if (c.anims.isNotEmpty()) "・${c.anims.size} 個動作" else ""
            g.text(Widgets.fit(g, sub, Dim.FS_S - 1, cw - 24), x + 14, y + 180 + sink, Dim.FS_S - 1, t.ink2)
            app.zone(id, x, y, cw, 204f); Widgets.round(g, app, "more:${c.id}", x + cw - 26, y + 26, 16f, "more")
        }
        y += 230
        g.restore(); app.zoneDy = 0f; scroll.max = maxOf(0f, y - (btnY - 12))
        g.fillRect(0f, 0f, W, listTop, Colors.withAlpha(t.bg, 0f))
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back")
        Widgets.button(g, app, "create", W - G - 96, top + 14, 96f, 42f, "創作", Kind.SECONDARY, Dim.FS_S + 1)
        g.text("收藏庫", G + 4, top + 92, Dim.FS_TITLE - 4, t.ink); g.text("${app.saves.library().chars.size} 位角色", W - G, top + 92, Dim.FS_S, t.ink2, FontKind.UI, Align.RIGHT)
        g.fillRect(0f, btnY - 12, W, H - btnY + 12, t.bg)
        Widgets.button(g, app, "import", G, btnY, W - G * 2, 56f, "匯入角色", Kind.PRIMARY, Dim.FS_L)
    }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id == "import" -> app.push(ImportStudio())
            id == "create" -> app.push(CreateHub())
            id.startsWith("char:") -> open(id.removePrefix("char:"))
            id.startsWith("more:") -> more(id.removePrefix("more:"))
        }
    }
    fun open(id: String) {
        val c = app.saves.libChar(id) ?: return
        if (c.source == "preset") { app.show(ListSheet(c.name, listOf("copy" to "複製一份來改", "look" to "只是看看"), subtitle = "內建角色不能直接修改") { if (it == "copy") copy(c) else app.push(editorFor(c, readOnly = true)) }); return }
        app.push(editorFor(c))
    }
    private fun editorFor(c: LibChar, readOnly: Boolean = false) = CharacterEditor(c, c.specOf(), title = c.name) { s, ch -> if (readOnly) "內建角色不能修改，請先複製一份" else app.saves.updateLibChar(ch.copy(spec = s)) }
    private fun copy(c: LibChar) {
        val s = c.specOf().copy(name = c.name + "（複製）")
        val n = app.saves.addLibChar(c.copy(id = "", name = s.name, source = "import", spec = s))
        app.toast("複製了一份：${n.name}"); app.push(editorFor(n))
    }
    private fun more(id: String) {
        val c = app.saves.libChar(id) ?: return; val preset = c.source == "preset"
        val rows = if (preset) listOf("copy" to "複製一份來改") else listOf("edit" to "編輯", "anim" to "動畫工作室", "copy" to "複製一份", "export" to "匯出成角色包（.ocpkg）", "delete" to "刪除")
        app.show(ListSheet(c.name, rows, danger = setOf("delete")) { a ->
            when (a) {
                "edit" -> open(id); "copy" -> copy(c); "anim" -> app.push(AnimStudio(c))
                "export" -> { val data = try { app.saves.exportPkg(id) } catch (e: Exception) { app.toast(e.message ?: "匯出失敗"); return@ListSheet }
                    app.platform.saveFile(c.name + ".ocpkg", "application/octet-stream", data) { ok -> app.toast(if (ok) "匯出了「${c.name}」" else "沒有匯出") } }
                "delete" -> { val why = app.saves.slots().filter { id in it.residents }.takeIf { it.isNotEmpty() }?.let { "還住在：" + it.joinToString("、") { s -> s.name } }
                    if (why != null) app.toast(why) else app.show(Confirm("刪除「${c.name}」？", "收藏庫裡的這位角色和圖片會消失。", "刪除") { app.saves.removeLibChar(id)?.let { app.toast(it) } ?: app.toast("刪除了") }) }
            }
        })
    }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
}

/**
 * 關係圖 (plan 12.5): everyone on a circle, a line for every relationship (colour = kind). Tap two faces (or a pair below) to set
 * both directions — A → B and B → A are separate, so a one-sided crush is just that. Romance is off unless turned on, and never
 * for minors; family lets a minor share a room with an adult.
 * `people` = (id, name, spec, picture-owner). `save` returns an error or null.
 */
class RelationsScreen(val people: List<Triple<String, CharSpec, LibChar?>>, rels0: List<Rel>, romance0: Boolean, val save: (List<Rel>, Boolean) -> String?) : Screen() {
    val rels = ArrayList(rels0); var romance = romance0; private var first: String? = null
    private val scroll = Scroller()
    override val animating get() = true
    fun rel(a: String, b: String) = rels.firstOrNull { it.from == a && it.to == b }
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, H, t.bg)
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back"); g.text("關係", G + 4, top + 92, Dim.FS_TITLE - 4, t.ink)
        // ---- the graph
        val cy = top + 230f; val cx = W / 2; val r = minOf(W * 0.32f, 110f); val n = people.size
        val pos = people.mapIndexed { i, (id, _, _) -> val a = -Math.PI / 2 + i * 2 * Math.PI / n; id to (cx + cos(a).toFloat() * r to cy + sin(a).toFloat() * r) }.toMap()
        for (x in rels) { val p1 = pos[x.from] ?: continue; val p2 = pos[x.to] ?: continue; val back = rel(x.to, x.from); val off = if (back != null) 4f else 0f
            val dx = p2.second - p1.second; val dy = -(p2.first - p1.first); val len = kotlin.math.hypot(dx, dy).coerceAtLeast(1f)
            g.line(p1.first + dx / len * off, p1.second + dy / len * off, p2.first + dx / len * off, p2.second + dy / len * off, 3f, kindColor(t, x.kind)) }
        people.forEach { (id, s, c) -> val (px, py) = pos[id]!!; val on = first == id
            if (on) g.fillCircle(px, py, 34f, t.accent); Widgets.face(g, t, app.charImg(c, 256), px, py, 28f)
            g.text(Widgets.fit(g, s.name, 12f, 80f), px, py + 46, 12f, t.ink2, FontKind.UI, Align.CENTER); app.zone("p:$id", px - 32, py - 32, 64f, 64f) }
        g.text(if (first == null) "點兩個人來設定他們的關係" else "再點另一個人", W / 2, cy + r + 78, Dim.FS_S, t.ink3, FontKind.UI, Align.CENTER)
        // ---- pairs + romance
        val listTop = cy + r + 92; val btnY = H - app.insetBottom - 76
        val sc = scroll.step(dt); g.save(); g.clip(0f, listTop, W, btnY - 12 - listTop); g.translate(0f, -sc); app.zoneDy = -sc; app.zoneClip = floatArrayOf(0f, listTop, W, btnY - 12 - listTop)
        val f = Form(app, g, G, W - G * 2, listTop)
        f.toggle("romance", "戀愛", romance, "預設關閉；只限兩位成年角色")
        for (i in people.indices) for (j in i + 1 until people.size) { val (a, sa, _) = people[i]; val (b, sb, _) = people[j]
            val ab = rel(a, b); val ba = rel(b, a); val id = "pair:$a:$b"; val sink = if (app.pressed == id) 2f else 0f
            Widgets.card(g, t, G, f.y, W - G * 2, 60f, 18f, t.surface, t.lip, sink)
            g.text(Widgets.fit(g, "${sa.name}・${sb.name}", Dim.FS_M, W - 80), G + 16, f.y + 26 + sink, Dim.FS_M, t.ink)
            g.text(Widgets.fit(g, "→ ${ab?.kind ?: "未設定"}　← ${ba?.kind ?: "未設定"}", Dim.FS_S - 1, W - 80), G + 16, f.y + 47 + sink, Dim.FS_S - 1, t.ink2)
            app.zone(id, G, f.y, W - G * 2, 64f); f.y += 70 }
        g.restore(); app.zoneDy = 0f; scroll.max = maxOf(0f, f.y + 20 - (btnY - 12))
        g.fillRect(0f, btnY - 12, W, H - btnY + 12, t.bg)
        Widgets.button(g, app, "done", G, btnY, W - G * 2, 56f, "好", Kind.PRIMARY, Dim.FS_L)
    }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id == "done" -> { val err = save(rels, romance); if (err != null) app.toast(err) else app.pop() }
            id == "tog:romance" -> { romance = !romance; if (!romance) { rels.replaceAll { if (it.kind in Rel.ROMANTIC || it.crush > 0) it.copy(kind = if (it.kind in Rel.ROMANTIC) "朋友" else it.kind, crush = 0) else it }; app.toast("戀愛關閉：戀人與心動都改回朋友") } }
            id.startsWith("p:") -> { val p = id.removePrefix("p:"); val f = first; if (f == null || f == p) first = if (f == p) null else p else { first = null; pair(f, p) } }
            id.startsWith("pair:") -> { val (a, b) = id.removePrefix("pair:").split(":"); pair(a, b) }
        }
    }
    private fun pair(a: String, b: String) { val sa = people.first { it.first == a }.second; val sb = people.first { it.first == b }.second
        app.show(PairSheet(a, sa, b, sb, rel(a, b) ?: Rel(a, b), rel(b, a) ?: Rel(b, a), romance) { x, y -> rels.removeAll { (it.from == a && it.to == b) || (it.from == b && it.to == a) }; rels += x; rels += y }) }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    companion object { fun kindColor(t: Theme, k: String): Int = when (k) { "朋友", "好友", "知己" -> t.select; "家人" -> 0xFF7AAAD6.toInt(); "戀人" -> 0xFFF6A0A0.toInt(); "對手", "前任" -> t.alert; "陌生" -> t.lip; else -> t.ink3 } }
}

/** one pair, both directions (plan 12.5): kind, identity, how they get along (≤ 3), fit, starting values, a shared story, locked */
class PairSheet(val a: String, val sa: CharSpec, val b: String, val sb: CharSpec, ab0: Rel, ba0: Rel, val romance: Boolean, val done: (Rel, Rel) -> Unit) : Overlay() {
    private val slide = Spring(0f, 1f); var ab = ab0; var ba = ba0; private var side = 0; private val scroll = Scroller()
    private fun cur() = if (side == 0) ab else ba
    private fun set(r: Rel) { if (side == 0) ab = r else ba = r }
    override val dismissible = false
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val W = app.w; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val h = app.h * 0.86f; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("sheet:body", 0f, y, W, h)
        val f0 = Form(app, g, G, W - G * 2, y + 18); f0.chips("side", listOf("${sa.name} 怎麼看 ${sb.name}", "${sb.name} 怎麼看 ${sa.name}"), setOf(if (side == 0) "${sa.name} 怎麼看 ${sb.name}" else "${sb.name} 怎麼看 ${sa.name}"))
        val top = f0.y; val bottom = y + h - app.insetBottom - 84
        val sc = scroll.step(dt); g.save(); g.clip(0f, top, W, bottom - top); g.translate(0f, -sc); app.zoneDy = -sc; app.zoneClip = floatArrayOf(0f, top, W, bottom - top)
        val r = cur(); val f = Form(app, g, G, W - G * 2, top)
        val adults = sa.adult && sb.adult
        f.chips("quick", listOf("很好", "普通", "不好"), emptySet(), label = "快速設定")
        f.chips("kind", Rel.KINDS, setOf(r.kind), Rel.ROMANTIC.filter { !romance || !adults }.toSet(), "關係")
        if (!adults) f.note("有未成年的角色：不會有戀愛關係。") else if (!romance) f.note("戀人、前任要先在關係頁打開「戀愛」。")
        f.chips("identity", Rel.IDENTITIES.drop(1), setOf(r.identity), label = "身分")
        f.chips("tag", Rel.PAIR_TAGS, r.tags.toSet(), Rel.PAIR_TAGS.filter { it !in r.tags && r.tags.size >= 3 }.toSet(), "相處（最多 3）")
        f.stepper("fit", "合拍度", "${r.fit}", "聊天的感覺好不好"); f.stepper("like", "好感", "${r.like}"); f.stepper("trust", "信任", "${r.trust}"); f.stepper("familiar", "熟悉", "${r.familiar}")
        if (romance && adults) f.stepper("crush", "心動", "${r.crush}")
        f.stepper("conflict", "衝突", "${r.conflict}")
        f.row("story", "共同的回憶（兩人都記得，聊天會提起）", r.story); f.toggle("locked", "鎖定", r.locked, "生活不會自動改變這段關係")
        g.restore(); app.zoneDy = 0f; scroll.max = maxOf(0f, f.y - bottom)
        Widgets.button(g, app, "pair:done", G, y + h - app.insetBottom - 72, W - G * 2, 56f, "好", Kind.PRIMARY)
    }
    override fun tap(id: String) {
        val r = cur()
        when {
            id.startsWith("chip:side:") -> { side = if (id.contains("${sa.name} 怎麼看")) 0 else 1; scroll.reset() }
            id.startsWith("chip:kind:") -> set(r.copy(kind = id.removePrefix("chip:kind:")))
            id.startsWith("chip:identity:") -> { val v = id.removePrefix("chip:identity:"); set(r.copy(identity = if (r.identity == v) "" else v)) }
            id.startsWith("chip:tag:") -> { val v = id.removePrefix("chip:tag:"); set(r.copy(tags = if (v in r.tags) r.tags - v else (r.tags + v).take(3))) }
            id.startsWith("chip:quick:") -> set(when (id.removePrefix("chip:quick:")) { "很好" -> r.copy(kind = "好友", like = 80, trust = 70, familiar = 70, fit = 80, conflict = 0); "不好" -> r.copy(kind = "對手", like = 15, trust = 20, fit = 25, conflict = 60); else -> r.copy(kind = "認識", like = 40, trust = 40, familiar = 40, fit = 50, conflict = 10) })
            id.startsWith("step:") -> { val k = id.removePrefix("step:").substringBefore(':'); val d = if (id.endsWith("+")) 10 else -10; fun c(v: Int) = (v + d).coerceIn(0, 100)
                set(when (k) { "fit" -> r.copy(fit = c(r.fit)); "like" -> r.copy(like = c(r.like)); "trust" -> r.copy(trust = c(r.trust)); "familiar" -> r.copy(familiar = c(r.familiar)); "crush" -> r.copy(crush = c(r.crush)); "conflict" -> r.copy(conflict = c(r.conflict)); else -> r }) }
            id == "row:story" -> app.platform.prompt("共同的回憶", r.story, 80) { v -> if (v != null) { ab = ab.copy(story = v.trim()); ba = ba.copy(story = v.trim()) } }
            id == "tog:locked" -> set(r.copy(locked = !r.locked))
            id == "pair:done" -> {
                val err = Relations.problem(ab, sa, sb, romance) ?: Relations.problem(ba, sb, sa, romance)
                if (err != null) { app.toast(err); return }
                app.closeOverlay(); done(ab, ba)
            }
        }
    }
}
