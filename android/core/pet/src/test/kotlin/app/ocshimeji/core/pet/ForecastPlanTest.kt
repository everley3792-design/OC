package app.ocshimeji.core.pet

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ForecastPlanTest {
    private val H = 3600_000L
    @Test fun upcomingDropsPastAndCaps() {
        val items = listOf(ForecastPlan.Item("a", 5 * H, "t", "late"), ForecastPlan.Item("b", 1 * H, "t", "past"), ForecastPlan.Item("c", 3 * H, "t", "soon"), ForecastPlan.Item("c", 3 * H, "t", "dup"))
        val u = ForecastPlan.upcoming(items, now = 2 * H)
        assertEquals(listOf("c", "a"), u.map { it.id })
        assertEquals(1, ForecastPlan.upcoming(items, 2 * H, cap = 1).size)
        assertEquals(0, ForecastPlan.upcoming(items, 2 * H, cap = -3).size)
    }
    @Test fun widgetLineOnlyWhenNewerThanTheGame() {
        val lines = listOf(ForecastPlan.Line(10 * H, "在家睡覺"), ForecastPlan.Line(11 * H, "在咖啡館吃飯"), ForecastPlan.Line(12 * H, "在海灘散步"))
        assertEquals("在咖啡館吃飯", ForecastPlan.lineAt(lines, now = 11 * H + 5, writtenAt = 10 * H + 30))
        assertNull(ForecastPlan.lineAt(lines, now = 11 * H + 5, writtenAt = 11 * H + 60))   // the game wrote after it: the game's own line wins
        assertNull(ForecastPlan.lineAt(lines, now = 9 * H, writtenAt = 0))                  // nothing yet
        assertNull(ForecastPlan.lineAt(lines, now = 12 * H + 25 * H, writtenAt = 0))       // too old
    }
    @Test fun nextChangeSkipsSameText() {
        val lines = listOf(ForecastPlan.Line(10 * H, "睡覺"), ForecastPlan.Line(11 * H, "睡覺"), ForecastPlan.Line(12 * H, "吃飯"))
        assertEquals(12 * H, ForecastPlan.nextChange(lines, 10 * H + 1))
        assertNull(ForecastPlan.nextChange(lines, 12 * H + 1))
    }
}
