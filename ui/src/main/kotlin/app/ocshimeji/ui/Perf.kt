package app.ocshimeji.ui

/**
 * 2.0.0 (R8, plan O-02 / 2.4) 效能分級: three tiers. The phone's class picks the starting tier (memory, cores, low-RAM flag); while
 * you play, a frame meter steps down when frames take too long and back up (never above the phone's tier) when they are fast again.
 * You can also pick one yourself (settings → 畫面品質; library flag `perf:low` / `perf:mid` / `perf:high`, none = 自動).
 * Only the look changes — particles, clouds, the furniture cache, the frame rate cap. The life never does.
 */
/** `particles` = share of rain, snow, petals and drifting leaves drawn; `clouds` = at most this many; `cacheMb` = the furniture picture cache; `fpsCap` = the most frames a second */
enum class Tier(val zh: String, val particles: Float, val clouds: Int, val cacheMb: Long, val fpsCap: Int) {
    LOW("省電", 0.3f, 2, 24, 30), MID("標準", 0.65f, 4, 40, 60), HIGH("高畫質", 1f, 6, 64, 60);
    fun down() = if (this == HIGH) MID else LOW
    fun up() = if (this == LOW) MID else HIGH
}

class Perf {
    /** what this phone can do (set once by the platform) */
    var device = Tier.HIGH; private set
    /** what is drawn now */
    var tier = Tier.HIGH; private set
    /** null = automatic; otherwise your choice */
    var forced: Tier? = null; private set
    private var slow = 0f; private var fast = 0f; private var avg = 16f
    /** the measured average frame cost (ms), for the settings line */
    val frameMs get() = avg

    /** the meter only runs on a real phone (the platform told us its class); tests and unknown platforms stay where they are */
    var adaptive = false; private set
    fun setDevice(t: Tier) { device = t; adaptive = true; if (forced == null) tier = t }
    fun force(t: Tier?) { forced = t; tier = t ?: device; slow = 0f; fast = 0f }
    /** one frame took `ms` to draw (`dt` seconds since the last): 3 s mostly over 28 ms → one tier down; 20 s under 12 ms → one up */
    fun sample(ms: Float, dt: Float) {
        avg += (ms - avg) * 0.1f
        if (forced != null || !adaptive) return
        if (avg > 28f) { slow += dt; fast = 0f } else if (avg < 12f) { fast += dt; slow = 0f } else { slow = (slow - dt).coerceAtLeast(0f); fast = (fast - dt).coerceAtLeast(0f) }
        if (slow > 3f && tier != Tier.LOW) { tier = tier.down(); slow = 0f; avg = 20f }
        if (fast > 20f && tier.ordinal < device.ordinal) { tier = tier.up(); fast = 0f }
    }
    companion object {
        /** the phone's class: app memory (MB), CPU cores, Android's own low-RAM flag */
        fun choose(memMb: Int, cores: Int, lowRam: Boolean): Tier = when {
            lowRam || memMb in 1 until 192 || cores in 1..4 -> Tier.LOW
            memMb in 192 until 384 || cores in 5..6 -> Tier.MID
            else -> Tier.HIGH
        }
        fun fromFlags(flag: (String) -> Boolean): Tier? = when { flag("perf:low") -> Tier.LOW; flag("perf:mid") -> Tier.MID; flag("perf:high") -> Tier.HIGH; else -> null }
    }
}
