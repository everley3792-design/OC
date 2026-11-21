package app.ocshimeji.sim.life

import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.house.HouseType

/** the walkable floor of a house: room floors and doors, minus furniture that blocks; crossing between rooms only through a door */
class Grid(val h: HouseType) {
    val w = h.w; val hh = h.h
    private val walk = BooleanArray(w * hh)
    private val room = IntArray(w * hh) { -1 }
    private val door = BooleanArray(w * hh)
    init {
        h.rooms.forEachIndexed { ri, r -> for (y in r.y until r.y + r.h) for (x in r.x until r.x + r.w) { room[y * w + x] = ri; if (r.inside(x, y)) walk[y * w + x] = true } }
        for (d in h.doors + h.entrance) { walk[d.y * w + d.x] = true; door[d.y * w + d.x] = true }
        for (p in h.pieces) { val k = Furniture.kind(p.kind); if (!k.blocks) continue; for (y in p.y until p.y + k.h) for (x in p.x until p.x + k.w) if (inBounds(x, y) && !door[y * w + x]) walk[y * w + x] = false }
    }
    fun inBounds(x: Int, y: Int) = x in 0 until w && y in 0 until hh
    fun walkable(x: Int, y: Int) = inBounds(x, y) && walk[y * w + x]
    fun roomIndex(x: Int, y: Int) = if (inBounds(x, y)) room[y * w + x] else -1
    private fun canStep(ax: Int, ay: Int, bx: Int, by: Int): Boolean {
        if (!walkable(bx, by)) return false
        val ra = roomIndex(ax, ay); val rb = roomIndex(bx, by)
        return ra == rb || door[ay * w + ax] || door[by * w + bx]
    }
    /** distances (in steps) from a tile to every tile — one search per decision gives the cost of every candidate */
    fun distances(sx: Int, sy: Int): IntArray {
        val d = IntArray(w * hh) { -1 }; if (!inBounds(sx, sy)) return d
        val q = IntArray(w * hh); var qh = 0; var qt = 0; d[sy * w + sx] = 0; q[qt++] = sy * w + sx
        while (qh < qt) { val c = q[qh++]; val cx = c % w; val cy = c / w
            for (k in 0 until 4) { val nx = cx + DX[k]; val ny = cy + DY[k]; if (!inBounds(nx, ny)) continue; val ni = ny * w + nx
                if (d[ni] < 0 && canStep(cx, cy, nx, ny)) { d[ni] = d[c] + 1; q[qt++] = ni } } }
        return d
    }
    /** a path of tiles from (sx, sy) to (tx, ty) (both included), or null */
    fun path(sx: Int, sy: Int, tx: Int, ty: Int): List<Pair<Int, Int>>? {
        val d = distances(tx, ty); if (!inBounds(sx, sy) || d[sy * w + sx] < 0) return null
        val out = ArrayList<Pair<Int, Int>>(); var cx = sx; var cy = sy; out += cx to cy
        while (!(cx == tx && cy == ty)) { var best = -1; var bx = cx; var by = cy
            for (k in 0 until 4) { val nx = cx + DX[k]; val ny = cy + DY[k]; if (!inBounds(nx, ny)) continue; val v = d[ny * w + nx]
                if (v >= 0 && (best < 0 || v < best) && canStep(nx, ny, cx, cy)) { best = v; bx = nx; by = ny } }
            if (best < 0 || best >= d[cy * w + cx]) return null; cx = bx; cy = by; out += cx to cy }
        return out
    }
    /** the walkable tile nearest to a point (for landing after a throw, or standing next to a slot that sits on furniture) */
    fun nearestWalkable(x: Float, y: Float): Pair<Int, Int> {
        var best: Pair<Int, Int>? = null; var bd = Float.MAX_VALUE
        for (ty in 0 until hh) for (tx in 0 until w) if (walkable(tx, ty)) { val dx = tx + 0.5f - x; val dy = ty + 0.5f - y; val dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = tx to ty } }
        return best ?: (h.entrance.x to h.entrance.y)
    }
    fun walkableTiles(roomIdx: Int): List<Pair<Int, Int>> { val out = ArrayList<Pair<Int, Int>>(); for (ty in 0 until hh) for (tx in 0 until w) if (walkable(tx, ty) && room[ty * w + tx] == roomIdx && !door[ty * w + tx]) out += tx to ty; return out }
    companion object { private val DX = intArrayOf(1, -1, 0, 0); private val DY = intArrayOf(0, 0, 1, -1) }
}
