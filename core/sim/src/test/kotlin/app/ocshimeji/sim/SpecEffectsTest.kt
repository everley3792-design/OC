package app.ocshimeji.sim

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Address
import app.ocshimeji.sim.chars.Call
import app.ocshimeji.sim.chars.Habit
import app.ocshimeji.sim.chars.Rel
import app.ocshimeji.sim.chars.Speech
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.Person
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * Plan 12.11 M2 acceptance: every setting has an effect you can see. Each field of CharSpec is changed on its own and something
 * observable must change: a choice, a schedule, a need, a mood, a line, a reaction. (Fields that only change the drawing or the
 * card — height, tint, motion, voice, species, story — are checked by the UI tests.)
 */
class SpecEffectsTest {
    private val day0 = 20000.0 * 1440
    private fun sim(spec: CharSpec, hour: Double = 10.0, other: CharSpec? = null, rels: List<Rel> = emptyList(), house: String = "cottage"): Pair<LifeSim, Person> {
        val h = Houses.get(house); val ts = listOfNotNull(Tenant("a", spec.name, spec.adult), other?.let { Tenant("b", it.name, it.adult) })
        val life = LifeSim.create(7, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to it.id }, listOfNotNull("a" to spec, other?.let { "b" to it }).toMap(), "鎮", "家", day0 + hour * 60, 0, rels)
        life.arriving = false; life.clockMode = "GAME"; life.speed = 60.0
        val s = LifeSim(life); return s to life.people[0]
    }
    private val base = CharSpec(name = "測試")
    private fun appeal(spec: CharSpec, act: String) = sim(spec).let { (s, p) -> s.appeal(p, Acts[act]!!).first }
    private fun lines(spec: CharSpec, line: String, toPlayer: Boolean = false, aff: Int = 50) = (1..30).map { Speech.say(spec, line, Rng(it.toLong()), aff, toPlayer) }.toSet()
    private fun run(s: LifeSim, sec: Float) { var t = 0f; while (t < sec) { s.update(0.1f); t += 0.1f } }

    @Test fun personality() {
        assertTrue(appeal(base.copy(axes = listOf(0f, 0.9f, 0f, 0f, 0f)), "tidy") > appeal(base.copy(axes = listOf(0f, -0.9f, 0f, 0f, 0f)), "tidy"), "axes")
        assertTrue(appeal(base.copy(traits = listOf("書蟲")), "read") > appeal(base, "read") * 1.5f, "traits")
        assertTrue(appeal(base.copy(values = listOf("樂趣")), "tv") > appeal(base, "tv"), "values")
        assertTrue(appeal(base.copy(tags = listOf("怕水")), "bathe") < appeal(base, "bathe"), "tags")
        assertTrue(appeal(base.copy(quirks = listOf("對植物說話")), "water") > appeal(base, "water"), "quirks")
        val (s1, p1) = sim(base.copy(cry = 0.9f)); val (s2, p2) = sim(base.copy(cry = -0.9f)); assertTrue(s1.moodWeight(p1, -2) < s2.moodWeight(p2, -2), "cry")
        val (s3, p3) = sim(base.copy(temper = 0.9f)); assertEquals("angry", s3.throwReaction(p3), "temper")
        assertNotEquals(Speech.preview(base, "被稱讚", Rng(1)).second, Speech.preview(base.copy(shy = 0.9f), "被稱讚", Rng(1)).second, "shy")
    }
    @Test fun likesAndTastes() {
        assertTrue(appeal(base.copy(likes = listOf("看書")), "read") > appeal(base, "read"), "likes")
        assertTrue(appeal(base.copy(dislikes = listOf("洗澡")), "bathe") < appeal(base, "bathe"), "dislikes")
        assertTrue(appeal(base.copy(hobbies = listOf("種花")), "water") > appeal(base, "water"), "hobbies")
        val (s, p) = sim(base.copy(tastes = mapOf("酸" to -1))); assertEquals(-1, s.taste(p, "apple"), "tastes")
        val probes: List<Pair<CharSpec, String>> = listOf(base.copy(color = "藍") to "藍", base.copy(season = "冬") to "冬", base.copy(weather = "雨天") to "雨天",
            base.copy(dream = "開一間小店") to "開一間小店", base.copy(fears = listOf("打雷")) to "打雷", base.copy(memories = listOf("第一次看海")) to "第一次看海")
        for ((f, v) in probes)
            assertTrue((1..60).any { Speech.idle(f, Rng(it.toLong()))?.contains(v) == true }, "$v appears in what they say")
        val (sd, pd) = sim(base.copy(fears = listOf("黑暗")), hour = 22.0); sd.life.people[0].x = 1.5f; sd.life.people[0].y = 6.5f   /* the living room has no lamp */
        run(sd, 0.3f); assertTrue(pd.moods.any { it.id == "dark" }, "a fear of the dark matters at night")
    }
    @Test fun speech() {
        assertTrue(lines(base.copy(selfRef = "本大爺"), "我餓了。").all { it.contains("本大爺") }, "selfRef")
        assertTrue(lines(base.copy(callPlayer = "主人"), "謝謝你。", true, 80).all { it.contains("主人") }, "callPlayer")
        assertTrue(lines(base.copy(endings = listOf("喵")), "我餓了。").any { it.contains("喵") }, "endings")
        assertTrue(lines(base.copy(catchphrases = listOf("沒問題")), "我餓了。").any { it.contains("沒問題") }, "catchphrases")
        assertTrue(lines(base.copy(banned = listOf("餓")), "我餓了。").none { it.contains("餓") }, "banned")
        assertNotEquals(lines(base, "我今天很好。"), lines(base.copy(style = "元氣"), "我今天很好。"), "style")
        assertEquals("呦。", Speech.preview(base.copy(greeting = "呦。"), "早安", Rng(1)).first, "greeting")
    }
    @Test fun addressHabitsAndNicknames() {   /* R4: every new field has a visible effect */
        assertTrue(lines(base.copy(address = Address(dear = "親愛的")), "謝謝你。", true, 90).all { it.contains("親愛的") }, "address.dear")
        assertTrue(lines(base.copy(address = Address(stranger = "那位")), "謝謝你。", true, 10).all { it.contains("那位") }, "address.stranger")
        assertTrue(lines(base.copy(address = Address(moods = mapOf("happy" to "元氣"))), "我今天很好。").none { it.endsWith("！") } &&
            (1..30).map { Speech.say(base.copy(address = Address(moods = mapOf("happy" to "元氣"))), "我今天很好。", Rng(it.toLong()), mood = "happy") }.all { it.endsWith("！") }, "address.moods")
        // a habit shows up as a line, an icon and a memory
        val (s, p) = sim(base.copy(habits = listOf(Habit("（對著窗戶哼了一首歌）", 2, "heart"))), 10.0)
        var fx = false; repeat(12000) { s.update(0.1f); if (s.events.any { it.kind == "fx" && it.text == "heart" && it.who == p.id }) fx = true; s.events.clear() }
        assertTrue(s.life.log.any { it.kind == "habit" && it.text.contains("哼了一首歌") }, "habits"); assertTrue(fx, "the habit's icon")
        // how one calls another: what you set, or a nickname once they are close
        val other = CharSpec(name = "小雨點")
        val (s2, a) = sim(base.copy(address = Address(others = mapOf("b" to Call("雨滴", "撒嬌")))), 10.0, other); val b = s2.person("b")!!
        assertEquals("雨滴", s2.society.nickBy(a, b)); assertEquals("撒嬌", s2.society.callTo(a, b).tone)
        val (s3, a3) = sim(base, 10.0, other, rels = listOf(Rel("a", "b", "好友", like = 80, familiar = 70), Rel("b", "a", "好友")))
        assertEquals("點點", s3.society.nickBy(a3, s3.person("b")!!), "a nickname of their own once close (C-07)"); assertEquals("測試", s3.society.nickBy(s3.person("b"), a3), "not close the other way round: the plain name")
    }
    @Test fun lifeAndSchedule() {
        val (s0, p0) = sim(base)
        assertTrue(sim(base.copy(wake = 5)).let { (s, p) -> s.wakeOf(p) } < s0.wakeOf(p0), "wake")
        assertTrue(sim(base.copy(sleep = 21)).let { (s, p) -> s.sleepOf(p) } < s0.sleepOf(p0), "sleep")
        assertNotEquals(s0.sleepOf(p0), sim(base.copy(nightOwl = 1f)).let { (s, p) -> s.sleepOf(p) }, "nightOwl")
        assertTrue(sim(base.copy(tags = listOf("夜行性"))).let { (s, p) -> s.wakeOf(p) } > s0.wakeOf(p0), "a tag moves the schedule")
        assertTrue(appeal(base.copy(nap = false), "nap") == appeal(base, "nap") && run { val (s, p) = sim(base.copy(nap = false), hour = 14.0); p.setNeed(Need.ENERGY, 5f); run(s, 3f); p.act != "nap" }, "nap off: no naps")
        assertTrue(sim(base.copy(hygiene = 1f)).let { (s, p) -> s.decayOf(p, Need.HYGIENE) } < s0.decayOf(p0, Need.HYGIENE), "hygiene")
        assertTrue(appeal(base.copy(roomPref = "整齊"), "tidy") > appeal(base, "tidy"), "roomPref")
        val (sa, pa) = sim(base.copy(oversleep = 1f), hour = 23.5); val (sb, pb) = sim(base, hour = 23.5)
        for ((s, p) in listOf(sa to pa, sb to pb)) { p.setNeed(Need.ENERGY, 10f); run(s, 40f) }
        assertTrue(pa.act == "sleep" && pb.act == "sleep" && pa.actEnd > pb.actEnd + 30, "oversleep: ${pa.act} ${pb.act} ${pa.actEnd - pb.actEnd}")
        assertTrue(sim(base.copy(skills = mapOf("料理" to 8))).let { (s, p) -> s.durationOf(p, Acts["cook"]!!) } < s0.durationOf(p0, Acts["cook"]!!), "skills")
        assertTrue(sim(base.copy(traits = listOf("急性子"))).let { (s, p) -> s.speedOf(p) } > s0.speedOf(p0), "a trait changes walking")
    }
    @Test fun youAndThem() {
        assertTrue(sim(base.copy(attitude = "陌生")).second.affinity < sim(base.copy(attitude = "黏人")).second.affinity, "attitude")
        val (s, p) = sim(base.copy(petSpot = "耳朵")); s.pet(p.id, 1.2f, "耳朵"); s.petEnd(p.id); assertTrue(p.moods.any { it.id == "spot" } && "耳朵" in p.found, "petSpot")
        val (s2, p2) = sim(base.copy(secret = "其實我怕黑")); p2.affinity = 90; run(s2, 0.5f); assertTrue(p2.secretTold && s2.life.log.any { it.text.contains("秘密") }, "secret")
        val (s3, p3) = sim(base.copy(birthday = "")); val today = s3.today()
        val (s4, p4) = sim(base.copy(birthday = today)); run(s3, 0.3f); run(s4, 0.3f)
        assertTrue(p4.moods.any { it.id == "birthday" } && p3.moods.none { it.id == "birthday" }, "birthday")
        val (s5, p5) = sim(base.copy(pronoun = "祂")); p5.affinity = 60; s5.pet(p5.id, 1f); s5.petEnd(p5.id); assertTrue(s5.life.log.any { it.text.contains("祂") }, "pronoun")
        assertTrue(!CharSpec(age = 15).adult && CharSpec(age = 30).adult, "age")
        assertEquals("新名字", sim(base.copy(name = "新名字")).second.name, "name")
    }
    @Test fun chattingFollowsRelationships() {
        val a = base.copy(name = "甲", traits = listOf("健談"), nickname = "小甲"); val b = base.copy(name = "乙", nickname = "阿乙", memories = listOf("一起看過流星"))
        fun chats(rels: List<Rel>): Int { val (s, _) = sim(a, 10.0, b, rels, "studio".let { "cottage" }); for (p in s.life.people) { p.setNeed(Need.SOCIAL, 10f); p.recent["outing"] = s.life.minute + 1440.0 }   /* stay home to chat */
            var n = 0; var t = 0f; while (t < 240f) { s.update(0.1f); t += 0.1f; if (s.events.any { it.kind == "say" && it.text.contains("阿乙") }) n++; s.events.clear() }; return n }
        val good = chats(listOf(Rel("a", "b", "知己", like = 90), Rel("b", "a", "知己", like = 90))); val bad = chats(listOf(Rel("a", "b", "前任", like = 5, conflict = 90)))
        assertTrue(good > 0, "close friends chat and use the nickname ($good)"); assertTrue(good >= bad, "good $good vs bad $bad")
        val (s, _) = sim(a, 10.0, b); assertTrue(s.setRel(Rel("a", "b", "戀人"))!!.contains("戀愛"), "romance is off by default")
        val (sk, _) = sim(a, 10.0, b.copy(age = 15)); sk.life.romance = true; assertTrue(sk.setRel(Rel("a", "b", "戀人"))!!.contains("未成年"), "never with minors")
    }
}
