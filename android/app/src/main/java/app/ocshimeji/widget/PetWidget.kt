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
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) { for (id in ids) mgr.updateAppWidget(id, views(ctx, small(mgr, id))) }

    /** resized on the home screen → pick the layout that fits (small ≈ 2×2 cells, medium / large ≥ 3 cells wide) */
    override fun onAppWidgetOptionsChanged(ctx: Context, mgr: AppWidgetManager, id: Int, newOptions: android.os.Bundle) {
        mgr.updateAppWidget(id, views(ctx, small(mgr, id)))
    }

    companion object {
        private fun small(mgr: AppWidgetManager, id: Int): Boolean = runCatching { mgr.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250) < 180 }.getOrDefault(false)

        fun refresh(ctx: Context) = runCatching {
            val mgr = AppWidgetManager.getInstance(ctx) ?: return@runCatching
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, PetWidget::class.java))
            for (id in ids) mgr.updateAppWidget(id, views(ctx, small(mgr, id)))
        }

        fun data(ctx: Context): JSONObject = runCatching { JSONObject(File(PetFiles.root(ctx), "widget.json").readText()) }.getOrElse { JSONObject() }

        private fun bmp(ctx: Context, name: String) = File(PetFiles.root(ctx), name).takeIf { name.isNotEmpty() && it.exists() }?.let { runCatching { BitmapFactory.decodeFile(it.path) }.getOrNull() }

        private fun views(ctx: Context, small: Boolean): RemoteViews {
            val d = data(ctx)
            val v = RemoteViews(ctx.packageName, if (small) R.layout.widget_pet_small else R.layout.widget_pet)
            val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            v.setTextViewText(R.id.w_name, d.optString("name").ifEmpty { ctx.getString(R.string.app_name) })
            v.setTextViewText(R.id.w_mood, (if (small) d.optString("moodShort") else "") .ifEmpty { d.optString("mood").ifEmpty { ctx.getString(R.string.widget_open_once) } })
            // avatar: two idle frames (open eyes / blink) flipped by the launcher's ViewFlipper → a living character without waking the app
            val a1 = bmp(ctx, d.optString("avatar")); val a2 = bmp(ctx, d.optString("avatar2")) ?: a1
            if (a1 != null) v.setImageViewBitmap(R.id.w_avatar, a1) else v.setImageViewResource(R.id.w_avatar, R.mipmap.ic_launcher)
            if (a2 != null) v.setImageViewBitmap(R.id.w_avatar2, a2) else v.setImageViewResource(R.id.w_avatar2, R.mipmap.ic_launcher)
            v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 20, Intent(ctx, MainActivity::class.java), flags))
            if (small) return v
            // three key needs (the player picks which in the game; default 飽足 / 精力 / 心情)
            val needs = d.optJSONArray("needs")
            val bars = intArrayOf(R.id.w_n1, R.id.w_n2, R.id.w_n3); val labels = intArrayOf(R.id.w_n1l, R.id.w_n2l, R.id.w_n3l)
            if (needs != null && needs.length() > 0 && d.optBoolean("showNeeds", true)) {
                v.setViewVisibility(R.id.w_needs, View.VISIBLE)
                for (i in 0 until 3) { val n = needs.optJSONObject(i); if (n != null) { v.setTextViewText(labels[i], n.optString("zh")); v.setProgressBar(bars[i], 100, n.optInt("v").coerceIn(0, 100), false) } }
            } else v.setViewVisibility(R.id.w_needs, View.GONE)
            val todo = d.optString("todo")
            if (d.optBoolean("showTodo", true)) { v.setViewVisibility(R.id.w_todo, View.VISIBLE); v.setTextViewText(R.id.w_todo, if (todo.isNotEmpty()) "☐ $todo" else ctx.getString(R.string.widget_no_todo)) } else v.setViewVisibility(R.id.w_todo, View.GONE)
            // next reminder from the real AlarmManager list (not from the game's copy)
            val rs = Reminders.all(ctx); var next: JSONObject? = null
            for (i in 0 until rs.length()) rs.optJSONObject(i)?.let { if (next == null || it.optLong("at") < next!!.optLong("at")) next = it }
            val n = next
            if (n != null) { v.setViewVisibility(R.id.w_timer, View.VISIBLE); v.setTextViewText(R.id.w_timer, "⏰ " + SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(n.optLong("at"))) + " " + n.optString("title").ifEmpty { if (n.optString("kind") == "pomodoro") "番茄鐘" else "提醒" }) }
            else v.setViewVisibility(R.id.w_timer, View.GONE)
            val running = OverlayPetService.running
            v.setTextViewText(R.id.w_pet, ctx.getString(if (running) R.string.widget_pet_away else R.string.widget_pet_out))
            val toggle = if (running) PendingIntent.getService(ctx, 21, Intent(ctx, OverlayPetService::class.java).setAction(OverlayPetService.ACTION_STOP), flags)
            // starting the overlay goes through the game (exports the current look, permission flow) → opens the pet center
            else PendingIntent.getActivity(ctx, 22, Intent(ctx, MainActivity::class.java).putExtra(MainActivity.EXTRA_PAGE, "petcenter").putExtra(MainActivity.EXTRA_START_PET, true), flags)
            v.setOnClickPendingIntent(R.id.w_pet, toggle)
            return v
        }
    }
}
