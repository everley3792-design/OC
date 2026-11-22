package app.ocshimeji.sim.town

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.Pose
import kotlinx.serialization.Serializable
import kotlin.math.floor

/**
 * Weather and seasons (plan J-02, 5.4): decided by the date and the save's seed, never the network. Sunny, cloudy, rain, fog, snow
 * (snow only in winter). After rain an afternoon may bring a rainbow; the first snow of a winter is an event (plan D-06).
 */
object Weather {
    val ZH = mapOf("sunny" to "晴天", "cloudy" to "陰天", "rain" to "雨天", "fog" to "起霧", "snow" to "下雪")
    val SEASON_ZH = mapOf("spring" to "春", "summer" to "夏", "autumn" to "秋", "winter" to "冬")
    fun dayOf(minute: Double): Long = floor(minute / 1440).toLong()
    fun season(minute: Double): String = when (java.time.LocalDate.ofEpochDay(dayOf(minute)).monthValue) { 3, 4, 5 -> "spring"; 6, 7, 8 -> "summer"; 9, 10, 11 -> "autumn"; else -> "winter" }
    /** today's weather (the same all day) */
    fun of(seed: Long, minute: Double): String {
        val day = dayOf(minute); val r = Rng.of(seed, "weather:$day")
        val w = when (season(minute)) {
            "spring" -> listOf("sunny" to 45, "cloudy" to 25, "rain" to 20, "fog" to 10)
            "summer" -> listOf("sunny" to 55, "cloudy" to 20, "rain" to 25)
            "autumn" -> listOf("sunny" to 40, "cloudy" to 30, "rain" to 15, "fog" to 15)
            else -> listOf("sunny" to 30, "cloudy" to 30, "snow" to 25, "fog" to 15)
        }
        return r.weighted(w) { it.second.toDouble() }!!.first
    }
    /** a rainbow: a rainy day's afternoon, now and then */
    fun rainbow(seed: Long, minute: Double): Boolean { val h = ((minute % 1440) + 1440) % 1440 / 60; return of(seed, minute) == "rain" && h in 15.0..17.0 && Rng.of(seed, "rainbow:${dayOf(minute)}").chance(0.35) }
    val outdoor = setOf("sunny", "cloudy", "fog", "snow")
}

/** the ledger (plan I-01): one way money and things move, every change written down */
@Serializable class Tx(val minute: Double, val amount: Int, val reason: String, val who: String = "", val item: String = "", val qty: Int = 0)

/** what the shops sell (plan I-02): built-in, original goods */
data class Good(val id: String, val zh: String, val kind: String, val price: Int, val taste: String = "", val full: Float = 0f, val furniture: String = "")
object Goods {
    val FOOD = listOf(Good("pudding", "布丁", "food", 12, "甜", 25f), Good("onigiri", "飯糰", "food", 15, "鹹", 40f), Good("cake", "草莓蛋糕", "food", 30, "甜", 35f),
        Good("tea", "熱茶", "food", 8, "苦", 10f), Good("juice", "果汁", "food", 10, "酸", 15f), Good("chips", "辣味洋芋片", "food", 12, "辣", 15f),
        Good("coffee", "罐裝咖啡", "food", 12, "苦", 10f), Good("berry", "一盒草莓", "food", 18, "酸", 20f), Good("ramen", "泡麵", "food", 16, "鹹", 45f),
        Good("choco", "巧克力", "food", 10, "甜", 15f), Good("bun", "肉包", "food", 14, "鹹", 35f), Good("candy", "水果糖", "food", 6, "甜", 8f))
    val FURNITURE = listOf(Good("f:bed", "單人床", "furniture", 120, furniture = "bed"), Good("f:bed2", "雙人床", "furniture", 220, furniture = "bed2"),
        Good("f:sofa", "沙發", "furniture", 150, furniture = "sofa"), Good("f:table", "餐桌", "furniture", 100, furniture = "table"), Good("f:shelf", "書架", "furniture", 80, furniture = "shelf"),
        Good("f:plant", "盆栽", "furniture", 30, furniture = "plant"), Good("f:lamp", "落地燈", "furniture", 45, furniture = "lamp"), Good("f:rug", "地毯", "furniture", 60, furniture = "rug"),
        Good("f:tv", "電視", "furniture", 180, furniture = "tv"), Good("f:mirror", "鏡子", "furniture", 50, furniture = "mirror"), Good("f:bench", "長椅", "furniture", 70, furniture = "bench"),
        Good("f:garden", "小菜園", "furniture", 90, furniture = "garden"), Good("f:line", "曬衣架", "furniture", 40, furniture = "line"))
    /** what the garden gives (plan G-10): not sold in shops, only grown */
    val FARM = listOf(Good("v:tomato", "小番茄", "food", 6, "酸", 12f), Good("v:carrot", "紅蘿蔔", "food", 5, "甜", 14f), Good("v:pea", "豌豆", "food", 5, "鹹", 12f), Good("v:pumpkin", "南瓜", "food", 9, "甜", 30f))
    /** what the park gives (plan I-04): found, never bought */
    val WILD = listOf(Good("w:flower", "野花", "wild", 4), Good("w:stone", "漂亮的石頭", "wild", 3), Good("w:acorn", "橡實", "wild", 2), Good("w:berry", "野莓", "food", 3, "酸", 8f),
        Good("w:leaf", "紅葉", "wild", 2), Good("w:shell", "雪地裡的松果", "wild", 3))
    /** market day only (plan H-03): two of these join the grocery shelf */
    val MARKET = listOf(Good("m:jam", "手工果醬", "food", 22, "甜", 20f), Good("m:bread", "現烤麵包", "food", 18, "鹹", 35f), Good("m:honey", "蜂蜜蛋糕", "food", 26, "甜", 30f), Good("m:pickle", "醃黃瓜", "food", 12, "酸", 10f))
    /** festival goods (plan H-04): sold on that day only */
    val FESTIVAL = listOf(Good("e:petal", "花瓣糖", "food", 15, "甜", 10f), Good("e:ice", "刨冰", "food", 14, "甜", 12f), Good("e:yam", "烤地瓜", "food", 16, "甜", 30f), Good("e:cocoa", "熱可可", "food", 14, "甜", 12f),
        Good("f:lantern", "紙燈籠", "furniture", 40, furniture = "lantern"))
    /** R6 leftover: little things for the phone's desktop (grocery, every day) */
    val DESK = listOf(Good("d:blanket", "小毯子", "desk", 12), Good("d:plant", "迷你盆栽", "desk", 15), Good("d:note", "便條紙", "desk", 3))
    val ALL = (FOOD + FURNITURE + FARM + WILD + MARKET + FESTIVAL + DESK).associateBy { it.id }
    /** where a wild find comes from, by season */
    fun wildFor(season: String): List<Good> = WILD.filter { when (it.id) { "w:leaf" -> season == "autumn"; "w:shell" -> season == "winter"; "w:berry" -> season == "summer"; "w:flower" -> season == "spring" || season == "summer"; else -> true } }
    /** today's grocery shelf (6 of the foods, every day) and this week's furniture (6 kinds, every 7 days) */
    fun grocery(seed: Long, day: Long): List<Good> = Rng.of(seed, "grocery:$day").let { r -> FOOD.sortedBy { r.nextDouble() }.take(6) +
        (if (Town.marketDay(day)) MARKET.sortedBy { r.nextDouble() }.take(2) else emptyList()) + (Town.festival(day)?.let { f -> FESTIVAL.filter { it.id == f.good || it.id == "f:lantern" } } ?: emptyList()) + DESK }
    fun furniture(seed: Long, day: Long): List<Good> = Rng.of(seed, "furniture:${Math.floorDiv(day, 7L)}").let { r -> FURNITURE.sortedBy { r.nextDouble() }.take(7) }
}

/** places in town (plan H-01): the plaza, the grocery, the furniture shop, the café, the park */
data class Place(val id: String, val zh: String, val x: Float, val y: Float)
data class TownAct(val id: String, val zh: String, val place: String, val min: Int, val per: Map<Need, Float>, val cost: Int = 0, val outdoor: Boolean = false, val pose: Pose = Pose.STAND,
                   val weather: Set<String> = emptySet(), val season: Set<String> = emptySet(), val tags: Set<String> = emptySet(), val line: String = "")
object Town {
    /** positions on the town picture (0..1 of its width / height) */
    val PLACES = listOf(Place("plaza", "廣場", 0.5f, 0.55f), Place("grocery", "雜貨店", 0.18f, 0.3f), Place("furniture", "家具店", 0.5f, 0.22f), Place("cafe", "咖啡館", 0.82f, 0.3f), Place("park", "公園", 0.25f, 0.8f))
    val ACTS = listOf(
        TownAct("board", "看布告欄", "plaza", 15, mapOf(Need.FUN to 14f), line = "今天有什麼消息呢……"),
        TownAct("bench", "坐在長椅上", "plaza", 25, mapOf(Need.COMFORT to 20f, Need.FUN to 6f), pose = Pose.SIT, tags = setOf("lazy")),
        TownAct("fountain", "看噴水池", "plaza", 15, mapOf(Need.FUN to 16f), pose = Pose.LOOK, tags = setOf("dreamy")),
        TownAct("shop", "買東西", "grocery", 20, mapOf(Need.FUN to 10f), tags = setOf("food"), line = "買點好吃的回家。"),
        TownAct("browse", "逛家具店", "furniture", 25, mapOf(Need.FUN to 18f), pose = Pose.LOOK, tags = setOf("vain"), line = "這張沙發看起來好軟。"),
        TownAct("coffee", "喝咖啡", "cafe", 35, mapOf(Need.FUN to 16f, Need.SOCIAL to 20f, Need.ENERGY to 10f), cost = 8, pose = Pose.SIT, tags = setOf("chat"), line = "一杯熱的，謝謝。"),
        TownAct("clouds", "看雲", "park", 25, mapOf(Need.FUN to 18f, Need.COMFORT to 10f), outdoor = true, pose = Pose.LIE, weather = setOf("sunny", "cloudy"), tags = setOf("dreamy")),
        TownAct("walk", "散步", "park", 30, mapOf(Need.FUN to 14f, Need.COMFORT to 6f), outdoor = true, pose = Pose.WALK, tags = setOf("active")),
        TownAct("picnic", "野餐", "park", 40, mapOf(Need.FOOD to 40f, Need.FUN to 18f, Need.SOCIAL to 10f), outdoor = true, pose = Pose.EAT, weather = setOf("sunny"), tags = setOf("food")),
        TownAct("snowman", "堆雪人", "park", 30, mapOf(Need.FUN to 26f), outdoor = true, pose = Pose.TIDY, weather = setOf("snow"), tags = setOf("active"), line = "雪人要有紅蘿蔔鼻子！"),
        TownAct("puddle", "踩水坑", "park", 15, mapOf(Need.FUN to 20f, Need.HYGIENE to -15f), outdoor = true, pose = Pose.HAPPY, weather = setOf("rain"), tags = setOf("active"), line = "啪嗒！啪嗒！"),
        TownAct("leaves", "撿落葉", "park", 20, mapOf(Need.FUN to 16f), outdoor = true, pose = Pose.TIDY, season = setOf("autumn"), tags = setOf("dreamy")),
        TownAct("blossom", "看花", "park", 25, mapOf(Need.FUN to 18f, Need.COMFORT to 8f), outdoor = true, pose = Pose.LOOK, season = setOf("spring"), tags = setOf("dreamy")),
    ).associateBy { it.id }
    /** a gathering walk in the park (plan I-04) and the festival at the plaza (plan H-04) */
    val GATHER = TownAct("gather", "在公園撿東西", "park", 25, mapOf(Need.FUN to 16f), outdoor = true, pose = Pose.TIDY, tags = setOf("active"), line = "這裡好像有什麼……")
    val FEST = TownAct("festival", "逛祭典", "plaza", 60, mapOf(Need.FUN to 35f, Need.SOCIAL to 25f), pose = Pose.HAPPY, tags = setOf("chat"), line = "好熱鬧！")
    /** the market (plan H-03): every 7th day */
    fun marketDay(day: Long) = Math.floorMod(day, 7L) == 5L
    /** one original festival per season (plan H-04): a fixed day each year */
    data class Festival(val id: String, val zh: String, val month: Int, val dom: Int, val good: String, val desc: String)
    val FESTIVALS = listOf(Festival("petal", "花瓣夜", 4, 15, "e:petal", "廣場掛滿花瓣燈，大家吃花瓣糖"), Festival("firefly", "螢火蟲祭", 7, 20, "e:ice", "傍晚看螢火蟲、吃刨冰"),
        Festival("leaves", "落葉祭", 10, 25, "e:yam", "把落葉掃成一大堆，烤地瓜"), Festival("starlamp", "星燈節", 12, 20, "e:cocoa", "點起星星燈，喝熱可可"))
    fun festival(day: Long): Festival? { val d = java.time.LocalDate.ofEpochDay(day); return FESTIVALS.firstOrNull { it.month == d.monthValue && it.dom == d.dayOfMonth } }
    const val TRAVEL = 15.0          /* game minutes from the door to town */
    fun place(id: String) = PLACES.first { it.id == id }
    fun act(id: String): TownAct? = ACTS[id] ?: when (id) { "gather" -> GATHER; "festival" -> FEST; else -> null }
    fun acts(weather: String, season: String, day: Long = -1) = (ACTS.values + (if (weather != "rain") listOf(GATHER) else emptyList()) + (if (day >= 0 && festival(day) != null) listOf(FEST) else emptyList())).filter { (it.weather.isEmpty() || weather in it.weather) && (it.season.isEmpty() || season in it.season) && !(it.outdoor && weather == "rain" && it.id != "puddle") }

    /** town events (plan 13.9, first 25): two residents at the same place */
    data class TownEvent(val id: String, val zh: String, val place: String, val script: String, val like: Int = 2, val weather: Set<String> = emptySet(), val season: Set<String> = emptySet())
    val EVENTS = listOf(
        TownEvent("latte", "拉花比賽", "cafe", "A:看我的拉花，一隻貓！@HAPPY / B:……那是馬鈴薯吧。 / A:是貓！#anger / B:好啦，是很可愛的馬鈴薯貓。#heart"),
        TownEvent("cakeshare", "分一塊蛋糕", "cafe", "A:這個蛋糕好大，一起吃？ / B:那我要草莓那一半。@HAPPY#sparkle", like = 3),
        TownEvent("meetcafe", "在咖啡館巧遇", "cafe", "A:咦，你也來了？ / B:好巧！坐一起吧。@HAPPY#heart", like = 3),
        TownEvent("menu", "看不懂菜單", "cafe", "A:「月光漂浮系列」是什麼？ / B:我也不知道，點了就知道了。 / A:……是一杯牛奶。#sweat", like = 1),
        TownEvent("window", "隔著窗戶揮手", "cafe", "A:（隔著玻璃揮手）@HAPPY / B:（也揮揮手，差點打翻杯子）#sweat", like = 2),
        TownEvent("clouds2", "一起看雲", "park", "A:那朵雲像不像一條魚？@LOOK / B:像一條在睡午覺的魚。@LOOK#sparkle", like = 3, weather = setOf("sunny", "cloudy")),
        TownEvent("butterfly", "追蝴蝶", "park", "A:有蝴蝶！@HAPPY / B:等等我！ / A:……飛走了。#sweat", like = 2, season = setOf("spring", "summer")),
        TownEvent("picnicshare", "野餐分享", "park", "A:我帶了飯糰，分你一個。 / B:那我的果汁分你一半。@EAT#heart", like = 4, weather = setOf("sunny")),
        TownEvent("snowball", "打雪仗", "park", "A:看招！@SWING / B:哇！好冰！@DIZZY#shock / B:換我了！@SWING#sparkle", like = 2, weather = setOf("snow")),
        TownEvent("puddles", "一起踩水坑", "park", "A:我跳！@HAPPY / B:你濺到我了！@ANGRY#anger / B:……換我跳！@HAPPY", like = 2, weather = setOf("rain")),
        TownEvent("leafpile", "落葉堆", "park", "A:我堆了一座落葉山。 / B:（整個人跳進去）@HAPPY#sparkle / A:我的山……#gloom", like = 1, season = setOf("autumn")),
        TownEvent("blossoms", "花瓣雨", "park", "A:風一吹，花瓣都下來了。@LOOK / B:好像下雪喔。@LOOK#sparkle", like = 3, season = setOf("spring")),
        TownEvent("napgrass", "草地上睡著", "park", "A:（躺在草地上）zzz@LIE / B:（在旁邊也躺下來）……zzz@LIE#heart", like = 2, weather = setOf("sunny", "cloudy")),
        TownEvent("wish", "對噴水池許願", "plaza", "A:（閉上眼睛許願）@DAYDREAM / B:許了什麼？ / A:說出來就不靈了。#sparkle", like = 2),
        TownEvent("gossipboard", "布告欄前的八卦", "plaza", "A:你看布告欄，好像有新消息。@LOOK / B:真的耶，我們去看看！@HAPPY", like = 2),
        TownEvent("benchnap", "長椅上打瞌睡", "plaza", "A:（坐著坐著頭一點一點）@SIT / B:（把肩膀借給A）#heart", like = 3),
        TownEvent("pigeons", "鴿子圍過來", "plaza", "A:鴿子好多！@SHY#shock / B:牠們好像在等你的麵包屑。 / A:我沒有麵包啦！#sweat", like = 1),
        TownEvent("umbrella", "共撐一把傘", "plaza", "A:下雨了……你沒帶傘？ / B:……忘了。 / A:那一起撐吧。@SHY#heart", like = 4, weather = setOf("rain")),
        TownEvent("lastpudding", "搶最後一盒布丁", "grocery", "A:最後一盒布丁！ / B:我先看到的！@ANGRY#anger / A:……那就猜拳！#fire", like = 0),
        TownEvent("sample", "一起試吃", "grocery", "A:這個試吃的好好吃。@EAT / B:我們再繞一圈回來吃一次？#sparkle", like = 2),
        TownEvent("queue", "結帳排隊", "grocery", "A:你也買了布丁？@LOOK / B:嘘，不要說出去。#sweat", like = 2),
        TownEvent("trysofa", "試坐沙發", "furniture", "A:（陷進沙發裡）……我不想起來了。@LIE / B:這是店裡的沙發啦！#sweat", like = 2),
        TownEvent("color", "爭論顏色", "furniture", "A:這個顏色好看。 / B:那個比較好看。@ANGRY / A:……那就兩個都不要買。#gloom", like = 1),
        TownEvent("dreamroom", "想像中的房間", "furniture", "A:如果我的房間有這座書架…… / B:那就變成圖書館了。@HAPPY#sparkle", like = 2),
        TownEvent("lamp", "被燈光照亮", "furniture", "A:這盞燈好溫暖。@LOOK / B:照得你看起來特別好看。#heart", like = 3),
    )
}

/** the town's saved state: stock, the market stall, public corners, the workshop, the news */
@Serializable
class TownState(
    /** custom items on the market stall: item id → price */
    val stall: MutableMap<String, Int> = mutableMapOf(),
    /** public corners (plan 13.9): corner id → furniture / item placed there by you */
    val corners: MutableMap<String, String> = mutableMapOf(),
    /** commissions in progress (plan 12.6 委託製作) */
    val jobs: MutableList<Job> = mutableListOf(),
    /** your works: item id → made / sold / ratings */
    val works: MutableMap<String, Work> = mutableMapOf(),
    /** today's news (plan 13.9 新聞速報) and when it was written */
    var news: List<String> = emptyList(), var newsDay: Long = -1,
    /** the first snow of this winter already happened (plan D-06) */
    var firstSnowYear: Int = -1,
) { companion object { val CORNERS = linkedMapOf("plaza1" to "廣場東側", "plaza2" to "廣場西側", "park1" to "公園草地", "park2" to "公園小路") } }
/** a commission: `need` = minutes of crafting the maker must put in; `worked` grows while they craft */
@Serializable class Job(val id: Int, val item: String, val maker: String, val start: Double, val need: Double, val cost: Int, var worked: Double = 0.0)
@Serializable class Work(var made: Int = 0, var sold: Int = 0, val ratings: MutableList<Int> = mutableListOf(), val comments: MutableList<String> = mutableListOf())
/** a resident's trip to town (plan B-12): go → at a place → (maybe another) → back, with travel time */
@Serializable class Outing(var stage: String, var place: String, var act: String, var until: Double, var acts: Int = 0)
/** one daily goal (plan I-09) */
@Serializable class Goal(val kind: String, val target: String, val text: String, val reward: Int, var done: Boolean = false)
/** a piece of furniture as placed in this home (plan G-01); `owned` = bought or made (it goes to storage when removed or moving) */
@Serializable class PieceRec(val kind: String, val x: Int, val y: Int, val room: String, val owned: Boolean = false, val flip: Boolean = false)
