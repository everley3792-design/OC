package app.ocshimeji.sim.social

import kotlinx.serialization.Serializable

/**
 * The memory ledger (plan 13.9): favours and grudges between residents, and the ideas you gave (who = "player").
 * `settled` = paid back / forgiven / taken revenge for; `cause` = the memory this one grew out of (the timeline draws the thread).
 */
@Serializable
class Memory(val id: Int, val who: String, val about: String, val kind: String, val what: String, val minute: Double, var weight: Int, var settled: Boolean = false, val cause: Int = -1) {
    companion object { const val FAVOR = "favor"; const val GRUDGE = "grudge"; const val IDEA = "idea" }
}

/** what two residents have done together (both directions together; a < b); flavour tags come from these counts */
@Serializable
class PairStat(val a: String, val b: String, val n: MutableMap<String, Int> = mutableMapOf(), var lastDay: Long = -1)

/** a clash spark between two residents (plan 13.4); `stage` 0 摩擦 1 衝突 2 磨合 3 疏遠 */
@Serializable
class Spark(val id: String, val a: String, val b: String, var stage: Int = 0, var heat: Int = 0, var lastMinute: Double = -1e9)

/** a quarrel turned cold (plan C-06): they avoid each other until someone apologises, time passes, or you help */
@Serializable
class Feud(val a: String, val b: String, val since: Double, val cause: String)

/** a worry bubble (plan D-01); `shown` = on the screen now; `mailed` = waited too long, now in the mailbox */
@Serializable
class Worry(val kind: String, val about: String = "", val thing: String = "", val since: Double, var shown: Boolean = false, var mailed: Boolean = false)

/** something they wish for (plan A-07) */
@Serializable
class Wish(val kind: String, val target: String = "", val thing: String = "", val text: String, val day: Long, val base: Int = 0, var done: Boolean = false)

/** something they ask you for (plan E-06) */
@Serializable
class Ask(val kind: String, val thing: String = "", val text: String, val since: Double)

/** the mailbox: what did not fit in the disturbance budget, day-end cards, serial episodes */
@Serializable
class Mail(val id: Int, val minute: Double, val who: String, val kind: String, val title: String, val text: String, var read: Boolean = false)

/** the end of a day (plan J-06): three things */
@Serializable
class DayCard(val day: Long, val lines: List<String>, var seen: Boolean = false)

/** a pot cooked for everyone (plan B-06) */
@Serializable
class Pot(val dish: String, val cook: String, var servings: Int, val quality: Int, val minute: Double, val eaters: MutableList<String> = mutableListOf())

/** the serial drama's progress */
@Serializable
class Serial(var episode: Int = 0, var cast: List<String> = emptyList(), var nextDay: Long = -1, val flags: MutableList<String> = mutableListOf())

/** everything social in one world that is saved */
@Serializable
class SocState(
    var nextId: Int = 1,
    val memories: MutableList<Memory> = mutableListOf(),
    val pairs: MutableList<PairStat> = mutableListOf(),
    val sparks: MutableList<Spark> = mutableListOf(),
    val feuds: MutableList<Feud> = mutableListOf(),
    val mail: MutableList<Mail> = mutableListOf(),
    val cards: MutableList<DayCard> = mutableListOf(),
    var pot: Pot? = null,
    /** the last day settled (relationships, statuses, wishes) */
    var settledDay: Long = -1,
    /** the disturbance budget (plan 4.5): real seconds watched, and the start of the current window */
    var realSec: Double = 0.0, var windowStart: Double = 0.0, var windowUsed: Int = 0,
    /** 0 安靜 1 普通 2 熱鬧 */
    var lively: Int = 1,
    /** event id (or id:pair) → last minute it happened (cooldowns) */
    val seen: MutableMap<String, Double> = mutableMapOf(),
    val serial: Serial = Serial(),
    /** dirty dishes in the sink, and chores done per person per day (plan B-05) */
    var dishes: Int = 0,
    val chores: MutableMap<String, Int> = mutableMapOf(),
    val choresYesterday: MutableMap<String, Int> = mutableMapOf(),
    /** next minute the event scan runs */
    var nextScan: Double = 0.0,
    /** flags set by the player's scripts (plan 13.3) */
    val flags: MutableList<String> = mutableListOf(),
    /** a script waiting for your answer before it plays */
    var choice: PendingChoice? = null,
)
@Serializable class PendingChoice(val script: String, val a: String, val b: String, val since: Double)
