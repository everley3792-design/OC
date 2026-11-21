package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.CustomTag
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.WorldItem
import app.ocshimeji.sim.script.Scripts
import app.ocshimeji.sim.social.Topics
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ScriptTest {
    private val day0 = 20000.0 * 1440
    private val TEXT = """
        # 標題：雨天的傘
        # 角色：A=任何人 B=標籤:社畜
        # 時間：0-24
        # 機率：100
        # 特寫
        [A] 要不要一起撐傘？
        @A 開心
        !B 愛心
        [B] ……好。
        = 好感 B→A +5
        = 心情 A socgood
        = 記憶 B +1 一起撐傘
        = 旗標 umbrella
    """.trimIndent()
    private fun world(specs: List<CharSpec>, romance: Boolean = false): LifeSim {
        val h = Houses.APARTMENT; val ts = specs.mapIndexed { i, s -> Tenant("p${i + 1}", s.name, s.adult) }
        val life = LifeSim.create(11, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to it.id }, ts.indices.associate { "p${it + 1}" to specs[it] }, "鎮", "家", day0 + 10 * 60, 0, romance = romance)
        life.clockMode = "GAME"; life.speed = 60.0; life.arriving = false; return LifeSim(life)
    }
    private fun run(s: LifeSim, min: Double) { val end = s.life.minute + min; while (s.life.minute < end) { s.update(0.1f); s.events.clear() } }

    @Test fun textAndJsonBothWaysWithLineNumberedErrors() {
        val s = Scripts.parse(TEXT, "x", "我")
        assertEquals("雨天的傘", s.name); assertEquals("tag:社畜", s.roles[1].match); assertEquals(4, s.steps.size); assertEquals(4, s.results.size); assertTrue(s.closeup); assertTrue(Scripts.problems(s).isEmpty())
        assertEquals(s, Scripts.parse(Scripts.toText(s), "x", "我"), "text → blocks → text keeps everything")
        assertEquals(s, Scripts.fromJson(Scripts.toJson(s)))
        val e = assertFailsWith<IllegalArgumentException> { Scripts.parse("# 標題：x\n[A] 好\n@A 跳舞\n") }; assertTrue(e.message!!.startsWith("第 3 行"), e.message)
        assertTrue(assertFailsWith<IllegalArgumentException> { Scripts.parse("隨便寫") }.message!!.contains("第 1 行"))
        assertTrue(assertFailsWith<IllegalArgumentException> { Scripts.parse("= 好感 B +3") }.message!!.contains("誰對誰"))
        assertTrue(Scripts.problems(s.copy(steps = emptyList(), results = emptyList())).any { it.contains("至少") })
        assertTrue(Scripts.problems(s.copy(roles = s.roles + app.ocshimeji.sim.script.RoleDef("C"))).any { it.contains("1.0") })
        val ch = Scripts.parse("# 標題：q\n[A] 嗯\n? 怎麼辦？\n- 好\n[B] 好耶\n- 不好\n= 好感 B→A -2\n"); assertEquals(2, ch.choice!!.options.size); assertEquals(1, ch.choice!!.options[0].steps.size)
        assertTrue(Scripts.parse("[A] 我喜歡你\n").romantic); assertTrue(Scripts.parse("[A] 嗯\n= 心動 A→B +3\n").romantic)
    }
    @Test fun aScriptPlaysInTheHouseWithItsResults() {
        val s = world(listOf(CharSpec(name = "阿光", age = 25), CharSpec(name = "小雨", age = 24, tags = listOf("社畜"))))
        s.life.scripts += Scripts.parse(TEXT, "rain")
        s.life.soc.lively = 2
        run(s, 12 * 60.0)
        assertTrue(s.life.log.any { it.text.contains("雨天的傘") }, "the script played"); assertTrue("umbrella" in s.life.soc.flags)
        assertTrue((s.rel("p2", "p1")?.like ?: 0) >= 35); assertTrue(s.society.memoriesOf("p2").any { it.what == "一起撐傘" })
        /* B must be an office worker: swapped roles never match */
        assertTrue(!s.society.scriptOk(s.life.scripts[0], s.person("p2")!!, s.person("p1")!!))
    }
    @Test fun romanticScriptsOnlyForTwoAdultsWithRomanceOn() {
        val sc = Scripts.parse("# 標題：告白練習\n# 機率：100\n[A] 我喜歡你。\n= 心動 A→B +10\n", "love")
        val kids = world(listOf(CharSpec(name = "小可", age = 12), CharSpec(name = "小安", age = 13)), romance = true)
        val adultsOff = world(listOf(CharSpec(name = "甲", age = 30), CharSpec(name = "乙", age = 30)), romance = false)
        val adultsOn = world(listOf(CharSpec(name = "甲", age = 30), CharSpec(name = "乙", age = 30)), romance = true)
        for (w in listOf(kids, adultsOff, adultsOn)) w.life.scripts += sc
        assertTrue(!kids.society.scriptOk(sc, kids.person("p1")!!, kids.person("p2")!!)); assertTrue(!adultsOff.society.scriptOk(sc, adultsOff.person("p1")!!, adultsOff.person("p2")!!))
        assertTrue(adultsOn.society.scriptOk(sc, adultsOn.person("p1")!!, adultsOn.person("p2")!!))
        run(kids, 8 * 60.0); kids.catchUp(kids.life.minute + 2 * 1440)
        assertTrue(kids.life.rels.all { it.crush == 0 }); assertTrue(kids.life.log.none { it.text.contains("告白練習") })
    }
    @Test fun aScriptCanAskYouFirst() {
        val s = world(listOf(CharSpec(name = "甲", age = 30), CharSpec(name = "乙", age = 30)))
        s.life.scripts += Scripts.parse("# 標題：要不要出門\n# 機率：100\n[A] 今天要出門嗎？\n? 你覺得呢？\n- 出門\n[B] 走吧！\n= 旗標 out\n- 待在家\n[B] 好喔。\n= 旗標 home\n", "q")
        s.life.soc.lively = 2
        var asked = false; val end = s.life.minute + 12 * 60
        while (s.life.minute < end && !asked) { s.update(0.1f); asked = s.events.any { it.kind == "choice" }; s.events.clear() }
        assertTrue(asked, "asked you"); assertNotNull(s.society.pendingChoice())
        assertTrue(s.society.answerChoice(1)); assertNull(s.society.pendingChoice())
        run(s, 30.0); assertTrue("home" in s.life.soc.flags && "out" !in s.life.soc.flags); assertTrue(s.life.log.any { it.text.contains("你選了：待在家") })
    }
    @Test fun customTagsFoodAndGiftsWork() {
        val tag = CustomTag("烘焙魂", act = mapOf("cook" to 3f), lines = listOf("麵團要揉三百下。"), concepts = listOf("麵團", "酵母"))
        val s = world(listOf(CharSpec(name = "甲", tags = listOf("烘焙魂")), CharSpec(name = "乙")))
        val p = s.person("p1")!!; val before = s.appeal(p, app.ocshimeji.sim.life.Acts["cook"]!!).first
        s.life.tags += tag; s.editSpec("p1", p.spec)   /* the cache is per spec: editing refreshes it */
        assertTrue(s.appeal(p, app.ocshimeji.sim.life.Acts["cook"]!!).first > before * 2, "the tag changes what they like to do")
        assertTrue("麵團" in Topics.conceptsOf(p.spec, s.life.tags))
        s.life.items += WorldItem("pud", "手作布丁", "food", "甜", 30f); s.life.items += WorldItem("star", "星星吊飾", "gift", words = listOf("星星"))
        assertTrue(s.snacks.any { it.first == "item:pud" })
        p.setNeed(Need.FOOD, 30f); s.feed("p1", "item:pud"); assertTrue(p.need(Need.FOOD) > 55f); assertTrue(s.life.log.last().text.contains("手作布丁"))
    }
}
