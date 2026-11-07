package app.ocshimeji.tools

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.app.Notification
import app.ocshimeji.MainActivity
import app.ocshimeji.R
import app.ocshimeji.overlay.OverlayPetService
import app.ocshimeji.overlay.PetFiles
import app.ocshimeji.widget.PetWidget
import org.json.JSONArray
import org.json.JSONObject

/**
 * Practical tools: pomodoro, rest reminders and alarms, scheduled with AlarmManager.
 *
 *  - inexact `setAndAllowWhileIdle` by default (no special permission; Android may delay it a few minutes in Doze);
 *  - exact `setExactAndAllowWhileIdle` only when the player turned on "準時提醒" for that reminder AND the system
 *    granted SCHEDULE_EXACT_ALARM (Android 14+ denies it by default; the user enables it in Settings);
 *  - reminders are stored in filesDir/pet/reminders.json so they survive reboots (BootReceiver re-registers them);
 *  - when one fires: a notification (channel "tools") + the desktop pet says it, if the pets are out.
 */
object Reminders {
    const val CHANNEL = "tools"
    private const val ACTION_FIRE = "app.ocshimeji.tools.FIRE"

    private fun file(ctx: Context) = java.io.File(PetFiles.root(ctx), "reminders.json")
    fun all(ctx: Context): JSONArray = runCatching { JSONArray(file(ctx).readText()) }.getOrElse { JSONArray() }
    private fun save(ctx: Context, a: JSONArray) = PetFiles.atomic(file(ctx), a.toString())

    fun canExact(ctx: Context): Boolean = Build.VERSION.SDK_INT < 31 || (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()

    /**
     * r = { id, kind: pomodoro|rest|alarm|todo, at (epoch ms), title, text, repeatMin (0 = once), exact, phase }
     * returns the stored reminder with "exactActive" telling whether it really is exact
     */
    fun schedule(ctx: Context, r: JSONObject): JSONObject {
        val id = r.optString("id").ifEmpty { "r" + System.currentTimeMillis().toString(36) }
        r.put("id", id)
        val exact = r.optBoolean("exact") && canExact(ctx)
        r.put("exactActive", exact)
        val a = all(ctx); val out = JSONArray()
        for (i in 0 until a.length()) a.optJSONObject(i)?.let { if (it.optString("id") != id) out.put(it) }
        out.put(r); save(ctx, out)
        arm(ctx, r)
        PetWidget.refresh(ctx)
        return r
    }

    private fun pi(ctx: Context, id: String): PendingIntent = PendingIntent.getBroadcast(ctx, id.hashCode(), Intent(ctx, ReminderReceiver::class.java).setAction(ACTION_FIRE).putExtra("id", id), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun arm(ctx: Context, r: JSONObject) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val at = r.optLong("at"); if (at <= 0) return
        val p = pi(ctx, r.optString("id"))
        runCatching {
            if (r.optBoolean("exactActive") && canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p)
        }
    }

    fun cancel(ctx: Context, id: String) {
        (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pi(ctx, id))
        val a = all(ctx); val out = JSONArray()
        for (i in 0 until a.length()) a.optJSONObject(i)?.let { if (it.optString("id") != id) out.put(it) }
        save(ctx, out); PetWidget.refresh(ctx)
    }

    fun cancelAll(ctx: Context) { val a = all(ctx); for (i in 0 until a.length()) a.optJSONObject(i)?.optString("id")?.let { cancel(ctx, it) } }

    /** after a reboot or an app update alarms are gone → re-register (past one-shots are dropped, repeats move forward) */
    fun rearm(ctx: Context) {
        val a = all(ctx); val now = System.currentTimeMillis(); val out = JSONArray()
        for (i in 0 until a.length()) {
            val r = a.optJSONObject(i) ?: continue
            val rep = r.optInt("repeatMin")
            if (r.optLong("at") < now) { if (rep <= 0) continue; var t = r.optLong("at"); while (t < now) t += rep * 60_000L; r.put("at", t) }
            r.put("exactActive", r.optBoolean("exact") && canExact(ctx))
            out.put(r); arm(ctx, r)
        }
        save(ctx, out)
    }

    internal fun fire(ctx: Context, id: String) {
        val a = all(ctx); var r: JSONObject? = null
        for (i in 0 until a.length()) a.optJSONObject(i)?.let { if (it.optString("id") == id) r = it }
        val rem = r ?: return
        val kind = rem.optString("kind")
        val title = rem.optString("title").ifEmpty { when (kind) { "pomodoro" -> if (rem.optString("phase") == "break") "休息結束" else "專注時間結束"; "rest" -> "休息一下"; else -> "提醒" } }
        notify(ctx, id, title, rem.optString("text"))
        OverlayPetService.announce(when (kind) { "pomodoro" -> "timer_done"; "rest" -> "rest"; else -> "remind" }, title)
        PetFiles.event(ctx, "", "tool", JSONObject().put("kind", kind).put("id", id).put("phase", rem.optString("phase")))   // the game records it (pomodoro count …)
        val rep = rem.optInt("repeatMin")
        if (rep > 0) { rem.put("at", System.currentTimeMillis() + rep * 60_000L); schedule(ctx, rem) } else cancel(ctx, id)
    }

    private fun notify(ctx: Context, id: String, title: String, text: String) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel(CHANNEL, ctx.getString(R.string.tools_channel), NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(ctx, 10, Intent(ctx, MainActivity::class.java).putExtra(MainActivity.EXTRA_PAGE, "pettools"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = Notification.Builder(ctx, CHANNEL).setSmallIcon(R.drawable.ic_stat_pet).setContentTitle(title).setContentText(text.ifEmpty { ctx.getString(R.string.app_name) })
            .setContentIntent(open).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).build()
        runCatching { nm.notify(id.hashCode(), n) }   // without POST_NOTIFICATIONS (Android 13+) this is silently dropped → the UI says so
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, i: Intent) {
        when (i.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> Reminders.rearm(ctx)
            else -> i.getStringExtra("id")?.let { Reminders.fire(ctx, it) }
        }
    }
}
