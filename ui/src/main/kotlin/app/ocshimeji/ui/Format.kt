package app.ocshimeji.ui

/** short Traditional Chinese texts for times and durations */
object Format {
    fun ago(ms: Long, now: Long): String {
        val s = (now - ms) / 1000
        return when {
            s < 60 -> "剛剛"
            s < 3600 -> "${s / 60} 分鐘前"
            s < 86400 -> "${s / 3600} 小時前"
            s < 172800 -> "昨天"
            else -> "${s / 86400} 天前"
        }
    }
    fun played(sec: Long): String = when {
        sec < 60 -> "不到 1 分鐘"
        sec < 3600 -> "${sec / 60} 分鐘"
        else -> "${sec / 3600} 小時 ${sec % 3600 / 60} 分"
    }
}
