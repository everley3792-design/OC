package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.Speech
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.town.Goods
import app.ocshimeji.sim.town.Town
import app.ocshimeji.sim.town.Weather
import kotlinx.serialization.Serializable
import kotlin.math.floor

/** one diary page (plan A-12): written at the end of a day, in their own voice */
@Serializable class DiaryEntry(val day: Long, val who: String, val lines: List<String>)
/** a dream (plan A-06): pieces of the day, shown as little pictures while they sleep, told when they wake */
@Serializable class Dream(val who: String, val icons: List<String>, val text: String, val night: Long, var told: Boolean = false)
/** a plant that grows (plan G-09): watered → grows → flowers; forgotten → droops */
@Serializable class Plant(var growth: Int = 0, var watered: Double = -1e9)
/** this week's star (plan Q-13) */
@Serializable class Star(val week: Long, val who: String, val why: String)
/**
 * Everything that is counted and kept (M7): what each resident did (counts, this week's counts), titles, diary, dreams,
 * achievements you claimed, the collection book, plants and the garden, festivals and weekly stars.
 */
@Serializable
class Progress(
    /** "<who>:<what>" and "all:<what>" → how many times, ever */
    val counts: MutableMap<String, Int> = mutableMapOf(),
    /** the same for this week only (statistics cards) */
    val week: MutableMap<String, Int> = mutableMapOf(), var weekNo: Long = -1,
    /** person → title ids (plan A-15) */
    val titles: MutableMap<String, MutableList<String>> = mutableMapOf(),
    val diary: MutableList<DiaryEntry> = mutableListOf(),
    val dreams: MutableList<Dream> = mutableListOf(),
    /** achievement ids you claimed (plan I-08: only you claim them) */
    val claimed: MutableList<String> = mutableListOf(),
    /** the collection book (plan I-07): id → 1 heard of, 2 seen, 3 owned */
    val book: MutableMap<String, Int> = mutableMapOf(),
    /** "x:y" of a plant piece → its growth */
    val plants: MutableMap<String, Plant> = mutableMapOf(),
    /** garden work since the last harvest */
    var garden: Int = 0,
    /** festival ids already held, as "id:year" */
    val festivals: MutableList<String> = mutableListOf(),
    val stars: MutableList<Star> = mutableListOf(),
    /** series already completed in a room, as "room:series" (plan G-04) */
    val sets: MutableList<String> = mutableListOf(),
    var diaryDay: Long = -1,
)

class Journal(private val sim: LifeSim) {
    private val life get() = sim.life
    private val pr get() = life.prog

    // ================= counting =================
    /** one thing done (by someone, or by you when `who` is empty) */
    fun did(who: String, what: String, n: Int = 1) {
        roll()
        for (k in listOf("all:$what") + (if (who.isNotEmpty()) listOf("$who:$what") else emptyList())) { pr.counts[k] = (pr.counts[k] ?: 0) + n; pr.week[k] = (pr.week[k] ?: 0) + n }
        if (who.isNotEmpty()) sim.person(who)?.let { checkTitles(it) }
    }
    fun count(who: String, what: String) = pr.counts["$who:$what"] ?: 0
    fun total(what: String) = pr.counts["all:$what"] ?: 0
    private fun week() = Math.floorDiv(Weather.dayOf(life.minute), 7L)
    /** an activity finished (live or away) */
    internal fun actDone(p: Person, a: Activity) {
        did(p.id, "act:${a.id}")
        when (a.id) {
            "water" -> sim.house.pieces.getOrNull(p.actPiece)?.takeIf { it.kind == "plant" }?.let { pc -> val pl = pr.plants.getOrPut("${pc.x}:${pc.y}") { Plant() }; pl.growth = minOf(9, pl.growth + 1); pl.watered = life.minute
                if (pl.growth == 6) { sim.log(p, "澆水的盆栽開花了！", kind = "event", weight = 2); sim.events += SimEvent("fx", p.id, "sparkle") } }
            "garden" -> { pr.garden++; if (pr.garden >= 3) harvest(p) }
        }
    }
    private fun harvest(p: Person) {
        pr.garden = 0; val r = Rng.of(life.seed, "harvest:${life.minute.toLong()}"); val g = r.pick(Goods.FARM); val n = 1 + r.nextInt(2)
        sim.economy.move(g.id, n, "${p.name}從菜園收成了${g.zh}", p.id); did(p.id, "harvest")
        sim.say(p, "收成了！${g.zh}長得好好。"); sim.log(p, "從菜園收成了 $n 個${g.zh}", kind = "life", weight = 2)
    }
    /** how a plant looks: 0 sprout … 2 grown, 3 flowering; −1 drooping (not watered for three days) */
    fun plantStage(x: Int, y: Int): Int { val pl = pr.plants["$x:$y"] ?: return 1; if (life.minute - pl.watered > 3 * 1440) return -1; return when { pl.growth >= 6 -> 3; pl.growth >= 3 -> 2; pl.growth >= 1 -> 1; else -> 0 } }
    /** furniture moved: its growth moves with it */
    internal fun moved(fromX: Int, fromY: Int, toX: Int, toY: Int) { pr.plants.remove("$fromX:$fromY")?.let { pr.plants["$toX:$toY"] = it } }

    // ================= the book (plan I-07) =================
    fun see(id: String, state: Int) { if ((pr.book[id] ?: 0) < state) pr.book[id] = state }
    /** everything that can be in the book: id → (name, group) */
    val entries: List<Triple<String, String, String>> get() =
        Goods.FOOD.map { Triple(it.id, it.zh, "食物") } + Goods.MARKET.map { Triple(it.id, it.zh, "市集") } + Goods.FARM.map { Triple(it.id, it.zh, "菜園") } +
        Goods.WILD.map { Triple(it.id, it.zh, "公園") } + Goods.FURNITURE.map { Triple(it.id, it.zh, "家具") } + Goods.FESTIVAL.map { Triple(it.id, it.zh, "祭典") } +
        Town.EVENTS.map { Triple("ev:" + it.id, it.zh, "小鎮事件") } + Town.FESTIVALS.map { Triple("fe:" + it.id, it.zh, "節日") }

    // ================= titles (plan A-15) =================
    class Title(val id: String, val zh: String, val what: String, val need: Int, val desc: String)
    val TITLES = listOf(
        Title("cook", "小廚師", "act:cook", 8, "煮了 8 次飯"), Title("reader", "書蟲", "act:read", 10, "看了 10 次書"), Title("tidy", "整理達人", "act:tidy", 8, "整理了 8 次"),
        Title("town", "小鎮通", "town", 8, "去了 8 次小鎮"), Title("green", "綠手指", "act:water", 8, "澆了 8 次水"), Title("farmer", "菜園主人", "harvest", 3, "收成了 3 次"),
        Title("maker", "手作家", "craft", 3, "做好了 3 件作品"), Title("talker", "話匣子", "act:chat", 20, "聊了 20 次天"), Title("eater", "好胃口", "act:meal", 25, "吃了 25 頓飯"),
        Title("pet", "撒嬌高手", "pet", 15, "被你摸了 15 次"), Title("finder", "採集家", "gather", 5, "在公園撿了 5 次東西"), Title("fest", "祭典達人", "festival", 2, "逛了 2 次祭典"),
        Title("sleepy", "睡美人", "act:sleep", 20, "好好睡了 20 晚"), Title("bath", "愛乾淨", "act:bathe", 15, "洗了 15 次澡"),
    ).associateBy { it.id }
    private fun checkTitles(p: Person) {
        for (t in TITLES.values) { val have = pr.titles.getOrPut(p.id) { mutableListOf() }; if (t.id in have || count(p.id, t.what) < t.need) continue
            have += t.id; sim.log(p, "得到了稱號「${t.zh}」（${t.desc}）", kind = "event", weight = 2); sim.events += SimEvent("fx", p.id, "sparkle") }
    }
    fun titlesOf(id: String): List<Title> = pr.titles[id].orEmpty().mapNotNull { TITLES[it] }

    // ================= achievements (plan I-08) =================
    class Achievement(val id: String, val zh: String, val desc: String, val reward: Int, val done: (Journal) -> Boolean)
    val ACHIEVEMENTS: List<Achievement> = listOf(
        Achievement("day7", "一起過了一週", "觀察滿 7 天", 50) { it.life.day >= 7 }, Achievement("day30", "一個月了", "觀察滿 30 天", 150) { it.life.day >= 30 },
        Achievement("town1", "第一次上街", "有人去了小鎮", 20) { it.total("town") >= 1 }, Achievement("town20", "小鎮常客", "大家一共去了 20 次小鎮", 80) { it.total("town") >= 20 },
        Achievement("buy1", "第一次購物", "在小鎮買了東西", 20) { it.total("buy") >= 1 }, Achievement("place5", "佈置新手", "擺了 5 次家具", 40) { it.total("place") >= 5 },
        Achievement("craft1", "第一件作品", "委託完成了一件作品", 40) { it.total("craft") >= 1 }, Achievement("sold1", "開張大吉", "市集攤位賣出了東西", 40) { it.total("sold") >= 1 },
        Achievement("harvest1", "第一次收成", "從菜園收成", 30) { it.total("harvest") >= 1 }, Achievement("gather5", "口袋滿滿", "在公園撿了 5 次東西", 30) { it.total("gather") >= 5 },
        Achievement("fest1", "祭典的夜晚", "有人逛了祭典", 50) { it.total("festival") >= 1 }, Achievement("pet30", "摸摸大師", "摸了 30 次", 40) { it.total("pet") >= 30 },
        Achievement("worry5", "可靠的人", "幫忙處理了 5 個煩惱", 60) { it.total("worry") >= 5 }, Achievement("wish3", "心願達成", "幫忙完成了 3 個心願", 60) { it.total("wish") >= 3 },
        Achievement("title3", "人才濟濟", "大家一共得到 3 個稱號", 50) { j -> j.pr.titles.values.sumOf { it.size } >= 3 }, Achievement("book20", "收集家", "圖鑑看過或擁有 20 樣", 60) { j -> j.pr.book.values.count { it >= 2 } >= 20 },
        Achievement("bloom", "花開了", "照顧的盆栽開花", 40) { j -> j.pr.plants.values.any { it.growth >= 6 } }, Achievement("move", "新家", "搬了一次家", 50) { it.total("move") >= 1 },
        Achievement("star", "本週之星", "選出了第一位本週之星", 40) { j -> j.pr.stars.isNotEmpty() }, Achievement("diary7", "厚厚的日記", "大家寫了 7 篇日記", 40) { j -> j.pr.diary.size >= 7 },
    )
    fun claimable(a: Achievement) = a.id !in pr.claimed && a.done(this)
    /** you claim it: coins in (once) */
    fun claim(id: String): String? {
        val a = ACHIEVEMENTS.firstOrNull { it.id == id } ?: return "沒有這個成就"; if (a.id in pr.claimed) return "已經領過了"; if (!a.done(this)) return "還沒達成：${a.desc}"
        pr.claimed += a.id; sim.economy.earn(a.reward, "成就：${a.zh}"); return null
    }

    // ================= dreams (plan A-06) =================
    private fun iconFor(l: LogLine): String = when { l.text.contains("吃") || l.text.contains("煮") -> "food"; l.text.contains("小鎮") -> "town"; l.text.contains("摸") -> "heart"
        l.kind == "social" -> "chat"; l.text.contains("雨") -> "rain"; l.text.contains("禮") -> "gift"; l.text.contains("猜拳") || l.text.contains("躲貓貓") -> "game"; else -> "star" }
    /** falling asleep: today's moments become a dream */
    internal fun dream(p: Person) {
        val night = Weather.dayOf(life.minute + 360); if (pr.dreams.any { it.who == p.id && it.night == night }) return
        val today = life.log.filter { it.who == p.id && it.minute > life.minute - 18 * 60 && !it.text.contains("睡") }.sortedByDescending { it.weight }.take(3)
        val r = Rng.of(life.seed, "dream:${p.id}:$night")
        val bits = today.map { it.text.substringAfter("：").take(12) }
        val text = when { bits.isEmpty() -> r.pick(listOf("我夢到自己在雲上散步。", "夢裡有一片好大的布丁海。", "夢到大家一起放風箏。"))
            bits.size == 1 -> "我夢到${bits[0]}……可是大家都會飛。"; else -> "我夢到${bits[0]}，然後突然${bits[1]}，好奇怪的夢。" }
        pr.dreams += Dream(p.id, today.map { iconFor(it) }.ifEmpty { listOf("moon") }, text, night); while (pr.dreams.size > 60) pr.dreams.removeAt(0)
    }
    fun dreamOf(id: String): Dream? = pr.dreams.lastOrNull { it.who == id && it.night == Weather.dayOf(life.minute + 360) }
    /** waking up: they tell you */
    internal fun woke(p: Person) { val d = pr.dreams.lastOrNull { it.who == p.id && !it.told } ?: return; d.told = true; sim.say(p, d.text); sim.log(p, "說起昨晚的夢：${d.text}", kind = "life", weight = 1) }

    // ================= the diary (plan A-12), the star (Q-13), the stats (K-07) =================
    internal fun newDay() {
        val day = life.day; if (pr.diaryDay == day) return; pr.diaryDay = day
        val from = floor(life.startMinute / 1440) * 1440 + (day - 2) * 1440
        for (p in life.people) {
            val lines = life.log.filter { it.who == p.id && it.minute >= from && it.minute < from + 1440 }.sortedByDescending { it.weight }.take(4).map { it.text.substringAfter("：") }
            if (lines.isEmpty()) continue
            val r = Rng.of(life.seed, "diary:${p.id}:$day")
            val txt = lines.mapIndexed { i, l -> Speech.say(p.spec, (if (i == 0) "今天，我" else r.pick(listOf("還有，我", "後來我", "對了，我"))) + l.removePrefix(p.name).trimEnd('。', '！', '～'), r, p.affinity).let { s -> if (s.last() in "。！？～") s else "$s。" } } +
                Speech.say(p.spec, r.pick(listOf("明天也要加油。", "今天是不錯的一天。", "好睏，晚安。", "希望明天也一樣開心。")), r, p.affinity)
            pr.diary += DiaryEntry(day - 1, p.id, txt)
        }
        while (pr.diary.size > 400) pr.diary.removeAt(0)
        roll()
    }
    /** a new week: last week's star (plan Q-13), then the weekly counts start again */
    private fun roll() {
        val wk = week(); if (pr.weekNo == wk) return
        if (pr.weekNo >= 0 && pr.stars.none { it.week == pr.weekNo }) {
            val best = life.people.maxByOrNull { score(it.id) }
            if (best != null && score(best.id) > 0) { val why = topThing(best.id); pr.stars += Star(pr.weekNo, best.id, why); sim.log(best, "成了本週之星（$why）", kind = "event", weight = 3) }
        }
        pr.weekNo = wk; pr.week.clear()
    }
    private fun score(id: String) = pr.week.filterKeys { it.startsWith("$id:") }.values.sum()
    private val WHAT_ZH = mapOf("act:cook" to "最常煮飯", "act:chat" to "最常聊天", "act:tidy" to "最常整理", "act:read" to "最常看書", "town" to "最常上街", "act:meal" to "最會吃", "act:water" to "最常澆水", "pet" to "最常被摸", "gather" to "最會撿東西", "act:garden" to "最常照顧菜園")
    private fun topThing(id: String): String = WHAT_ZH.keys.maxByOrNull { pr.week["$id:$it"] ?: 0 }?.let { WHAT_ZH[it] } ?: "很努力"
    fun starNow(): Star? = pr.stars.lastOrNull()?.takeIf { it.week >= week() - 1 }
    /** this week's statistics cards: (title, who, how many) */
    fun stats(): List<Triple<String, String, Int>> = WHAT_ZH.mapNotNull { (k, zh) -> val best = life.people.maxByOrNull { pr.week["${it.id}:$k"] ?: 0 } ?: return@mapNotNull null
        val n = pr.week["${best.id}:$k"] ?: 0; if (n == 0) null else Triple("這週$zh", best.name, n) }.sortedByDescending { it.third } +
        listOfNotNull(sim.society.topPair()?.let { (a, b, n) -> Triple("這週最常在一起", "${a.name}和${b.name}", n) })

    // ================= rooms: personality (P-10), series (G-04) =================
    /** one line about a room, from what is in it */
    fun roomLine(roomId: String): String {
        val pcs = sim.house.pieces.filter { it.room == roomId }; val (tidy, pretty, comfy) = sim.townLife.roomScore(roomId)
        return when {
            pcs.count { it.kind == "shelf" } >= 2 -> "堆滿書的安靜房間"
            pcs.count { it.kind == "plant" } >= 2 || pcs.any { it.kind == "garden" } -> "綠意盎然的房間"
            tidy < 30 -> "有點亂的房間"
            pretty >= 70 && comfy >= 70 -> "精心佈置、很舒服的房間"
            pretty >= 70 -> "很好看的房間"
            comfy >= 70 -> "讓人想窩著的房間"
            pcs.size <= 2 -> "空蕩蕩的房間"
            pcs.any { it.kind == "tv" } -> "常常傳出電視聲的房間"
            else -> "普通、自在的房間"
        }
    }
    /** pieces of one series together in a room (plan G-04): (series, how many) */
    fun setsIn(roomId: String): List<Pair<String, Int>> = sim.house.pieces.filter { it.room == roomId }.mapNotNull { pc -> life.items.firstOrNull { "item:" + it.id == pc.kind }?.series?.takeIf { it.isNotBlank() } }
        .groupingBy { it }.eachCount().filter { it.value >= 2 }.toList()
    /** after decorating: a new set is celebrated once */
    internal fun checkSets() {
        for (r in sim.house.rooms) for ((s, _) in setsIn(r.id)) { val k = "${r.id}:$s"; if (k in pr.sets) continue; pr.sets += k
            val p = life.people.firstOrNull { it.out == null && !it.desk } ?: continue; sim.say(p, "${r.zh}的「$s」湊成一套了！好漂亮。"); sim.events += SimEvent("fx", p.id, "sparkle"); sim.log(p, "發現${r.zh}的「$s」系列湊成一套了", kind = "you", weight = 2) }
    }
    /** decorating: someone at home says what they think (plan G-05) */
    internal fun reactTo(kind: String, roomId: String) {
        val home = life.people.filter { it.out == null && !it.desk && !sim.asleep(it) }; if (home.isEmpty()) return
        val p = home.firstOrNull { it.room == roomId } ?: home.first(); val k = Furniture.kind(kind); val s = p.spec
        val liked = (kind == "plant" && (s.roomPref == "要有植物" || s.likes.any { it.contains("植物") || it.contains("花") })) || (kind == "shelf" && s.skill("閱讀") >= 2) || (kind == "rug" && s.axis(Axis.GENTLE) > 0.2f) || (kind == "tv" && s.axis(Axis.ACTIVE) < 0f) || kind.startsWith("item:")
        val r = Rng.of(life.seed, "react:${life.minute.toLong()}")
        sim.say(p, if (liked) r.pick(listOf("${k.zh}！我好喜歡這個。", "放在這裡剛剛好。", "有${k.zh}了，好開心。")) else r.pick(listOf("新的${k.zh}啊。", "嗯，看起來不錯。", "這樣擺也可以。")))
        if (liked) sim.addMood(p, "newthing")
    }
}
