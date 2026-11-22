package app.ocshimeji.sim.social

import app.ocshimeji.sim.Rng
import kotlinx.serialization.Serializable

/**
 * 1.7.0 (R7 first batch, plan A/B/C/D/N/Q): the data behind `life/Drama` — dreams, fears, sickness, crazes, whims, debates, songs,
 * gossip, nicknames, shared secrets, cliques, group activities, contests, romance staging, cook-offs, blackout nights, surprise parties.
 * Every line is plain (我／你) and goes through `Speech.say` when spoken. All original.
 */

// ---------------- saved state ----------------
@Serializable class Dream(val id: String, var step: Int = 0, var done: Boolean = false)
@Serializable class Sick(val kind: String, val until: Long, var cared: Int = 0)
@Serializable class Craze(val act: String, val until: Long, val from: String = "")
@Serializable class Whim(val role: String, val day: Long)
@Serializable class Gossip(val id: Int, val about: String, var text: String, val known: MutableList<String> = mutableListOf(), var version: Int = 0, val minute: Double = 0.0)
@Serializable class SharedSecret(val a: String, val b: String, val text: String, var lastGlance: Double = 0.0)
@Serializable class Clique(val name: String, val members: List<String>, val since: Long, var lastMeet: Long = -99)
@Serializable class Decision(val id: Int, val kind: String, val who: String, val other: String, val text: String, val options: List<String>, val since: Double, val data: String = "")
@Serializable class Party(val who: String, val day: Long, val helpers: MutableList<String> = mutableListOf(), var done: Boolean = false)
@Serializable
class DramaState(
    val dreams: MutableMap<String, Dream> = mutableMapOf(),
    /** fear word → times someone stayed with them while scared ("pid:fear") */
    val courage: MutableMap<String, Int> = mutableMapOf(),
    val beaten: MutableMap<String, MutableList<String>> = mutableMapOf(),
    val sick: MutableMap<String, Sick> = mutableMapOf(),
    val crazes: MutableMap<String, Craze> = mutableMapOf(),
    val whims: MutableMap<String, Whim> = mutableMapOf(),
    val gossip: MutableList<Gossip> = mutableListOf(),
    /** "a>b" → the nickname a gave b */
    val nicks: MutableMap<String, String> = mutableMapOf(),
    val secrets: MutableList<SharedSecret> = mutableListOf(),
    val cliques: MutableList<Clique> = mutableListOf(),
    /** "a>b" → wins of a over b */
    val wins: MutableMap<String, Int> = mutableMapOf(),
    val decisions: MutableList<Decision> = mutableListOf(),
    val parties: MutableList<Party> = mutableListOf(),
    /** "blackout" on a stormy night; the day it is */
    var night: String = "", var nightDay: Long = -1,
    val seen: MutableMap<String, Double> = mutableMapOf(),
    var nextId: Int = 1,
    var lastTick: Double = -1.0, var lastDay: Long = -1,
)

// ---------------- A-08 dreams ----------------
/** a long-term dream: which count it follows (a `Journal` key, or "friends" / "gooddays") and how far */
data class DreamDef(val id: String, val zh: String, val words: List<String>, val metric: String, val target: Int, val steps: List<String>)
object Dreams {
    val ALL = listOf(
        DreamDef("cake", "做出最好吃的蛋糕", listOf("蛋糕", "甜點", "料理", "廚"), "act:cook", 12, listOf("今天練習了打蛋，好像有點樣子了。", "烤出來的蛋糕沒有塌下去！", "這次的蛋糕，連自己都覺得好吃。")),
        DreamDef("shop", "開一間小店", listOf("店"), "craft", 6, listOf("我在想小店要賣什麼。", "已經做了好幾樣可以賣的東西了。", "我的小店……真的開張了！")),
        DreamDef("friends", "交到很多朋友", listOf("朋友"), "friends", 3, listOf("今天又多了一個可以說話的人。", "我好像越來越不怕跟人說話了。", "我有好多好朋友了！")),
        DreamDef("book", "寫一本書", listOf("書", "寫"), "act:read", 12, listOf("我想到了一個故事的開頭。", "故事寫到一半了。", "寫完了！是一個關於這個家的故事。")),
        DreamDef("travel", "環遊世界", listOf("世界", "旅", "海"), "town", 10, listOf("先從小鎮開始認識吧。", "小鎮的每一條路我都走過了。", "總有一天要去更遠的地方——我已經準備好了。")),
        DreamDef("draw", "成為畫家", listOf("畫"), "act:doodle", 10, listOf("今天的塗鴉有點像樣了。", "大家說我畫得很可愛。", "這張畫，我想掛在牆上。")),
        DreamDef("garden", "種出一片花園", listOf("花", "植物", "園"), "act:water", 12, listOf("葉子長出來了。", "開了第一朵花。", "家裡變成一座小花園了。")),
        DreamDef("happy", "每天都過得開開心心", emptyList(), "gooddays", 10, listOf("今天也很好。", "好像每天都有一點點開心的事。", "我覺得我的夢想已經實現了。")),
    )
    fun of(dream: String): DreamDef? = if (dream.isBlank()) null else ALL.firstOrNull { d -> d.words.any { dream.contains(it) } } ?: ALL.last()
}

// ---------------- A-11 fears ----------------
data class FearDef(val id: String, val words: List<String>, val zh: String, val line: String, val brave: String)
object Fears {
    val ALL = listOf(
        FearDef("thunder", listOf("雷"), "打雷", "（縮成一團）雷、雷好大聲……", "打雷了……可是，好像沒那麼可怕了。"),
        FearDef("dark", listOf("黑"), "黑暗", "好黑……有人在嗎？", "關燈也沒關係，我知道大家都在。"),
        FearDef("bug", listOf("蟲"), "蟲", "有、有蟲！不要過來！", "只是一隻小蟲嘛……出去吧。"),
        FearDef("alone", listOf("一個人", "孤單"), "一個人", "大家都不在……好安靜。", "一個人待一下下，也可以。"),
        FearDef("height", listOf("高"), "很高的地方", "不要往下看、不要往下看……", "高一點的地方，其實風景很好。"),
    )
    fun of(word: String) = ALL.firstOrNull { f -> f.words.any { word.contains(it) } }
    /** times someone has to stay with them before it gets better */
    const val COURAGE = 3
}

// ---------------- B-09 sickness ----------------
data class SickDef(val id: String, val zh: String, val days: Int, val line: String, val well: String)
object Sickness {
    val ALL = listOf(SickDef("cold", "感冒", 2, "哈啾！……好像淋雨感冒了。", "感冒好了！謝謝大家照顧我。"),
        SickDef("tired", "沒睡好", 1, "頭昏昏的……昨天太晚睡了。", "睡飽了，頭不昏了。"),
        SickDef("tummy", "吃太飽肚子痛", 1, "嗚……吃太多了，肚子好痛。", "肚子不痛了，下次會吃慢一點。")).associateBy { it.id }
}

// ---------------- B-13 crazes, D-02 whims ----------------
object Crazes {
    /** activities that can become a craze, with how it is said */
    val ACTS = mapOf("doodle" to "畫畫", "dance" to "跳舞", "origami" to "摺紙", "hum" to "唱歌", "stretch" to "做體操", "cloudwatch" to "看雲", "sweep" to "掃地", "read" to "看書", "music" to "聽音樂", "plantchat" to "跟植物說話")
}
data class WhimDef(val role: String, val start: String, val lines: List<String>)
object Whims {
    val ALL = listOf(
        WhimDef("偵探", "我決定了，今天開始我是偵探！", listOf("嗯……這裡有線索。", "真相只有一個……大概。", "（拿放大鏡看地板）")),
        WhimDef("公主", "今天我是公主，大家要叫我公主殿下。", listOf("平身。", "本公主想喝茶。", "（優雅地轉了一圈）")),
        WhimDef("廚師", "今天的我是天才廚師！", listOf("火候……剛剛好。", "加一點點愛心。", "這道菜叫做「今天的心情」。")),
        WhimDef("忍者", "從現在起，我是忍者。噓——", listOf("（躲在沙發後面）", "忍法・隱身之術！", "……你看不到我。")),
        WhimDef("老師", "今天我來當老師，大家坐好！", listOf("這題誰會？", "上課不可以睡覺喔。", "很好，加一顆星星。")),
        WhimDef("探險家", "今天要去探險！先從客廳開始。", listOf("發現了新大陸……是沙發底下。", "地圖上沒有這個地方！", "裝備確認完畢。")),
        WhimDef("詩人", "今天我說話都要押韻。", listOf("天空藍藍，心情甜甜。", "早安早安，吃飯吃飯。", "風在吹，我在追。")),
        WhimDef("管家", "今天我是這個家的管家。", listOf("請慢用。", "房間已經整理好了。", "需要什麼請吩咐。")),
    )
}

// ---------------- D-04 debates ----------------
data class Debate(val topic: String, val a: String, val b: String)
object Debates {
    val ALL = listOf(Debate("布丁要不要加焦糖", "當然要加焦糖", "原味才是王道"), Debate("西瓜要不要加鹽", "加一點點鹽更甜", "加鹽是邪道"),
        Debate("早餐吃甜的還是鹹的", "甜的才有精神", "鹹的才吃得飽"), Debate("貓派還是狗派", "貓咪最好", "狗狗最好"),
        Debate("夏天好還是冬天好", "夏天可以吃冰", "冬天可以窩在被子裡"), Debate("襪子要先穿左腳還是右腳", "左腳先", "右腳先"),
        Debate("吐司要不要切邊", "切邊比較好吃", "邊才是精華"), Debate("下雨天出門好不好", "雨天散步很浪漫", "雨天就該待在家"))
}

// ---------------- C-07 nicknames, C-08 secrets ----------------
object Nicks {
    /** ways of turning a name into a nickname ({1} = the last character, {0} = the first) */
    val PATTERNS = listOf("小{1}", "{1}{1}", "阿{1}", "{0}仔", "{1}寶", "大{0}", "{0}{0}醬")
    /** names that already start with 小／阿／大 use their last character (no 「阿阿醬」) */
    fun make(name: String, r: Rng): String { val n = name.ifBlank { "朋友" }; val head = if (n.length >= 2 && n[0] in "小阿大老") n.last() else n.first()
        val ps = if (n.length >= 2 && n[0] in "小阿大老") PATTERNS.filter { !it.contains("{0}") || it == "{0}仔" } else PATTERNS
        return r.pick(ps).replace("{0}", head.toString()).replace("{1}", n.last().toString()) }
}
object Secrets {
    val ALL = listOf("沙發底下的秘密基地", "半夜一起偷吃的布丁", "一起養在窗邊的小蝸牛", "藏在書架後面的寶物盒", "只有兩個人知道的暗號", "那天一起看到的流星", "偷偷練習的雙人舞")
}

// ---------------- C-09 cliques, C-10 group activities ----------------
object Cliques { val NAMES = listOf("點心同好會", "午後散步團", "深夜聊天社", "沙發三人組", "晴天俱樂部", "星星觀察隊", "早起體操會") }
/** an activity everyone at home does together; `cond` read by `Drama.groupOk` */
data class GroupDef(val id: String, val zh: String, val cond: String, val from: Int, val to: Int, val lines: List<String>, val fun_: Float = 20f)
object Groups {
    val ALL = listOf(
        GroupDef("picnic", "野餐", "sunny", 10, 15, listOf("今天天氣好好，來野餐吧！", "我帶了飯糰！", "坐在草地上吃東西最棒了。", "好想每天都這樣。")),
        GroupDef("pajama", "睡衣派對", "", 20, 23, listOf("睡衣派對開始！", "枕頭大戰——！", "我們來說悄悄話。", "今天不想睡了。")),
        GroupDef("campfire", "營火晚會", "clear", 19, 22, listOf("火好溫暖。", "來烤棉花糖吧！", "唱首歌吧。", "星星好多。")),
        GroupDef("cleanup", "大掃除", "messy", 9, 17, listOf("大家一起來大掃除！", "我負責擦窗戶！", "找到了好久不見的襪子。", "家裡亮晶晶的！"), fun_ = 8f),
        GroupDef("birthdayparty", "生日派對", "birthday", 17, 22, listOf("生日快樂！", "許個願吧！", "蛋糕來囉！", "謝謝大家……我好開心。"), fun_ = 30f),
        GroupDef("ghosts", "點蠟燭講鬼故事", "blackout", 20, 23, listOf("停電了……大家都在嗎？", "我來講一個鬼故事……", "不、不要嚇我啦！", "大家擠在一起，就不怕了。"), fun_ = 18f),
        GroupDef("meetup", "小圈圈的固定聚會", "clique", 14, 21, listOf("今天是我們的聚會日！", "上次說到哪了？", "下次也要一起喔。"), fun_ = 16f),
    ).associateBy { it.id }
}

// ---------------- C-13 contests, Q-08 cook-offs ----------------
data class ContestDef(val id: String, val zh: String, val skill: String?, val axis: Int)
object Contests {
    /** `axis`: which personality axis helps (1 = active); `skill` from CharSpec.SKILLS */
    val ALL = listOf(ContestDef("eat", "比誰吃得快", null, 1), ContestDef("run", "比誰跑得快", null, 1), ContestDef("arm", "比腕力", null, 1),
        ContestDef("clean", "比誰整理得快", "打掃", 2), ContestDef("quiz", "猜謎比賽", "閱讀", 2), ContestDef("stare", "比誰先笑出來", null, 3))
    val DISHES = listOf("咖哩" to "鹹", "鬆餅" to "甜", "番茄蛋花湯" to "酸", "麻婆豆腐" to "辣", "抹茶布丁" to "苦", "炒飯" to "鹹", "水果塔" to "甜")
}

// ---------------- C-05 gossip ----------------
object Rumors {
    /** how a piece of news changes as it is passed on (funny, never hurtful) */
    val GARBLE = listOf("吵架" to "大吵一架", "一起" to "偷偷一起", "聊天" to "聊到半夜", "吃了" to "一口氣吃了三個", "看" to "盯著看了一整天", "比賽" to "世紀大對決", "感冒" to "感冒還一直打噴嚏", "生日" to "盛大的生日")
    fun garble(text: String, r: Rng): String { val hits = GARBLE.filter { text.contains(it.first) && !text.contains(it.second) }; if (hits.isEmpty()) return text + "（好像還有後續）"; val (a, b) = r.pick(hits); return text.replaceFirst(a, b) }
}

// ---------------- D-08 what-if questions ----------------
object WhatIf {
    /** key, question, options — the answers are remembered (`Person.knows`) and come back in conversation */
    val ALL = listOf(
        Triple("if_food", "如果可以變成一種食物，你想變成什麼？", listOf("布丁", "飯糰", "蛋糕")), Triple("if_animal", "如果明天醒來變成動物，你想當什麼？", listOf("貓", "鳥", "海豚")),
        Triple("if_power", "如果可以有一種超能力，你要什麼？", listOf("瞬間移動", "讀心術", "停止時間")), Triple("if_season", "如果一年只能有一個季節，你選哪個？", listOf("春天", "夏天", "秋天", "冬天")),
        Triple("if_color", "如果世界只剩一種顏色，你希望是什麼顏色？", listOf("藍色", "粉紅色", "綠色")), Triple("if_island", "如果去無人島只能帶一樣東西？", listOf("書", "枕頭", "點心")),
        Triple("if_time", "如果可以回到過去一天，你想回到哪天？", listOf("第一次見面那天", "小時候", "不回去")), Triple("if_house", "如果可以住在任何地方？", listOf("樹屋", "海底", "雲上面")),
        Triple("if_job", "如果可以做一天別的工作？", listOf("麵包師傅", "太空人", "圖書館員")), Triple("if_rain", "如果天上下的不是雨，你希望是什麼？", listOf("糖果", "花瓣", "泡泡")),
        Triple("if_size", "如果可以變得很小或很大？", listOf("很小", "很大", "都不要")), Triple("if_talk", "如果可以跟一種東西說話？", listOf("植物", "星星", "家具")),
        Triple("if_meal", "如果只能吃一種東西一輩子？", listOf("白飯", "麵", "麵包")), Triple("if_trip", "如果明天放假一整天？", listOf("出去玩", "在家睡覺", "跟大家一起")),
        Triple("if_song", "如果你的人生有一首主題曲，會是什麼感覺？", listOf("輕快的", "溫柔的", "很熱血的")), Triple("if_star", "如果流星只實現一個願望？", listOf("大家健康", "一直在一起", "吃不完的點心")),
        Triple("if_room", "如果可以重新佈置房間？", listOf("全部粉紅色", "放滿植物", "超大的床")), Triple("if_name", "如果可以替自己改一個名字？", listOf("不要改", "叫流星", "叫小可愛")),
        Triple("if_robot", "如果家裡有一台機器人，你想要它做什麼？", listOf("打掃", "煮飯", "陪你聊天")), Triple("if_wing", "如果長出翅膀，第一件事做什麼？", listOf("飛到屋頂", "去看海", "嚇大家一跳")),
        Triple("if_invis", "如果可以隱形一小時？", listOf("偷吃點心", "偷聽大家說話", "睡一覺")), Triple("if_cook", "如果要煮一道菜給我吃？", listOf("咖哩", "蛋包飯", "泡麵")),
        Triple("if_hobby", "如果明天開始學一樣新東西？", listOf("樂器", "畫畫", "跳舞")), Triple("if_wish", "如果我可以實現你一個小願望？", listOf("摸摸頭", "一起散步", "說晚安")),
        Triple("if_dream", "如果今晚可以選擇做什麼夢？", listOf("飛起來", "吃大餐", "跟你冒險")),
    )
}

// ---------------- D-05 improvised songs, N-04 theme melodies ----------------
/**
 * Tiny original melodies: MIDI-like note numbers (60 = middle C, 0 = rest) on a major pentatonic, from a seed. A theme is fixed per
 * character (their name and voice); an improvised song is different every time (the world's seed and the minute).
 */
object Tunes {
    private val PENTA = intArrayOf(0, 2, 4, 7, 9)
    fun melody(r: Rng, len: Int, root: Int): IntArray { var i = r.nextInt(5); var oct = 0
        return IntArray(len) { k -> if (k > 0 && k % 4 == 3 && r.chance(0.3)) 0 else { val step = r.pick(listOf(-2, -1, -1, 0, 1, 1, 2)); i += step
            if (i < 0) { i += 5; oct-- }; if (i > 4) { i -= 5; oct++ }; oct = oct.coerceIn(-1, 1); root + PENTA[i] + 12 * oct } } }
    /** a character's own little theme (the same every time) */
    fun theme(name: String, pitch: Float): IntArray = melody(Rng(Rng.hash("theme:$name")), 8, 60 + ((pitch - 1f) * 12).toInt().coerceIn(-7, 7))
    /** a song made up on the spot */
    fun improv(seed: Long, key: String, pitch: Float): IntArray = melody(Rng.of(seed, "song:$key"), 12, 60 + ((pitch - 1f) * 12).toInt().coerceIn(-7, 7))
    val TITLES = listOf("{物}之歌", "給{物}的小夜曲", "今天的{物}", "{物}在跳舞", "關於{物}的事", "{物}進行曲")
}
