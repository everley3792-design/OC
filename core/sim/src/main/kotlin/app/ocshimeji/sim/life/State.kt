package app.ocshimeji.sim.life

import kotlinx.serialization.Serializable

/** everything about one world's life that is saved (positions included, so a world reopens where it was) */
@Serializable
class Life(
    var houseId: String,
    var townName: String = "",
    var homeName: String = "",
    var minute: Double,
    var clockMode: String = "REAL",
    var speed: Double = 1.0,
    val seed: Long,
    var rngState: Long,
    val people: MutableList<Person> = mutableListOf(),
    /** mess per room 0..100 (more people doing things → messier; tidying clears it) */
    val mess: MutableMap<String, Float> = mutableMapOf(),
    var lastRealMs: Long = 0,
    val log: MutableList<LogLine> = mutableListOf(),
    var away: AwaySummary? = null,
    /** move-in day still to be played (characters arrive at the door one by one) */
    var arriving: Boolean = false,
    /** the minute the world began (day 1) */
    var startMinute: Double = 0.0,
) {
    /** 第 N 天 */
    val day: Long get() = kotlin.math.floor(minute / 1440).toLong() - kotlin.math.floor(startMinute / 1440).toLong() + 1
}

@Serializable
class Person(
    val id: String, val libId: String, var name: String, var adult: Boolean = true, var room: String,
    val needs: MutableMap<String, Float> = mutableMapOf(),
    val moods: MutableList<MoodState> = mutableListOf(),
    var x: Float = 0f, var y: Float = 0f, var facing: Int = 1,
    var act: String? = null, var actPiece: Int = -1, var actSlot: Int = -1, var actStart: Double = 0.0, var actEnd: Double = 0.0,
    /** the next activity already decided (cooking → the meal) */
    var next: String? = null,
    var wake: Int = 7, var sleep: Int = 23,
    /** 外向, 活潑, 認真, 坦率, 溫柔 — each −1..1 */
    val axes: MutableList<Float> = mutableListOf(0f, 0f, 0f, 0f, 0f),
    val likes: List<String> = emptyList(),
    val recent: MutableMap<String, Double> = mutableMapOf(),
    var lastPet: Double = -1e9,
    /** the reasons behind the current choice (人物卡 「為什麼」) */
    var why: List<String> = emptyList(),
) {
    fun need(n: Need) = needs[n.name] ?: 70f
    fun setNeed(n: Need, v: Float) { needs[n.name] = v.coerceIn(0f, 100f) }
}

@Serializable class MoodState(val id: String, var until: Double)
@Serializable class LogLine(val minute: Double, val who: String, val text: String, val away: Boolean = false)
@Serializable class AwaySummary(val fromMinute: Double, val toMinute: Double, val lines: List<String>)

/** personality axes by index */
object Axis { const val OUTGOING = 0; const val ACTIVE = 1; const val DILIGENT = 2; const val FRANK = 3; const val GENTLE = 4
    val ZH = listOf("外向" to "內向", "活潑" to "沉穩", "認真" to "隨性", "坦率" to "含蓄", "溫柔" to "好勝")
    /** a first guess from trait words (the full character creation is M2) */
    fun fromWords(words: List<String>): MutableList<Float> {
        val a = mutableListOf(0f, 0f, 0f, 0f, 0f)
        for (w in words) when {
            w.contains("黏人") || w.contains("外向") || w.contains("健談") -> a[OUTGOING] += 0.4f
            w.contains("害羞") || w.contains("內向") -> a[OUTGOING] -= 0.4f
            w.contains("好奇") || w.contains("活潑") || w.contains("元氣") -> a[ACTIVE] += 0.4f
            w.contains("慵懶") || w.contains("沉穩") -> a[ACTIVE] -= 0.4f
            w.contains("認真") || w.contains("整齊") -> a[DILIGENT] += 0.4f
            w.contains("溫和") || w.contains("溫柔") -> a[GENTLE] += 0.4f
            w.contains("好勝") -> a[GENTLE] -= 0.4f
        }
        return a.map { it.coerceIn(-1f, 1f) }.toMutableList()
    }
}

/** something that happened this step, for the screen (bubbles, hearts, sounds); never saved */
data class SimEvent(val kind: String, val who: String, val text: String = "")
