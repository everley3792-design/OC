/* OC Shimeji — 15.2 part-time jobs (打工). A character works a shift behind the café counter, the windmill mill or the fair snack stand.
 * The shift is an ordinary activity ('work', only when the player asks: ACTS.work.cmdOnly) — it walks there, works, gets tired, meets people.
 * Pay comes once per character, place and game day, at the end of a shift of 20+ game minutes, through OC.Tx (key job:<oc>:<place>:<day>),
 * read from the one progress stream ('act' events from Mind.record). Offline catch-up sends no progress events, so it never pays. */
(function () {
  'use strict';
  const S = () => OC.Store.s, Sim = () => OC.Sim, M = () => OC.Mind;
  const JOBS = {
    cafe: { zh: '雲朵咖啡館', role: '店員', rate: 6 },
    hill: { zh: '風車磨坊', role: '磨坊幫手', rate: 5 },
    fair: { zh: '遊樂園點心攤', role: '攤位幫手', rate: 5 },
  };
  const placeOfShop = { cafe: 'cafe', mill: 'hill', fair: 'fair' };
  const key = (oc, pl, day) => `job:${oc}:${pl}:${day}`;
  const paidToday = (oc, pl) => !!(S().ledger && S().ledger.keys && S().ledger.keys[key(oc, pl, Sim().day())]);
  /** what one shift pays (skill in social / cooking nudges it) */
  function pay(c, pl, min) { const J = JOBS[pl]; const lv = (M().skillLv(c, 'cook') || 0) * 0.5 + (M().skillLv(c, 'social') || 0) * 0.5; return Math.max(10, Math.round(Math.min(45, min) * J.rate * (1 + Math.min(0.5, lv * 0.05)) / 10) * 10); }
  function onAct(d) {
    if (d.ev !== 'act' || d.act !== 'work' || !JOBS[d.place] || !(d.min >= 20)) return;
    const c = OC.Chars.get(d.oc); if (!c) return;
    const k = key(c.id, d.place, Sim().day()), amount = pay(c, d.place, d.min);
    const r = OC.Tx.run(k, { get: { coins: amount } }, `${OC.Chars.name(c)}在${JOBS[d.place].zh}打工（${d.min} 分鐘）`, { job: d.place });
    if (!r.ok) return;
    M().feel(c, 'proud', 0.35, '打工結束'); M().remember(c, { type: 'activity', imp: 0.45, place: 'place:' + d.place, text: `在${JOBS[d.place].zh}當了一班${JOBS[d.place].role}，賺了 ${amount} 星幣`, key: k });
    OC.UI.toast(`${OC.Chars.name(c)}打工結束：+${amount} 星幣`, 'coin');
    OC.Progress.emit('job', { oc: c.id, place: d.place, coins: amount });
  }
  function init() { if (OC.Progress && OC.Progress.on) OC.Progress.on(onAct); }
  OC.Jobs = { JOBS, placeOfShop, pay, paidToday, key, init };
})();
