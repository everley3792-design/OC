package app.ocshimeji.overlay

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import app.ocshimeji.core.pet.AnimClip
import org.json.JSONObject
import java.io.File

/**
 * One OC's exported animations for the desktop (game → filesDir/pet/oc/<id>/manifest.json):
 *
 *   { v:2, oc, name, px, foot:{x,y}, anims: { walk: { frames:["walk_0.png",…], durs:[ms,…], loop:"loop|once|pingpong",
 *       repeat, speed, priority, interruptible, oriented, src:"player|rig", events:[{frame,type,data}] }, … } }
 *
 * Every frame of one OC shares the same box and foot point (the game renders them with the OC's
 * own reference height), so switching animations never jumps. Bitmaps are decoded lazily and kept
 * in a byte-bounded LRU shared by all pets ([cache]); onTrimMemory empties it.
 */
class PetSprites(val oc: String, private val dir: File, val px: Int, private val anims: Map<String, Set>) {
    class Set(val clip: AnimClip, val files: List<String>, val oriented: Boolean, val src: String)

    fun has(anim: String) = anims.containsKey(anim)
    fun set(anim: String): Set? = anims[anim] ?: anims[FALLBACK[anim] ?: "idle"] ?: anims["idle"]
    /** the key actually used for [anim] (after fallback) */
    fun keyFor(anim: String): String? = if (anims.containsKey(anim)) anim else (FALLBACK[anim]?.takeIf { anims.containsKey(it) } ?: "idle".takeIf { anims.containsKey(it) })
    val keys get() = anims.keys

    fun bitmap(set: Set, i: Int): Bitmap? {
        val name = set.files.getOrNull(i) ?: return null
        val k = "$oc/$name"
        cache.get(k)?.let { return it }
        val opts = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
        val b = runCatching { BitmapFactory.decodeFile(File(dir, name).path, opts) }.getOrNull() ?: return null
        cache.put(k, b); return b
    }

    companion object {
        /** used when an older export lacks a set (the game exports all of them with its own fallback chains) */
        private val FALLBACK = mapOf("run" to "walk", "fall" to "drag", "hang" to "climb", "climb" to "walk", "peek" to "idle", "pet" to "happy", "eat" to "happy", "talk" to "idle", "greet" to "happy", "cheer" to "happy", "shy" to "idle", "yawn" to "idle", "sad" to "idle", "surprised" to "happy", "jump" to "happy",
            // 11.0: an older export without these falls back to the nearest classic one
            "wave" to "greet", "bow" to "greet", "clap" to "cheer", "spin" to "cheer", "giggle" to "happy", "wiggle" to "happy", "aha" to "surprised", "sneeze" to "surprised", "hiccup" to "surprised", "sigh" to "sad")

        /** byte budget of decoded frames for all pets (performance setting "sprite cache") */
        @Volatile var budgetBytes = 24 * 1024 * 1024
        val cache = object : LruCache<String, Bitmap>(64 * 1024 * 1024) {
            override fun sizeOf(key: String, value: Bitmap) = value.byteCount
        }
        fun applyBudget(mb: Int) { budgetBytes = mb.coerceIn(8, 64) * 1024 * 1024; cache.resize(budgetBytes) }
        fun cacheBytes() = cache.size()

        fun load(ctx: Context, oc: String): PetSprites? = runCatching {
            val d = PetFiles.ocDir(ctx, oc); val m = JSONObject(File(d, "manifest.json").readText())
            val a = m.getJSONObject("anims"); val out = HashMap<String, Set>()
            for (k in a.keys()) {
                val o = a.getJSONObject(k); val fr = o.getJSONArray("frames"); val ds = o.optJSONArray("durs")
                val files = (0 until fr.length()).map { fr.getString(it) }.filter { File(d, it).exists() }
                if (files.isEmpty()) continue
                val durs = IntArray(files.size) { i -> ds?.optInt(i, 0)?.takeIf { it > 0 } ?: (1000.0 / o.optDouble("fps", 8.0)).toInt() }
                val ev = o.optJSONArray("events"); val events = ArrayList<AnimClip.Event>()
                if (ev != null) for (i in 0 until ev.length()) ev.optJSONObject(i)?.let { e -> events += AnimClip.Event(e.optInt("frame"), e.optString("type"), e.optString("data")) }
                out[k] = Set(AnimClip(durs, AnimClip.Loop.of(o.optString("loop")), o.optInt("repeat"), o.optDouble("speed", 1.0).toFloat(), events, o.optInt("priority"), o.optBoolean("interruptible", true)), files, o.optBoolean("oriented"), o.optString("src", "rig"))
            }
            if (out.isEmpty()) null else PetSprites(oc, d, m.optInt("px", 160), out)
        }.getOrNull()

        /** legacy (0.2–0.6) single-pet export in filesDir/pet/manifest.json → still shown until the game re-exports */
        fun legacy(ctx: Context): PetSprites? = runCatching {
            val d = PetFiles.root(ctx); val m = JSONObject(File(d, "manifest.json").readText()); val out = HashMap<String, Set>()
            for (k in m.keys()) {
                val o = m.getJSONObject(k); val arr = o.getJSONArray("frames"); val files = (0 until arr.length()).map { arr.getString(it) }
                if (files.isNotEmpty()) out[k] = Set(AnimClip.uniform(files.size, o.optDouble("fps", 6.0).toFloat()), files, false, "rig")
            }
            if (out.isEmpty()) null else PetSprites("legacy", d, 192, out)
        }.getOrNull()
    }
}
