package app.ocshimeji.sim

import app.ocshimeji.sim.chars.Builder
import app.ocshimeji.sim.chars.Catalog
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Effect
import app.ocshimeji.sim.chars.Speech
import app.ocshimeji.sim.chars.TagCat
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class CharsTest {
    @Test fun theTagLibraryIsBigAndEveryTagDoesSomething() {
        assertTrue(Catalog.TAGS.size >= 120, "${Catalog.TAGS.size} tags")
        for (c in TagCat.values()) assertTrue(Catalog.TAGS.values.count { it.cat == c } >= 10, "category ${c.zh}")
        for (t in Catalog.TAGS.values) assertNotEquals(Effect(), t.fx, "tag ${t.id} has no effect")
        for (t in Catalog.TRAITS.values) assertNotEquals(Effect(), t.fx, "trait ${t.id} has no effect")
        for (q in Catalog.QUIRKS.values) assertTrue(q.fx.micro != null, "quirk ${q.id} has its behaviour")
        for ((a, b) in Catalog.CONFLICTS) { assertTrue(Catalog.TRAITS.containsKey(a) && Catalog.TRAITS.containsKey(b)); assertTrue(Catalog.conflict(b, a)) }
    }
    @Test fun speechMakesTheSameLineDifferentPerCharacter() {
        val r = Rng(1)
        val plain = CharSpec()
        assertEquals("我今天很好。", Speech.say(plain, "我今天很好。", r))
        assertEquals("本王今天很好。", Speech.say(plain.copy(selfRef = "本王"), "我今天很好。", r))
        assertTrue(Speech.say(plain.copy(callPlayer = "主人"), "謝謝你。", r, affinity = 80, toPlayer = true).contains("主人"))
        assertTrue(Speech.say(plain.copy(callPlayer = "主人"), "謝謝你。", r, affinity = 40, toPlayer = true).contains("你"), "not close yet: plain 你")
        assertTrue(Speech.say(plain, "謝謝你。", r, affinity = 10, toPlayer = true).contains("您"), "a stranger is polite")
        assertEquals("那個很好吃。", Speech.say(plain.copy(banned = listOf("蛋糕")), "蛋糕很好吃。", r))
        val e = plain.copy(endings = listOf("喵")); assertTrue((1..20).any { Speech.say(e, "好睏。", Rng(it.toLong())) == "好睏喵。" })
        val c = plain.copy(catchphrases = listOf("沒問題")); assertTrue((1..30).any { Speech.say(c, "好睏。", Rng(it.toLong())).contains("沒問題") })
        for (st in CharSpec.STYLES.drop(1)) assertTrue((1..20).any { Speech.say(plain.copy(style = st), "我今天很好！我們走吧。", Rng(it.toLong())) != "我今天很好！我們走吧。" }, "style $st changes lines")
        assertEquals("（瞇起眼睛）", Speech.say(plain.copy(selfRef = "本王"), "（瞇起眼睛）", r), "actions are not words")
    }
    @Test fun scenePreviewDependsOnPersonality() {
        val r = Rng(3)
        val praise = { s: CharSpec -> Speech.preview(s, "被稱讚", Rng(3)) }
        assertNotEquals(praise(CharSpec()).first, praise(CharSpec(traits = listOf("嘴硬心軟"))).first)
        assertNotEquals(praise(CharSpec()).second, praise(CharSpec(shy = 0.8f)).second)
        assertNotEquals(Speech.preview(CharSpec(temper = 0.8f), "吵架", r).second, Speech.preview(CharSpec(cry = 0.8f), "吵架", r).second)
        for (sc in Speech.SCENES) assertTrue(Speech.preview(CharSpec(), sc, r).first.isNotBlank())
    }
    @Test fun templatesQuizAndDiceGiveValidCharacters() {
        for ((n, t) in Builder.TEMPLATES) { assertEquals(emptyList(), Builder.errors(t.copy(name = n)), n)
            val applied = Builder.applyTemplate(n, CharSpec(name = "小麥", age = 30, story = "從海邊來")); assertEquals("小麥", applied.name); assertEquals("從海邊來", applied.story); assertEquals(t.traits, applied.traits) }
        val q = Builder.quiz(CharSpec(name = "A"), List(10) { it % 3 }); assertEquals(emptyList(), Builder.errors(q)); assertTrue(q.traits.size >= 5)
        assertNotEquals(Builder.quiz(CharSpec(name = "A"), List(10) { 0 }).traits, Builder.quiz(CharSpec(name = "A"), List(10) { 1 }).traits)
        for (seed in 1L..80L) { val s = Builder.random(CharSpec(), Rng(seed)); assertEquals(emptyList(), Builder.errors(s), "seed $seed"); assertTrue(s.skills.values.sum() <= CharSpec.SKILL_POINTS)
            assertTrue(s.likes.none { it in s.dislikes }) }
        val base = Builder.random(CharSpec(name = "鎖"), Rng(9)); val again = Builder.random(base, Rng(10), setOf("個性", "說話"))
        assertEquals(base.traits, again.traits); assertEquals(base.style, again.style); assertNotEquals(base.likes, again.likes)
        assertEquals(Builder.random(CharSpec(), Rng(5)), Builder.random(CharSpec(), Rng(5)), "same dice, same result")
    }
    @Test fun rulesAndReminders() {
        assertFalse("邋遢" in Builder.addTrait(CharSpec(traits = listOf("邋遢")), "愛乾淨").traits, "a conflicting older trait is replaced")
        assertTrue(Builder.errors(CharSpec(traits = listOf("早起", "夜貓子"))).isNotEmpty())
        assertTrue(Builder.errors(CharSpec(skills = mapOf("料理" to 8, "閱讀" to 5))).isNotEmpty())
        assertEquals(10, Builder.fixSkills(CharSpec(skills = mapOf("料理" to 8, "閱讀" to 5))).skills.values.sum())
        assertTrue(Builder.warnings(CharSpec(tags = listOf("吸血鬼"), likes = listOf("曬太陽"))).isNotEmpty())
        assertTrue(Builder.warnings(CharSpec(tags = listOf("怕吵")), "apartment", 4).isNotEmpty())
        assertTrue(Builder.warnings(CharSpec(tags = listOf("怕吵")), "studio", 1).isEmpty())
        assertEquals("少年", CharSpec(age = 15).stage); assertFalse(CharSpec(age = 15).adult)
    }
}
