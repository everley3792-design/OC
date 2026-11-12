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
import android.net.Uri
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import app.ocshimeji.bridge.NativeBridge
import app.ocshimeji.overlay.OverlayPetService
import app.ocshimeji.web.AssetServer

class OcApp : Application() {
    // earliest hook in the process (before content providers and activities) → crashes are always recorded
    override fun attachBaseContext(base: android.content.Context) { super.attachBaseContext(base); Diagnostics.install(base) }
}

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
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.Theme_OC) // leave the launch (splash) theme
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        val dark = prefs.effectiveDark(isSystemDark())
        val bg = Theme.background(dark)
        window.setBackgroundDrawable(ColorDrawable(bg))

        // ---- field diagnostics before anything that can fail ----
        val fresh = intent.getBooleanExtra(EXTRA_FRESH, false)
        val crash = if (fresh) null else Diagnostics.takeRecentCrash(this)
        if (crash != null) {
            Diagnostics.show(this, "上次開啟時程式停止了", "很抱歉！下面是錯誤紀錄。可以先試試「用省電模式重新開啟」；如果還是不行，請按「複製錯誤資訊」貼給開發者。", crash, { restart(false) }, { restart(true) })
            return
        }
        if (Build.VERSION.SDK_INT >= 26 && runCatching { WebView.getCurrentWebViewPackage() }.getOrNull() == null) {
            Diagnostics.show(this, "找不到系統 WebView", "這個遊戲需要手機內建的「Android System WebView」才能顯示畫面，但目前找不到或已被停用。請到系統設定的應用程式清單啟用它，或從商店安裝後再開啟。", "", { restart(false) }, null, "前往安裝 WebView" to { Diagnostics.openWebViewStore(this) })
            return
        }
        val major = Diagnostics.webViewMajor()
        if (major in 1 until MIN_WEBVIEW && !intent.getBooleanExtra(EXTRA_IGNORE_OLD, false)) {
            Diagnostics.show(this, "系統 WebView 版本太舊", "遊戲需要 WebView $MIN_WEBVIEW 以上，這支手機目前是 $major。請更新「Android System WebView」（或 Chrome）後再開啟。", "", null, null, "前往更新 WebView" to { Diagnostics.openWebViewStore(this) })
            return
        }
        setupEdgeToEdge()
        applySystemBars(dark)

        val debuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        try {
            WebView.setWebContentsDebuggingEnabled(debuggable)
            web = WebView(this)
        } catch (t: Throwable) {
            Diagnostics.show(this, "無法建立遊戲畫面", "系統的 WebView 元件無法啟動。請確認「Android System WebView」已更新並啟用，然後重新開啟。", Diagnostics.stack(t), { restart(false) }, null)
            return
        }
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
        web.webViewClient = AssetServer(this, object : AssetServer.Listener {
            override fun onRendererGone(crashed: Boolean) = rendererGone(crashed)
            override fun onMainFrameError(detail: String) = runOnUiThread { failWeb("無法載入遊戲", "遊戲檔案沒有正確載入。", detail) }
        })
        web.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                Log.println(if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.ERROR else Log.DEBUG, "OCWeb", "${m.message()} (${m.sourceId()}:${m.lineNumber()})")
                return true
            }
            // <input type=file> (image import / save import) → system document picker
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null); fileCallback = cb
                // accept may be "image/*,.gif,.zip,.ocpack" — map to MIME types the system picker understands
                val accept = params.acceptTypes.flatMap { it.split(',') }.map { it.trim().lowercase() }.filter { it.isNotEmpty() }
                val mimes = LinkedHashSet<String>()
                for (a in accept) when {
                    a.contains('/') -> mimes.add(a)
                    a == ".png" || a == ".gif" || a == ".webp" || a == ".jpg" || a == ".jpeg" || a == ".apng" -> mimes.add("image/*")
                    a == ".zip" || a == ".ocpack" -> { mimes.add("application/zip"); mimes.add("application/octet-stream"); mimes.add("application/x-zip-compressed") }
                    a == ".json" -> { mimes.add("application/json"); mimes.add("text/plain") }
                }
                val i = Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE)
                if (mimes.size == 1) i.type = mimes.first() else { i.type = "*/*"; if (mimes.isNotEmpty()) i.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toTypedArray()) }
                if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                return runCatching { startActivityForResult(Intent.createChooser(i, null), REQ_FILE); true }.getOrElse { fileCallback = null; false }
            }
        }
        web.addJavascriptInterface(NativeBridge(this), "OCNative")
        setContentView(web)
        web.setOnApplyWindowInsetsListener { v, wi -> updateInsets(wi); v.onApplyWindowInsets(wi) }
        val restored = if (savedInstanceState != null && !fresh) web.restoreState(savedInstanceState) else null
        if (restored == null) web.loadUrl(AssetServer.START_URL + if (intent.getBooleanExtra(EXTRA_SAFE, false)) "?safe=1" else "")
    }

    // ---------------- failure handling ----------------
    /** the WebView renderer died (GPU/WebGL or memory). Returning true keeps OUR process alive. */
    private fun rendererGone(crashed: Boolean): Boolean {
        val reason = if (crashed) "畫面引擎（WebView renderer）當掉了" else "系統為了釋放記憶體關閉了畫面引擎"
        failWeb("遊戲畫面停止了", "$reason。這通常和手機的顯示晶片或記憶體有關，請試試「用省電模式重新開啟」。", "onRenderProcessGone didCrash=$crashed")
        return true
    }
    private var failed = false
    fun failWeb(title: String, message: String, detail: String) {
        if (failed) return; failed = true
        if (::web.isInitialized) { runCatching { (web.parent as? android.view.ViewGroup)?.removeView(web); web.destroy() } }
        Diagnostics.show(this, title, message, detail, { restart(false) }, { restart(true) })
    }
    /** relaunch the activity cleanly (optionally in low-power mode) */
    fun restart(safe: Boolean) {
        val i = Intent(this, MainActivity::class.java).putExtra(EXTRA_FRESH, true).putExtra(EXTRA_SAFE, safe).putExtra(EXTRA_IGNORE_OLD, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        startActivity(i); finish()
    }

    // ---------------- system UI ----------------
    private fun setupEdgeToEdge() = runCatching { edgeToEdge() }.onFailure { android.util.Log.w("OCDiag", "edge-to-edge", it) }
    private fun edgeToEdge() {
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
        // Cosmetic only — must never take the app down. NOTE: Window.getInsetsController() dereferences
        // the DecorView without a null check and throws before setContentView (0.2.1 crash on Android 15);
        // window.decorView creates the DecorView first, and its controller works before attachment.
        if (Build.VERSION.SDK_INT >= 30) runCatching {
            val mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.decorView.windowInsetsController?.setSystemBarsAppearance(if (dark) 0 else mask, mask)
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
    override fun onPause() { js("window.OCApp&&OCApp.lifecycle('pause')"); if (::web.isInitialized) web.onPause(); super.onPause() }
    override fun onResume() {
        super.onResume(); if (!::web.isInitialized) return
        web.onResume(); js("window.OCApp&&OCApp.lifecycle('resume')")
        if (pendingPetStart && OverlayPetService.canDrawOverlays(this)) { pendingPetStart = false; startPet() }
        js("window.OCApp&&OCApp.onPetState(${OverlayPetService.running},${OverlayPetService.canDrawOverlays(this)})")
        if (!routedLaunch) { routedLaunch = true; web.postDelayed({ routeIntent(intent) }, 1500) }   // after the game booted
    }
    private var routedLaunch = false
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); if (::web.isInitialized && !failed) web.saveState(outState) }
    override fun onDestroy() { if (::web.isInitialized && !failed) web.destroy(); super.onDestroy() }

    @Deprecated("Back is routed to the web UI first (closes sheets/pages), then the system.")
    override fun onBackPressed() {
        if (!::web.isInitialized || failed) { @Suppress("DEPRECATION") super.onBackPressed(); return }
        web.evaluateJavascript("(window.OCApp&&OCApp.back())?'1':'0'") { r ->
            if (r?.contains("1") != true) @Suppress("DEPRECATION") super.onBackPressed()
        }
    }

    // ---------------- floating pet ----------------
    fun startPet() {
        if (!OverlayPetService.canDrawOverlays(this)) { pendingPetStart = true; startActivity(OverlayPetService.permissionIntent(this)); return }
        // the pet works without it, but its pause / stop controls live in the notification (Android 13+ asks once)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED && !prefs.askedNotif) {
            prefs.askedNotif = true; requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIF)
        }
        val ok = OverlayPetService.start(this)
        js("window.OCApp&&OCApp.onPetState(${ok},true)")
    }
    fun stopPet() { OverlayPetService.stop(this); js("window.OCApp&&OCApp.onPetState(false,${OverlayPetService.canDrawOverlays(this)})") }

    /** permission requests only happen when the player uses the feature (pet center buttons) */
    fun requestPermissionFor(kind: String) {
        runCatching {
            when (kind) {
                "overlay" -> startActivity(OverlayPetService.permissionIntent(this))
                "notifications" -> if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) && prefs.askedNotif) openAppNotificationSettings()
                    else if (Build.VERSION.SDK_INT >= 33) { prefs.askedNotif = true; requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIF) } else openAppNotificationSettings()
                "notificationSettings" -> openAppNotificationSettings()
                "usage" -> startActivity(app.ocshimeji.overlay.UsageWatcher.settingsIntent(this))
                "exactAlarm" -> if (Build.VERSION.SDK_INT >= 31) startActivity(Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName")))
            }
        }.onFailure { js("window.OCApp&&OCApp.onPermission&&OCApp.onPermission('$kind','unavailable')") }
    }
    private fun openAppNotificationSettings() = startActivity(Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, packageName))

    @Deprecated("plain Activity API")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        if (requestCode == REQ_NOTIF) js("window.OCApp&&OCApp.onPermission&&OCApp.onPermission('notifications','${if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) "granted" else "denied"}')")
    }

    /** notification / widget / pet double-tap → open a page in the game */
    private fun routeIntent(i: Intent?) {
        val page = i?.getStringExtra(EXTRA_PAGE) ?: return
        js("window.OCApp&&OCApp.openPage&&OCApp.openPage('${page.replace(Regex("[^a-z0-9_]"), "")}')")
        // widget "放出桌寵": the game exports the current look first, then starts the service (same path as the button)
        if (i.getBooleanExtra(EXTRA_START_PET, false)) { i.removeExtra(EXTRA_START_PET); js("window.OCApp&&OCApp.startPets&&OCApp.startPets()") }
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); routeIntent(intent) }

    fun js(code: String) { if (::web.isInitialized && !failed) runOnUiThread { web.evaluateJavascript(code, null) } }

    @Deprecated("startActivityForResult is the API available on the plain Activity base class.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQ_FILE) {
            val uris = ArrayList<Uri>()
            if (resultCode == RESULT_OK && data != null) {
                val clip = data.clipData
                if (clip != null) for (k in 0 until clip.itemCount) clip.getItemAt(k).uri?.let { uris.add(it) }
                else data.data?.let { uris.add(it) }
            }
            fileCallback?.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null); fileCallback = null; return
        }
        @Suppress("DEPRECATION") super.onActivityResult(requestCode, resultCode, data)
    }

    /** share any generated file (character pack, PNG, sprite sheet) through the system share sheet */
    fun shareFile(name: String, mime: String, bytes: ByteArray) {
        val dir = java.io.File(cacheDir, "share").apply { mkdirs() }
        dir.listFiles()?.forEach { if (System.currentTimeMillis() - it.lastModified() > 3_600_000L) it.delete() }   // tidy old shares
        val f = java.io.File(dir, name.replace(Regex("[^A-Za-z0-9._\\-\\u4e00-\\u9fff]"), "_")); f.writeBytes(bytes)
        val uri = app.ocshimeji.web.ShareProvider.uriFor(this, f)
        val send = Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startActivity(Intent.createChooser(send, "分享"))
    }

    /** share the save JSON as a file through the system share sheet (no storage permission needed) */
    fun shareSave(json: String, name: String) {
        val dir = java.io.File(cacheDir, "share").apply { mkdirs() }
        val f = java.io.File(dir, name.replace(Regex("[^A-Za-z0-9._-]"), "_")); f.writeText(json)
        val uri = app.ocshimeji.web.ShareProvider.uriFor(this, f)
        val send = Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startActivity(Intent.createChooser(send, "匯出存檔"))
    }

    companion object {
        private const val REQ_NOTIF = 2; private const val REQ_FILE = 3
        const val EXTRA_PAGE = "page"; const val EXTRA_START_PET = "startPet"
        private const val EXTRA_FRESH = "fresh"; private const val EXTRA_SAFE = "safe"; private const val EXTRA_IGNORE_OLD = "ignoreOldWebView"
        /** the game uses ??, replaceChildren, CSS aspect-ratio / inset → Chromium 88+ */
        const val MIN_WEBVIEW = 88
    }
}

/** Colours used before the web layer paints (must match game/css tokens --bg). */
object Theme {
    fun background(dark: Boolean): Int = if (dark) 0xFF1F2B33.toInt() else 0xFFF7F1DE.toInt()
}
