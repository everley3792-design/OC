package app.ocshimeji.save

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.house.HouseType
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.save.media.Importer
import app.ocshimeji.save.media.PkgAction
import app.ocshimeji.save.media.PkgManifest
import app.ocshimeji.save.media.Png
import app.ocshimeji.save.media.Prepared
import app.ocshimeji.save.media.Raster
import app.ocshimeji.sim.chars.Relations
import app.ocshimeji.sim.life.LifeSim
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * The library and the saves. Everything the save menu does goes through here: new, continue, copy, branch, rename, delete,
 * daily backups (the last three days of each save). Time comes from `now` (tests pass their own clock).
 */
class SaveSystem(private val store: Storage, private val now: () -> Long = { System.currentTimeMillis() }) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; prettyPrint = false }
    private var idSeq = 0L

    // ---------------- library ----------------
    /* screens ask for the library and the save list every frame: both are kept in memory and refreshed on every write through here */
    private var libCache: LibraryIndex? = null
    private var idxCache: SaveIndex? = null
    fun library(): LibraryIndex {
        libCache?.let { return it }
        val own = store.read(LIB)?.let { json.decodeFromString<LibraryIndex>(it.decodeToString()) } ?: LibraryIndex()
        return own.copy(chars = Presets.ALL + own.chars.filter { c -> Presets.ALL.none { it.id == c.id } }).also { libCache = it }
    }
    // ---------------- small app-wide flags (a tip card already seen…) ----------------
    fun flag(key: String): Boolean = flags().contains(key)
    fun setFlag(key: String) { val f = flags(); if (key in f) return; store.write(FLAGS, json.encodeToString(f + key).encodeToByteArray()); flagCache = f + key }
    private var flagCache: Set<String>? = null
    /** small app-wide settings (desktop reminder interval…) */
    fun pref(key: String): String? = prefs()[key]
    fun setPref(key: String, value: String?) { val m = prefs().toMutableMap(); if (value == null) m.remove(key) else m[key] = value; store.write(PREFS, json.encodeToString(m.toMap()).encodeToByteArray()); prefCache = m }
    private var prefCache: Map<String, String>? = null
    private fun prefs(): Map<String, String> = prefCache ?: (store.read(PREFS)?.let { runCatching { json.decodeFromString<Map<String, String>>(it.decodeToString()) }.getOrNull() } ?: emptyMap()).also { prefCache = it }
    private fun flags(): Set<String> = flagCache ?: (store.read(FLAGS)?.let { runCatching { json.decodeFromString<Set<String>>(it.decodeToString()) }.getOrNull() } ?: emptySet()).also { flagCache = it }
    fun libChar(id: String): LibChar? = library().chars.firstOrNull { it.id == id }
    fun addLibChar(c: LibChar): LibChar {
        val own = store.read(LIB)?.let { json.decodeFromString<LibraryIndex>(it.decodeToString()) } ?: LibraryIndex()
        val withId = if (c.id.isBlank()) c.copy(id = newId("c"), created = now()) else c
        writeLib(own.copy(chars = own.chars.filter { it.id != withId.id } + withId)); return withId
    }
    /** presets stay; a character still living in some save cannot be removed (the save would lose its image) */
    fun removeLibChar(id: String): String? {
        if (Presets.ALL.any { it.id == id }) return "內建角色不能刪除"
        val users = slots().filter { id in it.residents }
        if (users.isNotEmpty()) return "還住在：" + users.joinToString("、") { it.name }
        val own = store.read(LIB)?.let { json.decodeFromString<LibraryIndex>(it.decodeToString()) } ?: return null
        writeLib(own.copy(chars = own.chars.filter { it.id != id })); return null
    }
    private fun writeLib(x: LibraryIndex) { store.write(LIB, json.encodeToString(x).encodeToByteArray()); libCache = null }

    // ---------------- saves ----------------
    fun slots(): List<SlotMeta> = index().slots.sortedByDescending { it.lastPlayed }
    fun slot(id: String) = index().slots.firstOrNull { it.id == id }

    /** a new observation: a world with these residents (library ids) */
    fun create(name: String, residentLibIds: List<String>, townName: String = ""): SlotMeta {
        val t = now(); val id = newId("s")
        val residents = residentLibIds.mapNotNull { libChar(it) }.map { Resident(newId("r"), it.id, it.name) }
        val world = World(seed = Rng.hash("$id:$t"), created = t, townName = townName, residents = residents)
        writeWorld(id, world)
        val meta = SlotMeta(id, name.ifBlank { "新的觀察" }, t, t, residents = residents.map { it.libId })
        writeIndex(index().let { it.copy(slots = it.slots + meta) }); return meta
    }
    /** a damaged file (cut off half-way) falls back to the version before the last write; a too-new file throws with a reason */
    /**
     * 開始新的觀察 (plan 12.2): a world with a house type, its residents (library ids) in their rooms, and move-in day to play.
     * `nowMinute` = the phone's local time as game minutes (the default clock follows the phone).
     */
    fun createWorld(name: String, town: String, home: String, house: HouseType, libIds: List<String>, rooms: Map<String, String>, nowMinute: Double,
                    rels: List<Rel> = emptyList(), romance: Boolean = false): SlotMeta {
        val t = now(); val id = newId("s"); val seed = Rng.hash("$id:$t")
        val chars = libIds.mapNotNull { libChar(it) }
        val specs = chars.associate { "r_" + it.id to it.specOf() }
        val tenants = chars.map { Tenant("r_" + it.id, it.name, specs["r_" + it.id]!!.adult) }
        Houses.check(house, tenants)?.let { throw IllegalArgumentException(it) }
        val rr = chars.associate { "r_" + it.id to (rooms[it.id] ?: error("${it.name}還沒有房間")) }
        /* relationships are given between library ids; in the world they are between residents */
        val wr = rels.map { it.copy(from = "r_" + it.from, to = "r_" + it.to) }
        for (r in wr) Relations.problem(r, specs[r.from] ?: continue, specs[r.to] ?: continue, romance)?.let { throw IllegalArgumentException(it) }
        Houses.checkRooms(house, tenants, rr) { a, b -> Relations.family(wr, a, b) }?.let { throw IllegalArgumentException(it) }
        val life = LifeSim.create(seed, house, tenants, rr, chars.associate { "r_" + it.id to it.id }, specs, town, home, nowMinute, t, wr, romance)
        val world = World(seed = seed, created = t, townName = town, residents = chars.map { Resident("r_" + it.id, it.id, it.name) }, life = life)
        writeWorld(id, world)
        val meta = SlotMeta(id, name.ifBlank { "新的觀察" }, t, t, residents = chars.map { it.id })
        writeIndex(index().let { it.copy(slots = it.slots + meta) }); return meta
    }
    /** a world made by M0 (no house yet): the smallest house that fits, everyone in a room */
    fun upgradeM0(id: String, w: World, nowMinute: Double): World {
        if (w.life != null) return w
        val chars = w.residents.mapNotNull { r -> libChar(r.libId)?.let { r to it } }
        val house = Houses.ALL.firstOrNull { it.capacity >= chars.size } ?: Houses.APARTMENT
        val tenants = chars.take(house.capacity).map { (r, c) -> Tenant(r.id, r.name, c.specOf().adult) }
        val life = LifeSim.create(w.seed, house, tenants, Houses.autoRooms(house, tenants), chars.associate { (r, c) -> r.id to c.id }, chars.associate { (r, c) -> r.id to c.specOf() }, w.townName, "", nowMinute, now())
        val up = w.copy(life = life); writeWorld(id, up); return up
    }

    // ---------------- importing a character from one picture (M1; the full creation is M2) ----------------
    /** `working` = the PNG the game draws (≤ 1024 px), `original` = the file as picked (kept, never changed) */
    /** save an edited library character (its spec, settings and media); presets stay as they are */
    fun updateLibChar(c: LibChar): String? {
        if (Presets.ALL.any { it.id == c.id }) return "內建角色不能修改（可以複製一份再改）"
        addLibChar(c.copy(name = c.spec?.name ?: c.name, adult = c.spec?.adult ?: c.adult)); return null
    }
    fun importChar(name: String, adult: Boolean, facing: Int, info: ImageInfo, working: ByteArray, original: ByteArray, originalExt: String): LibChar {
        val cid = newId("c"); val dir = "library/chars/$cid"
        store.write("$dir/idle.png", working); store.write("$dir/original.$originalExt", original)
        val footY = if (info.transparent) (info.bottom + 1f) / info.h else 1f
        return addLibChar(LibChar(id = cid, name = name.trim().take(MAX_NAME).ifBlank { "新角色" }, source = "import", image = "lib:$dir/idle.png",
            footX = if (info.transparent) (info.left + info.footX * (info.right - info.left)) / info.w else 0.5f, footY = footY, adult = adult, facing = facing, opaque = !info.transparent, created = now()))
    }
    fun readFile(path: String): ByteArray? = store.read(path)

    // ---------------- characters from the import studio (M2) ----------------
    /**
     * Save an imported character: the working frames as PNG (lossless, the same bytes everywhere), the originals untouched, and a
     * LibChar with its spec, animations, marks and expression variants. `edit` = replace the pictures of an existing character.
     */
    fun saveCharacter(prep: Prepared, spec: CharSpec, facing: Int, flip: Boolean, marks: Map<String, Mark>, originals: List<Importer.Source>, edit: LibChar? = null,
                      foot: Pair<Float, Float>? = null): LibChar {
        val cid = edit?.id ?: newId("c"); val dir = "library/chars/$cid"
        if (edit != null) store.deleteDir(dir)
        val idle = prep.clips["idle"]?.frames?.firstOrNull() ?: prep.clips.values.first().frames[0]
        store.write("$dir/idle.png", Png.encode(idle))
        originals.forEachIndexed { i, o -> store.write("$dir/orig/${i}_${safeName(o.name)}", o.bytes) }
        val anims = LinkedHashMap<String, Anim>()
        for ((a, c) in prep.clips) { if (c.frames.size <= 1 && a == "idle") continue
            val paths = c.frames.mapIndexed { i, f -> "$dir/f/${a}_$i.png".also { store.write(it, Png.encode(f)) } }
            anims[a] = Anim(paths.map { "lib:$it" }, c.ms, c.loop) }
        val faces = prep.faces.mapValues { (e, f) -> "lib:$dir/face_$e.png".also { store.write(it.removePrefix("lib:"), Png.encode(f)) } }
        val info = prep.info
        val fx = foot?.first ?: if (info.transparent) (info.left + info.footX * (info.right - info.left)) / info.w else 0.5f
        val fy = foot?.second ?: if (info.transparent) (info.bottom + 1f) / info.h else 1f
        val c = LibChar(id = cid, name = spec.name.trim().take(MAX_NAME).ifBlank { "新角色" }, species = spec.species, source = edit?.source ?: "import", image = "lib:$dir/idle.png",
            footX = fx, footY = fy, created = edit?.created ?: now(), adult = spec.adult, facing = facing, opaque = prep.opaque, spec = spec.copy(name = spec.name.trim().ifBlank { "新角色" }),
            anims = anims, animSource = edit?.animSource ?: "混合", animUse = edit?.animUse.orEmpty(), faces = faces, marks = marks, flip = flip)
        return addLibChar(c)
    }
    private fun safeName(n: String): String = n.substringAfterLast('/').map { if (it.isLetterOrDigit() || it == '.' || it == '-' || it == '_') it else '_' }.joinToString("").take(60)
    /** an expression variant (one picture) for an existing character; null removes it */
    fun setFace(id: String, emotion: String, img: Raster?): String? {
        val c = libChar(id) ?: return "沒有這個角色"; if (c.source == "preset") return "內建角色不能修改"
        val path = "library/chars/$id/face_$emotion.png"
        val faces = c.faces.toMutableMap(); if (img == null) { store.delete(path); faces.remove(emotion) } else { store.write(path, Png.encode(img)); faces[emotion] = "lib:$path" }
        addLibChar(c.copy(faces = faces)); return null
    }
    /** `.ocpkg` (plan 3.1): the character with its settings, ready to share; presets are not exported (they are in every app) */
    fun exportPkg(id: String, author: String = ""): ByteArray {
        val c = libChar(id) ?: throw IllegalArgumentException("沒有這個角色"); require(c.source != "preset") { "內建角色已經在每個人的 App 裡了" }
        val bos = ByteArrayOutputStream(); val files = LinkedHashMap<String, ByteArray>()
        fun add(lib: String, name: String): String { files[name] = store.read(lib.removePrefix("lib:")) ?: throw IllegalArgumentException("少了圖片：$lib"); return name }
        val actions = LinkedHashMap<String, PkgAction>()
        actions["idle"] = c.anims["idle"]?.let { a -> PkgAction(a.frames.mapIndexed { i, f -> add(f, "frames/idle_$i.png") }, a.ms, a.loop) } ?: PkgAction(listOf(add(c.image, "frames/idle_0.png")), listOf(120))
        for ((a, an) in c.anims) if (a != "idle") actions[a] = PkgAction(an.frames.mapIndexed { i, f -> add(f, "frames/${a}_$i.png") }, an.ms, an.loop)
        val faces = c.faces.mapValues { (e, f) -> add(f, "faces/$e.png") }
        store.read(c.image.removePrefix("lib:"))?.let { files["preview.png"] = it }
        val m = PkgManifest(name = c.name, author = author, license = "作者保留所有權利", foot = listOf(c.footX, c.footY), facing = c.facing, flip = c.flip, actions = actions, faces = faces, marks = c.marks, spec = c.specOf())
        ZipOutputStream(bos).use { z -> fun put(n: String, d: ByteArray) { z.putNextEntry(ZipEntry(n)); z.write(d); z.closeEntry() }
            put("manifest.json", json.encodeToString(PkgManifest.serializer(), m).encodeToByteArray()); for ((n, d) in files) put(n, d) }
        return bos.toByteArray()
    }

    // ---------------- .ocsave (export / import a whole save) ----------------
    /** one file with the world, its card, and the library characters it uses (their pictures included) */
    fun exportSave(id: String): ByteArray {
        val meta = slot(id) ?: error("沒有這個存檔"); val world = store.read(worldPath(id)) ?: error("存檔是空的")
        val bos = ByteArrayOutputStream()
        ZipOutputStream(bos).use { z ->
            fun put(name: String, data: ByteArray) { z.putNextEntry(ZipEntry(name)); z.write(data); z.closeEntry() }
            put("ocsave.json", json.encodeToString(SaveFileHeader(1, meta)).encodeToByteArray())
            put("world.json", world)
            val chars = meta.residents.mapNotNull { libChar(it) }.filter { it.source != "preset" }
            put("chars.json", json.encodeToString(chars).encodeToByteArray())
            for (c in chars) { val dir = c.image.removePrefix("lib:").substringBeforeLast('/'); for (f in store.list(dir)) store.read("$dir/$f")?.let { put("$dir/$f", it) } }
        }
        return bos.toByteArray()
    }
    /** a file from exportSave → a new save (never overwrites one); every problem is refused with a reason */
    fun importSave(bytes: ByteArray): SlotMeta {
        val files = HashMap<String, ByteArray>()
        try { ZipInputStream(ByteArrayInputStream(bytes)).use { z -> var e = z.nextEntry; var total = 0L
            while (e != null) { val b = z.readBytes(); total += b.size; require(total < 200L * 1024 * 1024) { "檔案太大" }; if (!e.isDirectory && !e.name.contains("..")) files[e.name] = b; e = z.nextEntry } } }
        catch (e: IllegalArgumentException) { throw e } catch (e: Exception) { throw IllegalArgumentException("不是 OC Shimeji 的存檔檔案（無法解開）") }
        val head = files["ocsave.json"]?.let { runCatching { json.decodeFromString<SaveFileHeader>(it.decodeToString()) }.getOrNull() } ?: throw IllegalArgumentException("不是 OC Shimeji 的存檔檔案")
        require(head.v <= 1) { "這個存檔來自比較新的版本，請先更新 App" }
        val world = files["world.json"] ?: throw IllegalArgumentException("存檔裡沒有世界資料")
        runCatching { parseWorld(world) }.getOrElse { throw IllegalArgumentException("世界資料壞掉了：${it.message}") }
        val chars = files["chars.json"]?.let { json.decodeFromString<List<LibChar>>(it.decodeToString()) }.orEmpty()
        for (c in chars) if (libChar(c.id) == null) { val dir = c.image.removePrefix("lib:").substringBeforeLast('/'); for ((n, b) in files) if (n.startsWith("$dir/")) store.write(n, b); addLibChar(c) }
        val nid = newId("s"); val t = now()
        store.write(worldPath(nid), world)
        val meta = head.slot.copy(id = nid, name = head.slot.name + "（匯入）", created = t, lastPlayed = t, from = null)
        writeIndex(index().let { it.copy(slots = it.slots + meta) }); return meta
    }

    fun loadWorld(id: String): World? {
        val raw = store.read(worldPath(id)) ?: return null
        return try { parseWorld(raw) } catch (e: IllegalArgumentException) { if (e.message?.contains("請先更新") == true) throw e; store.readPrevious(worldPath(id))?.let { parseWorld(it) } ?: throw e }
    }
    internal fun parseWorld(raw: ByteArray): World {
        val up = Migrate.upgrade(json.parseToJsonElement(raw.decodeToString()).jsonObject, WORLD_VERSION, Migrate.WORLD)
        return json.decodeFromJsonElement(World.serializer(), up)
    }
    /** save the world; the first save of each calendar day also keeps a backup (the newest three days are kept) */
    fun saveWorld(id: String, w: World, playedSeconds: Long = 0) {
        val day = dayKey(now()); val bdir = "saves/$id/backup"
        if (store.read("$bdir/$day.json") == null) store.read(worldPath(id))?.let { old ->
            store.write("$bdir/$day.json", old)
            store.list(bdir).filter { it.endsWith(".json") }.sortedDescending().drop(KEEP_BACKUPS).forEach { store.delete("$bdir/$it") }
        }
        writeWorld(id, w)
        update(id) { it.copy(lastPlayed = now(), playSeconds = it.playSeconds + playedSeconds, residents = w.residents.map { r -> r.libId }, day = w.life?.day ?: it.day) }
    }
    fun backups(id: String): List<String> = store.list("saves/$id/backup").filter { it.endsWith(".json") }.map { it.removeSuffix(".json") }.sortedDescending()
    fun restoreBackup(id: String, day: String): Boolean { val b = store.read("saves/$id/backup/$day.json") ?: return false; store.write(worldPath(id), b); update(id) { it.copy(lastPlayed = now()) }; return true }

    fun touch(id: String) = update(id) { it.copy(lastPlayed = now()) }
    fun rename(id: String, name: String) = update(id) { it.copy(name = name.trim().take(MAX_NAME).ifBlank { it.name }) }

    /** 複製: an identical second save (its own seed from now on is the same — it is a copy, not a new world) */
    fun copy(id: String, name: String? = null): SlotMeta? {
        val src = slot(id) ?: return null; val nid = newId("s"); val t = now()
        store.copyDir("saves/$id", "saves/$nid"); store.deleteDir("saves/$nid/backup")
        val meta = src.copy(id = nid, name = name ?: "${src.name}（複製）", created = t, lastPlayed = t, from = id)
        writeIndex(index().let { it.copy(slots = it.slots + meta) }); return meta
    }
    /** 分支: like a copy, but from here on the world rolls its own dice (a "what if" that drifts away from the original) */
    fun branch(id: String, name: String? = null): SlotMeta? {
        val m = copy(id, name ?: "${slot(id)?.name ?: ""}（如果）") ?: return null
        val w = loadWorld(m.id) ?: return m
        writeWorld(m.id, w.copy(seed = Rng.hash("${m.id}:${now()}"))); return m
    }
    fun delete(id: String) { store.deleteDir("saves/$id"); writeIndex(index().let { it.copy(slots = it.slots.filter { s -> s.id != id }) }) }

    // ---------------- internals ----------------
    private fun index(): SaveIndex = idxCache ?: (store.read(IDX)?.let { json.decodeFromString<SaveIndex>(it.decodeToString()) } ?: SaveIndex()).also { idxCache = it }
    private fun writeIndex(x: SaveIndex) { store.write(IDX, json.encodeToString(x).encodeToByteArray()); idxCache = x }
    private fun update(id: String, f: (SlotMeta) -> SlotMeta) = writeIndex(index().let { ix -> ix.copy(slots = ix.slots.map { if (it.id == id) f(it) else it }) })
    private fun writeWorld(id: String, w: World) = store.write(worldPath(id), json.encodeToString(w).encodeToByteArray())
    private fun worldPath(id: String) = "saves/$id/world.json"
    private fun newId(p: String): String { idSeq++; return p + java.lang.Long.toString(now(), 36) + java.lang.Long.toString(idSeq, 36) }
    private fun dayKey(ms: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getDefault() }.format(Date(ms))

    @kotlinx.serialization.Serializable private class SaveFileHeader(val v: Int, val slot: SlotMeta)

    companion object {
        const val LIB = "library/index.json"; const val IDX = "saves/index.json"
        const val KEEP_BACKUPS = 3; const val MAX_NAME = 20; const val FLAGS = "settings/flags.json"; const val PREFS = "settings/prefs.json"
    }
}
