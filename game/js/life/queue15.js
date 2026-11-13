/* OC Shimeji 15.0 — OC.Queue: a short list of things you asked a character to do, in order (the "action queue").
 * The life engine itself only ever holds ONE player request (Brain.command → b.queued); this keeps the rest and hands the next one over
 * when the character is free again. It never bypasses the engine: every entry still goes through Brain.command (slots, locks, holds).
 *   OC.Queue.add(id, act)      → 'now' | 'queued' | false (unknown act / full)
 *   OC.Queue.list(id)          → [{ act, zh, state: 'doing' | 'going' | 'next' | 'waiting', i }]   (i = index in the waiting list, −1 for the current one)
 *   OC.Queue.cancel(id, i)     → cancels a waiting entry, or (i = −1) what it is doing for you right now
 *   OC.Queue.clear(id)
 * Stored on the character (c.life.q15 = [act ids]) so it survives a reload; a character in manual mode keeps its queue too.
 */
(function () {
  'use strict';
  const MAX = 4;
  const B = () => OC.Brain, D = () => OC.LifeData, Ch = () => OC.Chars, St = OC.Store;
  const q = (id) => { const c = Ch().get(id); if (!c || !c.life) return null; return (c.life.q15 = Array.isArray(c.life.q15) ? c.life.q15 : []); };
  /** is it busy with something the player asked for? */
  const current = (b) => (b && b.byPlayer && (b.st === 'go' || b.st === 'do') && b.act ? { act: b.act, state: b.st === 'do' ? 'doing' : 'going' } : b && b.queued ? { act: b.queued, state: 'next' } : null);

  function add(id, act) {
    const list = q(id), b = B().get(id); if (!list || !D().ACTS[act]) return false;
    if (!current(b) && !list.length) { const r = B().command(id, act); if (r === false) return false; St.touch('life', { queue: id }); return 'now'; }
    if (list.length >= MAX) return false;
    list.push(act); St.touch('life', { queue: id }); return 'queued';
  }
  function list(id) {
    const l = q(id) || [], b = B().get(id), cur = current(b), out = [];
    if (cur) out.push({ act: cur.act, zh: D().ACTS[cur.act].zh, state: cur.state, i: -1 });
    l.forEach((act, i) => { if (D().ACTS[act]) out.push({ act, zh: D().ACTS[act].zh, state: 'waiting', i }); });
    return out;
  }
  function cancel(id, i) {
    const l = q(id), b = B().get(id); if (!l) return false;
    if (i >= 0) { if (i >= l.length) return false; l.splice(i, 1); St.touch('life', { queue: id }); return true; }
    if (!b) return false;
    if (b.queued) { b.queued = null; St.touch('life', { queue: id }); return true; }
    if (b.byPlayer && (b.st === 'go' || b.st === 'do')) { if (b.st === 'do') B().finish(b, '玩家取消'); else B().abort(b, '玩家取消'); b.byPlayer = false; St.touch('life', { queue: id }); return true; }
    return false;
  }
  function clear(id) { const l = q(id); if (l) { l.length = 0; St.touch('life', { queue: id }); } }

  /* hand the next entry to the engine when the character has nothing of yours in hand and nothing holds it */
  function step() {
    for (const c of Ch().all()) {
      const l = c.life && c.life.q15; if (!l || !l.length) continue;
      const b = B().get(c.id); if (!b || !b.a || current(b) || b.holds.size || b.st === 'social') continue;
      const act = l.shift(); if (D().ACTS[act]) B().command(c.id, act); St.touch('life', { queue: c.id });
    }
  }
  function init() { if (OC.Sim.onStep) OC.Sim.onStep(step); }
  OC.Queue = { MAX, add, list, cancel, clear, step, init };
})();
