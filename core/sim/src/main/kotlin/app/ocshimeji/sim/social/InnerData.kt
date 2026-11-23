package app.ocshimeji.sim.social

import kotlinx.serialization.Serializable

/**
 * 2.2.0 (expansion phase 2): the inner life — what is saved, and the data it reads. The logic is `life/Inner`.
 */
@Serializable
class InnerState(
    var lastDay: Long = -1, var lastTick: Double = -1e9,
    /** person → inner need (`InnerNeeds`) → 0..100 */
    val needs: MutableMap<String, MutableMap<String, Float>> = mutableMapOf(),
    var nextId: Int = 1,
    /** #21: memories with weight, feeling and the people in them; they fade */
    val memos: MutableList<Memo> = mutableListOf(),
    /** "a|b" → the last minute both were at home */
    val together: MutableMap<String, Double> = mutableMapOf(),
    /** person → the one they miss now (logged once) */
    val missing: MutableMap<String, String> = mutableMapOf(),
    /** #31: "person|act|slot" → the days it was done (the last two weeks) */
    val habDays: MutableMap<String, MutableList<Long>> = mutableMapOf(),
    val routines: MutableList<Routine> = mutableListOf(),
    /** #34: "person|pieceKey" → how many times; pieceKey → owner */
    val seatUse: MutableMap<String, Int> = mutableMapOf(),
    val owners: MutableMap<String, String> = mutableMapOf(),
    /** #02: today's small goal and the long one */
    val goals: MutableList<GoalRec> = mutableListOf(),
    /** #47: invitations and promises */
    val appts: MutableList<Appt> = mutableListOf(),
    /** #40: firsts and turning points */
    val firsts: MutableList<First> = mutableListOf(),
    /** #03: "a>b" → the first impression (−6..6); "a|b" → pair chats counted so far */
    val impressions: MutableMap<String, Int> = mutableMapOf(),
    val pairSeen: MutableMap<String, Int> = mutableMapOf(),
    /** #45: person → likes picked up from someone close (at most 3) */
    val picked: MutableMap<String, MutableList<String>> = mutableMapOf(),
    /** #49: person → (bond, their like for me when last looked) ; keys done once ("defend:a:b:since") */
    val bondLike: MutableMap<String, Int> = mutableMapOf(),
    val once: MutableList<String> = mutableListOf(),
)

/** a memory: `emo` happy / warm / sad / angry / scared; `imp` 1 small … 3 never fades; `obj` a thing that can bring it back (gift id or activity id) */
@Serializable
class Memo(val id: Int, val who: String, val with: String, val what: String, val emo: String, val imp: Int, val minute: Double, val obj: String = "", var recalls: Int = 0, var lastRecall: Double = -1e9)

/** a habit that formed by itself: doing `act` at the same time of day; `from` = picked up from someone */
@Serializable
class Routine(val who: String, val act: String, val slot: Int, val since: Long, var last: Long, val from: String = "")

/** a goal: `long` ones last until done; `need` how many times; `got` done so far */
@Serializable
class GoalRec(val who: String, val id: String, val text: String, val acts: List<String>, val need: Int, var got: Int = 0, val day: Long, val long: Boolean = false, var done: Boolean = false)

/** an invitation: `state` asked → ok / no / moved → done / missed */
@Serializable
class Appt(val id: Int, val from: String, val to: String, val act: String, var at: Double, var state: String = "ok", var moved: Boolean = false, val made: Double = 0.0, val doneBy: MutableList<String> = mutableListOf())

@Serializable
class First(val who: String, val minute: Double, val key: String, val text: String)

data class INeed(val id: String, val zh: String, val low: String, val mood: String)
object InnerNeeds {
    val ALL = listOf(
        INeed("ALONE", "獨處", "想一個人靜一靜", "crowded"), INeed("SAFETY", "安全感", "不太安心", "uneasy"), INeed("CREATE", "創造欲", "手癢想做點東西", "itchy"),
        INeed("ACHIEVE", "成就感", "覺得什麼都沒做成", "useless"), INeed("BELONG", "歸屬感", "覺得自己像外人", "leftout"), INeed("CURIOUS", "好奇心", "好想知道新的事", "restless"),
    )
    val BY = ALL.associateBy { it.id }
    /** finishing these fills a need */
    val FILL: Map<String, Pair<Set<String>, Float>> = mapOf(
        "CREATE" to (setOf("doodle", "craft", "paint", "origami", "bake", "cook", "diary", "letter", "sing", "potion", "hum") to 30f),
        "ACHIEVE" to (setOf("tidy", "dishes", "sweep", "cook", "puzzle", "garden", "workout", "laundry", "fold", "makebed", "water", "sword") to 15f),
        "CURIOUS" to (setOf("read", "window", "cloudwatch", "stargaze", "deduce", "album", "phone", "fortune", "rainwatch", "snowwatch", "magic") to 25f),
        "SAFETY" to (setOf("sleep", "relax", "tea", "pillow", "sofanap", "meditate") to 12f),
        "ALONE" to (setOf("music", "read", "diary", "meditate", "cloudwatch", "daydream", "sitrug", "stargaze") to 10f),
    )
    /** activities a low need pulls them towards */
    val PULL: Map<String, Set<String>> = FILL.mapValues { it.value.first - setOf("cook", "bake", "sleep") } + ("BELONG" to setOf("tv", "tvrug"))
}

object InnerData {
    /** what brings a memory back: a thing (gift id) → the furniture and activities that remind of it */
    val REMIND: Map<String, Set<String>> = mapOf(
        "flower" to setOf("plant", "water", "plantchat"), "book" to setOf("read", "shelf"), "tea" to setOf("tea"), "cookie" to setOf("snack", "bake"), "pudding" to setOf("snack", "fridge"),
        "song" to setOf("music", "hum", "sing"), "drawing" to setOf("doodle", "paint"), "pillow" to setOf("pillow", "relax"), "cap" to setOf("album"), "stone" to setOf("window"),
        "ribbon" to setOf("primp", "mirror"), "chili" to setOf("meal", "cook"),
    )
    val SLOT_ZH = listOf("深夜", "清晨", "早上", "上午", "中午", "下午", "傍晚", "晚上")
    /** activities that count as a habit (not the ones everyone does every day anyway) */
    val NOT_HABIT = setOf("sleep", "meal", "snack", "bathe", "chat", "queue", "outing", "dishes", "nap")
    /** seats people get attached to */
    val SEATS = setOf("sofa", "table", "rug", "window")
    /** things two can do together at home (appointments) */
    val TOGETHER = listOf("tv", "tea", "puzzle", "cloudwatch", "stargaze", "music", "dance", "tvrug")
    /** clashing values (a small friction now and then) */
    val VALUE_CLASH = listOf("家人" to "自由", "成就" to "安穩", "樂趣" to "知識", "和平" to "成就")

    class GoalDef(val id: String, val text: String, val acts: List<String>, val need: Int, val dims: List<String> = emptyList(), val traits: List<String> = emptyList(), val skill: String = "")
    val SHORT = listOf(
        GoalDef("read", "今天想把書看完", listOf("read"), 2, listOf("好奇"), listOf("書蟲")),
        GoalDef("tidy", "今天要把房間整理乾淨", listOf("tidy", "sweep"), 2, listOf("責任", "完美"), listOf("愛乾淨")),
        GoalDef("make", "今天想做出一個作品", listOf("doodle", "craft", "paint", "origami"), 1, listOf("創造"), listOf("手作人")),
        GoalDef("cook", "今天想煮一頓好吃的", listOf("cook", "bake"), 1, listOf("同理"), listOf("美食家", "愛照顧人")),
        GoalDef("move", "今天要動一動身體", listOf("stretch", "workout", "dance"), 2, listOf("活力"), listOf("運動派")),
        GoalDef("plant", "今天要好好照顧植物", listOf("water", "plantchat", "garden"), 2, listOf("耐心"), listOf("園藝家")),
        GoalDef("puzzle", "今天想拼完一幅拼圖", listOf("puzzle"), 2, listOf("耐心", "完美"), listOf("拼圖控")),
        GoalDef("write", "今天想寫點東西", listOf("diary", "letter"), 1, listOf("浪漫"), listOf("寫字的人")),
        GoalDef("sky", "今天想好好看看天空", listOf("cloudwatch", "stargaze", "window"), 2, listOf("浪漫", "好奇"), listOf("看雲的人", "天文迷")),
    )
    val LONG = listOf(
        GoalDef("chef", "成為很會煮飯的人", listOf("cook", "bake"), 20, skill = "料理"), GoalDef("reader", "讀完三十本書", listOf("read"), 30, skill = "閱讀"),
        GoalDef("gardener", "把植物養得很好", listOf("water", "garden", "plantchat"), 25, skill = "園藝"), GoalDef("artist", "畫滿一整本畫冊", listOf("doodle", "paint"), 20),
        GoalDef("tidy", "讓家一直乾乾淨淨", listOf("tidy", "sweep", "dishes"), 25, skill = "打掃"), GoalDef("fit", "練出好體力", listOf("stretch", "workout"), 20),
        GoalDef("maker", "做出一整櫃手作", listOf("craft", "origami"), 20),
    )
}
