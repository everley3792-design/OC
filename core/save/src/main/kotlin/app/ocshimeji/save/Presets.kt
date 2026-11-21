package app.ocshimeji.save

/** characters built into the app. They are offered when a new observation starts; choosing one is optional (plan 3.5). */
object Presets {
    val CINNAMON = LibChar(
        id = "preset.cinnamon", name = "肉桂捲", species = "未知", source = "preset",
        image = "asset:chars/cinnamon/idle.png", footX = 0.5f, footY = 0.985f,
        traits = listOf("好奇", "溫和", "有點黏人"), likes = listOf("甜點", "曬太陽"),
    )
    val ALL = listOf(CINNAMON)
}
