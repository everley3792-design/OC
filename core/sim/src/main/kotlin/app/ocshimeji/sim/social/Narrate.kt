package app.ocshimeji.sim.social

import app.ocshimeji.sim.Rng

/**
 * Narrative descriptions (plan 13.3 / 13.9, first 10 activities): a short paragraph about what someone is doing right now, made of
 * fragments × mood × their concepts. The same engine as the lines: fragments, patterns, conditions; fully offline.
 */
object Narrate {
    val ACTS = listOf("sleep", "read", "cook", "meal", "tv", "bathe", "water", "window", "tidy", "daydream")
    private val BODY = mapOf(
        "sleep" to listOf("{名}縮在被子裡，只露出一點頭髮。", "{名}睡得很沉，呼吸慢慢的。", "{名}翻了個身，把被子捲成一團。"),
        "read" to listOf("{名}窩在書架旁，手指夾著書頁。", "{名}看書看得入神，連有人經過都沒發現。", "{名}一頁一頁地翻，偶爾停下來想一想。"),
        "cook" to listOf("{名}站在爐台前，鍋裡冒著小小的泡泡。", "{名}一手拿鍋鏟，一手偷偷試了一口。", "廚房裡飄出香味，{名}正專心地調味。"),
        "meal" to listOf("{名}坐在餐桌前，一口一口地吃。", "{名}吃得臉頰鼓鼓的。", "{名}吃飯的時候很安靜，好像在認真品嚐。"),
        "tv" to listOf("{名}陷在沙發裡，眼睛盯著電視。", "電視的光映在{名}臉上。", "{名}跟著電視裡的人一起笑出聲。"),
        "bathe" to listOf("浴室裡傳出{名}哼歌的聲音。", "{名}泡在熱水裡，整個人鬆了下來。", "水氣裡，{名}把下巴沉進水面。"),
        "water" to listOf("{名}拿著澆水壺，小心地繞著盆栽走一圈。", "{名}摸了摸葉子，像在確認它今天好不好。", "{名}一邊澆水，一邊跟植物小聲說話。"),
        "window" to listOf("{名}趴在窗邊，看著外面發呆。", "{名}的視線跟著一朵雲慢慢移動。", "窗外的光照在{名}身上，暖暖的。"),
        "tidy" to listOf("{名}把散落的東西一件一件放回原位。", "{名}捲起袖子，從角落開始收拾。", "{名}擦著桌子，擦得發亮。"),
        "daydream" to listOf("{名}眼神放空，不知道在想什麼。", "{名}托著下巴，嘴角偷偷上揚。", "{名}盯著天花板，好像在數什麼。"),
    )
    private val MOOD = mapOf(
        1 to listOf("看起來心情很好。", "嘴裡哼著不成調的歌。", "時不時露出滿足的表情。"),
        0 to listOf("一切都很平常。", "時間慢慢地過去。", "屋子裡很安靜。"),
        -1 to listOf("眉頭有點皺。", "看起來有心事。", "偶爾嘆一口氣。"),
    )
    private val THOUGHT = listOf("也許在想{概念}的事。", "心裡大概又在想{概念}。", "說不定正想著{概念}。")
    /** a paragraph for this activity, or null if it is not one of the ten */
    fun describe(name: String, act: String, mood: Int, concepts: List<String>, r: Rng): String? {
        val body = BODY[act] ?: return null
        val sb = StringBuilder(r.pick(body).replace("{名}", name))
        sb.append(r.pick(MOOD[mood.coerceIn(-1, 1)]!!))
        if (concepts.isNotEmpty() && act != "sleep") sb.append(r.pick(THOUGHT).replace("{概念}", r.pick(concepts)))
        return sb.toString()
    }
}
