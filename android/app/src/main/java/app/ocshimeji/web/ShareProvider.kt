package app.ocshimeji.web

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File

/**
 * Minimal read-only provider that exposes files in cacheDir/share/ to the share sheet
 * (a tiny stand-in for androidx FileProvider, which this dependency-free build avoids).
 */
class ShareProvider : ContentProvider() {
    override fun onCreate() = true
    private fun file(uri: Uri): File? {
        val ctx = context ?: return null
        val f = File(File(ctx.cacheDir, "share"), uri.lastPathSegment ?: return null)
        return if (f.canonicalPath.startsWith(File(ctx.cacheDir, "share").canonicalPath)) f else null
    }
    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor? = file(uri)?.let { ParcelFileDescriptor.open(it, ParcelFileDescriptor.MODE_READ_ONLY) }
    override fun getType(uri: Uri) = "application/json"
    override fun query(uri: Uri, projection: Array<out String>?, s: String?, a: Array<out String>?, o: String?): Cursor? {
        val f = file(uri) ?: return null
        return MatrixCursor(arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)).apply { addRow(arrayOf<Any>(f.name, f.length())) }
    }
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, s: String?, a: Array<out String>?) = 0
    override fun update(uri: Uri, v: ContentValues?, s: String?, a: Array<out String>?) = 0

    companion object {
        fun uriFor(ctx: Context, f: File): Uri = Uri.parse("content://${ctx.packageName}.share/${Uri.encode(f.name)}")
    }
}
