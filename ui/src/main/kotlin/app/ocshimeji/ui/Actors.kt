package app.ocshimeji.ui

import app.ocshimeji.render.Colors
import app.ocshimeji.render.Gfx
import app.ocshimeji.render.Img
import app.ocshimeji.save.LibChar
import app.ocshimeji.save.Mark
import app.ocshimeji.save.media.Actions
import app.ocshimeji.sim.chars.Catalog
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.life.Pose
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * How a character looks on screen: its picture, its own animations (if any), expression variants, marks and motion style.
 * Built once per library character (frames decode lazily, only the actions that are actually played).
 */
class Look(val app: UiApp, val c: LibChar, val spec: CharSpec) {
    val base: Img? get() = app.charImg(c, 512)
    private val frameCache = HashMap<String, List<Img>?>()
    fun frames(action: String): List<Img>? = frameCache.getOrPut(action) { c.anims[action]?.frames?.mapNotNull { p -> val path = p.removePrefix("lib:"); app.assets.decode("lib:$path@384", 384) { app.saves.readFile(path) } }?.takeIf { it.isNotEmpty() } }
    fun face(emotion: String): Img? = c.faces[emotion]?.let { p -> val path = p.removePrefix("lib:"); app.assets.decode("lib:$path@512", 512) { app.saves.readFile(path) } }
    val render: Set<String> = Catalog.effects(spec).flatMap { it.render }.toSet()
    val scale: Float get() = (spec.height / 100f).coerceIn(0.6f, 1.5f)
    fun mark(name: String): Mark? = c.marks[name]
    /** which of their own animations plays for a pose (plan 12.7): null = the system's procedural animation */
    fun mine(pose: Pose, asleep: Boolean): String? {
        val want = if (asleep) "sleep" else Actors.ACTION[pose] ?: "idle"
        val src = c.animUse[want]?.let { if (it) "我的" else "系統預設" } ?: c.animSource
        return when (src) {
            "系統預設" -> null
            "我的" -> Actions.resolve(want) { it in c.anims } ?: if ("idle" in c.anims) "idle" else null
            else -> Actions.resolve(want) { it in c.anims }?.takeIf { it == want || it != "idle" }   /* mixed: mine when there is one, otherwise the system's */
        }
    }
}

/**
 * One picture (or a few frames), many poses (plan 3.4 程序動畫層): every pose is a procedural motion of the standing picture — bob,
 * squash, lean, sway, lie down, sink into the bath. A player's own animation replaces the procedural one for its action and only
 * light motion is added on top. The motion style (可愛 / 高冷 / 元氣 / 慵懶) changes the rhythm and size of everything.
 */
object Actors {
    /** pose → action name (the animation table of plan 3.3) */
    val ACTION = mapOf(Pose.STAND to "idle", Pose.WALK to "walk", Pose.SIT to "sit", Pose.LIE to "sleep", Pose.EAT to "eat", Pose.BATHE to "bathe", Pose.READ to "read",
        Pose.WATCH to "sit", Pose.WATER to "work", Pose.TIDY to "work", Pose.PRIMP to "happy", Pose.LOOK to "think", Pose.DAYDREAM to "think", Pose.HELD to "held",
        Pose.FLY to "thrown", Pose.DIZZY to "dizzy", Pose.HAPPY to "happy", Pose.PETTED to "petted", Pose.TALK to "talk", Pose.SWING to "play", Pose.MEDITATE to "sit",
        Pose.SING to "happy", Pose.SHY to "shy", Pose.ANGRY to "angry", Pose.SAD to "sad")
    private fun style(motion: String) = when (motion) { "高冷" -> 0.5f to 0.8f; "元氣" -> 1.45f to 1.3f; "慵懶" -> 0.7f to 0.6f; else -> 1f to 1f }
    /** the expression a pose or mood asks for (plan P-17) */
    fun emotion(pose: Pose, asleep: Boolean, sky: String): String? = when {
        asleep -> "sleep"; pose == Pose.HAPPY || pose == Pose.PETTED || pose == Pose.SING -> "happy"; pose == Pose.ANGRY -> "angry"; pose == Pose.SAD -> "sad"; pose == Pose.SHY -> "shy"
        pose == Pose.FLY || pose == Pose.DIZZY -> "surprised"; sky == "rainbow" -> "happy"; sky == "rain" -> "sad"; else -> null
    }

    /**
     * Draw a character with its feet at (x, y) (base dp), `h` dp tall (before its own height setting). `facing` = where it should look;
     * the picture is mirrored when that differs from the way it was drawn (unless the player turned mirroring off). `lift` raises it.
     * `where` = the furniture kind in use (bed, sofa, tub…).
     */
    fun draw(g: Gfx, look: Look, x: Float, y: Float, h0: Float, pose: Pose, time: Float, phase: Float, facing: Int, lift: Float, where: String?, asleep: Boolean, sky: String = "sun") {
        val mine = look.mine(pose, asleep); val frames = mine?.let { look.frames(it) }
        val img: Img = if (frames != null) { val an = look.c.anims[mine]!!; frameAt(frames, an.ms, an.loop, time) }
            else (emotion(pose, asleep, sky)?.let { look.face(it) } ?: look.base) ?: return
        val h = h0 * look.scale; val (amp0, spd) = style(look.spec.motion); val amp = if (frames != null) amp0 * 0.3f else amp0
        var flip = if (facing == look.c.facing || !look.c.flip) 1f else -1f
        val w = h * img.w / img.h; val tt = time * spd + phase
        val breath = 1f + (if (asleep) 0.03f else 0.018f) * amp0.coerceAtMost(1.2f) * sin(tt * (if (asleep) 1.3f else 2.4f))
        var sx = 1f; var sy = 1f; var rot = 0f; var dy = 0f; var pivotTop = false; var clipBottom = 0f
        if (frames == null || pose == Pose.HELD || pose == Pose.FLY) when (pose) {
            Pose.WALK -> { dy = -abs(sin(tt * 10f)) * 3.2f * amp; rot = sin(tt * 10f) * 0.05f * amp }
            Pose.SIT, Pose.WATCH, Pose.MEDITATE -> { sy = 0.86f; sx = 1.04f; if (pose == Pose.WATCH) rot = sin(tt * 0.7f) * 0.02f }
            Pose.EAT -> { sy = 0.87f + 0.03f * sin(tt * 9f); sx = 1.04f; dy = -abs(sin(tt * 4.5f)) * 1.5f * amp }
            Pose.READ -> { rot = 0.07f * flip; sy = 0.97f }
            Pose.HAPPY, Pose.SING -> { dy = -abs(sin(tt * 6.5f)) * 7f * amp; sy = 1f + 0.04f * amp * sin(tt * 13f) }
            Pose.PETTED -> { val k = sin(tt * 12f); sx = 1f + 0.05f * k; sy = 1f - 0.05f * k }
            Pose.SHY -> { sx = 0.95f; sy = 0.93f; rot = sin(tt * 3f) * 0.03f }
            Pose.ANGRY -> { rot = sin(tt * 30f) * 0.03f * amp; dy = -abs(sin(tt * 8f)) * 2f }
            Pose.SAD -> { sy = 0.95f; rot = -0.05f * flip }
            Pose.DIZZY -> rot = sin(tt * 7f) * 0.14f
            Pose.HELD -> { rot = sin(time * 3.2f) * 0.16f; pivotTop = true; sy = 1.04f; sx = 0.97f }
            Pose.FLY -> rot = sin(time * 11f) * 0.45f
            Pose.TIDY -> { rot = sin(tt * 6f) * 0.1f * amp; dy = -abs(sin(tt * 6f)) * 1.5f }
            Pose.SWING -> { rot = sin(tt * 5f) * 0.18f * amp; dy = -abs(sin(tt * 5f)) * 2f }
            Pose.TALK -> { dy = -abs(sin(tt * 7f)) * 1.5f * amp; sy = 1f + 0.02f * sin(tt * 14f) }
            Pose.WATER -> rot = 0.12f * flip
            Pose.LOOK -> { if (sin(tt * 0.8f) < -0.3f) flip = -flip }
            Pose.PRIMP -> { if (sin(tt * 1.6f) < 0f) flip = -flip; dy = -abs(sin(tt * 3.2f)) * 1.5f }
            Pose.DAYDREAM -> rot = sin(tt * 1.1f) * 0.05f * amp
            Pose.BATHE -> { clipBottom = h * 0.5f; dy = h * 0.28f }
            Pose.LIE, Pose.STAND -> {}
        }
        if (pose == Pose.BATHE && frames != null) { clipBottom = h * 0.5f; dy = h * 0.28f }
        var floatY = 0f; if ("float" in look.render && pose != Pose.LIE && pose != Pose.BATHE) floatY = 6f + 2.5f * sin(tt * 2f)
        if ("wobble" in look.render) { val k = sin(tt * 4f) * 0.05f; sx *= 1f + k; sy *= 1f - k }
        if ("sway" in look.render) rot += sin(tt * 0.9f) * 0.04f
        g.save(); g.translate(x, y - lift + dy - floatY)
        if ("ghost" in look.render) g.alpha(0.72f)
        if ("glow" in look.render) { g.fillCircle(0f, -h * 0.5f, h * 0.62f, Colors.withAlpha(0xFFFFF1B8.toInt(), 0.22f)); g.fillCircle(0f, -h * 0.5f, h * 0.45f, Colors.withAlpha(0xFFFFF1B8.toInt(), 0.18f)) }
        if (pose == Pose.LIE && frames == null) {
            if (where == "bed" || where == "bed2") { g.translate(0f, h * 0.2f); g.scale(flip * 0.92f, 0.92f * breath) }   /* in bed: upright, the blanket covers the body */
            else { g.translate(0f, -h * 0.16f); g.rotate((-PI / 2).toFloat() * flip); g.scale(flip * 0.9f, 0.9f * breath); g.translate(0f, h * 0.45f) }   /* on a sofa or the floor: on its side */
            g.image(img, -w * look.c.footX, -h * look.c.footY, w, h); g.restore(); return
        }
        if (clipBottom > 0f) g.clip(-w, -h * 1.2f - dy, w * 2, h * 1.2f - clipBottom)
        if (pivotTop) { g.translate(0f, -h * 0.9f); g.rotate(rot); g.translate(0f, h * 0.9f) } else g.rotate(rot)
        g.scale(flip * sx / sqrt(breath), sy * breath)
        g.image(img, -w * look.c.footX, -h * look.c.footY, w, h)
        g.restore()
        if ("sparkle" in look.render) for (i in 0 until 3) { val a = time * 1.5f + i * 2.1f; val k = (sin(a * 1.7f) + 1) / 2
            g.save(); g.alpha(k); star(g, x + cos(a) * h * 0.35f, y - lift - h * (0.4f + 0.3f * sin(a)), 2.5f + k * 1.5f, 0xFFFFF1B8.toInt()); g.restore() }
    }
    private fun frameAt(frames: List<Img>, ms: List<Int>, loop: Boolean, time: Float): Img {
        val total = (frames.indices.sumOf { ms.getOrElse(it) { 120 }.coerceAtLeast(20) }).coerceAtLeast(1)
        var t = (time * 1000).toLong(); t = if (loop) t % total else minOf(t, total - 1L)
        var acc = 0L; for (i in frames.indices) { acc += ms.getOrElse(i) { 120 }.coerceAtLeast(20); if (t < acc) return frames[i] }
        return frames.last()
    }
    /** a point on the picture (a mark) → base dp, for a character standing at (x, y) */
    fun at(look: Look, m: Mark, x: Float, y: Float, h0: Float, facing: Int): Pair<Float, Float> {
        val img = look.base ?: return x to y - h0 * 0.5f; val h = h0 * look.scale; val w = h * img.w / img.h
        val flip = if (facing == look.c.facing || !look.c.flip) 1f else -1f
        return x + flip * (m.x - look.c.footX) * w to y + (m.y - look.c.footY) * h
    }
    /** which part a finger touches (plan E-01): marked ears, tail, head; otherwise the top third is the head */
    fun part(look: Look, fx: Float, fy: Float, x: Float, y: Float, h0: Float, facing: Int): String {
        for (name in listOf("耳朵", "尾巴", "頭")) { val m = look.mark(name) ?: continue; val (px, py) = at(look, m, x, y, h0, facing); val r = m.r * h0 * look.scale; if ((fx - px) * (fx - px) + (fy - py) * (fy - py) <= r * r * 1.4f) return name }
        return if (look.mark("頭") == null && fy < y - h0 * look.scale * 0.66f) "頭" else "身體"
    }

    /** small things around a character: Zz, dizzy stars, bath bubbles, watering drops, the prop in their hands, a blush */
    fun extras(g: Gfx, t: Theme, look: Look, pose: Pose, x: Float, y: Float, h0: Float, time: Float, phase: Float, facing: Int, asleep: Boolean, prop: String?) {
        val tt = time + phase; val h = h0 * look.scale
        if (asleep) for (i in 0 until 3) { val k = ((tt * 0.45f + i / 3f) % 1f); val s = 7f + k * 6f
            g.save(); g.alpha(1f - k); val zx = x + h * 0.3f + k * 14f; val zy = y - h * 0.75f - k * 26f
            g.line(zx, zy, zx + s, zy, 1.8f, t.ink2); g.line(zx + s, zy, zx, zy + s, 1.8f, t.ink2); g.line(zx, zy + s, zx + s, zy + s, 1.8f, t.ink2); g.restore() }
        val hand = look.mark("手")?.let { at(look, it, x, y, h0, facing) } ?: (x + facing * h * 0.2f to y - h * 0.45f)
        when (pose) {
            Pose.DIZZY -> for (i in 0 until 3) { val a = tt * 4f + i * 2.09f; star(g, x + cos(a) * h * 0.3f, y - h * 1.02f + sin(a) * 5f, 4f, 0xFFFFC857.toInt()) }
            Pose.BATHE -> for (i in 0 until 4) { val k = (tt * 0.6f + i * 0.25f) % 1f; g.save(); g.alpha(1f - k); g.fillCircle(x - h * 0.35f + i * h * 0.22f, y - h * 0.25f - k * 20f, 3f + i % 2 * 2f, 0xFFFFFFFF.toInt()); g.restore() }
            Pose.WATER -> for (i in 0 until 3) { val k = (tt * 1.5f + i / 3f) % 1f; g.fillCircle(hand.first + facing * 6f + i * 2f, hand.second + k * h * 0.3f, 2f, 0xFF7AAAD6.toInt()) }
            Pose.READ -> if (prop == null) { g.fillRound(hand.first - 8, hand.second - 5, 16f, 11f, 2f, 0xFFF0705A.toInt()); g.fillRect(hand.first - 0.6f, hand.second - 5, 1.2f, 11f, 0xFFFFFDF7.toInt()) }
            Pose.EAT -> { if (sin(tt * 4.5f) > 0.6f) g.fillCircle(hand.first, hand.second - 4, 2f, 0xFFD9A472.toInt()) }
            Pose.PETTED, Pose.SHY -> { val f = look.mark("臉")?.let { at(look, it, x, y, h0, facing) } ?: (x to y - h * 0.62f); val off = (look.mark("臉")?.r ?: 0.14f) * h * 0.7f
                g.fillCircle(f.first - off, f.second, 4f, Colors.withAlpha(0xFFF6A0A0.toInt(), 0.65f)); g.fillCircle(f.first + off, f.second, 4f, Colors.withAlpha(0xFFF6A0A0.toInt(), 0.65f)) }
            Pose.ANGRY -> { val a = (tt * 2f) % 1f; g.save(); g.alpha(1f - a); for (i in 0 until 3) g.line(x + h * 0.25f + i * 4f, y - h * 0.9f - a * 10f, x + h * 0.28f + i * 4f, y - h * 0.98f - a * 10f, 2f, 0xFFF0705A.toInt()); g.restore() }
            Pose.SING -> { val a = (tt * 0.8f) % 1f; g.save(); g.alpha(1f - a); note(g, x + facing * h * 0.35f + a * 10f, y - h * 0.8f - a * 18f, 0xFF7AAAD6.toInt()); g.restore() }
            Pose.MEDITATE -> g.fillCircle(x, y - h * 0.45f, h * 0.5f + 2f * sin(tt * 2f), Colors.withAlpha(0xFFBFE3F2.toInt(), 0.18f))
            else -> {}
        }
        if (prop != null) prop(g, prop, hand.first, hand.second, time, facing)
    }
    /** the little things in their hands (plan 13.2: the closest system pose + a prop), drawn from shapes */
    fun prop(g: Gfx, name: String, x: Float, y: Float, time: Float, facing: Int) {
        val ink = 0xFF5B3A29.toInt(); val f = facing.toFloat()
        when (name) {
            "sword" -> { g.save(); g.translate(x, y); g.rotate(sin(time * 5f) * 0.5f - 0.6f * f); g.fillRect(-1.5f, -26f, 3f, 24f, 0xFFDDE6EE.toInt()); g.fillRect(-5f, -3f, 10f, 3f, 0xFFE8C27A.toInt()); g.fillRect(-1.5f, 0f, 3f, 7f, ink); g.restore() }
            "laptop" -> { g.fillRound(x - 10, y - 2, 20f, 4f, 1f, 0xFF9AA6B8.toInt()); g.fillRound(x - 9, y - 14, 18f, 12f, 2f, 0xFF5B6478.toInt()); g.fillRound(x - 7, y - 12, 14f, 8f, 1f, 0xFF9FD8F0.toInt()) }
            "cup" -> { g.fillRound(x - 5, y - 8, 10f, 10f, 2f, 0xFFFFFDF7.toInt()); g.fillRect(x - 4, y - 7, 8f, 3f, 0xFF6B4A35.toInt()); g.strokeRound(x + 4, y - 6, 4f, 5f, 2f, 1.5f, 0xFFFFFDF7.toInt()) }
            "note" -> note(g, x + 4 * f, y - 10 - 3 * sin(time * 4f), 0xFF7AAAD6.toInt())
            "brush" -> { g.save(); g.translate(x, y); g.rotate(0.6f * f + sin(time * 3f) * 0.2f); g.fillRect(-1f, -14f, 2f, 14f, 0xFFC98F5E.toInt()); g.fillRound(-2f, -19f, 4f, 6f, 2f, 0xFFF0705A.toInt()); g.restore() }
            "flask" -> { g.fillCircle(x, y - 4, 6f, Colors.withAlpha(0xFF8ED1B4.toInt(), 0.85f)); g.fillRect(x - 2, y - 14, 4f, 7f, 0xFFDDE6EE.toInt()); g.fillCircle(x + 2, y - 16 - (time * 10) % 8, 1.5f, 0xFFFFFFFF.toInt()) }
            "cake" -> { g.fillRound(x - 7, y - 8, 14f, 8f, 2f, 0xFFFBE3C8.toInt()); g.fillRound(x - 7, y - 10, 14f, 3f, 1.5f, 0xFFF6B2A8.toInt()); g.fillCircle(x, y - 12, 2f, 0xFFF0705A.toInt()) }
            "coin" -> for (i in 0 until 3) g.fillCircle(x - 4 + i * 4f, y - 3 - (if (i == 1) 2f + abs(sin(time * 6f)) * 3 else 0f), 3.5f, 0xFFFFC857.toInt())
            "game" -> { g.fillRound(x - 9, y - 6, 18f, 10f, 4f, 0xFF7A88B8.toInt()); g.fillCircle(x - 4, y - 1, 1.8f, 0xFFFFFDF7.toInt()); g.fillCircle(x + 4, y - 1, 1.8f, 0xFFF0705A.toInt()) }
            "phone" -> { g.fillRound(x - 4, y - 14, 8f, 13f, 2f, 0xFF5B6478.toInt()); if (sin(time * 2f) > 0.9f) g.fillCircle(x, y - 8, 9f, Colors.withAlpha(0xFFFFFFFF.toInt(), 0.6f)) }
            "dumbbell" -> { val yy = y - 4 - abs(sin(time * 4f)) * 8; g.fillRect(x - 8, yy - 1, 16f, 2f, ink); g.fillRound(x - 10, yy - 4, 4f, 8f, 1f, 0xFF5B6478.toInt()); g.fillRound(x + 6, yy - 4, 4f, 8f, 1f, 0xFF5B6478.toInt()) }
            "star" -> star(g, x + 3 * f, y - 12 - 2 * sin(time * 5f), 5f, 0xFFFFC857.toInt())
            "bolt" -> { g.save(); g.translate(x, y - 10); g.rotate(0.3f); g.fillRect(-1.5f, -6f, 3f, 7f, 0xFFFFC857.toInt()); g.restore(); g.save(); g.translate(x + 1, y - 4); g.rotate(0.3f); g.fillRect(-1.5f, -1f, 3f, 7f, 0xFFFFC857.toInt()); g.restore() }
            "magnifier" -> { g.strokeRound(x - 5, y - 15, 10f, 10f, 5f, 2f, ink); g.line(x + 3, y - 6, x + 7, y - 1, 2.5f, ink) }
            "pillow" -> { g.fillRound(x - 11, y - 9, 22f, 14f, 6f, 0xFFF6B2A8.toInt()); g.fillRound(x - 9, y - 7, 18f, 10f, 5f, 0xFFF9C9C1.toInt()) }
        }
    }
    private fun note(g: Gfx, x: Float, y: Float, c: Int) { g.fillCircle(x, y, 3f, c); g.fillRect(x + 2f, y - 10f, 1.6f, 10f, c); g.fillRect(x + 2f, y - 10f, 5f, 2f, c) }
    private fun star(g: Gfx, cx: Float, cy: Float, r: Float, c: Int) { g.save(); g.translate(cx, cy); for (i in 0 until 2) { g.rotate((PI / 4).toFloat()); g.fillRect(-r * 0.35f, -r, r * 0.7f, r * 2, c) }; g.restore() }
}
