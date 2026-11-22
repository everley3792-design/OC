package app.ocshimeji.ui

import app.ocshimeji.render.Colors
import app.ocshimeji.render.Gfx
import app.ocshimeji.save.Studio
import app.ocshimeji.sim.life.Moods
import app.ocshimeji.sim.script.ChoiceDef
import app.ocshimeji.sim.script.OptionDef
import app.ocshimeji.sim.script.Result
import app.ocshimeji.sim.script.RoleDef
import app.ocshimeji.sim.script.ScriptDef
import app.ocshimeji.sim.script.Scripts
import app.ocshimeji.sim.script.Step

/** the player's scripts (plan 13.3), and packs in and out */
class ScriptsPage : Page("劇本") {
    override val primary = "new" to "新劇本"
    override val tools = listOf("import" to "import", "export" to "share")
    override val empty = "還沒有劇本：按「新劇本」從範例開始"
    override fun rows() = studio.scripts().map { s -> Row("s:${s.id}", s.name, (if (s.enabled) "" else "（停用）") + "${s.trigger.from}–${s.trigger.to} 點・機率 ${s.trigger.chance}%" + (if (s.choice != null) "・會問你" else "") + (if (s.romantic) "・戀愛（只限兩位成年角色）" else ""), icon = "list") }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id == "new" -> app.push(ScriptEditor(Scripts.parse(SAMPLE, "")))
            id.startsWith("s:") -> studio.scripts().firstOrNull { it.id == id.removePrefix("s:") }?.let { app.push(ScriptEditor(it)) }
            id == "export" -> { val ss = studio.scripts(); if (ss.isEmpty() && studio.tags().isEmpty()) { app.toast("還沒有劇本或標籤可以打包"); return }
                app.platform.prompt("劇本包的名字", "我的劇本包", 24) { n -> n ?: return@prompt
                    runCatching { studio.exportMod(n, "", ss.map { it.id }, studio.tags().map { it.id }) }.onSuccess { d -> app.platform.saveFile("$n.ocmod", "application/octet-stream", d) { ok -> app.toast(if (ok) "匯出了「$n」：${ss.size} 個劇本、${studio.tags().size} 個標籤" else "沒有匯出") } }.onFailure { app.toast(it.message ?: "匯出失敗") } } }
            id == "import" -> app.platform.openFile("*/*") { b -> if (b == null) return@openFile
                if (b.size > 2 && b[0] == 'P'.code.toByte() && b[1] == 'K'.code.toByte()) importPack(b)
                else runCatching { Scripts.parse(b.decodeToString(), "") }.onSuccess { app.push(ScriptEditor(it)) }.onFailure { app.toast(it.message ?: "看不懂這個檔案") } }
        }
    }
    /** what the pack has, what it needs; a role for a character you do not have can be given to someone else */
    private fun importPack(b: ByteArray) {
        val p = runCatching { studio.readMod(b) }.getOrElse { app.toast(it.message ?: "匯入失敗"); return }
        val missing = p.needs.filter { !studio.has(it) }
        val remap = HashMap<String, String>()
        fun finish() { val n = studio.importMod(p, remap); app.toast("匯入了 $n 個劇本、${p.tags.size} 個標籤") }
        fun ask(i: Int) {
            if (i >= missing.size) { finish(); return }
            val need = missing[i]; val zh = when { need.startsWith("name:") -> "名字是「${need.drop(5)}」的角色"; need.startsWith("tag:") -> "有標籤「${need.drop(4)}」的角色"; else -> "有特質「${need.drop(6)}」的角色" }
            app.show(ListSheet("你沒有$zh", listOf("any" to "改成任何人") + app.saves.library().chars.map { "name:${it.name}" to "改成「${it.name}」" } + listOf("keep" to "保留（等你有這樣的角色）")) { a -> if (a != "keep") remap[need] = a; ask(i + 1) })
        }
        app.show(ListSheet("「${p.name}」", listOf("ok" to "匯入", "no" to "不要了"), subtitle = "${p.scripts.size} 個劇本、${p.tags.size} 個標籤" + (if (missing.isNotEmpty()) "・需要 ${missing.size} 種你沒有的角色" else "") + (if (p.author.isNotBlank()) "・作者：${p.author}" else "")) { a -> if (a == "ok") ask(0) })
    }
    companion object {
        val SAMPLE = """
            # 標題：分享點心
            # 角色：A=任何人 B=任何人
            # 時間：14-17
            # 機率：30
            [A] 我烤了餅乾，要不要吃一塊？
            @A 開心
            [B] 哇，好香！
            !B 閃亮
            = 好感 B→A +3
            = 記憶 B +1 分了一塊餅乾
        """.trimIndent()
    }
}

/**
 * One script as blocks (plan 13.3 積木編輯器): settings, then the steps and results; a question with answers, each with its own
 * steps. The 文字 button shows the same script as readable text to edit in one go; both forms are the same data.
 */
class ScriptEditor(var s: ScriptDef) : Screen() {
    private val scroll = Scroller(); private var dirty = s.id.isBlank()
    /** where new blocks go: -1 = the main part, otherwise that answer */
    private var into = -1
    override val animating get() = true
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, H, t.bg)
        val listTop = top + 70; val btnY = H - app.insetBottom - 76; val sc = scroll.step(dt)
        g.save(); g.clip(0f, listTop, W, btnY - 12 - listTop); g.translate(0f, -sc); app.zoneDy = -sc
        var y = listTop + 6
        fun title(x: String) { g.text(x, G + 4, y + 18, Dim.FS_S, t.ink2); y += 28 }
        fun chips(list: List<Pair<String, String>>, on: (String) -> Boolean = { false }) { var x = G; for ((id, zh) in list) { val w0 = g.measure(zh, Dim.FS_S + 1) + 28; if (x + w0 > W - G) { x = G; y += 46 }; x += Widgets.chip(g, app, id, x, y, zh, on(id), 38f) + 6 }; y += 50 }
        title("設定")
        val tr = s.trigger
        chips(listOf("name" to "標題：${s.name}", "A" to "A：${roleZh(s.roles.getOrNull(0))}", "B" to "B：${roleZh(s.roles.getOrNull(1))}", "time" to "${tr.from}–${tr.to} 點", "chance" to "機率 ${tr.chance}%",
            "like" to "A 對 B 的好感 ${tr.minLike}–${tr.maxLike}", "flag" to (if (tr.flag.isBlank()) "需要旗標：無" else "需要旗標：${tr.flag}"), "notflag" to (if (tr.notFlag.isBlank()) "沒有旗標：無" else "沒有旗標：${tr.notFlag}"),
            "mood" to "A 的心情：" + when (tr.mood) { "good" -> "好"; "bad" -> "不好"; else -> "不限" }, "closeup" to "特寫", "cool" to "冷卻 ${s.cooldownDays} 天", "enabled" to if (s.enabled) "啟用中" else "停用"))
            { it == "closeup" && s.closeup || it == "enabled" && s.enabled }
        // ---- the parts: main, then each answer
        val parts = listOf(-1 to (s.steps to s.results)) + (s.choice?.options?.mapIndexed { i, o -> i to (o.steps to o.results) } ?: emptyList())
        s.choice?.let { c -> title("問你的問題"); chips(listOf("prompt" to "「${c.prompt}」")) }
        for ((pi, pr) in parts) {
            val head = if (pi < 0) "主線" else "選項：${s.choice!!.options[pi].label}"
            g.fillRound(G - 4, y, W - G * 2 + 8, 34f, 12f, if (into == pi) Colors.mix(t.select, t.surface, 0.5f) else t.surface2)
            g.text(head + if (into == pi) "（新增的積木放這裡）" else "（點一下：新增的積木放這裡）", G + 8, y + 23, Dim.FS_S, t.ink); app.zone("into:$pi", G - 4, y, W - G * 2 + 8, 34f); y += 42
            pr.first.forEachIndexed { i, st -> block(g, "st:$pi:$i", stepZh(st), y, 0xFFFFF4E4.toInt()); y += 50 }
            pr.second.forEachIndexed { i, r -> block(g, "rs:$pi:$i", resultZh(r), y, 0xFFE4F2EA.toInt()); y += 50 }
            y += 6
        }
        title("新增積木"); chips(listOf("+say" to "＋台詞", "+pose" to "＋動作", "+fx" to "＋特效", "+res" to "＋結果") + (if (s.choice == null) listOf("+q" to "＋問你一個問題") else listOf("+opt" to "＋選項")))
        val probs = Scripts.problems(s)
        if (probs.isNotEmpty()) probs.forEach { p -> Widgets.wrap(g, "還不能存：$p", Dim.FS_S, W - G * 2).forEach { l -> g.text(l, G + 4, y + 14, Dim.FS_S, t.alert); y += 20 } }
        if (s.romantic) { Widgets.wrap(g, "這個劇本和戀愛有關：只會發生在兩位成年角色之間，而且那個世界要打開「戀愛」。", Dim.FS_S, W - G * 2, 2).forEach { l -> g.text(l, G + 4, y + 14, Dim.FS_S, t.accentLip); y += 20 } }
        y += 10; if (s.id.isNotBlank()) { Widgets.button(g, app, "delete", G, y, W - G * 2, 48f, "刪除這個劇本", Kind.DANGER); y += 60 }
        g.restore(); app.zoneDy = 0f; scroll.max = maxOf(0f, y + 20 - (btnY - 12))
        g.fillRect(0f, 0f, W, listTop, t.bg); Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back"); g.text("劇本", G + 60, top + 42, Dim.FS_L, t.ink)
        Widgets.button(g, app, "text", W - G - 96, top + 14, 96f, 42f, "文字", Kind.SECONDARY, Dim.FS_S + 1)
        g.fillRect(0f, btnY - 12, W, H, t.bg); Widgets.button(g, app, "save", G, btnY, W - G * 2, 56f, "儲存", Kind.PRIMARY, Dim.FS_L)
    }
    private fun block(g: Gfx, id: String, text: String, y: Float, c: Int) {
        val t = app.theme; val W = app.w; val G = Dim.GUTTER
        Widgets.card(g, t, G, y, W - G * 2, 42f, 12f, if (app.pressed == id) t.surface2 else c)
        g.text(Widgets.fit(g, text, Dim.FS_S + 1, W - G * 2 - 24), G + 12, y + 27, Dim.FS_S + 1, t.ink); app.zone(id, G, y, W - G * 2, 46f)
    }
    private fun roleZh(r: RoleDef?): String { val m = r?.match ?: "any"; return when { m == "any" -> "任何人"; m.startsWith("tag:") -> "標籤 ${m.drop(4)}"; m.startsWith("trait:") -> "特質 ${m.drop(6)}"; else -> m.drop(5) } }
    private fun stepZh(st: Step) = when (st.kind) { "say" -> "[${st.role}] ${st.text}"; "pose" -> "@${st.role} ${Scripts.POSES.entries.firstOrNull { it.value == st.pose }?.key ?: st.pose}"; else -> "!${st.role} ${Scripts.FX.entries.firstOrNull { it.value == st.fx }?.key ?: st.fx}" }
    private fun resultZh(r: Result): String { val zh = Scripts.RESULT_ZH.entries.firstOrNull { it.value == r.kind }?.key ?: r.kind
        return "＝ " + when (r.kind) { "mood" -> "$zh ${r.role} ${Moods.ALL[r.text]?.zh ?: r.text}"; "memory" -> "$zh ${r.role} ${if (r.value >= 0) "恩情" else "記仇"}：${r.text}"; "flag" -> "$zh ${r.text}"; else -> "$zh ${r.role}→${r.to} ${if (r.value >= 0) "+" else ""}${r.value}" } }

    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()
    private fun set(f: (ScriptDef) -> ScriptDef) { s = f(s); dirty = true }
    private fun steps(pi: Int) = if (pi < 0) s.steps else s.choice!!.options[pi].steps
    private fun results(pi: Int) = if (pi < 0) s.results else s.choice!!.options[pi].results
    private fun setPart(pi: Int, st: List<Step>, rs: List<Result>) = set { d -> if (pi < 0) d.copy(steps = st, results = rs) else d.copy(choice = d.choice!!.copy(options = d.choice!!.options.mapIndexed { i, o -> if (i == pi) o.copy(steps = st, results = rs) else o })) }
    private fun pickRole(then: (String) -> Unit) = app.show(ListSheet("誰？", listOf("A" to "A：${roleZh(s.roles.getOrNull(0))}", "B" to "B：${roleZh(s.roles.getOrNull(1))}")) { then(it) })
    private fun numbers(title: String, then: (Int) -> Unit) = app.show(ListSheet(title, listOf(-10, -5, -3, -1, 1, 3, 5, 10).map { it.toString() to (if (it > 0) "+$it" else "$it") }) { then(it.toInt()) })
    override fun tap(id: String) {
        val studio = Studio(app.saves); val tr = s.trigger
        when {
            id == "back" -> if (dirty) app.show(ListSheet("還沒儲存", listOf("save" to "儲存", "drop" to "不要了，離開"), danger = setOf("drop")) { if (it == "save") save(studio) else app.pop() }) else app.pop()
            id == "save" -> save(studio)
            id == "text" -> app.platform.prompt("用文字編輯（[A] 台詞、@A 動作、!A 特效、= 結果、# 設定、? 問題、- 選項）", Scripts.toText(s), 4000) { txt -> txt ?: return@prompt
                runCatching { Scripts.parse(txt, s.id, s.author) }.onSuccess { s = it.copy(enabled = s.enabled); dirty = true }.onFailure { app.toast(it.message ?: "看不懂") } }
            id == "name" -> app.platform.prompt("標題", s.name, 24) { v -> v?.trim()?.let { n -> set { it.copy(name = n) } } }
            id == "A" || id == "B" -> app.show(ListSheet("$id 可以是誰？", listOf("any" to "任何人", "tag" to "有某個標籤的人", "trait" to "有某個特質的人") + app.saves.library().chars.map { "name:${it.name}" to "「${it.name}」" }) { a ->
                fun setRole(m: String) = set { d -> d.copy(roles = listOf("A", "B").map { k -> if (k == id) RoleDef(k, m) else d.roles.firstOrNull { it.key == k } ?: RoleDef(k) }) }
                when (a) { "tag", "trait" -> app.platform.prompt(if (a == "tag") "標籤的名字" else "特質的名字", "", 12) { v -> v?.trim()?.takeIf { it.isNotEmpty() }?.let { setRole("$a:$it") } }; else -> setRole(a) } })
            id == "time" -> app.show(ListSheet("什麼時候", listOf("0-24" to "整天", "6-11" to "早上", "11-14" to "中午", "14-18" to "下午", "17-20" to "傍晚", "20-24" to "晚上", "22-3" to "深夜")) { v -> val (a, b) = v.split("-").map { it.toInt() }; set { it.copy(trigger = tr.copy(from = a, to = b)) } })
            id == "chance" -> app.show(ListSheet("每次檢查時的機率", listOf(5, 10, 20, 30, 50, 80, 100).map { it.toString() to "$it%" }) { v -> set { it.copy(trigger = tr.copy(chance = v.toInt())) } })
            id == "like" -> app.show(ListSheet("A 對 B 的好感", listOf("0-100" to "不限", "0-30" to "不太喜歡（0–30）", "30-60" to "普通（30–60）", "60-100" to "很喜歡（60–100）")) { v -> val (a, b) = v.split("-").map { it.toInt() }; set { it.copy(trigger = tr.copy(minLike = a, maxLike = b)) } })
            id == "flag" || id == "notflag" -> app.platform.prompt(if (id == "flag") "需要的旗標（空白＝不需要）" else "不能有的旗標（空白＝不限）", if (id == "flag") tr.flag else tr.notFlag, 20) { v -> v?.trim()?.let { f -> set { it.copy(trigger = if (id == "flag") tr.copy(flag = f) else tr.copy(notFlag = f)) } } }
            id == "mood" -> set { it.copy(trigger = tr.copy(mood = when (tr.mood) { "" -> "good"; "good" -> "bad"; else -> "" })) }
            id == "closeup" -> set { it.copy(closeup = !it.closeup) }
            id == "cool" -> set { it.copy(cooldownDays = if (it.cooldownDays >= 7) 0 else it.cooldownDays + 1) }
            id == "enabled" -> set { it.copy(enabled = !it.enabled) }
            id.startsWith("into:") -> into = id.removePrefix("into:").toInt()
            id == "+say" -> pickRole { r -> app.platform.prompt("$r 說什麼？（用「我」「你」寫，最多 ${Scripts.MAX_TEXT} 字）", "", Scripts.MAX_TEXT) { v -> v?.trim()?.takeIf { it.isNotEmpty() }?.let { setPart(into, steps(into) + Step("say", r, it), results(into)) } } }
            id == "+pose" -> pickRole { r -> app.show(ListSheet("動作", Scripts.POSES.map { it.value to it.key }) { p -> setPart(into, steps(into) + Step("pose", r, pose = p), results(into)) }) }
            id == "+fx" -> pickRole { r -> app.show(ListSheet("特效", Scripts.FX.map { it.value to it.key }) { f -> setPart(into, steps(into) + Step("fx", r, fx = f), results(into)) }) }
            id == "+res" -> app.show(ListSheet("結果", Scripts.RESULT_ZH.map { it.value to it.key }) { k -> addResult(k) })
            id == "+q" -> app.platform.prompt("要問你的問題", "", 40) { v -> v?.trim()?.takeIf { it.isNotEmpty() }?.let { q -> set { it.copy(choice = ChoiceDef(q, listOf(OptionDef("好"), OptionDef("不要")))) }; into = 0 } }
            id == "prompt" -> app.platform.prompt("問題", s.choice?.prompt ?: "", 40) { v -> v?.trim()?.takeIf { it.isNotEmpty() }?.let { q -> set { it.copy(choice = it.choice?.copy(prompt = q)) } } }
            id == "+opt" -> app.platform.prompt("選項的文字", "", 16) { v -> v?.trim()?.takeIf { it.isNotEmpty() }?.let { o -> set { it.copy(choice = it.choice?.copy(options = it.choice!!.options + OptionDef(o))) }; into = s.choice!!.options.size - 1 } }
            id.startsWith("st:") || id.startsWith("rs:") -> { val (pi, i) = id.drop(3).split(":").map { it.toInt() }; val isStep = id.startsWith("st:")
                app.show(ListSheet("這個積木", listOf("up" to "往上移", "down" to "往下移", "delete" to "刪除"), danger = setOf("delete")) { a ->
                    if (isStep) setPart(pi, move(steps(pi), i, a), results(pi)) else setPart(pi, steps(pi), move(results(pi), i, a)) }) }
            id == "delete" -> app.show(Confirm("刪除「${s.name}」？", "這個劇本會從收藏庫消失。", "刪除") { studio.deleteScript(s.id); app.pop() })
        }
    }
    private fun <T> move(l: List<T>, i: Int, a: String): List<T> { val m = l.toMutableList(); when (a) { "delete" -> m.removeAt(i); "up" -> if (i > 0) { val x = m.removeAt(i); m.add(i - 1, x) }; "down" -> if (i < m.size - 1) { val x = m.removeAt(i); m.add(i + 1, x) } }; return m }
    private fun addResult(k: String) {
        fun add(r: Result) = setPart(into, steps(into), results(into) + r)
        when (k) {
            "like", "trust", "conflict", "crush" -> pickRole { r -> numbers("改多少") { v -> add(Result(k, r, if (r == "A") "B" else "A", v)) } }
            "mood" -> pickRole { r -> app.show(ListSheet("心情小卡", Moods.ALL.values.map { it.id to "${it.zh}（${if (it.value > 0) "+" else ""}${it.value}）" }) { m -> add(Result("mood", r, text = m)) }) }
            "memory" -> pickRole { r -> app.show(ListSheet("記得的是", listOf("1" to "恩情", "-1" to "記仇")) { v -> app.platform.prompt("記得什麼？", "", 20) { txt -> txt?.trim()?.takeIf { it.isNotEmpty() }?.let { add(Result("memory", r, value = v.toInt(), text = it)) } } }) }
            "flag" -> app.platform.prompt("旗標的名字（之後的劇本可以用「需要旗標」接下去）", "", 20) { v -> v?.trim()?.takeIf { it.isNotEmpty() }?.let { add(Result("flag", text = it)) } }
        }
    }
    private fun save(studio: Studio) { val err = studio.saveScript(s); if (err != null) app.toast(err) else { dirty = false; app.toast("存好了：${s.name}（下次打開世界時生效）"); app.pop() } }
    override fun back(): Boolean { tap("back"); return true }
}
