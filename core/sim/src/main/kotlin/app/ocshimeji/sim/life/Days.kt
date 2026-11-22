package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.social.*
import app.ocshimeji.sim.town.Goods
import app.ocshimeji.sim.town.Outing

/**
 * 1.9.0 (R7 last batch, 「家與小鎮」): recipes from storage (I-03), anniversaries and dates (J-04), the town feed (Q-01),
 * your little tools (Q-02), day trips (Q-03), everyone's keepsake cabinet (Q-11), the memory frame (G-08),
 * residents nudging furniture (G-05), the desktop diary (F-12).
 * Its own dice only (`Rng.of(seed, "days:…")`): the life's stream is never touched.
 */
class Days(private val sim: LifeSim) {
    private val life get() = sim.life
    val st get() = life.days
    private val day get() = life.day
    private fun home() = life.people.filter { !it.desk && it.out == null }

    internal fun step(live: Boolean) {
        if (life.arriving) return
        if (st.lastDay < 0) { st.lastDay = day; remember() }
        if (day != st.lastDay) { st.lastDay = day; newDay(live) }
        val dm = if (st.lastTick < 0) 0.0 else (life.minute - st.lastTick).coerceIn(0.0, 60.0)
        if (st.lastTick >= 0 && dm < 15) return
        st.lastTick = life.minute
        for (p in life.people) if (p.desk) st.deskMin[p.id] = (st.deskMin[p.id] ?: 0.0) + dm
        for (t in st.trips) if (!t.back && life.minute >= t.until) tripHome(t, live)
        dates(live, Rng.of(life.seed, "days:${(life.minute / 15).toLong()}"))
    }

    private fun newDay(live: Boolean) {
        val r = Rng.of(life.seed, "days:day:$day")
        remember()
        anniversaries(live)
        deskDiary(r)
        posts(r)
        nudge(r)
        if (st.tools["dream"] == day - 1) for (p in life.people) { sim.addMood(p, "sweetdream"); sim.log(p, "昨晚做了一個好夢，醒來還在笑", kind = "you", weight = 1) }
    }

    /** who moved in when, and since when each pair is close (first seen) */
    private fun remember() {
        for (p in life.people) st.since.getOrPut("p:${p.id}") { day }
        for (a in life.people) for (b in life.people) { if (a.id >= b.id) continue
            val k = sim.rel(a.id, b.id)?.kind ?: continue; if (k in setOf("好友", "知己", "戀人")) st.since.getOrPut("${a.id}|${b.id}|$k") { day } }
    }
    // ---------------- J-04 anniversaries, and dates for lovers ----------------
    private fun anniversaries(live: Boolean) {
        for (p in life.people) { val d0 = st.since["p:${p.id}"] ?: continue; val n = day - d0
            if (n <= 0 || n % Anniv.MONTH != 0L) continue
            val m = n / Anniv.MONTH; sim.addMood(p, "anniv")
            sim.log(p, "今天是${p.name}搬進來滿 $m 個月的日子", kind = "event", weight = 3)
            sim.society.mail(p.id, "anniv", "${p.name}搬進來 $m 個月了", "第 $d0 天搬進來，到今天剛好 $m 個月。")
            post(p, "搬進來 $m 個月了，謝謝大家", "heart")
            if (live) sim.say(p, "今天是我搬進來 $m 個月的日子！") }
        for ((key, d0) in st.since.entries.toList()) { val parts = key.split("|"); if (parts.size != 3) continue
            val n = day - d0; if (n <= 0 || n % Anniv.MONTH != 0L) continue
            val a = sim.person(parts[0]) ?: continue; val b = sim.person(parts[1]) ?: continue
            if (sim.rel(a.id, b.id)?.kind != parts[2]) continue
            val what = if (parts[2] == "戀人") "在一起" else "成為${parts[2]}"
            sim.addMood(a, "anniv"); sim.addMood(b, "anniv")
            sim.log(a, "和${b.name}${what}滿 ${n / Anniv.MONTH} 個月了", kind = "event", weight = 3, with = b.id)
            if (live && a.out == null && b.out == null && !a.desk && !b.desk) sim.say(a, "你記得嗎？今天是我們${what}滿 ${n / Anniv.MONTH} 個月。", to = b) }
    }
    /** lovers (romance on, both adults — the rules already made them lovers) go on a little date now and then */
    private fun dates(live: Boolean, r: Rng) {
        if (!life.romance) return
        val h = sim.hour; if (h < 15 || h > 21) return
        for (a in home()) for (b in home()) { if (a.id >= b.id || !a.adult || !b.adult) continue
            if (sim.rel(a.id, b.id)?.kind != "戀人") continue
            val key = "date:$day:${a.id}|${b.id}"; if (life.soc.seen.containsKey(key) || sim.asleep(a) || sim.asleep(b) || !r.chance(0.04)) continue
            life.soc.seen[key] = life.minute
            val what = r.pick(Anniv.DATES); sim.addMood(a, "date"); sim.addMood(b, "date")
            sim.society.relUpdate(a, b) { it.copy(like = it.like + 2, trust = it.trust + 1) }
            sim.log(a, "和${b.name}約會：$what", kind = "event", weight = 3, with = b.id)
            if (live) sim.events += SimEvent("heart", a.id, "") }
    }
    /** months since `key` ("p:<id>" or "a|b|kind"); −1 = not recorded */
    fun daysSince(key: String): Long = st.since[key]?.let { day - it } ?: -1

    // ---------------- I-03 recipes ----------------
    /** a recipe storage can make now (savory or sweet); the first one that fits, no dice */
    fun recipeFor(sweet: Boolean): Recipe? = Recipes.ALL.values.firstOrNull { rc -> Dishes.ALL[rc.dish]?.sweet == sweet && rc.needs.all { (k, n) -> sim.economy.count(k) >= n } }
    internal fun useRecipe(p: Person, rc: Recipe) {
        for ((k, n) in rc.needs) sim.economy.move(k, -n, "${p.name}做${rc.zh}用掉了${Economy.nameOf(life, k)}", p.id)
        val first = st.recipes.add(rc.id)
        sim.log(p, (if (first) "學會了新菜：" else "做了") + rc.zh + "（用了" + rc.needs.keys.joinToString("、") { Economy.nameOf(life, it) } + "）", kind = "life", weight = if (first) 3 else 2)
        if (first) { sim.journal.see("rc:" + rc.id, 3); post(p, "第一次做了${rc.zh}！", "food") }
        sim.journal.did(p.id, "recipe")
    }
    /** what is still missing for a recipe (for the recipe book) */
    fun missing(rc: Recipe): List<String> = rc.needs.filter { (k, n) -> sim.economy.count(k) < n }.map { (k, n) -> "${Economy.nameOf(life, k)} ×${n - sim.economy.count(k)}" }

    // ---------------- Q-01 the town feed ----------------
    private fun post(p: Person, text: String, icon: String) {
        val po = Post(st.nextId++, p.id, life.minute, text.take(60), icon); st.feed += po; while (st.feed.size > Feed.MAX) st.feed.removeAt(0)
        for (q in life.people) if (q !== p && (sim.rel(q.id, p.id)?.like ?: 0) >= 55) po.likes += q.id
    }
    private fun posts(r: Rng) {
        val y0 = (day - 1) * 1440.0
        for (p in life.people) {
            val best = life.log.lastOrNull { it.who == p.id && it.weight >= 2 && it.kind !in setOf("note", "you") && it.minute >= life.minute - 1440 } ?: continue
            if (!r.chance(0.6)) continue
            post(p, r.pick(Feed.FRAMES).replace("{事}", best.text.removePrefix(p.name)), if (best.kind == "event") "star" else "smile")
        }
        @Suppress("UNUSED_VARIABLE") val unused = y0
    }
    fun feed(): List<Post> = st.feed.asReversed()
    /** you like a post */
    fun like(id: Int): Boolean { val po = st.feed.firstOrNull { it.id == id } ?: return false; if ("you" in po.likes) return false
        po.likes += "you"; sim.person(po.who)?.let { sim.addMood(it, "liked"); it.affinity = (it.affinity + 1).coerceIn(0, 100) }; return true }

    // ---------------- Q-02 your little tools (each once a day) ----------------
    fun toolReady(id: String) = st.tools[id] != day
    fun useTool(id: String): String {
        val t = Tools.ALL[id] ?: return "沒有這個"; if (!toolReady(id)) return "「${t.zh}」今天用過了，明天再來"
        val ppl = home(); if (life.people.isEmpty()) return "沒有住民"
        val r = Rng.of(life.seed, "tool:$id:$day")
        val msg = when (id) {
            "gift" -> { val g = Goods.ALL[r.pick(Tools.GIFTS)]!!; sim.economy.move(g.id, 1, "天降禮物：${g.zh}")
                ppl.firstOrNull()?.let { p -> sim.say(p, "門口有一個${g.zh}！是誰送的？"); sim.addMood(p, "lucky"); sim.log(p, "在門口發現了一份禮物：${g.zh}", kind = "you", weight = 2) }
                "門口多了一個${g.zh}（放進收納了）" }
            "luck" -> { for (p in life.people) sim.addMood(p, "lucky"); ppl.firstOrNull()?.let { sim.say(it, "今天好像會有好事發生！") }; "今天大家都會幸運一點" }
            "dream" -> { "今晚大家都會做好夢" }
            "star" -> { val h = sim.hour; if (h in 5.0..19.0) return "流星要等到晚上（七點以後）"
                for (p in ppl.filter { !sim.asleep(it) }) { val w = r.pick(Tools.WISHES); sim.addMood(p, "wish"); sim.log(p, "看到流星，許了願：「$w」", kind = "you", weight = 2); sim.say(p, "流星！快許願！"); sim.events += SimEvent("fx", p.id, "sparkle") }
                "一顆流星劃過夜空" }
            else -> return "沒有這個"
        }
        st.tools[id] = day; return msg
    }

    // ---------------- Q-03 day trips ----------------
    fun trip(): Trip? = st.trips.lastOrNull { !it.back }
    /** why these people can't go now (null = they can) */
    fun tripProblem(placeId: String, who: List<String>): String? {
        val pl = Trips.ALL[placeId] ?: return "沒有這個地方"; if (trip() != null) return "已經有人在旅行了"
        if (who.isEmpty()) return "選誰要去"
        val ppl = who.map { sim.person(it) ?: return "找不到住民" }
        ppl.firstOrNull { it.out != null || it.desk }?.let { return "${it.name}不在家" }
        ppl.firstOrNull { sim.asleep(it) }?.let { return "${it.name}在睡覺" }
        if (sim.hour < 6 || sim.hour > 11) return "旅行要一早出發（六點到十一點）"
        if (pl.weather.isNotEmpty() && sim.weather() !in pl.weather) return "今天的天氣不適合去${pl.zh}"
        if (sim.economy.wallet < pl.cost * ppl.size) return "要 ${pl.cost * ppl.size} 星幣（車票）"
        return null
    }
    fun startTrip(placeId: String, who: List<String>): String? {
        tripProblem(placeId, who)?.let { return it }
        val pl = Trips.ALL[placeId]!!; val ppl = who.mapNotNull { sim.person(it) }
        if (!sim.economy.spend(pl.cost * ppl.size, "${ppl.joinToString("、") { it.name }}去${pl.zh}的車票")) return "星幣不夠"
        val until = life.minute + pl.hours * 60
        for (p in ppl) { sim.release(p); p.act = null; p.why = listOf("去${pl.zh}旅行"); p.queue.clear()
            val b = sim.body(p.id); b.arrivedAct = false; b.path = null; b.micro = null
            p.out = Outing("trip", "trip:${pl.id}", "trip", until); sim.say(p, "出發去${pl.zh}囉！") }
        st.trips += Trip(st.nextId++, pl.id, ppl.map { it.id }, life.minute, until)
        while (st.trips.size > 30) st.trips.removeAt(0)
        sim.log(ppl[0], "${ppl.joinToString("、") { it.name }}出發去${pl.zh}一日小旅行", kind = "event", weight = 2)
        return null
    }
    private fun tripHome(t: Trip, live: Boolean) {
        t.back = true; val pl = Trips.ALL[t.place] ?: return; val r = Rng.of(life.seed, "trip:${t.id}")
        val ppl = t.who.mapNotNull { sim.person(it) }.filter { it.out?.stage == "trip" }
        val e = sim.house.entrance
        for (p in ppl) { p.out = null; p.x = e.x + 0.5f; p.y = e.y + 0.5f; p.why = emptyList(); val b = sim.body(p.id); b.think = 1f; b.pose = Pose.STAND
            sim.addMood(p, "trip"); p.recent["home"] = life.minute; p.recent["outing"] = life.minute
            sim.log(p, "在${pl.zh}${r.pick(pl.lines)}", kind = "event", weight = 2)
            keep(p, Keepsake("trip:${pl.id}", pl.souvenir, pl.souvenirIcon, day, "去${pl.zh}旅行帶回來的"))
            if (live) sim.say(p, "我回來了！${pl.zh}好好玩！") }
        for (a in ppl) for (b in ppl) if (a !== b) sim.society.relUpdate(a, b) { it.copy(like = it.like + 3, familiar = it.familiar + 3) }
        t.souvenir = pl.souvenir
        if (ppl.isNotEmpty()) {
            val ys = sim.you.st; val ph = Photo(ys.nextId++, life.minute, ppl.map { it.id }, ppl.map { "HAPPY" }, "warm", "polaroid", listOf("heart"), "sun", 13.0, "${pl.zh}一日遊")
            ys.photos += ph; while (ys.photos.size > 60) ys.photos.removeAt(0)
            post(ppl[0], "和${ppl.drop(1).joinToString("、") { it.name }.ifBlank { "自己" }}去了${pl.zh}！", "image")
            sim.journal.did(ppl[0].id, "trip")
        }
    }

    // ---------------- Q-11 keepsakes ----------------
    fun keep(p: Person, k: Keepsake) { val l = st.cabinet.getOrPut(p.id) { mutableListOf() }; if (l.any { it.id == k.id && it.day == k.day }) return; l += k; while (l.size > 12) l.removeAt(0) }
    fun cabinet(pid: String): List<Keepsake> = st.cabinet[pid].orEmpty()
    /** a find in the park: one in three is kept (its own dice) */
    internal fun found(p: Person, goodId: String) {
        val g = Goods.ALL[goodId] ?: return
        if (Rng.of(life.seed, "keep:${p.id}:${life.minute.toLong()}").chance(0.34)) keep(p, Keepsake(goodId, g.zh, "leaf", day, "在公園撿到，捨不得用"))
    }

    // ---------------- G-08 the memory frame ----------------
    internal fun frameLook(p: Person) {
        val r = Rng.of(life.seed, "frame:${p.id}:${life.minute.toLong()}")
        val ph = sim.you.st.photos.lastOrNull()
        val what = ph?.caption?.takeIf { it.isNotBlank() } ?: life.log.filter { it.fav && it.kind != "note" }.let { if (it.isEmpty()) null else r.pick(it).text } ?: "剛搬進來的那天"
        sim.log(p, r.pick(Frame.LOOKS).replace("{事}", what), kind = "life", weight = 1)
    }

    // ---------------- G-05 a resident moves a small thing on their own ----------------
    private fun nudge(r: Rng) {
        if (!r.chance(0.12)) return
        val p = life.people.filter { it.out == null && !it.desk }.let { if (it.isEmpty()) return else r.pick(it) }
        val list = sim.decorate.pieces(); val idx = list.indices.filter { list[it].kind in setOf("plant", "lamp", "rug", "bench") }; if (idx.isEmpty()) return
        val i = r.pick(idx); val pc = list[i]; val room = sim.house.rooms.firstOrNull { it.id == pc.room } ?: return
        repeat(10) {
            val x = room.x + r.nextInt(room.w.coerceAtLeast(1)); val y = room.y + 1 + r.nextInt((room.h - 1).coerceAtLeast(1))
            if (x == pc.x && y == pc.y) return@repeat
            if (sim.decorate.move(i, x, y) == null) { sim.log(p, "把${app.ocshimeji.sim.house.Furniture.kind(pc.kind).zh}挪了一下位置，說這樣比較順眼", kind = "life", weight = 2); return }
        }
    }

    // ---------------- F-12 the desktop diary ----------------
    private fun deskDiary(r: Rng) {
        for ((pid, m) in st.deskMin.toList()) { if (m < 30) continue; val p = sim.person(pid) ?: continue
            val h = (m / 60).toInt(); val mm = (m % 60).toInt()
            val lines = listOf("（桌面日記）今天在你的手機桌面上待了" + (if (h > 0) " $h 小時" else "") + " $mm 分鐘。", r.pick(DESK_LINES))
            life.prog.diary += DiaryEntry(day - 1, pid, lines); while (life.prog.diary.size > 200) life.prog.diary.removeAt(0)
            sim.journal.did(p.id, "deskday") }
        st.deskMin.clear()
    }
    companion object {
        val DESK_LINES = listOf("你一直在滑手機，我就在旁邊看著。", "在螢幕邊邊散步，差點掉下去。", "你打字好快，我看得眼睛都花了。", "今天在桌面上睡了一個午覺。", "你在手機上忙了好久，辛苦了。", "希望你明天也帶我出來。")
    }
}
