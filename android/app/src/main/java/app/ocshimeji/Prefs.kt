package app.ocshimeji

import android.content.Context

/**
 * Native-side copy of the few settings the shell needs *before* the WebView is ready
 * (theme → window colour, so there is never a white flash). The game owns all other
 * state in its own save (localStorage) and mirrors these values through the bridge.
 */
class Prefs(ctx: Context) {
    private val sp = ctx.getSharedPreferences("oc_prefs", Context.MODE_PRIVATE)

    /** "system" | "light" | "dark" */
    var themeMode: String
        get() = sp.getString("themeMode", "system") ?: "system"
        set(v) { sp.edit().putString("themeMode", v).apply() }

    var petScale: Float
        get() = sp.getFloat("petScale", 1f)
        set(v) { sp.edit().putFloat("petScale", v.coerceIn(0.6f, 1.6f)).apply() }

    fun effectiveDark(systemDark: Boolean): Boolean = when (themeMode) { "dark" -> true; "light" -> false; else -> systemDark }
}
