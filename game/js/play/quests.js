/* OC Shimeji — quests (Phase 6). Data in OC.PlayData.QUESTS / CHALLENGES; progress from OC.Progress.
 *   daily    4 a day (different tags), refreshed by the real date; finished-but-unclaimed ones stay claimable
 *   weekly   3 a week (ISO week)
 *   place    one per visited place per day (only open places)
 *   event    only while the weather / time condition holds; quietly removed afterwards (no penalty)
 *   hidden   not listed; found by playing, then claimable
 *   challenge long tiers (cumulative), next tier after claiming
 * Rewards go through OC.Tx with the key q:<instance> → a quest can never pay twice (restart, double tap, replay).
 * Nothing requires locked content: every quest's req is checked before it is offered.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, PD = () => OC.PlayData, PR = () => OC.Progress;
  const Q = () => { const p = (S().play = S().play || {}); return (p.q = p.q || { day: '', week: '', list: [], hidden: {}, hprog: {}, chal: {}, n: {} }); };
  const def = (id) => PD().QUESTS.find((q) => q.id === id);
  function weekKey() { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + Math.ceil(((t - y0) / 86400000 + 1) / 7); }
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

  /** can this quest be offered now? (no locked places / items that cannot be obtained / missing OCs) */
  function eligible(q) {
    const r = q.req || {};
    if (r.open && !r.open.every((p) => OC.Places.open(p))) return false;
    if (r.chars && OC.Chars.all().filter((c) => c.status.onIsland).length < r.chars) return false;
    if (r.kinds) { const ok = r.kinds.every((k) => Object.keys(S().inv).some((id) => OC.Style.ITEMS[id] && OC.Style.ITEMS[id].kind === k && OC.Store.count(id) > 0) || Object.keys(OC.Shops.SHOPS).some((sid) => OC.Places.open(OC.Shops.SHOPS[sid].place) && OC.Shops.stock(sid).some((id) => OC.Style.ITEMS[id] && OC.Style.ITEMS[id].kind === k))); if (!ok) return false; }
    if (q.place && !OC.Places.open(q.place)) return false;
    return true;
  }
  function whenOK(q) { const w = q.when; if (!w) return true; const h = OC.Clock.hour(); if (w.wx && ![].concat(w.wx).includes(OC.Clock.weather())) return false; if (w.phase && ![].concat(w.phase).includes(OC.Clock.phase(h))) return false; return true; }
  const inst = (q, period) => ({ key: `${q.id}@${period}`, id: q.id, type: q.type, prog: { n: 0 }, at: Date.now(), period, done: 0, claimed: 0 });

  let sig = '';
  /** keep the list in step with the date, week, visited places, weather and time of day */
  function refresh(force) {
    const s = Q(), day = OC.Clock.dayKey(), week = weekKey(), wx = OC.Clock.weather(), ph = OC.Clock.phase(OC.Clock.hour()), vis = Object.keys(S().places.visited).join();
    const k = [day, week, wx, ph, vis].join('|'); if (k === sig && !force) return; sig = k;
    const keep = (x) => x.done && !x.claimed;      // finished but not yet claimed: always kept
    // daily
    if (s.day !== day) {
      s.list = s.list.filter((x) => x.type !== 'daily' || keep(x));
      const pool = PD().QUESTS.filter((q) => q.type === 'daily' && eligible(q)).map((q) => [hash(day + q.id) / (q.weight || 1), q]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      const pick = [], tags = new Set(); for (const q of pool) { if (pick.length >= 4) break; if (tags.has(q.tag) && pool.length - pick.length > 4) continue; pick.push(q); tags.add(q.tag); }
      for (const q of pool) { if (pick.length >= 4) break; if (!pick.includes(q)) pick.push(q); }
      for (const q of pick) if (!s.list.some((x) => x.key === `${q.id}@${day}`)) s.list.push(inst(q, day));
      // place quests of yesterday that were not done go away (no penalty)
      s.list = s.list.filter((x) => x.type !== 'place' || keep(x) || x.period === day);
      s.day = day;
    }
    // weekly
    if (s.week !== week) {
      s.list = s.list.filter((x) => x.type !== 'weekly' || keep(x));
      const pool = PD().QUESTS.filter((q) => q.type === 'weekly' && eligible(q)).map((q) => [hash(week + q.id), q]).sort((a, b) => a[0] - b[0]).slice(0, 3).map((x) => x[1]);
      for (const q of pool) s.list.push(inst(q, week));
      s.week = week;
    }
    // place quests: one per visited (open) place per day, most recent places first, at most 3
    const visited = Object.entries(S().places.visited).sort((a, b) => b[1] - a[1]).map((x) => OC.Places.top(x[0])).filter((p, i, a) => a.indexOf(p) === i).slice(0, 3);
    for (const p of visited) {
      if (s.list.some((x) => x.type === 'place' && x.period === day && def(x.id) && def(x.id).place === p)) continue;
      const cands = PD().QUESTS.filter((q) => q.type === 'place' && q.place === p && eligible(q)); if (!cands.length) continue;
      const q = cands[Math.floor(hash(day + p) * cands.length)]; s.list.push(inst(q, day));
    }
    // event quests: present only while the condition holds (and only today)
    for (const q of PD().QUESTS.filter((x) => x.type === 'event')) {
      const cur = s.list.find((x) => x.id === q.id && x.period === day), ok = whenOK(q) && eligible(q);
      if (ok && !cur && !s.list.some((x) => x.id === q.id && x.period === day)) s.list.push(inst(q, day));
      if (!ok && cur && !cur.done) s.list = s.list.filter((x) => x !== cur);
    }
    s.list = s.list.filter((x) => !(x.type === 'event' && x.period !== day && !keep(x)));
    // challenges
    for (const c of PD().CHALLENGES) if (!s.chal[c.id]) s.chal[c.id] = { tier: 0, n: 0, claimed: [] };
    St.touch('play', { quests: true });
  }

  /** a progress event arrived */
  function onEvent(d) {
    refresh();
    const s = Q(); let changed = false;
    for (const x of s.list) {
      if (x.done) continue; const q = def(x.id); if (!q) continue;
      if (q.when && !whenOK(q)) continue;
      if (!PR().match(q.goal, d)) continue;
      if (q.goal.day && x.prog.day !== d.dayKey) x.prog = { n: 0, day: d.dayKey };
      if (PR().advance(x.prog, q.goal, d)) { changed = true; if (x.prog.n >= q.goal.n) { x.done = Date.now(); St.emit('play:questDone', { key: x.key, q }); } }
    }
    // hidden quests: tracked silently, revealed when found
    for (const q of PD().QUESTS.filter((y) => y.type === 'hidden')) {
      if (s.hidden[q.id] || !eligible(q) || !PR().match(q.goal, d)) continue;
      const hp = (s.hprog[q.id] = s.hprog[q.id] || { n: 0 }); if (q.goal.day && hp.day !== d.dayKey) { hp.n = 0; hp.set = {}; hp.day = d.dayKey; }
      if (PR().advance(hp, q.goal, d) && hp.n >= q.goal.n) { s.hidden[q.id] = Date.now(); const x = inst(q, 'once'); x.done = Date.now(); x.prog = { n: q.goal.n }; s.list.push(x); St.emit('play:questDone', { key: x.key, q, hidden: true }); changed = true; }
    }
    // challenges (cumulative)
    for (const c of PD().CHALLENGES) { const cs = s.chal[c.id]; if (!cs || cs.tier >= c.tiers.length) continue; if (PR().match(c.goal, d)) { cs.n += Math.max(1, d.count || 1); changed = true; if (cs.n >= c.tiers[cs.tier][0] && !cs.ready) { cs.ready = Date.now(); St.emit('play:questDone', { key: c.id, q: { zh: c.zh + ' ' + roman(cs.tier), type: 'challenge' } }); } } }
    if (changed) St.touch('play', { quests: true });
  }
  const roman = (i) => ['I', 'II', 'III', 'IV', 'V'][i] || String(i + 1);

  /** grant a reward once (coins / items / title) → { ok, why } */
  function grant(key, reward, reason) {
    const r = OC.Tx.run(key, { get: { coins: reward.coins || 0, items: reward.items || {} } }, reason);
    if (!r.ok && !r.dup) return { ok: false, why: r.why[0] };
    if (r.ok && reward.title) OC.Growth.giveTitle(reward.title);
    return { ok: true, dup: !!r.dup, firsts: r.firsts || [] };
  }
  function claim(key) {
    const s = Q(), x = s.list.find((y) => y.key === key);
    if (x) {
      const q = def(x.id); if (!x.done || x.claimed) return { ok: false, why: x.claimed ? '已經領過了' : '還沒完成' };
      const g = grant('q:' + x.key, q.reward, `任務：${q.zh}`); if (!g.ok) return g;
      x.claimed = Date.now(); s.n[q.type] = (s.n[q.type] || 0) + 1; St.touch('play', { claim: key });
      PR().emit('quest', { id: q.id, type: q.type });
      return { ok: true, reward: q.reward, q, dup: g.dup };
    }
    const c = PD().CHALLENGES.find((y) => y.id === key);
    if (c) {
      const cs = s.chal[c.id]; if (!cs || !cs.ready) return { ok: false, why: '還沒完成' };
      const [, reward] = c.tiers[cs.tier]; const g = grant(`chal:${c.id}:${cs.tier}`, reward, `挑戰：${c.zh} ${roman(cs.tier)}`); if (!g.ok) return g;
      cs.claimed.push(cs.tier); cs.tier++; cs.ready = 0;
      if (cs.tier < c.tiers.length && cs.n >= c.tiers[cs.tier][0]) cs.ready = Date.now();
      St.touch('play', { claim: key }); PR().emit('quest', { id: c.id, type: 'challenge' });
      return { ok: true, reward, q: { zh: c.zh, type: 'challenge' }, dup: g.dup };
    }
    return { ok: false, why: '找不到這個任務' };
  }
  /** view model for pages */
  function list(type) {
    refresh(); const s = Q();
    const out = s.list.filter((x) => !type || x.type === type).map((x) => { const q = def(x.id); return q ? { key: x.key, id: q.id, type: q.type, zh: q.zh, d: q.d, ic: q.ic, n: q.goal.n, prog: Math.min(q.goal.n, x.prog.n || 0), done: !!x.done, claimed: !!x.claimed, reward: q.reward, place: q.place, hint: q.hint } : null; }).filter(Boolean);
    return out.sort((a, b) => (a.claimed - b.claimed) || (b.done - a.done));
  }
  function challenges() {
    const s = Q(); refresh();
    return PD().CHALLENGES.map((c) => { const cs = s.chal[c.id] || { tier: 0, n: 0 }; const t = Math.min(cs.tier, c.tiers.length - 1); const [n, reward] = c.tiers[t]; return { key: c.id, zh: `${c.zh} ${roman(t)}`, ic: c.ic, n, prog: Math.min(n, cs.n), done: !!cs.ready, finished: cs.tier >= c.tiers.length, reward, tier: cs.tier, tiers: c.tiers.length }; });
  }
  function hiddenInfo() { const s = Q(), H = PD().QUESTS.filter((q) => q.type === 'hidden'); return { found: H.filter((q) => s.hidden[q.id]).length, total: H.length, hints: H.filter((q) => !s.hidden[q.id] && eligible(q)).map((q) => q.hint) }; }
  const claimable = () => list().filter((x) => x.done && !x.claimed).length + challenges().filter((c) => c.done).length;

  // ---- compatibility with the Phase 2–5 daily quest API (OC.Game.todayQuests / claim / progress) ----
  function legacyToday() { return list('daily').map((x) => ({ id: x.key, zh: x.zh, d: x.d, n: x.n, reward: x.reward.coins || 0, ic: x.ic, prog: x.prog, claimed: x.claimed })); }
  function legacyClaim(id) { const r = claim(id); return r.ok ? (r.reward.coins || 0) || 1 : false; }

  OC.Quests = { refresh, onEvent, claim, list, challenges, hiddenInfo, claimable, eligible, weekKey, legacyToday, legacyClaim, grant };
})();
