package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.Life
import app.ocshimeji.sim.life.LifeSim
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** R2: your hand on the weather, the season and the clock — recorded, and the same every time */
class EnvTest {
    private val json = Json { encodeDefaults = true }
    private fun world(): LifeSim { val h = Houses.COTTAGE; val ts = listOf(Tenant("a", "甲", true), Tenant("b", "乙", true))
        val life = LifeSim.create(5, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to it.id }, mapOf("a" to CharSpec(name = "甲"), "b" to CharSpec(name = "乙")), "鎮", "家", 20000.0 * 1440 + 600, 0)
        life.arriving = false; life.clockMode = "GAME"; life.speed = 60.0; return LifeSim(life) }
    @Test fun weatherSeasonAndSpecialSkies() {
        val s = world()
        assertNotNull(s.env.setWeather("snow").takeIf { s.season() != "winter" }.let { if (s.season() == "winter") "skip" else it })
        assertNull(s.env.setSeason("winter")); assertEquals("winter", s.season()); assertNull(s.env.setWeather("snow")); assertEquals("snow", s.weather())
        assertNull(s.env.setWeather("storm")); assertEquals("storm", s.sky()); assertEquals("rain", s.weather(), "a storm lives like rain")
        assertTrue(s.life.log.any { it.text.contains("雷") }, "someone noticed the thunder")
        assertNull(s.env.setWeather(null)); assertNull(s.env.setSeason(null)); assertTrue(s.life.env.changes.size >= 5)
        val back = LifeSim(json.decodeFromString<Life>(json.encodeToString(s.life))); assertEquals(s.sky(), back.sky())
    }
    @Test fun pauseAndJump() {
        val s = world(); s.env.setPaused(true); val m = s.life.minute; repeat(50) { s.update(0.1f) }; assertEquals(m, s.life.minute, 1e-9)
        s.env.setPaused(false); assertNull(s.env.jumpTo(18.0)); assertEquals(18.0, s.hour, 0.05)
        s.life.clockMode = "REAL"; assertNotNull(s.env.jumpTo(8.0), "real time cannot be turned")
    }
    @Test fun sameChangesSameWorld() {
        fun go(): String { val s = world(); s.env.setWeather("petals"); repeat(600) { s.update(0.1f) }; s.env.setWeather("stars"); repeat(600) { s.update(0.1f) }; return s.life.log.joinToString { it.text } }
        assertEquals(go(), go())
    }
}
