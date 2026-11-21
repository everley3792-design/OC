package app.ocshimeji.sim.house

/**
 * House types (plan 12.3): six — 單人套房, 雙人小屋, 三房公寓 (M1) and 庭院平房, 共居宿舍, 家族大宅 (M6). They are data, nothing else changes.
 * A house is a tile grid of rooms; the top row of every room is its back wall (not walkable). Doors are tiles on shared edges
 * that make the two rooms' floors connected; `entrance` is where people arrive.
 */
enum class RoomKind(val zh: String) { LIVING("客廳"), KITCHEN("廚房"), BEDROOM("臥室"), BATH("浴室"), STUDIO("起居空間"), BALCONY("陽台"), YARD("庭院"), STUDY("書房"), DINING("餐廳") }
data class Room(val id: String, val zh: String, val kind: RoomKind, val x: Int, val y: Int, val w: Int, val h: Int, val sleeps: Int = 0) {
    fun inside(tx: Int, ty: Int) = tx >= x && tx < x + w && ty >= y + 1 && ty < y + h   /* floor = without the back-wall row */
}
data class Piece(val kind: String, val x: Int, val y: Int, val room: String, val flip: Boolean = false)
data class Door(val x: Int, val y: Int)
data class HouseType(
    val id: String, val zh: String, val blurb: String,
    val w: Int, val h: Int, val rooms: List<Room>, val pieces: List<Piece>, val doors: List<Door>, val entrance: Door,
    val capacity: Int, val rules: List<String>,
    /** shown locked until the condition (plan 12.3: the family mansion opens when a home gets lively) */
    val locked: String = "",
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
        rules = listOf("最多 1 位住民", "佈置成本低，住民比較常出門"))
    val COTTAGE = HouseType("cottage", "雙人小屋", "兩間臥室、一個客廳，剛剛好的兩個人。", 10, 8,
        rooms = listOf(Room("bedA", "臥室 A", RoomKind.BEDROOM, 0, 0, 4, 4, sleeps = 2), Room("bedB", "臥室 B", RoomKind.BEDROOM, 4, 0, 3, 4, sleeps = 1), Room("bath", "浴室", RoomKind.BATH, 7, 0, 3, 4),
            Room("living", "客廳", RoomKind.LIVING, 0, 4, 6, 4), Room("kitchen", "廚房", RoomKind.KITCHEN, 6, 4, 4, 4)),
        pieces = listOf(Piece("bed2", 0, 1, "bedA"), Piece("lamp", 3, 1, "bedA"), Piece("bed", 4, 1, "bedB"), Piece("shelf", 6, 1, "bedB"),
            Piece("tub", 7, 1, "bath"), Piece("mirror", 9, 1, "bath"),
            Piece("sofa", 1, 6, "living"), Piece("tv", 1, 5, "living"), Piece("window", 3, 4, "living"), Piece("plant", 0, 7, "living"), Piece("rug", 3, 6, "living"),
            Piece("fridge", 6, 5, "kitchen"), Piece("stove", 7, 5, "kitchen"), Piece("table", 7, 6, "kitchen")),
        doors = listOf(Door(2, 4), Door(5, 4), Door(8, 4), Door(6, 6)), entrance = Door(2, 7), capacity = 2,
        rules = listOf("最多 2 位住民", "臥室 A 可以兩個人一起睡", "未成年的住民要有成年住民同住"))
    val APARTMENT = HouseType("apartment", "三房公寓", "三間臥室，熱鬧的大家庭感。", 12, 9,
        rooms = listOf(Room("bed1", "臥室 1", RoomKind.BEDROOM, 0, 0, 4, 4, sleeps = 2), Room("bed2", "臥室 2", RoomKind.BEDROOM, 4, 0, 4, 4, sleeps = 1), Room("bed3", "臥室 3", RoomKind.BEDROOM, 8, 0, 4, 4, sleeps = 1),
            Room("living", "客廳", RoomKind.LIVING, 0, 4, 7, 5), Room("kitchen", "廚房", RoomKind.KITCHEN, 7, 4, 3, 5), Room("bath", "浴室", RoomKind.BATH, 10, 4, 2, 5)),
        pieces = listOf(Piece("bed", 0, 1, "bed1"), Piece("bed", 2, 1, "bed1"), Piece("bed", 4, 1, "bed2"), Piece("shelf", 7, 1, "bed2"), Piece("bed", 8, 1, "bed3"), Piece("plant", 11, 2, "bed3"),
            Piece("sofa", 1, 7, "living"), Piece("tv", 1, 5, "living"), Piece("window", 3, 4, "living"), Piece("rug", 3, 6, "living"), Piece("shelf", 6, 5, "living"),
            Piece("fridge", 7, 5, "kitchen"), Piece("stove", 8, 5, "kitchen"), Piece("table", 7, 7, "kitchen"), Piece("tub", 10, 5, "bath"), Piece("mirror", 11, 7, "bath")),
        doors = listOf(Door(2, 4), Door(5, 4), Door(9, 4), Door(7, 6), Door(10, 7)), entrance = Door(3, 8), capacity = 4,
        rules = listOf("最多 4 位住民", "一間臥室最多兩人", "浴室只有一間：早上要排隊", "未成年的住民要有成年住民同住"))
    val BUNGALOW = HouseType("bungalow", "庭院平房", "三間臥室、大客廳，還有種菜曬衣的庭院。", 14, 11,
        rooms = listOf(Room("bed1", "臥室 1", RoomKind.BEDROOM, 0, 0, 4, 4, sleeps = 2), Room("bed2", "臥室 2", RoomKind.BEDROOM, 4, 0, 4, 4, sleeps = 2), Room("bed3", "臥室 3", RoomKind.BEDROOM, 8, 0, 3, 4, sleeps = 1),
            Room("bath", "浴室", RoomKind.BATH, 11, 0, 3, 4), Room("living", "客廳", RoomKind.LIVING, 0, 4, 9, 4), Room("kitchen", "廚房", RoomKind.KITCHEN, 9, 4, 5, 4), Room("yard", "庭院", RoomKind.YARD, 0, 8, 14, 3)),
        pieces = listOf(Piece("bed", 0, 1, "bed1"), Piece("bed", 2, 1, "bed1"), Piece("bed2", 4, 1, "bed2"), Piece("lamp", 7, 1, "bed2"), Piece("bed", 8, 1, "bed3"), Piece("shelf", 10, 1, "bed3"),
            Piece("tub", 11, 1, "bath"), Piece("mirror", 13, 1, "bath"),
            Piece("tv", 1, 5, "living"), Piece("sofa", 1, 6, "living"), Piece("window", 4, 4, "living"), Piece("rug", 4, 6, "living"), Piece("shelf", 7, 5, "living"),
            Piece("fridge", 11, 5, "kitchen"), Piece("stove", 12, 5, "kitchen"), Piece("table", 11, 6, "kitchen"),
            Piece("garden", 1, 9, "yard"), Piece("line", 11, 9, "yard"), Piece("plant", 8, 9, "yard")),
        doors = listOf(Door(2, 4), Door(6, 4), Door(9, 4), Door(13, 4), Door(9, 6), Door(4, 8)), entrance = Door(6, 10), capacity = 5,
        rules = listOf("最多 5 位住民", "有庭院：種菜、曬衣服", "未成年的住民要有成年住民同住"))
    val DORM = HouseType("dorm", "共居宿舍", "四間臥室、大餐廳，兩間浴室要排隊。", 16, 10,
        rooms = listOf(Room("b1", "臥室 1", RoomKind.BEDROOM, 0, 0, 4, 4, sleeps = 2), Room("b2", "臥室 2", RoomKind.BEDROOM, 4, 0, 4, 4, sleeps = 2), Room("b3", "臥室 3", RoomKind.BEDROOM, 8, 0, 4, 4, sleeps = 2),
            Room("b4", "臥室 4", RoomKind.BEDROOM, 12, 0, 4, 4, sleeps = 2), Room("dining", "餐廳", RoomKind.DINING, 0, 4, 10, 6), Room("kitchen", "廚房", RoomKind.KITCHEN, 10, 4, 6, 3),
            Room("bathA", "浴室 A", RoomKind.BATH, 10, 7, 3, 3), Room("bathB", "浴室 B", RoomKind.BATH, 13, 7, 3, 3)),
        pieces = listOf(Piece("bed", 0, 1, "b1"), Piece("bed", 2, 1, "b1"), Piece("bed", 4, 1, "b2"), Piece("bed", 6, 1, "b2"), Piece("bed2", 8, 1, "b3"), Piece("bed", 12, 1, "b4"), Piece("bed", 14, 1, "b4"),
            Piece("tv", 1, 5, "dining"), Piece("sofa", 1, 6, "dining"), Piece("window", 3, 4, "dining"), Piece("table", 5, 6, "dining"), Piece("table", 5, 8, "dining"), Piece("shelf", 8, 5, "dining"), Piece("rug", 1, 8, "dining"),
            Piece("fridge", 12, 5, "kitchen"), Piece("stove", 13, 5, "kitchen"), Piece("tub", 10, 9, "bathA"), Piece("tub", 13, 9, "bathB")),
        doors = listOf(Door(2, 4), Door(6, 4), Door(9, 4), Door(14, 4), Door(10, 5), Door(11, 7), Door(14, 7)), entrance = Door(4, 9), capacity = 8,
        rules = listOf("最多 8 位住民", "兩間共用浴室，早上要排隊", "家務容易起摩擦", "未成年的住民要有成年住民同住"))
    val MANSION = HouseType("mansion", "家族大宅", "五間臥室、書房、大客廳和庭院。", 18, 12,
        rooms = listOf(Room("b1", "臥室 1", RoomKind.BEDROOM, 0, 0, 4, 4, sleeps = 2), Room("b2", "臥室 2", RoomKind.BEDROOM, 4, 0, 4, 4, sleeps = 2), Room("b3", "臥室 3", RoomKind.BEDROOM, 8, 0, 4, 4, sleeps = 2),
            Room("b4", "臥室 4", RoomKind.BEDROOM, 12, 0, 3, 4, sleeps = 2), Room("b5", "臥室 5", RoomKind.BEDROOM, 15, 0, 3, 4, sleeps = 2),
            Room("living", "大客廳", RoomKind.LIVING, 0, 4, 10, 4), Room("study", "書房", RoomKind.STUDY, 10, 4, 4, 4), Room("kitchen", "廚房", RoomKind.KITCHEN, 14, 4, 4, 4),
            Room("bath", "浴室 A", RoomKind.BATH, 0, 8, 4, 4), Room("yard", "庭院", RoomKind.YARD, 4, 8, 10, 4), Room("bath2", "浴室 B", RoomKind.BATH, 14, 8, 4, 4)),
        pieces = listOf(Piece("bed2", 0, 1, "b1"), Piece("lamp", 3, 1, "b1"), Piece("bed", 4, 1, "b2"), Piece("bed", 6, 1, "b2"), Piece("bed2", 8, 1, "b3"), Piece("bed", 12, 1, "b4"), Piece("bed", 14, 1, "b4"), Piece("bed2", 15, 1, "b5"),
            Piece("tv", 1, 5, "living"), Piece("sofa", 1, 6, "living"), Piece("window", 3, 4, "living"), Piece("rug", 4, 6, "living"), Piece("shelf", 8, 5, "living"),
            Piece("shelf", 10, 5, "study"), Piece("shelf", 11, 5, "study"), Piece("table", 11, 7, "study"),
            Piece("fridge", 14, 5, "kitchen"), Piece("stove", 17, 5, "kitchen"), Piece("table", 14, 7, "kitchen"),
            Piece("tub", 0, 9, "bath"), Piece("mirror", 3, 9, "bath"), Piece("garden", 4, 10, "yard"), Piece("line", 11, 9, "yard"), Piece("tub", 14, 9, "bath2"), Piece("mirror", 17, 9, "bath2")),
        doors = listOf(Door(2, 4), Door(6, 4), Door(9, 4), Door(13, 4), Door(16, 4), Door(10, 6), Door(14, 6), Door(2, 8), Door(6, 8), Door(16, 8)), entrance = Door(9, 11), capacity = 10,
        rules = listOf("最多 10 位住民", "有書房與庭院", "未成年的住民要有成年住民同住"),
        locked = "要有一個住了 5 位以上住民的家，才會開放")
    val ALL = listOf(STUDIO, COTTAGE, APARTMENT, BUNGALOW, DORM, MANSION)
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
    /** `family(a, b)`: these two are family (both directions) — a minor may share a room with adult family (plan 12.3) */
    fun checkRooms(h: HouseType, tenants: List<Tenant>, rooms: Map<String, String>, family: (String, String) -> Boolean = { _, _ -> false }): String? {
        for (t in tenants) if (rooms[t.id] == null) return "${t.name}還沒有房間"
        for (r in h.bedrooms) { val n = tenants.count { rooms[it.id] == r.id }; if (n > r.sleeps) return "${r.zh}只睡得下 ${r.sleeps} 位" }
        for (r in h.bedrooms) { val inRoom = tenants.filter { rooms[it.id] == r.id }; val kids = inRoom.filter { !it.adult }; val grown = inRoom.filter { it.adult }
            if (kids.isNotEmpty() && grown.isNotEmpty() && kids.any { k -> grown.any { g -> !family(k.id, g.id) } }) return "未成年和成年住民不同房，除非是家人（在關係裡設定）" }
        return null
    }
}
