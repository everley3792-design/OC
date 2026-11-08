package app.ocshimeji.bridge

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import android.webkit.JavascriptInterface
import app.ocshimeji.BuildInfo
import app.ocshimeji.MainActivity
import app.ocshimeji.overlay.OverlayPetService
import app.ocshimeji.overlay.PetFiles
import app.ocshimeji.overlay.UsageWatcher
import app.ocshimeji.tools.Reminders
import app.ocshimeji.widget.PetWidget
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * JS ↔ native bridge, exposed to the game as `window.OCNative`.
 * Every method is small, synchronous and safe to call from the WebView's binder thread;
 * anything touching views hops to the UI thread. The web layer feature-detects this object,
 * so the same game runs in a desktop browser (tests) without the bridge.
 *
 * Only data the game already owns crosses this bridge (its save, its rendered frames, its
 * settings). Nothing here reads other apps' content.
 */
class NativeBridge(private val act: MainActivity) {

    @JavascriptInterface fun platform(): String = "android"
    @JavascriptInterface fun appVersion(): String = "${BuildInfo.VERSION_NAME} (${BuildInfo.VERSION_CODE})"
    @JavascriptInterface fun sdkInt(): Int = Build.VERSION.SDK_INT
    /** bridge capability level: 7 = phase-7 desktop pets (multi-pet config, events, tools, widget) */
    @JavascriptInterface fun bridgeLevel(): Int = 7

    // ---- theme (UI theme only; the world's day/night is independent) ----
    @JavascriptInterface fun getThemeMode(): String = act.prefs.themeMode
    @JavascriptInterface fun isSystemDark(): Boolean = act.isSystemDark()
    @JavascriptInterface fun setThemeMode(mode: String) {
        if (mode !in setOf("system", "light", "dark")) return
        act.prefs.themeMode = mode
        val dark = act.prefs.effectiveDark(act.isSystemDark())
        act.runOnUiThread { act.applySystemBars(dark) }
    }

    // ---- layout ----
    @JavascriptInterface fun insets(): String = act.insets()

    // ---- save backup (the primary save lives in localStorage; this is a crash-safe mirror) ----
    @JavascriptInterface fun writeBackup(json: String): Boolean = runCatching {
        val dir = File(act.filesDir, "save").apply { mkdirs() }
        val tmp = File(dir, "save.json.tmp"); tmp.writeText(json); tmp.renameTo(File(dir, "save.json"))
    }.getOrDefault(false)
    @JavascriptInterface fun readBackup(): String = runCatching { File(act.filesDir, "save/save.json").readText() }.getOrDefault("")

    // ---- permissions (requested only when the player uses the feature) ----
    @JavascriptInterface fun permissions(): String = JSONObject()
        .put("sdk", Build.VERSION.SDK_INT)
        .put("overlay", OverlayPetService.canDrawOverlays(act))
        .put("notifications", if (Build.VERSION.SDK_INT < 33) "not-needed" else if (act.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) "granted" else "denied")
        .put("notificationsOn", (act.getSystemService(android.app.NotificationManager::class.java))?.areNotificationsEnabled() == true)
        .put("usage", UsageWatcher.granted(act))
        .put("exactAlarm", if (Build.VERSION.SDK_INT < 31) "not-needed" else if (Reminders.canExact(act)) "granted" else "denied")
        .put("fgsType", if (Build.VERSION.SDK_INT >= 34) "specialUse" else "none")
        .toString()
    /** overlay | notifications | usage | exactAlarm → system page / runtime dialog */
    @JavascriptInterface fun requestPermission(kind: String) = act.runOnUiThread { act.requestPermissionFor(kind) }

    // ---- desktop pets (system overlay) ----
    @JavascriptInterface fun canDrawOverlays(): Boolean = OverlayPetService.canDrawOverlays(act)
    @JavascriptInterface fun isPetRunning(): Boolean = OverlayPetService.running
    @JavascriptInterface fun startPet() = act.runOnUiThread { act.startPet() }
    @JavascriptInterface fun stopPet() = act.runOnUiThread { act.stopPet() }
    @JavascriptInterface fun petPause(paused: Boolean) = OverlayPetService.pause(paused)
    @JavascriptInterface fun petTest(oc: String, anim: String) = act.runOnUiThread { if (OverlayPetService.canDrawOverlays(act)) OverlayPetService.test(act, oc, anim) else act.requestPermissionFor("overlay") }
    @JavascriptInterface fun setPetScale(scale: Float) { act.prefs.petScale = scale }   // 0.6 compatibility (size now lives in the pet config)

    /** the whole desktop-pet configuration (pets, settings, lines, foods, relationships, app rules) */
    @JavascriptInterface fun petConfig(json: String): Boolean = PetFiles.writeConfig(act, json).also { if (it) OverlayPetService.reload() }

    /**
     * One OC's frames: {"manifest":{v:2,px,anims:{…}}, "files":{"walk_0.png":"data:image/png;base64,…",…}}.
     * Written into a temporary folder and swapped in only when complete (a failed export never leaves half a pet).
     */
    @JavascriptInterface fun petSprites(oc: String, json: String): Boolean = runCatching {
        val o = JSONObject(json); val files = o.getJSONObject("files"); val manifest = o.getJSONObject("manifest")
        require(manifest.optJSONObject("anims")?.length() ?: 0 > 0) { "no animations" }
        val dir = PetFiles.ocDir(act, oc); val tmp = File(dir.parentFile, dir.name + ".tmp").apply { deleteRecursively(); mkdirs() }
        var bytes = 0L
        for (name in files.keys()) {
            require(Regex("^[A-Za-z0-9_\\-]+\\.png$").matches(name)) { "bad file name $name" }
            val b = Base64.decode(files.getString(name).substringAfter("base64,"), Base64.DEFAULT)
            require(b.size > 8 && b[1] == 'P'.code.toByte() && b[2] == 'N'.code.toByte()) { "not a PNG: $name" }
            bytes += b.size; require(bytes < 48L * 1024 * 1024) { "export too large" }
            File(tmp, name).writeBytes(b)
        }
        File(tmp, "manifest.json").writeText(manifest.toString())
        dir.deleteRecursively(); require(tmp.renameTo(dir)) { "rename failed" }
        OverlayPetService.reload(); true
    }.getOrElse { android.util.Log.w("OCPet", "petSprites", it); false }

    /** which OCs have exported frames on this device (id → anim count) */
    @JavascriptInterface fun petSpriteIndex(): String = JSONObject().apply {
        File(PetFiles.root(act), "oc").listFiles()?.forEach { d -> runCatching { put(d.name, JSONObject(File(d, "manifest.json").readText()).getJSONObject("anims").length()) } }
    }.toString()

    /** legacy single-pet export (0.2–0.6); kept so an old game build in a cached WebView still works */
    @JavascriptInterface fun savePetSprites(json: String): Boolean = runCatching {
        val o = JSONObject(json)
        val dir = PetFiles.root(act)
        val frames = o.getJSONObject("frames"); val fps = o.optJSONObject("fps") ?: JSONObject()
        val manifest = JSONObject()
        for (anim in frames.keys()) {
            val arr = frames.getJSONArray(anim); val names = JSONArray()
            for (i in 0 until arr.length()) { val name = "${anim}_$i.png"; File(dir, name).writeBytes(Base64.decode(arr.getString(i).substringAfter("base64,"), Base64.DEFAULT)); names.put(name) }
            manifest.put(anim, JSONObject().put("fps", fps.optDouble(anim, 6.0)).put("frames", names))
        }
        File(dir, "manifest.json").writeText(manifest.toString())
        OverlayPetService.reload(); true
    }.getOrDefault(false)

    /** real service state (never guessed by the web layer) */
    @JavascriptInterface fun petStatus(): String = OverlayPetService.diagJson(act).toString()
    /** interactions that happened on the desktop, oldest first: [{id, seq, t, oc, type, data}] */
    @JavascriptInterface fun petEvents(): String = PetFiles.events(act).toString()
    @JavascriptInterface fun petAck(seq: Double) = PetFiles.ack(act, seq.toLong())
    /** management center → "clear desktop-pet data": stops the pets and removes their files and reminders */
    @JavascriptInterface fun petClearAll() = act.runOnUiThread { act.stopPet(); Reminders.cancelAll(act); PetFiles.clearAll(act); PetWidget.refresh(act) }

    // ---- app-context lines (opt-in; package names only) ----
    @JavascriptInterface fun launchableApps(): String = UsageWatcher.launchable(act).toString()

    // ---- tools ----
    @JavascriptInterface fun reminderSet(json: String): String = runCatching { Reminders.schedule(act, JSONObject(json)).toString() }.getOrDefault("")
    @JavascriptInterface fun reminderCancel(id: String) = Reminders.cancel(act, id)
    @JavascriptInterface fun reminders(): String = Reminders.all(act).toString()

    /** home-screen widget content (name, mood line, next to-do) + the avatar PNG */
    @JavascriptInterface fun widgetData(json: String, avatarDataUrl: String): Boolean = runCatching {
        val o = JSONObject(json)
        if (avatarDataUrl.startsWith("data:image/png;base64,")) { File(PetFiles.root(act), "widget_avatar.png").writeBytes(Base64.decode(avatarDataUrl.substringAfter("base64,"), Base64.DEFAULT)); o.put("avatar", "widget_avatar.png") }
        PetFiles.atomic(File(PetFiles.root(act), "widget.json"), o.toString()); PetWidget.refresh(act); true
    }.getOrDefault(false)

    /** binary files from the game (base64), e.g. .ocpack character packs, PNG, sprite sheets. Returns false if too large / invalid. */
    @JavascriptInterface fun shareFile(name: String, mime: String, base64: String): Boolean {
        val bytes = runCatching { Base64.decode(base64, Base64.DEFAULT) }.getOrNull() ?: return false
        if (bytes.size > 64 * 1024 * 1024) return false
        act.runOnUiThread { runCatching { act.shareFile(name, mime, bytes) } }
        return true
    }
    @JavascriptInterface fun shareSave(json: String, name: String) = act.runOnUiThread { runCatching { act.shareSave(json, name) } }

    /** the web boot guard reports a fatal start-up problem (old WebView, no WebGL, script error, timeout) */
    @JavascriptInterface fun bootFailed(title: String, message: String, detail: String) = act.runOnUiThread { act.failWeb(title, message, detail) }

    @JavascriptInterface fun haptic() = act.runOnUiThread { act.web.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP) }
    /** graded haptics (8.0): the system's own feedback constants, so the user's system touch-feedback setting still applies */
    @JavascriptInterface fun hapticKind(kind: String) = act.runOnUiThread {
        val H = android.view.HapticFeedbackConstants
        val c = when (kind) {
            "tick" -> H.CLOCK_TICK
            "confirm" -> if (android.os.Build.VERSION.SDK_INT >= 30) H.CONFIRM else H.VIRTUAL_KEY
            "error" -> if (android.os.Build.VERSION.SDK_INT >= 30) H.REJECT else H.LONG_PRESS
            "long", "heavy" -> H.LONG_PRESS
            else -> H.KEYBOARD_TAP
        }
        runCatching { act.web.performHapticFeedback(c) }
    }
}
