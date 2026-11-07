/* OC Shimeji — one transaction path for every gain / cost (Phase 5).
 * Tx.run(key, { pay: { coins, items: { id: n } }, get: { coins, items } }, reason, meta)
 *   1. idempotency: a key that already succeeded is refused (no double rewards after a restart,
 *      a page switch or a repeated tap); keys are saved with the game
 *   2. validate everything first (enough coins, enough items, no negative / NaN amounts, items exist)
 *   3. apply everything (synchronous → atomic in a single JS turn), append to the ledger, save now
 * Nothing else may change coins or inventory amounts for gameplay; the workshop only registers
 * products (no stock), and the bag can only use / gift / sell through here.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store;
  const KEEP = 800;           // remembered idempotency keys
  const LOG = 300;            // ledger entries kept

  function L() { const s = S(); s.ledger = s.ledger || { seq: 0, keys: {}, log: [] }; return s.ledger; }
  const clean = (o) => Object.entries(o || {}).filter(([, n]) => n);
  function check(op) {
    const why = [], it = OC.Style.ITEMS;
    const num = (n) => typeof n === 'number' && isFinite(n) && n >= 0 && Math.floor(n) === n;
    if (op.pay && op.pay.coins != null && !num(op.pay.coins)) why.push('金額不正確');
    if (op.get && op.get.coins != null && !num(op.get.coins)) why.push('金額不正確');
    for (const [id, n] of clean(op.pay && op.pay.items)) { if (!num(n)) why.push('數量不正確'); else if (!it[id]) why.push('沒有這個物品'); else if (St.count(id) < n) why.push(`${it[id].zh}不夠（需要 ${n}，持有 ${St.count(id)}）`); }
    for (const [id, n] of clean(op.get && op.get.items)) { if (!num(n)) why.push('數量不正確'); else if (!it[id]) why.push('沒有這個物品'); }
    if (op.pay && op.pay.coins && S().coins < op.pay.coins) why.push(`星幣不夠（需要 ${op.pay.coins}，持有 ${S().coins}）`);
    return why;
  }
  /** → { ok: true, entry } | { ok: false, why: [..], dup? } */
  function run(key, op, reason = '', meta = null) {
    const l = L();
    if (key && l.keys[key]) return { ok: false, dup: true, why: ['這個獎勵／交易已經完成過了'] };
    const why = check(op); if (why.length) return { ok: false, why };
    // apply (all validated above; no step can fail now)
    const s = S();
    if (op.pay && op.pay.coins) s.coins -= op.pay.coins;
    for (const [id, n] of clean(op.pay && op.pay.items)) { s.inv[id] -= n; if (s.inv[id] <= 0) delete s.inv[id]; }
    if (op.get && op.get.coins) s.coins += op.get.coins;
    const firsts = [];
    for (const [id, n] of clean(op.get && op.get.items)) { s.inv[id] = (s.inv[id] || 0) + n; if (!s.seen[id]) { s.seen[id] = Date.now(); firsts.push(id); } }
    const entry = { n: ++l.seq, at: Date.now(), key: key || null, reason, pay: op.pay || null, get: op.get || null, meta };
    l.log.unshift(entry); if (l.log.length > LOG) l.log.length = LOG;
    if (key) { l.keys[key] = entry.at; const ks = Object.keys(l.keys); if (ks.length > KEEP) { ks.sort((a, b) => l.keys[a] - l.keys[b]).slice(0, ks.length - KEEP).forEach((k) => delete l.keys[k]); } }
    St.persist();
    if (op.pay && op.pay.coins || op.get && op.get.coins) St.emit('coins', { d: ((op.get && op.get.coins) || 0) - ((op.pay && op.pay.coins) || 0), why: reason });
    for (const [id, n] of clean(op.get && op.get.items)) St.emit('inv', { id, n, why: reason, first: firsts.includes(id) });
    for (const [id, n] of clean(op.pay && op.pay.items)) St.emit('inv', { id, n: -n, why: reason });
    St.emit('tx', entry);
    return { ok: true, entry, firsts };
  }
  const done = (key) => !!L().keys[key];
  /** a key that is unique per action instance (tap) */
  const uid = (p) => `${p}:${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  function check1(op) { return check(op); }

  OC.Tx = { run, done, uid, check: check1, get log() { return L().log; } };
})();
