package app.ocshimeji.save

import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.chars.Rel
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class WorldTest {
    private var t = 1_700_000_000_000L
    private fun sys() = SaveSystem(MemStorage()) { t }
    private fun pic(w: Int, h: Int, f: (Int, Int) -> Int) = IntArray(w * h) { f(it % w, it / w) }
    private fun importOne(s: SaveSystem, name: String, adult: Boolean = true): LibChar {
        val px = pic(40, 60) { x, y -> if (x in 10..29 && y in 5..54) 0xFF884422.toInt() else 0 }
        return s.importChar(name, adult, 1, ImageCheck.analyze(40, 60, px), byteArrayOf(1, 2, 3), byteArrayOf(9, 9), "png")
    }

    @Test fun imageCheckFindsTheFeetAndTransparency() {
        val i = ImageCheck.analyze(40, 60, pic(40, 60) { x, y -> if (x in 10..29 && y in 5..54) 0xFF000000.toInt() else 0 })
        assertTrue(i.transparent); assertEquals(10, i.left); assertEquals(54, i.bottom); assertEquals(0.5f, i.footX, 0.05f)
        assertTrue(!ImageCheck.analyze(10, 10, IntArray(100) { 0xFFFFFFFF.toInt() }).transparent, "a photo with a background")
        assertFailsWith<IllegalArgumentException> { ImageCheck.analyze(10, 10, IntArray(100)) }
    }
    @Test fun createAWorldWithHouseRules() {
        val s = sys(); val a = importOne(s, "小空"); val kid = importOne(s, "小葉", adult = false)
        assertTrue(assertFailsWith<IllegalArgumentException> { s.createWorld("A", "", "", Houses.STUDIO, listOf(Presets.CINNAMON.id, a.id), mapOf(), 0.0) }.message!!.contains("最多住 1 位"))
        assertTrue(assertFailsWith<IllegalArgumentException> { s.createWorld("A", "", "", Houses.COTTAGE, listOf(kid.id), mapOf(kid.id to "bedB"), 0.0) }.message!!.contains("成年"))
        val m = s.createWorld("我的小鎮", "晴光鎮", "肉桂捲之家", Houses.COTTAGE, listOf(Presets.CINNAMON.id, a.id), mapOf(Presets.CINNAMON.id to "bedA", a.id to "bedB"), 1000.0)
        val w = s.loadWorld(m.id)!!; val life = assertNotNull(w.life)
        assertEquals("cottage", life.houseId); assertEquals(listOf("bedA", "bedB"), life.people.map { it.room }); assertTrue(life.arriving)
        assertEquals(listOf("肉桂捲", "小空"), life.people.map { it.name })
    }
    @Test fun exportImportRoundTripBringsTheCharacters() {
        val s = sys(); val a = importOne(s, "小空")
        val m = s.createWorld("A", "", "", Houses.COTTAGE, listOf(a.id), mapOf(a.id to "bedA"), 0.0)
        val file = s.exportSave(m.id)
        val other = sys(); val m2 = other.importSave(file)
        assertTrue(m2.name.endsWith("（匯入）")); assertEquals(1, other.loadWorld(m2.id)!!.life!!.people.size)
        val js = kotlinx.serialization.json.Json { encodeDefaults = true }
        assertEquals(js.encodeToString(World.serializer(), s.loadWorld(m.id)!!), js.encodeToString(World.serializer(), other.loadWorld(m2.id)!!), "the imported world is exactly the exported one")
        assertNotNull(other.libChar(a.id)); assertTrue(other.readFile(a.image.removePrefix("lib:"))!!.contentEquals(byteArrayOf(1, 2, 3)))
        assertTrue(assertFailsWith<IllegalArgumentException> { other.importSave(byteArrayOf(1, 2, 3, 4)) }.message!!.contains("不是"))
    }
    @Test fun anM1WorldFileIsUpgraded() {   /* format 1 → 2: the old fields become the resident's CharSpec */
        val raw = javaClass.getResourceAsStream("/world-v1.json")!!.readBytes()
        val w = sys().parseWorld(raw); val p = w.life!!.people.single()
        assertEquals(WORLD_VERSION, w.v); assertEquals("肉桂捲", p.name); assertEquals(6, p.spec.wake); assertEquals(22, p.spec.sleep)
        assertEquals(listOf("甜點", "曬太陽"), p.spec.likes); assertEquals(0.4f, p.spec.axes[0]); assertTrue(p.adult)
        val tooNew = raw.decodeToString().replaceFirst("\"v\":1", "\"v\":99").encodeToByteArray()
        assertTrue(assertFailsWith<IllegalArgumentException> { sys().parseWorld(tooNew) }.message!!.contains("更新"))
    }
    @Test fun anM2WorldFileIsUpgraded() {   /* format 2 → 3: everyone is at home (nobody on the desktop) */
        val raw = javaClass.getResourceAsStream("/world-v2.json")!!.readBytes()
        val w = sys().parseWorld(raw); val p = w.life!!.people.single()
        assertEquals(WORLD_VERSION, w.v); assertEquals("可可", p.name); assertEquals(false, p.desk); assertEquals(listOf("書蟲"), p.spec.traits); assertEquals(1, w.life!!.rels.size)
    }
    @Test fun anM3WorldFileIsUpgraded() {   /* format 3 → 4: the social life starts today; nothing else changes */
        val raw = javaClass.getResourceAsStream("/world-v3.json")!!.readBytes()
        val w = sys().parseWorld(raw); val life = w.life!!
        assertEquals(WORLD_VERSION, w.v); assertEquals(3L, life.day); assertEquals(3L, life.soc.settledDay)
        assertTrue(life.rels.all { it.seenDay == 3L }); assertEquals("朋友", life.rels[0].kind); assertEquals(55, life.rels[0].like)
        assertEquals(true, life.people[1].desk); assertEquals("observe", life.people[0].control); assertEquals("life", life.log[0].kind)
        assertTrue(life.soc.memories.isEmpty() && life.soc.feuds.isEmpty())
    }
    @Test fun anM4WorldFileIsUpgraded() {   /* format 4 → 5: nothing the player made is in an old world yet */
        val w = sys().parseWorld(javaClass.getResourceAsStream("/world-v4.json")!!.readBytes()); val life = w.life!!
        assertEquals(WORLD_VERSION, w.v); assertTrue(life.items.isEmpty() && life.decor.isEmpty() && life.tags.isEmpty() && life.scripts.isEmpty()); assertEquals("", life.music); assertEquals(3L, life.soc.settledDay)
    }
    @Test fun anM5WorldFileIsUpgraded() {   /* format 5 → 6: 300 starting coins as one ledger line, an empty bag, the house as built */
        val w = sys().parseWorld(javaClass.getResourceAsStream("/world-v5.json")!!.readBytes()); val life = w.life!!
        assertEquals(WORLD_VERSION, w.v); assertEquals(300, life.wallet); assertEquals(1, life.ledger.size); assertTrue(life.bag.isEmpty() && life.layout.isEmpty() && life.goals.isEmpty())
        assertTrue(app.ocshimeji.sim.life.Economy(life).consistent()); assertTrue(life.people.all { it.out == null })
    }
    @Test fun relationshipsAndFamilyRoomsWhenCreating() {
        val s = sys(); val a = importOne(s, "大人"); val k = s.importChar("小孩", false, 1, ImageCheck.analyze(2, 2, IntArray(4) { -1 }), byteArrayOf(1), byteArrayOf(1), "png")
        assertTrue(assertFailsWith<IllegalArgumentException> { s.createWorld("A", "", "", Houses.COTTAGE, listOf(a.id, k.id), mapOf(a.id to "bedA", k.id to "bedA"), 0.0) }.message!!.contains("家人"))
        val fam = listOf(Rel(a.id, k.id, "家人"), Rel(k.id, a.id, "家人"))
        val m = s.createWorld("A", "", "", Houses.COTTAGE, listOf(a.id, k.id), mapOf(a.id to "bedA", k.id to "bedA"), 0.0, fam)
        assertEquals(2, s.loadWorld(m.id)!!.life!!.rels.size)
        assertTrue(assertFailsWith<IllegalArgumentException> { s.createWorld("B", "", "", Houses.COTTAGE, listOf(a.id, k.id), mapOf(a.id to "bedA", k.id to "bedB"), 0.0, listOf(Rel(a.id, k.id, "戀人")), romance = true) }.message!!.contains("未成年"))
    }
    @Test fun anM0WorldGetsAHouse() {
        val s = sys(); val m = s.create("舊的", listOf(Presets.CINNAMON.id)); val w = s.loadWorld(m.id)!!
        val up = s.upgradeM0(m.id, w, 500.0); assertEquals("studio", up.life!!.houseId); assertNotNull(s.loadWorld(m.id)!!.life)
    }
}
