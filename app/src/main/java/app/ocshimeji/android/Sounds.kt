package app.ocshimeji.android

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin

/**
 * The UI's sounds, synthesized at start-up (original: sine sweeps, soft noise and envelopes; no sound files, nothing borrowed).
 * Each is a short static AudioTrack that is rewound and played again. Any failure (no audio device, a vendor quirk) = silence.
 */
class Sounds {
    private val rate = 22050
    private val tracks = HashMap<String, AudioTrack>()
    private val noise = java.util.Random(7)   /* UI sound only — never part of the life simulation */

    private fun tone(sec: Float, f0: Float, f1: Float, vol: Float, decay: Float, harm: Float = 0f): ShortArray {
        val n = (rate * sec).toInt(); var ph = 0.0
        return ShortArray(n) { i -> val t = i.toFloat() / n; val f = f0 + (f1 - f0) * t; ph += 2 * PI * f / rate
            val env = minOf(1f, i / (rate * 0.004f)) * exp(-decay * t)
            ((sin(ph) + harm * sin(ph * 2)) / (1 + harm) * env * vol * Short.MAX_VALUE).toInt().toShort() }
    }
    private fun hush(sec: Float, vol: Float, decay: Float, bursts: Int = 1): ShortArray {
        val n = (rate * sec).toInt(); var lp = 0f
        return ShortArray(n) { i -> val t = i.toFloat() / n; val b = (t * bursts) % 1f
            lp += (noise.nextFloat() * 2 - 1 - lp) * 0.25f
            (lp * minOf(1f, b * 30) * exp(-decay * b) * vol * Short.MAX_VALUE).toInt().toShort() }
    }
    private fun mix(a: ShortArray, b: ShortArray): ShortArray = ShortArray(maxOf(a.size, b.size)) { i -> ((a.getOrElse(i) { 0 } + b.getOrElse(i) { 0 }) / 2).toShort() }

    private fun make(name: String): ShortArray? = when (name) {
        "tick" -> tone(0.035f, 1300f, 1100f, 0.18f, 6f)
        "pop" -> tone(0.09f, 420f, 920f, 0.3f, 4f, 0.3f)
        "lift" -> tone(0.16f, 300f, 720f, 0.3f, 2.5f, 0.2f)
        "whoosh" -> hush(0.28f, 0.35f, 3f)
        "land" -> mix(tone(0.14f, 140f, 80f, 0.6f, 5f), hush(0.1f, 0.25f, 8f))
        "bounce" -> tone(0.11f, 520f, 240f, 0.32f, 3f, 0.25f)
        "munch" -> hush(0.32f, 0.3f, 6f, bursts = 3)
        "chime" -> mix(tone(0.4f, 880f, 880f, 0.35f, 4f), tone(0.4f, 1320f, 1320f, 0.25f, 5f))
        else -> null
    }
    fun play(name: String) {
        runCatching {
            val tr = tracks[name] ?: run {
                val pcm = make(name) ?: return
                AudioTrack.Builder()
                    .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                    .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setBufferSizeInBytes(pcm.size * 2).setTransferMode(AudioTrack.MODE_STATIC).build()
                    .also { it.write(pcm, 0, pcm.size); tracks[name] = it }
            }
            if (tr.playState == AudioTrack.PLAYSTATE_PLAYING) tr.stop()
            tr.reloadStaticData(); tr.play()
        }
    }
    private var voiceTrack: AudioTrack? = null
    /** a short babble for a line: one soft syllable per few characters, pitch wandering like speech (plan 12.4 聲線) */
    fun voice(pitch: Float, speed: Float, timbre: String, bright: Float, text: String) {
        runCatching {
            val syl = (text.count { !it.isWhitespace() && it !in "，。！？、…～（）「」" } / 2).coerceIn(2, 10)
            val sylSec = 0.085f / speed.coerceIn(0.5f, 2f); val gap = sylSec * 0.35f
            val n = (rate * (syl * (sylSec + gap))).toInt(); val pcm = ShortArray(n); val base = 220f * pitch.coerceIn(0.5f, 2f)
            var i = 0; var ph = 0.0; val rnd = java.util.Random(text.hashCode().toLong())
            for (s in 0 until syl) {
                val f = base * (1f + (rnd.nextFloat() - 0.5f) * 0.35f); val len = (rate * sylSec).toInt()
                for (k in 0 until len) { if (i >= n) break; val t = k.toFloat() / len; ph += 2 * PI * f * (1 + 0.05 * sin(t * PI)) / rate
                    val env = sin(t * PI).toFloat()
                    val w = when (timbre) { "清脆" -> sin(ph) + 0.35 * sin(ph * 3); "沙啞" -> sin(ph) * 0.8 + (rnd.nextFloat() - 0.5) * 0.35; "電子" -> if (sin(ph) >= 0) 0.6 else -0.6; else -> sin(ph) + 0.15 * sin(ph * 2) }
                    val bright2 = 0.6 + 0.4 * bright
                    pcm[i++] = (w * env * 0.22 * bright2 * Short.MAX_VALUE).toInt().coerceIn(-32767, 32767).toShort() }
                i += (rate * gap).toInt()
            }
            voiceTrack?.let { runCatching { it.stop(); it.release() } }
            voiceTrack = AudioTrack.Builder()
                .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setBufferSizeInBytes(maxOf(2, pcm.size * 2)).setTransferMode(AudioTrack.MODE_STATIC).build().also { it.write(pcm, 0, pcm.size); it.play() }
        }
    }
    fun release() { voiceTrack?.let { runCatching { it.release() } }; voiceTrack = null; for (t in tracks.values) runCatching { t.release() }; tracks.clear() }

    // ---------------- imported sounds (plan 12.6): played from the app's own files, nothing else is read ----------------
    private var music: android.media.MediaPlayer? = null; private var musicPath = ""
    private val shorts = ArrayList<android.media.MediaPlayer>()
    fun clip(f: java.io.File, loop: Boolean) {
        runCatching {
            if (!f.isFile) return
            if (loop) { if (musicPath == f.path && music != null) return; stopMusic(); bgm("")
                music = android.media.MediaPlayer().apply { setDataSource(f.path); isLooping = true; setVolume(0.5f, 0.5f); prepare(); start() }; musicPath = f.path; return }
            shorts.removeAll { p -> if (!p.isPlaying) { p.release(); true } else false }
            if (shorts.size >= 4) return
            shorts += android.media.MediaPlayer().apply { setDataSource(f.path); prepare(); setOnCompletionListener { it.release(); shorts.remove(it) }; start() }
        }
    }
    fun stopMusic() { runCatching { music?.stop(); music?.release() }; music = null; musicPath = ""; bgm("") }

    // ---------------- time-of-day music (plan N-03): original loops made from a few notes, nothing borrowed ----------------
    private var bgmTrack: AudioTrack? = null; private var bgmKind = ""
    @Volatile private var bgmWant = ""
    private val bgmCache = HashMap<String, ShortArray>()
    /** "morning" / "day" / "rain" / "evening" / "night"; "" = stop. Made on a background thread the first time (about 16 seconds of sound). */
    fun bgm(kind: String) {
        bgmWant = kind
        if (kind == bgmKind) return
        runCatching { bgmTrack?.stop(); bgmTrack?.release() }; bgmTrack = null; bgmKind = ""
        if (kind.isEmpty() || music != null) return
        Thread {
            runCatching {
                val pcm = synchronized(bgmCache) { bgmCache.getOrPut(kind) { compose(kind) } }
                if (bgmWant != kind) return@Thread
                val tr = AudioTrack.Builder()
                    .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                    .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setBufferSizeInBytes(pcm.size * 2).setTransferMode(AudioTrack.MODE_STATIC).build()
                tr.write(pcm, 0, pcm.size); tr.setLoopPoints(0, pcm.size, -1); tr.setVolume(0.35f)
                synchronized(this) { if (bgmWant != kind) { tr.release(); return@Thread }; bgmTrack?.let { runCatching { it.stop(); it.release() } }; bgmTrack = tr; bgmKind = kind; tr.play() }
            }
        }.apply { isDaemon = true }.start()
    }
    /** a gentle loop: a pad of two chords and a pentatonic tune; tempo and register by the time of day */
    private fun compose(kind: String): ShortArray {
        val bpm = when (kind) { "morning" -> 96; "day" -> 104; "rain" -> 72; "evening" -> 84; else -> 64 }
        val root = when (kind) { "morning" -> 261.63; "day" -> 293.66; "rain" -> 220.0; "evening" -> 246.94; else -> 196.0 }
        val beat = 60.0 / bpm; val beats = 32; val n = (rate * beat * beats).toInt(); val out = FloatArray(n)
        val scale = doubleArrayOf(0.0, 2.0, 4.0, 7.0, 9.0, 12.0, 14.0, 16.0)   /* major pentatonic, two octaves */
        val chords = when (kind) { "rain", "night" -> listOf(doubleArrayOf(0.0, 3.0, 7.0), doubleArrayOf(-4.0, 0.0, 3.0)); else -> listOf(doubleArrayOf(0.0, 4.0, 7.0), doubleArrayOf(-3.0, 0.0, 4.0), doubleArrayOf(-7.0, -3.0, 0.0), doubleArrayOf(-5.0, -1.0, 2.0)) }
        fun hz(semi: Double) = root * Math.pow(2.0, semi / 12)
        // pad: each chord for 8 beats, slow attack and release so the loop joins without a click
        for (b in 0 until beats step 8) { val ch = chords[(b / 8) % chords.size]; val s0 = (rate * beat * b).toInt(); val len = (rate * beat * 8).toInt()
            for (semi in ch) { val f = hz(semi - 12); var ph = 0.0
                for (k in 0 until len) { if (s0 + k >= n) break; ph += 2 * PI * f / rate; val t = k.toDouble() / len; val env = minOf(1.0, t * 6) * minOf(1.0, (1 - t) * 6)
                    out[s0 + k] += (sin(ph) * 0.06 * env).toFloat() } } }
        // tune: a seeded walk on the scale (a UI-side choice, fixed per kind so the music is always the same)
        val rnd = java.util.Random(kind.hashCode().toLong()); var idx = 2
        var b = 0.0
        while (b < beats - 1) { val dur = if (kind == "night" || kind == "rain") 2.0 else if (rnd.nextInt(3) == 0) 0.5 else 1.0
            if (rnd.nextInt(5) != 0) { idx = (idx + rnd.nextInt(5) - 2).coerceIn(0, scale.size - 1); val f = hz(scale[idx]); val s0 = (rate * beat * b).toInt(); val len = (rate * beat * dur * 0.95).toInt(); var ph = 0.0
                for (k in 0 until len) { if (s0 + k >= n) break; ph += 2 * PI * f / rate; val t = k.toDouble() / len
                    val env = minOf(1.0, t * 40) * exp(-3.0 * t); out[s0 + k] += ((sin(ph) + 0.25 * sin(ph * 2) + 0.1 * sin(ph * 3)) * 0.11 * env).toFloat() } }
            b += dur }
        if (kind == "rain") { var lp = 0f; for (i in 0 until n) { lp += (noise.nextFloat() * 2 - 1 - lp) * 0.08f; out[i] += lp * 0.05f } }
        return ShortArray(n) { i -> (out[i].coerceIn(-1f, 1f) * Short.MAX_VALUE).toInt().toShort() }
    }
}
