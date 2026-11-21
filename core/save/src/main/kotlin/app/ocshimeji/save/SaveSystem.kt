package app.ocshimeji.save

import app.ocshimeji.sim.Rng
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
    fun library(): LibraryIndex {
        val own = store.read(LIB)?.let { json.decodeFromString<LibraryIndex>(it.decodeToString()) } ?: LibraryIndex()
        return own.copy(chars = Presets.ALL + own.chars.filter { c -> Presets.ALL.none { it.id == c.id } })
    }
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
    private fun writeLib(x: LibraryIndex) = store.write(LIB, json.encodeToString(x).encodeToByteArray())

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
    fun loadWorld(id: String): World? {
        val raw = store.read(worldPath(id)) ?: return null
        return try { parseWorld(raw) } catch (e: IllegalArgumentException) { if (e.message?.contains("請先更新") == true) throw e; store.readPrevious(worldPath(id))?.let { parseWorld(it) } ?: throw e }
    }
    private fun parseWorld(raw: ByteArray): World {
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
        update(id) { it.copy(lastPlayed = now(), playSeconds = it.playSeconds + playedSeconds, residents = w.residents.map { r -> r.libId }) }
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
    private fun index(): SaveIndex = store.read(IDX)?.let { json.decodeFromString<SaveIndex>(it.decodeToString()) } ?: SaveIndex()
    private fun writeIndex(x: SaveIndex) = store.write(IDX, json.encodeToString(x).encodeToByteArray())
    private fun update(id: String, f: (SlotMeta) -> SlotMeta) = writeIndex(index().let { ix -> ix.copy(slots = ix.slots.map { if (it.id == id) f(it) else it }) })
    private fun writeWorld(id: String, w: World) = store.write(worldPath(id), json.encodeToString(w).encodeToByteArray())
    private fun worldPath(id: String) = "saves/$id/world.json"
    private fun newId(p: String): String { idSeq++; return p + java.lang.Long.toString(now(), 36) + java.lang.Long.toString(idSeq, 36) }
    private fun dayKey(ms: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getDefault() }.format(Date(ms))

    companion object {
        const val LIB = "library/index.json"; const val IDX = "saves/index.json"
        const val KEEP_BACKUPS = 3; const val MAX_NAME = 20
    }
}
