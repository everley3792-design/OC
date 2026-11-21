package app.ocshimeji.save

import app.ocshimeji.save.media.Raster
import app.ocshimeji.save.paint.Draft
import app.ocshimeji.save.paint.PaintDoc
import app.ocshimeji.save.paint.Template
import app.ocshimeji.save.paint.Tool
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PaintTest {
    private fun a(c: Int) = (c ushr 24) and 255
    private fun line(d: PaintDoc, x0: Float, y0: Float, x1: Float, y1: Float, p: Float = 1f) { d.down(x0, y0, p); for (i in 1..20) d.move(x0 + (x1 - x0) * i / 20, y0 + (y1 - y0) * i / 20, p); d.up(x1, y1) }

    @Test fun everyBrushPaintsAndEachStrokeIsOneUndoStep() {
        for (t in listOf(Tool.PENCIL, Tool.PEN, Tool.MARKER, Tool.AIRBRUSH, Tool.WATERCOLOR)) {
            val d = PaintDoc(64, 64); d.brush.tool = t; d.brush.size = 8f; d.brush.stabilize = 0f; d.brush.color = 0xFFE04040.toInt()
            line(d, 10f, 32f, 54f, 32f)
            assertTrue(a(d.layer.r[32, 32]) > 0, "$t paints"); assertEquals(0, a(d.layer.r[32, 5]), "$t stays on the line"); assertEquals(1, d.undoCount, "$t one step")
            assertTrue(d.undo()); assertEquals(0, a(d.layer.r[32, 32]), "$t undone"); assertTrue(d.redo()); assertTrue(a(d.layer.r[32, 32]) > 0)
        }
        /* a marker does not pile up on itself inside one stroke; the airbrush does */
        val m = PaintDoc(64, 64); m.brush.tool = Tool.MARKER; m.brush.stabilize = 0f; m.brush.opacity = 0.5f
        m.down(20f, 20f); for (i in 0 until 10) { m.move(40f, 20f); m.move(20f, 20f) }; m.up(20f, 20f)
        assertTrue(a(m.layer.r[30, 20]) in 80..110, "marker stays even: ${a(m.layer.r[30, 20])}")
        val e = PaintDoc(64, 64); e.brush.tool = Tool.PEN; line(e, 10f, 10f, 50f, 10f); e.brush.tool = Tool.ERASER; e.brush.size = 20f; line(e, 10f, 10f, 50f, 10f)
        assertEquals(0, a(e.layer.r[30, 10]), "eraser")
    }
    @Test fun penPressureStabiliserSymmetryAndSeamlessWrap() {
        val thin = PaintDoc(64, 64).apply { brush.tool = Tool.PEN; brush.size = 20f; brush.stabilize = 0f }; line(thin, 10f, 32f, 54f, 32f, 0.1f)
        val thick = PaintDoc(64, 64).apply { brush.tool = Tool.PEN; brush.size = 20f; brush.stabilize = 0f }; line(thick, 10f, 32f, 54f, 32f, 1f)
        fun width(d: PaintDoc) = (0 until 64).count { a(d.layer.r[32, it]) > 128 }
        assertTrue(width(thick) > width(thin) * 2, "pressure: ${width(thin)} vs ${width(thick)}")
        val sym = PaintDoc(64, 64).apply { brush.symmetry = "mirror"; brush.stabilize = 0f }; sym.down(10f, 10f); sym.up(10f, 10f)
        assertTrue(a(sym.layer.r[10, 10]) > 0 && a(sym.layer.r[53, 10]) > 0, "mirror")
        val rad = PaintDoc(64, 64).apply { brush.symmetry = "radial"; brush.radial = 4; brush.stabilize = 0f }; rad.down(32f, 10f); rad.up(32f, 10f)
        assertTrue(a(rad.layer.r[32, 10]) > 0 && a(rad.layer.r[53, 32]) > 0 && a(rad.layer.r[32, 53]) > 0 && a(rad.layer.r[10, 32]) > 0, "radial 4")
        /* the stabiliser smooths a zig-zag */
        val shaky = PaintDoc(64, 64).apply { brush.stabilize = 0.9f; brush.size = 2f }; shaky.down(5f, 32f); for (i in 1..50) shaky.move(5f + i, if (i % 2 == 0) 22f else 42f); shaky.up(55f, 32f)
        assertEquals(0, a(shaky.layer.r[30, 23]), "smoothed: no spike at the edge")
        val tile = PaintDoc.of(Template.WALLPAPER); tile.brush.size = 10f; tile.down(2f, 2f); tile.up(2f, 2f)
        assertTrue(a(tile.layer.r[tile.w - 1, tile.h - 1]) > 0, "a stamp at the corner wraps to the other corners")
    }
    @Test fun fillGradientPickSelectionTransformAndFlip() {
        val d = PaintDoc(40, 40); d.brush.stabilize = 0f; d.brush.tool = Tool.PENCIL; d.brush.size = 2f
        for ((x0, y0, x1, y1) in listOf(listOf(5f, 5f, 35f, 5f), listOf(35f, 5f, 35f, 35f), listOf(35f, 35f, 5f, 35f), listOf(5f, 35f, 5f, 5f))) line(d, x0, y0, x1, y1)
        d.brush.tool = Tool.FILL; d.brush.color = 0xFF3080E0.toInt(); d.down(20f, 20f)
        assertEquals(0xFF3080E0.toInt(), d.layer.r[20, 20]); assertEquals(0, a(d.layer.r[1, 1]), "fill stops at the outline")
        d.brush.tool = Tool.PICK; d.down(20f, 20f); assertEquals(0xFF3080E0.toInt(), d.brush.color)
        val g = PaintDoc(40, 10); g.brush.tool = Tool.GRADIENT; g.brush.color = 0xFF000000.toInt(); g.brush.color2 = 0xFFFFFFFF.toInt(); g.down(0f, 5f); g.up(39f, 5f)
        assertTrue((g.layer.r[2, 5] and 255) < (g.layer.r[37, 5] and 255), "dark to light")
        val s = PaintDoc(40, 40); s.brush.tool = Tool.PENCIL; s.brush.size = 4f; s.brush.stabilize = 0f; s.down(10f, 10f); s.up(10f, 10f)
        s.brush.tool = Tool.SELECT; s.down(5f, 5f); s.up(15f, 15f); assertNotNull(s.selection)
        s.transform(dx = 20f); assertEquals(0, a(s.layer.r[10, 10]), "moved away"); assertTrue(a(s.layer.r[30, 10]) > 0, "moved here")
        assertTrue(s.undo()); assertTrue(a(s.layer.r[10, 10]) > 0, "one undo step brings it back")
        s.transform(scaleX = 2f, scaleY = 2f); assertTrue(a(s.layer.r[13, 10]) > 0, "scaled up")
        val f = PaintDoc(10, 10); f.layer.r.px[0] = -1; f.flipLayer(true); assertEquals(-1, f.layer.r.px[9])
    }
    @Test fun layersUndoLimitFlattenTrimAndDrafts() {
        val d = PaintDoc(32, 32); d.brush.stabilize = 0f
        d.down(8f, 8f); d.up(8f, 8f)
        d.addLayer(); d.brush.color = 0xFF20C020.toInt(); d.down(8f, 8f); d.up(8f, 8f)
        assertEquals(2, d.layers.size); d.setOpacity(1, 0.5f); d.setVisible(0, false)
        assertEquals(0x20, (d.flatten().px[8 * 32 + 8] shr 16) and 255); assertTrue(a(d.flatten().px[8 * 32 + 8]) in 120..135)
        d.setVisible(0, true); assertTrue(d.mergeDown()); assertEquals(1, d.layers.size); assertTrue(d.undo()); assertEquals(2, d.layers.size)
        val tr = d.importLayer(Raster(10, 10, IntArray(100) { -1 }), trace = true); assertTrue(tr.trace)
        assertEquals(0, a(d.flatten().px[0]), "a tracing layer is never exported"); assertNotNull(d.trimmed()); assertTrue(d.trimmed()!!.w < 32)
        assertNull(PaintDoc(8, 8).trimmed())
        val many = PaintDoc(16, 16); many.brush.stabilize = 0f; repeat(130) { many.down((it % 16).toFloat(), (it / 16).toFloat()); many.up((it % 16).toFloat(), (it / 16).toFloat()) }
        assertEquals(PaintDoc.MAX_UNDO, many.undoCount, "100 steps of undo")
        /* a draft comes back exactly */
        val files = Draft.encode(d, "測試", 123L, "item:x")
        val (back, meta) = Draft.decode { files[it] }
        assertEquals("測試", meta.name); assertEquals("item:x", meta.target); assertEquals(d.layers.size, back.layers.size); assertTrue(back.layers[2].trace)
        for (i in d.layers.indices) assertTrue(d.layers[i].r.px.contentEquals(back.layers[i].r.px)); assertFalse(back.dirty)
        val broken = files.toMutableMap(); broken.remove("L1.bin")
        assertTrue(kotlin.runCatching { Draft.decode { broken[it] } }.exceptionOrNull()!!.message!!.contains("第 2 個圖層"))
        assertTrue(PaintDoc.seamless(Raster(4, 4, IntArray(16) { -1 }))); assertFalse(PaintDoc.seamless(Raster(4, 4, IntArray(16) { if (it % 4 == 0) -1 else 0 })))
        assertNotEquals(0, d.undoCount)
    }
}
