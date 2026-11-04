package app.ocshimeji.overlay

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONObject
import java.io.File

/** Sprite frame sets for the floating pet, exported by the game into filesDir/pet/. */
class PetSprites(private val sets: Map<String, FrameSet>) {
    class FrameSet(val fps: Float, val frames: List<Bitmap>)
    fun get(anim: String): FrameSet? = sets[anim] ?: sets["idle"]

    companion object {
        val EMPTY = PetSprites(emptyMap())
        fun dir(ctx: Context) = File(ctx.filesDir, "pet")
        fun load(ctx: Context): PetSprites = runCatching {
            val d = dir(ctx); val m = JSONObject(File(d, "manifest.json").readText())
            val out = HashMap<String, FrameSet>()
            for (k in m.keys()) {
                val o = m.getJSONObject(k); val arr = o.getJSONArray("frames")
                val bmps = (0 until arr.length()).mapNotNull { BitmapFactory.decodeFile(File(d, arr.getString(it)).path) }
                if (bmps.isNotEmpty()) out[k] = FrameSet(o.optDouble("fps", 6.0).toFloat(), bmps)
            }
            PetSprites(out)
        }.getOrDefault(EMPTY)
    }
}
