package app.ocshimeji.sim.chars

import kotlinx.serialization.Serializable

/**
 * A tag the player made in the tag editor (plan 13.9): like a built-in tag, it is a bundle of effects — what they like doing more or
 * less, things they say, chat topics, concepts for topic collisions, situations they react to. Free words without a definition
 * stay what they were in M2 (a label with no effect).
 */
@Serializable
data class CustomTag(
    val id: String, val note: String = "",
    /** activity id or activity tag → score multiplier (0.2 … 3) */
    val act: Map<String, Float> = emptyMap(),
    val lines: List<String> = emptyList(),
    val topics: List<String> = emptyList(),
    val concepts: List<String> = emptyList(),
    /** dark / crowd / alone / sunlight / height / dizzy */
    val flags: List<String> = emptyList(),
) {
    fun effect() = Effect(act = act.mapValues { it.value.coerceIn(0.2f, 3f) }, lines = lines, topics = topics, flags = flags.toSet())
    companion object {
        val FLAGS = linkedMapOf("dark" to "怕黑", "crowd" to "怕吵", "alone" to "怕孤單", "sunlight" to "怕光", "height" to "怕高", "dizzy" to "容易暈")
        /** activity tags the editor offers (the ones `appeal` reads) */
        val ACT_KEYS = linkedMapOf("food" to "吃東西", "rest" to "休息睡覺", "lazy" to "懶洋洋", "active" to "活動身體", "calm" to "安靜的事", "dreamy" to "發呆想像", "tidy" to "整理打掃",
            "vain" to "打扮", "smart" to "動腦", "chat" to "聊天", "read" to "看書", "tv" to "看電視", "cook" to "煮飯", "water" to "照顧植物", "window" to "看窗外", "bathe" to "洗澡")
        /** null = fine, otherwise why not */
        fun problem(t: CustomTag): String? {
            if (t.id.isBlank()) return "標籤還沒有名字"
            if (t.id.length > 12) return "標籤名字最多 12 個字"
            if (Catalog.TAGS.containsKey(t.id) || Catalog.TRAITS.containsKey(t.id) || Catalog.QUIRKS.containsKey(t.id)) return "「${t.id}」已經是內建的標籤或特質"
            if (t.act.values.any { it !in 0.2f..3f }) return "加減分要在 0.2～3 倍之間"
            if (t.lines.size > 12 || t.topics.size > 12 || t.concepts.size > 12) return "台詞、話題、概念各最多 12 個"
            if (t.lines.any { it.length > 40 } || t.topics.any { it.length > 20 } || t.concepts.any { it.length > 12 }) return "句子太長了"
            if (t.flags.any { it !in FLAGS }) return "看不懂的反應"
            if (t.act.isEmpty() && t.lines.isEmpty() && t.topics.isEmpty() && t.concepts.isEmpty() && t.flags.isEmpty()) return "至少要有一種效果"
            return null
        }
    }
}
