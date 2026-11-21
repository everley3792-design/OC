package app.ocshimeji.sim.script

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Player-made events (plan 13.3 自創事件與劇本): blocks for the editor, a JSON form and a readable text form that convert both ways.
 * Nothing in a script runs code: it only says who (roles), when (trigger), what happens (steps) and what changes (results), and the
 * life plays it like any other scene. The relationship rules apply inside scripts too: a script that touches romance only ever
 * matches two adults, and only when romance is on.
 */
@Serializable
data class ScriptDef(
    val id: String, val name: String, val author: String = "",
    /** A and B (a scene is two people; a third role arrives in 1.0) */
    val roles: List<RoleDef> = listOf(RoleDef("A"), RoleDef("B")),
    val trigger: Trigger = Trigger(),
    val steps: List<Step> = emptyList(),
    val results: List<Result> = emptyList(),
    /** a question for you before it plays; each answer has its own steps and results */
    val choice: ChoiceDef? = null,
    val closeup: Boolean = false,
    val cooldownDays: Int = 1,
    val enabled: Boolean = true,
) {
    /** touches romance: crush results, or words of love */
    val romantic: Boolean get() = (results + (choice?.options?.flatMap { it.results } ?: emptyList())).any { it.kind == "crush" } ||
        (steps + (choice?.options?.flatMap { it.steps } ?: emptyList())).any { s -> Scripts.ROMANCE_WORDS.any { s.text.contains(it) } }
}
/** who can play a role: "any", "tag:劍修", "trait:健談", "name:肉桂捲" */
@Serializable data class RoleDef(val key: String, val match: String = "any")
/** when: game hours (from..to, may wrap), A's feeling for B, flags, a chance per check */
@Serializable data class Trigger(val from: Int = 0, val to: Int = 24, val minLike: Int = 0, val maxLike: Int = 100, val flag: String = "", val notFlag: String = "", val chance: Int = 30, val mood: String = "")
/** say / pose / fx; `role` = A or B */
@Serializable data class Step(val kind: String, val role: String = "A", val text: String = "", val pose: String = "", val fx: String = "")
/** like / trust / conflict / crush (from → to, value); mood (role, text = mood card); memory (role remembers the other: text, value > 0 favour, < 0 grudge); flag (text) */
@Serializable data class Result(val kind: String, val role: String = "A", val to: String = "B", val value: Int = 0, val text: String = "")
@Serializable data class ChoiceDef(val prompt: String, val options: List<OptionDef>)
@Serializable data class OptionDef(val label: String, val steps: List<Step> = emptyList(), val results: List<Result> = emptyList())

object Scripts {
    val ROMANCE_WORDS = listOf("喜歡你", "愛你", "交往", "告白", "約會", "結婚", "親親", "接吻", "嫁給", "娶", "在一起")
    val POSES = linkedMapOf("站" to "STAND", "開心" to "HAPPY", "生氣" to "ANGRY", "難過" to "SAD", "害羞" to "SHY", "頭暈" to "DIZZY", "坐" to "SIT", "躺" to "LIE",
        "說話" to "TALK", "看" to "LOOK", "發呆" to "DAYDREAM", "揮" to "SWING", "吃" to "EAT", "看書" to "READ", "唱歌" to "SING")
    val FX = linkedMapOf("愛心" to "heart", "汗" to "sweat", "怒" to "anger", "黑線" to "gloom", "震驚" to "shock", "閃亮" to "sparkle", "燃燒" to "fire", "靈魂出竅" to "soul", "冷風" to "chill", "石化" to "stone")
    val RESULT_ZH = linkedMapOf("好感" to "like", "信任" to "trust", "衝突" to "conflict", "心動" to "crush", "心情" to "mood", "記憶" to "memory", "旗標" to "flag")
    const val MAX_STEPS = 30; const val MAX_TEXT = 80
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; prettyPrint = true }
    fun toJson(s: ScriptDef): String = json.encodeToString(s)
    fun fromJson(t: String): ScriptDef = try { json.decodeFromString(t) } catch (e: Exception) { throw IllegalArgumentException("JSON 看不懂：" + (e.message ?: "").lineSequence().first().take(80)) }

    /** what is wrong with a script (empty = fine); every rule the life follows, checked before it is saved */
    fun problems(s: ScriptDef): List<String> {
        val out = ArrayList<String>()
        if (s.name.isBlank()) out += "還沒有標題"
        if (s.roles.size !in 1..2 || s.roles.map { it.key }.toSet() != s.roles.map { it.key }.toSet() || s.roles.any { it.key !in setOf("A", "B") }) out += "角色只能是 A、B（三人以上在 1.0 製作）"
        val all = s.steps + (s.choice?.options?.flatMap { it.steps } ?: emptyList())
        if (all.isEmpty()) out += "至少要有一句台詞或一個動作"
        if (s.steps.size > MAX_STEPS || (s.choice?.options?.any { it.steps.size > MAX_STEPS } == true)) out += "一段最多 $MAX_STEPS 步"
        all.forEach { st -> if (st.role !in s.roles.map { it.key }) out += "「${st.text.ifBlank { st.kind }}」用了沒有的角色 ${st.role}"; if (st.text.length > MAX_TEXT) out += "台詞最多 $MAX_TEXT 字：「${st.text.take(12)}…」"
            if (st.kind == "pose" && st.pose !in POSES.values) out += "看不懂的動作：${st.pose}"; if (st.kind == "fx" && st.fx !in FX.values) out += "看不懂的特效：${st.fx}" }
        (s.results + (s.choice?.options?.flatMap { it.results } ?: emptyList())).forEach { r -> if (r.kind !in RESULT_ZH.values) out += "看不懂的結果：${r.kind}"; if (r.kind in setOf("like", "trust", "conflict", "crush") && r.value !in -20..20) out += "數值一次最多改 20" }
        if (s.trigger.from !in 0..24 || s.trigger.to !in 0..24) out += "時間要在 0～24"
        if (s.trigger.chance !in 1..100) out += "機率要在 1～100"
        if (s.choice != null && s.choice.options.size !in 2..4) out += "選項要有 2～4 個"
        return out.distinct()
    }

    // ================= the readable text form =================
    /**
     * ```
     * # 標題：雨天的傘
     * # 角色：A=任何人 B=標籤:社畜
     * # 時間：17-20
     * # 機率：30
     * # 好感：40-100
     * # 需要旗標：x    # 沒有旗標：x    # 特寫    # 冷卻：2
     * [A] 要不要一起撐傘？
     * @A 開心
     * !B 愛心
     * = 好感 B→A +3
     * = 心情 A socgood
     * = 記憶 B +1 一起撐傘
     * = 旗標 umbrella
     * ? 你要怎麼做？
     * - 讓牠們一起回家
     * [B] 好。
     * - 不管牠們
     * ```
     */
    fun parse(text: String, id: String = "s", author: String = ""): ScriptDef {
        var name = ""; var roles = listOf(RoleDef("A"), RoleDef("B")); var trig = Trigger(); var closeup = false; var cool = 1
        val steps = ArrayList<Step>(); val results = ArrayList<Result>()
        var prompt: String? = null; val options = ArrayList<Triple<String, ArrayList<Step>, ArrayList<Result>>>()
        fun bad(n: Int, why: String): Nothing = throw IllegalArgumentException("第 $n 行：$why")
        text.lines().forEachIndexed { i, raw ->
            val n = i + 1; val line = raw.trim(); if (line.isEmpty() || line.startsWith("//")) return@forEachIndexed
            val (st, rs) = options.lastOrNull()?.let { it.second to it.third } ?: (steps to results)
            when {
                line.startsWith("#") -> { val h = line.removePrefix("#").trim(); val k = h.substringBefore("：").substringBefore(":").trim(); val v = h.substringAfter("：", h.substringAfter(":", "")).trim()
                    when (k) {
                        "標題" -> name = v
                        "角色" -> roles = v.split(Regex("\\s+")).filter { it.isNotBlank() }.map { r -> val key = r.substringBefore("=").trim(); RoleDef(key, matchOf(r.substringAfter("=", "任何人").trim()) ?: bad(n, "看不懂的角色條件：$r")) }
                        "時間" -> { val p = v.split("-", "～", "~").map { it.trim().toIntOrNull() ?: bad(n, "時間要寫成 17-20") }; if (p.size != 2) bad(n, "時間要寫成 17-20"); trig = trig.copy(from = p[0], to = p[1]) }
                        "機率" -> trig = trig.copy(chance = v.removeSuffix("%").trim().toIntOrNull() ?: bad(n, "機率要是 1～100 的數字"))
                        "好感" -> { val p = v.split("-", "～", "~").map { it.trim().toIntOrNull() ?: bad(n, "好感要寫成 40-100") }; trig = trig.copy(minLike = p[0], maxLike = p.getOrElse(1) { 100 }) }
                        "需要旗標" -> trig = trig.copy(flag = v); "沒有旗標" -> trig = trig.copy(notFlag = v)
                        "心情" -> trig = trig.copy(mood = when (v) { "好", "好的時候" -> "good"; "不好", "不好的時候" -> "bad"; else -> bad(n, "心情只能寫「好」或「不好」") })
                        "特寫" -> closeup = true
                        "冷卻" -> cool = v.removeSuffix("天").trim().toIntOrNull() ?: bad(n, "冷卻要寫天數")
                        else -> bad(n, "看不懂的設定「$k」")
                    } }
                line.startsWith("[") -> { val role = line.substringAfter("[").substringBefore("]").trim(); if (!line.contains("]")) bad(n, "台詞要寫成 [A] 句子")
                    val t = line.substringAfter("]").trim(); if (t.isEmpty()) bad(n, "台詞是空的"); st += Step("say", role, t) }
                line.startsWith("@") -> { val role = line.drop(1).substringBefore(" ").trim(); val p = line.substringAfter(" ", "").trim(); st += Step("pose", role, pose = POSES[p] ?: p.uppercase().takeIf { it in POSES.values } ?: bad(n, "看不懂的動作「$p」（可以用：${POSES.keys.joinToString("、")}）")) }
                line.startsWith("!") -> { val role = line.drop(1).substringBefore(" ").trim(); val f = line.substringAfter(" ", "").trim(); st += Step("fx", role, fx = FX[f] ?: f.takeIf { it in FX.values } ?: bad(n, "看不懂的特效「$f」（可以用：${FX.keys.joinToString("、")}）")) }
                line.startsWith("=") -> rs += result(line.drop(1).trim()) { bad(n, it) }
                line.startsWith("?") -> { if (prompt != null) bad(n, "一個劇本只能有一個問題"); prompt = line.drop(1).trim() }
                line.startsWith("-") -> { if (prompt == null) bad(n, "選項前面要先有「? 問題」"); options += Triple(line.drop(1).trim(), ArrayList(), ArrayList()) }
                else -> bad(n, "看不懂「${line.take(20)}」（台詞用 [A]、動作用 @A、特效用 !A、結果用 =、設定用 #）")
            }
        }
        val choice = prompt?.let { p -> ChoiceDef(p, options.map { (l, s, r) -> OptionDef(l, s, r) }) }
        return ScriptDef(id, name, author, roles, trig, steps, results, choice, closeup, cool)
    }
    private fun matchOf(zh: String): String? = when {
        zh == "任何人" || zh == "any" -> "any"
        zh.startsWith("標籤:") || zh.startsWith("標籤：") -> "tag:" + zh.drop(3)
        zh.startsWith("特質:") || zh.startsWith("特質：") -> "trait:" + zh.drop(3)
        zh.startsWith("名字:") || zh.startsWith("名字：") -> "name:" + zh.drop(3)
        zh.startsWith("tag:") || zh.startsWith("trait:") || zh.startsWith("name:") -> zh
        else -> null
    }
    private fun matchZh(m: String) = when { m == "any" -> "任何人"; m.startsWith("tag:") -> "標籤:" + m.drop(4); m.startsWith("trait:") -> "特質:" + m.drop(6); m.startsWith("name:") -> "名字:" + m.drop(5); else -> m }
    private fun result(s: String, bad: (String) -> Nothing): Result {
        val parts = s.split(Regex("\\s+")); val k = RESULT_ZH[parts.getOrNull(0)] ?: bad("看不懂的結果「${parts.getOrNull(0)}」（可以用：${RESULT_ZH.keys.joinToString("、")}）")
        return when (k) {
            "like", "trust", "conflict", "crush" -> { val ft = parts.getOrNull(1) ?: bad("要寫誰對誰，例如 B→A"); val (f, t) = ft.split("→", "->").let { if (it.size != 2) bad("要寫誰對誰，例如 B→A"); it[0].trim() to it[1].trim() }
                Result(k, f, t, parts.getOrNull(2)?.removePrefix("+")?.toIntOrNull() ?: bad("要寫改多少，例如 +3")) }
            "mood" -> Result(k, parts.getOrNull(1) ?: bad("要寫誰"), text = parts.getOrNull(2) ?: bad("要寫心情小卡"))
            "memory" -> Result(k, parts.getOrNull(1) ?: bad("要寫誰"), value = parts.getOrNull(2)?.removePrefix("+")?.toIntOrNull() ?: bad("記憶要寫 +1（恩情）或 -1（記仇）"), text = parts.drop(3).joinToString(" ").ifBlank { bad("記憶要寫內容") })
            else -> Result(k, text = parts.getOrNull(1) ?: bad("旗標要有名字"))
        }
    }
    fun toText(s: ScriptDef): String {
        val b = StringBuilder()
        b.append("# 標題：${s.name}\n# 角色：${s.roles.joinToString(" ") { "${it.key}=${matchZh(it.match)}" }}\n# 時間：${s.trigger.from}-${s.trigger.to}\n# 機率：${s.trigger.chance}\n")
        if (s.trigger.minLike > 0 || s.trigger.maxLike < 100) b.append("# 好感：${s.trigger.minLike}-${s.trigger.maxLike}\n")
        if (s.trigger.flag.isNotBlank()) b.append("# 需要旗標：${s.trigger.flag}\n"); if (s.trigger.notFlag.isNotBlank()) b.append("# 沒有旗標：${s.trigger.notFlag}\n")
        if (s.trigger.mood.isNotBlank()) b.append("# 心情：${if (s.trigger.mood == "good") "好" else "不好"}\n")
        if (s.closeup) b.append("# 特寫\n"); if (s.cooldownDays != 1) b.append("# 冷卻：${s.cooldownDays}\n")
        fun steps(l: List<Step>) = l.forEach { st -> b.append(when (st.kind) { "say" -> "[${st.role}] ${st.text}"; "pose" -> "@${st.role} ${POSES.entries.firstOrNull { it.value == st.pose }?.key ?: st.pose}"; else -> "!${st.role} ${FX.entries.firstOrNull { it.value == st.fx }?.key ?: st.fx}" }).append('\n') }
        fun results(l: List<Result>) = l.forEach { r -> val zh = RESULT_ZH.entries.first { it.value == r.kind }.key
            b.append("= ").append(when (r.kind) { "mood" -> "$zh ${r.role} ${r.text}"; "memory" -> "$zh ${r.role} ${if (r.value > 0) "+" else ""}${r.value} ${r.text}"; "flag" -> "$zh ${r.text}"; else -> "$zh ${r.role}→${r.to} ${if (r.value >= 0) "+" else ""}${r.value}" }).append('\n') }
        steps(s.steps); results(s.results)
        s.choice?.let { c -> b.append("? ${c.prompt}\n"); for (o in c.options) { b.append("- ${o.label}\n"); steps(o.steps); results(o.results) } }
        return b.toString()
    }
}
