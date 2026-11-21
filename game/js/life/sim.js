/* OC Shimeji — simulation clock & scheduler (Phase 4).
 * ONE fixed-step scheduler drives all life systems (needs, emotions, AI, social, events),
 * independent of the render frame rate: the app loop feeds real seconds, the scheduler runs
 * STEP-sized steps. Each step advances GAME minutes by rate() × STEP:
 *   time 'real'  → game time = the device clock (1 real min = 1 game min)
 *   time 'cycle' → auto day cycle; speed ×1 = 1 game minute per real second (a day ≈ 24 min), ×2 ×5 ×10
 *   presets      → the sky stays at the chosen time; life still advances at real rate
 * Offline / background: real & preset modes catch up abstractly (capped, no events, no rewards);
 * the cycle clock simply pauses while the app is closed.
 * 17.0 → 17.1 background life (life.settings.away17 !== false): an absence is simulated on a VIRTUAL clock — every chunk moves
 * the game clock, so hour / weekday / day-change logic sees the time it would have been; up to 30 days (10-minute chunks for the
 * first 72 hours, then hourly); the game-calendar cycle advances 1:1 with real time while away; the RNG is seeded from the save
 * and the start of the absence, so the same absence always gives the same story; a clock that went backwards is not simulated.
 * Day hooks for an absence are separate (onAwayDay): only systems that are safe without a player opt in. Still no rewards:
 * OC.Progress does not emit while catching.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s;
  const STEP = 0.2;                     // real seconds per simulation step
  const OFFLINE_CAP = 8 * 60;           // game minutes simulated at most for one absence (legacy, away17 off)
  const AWAY_CAP = 30 * 1440, AWAY_FINE = 72 * 60;   /* 17.1: thirty days at most; ten-minute steps for the first three days, hourly after */
  const SPEEDS = [1, 2, 5, 10];
  let catching = false, acc = 0, steps = [], days = [], abstracts = [], awayDays = [], lastDay = null, stepN = 0, virtual = false, dry = false;

  // ---------------- deterministic RNG (seedable for tests) ----------------
  let seed = (Date.now() ^ 0x5bd1e995) >>> 0;
  function rnd() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  function wpick(items, wf) { let tot = 0; const ws = items.map((x) => { const w = Math.max(0, wf(x)); tot += w; return w; }); if (tot <= 0) return null; let r = rnd() * tot; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }

  // ---------------- clock ----------------
  const realGm = (t = Date.now()) => (t - new Date(t).getTimezoneOffset() * 60000) / 60000;
  function L() { return S().life; }
  function mode() { const t = S().settings.time; return t === 'cycle' ? 'cycle' : t === 'real' ? 'real' : 'preset'; }
  const FAST = [30, 60];   /* 17.2: only while observing (OC.Observe); leaving the mode puts the old speed back */
  const watching = () => !!(OC.Observe && OC.Observe.on);
  function speed() { const v = S().settings.timeSpeed; return SPEEDS.includes(v) || (FAST.includes(v) && watching()) ? v : 1; }
  /** game minutes per real second */
  function rate() { return mode() === 'cycle' ? speed() : 1 / 60; }
  function now() { const c = L().clock; if (mode() !== 'cycle' && !virtual) c.gm = Math.max(c.gm || 0, realGm()); return c.gm; }   /* 17.1: during an absence the clock is the simulated one */
  /** the device time (ms) that a game minute corresponds to (real calendar) */
  const msOf = (gm) => { const g = gm * 60000; return g + new Date(g).getTimezoneOffset() * 60000; };
  const away17 = () => L().settings.away17 !== false;
  function lifeSeed() { const l = L(); if (!l.seed17) l.seed17 = ((Date.now() ^ 0x9e3779b9) >>> 0) || 1; return l.seed17; }
  const day = (gm = now()) => Math.floor(gm / 1440);
  /** hour of the simulated day (sky follows OC.Clock.hour, which reads this in cycle mode) */
  function hourOf(gm = now()) { return ((gm % 1440) + 1440) % 1440 / 60; }
  function setMode(m) {
    // keep continuity when switching into the auto cycle (start from the current real time)
    const c = L().clock; if (m === 'cycle' && mode() !== 'cycle') { c.gm = Math.max(c.gm || 0, realGm()); if (c.day0 == null) c.day0 = Math.floor(c.gm / 1440); }
    S().settings.time = m; OC.Store.touch('settings', { k: 'time', v: m });
  }
  function setSpeed(v, o) { S().settings.timeSpeed = SPEEDS.includes(v) || (o && o.obs && FAST.includes(v)) ? v : 1; OC.Store.touch('settings', { k: 'timeSpeed', v }); }

  // ---------------- scheduler ----------------
  function onStep(fn) { steps.push(fn); }
  function onDay(fn) { days.push(fn); }
  function onAbstract(fn) { abstracts.push(fn); }
  /** 17.1: called for every day boundary crossed while away (only systems that are safe without a player register) */
  function onAwayDay(fn) { awayDays.push(fn); }
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
    if (away17()) return awayRun(reason);
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

  /** 17.1: the background-life version of catchUp (see the header) */
  function awayRun(reason, tNow) {
    const l = L(), t = tNow || Date.now(), last = l.lastReal || t;
    if (t < last - 120000) {   /* the device clock went backwards: no simulation, no rewind */
      l.lastReal = t; l.offline = { at: t, min: 0, simulated: 0, backward: Math.round((last - t) / 60000), reason }; OC.Store.emit('life:offline', l.offline); return 0;
    }
    l.lastReal = t;
    const elapsedMin = Math.max(0, (t - last) / 60000);
    if (elapsedMin < 1) { now(); return 0; }
    const cycle = mode() === 'cycle';
    if (cycle && l.settings.awayPause) { now(); return 0; }
    const c = l.clock, start = cycle ? c.gm : Math.max(c.gm || 0, realGm(last)), total = Math.min(AWAY_CAP, elapsedMin);
    const target = cycle ? c.gm + elapsedMin : Math.max(c.gm, realGm(t));
    const keep = seed; seed = (Math.imul(lifeSeed(), 2654435761) ^ Math.floor(start)) >>> 0;   /* the same absence → the same story */
    const deep = total >= 10;   /* a few minutes (a stall, a quick switch to another app): the ones on screen carry on with what they were doing */
    catching = true; virtual = true; let done = 0, d0 = day(start);
    if (deep) OC.Store.emit('away:begin', { from: start, min: total, reason, dry });
    try {
      while (done < total - 1e-6) {
        const g = Math.min(done < AWAY_FINE ? 10 : 60, total - done), at = start + done;
        c.gm = at;
        for (const f of abstracts) { try { f(g, { offline: true, away: deep, reason, at }); } catch (e) { console.error('[sim away]', e); } }
        done += g; c.gm = start + done;
        const d = day(c.gm); while (d0 < d) { d0++; for (const f of awayDays) { try { f(d0, d0 - 1); } catch (e) { console.error('[sim away day]', e); } } }
      }
    } finally { catching = false; virtual = false; seed = keep; }
    c.gm = Math.max(c.gm, target); lastDay = day(c.gm);
    l.offline = { at: t, min: Math.round(elapsedMin), simulated: Math.round(total), from: start, to: c.gm, capped: elapsedMin > AWAY_CAP, reason, away17: true };
    if (!dry) OC.Store.emit('life:offline', l.offline);
    return total;
  }

  /** 17.1: a dry run of the next `hours` (the same away simulation, from the save as it is now), then everything is put back.
   *  `fn(info)` reads what happened (the timeline, OC.Forecast's per-hour notes) before the save is restored. The same absence later
   *  tells the same story (same seed, same chunks), which is what makes a forecast for notifications honest. */
  function forecast(hours, fn) {
    if (!away17() || catching) return null; const l = L();
    if (mode() === 'cycle' && l.settings.awayPause) return null;
    const snap = OC.Store.exportJSON(), keepDay = lastDay, keepAcc = acc, base = l.lastReal || Date.now(); let out = null;
    dry = true;
    try { l.lastReal = base; awayRun('forecast', base + hours * 3600e3); out = fn ? fn(l.offline, base) : l.offline; }
    catch (e) { console.error('[sim forecast]', e); }
    finally { dry = false; OC.Store.restore(snap); lastDay = keepDay; acc = keepAcc; }
    return out;
  }

  OC.Sim = {
    STEP, OFFLINE_CAP, AWAY_CAP, SPEEDS, update, advance, catchUp, awayRun, forecast, step, onStep, onDay, onAbstract, onAwayDay, skipTo, msOf, lifeSeed,
    now, day, hourOf, rate, mode, speed, setMode, setSpeed, realGm,
    get catching() { return catching; }, get virtual() { return virtual; }, get dry() { return dry; }, rnd, pick, wpick, seed(v) { seed = v >>> 0; }, get steps() { return stepN; },
  };
})();
