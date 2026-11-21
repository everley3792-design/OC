package app.ocshimeji.save

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SaveTest {
    private var t = 1_700_000_000_000L
    private fun sys(s: Storage = MemStorage()) = SaveSystem(s) { t }

    @Test fun presetIsAlwaysInTheLibraryAndCannotBeDeleted() {
        val s = sys(); assertEquals("肉桂捲", s.library().chars.first().name)
        assertEquals("內建角色不能刪除", s.removeLibChar(Presets.CINNAMON.id))
    }
    @Test fun createContinueAndSaveMeta() {
        val s = sys(); val m = s.create("第一個小鎮", listOf(Presets.CINNAMON.id))
        val w = s.loadWorld(m.id)!!; assertEquals(1, w.residents.size); assertEquals("肉桂捲", w.residents[0].name)
        t += 60_000; s.saveWorld(m.id, w.copy(minute = 99.0), playedSeconds = 60)
        val m2 = s.slot(m.id)!!; assertEquals(60, m2.playSeconds); assertEquals(t, m2.lastPlayed); assertEquals(99.0, s.loadWorld(m.id)!!.minute)
    }
    @Test fun newestFirstRenameDelete() {
        val s = sys(); val a = s.create("A", emptyList()); t += 1000; val b = s.create("B", emptyList())
        assertEquals(listOf(b.id, a.id), s.slots().map { it.id })
        t += 1000; s.touch(a.id); assertEquals(a.id, s.slots().first().id)
        s.rename(a.id, "  新名字  "); assertEquals("新名字", s.slot(a.id)!!.name)
        s.rename(a.id, "   "); assertEquals("新名字", s.slot(a.id)!!.name)
        s.delete(b.id); assertNull(s.slot(b.id)); assertNull(s.loadWorld(b.id))
    }
    @Test fun copyIsIdenticalBranchRollsItsOwnDice() {
        val s = sys(); val a = s.create("A", listOf(Presets.CINNAMON.id))
        t += 5; val c = s.copy(a.id)!!; assertEquals(s.loadWorld(a.id), s.loadWorld(c.id)); assertEquals(a.id, c.from); assertEquals("A（複製）", c.name)
        t += 5; val b = s.branch(a.id)!!; assertNotEquals(s.loadWorld(a.id)!!.seed, s.loadWorld(b.id)!!.seed); assertEquals(s.loadWorld(a.id)!!.residents, s.loadWorld(b.id)!!.residents)
    }
    @Test fun aCharacterLivingInASaveCannotLeaveTheLibrary() {
        val s = sys(); val c = s.addLibChar(LibChar(id = "", name = "小空", image = "library/x.png"))
        val m = s.create("A", listOf(c.id)); assertTrue(s.removeLibChar(c.id)!!.startsWith("還住在"))
        s.delete(m.id); assertNull(s.removeLibChar(c.id)); assertNull(s.libChar(c.id))
    }
    @Test fun dailyBackupsKeepThree() {
        val s = sys(); val m = s.create("A", emptyList())
        repeat(5) { i -> t += 86_400_000L; s.saveWorld(m.id, s.loadWorld(m.id)!!.copy(minute = i.toDouble())) }
        assertEquals(3, s.backups(m.id).size)
        val day = s.backups(m.id).last(); assertTrue(s.restoreBackup(m.id, day))
    }
    @Test fun atomicWritesSurviveAHalfWrittenFile() {
        val dir = Files.createTempDirectory("oc").toFile(); val st = FileStorage(dir); val s = sys(st); val m = s.create("A", emptyList())
        s.saveWorld(m.id, s.loadWorld(m.id)!!.copy(minute = 5.0))
        File(dir, "saves/${m.id}/world.json").writeText("{ broken")            /* cut off half-way → the previous version answers */
        assertEquals(0.0, s.loadWorld(m.id)!!.minute)
        File(dir, "saves/${m.id}/world.json").delete()                          /* lost entirely → the same */
        assertNotNull(s.loadWorld(m.id)); dir.deleteRecursively()
    }
    @Test fun aNewerSaveIsRefusedWithAReason() {
        val e = assertFailsWith<IllegalArgumentException> { Migrate.upgrade(JsonObject(mapOf("v" to JsonPrimitive(99))), 1, emptyMap()) }
        assertTrue(e.message!!.contains("請先更新 App"))
        val up = Migrate.upgrade(Json.parseToJsonElement("""{"v":1,"a":1}""").jsonObject, 2, mapOf(1 to { o: JsonObject -> JsonObject(o + ("b" to JsonPrimitive(2))) }))
        assertEquals(JsonPrimitive(2), up["v"]); assertEquals(JsonPrimitive(2), up["b"])
    }
}
