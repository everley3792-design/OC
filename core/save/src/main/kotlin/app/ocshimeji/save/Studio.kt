package app.ocshimeji.save

import app.ocshimeji.save.media.Actions
import app.ocshimeji.save.media.Clip
import app.ocshimeji.save.media.Codec
import app.ocshimeji.save.media.Imported
import app.ocshimeji.save.media.Importer
import app.ocshimeji.save.media.Png
import app.ocshimeji.save.media.Raster
import app.ocshimeji.save.media.Sniff
import app.ocshimeji.save.media.safe
import app.ocshimeji.save.paint.Draft
import app.ocshimeji.save.paint.DraftMeta
import app.ocshimeji.save.paint.PaintDoc
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.CustomTag
import app.ocshimeji.sim.life.Life
import app.ocshimeji.sim.life.WorldItem
import app.ocshimeji.sim.script.ScriptDef
import app.ocshimeji.sim.script.Scripts
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * The creator suite's library side (plan 12.6 / 13.3, M5): paint drafts, characters and expressions drawn by hand, animations
 * (frames, timing, play mode, feet, frame events, mirroring, batch import, the fallback chain), custom items and `.ocitem`,
 * imported sounds, the player's tags and scripts with `.ocmod` packs, copying them into a world, and the space-usage page.
 * Everything goes through the save system's storage (atomic writes); every refusal says why.
 */
class Studio(val saves: SaveSystem) {
    private val store get() = saves.storage
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private fun lib() = saves.ownLib()
    private fun write(x: LibraryIndex) = saves.writeLib(x)

    // ================= drafts (plan 12.6 自動保存草稿) =================
    fun drafts(): List<Pair<String, DraftMeta>> = store.list("library/drafts").mapNotNull { id -> store.read("library/drafts/$id/doc.json")?.let { b -> runCatching { id to Draft.meta(b) }.getOrNull() } }.sortedByDescending { it.second.updated }
    fun saveDraft(id: String?, doc: PaintDoc, name: String, target: String = ""): String {
        val did = id ?: saves.newId("d"); val dir = "library/drafts/$did"
        val files = Draft.encode(doc, name.trim().ifBlank { "未命名" }.take(24), saves.now(), target)
        for (old in store.list(dir)) if (old !in files) store.delete("$dir/$old")
        for ((n, b) in files) store.write("$dir/$n", b)
        doc.dirty = false; return did
    }
    fun loadDraft(id: String): Pair<PaintDoc, DraftMeta> = Draft.decode { store.read("library/drafts/$id/$it") }
    fun deleteDraft(id: String) = store.deleteDir("library/drafts/$id")

    // ================= drawn characters and expressions =================
    /** a new library character from a drawing (its visible part, the feet found like an import) */
    fun charFromDrawing(doc: PaintDoc, spec: CharSpec): LibChar {
        val pic = doc.trimmed() ?: throw IllegalArgumentException("畫布是空的，先畫點什麼吧")
        val prep = Importer.prepare(Imported("drawn", linkedMapOf("idle" to Clip(mutableListOf(pic), mutableListOf(120)))), Importer.Options(removeBg = false))
        val c = saves.saveCharacter(prep, spec, 1, true, emptyMap(), emptyList())
        saves.addLibChar(c.copy(source = "drawn")); return saves.libChar(c.id)!!
    }
    fun faceFromDrawing(charId: String, emotion: String, doc: PaintDoc): String? { val pic = doc.trimmed() ?: return "畫布是空的"; return saves.setFace(charId, emotion, pic) }

    // ================= animations (plan 12.6 動畫工作室) =================
    private fun own(charId: String): LibChar { val c = saves.libChar(charId) ?: throw IllegalArgumentException("沒有這個角色"); require(c.source != "preset") { "內建角色不能修改，可以先複製一份" }; return c }
    /** replace one action's frames: pictures, the time of each frame, loop / once / pingpong, the feet, frame events */
    fun saveAnim(charId: String, action: String, frames: List<Raster>, ms: List<Int>, mode: String = "loop", anchors: List<List<Float>> = emptyList(), events: Map<String, String> = emptyMap()): LibChar {
        val c = own(charId); require(action in Actions.ALL) { "沒有這個動作：$action" }
        require(frames.isNotEmpty()) { "至少要有一格" }; require(frames.size <= 120) { "一個動作最多 120 格" }
        require(mode in setOf("loop", "once", "pingpong")) { "播放方式只能是循環、播一次、來回" }
        val dir = "library/chars/${c.id}/f"
        c.anims[action]?.frames?.forEach { store.delete(it.removePrefix("lib:")) }
        val stamp = java.lang.Long.toString(saves.now(), 36)
        val paths = frames.mapIndexed { i, f -> "lib:$dir/${action}_${stamp}_$i.png".also { store.write(it.removePrefix("lib:"), Png.encode(f)) } }
        val ms2 = frames.indices.map { (ms.getOrNull(it) ?: ms.lastOrNull() ?: 120).coerceIn(20, 5000) }
        val anim = Anim(paths, ms2, mode != "once", mode, anchors.take(frames.size), events.filterKeys { (it.toIntOrNull() ?: -1) in frames.indices })
        var out = c.copy(anims = c.anims + (action to anim))
        if (action == "idle") { store.write("library/chars/${c.id}/idle.png", Png.encode(frames[0])); out = out.copy(image = "lib:library/chars/${c.id}/idle.png") }
        saves.addLibChar(out); return saves.libChar(c.id)!!
    }
    fun deleteAnim(charId: String, action: String): LibChar { val c = own(charId); c.anims[action]?.frames?.forEach { store.delete(it.removePrefix("lib:")) }; saves.addLibChar(c.copy(anims = c.anims - action)); return saves.libChar(c.id)!! }
    /** "copy from another action": the same pictures, its own timing afterwards */
    fun copyAnim(charId: String, from: String, to: String, decode: (String) -> Raster?): LibChar {
        val c = own(charId); val a = c.anims[from] ?: throw IllegalArgumentException("「${Actions.ZH[from]}」還沒有動畫")
        val frames = a.frames.map { decode(it) ?: throw IllegalArgumentException("讀不到影格") }
        return saveAnim(charId, to, frames, a.ms, a.playMode, a.anchors, a.events)
    }
    fun setProcedural(charId: String, layers: List<String>) { val c = own(charId); saves.addLibChar(c.copy(procedural = layers.filter { it in setOf("breath", "bounce", "sway") })) }
    fun setVoices(charId: String, soundIds: List<String>) { val c = own(charId); val ok = lib().sounds.map { it.id }.toSet(); saves.addLibChar(c.copy(voices = soundIds.filter { it in ok }.take(8))) }
    /** batch import (plan 12.6): many files at once, file names decide the actions; existing actions not in the files stay */
    fun batchImport(charId: String, sources: List<Importer.Source>, codec: Codec): List<String> {
        own(charId)
        val im = Importer.read(sources, codec); require(im.clips.isNotEmpty()) { "沒有任何影格" }
        val prep = Importer.prepare(im)
        for ((a, clip) in prep.clips) saveAnim(charId, if (a in Actions.ALL) a else "idle", clip.frames, clip.ms, if (clip.loop) "loop" else "once", autoAnchors(clip.frames))
        return prep.clips.keys.toList()
    }
    companion object {
        /** the feet of every frame, found like an import (plan 12.6 一鍵自動對齊) */
        fun autoAnchors(frames: List<Raster>): List<List<Float>> = frames.map { f -> runCatching { val i = ImageCheck.analyze(f.w, f.h, f.px)
            if (!i.transparent) listOf(0.5f, 1f) else listOf((i.left + i.footX * (i.right - i.left)) / i.w, (i.bottom + 1f) / i.h) }.getOrDefault(listOf(0.5f, 1f)) }
        /** left–right mirror of every frame */
        fun mirror(frames: List<Raster>): List<Raster> = frames.map { f -> val o = Raster(f.w, f.h); for (y in 0 until f.h) for (x in 0 until f.w) o.px[y * f.w + x] = f.px[y * f.w + (f.w - 1 - x)]; o }
        /** the 狀態機檢視: every action and what plays for it now (itself, a fallback, or null = the procedural motion) */
        fun chain(c: LibChar): List<Pair<String, String?>> = Actions.ALL.map { a -> a to Actions.resolve(a) { it in c.anims || (it == "idle") } }
    }

    // ================= custom items (plan 12.6) =================
    fun items(): List<LibItem> = lib().items
    fun item(id: String) = items().firstOrNull { it.id == id }
    /** save (new or edited); pictures: front (required), back / side (optional). Refused with the reasons when invalid */
    fun saveItem(item: LibItem, front: Raster?, back: Raster? = null, side: Raster? = null): LibItem {
        val id = item.id.ifBlank { saves.newId("i") }; val dir = "library/items/$id"
        val old = item(id)
        val img = front?.let { "lib:$dir/front.png".also { p -> store.write(p.removePrefix("lib:"), Png.encode(it)) } } ?: old?.image ?: item.image
        val bk = back?.let { "lib:$dir/back.png".also { p -> store.write(p.removePrefix("lib:"), Png.encode(it)) } } ?: item.back
        val sd = side?.let { "lib:$dir/side.png".also { p -> store.write(p.removePrefix("lib:"), Png.encode(it)) } } ?: item.side
        val out = item.copy(id = id, image = img, back = bk, side = sd, created = old?.created ?: saves.now(), name = item.name.trim().take(20))
        val bad = Items.check(out).first; if (bad.isNotEmpty()) { if (old == null) store.deleteDir(dir); throw IllegalArgumentException(bad.joinToString("；")) }
        val l = lib(); write(l.copy(items = l.items.filter { it.id != id } + out)); return out
    }
    /** a wallpaper or floor still on some home's walls cannot be removed */
    fun deleteItem(id: String): String? {
        val it0 = item(id) ?: return null
        val users = saves.slots().filter { s -> it0.kind in setOf("wallpaper", "floor") && it0.image.isNotBlank() && saves.readFile("saves/${s.id}/world.json")?.decodeToString()?.contains(it0.image.removePrefix("lib:")) == true }
        if (users.isNotEmpty()) return "還貼在：" + users.joinToString("、") { it.name }
        store.deleteDir("library/items/$id"); val l = lib(); write(l.copy(items = l.items.filter { it.id != id })); return null
    }
    /** `.ocitem`: item.json and its pictures in a ZIP */
    fun exportItem(id: String): ByteArray {
        val it0 = item(id) ?: throw IllegalArgumentException("沒有這個物品")
        val files = LinkedHashMap<String, ByteArray>()
        fun pic(p: String, n: String): String { if (p.isBlank()) return ""; files[n] = store.read(p.removePrefix("lib:")) ?: throw IllegalArgumentException("少了圖片"); return n }
        val m = it0.copy(image = pic(it0.image, "front.png"), back = pic(it0.back, "back.png"), side = pic(it0.side, "side.png"))
        return zip(mapOf("item.json" to json.encodeToString(ItemFile(item = m)).encodeToByteArray()) + files)
    }
    fun importItem(bytes: ByteArray, codec: Codec): LibItem {
        require(bytes.size < 16 * 1024 * 1024) { "檔案太大（超過 16 MB）" }
        val f = unzip(bytes) ?: throw IllegalArgumentException("不是 .ocitem 檔（應該是 ZIP）")
        val meta = runCatching { json.decodeFromString<ItemFile>((f["item.json"] ?: throw IllegalArgumentException("少了 item.json")).decodeToString()) }.getOrElse { throw IllegalArgumentException(it.message ?: "item.json 看不懂") }
        require(meta.format == "ocitem") { "不是 .ocitem 檔" }; require(meta.v <= 1) { "這個物品檔比 App 新，請先更新 App" }
        fun pic(n: String): Raster? { if (n.isBlank()) return null; val b = f[n] ?: throw IllegalArgumentException("少了圖片：$n"); require(Sniff.kind(b) != null) { "$n 不是圖片" }; return codec.safe(b) ?: throw IllegalArgumentException("$n 讀不出來") }
        val front = pic(meta.item.image) ?: throw IllegalArgumentException("物品沒有圖片")
        return saveItem(meta.item.copy(id = "", image = "", back = "", side = ""), front, pic(meta.item.back), pic(meta.item.side))
    }
    @Serializable class ItemFile(val format: String = "ocitem", val v: Int = 1, val item: LibItem)

    // ================= sounds (plan 12.6 音樂與聲音匯入) =================
    fun sounds(): List<LibSound> = lib().sounds
    fun importSound(name: String, bytes: ByteArray, kind: String): LibSound {
        require(kind in Sounds.KINDS) { "聲音的用途不對" }
        val (fmt, ms) = Sounds.check(bytes, kind)
        val id = saves.newId("s"); val path = "library/sounds/$id.$fmt"; store.write(path, bytes)
        val s = LibSound(id, name.substringBeforeLast('.').trim().take(24).ifBlank { "聲音" }, kind, "lib:$path", ms, bytes.size, fmt, saves.now())
        val l = lib(); write(l.copy(sounds = l.sounds + s)); return s
    }
    fun deleteSound(id: String): String? {
        val s = sounds().firstOrNull { it.id == id } ?: return null
        val users = saves.library().chars.filter { id in it.voices }; if (users.isNotEmpty()) return "還是這些角色的聲音：" + users.joinToString("、") { it.name }
        store.delete(s.path.removePrefix("lib:")); val l = lib(); write(l.copy(sounds = l.sounds.filter { it.id != id })); return null
    }

    // ================= the player's tags and scripts =================
    fun tags(): List<CustomTag> = lib().tags
    fun saveTag(t: CustomTag): String? { CustomTag.problem(t)?.let { return it }; val l = lib(); write(l.copy(tags = l.tags.filter { it.id != t.id } + t)); return null }
    fun deleteTag(id: String) { val l = lib(); write(l.copy(tags = l.tags.filter { it.id != id })) }
    fun scripts(): List<ScriptDef> = lib().scripts
    /** null = saved; otherwise the reasons */
    fun saveScript(s: ScriptDef): String? { val p = Scripts.problems(s); if (p.isNotEmpty()) return p.joinToString("；"); val sid = s.id.ifBlank { saves.newId("e") }; val l = lib(); write(l.copy(scripts = l.scripts.filter { it.id != sid } + s.copy(id = sid))); return null }
    fun deleteScript(id: String) { val l = lib(); write(l.copy(scripts = l.scripts.filter { it.id != id })) }

    /** `.ocmod` (plan 13.3 劇本包): scripts (readable text) and tags, no code */
    fun exportMod(name: String, author: String, scriptIds: List<String>, tagIds: List<String>): ByteArray {
        val sc = scripts().filter { it.id in scriptIds }; val tg = tags().filter { it.id in tagIds }
        require(sc.isNotEmpty() || tg.isNotEmpty()) { "至少選一個劇本或標籤" }
        val files = LinkedHashMap<String, ByteArray>()
        sc.forEachIndexed { i, s -> files["scripts/${i}.txt"] = Scripts.toText(s.copy(author = author)).encodeToByteArray() }
        if (tg.isNotEmpty()) files["tags.json"] = json.encodeToString(tg).encodeToByteArray()
        files["manifest.json"] = json.encodeToString(ModManifest(name = name.ifBlank { "我的劇本包" }, author = author, scripts = files.keys.filter { it.startsWith("scripts/") }, tags = if (tg.isNotEmpty()) "tags.json" else "")).encodeToByteArray()
        return zip(files)
    }
    @Serializable class ModManifest(val format: String = "ocmod", val v: Int = 1, val name: String = "", val author: String = "", val scripts: List<String> = emptyList(), val tags: String = "",
        /** v2 (1.8.0 P-15): characters (`.ocpkg` inside) and items (`.ocitem` inside) too */ val chars: List<String> = emptyList(), val items: List<String> = emptyList())
    /**
     * P-15 (1.8.0) 內容包工坊: your characters, items, scripts and tags in one `.ocmod` (format v2). Characters go in as `.ocpkg`,
     * items as `.ocitem` — the same files you could share one by one; nothing executable.
     */
    fun exportPack(name: String, author: String, charIds: List<String>, itemIds: List<String>, scriptIds: List<String>, tagIds: List<String>): ByteArray {
        val chars = charIds.mapNotNull { saves.libChar(it) }.filter { it.source != "preset" }; val items = itemIds.filter { id -> lib().items.any { it.id == id } }
        val sc = scripts().filter { it.id in scriptIds }; val tg = tags().filter { it.id in tagIds }
        require(chars.isNotEmpty() || items.isNotEmpty() || sc.isNotEmpty() || tg.isNotEmpty()) { "至少選一樣東西" }
        val files = LinkedHashMap<String, ByteArray>()
        chars.forEachIndexed { i, c -> files["chars/$i.ocpkg"] = saves.exportPkg(c.id, author) }
        items.forEachIndexed { i, id -> files["items/$i.ocitem"] = exportItem(id) }
        sc.forEachIndexed { i, s -> files["scripts/${i}.txt"] = Scripts.toText(s.copy(author = author)).encodeToByteArray() }
        if (tg.isNotEmpty()) files["tags.json"] = json.encodeToString(tg).encodeToByteArray()
        files["manifest.json"] = json.encodeToString(ModManifest(v = 2, name = name.ifBlank { "我的內容包" }, author = author, scripts = files.keys.filter { it.startsWith("scripts/") },
            tags = if (tg.isNotEmpty()) "tags.json" else "", chars = files.keys.filter { it.startsWith("chars/") }, items = files.keys.filter { it.startsWith("items/") })).encodeToByteArray()
        return zip(files)
    }
    /** import the characters and items of a v2 pack (scripts and tags go through `importMod`); returns how many of each */
    fun importPackParts(bytes: ByteArray, codec: app.ocshimeji.save.media.Codec): Pair<Int, Int> {
        val f = unzip(bytes) ?: throw IllegalArgumentException("不是 .ocmod 檔（應該是 ZIP）")
        val m = runCatching { json.decodeFromString<ModManifest>((f["manifest.json"] ?: throw IllegalArgumentException("少了 manifest.json")).decodeToString()) }.getOrElse { throw IllegalArgumentException(it.message ?: "manifest.json 壞掉了") }
        var nc = 0; var ni = 0
        for (n in m.chars) { val b = f[n] ?: throw IllegalArgumentException("少了 $n")
            val im = app.ocshimeji.save.media.Importer.read(listOf(app.ocshimeji.save.media.Importer.Source(n.substringAfterLast('/'), b)), codec); val pm = im.pkg ?: throw IllegalArgumentException("$n 不是角色包")
            saves.saveCharacter(app.ocshimeji.save.media.Importer.prepare(im), pm.spec ?: app.ocshimeji.sim.chars.CharSpec(name = pm.name), pm.facing, pm.flip, pm.marks, emptyList(), foot = pm.foot.getOrNull(0)?.let { it to (pm.foot.getOrNull(1) ?: 1f) }); nc++ }
        for (n in m.items) { importItem(f[n] ?: throw IllegalArgumentException("少了 $n"), codec); ni++ }
        return nc to ni
    }
    /** what a pack contains and what it needs from your characters (shown before importing) */
    class ModPack(val name: String, val author: String, val scripts: List<ScriptDef>, val tags: List<CustomTag>, val needs: List<String>)
    fun readMod(bytes: ByteArray): ModPack {
        require(bytes.size < 4 * 1024 * 1024) { "劇本包太大（超過 4 MB）" }
        val f = unzip(bytes) ?: throw IllegalArgumentException("不是 .ocmod 檔（應該是 ZIP）")
        val m = runCatching { json.decodeFromString<ModManifest>((f["manifest.json"] ?: throw IllegalArgumentException("少了 manifest.json")).decodeToString()) }.getOrElse { throw IllegalArgumentException(it.message ?: "manifest.json 看不懂") }
        require(m.format == "ocmod") { "不是 .ocmod 檔" }; require(m.v <= 2) { "這個劇本包比 App 新，請先更新 App" }
        val scripts = m.scripts.mapIndexed { i, n -> val t = (f[n] ?: throw IllegalArgumentException("少了 $n")).decodeToString()
            val s = try { if (n.endsWith(".json")) Scripts.fromJson(t) else Scripts.parse(t, "", m.author) } catch (e: IllegalArgumentException) { throw IllegalArgumentException("$n ${e.message}") }
            val p = Scripts.problems(s); if (p.isNotEmpty()) throw IllegalArgumentException("$n：" + p.joinToString("；")); s.copy(id = "m$i") }
        val tags = if (m.tags.isBlank()) emptyList() else runCatching { json.decodeFromString<List<CustomTag>>((f[m.tags] ?: throw IllegalArgumentException("少了 ${m.tags}")).decodeToString()) }.getOrElse { throw IllegalArgumentException("${m.tags} 看不懂") }
        tags.forEach { t -> CustomTag.problem(t)?.let { throw IllegalArgumentException("標籤「${t.id}」：$it") } }
        val needs = scripts.flatMap { s -> s.roles.map { it.match } }.filter { it != "any" }.distinct()
        return ModPack(m.name, m.author, scripts, tags, needs)
    }
    /** import a pack; `remap` turns a role condition the player does not have ("name:小雨") into one they do ("name:團子" / "any") */
    fun importMod(p: ModPack, remap: Map<String, String> = emptyMap()): Int {
        for (t in p.tags) saveTag(t)
        var n = 0
        for (s in p.scripts) { val s2 = s.copy(id = "", roles = s.roles.map { it.copy(match = remap[it.match] ?: it.match) }); if (saveScript(s2) == null) n++ }
        return n
    }
    /** does any library character fit a role condition? (the pack screen marks the ones you do not have) */
    fun has(match: String): Boolean = saves.library().chars.any { c -> val s = c.specOf(); when {
        match == "any" -> true; match.startsWith("tag:") -> match.drop(4) in s.tags; match.startsWith("trait:") -> match.drop(6) in s.traits || match.drop(6) in s.quirks
        match.startsWith("name:") -> c.name == match.drop(5); else -> false } }

    // ================= into a world =================
    /** copy what the player made into one world: food, drinks and gifts, tags, scripts (the world keeps its own copy) */
    fun syncWorld(life: Life) {
        val l = lib()
        life.items.clear(); life.items += l.items.filter { it.kind in setOf("food", "drink", "gift") + app.ocshimeji.sim.life.LifeSim.FURNITURE_KINDS }.map { WorldItem(it.id, it.name, it.kind, it.taste, it.full, it.likedBy, it.image,
            it.w, it.h, it.slots.map { s -> listOf(s.dx, s.dy, when (s.pose) { "lie" -> 1f; "stand" -> 2f; else -> 0f }) }, it.offers, it.price, it.series) }
        life.tags.clear(); life.tags += l.tags
        life.scripts.clear(); life.scripts += l.scripts.filter { it.enabled }
    }

    // ================= space (plan P-16) =================
    class Usage(val parts: List<Triple<String, Long, Int>>, val unused: List<String>, val unusedBytes: Long, val originalsBytes: Long) { val total get() = parts.sumOf { it.second } }
    private fun walk(dir: String, out: MutableList<String>) { for (n in store.list(dir)) { val p = if (dir.isEmpty()) n else "$dir/$n"; if (store.list(p).isNotEmpty()) walk(p, out) else out += p } }
    private fun size(p: String) = store.read(p)?.size?.toLong() ?: 0L
    fun usage(): Usage {
        val all = ArrayList<String>(); walk("library", all); walk("saves", all)
        val groups = linkedMapOf("角色" to "library/chars/", "草稿" to "library/drafts/", "物品" to "library/items/", "聲音" to "library/sounds/", "備份" to "/backup/", "存檔" to "saves/")
        val sizes = all.associateWith { size(it) }
        val parts = groups.map { (zh, pre) -> val fs = all.filter { f -> if (pre == "/backup/") f.contains(pre) else f.startsWith(pre) && !(pre == "saves/" && f.contains("/backup/")) }; Triple(zh, fs.sumOf { sizes[it] ?: 0L }, fs.size) }
        val unused = unusedFiles(all)
        return Usage(parts, unused, unused.sumOf { sizes[it] ?: 0L }, all.filter { it.contains("/orig/") }.sumOf { sizes[it] ?: 0L })
    }
    /** files nothing points at: pictures of deleted characters, items, frames that were replaced, deleted sounds */
    private fun unusedFiles(all: List<String>): List<String> {
        val l = saves.library(); val chars = l.chars.associateBy { it.id }; val items = lib().items.map { it.id }.toSet(); val sounds = lib().sounds.map { it.path.removePrefix("lib:") }.toSet()
        val used = HashSet<String>(); for (c in l.chars) { used += c.image.removePrefix("lib:"); c.anims.values.forEach { a -> a.frames.forEach { used += it.removePrefix("lib:") } }; c.faces.values.forEach { used += it.removePrefix("lib:") } }
        return all.filter { f -> when {
            f.startsWith("library/chars/") -> { val id = f.split("/")[2]; chars[id] == null || (!f.contains("/orig/") && f.endsWith(".png") && f !in used) }
            f.startsWith("library/items/") -> f.split("/")[2] !in items
            f.startsWith("library/sounds/") -> f !in sounds
            else -> false } }
    }
    /** delete unused files (and, if asked, the originals kept from imports — the working pictures stay); returns bytes freed */
    fun cleanup(originals: Boolean): Long {
        val all = ArrayList<String>(); walk("library", all)
        val gone = unusedFiles(all) + (if (originals) all.filter { it.contains("/orig/") } else emptyList())
        var n = 0L; for (f in gone.distinct()) { n += size(f); store.delete(f) }; return n
    }

    // ================= zip helpers =================
    private fun zip(files: Map<String, ByteArray>): ByteArray { val bos = ByteArrayOutputStream(); ZipOutputStream(bos).use { z -> for ((n, d) in files) { z.putNextEntry(ZipEntry(n)); z.write(d); z.closeEntry() } }; return bos.toByteArray() }
    private fun unzip(bytes: ByteArray): Map<String, ByteArray>? {
        if (bytes.size < 4 || bytes[0] != 'P'.code.toByte() || bytes[1] != 'K'.code.toByte()) return null
        val out = LinkedHashMap<String, ByteArray>(); var total = 0L
        try { ZipInputStream(ByteArrayInputStream(bytes)).use { z -> while (true) { val e = z.nextEntry ?: break; if (e.isDirectory) continue
            require(!e.name.contains("..")) { "檔案裡有不安全的路徑" }; val b = z.readBytes(); total += b.size; require(total < 64L * 1024 * 1024) { "解開後太大了" }; out[e.name] = b } } }
        catch (e: IllegalArgumentException) { throw e } catch (e: Exception) { return null }
        return out
    }
}

/** item kinds and the checks before saving (plan 12.6 存檔前自動驗證) */
object Items {
    val KINDS = linkedMapOf("furniture" to "家具", "decor" to "裝飾", "food" to "食物", "drink" to "飲料", "gift" to "禮物", "toy" to "玩具", "wallpaper" to "壁紙", "floor" to "地板",
        "rug" to "地毯", "plant" to "植物", "sticker" to "貼紙")
    /** what each kind does (M6: furniture, rugs, plants, decor and toys are made by a resident in the workshop, then placed at home) */
    fun use(kind: String): String = when (kind) {
        "food", "drink" -> "可以在人物卡「給點心」裡給牠們吃"; "gift" -> "牠們會挑來送給彼此"; "wallpaper", "floor" -> "可以貼在家裡的房間"
        "sticker" -> "貼紙用在創作裡；家裡還不能貼（M7 製作）"
        else -> "在小鎮的工坊委託住民做出來，再用「擺家具」放進家裡"
    }
    val OFFERS = linkedMapOf("sit" to "坐", "sleep" to "睡", "read" to "看書", "play" to "玩", "eat" to "吃飯", "watch" to "看", "work" to "做事")
    val TASTES = listOf("甜", "鹹", "酸", "辣", "苦")
    /** (blocking problems, warnings) */
    fun check(i: LibItem): Pair<List<String>, List<String>> {
        val bad = ArrayList<String>(); val warn = ArrayList<String>()
        if (i.name.isBlank()) bad += "物品還沒有名字"
        if (i.kind !in KINDS) bad += "物品的種類不對"
        if (i.image.isBlank()) bad += "物品還沒有圖片"
        if (i.price !in 0..9999) bad += "價格要在 0～9999"
        if (i.kind in setOf("furniture", "rug", "plant", "decor", "toy")) {
            if (i.w !in 1..4 || i.h !in 1..4) bad += "佔地要在 1～4 格"
            if (i.slots.any { it.dx < 0 || it.dy < 0 || it.dx > i.w || it.dy > i.h + 1 }) bad += "互動位子要在物品的格子裡"
            if (i.slots.any { it.pose !in setOf("sit", "lie", "stand") }) bad += "互動位子只能是坐、躺、站"
            if ("sleep" in i.offers && i.slots.none { it.pose == "lie" }) warn += "可以睡的家具，還沒有躺的位子"
            if ("sit" in i.offers && i.slots.none { it.pose == "sit" }) warn += "可以坐的家具，還沒有坐的位子"
            if (i.offers.isNotEmpty() && i.slots.isEmpty()) warn += "有提供活動，但沒有互動位子，角色不知道要站在哪裡"
        }
        if (i.kind in setOf("food", "drink")) { if (i.taste !in TASTES) bad += "食物要選一種口味"; if (i.full !in 5f..60f) bad += "飽足要在 5～60" }
        if (i.kind == "gift" && i.likedBy.isEmpty()) warn += "還沒寫誰會喜歡（例如：甜點、書、花），牠們會不知道送給誰"
        return bad to warn
    }
}

/** sound checks (plan 12.6): the format from the file header, size and length limits per use */
object Sounds {
    val KINDS = linkedMapOf("voice" to "角色的聲音", "sfx" to "音效", "music" to "音樂")
    val MAX_MS = mapOf("voice" to 4000, "sfx" to 10000, "music" to 5 * 60000)
    const val MAX_BYTES = 8 * 1024 * 1024
    /** (format, length in ms; 0 = unknown for MP3) — or a refusal with the reason */
    fun check(b: ByteArray, kind: String): Pair<String, Int> {
        require(b.size in 64..MAX_BYTES) { if (b.size < 64) "檔案是空的或太小" else "聲音檔太大（超過 8 MB）" }
        fun at(i: Int, s: String) = b.size >= i + s.length && s.indices.all { b[i + it] == s[it].code.toByte() }
        fun u32le(i: Int) = (b[i].toInt() and 255) or ((b[i + 1].toInt() and 255) shl 8) or ((b[i + 2].toInt() and 255) shl 16) or ((b[i + 3].toInt() and 255) shl 24)
        val (fmt, ms) = when {
            at(0, "RIFF") && at(8, "WAVE") -> { var i = 12; var rate = 0; var data = -1
                while (i + 8 <= b.size) { val id = String(b, i, 4, Charsets.ISO_8859_1); val len = u32le(i + 4); if (id == "fmt ") rate = u32le(i + 16); if (id == "data") { data = len; break }; if (len < 0) break; i += 8 + len + (len and 1) }
                require(rate > 0 && data >= 0) { "WAV 檔壞掉了" }; "wav" to (data.toLong() * 1000 / rate).toInt() }
            at(0, "OggS") -> { val v = (0 until minOf(b.size - 16, 200)).firstOrNull { at(it, "\u0001vorbis") }
                val rate = v?.let { u32le(it + 12) } ?: 48000
                val last = (b.size - 14 downTo 0).firstOrNull { at(it, "OggS") } ?: 0
                var g = 0L; for (k in 0 until 8) g = g or ((b[last + 6 + k].toLong() and 255) shl (8 * k))
                "ogg" to if (rate > 0 && g > 0) (g * 1000 / rate).toInt() else 0 }
            at(0, "ID3") || ((b[0].toInt() and 0xFF) == 0xFF && (b[1].toInt() and 0xE0) == 0xE0) -> "mp3" to 0
            at(4, "ftyp") -> "m4a" to 0
            else -> throw IllegalArgumentException("看不懂這個聲音格式（可以用 WAV、OGG、MP3、M4A）")
        }
        val max = MAX_MS[kind] ?: 10000
        require(ms <= max) { "太長了：${KINDS[kind]}最多 ${max / 1000} 秒（這個 ${ms / 1000} 秒）" }
        return fmt to ms
    }
}
