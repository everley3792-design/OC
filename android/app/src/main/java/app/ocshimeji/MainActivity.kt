package app.ocshimeji

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import app.ocshimeji.overlay.OverlayPetService

class OcApp : Application()

/**
 * Single-activity shell. Phase 2 structure (docs/architecture.md):
 *   WorldSurface (libGDX view, :render:world)  ← bottom layer, 2.5D world
 *   Compose HUD + screens (:ui:design, feature screens) ← overlay layer, routes touches
 * Phase 1 only exposes the overlay permission + start/stop for on-device smoke testing.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                Text("OC Shimeji · Phase 1 shell")
                Button(onClick = {
                    if (OverlayPetService.canDrawOverlays(this@MainActivity)) OverlayPetService.start(this@MainActivity)
                    else startActivity(OverlayPetService.permissionIntent(this@MainActivity))
                }) { Text("啟動桌寵（需授權懸浮視窗）") }
                Button(onClick = { OverlayPetService.stop(this@MainActivity) }) { Text("收起桌寵") }
            }
        }
    }
}
