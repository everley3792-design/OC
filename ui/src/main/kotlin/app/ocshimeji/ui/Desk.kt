package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.desk.DeskContext
import app.ocshimeji.sim.desk.DeskGestures
import app.ocshimeji.sim.desk.DeskOther
import app.ocshimeji.sim.desk.DeskPersona
import app.ocshimeji.sim.desk.DeskPet
import app.ocshimeji.sim.desk.DeskProps
import app.ocshimeji.sim.desk.DeskThing
import app.ocshimeji.sim.town.Goods
import app.ocshimeji.sim.desk.DeskScreen
import app.ocshimeji.sim.desk.DeskState
import app.ocshimeji.sim.desk.Side
import app.ocshimeji.sim.life.Axis
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.SimEvent
import kotlin.math.min

/** what the phone tells the desktop: power and whether something is showing full screen */
data class Phone(val charging: Boolean = false, val battery: Int = 80, val fullscreen: Boolean = false)

/**
 * The desktop (plan 2.3 / M3), pure and testable: up to three pets of one world on the phone's screen. It shares the world with
 * the home screen through `WorldHost`, turns fingers into gestures, gives each pet what it needs to decide (the resident's needs,
 * the hour, the phone) and sends what happens back to the one simulation (petting, feeding, being thrown, sleeping, lines).
 * The Android service only puts a small window around each pet and its bubble, and asks this for what to draw.
 */
class DeskStage(val app: UiApp, val slotId: String, val screen: DeskScreen) {
    val open: WorldHost.Open = app.host.acquire(slotId)
    val sim get() = open.sim
    class Pet(val id: String, val pet: DeskPet, val gest: DeskGestures, val look: Look?) {
        var bubble: String? = null; var bubbleAt = -99f; var live = false; var hearts = ArrayList<Float>()
        /** F-04: this finger started next to the pet, not on it — the pet comes after it */
        var following = false
    }
    val pets = LinkedHashMap<String, Pet>()
    var time = 0f; private set
    /** a pet whose menu should open (long press, or tapping a hungry one) — the host shows it and clears this */
    var menuFor: String? = null
    private var lastRemind = 0f
    private val listener: (SimEvent) -> Unit = { e -> pets[e.who]?.let { p -> when (e.kind) {
        "say" -> { p.bubble = e.text; p.bubbleAt = time; p.live = false; sim.person(e.who)?.let { app.platform.voice(it.spec.voice, e.text) } }
        "heart" -> p.hearts += time
        "sound" -> app.platform.sound(e.text)
        "song" -> e.text.split("|").let { v -> app.platform.melody(v[0].split(",").mapNotNull { it.toIntOrNull() }.toIntArray(), v.getOrNull(1)?.toFloatOrNull() ?: 1f) }   /* 1.7.0: their theme */
    } } }
    init { open.listeners += listener; restoreFocus() }

    /** bring a resident out; null = done, otherwise why not */
    fun add(id: String): String? {
        if (id in pets) return null
        if (pets.size >= MAX) return "桌面上最多 $MAX 位"
        val p = sim.person(id) ?: return "這個世界沒有這位"
        if (p.out != null) return "${p.name}去小鎮了，回家後才能帶到桌面"
        val c = app.saves.libChar(p.libId); val look = c?.let { Look(app, it, p.spec) }
        val img = look?.base; val aspect = if (img != null) img.w.toFloat() / img.h else 0.8f
        val dp = DeskPet(id, BASE * (look?.scale ?: 1f), aspect, Rng.hash("desk:$slotId:$id:${app.platform.now()}"))
        dp.place(screen, screen.w * (0.3f + 0.4f * ((pets.size * 37 % 10) / 10f)))
        dp.persona = DeskPersona.of(p.spec)
        sim.toDesk(id); pets[id] = Pet(id, dp, DeskGestures(), look); return null
    }
    /** back home (also when the service stops) */
    fun remove(id: String) { pets.remove(id) ?: return; sim.fromDesk(id); app.host.save(open) }
    fun close() { for (id in pets.keys.toList()) remove(id); focus = null; open.listeners -= listener; app.host.release(slotId) }

    /** reminder interval in minutes (0 = off) and whether to hide during full-screen apps — player settings (plan 13.6, F-14) */
    val remindEvery: Int get() = app.saves.pref("desk:remind")?.toIntOrNull() ?: 0
    val hideFullscreen: Boolean get() = app.saves.pref("desk:fullscreen") != "off"

    fun frame(dt: Float, phone: Phone) {
        time += dt
        app.host.drive(open, dt, "desk")
        val due = remindEvery > 0 && time - lastRemind > remindEvery * 60f
        val live = liveLine(); focusTick(dt)
        val things = sim.life.deskProps.map { DeskThing(it.id, it.kind, it.fx * screen.w) }
        for (pt in pets.values.toList()) {
            val p = sim.person(pt.id) ?: continue; val dp = pt.pet
            pt.gest.tick(time); gestures(pt)
            val ctx = DeskContext(hour = sim.hour, charging = phone.charging, battery = phone.battery, fullscreen = phone.fullscreen && hideFullscreen,
                food = p.need(Need.FOOD), energy = p.need(Need.ENERGY), attention = p.need(Need.ATTENTION), active = p.spec.axis(Axis.ACTIVE),
                reminderDue = due && pt == pets.values.first(), live = live, props = things, focus = focus?.phase, habits = p.spec.habits.size,
                others = pets.values.filter { it !== pt }.map { o -> DeskOther(o.id, o.pet.x, o.pet.side == Side.FLOOR, o.pet.state, sim.rel(pt.id, o.id)?.like ?: 30) })
            dp.step(dt, screen, ctx)
            var resting = false
            for (e in dp.events) when (e.kind) {
                "say" -> if (e.text == "reminder" || e.text in REMIND_KEYS) sim.deskSay(pt.id, "reminder") else sim.deskSay(pt.id, e.text)
                "live" -> { pt.bubble = e.text; pt.bubbleAt = time; pt.live = true }
                "pet" -> sim.pet(pt.id, e.value, partOf(pt))
                "petEnd" -> sim.petEnd(pt.id)
                "lift" -> sim.deskLift(pt.id)
                "land" -> sim.deskLand(pt.id, true)
                "rest" -> resting = true
                "sound" -> app.platform.sound(e.text)
                "ask", "menu" -> if (e.kind == "menu") menuFor = pt.id
                "ack" -> lastRemind = time
                "tap" -> if (time - pt.bubbleAt > 4f) sim.deskSay(pt.id, "tapDesk")
                "invite" -> { val (k, who) = e.text.split("|"); val o = pets[who]; if (o == null || !o.pet.invited(k, pt.id, dp.x, screen)) dp.declined() }
                "together" -> { val (k, who) = e.text.split("|"); if (who in pets) sim.deskTogether(pt.id, who, k) }
                "eat", "water", "read", "nest" -> sim.deskUse(pt.id, e.text, e.kind)
                "habit" -> sim.deskHabit(pt.id, e.value.toInt())
            }
            dp.events.clear()
            sim.deskRest(pt.id, resting || dp.state == DeskState.SLEEP)
            if (due && pt == pets.values.first() && dp.state == DeskState.PEEK && pt.bubble?.let { time - pt.bubbleAt < 1f } != true && time - pt.bubbleAt > 6f) sim.deskSay(pt.id, "reminder")
        }
    }
    /** something happening at home, said by a pet now and then (13.6 小鎮直播): the newest line about someone not on the desk */
    private fun liveLine(): String? {
        val home = sim.life.people.filter { !it.desk }.map { it.id }.toSet(); if (home.isEmpty()) return null
        val l = sim.life.log.lastOrNull { it.who in home && sim.life.minute - it.minute < 60 } ?: return null
        return "家裡：" + l.text
    }
    private fun partOf(pt: Pet): String { val p = pt.pet; return if (p.side == Side.FLOOR && lastY < p.y - p.height * 0.66f) "頭" else "身體" }
    private var lastY = 0f

    /** a finger on a pet's window, in screen dp: kind 0 down, 1 move, 2 up, 3 cancel. Down next to the pet (not on it) = it follows (F-04) */
    fun touch(id: String, kind: Int, x: Float, y: Float) {
        val pt = pets[id] ?: return; lastY = y
        if (kind == 0) { val b = pt.pet.bounds(4f); pt.following = followOn && pt.pet.side == Side.FLOOR && (x < b[0] || x > b[0] + b[2] || y < b[1] || y > b[1] + b[3]) }
        if (pt.following) { when (kind) { 0, 1 -> pt.pet.follow(x); else -> { pt.pet.followEnd(); pt.following = false } }; return }
        when (kind) { 0 -> pt.gest.down(time, x, y); 1 -> pt.gest.move(time, x, y); 2 -> pt.gest.up(time, x, y); else -> pt.gest.cancel() }
        gestures(pt)
    }
    private fun gestures(pt: Pet) {
        val d = pt.pet
        for (g in pt.gest.out) when (g) {
            is DeskGestures.G.Tap -> d.tap(); is DeskGestures.G.DoubleTap -> d.doubleTap(); is DeskGestures.G.LongPress -> menuFor = pt.id
            is DeskGestures.G.Rub -> d.rub(g.sec); is DeskGestures.G.RubEnd -> d.rubEnd()
            is DeskGestures.G.DragStart -> d.grab(g.x, g.y); is DeskGestures.G.Drag -> d.drag(g.x, g.y, screen); is DeskGestures.G.Release -> d.release(g.vx, g.vy)
        }
        pt.gest.out.clear()
    }
    /** how often the whole desktop is worth drawing: the busiest pet decides (plan 2.4 power budget) */
    val fps: Int get() = pets.values.maxOfOrNull { maxOf(it.pet.fps, if (time - it.bubbleAt < 4f) 8 else 0) } ?: 0

    // ---------------- drawing (each pet in its own small window) ----------------
    /** the pet window, in screen dp (left, top, width, height) */
    fun windowOf(id: String): FloatArray? = pets[id]?.pet?.bounds(margin)
    /** R6 leftover: the band around the pet that makes it follow your finger can be switched off (it also catches touches meant for the app below) */
    val followOn: Boolean get() = app.saves.pref("desk:follow") != "off"
    val margin: Float get() = if (followOn) MARGIN else 10f
    /** draw a pet into its window (the canvas origin is the window's top-left) */
    fun drawPet(g: Gfx, id: String) {
        val pt = pets[id] ?: return; val d = pt.pet; val b = d.bounds(margin); val p = sim.person(id) ?: return; val look = pt.look ?: return
        if (d.hidden) return
        g.save(); g.translate(d.x - b[0], d.y - b[1]); g.rotate(Math.toRadians(d.rotation.toDouble() + d.lean * 9.0).toFloat())   /* together: leaning toward the other one */
        val asleep = d.state == DeskState.SLEEP || d.state == DeskState.DOZE
        Actors.draw(g, look, 0f, 0f, d.height / look.scale, d.pose, time, 0f, d.facing, 0f, if (asleep) "bed" else null, asleep, sim.moodSky(p))
        Actors.extras(g, app.theme, look, d.pose, 0f, 0f, d.height / look.scale, time, 0f, d.facing, asleep, if (asleep && (sim.hour >= 23 || sim.hour < 5)) "pillow" else null)
        pt.hearts.removeAll { time - it > 1.2f }
        for (h in pt.hearts) { val k = (time - h) / 1.2f; g.save(); g.alpha(1 - k); Widgets.heart(g, 0f, -d.height * (0.9f + k * 0.4f), 6f, 0xFFF0705A.toInt()); g.restore() }
        g.restore()
    }
    /** the current bubble of a pet, or null */
    fun bubbleOf(id: String): String? { val pt = pets[id] ?: return null; return pt.bubble?.takeIf { time - pt.bubbleAt < (if (pt.live) 6f else 4f) && !pt.pet.hidden } }
    fun isLive(id: String) = pets[id]?.live == true
    /** the bubble window above the pet (dp), kept on screen */
    fun bubbleWindow(g: Gfx, id: String): FloatArray? {
        val text = bubbleOf(id) ?: return null; val pt = pets[id]!!; val b = pt.pet.bounds(0f)
        val lines = Widgets.wrap(g, text, Dim.FS_S + 1, 200f, 5); val w = lines.maxOf { g.measure(it, Dim.FS_S + 1) } + 28; val h = 18f + lines.size * 20f + 8
        val x = (b[0] + b[2] / 2 - w / 2).coerceIn(4f, screen.w - w - 4); var y = b[1] - h - 4; if (y < screen.top) y = b[1] + b[3] + 4
        return floatArrayOf(x, y, w, h)
    }
    fun drawBubble(g: Gfx, id: String) {
        val text = bubbleOf(id) ?: return; val t = app.theme; val lines = Widgets.wrap(g, text, Dim.FS_S + 1, 200f, 5)
        val w = g.width; val h = g.height - 8
        g.fillRound(0f, 3f, w, h, 16f, t.shadow); g.fillRound(0f, 0f, w, h, 16f, if (isLive(id)) t.surface2 else t.surface)
        sim.person(id)?.spec?.tint?.takeIf { it.matches(Regex("#[0-9A-Fa-f]{6}")) }?.let { g.strokeRound(1f, 1f, w - 2, h - 2, 15f, 2f, Colors.hex(it)) }
        lines.forEachIndexed { i, l -> g.text(l, w / 2, 24f + i * 20f, Dim.FS_S + 1, t.ink, FontKind.UI, Align.CENTER) }
    }
    // ---------------- R6 F-05 / F-06: things on the desktop (each in its own small window) ----------------
    val propIds: List<String> get() = sim.life.deskProps.map { it.id }
    /** a thing's window on the floor (dp) */
    fun propWindow(id: String): FloatArray? { val r = sim.life.deskProps.firstOrNull { it.id == id } ?: return null; val w = if (r.kind == "nest") 76f else 46f; val h = if (r.kind == "nest") 40f else 44f
        return floatArrayOf(r.fx * screen.w - w / 2, screen.ground - h + 6, w, h) }
    fun drawProp(g: Gfx, id: String) {
        val r = sim.life.deskProps.firstOrNull { it.id == id } ?: return; val t = app.theme; val b = propWindow(id) ?: return; val w = b[2]; val h = b[3]; val p = HouseView.Pal(t)
        g.fillRound(4f, h - 10, w - 8, 8f, 4f, Colors.withAlpha(0xFF000000.toInt(), 0.14f))
        when (r.kind) {
            "nest" -> { g.fillRound(2f, 8f, w - 4, h - 12, 14f, p.woodLip); g.fillRound(6f, 6f, w - 12, h - 16, 12f, Colors.mix(p.coral, p.white, 0.3f)); g.fillRound(10f, 10f, 24f, 12f, 6f, p.white) }
            "food" -> ItemArt.draw(g, t, sim.life, r.item ?: "cookie", w / 2, h / 2 - 2, 34f, app)
            "blanket" -> { g.fillRound(4f, h - 22, w - 8, 14f, 5f, p.skyLip); g.fillRound(4f, h - 24, w - 8, 12f, 5f, p.sky); for (k in 0 until 3) g.fillRect(10f + k * 10f, h - 22, 2f, 10f, Colors.withAlpha(p.white, 0.6f)) }
            "plant" -> { g.fillRound(w / 2 - 9, h - 22, 18f, 14f, 3f, p.coralLip); g.fillCircle(w / 2 - 5, h - 26, 7f, p.leaf); g.fillCircle(w / 2 + 5, h - 28, 7f, p.leafLip); g.fillCircle(w / 2, h - 34, 6f, p.leaf) }
            else -> { g.fillRound(w / 2 - 14, h - 30, 28f, 20f, 3f, p.white); for (k in 0 until 3) g.fillRect(w / 2 - 10, h - 25 + k * 5f, 20f - k * 4f, 1.4f, p.whiteLip) }
        }
    }
    private var propDrag: String? = null; private var propDown = 0f; private var propMoved = false; private var propTap = -9f; private var propTapId: String? = null
    /** a finger on a thing: drag it along the floor; a double tap puts it away (a snack goes back to the bag) */
    fun touchProp(id: String, kind: Int, x: Float, y: Float) {
        val r = sim.life.deskProps.firstOrNull { it.id == id } ?: return
        when (kind) {
            0 -> { propDrag = id; propDown = x; propMoved = false }
            1 -> if (propDrag == id) { if (kotlin.math.abs(x - propDown) > 8f) propMoved = true; if (propMoved) r.fx = (x / screen.w).coerceIn(0.05f, 0.95f) }
            2 -> { if (propDrag == id && !propMoved) { if (propTapId == id && time - propTap < 0.4f) { sim.deskTake(id); propTapId = null; app.platform.sound("pop") } else { propTapId = id; propTap = time } }; propDrag = null }
            else -> propDrag = null
        }
    }
    /** put something down where the pet is; null = done, otherwise why not */
    fun put(kind: String, near: String): String? {
        val d = pets[near]?.pet ?: return null; val fx = ((d.x + d.facing * d.width * 0.9f) / screen.w)
        val item = if (kind == "food") sim.life.bag.keys.firstOrNull { sim.foodOf(it) != null && Goods.ALL[it]?.kind == "food" } ?: return "背包裡沒有點心（可以在小鎮的雜貨店買）" else null   /* the others come from the bag in deskPut */
        return sim.deskPut(kind, fx, item)
    }
    fun putAway() { for (r in sim.life.deskProps.toList()) sim.deskTake(r.id) }

    // ---------------- R6 F-08: keeping you company (a focus timer) ----------------
    class Focus(val work: Int, val rest: Int, var phase: String = "work", var left: Float = work * 60f, var rounds: Int = 0)
    var focus: Focus? = null; private set
    fun startFocus(work: Int = 25, rest: Int = 5) { focus = Focus(work, rest); keepFocus() }
    /** R6 leftover: the timer is kept in the settings by the clock on the wall, so a restarted service carries on */
    private fun keepFocus() { val f = focus; app.saves.setPref("desk:focus", f?.let { "${it.phase}|${app.platform.now() + (it.left * 1000).toLong()}|${it.work}|${it.rest}|${it.rounds}" }) }
    private fun restoreFocus() {
        val v = app.saves.pref("desk:focus")?.split("|") ?: return; if (v.size < 5) return
        val left = (v[1].toLongOrNull() ?: return) - app.platform.now(); if (left <= 0) { app.saves.setPref("desk:focus", null); return }
        focus = Focus(v[2].toIntOrNull() ?: 25, v[3].toIntOrNull() ?: 5, v[0], left / 1000f, v[4].toIntOrNull() ?: 0)
    }
    /** what the notification says about the timer (null = no timer) */
    val focusLine: String? get() = focus?.let { f -> (if (f.phase == "work") "陪你專心中，還有" else "休息中，還有") + " ${(f.left / 60).toInt() + 1} 分" }
    fun stopFocus() { focus?.let { f -> if (f.phase == "work") { val done = ((f.work * 60 - f.left) / 60).toInt(); if (done >= 5) sim.deskFocus(pets.keys.toList(), done) } }; focus = null; keepFocus() }
    private fun focusTick(dt: Float) {
        val f = focus ?: return; f.left -= dt; if (f.left > 0) return
        if (f.phase == "work") { sim.deskFocus(pets.keys.toList(), f.work); f.rounds++; f.phase = "break"; f.left = f.rest * 60f; app.platform.sound("chime") }
        else if (f.rounds >= 4) { pets.keys.firstOrNull()?.let { sim.deskSay(it, "focusDone") }; focus = null }
        else { f.phase = "work"; f.left = f.work * 60f; app.platform.sound("tick") }
        keepFocus()
    }

    companion object { const val MAX = 3; const val BASE = 110f; private val REMIND_KEYS = setOf("reminder")
        /** room around the pet inside its window: a finger there makes it follow (F-04) */
        const val MARGIN = 30f }
}

/**
 * The long-press menu on the desktop (plan F-02): snacks (the same as at home), back home, open the app, touch-through mode.
 * Drawn in its own small window with the normal widgets.
 */
class DeskMenuScreen(val stage: DeskStage, val id: String, val action: (String) -> Unit) : Screen() {
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val p = stage.sim.person(id) ?: return
        Widgets.card(g, t, 4f, 4f, W - 8, H - 12, Dim.RADIUS_L)
        Widgets.face(g, t, stage.pets[id]?.look?.base, 34f, 38f, 20f)
        g.text(Widgets.fit(g, p.name, Dim.FS_M, W - 110), 62f, 34f, Dim.FS_M, t.ink); g.text(Widgets.fit(g, stage.sim.moodLabel(p) + if (p.need(Need.FOOD) < 30) "・肚子餓" else "", Dim.FS_S - 1, W - 110), 62f, 54f, Dim.FS_S - 1, t.ink2)
        Widgets.round(g, app, "m:close", W - 30, 34f, 16f, "close")
        val bw = (W - 32 - 12) / 3
        listOf("cookie" to "餅乾", "apple" to "蘋果", "milk" to "牛奶").forEachIndexed { i, (k, zh) -> Widgets.button(g, app, "m:feed:$k", 16 + i * (bw + 6), 72f, bw, 44f, zh, size = Dim.FS_S + 1) }
        /* R6: things to put on the desktop, the nest, keeping you company */
        g.text("放在牠旁邊", 18f, 136f, Dim.FS_S - 1, t.ink2)
        val kinds = listOf("food", "blanket", "plant", "note", "nest"); val kw = (W - 32 - 4 * 5) / 5
        kinds.forEachIndexed { i, k -> val x = 16 + i * (kw + 5); val down = app.pressed == "m:put:$k"; val s = if (down) 2f else 0f
            g.fillRound(x, 144f + Dim.LIP, kw, 48f, 12f, t.lip); g.fillRound(x, 144f + s, kw, 48f, 12f, t.surface2)
            Widgets.icon(g, DeskProps[k]!!.icon, x + kw / 2, 162f + s, 15f, t.ink2); g.text(Widgets.fit(g, DeskProps[k]!!.zh, Dim.FS_S - 3, kw - 4), x + kw / 2, 184f + s, Dim.FS_S - 3, t.ink, FontKind.UI, Align.CENTER)
            app.zone("m:put:$k", x, 144f, kw, 52f) }
        val f = stage.focus; val hw = (W - 32 - 6) / 2
        Widgets.button(g, app, "m:focus", 16f, 206f, hw, 44f, if (f == null) "陪我專心 25 分" else (if (f.phase == "work") "專心中 ${(f.left / 60).toInt() + 1} 分" else "休息 ${(f.left / 60).toInt() + 1} 分") + "・停", size = Dim.FS_S)
        Widgets.button(g, app, "m:putaway", 22f + hw, 206f, hw, 44f, "收起桌上的東西", size = Dim.FS_S)
        Widgets.button(g, app, "m:home", 16f, 258f, hw, 44f, "回家", size = Dim.FS_S + 1)
        Widgets.button(g, app, "m:app", 22f + hw, 258f, hw, 44f, "打開 App", size = Dim.FS_S + 1)
        Widgets.button(g, app, "m:through", 16f, 310f, W - 32, 44f, "讓手指穿過（從通知恢復）", Kind.GHOST, Dim.FS_S)
        g.text("手指按在牠旁邊拖：牠會追過來", W / 2, 372f, Dim.FS_S - 2, t.ink3, FontKind.UI, Align.CENTER)
    }
    override fun tap(id: String) {
        when {
            id.startsWith("m:feed:") -> { val msg = stage.sim.feed(this.id, id.removePrefix("m:feed:")); if (msg.isNotEmpty()) stage.sim.deskSay(this.id, "tapDesk"); action("close") }
            id.startsWith("m:put:") -> { val why = stage.put(id.removePrefix("m:put:"), this.id); stage.pets[this.id]?.let { pt -> if (why != null) { pt.bubble = why; pt.bubbleAt = stage.time; pt.live = false } }; action("close") }
            id == "m:putaway" -> { stage.putAway(); action("close") }
            id == "m:focus" -> { if (stage.focus == null) stage.startFocus() else stage.stopFocus(); action("close") }
            id == "m:home" -> { stage.remove(this.id); action("home") }
            id == "m:app" -> action("app"); id == "m:through" -> action("through"); id == "m:close" -> action("close")
        }
    }
    companion object { const val W = 280f; const val H = 392f }
}

/**
 * 桌面 (from the person card): bring them out or call them home, reminders, hiding during full-screen apps, and the honest
 * "make it more stable" guide (plan 2.4: never asks to ignore battery optimisation; the player decides).
 */
class DeskSheet(val slotId: String, val personId: String, val name: String, val onDesk: () -> Boolean) : Overlay() {
    private val slide = Spring(0f, 1f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val W = app.w; val G = Dim.GUTTER
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val h = 540f + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); g.fillRound(W / 2 - 20, y + 10, 40f, 5f, 3f, t.line); app.zone("sheet:body", 0f, y, W, h)
        val out = onDesk()
        g.text("手機桌面", G + 4, y + 44, Dim.FS_L, t.ink); g.text(if (out) "$name 在桌面上" else "讓 $name 跑到手機桌面上陪你", G + 4, y + 68, Dim.FS_S, t.ink2)
        val f = Form(app, g, G, W - G * 2, y + 80)
        val every = app.saves.pref("desk:remind")?.toIntOrNull() ?: 0
        f.chips("remind", listOf("不提醒", "每 30 分", "每 60 分", "每 90 分"), setOf(when (every) { 30 -> "每 30 分"; 60 -> "每 60 分"; 90 -> "每 90 分"; else -> "不提醒" }), label = "從螢幕邊探頭提醒你喝水、休息")
        f.toggle("full", "看影片、玩遊戲時躲起來", app.saves.pref("desk:fullscreen") != "off", "全螢幕結束後再出來")
        f.toggle("follow", "手指按在牠旁邊會追過來", app.saves.pref("desk:follow") != "off", "關掉後，牠四周不會擋住下面的 App")
        f.button("stable", "讓桌寵更穩定（各廠牌的設定說明）")
        Widgets.button(g, app, "desk:go", G, y + h - app.insetBottom - 72, W - G * 2, 56f, if (out) "叫回家" else "帶到桌面", Kind.PRIMARY, Dim.FS_L)
    }
    override fun tap(id: String) {
        when {
            id.startsWith("chip:remind:") -> app.saves.setPref("desk:remind", when (id.removePrefix("chip:remind:")) { "每 30 分" -> "30"; "每 60 分" -> "60"; "每 90 分" -> "90"; else -> null })
            id == "tog:full" -> app.saves.setPref("desk:fullscreen", if (app.saves.pref("desk:fullscreen") == "off") null else "off")
            id == "tog:follow" -> app.saves.setPref("desk:follow", if (app.saves.pref("desk:follow") == "off") null else "off")
            id == "btn:stable" -> app.show(ListSheet("讓桌寵更穩定", STABLE.mapIndexed { i, s -> "s$i" to s }, subtitle = "都由你決定；App 不會自己改設定") {})
            id == "desk:go" -> {
                if (onDesk()) { app.platform.deskStop(slotId, personId); app.closeOverlay(); app.toast("$name 回家了"); return }
                if (!app.platform.canOverlay()) { app.closeOverlay(); app.show(DeskPermissionSheet()); return }
                val err = app.platform.deskStart(slotId, personId); app.closeOverlay(); app.toast(err ?: "$name 跑到桌面上了")
            }
        }
    }
    companion object {
        val STABLE = listOf("一般 Android：設定 → 應用程式 → OC Shimeji → 電池 → 選「不受限制」可以讓桌寵比較不會被關掉。",
            "小米／紅米：設定 → 應用程式 → 自啟動 打開；省電策略選「無限制」。",
            "華為／榮耀：設定 → 電池 → 應用啟動管理 → OC Shimeji 改成手動，三個開關都打開。",
            "OPPO／realme／一加：設定 → 電池 → 更多設定 → 允許背景執行。",
            "三星：設定 → 電池 → 背景使用限制，不要把 OC Shimeji 放進「休眠應用程式」。",
            "桌寵被系統關掉時不會自己重開；回到 App 後，時間會照常補算。")
    }
}

/** plan 2.4: explain before opening the system page for "display over other apps" */
class DeskPermissionSheet : Overlay() {
    private val pop = Spring(0f, 1f, 260f, 22f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val k = pop.step(dt); val W = app.w
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, k.coerceIn(0f, 1f)))
        val w = min(W - 32, 360f); val h = 330f; val x = (W - w) / 2; val y = (app.h - h) / 2
        Widgets.card(g, t, x, y, w, h); app.zone("perm:body", x, y, w, h)
        g.text("需要一個權限", x + 20, y + 42, Dim.FS_L, t.ink)
        var yy = y + 76
        for (s in listOf("角色要出現在其他 App 上面，Android 需要你開啟「顯示在其他應用程式上層」。",
            "牠只畫自己的小視窗，不會讀取畫面、通知或你打的字。", "開啟後回到這裡，再按一次「帶到桌面」。"))
            for (l in Widgets.wrap(g, s, Dim.FS_S + 1, w - 40)) { g.text(l, x + 20, yy, Dim.FS_S + 1, t.ink2); yy += 24 }
        Widgets.button(g, app, "perm:go", x + 20, y + h - 72, w - 40, 52f, "前往設定", Kind.PRIMARY)
    }
    override fun tap(id: String) { if (id == "perm:go") { app.closeOverlay(); app.platform.openOverlaySettings() } }
}
