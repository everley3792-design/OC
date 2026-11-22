package app.ocshimeji.sim.social

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.Rel
import kotlinx.serialization.Serializable

/**
 * 1.8.0 (R7 second batch, 「和你」): messages, photos, notes, time capsules, house rules, little games, scenario starts.
 * Saved in `Life.you`; run by `life/WithYou`. All original text.
 */

// ---------------- saved state ----------------
/** E-07: a message from a resident; `options` = what you can answer, `reply` = which one you chose (−1 = not yet) */
@Serializable class Msg(val id: Int, val from: String, val minute: Double, val kind: String, val text: String, val options: List<String>, var reply: Int = -1, val key: String = "")
/** E-09: a photo is kept as what was in it (who, poses, frame, filter, stickers), redrawn when you look — never pixels in the save */
@Serializable class Photo(val id: Int, val minute: Double, val who: List<String>, val poses: List<String>, val filter: String, val frame: String, val stickers: List<String>, val sky: String, val hour: Double, var caption: String = "")
/** P-04: letters to open together thirty days later */
@Serializable class Capsule(val id: Int, val day: Long, val openDay: Long, val yours: String, val theirs: MutableMap<String, String> = mutableMapOf(), var opened: Boolean = false)
@Serializable
class YouState(
    val messages: MutableList<Msg> = mutableListOf(),
    val photos: MutableList<Photo> = mutableListOf(),
    val capsules: MutableList<Capsule> = mutableListOf(),
    /** P-11: the house rules you set (`HouseRules` ids) */
    val rules: MutableList<String> = mutableListOf(),
    /** L-03 / L-04: best scores */
    val best: MutableMap<String, Int> = mutableMapOf(),
    val seen: MutableMap<String, Double> = mutableMapOf(),
    var nextId: Int = 1, var lastTick: Double = -1.0, var lastDay: Long = -1,
)

// ---------------- E-07 messages ----------------
object Messages {
    val GOODNIGHT = listOf("今天也謝謝你陪我。晚安。", "要睡了嗎？我也是。晚安～", "明天見。做個好夢。", "（傳來一張棉被的照片）晚安！")
    val SHARE = listOf("跟你說，{事}。", "你知道嗎？{事}！", "今天的事：{事}。想讓你知道。")
    val COMPLAIN = listOf("唉，今天{心情}……", "可以聽我抱怨一下嗎？{心情}。", "有點不開心……{心情}。")
    val OPTIONS = mapOf("goodnight" to listOf("晚安", "明天見", "好好睡"), "share" to listOf("好棒！", "然後呢？", "我也想看"), "complain" to listOf("抱抱", "怎麼了？", "明天會更好"))
    val REPLIES = mapOf("goodnight" to "（開心地鑽進被子裡）", "share" to "嘿嘿，下次再跟你說。", "complain" to "……謝謝你，好多了。")
}

// ---------------- P-03 notes ----------------
object Notes { val TAGS = listOf("好笑", "感動", "在意", "記住", "可愛") }

// ---------------- E-09 photos ----------------
object PhotoKit {
    val FILTERS = linkedMapOf("none" to "原色", "warm" to "暖暖", "mono" to "黑白", "retro" to "復古", "dream" to "夢幻")
    val FRAMES = linkedMapOf("none" to "無", "polaroid" to "拍立得", "lace" to "花邊", "film" to "底片", "stamp" to "郵票")
    val POSES = linkedMapOf("HAPPY" to "比耶", "SHY" to "害羞", "LOOK" to "看鏡頭", "SING" to "唱歌", "SWING" to "帥氣", "DAYDREAM" to "發呆")
    val STICKERS = listOf("heart", "star", "sparkle", "flower", "note", "cake")
}

// ---------------- P-04 time capsules ----------------
object Capsules {
    const val DAYS = 30
    val LINES = listOf("給三十天後的你：現在的我{近況}。你那時候還記得嗎？", "三十天後的你好。我最近{近況}，希望那時候也一樣開心。", "打開的時候，記得叫我一起看喔。現在的我{近況}。")
}

// ---------------- P-11 house rules ----------------
/** a rule: the activities it slows down (or speeds up) and when; `axis` = the personality that keeps it (2 = diligent) */
data class RuleDef(val id: String, val zh: String, val acts: Set<String>, val from: Int, val to: Int, val k: Float, val protest: String)
object HouseRules {
    val ALL = listOf(
        RuleDef("quiet", "晚上十一點後要安靜", setOf("tv", "music", "dance", "hum", "sing"), 23, 6, 0.15f, "才十一點，再看一下下就好嘛！"),
        RuleDef("dishes", "輪流洗碗", setOf("dishes"), 0, 24, 3f, "又是我洗碗？我昨天才洗過！"),
        RuleDef("tidy", "東西用完要歸位", setOf("tidy", "sweep"), 0, 24, 1.6f, "等一下再收啦。"),
        RuleDef("bed", "十二點前上床", setOf("sleep"), 0, 3, 2f, "我還不睏嘛……"),
        RuleDef("outside", "天氣好要出去走走", setOf("outing", "cloudwatch"), 9, 17, 1.5f, "外面好熱，我想待在家。"),
    ).associateBy { it.id }
    const val MAX = 4
}

// ---------------- P-05 scenario starts ----------------
data class ScenarioDef(val id: String, val zh: String, val desc: String, val house: String, val min: Int, val max: Int, val romance: Boolean = false)
object Scenarios {
    val ALL = listOf(
        ScenarioDef("dorm6", "六個人擠在共居宿舍", "大家才剛認識，浴室只有兩間。", "dorm", 4, 6),
        ScenarioDef("rivals", "兩個對手被迫當室友", "彼此看不順眼，卻得一起生活。", "cottage", 2, 2),
        ScenarioDef("oldfriends", "老朋友重逢", "很久以前的好朋友，又住在一起了。", "apartment", 2, 4),
        ScenarioDef("strangers", "互不相識的房客", "誰也不認識誰，從打招呼開始。", "apartment", 3, 4),
        ScenarioDef("family", "一家人的大宅", "吵吵鬧鬧的一家人。", "mansion", 3, 6),
    ).associateBy { it.id }
    /** the starting relationships for these people (library ids) */
    fun rels(id: String, ids: List<String>): List<Rel> {
        val out = ArrayList<Rel>()
        for (a in ids) for (b in ids) { if (a == b) continue
            out += when (id) {
                "rivals" -> Rel(a, b, "對手", familiar = 40, like = 20, trust = 20, conflict = 45, flavor = listOf("對手"))
                "oldfriends" -> Rel(a, b, "好友", familiar = 75, like = 75, trust = 70)
                "strangers" -> Rel(a, b, "陌生", familiar = 5, like = 30, trust = 25)
                "family" -> Rel(a, b, "家人", familiar = 85, like = 65, trust = 70)
                else -> Rel(a, b, "認識", familiar = 25, like = 40, trust = 35)
            }
        }
        return out
    }
}

// ---------------- L-03 catch the snacks / L-04 card flip (pure, testable) ----------------
/** L-03: snacks fall; the player moves the catcher (0..1 across); 30 seconds */
class CatchGame(seed: Long, val len: Float = 30f) {
    private val r = Rng(seed)
    class Drop(var x: Float, var y: Float, val kind: Int, val speed: Float)
    val drops = ArrayList<Drop>()
    var t = 0f; private set
    var score = 0; private set
    var missed = 0; private set
    var x = 0.5f
    private var next = 0.4f
    val over get() = t >= len
    /** the catcher is 0.16 wide at the bottom; `kind` 2 = a pebble (−1) */
    fun step(dt: Float) {
        if (over) return
        t += dt; next -= dt
        if (next <= 0f) { next = (0.75f - t / len * 0.4f).coerceAtLeast(0.3f); drops += Drop(0.05f + r.nextFloat() * 0.9f, 0f, if (r.chance(0.15)) 2 else r.nextInt(2), 0.35f + r.nextFloat() * 0.25f + t / len * 0.3f) }
        val it = drops.iterator()
        while (it.hasNext()) { val d = it.next(); d.y += d.speed * dt
            if (d.y >= 0.92f && d.y < 1f && kotlin.math.abs(d.x - x) < 0.09f) { if (d.kind == 2) score = (score - 1).coerceAtLeast(0) else score++; it.remove() }
            else if (d.y >= 1.05f) { if (d.kind != 2) missed++; it.remove() } }
    }
}
/** L-04: pairs of cards whose faces are the residents' expressions */
class FlipGame(seed: Long, faces: List<String>) {
    val cards: List<String>
    val open = HashSet<Int>(); val done = HashSet<Int>()
    var turns = 0; private set
    private var first = -1
    init { val r = Rng(seed); val base = faces.take(6); cards = (base + base).sortedBy { r.nextDouble() } }
    val over get() = done.size == cards.size
    /** flip card i; returns "pair", "miss" or "" */
    fun flip(i: Int): String {
        if (i !in cards.indices || i in done || i in open) return ""
        if (open.size == 2) open.clear()
        open += i
        if (first < 0) { first = i; return "" }
        turns++; val a = first; first = -1
        return if (cards[a] == cards[i]) { done += a; done += i; open.clear(); "pair" } else "miss"
    }
    /** stars by turns (perfect = pairs) */
    fun stars() = when { turns <= cards.size / 2 + 2 -> 3; turns <= cards.size -> 2; else -> 1 }
}
