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
    )

    fun upgrade(json: JsonObject, target: Int, steps: Map<Int, (JsonObject) -> JsonObject>): JsonObject {
        var o = json; var v = o["v"]?.jsonPrimitive?.intOrNull ?: 1
        require(v <= target) { "存檔版本 $v 比這個 App 支援的 $target 新，請先更新 App" }
        while (v < target) { val f = steps[v] ?: error("沒有從版本 $v 升級的方法"); o = JsonObject(f(o).toMutableMap().apply { put("v", JsonPrimitive(v + 1)) }); v++ }
        return o
    }
}
