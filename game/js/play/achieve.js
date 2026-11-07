/* OC Shimeji — achievements (Phase 6). Definitions: OC.PlayData.ACH (categories, hidden ones, rewards).
 * Unlocking is automatic from real records (S.ach[id] = time, same field as before — old unlocks stay);
 * the reward is CLAIMED by the player through OC.Tx with the key ach:<id>, so it can never be paid twice
 * (restart, reload, event replay). Old saves that already received the Phase 5 automatic 150 星幣 under
 * that key simply show the achievement as claimed.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, PD = () => OC.PlayData;
  const claimed = () => (S().play.ach = S().play.ach || {});
  let busy = false;
  function check() {
    if (busy) return; busy = true;
    try {
      const a = S().ach;
      for (const x of PD().ACH) {
        if (a[x.id]) continue; let v = 0; try { v = x.v(); } catch (e) { v = 0; }
        if (v >= x.n) { a[x.id] = Date.now(); St.touch('ach', x); St.emit('achUnlocked', x); OC.Progress.emit('achieve', { id: x.id, cat: x.cat }); }
      }
    } finally { busy = false; }
  }
  function claim(id) {
    const x = PD().ACH.find((y) => y.id === id); if (!x) return { ok: false, why: '找不到這個成就' };
    if (!S().ach[id]) return { ok: false, why: '還沒達成' }; if (claimed()[id]) return { ok: false, why: '已經領過了' };
    const g = OC.Quests.grant('ach:' + id, x.reward, `成就：${x.zh}`); if (!g.ok) return g;
    claimed()[id] = Date.now(); St.touch('play', { ach: id }); return { ok: true, reward: x.reward, dup: g.dup, x };
  }
  function list() {
    return PD().ACH.map((x) => { let v = 0; try { v = x.v(); } catch (e) { v = 0; } const got = S().ach[x.id]; return { id: x.id, cat: x.cat, zh: x.zh, d: x.d, n: x.n, v: Math.min(v, x.n), got: got || 0, claimed: claimed()[x.id] || 0, reward: x.reward, hidden: !!x.hidden && !got, hint: x.hint }; });
  }
  const CATS = [['life', '生活'], ['social', '社交'], ['explore', '探索'], ['collect', '收藏'], ['skill', '技能'], ['create', '創作'], ['special', '特別']];
  const claimable = () => PD().ACH.filter((x) => S().ach[x.id] && !claimed()[x.id]).length;
  OC.Achieve = { check, claim, list, CATS, claimable };
})();
