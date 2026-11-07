package app.ocshimeji.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.view.View
import android.widget.RemoteViews
import app.ocshimeji.MainActivity
import app.ocshimeji.R
import app.ocshimeji.overlay.OverlayPetService
import app.ocshimeji.overlay.PetFiles
import app.ocshimeji.tools.Reminders
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Home-screen widget (separate from the floating pet): the OC's portrait, mood line, the next
 * to-do and the next reminder / pomodoro; buttons open the game or put the pets out / away.
 * Content comes from filesDir/pet/widget.json (written by the game) — the widget never runs the
 * simulation. Colours come from values / values-night, so it follows the system dark mode.
 */
class PetWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) { for (id in ids) mgr.updateAppWidget(id, views(ctx)) }

    companion object {
        fun refresh(ctx: Context) = runCatching {
            val mgr = AppWidgetManager.getInstance(ctx) ?: return@runCatching
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, PetWidget::class.java))
            if (ids.isNotEmpty()) { val v = views(ctx); for (id in ids) mgr.updateAppWidget(id, v) }
        }

        fun data(ctx: Context): JSONObject = runCatching { JSONObject(File(PetFiles.root(ctx), "widget.json").readText()) }.getOrElse { JSONObject() }

        private fun views(ctx: Context): RemoteViews {
            val d = data(ctx)
            val v = RemoteViews(ctx.packageName, R.layout.widget_pet)
            val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            val name = d.optString("name").ifEmpty { ctx.getString(R.string.app_name) }
            v.setTextViewText(R.id.w_name, name)
            v.setTextViewText(R.id.w_mood, d.optString("mood").ifEmpty { ctx.getString(R.string.widget_open_once) })
            val todo = d.optString("todo")
            v.setTextViewText(R.id.w_todo, if (todo.isNotEmpty()) "☐ $todo" else ctx.getString(R.string.widget_no_todo))
            // next reminder from the real AlarmManager list (not from the game's copy)
            val rs = Reminders.all(ctx); var next: JSONObject? = null
            for (i in 0 until rs.length()) rs.optJSONObject(i)?.let { if (next == null || it.optLong("at") < next!!.optLong("at")) next = it }
            val n = next
            if (n != null) { v.setViewVisibility(R.id.w_timer, View.VISIBLE); v.setTextViewText(R.id.w_timer, "⏰ " + SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(n.optLong("at"))) + " " + n.optString("title").ifEmpty { if (n.optString("kind") == "pomodoro") "番茄鐘" else "提醒" }) }
            else v.setViewVisibility(R.id.w_timer, View.GONE)
            val avatar = d.optString("avatar")
            val f = if (avatar.isNotEmpty()) File(PetFiles.root(ctx), avatar) else null
            val bmp = if (f != null && f.exists()) runCatching { BitmapFactory.decodeFile(f.path) }.getOrNull() else null
            if (bmp != null) v.setImageViewBitmap(R.id.w_avatar, bmp) else v.setImageViewResource(R.id.w_avatar, R.mipmap.ic_launcher)
            v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 20, Intent(ctx, MainActivity::class.java), flags))
            val running = OverlayPetService.running
            v.setTextViewText(R.id.w_pet, ctx.getString(if (running) R.string.widget_pet_away else R.string.widget_pet_out))
            val toggle = if (running) PendingIntent.getService(ctx, 21, Intent(ctx, OverlayPetService::class.java).setAction(OverlayPetService.ACTION_STOP), flags)
            // starting the overlay needs the permission flow → open the pet center, which starts it (user-visible, allowed)
            else PendingIntent.getActivity(ctx, 22, Intent(ctx, MainActivity::class.java).putExtra(MainActivity.EXTRA_PAGE, "petcenter").putExtra(MainActivity.EXTRA_START_PET, true), flags)
            v.setOnClickPendingIntent(R.id.w_pet, toggle)
            return v
        }
    }
}
