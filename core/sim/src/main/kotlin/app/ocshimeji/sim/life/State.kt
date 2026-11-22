package app.ocshimeji.sim.life

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.chars.CustomTag
import app.ocshimeji.sim.script.ScriptDef
import app.ocshimeji.sim.social.Ask
import app.ocshimeji.sim.town.Goal
import app.ocshimeji.sim.town.Outing
import app.ocshimeji.sim.town.PieceRec
import app.ocshimeji.sim.town.TownState
import app.ocshimeji.sim.town.Tx
import app.ocshimeji.sim.social.SocState
import app.ocshimeji.sim.social.Wish
import app.ocshimeji.sim.social.Worry
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
    /** relationships, one direction each (plan 12.5) */
    val rels: MutableList<Rel> = mutableListOf(),
    /** romance is off unless the player turns it on; never for minors */
    var romance: Boolean = false,
    /** everything social (M4): the memory ledger, pair statistics, sparks, quarrels, the mailbox, day cards, the shared pot… */
    val soc: SocState = SocState(),
    // ---- M5: what the player made, copied into this world (so the world plays the same wherever it is opened)
    /** custom food, drinks and gifts (plan 12.6 自訂物品) */
    val items: MutableList<WorldItem> = mutableListOf(),
    /** wallpaper and floor per room: library-relative picture paths (plan G-02 in part) */
    val decor: MutableMap<String, Decor> = mutableMapOf(),
    /** the player's tags (tag editor) and events (script editor) in use in this world */
    val tags: MutableList<CustomTag> = mutableListOf(),
    val scripts: MutableList<ScriptDef> = mutableListOf(),
    /** imported music for this home (library-relative path) */
    var music: String = "",
    // ---- M6: the town, money, things, furniture
    /** star coins (plan I-01): only ever changed through the ledger */
    var wallet: Int = 0,
    val ledger: MutableList<Tx> = mutableListOf(),
    /** the bag / storage: good or item id → how many (only ever changed through the ledger) */
    val bag: MutableMap<String, Int> = mutableMapOf(),
    /** the furniture as you arranged it (empty = the house as built) */
    val layout: MutableList<PieceRec> = mutableListOf(),
    val town: TownState = TownState(),
    /** today's three small goals (plan I-09) */
    val goals: MutableList<Goal> = mutableListOf(), var goalsDay: Long = -1,
    // ---- M7: counts, titles, diary, dreams, achievements, the book, plants, stars
    val prog: Progress = Progress(),
    // ---- R2: your hand on the weather, the season and the clock
    val env: EnvState = EnvState(),
    // ---- R5: how things look — states that stay (a messy bed, a book left out; key "kind@x,y") and things left on the floor
    val things: MutableMap<String, String> = mutableMapOf(),
    val litter: MutableList<Litter> = mutableListOf(),
) {
    /** 第 N 天 */
    val day: Long get() = kotlin.math.floor(minute / 1440).toLong() - kotlin.math.floor(startMinute / 1440).toLong() + 1
}

@Serializable
class Person(
    val id: String, val libId: String,
    /** everything about who they are (this world's own copy) */
    var spec: CharSpec = CharSpec(),
    var room: String,
    val needs: MutableMap<String, Float> = mutableMapOf(),
    val moods: MutableList<MoodState> = mutableListOf(),
    var x: Float = 0f, var y: Float = 0f, var facing: Int = 1,
    var act: String? = null, var actPiece: Int = -1, var actSlot: Int = -1, var actStart: Double = 0.0, var actEnd: Double = 0.0,
    /** the next activity already decided (cooking → the meal) */
    var next: String? = null,
    val recent: MutableMap<String, Double> = mutableMapOf(),
    var lastPet: Double = -1e9,
    /** the reasons behind the current choice (人物卡 「為什麼」) */
    var why: List<String> = emptyList(),
    /** how close they feel to you, 0..100 (plan A-13) */
    var affinity: Int = 50,
    /** petting spots you found out they love */
    val found: MutableList<String> = mutableListOf(),
    var secretTold: Boolean = false,
    /** who they are chatting with */
    var with: String? = null,
    /** the last day a birthday was celebrated */
    var birthdayDay: Long = -1,
    /** out on the phone's desktop (plan 2.3: one simulation, the desktop is another way of watching it) */
    var desk: Boolean = false,
    // ---- M4: life and social
    /** today's little state (plan A-05) and the day it was rolled */
    var status: String = "", var statusDay: Long = -1,
    var wish: Wish? = null,
    var worry: Worry? = null,
    /** something they ask you for (plan E-06) */
    var ask: Ask? = null,
    /** observe / suggest / command (plan 4.2) */
    var control: String = "observe",
    /** a multi-step plan for the day (plan B-03): activity ids, first one next */
    val plan: MutableList<String> = mutableListOf(),
    /** foods and dishes whose taste you found out (plan A-10): id → 1 liked, 0 fine, −1 disliked */
    val tasted: MutableMap<String, Int> = mutableMapOf(),
    /** the social act (or event) of the current chat */
    var soc: String? = null,
    /** what you told them when they asked you (plan E-04) */
    val knows: MutableMap<String, String> = mutableMapOf(),
    var lastWorry: Double = -1e9, var lastAsk: Double = -1e9, var lastYouChat: Double = -1e9,
    /** your suggestion or command waiting to be done: "act:<id>" or "soc:<act>:<person>" */
    var order: String? = null,
    /** out in town (plan B-12) */
    var out: Outing? = null,
    /** what they did today, how many times (boredom and novelty; cleared each morning) */
    val today: MutableMap<String, Int> = mutableMapOf(),
    /** R3: your next orders, after `order` (at most 5 in all, each can be cancelled) */
    val queue: MutableList<String> = mutableListOf(),
) {
    val name: String get() = spec.name
    val adult: Boolean get() = spec.adult
    fun need(n: Need) = needs[n.name] ?: 70f
    fun setNeed(n: Need, v: Float) { needs[n.name] = v.coerceIn(0f, 100f) }
}

@Serializable class MoodState(val id: String, var until: Double)
/**
 * One line of the timeline (plan K-03). `kind`: life / social / event / worry / you / day; `weight` 1 small … 3 big (the day-end card
 * and fast-forward pick the big ones); `fav` = kept by the player (never dropped); `cause` = the memory it grew out of.
 */
@Serializable class LogLine(val minute: Double, val who: String, val text: String, val away: Boolean = false,
                            val kind: String = "life", val weight: Int = 1, var fav: Boolean = false, val cause: Int = -1, val with: String = "",
                            /** R1 memories: a sound word, one line of narration, and how long it took (game minutes) */
                            val sound: String = "", val aside: String = "", val dur: Double = 0.0)
@Serializable class AwaySummary(val fromMinute: Double, val toMinute: Double, val lines: List<String>)

/** personality axes by index */
object Axis { const val OUTGOING = 0; const val ACTIVE = 1; const val DILIGENT = 2; const val FRANK = 3; const val GENTLE = 4
    val ZH = listOf("外向" to "內向", "活潑" to "沉穩", "認真" to "隨性", "坦率" to "含蓄", "溫柔" to "好勝")
}

/** something that happened this step, for the screen (bubbles, hearts, sounds); never saved */
data class SimEvent(val kind: String, val who: String, val text: String = "")

/** a custom item as one world knows it: food / drink (taste, how filling) and gifts (the words people like) */
@Serializable class WorldItem(val id: String, val name: String, val kind: String, val taste: String = "", val full: Float = 0f, val words: List<String> = emptyList(), val image: String = "",
    /** furniture: footprint, spots (dx, dy, pose 0 sit / 1 lie / 2 stand), what it offers, its base price */
    val w: Int = 1, val h: Int = 1, val spots: List<List<Float>> = emptyList(), val offers: List<String> = emptyList(), val price: Int = 0, val series: String = "")
/** something left on the floor (R5): a snack wrapper, a book, a cup — gone when someone tidies the room */
@Serializable class Litter(val kind: String, val x: Int, val y: Int, val by: String = "", val minute: Double = 0.0)
@Serializable class Decor(val wall: String = "", val floor: String = "")
