package app.ocshimeji.ui.design

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Design tokens. One token set per art direction × light/dark; screens consume only
 * semantic tokens (never raw colours) so the chosen direction can be swapped in Phase 2.
 * Values below are scheme A (Mallow Mist) light/dark as reference; B and C are in
 * docs/ui-components.md and get their own objects when a direction is chosen.
 */
data class OcColors(
    val surface: Color, val surfaceRaised: Color, val ink: Color, val inkMuted: Color,
    val accent: Color, val accentOn: Color, val positive: Color, val line: Color, val scrim: Color,
)

object MallowTokens {
    val light = OcColors(Color(0xFFFFF8F2), Color(0xFFFFFDF9), Color(0xFF6E5A64), Color(0xFF9C8892), Color(0xFFF5A893), Color.White, Color(0xFF8FCAA9), Color(0xFFEFE2E6), Color(0x296E5A64))
    val dark = OcColors(Color(0xFF2A2430), Color(0xFF37303D), Color(0xFFF3E9EE), Color(0xFFB9A9B2), Color(0xFFF3A08B), Color(0xFF2A2430), Color(0xFF8FCAA9), Color(0xFF4A4050), Color(0x66000000))
}

object Spacing { val xs = 4.dp; val s = 8.dp; val m = 12.dp; val l = 16.dp; val xl = 24.dp; val gutter = 16.dp }

object Touch {
    /** Minimum hit target (Android a11y: 48dp). Visuals may be smaller; hit area never is. */
    val minTarget = 48.dp
    val hudPrimary = 46.dp   // bag button visual
    val hudSecondary = 34.dp // map / menu visuals (hit area still 48dp)
    val dragSlop = 8.dp
    const val longPressMs = 450
}

object Motion {
    const val fastMs = 160; const val baseMs = 260; const val slowMs = 420
    const val springStiffness = 380f; const val springDamping = 0.72f // ≈ prototype spring(2.2, 6)
}
