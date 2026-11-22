package app.ocshimeji.sim.social

import app.ocshimeji.sim.chars.Catalog
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.life.Axis
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.Person
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * 2.1.0 (expansion plan, phase 1): the one content format. An event is data — who takes part, when, where, what has to be true,
 * what is said (a scene script), what changes, and what may follow. The built-in daily events live here as JSON
 * (`DailyContent`); players' packs use the same format (phase 3). Nothing here is executable: conditions are fields, checked by `ok`.
 */
@Serializable
data class ContentEvent(
    val id: String,
    val name: String,
    /** daily, special, romance, group… (shown in the editor; romance only between two adults with romance on) */
    val category: String = "daily",
    val description: String = "",
    /** game hours [from, to) — may wrap past midnight */
    val hours: List<Int> = listOf(0, 24),
    /** the scene: `A:句子@POSE#特效 / B:…` with {對方} {物} {第三人} */
    val script: String,
    val like: Int = 2,
    @kotlinx.serialization.SerialName("fun") val funGain: Float = 10f,
    val closeup: Boolean = false,
    val `when`: When = When(),
    /** what may follow, at least `nextAfterDays` later, between the same two */
    val next: String = "",
    val nextAfterDays: Int = 1,
    val cooldownDays: Int = 1,
    val repeatable: Boolean = true,
    val enabled: Boolean = true,
)
/** what has to be true (every field optional; all of them must hold) */
@Serializable
data class When(
    val weather: List<String> = emptyList(), val season: List<String> = emptyList(),
    /** furniture kinds the home has to have (any of them) */
    val furniture: List<String> = emptyList(),
    /** exactly this many of a kind (e.g. one bathtub) */
    val furnitureCount: Map<String, Int> = emptyMap(),
    val minPeople: Int = 2, val maxPeople: Int = 99,
    val a: Who = Who(), val b: Who = Who(),
    val rel: RelWhen = RelWhen(),
    /** an event that has to have happened before (between anyone) / must not have happened yet */
    val after: String = "", val notAfter: String = "",
    /** something that has to be in storage */
    val item: String = "",
)
@Serializable
data class Who(
    val traits: List<String> = emptyList(), val notTraits: List<String> = emptyList(), val tags: List<String> = emptyList(),
    /** personality axes (OUTGOING, ACTIVE, DILIGENT, FRANK, GENTLE) at least / at most */
    val axisMin: Map<String, Float> = emptyMap(), val axisMax: Map<String, Float> = emptyMap(),
    val moodMin: Int = -99, val moodMax: Int = 99, val hasMood: List<String> = emptyList(),
    /** needs (FOOD, ENERGY, …) below a value */
    val needBelow: Map<String, Float> = emptyMap(),
    val skillMin: Map<String, Int> = emptyMap(),
    val cryMin: Float = -1f, val adult: Boolean? = null,
    /** eats more than most (their food / snack appetite) */
    val likesFood: Boolean = false,
)
@Serializable
data class RelWhen(val minLike: Int = -999, val maxLike: Int = 999, val minFamiliar: Int = -999, val maxFamiliar: Int = 999, val minConflict: Int = -999, val kinds: List<String> = emptyList(), val minStage: Int = 0)

object Content {
    val json = Json { ignoreUnknownKeys = true; encodeDefaults = false; prettyPrint = true }
    val AXES = mapOf("OUTGOING" to Axis.OUTGOING, "ACTIVE" to Axis.ACTIVE, "DILIGENT" to Axis.DILIGENT, "FRANK" to Axis.FRANK, "GENTLE" to Axis.GENTLE)
    val WEATHERS = setOf("sunny", "cloudy", "rain", "snow", "storm", "fog")
    val SEASONS = setOf("spring", "summer", "autumn", "winter")
    val CATEGORIES = setOf("daily", "special", "romance", "group", "town", "custom")

    fun parse(text: String): List<ContentEvent> = json.decodeFromString(text)
    fun write(list: List<ContentEvent>): String = json.encodeToString(kotlinx.serialization.builtins.ListSerializer(ContentEvent.serializer()), list)

    /** hour window, may wrap */
    fun hourIn(h: Double, from: Int, to: Int) = if (from <= to) h >= from && h < to else h >= from || h < to

    /** does it fit these two, here, now? (no dice — the caller weighs and picks) */
    fun ok(sim: LifeSim, e: ContentEvent, a: Person, b: Person, seen: (String) -> Boolean): Boolean {
        if (!e.enabled || !hourIn(sim.hour, e.hours.getOrElse(0) { 0 }, e.hours.getOrElse(1) { 24 })) return false
        val w = e.`when`; val life = sim.life; val h = sim.house
        if (w.weather.isNotEmpty() && sim.weather() !in w.weather) return false
        if (w.season.isNotEmpty() && sim.season() !in w.season) return false
        if (w.furniture.isNotEmpty() && h.pieces.none { it.kind in w.furniture }) return false
        for ((k, n) in w.furnitureCount) if (h.pieces.count { it.kind == k } != n) return false
        val here = life.people.count { !it.desk }; if (here < w.minPeople || here > w.maxPeople) return false
        if (!who(sim, w.a, a) || !who(sim, w.b, b)) return false
        val r = sim.rel(a.id, b.id); val rw = w.rel
        val like = r?.like ?: 30; val fam = r?.familiar ?: 30; val con = r?.conflict ?: 0
        if (like < rw.minLike || like > rw.maxLike || fam < rw.minFamiliar || fam > rw.maxFamiliar || con < rw.minConflict) return false
        if (rw.kinds.isNotEmpty() && (r?.kind ?: "認識") !in rw.kinds) return false
        if (rw.minStage > 0 && Will.stageFrom(r) < rw.minStage) return false
        if (w.after.isNotEmpty() && !seen(w.after)) return false
        if (w.notAfter.isNotEmpty() && seen(w.notAfter)) return false
        if (w.item.isNotEmpty() && sim.economy.count(w.item) <= 0) return false
        if (e.category == "romance" && !(life.romance && a.adult && b.adult)) return false   /* the rule, always */
        return true
    }
    private fun who(sim: LifeSim, w: Who, p: Person): Boolean {
        val s = p.spec
        if (w.traits.isNotEmpty() && w.traits.none { s.has(it) }) return false
        if (w.notTraits.any { s.has(it) }) return false
        if (w.tags.isNotEmpty() && w.tags.none { it in s.tags }) return false
        for ((k, v) in w.axisMin) if (s.axis(AXES[k] ?: return false) <= v) return false
        for ((k, v) in w.axisMax) if (s.axis(AXES[k] ?: return false) >= v) return false
        val m = sim.moodValue(p); if (m < w.moodMin || m > w.moodMax) return false
        if (w.hasMood.isNotEmpty() && p.moods.none { it.id in w.hasMood }) return false
        for ((k, v) in w.needBelow) { val n = runCatching { Need.valueOf(k) }.getOrNull() ?: return false; if (p.need(n) >= v) return false }
        for ((k, v) in w.skillMin) if (s.skill(k) < v) return false
        if (w.cryMin > -1f && s.cry <= w.cryMin) return false
        if (w.adult != null && p.adult != w.adult) return false
        if (w.likesFood && !(sim.mods(p).act("food") > 1.2f || sim.mods(p).act("snack") > 1.2f)) return false
        return true
    }

    /** what is wrong with a set of events (empty = fine): missing fields, unknown names, contradictions, duplicate ids, broken links */
    fun problems(list: List<ContentEvent>, known: Set<String> = emptySet()): List<String> {
        val out = ArrayList<String>(); val ids = HashSet<String>(); val all = known + list.map { it.id }
        for (e in list) {
            val at = "「${e.id.ifBlank { e.name }}」"
            if (e.id.isBlank()) out += "$at 沒有 id"
            if (!ids.add(e.id)) out += "$at 的 id 重複了"
            if (e.name.isBlank()) out += "$at 沒有名字"
            if (e.category !in CATEGORIES) out += "$at 的分類「${e.category}」不認得（可以用：${CATEGORIES.joinToString("、")}）"
            if (e.hours.size != 2 || e.hours.any { it !in 0..24 }) out += "$at 的時間要是兩個 0～24 的數字"
            val parts = e.script.split(" / ")
            if (e.script.isBlank() || runCatching { Script.parse(e.script) }.getOrNull().isNullOrEmpty()) out += "$at 的對話讀不出來"
            else if (parts.any { !it.startsWith("A:") && !it.startsWith("B:") }) out += "$at 的對話每一句都要用「A:」或「B:」開頭"
            if (e.like !in -10..10) out += "$at 的好感變化要在 -10～10 之間"
            val w = e.`when`
            w.weather.filter { it !in WEATHERS }.forEach { out += "$at 的天氣「$it」不認得" }
            w.season.filter { it !in SEASONS }.forEach { out += "$at 的季節「$it」不認得" }
            (w.furniture + w.furnitureCount.keys).filter { !Furniture.known(it) }.forEach { out += "$at 的家具「$it」不認得" }
            if (w.minPeople > w.maxPeople) out += "$at 的人數：最少比最多還多"
            if (w.rel.minLike > w.rel.maxLike) out += "$at 的好感：最低比最高還高"
            if (w.rel.minFamiliar > w.rel.maxFamiliar) out += "$at 的熟悉：最低比最高還高"
            for (who in listOf(w.a, w.b)) {
                (who.traits + who.notTraits).filter { Catalog.TRAITS[it] == null && Catalog.QUIRKS[it] == null }.forEach { out += "$at 的特質「$it」不認得" }
                (who.axisMin.keys + who.axisMax.keys).filter { it !in AXES }.forEach { out += "$at 的性格軸「$it」不認得" }
                who.needBelow.keys.filter { k -> Need.values().none { it.name == k } }.forEach { out += "$at 的需求「$it」不認得" }
                if (who.moodMin > who.moodMax) out += "$at 的心情：最低比最高還高"
                if (who.traits.any { it in who.notTraits }) out += "$at 的特質同時要有又不能有"
            }
            if (e.next.isNotEmpty() && e.next !in all) out += "$at 的後續事件「${e.next}」不存在"
            if (w.after.isNotEmpty() && w.after !in all) out += "$at 的前置事件「${w.after}」不存在"
        }
        return out
    }
}
