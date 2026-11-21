package app.ocshimeji.save

import app.ocshimeji.save.media.Codec
import app.ocshimeji.save.media.Importer
import app.ocshimeji.save.media.Png
import app.ocshimeji.save.media.Raster
import app.ocshimeji.save.paint.PaintDoc
import app.ocshimeji.save.paint.Template
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.CustomTag
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.script.Scripts
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class StudioTest {
    private var t = 1_700_000_000_000L
    private fun sys() = SaveSystem(MemStorage()) { t++ }
    /** a test decoder that understands our own PNGs: they are only ever produced by Png.encode here, so we keep a side table */
    private val made = HashMap<String, Raster>()
    private val codec = Codec { b -> made[b.contentHashCode().toString()] }
    private fun png(r: Raster): ByteArray = Png.encode(r).also { made[it.contentHashCode().toString()] = r }
    private fun blob(w: Int, h: Int, c: Int = 0xFF884422.toInt()) = Raster(w, h, IntArray(w * h) { i -> val x = i % w; val y = i / w; if (x in w / 4 until w * 3 / 4 && y in h / 8 until h) c else 0 })

    @Test fun drawingsBecomeDraftsCharactersAndAnimations() {
        val s = sys(); val st = Studio(s)
        val doc = PaintDoc.of(Template.CHARACTER); doc.brush.size = 80f; doc.brush.stabilize = 0f; doc.down(500f, 300f); for (y in 300..900 step 20) doc.move(500f, y.toFloat()); doc.up(500f, 900f)
        val id = st.saveDraft(null, doc, "小草稿"); assertEquals(listOf("小草稿"), st.drafts().map { it.second.name })
        val (back, _) = st.loadDraft(id); assertTrue(back.layers[0].r.px.contentEquals(doc.layers[0].r.px))
        doc.addLayer(); st.saveDraft(id, doc, "小草稿"); assertEquals(2, st.loadDraft(id).first.layers.size); st.deleteDraft(id); assertTrue(st.drafts().isEmpty())
        val c = st.charFromDrawing(doc, CharSpec(name = "手繪君")); assertEquals("drawn", c.source); assertTrue(c.footY > 0.9f)
        assertFailsWith<IllegalArgumentException> { st.charFromDrawing(PaintDoc(16, 16), CharSpec()) }
        // animations: frames, timing, play mode, feet, events; copy, mirror, delete; the fallback chain
        val frames = (0 until 4).map { i -> blob(40, 60).also { it.px[i] = -1 } }
        val c2 = st.saveAnim(c.id, "walk", frames, listOf(100, 200), "pingpong", Studio.autoAnchors(frames), mapOf("1" to "step", "9" to "fx:heart"))
        val w = c2.anims["walk"]!!; assertEquals(4, w.frames.size); assertEquals(listOf(100, 200, 200, 200), w.ms); assertEquals("pingpong", w.playMode); assertEquals(mapOf("1" to "step"), w.events, "events outside the frames are dropped")
        assertEquals(0.5f, w.anchors[0][0], 0.05f)
        val decode = { p: String -> s.readFile(p.removePrefix("lib:"))?.let { Raster(40, 60) } }
        val c3 = st.copyAnim(c.id, "walk", "run", decode); assertEquals(4, c3.anims["run"]!!.frames.size)
        assertEquals(1, Studio.mirror(listOf(Raster(2, 1, intArrayOf(1, 2))))[0].px[0] - 1)
        val chain = Studio.chain(c3).toMap(); assertEquals("run", chain["run"]); assertEquals("walk", chain["walk"]); assertEquals("idle", chain["sit"])
        st.deleteAnim(c.id, "run"); assertNull(s.libChar(c.id)!!.anims["run"])
        assertFailsWith<IllegalArgumentException> { st.saveAnim(Presets.CINNAMON.id, "walk", frames, listOf(100)) }.message!!.contains("內建")
        assertFailsWith<IllegalArgumentException> { st.saveAnim(c.id, "walk", frames, listOf(100), "bounce") }
        // batch import by file names
        val got = st.batchImport(c.id, (0 until 3).map { Importer.Source("sleep_$it.png", png(blob(40, 60))) } + Importer.Source("happy_0.png", png(blob(40, 60))), codec)
        assertTrue("sleep" in got && "happy" in got); assertEquals(3, s.libChar(c.id)!!.anims["sleep"]!!.frames.size); assertNotNull(s.libChar(c.id)!!.anims["walk"], "other actions stay")
        st.setProcedural(c.id, listOf("breath", "wiggle")); assertEquals(listOf("breath"), s.libChar(c.id)!!.procedural)
    }
    @Test fun itemsAreCheckedSharedAndReachAWorld() {
        val s = sys(); val st = Studio(s)
        assertTrue(Items.check(LibItem("", "", "furniture")).first.size >= 2)
        val bed = LibItem("", "雲朵床", "furniture", w = 2, h = 2, offers = listOf("sleep"), slots = listOf(ItemSlot(0.5f, 1f, "sit")))
        assertTrue(Items.check(bed.copy(image = "x")).second.any { it.contains("躺") }, "a bed without a place to lie is pointed out")
        assertFailsWith<IllegalArgumentException> { st.saveItem(LibItem("", "布丁", "food", taste = "鹹鹹"), blob(32, 32)) }.message!!.contains("口味")
        val pudding = st.saveItem(LibItem("", "手作布丁", "food", taste = "甜", full = 30f), blob(32, 32))
        val gift = st.saveItem(LibItem("", "星星吊飾", "gift", likedBy = listOf("星星", "可愛")), blob(32, 32))
        val wall = st.saveItem(LibItem("", "格子壁紙", "wallpaper"), blob(16, 16))
        assertEquals(3, st.items().size)
        // .ocitem round trip, broken files refused with a reason
        val file = st.exportItem(pudding.id); made[Png.encode(blob(32, 32)).contentHashCode().toString()] = blob(32, 32)
        val again = st.importItem(file, codec); assertEquals("手作布丁", again.name); assertTrue(again.id != pudding.id)
        assertTrue(assertFailsWith<IllegalArgumentException> { st.importItem(byteArrayOf(1, 2, 3), codec) }.message!!.contains("不是"))
        // into a world: food and gifts are copied, a wallpaper in use cannot be deleted
        st.saveTag(CustomTag("烘焙魂", act = mapOf("cook" to 2f), concepts = listOf("麵團")))
        val m = s.createWorld("A", "", "", Houses.COTTAGE, listOf(Presets.CINNAMON.id), mapOf(Presets.CINNAMON.id to "bedA"), 0.0)
        val w = s.loadWorld(m.id)!!; st.syncWorld(w.life!!)
        assertEquals(setOf("手作布丁", "星星吊飾"), w.life!!.items.filter { it.name != "手作布丁" || it.id == pudding.id }.map { it.name }.toSet()); assertEquals(1, w.life!!.tags.size)
        w.life!!.decor["living"] = app.ocshimeji.sim.life.Decor(wall = wall.image.removePrefix("lib:")); s.saveWorld(m.id, w)
        assertNotNull(st.deleteItem(wall.id), "still on a wall"); assertNull(st.deleteItem(gift.id))
    }
    @Test fun soundsTagsScriptsPacksAndSpace() {
        val s = sys(); val st = Studio(s)
        fun wav(ms: Int): ByteArray { val rate = 8000; val n = rate * ms / 1000; val b = java.nio.ByteBuffer.allocate(44 + n).order(java.nio.ByteOrder.LITTLE_ENDIAN)
            b.put("RIFF".toByteArray()).putInt(36 + n).put("WAVE".toByteArray()).put("fmt ".toByteArray()).putInt(16).putShort(1).putShort(1).putInt(rate).putInt(rate).putShort(1).putShort(8).put("data".toByteArray()).putInt(n); return b.array() }
        val v = st.importSound("喵.wav", wav(800), "voice"); assertEquals(800, v.ms); assertEquals("wav", v.format)
        assertTrue(assertFailsWith<IllegalArgumentException> { st.importSound("long.wav", wav(6000), "voice") }.message!!.contains("最多 4 秒"))
        assertTrue(assertFailsWith<IllegalArgumentException> { st.importSound("x.txt", ByteArray(200) { 65 }, "sfx") }.message!!.contains("看不懂"))
        assertEquals("mp3", Sounds.check(byteArrayOf(73, 68, 51) + ByteArray(100), "music").first)
        val c = s.saveCharacter(Importer.prepare(app.ocshimeji.save.media.Imported("x", linkedMapOf("idle" to app.ocshimeji.save.media.Clip(mutableListOf(blob(20, 30)), mutableListOf(100))))), CharSpec(name = "會叫"), 1, true, emptyMap(), emptyList())
        st.setVoices(c.id, listOf(v.id, "nope")); assertEquals(listOf(v.id), s.libChar(c.id)!!.voices); assertNotNull(st.deleteSound(v.id), "in use")
        // tags
        assertNotNull(st.saveTag(CustomTag("劍修", lines = listOf("x"))), "a built-in name"); assertNotNull(st.saveTag(CustomTag("空的")))
        assertNull(st.saveTag(CustomTag("貓舌頭", act = mapOf("food" to 0.5f), lines = listOf("好燙！"), concepts = listOf("吹涼"))))
        // scripts and a pack
        val sc = Scripts.parse("# 標題：分甜點\n# 角色：A=任何人 B=名字:小雨\n[A] 這個給你。\n= 好感 B→A +3\n", "", "我")
        assertNull(st.saveScript(sc)); assertNotNull(st.saveScript(sc.copy(name = "")))
        val pack = st.exportMod("小包", "我", st.scripts().map { it.id }, listOf("貓舌頭"))
        val other = Studio(sys()); val p = other.readMod(pack)
        assertEquals(1, p.scripts.size); assertEquals(listOf("name:小雨"), p.needs); assertTrue(!other.has("name:小雨"))
        assertEquals(1, other.importMod(p, mapOf("name:小雨" to "any"))); assertEquals("any", other.scripts().single().roles[1].match); assertEquals(1, other.tags().size)
        assertTrue(assertFailsWith<IllegalArgumentException> { other.readMod("PK".toByteArray() + ByteArray(10)) }.message!!.isNotBlank())
        // space usage and cleanup
        s.storage.write("library/chars/ghost/idle.png", ByteArray(500)); s.storage.write("library/items/gone/front.png", ByteArray(300))
        val u = st.usage(); assertTrue(u.unused.containsAll(listOf("library/chars/ghost/idle.png", "library/items/gone/front.png"))); assertTrue(u.total > 0)
        assertTrue(st.cleanup(false) >= 800); assertTrue(st.usage().unused.isEmpty()); assertNotNull(s.libChar(c.id)); assertNotNull(s.readFile(s.libChar(c.id)!!.image.removePrefix("lib:")))
    }
}
