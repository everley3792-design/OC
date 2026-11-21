package app.ocshimeji.save

import app.ocshimeji.sim.chars.CharSpec
import app.ocshimeji.sim.chars.Voice

/** characters built into the app. They are offered when a new observation starts; choosing one is optional (plan 3.5). */
object Presets {
    val CINNAMON = LibChar(
        id = "preset.cinnamon", name = "肉桂捲", species = "未知", source = "preset",
        image = "asset:chars/cinnamon/idle.png", footX = 0.5f, footY = 0.985f,
        traits = listOf("好奇", "溫和", "有點黏人"), likes = listOf("甜點", "曬太陽"), facing = -1,
        spec = CharSpec(name = "肉桂捲", pronoun = "牠", age = 20, species = "未知", height = 90,
            voice = Voice(pitch = 1.25f, speed = 1.05f, timbre = "圓潤", bright = 0.7f), style = "可愛", endings = listOf("喔"),
            axes = listOf(0.4f, 0.4f, 0f, 0.2f, 0.5f), traits = listOf("好奇", "溫和", "有點黏人"), values = listOf("家人"),
            likes = listOf("甜點", "曬太陽"), tastes = mapOf("甜" to 1), season = "春", hobbies = listOf("看窗外"), dream = "找到自己是從哪裡來的",
            attitude = "親近", skills = mapOf("聊天" to 4, "料理" to 3, "園藝" to 3), tint = "#E8A86B", motion = "可愛", petSpot = "頭",
            story = "某天出現在窗台上，沒有人知道牠從哪裡來。", tags = listOf("未知生物")),
    )
    val ALL = listOf(CINNAMON)
}
