package app.ocshimeji.core.pet

/**
 * 14.1: everything the desktop pets do TOGETHER, as pure logic (no Android) — the counterpart of [PetActor] for the whole group.
 * The overlay service only owns windows, the notification and the frame callback; it asks the stage what the frame rate should be,
 * lets it run the pair logic, and carries out the commands it returns for each pet.
 *
 *  - frame pacing: 10 fps while paused, 15 while everyone rests, the player's cap otherwise
 *  - paired actions ([PetSocial]): who meets whom, the two lines (the second one a beat later), one sound, one "meet" event
 *  - "test a paired action" from the game: the second pet walks over, then the action starts as soon as the rules allow it
 *  - app-context lines: the first pet that has a line for that kind of app says it (never while paused)
 *  - reminders: the first pet says the reminder text and its own line, and cheers or greets
 */
class PetStage {
    data class Cmd(val pet: String, val out: PetActor.Out)

    val social = PetSocial()
    private val actors = LinkedHashMap<String, PetActor>()
    private val later = ArrayList<Triple<Float, String, String>>()        // (when, pet, line category)
    private var clock = 0f
    private var test: Test? = null
    private class Test(val kind: String, val a: String, val b: String, var wait: Float, var tries: Int)

    val size get() = actors.size
    fun add(a: PetActor) { actors[a.id] = a }
    fun remove(id: String) { actors.remove(id); later.removeAll { it.second == id }; test?.let { if (it.a == id || it.b == id) test = null } }
    fun clear() { actors.clear(); later.clear(); test = null }
    operator fun get(id: String) = actors[id]

    /** how often the pets need to be drawn right now */
    fun frameCap(paused: Boolean, cap: Int): Int {
        val resting = actors.values.all { it.brain.isResting } && actors.values.none { it.brain.isDragging }
        return when { paused -> 10; resting -> 15; else -> cap }.coerceAtLeast(1)
    }

    fun pairBusy(id: String) = social.isBusy(id)

    /** once per frame, after every pet's own tick */
    fun step(dt: Float, paused: Boolean): List<Cmd> {
        val out = ArrayList<Cmd>(2)
        clock += dt
        if (later.isNotEmpty()) { val due = later.filter { it.first <= clock }; later.removeAll(due); for ((_, pet, cat) in due) actors[pet]?.let { a -> a.sayCat(cat).forEach { out += Cmd(pet, it) } } }
        if (paused) return out
        test?.let { t ->
            t.wait -= dt
            if (t.wait <= 0f) {
                val a = actors[t.a]; val b = actors[t.b]
                val m = if (a != null && b != null) social.start(t.kind, PetSocial.Member(a.id, a.brain), PetSocial.Member(b.id, b.brain)) else null
                when { m != null -> { test = null; meet(m, out) }; t.tries <= 0 || a == null || b == null -> test = null; else -> { t.tries--; t.wait = 0.5f } }
            }
        }
        if (actors.size > 1) for (m in social.step(actors.values.map { PetSocial.Member(it.id, it.brain) }, dt)) meet(m, out)
        return out
    }

    private fun meet(m: PetSocial.Meeting, out: ArrayList<Cmd>) {
        val a = actors[m.a] ?: return; if (actors[m.b] == null) return
        val cat = PetSocial.KINDS[m.kind]?.lines ?: "friend"
        a.sayCat(cat).forEach { out += Cmd(m.a, it) }
        later += Triple(clock + 1.2f, m.b, cat)                                     // the other one answers a beat later
        a.meetingSound(m.kind).forEach { out += Cmd(m.a, it) }                       // one sound per meeting, from the one who started it
        out += Cmd(m.a, PetActor.Out.Event("meet", mapOf("with" to m.b, "kind" to m.kind)))
    }

    /** "test on the desktop" from the game: the first two pets walk to each other and play this paired action */
    fun testPair(kind: String): Boolean {
        val l = actors.values.toList(); if (l.size < 2 || PetSocial.KINDS[kind] == null) return false
        val a = l[0]; val b = l[1]
        b.brain.goTo(a.brain.x + a.brain.size * 0.7f * (if (b.brain.x >= a.brain.x) 1 else -1))
        test = Test(kind, a.id, b.id, 0.9f, 20)
        return true
    }

    /** the app in front changed to one of this kind: one pet may comment on it */
    fun appContext(category: String, paused: Boolean): List<Cmd> {
        if (paused) return emptyList()
        val a = actors.values.firstOrNull { it.talk.has("app_$category") } ?: return emptyList()
        return a.sayCat("app_$category", chatter = true).map { Cmd(a.id, it) }
    }

    /** a reminder / timer fired: the first pet says it (the notification is posted separately) */
    fun announce(cat: String, text: String?): List<Cmd> {
        val a = actors.values.firstOrNull() ?: return emptyList()
        val line = a.talk.react(cat, 0f)
        a.brain.react(if (cat == "timer_done") "cheer" else "greet", 2f)
        return listOf(Cmd(a.id, PetActor.Out.Say(listOfNotNull(text, line).joinToString("\n").ifBlank { "⏰" })))
    }
}
