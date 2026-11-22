package app.ocshimeji.sim.house

/**
 * Furniture kinds. Every piece "advertises" what can be done with it (the activities in life/Activities.kt name the kind they need);
 * slots are where a character stands / sits / lies while using it, relative to the piece's top-left tile.
 * Sizes are in floor tiles (x right, y = depth, toward the viewer).
 */
enum class Spot { STAND, SIT, LIE }
data class Slot(val dx: Float, val dy: Float, val pose: Spot)
data class FurnitureKind(val id: String, val zh: String, val w: Int, val h: Int, val blocks: Boolean, val slots: List<Slot>, val againstWall: Boolean = false,
    /** the built-in kinds whose activities it offers (a player's sofa sits like a sofa) */
    val actsAs: Set<String> = emptySet(),
    /** the player's own furniture: its picture (library path) */
    val image: String = "",
    /** hangs on the back wall (stickers): placed on a room's wall row, nobody walks into it */
    val wall: Boolean = false)

object Furniture {
    val KINDS: Map<String, FurnitureKind> = listOf(
        FurnitureKind("bed", "床", 1, 2, true, listOf(Slot(0.5f, 1.1f, Spot.LIE))),
        FurnitureKind("bed2", "雙人床", 2, 2, true, listOf(Slot(0.5f, 1.1f, Spot.LIE), Slot(1.5f, 1.1f, Spot.LIE))),
        FurnitureKind("fridge", "冰箱", 1, 1, true, listOf(Slot(0.5f, 1.45f, Spot.STAND)), againstWall = true),
        FurnitureKind("stove", "爐台", 1, 1, true, listOf(Slot(0.5f, 1.45f, Spot.STAND)), againstWall = true),
        FurnitureKind("table", "餐桌", 2, 1, true, listOf(Slot(0.5f, 1.5f, Spot.SIT), Slot(1.5f, 1.5f, Spot.SIT))),
        FurnitureKind("sofa", "沙發", 2, 1, true, listOf(Slot(0.5f, 0.9f, Spot.SIT), Slot(1.5f, 0.9f, Spot.SIT))),
        FurnitureKind("tv", "電視", 1, 1, true, listOf(), againstWall = true),
        FurnitureKind("tub", "浴缸", 2, 1, true, listOf(Slot(1f, 0.75f, Spot.SIT)), againstWall = true),
        FurnitureKind("mirror", "鏡子", 1, 1, false, listOf(Slot(0.5f, 1.3f, Spot.STAND)), againstWall = true),
        FurnitureKind("shelf", "書架", 1, 1, true, listOf(Slot(0.5f, 1.45f, Spot.STAND)), againstWall = true),
        FurnitureKind("plant", "盆栽", 1, 1, true, listOf(Slot(0.5f, 1.45f, Spot.STAND))),
        FurnitureKind("window", "窗戶", 2, 1, false, listOf(Slot(1f, 1.3f, Spot.STAND)), againstWall = true),
        FurnitureKind("rug", "地毯", 2, 2, false, listOf(Slot(1f, 1f, Spot.SIT))),
        FurnitureKind("lamp", "落地燈", 1, 1, true, listOf()),
        FurnitureKind("garden", "菜園", 2, 1, true, listOf(Slot(1f, 1.45f, Spot.STAND))),
        FurnitureKind("line", "曬衣架", 2, 1, true, listOf(Slot(1f, 1.45f, Spot.STAND))),
        /* 1.9.0 G-08: a frame on the wall showing your latest photo; they stop to look at it */
        FurnitureKind("frame", "回憶相框", 1, 1, false, listOf(Slot(0.5f, 1.3f, Spot.STAND)), againstWall = true),
        FurnitureKind("bench", "長椅", 2, 1, true, listOf(Slot(0.5f, 0.9f, Spot.SIT), Slot(1.5f, 0.9f, Spot.SIT)), actsAs = setOf("sofa")),
    ).associateBy { it.id }
    /** the player's furniture of the open world ("item:<id>"), registered when the world opens (content data, like the built-in table) */
    private val custom = HashMap<String, FurnitureKind>()
    fun register(k: FurnitureKind) { custom[k.id] = k }
    fun kind(id: String) = KINDS[id] ?: custom[id] ?: FurnitureKind(id, "家具", 1, 1, true, emptyList())   /* an item that is gone: a plain box, never a crash */
    fun known(id: String) = KINDS.containsKey(id) || custom.containsKey(id)
}
