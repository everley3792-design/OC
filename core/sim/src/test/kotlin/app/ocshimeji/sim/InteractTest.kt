package app.ocshimeji.sim

import app.ocshimeji.sim.act.Interactions
import app.ocshimeji.sim.act.On
import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.house.Houses
import app.ocshimeji.sim.house.Tenant
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.Life
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.social.SocialActs
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** R3: the interaction registry, orders for one piece or one spot, and the queue of your orders */
class InteractTest {
    private val json = Json { encodeDefaults = true }
    private fun world(ageB: Int = 20, romance: Boolean = false): LifeSim { val h = Houses.COTTAGE; val ts = listOf(Tenant("a", "甲", true), Tenant("b", "乙", ageB >= 18))
        val life = LifeSim.create(9, h, ts, Houses.autoRooms(h, ts), ts.associate { it.id to it.id }, mapOf("a" to CharSpec(name = "甲"), "b" to CharSpec(name = "乙", age = ageB)), "鎮", "家", 20000.0 * 1440 + 600, 0)
        life.arriving = false; life.clockMode = "GAME"; life.speed = 30.0; life.romance = romance; for (p in life.people) p.recent["outing"] = life.minute; return LifeSim(life) }
    private fun run(s: LifeSim, sec: Int) = repeat(sec * 10) { s.update(0.1f) }

    @Test fun theRegistryCoversEverything() {
        val all = Interactions.ALL; assertEquals(all.size, all.map { it.id }.toSet().size, "ids are unique")
        assertTrue(all.size >= 130, "about 150 interactions: ${all.size}")
        for (s in SocialActs.ALL.values) assertNotNull(Interactions["soc:${s.id}"], s.id)
        for (a in Acts.ALL.values) if (a.id !in setOf("chat", "queue", "outing", "meal", "dishes", "craft")) assertNotNull(Interactions["act:${a.id}"], a.id)
        assertTrue(all.filter { it.on == On.PIECE && it.by == "them" }.all { it.kinds.isNotEmpty() }, "every furniture act names the furniture it needs")
        for (on in On.values()) assertTrue(all.any { it.on == on }, "something for $on")
    }
    @Test fun romanceIsNotEvenOfferedToAMinor() {
        val s = world(ageB = 15, romance = true); val a = s.person("a")!!; val b = s.person("b")!!
        val ch = Interactions.forPerson(s, a, b); assertTrue(ch.none { SocialActs[it.ia.op.removePrefix("soc:")]!!.romance })
        val s2 = world(ageB = 25, romance = false); assertTrue(Interactions.forPerson(s2, s2.person("a"), s2.person("b")!!).none { SocialActs[it.ia.op.removePrefix("soc:")]!!.romance })
        val s3 = world(ageB = 25, romance = true); assertTrue(Interactions.forPerson(s3, s3.person("a"), s3.person("b")!!).any { SocialActs[it.ia.op.removePrefix("soc:")]!!.romance })
        assertTrue(ch.any { !it.ok && it.why!!.contains("熟") }, "acts that need a closer step say so")
    }
    @Test fun anOrderForOnePieceAndOneSpot() {
        val s = world(); val so = s.society; val a = s.person("a")!!; so.setControl("a", "command")
        val (pi, choice) = s.house.pieces.indices.firstNotNullOf { pi -> Interactions.forPiece(s, a, pi).firstOrNull { it.ok && it.ia.op != "act:sleep" && it.ia.op != "act:nap" }?.let { pi to it } }
        so.suggest("a", choice.what.removePrefix("act:"), queue = true); assertTrue(so.lastOk); assertEquals(choice.what, a.order)
        var used = false; repeat(600) { s.update(0.1f); if (a.actPiece == pi && a.act == choice.ia.op.removePrefix("act:")) used = true }
        assertTrue(used, "went to that very piece (${choice.ia.zh} @ $pi)")
        val (tx, ty) = (0 until s.house.w).flatMap { x -> (0 until s.house.h).map { x to it } }.first { (x, y) -> s.house.roomAt(x, y)?.id == s.roomOf(a) && s.grid.walkable(x, y) && s.grid.distances(s.house.entrance.x, s.house.entrance.y)[y * s.grid.w + x] >= 0 && (x != a.x.toInt() || y != a.y.toInt()) }
        so.stopNow("a"); so.suggest("a", "daydream@t$tx,$ty", queue = true); assertTrue(so.lastOk)
        var there = false; repeat(600) { s.update(0.1f); if (a.act == "daydream" && a.x.toInt() == tx && a.y.toInt() == ty) there = true }
        assertTrue(there, "walked to the spot you pointed at")
        assertFalse(Interactions.forFloor(s, a, tx, ty).isEmpty())
    }
    @Test fun theQueueOfOrders() {
        fun go(): Pair<List<String>, String> {
            val s = world(); val so = s.society; val a = s.person("a")!!; so.setControl("a", "command")
            for (w in listOf("stretch", "tea", "puzzle", "hum")) so.suggest("a", w, queue = true)
            assertEquals(4, so.pending(a).size); assertTrue(so.cancelOrder("a", 2)); assertEquals(listOf("act:stretch", "act:tea", "act:hum"), so.pending(a))
            so.suggest("a", "music", queue = true); so.suggest("a", "album", queue = true)
            assertEquals(5, so.pending(a).size); assertTrue(so.suggest("a", "letter", queue = true).contains("滿"), "at most five"); assertFalse(so.lastOk)
            val back = LifeSim(json.decodeFromString<Life>(json.encodeToString(s.life))); assertEquals(so.pending(a), back.society.pending(back.person("a")!!))
            val done = ArrayList<String>(); var last: String? = null
            repeat(36000) { s.update(0.1f); if (a.act != null && a.act != last) { last = a.act; done += a.act!! } }
            assertTrue(so.pending(a).isEmpty(), "everything was done: $done"); assertTrue(s.life.log.any { it.text.contains("取消了") })
            val order = listOf("stretch", "tea", "hum", "music", "album").map { w -> done.indexOf(w) }; assertTrue(order.all { it >= 0 } && order == order.sorted(), "in the order you gave: $done")
            return done to s.life.log.joinToString { it.text }
        }
        assertEquals(go(), go())
    }
}
