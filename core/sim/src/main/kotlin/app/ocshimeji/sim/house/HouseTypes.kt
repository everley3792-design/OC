package app.ocshimeji.sim.house

/**
 * House types (plan 12.3). M1 has three; the rest (庭院平房, 共居宿舍, 家族大宅) arrive in M6 — they are data, nothing else changes.
 * A house is a tile grid of rooms; the top row of every room is its back wall (not walkable). Doors are tiles on shared edges
 * that make the two rooms' floors connected; `entrance` is where people arrive.
 */
enum class RoomKind(val zh: String) { LIVING("客廳"), KITCHEN("廚房"), BEDROOM("臥室"), BATH("浴室"), STUDIO("起居空間"), BALCONY("陽台") }
data class Room(val id: String, val zh: String, val kind: RoomKind, val x: Int, val y: Int, val w: Int, val h: Int, val sleeps: Int = 0) {
    fun inside(tx: Int, ty: Int) = tx >= x && tx < x + w && ty >= y + 1 && ty < y + h   /* floor = without the back-wall row */
}
data class Piece(val kind: String, val x: Int, val y: Int, val room: String)
data class Door(val x: Int, val y: Int)
data class HouseType(
    val id: String, val zh: String, val blurb: String,
    val w: Int, val h: Int, val rooms: List<Room>, val pieces: List<Piece>, val doors: List<Door>, val entrance: Door,
    val capacity: Int, val rules: List<String>,
) {
    val bedrooms get() = rooms.filter { it.sleeps > 0 }
    fun room(id: String) = rooms.first { it.id == id }
    fun roomAt(tx: Int, ty: Int) = rooms.firstOrNull { tx >= it.x && tx < it.x + it.w && ty >= it.y && ty < it.y + it.h }
}

/** a resident as the house rules see them */
data class Tenant(val id: String, val name: String, val adult: Boolean)

object Houses {
    val STUDIO = HouseType("studio", "單人套房", "小小的一間，什麼都在手邊。", 9, 6,
        rooms = listOf(Room("main", "起居空間", RoomKind.STUDIO, 0, 0, 6, 6, sleeps = 1), Room("bath", "浴室", RoomKind.BATH, 6, 0, 3, 3), Room("balcony", "陽台", RoomKind.BALCONY, 6, 3, 3, 3)),
        pieces = listOf(Piece("bed", 0, 1, "main"), Piece("fridge", 4, 1, "main"), Piece("stove", 5, 1, "main"), Piece("shelf", 1, 1, "main"), Piece("window", 2, 0, "main"),
            Piece("table", 3, 3, "main"), Piece("rug", 1, 4, "main"), Piece("tv", 3, 1, "main"),
            Piece("tub", 6, 1, "bath"), Piece("mirror", 8, 1, "bath"), Piece("plant", 8, 4, "balcony"), Piece("window", 6, 3, "balcony")),
        doors = listOf(Door(6, 2), Door(6, 4)), entrance = Door(2, 5), capacity = 1,
        rules = listOf("最多 1 位住民", "佈置成本低，住民比較常出門（M5 後）"))
    val COTTAGE = HouseType("cottage", "雙人小屋", "兩間臥室、一個客廳，剛剛好的兩個人。", 10, 8,
        rooms = listOf(Room("bedA", "臥室 A", RoomKind.BEDROOM, 0, 0, 4, 4, sleeps = 2), Room("bedB", "臥室 B", RoomKind.BEDROOM, 4, 0, 3, 4, sleeps = 1), Room("bath", "浴室", RoomKind.BATH, 7, 0, 3, 4),
            Room("living", "客廳", RoomKind.LIVING, 0, 4, 6, 4), Room("kitchen", "廚房", RoomKind.KITCHEN, 6, 4, 4, 4)),
        pieces = listOf(Piece("bed2", 0, 1, "bedA"), Piece("lamp", 3, 1, "bedA"), Piece("bed", 4, 1, "bedB"), Piece("shelf", 6, 1, "bedB"),
            Piece("tub", 7, 1, "bath"), Piece("mirror", 9, 1, "bath"),
            Piece("sofa", 1, 6, "living"), Piece("tv", 1, 5, "living"), Piece("window", 3, 4, "living"), Piece("plant", 0, 7, "living"), Piece("rug", 3, 6, "living"),
            Piece("fridge", 6, 5, "kitchen"), Piece("stove", 7, 5, "kitchen"), Piece("table", 7, 6, "kitchen")),
        doors = listOf(Door(2, 4), Door(5, 4), Door(8, 4), Door(6, 6)), entrance = Door(2, 7), capacity = 2,
        rules = listOf("最多 2 位住民", "臥室 A 可以兩個人一起睡（同房依關係，M4 後）", "未成年的住民要有成年住民同住"))
    val APARTMENT = HouseType("apartment", "三房公寓", "三間臥室，熱鬧的大家庭感。", 12, 9,
        rooms = listOf(Room("bed1", "臥室 1", RoomKind.BEDROOM, 0, 0, 4, 4, sleeps = 2), Room("bed2", "臥室 2", RoomKind.BEDROOM, 4, 0, 4, 4, sleeps = 1), Room("bed3", "臥室 3", RoomKind.BEDROOM, 8, 0, 4, 4, sleeps = 1),
            Room("living", "客廳", RoomKind.LIVING, 0, 4, 7, 5), Room("kitchen", "廚房", RoomKind.KITCHEN, 7, 4, 3, 5), Room("bath", "浴室", RoomKind.BATH, 10, 4, 2, 5)),
        pieces = listOf(Piece("bed", 0, 1, "bed1"), Piece("bed", 2, 1, "bed1"), Piece("bed", 4, 1, "bed2"), Piece("shelf", 7, 1, "bed2"), Piece("bed", 8, 1, "bed3"), Piece("plant", 11, 2, "bed3"),
            Piece("sofa", 1, 7, "living"), Piece("tv", 1, 5, "living"), Piece("window", 3, 4, "living"), Piece("rug", 3, 6, "living"), Piece("shelf", 6, 5, "living"),
            Piece("fridge", 7, 5, "kitchen"), Piece("stove", 8, 5, "kitchen"), Piece("table", 7, 7, "kitchen"), Piece("tub", 10, 5, "bath"), Piece("mirror", 11, 7, "bath")),
        doors = listOf(Door(2, 4), Door(5, 4), Door(9, 4), Door(7, 6), Door(10, 7)), entrance = Door(3, 8), capacity = 4,
        rules = listOf("最多 4 位住民", "一間臥室最多兩人", "浴室只有一間：早上要排隊", "未成年的住民要有成年住民同住"))
    val ALL = listOf(STUDIO, COTTAGE, APARTMENT)
    fun get(id: String) = ALL.firstOrNull { it.id == id } ?: STUDIO

    /** can these people live here? null = yes, otherwise the reason (shown as it is) */
    fun check(h: HouseType, tenants: List<Tenant>): String? {
        if (tenants.isEmpty()) return "至少要有一位住民"
        if (tenants.size > h.capacity) return "${h.zh}最多住 ${h.capacity} 位（現在 ${tenants.size} 位）"
        if (tenants.any { !it.adult } && tenants.none { it.adult }) return "未成年的住民要有至少一位成年住民同住"
        return null
    }
    /** a first room for everyone: fill bedrooms in order, never beyond their beds */
    fun autoRooms(h: HouseType, tenants: List<Tenant>): Map<String, String> {
        val left = h.bedrooms.associate { it.id to it.sleeps }.toMutableMap(); val out = LinkedHashMap<String, String>()
        for (t in tenants) { val r = h.bedrooms.firstOrNull { (left[it.id] ?: 0) > 0 } ?: break; out[t.id] = r.id; left[r.id] = left[r.id]!! - 1 }
        return out
    }
    fun checkRooms(h: HouseType, tenants: List<Tenant>, rooms: Map<String, String>): String? {
        for (t in tenants) if (rooms[t.id] == null) return "${t.name}還沒有房間"
        for (r in h.bedrooms) { val n = tenants.count { rooms[it.id] == r.id }; if (n > r.sleeps) return "${r.zh}只睡得下 ${r.sleeps} 位" }
        for (r in h.bedrooms) { val inRoom = tenants.filter { rooms[it.id] == r.id }; if (inRoom.size > 1 && inRoom.any { !it.adult } && inRoom.any { it.adult }) return "未成年和成年住民不同房（家人同房在 M4 加入關係後開放）" }
        return null
    }
}
