package app.ocshimeji.sim.social

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.house.HouseType

/**
 * Rock-paper-scissors (plan L-01): every character has a habit you can learn to read — the active ones love rock, the gentle
 * ones paper, the reserved ones scissors; the competitive ones switch to beat your last hand after losing. A tell (a little
 * gesture) gives the habit away most of the time, and it is honest.
 */
object Rps {
    const val ROCK = 0; const val SCISSORS = 1; const val PAPER = 2
    val ZH = listOf("石頭", "剪刀", "布")
    /** 1 = a wins, −1 = b wins, 0 = draw */
    fun judge(a: Int, b: Int): Int = if (a == b) 0 else if ((a + 1) % 3 == b) 1 else -1
    fun habit(s: CharSpec): FloatArray {
        val w = floatArrayOf(1f, 1f, 1f)
        if (s.axis(1) > 0.25f) w[ROCK] += 1.4f
        if (s.axis(4) > 0.25f) w[PAPER] += 1.2f
        if (s.axis(3) < -0.1f) w[SCISSORS] += 1.2f
        if (s.axis(1) <= 0.25f && s.axis(4) <= 0.25f && s.axis(3) >= -0.1f) w[(s.name.hashCode() and 0x7fffffff) % 3] += 1f   /* everyone has some habit */
        return w
    }
    fun favourite(s: CharSpec): Int { val w = habit(s); return w.indices.maxByOrNull { w[it] }!! }
    /** what they throw this round; `last` = (their hand, your hand) of the previous round */
    fun pick(s: CharSpec, last: Pair<Int, Int>?, r: Rng): Int {
        if (last != null && judge(last.first, last.second) < 0 && (s.axis(4) < -0.2f || s.temper > 0.25f) && r.chance(0.7)) return (last.second + 2) % 3   /* what beats your last */
        val w = habit(s); return r.weighted(listOf(0, 1, 2)) { w[it].toDouble() }!!
    }
    /** the gesture before throwing (true to the hand most of the time; that is what can be read) */
    fun tell(hand: Int, r: Rng): String? = if (!r.chance(0.65)) null else when (hand) { ROCK -> "（握緊了拳頭）"; SCISSORS -> "（手指動了動，像是要比 V）"; else -> "（手掌張開又合上）" }
}

/**
 * Hide-and-seek (plan L-02): they pick a hiding place by personality (shy ones behind the bed, the vain ones by the mirror,
 * dreamers by the window or the plant, lazy ones on the sofa). You search by tapping furniture; after two misses they give a hint.
 */
object HideSeek {
    fun spot(s: CharSpec, h: HouseType, r: Rng): Int {
        val cands = h.pieces.indices.filter { Furniture.kind(h.pieces[it].kind).blocks || h.pieces[it].kind in setOf("window", "mirror", "rug") }
        return r.weighted(cands) { i ->
            val k = h.pieces[i].kind; var w = 1.0
            if (s.shy > 0.2f && k in setOf("bed", "bed2", "shelf")) w += 2.5
            if (s.axis(0) > 0.3f && k in setOf("mirror", "tub")) w += 2.0
            if (s.axis(3) < 0f && k in setOf("window", "plant")) w += 2.0
            if (s.axis(1) < 0f && k in setOf("sofa", "rug", "bed", "bed2")) w += 2.0
            if (s.axis(1) > 0.3f && k in setOf("fridge", "shelf", "tub")) w += 1.5
            w
        } ?: 0
    }
    fun hint(h: HouseType, piece: Int): String = "（${Furniture.kind(h.pieces[piece].kind).zh}那邊好像有聲音……）"
}
