/* OC Shimeji — autonomous behaviour engine (Phase 4): Utility AI + activity state machine.
 *
 *   think ──decide()──► go (walk to a reserved slot) ──arrive──► do (aligned, animated, needs change)
 *     ▲                                                              │ until / satisfied / urgent need
 *     └──────────── finish(): release · record · memory · emotion ◄──┘
 *   social: a conversation (see Social below) owns both OCs until it ends
 *   held:   player call / drag / editor / dialogue / event — suspends, then resumes or re-decides
 *
 * Every decision lists candidates with scores and reasons (diagnostics). Objects declare
 * affordances (verbs, use slots, seat height, facing, capacity); slots are reserved so OCs
 * never share a seat or overlap. Movement is real-time (world.js); everything else is game time
 * from OC.Sim, so frame rate never changes results. OCs that are not on screen are simulated
 * abstractly (same scoring, no movement); offline uses the same path with floors and no events.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, Sim = () => OC.Sim, M = () => OC.Mind, D = () => OC.LifeData, Wd = () => OC.World, T = () => OC.Talk;
  const has = (c, t) => c && c.personality.traits.includes(t);
  const k01 = (v) => (v - 50) / 50;
  const nowR = () => performance.now() / 1000;
  let hooks = { say() { return 2; }, emote() {}, hide() {}, notice() {} };
  const brains = {};          // charId → brain
  const res = new Map();      // slot key → charId
  let aff = [], explorePts = [], convs = [], areaId = null, greetT = 0;
  const novel = {};    // affordance id → until (game min): newly placed furniture attracts curious OCs
  const log = [];             // decision log for diagnostics
  function dlog(b, text) { log.unshift({ at: Date.now(), gm: Sim().now(), who: b.id, text }); if (log.length > 80) log.length = 80; }

  // ======================= affordances =======================
  /** rebuild the affordance list from the loaded area: interactables, placed furniture, area spots */
  function rebuild() {
    const W = Wd(); if (!W.area) return; areaId = W.area.id; aff = []; res.clear();
    const ok = (x, y) => W.nearestWalkable(x, y, 16);
    const add = (o) => { o.slots = o.slots.filter((s) => { const p = ok(s.ax, s.ay); if (!p) return false; s.ax = p.x; s.ay = p.y; s.k = o.id + '#' + s.i; s.obj = o; return true; }); if (o.slots.length) aff.push(o); };
    for (const it of W.interacts) {
      const L = it.lvl || 0;
      if (it.type === 'bench') add({ id: 'bench@' + it.x, kind: 'bench', zh: '長椅', x: it.x, y: it.y, lvl: L, verbs: ['sit', 'read', 'nap'], slots: [-9, 9].map((dx, i) => ({ i, x: it.seat.x + dx, y: it.seat.y, ax: it.seat.x + dx, ay: it.at.y, seatY: it.seat.up, fx: 0, back: 0 })) });
      if (it.type === 'home') add({ id: 'home', kind: 'home', zh: '家裡', x: it.x, y: it.y, lvl: L, verbs: ['sleep', 'eat'], slots: [0, 1, 2, 3, 4, 5].map((i) => ({ i, x: it.at.x + (i - 2.5) * 5, y: it.at.y, ax: it.at.x + (i - 2.5) * 5, ay: it.at.y, inside: true, fx: 0, back: 1 })) });
      if (it.type === 'shop' && it.shop && it.shop !== 'general') add({ id: 'shop:' + it.shop + '@' + it.x, kind: 'shop', zh: it.label, x: it.x, y: it.y, lvl: L, verbs: ['browse'], slots: [-14, 14].map((dx, i) => ({ i, x: it.at.x + dx, y: it.at.y, ax: it.at.x + dx, ay: it.at.y, fx: 0, back: 1 })) });
      else if (it.type === 'shop') add({ id: 'stall', kind: 'stall', zh: '雜貨攤', x: it.x, y: it.y, lvl: L, verbs: ['eat', 'drink'], slots: [-14, 14].map((dx, i) => ({ i, x: it.at.x + dx, y: it.at.y, ax: it.at.x + dx, ay: it.at.y, fx: 0, back: 1 })) });
      if (it.type === 'tree') add({ id: it.id, kind: 'tree', zh: it.label, x: it.x, y: it.y, lvl: L, verbs: ['tend', 'read', 'view'], slots: [{ i: 0, x: it.at.x, y: it.at.y, ax: it.at.x, ay: it.at.y, fx: 0, back: 1 }] });
      if (it.type === 'fishing') add({ id: 'fish@' + it.x + ',' + it.y, kind: 'fishing', zh: it.label, x: it.x, y: it.y, lvl: L, verbs: ['fish'], slots: [-10, 10].map((dx, i) => ({ i, x: it.at.x + dx, y: it.at.y, ax: it.at.x + dx, ay: it.at.y, fx: 0, back: it.water === 'pond' ? 1 : 0 })) });
      if (it.type === 'stove') add({ id: 'stove@' + it.x, kind: 'stove', zh: it.label, x: it.x, y: it.y, lvl: L, verbs: ['cook'], slots: [{ i: 0, x: it.at.x, y: it.at.y, ax: it.at.x, ay: it.at.y, fx: 0, back: 1 }] });
      if (it.type === 'plot') add({ id: 'plot:' + it.id, kind: 'plot', plot: it.id, zh: '菜園', x: it.x, y: it.y, lvl: L, verbs: OC.Places.plot(it.id).seed && OC.Places.plot(it.id).growth < 1 && !OC.Places.wet(OC.Places.plot(it.id)) ? ['tend'] : [], slots: [{ i: 0, x: it.at.x, y: it.at.y, ax: it.at.x, ay: it.at.y, fx: 0, back: 1 }] });
      if (it.type === 'forage') add({ id: 'forage:' + it.i, kind: 'forage', zh: it.label, x: it.x, y: it.y, lvl: L, verbs: ['forage'], slots: [{ i: 0, x: it.at.x, y: it.at.y, ax: it.at.x, ay: it.at.y, fx: 0, back: 1 }] });
      if (it.type === 'bookshelf') add({ id: 'shelf@' + it.x, kind: 'bookshelf', zh: '書櫃', x: it.x, y: it.y, lvl: L, verbs: ['read'], slots: [-12, 12].map((dx, i) => ({ i, x: it.at.x + dx, y: it.at.y, ax: it.at.x + dx, ay: it.at.y, fx: 0, back: 1 })) });
      if (it.type === 'towel') add({ id: 'towel@' + it.x, kind: 'towel', zh: '沙灘毛巾', x: it.x, y: it.y, lvl: L, verbs: ['nap', 'rest'], slots: [{ i: 0, x: it.x, y: it.y, ax: it.at.x, ay: it.at.y, seatY: 0.5, fx: 0, back: 0, lie: true }] });
      if (it.type === 'bed') add({ id: it.id, kind: 'flowers', zh: '花圃', x: it.x, y: it.y, lvl: L, verbs: ['tend', 'view'], slots: [-10, 10].map((dx, i) => ({ i, x: it.at.x + dx, y: it.at.y, ax: it.at.x + dx, ay: it.at.y, fx: -dx / 12, back: 1 })) });
    }
    for (const f of W.furn) {
      const def = OC.Style.ITEMS[f.id]; if (!def) continue; const id = 'furn:' + f.uid, zh = def.zh, sc = f.sc || 1;
      if (def.sit && (def.seats || 1) > 1) add({ id, kind: f.id, zh, x: f.x, y: f.y, verbs: ['sit', 'read', 'nap'].concat(def.verbs || []), slots: [-1, 1].map((s2, i) => ({ i, x: f.x + s2 * 10 * sc, y: f.y + 1, ax: f.x + s2 * 10 * sc, ay: f.y + 13 * sc, seatY: f.id === 'swing' ? 8 : 7, fx: 0, back: 0 })) });
      else if (def.sit) add({ id, kind: f.id, zh, x: f.x, y: f.y, verbs: ['sit', 'read', 'nap', 'tidy'], slots: [{ i: 0, x: f.x, y: f.y + 1, ax: f.x, ay: f.y + 12, seatY: f.id === 'chair' ? 9 : 4, fx: 0, back: 0 }] });
      else if (f.id === 'desk') add({ id, kind: 'desk', zh, x: f.x, y: f.y, verbs: ['study', 'read'], slots: [{ i: 0, x: f.x - 2 * sc, y: f.y + 9 * sc, ax: f.x - 2 * sc, ay: f.y + 18 * sc, seatY: 8, fx: 0, back: 1 }] });
      else if (def.verbs && f.id !== 'bed' && f.id !== 'table' && f.id !== 'rug') { const r = Wd().furnRect(f); add({ id, kind: f.id, zh, x: f.x, y: f.y, verbs: def.verbs, slots: (def.verbs.includes('view') && f.id === 'campfire' ? [-1, 1, 0] : [0]).map((s2, i) => ({ i, x: f.x + s2 * 22, y: f.y + r.h / 2 + 8 - (s2 === 0 && f.id === 'campfire' ? 0 : 0), ax: f.x + s2 * 22, ay: f.y + r.h / 2 + 8, fx: f.id === 'campfire' ? -s2 : 0, back: 1 })) }); }
      else if (f.id === 'bed') add({ id, kind: 'bed', zh, x: f.x, y: f.y, verbs: ['sleep', 'nap'], slots: [{ i: 0, x: f.x, y: f.y + 2, ax: f.x + 16, ay: f.y + 6, seatY: 6, fx: 0, back: 0, lie: true }] });
      else if (f.id === 'table') add({ id, kind: 'table', zh, x: f.x, y: f.y, verbs: ['eat', 'drink', 'tidy'], slots: [-1, 1].map((s, i) => ({ i, x: f.x + s * 24, y: f.y + 4, ax: f.x + s * 24, ay: f.y + 4, fx: -s, back: 0 })) });
      else if (f.id === 'plant') add({ id, kind: 'plant', zh, x: f.x, y: f.y, verbs: ['tend'], slots: [{ i: 0, x: f.x, y: f.y + 12, ax: f.x, ay: f.y + 12, fx: 0, back: 1 }] });
      else if (f.id === 'rug') add({ id, kind: 'rug', zh, x: f.x, y: f.y, verbs: ['play', 'tidy'], slots: [-1, 1].map((s, i) => ({ i, x: f.x + s * 9, y: f.y, ax: f.x + s * 9, ay: f.y, fx: -s, back: 0 })) });
      else add({ id, kind: f.id, zh, x: f.x, y: f.y, verbs: ['tidy'], slots: [{ i: 0, x: f.x, y: f.y + 12, ax: f.x, ay: f.y + 12, fx: 0, back: 1 }] });
    }
    for (const sp of W.area.spots || []) {
      const n = sp.n || 2, r = sp.r || 12;
      add({ id: 'spot:' + sp.id, kind: 'spot', zh: sp.zh, x: sp.x, y: sp.y, lvl: sp.lvl || 0, verbs: sp.verbs, slots: Array.from({ length: n }, (_, i) => { const a = n > 2 ? (i / n) * Math.PI * 2 : (i - (n - 1) / 2) * 1.2; const x = sp.x + (n > 2 ? Math.cos(a) * r : (i - (n - 1) / 2) * r * 1.4), y = sp.y + (n > 2 ? Math.sin(a) * r * 0.6 : 0); return { i, x, y, ax: x, ay: y, fx: n > 2 ? (sp.x - x) / r : 0, back: sp.back ? 1 : 0 }; }) });
    }
    // exploration points: a coarse walkable lattice
    explorePts = []; const b = W.area.bounds;
    for (let y = b.y0 + 30; y < b.y1; y += 46) for (let x = b.x0 + 30; x < b.x1; x += 46) if (W.walkable(x, y) && W.walkable(x + 6, y) && W.walkable(x - 6, y)) explorePts.push({ x, y, k: Math.round(x / 46) + ',' + Math.round(y / 46) });
    // keep reservations of OCs that are still using something
    for (const br of Object.values(brains)) if (br.slot) { const s = findSlot(br.slot.k); if (s) { res.set(s.k, br.id); br.slot = s; } else if (br.st === 'do' || br.st === 'go') abort(br, 'gone'); }
  }
  const findSlot = (k) => { for (const o of aff) for (const s of o.slots) if (s.k === k) return s; return null; };
  const free = (s, id) => !res.has(s.k) || res.get(s.k) === id;
  function reserve(s, id) { if (!free(s, id)) return false; release(id); res.set(s.k, id); return true; }
  function release(id) { for (const [k, v] of res) if (v === id) res.delete(k); }
  /** is a standing point clear of other OCs (no overlapping)? */
  function clearPoint(x, y, id, r = 14) { for (const b of Object.values(brains)) { if (b.id === id || !b.a) continue; const end = b.a.path && b.a.path.length ? b.a.path[b.a.path.length - 1] : b.st === 'go' && b.dest ? b.dest : b.a; if (Math.hypot(end.x - x, end.y - y) < r || Math.hypot(b.a.x - x, b.a.y - y) < r * 0.6) return false; } return true; }

  // ======================= brains =======================
  function attach(a, c, o = {}) {
    let b = brains[c.id];
    if (!b) b = brains[c.id] = { id: c.id, st: 'think', act: null, slot: null, last: [], holds: new Set(), thinkAt: nowR() + 0.5 + Math.random() * 2, dbg: { cands: [], reason: '' }, cmdAt: 0, queued: null };
    b.a = a; b.manual = !!o.manual; b.st = b.st === 'social' || b.st === 'event' ? 'think' : b.st; b.thinkAt = nowR() + 0.4 + Math.random() * 1.5;
    a.brain = b; b.lastXY = { x: a.x, y: a.y };
    // resume an activity that was running (reload / coming back from another area)
    const cur = c.life.cur;
    if (cur && (cur.until <= Sim().now() || !D().ACTS[cur.act])) c.life.cur = null;     // stale (finished while away)
    if (cur && cur.until > Sim().now() && D().ACTS[cur.act] && !b.manual) {
      const s = cur.slot && findSlot(cur.slot);
      if (s && free(s, c.id)) { reserve(s, c.id); a.x = s.ax; a.y = s.ay; b.act = cur.act; b.slot = s; b.until = cur.until; b.t0 = cur.t0 || Sim().now(); arrive(b, true); }
      else if (!ACT_NEEDS_SLOT(cur.act)) { b.act = cur.act; b.until = cur.until; b.t0 = cur.t0 || Sim().now(); b.st = 'do'; anim(b); }
    }
    return b;
  }
  const ACT_NEEDS_SLOT = (act) => { const v = D().ACTS[act].verb; return v && v !== 'wander' && v !== 'explore'; };
  function detach(id) { const b = brains[id]; if (!b) return; endConvOf(b); release(id); if (b.a) { b.a.brain = null; b.a.hidden = false; } b.a = null; if (b.st === 'go' || b.st === 'social' || b.st === 'event' || b.st === 'held') b.st = 'think'; }
  function detachAll() { for (const id of Object.keys(brains)) detach(id); }
  const charOf = (b) => OC.Chars.get(b.id);
  /** 12.0 control mode of a character (each one has its own; the default is 'semi'):
   *  manual — only does what you say (it still looks after urgent needs) · semi — lives on its own with the full AI (plans, goals, social) and
   *  yields to you for a while after a command or touch · auto — lives on its own and yields only while you are walking it */
  const ctlOf = (b) => { const c = charOf(b), m = c && c.life && c.life.control; return m === 'manual' || m === 'auto' ? m : 'semi'; };
  const manualMode = (b) => ctlOf(b) === 'manual';
  function setControl(id, mode) {
    const c = OC.Chars.get(id); if (!c || !['manual', 'semi', 'auto'].includes(mode)) return false;
    c.life.control = mode; OC.Chars.save && OC.Chars.save(c);
    const b = brains[id]; if (b) { b.thinkAt = 0; if (mode !== 'manual') b.manualOverride = 0; }
    OC.Store.emit('control', { id, mode }); return true;
  }
  const available = (b) => b && b.a && !b.holds.size && !b.queued && !b.leaving && !(b.byPlayer && (b.st === 'go' || b.st === 'do')) && b.st !== 'social' && !(b.invited && convs.includes(b.invited)) && b.st !== 'event' && !(b.st === 'do' && D().ACTS[b.act] && D().ACTS[b.act].lock) && !(b.slot && b.slot.inside && b.st === 'do');

  // ---------------- scoring ----------------
  const NEED_W = { food: 1.4, sleep: 1.3, energy: 1.0, fun: 0.9, social: 0.9, comfort: 0.6, interest: 0.7, active: 0.7 };
  const def = (v) => Math.max(0, (100 - v) / 100);
  function needScore(c, fx) { let s = 0; const parts = []; for (const [k, g] of Object.entries(fx)) { if (g <= 0 || NEED_W[k] == null) continue; const v = NEED_W[k] * Math.pow(def(c.needs[k]), 1.6) * Math.sqrt(Math.min(1.2, g / 80)); s += v; if (v > 0.05) parts.push(`${k}${v.toFixed(2)}`); } return { s, parts }; }
  function settings() { return S().life.settings; }
  function denied(act) { const st = settings(); if (st.deny.includes(act)) return true; if (st.autonomy === 'restricted' && !['eat', 'drink', 'rest', 'sleep', 'nap', 'stretch', 'daydream'].includes(act)) return true; return false; }
  /** utility for an activity (without target) → { s, why[] } */
  function actScore(c, b, act) {
    const A = D().ACTS[act], why = []; const ns = needScore(c, A.fx); let s = ns.s; if (ns.parts.length) why.push('需求 ' + ns.parts.join(' '));
    const h = OC.Clock.hour(), ph = OC.Clock.phase(h), wx = OC.Clock.weather(), p = c.personality, emo = M().dominant(c);
    const add = (v, r) => { if (!v) return; s += v; why.push(`${r}${v > 0 ? '+' : ''}${v.toFixed(2)}`); };
    const sleepy = M().sleepTime(c, h);
    if (act === 'sleep') { if (sleepy) add(c.needs.sleep < 85 ? 1.1 + (c.needs.sleep < 50 ? 0.6 : 0) : 0.2, '作息'); else add(c.needs.sleep < 15 ? 0.4 : -1.2, '白天'); if (c.needs.food < 25) add(-1.6, '太餓睡不著'); }
    if (act === 'nap') { if (sleepy) add(-0.4, '該睡覺了'); if (has(c, 'lazy') || has(c, 'sleepy')) add(0.15, '個性'); if (c.needs.sleep > 70 && c.needs.energy > 60) add(-0.4, '不睏'); }
    if (act === 'eat') { const meal = (h >= 7 && h < 9) || (h >= 12 && h < 13.5) || (h >= 18 && h < 20); if (meal && c.needs.food < 80) add(0.3, '用餐時間'); if (c.needs.food > 85) add(-0.8, '吃飽了'); if (has(c, 'foodie')) add(0.15, '貪吃'); }
    if (act === 'drink' && has(c, 'foodie')) add(0.12, '貪吃');
    if (sleepy && !['sleep', 'read', 'rest', 'daydream'].includes(act) && !((act === 'eat' || act === 'drink') && c.needs.food < 30)) add(-0.35, '睡覺時間');
    if (sleepy && act === 'read' && has(c, 'bookworm')) add(0.15, '睡前');
    // personality
    const TB = { bookworm: { read: 0.4 }, nature: { tend: 0.3, observe: 0.3 }, curious: { explore: 0.35, observe: 0.12 }, lazy: { rest: 0.25, nap: 0.2, daydream: 0.25, walk: -0.15, play: -0.15, tidy: -0.15 }, diligent: { tidy: 0.2, tend: 0.2, daydream: -0.1 }, tidy: { tidy: 0.4 }, artsy: { daydream: 0.15, observe: 0.15 }, creative: { daydream: 0.15 }, sleepy: { nap: 0.2 }, cheerful: { play: 0.12 }, nightowl: {} };
    for (const t of p.traits) if (TB[t] && TB[t][act]) add(TB[t][act], '特質');
    if (['play', 'walk', 'explore', 'stretch'].includes(act)) add(0.3 * k01(p.energy), '活力');
    if (['read', 'daydream', 'observe'].includes(act)) add(-0.15 * k01(p.energy), '悠哉');
    if (act === 'stretch' && c.quirks.habit === 'stretch') add(0.2, '習慣動作');
    // weather & time
    if (wx === 'rain') { const m = { read: 0.25, observe: -0.2, play: -0.3, walk: -0.25, explore: -0.2, tend: has(c, 'nature') ? 0.1 : -0.1 }; if (m[act]) add(m[act], '下雨'); }
    if (wx === 'fog' && act === 'explore' && has(c, 'curious')) add(0.15, '起霧');
    if (wx === 'clear' && (act === 'walk' || act === 'play')) add(0.1, '晴天');
    if (ph === 'night' && ['play', 'explore', 'tend', 'tidy'].includes(act)) add(has(c, 'nightowl') ? 0.1 : -0.25, '晚上');
    if (ph === 'night' && act === 'observe' && wx !== 'rain') add(has(c, 'nightowl') || has(c, 'curious') ? 0.25 : 0.08, '星空');
    if (ph === 'morning' && act === 'walk' && M().routine(c).early) add(0.15, '早起');
    // emotion
    const EM = { bored: { play: 0.3, explore: 0.3, read: 0.15, daydream: -0.1 }, excited: { play: 0.35, walk: 0.15 }, down: { daydream: 0.15, rest: 0.1, play: -0.15 }, lonely: { daydream: 0.1 }, tired: { rest: 0.3, nap: 0.3, play: -0.3 }, annoyed: { walk: 0.25, stretch: 0.1 }, curious: { explore: 0.35, observe: 0.3, read: 0.1 }, content: { observe: 0.12, read: 0.1 }, nervous: { rest: 0.2, read: 0.1 }, calm: { read: 0.1, observe: 0.1 } };
    const ek = M().intensity(c, emo); if (EM[emo] && EM[emo][act]) add(EM[emo][act] * Math.min(1, ek + 0.3), '情緒');
    // habits, wishes, novelty
    add(M().habitBonus(c, act, null), '習慣');
    if (OC.Growth) add(OC.Growth.actBonus(c, act), '人生目標');
    for (const w of M().activeWishes(c)) { if (w.type === 'stars' && act === 'observe' && ph === 'night') add(0.6, '願望'); if (w.type === 'read_n' && act === 'read') add(0.3, '願望'); if (w.type === 'tend_n' && act === 'tend') add(0.3, '願望'); }
    const rec = b ? b.last.slice(0, 4).filter((x) => x === act).length : 0; if (rec) add(-0.18 * rec - (b.last[0] === act ? 0.3 : 0), '剛做過');
    if (S().life.settings.autonomy === 'lessSocial' && act === 'explore') add(0.05, '');
    return { s, why };
  }
  /** pick the best slot for a verb near the OC; → { slot, s, why } */
  function bestSlot(c, b, verb) {
    const a = b.a; let best = null;
    for (const o of aff) {
      if (!o.verbs.includes(verb)) continue;
      for (const s of o.slots) {
        if (!free(s, c.id)) continue;
        if (!s.inside && (!clearPoint(s.x, s.y, c.id, 10) || !clearPoint(s.ax, s.ay, c.id, 8))) continue;   // someone is standing there
        const d = Math.hypot(s.ax - a.x, s.ay - a.y); if (d > 900) continue;
        let v = -d * 0.0016 + 0.25 * M().placeFeel(c, o.id) + M().habitBonus(c, null, o.id) + (novel[o.id] && novel[o.id] > Sim().now() ? 0.45 : 0) + (o.kind === 'home' && OC.Clock.weather() === 'rain' ? 0.1 : 0) + (o.kind === 'plot' && verb === 'tend' ? 0.8 : 0) + (verb === 'sleep' && o.kind === 'bed' ? 0.12 : 0);
        v += (Sim().rnd() - 0.5) * 0.04;
        if (!best || v > best.s) best = { slot: s, s: v };
      }
    }
    return best;
  }
  function wanderPoint(c, b, far) {
    const a = b.a, R = c.life.rec.visit || (c.life.rec.visit = {}), gm = Sim().now();
    let best = null;
    for (let i = 0; i < 14; i++) {
      let p;
      if (far && explorePts.length) { p = Sim().pick(explorePts); }
      else { const ang = Sim().rnd() * Math.PI * 2, r = 50 + Sim().rnd() * 110; const q = Wd().nearestWalkable(a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.7, 30); if (!q) continue; p = { x: q.x, y: q.y, k: Math.round(q.x / 46) + ',' + Math.round(q.y / 46) }; }
      if (!clearPoint(p.x, p.y, c.id, 18)) continue;
      const seen = R[p.k] ? Math.min(1, (gm - R[p.k]) / 1440) : 1.5;
      const v = (far ? seen : 0) - Math.hypot(p.x - a.x, p.y - a.y) * (far ? 0.0008 : 0.001) + Sim().rnd() * 0.2;
      if (!best || v > best.v) best = Object.assign({ v }, p);
    }
    return best;
  }

  // ---------------- social candidates ----------------
  function socialCands(c, b) {
    const out = []; if (settings().autonomy === 'paused' || manualMode(b)) return out;
    const urg = M().urgent(c); if (urg && urg !== 'social') return out;                // look after yourself first
    const st = settings(), lessSocial = st.autonomy === 'lessSocial' || st.autonomy === 'restricted';
    const base = Math.pow(def(c.needs.social), 1.3) * (0.6 + 0.8 * c.personality.social / 100) + (has(c, 'outgoing') ? 0.2 : 0) + (has(c, 'social') ? 0.15 : 0) - (has(c, 'shy') ? 0.15 : 0);
    for (const o of Object.values(brains)) {
      if (o === b || !available(o)) continue; const oc = charOf(o); if (!oc) continue;
      const d = Math.hypot(o.a.x - b.a.x, o.a.y - b.a.y); if (d > 420) continue;
      const r = M().rel(c.id, oc.id), why = [];
      let s0 = base + r.aff / 100 * 0.4 - r.conflict / 100 * 0.5 - d * 0.0012; if (r.type === 'stranger' && has(c, 'shy')) s0 -= 0.25;
      for (const w of M().activeWishes(c)) { if (w.other === oc.id && w.type === 'chat_with') s0 += 0.5; if (w.other === oc.id && (w.type === 'befriend' || w.type === 'bestfriend')) s0 += 0.2; if (w.type === 'social') s0 += 0.3; }
      if (lessSocial) s0 -= 0.5;
      s0 -= 0.3 * b.last.slice(0, 4).filter((x) => String(x).startsWith('social')).length;   // just talked a lot → do something else
      const lastS = c.life.socialAt && c.life.socialAt[oc.id]; if (lastS && Sim().now() - lastS < 45) s0 -= 0.6;
      const oe = M().dominant(oc), myE = M().dominant(c), p = c.personality;
      const K = (kind, s, r2) => out.push({ kind: 'social', social: kind, other: oc.id, s: s + (Sim().rnd() - 0.5) * 0.08, why: [`社交 ${s0.toFixed(2)}`, r2].filter(Boolean) });
      K('chat', s0, null);
      if (M().sharedInterests(c, oc).length || c.profile.hobbies.length) K('share', s0 - 0.05 + (M().sharedInterests(c, oc).length ? 0.15 : 0), '共同興趣');
      if (r.aff >= 20 && (has(c, 'gentle') || has(c, 'outgoing') || p.expression > 65)) K('compliment', s0 - 0.1, '好感');
      if (['down', 'lonely', 'tired', 'annoyed'].includes(oe) && M().intensity(oc, oe) > 0.3 && (r.aff >= 15 || has(c, 'gentle'))) K('comfort', s0 + 0.45 + (has(c, 'gentle') ? 0.3 : 0), `${oc.profile.name}${D().EMOTIONS[oe].zh}`);
      if (p.expression > 60 || has(c, 'cheerful')) K('joke', s0 - 0.12 + 0.2 * k01(p.expression), '愛開玩笑');
      if (p.expression > 70 && r.fam >= 25 && p.thinking < 45) K('prank', s0 - 0.25, '頑皮');
      if (c.needs.food > 60 && oc.needs.food < 45) K('food', s0 + 0.2, `${oc.profile.name}肚子餓`);
      if (r.aff >= 45 && (!c.life.giftAt || Sim().now() - c.life.giftAt > 1440)) K('gift', s0 + 0.05, '想送禮');
      if (c.needs.energy < 60 && oc.needs.energy < 70 && r.aff >= 10) K('restTogether', s0 + 0.15 * def(c.needs.energy), '一起休息');
      if (c.needs.fun < 60 && c.needs.energy > 40 && OC.Clock.weather() !== 'rain' && OC.Clock.phase() !== 'night') K('playTogether', s0 + 0.3 * def(c.needs.fun), '一起玩');
      if (OC.Clock.phase() === 'night' && OC.Clock.weather() !== 'rain' && r.aff >= 30) K('stargaze', s0 + 0.15, '夜空');
      if (myE === 'annoyed' && M().intensity(c, 'annoyed') > 0.35 && (r.conflict >= 15 || has(c, 'stubborn'))) K('argue', 0.3 + M().intensity(c, 'annoyed') * 0.5 + r.conflict / 200, '煩躁');
      if (OC.Social11) OC.Social11.cands(c, oc, r, s0, K, myE, oe);
      if (r.conflict >= 20 && myE !== 'annoyed' && (has(c, 'gentle') || r.aff >= 20 || r.trust >= 30) && (!c.life.apolAt || Sim().now() - c.life.apolAt > 240)) K('apologize', 0.5 + r.conflict / 120, '想和好');
    }
    return out;
  }
  /** all candidates with scores (sorted) */
  function candidates(b) {
    const c = charOf(b); if (!c || !b.a) return [];
    const out = [], st = settings();
    const manualIdle = manualMode(b) && !(b.manualOverride > nowR());
    const low = ['food', 'sleep', 'energy'].filter((k) => c.needs[k] < 25).sort((x, y) => c.needs[x] - c.needs[y])[0];
    for (const act of Object.keys(D().ACTS)) {
      if (denied(act) || (OC.Growth && !OC.Growth.allowed(charOf(b), act))) continue;
      const A = D().ACTS[act];
      // the played OC only does things in place — unless it badly needs to eat / sleep / rest and you left it alone
      if (manualIdle && !(low && A.fx[low] > 0 && A.cat !== 'fun')) continue;   // manual: only what an urgent need asks for
      const sc = actScore(c, b, act); let target = null, ts = 0;
      if (A.verb === 'wander' || A.verb === 'explore') { const p = wanderPoint(c, b, A.verb === 'explore'); if (!p) continue; target = { pt: p }; }
      else if (A.verb) { const bs = bestSlot(c, b, A.verb); if (!bs) continue; target = { slot: bs.slot }; ts = bs.s; }
      else if (!clearPoint(b.a.x, b.a.y, c.id, 10)) continue;
      out.push({ kind: 'act', act, target, s: sc.s + ts, why: sc.why.concat(ts ? [`地點${ts > 0 ? '+' : ''}${ts.toFixed(2)}`] : []) });
    }
    out.push(...socialCands(c, b));
    out.push(...travelCands(c, b));
    if (b.queued) { const q = out.find((x) => x.kind === 'act' && x.act === b.queued); if (q) { q.s += 5; q.why.unshift('玩家安排'); } }
    return out.sort((x, y) => y.s - x.s);
  }
  /** choose among the top candidates: rational OCs take the best; emotional ones surprise more */
  function choose(c, list) {
    if (!list.length) return null;
    const top = list.slice(0, 4), temp = 0.06 + 0.12 * (1 - c.personality.thinking / 100);
    return Sim().wpick(top, (x) => Math.exp((x.s - top[0].s) / temp));
  }

  // ---------------- lifecycle ----------------
  function decide(b) {
    const c = charOf(b); if (!c) return;
    if (settings().autonomy === 'paused' && !b.queued) { b.thinkAt = nowR() + 2; return; }
    if (b.invited && convs.includes(b.invited)) { b.thinkAt = nowR() + 1; return; }
    if (b.manual && !(b.manualOverride > nowR())) {   // the character you are playing yields to you
      const m = ctlOf(b), walking = b.a.path || b.a.joy, recent = nowR() - b.cmdAt < 40, posed = b.a.mode === 'sit' || b.a.mode === 'talk';
      if (m === 'manual' ? (walking || recent || posed) : m === 'semi' ? (walking || recent) : walking) { b.thinkAt = nowR() + 2; return; }
      if (m !== 'manual' && posed) { b.a.mode = 'idle'; b.a.seatY = 0; release(b.id); OC.World.setAction(b.a, 'idle'); }   // the pose you gave it is over: it gets up on its own
    }
    if (b.resumeTrip) { const L = b.resumeTrip; b.resumeTrip = null; if (OC.Places.open(L.to) && settings().travel !== false) { dlog(b, `繼續前往${OC.Places.get(L.to).zh}`); startTravel(b, L.to, L.act); return; } }
    let list = candidates(b); if (b.queued) list = list.filter((x) => x.kind !== 'travel');   // a player request is done here, not by leaving
    if (OC.Mind11) list = OC.Mind11.shape(c, b, list);                                     // 11.0: plans · goals · knowledge
    b.dbg.cands = list.slice(0, 8).map((x) => ({ id: x.kind === 'act' ? x.act : x.kind === 'travel' ? '→' + OC.Places.get(x.place).zh + ':' + x.act : x.social + '→' + OC.Chars.name(OC.Chars.get(x.other)), s: +x.s.toFixed(3), why: x.why.join('、') }));
    let ch = choose(c, list);
    if (!ch || ch.s < -0.3) { b.thinkAt = nowR() + 2 + Math.random() * 2; b.dbg.reason = '沒有想做的事，發一下呆'; return; }
    b.byPlayer = !!(b.queued && ch.kind === 'act' && ch.act === b.queued); if (b.queued) b.queued = null;
    b.dbg.reason = `${ch.kind === 'act' ? D().ACTS[ch.act].zh : ch.kind === 'travel' ? '去' + OC.Places.get(ch.place).zh + D().ACTS[ch.act].zh : D().SOCIAL[ch.social].zh}（${ch.why.slice(0, 3).join('、')}）`;
    dlog(b, b.dbg.reason);
    if (ch.kind === 'social') { if (!Social.start(b, brains[ch.other], ch.social)) b.thinkAt = nowR() + 1; return; }
    if (ch.kind === 'travel') { startTravel(b, ch.place, ch.act); return; }
    start(b, ch.act, ch.target);
  }
  function durOf(c, act) { const A = D().ACTS[act], p = c.personality; let d = A.dur[0] + Sim().rnd() * (A.dur[1] - A.dur[0]); d *= 1.2 - 0.4 * p.pace / 100; if (has(c, 'lazy') && ['rest', 'nap', 'daydream'].includes(act)) d *= 1.3; return d; }
  function wakeAt(c) { const r = M().routine(c), now = Sim().now(), h = Sim().hourOf(now); let dh = r.wake - h; if (dh <= 0) dh += 24; if (!M().sleepTime(c, h)) dh = Math.min(dh, 3); return now + dh * 60 + (Sim().rnd() - 0.5) * 20; }
  function start(b, act, target) {
    const c = charOf(b), A = D().ACTS[act], a = b.a;
    b.act = act; b.t0 = null; b.slot = null; b.dest = null;
    b.until = null;
    if (target && target.slot) { if (!reserve(target.slot, b.id)) { b.st = 'think'; b.thinkAt = nowR() + 0.5; return false; } b.slot = target.slot; b.dest = { x: target.slot.ax, y: target.slot.ay }; }
    else if (target && target.pt) b.dest = { x: target.pt.x, y: target.pt.y, k: target.pt.k };
    if (b.dest && Math.hypot(a.x - b.dest.x, a.y - b.dest.y) > 4) {
      if (!Wd().walkTo(a, b.dest.x, b.dest.y, () => { if (b.st === 'go') arrive(b); })) { abort(b, '到不了'); return false; }
      b.st = 'go'; b.goT = nowR(); b.stuck = { x: a.x, y: a.y, t: nowR(), n: 0 }; a.run = false;
      if (b.slot && b.slot.inside) a.hidden = false;
    } else arrive(b);
    return true;
  }
  /** aligned at the slot → start the activity */
  function arrive(b, resumed) {
    const c = charOf(b), A = D().ACTS[b.act], a = b.a, s = b.slot;
    if (s) {
      if (s.inside && areaId === 'isle' && settings().travel !== false && OC.Places && OC.Places.open('home')) { b.leaving = { to: 'home', act: b.act }; release(b.id); b.slot = null; depart(b); return; }   // going into the house = going home
      if (s.inside) { a.hidden = true; hooks.hide(a, true); }
      else if (Math.hypot(a.x - s.x, a.y - s.y) > 0.5) { a.path = [{ x: s.x, y: s.y }]; a.onArrive = null; b.aligning = true; }   // short straight move onto the seat (seats sit on blocked cells)
      a.seatY = s.seatY || 0; a.tFace = s.fx || (s.back ? a.tFace * 0.3 : 0.25); a.tBack = s.back ? 1 : 0;
    }
    if (A.verb === 'explore' && b.dest && b.dest.k) (c.life.rec.visit || (c.life.rec.visit = {}))[b.dest.k] = Sim().now();
    if (!resumed) { b.t0 = Sim().now(); b.until = b.act === 'sleep' ? wakeAt(c) : b.t0 + durOf(c, b.act); }
    b.st = 'do'; b.soloAt = nowR() + 4 + Math.random() * 10;
    c.life.cur = { act: b.act, slot: s ? s.k : null, place: s ? s.obj.id : null, placeZh: s ? s.obj.zh : '', until: b.until, t0: b.t0 };
    if (!b.aligning) anim(b); else Wd().setAction(a, 'idle'); St().mark();
    if (!resumed) OC.Events && OC.Events.trigger('actStart', { a: c.id, act: b.act, place: s ? s.obj.id : null, placeZh: s ? s.obj.zh : '' });
    if (s && s.obj.kind === 'plot' && b.act === 'tend' && OC.Places && OC.Places.water(s.obj.plot, c.id) === true) M().remember(c, { type: 'activity', imp: 0.35, place: 'place:isle', text: '幫菜園澆了水', key: 'water:' + s.obj.plot + ':' + Sim().day() });
  }
  function anim(b) {
    const A = D().ACTS[b.act]; if (!A || !b.a) return; let an = A.anim;
    const V = OC.Anim11 && OC.Anim11.VARIED[b.act];                     // 11.0: variety — the same activity is performed in different ways
    if (V) { const pick = V[Math.floor(Math.random() * V.length)]; if (!(pick === 'stargaze' && OC.Clock.phase() !== 'night')) an = pick; }
    if (an && an !== 'idle') Wd().setAction(b.a, an, { priority: A.lock ? 5 : 4 }); else Wd().setAction(b.a, 'idle');
  }
  const St = () => OC.Store;
  /** end the current activity normally (or early) */
  function finish(b, why = 'done') {
    const c = charOf(b), act = b.act, A = D().ACTS[act]; if (!c || !A) { b.st = 'think'; return; }
    const gm = b.t0 != null ? Math.max(0, Sim().now() - b.t0) : 0, s = b.slot;
    if (gm > 0.5 || why === 'done') {
      M().record(c, act, gm, { place: s ? s.obj.id : null, placeZh: s ? s.obj.zh : '', skill: A.sk });
      const sat = Math.min(1, gm / ((A.dur[0] + A.dur[1]) / 2));
      if (sat > 0.5 && ['fun', 'need', 'rest'].includes(A.cat)) M().feel(c, A.cat === 'fun' ? 'happy' : 'content', 0.2 + 0.2 * sat, A.zh);
      if (act === 'explore') M().feel(c, 'curious', 0.3, '探索');
      const first = s && !(c.life.rec.act[act].place[s.obj.id] > 1);
      if (first || gm > 60 || Sim().rnd() < 0.08) M().remember(c, { type: 'activity', imp: first ? 0.45 : 0.3, place: s ? s.obj.id : '', text: `${s ? '在' + s.obj.zh : ''}${A.zh}${first ? '（第一次）' : ''}`, data: { act, gm: Math.round(gm) }, key: first ? `first:${act}:${s.obj.id}` : undefined });
      M().wishEvent(c, { type: 'act', act });
      if (OC.Growth && gm > 0.5) OC.Growth.onFinish(c, act, b, gm);
      if (s && s.obj.kind === 'plot' && act === 'tend' && OC.Places && OC.Places.water(s.obj.plot, c.id) === true) M().remember(c, { type: 'activity', imp: 0.35, place: 'place:isle', text: '幫菜園澆了水', key: 'water:' + s.obj.plot + ':' + Sim().day() });
      if (act === 'sleep') OC.Events && OC.Events.trigger('wake', { a: c.id });
    }
    OC.Events && OC.Events.trigger('actEnd', { a: c.id, act, place: s ? s.obj.id : null, placeZh: s ? s.obj.zh : '' });
    if (OC.Mind11) OC.Mind11.onFinish(b, act, why, gm);
    cleanup(b); b.last.unshift(act); b.last.length = Math.min(b.last.length, 6);
    b.st = 'think'; b.thinkAt = nowR() + (0.6 + 1.6 * (1 - c.personality.pace / 100)) * (0.7 + Math.random() * 0.6);
    dlog(b, `結束 ${A.zh}（${why}，${Math.round(gm)} 分鐘）`);
  }
  function cleanup(b) {
    const a = b.a, s = b.slot; b.byPlayer = false; release(b.id); b.slot = null; b.dest = null; b.aligning = false;
    const c = charOf(b); if (c) c.life.cur = null;
    if (a) {
      if (a.hidden) { a.hidden = false; hooks.hide(a, false); }
      a.seatY = 0; if (a.act && a.act.priority >= 4) { a.act = null; a.key = ''; }
      // step off the seat / spot so the next OC can use it (never stand on a slot you no longer own)
      if (s && !s.inside) {
        let off = Math.hypot(a.x - s.ax, a.y - s.ay) > 1 && clearPoint(s.ax, s.ay, b.id, 12) ? { x: s.ax, y: s.ay } : null;
        for (const [dx, dy] of [[-16, 10], [16, 10], [0, 18], [-22, 0], [22, 0], [0, 28]]) { if (off) break; const q = Wd().nearestWalkable(s.ax + dx, s.ay + dy, 10); if (q && clearPoint(q.x, q.y, b.id, 12)) off = q; }
        if (off) { a.path = [{ x: off.x, y: off.y }]; a.onArrive = null; }
      } else if (s && s.inside) {
        // coming out of the house: the door slots are only 5 px apart, so step out in front onto a free spot
        // (several OCs waking at the same time must not reappear on top of each other)
        let off = null;
        for (const [dx, dy] of [[0, 18], [-16, 16], [16, 16], [-28, 24], [28, 24], [0, 34], [-40, 30], [40, 30]]) { const q = Wd().nearestWalkable(s.ax + dx, s.ay + dy, 10); if (q && clearPoint(q.x, q.y, b.id, 12)) { off = q; break; } }
        if (off) { a.path = [{ x: off.x, y: off.y }]; a.onArrive = null; }
      }
    }
  }
  function abort(b, why) { if (b.st === 'go' && b.a) b.a.path = null; dlog(b, '放棄：' + why); b.leaving = null; cleanup(b); b.act = null; b.st = 'think'; b.thinkAt = nowR() + 1.2; }

  // ---------------- player control / interruptions ----------------
  /** hold (suspend) an OC: reason = call | drag | editor | dialogue | event | player | pet … */
  function hold(id, reason) {
    const b = brains[id]; if (!b) return false;
    if (!b.holds.size) {
      if (b.st === 'social') endConvOf(b, 'interrupted');
      if (b.st === 'do' && b.act && reason !== 'pet') { const A = D().ACTS[b.act]; b.susp = { act: b.act, slot: b.slot ? b.slot.k : null, left: Math.max(0, b.until - Sim().now()), t0: b.t0, resumable: A.cat !== 'body' }; finishPartial(b); }
      else if (b.st === 'go') { const q = b.byPlayer ? b.act : null, L = b.leaving; abort(b, '被打斷'); if (q) b.queued = q; if (L) b.resumeTrip = L; }   // a player request / a trip resumes after the interruption   // a player request resumes after the interruption
      if (reason !== 'pet' && b.a) { b.a.path = null; }
    }
    b.holds.add(reason); b.st = reason === 'event' || b.st === 'event' ? 'event' : 'held'; return true;
  }
  /** record the part already done, release the slot */
  function finishPartial(b) { const c = charOf(b); const gm = b.t0 != null ? Sim().now() - b.t0 : 0; if (c && gm > 1) M().record(c, b.act, gm, { place: b.slot ? b.slot.obj.id : null, placeZh: b.slot ? b.slot.obj.zh : '' }); cleanup(b); }
  function unhold(id, reason) {
    const b = brains[id]; if (!b) return; b.holds.delete(reason); if (b.holds.size) return;
    b.st = 'think'; b.thinkAt = nowR() + 0.8;
    const s = b.susp; b.susp = null;
    if (s && s.resumable && s.left > 3 && b.a && !b.manual) {
      const slot = s.slot && findSlot(s.slot);
      if (!s.slot || (slot && free(slot, b.id))) { b.queued = null; start(b, s.act, slot ? { slot } : null); if (b.st !== 'think') { b.resumeLeft = s.left; dlog(b, '繼續：' + D().ACTS[s.act].zh); } }
    }
  }
  /** player schedules an activity → done next (interrupts unless locked) */
  function command(id, act) {
    const b = brains[id]; if (!b || !D().ACTS[act]) return false;
    b.queued = act; if (b.st === 'do' && D().ACTS[b.act] && D().ACTS[b.act].lock) { dlog(b, '玩家安排（做完手上的事再去）：' + D().ACTS[act].zh); if (b.manual) b.manualOverride = nowR() + 600; return 'later'; }
    if (b.st === 'do' && b.act !== act) finish(b, '玩家安排'); else if (b.st === 'go') abort(b, '玩家安排');
    if (b.st === 'social') endConvOf(b, 'interrupted');
    b.thinkAt = 0; b.cmdAt = b.manual ? 0 : b.cmdAt; if (b.manual) b.manualOverride = nowR() + 120; return true;
  }
  /** the player moved the played OC → abort its own activity */
  function playerAct(id) { const b = brains[id]; if (!b) return; b.cmdAt = nowR(); b.manualOverride = 0; b.queued = null; if (b.st === 'do' || b.st === 'go') { if (b.st === 'do') finish(b, '玩家操作'); else abort(b, '玩家操作'); } if (b.st === 'social') endConvOf(b, 'interrupted'); }

  // ---------------- per step ----------------
  /** needs context for an OC (what it is doing right now) */
  function ctxOf(c) {
    const b = brains[c.id];
    if (b && b.a) { const doing = b.st === 'do' && b.act ? D().ACTS[b.act] : null; return { act: doing ? b.act : null, fx: doing ? doing.fx : (b.a.mode === 'sit' ? D().ACTS.rest.fx : null), sed: doing ? !!doing.sed : (b.a.mode === 'sit'), inside: !!(b.slot && b.slot.inside && b.st === 'do'), repeat: doing && b.last[0] === b.act }; }
    const cur = c.life.cur; const A = cur && D().ACTS[cur.act];
    return { act: A ? cur.act : null, fx: A ? A.fx : null, sed: A ? !!A.sed : true, inside: !!(cur && cur.place === 'home') };
  }
  function stepBrain(b, g) {
    const c = charOf(b), a = b.a; if (!c || !a) return;
    // walking effects per distance (speed independent)
    const dd = Math.hypot(a.x - b.lastXY.x, a.y - b.lastXY.y); b.lastXY = { x: a.x, y: a.y };
    if (dd > 0.01 && dd < 40) { for (const [k, v] of Object.entries(D().WALK_FX)) c.needs[k] = Math.max(0, Math.min(100, c.needs[k] + v * dd)); }
    if (b.holds.size || b.st === 'event' || b.st === 'social' || b.st === 'held') return;
    const t = nowR();
    if (b.st === 'think') { if (t >= b.thinkAt) decide(b); return; }
    if (b.st === 'go') {
      if (!a.path && !b.aligning) { if (b.leaving) { depart(b); return; } if (b.dest && Math.hypot(a.x - b.dest.x, a.y - b.dest.y) < 6) arrive(b); else abort(b, '路被擋住'); return; }
      if (t - b.stuck.t > 3) { const m = Math.hypot(a.x - b.stuck.x, a.y - b.stuck.y); if (m < 3) { b.stuck.n++; if (b.leaving) { depart(b); return; } if (b.stuck.n > 1 || !Wd().walkTo(a, b.dest.x, b.dest.y, () => { if (b.st === 'go') arrive(b); })) { abort(b, '卡住了'); return; } } b.stuck = { x: a.x, y: a.y, t, n: b.stuck.n }; }
      if (t - b.goT > 60) { if (b.leaving) depart(b); else abort(b, '太遠了'); }
      return;
    }
    if (b.st === 'do') {
      if (b.aligning && !a.path) { b.aligning = false; anim(b); }
      if (b.resumeLeft != null) { b.until = Sim().now() + b.resumeLeft; b.resumeLeft = null; c.life.cur && (c.life.cur.until = b.until); }
      const A = D().ACTS[b.act];
      // keep the pose (a higher-priority one-shot may have replaced it)
      if (!a.act && A.anim && A.anim !== 'idle' && !b.aligning) anim(b);
      let done = Sim().now() >= b.until;
      if (!done && A.until && Sim().now() - b.t0 > A.dur[0] * 0.5) done = Object.entries(A.until).every(([k, v]) => c.needs[k] >= v);
      if (!done && b.act === 'sleep') { const h = OC.Clock.hour(); if (!M().sleepTime(c, h) && c.needs.sleep >= 95) done = true; }
      if (!done && !A.lock && !(b.urgentAt > Sim().now() - 30) && Sim().now() - b.t0 > 3) { const u = M().urgent(c); if (u && !(A.fx[u] > 0)) { b.urgentAt = Sim().now(); finish(b, '急需' + u); return; } }
      if (!done && A.lock && b.act === 'sleep' && c.needs.food < 6) done = true;
      if (done) { finish(b); return; }
      // small life signs while doing (thoughts, looking around)
      if (t >= b.soloAt) { b.soloAt = t + 12 + Math.random() * 20; if (OC.Anim11 && OC.Anim11.VARIED[b.act] && !b.aligning) anim(b); if (A.look) a.tFace = (Math.random() - 0.5) * 1.6; if (S().life.settings.bubbles && Math.random() < 0.55) { const ln = T().say('solo_' + b.act, c, null, { act: b.act, placeZh: b.slot && b.slot.obj.zh }) || (Math.random() < 0.4 ? T().say('solo_need', c, null) : null); if (ln) hooks.say(a, ln.text, null, 2.4, { thought: true }); } else if (A.ic) hooks.emote(a, A.ic); }
    }
  }
  /** abstract simulation for OCs without an actor (other area / offline) */
  // ======================= places: leaving · arriving · life elsewhere =======================
  const here = () => (Wd().area ? Wd().area.id : 'isle');
  const placeOK = () => OC.Places && OC.Places.P;
  const placeActs = (pl) => { const p = OC.Places.get(pl); return p && !p.locked ? (p.acts || []) : []; };
  /** activities worth a trip: not available here (or a place the OC loves), minus the distance */
  function travelCands(c, b) {
    if (!placeOK() || settings().travel === false || b.manual || manualMode(b)) return [];   // the character you are playing stays where you are
    const st = settings(); if (st.autonomy === 'paused' || st.autonomy === 'restricted') return [];
    if (M().urgent(c) && M().urgent(c) !== 'social') return [];
    const cur = here(), out = [], local = new Set(); for (const o of aff) if (o.slots.some((s2) => free(s2, c.id))) o.verbs.forEach((v) => local.add(v));
    for (const pl of OC.Places.list()) {
      if (pl === cur || !OC.Places.open(pl)) continue;
      const tm = OC.Places.travelMin(cur, pl), af = OC.Places.affinity(c, pl);
      for (const act of placeActs(pl)) {
        const A = D().ACTS[act]; if (!A || denied(act) || !A.verb || A.verb === 'wander' || A.verb === 'explore' || (OC.Growth && !OC.Growth.allowed(c, act))) continue;
        if (local.has(A.verb) && af < 0.3) continue;
        if (act === 'sleep' && pl !== 'home') continue;
        const sc = actScore(c, b, act), seen = c.life.places && c.life.places[pl];
        const v = sc.s + af - 0.32 - tm / 140 + (seen ? 0 : OC.Chars.has(c, 'curious') ? 0.15 : 0.05);
        out.push({ kind: 'travel', place: pl, act, s: v, why: [`去${OC.Places.get(pl).zh}${A.zh}`].concat(sc.why.slice(0, 2), [`地點偏好${af >= 0 ? '+' : ''}${af.toFixed(2)}`, `路程-${(0.32 + tm / 140).toFixed(2)}`]) });
      }
    }
    return out.sort((x, y) => y.s - x.s).slice(0, 3);
  }
  /** where to walk to leave towards a place */
  function exitPoint(to) {
    const W = Wd(), P0 = OC.Places.get(to), exits = W.interacts.filter((i) => i.type === 'exit' || (i.type === 'home' && to === 'home'));
    const pick = exits.find((i) => i.to === to || (i.type === 'home' && to === 'home')) || exits.find((i) => P0 && i.to === P0.parent) || exits.find((i) => i.to === (OC.Places.get(here()) || {}).parent) || exits.find((i) => i.to === 'map');
    const p = pick ? pick.at : W.area.spawn; return W.nearestWalkable(p.x, p.y, 20) || p;
  }
  /** where an arriving OC appears */
  function entryPoint(from) {
    const W = Wd(), A2 = W.area; if (from && A2.doors && A2.doors[from]) return W.nearestWalkable(A2.doors[from].x, A2.doors[from].y + 10, 20);
    const ex = W.interacts.find((i) => i.type === 'exit' && (i.to === 'map' || A2.interior)); const p = ex ? ex.at : A2.spawn;
    return W.nearestWalkable(p.x + (Math.random() - 0.5) * 16, p.y, 20) || A2.spawn;
  }
  function startTravel(b, place, act) {
    const a = b.a, ex = exitPoint(place); cleanup(b);
    b.leaving = { to: place, act }; b.act = null; b.dest = ex; b.st = 'go'; b.goT = nowR(); b.stuck = { x: a.x, y: a.y, t: nowR(), n: 0 };
    dlog(b, `要去${OC.Places.get(place).zh}${D().ACTS[act].zh}`);
    if (Math.hypot(a.x - ex.x, a.y - ex.y) < 6 || !Wd().walkTo(a, ex.x, ex.y, () => { if (b.leaving) depart(b); })) depart(b);
  }
  /** the OC walked out: it now lives at the destination (abstractly until the player goes there) */
  function depart(b) {
    const c = charOf(b), L = b.leaving; if (!c || !L) return;
    const from = here(), tm = OC.Places.travelMin(from, L.to), now = Sim().now();
    c.life.loc = L.to; c.life.trip = { from, to: L.to, act: L.act, eta: now + tm };
    c.life.cur = { act: L.act, abstract: true, t0: now + tm, until: now + tm + (L.act === 'sleep' ? Math.max(60, wakeAtGm(c, now + tm) - now - tm) : durOf(c, L.act)), place: 'place:' + L.to, placeZh: OC.Places.get(L.to).zh, slot: null };
    c.life.log.unshift({ gm: now, text: `前往${OC.Places.get(L.to).zh}（${D().ACTS[L.act].zh}）` }); if (c.life.log.length > 40) c.life.log.length = 40;
    b.leaving = null; b.st = 'think'; dlog(b, `出發去${OC.Places.get(L.to).zh}`);
    hooks.depart && hooks.depart(b.id);
  }
  /** first time somewhere → memory + emotion (both for visible and abstract arrivals) */
  function noteArrival(c, pl) {
    if (OC.Progress) OC.Progress.emit('arrive', { oc: c.id, place: pl });
    c.life.places = c.life.places || {}; const r = c.life.places[pl] = c.life.places[pl] || { visits: 0, last: 0 }; r.visits++; r.last = Sim().now();
    if (r.visits === 1) { M().remember(c, { type: 'discover', imp: 0.6, place: 'place:' + pl, text: `第一次來到${OC.Places.get(pl).zh}`, key: 'place:first:' + pl + ':' + c.id }); M().feel(c, 'curious', 0.4, '第一次來到' + OC.Places.get(pl).zh); }
  }
  /** an OC arrives where the player is (app spawned its actor at the door) */
  function arrived(id) {
    const c = OC.Chars.get(id), b = brains[id]; if (!c) return; const tr = c.life.trip; c.life.trip = null;
    noteArrival(c, here()); if (b) { b.queued = tr && tr.act ? tr.act : null; b.st = 'think'; b.thinkAt = nowR() + 0.6; }
    const ln = T().say('arrive', c, null, { place: here(), placeZh: OC.Places.get(here()).zh }); if (ln && b && b.a && S().life.settings.bubbles) hooks.say(b.a, ln.text, OC.Chars.name(c), 2.2, {});
    if (OC.Events) OC.Events.trigger('arrive', { a: id, place: here(), placeZh: OC.Places.get(here()).zh });
  }
  /** newly placed furniture attracts curious OCs for a while */
  function noticeNew(affId) {
    novel[affId] = Sim().now() + 180; const o = aff.find((x) => x.id === affId); const item = o ? o.kind : null;
    for (const b of Object.values(brains)) { const c = charOf(b); if (!c || !b.a || b.manual) continue; const k = 0.2 + (OC.Chars.has(c, 'curious') ? 0.25 : 0) + (OC.Chars.has(c, 'tidy') ? 0.15 : 0); M().feel(c, 'curious', k, '新家具'); if (Math.random() < 0.6 && S().life.settings.bubbles) { const ln = T().say('new_furn', c, null, { item }); if (ln) hooks.say(b.a, ln.text, OC.Chars.name(c), 2.4, {}); } if (b.st === 'think') b.thinkAt = nowR() + 0.5; }
  }
  /** abstract simulation for OCs without an actor (other places / offline): same scoring, per place, with travel */
  function abstractStep(c, g, o = {}) {
    const ctx = ctxOf(c); if (o.offline) ctx.offline = true;
    const now = o.at != null ? o.at + g : Sim().now(), loc = c.life.loc || 'isle';
    if (c.life.trip && c.life.trip.eta > now) { M().tick(c, g, { act: null, fx: null, sed: false }); return; }   // on the way
    if (c.life.trip && placeOK()) { if (!o.offline && c.life.trip.to === here()) { M().tick(c, g, { act: null, fx: null, sed: false }); return; } noteArrival(c, c.life.trip.to); c.life.trip = null; }   // arriving where the player is → the app walks it in
    M().tick(c, g, ctx);
    let cur = c.life.cur;
    if (!cur || cur.until <= now) {
      if (cur && D().ACTS[cur.act]) { const dur = Math.max(0, Math.min(now, cur.until) - (cur.t0 || now)); M().record(c, cur.act, dur, { place: cur.place, placeZh: cur.placeZh, skill: D().ACTS[cur.act].sk }); (c.life.offAcc = c.life.offAcc || {})[cur.act] = (c.life.offAcc[cur.act] || 0) + dur; M().wishEvent(c, { type: 'act', act: cur.act }); }
      const fake = { a: { x: 0, y: 0 }, last: c.life.absLast || [], id: c.id };
      const here2 = placeOK() ? placeActs(loc).concat(['stretch', 'daydream']) : Object.keys(D().ACTS);
      let list = here2.filter((x) => D().ACTS[x] && !denied(x) && x !== 'explore' && (!OC.Growth || OC.Growth.allowed(c, x))).map((act) => ({ act, pl: loc, s: actScore(c, fake, act).s }));
      if (placeOK() && !o.offline && settings().travel !== false && !['paused', 'restricted'].includes(settings().autonomy)) for (const pl of OC.Places.list()) { if (pl === loc || !OC.Places.open(pl)) continue; const tm = OC.Places.travelMin(loc, pl), af = OC.Places.affinity(c, pl); for (const act of placeActs(pl)) { if (!D().ACTS[act] || denied(act) || here2.includes(act) && af < 0.3 || (act === 'sleep' && pl !== 'home')) continue; list.push({ act, pl, s: actScore(c, fake, act).s + af - 0.32 - tm / 140 }); } }
      if (placeOK() && settings().travel !== false && M().sleepTime(c) && loc !== 'home' && !here2.includes('sleep') && OC.Places.open('home')) list.push({ act: 'sleep', pl: 'home', s: actScore(c, fake, 'sleep').s });
      list.sort((x, y) => y.s - x.s);
      const ch = choose(c, list); if (!ch) return;
      if (ch.pl !== loc) { const tm = OC.Places.travelMin(loc, ch.pl); c.life.trip = { from: loc, to: ch.pl, act: ch.act, eta: now + tm }; c.life.loc = ch.pl; }
      const t0 = ch.pl !== loc ? now + OC.Places.travelMin(loc, ch.pl) : now, P0 = placeOK() ? OC.Places.get(ch.pl) : null;
      c.life.cur = cur = { act: ch.act, t0, until: t0 + (ch.act === 'sleep' ? Math.max(60, (wakeAtGm(c, t0) - t0)) : durOf(c, ch.act)), place: 'place:' + ch.pl, placeZh: P0 ? P0.zh : '', slot: null, abstract: true };
      c.life.absLast = [ch.act].concat(fake.last).slice(0, 4);
      if (!o.offline) { c.life.log.unshift({ gm: now, text: ch.pl !== loc && P0 ? `前往${P0.zh}（${D().ACTS[ch.act].zh}）` : `${P0 ? '在' + P0.zh : ''}${D().ACTS[ch.act].zh}` }); if (c.life.log.length > 40) c.life.log.length = 40; }
    }
  }
  function wakeAtGm(c, now) { const r = M().routine(c), h = Sim().hourOf(now); let dh = r.wake - h; if (dh <= 0) dh += 24; if (!M().sleepTime(c, h)) dh = Math.min(dh, 3); return now + dh * 60; }

  // ======================= Social choreography =======================
  /* conversation: approach → (greet) → invite/topic → turns (one speaker at a time) → result → part.
   * Each line waits for the previous bubble; both OCs face each other at a comfortable distance. */
  const Social = {
    /** a would like to do `kind` with b */
    start(ba, bb, kind) {
      if (!bb || !available(bb) || !available(ba) && ba.st !== 'think') return false;
      const conv = { id: 'v' + Date.now().toString(36), kind, a: ba, b: bb, st: 'approach', lines: [], i: 0, nextAt: 0, t0: nowR() };
      ba.st = 'social'; ba.conv = conv; convs.push(conv);
      // b pauses where it is (it may still be doing something; it decides when invited)
      bb.invited = conv; if (bb.st === 'go') { abort(bb, '有人找'); }
      if (bb.a && bb.st === 'think') bb.thinkAt = nowR() + 20;
      const spot = Social.besideSpot(ba, bb); if (!spot) { Social.end(conv, 'nospace'); return false; }
      conv.spot = spot;
      if (Math.hypot(ba.a.x - spot.x, ba.a.y - spot.y) > 5) { if (!Wd().walkTo(ba.a, spot.x, spot.y)) { Social.end(conv, 'noway'); return false; } }
      dlog(ba, `去找${OC.Chars.name(charOf(bb))}${D().SOCIAL[kind].zh}`);
      return true;
    },
    besideSpot(ba, bb) {
      const o = bb.a, side = ba.a.x < o.x ? -1 : 1, cands = [[side * 26, 2], [-side * 26, 2], [0, 20], [side * 20, -14]];
      for (const [dx, dy] of cands) { const p = Wd().nearestWalkable(o.x + dx, o.y + dy, 8); if (p && clearPoint(p.x, p.y, ba.id, 12) && Math.hypot(p.x - o.x, p.y - o.y) > 14) return p; }
      return null;
    },
    /** b's answer to an invitation: yes | no | later (+ reason) */
    respond(bb, ba, kind) {
      const c = charOf(bb), o = charOf(ba), r = M().rel(c.id, o.id), emo = M().dominant(c);
      if (bb.st === 'do' && D().ACTS[bb.act] && D().ACTS[bb.act].lock) return { ans: 'no', why: '正在' + D().ACTS[bb.act].zh, busy: true };
      if (bb.holds.size) return { ans: 'no', why: '在忙' };
      const urg = M().urgent(c); if (urg && urg !== 'social' && !(kind === 'food' && urg === 'food') && !(D().SOCIAL[kind].joint === 'rest' && (urg === 'energy'))) return { ans: 'no', why: { food: '肚子太餓', sleep: '太睏了', energy: '太累了', fun: '提不起勁', comfort: '不太舒服' }[urg] || '不太方便', need: true };
      let p = 0.55 + r.aff / 140 - r.conflict / 90 + (c.personality.social - 50) / 160 + (c.needs.social < 40 ? 0.2 : 0) + (OC.Growth && OC.Growth.has(o, 'charm') ? 0.1 : 0);
      if (emo === 'annoyed') p -= 0.35; if (emo === 'down') p -= 0.1; if (emo === 'happy' || emo === 'excited') p += 0.15;
      if (has(c, 'shy') && r.type === 'stranger') p -= 0.2;
      const joint = D().SOCIAL[kind].joint;
      if (joint === 'play' && c.needs.energy < 30) p -= 0.4; if (joint === 'rest' && c.needs.energy > 85) p -= 0.25;
      if (kind === 'apologize') p = 0.45 + r.aff / 120 + r.trust / 200 - (has(c, 'stubborn') ? 0.3 : 0) - (emo === 'annoyed' ? 0.3 : 0) + (has(c, 'gentle') ? 0.25 : 0);
      if (bb.st === 'do' && !joint && kind !== 'apologize') p -= 0.1;
      const roll = Sim().rnd();
      if (roll < p) return { ans: 'yes' };
      if (bb.st === 'do' && roll < p + 0.25) return { ans: 'later', why: '晚一點', busy: true };
      return { ans: 'no', why: emo === 'annoyed' ? '心情不好' : '不想', busy: bb.st === 'do' };
    },
    /** build the script once a is beside b */
    script(conv) {
      const A = charOf(conv.a), B = charOf(conv.b), kind = conv.kind, L = [], r = M().rel(A.id, B.id);
      const say = (who, cat, extra) => L.push({ who, cat, extra });
      const greeted = A.life.socialAt && A.life.socialAt[B.id] && Sim().now() - A.life.socialAt[B.id] < 240;
      if (!greeted) { const fr = r.aff >= 15, ga = !fr ? null : r.aff >= 45 && has(A, 'energetic') ? 'highfive' : (has(A, 'shy') || A.speech && A.speech.style === 'polite') ? 'bow' : 'wave'; say('a', 'greet', ga ? { anim: ga, other: ga === 'highfive' ? 'highfive' : null, dur: ga === 'highfive' ? 1.0 : 1.2 } : null); say('b', 'greet_r', fr ? { anim: ga === 'highfive' ? 'cheer' : ga === 'bow' ? 'bow' : 'wave', dur: 1.2 } : null); }
      // 11.0: it remembers what it has noticed about you (favourite activity / how you looked a moment ago)
      if (OC.Mind11 && ['chat', 'share', 'comfort'].includes(kind) && Sim().rnd() < 0.45) {
        const kn = OC.Mind11.st(A).know[B.id];
        if (kn) {
          if (kind === 'comfort' && kn.mood && Sim().now() - kn.moodAt < 360 && D().EMOTIONS[kn.mood]) say('a', 'know_mood', { vars: { mood: D().EMOTIONS[kn.mood].zh } });
          else { const f = OC.Mind11.favAct(kn); if (f && D().ACTS[f]) say('a', 'know_fav', { vars: { favact: D().ACTS[f].zh } }); }
        }
      }
      const def = D().SOCIAL[kind];
      conv.answer = Social.respond(conv.b, conv.a, kind);
      if (def.joint || kind === 'chat' || kind === 'share') {
        if (def.joint) say('a', 'invite', { act: def.joint });
        if (conv.answer.ans !== 'yes') { say('b', conv.answer.ans === 'later' ? 'later' : 'decline', { busy: conv.answer.busy, act: conv.b.act }); say('a', 'declined'); return L; }
        if (def.joint) { say('b', 'accept'); return L; }
      } else if (conv.answer.ans !== 'yes' && !['comfort', 'apologize', 'argue', 'prank'].includes(kind)) { say('b', 'decline', { busy: conv.answer.busy, act: conv.b.act }); say('a', 'declined'); return L; }
      const deep = (A.personality.social + B.personality.social) / 2 > 55 || r.aff > 40;
      switch (kind) {
        case 'chat': say('a', 'talk'); say('b', 'talk_r'); if (deep) { say('b', 'talk'); say('a', 'talk_r'); } break;
        case 'share': say('a', 'share'); say('b', 'share_r'); break;
        case 'compliment': say('a', 'compliment', r.aff >= 40 ? { anim: 'pat', other: 'patted', dur: 1.6, nudge: 0.4 } : null); say('b', 'compliment_r', { anim: has(B, 'shy') ? 'shy' : 'happy' }); break;
        case 'comfort': say('a', 'comfort', { anim: 'comfort', other: 'comforted', dur: 2.2, nudge: 0.6 }); say('b', 'comfort_r', { anim: 'nod' }); break;
        case 'joke': { say('a', 'joke'); const fun = (B.personality.expression - 30) / 100 + r.aff / 150 + (Sim().rnd() - 0.4) * 0.6; conv.funny = fun > 0.2; say('b', conv.funny ? 'laugh' : 'flat', { anim: conv.funny ? 'laugh' : 'shrug', dur: 1.6 }); break; }
        case 'prank': { say('a', 'prank', { anim: 'jump' }); const ok = r.aff / 100 + (B.personality.expression - 50) / 120 - (has(B, 'sensitive') ? 0.3 : 0) - (has(B, 'stubborn') ? 0.15 : 0) + (Sim().rnd() - 0.5) * 0.5 > 0.15; conv.prankOk = ok; say('b', ok ? 'prank_ok' : 'prank_bad', { anim: ok ? 'laugh' : 'pout', pre: 'startle' }); break; }
        case 'food': say('a', 'food', { anim: 'feedbite', other: 'bitefed', dur: 2.2, nudge: 0.5 }); say('b', 'food_r', { anim: 'yum' }); break;
        case 'gift': say('a', 'gift', { anim: 'bow', dur: 1.2 }); say('b', 'gift_r', { anim: 'receive' }); break;
        case 'argue': say('a', 'argue', { anim: 'argue', other: has(B, 'gentle') ? 'upset' : 'argue', dur: 1.8 }); say('b', 'argue_r', { anim: has(B, 'gentle') ? 'upset' : 'stomp' }); break;
        case 'apologize': say('a', 'apologize', { anim: 'apologize', dur: 1.8 }); say('b', conv.answer.ans === 'yes' ? 'forgive' : 'refuse', { anim: conv.answer.ans === 'yes' ? 'accept' : 'turnaway', dur: 1.6 }); break;
        default: if (OC.Social11) OC.Social11.script(kind, conv, say, A, B, r);
      }
      if (!def.joint) say('a', 'bye', { anim: 'greet' });
      return L;
    },
    update(dt) {
      for (const conv of convs.slice()) {
        const A = conv.a, B = conv.b;
        if (!A.a || !B.a || !charOf(A) || !charOf(B)) { Social.end(conv, 'gone'); continue; }
        if (B.holds.size || (A.holds.size && conv.st !== 'joint')) { Social.end(conv, 'interrupted'); continue; }
        const t = nowR();
        if (conv.st === 'approach') {
          if (t - conv.t0 > 25) { Social.end(conv, 'timeout'); continue; }
          if (!A.a.path) {
            if (Math.hypot(A.a.x - B.a.x, A.a.y - B.a.y) > 40) { const sp = Social.besideSpot(A, B); if (!sp || !Wd().walkTo(A.a, sp.x, sp.y)) { Social.end(conv, 'noway'); } continue; }
            // B stops what it was doing only if it agrees to listen (decided in script)
            conv.lines = Social.script(conv); conv.st = 'talk'; conv.i = 0; conv.nextAt = t + 0.25;
            if (B.st === 'go') abort(B, '聊天');
            if (B.st === 'think' || B.st === 'do' && !(D().ACTS[B.act] || {}).seat) { B.a.path = null; }
            face(A.a, B.a); if (!(B.st === 'do' && (D().ACTS[B.act] || {}).seat)) face(B.a, A.a);
            B.prevSt = B.st; B.st = 'social'; B.conv = conv;
          }
          continue;
        }
        if (conv.st === 'talk') {
          if (t < conv.nextAt) continue;
          if (conv.i >= conv.lines.length) { Social.resolve(conv); continue; }
          const ln = conv.lines[conv.i++], sp = ln.who === 'a' ? A : B, ot = ln.who === 'a' ? B : A;
          const extra = Object.assign({ act: (ln.extra && ln.extra.act) || null }, ln.extra || {});
          const out = T().say(ln.cat, charOf(sp), charOf(ot), extra);
          if (ln.extra && ln.extra.pre) Wd().setAction(sp.a, ln.extra.pre, { dur: 0.6, priority: 3, once: true });
          const adur = (ln.extra && ln.extra.dur) || 1.6;
          if (ln.extra && ln.extra.anim) Wd().setAction(sp.a, ln.extra.anim, { dur: adur, priority: 3 }); else Wd().setAction(sp.a, 'talk', { dur: 1.4, priority: 2 });
          // 11.0 paired gestures: the other one performs the complementary action at the same time, and they step toward each other
          if (ln.extra && ln.extra.other) Wd().setAction(ot.a, ln.extra.other, { dur: adur, priority: 3 });
          { const dir = Math.sign(ot.a.x - sp.a.x) || 1, nd = (ln.extra && ln.extra.nudge) || 0; sp.a.nudgeT = nd * 5 * dir; ot.a.nudgeT = -nd * 5 * dir; sp.a.nudgeUntil = ot.a.nudgeUntil = (nd ? Math.max(sp.a.t, ot.a.t) + adur + 0.2 : 0); }
          const d = out ? hooks.say(sp.a, out.text, OC.Chars.name(charOf(sp)), null, { conv: conv.id }) : 0.4;
          if (out && out.reply && (!conv.lines[conv.i] || conv.lines[conv.i].who === ln.who)) conv.lines.splice(conv.i, 0, { who: ln.who === 'a' ? 'b' : 'a', cat: out.reply });   // data-driven branch
          conv.nextAt = t + Math.max(d + 0.35, (ln.extra && ln.extra.dur) ? ln.extra.dur + 0.25 : 0);
          continue;
        }
        if (conv.st === 'joint') {
          const both = [A, B].concat(conv.more || []);
          if (both.some((x) => x.st !== 'social' || !x.a)) { Social.end(conv, 'broken'); continue; }
          const allThere = both.every((x) => !x.a.path);
          if (allThere && !conv.started) { conv.started = true; conv.until = Sim().now() + conv.dur; for (const x of both) { x.a.seatY = x.slot ? x.slot.seatY || 0 : 0; if (x.slot && x.slot.fx != null) { x.a.tFace = x.slot.fx || 0.2; x.a.tBack = x.slot.back ? 1 : 0; } const an = D().ACTS[conv.joint].anim; if (an && an !== 'idle') Wd().setAction(x.a, an, { priority: 4 }); } conv.chatAt = t + 6; }
          if (!conv.started) { if (t - conv.jt0 > 30) Social.end(conv, 'timeout'); continue; }
          if (conv.started) {
            const ca = charOf(A), cb = charOf(B), fx = D().ACTS[conv.joint].fx;
            if (t > conv.chatAt) { conv.chatAt = t + 14 + Math.random() * 16; const sp = Math.random() < 0.5 ? A : B, ot = sp === A ? B : A; const out = T().say(Math.random() < 0.6 ? 'talk' : 'talk_r', charOf(sp), charOf(ot), { act: conv.joint }); if (out && S().life.settings.bubbles) hooks.say(sp.a, out.text, OC.Chars.name(charOf(sp)), null, { conv: conv.id }); }
            if (Sim().now() >= conv.until) { Social.resolve(conv); continue; }
            if (M().urgent(ca) && !(fx[M().urgent(ca)] > 0)) { Social.resolve(conv, true); continue; }
          }
        }
      }
    },
    /** results of a conversation */
    resolve(conv, early) {
      const A = charOf(conv.a), B = charOf(conv.b), kind = conv.kind, ans = conv.answer || { ans: 'yes' }, def = D().SOCIAL[kind];
      if (def.joint && ans.ans === 'yes' && conv.st === 'talk') { Social.beginJoint(conv); return; }
      const now = Sim().now(); (A.life.socialAt = A.life.socialAt || {})[B.id] = now; (B.life.socialAt = B.life.socialAt || {})[A.id] = now;
      const shared = (text, imp, emo) => { const key = `${conv.id}`; const ma = M().remember(A, { type: kind === 'argue' ? 'conflict' : 'social', imp, who: [B.id], text: text.replace('{other}', OC.Chars.name(B)), key: key + 'a' }); const mb = M().remember(B, { type: kind === 'argue' ? 'conflict' : 'social', imp, who: [A.id], text: text.replace('{other}', OC.Chars.name(A)), key: key + 'b' }); M().rel(A.id, B.id).mems++; M().rel(B.id, A.id).mems++; return [ma, mb]; };
      const gain = (c, d) => { for (const [k, v] of Object.entries(d)) c.needs[k] = Math.max(0, Math.min(100, c.needs[k] + v)); };
      if (ans.ans !== 'yes' && !['comfort', 'apologize', 'argue', 'prank'].includes(kind)) {
        M().feel(A, has(A, 'sensitive') || has(A, 'pessimist') ? 'down' : 'confused', 0.25, `${OC.Chars.name(B)}拒絕了邀請`, B.id);
        M().relChange(A.id, B.id, { aff: -1 }, '被拒絕');
        if (ans.ans === 'later') (A.life.laterWith = A.life.laterWith || {})[B.id] = now;
        gain(A, { social: 4 });
      } else {
        const R = {
          chat: [{ fam: 4, aff: 3, trust: 1 }, { social: 18, fun: 6 }, '和{other}聊天', 0.3, 'happy'],
          share: [{ fam: 4, aff: 4, intim: 2 }, { social: 16, interest: 10 }, '和{other}分享興趣', 0.4, 'happy'],
          compliment: [{ fam: 2, aff: 5 }, { social: 12 }, '被{other}稱讚', 0.45, 'shy'],
          comfort: [{ fam: 3, aff: 6, trust: 6, intim: 2 }, { social: 16 }, '{other}來安慰', 0.55, 'calm'],
          joke: [conv.funny ? { fam: 3, aff: 4 } : { fam: 2, aff: 0 }, { social: 12, fun: conv.funny ? 14 : 2 }, conv.funny ? '和{other}笑成一團' : '對{other}開了冷笑話', 0.3, conv.funny ? 'happy' : 'confused'],
          prank: [conv.prankOk ? { fam: 4, aff: 3 } : { fam: 2, aff: -6, conflict: 14 }, { social: 10, fun: conv.prankOk ? 16 : 0 }, conv.prankOk ? '和{other}玩惡作劇' : '對{other}惡作劇，對方生氣了', conv.prankOk ? 0.35 : 0.55, conv.prankOk ? 'happy' : 'annoyed'],
          food: [{ fam: 3, aff: 5, trust: 3 }, { social: 12, food: 14 }, '和{other}分享點心', 0.45, 'content'],
          gift: [{ fam: 3, aff: 8, trust: 3, intim: 2 }, { social: 12 }, '和{other}交換心意（送了小禮物）', 0.6, 'happy'],
          argue: [{ fam: 2, aff: -8, conflict: 22, trust: -4 }, { social: 2 }, '和{other}吵架了', 0.65, 'annoyed'],
          apologize: [ans.ans === 'yes' ? { conflict: -30, aff: 6, trust: 8 } : { conflict: -6 }, { social: 10 }, ans.ans === 'yes' ? '和{other}和好了' : '向{other}道歉，但對方還沒原諒', ans.ans === 'yes' ? 0.7 : 0.5, ans.ans === 'yes' ? 'content' : 'down'],
          greet: [{ fam: 1 }, { social: 3 }, '', 0, null],
        }[kind] || (OC.Social11 && OC.Social11.fx(kind, conv)) || [{ fam: 2 }, { social: 8 }, '和{other}相處', 0.25, 'happy'];
        const [rd, nd, text, imp, emo] = R;
        M().relPair(A.id, B.id, rd, D().SOCIAL[kind].zh);
        gain(A, nd); gain(B, Object.assign({}, nd, kind === 'food' ? { food: 14 } : {}));
        if (emo) { M().feel(A, kind === 'compliment' ? 'happy' : emo, 0.4, `${D().SOCIAL[kind].zh}・${OC.Chars.name(B)}`, B.id); M().feel(B, emo, 0.45, `${D().SOCIAL[kind].zh}・${OC.Chars.name(A)}`, A.id); }
        if (kind === 'comfort' || kind === 'hug' || kind === 'leanOn' || kind === 'pat') { for (const x of B.life.emo.list) if (!x.need && D().EMOTIONS[x.id].v < 0) x.k *= 0.5; }
        if (kind === 'share') { const sh = M().sharedInterests(A, B); const r = M().rel(A.id, B.id); for (const s of sh) if (!r.shared.includes(s)) r.shared.push(s); const r2 = M().rel(B.id, A.id); for (const s of sh) if (!r2.shared.includes(s)) r2.shared.push(s); }
        if (kind === 'gift') A.life.giftAt = now; if (kind === 'apologize') A.life.apolAt = now;
        if (text) shared(text, imp);
        A.life.rec.social = (A.life.rec.social || 0) + 1; B.life.rec.social = (B.life.rec.social || 0) + 1;
        M().skill(A, 'social', 1.2); M().skill(B, 'social', 0.8);
        M().wishEvent(A, { type: 'social', other: B.id }); M().wishEvent(B, { type: 'social', other: A.id });
        // Phase 6 skill effects: a well-read OC teaches what it read; good hosts make it more fun
        if (OC.Growth && OC.Growth.has(A, 'teach') && ['chat', 'share'].includes(kind)) { M().skill(B, 'reading', 2); M().remember(B, { type: 'social', imp: 0.35, who: [A.id], text: `${OC.Chars.name(A)}教了我書裡讀到的事`, key: conv.id + 'teach' }); }
        if (OC.Progress) OC.Progress.emit('social', { oc: A.id, other: B.id, ocs: [A.id, B.id], kind, place: OC.World.area && OC.World.area.id });
        for (const [x, y] of [[A, B], [B, A]]) { const r = M().rel(x.id, y.id); M().wishEvent(x, { type: 'rel', other: y.id, to: r.type }); }
        if (OC.Mind11 && kind !== 'greet') OC.Mind11.onSocial(A, B, kind, true);
      }
      Social.end(conv, early ? 'urgent' : 'done');
    },
    beginJoint(conv) {
      const def = D().SOCIAL[conv.kind], verb = D().ACTS[def.joint].verb;
      // find an object with two free slots near both
      let best = null;
      for (const o of aff) { if (!o.verbs.includes(verb)) continue; const fr = o.slots.filter((s) => free(s, conv.a.id) || free(s, conv.b.id)); if (fr.length < 2) continue; const d = Math.hypot(o.x - conv.a.a.x, o.y - conv.a.a.y); if (!best || d < best.d) best = { o, fr, d }; }
      if (!best) { Social.end(conv, 'noplace'); return; }
      conv.st = 'joint'; conv.joint = def.joint; conv.dur = def.dur[0] + Sim().rnd() * (def.dur[1] - def.dur[0]); conv.jt0 = nowR();
      [conv.a, conv.b].forEach((x, i) => { const s = best.fr[i]; release(x.id); res.set(s.k, x.id); x.slot = s; x.st = 'social'; Wd().setAction(x.a, 'idle'); Wd().walkTo(x.a, s.ax, s.ay, () => { if (Math.hypot(x.a.x - s.x, x.a.y - s.y) > 0.5) x.a.path = [{ x: s.x, y: s.y }]; }); });
      dlog(conv.a, `和${OC.Chars.name(charOf(conv.b))}一起${D().ACTS[def.joint].zh}（${best.o.zh}）`);
    },
    end(conv, why) {
      convs = convs.filter((x) => x !== conv);
      for (const x of [conv.a, conv.b].concat(conv.more || [])) {
        if (!x) continue; if (x.conv === conv) x.conv = null; if (x.invited === conv) x.invited = null;
        if (x.st === 'social') {
          if (x === conv.b && x.prevSt === 'do' && x.act && conv.st !== 'joint') { x.st = 'do'; if (x.until != null && Sim().now() >= x.until) finish(x, '聊完時間到了'); else anim(x); }
          else { if (conv.st === 'joint') { const c = charOf(x); if (c && conv.started) { c.life.rec.social = (c.life.rec.social || 0) + 1; M().record(c, conv.joint, Sim().now() - (conv.until - conv.dur), { place: x.slot && x.slot.obj.id, placeZh: x.slot && x.slot.obj.zh }); M().wishEvent(c, { type: 'act', act: conv.joint }); } cleanup(x); }
            x.st = 'think'; x.thinkAt = nowR() + 1 + Math.random() * 1.5; if (x.a && x.a.act && x.a.act.priority <= 4) Wd().setAction(x.a, 'idle'); }
        }
        x.prevSt = null;
        if (conv.answer && conv.answer.ans === 'yes' || conv.st === 'joint') { x.last.unshift('social:' + conv.kind); x.last.length = Math.min(x.last.length, 6); }
      }
      if (conv.st === 'joint' && conv.started && why !== 'broken') { const A = charOf(conv.a), B = charOf(conv.b); if (A && B && OC.Progress) OC.Progress.emit('social', { oc: A.id, other: B.id, ocs: [A.id, B.id], kind: conv.kind, joint: conv.joint }); if (A && B && OC.Growth && (OC.Growth.has(A, 'host') || OC.Growth.has(B, 'host'))) { M().needs(A, { fun: 8, mood: 4 }); M().needs(B, { fun: 8, mood: 4 }); } if (A && B) { const def = D().SOCIAL[conv.kind]; M().relPair(A.id, B.id, { fam: 4, aff: 4, intim: 2 }, def.zh); M().remember(A, { type: 'social', imp: 0.5, who: [B.id], text: `和${OC.Chars.name(B)}${def.zh}`, place: conv.a.slot ? conv.a.slot.obj.id : '' }); M().remember(B, { type: 'social', imp: 0.5, who: [A.id], text: `和${OC.Chars.name(A)}${def.zh}` }); A.needs.social = Math.min(100, A.needs.social + 14); B.needs.social = Math.min(100, B.needs.social + 14); M().wishEvent(A, { type: 'social', other: B.id }); M().wishEvent(B, { type: 'social', other: A.id }); if (OC.Events) OC.Events.trigger('jointEnd', { a: A.id, b: B.id, kind: conv.kind }); } }
      dlog(conv.a, `社交結束（${why}）`);
    },
  };
  function endConvOf(b, why = 'interrupted') { for (const c of convs.slice()) if (c.a === b || c.b === b || (c.more || []).includes(b)) Social.end(c, why); }
  function face(a, o) { a.tFace = Math.max(-1, Math.min(1, (o.x - a.x) * 0.08)); if (Math.abs(a.tFace) < 0.3) a.tFace = o.x >= a.x ? 0.4 : -0.4; a.tBack = 0; }

  /** brief greetings when two free OCs pass by each other */
  function passingGreets() {
    const list = Object.values(brains).filter((b) => b.a && !b.holds.size && (b.st === 'go' || b.st === 'think'));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const x = list[i], y = list[j], d = Math.hypot(x.a.x - y.a.x, x.a.y - y.a.y); if (d > 36) continue;
      const cx = charOf(x), cy = charOf(y); const r = M().rel(cx.id, cy.id); const k = 'g' + cy.id;
      cx.life.greetAt = cx.life.greetAt || {}; if (cx.life.greetAt[cy.id] && Sim().now() - cx.life.greetAt[cy.id] < 90) continue;
      cx.life.greetAt[cy.id] = Sim().now(); (cy.life.greetAt = cy.life.greetAt || {})[cx.id] = Sim().now();
      if (r.type === 'stranger' && OC.Events && OC.Events.trigger('meet', { a: cx.id, b: cy.id })) continue;
      if (r.type === 'rival' && Sim().rnd() < 0.6) continue;
      const out = T().say('greet', cx, cy); if (out && S().life.settings.bubbles) { hooks.say(x.a, out.text, OC.Chars.name(cx), 1.8, {}); Wd().setAction(x.a, 'greet', { dur: 1.2, priority: 2, keepMoving: true }); }
      M().relPair(cx.id, cy.id, { fam: 1 }); cx.needs.social = Math.min(100, cx.needs.social + 2); cy.needs.social = Math.min(100, cy.needs.social + 2);
      void k;
    }
  }

  // ======================= the life step (registered on OC.Sim) =======================
  let absAcc = {}, slowT = 0;
  function lifeStep(g, dt) {
    for (const c of OC.Chars.all()) {
      const b = brains[c.id];
      if (b && b.a) { M().tick(c, g, ctxOf(c)); stepBrain(b, g); }
      else if (c.status.onIsland) { absAcc[c.id] = (absAcc[c.id] || 0) + g; if (absAcc[c.id] >= 2) { abstractStep(c, absAcc[c.id]); absAcc[c.id] = 0; } }
      else { M().tick(c, g, { act: null, fx: { comfort: 4, fun: 5, social: 3 }, sed: true, offline: true }); }
    }
    Social.update(dt);
    greetT += dt; if (greetT > 1) { greetT = 0; passingGreets(); }
    slowT += g; if (slowT >= 30) { slowT = 0; for (const c of OC.Chars.all()) { if (Sim().rnd() < 0.18) M().maybeWish(c); if (Sim().rnd() < 0.5) M().checkHabits(c); } }
    St().mark();
  }
  function offlineStep(g, o) { for (const c of OC.Chars.all()) { const b = brains[c.id]; if (b && b.a && b.st === 'do') { M().tick(c, g, Object.assign(ctxOf(c), { offline: true })); if (b.until <= o.at + g) finish(b, '時間到'); continue; } if (c.status.onIsland) abstractStep(c, g, o); else M().tick(c, g, { fx: { comfort: 4, fun: 5, social: 3 }, sed: true, offline: true }); } }
  /** after an absence: summarise, then let visible OCs re-decide where they are */
  function afterOffline(info) {
    if (!info || info.simulated < 30) return;
    for (const c of OC.Chars.all()) {
      const acc = c.life.offAcc || {}; c.life.offAcc = {};
      const top = Object.entries(acc).filter(([, v]) => v > 20).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (top.length) { const text = '你不在的時候：' + top.map(([k, v]) => `${D().ACTS[k].zh}約 ${Math.max(1, Math.round(v / 60))} 小時`).join('、'); M().remember(c, { type: 'activity', imp: 0.3, text, key: 'off:' + info.at }); c.life.log.unshift({ gm: Sim().now(), text }); }
      const b = brains[c.id]; if (b && b.st === 'do' && b.until <= Sim().now()) finish(b, '時間到');
    }
  }

  OC.Brain = {
    init(h) { hooks = Object.assign(hooks, h || {}); Sim().onStep(lifeStep); Sim().onAbstract(offlineStep); Sim().onDay((d) => { for (const c of OC.Chars.all()) M().dayStart(c); if (OC.Mind11) OC.Mind11.onDay(); }); OC.Store.on('life:offline', afterOffline); },
    entryPoint, arrived, noticeNew, ctlOf, manualMode, setControl, startTravel, travelCands, exitPoint, here, rebuild, attach, detach, detachAll, hold, unhold, command, playerAct, candidates, actScore, ctxOf, abstractStep, dlog, charOf, available, finish, abort, start, reserve, release, free, findSlot, bestSlot, clearPoint, face,
    Social, brains, get aff() { return aff; }, get res() { return res; }, get convs() { return convs; }, get log() { return log; }, get explorePts() { return explorePts; },
    get: (id) => brains[id] || null,
  };
})();
