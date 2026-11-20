/* OC Shimeji 17.1 — the island's timeline (OC.Chronicle).
 *
 * One list of "what happened": every memory (Mind.remember), every finished activity (Mind.record) and every change of
 * relationship type writes one line here — live or during a simulated absence (OC.Sim.awayRun), with no extra bookkeeping in
 * the systems themselves. It is what the 「你不在的時候」 page, the timeline page and the end-of-day card read.
 *   entry   { id, gm, d, who: [ids], place, k: 'act'|'mem'|'rel', text, w (0..1, how big a deal), away }
 *   days    save.life.chron17.days[day] = [entries] (oldest first), the last 60 days, at most 500 lines a day
 *   favs    save.life.chron17.favs = copies of entries the player long-pressed (at most 200, kept forever)
 *   ends    save.life.chron17.ends[day] = { n, big, away } — written when a day is over
 * The timeline only records; it changes nothing (no coins, items, relationships, progress events).
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, Sim = () => OC.Sim, Ch = () => OC.Chars, D = () => OC.LifeData;
  const KEEP_DAYS = 60, MAX_DAY = 500, MAX_FAV = 200;
  const st = () => { const L = S().life; if (!L.chron17) L.chron17 = { days: {}, favs: [], ends: {}, seq: 0 }; const c = L.chron17; c.days = c.days || {}; c.favs = c.favs || []; c.ends = c.ends || {}; return c; };
  const name = (id) => { const c = Ch().get(id); return c ? Ch().name(c) : ''; };
  const placeZh = (p) => { const id = String(p || '').replace('place:', ''); const P = OC.Places && OC.Places.get(id); return P ? P.zh : (p && !String(p).startsWith('place:') ? p : ''); };

  /** write one line (returns the entry, or null when merged / ignored) */
  function log(e) {
    if (!e || !e.text) return null;
    const C = st(), gm = e.gm != null ? e.gm : Sim().now(), d = Math.floor(gm / 1440), list = C.days[d] || (C.days[d] = []);
    const who = [...new Set((e.who || []).filter(Boolean))];
    /* the same moment remembered by both people: one line with both of them */
    if (e.k === 'mem' && who.length > 1) {
      const pair = who.slice().sort().join('|');
      for (let i = list.length - 1, n = 0; i >= 0 && n < 8; i--, n++) { const x = list[i]; if (x.k === 'mem' && Math.abs(x.gm - gm) <= 3 && x.pair === pair) { x.w = Math.max(x.w, e.w || 0); return null; } }
      e.pair = pair;
    }
    const x = { id: 'h' + (++C.seq).toString(36), gm: Math.round(gm * 10) / 10, d, who, place: e.place || '', k: e.k || 'mem', text: e.text, w: Math.round((e.w || 0) * 100) / 100, away: !!Sim().catching };
    if (e.pair) x.pair = e.pair; if (e.rk) x.rk = e.rk;
    /* keep the day in time order (activities are written when they end, with their start time) */
    let i = list.length; while (i > 0 && list[i - 1].gm > x.gm) i--; list.splice(i, 0, x);
    if (list.length > MAX_DAY) { let lo = -1, lw = 9; for (let j = 0; j < list.length; j++) if (list[j].k === 'act' && list[j].w < lw) { lw = list[j].w; lo = j; } list.splice(lo >= 0 ? lo : 0, 1); }
    prune();
    if (!Sim().catching) OC.Store.emit('chron:add', x);
    return x;
  }
  let pruneT = 0;
  function prune() { if (++pruneT % 50) return; const C = st(), today = Sim().day(); for (const k of Object.keys(C.days)) if (+k < today - KEEP_DAYS) delete C.days[k]; for (const k of Object.keys(C.ends)) if (+k < today - KEEP_DAYS) delete C.ends[k]; }

  /** Mind.remember → a line: 「麻糬：和栗子在星砂海灘出去玩」 */
  function fromMemory(c, m) {
    if (!c || !m || !m.text) return;
    if (/^你不在的時候/.test(m.text)) return;   /* the old one-line summary of an absence: the timeline replaces it */
    const who = [c.id].concat(m.who || []);
    log({ k: 'mem', gm: m.gm, who, place: m.place, text: `${Ch().name(c)}：${m.text.replace(/\{other\}/g, name((m.who || [])[0]))}`, w: Math.min(1, m.imp || 0.3) + (m.type === 'milestone' ? 0.15 : 0) });
  }
  /** Mind.record → a line: 「麻糬在雲朵咖啡館的雙人桌喝飲料（25 分鐘）」 */
  function fromActivity(c, act, dur, o) {
    if (!c || !dur || dur < 6) return;
    const A = D().ACTS[act]; if (!A || act === 'idle') return;
    const pz = o.placeZh || placeZh(o.place), len = dur >= 90 ? `${Math.round(dur / 60 * 10) / 10} 小時` : `${Math.round(dur)} 分鐘`;
    const text = act === 'sleep' ? `${Ch().name(c)}${pz ? '在' + pz : ''}睡了 ${len}` : `${Ch().name(c)}${pz ? '在' + pz : ''}${A.zh}（${len}）`;
    log({ k: 'act', gm: o.t0 != null ? o.t0 : Sim().now() - dur, who: [c.id], place: o.place || '', text, w: act === 'sleep' ? 0.04 : 0.08 });
  }
  /** a relationship type changed (Mind.relChange → life:relType) — both directions arrive; one line per pair */
  function fromRel(e) {
    if (!e || !e.a || !e.b) return;
    const k = [e.a, e.b].sort().join('|') + ':' + e.from + '>' + e.to; if ((st().days[Sim().day()] || []).some((x) => x.rk === k)) return;   /* in the save, not in memory: the same absence twice gives the same lines */
    const T = (OC.Mind && OC.Mind.TYPES) || {}, up = OC.Mind && OC.Mind.RANK ? (OC.Mind.RANK[e.to] || 0) > (OC.Mind.RANK[e.from] || 0) : true;
    log({ k: 'rel', rk: k, who: [e.a, e.b], text: `${name(e.a)}和${name(e.b)}的關係：${T[e.from] || e.from} → ${T[e.to] || e.to}`, w: up ? 0.7 : 0.6 });
  }

  // ---------------------------------------------------------------- reading
  const day = (d) => (st().days[d] || []).slice();
  function range(g0, g1) { const C = st(), out = []; for (let d = Math.floor(g0 / 1440); d <= Math.floor(g1 / 1440); d++) for (const x of C.days[d] || []) if (x.gm >= g0 && x.gm <= g1) out.push(x); return out; }
  const days = () => Object.keys(st().days).map(Number).sort((a, b) => b - a);
  /** the big moments of a span: weighty, different, newest last */
  function highlights(g0, g1, n = 3) {
    const seen = new Set();
    return range(g0, g1).filter((x) => x.k !== 'act' && x.w >= 0.45).sort((a, b) => b.w - a.w || a.gm - b.gm).filter((x) => { const t = x.text.replace(/^[^：]*：/, ''); if (seen.has(t)) return false; seen.add(t); return true; }).slice(0, n);
  }
  /** a day is over (live or while away) */
  function closeDay(d) {
    const C = st(), list = C.days[d] || [];
    C.ends[d] = { n: list.length, big: list.filter((x) => x.k !== 'act' && x.w >= 0.45).length, away: list.some((x) => x.away) };
    return C.ends[d];
  }

  // ---------------------------------------------------------------- favourites
  const isFav = (id) => st().favs.some((x) => x.id === id);
  function fav(x) {
    const C = st(); if (!x || isFav(x.id)) return { ok: false, why: '已經收藏過了' };
    if (C.favs.length >= MAX_FAV) return { ok: false, why: `收藏最多 ${MAX_FAV} 條` };
    C.favs.unshift(Object.assign({}, x, { favAt: Date.now() })); OC.Store.touch('life', { chron: 'fav' }); return { ok: true };
  }
  function unfav(id) { const C = st(); const n = C.favs.length; C.favs = C.favs.filter((x) => x.id !== id); OC.Store.touch('life', { chron: 'fav' }); return C.favs.length < n; }

  function init() {
    OC.Store.on('life:relType', fromRel);
    Sim().onDay((d, from) => { closeDay(from); });
    if (Sim().onAwayDay) Sim().onAwayDay((d, from) => { closeDay(from); });
  }
  OC.Chronicle = { log, fromMemory, fromActivity, fromRel, day, range, days, highlights, closeDay, fav, unfav, isFav, favs: () => st().favs, ends: () => st().ends, st, init, MAX_FAV, KEEP_DAYS };
})();
