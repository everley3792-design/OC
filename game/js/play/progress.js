/* OC Shimeji — one progress event bus (Phase 6).
 * Every gameplay action reports ONE event here (eat, fish, visit, act, social, discover…). Quests, character
 * requests, aspirations, challenges and achievements all listen to the same stream, so no system needs its own
 * timers or duplicate checks.  OC.Progress.emit(ev, data) → enrich (item kind / rarity / flavour, place, time,
 * weather) → tallies → listeners.  Offline catch-up never emits (no rewards from offline time).
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, I = () => OC.Style.ITEMS;
  const P = () => (S().play = S().play || {});
  const listeners = [];
  let log = [], achT = 0;

  /** add context so goals can filter on it */
  function enrich(ev, d) {
    const out = Object.assign({}, d || {});
    if (out.place == null && OC.World && OC.World.area) out.place = OC.World.area.id;
    const h = OC.Clock.hour(); out.hour = out.hour != null ? out.hour : h; out.phase = out.phase || OC.Clock.phase(h); out.wx = out.wx || OC.Clock.weather();
    out.day = OC.Sim ? OC.Sim.day() : 0; out.dayKey = OC.Clock.dayKey();
    const it = out.item && I()[out.item];
    if (it) { out.kind = out.kind || it.kind; out.rarity = out.rarity != null ? out.rarity : it.rarity || 1; out.temp = out.temp || it.temp || null; out.flavor = it.flavor || null; out.tags = it.tags || []; }
    out.ev = ev; return out;
  }
  const num = (v, expr) => (OC.Talk && OC.Talk.cmp ? OC.Talk.cmp(v, expr) : v === expr);
  /** does an event match a goal? ctx.oc = the OC that owns the goal (for 'self') */
  function match(goal, d, ctx = {}) {
    if (!goal) return false;
    if (![].concat(goal.ev).includes(d.ev)) return false;
    for (const [k, v0] of Object.entries(goal.w || {})) {
      const v = v0 === 'self' ? ctx.oc : v0;
      if (k === 'oc') { if (!(d.oc === v || (d.ocs && d.ocs.includes(v)))) return false; continue; }
      if (k === 'other') { if (!(d.other === v || (d.ocs && d.ocs.includes(v) && d.ocs.some((x) => x !== v && (x === ctx.oc || ctx.oc == null))))) return false; continue; }
      if (k === 'near') { if (!(d.near || []).includes(v)) return false; continue; }
      if (k === 'flavor') { if (!(d.flavor && [].concat(v).some((f) => d.flavor[f] > 0))) return false; continue; }
      if (k === 'tag') { if (!(d.tags || []).some((t) => [].concat(v).includes(t))) return false; continue; }
      const x = d[k];
      if (Array.isArray(v)) { if (!v.includes(x)) return false; continue; }
      if (typeof v === 'string' && /^(>=|<=|>|<)/.test(v)) { if (typeof x !== 'number' || !num(x, v)) return false; continue; }
      if (x !== v) return false;
    }
    return true;
  }
  /** advance a goal state { n, set } with an event; returns true when it changed */
  function advance(st, goal, d) {
    if (goal.distinct) { const k = d[goal.distinct]; if (k == null) return false; st.set = st.set || {}; if (st.set[k]) return false; st.set[k] = 1; st.n = Object.keys(st.set).length; return true; }
    st.n = (st.n || 0) + Math.max(1, d.count || 1); return true;
  }

  // ---------------- tallies (achievements ask for counts; registered the first time they are asked) ----------------
  const tkey = (ev, f) => ev + (f ? JSON.stringify(f) : '');
  function count(ev, f) { const T = (P().tally = P().tally || {}), k = tkey(ev, f); if (!(k in T)) T[k] = 0; return T[k]; }
  function distinct(ev, field, f) { const D = (P().sets = P().sets || {}), k = tkey(ev, f) + '#' + field; if (!(k in D)) D[k] = {}; return Object.keys(D[k]).length; }
  function bumpTallies(d) {
    const T = (P().tally = P().tally || {}), D = (P().sets = P().sets || {});
    for (const k of Object.keys(T)) { const [ev, f] = split(k); if (ev === d.ev && (!f || match({ ev, w: f }, d))) T[k] += Math.max(1, d.count || 1); }
    for (const k of Object.keys(D)) { const [head, field] = k.split('#'); const [ev, f] = split(head); if (ev === d.ev && (!f || match({ ev, w: f }, d)) && d[field] != null) D[k][d[field]] = 1; }
  }
  const cache = {};
  function split(k) { if (cache[k]) return cache[k]; const i = k.indexOf('{'); const r = i < 0 ? [k, null] : [k.slice(0, i), JSON.parse(k.slice(i))]; cache[k] = r; return r; }
  /** collection helpers used by achievements */
  const discovered = () => Object.keys(S().seen).filter((id) => I()[id] && !I()[id].custom).length;
  const tastedAll = () => { const s = new Set(); for (const c of OC.Chars.all()) for (const id of Object.keys(OC.Taste.prefs(c).tasted || {})) s.add(id); return s.size; };

  // ---------------- emit ----------------
  let muted = 0;
  function emit(ev, data) {
    if (muted || (OC.Sim && OC.Sim.catching)) return null;
    const d = enrich(ev, data);
    log.unshift({ t: Date.now(), ev, d: Object.fromEntries(Object.entries(d).filter(([k]) => ['oc', 'ocs', 'item', 'place', 'act', 'count', 'lv', 'stars', 'shop', 'skill', 'type', 'first', 'by', 'other', 'to'].includes(k))) }); if (log.length > 60) log.length = 60;
    bumpTallies(d);
    for (const f of listeners) { try { f(d); } catch (e) { console.error('[progress]', ev, e); } }
    clearTimeout(achT); achT = setTimeout(() => OC.Achieve && OC.Achieve.check(), 30);
    OC.Store.touch('play', { ev });
    return d;
  }
  function on(f) { listeners.push(f); }
  /** run fn without emitting (replays, previews) */
  function quiet(fn) { muted++; try { return fn(); } finally { muted--; } }

  // ---------------- bridges from existing engine events ----------------
  function wire() {
    const St = OC.Store;
    St.on('inv', (e) => { if (e && e.first && e.n > 0) emit('discover', { item: e.id }); });
    St.on('life:skillUp', (e) => emit('skillUp', { oc: e.id, skill: e.skill, lv: e.lv }));
    St.on('life:relUp', (e) => emit('rel', { oc: e.a, other: e.b, ocs: [e.a, e.b], to: e.to }));
    St.on('life:event', (e) => { if (e && e.state === 'done') { emit('event', { id: e.id, oc: e.a, other: e.b }); const E = (P().events = P().events || {}); if (!E[e.id]) E[e.id] = Date.now(); } });
  }

  OC.Progress = { emit, on, match, advance, enrich, count, distinct, discovered, tastedAll, quiet, wire, get log() { return log; } };
})();
