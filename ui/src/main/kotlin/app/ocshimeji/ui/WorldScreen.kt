package app.ocshimeji.ui

import app.ocshimeji.sim.life.Decor
import app.ocshimeji.sim.act.Choice
import app.ocshimeji.sim.act.Interactions
import app.ocshimeji.save.Studio
import app.ocshimeji.sim.social.Worries
import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.save.LibChar
import app.ocshimeji.save.World
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.AwaySummary
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Person
import app.ocshimeji.sim.life.Pose
import app.ocshimeji.sim.chars.Speech as SpeechSay
import app.ocshimeji.sim.Rng as RestRng
import app.ocshimeji.sim.town.Town as TownData
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * One world: the home (plan 12.11 M1). The life runs in `LifeSim`; this screen only watches it, draws it, and passes on touch:
 * rub a character = pet, hold still on one = pick it up (drag it around; let go with a flick = throw), tap = its card.
 * Dragging the empty floor pans, two fingers zoom. Opening the world first catches up the time you were away (plan J-05).
 */
class WorldScreen(val slotId: String) : Screen() {
    private var open: WorldHost.Open? = null
    val world: World? get() = open?.world
    lateinit var sim: LifeSim; private set
    private val incoming = ArrayList<app.ocshimeji.sim.life.SimEvent>()
    private val listener: (app.ocshimeji.sim.life.SimEvent) -> Unit = { incoming += it }
    private lateinit var view: HouseView
    var failed: String? = null; private set
    private val chars = HashMap<String, LibChar?>()
    fun libOf(p: Person): LibChar? = chars.getOrPut(p.libId) { app.saves.libChar(p.libId) }
    private val looks = HashMap<String, Look>()
    /** how a resident looks: the library character's pictures with this world's copy of who they are */
    fun lookOf(p: Person): Look? { val c = libOf(p) ?: return null; val l = looks[p.id]; if (l != null && l.spec === p.spec) return l
        return Look(app, c, p.spec).also { looks[p.id] = it; it.onEvent = { e -> frameEvent(p.id, e) } } }
    private val studioSounds: Map<String, String> by lazy { Studio(app.saves).sounds().associate { it.id to it.path } }
    /** an animation frame's event (plan 12.6 影格事件) */
    private fun frameEvent(who: String, e: String) { if (ff != null) return; when {
        e == "step" -> app.platform.sound("tick"); e.startsWith("sound:") -> studioSounds[e.drop(6)]?.let { app.platform.clip(it) }; e.startsWith("fx:") -> fxs += FxAt(who, e.drop(3), app.time) } }
    /** after editing someone: forget the cached pictures and settings */
    fun refresh() { chars.clear(); looks.clear() }

    // camera: the house point at the middle of the view (base dp) and the zoom
    var camX = 0f; var camY = 0f; var zoom = 1f; private var fitZoom = 1f
    private val viewCy get() = app.insetTop + (app.h - app.insetTop - app.insetBottom - 96) * 0.47f

    override val animating get() = true
    override val fps get() = if (world == null) 30 else if (ff != null || touch != null || pinch != null || sim.life.people.any { sim.body(it.id).flying || sim.body(it.id).held }) 60 else 30
    override fun enter() {
        val o = try { app.host.acquire(slotId) } catch (e: IllegalArgumentException) { failed = e.message; null } ?: return
        open = o; sim = o.sim; view = HouseView(sim.house); o.listeners += listener; o.screenActive = true
        if (!app.platform.deskRunning(slotId) && o.users == 1) for (p in sim.onDesk) sim.fromDesk(p.id)   /* the system stopped the desktop: they come home */
        catchUp()?.let { app.show(AwaySheet(it, sim.life.homeName.ifBlank { app.saves.slot(slotId)?.name ?: "" })) }
        if (!app.saves.flag("tip:touch")) tip = true
        decor(); bgmKind = ""; if (sim.life.music.isNotBlank()) app.platform.clip(sim.life.music, music = true)
    }
    /** the player's wallpaper and floors (plan 12.6) */
    fun decor() {
        fun img(p: String) = if (p.isBlank()) null else app.assets.decode("lib:$p@256", 256) { app.saves.readFile(p) }
        view.itemImg = { path -> img(path.removePrefix("lib:")) }
        view.plantStage = { x, y -> sim.journal.plantStage(x, y) }
        view.walls = sim.life.decor.mapNotNull { (r, d) -> img(d.wall)?.let { r to it } }.toMap(); view.floors = sim.life.decor.mapNotNull { (r, d) -> img(d.floor)?.let { r to it } }.toMap()
    }
    override fun leave() { app.platform.stopMusic(); val o = open ?: return; o.listeners -= listener; o.screenActive = false; app.host.release(slotId); open = null }
    override fun pause() { app.platform.stopMusic(); open?.let { it.screenActive = false; app.host.save(it) } }
    /** back from the background: the time that passed is caught up like an absence (the desktop may have kept it going) */
    override fun wake() { val o = open ?: return; o.screenActive = true; bgmKind = ""; if (sim.life.music.isNotBlank()) app.platform.clip(sim.life.music, music = true); catchUp()?.let { app.show(AwaySheet(it, sim.life.homeName)) } }

    /** how far the world is behind: real time since it was last watched (away time runs at 1×); ≥ 60 game minutes = a summary */
    private fun catchUp(): AwaySummary? = open?.let { app.host.catchUp(it) }
    fun flush() { open?.let { app.host.save(it) } }

    // ---------------- frame ----------------
    private class Bubble(val text: String, val born: Float)
    private class FxAt(val who: String, val kind: String, val born: Float)
    private val fxs = ArrayList<FxAt>()
    /** the two in a close-up (plan 13.1) and since when */
    private var closeup: Triple<String, String, Float>? = null
    /** observation mode (plan K-01): controls fold away, the camera follows what happens, a strip of everyone */
    var observing = false; private set
    /** tests: a close-up is showing / fast-forward is running */
    val inCloseup get() = closeup != null
    val fastForwarding get() = ff != null
    private var follow: String? = null; private var lockFollow = false
    /** fast-forward to the next thing worth watching (plan P-08) */
    private class FF(val logSize: Int, val from: Double, val mode: String, val speed: Double)
    private var ff: FF? = null
    private class Heart(val who: String, val born: Float, val dx: Float)
    private val bubbles = HashMap<String, Bubble>()
    private val hearts = ArrayList<Heart>()
    private var tip = false
    /** where each character is on screen this frame (for touch), nearest last */
    private val hits = ArrayList<Pair<String, FloatArray>>()

    fun sx(bx: Float) = (bx - camX) * zoom + app.w / 2
    fun sy(by: Float) = (by - camY) * zoom + viewCy
    /** a person's feet on screen (for tests and the card) */
    fun screenOf(id: String): Pair<Float, Float>? { val r = hits.firstOrNull { it.first == id }?.second ?: return null; return (r[0] + r[2] / 2) to (r[1] + r[3] * 0.6f) }

    /** the town screen drives the same life while it is on top (the house is not drawn then); returns what happened */
    fun driveElsewhere(dt: Float): List<app.ocshimeji.sim.life.SimEvent> { val o = open ?: return emptyList(); app.host.drive(o, dt, "screen"); music(); val e = ArrayList(incoming); incoming.clear(); return e }
    /** time-of-day music (plan N-03), unless this home has its own */
    private var bgmKind = ""
    /** the home's own music changed: the time-of-day music decides again */
    fun resetMusic() { bgmKind = "" }
    fun music() {
        if (sim.life.music.isNotBlank()) return
        val h = sim.hour; val k = when { h >= 5 && h < 10 -> "morning"; h >= 10 && h < 17 -> if (sim.weather() == "rain") "rain" else "day"; h >= 17 && h < 20 -> "evening"; else -> "night" }
        val ks = k + ":" + sim.season()   /* the season's sounds join in (plan N-03 / J-03) */
        if (ks != bgmKind) { bgmKind = ks; app.platform.bgm(ks) }
    }
    /** decorating (plan G-01): on = tap furniture to pick it, tap the floor to put it there */
    var placing = false; private set
    var placeSel = -1; private set
    var placeBag: String? = null; private set
    fun setPlacing(on: Boolean, bag: String? = null) { placing = on; placeSel = -1; placeBag = bag; if (on && observing) setObserving(false); if (!on) flush() }
    /** a tap on tile (x, y) while decorating */
    /** the room last touched while decorating (its scores are shown) */
    var placeRoom: String = ""; private set
    fun placeAt(tx: Int, ty: Int) {
        val d = sim.decorate; val pcs = d.pieces(); sim.house.roomAt(tx, ty)?.let { placeRoom = it.id }
        placeBag?.let { k -> val r = d.place(k, tx, ty); if (r != null) app.toast(r) else { app.platform.sound("pop"); if (sim.economy.count(k) <= 0) placeBag = null }; return }
        val hit = pcs.indexOfLast { pc -> val k = Furniture.kind(pc.kind); tx >= pc.x && tx < pc.x + k.w && ty >= pc.y && ty < pc.y + k.h }
        if (placeSel >= 0 && hit != placeSel) { val r = d.move(placeSel, tx, ty); if (r != null) app.toast(r) else { app.platform.sound("pop"); placeSel = -1 }; return }
        placeSel = if (hit == placeSel) -1 else hit
        if (hit >= 0 && pcs[hit].kind in d.FIXED) { app.toast("${Furniture.kind(pcs[hit].kind).zh}是固定的"); placeSel = -1 }
    }
    // R3: drag a piece from the bag onto the floor
    private var dragBag: String? = null; private var dragX = 0f; private var dragY = 0f
    /** tests: a piece is being dragged */
    val draggingBag: String? get() = dragBag
    override fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) {
        if (start) { dragBag = app.pressed?.takeIf { placing && it.startsWith("pl:") }?.removePrefix("pl:")?.takeIf { it !in setOf("done", "undo", "flip", "remove") }; dragX = x; dragY = y; return }
        if (dragBag != null) { dragX = x; dragY = y }
    }
    override fun release() {
        val k = dragBag ?: return; dragBag = null
        if (dragY < app.h - app.insetBottom - 184) { placeBag = k; placeSel = -1; val (tx, ty) = tileAt(dragX, dragY - 34); placeAt(tx, ty) }
    }
    private fun tileAt(x: Float, y: Float): Pair<Int, Int> { val bx = camX + (x - app.w / 2) / zoom; val by = camY + (y - viewCy) / zoom; return kotlin.math.floor(bx / view.T).toInt() to kotlin.math.floor(by / (view.T * view.K)).toInt() }

    fun light(h: Double): Float = when { h < 5 -> 0f; h < 7 -> ((h - 5) / 2).toFloat(); h < 17 -> 1f; h < 19.5 -> (1 - (h - 17) / 2.5).toFloat(); else -> 0f }

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop
        if (world == null) { g.fillRect(0f, 0f, W, H, t.bg); Widgets.card(g, t, Dim.GUTTER, H / 2 - 70, W - Dim.GUTTER * 2, 140f)
            g.text("這個存檔打不開", W / 2, H / 2 - 24, Dim.FS_L, t.ink, FontKind.UI, Align.CENTER); g.text(Widgets.fit(g, failed ?: "", Dim.FS_S, W - 64), W / 2, H / 2 + 6, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER)
            Widgets.button(g, app, "back", W / 2 - 80, H / 2 + 24, 160f, 48f, "回到選單"); return }
        if (view.house !== sim.house) { val same = view.house.w == sim.house.w && view.house.h == sim.house.h; view = HouseView(sim.house); decor(); if (!same) fit() }   /* decorated or moved */
        if (fitZoom == 1f && zoom == 1f) fit()
        music()
        touchFrame(dt)
        open?.let { o -> if (ff != null) fastForward(o) else app.host.drive(o, dt, "screen") }
        val evs = ArrayList(incoming); incoming.clear()
        for (e in evs) if (sim.person(e.who)?.desk != true) when (e.kind) {
            "say" -> { bubbles[e.who] = Bubble(e.text, app.time); if (ff == null) sim.person(e.who)?.let { p -> val clips = libOf(p)?.voices.orEmpty().mapNotNull { v -> studioSounds[v] }
                    if (clips.isNotEmpty()) app.platform.clip(clips[((app.time * 1000).toInt() and 0x7fffffff) % clips.size])   /* the player's own voice clips (screen-side choice, not the life's) */
                    else { val m = sim.moodValue(p).coerceIn(-4, 4); app.platform.voice(p.spec.voice.copy(pitch = p.spec.voice.pitch * (1f + 0.025f * m), speed = p.spec.voice.speed * (1f + 0.02f * m)), e.text) } }
                if (observing && !lockFollow) follow = e.who }
            "heart" -> hearts += Heart(e.who, app.time, ((app.time * 977) % 1f) - 0.5f)
            "sound" -> if (ff == null) app.platform.sound(e.text)
            "fx" -> fxs += FxAt(e.who, e.text, app.time)
            "closeup" -> { closeup = Triple(e.who, e.text, app.time); if (observing && !lockFollow) follow = e.who }
            "closeupEnd" -> if (closeup?.first == e.who) closeup = null
            "worry" -> { app.platform.sound("chime"); if (observing && !lockFollow) follow = e.who }
            "rps" -> if (app.overlay == null) app.show(RpsSheet(this, e.who))
            "goal" -> { app.platform.sound("chime"); app.toast("完成小目標：${e.text}") }
        }
        if (closeup?.let { app.time - it.third > 30f } == true) closeup = null
        if (observing && follow != null && touch == null && pinch == null) sim.person(follow!!)?.let { f -> if (!f.desk) { camX += (view.bx(f.x) - camX) * min(1f, dt * 2.5f); camY += (view.by(f.y) - 20 - camY) * min(1f, dt * 2.5f); clampCam() } }
        if (ff == null && app.overlay == null) sim.society.let { so -> sim.life.soc.cards.lastOrNull { !it.seen }?.let { c -> c.seen = true; app.show(DayCardSheet(c, sim.life.homeName)) } }
        val life = sim.life; val lt = light(sim.hour)

        // ---- outside: sky to grass
        val wx = sim.sky(); val grass = Wx.grass(t, sim.season())
        g.fillRect(0f, 0f, W, H, grass)
        g.fillGradientV(0f, 0f, W, sy(-30f), Wx.sky(t, wx, lt), grass)
        // ---- the house, everyone in it
        g.save(); g.translate(app.w / 2 - camX * zoom, viewCy - camY * zoom); g.scale(zoom, zoom)
        garden(g, t)
        hits.clear()
        val ds = ArrayList<HouseView.D>(); val CH = view.T * 1.62f
        val used = HashSet<Int>()
        life.people.forEachIndexed { i, p ->
            if (p.desk || p.out != null) return@forEachIndexed   /* out on the phone's desktop or in town: not at home */
            if (sim.society.hiding(p.id) != null) return@forEachIndexed   /* hiding: find them */
            val b = sim.body(p.id); val look = lookOf(p) ?: return@forEachIndexed
            val onPiece = if (b.arrivedAct && p.act != null) p.actPiece else -1; if (onPiece >= 0) used += onPiece
            val kind = sim.house.pieces.getOrNull(onPiece)?.kind
            val x = view.bx(p.x); val y = view.by(p.y)
            val lift = b.z * view.T + (if (b.pose == Pose.SIT || b.pose == Pose.WATCH || b.pose == Pose.EAT) HouseView.seat(kind) else 0f)
            val key = if (kind != null) sim.house.pieces[onPiece].y + Furniture.kind(kind).h + 0.01f else p.y
            val asleep = sim.asleep(p); val phase = i * 1.37f
            ds += HouseView.D(if (b.held || b.flying) 99f + i else key) {
                if (!b.held && kind != "bed" && kind != "bed2" && kind != "tub") Widgets.footShadow(g, t, x, y, CH * 0.5f * (1f - min(0.5f, b.z * 0.2f)))
                if (control && picked == p.id) { val pr = 1f + 0.08f * kotlin.math.sin(app.time * 4); g.strokeRound(x - 21 * pr, y - 7 * pr, 42 * pr, 14 * pr, 7 * pr, 2.5f, t.accentLip) }   /* R3: the one you are directing */
                Actors.draw(g, look, x, y, CH, b.pose, app.time, phase, p.facing, lift, kind, asleep, sim.moodSky(p))
                Actors.extras(g, t, look, b.pose, x, y - lift, CH, app.time, phase, p.facing, asleep, sim.propOf(p))
            }
            val ch = CH * look.scale
            val top0 = y - lift - ch * (if (b.pose == Pose.LIE) 0.75f else 1f)
            hits += p.id to floatArrayOf(sx(x - ch * 0.36f), sy(top0), ch * 0.72f * zoom, (y - top0 + 6) * zoom)
        }
        view.draw(g, t, app.time, lt, ds) { it in used }
        if (placing) placingMarks(g, t)
        g.restore()
        hits.sortBy { h -> life.people.firstOrNull { it.id == h.first }?.let { if (sim.body(it.id).held) 99f else it.y } ?: 0f }
        // ---- night: the whole scene a little blue
        if (lt < 1f) g.fillRect(0f, 0f, W, H, Colors.withAlpha(0xFF1E2550.toInt(), (1 - lt) * 0.22f))
        Wx.calm = app.saves.flag("a11y:calm")
        if (!placing) Wx.draw(g, W, H, wx, app.time)
        // ---- over the scene: mood skies, hearts, speech
        for ((id, r) in hits) {
            val p = sim.person(id) ?: continue; val cx = r[0] + r[2] / 2; val hy = r[1]
            Widgets.sky(g, t, sim.moodSky(p), cx + r[2] * 0.42f, hy + 4, 9f * min(1.3f, zoom))
            /* asleep: a dream made of today (plan A-06) — little pictures that change slowly */
            if (sim.asleep(p)) sim.journal.dreamOf(p.id)?.let { d -> val bx = cx + r[2] * 0.2f; val byy = hy - 26
                g.fillCircle(bx - 18, byy + 22, 3f, t.surface); g.fillCircle(bx - 12, byy + 14, 5f, t.surface); g.fillRound(bx - 6, byy - 18, 52f, 30f, 15f, t.surface)
                val ic = d.icons[((app.time / 1.6f).toInt()) % d.icons.size]
                if (ic in setOf("rain", "moon")) Widgets.sky(g, t, ic, bx + 20, byy - 3, 10f) else Widgets.icon(g, ic, bx + 20, byy - 3, 14f, t.ink2) }
        }
        restReminder(g, t, dt)
        // ---- worry bubbles (tap = what is wrong), requests, exaggerated effects
        for ((id, r) in hits) {
            val p = sim.person(id) ?: continue; val cx = r[0] + r[2] / 2; val hy = r[1]
            val w = p.worry; val a = p.ask
            if (w != null && (w.shown || w.mailed)) {
                val bob = kotlin.math.sin(app.time * 3) * 3; val bx = cx - r[2] * 0.42f; val byy = hy - 6 + bob
                g.fillCircle(bx, byy + 2, 17f, t.shadow); g.fillCircle(bx, byy, 17f, worryColor(w.kind)); g.fillCircle(bx + 9, byy + 15, 4f, worryColor(w.kind))
                Widgets.icon(g, Worries.ALL[w.kind]?.icon ?: "dots", bx, byy, 15f, 0xFFFFFDF7.toInt())
                app.zone("worry:$id", bx - 24, byy - 24, 48f, 48f)
            } else if (a != null) {
                val bx = cx - r[2] * 0.42f; val byy = hy - 4
                g.fillCircle(bx, byy, 14f, t.accent); g.text("！", bx, byy + 6, 16f, t.onAccent, FontKind.UI, Align.CENTER); app.zone("ask:$id", bx - 24, byy - 24, 48f, 48f)
            }
        }
        fxs.removeAll { app.time - it.born > Fx.LIFE }
        for (f in fxs) { val r = hits.firstOrNull { it.first == f.who }?.second ?: continue; Fx.draw(g, t, f.kind, r[0] + r[2] / 2, r[1] + 6, r[3], app.time - f.born) }
        hearts.removeAll { app.time - it.born > 1.4f }
        for (h in hearts) { val r = hits.firstOrNull { it.first == h.who }?.second ?: continue; val k = (app.time - h.born) / 1.4f
            g.save(); g.alpha(1 - k); Widgets.heart(g, r[0] + r[2] / 2 + h.dx * 40, r[1] - k * 40, 6f + k * 3, 0xFFF0705A.toInt()); g.restore() }
        bubbles.entries.removeAll { app.time - it.value.born > 3.2f }
        for ((id, b) in bubbles) { val r = hits.firstOrNull { it.first == id }?.second ?: continue; bubble(g, t, b, r[0] + r[2] / 2, r[1] - 10, sim.person(id)?.spec?.tint) }
        // ---- a close-up of the two (plan 13.1): portraits left and right, what they just said
        closeup?.let { (a, b, born) -> closeupBand(g, t, a, b, app.time - born) }
        // ---- the top (R2): back, one capsule (weather, time, day — tap = 環境面板), observe, the wallet
        Widgets.round(g, app, "back", Dim.GUTTER + 24, top + 34, 24f, "back")
        if (closeup == null) Widgets.round(g, app, "observe", W - Dim.GUTTER - 24, top + 34, 22f, if (observing) "close" else "eye")
        val clock = timeText()
        /* R1 T3: the world's date differs from the phone's → say whose date it is; T1: waiting for the phone to catch up */
        val gameDay = kotlin.math.floor(life.minute / 1440).toLong(); val phoneDay = kotlin.math.floor(app.platform.realMinute() / 1440).toLong()
        val dateNote = if (gameDay != phoneDay) java.time.LocalDate.ofEpochDay(gameDay).let { "・遊戲 ${it.monthValue}/${it.dayOfMonth}" } else ""
        val dayS = if (sim.hold) "等手機時間追上" else if (life.env.paused) "時間暫停中" else "第 ${life.day} 天" + dateNote + if (life.clockMode == "GAME") "・${life.speed.toInt()}×" else ""
        val cx0 = Dim.GUTTER + 56; val cw = W - Dim.GUTTER * 2 - 112
        val cdown = app.pressed == "clock"; val csink = if (cdown) Dim.LIP - 1 else 0f
        Widgets.card(g, t, cx0, top + 12, cw, 46f, 23f, t.surface, t.lip, csink)
        g.fillCircle(cx0 + 26, top + 35 + csink, 17f, Wx.sky(t, wx, light(sim.hour))); Widgets.sky(g, t, Wx.icon(wx), cx0 + 26, top + 35 + csink, 11f)   /* the sky behind the weather, so a cloud shows on the light capsule */
        g.text(clock, cx0 + 48, top + 34 + csink, Dim.FS_M, t.ink, FontKind.NUM)
        g.text(Widgets.fit(g, dayS, 11f, cw - 60), cx0 + 48, top + 50 + csink, 11f, if (life.clockMode == "GAME" || life.env.paused) t.accentLip else t.ink2)
        val nm = listOf(life.homeName).filter { it.isNotBlank() }.joinToString().ifBlank { app.saves.slot(slotId)?.name ?: "" }
        if (cw > 220) g.text(Widgets.fit(g, nm, Dim.FS_S - 1, cw - 160), cx0 + cw - 16, top + 40 + csink, Dim.FS_S - 1, t.ink3, FontKind.UI, Align.RIGHT)
        app.zone("clock", cx0, top + 8, cw, 54f)
        if (!observing) wallet(g, app, this, W - Dim.GUTTER - 104, top + 66)
        var y0 = top + 116
        if (life.arriving) { val s = "搬家日：大家一個一個到了"; val w = g.measure(s, Dim.FS_S) + 32
            g.fillRound((W - w) / 2, y0, w, 32f, 16f, Colors.withAlpha(t.surface, 0.92f)); g.text(s, W / 2, y0 + 21, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER); y0 += 40 }
        // ---- hide-and-seek: every piece of furniture can be searched
        hidingOne()?.let { hid ->
            val s0 = "${sim.person(hid)?.name ?: ""}躲起來了，點家具找找看"; val w0 = g.measure(s0, Dim.FS_S) + 32
            g.fillRound((W - w0) / 2, y0, w0, 32f, 16f, Colors.withAlpha(t.accent, 0.95f)); g.text(s0, W / 2, y0 + 21, Dim.FS_S, t.onAccent, FontKind.UI, Align.CENTER); y0 += 40
            sim.house.pieces.forEachIndexed { i, pc -> val k = Furniture.kind(pc.kind)
                val x1 = sx(view.bx(pc.x.toFloat())); val x2 = sx(view.bx((pc.x + k.w).toFloat())); val y2 = sy(view.by((pc.y + k.h).toFloat())); val y1 = y2 - (k.h * view.T * view.K + view.T * 0.9f) * zoom
                app.zone("hide:$i", x1, y1, x2 - x1, y2 - y1) }
        }
        if (ff != null) { val s0 = "快轉中……"; val w0 = g.measure(s0, Dim.FS_S) + 40
            g.fillRound((W - w0) / 2, y0, w0, 32f, 16f, Colors.withAlpha(t.ink, 0.85f)); Widgets.icon(g, "ff", (W - w0) / 2 + 18, y0 + 16, 12f, t.bg); g.text(s0, W / 2 + 8, y0 + 21, Dim.FS_S, t.bg, FontKind.UI, Align.CENTER); y0 += 40 }
        if (observing) { observeBar(g, t); return }
        if (placing) { Placing.bar(g, app, this, placeSel, placeBag)
            dragBag?.let { k -> g.fillCircle(dragX, dragY - 34, 30f, Colors.withAlpha(t.surface, 0.9f)); ItemArt.draw(g, t, life, k, dragX, dragY - 34, 44f, app) }   /* R3: the piece under your finger */
            return }
        Nav.draw(g, app, "home", Nav.badges(this))
        // ---- the bottom: residents (tap = their card)
        val by = H - Nav.height(app) - 80
        Widgets.card(g, t, Dim.GUTTER, by, W - Dim.GUTTER * 2, 72f, Dim.RADIUS_L)
        life.people.forEachIndexed { i, p ->
            val cx = Dim.GUTTER + 44 + i * 66f; if (cx > W - 110) return@forEachIndexed; val id = "who:${p.id}"; val sink = if (app.pressed == id) 2f else 0f
            if (control && picked == p.id) g.strokeRound(cx - 25, by + 5 + sink, 50f, 50f, 25f, 3f, t.accentLip)
            Widgets.face(g, t, app.charImg(libOf(p), 256), cx, by + 30 + sink, 21f)
            g.text(Widgets.fit(g, p.name, 11f, 60f), cx, by + 64, 11f, t.ink2, FontKind.UI, Align.CENTER)
            Widgets.sky(g, t, sim.moodSky(p), cx + 18, by + 12, 7f)
            if (p.desk) { g.fillRound(cx - 22, by + 32, 44f, 16f, 8f, t.accent); g.text("桌面", cx, by + 44, 11f, t.onAccent, FontKind.UI, Align.CENTER) }
            else if (p.out != null) { g.fillRound(cx - 22, by + 32, 44f, 16f, 8f, t.select); g.text("小鎮", cx, by + 44, 11f, t.ink, FontKind.UI, Align.CENTER) }
            app.zone(id, cx - 32, by, 64f, 76f)
        }
        // ---- R3: watch / direct (the switch at the end of the strip), and the queue of the one you direct
        run { val cx = W - Dim.GUTTER - 40; val sink = if (app.pressed == "ctl") 2f else 0f
            g.fillCircle(cx, by + 30 + Dim.LIP, 21f, if (control) t.accentLip else t.lip); g.fillCircle(cx, by + 30 + sink, 21f, if (control) t.accent else t.surface2)
            Widgets.icon(g, if (control) "move" else "eye", cx, by + 30 + sink, 15f, if (control) t.onAccent else t.ink2)
            g.text(if (control) "操控中" else "觀看", cx, by + 64, 11f, if (control) t.accentLip else t.ink2, FontKind.UI, Align.CENTER)
            app.zone("ctl", cx - 32, by, 64f, 76f) }
        if (control) queueBar(g, t, by - 8)
        if (life.people.size == 1) { val p = life.people[0]; val b = sim.body(p.id)
            g.text(Widgets.fit(g, doing(p, b), Dim.FS_S + 1, W - 200), Dim.GUTTER + 84, by + 32, Dim.FS_S + 1, t.ink)
            g.text(sim.moodLabel(p), Dim.GUTTER + 84, by + 54, Dim.FS_S, t.ink2) }
        // ---- first visit: how to touch (a tip card, plan: tutorials are context cards)
        if (tip && app.overlay == null) {
            val tw = W - Dim.GUTTER * 2; val ty = by - 128
            Widgets.card(g, t, Dim.GUTTER, ty, tw, 112f, Dim.RADIUS_L, t.surface, t.lip)
            g.text("可以直接碰牠們", Dim.GUTTER + 18, ty + 30, Dim.FS_M, t.ink)
            g.text("在角色身上來回滑＝摸摸", Dim.GUTTER + 18, ty + 54, Dim.FS_S, t.ink2)
            g.text("按住不動＝抱起來，甩出去再放開＝丟出去", Dim.GUTTER + 18, ty + 76, Dim.FS_S, t.ink2)
            g.text("點一下＝環狀選單・兩指縮放", Dim.GUTTER + 18, ty + 98, Dim.FS_S, t.ink2)
            Widgets.round(g, app, "tip:close", W - Dim.GUTTER - 26, ty + 26, 16f, "close")
        }
    }
    /** the yard around the house: a stepping-stone path from the door, flowers and round bushes (fixed places, original shapes) */
    private fun garden(g: Gfx, t: Theme) {
        val e = sim.house.entrance; val ex = view.bx(e.x + 0.5f); val y0 = view.height + 10
        val stone = Colors.mix(t.grass, if (t.dark) 0xFF8A8296.toInt() else 0xFFFFF4E4.toInt(), 0.55f)
        for (i in 0 until 6) g.fillRound(ex - 13 + (if (i % 2 == 0) -3f else 3f), y0 + i * 26f, 26f, 14f, 7f, stone)
        val bush = t.grassLip; val bushTop = Colors.mix(t.grass, 0xFF5EA56E.toInt(), 0.55f)
        val spots = floatArrayOf(-30f, 20f, -26f, view.height * 0.6f, view.width + 26, 30f, view.width + 30, view.height * 0.7f, view.width * 0.75f, view.height + 40, view.width * 0.15f, view.height + 56)
        for (i in spots.indices step 2) { val x = spots[i]; val y = spots[i + 1]
            g.fillCircle(x - 9, y + 4, 13f, bush); g.fillCircle(x + 9, y + 4, 12f, bush); g.fillCircle(x, y - 4, 15f, bushTop); g.fillCircle(x - 9, y + 1, 10f, bushTop) }
        val petals = intArrayOf(0xFFF6B2A8.toInt(), 0xFFFFE29A.toInt(), 0xFFFFFFFF.toInt(), 0xFFC9B8E8.toInt())
        for (i in 0 until 14) { val x = ((i * 97) % 23) / 23f * (view.width + 80) - 40; val y = view.height + 30 + ((i * 53) % 17) / 17f * 110
            if (kotlin.math.abs(x - ex) < 26) continue
            val c = petals[i % petals.size]; for (k in 0 until 4) { val a = k * Math.PI.toFloat() / 2 + i; g.fillCircle(x + kotlin.math.cos(a) * 3.2f, y + kotlin.math.sin(a) * 3.2f, 2.8f, c) }; g.fillCircle(x, y, 2f, 0xFFF4A259.toInt()) }
    }
    private fun bubble(g: Gfx, t: Theme, b: Bubble, cx: Float, bottom: Float, tint: String?) {
        val age = app.time - b.born; val k = Ease.outBack(min(1f, age / 0.25f)); val fade = if (age > 2.8f) 1 - (age - 2.8f) / 0.4f else 1f
        val lines = Widgets.wrap(g, b.text, Dim.FS_S + 1, 180f, 2); val w = lines.maxOf { g.measure(it, Dim.FS_S + 1) } + 26; val h = 16f + lines.size * 20f
        val x = (cx - w / 2).coerceIn(8f, app.w - w - 8); val y = bottom - h - 8
        g.save(); g.alpha(fade.coerceIn(0f, 1f)); g.translate(cx, bottom); g.scale(k, k); g.translate(-cx, -bottom)
        g.fillRound(x, y + 2, w, h, 16f, t.shadow); g.fillRound(x, y, w, h, 16f, t.surface)
        tintColor(tint)?.let { g.strokeRound(x + 1, y + 1, w - 2, h - 2, 15f, 2f, it) }   /* their representative colour */
        g.save(); g.translate(cx.coerceIn(x + 16, x + w - 16), y + h - 2); g.rotate((Math.PI / 4).toFloat()); g.fillRect(-5f, -5f, 10f, 10f, t.surface); g.restore()
        lines.forEachIndexed { i, s -> g.text(s, x + w / 2, y + 23 + i * 20f, Dim.FS_S + 1, t.ink, FontKind.UI, Align.CENTER) }
        g.restore()
    }
    private fun tintColor(s: String?): Int? = s?.takeIf { it.matches(Regex("#[0-9A-Fa-f]{6}")) }?.let { Colors.hex(it) }
    private fun worryColor(kind: String): Int = when (kind) { "fight" -> 0xFFE0524A.toInt(); "confess" -> 0xFFF08FA8.toInt(); "hungry" -> 0xFFF4A259.toInt(); "nightmare" -> 0xFF7D74B8.toInt()
        "heart" -> 0xFF7AAAD6.toInt(); "want" -> 0xFF5DB58A.toInt(); "bored" -> 0xFF9A96A0.toInt(); "makeup" -> 0xFFE88AA0.toInt(); else -> 0xFF5EA5C8.toInt() }
    private fun hidingOne(): String? = sim.life.people.firstOrNull { sim.society.hiding(it.id) != null }?.id
    /** the close-up band: two portraits, their last lines, an effect between them */
    private fun closeupBand(g: Gfx, t: Theme, a: String, b: String, age: Float) {
        val pa = sim.person(a) ?: return; val pb = sim.person(b) ?: return
        val k = Ease.outBack(min(1f, age / 0.35f)); val W = app.w; val y = app.insetTop + 66f; val h = 128f
        g.save(); g.alpha(min(1f, age / 0.2f))
        g.fillRect(0f, y - 6, W, h + 12, Colors.withAlpha(t.scrim, 0.35f))
        val r = 40f * k
        val emo = { p: Person -> when (sim.body(p.id).pose) { Pose.ANGRY -> "angry"; Pose.SAD -> "sad"; Pose.SHY -> "shy"; Pose.HAPPY -> "happy"; else -> "idle" } }
        Portrait.draw(g, t, lookOf(pa), Dim.GUTTER + 48, y + 52, r, emo(pa)); Portrait.draw(g, t, lookOf(pb), W - Dim.GUTTER - 48, y + 52, r, emo(pb))
        g.text(Widgets.fit(g, pa.name, Dim.FS_S, 90f), Dim.GUTTER + 48, y + 112, Dim.FS_S, t.bg, FontKind.UI, Align.CENTER)
        g.text(Widgets.fit(g, pb.name, Dim.FS_S, 90f), W - Dim.GUTTER - 48, y + 112, Dim.FS_S, t.bg, FontKind.UI, Align.CENTER)
        val said = listOfNotNull(bubbles[a]?.let { it to true }, bubbles[b]?.let { it to false }).maxByOrNull { it.first.born }
        if (said != null) { val mw = W - Dim.GUTTER * 2 - 200; val ls = Widgets.wrap(g, said.first.text, Dim.FS_S + 1, mw - 20, 3)
            val bx = W / 2 - mw / 2; g.fillRound(bx, y + 20, mw, 20f + ls.size * 22f, 16f, t.surface)
            ls.forEachIndexed { i, l -> g.text(l, W / 2, y + 44 + i * 22f, Dim.FS_S + 1, t.ink, FontKind.UI, Align.CENTER) }
            g.fillCircle(if (said.second) bx + 6 else bx + mw - 6, y + 34, 6f, t.surface) }
        g.restore()
    }
    /** observation mode's bottom: everyone in a strip (tap = follow them), the speed, fast-forward */
    private fun observeBar(g: Gfx, t: Theme) {
        val W = app.w; val H = app.h; val G = Dim.GUTTER; val life = sim.life; val by = H - app.insetBottom - 92
        val game = life.clockMode == "GAME"
        var x = G; val cy = by - 54
        if (game) for (sp in listOf(1, 10, 30, 60)) x += Widgets.chip(g, app, "spd:$sp", x, cy, "$sp×", life.speed.toInt() == sp, 40f) + 6
        else { val s0 = "現實時間不能加速"; g.fillRound(x, cy, g.measure(s0, Dim.FS_S) + 24, 40f, 20f, t.surface2); g.text(s0, x + 12, cy + 25, Dim.FS_S, t.ink2); x += g.measure(s0, Dim.FS_S) + 30 }
        if (game) Widgets.chip(g, app, "ff", W - G - 92, cy, "快轉", ff != null, 40f, 92f)
        Widgets.card(g, t, G, by, W - G * 2, 80f, Dim.RADIUS_L)
        val n = life.people.size; val cw = (W - G * 2 - 12) / maxOf(1, n)
        life.people.forEachIndexed { i, p ->
            val cx = G + 6 + cw * i + cw / 2; val id = "who:${p.id}"
            if (follow == p.id) g.fillRound(cx - cw / 2 + 2, by + 4, cw - 4, 72f, 16f, Colors.mix(t.select, t.surface, 0.5f))
            Widgets.face(g, t, app.charImg(libOf(p), 256), cx, by + 28, 18f); Widgets.sky(g, t, sim.moodSky(p), cx + 16, by + 12, 6f)
            g.text(Widgets.fit(g, doing(p), 11f, cw - 6), cx, by + 64, 11f, t.ink2, FontKind.UI, Align.CENTER)
            app.zone(id, cx - cw / 2, by, cw, 80f)
        }
    }
    /** fast-forward: as fast as the phone can (40 steps a frame at 60×) until something notable is logged, at most 4 game hours */
    private fun fastForward(o: WorldHost.Open) {
        val f = ff ?: return; val life = sim.life
        life.clockMode = "GAME"; life.speed = 60.0
        repeat(40) { app.host.drive(o, 0.1f, "screen") }
        val hit = life.log.drop(f.logSize.coerceAtMost(life.log.size)).firstOrNull { it.weight >= 2 && it.who.isNotEmpty() }
        val news = if (life.log.size < f.logSize) life.log.lastOrNull { it.weight >= 2 } else hit
        if (news != null || life.minute - f.from > 240 || app.overlay != null || life.people.any { it.worry?.shown == true }) {
            ff = null; life.clockMode = f.mode; life.speed = f.speed
            if (news != null) { app.toast(news.text.let { if (it.length > 22) it.take(21) + "…" else it }); follow = news.who } else app.toast("快轉了 ${LifeSim.fmtSpan(life.minute - f.from)}")
            flush()
        }
    }
    fun timeText(): String { val m = ((sim.life.minute % 1440) + 1440) % 1440; return "%02d:%02d".format((m / 60).toInt(), (m % 60).toInt()) }
    /** 「在做什麼」 in a few words */
    fun doing(p: Person, b: LifeSim.Body = sim.body(p.id)): String = when {
        p.desk -> "在手機桌面上"
        p.out != null -> p.out!!.let { o -> when (o.stage) { "go" -> "在去${TownData.place(o.place).zh}的路上"; "back" -> "在回家的路上"; else -> "在小鎮" + (TownData.act(o.act)?.zh ?: "") } }
        b.held -> "被你抱著"; b.flying -> "在空中！"; b.petting -> "被摸摸中"
        p.act != null && b.arrivedAct -> Acts[p.act!!]?.zh ?: "休息"
        p.act != null -> "要去" + (Acts[p.act!!]?.zh ?: "")
        b.path != null -> "走來走去"
        else -> "閒晃中"
    }

    fun fit() {
        val availH = app.h - app.insetTop - app.insetBottom - 290
        fitZoom = min((app.w - 24) / view.width, availH / (view.height + 50)).coerceAtLeast(0.4f)
        zoom = fitZoom; camX = view.width / 2; camY = view.height / 2 - 18
    }
    private fun clampCam() { camX = camX.coerceIn(-40f, view.width + 40); camY = camY.coerceIn(-60f, view.height + 40); zoom = zoom.coerceIn(fitZoom * 0.8f, fitZoom * 2.8f) }

    // ---------------- touch ----------------
    private class Touch(val id: String?, val x0: Float, val y0: Float, val t0: Float) {
        var x = x0; var y = y0; var moved = false; var lifted = false; var petting = false; var rub = 0f; var lastX = x0; var lastY = y0
        var offX = 0f; var offY = 0f; val samples = ArrayList<FloatArray>()
        var camX0 = 0f; var camY0 = 0f
    }
    private var touch: Touch? = null
    private class Pinch(val d0: Float, val z0: Float, val mx: Float, val my: Float, val cx: Float, val cy: Float)
    private var pinch: Pinch? = null; private var p2x = 0f; private var p2y = 0f
    /** test hook: is someone being held right now */
    val holding: String? get() = touch?.takeIf { it.lifted }?.id

    override fun pointer(kind: Int, x: Float, y: Float): Boolean {
        if (world == null) return false
        when (kind) {
            0 -> { if (placing) { touch = Touch(null, x, y, app.time).also { it.camX0 = camX; it.camY0 = camY }; return true }
                val id = hits.lastOrNull { (_, r) -> x >= r[0] - 8 && x <= r[0] + r[2] + 8 && y >= r[1] - 8 && y <= r[1] + r[3] + 8 }?.first
                touch = Touch(id, x, y, app.time).also { it.camX0 = camX; it.camY0 = camY }; return true }
            1 -> { val tc = touch ?: return true; val ddx = x - tc.lastX; val ddy = y - tc.lastY; tc.x = x; tc.y = y
                if (pinch != null) { pinchMove(); tc.lastX = x; tc.lastY = y; return true }
                if (!tc.moved && hypot(x - tc.x0, y - tc.y0) > 9f) { tc.moved = true; if (tc.id != null && !tc.lifted) tc.petting = true }
                when {
                    tc.lifted && tc.id != null -> holdAt(tc)
                    tc.petting -> tc.rub += hypot(ddx, ddy)
                    tc.id == null && tc.moved -> { camX = tc.camX0 - (x - tc.x0) / zoom; camY = tc.camY0 - (y - tc.y0) / zoom; clampCam() }
                }
                tc.lastX = x; tc.lastY = y }
            2, 3 -> { val tc = touch ?: return true; touch = null
                if (pinch != null) { pinch = null; return true }
                if (placing && !tc.moved && kind == 2) { val (tx, ty) = tileAt(x, y); placeAt(tx, ty); return true }
                val id = tc.id
                if (id != null) when {
                    tc.lifted -> { val v = velocity(tc); if (kind == 3) sim.drop(id, 0f, 0f) else sim.drop(id, v.first, v.second); app.platform.haptic("soft") }
                    tc.petting -> sim.petEnd(id)
                    !tc.moved && app.time - tc.t0 < 0.45f && kind == 2 -> tapPerson(id, x, y)
                }
                if (tc.id == null && !tc.moved && kind == 2 && app.time - tc.t0 < 0.45f) tapScene(x, y) }
            10 -> { p2x = x; p2y = y; val tc = touch
                if (tc != null && tc.id != null) { if (tc.lifted) sim.drop(tc.id, 0f, 0f) else if (tc.petting) sim.petEnd(tc.id) }
                val px = tc?.x ?: x; val py = tc?.y ?: y
                touch = Touch(null, px, py, app.time).also { it.moved = true }
                val mx = (px + x) / 2; val my = (py + y) / 2
                pinch = Pinch(max(20f, hypot(x - px, y - py)), zoom, mx, my, camX + (mx - app.w / 2) / zoom, camY + (my - viewCy) / zoom) }
            11 -> { p2x = x; p2y = y; pinchMove() }
            12 -> { pinch = null; touch?.let { touch = Touch(null, it.x, it.y, app.time).also { n -> n.moved = true; n.camX0 = camX; n.camY0 = camY } } }
        }
        return true
    }
    private fun pinchMove() {
        val pn = pinch ?: return; val tc = touch ?: return
        val d = max(20f, hypot(p2x - tc.x, p2y - tc.y)); zoom = (pn.z0 * d / pn.d0).coerceIn(fitZoom * 0.8f, fitZoom * 2.8f)
        val mx = (tc.x + p2x) / 2; val my = (tc.y + p2y) / 2
        camX = pn.cx - (mx - app.w / 2) / zoom; camY = pn.cy - (my - viewCy) / zoom; clampCam()
    }
    private fun touchFrame(dt: Float) {
        val tc = touch ?: return; val id = tc.id ?: return
        if (!tc.moved && !tc.lifted && app.time - tc.t0 > 0.45f) {
            sim.lift(id); tc.lifted = true; app.platform.haptic("heavy")
            val p = sim.person(id)!!; tc.offX = sx(view.bx(p.x)) - tc.x; tc.offY = sy(view.by(p.y)) - tc.y
            if (tip) dismissTip()
        }
        if (tc.petting) { if (tc.rub > 2f) sim.pet(id, dt, partAt(id, tc.x, tc.y)); tc.rub = 0f }
        if (tc.lifted) { holdAt(tc); val p = sim.person(id) ?: return; tc.samples += floatArrayOf(app.time, p.x, p.y); tc.samples.removeAll { app.time - it[0] > 0.12f } }
    }
    /** which part of them the finger is on (plan E-01) */
    private fun partAt(id: String, fx: Float, fy: Float): String {
        val p = sim.person(id) ?: return "身體"; val look = lookOf(p) ?: return "身體"
        val bx = camX + (fx - app.w / 2) / zoom; val by = camY + (fy - viewCy) / zoom
        return Actors.part(look, bx, by, view.bx(p.x), view.by(p.y), view.T * 1.62f, p.facing)
    }
    private fun holdAt(tc: Touch) {
        val id = tc.id ?: return; val b = sim.body(id)
        val fx = tc.x + tc.offX; val fy = tc.y + tc.offY + b.z * view.T * zoom
        val bx = camX + (fx - app.w / 2) / zoom; val by = camY + (fy - viewCy) / zoom
        sim.hold(id, bx / view.T, by / (view.T * view.K))
    }
    private fun velocity(tc: Touch): Pair<Float, Float> {
        val s = tc.samples; if (s.size < 2) return 0f to 0f; val a = s.first(); val b = s.last(); val dt = b[0] - a[0]; if (dt < 0.02f) return 0f to 0f
        return (b[1] - a[1]) / dt to (b[2] - a[2]) / dt
    }
    private fun openCard(id: String) { if (tip) dismissTip(); app.show(PersonCard(this, id)) }
    private fun dismissTip() { tip = false; app.saves.setFlag("tip:touch") }

    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id == "tip:close" -> dismissTip()
            id == "clock" -> app.show(EnvSheet(this))
            Nav.tap(app, this, id) -> {}
            id.startsWith("who:") && observing -> { val pid = id.removePrefix("who:"); if (follow == pid && lockFollow) { lockFollow = false } else { follow = pid; lockFollow = true } }
            id.startsWith("who:") && control -> { val pid = id.removePrefix("who:"); pick(if (picked == pid) null else pid); sim.person(pid)?.let { camX = view.bx(it.x); camY = view.by(it.y) - 20; clampCam() } }
            id.startsWith("who:") -> { val pid = id.removePrefix("who:"); sim.person(pid)?.let { camX = view.bx(it.x); camY = view.by(it.y) - 20; clampCam() }; openCard(pid) }
            id == "ctl" -> setControl(!control)
            id.startsWith("q:") -> picked?.let { pid -> if (sim.society.cancelOrder(pid, id.removePrefix("q:").toInt())) { app.platform.sound("tick"); flush() } }
            id == "observe" -> setObserving(!observing)
            id == "mail" -> app.push(TimelineScreen(this))
            id == "decor" -> app.show(DecorSheet(this))
            id == "town" -> { if (placing) setPlacing(false); app.push(TownScreen(this)) }
            id == "place" -> setPlacing(!placing)
            id == "wallet" -> app.show(BoardSheet(this, false))
            id.startsWith("pl:") -> when (val k = id.removePrefix("pl:")) {
                "done" -> setPlacing(false)
                "undo" -> sim.decorate.undo()?.let { app.toast(it) }
                "flip" -> if (placeSel < 0) app.toast("先點一件家具") else sim.decorate.flip(placeSel)?.let { app.toast(it) }
                "remove" -> if (placeSel < 0) app.toast("先點一件家具") else { val r = sim.decorate.remove(placeSel); if (r != null) app.toast(r) else { app.toast("收進背包了"); placeSel = -1 } }
                else -> { placeBag = if (placeBag == k) null else k; placeSel = -1 }
            }
            id.startsWith("spd:") -> { sim.life.speed = id.removePrefix("spd:").toDouble(); flush() }
            id == "ff" -> ff = if (ff != null) null else FF(sim.life.log.size, sim.life.minute, sim.life.clockMode, sim.life.speed)
            id.startsWith("worry:") -> app.show(WorrySheet(this, id.removePrefix("worry:")))
            id.startsWith("ask:") -> askSheet(id.removePrefix("ask:"))
            id.startsWith("hide:") -> hidingOne()?.let { hid -> val r = sim.society.hideSearch(hid, id.removePrefix("hide:").toInt()) ?: return; bubbles[hid] = Bubble(r.line, app.time); if (!r.over) app.toast(r.line) else flush() }
        }
    }
    // ---------------- R3: the radial menu, directing one resident, the queue ----------------
    /** 操控: tap a resident to direct them, then tap someone, a piece of furniture or the floor; off = 觀看 (tap anything for what you can do) */
    var control = false; private set
    var picked: String? = null; private set
    /** the radial menu showing now (tests) */
    val pie: PieMenu? get() = app.overlay as? PieMenu
    fun setControl(on: Boolean) {
        control = on; if (!on) picked = null else if (picked == null) sim.life.people.singleOrNull { it.out == null && !it.desk }?.let { pick(it.id) }
        app.toast(if (on) "操控：點住民，再點別人或家具" else "觀看：點任何東西看看"); app.platform.haptic("tick")
    }
    fun pick(pid: String?) {
        picked = pid; val p = pid?.let { sim.person(it) } ?: return; app.platform.haptic("tick")
        if (p.control == "observe") { sim.society.setControl(p.id, "suggest"); app.toast("${p.name}改成「建議」模式") }
    }
    private fun tapPerson(id: String, x: Float, y: Float) {
        if (tip) dismissTip()
        val p = sim.person(id) ?: return
        if (control) { val a = picked?.let { sim.person(it) }
            if (a == null) { pick(id); return }
            menuPerson(a, p, x, y); return }
        menuPerson(null, p, x, y)
    }
    /** the piece of furniture drawn under (x, y) on screen, nearest the viewer first */
    private fun pieceAt(x: Float, y: Float): Int = sim.house.pieces.indices.lastOrNull { i -> val pc = sim.house.pieces[i]; val k = Furniture.kind(pc.kind)
        val x1 = sx(view.bx(pc.x.toFloat())); val x2 = sx(view.bx((pc.x + k.w).toFloat())); val y2 = sy(view.by((pc.y + k.h).toFloat())); val y1 = y2 - (k.h * view.T * view.K + view.T * 0.9f) * zoom
        x in x1..x2 && y in y1..y2 } ?: -1
    /** tests: the middle of a piece / a tile on screen */
    fun screenOfPiece(pi: Int): Pair<Float, Float> { val pc = sim.house.pieces[pi]; val k = Furniture.kind(pc.kind); return sx(view.bx(pc.x + k.w / 2f)) to sy(view.by(pc.y + k.h / 2f)) }
    fun screenOfTile(tx: Int, ty: Int): Pair<Float, Float> = sx(view.bx(tx + 0.5f)) to sy(view.by(ty + 0.5f))
    /** a tap on the house that was not a person: a piece, the floor, or the sky / wall */
    fun tapScene(x: Float, y: Float) {
        if (tip) dismissTip()
        val a = if (control) picked?.let { sim.person(it) } else null
        if (control && a == null) { app.toast("先點一位住民"); return }
        val pi = pieceAt(x, y)
        if (pi >= 0) { menuPiece(a, pi, x, y); return }
        val (tx, ty) = tileAt(x, y); val room = sim.house.roomAt(tx, ty)
        if (room != null && ty > room.y && sim.grid.walkable(tx, ty)) menuFloor(a, tx, ty, x, y) else menuSky(x, y)
    }
    private fun item(c: Choice, id: String) = PieItem(id, c.ia.zh, c.ia.icon, c.why)
    private fun grouped(cs: List<Choice>, id: (Choice) -> String) = PieMenu.grouped(cs.map { it.ia.cat to item(it, id(it)) }) { Interactions.CAT_ICON[it] ?: "dots" }
    private fun doId(pid: String, c: Choice) = "do|$pid|${c.what}|${c.target ?: ""}"
    /** who could be asked: everyone at home */
    private fun home() = sim.life.people.filter { it.out == null && !it.desk }
    private fun open(title: String, x: Float, y: Float, items: List<PieItem>) { if (items.isEmpty()) return; app.show(PieMenu(title, x, y, items) { run(it) }) }
    fun menuPerson(actor: app.ocshimeji.sim.life.Person?, target: app.ocshimeji.sim.life.Person, x: Float, y: Float) {
        val cs = Interactions.forPerson(sim, actor, target)
        when {
            actor == null -> open(target.name, x, y, cs.map { item(it, "you|${it.ia.op}|${target.id}") })
            actor === target -> { val (mine, here) = cs.partition { it.ia.by == "you" }
                open(actor.name, x, y, mine.map { item(it, "self|${it.ia.op}") } + PieItem("cat:here", "在這裡做…", "dots", null, grouped(here) { doId(actor.id, it) })) }
            else -> open("${actor.name}→${target.name}", x, y, grouped(cs) { doId(actor.id, it) })
        }
    }
    fun menuPiece(actor: app.ocshimeji.sim.life.Person?, pi: Int, x: Float, y: Float) {
        val piece = sim.house.pieces[pi]; val zh = Furniture.kind(piece.kind).zh; val cs = Interactions.forPiece(sim, actor, pi)
        val sky = if (piece.kind == "window") listOf(PieItem("cat:sky", "天氣與時間", "sun", null, skyItems())) else emptyList()
        if (actor != null) { open("${actor.name}：$zh", x, y, grouped(cs) { doId(actor.id, it) } + sky); return }
        val (mine, acts) = cs.partition { it.ia.by == "you" }
        val ask = acts.map { c -> PieItem("cat:${c.ia.id}", "叫誰來${c.ia.zh}", c.ia.icon, if (home().isEmpty()) "大家都不在家" else null,
            home().map { p -> val w = Interactions.forPiece(sim, p, pi).firstOrNull { it.ia.id == c.ia.id }; PieItem(doId(p.id, c), p.name, "people", w?.why) }) }
        open(zh, x, y, mine.map { item(it, "you|${it.ia.op}|$pi") } + sky + ask)
    }
    fun menuFloor(actor: app.ocshimeji.sim.life.Person?, tx: Int, ty: Int, x: Float, y: Float) {
        val cs = Interactions.forFloor(sim, actor, tx, ty)
        if (actor != null) { open("${actor.name}：這裡", x, y, grouped(cs) { doId(actor.id, it) }); return }
        open("地板", x, y, cs.map { c -> if (c.ia.op == "call") PieItem("cat:call", c.ia.zh, c.ia.icon, if (home().isEmpty()) "大家都不在家" else null,
            home().map { p -> PieItem("do|${p.id}|act:daydream@t$tx,$ty|", p.name, "people", Interactions.forFloor(sim, p, tx, ty).firstOrNull { it.ia.op == "act:daydream" }?.why) }) else item(c, "you|${c.ia.op}|") })
    }
    private fun skyItems() = PieMenu.grouped(Interactions.forSky(sim).map { it.ia.cat to item(it, "sky|${it.ia.op}") }) { when (it) { "天象" -> "star"; "季節" -> "sun"; "時間" -> "clock"; else -> "cloud" } }
    fun menuSky(x: Float, y: Float) = open("天空", x, y, skyItems())
    /** carry out what was picked in a radial menu */
    fun run(id: String) {
        val parts = id.split("|")
        when (parts[0]) {
            "do" -> { val pid = parts[1]; val p = sim.person(pid) ?: return; val what = parts[2]; val target = parts.getOrNull(3)?.ifBlank { null }
                if (p.control == "observe") { sim.society.setControl(pid, "suggest") }
                val ans = sim.society.suggest(pid, if (what.startsWith("act:")) what.removePrefix("act:") else what, target, queue = true)
                if (ans.isNotBlank()) bubbles[pid] = Bubble(ans, app.time)
                if (!sim.society.lastOk && ans.isNotBlank()) app.toast(ans) else if (sim.society.pending(p).size > 1) app.toast("排進${p.name}的行程（第 ${sim.society.pending(p).size} 件）")
                flush() }
            "self" -> { val p = picked?.let { sim.person(it) } ?: return
                when (parts[1]) {
                    "stop" -> if (sim.society.stopNow(p.id)) app.toast("${p.name}停下來了")
                    "out" -> run("do|${p.id}|act:outing|")
                    "card" -> openCard(p.id)
                    "unselect" -> picked = null
                    "clear" -> { while (sim.society.pending(p).isNotEmpty()) sim.society.cancelOrder(p.id, 0); flush() }
                } }
            "sky" -> { val op = parts[1]; val env = sim.env
                val r = when {
                    op.startsWith("w:") -> env.setWeather(op.removePrefix("w:").ifBlank { null })
                    op.startsWith("s:") -> env.setSeason(op.removePrefix("s:").ifBlank { null })
                    op == "pause" -> { env.setPaused(!sim.life.env.paused); null }
                    else -> { app.show(EnvSheet(this)); null } }
                if (r != null) app.toast(r); flush() }
            "you" -> youDo(parts[1], parts.getOrElse(2) { "" })
        }
    }
    private fun youDo(op: String, arg: String) {
        val p = sim.person(arg)
        when (op) {
            "card" -> openCard(arg)
            "pet" -> { sim.pet(arg, 1.2f, "頭"); sim.petEnd(arg); app.toast("也可以直接在${p?.name ?: ""}身上來回滑") }
            "feed" -> app.show(ListSheet("給${p?.name ?: ""}點心", listOf("cookie" to "餅乾", "apple" to "蘋果", "milk" to "牛奶")) { k -> val m = sim.feed(arg, k); if (m.isNotEmpty()) app.toast(m); flush() })
            "talk" -> app.show(TalkSheet(this, arg))
            "rps" -> app.show(RpsSheet(this, arg))
            "hide" -> if (sim.society.hideStart(arg)) app.toast("躲起來了！點家具找找看") else app.toast("現在沒辦法玩")
            "control" -> { if (!control) setControl(true); pick(arg) }
            "worry" -> app.show(WorrySheet(this, arg))
            "ask" -> askSheet(arg)
            "mem" -> app.show(MemorySheet(this, arg))
            "desk" -> p?.let { q -> app.show(DeskSheet(slotId, q.id, q.name) { sim.person(q.id)?.desk == true }) }
            "edit" -> editResident(app, this, arg)
            "follow" -> { setObserving(true); follow = arg; lockFollow = true }
            "rels" -> openWorldRelations(app, this)
            "info" -> arg.toIntOrNull()?.let { pi -> val pc = sim.house.pieces.getOrNull(pi) ?: return
                val users = sim.life.people.filter { it.actPiece == pi && it.act != null }.joinToString("、") { it.name }
                app.toast(Furniture.kind(pc.kind).zh + "・" + (sim.house.rooms.firstOrNull { it.id == pc.room }?.zh ?: "") + if (users.isNotEmpty()) "・${users}在用" else "") }
            "move" -> arg.toIntOrNull()?.let { pi -> setPlacing(true); placeSel = sim.decorate.pieces().indexOfFirst { it.x == sim.house.pieces[pi].x && it.y == sim.house.pieces[pi].y && it.kind == sim.house.pieces[pi].kind }; app.toast("點地板上的新位置") }
            "seek" -> arg.toIntOrNull()?.let { pi -> tap("hide:$pi") }
            "place" -> app.push(StoragePage(this))
            "decor" -> app.show(DecorSheet(this))
        }
    }
    /** the queue of the one you direct: what they do now, then your orders (✕ = cancel) */
    private fun queueBar(g: Gfx, t: Theme, bottom: Float) {
        val W = app.w; val G = Dim.GUTTER; val p = picked?.let { sim.person(it) }
        val pend = p?.let { sim.society.pending(it) }.orEmpty(); val h = if (pend.isEmpty()) 56f else 96f; val y = bottom - h
        Widgets.card(g, t, G, y, W - G * 2, h, 20f, Colors.withAlpha(t.surface, 0.96f))
        if (p == null) { g.text("點一位住民，就能排他的行程", G + 16, y + 34, Dim.FS_S, t.ink2); return }
        val head = p.name + "・" + doing(p); g.text(Widgets.fit(g, head, Dim.FS_S, W - G * 2 - 80), G + 16, y + 24, Dim.FS_S, t.ink)
        g.text("${pend.size}/${sim.society.QUEUE_MAX}", W - G - 16, y + 24, Dim.FS_S - 1, t.ink3, FontKind.NUM, Align.RIGHT)
        if (pend.isEmpty()) { g.text("還沒有排程：點別人、家具或地板", G + 16, y + 46, Dim.FS_S - 1, t.ink3); return }
        val n = sim.society.QUEUE_MAX; val gap = 6f; val cw = (W - G * 2 - 24 - gap * (n - 1)) / n
        pend.forEachIndexed { i, o -> val x = G + 12 + i * (cw + gap); val cy = y + 38
            val down = app.pressed == "q:$i"
            g.fillRound(x, cy, cw, 46f, 14f, if (i == 0) Colors.mix(t.accent, t.surface, 0.55f) else t.surface2)
            g.text("${i + 1}", x + 8, cy + 16, 11f, t.ink3, FontKind.NUM)
            Widgets.icon(g, "close", x + cw - 11, cy + 11, 7f, if (down) t.ink else t.ink3)
            g.text(Widgets.fit(g, sim.society.orderLabel(o).substringBefore("（").substringBefore("・"), Dim.FS_S - 2, cw - 10), x + cw / 2, cy + 37, Dim.FS_S - 2, t.ink, FontKind.UI, Align.CENTER)
            app.zone("q:$i", x, cy - 4, cw, 54f) }
    }
    /** observation on: controls fold away; off: back to normal, and the 30× / 60× speeds end with it (plan 12.11) */
    fun setObserving(on: Boolean) {
        observing = on; lockFollow = false; follow = if (on) sim.life.people.firstOrNull { !it.desk }?.id else null
        if (!on) { ff = null; if (sim.life.clockMode == "GAME" && sim.life.speed > 10) { sim.life.speed = 10.0; app.toast("離開觀察模式：速度回到 10×") } }
        flush()
    }
    /** a request tapped (plan E-06) */
    private fun askSheet(pid: String) {
        val p = sim.person(pid) ?: return; val a = p.ask ?: return
        app.show(ListSheet("${p.name}的請求", listOf("yes" to "好啊", "later" to "下次吧"), subtitle = "「${a.text}」") { pick ->
            if (pick != "yes") { p.ask = null; return@ListSheet }
            when (a.kind) {
                "snack" -> { val m = sim.feed(pid, a.thing); if (m.isNotEmpty()) app.toast(m) }
                "pet" -> app.toast("在${p.name}身上來回滑，就能摸摸牠")
                "rps" -> app.show(RpsSheet(this, pid))
                "furniture" -> { val k = "f:" + a.thing; val zh = Furniture.kind(a.thing).zh
                    if (sim.economy.count(k) > 0) { setPlacing(true, k); app.toast("把${zh}放進${p.name}的房間吧") } else { p.ask = a; app.toast("背包裡還沒有${zh}：小鎮的家具店有時會賣") } }
                "hide" -> if (sim.society.hideStart(pid)) app.toast("${p.name}躲起來了！") else app.toast("${p.name}現在沒辦法玩")
            }
            flush()
        })
    }
    private fun timeSheet() {
        val life = sim.life; val cur = if (life.clockMode == "REAL") "real" else "g${life.speed.toInt()}"
        fun row(id: String, s: String) = id to (s + if (id == cur) "（目前）" else "")
        app.show(ListSheet("時間", listOf(row("real", "現實時間（跟著手機）"), row("g1", "遊戲時間 1×"), row("g10", "遊戲時間 10×")),
            subtitle = "30×、60× 和快轉在觀察模式裡；離開時照常 1× 經過") { pick ->
            when (pick) {
                "real" -> { life.clockMode = "REAL"; life.speed = 1.0; val behind = app.platform.realMinute() - life.minute
                    if (behind >= 1) { sim.catchUp(app.platform.realMinute(), summarize = false); app.toast("時鐘追上了現在") }
                    else if (behind < -1) app.toast("世界比手機快了 ${LifeSim.fmtSpan(-behind)}：時間先停著，等手機追上") else app.toast("回到現實時間") }
                else -> { life.clockMode = "GAME"; life.speed = pick.removePrefix("g").toDouble(); app.toast("遊戲時間 ${life.speed.toInt()}×") }
            }
            flush()
        })
    }
    override fun back(): Boolean { if (placing) { setPlacing(false); return true }; if (observing) { setObserving(false); return true }; if (control) { setControl(false); return true }; return false }
    /** a break after an hour (plan O-05): someone at home says so (screen-side words; the life is not touched) */
    private var played = 0f
    private fun restReminder(g: Gfx, t: Theme, dt: Float) {
        played += dt; if (played < 3600f) return; played = 0f
        val p = sim.life.people.firstOrNull { it.out == null && !it.desk && !sim.asleep(it) } ?: return
        bubbles[p.id] = Bubble(SpeechSay.say(p.spec, "已經陪我一個小時了，起來動一動、喝杯水吧。", RestRng(7L), p.affinity, true), app.time); app.toast("已經玩了一個小時，休息一下吧")
    }
    /** decorating: the floor grid, the picked piece, what is fixed */
    private fun placingMarks(g: Gfx, t: Theme) {
        val h = sim.house; val T = view.T; val K = view.K
        for (r in h.rooms) for (y in r.y + 1 until r.y + r.h) for (x in r.x until r.x + r.w) g.strokeRound(x * T + 1, y * T * K + 1, T - 2, T * K - 2, 3f, 1f, Colors.withAlpha(t.ink, 0.2f))
        val pcs = sim.decorate.pieces()
        pcs.getOrNull(placeSel)?.let { pc -> val k = Furniture.kind(pc.kind); g.fillRound(pc.x * T, pc.y * T * K, k.w * T, k.h * T * K, 6f, Colors.withAlpha(t.select, 0.45f)); g.strokeRound(pc.x * T, pc.y * T * K, k.w * T, k.h * T * K, 6f, 2.5f, t.accentLip) }
    }
}

/** 「你不在的時候」 (plan J-05): what everyone did while the app was closed */
class AwaySheet(val s: AwaySummary, val home: String) : Overlay() {
    private val pop = Spring(0f, 1f, 260f, 22f)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val k = pop.step(dt)
        g.fillRect(0f, 0f, app.w, app.h, Colors.withAlpha(t.scrim, k.coerceIn(0f, 1f)))
        val w = min(app.w - 32, 360f); val x = (app.w - w) / 2
        val lines = s.lines.flatMap { Widgets.wrap(g, it, Dim.FS_S + 1, w - 40, 3) }.take(12)
        val h = 132f + lines.size * 24f + 70; val y = (app.h - h) / 2
        g.save(); g.translate(app.w / 2, app.h / 2); val sc = 0.86f + 0.14f * k; g.scale(sc, sc); g.translate(-app.w / 2, -app.h / 2)
        Widgets.card(g, t, x, y, w, h)
        app.zone("away:body", x, y, w, h)
        g.text("你不在的時候", x + 20, y + 40, Dim.FS_L, t.ink)
        g.text("${if (home.isBlank()) "家裡" else home}過了 ${LifeSim.fmtSpan(s.toMinute - s.fromMinute)}", x + 20, y + 66, Dim.FS_S, t.ink2)
        lines.forEachIndexed { i, l -> g.text(l, x + 20, y + 104 + i * 24f, Dim.FS_S + 1, t.ink) }
        Widgets.button(g, app, "away:ok", x + 20, y + h - 70, w - 40, 52f, "好", Kind.PRIMARY)
        g.restore()
    }
    override fun tap(id: String) { if (id == "away:ok") app.closeOverlay() }
}

/** wallpaper, floor and music for this home (plan 12.6: what the player made, used at home; furniture is placed in decorating mode) */
class DecorSheet(val ws: WorldScreen) : Overlay() {
    private val slide = Spring(0f, 1f)
    private var room = ws.sim.house.rooms.first().id
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = slide.step(dt); val G = Dim.GUTTER; val W = app.w; val st = Studio(app.saves); val life = ws.sim.life
        g.fillRect(0f, 0f, W, app.h, Colors.withAlpha(t.scrim, (s * 0.4f).coerceIn(0f, 1f)))
        val h = 470f + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); app.zone("dc:body", 0f, y, W, h)
        g.text("佈置：壁紙、地板、音樂", G + 4, y + 40, Dim.FS_L, t.ink); g.text("擺家具：左邊的「移動」按鈕", G + 4, y + 62, Dim.FS_S, t.ink2)
        var x = G; var yy = y + 78
        for (r in ws.sim.house.rooms) { val w0 = g.measure(r.zh, Dim.FS_S + 1) + 28; if (x + w0 > W - G) { x = G; yy += 46 }; x += Widgets.chip(g, app, "room:${r.id}", x, yy, r.zh, room == r.id, 38f) + 6 }
        yy += 52
        val d = life.decor[room]
        for ((kind, zh) in listOf("wallpaper" to "牆", "floor" to "地板")) {
            g.text(zh, G + 4, yy + 26, Dim.FS_S + 1, t.ink2); x = G + 44
            val cur = if (kind == "wallpaper") d?.wall else d?.floor
            x += Widgets.chip(g, app, "$kind:", x, yy, "原本的", cur.isNullOrBlank(), 38f) + 6
            for (it0 in st.items().filter { it.kind == kind }) { val p = it0.image.removePrefix("lib:"); val w0 = g.measure(it0.name, Dim.FS_S + 1) + 28; if (x + w0 > W - G) { x = G + 44; yy += 46 }; x += Widgets.chip(g, app, "$kind:$p", x, yy, it0.name, cur == p, 38f) + 6 }
            yy += 52
        }
        if (st.items().none { it.kind == "wallpaper" || it.kind == "floor" }) { g.text("還沒有壁紙或地板：可以在「創作 → 繪圖工坊」畫一張", G + 4, yy + 14, Dim.FS_S, t.ink3); yy += 30 }
        g.text("家裡的音樂", G + 4, yy + 26, Dim.FS_S + 1, t.ink2); x = G + 96
        x += Widgets.chip(g, app, "music:", x, yy, "沒有", life.music.isBlank(), 38f) + 6
        for (m in st.sounds().filter { it.kind == "music" }) { val w0 = g.measure(m.name, Dim.FS_S + 1) + 28; if (x + w0 > W - G) { x = G + 96; yy += 46 }; x += Widgets.chip(g, app, "music:${m.path.removePrefix("lib:")}", x, yy, m.name, life.music == m.path.removePrefix("lib:"), 38f) + 6 }
    }
    override fun tap(id: String) {
        val life = ws.sim.life
        when {
            id.startsWith("room:") -> room = id.removePrefix("room:")
            id.startsWith("wallpaper:") || id.startsWith("floor:") -> { val p = id.substringAfter(":"); val d = life.decor[room] ?: Decor()
                val nd = if (id.startsWith("wallpaper:")) Decor(p, d.floor) else Decor(d.wall, p)
                if (nd.wall.isBlank() && nd.floor.isBlank()) life.decor.remove(room) else life.decor[room] = nd; ws.decor(); ws.flush() }
            id.startsWith("music:") -> { life.music = id.removePrefix("music:"); if (life.music.isBlank()) { app.platform.stopMusic(); ws.resetMusic() } else app.platform.clip(life.music, music = true); ws.flush() }
        }
    }
}
