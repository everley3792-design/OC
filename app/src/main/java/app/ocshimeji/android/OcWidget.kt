package app.ocshimeji.android

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.widget.RemoteViews
import app.ocshimeji.R
import app.ocshimeji.ui.WidgetLines

/**
 * F-13 (1.9.0): the home-screen widget. It never runs a world by itself: when a world is open in this process it reads it
 * (`WidgetLines`, pure and tested), otherwise it shows what it saw last time. Tapping it opens the app.
 */
class OcWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { push(context) }

    companion object {
        /** redraw every placed widget (called when you leave the app, and by the system every 30 minutes) */
        fun push(ctx: Context) { runCatching {
            val mgr = AppWidgetManager.getInstance(ctx); val ids = mgr.getAppWidgetIds(ComponentName(ctx, OcWidget::class.java)); if (ids.isEmpty()) return
            OcRuntime.init(ctx)
            val prefs = ctx.getSharedPreferences("oc_widget", Context.MODE_PRIVATE)
            val o = OcRuntime.host.openWorlds.firstOrNull()
            val (title, body) = if (o != null) WidgetLines.of(o.sim).also { (t, b) -> prefs.edit().putString("t", t).putString("b", b).putString("img", o.sim.life.people.firstOrNull()?.let { OcRuntime.saves.libChar(it.libId)?.image } ?: "").apply() }
                else (prefs.getString("t", null) ?: ctx.getString(R.string.app_name)) to (prefs.getString("b", null) ?: ctx.getString(R.string.widget_hint))
            val v = RemoteViews(ctx.packageName, R.layout.oc_widget)
            v.setTextViewText(R.id.oc_widget_title, title); v.setTextViewText(R.id.oc_widget_body, body)
            picture(ctx, prefs.getString("img", "") ?: "")?.let { v.setImageViewBitmap(R.id.oc_widget_img, it) }
            val open = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            v.setOnClickPendingIntent(R.id.oc_widget_root, open)
            mgr.updateAppWidget(ids, v)
        } }
        /** a resident's picture, small (a widget's bitmap must stay well under the binder limit) */
        private fun picture(ctx: Context, path: String): Bitmap? = runCatching {
            if (path.isBlank()) return null
            val bytes = if (path.startsWith("asset:")) ctx.assets.open(path.removePrefix("asset:")).use { it.readBytes() } else java.io.File(ctx.filesDir, path.removePrefix("lib:")).readBytes()
            val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeByteArray(bytes, 0, bytes.size, o)
            var s = 1; while (o.outWidth / s > 256 || o.outHeight / s > 256) s *= 2
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = s })
        }.getOrNull()
    }
}
