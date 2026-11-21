package app.ocshimeji.save.media

import app.ocshimeji.save.ImageCheck
import app.ocshimeji.save.ImageInfo
import app.ocshimeji.save.Mark
import app.ocshimeji.sim.chars.CharSpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream

/** the actions a character can have (plan 3.3) and what stands in for a missing one */
object Actions {
    val ALL = listOf("idle", "walk", "run", "sit", "sleep", "eat", "drink", "talk", "think", "read", "play", "work", "bathe",
        "happy", "angry", "sad", "shy", "surprised", "bored", "clicked", "petted", "held", "thrown", "land", "dizzy", "climb", "hang", "peek", "fall")
    val ZH = mapOf("idle" to "待機", "walk" to "走路", "run" to "跑步", "sit" to "坐著", "sleep" to "睡覺", "eat" to "吃東西", "drink" to "喝東西", "talk" to "說話", "think" to "想事情",
        "read" to "看書", "play" to "玩", "work" to "做事", "bathe" to "洗澡", "happy" to "開心", "angry" to "生氣", "sad" to "難過", "shy" to "害羞", "surprised" to "驚訝", "bored" to "無聊",
        "clicked" to "被點", "petted" to "被摸", "held" to "被抱起", "thrown" to "被丟", "land" to "落地", "dizzy" to "頭暈", "climb" to "爬牆", "hang" to "倒吊", "peek" to "偷看", "fall" to "掉落")
    /** the 備用鏈: without this action, try the next one; the last resort is always idle (+ procedural motion) */
    val FALLBACK = mapOf("run" to "walk", "walk" to "idle", "sit" to "idle", "sleep" to "sit", "eat" to "talk", "drink" to "eat", "talk" to "idle", "think" to "idle", "read" to "sit",
        "play" to "happy", "work" to "sit", "bathe" to "sit", "happy" to "idle", "angry" to "idle", "sad" to "idle", "shy" to "idle", "surprised" to "happy", "bored" to "sad",
        "clicked" to "happy", "petted" to "happy", "held" to "idle", "thrown" to "held", "land" to "dizzy", "dizzy" to "idle", "climb" to "held", "hang" to "held", "peek" to "idle", "fall" to "thrown")
    /** the first action in the chain that exists; null = nothing drawn for it (play the procedural idle) */
    fun resolve(action: String, has: (String) -> Boolean): String? { var a: String? = action; var n = 0; while (a != null && n < 12) { if (has(a)) return a; a = FALLBACK[a]; n++ }; return if (has("idle")) "idle" else null }
    private val WORDS = mapOf("idle" to listOf("idle", "stand", "待機", "站"), "walk" to listOf("walk", "走"), "run" to listOf("run", "跑"), "sit" to listOf("sit", "坐"), "sleep" to listOf("sleep", "睡"),
        "eat" to listOf("eat", "吃"), "drink" to listOf("drink", "喝"), "talk" to listOf("talk", "speak", "說"), "think" to listOf("think", "想"), "read" to listOf("read", "書"), "play" to listOf("play", "玩"),
        "work" to listOf("work", "工作", "做事"), "bathe" to listOf("bath", "洗"), "happy" to listOf("happy", "joy", "開心", "笑"), "angry" to listOf("angry", "mad", "生氣", "怒"), "sad" to listOf("sad", "cry", "難過", "哭"),
        "shy" to listOf("shy", "blush", "害羞"), "surprised" to listOf("surprise", "驚"), "bored" to listOf("bored", "無聊"), "clicked" to listOf("click", "tap", "點"), "petted" to listOf("pet", "摸"),
        "held" to listOf("held", "hold", "grab", "抱", "拎"), "thrown" to listOf("throw", "thrown", "丟"), "land" to listOf("land", "落地"), "dizzy" to listOf("dizzy", "暈"), "climb" to listOf("climb", "爬"),
        "hang" to listOf("hang", "吊"), "peek" to listOf("peek", "偷看"), "fall" to listOf("fall", "掉"))
    /** "walk_03.png" → (walk, 3); unknown words → (null, number) */
    fun guess(name: String): Pair<String?, Int> {
        val base = name.substringAfterLast('/').substringBeforeLast('.').lowercase()
        val num = Regex("(\\d+)\\D*$").find(base)?.groupValues?.get(1)?.toIntOrNull() ?: 0
        val words = base.replace(Regex("\\d+"), " ")
        val hit = WORDS.entries.firstOrNull { (a, ws) -> words.split(Regex("[_\\-\\s.]+")).any { it == a } } ?: WORDS.entries.firstOrNull { (_, ws) -> ws.any { words.contains(it) } }
        return hit?.key to num
    }
}

/** frames per action, before preparing (any sizes) */
class Clip(val frames: MutableList<Raster> = ArrayList(), val ms: MutableList<Int> = ArrayList(), var loop: Boolean = true)
class Imported(val kind: String, val clips: LinkedHashMap<String, Clip>, val warnings: MutableList<String> = ArrayList(), val pkg: PkgManifest? = null, val faces: MutableMap<String, Raster> = LinkedHashMap(), val pkgMarks: Map<String, Mark> = emptyMap()) {
    val frameCount get() = clips.values.sumOf { it.frames.size }
}
/** ready to save: one canvas size for every frame, scaled together, background removed if asked, feet found */
class Prepared(val w: Int, val h: Int, val clips: LinkedHashMap<String, Clip>, val info: ImageInfo, val opaque: Boolean, val warnings: List<String>, val faces: Map<String, Raster>, val scale: Double)

/** `.ocpkg` manifest (plan 3.1): format, version, name, author, actions, anchors, size, personality, licence */
@Serializable
data class PkgManifest(val format: String = "ocpkg", val v: Int = 1, val name: String = "", val author: String = "", val license: String = "",
                       val foot: List<Float> = listOf(0.5f, 1f), val facing: Int = 1, val flip: Boolean = true,
                       val actions: Map<String, PkgAction> = emptyMap(), val faces: Map<String, String> = emptyMap(), val marks: Map<String, Mark> = emptyMap(), val spec: CharSpec? = null)
@Serializable data class PkgAction(val frames: List<String>, val ms: List<Int> = emptyList(), val loop: Boolean = true)

/**
 * Everything the importer accepts (plan 3.1 / 12.8): a single picture (PNG, WebP, JPEG, GIF), a PNG sequence (several files or a ZIP;
 * file names decide the action), a sprite sheet (a grid, or an image plus its JSON atlas — Aseprite tags become actions), GIF / APNG /
 * animated WebP, and our own `.ocpkg`. Nothing is executed; every refusal says why.
 */
object Importer {
    const val MAX_SIDE = 4096; const val MAX_FRAMES = 600; const val MAX_BYTES = 64L * 1024 * 1024; const val WORK = 1024; const val PKG_VERSION = 1
    class Source(val name: String, val bytes: ByteArray)
    class Options(val cols: Int = 0, val rows: Int = 0, val ms: Int = 120, val action: String? = null, val removeBg: Boolean? = null, val tolerance: Int = 40)
    private val json = Json { ignoreUnknownKeys = true }
    private fun bad(why: String): Nothing = throw IllegalArgumentException(why)

    fun read(sources: List<Source>, codec: Codec, o: Options = Options()): Imported {
        if (sources.isEmpty()) bad("沒有選任何檔案")
        if (sources.sumOf { it.bytes.size.toLong() } > MAX_BYTES) bad("檔案加起來超過 64 MB")
        if (sources.size == 1) {
            val s = sources[0]
            return when (Sniff.kind(s.bytes)) {
                "zip" -> zip(s, codec, o)
                "json" -> bad("只有圖集描述（JSON），還要一起選它的圖片")
                null -> bad("看不懂「${s.name}」（支援 PNG、WebP、JPEG、GIF、APNG、ZIP、.ocpkg）")
                else -> one(s, codec, o)
            }
        }
        val js = sources.filter { Sniff.kind(it.bytes) == "json" }; val imgs = sources.filter { Sniff.kind(it.bytes).let { k -> k != null && k != "json" && k != "zip" } }
        sources.firstOrNull { Sniff.kind(it.bytes) == null }?.let { bad("看不懂「${it.name}」") }
        if (js.size == 1 && imgs.size == 1) return atlas(imgs[0], js[0], codec, o)
        if (js.isNotEmpty()) bad("圖集要剛好一張圖配一個 JSON")
        return sequence(imgs, codec, o)
    }

    // ---------------- single files ----------------
    private fun decode(s: Source, codec: Codec): Raster {
        val size = ImageSize.of(s.bytes) ?: bad("「${s.name}」的檔頭壞掉了")
        if (size.first > MAX_SIDE || size.second > MAX_SIDE) bad("「${s.name}」太大（${size.first}×${size.second}），單張最大 $MAX_SIDE px，請先縮小")
        return codec.safe(s.bytes) ?: bad("「${s.name}」解不開（檔案可能壞掉了）")
    }
    private fun anim(s: Source, codec: Codec): Anim? {
        val size = ImageSize.of(s.bytes); if (size != null && (size.first > MAX_SIDE || size.second > MAX_SIDE)) bad("「${s.name}」太大（${size.first}×${size.second}），單張最大 $MAX_SIDE px")
        return when (Sniff.kind(s.bytes)) {
            "gif" -> Formats.gif(s.bytes, MAX_FRAMES).takeIf { it.frames.size > 1 }
            "png" -> if (Formats.isApng(s.bytes)) Formats.apng(s.bytes, codec, MAX_FRAMES) else null
            "webp" -> if (Formats.isAnimatedWebp(s.bytes)) Formats.webp(s.bytes, codec, MAX_FRAMES) else null
            else -> null
        }
    }
    private fun one(s: Source, codec: Codec, o: Options): Imported {
        val action = o.action ?: Actions.guess(s.name).first ?: "idle"
        anim(s, codec)?.let { a -> return Imported(when (Sniff.kind(s.bytes)) { "gif" -> "gif"; "png" -> "apng"; else -> "webp" }, linkedMapOf(action to Clip(a.frames.map { it.img }.toMutableList(), a.frames.map { it.ms }.toMutableList()))) }
        val img = if (Sniff.kind(s.bytes) == "gif") Formats.gif(s.bytes, 1).frames[0].img else decode(s, codec)
        if (o.cols > 0 && o.rows > 0) { val fs = Formats.grid(img, o.cols, o.rows, o.ms); return Imported("sheet", linkedMapOf(action to Clip(fs.map { it.img }.toMutableList(), fs.map { it.ms }.toMutableList()))) }
        return Imported("single", linkedMapOf("idle" to Clip(mutableListOf(img), mutableListOf(o.ms))))
    }
    // ---------------- PNG sequences (files or a ZIP) ----------------
    private fun sequence(files: List<Source>, codec: Codec, o: Options): Imported {
        if (files.isEmpty()) bad("裡面沒有圖片")
        val groups = LinkedHashMap<String, MutableList<Pair<Int, Source>>>(); val warn = ArrayList<String>()
        for (f in files) { val (a, n) = Actions.guess(f.name); val act = a ?: o.action ?: "idle"; if (a == null && o.action == null) warn += "「${f.name.substringAfterLast('/')}」的名字看不出動作，當成待機"; groups.getOrPut(act) { ArrayList() } += n to f }
        val clips = LinkedHashMap<String, Clip>()
        for (act in Actions.ALL.filter { it in groups } + groups.keys.filter { it !in Actions.ALL }) {
            val c = Clip()
            for ((_, f) in groups[act]!!.sortedWith(compareBy({ it.first }, { it.second.name }))) {
                val a = anim(f, codec)
                if (a != null) a.frames.forEach { c.frames += it.img; c.ms += it.ms } else { c.frames += if (Sniff.kind(f.bytes) == "gif") Formats.gif(f.bytes, 1).frames[0].img else decode(f, codec); c.ms += o.ms }
                if (c.frames.size > MAX_FRAMES) bad("影格太多（超過 $MAX_FRAMES 格）")
            }
            clips[act] = c
        }
        return Imported("sequence", clips, warn.take(5).toMutableList())
    }
    private fun zip(s: Source, codec: Codec, o: Options): Imported {
        val files = LinkedHashMap<String, ByteArray>()
        try { ZipInputStream(ByteArrayInputStream(s.bytes)).use { z -> var e = z.nextEntry; var total = 0L
            while (e != null) { if (!e.isDirectory) { val b = z.readBytes(); total += b.size; if (total > MAX_BYTES * 2) bad("壓縮檔解開後太大"); val n = e.name.replace('\\', '/')
                if (!n.contains("..") && !n.startsWith("/") && !n.substringAfterLast('/').startsWith(".") && !n.startsWith("__MACOSX")) files[n] = b }; e = z.nextEntry } } }
        catch (e: IllegalArgumentException) { throw e } catch (e: Exception) { bad("壓縮檔壞掉了，解不開") }
        if (files.isEmpty()) bad("壓縮檔是空的，或是壞掉了")
        files["manifest.json"]?.let { return pkg(it, files, codec) }
        val srcs = files.map { (n, b) -> Source(n, b) }
        val js = srcs.filter { Sniff.kind(it.bytes) == "json" }; val imgs = srcs.filter { Sniff.kind(it.bytes).let { k -> k != null && k != "json" && k != "zip" } }
        if (js.size == 1 && imgs.size == 1) return atlas(imgs[0], js[0], codec, o)
        if (imgs.isEmpty()) bad("壓縮檔裡沒有圖片")
        return sequence(imgs, codec, o)
    }
    // ---------------- sprite sheet + JSON atlas (TexturePacker hash/array, Aseprite with frame tags) ----------------
    private fun atlas(img: Source, js: Source, codec: Codec, o: Options): Imported {
        val sheet = decode(img, codec)
        val root = runCatching { json.parseToJsonElement(js.bytes.decodeToString()).jsonObject }.getOrElse { bad("「${js.name}」不是正確的 JSON") }
        class F(val name: String, val x: Int, val y: Int, val w: Int, val h: Int, val ms: Int)
        fun f(name: String, o2: JsonObject): F { val r = (o2["frame"] as? JsonObject) ?: bad("圖集裡「$name」沒有 frame")
            fun n(k: String) = r[k]?.jsonPrimitive?.intOrNull ?: bad("圖集裡「$name」缺少 $k")
            return F(name, n("x"), n("y"), n("w"), n("h"), o2["duration"]?.jsonPrimitive?.intOrNull ?: o.ms) }
        val frames = when (val fr = root["frames"]) {
            is JsonObject -> fr.entries.map { (k, v) -> f(k, v.jsonObject) }
            is JsonArray -> fr.mapIndexed { i, v -> val ob = v.jsonObject; f(ob["filename"]?.jsonPrimitive?.content ?: "frame$i", ob) }
            else -> bad("圖集 JSON 裡沒有 frames")
        }
        if (frames.isEmpty()) bad("圖集裡沒有影格"); if (frames.size > MAX_FRAMES) bad("影格太多（超過 $MAX_FRAMES 格）")
        val cut = frames.map { Formats.crop(sheet, it.x, it.y, it.w, it.h) to it }
        val clips = LinkedHashMap<String, Clip>(); val warn = ArrayList<String>()
        val tags = ((root["meta"] as? JsonObject)?.get("frameTags") as? JsonArray).orEmpty()
        if (tags.isNotEmpty()) for (t in tags) { val ob = t.jsonObject; val name = ob["name"]?.jsonPrimitive?.content ?: continue
            val a = if (name.lowercase() in Actions.ALL) name.lowercase() else Actions.guess(name).first
            if (a == null) { warn += "標籤「$name」對不上任何動作，略過"; continue }
            val from = ob["from"]?.jsonPrimitive?.int ?: 0; val to = ob["to"]?.jsonPrimitive?.int ?: from
            val c = clips.getOrPut(a) { Clip() }; for (i in from..to) cut.getOrNull(i)?.let { (r, fr) -> c.frames += r; c.ms += fr.ms } }
        else for ((r, fr) in cut) { val a = Actions.guess(fr.name).first ?: o.action ?: "idle"; val c = clips.getOrPut(a) { Clip() }; c.frames += r; c.ms += fr.ms }
        if (clips.isEmpty()) bad("圖集裡沒有能用的動作")
        return Imported("atlas", clips, warn)
    }
    // ---------------- .ocpkg ----------------
    private fun pkg(manifest: ByteArray, files: Map<String, ByteArray>, codec: Codec): Imported {
        val m = runCatching { json.decodeFromString(PkgManifest.serializer(), manifest.decodeToString()) }.getOrElse { bad("角色包的 manifest.json 壞掉了") }
        if (m.format != "ocpkg") bad("這不是 OC Shimeji 的角色包")
        if (m.v > PKG_VERSION) bad("這個角色包來自比較新的版本（v${m.v}），請先更新 App")
        if (m.actions.isEmpty()) bad("角色包裡沒有任何動作")
        val clips = LinkedHashMap<String, Clip>()
        for ((a, pa) in m.actions) { val c = Clip(loop = pa.loop)
            pa.frames.forEachIndexed { i, n -> val b = files[n] ?: bad("角色包少了檔案：$n"); c.frames += decode(Source(n, b), codec); c.ms += pa.ms.getOrElse(i) { 120 } }
            if (c.frames.isEmpty()) bad("動作「$a」沒有影格"); clips[a] = c }
        if ("idle" !in clips) bad("角色包少了待機（idle）動作")
        if (clips.values.sumOf { it.frames.size } > MAX_FRAMES) bad("影格太多（超過 $MAX_FRAMES 格）")
        val faces = LinkedHashMap<String, Raster>(); for ((e, n) in m.faces) faces[e] = decode(Source(n, files[n] ?: bad("角色包少了檔案：$n")), codec)
        return Imported("ocpkg", clips, ArrayList(), m, faces, m.marks)
    }

    // ---------------- prepare (plan 3.2 steps 2–3) ----------------
    /** one canvas for everything (bottom-centre), one scale for every frame (≤ 1024 px), background removal, feet */
    fun prepare(im: Imported, o: Options = Options()): Prepared {
        if (im.frameCount == 0) bad("沒有任何影格"); if (im.frameCount > MAX_FRAMES) bad("影格太多（超過 $MAX_FRAMES 格）")
        val all = im.clips.values.flatMap { it.frames }
        val cw = all.maxOf { it.w }; val ch = all.maxOf { it.h }
        val (nw, nh) = Pixels.fit(cw, ch, WORK); val k = nw.toDouble() / cw
        val idle0 = im.clips["idle"]?.frames?.firstOrNull() ?: all[0]
        val wasClear = Pixels.transparentBorder(idle0)
        val remove = o.removeBg ?: !wasClear
        val out = LinkedHashMap<String, Clip>()
        for ((a, c) in im.clips) out[a] = Clip(c.frames.map { f -> var r = Pixels.resize(Pixels.pad(f, cw, ch), nw, nh); if (remove) r = Pixels.removeBackground(r, o.tolerance); r }.toMutableList(), c.ms.toMutableList(), c.loop)
        val first = out["idle"]?.frames?.firstOrNull() ?: out.values.first().frames[0]
        val info = ImageCheck.analyze(first.w, first.h, first.px)
        val warns = ArrayList(im.warnings)
        if (!info.transparent) warns += "背景還不是透明的：可以用去背或手指擦掉"
        if (k < 1) warns += "已經縮小到 ${nw}×${nh}（原圖另外保存）"
        val faces = im.faces.mapValues { (_, f) -> val (fw, fh) = Pixels.fit(f.w, f.h, WORK); Pixels.resize(f, fw, fh) }
        return Prepared(nw, nh, out, info, !info.transparent, warns, faces, k)
    }
}
