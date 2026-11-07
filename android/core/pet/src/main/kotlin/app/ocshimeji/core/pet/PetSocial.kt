package app.ocshimeji.core.pet

import kotlin.math.abs
import kotlin.random.Random

/**
 * Several pets on one screen: personal space (no stacking), and small meetings between pets that
 * use the game's relationship data (affinity −1..1 per ordered pair, exported by the game).
 *
 * A meeting is only *started* here (both face each other and play a short reaction); the host
 * shows the lines and reports the meeting to the game, which decides any relationship effect.
 */
class PetSocial(seed: Int = 5) {
    data class Member(val id: String, val brain: PetBrain)
    data class Meeting(val a: String, val b: String, val kind: String)

    /** affinity a→b, −1..1 (missing = 0) */
    var affinity: Map<String, Float> = emptyMap()
    /** seconds between meetings of the same pair */
    var pairCooldown = 90f

    private val rnd = Random(seed)
    private val lastMeet = HashMap<String, Float>()
    private var clock = 0f

    fun aff(a: String, b: String) = affinity["$a>$b"] ?: 0f

    /** one step: returns meetings that started this step */
    fun step(members: List<Member>, dt: Float): List<Meeting> {
        clock += dt
        val out = ArrayList<Meeting>()
        for (i in members.indices) for (j in i + 1 until members.size) {
            val a = members[i]; val b = members[j]
            val A = a.brain; val B = b.brain
            if (!A.onFloor || !B.onFloor) continue
            val d = B.x - A.x
            val reach = A.size * 0.75f
            if (abs(d) > reach) continue
            val free = { s: PetBrain.State -> s == PetBrain.State.WALK || s == PetBrain.State.IDLE || s == PetBrain.State.RUN }
            val key = if (a.id < b.id) "${a.id}|${b.id}" else "${b.id}|${a.id}"
            val since = clock - (lastMeet[key] ?: -1e9f)
            val like = (aff(a.id, b.id) + aff(b.id, a.id)) / 2f
            if (free(A.state) && free(B.state) && since > pairCooldown && rnd.nextFloat() < 0.5f + like * 0.4f) {
                lastMeet[key] = clock
                A.face(B.x); B.face(A.x)
                val kind = when { like > 0.5f -> "hug"; like > 0.1f -> "chat"; like < -0.3f -> "huff"; else -> "greet" }
                val (ra, rb) = when (kind) { "hug" -> "happy" to "happy"; "chat" -> "talk" to "talk"; "huff" -> "shy" to "sad"; else -> "greet" to "greet" }
                A.react(ra, 2.2f); B.react(rb, 2.2f)
                out += Meeting(a.id, b.id, kind)
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
}
