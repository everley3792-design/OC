package app.ocshimeji.sim.life

import app.ocshimeji.sim.Rng

/**
 * The little words of a memory (R1, from the observation genre's principle: a small thing is a time, an action, a sound and one
 * line of narration). Original text; `pick` uses the life's own Rng so a day always reads the same way.
 */
object Flavor {
    /** activity → (sound, aside) choices; "" = no sound */
    private val ACT: Map<String, List<Pair<String, String>>> = mapOf(
        "sleep" to listOf("呼——" to "被子裹成一團", "" to "睡得很沉", "嗯……" to "翻了個身"),
        "nap" to listOf("呼嚕" to "午後的光暖暖的", "" to "打了一個小盹"),
        "sofanap" to listOf("" to "在沙發上睡著了", "呼……" to "抱枕掉到地上"),
        "snack" to listOf("咔滋" to "偷偷多拿了一個", "喀啦" to "冰箱的燈亮了一下"),
        "cook" to listOf("滋滋——" to "廚房飄出香味", "咚咚咚" to "切菜的聲音很有節奏", "鏘" to "鍋鏟碰了一下鍋"),
        "meal" to listOf("" to "吃得很專心", "嗯！" to "好吃得瞇起眼睛", "" to "最後一口留給最喜歡的"),
        "bathe" to listOf("嘩啦——" to "浴室裡都是水蒸氣", "噗嚕噗嚕" to "在浴缸裡吹泡泡"),
        "primp" to listOf("" to "對著鏡子做了個鬼臉", "嗯……" to "撥了撥瀏海"),
        "tv" to listOf("哈哈" to "節目演到好笑的地方", "" to "看著看著發起呆"),
        "tvrug" to listOf("" to "盤腿坐在電視前", "哇" to "跟著節目一起驚呼"),
        "read" to listOf("沙沙" to "翻頁的聲音", "" to "看到入迷忘了時間"),
        "relax" to listOf("呼——" to "整個人陷進沙發裡", "" to "什麼都不想"),
        "sitrug" to listOf("" to "抱著膝蓋坐著", "" to "看著地毯的花紋"),
        "water" to listOf("嘩啦" to "葉子上掛著水珠", "" to "跟植物說了聲早安"),
        "window" to listOf("" to "看著外面的天空", "" to "數著飄過去的雲"),
        "tidy" to listOf("唰唰" to "房間變得清爽", "嘿咻" to "把東西一件件放回原位"),
        "daydream" to listOf("" to "眼神放空了", "……" to "想著很遠的事"),
        "dishes" to listOf("嘩啦嘩啦" to "碗盤疊得整整齊齊", "鏘" to "差點滑了一下"),
        "garden" to listOf("" to "拔了幾根雜草", "嘿咻" to "土的味道"),
        "laundry" to listOf("啪" to "把衣服甩平", "" to "風一吹，衣服鼓起來"),
        "craft" to listOf("喀擦" to "剪刀剪過紙的聲音", "" to "做得很專心"),
        "rainwatch" to listOf("滴答滴答" to "雨打在窗上", "" to "看雨滴賽跑"),
        "snowwatch" to listOf("" to "雪靜靜地下", "哇……" to "外面全白了"),
        "tea" to listOf("咕嘟咕嘟" to "水燒開了", "呼——" to "吹涼了再喝"),
        "diary" to listOf("沙沙" to "寫到一半偷笑了一下", "" to "今天的事寫了好幾行"),
        "music" to listOf("♪" to "跟著節奏點頭", "" to "閉上眼睛聽"),
        "stretch" to listOf("嗯——" to "伸了一個大懶腰", "喀" to "肩膀響了一聲"),
        "phone" to listOf("" to "滑著滑著笑了出來", "嗶" to "收到一則訊息"),
        "makebed" to listOf("啪啪" to "把枕頭拍鬆", "" to "棉被摺得方方正正"),
        "puzzle" to listOf("喀" to "找到一塊拼對了", "嗯……" to "這一塊到底在哪"),
        "fold" to listOf("" to "衣服疊成小山", "啪" to "把襯衫甩平"),
        "album" to listOf("" to "看到以前的照片笑了", "啊" to "原來那時候是這樣"),
        "letter" to listOf("沙沙" to "寫了又劃掉", "" to "信紙折成小方塊"),
        "plantchat" to listOf("" to "小聲說今天的事", "嘿嘿" to "覺得葉子點了點頭"),
        "hum" to listOf("啦啦啦" to "哼著自己編的歌", "嗯嗯～" to "邊哼邊轉圈"),
        "chat" to listOf("" to "聊得停不下來", "哈哈" to "說到好笑的地方"),
    )
    fun pick(act: String, r: Rng): Pair<String, String> = ACT[act]?.let { r.pick(it) } ?: ("" to "")
    fun has(act: String) = ACT.containsKey(act)
}
