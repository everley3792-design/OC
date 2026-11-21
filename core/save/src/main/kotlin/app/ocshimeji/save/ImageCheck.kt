package app.ocshimeji.save

/** what an imported picture is like (pure: the platform decodes, this looks at the pixels) */
data class ImageInfo(val w: Int, val h: Int, val transparent: Boolean, val left: Int, val top: Int, val right: Int, val bottom: Int, val footX: Float, val footY: Float)

object ImageCheck {
    /**
     * `px` = ARGB pixels. Transparent = the border is mostly see-through (a drawing on a clear background).
     * The visible box is where alpha > 24; the feet are the middle of the lowest visible rows.
     */
    fun analyze(w: Int, h: Int, px: IntArray): ImageInfo {
        require(w > 0 && h > 0 && px.size >= w * h) { "圖片是空的或壞掉了" }
        fun a(x: Int, y: Int) = (px[y * w + x] ushr 24) and 0xFF
        var clear = 0; var border = 0
        for (x in 0 until w) { border += 2; if (a(x, 0) < 16) clear++; if (a(x, h - 1) < 16) clear++ }
        for (y in 0 until h) { border += 2; if (a(0, y) < 16) clear++; if (a(w - 1, y) < 16) clear++ }
        val transparent = clear > border * 0.6
        if (!transparent) return ImageInfo(w, h, false, 0, 0, w - 1, h - 1, 0.5f, 1f)
        var l = w; var t = h; var r = -1; var b = -1
        for (y in 0 until h) for (x in 0 until w) if (a(x, y) > 24) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y }
        if (r < 0) throw IllegalArgumentException("整張圖都是透明的，看不到角色")
        /* feet: average x of visible pixels in the lowest 4% of the visible box */
        val band = maxOf(1, ((b - t) * 0.04f).toInt()); var sx = 0L; var n = 0L
        for (y in (b - band)..b) for (x in l..r) if (a(x, y) > 24) { sx += x; n++ }
        val fx = if (n > 0) sx.toFloat() / n else (l + r) / 2f
        return ImageInfo(w, h, true, l, t, r, b, ((fx - l) / maxOf(1, r - l)).coerceIn(0f, 1f), 1f)
    }
}
