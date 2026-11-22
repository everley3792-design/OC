package app.ocshimeji.sim.act

import app.ocshimeji.sim.house.Furniture
import app.ocshimeji.sim.life.Activity
import app.ocshimeji.sim.life.Acts
import app.ocshimeji.sim.life.Env
import app.ocshimeji.sim.life.LifeSim
import app.ocshimeji.sim.life.Need
import app.ocshimeji.sim.life.Person
import app.ocshimeji.sim.social.SocialActs

/** what was tapped (R3 環狀選單) */
enum class On { PERSON, SELF, PIECE, FLOOR, SKY }

/**
 * One thing that can be done to something you tapped (overhaul plan R3). `by` = "you" (you do it: the screen carries out `op`)
 * or "them" (the resident you picked does it: `op` is the order for `Society.suggest`, `act:<id>` or `soc:<id>`).
 * `cat` groups them into the second ring of the menu; `kinds` = the furniture it needs (PIECE).
 */
data class Interaction(val id: String, val zh: String, val on: On, val by: String, val cat: String, val icon: String, val op: String, val kinds: Set<String> = emptySet())

/** an interaction for this target right now: `why` = why it cannot be done (shown greyed out, with the reason), `what` = the order to give */
data class Choice(val ia: Interaction, val why: String?, val what: String = "", val target: String? = null) { val ok get() = why == null }

/**
 * The interaction registry (R3): every menu in the house is built from here, so the menus, the tests and the report count the same list.
 * Social acts and activities are read from their own tables (a new act is one more row there, and it shows up here by itself).
 */
object Interactions {
    private fun you(id: String, zh: String, on: On, cat: String, icon: String, op: String = id) = Interaction("you:$id", zh, on, "you", cat, icon, op)
    /** what an activity is mostly for, in a word (the ring it is in) */
    fun catOf(a: Activity): String = when (a.per.maxByOrNull { it.value }?.key) {
        Need.FOOD -> "吃"; Need.ENERGY -> "休息"; Need.HYGIENE -> "清潔"; Need.SOCIAL -> "陪伴"; Need.COMFORT -> "放鬆"; Need.ROOM -> "家事"; else -> "玩" }
    val CAT_ICON = mapOf("吃" to "food", "休息" to "moon", "清潔" to "drop", "陪伴" to "people", "放鬆" to "sun", "家事" to "check", "玩" to "game",
        "打招呼" to "chat", "聊天" to "chat", "分享" to "gift", "玩笑" to "star", "稱讚" to "star", "抱怨" to "cloud", "衝突" to "anger", "和好" to "pinky", "送禮" to "gift", "邀請" to "people", "肢體" to "heart", "照顧" to "heart", "戀愛" to "heart")
    /** activities that are not ordered from a menu (they happen by themselves or are reached another way) */
    private val NOT = setOf("chat", "queue", "outing", "meal", "dishes", "craft")

    val ALL: List<Interaction> = buildList {
        // ---- you → a resident
        add(you("card", "看看", On.PERSON, "你", "eye")); add(you("pet", "摸摸", On.PERSON, "你", "heart")); add(you("feed", "給點心", On.PERSON, "你", "food"))
        add(you("talk", "聊天", On.PERSON, "你", "chat")); add(you("rps", "猜拳", On.PERSON, "你", "game")); add(you("hide", "躲貓貓", On.PERSON, "你", "eye"))
        add(you("control", "操控", On.PERSON, "你", "move")); add(you("worry", "處理煩惱", On.PERSON, "你", "drop")); add(you("ask", "回應請求", On.PERSON, "你", "mail"))
        add(you("mem", "記憶", On.PERSON, "你", "list")); add(you("desk", "到手機桌面", On.PERSON, "你", "phone")); add(you("edit", "編輯設定", On.PERSON, "你", "edit"))
        add(you("follow", "鏡頭跟著", On.PERSON, "你", "eye")); add(you("rels", "關係", On.PERSON, "你", "people"))
        // ---- the resident you picked, tapped again
        add(you("stop", "停下來", On.SELF, "你", "close")); add(you("out", "出門去小鎮", On.SELF, "你", "town")); add(you("selfcard", "人物卡", On.SELF, "你", "eye", "card"))
        add(you("unselect", "不操控了", On.SELF, "你", "back")); add(you("clear", "清空排程", On.SELF, "你", "undo"))
        // ---- you → furniture, the floor, the sky
        add(you("info", "這是什麼", On.PIECE, "你", "eye")); add(you("move", "移動它", On.PIECE, "你", "move")); add(you("seek", "找找看", On.PIECE, "你", "eye"))
        add(you("place", "擺家具", On.FLOOR, "你", "plus")); add(you("decor", "壁紙地板", On.FLOOR, "你", "image")); add(you("call", "叫誰過來", On.FLOOR, "你", "people"))
        add(you("w:", "天氣自然", On.SKY, "天氣", "sun"))
        for (w in Env.ALL) add(Interaction("you:w:$w", Env.zh(w), On.SKY, "you", if (w in Env.SPECIAL) "天象" else "天氣", when (w) { "rain", "storm" -> "rain"; "snow" -> "snow"; "fog" -> "fog"; "cloudy", "aurora" -> "cloud"; "stars" -> "star"; else -> "sun" }, "w:$w"))
        add(you("s:", "季節跟著日期", On.SKY, "季節", "clock"))
        for ((k, zh) in listOf("spring" to "定在春天", "summer" to "定在夏天", "autumn" to "定在秋天", "winter" to "定在冬天")) add(you("s:$k", zh, On.SKY, "季節", if (k == "winter") "snow" else "sun"))
        add(you("pause", "暫停／繼續", On.SKY, "時間", "clock")); add(you("env", "環境面板", On.SKY, "時間", "list"))
        // ---- the resident you picked → someone else (every social act)
        for (s in SocialActs.ALL.values) add(Interaction("soc:${s.id}", s.zh, On.PERSON, "them", s.cat, CAT_ICON[s.cat] ?: "chat", "soc:${s.id}"))
        // ---- the resident you picked → a piece of furniture / a spot on the floor
        for (a in Acts.ALL.values) { if (a.id in NOT) continue
            val kinds = if (a.kind == null) emptySet() else Furniture.KINDS.values.filter { LifeSim.fits(a.kind, it.id) }.map { it.id }.toSet()
            add(Interaction("act:${a.id}", a.zh, if (a.kind == null) On.FLOOR else On.PIECE, "them", catOf(a), CAT_ICON[catOf(a)] ?: "dots", "act:${a.id}", kinds)) }
    }
    val BY_ID = ALL.associateBy { it.id }
    operator fun get(id: String) = BY_ID[id]

    /** you tapped a resident (`actor` = null), or the resident you picked tapped someone (`actor`), or itself (SELF) */
    fun forPerson(sim: LifeSim, actor: Person?, target: Person): List<Choice> {
        val gone = when { target.out != null -> "${target.name}出門了"; target.desk -> "${target.name}在手機桌面上"; else -> null }
        if (actor == null) return ALL.filter { it.on == On.PERSON && it.by == "you" }.mapNotNull { ia ->
            when (ia.op) {
                "worry" -> if (target.worry == null) null else Choice(ia, gone)
                "ask" -> if (target.ask == null) null else Choice(ia, gone)
                "desk" -> Choice(ia, if (target.out != null) gone else null)
                "rps", "hide", "pet", "feed", "talk" -> Choice(ia, gone ?: if (sim.asleep(target) && ia.op != "pet") "${target.name}在睡覺" else null)
                else -> Choice(ia, null)
            } }
        if (actor === target) return ALL.filter { it.on == On.SELF }.map { ia ->
            Choice(ia, when (ia.op) {
                "stop" -> if (actor.act == null || actor.with != null) "現在沒有在做什麼" else null
                "out" -> gone ?: if (sim.asleep(actor)) "在睡覺" else null
                "clear" -> if (sim.society.pending(actor).isEmpty()) "沒有排程" else null
                else -> null }) } + forFloor(sim, actor, actor.x.toInt(), actor.y.toInt())
        val busy = actorProblem(sim, actor)
        return ALL.filter { it.on == On.PERSON && it.by == "them" }.mapNotNull { ia ->
            val s = SocialActs[ia.op.removePrefix("soc:")]!!
            if (s.romance && !sim.society.romanceOk(actor, target)) return@mapNotNull null   /* not even shown: romance off, or a minor (plan 第十節) */
            val stage = sim.rel(actor.id, target.id)?.let { SocialActs.stageIndex(it.kind) } ?: 0
            val why = busy ?: gone ?: when {
                sim.asleep(target) -> "${target.name}在睡覺"
                s.cond == "playerOnly" -> "要從煩惱泡泡由你決定"
                stage < s.stage -> "還不夠熟（要到「${SocialActs.LADDER[s.stage]}」）"
                !sim.society.condOk(s, actor, target) -> "現在不適合"
                else -> null }
            Choice(ia, why, ia.op, target.id)
        }
    }
    /** a piece of furniture: what you can do with it, or (with `actor`) what the one you picked can do there */
    fun forPiece(sim: LifeSim, actor: Person?, pi: Int): List<Choice> {
        val piece = sim.house.pieces.getOrNull(pi) ?: return emptyList()
        val acts = ALL.filter { it.on == On.PIECE && it.by == "them" && piece.kind in it.kinds }
        if (actor == null) return ALL.filter { it.on == On.PIECE && it.by == "you" }.mapNotNull { ia ->
            when (ia.op) { "seek" -> if (sim.life.people.none { sim.society.hiding(it.id) != null }) null else Choice(ia, null); "move" -> Choice(ia, if (piece.kind in sim.decorate.FIXED) "${Furniture.kind(piece.kind).zh}是固定的" else null); else -> Choice(ia, null) } } +
            acts.map { Choice(it, null, "${it.op}@$pi") }   /* "叫誰來…": the screen asks who */
        val busy = actorProblem(sim, actor)
        return acts.map { ia -> val a = Acts[ia.op.removePrefix("act:")]!!
            Choice(ia, busy ?: if (!sim.canDo(actor, a)) "${actor.name}不會${a.zh}" else sim.pieceProblem(actor, a, pi), "${ia.op}@$pi") }
    }
    /** a spot on the floor */
    fun forFloor(sim: LifeSim, actor: Person?, tx: Int, ty: Int): List<Choice> {
        val acts = ALL.filter { it.on == On.FLOOR && it.by == "them" }
        if (actor == null) return ALL.filter { it.on == On.FLOOR && it.by == "you" }.map { Choice(it, null) }
        val g = sim.grid; val reach = g.walkable(tx, ty) && g.distances(actor.x.toInt(), actor.y.toInt()).let { d -> tx in 0 until g.w && ty in 0 until g.hh && d[ty * g.w + tx] >= 0 }
        val busy = actorProblem(sim, actor) ?: if (!reach) "走不到那裡" else null
        return acts.mapNotNull { ia -> val a = Acts[ia.op.removePrefix("act:")]!!
            if (!sim.canDo(actor, a)) null else Choice(ia, busy, "${ia.op}@t$tx,$ty") }   /* only what this one does at all (their own activities) */
    }
    /** the window or the sky above the house */
    fun forSky(sim: LifeSim): List<Choice> = ALL.filter { it.on == On.SKY }.map { ia ->
        val w = ia.op.removePrefix("w:")
        Choice(ia, if (ia.op.startsWith("w:") && w == "snow" && sim.season() != "winter") "只有冬天會下雪" else null) }

    private fun actorProblem(sim: LifeSim, p: Person): String? = when {
        p.out != null -> "${p.name}出門了"; p.desk -> "${p.name}在手機桌面上"; sim.asleep(p) -> "${p.name}在睡覺"
        sim.society.pending(p).size >= sim.society.QUEUE_MAX -> "排程滿了（最多 ${sim.society.QUEUE_MAX} 件）"
        else -> null }
}
