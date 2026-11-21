package app.ocshimeji.sim.social

import app.ocshimeji.sim.life.Pose

/** one line of a little scene: who (0 = the one who starts, 1 = the other), what they say, their pose, the effect over the head */
data class Beat(val who: Int, val text: String, val pose: Pose? = null, val fx: String? = null)

/**
 * Scripts are written compactly: `A:line@POSE#fx / B:line`. Every line is plain (我／你) and passes through `Speech.say` when played.
 */
object Script {
    fun parse(s: String): List<Beat> = s.split(" / ").map { part ->
        val who = if (part.startsWith("B:")) 1 else 0
        var t = part.substring(2); var fx: String? = null; var pose: Pose? = null
        t.indexOf('#').takeIf { it >= 0 }?.let { fx = t.substring(it + 1); t = t.substring(0, it) }
        t.indexOf('@').takeIf { it >= 0 }?.let { pose = Pose.valueOf(t.substring(it + 1)); t = t.substring(0, it) }
        Beat(who, t.trim(), pose, fx)
    }
}

/**
 * The chemistry table (plan C-03, first 30): two characters with this pair of traits / tags / quirks get a special scene.
 * `a` belongs to the one who starts, `b` to the other. `like` moves both directions; `fun` is given to both.
 */
data class ChemDef(val id: String, val zh: String, val a: String, val b: String, val script: String, val like: Int = 2, val fun_: Float = 15f, val conflict: Int = 0, val closeup: Boolean = true) {
    val beats by lazy { Script.parse(script) }
}
object Chemistry {
    private fun c(id: String, zh: String, a: String, b: String, script: String, like: Int = 2, fun_: Float = 15f, conflict: Int = 0) = ChemDef(id, zh, a, b, script, like, fun_, conflict)
    val ALL: List<ChemDef> = listOf(
        c("race", "莫名其妙的比賽", "好勝", "好勝", "A:{對方}，我們來比賽！@HAPPY / B:比什麼？ / A:比誰先把這杯水喝完！#sparkle / B:（咕嚕咕嚕咕嚕）@EAT / A:……平手？我不接受！@ANGRY#anger", like = 2, fun_ = 20f, conflict = 1),
        c("nag_care", "追著叮嚀", "愛照顧人", "天然呆", "A:你外套穿反了。 / B:咦？@DIZZY#sweat / A:還有鞋帶、還有頭髮……過來我幫你。 / B:謝謝……你好像媽媽喔。#heart", like = 3),
        c("chase_talk", "被追著聊", "健談", "害羞", "A:你今天做了什麼？吃了什麼？喜歡什麼顏色？ / B:呃、那個……@SHY#sweat / A:沒關係，慢慢說，我等你！ / B:……藍色。（小聲）", like = 2, fun_ = 8f),
        c("silent_read", "安靜的讀書會", "書蟲", "書蟲", "A:（翻頁）@READ / B:（翻頁）@READ / A:……這本很好看。 / B:我知道，我看第三遍了。#sparkle", like = 3, fun_ = 10f),
        c("fridge_war", "冰箱爭奪戰", "貪吃", "貪吃", "A:最後一盒布丁是我的！ / B:我先看到的！@ANGRY / A:那……猜拳決定！#anger / B:剪刀石頭布！@HAPPY", like = 1, fun_ = 18f, conflict = 2),
        c("cloud_talk", "雲的形狀", "夢想家", "好奇", "A:你看那朵雲，像不像一隻在洗澡的鯨魚？@LOOK / B:真的耶！旁邊那朵像在幫牠刷背！ / A:牠們感情一定很好。@DAYDREAM#sparkle", like = 3, fun_ = 14f),
        c("tsundere", "嘴上說不要", "嘴硬心軟", "黏人", "B:陪我嘛陪我嘛～ / A:才、才不要。我很忙。@SHY / B:好吧……（轉身） / A:……等一下！我、我剛好有空。#heart", like = 4, fun_ = 8f),
        c("seal_duel", "封印對決", "中二病", "中二病", "A:我右手的封印……快壓不住了！@SWING / B:哼，我的左眼也甦醒了！@SWING#sparkle / A:那、那就一決勝負吧！ / B:……先吃完飯再說。", like = 3, fun_ = 20f),
        c("blood_sub", "血液代餐問題", "吸血鬼", "甜點師", "A:請問，草莓大福可以算是一種血液代餐嗎？ / B:……顏色是有點像。 / A:那我可以只吃這個活下去嗎？@HAPPY / B:我會每天幫你做。#heart", like = 3),
        c("sword_commute", "御劍算不算通勤", "劍修", "社畜", "A:我每天御劍上山，算不算通勤？ / B:有打卡嗎？ / A:……什麼是打卡？@DIZZY / B:我好羨慕你。#gloom", like = 2, fun_ = 16f),
        c("cry_together", "安慰到一起哭", "樂天", "愛哭", "B:（吸鼻子）@SAD / A:沒事沒事！明天一定會更好！ / B:嗚嗚……你人真好……#gloom / A:不要哭啦，我也要哭了……@SAD#gloom", like = 3, fun_ = 6f),
        c("hurry", "快一點啦", "急性子", "慢吞吞", "A:快點快點快點！@HAPPY / B:嗯……好……等我……找一下……鞋子……@DAYDREAM / A:你已經找了十分鐘了！#anger / B:找到了……是左腳的。#sweat", like = 1, fun_ = 12f, conflict = 1),
        c("perfect_fix", "幫你擺正", "完美主義", "天然呆", "B:（把杯子放在桌上） / A:……歪了兩度。@TIDY / B:咦？ / A:沒事，我來。（喀）#sparkle", like = 1, fun_ = 8f),
        c("remote", "搶電視", "電視迷", "遊戲廢人", "A:這集不能錯過！ / B:我的遊戲還沒存檔！@ANGRY#anger / A:……那你先存檔，我等你。 / B:這關要打一個小時。#sweat", like = 0, fun_ = 10f, conflict = 2),
        c("water_friend", "被當成植物", "園藝家", "植物系", "A:（拿著澆水壺走過來）@WATER / B:等、等一下，我是人！……大概。#shock / A:可是你的葉子好像有點乾。 / B:……那就一點點。#sparkle", like = 3, fun_ = 16f),
        c("mirror_war", "搶鏡子", "愛漂亮", "自戀", "A:借我照一下鏡子！ / B:不行，我還沒欣賞完自己。@PRIMP / A:你已經照二十分鐘了！#anger / B:美是需要時間的。#sparkle", like = 1, fun_ = 12f, conflict = 1),
        c("calm_drama", "淡定與大驚小怪", "冷靜", "情緒化", "B:天啊！湯灑了！世界末日了！@SAD#shock / A:擦一擦就好。 / B:你為什麼可以這麼冷靜！ / A:因為只是湯。#chill", like = 2, fun_ = 12f),
        c("improv", "即興小劇場", "戲精", "戲精", "A:（倒在沙發上）啊……我中了蛋糕的毒……@LIE / B:不——！是誰下的手！@SAD / A:是……冰箱……#soul / B:冰箱，我饒不了你！@ANGRY#fire", like = 3, fun_ = 22f),
        c("pudding_case", "布丁失竊案", "偵探", "天然呆", "A:布丁不見了。犯人就在這個家裡。@READ / B:好可怕……是誰呢？ / A:你嘴角有焦糖。 / B:……啊。#shock", like = 2, fun_ = 18f),
        c("fate_duel", "宿命對決", "魔王", "騎士", "A:勇敢的騎士啊，你終於來了。@SWING / B:魔王！今天就是你的末日！@SWING#fire / A:……要不要先吃點心？ / B:……好。#heart", like = 3, fun_ = 18f),
        c("ghost_scare", "嚇到魂都飛了", "幽靈", "怕鬼", "A:（從牆壁裡探出頭）嗨～ / B:哇啊啊啊啊！@DIZZY#soul / A:對、對不起！我只是想打招呼！#sweat / B:下次……走門……", like = 0, fun_ = 10f, conflict = 2),
        c("cat_melt", "融化了", "貓奴", "貓系", "A:（盯——）@LOOK / B:……幹嘛？ / A:可以……摸一下耳朵嗎？#heart / B:……一下下就好。@SHY", like = 3, fun_ = 12f),
        c("dog_cat", "互相不理解", "犬系", "貓系", "A:來玩！來玩！來玩！@HAPPY / B:……我在午睡。@LIE / A:那我陪你睡！ / B:不要靠那麼近。#sweat", like = 1, fun_ = 12f),
        c("autograph", "可以簽名嗎", "追星族", "偶像", "A:可、可以幫我簽名嗎！@SHY#heart / B:當然！要寫什麼？@HAPPY / A:寫「給最喜歡的你」！ / B:……好，最喜歡的你。#sparkle", like = 4, fun_ = 14f),
        c("firmware", "檢查韌體", "駭客", "仿生人", "A:你的韌體版本好舊。 / B:會怎樣嗎？ / A:你的感情模組有一個錯誤：太容易開心。 / B:那就不要修。@HAPPY#heart", like = 3, fun_ = 10f),
        c("tasting", "試吃大會", "廚師", "吃貨", "A:新菜，試吃一下。@TIDY / B:（吃）……！！@EAT#sparkle / A:怎麼樣？ / B:再一盤。不，再三盤。#heart", like = 3, fun_ = 14f),
        c("wakeup", "叫起床大作戰", "早起體質", "睡神", "A:起床了！太陽曬屁股了！@HAPPY / B:……再五分鐘……@LIE / A:你一個小時前也這樣說！#anger / B:……再五分鐘。#soul", like = 1, fun_ = 10f, conflict = 1),
        c("monologue", "一直講與嗯", "碎碎念", "冷靜", "A:然後啊我就想說那個其實也可以這樣、還有那個…… / B:嗯。 / A:……你有在聽嗎？ / B:有。你說到第三個「那個」。#chill", like = 2, fun_ = 8f),
        c("fortune", "幫你算一卦", "占卜師", "好奇", "A:我幫你看看今天的運勢。@READ / B:好啊好啊！ / A:……今天會遇到一個帥氣的占卜師。 / B:那不就是你嗎！#sparkle", like = 3, fun_ = 14f),
        c("workout_drag", "被拉去運動", "健身狂", "懶散", "A:走！去運動！@SWING / B:不要……我要跟沙發結婚……@LIE / A:十下深蹲就好！ / B:（做了一下）……我死了。#soul", like = 1, fun_ = 10f),
    )
}

/**
 * Personality clash sparks (plan 13.4, first 15): opposites living together go through stages —
 * 0 摩擦 → 1 衝突 → then 2 磨合 (a house rule, or they adapt to each other) or 3 疏遠 (they keep out of each other's way).
 */
data class SparkDef(val id: String, val zh: String, val a: String, val b: String, val friction: String, val clash: String, val settle: String, val apart: String, val rule: String) {
    val stages by lazy { listOf(Script.parse(friction), Script.parse(clash), Script.parse(settle), Script.parse(apart)) }
}
object Sparks {
    private fun k(id: String, zh: String, a: String, b: String, f: String, c: String, s: String, p: String, rule: String) = SparkDef(id, zh, a, b, f, c, s, p, rule)
    val ALL: List<SparkDef> = listOf(
        k("clean_messy", "愛乾淨 × 邋遢", "愛乾淨", "邋遢", "A:（偷偷把{對方}亂丟的襪子收起來）@TIDY / B:咦？我的襪子呢？", "A:我真的受不了了！你的東西到處都是！@ANGRY#anger / B:亂一點又不會怎樣！@ANGRY",
            "A:我們來訂家規吧：用完的東西放回原位。 / B:……好啦。我試試看。#sparkle", "A:……你的東西，我不會再碰了。 / B:隨便你。#chill", "用完的東西放回原位"),
        k("shy_talky", "社恐 × 健談", "健談", "社恐", "A:嗨嗨！今天好嗎？ / B:（躲到書架後面）@SHY#sweat", "A:你為什麼一直躲我？ / B:我、我只是……不知道要說什麼……@SAD#gloom",
            "A:那你不用說話，我說給你聽就好。 / B:……嗯。這樣好像不錯。#heart", "A:……好吧，我不吵你了。 / B:（鬆了一口氣，又有點寂寞）", "想聊天先問一聲"),
        k("lark_owl", "早起 × 夜貓子", "早起", "夜貓子", "A:（一大早就在哼歌）♪ / B:……現在才六點……@LIE", "B:你可以小聲一點嗎！我才睡三小時！@ANGRY#anger / A:可是早上的空氣很好啊！",
            "A:那我早上去陽台哼歌。 / B:我晚上也會戴耳機。……謝謝。#sparkle", "B:（把房門關上，貼了一張「勿擾」）#chill / A:……喔。", "早上六點到九點小聲一點"),
        k("germ_messy", "潔癖 × 邋遢", "潔癖", "邋遢", "A:（拿著消毒噴霧跟在{對方}後面）@TIDY / B:……你在噴什麼？", "A:你剛剛摸了冰箱又摸了沙發！ / B:那又怎樣！@ANGRY#anger",
            "A:回家先洗手，好嗎？ / B:好啦，我洗。（洗了三十秒）#sparkle", "A:（在沙發上鋪了一條只屬於自己的毛巾）#chill / B:……隨便你。", "回家先洗手"),
        k("neat_later", "整理狂 × 拖延症", "整理狂", "拖延症", "A:這個什麼時候要收？ / B:等一下。", "A:你的「等一下」已經三天了！@ANGRY#anger / B:……明天一定收。",
            "A:那我們每天睡前一起收五分鐘。 / B:五分鐘……可以。#sparkle", "A:（自己默默收完了）……算了。#gloom / B:……（假裝沒看到）", "每天睡前一起收五分鐘"),
        k("fast_slow", "急性子 × 慢吞吞", "急性子", "慢吞吞", "A:快一點啦！ / B:我在快了……", "A:每次都等你！@ANGRY#anger / B:你可以先走啊……@SAD",
            "A:我早十分鐘叫你，你早十分鐘準備。 / B:成交。#sparkle", "A:以後我先走了。 / B:……嗯。#chill", "出門前十分鐘先叫一聲"),
        k("lone_cling", "獨立 × 黏人", "黏人", "獨立", "A:你在做什麼？我陪你！ / B:……我想一個人待一下。", "A:你是不是討厭我？@SAD#gloom / B:不是！我只是需要空間！@ANGRY",
            "B:晚飯後的時間給你，其他時間給我自己，好嗎？ / A:好！晚飯後見！#heart", "A:（不再主動找{對方}了）#gloom / B:……這樣也好。", "晚飯後是一起的時間"),
        k("quiet_chatter", "怕吵 × 碎碎念", "碎碎念", "怕吵", "A:然後還有啊、對了還有…… / B:（摀住耳朵）@SHY", "B:拜託安靜一分鐘就好！@ANGRY#anger / A:……我只是想跟你說話。@SAD",
            "B:你可以寫紙條給我，我會看。 / A:好！我寫十張！#sparkle", "B:（戴上耳塞）#chill / A:……（閉上嘴巴）@SAD", "想說很多話時寫紙條"),
        k("calm_emo", "冷靜 × 情緒化", "情緒化", "冷靜", "A:今天好開心！不，好難過！不……@HAPPY / B:……嗯。", "A:你根本不在乎我的感受！@SAD#gloom / B:我在乎，只是不會表現出來。",
            "B:你開心時，我就陪你笑一下。 / A:那我難過時呢？ / B:陪你坐著。#heart", "A:算了，你不懂。#chill / B:……嗯。", "難過的時候說一聲"),
        k("busy_lazy", "勤快 × 懶散", "勤快", "懶散", "A:（掃地掃到{對方}腳邊） / B:（把腳抬起來，繼續躺）@LIE", "A:你都不幫忙！@ANGRY#anger / B:我有在休息啊！",
            "A:家事分一分吧：你洗碗，我掃地。 / B:……洗碗就好？那可以。#sparkle", "A:（一個人做完所有家事）#gloom / B:（翻了個身，繼續睡）@LIE", "家事分工：洗碗與掃地"),
        k("perfect_space", "完美主義 × 天然呆", "完美主義", "天然呆", "B:（把書倒著放回書架） / A:……@TIDY#sweat", "A:你為什麼每次都放錯！@ANGRY#anger / B:我、我不是故意的……@SAD",
            "A:我在書架貼了標籤，照著放就好。 / B:好厲害！看得懂！#sparkle", "A:書架……以後我來就好。#chill / B:……對不起。@SAD", "照標籤放東西"),
        k("snack_germ", "夜宵派 × 潔癖", "夜宵派", "潔癖", "A:（半夜煮了泡麵，碗留在水槽） / B:……誰的碗。@ANGRY", "B:半夜吃東西就算了，碗要洗！#anger / A:明天早上洗嘛……",
            "A:吃完馬上洗，我發誓。 / B:……那我幫你留一盞燈。#heart", "B:（在水槽貼了「半夜禁止」）#chill / A:……好啦。@SAD", "宵夜的碗吃完就洗"),
        k("alone_free", "怕孤單 × 獨立", "怕孤單", "獨立", "A:你要出去嗎？我也去！ / B:……我只是去倒垃圾。", "A:你每次都丟下我！@SAD#gloom / B:我沒有！我只是習慣一個人！",
            "B:那我出門前跟你說一聲。 / A:嗯！我會等你回來。#heart", "A:（抱著抱枕，一個人坐在客廳）#gloom / B:（出門了）", "出門前說一聲"),
        k("tv_book", "電視迷 × 書蟲", "電視迷", "書蟲", "A:（電視開得很大聲）@WATCH / B:……（看同一行看了五次）@READ", "B:可以關小聲嗎！@ANGRY#anger / A:這是最精彩的地方耶！",
            "A:我戴耳機看。 / B:我看完這章，也陪你看一集。#sparkle", "B:（搬去臥室看書）#chill / A:……（把電視轉小聲，可是沒人在聽了）@SAD", "電視晚上九點後戴耳機"),
        k("dark_sleep", "怕黑 × 睡神", "怕黑", "睡神", "A:（偷偷開了一盞小燈） / B:……好亮……@LIE", "B:有光我睡不著！@ANGRY#anger / A:沒有光我會怕啊！@SAD#gloom",
            "B:那我們用一盞很暗很暗的小夜燈。 / A:……好，這樣剛好。#heart", "A:（抱著手電筒睡）#gloom / B:……（背對著光睡著了）@LIE", "睡覺時開一盞小夜燈"),
    )
}

/**
 * Everyday events (plan 4.5 / 13.5: the first daily pool) and one serial drama (flags across days).
 * `cond` is read by `Society.eventOk`; `hours` = when it can happen (game hours, start..end, may wrap past midnight).
 */
data class EventDef(val id: String, val zh: String, val cond: String, val from: Int, val to: Int, val script: String, val like: Int = 2, val fun_: Float = 10f, val closeup: Boolean = false, val weight: Int = 2) {
    val beats by lazy { Script.parse(script) }
}
object Events {
    private fun e(id: String, zh: String, cond: String, from: Int, to: Int, script: String, like: Int = 2, fun_: Float = 10f, closeup: Boolean = false) = EventDef(id, zh, cond, from, to, script, like, fun_, closeup)
    val DAILY: List<EventDef> = listOf(
        e("sunset", "一起看夕陽", "window", 17, 19, "A:{對方}，你看，夕陽。@LOOK / B:好漂亮……@LOOK / A:每天都看得到，可是每天都不一樣。#sparkle", like = 3),
        e("lost", "找東西", "", 8, 21, "A:我的{物}不見了…… / B:我幫你找！@LOOK / B:是不是這個？在沙發下面。 / A:找到了！謝謝你！@HAPPY#heart", like = 3),
        e("sofadoze", "靠在沙發上一起打瞌睡", "sleepyPair", 13, 17, "A:……（打哈欠）@SIT / B:……（打哈欠）@SIT / A:（頭慢慢歪到{對方}肩上）zzz@LIE / B:……（沒有推開）zzz@LIE#heart", like = 3, fun_ = 4f),
        e("hair", "互相整理頭髮", "", 6, 10, "A:你頭髮翹起來了。 / B:你的也是。 / A:那我們互相整理一下。@PRIMP / B:好了，很可愛。#sparkle", like = 2),
        e("arm", "比腕力", "active", 10, 20, "A:來比腕力！@SWING / B:好啊！ / A:嗚嗚嗚嗚……！@ANGRY#fire / B:……我要用力了喔。#shock", like = 1, fun_ = 16f),
        e("hanky", "遞手帕", "someoneSad", 0, 24, "B:（偷偷擦眼淚）@SAD / A:……給你。（遞出手帕） / B:……謝謝。#heart", like = 4, fun_ = 2f, closeup = true),
        e("headpat", "摸頭安慰", "someoneSad", 0, 24, "B:今天好糟喔……@SAD#gloom / A:（摸摸{對方}的頭）辛苦了。 / B:……嗯。（好一點了）", like = 3, fun_ = 2f),
        e("caught", "偷吃冰箱被抓包", "glutton", 21, 3, "A:（打開冰箱，拿出布丁）@EAT / B:……你在做什麼？ / A:沒、沒有！我在……檢查冰箱有沒有壞！#sweat / B:那順便幫我也檢查一個。#heart", like = 2, fun_ = 16f),
        e("bathqueue", "早上搶浴室", "bathMorning", 6, 9, "A:（敲門）還沒好嗎？ / B:再五分鐘！ / A:你五分鐘前也這樣說！@ANGRY#anger / B:好啦好啦，出來了！#sweat", like = 0, fun_ = 6f),
        e("tvcry", "看電視看到哭", "crier", 19, 23, "A:（看電視）……嗚……@WATCH / B:你在哭嗎？ / A:才沒有……是眼睛在流汗……@SAD#gloom / B:……給你衛生紙。#heart", like = 2),
        e("overheard", "背後說好話", "third", 9, 21, "A:跟你說，{第三人}其實人很好。 / B:我也這麼覺得。 / A:（沒發現{第三人}就在旁邊聽到了）#sparkle", like = 2),
        e("morningrun", "拉對方晨練", "active", 6, 9, "A:早安！一起去做體操！@SWING / B:……現在？ / A:一、二、三、四！@SWING / B:（跟著動了一下）……其實還不錯。#sparkle", like = 2, fun_ = 12f),
        e("stars", "看星星", "window", 21, 24, "A:今晚的星星好多。@LOOK / B:那顆最亮的，好像在對我們眨眼。@LOOK / A:我們來許個願吧。#sparkle", like = 3),
        e("teatime", "下午茶", "", 15, 17, "A:下午茶時間到！@HAPPY / B:有什麼點心？ / A:只有茶。 / B:……那也很好。@EAT#heart", like = 2),
        e("ghoststory", "講鬼故事", "", 21, 2, "A:我講一個鬼故事……走廊盡頭有一扇門…… / B:不、不要講了……@SHY#sweat / A:門打開，裡面是……一盒布丁。 / B:……什麼啦！#anger", like = 1, fun_ = 16f),
        e("firsttalk", "第一次好好聊天", "strangers", 9, 21, "A:我們好像還沒好好聊過。 / B:對耶……你平常喜歡做什麼？ / A:我喜歡{物}。 / B:真的嗎！我也有點興趣。#sparkle", like = 4, closeup = true),
        e("secret", "交換秘密", "close", 20, 24, "A:跟你說一個秘密，你不能說出去喔。@SHY / B:嗯，我發誓。 / A:……其實我會怕打雷。 / B:那下次打雷，我陪你。#heart", like = 4, closeup = true),
        e("cookhelp", "一起做飯", "", 11, 19, "A:我要煮飯了，來幫忙！@TIDY / B:我負責切菜！@TIDY / A:那個是……糖，不是鹽。#sweat / B:……甜的咖哩也不錯吧？", like = 2, fun_ = 12f),
        e("plantname", "幫盆栽取名字", "plant", 8, 18, "A:這盆植物還沒有名字耶。@WATER / B:叫它「小綠」？ / A:太普通了。叫它「葉之騎士」。 / B:……好，葉之騎士。#sparkle", like = 2, fun_ = 12f),
        e("birthday", "幫壽星慶生", "birthday", 8, 22, "A:{對方}，生日快樂！@HAPPY#sparkle / B:你記得！ / A:當然記得。來，許個願吧。 / B:（閉上眼睛）……許好了。#heart", like = 5, fun_ = 12f, closeup = true),
    )
    /** the serial drama 「消失的布丁」 (five episodes, one a day; flags carry it on) */
    val SERIAL_ZH = "消失的布丁"
    val SERIAL: List<EventDef> = listOf(
        e("pudding1", "消失的布丁（1）布丁不見了", "", 9, 21, "A:我的布丁……不見了！@SHY#shock / B:冰箱裡那個嗎？ / A:對！上面還寫了我的名字！@SAD#gloom", like = 0, closeup = true),
        e("pudding2", "消失的布丁（2）嫌疑人", "", 9, 21, "A:{對方}，是不是你吃的？ / B:才不是我！@ANGRY#anger / A:……那會是誰呢？", like = -1, closeup = true),
        e("pudding3", "消失的布丁（3）線索", "", 9, 21, "B:我在沙發底下找到一根湯匙。@LOOK / A:上面還有焦糖！ / B:犯人一定就在這個家裡……#sparkle", like = 1),
        e("pudding4", "消失的布丁（4）真相", "", 9, 21, "B:……其實，是我半夜夢遊吃掉的。@SHY#sweat / A:什麼！？@SHY#stone / B:我醒來嘴邊都是焦糖……對不起。", like = 1, closeup = true),
        e("pudding5", "消失的布丁（5）新的布丁", "", 11, 19, "A:那我們一起做一個新的布丁吧。@TIDY / B:這次寫我們兩個人的名字。@HAPPY / A:……然後一人一半。#heart", like = 5, fun_ = 15f, closeup = true),
    )
}
