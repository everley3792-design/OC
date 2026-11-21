package app.ocshimeji.sim.life

import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.house.HouseType
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Piece
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.town.PieceRec

/**
 * Decorating (plan G-01) and moving house (plan 12.3). Furniture sits on the floor tiles of one room; a new arrangement is checked
 * before it counts — nothing on a doorway, every room and every seat reachable from the door, enough beds for who sleeps there —
 * and every piece that goes in or out of the bag goes through the ledger. One step of undo at a time, as many as you like.
 */
class Decorate(private val sim: LifeSim) {
    private val life get() = sim.life
    /** plumbing and windows stay where the house has them */
    val FIXED = setOf("window", "tub", "fridge", "stove", "mirror")
    private class Step(val before: List<PieceRec>, val item: String, val qty: Int, val what: String)
    private val history = ArrayList<Step>()
    val canUndo get() = history.isNotEmpty()
    fun pieces(): List<PieceRec> = if (life.layout.isNotEmpty()) life.layout.toList() else Houses.get(life.houseId).pieces.map { PieceRec(it.kind, it.x, it.y, it.room, flip = it.flip) }
    private fun bagIdOf(kind: String) = if (kind.startsWith("item:")) kind else "f:$kind"
    /** what in the bag can be placed: (bag id, furniture kind) */
    fun placeable(): List<Pair<String, String>> = life.bag.keys.mapNotNull { k -> when {
        k.startsWith("f:") -> k to k.removePrefix("f:")
        k.startsWith("item:") -> life.items.firstOrNull { "item:" + it.id == k && it.kind in LifeSim.FURNITURE_KINDS }?.let { k to k }
        else -> null } }

    /** null = this arrangement works, otherwise why not (shown as it is) */
    fun problem(list: List<PieceRec>): String? {
        val base = Houses.get(life.houseId)
        val occ = HashMap<Long, Int>()
        list.forEachIndexed { i, pc ->
            val k = Furniture.kind(pc.kind); val room = base.rooms.firstOrNull { it.id == pc.room } ?: return "${k.zh}不在任何房間裡"
            val wallKind = pc.kind == "window" || pc.kind == "mirror" || k.wall
            if (k.wall && pc.y != room.y) return "${k.zh}要貼在${room.zh}的牆上（最上面那一排）"
            for (y in pc.y until pc.y + k.h) for (x in pc.x until pc.x + k.w) {
                if (base.roomAt(x, y) != room) return "${k.zh}要整個放在${room.zh}裡"
                if (!wallKind && !room.inside(x, y)) return "${k.zh}不能放在牆上"
                if (k.blocks && !wallKind) { if ((base.doors + base.entrance).any { it.x == x && it.y == y }) return "${k.zh}擋住門口了"
                    val key = y * 1000L + x; occ[key]?.let { j -> if (j != i) return "${k.zh}和${Furniture.kind(list[j].kind).zh}疊在一起了" }; occ[key] = i }
            }
        }
        val h = base.copy(pieces = list.map { Piece(it.kind, it.x, it.y, it.room) }); val g = Grid(h); val d = g.distances(h.entrance.x, h.entrance.y)
        for ((ri, r) in h.rooms.withIndex()) if (g.walkableTiles(ri).none { d[it.second * g.w + it.first] >= 0 }) return "走不到${r.zh}了"
        for (pc in h.pieces) for (s in Furniture.kind(pc.kind).slots) { val sx = pc.x + s.dx; val sy = pc.y + s.dy
            val (ax, ay) = if (g.walkable(sx.toInt(), sy.toInt())) sx.toInt() to sy.toInt() else g.nearestWalkable(sx, sy)
            if (d[ay * g.w + ax] < 0) return "${Furniture.kind(pc.kind).zh}前面被擋住，走不過去" }
        for (r in h.bedrooms) { val sleepers = life.people.count { it.room == r.id }; val beds = h.pieces.filter { it.room == r.id }.sumOf { pc -> Furniture.kind(pc.kind).slots.count { s -> LifeSim.fits("bed", pc.kind) && s.pose == app.ocshimeji.sim.house.Spot.LIE } }
            if (beds < sleepers) return "${r.zh}的床不夠 $sleepers 個人睡" }
        return null
    }
    private fun commit(list: List<PieceRec>, item: String, qty: Int, what: String, reason: String): String? {
        problem(list)?.let { return it }
        if (item.isNotEmpty() && !sim.economy.move(item, qty, reason)) return "背包裡沒有"
        history += Step(pieces(), item, qty, what); while (history.size > 50) history.removeAt(0)
        life.layout.clear(); life.layout += list; sim.relayout(); return null
    }
    /** something from the bag onto the floor at tile (x, y) */
    fun place(bagId: String, x: Int, y: Int): String? {
        val kind = placeable().firstOrNull { it.first == bagId }?.second ?: return "這個不能擺在家裡"
        val room = Houses.get(life.houseId).roomAt(x, y) ?: return "要放在房間裡"
        val r = commit(pieces() + PieceRec(kind, x, y, room.id, owned = true), bagId, -1, "擺上${Furniture.kind(kind).zh}", "擺在家裡：${Economy.nameOf(life, bagId)}")
        if (r == null) { sim.townLife.goal("place"); sim.journal.reactTo(kind, room.id); sim.journal.checkSets(); sim.log(life.people.firstOrNull() ?: return null, "你在${room.zh}擺了${Furniture.kind(kind).zh}", kind = "you", weight = 1) }
        return r
    }
    fun move(i: Int, x: Int, y: Int): String? {
        val list = pieces().toMutableList(); val pc = list.getOrNull(i) ?: return "沒有這件家具"
        if (pc.kind in FIXED) return "${Furniture.kind(pc.kind).zh}是固定的"
        val room = Houses.get(life.houseId).roomAt(x, y) ?: return "要放在房間裡"
        list[i] = PieceRec(pc.kind, x, y, room.id, pc.owned, pc.flip); val r = commit(list, "", 0, "移動${Furniture.kind(pc.kind).zh}", "")
        if (r == null) { sim.journal.moved(pc.x, pc.y, x, y); sim.journal.checkSets() }
        return r
    }
    /** turn it to face the other way (a mirror image: how it looks and which side people sit on stay the same piece) */
    fun flip(i: Int): String? {
        val list = pieces().toMutableList(); val pc = list.getOrNull(i) ?: return "沒有這件家具"
        if (pc.kind in FIXED) return "${Furniture.kind(pc.kind).zh}是固定的"
        list[i] = PieceRec(pc.kind, pc.x, pc.y, pc.room, pc.owned, !pc.flip); return commit(list, "", 0, "翻面${Furniture.kind(pc.kind).zh}", "")
    }
    /** into the bag (furniture the house came with becomes yours to place elsewhere) */
    fun remove(i: Int): String? {
        val list = pieces().toMutableList(); val pc = list.getOrNull(i) ?: return "沒有這件家具"
        if (pc.kind in FIXED) return "${Furniture.kind(pc.kind).zh}是固定的"
        list.removeAt(i); return commit(list, bagIdOf(pc.kind), 1, "收起${Furniture.kind(pc.kind).zh}", "收進背包：${Furniture.kind(pc.kind).zh}")
    }
    fun undo(): String? {
        val s = history.lastOrNull() ?: return "沒有可以復原的"
        if (s.item.isNotEmpty() && !sim.economy.move(s.item, -s.qty, "復原：${s.what}")) return "那件東西已經不在背包裡了"
        history.removeAt(history.size - 1); life.layout.clear(); life.layout += s.before; sim.relayout(); return null
    }

    // ================= moving house (plan 12.3) =================
    class Opinion(val who: String, val stance: String, val line: String)
    /** what everyone thinks about moving there */
    fun opinions(h: HouseType): List<Opinion> = life.people.map { p ->
        val shares = life.people.count { it.room == p.room } > 1
        val stance = when {
            shares && h.bedrooms.size >= life.people.size -> "要自己的房間"
            h.rooms.any { it.kind == app.ocshimeji.sim.house.RoomKind.YARD } && (p.spec.roomPref == "要有植物" || p.spec.likes.any { it.contains("植物") || it.contains("花") }) -> "想搬"
            p.spec.axis(Axis.ACTIVE) > 0.2f || p.spec.axis(Axis.OUTGOING) > 0.3f -> "想搬"
            life.day > 7 || p.spec.axis(Axis.GENTLE) > 0.4f -> "捨不得"
            else -> "都可以"
        }
        Opinion(p.id, stance, Speechless.line(stance, h.zh))
    }
    private object Speechless { fun line(stance: String, zh: String) = when (stance) { "想搬" -> "搬去${zh}？好啊，聽起來很棒！"; "捨不得" -> "這裡住久了，有點捨不得……"; "要自己的房間" -> "新家的話，我可以有自己的房間嗎？"; else -> "去哪裡我都可以。" } }
    /** move: rooms are given out again, your furniture goes into the bag, everyone arrives at the new door (null = done) */
    fun moveTo(h: HouseType, rooms: Map<String, String>? = null, allowLocked: Boolean = false): String? {
        if (h.id == life.houseId) return "已經住在這裡了"
        if (h.locked.isNotEmpty() && !allowLocked) return h.locked
        val ts = life.people.map { Tenant(it.id, it.name, it.adult) }
        Houses.check(h, ts)?.let { return it }
        val rm = rooms ?: Houses.autoRooms(h, ts)
        Houses.checkRooms(h, ts, rm) { a, b -> app.ocshimeji.sim.chars.Relations.family(life.rels, a, b) }?.let { return it }
        for (pc in pieces()) if (pc.owned) sim.economy.move(bagIdOf(pc.kind), 1, "搬家帶走：${Furniture.kind(pc.kind).zh}")
        val from = Houses.get(life.houseId).zh
        life.layout.clear(); life.decor.clear(); history.clear(); life.houseId = h.id; life.prog.plants.clear(); life.prog.sets.clear(); sim.journal.did("", "move")
        life.mess.clear(); for (r in h.rooms) life.mess[r.id] = 5f
        for (p in life.people) { p.room = rm[p.id] ?: p.room; p.act = null; p.with = null; p.actPiece = -1
            if (p.out == null && !p.desk) { p.x = h.entrance.x + 0.5f; p.y = h.entrance.y + 0.5f } }
        life.arriving = true; sim.relayout()
        sim.log(life.people.first(), "大家從${from}搬到了${h.zh}", kind = "event", weight = 3)
        return null
    }
}
