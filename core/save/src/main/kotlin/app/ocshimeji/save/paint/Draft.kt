package app.ocshimeji.save.paint

import app.ocshimeji.save.media.Raster
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.util.zip.Deflater
import java.util.zip.Inflater

/**
 * A paint draft on disk (plan 12.6 自動保存草稿): `doc.json` (size, template, layers, swatches, brush) plus one file per layer with
 * its pixels, deflated. Lossless and pure Kotlin (no platform decoder), so a draft reopens exactly as it was.
 */
@Serializable
class DraftMeta(val v: Int = 1, val name: String, val w: Int, val h: Int, val template: String, val tile: Boolean, val layers: List<DraftLayer>, val current: Int,
                val swatches: List<Int> = emptyList(), val tool: String = "PEN", val color: Int = 0, val size: Float = 12f, val updated: Long = 0,
                /** what it is for: "" / "char:<id>:<action>:<frame>" (an animation frame) / "item:<id>" / "face:<id>:<emotion>" */
                val target: String = "")
@Serializable class DraftLayer(val name: String, val opacity: Float, val visible: Boolean, val trace: Boolean = false)

object Draft {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    fun encode(doc: PaintDoc, name: String, updated: Long, target: String = ""): Map<String, ByteArray> {
        val meta = DraftMeta(name = name, w = doc.w, h = doc.h, template = doc.template.name, tile = doc.tile, layers = doc.layers.map { DraftLayer(it.name, it.opacity, it.visible, it.trace) },
            current = doc.current, swatches = doc.swatches.toList(), tool = doc.brush.tool.name, color = doc.brush.color, size = doc.brush.size, updated = updated, target = target)
        val out = LinkedHashMap<String, ByteArray>(); out["doc.json"] = json.encodeToString(meta).encodeToByteArray()
        doc.layers.forEachIndexed { i, l -> out["L$i.bin"] = pack(l.r.px) }
        return out
    }
    fun meta(bytes: ByteArray): DraftMeta = json.decodeFromString(bytes.decodeToString())
    /** files → the document; throws with a reason when something is missing or broken */
    fun decode(read: (String) -> ByteArray?): Pair<PaintDoc, DraftMeta> {
        val m = meta(read("doc.json") ?: throw IllegalArgumentException("草稿壞掉了：沒有 doc.json"))
        require(m.w in 1..4096 && m.h in 1..4096) { "草稿的大小不對" }
        val t = runCatching { Template.valueOf(m.template) }.getOrDefault(Template.CHARACTER)
        val doc = PaintDoc(m.w, m.h, t, m.tile); doc.layers.clear()
        m.layers.forEachIndexed { i, dl -> val px = unpack(read("L$i.bin") ?: throw IllegalArgumentException("草稿壞掉了：少了第 ${i + 1} 個圖層"), m.w * m.h)
            doc.layers += Layer(dl.name, Raster(m.w, m.h, px), dl.opacity, dl.visible, dl.trace) }
        if (doc.layers.isEmpty()) doc.layers += Layer("圖層 1", Raster(m.w, m.h))
        doc.current = m.current.coerceIn(0, doc.layers.size - 1); doc.swatches += m.swatches
        runCatching { doc.brush.tool = Tool.valueOf(m.tool) }; if (m.color != 0) doc.brush.color = m.color; doc.brush.size = m.size
        doc.dirty = false
        return doc to m
    }
    fun pack(px: IntArray): ByteArray {
        val bb = ByteBuffer.allocate(px.size * 4); bb.asIntBuffer().put(px)
        val d = Deflater(6); d.setInput(bb.array()); d.finish(); val o = ByteArrayOutputStream(); val buf = ByteArray(65536)
        while (!d.finished()) { val n = d.deflate(buf); o.write(buf, 0, n) }; d.end(); return o.toByteArray()
    }
    fun unpack(b: ByteArray, n: Int): IntArray {
        val inf = Inflater(); inf.setInput(b); val raw = ByteArray(n * 4); var off = 0
        while (off < raw.size && !inf.finished()) { val k = inf.inflate(raw, off, raw.size - off); if (k == 0 && (inf.needsInput() || inf.needsDictionary())) break; off += k }
        inf.end(); require(off == raw.size) { "草稿的圖層資料不完整" }
        val px = IntArray(n); ByteBuffer.wrap(raw).asIntBuffer().get(px); return px
    }
}
