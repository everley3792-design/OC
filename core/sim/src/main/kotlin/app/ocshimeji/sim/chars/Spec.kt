package app.ocshimeji.sim.chars

import kotlinx.serialization.Serializable

/**
 * Everything about a character except how it looks (plan 12.4: no face builder — appearance comes from importing, drawing or a
 * preset; everything else is deep). Nine tabs in the editor map onto these groups. Every field has an effect somewhere
 * (the life, the lines, the card or the drawing); `SpecEffectsTest` checks each one.
 *
 * A library character keeps its original spec; a world keeps its own copy per resident (they live their own lives).
 */
@Serializable
data class CharSpec(
    // ---- 基本
    val name: String = "新角色",
    val nickname: String = "",
    /** 他／她／牠／祂 or anything the player writes */
    val pronoun: String = "牠",
    val age: Int = 20,
    /** "MM-DD" or "" */
    val birthday: String = "",
    /** 60–200: how tall on screen compared with the others (100 = normal) */
    val height: Int = 100,
    val species: String = "未知",
    /** tag ids from `Tags` or free words (a free word is a custom tag with no effect until M5's tag editor) */
    val tags: List<String> = emptyList(),
    // ---- 聲音與說話
    val voice: Voice = Voice(),
    val style: String = "隨性",
    /** how they call themselves */
    val selfRef: String = "我",
    /** how they call you once they are close (before that: 你) */
    val callPlayer: String = "你",
    val endings: List<String> = emptyList(),
    val catchphrases: List<String> = emptyList(),
    /** words they never say (replaced by 那個) */
    val banned: List<String> = emptyList(),
    val greeting: String = "",
    // ---- 個性
    /** 外向, 活潑, 認真, 坦率, 溫柔 — each −1..1 */
    val axes: List<Float> = listOf(0f, 0f, 0f, 0f, 0f),
    val traits: List<String> = emptyList(),
    val quirks: List<String> = emptyList(),
    /** what matters most (≤ 2) */
    val values: List<String> = emptyList(),
    /** how strongly feelings show: tears, temper, shyness (−1..1) */
    val cry: Float = 0f, val temper: Float = 0f, val shy: Float = 0f,
    // ---- 喜好
    val likes: List<String> = emptyList(),
    val dislikes: List<String> = emptyList(),
    /** 甜 鹹 酸 辣 苦 → −1 dislike, 0, 1 like */
    val tastes: Map<String, Int> = emptyMap(),
    val color: String = "", val season: String = "", val weather: String = "",
    val hobbies: List<String> = emptyList(),
    val fears: List<String> = emptyList(),
    val dream: String = "",
    // ---- 生活
    val wake: Int = 7, val sleep: Int = 23,
    val nap: Boolean = true,
    /** 0..1: stays in bed longer / goes to bed later */
    val oversleep: Float = 0f, val nightOwl: Float = 0f,
    /** −1 messy … 1 very clean */
    val hygiene: Float = 0f,
    /** 普通 / 整齊 / 隨性 / 要有植物 */
    val roomPref: String = "普通",
    // ---- 關係（對你）
    /** 陌生 / 有禮 / 害羞 / 親近 / 黏人 */
    val attitude: String = "親近",
    // ---- 背景故事
    val story: String = "",
    val memories: List<String> = emptyList(),
    val secret: String = "",
    // ---- 能力（共 10 點）
    val skills: Map<String, Int> = emptyMap(),
    // ---- 外觀（圖以外）
    /** representative colour "#RRGGBB" or "" */
    val tint: String = "",
    /** 可愛 / 高冷 / 元氣 / 慵懶: the rhythm and size of every procedural motion */
    val motion: String = "可愛",
    /** where they love being petted (頭 / 身體 / 耳朵 / 尾巴); hidden from the player until found */
    val petSpot: String = "頭",
    // ---- R4: 稱謂與說話、自訂事件
    /** how they call you and everyone else, how feelings change their talk, where their catchphrases go */
    val address: Address = Address(),
    /** little things they do on their own now and then (a line and an icon over the head) */
    val habits: List<Habit> = emptyList(),
) {
    /** how they call you at this closeness (R4: three steps; the old single field is the middle one) */
    fun callFor(affinity: Int): String = when {
        affinity >= Address.DEAR -> address.dear.ifBlank { address.close.ifBlank { callPlayer } }
        affinity >= Address.CLOSE -> address.close.ifBlank { callPlayer }
        else -> address.stranger
    }.ifBlank { "你" }
    val adult get() = age >= 18
    val stage get() = stageOf(age)
    fun axis(i: Int) = axes.getOrElse(i) { 0f }
    fun has(id: String) = id in tags || id in traits || id in quirks
    fun skill(id: String) = skills[id] ?: 0
    companion object {
        val PRONOUNS = listOf("他", "她", "牠", "祂")
        val STYLES = listOf("隨性", "正式", "可愛", "冷淡", "文青", "元氣", "古風", "中二")
        val ATTITUDES = listOf("陌生", "有禮", "害羞", "親近", "黏人")
        val ROOM_PREFS = listOf("普通", "整齊", "隨性", "要有植物")
        val MOTIONS = listOf("可愛", "高冷", "元氣", "慵懶")
        val SPOTS = listOf("頭", "身體", "耳朵", "尾巴")
        val TASTES = listOf("甜", "鹹", "酸", "辣", "苦")
        val SKILLS = listOf("料理", "園藝", "閱讀", "打掃", "聊天")
        const val SKILL_POINTS = 10
        val SEASONS = listOf("春", "夏", "秋", "冬")
        val WEATHERS = listOf("晴天", "陰天", "雨天", "下雪")
        val VALUES get() = Catalog.VALUES.keys.toList()
        /** a spec from the few words an M1 character had */
        fun fromWords(name: String, adult: Boolean, traits: List<String>, likes: List<String>): CharSpec {
            val known = traits.filter { Catalog.TRAITS.containsKey(it) || Catalog.TAGS.containsKey(it) }
            return CharSpec(name = name, age = if (adult) 20 else 12, axes = Catalog.axesFromWords(traits), traits = known.filter { Catalog.TRAITS.containsKey(it) },
                tags = known.filter { Catalog.TAGS.containsKey(it) }, likes = likes)
        }
    }
}
fun stageOf(age: Int) = when { age < 3 -> "嬰兒"; age < 6 -> "幼兒"; age < 12 -> "兒童"; age < 18 -> "少年"; age < 30 -> "青年"; age < 65 -> "成年"; else -> "老年" }

/**
 * 稱謂 (overhaul plan B-3, R4). `stranger` / `close` / `dear` = how they call you as you get closer; `others` = how they call a
 * housemate (key = that character's library id) and how they talk to them; `moods` = the speaking style when happy / angry / sad;
 * `catchWhen` = where catchphrases go (greet, surprise, end; empty = anywhere) and `catchRate` how often.
 */
@Serializable
data class Address(
    val stranger: String = "你", val close: String = "", val dear: String = "",
    val others: Map<String, Call> = emptyMap(),
    val moods: Map<String, String> = emptyMap(),
    val catchWhen: List<String> = emptyList(), val catchRate: Float = 0.22f,
) {
    companion object {
        const val CLOSE = 50; const val DEAR = 80
        val TONES = listOf("客氣", "普通", "撒嬌", "嘴硬", "敬重")
        val MOODS = linkedMapOf("happy" to "開心時", "angry" to "生氣時", "sad" to "難過時")
        val PLACES = linkedMapOf("greet" to "打招呼", "surprise" to "驚訝", "end" to "句尾")
    }
}
/** how one character calls another, and their attitude toward them */
@Serializable
data class Call(val name: String = "", val tone: String = "普通")

/** a custom little event (R4 step 7): a line, how often (0 偶爾, 1 有時, 2 常常) and the icon over the head */
@Serializable
data class Habit(val text: String, val freq: Int = 1, val icon: String = "sparkle") {
    companion object { val FREQ = listOf("偶爾", "有時", "常常"); val ICONS = linkedMapOf("sparkle" to "閃閃", "heart" to "愛心", "sweat" to "汗", "shock" to "驚訝", "gloom" to "烏雲", "fire" to "燃燒") }
}

/** a voice made of synthesized babble (the player can also import clips in M5) */
@Serializable
data class Voice(val pitch: Float = 1f, val speed: Float = 1f, val timbre: String = "圓潤", val bright: Float = 0.5f) {
    companion object { val TIMBRES = listOf("圓潤", "清脆", "沙啞", "電子") }
}

/** one direction of a relationship (A → B): how A sees B (plan 12.5). Two of them make a pair; unrequited love is just that. */
@Serializable
data class Rel(
    val from: String, val to: String,
    /** 陌生 認識 朋友 好友 知己 家人 對手 前任 戀人 or a custom name */
    val kind: String = "認識",
    val identity: String = "",
    /** 愛拌嘴, 互相照顧… (≤ 3) */
    val tags: List<String> = emptyList(),
    /** 0..100 */
    val fit: Int = 50,
    val familiar: Int = 30, val like: Int = 30, val trust: Int = 30, val crush: Int = 0, val conflict: Int = 0,
    val story: String = "",
    /** life will not change it */
    val locked: Boolean = false,
    /** flavour tags made by life from what the two did together (plan 13.1: 死黨, 宿敵, 飯友…) */
    val flavor: List<String> = emptyList(),
    /** the daily settlement (plan C-04): a new step must hold two days in a row */
    val pend: String = "", val pendDays: Int = 0,
    /** the last day they met */
    val seenDay: Long = -1,
) {
    companion object {
        val KINDS = listOf("陌生", "認識", "朋友", "好友", "知己", "家人", "對手", "前任", "戀人")
        val ROMANTIC = setOf("戀人", "前任")
        val ROMANTIC_FLAVORS = setOf("單戀", "雙向暗戀")
        val IDENTITIES = listOf("", "室友", "同學", "同事", "青梅竹馬", "師徒", "鄰居", "兄弟姊妹", "親子")
        val FLAVORS = listOf("死黨", "宿敵", "相愛相殺", "飯友", "商業互吹", "莫名其妙絕交又火速和好", "師徒", "單戀", "雙向暗戀")
        val PAIR_TAGS = listOf("愛拌嘴", "互相照顧", "無話不談", "默契", "互相較勁", "有點尷尬", "一起吃飯", "同好")
        /** how much a person wants to chat with the other (plan: relationships steer the life) */
        fun chatWeight(r: Rel?): Float {
            if (r == null) return 0.8f
            val base = when (r.kind) { "陌生" -> 0.6f; "認識" -> 0.9f; "朋友" -> 1.2f; "好友" -> 1.5f; "知己" -> 1.8f; "家人" -> 1.4f; "對手" -> 0.7f; "前任" -> 0.4f; "戀人" -> 1.9f; else -> 1f }
            return base * (0.6f + 0.8f * r.like / 100f) * (1f - 0.5f * r.conflict / 100f) * (if ("無話不談" in r.tags) 1.3f else 1f)
        }
    }
}

/** the rules every relationship follows, wherever it is set (editor, scripts, life) */
object Relations {
    /** null = allowed; otherwise why not (shown as it is) */
    fun problem(r: Rel, a: CharSpec, b: CharSpec, romance: Boolean): String? {
        if (r.from == r.to) return "不能和自己建立關係"
        val romantic = r.kind in Rel.ROMANTIC || r.crush > 0 || r.flavor.any { it in Rel.ROMANTIC_FLAVORS }
        if (romantic && (!a.adult || !b.adult)) return "未成年的角色不會有戀愛關係"
        if (romantic && !romance) return "戀愛關係要先在這個世界打開「戀愛」"
        if (r.tags.size > 3) return "相處標籤最多 3 個"
        if (listOf(r.fit, r.familiar, r.like, r.trust, r.crush, r.conflict).any { it !in 0..100 }) return "數值要在 0～100"
        return null
    }
    /** both directions say family (for sharing a room with a minor) */
    fun family(rels: List<Rel>, a: String, b: String) = rels.any { it.from == a && it.to == b && it.kind == "家人" } && rels.any { it.from == b && it.to == a && it.kind == "家人" }
}
