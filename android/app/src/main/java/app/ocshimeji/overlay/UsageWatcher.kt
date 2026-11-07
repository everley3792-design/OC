package app.ocshimeji.overlay

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import app.ocshimeji.core.pet.AppContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * App-context lines (opt-in). Uses UsageStatsManager ("Usage access", granted by the user in
 * Settings) to learn only the *package name* of the app in the foreground — never its content.
 * No AccessibilityService, no screen reading, no notification reading. Polled at most every few
 * seconds from the pet frame loop's housekeeping and only while the pets run and the screen is on.
 */
class UsageWatcher(private val ctx: Context) {
    private val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    private var lastPoll = 0L
    private var current: String? = null

    /** returns a newly foreground package (or null if unchanged / unavailable) */
    fun poll(): String? {
        val now = System.currentTimeMillis()
        if (now - lastPoll < 4000) return null
        val from = if (lastPoll == 0L) now - 60_000 else lastPoll - 1000
        lastPoll = now
        val ev = runCatching { usm.queryEvents(from, now) }.getOrNull() ?: return null
        val e = UsageEvents.Event(); var pkg: String? = null
        while (ev.hasNextEvent()) {
            ev.getNextEvent(e)
            if (e.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) pkg = e.packageName   // == ACTIVITY_RESUMED (API 29+)
        }
        if (pkg == null || pkg == current) return null
        current = pkg; return pkg
    }

    companion object {
        fun granted(ctx: Context): Boolean = runCatching {
            val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= 29) ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
            else @Suppress("DEPRECATION") ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
            mode == AppOpsManager.MODE_ALLOWED
        }.getOrDefault(false)

        /** the system "Usage access" page (the user grants or revokes it there; we cannot do it for them) */
        fun settingsIntent(ctx: Context): Intent {
            val i = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            if (Build.VERSION.SDK_INT >= 29) runCatching { i.data = Uri.parse("package:${ctx.packageName}") }
            return i
        }

        fun systemCategory(ctx: Context, pkg: String): String? = runCatching {
            AppContext.fromSystem(ctx.packageManager.getApplicationInfo(pkg, 0).category)
        }.getOrNull()

        /** launchable apps for the rule picker (visible through the <queries> launcher intent, not QUERY_ALL_PACKAGES) */
        fun launchable(ctx: Context): JSONArray {
            val pm = ctx.packageManager
            val i = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val list = runCatching { pm.queryIntentActivities(i, 0) }.getOrDefault(emptyList())
            val seen = HashSet<String>(); val out = ArrayList<JSONObject>()
            for (r in list) {
                val p = r.activityInfo?.packageName ?: continue
                if (p == ctx.packageName || !seen.add(p)) continue
                val ai: ApplicationInfo? = runCatching { pm.getApplicationInfo(p, 0) }.getOrNull()
                out += JSONObject().put("pkg", p).put("label", r.loadLabel(pm).toString()).put("sys", ai?.let { AppContext.fromSystem(it.category) } ?: JSONObject.NULL)
            }
            out.sortBy { it.optString("label") }
            return JSONArray(out)
        }

        @Suppress("unused") private fun unusedPm(pm: PackageManager) = pm
    }
}
