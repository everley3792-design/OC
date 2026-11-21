package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.save.LibChar
import app.ocshimeji.save.Mark
import app.ocshimeji.save.media.Actions
import app.ocshimeji.save.media.Raster
import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.Builder
import app.ocshimeji.sim.chars.Catalog
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Speech
import app.ocshimeji.sim.chars.TagCat
import app.ocshimeji.sim.chars.TraitCat
import app.ocshimeji.sim.chars.Voice
import app.ocshimeji.sim.life.Pose

/**
 * 角色創建 (plan 12.4): a stage on top where the character moves and reacts, nine tabs below (only the panel scrolls).
 * Undo / redo, the quiz, dice with locks, templates, the scene preview and compatibility reminders. Nothing about the face is
 * built here — appearance comes from the picture; everything else is deep.
 *
 * `world` = editing one resident's own copy (the picture belongs to the library and is changed there).
 */
class CharacterEditor(private var c: LibChar, spec0: CharSpec, val world: Boolean = false, val title: String = "角色設定",
                      val houseId: String? = null, val housemates: Int = 1, val onSave: (CharSpec, LibChar) -> String?) : Screen() {
    var spec = spec0; private set
    val char get() = c
    private val hist = ArrayList<Pair<CharSpec, LibChar>>().apply { add(spec0 to c) }
    private var at = 0
    private var saved = spec0 to c
    private var tab = 0
    private val scroll = Scroller()
    private var look: Look? = null
    private var bubble: Pair<String, Float>? = null; private var scenePose: Pose? = null
    val tabs = listOf("外觀", "基本", "說話", "個性", "喜好", "生活", "關係", "故事", "能力")
    override val animating get() = true

    fun edit(f: (CharSpec) -> CharSpec) = change(f(spec), c)
    fun editChar(f: (LibChar) -> LibChar) = change(spec, f(c))
    private fun change(s: CharSpec, ch: LibChar) { if (s == spec && ch == c) return; while (hist.size > at + 1) hist.removeAt(hist.size - 1); hist += s to ch; if (hist.size > 60) hist.removeAt(0); at = hist.size - 1; spec = s; c = ch; look = null }
    fun undo() { if (at > 0) { at--; spec = hist[at].first; c = hist[at].second; look = null } }
    fun redo() { if (at < hist.size - 1) { at++; spec = hist[at].first; c = hist[at].second; look = null } }
    val dirty get() = spec != saved.first || c != saved.second
    fun selectTab(i: Int) { tab = i; scroll.reset() }

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, H, t.bg)
        // ---- the stage
        val stageH = 232f; val sy = top + stageH
        g.fillGradientV(0f, 0f, W, sy, t.skyTop, t.surface2)
        g.save(); g.translate(W / 2, sy - 22); g.scale(1f, 0.22f); g.fillCircle(0f, 0f, W * 0.42f, t.grassLip); g.fillCircle(0f, -8f, W * 0.42f, t.grass); g.restore()
        val lk = look ?: Look(app, c, spec).also { look = it }
        val pose = scenePose ?: if ((app.time % 9f) > 6.5f) Pose.HAPPY else Pose.STAND
        Widgets.footShadow(g, t, W / 2, sy - 24, 70f)
        Actors.draw(g, lk, W / 2, sy - 24, 150f, pose, app.time, 0f, -1, 0f, null, false)
        Actors.extras(g, t, lk, pose, W / 2, sy - 24, 150f, app.time, 0f, -1, false, null)
        bubble?.let { (s, at0) -> if (app.time - at0 > 4f) { bubble = null; scenePose = null } else stageBubble(g, s, sy - 24 - 150f * lk.scale - 8) }
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back")
        g.text(Widgets.fit(g, spec.name, Dim.FS_L, W - 220), G + 58, top + 32, Dim.FS_L, t.ink)
        g.text(Widgets.fit(g, "${spec.stage}・${spec.species}" + if (world) "・這個世界的${spec.name}" else "", Dim.FS_S - 1, W - 220), G + 58, top + 52, Dim.FS_S - 1, t.ink2)
        Widgets.round(g, app, "undo", W - G - 116, top + 34, 18f, "undo"); Widgets.round(g, app, "redo", W - G - 72, top + 34, 18f, "redo"); Widgets.round(g, app, "more", W - G - 24, top + 34, 20f, "more")
        val warns = Builder.warnings(spec, houseId, housemates)
        if (warns.isNotEmpty()) Widgets.chip(g, app, "warns", G, sy - 50, "有 ${warns.size} 個提醒", false, 34f)
        Widgets.chip(g, app, "scene", W - G - g.measure("情境預覽", Dim.FS_S + 1) - 28, sy - 50, "情境預覽", false, 34f)
        // ---- tabs (two rows)
        var tx = G; var ty = sy + 10
        tabs.forEachIndexed { i, n -> val cw = (W - G * 2 - 4 * 6) / 5; if (i == 5) { tx = G; ty += 44 }
            Widgets.chip(g, app, "tab:$i", tx, ty, n, i == tab, 38f, cw); tx += cw + 6 }
        // ---- the panel (only this scrolls)
        val pTop = ty + 52; val btnY = H - app.insetBottom - 74
        val sc = scroll.step(dt)
        g.save(); g.clip(0f, pTop, W, btnY - 8 - pTop); g.translate(0f, -sc); app.zoneDy = -sc
        val f = Form(app, g, G, W - G * 2, pTop + 2)
        when (tab) { 0 -> looks(f); 1 -> basic(f); 2 -> speech(f); 3 -> personality(f); 4 -> likes(f); 5 -> life(f); 6 -> relation(f); 7 -> story(f); else -> skills(f) }
        g.restore(); app.zoneDy = 0f
        scroll.max = maxOf(0f, f.y + 20 - (btnY - 8))
        // ---- save (the one primary button)
        g.fillRect(0f, btnY - 8, W, H - btnY + 8, t.bg)
        val errs = Builder.errors(spec)
        if (errs.isNotEmpty()) { g.fillRound(G, btnY, W - G * 2, 56f, 28f, t.surface2); g.text(Widgets.fit(g, errs[0], Dim.FS_S + 1, W - G * 2 - 24), W / 2, btnY + 33, Dim.FS_S + 1, t.alert, FontKind.UI, Align.CENTER) }
        else Widgets.button(g, app, "save", G, btnY, W - G * 2, 56f, if (dirty) "儲存" else "完成", Kind.PRIMARY, Dim.FS_L)
    }
    private fun stageBubble(g: Gfx, s: String, bottom: Float) {
        val t = app.theme; val lines = Widgets.wrap(g, s, Dim.FS_S + 1, app.w - 120, 2); val w = lines.maxOf { g.measure(it, Dim.FS_S + 1) } + 28; val h = 16f + lines.size * 20; val x = (app.w - w) / 2; val y = maxOf(app.insetTop + 64, bottom - h)
        g.fillRound(x, y + 2, w, h, 16f, t.shadow); g.fillRound(x, y, w, h, 16f, t.surface)
        lines.forEachIndexed { i, l -> g.text(l, app.w / 2, y + 23 + i * 20f, Dim.FS_S + 1, t.ink, FontKind.UI, Align.CENTER) }
    }

    // ---------------- tabs ----------------
    private fun looks(f: Form) {
        val preset = c.source == "preset"
        f.header("圖片與動作", if (world) "外觀屬於收藏庫的角色：在收藏庫修改圖片，所有世界一起改變" else null)
        if (!world) { if (preset) f.note("內建角色的圖不能換；可以在收藏庫「複製一份」再改。") else f.button("reimport", "換圖片或動作（匯入工作室）")
            f.chips("face", EMOTIONS.keys.toList(), EMOTIONS.filterValues { it in c.faces }.keys, if (preset) EMOTIONS.keys else emptySet(), "表情差分（點一下換圖；有勾的已經有圖）")
            f.chips("facing", listOf("朝左", "朝右"), setOf(if (c.facing < 0) "朝左" else "朝右"), if (preset) setOf("朝左", "朝右") else emptySet(), "圖上的角色面向")
            f.toggle("flip", "往另一邊走時翻轉", c.flip, "不對稱的角色可以關掉")
            if (!preset) f.button("marks", "部位標記（頭、臉、手、耳朵、尾巴）") }
        f.stepper("height", "大小", "${spec.height}", "比其他角色高或矮")
        f.header("代表色"); f.swatches("tint", TINTS, spec.tint)
        f.chips("motion", CharSpec.MOTIONS, setOf(spec.motion), label = "動作風格（所有動作的節奏與幅度）")
        if (!world) {
            f.chips("source", listOf("系統預設", "混合", "我的"), setOf(c.animSource), if (preset) setOf("系統預設", "混合", "我的") else emptySet(), "動畫來源")
            f.note(when (c.animSource) { "系統預設" -> "全部用系統的程序動畫。"; "我的" -> "全部用你的動畫；沒有的動作退回待機。"; else -> "有你畫的就用你的，沒有的用系統的。" })
            if (c.anims.isNotEmpty()) f.chips("use", c.anims.keys.map { Actions.ZH[it] ?: it }, c.anims.keys.filter { c.animUse[it] != false }.map { Actions.ZH[it] ?: it }.toSet(), label = "各動作用我的（點一下切換）")
        }
    }
    private fun basic(f: Form) {
        f.row("name", "名字", spec.name); f.row("nickname", "暱稱（其他角色這樣叫）", spec.nickname)
        f.chips("pronoun", CharSpec.PRONOUNS + "自訂…", setOf(if (spec.pronoun in CharSpec.PRONOUNS) spec.pronoun else "自訂…"), label = "代名詞（紀錄裡用）")
        f.stepper("age", "年齡", "${spec.age}", "${spec.stage}${if (!spec.adult) "・未成年永遠不涉及戀愛" else ""}")
        f.row("birthday", "生日（月-日，例如 04-21）", spec.birthday); f.row("species", "物種", spec.species)
        f.header("標籤", "世界觀、種族、職業、體質、弱點、癖好：每個標籤都會改變行為")
        f.list("tags", "已選的標籤", spec.tags, 12); f.button("tagpick", "從標籤庫選（${Catalog.TAGS.size} 個）")
    }
    private fun speech(f: Form) {
        f.chips("style", CharSpec.STYLES, setOf(spec.style), label = "說話風格")
        f.row("selfRef", "怎麼稱呼自己", spec.selfRef); f.row("callPlayer", "親近之後怎麼叫你", spec.callPlayer); f.row("greeting", "打招呼", spec.greeting)
        f.list("endings", "語尾", spec.endings, 5); f.list("catchphrases", "口頭禪", spec.catchphrases, 5); f.list("banned", "不說的字", spec.banned, 8)
        f.header("聲線"); f.stepper("pitch", "音高", "%.2f".format(spec.voice.pitch)); f.stepper("vspeed", "速度", "%.2f".format(spec.voice.speed))
        f.chips("timbre", Voice.TIMBRES, setOf(spec.voice.timbre), label = "音色"); f.stepper("bright", "明暗", "%.1f".format(spec.voice.bright)); f.button("listen", "試聽")
        f.header("說話測試", "選一個情境，看牠怎麼說"); f.chips("say", Speech.SCENES, emptySet())
    }
    private fun personality(f: Form) {
        f.header("個性五軸")
        for (i in 0 until 5) { val (a, b) = AXES[i]; f.meter("axis$i", b, a, spec.axis(i)) }
        f.header("特質", "最多 ${Catalog.MAX_TRAITS} 個（${spec.traits.size}）；互相衝突的不能同時選")
        for (cat in TraitCat.values()) { val ids = Catalog.TRAITS.values.filter { it.cat == cat }.map { it.id }
            val off = ids.filter { id -> id !in spec.traits && (spec.traits.any { Catalog.conflict(it, id) } || spec.traits.size >= Catalog.MAX_TRAITS) }.toSet()
            f.chips("trait", ids, spec.traits.toSet(), off, cat.zh) }
        spec.traits.lastOrNull()?.let { Catalog.TRAITS[it]?.let { tr -> f.note("「${tr.id}」：${tr.note}") } }
        f.chips("quirk", Catalog.QUIRKS.keys.toList(), spec.quirks.toSet(), Catalog.QUIRKS.keys.filter { it !in spec.quirks && spec.quirks.size >= Catalog.MAX_QUIRKS }.toSet(), "小怪癖（最多 ${Catalog.MAX_QUIRKS}）")
        f.chips("value", Catalog.VALUES.keys.toList(), spec.values.toSet(), label = "最看重的（最多 ${Catalog.MAX_VALUES}）")
        f.header("情緒反應"); f.meter("cry", "不太哭", "容易哭", spec.cry); f.meter("temper", "好脾氣", "容易生氣", spec.temper); f.meter("shy", "大方", "容易害羞", spec.shy)
    }
    private fun likes(f: Form) {
        f.list("likes", "喜歡", spec.likes); f.list("dislikes", "討厭", spec.dislikes)
        f.header("口味"); for (tst in CharSpec.TASTES) f.chips("taste_$tst", listOf("$tst：討厭", "$tst：普通", "$tst：喜歡"), setOf("$tst：" + when (spec.tastes[tst] ?: 0) { -1 -> "討厭"; 1 -> "喜歡"; else -> "普通" }))
        f.row("color", "喜歡的顏色", spec.color); f.chips("season", CharSpec.SEASONS, setOf(spec.season), label = "喜歡的季節"); f.chips("weather", CharSpec.WEATHERS, setOf(spec.weather), label = "喜歡的天氣")
        f.list("hobbies", "興趣", spec.hobbies, 6); f.list("fears", "怕的東西", spec.fears, 5); f.row("dream", "夢想", spec.dream)
    }
    private fun life(f: Form) {
        f.stepper("wake", "起床", "%02d:00".format(spec.wake)); f.stepper("sleep", "睡覺", "%02d:00".format(spec.sleep)); f.toggle("nap", "會午睡", spec.nap)
        f.meter("oversleep", "準時起床", "愛賴床", spec.oversleep, signed = false); f.meter("nightOwl", "早睡", "熬夜", spec.nightOwl, signed = false); f.meter("hygiene", "不太在意", "很愛乾淨", spec.hygiene)
        f.chips("roomPref", CharSpec.ROOM_PREFS, setOf(spec.roomPref), label = "房間偏好")
        f.chips("control", listOf("觀察", "建議（M4 製作）", "操控（M4 製作）"), setOf("觀察"), setOf("建議（M4 製作）", "操控（M4 製作）"), "操控模式")
    }
    private fun relation(f: Form) {
        f.chips("attitude", CharSpec.ATTITUDES, setOf(spec.attitude), label = "一開始對你的態度")
        f.note("越親近，牠越常來找你、叫你的方式也會變；陌生的時候說話很客氣，被摸也會緊張。")
        f.header("和其他角色的關係", "關係屬於每個世界：開新觀察時設定，或在世界裡點人物卡的「關係」")
    }
    private fun story(f: Form) {
        f.row("story", "背景故事", spec.story); f.list("memories", "重要回憶（聊天時會提起）", spec.memories, 6)
        f.row("secret", "秘密（很親近之後才會告訴你）", spec.secret)
    }
    private fun skills(f: Form) {
        val left = CharSpec.SKILL_POINTS - spec.skills.values.sum()
        f.header("起始能力", "共 ${CharSpec.SKILL_POINTS} 點，還剩 $left 點；越高做那件事越快、收穫越多")
        for (k in CharSpec.SKILLS) f.stepper("skill_$k", k, "${spec.skill(k)}")
    }

    // ---------------- input ----------------
    override fun tap(id: String) {
        when {
            id == "back" -> { if (dirty) app.show(Confirm("還沒儲存", "要放棄這些修改嗎？", "放棄") { app.pop() }) else app.pop() }
            id == "undo" -> undo(); id == "redo" -> redo()
            id == "save" -> save()
            id == "more" -> app.show(ListSheet("輔助工具", listOf("quiz" to "性格問答（10 題）", "dice" to "隨機（可以鎖住分頁）", "template" to "套用原創範本", "scene" to "情境預覽")) { tools(it) })
            id == "warns" -> app.show(ListSheet("相容性提醒（只提醒，不會阻止）", Builder.warnings(spec, houseId, housemates).mapIndexed { i, w -> "w$i" to w }) {})
            id == "scene" -> tools("scene")
            id.startsWith("tab:") -> selectTab(id.removePrefix("tab:").toInt())
            id.startsWith("row:") -> row(id.removePrefix("row:"))
            id.startsWith("chip:") -> { val k = id.removePrefix("chip:").substringBefore(':'); chip(k, id.removePrefix("chip:$k:")) }
            id.startsWith("step:") -> { val r = id.removePrefix("step:"); step(r.substringBeforeLast(':'), if (r.endsWith("+")) 1 else -1) }
            id.startsWith("tog:") -> when (id.removePrefix("tog:")) { "nap" -> edit { it.copy(nap = !it.nap) }; "flip" -> editChar { it.copy(flip = !it.flip) } }
            id.startsWith("add:") -> { val k = id.removePrefix("add:"); app.platform.prompt(LIST_TITLE[k] ?: "新增", "", 20) { v -> if (!v.isNullOrBlank()) edit { setList(it, k, listOf(it, k) + v.trim()) } } }
            id.startsWith("del:") -> { val (k, i) = id.removePrefix("del:").split(":"); edit { s -> setList(s, k, listOf(s, k).filterIndexed { j, _ -> j != i.toInt() }) } }
            id.startsWith("btn:") -> button(id.removePrefix("btn:"))
        }
    }
    private fun tools(k: String) {
        when (k) {
            "quiz" -> app.show(QuizSheet { answers -> edit { Builder.quiz(it, answers) }; app.toast("依問答填好了個性與喜好") })
            "dice" -> app.show(DiceSheet { locks -> edit { Builder.random(it, Rng(app.platform.now()), locks) }; app.toast("擲好了") })
            "template" -> app.show(ListSheet("原創範本", Builder.TEMPLATES.keys.map { it to it }, subtitle = "套用後還可以再改；名字、年齡、故事不變") { n -> edit { Builder.applyTemplate(n, it) }; app.toast("套用了「$n」") })
            "scene" -> app.show(ListSheet("情境預覽", Speech.SCENES.map { it to it }) { sc -> preview(sc) })
        }
    }
    fun preview(scene: String) { val (line, pose) = Speech.preview(spec, scene, Rng(app.platform.now() + scene.hashCode()), CharSpec.ATTITUDES.indexOf(spec.attitude) * 20 + 10); bubble = line to app.time; scenePose = pose; app.platform.voice(spec.voice, line) }
    private fun row(k: String) {
        val (title, value, max) = when (k) {
            "name" -> Triple("名字", spec.name, 20); "nickname" -> Triple("暱稱", spec.nickname, 12); "birthday" -> Triple("生日（月-日）", spec.birthday, 5); "species" -> Triple("物種", spec.species, 16)
            "selfRef" -> Triple("怎麼稱呼自己", spec.selfRef, 8); "callPlayer" -> Triple("怎麼叫你", spec.callPlayer, 8); "greeting" -> Triple("打招呼", spec.greeting, 30)
            "color" -> Triple("喜歡的顏色", spec.color, 8); "dream" -> Triple("夢想", spec.dream, 40); "story" -> Triple("背景故事", spec.story, 300); "secret" -> Triple("秘密", spec.secret, 80)
            else -> return
        }
        app.platform.prompt(title, value, max) { v -> if (v == null) return@prompt; val s = v.trim()
            if (k == "birthday" && s.isNotEmpty() && !Regex("(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])").matches(s)) { app.toast("生日要寫成 04-21 這樣"); return@prompt }
            edit { when (k) { "name" -> it.copy(name = s.ifBlank { it.name }); "nickname" -> it.copy(nickname = s); "birthday" -> it.copy(birthday = s); "species" -> it.copy(species = s.ifBlank { "未知" })
                "selfRef" -> it.copy(selfRef = s.ifBlank { "我" }); "callPlayer" -> it.copy(callPlayer = s.ifBlank { "你" }); "greeting" -> it.copy(greeting = s)
                "color" -> it.copy(color = s); "dream" -> it.copy(dream = s); "story" -> it.copy(story = s); "secret" -> it.copy(secret = s); else -> it } } }
    }
    private fun chip(k: String, v: String) {
        when {
            k == "pronoun" -> if (v == "自訂…") app.platform.prompt("代名詞", spec.pronoun, 4) { s -> if (!s.isNullOrBlank()) edit { it.copy(pronoun = s.trim()) } } else edit { it.copy(pronoun = v) }
            k == "style" -> edit { it.copy(style = v) }; k == "timbre" -> edit { it.copy(voice = it.voice.copy(timbre = v)) }
            k == "say" -> preview(v)
            k == "trait" -> edit { s -> if (v in s.traits) s.copy(traits = s.traits - v) else Builder.addTrait(s, v) }
            k == "quirk" -> edit { s -> if (v in s.quirks) s.copy(quirks = s.quirks - v) else if (s.quirks.size < Catalog.MAX_QUIRKS) s.copy(quirks = s.quirks + v) else s }
            k == "value" -> edit { s -> if (v in s.values) s.copy(values = s.values - v) else Builder.addValue(s, v) }
            k.startsWith("taste_") -> { val tst = k.removePrefix("taste_"); val n = when (v.substringAfter("：")) { "討厭" -> -1; "喜歡" -> 1; else -> 0 }; edit { it.copy(tastes = it.tastes + (tst to n)) } }
            k == "season" -> edit { it.copy(season = if (it.season == v) "" else v) }; k == "weather" -> edit { it.copy(weather = if (it.weather == v) "" else v) }
            k == "roomPref" -> edit { it.copy(roomPref = v) }; k == "attitude" -> edit { it.copy(attitude = v) }; k == "motion" -> edit { it.copy(motion = v) }
            k == "tint" -> edit { it.copy(tint = v) }
            k == "facing" -> editChar { it.copy(facing = if (v == "朝左") -1 else 1) }
            k == "source" -> editChar { it.copy(animSource = v) }
            k == "use" -> { val a = Actions.ZH.entries.firstOrNull { it.value == v }?.key ?: v; editChar { it.copy(animUse = it.animUse + (a to (it.animUse[a] == false))) } }
            k == "face" -> pickFace(EMOTIONS[v] ?: return)
        }
    }
    private fun step(k: String, d: Int) {
        fun ax(i: Int) = edit { s -> s.copy(axes = s.axes.toMutableList().also { while (it.size < 5) it += 0f; it[i] = ((it[i] + 0.2f * d) * 10).let { x -> Math.round(x) / 10f }.coerceIn(-1f, 1f) }) }
        when {
            k.startsWith("axis") -> ax(k.removePrefix("axis").toInt())
            k == "height" -> edit { it.copy(height = (it.height + 5 * d).coerceIn(60, 200)) }
            k == "age" -> edit { it.copy(age = (it.age + d).coerceIn(0, 999)) }
            k == "wake" -> edit { it.copy(wake = Math.floorMod(it.wake + d, 24)) }; k == "sleep" -> edit { it.copy(sleep = Math.floorMod(it.sleep + d, 24)) }
            k == "oversleep" -> edit { it.copy(oversleep = (it.oversleep + 0.2f * d).coerceIn(0f, 1f)) }; k == "nightOwl" -> edit { it.copy(nightOwl = (it.nightOwl + 0.2f * d).coerceIn(0f, 1f)) }
            k == "hygiene" -> edit { it.copy(hygiene = (it.hygiene + 0.2f * d).coerceIn(-1f, 1f)) }
            k == "cry" -> edit { it.copy(cry = (it.cry + 0.2f * d).coerceIn(-1f, 1f)) }; k == "temper" -> edit { it.copy(temper = (it.temper + 0.2f * d).coerceIn(-1f, 1f)) }; k == "shy" -> edit { it.copy(shy = (it.shy + 0.2f * d).coerceIn(-1f, 1f)) }
            k == "pitch" -> edit { it.copy(voice = it.voice.copy(pitch = (it.voice.pitch + 0.05f * d).coerceIn(0.5f, 2f))) }; k == "vspeed" -> edit { it.copy(voice = it.voice.copy(speed = (it.voice.speed + 0.05f * d).coerceIn(0.5f, 2f))) }
            k == "bright" -> edit { it.copy(voice = it.voice.copy(bright = (it.voice.bright + 0.1f * d).coerceIn(0f, 1f))) }
            k.startsWith("skill_") -> { val sk = k.removePrefix("skill_"); edit { s -> val cur = s.skill(sk); val left = CharSpec.SKILL_POINTS - s.skills.values.sum(); if (d > 0 && left <= 0) { app.toast("點數用完了"); s } else s.copy(skills = s.skills + (sk to (cur + d).coerceIn(0, 10))) } }
        }
    }
    private fun button(k: String) {
        when (k) {
            "listen" -> { val l = Speech.say(spec, "你好，我是${spec.name}。今天也請多指教。", Rng(app.platform.now()), 60, true); bubble = l to app.time; scenePose = Pose.TALK; app.platform.voice(spec.voice, l) }
            "tagpick" -> app.show(TagSheet(spec.tags) { tags -> edit { it.copy(tags = tags) } })
            "marks" -> app.show(MarksSheet(c) { m -> editChar { it.copy(marks = m) } })
            "reimport" -> app.push(ImportStudio(edit = c, spec = spec))
        }
    }
    private fun pickFace(emotion: String) {
        if (c.source == "preset") return
        app.platform.pickImage { img, err -> if (err != null) { app.toast(err); return@pickImage }; img ?: return@pickImage
            val r = Raster(img.w, img.h, img.px); app.saves.setFace(c.id, emotion, r); c = app.saves.libChar(c.id) ?: c; saved = saved.first to c; look = null; app.toast("換好了表情圖") }
    }
    private fun save() {
        if (!dirty) { app.pop(); return }
        val err = onSave(spec, c); if (err != null) { app.toast(err); return }
        saved = spec to c; app.toast("存好了"); app.pop()
    }
    /** back from the import studio: the pictures may have changed */
    override fun resume() { app.saves.libChar(c.id)?.let { if (it != c) { c = it; saved = saved.first to it; hist.replaceAll { (s, _) -> s to it }; look = null } } }
    override fun back(): Boolean { if (dirty) { app.show(Confirm("還沒儲存", "要放棄這些修改嗎？", "放棄") { app.pop() }); return true }; return false }
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) = scroll.drag(dy, y, start)
    override fun release() = scroll.release()

    companion object {
        val AXES = listOf("外向" to "內向", "活潑" to "沉穩", "認真" to "隨性", "坦率" to "含蓄", "溫柔" to "好勝")
        val EMOTIONS = linkedMapOf("開心" to "happy", "生氣" to "angry", "難過" to "sad", "害羞" to "shy", "睡覺" to "sleep", "驚訝" to "surprised")
        val TINTS = listOf("", "#F0705A", "#F4A259", "#FFC857", "#8ED1B4", "#7AAAD6", "#B79CE0", "#E8A86B")
        private val LIST_TITLE = mapOf("tags" to "自訂標籤（M5 的標籤編輯器才有效果）", "endings" to "語尾", "catchphrases" to "口頭禪", "banned" to "不說的字", "likes" to "喜歡的東西或事", "dislikes" to "討厭的東西或事",
            "hobbies" to "興趣", "fears" to "怕的東西", "memories" to "一段重要的回憶")
        fun listOf(s: CharSpec, k: String): List<String> = when (k) { "tags" -> s.tags; "endings" -> s.endings; "catchphrases" -> s.catchphrases; "banned" -> s.banned; "likes" -> s.likes; "dislikes" -> s.dislikes
            "hobbies" -> s.hobbies; "fears" -> s.fears; "memories" -> s.memories; else -> emptyList() }
        fun setList(s: CharSpec, k: String, v: List<String>): CharSpec { val d = v.distinct(); return when (k) { "tags" -> s.copy(tags = d); "endings" -> s.copy(endings = d); "catchphrases" -> s.copy(catchphrases = d)
            "banned" -> s.copy(banned = d); "likes" -> s.copy(likes = d); "dislikes" -> s.copy(dislikes = d); "hobbies" -> s.copy(hobbies = d); "fears" -> s.copy(fears = d); "memories" -> s.copy(memories = d); else -> s } }
    }
}

/** the tag library (plan 13.2): six groups, each tag says what it does */
class TagSheet(initial: List<String>, val done: (List<String>) -> Unit) : Overlay() {
    private val slide = Spring(0f, 1f); private var cat = TagCat.WORLD; private val chosen = LinkedHashSet(initial); private var lastTapped: String? = null
    private val scroll = Scroller()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val W = app.w; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val h = app.h * 0.82f; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); g.fillRound(W / 2 - 20, y + 10, 40f, 5f, 3f, t.line); app.zone("sheet:body", 0f, y, W, h)
        g.text("標籤庫", G + 4, y + 44, Dim.FS_L, t.ink); g.text("已選 ${chosen.size}", W - G - 4, y + 44, Dim.FS_S, t.ink2, FontKind.UI, Align.RIGHT)
        var cx = G; var cy = y + 60
        for (c in TagCat.values()) { val cw = g.measure(c.zh, Dim.FS_S + 1) + 28; if (cx + cw > W - G) { cx = G; cy += 44 }; Widgets.chip(g, app, "cat:${c.name}", cx, cy, c.zh, c == cat, 36f); cx += cw + 6 }
        val top = cy + 50; val bottom = y + h - app.insetBottom - 130
        val sc = scroll.step(dt); g.save(); g.clip(0f, top, W, bottom - top); g.translate(0f, -sc); app.zoneDy = -sc
        val f = Form(app, g, G, W - G * 2, top); f.chips("tag", Catalog.TAGS.values.filter { it.cat == cat }.map { it.id }, chosen); g.restore(); app.zoneDy = 0f
        scroll.max = maxOf(0f, f.y - bottom)
        val info = lastTapped?.let { Catalog.TAGS[it] }?.let { "「${it.id}」${it.note}" } ?: "點標籤看它做什麼；可以選很多個"
        for ((i, l) in Widgets.wrap(g, info, Dim.FS_S, W - G * 2, 2).withIndex()) g.text(l, G + 4, bottom + 22 + i * 20f, Dim.FS_S, t.ink2)
        Widgets.button(g, app, "tags:done", G, y + h - app.insetBottom - 72, W - G * 2, 56f, "好", Kind.PRIMARY)
    }
    override fun tap(id: String) {
        when {
            id.startsWith("cat:") -> { cat = TagCat.valueOf(id.removePrefix("cat:")); scroll.reset() }
            id.startsWith("chip:tag:") -> { val v = id.removePrefix("chip:tag:"); lastTapped = v; if (!chosen.remove(v)) chosen += v }
            id == "tags:done" -> { app.closeOverlay(); done(chosen.toList()) }
        }
    }
    override fun dismissed() { done(chosen.toList()) }
}

/** 性格問答: ten questions, three answers each */
class QuizSheet(val done: (List<Int>) -> Unit) : Overlay() {
    private val pop = Spring(0f, 1f); private val answers = ArrayList<Int>()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = pop.step(dt); val W = app.w; val G = Dim.GUTTER; val q = Builder.QUIZ[answers.size]
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val h = 420f + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("sheet:body", 0f, y, W, h)
        for (i in 0 until Builder.QUIZ.size) g.fillRound(W / 2 - 90 + i * 18f, y + 22, if (i == answers.size) 14f else 8f, 8f, 4f, if (i <= answers.size) t.accent else t.lip)
        g.text("${answers.size + 1}／${Builder.QUIZ.size}", G + 4, y + 66, Dim.FS_S, t.ink2)
        for ((i, l) in Widgets.wrap(g, q.text, Dim.FS_L, W - G * 2, 2).withIndex()) g.text(l, G + 4, y + 98 + i * 28f, Dim.FS_L, t.ink)
        q.answers.forEachIndexed { i, a -> Widgets.button(g, app, "ans:$i", G, y + 150 + i * 70f, W - G * 2, 58f, a.text) }
    }
    override fun tap(id: String) { if (id.startsWith("ans:")) { answers += id.removePrefix("ans:").toInt(); pop.snap(0.85f); pop.target = 1f; if (answers.size >= Builder.QUIZ.size) { app.closeOverlay(); done(answers) } } }
}

/** 隨機: lock the tabs to keep, then roll */
class DiceSheet(val done: (Set<String>) -> Unit) : Overlay() {
    private val slide = Spring(0f, 1f); private val locks = HashSet<String>()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val W = app.w; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val h = 300f + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("sheet:body", 0f, y, W, h)
        g.text("隨機", G + 4, y + 44, Dim.FS_L, t.ink); g.text("鎖住的分頁不會變；結果保證不衝突", G + 4, y + 70, Dim.FS_S, t.ink2)
        val f = Form(app, g, G, W - G * 2, y + 84); f.chips("lock", Builder.LOCKS.map { "鎖住$it" }, locks.map { "鎖住$it" }.toSet())
        Widgets.button(g, app, "dice:go", G, y + h - app.insetBottom - 72, W - G * 2, 56f, "擲骰子", Kind.PRIMARY)
    }
    override fun tap(id: String) { when { id.startsWith("chip:lock:") -> { val k = id.removePrefix("chip:lock:鎖住"); if (!locks.remove(k)) locks += k }; id == "dice:go" -> { app.closeOverlay(); done(locks) } } }
}

/** 部位標記 (plan 13.3): circles on the picture for the head, face, hands, ears, tail — petting, blush and props use them */
class MarksSheet(val c: LibChar, val done: (Map<String, Mark>) -> Unit) : Overlay() {
    private val slide = Spring(0f, 1f); private val marks = LinkedHashMap(c.marks); private var cur = "頭"
    private var box = floatArrayOf(0f, 0f, 1f, 1f)
    override val dismissible = false
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val W = app.w; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val h = app.h * 0.86f; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("sheet:body", 0f, y, W, h)
        g.text("部位標記", G + 4, y + 40, Dim.FS_L, t.ink); g.text("選部位，再點圖上的位置；不標也可以", G + 4, y + 64, Dim.FS_S, t.ink2)
        val f = Form(app, g, G, W - G * 2, y + 74); f.chips("part", PARTS, setOf(cur))
        val img = app.charImg(c, 512); val top = f.y; val avail = h - (top - y) - 150 - app.insetBottom
        g.fillRound(G, top, W - G * 2, avail, 20f, t.surface2)
        if (img != null) { val k = minOf((W - G * 2 - 20) / img.w, (avail - 20) / img.h); val iw = img.w * k; val ih = img.h * k; val ix = (W - iw) / 2; val iy = top + (avail - ih) / 2
            box = floatArrayOf(ix, iy, iw, ih); g.image(img, ix, iy, iw, ih); app.zone("pic", ix, iy, iw, ih)
            for ((n, m) in marks) { val on = n == cur; g.strokeRound(ix + (m.x - m.r) * iw, iy + m.y * ih - m.r * iw, m.r * 2 * iw, m.r * 2 * iw, m.r * iw, if (on) 3f else 2f, if (on) t.accent else t.select)
                g.text(n, ix + m.x * iw, iy + m.y * ih + 5, Dim.FS_S - 1, t.ink, FontKind.UI, Align.CENTER) } }
        val by = y + h - app.insetBottom - 132
        Widgets.round(g, app, "r:-", G + 30, by + 24, 20f, "minus"); g.text("大小", G + 74, by + 30, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER); Widgets.round(g, app, "r:+", G + 118, by + 24, 20f, "plus")
        Widgets.button(g, app, "clear", W - G - 120, by, 120f, 48f, "清除這個")
        Widgets.button(g, app, "marks:done", G, y + h - app.insetBottom - 72, W - G * 2, 56f, "好", Kind.PRIMARY)
    }
    override fun tap(id: String) {
        when {
            id.startsWith("chip:part:") -> cur = id.removePrefix("chip:part:")
            id == "pic" -> { val fx = app.tapX; val fy = app.tapY; marks[cur] = Mark(((fx - box[0]) / box[2]).coerceIn(0f, 1f), ((fy - box[1]) / box[3]).coerceIn(0f, 1f), marks[cur]?.r ?: if (cur == "手") 0.07f else 0.12f) }
            id == "r:+" -> marks[cur]?.let { marks[cur] = it.copy(r = (it.r + 0.02f).coerceAtMost(0.4f)) }; id == "r:-" -> marks[cur]?.let { marks[cur] = it.copy(r = (it.r - 0.02f).coerceAtLeast(0.03f)) }
            id == "clear" -> marks.remove(cur)
            id == "marks:done" -> { app.closeOverlay(); done(marks.toMap()) }
        }
    }
    companion object { val PARTS = listOf("頭", "臉", "手", "耳朵", "尾巴", "身體") }
}
