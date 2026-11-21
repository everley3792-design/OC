package app.ocshimeji.ui

import app.ocshimeji.render.Assets
import app.ocshimeji.render.Gfx
import app.ocshimeji.save.SaveSystem

/** what only the platform can do (Android on the phone, a stub in tests) */
interface Platform {
    fun now(): Long
    fun haptic(kind: String) {}
    /** ask for a line of text (system keyboard); the answer comes back later, null = cancelled */
    fun prompt(title: String, initial: String, maxLength: Int, done: (String?) -> Unit)
    /** leave the app (back on the first screen) */
    fun exit() {}
    /** the phone's local time as minutes (time zone included) — the default world clock */
    fun realMinute(): Double = (now() + java.util.TimeZone.getDefault().getOffset(now())) / 60000.0
    /** let the player pick a picture; the platform decodes it (working copy ≤ 1024 px as PNG + its pixels); null = cancelled; a String = why it failed */
    fun pickImage(done: (PickedImage?, String?) -> Unit) { done(null, "這個版本還不能選圖片") }
    /** write a file the player chooses where to keep (export) */
    fun saveFile(name: String, mime: String, data: ByteArray, done: (Boolean) -> Unit) { done(false) }
    /** read a file the player picks (import) */
    fun openFile(mime: String, done: (ByteArray?) -> Unit) { done(null) }
    /** a short original sound (tick, pop, lift, whoosh, land, bounce, munch, chime) */
    fun sound(name: String) {}
    /** let the player pick one or more files (pictures, animations, ZIP, .ocpkg, JSON); null = cancelled; a String = why it failed */
    fun pickFiles(multiple: Boolean, done: (List<app.ocshimeji.save.media.Importer.Source>?, String?) -> Unit) { done(null, "這個版本還不能選檔案") }
    /** decodes still pictures (PNG, JPEG, WebP…) for the importer */
    val codec: app.ocshimeji.save.media.Codec get() = app.ocshimeji.save.media.Codec { null }
    /** "display over other apps" is allowed (the desktop pets need it) */
    fun canOverlay(): Boolean = false
    /** open the system page for that permission (after our explanation card) */
    fun openOverlaySettings() {}
    /** put a resident on the phone's desktop (the platform starts its service); null = done, otherwise why not */
    fun deskStart(slotId: String, personId: String): String? = "這個版本還不能帶到桌面"
    /** call a resident back home from the desktop */
    fun deskStop(slotId: String, personId: String) {}
    /** is the desktop service alive (otherwise a resident marked "on the desktop" comes home) */
    fun deskRunning(slotId: String): Boolean = false
    /** the character's babble voice (plan 12.4 聲線) for a line */
    fun voice(v: app.ocshimeji.sim.chars.Voice, text: String) {}
}

/** a picture the player picked: the original file, a working PNG (≤ 1024 px) and that working copy's pixels for checking */
class PickedImage(val original: ByteArray, val ext: String, val working: ByteArray, val w: Int, val h: Int, val px: IntArray)

/**
 * The whole UI. Immediate mode: every frame each screen draws itself and registers tap areas (`zone`). A finger that goes down and up
 * on the same zone without moving is a tap → `Screen.tap(id)`. Overlays (sheet, confirm, toast) sit above the screen stack.
 * Pure Kotlin: the phone and the screenshot tests run exactly this.
 */
class UiApp(val saves: SaveSystem, val assets: Assets, val platform: Platform, val host: WorldHost = WorldHost(saves, platform::now, platform::realMinute)) {
    /** a character's standing picture: built in (asset:) or from the library (lib:) */
    fun charImg(c: app.ocshimeji.save.LibChar?, maxSide: Int = 512): app.ocshimeji.render.Img? {
        if (c == null) return null
        return if (c.image.startsWith("asset:")) assets.image(c.image.removePrefix("asset:"), maxSide)
        else { val path = c.image.removePrefix("lib:"); assets.decode("lib:$path@$maxSide", maxSide) { saves.readFile(path) } }
    }
    var theme: Theme = Theme.LIGHT
    /** safe area (status bar, cutout, gesture bar) in dp */
    var insetTop = 0f; var insetBottom = 0f
    var w = 360f; var h = 800f
    var time = 0f; private set

    private val stack = ArrayList<Screen>()
    val screen: Screen get() = stack.last()
    val screens: List<Screen> get() = stack
    var overlay: Overlay? = null; private set
    private var toast: Pair<String, Float>? = null
    val toastText: String? get() = toast?.first

    fun push(s: Screen) { stack += s; s.app = this; s.enter() }
    fun replace(s: Screen) { if (stack.isNotEmpty()) { stack.removeAt(stack.size - 1).leave() }; push(s) }
    fun pop() { if (stack.size > 1) { stack.removeAt(stack.size - 1).leave(); screen.resume() } }
    fun show(o: Overlay) { overlay = o; o.app = this; o.born = time; platform.haptic("tick") }
    fun closeOverlay() { overlay = null }
    fun toast(text: String) { toast = text to time }

    // ---------------- frame ----------------
    private val zones = ArrayList<Zone>()
    class Zone(val id: String, val x: Float, val y: Float, val w: Float, val h: Float, val layer: Int, val born: Float)
    private var layer = 0
    /** register a tap area for this frame (drawing order = priority: later wins) */
    /** added to every zone registered while drawing inside a translated (scrolled) area */
    var zoneDx = 0f; var zoneDy = 0f
    fun zone(id: String, x: Float, y: Float, w: Float, h: Float) { zones += Zone(id, x + zoneDx, y + zoneDy, w, h, layer, overlay?.born ?: -1f) }
    fun frame(g: Gfx, dt: Float) {
        time += dt; w = g.width; h = g.height; zones.clear(); zoneDx = 0f; zoneDy = 0f
        layer = 0; screen.frame(g, dt)
        overlay?.let { layer = 1; it.frame(g, dt) }
        toast?.let { (t, at) -> val age = time - at; if (age > 2.6f) toast = null else Widgets.toast(g, this, t, age) }
    }
    /** something is moving: the platform should keep drawing at full rate (otherwise it may idle) */
    val animating: Boolean get() = screen.animating || overlay != null || toast != null || pressed != null
    /** frames per second worth drawing now: a living scene nobody touches is smooth enough at 30 (battery) */
    val fps: Int get() = if (overlay != null || pressed != null) 60 else screen.fps

    // ---------------- input (dp) ----------------
    var pressed: String? = null; private set
    private var downX = 0f; private var downY = 0f; private var moved = false
    /** the screen took this finger for itself (a world: touching characters, panning) — zones and drags are skipped */
    private var raw = false
    fun down(x: Float, y: Float) {
        downX = x; downY = y; moved = false
        val z = hit(x, y); pressed = z?.id; raw = false
        if (overlay == null && z == null && screen.pointer(0, x, y)) { raw = true; return }
        if (overlay == null) screen.drag(0f, 0f, x, y, start = true)
    }
    fun move(x: Float, y: Float) {
        if (raw) { screen.pointer(1, x, y); return }
        if (!moved && Math.hypot((x - downX).toDouble(), (y - downY).toDouble()) > 10) { moved = true; pressed = null }
        if (moved && overlay == null) screen.drag(x - downX, y - downY, x, y, start = false)
    }
    /** a second finger (pinch): kind 0 down, 1 move, 2 up — only screens that want it */
    fun second(kind: Int, x: Float, y: Float) { if (overlay == null) screen.pointer(10 + kind, x, y) }
    /** where the last finger went up (for taps that need a position: placing a mark, a foot point) */
    var tapX = 0f; var tapY = 0f; private set
    fun up(x: Float, y: Float) {
        tapX = x; tapY = y
        if (raw) { raw = false; screen.pointer(2, x, y); return }
        val id = pressed; pressed = null
        if (moved) { if (overlay == null) screen.release(); return }
        val z = hit(x, y)
        if (overlay != null) {
            val o = overlay!!
            if (z == null || z.layer == 0) { if (o.dismissible) { closeOverlay(); o.dismissed() } ; return }   /* outside the overlay: close it */
            if (time - o.born < Dim.GUARD) return                                                              /* just appeared: ignore */
            if (z.id == id) { platform.haptic("tick"); o.tap(z.id) }
            return
        }
        if (z != null && z.id == id) { platform.haptic("tick"); screen.tap(z.id) }
    }
    fun cancel() { pressed = null; if (raw) { raw = false; screen.pointer(3, downX, downY); return }; if (moved && overlay == null) screen.release() }
    private fun hit(x: Float, y: Float): Zone? {
        val top = if (overlay != null) 1 else 0
        return zones.lastOrNull { it.layer == top && x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h }
            ?: if (top == 1) zones.lastOrNull { x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h } else null
    }
    /** tests: tap the centre of a zone by id (the same path a finger takes) */
    fun tapZone(id: String): Boolean { val z = zones.lastOrNull { it.id == id } ?: return false; val x = z.x + z.w / 2; val y = z.y + z.h / 2; down(x, y); up(x, y); return true }
    fun hasZone(id: String) = zones.any { it.id == id }
    val zoneIds: List<String> get() = zones.map { it.id }

    /** the system back button: closes the overlay first, then the screen; false = nothing left (leave the app) */
    fun back(): Boolean {
        overlay?.let { if (it.dismissible) { closeOverlay(); it.dismissed() }; return true }
        if (screen.back()) return true
        if (stack.size > 1) { pop(); return true }
        return false
    }
    /** the app goes to the background / is about to be closed */
    fun pause() { for (s in stack) s.pause() }
    /** back in front after being in the background */
    fun wake() { for (s in stack) s.wake() }
}

abstract class Screen {
    lateinit var app: UiApp
    open val animating: Boolean get() = false
    open val fps: Int get() = 60
    open fun enter() {}
    open fun resume() {}
    open fun leave() {}
    open fun pause() {}
    open fun wake() {}
    abstract fun frame(g: Gfx, dt: Float)
    open fun tap(id: String) {}
    /** a finger moving (dx, dy from where it went down) — scrolling */
    open fun drag(dx: Float, dy: Float, x: Float, y: Float, start: Boolean) {}
    open fun release() {}
    /** raw fingers for screens that handle touch themselves (kind 0 down, 1 move, 2 up, 3 cancel; 10–12 a second finger). Return true on down to take the finger. */
    open fun pointer(kind: Int, x: Float, y: Float): Boolean = false
    /** true = handled */
    open fun back(): Boolean = false
}

abstract class Overlay {
    lateinit var app: UiApp
    var born = 0f
    open val dismissible = true
    abstract fun frame(g: Gfx, dt: Float)
    abstract fun tap(id: String)
    open fun dismissed() {}
}
