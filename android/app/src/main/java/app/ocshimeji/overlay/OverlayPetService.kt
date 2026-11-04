package app.ocshimeji.overlay

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.provider.Settings
import android.view.Choreographer
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import app.ocshimeji.MainActivity
import app.ocshimeji.Prefs
import app.ocshimeji.R
import app.ocshimeji.core.pet.PetBrain
import kotlin.math.hypot

/**
 * System-level floating desktop pet (Shimeji-style), drawn over other apps.
 *
 * Android-supported mechanism: SYSTEM_ALERT_WINDOW ("display over other apps", granted by the
 * user in Settings) + a TYPE_APPLICATION_OVERLAY window owned by a foreground service.
 * The window is only as large as the pet and moves with it, so touches elsewhere always reach
 * the app underneath. Sprite frames are the player's own OC, exported by the game (PetSprites).
 *
 * Gestures: drag = pick up (pendulum swing) → release = fall & land; tap = happy hop;
 * double-tap = open OC Shimeji; notification action = put the pet away.
 */
class OverlayPetService : Service() {

    private lateinit var wm: WindowManager
    private lateinit var view: PetView
    private lateinit var lp: WindowManager.LayoutParams
    private val brain = PetBrain(seed = (SystemClock.uptimeMillis() % 10000).toInt())
    private var lastFrameNs = 0L
    private var sizePx = 0
    private var attached = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopSelf(); return START_NOT_STICKY }
        return START_STICKY
    }

    override fun onCreate() {
        super.onCreate()
        if (!canDrawOverlays(this)) { stopSelf(); return }
        startForeground(NOTIF_ID, buildNotification())
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        view = PetView(this).apply { sprites = PetSprites.load(this@OverlayPetService) }
        sizePx = (110 * resources.displayMetrics.density * Prefs(this).petScale).toInt()
        lp = WindowManager.LayoutParams(
            sizePx, sizePx,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT,
        ).apply { gravity = Gravity.TOP or Gravity.START; title = "OC Shimeji pet" }
        val (w, h) = screen()
        brain.reset(w, h, sizePx)
        attachTouch()
        wm.addView(view, lp); attached = true
        running = true; instance = this
        Choreographer.getInstance().postFrameCallback(frame)
    }

    private val frame = object : Choreographer.FrameCallback {
        override fun doFrame(nowNs: Long) {
            if (!attached) return
            val dt = if (lastFrameNs == 0L) 0f else ((nowNs - lastFrameNs) / 1e9f)
            val interval = if (brain.isResting) 1f / 15f else 1f / 30f // battery: low fps when resting
            if (lastFrameNs == 0L || dt >= interval) {
                lastFrameNs = nowNs
                brain.update(dt.coerceAtMost(0.1f))
                lp.x = brain.x.toInt(); lp.y = brain.y.toInt()
                wm.updateViewLayout(view, lp)
                view.render(brain)
            }
            Choreographer.getInstance().postFrameCallback(this)
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun attachTouch() {
        var downX = 0f; var downY = 0f; var grabX = 0f; var grabY = 0f; var downT = 0L; var lastTap = 0L; var dragging = false
        view.setOnTouchListener { _, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> { downX = e.rawX; downY = e.rawY; grabX = e.rawX - brain.x; grabY = e.rawY - brain.y; downT = e.eventTime; dragging = false; true }
                MotionEvent.ACTION_MOVE -> {
                    if (!dragging && (hypot(e.rawX - downX, e.rawY - downY) > 10 * resources.displayMetrics.density || e.eventTime - downT > 220)) dragging = true
                    if (dragging) brain.drag(e.rawX - grabX, e.rawY - grabY)
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (dragging) brain.release()
                    else if (e.eventTime - lastTap < 320) openApp()
                    else { brain.poke(); lastTap = e.eventTime }
                    dragging = false; true
                }
                else -> false
            }
        }
    }

    private fun openApp() = startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT))

    private fun screen(): Pair<Int, Int> = if (Build.VERSION.SDK_INT >= 30) {
        val b = wm.currentWindowMetrics.bounds; b.width() to b.height()
    } else @Suppress("DEPRECATION") resources.displayMetrics.let { it.widthPixels to it.heightPixels }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (attached) { val (w, h) = screen(); brain.resize(w, h) }
    }

    private fun buildNotification(): Notification {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.pet_channel), NotificationManager.IMPORTANCE_LOW))
        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), flags)
        val stop = PendingIntent.getService(this, 1, Intent(this, OverlayPetService::class.java).setAction(ACTION_STOP), flags)
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_pet)
            .setContentTitle(getString(R.string.pet_notif_title))
            .setContentText(getString(R.string.pet_notif_text))
            .setContentIntent(open)
            .addAction(Notification.Action.Builder(null, getString(R.string.pet_stop), stop).build())
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        running = false; instance = null
        if (attached) { Choreographer.getInstance().removeFrameCallback(frame); runCatching { wm.removeView(view) }; attached = false }
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL = "pet"
        private const val NOTIF_ID = 7
        const val ACTION_STOP = "app.ocshimeji.pet.STOP"
        @Volatile var running = false; private set
        @Volatile private var instance: OverlayPetService? = null

        fun canDrawOverlays(ctx: Context) = Settings.canDrawOverlays(ctx)
        fun permissionIntent(ctx: Context) = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${ctx.packageName}"))
        fun start(ctx: Context) { if (canDrawOverlays(ctx)) ctx.startForegroundService(Intent(ctx, OverlayPetService::class.java)) }
        fun stop(ctx: Context) { ctx.stopService(Intent(ctx, OverlayPetService::class.java)) }
        /** Called after the game exported new sprite frames (e.g. the player edited their OC). */
        fun reloadSprites() { instance?.let { s -> s.view.post { s.view.sprites = PetSprites.load(s) } } }
    }
}
