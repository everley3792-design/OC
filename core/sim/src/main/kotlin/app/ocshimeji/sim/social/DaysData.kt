package app.ocshimeji.sim.social

import kotlinx.serialization.Serializable

/**
 * 1.9.0 (R7 last batch, 「家與小鎮」): recipes, anniversaries and dates, the town feed, little tools for you, day trips,
 * everyone's keepsake cabinet, the memory frame, a desktop diary. Saved in `Life.days`; run by `life/Days`. All original text.
 */

// ---------------- saved state ----------------
/** Q-01: a post on the town feed; `likes` = who liked it ("you" = you) */
@Serializable class Post(val id: Int, val who: String, val minute: Double, val text: String, val icon: String, val likes: MutableList<String> = mutableListOf())
/** Q-03: a day trip in progress or done */
@Serializable class Trip(val id: Int, val place: String, val who: List<String>, val start: Double, val until: Double, var back: Boolean = false, var souvenir: String = "")
/** Q-11: a keepsake in someone's cabinet */
@Serializable class Keepsake(val id: String, val zh: String, val icon: String, val day: Long, val why: String)
@Serializable
class DaysState(
    /** I-03: recipes found (by cooking them once) */
    val recipes: MutableSet<String> = mutableSetOf(),
    /** J-04: when each person moved in, and when each pair first became friends / lovers ("a|b|好友") */
    val since: MutableMap<String, Long> = mutableMapOf(),
    val feed: MutableList<Post> = mutableListOf(),
    val trips: MutableList<Trip> = mutableListOf(),
    val cabinet: MutableMap<String, MutableList<Keepsake>> = mutableMapOf(),
    /** Q-02: tool id → the day it was last used */
    val tools: MutableMap<String, Long> = mutableMapOf(),
    /** F-12: minutes on the phone's desktop today, per person */
    val deskMin: MutableMap<String, Double> = mutableMapOf(),
    var nextId: Int = 1, var lastTick: Double = -1.0, var lastDay: Long = -1,
)

// ---------------- I-03 recipes ----------------
/** a recipe: what it needs from storage (good id → how many), the dish it makes (a `Dishes` entry) */
data class Recipe(val id: String, val zh: String, val needs: Map<String, Int>, val dish: String, val hint: String)
object Recipes {
    val ALL = listOf(
        Recipe("pumpkinsoup", "南瓜濃湯", mapOf("v:pumpkin" to 1), "r:pumpkinsoup", "菜園的南瓜"),
        Recipe("tomatoegg", "番茄炒蛋", mapOf("v:tomato" to 2), "r:tomatoegg", "兩顆小番茄"),
        Recipe("carrotcake", "紅蘿蔔蛋糕", mapOf("v:carrot" to 2), "r:carrotcake", "兩根紅蘿蔔"),
        Recipe("peasoup", "豌豆濃湯", mapOf("v:pea" to 2), "r:peasoup", "兩把豌豆"),
        Recipe("gardenstew", "菜園燉菜", mapOf("v:carrot" to 1, "v:pea" to 1, "v:tomato" to 1), "r:gardenstew", "紅蘿蔔、豌豆、小番茄各一"),
        Recipe("berryjam", "野莓果醬吐司", mapOf("w:berry" to 2), "r:berryjam", "公園撿的野莓兩顆"),
        Recipe("acorncookie", "橡實餅乾", mapOf("w:acorn" to 3), "r:acorncookie", "三顆橡實"),
        Recipe("honeytoast", "蜂蜜厚片", mapOf("m:honey" to 1), "r:honeytoast", "市集的蜂蜜蛋糕"),
    ).associateBy { it.id }
    fun byDish(dish: String) = ALL.values.firstOrNull { it.dish == dish }
}

// ---------------- J-04 anniversaries / dates ----------------
object Anniv {
    /** every this many days together (a "month" here) */
    const val MONTH = 30L
    val DATES = listOf("一起去咖啡館坐了一下午", "牽著手在公園散步", "在屋頂上看星星", "一起做了一頓晚餐", "交換了寫給對方的小卡片", "在長椅上分一副耳機聽歌")
}

// ---------------- Q-01 the town feed ----------------
object Feed {
    const val MAX = 60
    /** a log line → a post (the way a resident would write it) */
    val FRAMES = listOf("今天{事}！", "{事}～", "記錄一下：{事}。", "{事}。好開心。", "#今天的我 {事}")
}

// ---------------- Q-02 your little tools ----------------
data class Tool(val id: String, val zh: String, val desc: String, val icon: String)
object Tools {
    val ALL = listOf(
        Tool("gift", "天降禮物", "一份小禮物掉在家門口（放進收納）", "gift"),
        Tool("luck", "幸運的一天", "今天大家心情都會好一點", "star"),
        Tool("dream", "好夢", "今晚大家都會做好夢", "moon"),
        Tool("star", "流星", "晚上的天空劃過一顆流星，大家會許願", "sparkle"),
    ).associateBy { it.id }
    val GIFTS = listOf("cake", "pudding", "berry", "choco", "candy")
    val WISHES = listOf("希望明天也是好天氣", "希望大家都健健康康", "希望可以吃到好吃的布丁", "希望永遠住在這裡", "希望夢想快點實現")
}

// ---------------- Q-03 day trips ----------------
data class TripPlace(val id: String, val zh: String, val hours: Double, val cost: Int, val souvenir: String, val souvenirIcon: String, val lines: List<String>, val weather: Set<String> = emptySet())
object Trips {
    val ALL = listOf(
        TripPlace("beach", "海邊", 8.0, 40, "海邊的貝殼", "drop", listOf("在沙灘上寫了大家的名字", "被浪追著跑", "撿了一大把貝殼"), setOf("sunny", "cloudy")),
        TripPlace("hill", "風車山丘", 7.0, 30, "風車形狀的書籤", "leaf", listOf("在山丘上吹風", "數著轉動的風車", "在草地上滾下坡"), setOf("sunny", "cloudy")),
        TripPlace("spring", "溫泉小鎮", 9.0, 60, "溫泉饅頭的包裝紙", "cup", listOf("泡溫泉泡到臉紅", "喝了一瓶冰牛奶", "穿著浴衣散步")),
        TripPlace("forest", "森林小屋", 8.0, 35, "一片很大的葉子", "plant", listOf("在森林裡聽鳥叫", "找到一棵好大的樹", "在小屋裡喝熱湯")),
    ).associateBy { it.id }
}

// ---------------- G-08 the memory frame ----------------
object Frame {
    val LOOKS = listOf("看著相框裡的照片，想起了{事}", "對著相框笑了一下：{事}", "摸了摸相框：那天{事}")
}
