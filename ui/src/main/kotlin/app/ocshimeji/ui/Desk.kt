package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.desk.DeskContext
import app.ocshimeji.sim.desk.DeskGestures
import app.ocshimeji.sim.desk.DeskPet
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
    } } }
    init { open.listeners += listener }

    /** bring a resident out; null = done, otherwise why not */
    fun add(id: String): String? {
        if (id in pets) return null
        if (pets.size >= MAX) return "桌面上最多 $MAX 位"
        val p = sim.person(id) ?: return "這個世界沒有這位"
        val c = app.saves.libChar(p.libId); val look = c?.let { Look(app, it, p.spec) }
        val img = look?.base; val aspect = if (img != null) img.w.toFloat() / img.h else 0.8f
        val dp = DeskPet(id, BASE * (look?.scale ?: 1f), aspect, Rng.hash("desk:$slotId:$id:${app.platform.now()}"))
        dp.place(screen, screen.w * (0.3f + 0.4f * ((pets.size * 37 % 10) / 10f)))
        sim.toDesk(id); pets[id] = Pet(id, dp, DeskGestures(), look); return null
    }
    /** back home (also when the service stops) */
    fun remove(id: String) { pets.remove(id) ?: return; sim.fromDesk(id); app.host.save(open) }
    fun close() { for (id in pets.keys.toList()) remove(id); open.listeners -= listener; app.host.release(slotId) }

    /** reminder interval in minutes (0 = off) and whether to hide during full-screen apps — player settings (plan 13.6, F-14) */
    val remindEvery: Int get() = app.saves.pref("desk:remind")?.toIntOrNull() ?: 0
    val hideFullscreen: Boolean get() = app.saves.pref("desk:fullscreen") != "off"

    fun frame(dt: Float, phone: Phone) {
        time += dt
        app.host.drive(open, dt, "desk")
        val due = remindEvery > 0 && time - lastRemind > remindEvery * 60f
        val live = liveLine()
        for (pt in pets.values.toList()) {
            val p = sim.person(pt.id) ?: continue; val dp = pt.pet
            pt.gest.tick(time); gestures(pt)
            val ctx = DeskContext(hour = sim.hour, charging = phone.charging, battery = phone.battery, fullscreen = phone.fullscreen && hideFullscreen,
                food = p.need(Need.FOOD), energy = p.need(Need.ENERGY), attention = p.need(Need.ATTENTION), active = p.spec.axis(Axis.ACTIVE),
                reminderDue = due && pt == pets.values.first(), live = live)
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

    /** a finger on a pet's window, in screen dp: kind 0 down, 1 move, 2 up, 3 cancel */
    fun touch(id: String, kind: Int, x: Float, y: Float) {
        val pt = pets[id] ?: return; lastY = y
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
    fun windowOf(id: String): FloatArray? = pets[id]?.pet?.bounds(10f)
    /** draw a pet into its window (the canvas origin is the window's top-left) */
    fun drawPet(g: Gfx, id: String) {
        val pt = pets[id] ?: return; val d = pt.pet; val b = d.bounds(10f); val p = sim.person(id) ?: return; val look = pt.look ?: return
        if (d.hidden) return
        g.save(); g.translate(d.x - b[0], d.y - b[1]); g.rotate(Math.toRadians(d.rotation.toDouble()).toFloat())
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
        val lines = Widgets.wrap(g, text, Dim.FS_S + 1, 200f, 3); val w = lines.maxOf { g.measure(it, Dim.FS_S + 1) } + 28; val h = 18f + lines.size * 20f + 8
        val x = (b[0] + b[2] / 2 - w / 2).coerceIn(4f, screen.w - w - 4); var y = b[1] - h - 4; if (y < screen.top) y = b[1] + b[3] + 4
        return floatArrayOf(x, y, w, h)
    }
    fun drawBubble(g: Gfx, id: String) {
        val text = bubbleOf(id) ?: return; val t = app.theme; val lines = Widgets.wrap(g, text, Dim.FS_S + 1, 200f, 3)
        val w = g.width; val h = g.height - 8
        g.fillRound(0f, 3f, w, h, 16f, t.shadow); g.fillRound(0f, 0f, w, h, 16f, if (isLive(id)) t.surface2 else t.surface)
        sim.person(id)?.spec?.tint?.takeIf { it.matches(Regex("#[0-9A-Fa-f]{6}")) }?.let { g.strokeRound(1f, 1f, w - 2, h - 2, 15f, 2f, Colors.hex(it)) }
        lines.forEachIndexed { i, l -> g.text(l, w / 2, 24f + i * 20f, Dim.FS_S + 1, t.ink, FontKind.UI, Align.CENTER) }
    }
    companion object { const val MAX = 3; const val BASE = 110f; private val REMIND_KEYS = setOf("reminder") }
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
        Widgets.button(g, app, "m:home", 16f, 128f, W - 32, 44f, "回家", size = Dim.FS_S + 1)
        Widgets.button(g, app, "m:app", 16f, 180f, W - 32, 44f, "打開 App", size = Dim.FS_S + 1)
        Widgets.button(g, app, "m:through", 16f, 232f, W - 32, 44f, "讓手指穿過（從通知恢復）", Kind.GHOST, Dim.FS_S)
    }
    override fun tap(id: String) {
        when {
            id.startsWith("m:feed:") -> { val msg = stage.sim.feed(this.id, id.removePrefix("m:feed:")); if (msg.isNotEmpty()) stage.sim.deskSay(this.id, "tapDesk"); action("close") }
            id == "m:home" -> { stage.remove(this.id); action("home") }
            id == "m:app" -> action("app"); id == "m:through" -> action("through"); id == "m:close" -> action("close")
        }
    }
    companion object { const val W = 260f; const val H = 292f }
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
        val h = 470f + app.insetBottom; val y = app.h - h * s
        g.fillRound(0f, y, W, h + 40, Dim.RADIUS_L, t.surface); g.fillRound(W / 2 - 20, y + 10, 40f, 5f, 3f, t.line); app.zone("sheet:body", 0f, y, W, h)
        val out = onDesk()
        g.text("手機桌面", G + 4, y + 44, Dim.FS_L, t.ink); g.text(if (out) "$name 在桌面上" else "讓 $name 跑到手機桌面上陪你", G + 4, y + 68, Dim.FS_S, t.ink2)
        val f = Form(app, g, G, W - G * 2, y + 80)
        val every = app.saves.pref("desk:remind")?.toIntOrNull() ?: 0
        f.chips("remind", listOf("不提醒", "每 30 分", "每 60 分", "每 90 分"), setOf(when (every) { 30 -> "每 30 分"; 60 -> "每 60 分"; 90 -> "每 90 分"; else -> "不提醒" }), label = "從螢幕邊探頭提醒你喝水、休息")
        f.toggle("full", "看影片、玩遊戲時躲起來", app.saves.pref("desk:fullscreen") != "off", "全螢幕結束後再出來")
        f.button("stable", "讓桌寵更穩定（各廠牌的設定說明）")
        Widgets.button(g, app, "desk:go", G, y + h - app.insetBottom - 72, W - G * 2, 56f, if (out) "叫回家" else "帶到桌面", Kind.PRIMARY, Dim.FS_L)
    }
    override fun tap(id: String) {
        when {
            id.startsWith("chip:remind:") -> app.saves.setPref("desk:remind", when (id.removePrefix("chip:remind:")) { "每 30 分" -> "30"; "每 60 分" -> "60"; "每 90 分" -> "90"; else -> null })
            id == "tog:full" -> app.saves.setPref("desk:fullscreen", if (app.saves.pref("desk:fullscreen") == "off") null else "off")
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
            for (l in Widgets.wrap(g, s, Dim.FS_S + 1, w - 40, 3)) { g.text(l, x + 20, yy, Dim.FS_S + 1, t.ink2); yy += 24 }
        Widgets.button(g, app, "perm:go", x + 20, y + h - 72, w - 40, 52f, "前往設定", Kind.PRIMARY)
    }
    override fun tap(id: String) { if (id == "perm:go") { app.closeOverlay(); app.platform.openOverlaySettings() } }
}
