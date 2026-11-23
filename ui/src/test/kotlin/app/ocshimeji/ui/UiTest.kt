package app.ocshimeji.ui

import app.ocshimeji.render.jvm.Java2dGfx
import app.ocshimeji.render.jvm.JvmAssets
import app.ocshimeji.save.MemStorage
import app.ocshimeji.save.Presets
import app.ocshimeji.save.SaveSystem
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The screens driven exactly like a finger would (tap areas), plus screenshots compared with the approved ones in resources/golden. */
class UiTest {
    private val root = File(System.getProperty("oc.root") ?: "..")
    private val record = System.getProperty("oc.record") == "true"
    private val assets = JvmAssets(File(root, "art"))
    private var now = 1_700_042_400_000L   /* 10:00 UTC: daylight in the home */
    private var promptAnswer: String? = null
    private var saved: ByteArray? = null
    private var overlayOk = false; private var openedSettings = false; private var stage: DeskStage? = null; private var deskApp: UiApp? = null
    /** what the file picker hands over next */
    private var files: List<app.ocshimeji.save.media.Importer.Source> = emptyList()
    private fun pngOf(p: PickedImage) = p.working
    private var lastVolumes: List<Float> = emptyList()
    private val platform = object : Platform {
        override fun volumes(music: Float, sfx: Float, ambience: Float, voice: Float) { lastVolumes = listOf(music, sfx, ambience, voice) }
        override fun now() = now
        override fun realMinute() = now / 60000.0
        override fun prompt(title: String, initial: String, maxLength: Int, done: (String?) -> Unit) = done(promptAnswer)
        override fun pickImage(done: (PickedImage?, String?) -> Unit) = done(testPicture(), null)
        override fun saveFile(name: String, mime: String, data: ByteArray, done: (Boolean) -> Unit) { saved = data; done(true) }
        override fun openFile(mime: String, done: (ByteArray?) -> Unit) = done(saved)
        override fun canOverlay() = overlayOk
        override fun openOverlaySettings() { openedSettings = true }
        override fun deskStart(slotId: String, personId: String): String? { val st = stage ?: DeskStage(deskApp!!, slotId, app.ocshimeji.sim.desk.DeskScreen(360f, 780f)).also { stage = it }; return st.add(personId) }
        override fun deskStop(slotId: String, personId: String) { stage?.remove(personId) }
        override fun pickFiles(multiple: Boolean, done: (List<app.ocshimeji.save.media.Importer.Source>?, String?) -> Unit) = done(files, null)
        override val codec = app.ocshimeji.save.media.Codec { b -> ImageIO.read(java.io.ByteArrayInputStream(b))?.let { r -> app.ocshimeji.save.media.Raster(r.width, r.height, r.getRGB(0, 0, r.width, r.height, null, 0, r.width)) } }
    }
    /** an original test character: a round mint body with eyes on a transparent background */
    private fun testPicture(): PickedImage {
        val img = BufferedImage(220, 300, BufferedImage.TYPE_INT_ARGB); val g = img.createGraphics()
        g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON)
        g.color = java.awt.Color(0x8E, 0xD1, 0xB4); g.fillOval(20, 40, 180, 250); g.color = java.awt.Color(0x5B, 0x3A, 0x29); g.fillOval(70, 120, 18, 24); g.fillOval(132, 120, 18, 24)
        g.color = java.awt.Color(0xF6, 0xB2, 0xA8); g.fillOval(50, 160, 30, 16); g.fillOval(140, 160, 30, 16); g.dispose()
        val bos = java.io.ByteArrayOutputStream(); ImageIO.write(img, "png", bos); val bytes = bos.toByteArray()
        return PickedImage(bytes, "png", bytes, img.width, img.height, img.getRGB(0, 0, img.width, img.height, null, 0, img.width))
    }
    private fun app(dark: Boolean = false): UiApp {
        val a = UiApp(SaveSystem(MemStorage()) { now }, assets, platform); a.theme = if (dark) Theme.DARK else Theme.LIGHT
        a.insetTop = 24f; a.insetBottom = 16f; a.push(TitleScreen()); return a
    }
    /** run frames (dp 360×800) and return the last one as an image */
    /** tap something in the editor's scrolled panel: scroll until it is on screen (2.2.0: hidden parts cannot be tapped) */
    private fun tapIn(a: UiApp, ed: CharacterEditor, id: String): Boolean {
        ed.scrollBy(-1e5f); frames(a, 2)
        repeat(40) { val z = a.zoneRect(id); if (z != null && z.h >= 30f) return a.tapZone(id); ed.scrollBy(120f); frames(a, 2) }
        return false
    }
    private fun frames(a: UiApp, n: Int = 40, w: Int = 360, h: Int = 800, scale: Float = 1f): BufferedImage {
        var img: BufferedImage? = null
        repeat(n) { i -> val draw = { g: app.ocshimeji.render.Gfx -> a.frame(g, 1 / 30f) }; if (i == n - 1) img = Java2dGfx.render(w, h, scale, assets, draw) else Java2dGfx.render(8, 8, 1f, assets) { a.w; a.frame(FakeSize(it, w.toFloat(), h.toFloat()), 1 / 30f) } }
        return img!!
    }
    private fun shot(name: String, img: BufferedImage) {
        val out = File(root, "ui/build/shots/$name.png"); Java2dGfx.writePng(img, out)
        val golden = File(root, "ui/src/test/resources/golden/$name.png")
        if (record || !golden.exists()) { Java2dGfx.writePng(img, golden); return }
        val g = ImageIO.read(golden); assertEquals(g.width, img.width, "$name size"); assertEquals(g.height, img.height, "$name size")
        var diff = 0L; for (y in 0 until img.height step 2) for (x in 0 until img.width step 2) { val a = img.getRGB(x, y); val b = g.getRGB(x, y); for (s in intArrayOf(0, 8, 16, 24)) diff += kotlin.math.abs(((a ushr s) and 255) - ((b ushr s) and 255)) }
        val mean = diff.toDouble() / (img.width / 2 * (img.height / 2) * 4)
        assertTrue(mean < 2.0, "$name differs from the approved screenshot (mean channel difference $mean); see ui/build/shots/$name.png, re-record with -Precord=true if intended")
    }

    @Test fun titleEmptyLightAndDark() {
        val a = app(); val img = frames(a, scale = 2f); assertTrue(a.hasZone("new")); shot("title-empty-light", img)
        shot("title-empty-dark", frames(app(dark = true), scale = 2f))
    }
    @Test fun openingFlowFromNamesToMoveInDay() {
        val a = app(); frames(a, 5)
        assertTrue(a.tapZone("new")); frames(a, 15); val o = a.screen as OpeningScreen
        promptAnswer = "雲朵鎮"; assertTrue(a.tapZone("name:town")); assertEquals("雲朵鎮", o.town)
        shot("opening-names", frames(a, 20, scale = 2f))
        assertTrue(a.tapZone("next")); frames(a, 15); assertEquals(1, o.step)
        assertTrue(a.tapZone("house:studio")); frames(a, 15); shot("opening-house", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("house:cottage")); assertTrue(a.tapZone("next")); frames(a, 15); assertEquals(2, o.step)
        assertFalse(a.hasZone("next"), "nobody chosen yet: the reason is shown instead of the button")
        assertTrue(a.tapZone("pick:${Presets.CINNAMON.id}")); frames(a, 2)
        assertTrue(a.tapZone("import")); frames(a, 15); val st = a.screen as ImportStudio
        shot("studio-pick", frames(a, 1, scale = 2f))
        files = listOf(app.ocshimeji.save.media.Importer.Source("me.png", pngOf(testPicture())))
        assertTrue(a.tapZone("btn:files")); frames(a, 10); assertEquals(1, st.step)
        shot("studio-clean", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("next")); frames(a, 5); assertTrue(a.tapZone("chip:facing:圖上朝左")); assertTrue(a.tapZone("next")); frames(a, 5); assertTrue(a.tapZone("next")); frames(a, 5)
        promptAnswer = "小麥"; assertTrue(a.tapZone("row:name")); assertTrue(a.tapZone("next")); frames(a, 20)
        val ed = a.screen as CharacterEditor; assertEquals("小麥", ed.spec.name)
        shot("editor-new", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("save")); frames(a, 5); assertTrue(a.screen is OpeningScreen); assertEquals(2, o.chosen.size)
        val mai = a.saves.library().chars.first { it.name == "小麥" }; assertEquals(-1, mai.facing); assertTrue(mai.image.startsWith("lib:"))
        assertTrue(a.tapZone("pick:${Presets.CINNAMON.id}")); assertTrue(a.tapZone("pick:${Presets.CINNAMON.id}"))   /* off and on again */
        shot("opening-people", frames(a, 10, scale = 2f))
        assertTrue(a.tapZone("next")); frames(a, 15); assertEquals(3, o.step); assertNull(o.problem(), "rooms are given automatically")
        assertTrue(a.tapZone("room:${mai.id}:bedB")); frames(a, 15); shot("opening-rooms", frames(a, 1, scale = 2f))
        // relationships (optional): friends both ways
        assertTrue(a.tapZone("btn:rels")); frames(a, 15); val rs = a.screen as RelationsScreen
        assertTrue(a.tapZone("p:${Presets.CINNAMON.id}")); assertTrue(a.tapZone("p:${mai.id}")); frames(a, 15); assertTrue(a.overlay is PairSheet)
        assertTrue(a.tapZone("chip:kind:朋友")); assertTrue(a.tapZone("chip:side:小麥 怎麼看 肉桂捲")); assertTrue(a.tapZone("chip:kind:好友")); frames(a, 2)
        shot("relations-pair", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("pair:done")); frames(a, 15); shot("relations", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("done")); frames(a, 5); assertEquals(2, o.rels.size); assertTrue(rs.rels.any { it.kind == "好友" })
        assertTrue(a.tapZone("next")); frames(a, 5)
        val ws = a.screen as WorldScreen; val life = ws.sim.life
        assertEquals("cottage", life.houseId); assertEquals("雲朵鎮", life.townName); assertTrue(life.arriving)
        assertEquals(setOf("bedA", "bedB"), life.people.map { it.room }.toSet()); assertEquals(2, life.rels.size)
        frames(a, 90); shot("world-movein", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("back")); frames(a, 2); assertTrue(a.screen is TitleScreen)
        assertEquals("我們的家", a.saves.slots().single().name)
    }
    private fun world(a: UiApp, libIds: List<String> = listOf(Presets.CINNAMON.id)): WorldScreen {
        val house = app.ocshimeji.sim.house.Houses.STUDIO
        val m = a.saves.createWorld("小窩", "楓糖鎮", "小窩", house, libIds, libIds.associateWith { "main" }, platform.realMinute())
        a.saves.setFlag("tip:touch"); (a.screen as TitleScreen).open(m.id); frames(a, 3)
        return (a.screen as WorldScreen).also { w -> w.sim.life.people.forEach { it.recent["outing"] = w.sim.life.minute + 24 * 60.0 } }   /* these tests watch them at home */
    }
    /** R3: a tap on a resident opens the radial menu; 「看看」 = the person card */
    private fun tapCard(a: UiApp, ws: WorldScreen, id: String) { val (x, y) = ws.screenOf(id)!!; a.down(x, y); frames(a, 2); a.up(x, y); frames(a, 15)
        assertTrue(a.overlay is PieMenu, "a tap opens the radial menu"); assertTrue((a.overlay as PieMenu).pick("看看")); frames(a, 15) }
    @Test fun touchingACharacterTapRubLiftThrow() {
        val a = app(); val ws = world(a); val p = ws.sim.life.people[0]
        frames(a, 200)   /* moved in */
        assertFalse(ws.sim.life.arriving)
        // tap = the card
        var (x, y) = ws.screenOf(p.id)!!; a.down(x, y); frames(a, 2); a.up(x, y); frames(a, 15)
        assertTrue(a.overlay is PieMenu, "a tap opens the radial menu"); assertTrue((a.overlay as PieMenu).pick("看看")); frames(a, 15)
        assertTrue(a.overlay is PersonCard); shot("person-card", frames(a, 1, scale = 2f))
        assertTrue(a.back()); assertNull(a.overlay)
        // rub back and forth = petting; the data changes once when the stroke ends
        ws.sim.body(p.id).micro = null
        val before = p.need(app.ocshimeji.sim.life.Need.ATTENTION)
        ws.screenOf(p.id)!!.let { x = it.first; y = it.second }
        a.down(x, y); for (i in 0 until 40) { a.move(x + if (i % 2 == 0) 14f else -14f, y); frames(a, 1) }; a.up(x, y); frames(a, 2)
        assertTrue(p.moods.any { it.id == "petted" || it.id == "pettedsleep" }, "petted"); assertTrue(p.need(app.ocshimeji.sim.life.Need.ATTENTION) > before)
        // hold still = lifted; flick = thrown
        frames(a, 40); ws.screenOf(p.id)!!.let { x = it.first; y = it.second }
        a.down(x, y); frames(a, 20); assertEquals(p.id, ws.holding, "held after a long press")
        for (i in 1..6) { a.move(x + i * 22f, y - i * 4f); frames(a, 1) }
        shot("world-held", frames(a, 1, scale = 2f))
        a.up(x + 140f, y - 26f); frames(a, 1); assertTrue(ws.sim.body(p.id).flying, "thrown")
        frames(a, 60); assertFalse(ws.sim.body(p.id).flying, "landed"); assertTrue(ws.sim.grid.walkable(p.x.toInt(), p.y.toInt()), "landed on the floor")
        // two fingers zoom
        val z0 = ws.zoom; a.down(100f, 300f); a.second(0, 200f, 300f); a.move(60f, 300f); a.second(1, 260f, 300f); a.second(2, 260f, 300f); a.up(60f, 300f)
        assertTrue(ws.zoom > z0 * 1.4f, "pinch zoom ${ws.zoom} vs $z0")
    }
    @Test fun whileYouWereAwayAndTheDarkHome() {
        val a = app(dark = true); val ws = world(a); frames(a, 60); assertTrue(a.tapZone("back")); frames(a, 2)
        val m0 = ws.sim.life.minute
        now += 3 * 3600_000L; (a.screen as TitleScreen).open(a.saves.slots().single().id); frames(a, 15)
        val ws2 = a.screen as WorldScreen; assertTrue(a.overlay is AwaySheet, "a summary after 3 hours")
        assertTrue(ws2.sim.life.minute >= m0 + 179, "time caught up")
        shot("away-dark", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("away:ok")); frames(a, 40); shot("world-dark", frames(a, 1, scale = 2f))
        now += 20 * 60_000L; a.wake(); assertNull(a.overlay, "a short absence is caught up quietly")
    }
    @Test fun exportAndImportASave() {
        val a = app(); val ws = world(a); frames(a, 30); assertTrue(a.tapZone("back")); frames(a, 5); val id = ws.slotId
        assertTrue(a.tapZone("more:$id")); frames(a, 12); assertTrue(a.tapZone("row:export")); frames(a, 2)
        assertNotNull(saved); assertTrue(a.toastText!!.startsWith("匯出了"))
        assertTrue(a.tapZone("importSave")); frames(a, 2); assertEquals(2, a.saves.slots().size)
        val other = a.saves.slots().first { it.id != id }; assertTrue(other.name.endsWith("（匯入）"))
        assertNotNull(a.saves.loadWorld(other.id)!!.life)
    }
    @Test fun theCharacterEditorTabsToolsAndSaving() {
        val a = app(); val c = a.saves.addLibChar(Presets.CINNAMON.copy(id = "", name = "可可", source = "import", spec = Presets.CINNAMON.spec!!.copy(name = "可可")))
        a.push(LibraryScreen()); frames(a, 10); shot("library", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("char:${c.id}")); frames(a, 15); val ed = a.screen as CharacterEditor
        shot("editor-looks", frames(a, 1, scale = 2f))
        for ((i, name) in listOf(4 to "editor-personality", 6 to "editor-speech")) { assertTrue(a.tapZone("tab:$i")); frames(a, 4); shot(name, frames(a, 1, scale = 2f)) }
        assertTrue(a.tapZone("tab:4")); frames(a, 2); assertTrue(tapIn(a, ed, "chip:trait:書蟲")); assertTrue("書蟲" in ed.spec.traits)
        assertTrue(a.tapZone("undo")); assertTrue("書蟲" !in ed.spec.traits); assertTrue(a.tapZone("redo")); assertTrue("書蟲" in ed.spec.traits)
        assertTrue(a.tapZone("tab:3")); frames(a, 2); assertTrue(a.tapZone("step:axis0:+")); assertEquals(0.6f, ed.spec.axis(0), 0.01f)
        assertTrue(a.tapZone("tab:6")); frames(a, 2); assertTrue(a.tapZone("chip:say:被稱讚")); frames(a, 10); shot("editor-scene", frames(a, 1, scale = 2f))
        // the quiz: ten answers
        assertTrue(a.tapZone("more")); frames(a, 12); assertTrue(a.tapZone("row:quiz")); frames(a, 12); assertTrue(a.overlay is QuizSheet)
        shot("editor-quiz", frames(a, 1, scale = 2f)); repeat(10) { frames(a, 12); assertTrue(a.tapZone("ans:${it % 3}")) }; frames(a, 2); assertNull(a.overlay); assertTrue(ed.spec.traits.size >= 4)
        // 2.2.0: the situational quiz fills the personality dimensions; sliders for the rest; little ways of talking
        assertTrue(a.tapZone("more")); frames(a, 12); assertTrue(a.tapZone("row:dimquiz")); frames(a, 12); assertTrue(a.overlay is QuizSheet); shot("editor-dimquiz", frames(a, 1, scale = 2f))
        repeat(app.ocshimeji.sim.chars.Dims.QUIZ.size) { frames(a, 12); assertTrue(a.tapZone("ans:${if (it % 2 == 0) 0 else 3}")) }; frames(a, 2); assertNull(a.overlay)
        assertTrue(ed.spec.dims.size >= 8, "${ed.spec.dims}")
        assertTrue(a.tapZone("tab:3")); frames(a, 4); val cur0 = ed.spec.dim("好奇"); ed.slide("dim:好奇", 1f); assertEquals(1f, ed.spec.dim("好奇"), 0.01f); assertNotEquals(cur0, ed.spec.dim("好奇"))
        ed.scrollBy(1700f); frames(a, 4); shot("editor-dims", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("tab:6")); frames(a, 4); ed.scrollBy(440f); frames(a, 4)
        assertTrue(a.tapZone("step:talk:stutter:+"), "zones: ${a.zoneIds.filter { it.startsWith("step") }} ${a.zoneRect("step:talk:stutter:+")?.y}"); assertEquals(0.3f, ed.spec.talk.stutter, 0.01f); frames(a, 2); shot("editor-talk", frames(a, 1, scale = 2f))
        // dice with a lock: the speech tab stays
        val style = ed.spec.style; assertTrue(a.tapZone("more")); frames(a, 12); assertTrue(a.tapZone("row:dice")); frames(a, 12)
        assertTrue(a.tapZone("chip:lock:鎖住說話")); assertTrue(a.tapZone("dice:go")); frames(a, 2); assertEquals(style, ed.spec.style)
        assertTrue(a.tapZone("more")); frames(a, 12); assertTrue(a.tapZone("row:template")); frames(a, 12); assertTrue(a.tapZone("row:天然呆")); assertTrue("天然呆" in ed.spec.traits)
        assertTrue(a.tapZone("tab:4")); frames(a, 2); ed.tap("btn:tagpick"); frames(a, 15); assertTrue(a.tapZone("cat:RACE")); frames(a, 2); assertTrue(a.tapZone("chip:tag:精靈")); frames(a, 2)
        shot("editor-tags", frames(a, 1, scale = 2f)); assertTrue(a.tapZone("tags:done")); assertTrue("精靈" in ed.spec.tags)
        assertTrue(a.tapZone("save")); frames(a, 5); assertTrue(a.screen is LibraryScreen)
        val back = a.saves.libChar(c.id)!!; assertTrue("精靈" in back.spec!!.tags); assertTrue("天然呆" in back.spec!!.traits)
    }
    @Test fun editingAResidentAndAnAnimatedCharacterAtHome() {
        val a = app()
        // an animated character from a PNG sequence (walk + idle)
        val frames0 = (0..3).map { i -> java.awt.image.BufferedImage(120, 160, java.awt.image.BufferedImage.TYPE_INT_ARGB).also { val g = it.createGraphics(); g.color = java.awt.Color(0xF4, 0xA2, 0x59); g.fillOval(20 + i * 4, 20, 80, 130); g.dispose() } }
        fun png(b: java.awt.image.BufferedImage) = java.io.ByteArrayOutputStream().also { ImageIO.write(b, "png", it) }.toByteArray()
        val im = app.ocshimeji.save.media.Importer.read(frames0.mapIndexed { i, b -> app.ocshimeji.save.media.Importer.Source("walk_$i.png", png(b)) } + app.ocshimeji.save.media.Importer.Source("idle.png", png(frames0[0])), platform.codec)
        val c = a.saves.saveCharacter(app.ocshimeji.save.media.Importer.prepare(im), app.ocshimeji.sim.chars.CharSpec(name = "橘子", traits = listOf("急性子")), 1, true, emptyMap(), emptyList())
        val ws = world(a, listOf(c.id)); val p = ws.sim.life.people[0]; frames(a, 200)
        val look = ws.lookOf(p)!!; assertEquals("walk", look.mine(app.ocshimeji.sim.life.Pose.WALK, false)); assertEquals(4, look.frames("walk")!!.size)
        assertEquals(null, look.mine(app.ocshimeji.sim.life.Pose.EAT, false), "mixed: no eat animation → the system's motion")
        // edit them from the card: the world copy changes, the library one does not
        tapCard(a, ws, p.id); assertTrue(a.overlay is PersonCard)
        shot("person-card-m2", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("card:edit")); frames(a, 15); val ed = a.screen as CharacterEditor; assertTrue(ed.world)
        assertTrue(a.tapZone("tab:7")); frames(a, 2); assertTrue(a.tapZone("step:wake:-")); assertTrue(a.tapZone("save")); frames(a, 5)
        assertTrue(a.screen is WorldScreen); assertEquals(6, ws.sim.person(p.id)!!.spec.wake); assertEquals(7, a.saves.libChar(c.id)!!.spec!!.wake, "the library original is unchanged")
        assertEquals(6, a.saves.loadWorld(ws.slotId)!!.life!!.people[0].spec.wake, "saved with the world")
    }
    /** the whole phone screen with the desktop's windows composited where the service would put them */
    private fun desktop(st: DeskStage, scale: Float = 2f): BufferedImage = Java2dGfx.render(360, 780, scale, assets) { g ->
        g.fillGradientV(0f, 0f, 360f, 780f, 0xFF9FB8D8.toInt(), 0xFFE8D8F0.toInt())
        for (i in 0 until 16) { val x = 32f + (i % 4) * 84f; val y = 120f + (i / 4) * 110f; g.fillRound(x, y, 48f, 48f, 14f, 0x66FFFFFF) }   /* app icons (we never see the real ones) */
        for (id in st.propIds) { val b = st.propWindow(id) ?: continue; g.save(); g.translate(b[0], b[1]); st.drawProp(FakeSize(g, b[2], b[3]), id); g.restore() }
        for (id in st.pets.keys) {
            val b = st.windowOf(id) ?: continue; g.save(); g.translate(b[0], b[1]); g.clip(0f, 0f, b[2], b[3]); st.drawPet(g, id); g.restore()
            st.bubbleWindow(g, id)?.let { w -> g.save(); g.translate(w[0], w[1]); st.drawBubble(FakeSize(g, w[2], w[3]), id); g.restore() }
        }
    }
    @Test fun theDesktopPet() {
        val a = app(); deskApp = a; val ws = world(a); val p = ws.sim.life.people[0]; frames(a, 200)
        // the person card → 桌面: without the permission, an explanation first
        tapCard(a, ws, p.id)
        assertTrue(a.tapZone("card:desk")); frames(a, 15); assertTrue(a.overlay is DeskSheet); shot("desk-sheet", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("chip:remind:每 30 分")); assertEquals("30", a.saves.pref("desk:remind"))
        assertTrue(a.tapZone("desk:go")); frames(a, 15); assertTrue(a.overlay is DeskPermissionSheet); shot("desk-permission", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("perm:go")); assertTrue(openedSettings)
        // allowed: out on the desktop; the home no longer draws them
        overlayOk = true; tapCard(a, ws, p.id)
        assertTrue(a.tapZone("card:desk")); frames(a, 15); assertTrue(a.tapZone("desk:go")); frames(a, 10)
        val st = stage!!; assertTrue(p.desk); assertEquals(null, ws.screenOf(p.id)); assertTrue(st.open === a.host.get(ws.slotId), "one simulation for both")
        shot("world-desk-badge", frames(a, 1, scale = 2f))
        // while the home is showing, it drives the clock; in the background, the desktop does
        val m0 = ws.sim.life.minute; repeat(60) { st.frame(1 / 30f, Phone()) }; assertEquals(m0, ws.sim.life.minute, "the desk only watches while the home is visible")
        a.pause(); repeat(90) { st.frame(1 / 30f, Phone()) }; assertTrue(ws.sim.life.minute > m0, "the desk keeps the world going")
        repeat(60) { st.frame(1 / 30f, Phone()) }; shot("desk-floor", desktop(st))
        // drag and throw through the gesture recogniser
        val d = st.pets[p.id]!!.pet; val gx = d.x; val gy = d.y - 40
        st.touch(p.id, 0, gx, gy); var t = 0f; for (i in 1..8) { st.frame(1 / 60f, Phone()); st.touch(p.id, 1, gx + i * 26f, gy - i * 10f) }
        assertEquals(app.ocshimeji.sim.desk.DeskState.HELD, d.state); st.touch(p.id, 2, gx + 220f, gy - 90f); assertEquals(app.ocshimeji.sim.desk.DeskState.THROWN, d.state)
        repeat(150) { st.frame(1 / 30f, Phone()) }; assertTrue(p.moods.any { it.id == "thrown" || it.id == "thrownfun" || it.id == "lifted" })
        // a long press opens the menu; feeding there is the same as at home
        st.touch(p.id, 0, d.x, d.y - 40); repeat(20) { st.frame(1 / 30f, Phone()) }; assertEquals(p.id, st.menuFor); st.touch(p.id, 2, d.x, d.y - 40)
        val menu = UiApp(a.saves, assets, platform, a.host); var act = ""; menu.push(DeskMenuScreen(st, p.id) { act = it })
        Java2dGfx.render(DeskMenuScreen.W.toInt(), DeskMenuScreen.H.toInt(), 1f, assets) { menu.frame(it, 1 / 30f) }; val food = p.need(app.ocshimeji.sim.life.Need.FOOD)
        p.setNeed(app.ocshimeji.sim.life.Need.FOOD, 40f); assertTrue(menu.tapZone("m:feed:apple")); assertTrue(p.need(app.ocshimeji.sim.life.Need.FOOD) > 40f); assertEquals("close", act)
        shot("desk-menu", Java2dGfx.render(DeskMenuScreen.W.toInt(), DeskMenuScreen.H.toInt(), 2f, assets) { menu.frame(it, 1 / 30f) }); assertTrue(food >= 0)
        // climbing and hanging look right too
        var sidePic = false
        for (i in 0 until 6000) { st.frame(1 / 15f, Phone()); if (d.side != app.ocshimeji.sim.desk.Side.FLOOR && st.time > 10f) { shot("desk-wall", desktop(st)); sidePic = true; break } }
        assertTrue(sidePic, "climbed a wall within the time")
        // back home: through the menu
        assertTrue(menu.tapZone("m:home")); assertTrue(!p.desk); assertEquals("home", act)
        a.wake(); frames(a, 10); assertNotNull(ws.screenOf(p.id))
    }
    /** R6: the desktop rebuilt — things to put down (a snack eaten, the nest), following your finger, two pets together, keeping you company */
    @Test fun theDesktopR6() {
        val a = app(); deskApp = a; val ws = home2(a); val sim = ws.sim; val (p1, p2) = sim.life.people; overlayOk = true
        sim.society.relUpdate(p1, p2) { it.copy(like = 85, familiar = 80) }; sim.society.relUpdate(p2, p1) { it.copy(like = 85, familiar = 80) }
        assertNull(a.platform.deskStart(ws.slotId, p1.id)); assertNull(a.platform.deskStart(ws.slotId, p2.id)); val st = stage!!; a.pause()
        repeat(60) { st.frame(1 / 30f, Phone()) }
        // things on the desktop: a snack from the bag (a ledger line), a nest; drag one along the floor, double tap to put it away
        val food = app.ocshimeji.sim.town.Goods.ALL.values.first { it.kind == "food" }.id; assertTrue(sim.economy.move(food, 1, "測試")); assertTrue(sim.economy.move("d:plant", 1, "測試"))
        val menu = UiApp(a.saves, assets, platform, a.host); var act = ""; menu.push(DeskMenuScreen(st, p1.id) { act = it })
        Java2dGfx.render(DeskMenuScreen.W.toInt(), DeskMenuScreen.H.toInt(), 1f, assets) { menu.frame(it, 1 / 30f) }
        assertTrue(menu.tapZone("m:put:nest")); assertTrue(menu.tapZone("m:put:food")); assertTrue(menu.tapZone("m:put:plant"))
        assertEquals(3, sim.life.deskProps.size); assertEquals(0, sim.economy.count(food), "the snack left the bag"); assertEquals(0, sim.economy.count("d:plant")); assertTrue(sim.economy.consistent())
        assertTrue(menu.tapZone("m:put:note")); assertTrue(st.pets[p1.id]!!.bubble!!.contains("雜貨店"), "no note in the bag: it says where to get one"); assertEquals(3, sim.life.deskProps.size)
        val plant = sim.life.deskProps.first { it.kind == "plant" }; val pw = st.propWindow(plant.id)!!
        st.touchProp(plant.id, 0, pw[0] + 20, pw[1] + 20); st.touchProp(plant.id, 1, 300f, pw[1] + 20); st.touchProp(plant.id, 2, 300f, pw[1] + 20); assertEquals(300f / st.screen.w, plant.fx, 0.01f)
        repeat(20) { st.frame(1 / 30f, Phone()) }; shot("desk-things", desktop(st))
        // hungry: goes to the snack and eats it (the same person as at home: fuller, a memory)
        p1.setNeed(app.ocshimeji.sim.life.Need.FOOD, 20f); var n = 0; while (n++ < 900 && sim.life.deskProps.any { it.kind == "food" }) st.frame(1 / 30f, Phone())
        assertTrue(sim.life.deskProps.none { it.kind == "food" }, "eaten"); assertTrue(p1.need(app.ocshimeji.sim.life.Need.FOOD) > 20f); assertTrue(sim.economy.consistent())
        // a finger held next to the pet (not on it): it comes after the finger
        val d = st.pets[p1.id]!!.pet; repeat(10) { st.frame(1 / 30f, Phone()) }; val w = st.windowOf(p1.id)!!; val fx0 = w[0] + 6; val fy = w[1] + w[3] - 10
        st.touch(p1.id, 0, fx0, fy); var x = fx0; repeat(60) { x = (x + 4f).coerceAtMost(330f); st.touch(p1.id, 1, x, fy); st.frame(1 / 30f, Phone()) }
        if (d.intent == "follow") assertTrue(kotlin.math.abs(d.x - x) < 120f, "following: ${d.x} → $x"); st.touch(p1.id, 2, x, fy); assertNotNull(d.intent)
        // together: two friends find each other within a while; it becomes a memory
        var k = 0; while (k++ < 20000 && sim.life.log.none { it.kind == "desk" && it.text.contains("在桌面上") && it.with.isNotEmpty() }) st.frame(1 / 10f, Phone())
        assertTrue(sim.life.log.any { it.kind == "desk" && it.with.isNotEmpty() }, "did something together")
        // keeping you company: 25 minutes, then a break; the session is remembered
        assertTrue(menu.tapZone("m:focus")); assertNotNull(st.focus); repeat(60) { st.frame(1 / 10f, Phone()) }
        assertTrue(st.pets.values.any { it.pet.intent == "focus" }); shot("desk-focus", desktop(st))
        repeat(25 * 60 * 2) { st.frame(1 / 2f, Phone()) }; assertEquals("break", st.focus!!.phase); assertTrue(sim.life.log.any { it.text.contains("陪你專心了 25 分鐘") })
        assertTrue(menu.tapZone("m:focus")); assertNull(st.focus)
        // put everything away; the nest and the plant are the pet's own, nothing goes missing
        assertTrue(menu.tapZone("m:putaway")); assertTrue(sim.life.deskProps.isEmpty()); assertTrue(sim.economy.consistent()); assertEquals(1, sim.economy.count("d:plant"), "the plant is back in the bag")
        // the timer survives a restarted service (kept by the wall clock); the band can be switched off
        st.startFocus(); repeat(10) { st.frame(1f, Phone()) }; val again = DeskStage(a, ws.slotId, st.screen); assertEquals("work", again.focus?.phase); assertTrue(again.focusLine!!.contains("專心"))
        again.stopFocus(); again.close(); st.stopFocus(); a.saves.setPref("desk:follow", "off"); assertEquals(10f, st.margin); a.saves.setPref("desk:follow", null)
        for (pt in st.pets.values) { assertEquals(0, pt.pet.illegal); assertEquals(0, pt.pet.rescues) }
    }
    /** 1.7.0: the bigger stories — a debate you judge (the pill and its sheet), a get-together, their stories on the person card */
    @Test fun storiesAndDecisions() {
        val a = app(); val ws = home2(a); val sim = ws.sim; val (p1, p2) = sim.life.people
        p1.spec = p1.spec.copy(dream = "做出最好吃的蛋糕", fears = listOf("打雷")); sim.drama.startCraze(p1, "doodle"); sim.life.drama.whims[p1.id] = app.ocshimeji.sim.social.Whim("偵探", sim.life.day)
        sim.drama.fallSick(p2, "cold"); frames(a, 10); var k = 0; while (a.overlay != null && k++ < 5) { a.back(); frames(a, 15) }
        sim.drama.debate(app.ocshimeji.sim.Rng(4), live = true, x = p1, y = p2); frames(a, 20)
        assertTrue(a.overlay is ListSheet, "the decision opens by itself"); shot("decision-debate", frames(a, 1, scale = 2f))
        a.back(); frames(a, 15); assertTrue(a.hasZone("decide"), "and waits behind the pill"); shot("decision-pill", frames(a, 1, scale = 2f))
        val d = sim.drama.pending().single(); assertTrue(a.tapZone("decide")); frames(a, 15); assertTrue(a.tapZone("row:0")); frames(a, 5)
        assertTrue(sim.drama.pending().isEmpty()); assertTrue(sim.person(d.who)!!.moods.any { it.id == "debatewin" }); assertFalse(a.hasZone("decide"))
        sim.drama.doGroup(app.ocshimeji.sim.social.Groups.ALL["picnic"]!!, sim.life.people, app.ocshimeji.sim.Rng(1)); frames(a, 5); assertTrue(a.toastText!!.contains("野餐"))
        tapCard(a, ws, p1.id); frames(a, 20); shot("card-stories", frames(a, 1, scale = 2f))
    }
    /** M4: three residents — worry bubbles, a close-up, observation mode, the mailbox and timeline, the day-end card, games, talking, suggestions */
    @Test fun socialLifeAtHome() {
        val a = app()
        fun png(c: java.awt.Color) = java.io.ByteArrayOutputStream().also { val b = java.awt.image.BufferedImage(120, 160, java.awt.image.BufferedImage.TYPE_INT_ARGB)
            val g = b.createGraphics(); g.color = c; g.fillOval(20, 20, 80, 130); g.color = java.awt.Color.WHITE; g.fillOval(42, 50, 12, 12); g.fillOval(66, 50, 12, 12); g.dispose(); ImageIO.write(b, "png", it) }.toByteArray()
        fun char(name: String, c: java.awt.Color, spec: app.ocshimeji.sim.chars.CharSpec) = a.saves.saveCharacter(app.ocshimeji.save.media.Importer.prepare(app.ocshimeji.save.media.Importer.read(listOf(app.ocshimeji.save.media.Importer.Source("idle.png", png(c))), platform.codec)), spec.copy(name = name), 1, true, emptyMap(), emptyList())
        val b = char("小雨", java.awt.Color(0x7A, 0xAA, 0xD6), app.ocshimeji.sim.chars.CharSpec(traits = listOf("害羞", "書蟲"), tags = listOf("社畜"), likes = listOf("看書"), axes = listOf(-0.4f, -0.2f, 0f, -0.2f, 0.5f)))
        val c = char("團子", java.awt.Color(0xE0, 0x8A, 0x9A), app.ocshimeji.sim.chars.CharSpec(traits = listOf("好勝", "貪吃"), tags = listOf("吸血鬼"), likes = listOf("布丁"), temper = 0.4f))
        val ids = listOf(Presets.CINNAMON.id, b.id, c.id)
        val m = a.saves.createWorld("公寓", "楓糖鎮", "三房公寓", app.ocshimeji.sim.house.Houses.APARTMENT, ids, mapOf(ids[0] to "bed1", ids[1] to "bed2", ids[2] to "bed3"), platform.realMinute())
        a.saves.setFlag("tip:touch"); (a.screen as TitleScreen).open(m.id); frames(a, 3); val ws = a.screen as WorldScreen
        frames(a, 400); val sim = ws.sim; val (p1, p2, p3) = sim.life.people
        // a worry bubble over the head; tap it → the sheet with ways to help
        p1.worry = app.ocshimeji.sim.social.Worry("friend", p2.id, since = sim.life.minute, shown = true); frames(a, 10)
        shot("world-worry", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("worry:${p1.id}")); frames(a, 15); assertTrue(a.overlay is WorrySheet); shot("worry-sheet", frames(a, 1, scale = 2f))
        promptAnswer = "一起看書好嗎？"; assertTrue(a.tapZone("wc:say:chat")); frames(a, 15); shot("worry-answer", frames(a, 1, scale = 2f))
        assertNull(p1.worry); assertTrue(a.tapZone("worry:ok")); frames(a, 2)
        // a close-up when it matters: tell 肉桂捲 to give 小雨 a gift (command mode)
        sim.society.setControl(p1.id, "command"); assertTrue(sim.society.suggest(p1.id, "soc:gift", p2.id).isNotBlank())
        var seen = false; for (i in 0 until 1500) { frames(a, 1); if (ws.inCloseup) { frames(a, 50); if (ws.inCloseup) { shot("world-closeup", frames(a, 1, scale = 2f)); seen = true; break } } }
        assertTrue(seen, "no close-up for the gift"); frames(a, 400)
        // the person card with today's status, wish, plan, narrative and what you can do
        tapCard(a, ws, p2.id); assertTrue(a.overlay is PersonCard); shot("person-card-m4", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("card:talk")); frames(a, 15); assertTrue(a.tapZone("topic:how")); frames(a, 5); shot("talk-sheet", frames(a, 1, scale = 2f)); a.back()
        a.show(PersonCard(ws, p2.id)); frames(a, 15); assertTrue(a.tapZone("card:suggest")); frames(a, 15); assertTrue(a.tapZone("mode:suggest")); frames(a, 5); shot("suggest-sheet", frames(a, 1, scale = 2f)); a.back()
        a.show(PersonCard(ws, p1.id)); frames(a, 15); assertTrue(!a.hasZone("card:rps") && !a.hasZone("card:hide"), "no minigames with you (2.1.0)"); a.back(); frames(a, 5)
        a.show(PersonCard(ws, p1.id)); frames(a, 15); assertTrue(a.tapZone("ptab:log")); frames(a, 2); assertTrue(a.tapZone("card:more")); frames(a, 15); assertTrue(a.tapZone("row:mem")); frames(a, 15); shot("memory-sheet", frames(a, 1, scale = 2f)); a.back()
        // hide-and-seek: search the furniture
        // observation mode: the strip, the speeds, fast-forward to the next notable thing
        sim.life.clockMode = "GAME"; sim.life.speed = 1.0
        assertTrue(a.tapZone("observe")); frames(a, 30); assertTrue(ws.observing); shot("world-observe", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("spd:60")); assertEquals(60.0, sim.life.speed)
        val logBefore = sim.life.log.size; assertTrue(a.tapZone("ff")); frames(a, 1); assertTrue(ws.fastForwarding)
        var n = 0; while (ws.fastForwarding && n++ < 200) frames(a, 1); assertTrue(!ws.fastForwarding && sim.life.log.size > logBefore)
        while (a.overlay != null) { a.back(); frames(a, 1) }
        assertTrue(a.tapZone("observe")); frames(a, 5); assertTrue(!ws.observing); assertTrue(sim.life.speed <= 10.0, "30× / 60× end with observation")
        // the day-end card, the mailbox and the timeline
        sim.life.soc.cards += app.ocshimeji.sim.social.DayCard(1, listOf("肉桂捲：和小雨聊了甜點", "團子：送小雨一本舊書，小雨很開心", "小雨：心願實現了：想跟團子變熟")); frames(a, 15)
        assertTrue(a.overlay is DayCardSheet); shot("day-card", frames(a, 1, scale = 2f)); assertTrue(a.tapZone("dc:ok")); frames(a, 2)
        sim.society.mail(p1.id, "ask", "肉桂捲的請求", "可以給我餅乾嗎？")
        assertTrue(a.tapZone("nav:records")); frames(a, 10); assertTrue(a.tapZone("timeline")); frames(a, 15); assertTrue(a.screen is TimelineScreen); shot("mailbox", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("tab:log")); frames(a, 10); shot("timeline", frames(a, 1, scale = 2f))
        val first = a.zoneIds.first { it.startsWith("l:") }; assertTrue(a.tapZone(first)); assertTrue(sim.life.log[first.removePrefix("l:").toInt()].fav)
        assertTrue(a.tapZone("f:fav")); frames(a, 5); assertTrue(a.zoneIds.count { it.startsWith("l:") } == 1)
    }
    /** M6: the town (places, shops, board, ledger), moving house, decorating, the wallet */
    @Test fun theTownMovingAndDecorating() {
        val a = app()
        fun png(c: java.awt.Color) = java.io.ByteArrayOutputStream().also { val b = java.awt.image.BufferedImage(120, 160, java.awt.image.BufferedImage.TYPE_INT_ARGB)
            val g = b.createGraphics(); g.color = c; g.fillOval(20, 20, 80, 130); g.color = java.awt.Color.WHITE; g.fillOval(42, 50, 12, 12); g.fillOval(66, 50, 12, 12); g.dispose(); ImageIO.write(b, "png", it) }.toByteArray()
        fun char(name: String, c: java.awt.Color) = a.saves.saveCharacter(app.ocshimeji.save.media.Importer.prepare(app.ocshimeji.save.media.Importer.read(listOf(app.ocshimeji.save.media.Importer.Source("idle.png", png(c))), platform.codec)), app.ocshimeji.sim.chars.CharSpec(name = name), 1, true, emptyMap(), emptyList())
        val ids = listOf(Presets.CINNAMON.id, char("小雨", java.awt.Color(0x7A, 0xAA, 0xD6)).id, char("團子", java.awt.Color(0xE0, 0x8A, 0x9A)).id)
        val m = a.saves.createWorld("公寓", "楓糖鎮", "三房公寓", app.ocshimeji.sim.house.Houses.APARTMENT, ids, mapOf(ids[0] to "bed1", ids[1] to "bed2", ids[2] to "bed3"), platform.realMinute())
        a.saves.setFlag("tip:touch"); (a.screen as TitleScreen).open(m.id); frames(a, 3); val ws = a.screen as WorldScreen; val sim = ws.sim
        frames(a, 300); assertEquals(300, sim.economy.wallet)
        shot("world-m6", frames(a, 1, scale = 2f))
        // the wallet: goals and the ledger
        assertTrue(a.tapZone("wallet")); frames(a, 15); assertTrue(a.overlay is BoardSheet); shot("wallet-goals", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("bd:ledger")); frames(a, 10); assertTrue(a.screen is LedgerPage); a.back(); frames(a, 2)
        // the town: someone goes out, the grocery, the board
        sim.townLife.leave(sim.life.people[1]); assertTrue(a.tapZone("nav:town")); frames(a, 30); assertTrue(a.screen is TownScreen)
        shot("town", frames(a, 1, scale = 2f))
        // 1.5.1: the town is a scene you pinch and pan; the places stay tappable where they are drawn
        val ts = a.screen as TownScreen; val z0 = ts.zoom; ts.zoomBy(2f); assertTrue(ts.zoom > z0 * 1.5f); val cx0 = ts.camX; a.down(200f, 400f); a.move(260f, 420f); a.move(300f, 440f); a.up(300f, 440f); assertTrue(ts.camX < cx0)
        frames(a, 3); shot("town-zoom", frames(a, 1, scale = 2f)); ts.zoomBy(0.1f); assertEquals(z0, ts.zoom, 0.01f)
        assertTrue(a.tapZone("place:grocery")); frames(a, 15); shot("town-shop", frames(a, 1, scale = 2f))
        val food = sim.townLife.stock("grocery").first(); assertTrue(a.tapZone("row:${food.id}")); frames(a, 2); assertEquals(1, sim.economy.count(food.id)); assertEquals(300 - food.price, sim.economy.wallet)
        assertTrue(a.tapZone("place:furniture")); frames(a, 15); val f = sim.townLife.stock("furniture").first { it.furniture in setOf("plant", "lamp", "rug", "bench", "shelf") || true }
        assertTrue(a.tapZone("row:${f.id}")); frames(a, 2); assertEquals(1, sim.economy.count(f.id))
        assertTrue(a.tapZone("board")); frames(a, 15); assertTrue(a.overlay is BoardSheet); shot("town-board", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("bd:ledger")); frames(a, 10); shot("ledger", frames(a, 1, scale = 2f)); a.back(); frames(a, 2)
        assertTrue(sim.economy.consistent())
        // moving: everyone says what they think
        assertTrue(a.tapZone("more")); frames(a, 20); assertTrue(a.tapZone("row:move")); frames(a, 15); assertTrue(a.tapZone("row:bungalow")); frames(a, 15); assertTrue(a.overlay is MoveSheet); shot("move-sheet", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("mv:yes")); frames(a, 30); assertTrue(a.screen is WorldScreen); assertEquals("bungalow", sim.life.houseId)
        frames(a, 200); shot("world-bungalow", frames(a, 1, scale = 2f))
        // decorating: pick what you bought, tap the floor
        assertTrue(a.tapZone("nav:storage")); frames(a, 10); assertTrue(a.tapZone("place")); frames(a, 5); assertTrue(ws.placing); assertTrue(a.tapZone("pl:${f.id}"))
        val living = sim.house.rooms.first { it.kind == app.ocshimeji.sim.house.RoomKind.LIVING }
        loop@ for (y in living.y + 1 until living.y + living.h) for (x in living.x until living.x + living.w) { ws.placeAt(x, y); if (sim.economy.count(f.id) == 0) break@loop }
        assertEquals(0, sim.economy.count(f.id), "placed"); frames(a, 5); shot("world-placing", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("pl:undo")); assertEquals(1, sim.economy.count(f.id)); assertTrue(a.tapZone("pl:done")); assertTrue(!ws.placing)
        assertTrue(sim.economy.consistent())
    }
    /** M7: the journal pages, achievements, the book, the town as a scene, the café, decorating with scores, accessibility */
    @Test fun theJournalTheTownSceneAndSettings() {
        val a = app(); frames(a, 3); assertTrue(a.tapZone("a11y")); frames(a, 15); assertTrue(a.screen is SettingsPage); shot("settings", frames(a, 1, scale = 2f))
        /* 2.1.0: sound — four volumes and mute reach the platform; theme — always dark */
        assertTrue(a.tapZone("sound")); frames(a, 15); assertTrue(a.tapZone("snd:music:25")); frames(a, 2); assertEquals(25, a.volume("music")); assertEquals(listOf(0.25f, 1f, 1f, 1f), lastVolumes)
        assertTrue(a.tapZone("snd:mute")); frames(a, 2); assertEquals(0, a.volume("sfx")); assertEquals(listOf(0f, 0f, 0f, 0f), lastVolumes); shot("settings-sound", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("snd:mute")); a.back(); frames(a, 10)
        assertTrue(a.tapZone("theme")); frames(a, 15); assertTrue(a.tapZone("row:dark")); frames(a, 5); assertTrue(a.theme.dark); a.saves.setPref("ui:theme", null); frames(a, 2); assertTrue(!a.theme.dark)
        assertTrue(a.tapZone("screen")); frames(a, 15); assertTrue(a.overlay is A11ySheet); shot("a11y", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("ax:calm")); assertTrue(a.saves.flag("a11y:calm")); assertTrue(a.tapZone("ax:calm")); assertTrue(!a.saves.flag("a11y:calm")); a.back(); frames(a, 2); a.pop(); frames(a, 2)
        val m = a.saves.createWorld("庭院", "楓糖鎮", "庭院平房", app.ocshimeji.sim.house.Houses.BUNGALOW, listOf(Presets.CINNAMON.id), mapOf(Presets.CINNAMON.id to "bed1"), platform.realMinute())
        a.saves.setFlag("tip:touch"); (a.screen as TitleScreen).open(m.id); frames(a, 3); val ws = a.screen as WorldScreen; val sim = ws.sim; val p = sim.life.people[0]
        frames(a, 200)
        // a day passes: diary, counts
        sim.catchUp(sim.life.minute + 1440.0); frames(a, 5); while (a.overlay != null) { a.back(); frames(a, 1) }
        repeat(8) { sim.journal.did(p.id, "town") }
        a.push(JournalHub(ws)); frames(a, 10); shot("journal", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("diary")); frames(a, 10); assertTrue(a.screen is DiaryPage); shot("diary", frames(a, 1, scale = 2f)); a.back(); frames(a, 2)
        assertTrue(a.tapZone("ach")); frames(a, 10); val w0 = sim.economy.wallet; assertTrue(a.tapZone("a:town1")); assertTrue(sim.economy.wallet > w0); shot("achievements", frames(a, 1, scale = 2f)); a.back(); frames(a, 2)
        assertTrue(a.tapZone("book")); frames(a, 10); shot("book", frames(a, 1, scale = 2f)); a.back(); frames(a, 2)
        assertTrue(a.tapZone("titles")); frames(a, 10); a.back(); frames(a, 2); a.push(StatsPage(ws)); frames(a, 10); a.back(); frames(a, 2); a.back(); frames(a, 2)   /* 2.1.0: rows wrap and grow; the statistics row is below the fold */
        // the town as a scene: the resident in full at the café, treat them
        sim.townLife.leave(p); p.out!!.act = "coffee"; p.out!!.place = "cafe"; p.out!!.stage = "at"; p.out!!.until = sim.life.minute + 30
        assertTrue(a.tapZone("nav:town")); frames(a, 20); shot("town-scene", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("place:cafe"), "cafe"); frames(a, 15); assertTrue(a.tapZone("row:treat"), "treat row: ${a.overlay}"); frames(a, 2); assertTrue(p.moods.any { it.id == "treated" }, "treated")
        a.back(); frames(a, 2); p.out = null
        // decorating shows the room's line and scores; flip a piece
        assertTrue(a.tapZone("nav:storage")); frames(a, 10); assertTrue(a.tapZone("place")); frames(a, 3); val i = sim.decorate.pieces().indexOfFirst { it.kind == "sofa" }; val pc = sim.decorate.pieces()[i]
        ws.placeAt(pc.x, pc.y); assertEquals(i, ws.placeSel); assertTrue(a.tapZone("pl:flip")); assertTrue(sim.house.pieces[i].flip)
        frames(a, 5); shot("world-placing-m7", frames(a, 1, scale = 2f)); assertTrue(a.tapZone("pl:done"))
        assertTrue(sim.economy.consistent())
    }
    /** R1: memories with sounds and lines, replaying a day, starring a moment; long sheets scroll; the clock's notes */
    @Test fun memoriesReplayAndTheClock() {
        val a = app(); val ws = world(a); val sim = ws.sim
        sim.life.clockMode = "GAME"; sim.life.speed = 60.0; sim.catchUp(sim.life.minute + 10 * 60.0); frames(a, 5); while (a.overlay != null) { a.back(); frames(a, 1) }
        assertTrue(sim.life.log.any { it.sound.isNotBlank() && it.aside.isNotBlank() && it.dur >= 1 }, "memories have sounds, lines and lengths")
        a.push(MemoryScreen(ws)); frames(a, 10); val ms = a.screen as MemoryScreen
        shot("memories", frames(a, 1, scale = 2f))
        ms.playFor(1024); frames(a, 30); assertTrue(ms.shownCount in 1 until sim.life.log.size + 1, "replay shows what already happened"); shot("memories-replay", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("play")); val first = a.zoneIds.first { it.startsWith("l:") }; assertTrue(a.tapZone(first)); assertTrue(sim.life.log[first.removePrefix("l:").toInt()].fav)
        assertTrue(a.tapZone("tab:fav")); frames(a, 5); assertTrue(a.zoneIds.count { it.startsWith("l:") } == 1); a.back(); frames(a, 2)
        // a long sheet scrolls instead of turning pages
        a.show(ListSheet("很多", (1..30).map { "r$it" to "第 $it 行" }) {}); frames(a, 15); assertTrue(!a.hasZone("row:r30"))
        a.down(180f, 700f); for (i in 1..12) { a.move(180f, 700f - i * 60f); frames(a, 1) }; a.up(180f, 700f - 720f); frames(a, 30)
        assertTrue(a.hasZone("row:r30"), "scrolled to the end"); shot("sheet-scroll", frames(a, 1, scale = 2f)); a.back(); frames(a, 2)
        // the game date differs from the phone's: the clock says so
        sim.life.minute += 3 * 1440.0; frames(a, 3); shot("world-game-date", frames(a, 1, scale = 2f))
        // back to real time while ahead of the phone: time waits
        sim.life.clockMode = "REAL"; val m = sim.life.minute; frames(a, 30); assertTrue(sim.hold); assertEquals(m, sim.life.minute, 1e-6)
    }
    /** R2: the bottom navigation, the environment panel, storage with pictures, residents, records, screen transitions */
    @Test fun navigationEnvironmentAndStorage() {
        val a = app(); val ws = world(a); val sim = ws.sim; frames(a, 60)
        shot("world-r2", frames(a, 1, scale = 2f))
        // the environment panel: a special sky, a locked season, a pause — each recorded
        assertTrue(a.tapZone("clock")); frames(a, 15); assertTrue(a.overlay is EnvSheet); shot("env-sheet", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("w:petals")); assertEquals("petals", sim.sky()); assertTrue(a.tapZone("s:winter")); assertEquals("winter", sim.season())
        assertTrue(a.tapZone("t:pause")); assertTrue(sim.life.env.paused); val m = sim.life.minute; frames(a, 20); assertEquals(m, sim.life.minute, 1e-9)
        assertTrue(a.tapZone("t:pause")); assertTrue(!sim.life.env.paused); assertTrue(sim.life.env.changes.size >= 4)
        a.back(); frames(a, 30); shot("world-petals", frames(a, 1, scale = 2f))
        // storage: a grid with pictures; tap one for what to do
        sim.economy.earn(200, "測試"); for (g in listOf("pudding", "onigiri", "f:plant", "f:sofa", "w:flower", "v:carrot")) sim.economy.move(g, 2, "測試")
        assertTrue(a.tapZone("nav:storage")); frames(a, 12); assertTrue(a.screen is StoragePage); shot("storage", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("it:pudding")); frames(a, 15); assertTrue(a.overlay is ItemSheet); shot("item-sheet", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("ia:feed")); frames(a, 15); assertTrue(a.tapZone("row:${sim.life.people[0].id}")); frames(a, 3); assertEquals(1, sim.economy.count("pudding"))
        assertTrue(a.tapZone("tab:furn")); frames(a, 3); assertTrue(a.hasZone("it:f:plant") && !a.hasZone("it:pudding"))
        // residents and records; switching tabs goes back through the home
        assertTrue(a.tapZone("nav:people")); frames(a, 12); assertTrue(a.screen is ResidentsPage); assertEquals(3, a.screens.size); shot("residents", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("nav:records")); frames(a, 12); assertTrue(a.screen is JournalHub); assertEquals(3, a.screens.size); shot("records", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("nav:home")); frames(a, 5); assertTrue(a.screen === ws)
        assertTrue(sim.economy.consistent())
    }
    /** R3: the radial menu on everything, watching and directing, the queue of orders, the person card's three pages, dragging furniture in */
    @Test fun radialMenuDirectingAndTheQueue() {
        val a = app()
        fun png(c: java.awt.Color) = java.io.ByteArrayOutputStream().also { val b = java.awt.image.BufferedImage(120, 160, java.awt.image.BufferedImage.TYPE_INT_ARGB)
            val g = b.createGraphics(); g.color = c; g.fillOval(20, 20, 80, 130); g.color = java.awt.Color.WHITE; g.fillOval(42, 50, 12, 12); g.fillOval(66, 50, 12, 12); g.dispose(); ImageIO.write(b, "png", it) }.toByteArray()
        val b = a.saves.saveCharacter(app.ocshimeji.save.media.Importer.prepare(app.ocshimeji.save.media.Importer.read(listOf(app.ocshimeji.save.media.Importer.Source("idle.png", png(java.awt.Color(0x7A, 0xAA, 0xD6)))), platform.codec)), app.ocshimeji.sim.chars.CharSpec(name = "小雨"), 1, true, emptyMap(), emptyList())
        val ids = listOf(Presets.CINNAMON.id, b.id)
        val m = a.saves.createWorld("公寓", "楓糖鎮", "三房公寓", app.ocshimeji.sim.house.Houses.APARTMENT, ids, mapOf(ids[0] to "bed1", ids[1] to "bed2"), platform.realMinute())
        a.saves.setFlag("tip:touch"); (a.screen as TitleScreen).open(m.id); frames(a, 3); val ws = a.screen as WorldScreen
        val sim = ws.sim; ws.sim.life.people.forEach { it.recent["outing"] = sim.life.minute + 24 * 60.0 }; val (p1, p2) = sim.life.people; frames(a, 300)
        fun pie() = a.overlay as PieMenu
        fun find(label: (String) -> Boolean): Boolean { repeat(4) { val i = pie().ring.indexOfFirst { label(it.zh) }; if (i >= 0) { pie().tap("pie:$i"); frames(a, 8); return true }
            if (!pie().pick("更多")) return false; frames(a, 8) }; return false }
        // watching: a tap on a resident = what you can do with them
        var (x, y) = ws.screenOf(p1.id)!!; a.down(x, y); frames(a, 2); a.up(x, y); frames(a, 20)
        assertTrue(a.overlay is PieMenu); val ring = pie().ring.map { it.zh }; assertTrue(ring.containsAll(listOf("看看", "摸摸", "給點心", "聊天")) && "猜拳" !in ring && "躲貓貓" !in ring, "$ring"); assertTrue(ring.size <= 8)
        shot("pie-person", frames(a, 1, scale = 2f))
        assertTrue(pie().pick("摸摸")); frames(a, 5); assertNull(a.overlay)
        // a piece of furniture: ask someone to use it (a second ring of who), it becomes their order for that very piece
        sim.society.setControl(p1.id, "command")
        val pi = sim.house.pieces.indices.first { i -> app.ocshimeji.sim.act.Interactions.forPiece(sim, p1, i).any { it.ok && it.ia.op !in setOf("act:sleep", "act:nap", "act:sofanap") } }
        ws.screenOfPiece(pi).let { (px, py) -> ws.tapScene(px, py) }; frames(a, 15); assertTrue(a.overlay is PieMenu)
        shot("pie-piece", frames(a, 1, scale = 2f))
        val use = app.ocshimeji.sim.act.Interactions.forPiece(sim, p1, pi).first { it.ok && it.ia.by == "them" && it.ia.op !in setOf("act:sleep", "act:nap", "act:sofanap") }
        assertTrue(find { it == "叫誰來${use.ia.zh}" }, "叫誰來${use.ia.zh}"); assertTrue(pie().level >= 2); assertTrue(pie().pick(p1.name)); frames(a, 3)
        assertEquals(use.what, p1.order, "an order for that piece")
        // directing: switch on, pick 肉桂捲, tap 小雨 → the social acts, grouped; each one goes into the queue
        assertTrue(a.tapZone("ctl")); assertTrue(ws.control); assertTrue(a.tapZone("who:${p1.id}")); assertEquals(p1.id, ws.picked)
        repeat(30) { frames(a, 1) }
        ws.screenOf(p2.id)!!.let { x = it.first; y = it.second }; a.down(x, y); frames(a, 2); a.up(x, y); frames(a, 20)
        assertTrue(a.overlay is PieMenu); assertTrue(pie().ring.size <= 8); assertTrue(pie().ring.any { it.kids != null }, "grouped by kind"); shot("pie-social", frames(a, 1, scale = 2f))
        assertTrue(find { it == "打招呼" }); assertTrue(find { it == "揮手" }); frames(a, 3)
        assertTrue(sim.society.pending(p1).any { it == "soc:wave:${p2.id}" }, "${sim.society.pending(p1)}")
        // the floor: a spot to go to (a real tap where nobody stands)
        val spot = (0 until sim.house.w).flatMap { tx -> (0 until sim.house.h).map { tx to it } }.first { (tx, ty) -> val r = sim.house.roomAt(tx, ty)
            r != null && ty > r.y && sim.grid.walkable(tx, ty) && app.ocshimeji.sim.act.Interactions.forFloor(sim, p1, tx, ty).any { it.ok } &&
                sim.life.people.none { kotlin.math.abs(it.x - tx - 0.5f) < 1.5f && kotlin.math.abs(it.y - ty - 0.5f) < 2.5f } && sim.house.pieces.none { pc -> val k = app.ocshimeji.sim.house.Furniture.kind(pc.kind); tx >= pc.x && tx < pc.x + k.w && ty >= pc.y - 1 && ty < pc.y + k.h } }
        ws.screenOfTile(spot.first, spot.second).let { (fx, fy) -> a.down(fx, fy); frames(a, 2); a.up(fx, fy) }; frames(a, 15)
        assertTrue(a.overlay is PieMenu, "the floor has a menu too"); assertTrue(pie().title.endsWith("這裡"))
        val before = sim.society.pending(p1).size
        println("floor ring: " + pie().ring.map { it.zh + (it.kids?.size ?: "") })
        pie().ring.firstOrNull { it.kids != null && it.zh != "更多" }?.let { assertTrue(pie().pick(it.zh)); frames(a, 8) }; val first = pie().ring.indexOfFirst { it.why == null && it.kids == null }; pie().tap("pie:$first"); frames(a, 3)
        assertEquals(before + 1, sim.society.pending(p1).size); assertTrue(sim.society.pending(p1).last().contains("@t${spot.first},${spot.second}"))
        frames(a, 10); shot("world-queue", frames(a, 1, scale = 2f))
        // the queue: ✕ cancels one; tapping the one you direct = their own menu (clear, stop, go out…)
        val n0 = sim.society.pending(p1).size; assertTrue(a.tapZone("q:${n0 - 1}")); frames(a, 20); assertTrue(a.tapZone("row:cancel")); assertEquals(n0 - 1, sim.society.pending(p1).size)
        ws.menuPerson(p1, p1, 180f, 400f); frames(a, 15); assertTrue(pie().ring.any { it.zh == "停下來" }); assertTrue(pie().pick("清空排程")); frames(a, 2); assertTrue(sim.society.pending(p1).isEmpty())
        // the sky above the house: the environment, recorded
        ws.tapScene(180f, a.insetTop + 90f); frames(a, 15); assertTrue(a.overlay is PieMenu); assertEquals("天空", pie().title)
        assertTrue(find { it == "天象" }); assertTrue(pie().pick("流星雨")); frames(a, 2); assertEquals("stars", sim.sky())
        // the person card: now / relationships / records
        assertTrue(a.tapZone("ctl")); assertFalse(ws.control)
        a.show(PersonCard(ws, p1.id)); frames(a, 15); assertTrue(a.tapZone("ptab:rels")); frames(a, 5); shot("card-rels", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("ptab:log")); frames(a, 5); shot("card-log", frames(a, 1, scale = 2f))
        // 2.2.0: their inner life
        sim.inner.note(p1, sim.life.people[1].id, "${sim.life.people[1].name}送的一朵小花", "warm", 2, "flower")
        sim.life.inner.goals += app.ocshimeji.sim.social.GoalRec(p1.id, "read", "今天想把書看完，然後再去澆花、寫日記，最後整理一下房間", listOf("read"), 2, 1, sim.life.day)
        sim.life.inner.routines += app.ocshimeji.sim.social.Routine(p1.id, "tea", 2, sim.life.day, sim.life.day)
        sim.inner.first(p1, "habit", "第一個自己養成的習慣：早上泡一杯茶")
        assertTrue(a.tapZone("ptab:inner")); frames(a, 5); shot("card-inner", frames(a, 1, scale = 2f)); a.back(); frames(a, 2)
        // decorating: drag a piece from the bag onto the floor
        sim.economy.earn(100, "測試"); sim.economy.move("f:plant", 1, "測試"); ws.setPlacing(true); frames(a, 10)
        val chip = a.zoneRect("pl:f:plant")!!; val n = sim.house.pieces.size
        val (dx, dy) = ws.screenOfTile(spot.first, spot.second)
        a.down(chip.x + chip.w / 2, chip.y + chip.h / 2); frames(a, 1)
        for (i in 1..8) { a.move(chip.x + chip.w / 2 + (dx - chip.x - chip.w / 2) * i / 8, chip.y + chip.h / 2 + (dy + 34 - chip.y - chip.h / 2) * i / 8); frames(a, 1) }
        assertEquals("f:plant", ws.draggingBag); shot("drag-place", frames(a, 1, scale = 2f)); a.up(dx, dy + 34); frames(a, 3)
        assertEquals(n + 1, sim.house.pieces.size, "dropped on the floor = placed"); assertEquals(0, sim.economy.count("f:plant"))
        ws.setPlacing(false); assertTrue(sim.economy.consistent())
    }
    /** R4: the creator in seven steps — live reactions, voice preview, exclusive traits, three-state likes, how they call everyone, custom events; editing from the title screen */
    @Test fun sevenStepCreatorAndEditingFromTheTitle() {
        val a = app()
        fun png(c: java.awt.Color) = java.io.ByteArrayOutputStream().also { val b = java.awt.image.BufferedImage(120, 160, java.awt.image.BufferedImage.TYPE_INT_ARGB)
            val g = b.createGraphics(); g.color = c; g.fillOval(20, 20, 80, 130); g.color = java.awt.Color.WHITE; g.fillOval(42, 50, 12, 12); g.fillOval(66, 50, 12, 12); g.dispose(); ImageIO.write(b, "png", it) }.toByteArray()
        val b = a.saves.saveCharacter(app.ocshimeji.save.media.Importer.prepare(app.ocshimeji.save.media.Importer.read(listOf(app.ocshimeji.save.media.Importer.Source("idle.png", png(java.awt.Color(0x7A, 0xAA, 0xD6)))), platform.codec)), app.ocshimeji.sim.chars.CharSpec(name = "小雨"), 1, true, emptyMap(), emptyList())
        val ids = listOf(Presets.CINNAMON.id, b.id)
        val m = a.saves.createWorld("公寓", "楓糖鎮", "三房公寓", app.ocshimeji.sim.house.Houses.APARTMENT, ids, mapOf(ids[0] to "bed1", ids[1] to "bed2"), platform.realMinute())
        (a.screen as TitleScreen).reload(); frames(a, 10); shot("title-r4", frames(a, 1, scale = 2f))
        // 編輯角色 from the title: no need to go in
        assertTrue(a.tapZone("ewc:${m.id}")); frames(a, 15); val pid = a.saves.loadWorld(m.id)!!.life!!.people[0].id
        assertTrue(a.tapZone("row:$pid")); frames(a, 15); val ed = a.screen as CharacterEditor; assertEquals(10, ed.tabs.size)
        // step 3: every voice change speaks
        assertTrue(a.tapZone("tab:2")); frames(a, 3); assertTrue(a.tapZone("step:pitch:+")); assertNotNull(ed.said, "the voice is heard at once")
        // step 4: sliders → a reaction and 「這樣的人會…」
        assertTrue(a.tapZone("tab:3")); frames(a, 3); repeat(3) { assertTrue(a.tapZone("step:axis0:+")) }; assertTrue(ed.said!!.contains("聊天"), "${ed.said}"); frames(a, 4); shot("creator-axes", frames(a, 1, scale = 2f))
        // step 5: exclusive pairs, joined by ×
        assertTrue(a.tapZone("tab:4")); frames(a, 3); assertTrue(tapIn(a, ed, "chip:trait:健談")); frames(a, 2); assertTrue(tapIn(a, ed, "chip:trait:害羞"))
        assertTrue("健談" in ed.spec.traits && "害羞" !in ed.spec.traits, "the other side is greyed out"); assertTrue(a.toastText!!.contains("只能選一個"))
        frames(a, 4); shot("creator-traits", frames(a, 1, scale = 2f))
        // step 6: like → dislike → neither
        assertTrue(a.tapZone("tab:5")); frames(a, 3); assertTrue(tapIn(a, ed, "chip:like:布丁")); assertTrue("布丁" in ed.spec.likes); assertTrue(ed.said!!.contains("布丁"))
        assertTrue(tapIn(a, ed, "chip:like:布丁")); assertTrue("布丁" in ed.spec.dislikes && "布丁" !in ed.spec.likes); assertTrue(tapIn(a, ed, "chip:like:晴天")); frames(a, 4); shot("creator-likes", frames(a, 1, scale = 2f))
        assertTrue(tapIn(a, ed, "chip:like:布丁")); assertTrue("布丁" !in ed.spec.dislikes)
        // step 7: how they call you and 小雨, moods, catchphrase places, a custom event
        assertTrue(a.tapZone("tab:6")); frames(a, 3)
        promptAnswer = "主人"; ed.tap("row:aClose"); assertEquals("主人", ed.spec.address.close); promptAnswer = "親愛的"; ed.tap("row:aDear")
        promptAnswer = "雨雨"; ed.tap("row:aOther:${b.id}"); ed.tap("chip:tone_${b.id}:撒嬌"); assertEquals(app.ocshimeji.sim.chars.Call("雨雨", "撒嬌"), ed.spec.address.others[b.id])
        ed.tap("chip:mood_angry:正式"); assertEquals("正式", ed.spec.address.moods["angry"]); ed.tap("chip:cwhen:打招呼"); assertEquals(listOf("greet"), ed.spec.address.catchWhen)
        promptAnswer = "（對著窗戶哼了一首歌）"; ed.tap("btn:addhabit"); assertEquals(1, ed.spec.habits.size); ed.tap("hab:0:f:2"); assertEquals(2, ed.spec.habits[0].freq)
        frames(a, 4); shot("creator-speech", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("save")); frames(a, 10); assertTrue(a.screen is TitleScreen)
        val spec = a.saves.loadWorld(m.id)!!.life!!.people.first { it.id == pid }.spec
        assertEquals("親愛的", spec.callFor(90)); assertEquals("主人", spec.callFor(60)); assertEquals(1, spec.habits.size); assertTrue(a.saves.backups(m.id).any { it.endsWith("-edit") }, "a backup first")
        // 編輯世界: the clock, without going in
        assertTrue(a.tapZone("eww:${m.id}")); frames(a, 15); shot("edit-world", frames(a, 1, scale = 2f)); assertTrue(a.tapZone("row:clock")); frames(a, 2)
        assertEquals("GAME", a.saves.loadWorld(m.id)!!.life!!.clockMode)
        // and the world still opens, with the new settings
        (a.screen as TitleScreen).open(m.id); frames(a, 20); val ws = a.screen as WorldScreen; assertEquals("主人", ws.sim.person(pid)!!.spec.address.close)
    }
    /** R5: the house looks lived in — window light by the hour, beds and tables and shelves with their states, things on the floor, lamps at night, the seasons outside, rain */
    @Test fun theHouseLooksLivedIn() {
        val a = app()
        val m = a.saves.createWorld("庭院", "楓糖鎮", "庭院平房", app.ocshimeji.sim.house.Houses.BUNGALOW, listOf(Presets.CINNAMON.id), mapOf(Presets.CINNAMON.id to "bed1"), platform.realMinute())
        a.saves.setFlag("tip:touch"); (a.screen as TitleScreen).open(m.id); frames(a, 3); val ws = a.screen as WorldScreen; val sim = ws.sim
        sim.life.people.forEach { it.recent["outing"] = sim.life.minute + 24 * 60.0 }; frames(a, 200)
        sim.life.clockMode = "GAME"; sim.life.speed = 1.0
        fun at(h: Double) { assertNull(sim.env.jumpTo(h)); sim.env.setPaused(true); frames(a, 20); var k = 0; while (a.overlay != null && k++ < 5) { if (!a.tapZone("dc:ok")) a.back(); frames(a, 15) } }
        fun piece(kind: String) = sim.house.pieces.indices.first { sim.house.pieces[it].kind == kind }
        // morning: sun through the windows, spring trees
        assertNull(sim.env.setSeason("spring")); assertNull(sim.env.setWeather("sunny")); at(9.0)
        assertEquals("open", sim.stateOf(piece("window"))); shot("r5-morning", frames(a, 1, scale = 2f))
        // what life leaves behind
        val bed = sim.house.pieces.indices.first { sim.house.pieces[it].kind.startsWith("bed") }; sim.life.things[sim.pieceKey(bed)] = "messy"
        sim.house.pieces.indices.firstOrNull { sim.house.pieces[it].kind == "shelf" }?.let { sim.life.things[sim.pieceKey(it)] = "out" }
        sim.life.soc.dishes = 2; sim.life.soc.pot = null; val p = sim.life.people[0]
        val spots = (0 until sim.house.w).flatMap { x -> (0 until sim.house.h).map { x to it } }.filter { (x, y) -> sim.grid.walkable(x, y) && sim.house.roomAt(x, y)?.id == sim.roomOf(p) }
        for ((i, k) in listOf("wrapper", "book", "cup").withIndex()) spots.getOrNull(i * 2 + 1)?.let { (x, y) -> sim.life.litter += app.ocshimeji.sim.life.Litter(k, x, y) }
        assertEquals("messy", sim.stateOf(bed)); assertTrue(sim.stateOf(piece("table")) in setOf("dishes", "food")); frames(a, 5)   /* food while someone is still eating breakfast */; shot("r5-states", frames(a, 1, scale = 2f))
        assertTrue(PieceCache.size > 0 && PieceCache.hits > 0 && PieceCache.bytes <= PieceCache.maxBytes)   /* 1.5.1: still furniture is drawn from pictures */
        // night: curtains drawn, a lamp on where someone is awake, the street lamp
        sim.env.setPaused(false); at(21.5); assertEquals("closed", sim.stateOf(piece("window"))); shot("r5-night", frames(a, 1, scale = 2f))
        // the seasons and the rain outside
        sim.env.setPaused(false); at(14.0); assertNull(sim.env.setSeason("autumn")); frames(a, 20); while (a.overlay != null) { a.back(); frames(a, 10) }; shot("r5-autumn", frames(a, 1, scale = 2f))
        assertNull(sim.env.setSeason("winter")); assertNull(sim.env.setWeather("snow")); frames(a, 5); shot("r5-winter", frames(a, 1, scale = 2f))
        assertNull(sim.env.setSeason("summer")); assertNull(sim.env.setWeather("rain")); frames(a, 5); shot("r5-rain", frames(a, 1, scale = 2f))
        // tidying clears the floor of that room
        sim.env.setPaused(false); sim.society.setControl(p.id, "command"); p.setNeed(app.ocshimeji.sim.life.Need.ROOM, 10f); sim.society.suggest(p.id, "tidy")
        var n = 0; while (n++ < 3000 && sim.life.litter.any { sim.house.roomAt(it.x, it.y)?.id == sim.roomOf(p) }) frames(a, 1)
        assertTrue(sim.life.litter.none { sim.house.roomAt(it.x, it.y)?.id == sim.roomOf(p) }, "tidied")
    }
    /** M5: the creator suite — paint (strokes, colours, layers, drafts, leave warning), animation studio, items, scripts, tags, space, decor */
    @Test fun theCreatorSuite() {
        val a = app(); a.push(LibraryScreen()); frames(a, 5)
        assertTrue(a.tapZone("create")); frames(a, 10); assertTrue(a.screen is CreateHub); shot("create-hub", frames(a, 1, scale = 2f))
        // ---- paint: a new character canvas, strokes with two colours, a layer, undo and redo, a draft
        assertTrue(a.tapZone("paint")); frames(a, 5); assertTrue(a.tapZone("new")); frames(a, 15); assertTrue(a.tapZone("row:CHARACTER")); frames(a, 5)
        val ps = a.screen as PaintScreen; val doc = ps.doc
        fun stroke(pts: List<Pair<Float, Float>>) { a.down(pts[0].first, pts[0].second); for (p0 in pts.drop(1)) { a.move(p0.first, p0.second); frames(a, 1) }; a.up(pts.last().first, pts.last().second) }
        doc.brush.size = 60f; doc.brush.color = 0xFFF4A259.toInt()
        stroke((0..20).map { 180f + 50 * kotlin.math.cos(it * 0.31f) to 330f + 70 * kotlin.math.sin(it * 0.31f) })
        assertEquals(1, doc.undoCount); assertTrue(doc.layer.r.px.any { (it ushr 24) > 0 }, "the finger drew")
        assertTrue(a.tapZone("color")); frames(a, 15); assertTrue(a.overlay is ColorSheet); shot("paint-color", frames(a, 1, scale = 2f)); assertTrue(a.tapZone("c:13")); assertTrue(a.tapZone("ok")); frames(a, 2)
        assertTrue(a.tapZone("layers")); frames(a, 15); assertTrue(a.tapZone("add")); frames(a, 2); assertEquals(2, doc.layers.size); shot("paint-layers", frames(a, 1, scale = 2f)); a.back(); frames(a, 2)
        doc.brush.size = 20f; stroke((0..10).map { 120f + it * 12f to 260f + it * 4f })
        assertTrue(a.tapZone("undo")); frames(a, 2); assertTrue(a.tapZone("redo")); frames(a, 2)
        shot("paint", frames(a, 1, scale = 2f))
        assertTrue(a.back()); frames(a, 15); assertTrue(a.overlay is ListSheet, "leaving with changes asks first"); assertTrue(a.tapZone("row:keep")); frames(a, 5)
        assertTrue(a.screen is DraftsPage); assertEquals(1, app.ocshimeji.save.Studio(a.saves).drafts().size); shot("drafts", frames(a, 1, scale = 2f)); a.back(); frames(a, 5)
        // ---- a character from the drawing, then its animation studio
        val c = app.ocshimeji.save.Studio(a.saves).charFromDrawing(doc, app.ocshimeji.sim.chars.CharSpec(name = "手繪君"))
        a.push(AnimStudio(c)); frames(a, 10); assertTrue(a.tapZone("addframe")); frames(a, 5); val fp = a.screen as PaintScreen
        assertTrue(fp.doc.layers.any { it.trace }, "onion skin: the frame before is shown faintly")
        fp.doc.brush.size = 30f; stroke((0..8).map { 160f + it * 6f to 300f })
        assertTrue(a.tapZone("done")); frames(a, 5); assertTrue(a.screen is AnimStudio)
        assertTrue(a.tapZone("mode:pingpong")); assertTrue(a.tapZone("event")); frames(a, 15); assertTrue(a.tapZone("row:fx:heart")); frames(a, 5)
        shot("anim-studio", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("save")); frames(a, 2); val idle = a.saves.libChar(c.id)!!.anims["idle"]!!; assertEquals(2, idle.frames.size); assertEquals("pingpong", idle.playMode)
        assertTrue(a.tapZone("chain")); frames(a, 15); shot("anim-chain", frames(a, 1, scale = 2f)); a.back(); a.back(); frames(a, 5)
        // ---- an item: food with a picture
        assertTrue(a.tapZone("items")); frames(a, 5); assertTrue(a.tapZone("new")); frames(a, 5)
        assertTrue(a.tapZone("pic:front")); frames(a, 15); assertTrue(a.tapZone("row:import")); frames(a, 5)
        promptAnswer = "手作布丁"; assertTrue(a.tapZone("name")); frames(a, 2)
        shot("item-editor", frames(a, 1, scale = 2f)); assertTrue(a.tapZone("save")); frames(a, 5); assertEquals("手作布丁", app.ocshimeji.save.Studio(a.saves).items().single().name)
        // a wallpaper drawn on a seamless canvas
        app.ocshimeji.save.Studio(a.saves).saveItem(app.ocshimeji.save.LibItem("", "格子壁紙", "wallpaper"), app.ocshimeji.save.media.Raster(32, 32, IntArray(32 * 32) { i -> if ((i % 32 / 8 + i / 32 / 8) % 2 == 0) 0xFFF6D0B8.toInt() else 0xFFFFF4E4.toInt() }))
        shot("items", frames(a, 1, scale = 2f)); a.back(); frames(a, 5)
        // ---- a script in blocks
        assertTrue(a.tapZone("scripts")); frames(a, 5); assertTrue(a.tapZone("new")); frames(a, 10); assertTrue(a.screen is ScriptEditor); shot("script-editor", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("save")); frames(a, 5); assertEquals(1, app.ocshimeji.save.Studio(a.saves).scripts().size); a.back(); frames(a, 5)
        // ---- a tag
        promptAnswer = "烘焙魂"; assertTrue(a.tapZone("tags")); frames(a, 5); assertTrue(a.tapZone("new")); frames(a, 5); assertTrue(a.screen is TagEditor)
        repeat(3) { assertTrue(a.tapZone("a+:food")) }; shot("tag-editor", frames(a, 1, scale = 2f)); assertTrue(a.tapZone("save")); frames(a, 5); assertEquals(1.6f, app.ocshimeji.save.Studio(a.saves).tags().single().act["food"]!!, 0.01f)
        a.back(); frames(a, 5); assertTrue(a.tapZone("space")); frames(a, 5); shot("space", frames(a, 1, scale = 2f)); a.back(); a.back(); a.back(); frames(a, 5)
        // ---- at home: the drawn character with a tail that sways (mesh), the wallpaper, the food in the snack menu
        a.saves.addLibChar(a.saves.libChar(c.id)!!.copy(marks = mapOf("尾巴" to app.ocshimeji.save.Mark(0.8f, 0.7f, 0.15f), "頭" to app.ocshimeji.save.Mark(0.5f, 0.3f, 0.2f)), anims = emptyMap()))
        val ws = world(a, listOf(c.id)); frames(a, 200)
        assertTrue(ws.sim.snacks.any { it.second == "手作布丁" }, "the item came into the world"); assertEquals(1, ws.sim.life.scripts.size); assertEquals(1, ws.sim.life.tags.size)
        assertTrue(a.tapZone("nav:storage")); frames(a, 10); assertTrue(a.tapZone("decor")); frames(a, 15); assertTrue(a.overlay is DecorSheet)
        val wz = a.zoneIds.first { it.startsWith("wallpaper:") && it.length > 10 }; assertTrue(a.tapZone(wz)); frames(a, 2); shot("decor", frames(a, 1, scale = 2f)); a.back(); frames(a, 30)
        assertTrue(ws.sim.life.decor["main"]?.wall?.isNotBlank() == true); shot("world-decor", frames(a, 1, scale = 2f))
    }
    @Test fun anM0WorldGetsAHouseWhenOpened() {
        val a = app(); val m = a.saves.create("舊世界", listOf(Presets.CINNAMON.id)); (a.screen as TitleScreen).reload(); frames(a, 2)
        (a.screen as TitleScreen).open(m.id); frames(a, 5); val ws = a.screen as WorldScreen
        assertEquals("studio", ws.sim.life.houseId); assertNotNull(a.saves.loadWorld(m.id)!!.life)
    }
    @Test fun saveActionsCopyBranchRenameDelete() {
        val a = app(); val m = a.saves.create("測試小鎮", listOf(Presets.CINNAMON.id)); (a.screen as TitleScreen).reload(); frames(a, 5)
        fun act(row: String) { assertTrue(a.tapZone("more:${m.id}")); frames(a, 12); assertTrue(a.tapZone("row:$row"), "row $row"); frames(a, 3) }
        act("copy"); assertEquals(2, a.saves.slots().size); assertEquals("複製了一份", a.toastText)
        act("branch"); assertEquals(3, a.saves.slots().size)
        promptAnswer = "改過的名字"; act("rename"); assertEquals("改過的名字", a.saves.slot(m.id)!!.name)
        act("delete"); assertTrue(a.overlay is Confirm); assertEquals(3, a.saves.slots().size)   /* not yet */
        frames(a, 12); shot("confirm-delete", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("confirm:ok")); assertNull(a.saves.slot(m.id)); assertEquals(2, a.saves.slots().size)
    }
    @Test fun aMenuThatJustAppearedIgnoresTapsAndOutsideCloses() {
        val a = app(); val m = a.saves.create("A", listOf(Presets.CINNAMON.id)); (a.screen as TitleScreen).reload(); frames(a, 3)
        assertTrue(a.tapZone("more:${m.id}")); frames(a, 1)
        assertTrue(a.tapZone("row:delete")); assertTrue(a.overlay is ListSheet, "the first 0.3 s ignore presses")
        frames(a, 12); a.down(10f, 10f); a.up(10f, 10f); assertNull(a.overlay, "a tap outside closes the sheet")
        assertTrue(a.tapZone("more:${m.id}")); frames(a, 12); assertTrue(a.back()); assertNull(a.overlay, "back closes the sheet first")
        assertFalse(a.back(), "back on the first screen = leave the app")
    }
    @Test fun scrollingAManySavesList() {
        val a = app(); repeat(8) { i -> now += 1000; a.saves.create("小鎮 $i", listOf(Presets.CINNAMON.id)) }; (a.screen as TitleScreen).reload(); frames(a, 5)
        val before = a.zoneIds.size; a.down(180f, 700f); for (i in 1..20) { a.move(180f, 700f - i * 25); frames(a, 1) }; a.up(180f, 200f); frames(a, 30)
        assertTrue(a.hasZone("slot:" + a.saves.slots().last().id)); assertTrue(before > 0)
        shot("title-many-scrolled", frames(a, 1, scale = 2f))
    }

    // ---------------- 1.5.1: the backlog of R1–R5, one scenario each ----------------
    private fun blueChar(a: UiApp): app.ocshimeji.save.LibChar {
        val bos = java.io.ByteArrayOutputStream(); val b = BufferedImage(120, 160, BufferedImage.TYPE_INT_ARGB)
        val g = b.createGraphics(); g.color = java.awt.Color(0x7A, 0xAA, 0xD6); g.fillOval(20, 20, 80, 130); g.color = java.awt.Color.WHITE; g.fillOval(42, 50, 12, 12); g.fillOval(66, 50, 12, 12); g.dispose(); ImageIO.write(b, "png", bos)
        return a.saves.saveCharacter(app.ocshimeji.save.media.Importer.prepare(app.ocshimeji.save.media.Importer.read(listOf(app.ocshimeji.save.media.Importer.Source("idle.png", bos.toByteArray())), platform.codec)), app.ocshimeji.sim.chars.CharSpec(name = "小雨"), 1, true, emptyMap(), emptyList())
    }
    /** an apartment with 肉桂捲 and 小雨, opened; everyone stays home */
    private fun home2(a: UiApp): WorldScreen {
        val b = blueChar(a); val ids = listOf(Presets.CINNAMON.id, b.id)
        val m = a.saves.createWorld("公寓", "楓糖鎮", "三房公寓", app.ocshimeji.sim.house.Houses.APARTMENT, ids, mapOf(ids[0] to "bed1", ids[1] to "bed2"), platform.realMinute())
        a.saves.setFlag("tip:touch"); (a.screen as TitleScreen).open(m.id); frames(a, 3); val ws = a.screen as WorldScreen
        ws.sim.life.people.forEach { it.recent["outing"] = ws.sim.life.minute + 24 * 60.0 }; frames(a, 200)
        var k = 0; while (a.overlay != null && k++ < 5) { if (!a.tapZone("dc:ok")) a.back(); frames(a, 15) }
        return ws
    }
    private fun center(a: UiApp, id: String): Pair<Float, Float> { val z = a.zoneRect(id)!!; return (z.x + z.w / 2) to (z.y + z.h / 2) }

    @Test fun toastsSitAtTheTopAndTapAway() {
        val a = app(); val ws = home2(a)
        a.toast("這是一則比較長的提示，會換成兩行，點一下就收起來，不會擋住下面的按鈕"); frames(a, 5); assertNotNull(a.toastText)
        shot("toast-top", frames(a, 1, scale = 2f))
        assertTrue(a.tapToast()); assertNull(a.toastText, "a tap puts it away")
        a.toast("提示"); frames(a, 3); assertTrue(a.tapZone("ctl")); assertTrue(ws.control, "a button under the toast still works")
    }
    @Test fun givingFoodByDragging() {
        val a = app(); val ws = home2(a); val sim = ws.sim; val p = sim.life.people[0]
        val food = app.ocshimeji.sim.town.Goods.ALL.values.first { it.kind == "food" }.id; assertTrue(sim.economy.move(food, 1, "測試")); p.setNeed(app.ocshimeji.sim.life.Need.FOOD, 20f)
        assertTrue(a.tapZone("nav:storage")); frames(a, 20); assertTrue(a.tapZone("it:$food")); frames(a, 15); assertTrue(a.tapZone("ia:drag")); frames(a, 20)
        assertTrue(a.screen === ws); assertEquals(food, ws.giving); shot("give-drag", frames(a, 1, scale = 2f))
        val (cx, cy) = center(a, "give:chip"); val r = ws.rectOf(p.id)!!; val tx = r[0] + r[2] / 2; val ty = r[1] + r[3] / 2 + 34
        a.down(cx, cy); for (i in 1..12) { a.move(cx + (tx - cx) * i / 12, cy + (ty - cy) * i / 12); frames(a, 1) }; a.up(tx, ty); frames(a, 3)
        assertEquals(0, sim.economy.count(food), "given"); assertTrue(sim.economy.consistent()); assertTrue(p.need(app.ocshimeji.sim.life.Need.FOOD) > 20f)
    }
    @Test fun theQueueCanBeReordered() {
        val a = app(); val ws = home2(a); val sim = ws.sim; val p = sim.life.people[0]
        assertTrue(a.tapZone("ctl")); assertTrue(a.tapZone("who:${p.id}")); sim.society.setControl(p.id, "command")
        for (op in listOf("hum", "daydream", "music", "stretch")) sim.society.suggest(p.id, op, queue = true)
        frames(a, 5); val before = sim.society.pending(p); assertTrue(before.size >= 3, "$before")
        assertTrue(a.tapZone("q:2")); frames(a, 15); shot("queue-order", frames(a, 1, scale = 2f)); assertTrue(a.tapZone("row:up")); frames(a, 3)
        val after = sim.society.pending(p); assertEquals(before[2], after[1]); assertEquals(before[1], after[2])
    }
    @Test fun slidersDragAndAccessories() {
        val a = app(); val b = blueChar(a); var saved: app.ocshimeji.save.LibChar? = null
        a.push(CharacterEditor(b, b.specOf(), title = "小雨") { s, ch -> saved = ch.copy(spec = s); a.saves.updateLibChar(ch.copy(spec = s)) }); frames(a, 20); val ed = a.screen as CharacterEditor
        assertTrue(a.tapZone("tab:3")); frames(a, 5); ed.slide("axis0", 0.95f); assertTrue(ed.spec.axis(0) > 0.7f, "${ed.spec.axis(0)}")
        ed.slide("axis0", 0.05f); assertTrue(ed.spec.axis(0) < -0.7f); assertNotNull(ed.said)
        assertTrue(a.tapZone("tab:0")); frames(a, 5)
        assertTrue(tapIn(a, ed, "chip:sticker:${app.ocshimeji.save.Sticker.KINDS["ribbon"]}")); frames(a, 3); assertTrue(tapIn(a, ed, "step:stsize:+")); assertTrue(tapIn(a, ed, "step:sty:-"))
        assertTrue(a.tapZone("chip:sticker:${app.ocshimeji.save.Sticker.KINDS["glasses"]}")); frames(a, 10); shot("editor-stickers", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("save")); frames(a, 5); val c = a.saves.libChar(b.id)!!
        assertEquals(listOf("ribbon", "glasses"), c.stickers.map { it.kind }); assertTrue(c.stickers[0].size > 1f); assertTrue(c.specOf().axis(0) < -0.7f)
    }
    @Test fun jobsBySetting() {
        val a = app(); val b = blueChar(a)
        a.push(CharacterEditor(b, b.specOf(), title = "小雨") { s, ch -> a.saves.updateLibChar(ch.copy(spec = s)) }); frames(a, 20)
        assertTrue(a.tapZone("tab:4")); frames(a, 5); (a.screen as CharacterEditor).tap("btn:tagpick"); frames(a, 15); val ts = a.overlay as TagSheet   /* the button is further down the page */
        assertTrue(a.tapZone("cat:JOB")); frames(a, 3); assertTrue(a.hasZone("era:古風")); assertTrue(a.tapZone("era:奇幻")); frames(a, 5); assertEquals("奇幻", ts.era)
        val fantasy = app.ocshimeji.sim.chars.Catalog.TAGS.values.filter { it.cat == app.ocshimeji.sim.chars.TagCat.JOB && app.ocshimeji.sim.chars.Catalog.JOB_ERA[it.id] == "奇幻" }.map { it.id }
        assertTrue(fantasy.isNotEmpty()); assertTrue(fantasy.all { a.hasZone("chip:tag:$it") || a.zoneIds.any { z -> z.endsWith(":$it") } }, "only that setting's jobs")
        shot("tags-era", frames(a, 1, scale = 2f))
    }
    @Test fun theTitleMovesHouseAndResidents() {
        val a = app(); val b = blueChar(a); val c3 = a.saves.saveCharacter(a.saves.libChar(b.id)!!.let { app.ocshimeji.save.media.Importer.prepare(app.ocshimeji.save.media.Importer.read(listOf(app.ocshimeji.save.media.Importer.Source("idle.png", pngOf(testPicture()))), platform.codec)) }, app.ocshimeji.sim.chars.CharSpec(name = "小麥"), 1, true, emptyMap(), emptyList())
        val ids = listOf(Presets.CINNAMON.id, b.id)
        val m = a.saves.createWorld("公寓", "楓糖鎮", "三房公寓", app.ocshimeji.sim.house.Houses.APARTMENT, ids, mapOf(ids[0] to "bed1", ids[1] to "bed2"), platform.realMinute())
        (a.screen as TitleScreen).reload(); frames(a, 10)
        assertTrue(a.tapZone("eww:${m.id}")); frames(a, 15); assertTrue(a.tapZone("row:in")); frames(a, 15); assertTrue(a.tapZone("row:${c3.id}")); frames(a, 5)
        assertEquals(3, a.saves.loadWorld(m.id)!!.life!!.people.size); assertTrue(c3.id in a.saves.slot(m.id)!!.residents, "the save list knows")
        assertTrue(a.tapZone("eww:${m.id}")); frames(a, 15); assertTrue(a.tapZone("row:out")); frames(a, 15); shot("title-move-out", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("row:r_${c3.id}")); frames(a, 15); assertTrue(a.overlay is Confirm); assertTrue(a.tapZone("confirm:ok")); frames(a, 5)
        assertEquals(2, a.saves.loadWorld(m.id)!!.life!!.people.size)
        assertTrue(a.tapZone("eww:${m.id}")); frames(a, 15); assertTrue(a.tapZone("row:house")); frames(a, 15); assertTrue(a.tapZone("row:${app.ocshimeji.sim.house.Houses.BUNGALOW.id}")); frames(a, 5)
        assertEquals(app.ocshimeji.sim.house.Houses.BUNGALOW.id, a.saves.loadWorld(m.id)!!.life!!.houseId); assertTrue(a.saves.backups(m.id).any { it.endsWith("-edit") })
        (a.screen as TitleScreen).open(m.id); frames(a, 20); assertEquals(2, (a.screen as WorldScreen).sim.life.people.size)
    }
    @Test fun theTownAtNight() {
        val a = app(); val ws = home2(a); val sim = ws.sim; sim.life.clockMode = "GAME"
        assertNull(sim.env.jumpTo(21.0)); sim.env.setPaused(true); assertNull(sim.env.setSeason("winter")); frames(a, 10); var k = 0; while (a.overlay != null && k++ < 5) { if (!a.tapZone("dc:ok")) a.back(); frames(a, 15) }
        assertTrue(a.tapZone("nav:town")); frames(a, 30); val ts = a.screen as TownScreen; shot("town-night", frames(a, 1, scale = 2f))
        a.second(0, 200f, 300f); a.down(150f, 400f); a.second(1, 260f, 260f); a.second(2, 260f, 260f); a.up(150f, 400f); frames(a, 3)
        assertTrue(a.hasZone("place:plaza"))
    }
    @Test fun emptyListsHaveAPicture() {
        val a = app(); a.push(ItemsPage()); frames(a, 20); assertTrue(a.screen is ItemsPage); shot("empty-items", frames(a, 1, scale = 2f))
        for (n in listOf("bed", "sofa", "lamp", "cup", "broom", "crane", "umbrella", "cake", "paw", "zzz")) { val img = Java2dGfx.render(24, 24, 1f, assets) { g -> Widgets.icon(g, n, 12f, 12f, 18f, 0xFF5A3A29.toInt()) }
            assertTrue((0 until 24).any { x -> (0 until 24).any { y -> (img.getRGB(x, y) ushr 24) > 0 } }, "icon $n is drawn") }
    }
    @Test fun withYou() {   /* 1.8.0 「和你」 */
        val a = app(); val ws = home2(a); val sim = ws.sim; val p = sim.life.people[0]
        val mid = sim.life.you.nextId++; sim.life.you.messages += app.ocshimeji.sim.social.Msg(mid, p.id, sim.life.minute, "goodnight", "今天也謝謝你陪我。晚安。", listOf("晚安", "明天見", "好好睡"))
        assertTrue(a.tapZone("nav:records")); frames(a, 20); assertTrue(a.tapZone("you")); frames(a, 20); assertTrue(a.screen is YouHub); shot("you-hub", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("msgs")); frames(a, 20); shot("you-messages", frames(a, 1, scale = 2f)); val un = sim.you.unread(); assertTrue(a.tapZone("re:$mid:0")); frames(a, 10)
        assertEquals(un - 1, sim.you.unread()); assertEquals(0, sim.life.you.messages.first { it.id == mid }.reply); a.back(); frames(a, 20)
        assertTrue(a.tapZone("photo")); frames(a, 20); val ps = a.screen as PhotoStudio
        assertTrue(a.tapZone("flt:warm")); assertTrue(a.tapZone("frm:film")); frames(a, 5); assertTrue(a.tapZone("stk:heart")); frames(a, 5)
        val n0 = sim.life.you.photos.size; assertTrue(a.tapZone("shoot")); frames(a, 30); assertEquals(n0 + 1, sim.life.you.photos.size, "before: $n0"); shot("you-photo", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("album")); frames(a, 20); shot("you-album", frames(a, 1, scale = 2f)); assertTrue(a.tapZone("ph:${sim.life.you.photos[0].id}")); frames(a, 20); shot("you-photo-big", frames(a, 1, scale = 2f))
        a.back(); frames(a, 10); a.back(); frames(a, 10); a.back(); frames(a, 20); assertTrue(ps !== a.screen)
        a.push(CardsPage(ws)); frames(a, 20); shot("you-cards", frames(a, 1, scale = 2f)); assertTrue(a.tapZone("card:${p.id}")); frames(a, 20); shot("you-namecard", frames(a, 1, scale = 2f)); a.back(); frames(a, 10); a.pop()
        a.push(RulesPage(ws)); frames(a, 20); assertTrue(a.tapZone("rule:quiet")); frames(a, 5); assertTrue("quiet" in sim.life.you.rules); shot("you-rules", frames(a, 1, scale = 2f)); a.pop()
        assertNull(sim.you.bury("給未來的我們")); a.push(CapsulePage(ws)); frames(a, 20); shot("you-capsule", frames(a, 1, scale = 2f)); a.pop()
    }
    @Test fun homeAndTown() {   /* 1.9.0 「家與小鎮」 */
        val a = app(); val ws = home2(a); val sim = ws.sim; val p = sim.life.people[0]
        // the town: more → the feed, a day trip, the recipe book
        sim.economy.earn(300, "測試"); sim.economy.move("v:pumpkin", 1, "測試")
        sim.you.takePhoto(sim.life.people.map { it.id }, listOf("HAPPY", "SHY"), "warm", "polaroid", listOf("heart"), "大家")
        assertTrue(sim.economy.move("f:frame", 1, "測試")); var placed = false
        for (y in 0..12) for (x in 0..16) if (!placed && sim.decorate.place("f:frame", x, y) == null) placed = true
        assertTrue(placed, "a frame on a wall"); ws.flush(); frames(a, 30); shot("home-frame", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("nav:town")); frames(a, 30); shot("town-photo-board", frames(a, 1, scale = 2f))
        assertTrue(a.tapZone("more")); frames(a, 20); assertTrue(a.tapZone("row:recipes")); frames(a, 20); assertTrue(a.screen is RecipesPage); shot("days-recipes", frames(a, 1, scale = 2f)); a.pop(); frames(a, 10)
        sim.days.useTool("luck"); sim.life.days.feed += app.ocshimeji.sim.social.Post(sim.life.days.nextId++, p.id, sim.life.minute, "今天在公園撿到漂亮的石頭！", "smile")
        a.push(FeedPage(ws)); frames(a, 20); val po = sim.days.feed().first(); assertTrue(a.tapZone("lk:${po.id}")); frames(a, 5); assertTrue("you" in po.likes); shot("days-feed", frames(a, 1, scale = 2f)); a.pop(); frames(a, 10)
        a.push(TripPage(ws)); frames(a, 20); assertTrue(a.tapZone("who:${p.id}")); frames(a, 5); shot("days-trip", frames(a, 1, scale = 2f)); a.pop(); frames(a, 10)
        // the tools, a cabinet, the frame on the wall, the widget lines, the colour-blind palette
        a.push(YouHub(ws)); frames(a, 20); assertTrue(a.tapZone("tools")); frames(a, 20); shot("days-tools", frames(a, 1, scale = 2f)); a.back(); frames(a, 10); a.pop(); frames(a, 10)
        sim.days.keep(p, app.ocshimeji.sim.social.Keepsake("trip:beach", "海邊的貝殼", "drop", 3, "旅行")); a.show(CabinetSheet(ws, p.id)); frames(a, 20); shot("days-cabinet", frames(a, 1, scale = 2f)); a.back(); frames(a, 10)
        val (title, body) = WidgetLines.of(sim); assertTrue(title.contains("第 ") && body.contains(p.name), "$title / $body")
        a.saves.setFlag("a11y:cb"); frames(a, 2); assertEquals(a.theme.select, Theme.LIGHT.colorSafe().select); a.saves.clearFlag("a11y:cb"); frames(a, 2); assertEquals(Theme.LIGHT.select, a.theme.select)
    }
    @Test fun longTextIsNeverCut() {   /* 2.1.0 (#05): long sentences wrap and their boxes grow — nothing important ends in an ellipsis */
        val a = app(); val ws = home2(a); val sim = ws.sim; val p = sim.life.people[0]; Widgets.cuts.clear()
        val long = "這是一段很長很長的說明文字，用來確認介面會把整句話完整地顯示出來，而不是在中間加上省略號，就算螢幕很窄、句子很長也一樣。"
        a.toast(long); frames(a, 10); shot("long-toast", frames(a, 1, scale = 2f))
        sim.events += app.ocshimeji.sim.life.SimEvent("say", p.id, long); frames(a, 10); shot("long-bubble", frames(a, 1, scale = 2f))
        a.show(ListSheet("很長的選項", listOf("a" to long, "b" to "短的"), subtitle = long) {}); frames(a, 20); shot("long-sheet", frames(a, 1, scale = 2f)); a.back(); frames(a, 10)
        a.show(Confirm("確定嗎？", long, "刪除") {}); frames(a, 20); shot("long-confirm", frames(a, 1, scale = 2f)); a.back(); frames(a, 10)
        a.show(TalkSheet(ws, p.id)); frames(a, 20); assertTrue(a.tapZone("topic:how")); frames(a, 10); shot("long-talk", frames(a, 1, scale = 2f)); a.back(); frames(a, 10)
        sim.days.useTool("luck"); sim.life.days.feed += app.ocshimeji.sim.social.Post(sim.life.days.nextId++, p.id, sim.life.minute, long.take(60), "smile")
        a.push(FeedPage(ws)); frames(a, 20); a.pop(); frames(a, 5)
        val cut = Widgets.cuts.filter { it.length > 20 }
        assertTrue(cut.none { it.contains("很長很長的說明") }, "long text was cut: $cut")
    }
    @Test fun coinsRollAndFlyToTheBag() {
        val a = app(); val ws = home2(a); val sim = ws.sim; val w0 = sim.economy.wallet; frames(a, 5)
        sim.economy.earn(50, "測試的獎勵"); frames(a, 2); assertTrue(ws.shownCoins() < w0 + 50, "the number rolls up")
        val food = app.ocshimeji.sim.town.Goods.ALL.values.first { it.kind == "food" }.id; assertTrue(sim.economy.move(food, 2, "撿到的")); frames(a, 4); assertTrue(ws.flying > 0, "new things fly to storage")
        shot("coins-fly", frames(a, 1, scale = 2f)); frames(a, 90); assertEquals(w0 + 50, ws.shownCoins()); assertEquals(0, ws.flying)
    }
}

/** a Gfx that reports a phone-sized canvas but draws into a tiny one (fast frames between screenshots) */
private class FakeSize(val g: app.ocshimeji.render.Gfx, override val width: Float, override val height: Float) : app.ocshimeji.render.Gfx by g
