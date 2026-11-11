package app.ocshimeji.core.pet

import kotlin.random.Random

/**
 * 13.0 — the desktop pet's day has shape. [PetBrain] decides single moves (walk, sit, climb …); this director strings moves into small
 * routines that fit the moment: a stretch and a look around in the morning, getting drowsy at night, pacing when bored, showing off when
 * happy, sulking in a corner when down. Routines are plain data ([ROUTINES]); the director only issues a step when the brain is free
 * (on the floor, not dragged / falling / reacting / in a paired action) and never changes needs — it reads the game's snapshot like the brain does.
 *
 * Pure Kotlin, unit-tested. The host calls [update] every frame after the brain's own update.
 */
class PetRoutine(seed: Int = 17) {
    /** one step: walk to a fraction of the floor (0 = left edge, 1 = right edge), play an animation, hop, or sit down for a while */
    sealed class Step {
        data class Walk(val to: Float, val run: Boolean = false) : Step()
        data class Play(val anim: String, val dur: Float) : Step()
        data class Hop(val dir: Float = 0f) : Step()
        data class Rest(val dur: Float) : Step()
    }
    /** [fits] returns how well the routine suits the moment (0 = never now) */
    class Routine(val id: String, val zh: String, val steps: List<Step>, val fits: (Ctx) -> Float)
    data class Ctx(val hour: Int, val mood: PetBrain.Mood, val traits: PetBrain.Traits, val level: Int)

    var enabled = true
    /** seconds between routines (the lively setting shortens it) */
    var gap = 40f
    var current: Routine? = null; private set
    var played = 0; private set

    private val rnd = Random(seed)
    private var wait = 12f
    private var i = 0
    private var stepT = 0f
    private var started = false
    private var lastId = ""

    private fun free(b: PetBrain) = b.onFloor && (b.state == PetBrain.State.IDLE || b.state == PetBrain.State.WALK || b.state == PetBrain.State.SIT)

    /** returns the id of a routine that started this frame (for the host's diagnostics), else null */
    fun update(b: PetBrain, dt: Float, hour: Int, busy: Boolean = false): String? {
        if (!enabled || b.allow.level < 0) { current = null; return null }
        val r = current
        if (r == null) {
            wait -= dt
            if (wait > 0f || busy || !free(b)) return null
            val ctx = Ctx(hour, b.mood, b.traits, b.allow.level)
            val pool = ROUTINES.map { it to it.fits(ctx) * (if (it.id == lastId) 0.3f else 1f) }.filter { it.second > 0.05f }
            wait = gap * (if (b.allow.level >= 2) 0.6f else if (b.allow.level == 0) 1.6f else 1f) * (0.7f + rnd.nextFloat() * 0.6f)
            if (pool.isEmpty()) return null
            var x = rnd.nextFloat() * pool.sumOf { it.second.toDouble() }.toFloat()
            val pick = pool.firstOrNull { x -= it.second; x <= 0f }?.first ?: pool.last().first
            current = pick; i = 0; stepT = 0f; started = false; lastId = pick.id; played++
            return pick.id
        }
        // picked up, thrown, climbing, meeting another pet … → the routine is simply dropped
        if (busy || !b.onFloor || b.state == PetBrain.State.DRAG || b.state == PetBrain.State.FALL || b.state == PetBrain.State.THROWN) { current = null; return null }
        val step = r.steps.getOrNull(i) ?: run { current = null; return null }
        stepT += dt
        if (!started) {
            started = true; stepT = 0f
            when (step) {
                is Step.Walk -> b.goTo(b.minX + (b.maxX - b.minX) * step.to.coerceIn(0f, 1f), step.run)
                is Step.Play -> b.react(step.anim, step.dur)
                is Step.Hop -> b.jump(step.dir)
                is Step.Rest -> b.settle()
            }
            return null
        }
        val done = when (step) {
            is Step.Walk -> stepT > 0.3f && (b.state == PetBrain.State.IDLE || stepT > 14f)
            is Step.Play -> stepT >= step.dur + 0.05f
            is Step.Hop -> stepT > 0.4f && b.onFloor && b.state != PetBrain.State.JUMP && b.state != PetBrain.State.LAND || stepT > 4f
            is Step.Rest -> stepT >= step.dur
        }
        if (done) { i++; started = false; stepT = 0f; if (i >= r.steps.size) current = null }
        return null
    }

    fun cancel() { current = null }

    companion object {
        private fun W(to: Float, run: Boolean = false) = Step.Walk(to, run)
        private fun P(anim: String, dur: Float) = Step.Play(anim, dur)
        private val HAPPY = setOf("happy", "excited", "proud", "content", "love")
        private val LOW = setOf("sad", "down", "lonely")
        /** every routine the desktop pet knows; animations are checked against PetBrain.ANIMS by a unit test */
        val ROUTINES: List<Routine> = listOf(
            Routine("morning", "早晨伸展", listOf(P("yawn", 1.6f), P("wave", 1.4f), W(0.5f), P("happy", 1.2f))) { c -> if (c.hour in 6..9) 2.2f else 0f },
            Routine("patrol", "巡邏", listOf(W(0.08f), P("surprised", 0.9f), W(0.92f), P("aha", 1.2f))) { c -> 0.5f + c.traits.curious * 0.9f },
            Routine("showoff", "表演", listOf(W(0.5f), P("bow", 1.2f), P("spin", 1.4f), Step.Hop(), P("cheer", 1.4f))) { c -> if (c.mood.emotion in HAPPY) 1.6f + c.traits.energy else 0.15f },
            Routine("bored", "無聊踱步", listOf(W(0.3f), P("sigh", 1.4f), W(0.7f), P("sigh", 1.2f), Step.Rest(6f))) { c -> if (c.mood.play < 0.35f) 1.8f else 0.1f },
            Routine("sulk", "躲到角落", listOf(W(0.03f), P("sad", 2.0f), Step.Rest(10f))) { c -> if (c.mood.emotion in LOW) 2.0f else 0f },
            Routine("drowsy", "想睡了", listOf(P("yawn", 1.8f), W(0.85f), P("yawn", 1.6f), Step.Rest(14f))) { c -> if (c.hour >= 22 || c.hour < 5 || c.mood.energy < 0.3f) 2.4f else 0f },
            Routine("hungry", "肚子餓", listOf(P("sad", 1.2f), W(0.5f), P("wave", 1.6f), P("hiccup", 1.0f))) { c -> if (c.mood.hunger < 0.3f) 2.0f else 0f },
            Routine("lonely", "想找人", listOf(W(0.5f), P("wave", 1.6f), P("shy", 1.4f), P("wave", 1.4f))) { c -> if (c.mood.social < 0.3f) 1.6f + c.traits.social else 0f },
            Routine("zoomies", "暴衝", listOf(W(0.05f, true), W(0.95f, true), Step.Hop(), P("giggle", 1.4f))) { c -> if (c.level >= 1 && c.mood.energy > 0.6f) 0.4f + c.traits.energy * 1.2f else 0f },
            Routine("shyPeek", "害羞探頭", listOf(W(0.97f), P("shy", 1.6f), P("wave", 1.2f))) { c -> c.traits.shy * 1.4f },
            Routine("dance", "自己跳舞", listOf(P("wiggle", 1.6f), P("spin", 1.4f), P("clap", 1.2f))) { c -> if (c.mood.emotion in HAPPY) 0.8f + c.traits.energy * 0.6f else 0.1f },
        )
        val ANIMS: Set<String> get() = ROUTINES.flatMap { r -> r.steps.filterIsInstance<Step.Play>().map { it.anim } }.toSet()
    }
}
