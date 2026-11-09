package app.ocshimeji.core.pet

import kotlin.math.abs
import kotlin.random.Random

/**
 * Several pets on one screen: personal space (no stacking), and small meetings between pets that
 * use the game's relationship data (affinity −1..1 per ordered pair, exported by the game).
 *
 * A meeting is only *started* here (both face each other and play a short, choreographed reaction);
 * the host shows the lines, plays the sound and reports the meeting to the game, which decides any
 * relationship effect (the desktop never changes a relationship by itself).
 *
 * 12.0: meetings are *paired actions* — each kind is a few timed beats, and the two pets play
 * complementary animations (one hugs, the other is hugged; one comforts, the other is comforted;
 * one runs, the other is chased …). A quarrel can be followed, later, by an apology.
 */
class PetSocial(seed: Int = 5) {
    data class Member(val id: String, val brain: PetBrain)
    data class Meeting(val a: String, val b: String, val kind: String)

    /** what the pair does while a beat plays */
    enum class Move { NONE, CLOSER, APART, CHASE }
    /** [at] seconds after the meeting started; [a] is the initiator's animation, [b] the other's (null = leave as it is) */
    data class Beat(val at: Float, val a: String?, val b: String?, val dur: Float, val move: Move = Move.NONE)
    /** [positive] decides which sound the host plays; [lines] is the dialogue category of the game the host asks for */
    data class Kind(val zh: String, val positive: Boolean, val lines: String, val beats: List<Beat>)

    /** affinity a→b, −1..1 (missing = 0) */
    var affinity: Map<String, Float> = emptyMap()
    /** seconds between meetings of the same pair */
    var pairCooldown = 90f

    private val rnd = Random(seed)
    private val lastMeet = HashMap<String, Float>()
    private val lastKind = HashMap<String, String>()
    private val lastBad = HashMap<String, Float>()
    private var clock = 0f
    private class Dance(val a: Member, val b: Member, val kind: Kind, val key: String, var t: Float = 0f, var i: Int = 0)
    private val dances = ArrayList<Dance>()

    fun aff(a: String, b: String) = affinity["$a>$b"] ?: 0f
    /** pairs that are playing a paired action right now (the host keeps them out of other behaviour) */
    val busyPairs: List<Pair<String, String>> get() = dances.map { it.a.id to it.b.id }
    fun isBusy(id: String) = dances.any { it.a.id == id || it.b.id == id }
    private fun keyOf(a: String, b: String) = if (a < b) "$a|$b" else "$b|$a"
    private fun down(b: PetBrain) = b.mood.emotion in SAD

    /**
     * which paired action two pets play. [A] is the one who happens to be first in the list; the caller swaps the roles
     * when the kind needs a particular one (the one who is not down comforts).
     */
    fun choose(a: Member, b: Member): String {
        val like = (aff(a.id, b.id) + aff(b.id, a.id)) / 2f
        val key = keyOf(a.id, b.id)
        if (like < -0.3f) return if (rnd.nextFloat() < 0.5f) "argue" else "huff"
        // they quarrelled earlier and no longer hate each other: one of them takes the first step
        val bad = lastBad[key]
        if (bad != null && clock - bad < 1800f && like > -0.3f) return "apologize"
        if (down(a.brain) != down(b.brain) && like > -0.1f) return "comfort"
        val prev = lastKind[key]
        val pool: List<Pair<String, Float>> = when {
            like > 0.5f -> if (prev == null) listOf("hug" to 1f) else listOf("hug" to 0.4f, "highfive" to 0.3f, "sidebyside" to 0.3f)
            like > 0.1f -> listOf("chat" to 0.3f, "highfive" to 0.25f, "sidebyside" to 0.2f) + (if (a.brain.mood.energy > 0.5f && b.brain.mood.energy > 0.5f) listOf("chase" to 0.25f) else emptyList()) +
                (if (a.brain.mood.hunger < 0.5f || b.brain.mood.hunger < 0.5f) listOf("share" to 0.3f) else emptyList())
            else -> listOf("greet" to 1f)
        }.filter { it.first != prev || it.first == "greet" }.ifEmpty { listOf("greet" to 1f) }
        var r = rnd.nextFloat() * pool.sumOf { it.second.toDouble() }.toFloat()
        for ((k, w) in pool) { r -= w; if (r <= 0f) return k }
        return pool.last().first
    }

    /** one step: returns meetings that started this step */
    fun step(members: List<Member>, dt: Float): List<Meeting> {
        clock += dt
        advance(dt)
        val out = ArrayList<Meeting>()
        for (i in members.indices) for (j in i + 1 until members.size) {
            val a = members[i]; val b = members[j]
            val A = a.brain; val B = b.brain
            if (!A.onFloor || !B.onFloor) continue
            if (isBusy(a.id) || isBusy(b.id)) continue
            val d = B.x - A.x
            val reach = A.size * 0.75f
            if (abs(d) > reach) continue
            val free = { s: PetBrain.State -> s == PetBrain.State.WALK || s == PetBrain.State.IDLE || s == PetBrain.State.RUN }
            val key = keyOf(a.id, b.id)
            val since = clock - (lastMeet[key] ?: -1e9f)
            val like = (aff(a.id, b.id) + aff(b.id, a.id)) / 2f
            if (free(A.state) && free(B.state) && since > pairCooldown && rnd.nextFloat() < 0.5f + like * 0.4f) {
                start(choose(a, b), a, b)?.let { out += it }
            } else if (A.state == PetBrain.State.WALK || B.state == PetBrain.State.WALK) {
                // personal space: whoever walks into the other turns around (no stacking)
                if (A.state == PetBrain.State.WALK && A.facing * d > 0) A.face(A.x - d)
                if (B.state == PetBrain.State.WALK && B.facing * -d > 0) B.face(B.x + d)
            } else if (abs(d) < A.size * 0.35f && A.state != PetBrain.State.REACT && B.state != PetBrain.State.REACT) {
                // resting on top of each other: the one who likes the other less walks off
                val mover = if (aff(a.id, b.id) <= aff(b.id, a.id)) A else B
                val other = if (mover === A) B else A
                mover.goTo(if (mover.x <= other.x) mover.x - mover.size * 0.8f else mover.x + mover.size * 0.8f)
            }
        }
        return out
    }

    /**
     * start a paired action now (also used by "test on the desktop"). [a] is the one who starts; for "comfort" the one who is not down
     * takes that role. Returns null when either pet is busy, in the air or on a wall.
     */
    fun start(kindId: String, a: Member, b: Member): Meeting? {
        val kind = KINDS[kindId] ?: return null
        if (!a.brain.onFloor || !b.brain.onFloor || isBusy(a.id) || isBusy(b.id)) return null
        val (first, second) = if (kindId == "comfort" && down(a.brain)) b to a else a to b
        first.brain.face(second.brain.x); second.brain.face(first.brain.x)
        val key = keyOf(a.id, b.id)
        lastMeet[key] = clock; lastKind[key] = kindId
        if (kindId == "argue" || kindId == "huff") lastBad[key] = clock else if (kindId == "apologize") lastBad.remove(key)
        dances += Dance(first, second, kind, key)
        advance(0f)   // the first beat plays right away
        return Meeting(first.id, second.id, kindId)
    }

    /** play the beats whose time has come; a dance ends when its last beat has played out, or when either pet was picked up / fell */
    private fun advance(dt: Float) {
        val it = dances.iterator()
        while (it.hasNext()) {
            val d = it.next(); d.t += dt
            val A = d.a.brain; val B = d.b.brain
            if (!A.onFloor || !B.onFloor || A.state == PetBrain.State.JUMP || B.state == PetBrain.State.JUMP) { it.remove(); continue }
            while (d.i < d.kind.beats.size && d.t >= d.kind.beats[d.i].at) {
                val beat = d.kind.beats[d.i++]
                if (beat.a != null) A.react(beat.a, beat.dur)
                if (beat.b != null) B.react(beat.b, beat.dur)
                move(A, B, beat.move)
            }
            val end = d.kind.beats.maxOf { b -> b.at + b.dur }
            if (d.i >= d.kind.beats.size && d.t >= end) it.remove()
        }
    }

    private fun move(A: PetBrain, B: PetBrain, m: Move) {
        if (m == Move.NONE) return
        val dir = if (B.x >= A.x) 1f else -1f
        val step = A.size * 1.7f
        when (m) {
            Move.CLOSER -> A.goTo(B.x - dir * A.size * 0.6f)
            Move.APART -> { A.goTo(A.x - dir * step); B.goTo(B.x + dir * step) }
            // B runs off, A runs after it
            Move.CHASE -> { B.goTo(B.x + dir * step * 1.6f, run = true); A.goTo(A.x + dir * step * 1.3f, run = true) }
            Move.NONE -> Unit
        }
    }

    fun reset() { dances.clear(); lastMeet.clear(); lastKind.clear(); lastBad.clear() }

    companion object {
        private val SAD = setOf("lonely", "down", "sad")
        private fun k(zh: String, pos: Boolean, lines: String, vararg b: Beat) = Kind(zh, pos, lines, b.toList())
        /**
         * every paired action: the animations are game actions (PetBrain.ANIMS); the dialogue category is a pool the game exports
         * (PetSync.LINE_CATS). The game's `meet` handler turns the kind into a small, capped relationship step.
         */
        val KINDS: Map<String, Kind> = linkedMapOf(
            "greet" to k("打招呼", true, "friend", Beat(0f, "greet", "greet", 2.2f)),
            "chat" to k("聊天", true, "friend", Beat(0f, "talk", "listen", 2.0f), Beat(2f, "listen", "talk", 2.0f)),
            "hug" to k("擁抱", true, "friend", Beat(0f, "hug", "hugme", 2.8f)),
            "highfive" to k("擊掌", true, "friend", Beat(0f, "highfive", "highfive", 1.4f), Beat(1.4f, "cheer", "cheer", 1.2f)),
            "sidebyside" to k("並肩坐著", true, "friend", Beat(0f, "sidebyside", "sidebyside", 4.5f)),
            "share" to k("分享食物", true, "friend", Beat(0f, "feedbite", "bitefed", 2.6f), Beat(2.6f, "happy", "happy", 1.4f)),
            "comfort" to k("安慰", true, "comfort_d", Beat(0f, "comfort", "comforted", 3.0f), Beat(3f, "happy", "shy", 1.4f)),
            "chase" to k("追逐", true, "friend", Beat(0f, null, null, 0.1f, Move.CHASE), Beat(2.4f, "giggle", "giggle", 1.6f)),
            "huff" to k("賭氣", false, "quarrel", Beat(0f, "shy", "sad", 2.2f)),
            "argue" to k("爭吵", false, "quarrel", Beat(0f, "argue", "upset", 2.4f), Beat(2.4f, "turnaway", "turnaway", 1.2f, Move.APART)),
            "apologize" to k("道歉", true, "sorry", Beat(0f, "apologize", "accept", 2.6f), Beat(2.6f, "happy", "happy", 1.4f)),
        )
        /** every animation a paired action can ask for (checked against PetBrain.ANIMS and the game's export) */
        val ANIMS: Set<String> get() = KINDS.values.flatMap { k -> k.beats.flatMap { listOfNotNull(it.a, it.b) } }.toSet()
    }
}
