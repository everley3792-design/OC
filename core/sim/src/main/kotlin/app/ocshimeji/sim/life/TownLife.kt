package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.house.RoomKind
import app.ocshimeji.sim.social.Ask
import app.ocshimeji.sim.social.Beat
import app.ocshimeji.sim.social.Script
import app.ocshimeji.sim.town.Goal
import app.ocshimeji.sim.town.Goods
import app.ocshimeji.sim.town.Job
import app.ocshimeji.sim.town.Outing
import app.ocshimeji.sim.town.Town
import app.ocshimeji.sim.town.TownAct
import app.ocshimeji.sim.town.Weather
import app.ocshimeji.sim.town.Work
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * The town in the life (plan M6): residents go to town on their own (plan B-12) — there is a road and it takes time — and do
 * things at the plaza, the grocery, the furniture shop, the café and the park; meet there (25 town events); buy food with the
 * household's star coins; come home. Also: weather events (rainbow, first snow), the daily goals, the news, the workshop
 * (commissions a resident crafts at home), the market stall, the public corners, and how nice each room is.
 *
 * Everything goes through `LifeSim` (same clock, same Rng, same log) and `Economy` (the ledger); it runs the same way away.
 */
class TownLife(private val sim: LifeSim) {
    private val life get() = sim.life
    private val town get() = life.town
    private val eco get() = sim.economy
    private var lastMinute = Double.NaN

    // ================= going out =================
    /** the trip to town as a candidate: the door is the destination; personality, the house, the weather and plans decide */
    internal fun outingCand(p: Person, a: Activity, dist: IntArray?, r: Rng, abstract: Boolean, isNight: Boolean, out: ArrayList<LifeSim.Cand>) {
        val h = sim.hour
        if (isNight || h < 8 || h > 18.5 || life.arriving) return
        if (life.minute - (p.recent["outing"] ?: -1e9) < 8 * 60) return
        var (g, why) = sim.gain(p, a); val (k, pw) = sim.appeal(p, a)
        g *= k * 0.8f * (1f + 0.3f * p.spec.axis(Axis.OUTGOING))
        if (sim.house.id == "studio") g *= 1.5f                      /* plan 12.3: studio residents go out more */
        if (sim.weather() == "rain" && !p.spec.weather.contains("雨")) g *= 0.35f
        if (p.wish?.let { !it.done && it.kind == "eat" } == true) g *= 1.2f
        val e = sim.house.entrance; val d = if (dist != null) dist[e.y * sim.grid.w + e.x] else 0
        if (d < 0) return
        out += LifeSim.Cand(a, -1, -1, e.x + 0.5f, e.y + 0.5f, g / (1f + (if (abstract) 0 else d) / 14f) * (0.85f + 0.3f * r.nextFloat()), listOf("想出門去小鎮走走") + why + listOfNotNull(pw))
    }
    private fun rngFor(live: Boolean, p: Person) = if (live) sim.rng else Rng.of(life.seed, "town:${(life.minute / 10).toLong()}:${p.id}")
    /** what to do in town: needs, personality, money, the weather and the season */
    private fun pickAct(p: Person, r: Rng, exclude: String = ""): TownAct {
        val acts = Town.acts(sim.weather(), sim.season()).filter { it.place != exclude }
        return r.weighted(acts) { a ->
            var w = 1.0
            for ((n, v) in a.per) if (v > 0) w += (100 - p.need(n)) / 50.0 * (v / 20.0)
            for (t in a.tags) w *= sim.mods(p).act(t).toDouble()
            if (a.cost > 0 && eco.wallet < a.cost + 20) w *= 0.1
            if (a.id == "shop" && life.bag.keys.count { Goods.ALL[it]?.kind == "food" } < 2 && eco.wallet > 60) w *= 2.0
            if (a.id == "picnic" && p.spec.likes.any { it.contains("野餐") || it.contains("公園") }) w *= 3.0
            w
        } ?: Town.ACTS.getValue("bench")
    }
    /** they set off (from the door) */
    fun leave(p: Person, live: Boolean = true) {
        val r = rngFor(live, p); val a = pickAct(p, r)
        sim.release(p); p.act = null; p.why = listOf("在小鎮"); p.recent["outing"] = life.minute
        val b = sim.body(p.id); b.arrivedAct = false; b.path = null; b.micro = null
        val e = sim.house.entrance; p.x = e.x + 0.5f; p.y = e.y + 0.5f
        p.out = Outing("go", a.place, a.id, life.minute + Town.TRAVEL)
        val rain = sim.weather() == "rain"
        sim.say(p, if (rain) "下雨了，帶把傘再出門。" else "我出門囉！")
        sim.log(p, "出門去小鎮的" + Town.place(a.place).zh + if (rain) "（撐著傘）" else "", kind = "life", weight = 1)
    }
    /** everyone in town moves on (called every step live, every chunk away) */
    internal fun step(live: Boolean) {
        val dm = if (lastMinute.isNaN()) 0.0 else max(0.0, life.minute - lastMinute); lastMinute = life.minute
        for (p in life.people) { val o = p.out ?: continue; outing(p, o, live) }
        crafting(dm)
        weatherEvents(live)
        if (live) checkAsks()
    }
    private fun outing(p: Person, o: Outing, live: Boolean) {
        val r = rngFor(live, p); val now = life.minute
        if (sim.hour >= 20.5 && o.stage != "back") { o.stage = "back"; o.until = now + Town.TRAVEL }   /* home before it is late */
        when (o.stage) {
            "go" -> if (now >= o.until) { val a = Town.ACTS.getValue(o.act)
                if (a.cost > 0 && !eco.spend(a.cost, "${p.name}在${Town.place(a.place).zh}${a.zh}", p.id)) { val alt = pickAct(p, r).takeIf { it.cost == 0 } ?: Town.ACTS.getValue("bench"); o.act = alt.id; o.place = alt.place }
                o.stage = "at"; o.until = now + Town.ACTS.getValue(o.act).min
                Town.ACTS.getValue(o.act).line.takeIf { it.isNotBlank() }?.let { sim.say(p, it) } }
            "at" -> {
                meet(p, o, r, live)
                if (now >= o.until) { finishAct(p, Town.ACTS.getValue(o.act), r); o.acts++
                    if (o.acts < 2 && sim.hour < 18 && r.chance(0.35)) { val next = pickAct(p, r, o.place); o.stage = "go"; o.place = next.place; o.act = next.id; o.until = now + Town.TRAVEL / 3 }
                    else { o.stage = "back"; o.until = now + Town.TRAVEL } }
            }
            "back" -> if (now >= o.until) comeHome(p)
        }
    }
    private fun finishAct(p: Person, a: TownAct, r: Rng) {
        for ((n, v) in a.per) p.setNeed(n, p.need(n) + v)
        when (a.id) {
            "shop" -> { val stock = Goods.grocery(life.seed, Weather.dayOf(life.minute)).sortedByDescending { g -> (if (p.spec.tastes[g.taste] ?: 0 > 0) 2 else 0) + (if (p.spec.likes.any { g.zh.contains(it) || it.contains(g.zh) }) 3 else 0) }
                val g = stock.firstOrNull { it.price <= eco.wallet - 30 }
                if (g != null && eco.buy(g.id, 1, g.price, "${p.name}在雜貨店買了${g.zh}", p.id)) sim.log(p, "在雜貨店買了${g.zh}帶回家", kind = "life", weight = 1) }
            "browse" -> if (p.ask == null && r.chance(0.3)) { val want = Goods.FURNITURE.filter { it.furniture in setOf("plant", "lamp", "rug", "shelf", "bench") }.let { r.pick(it) }
                p.ask = Ask("furniture", want.furniture, "家具店有一個${want.zh}好可愛……可以放在我的房間嗎？", life.minute) }
            "board" -> town.news.firstOrNull()?.let { sim.log(p, "在布告欄看到：$it", kind = "life", weight = 1) }
        }
        sim.log(p, "在小鎮${a.zh}", kind = "life", weight = 1)
    }
    /** two residents at the same place: a town event, once per pair per outing */
    private fun meet(p: Person, o: Outing, r: Rng, live: Boolean) {
        val q = life.people.firstOrNull { it !== p && it.out?.let { x -> x.stage == "at" && x.place == o.place } == true } ?: return
        if (p.id > q.id) return
        val key = "townmeet:${p.id}:${q.id}"; if (life.minute - (life.soc.seen[key] ?: -1e9) < 6 * 60) return
        life.soc.seen[key] = life.minute
        val w = sim.weather(); val se = sim.season()
        val evs = Town.EVENTS.filter { it.place == o.place && (it.weather.isEmpty() || w in it.weather) && (it.season.isEmpty() || se in it.season) }
        val e = if (evs.isEmpty() || !r.chance(0.7)) null else r.pick(evs)
        if (e == null) { sim.society.build(p, q, "chat", r).apply(); return }
        val beats = Script.parse(e.script)
        if (live) beats.take(2).forEach { bt: Beat -> val who = if (bt.who == 0) p else q; val other = if (bt.who == 0) q else p
            sim.say(who, bt.text.replace("{對方}", other.spec.nickname.ifBlank { other.name })); bt.fx?.let { sim.events += SimEvent("fx", who.id, it) } }
        for ((a, b) in listOf(p to q, q to p)) { sim.society.relUpdate(a, b) { it.copy(like = it.like + e.like, familiar = it.familiar + 3, seenDay = life.day) }; a.setNeed(Need.FUN, a.need(Need.FUN) + 12f); a.setNeed(Need.SOCIAL, a.need(Need.SOCIAL) + 20f) }
        sim.log(p, "在小鎮的${Town.place(o.place).zh}和${q.name}：${e.zh}", kind = "event", weight = 2, with = q.id)
        corner(p, o.place)
    }
    /** public corners (plan 13.9): they notice what you put there */
    private fun corner(p: Person, place: String) {
        val here = town.corners.filterKeys { it.startsWith(place) }.values.firstOrNull() ?: return
        val key = "corner:${p.id}:${life.day}"; if (life.soc.seen.containsKey(key)) return; life.soc.seen[key] = life.minute
        val zh = Economy.nameOf(life, here); sim.say(p, "這個${zh}是你放的嗎？我很喜歡。"); sim.log(p, "在${Town.place(place).zh}注意到你放的$zh", kind = "you", weight = 1)
    }
    private fun comeHome(p: Person) {
        p.out = null; val e = sim.house.entrance; p.x = e.x + 0.5f; p.y = e.y + 0.5f; p.why = emptyList()
        val b = sim.body(p.id); b.think = 1f; b.pose = Pose.STAND
        sim.addMood(p, "town"); sim.say(p, "我回來了！"); sim.log(p, "從小鎮回家了", kind = "life", weight = 1)
    }
    /** who is in town now, and where (the town screen) */
    fun inTown(): List<Pair<Person, Outing>> = life.people.mapNotNull { p -> p.out?.let { p to it } }

    // ================= weather events (plan D-06) =================
    private fun weatherEvents(live: Boolean) {
        val home = life.people.filter { it.out == null && !it.desk && !sim.asleep(it) }
        val w = sim.weather(); val day = Weather.dayOf(life.minute)
        if (w == "snow" && sim.season() == "winter") { val year = java.time.LocalDate.ofEpochDay(day).let { if (it.monthValue <= 2) it.year - 1 else it.year }
            if (town.firstSnowYear != year && home.isNotEmpty()) { town.firstSnowYear = year; for (p in home) sim.addMood(p, "firstsnow")
                home.firstOrNull()?.let { sim.say(it, "下雪了！是今年的第一場雪！"); sim.log(it, "大家一起看了今年的初雪", kind = "event", weight = 3) } } }
        if (Weather.rainbow(life.seed, life.minute) && !life.soc.seen.containsKey("rainbow:$day") && home.isNotEmpty()) {
            life.soc.seen["rainbow:$day"] = life.minute; for (p in home) sim.addMood(p, "rainbow")
            home.first().let { sim.say(it, "快看！外面有彩虹！"); sim.log(it, "雨停了，大家看到了彩虹", kind = "event", weight = 3) } }
    }

    // ================= daily: goals, news, the stall =================
    internal fun newDay() {
        val day = life.day; val r = Rng.of(life.seed, "goals:$day")
        // the stall sells (yesterday's market)
        for ((item, price) in town.stall.entries.toList()) {
            val base = basePrice(item); val chance = when { price <= base -> 0.6; price <= base * 3 / 2 -> 0.35; else -> 0.1 }
            if (Rng.of(life.seed, "stall:$day:$item").chance(chance)) { town.stall.remove(item); eco.sale(item, price, "市集賣出：${Economy.nameOf(life, item)}")
                val wk = town.works.getOrPut(item.removePrefix("item:")) { Work() }; wk.sold++; wk.ratings += 3 + Rng.of(life.seed, "rate:$day:$item").nextInt(3)
                life.people.firstOrNull()?.let { sim.log(it, "市集攤位賣出了${Economy.nameOf(life, item)}（$price 星幣）", kind = "you", weight = 2) } }
        }
        // three goals
        if (life.goalsDay != day) {
            life.goalsDay = day; life.goals.clear()
            val ppl = life.people.filter { !it.desk }
            val pool = ArrayList<Goal>()
            for (p in ppl) { pool += Goal("pet", p.id, "摸摸${p.name}", 20); pool += Goal("feed", p.id, "給${p.name}吃點心", 20); pool += Goal("talk", p.id, "和${p.name}聊天", 20); pool += Goal("rps", p.id, "和${p.name}猜拳", 25) }
            pool += Goal("buy", "", "在小鎮的店買一樣東西", 25); pool += Goal("worry", "", "處理一個煩惱", 40); pool += Goal("wish", "", "幫誰完成一個心願", 50); pool += Goal("place", "", "在家裡擺一件家具", 30)
            val picked = ArrayList<Goal>(); while (picked.size < 3 && pool.isNotEmpty()) { val g = r.pick(pool); pool.removeAll { it.kind == g.kind }; picked += g }
            life.goals += picked
        }
        // the news (plan 13.9 新聞速報): yesterday's big things, today's weather, today's shelf
        val from = floor(life.startMinute / 1440) * 1440 + (day - 2) * 1440
        val big = life.log.filter { it.minute >= from && it.minute < from + 1440 && it.weight >= 2 && it.who.isNotEmpty() }.sortedByDescending { it.weight }.take(2).map { "【昨日】" + it.text }
        town.news = big + "【天氣】今天是${Weather.ZH[sim.weather()]}（${Weather.SEASON_ZH[sim.season()]}天）" + "【雜貨店】今天有${Goods.grocery(life.seed, Weather.dayOf(life.minute)).take(3).joinToString("、") { it.zh }}"
        town.newsDay = day
    }
    /** a small goal done: coins in (once) */
    fun goal(kind: String, target: String = "") {
        val g = life.goals.firstOrNull { !it.done && it.kind == kind && (it.target.isEmpty() || it.target == target) } ?: return
        g.done = true; eco.earn(g.reward, "每日小目標：${g.text}")
        life.people.firstOrNull()?.let { sim.log(it, "你完成了今天的小目標「${g.text}」，得到 ${g.reward} 星幣", kind = "you", weight = 1) }
        sim.events += SimEvent("goal", "", g.text)
    }

    // ================= the shops, the stall, the corners (what you do) =================
    fun stock(place: String): List<app.ocshimeji.sim.town.Good> = when (place) { "grocery" -> Goods.grocery(life.seed, Weather.dayOf(life.minute)); "furniture" -> Goods.furniture(life.seed, Weather.dayOf(life.minute)); else -> emptyList() }
    /** you buy something (null = done, otherwise why not) */
    fun buy(goodId: String): String? {
        val g = Goods.ALL[goodId] ?: return "沒有這個商品"
        if (stock(if (g.kind == "food") "grocery" else "furniture").none { it.id == g.id }) return "今天沒有賣${g.zh}"
        if (!eco.buy(g.id, 1, g.price, "你在${if (g.kind == "food") "雜貨店" else "家具店"}買了${g.zh}")) return "星幣不夠（還差 ${g.price - eco.wallet}）"
        goal("buy"); return null
    }
    fun basePrice(item: String): Int = Goods.ALL[item]?.price ?: life.items.firstOrNull { "item:" + it.id == item }?.price?.takeIf { it > 0 } ?: 30
    fun list(item: String, price: Int): String? {
        if (price !in 1..9999) return "價格要在 1～9999"; if (town.stall.containsKey(item)) return "這個已經在攤位上了"; if (town.stall.size >= 6) return "攤位最多放 6 樣"
        if (!eco.move(item, -1, "放上市集攤位：${Economy.nameOf(life, item)}")) return "背包裡沒有"; town.stall[item] = price; return null
    }
    fun unlist(item: String) { town.stall.remove(item) ?: return; eco.move(item, 1, "從攤位收回：${Economy.nameOf(life, item)}") }
    fun putCorner(corner: String, item: String): String? {
        if (corner !in app.ocshimeji.sim.town.TownState.CORNERS) return "沒有這個角落"; if (town.corners.containsKey(corner)) return "這裡已經放了東西"
        if (!eco.move(item, -1, "放到小鎮的${app.ocshimeji.sim.town.TownState.CORNERS[corner]}：${Economy.nameOf(life, item)}")) return "背包裡沒有"; town.corners[corner] = item; return null
    }
    fun takeCorner(corner: String) { val item = town.corners.remove(corner) ?: return; eco.move(item, 1, "從小鎮收回：${Economy.nameOf(life, item)}") }

    // ================= the workshop (plan 12.6 委託製作) =================
    /** materials for one commission: a third of its price, at least 10 */
    fun commissionCost(itemId: String): Int = max(10, (life.items.firstOrNull { it.id == itemId }?.price?.takeIf { it > 0 } ?: 30) / 3)
    /** ask a resident to make one of your items: materials cost coins, they craft at home for a few hours */
    fun commission(itemId: String, makerId: String): String? {
        val it0 = life.items.firstOrNull { it.id == itemId } ?: return "這個物品還沒有帶進這個世界（重新打開世界）"
        val m = sim.person(makerId) ?: return "沒有這個人"
        if (town.jobs.any { it.maker == makerId }) return "${m.name}手上已經有一件委託了"
        val cost = commissionCost(itemId)
        if (!eco.spend(cost, "委託${m.name}做${it0.name}的材料費", m.id)) return "星幣不夠（材料費 $cost）"
        val skill = m.spec.skills.values.maxOrNull() ?: 0
        town.jobs += Job(life.soc.nextId++, itemId, makerId, life.minute, (180 - skill * 15).coerceIn(90, 180).toDouble(), cost)
        m.plan.add(0, "craft"); sim.log(m, "接下你的委託：做一個${it0.name}", kind = "you", weight = 2); sim.say(m, "交給我吧！"); return null
    }
    private fun crafting(dm: Double) {
        for (j in town.jobs.toList()) {
            val m = sim.person(j.maker)
            if (m == null) { town.jobs.remove(j); continue }
            if (m.act == "craft" && sim.body(m.id).arrivedAct) j.worked += dm else if (m.out == null && !m.desk && !sim.asleep(m)) j.worked += dm * 0.25   /* spare moments at home count a little */
            if (j.worked >= j.need) {
                town.jobs.remove(j); val name = life.items.firstOrNull { it.id == j.item }?.name ?: "作品"
                eco.move("item:" + j.item, 1, "${m.name}做好了$name", m.id); town.works.getOrPut(j.item) { Work() }.made++
                sim.addMood(m, "crafted"); sim.say(m, "做好了！你看，${name}！"); sim.log(m, "做好了你委託的$name，放進背包了", kind = "you", weight = 2)
            }
        }
    }

    // ================= rooms (plan G-03, G-06) =================
    /** how nice a room is: tidy, pretty, comfortable (0..100 each) */
    fun roomScore(roomId: String): Triple<Int, Int, Int> {
        val pcs = sim.house.pieces.filter { it.room == roomId }; val room = sim.house.rooms.firstOrNull { it.id == roomId } ?: return Triple(0, 0, 0)
        val tidy = (100 - (life.mess[roomId] ?: 10f)).toInt()
        var pretty = 0; var comfy = 0
        for (pc in pcs) { pretty += when { pc.kind == "plant" -> 18; pc.kind == "rug" -> 12; pc.kind == "lamp" -> 10; pc.kind == "window" -> 12; pc.kind == "mirror" -> 6; pc.kind.startsWith("item:") -> 15; else -> 0 }
            comfy += when (pc.kind) { "sofa", "bench" -> 25; "bed", "bed2" -> 20; "rug" -> 10; "table" -> 12; else -> if (pc.kind.startsWith("item:") && Furniture.kind(pc.kind).slots.isNotEmpty()) 20 else 0 } }
        life.decor[roomId]?.let { if (it.wall.isNotBlank()) pretty += 15; if (it.floor.isNotBlank()) pretty += 15 }
        if (room.kind == RoomKind.BATH || room.kind == RoomKind.KITCHEN) comfy += 30
        if (room.kind == RoomKind.YARD) pretty += 20
        return Triple(tidy, min(100, pretty * 100 / 60), min(100, comfy * 100 / 50))
    }
    private val moodCache = HashMap<String, Pair<Long, String?>>()
    /** a nice room cheers them up, a bare one does not (checked about every game hour) */
    internal fun roomMood(p: Person): String? {
        val room = sim.roomOf(p); val hourKey = (life.minute / 60).toLong(); moodCache[room]?.let { if (it.first == hourKey) return it.second }
        val (a, b, c) = roomScore(room); val avg = (a + b + c) / 3
        val m = if (avg >= 70) "cosy" else if (avg <= 30) "bare" else null; moodCache[room] = hourKey to m; return m
    }
    /** asked for a piece of furniture (plan G-06): placed in their room = done */
    private fun checkAsks() {
        for (p in life.people) { val a = p.ask ?: continue; if (a.kind != "furniture") continue
            if (sim.house.pieces.any { it.room == p.room && (it.kind == a.thing || Furniture.kind(it.kind).actsAs.contains(a.thing)) }) {
                p.ask = null; sim.addMood(p, "newthing"); p.affinity = (p.affinity + 4).coerceIn(0, 100); sim.say(p, "房間裡有${Furniture.kind(a.thing).zh}了！謝謝你！", toPlayer = true)
                sim.log(p, "你在${p.name}的房間放了${Furniture.kind(a.thing).zh}", kind = "you", weight = 2) } }
    }
}
