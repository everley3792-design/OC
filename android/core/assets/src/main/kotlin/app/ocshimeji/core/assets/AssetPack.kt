package app.ocshimeji.core.assets

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * `.ocpack` = a zip with `manifest.json` + PNG layers (+ optional clips).
 * Used for: shipped part libraries, player-made parts/OCs, import/export & sharing.
 * Full spec: docs/asset-format.md. This file is the single source of truth for the schema.
 */
@Serializable
data class PackManifest(
    val format: String = "ocpack",
    val version: Int = CURRENT_VERSION,
    val id: String,
    val name: String,
    val author: String = "",
    /** Art direction the pack was drawn for: "mallow" | "pixel" | "sketch". Parts are style-locked. */
    val style: String,
    val parts: List<PartDef> = emptyList(),
    val clips: List<String> = emptyList(),
) {
    companion object { const val CURRENT_VERSION = 1 }
}

enum class Slot { BODY, HEAD, EARS, EYES, BROWS, MOUTH, CHEEKS, MARKINGS, TAIL, OUTFIT, ACCESSORY, HELD }

@Serializable
data class PartDef(
    val id: String,
    val slot: Slot,
    /** Layers drawn back-to-front; each PNG is premultiplied-alpha free, sRGB. */
    val layers: List<LayerDef>,
    /** Named recolour channels mapped to mask PNGs (e.g. "fur" -> "body_fur_mask.png"). */
    val tintMasks: Map<String, String> = emptyMap(),
    /** Views this part supports; renderer falls back to the nearest one. */
    val views: List<String> = listOf("front", "side", "back"),
    val tags: List<String> = emptyList(),
)

@Serializable
data class LayerDef(
    val file: String,
    /** Anchor in source pixels — aligns to the rig socket for [PartDef.slot]. */
    val anchorX: Int,
    val anchorY: Int,
    val view: String = "front",
    val z: Int = 0,
)

object PackCodec {
    val json = Json { ignoreUnknownKeys = true; prettyPrint = true; encodeDefaults = true }
    fun encode(m: PackManifest): String = json.encodeToString(PackManifest.serializer(), m)
    fun decode(s: String): PackManifest {
        val m = json.decodeFromString(PackManifest.serializer(), s)
        require(m.format == "ocpack") { "not an ocpack" }
        require(m.version <= PackManifest.CURRENT_VERSION) { "pack version ${m.version} is newer than this app" }
        require(m.style in setOf("mallow", "pixel", "sketch")) { "unknown style ${m.style}" }
        return m
    }
}
