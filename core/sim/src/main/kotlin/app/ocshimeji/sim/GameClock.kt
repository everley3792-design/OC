package app.ocshimeji.sim

/**
 * Time in the world. Minutes since the save's epoch (game minutes). Two modes (decided in the plan):
 *   REAL  follows the phone's clock (the default) — one game minute is one real minute, local time of day
 *   GAME  its own clock that can run faster (×1 … ×60 while observing)
 * The clock never goes backwards: a phone clock turned back stops time instead of rewinding it.
 */
class GameClock(var mode: Mode = Mode.REAL, var minute: Double = 0.0, var speed: Double = 1.0) {
    enum class Mode { REAL, GAME }

    /** advance by real elapsed seconds; returns the game minutes that passed (≥ 0) */
    fun advance(realSeconds: Double, nowRealMinute: Double): Double {
        val before = minute
        minute = when (mode) {
            Mode.REAL -> maxOf(minute, nowRealMinute)
            Mode.GAME -> minute + realSeconds.coerceAtLeast(0.0) / 60.0 * speed
        }
        return minute - before
    }
    val day: Long get() = Math.floorDiv(minute.toLong(), MINUTES_PER_DAY)
    /** 0 ≤ h < 24 */
    val hour: Double get() = (minute - day * MINUTES_PER_DAY) / 60.0

    companion object {
        const val MINUTES_PER_DAY = 1440L
        /** the phone's local time as game minutes (time zone included) */
        fun realMinute(epochMs: Long, offsetMs: Int): Double = (epochMs + offsetMs) / 60000.0
    }
}
