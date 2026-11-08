package app.ocshimeji.overlay

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Files shared between the game (through the bridge) and the overlay service:
 *
 *   filesDir/pet/config.json            pets on the desktop + per-pet settings + lines + foods + rules (written by the game)
 *   filesDir/pet/oc/<ocId>/manifest.json + PNG frames   sprite sets per OC (written by the game)
 *   filesDir/pet/events.jsonl           interactions on the desktop, waiting for the game (append-only, acked by id)
 *   filesDir/pet/status.json            what the service is really doing (for the management center)
 *
 * The game is the only life simulation; these files never hold needs that the native side changes.
 */
object PetFiles {
    fun root(ctx: Context) = File(ctx.filesDir, "pet").apply { mkdirs() }
    fun ocDir(ctx: Context, id: String) = File(root(ctx), "oc/" + safe(id))
    fun safe(id: String) = id.replace(Regex("[^A-Za-z0-9_\\-]"), "_").take(64)

    fun readConfig(ctx: Context): JSONObject = runCatching { JSONObject(File(root(ctx), "config.json").readText()) }.getOrElse { JSONObject() }
    fun writeConfig(ctx: Context, json: String): Boolean = runCatching {
        JSONObject(json) // validate before replacing
        atomic(File(root(ctx), "config.json"), json); true
    }.getOrDefault(false)

    fun atomic(f: File, text: String) { val tmp = File(f.parentFile, f.name + ".tmp"); tmp.writeText(text); if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) } }

    // ---------------- events → game ----------------
    private val lock = Any()
    private const val MAX_EVENTS = 400

    /** append one interaction; ids are monotonic per install so the game can de-duplicate */
    fun event(ctx: Context, oc: String, type: String, data: JSONObject = JSONObject()) = synchronized(lock) {
        runCatching {
            val sp = ctx.getSharedPreferences("oc_pet", Context.MODE_PRIVATE)
            val seq = sp.getLong("evSeq", 0L) + 1; sp.edit().putLong("evSeq", seq).apply()
            // install id: seq restarts after a reinstall / data clear, so the game keeps its watermark per install
            val inst = sp.getString("inst", null) ?: java.util.UUID.randomUUID().toString().take(8).also { sp.edit().putString("inst", it).apply() }
            val o = JSONObject().put("id", "$inst-$seq").put("inst", inst).put("seq", seq).put("t", System.currentTimeMillis()).put("oc", oc).put("type", type).put("data", data)
            val f = File(root(ctx), "events.jsonl")
            f.appendText(o.toString() + "\n")
            // bounded: drop the oldest beyond the cap (the game reads them every time it opens)
            val lines = f.readLines()
            if (lines.size > MAX_EVENTS) { atomic(f, lines.takeLast(MAX_EVENTS).joinToString("\n", postfix = "\n")); sp.edit().putInt("evDropped", sp.getInt("evDropped", 0) + lines.size - MAX_EVENTS).apply() }
        }
    }

    fun events(ctx: Context): JSONArray = synchronized(lock) {
        val out = JSONArray()
        runCatching { File(root(ctx), "events.jsonl").forEachLine { l -> if (l.isNotBlank()) runCatching { out.put(JSONObject(l)) } } }
        out
    }

    /** the game applied everything up to [seq] → remove them */
    fun ack(ctx: Context, seq: Long) = synchronized(lock) {
        runCatching {
            val f = File(root(ctx), "events.jsonl"); if (!f.exists()) return@runCatching
            val keep = f.readLines().filter { l -> l.isNotBlank() && runCatching { JSONObject(l).getLong("seq") > seq }.getOrDefault(false) }
            atomic(f, if (keep.isEmpty()) "" else keep.joinToString("\n", postfix = "\n"))
        }
    }

    fun pendingCount(ctx: Context): Int = runCatching { File(root(ctx), "events.jsonl").readLines().count { it.isNotBlank() } }.getOrDefault(0)
    fun dropped(ctx: Context): Int = ctx.getSharedPreferences("oc_pet", Context.MODE_PRIVATE).getInt("evDropped", 0)

    fun writeStatus(ctx: Context, o: JSONObject) = runCatching { atomic(File(root(ctx), "status.json"), o.toString()) }
    fun readStatus(ctx: Context): JSONObject = runCatching { JSONObject(File(root(ctx), "status.json").readText()) }.getOrElse { JSONObject() }

    /** remove every desktop-pet file (management center → clear) */
    fun clearAll(ctx: Context) { root(ctx).deleteRecursively(); root(ctx) }
}
