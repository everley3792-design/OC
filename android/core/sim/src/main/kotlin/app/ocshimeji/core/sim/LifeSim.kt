package app.ocshimeji.core.sim

import app.ocshimeji.core.event.EventBus
import app.ocshimeji.core.event.GameEvent
import app.ocshimeji.core.model.Need
import app.ocshimeji.core.model.OcCharacter
import app.ocshimeji.core.model.WorldClock
import kotlin.random.Random

/**
 * Autonomous life simulation (utility AI). Pure Kotlin, deterministic per seed,
 * tick-based so it runs identically in the game, in the floating-pet service
 * (low tick rate) and in unit tests. Rendering never mutates sim state.
 */
data class SimAction(
    val id: String,
    val durationMin: Int,
    /** Need deltas applied over the full duration. */
    val effects: Map<Need, Float>,
    /** Static appeal; personality traits add weighted bonuses by action id. */
    val baseAppeal: Float = 0.1f,
    val needsPartner: Boolean = false,
    val emote: String? = null,
)

object Actions {
    val ALL = listOf(
        SimAction("eat_snack", 20, mapOf(Need.FULLNESS to 0.35f, Need.MOOD to 0.05f), emote = "♥"),
        SimAction("nap", 60, mapOf(Need.ENERGY to 0.5f), emote = "zzz"),
        SimAction("chat", 15, mapOf(Need.SOCIAL to 0.3f, Need.MOOD to 0.1f), needsPartner = true, emote = "♪"),
        SimAction("bath", 25, mapOf(Need.HYGIENE to 0.6f), emote = "♪"),
        SimAction("daydream", 15, mapOf(Need.MOOD to 0.15f), baseAppeal = 0.15f, emote = "…"),
        SimAction("water_flowers", 20, mapOf(Need.MOOD to 0.12f, Need.ENERGY to -0.05f), baseAppeal = 0.12f),
        SimAction("wander", 10, mapOf(Need.MOOD to 0.05f, Need.ENERGY to -0.03f), baseAppeal = 0.2f),
    )
}

/** Per-minute decay. Night makes energy fall faster; social decays when alone. */
object Decay {
    fun perMinute(n: Need, night: Float): Float = when (n) {
        Need.FULLNESS -> -0.0012f
        Need.ENERGY -> -0.0008f - 0.0006f * night
        Need.MOOD -> -0.0004f
        Need.SOCIAL -> -0.0007f
        Need.HYGIENE -> -0.0005f
    }
}

class LifeSim(
    characters: List<OcCharacter>,
    private val bus: EventBus? = null,
    seed: Int = 1,
) {
    private val rnd = Random(seed)
    var clock = WorldClock()
        private set
    private val chars = characters.associateBy { it.id.value }.toMutableMap()
    private val current = mutableMapOf<String, Pair<SimAction, Int>>() // action, minutes left

    fun character(id: String): OcCharacter? = chars[id]
    fun activity(id: String): String? = current[id]?.first?.id

    /** Utility score: urgency (curved) of the needs the action restores + traits + noise. */
    fun score(c: OcCharacter, a: SimAction): Float {
        var s = a.baseAppeal
        for ((need, delta) in a.effects) if (delta > 0) {
            val deficit = 1f - c.needs[need]
            s += delta * deficit * deficit * 4f
        }
        for (t in c.traits) s += t.weights[a.id] ?: 0f
        if (a.needsPartner && chars.size < 2) s = 0f
        return s + rnd.nextFloat() * 0.05f
    }

    fun choose(c: OcCharacter): SimAction = Actions.ALL.maxBy { score(c, it) }

    /** Advance the world by [minutes] (1 tick = 1 game minute). */
    fun tick(minutes: Int = 1) {
        repeat(minutes) {
            clock = clock.advance(1)
            val night = clock.nightAmount
            for ((id, c0) in chars.toMap()) {
                var c = c0
                // decay
                var needs = c.needs
                for (n in Need.entries) needs = needs.adjust(n, Decay.perMinute(n, night))
                // act
                val cur = current[id]
                if (cur == null || cur.second <= 0) {
                    val next = choose(c.copy(needs = needs))
                    current[id] = next to next.durationMin
                    bus?.post(GameEvent.ActionStarted(id, next.id))
                    next.emote?.let { bus?.post(GameEvent.Reaction(id, it)) }
                } else {
                    val (a, left) = cur
                    for ((n, d) in a.effects) needs = needs.adjust(n, d / a.durationMin)
                    current[id] = a to (left - 1)
                }
                c = c.copy(needs = needs)
                chars[id] = c
            }
        }
    }

    /** Player feeds an item (e.g. dragged from the bag onto the character). */
    fun useItem(id: String, itemId: String, effects: Map<Need, Float>) {
        val c = chars[id] ?: return
        var needs = c.needs
        for ((n, d) in effects) { needs = needs.adjust(n, d); bus?.post(GameEvent.NeedChanged(id, n.name, needs[n])) }
        chars[id] = c.copy(needs = needs)
        bus?.post(GameEvent.ItemUsed(id, itemId))
        bus?.post(GameEvent.Reaction(id, "♥"))
    }
}
