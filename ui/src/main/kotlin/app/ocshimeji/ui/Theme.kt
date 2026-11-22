package app.ocshimeji.ui

import app.ocshimeji.render.Colors.hex

/**
 * Design tokens — the only source of colours, sizes and motion (plan 6.1). One design, two palettes (day / night) with identical
 * shapes. Warm and soft: cream paper, cinnamon-brown ink (never pure black), a warm orange for things you can press, mint for
 * what is selected, a coral dot for what is new. Every pressable surface has a "lip" under it like a real button.
 */
class Theme(
    val dark: Boolean,
    val bg: Int, val skyTop: Int, val skyBottom: Int,
    val surface: Int, val surface2: Int, val lip: Int, val shadow: Int, val line: Int,
    val ink: Int, val ink2: Int, val ink3: Int,
    val accent: Int, val accentLip: Int, val onAccent: Int,
    val select: Int, val alert: Int, val onAlert: Int,
    val scrim: Int, val grass: Int, val grassLip: Int, val cloud: Int,
) {
    /** 1.9.0 O-04: a colour-blind friendly version — what is selected turns blue, what is new or dangerous a deep vermilion (told apart by lightness too) */
    fun colorSafe() = Theme(dark, bg, skyTop, skyBottom, surface, surface2, lip, shadow, line, ink, ink2, ink3, accent, accentLip, onAccent,
        select = if (dark) hex("#5E9AD6") else hex("#8DBBEA"), alert = if (dark) hex("#E0663C") else hex("#C8452A"), onAlert = onAlert, scrim = scrim, grass = grass, grassLip = grassLip, cloud = cloud)
    companion object {
        val LIGHT = Theme(false,
            bg = hex("#FFF4E4"), skyTop = hex("#CDEBFA"), skyBottom = hex("#FFF4E4"),
            surface = hex("#FFFDF7"), surface2 = hex("#F7EAD6"), lip = hex("#E6CFAE"), shadow = 0x22603A1E, line = 0x1F7A5032,
            ink = hex("#5B3A29"), ink2 = hex("#8A6A55"), ink3 = hex("#B39A85"),
            accent = hex("#F4A259"), accentLip = hex("#D9833C"), onAccent = hex("#4A2B18"),
            select = hex("#8ED1B4"), alert = hex("#F0705A"), onAlert = hex("#FFFDF7"),
            scrim = 0x663A2518, grass = hex("#BFE3A0"), grassLip = hex("#9CCB7E"), cloud = hex("#FFFFFF"))
        val DARK = Theme(true,
            bg = hex("#2A2230"), skyTop = hex("#24305A"), skyBottom = hex("#2A2230"),
            surface = hex("#3A2F42"), surface2 = hex("#463A4F"), lip = hex("#1E1824"), shadow = 0x44000000, line = 0x24FFF1E0,
            ink = hex("#FBEFE2"), ink2 = hex("#D8C5B6"), ink3 = hex("#A08D82"),
            accent = hex("#F4A259"), accentLip = hex("#B86A2C"), onAccent = hex("#3A2414"),
            select = hex("#73BF9F"), alert = hex("#F2826E"), onAlert = hex("#2A2230"),
            scrim = 0x99140E18.toInt(), grass = hex("#5E8F62"), grassLip = hex("#3F6B48"), cloud = hex("#4A4470"))
    }
}

/** sizes (dp) and motion, shared by every component */
object Dim {
    const val GUTTER = 16f
    const val RADIUS_L = 24f; const val RADIUS_M = 18f; const val RADIUS_PILL = 999f
    const val LIP = 4f
    const val TOUCH = 48f
    const val FS_TITLE = 30f; const val FS_L = 20f; const val FS_M = 16f; const val FS_S = 14f
    /** a card or menu that just appeared ignores presses this long (seconds) — against accidental taps (lesson from the old version) */
    const val GUARD = 0.3f
}
