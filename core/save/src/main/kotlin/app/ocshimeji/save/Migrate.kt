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
    )

    fun upgrade(json: JsonObject, target: Int, steps: Map<Int, (JsonObject) -> JsonObject>): JsonObject {
        var o = json; var v = o["v"]?.jsonPrimitive?.intOrNull ?: 1
        require(v <= target) { "存檔版本 $v 比這個 App 支援的 $target 新，請先更新 App" }
        while (v < target) { val f = steps[v] ?: error("沒有從版本 $v 升級的方法"); o = JsonObject(f(o).toMutableMap().apply { put("v", JsonPrimitive(v + 1)) }); v++ }
        return o
    }
}
