package app.ocshimeji.ui

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

    /**
     * Draw the house. `light` 0 = night … 1 = day (the windows show it, lamps glow at night). `occupied(piece)` = someone is using
     * that piece (a TV shows a picture, a bed's blanket covers its sleeper). `extra` = characters and effects to sort in.
     */
    fun draw(g: Gfx, t: Theme, time: Float, light: Float, extra: List<D> = emptyList(), occupied: (Int) -> Boolean = { false }) {
        val p = Pal(t)
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
        // ---- back walls with what hangs on them
        for (r in house.rooms) wall(g, p, r, light)
        house.pieces.forEachIndexed { _, pc -> when (pc.kind) { "window" -> window(g, p, pc.x, pc.y, Furniture.kind(pc.kind).w, light); "mirror" -> mirror(g, p, pc.x, pc.y) } }
        for (d in house.doors) { val r = house.roomAt(d.x, d.y) ?: continue; if (d.y == r.y) doorway(g, p, d.x, d.y, r) }
        // ---- depth-sorted: furniture and whatever the caller adds
        val list = ArrayList<D>(extra)
        house.pieces.forEachIndexed { i, pc ->
            val k = Furniture.kind(pc.kind); val key = pc.y + k.h.toFloat()
            when (pc.kind) {
                "rug", "window", "mirror" -> {}
                "bed", "bed2" -> { list += D(key - 0.02f) { bed(g, p, pc.x, pc.y, k.w, i) }; list += D(key + 0.02f) { blanket(g, p, pc.x, pc.y, k.w, i) } }
                "tub" -> { list += D(key - 0.02f) { tub(g, p, pc.x, pc.y) }; list += D(key + 0.02f) { tubFront(g, p, pc.x, pc.y) } }
                "sofa" -> list += D(key - 0.02f) { sofa(g, p, pc.x, pc.y) }
                else -> list += D(key) { piece(g, p, pc.kind, pc.x, pc.y, time, light, occupied(i)) }
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
        private val dark = t.dark
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
        RoomKind.BATH -> p.s("#DCEFF1"); RoomKind.KITCHEN -> p.s("#F3E3C3"); RoomKind.BALCONY -> p.s("#CDAA84"); RoomKind.BEDROOM -> p.s("#EBCFA8"); else -> p.s("#E9C9A0")
    }
    private fun wallColor(p: Pal, r: Room) = when (r.kind) {
        RoomKind.BATH -> p.s("#CBE6EC"); RoomKind.KITCHEN -> p.s("#F7E7BC"); RoomKind.BEDROOM -> p.s("#F3D6D6"); RoomKind.BALCONY -> p.s("#BFE3F2"); else -> p.s("#F6E0C2")
    }

    // ---------------- rooms ----------------
    private fun floor(g: Gfx, p: Pal, r: Room) {
        val x = bx(r.x.toFloat()); val y = by(r.y + 1f); val w = r.w * T; val h = (r.h - 1) * T * K; val c = floorColor(p, r)
        g.fillRect(x, y, w, h, c)
        val line = Colors.mix(c, 0xFF000000.toInt(), 0.07f)
        when (r.kind) {
            RoomKind.BATH, RoomKind.KITCHEN -> {   /* tiles */
                for (i in 1 until r.w) g.fillRect(x + i * T - 0.5f, y, 1f, h, line)
                for (j in 1 until r.h - 1) g.fillRect(x, y + j * T * K - 0.5f, w, 1f, line)
                if (r.kind == RoomKind.KITCHEN) for (j in 0 until r.h - 1) for (i in 0 until r.w) if ((i + j) % 2 == 0) g.fillRect(x + i * T, y + j * T * K, T, T * K, Colors.withAlpha(line, 0.35f))
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
        if (r.kind == RoomKind.BALCONY) {   /* open air: sky and a railing */
            g.fillRect(x, y, w, h, Colors.mix(p.night, p.water, light))
            g.fillRect(x, y + h - 5, w, 5f, p.white); var xx = x + 4; while (xx < x + w) { g.fillRect(xx, y + h * 0.35f, 2.5f, h * 0.65f, p.white); xx += 7 }
            g.fillRect(x, y + h * 0.33f, w, 3f, p.white); return
        }
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
    private fun window(g: Gfx, p: Pal, tx: Int, ty: Int, tw: Int, light: Float) {
        val x = bx(tx.toFloat()) + 5; val y = by(ty.toFloat()) + 3; val w = tw * T - 10; val h = T * K - 9
        g.fillRound(x - 2, y - 2, w + 4, h + 4, 4f, p.white)
        g.fillRect(x, y, w, h, Colors.mix(p.night, p.water, light))
        if (light > 0.5f) g.fillCircle(x + w * 0.75f, y + h * 0.35f, h * 0.16f, Colors.withAlpha(p.sun, light)) else g.fillCircle(x + w * 0.72f, y + h * 0.32f, h * 0.13f, p.shade)
        g.fillRect(x + w / 2 - 1, y, 2f, h, p.white); g.fillRect(x, y + h / 2 - 1, w, 2f, p.white)
        g.fillRound(x - 4, y - 3, w * 0.16f, h + 5, 3f, p.coral); g.fillRound(x + w * 0.84f + 4, y - 3, w * 0.16f, h + 5, 3f, p.coral)
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
    private fun piece(g: Gfx, p: Pal, kind: String, x: Int, y: Int, time: Float, light: Float, used: Boolean) {
        val fx = x.toFloat(); val fy = y.toFloat()
        when (kind) {
            "fridge" -> { box(g, fx, fy, 1f, 1f, 44f, p.white, p.whiteLip); g.fillRect(bx(fx) + 6, by(fy + 1) - 26, T - 12, 1.5f, p.whiteLip); g.fillRound(bx(fx) + T - 10, by(fy + 1) - 40, 2.5f, 10f, 1f, p.ink2) }
            "stove" -> { box(g, fx, fy, 1f, 1f, 22f, p.s("#E7E2DA"), p.whiteLip)
                val ty = by(fy) - 22 + T * K * 0.5f; g.fillCircle(bx(fx + 0.32f), ty, T * 0.12f, p.dk); g.fillCircle(bx(fx + 0.7f), ty, T * 0.12f, p.dk)
                if (used) { g.fillCircle(bx(fx + 0.32f), ty, T * 0.07f, p.coral); g.fillCircle(bx(fx + 0.5f) + kotlin.math.sin(time * 3) * 2, by(fy) - 34 - (time * 8) % 10, 3f, Colors.withAlpha(p.white, 0.7f)) }
                g.fillRound(bx(fx) + 7, by(fy + 1) - 14, T - 14, 8f, 2f, p.dk) }
            "table" -> { val X = bx(fx) + 3; val W = 2 * T - 6
                for (sx in listOf(0.5f, 1.5f)) { g.fillRound(bx(fx + sx) - T * 0.22f, by(fy + 1.5f) - 9, T * 0.44f, 9f, 3f, p.woodLip) }   /* stools in front */
                g.fillRect(X + 4, by(fy + 1) - 16, 4f, 16f, p.woodLip); g.fillRect(X + W - 8, by(fy + 1) - 16, 4f, 16f, p.woodLip)
                g.fillRound(X, by(fy) - 16 + 3, W, T * K - 3, 5f, p.woodTop); g.fillRect(X, by(fy + 1) - 18, W, 4f, p.wood)
                g.fillCircle(X + W / 2, by(fy + 0.5f) - 16, T * 0.14f, p.white) }
            "tv" -> { box(g, fx, fy, 1f, 1f, 12f, p.woodTop, p.wood)
                val X = bx(fx) + 4; val W = T - 8; val sy = by(fy) - 12 - 20; g.fillRound(X, sy, W, 20f, 3f, p.dk)
                g.fillRound(X + 2, sy + 2, W - 4, 16f, 2f, if (used) Colors.mix(p.sky, p.sun, (kotlin.math.sin(time * 1.7f) + 1) / 2) else p.s("#3B3550")) }
            "shelf" -> { box(g, fx, fy, 1f, 1f, 40f, p.woodTop, p.wood)
                val X = bx(fx) + 6; val cols = listOf(p.coral, p.sky, p.mint, p.sun, p.coralLip)
                for (row in 0 until 3) { val ry = by(fy + 1) - 38 + row * 12f; var xx = X; var i = row; while (xx < bx(fx) + T - 9) { g.fillRect(xx, ry, 3.5f, 9f, cols[i % cols.size]); xx += 4.5f; i++ }; g.fillRect(bx(fx) + 4, ry + 9, T - 8, 1.5f, p.woodLip) } }
            "plant" -> { val cx = bx(fx + 0.5f); val yb = by(fy + 1) - 2; g.fillRound(cx - T * 0.22f, yb - 14, T * 0.44f, 14f, 4f, p.pot)
                val sway = kotlin.math.sin(time * 1.3f + x) * 1.5f
                g.fillCircle(cx - 6 + sway, yb - 22, 8f, p.leafLip); g.fillCircle(cx + 6 + sway, yb - 24, 8f, p.leafLip); g.fillCircle(cx + sway, yb - 30, 9f, p.leaf); g.fillCircle(cx - 4 + sway, yb - 22, 6f, p.leaf) }
            "lamp" -> { val cx = bx(fx + 0.5f); val yb = by(fy + 1) - 4; if (light < 0.6f) g.fillCircle(cx, yb - 40, 26f, Colors.withAlpha(p.shade, (0.6f - light) * 0.6f))
                g.fillRound(cx - 6, yb - 3, 12f, 4f, 2f, p.ink2); g.fillRect(cx - 1, yb - 38, 2f, 36f, p.ink2); g.fillRound(cx - 9, yb - 48, 18f, 13f, 4f, if (light < 0.6f) p.sun else p.shade) }
            else -> box(g, fx, fy, Furniture.kind(kind).w.toFloat(), Furniture.kind(kind).h.toFloat(), 14f, p.woodTop, p.wood)
        }
    }
    private fun blanketColor(p: Pal, i: Int) = if (i % 2 == 0) p.coral to p.coralLip else p.sky to p.skyLip
    private fun bed(g: Gfx, p: Pal, x: Int, y: Int, w: Int, i: Int) {
        val X = bx(x.toFloat()) + 3; val W = w * T - 6; val top = by(y.toFloat()) - 10; val yb = by(y + 2f)
        g.fillRound(X - 1, top - 10, W + 2, 14f, 5f, p.woodLip)   /* headboard */
        g.fillRound(X, yb - 12, W, 12f, 4f, p.wood); g.fillRound(X, top, W, yb - 12 - top + 2, 5f, p.white)
        for (k in 0 until w) g.fillRound(bx(x + k + 0.5f) - T * 0.32f, top + 4, T * 0.64f, T * K * 0.34f, 6f, Colors.mix(p.white, p.sky, 0.25f))
    }
    private fun blanket(g: Gfx, p: Pal, x: Int, y: Int, w: Int, i: Int) {
        val X = bx(x.toFloat()) + 3; val W = w * T - 6; val yb = by(y + 2f) - 12; val bt = by(y + 1.05f) - 10; val (c, l) = blanketColor(p, i)
        g.fillRound(X, bt + 3, W, yb - bt, 5f, l); g.fillRound(X, bt, W, yb - bt - 2, 5f, c)
        g.fillRect(X + 2, bt + 5, W - 4, 2f, Colors.withAlpha(p.white, 0.55f))
    }
    private fun tub(g: Gfx, p: Pal, x: Int, y: Int) {
        val X = bx(x.toFloat()) + 3; val W = 2 * T - 6; val top = by(y.toFloat()) - 14; val yb = by(y + 1f)
        g.fillRound(X, top, W, yb - top, 9f, p.white); g.fillRound(X + 4, top + 3, W - 8, yb - top - 16, 7f, p.water)
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
