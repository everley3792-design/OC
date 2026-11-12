package app.ocshimeji.core.pet

import kotlin.random.Random

/**
 * 14.0: everything ONE desktop pet does, as pure logic (no Android): its [PetBrain], its lines ([PetTalk]), its voice rules
 * ([PetSound]), its routines ([PetRoutine]), what a touch means ([Gestures]), the long-press menu, feeding / gifts from the
 * bag snapshot, "stay here" and "take a nap".
 *
 * The overlay window is only a renderer: it feeds pointer samples and frame ticks in, and carries out the [Out] commands that
 * come back (show a bubble, play a clip, vibrate, queue an event for the game, open a menu …). Because nothing here touches
 * the platform, the whole behaviour is unit-tested (PetActorTest).
 *
 * The rules that must not change (CLAUDE.md): the pet never changes needs — it only reports interactions as events the game
 * applies once; an item is "spent" locally right away so the menu cannot offer more than the bag holds, but it is the game
 * that deducts it.
 */
class PetActor(val id: String, seed: Int, slop: Float = 24f, dragDist: Float = 90f) {
    val brain = PetBrain(seed)
    val talk = PetTalk(seed + 1)
    val sound = PetSound(seed + 2)
    val routine = PetRoutine(seed + 3)
    private val gestures = Gestures(slop = slop, dragDist = dragDist)
    private val rnd = Random(seed + 4)

    /** something in the bag the pet can be given: [lv] is how much it likes it (−2 … 2) */
    data class Stock(val id: String, val zh: String, val n: Int, val lv: Int = 0)
    data class MenuItem(val key: String, val label: String, val sub: String? = null, val enabled: Boolean = true)
    enum class Ptr { DOWN, MOVE, UP, CANCEL }

    /** what the window has to do */
    sealed class Out {
        data class Say(val text: String) : Out()
        data class Play(val cue: PetSound.Cue) : Out()
        data class Haptic(val long: Boolean = false) : Out()
        /** an interaction the game should hear about (appended to events.jsonl by the window) */
        data class Event(val type: String, val data: Map<String, Any> = emptyMap()) : Out()
        data class Menu(val title: String, val items: List<MenuItem>) : Out()
        object HideMenu : Out()
        object HideBubble : Out()
        /** put only this pet away */
        object Remove : Out()
        data class Open(val page: String) : Out()
    }

    // ---- settings (the window copies them from config.json) ----
    var name = "OC"
    var allowDrag = true
    /** "open" | "talk" | anything else = nothing */
    var doubleTap = "open"
    var autonomy = PetBrain.Allow()
        set(v) { field = v; applyAllow() }
    /** hidden over an excluded app: it keeps living, but says and plays nothing */
    var hidden = false
    /** how long the eating animation of this character runs (its own clip), seconds */
    var eatSeconds = 2.4f

    var stayPut = false; private set
    var napping = false; private set
    var foods: List<Stock> = emptyList(); private set
    var gifts: List<Stock> = emptyList(); private set
    private val spent = HashMap<String, Int>()
    private var stockStamp = 0L
    private var strokes = 0
    private var lastPetEvent = -1_000_000L
    private var prevState = PetBrain.State.IDLE
    private var grabX = 0f; private var grabY = 0f
    private var clock = 0f
    private val timers = ArrayList<Pair<Float, (ArrayList<Out>) -> Unit>>()

    val isDown get() = gestures.isDown
    private fun applyAllow() { brain.allow = if (stayPut || napping) autonomy.copy(level = -1) else autonomy }

    /** the bag snapshot from the game; a new [stamp] means the game has applied what was given, so the local count starts over */
    fun stock(foods: List<Stock>, gifts: List<Stock>, stamp: Long) {
        this.foods = foods; this.gifts = gifts
        if (stamp != stockStamp) { stockStamp = stamp; spent.clear() }
    }
    fun left(s: Stock) = s.n - (spent[s.id] ?: 0)

    // ---------------------------------------------------------------- frame
    /**
     * One frame. [paused] = the player paused the pets (a held or falling pet still finishes its move);
     * [pairBusy] = it is in a paired action with another pet; [bubbleShowing] = its bubble is still up.
     */
    fun tick(dt: Float, now: Long, hour: Int, paused: Boolean, pairBusy: Boolean, bubbleShowing: Boolean, quiet: Boolean): List<Out> {
        val out = ArrayList<Out>(2)
        clock += dt
        if (gestures.isDown) for (ev in gestures.tick(now)) handle(ev, now, out)
        val moving = brain.isDragging || brain.state == PetBrain.State.FALL || brain.state == PetBrain.State.THROWN || brain.state == PetBrain.State.REACT
        if (!paused || moving) brain.update(dt)
        if (napping && brain.state != PetBrain.State.SLEEP && brain.state != PetBrain.State.REACT && !moving && brain.onFloor) brain.nap()
        if (!paused && !stayPut && !napping) routine.update(brain, dt, hour, pairBusy)
        talk.update(dt); sound.update(dt); sound.quiet = quiet
        if (brain.state != prevState) { stateSound(prevState, brain.state, out); prevState = brain.state }
        if (timers.isNotEmpty()) { val due = timers.filter { it.first <= clock }; timers.removeAll(due); for (t in due) t.second(out) }
        // spontaneous lines: never while paused, asleep, hidden, or while it is still saying something
        if (!paused && !hidden && !bubbleShowing && brain.state != PetBrain.State.SLEEP) talk.chatter(talk.moodCategory(hour, brain.mood))?.let { say(it, out) }
        return out
    }

    /** an event on the character's own animation clip (authored in the studio) */
    fun animEvent(type: String, data: String): List<Out> {
        val out = ArrayList<Out>(1)
        when (type) {
            "bubble", "emote" -> if (data.isNotBlank() && !talk.muted) say(data, out)
            "sound" -> out += Out.Haptic()
        }
        return out
    }

    private fun say(text: String, out: ArrayList<Out>) { if (!hidden) { out += Out.Say(text); cue(PetSound.Ev.TALK, out) } }
    private fun cue(ev: PetSound.Ev, out: ArrayList<Out>, asleep: Boolean = brain.state == PetBrain.State.SLEEP) {
        if (hidden) return
        sound.cue(ev, brain.mood.emotion, asleep)?.let { out += Out.Play(it) }
    }
    /** a line of a category (the pools come from the game's dialogue engine); [chatter] = spontaneous, long cooldown */
    fun sayCat(cat: String, chatter: Boolean = false): List<Out> { val out = ArrayList<Out>(2); sayCat(cat, out, chatter); return out }
    private fun sayCat(cat: String, out: ArrayList<Out>, chatter: Boolean = false) { (if (chatter) talk.chatter(cat, 60f) else talk.react(cat, 4f))?.let { say(it, out) } }
    /** a paired action started with another pet: only the one who started it makes the sound */
    fun meetingSound(kind: String): List<Out> = if (hidden) emptyList() else sound.meeting(kind, brain.mood.emotion)?.let { listOf(Out.Play(it)) } ?: emptyList()

    private fun stateSound(from: PetBrain.State, to: PetBrain.State, out: ArrayList<Out>) {
        when {
            to == PetBrain.State.JUMP -> cue(PetSound.Ev.JUMP, out)
            to == PetBrain.State.LAND && (from == PetBrain.State.FALL || from == PetBrain.State.THROWN) -> cue(PetSound.Ev.LAND, out)
            to == PetBrain.State.THROWN -> cue(PetSound.Ev.THROWN, out)
        }
    }

    // ---------------------------------------------------------------- touch
    fun pointer(p: Ptr, x: Float, y: Float, now: Long): List<Out> {
        val evs = when (p) {
            Ptr.DOWN -> gestures.down(x, y, now)
            Ptr.MOVE -> gestures.move(x, y, now)
            Ptr.UP -> gestures.up(x, y, now)
            Ptr.CANCEL -> gestures.cancel()
        }
        val out = ArrayList<Out>(3)
        for (ev in evs) handle(ev, now, out)
        if (p == Ptr.UP && strokes > 0) {
            // one "petting" event per session, at most every 15 s (the game also caps the effect per day)
            if (now - lastPetEvent > 15_000) { lastPetEvent = now; out += Out.Event("pet", mapOf("strokes" to strokes)) }
            strokes = 0
        }
        return out
    }

    private fun handle(ev: Gestures.Ev, now: Long, out: ArrayList<Out>) {
        when (ev.kind) {
            Gestures.Kind.TAP -> {
                out += Out.HideMenu
                val was = brain.state == PetBrain.State.SLEEP
                if (napping) wake()
                brain.poke(); cue(if (was) PetSound.Ev.WAKE else PetSound.Ev.TAP, out, asleep = false); sayCat(if (was) "wake" else "tap", out); out += Out.Haptic()
            }
            Gestures.Kind.DOUBLE_TAP -> when (doubleTap) { "open" -> out += Out.Open("petcenter"); "talk" -> sayCat("double", out); else -> Unit }
            Gestures.Kind.LONG_PRESS -> { out += Out.Haptic(long = true); out += mainMenu() }
            Gestures.Kind.STROKE -> { out += Out.HideMenu; strokes = ev.count; brain.react("pet", 1.6f); if (ev.count == 2) { cue(PetSound.Ev.PET, out); sayCat("pet", out) } }
            Gestures.Kind.DRAG_START -> if (allowDrag) { out += Out.HideMenu; out += Out.HideBubble; grabX = ev.x - brain.x; grabY = ev.y - brain.y; if (napping) wake(); sayCat("drag", out) }
            Gestures.Kind.DRAG_MOVE -> if (allowDrag) brain.drag(ev.x - grabX, ev.y - grabY)
            Gestures.Kind.DROP -> if (allowDrag && brain.isDragging) brain.release(ev.vx, ev.vy)   /* being thrown tells the game nothing: no reward for throwing */
            Gestures.Kind.CANCEL -> Unit
        }
    }

    private fun wake() { napping = false; applyAllow() }

    // ---------------------------------------------------------------- menu
    fun mainMenu(): Out.Menu {
        val food = foods.any { left(it) > 0 }; val gift = gifts.any { left(it) > 0 }
        return Out.Menu(name, listOf(
            MenuItem("pet", "摸摸頭"),
            MenuItem("food", "餵食", if (food) "背包裡的食物" else "背包沒有食物", food),
            MenuItem("gift", "送禮物", if (gift) "背包裡可以送的東西" else "背包沒有可送的東西", gift),
            MenuItem("talk", "說說話"),
            MenuItem("nap", if (napping) "叫醒牠" else "去睡一下", if (napping) "起來活動" else "安靜地睡，直到你叫牠"),
            MenuItem("stay", if (stayPut) "自由活動" else "待在這裡", if (stayPut) "恢復自主行動" else "暫時不自己走動"),
            MenuItem("remove", "收起$name", "只收起這一隻（其他桌寵繼續）"),
            MenuItem("open", "開啟遊戲"),
        ))
    }

    /** the player picked a menu entry ([MenuItem.key]) */
    fun menu(key: String): List<Out> {
        val out = ArrayList<Out>(3)
        when {
            key == "pet" -> { if (napping) wake(); brain.react("pet", 1.8f); sayCat("pet", out); out += Out.Event("pet", mapOf("strokes" to 1, "menu" to true)) }
            key == "food" -> out += Out.Menu("餵${name}吃什麼？", foods.filter { left(it) > 0 }.take(8).map { f ->
                MenuItem("food:${f.id}", "${f.zh} ×${left(f)}", when (f.lv) { 2 -> "最愛"; 1 -> "喜歡"; -1 -> "不太喜歡"; -2 -> "討厭"; else -> null })
            })
            key == "gift" -> out += Out.Menu("送${name}什麼？", gifts.filter { left(it) > 0 }.take(8).map { g -> MenuItem("gift:${g.id}", "${g.zh} ×${left(g)}") })
            key == "talk" -> sayCat(if (talk.has("memory") && rnd.nextFloat() < 0.4f) "memory" else "idle", out)
            key == "nap" -> if (napping) { wake(); brain.poke(); cue(PetSound.Ev.WAKE, out, asleep = false); sayCat("wake", out) } else { napping = true; applyAllow(); routine.cancel(); brain.nap() }
            key == "stay" -> { stayPut = !stayPut; applyAllow(); if (stayPut) { routine.cancel(); brain.settle() } }
            key == "remove" -> out += Out.Remove
            key == "open" -> out += Out.Open("petcenter")
            key.startsWith("food:") -> foods.firstOrNull { it.id == key.substring(5) }?.let { feed(it, out) }
            key.startsWith("gift:") -> gifts.firstOrNull { it.id == key.substring(5) }?.let { give(it, out) }
        }
        return out
    }

    /** eating: the animation plays now; the item is only deducted by the game (OC.Tx, fixed key) when it applies the event */
    private fun feed(f: Stock, out: ArrayList<Out>) {
        if (left(f) <= 0) return
        spent[f.id] = (spent[f.id] ?: 0) + 1
        if (napping) wake()
        val dur = eatSeconds.coerceIn(1.2f, 4f)
        brain.react("eat", dur); cue(PetSound.Ev.EAT, out)
        timers += (clock + dur) to { o -> brain.react(if (f.lv >= 1) "happy" else if (f.lv <= -1) "sad" else "idle", 1.4f); sayCat(if (f.lv >= 1) "eat_yum" else if (f.lv <= -1) "eat_no" else "eat_ok", o) }
        out += Out.Event("feed", mapOf("item" to f.id))
    }

    private fun give(g: Stock, out: ArrayList<Out>) {
        if (left(g) <= 0) return
        spent[g.id] = (spent[g.id] ?: 0) + 1
        if (napping) wake()
        brain.react("happy", 1.8f); cue(PetSound.Ev.GIFT, out); sayCat("gift", out)
        out += Out.Event("gift", mapOf("item" to g.id))
    }
}
