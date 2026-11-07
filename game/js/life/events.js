/* OC Shimeji — dynamic life events (Phase 4).
 * Lifecycle: trigger → conditions (when / c / bc / chance) → priority & exclusivity → cool-down /
 * once-only check → staging (hold the cast, walk to marks) → steps (say / anim / emote / camera /
 * sound / choice / fx) → results (relationships, emotions, needs, memories, flags, wishes) → end.
 * One event at a time, a global gap between events (setting "fewer events" widens it), never while
 * the player is in a dialogue / editor / placement, never during offline catch-up, never repeated
 * (cool-downs and once-keys are saved). Important changes (e.g. becoming lovers) only happen after
 * the player confirms. Events can use the OC's own animations (any action key; missing ones fall
 * back through OC.Chars.ACTIONS chains) — see docs/event-rules.md.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, Sim = () => OC.Sim, M = () => OC.Mind, D = () => OC.LifeData, B = () => OC.Brain, T = () => OC.Talk, Wd = () => OC.World;
  let hooks = { say() { return 2; }, emote() {}, notice() {}, cam() {}, choice(p, o, cb) { cb(0); }, confirm() {}, sound() {}, busy() { return false; } };
  let cur = null, tickT = 0, diag = [];
  const nowR = () => performance.now() / 1000;
  const E = () => S().life.ev;
  const GAP = { full: 120, lessSocial: 120, fewerEvents: 480, restricted: 480, paused: Infinity };

  function defs() { return D().EVENTS.concat((S().life.dlg.events || []).filter((e) => !e.disabled)); }
  const chars = () => OC.Chars;
  function visible(id) { const b = B().get(id); return b && b.a ? b : null; }
  function onceKey(ev, a, b, extra) { if (!ev.once) return null; if (ev.once === 'global') return ev.id; if (ev.once === 'self+place') return `${ev.id}|${a}|${extra}`; const pair = [a, b].filter(Boolean).sort().join('|'); return `${ev.id}|${ev.once === 'pair' ? pair : ev.once === 'pairDays' ? pair + '|' + extra : a}`; }
  function daysKnown(a, b) { const r = M().relPeek(a, b); return r && r.since != null ? Sim().day() - r.since : -1; }

  /** do the conditions of `ev` hold for cast (a, b) with trigger payload p? why[] gets failure reasons */
  function check(ev, A, Bc, p, why) {
    const w = ev.when || {};
    if (w.phase && ![].concat(w.phase).includes(OC.Clock.phase(OC.Clock.hour()))) { why.push('時段'); return false; }
    if (w.wx && ![].concat(w.wx).includes(OC.Clock.weather())) { why.push('天氣'); return false; }
    if (w.to && p.to !== w.to) { why.push('關係'); return false; }
    if (w.act && p.act !== w.act) { why.push('活動'); return false; }
    if (w.place && ![].concat(w.place).includes(p.place || (OC.World.area && OC.World.area.id))) { why.push('地點'); return false; }
    if (ev.c && !T().test(ev.c, T().ctx(A, Bc), why)) return false;
    if (ev.b) {
      if (!Bc) { why.push('沒有對象'); return false; }
      const bc = Object.assign({}, ev.bc || {}); const days = bc.days; delete bc.days;
      if (days && !T().cmp(daysKnown(A.id, Bc.id), days)) { why.push('紀念日'); return false; }
      if (!T().test(bc, T().ctx(A, Bc), why)) return false;
    }
    const gm = Sim().now(), lk = ev.id + '|' + A.id;
    if (ev.cd && E().last[lk] && gm - E().last[lk] < ev.cd) { why.push('冷卻中'); return false; }
    const ok = onceKey(ev, A.id, Bc && Bc.id, ev.once === 'self+place' ? p.place : Bc ? daysKnown(A.id, Bc.id) : ''); if (ok && E().once[ok]) { why.push('已發生過'); return false; }
    return true;
  }
  function gapOK(ev) { const g = GAP[S().life.settings.autonomy] || 120; if ((ev.prio || 1) >= 4) return S().life.settings.autonomy !== 'paused'; return Date.now() - (E().lastAny || 0) > g * 1000; }

  /** a trigger happened. Returns true if an event started (or was applied silently) */
  function trigger(type, p = {}) {
    if (!S() || Sim().catching) return false;
    const evs = defs().filter((e) => e.trigger === type).sort((x, y) => (y.prio || 1) - (x.prio || 1));
    for (const ev of evs) {
      const A = chars().get(p.a); if (!A) continue;
      let cands = [];
      if (ev.b) { const bs = p.b ? [chars().get(p.b)] : chars().all().filter((c) => c.id !== A.id && c.status.onIsland); for (const Bc of bs) if (Bc) cands.push(Bc); }
      else cands = [null];
      for (const Bc of cands) {
        const why = []; if (!check(ev, A, Bc, p, why)) continue;
        if (ev.chance != null && Sim().rnd() > ev.chance) { mark(ev, A, Bc, p); continue; }
        return begin(ev, A, Bc, p);
      }
    }
    return false;
  }
  function mark(ev, A, Bc, p) { const gm = Sim().now(); E().last[ev.id + '|' + A.id] = gm; const ok = onceKey(ev, A.id, Bc && Bc.id, ev.once === 'self+place' ? (p && p.place) : Bc ? daysKnown(A.id, Bc.id) : ''); if (ok) E().once[ok] = gm; }
  /** start an event: staged if the cast is on screen and nothing else runs; otherwise apply its results quietly (milestones must not be lost) */
  function begin(ev, A, Bc, p) {
    const ba = visible(A.id), bb = Bc ? visible(Bc.id) : null;
    const canStage = !cur && ba && (!Bc || bb) && !hooks.busy() && gapOK(ev) && B().available(ba) !== false && (!bb || !bb.holds.size) && !ba.holds.size;
    if (!canStage) {
      if ((ev.prio || 1) >= 4 || ev.trigger === 'relUp' || ev.trigger === 'meet') { mark(ev, A, Bc, p); results(ev, A, Bc, p, false); return true; }
      return false;
    }
    mark(ev, A, Bc, p); E().lastAny = Date.now();
    if (ev.social) { const ok = B().Social.start(ba, bb, ev.social); if (ok) { applyFx(ev, A, Bc, p, { skipMem: true }); logEv(ev, A, Bc, '社交'); } return ok; }
    cur = { ev, A, Bc, p, i: 0, waitUntil: 0, watched: false, cast: { a: ba, b: bb }, t0: nowR() };
    B().hold(A.id, 'event'); if (Bc) B().hold(Bc.id, 'event');
    if (ev.watch || ev.important) hooks.notice({ text: fmt(ev.ask || `${chars().name(A)}：${ev.zh}`, A, Bc, p), watch: () => { if (cur && cur.ev === ev) { cur.watched = true; hooks.cam(ba.a, true); } } });
    St().emit('life:event', { id: ev.id, a: A.id, b: Bc && Bc.id, state: 'start' });
    return true;
  }
  const St = () => OC.Store;
  function fmt(t, A, Bc, p) { return String(t).replace(/\{name\}/g, chars().name(A)).replace(/\{other\}/g, Bc ? chars().name(Bc) : '').replace(/\{days\}/g, Bc ? daysKnown(A.id, Bc.id) : '').replace(/\{place\}/g, (p && p.placeZh) || '這裡'); }

  /** advance the running event (called every frame with real dt) */
  function update(dt) {
    tickT += dt;
    if (tickT > 4) { tickT = 0; periodic(); }
    if (!cur) return;
    const t = nowR(), c = cur;
    if (t - c.t0 > 90) { end('timeout'); return; }
    if (t < c.waitUntil || c.pending) return;
    const st = c.ev.steps[c.i++]; if (!st) { finish(); return; }
    const who = (r) => (r === 'a' ? c.cast.a : r === 'b' ? c.cast.b : null);
    const chr = (r) => (r === 'a' ? c.A : r === 'b' ? c.Bc : null);
    const [kind, x, y, z] = st;
    switch (kind) {
      case 'go': { const m = who(x); if (!m) break; const tgt = y === 'player' ? OC.App && OC.App.player : who(y) && who(y).a; if (!tgt || tgt === m.a) break; const side = m.a.x < tgt.x ? -1 : 1; let pnt = null; for (const [dx, dy] of [[side * 26, 2], [-side * 26, 2], [0, 20], [side * 20, -14]]) { const q = Wd().nearestWalkable(tgt.x + dx, tgt.y + dy, 12); if (q && B().clearPoint(q.x, q.y, m.id, 12)) { pnt = q; break; } } if (pnt && Math.hypot(m.a.x - pnt.x, m.a.y - pnt.y) > 6 && Wd().walkTo(m.a, pnt.x, pnt.y)) { c.pending = true; const w = () => { if (!cur || cur !== c) return; if (!m.a.path || nowR() - c.t0 > 40) { c.pending = false; } else setTimeout(w, 200); }; setTimeout(w, 200); } break; }
      case 'face': { const m = who(x); const tgt = y === 'player' ? OC.App && OC.App.player : who(y) && who(y).a; if (m && tgt) B().face(m.a, tgt); c.waitUntil = t + 0.2; break; }
      case 'say': { const m = who(x); if (!m) break; const out = T().say(y, chr(x), y.startsWith('ev_') && x === 'a' ? (c.Bc || null) : chr(x === 'a' ? 'b' : 'a'), { days: c.Bc ? daysKnown(c.A.id, c.Bc.id) : null, placeZh: c.p.placeZh || (OC.Places.get(OC.World.area.id) || {}).zh, place: c.p.place || OC.World.area.id, act: c.p.act }); Wd().setAction(m.a, 'talk', { dur: 1.2, priority: 6 }); const d = out ? hooks.say(m.a, out.text, chars().name(chr(x)), null, { event: true }) : 0.3; c.waitUntil = t + d + 0.3; break; }
      case 'anim': { const m = who(x); if (m) Wd().setAction(m.a, y, { dur: z || 1.2, priority: 6 }); c.waitUntil = t + (z || 1.2); break; }
      case 'emote': { const m = who(x); if (m) hooks.emote(m.a, y); c.waitUntil = t + 0.7; break; }
      case 'wait': c.waitUntil = t + (x || 1); break;
      case 'cam': if (c.watched || c.ev.important) { const m = who(x); if (m && c.watched) hooks.cam(m.a, true); } break;
      case 'sound': hooks.sound(x); break;
      case 'choice': { const opts = y || []; if (!opts.length) break; if (c.watched) { c.pending = true; hooks.choice(fmt(x, c.A, c.Bc, c.p), opts.map((o) => fmt(o.label, c.A, c.Bc, c.p)), (i) => { c.pending = false; const o = opts[i] || opts[0]; c.choice = i; if (o.fx) applyFx({ fx: o.fx }, c.A, c.Bc, c.p); if (o.say) c.ev.steps.splice(c.i, 0, ['say', o.say[0], o.say[1]]); }); } else { const o = opts[0]; c.choice = 0; if (o.fx) applyFx({ fx: o.fx }, c.A, c.Bc, c.p); } break; }
      case 'fx': applyFx({ fx: x }, c.A, c.Bc, c.p); break;
    }
  }
  function finish() { const c = cur; results(c.ev, c.A, c.Bc, c.p, true); end('done'); }
  function end(why) {
    const c = cur; if (!c) return; cur = null;
    B().unhold(c.A.id, 'event'); if (c.Bc) B().unhold(c.Bc.id, 'event');
    hooks.cam(null, false);
    logEv(c.ev, c.A, c.Bc, why);
    St().emit('life:event', { id: c.ev.id, a: c.A.id, b: c.Bc && c.Bc.id, state: why });
  }
  function logEv(ev, A, Bc, why) { E().log.unshift({ at: Date.now(), gm: Sim().now(), id: ev.id, zh: ev.zh, a: A.id, b: Bc ? Bc.id : null, why }); if (E().log.length > 60) E().log.length = 60; }
  /** apply results; memories get a key so they can never be written twice */
  function results(ev, A, Bc, p, staged) {
    applyFx(ev, A, Bc, p);
    if (ev.confirm && Bc) { const n = { id: 'n' + Date.now().toString(36), kind: 'confirm', ev: ev.id, a: A.id, b: Bc.id, title: fmt(ev.confirm.title, A, Bc, p), body: ev.confirm.body, ok: ev.confirm.ok, at: Date.now() }; S().life.notices.push(n); St().touch('life', { notice: n.id }); hooks.notice({ text: n.title, confirm: n }); }
    if (!staged) logEv(ev, A, Bc, '背景完成');
  }
  function applyFx(ev, A, Bc, p, o = {}) {
    const fx = ev.fx || {}; const who = { a: A, b: Bc };
    if (fx.rel && Bc) { if (fx.rel.ab) M().relChange(A.id, Bc.id, fx.rel.ab, ev.zh); if (fx.rel.ba) M().relChange(Bc.id, A.id, fx.rel.ba, ev.zh); }
    if (fx.emo) for (const [r, [id, k]] of Object.entries(fx.emo)) if (who[r]) M().feel(who[r], id, k, ev.zh || '事件', r === 'a' && Bc ? Bc.id : r === 'b' ? A.id : null);
    if (fx.need) for (const [r, d] of Object.entries(fx.need)) if (who[r]) M().needs(who[r], d, ev.zh);
    if (fx.mem && !o.skipMem) for (const [r, m] of Object.entries(fx.mem)) {
      const list = r === 'both' ? [[A, Bc], [Bc, A]] : [[who[r], r === 'a' ? Bc : A]];
      for (const [x, y] of list) if (x) M().remember(x, { type: m.type || 'event', imp: m.imp || 0.5, who: y ? [y.id] : [], place: (p && p.place) || '', text: fmt(m.text, x, y, p).replace('{days}', y ? daysKnown(x.id, y.id) : ''), data: { ev: ev.id, lines: null }, key: `ev:${ev.id}:${x.id}:${y ? y.id : ''}:${ev.once ? '' : Math.floor(Sim().now() / 60)}` });
    }
    if (fx.flag) S().life.flags[fx.flag] = Sim().now();
    if (fx.wish) for (const [r] of Object.entries(fx.wish)) if (who[r]) M().maybeWish(who[r], true);
    if (fx.item) { const day = Sim().day(); E().items = E().items || {}; if (E().items[day] !== true) { E().items = { [day]: true }; St().add(fx.item, 1, 'event'); hooks.notice({ text: `收到了${(OC.Style.ITEMS[fx.item] || { zh: fx.item }).zh}！`, info: true }); } }
  }
  /** periodic 'tick' events for visible OCs (one candidate check every few seconds) */
  function periodic() {
    if (cur || hooks.busy() || Sim().catching) return;
    diag = [];
    const vis = Object.values(B().brains).filter((b) => b.a && B().available(b));
    const evs = defs().filter((e) => e.trigger === 'tick');
    for (const b of vis.sort(() => Sim().rnd() - 0.5)) {
      const A = chars().get(b.id);
      for (const ev of evs) {
        const bs = ev.b ? chars().all().filter((c) => c.id !== A.id && visible(c.id) && B().available(visible(c.id))) : [null];
        for (const Bc of bs) { const why = []; const ok = check(ev, A, Bc, {}, why) && gapOK(ev); diag.push({ id: ev.id, a: A.id, b: Bc && Bc.id, ok, why: why.join('、') || (ok ? '' : '間隔') }); if (ok) { if (ev.chance != null && Sim().rnd() > ev.chance * 0.25) continue; if (begin(ev, A, Bc, {})) return; } }
      }
    }
  }
  /** the player answered a confirmation notice */
  function decide(nid, yes) {
    const L = S().life, n = L.notices.find((x) => x.id === nid); if (!n) return;
    L.notices = L.notices.filter((x) => x !== n);
    const A = chars().get(n.a), Bc = chars().get(n.b);
    if (yes && A && Bc && n.ok && n.ok.relType) { M().setRelType(A.id, Bc.id, n.ok.relType); M().feel(A, 'excited', 0.7, '關係變化'); M().feel(Bc, 'excited', 0.7, '關係變化'); M().remember(A, { type: 'milestone', imp: 1, who: [Bc.id], text: `和${chars().name(Bc)}成為了${M().TYPES[n.ok.relType]}`, key: 'rel:' + n.id + 'a' }); M().remember(Bc, { type: 'milestone', imp: 1, who: [A.id], text: `和${chars().name(A)}成為了${M().TYPES[n.ok.relType]}`, key: 'rel:' + n.id + 'b' }); }
    St().touch('life', { notice: nid, yes });
  }

  OC.Events = {
    init(h) { hooks = Object.assign(hooks, h || {}); St().on('life:relUp', (e) => trigger('relUp', e)); St().on('life:weather', (e) => { for (const b of Object.values(B().brains)) if (b.a) trigger('wxChange', { a: b.id, wx: e.wx }); }); Sim().onDay(() => { for (const c of chars().all()) trigger('dayStart', { a: c.id }); }); },
    trigger, update, decide, check, defs, end, get current() { return cur; }, get diag() { return diag; },
  };
})();
