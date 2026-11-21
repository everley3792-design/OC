package app.ocshimeji.tools

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import app.ocshimeji.MainActivity
import app.ocshimeji.R
import app.ocshimeji.core.pet.ForecastPlan
import app.ocshimeji.overlay.PetFiles
import app.ocshimeji.widget.PetWidget
import org.json.JSONArray
import org.json.JSONObject

/**
 * 17.1 — the island forecast, scheduled while the app is closed.
 *
 * The game writes it when it goes to the background (OCNative.forecastSet): a dry run of the next 24 hours of its own simulation,
 * { at, items: [{ id, at, kind, title, text }], doing: { oc: [{ at, text }] } }. This object only:
 *  - schedules the items as notifications (channel "island"; inexact `setAndAllowWhileIdle`, no special permission; a missed one is
 *    dropped, never shown late — ForecastPlan.upcoming);
 *  - refreshes the widget when the forecast's line for its character changes (ForecastPlan.nextChange / lineAt);
 *  - forgets all of it when the game is back (OCNative.forecastClear) — what happened is told in 「你不在的時候」.
 * Notifications are off unless the player turned them on in the game (the game sends no items then).
 */
object Forecast {
    const val CHANNEL = "island"
    private const val ACTION_FIRE = "app.ocshimeji.forecast.FIRE"
    private const val ACTION_TICK = "app.ocshimeji.forecast.TICK"
    private const val TICK_CODE = 0x0F17

    private fun file(ctx: Context) = java.io.File(PetFiles.root(ctx), "forecast.json")
    fun data(ctx: Context): JSONObject = runCatching { JSONObject(file(ctx).readText()) }.getOrElse { JSONObject() }

    private fun items(o: JSONObject): List<ForecastPlan.Item> { val a = o.optJSONArray("items") ?: JSONArray(); return (0 until a.length()).mapNotNull { a.optJSONObject(it) }.map { ForecastPlan.Item(it.optString("id"), it.optLong("at"), it.optString("title"), it.optString("text")) } }
    fun lines(o: JSONObject, oc: String): List<ForecastPlan.Line> { val a = o.optJSONObject("doing")?.optJSONArray(oc) ?: JSONArray(); return (0 until a.length()).mapNotNull { a.optJSONObject(it) }.map { ForecastPlan.Line(it.optLong("at"), it.optString("text")) } }

    private fun pi(ctx: Context, id: String) = PendingIntent.getBroadcast(ctx, ("fc:" + id).hashCode(), Intent(ctx, ForecastReceiver::class.java).setAction(ACTION_FIRE).putExtra("id", id), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    private fun tickPi(ctx: Context) = PendingIntent.getBroadcast(ctx, TICK_CODE, Intent(ctx, ForecastReceiver::class.java).setAction(ACTION_TICK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    private fun am(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    fun set(ctx: Context, json: String): Boolean = runCatching {
        val o = JSONObject(json)
        cancelAlarms(ctx)
        PetFiles.atomic(file(ctx), o.toString())
        arm(ctx, o)
        PetWidget.refresh(ctx); true
    }.getOrDefault(false)

    fun clear(ctx: Context) { cancelAlarms(ctx); runCatching { file(ctx).delete() }; PetWidget.refresh(ctx) }

    private fun cancelAlarms(ctx: Context) {
        val old = data(ctx); for (it in items(old)) runCatching { am(ctx).cancel(pi(ctx, it.id)) }
        runCatching { am(ctx).cancel(tickPi(ctx)) }
    }

    private fun arm(ctx: Context, o: JSONObject) {
        val now = System.currentTimeMillis()
        for (it in ForecastPlan.upcoming(items(o), now)) runCatching { am(ctx).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, it.at, pi(ctx, it.id)) }
        armTick(ctx, o, now)
    }
    /** the next moment the widget's character changes what it is doing */
    private fun armTick(ctx: Context, o: JSONObject, now: Long) {
        val oc = PetWidget.data(ctx).optString("oc"); if (oc.isEmpty()) return
        val next = ForecastPlan.nextChange(lines(o, oc), now) ?: return
        runCatching { am(ctx).set(AlarmManager.RTC, next + 1000, tickPi(ctx)) }   // not a wake-up: the widget only needs it when the screen is on
    }

    /** the widget's line now, or null (the game's own line is newer, or there is no forecast) */
    fun widgetLine(ctx: Context, oc: String, writtenAt: Long): String? =
        if (oc.isEmpty()) null else ForecastPlan.lineAt(lines(data(ctx), oc), System.currentTimeMillis(), writtenAt)

    internal fun fire(ctx: Context, id: String) {
        val it = items(data(ctx)).firstOrNull { x -> x.id == id } ?: return
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel(CHANNEL, ctx.getString(R.string.island_channel), NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(ctx, 30, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = Notification.Builder(ctx, CHANNEL).setSmallIcon(R.drawable.ic_stat_pet).setContentTitle(it.title.ifEmpty { ctx.getString(R.string.app_name) }).setContentText(it.text)
            .setStyle(Notification.BigTextStyle().bigText(it.text)).setContentIntent(open).setAutoCancel(true).setCategory(Notification.CATEGORY_EVENT).build()
        runCatching { nm.notify(("fc:" + id).hashCode(), n) }   // without POST_NOTIFICATIONS (Android 13+) this is dropped; the game asks for it when the player turns this on
        PetWidget.refresh(ctx)
    }
    internal fun tick(ctx: Context) { PetWidget.refresh(ctx); armTick(ctx, data(ctx), System.currentTimeMillis()) }
    /** after a reboot: whatever is still ahead */
    fun rearm(ctx: Context) { val o = data(ctx); if (o.length() > 0) arm(ctx, o) }
}

class ForecastReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, i: Intent) {
        when (i.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> Forecast.rearm(ctx)
            "app.ocshimeji.forecast.TICK" -> Forecast.tick(ctx)
            else -> i.getStringExtra("id")?.let { Forecast.fire(ctx, it) }
        }
    }
}
