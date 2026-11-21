package app.ocshimeji.save.media

import java.io.ByteArrayOutputStream
import java.util.zip.CRC32
import java.util.zip.Deflater

/** ARGB pixels (0xAARRGGBB, not premultiplied) */
class Raster(val w: Int, val h: Int, val px: IntArray = IntArray(w * h)) {
    init { require(w > 0 && h > 0 && px.size >= w * h) { "圖片的大小不對" } }
    operator fun get(x: Int, y: Int) = px[y * w + x]
    fun copy() = Raster(w, h, px.copyOf())
    fun alpha(x: Int, y: Int) = (px[y * w + x] ushr 24) and 0xFF
    val empty: Boolean get() = px.all { (it ushr 24) == 0 }
    fun same(o: Raster) = w == o.w && h == o.h && (0 until w * h).all { px[it] == o.px[it] }
}

/** decodes one still picture (PNG, JPEG, WebP, a single GIF frame…). The phone and the tests each give their own. */
fun interface Codec { fun decode(bytes: ByteArray): Raster? }
/** a codec that never throws: a picture it cannot read is just null (the importer then says why) */
fun Codec.safe(bytes: ByteArray): Raster? = try { decode(bytes) } catch (e: Exception) { null } catch (e: OutOfMemoryError) { null }

object Pixels {
    /** area-average downscale by `k` (≤ 1), alpha-weighted so transparent edges do not turn dark. Deterministic: the same input
     *  always gives the same output, which is what the import test compares against. */
    fun resize(src: Raster, nw: Int, nh: Int): Raster {
        if (nw == src.w && nh == src.h) return src.copy()
        val out = IntArray(nw * nh); val sx = src.w.toDouble() / nw; val sy = src.h.toDouble() / nh
        for (y in 0 until nh) { val y0 = y * sy; val y1 = (y + 1) * sy
            for (x in 0 until nw) { val x0 = x * sx; val x1 = (x + 1) * sx
                var a = 0.0; var r = 0.0; var g = 0.0; var b = 0.0; var area = 0.0
                var yy = y0.toInt(); while (yy < y1 && yy < src.h) { val wy = minOf(y1, yy + 1.0) - maxOf(y0, yy.toDouble())
                    var xx = x0.toInt(); while (xx < x1 && xx < src.w) { val wx = minOf(x1, xx + 1.0) - maxOf(x0, xx.toDouble()); val wgt = wx * wy
                        val c = src.px[yy * src.w + xx]; val ca = ((c ushr 24) and 255) / 255.0
                        a += ca * wgt; r += ((c shr 16) and 255) * ca * wgt; g += ((c shr 8) and 255) * ca * wgt; b += (c and 255) * ca * wgt; area += wgt; xx++ }
                    yy++ }
                out[y * nw + x] = if (a <= 1e-9) 0 else (((a / area * 255).toInt().coerceIn(0, 255) shl 24) or ((r / a).toInt().coerceIn(0, 255) shl 16) or ((g / a).toInt().coerceIn(0, 255) shl 8) or (b / a).toInt().coerceIn(0, 255))
            } }
        return Raster(nw, nh, out)
    }
    /** the size that fits in `max` px on the longest side (never upscales) */
    fun fit(w: Int, h: Int, max: Int): Pair<Int, Int> { if (w <= max && h <= max) return w to h; val k = max.toDouble() / maxOf(w, h); return maxOf(1, (w * k).toInt()) to maxOf(1, (h * k).toInt()) }

    /** put a picture onto a bigger canvas (bottom-centre: feet stay on the floor) */
    fun pad(src: Raster, w: Int, h: Int): Raster {
        if (src.w == w && src.h == h) return src
        val out = Raster(w, h); val ox = (w - src.w) / 2; val oy = h - src.h
        for (y in 0 until src.h) for (x in 0 until src.w) { val tx = x + ox; val ty = y + oy; if (tx in 0 until w && ty in 0 until h) out.px[ty * w + tx] = src.px[y * src.w + x] }
        return out
    }
    /** `src` over `dst` at (ox, oy) — normal alpha blending */
    fun over(dst: Raster, src: Raster, ox: Int, oy: Int, blend: Boolean = true) {
        for (y in 0 until src.h) { val ty = y + oy; if (ty !in 0 until dst.h) continue
            for (x in 0 until src.w) { val tx = x + ox; if (tx !in 0 until dst.w) continue
                val s = src.px[y * src.w + x]; val i = ty * dst.w + tx
                if (!blend) { dst.px[i] = s; continue }
                val sa = (s ushr 24) and 255; if (sa == 255) { dst.px[i] = s; continue }; if (sa == 0) continue
                val d = dst.px[i]; val da = (d ushr 24) and 255; val oa = sa + da * (255 - sa) / 255; if (oa == 0) { dst.px[i] = 0; continue }
                fun ch(sh: Int) = ((((s shr sh) and 255) * sa + ((d shr sh) and 255) * da * (255 - sa) / 255) / oa).coerceIn(0, 255)
                dst.px[i] = (oa shl 24) or (ch(16) shl 16) or (ch(8) shl 8) or ch(0) } }
    }

    // ---------------- background removal (plan 3.2 step 2) ----------------
    /**
     * Flood fill from every edge pixel whose colour is close to the border colours: those pixels become transparent, and the
     * pixels right next to the cut get softened (one pixel of feathering). `tolerance` 0..255 (default 40).
     */
    fun removeBackground(src: Raster, tolerance: Int = 40): Raster {
        val w = src.w; val h = src.h; val out = src.copy(); val seen = BooleanArray(w * h)
        val corners = listOf(src[0, 0], src[w - 1, 0], src[0, h - 1], src[w - 1, h - 1])
        fun near(c: Int) = ((c ushr 24) and 255) < 16 || corners.any { k -> dist(c, k) <= tolerance }
        val q = IntArray(w * h); var qh = 0; var qt = 0
        fun push(i: Int) { if (!seen[i] && near(src.px[i])) { seen[i] = true; q[qt++] = i } }
        for (x in 0 until w) { push(x); push((h - 1) * w + x) }; for (y in 0 until h) { push(y * w); push(y * w + w - 1) }
        while (qh < qt) { val i = q[qh++]; val x = i % w; val y = i / w
            if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w) }
        for (i in 0 until w * h) if (seen[i]) out.px[i] = 0
        for (i in 0 until w * h) if (!seen[i]) { val x = i % w; val y = i / w
            val edge = (x > 0 && seen[i - 1]) || (x < w - 1 && seen[i + 1]) || (y > 0 && seen[i - w]) || (y < h - 1 && seen[i + w])
            if (edge) { val c = out.px[i]; out.px[i] = ((((c ushr 24) and 255) * 2 / 3) shl 24) or (c and 0xFFFFFF) } }
        return out
    }
    private fun dist(a: Int, b: Int): Int = maxOf(kotlin.math.abs(((a shr 16) and 255) - ((b shr 16) and 255)), kotlin.math.abs(((a shr 8) and 255) - ((b shr 8) and 255)), kotlin.math.abs((a and 255) - (b and 255)))
    /** the finger brush: erase (make transparent) or restore (bring back the original) in a circle */
    fun brush(img: Raster, original: Raster, cx: Float, cy: Float, r: Float, erase: Boolean) {
        val x0 = maxOf(0, (cx - r).toInt()); val x1 = minOf(img.w - 1, (cx + r).toInt()); val y0 = maxOf(0, (cy - r).toInt()); val y1 = minOf(img.h - 1, (cy + r).toInt())
        for (y in y0..y1) for (x in x0..x1) { val dx = x + 0.5f - cx; val dy = y + 0.5f - cy; if (dx * dx + dy * dy > r * r) continue
            img.px[y * img.w + x] = if (erase) 0 else original.px[y * original.w + x] }
    }
    /** does the picture already have a transparent background? (most of the border see-through) */
    fun transparentBorder(r: Raster): Boolean {
        var n = 0; var t = 0
        for (x in 0 until r.w) { n += 2; if (r.alpha(x, 0) < 24) t++; if (r.alpha(x, r.h - 1) < 24) t++ }
        for (y in 0 until r.h) { n += 2; if (r.alpha(0, y) < 24) t++; if (r.alpha(r.w - 1, y) < 24) t++ }
        return t >= n * 0.7
    }
}

/** a lossless PNG writer (RGBA, 8 bit) — pure Kotlin so the same bytes come out on the phone and in tests */
object Png {
    fun encode(r: Raster): ByteArray {
        val raw = ByteArray((r.w * 4 + 1) * r.h); var o = 0
        for (y in 0 until r.h) { raw[o++] = 1   /* filter: Sub */
            var pa = 0; var pr = 0; var pg = 0; var pb = 0
            for (x in 0 until r.w) { val c = r.px[y * r.w + x]; val a = (c ushr 24) and 255; val rr = (c shr 16) and 255; val g = (c shr 8) and 255; val b = c and 255
                raw[o++] = (rr - pr).toByte(); raw[o++] = (g - pg).toByte(); raw[o++] = (b - pb).toByte(); raw[o++] = (a - pa).toByte(); pa = a; pr = rr; pg = g; pb = b } }
        val def = Deflater(6); def.setInput(raw); def.finish(); val z = ByteArrayOutputStream(); val buf = ByteArray(65536)
        while (!def.finished()) { val n = def.deflate(buf); z.write(buf, 0, n) }; def.end()
        val out = ByteArrayOutputStream(); out.write(SIG)
        chunk(out, "IHDR", ByteArrayOutputStream().apply { int(this, r.w); int(this, r.h); write(8); write(6); write(0); write(0); write(0) }.toByteArray())
        chunk(out, "IDAT", z.toByteArray()); chunk(out, "IEND", ByteArray(0))
        return out.toByteArray()
    }
    val SIG = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
    fun int(o: ByteArrayOutputStream, v: Int) { o.write(v ushr 24); o.write(v ushr 16); o.write(v ushr 8); o.write(v) }
    fun chunk(o: ByteArrayOutputStream, type: String, data: ByteArray) {
        int(o, data.size); val t = type.toByteArray(Charsets.US_ASCII); o.write(t); o.write(data)
        val crc = CRC32(); crc.update(t); crc.update(data); int(o, crc.value.toInt())
    }
}

/** reads only the header to know a picture's size before decoding it (so a huge file is refused without using memory) */
object ImageSize {
    fun of(b: ByteArray): Pair<Int, Int>? = runCatching {
        fun u16be(i: Int) = ((b[i].toInt() and 255) shl 8) or (b[i + 1].toInt() and 255)
        fun u16le(i: Int) = (b[i].toInt() and 255) or ((b[i + 1].toInt() and 255) shl 8)
        fun u24le(i: Int) = u16le(i) or ((b[i + 2].toInt() and 255) shl 16)
        fun u32be(i: Int) = (u16be(i) shl 16) or u16be(i + 2)
        when (Sniff.kind(b)) {
            "png" -> u32be(16) to u32be(20)
            "gif" -> u16le(6) to u16le(8)
            "webp" -> when (String(b, 12, 4, Charsets.US_ASCII)) {
                "VP8X" -> (u24le(24) + 1) to (u24le(27) + 1)
                "VP8L" -> { val v = (b[21].toInt() and 255) or ((b[22].toInt() and 255) shl 8) or ((b[23].toInt() and 255) shl 16) or ((b[24].toInt() and 255) shl 24); ((v and 0x3FFF) + 1) to (((v ushr 14) and 0x3FFF) + 1) }
                else -> (u16le(26) and 0x3FFF) to (u16le(28) and 0x3FFF)
            }
            "jpeg" -> { var i = 2; var r: Pair<Int, Int>? = null
                while (i + 9 < b.size && r == null) { if (b[i].toInt() and 255 != 0xFF) { i++; continue }; val m = b[i + 1].toInt() and 255
                    if (m in 0xC0..0xCF && m != 0xC4 && m != 0xC8 && m != 0xCC) r = u16be(i + 7) to u16be(i + 5) else i += 2 + u16be(i + 2) }
                r }
            else -> null
        }
    }.getOrNull()
}

/** what a file is, from its first bytes (never from its name) */
object Sniff {
    fun kind(b: ByteArray): String? {
        fun at(i: Int, s: String) = b.size >= i + s.length && s.indices.all { b[i + it] == s[it].code.toByte() }
        return when {
            b.size >= 8 && b.copyOf(8).contentEquals(Png.SIG) -> "png"
            at(0, "GIF8") -> "gif"
            at(0, "RIFF") && at(8, "WEBP") -> "webp"
            b.size > 3 && b[0] == 0xFF.toByte() && b[1] == 0xD8.toByte() -> "jpeg"
            at(0, "PK\u0003\u0004") -> "zip"
            b.isNotEmpty() && (b[0] == '{'.code.toByte() || b[0] == '['.code.toByte()) -> "json"
            else -> null
        }
    }
}
