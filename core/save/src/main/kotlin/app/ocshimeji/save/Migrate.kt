package app.ocshimeji.save

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * Save versions start at 1 with the reboot (old 0.x saves are not read). Every later change to a format adds one step here
 * (from → from + 1) and a test with a real file of the old version. Steps are never removed.
 */
object Migrate {
    /** world format: version → step to the next version */
    val WORLD: Map<Int, (JsonObject) -> JsonObject> = mapOf(
        /* 1 → 2 (M2): a resident's few fields (name, adult, axes, likes, wake, sleep) become its full CharSpec */
        1 to { w ->
            val life = w["life"] as? JsonObject
            if (life == null) w else {
                val people = (life["people"] as? JsonArray)?.map { p0 ->
                    val p = p0 as JsonObject; val m = p.toMutableMap()
                    val spec = buildJsonObject {
                        put("name", p["name"] ?: JsonPrimitive("角色")); put("age", JsonPrimitive(if ((p["adult"] as? JsonPrimitive)?.booleanOrNull == false) 12 else 20))
                        p["axes"]?.let { put("axes", it) }; p["likes"]?.let { put("likes", it) }; p["wake"]?.let { put("wake", it) }; p["sleep"]?.let { put("sleep", it) }
                    }
                    for (k in listOf("name", "adult", "axes", "likes", "wake", "sleep")) m.remove(k)
                    m["spec"] = spec; JsonObject(m)
                } ?: emptyList()
                JsonObject(w.toMutableMap().apply { put("life", JsonObject(life.toMutableMap().apply { put("people", JsonArray(people)) })) })
            }
        },
        /* 2 → 3 (M3): residents can be out on the phone's desktop; an old world has everyone at home */
        2 to { w ->
            val life = w["life"] as? JsonObject
            if (life == null) w else {
                val people = (life["people"] as? JsonArray)?.map { p0 -> JsonObject((p0 as JsonObject).toMutableMap().apply { put("desk", JsonPrimitive(false)) }) } ?: emptyList()
                JsonObject(w.toMutableMap().apply { put("life", JsonObject(life.toMutableMap().apply { put("people", JsonArray(people)) })) })
            }
        },
        /* 3 → 4 (M4): the social life starts today — relationships count as seen today (nothing fades at once), the daily settlement begins now */
        3 to { w ->
            val life = w["life"] as? JsonObject
            if (life == null) w else {
                val minute = (life["minute"] as? JsonPrimitive)?.content?.toDoubleOrNull() ?: 0.0
                val start = (life["startMinute"] as? JsonPrimitive)?.content?.toDoubleOrNull() ?: minute
                val day = kotlin.math.floor(minute / 1440).toLong() - kotlin.math.floor(start / 1440).toLong() + 1
                val rels = (life["rels"] as? JsonArray)?.map { r -> JsonObject((r as JsonObject).toMutableMap().apply { put("seenDay", JsonPrimitive(day)) }) } ?: emptyList()
                val soc = buildJsonObject { put("settledDay", JsonPrimitive(day)) }
                JsonObject(w.toMutableMap().apply { put("life", JsonObject(life.toMutableMap().apply { put("rels", JsonArray(rels)); put("soc", soc) })) })
            }
        },
        /* 4 → 5 (M5): a world can hold what the player made — custom food and gifts, room decor, tags, scripts, music; old worlds start with none */
        4 to { w ->
            val life = w["life"] as? JsonObject
            if (life == null) w else JsonObject(w.toMutableMap().apply { put("life", JsonObject(life.toMutableMap().apply {
                put("items", JsonArray(emptyList())); put("decor", JsonObject(emptyMap())); put("tags", JsonArray(emptyList())); put("scripts", JsonArray(emptyList())); put("music", JsonPrimitive("")) })) })
        },
        /* 5 → 6 (M6): star coins and a bag, the town, your own arrangement of the house; an old world starts with the first 300 coins (one ledger line) */
        5 to { w ->
            val life = w["life"] as? JsonObject
            if (life == null) w else JsonObject(w.toMutableMap().apply { put("life", JsonObject(life.toMutableMap().apply {
                val minute = life["minute"] ?: JsonPrimitive(0.0)
                put("wallet", JsonPrimitive(300)); put("ledger", JsonArray(listOf(buildJsonObject { put("minute", minute); put("amount", JsonPrimitive(300)); put("reason", JsonPrimitive("開始的星幣")) })))
                put("bag", JsonObject(emptyMap())); put("layout", JsonArray(emptyList())); put("goals", JsonArray(emptyList())); put("goalsDay", JsonPrimitive(-1))
                })) })
        },
        /* 6 → 7 (M7): counts, titles, diary, dreams, achievements, the collection book, plants; an old world starts with none (what it owns goes in the book) */
        6 to { w ->
            val life = w["life"] as? JsonObject
            if (life == null) w else JsonObject(w.toMutableMap().apply { put("life", JsonObject(life.toMutableMap().apply {
                val bag = (life["bag"] as? JsonObject)?.keys.orEmpty()
                put("prog", buildJsonObject { put("book", JsonObject(bag.associateWith { JsonPrimitive(3) })) }) })) })
        },
        /* 7 → 8 (R1): memories gain a sound, a line and a length; residents count what they did today — old lines and people just start without them */
        7 to { w -> w },
        /* 8 → 9 (R2): your hand on the environment (chosen weather per day, a locked season, a paused clock) — an old world follows the date */
        8 to { w -> val life = w["life"] as? JsonObject
            if (life == null) w else JsonObject(w.toMutableMap().apply { put("life", JsonObject(life.toMutableMap().apply { put("env", buildJsonObject { put("season", JsonPrimitive("")); put("paused", JsonPrimitive(false)) }) })) }) },
        /* 9 → 10 (R3): residents get a queue of your orders after the one waiting — an old world starts with empty queues */
        9 to { w -> w },
        /* 10 → 11 (R4): how they call you has three steps now — the old single name becomes the middle one ("熟了以後") */
        10 to { w -> val life = w["life"] as? JsonObject; val people = life?.get("people") as? kotlinx.serialization.json.JsonArray
            if (life == null || people == null) w else JsonObject(w.toMutableMap().apply { put("life", JsonObject(life.toMutableMap().apply {
                put("people", kotlinx.serialization.json.JsonArray(people.map { p0 -> val p = p0 as? JsonObject ?: return@map p0; val spec = p["spec"] as? JsonObject ?: return@map p
                    val call = (spec["callPlayer"] as? JsonPrimitive)?.content ?: "你"
                    if (call == "你" || call.isBlank()) p else JsonObject(p.toMutableMap().apply { put("spec", JsonObject(spec.toMutableMap().apply { put("address", buildJsonObject { put("close", JsonPrimitive(call)) }) })) }) })) })) }) },
        /* 11 → 12 (R5): how things look — kept states (a messy bed, a book left out) and things on the floor; an old home starts neat */
        11 to { w -> w },
        /* 12 → 13 (1.5.1): picked-up catchphrases (none yet) and the phone's time-zone offset (unknown until the next look) */
        12 to { w -> w },
        /* 13 → 14 (R6): things on the phone's desktop (none yet) */
        13 to { w -> w },
        /* 14 → 15 (1.7.0): the bigger stories — dreams, fears, sickness, crazes, gossip, nicknames, secrets, cliques, decisions (none yet) */
        14 to { w -> w },
    )

    fun upgrade(json: JsonObject, target: Int, steps: Map<Int, (JsonObject) -> JsonObject>): JsonObject {
        var o = json; var v = o["v"]?.jsonPrimitive?.intOrNull ?: 1
        require(v <= target) { "存檔版本 $v 比這個 App 支援的 $target 新，請先更新 App" }
        while (v < target) { val f = steps[v] ?: error("沒有從版本 $v 升級的方法"); o = JsonObject(f(o).toMutableMap().apply { put("v", JsonPrimitive(v + 1)) }); v++ }
        return o
    }
}
