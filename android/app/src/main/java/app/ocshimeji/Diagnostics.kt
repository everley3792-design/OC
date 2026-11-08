package app.ocshimeji

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Field diagnostics (no adb needed):
 *  - [install] records any uncaught crash to filesDir/crash.txt (installed in
 *    Application.attachBaseContext, i.e. before content providers and activities start);
 *  - [show] renders a plain native error screen — independent of the WebView — with the
 *    full error text and buttons to copy / share it, retry, or retry in low-power mode.
 */
object Diagnostics {
    private const val TAG = "OCDiag"
    private const val FILE = "crash.txt"

    fun install(ctx: Context) {
        val app = ctx.applicationContext ?: ctx
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, e ->
            runCatching { File(app.filesDir, FILE).writeText(report(app, "程式發生錯誤（${thread.name}）", stack(e))) }
            Log.e(TAG, "uncaught", e)
            previous?.uncaughtException(thread, e)
        }
    }

    /** a crash recorded in the last 15 minutes, consumed once */
    fun takeRecentCrash(ctx: Context): String? {
        val f = File(ctx.filesDir, FILE)
        if (!f.exists()) return null
        val text = runCatching { f.readText() }.getOrNull()
        val recent = System.currentTimeMillis() - f.lastModified() < 15 * 60 * 1000L
        f.delete()
        return if (recent) text else null
    }

    fun stack(e: Throwable): String { val sw = StringWriter(); e.printStackTrace(PrintWriter(sw)); return sw.toString() }

    fun webViewVersion(): String = if (Build.VERSION.SDK_INT >= 26) {
        val p = runCatching { WebView.getCurrentWebViewPackage() }.getOrNull()
        if (p == null) "（找不到 WebView）" else "${p.packageName} ${p.versionName}"
    } else "?"

    /** major Chromium version of the system WebView, or -1 if unknown / missing */
    fun webViewMajor(): Int = if (Build.VERSION.SDK_INT >= 26) {
        runCatching { WebView.getCurrentWebViewPackage()?.versionName?.substringBefore('.')?.toInt() ?: -1 }.getOrDefault(-1)
    } else -1

    fun report(ctx: Context, title: String, detail: String): String = buildString {
        append(title).append('\n')
        append("App ").append(BuildInfo.VERSION_NAME).append(" (").append(BuildInfo.VERSION_CODE).append(")\n")
        append("Android ").append(Build.VERSION.RELEASE).append(" (API ").append(Build.VERSION.SDK_INT).append(")\n")
        append("裝置 ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL).append('\n')
        append("WebView ").append(webViewVersion()).append("\n\n")
        append(detail)
    }

    /**
     * Replace the activity's content with an error screen.
     * [onRetry] restarts normally, [onSafe] restarts in low-power mode (may be null).
     */
    fun show(act: Activity, title: String, message: String, detail: String, onRetry: (() -> Unit)?, onSafe: (() -> Unit)?, extra: Pair<String, () -> Unit>? = null) {
        val full = report(act, title, detail)
        Log.e(TAG, full)
        val d = act.resources.displayMetrics.density
        fun px(v: Int) = (v * d).toInt()
        val ink = Color.parseColor("#3F3B5E"); val bg = Color.parseColor("#F6F4FC")
        val root = LinearLayout(act).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(bg); setPadding(px(20), px(48), px(20), px(24)) }
        root.addView(TextView(act).apply { text = title; textSize = 20f; setTextColor(ink); typeface = Typeface.DEFAULT_BOLD })
        root.addView(TextView(act).apply { text = message; textSize = 15f; setTextColor(ink); setPadding(0, px(8), 0, px(12)) })
        val detailView = TextView(act).apply { text = full; textSize = 11f; typeface = Typeface.MONOSPACE; setTextColor(Color.parseColor("#5A5680")); setTextIsSelectable(true); setPadding(px(12), px(12), px(12), px(12)); setBackgroundColor(Color.parseColor("#FFF3D6")) }
        root.addView(ScrollView(act).apply { addView(detailView) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        fun button(label: String, primary: Boolean, fn: () -> Unit) = Button(act).apply {
            text = label; isAllCaps = false; textSize = 15f
            if (primary) { setBackgroundColor(Color.parseColor("#7378F0")); setTextColor(Color.WHITE) }
            setOnClickListener(View.OnClickListener { fn() })
        }
        val buttons = LinearLayout(act).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; setPadding(0, px(12), 0, 0) }
        val lp = { LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = px(6) } }
        if (extra != null) buttons.addView(button(extra.first, true) { extra.second() }, lp())
        if (onSafe != null) buttons.addView(button("用省電模式重新開啟", extra == null) { onSafe() }, lp())
        if (onRetry != null) buttons.addView(button("重新開啟", extra == null && onSafe == null) { onRetry() }, lp())
        buttons.addView(button("複製錯誤資訊", false) {
            val cm = act.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("OC Shimeji error", full))
            android.widget.Toast.makeText(act, "已複製，可以貼給開發者", android.widget.Toast.LENGTH_SHORT).show()
        }, lp())
        buttons.addView(button("分享錯誤資訊", false) {
            runCatching { act.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, full), "分享錯誤資訊")) }
        }, lp())
        root.addView(buttons)
        act.setContentView(root)
    }

    fun openWebViewStore(act: Activity) {
        val pkg = "com.google.android.webview"
        runCatching { act.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))) }
            .onFailure { runCatching { act.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkg"))) } }
    }
}
