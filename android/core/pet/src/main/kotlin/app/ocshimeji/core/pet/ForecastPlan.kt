package app.ocshimeji.core.pet

/**
 * 17.1 — the rules for the island forecast the game hands over when it goes to the background (pure Kotlin, unit-tested).
 * The game decides WHAT happens (a dry run of its own simulation); this only decides what is still worth scheduling and
 * which line the home-screen widget shows at a given moment. It never invents anything.
 */
object ForecastPlan {
    data class Item(val id: String, val at: Long, val title: String, val text: String)
    data class Line(val at: Long, val text: String)

    /** notifications still ahead (a missed one is dropped, never shown late), earliest first, at most [cap] */
    fun upcoming(items: List<Item>, now: Long, cap: Int = 12): List<Item> =
        items.filter { it.at > now }.sortedBy { it.at }.distinctBy { it.id }.take(cap.coerceAtLeast(0))

    /**
     * the widget's line at [now]: the newest forecast line at or before now — but only when it is newer than what the game
     * itself last wrote ([writtenAt]); a forecast older than 24 hours is not shown
     */
    fun lineAt(lines: List<Line>, now: Long, writtenAt: Long): String? {
        val l = lines.filter { it.at <= now }.maxByOrNull { it.at } ?: return null
        if (l.at <= writtenAt || now - l.at > 24 * 3600_000L) return null
        return l.text
    }

    /** when the widget's line changes next (to refresh it then), or null */
    fun nextChange(lines: List<Line>, now: Long): Long? {
        var cur = lineText(lines, now)
        for (l in lines.filter { it.at > now }.sortedBy { it.at }) { if (l.text != cur) return l.at; cur = l.text }
        return null
    }
    private fun lineText(lines: List<Line>, now: Long) = lines.filter { it.at <= now }.maxByOrNull { it.at }?.text
}
