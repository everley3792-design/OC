package app.ocshimeji.ui

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
    fun lookOf(p: Person): Look? { val c = libOf(p) ?: return null; val l = looks[p.id]; if (l != null && l.spec === p.spec) return l; return Look(app, c, p.spec).also { looks[p.id] = it } }
    /** after editing someone: forget the cached pictures and settings */
    fun refresh() { chars.clear(); looks.clear() }

    // camera: the house point at the middle of the view (base dp) and the zoom
    var camX = 0f; var camY = 0f; var zoom = 1f; private var fitZoom = 1f
    private val viewCy get() = app.insetTop + (app.h - app.insetTop - app.insetBottom - 96) * 0.47f

    override val animating get() = true
    override val fps get() = if (world == null) 30 else if (touch != null || pinch != null || sim.life.people.any { sim.body(it.id).flying || sim.body(it.id).held }) 60 else 30
    override fun enter() {
        val o = try { app.host.acquire(slotId) } catch (e: IllegalArgumentException) { failed = e.message; null } ?: return
        open = o; sim = o.sim; view = HouseView(sim.house); o.listeners += listener; o.screenActive = true
        if (!app.platform.deskRunning(slotId) && o.users == 1) for (p in sim.onDesk) sim.fromDesk(p.id)   /* the system stopped the desktop: they come home */
        catchUp()?.let { app.show(AwaySheet(it, sim.life.homeName.ifBlank { app.saves.slot(slotId)?.name ?: "" })) }
        if (!app.saves.flag("tip:touch")) tip = true
    }
    override fun leave() { val o = open ?: return; o.listeners -= listener; o.screenActive = false; app.host.release(slotId); open = null }
    override fun pause() { open?.let { it.screenActive = false; app.host.save(it) } }
    /** back from the background: the time that passed is caught up like an absence (the desktop may have kept it going) */
    override fun wake() { val o = open ?: return; o.screenActive = true; catchUp()?.let { app.show(AwaySheet(it, sim.life.homeName)) } }

    /** how far the world is behind: real time since it was last watched (away time runs at 1×); ≥ 60 game minutes = a summary */
    private fun catchUp(): AwaySummary? = open?.let { app.host.catchUp(it) }
    fun flush() { open?.let { app.host.save(it) } }

    // ---------------- frame ----------------
    private class Bubble(val text: String, val born: Float)
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

    private fun light(h: Double): Float = when { h < 5 -> 0f; h < 7 -> ((h - 5) / 2).toFloat(); h < 17 -> 1f; h < 19.5 -> (1 - (h - 17) / 2.5).toFloat(); else -> 0f }

    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val top = app.insetTop
        if (world == null) { g.fillRect(0f, 0f, W, H, t.bg); Widgets.card(g, t, Dim.GUTTER, H / 2 - 70, W - Dim.GUTTER * 2, 140f)
            g.text("這個存檔打不開", W / 2, H / 2 - 24, Dim.FS_L, t.ink, FontKind.UI, Align.CENTER); g.text(Widgets.fit(g, failed ?: "", Dim.FS_S, W - 64), W / 2, H / 2 + 6, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER)
            Widgets.button(g, app, "back", W / 2 - 80, H / 2 + 24, 160f, 48f, "回到選單"); return }
        if (fitZoom == 1f && zoom == 1f) fit()
        touchFrame(dt)
        open?.let { app.host.drive(it, dt, "screen") }
        val evs = ArrayList(incoming); incoming.clear()
        for (e in evs) if (sim.person(e.who)?.desk != true) when (e.kind) {
            "say" -> { bubbles[e.who] = Bubble(e.text, app.time); sim.person(e.who)?.let { app.platform.voice(it.spec.voice, e.text) } }
            "heart" -> hearts += Heart(e.who, app.time, ((app.time * 977) % 1f) - 0.5f)
            "sound" -> app.platform.sound(e.text)
        }
        val life = sim.life; val lt = light(sim.hour)

        // ---- outside: sky to grass
        g.fillRect(0f, 0f, W, H, t.grass)
        val skyC = Colors.mix(t.skyTop, if (t.dark) 0xFF141A33.toInt() else 0xFF2E3A66.toInt(), (1 - lt) * 0.7f)
        g.fillGradientV(0f, 0f, W, sy(-30f), skyC, t.grass)
        // ---- the house, everyone in it
        g.save(); g.translate(app.w / 2 - camX * zoom, viewCy - camY * zoom); g.scale(zoom, zoom)
        garden(g, t)
        hits.clear()
        val ds = ArrayList<HouseView.D>(); val CH = view.T * 1.62f
        val used = HashSet<Int>()
        life.people.forEachIndexed { i, p ->
            if (p.desk) return@forEachIndexed   /* out on the phone's desktop: not at home */
            val b = sim.body(p.id); val look = lookOf(p) ?: return@forEachIndexed
            val onPiece = if (b.arrivedAct && p.act != null) p.actPiece else -1; if (onPiece >= 0) used += onPiece
            val kind = sim.house.pieces.getOrNull(onPiece)?.kind
            val x = view.bx(p.x); val y = view.by(p.y)
            val lift = b.z * view.T + (if (b.pose == Pose.SIT || b.pose == Pose.WATCH || b.pose == Pose.EAT) HouseView.seat(kind) else 0f)
            val key = if (kind != null) sim.house.pieces[onPiece].y + Furniture.kind(kind).h + 0.01f else p.y
            val asleep = sim.asleep(p); val phase = i * 1.37f
            ds += HouseView.D(if (b.held || b.flying) 99f + i else key) {
                if (!b.held && kind != "bed" && kind != "bed2" && kind != "tub") Widgets.footShadow(g, t, x, y, CH * 0.5f * (1f - min(0.5f, b.z * 0.2f)))
                Actors.draw(g, look, x, y, CH, b.pose, app.time, phase, p.facing, lift, kind, asleep, sim.moodSky(p))
                Actors.extras(g, t, look, b.pose, x, y - lift, CH, app.time, phase, p.facing, asleep, sim.propOf(p))
            }
            val ch = CH * look.scale
            val top0 = y - lift - ch * (if (b.pose == Pose.LIE) 0.75f else 1f)
            hits += p.id to floatArrayOf(sx(x - ch * 0.36f), sy(top0), ch * 0.72f * zoom, (y - top0 + 6) * zoom)
        }
        view.draw(g, t, app.time, lt, ds) { it in used }
        g.restore()
        hits.sortBy { h -> life.people.firstOrNull { it.id == h.first }?.let { if (sim.body(it.id).held) 99f else it.y } ?: 0f }
        // ---- night: the whole scene a little blue
        if (lt < 1f) g.fillRect(0f, 0f, W, H, Colors.withAlpha(0xFF1E2550.toInt(), (1 - lt) * 0.22f))
        // ---- over the scene: mood skies, hearts, speech
        for ((id, r) in hits) {
            val p = sim.person(id) ?: continue; val cx = r[0] + r[2] / 2; val hy = r[1]
            Widgets.sky(g, t, sim.moodSky(p), cx + r[2] * 0.42f, hy + 4, 9f * min(1.3f, zoom))
        }
        hearts.removeAll { app.time - it.born > 1.4f }
        for (h in hearts) { val r = hits.firstOrNull { it.first == h.who }?.second ?: continue; val k = (app.time - h.born) / 1.4f
            g.save(); g.alpha(1 - k); Widgets.heart(g, r[0] + r[2] / 2 + h.dx * 40, r[1] - k * 40, 6f + k * 3, 0xFFF0705A.toInt()); g.restore() }
        bubbles.entries.removeAll { app.time - it.value.born > 3.2f }
        for ((id, b) in bubbles) { val r = hits.firstOrNull { it.first == id }?.second ?: continue; bubble(g, t, b, r[0] + r[2] / 2, r[1] - 10, sim.person(id)?.spec?.tint) }
        // ---- the bar on top: back, the home's name, the clock
        Widgets.round(g, app, "back", Dim.GUTTER + 24, top + 34, 24f, "back")
        val clock = timeText(); val dayS = "第 ${life.day} 天" + if (life.clockMode == "GAME") "・${life.speed.toInt()}×" else ""
        val cw = maxOf(g.measure(clock, Dim.FS_M, FontKind.NUM), g.measure(dayS, 11f)) + 50
        val cdown = app.pressed == "clock"; val csink = if (cdown) Dim.LIP - 1 else 0f
        Widgets.card(g, t, W - Dim.GUTTER - cw, top + 12, cw, 44f, 22f, t.surface, t.lip, csink)
        Widgets.icon(g, "clock", W - Dim.GUTTER - cw + 22, top + 34 + csink, 14f, if (life.clockMode == "GAME") t.accentLip else t.ink2)
        g.text(clock, W - Dim.GUTTER - cw + 36, top + 33 + csink, Dim.FS_M, t.ink, FontKind.NUM)
        g.text(dayS, W - Dim.GUTTER - cw + 36, top + 49 + csink, 11f, if (life.clockMode == "GAME") t.accentLip else t.ink2)
        app.zone("clock", W - Dim.GUTTER - cw, top + 8, cw, 52f)
        val name = listOf(life.townName, life.homeName).filter { it.isNotBlank() }.joinToString("・").ifBlank { app.saves.slot(slotId)?.name ?: "" }
        val nx = Dim.GUTTER + 58; val nw = W - Dim.GUTTER - cw - 8 - nx
        if (nw > 60) { Widgets.card(g, t, nx, top + 12, nw, 44f, 22f); g.text(Widgets.fit(g, name, Dim.FS_S + 1, nw - 24), nx + nw / 2, top + 39, Dim.FS_S + 1, t.ink, FontKind.UI, Align.CENTER) }
        var y0 = top + 70
        if (life.arriving) { val s = "搬家日：大家一個一個到了"; val w = g.measure(s, Dim.FS_S) + 32
            g.fillRound((W - w) / 2, y0, w, 32f, 16f, Colors.withAlpha(t.surface, 0.92f)); g.text(s, W / 2, y0 + 21, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER); y0 += 40 }
        // ---- the bottom: residents (tap = their card)
        val by = H - app.insetBottom - 84
        Widgets.card(g, t, Dim.GUTTER, by, W - Dim.GUTTER * 2, 72f, Dim.RADIUS_L)
        life.people.forEachIndexed { i, p ->
            val cx = Dim.GUTTER + 44 + i * 66f; if (cx > W - 40) return@forEachIndexed; val id = "who:${p.id}"; val sink = if (app.pressed == id) 2f else 0f
            Widgets.face(g, t, app.charImg(libOf(p), 256), cx, by + 30 + sink, 21f)
            g.text(Widgets.fit(g, p.name, 11f, 60f), cx, by + 64, 11f, t.ink2, FontKind.UI, Align.CENTER)
            Widgets.sky(g, t, sim.moodSky(p), cx + 18, by + 12, 7f)
            if (p.desk) { g.fillRound(cx - 22, by + 32, 44f, 16f, 8f, t.accent); g.text("桌面", cx, by + 44, 11f, t.onAccent, FontKind.UI, Align.CENTER) }
            app.zone(id, cx - 32, by, 64f, 76f)
        }
        if (life.people.size == 1) { val p = life.people[0]; val b = sim.body(p.id)
            g.text(Widgets.fit(g, doing(p, b), Dim.FS_S + 1, W - 150), Dim.GUTTER + 84, by + 32, Dim.FS_S + 1, t.ink)
            g.text(sim.moodLabel(p), Dim.GUTTER + 84, by + 54, Dim.FS_S, t.ink2) }
        // ---- first visit: how to touch (a tip card, plan: tutorials are context cards)
        if (tip && app.overlay == null) {
            val tw = W - Dim.GUTTER * 2; val ty = by - 128
            Widgets.card(g, t, Dim.GUTTER, ty, tw, 112f, Dim.RADIUS_L, t.surface, t.lip)
            g.text("可以直接碰牠們", Dim.GUTTER + 18, ty + 30, Dim.FS_M, t.ink)
            g.text("在角色身上來回滑＝摸摸", Dim.GUTTER + 18, ty + 54, Dim.FS_S, t.ink2)
            g.text("按住不動＝抱起來，甩出去再放開＝丟出去", Dim.GUTTER + 18, ty + 76, Dim.FS_S, t.ink2)
            g.text("點一下＝人物卡・兩指縮放", Dim.GUTTER + 18, ty + 98, Dim.FS_S, t.ink2)
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
    fun timeText(): String { val m = ((sim.life.minute % 1440) + 1440) % 1440; return "%02d:%02d".format((m / 60).toInt(), (m % 60).toInt()) }
    /** 「在做什麼」 in a few words */
    fun doing(p: Person, b: LifeSim.Body = sim.body(p.id)): String = when {
        p.desk -> "在手機桌面上"; b.held -> "被你抱著"; b.flying -> "在空中！"; b.petting -> "被摸摸中"
        p.act != null && b.arrivedAct -> Acts[p.act!!]?.zh ?: "休息"
        p.act != null -> "要去" + (Acts[p.act!!]?.zh ?: "")
        b.path != null -> "走來走去"
        else -> "閒晃中"
    }

    fun fit() {
        val availH = app.h - app.insetTop - app.insetBottom - 220
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
            0 -> { val id = hits.lastOrNull { (_, r) -> x >= r[0] - 8 && x <= r[0] + r[2] + 8 && y >= r[1] - 8 && y <= r[1] + r[3] + 8 }?.first
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
                val id = tc.id ?: return true
                when {
                    tc.lifted -> { val v = velocity(tc); if (kind == 3) sim.drop(id, 0f, 0f) else sim.drop(id, v.first, v.second); app.platform.haptic("soft") }
                    tc.petting -> sim.petEnd(id)
                    !tc.moved && app.time - tc.t0 < 0.45f && kind == 2 -> openCard(id)
                } }
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
            id == "clock" -> timeSheet()
            id.startsWith("who:") -> { val pid = id.removePrefix("who:"); sim.person(pid)?.let { camX = view.bx(it.x); camY = view.by(it.y) - 20; clampCam() }; openCard(pid) }
        }
    }
    private fun timeSheet() {
        val life = sim.life; val cur = if (life.clockMode == "REAL") "real" else "g${life.speed.toInt()}"
        fun row(id: String, s: String) = id to (s + if (id == cur) "（目前）" else "")
        app.show(ListSheet("時間", listOf(row("real", "現實時間（跟著手機）"), row("g1", "遊戲時間 1×"), row("g10", "遊戲時間 10×"), row("g60", "遊戲時間 60×（最快）")),
            subtitle = "遊戲時間只在你看著的時候加速；離開時照常 1× 經過") { pick ->
            when (pick) {
                "real" -> { life.clockMode = "REAL"; life.speed = 1.0; val behind = app.platform.realMinute() - life.minute
                    if (behind >= 1) { sim.catchUp(app.platform.realMinute(), summarize = false); app.toast("時鐘追上了現在") } else app.toast("回到現實時間") }
                else -> { life.clockMode = "GAME"; life.speed = pick.removePrefix("g").toDouble(); app.toast("遊戲時間 ${life.speed.toInt()}×") }
            }
            flush()
        })
    }
    override fun back(): Boolean = false
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
