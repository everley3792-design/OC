package app.ocshimeji.overlay

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.SoundPool
import app.ocshimeji.core.pet.PetSound
import java.io.File

/**
 * Plays the little sounds of the desktop pets (12.0). The clips are the OC's own voice, rendered by the game and written to
 * `filesDir/pet/snd/<oc>/<name>.wav` (NativeBridge.petSounds); *when* a clip plays is decided by core:pet [PetSound] (unit-tested).
 *
 * A guest on the phone: the stream is a "sonification" one (follows the phone's ringer / silent mode like touch sounds), nothing plays
 * while the phone is on silent / vibrate, in a call, or the screen is off, and the player's own volume and switch (pet center) decide the rest.
 * No audio focus is requested and nothing is recorded — music keeps playing, the pet's sounds are short and quiet on top.
 */
class PetSounds(private val ctx: Context) {
    private var pool: SoundPool? = null
    private val ids = HashMap<String, Map<String, Int>>()    // oc → clip → sound id
    private val stamp = HashMap<String, Long>()             // oc → files signature (so a re-export reloads)
    private val ready = HashSet<Int>()
    private val audio = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    var played = 0; private set

    private fun pool(): SoundPool = pool ?: SoundPool.Builder().setMaxStreams(3)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build()
        .also { p -> p.setOnLoadCompleteListener { _, id, status -> if (status == 0) ready.add(id) }; pool = p }

    /** the phone is silent / vibrate-only or in a call */
    fun quiet(): Boolean = audio.ringerMode != AudioManager.RINGER_MODE_NORMAL || audio.mode != AudioManager.MODE_NORMAL

    /** (re)load the clips of one OC; returns the names that exist */
    fun load(oc: String): Set<String> {
        val dir = PetFiles.soundDir(ctx, oc)
        val files = dir.listFiles { f -> f.isFile && f.name.endsWith(".wav") }?.sortedBy { it.name } ?: return emptySet()
        val sig = files.sumOf { it.lastModified() + it.length() }
        if (stamp[oc] == sig && ids.containsKey(oc)) return ids.getValue(oc).keys
        ids[oc]?.values?.forEach { runCatching { pool?.unload(it) }; ready.remove(it) }
        val p = pool()
        val m = HashMap<String, Int>()
        for (f in files) { val n = f.name.removeSuffix(".wav"); if (n in PetSound.CLIPS) runCatching { p.load(f.path, 1) }.getOrNull()?.let { m[n] = it } }
        ids[oc] = m; stamp[oc] = sig
        return m.keys
    }

    fun play(oc: String, cue: PetSound.Cue) {
        val id = ids[oc]?.get(cue.clip) ?: return
        if (id !in ready) return
        runCatching { pool?.play(id, cue.volume, cue.volume, 1, 0, cue.rate) }.onSuccess { played++ }
    }

    fun release() { runCatching { pool?.release() }; pool = null; ids.clear(); stamp.clear(); ready.clear() }
}
