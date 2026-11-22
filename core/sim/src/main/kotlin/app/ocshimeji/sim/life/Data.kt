package app.ocshimeji.sim.life

/** The eight needs (plan 4.1), 0–100. Decay per game hour while awake; nothing ever kills or chases anyone away. */
enum class Need(val zh: String, val low: String, val decay: Float) {
    FOOD("飽足", "肚子餓了", 6f), ENERGY("精力", "好睏", 5f), HYGIENE("衛生", "想洗澡", 2.5f), SOCIAL("社交", "有點寂寞", 1.5f),
    FUN("樂趣", "好無聊", 4f), COMFORT("舒適", "坐立不安", 3f), ROOM("環境", "房間好亂", 0f), ATTENTION("關注", "想被摸摸", 1.5f)
}

/** what the body does while an activity runs (the renderer turns these into motion) */
enum class Pose { STAND, WALK, SIT, LIE, EAT, BATHE, READ, WATCH, WATER, TIDY, PRIMP, LOOK, DAYDREAM, HELD, FLY, DIZZY, HAPPY, PETTED, TALK, SWING, MEDITATE, SING, SHY, ANGRY, SAD }

/**
 * Activities. `kind` = the furniture that offers it (null = anywhere on the floor); `per` = need change per game hour;
 * `min` game minutes; tags steer personality; night/day restrict when it makes sense.
 */
data class Activity(
    val id: String, val zh: String, val kind: String?, val pose: Pose, val min: Int, val per: Map<Need, Float>,
    val tags: Set<String> = emptySet(), val night: Boolean = false, val day: Boolean = false, val finish: String? = null, val sameRoomAs: String? = null,
    /** only characters with one of these tags / traits / quirks do it (plan 13.2 專屬活動) */
    val only: Set<String> = emptySet(),
    /** a little thing in their hands (drawn by the screen: sword, laptop, cup…) */
    val prop: String? = null,
    /** only in this weather (plan B-10) */
    val weather: Set<String> = emptySet(),
    /** only between these hours of the day (naps in the afternoon, journals in the evening); from > to wraps past midnight */
    val from: Double = 0.0, val to: Double = 24.0,
) { fun inHours(h: Double) = if (from <= to) h >= from && h < to else h >= from || h < to }

object Acts {
    private fun a(id: String, zh: String, kind: String?, pose: Pose, min: Int, vararg per: Pair<Need, Float>, tags: Set<String> = emptySet(), night: Boolean = false, day: Boolean = false, finish: String? = null, sameRoomAs: String? = null,
                  only: Set<String> = emptySet(), prop: String? = null, weather: Set<String> = emptySet(), from: Double = 0.0, to: Double = 24.0) =
        Activity(id, zh, kind, pose, min, per.toMap(), tags, night, day, finish, sameRoomAs, only, prop, weather, from, to)
    val ALL: Map<String, Activity> = listOf(
        a("sleep", "睡覺", "bed", Pose.LIE, 420, Need.ENERGY to 14f, Need.COMFORT to 4f, tags = setOf("rest"), night = true, finish = "slept"),
        a("nap", "午睡", "bed", Pose.LIE, 45, Need.ENERGY to 16f, Need.COMFORT to 6f, tags = setOf("rest", "lazy"), day = true, from = 12.0, to = 17.5),
        a("sofanap", "在沙發上打盹", "sofa", Pose.LIE, 30, Need.ENERGY to 12f, Need.COMFORT to 8f, tags = setOf("rest", "lazy"), day = true, from = 12.0, to = 19.0),
        /* R1: small everyday things anyone does (the little moments the day is made of) */
        a("tea", "泡一杯茶", "stove", Pose.TIDY, 10, Need.COMFORT to 30f, Need.FUN to 20f, tags = setOf("calm"), prop = "cup"),
        a("diary", "寫日記", "table", Pose.READ, 20, Need.FUN to 25f, Need.COMFORT to 10f, tags = setOf("calm", "smart", "dreamy"), from = 19.0, to = 24.0),
        a("music", "戴著耳機聽音樂", null, Pose.DAYDREAM, 25, Need.FUN to 35f, Need.COMFORT to 10f, tags = setOf("calm")),
        a("stretch", "做伸展操", "rug", Pose.HAPPY, 15, Need.COMFORT to 25f, Need.ENERGY to 10f, Need.FUN to 10f, tags = setOf("active"), from = 6.0, to = 22.0),
        a("phone", "滑手機", "sofa", Pose.SIT, 20, Need.FUN to 35f, tags = setOf("lazy"), prop = "phone"),
        a("makebed", "整理床鋪", "bed", Pose.TIDY, 6, Need.ROOM to 60f, tags = setOf("tidy"), from = 6.0, to = 11.0),
        a("puzzle", "拼拼圖", "table", Pose.READ, 35, Need.FUN to 30f, tags = setOf("smart", "calm")),
        a("fold", "摺衣服", "bed", Pose.TIDY, 12, Need.ROOM to 40f, Need.FUN to 5f, tags = setOf("tidy")),
        a("album", "翻相簿", "shelf", Pose.READ, 20, Need.FUN to 25f, Need.SOCIAL to 10f, tags = setOf("dreamy", "calm")),
        a("letter", "寫信給朋友", "table", Pose.READ, 20, Need.SOCIAL to 30f, Need.FUN to 10f, tags = setOf("dreamy")),
        a("plantchat", "跟植物說話", "plant", Pose.LOOK, 8, Need.FUN to 36f, Need.SOCIAL to 10f, tags = setOf("dreamy")),
        a("hum", "一邊哼歌一邊晃", null, Pose.SING, 18, Need.FUN to 38f, tags = setOf("active")),
        /* 1.5.1: more of the small things anyone does (variety for residents without special tags) */
        a("doodle", "隨手塗鴉", "table", Pose.READ, 15, Need.FUN to 40f, Need.COMFORT to 10f, tags = setOf("calm", "dreamy")),
        a("cloudwatch", "看雲發呆", "window", Pose.LOOK, 20, Need.FUN to 30f, Need.COMFORT to 20f, tags = setOf("dreamy"), from = 8.0, to = 17.5),
        a("stargaze", "看星星", "window", Pose.LOOK, 15, Need.FUN to 36f, Need.COMFORT to 14f, tags = setOf("dreamy"), from = 19.5, to = 23.5),
        a("sweep", "掃地", null, Pose.TIDY, 10, Need.ROOM to 90f, Need.FUN to 2f, tags = setOf("tidy", "active"), from = 7.0, to = 21.0),
        a("dance", "隨著音樂跳舞", null, Pose.HAPPY, 15, Need.FUN to 44f, Need.COMFORT to 6f, tags = setOf("active"), from = 8.0, to = 22.0),
        a("origami", "摺紙", null, Pose.READ, 15, Need.FUN to 38f, Need.COMFORT to 10f, tags = setOf("calm")),
        a("snack", "從冰箱拿點心吃", "fridge", Pose.EAT, 10, Need.FOOD to 120f, Need.FUN to 6f, tags = setOf("food"), finish = "snack"),
        a("cook", "煮飯", "stove", Pose.TIDY, 25, Need.FOOD to 0f, Need.FUN to 8f, tags = setOf("food", "active"), finish = "cooked"),
        a("meal", "吃飯", "table", Pose.EAT, 20, Need.FOOD to 210f, Need.COMFORT to 6f, tags = setOf("food"), finish = "meal"),
        a("bathe", "洗澡", "tub", Pose.BATHE, 25, Need.HYGIENE to 220f, Need.COMFORT to 8f, tags = setOf("calm"), finish = "bathed"),
        a("primp", "照鏡子整理", "mirror", Pose.PRIMP, 6, Need.HYGIENE to 60f, Need.FUN to 10f, tags = setOf("vain")),
        a("tv", "看電視", "sofa", Pose.WATCH, 40, Need.FUN to 22f, Need.COMFORT to 8f, tags = setOf("lazy"), sameRoomAs = "tv"),
        a("tvrug", "坐在地毯上看電視", "rug", Pose.WATCH, 30, Need.FUN to 20f, Need.COMFORT to 3f, tags = setOf("lazy"), sameRoomAs = "tv"),
        a("read", "看書", "shelf", Pose.READ, 35, Need.FUN to 16f, tags = setOf("calm", "smart")),
        a("relax", "坐著休息", "sofa", Pose.SIT, 20, Need.COMFORT to 30f, Need.ENERGY to 3f, tags = setOf("lazy")),
        a("sitrug", "坐在地毯上發呆", "rug", Pose.DAYDREAM, 15, Need.COMFORT to 18f, Need.FUN to 8f, tags = setOf("lazy", "dreamy")),
        a("framelook", "看相框", "frame", Pose.LOOK, 8, Need.FUN to 18f, Need.COMFORT to 8f, tags = setOf("calm", "dreamy"), finish = "nostalgic"),
        a("water", "幫植物澆水", "plant", Pose.WATER, 6, Need.ROOM to 80f, Need.FUN to 20f, tags = setOf("tidy", "calm")),
        a("window", "看窗外", "window", Pose.LOOK, 10, Need.FUN to 18f, Need.COMFORT to 6f, tags = setOf("dreamy"), day = true),
        a("tidy", "整理房間", null, Pose.TIDY, 20, Need.ROOM to 150f, Need.FUN to -4f, tags = setOf("tidy", "active")),
        a("daydream", "發呆", null, Pose.DAYDREAM, 10, Need.FUN to 8f, Need.COMFORT to 4f, tags = setOf("dreamy")),
        a("chat", "聊天", null, Pose.TALK, 15, Need.SOCIAL to 90f, Need.FUN to 12f, tags = setOf("chat"), finish = "chatted"),
        a("dishes", "洗碗", "stove", Pose.TIDY, 10, Need.ROOM to 30f, Need.FUN to -3f, tags = setOf("tidy")),
        /* the bathroom is taken: wait outside (plan 12.11 共用設施排隊); offered only then (Society.queueCand) */
        a("queue", "在浴室外排隊", null, Pose.STAND, 5, Need.COMFORT to -2f),
        // ---- M6: town, yard, workshop, weather
        /* go to town (plan B-12): the door is the destination, the town takes it from there */
        a("outing", "出門去小鎮", null, Pose.WALK, 120, Need.FUN to 60f, Need.SOCIAL to 40f, tags = setOf("active"), day = true),
        a("garden", "照顧菜園", "garden", Pose.WATER, 20, Need.FUN to 18f, Need.ROOM to 20f, tags = setOf("tidy", "calm"), day = true),
        a("laundry", "曬衣服", "line", Pose.TIDY, 15, Need.HYGIENE to 30f, Need.FUN to 4f, tags = setOf("tidy"), day = true, weather = setOf("sunny", "cloudy")),
        a("craft", "做手工", null, Pose.TIDY, 60, Need.FUN to 40f, tags = setOf("calm"), prop = "brush"),
        a("rainwatch", "看窗外的雨", "window", Pose.LOOK, 15, Need.COMFORT to 14f, Need.FUN to 8f, tags = setOf("dreamy"), weather = setOf("rain")),
        a("snowwatch", "看窗外的雪", "window", Pose.LOOK, 15, Need.FUN to 20f, tags = setOf("dreamy"), weather = setOf("snow")),
        // ---- only for some (tags, traits, quirks): plan 13.2 專屬活動 — the closest system pose plus a prop
        a("sword", "練劍", null, Pose.SWING, 20, Need.FUN to 18f, tags = setOf("active"), only = setOf("劍修", "騎士", "傭兵", "武俠"), prop = "sword"),
        a("meditate", "打坐", null, Pose.MEDITATE, 30, Need.COMFORT to 20f, Need.FUN to 8f, tags = setOf("calm"), only = setOf("宗門長老", "東方玄幻", "神明", "劍修", "武俠")),
        a("laptop", "抱著筆電嘆氣", null, Pose.READ, 25, Need.FUN to 6f, only = setOf("社畜", "駭客", "研究員", "作家"), prop = "laptop"),
        a("coffee", "喝黑咖啡", null, Pose.EAT, 10, Need.ENERGY to 30f, Need.FUN to 5f, only = setOf("咖啡成癮", "社畜"), prop = "cup", day = true),
        a("sing", "練唱", null, Pose.SING, 15, Need.FUN to 22f, Need.SOCIAL to 5f, tags = setOf("active"), only = setOf("偶像", "音樂家", "追星族"), prop = "note", day = true),
        a("paint", "畫畫", null, Pose.READ, 30, Need.FUN to 20f, tags = setOf("calm"), only = setOf("畫家"), prop = "brush"),
        a("potion", "調配藥水", "stove", Pose.TIDY, 20, Need.FUN to 18f, only = setOf("鍊金術師", "魔法師"), prop = "flask"),
        a("bake", "研究新甜點", "stove", Pose.TIDY, 25, Need.FUN to 15f, Need.FOOD to 20f, only = setOf("甜點師", "重度甜食控"), prop = "cake"),
        a("money", "數錢", null, Pose.READ, 10, Need.FUN to 15f, only = setOf("財迷"), prop = "coin"),
        a("game", "打電動", "sofa", Pose.WATCH, 40, Need.FUN to 26f, tags = setOf("lazy"), sameRoomAs = "tv", only = setOf("遊戲廢人"), prop = "game"),
        a("selfie", "自拍", null, Pose.PRIMP, 6, Need.FUN to 16f, tags = setOf("vain"), only = setOf("愛拍照", "自戀", "偶像"), prop = "phone"),
        a("workout", "健身", null, Pose.SWING, 20, Need.FUN to 12f, Need.COMFORT to 6f, tags = setOf("active"), only = setOf("健身狂", "運動員"), prop = "dumbbell", day = true),
        a("posing", "擺帥氣的姿勢", null, Pose.HAPPY, 5, Need.FUN to 14f, only = setOf("中二病", "魔王"), prop = "star"),
        a("sunbathe", "曬太陽", "window", Pose.SIT, 25, Need.COMFORT to 20f, Need.FUN to 8f, tags = setOf("lazy"), day = true, only = setOf("獸人", "植物系", "貓系", "冷血", "樹人")),
        a("charge", "充電", null, Pose.SIT, 40, Need.ENERGY to 28f, only = setOf("仿生人", "機器人"), prop = "bolt"),
        a("drift", "飄來飄去", null, Pose.DAYDREAM, 10, Need.FUN to 14f, tags = setOf("dreamy"), only = setOf("幽靈")),
        a("deduce", "推理", null, Pose.READ, 20, Need.FUN to 16f, tags = setOf("smart"), only = setOf("偵探"), prop = "magnifier"),
        a("magic", "練習魔法", null, Pose.SWING, 20, Need.FUN to 18f, only = setOf("魔法師", "西幻"), prop = "star"),
        a("fortune", "占卜", null, Pose.READ, 10, Need.FUN to 14f, only = setOf("占卜師"), prop = "star"),
        a("pillow", "抱著抱枕滾來滾去", "rug", Pose.LIE, 10, Need.COMFORT to 20f, Need.FUN to 6f, only = setOf("愛抱枕", "抱枕不離身"), prop = "pillow"),
    ).associateBy { it.id }
    operator fun get(id: String) = ALL[id]
}

/** mood cards (plan 13.4): where a feeling came from, how strong, how long */
data class MoodDef(val id: String, val zh: String, val value: Int, val hours: Float)
object Moods {
    val ALL = listOf(
        MoodDef("slept", "睡得好", 2, 4f), MoodDef("badsleep", "沒睡好", -1, 4f), MoodDef("snack", "吃了點心", 1, 2f), MoodDef("meal", "吃飽了", 2, 3f),
        MoodDef("tasty", "好吃的東西", 2, 3f), MoodDef("yuck", "不喜歡的味道", -1, 2f), MoodDef("cooked", "自己煮了飯", 1, 3f), MoodDef("bathed", "洗得乾乾淨淨", 1, 4f),
        MoodDef("petted", "被摸摸", 2, 3f), MoodDef("pettedsleep", "睡夢中被摸摸", 1, 3f), MoodDef("thrown", "被丟出去", -1, 1f), MoodDef("thrownfun", "飛起來好好玩", 1, 1f),
        MoodDef("dizzy", "頭暈", -1, 0.5f), MoodDef("lifted", "被抱起來", 1, 1f),
        MoodDef("hungry", "肚子餓", -2, 0.25f), MoodDef("tired", "好累", -2, 0.25f), MoodDef("dirty", "身上黏黏的", -1, 0.25f), MoodDef("bored", "好無聊", -1, 0.25f),
        MoodDef("messy", "房間好亂", -1, 0.25f), MoodDef("ignored", "好久沒人理", -1, 0.25f), MoodDef("lonely", "有點寂寞", -1, 0.25f), MoodDef("newhome", "搬進新家", 2, 24f),
        MoodDef("hate", "做了討厭的事", -1, 1f), MoodDef("dark", "好黑好可怕", -2, 0.25f), MoodDef("sunburn", "陽光好刺眼", -1, 1f), MoodDef("noisy", "人太多好吵", -1, 0.25f),
        MoodDef("scared", "好高好可怕", -1, 1f),
        MoodDef("afraid", "好害怕", -2, 1f), MoodDef("brave", "克服了害怕", 2, 24f), MoodDef("sick", "身體不舒服", -2, 24f), MoodDef("well", "病好了", 1, 6f),
        MoodDef("craze", "最近迷上一件事", 1, 24f), MoodDef("whim", "今天突發奇想", 1, 16f), MoodDef("party", "大家一起玩", 2, 6f), MoodDef("debatewin", "爭論贏了", 1, 6f),
        MoodDef("debatelose", "爭論輸了", -1, 3f), MoodDef("contestwin", "比賽贏了", 1, 4f), MoodDef("contestlose", "比賽輸了", -1, 2f), MoodDef("dreamstep", "離夢想更近了", 2, 24f),
        MoodDef("dreamcome", "夢想實現了", 3, 72f), MoodDef("inlove", "戀愛了", 3, 72f), MoodDef("grown", "長大了一歲", 2, 24f), MoodDef("surprised", "收到驚喜派對", 3, 12f),
        MoodDef("gossiped", "被大家說閒話", -1, 3f), MoodDef("photo", "被你拍了照", 1, 3f), MoodDef("capsule", "打開了時光膠囊", 2, 24f), MoodDef("newroom", "換了新房間", 1, 24f), MoodDef("nostalgic", "想起了以前的事", 1, 3f), MoodDef("parted", "剛分開", -2, 48f), MoodDef("reunited", "復合了", 3, 24f), MoodDef("anniv", "今天是紀念日", 2, 24f), MoodDef("date", "約會了", 3, 12f),
        MoodDef("trip", "去旅行了", 2, 24f), MoodDef("lucky", "幸運的一天", 1, 24f), MoodDef("sweetdream", "做了好夢", 1, 8f), MoodDef("wish", "對流星許了願", 1, 6f), MoodDef("liked", "貼文被按讚", 1, 3f), MoodDef("sang", "唱了一首歌", 1, 3f), MoodDef("birthday", "今天生日", 3, 24f), MoodDef("plants", "身邊有植物", 1, 0.25f), MoodDef("annoyed", "被摸到不喜歡的地方", -1, 1f),
        MoodDef("spot", "被摸到最喜歡的地方", 2, 3f), MoodDef("chatted", "聊得很開心", 1, 3f), MoodDef("badchat", "聊得不太愉快", -1, 2f), MoodDef("secret", "說出了秘密", 1, 6f),
        MoodDef("angry", "生氣了", -2, 1f),
        MoodDef("socgood", "相處得很開心", 1, 2f), MoodDef("rejected", "被拒絕了", -1, 2f), MoodDef("cried", "哭過了", -2, 2f), MoodDef("madeup", "和好了", 2, 6f),
        MoodDef("feud", "正在冷戰", -1, 0.25f), MoodDef("helped", "你答應了我的請求", 2, 4f), MoodDef("wishdone", "心願實現了", 3, 12f), MoodDef("gift", "收到禮物", 2, 6f),
        MoodDef("listened", "有人聽我說話", 2, 4f), MoodDef("nightmare", "做了惡夢", -1, 3f), MoodDef("heartbroken", "告白失敗", -3, 24f), MoodDef("together", "在一起了", 3, 48f),
        MoodDef("played", "玩得很開心", 2, 3f), MoodDef("dayup", "今天狀態不錯", 1, 16f), MoodDef("daydown", "今天有點沒精神", -1, 16f), MoodDef("idea", "照你的主意，很順利", 1, 4f),
        MoodDef("ideabad", "照你的主意，不太順利", -1, 3f), MoodDef("praised", "煮的飯被稱讚", 2, 6f), MoodDef("lostlast", "最後一塊被吃掉了", -1, 2f), MoodDef("ignoredask", "請求沒人理", -1, 2f),
        MoodDef("waiting", "排隊等浴室", -1, 0.25f),
        MoodDef("goodweather", "喜歡今天的天氣", 1, 0.25f), MoodDef("rainy", "雨天悶悶的", -1, 0.25f), MoodDef("cosy", "房間很舒服", 1, 0.25f), MoodDef("bare", "房間空蕩蕩的", -1, 0.25f),
        MoodDef("town", "去小鎮玩了一趟", 2, 4f), MoodDef("rainbow", "看到彩虹", 3, 6f), MoodDef("firstsnow", "初雪", 2, 12f), MoodDef("crafted", "做好了作品", 2, 8f),
        MoodDef("newthing", "房間多了喜歡的東西", 2, 12f), MoodDef("festival", "逛了祭典", 3, 8f), MoodDef("treated", "你請喝咖啡", 2, 4f),
    ).associateBy { it.id }
}

/** idle micro-behaviours (plan 13.5, first batch of 30): short, in real seconds, a pose and maybe a line */
data class Micro(val id: String, val pose: Pose, val sec: Float, val line: String? = null, val needs: Need? = null, val dreamy: Boolean = false, val prop: String? = null)
object Micros {
    val ALL = listOf(
        Micro("stretch", Pose.HAPPY, 2.5f, "嗯——伸個懶腰。"), Micro("yawn", Pose.STAND, 2f, "哈啊……", Need.ENERGY), Micro("lookaround", Pose.LOOK, 3f),
        Micro("hum", Pose.HAPPY, 3f, "♪～"), Micro("spin", Pose.HAPPY, 1.6f), Micro("sitfloor", Pose.SIT, 6f), Micro("tummy", Pose.STAND, 2.5f, "咕嚕咕嚕……", Need.FOOD),
        Micro("scratch", Pose.STAND, 2f), Micro("hop", Pose.HAPPY, 1.2f), Micro("sigh", Pose.STAND, 2.5f, "唉……", Need.FUN),
        Micro("wave", Pose.HAPPY, 2f, "（向你揮揮手）", Need.ATTENTION), Micro("peek", Pose.LOOK, 2.5f, "……有人在看我嗎？", Need.ATTENTION), Micro("pout", Pose.STAND, 2.5f, "都沒有人陪我。", Need.SOCIAL),
        Micro("doze", Pose.DAYDREAM, 4f, "（打瞌睡）", Need.ENERGY), Micro("think", Pose.DAYDREAM, 4f, "嗯……要做什麼好呢。", dreamy = true), Micro("count", Pose.DAYDREAM, 3f, "一、二、三……"),
        Micro("dance", Pose.HAPPY, 3f, "跳一下！"), Micro("smell", Pose.LOOK, 2.5f, "好像有什麼香香的。", Need.FOOD), Micro("shake", Pose.STAND, 1.5f), Micro("bow", Pose.STAND, 1.5f),
        Micro("cloud", Pose.LOOK, 3f, "那朵雲像蛋糕。", dreamy = true), Micro("tiptoe", Pose.WALK, 2f), Micro("roll", Pose.LIE, 3f), Micro("pat", Pose.STAND, 2f, "嗯，今天也很好。"),
        Micro("sneeze", Pose.STAND, 1.2f, "哈啾！"), Micro("itch", Pose.STAND, 2f, "癢癢的。", Need.HYGIENE), Micro("check", Pose.LOOK, 2.5f, "東西有放好嗎……", Need.ROOM),
        Micro("practice", Pose.HAPPY, 3f, "練習一下可愛的表情。"), Micro("mumble", Pose.DAYDREAM, 3f, "……嗯嗯，原來如此。", dreamy = true), Micro("rest", Pose.SIT, 5f),
    )
}

/** short lines for things that happen to a character (original; the speech system of M2 will rephrase them per character) */
object Lines {
    val M = mapOf(
        "petted" to listOf("嘿嘿。", "好舒服……", "再一下下。", "（瞇起眼睛）"),
        "pettedsleep" to listOf("（在夢裡笑了）", "嗯……"),
        "lifted" to listOf("哇，好高！", "要去哪裡？", "放我下來啦。", "（晃來晃去）"),
        "thrown" to listOf("哇啊啊——", "咦咦咦！"),
        "landed" to listOf("……天旋地轉。", "再一次！", "好痛……下次輕一點。"),
        "tasty" to listOf("好好吃！", "最喜歡這個了。"),
        "snackok" to listOf("謝謝。", "嗯，還不錯。"),
        "yuck" to listOf("……這個不太合口味。"),
        "full" to listOf("吃不下了。"),
        "wake" to listOf("早安……", "睡飽了。"),
        "arrive" to listOf("這裡就是新家嗎？", "打擾了。", "哇，好漂亮。", "我的房間在哪裡？"),
        "spot" to listOf("就是那裡！", "再多摸一下那裡……", "（舒服得眯起眼睛）"),
        "annoyed" to listOf("那裡不行！", "不、不要摸那裡啦。"),
        "stranger" to listOf("請、請不要突然摸我。", "……（僵住）", "我們還不太熟吧？"),
        "come" to listOf("我來找你了！", "你在那裡嗎？", "陪我一下好不好？"),
        "scared" to listOf("好高！快放我下來！", "我、我不要在上面……"),
        "angry" to listOf("你在做什麼啦！", "我生氣了！"),
        "birthday" to listOf("今天是我的生日！", "生日耶，嘿嘿。"),
        "dark" to listOf("好黑……燈呢？", "有、有人在嗎？"),
        "yuckfood" to listOf("……這個味道我不行。", "嗚，不喜歡。"),
        "chatOpen" to listOf("吶，{對方}，你知道{話題}嗎？", "說到{話題}……", "{對方}，跟你說{話題}的事。", "對了，{話題}的事你聽說了嗎？"),
        "deskOut" to listOf("哇，這裡就是你的手機！", "我出來陪你了。", "外面好大喔。"),
        "deskBack" to listOf("我回家囉。", "下次再出來玩。"),
        "charging" to listOf("充電了！能量滿滿！", "電來了～"),
        "lowBattery" to listOf("手機好像快沒電了……我也好睏。", "電量好低，要充電喔。"),
        "night" to listOf("很晚了，早點睡吧。", "（打了個大哈欠）我們一起睡吧？", "夜深了，眼睛會累喔。"),
        "hungry" to listOf("肚子餓了……有點心嗎？", "好餓喔，可以給我吃的嗎？"),
        "lonely" to listOf("理我一下嘛。", "可以摸摸我嗎？"),
        "reminder" to listOf("記得喝水喔！", "休息一下吧，眼睛也要休息。", "站起來伸個懶腰吧。"),
        "ackReminder" to listOf("好，乖。", "嘿嘿，有聽進去就好。"),
        "jump" to listOf("跳！", "嘿咻！"),
        "letGo" to listOf("哇啊——", "手好痠，放手了！"),
        "back" to listOf("我回來了！", "剛剛躲起來了。"),
        "focusStart" to listOf("好，我在旁邊看書，你加油。", "一起專心吧。我不吵你。", "開始囉，我陪你。"),
        "breakTime" to listOf("休息一下！起來動一動吧。", "時間到～喝口水，伸個懶腰。", "辛苦了，休息五分鐘。"),
        "focusDone" to listOf("做完了！你好厲害。", "今天很努力喔。"),
        "caught" to listOf("抓到你的手指了！", "嘿嘿，追上了。", "等等我～"),
        "tapDesk" to listOf("嗯？", "怎麼了？", "你叫我嗎？", "嘿嘿。"),
        "chatReply" to listOf("真的嗎？", "嗯嗯，然後呢？", "哈哈，好好笑。", "我也這麼覺得。", "咦——是喔？", "原來如此。"),
    )
}
