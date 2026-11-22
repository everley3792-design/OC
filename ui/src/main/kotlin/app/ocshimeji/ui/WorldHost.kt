package app.ocshimeji.ui

import app.ocshimeji.save.SaveSystem
import app.ocshimeji.save.World
import app.ocshimeji.sim.life.AwaySummary
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.SimEvent
import kotlin.math.max

/**
 * One simulation per world, however many are watching it (plan 2.3: the home screen, the desktop pets and the catch-up are all
 * viewers). The home screen and the desktop service in the same process share an `Open` world: whoever shows it drives the clock
 * (the screen while it is visible, otherwise the desktop), events go to every listener, and the world is saved by one owner.
 */
class WorldHost(val saves: SaveSystem, val now: () -> Long, val realMinute: () -> Double) {
    class Open(val slotId: String, var world: World, val sim: LifeSim) {
        var users = 0
        /** the home screen is visible: it drives the clock, the desktop only watches */
        var screenActive = false
        var playT = 0f; var saveT = 0f
        val listeners = ArrayList<(SimEvent) -> Unit>()
    }
    private val worlds = HashMap<String, Open>()
    fun get(slotId: String): Open? = worlds[slotId]
    val openWorlds: Collection<Open> get() = worlds.values

    /** open a world (or share the one already open); an M0 world gets a house first. Problems throw with a reason. */
    fun acquire(slotId: String): Open {
        worlds[slotId]?.let { it.users++; return it }
        val w0 = saves.loadWorld(slotId) ?: throw IllegalArgumentException("找不到這個存檔")
        val w = if (w0.life == null) saves.upgradeM0(slotId, w0, realMinute()) else w0
        app.ocshimeji.save.Studio(saves).syncWorld(w.life!!)   /* what the player made (food, gifts, tags, scripts) comes into the world */
        return Open(slotId, w, LifeSim(w.life!!)).also { it.users = 1; worlds[slotId] = it }
    }
    /**
     * R4: change a world without going into it (the title screen's 「編輯世界／編輯角色」). An open world is changed in place;
     * a closed one is loaded, changed and written back as it was — its clock is not touched, so the time away is still caught up later.
     * A backup is made first. Returns the reason when the change is refused.
     */
    fun edit(slotId: String, f: (LifeSim) -> String?): String? {
        worlds[slotId]?.let { o -> saves.backupNow(slotId); val r = f(o.sim); if (r == null) save(o); return r }
        val w = saves.loadWorld(slotId) ?: return "找不到這個存檔"; val life = w.life ?: return "這個存檔要先打開一次"
        saves.backupNow(slotId)
        val sim = LifeSim(life); val r = f(sim); if (r != null) return r
        saves.saveWorld(slotId, w.copy(life = sim.life, clockMode = sim.life.clockMode)); return null
    }
    fun release(slotId: String) { val o = worlds[slotId] ?: return; o.users--; save(o); if (o.users <= 0) worlds.remove(slotId) }

    /** how far the world is behind (real time since it was last driven; time away runs at 1×); ≥ 60 game minutes = a summary */
    fun catchUp(o: Open): AwaySummary? {
        val life = o.sim.life; val nowMs = now()
        var target = life.minute + max(0.0, (nowMs - life.lastRealMs) / 60000.0)
        if (life.clockMode == "REAL") target = max(target, realMinute())
        life.lastRealMs = nowMs
        if (target - life.minute < 1) return null
        val big = target - life.minute >= 60
        val s = o.sim.catchUp(target, summarize = big); save(o)
        return if (big) s else null
    }
    /** advance by real seconds; `who` = "screen" or "desk" (the desk only drives when the screen is not showing this world) */
    fun drive(o: Open, dt: Float, who: String) {
        if (who == "desk" && o.screenActive) return
        o.playT += dt; o.saveT += dt
        o.sim.hold = o.sim.life.clockMode == "REAL" && o.sim.life.minute > realMinute() + 1   /* R1 T1: ahead of the phone → wait for it */
        o.sim.update(dt); o.sim.life.lastRealMs = now()
        if (o.sim.events.isNotEmpty()) { val ev = ArrayList(o.sim.events); o.sim.events.clear(); for (e in ev) for (l in o.listeners.toList()) l(e) }
        if (o.saveT > 30f) save(o)
    }
    fun save(o: Open) {
        val s = o.playT.toLong(); o.playT -= s; o.saveT = 0f
        o.sim.life.lastRealMs = now()
        o.world = o.world.copy(life = o.sim.life, minute = o.sim.life.minute, clockMode = o.sim.life.clockMode)
        saves.saveWorld(o.slotId, o.world, s)
    }
}
