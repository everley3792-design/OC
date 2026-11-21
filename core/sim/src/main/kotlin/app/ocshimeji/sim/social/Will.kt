package app.ocshimeji.sim.social

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Rel

/**
 * Willingness (plan 4.4): whether the other one takes up a social act, and how. It depends on how they see the one who asks
 * (relationship), who they are (personality, traits through `Catalog` effects with keys `r:<category>`), how they feel (mood and
 * needs), who else is around, their memories (favours and grudges) and whether the two are quarrelling.
 */
object Will {
    /** what the one who is asked brings to the moment */
    class Ctx(
        val target: CharSpec, val seen: Rel?, val mood: Int, val social: Float, val energy: Float, val crowd: Int,
        /** favours − grudges the target remembers about the asker (weights) */
        val ledger: Int, val feud: Boolean,
        /** the target's own effect multiplier for this category (`r:<cat>`), 1 = none */
        val fxk: Float, val asleepNearby: Boolean = false,
    )
    /** a number, roughly 0..1.4; higher = happier to go along */
    fun score(act: SocialAct, c: Ctx, noise: Float): Float {
        val s = c.target; val r = c.seen
        var w = 0.62f
        w += ((r?.like ?: 30) - 30) * 0.006f + ((r?.trust ?: 30) - 30) * 0.003f - (r?.conflict ?: 0) * 0.007f + ((r?.fit ?: 50) - 50) * 0.003f
        w += s.axis(0) * 0.12f + s.axis(4) * 0.08f
        w += c.mood * 0.04f
        if (c.social < 35f) w += 0.12f
        if (c.energy < 20f) w -= 0.22f
        w += (c.ledger.coerceIn(-6, 6)) * 0.03f
        w -= act.risk * 0.45f
        val stage = if (r == null) 0 else if (r.kind in SocialActs.LADDER) maxOf(SocialActs.LADDER.indexOf(r.kind), stageFrom(r)) else SocialActs.stageIndex(r.kind)
        if (stage < act.stage) w -= 0.18f * (act.stage - stage)
        if (act.intimate) w -= 0.25f * s.shy.coerceAtLeast(0f)
        if (s.shy > 0.3f && c.crowd >= 3) w -= 0.12f
        if (c.feud && act.cat != "和好") w -= 0.4f
        if (c.feud && act.cat == "和好") w += s.axis(4) * 0.2f - s.temper * 0.15f
        if (act.hostile) w -= s.temper.coerceAtLeast(0f) * 0.2f
        w *= c.fxk
        return w + noise
    }
    /** the step a relationship is at from its numbers alone (used when no kind was set) */
    fun stageFrom(r: Rel?): Int { if (r == null) return 0; val v = (r.familiar + r.like) / 2; return when { v >= 75 && r.trust >= 55 -> 4; v >= 58 -> 3; v >= 40 -> 2; v >= 18 -> 1; else -> 0 } }
    /** score → a reaction; bad answers are anger or tears by temperament */
    fun reaction(w: Float, s: CharSpec, r: Rng): Reaction = when {
        w >= 1.0f -> Reaction.WARM
        w >= 0.72f -> Reaction.HAPPY
        w >= 0.5f -> Reaction.OK
        w >= 0.36f -> Reaction.MEH
        w >= 0.2f -> Reaction.NO
        else -> if (s.cry > s.temper || (s.cry == s.temper && r.chance(0.5))) Reaction.CRY else Reaction.ANGRY
    }
    fun react(act: SocialAct, c: Ctx, r: Rng): Reaction = reaction(score(act, c, (r.nextFloat() - 0.5f) * 0.3f), c.target, r)

    /** how the relationship moves (the one who was asked → the asker), from the act and the answer */
    data class Delta(val like: Int, val trust: Int, val conflict: Int, val familiar: Int)
    fun delta(act: SocialAct, re: Reaction): Delta {
        val k = re.k
        val like = if (act.hostile) (if (k >= 0.9f) act.like + 1 else if (k > 0f) 0 else -2 + (k * 2).toInt()) else (act.like * k).let { if (it < 0) it.toInt() - 1 else it.toInt() }
        val trust = if (k > 0f) (act.trust * k).toInt() else 0
        val conflict = act.conflict + (if (k < 0f) (-k * 5).toInt() + 1 else 0) - (if (act.conflict < 0 && k <= 0f) act.conflict else 0)
        return Delta(like, trust, conflict, 2)
    }
}
