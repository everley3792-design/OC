package app.ocshimeji.sim

import app.ocshimeji.sim.chars.Address
import app.ocshimeji.sim.chars.Builder
import app.ocshimeji.sim.chars.Call
import app.ocshimeji.sim.chars.Catalog
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Speech
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** R4: every combination of style × mood × attitude × closeness × catchphrase place says a whole sentence; the address rules hold */
class SpeechTest {
    private val lines = listOf("早安，你今天也來了。", "咦？你在做什麼？", "我肚子餓了。", "謝謝你，我很開心！", "嗯～這樣啊。", "晚安，明天見。")
    private val addr = Address(stranger = "你", close = "小主", dear = "親愛的")

    @Test fun everyCombinationIsAWholeSentence() {
        var n = 0
        for (style in CharSpec.STYLES) for (mood in listOf(null) + Address.MOODS.keys) for (tone in listOf(null) + Address.TONES) for (aff in listOf(10, 50, 90))
            for (where in listOf(emptyList(), listOf("greet"), listOf("surprise"), listOf("end"), Address.PLACES.keys.toList())) for (base in lines) {
                val spec = CharSpec(name = "測", style = style, selfRef = "本人", endings = listOf("喔"), catchphrases = listOf("就是說"), banned = listOf("餓"),
                    address = addr.copy(moods = mapOf("angry" to "正式", "happy" to "元氣", "sad" to "冷淡"), catchWhen = where, catchRate = 0.5f))
                for (seed in 1L..2L) {
                    val toPlayer = tone == null
                    val t = Speech.say(spec, base, Rng(seed + n), aff, toPlayer, tone?.let { Call("阿雨", it) }, mood)
                    assertTrue(t.isNotBlank() && t.length >= 2, "blank: $style $mood $tone $aff $where $base"); assertFalse(t.contains("{") || t.contains("}"), t)
                    assertFalse(t.contains("餓"), "banned word: $t"); assertTrue(t.last() !in "，、", "ends mid-sentence: $t")
                    if (toPlayer) assertFalse(t.contains("你"), "how they call you at $aff: $t")
                    if (toPlayer && base.startsWith("謝謝你")) assertTrue(t.contains(when { aff >= 80 -> "親愛的"; aff >= 50 -> "小主"; else -> "您" }), "how they call you at $aff: $t")
                    n++
                }
            }
        assertTrue(n > 20000, "checked $n")
    }
    @Test fun theAddressRules() {
        val s = CharSpec(name = "測", address = addr)
        assertEquals("你", s.callFor(0)); assertEquals("小主", s.callFor(50)); assertEquals("親愛的", s.callFor(90))
        assertEquals("小主", CharSpec(callPlayer = "小主").callFor(90), "the old single name stands for all close steps")
        assertTrue(Speech.say(s, "你好。", Rng(1), 10, true).contains("您"), "a stranger is polite by default")
        assertTrue(Speech.say(CharSpec(address = Address(stranger = "那位")), "你好。", Rng(1), 10, true).contains("那位"), "unless you set the first step")
        // moods bring their own style; attitudes toward others
        assertTrue(Speech.say(CharSpec(address = Address(moods = mapOf("angry" to "正式"))), "你很煩耶！", Rng(1), 50, false, mood = "angry").endsWith("。"), "angry → formal")
        assertTrue(Speech.say(CharSpec(), "謝謝你。", Rng(1), 50, false, Call("阿雨", "敬重")).contains("您"))
        assertFalse(Speech.say(CharSpec(), "你看你看！", Rng(1), 50, false, Call("阿雨", "客氣")).contains("！"), "polite: no exclamations")
        assertTrue((1L..20L).any { Speech.say(CharSpec(), "你看。", Rng(it), 50, false, Call("阿雨", "撒嬌")).contains("嘛～") })
        assertTrue((1L..20L).any { Speech.say(CharSpec(), "你看。", Rng(it), 50, false, Call("阿雨", "嘴硬")).startsWith("哼") })
        // catchphrases only where you said
        val g = CharSpec(catchphrases = listOf("哈囉哈囉"), address = Address(catchWhen = listOf("greet"), catchRate = 1f))
        assertTrue(Speech.say(g, "早安。", Rng(1)).startsWith("哈囉哈囉")); assertFalse(Speech.say(g, "我去散步了。", Rng(1)).contains("哈囉哈囉"))
        val e = CharSpec(catchphrases = listOf("對吧"), address = Address(catchWhen = listOf("end"), catchRate = 1f)); assertTrue(Speech.say(e, "我去散步了。", Rng(1)).endsWith("對吧"))
    }
    @Test fun exclusiveTraitsAndThreeStateLikes() {
        var s = Builder.addTrait(CharSpec(), "健談"); s = Builder.addTrait(s, "害羞"); assertEquals(listOf("害羞"), s.traits, "the other side of a pair is replaced")
        assertTrue("健談" in Catalog.opposites("害羞")); assertTrue(Catalog.TRAITS.values.all { Catalog.groupOf(it.cat) in Catalog.GROUPS })
        var l = CharSpec(); l = Builder.cycleLike(l, "布丁"); assertEquals(listOf("布丁"), l.likes)
        l = Builder.cycleLike(l, "布丁"); assertTrue(l.likes.isEmpty() && l.dislikes == listOf("布丁")); l = Builder.cycleLike(l, "布丁"); assertTrue(l.likes.isEmpty() && l.dislikes.isEmpty())
        var full = CharSpec(); for (w in Catalog.LIKE_GROUPS.values.flatten().take(12)) full = Builder.cycleLike(full, w); assertEquals(Catalog.MAX_LIKES, full.likes.size)
        assertTrue(Builder.errors(CharSpec(likes = listOf("貓"), dislikes = listOf("貓"))).any { it.contains("貓") })
    }
}
