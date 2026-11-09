package app.ocshimeji.core.pet

import kotlin.random.Random

/**
 * Which little sound a desktop pet makes, and when (12.0). Pure Kotlin so the rules are unit-tested; the Android side only plays the
 * clip it is told to (SoundPool, `app.ocshimeji.overlay.PetSounds`).
 *
 * The clips themselves are made by the game, once per OC, from that OC's own voice (OfflineAudioContext → small 16-bit WAV files),
 * so every pet sounds like itself and nothing here is a stock sound. The names below are the contract: the game exports exactly
 * [CLIPS] (checked by a test that reads this file).
 *
 * Rules (a pet is a guest on someone's phone):
 *  - off by default; the player turns it on (and sets a volume) in the pet center
 *  - never while [quiet] (the phone is silent / vibrate-only, in a call, the screen is off — the host sets it)
 *  - nothing for a sleeping pet except waking up and being petted softly
 *  - a global gap between any two sounds, a per-event cool-down, no immediate repeat of the same variant
 *  - mood changes the pitch (rate) and loudness a little; it never makes a sound louder than the player's volume
 */
class PetSound(seed: Int = 13) {
    enum class Ev(val clips: List<String>, val cooldown: Float, val vol: Float) {
        TAP(listOf("tap_a", "tap_b"), 0.35f, 0.8f),
        PET(listOf("purr"), 2.5f, 0.6f),
        WAKE(listOf("wake"), 3f, 0.8f),
        JUMP(listOf("jump"), 0.8f, 0.7f),
        LAND(listOf("land"), 0.8f, 0.7f),
        THROWN(listOf("whoosh"), 1.5f, 0.7f),
        TALK(listOf("talk_a", "talk_b", "talk_c"), 1.2f, 0.75f),
        EAT(listOf("munch"), 1.5f, 0.7f),
        GIFT(listOf("gift"), 2f, 0.85f),
        MEET_GOOD(listOf("meet_good"), 6f, 0.7f),
        MEET_BAD(listOf("meet_bad"), 6f, 0.6f),
    }
    /** what to play: [clip] name, [volume] 0..1 (already scaled by the player's volume), [rate] 0.5..2 (playback speed → pitch) */
    data class Cue(val clip: String, val volume: Float, val rate: Float)

    /** the player's switch / volume (0..1) */
    var on = false
    var volume = 0.6f
    /** the phone is silent / in a call / screen off (set by the host) */
    var quiet = false
    /** clips that actually exist on this device for this pet (the game may not have exported them yet) */
    var available: Set<String> = CLIPS.toSet()

    private val rnd = Random(seed)
    private var clock = 0f
    private var lastAny = -1e9f
    private val lastEv = HashMap<Ev, Float>()
    private val lastClip = HashMap<Ev, String>()

    fun update(dt: Float) { clock += dt }

    /** [asleep]: the pet is sleeping right now; [emotion]: the game's dominant emotion id */
    fun cue(ev: Ev, emotion: String = "neutral", asleep: Boolean = false): Cue? {
        if (!on || quiet || volume <= 0.01f) return null
        if (asleep && ev != Ev.WAKE && ev != Ev.PET) return null
        if (clock - lastAny < GLOBAL_GAP) return null
        if (clock - (lastEv[ev] ?: -1e9f) < ev.cooldown) return null
        val have = ev.clips.filter { it in available }; if (have.isEmpty()) return null
        val last = lastClip[ev]
        val pool = if (have.size > 1) have.filter { it != last } else have
        val clip = pool[rnd.nextInt(pool.size)]
        val mood = emotion
        val rate = when { mood in BRIGHT -> 1.08f; mood in LOW -> 0.9f; mood in NERVOUS -> 1.04f; else -> 1f } * (1f + (rnd.nextFloat() - 0.5f) * 0.06f)
        val loud = when { mood in LOW -> 0.8f; mood in BRIGHT -> 1f; else -> 0.9f }
        lastAny = clock; lastEv[ev] = clock; lastClip[ev] = clip
        return Cue(clip, (ev.vol * loud * volume).coerceIn(0f, 1f), rate.coerceIn(0.5f, 2f))
    }

    /** the paired-action sound for a meeting kind (positive → the warm two-tone, otherwise the low one) */
    fun meeting(kind: String, emotion: String = "neutral"): Cue? {
        val k = PetSocial.KINDS[kind] ?: return null
        return cue(if (k.positive) Ev.MEET_GOOD else Ev.MEET_BAD, emotion)
    }

    fun reset() { lastAny = -1e9f; lastEv.clear(); lastClip.clear() }

    companion object {
        /** every clip the game exports for each pet (names are file names: <name>.wav) */
        val CLIPS: List<String> = listOf(
            "tap_a", "tap_b", "purr", "wake", "jump", "land", "whoosh", "talk_a", "talk_b", "talk_c", "munch", "gift", "meet_good", "meet_bad",
        )
        /** seconds between any two pet sounds */
        const val GLOBAL_GAP = 0.3f
        private val BRIGHT = setOf("happy", "excited", "proud", "content", "love")
        private val LOW = setOf("sad", "down", "lonely", "tired")
        private val NERVOUS = setOf("nervous", "annoyed", "surprised")
    }
}
