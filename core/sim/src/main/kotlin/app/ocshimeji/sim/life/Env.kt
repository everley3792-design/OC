package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.town.Weather
import kotlinx.serialization.Serializable
import kotlin.math.floor

/** one change you made to the world's sky or clock (kept, so the world plays the same when it is opened again) */
@Serializable class EnvChange(val minute: Double, val what: String)
/**
 * Your hand on the environment (R2, plan B-4 / D4): today's weather, a locked season, a paused clock. Weather and seasons still come
 * from the date and the seed unless you set them; every change is a line in `changes` and in the timeline.
 */
@Serializable
class EnvState(
    /** game day → the weather you chose for it */
    val weather: MutableMap<Long, String> = mutableMapOf(),
    /** "" = follow the date */
    var season: String = "",
    var paused: Boolean = false,
    val changes: MutableList<EnvChange> = mutableListOf(),
)

/** what you can do to the environment; every function returns null when done, otherwise why not */
class Env(private val sim: LifeSim) {
    private val life get() = sim.life
    private val env get() = life.env
    companion object {
        /** the special skies (shown as themselves; for living they count as their everyday kind) */
        val SPECIAL = linkedMapOf("stars" to "流星雨", "aurora" to "極光", "petals" to "花瓣雨", "storm" to "雷雨")
        val BASE = mapOf("stars" to "sunny", "aurora" to "cloudy", "petals" to "sunny", "storm" to "rain")
        val ALL = listOf("sunny", "cloudy", "rain", "fog", "snow") + SPECIAL.keys
        fun zh(w: String) = Weather.ZH[w] ?: SPECIAL[w] ?: w
    }
    private fun note(what: String) {
        env.changes += EnvChange(life.minute, what); while (env.changes.size > 200) env.changes.removeAt(0)
        life.people.firstOrNull()?.let { sim.log(it, what, kind = "you", weight = 1) }
    }
    fun day() = Weather.dayOf(life.minute)
    /** the sky today, as drawn (may be special) */
    fun sky(): String = env.weather[day()] ?: Weather.of(life.seed, life.minute).let { if (env.season.isNotEmpty() && it == "snow" && env.season != "winter") "cloudy" else it }
    /** what today's weather means for living */
    fun weather(): String = sky().let { BASE[it] ?: it }
    fun season(): String = env.season.ifEmpty { Weather.season(life.minute) }
    fun setWeather(w: String?): String? {
        if (w == null) { env.weather.remove(day()); note("你讓天氣回到自然的樣子"); return null }
        if (w !in ALL) return "沒有這種天氣"
        if (w == "snow" && season() != "winter") return "只有冬天會下雪（可以先把季節調成冬天）"
        env.weather[day()] = w; note("你讓今天變成了${zh(w)}")
        if (w in SPECIAL) react(w)
        return null
    }
    fun setSeason(s: String?): String? {
        if (s != null && s !in Weather.SEASON_ZH) return "沒有這個季節"
        env.season = s ?: ""; note(if (s == null) "你讓季節跟著日期走" else "你把季節定在${Weather.SEASON_ZH[s]}天")
        if (s != null && s != "winter" && env.weather[day()] == "snow") env.weather.remove(day())
        return null
    }
    fun setPaused(on: Boolean) { env.paused = on; note(if (on) "你讓時間停了下來" else "時間又開始走了") }
    /** game time only: forward to the next given hour (what happens on the way is caught up) */
    fun jumpTo(hour: Double): String? {
        if (life.clockMode != "GAME") return "現實時間不能撥：先切到遊戲時间"
        val now = sim.hour; var d = (hour - now) * 60; if (d <= 1) d += 1440
        sim.catchUp(life.minute + d, summarize = false); note("你把時間撥到了 %02d:00".format(hour.toInt())); return null
    }
    /** a special sky: someone at home notices (deterministic, by the day) */
    private fun react(w: String) {
        val home = life.people.filter { it.out == null && !it.desk && !sim.asleep(it) }; if (home.isEmpty()) return
        val r = Rng.of(life.seed, "sky:${day()}:$w"); val p = r.pick(home)
        val (line, log) = when (w) {
            "stars" -> "流星！快許願！" to "對著流星雨許了願"
            "aurora" -> "天空在發光……好漂亮。" to "看見了極光"
            "petals" -> "花瓣飄進來了！" to "伸手接住了飄進窗的花瓣"
            else -> "打雷了……！" to "被雷聲嚇了一跳"
        }
        sim.say(p, line); sim.log(p, log, kind = "event", weight = 2); sim.addMood(p, if (w == "storm") "rainy" else "rainbow")
    }
    /** a rainbow: a rainy afternoon now and then (only on the date's own weather) */
    fun rainbow(): Boolean = env.weather[day()] == null && Weather.rainbow(life.seed, life.minute)
}
