/* OC Shimeji 16.4 — OC.Queue rewritten after the Sims' action queue (principles only).
 * Every entry is a real request with its target: "rest on THIS bench", "read at the library", "chat with 栗子", "walk here".
 *   add(id, spec, o)   spec = 'act' | { kind: 'act'|'social'|'go', act, slot, pt, place, other, social, label, ic }
 *                      o.now → put it first and interrupt what it is doing for you · o.loop → do it again and again
 *                      → 'now' | 'queued' | false (unknown / full) | 'young' (the character cannot do it at this age)
 *   list(id)           [{ k, act, zh, ic, kind, state: 'doing'|'going'|'next'|'waiting'|'refused'|'waitfor', i, prog, why, loop }]
 *   cancel(id, i) · cancelKey(id, k) · move(id, from, to) · now(id, i) · loop(id, i, on) · force(id, i) · clear(id)
 * Up to 8 waiting. The life engine still does the work (Brain.command with a preferred slot, Brain.goPlace for another place,
 * Will.ask for people) — nothing is bypassed. A request it does not want to do (it is not hungry, it is the middle of the day for
 * stargazing) is refused WITH the reason; 「強迫」 makes it go ahead (a small bad mood afterwards). A request for someone busy waits
 * for them a while. Stored on the character (c.life.q16) so it survives a reload. Old q15 lists are carried over.
 */
(function () {
  'use strict';
  const MAX = 8, WAIT_SOCIAL = 30, HAND_TIMEOUT = 4;   /* game minutes to wait for someone · real seconds for the engine to pick it up */
  const B = () => OC.Brain, D = () => OC.LifeData, Ch = () => OC.Chars, St = OC.Store, Sim = () => OC.Sim;
  const uid = () => 'q' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const nowR = () => performance.now() / 1000;
  function q(id) {
    const c = Ch().get(id); if (!c || !c.life) return null;
    if (!Array.isArray(c.life.q16)) { c.life.q16 = (Array.isArray(c.life.q15) ? c.life.q15 : []).filter((a) => D().ACTS[a]).map((a) => ({ k: uid(), kind: 'act', act: a })); }
    return c.life.q16;
  }
  const zhOf = (e) => e.label || (e.kind === 'social' ? (D().SOCIAL[e.social] || {}).zh || '互動' : e.kind === 'go' ? '走過去' : (D().ACTS[e.act] || {}).zh || e.act) + (e.place && e.place !== here(e) ? `（${(OC.Places.get(e.place) || {}).zh || ''}）` : '');
  const icOf = (e) => e.ic || (e.kind === 'social' ? (D().SOCIAL[e.social] || {}).ic || '💬' : e.kind === 'go' ? '👣' : (D().ACTS[e.act] || {}).ic || '•');
  const here = () => OC.World && OC.World.area ? OC.World.area.id : null;
  const locOf = (c) => (c.life && c.life.loc) || 'isle';
  function spec(s) {
    if (typeof s === 'string') return D().ACTS[s] ? { kind: 'act', act: s } : null;
    if (!s) return null; const e = Object.assign({ kind: 'act' }, s);
    if (e.kind === 'act' && !D().ACTS[e.act]) return null;
    if (e.kind === 'social' && !(e.other && D().SOCIAL[e.social])) return null;
    if (e.kind === 'go' && !e.pt) return null;
    return e;
  }
  /** the entry it is working on (refused ones stay visible but never block the list) */
  const act0 = (l) => l.findIndex((x) => x.st && x.st !== 'refused');
  const REFUSED_KEEP = 20;   /* real seconds a refused request stays in the list (with 強迫 / 取消) — real time: you need time to read it */

  // ---------------------------------------------------------------- adding
  function add(id, s, o = {}) {
    const list = q(id), e = spec(s); if (!list || !e) return false;
    const c = Ch().get(id);
    if (e.kind === 'act' && OC.People && c && !OC.People.canDo(c, e.act)) { OC.UI && OC.UI.toast(`${Ch().name(c)}：${OC.People.whyNot(c, e.act)}`, 'info'); return 'young'; }
    const waiting = list.filter((x) => !x.st).length; if (!o.now && waiting >= MAX) return false;
    e.k = uid(); e.loop = !!o.loop; e.at = Sim().now(); api.last = e.k;
    if (o.now) { interrupt(id); list.unshift(e); } else list.push(e);
    St.touch('life', { queue: id });
    const first = act0(list) < 0 && list.find((x) => x.st !== 'refused') === e; if (first) tryStart(c, e); return first || o.now ? 'now' : 'queued';
  }
  /** stop what it does for you (the head), keep the rest */
  function interrupt(id) {
    const list = q(id), b = B().get(id), ai = list ? act0(list) : -1;
    if (ai >= 0) list.splice(ai, 1);
    if (b) { b.queued = null; b.queuedSlot = null; b.queuedPt = null; if (b.byPlayer && (b.st === 'go' || b.st === 'do')) { if (b.st === 'do') B().finish(b, '玩家改安排'); else B().abort(b, '玩家改安排'); b.byPlayer = false; } }
  }

  // ---------------------------------------------------------------- the refusal (it does not want to)
  const NIGHT = ['evening', 'night', 'late'];
  function refusal(c, e) {
    if (e.force || e.kind !== 'act') return null;
    const A = D().ACTS[e.act], n = c.needs, ph = OC.Clock.phase(OC.Clock.hour());
    if (e.act === 'eat' && n.food > 92) return '還不餓';
    if (e.act === 'drink' && n.food > 96) return '不渴';
    if ((e.act === 'sleep') && n.sleep > 88 && !OC.Mind.sleepTime(c, OC.Clock.hour())) return '一點也不睏';
    if (e.act === 'nap' && n.sleep > 92 && n.energy > 85) return '現在不想睡';
    if (e.act === 'stargaze' && !NIGHT.includes(ph)) return '天還亮著，看不到星星';
    if (e.act === 'cloudwatch' && (NIGHT.includes(ph) || ['rain', 'storm', 'snow'].includes(OC.Clock.weather()))) return '現在看不到雲';
    if (A && A.fx && A.fx.energy < -20 && n.energy < 12) return '累得動不了';
    if (A && A.cat === 'fun' && n.food < 8) return '肚子太餓，什麼都不想玩';
    return null;
  }

  // ---------------------------------------------------------------- handing the head to the engine
  function tryStart(c, e) {
    const b = B().get(c.id); if (!b) return;
    if (b.holds.size || b.st === 'social' || b.st === 'event') return;   /* busy: it starts later */
    const why = refusal(c, e); if (why) { e.st = 'refused'; e.why = why; e.refAt = nowR(); St.touch('life', { queue: c.id }); St.emit('queue:refused', { id: c.id, k: e.k, why }); return; }
    e.why = null;
    if (e.place && e.place !== locOf(c)) {
      if (!OC.Places.open(e.place)) { e.st = 'refused'; e.why = '那裡還沒開放'; return; }
      if (OC.People && !OC.People.canTravel(c)) { e.st = 'refused'; e.why = OC.People.whyNot ? OC.People.whyNot(c, 'travel') : '還不能自己去別的地方'; return; }
      if (B().goPlace && B().goPlace(c.id, e.place, e.kind === 'act' ? e.act : null)) { e.st = 'going'; e.t0 = nowR(); St.touch('life', { queue: c.id }); }
      return;
    }
    if (!b.a) return;   /* not on screen here: waits until it is (another place's AI handles it through goPlace) */
    if (e.kind === 'go') { const a = b.a; if (OC.World.walkTo(a, e.pt.x, e.pt.y)) { B().playerAct && B().playerAct(c.id); OC.World.walkTo(a, e.pt.x, e.pt.y); e.st = 'going'; e.t0 = nowR(); } else { e.st = 'refused'; e.why = '走不過去'; } St.touch('life', { queue: c.id }); return; }
    if (e.kind === 'social') {
      const ob = B().get(e.other); const ready = ob && ob.a && !ob.holds.size && ob.st !== 'social' && ob.st !== 'event' && !(ob.invited && (B().convs || []).includes(ob.invited));
      if (!ready) { if (!e.waitAt) e.waitAt = Sim().now(); e.st = 'waitfor'; e.why = `等${Ch().name(Ch().get(e.other)) || '對方'}有空`; if (Sim().now() - e.waitAt > WAIT_SOCIAL) { e.st = 'refused'; e.refAt = nowR(); e.why = `${Ch().name(Ch().get(e.other)) || '對方'}一直沒空`; } St.touch('life', { queue: c.id }); return; }
      const r = OC.Will ? OC.Will.ask(c.id, e.other, e.social, { player: true, at: e.at2 }) : { ok: false, why: '' };
      if (!r.ok) { e.st = 'refused'; e.why = r.why || '做不到'; St.touch('life', { queue: c.id }); return; }
      e.st = 'doing'; e.t0 = nowR(); St.touch('life', { queue: c.id }); return;
    }
    b.queuedSlot = e.slot || null; b.queuedPt = e.pt || null;
    const r = B().command(c.id, e.act); if (r === false) { e.st = 'refused'; e.why = '現在做不了'; St.touch('life', { queue: c.id }); return; }
    e.st = 'handed'; e.t0 = nowR(); St.touch('life', { queue: c.id });
  }
  /** follow the head: going → doing → done (or loop) */
  function follow(c, e) {
    const b = B().get(c.id); if (!b) return;
    if (e.st === 'refused') return;
    if (e.st === 'waitfor') { tryStart(c, e); return; }
    if (e.kind === 'go') { if (!b.a || !b.a.path) done(c, e); return; }
    if (e.kind === 'social') { const busy = b.conv || b.st === 'social' || (b.invited && B().convs.includes(b.invited)); if (!busy && nowR() - e.t0 > 1.5) done(c, e); return; }
    if (e.st === 'going' && e.toAct) { if (b.a && !b.a.path) { e.toAct = false; e.st = null; tryStart(c, e); } return; }
    if (e.st === 'going' && e.place) { if (locOf(c) === e.place && b.a) { e.place = null; e.st = 'handed'; e.t0 = nowR(); if (!(b.queued === e.act || (b.byPlayer && b.act === e.act))) { b.queuedSlot = e.slot || null; B().command(c.id, e.act); } } return; }
    const mine = b.act === e.act && (b.st === 'go' || b.st === 'do') && b.byPlayer;
    if (e.st === 'handed') {
      if (mine) { e.st = b.st === 'do' ? 'doing' : 'going'; St.touch('life', { queue: c.id }); return; }
      const nowhere = e.slot ? '那裡都有人在用' : '附近沒有可以' + D().ACTS[e.act].zh + '的地方';
      if (b.queued === e.act) { if (nowR() - e.t0 > HAND_TIMEOUT * 4) { b.queued = null; b.queuedSlot = null; e.st = 'refused'; e.why = nowhere; e.refAt = nowR(); St.touch('life', { queue: c.id }); } return; }
      if (nowR() - e.t0 > HAND_TIMEOUT) { e.st = 'refused'; e.why = nowhere; e.refAt = nowR(); St.touch('life', { queue: c.id }); }
      return;
    }
    if (e.st === 'going' || e.st === 'doing') { if (mine) { if (b.st === 'do' && e.st !== 'doing') { e.st = 'doing'; St.touch('life', { queue: c.id }); } return; } if (b.queued === e.act) return; done(c, e); }
  }
  function done(c, e) {
    const list = q(c.id); const i = list.indexOf(e); if (i < 0) return; list.splice(i, 1);
    if (e.force && e.kind === 'act') OC.Mind.feel(c, 'annoyed', 0.25, `被要求${(D().ACTS[e.act] || {}).zh || ''}`);
    if (e.loop) { const again = Object.assign({}, e, { k: uid(), st: null, why: null, walked: false, toAct: false, force: false }); list.push(again); }
    St.touch('life', { queue: c.id }); St.emit('queue:done', { id: c.id, k: e.k, act: e.act });
  }
  /** per game step: follow the head, start the next */
  function step() {
    for (const c of Ch().all()) {
      const list = c.life && Array.isArray(c.life.q16) ? c.life.q16 : (c.life && Array.isArray(c.life.q15) && c.life.q15.length ? q(c.id) : null); if (!list || !list.length) continue;
      for (let i = list.length - 1; i >= 0; i--) if (list[i].st === 'refused' && list[i].refAt != null && nowR() - list[i].refAt > REFUSED_KEEP) { list.splice(i, 1); St.touch('life', { queue: c.id }); }
      for (const x of list) if (x.st === 'refused' && x.refAt == null) x.refAt = nowR();
      const ai = act0(list); if (ai >= 0) { follow(c, list[ai]); continue; }
      const e = list.find((x) => !x.st); if (e) tryStart(c, e);
    }
  }

  // ---------------------------------------------------------------- the list and editing it
  function prog(c, e) {
    const b = B().get(c.id); if (!b || e.st !== 'doing' || b.act !== e.act || b.until == null || b.t0 == null) return null;
    return Math.max(0, Math.min(1, (Sim().now() - b.t0) / Math.max(1, b.until - b.t0)));
  }
  function list(id) {
    const l = q(id) || [], c = Ch().get(id); if (!c) return [];
    const ai = act0(l);
    const ord = ai > 0 ? [l[ai]].concat(l.filter((x, j) => j !== ai)) : l;   /* what it is doing is shown first */
    return ord.map((e) => { const i = l.indexOf(e); return { k: e.k, act: e.act || e.social || 'go', zh: zhOf(e), ic: icOf(e), kind: e.kind, i: i === ai ? -1 : i, n: i,
      state: e.st === 'refused' ? 'refused' : e.st === 'waitfor' ? 'waitfor' : e.st === 'doing' ? 'doing' : e.st === 'going' || e.st === 'handed' ? (e.st === 'handed' ? 'next' : 'going') : 'waiting', why: e.why || null, loop: !!e.loop, prog: prog(c, e) }; });
  }
  const at = (id, i) => { const l = q(id); if (!l) return -1; if (i === -1) return act0(l); return i >= 0 && i < l.length ? i : -1; };
  function cancel(id, i) {
    const l = q(id); if (!l) return false; const n = at(id, i); if (n < 0) return false;
    if (n === act0(l)) interrupt(id); else l.splice(n, 1);
    St.touch('life', { queue: id }); return true;
  }
  function cancelKey(id, k) { const l = q(id) || []; const n = l.findIndex((e) => e.k === k); return n < 0 ? false : cancel(id, n); }
  function move(id, from, to) {
    const l = q(id); if (!l) return false; const ai = act0(l);   /* what it is doing stays where it is */
    if (from === ai || from < 0 || from >= l.length) return false; to = Math.max(0, Math.min(l.length - 1, to)); const [e] = l.splice(from, 1); l.splice(to, 0, e);
    St.touch('life', { queue: id }); return true;
  }
  function now(id, i) {
    const l = q(id); if (!l) return false; const n = at(id, i); if (n < 0 || n === act0(l)) return false;
    const [e] = l.splice(n, 1); interrupt(id); Object.assign(e, { st: null, why: null, walked: false, toAct: false }); l.unshift(e); tryStart(Ch().get(id), e); St.touch('life', { queue: id }); return true;
  }
  function loop(id, i, on) { const l = q(id); const n = at(id, i); if (!l || n < 0) return false; l[n].loop = on == null ? !l[n].loop : !!on; St.touch('life', { queue: id }); return true; }
  function force(id, i) { const l = q(id); const n = at(id, i); if (!l || n < 0) return false; const e = l[n]; e.force = true; e.st = null; e.why = null; e.refAt = null; l.splice(n, 1); interrupt(id); l.unshift(e); tryStart(Ch().get(id), e); St.touch('life', { queue: id }); return true; }
  function clear(id) { const l = q(id); if (!l) return; const ai = act0(l), keep = ai >= 0 ? [l[ai]] : []; l.length = 0; l.push(...keep); St.touch('life', { queue: id }); }

  function init() { if (Sim().onStep) Sim().onStep(step); for (const c of Ch().all()) { const l = q(c.id); if (l) l.forEach((e) => { if (e.st && e.st !== 'refused') e.st = null; e.walked = false; e.toAct = false; }); } }
  const api = OC.Queue = { last: null, MAX, add, list, cancel, cancelKey, move, now, loop, force, clear, step, init, refusal, interrupt };
})();
