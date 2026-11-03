package app.ocshimeji.overlay

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Choreographer
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * System-level floating desktop pet (Shimeji-style).
 *
 * STATUS (Phase 1): implemented against public Android APIs, NOT yet built or verified on a
 * device — this container has no Android SDK / Google Maven access. See docs/architecture.md
 * §Floating pet for the verification checklist that must pass before calling it done.
 *
 * Design:
 *  - Foreground service (type specialUse) keeps the pet alive while other apps are open.
 *  - One small TYPE_APPLICATION_OVERLAY window that *moves* with the pet (never a full-screen
 *    window), so touches outside the pet always reach the app underneath.
 *  - Behaviour runs at 30 fps on Choreographer; drops to 10 fps when idle/asleep (battery).
 *  - Drawing is delegated to [PetView], which plays the same RigPose/FrameClip data as the game.
 */
class OverlayPetService : Service() {

    private lateinit var wm: WindowManager
    private lateinit var view: PetView
    private lateinit var lp: WindowManager.LayoutParams
    private val brain = PetBrain()
    private var lastFrameNs = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        if (!canDrawOverlays(this)) { stopSelf(); return }
        startAsForeground()
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        view = PetView(this)
        val sizePx = (96 * resources.displayMetrics.density).toInt()
        lp = WindowManager.LayoutParams(
            sizePx, sizePx,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT,
        ).apply { gravity = Gravity.TOP or Gravity.START }
        val bounds = screenBounds()
        brain.reset(bounds.first, bounds.second, sizePx)
        attachTouch()
        wm.addView(view, lp)
        Choreographer.getInstance().postFrameCallback(frame)
    }

    private val frame = object : Choreographer.FrameCallback {
        override fun doFrame(nowNs: Long) {
            val dt = if (lastFrameNs == 0L) 0f else ((nowNs - lastFrameNs) / 1e9f).coerceAtMost(0.1f)
            val interval = if (brain.isResting) 1f / 10f else 1f / 30f
            if (dt >= interval || lastFrameNs == 0L) {
                lastFrameNs = nowNs
                brain.update(dt)
                lp.x = brain.x.toInt(); lp.y = brain.y.toInt()
                if (view.isAttachedToWindow) wm.updateViewLayout(view, lp)
                view.render(brain.pose, brain.swing)
            }
            Choreographer.getInstance().postFrameCallback(this)
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun attachTouch() {
        var downX = 0f; var downY = 0f; var startX = 0f; var startY = 0f; var downT = 0L
        view.setOnTouchListener { _, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> { downX = e.rawX; downY = e.rawY; startX = brain.x; startY = brain.y; downT = e.eventTime; true }
                MotionEvent.ACTION_MOVE -> {
                    val held = e.eventTime - downT > 180 || kotlin.math.hypot(e.rawX - downX, e.rawY - downY) > 12
                    if (held) brain.drag(startX + (e.rawX - downX), startY + (e.rawY - downY))
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (brain.isDragging) brain.release() else brain.poke() // tap = reaction
                    true
                }
                else -> false
            }
        }
    }

    private fun screenBounds(): Pair<Int, Int> {
        return if (Build.VERSION.SDK_INT >= 30) {
            val b = wm.currentWindowMetrics.bounds; b.width() to b.height()
        } else {
            @Suppress("DEPRECATION") val d = resources.displayMetrics; d.widthPixels to d.heightPixels
        }
    }

    private fun startAsForeground() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CHANNEL, "桌寵", NotificationManager.IMPORTANCE_MIN))
        val n: Notification = NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle("麻糬正在陪你")
            .setSmallIcon(android.R.drawable.star_on)
            .setOngoing(true)
            .build()
        ServiceCompat.startForeground(this, 7, n, if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0)
    }

    override fun onDestroy() {
        Choreographer.getInstance().removeFrameCallback(frame)
        if (::view.isInitialized && view.isAttachedToWindow) wm.removeView(view)
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL = "pet"
        fun canDrawOverlays(ctx: Context) = Settings.canDrawOverlays(ctx)
        fun permissionIntent(ctx: Context) = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:${ctx.packageName}"))
        fun start(ctx: Context) { if (canDrawOverlays(ctx)) ctx.startForegroundService(Intent(ctx, OverlayPetService::class.java)) }
        fun stop(ctx: Context) = ctx.stopService(Intent(ctx, OverlayPetService::class.java))
    }
}
