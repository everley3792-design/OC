package app.ocshimeji.ui

import app.ocshimeji.render.jvm.Java2dGfx
import app.ocshimeji.render.jvm.JvmAssets
import app.ocshimeji.save.MemStorage
import app.ocshimeji.save.Presets
import app.ocshimeji.save.SaveSystem
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The screens driven exactly like a finger would (tap areas), plus screenshots compared with the approved ones in resources/golden. */
class UiTest {
    private val root = File(System.getProperty("oc.root") ?: "..")
    private val record = System.getProperty("oc.record") == "true"
    private val assets = JvmAssets(File(root, "art"))
    private var now = 1_700_042_400_000L   /* 10:00 UTC: daylight in the home */
    private var promptAnswer: String? = null
    private var saved: ByteArray? = null
    private val platform = object : Platform {
        override fun now() = now
        override fun realMinute() = now / 60000.0
        override fun prompt(title: String, initial: String, maxLength: Int, done: (String?) -> Unit) = done(promptAnswer)
        override fun pickImage(done: (PickedImage?, String?) -> Unit) = done(testPicture(), null)
        override fun saveFile(name: String, mime: String, data: ByteArray, done: (Boolean) -> Unit) { saved = data; done(true) }
        override fun openFile(mime: String, done: (ByteArray?) -> Unit) = done(saved)
    }
    /** an original test character: a round mint body with eyes on a transparent background */
    private fun testPicture(): PickedImage {
        val img = BufferedImage(220, 300, BufferedImage.TYPE_INT_ARGB); val g = img.createGraphics()
        g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON)
        g.color = java.awt.Color(0x8E, 0xD1, 0xB4); g.fillOval(20, 40, 180, 250); g.color = java.awt.Color(0x5B, 0x3A, 0x29); g.fillOval(70, 120, 18, 24); g.fillOval(132, 120, 18, 24)
        g.color = java.awt.Color(0xF6, 0xB2, 0xA8); g.fillOval(50, 160, 30, 16); g.fillOval(140, 160, 30, 16); g.dispose()
        val bos = java.io.ByteArrayOutputStream(); ImageIO.write(img, "png", bos); val bytes = bos.toByteArray()
        return PickedImage(bytes, "png", bytes, img.width, img.height, img.getRGB(0, 0, img.width, img.height, null, 0, img.width))
    }
    private fun app(dark: Boolean = false): UiApp {
        val a = UiApp(SaveSystem(MemStorage()) { now }, assets, platform); a.theme = if (dark) Theme.DARK else Theme.LIGHT
        a.insetTop = 24f; a.insetBottom = 16f; a.push(TitleScreen()); return a
    }
    /** run frames (dp 360×800) and return the last one as an image */
    private fun frames(a: UiApp, n: Int = 40, w: Int = 360, h: Int = 800, scale: Float = 1f): BufferedImage {
        var img: BufferedImage? = null
        repeat(n) { i -> val draw = { g: app.ocshimeji.render.Gfx -> a.frame(g, 1 / 30f) }; if (i == n - 1) img = Java2dGfx.render(w, h, scale, assets, draw) else Java2dGfx.render(8, 8, 1f, assets) { a.w; a.frame(FakeSize(it, w.toFloat(), h.toFloat()), 1 / 30f) } }
        return img!!
    }
    private fun shot(name: String, img: BufferedImage) {
        val out = File(root, "ui/build/shots/$name.png"); Java2dGfx.writePng(img, out)
        val golden = File(root, "ui/src/test/resources/golden/$name.png")
        if (record || !golden.exists()) { Java2dGfx.writePng(img, golden); return }
        val g = ImageIO.read(golden); assertEquals(g.width, img.width, "$name size"); assertEquals(g.height, img.height, "$name size")
        var diff = 0L; for (y in 0 until img.height step 2) for (x in 0 until img.width step 2) { val a = img.getRGB(x, y); val b = g.getRGB(x, y); for (s in intArrayOf(0, 8, 16, 24)) diff += kotlin.math.abs(((a ushr s) and 255) - ((b ushr s) and 255)) }
        val mean = diff.toDouble() / (img.width / 2 * (img.height / 2) * 4)
        assertTrue(mean < 2.0, "$name differs from the approved screenshot (mean channel difference $mean); see ui/build/shots/$name.png, re-record with -Precord=true if intended")
    }

    @Test fun titleEmptyLightAndDark() {
        val a = app(); val img = frames(a, scale = 2f); assertTrue(a.hasZone("new")); shot("title-empty-light", img)
        shot("title-empty-dark", frames(app(dark = true), scale = 2f))
    }
    @Test fun openingFlowFromNamesToMoveInDay() {
        val a = app(); frames(a, 5)
        assertTrue(a.tapZone("new")); frames(a, 15); val o = a.screen as OpeningScreen
        promptAnswer = "雲朵鎮"; assertTrue(a.tapZone("name:town")); assertEquals("雲朵鎮", o.town)
        shot("opening-names", frames(a, 20, scale = 2f))
        assertTrue(a.tapZone("next")); frames(a, 15); assertEquals(1, o.step)
        assertTrue(a.tapZone("house:studio")); frames(a, 15); shot("opening-house", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("house:cottage")); assertTrue(a.tapZone("next")); frames(a, 15); assertEquals(2, o.step)
        assertFalse(a.hasZone("next"), "nobody chosen yet: the reason is shown instead of the button")
        assertTrue(a.tapZone("pick:${Presets.CINNAMON.id}")); frames(a, 2)
        assertTrue(a.tapZone("import")); frames(a, 15); assertTrue(a.overlay is ImportSheet)
        promptAnswer = "小麥"; assertTrue(a.tapZone("imp:name")); assertTrue(a.tapZone("imp:left"))
        shot("import-sheet", frames(a, 10, scale = 2f))
        assertTrue(a.tapZone("imp:ok")); frames(a, 3); assertNull(a.overlay); assertEquals(2, o.chosen.size)
        val mai = a.saves.library().chars.first { it.name == "小麥" }; assertEquals(-1, mai.facing); assertTrue(mai.image.startsWith("lib:"))
        assertTrue(a.tapZone("pick:${Presets.CINNAMON.id}")); assertTrue(a.tapZone("pick:${Presets.CINNAMON.id}"))   /* off and on again */
        shot("opening-people", frames(a, 10, scale = 2f))
        assertTrue(a.tapZone("next")); frames(a, 15); assertEquals(3, o.step); assertNull(o.problem(), "rooms are given automatically")
        assertTrue(a.tapZone("room:${mai.id}:bedB")); frames(a, 15); shot("opening-rooms", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("next")); frames(a, 5)
        val ws = a.screen as WorldScreen; val life = ws.sim.life
        assertEquals("cottage", life.houseId); assertEquals("雲朵鎮", life.townName); assertTrue(life.arriving)
        assertEquals(setOf("bedA", "bedB"), life.people.map { it.room }.toSet())
        frames(a, 90); shot("world-movein", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("back")); frames(a, 2); assertTrue(a.screen is TitleScreen)
        assertEquals("我們的家", a.saves.slots().single().name)
    }
    private fun world(a: UiApp, libIds: List<String> = listOf(Presets.CINNAMON.id)): WorldScreen {
        val house = app.ocshimeji.sim.house.Houses.STUDIO
        val m = a.saves.createWorld("小窩", "楓糖鎮", "小窩", house, libIds, libIds.associateWith { "main" }, platform.realMinute())
        a.saves.setFlag("tip:touch"); (a.screen as TitleScreen).open(m.id); frames(a, 3); return a.screen as WorldScreen
    }
    @Test fun touchingACharacterTapRubLiftThrow() {
        val a = app(); val ws = world(a); val p = ws.sim.life.people[0]
        frames(a, 200)   /* moved in */
        assertFalse(ws.sim.life.arriving)
        // tap = the card
        var (x, y) = ws.screenOf(p.id)!!; a.down(x, y); frames(a, 2); a.up(x, y); frames(a, 15)
        assertTrue(a.overlay is PersonCard); shot("person-card", frames(a, 1, scale = 2f))
        assertTrue(a.back()); assertNull(a.overlay)
        // rub back and forth = petting; the data changes once when the stroke ends
        ws.sim.body(p.id).micro = null
        val before = p.need(app.ocshimeji.sim.life.Need.ATTENTION)
        ws.screenOf(p.id)!!.let { x = it.first; y = it.second }
        a.down(x, y); for (i in 0 until 40) { a.move(x + if (i % 2 == 0) 14f else -14f, y); frames(a, 1) }; a.up(x, y); frames(a, 2)
        assertTrue(p.moods.any { it.id == "petted" || it.id == "pettedsleep" }, "petted"); assertTrue(p.need(app.ocshimeji.sim.life.Need.ATTENTION) > before)
        // hold still = lifted; flick = thrown
        frames(a, 40); ws.screenOf(p.id)!!.let { x = it.first; y = it.second }
        a.down(x, y); frames(a, 20); assertEquals(p.id, ws.holding, "held after a long press")
        for (i in 1..6) { a.move(x + i * 22f, y - i * 4f); frames(a, 1) }
        shot("world-held", frames(a, 1, scale = 2f))
        a.up(x + 140f, y - 26f); frames(a, 1); assertTrue(ws.sim.body(p.id).flying, "thrown")
        frames(a, 60); assertFalse(ws.sim.body(p.id).flying, "landed"); assertTrue(ws.sim.grid.walkable(p.x.toInt(), p.y.toInt()), "landed on the floor")
        // two fingers zoom
        val z0 = ws.zoom; a.down(100f, 300f); a.second(0, 200f, 300f); a.move(60f, 300f); a.second(1, 260f, 300f); a.second(2, 260f, 300f); a.up(60f, 300f)
        assertTrue(ws.zoom > z0 * 1.4f, "pinch zoom ${ws.zoom} vs $z0")
    }
    @Test fun whileYouWereAwayAndTheDarkHome() {
        val a = app(dark = true); val ws = world(a); frames(a, 60); assertTrue(a.tapZone("back")); frames(a, 2)
        val m0 = ws.sim.life.minute
        now += 3 * 3600_000L; (a.screen as TitleScreen).open(a.saves.slots().single().id); frames(a, 15)
        val ws2 = a.screen as WorldScreen; assertTrue(a.overlay is AwaySheet, "a summary after 3 hours")
        assertTrue(ws2.sim.life.minute >= m0 + 179, "time caught up")
        shot("away-dark", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("away:ok")); frames(a, 40); shot("world-dark", frames(a, 1, scale = 2f))
        now += 20 * 60_000L; a.wake(); assertNull(a.overlay, "a short absence is caught up quietly")
    }
    @Test fun exportAndImportASave() {
        val a = app(); val ws = world(a); frames(a, 30); assertTrue(a.tapZone("back")); frames(a, 5); val id = ws.slotId
        assertTrue(a.tapZone("more:$id")); frames(a, 12); assertTrue(a.tapZone("row:export")); frames(a, 2)
        assertNotNull(saved); assertTrue(a.toastText!!.startsWith("匯出了"))
        assertTrue(a.tapZone("importSave")); frames(a, 2); assertEquals(2, a.saves.slots().size)
        val other = a.saves.slots().first { it.id != id }; assertTrue(other.name.endsWith("（匯入）"))
        assertNotNull(a.saves.loadWorld(other.id)!!.life)
    }
    @Test fun anM0WorldGetsAHouseWhenOpened() {
        val a = app(); val m = a.saves.create("舊世界", listOf(Presets.CINNAMON.id)); (a.screen as TitleScreen).reload(); frames(a, 2)
        (a.screen as TitleScreen).open(m.id); frames(a, 5); val ws = a.screen as WorldScreen
        assertEquals("studio", ws.sim.life.houseId); assertNotNull(a.saves.loadWorld(m.id)!!.life)
    }
    @Test fun saveActionsCopyBranchRenameDelete() {
        val a = app(); val m = a.saves.create("測試小鎮", listOf(Presets.CINNAMON.id)); (a.screen as TitleScreen).reload(); frames(a, 5)
        fun act(row: String) { assertTrue(a.tapZone("more:${m.id}")); frames(a, 12); assertTrue(a.tapZone("row:$row"), "row $row"); frames(a, 3) }
        act("copy"); assertEquals(2, a.saves.slots().size); assertEquals("複製了一份", a.toastText)
        act("branch"); assertEquals(3, a.saves.slots().size)
        promptAnswer = "改過的名字"; act("rename"); assertEquals("改過的名字", a.saves.slot(m.id)!!.name)
        act("delete"); assertTrue(a.overlay is Confirm); assertEquals(3, a.saves.slots().size)   /* not yet */
        frames(a, 12); shot("confirm-delete", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("confirm:ok")); assertNull(a.saves.slot(m.id)); assertEquals(2, a.saves.slots().size)
    }
    @Test fun aMenuThatJustAppearedIgnoresTapsAndOutsideCloses() {
        val a = app(); val m = a.saves.create("A", listOf(Presets.CINNAMON.id)); (a.screen as TitleScreen).reload(); frames(a, 3)
        assertTrue(a.tapZone("more:${m.id}")); frames(a, 1)
        assertTrue(a.tapZone("row:delete")); assertTrue(a.overlay is ListSheet, "the first 0.3 s ignore presses")
        frames(a, 12); a.down(10f, 10f); a.up(10f, 10f); assertNull(a.overlay, "a tap outside closes the sheet")
        assertTrue(a.tapZone("more:${m.id}")); frames(a, 12); assertTrue(a.back()); assertNull(a.overlay, "back closes the sheet first")
        assertFalse(a.back(), "back on the first screen = leave the app")
    }
    @Test fun scrollingAManySavesList() {
        val a = app(); repeat(8) { i -> now += 1000; a.saves.create("小鎮 $i", listOf(Presets.CINNAMON.id)) }; (a.screen as TitleScreen).reload(); frames(a, 5)
        val before = a.zoneIds.size; a.down(180f, 700f); for (i in 1..20) { a.move(180f, 700f - i * 25); frames(a, 1) }; a.up(180f, 200f); frames(a, 30)
        assertTrue(a.hasZone("slot:" + a.saves.slots().last().id)); assertTrue(before > 0)
        shot("title-many-scrolled", frames(a, 1, scale = 2f))
    }
}

/** a Gfx that reports a phone-sized canvas but draws into a tiny one (fast frames between screenshots) */
private class FakeSize(val g: app.ocshimeji.render.Gfx, override val width: Float, override val height: Float) : app.ocshimeji.render.Gfx by g
