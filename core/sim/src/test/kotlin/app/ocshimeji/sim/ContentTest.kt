package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.social.Content
import app.ocshimeji.sim.social.ContentEvent
import app.ocshimeji.sim.social.DailyContent
import app.ocshimeji.sim.social.Events
import app.ocshimeji.sim.social.RelWhen
import app.ocshimeji.sim.social.When
import app.ocshimeji.sim.social.Who
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** 2.1.0 (expansion plan, phase 1): the one content format */
class ContentTest {
    private val day0 = 20000.0 * 1440
    private fun world(specs: List<CharSpec>, hour: Double = 10.0, rels: List<Rel> = emptyList()): LifeSim {
        val h = Houses.get("apartment"); val ts = specs.mapIndexed { i, s -> Tenant("p${i + 1}", s.name, s.adult) }
        val life = LifeSim.create(5, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to "lib${it.id}" }, ts.indices.associate { "p${it + 1}" to specs[it] }, "鎮", "家", day0 + hour * 60, 0, rels)
        life.clockMode = "GAME"; life.speed = 60.0; life.arriving = false
        return LifeSim(life)
    }

    @Test fun theBuiltInEventsAreValidData() {
        assertEquals(23, DailyContent.ALL.size); assertEquals(emptyList(), Content.problems(DailyContent.ALL))
        assertEquals(DailyContent.ALL.map { it.id }, Events.DAILY.map { it.id }, "the daily events come from the data")
        val back = Content.parse(Content.write(DailyContent.ALL)); assertEquals(DailyContent.ALL, back, "write → read gives the same events")
    }
    @Test fun theValidatorCatchesMistakes() {
        val good = ContentEvent("x", "測試", script = "A:你好。 / B:你好。")
        assertEquals(emptyList(), Content.problems(listOf(good)))
        val bad = listOf(
            good.copy(id = ""), good, good,
            good.copy(id = "h", hours = listOf(9, 30)), good.copy(id = "s", script = "你好"), good.copy(id = "e", script = ""), good.copy(id = "c", script = "A:嗨 / C:嗨"),
            good.copy(id = "w", `when` = When(weather = listOf("tornado"), furniture = listOf("rocket"), minPeople = 5, maxPeople = 2, rel = RelWhen(minLike = 80, maxLike = 20),
                a = Who(traits = listOf("不存在的特質"), axisMin = mapOf("CUTE" to 0.1f), needBelow = mapOf("MONEY" to 3f)))),
            good.copy(id = "n", next = "nowhere"), good.copy(id = "k", category = "weird"), good.copy(id = "l", like = 50))
        val p = Content.problems(bad).joinToString("\n")
        for (w in listOf("沒有 id", "重複", "時間", "讀不出來", "「A:」或「B:」", "tornado", "rocket", "人數", "好感", "不存在的特質", "CUTE", "MONEY", "nowhere", "weird", "-10～10")) assertTrue(w in p, "should report $w:\n$p")
    }
    @Test fun conditionsAreFields() {
        val sad = CharSpec(name = "甲", cry = 0.5f); val s = world(listOf(CharSpec(name = "乙", axes = listOf(0f, 0.6f, 0f, 0f, 0f)), sad))
        val a = s.person("p1")!!; val b = s.person("p2")!!
        val byId = DailyContent.ALL.associateBy { it.id }
        assertTrue(Content.ok(s, byId["morningrun"]!!.copy(hours = listOf(0, 24)), a, b) { false }, "an active one may drag a friend out")
        assertFalse(Content.ok(s, byId["morningrun"]!!.copy(hours = listOf(0, 24)), b, a) { false }, "the other way round: not active")
        assertTrue(Content.ok(s, byId["tvcry"]!!.copy(hours = listOf(0, 24)), b, a) { false }); assertFalse(Content.ok(s, byId["tvcry"]!!.copy(hours = listOf(0, 24)), a, b) { false })
        val rain = ContentEvent("r", "雨天", script = "A:下雨了。", `when` = When(weather = listOf("rain")))
        assertFalse(Content.ok(s, rain, a, b) { false }); s.env.setWeather("rain"); assertTrue(Content.ok(s, rain, a, b) { false })
        val after = ContentEvent("af", "後來", script = "A:還記得嗎？", `when` = When(after = "sunset"))
        assertFalse(Content.ok(s, after, a, b) { false }); assertTrue(Content.ok(s, after, a, b) { it == "sunset" })
        val rom = ContentEvent("ro", "約會", category = "romance", script = "A:要不要一起走走？")
        assertFalse(Content.ok(s, rom, a, b) { false }, "romance only with romance on and two adults")
    }
    @Test fun theDailyEventsStillHappen() {
        val s = world(listOf(CharSpec(name = "甲"), CharSpec(name = "乙"), CharSpec(name = "丙")), hour = 8.0)
        s.life.people.forEach { it.recent["outing"] = s.life.minute + 30 * 1440.0 }
        s.catchUp(s.life.minute + 6 * 1440.0, summarize = false)
        val names = DailyContent.ALL.map { it.name }; val seen = s.life.log.filter { l -> names.any { l.text.endsWith("：$it") } }
        assertTrue(seen.isNotEmpty(), "daily events from the data happen")
    }
}
