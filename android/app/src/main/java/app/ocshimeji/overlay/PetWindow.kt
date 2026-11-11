package app.ocshimeji.overlay

import android.annotation.SuppressLint
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.WindowManager
import app.ocshimeji.core.pet.Gestures
import app.ocshimeji.core.pet.PetBrain
import app.ocshimeji.core.pet.PetRoutine
import app.ocshimeji.core.pet.PetSocial
import app.ocshimeji.core.pet.PetSound
import app.ocshimeji.core.pet.PetTalk
import org.json.JSONObject

/**
 * One OC on the desktop: its own small overlay window (only as large as the pet → touches anywhere
 * else reach the app underneath), a [PetBrain], a [Gestures] classifier, a speech [Bubble] and the
 * long-press [PetMenu]. Interactions that matter to the game are queued with [PetFiles.event].
 */
@SuppressLint("ClickableViewAccessibility")
class PetWindow(private val svc: OverlayPetService, val id: String, seed: Int) {
    val brain = PetBrain(seed)
    val talk = PetTalk(seed + 1)
    /** 12.0: when this pet makes a sound (the clips are its own voice, played by [PetSounds]) */
    val sound = PetSound(seed + 2)
    /** 13.0: strings single moves into routines that fit the time of day, the mood and the personality */
    val routine = PetRoutine(seed + 3)
    val view = PetView(svc.uiCtx)
    private val wm = svc.wm
    private val lp = overlayParams(1, 1, 0).apply { title = "OC Shimeji pet" }
    private val gestures: Gestures
    private val bubble = Bubble(svc.uiCtx, wm)
    private val menu = PetMenu(svc.uiCtx, wm)
    var name = ""; private set
    var sizePx = 0; private set
    var attached = false; private set
    private var opacity = 1f
    private var passthrough = false
    private var allowDrag = true
    private var doubleTap = "open"
    private var foods: List<JSONObject> = emptyList()
    private var gifts: List<JSONObject> = emptyList()
    private val spent = HashMap<String, Int>()     // items given on the desktop since the last config (not yet applied by the game)
    private var stayPut = false
    private var autonomy = PetBrain.Allow()
    private var curKey = ""; private var clipT = 0f; private var lastFrame = -1
    private var strokes = 0; private var lastPetEvent = 0L
    private var prevState = PetBrain.State.IDLE
    var hidden = false; private set

    init {
        val d = svc.resources.displayMetrics.density
        gestures = Gestures(slop = 10 * d, dragDist = 34 * d)
        view.setOnTouchListener { _, e -> onTouch(e); true }
    }

    // ---------------------------------------------------------------- config
    fun configure(p: JSONObject, data: JSONObject?, g: JSONObject, sprites: PetSprites?, screenW: Int, screenH: Int, top: Int, bottom: Int) {
        val d = svc.resources.displayMetrics.density
        name = p.optString("name", "OC")
        val newSize = (96 * d * p.optDouble("size", 1.0).toFloat().coerceIn(0.6f, 1.8f)).toInt()
        opacity = p.optDouble("opacity", 1.0).toFloat().coerceIn(0.3f, 1f)
        passthrough = g.optBoolean("passthrough", false) || p.optBoolean("passthrough", false)
        allowDrag = p.optBoolean("drag", true)
        doubleTap = p.optString("doubleTap", "open")
        autonomy = PetBrain.Allow(p.optInt("autonomy", 1).coerceIn(-1, 2), p.optBoolean("climb", true), p.optBoolean("ceiling", true), p.optBoolean("peek", true), p.optBoolean("run", true), p.optBoolean("jump", true))
        brain.allow = if (stayPut) autonomy.copy(level = -1) else autonomy
        talk.freq = runCatching { PetTalk.Freq.valueOf(p.optString("talk", "normal").uppercase()) }.getOrDefault(PetTalk.Freq.NORMAL)
        talk.muted = p.optBoolean("mute", false) || !g.optBoolean("bubbles", true)
        view.sprites = sprites
        routine.enabled = g.optBoolean("routines", true)
        sound.on = g.optBoolean("sound", false) && !p.optBoolean("mute", false)
        sound.volume = g.optDouble("soundVol", 0.6).toFloat().coerceIn(0f, 1f)
        sound.available = if (sound.on) svc.sounds.load(id) else emptySet()
        view.filter = g.optString("quality", "mid") != "low"
        if (data != null) {
            data.optJSONObject("traits")?.let { t -> brain.traits = PetBrain.Traits(t.f("energy", .5f), t.f("social", .5f), t.f("curious", .5f), t.f("shy", .3f), t.f("pace", .5f)) }
            data.optJSONObject("mood")?.let { m -> brain.mood = PetBrain.Mood(m.f("energy", .7f), m.f("play", .6f), m.f("hunger", .7f), m.f("social", .6f), m.optString("emotion", "neutral")) }
            data.optJSONObject("lines")?.let { l -> val out = HashMap<String, List<String>>(); for (k in l.keys()) { val a = l.optJSONArray(k) ?: continue; out[k] = (0 until a.length()).map { a.optString(it) } }; talk.pools = out }
            foods = data.optJSONArray("foods")?.let { a -> (0 until a.length()).mapNotNull { a.optJSONObject(it) } } ?: emptyList()
            gifts = data.optJSONArray("gifts")?.let { a -> (0 until a.length()).mapNotNull { a.optJSONObject(it) } } ?: emptyList()
            if (data.has("at") && data.optLong("at") != lastDataAt) { lastDataAt = data.optLong("at"); spent.clear() }
        }
        val first = !attached || newSize != sizePx
        sizePx = newSize
        if (first) brain.reset(screenW, screenH, sizePx, startX = (screenW * (0.25f + (seedX % 50) / 100f)), topInset = top, bottomInset = bottom)
        lp.width = sizePx; lp.height = sizePx
        lp.alpha = if (passthrough) opacity.coerceAtMost(0.8f) else opacity
        lp.flags = if (passthrough) lp.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE else lp.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()
        if (attached) runCatching { wm.updateViewLayout(view, lp) }
    }
    private var lastDataAt = 0L
    private val seedX = (id.hashCode() and 0x7fffffff)
    private fun JSONObject.f(k: String, def: Float) = optDouble(k, def.toDouble()).toFloat()

    fun attach(): Boolean {
        if (attached) return true
        lp.x = brain.x.toInt(); lp.y = brain.y.toInt()
        attached = runCatching { wm.addView(view, lp) }.isSuccess
        return attached
    }

    fun detach() {
        bubble.hide(); menu.hide()
        if (attached) runCatching { wm.removeView(view) }
        attached = false
    }

    /** hide over excluded apps (app-context rule) without destroying anything */
    fun setHidden(h: Boolean) {
        if (h == hidden) return
        hidden = h; view.visibility = if (h) android.view.View.GONE else android.view.View.VISIBLE
        if (h) { bubble.hide(); menu.hide() }
    }

    fun resize(w: Int, h: Int, top: Int, bottom: Int) { brain.resize(w, h, top, bottom, sizePx); menu.hide() }

    // ---------------------------------------------------------------- frame
    /** returns true if anything was redrawn */
    fun frame(dt: Float, now: Long, screenW: Int, top: Int, paused: Boolean, theme: PetTheme): Boolean {
        if (!attached) return false
        if (gestures.isDown) gestures.tick(now).forEach { handle(it, now, theme) }
        if (!paused || brain.isDragging || brain.state == PetBrain.State.FALL || brain.state == PetBrain.State.THROWN || brain.state == PetBrain.State.REACT) brain.update(dt)
        if (!paused && !stayPut) routine.update(brain, dt, svc.hour, svc.pairBusy(id))
        talk.update(dt); sound.update(dt); sound.quiet = svc.soundQuiet
        if (brain.state != prevState) { stateSound(prevState, brain.state); prevState = brain.state }
        // animation timing: the OC's own clip (per-frame durations, loop mode, events)
        val sp = view.sprites
        val key = sp?.keyFor(brain.anim) ?: brain.anim
        if (key != curKey) { curKey = key; clipT = 0f; lastFrame = -1 } else clipT += dt
        val set = sp?.set(brain.anim)
        val f = if (set != null) set.clip.at(clipT).i else 0
        if (set != null && lastFrame >= 0 && f != lastFrame) for (e in set.clip.eventsBetween(lastFrame, f)) onAnimEvent(e.type, e.data, now, theme)
        lastFrame = f
        if (!hidden && (brain.x.toInt() != lp.x || brain.y.toInt() != lp.y)) { lp.x = brain.x.toInt(); lp.y = brain.y.toInt(); runCatching { wm.updateViewLayout(view, lp) } }
        // spontaneous lines (never while paused / sleeping / hidden)
        if (!paused && !hidden && !bubble.showing && brain.state != PetBrain.State.SLEEP) talk.chatter(talk.moodCategory(svc.hour, brain.mood))?.let { say(it, theme, now) }
        bubble.follow(brain.x, brain.y, sizePx, screenW, top, now)
        return view.show(brain, set, f)
    }

    private fun onAnimEvent(type: String, data: String, now: Long, theme: PetTheme) {
        when (type) {
            "bubble" -> if (data.isNotBlank() && !talk.muted) say(data, theme, now)
            "emote" -> if (data.isNotBlank() && !talk.muted) say(data, theme, now)
            "sound" -> if (svc.haptics) view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
        }
    }

    fun say(text: String, theme: PetTheme, now: Long) { if (!hidden) { bubble.show(text, theme, passthrough, now); cue(PetSound.Ev.TALK) } }

    /** ask the rules (core:pet PetSound) whether a sound is due, and play it */
    fun cue(ev: PetSound.Ev, asleep: Boolean = brain.state == PetBrain.State.SLEEP) {
        if (hidden) return
        sound.cue(ev, brain.mood.emotion, asleep)?.let { svc.sounds.play(id, it) }
    }
    /** a paired action started with another pet: the warm or the low two-tone (only the initiator plays it) */
    fun meetingSound(kind: String) { if (!hidden) sound.meeting(kind, brain.mood.emotion)?.let { svc.sounds.play(id, it) } }
    private fun stateSound(from: PetBrain.State, to: PetBrain.State) {
        when {
            to == PetBrain.State.JUMP -> cue(PetSound.Ev.JUMP)
            to == PetBrain.State.LAND && (from == PetBrain.State.FALL || from == PetBrain.State.THROWN) -> cue(PetSound.Ev.LAND)
            to == PetBrain.State.THROWN -> cue(PetSound.Ev.THROWN)
        }
    }
    fun sayCat(cat: String, now: Long, chatter: Boolean = false) { (if (chatter) talk.chatter(cat, 60f) else talk.react(cat, 4f))?.let { say(it, svc.theme, now) } }

    // ---------------------------------------------------------------- touch
    private fun onTouch(e: MotionEvent) {
        val now = e.eventTime
        val evs = when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> gestures.down(e.rawX, e.rawY, now)
            MotionEvent.ACTION_MOVE -> gestures.move(e.rawX, e.rawY, now)
            MotionEvent.ACTION_UP -> gestures.up(e.rawX, e.rawY, now)
            MotionEvent.ACTION_CANCEL -> gestures.cancel()
            else -> emptyList()
        }
        for (ev in evs) handle(ev, now, svc.theme)
        if (e.actionMasked == MotionEvent.ACTION_UP && strokes > 0) finishStroke(now)
    }

    private var grabX = 0f; private var grabY = 0f
    private fun handle(ev: Gestures.Ev, now: Long, theme: PetTheme) {
        svc.touched(this)
        when (ev.kind) {
            Gestures.Kind.TAP -> { menu.hide(); val was = brain.state == PetBrain.State.SLEEP; brain.poke(); cue(if (was) PetSound.Ev.WAKE else PetSound.Ev.TAP, asleep = false); sayCat(if (was) "wake" else "tap", now); haptic() }
            Gestures.Kind.DOUBLE_TAP -> when (doubleTap) { "open" -> svc.openApp("petcenter"); "talk" -> sayCat("double", now); else -> Unit }
            Gestures.Kind.LONG_PRESS -> { haptic(HapticFeedbackConstants.LONG_PRESS); openMenu(theme) }
            Gestures.Kind.STROKE -> { menu.hide(); strokes = ev.count; brain.react("pet", 1.6f); if (ev.count == 2) { cue(PetSound.Ev.PET); sayCat("pet", now) } }
            Gestures.Kind.DRAG_START -> if (allowDrag) { menu.hide(); bubble.hide(); grabX = ev.x - brain.x; grabY = ev.y - brain.y; sayCat("drag", now) }
            Gestures.Kind.DRAG_MOVE -> if (allowDrag) brain.drag(ev.x - grabX, ev.y - grabY)
            Gestures.Kind.DROP -> if (allowDrag && brain.isDragging) { brain.release(ev.vx, ev.vy); svc.dropped(this) }
            Gestures.Kind.CANCEL -> Unit
        }
    }

    private fun finishStroke(now: Long) {
        // one "petting" event per session, at most every 15 s (the game also caps the effect per day)
        if (now - lastPetEvent > 15_000) { lastPetEvent = now; PetFiles.event(svc, id, "pet", JSONObject().put("strokes", strokes)) }
        strokes = 0
    }

    private fun haptic(kind: Int = HapticFeedbackConstants.KEYBOARD_TAP) { if (svc.haptics) view.performHapticFeedback(kind) }

    // ---------------------------------------------------------------- menu
    private fun left(o: JSONObject) = o.optInt("n") - (spent[o.optString("id")] ?: 0)

    private fun openMenu(theme: PetTheme) {
        val now = { android.os.SystemClock.uptimeMillis() }
        val items = arrayListOf(
            PetMenu.Item("摸摸頭") { brain.react("pet", 1.8f); sayCat("pet", now()); PetFiles.event(svc, id, "pet", JSONObject().put("strokes", 1).put("menu", true)) },
            PetMenu.Item("餵食", if (foods.any { left(it) > 0 }) "背包裡的食物" else "背包沒有食物", foods.any { left(it) > 0 }) { foodMenu(theme) },
            PetMenu.Item("送禮物", if (gifts.any { left(it) > 0 }) "背包裡可以送的東西" else "背包沒有可送的東西", gifts.any { left(it) > 0 }) { giftMenu(theme) },
            PetMenu.Item("說說話") { sayCat(if (talk.has("memory") && Math.random() < 0.4) "memory" else "idle", now()) },
            PetMenu.Item(if (stayPut) "自由活動" else "待在這裡", if (stayPut) "恢復自主行動" else "暫時不自己走動") { stayPut = !stayPut; brain.allow = if (stayPut) autonomy.copy(level = -1) else autonomy; if (stayPut) brain.settle() },
            PetMenu.Item("收起$name", "只收起這一隻（其他桌寵繼續）") { svc.removePet(id) },
            PetMenu.Item("開啟遊戲") { svc.openApp("petcenter") },
        )
        menu.show(name, items, theme, brain.x, brain.y, sizePx, svc.screenW, svc.screenH)
    }

    private fun foodMenu(theme: PetTheme) {
        val list = foods.filter { left(it) > 0 }.take(8).map { f ->
            val lv = f.optInt("lv", 0)
            PetMenu.Item("${f.optString("zh")} ×${left(f)}", when (lv) { 2 -> "最愛"; 1 -> "喜歡"; -1 -> "不太喜歡"; -2 -> "討厭"; else -> null }) { feed(f) }
        }
        menu.show("餵${name}吃什麼？", list, theme, brain.x, brain.y, sizePx, svc.screenW, svc.screenH)
    }

    private fun giftMenu(theme: PetTheme) {
        val list = gifts.filter { left(it) > 0 }.take(8).map { g -> PetMenu.Item("${g.optString("zh")} ×${left(g)}") { gift(g) } }
        menu.show("送${name}什麼？", list, theme, brain.x, brain.y, sizePx, svc.screenW, svc.screenH)
    }

    /** eating: the animation plays now; the item is only deducted by the game (OC.Tx, fixed key) when it applies the event */
    private fun feed(f: JSONObject) {
        val idf = f.optString("id"); if (left(f) <= 0) return
        spent[idf] = (spent[idf] ?: 0) + 1
        val lv = f.optInt("lv", 0)
        val dur = view.sprites?.set("eat")?.clip?.seconds()?.coerceIn(1.2f, 4f) ?: 2.4f
        brain.react("eat", dur); cue(PetSound.Ev.EAT)
        val now = android.os.SystemClock.uptimeMillis()
        svc.later((dur * 1000).toLong()) { brain.react(if (lv >= 1) "happy" else if (lv <= -1) "sad" else "idle", 1.4f); sayCat(if (lv >= 1) "eat_yum" else if (lv <= -1) "eat_no" else "eat_ok", now + 1) }
        PetFiles.event(svc, id, "feed", JSONObject().put("item", idf))
    }

    private fun gift(g: JSONObject) {
        val idg = g.optString("id"); if (left(g) <= 0) return
        spent[idg] = (spent[idg] ?: 0) + 1
        brain.react("happy", 1.8f); cue(PetSound.Ev.GIFT); sayCat("gift", android.os.SystemClock.uptimeMillis())
        PetFiles.event(svc, id, "gift", JSONObject().put("item", idg))
    }

    fun closePopups() { bubble.hide(); menu.hide() }
}
