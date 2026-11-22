package app.ocshimeji.sim.chars

import app.ocshimeji.sim.Rng

/** helpers for creating characters (plan 12.4 輔助工具): templates, the quiz, dice with locks, compatibility hints, checks */
object Builder {
    // ---------------- 原創範本 ----------------
    /** a template sets personality, speech, likes and life; name, age, appearance and story stay the player's */
    val TEMPLATES: Map<String, CharSpec> = mapOf(
        "溫柔的大姊姊" to CharSpec(axes = listOf(0.3f, -0.2f, 0.4f, 0.2f, 0.9f), traits = listOf("愛照顧人", "溫和", "愛乾淨"), values = listOf("家人"), style = "正式", endings = listOf("喔"),
            likes = listOf("紅茶", "編織"), tastes = mapOf("甜" to 1), hobbies = listOf("煮飯"), roomPref = "整齊", attitude = "親近", skills = mapOf("料理" to 5, "打掃" to 3, "聊天" to 2), motion = "高冷"),
        "嘴硬心軟" to CharSpec(axes = listOf(-0.2f, 0.2f, 0.3f, -0.8f, 0.4f), traits = listOf("嘴硬心軟", "好勝"), style = "冷淡", catchphrases = listOf("哼"), attitude = "害羞", shy = 0.6f, temper = 0.4f,
            likes = listOf("甜點"), tastes = mapOf("甜" to 1, "苦" to -1), skills = mapOf("閱讀" to 4, "打掃" to 3, "料理" to 3), motion = "高冷"),
        "天然呆" to CharSpec(axes = listOf(0.4f, 0.1f, -0.6f, 0.6f, 0.6f), traits = listOf("天然呆", "樂天", "夢想家"), style = "可愛", endings = listOf("耶"), likes = listOf("雲", "布丁"),
            oversleep = 0.6f, attitude = "黏人", skills = mapOf("園藝" to 4, "聊天" to 4, "料理" to 2), motion = "慵懶"),
        "元氣小太陽" to CharSpec(axes = listOf(0.9f, 0.9f, 0f, 0.7f, 0.4f), traits = listOf("健談", "勤快", "樂天"), values = listOf("樂趣"), style = "元氣", catchphrases = listOf("沒問題"),
            likes = listOf("運動", "烤肉"), wake = 6, attitude = "黏人", skills = mapOf("聊天" to 5, "料理" to 3, "打掃" to 2), motion = "元氣"),
        "冷面學者" to CharSpec(axes = listOf(-0.7f, -0.4f, 0.9f, 0.5f, 0f), traits = listOf("書蟲", "獨立", "冷靜"), values = listOf("知識"), style = "冷淡", likes = listOf("舊書", "咖啡"),
            tastes = mapOf("苦" to 1, "甜" to -1), sleep = 1, nightOwl = 0.7f, attitude = "有禮", skills = mapOf("閱讀" to 7, "打掃" to 3), motion = "高冷"),
        "慵懶貓系" to CharSpec(axes = listOf(-0.3f, -0.9f, -0.5f, 0.3f, 0.3f), traits = listOf("懶散", "獨立"), tags = listOf("貓系"), style = "隨性", endings = listOf("喵"),
            likes = listOf("曬太陽", "紙箱"), oversleep = 0.8f, attitude = "陌生", skills = mapOf("園藝" to 2, "閱讀" to 3, "聊天" to 5), motion = "慵懶"),
        "中二魔王" to CharSpec(axes = listOf(0.5f, 0.6f, 0.2f, -0.3f, -0.4f), traits = listOf("好勝", "情緒化"), tags = listOf("魔王", "中二病"), style = "中二", selfRef = "本王", callPlayer = "汝",
            likes = listOf("披風", "黑色的東西"), color = "黑", nightOwl = 0.6f, sleep = 1, attitude = "有禮", skills = mapOf("閱讀" to 4, "聊天" to 4, "料理" to 2), motion = "元氣"),
        "認真班長" to CharSpec(axes = listOf(0.2f, 0.3f, 0.9f, 0.6f, 0.2f), traits = listOf("早起", "愛乾淨", "完美主義"), values = listOf("成就"), style = "正式", tags = listOf("學生"),
            likes = listOf("筆記本", "整齊的書架"), wake = 6, sleep = 22, roomPref = "整齊", attitude = "有禮", skills = mapOf("閱讀" to 4, "打掃" to 4, "料理" to 2), motion = "高冷"),
    )
    fun applyTemplate(name: String, base: CharSpec): CharSpec {
        val t = TEMPLATES[name] ?: return base
        return t.copy(name = base.name, nickname = base.nickname, pronoun = base.pronoun, age = base.age, birthday = base.birthday, height = base.height, species = base.species,
            tags = (base.tags + t.tags).distinct(), story = base.story, memories = base.memories, secret = base.secret, tint = base.tint, petSpot = base.petSpot, voice = base.voice)
    }

    // ---------------- 性格問答（10 題） ----------------
    class Answer(val text: String, val apply: (CharSpec) -> CharSpec)
    class Question(val text: String, val answers: List<Answer>)
    private fun ax(s: CharSpec, i: Int, d: Float) = s.copy(axes = s.axes.toMutableList().also { while (it.size < 5) it += 0f; it[i] = (it[i] + d).coerceIn(-1f, 1f) })
    private fun tr(s: CharSpec, id: String) = addTrait(s, id)
    val QUIZ: List<Question> = listOf(
        Question("假日早上醒來，你會？", listOf(Answer("馬上起床，今天要做好多事") { tr(ax(it, 1, 0.5f), "早起").copy(wake = 6) }, Answer("再睡一下……就一下") { tr(ax(it, 1, -0.5f), "懶散").copy(oversleep = 0.7f) }, Answer("躺在床上看書") { tr(ax(it, 2, 0.3f), "書蟲") })),
        Question("朋友心情不好的時候？", listOf(Answer("陪他聊一整晚") { tr(ax(it, 0, 0.5f), "健談") }, Answer("默默煮點東西給他吃") { tr(ax(it, 4, 0.5f), "愛照顧人") }, Answer("給他一點自己的空間") { tr(ax(it, 0, -0.3f), "獨立") })),
        Question("你的房間通常是？", listOf(Answer("一塵不染") { tr(ax(it, 2, 0.5f), "愛乾淨").copy(roomPref = "整齊", hygiene = 0.6f) }, Answer("亂中有序") { it.copy(roomPref = "隨性") }, Answer("東西堆成小山") { tr(ax(it, 2, -0.5f), "邋遢").copy(hygiene = -0.5f) })),
        Question("一天裡最喜歡的時間？", listOf(Answer("清晨") { it.copy(wake = minOf(it.wake, 6)) }, Answer("午後") { it.copy(nap = true) }, Answer("深夜") { tr(it, "夜貓子").copy(nightOwl = 0.7f, sleep = 1) })),
        Question("被稱讚的時候？", listOf(Answer("大方地說謝謝") { ax(it, 3, 0.5f) }, Answer("害羞得說不出話") { tr(it, "害羞").copy(shy = 0.7f) }, Answer("嘴上說「還好啦」") { tr(ax(it, 3, -0.6f), "嘴硬心軟") })),
        Question("生氣的時候？", listOf(Answer("馬上說出來") { ax(it, 3, 0.3f).copy(temper = 0.6f) }, Answer("一個人生悶氣，然後哭") { tr(it, "愛哭").copy(cry = 0.6f) }, Answer("睡一覺就忘了") { tr(it, "樂天") })),
        Question("晚餐想怎麼吃？", listOf(Answer("自己下廚") { tr(it, "美食家").copy(skills = it.skills + ("料理" to 4)) }, Answer("一點點就好") { tr(it, "小鳥胃") }, Answer("越多越好！") { tr(it, "貪吃") })),
        Question("空閒的時候？", listOf(Answer("看電視") { tr(addValue(it, "樂趣"), "電視迷") }, Answer("照顧植物") { tr(addValue(it, "和平"), "園藝家").copy(roomPref = "要有植物") }, Answer("發呆想像") { tr(addValue(it, "自由"), "夢想家") })),
        Question("你覺得最重要的是？", listOf(Answer("家人與朋友") { addValue(it, "家人") }, Answer("自由自在") { addValue(it, "自由") }, Answer("做出成果") { addValue(it, "成就") })),
        Question("做事的速度？", listOf(Answer("越快越好") { tr(it, "急性子") }, Answer("慢慢來") { tr(it, "慢吞吞") }, Answer("要做到完美") { tr(ax(it, 2, 0.3f), "完美主義") })),
    )
    /** answers: index per question (−1 = skipped) */
    fun quiz(base: CharSpec, answers: List<Int>): CharSpec {
        var s = base.copy(traits = emptyList(), values = emptyList(), axes = listOf(0f, 0f, 0f, 0f, 0f))
        answers.forEachIndexed { i, a -> QUIZ.getOrNull(i)?.answers?.getOrNull(a)?.let { s = it.apply(s) } }
        return fixSkills(s)
    }

    // ---------------- 隨機（鎖住的分頁不變；保證不衝突） ----------------
    val LOCKS = listOf("基本", "說話", "個性", "喜好", "生活", "能力")
    private val LIKE_POOL = listOf("甜點", "曬太陽", "下雨天", "熱湯", "毛毯", "星星", "音樂", "貓", "布丁", "紅茶", "咖啡", "散步", "漫畫", "花", "海", "蛋糕", "麵包", "遊戲", "整理", "睡午覺")
    private val HOBBY_POOL = listOf("看書", "畫畫", "唱歌", "煮飯", "種花", "看電影", "寫日記", "收集貼紙", "拼圖", "散步")
    private val DREAM_POOL = listOf("開一間小店", "環遊世界", "做出最好吃的蛋糕", "交到很多朋友", "寫一本書", "住在海邊")
    private val FEAR_POOL = listOf("打雷", "蟲", "黑暗", "很高的地方", "一個人")
    private val NAMES = listOf("小麥", "栗子", "可可", "團子", "小雨", "星野", "阿光", "蘿蔔", "麻糬", "雲朵", "小葵", "奶茶")
    fun random(base: CharSpec, r: Rng, locks: Set<String> = emptySet()): CharSpec {
        var s = base
        if ("基本" !in locks) s = s.copy(name = if (base.name == "新角色") r.pick(NAMES) else base.name, age = if (base.adult) 18 + r.nextInt(40) else base.age, height = 80 + r.nextInt(50),
            birthday = "%02d-%02d".format(1 + r.nextInt(12), 1 + r.nextInt(28)),
            tags = (base.tags.filter { it !in Catalog.TAGS } + pickTags(r)).distinct())
        if ("說話" !in locks) s = s.copy(style = r.pick(CharSpec.STYLES), endings = if (r.chance(0.4)) listOf(r.pick(listOf("喔", "呢", "啦", "耶", "唷", "的說"))) else emptyList(),
            catchphrases = if (r.chance(0.4)) listOf(r.pick(listOf("沒問題", "原來如此", "真的假的", "好耶", "嗯哼"))) else emptyList(),
            voice = Voice(0.75f + r.nextFloat() * 0.6f, 0.8f + r.nextFloat() * 0.4f, r.pick(Voice.TIMBRES), r.nextFloat()))
        if ("個性" !in locks) {
            var p = s.copy(axes = List(5) { (r.nextFloat() * 2 - 1) * 0.8f }, traits = emptyList(), quirks = emptyList(), values = emptyList(),
                cry = (r.nextFloat() * 2 - 1) * 0.6f, temper = (r.nextFloat() * 2 - 1) * 0.6f, shy = (r.nextFloat() * 2 - 1) * 0.6f)
            val ids = Catalog.TRAITS.keys.toList(); repeat(3 + r.nextInt(3)) { p = addTrait(p, r.pick(ids)) }
            val q = Catalog.QUIRKS.keys.toList(); repeat(1 + r.nextInt(2)) { p = p.copy(quirks = (p.quirks + r.pick(q)).distinct()) }
            p = addValue(p, r.pick(Catalog.VALUES.keys.toList())); s = p
        }
        if ("喜好" !in locks) s = s.copy(likes = pickN(LIKE_POOL, 3, r), dislikes = pickN(LIKE_POOL, 1, r).filter { it !in s.likes }, tastes = CharSpec.TASTES.associateWith { r.nextInt(3) - 1 },
            color = r.pick(listOf("紅", "橘", "黃", "綠", "藍", "紫", "粉紅", "白", "黑")), season = r.pick(CharSpec.SEASONS), weather = r.pick(CharSpec.WEATHERS),
            hobbies = pickN(HOBBY_POOL, 2, r), fears = pickN(FEAR_POOL, 1, r), dream = r.pick(DREAM_POOL))
            .let { x -> x.copy(dislikes = x.dislikes.filter { it !in x.likes }) }
        if ("生活" !in locks) s = s.copy(wake = 5 + r.nextInt(5), sleep = listOf(21, 22, 23, 0, 1)[r.nextInt(5)], nap = r.chance(0.6), oversleep = r.nextFloat(), nightOwl = r.nextFloat() * 0.8f,
            hygiene = (r.nextFloat() * 2 - 1) * 0.8f, roomPref = r.pick(CharSpec.ROOM_PREFS), attitude = r.pick(CharSpec.ATTITUDES), motion = r.pick(CharSpec.MOTIONS), petSpot = r.pick(CharSpec.SPOTS))
        if ("能力" !in locks) { val m = HashMap<String, Int>(); repeat(CharSpec.SKILL_POINTS) { val k = r.pick(CharSpec.SKILLS); if ((m[k] ?: 0) < 7) m[k] = (m[k] ?: 0) + 1 }; s = s.copy(skills = m) }
        return s
    }
    private fun <T> pickN(l: List<T>, n: Int, r: Rng): List<T> { val c = l.toMutableList(); val out = ArrayList<T>(); repeat(minOf(n, c.size)) { out += c.removeAt(r.nextInt(c.size)) }; return out }
    private fun pickTags(r: Rng): List<String> {
        val out = ArrayList<String>()
        for (cat in listOf(TagCat.WORLD, TagCat.RACE, TagCat.JOB, TagCat.OBSESS)) if (r.chance(0.6)) { val ids = Catalog.TAGS.values.filter { it.cat == cat }.map { it.id }; val id = r.pick(ids); if (warnings(CharSpec(tags = out + id)).isEmpty()) out += id }
        return out
    }

    // ---------------- 規則 ----------------
    /** add a trait unless it is already there, the list is full or it conflicts (a conflicting older one is replaced) */
    fun addTrait(s: CharSpec, id: String): CharSpec {
        if (id in s.traits || Catalog.TRAITS[id] == null) return s
        val kept = s.traits.filter { !Catalog.conflict(it, id) }
        if (kept.size >= Catalog.MAX_TRAITS) return s
        return s.copy(traits = kept + id)
    }
    /** R4 三態: tap once = like, again = dislike, again = neither (each list at most MAX_LIKES; a word is never on both) */
    fun cycleLike(s: CharSpec, w: String): CharSpec = when (w) {
        in s.likes -> if (s.dislikes.size >= Catalog.MAX_LIKES) s.copy(likes = s.likes - w) else s.copy(likes = s.likes - w, dislikes = s.dislikes + w)
        in s.dislikes -> s.copy(dislikes = s.dislikes - w)
        else -> if (s.likes.size >= Catalog.MAX_LIKES) s else s.copy(likes = s.likes + w)
    }
    fun addValue(s: CharSpec, id: String): CharSpec = if (id in s.values) s else s.copy(values = (s.values + id).takeLast(Catalog.MAX_VALUES))
    /** skills never add up to more than the points */
    fun fixSkills(s: CharSpec): CharSpec {
        var left = CharSpec.SKILL_POINTS; val out = LinkedHashMap<String, Int>()
        for (k in CharSpec.SKILLS) { val v = (s.skills[k] ?: 0).coerceIn(0, left); if (v > 0) out[k] = v; left -= v }
        return s.copy(skills = out)
    }
    const val MAX_HABITS = 5
    /** problems that make a spec invalid (the editor refuses to save) */
    fun errors(s: CharSpec): List<String> {
        val e = ArrayList<String>()
        if (s.name.isBlank()) e += "還沒有名字"
        if (s.traits.size > Catalog.MAX_TRAITS) e += "特質最多 ${Catalog.MAX_TRAITS} 個"
        if (s.quirks.size > Catalog.MAX_QUIRKS) e += "小怪癖最多 ${Catalog.MAX_QUIRKS} 個"
        if (s.values.size > Catalog.MAX_VALUES) e += "價值觀最多 ${Catalog.MAX_VALUES} 個"
        for (i in s.traits.indices) for (j in i + 1 until s.traits.size) if (Catalog.conflict(s.traits[i], s.traits[j])) e += "「${s.traits[i]}」和「${s.traits[j]}」不能同時選"
        if (s.skills.values.sum() > CharSpec.SKILL_POINTS) e += "能力點數超過 ${CharSpec.SKILL_POINTS}"
        if (s.age < 0 || s.age > 999) e += "年齡要在 0～999"
        if (s.likes.size > Catalog.MAX_LIKES || s.dislikes.size > Catalog.MAX_LIKES) e += "喜歡、不喜歡各最多 ${Catalog.MAX_LIKES} 個"
        s.likes.firstOrNull { it in s.dislikes }?.let { e += "「$it」不能又喜歡又不喜歡" }
        if (s.habits.size > MAX_HABITS) e += "自訂事件最多 $MAX_HABITS 個"
        if (s.address.others.values.any { it.tone !in app.ocshimeji.sim.chars.Address.TONES }) e += "對別人的態度只能選：${app.ocshimeji.sim.chars.Address.TONES.joinToString("、")}"
        return e
    }
    /** 相容性提示: only reminders, never blocks (plan 12.4) */
    fun warnings(s: CharSpec, houseId: String? = null, housemates: Int = 1): List<String> {
        val w = ArrayList<String>(); fun has(x: String) = s.has(x) || s.likes.any { it.contains(x) }
        if ((s.has("怕光") || s.has("吸血鬼")) && (has("曬太陽") || s.has("植物系"))) w += "怕光，卻喜歡曬太陽：白天會很矛盾"
        if (s.has("怕水") && (s.has("人魚") || has("泡澡"))) w += "怕水又離不開水，洗澡會很掙扎"
        if (s.has("不用睡覺") && (s.has("睡神") || s.has("容易睏"))) w += "不用睡覺卻很愛睡：睡覺的效果會互相抵消"
        if (s.has("社恐") && (s.has("健談") || s.has("黏人"))) w += "社恐又很想跟人說話：聊天的意願會很低，社交需求卻掉得快"
        if (s.has("潔癖") && s.has("邋遢")) w += "潔癖和邋遢：會一直不開心"
        if ((s.has("夜行性") || s.has("夜貓子")) && (s.has("早起") || s.has("早起體質"))) w += "夜行又早起：會睡得很少"
        if (s.likes.any { it in s.dislikes }) w += "同一件事既喜歡又討厭"
        if (s.has("怕吵") && (houseId == "apartment" || housemates >= 3)) w += "怕吵＋人多的房子＝會常常不開心"
        if ((s.has("怕孤單") || s.has("黏人")) && housemates <= 1) w += "怕孤單卻一個人住：會常常寂寞"
        if (s.has("怕黑") && s.sleep in 0..4) w += "怕黑又很晚睡：夜裡會害怕"
        return w
    }
}
