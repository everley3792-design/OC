package app.ocshimeji.sim.social

import app.ocshimeji.sim.Rng
import app.ocshimeji.sim.chars.CharSpec

/**
 * Topics and cross-world topic collisions (plan C-02 / 13.1). Every tag carries a few "concepts"; when two characters talk the
 * concepts of both are paired and poured into an original collision pattern, so a sword cultivator and an office worker end up
 * seriously discussing whether flying on a sword counts as commuting. Offline, data-driven: a concept table and a pattern table.
 */
object Topics {
    /** tag id → concepts (only the data here knows about tags; nothing else in the code does) */
    val CONCEPTS: Map<String, List<String>> = mapOf(
        "現代" to listOf("手機", "便利商店", "外送"), "西幻" to listOf("魔物", "冒險者公會", "回復藥水"), "東方玄幻" to listOf("靈氣", "閉關", "丹藥"),
        "賽博科幻" to listOf("義體", "資料網路", "霓虹招牌"), "怪談" to listOf("走廊盡頭的門", "半夜的電話", "鏡子裡的人"), "童話" to listOf("南瓜馬車", "森林茶會", "會說話的鏡子"),
        "未知" to listOf("來的地方", "記憶的空白"), "蒸汽龐克" to listOf("齒輪", "蒸汽", "飛空艇"), "末日" to listOf("罐頭", "廢墟", "儲糧"), "校園" to listOf("期末考", "社團", "午休"),
        "武俠" to listOf("輕功", "內力", "江湖規矩"), "太空歌劇" to listOf("曲速航行", "艦隊", "外星料理"), "神話" to listOf("神諭", "祭品", "天界"),
        "狐妖" to listOf("尾巴", "幻術", "油豆腐"), "樹人" to listOf("年輪", "光合作用", "落葉"), "雪人" to listOf("融化", "紅蘿蔔鼻子", "暖氣"), "精靈" to listOf("森林", "長壽", "弓箭"),
        "獸人" to listOf("換毛季", "嗅覺", "肉"), "吸血鬼" to listOf("血", "日光", "棺材"), "史萊姆" to listOf("分裂", "黏液", "形狀"), "仿生人" to listOf("充電", "韌體更新", "感情模組"),
        "妖" to listOf("修行", "人類的樣子", "百鬼夜行"), "神明" to listOf("香火", "許願", "神社"), "幽靈" to listOf("穿牆", "未了的心願", "冷風"), "未知生物" to listOf("觸角", "從哪來", "奇怪的叫聲"),
        "龍" to listOf("寶藏", "噴火", "鱗片"), "人魚" to listOf("尾巴", "海", "歌聲"), "天使" to listOf("翅膀", "光環", "天堂的規定"), "惡魔" to listOf("契約", "地獄", "靈魂"),
        "植物系" to listOf("澆水", "曬太陽", "花粉"), "貓系" to listOf("紙箱", "午睡", "逗貓棒"), "犬系" to listOf("散步", "撿球", "尾巴"), "兔系" to listOf("紅蘿蔔", "耳朵", "跳"),
        "鳥系" to listOf("羽毛", "飛", "築巢"), "機器人" to listOf("電池", "螺絲", "程式錯誤"), "占卜師" to listOf("水晶球", "塔羅牌", "命運"), "郵差" to listOf("信", "地址", "送達"),
        "圖書館員" to listOf("借書證", "安靜", "逾期"), "店員" to listOf("排班", "客人", "結帳"), "魔王" to listOf("征服世界", "勇者", "城堡"), "宗門長老" to listOf("門規", "弟子", "修為"),
        "偶像" to listOf("演唱會", "粉絲", "練舞"), "駭客" to listOf("防火牆", "密碼", "鍵盤"), "鍊金術師" to listOf("等價交換", "藥水", "金子"), "學生" to listOf("作業", "考試", "放學"),
        "甜點師" to listOf("奶油", "烤箱", "草莓大福"), "無業遊民" to listOf("自由", "睡到自然醒"), "劍修" to listOf("御劍", "宗門", "閉關"), "社畜" to listOf("加班", "通勤", "報表"),
        "醫生" to listOf("打針", "健康檢查", "值班"), "畫家" to listOf("顏料", "靈感", "畫布"), "作家" to listOf("截稿日", "靈感", "稿子"), "廚師" to listOf("火候", "刀工", "試吃"),
        "騎士" to listOf("盔甲", "誓言", "馬"), "魔法師" to listOf("咒語", "魔杖", "魔力"), "偵探" to listOf("線索", "不在場證明", "推理"), "園丁" to listOf("修剪", "肥料", "花圃"),
        "音樂家" to listOf("節拍", "樂譜", "練習"), "運動員" to listOf("訓練", "比賽", "肌肉"), "王族" to listOf("王冠", "禮儀", "城堡"), "傭兵" to listOf("委託", "報酬", "武器"),
        "研究員" to listOf("實驗", "數據", "論文"), "老師" to listOf("上課", "改作業", "點名"), "重度甜食控" to listOf("蛋糕", "布丁", "糖"), "財迷" to listOf("錢", "存款", "折扣"),
        "社恐" to listOf("打電話", "人群", "眼神接觸"), "收集狂" to listOf("收藏", "限定版"), "潔癖" to listOf("灰塵", "消毒", "細菌"), "咖啡成癮" to listOf("咖啡", "咖啡因"),
        "遊戲廢人" to listOf("存檔", "等級", "抽卡"), "書痴" to listOf("書", "書店"), "中二病" to listOf("被封印的右手", "黑暗之力", "宿命"), "吃貨" to listOf("下一餐", "宵夜", "吃到飽"),
        "睡神" to listOf("被窩", "鬧鐘", "午睡"), "貓奴" to listOf("貓", "肉球"), "夜宵派" to listOf("宵夜", "泡麵"), "健身狂" to listOf("蛋白質", "深蹲", "肌肉"), "追星族" to listOf("偶像", "應援"),
    )
    /** concepts of one character: tags, likes, hobbies (plain words of the player count too) */
    fun conceptsOf(s: CharSpec, custom: List<app.ocshimeji.sim.chars.CustomTag> = emptyList()): List<String> {
        val out = ArrayList<String>()
        for (t in s.tags) (CONCEPTS[t] ?: custom.firstOrNull { it.id == t }?.concepts)?.let { out += it }
        for (l in s.likes) out += l.removeSuffix("的事")
        out += s.hobbies
        return out.distinct()
    }

    /** a collision pattern (13.1 句型分類): {A} = a concept of the one who starts, {B} = of the other */
    data class Pattern(val cat: String, val open: String, val serious: List<String>, val tsukkomi: List<String>)
    val PATTERNS = listOf(
        Pattern("定義", "{A}算不算一種{B}？", listOf("嗯……嚴格來說，應該算。", "這個問題很深奧，我要想一下。", "如果照我們那裡的規定，算。"), listOf("當然不算吧！", "你到底在想什麼啦。")),
        Pattern("定義", "如果{B}的時候用{A}，會不會被罰錢？", listOf("要看有沒有許可證。", "我覺得要先申請。"), listOf("誰會那樣做啦！", "……你真的打算這麼做？")),
        Pattern("比較", "{A}和{B}，哪個比較累？", listOf("一定是{B}，我跟你說……", "差不多吧，都很辛苦。"), listOf("這有什麼好比的！", "兩個都不要啦。")),
        Pattern("比較", "{A}跟{B}，你選哪一個？", listOf("……我選{A}。理由有三個。", "可以兩個都要嗎？"), listOf("這是什麼爛問題！", "都不選！")),
        Pattern("經驗", "我那裡都是用{A}解決{B}的。", listOf("原來如此，下次我也試試看。", "好厲害，請詳細說明。"), listOf("{B}？用{A}？怎麼可能！", "你們那裡到底是什麼地方。")),
        Pattern("經驗", "說到{B}，我以前遇過一次{A}……", listOf("然後呢然後呢？", "……真是辛苦你了。"), listOf("這兩個哪裡有關係啦！", "你在講什麼故事。")),
        Pattern("誤會", "你剛剛說{B}？我還以為是{A}。", listOf("不是啦，是{B}。……不過{A}也不錯。", "也、也有可能是{A}。"), listOf("差很多好嗎！", "你的耳朵還好嗎？")),
        Pattern("誤會", "所以{B}其實就是{A}的意思吧？", listOf("……被你這麼一說，好像是耶。", "這是一個新的觀點。"), listOf("完全不是！", "才不是！")),
    )
    /** how they take a topic: serious (認真) or the straight man (吐槽); personality decides */
    fun serious(s: CharSpec): Boolean = s.axis(3) < 0.3f || s.axis(2) > 0.3f || "天然呆" in s.traits
    /** a collision between two characters, or null when they share no concepts to collide */
    fun collide(a: CharSpec, b: CharSpec, r: Rng, custom: List<app.ocshimeji.sim.chars.CustomTag> = emptyList()): Triple<String, String, Boolean>? {
        val ca = conceptsOf(a, custom); val cb = conceptsOf(b, custom)
        if (ca.isEmpty() || cb.isEmpty()) return null
        val x = r.pick(ca); val y = r.pick(cb.filter { it != x }.ifEmpty { return null })
        val p = r.pick(PATTERNS); val ser = serious(b)
        val open = p.open.replace("{A}", x).replace("{B}", y)
        val reply = r.pick(if (ser) p.serious else p.tsukkomi).replace("{A}", x).replace("{B}", y)
        return Triple(open, reply, ser)
    }
    /** plain topics: what they just did, what they ate, a shared like, the weather of the season */
    val OPEN = listOf("吶，{對方}，你知道{話題}嗎？", "說到{話題}……", "{對方}，跟你說{話題}的事。", "對了，{話題}你覺得怎麼樣？")
    val REPLY_AGREE = listOf("我也這麼覺得！", "對對對！", "真的，我懂。", "哈哈，好好笑。")
    val REPLY_DISAGREE = listOf("咦，我不這麼想耶。", "是嗎？我覺得不是。", "……我們看法不太一樣。")
}
