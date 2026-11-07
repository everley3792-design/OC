/* OC Shimeji — sound (Phase 6). Every sound is synthesised at runtime with WebAudio (original, no sample files,
 * nothing taken from other games). Soft, short, rounded envelopes; never louder than the UI needs.
 *   categories: ui · sfx (characters, objects) · amb (places, weather) · event (cards, levels, fanfares)
 *   settings:   S.settings.sound = { on, master, ui, sfx, amb, event }  (0..1)
 *   de-dup:     the same sound cannot restart within its cooldown, at most 10 voices at once
 *   ambient:    sea / wind / rain / room tone / birds by day / crickets by night — chosen by place, weather, time,
 *               cross-faded; paused when the app is hidden
 * Starts silent until the first touch (browsers / WebViews require a gesture).
 */
(function () {
  'use strict';
  const S = () => OC.Store.s;
  let ctx = null, master = null, bus = {}, noiseBuf = null, voices = 0, unlocked = false;
  const last = {};
  const cfg = () => Object.assign({ on: true, master: 0.8, ui: 0.6, sfx: 0.8, amb: 0.5, event: 0.8 }, S().settings.sound || {});

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.connect(ctx.destination);
    for (const k of ['ui', 'sfx', 'amb', 'event']) { bus[k] = ctx.createGain(); bus[k].connect(master); }
    const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; }   // soft (pinkish) noise
    apply(); return true;
  }
  function apply() { if (!ctx) return; const c = cfg(); master.gain.value = c.on ? c.master : 0; for (const k of Object.keys(bus)) bus[k].gain.value = c[k]; }
  function unlock() { if (!init()) return; if (ctx.state === 'suspended') ctx.resume(); unlocked = true; }

  // ---------------- building blocks ----------------
  const T = () => ctx.currentTime;
  function env(g, t0, a, peak, d, sustainTo = 0.0001) { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a); g.gain.exponentialRampToValueAtTime(sustainTo, t0 + a + d); }
  function tone(cat, f, { t = 0, a = 0.006, d = 0.18, v = 0.2, type = 'sine', to = null, slide = 0.08, detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = T() + t; o.type = type; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + slide); o.detune.value = detune;
    env(g, t0, a, v, d); o.connect(g); g.connect(bus[cat]); o.start(t0); o.stop(t0 + a + d + 0.05); voices++; o.onended = () => { voices--; };
  }
  function noise(cat, { t = 0, a = 0.004, d = 0.12, v = 0.2, type = 'bandpass', f = 1200, q = 1, to = null } = {}) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = T() + t; s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t0); if (to) fl.frequency.exponentialRampToValueAtTime(to, t0 + a + d); fl.Q.value = q;
    env(g, t0, a, v, d); s.connect(fl); fl.connect(g); g.connect(bus[cat]); s.start(t0, Math.random()); s.stop(t0 + a + d + 0.05); voices++; s.onended = () => { voices--; };
  }
  const bell = (cat, f, t, v = 0.14, d = 0.9) => { tone(cat, f, { t, d, v, type: 'sine' }); tone(cat, f * 2.01, { t, d: d * 0.5, v: v * 0.35, type: 'sine' }); tone(cat, f * 3.02, { t, d: d * 0.25, v: v * 0.12, type: 'sine' }); };

  // ---------------- the sound library (name → [category, cooldown ms, player]) ----------------
  const N = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568 };
  const LIB = {
    tap: ['ui', 40, () => tone('ui', 900, { d: 0.05, v: 0.06, to: 700, slide: 0.04 })],
    pop: ['ui', 80, () => { tone('ui', 480, { d: 0.09, v: 0.09, to: 880, slide: 0.07 }); }],
    close: ['ui', 80, () => tone('ui', 760, { d: 0.08, v: 0.06, to: 420, slide: 0.07 })],
    tab: ['ui', 60, () => tone('ui', 620, { d: 0.07, v: 0.06, type: 'triangle' })],
    error: ['ui', 200, () => { tone('ui', 300, { d: 0.12, v: 0.08, type: 'triangle' }); tone('ui', 240, { t: 0.1, d: 0.14, v: 0.07, type: 'triangle' }); }],
    coin: ['event', 60, () => { tone('event', 1318, { d: 0.08, v: 0.08, type: 'triangle' }); tone('event', 1760, { t: 0.06, d: 0.22, v: 0.08, type: 'triangle' }); }],
    pickup: ['sfx', 80, () => { [660, 880, 1100].forEach((f, i) => tone('sfx', f, { t: i * 0.05, d: 0.1, v: 0.08, type: 'triangle' })); }],
    chime: ['event', 150, () => { bell('event', N.E6 / 2, 0, 0.12, 0.7); bell('event', N.G5, 0.12, 0.1, 0.9); }],
    card: ['event', 200, () => { noise('event', { d: 0.22, v: 0.05, f: 2400, to: 900, q: 0.7 }); bell('event', N.A5, 0.06, 0.07, 0.5); }],
    sparkle: ['event', 150, () => { for (let i = 0; i < 4; i++) tone('event', 1800 + Math.random() * 1600, { t: i * 0.06, d: 0.18, v: 0.05 }); }],
    levelup: ['event', 400, () => { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone('event', f, { t: i * 0.09, d: 0.26, v: 0.09, type: 'triangle' })); bell('event', N.C6, 0.36, 0.08, 1.1); }],
    fanfare: ['event', 600, () => { [N.G5, N.C6, N.E6].forEach((f, i) => tone('event', f / 2, { t: i * 0.11, d: 0.22, v: 0.09, type: 'triangle' })); [N.C5, N.E5, N.G5].forEach((f) => tone('event', f, { t: 0.36, d: 0.9, v: 0.06, type: 'triangle' })); bell('event', N.C6, 0.36, 0.07, 1.2); }],
    gift: ['sfx', 200, () => { bell('sfx', N.E5, 0, 0.1, 0.6); bell('sfx', N.A5, 0.1, 0.09, 0.7); }],
    yum: ['sfx', 300, () => { tone('sfx', 520, { d: 0.22, v: 0.09, to: 820, slide: 0.18, type: 'triangle' }); tone('sfx', 820, { t: 0.2, d: 0.3, v: 0.07, to: 1040, slide: 0.12, type: 'triangle' }); }],
    yuck: ['sfx', 300, () => { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = T(); o.type = 'sawtooth'; o.frequency.setValueAtTime(260, t0); o.frequency.exponentialRampToValueAtTime(140, t0 + 0.5); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t0); f.frequency.exponentialRampToValueAtTime(260, t0 + 0.5); env(g, t0, 0.02, 0.07, 0.5); o.connect(f); f.connect(g); g.connect(bus.sfx); o.start(t0); o.stop(t0 + 0.6); }],
    bonk: ['sfx', 150, () => { tone('sfx', 180, { d: 0.16, v: 0.12, to: 110, slide: 0.12 }); noise('sfx', { d: 0.05, v: 0.06, f: 600 }); }],
    chew: ['sfx', 120, () => { for (let i = 0; i < 3; i++) noise('sfx', { t: i * 0.16, d: 0.05, v: 0.05, f: 900 + Math.random() * 400, q: 2 }); }],
    gulp: ['sfx', 150, () => tone('sfx', 220, { d: 0.12, v: 0.08, to: 380, slide: 0.1 })],
    jump: ['sfx', 120, () => tone('sfx', 280, { d: 0.16, v: 0.07, to: 620, slide: 0.12, type: 'triangle' })],
    step: ['sfx', 140, () => noise('sfx', { d: 0.04, v: 0.025, f: 700, q: 0.8 })],
    splash: ['sfx', 200, () => { noise('sfx', { d: 0.4, v: 0.1, f: 1400, to: 500, q: 0.6 }); tone('sfx', 360, { d: 0.12, v: 0.04, to: 160, slide: 0.1 }); }],
    reel: ['sfx', 90, () => noise('sfx', { d: 0.03, v: 0.04, f: 3000, q: 4 })],
    bite: ['sfx', 300, () => { tone('sfx', 880, { d: 0.06, v: 0.08 }); tone('sfx', 1175, { t: 0.08, d: 0.1, v: 0.08 }); }],
    chop: ['sfx', 90, () => noise('sfx', { d: 0.05, v: 0.08, f: 2200, q: 1.5 })],
    sizzle: ['sfx', 400, () => noise('sfx', { a: 0.05, d: 0.6, v: 0.04, type: 'highpass', f: 3000 })],
    door: ['sfx', 300, () => { tone('sfx', 140, { d: 0.1, v: 0.1 }); tone('sfx', 120, { t: 0.13, d: 0.12, v: 0.09 }); }],
    page: ['sfx', 300, () => noise('sfx', { d: 0.18, v: 0.04, f: 2600, to: 1600, q: 0.6 })],
    water: ['sfx', 300, () => { for (let i = 0; i < 5; i++) tone('sfx', 900 + Math.random() * 700, { t: i * 0.05, d: 0.06, v: 0.03 }); }],
    place: ['sfx', 150, () => { tone('sfx', 200, { d: 0.08, v: 0.09 }); noise('sfx', { d: 0.06, v: 0.04, f: 800 }); }],
  };
  /** play a sound by name (respects settings, cooldowns and the voice cap) */
  function play(name, o = {}) {
    const L = LIB[name]; if (!L || !ctx || !unlocked || !cfg().on) return false;
    if (ctx.state !== 'running' || document.hidden) return false;
    const now = performance.now(); if (now - (last[name] || 0) < L[1]) return false; last[name] = now;
    if (voices > 10) return false;
    try { L[2](o); } catch (e) { return false; }
    return true;
  }

  // ---------------- ambient beds ----------------
  const beds = {}; let ambKey = '', birdT = 0;
  function bed(id, build) {
    if (beds[id]) return beds[id];
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(bus.amb);
    const nodes = build(g); beds[id] = { g, nodes }; return beds[id];
  }
  function noiseBed(g, type, f, q, lfoRate, lfoDepth, level) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), lv = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; lv.gain.value = level;
    s.connect(fl); fl.connect(lv); lv.connect(g); s.start(0, Math.random() * 1.5);
    if (lfoRate) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfoRate; lg.gain.value = lfoDepth; l.connect(lg); lg.connect(lv.gain); l.start(); return [s, l]; }
    return [s];
  }
  const BEDS = {
    sea: (g) => noiseBed(g, 'lowpass', 520, 0.7, 0.11, 0.35, 0.5),
    seaSoft: (g) => noiseBed(g, 'lowpass', 380, 0.7, 0.09, 0.18, 0.22),
    wind: (g) => noiseBed(g, 'bandpass', 420, 0.5, 0.07, 0.12, 0.2),
    rain: (g) => noiseBed(g, 'highpass', 1800, 0.4, 0.5, 0.04, 0.22),
    rainIn: (g) => noiseBed(g, 'lowpass', 900, 0.5, 0.3, 0.04, 0.12),
    room: (g) => noiseBed(g, 'lowpass', 160, 0.6, 0, 0, 0.12),
  };
  /** choose the ambient mix for a place / weather / time (called on travel, weather and time changes) */
  function ambient(o) {
    if (!ctx) return; const key = `${o.area}|${o.wx}|${o.night ? 1 : 0}`; if (key === ambKey) return; ambKey = key;
    const want = {}, area = o.area, P = OC.Places && OC.Places.get(area), inside = P && P.interior;
    if (inside) { want.room = 1; if (o.wx === 'rain') want.rainIn = 1; }
    else { if (area === 'beach') want.sea = 1; else if (area === 'isle') want.seaSoft = 1; if (area === 'forest' || area === 'street' || o.wx === 'fog') want.wind = 1; if (o.wx === 'rain') want.rain = 1; }
    const t0 = T();
    for (const id of Object.keys(BEDS)) {
      const on = !!want[id]; if (!on && !beds[id]) continue; const b = bed(id, BEDS[id]);
      b.g.gain.cancelScheduledValues(t0); b.g.gain.setValueAtTime(Math.max(0.0001, b.g.gain.value), t0); b.g.gain.exponentialRampToValueAtTime(on ? 1 : 0.0001, t0 + 2.2);
    }
    ambState = { area, inside: !!inside, wx: o.wx, night: !!o.night };
  }
  let ambState = null;
  /** occasional birds by day, crickets at night (outdoors, not in the rain) */
  function tick(dt) {
    if (!ctx || !ambState || ambState.inside || ambState.wx === 'rain' || document.hidden || !cfg().on) return;
    birdT -= dt; if (birdT > 0) return;
    if (ambState.night) { birdT = 0.9 + Math.random() * 1.8; for (let i = 0; i < 3; i++) tone('amb', 4200 + Math.random() * 300, { t: i * 0.07, d: 0.04, v: 0.012 }); }
    else if (ambState.area !== 'beach' && ambState.area !== 'street') { birdT = 3 + Math.random() * 6; const f = 2200 + Math.random() * 1400; tone('amb', f, { d: 0.12, v: 0.02, to: f * 1.4, slide: 0.08 }); tone('amb', f * 1.2, { t: 0.15, d: 0.1, v: 0.016, to: f * 0.9, slide: 0.08 }); }
    else birdT = 4;
  }
  function suspend(v) { if (!ctx) return; if (v) ctx.suspend(); else if (unlocked) ctx.resume(); }

  function boot() {
    const first = () => { unlock(); window.removeEventListener('pointerdown', first, true); };
    window.addEventListener('pointerdown', first, true);
    document.addEventListener('visibilitychange', () => suspend(document.hidden));
    // gentle UI feedback for any tap on a control
    document.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('button, .row.tap, .tile, .chip-btn, [role="tab"]'); if (t && !t.disabled) play(t.closest('.tabbar') ? 'tab' : 'tap'); }, true);
    OC.Store.on('coins', (e) => { if (e && e.d > 0) play('coin'); });
  }
  OC.Sound = { boot, init, unlock, play, ambient, tick, apply, cfg, suspend, LIB, get ready() { return !!ctx && unlocked; }, get state() { return ctx ? ctx.state : 'none'; } };
})();
