package app.ocshimeji.sim.desk

import app.ocshimeji.sim.chars.Catalog
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.life.Axis
import app.ocshimeji.sim.life.Pose

/**
 * R6 (plan B-1): the desktop pet is three layers, all data.
 * - **Drives** (every 0.5 s): needs, mood, personality, the hour, the battery, you.
 * - **Intents** with a priority level: 5 reflex, 4 care, 3 responding to you, 2 doing its own thing, 1 idling. A new intent only cuts
 *   in when its level is higher than what is going on now.
 * - **Actions**: one row each — how it looks, how long it lasts, who may cut it short, the action it must start with (sitting
 *   starts by crouching) and where it may go next (from hanging only by falling). `DeskTest` checks every action has a way back
 *   to idling.
 * A new behaviour = a new row here (and, if it needs one, an animation name).
 */
object Lv { const val IDLE = 1; const val SELF = 2; const val YOU = 3; const val CARE = 4; const val REFLEX = 5 }

data class DeskAct(
    val state: DeskState, val pose: Pose, val fps: Int,
    /** an intent must be ABOVE this level to cut in (reflexes always can: a hand, gravity, a full-screen app) */
    val guard: Int,
    val minT: Float, val maxT: Float,
    /** this action must start with that one (sitting down starts by crouching) */
    val via: DeskState? = null,
    /** where it may go next */
    val next: Set<DeskState>,
    val anim: String = state.name.lowercase(),
)

object DeskActs {
    private val S = DeskState.values().toSet()
    /** standing on the floor: anything that also stands on the floor, plus the ways off it */
    private val GROUND = setOf(DeskState.IDLE, DeskState.WALK, DeskState.RUN, DeskState.STRETCH, DeskState.HAPPY, DeskState.ASK, DeskState.PEEK, DeskState.EAT,
        DeskState.WATER, DeskState.GREET, DeskState.CROUCH, DeskState.FOLLOW, DeskState.CLIMB, DeskState.FALL)
    /** sitting or lying: get up first (stretch or just stand) */
    private val UP = setOf(DeskState.IDLE, DeskState.STRETCH, DeskState.HAPPY, DeskState.ASK)
    private fun a(s: DeskState, pose: Pose, fps: Int, guard: Int, minT: Float, maxT: Float, next: Set<DeskState>, via: DeskState? = null) = s to DeskAct(s, pose, fps, guard, minT, maxT, via, next)
    val ALL: Map<DeskState, DeskAct> = mapOf(
        // reflexes: the hand, gravity, hiding
        a(DeskState.HELD, Pose.HELD, 60, Lv.REFLEX, 0f, 600f, setOf(DeskState.FALL, DeskState.THROWN)),
        a(DeskState.FALL, Pose.STAND, 30, Lv.REFLEX, 0f, 20f, setOf(DeskState.IDLE, DeskState.LAND)),
        a(DeskState.THROWN, Pose.FLY, 30, Lv.REFLEX, 0f, 20f, setOf(DeskState.LAND, DeskState.FALL)),
        a(DeskState.LAND, Pose.DIZZY, 30, Lv.CARE, 1.2f, 3f, GROUND - DeskState.FALL),
        a(DeskState.HIDDEN, Pose.STAND, 0, Lv.REFLEX, 0f, 1e9f, setOf(DeskState.FALL)),
        // on the floor
        a(DeskState.IDLE, Pose.STAND, 6, Lv.IDLE - 1, 0.5f, 8f, GROUND),
        a(DeskState.WALK, Pose.WALK, 30, Lv.IDLE, 0f, 40f, GROUND),
        a(DeskState.RUN, Pose.WALK, 30, Lv.IDLE, 0f, 30f, GROUND),
        a(DeskState.CROUCH, Pose.SIT, 30, Lv.YOU, 0.25f, 0.6f, setOf(DeskState.SIT, DeskState.SLEEP, DeskState.DOZE, DeskState.READ, DeskState.IDLE)),
        a(DeskState.SIT, Pose.SIT, 6, Lv.IDLE, 2f, 20f, UP, via = DeskState.CROUCH),
        a(DeskState.SLEEP, Pose.LIE, 1, Lv.YOU, 10f, 180f, UP, via = DeskState.CROUCH),
        a(DeskState.DOZE, Pose.LIE, 1, Lv.YOU, 5f, 60f, UP, via = DeskState.CROUCH),
        a(DeskState.READ, Pose.READ, 4, Lv.YOU, 3f, 1800f, UP, via = DeskState.CROUCH),
        a(DeskState.STRETCH, Pose.HAPPY, 12, Lv.SELF, 1f, 3f, GROUND),
        a(DeskState.HAPPY, Pose.HAPPY, 12, Lv.SELF, 1f, 4f, GROUND),
        a(DeskState.GREET, Pose.HAPPY, 12, Lv.SELF, 1.2f, 3f, GROUND),
        a(DeskState.ASK, Pose.LOOK, 6, Lv.SELF, 2f, 10f, GROUND),
        a(DeskState.EAT, Pose.EAT, 12, Lv.YOU, 2f, 6f, GROUND),
        a(DeskState.WATER, Pose.WATER, 12, Lv.SELF, 2f, 6f, GROUND),
        a(DeskState.PEEK, Pose.LOOK, 6, Lv.YOU, 2f, 30f, setOf(DeskState.IDLE, DeskState.WALK, DeskState.HAPPY, DeskState.FALL)),
        a(DeskState.FOLLOW, Pose.WALK, 30, Lv.YOU, 0f, 120f, GROUND),
        // the walls and the top: off them only by letting go
        a(DeskState.CLIMB, Pose.WALK, 30, Lv.YOU, 0f, 30f, setOf(DeskState.HANG, DeskState.FALL)),
        a(DeskState.HANG, Pose.WALK, 30, Lv.YOU, 0f, 20f, setOf(DeskState.FALL)),
    )
    operator fun get(s: DeskState) = ALL[s]!!
    /** may it go from `a` straight to `b`? (reflexes always may) */
    fun can(a: DeskState, b: DeskState) = a == b || b in REFLEXES || b in ALL[a]!!.next
    /** the first step on the shortest way from `a` to `b` through the table, staying on the floor (null = none) */
    fun hop(a: DeskState, b: DeskState): DeskState? {
        val from = HashMap<DeskState, DeskState>(); val q = ArrayDeque(listOf(a)); val off = REFLEXES + DeskState.CLIMB + DeskState.HANG + DeskState.LAND
        while (q.isNotEmpty()) { val x = q.removeFirst(); for (n in ALL[x]!!.next) { if (n in off && n != b || n in from || n == a) continue; from[n] = x
            if (n == b) { var h = n; while (from[h] != a) h = from[h]!!; return h }; q += n } }
        return null
    }
    val REFLEXES = setOf(DeskState.HELD, DeskState.FALL, DeskState.THROWN, DeskState.HIDDEN)
    /** every action reaches idling by the table alone (tests) */
    fun reachesIdle(s: DeskState): Boolean { val seen = HashSet<DeskState>(); val q = ArrayDeque(listOf(s)); while (q.isNotEmpty()) { val x = q.removeFirst(); if (x == DeskState.IDLE) return true; if (seen.add(x)) q += ALL[x]!!.next }; return false }
    init { check(ALL.keys == S) { "every state has a row" } }
}

/** what the pet can want; `persona` = the `Catalog` effect key that makes it more or less likely for this character */
data class DeskIntent(val id: String, val level: Int, val zh: String, val persona: String? = null)

object DeskIntents {
    val ALL = listOf(
        DeskIntent("hide", Lv.REFLEX, "躲起來", "desk:hide"), DeskIntent("held", Lv.REFLEX, "被抓著"), DeskIntent("fall", Lv.REFLEX, "掉下來"),
        DeskIntent("eat", Lv.CARE, "去吃桌上的點心"), DeskIntent("askFood", Lv.CARE, "討東西吃"), DeskIntent("sleep", Lv.CARE, "想睡了", "desk:nest"),
        DeskIntent("lowBattery", Lv.CARE, "手機沒電了，陪你瞇一下"), DeskIntent("remind", Lv.CARE, "從邊邊探頭提醒你"),
        DeskIntent("focus", Lv.CARE, "陪你專心"), DeskIntent("break", Lv.CARE, "休息時間"),
        DeskIntent("follow", Lv.YOU, "追著你的手指", "desk:cling"), DeskIntent("wake", Lv.YOU, "被你叫醒"), DeskIntent("invited", Lv.YOU, "被朋友找"),
        DeskIntent("nest", Lv.SELF, "回窩裡待著", "desk:nest"), DeskIntent("water", Lv.SELF, "幫小盆栽澆水"), DeskIntent("read", Lv.SELF, "看紙條"),
        DeskIntent("social", Lv.SELF, "去找朋友", "desk:social"), DeskIntent("nearYou", Lv.SELF, "靠過來看你", "desk:cling"), DeskIntent("lonely", Lv.SELF, "想要你理牠", "desk:cling"),
        DeskIntent("wander", Lv.IDLE, "走一走"), DeskIntent("run", Lv.IDLE, "跑來跑去", "desk:climb"), DeskIntent("climb", Lv.IDLE, "爬牆", "desk:climb"),
        DeskIntent("sit", Lv.IDLE, "坐一下"), DeskIntent("stretch", Lv.IDLE, "伸懶腰"), DeskIntent("peek", Lv.IDLE, "從邊邊探頭", "desk:hide"), DeskIntent("rest", Lv.IDLE, "發呆"),
    ).associateBy { it.id }
    operator fun get(id: String) = ALL[id]!!
}

/** F-05 / F-06: things on the desktop and what they give (eat, sleep, water, read, home) */
data class DeskPropKind(val id: String, val zh: String, val gives: String, val icon: String)

object DeskProps {
    val KINDS = listOf(DeskPropKind("food", "點心", "eat", "cake"), DeskPropKind("blanket", "小毯子", "sleep", "bed"), DeskPropKind("plant", "小盆栽", "water", "plant"),
        DeskPropKind("note", "紙條", "read", "note"), DeskPropKind("nest", "窩", "home", "bed")).associateBy { it.id }
    operator fun get(id: String) = KINDS[id]
    /** at most this many things on the desktop (plus the nest) */
    const val MAX = 4
}

/** a thing on the desktop as the pet sees it: where (dp on the floor) and what it gives */
data class DeskThing(val id: String, val kind: String, val x: Float)
/** another pet on the desktop as this one sees it; `like` from the relationship (0–100) */
data class DeskOther(val id: String, val x: Float, val floor: Boolean, val state: DeskState, val like: Int)

/** F-07 together: what two pets do, the least liking it needs, and whether the other one moves */
data class DeskTogether(val id: String, val zh: String, val like: Int, val mine: DeskState, val theirs: DeskState, val len: Float)

object DeskTogethers {
    val ALL = listOf(
        DeskTogether("greet", "打招呼", 0, DeskState.GREET, DeskState.GREET, 2f),
        DeskTogether("chase", "追來追去", 50, DeskState.RUN, DeskState.RUN, 6f),
        DeskTogether("sitTogether", "一起坐著", 60, DeskState.SIT, DeskState.SIT, 10f),
        DeskTogether("leanSleep", "靠在一起睡", 70, DeskState.SLEEP, DeskState.SLEEP, 40f),
    ).associateBy { it.id }
}

/**
 * Personality on the desktop (plan B-1): each number is a `Catalog` effect (`desk:cling` …) multiplied over the character's tags,
 * traits, quirks and values — so 黏人 stays near you longer, 獨立 goes back to its nest, 好動 climbs, 害羞 hides sooner.
 */
data class DeskPersona(val cling: Float = 1f, val nest: Float = 1f, val climb: Float = 1f, val hide: Float = 1f, val social: Float = 1f, val active: Float = 0f) {
    fun of(key: String?) = when (key) { "desk:cling" -> cling; "desk:nest" -> nest; "desk:climb" -> climb; "desk:hide" -> hide; "desk:social" -> social; else -> 1f }
    companion object {
        fun of(spec: CharSpec): DeskPersona {
            val fx = Catalog.effects(spec); fun k(key: String) = fx.fold(1f) { m, e -> m * (e.act[key] ?: 1f) }
            val act = spec.axis(Axis.ACTIVE)
            return DeskPersona(k("desk:cling"), k("desk:nest"), k("desk:climb") * (1f + act * 0.3f), k("desk:hide"), k("desk:social"), act)
        }
    }
}
