package app.ocshimeji.core.model

import kotlinx.serialization.Serializable

/** Stable string ids keep saves and asset packs readable and mergeable. */
@JvmInline @Serializable value class CharacterId(val value: String)
@JvmInline @Serializable value class ItemId(val value: String)
@JvmInline @Serializable value class PlaceId(val value: String)
@JvmInline @Serializable value class AssetId(val value: String)

/** The five life needs shown on the profile screen (0f = empty, 1f = full). */
enum class Need { FULLNESS, ENERGY, MOOD, SOCIAL, HYGIENE }

@Serializable
data class Needs(val values: Map<Need, Float> = Need.entries.associateWith { 0.8f }) {
    operator fun get(n: Need): Float = values[n] ?: 0f
    fun with(n: Need, v: Float): Needs = copy(values = values + (n to v.coerceIn(0f, 1f)))
    fun adjust(n: Need, delta: Float): Needs = with(n, get(n) + delta)
}

/** Facing used by the rig. Turns are continuous (-1..1) in vector styles, snapped in pixel style. */
@Serializable
data class Facing(val side: Float = 0f, val back: Float = 0f)

/**
 * Modular appearance: every slot references a part asset that can be swapped,
 * recoloured, imported and exported independently (see docs/asset-format.md).
 */
@Serializable
data class Appearance(
    val body: AssetId = AssetId("body.round"),
    val ears: AssetId = AssetId("ears.cat"),
    val eyes: AssetId = AssetId("eyes.round"),
    val brows: AssetId = AssetId("brows.soft"),
    val mouth: AssetId = AssetId("mouth.cat"),
    val cheeks: AssetId = AssetId("cheeks.blush"),
    val markings: AssetId? = null,
    val tail: AssetId = AssetId("tail.cat"),
    val outfit: List<AssetId> = emptyList(),
    val palette: Map<String, String> = mapOf("fur" to "#FFF6EC", "shade" to "#F1DCCB", "cheek" to "#F7A39A"),
)

@Serializable
data class Trait(val id: String, val nameZh: String, val weights: Map<String, Float> = emptyMap())

@Serializable
data class Relationship(val other: CharacterId, val affinity: Float = 0f, val label: String = "")

@Serializable
data class OcCharacter(
    val id: CharacterId,
    val name: String,
    val appearance: Appearance = Appearance(),
    val traits: List<Trait> = emptyList(),
    val needs: Needs = Needs(),
    val relationships: List<Relationship> = emptyList(),
    val birthday: String = "",
    val isPlayerOc: Boolean = false,
)

@Serializable
data class WorldClock(val day: Int = 1, val minuteOfDay: Int = 10 * 60) {
    /** 0 = noon light, 1 = deep night. Drives the lighting tint in every art direction. */
    val nightAmount: Float get() {
        val h = minuteOfDay / 60f
        return when {
            h < 5f -> 1f
            h < 7f -> 1f - (h - 5f) / 2f
            h < 17f -> 0f
            h < 21f -> (h - 17f) / 4f
            else -> 1f
        }
    }
    fun advance(minutes: Int): WorldClock {
        val total = minuteOfDay + minutes
        return WorldClock(day + total / (24 * 60), total % (24 * 60))
    }
}

enum class Weather { CLEAR, CLOUDY, RAIN, SNOW, PETALS }

/** Global quality setting, chosen by the player (docs/architecture.md §Performance modes). */
enum class PerformanceMode(val targetFps: Int, val maxParticles: Int, val ambientAnim: Boolean, val lighting: Boolean) {
    HIGH(60, 400, true, true),
    BALANCED(60, 150, true, true),
    SAVER(30, 40, false, false),
}
