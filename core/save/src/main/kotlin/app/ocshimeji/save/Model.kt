package app.ocshimeji.save

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.life.Life
import kotlinx.serialization.Serializable

/*
 * Two layers (plan 12.1 / 12.10):
 *   library/   everything shared by all saves — characters (their originals), and later animations, items, music…
 *   saves/<id>/ one world each — its residents (copies that live their own lives), house, relationships, time…
 * A save refers to library assets by id; exporting a save (.ocsave, M1) packs what it uses.
 */

const val LIBRARY_VERSION = 1
const val WORLD_VERSION = 4

/** a character as it sits in the library (its original) */
@Serializable
data class LibChar(
    val id: String,
    val name: String,
    val species: String = "未知",
    /** "preset" = built into the app (cannot be deleted from the library); "import" / "drawn" = made by the player */
    val source: String = "import",
    /** the standing image (library-relative path, or "asset:" for images inside the app) */
    val image: String,
    /** where the feet are, as a fraction of the image (0..1) */
    val footX: Float = 0.5f, val footY: Float = 1f,
    val traits: List<String> = emptyList(),
    val likes: List<String> = emptyList(),
    val created: Long = 0,
    /** adult or not (house rules; romance never involves minors) */
    val adult: Boolean = true,
    /** which way the drawing faces: -1 left, 1 right (the renderer mirrors it when walking the other way) */
    val facing: Int = 1,
    /** the drawing had no transparent background when imported (the importer can remove it) */
    val opaque: Boolean = false,
    /** who they are (M2); null for characters made before M2 — `specOf()` fills it from the old fields */
    val spec: CharSpec? = null,
    /** the player's own animations: action → frames (plan 3.3) */
    val anims: Map<String, Anim> = emptyMap(),
    /** 系統預設 / 混合 / 我的 (plan 12.7) */
    val animSource: String = "混合",
    /** per action: true = use mine, false = use the system's (overrides animSource) */
    val animUse: Map<String, Boolean> = emptyMap(),
    /** expression variants: emotion (happy, angry, sad, shy, sleep, surprised) → image (plan P-17) */
    val faces: Map<String, String> = emptyMap(),
    /** marks on the picture (fractions of the image): 頭, 臉, 手, 耳朵, 尾巴, 身體 (plan 13.3) */
    val marks: Map<String, Mark> = emptyMap(),
    /** mirror when walking the other way (off for asymmetric characters) */
    val flip: Boolean = true,
) {
    fun specOf(): CharSpec = spec ?: CharSpec.fromWords(name, adult, traits, likes).copy(species = species)
}

/** an animation: frames (library-relative image paths), each frame's time, looping or once */
@Serializable
data class Anim(val frames: List<String>, val ms: List<Int>, val loop: Boolean = true)
/** a circle on the picture, as fractions of its width / height */
@Serializable
data class Mark(val x: Float, val y: Float, val r: Float)

@Serializable
data class LibraryIndex(val v: Int = LIBRARY_VERSION, val chars: List<LibChar> = emptyList())

/** one save as the save menu shows it (kept in saves/index.json so the menu never has to open every world) */
@Serializable
data class SlotMeta(
    val id: String,
    val name: String,
    val created: Long,
    val lastPlayed: Long,
    val playSeconds: Long = 0,
    val day: Long = 1,
    /** the library ids of the residents (faces on the card) */
    val residents: List<String> = emptyList(),
    /** a copy made with 複製 / 分支 remembers where it came from */
    val from: String? = null,
)

@Serializable
data class SaveIndex(val v: Int = 1, val slots: List<SlotMeta> = emptyList())

/** a resident of one world — a copy of a library character that lives its own life here */
@Serializable
data class Resident(val id: String, val libId: String, val name: String)

@Serializable
data class World(
    val v: Int = WORLD_VERSION,
    val seed: Long,
    val created: Long,
    val townName: String = "",
    val clockMode: String = "REAL",
    val minute: Double = 0.0,
    val residents: List<Resident> = emptyList(),
    /** the life of this world (M1+); null only for worlds made by M0 — they get a house when opened */
    val life: Life? = null,
)
