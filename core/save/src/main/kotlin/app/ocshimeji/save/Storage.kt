package app.ocshimeji.save

import java.io.File

/**
 * Where saves live. Paths are relative ("saves/ab12/world.json"). Every write is atomic: the new file is written next to the old one,
 * the old one becomes ".bak", then the new one takes its name — a write cut off half-way (power, crash) never leaves a broken save;
 * reading falls back to ".bak".
 */
interface Storage {
    fun read(path: String): ByteArray?
    fun write(path: String, data: ByteArray)
    fun delete(path: String)
    /** names directly under a directory ("" = root) */
    fun list(dir: String): List<String>
    fun exists(path: String): Boolean = read(path) != null
    /** the previous version of a file (before the last write), when the storage keeps one */
    fun readPrevious(path: String): ByteArray? = null
    fun copyDir(from: String, to: String) {
        for (name in list(from)) { val src = "$from/$name"; if (list(src).isNotEmpty()) copyDir(src, "$to/$name") else read(src)?.let { write("$to/$name", it) } }
    }
    fun deleteDir(dir: String) { for (name in list(dir)) { val p = "$dir/$name"; if (list(p).isNotEmpty()) deleteDir(p) else delete(p) }; delete(dir) }
}

/** the real one (app files dir on the phone, a temp dir in tests) */
class FileStorage(private val root: File) : Storage {
    private fun f(path: String) = File(root, path)
    override fun read(path: String): ByteArray? {
        val main = f(path); if (main.isFile) try { return main.readBytes() } catch (e: Exception) { /* fall through to .bak */ }
        val bak = f("$path.bak"); return if (bak.isFile) bak.readBytes() else null
    }
    override fun write(path: String, data: ByteArray) {
        val main = f(path); main.parentFile?.mkdirs()
        val tmp = f("$path.new"); tmp.writeBytes(data)
        val bak = f("$path.bak"); if (main.exists()) { bak.delete(); main.renameTo(bak) }
        if (!tmp.renameTo(main)) { main.writeBytes(data); tmp.delete() }
    }
    override fun readPrevious(path: String): ByteArray? = f("$path.bak").takeIf { it.isFile }?.readBytes()
    override fun delete(path: String) { val x = f(path); if (x.isDirectory) x.deleteRecursively() else { x.delete(); f("$path.bak").delete(); f("$path.new").delete() } }
    override fun list(dir: String): List<String> = (f(dir).list() ?: emptyArray()).filter { !it.endsWith(".bak") && !it.endsWith(".new") }.sorted()
    override fun deleteDir(dir: String) { f(dir).deleteRecursively() }
}

/** in memory (tests) */
class MemStorage : Storage {
    val files = sortedMapOf<String, ByteArray>()
    override fun read(path: String) = files[path]
    override fun write(path: String, data: ByteArray) { files[path] = data.copyOf() }
    override fun delete(path: String) { files.remove(path) }
    override fun list(dir: String): List<String> {
        val pre = if (dir.isEmpty()) "" else "$dir/"
        return files.keys.filter { it.startsWith(pre) }.map { it.removePrefix(pre).substringBefore('/') }.distinct().sorted()
    }
}
