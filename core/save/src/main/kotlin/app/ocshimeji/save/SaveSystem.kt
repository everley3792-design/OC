package app.ocshimeji.save

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.house.HouseType
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
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
    fun createWorld(name: String, town: String, home: String, house: HouseType, libIds: List<String>, rooms: Map<String, String>, nowMinute: Double): SlotMeta {
        val t = now(); val id = newId("s"); val seed = Rng.hash("$id:$t")
        val chars = libIds.mapNotNull { libChar(it) }
        val tenants = chars.map { Tenant("r_" + it.id, it.name, it.adult) }
        Houses.check(house, tenants)?.let { throw IllegalArgumentException(it) }
        val rr = chars.associate { "r_" + it.id to (rooms[it.id] ?: error("${it.name}還沒有房間")) }
        Houses.checkRooms(house, tenants, rr)?.let { throw IllegalArgumentException(it) }
        val life = LifeSim.create(seed, house, tenants, rr, chars.associate { "r_" + it.id to it.id }, chars.associate { "r_" + it.id to it.likes }, chars.associate { "r_" + it.id to it.traits }, town, home, nowMinute, t)
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
        val tenants = chars.take(house.capacity).map { (r, c) -> Tenant(r.id, r.name, c.adult) }
        val life = LifeSim.create(w.seed, house, tenants, Houses.autoRooms(house, tenants), chars.associate { (r, c) -> r.id to c.id }, chars.associate { (r, c) -> r.id to c.likes }, chars.associate { (r, c) -> r.id to c.traits }, w.townName, "", nowMinute, now())
        val up = w.copy(life = life); writeWorld(id, up); return up
    }

    // ---------------- importing a character from one picture (M1; the full creation is M2) ----------------
    /** `working` = the PNG the game draws (≤ 1024 px), `original` = the file as picked (kept, never changed) */
    fun importChar(name: String, adult: Boolean, facing: Int, info: ImageInfo, working: ByteArray, original: ByteArray, originalExt: String): LibChar {
        val cid = newId("c"); val dir = "library/chars/$cid"
        store.write("$dir/idle.png", working); store.write("$dir/original.$originalExt", original)
        val footY = if (info.transparent) (info.bottom + 1f) / info.h else 1f
        return addLibChar(LibChar(id = cid, name = name.trim().take(MAX_NAME).ifBlank { "新角色" }, source = "import", image = "lib:$dir/idle.png",
            footX = if (info.transparent) (info.left + info.footX * (info.right - info.left)) / info.w else 0.5f, footY = footY, adult = adult, facing = facing, opaque = !info.transparent, created = now()))
    }
    fun readFile(path: String): ByteArray? = store.read(path)

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
        const val KEEP_BACKUPS = 3; const val MAX_NAME = 20; const val FLAGS = "settings/flags.json"
    }
}
