package app.ocshimeji.bridge

import android.util.Base64
import android.webkit.JavascriptInterface
import app.ocshimeji.BuildInfo
import app.ocshimeji.MainActivity
import app.ocshimeji.overlay.OverlayPetService
import app.ocshimeji.overlay.PetSprites
import org.json.JSONObject
import java.io.File

/**
 * JS ↔ native bridge, exposed to the game as `window.OCNative`.
 * Every method is small, synchronous and safe to call from the WebView's binder thread;
 * anything touching views hops to the UI thread. The web layer feature-detects this object,
 * so the same game runs in a desktop browser (tests) without the bridge.
 */
class NativeBridge(private val act: MainActivity) {

    @JavascriptInterface fun platform(): String = "android"
    @JavascriptInterface fun appVersion(): String = "${BuildInfo.VERSION_NAME} (${BuildInfo.VERSION_CODE})"

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

    // ---- floating pet (system overlay) ----
    @JavascriptInterface fun canDrawOverlays(): Boolean = OverlayPetService.canDrawOverlays(act)
    @JavascriptInterface fun isPetRunning(): Boolean = OverlayPetService.running
    @JavascriptInterface fun startPet() = act.runOnUiThread { act.startPet() }
    @JavascriptInterface fun stopPet() = act.runOnUiThread { act.stopPet() }
    @JavascriptInterface fun setPetScale(scale: Float) { act.prefs.petScale = scale }

    /**
     * Receives the player's OC rendered as sprite frames by the game:
     * {"fps":{"walk":8,...},"frames":{"idle":["data:image/png;base64,…",…],…}}
     * Frames are written as PNG files that the overlay service loads.
     */
    @JavascriptInterface fun savePetSprites(json: String): Boolean = runCatching {
        val o = JSONObject(json)
        val dir = PetSprites.dir(act).apply { deleteRecursively(); mkdirs() }
        val frames = o.getJSONObject("frames"); val fps = o.optJSONObject("fps") ?: JSONObject()
        val manifest = JSONObject()
        for (anim in frames.keys()) {
            val arr = frames.getJSONArray(anim); val names = org.json.JSONArray()
            for (i in 0 until arr.length()) {
                val b64 = arr.getString(i).substringAfter("base64,")
                val name = "${anim}_$i.png"
                File(dir, name).writeBytes(Base64.decode(b64, Base64.DEFAULT)); names.put(name)
            }
            manifest.put(anim, JSONObject().put("fps", fps.optDouble(anim, 6.0)).put("frames", names))
        }
        File(dir, "manifest.json").writeText(manifest.toString())
        OverlayPetService.reloadSprites()
        true
    }.getOrDefault(false)

    @JavascriptInterface fun shareSave(json: String, name: String) = act.runOnUiThread { runCatching { act.shareSave(json, name) } }

    /** the web boot guard reports a fatal start-up problem (old WebView, no WebGL, script error, timeout) */
    @JavascriptInterface fun bootFailed(title: String, message: String, detail: String) = act.runOnUiThread { act.failWeb(title, message, detail) }

    @JavascriptInterface fun haptic() = act.runOnUiThread { act.web.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP) }
}
