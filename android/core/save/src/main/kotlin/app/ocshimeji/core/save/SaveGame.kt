package app.ocshimeji.core.save

import app.ocshimeji.core.model.OcCharacter
import app.ocshimeji.core.model.PerformanceMode
import app.ocshimeji.core.model.WorldClock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Save file = versioned JSON snapshot + separate binary asset store for player art
 * (PNG frames/parts are never inlined). Atomic write: temp file + rename.
 * Migrations are explicit functions v(n) -> v(n+1), never silent defaults.
 */
@Serializable
data class SaveGame(
    val schema: Int = SCHEMA,
    val clock: WorldClock = WorldClock(),
    val characters: List<OcCharacter> = emptyList(),
    val coins: Int = 0,
    val inventory: Map<String, Int> = emptyMap(),
    val placedFurniture: List<PlacedItem> = emptyList(),
    val settings: Settings = Settings(),
) { companion object { const val SCHEMA = 1 } }

@Serializable data class PlacedItem(val itemId: String, val placeId: String, val x: Float, val y: Float, val rotation: Int = 0)

@Serializable
data class Settings(
    val theme: String = "system",          // "light" | "dark" | "system"
    val performance: PerformanceMode = PerformanceMode.BALANCED,
    val overlayEnabled: Boolean = false,
    val overlayScale: Float = 1f,
    val reduceMotion: Boolean = false,
    val language: String = "zh-TW",
)

interface SaveStore {
    suspend fun load(slot: String = "main"): SaveGame?
    suspend fun save(game: SaveGame, slot: String = "main")
}

object SaveCodec {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    fun encode(g: SaveGame): String = json.encodeToString(SaveGame.serializer(), g)
    fun decode(s: String): SaveGame {
        val g = json.decodeFromString(SaveGame.serializer(), s)
        require(g.schema <= SaveGame.SCHEMA) { "save schema ${g.schema} is newer than this app" }
        return g // future: run migrations for g.schema < SCHEMA
    }
}
