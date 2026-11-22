package app.ocshimeji.ui

import app.ocshimeji.render.Img
import app.ocshimeji.render.Colors
import app.ocshimeji.render.Colors.hex
import app.ocshimeji.render.Gfx
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.house.HouseType
import app.ocshimeji.sim.house.Room
import app.ocshimeji.sim.house.RoomKind

/**
 * A house drawn as a 2.5D cut-away (plan 2.2): a fixed, slightly-from-above camera, so every tile is a rectangle T wide and T·K deep,
 * and the top row of each room stands up as its back wall. Furniture is drawn from simple shapes (original, no outside art);
 * characters and furniture are sorted by depth so someone behind the sofa is behind it.
 *
 * Coordinates: tiles (x right, y toward the viewer) → base dp `bx(x)`, `by(y)`; the caller translates and scales.
 * The same drawing is used for the small previews in 開始新的觀察 and for the live home.
 */
class HouseView(val house: HouseType, var T: Float = 32f) {
    val K = 0.9f
    fun bx(tx: Float) = tx * T
    fun by(ty: Float) = ty * T * K
    val width get() = house.w * T
    val height get() = house.h * T * K
    /** a thing drawn in depth order (bigger key = nearer = later) */
    class D(val key: Float, val draw: () -> Unit)
    /** the player's wallpaper / floor per room (plan 12.6): pictures tiled seamlessly; null = the house's own */
    var walls: Map<String, Img> = emptyMap(); var floors: Map<String, Img> = emptyMap()
    /** pictures of the player's own furniture (`FurnitureKind.image`); null = drawn as a plain box */
    var itemImg: (String) -> Img? = { null }
    /** how grown a potted plant is (0 sprout … 3 flowering, −1 drooping): from the life's journal */
    var plantStage: (Int, Int) -> Int = { _, _ -> 2 }
    // ---- R5: what the life says about how things look, and the light
    /** a piece's look (`LifeSim.stateOf`): "" = the default look (previews) */
    var state: (Int) -> String = { "" }
    /** game hour and the weather, for window light and the clock */
    var hour = 12.0; var weather = "sunny"
    /** things on the floor (kind, x, y) */
    var litter: List<Triple<String, Int, Int>> = emptyList()
    /** reduce motion: no drifting dust, no swaying curtains */
    var calm = false
    /** 1.5.1: furniture that isn't moving is drawn once per zoom bucket into a picture (PieceCache) */
    var cacheOn = true
    private fun cached(g: Gfx, key: String, pc: app.ocshimeji.sim.house.Piece, draw: (Gfx) -> Unit) {
        val k = Furniture.kind(pc.kind); val x0 = bx(pc.x.toFloat()) - 10; val y0 = by(pc.y.toFloat()) - T * 2.2f; val w = k.w * T + 20; val h = by(pc.y + k.h.toFloat()) + 10 - y0
        if (!cacheOn || !PieceCache.draw(g, "$key|${pc.kind}|$T|${pal?.dark}", x0, y0, w, h, draw)) draw(g)
    }
    private var pal: Pal? = null
    private fun tile(g: Gfx, img: Img, x: Float, y: Float, w: Float, h: Float, tw: Float, th: Float) {
        g.save(); g.clip(x, y, w, h); var yy = y; while (yy < y + h) { var xx = x; while (xx < x + w) { g.image(img, xx, yy, tw, th); xx += tw }; yy += th }; g.restore()
    }

    /**
     * Draw the house. `light` 0 = night … 1 = day (the windows show it, lamps glow at night). `occupied(piece)` = someone is using
     * that piece (a TV shows a picture, a bed's blanket covers its sleeper). `extra` = characters and effects to sort in.
     */
    fun draw(g: Gfx, t: Theme, time: Float, light: Float, extra: List<D> = emptyList(), occupied: (Int) -> Boolean = { false }) {
        val p = Pal(t); pal = p
        // ---- shadow and outer wall
        g.fillRound(-6f, -4f, width + 12, height + 14, 10f, Colors.withAlpha(p.cap, 0.35f))
        g.fillRect(-4f, 0f, width + 8, height + 6, p.cap)
        // ---- floors
        for (r in house.rooms) floor(g, p, r)
        for (d in house.doors) { val r = house.roomAt(d.x, d.y) ?: continue; if (d.y != r.y) g.fillRect(bx(d.x.toFloat()), by(d.y.toFloat()), T, T * K, floorColor(p, r)) }
        // ---- side walls between rooms (low, so nobody hides behind them)
        for (y in 0 until house.h) for (x in 1 until house.w) {
            val a = house.roomAt(x - 1, y); val b = house.roomAt(x, y); if (a == null || b == null || a == b) continue
            if (house.doors.any { it.y == y && (it.x == x || it.x == x - 1) } && y != a.y && y != b.y) continue
            g.fillRect(bx(x.toFloat()) - 2.5f, by(y.toFloat()), 5f, T * K, p.cap)
        }
        // ---- flat things on the floor (rugs) and the doormat
        house.pieces.forEachIndexed { i, pc -> if (pc.kind == "rug") rug(g, p, pc.x, pc.y, i) }
        val e = house.entrance; g.fillRound(bx(e.x.toFloat()) + 4, by(e.y + 1f) - T * K * 0.42f, T - 8, T * K * 0.36f, 4f, p.mat)
        // ---- R5 light layer 2: sunlight through the windows, leaning with the hour, weaker under clouds
        house.pieces.forEach { pc -> if (pc.kind == "window") windowLight(g, p, pc.x, pc.y, Furniture.kind(pc.kind).w, time) }
        // ---- back walls with what hangs on them
        for (r in house.rooms) wall(g, p, r, light)
        clock(g, p)
        house.pieces.forEachIndexed { wi, pc -> when (pc.kind) { "window" -> window(g, p, pc.x, pc.y, Furniture.kind(pc.kind).w, light, time, state(wi)); "mirror" -> mirror(g, p, pc.x, pc.y); "frame" -> photoFrame(g, p, pc.x, pc.y, state(wi))
            else -> Furniture.kind(pc.kind).takeIf { it.wall }?.let { k -> sticker(g, p, k, pc.x, pc.y) } } }
        for (d in house.doors) { val r = house.roomAt(d.x, d.y) ?: continue; if (d.y == r.y) doorway(g, p, d.x, d.y, r) }
        // ---- depth-sorted: furniture and whatever the caller adds
        val list = ArrayList<D>(extra)
        for ((k, lx, ly) in litter) list += D(ly + 0.3f) { litterThing(g, p, k, lx, ly) }
        house.pieces.forEachIndexed { i, pc ->
            val k = Furniture.kind(pc.kind); val key = pc.y + k.h.toFloat()
            /* a flipped piece is drawn as its mirror image around its own middle */
            fun m(draw: () -> Unit): () -> Unit = if (!pc.flip) draw else { { val cx = bx(pc.x + k.w / 2f); g.save(); g.translate(cx, 0f); g.scale(-1f, 1f); g.translate(-cx, 0f); draw(); g.restore() } }
            when {
                pc.kind == "rug" || pc.kind == "window" || pc.kind == "mirror" || k.wall -> {}
                pc.kind == "bed" || pc.kind == "bed2" -> { val st = state(i); list += D(key - 0.02f, m { cached(g, "bed$st", pc) { gg -> bed(gg, p, pc.x, pc.y, k.w, i, st) } })
                    list += D(key + 0.02f, m { cached(g, "blanket$st${i % 2}", pc) { gg -> blanket(gg, p, pc.x, pc.y, k.w, i, st) } }) }
                pc.kind == "tub" -> { val st = state(i); list += D(key - 0.02f) { tub(g, p, pc.x, pc.y, st, time) }; list += D(key + 0.02f) { cached(g, "tubfront", pc) { gg -> tubFront(gg, p, pc.x, pc.y) } } }
                pc.kind == "sofa" -> list += D(key - 0.02f, m { cached(g, "sofa", pc) { gg -> sofa(gg, p, pc.x, pc.y) } })
                else -> { val st = state(i); val used = occupied(i) || st == "on" || st == "cooking"
                    val still = !used && when (pc.kind) { "fridge", "shelf", "bench" -> true; "table" -> st != "food"; "tv", "stove" -> true; else -> false }
                    list += D(key, m { if (still) cached(g, "p$st", pc) { gg -> piece(gg, p, pc.kind, pc.x, pc.y, 0f, light, false, st) } else piece(g, p, pc.kind, pc.x, pc.y, time, light, used, st) }) }
            }
        }
        list.sortBy { it.key }
        for (d in list) d.draw()
        // ---- front wall (below the floor, never over anyone's feet) with the entrance gap
        g.fillRect(-4f, height, width + 8, 6f, Colors.mix(p.cap, 0xFF000000.toInt(), 0.12f))
        g.fillRect(bx(e.x.toFloat()) + 3, height - 1, T - 6, 8f, p.mat)
    }

    // ---------------- palette ----------------
    class Pal(t: Theme) {
        val dark = t.dark
        fun s(c: String): Int { val v = hex(c); return if (dark) Colors.mix(v, hex("#2A2240"), 0.42f) else v }
        val cap = s("#B98B66"); val base = s("#D9B48C"); val mat = s("#D98F6A")
        val wood = s("#C98F5E"); val woodLip = s("#A8703F"); val woodTop = s("#D9A472")
        val white = s("#FBF6EE"); val whiteLip = s("#D9D0C4"); val dk = s("#5B4A52")
        val mint = s("#8ED1B4"); val mintLip = s("#6CB596"); val coral = s("#F6B2A8"); val coralLip = s("#E08F84"); val sky = s("#9DC8EE"); val skyLip = s("#7AAAD6")
        val water = s("#A8DCEF"); val leaf = s("#7CC48A"); val leafLip = s("#5EA56E"); val pot = s("#D9774E"); val glass = s("#CFE9F3")
        val sun = s("#FFE29A"); val night = s("#3A4A7A"); val shade = s("#FBE3A8")
        val ink = t.ink; val ink2 = t.ink2
    }
    private fun floorColor(p: Pal, r: Room) = when (r.kind) {
        RoomKind.BATH -> p.s("#DCEFF1"); RoomKind.KITCHEN -> p.s("#F3E3C3"); RoomKind.BALCONY -> p.s("#CDAA84"); RoomKind.BEDROOM -> p.s("#EBCFA8")
        RoomKind.YARD -> p.s("#A9D68E"); RoomKind.STUDY -> p.s("#D9B48C"); RoomKind.DINING -> p.s("#EFD2A6"); else -> p.s("#E9C9A0")
    }
    private fun wallColor(p: Pal, r: Room) = when (r.kind) {
        RoomKind.BATH -> p.s("#CBE6EC"); RoomKind.KITCHEN -> p.s("#F7E7BC"); RoomKind.BEDROOM -> p.s("#F3D6D6"); RoomKind.BALCONY, RoomKind.YARD -> p.s("#BFE3F2")
        RoomKind.STUDY -> p.s("#DCE6D2"); RoomKind.DINING -> p.s("#F8DFC8"); else -> p.s("#F6E0C2")
    }

    // ---------------- rooms ----------------
    private fun floor(g: Gfx, p: Pal, r: Room) {
        val x = bx(r.x.toFloat()); val y = by(r.y + 1f); val w = r.w * T; val h = (r.h - 1) * T * K; val c = floorColor(p, r)
        floors[r.id]?.let { img -> tile(g, img, x, y, w, h, T * 1.5f, T * 1.5f * K); g.fillRect(x, y, w, 3f, Colors.withAlpha(0xFF000000.toInt(), 0.08f)); return }
        g.fillRect(x, y, w, h, c)
        val line = Colors.mix(c, 0xFF000000.toInt(), 0.07f)
        when (r.kind) {
            RoomKind.BATH, RoomKind.KITCHEN -> {   /* tiles */
                for (i in 1 until r.w) g.fillRect(x + i * T - 0.5f, y, 1f, h, line)
                for (j in 1 until r.h - 1) g.fillRect(x, y + j * T * K - 0.5f, w, 1f, line)
                if (r.kind == RoomKind.KITCHEN) for (j in 0 until r.h - 1) for (i in 0 until r.w) if ((i + j) % 2 == 0) g.fillRect(x + i * T, y + j * T * K, T, T * K, Colors.withAlpha(line, 0.35f))
            }
            RoomKind.YARD -> {   /* grass with a few tufts */
                for (j in 0 until r.h - 1) for (i in 0 until r.w) if ((i * 7 + j * 3) % 5 == 0) { val gx = x + i * T + T * 0.3f; val gy = y + j * T * K + T * K * 0.6f
                    g.line(gx, gy, gx - 2, gy - 5, 1.5f, line); g.line(gx + 3, gy, gx + 3, gy - 6, 1.5f, line); g.line(gx + 6, gy, gx + 8, gy - 5, 1.5f, line) }
            }
            else -> {   /* planks */
                val ph = T * K / 2; var j = 0; var yy = y
                while (yy < y + h - 0.5f) { g.fillRect(x, yy + ph - 0.5f, w, 1f, line); val off = if (j % 2 == 0) 0f else T * 0.9f
                    var xx = x + off + T * 1.8f; while (xx < x + w) { g.fillRect(xx, yy, 1f, ph, line); xx += T * 1.8f }; yy += ph; j++ }
            }
        }
        g.fillRect(x, y, w, 3f, Colors.withAlpha(0xFF000000.toInt(), 0.06f))   /* soft shadow under the back wall */
    }
    private fun wall(g: Gfx, p: Pal, r: Room, light: Float) {
        val x = bx(r.x.toFloat()); val y = by(r.y.toFloat()); val w = r.w * T; val h = T * K; val c = wallColor(p, r)
        if (r.kind == RoomKind.YARD) {   /* open air: sky and a picket fence */
            g.fillRect(x, y, w, h, Colors.mix(p.night, p.water, light))
            var xx = x + 3; while (xx < x + w) { g.fillRound(xx, y + h * 0.3f, 6f, h * 0.7f, 3f, p.white); xx += 10 }; g.fillRect(x, y + h * 0.5f, w, 3f, p.whiteLip); return
        }
        if (r.kind == RoomKind.BALCONY) {   /* open air: sky and a railing */
            g.fillRect(x, y, w, h, Colors.mix(p.night, p.water, light))
            g.fillRect(x, y + h - 5, w, 5f, p.white); var xx = x + 4; while (xx < x + w) { g.fillRect(xx, y + h * 0.35f, 2.5f, h * 0.65f, p.white); xx += 7 }
            g.fillRect(x, y + h * 0.33f, w, 3f, p.white); return
        }
        walls[r.id]?.let { img -> tile(g, img, x, y, w, h, h, h); g.fillRect(x, y + h - 4, w, 4f, p.base); g.fillRect(x, y - 3, w, 4f, p.cap); return }
        g.fillRect(x, y, w, h, c)
        var xx = x + 6; while (xx < x + w) { g.fillRect(xx, y, 2f, h, Colors.withAlpha(Colors.mix(c, 0xFFFFFFFF.toInt(), 0.5f), 0.6f)); xx += 12 }
        g.fillRect(x, y + h - 4, w, 4f, p.base)
        g.fillRect(x, y - 3, w, 4f, p.cap)
    }
    private fun doorway(g: Gfx, p: Pal, tx: Int, ty: Int, r: Room) {
        val x = bx(tx.toFloat()) + 4; val y = by(ty.toFloat()); val w = T - 8; val h = T * K
        g.fillRect(x - 2, y - 3, w + 4, h + 3, p.cap); g.fillRect(x, y, w, h, floorColor(p, house.roomAt(tx, ty - 1) ?: r))
        g.fillRect(x, y + h - 2, w, 2f, Colors.withAlpha(0xFF000000.toInt(), 0.08f))
    }
    private fun window(g: Gfx, p: Pal, tx: Int, ty: Int, tw: Int, light: Float, time: Float = 0f, st: String = "") {
        val x = bx(tx.toFloat()) + 5; val y = by(ty.toFloat()) + 3; val w = tw * T - 10; val h = T * K - 9
        g.fillRound(x - 2, y - 2, w + 4, h + 4, 4f, p.white)
        g.fillRect(x, y, w, h, Colors.mix(p.night, p.water, light))
        if (light > 0.5f) g.fillCircle(x + w * 0.75f, y + h * 0.35f, h * 0.16f, Colors.withAlpha(p.sun, light)) else g.fillCircle(x + w * 0.72f, y + h * 0.32f, h * 0.13f, p.shade)
        if (weather == "rain") for (k in 0 until 5) { val rx = x + (k * 0.21f + 0.08f) * w; val ry = y + ((time * 30 + k * 7) % h); g.line(rx, ry, rx - 1, ry + 4, 1f, Colors.withAlpha(p.white, 0.7f)) }
        g.fillRect(x + w / 2 - 1, y, 2f, h, p.white); g.fillRect(x, y + h / 2 - 1, w, 2f, p.white)
        /* curtains: drawn closed at night (R5), open by day and moving a little in the draught */
        val sway = if (calm || st == "closed") 0f else kotlin.math.sin(time * 1.4f) * 1.6f
        val cw = if (st == "closed") w * 0.52f else w * 0.16f
        g.fillRound(x - 4, y - 3, cw + sway, h + 5, 3f, p.coral); g.fillRound(x + w - cw + 4 - sway, y - 3, cw + sway, h + 5, 3f, p.coral)
        for (k in 1..2) { g.fillRect(x - 4 + cw * k / 3 + sway * 0.5f, y - 2, 1f, h + 3, p.coralLip); g.fillRect(x + w + 4 - cw * k / 3 - sway * 0.5f, y - 2, 1f, h + 3, p.coralLip) }
        g.fillRect(x - 6, y - 5, w + 12, 2.5f, p.woodLip)   /* rail */
    }
    /** R5: the patch of sun a window throws on the floor — leans east in the morning and west in the afternoon; dust floats in it */
    private fun windowLight(g: Gfx, p: Pal, tx: Int, ty: Int, tw: Int, time: Float) {
        val sunK = when { hour < 7 || hour > 17.5 -> 0f; hour < 8.5 -> ((hour - 7) / 1.5).toFloat(); hour > 16 -> ((17.5 - hour) / 1.5).toFloat(); else -> 1f }
        val wk = when (weather) { "sunny" -> 1f; "cloudy" -> 0.45f; "snow" -> 0.55f; "fog" -> 0.3f; else -> 0.2f }
        val a = 0.34f * sunK * wk; if (a < 0.02f) return
        val lean = ((hour - 12) / 5.5).toFloat().coerceIn(-1f, 1f) * T * -1.1f
        val x0 = bx(tx.toFloat()) + 6; val w = tw * T - 12; val y0 = by(ty + 1f); val rows = 10; val depth = T * K * 2.4f
        for (r in 0 until rows) { val k = r / rows.toFloat(); g.fillRect(x0 + lean * k, y0 + depth * k, w * (1f - 0.15f * k), depth / rows + 0.5f, Colors.withAlpha(p.sun, a * (1f - 0.55f * k))) }
        if (!calm) for (d in 0 until 6) { val ph = d * 1.7f + tx; val px = x0 + w * (((d * 37) % 10) / 10f) + lean * 0.5f + kotlin.math.sin(time * 0.4f + ph) * 4; val py = y0 + depth * ((time * 0.05f + d * 0.17f) % 1f)
            g.fillCircle(px, py - 10, 0.9f, Colors.withAlpha(p.white, a * 2.4f)) }
    }
    /** R5: a wall clock in the first room with a free stretch of wall; its hands follow the game time */
    private fun clock(g: Gfx, p: Pal) {
        val r = house.rooms.firstOrNull { rr -> rr.kind != RoomKind.YARD && rr.kind != RoomKind.BALCONY && rr.kind != RoomKind.BATH && house.pieces.none { pc -> pc.y == rr.y && (pc.kind == "window" || pc.kind == "mirror" || Furniture.kind(pc.kind).wall) && pc.x <= rr.x + rr.w / 2 && pc.x + Furniture.kind(pc.kind).w > rr.x + rr.w / 2 - 1 } } ?: return
        val cx = bx(r.x + r.w / 2f); val cy = by(r.y.toFloat()) + T * K * 0.42f; val rr = T * 0.22f
        g.fillCircle(cx, cy + 1.5f, rr + 1.5f, Colors.withAlpha(0xFF000000.toInt(), 0.12f)); g.fillCircle(cx, cy, rr + 1.5f, p.woodLip); g.fillCircle(cx, cy, rr, p.white)
        for (k in 0 until 4) { val an = k * Math.PI.toFloat() / 2; g.fillCircle(cx + kotlin.math.cos(an) * rr * 0.78f, cy + kotlin.math.sin(an) * rr * 0.78f, 0.8f, p.ink2) }
        val hA = ((hour % 12) / 12 * 2 * Math.PI - Math.PI / 2).toFloat(); val mA = ((hour % 1) * 2 * Math.PI - Math.PI / 2).toFloat()
        g.line(cx, cy, cx + kotlin.math.cos(hA) * rr * 0.5f, cy + kotlin.math.sin(hA) * rr * 0.5f, 1.6f, p.dk); g.line(cx, cy, cx + kotlin.math.cos(mA) * rr * 0.78f, cy + kotlin.math.sin(mA) * rr * 0.78f, 1.1f, p.dk)
        g.fillCircle(cx, cy, 1.2f, p.coral)
    }
    /** R5: what was left on the floor */
    private fun litterThing(g: Gfx, p: Pal, kind: String, tx: Int, ty: Int) {
        val cx = bx(tx + 0.5f) + ((tx * 7 + ty * 3) % 5 - 2) * 2f; val cy = by(ty + 0.62f)
        g.fillRound(cx - 6, cy + 1, 12f, 3f, 1.5f, Colors.withAlpha(0xFF000000.toInt(), 0.1f))
        when (kind) {
            "book" -> { g.fillRound(cx - 6, cy - 4, 12f, 7f, 1.5f, p.sky); g.fillRect(cx - 5, cy - 3, 10f, 1.2f, p.white); g.fillRect(cx - 0.5f, cy - 4, 1f, 7f, p.skyLip) }
            "cup" -> { g.fillRound(cx - 3.5f, cy - 6, 7f, 7f, 2f, p.white); g.fillRect(cx - 3, cy - 5.5f, 6f, 1.6f, p.s("#8A5A3A")); g.strokeRound(cx + 3, cy - 5, 3f, 3.5f, 1.5f, 1f, p.white) }
            else -> { g.fillRound(cx - 5, cy - 3, 10f, 5f, 2f, p.coral); g.line(cx - 5, cy - 0.5f, cx - 7, cy - 2, 1f, p.coralLip); g.line(cx + 5, cy - 0.5f, cx + 7, cy + 1, 1f, p.coralLip); g.fillRect(cx - 2, cy - 2, 4f, 1.2f, p.white) }
        }
    }
    /** R5: wood grain on a top surface, and the light catching its edge */
    private fun grain(g: Gfx, p: Pal, x: Float, y: Float, w: Float, h: Float) {
        val c = Colors.withAlpha(p.woodLip, 0.28f); var k = 0
        while (k * 4f < h - 2) { val yy = y + 2 + k * 4f; val off = ((k * 13) % 7) * 2f; g.fillRect(x + 3 + off, yy, w - 8 - off * 1.5f, 0.8f, c); k++ }
        g.fillRect(x + 2, y + 1, w - 4, 1.2f, Colors.withAlpha(p.white, 0.35f))
    }
    /** a sticker on the back wall (the player's own picture) */
    private fun sticker(g: Gfx, p: Pal, k: app.ocshimeji.sim.house.FurnitureKind, tx: Int, ty: Int) {
        val img = k.image.takeIf { it.isNotBlank() }?.let { itemImg(it) }; val x = bx(tx.toFloat()) + 4; val y = by(ty.toFloat()) + 4; val w = k.w * T - 8; val h = T * K - 10
        if (img == null) { g.fillRound(x, y, w, h, 6f, p.sun); return }
        val sc = minOf(w / img.w, h / img.h); g.image(img, x + (w - img.w * sc) / 2, y + (h - img.h * sc) / 2, img.w * sc, img.h * sc)
    }
    /** 1.9.0 G-08: a wooden frame with your latest photo in it ("people:hour:filter"; empty = waiting for a photo) */
    private fun photoFrame(g: Gfx, p: Pal, tx: Int, ty: Int, st: String) {
        val cx = bx(tx + 0.5f); val y = by(ty - 1f) + 8; val w = T * 0.78f; val h = T * K * 0.62f
        g.fillRound(cx - w / 2 - 3, y - 3, w + 6, h + 6, 3f, p.s("#B07A50")); g.fillRect(cx - w / 2, y, w, h, p.s("#FFFDF4"))
        val parts = st.split(":"); if (parts.size < 3) { g.fillCircle(cx, y + h / 2, 3f, p.s("#E8D6B8")); return }
        val n = parts[0].toIntOrNull() ?: 1; val hr = parts[1].toIntOrNull() ?: 12; val night = hr < 6 || hr >= 19
        var sky = if (night) p.s("#3A4A7A") else p.s("#BFE2F4"); var ground = p.s("#E2C49E")
        when (parts[2]) { "mono" -> { sky = p.s("#B8B8B8"); ground = p.s("#8E8E8E") }; "warm", "retro" -> { sky = Colors.mix(sky, p.s("#F2B880"), 0.4f); ground = Colors.mix(ground, p.s("#C08050"), 0.3f) }; "dream" -> sky = Colors.mix(sky, p.s("#F4C8E0"), 0.5f) }
        g.fillRect(cx - w / 2 + 2, y + 2, w - 4, h * 0.6f, sky); g.fillRect(cx - w / 2 + 2, y + 2 + h * 0.6f, w - 4, h * 0.4f - 4, ground)
        val cols = listOf("#F2A65A", "#7AAAD6", "#E08A9A", "#8CC48A", "#C8A0E0", "#F0C850")
        for (i in 0 until n.coerceIn(1, 6)) { val px = cx - w / 2 + (i + 1) * w / (n.coerceIn(1, 6) + 1); g.fillCircle(px, y + h * 0.62f, 3.2f, p.s(cols[i % cols.size])); g.fillRound(px - 2.6f, y + h * 0.66f, 5.2f, 6f, 2f, p.s(cols[i % cols.size])) }
    }
    private fun mirror(g: Gfx, p: Pal, tx: Int, ty: Int) {
        val cx = bx(tx + 0.5f); val y = by(ty - 1f) + 3; val h = T * K - 9; val w = T * 0.55f
        g.fillRound(cx - w / 2 - 2, y - 2, w + 4, h + 4, w / 2, p.s("#E8C27A")); g.fillRound(cx - w / 2, y, w, h, w / 2, p.glass)
        g.line(cx - w * 0.2f, y + h * 0.25f, cx + w * 0.05f, y + h * 0.05f, 2f, Colors.withAlpha(0xFFFFFFFF.toInt(), 0.8f))
    }

    // ---------------- furniture ----------------
    /** a box standing on tiles (x, y, w × d) `h` dp tall: front face then top */
    private fun box(g: Gfx, x: Float, y: Float, w: Float, d: Float, h: Float, top: Int, front: Int, inset: Float = 3f, r: Float = 4f) {
        val X = bx(x) + inset; val W = w * T - inset * 2; val yb = by(y + d)
        g.fillRound(X, yb - h - 2, W, h + 2, r, front)
        g.fillRound(X, by(y) - h + inset * 0.6f, W, (yb - by(y)) - inset * 0.6f, r, top)
    }
    private fun piece(g: Gfx, p: Pal, kind: String, x: Int, y: Int, time: Float, light: Float, used: Boolean, st: String = "") {
        val fx = x.toFloat(); val fy = y.toFloat()
        when (kind) {
            "fridge" -> { box(g, fx, fy, 1f, 1f, 44f, p.white, p.whiteLip); g.fillRect(bx(fx) + 6, by(fy + 1) - 26, T - 12, 1.5f, p.whiteLip); g.fillRound(bx(fx) + T - 10, by(fy + 1) - 40, 2.5f, 10f, 1f, p.ink2)
                g.fillRect(bx(fx) + 7, by(fy + 1) - 44, 2f, 16f, Colors.withAlpha(0xFFFFFFFF.toInt(), 0.7f)); g.fillCircle(bx(fx) + 12, by(fy + 1) - 34, 2.2f, p.coral); g.fillCircle(bx(fx) + 17, by(fy + 1) - 36, 1.8f, p.sky) }   /* shine and two magnets */
            "stove" -> { box(g, fx, fy, 1f, 1f, 22f, p.s("#E7E2DA"), p.whiteLip)
                val ty = by(fy) - 22 + T * K * 0.5f; g.fillCircle(bx(fx + 0.32f), ty, T * 0.12f, p.dk); g.fillCircle(bx(fx + 0.7f), ty, T * 0.12f, p.dk)
                if (used) { g.fillCircle(bx(fx + 0.32f), ty, T * 0.07f, p.coral); g.fillCircle(bx(fx + 0.5f) + kotlin.math.sin(time * 3) * 2, by(fy) - 34 - (time * 8) % 10, 3f, Colors.withAlpha(p.white, 0.7f)) }
                g.fillRound(bx(fx) + 7, by(fy + 1) - 14, T - 14, 8f, 2f, p.dk) }
            "table" -> { val X = bx(fx) + 3; val W = 2 * T - 6
                for (sx in listOf(0.5f, 1.5f)) { g.fillRound(bx(fx + sx) - T * 0.22f, by(fy + 1.5f) - 9, T * 0.44f, 9f, 3f, p.woodLip) }   /* stools in front */
                g.fillRect(X + 4, by(fy + 1) - 16, 4f, 16f, p.woodLip); g.fillRect(X + W - 8, by(fy + 1) - 16, 4f, 16f, p.woodLip)
                g.fillRound(X, by(fy) - 16 + 3, W, T * K - 3, 5f, p.woodTop); grain(g, p, X, by(fy) - 13, W, T * K - 4); g.fillRect(X, by(fy + 1) - 18, W, 4f, p.wood)
                val ty0 = by(fy + 0.5f) - 16
                when (st) {
                    "food" -> for (sx in listOf(0.5f, 1.5f)) { val cx = bx(fx + sx); g.fillCircle(cx, ty0, T * 0.17f, p.white); g.fillCircle(cx, ty0, T * 0.11f, p.s("#E9A15A")); g.fillCircle(cx - 2, ty0 - 1, T * 0.05f, p.leaf)
                        if (!calm) g.fillCircle(cx + kotlin.math.sin(time * 2 + sx) * 1.5f, ty0 - 8 - (time * 6 + sx * 5) % 8, 1.6f, Colors.withAlpha(p.white, 0.6f)) }
                    "dishes" -> { for (k in 0 until 3) g.fillCircle(X + W * 0.35f, ty0 + 1 - k * 1.6f, T * 0.15f, if (k % 2 == 0) p.white else p.whiteLip); g.fillCircle(X + W * 0.7f, ty0, T * 0.14f, p.white)
                        g.fillCircle(X + W * 0.68f, ty0 - 1, 1.2f, p.s("#C08040")); g.fillCircle(X + W * 0.73f, ty0 + 1, 1f, p.s("#C08040")) }
                    else -> g.fillCircle(X + W / 2, ty0, T * 0.14f, p.white)
                } }
            "tv" -> { box(g, fx, fy, 1f, 1f, 12f, p.woodTop, p.wood); grain(g, p, bx(fx) + 3, by(fy) - 10, T - 6, T * K - 4)
                val X = bx(fx) + 4; val W = T - 8; val sy = by(fy) - 12 - 20; g.fillRound(X, sy, W, 20f, 3f, p.dk)
                g.fillRound(X + 2, sy + 2, W - 4, 16f, 2f, if (used) Colors.mix(p.sky, p.sun, (kotlin.math.sin(time * 1.7f) + 1) / 2) else p.s("#3B3550")) }
            "shelf" -> { box(g, fx, fy, 1f, 1f, 40f, p.woodTop, p.wood)
                val X = bx(fx) + 6; val cols = listOf(p.coral, p.sky, p.mint, p.sun, p.coralLip)
                for (row in 0 until 3) { val ry = by(fy + 1) - 38 + row * 12f; var xx = X; var i = row; while (xx < bx(fx) + T - 9) { if (!(st == "out" && row == 1 && i in 2..3)) g.fillRect(xx, ry, 3.5f, 9f, cols[i % cols.size]); xx += 4.5f; i++ }; g.fillRect(bx(fx) + 4, ry + 9, T - 8, 1.5f, p.woodLip) }
                if (st == "out") { val bx0 = bx(fx) + 8; val by0 = by(fy + 1) - 42; g.fillRound(bx0, by0 - 3, 11f, 4f, 1f, p.coral); g.fillRect(bx0 + 1, by0 - 2, 9f, 1f, p.white) } }   /* a gap, and the book lying on top */
            "plant" -> { val cx = bx(fx + 0.5f); val yb = by(fy + 1) - 2; g.fillRound(cx - T * 0.22f, yb - 14, T * 0.44f, 14f, 4f, p.pot)
                val stage = plantStage(x, y); val sway = kotlin.math.sin(time * 1.3f + x) * 1.5f
                val k = when (stage) { 0 -> 0.45f; 1 -> 0.75f; else -> 1f }; val droop = if (stage < 0) 5f else 0f
                val leaf = if (stage < 0) p.s("#B8B070") else p.leaf; val lip = if (stage < 0) p.s("#9A9258") else p.leafLip
                g.fillCircle(cx - 6 * k + sway, yb - 22 * k + droop, 8f * k, lip); g.fillCircle(cx + 6 * k + sway, yb - 24 * k + droop, 8f * k, lip); g.fillCircle(cx + sway, yb - 30 * k + droop, 9f * k, leaf); g.fillCircle(cx - 4 * k + sway, yb - 22 * k + droop, 6f * k, leaf)
                if (stage >= 3) for ((dx, dy) in listOf(-6f to -30f, 6f to -33f, 1f to -38f)) { g.fillCircle(cx + dx + sway, yb + dy, 3.2f, p.coral); g.fillCircle(cx + dx + sway, yb + dy, 1.3f, p.sun) } }
            "lantern" -> { val cx = bx(fx + 0.5f); val yb = by(fy + 1) - 4; if (light < 0.6f) g.fillCircle(cx, yb - 18, 22f, Colors.withAlpha(p.sun, (0.6f - light) * 0.6f))
                g.fillRect(cx - 1, yb - 4, 2f, 4f, p.woodLip); g.fillRound(cx - 9, yb - 26, 18f, 22f, 8f, p.coral); g.fillRect(cx - 9, yb - 17, 18f, 2f, p.coralLip); g.fillRound(cx - 5, yb - 29, 10f, 4f, 2f, p.woodLip) }
            "lamp" -> { val cx = bx(fx + 0.5f); val yb = by(fy + 1) - 4; val on = if (st.isEmpty()) light < 0.6f else st == "on"
                if (on) { for (k in 4 downTo 1) g.fillCircle(cx, yb - 40, 14f + k * 12f, Colors.withAlpha(p.sun, 0.07f)); g.fillRound(cx - 34, yb - 6, 68f, 14f, 7f, Colors.withAlpha(p.sun, 0.18f)) }   /* R5 light layer 3: a warm pool */
                g.fillRound(cx - 6, yb - 3, 12f, 4f, 2f, p.ink2); g.fillRect(cx - 1, yb - 38, 2f, 36f, p.ink2); g.fillRound(cx - 9, yb - 48, 18f, 13f, 4f, if (on) p.sun else p.shade)
                g.fillRect(cx - 7, yb - 46, 14f, 1.5f, Colors.withAlpha(p.white, 0.5f)) }
            "garden" -> { val X = bx(fx) + 3; val W = 2 * T - 6; val yb = by(fy + 1)
                g.fillRound(X, by(fy) - 6, W, yb - by(fy) + 4, 5f, p.woodLip); g.fillRound(X + 3, by(fy) - 3, W - 6, yb - by(fy) - 4, 4f, p.s("#8A5A3A"))
                for (k in 0 until 4) { val cx = X + 8 + k * (W - 16) / 3; val sway = kotlin.math.sin(time * 1.5f + k) * 1.2f
                    g.line(cx, yb - 8, cx + sway, yb - 18, 2f, p.leafLip); g.fillCircle(cx - 3 + sway, yb - 18, 3.5f, p.leaf); g.fillCircle(cx + 3 + sway, yb - 20, 3.5f, p.leaf)
                    if (k % 2 == 0) g.fillCircle(cx + sway, yb - 14, 2.5f, p.coral) } }
            "line" -> { val X = bx(fx) + 4; val W = 2 * T - 8; val yb = by(fy + 1) - 2
                g.fillRect(X, yb - 34, 3f, 34f, p.woodLip); g.fillRect(X + W - 3, yb - 34, 3f, 34f, p.woodLip); g.line(X + 2, yb - 32, X + W - 2, yb - 32, 1.5f, p.ink2)
                val cs = listOf(p.sky, p.coral, p.sun); for (k in 0 until 3) { val cx = X + 10 + k * (W - 20) / 2; val sw = kotlin.math.sin(time * 2f + k) * 1.5f
                    g.fillRound(cx - 7 + sw, yb - 32, 14f, 15f, 3f, cs[k]) } }
            "bench" -> { val X = bx(fx) + 3; val W = 2 * T - 6; val yb = by(fy + 1)
                g.fillRect(X + 4, yb - 12, 3f, 12f, p.woodLip); g.fillRect(X + W - 7, yb - 12, 3f, 12f, p.woodLip)
                g.fillRound(X, by(fy) - 20, W, 6f, 2f, p.wood); g.fillRound(X, yb - 16, W, 7f, 2f, p.woodTop); grain(g, p, X, yb - 16, W, 7f) }
            else -> { val k = Furniture.kind(kind); val img = k.image.takeIf { it.isNotBlank() }?.let { itemImg(it) }
                if (img != null) { val W = k.w * T - 4; val H = k.h * T * K + T * 0.8f; val sc = minOf(W / img.w, H / img.h); val iw = img.w * sc; val ih = img.h * sc
                    g.fillRound(bx(fx) + 4, by(fy + k.h) - 6, k.w * T - 8, 6f, 3f, Colors.withAlpha(0xFF000000.toInt(), 0.12f))
                    g.image(img, bx(fx + k.w / 2f) - iw / 2, by(fy + k.h) - ih - 2, iw, ih) }
                else box(g, fx, fy, k.w.toFloat(), k.h.toFloat(), 14f, p.woodTop, p.wood) }
        }
    }
    private fun blanketColor(p: Pal, i: Int) = if (i % 2 == 0) p.coral to p.coralLip else p.sky to p.skyLip
    private fun bed(g: Gfx, p: Pal, x: Int, y: Int, w: Int, i: Int, st: String = "") {
        val X = bx(x.toFloat()) + 3; val W = w * T - 6; val top = by(y.toFloat()) - 10; val yb = by(y + 2f)
        g.fillRound(X - 1, top - 10, W + 2, 14f, 5f, p.woodLip)   /* headboard */
        g.fillRound(X, yb - 12, W, 12f, 4f, p.wood); g.fillRound(X, top, W, yb - 12 - top + 2, 5f, p.white)
        val tilt = if (st == "messy") 4f else 0f
        for (k in 0 until w) g.fillRound(bx(x + k + 0.5f) - T * 0.32f + tilt, top + 4 + tilt * 0.4f, T * 0.64f, T * K * 0.34f, 6f, Colors.mix(p.white, p.sky, 0.25f))
        g.fillRect(X + 2, yb - 10, W - 4, 1.2f, Colors.withAlpha(p.white, 0.3f))
    }
    private fun blanket(g: Gfx, p: Pal, x: Int, y: Int, w: Int, i: Int, st: String = "") {
        val X = bx(x.toFloat()) + 3; val W = w * T - 6; val yb = by(y + 2f) - 12; val bt = by(y + 1.05f) - 10; val (c, l) = blanketColor(p, i)
        if (st == "messy") {   /* R5: thrown back after getting up — folded down, crumpled, a corner hanging off */
            val mt = bt + (yb - bt) * 0.42f
            g.fillRound(X, mt + 3, W, yb - mt, 5f, l); g.fillRound(X - 2, mt, W + 3, yb - mt - 2, 6f, c)
            for (k in 1..3) g.line(X + W * k / 4f, mt + 3, X + W * k / 4f + 3, yb - 6, 1f, l)
            g.fillRound(X + W - 6, yb - 8, 9f, 12f, 3f, c); g.fillRound(X + 2, mt - 3, W - 4, 6f, 3f, Colors.mix(c, p.white, 0.35f)); return
        }
        g.fillRound(X, bt + 3, W, yb - bt, 5f, l); g.fillRound(X, bt, W, yb - bt - 2, 5f, c)
        g.fillRect(X + 2, bt + 5, W - 4, 2f, Colors.withAlpha(p.white, 0.55f))
        var sx = X + 6f; while (sx < X + W - 4) { g.fillRect(sx, bt + 8, 1f, yb - bt - 12, Colors.withAlpha(l, 0.45f)); sx += 7f }   /* fabric stripes */
    }
    private fun tub(g: Gfx, p: Pal, x: Int, y: Int, st: String = "", time: Float = 0f) {
        val X = bx(x.toFloat()) + 3; val W = 2 * T - 6; val top = by(y.toFloat()) - 14; val yb = by(y + 1f)
        g.fillRound(X, top, W, yb - top, 9f, p.white)
        if (st == "dry") { g.fillRound(X + 4, top + 3, W - 8, yb - top - 16, 7f, p.s("#E6F1F4")); g.fillCircle(X + W * 0.8f, top + 8, 1.6f, p.whiteLip); return }
        g.fillRound(X + 4, top + 3, W - 8, yb - top - 16, 7f, p.water)
        if (st == "full") for (k in 0 until 7) { val bxp = X + 8 + k * (W - 16) / 6; val bob = if (calm) 0f else kotlin.math.sin(time * 2 + k) * 1f; g.fillCircle(bxp, top + 6 + bob + (k % 2) * 2, 3.2f + (k % 3), Colors.withAlpha(0xFFFFFFFF.toInt(), 0.9f)) }   /* bubbles */
    }
    private fun tubFront(g: Gfx, p: Pal, x: Int, y: Int) {
        val X = bx(x.toFloat()) + 3; val W = 2 * T - 6; val yb = by(y + 1f)
        g.fillRound(X, yb - 16, W, 16f, 6f, p.whiteLip); g.fillRound(X, yb - 18, W, 13f, 6f, p.white)
    }
    private fun sofa(g: Gfx, p: Pal, x: Int, y: Int) {
        val X = bx(x.toFloat()) + 2; val W = 2 * T - 4; val yb = by(y + 1f)
        g.fillRound(X, by(y.toFloat()) - 22, W, 18f, 7f, p.mintLip)                       /* back */
        g.fillRound(X, yb - 14, W, 14f, 5f, p.mintLip); g.fillRound(X + 2, by(y.toFloat()) - 8, W - 4, yb - by(y.toFloat()) - 4, 6f, p.mint)   /* seat */
        g.fillRound(X - 2, by(y.toFloat()) - 12, 8f, yb - by(y.toFloat()) + 10, 4f, p.mintLip); g.fillRound(X + W - 6, by(y.toFloat()) - 12, 8f, yb - by(y.toFloat()) + 10, 4f, p.mintLip)
    }
    private fun rug(g: Gfx, p: Pal, x: Int, y: Int, i: Int) {
        val X = bx(x.toFloat()) + 4; val Y = by(y.toFloat()) + 4; val W = 2 * T - 8; val H = 2 * T * K - 8
        g.fillRound(X, Y, W, H, H / 2, if (i % 2 == 0) p.s("#F4C7A0") else p.s("#C9B8E8")); g.strokeRound(X + 4, Y + 4, W - 8, H - 8, (H - 8) / 2, 2f, Colors.withAlpha(p.white, 0.7f))
    }

    companion object {
        /** seat heights in dp at T = 32 (scaled with T): how high someone sits on each piece */
        fun seat(kind: String?): Float = when (kind) { "sofa" -> 9f; "table" -> 8f; "bed", "bed2" -> 10f; "tub" -> 2f; else -> 0f }
    }
}

/**
 * 1.5.1 (plan R5 V1): pictures of still furniture, one per look and per zoom bucket (half-pixel steps of the screen's pixels per dp),
 * so zooming in redraws once at the sharper size instead of blurring. Least recently used pictures go first above 64 MB.
 */
object PieceCache {
    const val MAX_BYTES = 64L shl 20
    private class E(val img: Img, val bytes: Long)
    private val map = LinkedHashMap<String, E>(64, 0.75f, true)
    var bytes = 0L; private set
    var hits = 0; private set
    var misses = 0; private set
    val size get() = map.size
    fun bucket(px: Float) = (kotlin.math.ceil(px * 2.0) / 2.0).coerceIn(0.5, 10.0).toFloat()
    /** false = this backend can't draw off screen (draw it directly) */
    fun draw(g: Gfx, key: String, x0: Float, y0: Float, w: Float, h: Float, paint: (Gfx) -> Unit): Boolean {
        val ppd = g.pxPerDp(); if (ppd <= 0f) return false
        val b = bucket(ppd); val k = "$key@$b"
        val e = map[k]?.also { hits++ } ?: run {
            val wp = kotlin.math.ceil(w * b).toInt(); val hp = kotlin.math.ceil(h * b).toInt()
            val img = g.offscreen(wp, hp) { og -> og.scale(b, b); og.translate(-x0, -y0); paint(og) } ?: return false
            misses++; E(img, wp * hp * 4L).also { map[k] = it; bytes += it.bytes; trim() }
        }
        g.image(e.img, x0, y0, w, h); return true
    }
    private fun trim() { val it = map.entries.iterator(); while (bytes > MAX_BYTES && it.hasNext()) { val n = it.next(); bytes -= n.value.bytes; it.remove() } }
    fun clear() { map.clear(); bytes = 0; hits = 0; misses = 0 }
}
