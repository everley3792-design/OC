package app.ocshimeji.sim.chars

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.life.Pose

/**
 * How a character talks (plan A-03): every line in the game is written plainly (我, 你) and passes through here, so the same line
 * comes out different for every character — what they call themselves and you, their sentence endings, catchphrases, the words
 * they never say, and a speaking style. Deterministic (the caller's Rng).
 */
object Speech {
    /**
     * `toPlayer` lines use how they call you, which depends on how close you are (0..100). R4: `to` = the housemate spoken to
     * (their name and the attitude toward them), `mood` = happy / angry / sad (a mood can bring its own speaking style).
     * Order: who → how they call → words they never say → attitude → style → endings → catchphrases.
     */
    fun say(s: CharSpec, base: String, r: Rng, affinity: Int = 50, toPlayer: Boolean = false, to: Call? = null, mood: String? = null): String {
        if (base.startsWith("（") || base.isBlank()) return base
        var t = base
        val style = mood?.let { s.address.moods[it] }?.takeIf { it in CharSpec.STYLES } ?: s.style
        val self = if (s.selfRef == "我" && style == "古風") "在下" else s.selfRef
        if (self != "我") t = t.replace("我", self)
        if (toPlayer) {
            val mine = s.callFor(affinity)
            val call = when { mine != "你" -> mine; affinity < 25 || style == "正式" -> "您"; style == "古風" -> "閣下"; else -> "你" }
            if (call != "你") t = t.replace("你", call)
        } else if (to != null && to.tone == "敬重") t = t.replace("你", "您")
        for (w in s.banned) if (w.isNotBlank()) t = t.replace(w, "那個")
        if (to != null) t = when (to.tone) {
            "客氣" -> t.replace("！", "。").replace("～", "。")
            "撒嬌" -> if (r.chance(0.5)) end(t, "嘛～") else t
            "嘴硬" -> if (r.chance(0.4) && !t.startsWith("哼")) "哼，$t" else t
            else -> t
        }
        t = when (style) {
            "正式" -> t.replace("！", "。").replace("～", "。").replace("嘿嘿，", "").ifBlank { t }
            "可愛" -> end(t, if (s.endings.isNotEmpty()) "～" else if (r.chance(0.5)) "呢～" else "喔～")
            "冷淡" -> t.replace("！", "。").replace("～", "").substringBefore("，").let { if (it.endsWith("。") || it.endsWith("？")) it else "$it。" }
            "文青" -> if (r.chance(0.3)) end(t, "，像一首沒寫完的詩。") else t
            "元氣" -> t.replace("。", "！").let { if (it.endsWith("！")) it else "$it！" }
            "古風" -> end(t, if (r.chance(0.5)) "也" else "")
            "中二" -> if (r.chance(0.3)) "$t……這就是命運的指引。" else t
            else -> t
        }
        if (s.endings.isNotEmpty() && r.chance(0.6)) t = end(t, r.pick(s.endings))
        if (s.catchphrases.isNotEmpty() && r.chance(s.address.catchRate.toDouble())) {
            val where = s.address.catchWhen; val greet = GREET.any { base.startsWith(it) }; val surprise = SURPRISE.any { base.contains(it) }
            val c = r.pick(s.catchphrases)
            t = when {
                where.isEmpty() -> if (r.chance(0.5)) "$c，$t" else "$t $c"
                "greet" in where && greet -> "$c，$t"
                "surprise" in where && surprise -> "$c！$t"
                "end" in where -> "$t $c"
                else -> t
            }
        }
        return t
    }
    private val GREET = listOf("早", "嗨", "你好", "晚安", "午安", "歡迎", "我回來")
    private val SURPRISE = listOf("咦", "哇", "什麼", "真的假的", "！？", "欸")
    /** put an ending before the last punctuation mark */
    private fun end(t: String, e: String): String {
        if (e.isEmpty()) return t
        val i = t.indexOfLast { it in "。！？～…" }.let { if (it < 0) t.length else { var j = it; while (j > 0 && t[j - 1] in "。！？～…") j--; j } }
        return t.substring(0, i) + e + t.substring(i)
    }

    /** something to say while nothing happens: from their tags and traits, likes, season, dream, fears, memories */
    fun idle(s: CharSpec, r: Rng, custom: List<CustomTag> = emptyList()): String? {
        val pool = ArrayList<String>()
        Catalog.effects(s, custom).forEach { pool += it.lines }
        s.likes.take(4).forEach { pool += "好想要$it。"; pool += "說到$it，我最喜歡了。" }
        if (s.season.isNotBlank()) pool += "我最喜歡${s.season}天了。"
        if (s.color.isNotBlank()) pool += "${s.color}色的東西，看了就開心。"
        if (s.weather.isNotBlank()) pool += "今天要是${s.weather}就好了。"
        s.hobbies.take(3).forEach { pool += "想${it}。" }
        if (s.dream.isNotBlank()) pool += "總有一天，我要${s.dream}。"
        s.fears.take(2).forEach { pool += "（想到${it}就有點發抖）" }
        s.memories.take(3).forEach { pool += "我想起了……$it。" }
        s.catchphrases.forEach { pool += it }
        if (pool.isEmpty()) return null
        return say(s, r.pick(pool), r)
    }

    /** chat topics between two characters */
    fun topics(s: CharSpec, custom: List<CustomTag> = emptyList()): List<String> = Catalog.effects(s, custom).flatMap { it.topics } + s.likes.map { "$it 的事" } + s.hobbies + s.memories.map { "以前$it" }

    // ---------------- 情境預覽 (plan P-18) and 說話測試 ----------------
    val SCENES = listOf("早安", "被稱讚", "收到禮物", "被摸", "被丟出去", "肚子餓", "吵架", "生日", "晚安")
    /** how they react in a situation: a line and a pose */
    fun preview(s: CharSpec, scene: String, r: Rng, affinity: Int = 50): Pair<String, Pose> {
        val tsun = "嘴硬心軟" in s.traits; val shy = s.shy > 0.3f || "害羞" in s.traits; val cool = s.style == "冷淡"
        val (base, pose) = when (scene) {
            "早安" -> (if (s.greeting.isNotBlank()) s.greeting else if (s.wake <= 6) "早安！我已經醒很久了。" else if (s.oversleep > 0.5f) "嗯……早……再五分鐘……" else "早安，你今天也來了。") to (if (s.oversleep > 0.5f) Pose.DAYDREAM else Pose.HAPPY)
            "被稱讚" -> when { tsun -> "才、才沒有很開心。哼。" to Pose.SHY; shy -> "（臉紅）謝、謝謝……" to Pose.SHY; cool -> "嗯。知道了。" to Pose.STAND; else -> "嘿嘿，謝謝你！" to Pose.HAPPY }
            "收到禮物" -> when { tsun -> "這、這是給我的？……我會好好收著的。" to Pose.SHY; s.likes.isNotEmpty() -> "哇！如果是${s.likes[0]}就太好了！" to Pose.HAPPY; else -> "給我的嗎？謝謝你！" to Pose.HAPPY }
            "被摸" -> when { s.petSpot == "頭" && !shy -> "嘿嘿，頭被摸了。" to Pose.PETTED; shy -> "哇、哇……（縮起來）" to Pose.SHY; else -> "好舒服……" to Pose.PETTED }
            "被丟出去" -> when { s.axis(1) > 0.25f || "不怕痛" in s.tags -> "再一次！再一次！" to Pose.HAPPY; s.temper > 0.3f -> "你在做什麼啦！" to Pose.ANGRY; s.cry > 0.3f -> "嗚……好可怕。" to Pose.SAD; else -> "頭好暈……" to Pose.DIZZY }
            "肚子餓" -> (if ("貪吃" in s.traits || "吃貨" in s.tags) "餓扁了！現在、馬上要吃東西！" else "肚子有一點餓了。") to Pose.STAND
            "吵架" -> when { s.temper > 0.3f -> "我才沒有錯！" to Pose.ANGRY; s.cry > 0.3f -> "（眼淚掉下來）為什麼要這樣說……" to Pose.SAD; s.axis(4) > 0.3f -> "我們都冷靜一下好不好？" to Pose.STAND; else -> "……哼。" to Pose.ANGRY }
            "生日" -> (if (s.birthday.isNotBlank()) "今天是我的生日！你記得嗎？" else "生日？我也不知道我是哪天生的。") to Pose.HAPPY
            "晚安" -> (if (s.nightOwl > 0.5f || s.sleep >= 1 && s.sleep < 6) "晚安？夜晚才剛開始呢。" else "晚安，明天見。") to (if (s.nightOwl > 0.5f) Pose.HAPPY else Pose.DAYDREAM)
            else -> "……？" to Pose.STAND
        }
        return say(s, base, r, affinity, toPlayer = true) to pose
    }
}
