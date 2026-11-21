package app.ocshimeji.save.media

import java.io.ByteArrayOutputStream

/** one frame of an animation and how long it shows (ms) */
class Frame(val img: Raster, val ms: Int)

/** an animation decoded from a file: the canvas size and every frame composited onto it */
class Anim(val w: Int, val h: Int, val frames: List<Frame>)

/** the animated formats of plan 3.1 (GIF, APNG, animated WebP). Each is split into frames; every problem says what is wrong. */
object Formats {
    private fun bad(why: String): Nothing = throw IllegalArgumentException(why)

    // ---------------- GIF (pure decoder: LZW, local / global palettes, transparency, disposal, interlace) ----------------
    fun gif(b: ByteArray, maxFrames: Int): Anim {
        if (b.size < 13) bad("GIF 檔案不完整")
        var i = 6
        fun u8(): Int { if (i >= b.size) bad("GIF 檔案在中途斷掉了"); return b[i++].toInt() and 255 }
        fun u16() = u8() or (u8() shl 8)
        val w = u16(); val h = u16(); val flags = u8(); u8(); u8()
        if (w <= 0 || h <= 0) bad("GIF 的大小是 0")
        val gct = if (flags and 0x80 != 0) IntArray(1 shl ((flags and 7) + 1)) { 0xFF000000.toInt() or (u8() shl 16) or (u8() shl 8) or u8() } else null
        val canvas = Raster(w, h); val frames = ArrayList<Frame>()
        var delay = 100; var transp = -1; var dispose = 0
        loop@ while (i < b.size) {
            when (u8()) {
                0x21 -> { val label = u8()
                    if (label == 0xF9) { u8(); val f = u8(); delay = u16() * 10; val t = u8(); u8(); dispose = (f shr 2) and 7; transp = if (f and 1 != 0) t else -1 }
                    else { var n = u8(); while (n > 0) { i += n; n = u8() } } }
                0x2C -> {
                    val fx = u16(); val fy = u16(); val fw = u16(); val fh = u16(); val f = u8()
                    val lct = if (f and 0x80 != 0) IntArray(1 shl ((f and 7) + 1)) { 0xFF000000.toInt() or (u8() shl 16) or (u8() shl 8) or u8() } else null
                    val pal = lct ?: gct ?: bad("GIF 沒有調色盤")
                    val minCode = u8(); val data = ByteArrayOutputStream(); var n = u8(); while (n > 0) { if (i + n > b.size) bad("GIF 檔案在中途斷掉了"); data.write(b, i, n); i += n; n = u8() }
                    val idx = lzw(data.toByteArray(), minCode, fw * fh)
                    val before = if (dispose == 3) canvas.copy() else null
                    val rows = if (f and 0x40 != 0) interlaced(fh) else IntArray(fh) { it }
                    for (r in 0 until fh) { val y = fy + rows[r]; if (y !in 0 until h) continue
                        for (x in 0 until fw) { val tx = fx + x; if (tx !in 0 until w) continue; val k = idx[r * fw + x].toInt() and 255
                            if (k != transp && k < pal.size) canvas.px[y * w + tx] = pal[k] } }
                    frames += Frame(canvas.copy(), if (delay <= 10) 100 else delay)
                    if (frames.size > maxFrames) bad("影格太多（超過 $maxFrames 格）")
                    when (dispose) { 2 -> for (y in fy until minOf(h, fy + fh)) for (x in fx until minOf(w, fx + fw)) canvas.px[y * w + x] = 0
                        3 -> before?.let { System.arraycopy(it.px, 0, canvas.px, 0, it.px.size) } }
                    transp = -1; dispose = 0; delay = 100
                }
                0x3B -> break@loop
                else -> if (frames.isNotEmpty()) break@loop else bad("GIF 檔案壞掉了")
            }
        }
        if (frames.isEmpty()) bad("GIF 裡沒有任何影格")
        return Anim(w, h, frames)
    }
    private fun interlaced(h: Int): IntArray { val out = ArrayList<Int>(); for ((s, st) in listOf(0 to 8, 4 to 8, 2 to 4, 1 to 2)) { var y = s; while (y < h) { out += y; y += st } }; return out.toIntArray() }
    private fun lzw(data: ByteArray, minCode: Int, count: Int): ByteArray {
        if (minCode !in 2..8) bad("GIF 的壓縮資料不正確")
        val out = ByteArray(count); var o = 0
        val clear = 1 shl minCode; val end = clear + 1
        val prefix = IntArray(4096); val suffix = ByteArray(4096); val len = IntArray(4096)
        for (k in 0 until clear) { prefix[k] = -1; suffix[k] = k.toByte(); len[k] = 1 }
        var size = minCode + 1; var next = end + 1; var prev = -1; var bits = 0; var acc = 0; var p = 0
        val stack = ByteArray(4097)
        while (o < count) {
            while (bits < size) { if (p >= data.size) return out; acc = acc or ((data[p++].toInt() and 255) shl bits); bits += 8 }
            val code = acc and ((1 shl size) - 1); acc = acc ushr size; bits -= size
            if (code == clear) { size = minCode + 1; next = end + 1; prev = -1; continue }
            if (code == end) break
            var c = code; var first: Byte
            if (code >= next) { if (prev < 0) break; c = prev }
            var sp = 0; while (c >= 0 && sp < 4096) { stack[sp++] = suffix[c]; c = prefix[c] }
            first = stack[sp - 1]
            while (sp > 0 && o < count) out[o++] = stack[--sp]
            if (code >= next && o < count) out[o++] = first
            if (prev >= 0 && next < 4096) { prefix[next] = prev; suffix[next] = first; len[next] = len[prev] + 1; next++; if (next == (1 shl size) && size < 12) size++ }
            prev = code
        }
        return out
    }

    // ---------------- APNG: each frame becomes a still PNG for the codec, then composited (blend, dispose) ----------------
    fun isApng(b: ByteArray): Boolean { var i = 8; while (i + 8 <= b.size) { val len = u32(b, i); val t = String(b, i + 4, 4, Charsets.US_ASCII); if (t == "acTL") return true; if (t == "IDAT") return false; i += 12 + len }; return false }
    fun apng(b: ByteArray, codec: Codec, maxFrames: Int): Anim {
        var i = 8; var ihdr: ByteArray? = null; val pre = ArrayList<Pair<String, ByteArray>>()
        class F(val w: Int, val h: Int, val x: Int, val y: Int, val ms: Int, val dispose: Int, val blend: Int) { val data = ByteArrayOutputStream() }
        val fs = ArrayList<F>(); var cur: F? = null; var seenIdat = false
        while (i + 8 <= b.size) {
            val len = u32(b, i); val t = String(b, i + 4, 4, Charsets.US_ASCII); if (i + 12 + len > b.size || len < 0) bad("APNG 檔案在中途斷掉了")
            val d = b.copyOfRange(i + 8, i + 8 + len)
            when (t) {
                "IHDR" -> ihdr = d
                "PLTE", "tRNS", "gAMA", "sRGB", "iCCP", "cHRM", "sBIT" -> if (!seenIdat) pre += t to d
                "fcTL" -> { val num = u16(d, 20); val den = u16(d, 22).let { if (it == 0) 100 else it }
                    cur = F(u32(d, 4), u32(d, 8), u32(d, 12), u32(d, 16), maxOf(20, num * 1000 / den), d[24].toInt(), d[25].toInt()).also { fs += it; if (fs.size > maxFrames) bad("影格太多（超過 $maxFrames 格）") } }
                "IDAT" -> { seenIdat = true; cur?.data?.write(d) }
                "fdAT" -> cur?.data?.write(d, 4, d.size - 4)
                "IEND" -> break
            }
            i += 12 + len
        }
        val head = ihdr ?: bad("APNG 沒有檔頭"); val cw = u32(head, 0); val ch = u32(head, 4)
        if (fs.isEmpty()) bad("APNG 裡沒有任何影格")
        val canvas = Raster(cw, ch); val out = ArrayList<Frame>()
        for (f in fs) {
            if (f.data.size() == 0) continue
            val png = ByteArrayOutputStream(); png.write(Png.SIG)
            Png.chunk(png, "IHDR", head.copyOf().also { put32(it, 0, f.w); put32(it, 4, f.h) }); for ((t, d) in pre) Png.chunk(png, t, d)
            Png.chunk(png, "IDAT", f.data.toByteArray()); Png.chunk(png, "IEND", ByteArray(0))
            val img = codec.safe(png.toByteArray()) ?: bad("APNG 的第 ${out.size + 1} 格解不開")
            val before = if (f.dispose == 2) canvas.copy() else null
            Pixels.over(canvas, img, f.x, f.y, blend = f.blend == 1)
            out += Frame(canvas.copy(), f.ms)
            when (f.dispose) { 1 -> for (y in f.y until minOf(ch, f.y + f.h)) for (x in f.x until minOf(cw, f.x + f.w)) canvas.px[y * cw + x] = 0
                2 -> before?.let { System.arraycopy(it.px, 0, canvas.px, 0, it.px.size) } }
        }
        return Anim(cw, ch, out)
    }

    // ---------------- animated WebP: every ANMF frame is rewrapped as a still WebP for the codec ----------------
    fun isAnimatedWebp(b: ByteArray) = b.size > 30 && String(b, 12, 4, Charsets.US_ASCII) == "VP8X" && (b[20].toInt() and 0x02) != 0
    fun webp(b: ByteArray, codec: Codec, maxFrames: Int): Anim {
        val cw = u24le(b, 24) + 1; val ch = u24le(b, 27) + 1
        var i = 12; val canvas = Raster(cw, ch); val out = ArrayList<Frame>()
        while (i + 8 <= b.size) {
            val t = String(b, i, 4, Charsets.US_ASCII); val len = u32le(b, i + 4); if (len < 0 || i + 8 + len > b.size) bad("WebP 檔案在中途斷掉了")
            if (t == "ANMF") {
                val d = i + 8; val fx = u24le(b, d) * 2; val fy = u24le(b, d + 3) * 2; val fw = u24le(b, d + 6) + 1; val fh = u24le(b, d + 9) + 1
                val ms = u24le(b, d + 12).let { if (it <= 10) 100 else it }; val flags = b[d + 15].toInt(); val dispose = flags and 1; val noBlend = flags and 2 != 0
                val inner = b.copyOfRange(d + 16, d + len)
                val still = ByteArrayOutputStream()
                val hasAlph = inner.size > 4 && String(inner, 0, 4, Charsets.US_ASCII) == "ALPH"
                val body = ByteArrayOutputStream()
                if (hasAlph) { body.write("VP8X".toByteArray()); le32(body, 10); body.write(0x10); body.write(0); body.write(0); body.write(0); le24(body, fw - 1); le24(body, fh - 1) }
                body.write(inner)
                still.write("RIFF".toByteArray()); le32(still, body.size() + 4); still.write("WEBP".toByteArray()); still.write(body.toByteArray())
                val img = codec.safe(still.toByteArray()) ?: bad("WebP 的第 ${out.size + 1} 格解不開")
                Pixels.over(canvas, img, fx, fy, blend = !noBlend)
                out += Frame(canvas.copy(), ms)
                if (out.size > maxFrames) bad("影格太多（超過 $maxFrames 格）")
                if (dispose == 1) for (y in fy until minOf(ch, fy + fh)) for (x in fx until minOf(cw, fx + fw)) canvas.px[y * cw + x] = 0
            }
            i += 8 + len + (len and 1)
        }
        if (out.isEmpty()) bad("WebP 裡沒有任何影格")
        return Anim(cw, ch, out)
    }

    // ---------------- sprite sheets ----------------
    /** a uniform grid; empty (fully transparent) cells are skipped */
    fun grid(sheet: Raster, cols: Int, rows: Int, ms: Int): List<Frame> {
        if (cols < 1 || rows < 1) bad("行列數要大於 0")
        if (sheet.w / cols < 2 || sheet.h / rows < 2) bad("格子太小了（${sheet.w}×${sheet.h} 分成 $cols×$rows）")
        val cw = sheet.w / cols; val chh = sheet.h / rows; val out = ArrayList<Frame>()
        for (r in 0 until rows) for (c in 0 until cols) { val cell = crop(sheet, c * cw, r * chh, cw, chh); if (!cell.empty) out += Frame(cell, ms) }
        if (out.isEmpty()) bad("每一格都是空的")
        return out
    }
    fun crop(src: Raster, x: Int, y: Int, w: Int, h: Int): Raster {
        if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > src.w || y + h > src.h) bad("格子超出圖片範圍（$x,$y ${w}×$h）")
        val out = Raster(w, h); for (yy in 0 until h) System.arraycopy(src.px, (y + yy) * src.w + x, out.px, yy * w, w); return out
    }

    private fun u32(b: ByteArray, i: Int) = ((b[i].toInt() and 255) shl 24) or ((b[i + 1].toInt() and 255) shl 16) or ((b[i + 2].toInt() and 255) shl 8) or (b[i + 3].toInt() and 255)
    private fun u16(b: ByteArray, i: Int) = ((b[i].toInt() and 255) shl 8) or (b[i + 1].toInt() and 255)
    private fun put32(b: ByteArray, i: Int, v: Int) { b[i] = (v ushr 24).toByte(); b[i + 1] = (v ushr 16).toByte(); b[i + 2] = (v ushr 8).toByte(); b[i + 3] = v.toByte() }
    private fun u24le(b: ByteArray, i: Int) = (b[i].toInt() and 255) or ((b[i + 1].toInt() and 255) shl 8) or ((b[i + 2].toInt() and 255) shl 16)
    private fun u32le(b: ByteArray, i: Int) = u24le(b, i) or ((b[i + 3].toInt() and 255) shl 24)
    private fun le32(o: ByteArrayOutputStream, v: Int) { o.write(v); o.write(v ushr 8); o.write(v ushr 16); o.write(v ushr 24) }
    private fun le24(o: ByteArrayOutputStream, v: Int) { o.write(v); o.write(v ushr 8); o.write(v ushr 16) }
}
