package app.ocshimeji.ui

import app.ocshimeji.render.Align
import app.ocshimeji.render.Colors
import app.ocshimeji.render.FontKind
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import app.ocshimeji.save.media.Png
import app.ocshimeji.save.media.Raster
import app.ocshimeji.sim.life.Person
import app.ocshimeji.sim.life.Pose
import app.ocshimeji.sim.social.Capsules
import app.ocshimeji.sim.social.CatchGame
import app.ocshimeji.sim.social.FlipGame
import app.ocshimeji.sim.social.HouseRules
import app.ocshimeji.sim.social.Notes
import app.ocshimeji.sim.social.Photo
import app.ocshimeji.sim.social.PhotoKit
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.sin

/**
 * 1.8.0 (R7 second batch) 「和你」: messages (E-07), photo mode and the album (E-09), catch the snacks (L-03), card flip (L-04),
 * the name card and the card collection (M-03 / P-07), notes (P-03), the time capsule (P-04) and house rules (P-11).
 * Everything the life keeps goes through `sim.you` (`life/WithYou`); pictures are made here, from what was saved.
 */

// ---------------- pictures made off screen (photos, cards): drawn, read back, filtered, exported ----------------
object Snap {
    /** draw at `w`×`h` dp into `scale`× pixels, apply the filter; null = this backend can't read pixels back */
    fun pixels(g: Gfx, w: Float, h: Float, scale: Float, filter: String, draw: (Gfx) -> Unit): Raster? {
        val pw = (w * scale).toInt(); val ph = (h * scale).toInt()
        val px = g.offscreenPixels(pw, ph) { o -> o.save(); o.scale(scale, scale); draw(o); o.restore() } ?: return null
        filter(px, filter); return Raster(pw, ph, px)
    }
    /** the five looks (plan E-09) — done on the pixels so the export looks the same as the screen */
    fun filter(px: IntArray, kind: String) {
        if (kind == "none") return
        for (i in px.indices) { val c = px[i]; val a = c ushr 24; var r = (c shr 16) and 255; var gg = (c shr 8) and 255; var b = c and 255
            when (kind) {
                "warm" -> { r += 18; gg += 6; b -= 16 }
                "mono" -> { val l = (r * 30 + gg * 59 + b * 11) / 100; r = l; gg = l; b = l }
                "retro" -> { val l = (r * 30 + gg * 59 + b * 11) / 100; r = (l * 0.9 + 40).toInt(); gg = (l * 0.78 + 30).toInt(); b = (l * 0.6 + 22).toInt() }
                "dream" -> { r = r + (255 - r) / 4; gg = gg + (230 - gg) / 6; b = b + (255 - b) / 4 }
            }
            px[i] = (a shl 24) or (r.coerceIn(0, 255) shl 16) or (gg.coerceIn(0, 255) shl 8) or b.coerceIn(0, 255) }
    }
    fun export(app: UiApp, name: String, r: Raster?) {
        if (r == null) { app.toast("這個裝置不能存成圖片"); return }
        app.platform.saveFile(name, "image/png", Png.encode(r)) { ok -> app.toast(if (ok) "存好了：$name" else "沒有存") }
    }
}

/** E-09: a photo is redrawn from what it holds (who, poses, the hour, frame, stickers) */
object PhotoArt {
    const val W = 300f; const val H = 375f
    fun draw(g: Gfx, ws: WorldScreen, ph: Photo, time: Float = 0f) {
        val app = ws.app; val t = app.theme; val night = ph.hour < 6 || ph.hour >= 19
        val wall = if (night) 0xFF4A4868.toInt() else 0xFFF4E6CF.toInt(); val floor = if (night) 0xFF5C5068.toInt() else 0xFFE2C49E.toInt()
        g.fillGradientV(0f, 0f, W, H * 0.7f, Colors.mix(wall, 0xFFFFFFFF.toInt(), 0.15f), wall); g.fillRect(0f, H * 0.7f, W, H * 0.3f, floor)
        g.fillRound(W * 0.62f, 40f, 80f, 70f, 8f, if (night) 0xFF2A3050.toInt() else 0xFFBFE2F4.toInt()); g.strokeRound(W * 0.62f, 40f, 80f, 70f, 8f, 4f, 0xFFFFFFFF.toInt())
        Widgets.sky(g, t, ph.sky, W * 0.62f + 40, 75f, 12f)
        val n = ph.who.size.coerceAtLeast(1); val ch = when { n <= 2 -> 170f; n <= 4 -> 130f; else -> 104f }
        ph.who.forEachIndexed { i, id ->
            val x = W * (i + 1) / (n + 1); val feet = H * 0.9f - (i % 2) * 10f
            g.fillRound(x - ch * 0.2f, feet - 5, ch * 0.4f, 10f, 5f, Colors.withAlpha(0xFF000000.toInt(), 0.12f))
            val p = ws.sim.person(id); val look = p?.let { ws.lookOf(it) }
            val pose = runCatching { Pose.valueOf(ph.poses.getOrElse(i) { "HAPPY" }) }.getOrDefault(Pose.HAPPY)
            if (look != null) Actors.draw(g, look, x, feet, ch, pose, time, i * 1.3f, if (x < W / 2) 1 else -1, 0f, null, false)
            else Widgets.face(g, t, p?.let { app.charImg(ws.libOf(it), 256) }, x, feet - ch * 0.4f, ch * 0.22f)
        }
        ph.stickers.forEachIndexed { i, s -> val sx = 30f + ((ph.id * 37 + i * 83) % 240); val sy = 30f + ((ph.id * 53 + i * 59) % 150)
            g.fillCircle(sx, sy, 15f, 0xFFFFFFFF.toInt()); Widgets.icon(g, s, sx, sy, 14f, when (s) { "heart" -> 0xFFF0705A.toInt(); "star" -> 0xFFF2B33C.toInt(); "flower" -> 0xFFE58CB4.toInt(); else -> 0xFF8A6FB8.toInt() }) }
        frame(g, ph.frame, ph.caption, t)
    }
    private fun frame(g: Gfx, kind: String, caption: String, t: Theme) {
        val white = 0xFFFFFDF8.toInt()
        when (kind) {
            "polaroid" -> { g.fillRect(0f, 0f, W, 14f, white); g.fillRect(0f, 0f, 14f, H, white); g.fillRect(W - 14, 0f, 14f, H, white); g.fillRect(0f, H - 58, W, 58f, white) }
            "lace" -> { var x = 0f; while (x <= W) { g.fillCircle(x, 0f, 12f, white); g.fillCircle(x, H, 12f, white); x += 20f }; var y = 0f; while (y <= H) { g.fillCircle(0f, y, 12f, white); g.fillCircle(W, y, 12f, white); y += 20f } }
            "film" -> { val k = 0xFF2A2420.toInt(); g.fillRect(0f, 0f, 22f, H, k); g.fillRect(W - 22, 0f, 22f, H, k); var y = 8f; while (y < H) { g.fillRound(6f, y, 10f, 12f, 2f, white); g.fillRound(W - 16, y, 10f, 12f, 2f, white); y += 24f } }
            "stamp" -> { g.strokeRound(10f, 10f, W - 20, H - 20, 2f, 3f, 0xFFB07A50.toInt()); var x = 0f; while (x <= W) { g.fillCircle(x, 0f, 6f, white); g.fillCircle(x, H, 6f, white); x += 16f }; var y = 0f; while (y <= H) { g.fillCircle(0f, y, 6f, white); g.fillCircle(W, y, 6f, white); y += 16f } }
        }
        if (caption.isNotBlank()) { val y = if (kind == "polaroid") H - 24 else H - 18
            if (kind != "polaroid") g.fillRound(W / 2 - g.measure(caption, 15f) / 2 - 10, y - 18, g.measure(caption, 15f) + 20, 26f, 13f, Colors.withAlpha(white, 0.85f))
            g.text(caption, W / 2, y, 15f, 0xFF5A4636.toInt(), FontKind.UI, Align.CENTER) }
    }
    fun raster(g: Gfx, ws: WorldScreen, ph: Photo, scale: Float) = Snap.pixels(g, W, H, scale, ph.filter) { o -> draw(o, ws, ph) }
}

/** a small cache of pictures made off screen (keyed by what they show) */
class SnapCache { private val m = LinkedHashMap<String, Img?>()
    fun get(app: UiApp, key: String, make: () -> Raster?): Img? = m.getOrPut(key) { while (m.size > 24) m.remove(m.keys.first()); make()?.let { app.assets.pixels(it.w, it.h, it.px) } }
    fun clear() = m.clear() }

/** E-09 photo mode: who's in it and how they pose, a filter, a frame, stickers, a caption — then the shutter */
class PhotoStudio(val ws: WorldScreen, first: List<String>) : Screen() {
    override val animating get() = true
    private val sim get() = ws.sim
    private val home get() = sim.life.people.filter { !it.desk && it.out == null }
    private val who = first.filter { id -> home.any { it.id == id } }.toMutableList()
    private val poses = HashMap<String, String>()
    private var cur = who.firstOrNull()
    private var filter = "none"; private var frame = "polaroid"; private val stickers = ArrayList<String>(); private var caption = ""
    private var flash = -9f
    private val cache = SnapCache()
    private fun draft() = Photo(0, sim.life.minute, who.toList(), who.map { poses[it] ?: "HAPPY" }, filter, frame, stickers.toList(), sim.sky(), sim.hour, caption)
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val G = Dim.GUTTER; val top = app.insetTop
        g.fillRect(0f, 0f, W, H, 0xFF2E2A2A.toInt())
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back"); g.text("拍照", G + 60, top + 42, Dim.FS_L, 0xFFF6EEE2.toInt())
        val cl = if (caption.isBlank()) "加一句話" else Widgets.fit(g, caption, Dim.FS_S + 1, 120f); Widgets.chip(g, app, "caption", W - G - g.measure(cl, Dim.FS_S + 1) - 30, top + 14, cl, caption.isNotBlank(), 40f)
        // ---- the picture (redrawn when something changes)
        val ph = draft(); val pw = min(W - G * 2, (H * 0.29f) * PhotoArt.W / PhotoArt.H); val phh = pw * PhotoArt.H / PhotoArt.W; val px = (W - pw) / 2; val py = top + 70
        val img = if (who.isEmpty()) null else cache.get(app, "${who}|${ph.poses}|$filter|$frame|$stickers|$caption") { PhotoArt.raster(g, ws, ph, 2f) }
        g.fillRound(px, py, pw, phh, 6f, 0xFF4A4444.toInt())
        if (img != null) g.image(img, px, py, pw, phh)
        else if (who.isEmpty()) g.text("選一個人入鏡", W / 2, py + phh / 2, Dim.FS_M, 0xFFD8CCBC.toInt(), FontKind.UI, Align.CENTER)
        else { g.save(); g.translate(px, py); g.scale(pw / PhotoArt.W, pw / PhotoArt.W); PhotoArt.draw(g, ws, ph); g.restore() }   /* no pixels on this backend: unfiltered */
        val fl = app.time - flash; if (fl < 0.35f) g.fillRect(0f, 0f, W, H, Colors.withAlpha(0xFFFFFFFF.toInt(), 1f - fl / 0.35f))
        // ---- the controls
        var y = py + phh + 14; val light = 0xFFF6EEE2.toInt()
        fun row(label: String) { g.text(label, G, y + 14, Dim.FS_S - 1, 0xFFC8B8A6.toInt()); y += 20 }
        row("入鏡（點一下選人，再點一次換姿勢的對象）"); var x = G
        for (p in home) { val on = p.id in who; x += Widgets.chip(g, app, "who:${p.id}", x, y, p.name, on, 36f) + 6; if (x > W - 60) { x = G; y += 42 } }
        y += 44
        if (cur != null && cur in who) { row("${sim.person(cur!!)?.name ?: ""}的姿勢"); x = G
            for (chunk in PhotoKit.POSES.entries.chunked(3)) { x = G; for ((k, zh) in chunk) x += Widgets.chip(g, app, "pose:$k", x, y, zh, (poses[cur!!] ?: "HAPPY") == k, 36f, 72f) + 6; y += 42 }
            y += 2 }
        row("濾鏡"); x = G; for ((k, zh) in PhotoKit.FILTERS) x += Widgets.chip(g, app, "flt:$k", x, y, zh, filter == k, 36f) + 6; y += 44
        row("相框"); x = G; for ((k, zh) in PhotoKit.FRAMES) x += Widgets.chip(g, app, "frm:$k", x, y, zh, frame == k, 36f) + 6; y += 44
        row("貼紙"); x = G; for (s in PhotoKit.STICKERS) { val on = s in stickers; g.fillCircle(x + 20, y + 20, 20f, if (on) t.accent else 0xFF4A4444.toInt()); Widgets.icon(g, s, x + 20, y + 20, 16f, light); app.zone("stk:$s", x, y, 44f, 44f); x += 50 }
        val by = H - app.insetBottom - 76
        Widgets.button(g, app, "album", G, by, 110f, 56f, "相簿"); Widgets.button(g, app, "shoot", G + 122, by, W - G * 2 - 122, 56f, "拍下來", Kind.PRIMARY, Dim.FS_L)
    }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop()
            id == "album" -> app.push(AlbumPage(ws))
            id.startsWith("who:") -> { val p = id.removePrefix("who:"); if (p !in who) { who += p; cur = p } else if (cur != p) cur = p else { who.remove(p); cur = who.firstOrNull() } }
            id.startsWith("pose:") -> cur?.let { poses[it] = id.removePrefix("pose:") }
            id.startsWith("flt:") -> filter = id.removePrefix("flt:")
            id.startsWith("frm:") -> frame = id.removePrefix("frm:")
            id.startsWith("stk:") -> { val s = id.removePrefix("stk:"); if (s in stickers) stickers.remove(s) else if (stickers.size < 6) stickers += s }
            id == "caption" -> app.platform.prompt("照片上的一句話", caption, 30) { s -> if (s != null) caption = s.trim() }
            id == "shoot" -> { if (who.isEmpty()) { app.toast("先選一個人入鏡"); return }
                val ph = draft(); sim.you.takePhoto(ph.who, ph.poses, filter, frame, stickers, caption) ?: run { app.toast("入鏡的人不在家"); return }
                flash = app.time; app.platform.sound("chime"); app.platform.haptic("heavy"); ws.flush(); app.toast("拍好了！放進相簿") }
        }
    }
}

/** E-09: the album — every photo, redrawn; open one to keep it as a picture or delete it */
class AlbumPage(val ws: WorldScreen) : Page("相簿") {
    override val nav get() = ws to "records"
    private val cache = SnapCache()
    override fun rows(): List<Row> = emptyList()
    override val empty = ""
    override val primary get() = "new" to "拍照"
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val t = app.theme; val ps = ws.sim.life.you.photos.asReversed()
        if (ps.isEmpty()) { Widgets.emptyArt(g, t, x + w / 2, y + 40); g.text("還沒有照片：點住民選「拍照」，或點地板「拍全家福」", x + w / 2, y + 100, Dim.FS_S, t.ink3, FontKind.UI, Align.CENTER); return 130f }
        val cw = (w - 12) / 2; val chh = cw * PhotoArt.H / PhotoArt.W
        ps.forEachIndexed { i, ph -> val cx = x + (i % 2) * (cw + 12); val cy = y + (i / 2) * (chh + 40)
            g.fillRound(cx, cy + 3, cw, chh, 8f, t.shadow)
            val img = cache.get(app, "p${ph.id}") { PhotoArt.raster(g, ws, ph, 1.2f) }
            if (img != null) g.image(img, cx, cy, cw, chh) else { g.save(); g.clip(cx, cy, cw, chh); g.translate(cx, cy); g.scale(cw / PhotoArt.W, cw / PhotoArt.W); PhotoArt.draw(g, ws, ph); g.restore() }
            g.text(Widgets.fit(g, "第 ${dayOf(ws, ph.minute)} 天・" + ph.who.mapNotNull { ws.sim.person(it)?.name }.joinToString("、"), Dim.FS_S - 2, cw), cx + 2, cy + chh + 20, Dim.FS_S - 2, t.ink2)
            app.zone("ph:${ph.id}", cx, cy, cw, chh) }
        return ((ps.size + 1) / 2) * (chh + 40) + 10
    }
    override fun tap(id: String) {
        if (Nav.tap(app, ws, id)) return
        when {
            id == "back" -> app.pop()
            id == "new" -> app.push(PhotoStudio(ws, ws.sim.life.people.filter { !it.desk && it.out == null }.take(3).map { it.id }))
            id.startsWith("ph:") -> id.removePrefix("ph:").toIntOrNull()?.let { pid -> ws.sim.life.you.photos.firstOrNull { it.id == pid }?.let { app.show(PhotoSheet(ws, it) { cache.clear() }) } }
        }
    }
}

class PhotoSheet(val ws: WorldScreen, val ph: Photo, val gone: () -> Unit) : Overlay() {
    private val pop = Spring(0f, 1f, 300f, 22f); private val cache = SnapCache()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = pop.step(dt); val W = app.w; val H = app.h
        g.fillRect(0f, 0f, W, H, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val pw = min(W - 48, (H - 260) * PhotoArt.W / PhotoArt.H); val phh = pw * PhotoArt.H / PhotoArt.W; val x = (W - pw) / 2; val y = app.insetTop + 40
        val img = cache.get(app, "big") { PhotoArt.raster(g, ws, ph, 2f) }
        if (img != null) g.image(img, x, y, pw, phh) else { g.save(); g.translate(x, y); g.scale(pw / PhotoArt.W, pw / PhotoArt.W); PhotoArt.draw(g, ws, ph); g.restore() }
        app.zone("ph:body", x, y, pw, phh)
        val by = y + phh + 20; val bw = (W - 48 - 12) / 2
        Widgets.button(g, app, "ph:save", 24f, by, bw, 52f, "存成圖片", Kind.PRIMARY); Widgets.button(g, app, "ph:del", 36f + bw, by, bw, 52f, "刪除", Kind.DANGER)
    }
    override fun tap(id: String) {
        when (id) {
            "ph:save" -> Snap.export(app, "photo-${ph.id}.png", PhotoArt.raster(app.gfxForSnap ?: return, ws, ph, 3f))
            "ph:del" -> app.show(Confirm("刪掉這張照片？", "刪掉就找不回來了", "刪除") { ws.sim.you.deletePhoto(ph.id); ws.flush(); gone() })
        }
    }
}

/** E-07: the messages residents sent you — answer with one tap */
class MessagesPage(val ws: WorldScreen) : Page("訊息") {
    override val nav get() = ws to "records"
    override fun rows(): List<Row> = emptyList()
    override val empty = ""
    private val answers = HashMap<Int, String>()
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val t = app.theme; val ms = ws.sim.you.messages().take(40); var yy = y
        if (ms.isEmpty()) { Widgets.emptyArt(g, t, x + w / 2, yy + 40); g.text("住民想到你的時候會傳訊息來（晚安、分享、抱怨）", x + w / 2, yy + 100, Dim.FS_S, t.ink3, FontKind.UI, Align.CENTER); return 130f }
        for (m in ms) { val p = ws.sim.person(m.from)
            val ls = Widgets.wrap(g, m.text, Dim.FS_S + 1, w - 90, 4); val ans = answers[m.id]
            val h = 50f + ls.size * 22f + (if (m.reply < 0) 50f else 26f) + (if (ans != null) 24f else 0f)
            Widgets.card(g, t, x, yy, w, h, 18f, if (m.reply < 0) t.surface else t.surface2)
            Widgets.face(g, t, p?.let { app.charImg(ws.libOf(it), 128) }, x + 30, yy + 32, 18f)
            val m0 = ((m.minute % 1440) + 1440) % 1440
            g.text((p?.name ?: "（搬走的人）"), x + 58, yy + 28, Dim.FS_S, t.ink2); g.text("第 ${dayOf(ws, m.minute)} 天 %02d:%02d".format((m0 / 60).toInt(), (m0 % 60).toInt()), x + w - 14, yy + 28, Dim.FS_S - 2, t.ink3, FontKind.UI, Align.RIGHT)
            ls.forEachIndexed { i, l -> g.text(l, x + 58, yy + 54 + i * 22f, Dim.FS_S + 1, t.ink) }
            var by = yy + 46 + ls.size * 22f
            if (m.reply < 0) { var bx = x + 58; m.options.forEachIndexed { i, o -> bx += Widgets.chip(g, app, "re:${m.id}:$i", bx, by, o, false, 38f) + 8 } }
            else g.text("你：" + m.options.getOrElse(m.reply) { "" }, x + 58, by + 16, Dim.FS_S, t.accentLip)
            if (ans != null) g.text(Widgets.fit(g, "${p?.name ?: ""}：$ans", Dim.FS_S, w - 72), x + 58, by + (if (m.reply < 0) 0f else 40f), Dim.FS_S, t.ink2)
            yy += h + 10 }
        return yy - y
    }
    override fun tap(id: String) {
        if (Nav.tap(app, ws, id)) return
        if (id == "back") { app.pop(); return }
        if (id.startsWith("re:")) { val (mid, i) = id.removePrefix("re:").split(":").map { it.toInt() }
            val a = ws.sim.you.reply(mid, i); if (a.isNotBlank()) answers[mid] = a; app.platform.sound("pop"); ws.flush() }
    }
}

/** L-03: snacks fall, move the basket with your finger; the one you play with cheers */
class CatchScreen(val ws: WorldScreen, val pid: String) : Screen() {
    override val animating get() = true
    private val game = CatchGame(((ws.sim.life.minute * 7).toLong() xor pid.hashCode().toLong()))   /* a game's own seed: the life's dice are not touched */
    private var done = false; private var coins = 0
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val G = Dim.GUTTER; val top = app.insetTop
        g.fillGradientV(0f, 0f, W, H, t.skyTop, t.skyBottom); g.fillRect(0f, H * 0.82f, W, H * 0.18f, t.grass)
        if (!done) { game.step(dt); if (game.over) { done = true; coins = ws.sim.you.reward("catch", pid, game.score); ws.flush(); app.platform.sound("chime") } }
        val fy = top + 80; val fh = H * 0.82f - fy
        for (d in game.drops) { val x = d.x * W; val y = fy + d.y * fh
            when (d.kind) { 0 -> { g.fillCircle(x, y, 14f, 0xFFD9A066.toInt()); g.fillCircle(x - 4, y - 3, 2.5f, 0xFF7A4A2A.toInt()); g.fillCircle(x + 5, y + 2, 2.5f, 0xFF7A4A2A.toInt()) }
                1 -> { g.fillCircle(x, y, 13f, 0xFFE0524A.toInt()); g.fillRound(x - 1.5f, y - 18, 3f, 7f, 1.5f, 0xFF6A4A2A.toInt()) }
                else -> g.fillCircle(x, y, 11f, 0xFF8C8C94.toInt()) } }
        val p = ws.sim.person(pid); val bx = game.x * W; val by = fy + 0.95f * fh
        val look = p?.let { ws.lookOf(it) }
        if (look != null) Actors.draw(g, look, bx, by + 30, 90f, if (done) Pose.HAPPY else Pose.STAND, app.time, 0f, 1, 0f, null, false) else Widgets.face(g, t, p?.let { app.charImg(ws.libOf(it), 128) }, bx, by - 10, 22f)
        g.fillRound(bx - W * 0.08f, by - 8, W * 0.16f, 18f, 9f, 0xFFB07A50.toInt())
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back")
        g.text("接到 ${game.score}", W / 2, top + 42, Dim.FS_L, t.ink, FontKind.UI, Align.CENTER)
        g.text("${(game.len - game.t).coerceAtLeast(0f).toInt()} 秒", W - G, top + 42, Dim.FS_M, t.ink2, FontKind.UI, Align.RIGHT)
        if (done) { Widgets.card(g, t, G, H / 2 - 90, W - G * 2, 180f)
            g.text("接到 ${game.score} 個！", W / 2, H / 2 - 46, Dim.FS_L, t.ink, FontKind.UI, Align.CENTER)
            g.text("最高 ${ws.sim.life.you.best["catch"] ?: 0}・得到 $coins 星幣", W / 2, H / 2 - 16, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER)
            Widgets.button(g, app, "again", G + 16, H / 2 + 20, (W - G * 2 - 44) / 2, 52f, "再玩一次"); Widgets.button(g, app, "back", W / 2 + 6, H / 2 + 20, (W - G * 2 - 44) / 2, 52f, "好了", Kind.PRIMARY) }
        else g.text("左右滑動接住點心，小心石頭", W / 2, H - app.insetBottom - 30, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER)
    }
    override fun pointer(kind: Int, x: Float, y: Float): Boolean { if (done || y < app.insetTop + 70) return false; if (kind == 0 || kind == 1) game.x = (x / app.w).coerceIn(0.08f, 0.92f); return kind == 0 }
    override fun tap(id: String) { when (id) { "back" -> app.pop(); "again" -> app.replace(CatchScreen(ws, pid)) } }
}

/** L-04: flip cards whose faces are the residents' expressions (their own pictures when they have them) */
class FlipScreen(val ws: WorldScreen, val pid: String) : Screen() {
    override val animating get() = true
    private val faces = listOf("happy", "sad", "angry", "shy", "surprised", "sleepy")
    private val game = FlipGame(((ws.sim.life.minute * 13).toLong() xor pid.hashCode().toLong()), faces)
    private var done = false; private var coins = 0; private var hide = -1f
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val W = app.w; val H = app.h; val G = Dim.GUTTER; val top = app.insetTop
        g.fillRect(0f, 0f, W, H, t.bg); g.fillGradientV(0f, 0f, W, top + 120, t.skyTop, t.bg)
        if (hide > 0 && app.time > hide) { hide = -1f; game.open.clear() }
        Widgets.round(g, app, "back", G + 24, top + 34, 24f, "back"); g.text("翻牌", G + 60, top + 42, Dim.FS_L, t.ink)
        g.text("翻了 ${game.turns} 次", W - G, top + 42, Dim.FS_M, t.ink2, FontKind.UI, Align.RIGHT)
        val p = ws.sim.person(pid); val look = p?.let { ws.lookOf(it) }
        val cw = (W - G * 2 - 24) / 3; val chh = cw * 1.2f; val y0 = top + 80
        game.cards.forEachIndexed { i, f -> val cx = G + (i % 3) * (cw + 12); val cy = y0 + (i / 3) * (chh + 10)
            val up = i in game.open || i in game.done
            Widgets.card(g, t, cx, cy, cw, chh, 14f, if (up) t.surface else t.accent)
            if (up) { val img = look?.face(f)
                if (img != null) { val k = min((cw - 16) / img.w, (chh - 30) / img.h); g.image(img, cx + cw / 2 - img.w * k / 2, cy + 8, img.w * k, img.h * k) }
                else Widgets.icon(g, when (f) { "happy" -> "smile"; "sad" -> "drop"; "angry" -> "anger"; "shy" -> "heart"; "surprised" -> "star"; else -> "zzz" }, cx + cw / 2, cy + chh / 2 - 8, 30f, t.ink2)
                g.text(mapOf("happy" to "開心", "sad" to "難過", "angry" to "生氣", "shy" to "害羞", "surprised" to "驚訝", "sleepy" to "想睡")[f] ?: f, cx + cw / 2, cy + chh - 12, Dim.FS_S - 1, t.ink2, FontKind.UI, Align.CENTER) }
            else { g.fillCircle(cx + cw / 2, cy + chh / 2, cw * 0.22f, Colors.withAlpha(t.onAccent, 0.35f)); Widgets.icon(g, "paw", cx + cw / 2, cy + chh / 2, 22f, t.onAccent) }
            app.zone("c:$i", cx, cy, cw, chh) }
        if (done) { val n = game.stars(); Widgets.card(g, t, G, H / 2 - 90, W - G * 2, 180f)
            g.text("全部配對！", W / 2, H / 2 - 50, Dim.FS_L, t.ink, FontKind.UI, Align.CENTER)
            for (i in 0 until 3) Widgets.icon(g, "star", W / 2 - 36 + i * 36f, H / 2 - 18, 24f, if (i < n) 0xFFF2B33C.toInt() else t.lip)
            g.text("得到 $coins 星幣", W / 2, H / 2 + 12, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER)
            Widgets.button(g, app, "again", G + 16, H / 2 + 26, (W - G * 2 - 44) / 2, 50f, "再玩一次"); Widgets.button(g, app, "back", W / 2 + 6, H / 2 + 26, (W - G * 2 - 44) / 2, 50f, "好了", Kind.PRIMARY) }
        else g.text("和${p?.name ?: ""}一起找出一樣的表情", W / 2, H - app.insetBottom - 30, Dim.FS_S, t.ink2, FontKind.UI, Align.CENTER)
    }
    override fun tap(id: String) {
        when {
            id == "back" -> app.pop(); id == "again" -> app.replace(FlipScreen(ws, pid))
            id.startsWith("c:") && !done -> { if (hide > 0) { hide = -1f; game.open.clear() }
                when (game.flip(id.removePrefix("c:").toInt())) { "pair" -> app.platform.sound("chime"); "miss" -> { app.platform.sound("tick"); hide = app.time + 0.8f }; else -> app.platform.sound("pop") }
                if (game.over) { done = true; coins = ws.sim.you.reward("flip", pid, game.stars()); ws.flush() } }
        }
    }
}

/** M-03 / P-07: a character's card — picture, name, the things that make them them; kept as a picture */
object CardArt {
    const val W = 300f; const val H = 420f
    fun draw(g: Gfx, ws: WorldScreen, p: Person) {
        val app = ws.app; val t = app.theme; val s = p.spec
        val tint = runCatching { Colors.hex(s.color) }.getOrDefault(0xFFF2B8A0.toInt())
        g.fillRound(0f, 0f, W, H, 22f, 0xFFFFFAF2.toInt()); g.fillRound(10f, 10f, W - 20, 200f, 16f, Colors.mix(tint, 0xFFFFFFFF.toInt(), 0.55f))
        val look = ws.lookOf(p); if (look != null) Actors.draw(g, look, W / 2, 200f, 170f, Pose.HAPPY, 0f, 0f, 1, 0f, null, false) else Widgets.face(g, t, app.charImg(ws.libOf(p), 256), W / 2, 110f, 60f)
        g.text(s.name, 20f, 244f, 22f, 0xFF4A3A2E.toInt())
        val sub = listOfNotNull(s.species.takeIf { it != "未知" }, s.birthday.takeIf { it.isNotBlank() }?.let { "生日 $it" }, if (s.age > 0) "${s.age} 歲" else null).joinToString("・")
        g.text(Widgets.fit(g, sub, 13f, W - 40), 20f, 266f, 13f, 0xFF8A7666.toInt())
        var y = 292f
        fun line(head: String, v: List<String>) { if (v.isEmpty()) return; g.text(head, 20f, y, 12f, 0xFFB07A50.toInt()); g.text(Widgets.fit(g, v.joinToString("、"), 13f, W - 84), 64f, y, 13f, 0xFF4A3A2E.toInt()); y += 22 }
        line("特質", s.traits.take(4)); line("標籤", s.tags.take(5)); line("喜歡", s.likes.take(4))
        s.catchphrases.firstOrNull()?.let { g.text(Widgets.fit(g, "「$it」", 14f, W - 40), W / 2, y + 8, 14f, 0xFF6A5444.toInt(), FontKind.UI, Align.CENTER); y += 26 }
        val titles = ws.sim.journal.titlesOf(p.id); if (titles.isNotEmpty()) g.text(Widgets.fit(g, "稱號：" + titles.joinToString("・") { it.zh }, 12f, W - 40), 20f, H - 20, 12f, 0xFFB07A50.toInt())
        g.text(ws.sim.life.homeName, W - 20, H - 20, 12f, 0xFFB0A090.toInt(), FontKind.UI, Align.RIGHT)
    }
    fun raster(g: Gfx, ws: WorldScreen, p: Person, scale: Float) = Snap.pixels(g, W, H, scale, "none") { o -> draw(o, ws, p) }
}

/** M-03: one card, big, with "save as a picture" */
class NameCardSheet(val ws: WorldScreen, val pid: String) : Overlay() {
    private val pop = Spring(0f, 1f, 300f, 22f); private val cache = SnapCache()
    override fun frame(g: Gfx, dt: Float) {
        val t = app.theme; val s = pop.step(dt); val W = app.w; val H = app.h; val p = ws.sim.person(pid) ?: run { app.closeOverlay(); return }
        g.fillRect(0f, 0f, W, H, Colors.withAlpha(t.scrim, s.coerceIn(0f, 1f)))
        val cw = min(W - 48, (H - 220) * CardArt.W / CardArt.H); val chh = cw * CardArt.H / CardArt.W; val x = (W - cw) / 2; val y = app.insetTop + 30 + (1 - s) * 60
        val img = cache.get(app, "c") { CardArt.raster(g, ws, p, 2f) }
        if (img != null) g.image(img, x, y, cw, chh) else { g.save(); g.translate(x, y); g.scale(cw / CardArt.W, cw / CardArt.W); CardArt.draw(g, ws, p); g.restore() }
        app.zone("nc:body", x, y, cw, chh)
        Widgets.button(g, app, "nc:save", 24f, y + chh + 20, W - 48, 52f, "存成圖片", Kind.PRIMARY)
    }
    override fun tap(id: String) { if (id == "nc:save") { val p = ws.sim.person(pid) ?: return; Snap.export(app, "card-${p.name}.png", CardArt.raster(app.gfxForSnap ?: return, ws, p, 3f)) } }
}

/** P-07: everyone's card in one place */
class CardsPage(val ws: WorldScreen) : Page("角色卡") {
    override val nav get() = ws to "records"
    private val cache = SnapCache()
    override fun rows(): List<Row> = emptyList()
    override val empty = ""
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float {
        val ps = ws.sim.life.people; val cw = (w - 12) / 2; val chh = cw * CardArt.H / CardArt.W
        ps.forEachIndexed { i, p -> val cx = x + (i % 2) * (cw + 12); val cy = y + (i / 2) * (chh + 14)
            g.fillRound(cx, cy + 3, cw, chh, 12f, app.theme.shadow)
            val img = cache.get(app, p.id) { CardArt.raster(g, ws, p, 1.2f) }
            if (img != null) g.image(img, cx, cy, cw, chh) else { g.save(); g.translate(cx, cy); g.scale(cw / CardArt.W, cw / CardArt.W); CardArt.draw(g, ws, p); g.restore() }
            app.zone("card:${p.id}", cx, cy, cw, chh) }
        return ((ps.size + 1) / 2) * (chh + 14) + 10
    }
    override fun tap(id: String) { if (Nav.tap(app, ws, id)) return; if (id == "back") app.pop() else if (id.startsWith("card:")) app.show(NameCardSheet(ws, id.removePrefix("card:"))) }
}

/** P-04: one capsule at a time; it opens by itself thirty days later (a letter in the mailbox) */
class CapsulePage(val ws: WorldScreen) : TextPage("時光膠囊") {
    override val nav get() = ws to "records"
    override val none = "寫一封信給 ${Capsules.DAYS} 天後，和大家一起埋起來"
    override val primary get() = if (ws.sim.you.capsuleOpen() == null) "bury" to "寫信、埋起來" else null
    override fun blocks(): List<Pair<String, List<String>>> = ws.sim.life.you.capsules.asReversed().map { c ->
        if (!c.opened) "第 ${c.day} 天埋的・還有 ${(c.openDay - ws.sim.life.day).coerceAtLeast(0)} 天打開" to listOf("（信封還封著。大家也各寫了一封。）")
        else "第 ${c.day} 天埋的・第 ${c.openDay} 天打開" to (listOf("你：${c.yours}") + c.theirs.map { (id, s) -> "${ws.sim.person(id)?.name ?: "（搬走的人）"}：$s" }) }
    override fun tap(id: String) {
        if (Nav.tap(app, ws, id)) return
        when (id) { "back" -> app.pop()
            "bury" -> app.platform.prompt("給 ${Capsules.DAYS} 天後的信", "", 200) { s -> if (s != null) { val e = ws.sim.you.bury(s); if (e != null) app.toast(e) else { app.platform.sound("chime"); ws.flush(); app.toast("埋好了，${Capsules.DAYS} 天後打開") } } } }
    }
}

/** P-11: house rules — on or off; who will push back is shown before you decide */
class RulesPage(val ws: WorldScreen) : Page("家規") {
    override val nav get() = ws to "records"
    override fun rows(): List<Row> = HouseRules.ALL.values.map { d -> val on = d.id in ws.sim.life.you.rules
        val no = ws.sim.life.people.filter { !ws.sim.you.keeps(it, d.id) }.joinToString("、") { it.name }
        Row("rule:${d.id}", d.zh, (if (on) "已經是家規" else "點一下定成家規") + if (no.isNotEmpty()) "・${no}可能不太想遵守" else "・大家都會遵守", icon = if (on) "check" else "list", tint = if (on) 0xFFCDE6D6.toInt() else null) }
    override fun header(g: Gfx, x: Float, y: Float, w: Float): Float { g.text("最多 ${HouseRules.MAX} 條。家規會改變大家想做的事，但不是命令。", x + 4, y + 16, Dim.FS_S, app.theme.ink2); return 34f }
    override fun tap(id: String) {
        if (Nav.tap(app, ws, id)) return
        if (id == "back") { app.pop(); return }
        if (id.startsWith("rule:")) { val r = id.removePrefix("rule:"); val e = ws.sim.you.setRule(r, r !in ws.sim.life.you.rules); if (e != null) app.toast(e) else app.platform.sound("pop"); ws.flush() }
    }
}

/** 「和你」: everything between you and them */
class YouHub(val ws: WorldScreen) : Page("和你") {
    override val nav get() = ws to "records"
    override fun rows(): List<Row> { val you = ws.sim.life.you; val un = ws.sim.you.unread()
        return listOf(
            Row("msgs", "訊息", if (un > 0) "$un 則還沒回" else "${you.messages.size} 則", icon = "chat", tint = 0xFFE6E0F4.toInt()),
            Row("photo", "拍照", "選人、姿勢、濾鏡、相框、貼紙", icon = "camera", tint = 0xFFF6D0B8.toInt()),
            Row("album", "相簿", "${you.photos.size} 張", icon = "image", tint = 0xFFFFE9A8.toInt()),
            Row("tools", "神明的小道具", "天降禮物、幸運的一天、好夢、流星（每樣一天一次）", icon = "gift", tint = 0xFFFFE9A8.toInt()),
            Row("catch", "接點心", "最高 ${you.best["catch"] ?: 0} 個", icon = "food", tint = 0xFFCDE6D6.toInt()),
            Row("flip", "翻牌", "用大家的表情配對・最高 ${you.best["flip"] ?: 0} 顆星", icon = "game", tint = 0xFFCFE2F2.toInt()),
            Row("cards", "角色卡", "每個人的名片，可以存成圖片", icon = "star", tint = 0xFFF8E0A8.toInt()),
            Row("notes", "你的筆記", "${ws.sim.you.notes().size} 則（永遠留在回憶裡）", icon = "edit", tint = 0xFFF0C8D8.toInt()),
            Row("capsule", "時光膠囊", ws.sim.you.capsuleOpen()?.let { "還有 ${(it.openDay - ws.sim.life.day).coerceAtLeast(0)} 天打開" } ?: "寫信給 ${Capsules.DAYS} 天後", icon = "gift", tint = 0xFFD6D0F0.toInt()),
            Row("rules", "家規", "${you.rules.size}／${HouseRules.MAX} 條", icon = "list"),
        ) }
    override fun tap(id: String) {
        if (Nav.tap(app, ws, id)) return
        when (id) {
            "back" -> app.pop(); "msgs" -> app.push(MessagesPage(ws)); "album" -> app.push(AlbumPage(ws)); "cards" -> app.push(CardsPage(ws))
            "capsule" -> app.push(CapsulePage(ws)); "rules" -> app.push(RulesPage(ws)); "tools" -> toolsSheet(app, ws); "notes" -> app.push(NotesPage(ws))
            "photo" -> app.push(PhotoStudio(ws, ws.sim.life.people.filter { !it.desk && it.out == null }.take(3).map { it.id }))
            "catch", "flip" -> pickPlayer(app, ws, id)
        }
    }
}

/** who plays with you (awake and at home) */
fun pickPlayer(app: UiApp, ws: WorldScreen, game: String) {
    val ok = ws.sim.life.people.filter { !it.desk && it.out == null && !ws.sim.asleep(it) }
    if (ok.isEmpty()) { app.toast("現在沒有人可以陪你玩"); return }
    app.show(ListSheet("和誰一起玩？", ok.map { it.id to it.name }) { pid -> app.push(if (game == "catch") CatchScreen(ws, pid) else FlipScreen(ws, pid)) })
}

/** P-03: write a note about someone (a tag, then the text) */
fun writeNote(app: UiApp, ws: WorldScreen, pid: String) {
    val p = ws.sim.person(pid) ?: return
    app.show(ListSheet("關於${p.name}的筆記", listOf("" to "不加標籤") + Notes.TAGS.map { it to "#$it" }) { tag ->
        app.platform.prompt("關於${p.name}", "", 120) { s -> if (s != null) { val e = ws.sim.you.note(pid, s, tag); if (e != null) app.toast(e) else { app.platform.sound("pop"); ws.flush(); app.toast("記下來了（收在回憶裡）") } } } })
}

/** P-03: all your notes */
class NotesPage(val ws: WorldScreen) : TextPage("你的筆記") {
    override val nav get() = ws to "records"
    override val none = "在人物卡的「紀錄」頁寫下想記住的事"
    override fun blocks() = ws.sim.you.notes().asReversed().take(60).map { l -> "第 ${dayOf(ws, l.minute)} 天・${ws.sim.person(l.who)?.name ?: ""}" to listOf(l.text.removePrefix("你的筆記：")) }
    override fun tap(id: String) { if (Nav.tap(app, ws, id)) return; if (id == "back") app.pop() }
}

@Suppress("unused") private fun keep() = abs(sin(0f))

/** the world's day number (1 = the first day) of a minute on its clock */
fun dayOf(ws: WorldScreen, minute: Double): Long = ws.sim.life.day - ((ws.sim.life.minute / 1440).toLong() - (minute / 1440).toLong())
