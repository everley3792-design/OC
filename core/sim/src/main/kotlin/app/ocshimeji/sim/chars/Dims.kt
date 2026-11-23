package app.ocshimeji.sim.chars

import app.ocshimeji.sim.life.Need
import kotlinx.serialization.Serializable

/**
 * 2.2.0 (expansion #14): personality in many dimensions. The names, groups and descriptions are our own (no outside type system
 * is shown). The first five are the old axes (`CharSpec.axes`) seen as dimensions; the rest live in `CharSpec.dims`. Each value is
 * −1..1, 0 = in between. What a dimension DOES is an `Effect` for each end (scaled by how far towards it), plus a few things the
 * inner life reads directly (`Inner`: needing time alone, jealousy, habits forming, grudges, first impressions).
 */
data class Dim(val id: String, val zh: String, val low: String, val high: String, val group: String, val note: String, val hi: Effect, val lo: Effect, val axis: Int = -1)

object Dims {
    private fun e(vararg act: Pair<String, Float>, decay: Map<Need, Float> = emptyMap(), pos: Float = 1f, neg: Float = 1f, speed: Float = 1f, dur: Float = 1f, lines: List<String> = emptyList(), topics: List<String> = emptyList()) =
        Effect(act.toMap(), decay, 0, 0, pos, neg, speed, dur, lines, emptySet(), topics)

    val ALL: List<Dim> = listOf(
        // ---- 和人相處
        Dim("外向", "外向程度", "安靜", "外放", "和人相處", "在人群裡是充電還是耗電", e("chat" to 1.15f), e("chat" to 0.9f), axis = 0),
        Dim("主動", "社交主動性", "等人來找", "先開口", "和人相處", "會不會主動找人說話",
            e("s:聊天" to 1.5f, "s:邀請" to 1.5f, "chat" to 1.3f, lines = listOf("欸，要不要聊一下？")), e("s:聊天" to 0.6f, "s:邀請" to 0.5f, "chat" to 0.75f)),
        Dim("同理", "同理心", "看不太出來", "很懂人心", "和人相處", "別人難過時看不看得出來",
            e("s:照顧" to 1.7f, "r:和好" to 1.3f, lines = listOf("你今天是不是有點累？")), e("s:照顧" to 0.6f)),
        Dim("幽默", "幽默感", "一本正經", "愛開玩笑", "和人相處", "說話好不好笑",
            e("s:玩笑" to 1.8f, "r:玩笑" to 1.3f, lines = listOf("我跟你說一個冷笑話。")), e("s:玩笑" to 0.5f, "r:玩笑" to 0.8f)),
        Dim("表達", "表達方式", "拐彎抹角", "有話直說", "和人相處", "心裡話說不說得出口", e("s:衝突" to 1.15f), e("s:衝突" to 0.85f), axis = 3),
        Dim("衝突", "衝突處理", "躲開", "當面說清楚", "和人相處", "吵架時會怎麼做",
            e("s:衝突" to 1.4f, "r:和好" to 1.3f), e("s:衝突" to 0.5f, "r:和好" to 0.8f)),
        Dim("溫柔", "溫柔程度", "好勝", "溫柔", "和人相處", "讓人還是要贏", e("s:照顧" to 1.15f), e("s:衝突" to 1.15f), axis = 4),
        Dim("競爭", "競爭心", "無所謂輸贏", "一定要贏", "和人相處", "比賽和比較的時候",
            e("s:衝突" to 1.25f, "active" to 1.15f, lines = listOf("下次我一定贏。")), e("s:衝突" to 0.8f)),
        // ---- 心
        Dim("敏感", "情緒敏感度", "不太在意", "很容易被觸動", "心", "一點小事會不會放在心上", e(pos = 1.2f, neg = 1.3f), e(pos = 0.9f, neg = 0.75f)),
        Dim("穩定", "情緒穩定度", "起伏很大", "穩穩的", "心", "心情來得快、去得快嗎", e(pos = 0.9f, neg = 0.7f), e(pos = 1.25f, neg = 1.35f)),
        Dim("自信", "自信程度", "常常懷疑自己", "相信自己", "心", "被誇獎和被批評時",
            e("primp" to 1.3f, "r:稱讚" to 1.15f, neg = 0.85f, lines = listOf("交給我吧。")), e("primp" to 0.8f, "r:稱讚" to 0.85f, neg = 1.15f, lines = listOf("我真的可以嗎……"))),
        Dim("浪漫", "浪漫程度", "很務實", "很浪漫", "心", "看夕陽是看見夕陽還是看見故事",
            e("dreamy" to 1.4f, "stargaze" to 1.6f, "letter" to 1.4f, lines = listOf("今天的天空像一封信。")), e("dreamy" to 0.75f, "tidy" to 1.1f)),
        // ---- 做事
        Dim("活力", "活力", "沉穩", "活潑", "做事", "坐不坐得住", e("active" to 1.1f), e("calm" to 1.1f), axis = 1),
        Dim("責任", "責任感", "隨性", "說到做到", "做事", "答應的事、家裡的事", e("tidy" to 1.15f), e("tidy" to 0.9f), axis = 2),
        Dim("完美", "完美主義", "差不多就好", "一定要做好", "做事", "做完一件事的標準",
            e("tidy" to 1.3f, dur = 1.2f, neg = 1.1f, lines = listOf("這裡再弄一下就好。")), e(dur = 0.85f)),
        Dim("衝動", "衝動程度", "想清楚再說", "想到就做", "做事", "做決定的速度",
            e("outing" to 1.3f, speed = 1.1f, dur = 0.85f, lines = listOf("走吧，現在就去！")), e(dur = 1.1f)),
        Dim("耐心", "耐心", "很急", "很有耐心", "做事", "等待和慢慢來",
            e("puzzle" to 1.6f, "garden" to 1.4f, "water" to 1.3f, dur = 1.15f), e("puzzle" to 0.5f, dur = 0.85f, speed = 1.08f, lines = listOf("好慢喔……"))),
        // ---- 世界
        Dim("好奇", "好奇心", "習慣熟悉的", "什麼都想知道", "世界", "對沒見過的東西",
            e("window" to 1.35f, "read" to 1.25f, "deduce" to 1.5f, lines = listOf("那個是什麼？"), topics = listOf("最近發現的事")), e("window" to 0.8f, "read" to 0.9f)),
        Dim("冒險", "冒險傾向", "安全第一", "想去沒去過的地方", "世界", "陌生的地方和新的事",
            e("outing" to 1.5f, "active" to 1.2f, lines = listOf("我想去更遠的地方。")), e("outing" to 0.6f, "calm" to 1.15f)),
        Dim("創造", "創造力", "照著做", "想自己做出來", "世界", "畫畫、手作、煮新菜",
            e("doodle" to 1.8f, "craft" to 1.7f, "paint" to 1.8f, "origami" to 1.6f, "bake" to 1.4f, lines = listOf("我想到一個點子。")), e("doodle" to 0.6f, "craft" to 0.7f)),
        // ---- 一個人與一群人
        Dim("獨立", "獨立程度", "喜歡有人在", "一個人也很好", "一個人與一群人", "需不需要自己的時間",
            e("music" to 1.3f, "read" to 1.15f, decay = mapOf(Need.SOCIAL to 0.8f)), e(decay = mapOf(Need.SOCIAL to 1.2f))),
        Dim("依賴", "依賴傾向", "自己來", "想靠著誰", "一個人與一群人", "遇到事情時找不找人",
            e(decay = mapOf(Need.ATTENTION to 1.35f, Need.SOCIAL to 1.15f), lines = listOf("你會陪我嗎？")), e(decay = mapOf(Need.ATTENTION to 0.75f))),
    )
    val BY = ALL.associateBy { it.id }
    val GROUPS = ALL.map { it.group }.distinct()

    /** the effects of every dimension that leans one way (none for 0; the axis ones are already read by the life directly) */
    fun effects(s: CharSpec): List<Effect> = ALL.mapNotNull { d -> val v = s.dim(d.id); if (kotlin.math.abs(v) < 0.15f || d.axis >= 0) null else scale(if (v > 0) d.hi else d.lo, kotlin.math.abs(v)) }
    /** an effect at a strength 0..1 (multipliers move towards 1) */
    fun scale(e: Effect, k: Float): Effect {
        fun m(x: Float) = 1f + (x - 1f) * k
        return e.copy(act = e.act.mapValues { m(it.value) }, decay = e.decay.mapValues { m(it.value) }, moodPos = m(e.moodPos), moodNeg = m(e.moodNeg), speed = m(e.speed), duration = m(e.duration),
            lines = if (k >= 0.5f) e.lines else emptyList(), topics = if (k >= 0.5f) e.topics else emptyList())
    }
    /** a short line for the card: the dimensions that lean the furthest */
    fun summary(s: CharSpec, n: Int = 3): List<String> = ALL.map { it to s.dim(it.id) }.filter { kotlin.math.abs(it.second) >= 0.35f }.sortedByDescending { kotlin.math.abs(it.second) }.take(n).map { (d, v) -> if (v > 0) d.high else d.low }
    /** how alike two people are, 0 (opposite) .. 1 (the same) */
    fun likeness(a: CharSpec, b: CharSpec): Float = 1f - ALL.map { kotlin.math.abs(a.dim(it.id) - b.dim(it.id)) / 2f }.average().toFloat()

    // ---------------- the situational quiz (each answer nudges several dimensions) ----------------
    class Q(val ask: String, val answers: List<Pair<String, Map<String, Float>>>)
    private fun q(ask: String, vararg a: Pair<String, Map<String, Float>>) = Q(ask, a.toList())
    private fun d(vararg p: Pair<String, Float>) = p.toMap()
    val QUIZ: List<Q> = listOf(
        q("在一個不認識任何人的聚會裡，你會？", "一個一個去認識大家" to d("外向" to 0.5f, "主動" to 0.6f), "先站在旁邊看看大家" to d("好奇" to 0.2f, "主動" to -0.3f),
            "找一個看起來很好聊的人" to d("同理" to 0.3f, "主動" to 0.2f), "找個安靜的角落待著" to d("外向" to -0.5f, "獨立" to 0.4f)),
        q("朋友突然約你現在出門？", "馬上答應" to d("衝動" to 0.6f, "冒險" to 0.3f), "看今天的心情" to d("穩定" to -0.2f), "先問會有哪些人" to d("外向" to -0.2f, "衝動" to -0.3f), "比較想待在家" to d("冒險" to -0.4f, "獨立" to 0.3f)),
        q("朋友哭著來找你？", "先抱一下再說" to d("同理" to 0.6f, "溫柔" to 0.3f), "問發生什麼事、一起想辦法" to d("責任" to 0.3f, "表達" to 0.3f), "陪在旁邊不說話" to d("同理" to 0.3f, "外向" to -0.2f), "說個笑話讓他笑" to d("幽默" to 0.6f)),
        q("一起玩遊戲輸了？", "再來一局，這次一定贏" to d("競爭" to 0.7f), "笑一笑就算了" to d("競爭" to -0.5f, "穩定" to 0.3f), "回去偷偷練習" to d("競爭" to 0.4f, "耐心" to 0.3f), "有點不開心，但不說" to d("敏感" to 0.4f, "表達" to -0.4f)),
        q("收到一件從沒見過的東西？", "馬上拆開研究" to d("好奇" to 0.6f, "衝動" to 0.3f), "先看說明書" to d("責任" to 0.3f, "衝動" to -0.4f), "拿去問別人這是什麼" to d("依賴" to 0.4f, "主動" to 0.2f), "先放著，之後再說" to d("好奇" to -0.4f)),
        q("和朋友意見不合？", "當場說清楚" to d("衝突" to 0.6f, "表達" to 0.4f), "先讓步，之後再找機會說" to d("衝突" to -0.2f, "溫柔" to 0.3f), "不說話，自己生悶氣" to d("衝突" to -0.5f, "敏感" to 0.3f), "開個玩笑帶過" to d("幽默" to 0.4f, "衝突" to -0.3f)),
        q("一個完全空下來的週末？", "一個人好好休息" to d("獨立" to 0.6f, "外向" to -0.3f), "約一群朋友出去" to d("外向" to 0.5f, "主動" to 0.4f), "去一個沒去過的地方" to d("冒險" to 0.6f, "好奇" to 0.3f), "做一件一直想做的作品" to d("創造" to 0.6f, "耐心" to 0.2f)),
        q("有人稱讚你？", "大方說謝謝" to d("自信" to 0.5f), "害羞地說沒有啦" to d("自信" to -0.3f, "敏感" to 0.3f), "懷疑他是不是有事要拜託" to d("自信" to -0.2f, "好奇" to 0.1f), "稱讚回去" to d("同理" to 0.3f, "主動" to 0.3f)),
        q("做一件作品做到一半？", "不完美就重來" to d("完美" to 0.7f, "耐心" to 0.3f), "差不多就好" to d("完美" to -0.5f), "先放著，等有靈感" to d("創造" to 0.3f, "責任" to -0.3f), "找人來一起做" to d("依賴" to 0.4f, "外向" to 0.2f)),
        q("在排很長的隊？", "慢慢等，看看四周" to d("耐心" to 0.6f, "好奇" to 0.2f), "一直看時間" to d("耐心" to -0.6f), "跟前後的人聊起來" to d("主動" to 0.5f, "外向" to 0.3f), "不排了，下次再來" to d("衝動" to 0.4f, "耐心" to -0.3f)),
        q("下雨的晚上，窗外有閃電？", "好浪漫，想寫點什麼" to d("浪漫" to 0.6f, "創造" to 0.3f), "檢查門窗有沒有關好" to d("責任" to 0.5f, "浪漫" to -0.3f), "有點怕，想找人在旁邊" to d("依賴" to 0.5f, "敏感" to 0.3f), "跑去窗邊看" to d("好奇" to 0.5f, "冒險" to 0.3f)),
        q("朋友這週好像不太對勁？", "直接問他怎麼了" to d("表達" to 0.5f, "同理" to 0.3f), "默默多陪他一點" to d("同理" to 0.6f, "表達" to -0.2f), "等他自己說" to d("同理" to 0.1f, "主動" to -0.4f), "沒注意到" to d("同理" to -0.6f)),
        q("一個沒做過的新工作找上你？", "好啊，試試看" to d("冒險" to 0.5f, "自信" to 0.4f), "我怕做不好" to d("自信" to -0.5f), "先問清楚要做什麼" to d("責任" to 0.4f, "衝動" to -0.3f), "我想跟朋友一起去" to d("依賴" to 0.4f)),
        q("答應了別人的事，那天卻好累？", "還是會做完" to d("責任" to 0.7f), "老實說今天不行" to d("表達" to 0.5f, "責任" to -0.1f), "做一半，明天補" to d("責任" to -0.2f, "完美" to -0.3f), "希望對方忘了" to d("責任" to -0.6f)),
        q("好朋友交了一個新朋友，常常一起玩？", "太好了，一起玩吧" to d("外向" to 0.3f, "敏感" to -0.3f), "有一點點吃醋" to d("依賴" to 0.4f, "敏感" to 0.4f), "那我也去找別的事做" to d("獨立" to 0.5f), "裝作沒事，其實很在意" to d("表達" to -0.5f, "敏感" to 0.4f)),
        q("心情很差的時候？", "睡一覺就好了" to d("穩定" to 0.6f), "需要好好哭一場" to d("敏感" to 0.5f, "穩定" to -0.4f), "找人說說" to d("依賴" to 0.4f, "表達" to 0.3f), "做點東西轉移注意力" to d("創造" to 0.4f, "獨立" to 0.3f)),
        q("看到路邊有一條沒走過的小路？", "走走看" to d("冒險" to 0.6f, "好奇" to 0.4f), "記下來，下次再來" to d("耐心" to 0.4f, "衝動" to -0.3f), "照平常的路回家" to d("冒險" to -0.5f), "找朋友一起來探險" to d("主動" to 0.4f, "冒險" to 0.3f)),
        q("大家在討論要吃什麼？", "我先說我想吃的" to d("主動" to 0.4f, "表達" to 0.4f), "都可以，大家決定" to d("溫柔" to 0.4f, "主動" to -0.3f), "提一個沒人吃過的店" to d("冒險" to 0.4f, "好奇" to 0.3f), "開玩笑說吃空氣" to d("幽默" to 0.5f)),
        q("收到一封沒有署名的信？", "一定是有人暗中關心我" to d("浪漫" to 0.6f), "先查是誰寄的" to d("好奇" to 0.5f, "責任" to 0.2f), "有點不安" to d("敏感" to 0.4f, "自信" to -0.3f), "拿去給朋友看" to d("依賴" to 0.3f, "外向" to 0.3f)),
        q("你最喜歡的一天是？", "和大家一起熱熱鬧鬧" to d("外向" to 0.5f, "獨立" to -0.4f), "一個人慢慢過" to d("獨立" to 0.6f), "做完一件很難的事" to d("競爭" to 0.3f, "完美" to 0.3f, "責任" to 0.3f), "發生了意想不到的事" to d("冒險" to 0.4f, "衝動" to 0.3f)),
        q("朋友做了一件讓你難過的事？", "直接告訴他" to d("衝突" to 0.6f, "表達" to 0.4f), "過幾天就忘了" to d("穩定" to 0.5f, "敏感" to -0.4f), "會記很久" to d("敏感" to 0.5f, "穩定" to -0.4f), "想想他是不是有原因" to d("同理" to 0.6f)),
        q("想到一個好點子的時候？", "馬上動手" to d("衝動" to 0.5f, "創造" to 0.4f), "先寫下來慢慢想" to d("耐心" to 0.4f, "創造" to 0.3f), "跟別人分享" to d("外向" to 0.3f, "主動" to 0.3f), "好像也不是很重要" to d("自信" to -0.3f, "創造" to -0.3f)),
    )
    /** the answers (index per question, −1 = skipped) → a spec with the dimensions set (the five axes too) */
    fun quiz(base: CharSpec, answers: List<Int>): CharSpec {
        val acc = HashMap<String, Float>(); val n = HashMap<String, Int>()
        answers.forEachIndexed { i, a -> QUIZ.getOrNull(i)?.answers?.getOrNull(a)?.second?.forEach { (k, v) -> acc[k] = (acc[k] ?: 0f) + v; n[k] = (n[k] ?: 0) + 1 } }
        var s = base
        for ((k, v) in acc) s = s.withDim(k, (v * 1.4f / kotlin.math.max(1, n[k]!!).toFloat().let { kotlin.math.sqrt(it) }).coerceIn(-1f, 1f))
        return s
    }
}

/**
 * 2.2.0 (expansion #39): how they put words together, on top of the speaking style. Each value 0..1 = how often.
 * Applied by `Speech.say` (zero = never, and no dice is drawn).
 */
@Serializable
data class TalkStyle(
    /** ends with a question back (不是嗎？) */
    val rhetorical: Float = 0f,
    /** likes comparisons (像……一樣) */
    val metaphor: Float = 0f,
    /** wanders off the point (啊，說到這個……) */
    val digress: Float = 0f,
    /** trips over the first word (我、我…) */
    val stutter: Float = 0f,
    /** cuts it short (only the first part) */
    val blunt: Float = 0f,
    /** extra polite (請、謝謝) */
    val polite: Float = 0f,
    /** a quick comeback (吐槽) */
    val quip: Float = 0f,
    /** covers shyness with a joke (when praised or close) */
    val jokeShy: Float = 0f,
) {
    val any get() = rhetorical > 0f || metaphor > 0f || digress > 0f || stutter > 0f || blunt > 0f || polite > 0f || quip > 0f || jokeShy > 0f
    companion object {
        val FIELDS = listOf("rhetorical" to "反問", "metaphor" to "比喻", "digress" to "離題", "stutter" to "結巴", "blunt" to "直接", "polite" to "禮貌", "quip" to "吐槽", "jokeShy" to "用玩笑掩飾害羞")
    }
    fun get(k: String) = when (k) { "rhetorical" -> rhetorical; "metaphor" -> metaphor; "digress" -> digress; "stutter" -> stutter; "blunt" -> blunt; "polite" -> polite; "quip" -> quip; "jokeShy" -> jokeShy; else -> 0f }
    fun with(k: String, v: Float): TalkStyle { val x = v.coerceIn(0f, 1f); return when (k) { "rhetorical" -> copy(rhetorical = x); "metaphor" -> copy(metaphor = x); "digress" -> copy(digress = x); "stutter" -> copy(stutter = x)
        "blunt" -> copy(blunt = x); "polite" -> copy(polite = x); "quip" -> copy(quip = x); "jokeShy" -> copy(jokeShy = x); else -> this } }
}
