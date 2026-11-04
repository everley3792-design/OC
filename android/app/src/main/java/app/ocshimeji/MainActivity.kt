package app.ocshimeji

import android.Manifest
import android.app.Activity
import android.app.Application
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import app.ocshimeji.bridge.NativeBridge
import app.ocshimeji.overlay.OverlayPetService
import app.ocshimeji.web.AssetServer

class OcApp : Application()

/**
 * Single-activity shell. The game (3D world + 2D characters + UI) runs in a WebView and is
 * served offline from APK assets by [AssetServer]. This activity owns everything native:
 * edge-to-edge insets, system-bar colours that follow the in-game theme (no white flash),
 * lifecycle → JS, back navigation → JS, and the floating-pet permission flow.
 *
 * configChanges includes uiMode/orientation/screenSize so a system dark-mode toggle never
 * recreates the activity (the game reacts live instead of reloading the world).
 */
class MainActivity : Activity() {
    lateinit var web: WebView
        private set
    lateinit var prefs: Prefs
        private set
    private var insetsCss = "0,0,0,0"
    var pendingPetStart = false

    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.Theme_OC) // leave the launch (splash) theme
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        val dark = prefs.effectiveDark(isSystemDark())
        val bg = Theme.background(dark)
        window.setBackgroundDrawable(ColorDrawable(bg))
        setupEdgeToEdge()
        applySystemBars(dark)

        val debuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        WebView.setWebContentsDebuggingEnabled(debuggable)
        web = WebView(this)
        web.setBackgroundColor(bg)
        web.overScrollMode = View.OVER_SCROLL_NEVER
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = false
            textZoom = 100 // layout is designed in dp; accessibility text scale is handled in-game
            setSupportZoom(false)
            builtInZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
            offscreenPreRaster = true
        }
        web.webViewClient = AssetServer(this)
        web.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                Log.println(if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.ERROR else Log.DEBUG, "OCWeb", "${m.message()} (${m.sourceId()}:${m.lineNumber()})")
                return true
            }
        }
        web.addJavascriptInterface(NativeBridge(this), "OCNative")
        setContentView(web)
        web.setOnApplyWindowInsetsListener { v, wi -> updateInsets(wi); v.onApplyWindowInsets(wi) }
        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(AssetServer.START_URL)
    }

    // ---------------- system UI ----------------
    private fun setupEdgeToEdge() {
        if (Build.VERSION.SDK_INT >= 30) window.setDecorFitsSystemWindows(false)
        else @Suppress("DEPRECATION") {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
        if (Build.VERSION.SDK_INT >= 28) window.attributes = window.attributes.apply { layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES }
        @Suppress("DEPRECATION") run { window.statusBarColor = Color.TRANSPARENT; window.navigationBarColor = Color.TRANSPARENT }
        if (Build.VERSION.SDK_INT >= 29) { window.isNavigationBarContrastEnforced = false; window.isStatusBarContrastEnforced = false }
    }

    /** Light theme → dark system-bar icons, dark theme → light icons. */
    fun applySystemBars(dark: Boolean) {
        val bg = Theme.background(dark)
        window.setBackgroundDrawable(ColorDrawable(bg))
        if (::web.isInitialized) web.setBackgroundColor(bg)
        if (Build.VERSION.SDK_INT >= 30) {
            val mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (dark) 0 else mask, mask)
        } else @Suppress("DEPRECATION") {
            var f = window.decorView.systemUiVisibility
            f = if (dark) f and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv() else f or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            f = if (dark) f and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv() else f or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            window.decorView.systemUiVisibility = f
        }
    }

    private fun updateInsets(wi: WindowInsets) {
        val d = resources.displayMetrics.density
        val (t, r, b, l) = if (Build.VERSION.SDK_INT >= 30) {
            val i = wi.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            listOf(i.top, i.right, i.bottom, i.left)
        } else @Suppress("DEPRECATION") listOf(wi.systemWindowInsetTop, wi.systemWindowInsetRight, wi.systemWindowInsetBottom, wi.systemWindowInsetLeft)
        insetsCss = listOf(t, r, b, l).joinToString(",") { (it / d).toString() }
        js("window.OCApp&&OCApp.setInsets($insetsCss)")
    }
    fun insets(): String = insetsCss

    fun isSystemDark(): Boolean = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val sysDark = isSystemDark()
        applySystemBars(prefs.effectiveDark(sysDark))
        js("window.OCApp&&OCApp.onSystemTheme($sysDark)")
    }

    // ---------------- lifecycle / back ----------------
    override fun onPause() { js("window.OCApp&&OCApp.lifecycle('pause')"); web.onPause(); super.onPause() }
    override fun onResume() {
        super.onResume(); web.onResume(); js("window.OCApp&&OCApp.lifecycle('resume')")
        if (pendingPetStart && OverlayPetService.canDrawOverlays(this)) { pendingPetStart = false; startPet() }
        js("window.OCApp&&OCApp.onPetState(${OverlayPetService.running},${OverlayPetService.canDrawOverlays(this)})")
    }
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); web.saveState(outState) }
    override fun onDestroy() { web.destroy(); super.onDestroy() }

    @Deprecated("Back is routed to the web UI first (closes sheets/pages), then the system.")
    override fun onBackPressed() {
        web.evaluateJavascript("(window.OCApp&&OCApp.back())?'1':'0'") { r ->
            if (r?.contains("1") != true) @Suppress("DEPRECATION") super.onBackPressed()
        }
    }

    // ---------------- floating pet ----------------
    fun startPet() {
        if (!OverlayPetService.canDrawOverlays(this)) { pendingPetStart = true; startActivity(OverlayPetService.permissionIntent(this)); return }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIF) // the pet works either way; this only shows its "stop" notification
        }
        OverlayPetService.start(this)
        js("window.OCApp&&OCApp.onPetState(true,true)")
    }
    fun stopPet() { OverlayPetService.stop(this); js("window.OCApp&&OCApp.onPetState(false,${OverlayPetService.canDrawOverlays(this)})") }

    fun js(code: String) { if (::web.isInitialized) runOnUiThread { web.evaluateJavascript(code, null) } }

    companion object { private const val REQ_NOTIF = 2 }
}

/** Colours used before the web layer paints (must match game/css tokens --bg). */
object Theme {
    fun background(dark: Boolean): Int = if (dark) 0xFF1D2130.toInt() else 0xFFFFF8E7.toInt()
}
