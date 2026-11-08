/* OC Shimeji — 8.0 direct touch on characters in the world (OC.Touch).
 *
 * A finger that lands on an OC belongs to that OC (OC.World claim hooks) — it never pans the camera:
 *   tap                      → context ring (OC.Radial) around the OC
 *   back-and-forth stroke    → petting (OC.LifeUI.pet: feelings / affection with its own cooldowns, Progress 'pet')
 *   drag away / hold still   → pick up: the OC hangs under the finger and swings like a pendulum from the hands
 *   release                  → gentle drop, or a throw (ballistic arc, bounces, never leaves walkable ground)
 * Reactions depend on personality, mood and whether it was asleep (OC.App.dragEnd with { fling }).
 * Everything is driven by real time in requestAnimationFrame (frame-rate independent), data only changes through
 * the existing life APIs (Brain.hold / Mind.feel / LifeUI.pet).
 */
(function () {
  'use strict';
  const A = () => OC.App, Wd = () => OC.World;
  let t = null, raf = 0;

  const isChar = (it) => it && (it.type === 'self' || it.type === 'mate');
  const idOf = (it) => (it.type === 'self' ? OC.Store.s.activeId : it.id);

  /** world hook: a finger went down on something; claim it if it is one of our OCs */
  function down(r, p) {
    if (!isChar(r.it) || A().dlgOpen || A().curTab !== 'island' || A().placing) return false;
    const id = idOf(r.it), a = A().actorOf(id); if (!a) return false;
    if (flights.has(a)) return false;
    if (t) cancel();   // a stale gesture (its finger-up never arrived) is finished first: put down, never left hanging
    t = { id, a, x0: p.x, y0: p.y, lx: p.x, ly: p.y, t0: performance.now(), lastT: performance.now(), dir: 0, rev: 0, strokes: 0, petAt: 0, lifted: false, moved: false, hist: [], swing: 0, swingV: 0, vxPrev: 0 };
    t.timer = setTimeout(() => { if (t && !t.moved && !t.lifted && t.rev < 2) lift(true); }, 420);
    loop();
    return true;
  }

  function move(dp, p) {
    if (!t) return;
    const now = performance.now(), dx = p.x - t.lx;
    t.hist.push({ x: p.x, y: p.y, t: now }); while (t.hist.length > 2 && now - t.hist[0].t > 120) t.hist.shift();
    if (Math.abs(dx) > 4) { const s = Math.sign(dx); if (t.dir && s !== t.dir) t.rev++; t.dir = s; }
    const far = Math.hypot(p.x - t.x0, p.y - t.y0);
    if (far > 10) t.moved = true;
    t.lx = p.x; t.ly = p.y;
    if (t.lifted) { hold(dp, p, now); return; }
    // petting: the finger rubs back and forth but stays on the OC
    if (t.rev >= 2 && far < 70 && Math.abs(p.y - t.y0) < 50) {
      const n = Math.floor(t.rev / 2);
      if (n > t.strokes) {
        t.strokes = n; OC.UI.haptic('tick');
        if (now - t.petAt > 2600) { t.petAt = now; OC.LifeUI.pet(t.id); OC.Store.emit('touch:pet', { id: t.id }); }
        else A().floatText(t.a, '♡', 'var(--heart)');
      }
      return;
    }
    // picking up: clearly moved away without rubbing
    if (far > 24 && t.rev < 2) lift(false, dp);
  }

  function lift(still, dp) {
    if (!t || t.lifted) return;
    const r = A().startCarry(t.id); if (!r) { t = null; return; }
    t.lifted = true; clearTimeout(t.timer);
    if (still) { OC.UI.haptic('long'); A().floatText(t.a, '!', 'var(--sun)'); }
    OC.Sound && OC.Sound.play('pickup'); OC.Store.emit('touch:lift', { id: t.id });
    if (dp) place(dp);
  }
  /** the OC hangs under the finger (feet a little below it), anywhere over the area while held */
  function place(dp) { const a = t.a; a.x = dp.x; a.y = dp.y + 10; a.lift = 24; }

  function hold(dp, p, now) {
    place(dp);
    const dt = Math.max(0.008, (now - t.lastT) / 1000); t.lastT = now;
    const vx = (p.x - (t.px == null ? p.x : t.px)) / dt; t.px = p.x;
    const ax = (vx - t.vxPrev) / dt; t.vxPrev = vx;
    t.swingV += Math.max(-60, Math.min(60, -ax * 0.00035));
  }

  function up(dp, p) {
    if (!t) return; const cur = t; t = null; clearTimeout(cur.timer);
    if (!cur.lifted) {
      if (cur.rev >= 2 || cur.moved) return;          // a stroke or a slip: nothing else
      A().menuFor({ type: cur.id === OC.Store.s.activeId ? 'self' : 'mate', id: cur.id }, A().screenOf(cur.a));
      return;
    }
    // release velocity (screen px/s) from the last ~100 ms
    const h0 = cur.hist[0], h1 = cur.hist[cur.hist.length - 1], dtv = h0 && h1 ? Math.max(0.016, (h1.t - h0.t) / 1000) : 1;
    const sv = h0 && h1 ? { x: (h1.x - h0.x) / dtv, y: (h1.y - h0.y) / dtv } : { x: 0, y: 0 }, speed = Math.hypot(sv.x, sv.y);
    const dv = Wd().screenDelta(sv.x, sv.y), cap = 520, m = Math.hypot(dv.x, dv.y) || 1, k = Math.min(1, cap / m);
    fly(cur, { vx: dv.x * k * 0.85, vy: dv.y * k * 0.85, vl: speed > 500 ? Math.min(150, speed * 0.12) : 0, strong: speed > 1300, swing: cur.swing, swingV: cur.swingV });
  }

  function cancel() { if (t && t.lifted) up(null, { x: t.lx, y: t.ly }); else if (t) { clearTimeout(t.timer); t = null; } }

  // ------------------------------------------------------------------ flights (drop / throw)
  const flights = new Map();
  function fly(cur, o) {
    const a = cur.a; OC.Store.emit('touch:release', { id: cur.id, strong: o.strong });
    flights.set(a, { id: cur.id, vx: o.vx, vy: o.vy, vl: o.vl, bounces: 0, strong: o.strong, swing: o.swing, swingV: o.swingV, t: 0 });
    loop();
  }
  function stepFlight(a, f, dt) {
    const W_ = Wd(); f.t += dt;
    let nx = a.x + f.vx * dt, ny = a.y + f.vy * dt;
    // never off the ground: bounce off what is not walkable (walls, sea, cliffs)
    if (!W_.walkable(nx, a.y)) { f.vx = -f.vx * 0.4; nx = a.x; }
    if (!W_.walkable(a.x, ny)) { f.vy = -f.vy * 0.4; ny = a.y; }
    if (W_.walkable(nx, ny)) { a.x = nx; a.y = ny; }
    f.vl -= 620 * dt; a.lift = Math.max(0, a.lift + f.vl * dt);
    const drag = Math.exp(-dt * (a.lift > 0 ? 0.6 : 6)); f.vx *= drag; f.vy *= drag;
    // the swing settles while falling
    f.swingV += (-f.swing * 70 - f.swingV * 7) * dt; f.swing += f.swingV * dt; a.swing = f.swing;
    if (a.lift <= 0) {
      if (f.vl < -120 && f.bounces < 2) { f.vl = -f.vl * 0.38; f.bounces++; a.squashT = 0; OC.Sound && OC.Sound.play('jump'); return false; }
      if (Math.hypot(f.vx, f.vy) > 20 && f.t < 2.5) return false;   // still sliding to a stop
      return true;
    }
    return f.t > 4;   // safety
  }
  function land(a, f) {
    flights.delete(a); a.lift = 0; a.swing = 0;
    if (!Wd().walkable(a.x, a.y)) { const q = Wd().nearestWalkable(a.x, a.y, 80); if (q) { a.x = q.x; a.y = q.y; } }
    OC.UI.haptic(f.strong ? 'heavy' : 'light');
    A().dragEnd(null, { fling: f.strong ? 2 : f.bounces ? 1 : 0 });
    OC.Store.emit('touch:land', { id: f.id, strong: f.strong });
  }

  function loop() {
    if (raf) return;
    let last = performance.now();
    const step = (now) => {
      // real time in small sub-steps: a slow device must not throw in slow motion (or explode with big steps)
      let left = Math.min(0.5, (now - last) / 1000); last = now;
      while (left > 1e-4) {
        const dt = Math.min(0.02, left); left -= dt;
        if (t && t.lifted) { // pendulum while held (pivot at the hands; damped)
          t.swingV += (-t.swing * 60 - t.swingV * 5) * dt; t.swing = Math.max(-0.75, Math.min(0.75, t.swing + t.swingV * dt)); t.a.swing = t.swing;
        }
        for (const [a, f] of [...flights]) if (stepFlight(a, f, dt)) land(a, f);
      }
      if (t || flights.size) raf = requestAnimationFrame(step); else raf = 0;
    };
    raf = requestAnimationFrame(step);
  }

  // the app going to the background / losing focus while an OC is held: put it down (the finger-up will never come)
  document.addEventListener('visibilitychange', () => { if (document.hidden && t) cancel(); });
  window.addEventListener('blur', () => { if (t) cancel(); });
  OC.Touch = { down, move, up, cancel, get active() { return !!t; }, get flying() { return flights.size; } };
})();
