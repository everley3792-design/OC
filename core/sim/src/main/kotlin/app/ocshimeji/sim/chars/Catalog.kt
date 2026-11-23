package app.ocshimeji.sim.chars

import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.Pose

/**
 * What a tag, trait, quirk or value DOES (plan 13.2: a tag is a bundle of effects, not decoration). Everything the life reads
 * about personality comes through these, never from names written into the code.
 */
data class Effect(
    /** activity id or activity tag (food, lazy, active, calm, dreamy, tidy, vain, smart, rest, chat) → score multiplier */
    val act: Map<String, Float> = emptyMap(),
    /** need → decay multiplier (0 = never drops) */
    val decay: Map<Need, Float> = emptyMap(),
    /** hours earlier (−) / later (+) */
    val wake: Int = 0, val sleep: Int = 0,
    val moodPos: Float = 1f, val moodNeg: Float = 1f,
    val speed: Float = 1f, val duration: Float = 1f,
    /** things they say when nothing is happening */
    val lines: List<String> = emptyList(),
    /** activities they hate doing (a sour mood card when they must) */
    val hate: Set<String> = emptySet(),
    /** chat topics */
    val topics: List<String> = emptyList(),
    /** how they are drawn: float, glow, ghost, wobble, sparkle */
    val render: Set<String> = emptySet(),
    /** situations they react to: dark (怕黑), crowd (怕吵), alone (怕孤單), sunlight (怕光) */
    val flags: Set<String> = emptySet(),
    /** the micro-behaviour of a quirk */
    val micro: QuirkMicro? = null,
)
data class QuirkMicro(val pose: Pose, val sec: Float, val line: String?, val prop: String? = null)

enum class TagCat(val zh: String) { WORLD("世界觀"), RACE("種族／形態"), JOB("職業／身分"), BODY("體質"), WEAK("弱點與過敏"), OBSESS("執念與癖好") }
data class Tag(val id: String, val cat: TagCat, val fx: Effect, val note: String)
enum class TraitCat(val zh: String) { LIFE("生活"), SOCIAL("社交"), FEEL("情緒"), LIKE("興趣"), ODD("性子") }
data class Trait(val id: String, val cat: TraitCat, val fx: Effect, val note: String)
data class Quirk(val id: String, val fx: Effect, val note: String)
data class Value(val id: String, val fx: Effect, val note: String)

object Catalog {
    private fun fx(vararg act: Pair<String, Float>, decay: Map<Need, Float> = emptyMap(), wake: Int = 0, sleep: Int = 0, pos: Float = 1f, neg: Float = 1f, speed: Float = 1f, dur: Float = 1f,
                   lines: List<String> = emptyList(), hate: Set<String> = emptySet(), topics: List<String> = emptyList(), render: Set<String> = emptySet(), flags: Set<String> = emptySet()) =
        Effect(act.toMap(), decay, wake, sleep, pos, neg, speed, dur, lines, hate, topics, render, flags)

    // ---------------- traits (5 groups; ≤ 10 per character; conflicting pairs cannot be picked together) ----------------
    val TRAITS: Map<String, Trait> = listOf(
        Trait("愛乾淨", TraitCat.LIFE, fx("tidy" to 1.6f, "bathe" to 1.4f, decay = mapOf(Need.HYGIENE to 1.3f), lines = listOf("這裡有點灰塵……")), "常常打掃、洗澡；髒了心情差得快"),
        Trait("邋遢", TraitCat.LIFE, fx("tidy" to 0.35f, "bathe" to 0.7f, decay = mapOf(Need.HYGIENE to 0.8f), lines = listOf("亂一點才找得到東西嘛。")), "幾乎不整理"),
        Trait("早起", TraitCat.LIFE, fx(wake = -1, sleep = -1, lines = listOf("早上的空氣最好了。")), "提早一小時起床、睡覺"),
        Trait("夜貓子", TraitCat.LIFE, fx(wake = 1, sleep = 2, lines = listOf("晚上才是我的時間。")), "晚睡晚起"),
        Trait("貪吃", TraitCat.LIFE, fx("food" to 1.5f, decay = mapOf(Need.FOOD to 1.35f), lines = listOf("好像又有點餓了。")), "餓得快、常去冰箱"),
        Trait("小鳥胃", TraitCat.LIFE, fx("food" to 0.8f, decay = mapOf(Need.FOOD to 0.7f)), "吃一點就飽"),
        Trait("懶散", TraitCat.LIFE, fx("desk:climb" to 0.4f, "desk:nest" to 1.4f, "lazy" to 1.5f, "active" to 0.6f, "rest" to 1.3f, speed = 0.85f, lines = listOf("再躺一下下……")), "愛躺、走得慢"),
        Trait("勤快", TraitCat.LIFE, fx("desk:climb" to 1.5f, "active" to 1.5f, "tidy" to 1.3f, "lazy" to 0.7f, speed = 1.1f), "閒不下來"),
        Trait("黏人", TraitCat.SOCIAL, fx("desk:cling" to 1.8f, "desk:nest" to 0.6f, "chat" to 1.4f, "s:肢體" to 1.6f, "r:肢體" to 1.3f, decay = mapOf(Need.ATTENTION to 1.5f, Need.SOCIAL to 1.3f), lines = listOf("你在看我嗎？"), flags = setOf("alone")), "很快就想要人陪"),
        Trait("有點黏人", TraitCat.SOCIAL, fx("desk:cling" to 1.35f, "chat" to 1.2f, decay = mapOf(Need.ATTENTION to 1.25f)), "比一般人更想被理"),
        Trait("獨立", TraitCat.SOCIAL, fx("desk:nest" to 1.8f, "desk:cling" to 0.5f, "desk:social" to 0.7f, "chat" to 0.7f, "r:肢體" to 0.8f, decay = mapOf(Need.ATTENTION to 0.5f, Need.SOCIAL to 0.7f)), "一個人也很好"),
        Trait("健談", TraitCat.SOCIAL, fx("desk:social" to 1.6f, "chat" to 1.7f, "s:聊天" to 1.5f, "r:聊天" to 1.2f, decay = mapOf(Need.SOCIAL to 1.3f), lines = listOf("跟你說喔——")), "很愛聊天"),
        Trait("害羞", TraitCat.SOCIAL, fx("desk:hide" to 1.8f, "desk:nest" to 1.3f, "desk:social" to 0.6f, "chat" to 0.6f, "s:肢體" to 0.4f, "r:肢體" to 0.7f, "s:玩笑" to 0.6f, lines = listOf("……（小聲）")), "不太主動聊天"),
        Trait("愛照顧人", TraitCat.SOCIAL, fx("cook" to 1.4f, "chat" to 1.2f, "s:照顧" to 1.8f, "s:送禮" to 1.3f, lines = listOf("大家有好好吃飯嗎？")), "常煮飯、關心別人"),
        Trait("好勝", TraitCat.SOCIAL, fx("read" to 1.2f, "active" to 1.2f, "s:衝突" to 1.4f, "r:衝突" to 0.8f, lines = listOf("下次一定贏。")), "什麼都想贏"),
        Trait("樂天", TraitCat.FEEL, fx("s:玩笑" to 1.3f, "r:玩笑" to 1.3f, neg = 0.6f, lines = listOf("沒關係，明天會更好。")), "壞心情影響小"),
        Trait("愛哭", TraitCat.FEEL, fx("r:玩笑" to 0.8f, "r:衝突" to 0.8f, neg = 1.4f, lines = listOf("（眼眶濕濕的）")), "難過的事影響大"),
        Trait("情緒化", TraitCat.FEEL, fx(pos = 1.3f, neg = 1.3f), "開心、難過都很明顯"),
        Trait("冷靜", TraitCat.FEEL, fx(pos = 0.8f, neg = 0.8f), "不太被影響"),
        Trait("急性子", TraitCat.FEEL, fx("desk:climb" to 1.3f, speed = 1.25f, dur = 0.8f, lines = listOf("快點快點。")), "走得快、做事快"),
        Trait("慢吞吞", TraitCat.FEEL, fx("desk:climb" to 0.6f, speed = 0.8f, dur = 1.25f), "走得慢、做事慢"),
        Trait("溫和", TraitCat.FEEL, fx("calm" to 1.25f, "s:衝突" to 0.5f, "s:照顧" to 1.3f, "r:和好" to 1.3f, neg = 0.85f), "安靜的事比較吸引牠"),
        Trait("書蟲", TraitCat.LIKE, fx("read" to 2f, lines = listOf("這本書還沒看完。")), "最常看書"),
        Trait("電視迷", TraitCat.LIKE, fx("tv" to 2f, "tvrug" to 1.8f, lines = listOf("這集不能錯過！")), "最常看電視"),
        Trait("園藝家", TraitCat.LIKE, fx("water" to 2.2f, lines = listOf("葉子又長大了。")), "常照顧植物"),
        Trait("愛漂亮", TraitCat.LIKE, fx("primp" to 2.2f, "bathe" to 1.2f, decay = mapOf(Need.HYGIENE to 1.2f)), "常照鏡子"),
        Trait("美食家", TraitCat.LIKE, fx("cook" to 1.8f, "meal" to 1.3f, lines = listOf("今天想吃點特別的。")), "常煮飯"),
        Trait("夢想家", TraitCat.LIKE, fx("dreamy" to 1.8f, lines = listOf("如果有一天……")), "常發呆、看窗外"),
        Trait("好奇", TraitCat.ODD, fx("desk:climb" to 1.5f, "desk:hide" to 0.8f, "window" to 1.4f, "dreamy" to 1.15f, lines = listOf("那是什麼？")), "到處看"),
        Trait("天然呆", TraitCat.ODD, fx("daydream" to 1.6f, dur = 1.1f, lines = listOf("咦？我剛剛要做什麼？")), "常常忘記自己要做什麼"),
        Trait("嘴硬心軟", TraitCat.ODD, fx("r:稱讚" to 0.85f, "s:稱讚" to 0.6f, lines = listOf("才、才不是在等你。")), "說話和心裡相反"),
        Trait("完美主義", TraitCat.ODD, fx("tidy" to 1.4f, dur = 1.2f, neg = 1.15f), "做事慢但仔細"),
        /* 2.2.0 (expansion #14): more traits — each a bundle of effects like the ones above */
        Trait("收集癖", TraitCat.ODD, fx("album" to 1.6f, "outing" to 1.3f, "s:分享" to 1.2f, lines = listOf("這個要收起來。"), topics = listOf("最近收集到的東西")), "喜歡收集奇怪的小東西"),
        Trait("偷偷觀察", TraitCat.ODD, fx("window" to 1.3f, "s:聊天" to 0.8f, "daydream" to 1.2f, lines = listOf("（從後面偷偷看）"), topics = listOf("大家最近在做什麼")), "喜歡偷偷觀察別人"),
        Trait("可愛控", TraitCat.LIKE, fx("s:稱讚" to 1.4f, "r:肢體" to 1.2f, "plantchat" to 1.3f, pos = 1.1f, lines = listOf("好可愛……！")), "很容易被可愛的東西吸引"),
        Trait("雨天派", TraitCat.LIKE, fx("rainwatch" to 2.4f, "window" to 1.2f, lines = listOf("下雨的聲音最好聽了。")), "非常喜歡下雨天"),
        Trait("怕被碰", TraitCat.SOCIAL, fx("r:肢體" to 0.45f, "s:肢體" to 0.4f, decay = mapOf(Need.ATTENTION to 0.8f), lines = listOf("……先說一聲再碰我。")), "不喜歡被突然碰觸"),
        Trait("被誇就害羞", TraitCat.FEEL, fx("r:稱讚" to 0.9f, "desk:hide" to 1.3f, lines = listOf("不、不要一直誇我啦。")), "容易因為被稱讚而害羞"),
        Trait("愛分享", TraitCat.SOCIAL, fx("s:分享" to 1.8f, "s:送禮" to 1.3f, "snack" to 1.2f, lines = listOf("這個分你一半。")), "喜歡分享食物"),
        Trait("小儀式", TraitCat.ODD, fx("tea" to 1.4f, "makebed" to 1.5f, "stretch" to 1.3f, lines = listOf("要先做完這個才行。")), "有自己奇怪的小儀式"),
        Trait("愛離題", TraitCat.SOCIAL, fx("chat" to 1.2f, "s:聊天" to 1.2f, lines = listOf("啊，說到這個——"), topics = listOf("剛剛想到的別的事")), "說話時常常離題"),
        Trait("記得喜好", TraitCat.SOCIAL, fx("s:送禮" to 1.7f, "s:照顧" to 1.3f, lines = listOf("你說過喜歡這個吧？")), "很會記住別人的喜好"),
        Trait("惡作劇王", TraitCat.ODD, fx("s:玩笑" to 1.7f, "r:玩笑" to 1.3f, lines = listOf("嘿嘿，等一下有好戲看。")), "喜歡惡作劇"),
        Trait("獨行俠", TraitCat.SOCIAL, fx("outing" to 1.5f, "chat" to 0.75f, decay = mapOf(Need.SOCIAL to 0.75f), lines = listOf("一個人走也不錯。")), "喜歡一個人到處走"),
        Trait("心軟", TraitCat.FEEL, fx("r:和好" to 1.6f, "s:照顧" to 1.3f, "r:衝突" to 0.8f, lines = listOf("……好啦，原諒你。")), "很容易心軟"),
        Trait("喜新", TraitCat.ODD, fx("outing" to 1.3f, "window" to 1.2f, "puzzle" to 1.2f, topics = listOf("沒試過的事")), "對陌生事物充滿好奇"),
        Trait("念舊", TraitCat.FEEL, fx("album" to 1.8f, "framelook" to 1.8f, "letter" to 1.3f, lines = listOf("以前啊……")), "常常想起以前的事"),
        Trait("愛逞強", TraitCat.FEEL, fx("r:照顧" to 0.8f, "active" to 1.2f, neg = 0.9f, lines = listOf("我一個人沒問題。")), "不想讓人看到自己弱的一面"),
        Trait("杞人憂天", TraitCat.FEEL, fx(neg = 1.25f, lines = listOf("萬一……怎麼辦？"), flags = setOf("dark")), "什麼都會擔心"),
        Trait("隨遇而安", TraitCat.FEEL, fx("relax" to 1.2f, neg = 0.8f, lines = listOf("怎樣都好啦。")), "到哪裡都能過得好"),
        Trait("容易感動", TraitCat.FEEL, fx("tv" to 1.2f, pos = 1.25f, lines = listOf("（眼睛亮亮的）")), "一點小事就很感動"),
        Trait("愛面子", TraitCat.SOCIAL, fx("primp" to 1.4f, "r:玩笑" to 0.75f, "r:衝突" to 0.85f), "很在意別人怎麼看"),
        Trait("老好人", TraitCat.SOCIAL, fx("s:照顧" to 1.5f, "r:邀請" to 1.4f, "s:衝突" to 0.5f, lines = listOf("好啊，我幫你。")), "很難拒絕別人"),
        Trait("毒舌", TraitCat.SOCIAL, fx("s:玩笑" to 1.3f, "s:衝突" to 1.3f, "s:稱讚" to 0.6f, lines = listOf("嗯，還行吧。（其實很好）")), "說話很直又很犀利"),
        Trait("慢熟", TraitCat.SOCIAL, fx("s:聊天" to 0.75f, "s:邀請" to 0.7f, "r:肢體" to 0.8f), "要很久才會跟人熟起來"),
        Trait("自來熟", TraitCat.SOCIAL, fx("s:打招呼" to 1.8f, "s:聊天" to 1.4f, "chat" to 1.3f, lines = listOf("嗨嗨！")), "跟誰都能馬上聊起來"),
        Trait("愛撒嬌", TraitCat.SOCIAL, fx("s:肢體" to 1.4f, "desk:cling" to 1.5f, decay = mapOf(Need.ATTENTION to 1.3f), lines = listOf("陪我嘛～")), "喜歡撒嬌"),
        Trait("吃醋精", TraitCat.FEEL, fx(neg = 1.1f, decay = mapOf(Need.ATTENTION to 1.2f), lines = listOf("你剛剛跟誰在聊天？")), "很容易吃醋"),
        Trait("愛操心", TraitCat.SOCIAL, fx("s:照顧" to 1.6f, "cook" to 1.2f, lines = listOf("你有沒有穿暖一點？")), "總是在擔心別人"),
        Trait("夜間活躍", TraitCat.LIFE, fx("stargaze" to 1.8f, "game" to 1.3f, wake = 1, sleep = 2), "喜歡在深夜活動"),
        Trait("賴床", TraitCat.LIFE, fx("rest" to 1.2f, wake = 1, lines = listOf("五分鐘……再五分鐘……")), "早上起不來"),
        Trait("規律", TraitCat.LIFE, fx("makebed" to 1.4f, "tidy" to 1.15f, lines = listOf("這個時間該做這件事了。")), "每天都照一樣的時間過"),
        Trait("宅", TraitCat.LIFE, fx("outing" to 0.5f, "game" to 1.4f, "phone" to 1.3f, "tv" to 1.3f, lines = listOf("家裡最好了。")), "能不出門就不出門"),
        Trait("運動派", TraitCat.LIFE, fx("stretch" to 1.8f, "workout" to 1.8f, "active" to 1.3f, "lazy" to 0.7f), "一天不動就不舒服"),
        Trait("咖啡因", TraitCat.LIFE, fx("coffee" to 2f, "tea" to 1.4f, lines = listOf("先喝一杯再說。")), "沒喝一杯就不能開始一天"),
        Trait("甜食派", TraitCat.LIFE, fx("snack" to 1.6f, "bake" to 1.4f, lines = listOf("有沒有甜的？")), "最愛甜的東西"),
        Trait("挑食", TraitCat.LIFE, fx("meal" to 0.85f, "food" to 0.9f, lines = listOf("這個……可以不要嗎？")), "很多東西不吃"),
        Trait("愛泡澡", TraitCat.LIFE, fx("bathe" to 1.9f, dur = 1.05f, lines = listOf("泡久一點……")), "洗澡可以洗很久"),
        Trait("手作人", TraitCat.LIKE, fx("craft" to 1.9f, "origami" to 1.7f, "doodle" to 1.3f), "很愛自己動手做"),
        Trait("音樂人", TraitCat.LIKE, fx("music" to 1.9f, "hum" to 1.8f, "dance" to 1.4f, "sing" to 1.4f, lines = listOf("♪～")), "生活裡一定要有音樂"),
        Trait("電玩高手", TraitCat.LIKE, fx("game" to 2.2f, "phone" to 1.2f, lines = listOf("再一關就好。")), "最常打電動"),
        Trait("天文迷", TraitCat.LIKE, fx("stargaze" to 2.4f, "cloudwatch" to 1.4f, topics = listOf("星星")), "喜歡看星星"),
        Trait("拼圖控", TraitCat.LIKE, fx("puzzle" to 2.3f, dur = 1.1f), "很愛拼拼圖"),
        Trait("寫字的人", TraitCat.LIKE, fx("diary" to 2f, "letter" to 1.8f), "常常寫東西"),
        Trait("跳舞", TraitCat.LIKE, fx("dance" to 2.2f, "active" to 1.15f), "音樂一來就想動"),
        Trait("看雲的人", TraitCat.LIKE, fx("cloudwatch" to 2.2f, "dreamy" to 1.3f), "可以看雲看一下午"),
        Trait("健忘", TraitCat.ODD, fx("daydream" to 1.3f, dur = 1.05f, lines = listOf("咦，我剛剛要拿什麼？")), "容易忘記自己原本要做什麼"),
        Trait("迷信", TraitCat.ODD, fx("fortune" to 1.8f, "window" to 1.2f, lines = listOf("今天的運勢好像不錯。")), "很相信好兆頭和壞兆頭"),
        Trait("講究", TraitCat.ODD, fx("tidy" to 1.2f, "tea" to 1.3f, "primp" to 1.2f, dur = 1.1f), "東西一定要照自己的方式"),
        Trait("節儉", TraitCat.ODD, fx("money" to 1.6f, "outing" to 0.85f, lines = listOf("這個還可以用啦。")), "什麼都捨不得丟"),
        Trait("冒失", TraitCat.ODD, fx("tidy" to 0.85f, speed = 1.1f, dur = 0.9f, lines = listOf("哎呀！")), "常常撞到東西"),
        Trait("愛熱鬧", TraitCat.SOCIAL, fx("chat" to 1.4f, "s:邀請" to 1.5f, decay = mapOf(Need.SOCIAL to 1.25f), lines = listOf("大家都來嘛！")), "人越多越開心"),
        Trait("怕寂寞", TraitCat.FEEL, fx("chat" to 1.3f, decay = mapOf(Need.SOCIAL to 1.3f), flags = setOf("alone")), "一個人待著會不安"),
    ).associateBy { it.id }
    val CONFLICTS: List<Pair<String, String>> = listOf("愛乾淨" to "邋遢", "早起" to "夜貓子", "貪吃" to "小鳥胃", "懶散" to "勤快", "黏人" to "獨立", "有點黏人" to "獨立",
        "健談" to "害羞", "樂天" to "愛哭", "情緒化" to "冷靜", "急性子" to "慢吞吞", "愛乾淨" to "邋遢",
        /* 2.2.0 */ "慢熟" to "自來熟", "宅" to "獨行俠", "宅" to "運動派", "怕被碰" to "愛撒嬌", "杞人憂天" to "隨遇而安", "愛逞強" to "愛撒嬌", "早起" to "賴床", "早起" to "夜間活躍",
        "規律" to "冒失", "節儉" to "愛分享", "獨立" to "怕寂寞", "獨行俠" to "愛熱鬧", "甜食派" to "挑食")
    const val MAX_TRAITS = 12
    /** 1.5.1: jobs by era (現代、古風、奇幻; the player's own tags are 自訂) */
    val JOB_ERA: Map<String, String> = (listOf("郵差", "圖書館員", "店員", "偶像", "駭客", "學生", "甜點師", "無業遊民", "社畜", "醫生", "畫家", "作家", "廚師", "偵探", "園丁", "音樂家", "運動員", "研究員", "老師").map { it to "現代" } +
        listOf("宗門長老", "劍修", "傭兵").map { it to "古風" } + listOf("占卜師", "魔王", "鍊金術師", "騎士", "魔法師", "王族").map { it to "奇幻" }).toMap()
    val ERAS = listOf("現代", "古風", "奇幻", "自訂")
    /** R4: the four colours traits are sorted by (社交綠、脾氣紅、起居橘、做事藍) */
    fun groupOf(cat: TraitCat): String = when (cat) { TraitCat.SOCIAL -> "社交"; TraitCat.FEEL -> "脾氣"; TraitCat.LIFE -> "起居"; else -> "做事" }
    val GROUPS = listOf("社交", "脾氣", "起居", "做事")
    /** the other side of an exclusive pair, if any */
    fun opposites(id: String): List<String> = CONFLICTS.mapNotNull { (a, b) -> if (a == id) b else if (b == id) a else null }.distinct()
    /** R4: likes and dislikes to pick from (any word of your own works too), in four groups */
    val LIKE_GROUPS: Map<String, List<String>> = linkedMapOf(
        "日常" to listOf("晴天", "下雨天", "早晨", "深夜", "散步", "泡澡", "午睡", "整理", "毛毯", "花"),
        "興趣" to listOf("看書", "畫畫", "音樂", "唱歌", "遊戲", "園藝", "拍照", "運動", "漫畫", "星星"),
        "相處" to listOf("被摸頭", "聊天", "安靜", "熱鬧", "被稱讚", "一起吃飯", "惡作劇", "一個人待著", "擁抱", "被叫綽號"),
        "食物" to listOf("甜點", "布丁", "蛋糕", "麵包", "咖哩", "紅茶", "咖啡", "熱湯", "水果", "辣的東西"),
    )
    const val MAX_LIKES = 10
    fun conflict(a: String, b: String) = CONFLICTS.any { (x, y) -> (x == a && y == b) || (x == b && y == a) }

    // ---------------- quirks (≤ 3; each its own little behaviour) ----------------
    private fun q(id: String, pose: Pose, sec: Float, line: String?, note: String, prop: String? = null, vararg act: Pair<String, Float>) =
        Quirk(id, Effect(act = act.toMap(), micro = QuirkMicro(pose, sec, line, prop)), note)
    val QUIRKS: Map<String, Quirk> = listOf(
        q("對植物說話", Pose.WATER, 4f, "今天也要好好長大喔。", "常常對盆栽講話", null, "water" to 1.5f),
        q("吃飯前拍照", Pose.PRIMP, 2.5f, "（喀嚓）先拍一張。", "吃東西前一定先拍照", "phone"),
        q("收集瓶蓋", Pose.LOOK, 3f, "這個顏色的瓶蓋還沒有！", "到處找瓶蓋", "coin"),
        q("走路哼歌", Pose.HAPPY, 3f, "♪啦啦～", "走著走著就唱起來", "note"),
        q("數地板", Pose.LOOK, 3.5f, "一、二、三……這裡有十二塊。", "會數地板的格子"),
        q("自言自語", Pose.DAYDREAM, 3.5f, "嗯，我覺得可以。對，可以。", "常常跟自己對話"),
        q("睡前檢查門窗", Pose.LOOK, 3f, "門鎖了，窗也關了。", "睡前一定檢查一遍"),
        q("抱枕不離身", Pose.SIT, 4f, "（抱緊抱枕）", "總是抱著抱枕", "pillow", "relax" to 1.3f),
        q("對鏡子誇自己", Pose.PRIMP, 3f, "今天的我也很不錯。", "照鏡子會稱讚自己", null, "primp" to 1.6f),
        q("偷偷練習打招呼", Pose.HAPPY, 3f, "嗨！……不對，是「你好」。", "一個人練習打招呼"),
        q("喝東西前吹三下", Pose.EAT, 2.5f, "呼、呼、呼。", "什麼都要吹涼", "cup"),
        q("對窗外許願", Pose.LOOK, 3.5f, "希望明天也是好天氣。", "看窗外時會許願", null, "window" to 1.4f),
        q("把東西排整齊", Pose.TIDY, 3.5f, "要對齊才行。", "東西一定要排好", null, "tidy" to 1.3f),
        q("打噴嚏很大聲", Pose.STAND, 1.5f, "哈——啾！！", "噴嚏大聲到嚇人"),
        q("睡相很差", Pose.LIE, 3f, "（翻來翻去）", "睡著了也在翻身", null, "sleep" to 1f),
        q("走路繞過水窪", Pose.WALK, 2.5f, "（小心地繞了一大圈）", "看到地上有水就繞路"),
        q("東西放錯地方又找", Pose.LOOK, 4f, "我的鑰匙呢？剛剛明明放在這裡……", "常常找東西"),
        q("看電視會跟著哭", Pose.WATCH, 3f, "（吸鼻子）這集太感人了……", "看什麼都會哭", null, "tv" to 1.3f),
        q("睡前寫日記", Pose.READ, 4f, "今天發生了……嗯，寫下來。", "每天睡前寫日記"),
        q("偷偷吃冰箱的布丁", Pose.EAT, 2.5f, "（左右看看，偷吃一口）", "常常偷吃冰箱裡的東西", null, "snack" to 1.4f),
    ).associateBy { it.id }
    const val MAX_QUIRKS = 3

    // ---------------- values (≤ 2) ----------------
    val VALUES: Map<String, Value> = listOf(
        Value("家人", fx("chat" to 1.4f, "cook" to 1.2f), "常陪別人、為大家煮飯"), Value("自由", fx("window" to 1.4f, "dreamy" to 1.3f), "常看窗外、發呆"),
        Value("成就", fx("read" to 1.3f, "cook" to 1.2f, "tidy" to 1.2f), "做有成果的事"), Value("和平", fx("relax" to 1.3f, "sitrug" to 1.3f, "calm" to 1.2f), "喜歡安靜放鬆"),
        Value("樂趣", fx("tv" to 1.4f, "tvrug" to 1.4f), "先做好玩的事"), Value("美", fx("primp" to 1.5f, "bathe" to 1.3f, "water" to 1.2f), "在意外表與漂亮的東西"),
        Value("知識", fx("read" to 1.6f), "常看書"), Value("安穩", fx("rest" to 1.2f, dur = 1.1f), "不急，睡飽最重要"),
    ).associateBy { it.id }
    const val MAX_VALUES = 2

    // ---------------- tags (plan 13.2: six groups, built in; free words are custom tags) ----------------
    private fun t(id: String, cat: TagCat, note: String, f: Effect) = Tag(id, cat, f, note)
    val TAGS: Map<String, Tag> = (listOf(
        // 世界觀
        t("現代", TagCat.WORLD, "手機、便利商店的日常", fx("tv" to 1.2f, topics = listOf("最近的新聞", "便利商店的新品"))),
        t("西幻", TagCat.WORLD, "劍與魔法的世界來的", fx("read" to 1.2f, topics = listOf("龍的傳說", "冒險者公會"), lines = listOf("這裡沒有魔物，真安靜。"))),
        t("東方玄幻", TagCat.WORLD, "修仙、門派、靈氣", fx("calm" to 1.3f, topics = listOf("修煉的境界", "門派的規矩"), lines = listOf("此地靈氣稀薄……但很舒服。"))),
        t("賽博科幻", TagCat.WORLD, "霓虹、義體、資料網路", fx("tv" to 1.3f, topics = listOf("義體保養", "網路上的都市傳說"), lines = listOf("訊號……很弱。"))),
        t("怪談", TagCat.WORLD, "從都市傳說裡走出來", fx("dreamy" to 1.2f, wake = 1, sleep = 1, topics = listOf("走廊盡頭的那扇門", "半夜的電話"))),
        t("童話", TagCat.WORLD, "繪本一樣的世界", fx("water" to 1.3f, pos = 1.1f, topics = listOf("森林裡的茶會", "會說話的南瓜"))),
        t("未知", TagCat.WORLD, "從哪裡來？沒人知道", fx("dreamy" to 1.2f, topics = listOf("自己是從哪裡來的"))),
        t("蒸汽龐克", TagCat.WORLD, "齒輪、蒸汽、黃銅", fx("tidy" to 1.2f, topics = listOf("新做的齒輪", "飛空艇"))),
        t("末日", TagCat.WORLD, "從廢墟裡活下來的", fx("food" to 1.3f, neg = 0.85f, topics = listOf("儲糧的方法"), lines = listOf("有屋頂、有床，已經很奢侈了。"))),
        t("校園", TagCat.WORLD, "上課、社團、考試", fx("read" to 1.3f, topics = listOf("期末考", "社團活動"))),
        t("武俠", TagCat.WORLD, "江湖、俠客、恩怨", fx("calm" to 1.2f, topics = listOf("江湖上的傳聞"))),
        t("太空歌劇", TagCat.WORLD, "星艦與銀河帝國", fx("window" to 1.3f, topics = listOf("星星的名字"), lines = listOf("這顆星球的重力剛剛好。"))),
        t("神話", TagCat.WORLD, "眾神與英雄的時代", fx("read" to 1.2f, topics = listOf("古老的神話"))),
        // 種族／形態
        t("狐妖", TagCat.RACE, "會變身的狐狸", fx("primp" to 1.3f, "snack" to 1.2f, lines = listOf("（尾巴偷偷冒出來）"))),
        t("樹人", TagCat.RACE, "慢慢長大的樹", fx("water" to 1.6f, "window" to 1.5f, speed = 0.8f, render = setOf("sway"))),
        t("雪人", TagCat.RACE, "怕熱的冰雪生物", fx("bathe" to 0.6f, lines = listOf("暖氣……請不要開。"))),
        t("人類", TagCat.RACE, "普通的人", fx(topics = listOf("普通的一天"), lines = listOf("平凡的一天也不錯。"))),
        t("精靈", TagCat.RACE, "長壽、親近自然", fx("water" to 1.6f, "window" to 1.2f, render = setOf("sparkle"), topics = listOf("森林"))),
        t("獸人", TagCat.RACE, "有毛、耳朵與尾巴", fx("window" to 1.5f, "rest" to 1.2f, lines = listOf("（尾巴搖來搖去）"), topics = listOf("哪裡曬太陽最舒服"))),
        t("吸血鬼", TagCat.RACE, "夜裡醒著，怕陽光", fx("window" to 0.3f, wake = 6, sleep = 6, flags = setOf("sunlight"), lines = listOf("窗簾……拉上比較好。"), topics = listOf("月色"))),
        t("史萊姆", TagCat.RACE, "軟軟的、會彈", fx("rest" to 1.2f, render = setOf("wobble"), lines = listOf("（啵嚕）"))),
        t("仿生人", TagCat.RACE, "人造的身體", fx(decay = mapOf(Need.FOOD to 0.5f), lines = listOf("系統正常。今天也很好。"), topics = listOf("人類的習慣"))),
        t("妖", TagCat.RACE, "古老的妖怪", fx("dreamy" to 1.3f, sleep = 1, topics = listOf("以前的人怎麼過日子"))),
        t("神明", TagCat.RACE, "被供奉的存在", fx("calm" to 1.4f, render = setOf("glow"), lines = listOf("嗯，信徒們今天也很努力。"))),
        t("幽靈", TagCat.RACE, "半透明、輕飄飄", fx(decay = mapOf(Need.FOOD to 0.3f, Need.HYGIENE to 0.3f), render = setOf("ghost", "float"), lines = listOf("（飄過去）"))),
        t("未知生物", TagCat.RACE, "連自己都不知道是什麼", fx("dreamy" to 1.2f, lines = listOf("（發出奇怪的聲音）"))),
        t("龍", TagCat.RACE, "會噴火的大傢伙", fx("food" to 1.4f, decay = mapOf(Need.FOOD to 1.3f), lines = listOf("……可以在家裡噴火嗎？不行嗎。"))),
        t("人魚", TagCat.RACE, "離不開水", fx("bathe" to 2f, decay = mapOf(Need.HYGIENE to 1.6f), lines = listOf("好想泡水。"))),
        t("天使", TagCat.RACE, "有翅膀與光環", fx("calm" to 1.2f, render = setOf("glow", "float"), pos = 1.1f)),
        t("惡魔", TagCat.RACE, "有角與尾巴", fx("tv" to 1.2f, wake = 1, sleep = 1, lines = listOf("嘿嘿，想做點壞事。……算了，洗碗好了。"))),
        t("植物系", TagCat.RACE, "需要陽光和水", fx("window" to 1.7f, "water" to 1.5f, lines = listOf("（伸展葉子）"))),
        t("貓系", TagCat.RACE, "像貓一樣", fx("rest" to 1.4f, "window" to 1.3f, lines = listOf("喵。"), topics = listOf("紙箱"))),
        t("犬系", TagCat.RACE, "像狗一樣", fx("chat" to 1.4f, decay = mapOf(Need.ATTENTION to 1.3f), lines = listOf("（尾巴猛搖）"))),
        t("兔系", TagCat.RACE, "像兔子一樣", fx("food" to 1.2f, speed = 1.1f, lines = listOf("（耳朵豎起來）"))),
        t("鳥系", TagCat.RACE, "像鳥一樣", fx("window" to 1.5f, wake = -1, lines = listOf("啾。"))),
        t("機器人", TagCat.RACE, "金屬做的", fx(decay = mapOf(Need.FOOD to 0.2f, Need.HYGIENE to 0.5f), lines = listOf("嗶——電量足夠。"))),
        // 職業／身分
        t("占卜師", TagCat.JOB, "看得見一點點未來", fx("dreamy" to 1.3f, lines = listOf("今天的運勢……大吉，大概。"))),
        t("郵差", TagCat.JOB, "每天到處跑", fx(wake = -1, speed = 1.15f)),
        t("圖書館員", TagCat.JOB, "安靜的書之守護者", fx("read" to 1.6f, "tidy" to 1.2f, lines = listOf("噓——"))),
        t("店員", TagCat.JOB, "習慣招呼客人", fx("tidy" to 1.3f, lines = listOf("歡迎光——啊，這裡是家。"))),
        t("魔王", TagCat.JOB, "曾經統治魔界", fx("relax" to 1.3f, lines = listOf("哼，這座城堡太小了。"), topics = listOf("魔王城的裝潢"))),
        t("宗門長老", TagCat.JOB, "門派裡的老前輩", fx("calm" to 1.5f, wake = -1, topics = listOf("年輕弟子的修煉"))),
        t("偶像", TagCat.JOB, "唱歌跳舞給大家看", fx("primp" to 1.6f, topics = listOf("下次的演出"), lines = listOf("微笑，微笑。"))),
        t("駭客", TagCat.JOB, "電腦高手", fx(wake = 2, sleep = 3, topics = listOf("防火牆"))),
        t("鍊金術師", TagCat.JOB, "調配藥水", fx("cook" to 1.4f, topics = listOf("新的配方"))),
        t("學生", TagCat.JOB, "還在念書", fx("read" to 1.4f, topics = listOf("作業"))),
        t("甜點師", TagCat.JOB, "做甜點的人", fx("cook" to 1.8f, topics = listOf("今天的甜點"), lines = listOf("奶油要打到這個程度……"))),
        t("無業遊民", TagCat.JOB, "自由自在", fx("lazy" to 1.5f, wake = 2, lines = listOf("今天也沒有要做的事，真好。"))),
        t("劍修", TagCat.JOB, "以劍修道", fx("calm" to 1.2f, wake = -1, topics = listOf("劍的保養"))),
        t("社畜", TagCat.JOB, "被工作追著跑", fx(decay = mapOf(Need.ENERGY to 1.3f), sleep = 1, lines = listOf("……明天要交的東西還沒做。"), topics = listOf("加班"))),
        t("醫生", TagCat.JOB, "照顧病人", fx("bathe" to 1.2f, "read" to 1.2f, lines = listOf("記得多喝水。"))),
        t("畫家", TagCat.JOB, "用畫筆說話", fx("window" to 1.3f, topics = listOf("光線的顏色"))),
        t("作家", TagCat.JOB, "寫故事的人", fx("read" to 1.5f, sleep = 1, topics = listOf("寫到一半的故事"))),
        t("廚師", TagCat.JOB, "料理專家", fx("cook" to 2f, topics = listOf("火候"))),
        t("騎士", TagCat.JOB, "守護別人", fx("active" to 1.3f, wake = -1, lines = listOf("我會保護這個家。"))),
        t("魔法師", TagCat.JOB, "會用魔法", fx("read" to 1.4f, topics = listOf("咒語"))),
        t("偵探", TagCat.JOB, "觀察入微", fx("window" to 1.2f, lines = listOf("嗯……這裡有線索。"))),
        t("園丁", TagCat.JOB, "照顧花草", fx("water" to 2f)),
        t("音樂家", TagCat.JOB, "演奏音樂", fx("relax" to 1.2f, topics = listOf("最近在練的曲子"))),
        t("運動員", TagCat.JOB, "每天鍛鍊", fx("active" to 1.4f, decay = mapOf(Need.FOOD to 1.2f), wake = -1)),
        t("王族", TagCat.JOB, "出身高貴", fx("bathe" to 1.3f, "tidy" to 0.6f, lines = listOf("茶呢？……要自己泡？"))),
        t("傭兵", TagCat.JOB, "拿錢辦事", fx(neg = 0.85f, lines = listOf("這個房子很好守。"))),
        t("研究員", TagCat.JOB, "做研究的人", fx("read" to 1.5f, sleep = 1)),
        t("老師", TagCat.JOB, "教別人", fx("read" to 1.3f, "chat" to 1.2f, lines = listOf("今天也學到了一件事呢。"))),
        // 體質
        t("怕光", TagCat.BODY, "陽光讓牠不舒服", fx("window" to 0.3f, flags = setOf("sunlight"))),
        t("怕水", TagCat.BODY, "討厭碰到水", fx("bathe" to 0.3f, hate = setOf("bathe"), lines = listOf("水……還是算了。"))),
        t("怕冷", TagCat.BODY, "很容易冷", fx("rest" to 1.2f, "relax" to 1.2f, lines = listOf("好冷，想窩在毯子裡。"))),
        t("怕熱", TagCat.BODY, "很容易熱", fx("bathe" to 1.3f, lines = listOf("好熱……"))),
        t("不用睡覺", TagCat.BODY, "精力不會掉", fx("sleep" to 0.05f, "nap" to 0.05f, "sofanap" to 0.05f, decay = mapOf(Need.ENERGY to 0f))),
        t("吃很多", TagCat.BODY, "胃口超大", fx("food" to 1.4f, decay = mapOf(Need.FOOD to 1.5f))),
        t("夜行性", TagCat.BODY, "晚上才有精神", fx(wake = 4, sleep = 4)),
        t("早起體質", TagCat.BODY, "天一亮就醒", fx(wake = -2)),
        t("容易睏", TagCat.BODY, "常常想睡", fx("nap" to 1.6f, "sofanap" to 1.6f, decay = mapOf(Need.ENERGY to 1.3f))),
        t("體力好", TagCat.BODY, "不容易累", fx("active" to 1.2f, decay = mapOf(Need.ENERGY to 0.7f))),
        t("體弱", TagCat.BODY, "容易累", fx("rest" to 1.3f, decay = mapOf(Need.ENERGY to 1.4f))),
        t("不怕痛", TagCat.BODY, "被丟也不在意", fx(neg = 0.9f)),
        t("會飛", TagCat.BODY, "腳不太碰地", fx(render = setOf("float"), speed = 1.15f)),
        t("會發光", TagCat.BODY, "身上會發光", fx(render = setOf("glow"))),
        t("冷血", TagCat.BODY, "體溫很低", fx("window" to 1.4f, lines = listOf("曬一下太陽才動得了。"))),
        t("體溫高", TagCat.BODY, "像暖爐一樣", fx("bathe" to 1.2f, lines = listOf("我很暖，可以靠過來。"))),
        t("力氣大", TagCat.BODY, "什麼都搬得動", fx("tidy" to 1.3f, lines = listOf("家具要搬嗎？我來。"))),
        // 弱點與過敏
        t("怕冷場", TagCat.WEAK, "安靜下來就緊張", fx("chat" to 1.2f, lines = listOf("……那個，今天天氣不錯呢。"))),
        t("怕蛇", TagCat.WEAK, "看到長條的東西就跳起來", fx(lines = listOf("那、那是繩子吧？"))),
        t("怕電話", TagCat.WEAK, "電話響就緊張", fx(neg = 1.05f, topics = listOf("不想接的電話"))),
        t("怕蟲", TagCat.WEAK, "看到蟲會尖叫", fx("water" to 0.6f, lines = listOf("那、那是蟲嗎！？"))),
        t("花粉過敏", TagCat.WEAK, "靠近花草會打噴嚏", fx("water" to 0.4f, hate = setOf("water"), lines = listOf("哈啾！花粉……"))),
        t("怕打雷", TagCat.WEAK, "雷聲會發抖", fx(neg = 1.1f, topics = listOf("打雷的夜晚"))),
        t("怕黑", TagCat.WEAK, "暗的地方不行", fx(flags = setOf("dark"), lines = listOf("燈、燈要開著喔。"))),
        t("怕高", TagCat.WEAK, "被抱高會害怕", fx(flags = setOf("height"))),
        t("怕狗", TagCat.WEAK, "看到狗就躲", fx(topics = listOf("那隻很大的狗"))),
        t("怕孤單", TagCat.WEAK, "一個人會寂寞", fx(decay = mapOf(Need.SOCIAL to 1.5f), flags = setOf("alone"))),
        t("暈車", TagCat.WEAK, "被甩會暈", fx(neg = 1.2f, flags = setOf("dizzy"))),
        t("怕鬼", TagCat.WEAK, "鬼故事不行", fx("tv" to 0.8f, flags = setOf("dark"))),
        t("貓毛過敏", TagCat.WEAK, "碰到貓毛會打噴嚏", fx(lines = listOf("鼻子好癢……"))),
        t("怕吵", TagCat.WEAK, "人多就煩躁", fx("calm" to 1.3f, flags = setOf("crowd"))),
        t("怕針", TagCat.WEAK, "看到針就臉色發白", fx(topics = listOf("打針"))),
        // 執念與癖好
        t("重度甜食控", TagCat.OBSESS, "沒有甜的活不下去", fx("snack" to 1.8f, topics = listOf("最好吃的甜點店"), lines = listOf("好想吃甜的……"))),
        t("財迷", TagCat.OBSESS, "很在意錢", fx(lines = listOf("這個月還能省多少……"), topics = listOf("省錢的方法"))),
        t("社恐", TagCat.OBSESS, "和人說話很緊張", fx("desk:hide" to 2f, "desk:social" to 0.5f, "chat" to 0.4f, "r:肢體" to 0.6f, "r:聊天" to 0.8f, "s:肢體" to 0.3f, decay = mapOf(Need.SOCIAL to 0.6f), flags = setOf("crowd"))),
        t("收集狂", TagCat.OBSESS, "什麼都想收集", fx("tidy" to 1.2f, topics = listOf("最新的收藏"))),
        t("潔癖", TagCat.OBSESS, "受不了一點髒", fx("tidy" to 2f, "bathe" to 1.6f, decay = mapOf(Need.HYGIENE to 1.5f), neg = 1.1f)),
        t("路痴", TagCat.OBSESS, "常常走錯", fx(speed = 0.85f, lines = listOf("咦，這裡是浴室？我要去廚房的。"))),
        t("咖啡成癮", TagCat.OBSESS, "不喝咖啡就沒精神", fx(decay = mapOf(Need.ENERGY to 1.15f))),
        t("遊戲廢人", TagCat.OBSESS, "一玩就停不下來", fx("tv" to 1.6f, sleep = 2)),
        t("書痴", TagCat.OBSESS, "書比人重要", fx("read" to 1.8f, "chat" to 0.8f)),
        t("愛抱枕", TagCat.OBSESS, "抱著東西才安心", fx("relax" to 1.4f)),
        t("拖延症", TagCat.OBSESS, "等一下再做", fx("tidy" to 0.5f, "lazy" to 1.3f, lines = listOf("五分鐘後再開始。"))),
        t("自戀", TagCat.OBSESS, "最喜歡自己", fx("primp" to 2f, lines = listOf("這麼可愛真是罪過。"))),
        t("中二病", TagCat.OBSESS, "封印著右手的力量", fx(lines = listOf("我的右手……在發燙。"), topics = listOf("被封印的力量"))),
        t("吃貨", TagCat.OBSESS, "最喜歡吃", fx("food" to 1.6f, topics = listOf("下一餐吃什麼"))),
        t("睡神", TagCat.OBSESS, "能睡就睡", fx("rest" to 1.7f, wake = 1, decay = mapOf(Need.ENERGY to 1.2f))),
        t("碎碎念", TagCat.OBSESS, "一直講個不停", fx("s:聊天" to 1.6f, lines = listOf("然後啊，還有啊，對了還有——"))),
        t("愛拍照", TagCat.OBSESS, "什麼都要拍", fx("primp" to 1.3f)),
        t("植物控", TagCat.OBSESS, "家裡要有植物", fx("water" to 1.8f)),
        t("貓奴", TagCat.OBSESS, "看到貓就融化", fx(topics = listOf("貓咪的照片"))),
        t("夜宵派", TagCat.OBSESS, "半夜一定要吃點什麼", fx("snack" to 1.4f, sleep = 1)),
        t("整理狂", TagCat.OBSESS, "看到亂就要收", fx("tidy" to 2f)),
        t("健身狂", TagCat.OBSESS, "每天都要練", fx("active" to 1.6f)),
        t("追星族", TagCat.OBSESS, "有很喜歡的偶像", fx("tv" to 1.3f, topics = listOf("推的偶像"))),
        t("戲精", TagCat.OBSESS, "生活就是舞台", fx("s:玩笑" to 1.5f, "s:抱怨" to 1.4f, pos = 1.2f, neg = 1.2f, lines = listOf("（誇張地嘆氣）"))),
    )).associateBy { it.id }

    /** effects of everything a character has (tags + traits + quirks + values) */
    fun effects(s: CharSpec, custom: List<CustomTag> = emptyList()): List<Effect> = s.tags.mapNotNull { t -> TAGS[t]?.fx ?: custom.firstOrNull { it.id == t }?.effect() } +
        s.traits.mapNotNull { TRAITS[it]?.fx } + s.quirks.mapNotNull { QUIRKS[it]?.fx } + s.values.mapNotNull { VALUES[it]?.fx } + Dims.effects(s)

    /** a first guess of the five axes from words (presets and M1 characters) */
    fun axesFromWords(words: List<String>): List<Float> {
        val a = FloatArray(5)
        for (w in words) when {
            w.contains("黏人") || w.contains("外向") || w.contains("健談") -> a[0] += 0.4f
            w.contains("害羞") || w.contains("內向") || w.contains("社恐") -> a[0] -= 0.4f
            w.contains("好奇") || w.contains("活潑") || w.contains("元氣") || w.contains("勤快") -> a[1] += 0.4f
            w.contains("慵懶") || w.contains("沉穩") || w.contains("懶散") -> a[1] -= 0.4f
            w.contains("認真") || w.contains("整齊") || w.contains("完美") -> a[2] += 0.4f
            w.contains("坦率") -> a[3] += 0.4f
            w.contains("嘴硬") -> a[3] -= 0.4f
            w.contains("溫和") || w.contains("溫柔") -> a[4] += 0.4f
            w.contains("好勝") -> a[4] -= 0.4f
        }
        return a.map { it.coerceIn(-1f, 1f) }
    }
}
