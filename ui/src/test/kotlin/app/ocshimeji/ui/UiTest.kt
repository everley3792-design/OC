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
    private var now = 1_700_000_000_000L
    private var promptAnswer: String? = null
    private val platform = object : Platform {
        override fun now() = now
        override fun prompt(title: String, initial: String, maxLength: Int, done: (String?) -> Unit) = done(promptAnswer)
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
    @Test fun startANewObservationWithTheCinnamonRoll() {
        val a = app(); frames(a, 5)
        assertTrue(a.tapZone("new")); frames(a, 15)
        assertTrue(a.overlay is NewObservationSheet); assertFalse(a.hasZone("start"))   /* nobody chosen: no start button */
        assertTrue(a.tapZone("pick:${Presets.CINNAMON.id}")); frames(a, 2); assertTrue(a.hasZone("start"))
        shot("new-observation", frames(a, 10, scale = 2f))
        assertTrue(a.tapZone("start")); frames(a, 5)
        val ws = a.screen as WorldScreen; val world = a.saves.loadWorld(ws.slotId)!!
        assertEquals(listOf("肉桂捲"), world.residents.map { it.name })
        assertTrue(a.tapZone("char:${world.residents[0].id}")); shot("world-m0", frames(a, 6, scale = 2f))
        now += 5000; frames(a, 60); assertTrue(a.tapZone("back")); frames(a, 2)
        assertTrue(a.screen is TitleScreen); val s = a.saves.slots().single(); assertEquals("第 1 個小鎮", s.name); assertTrue(s.playSeconds >= 1, "play time is kept")
        shot("title-one-save", frames(a, 20, scale = 2f))
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
