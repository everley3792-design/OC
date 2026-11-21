package app.ocshimeji.android

import android.content.Context
import app.ocshimeji.save.FileStorage
import app.ocshimeji.save.SaveSystem
import app.ocshimeji.ui.WorldHost

/**
 * One per process: the save system, the decoded pictures and the open worlds are shared by the app screen and the desktop service,
 * so both watch the same simulation (plan 2.3) and never load a world twice.
 */
object OcRuntime {
    @Volatile private var inited = false
    lateinit var saves: SaveSystem; private set
    lateinit var assets: AndroidAssets; private set
    lateinit var host: WorldHost; private set
    lateinit var sounds: Sounds; private set
    fun init(ctx: Context) {
        if (inited) return
        synchronized(this) {
            if (inited) return
            val app = ctx.applicationContext
            saves = SaveSystem(FileStorage(app.filesDir)); assets = AndroidAssets(app.assets); sounds = Sounds()
            host = WorldHost(saves, { System.currentTimeMillis() }, { val now = System.currentTimeMillis(); (now + java.util.TimeZone.getDefault().getOffset(now)) / 60000.0 })
            inited = true
        }
    }
}
