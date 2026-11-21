package app.ocshimeji.save

import app.ocshimeji.save.media.Actions
import app.ocshimeji.save.media.Codec
import app.ocshimeji.save.media.Formats
import app.ocshimeji.save.media.ImageSize
import app.ocshimeji.save.media.Importer
import app.ocshimeji.save.media.Importer.Source
import app.ocshimeji.save.media.Pixels
import app.ocshimeji.save.media.Png
import app.ocshimeji.save.media.Raster
import app.ocshimeji.sim.chars.CharSpec
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import javax.imageio.IIOImage
import javax.imageio.ImageIO
import javax.imageio.ImageTypeSpecifier
import javax.imageio.metadata.IIOMetadataNode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Plan M2 acceptance: a set of test files (good ones in every format and broken ones) each gives the right result or a clear reason,
 * and the imported working picture is exactly the original scaled down (pixel by pixel).
 */
class MediaTest {
    /** the JVM's still decoder stands in for the phone's */
    private val codec = Codec { b -> ImageIO.read(ByteArrayInputStream(b))?.let { r -> Raster(r.width, r.height, r.getRGB(0, 0, r.width, r.height, null, 0, r.width)) } }
    private fun pic(w: Int, h: Int, bg: Color? = null, body: Color = Color(0x8E, 0xD1, 0xB4), shift: Int = 0): BufferedImage {
        val img = BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB); val g = img.createGraphics()
        if (bg != null) { g.color = bg; g.fillRect(0, 0, w, h) }
        g.color = body; g.fillOval(w / 4 + shift, h / 6, w / 2, h * 2 / 3); g.color = Color(0x5B, 0x3A, 0x29); g.fillRect(w / 2 - 4 + shift, h - h / 6, 8, h / 6); g.dispose(); return img
    }
    private fun png(img: BufferedImage) = ByteArrayOutputStream().also { ImageIO.write(img, "png", it) }.toByteArray()
    private fun jpg(img: BufferedImage) = ByteArrayOutputStream().also { val rgb = BufferedImage(img.width, img.height, BufferedImage.TYPE_INT_RGB); rgb.createGraphics().drawImage(img, 0, 0, null); ImageIO.write(rgb, "jpg", it) }.toByteArray()
    private fun raster(img: BufferedImage) = Raster(img.width, img.height, img.getRGB(0, 0, img.width, img.height, null, 0, img.width))
    private fun zip(vararg files: Pair<String, ByteArray>) = ByteArrayOutputStream().also { b -> ZipOutputStream(b).use { z -> for ((n, d) in files) { z.putNextEntry(ZipEntry(n)); z.write(d); z.closeEntry() } } }.toByteArray()
    private fun refuse(why: String, block: () -> Unit) { val e = assertFailsWith<IllegalArgumentException> { block() }; assertTrue(e.message!!.contains(why), "expected 「$why」 in 「${e.message}」") }

    @Test fun aSinglePictureIsExactlyTheOriginalScaledDown() {
        val orig = pic(2000, 1500); val bytes = png(orig)
        val im = Importer.read(listOf(Source("me.png", bytes)), codec); assertEquals("single", im.kind)
        val p = Importer.prepare(im); assertEquals(1024, p.w); assertEquals(768, p.h); assertTrue(!p.opaque)
        val s = SaveSystem(MemStorage()); val c = s.saveCharacter(p, CharSpec(name = "小綠"), 1, true, emptyMap(), listOf(Source("me.png", bytes)))
        val working = codec.decode(s.readFile(c.image.removePrefix("lib:"))!!)!!
        val expected = Pixels.resize(raster(orig), 1024, 768)
        assertTrue(working.same(expected), "the working copy is the original resized, pixel for pixel")
        assertTrue(s.readFile("library/chars/${c.id}/orig/0_me.png")!!.contentEquals(bytes), "the original is kept unchanged")
        assertTrue(c.footY > 0.9f && c.footY <= 1f)
    }
    @Test fun anOpaqueJpegGetsItsBackgroundRemoved() {
        val im = Importer.read(listOf(Source("photo.jpg", jpg(pic(300, 400, bg = Color.WHITE)))), codec)
        val p = Importer.prepare(im); val f = p.clips["idle"]!!.frames[0]
        assertTrue(f.alpha(0, 0) == 0 && f.alpha(f.w - 1, f.h - 1) == 0, "the border became transparent"); assertTrue(f.alpha(f.w / 2, f.h / 2) == 255, "the body stays")
        val keep = Importer.prepare(Importer.read(listOf(Source("photo.jpg", jpg(pic(300, 400, bg = Color.WHITE)))), codec), Importer.Options(removeBg = false)); assertTrue(keep.opaque)
        val brushed = f.copy(); Pixels.brush(brushed, f, f.w / 2f, f.h / 2f, 10f, erase = true); assertEquals(0, brushed.alpha(f.w / 2, f.h / 2))
        Pixels.brush(brushed, f, f.w / 2f, f.h / 2f, 10f, erase = false); assertTrue(brushed.same(f), "restore brings the original back")
    }
    @Test fun sequencesSheetsAndAtlases() {
        val frames = (0..3).map { png(pic(64, 80, shift = it * 2)) }
        val z = Importer.read(listOf(Source("chara.zip", zip("walk_03.png" to frames[3], "walk_01.png" to frames[1], "walk_00.png" to frames[0], "walk_02.png" to frames[2], "idle_0.png" to frames[0], "Idle_1.png" to frames[1], "__MACOSX/._x" to byteArrayOf(1)))), codec)
        assertEquals("sequence", z.kind); assertEquals(listOf("idle", "walk"), z.clips.keys.toList()); assertEquals(4, z.clips["walk"]!!.frames.size)
        assertTrue(z.clips["walk"]!!.frames[2].same(codec.decode(frames[2])!!), "frames in number order")
        val multi = Importer.read(listOf(Source("睡_1.png", frames[1]), Source("睡_0.png", frames[0]), Source("開心.png", frames[2])), codec); assertEquals(setOf("sleep", "happy"), multi.clips.keys)
        val sheet = BufferedImage(4 * 64, 2 * 80, BufferedImage.TYPE_INT_ARGB).also { g -> val gg = g.createGraphics(); for (i in 0 until 7) gg.drawImage(pic(64, 80, shift = i), (i % 4) * 64, (i / 4) * 80, null); gg.dispose() }
        val grid = Importer.read(listOf(Source("run.png", png(sheet))), codec, Importer.Options(cols = 4, rows = 2, ms = 90)); assertEquals("sheet", grid.kind); assertEquals(7, grid.clips["run"]!!.frames.size, "the empty 8th cell is skipped")
        val tp = """{"frames":{"walk_0.png":{"frame":{"x":0,"y":0,"w":64,"h":80},"duration":80},"walk_1.png":{"frame":{"x":64,"y":0,"w":64,"h":80}},"idle.png":{"frame":{"x":128,"y":0,"w":64,"h":80}}}}"""
        val at = Importer.read(listOf(Source("s.png", png(sheet)), Source("s.json", tp.toByteArray())), codec); assertEquals(2, at.clips["walk"]!!.frames.size); assertEquals(80, at.clips["walk"]!!.ms[0])
        val ase = """{"frames":[${(0 until 7).joinToString(",") { """{"filename":"f$it","frame":{"x":${(it % 4) * 64},"y":${(it / 4) * 80},"w":64,"h":80},"duration":100}""" }}],"meta":{"frameTags":[{"name":"Walk","from":0,"to":3},{"name":"sleep","from":4,"to":5},{"name":"跳舞囉","from":6,"to":6}]}}"""
        val a2 = Importer.read(listOf(Source("s.png", png(sheet)), Source("s.json", ase.toByteArray())), codec); assertEquals(4, a2.clips["walk"]!!.frames.size); assertEquals(2, a2.clips["sleep"]!!.frames.size)
        assertTrue(a2.warnings.any { it.contains("跳舞囉") }, "an unknown tag is reported, not silently dropped")
        val prep = Importer.prepare(Importer.read(listOf(Source("a_0.png", png(pic(40, 60))), Source("walk_0.png", png(pic(64, 80)))), codec))
        assertTrue(prep.clips.values.all { c -> c.frames.all { it.w == prep.w && it.h == prep.h } }, "one canvas for every frame")
    }
    @Test fun gifApngAndAnimatedWebp() {
        // GIF with three frames written by the JVM
        val gifBytes = ByteArrayOutputStream().also { out -> val wr = ImageIO.getImageWritersByFormatName("gif").next(); val ios = ImageIO.createImageOutputStream(out); wr.output = ios; wr.prepareWriteSequence(null)
            for (i in 0 until 3) { val img = BufferedImage(40, 40, BufferedImage.TYPE_INT_RGB).also { val g = it.createGraphics(); g.color = listOf(Color.RED, Color.GREEN, Color.BLUE)[i]; g.fillRect(0, 0, 40, 40); g.dispose() }
                val meta = wr.getDefaultImageMetadata(ImageTypeSpecifier.createFromRenderedImage(img), null); val root = meta.getAsTree("javax_imageio_gif_image_1.0") as IIOMetadataNode
                val gce = IIOMetadataNode("GraphicControlExtension"); gce.setAttribute("disposalMethod", "none"); gce.setAttribute("userInputFlag", "FALSE"); gce.setAttribute("transparentColorFlag", "FALSE"); gce.setAttribute("delayTime", "20"); gce.setAttribute("transparentColorIndex", "0"); root.appendChild(gce)
                meta.setFromTree("javax_imageio_gif_image_1.0", root); wr.writeToSequence(IIOImage(img, null, meta), null) }
            wr.endWriteSequence(); ios.close() }.toByteArray()
        val g = Importer.read(listOf(Source("happy.gif", gifBytes)), codec); assertEquals("gif", g.kind); val gc = g.clips["happy"]!!
        assertEquals(3, gc.frames.size); assertEquals(200, gc.ms[0]); assertEquals(0xFF0000FF.toInt(), gc.frames[2][5, 5], "third frame is blue")
        refuse("斷掉") { Formats.gif(gifBytes.copyOf(gifBytes.size / 2), 600) }
        // APNG built from two of our PNGs
        val f1 = Raster(30, 20, IntArray(600) { 0xFFFF0000.toInt() }); val f2 = Raster(10, 10, IntArray(100) { 0xFF00FF00.toInt() })
        val apng = apng(f1, f2); assertTrue(Formats.isApng(apng))
        val ap = Importer.read(listOf(Source("walk.png", apng)), codec); assertEquals("apng", ap.kind); val ac = ap.clips["walk"]!!
        assertEquals(2, ac.frames.size); assertEquals(0xFF00FF00.toInt(), ac.frames[1][7, 7], "second frame drawn at 5,5"); assertEquals(0xFFFF0000.toInt(), ac.frames[1][1, 1]); assertEquals(500, ac.ms[1])
        // animated WebP: the container is split; each frame goes to the codec as a still WebP (the phone decodes those)
        val seen = ArrayList<ByteArray>(); val wcodec = Codec { b -> seen += b; Raster(4, 4, IntArray(16) { 0xFF123456.toInt() }) }
        val w = Formats.webp(webp(), wcodec, 600); assertEquals(2, w.frames.size); assertEquals(70, w.frames[0].ms); assertEquals(2, seen.size)
        assertTrue(seen.all { String(it, 0, 4) == "RIFF" && String(it, 8, 4) == "WEBP" && String(it, 12, 4) == "VP8L" }); assertEquals(0xFF123456.toInt(), w.frames[1].img[3, 3])
    }
    @Test fun brokenAndOversizedFilesAreRefusedWithAReason() {
        val good = png(pic(50, 60))
        refuse("解不開") { Importer.read(listOf(Source("half.png", good.copyOf(40))), codec) }
        refuse("看不懂") { Importer.read(listOf(Source("x.bin", ByteArray(100) { it.toByte() })), codec) }
        refuse("太大") { Importer.read(listOf(Source("big.png", png(BufferedImage(5000, 10, BufferedImage.TYPE_INT_ARGB)))), codec) }
        refuse("壞掉") { Importer.read(listOf(Source("x.zip", "PK\u0003\u0004garbage".toByteArray())), codec) }
        refuse("沒有圖片") { Importer.read(listOf(Source("x.zip", zip("readme.txt" to "hi".toByteArray()))), codec) }
        refuse("JSON") { Importer.read(listOf(Source("a.json", "{}".toByteArray())), codec) }
        refuse("超出圖片範圍") { Importer.read(listOf(Source("s.png", good), Source("s.json", """{"frames":{"a":{"frame":{"x":40,"y":0,"w":64,"h":80}}}}""".toByteArray())), codec) }
        refuse("影格太多") { Importer.prepare(Importer.read((0..600).map { Source("walk_$it.png", png(BufferedImage(4, 4, BufferedImage.TYPE_INT_ARGB))) }, codec)) }
        refuse("沒有選任何檔案") { Importer.read(emptyList(), codec) }
        assertEquals(5000 to 10, ImageSize.of(png(BufferedImage(5000, 10, BufferedImage.TYPE_INT_ARGB))))
        assertEquals(300 to 400, ImageSize.of(jpg(pic(300, 400))))
    }
    @Test fun ocpkgRoundTripAndBadPackages() {
        val s = SaveSystem(MemStorage())
        val im = Importer.read(listOf(Source("z.zip", zip("idle_0.png" to png(pic(64, 80)), "idle_1.png" to png(pic(64, 80, shift = 3)), "walk_0.png" to png(pic(64, 80, shift = 5))))), codec)
        val spec = CharSpec(name = "包包", traits = listOf("書蟲"), selfRef = "人家")
        val c = s.saveCharacter(Importer.prepare(im), spec, -1, false, mapOf("頭" to Mark(0.5f, 0.3f, 0.2f)), emptyList())
        assertEquals(setOf("idle", "walk"), c.anims.keys); s.setFace(c.id, "happy", Raster(8, 8, IntArray(64) { -1 }))
        val pkg = s.exportPkg(c.id, "我")
        val back = Importer.read(listOf(Source("包包.ocpkg", pkg)), codec); assertEquals("ocpkg", back.kind); assertEquals("人家", back.pkg!!.spec!!.selfRef); assertEquals(-1, back.pkg!!.facing)
        assertEquals(2, back.clips["idle"]!!.frames.size); assertNotNull(back.faces["happy"]); assertEquals(0.3f, back.pkgMarks["頭"]!!.y)
        val orig = codec.decode(s.readFile(c.anims["walk"]!!.frames[0].removePrefix("lib:"))!!)!!; assertTrue(back.clips["walk"]!!.frames[0].same(orig), "pixels survive the round trip")
        val manifest = String(java.util.zip.ZipInputStream(ByteArrayInputStream(pkg)).use { z -> var e = z.nextEntry; while (e != null && e.name != "manifest.json") e = z.nextEntry; z.readBytes() })
        refuse("比較新的版本") { Importer.read(listOf(Source("x.ocpkg", zip("manifest.json" to manifest.replace("\"v\":1", "\"v\":9").toByteArray()))), codec) }
        refuse("少了檔案") { Importer.read(listOf(Source("x.ocpkg", zip("manifest.json" to manifest.toByteArray()))), codec) }
        refuse("壞掉") { Importer.read(listOf(Source("x.ocpkg", zip("manifest.json" to "not json".toByteArray()))), codec) }
        refuse("不是 OC Shimeji") { Importer.read(listOf(Source("x.ocpkg", zip("manifest.json" to manifest.replace("\"format\":\"ocpkg\"", "\"format\":\"other\"").toByteArray()))), codec) }
        refuse("內建") { s.exportPkg(Presets.CINNAMON.id) }
    }
    @Test fun actionNamesAndFallbackChains() {
        assertEquals("walk" to 3, Actions.guess("Walk_03.png")); assertEquals("sleep" to 2, Actions.guess("frames/睡覺2.png")); assertEquals(null, Actions.guess("abc.png").first)
        val have = setOf("idle", "walk", "held")
        assertEquals("walk", Actions.resolve("run", have::contains)); assertEquals("held", Actions.resolve("climb", have::contains)); assertEquals("idle", Actions.resolve("eat", have::contains))
        assertEquals(null, Actions.resolve("eat") { false }, "nothing drawn: the procedural idle plays")
        for (a in Actions.ALL) assertEquals("idle", Actions.resolve(a) { it == "idle" }, "every chain ends at idle ($a)")
    }

    // ---- building test files by hand ----
    private fun idat(r: Raster): Pair<ByteArray, ByteArray> { val b = Png.encode(r); var i = 8; var head = ByteArray(0); var data = ByteArray(0)
        while (i < b.size) { val len = java.nio.ByteBuffer.wrap(b, i, 4).int; val t = String(b, i + 4, 4); if (t == "IHDR") head = b.copyOfRange(i + 8, i + 8 + len); if (t == "IDAT") data = b.copyOfRange(i + 8, i + 8 + len); i += 12 + len }
        return head to data }
    private fun apng(a: Raster, b: Raster): ByteArray {
        val (head, d1) = idat(a); val (_, d2) = idat(b); val out = ByteArrayOutputStream(); out.write(Png.SIG); Png.chunk(out, "IHDR", head)
        fun be(v: Int, n: Int) = ByteArray(n) { (v ushr (8 * (n - 1 - it))).toByte() }
        Png.chunk(out, "acTL", be(2, 4) + be(0, 4))
        Png.chunk(out, "fcTL", be(0, 4) + be(a.w, 4) + be(a.h, 4) + be(0, 4) + be(0, 4) + be(1, 2) + be(10, 2) + byteArrayOf(0, 0))
        Png.chunk(out, "IDAT", d1)
        Png.chunk(out, "fcTL", be(1, 4) + be(b.w, 4) + be(b.h, 4) + be(5, 4) + be(5, 4) + be(1, 2) + be(2, 2) + byteArrayOf(0, 1))
        Png.chunk(out, "fdAT", be(2, 4) + d2); Png.chunk(out, "IEND", ByteArray(0)); return out.toByteArray()
    }
    private fun webp(): ByteArray {
        fun le(v: Int, n: Int) = ByteArray(n) { (v ushr (8 * it)).toByte() }
        fun chunk(t: String, d: ByteArray) = t.toByteArray() + le(d.size, 4) + d + (if (d.size % 2 == 1) byteArrayOf(0) else ByteArray(0))
        val vp8l = chunk("VP8L", byteArrayOf(0x2F, 3, 0, 0, 0, 1, 2, 3))
        fun anmf(ms: Int) = chunk("ANMF", le(0, 3) + le(0, 3) + le(3, 3) + le(3, 3) + le(ms, 3) + byteArrayOf(0) + vp8l)
        val body = "WEBP".toByteArray() + chunk("VP8X", byteArrayOf(0x02, 0, 0, 0) + le(3, 3) + le(3, 3)) + chunk("ANIM", le(0, 4) + le(0, 2)) + anmf(70) + anmf(90)
        return "RIFF".toByteArray() + le(body.size, 4) + body
    }
}
