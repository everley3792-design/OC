package app.ocshimeji.core.sim

import app.ocshimeji.core.model.CharacterId
import app.ocshimeji.core.model.Need
import app.ocshimeji.core.model.Needs
import app.ocshimeji.core.model.OcCharacter
import app.ocshimeji.core.model.Trait
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class LifeSimTest {
    private fun mochi(needs: Needs = Needs()) = OcCharacter(CharacterId("mochi"), "麻糬", needs = needs, isPlayerOc = true)

    @Test fun hungryCharacterChoosesToEat() {
        val sim = LifeSim(listOf(mochi(Needs().with(Need.FULLNESS, 0.05f))))
        assertEquals("eat_snack", sim.choose(sim.character("mochi")!!).id)
    }

    @Test fun tiredCharacterNaps() {
        val sim = LifeSim(listOf(mochi(Needs().with(Need.ENERGY, 0.02f))))
        assertEquals("nap", sim.choose(sim.character("mochi")!!).id)
    }

    @Test fun traitsBiasChoices() {
        val dreamy = mochi().copy(traits = listOf(Trait("dreamy", "愛做白日夢", mapOf("daydream" to 1f))))
        val sim = LifeSim(listOf(dreamy))
        assertEquals("daydream", sim.choose(sim.character("mochi")!!).id)
    }

    @Test fun deterministicForSameSeed() {
        val a = LifeSim(listOf(mochi()), seed = 7); val b = LifeSim(listOf(mochi()), seed = 7)
        a.tick(600); b.tick(600)
        assertEquals(a.character("mochi"), b.character("mochi"))
    }

    @Test fun needsStayInRangeOverAWeek() {
        val sim = LifeSim(listOf(mochi(), OcCharacter(CharacterId("kuri"), "栗子")))
        sim.tick(7 * 24 * 60)
        for (id in listOf("mochi", "kuri")) for (n in Need.entries) assertTrue(sim.character(id)!!.needs[n] in 0f..1f)
        assertEquals(8, sim.clock.day)
    }

    @Test fun usingAnItemRaisesNeed() {
        val sim = LifeSim(listOf(mochi(Needs().with(Need.FULLNESS, 0.42f))))
        sim.useItem("mochi", "cake", mapOf(Need.FULLNESS to 0.18f))
        assertEquals(0.60f, sim.character("mochi")!!.needs[Need.FULLNESS], 0.001f)
    }
}
