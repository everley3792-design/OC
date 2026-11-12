package app.ocshimeji.overlay

import android.annotation.SuppressLint
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.WindowManager
import app.ocshimeji.core.pet.PetActor
import app.ocshimeji.core.pet.PetBrain
import app.ocshimeji.core.pet.PetTalk
import org.json.JSONObject

/**
 * One OC on the desktop. 14.0: this class is only the RENDERER — its own small overlay window (only as large as the pet →
 * touches anywhere else reach the app underneath), the sprite view, the speech [Bubble] and the long-press [PetMenu].
 * Everything the pet decides and does lives in [PetActor] (core:pet, pure Kotlin, unit-tested): the window feeds it pointer
 * samples and frame ticks and carries out the commands it returns.
 */
@SuppressLint("ClickableViewAccessibility")
class PetWindow(private val svc: OverlayPetService, val id: String, seed: Int) {
    private val density = svc.resources.displayMetrics.density
    val actor = PetActor(id, seed, slop = 10 * density, dragDist = 34 * density)
    val brain get() = actor.brain
    val view = PetView(svc.uiCtx)
    private val wm = svc.wm
    private val lp = overlayParams(1, 1, 0).apply { title = "OC Shimeji pet" }
    private val bubble = Bubble(svc.uiCtx, wm)
    private val menu = PetMenu(svc.uiCtx, wm)
    val name get() = actor.name
    var sizePx = 0; private set
    var attached = false; private set
    private var opacity = 1f
    private var passthrough = false
    private var curKey = ""; private var clipT = 0f; private var lastFrame = -1
    var hidden = false; private set

    init { view.setOnTouchListener { _, e -> onTouch(e); true } }

    // ---------------------------------------------------------------- config
    fun configure(p: JSONObject, data: JSONObject?, g: JSONObject, sprites: PetSprites?, screenW: Int, screenH: Int, top: Int, bottom: Int) {
        val d = density
        actor.name = p.optString("name", "OC")
        val newSize = (96 * d * p.optDouble("size", 1.0).toFloat().coerceIn(0.6f, 1.8f)).toInt()
        opacity = p.optDouble("opacity", 1.0).toFloat().coerceIn(0.3f, 1f)
        passthrough = g.optBoolean("passthrough", false) || p.optBoolean("passthrough", false)
        actor.allowDrag = p.optBoolean("drag", true)
        actor.doubleTap = p.optString("doubleTap", "open")
        actor.autonomy = PetBrain.Allow(p.optInt("autonomy", 1).coerceIn(-1, 2), p.optBoolean("climb", true), p.optBoolean("ceiling", true), p.optBoolean("peek", true), p.optBoolean("run", true), p.optBoolean("jump", true))
        actor.talk.freq = runCatching { PetTalk.Freq.valueOf(p.optString("talk", "normal").uppercase()) }.getOrDefault(PetTalk.Freq.NORMAL)
        actor.talk.muted = p.optBoolean("mute", false) || !g.optBoolean("bubbles", true)
        view.sprites = sprites
        actor.routine.enabled = g.optBoolean("routines", true)
        actor.sound.on = g.optBoolean("sound", false) && !p.optBoolean("mute", false)
        actor.sound.volume = g.optDouble("soundVol", 0.6).toFloat().coerceIn(0f, 1f)
        actor.sound.available = if (actor.sound.on) svc.sounds.load(id) else emptySet()
        view.filter = g.optString("quality", "mid") != "low"
        if (data != null) {
            data.optJSONObject("traits")?.let { t -> brain.traits = PetBrain.Traits(t.f("energy", .5f), t.f("social", .5f), t.f("curious", .5f), t.f("shy", .3f), t.f("pace", .5f)) }
            data.optJSONObject("mood")?.let { m -> brain.mood = PetBrain.Mood(m.f("energy", .7f), m.f("play", .6f), m.f("hunger", .7f), m.f("social", .6f), m.optString("emotion", "neutral")) }
            data.optJSONObject("lines")?.let { l -> val out = HashMap<String, List<String>>(); for (k in l.keys()) { val a = l.optJSONArray(k) ?: continue; out[k] = (0 until a.length()).map { a.optString(it) } }; actor.talk.pools = out }
            fun stock(k: String) = data.optJSONArray(k)?.let { a -> (0 until a.length()).mapNotNull { a.optJSONObject(it) }.map { o -> PetActor.Stock(o.optString("id"), o.optString("zh"), o.optInt("n"), o.optInt("lv", 0)) } } ?: emptyList()
            actor.stock(stock("foods"), stock("gifts"), data.optLong("at"))
        }
        val first = !attached || newSize != sizePx
        sizePx = newSize
        if (first) brain.reset(screenW, screenH, sizePx, startX = (screenW * (0.25f + (seedX % 50) / 100f)), topInset = top, bottomInset = bottom)
        lp.width = sizePx; lp.height = sizePx
        lp.alpha = if (passthrough) opacity.coerceAtMost(0.8f) else opacity
        lp.flags = if (passthrough) lp.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE else lp.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()
        actor.eatSeconds = sprites?.set("eat")?.clip?.seconds() ?: 2.4f
        if (attached) runCatching { wm.updateViewLayout(view, lp) }
    }
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
        hidden = h; actor.hidden = h; view.visibility = if (h) android.view.View.GONE else android.view.View.VISIBLE
        if (h) { bubble.hide(); menu.hide() }
    }

    fun resize(w: Int, h: Int, top: Int, bottom: Int) { brain.resize(w, h, top, bottom, sizePx); menu.hide() }

    // ---------------------------------------------------------------- frame
    /** returns true if anything was redrawn */
    fun frame(dt: Float, now: Long, screenW: Int, top: Int, paused: Boolean, theme: PetTheme): Boolean {
        if (!attached) return false
        run(actor.tick(dt, now, svc.hour, paused, svc.pairBusy(id), bubble.showing, svc.soundQuiet), now)
        // animation timing: the OC's own clip (per-frame durations, loop mode, events)
        val sp = view.sprites
        val key = sp?.keyFor(brain.anim) ?: brain.anim
        if (key != curKey) { curKey = key; clipT = 0f; lastFrame = -1 } else clipT += dt
        val set = sp?.set(brain.anim)
        val f = if (set != null) set.clip.at(clipT).i else 0
        if (set != null && lastFrame >= 0 && f != lastFrame) for (e in set.clip.eventsBetween(lastFrame, f)) run(actor.animEvent(e.type, e.data), now)
        lastFrame = f
        if (!hidden && (brain.x.toInt() != lp.x || brain.y.toInt() != lp.y)) { lp.x = brain.x.toInt(); lp.y = brain.y.toInt(); runCatching { wm.updateViewLayout(view, lp) } }
        bubble.follow(brain.x, brain.y, sizePx, screenW, top, now)
        return view.show(brain, set, f)
    }

    /** carry out what the actor decided */
    private fun run(outs: List<PetActor.Out>, now: Long) {
        for (o in outs) when (o) {
            is PetActor.Out.Say -> if (!hidden) bubble.show(o.text, svc.theme, passthrough, now)
            is PetActor.Out.Play -> svc.sounds.play(id, o.cue)
            is PetActor.Out.Haptic -> if (svc.haptics) view.performHapticFeedback(if (o.long) HapticFeedbackConstants.LONG_PRESS else HapticFeedbackConstants.KEYBOARD_TAP)
            is PetActor.Out.Event -> PetFiles.event(svc, id, o.type, JSONObject().apply { for ((k, v) in o.data) put(k, v) })
            is PetActor.Out.Menu -> menu.show(o.title, o.items.map { it -> PetMenu.Item(it.label, it.sub, it.enabled) { run(actor.menu(it.key), android.os.SystemClock.uptimeMillis()) } }, svc.theme, brain.x, brain.y, sizePx, svc.screenW, svc.screenH)
            PetActor.Out.HideMenu -> menu.hide()
            PetActor.Out.HideBubble -> bubble.hide()
            PetActor.Out.Remove -> svc.removePet(id)
            is PetActor.Out.Open -> svc.openApp(o.page)
        }
    }

    fun say(text: String, now: Long) { if (!hidden) bubble.show(text, svc.theme, passthrough, now) }
    fun sayCat(cat: String, now: Long, chatter: Boolean = false) = run(actor.sayCat(cat, chatter), now)
    /** a paired action started with another pet: the warm or the low two-tone (only the initiator plays it) */
    fun meetingSound(kind: String) = run(actor.meetingSound(kind), android.os.SystemClock.uptimeMillis())

    // ---------------------------------------------------------------- touch
    private fun onTouch(e: MotionEvent) {
        val p = when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> PetActor.Ptr.DOWN
            MotionEvent.ACTION_MOVE -> PetActor.Ptr.MOVE
            MotionEvent.ACTION_UP -> PetActor.Ptr.UP
            MotionEvent.ACTION_CANCEL -> PetActor.Ptr.CANCEL
            else -> return
        }
        run(actor.pointer(p, e.rawX, e.rawY, e.eventTime), e.eventTime)
    }

    fun closePopups() { bubble.hide(); menu.hide() }
}
