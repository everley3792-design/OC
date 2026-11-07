package app.ocshimeji.core.pet

import kotlin.random.Random

/**
 * What the desktop pet says. The *wording* is produced by the game's dialogue engine (voice,
 * traits, emotion, memories, variables) and exported as small pools per category; this class only
 * decides *when* and *which* line, so the native side never invents content of its own.
 *
 * Rules: a global gap that depends on the player's frequency setting, a per-category cooldown,
 * no immediate repeats, quiet when muted / asleep, and reactions to touches always allowed (they
 * are answers, not chatter) unless fully muted.
 */
class PetTalk(seed: Int = 11) {
    enum class Freq(val gapSec: Float) { OFF(Float.MAX_VALUE), RARE(240f), NORMAL(90f), OFTEN(40f) }

    var pools: Map<String, List<String>> = emptyMap()
    var freq = Freq.NORMAL
    /** fully silent (no bubbles at all, not even reactions) */
    var muted = false

    private val rnd = Random(seed)
    private var sinceChat = 0f
    private val lastCat = HashMap<String, Float>()
    private val lastLine = HashMap<String, String>()
    private var clock = 0f

    fun update(dt: Float) { clock += dt; sinceChat += dt }

    /** reply to an interaction (tap, petting, food …): allowed unless muted; short per-category cooldown */
    fun react(cat: String, cooldown: Float = 6f): String? {
        if (muted) return null
        return pick(cat, cooldown)
    }

    /** spontaneous chatter: respects the frequency gap (with ±30 % jitter) */
    fun chatter(cat: String, cooldown: Float = 120f): String? {
        if (muted || freq == Freq.OFF) return null
        if (sinceChat < freq.gapSec * (0.7f + rnd.nextFloat() * 0.6f)) return null
        val s = pick(cat, cooldown) ?: return null
        sinceChat = 0f
        return s
    }

    /** spontaneous category for this moment (time of day, needs snapshot) */
    fun moodCategory(hour: Int, mood: PetBrain.Mood): String = when {
        mood.energy < 0.25f || hour >= 23 || hour < 6 -> "sleepy"
        mood.hunger < 0.3f -> "hungry"
        mood.social < 0.3f -> "lonely"
        hour in 6..9 -> "morning"
        hour in 18..22 -> "evening"
        rnd.nextFloat() < 0.25f -> "memory"
        else -> "idle"
    }

    fun has(cat: String) = !pools[cat].isNullOrEmpty()

    private fun pick(cat: String, cooldown: Float): String? {
        val list = pools[cat]?.filter { it.isNotBlank() } ?: return null
        if (list.isEmpty()) return null
        val last = lastCat[cat]
        if (last != null && clock - last < cooldown) return null
        val prev = lastLine[cat]
        val choices = if (list.size > 1) list.filter { it != prev } else list
        val s = choices[rnd.nextInt(choices.size)]
        lastCat[cat] = clock; lastLine[cat] = s
        return s
    }

    companion object {
        /** categories the game exports (see game/js/pet/petsync.js LINE_CATS) */
        val CATEGORIES = listOf("greet", "tap", "double", "pet", "drag", "drop", "eat_yum", "eat_ok", "eat_no", "gift", "idle", "sleepy", "hungry", "lonely", "morning", "evening", "memory", "wake", "friend", "timer_start", "timer_done", "rest", "remind")
    }
}

/**
 * App-context lines (opt-in): maps the foreground app *package name* (from UsageStatsManager —
 * never screen content) to a category through the player's rules, then to a line category.
 * Excluded packages are never commented on and can hide the pet.
 */
class AppContext {
    /** package → category id chosen by the player (game, music, video, read, social, work, browse, map, photo, shop, none) */
    var rules: Map<String, String> = emptyMap()
    /** packages the pet never talks about (and optionally hides over) */
    var exclude: Set<String> = emptySet()
    var hideOverExcluded = false
    /** use the system's own app category when the player made no rule */
    var useSystemCategory = true
    var enabled = false

    data class Hit(val pkg: String, val category: String?, val excluded: Boolean)

    fun classify(pkg: String, systemCategory: String?): Hit {
        if (pkg in exclude) return Hit(pkg, null, true)
        val c = rules[pkg] ?: (if (useSystemCategory) systemCategory else null)
        return Hit(pkg, c?.takeIf { it != "none" && it in CATS }, false)
    }

    companion object {
        val CATS = listOf("game", "music", "video", "read", "social", "work", "browse", "map", "photo", "shop")
        /** android.content.pm.ApplicationInfo.CATEGORY_* → our category (numbers so this stays Android-free) */
        fun fromSystem(cat: Int): String? = when (cat) { 0 -> "game"; 1 -> "music"; 2 -> "video"; 3 -> "photo"; 4 -> "social"; 5 -> "read"; 6 -> "map"; 7 -> "work"; else -> null }
    }
}
