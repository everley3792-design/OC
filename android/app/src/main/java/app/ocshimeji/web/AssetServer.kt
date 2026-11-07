package app.ocshimeji.web

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.IOException

/**
 * Serves the bundled game from APK assets under a stable https origin
 * (https://appassets.androidplatform.net/game/…), the same scheme AndroidX WebViewAssetLoader
 * uses — implemented here with framework APIs only. Everything is local: no network or dev
 * server is needed; localStorage persists per origin across launches.
 */
class AssetServer(private val ctx: Context, private val listener: Listener? = null) : WebViewClient() {
    interface Listener { fun onRendererGone(crashed: Boolean): Boolean; fun onMainFrameError(detail: String) }

    /** Without this override a WebView renderer crash (e.g. GPU/WebGL) kills the whole app process. */
    override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean =
        listener?.onRendererGone(detail.didCrash()) ?: true

    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
        if (request.isForMainFrame) listener?.onMainFrameError("${error.errorCode} ${error.description} — ${request.url}")
    }


    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        val url = request.url
        if (url.host != HOST) return null
        val path = url.path?.trimStart('/') ?: return notFound()
        if (!path.startsWith("game/") || path.contains("..")) return notFound()
        return try {
            val stream = ctx.assets.open(path)
            WebResourceResponse(mime(path), if (isText(path)) "utf-8" else null, 200, "OK",
                headers(), stream)
        } catch (e: IOException) { notFound() }
    }

    /** Keep navigation inside the app; open any external link in the browser. */
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (request.url.host == HOST) return false
        runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, request.url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        return true
    }

    // plain java.util.HashMap: these maps are read by WebView's native code, keep Kotlin collection types out of it
    private fun headers(): MutableMap<String, String> = java.util.HashMap<String, String>().apply { put("Cache-Control", "no-cache"); put("Access-Control-Allow-Origin", "*") }
    private fun notFound() = WebResourceResponse("text/plain", "utf-8", 404, "Not Found", java.util.HashMap<String, String>(), "".byteInputStream())

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val START_URL = "https://$HOST/game/index.html"
        private val MIME = mapOf(
            "html" to "text/html", "js" to "application/javascript", "mjs" to "application/javascript", "css" to "text/css",
            "json" to "application/json", "png" to "image/png", "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "webp" to "image/webp",
            "svg" to "image/svg+xml", "woff" to "font/woff", "woff2" to "font/woff2", "otf" to "font/otf", "ttf" to "font/ttf",
            "glb" to "model/gltf-binary", "gltf" to "model/gltf+json", "mp3" to "audio/mpeg", "ogg" to "audio/ogg", "wav" to "audio/wav",
        )
        fun mime(p: String) = MIME[p.substringAfterLast('.', "").lowercase()] ?: "application/octet-stream"
        private fun isText(p: String) = mime(p).let { it.startsWith("text/") || it.contains("javascript") || it.contains("json") || it.contains("svg") }
        @Suppress("unused") fun uri(path: String): Uri = Uri.parse("https://$HOST/$path")
    }
}
