package app.ocshimeji.sim.life

/** The eight needs (plan 4.1), 0–100. Decay per game hour while awake; nothing ever kills or chases anyone away. */
enum class Need(val zh: String, val low: String, val decay: Float) {
    FOOD("飽足", "肚子餓了", 6f), ENERGY("精力", "好睏", 5f), HYGIENE("衛生", "想洗澡", 2.5f), SOCIAL("社交", "有點寂寞", 1.5f),
    FUN("樂趣", "好無聊", 4f), COMFORT("舒適", "坐立不安", 3f), ROOM("環境", "房間好亂", 0f), ATTENTION("關注", "想被摸摸", 1.5f)
}

/** what the body does while an activity runs (the renderer turns these into motion) */
enum class Pose { STAND, WALK, SIT, LIE, EAT, BATHE, READ, WATCH, WATER, TIDY, PRIMP, LOOK, DAYDREAM, HELD, FLY, DIZZY, HAPPY, PETTED }

/**
 * Activities. `kind` = the furniture that offers it (null = anywhere on the floor); `per` = need change per game hour;
 * `min` game minutes; tags steer personality; night/day restrict when it makes sense.
 */
data class Activity(
    val id: String, val zh: String, val kind: String?, val pose: Pose, val min: Int, val per: Map<Need, Float>,
    val tags: Set<String> = emptySet(), val night: Boolean = false, val day: Boolean = false, val finish: String? = null, val sameRoomAs: String? = null,
)

object Acts {
    private fun a(id: String, zh: String, kind: String?, pose: Pose, min: Int, vararg per: Pair<Need, Float>, tags: Set<String> = emptySet(), night: Boolean = false, day: Boolean = false, finish: String? = null, sameRoomAs: String? = null) =
        Activity(id, zh, kind, pose, min, per.toMap(), tags, night, day, finish, sameRoomAs)
    val ALL: Map<String, Activity> = listOf(
        a("sleep", "睡覺", "bed", Pose.LIE, 420, Need.ENERGY to 14f, Need.COMFORT to 4f, tags = setOf("rest"), night = true, finish = "slept"),
        a("nap", "午睡", "bed", Pose.LIE, 45, Need.ENERGY to 16f, Need.COMFORT to 6f, tags = setOf("rest", "lazy"), day = true),
        a("sofanap", "在沙發上打盹", "sofa", Pose.LIE, 30, Need.ENERGY to 12f, Need.COMFORT to 8f, tags = setOf("rest", "lazy"), day = true),
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
        a("water", "幫植物澆水", "plant", Pose.WATER, 6, Need.ROOM to 80f, Need.FUN to 20f, tags = setOf("tidy", "calm")),
        a("window", "看窗外", "window", Pose.LOOK, 10, Need.FUN to 18f, Need.COMFORT to 6f, tags = setOf("dreamy"), day = true),
        a("tidy", "整理房間", null, Pose.TIDY, 20, Need.ROOM to 150f, Need.FUN to -4f, tags = setOf("tidy", "active")),
        a("daydream", "發呆", null, Pose.DAYDREAM, 10, Need.FUN to 8f, Need.COMFORT to 4f, tags = setOf("dreamy")),
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
    ).associateBy { it.id }
}

/** idle micro-behaviours (plan 13.5, first batch of 30): short, in real seconds, a pose and maybe a line */
data class Micro(val id: String, val pose: Pose, val sec: Float, val line: String? = null, val needs: Need? = null, val dreamy: Boolean = false)
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
    )
}
