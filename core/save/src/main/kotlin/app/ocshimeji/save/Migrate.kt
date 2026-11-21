package app.ocshimeji.save

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * Save versions start at 1 with the reboot (old 0.x saves are not read). Every later change to a format adds one step here
 * (from → from + 1) and a test with a real file of the old version. Steps are never removed.
 */
object Migrate {
    /** world format: version → step to the next version */
    val WORLD: Map<Int, (JsonObject) -> JsonObject> = emptyMap()

    fun upgrade(json: JsonObject, target: Int, steps: Map<Int, (JsonObject) -> JsonObject>): JsonObject {
        var o = json; var v = o["v"]?.jsonPrimitive?.intOrNull ?: 1
        require(v <= target) { "存檔版本 $v 比這個 App 支援的 $target 新，請先更新 App" }
        while (v < target) { val f = steps[v] ?: error("沒有從版本 $v 升級的方法"); o = JsonObject(f(o).toMutableMap().apply { put("v", JsonPrimitive(v + 1)) }); v++ }
        return o
    }
}
