/* OC Shimeji — simulation clock & scheduler (Phase 4).
 * ONE fixed-step scheduler drives all life systems (needs, emotions, AI, social, events),
 * independent of the render frame rate: the app loop feeds real seconds, the scheduler runs
 * STEP-sized steps. Each step advances GAME minutes by rate() × STEP:
 *   time 'real'  → game time = the device clock (1 real min = 1 game min)
 *   time 'cycle' → auto day cycle; speed ×1 = 1 game minute per real second (a day ≈ 24 min), ×2 ×5 ×10
 *   presets      → the sky stays at the chosen time; life still advances at real rate
 * Offline / background: real & preset modes catch up abstractly (capped, no events, no rewards);
 * the cycle clock simply pauses while the app is closed.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s;
  const STEP = 0.2;                     // real seconds per simulation step
  const OFFLINE_CAP = 8 * 60;           // game minutes simulated at most for one absence
  const SPEEDS = [1, 2, 5, 10];
  let catching = false, acc = 0, steps = [], days = [], abstracts = [], lastDay = null, stepN = 0;

  // ---------------- deterministic RNG (seedable for tests) ----------------
  let seed = (Date.now() ^ 0x5bd1e995) >>> 0;
  function rnd() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  function wpick(items, wf) { let tot = 0; const ws = items.map((x) => { const w = Math.max(0, wf(x)); tot += w; return w; }); if (tot <= 0) return null; let r = rnd() * tot; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }

  // ---------------- clock ----------------
  const realGm = (t = Date.now()) => (t - new Date(t).getTimezoneOffset() * 60000) / 60000;
  function L() { return S().life; }
  function mode() { const t = S().settings.time; return t === 'cycle' ? 'cycle' : t === 'real' ? 'real' : 'preset'; }
  function speed() { const v = S().settings.timeSpeed; return SPEEDS.includes(v) ? v : 1; }
  /** game minutes per real second */
  function rate() { return mode() === 'cycle' ? speed() : 1 / 60; }
  function now() { const c = L().clock; if (mode() !== 'cycle') c.gm = Math.max(c.gm || 0, realGm()); return c.gm; }
  const day = (gm = now()) => Math.floor(gm / 1440);
  /** hour of the simulated day (sky follows OC.Clock.hour, which reads this in cycle mode) */
  function hourOf(gm = now()) { return ((gm % 1440) + 1440) % 1440 / 60; }
  function setMode(m) {
    // keep continuity when switching into the auto cycle (start from the current real time)
    const c = L().clock; if (m === 'cycle' && mode() !== 'cycle') { c.gm = Math.max(c.gm || 0, realGm()); if (c.day0 == null) c.day0 = Math.floor(c.gm / 1440); }
    S().settings.time = m; OC.Store.touch('settings', { k: 'time', v: m });
  }
  function setSpeed(v) { S().settings.timeSpeed = SPEEDS.includes(v) ? v : 1; OC.Store.touch('settings', { k: 'timeSpeed', v }); }

  // ---------------- scheduler ----------------
  function onStep(fn) { steps.push(fn); }
  function onDay(fn) { days.push(fn); }
  function onAbstract(fn) { abstracts.push(fn); }
  function step(g) {
    const c = L().clock; stepN++;
    if (mode() === 'cycle') c.gm += g; else c.gm = Math.max(c.gm + g, realGm());
    L().lastReal = Date.now();
    for (const f of steps) { try { f(g, STEP); } catch (e) { console.error('[sim]', e); } }
    const d = day(c.gm); if (lastDay == null) lastDay = d;
    if (d !== lastDay) { const from = lastDay; lastDay = d; for (const f of days) { try { f(d, from); } catch (e) { console.error('[sim day]', e); } } }
  }
  /** feed real seconds (any frame rate); large gaps become an abstract catch-up */
  function update(realDt) {
    if (!S() || !L()) return;
    // a long gap while the app was "running" is a stall (slow frame), not an absence — app pause/resume handles absences.
    // real/preset clocks re-sync from the device clock; the cycle clock simulates the stall (max 30 s) step by step
    if (realDt > 3 && mode() !== 'cycle') { catchUp('gap'); return; }
    if (mode() === 'cycle' && S().settings.timePaused) { acc = 0; return; }   // 8.0: the player paused the island clock (needs freeze too)
    acc += Math.min(30, Math.max(0, realDt)); let n = 0;
    while (acc >= STEP && n++ < 160) { acc -= STEP; step(rate() * STEP); }
    if (acc > STEP * 160) acc = 0;     // never spiral
  }
  /** 8.0 time panel: in the game cycle, jump FORWARD to an hour of the day. The skipped minutes are simulated abstractly
   *  (needs, sleep, activities — like an absence: no events, no rewards), then the clock moves; day hooks fire normally. */
  function skipTo(hour) {
    if (mode() !== 'cycle') return 0;
    const c = L().clock, h = hourOf(c.gm); let dh = ((hour - h) % 24 + 24) % 24; if (dh < 1 / 60) return 0;
    const gm = dh * 60, chunks = Math.ceil(gm / 10), g = gm / chunks, start = c.gm;
    catching = true;
    try { for (let i = 0; i < chunks; i++) for (const f of abstracts) { try { f(g, { offline: true, reason: 'skip', at: start + i * g }); } catch (e) { console.error('[sim skip]', e); } } } finally { catching = false; }
    c.gm += gm; OC.Store.touch('life', { skip: gm }); OC.Store.emit('life:skip', { min: Math.round(gm) });
    return gm;
  }
  /** run N full steps headlessly (tests / diagnostics). gm = game minutes to simulate */
  function advance(gm) { const per = rate() * STEP; let left = gm; while (left > 1e-9) { const g = Math.min(per, left); step(g); left -= g; } }

  /** abstract simulation of an absence: capped, chunked, no events, no rewards (idempotent: based on lastReal) */
  function catchUp(reason = 'resume') {
    const l = L(), t = Date.now(), last = l.lastReal || t; l.lastReal = t;
    const elapsedMin = Math.max(0, (t - last) / 60000);
    if (mode() === 'cycle' || elapsedMin < 1) { now(); return 0; }
    const gm = Math.min(OFFLINE_CAP, elapsedMin);
    const chunks = Math.ceil(gm / 10), g = gm / chunks, start = l.clock.gm || realGm(last);
    catching = true;
    try { for (let i = 0; i < chunks; i++) for (const f of abstracts) { try { f(g, { offline: true, reason, at: start + i * g }); } catch (e) { console.error('[sim offline]', e); } } } finally { catching = false; }
    l.clock.gm = Math.max(l.clock.gm, realGm(t)); lastDay = day(l.clock.gm);
    l.offline = { at: t, min: Math.round(elapsedMin), simulated: Math.round(gm), capped: elapsedMin > OFFLINE_CAP, reason };
    OC.Store.emit('life:offline', l.offline);
    return gm;
  }

  OC.Sim = {
    STEP, OFFLINE_CAP, SPEEDS, update, advance, catchUp, step, onStep, onDay, onAbstract, skipTo,
    now, day, hourOf, rate, mode, speed, setMode, setSpeed, realGm,
    get catching() { return catching; }, rnd, pick, wpick, seed(v) { seed = v >>> 0; }, get steps() { return stepN; },
  };
})();
