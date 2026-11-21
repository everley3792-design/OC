package app.ocshimeji.sim.social

import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.Pose

/**
 * The reaction spectrum (plan 4.4): every social act is answered somewhere from 熱情 to 哭了, and each answer has consequences.
 * `k` scales how much the relationship moves (negative = it goes the wrong way); `fx` is the exaggerated effect over the head (13.1).
 */
enum class Reaction(val zh: String, val k: Float, val pose: Pose, val fx: String?) {
    WARM("熱情", 1.6f, Pose.HAPPY, "heart"), HAPPY("開心", 1f, Pose.HAPPY, null), OK("普通", 0.45f, Pose.TALK, null),
    MEH("敷衍", 0f, Pose.STAND, "sweat"), NO("婉拒", -0.3f, Pose.STAND, "sweat"), ANGRY("生氣", -1.2f, Pose.ANGRY, "anger"), CRY("哭了", -1f, Pose.SAD, "gloom");
    val good get() = k > 0.4f
    val bad get() = k < 0f
}

/**
 * One social act (plan C-01). `risk` = how easily it is refused; `like/trust/conflict` = how the relationship moves on a good answer;
 * `stage` = the lowest relationship step it needs (0 陌生 … 4 知己); `intimate` = physical (shy people and strangers mind it);
 * `hostile` = an act against the other (a good answer means they laugh it off); `favor` = the other will remember it as a kindness;
 * `cond` = when it makes sense (see `Society.condOk`); `romance` = only two adults with romance turned on (`Relations.problem`).
 */
data class SocialAct(
    val id: String, val zh: String, val cat: String, val risk: Float,
    val social: Float = 18f, val joy: Float = 6f,
    val like: Int = 2, val trust: Int = 0, val conflict: Int = 0,
    val stage: Int = 0, val intimate: Boolean = false, val hostile: Boolean = false, val favor: Boolean = false,
    val cond: String = "", val romance: Boolean = false, val closeup: Boolean = false,
    /** what the one who starts it says (plain 我／你, {對方}, {物}) */
    val open: List<String>,
    /** answers that fit this act better than the general ones, by reaction */
    val reply: Map<Reaction, List<String>> = emptyMap(),
    val pose: Pose = Pose.TALK, val fx: String? = null,
)

object SocialActs {
    private fun s(id: String, zh: String, cat: String, risk: Float, vararg open: String, social: Float = 18f, fun_: Float = 6f, like: Int = 2, trust: Int = 0, conflict: Int = 0,
                  stage: Int = 0, intimate: Boolean = false, hostile: Boolean = false, favor: Boolean = false, cond: String = "", romance: Boolean = false, closeup: Boolean = false,
                  reply: Map<Reaction, List<String>> = emptyMap(), pose: Pose = Pose.TALK, fx: String? = null) =
        SocialAct(id, zh, cat, risk, social, fun_, like, trust, conflict, stage, intimate, hostile, favor, cond, romance, closeup, open.toList(), reply, pose, fx)
    private val W = Reaction.WARM; private val H = Reaction.HAPPY; private val N = Reaction.NO; private val A = Reaction.ANGRY; private val C = Reaction.CRY

    val ALL: Map<String, SocialAct> = listOf(
        // ---- 打招呼
        s("greet", "打招呼", "打招呼", 0.05f, "嗨，{對方}。", "{對方}，你在這裡啊。", social = 10f, fun_ = 2f, like = 1),
        s("wave", "揮手", "打招呼", 0.05f, "（向{對方}揮揮手）", social = 6f, fun_ = 2f, like = 1, pose = Pose.HAPPY),
        s("morning", "道早安", "打招呼", 0.05f, "早安，{對方}！", "{對方}，早。睡得好嗎？", social = 10f, like = 1, cond = "morning", reply = mapOf(H to listOf("早安！", "睡得很好，你呢？"))),
        // ---- 聊天
        s("chat", "聊天", "聊天", 0.15f, "（聊天）", social = 30f, fun_ = 10f, like = 2, trust = 1),
        s("gossip", "聊八卦", "聊天", 0.25f, "跟你說，{第三人}最近啊……", "你知道{第三人}剛剛在做什麼嗎？", social = 26f, fun_ = 14f, like = 2, stage = 1, cond = "third",
            reply = mapOf(W to listOf("真的假的！然後呢？"), N to listOf("在背後說別人不太好吧。"))),
        s("ask", "請教問題", "聊天", 0.1f, "{對方}，可以問你一件事嗎？", "這個我一直搞不懂，你知道嗎？", social = 16f, like = 2, trust = 2, reply = mapOf(H to listOf("我想想……應該是這樣。", "這個我知道！"))),
        s("story", "說自己的事", "聊天", 0.2f, "其實我以前啊……", "我跟你說一件我的事。", social = 24f, like = 2, trust = 3, stage = 1),
        s("deep", "談心", "聊天", 0.3f, "{對方}，我最近有點煩……可以聽我說嗎？", "有些話，只想跟你說。", social = 34f, like = 3, trust = 5, stage = 3, closeup = true,
            reply = mapOf(W to listOf("當然，我一直都在。", "慢慢說，我聽著。"), N to listOf("……我現在沒辦法好好聽，對不起。"))),
        // ---- 分享
        s("share_snack", "分零食", "分享", 0.1f, "這個給你一半。", "要不要吃一點？", social = 14f, fun_ = 6f, like = 3, favor = true, reply = mapOf(W to listOf("哇，謝謝！好好吃。"), N to listOf("我現在不餓，謝謝。")), pose = Pose.HAPPY),
        s("show", "給對方看收藏", "分享", 0.2f, "你看你看，這是我的寶貝。", "給你看一個好東西。", social = 16f, fun_ = 10f, like = 2, stage = 1, reply = mapOf(W to listOf("好厲害！哪裡找到的？"), Reaction.MEH to listOf("喔……嗯，不錯。"))),
        s("recommend", "推薦喜歡的東西", "分享", 0.2f, "{物}真的很棒，你一定要試試看。", social = 14f, fun_ = 8f, like = 2, reply = mapOf(H to listOf("好啊，下次試試。"), Reaction.MEH to listOf("……我再看看。"))),
        // ---- 玩笑
        s("joke", "開玩笑", "玩笑", 0.25f, "{對方}，你知道為什麼{物}不會說話嗎？……因為它害羞。", "我講個笑話給你聽。", social = 16f, fun_ = 18f, like = 2, cond = "notSad",
            reply = mapOf(W to listOf("哈哈哈哈哈！", "噗——好冷，可是好好笑。"), Reaction.MEH to listOf("……喔。"), N to listOf("現在不是開玩笑的時候。"))),
        s("tease", "捉弄", "玩笑", 0.4f, "{對方}，你臉上有東西喔。……騙你的。", "嘿嘿，你剛剛的表情好好笑。", social = 12f, fun_ = 14f, like = 1, conflict = 2, stage = 1, hostile = true, cond = "notSad",
            reply = mapOf(W to listOf("你很煩耶！哈哈。"), A to listOf("一點都不好笑！"), C to listOf("為什麼要這樣……"))),
        s("prank", "惡作劇", "玩笑", 0.5f, "（偷偷把{對方}的拖鞋藏起來）", "（從背後「哇！」地嚇{對方}）", social = 10f, fun_ = 20f, like = 1, conflict = 3, stage = 1, hostile = true, cond = "notSad", closeup = true,
            reply = mapOf(W to listOf("哇啊！……你給我記住！哈哈。"), A to listOf("你、你這傢伙！"), C to listOf("嗚……嚇死我了。")), fx = "shock"),
        s("face", "扮鬼臉", "玩笑", 0.15f, "（對{對方}扮了一個鬼臉）", social = 8f, fun_ = 12f, like = 1, pose = Pose.HAPPY, reply = mapOf(W to listOf("噗哈！"), Reaction.MEH to listOf("……你在做什麼？"))),
        // ---- 稱讚
        s("compliment", "稱讚", "稱讚", 0.1f, "{對方}今天看起來很不錯喔。", "你真的很厲害耶。", social = 14f, fun_ = 4f, like = 3, favor = true,
            reply = mapOf(W to listOf("真、真的嗎？謝謝！"), H to listOf("嘿嘿，謝謝。"), Reaction.MEH to listOf("嗯，是喔。"))),
        s("praise_cook", "誇對方煮的飯", "稱讚", 0.05f, "剛剛的{物}好好吃！", "你煮的{物}是我吃過最好吃的。", social = 14f, like = 4, trust = 1, favor = true, cond = "ateTheirCooking",
            reply = mapOf(W to listOf("真的嗎！下次再煮給你吃。"))),
        s("thank", "道謝", "稱讚", 0.05f, "上次謝謝你。", "之前的事，真的謝謝你。", social = 12f, like = 3, trust = 2, cond = "owes", reply = mapOf(H to listOf("那沒什麼啦。"), W to listOf("不客氣！我們誰跟誰。"))),
        // ---- 抱怨
        s("complain", "抱怨", "抱怨", 0.35f, "唉，今天真的好累。", "{物}真的很煩人耶。", social = 14f, like = 1, trust = 1, cond = "bad", reply = mapOf(H to listOf("辛苦了。"), N to listOf("又在抱怨了……"))),
        s("vent", "訴苦", "抱怨", 0.3f, "我跟你說，我真的受夠了……", social = 20f, like = 2, trust = 3, stage = 2, cond = "bad", closeup = true,
            reply = mapOf(W to listOf("說出來就好，我陪你。"), N to listOf("我也很累，晚點再說好嗎？"))),
        s("nag", "碎念", "抱怨", 0.45f, "{對方}，碗又沒洗了。", "你的東西又亂丟了。", social = 6f, like = -1, conflict = 3, hostile = true, cond = "chores",
            reply = mapOf(W to listOf("啊，抱歉，我馬上去！"), H to listOf("好啦好啦。"), A to listOf("你每次都只會念我！"))),
        // ---- 衝突
        s("argue", "吵架", "衝突", 0.7f, "你剛剛那樣說是什麼意思？", "我真的忍很久了！", social = 4f, fun_ = -6f, like = -2, conflict = 8, stage = 1, hostile = true, cond = "grudge", closeup = true,
            reply = mapOf(H to listOf("……好，我們好好說。是我不對。"), A to listOf("你才是！", "我才沒有錯！"), C to listOf("（眼淚掉下來）為什麼要這樣說……")), pose = Pose.ANGRY, fx = "anger"),
        s("sulk", "鬧彆扭", "衝突", 0.4f, "……哼。", "（別過頭不看{對方}）", social = 4f, like = -1, conflict = 2, hostile = true, cond = "feud", pose = Pose.SHY),
        s("mock", "嘲笑", "衝突", 0.6f, "你連這個都不會喔？", "哈，真遜。", social = 4f, fun_ = 4f, like = -2, conflict = 5, stage = 1, hostile = true, cond = "rival", reply = mapOf(W to listOf("下次給你好看！哈哈。"), A to listOf("你說什麼！"))),
        s("compete", "比賽", "衝突", 0.3f, "{對方}，來比賽！看誰先{物}！", "我們來比一比。", social = 14f, fun_ = 18f, like = 2, conflict = 1, cond = "rival", reply = mapOf(W to listOf("好啊，我不會輸的！"), N to listOf("我不想比。")), pose = Pose.HAPPY),
        // ---- 和好
        s("apologize", "道歉", "和好", 0.35f, "{對方}，之前是我不對。對不起。", "……對不起啦。", social = 16f, like = 4, trust = 3, conflict = -10, cond = "feud", closeup = true,
            reply = mapOf(W to listOf("我也有不對。我們和好吧。"), H to listOf("……嗯，我原諒你。"), N to listOf("我還需要一點時間。"))),
        s("makeup", "和好", "和好", 0.25f, "我們不要再吵了，好不好？", "（伸出小指）和好？", social = 18f, like = 4, trust = 2, conflict = -12, cond = "feud",
            reply = mapOf(W to listOf("（勾住小指）和好！"), N to listOf("……再說吧。"))),
        s("forgive", "原諒", "和好", 0.15f, "上次的事，我不生氣了。", social = 12f, like = 3, trust = 2, conflict = -6, cond = "wronged", reply = mapOf(H to listOf("……謝謝你。"))),
        // ---- 送禮
        s("gift", "送禮物", "送禮", 0.1f, "這個送你！", "我看到{物}就想到你。", social = 16f, fun_ = 8f, like = 4, trust = 1, favor = true, closeup = true, pose = Pose.HAPPY),
        // ---- 邀請
        s("invite_tv", "邀請一起看電視", "邀請", 0.2f, "{對方}，一起看電視嗎？", social = 16f, fun_ = 12f, like = 2, cond = "tvRoom", reply = mapOf(H to listOf("好啊！"), N to listOf("我等一下有事。"))),
        s("invite_meal", "邀請一起吃飯", "邀請", 0.15f, "飯煮好了，一起吃吧！", "{對方}，來吃飯囉。", social = 16f, like = 2, cond = "pot", reply = mapOf(H to listOf("來了來了！"))),
        s("invite_rps", "找對方猜拳", "邀請", 0.15f, "{對方}，來猜拳！輸的人……嗯，輸的人就輸了。", "剪刀、石頭——", social = 14f, fun_ = 16f, like = 2, pose = Pose.HAPPY),
        s("invite_hide", "找對方玩躲貓貓", "邀請", 0.25f, "來玩躲貓貓！你當鬼。", social = 14f, fun_ = 20f, like = 2, stage = 1, cond = "day", reply = mapOf(W to listOf("好！一、二、三……"), N to listOf("我們都多大了……"))),
        // ---- 肢體
        s("hug", "擁抱", "肢體", 0.45f, "（張開手臂）抱一下！", social = 22f, like = 3, trust = 2, stage = 2, intimate = true, closeup = true, reply = mapOf(W to listOf("（緊緊抱住）"), N to listOf("等、等一下，太突然了！")), pose = Pose.HAPPY, fx = "heart"),
        s("highfive", "擊掌", "肢體", 0.1f, "耶！擊掌！", social = 10f, fun_ = 10f, like = 2, reply = mapOf(W to listOf("耶！（啪！）")), pose = Pose.HAPPY, fx = "sparkle"),
        s("pat", "摸頭", "肢體", 0.4f, "（摸摸{對方}的頭）", social = 14f, like = 2, trust = 1, stage = 2, intimate = true, reply = mapOf(W to listOf("嘿嘿……"), A to listOf("不要把我當小孩子！"))),
        s("lean", "靠著肩膀", "肢體", 0.45f, "（輕輕靠在{對方}的肩膀上）", social = 20f, like = 3, trust = 2, stage = 3, intimate = true, cond = "seated", reply = mapOf(W to listOf("（不說話，只是讓你靠著）")), pose = Pose.SIT),
        s("groom", "幫忙整理頭髮", "肢體", 0.35f, "你頭髮翹起來了，我幫你。", social = 14f, like = 2, trust = 2, stage = 2, intimate = true, cond = "morning", reply = mapOf(H to listOf("啊，謝謝。"))),
        // ---- 照顧
        s("comfort", "安慰", "照顧", 0.15f, "{對方}，你還好嗎？", "沒事的，有我在。", social = 22f, like = 4, trust = 4, favor = true, cond = "targetSad", closeup = true,
            reply = mapOf(W to listOf("……謝謝你。（擦眼淚）"), N to listOf("讓我一個人靜一靜。"))),
        s("care", "叮嚀", "照顧", 0.25f, "要記得吃飯喔。", "早點睡，別熬夜了。", social = 10f, like = 2, trust = 1, favor = true, reply = mapOf(H to listOf("知道了啦。"), N to listOf("我又不是小孩子。"))),
        s("bring_tea", "端茶給對方", "照顧", 0.1f, "喝杯熱茶吧。", "給你，剛泡好的。", social = 12f, like = 3, trust = 1, favor = true, reply = mapOf(W to listOf("好溫暖……謝謝。"))),
        s("help", "幫忙做家事", "照顧", 0.1f, "我來幫你。", "這個我來就好。", social = 12f, like = 3, trust = 2, favor = true, cond = "chores", reply = mapOf(W to listOf("太好了，謝謝你！"))),
        // ---- 戀愛（兩位成年角色、戀愛打開；告白要你同意，見煩惱「想告白」）
        s("flirt", "偷偷看著對方", "戀愛", 0.4f, "（偷偷看了{對方}一眼，又移開視線）", social = 14f, like = 2, stage = 2, romance = true, reply = mapOf(W to listOf("（臉紅）……你、你看什麼啦。")), pose = Pose.SHY, fx = "heart"),
        s("confess", "告白", "戀愛", 0.5f, "{對方}，我……我喜歡你。", social = 30f, like = 6, trust = 4, stage = 3, romance = true, closeup = true, cond = "playerOnly",
            reply = mapOf(W to listOf("……我也是。一直都是。"), H to listOf("（點點頭）嗯。"), N to listOf("謝謝你……可是，我們還是當朋友好嗎？")), pose = Pose.SHY, fx = "heart"),
    ).associateBy { it.id }
    val CATS = listOf("打招呼", "聊天", "分享", "玩笑", "稱讚", "抱怨", "衝突", "和好", "送禮", "邀請", "肢體", "照顧", "戀愛")
    operator fun get(id: String) = ALL[id]

    /** general answers, by reaction (used when an act has none of its own) */
    val REPLY: Map<Reaction, List<String>> = mapOf(
        Reaction.WARM to listOf("太好了！", "我就知道你懂我！", "（眼睛亮起來）"), Reaction.HAPPY to listOf("嗯！", "好啊。", "嘿嘿。"),
        Reaction.OK to listOf("嗯嗯。", "這樣啊。", "原來如此。"), Reaction.MEH to listOf("……喔。", "嗯，是喔。", "（心不在焉）"),
        Reaction.NO to listOf("現在不太方便。", "下次吧。", "抱歉，我現在不想。"), Reaction.ANGRY to listOf("你很煩耶！", "走開啦！", "我生氣了！"),
        Reaction.CRY to listOf("（眼眶紅了）", "嗚……", "為什麼……"),
    )
    /** the relationship ladder (plan C-04) */
    val LADDER = listOf("陌生", "認識", "朋友", "好友", "知己")
    fun stageIndex(kind: String): Int = LADDER.indexOf(kind).let { if (it >= 0) it else when (kind) { "家人", "戀人" -> 3; "對手", "前任" -> 1; else -> 1 } }
}

/** a little gift chosen from home (the shop and the bag arrive with the town in M5) */
data class Gift(val id: String, val zh: String, val words: List<String>, val taste: String? = null)
object Gifts {
    val ALL = listOf(
        Gift("flower", "一朵小花", listOf("花", "植物", "園藝", "春")), Gift("cookie", "手工餅乾", listOf("甜點", "餅乾", "甜", "點心"), "甜"), Gift("book", "一本舊書", listOf("書", "看書", "閱讀")),
        Gift("drawing", "一張畫", listOf("畫", "畫畫", "美")), Gift("tea", "一包茶葉", listOf("茶", "安靜")), Gift("cap", "漂亮的瓶蓋", listOf("瓶蓋", "收集")),
        Gift("stone", "圓圓的石頭", listOf("石頭", "收集", "冒險")), Gift("ribbon", "緞帶", listOf("打扮", "可愛", "漂亮")), Gift("pudding", "布丁", listOf("布丁", "甜點", "甜"), "甜"),
        Gift("chili", "辣椒醬", listOf("辣"), "辣"), Gift("song", "一首自己寫的歌", listOf("音樂", "唱歌", "歌")), Gift("pillow", "小抱枕", listOf("抱枕", "睡覺", "舒服")),
    )
}

/** a dish cooked for everyone (plan B-06); `taste` is matched against each eater's tastes */
data class Dish(val id: String, val zh: String, val taste: String, val sweet: Boolean = false, val skill: Int = 0)
object Dishes {
    val ALL = listOf(
        Dish("curry", "咖哩飯", "辣"), Dish("omelet", "蛋包飯", "鹹"), Dish("soup", "蔬菜湯", "鹹"), Dish("noodle", "炒麵", "鹹"), Dish("hotpot", "小火鍋", "辣", skill = 2),
        Dish("salad", "水果沙拉", "酸"), Dish("bitter", "苦瓜炒蛋", "苦", skill = 1), Dish("pancake", "鬆餅", "甜", sweet = true), Dish("cake", "草莓蛋糕", "甜", sweet = true, skill = 3),
        Dish("pudding", "焦糖布丁", "甜", sweet = true, skill = 1),
    ).associateBy { it.id }
}

/** today's little state, rolled every morning (plan A-05); `act` multiplies activity / social-act scores */
data class DayStatus(val id: String, val zh: String, val act: Map<String, Float> = emptyMap(), val speed: Float = 1f, val line: String, val mood: Int = 0)
object DayStatuses {
    val ALL = listOf(
        DayStatus("bedhead", "睡亂了頭髮", mapOf("primp" to 2.5f), line = "頭髮怎麼翹成這樣……"), DayStatus("inspired", "靈感爆發", mapOf("read" to 1.5f, "paint" to 2f, "sing" to 2f, "cook" to 1.4f), line = "我想到一個好點子！", mood = 1),
        DayStatus("sweet", "特別想吃甜的", mapOf("snack" to 1.8f, "bake" to 2f), line = "今天好想吃甜的。"), DayStatus("talky", "話很多", mapOf("chat" to 1.8f), line = "今天好想找人說話！", mood = 1),
        DayStatus("alone", "想一個人待著", mapOf("chat" to 0.45f, "read" to 1.3f, "window" to 1.3f), line = "今天想安靜一點。"), DayStatus("energetic", "元氣滿滿", mapOf("active" to 1.5f, "lazy" to 0.6f), speed = 1.15f, line = "今天狀態超好！", mood = 1),
        DayStatus("sleepy", "一直想睡", mapOf("rest" to 1.6f, "nap" to 1.8f), speed = 0.9f, line = "好睏……", mood = -1), DayStatus("tidy", "想大掃除", mapOf("tidy" to 2.2f, "dishes" to 2f), line = "今天要把家裡弄得乾乾淨淨！"),
        DayStatus("clumsy", "有點迷糊", mapOf("daydream" to 1.6f), line = "咦？我剛剛要做什麼？"), DayStatus("kind", "想對大家好一點", mapOf("cook" to 1.5f, "s:照顧" to 1.8f, "s:送禮" to 1.8f), line = "今天要對大家好一點。", mood = 1),
    ).associateBy { it.id }
}

/** worry bubbles (plan D-01 / 13.1): colour key and icon are drawn by the screen */
data class WorryKind(val id: String, val zh: String, val icon: String, val line: String)
object Worries {
    val ALL = listOf(
        WorryKind("friend", "想交朋友", "people", "我想跟{對方}變熟一點……可是不知道怎麼開口。"),
        WorryKind("confess", "想告白", "heart", "我……好像喜歡上{對方}了。該怎麼辦？"),
        WorryKind("fight", "想吵架", "anger", "{對方}那件事，我越想越氣。"),
        WorryKind("hungry", "肚子餓", "food", "肚子好餓……"),
        WorryKind("nightmare", "做了惡夢", "cloud", "我做了一個好可怕的夢……"),
        WorryKind("heart", "有心事", "drop", "最近心裡悶悶的。"),
        WorryKind("want", "想要東西", "gift", "好想要{物}喔……"),
        WorryKind("bored", "好無聊", "dots", "好無聊……有沒有什麼好玩的？"),
        WorryKind("makeup", "想和好", "pinky", "我想跟{對方}和好，可是……"),
    ).associateBy { it.id }
}

/** what they wish for (plan A-07); the player can help */
object Wishes {
    /** kind → text (with {對方} / {物}) */
    val TEXT = mapOf("eat" to "想吃{物}", "close" to "想跟{對方}變熟", "talk" to "想跟{對方}好好聊一次", "tidy" to "想把家裡整理乾淨", "rps" to "想跟你玩猜拳", "petted" to "想被你摸摸頭", "hide" to "想玩躲貓貓")
}
