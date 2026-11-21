package app.ocshimeji.sim.life

import app.ocshimeji.sim.town.Goods
import app.ocshimeji.sim.town.Tx

/**
 * Star coins and things (plan I-01): the one way money and items move. Every change is a ledger line, so the wallet always equals
 * the sum of the ledger and every item count equals the sum of its lines (`consistent()`, checked by the tests). No paid currency.
 */
class Economy(val life: Life) {
    val wallet get() = life.wallet
    fun count(item: String) = life.bag[item] ?: 0
    private fun line(amount: Int, reason: String, who: String, item: String, qty: Int) {
        life.ledger += Tx(life.minute, amount, reason, who, item, qty)
        life.wallet += amount
        if (item.isNotEmpty() && qty != 0) { val n = count(item) + qty; if (n == 0) life.bag.remove(item) else life.bag[item] = n }
    }
    /** money in (goals, sales, the first coins) */
    fun earn(amount: Int, reason: String, who: String = "") { require(amount > 0); line(amount, reason, who, "", 0) }
    /** money out for something (null = not enough coins, nothing changes) */
    fun buy(item: String, qty: Int, price: Int, reason: String, who: String = ""): Boolean {
        if (price * qty > life.wallet || qty <= 0) return false
        line(-price * qty, reason, who, item, qty); return true
    }
    /** money out with nothing in return in the bag (a coffee, materials for a commission) */
    fun spend(amount: Int, reason: String, who: String = ""): Boolean { if (amount > life.wallet || amount <= 0) return false; line(-amount, reason, who, "", 0); return true }
    /** things in or out without money (eaten, placed, put away, made, put on the stall) */
    fun move(item: String, qty: Int, reason: String, who: String = ""): Boolean { if (qty == 0) return true; if (count(item) + qty < 0) return false; line(0, reason, who, item, qty); return true }
    /** a sale: money in, the thing already left the bag when it went on the stall */
    fun sale(item: String, price: Int, reason: String) { line(price, reason, "", item, 0) }
    /** the wallet and the bag agree with the ledger */
    fun consistent(): Boolean {
        if (life.ledger.sumOf { it.amount } != life.wallet || life.wallet < 0) return false
        val sums = HashMap<String, Int>(); for (t in life.ledger) if (t.item.isNotEmpty() && t.qty != 0) sums[t.item] = (sums[t.item] ?: 0) + t.qty
        return sums.filterValues { it != 0 } == life.bag.filterValues { it != 0 } && life.bag.values.all { it > 0 }
    }
    companion object {
        const val START = 300
        /** a readable name for anything in the bag */
        fun nameOf(life: Life, item: String): String = Goods.ALL[item]?.zh ?: life.items.firstOrNull { "item:" + it.id == item }?.name ?: LifeSim.FOOD_ZH[item] ?: item
    }
}
