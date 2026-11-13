/* OC Shimeji — sound (Phase 6). Every sound is synthesised at runtime with WebAudio (original, no sample files,
 * nothing taken from other games). Soft, short, rounded envelopes; never louder than the UI needs.
 *   categories: ui · sfx (characters, objects) · amb (places, weather) · event (cards, levels, fanfares)
 *   settings:   S.settings.sound = { on, master, ui, sfx, amb, event, music, voice }  (0..1)
 *   11.0:       character voices (formant babble per OC, shaped by emotion), stereo placement by screen position,
 *               action / footstep sounds, music intensity layers + stingers, music ducking under speech
 *   de-dup:     the same sound cannot restart within its cooldown, at most 10 voices at once
 *   ambient:    sea / wind / rain / room tone / birds by day / crickets by night — chosen by place, weather, time,
 *               cross-faded; paused when the app is hidden
 * Starts silent until the first touch (browsers / WebViews require a gesture).
 */
(function () {
  'use strict';
  const S = () => OC.Store.s;
  let ctx = null, master = null, bus = {}, noiseBuf = null, unlocked = false, liveEnds = [];
  // live voices are counted by the audio clock (a node is live until its scheduled end), never by main-thread callbacks:
  // a slow frame must not leave the counter stuck at the cap
  const hold = (end) => { liveEnds.push(end); if (liveEnds.length > 48) liveEnds = liveEnds.filter((e) => e > ctx.currentTime); };
  const nv = () => { if (!ctx) return 0; const n = ctx.currentTime; if (liveEnds.length) liveEnds = liveEnds.filter((e) => e > n); return liveEnds.length; };
  // the music has its own pool: a busy arrangement must never use up the voices that characters and effects need (speech is dropped otherwise)
  let musicEnds = [];
  const holdM = (end) => { musicEnds.push(end); if (musicEnds.length > 48) musicEnds = musicEnds.filter((e) => e > ctx.currentTime); };
  const nvM = () => { if (!ctx) return 0; const n = ctx.currentTime; if (musicEnds.length) musicEnds = musicEnds.filter((e) => e > n); return musicEnds.length; };
  const last = {};
  const cfg = () => Object.assign({ on: true, master: 0.8, ui: 0.6, sfx: 0.8, amb: 0.5, event: 0.8, music: 0.45, voice: 0.6 }, S().settings.sound || {});

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.connect(ctx.destination);
    for (const k of ['ui', 'sfx', 'amb', 'event', 'music', 'voice']) { bus[k] = ctx.createGain(); bus[k].connect(master); }
    mfade = ctx.createGain(); mfade.gain.value = 0.0001; mfade.connect(bus.music);
    const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; }   // soft (pinkish) noise
    apply(); return true;
  }
  function apply() { if (!ctx) return; const c = cfg(); master.gain.value = c.on ? c.master : 0; for (const k of Object.keys(bus)) bus[k].gain.value = c[k]; }
  function unlock() { if (!init()) return; if (ctx.state === 'suspended') ctx.resume(); unlocked = true; }

  // ---------------- building blocks ----------------
  const T = () => ctx.currentTime;
  function env(g, t0, a, peak, d, sustainTo = 0.0001) { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a); g.gain.exponentialRampToValueAtTime(sustainTo, t0 + a + d); }
  // 11.0: while a sound plays, curPan (-1..1) places it in the stereo field and curVol scales it (see play(name, {pan, vol}))
  let curPan = 0, curVol = 1;
  function out(cat) { if (!curPan || !ctx.createStereoPanner) return bus[cat]; const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, curPan)); p.connect(bus[cat]); return p; }
  function tone(cat, f, { t = 0, a = 0.006, d = 0.18, v = 0.2, type = 'sine', to = null, slide = 0.08, detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = T() + t; o.type = type; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + slide); o.detune.value = detune;
    env(g, t0, a, v * curVol, d); o.connect(g); g.connect(out(cat)); o.start(t0); o.stop(t0 + a + d + 0.05); hold(t0 + a + d + 0.05);
  }
  function noise(cat, { t = 0, a = 0.004, d = 0.12, v = 0.2, type = 'bandpass', f = 1200, q = 1, to = null } = {}) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = T() + t; s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t0); if (to) fl.frequency.exponentialRampToValueAtTime(to, t0 + a + d); fl.Q.value = q;
    env(g, t0, a, v * curVol, d); s.connect(fl); fl.connect(g); g.connect(out(cat)); s.start(t0, Math.random()); s.stop(t0 + a + d + 0.05); hold(t0 + a + d + 0.05);
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
    // 11.0 touch: fur rustle while stroking, a low purr when the OC melts, small gesture sounds
    stroke: ['sfx', 120, (o) => { const lv = (o && o.lv) || 0; noise('sfx', { d: 0.16, v: 0.028 + lv * 0.02, f: 2400 - lv * 700, to: 1500, q: 0.8 }); }],
    purr: ['sfx', 380, (o) => { const lv = (o && o.lv) || 0.6; tone('sfx', 62 + lv * 14, { d: 0.5, v: 0.05, type: 'triangle' }); tone('sfx', 124 + lv * 28, { t: 0.04, d: 0.4, v: 0.02, type: 'sine' }); noise('sfx', { d: 0.5, v: 0.03, type: 'lowpass', f: 220, q: 0.6 }); }],
    hug: ['sfx', 400, () => { tone('sfx', 392, { d: 0.5, v: 0.06, to: 330, slide: 0.4, type: 'sine' }); bell('sfx', 523.25, 0.12, 0.05, 0.8); }],
    highfive: ['sfx', 200, () => { noise('sfx', { d: 0.07, v: 0.16, f: 3200, q: 0.9 }); tone('sfx', 880, { t: 0.02, d: 0.14, v: 0.08, to: 1320, slide: 0.08, type: 'triangle' }); }],
    poke: ['sfx', 120, () => { tone('sfx', 720, { d: 0.07, v: 0.08, to: 1000, slide: 0.05, type: 'triangle' }); }],
    giggle: ['sfx', 300, () => { [880, 1040, 920, 1100].forEach((f, i) => tone('sfx', f, { t: i * 0.07, d: 0.07, v: 0.045, type: 'triangle' })); }],
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
    // ---- 11.0 interface ----
    open: ['ui', 90, () => { tone('ui', 520, { d: 0.09, v: 0.05, to: 760, slide: 0.08, type: 'triangle' }); tone('ui', 780, { t: 0.05, d: 0.1, v: 0.035, type: 'sine' }); }],
    confirm: ['ui', 120, () => { tone('ui', 660, { d: 0.08, v: 0.06, type: 'triangle' }); tone('ui', 990, { t: 0.07, d: 0.14, v: 0.06, type: 'triangle' }); }],
    on: ['ui', 80, () => { tone('ui', 560, { d: 0.06, v: 0.05, to: 840, slide: 0.05, type: 'triangle' }); }],
    off: ['ui', 80, () => { tone('ui', 560, { d: 0.06, v: 0.05, to: 380, slide: 0.05, type: 'triangle' }); }],
    notify: ['event', 400, () => { bell('event', 1174.7, 0, 0.07, 0.5); bell('event', 1568, 0.11, 0.06, 0.6); }],
    swipe: ['ui', 90, () => noise('ui', { d: 0.14, v: 0.03, f: 1800, to: 3200, q: 0.7 })],
    // ---- 11.0 characters: small body sounds (placed on screen, see action()) ----
    clap: ['sfx', 120, () => { noise('sfx', { d: 0.04, v: 0.1, f: 2600, q: 1.2 }); noise('sfx', { t: 0.14, d: 0.04, v: 0.1, f: 2900, q: 1.2 }); }],
    whoosh: ['sfx', 140, () => noise('sfx', { a: 0.05, d: 0.22, v: 0.05, f: 700, to: 2600, q: 0.8 })],
    sneeze: ['sfx', 500, () => { noise('sfx', { a: 0.14, d: 0.1, v: 0.04, f: 3000, q: 0.8 }); noise('sfx', { t: 0.22, d: 0.16, v: 0.12, f: 1700, to: 800, q: 0.7 }); tone('sfx', 760, { t: 0.22, d: 0.12, v: 0.05, to: 420, slide: 0.1 }); }],
    hiccup: ['sfx', 200, () => { tone('sfx', 340, { d: 0.05, v: 0.08, to: 520, slide: 0.03, type: 'triangle' }); tone('sfx', 520, { t: 0.05, d: 0.07, v: 0.06, to: 300, slide: 0.05, type: 'triangle' }); }],
    yawn: ['sfx', 900, () => { tone('sfx', 420, { a: 0.25, d: 0.9, v: 0.05, to: 240, slide: 1.0, type: 'triangle' }); noise('sfx', { a: 0.3, d: 0.8, v: 0.015, type: 'lowpass', f: 700 }); }],
    sigh: ['sfx', 600, () => { noise('sfx', { a: 0.12, d: 0.6, v: 0.04, type: 'lowpass', f: 1100, to: 380, q: 0.5 }); tone('sfx', 300, { a: 0.1, d: 0.5, v: 0.025, to: 200, slide: 0.5 }); }],
    sniffle: ['sfx', 400, () => { noise('sfx', { d: 0.07, v: 0.05, f: 2800, q: 2 }); noise('sfx', { t: 0.13, d: 0.07, v: 0.05, f: 2600, q: 2 }); tone('sfx', 520, { t: 0.2, d: 0.2, v: 0.03, to: 360, slide: 0.2, type: 'triangle' }); }],
    snore: ['sfx', 2500, () => { noise('sfx', { a: 0.5, d: 0.9, v: 0.035, type: 'lowpass', f: 260, q: 1.2 }); tone('sfx', 96, { a: 0.5, d: 0.8, v: 0.04, type: 'triangle' }); }],
    knock: ['sfx', 200, () => { for (let i = 0; i < 3; i++) { tone('sfx', 210, { t: i * 0.14, d: 0.07, v: 0.11, to: 150, slide: 0.05 }); noise('sfx', { t: i * 0.14, d: 0.03, v: 0.06, f: 900, q: 1.5 }); } }],
    shiver: ['sfx', 300, () => { for (let i = 0; i < 6; i++) tone('sfx', 1500 + (i % 2) * 140, { t: i * 0.045, d: 0.03, v: 0.025 }); }],
    dizzy: ['sfx', 600, () => { tone('sfx', 420, { d: 0.9, v: 0.04, to: 300, slide: 0.9, type: 'triangle', detune: 30 }); tone('sfx', 428, { d: 0.9, v: 0.035, to: 306, slide: 0.9, type: 'triangle', detune: -30 }); }],
    trip: ['sfx', 400, () => { tone('sfx', 520, { d: 0.12, v: 0.07, to: 220, slide: 0.1, type: 'triangle' }); tone('sfx', 160, { t: 0.14, d: 0.12, v: 0.1, to: 100, slide: 0.1 }); noise('sfx', { t: 0.14, d: 0.05, v: 0.05, f: 500 }); }],
    shutter: ['sfx', 400, () => { noise('sfx', { d: 0.03, v: 0.09, f: 3500, q: 1.5 }); noise('sfx', { t: 0.07, d: 0.04, v: 0.07, f: 2400, q: 1.5 }); }],
    aha: ['sfx', 400, () => { bell('sfx', 1318.5, 0, 0.09, 0.5); tone('sfx', 1976, { t: 0.08, d: 0.2, v: 0.04 }); }],
    drum: ['sfx', 150, () => { tone('sfx', 150, { d: 0.14, v: 0.12, to: 80, slide: 0.1 }); noise('sfx', { d: 0.04, v: 0.04, f: 1500 }); }],
    cheer: ['sfx', 500, () => { [523, 659, 784, 1046].forEach((f, i) => tone('sfx', f, { t: i * 0.07, d: 0.16, v: 0.06, type: 'triangle' })); }],
    wish: ['event', 500, () => { for (let i = 0; i < 5; i++) tone('event', 1400 + i * 260, { t: i * 0.07, d: 0.3, v: 0.035 }); }],
    slap: ['sfx', 200, () => { noise('sfx', { d: 0.05, v: 0.09, f: 1800, q: 1 }); tone('sfx', 240, { d: 0.08, v: 0.06, to: 160, slide: 0.06 }); }],
    rustle: ['sfx', 250, () => { noise('sfx', { a: 0.02, d: 0.34, v: 0.06, f: 3200, to: 1500, q: 0.6 }); noise('sfx', { t: 0.09, a: 0.02, d: 0.28, v: 0.05, f: 2600, to: 1200, q: 0.7 }); tone('sfx', 190, { t: 0.01, d: 0.1, v: 0.03, to: 120, slide: 0.08 }); }],
    ping: ['ui', 120, () => { tone('ui', 880, { d: 0.12, v: 0.035, to: 1180, slide: 0.07, type: 'sine' }); }],
    sparkleStep: ['sfx', 200, () => tone('sfx', 2200 + Math.random() * 800, { d: 0.1, v: 0.02 })],
    // footsteps by ground (very quiet; see foot())
    foot_grass: ['sfx', 60, () => noise('sfx', { d: 0.07, v: 0.02, type: 'lowpass', f: 900, q: 0.6 })],
    foot_sand: ['sfx', 60, () => noise('sfx', { d: 0.09, v: 0.018, type: 'bandpass', f: 1500, to: 900, q: 0.6 })],
    foot_wood: ['sfx', 60, () => { tone('sfx', 170 + Math.random() * 30, { d: 0.05, v: 0.035, to: 120, slide: 0.04 }); noise('sfx', { d: 0.02, v: 0.015, f: 1000, q: 1 }); }],
    foot_stone: ['sfx', 60, () => { noise('sfx', { d: 0.03, v: 0.03, f: 1500 + Math.random() * 300, q: 1.4 }); tone('sfx', 260, { d: 0.03, v: 0.012 }); }],
    foot_leaf: ['sfx', 60, () => noise('sfx', { d: 0.08, v: 0.022, type: 'highpass', f: 2600, q: 0.5 })],
  };
  /** play a sound by name (respects settings, cooldowns and the voice cap) */
  function play(name, o = {}) {
    const L = LIB[name]; if (!L || !ctx || !unlocked || !cfg().on) return false;
    if (ctx.state !== 'running' || document.hidden) return false;
    const now = performance.now(); if (now - (last[name] || 0) < L[1]) return false; last[name] = now;
    if (nv() > 10) return false;
    curPan = o.pan || 0; curVol = o.vol == null ? 1 : o.vol;
    try { L[2](o); } catch (e) { return false; } finally { curPan = 0; curVol = 1; }
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
    else { if (area === 'beach') want.sea = 1; else if (area === 'isle') want.seaSoft = 1; if (area === 'forest' || area === 'street' || area === 'hill' || o.wx === 'fog') want.wind = 1; if (o.wx === 'rain') want.rain = 1; }
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
  // ================= 11.0 character voices =================
  // A short formant "babble" for every spoken line: one sawtooth through two band-pass filters whose centres glide between
  // vowels, one syllable per character (punctuation = pauses, ？ rises, … sinks). The base pitch, timbre and vibrato come
  // from the OC itself (id, height, energy, speaking pace); the mood bends pitch, speed, loudness and brightness.
  // Entirely synthesised — no samples, no recordings, nothing from any other game.
  const hs = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const VOW = [[780, 1180], [560, 1820], [340, 2250], [480, 860], [360, 780]];   // a e i o u  (F1, F2)
  const VEMO = {
    neutral: { p: 1, r: 1, up: 0, vol: 1, br: 1 }, happy: { p: 1.1, r: 1.08, up: 0.12, vol: 1, br: 1.2 }, excited: { p: 1.16, r: 1.22, up: 0.2, vol: 1.1, br: 1.35 },
    calm: { p: 0.98, r: 0.9, up: 0, vol: 0.8, br: 0.8 }, content: { p: 1.02, r: 0.9, up: 0.04, vol: 0.85, br: 0.85 }, proud: { p: 1.05, r: 0.95, up: 0.06, vol: 1, br: 1.1 },
    shy: { p: 1.07, r: 0.9, up: 0.05, vol: 0.62, br: 0.7, wob: 1, breath: 1 }, nervous: { p: 1.08, r: 1.12, up: 0.06, vol: 0.75, br: 0.9, wob: 1.4 },
    bored: { p: 0.93, r: 0.8, up: -0.06, vol: 0.7, br: 0.6 }, tired: { p: 0.9, r: 0.72, up: -0.1, vol: 0.6, br: 0.5, breath: 0.6 },
    lonely: { p: 0.9, r: 0.8, up: -0.12, vol: 0.68, br: 0.6, wob: 0.6 }, down: { p: 0.86, r: 0.74, up: -0.16, vol: 0.62, br: 0.55, wob: 0.5 },
    jealous: { p: 0.96, r: 1.05, up: -0.03, vol: 0.95, br: 1.1 }, annoyed: { p: 0.94, r: 1.15, up: -0.05, vol: 1.1, br: 1.5, harsh: 1 },
    confused: { p: 1.03, r: 0.95, up: 0.14, vol: 0.9, br: 0.9 }, curious: { p: 1.08, r: 1.05, up: 0.16, vol: 0.95, br: 1.1 }, surprised: { p: 1.18, r: 1.2, up: 0.28, vol: 1.1, br: 1.2 },
  };
  /** a stable voice per OC */
  function voiceOf(c) {
    const h = hs((c && (c.id || (c.profile && c.profile.name))) || 'x'), P = (c && c.personality) || {}, Sp = (c && c.speech) || {};
    let f0 = 175 + (h % 997) / 997 * 170;                                                  // 175–345 Hz
    const ht = Math.max(0.6, Math.min(1.6, (c && c.profile && +c.profile.height) || 1)); f0 /= Math.pow(ht, 0.55);   // taller → lower
    f0 *= 1 + ((P.energy == null ? 50 : P.energy) - 50) / 500;
    return { f0, kind: ['sawtooth', 'triangle', 'sawtooth', 'square'][(h >> 8) & 3], bright: 0.55 + ((h >> 12) % 100) / 220, vib: 0.008 + ((h >> 4) % 7) / 200, rate: Sp.pace === 'fast' ? 1.2 : Sp.pace === 'slow' ? 0.82 : 1 };
  }
  /** split a line into syllables / pauses (capped, so a long line is a short babble, not a lecture) */
  function syllables(text) {
    const out = []; let end = '';
    for (const ch of [...String(text).replace(/\{[^}]*\}/g, '')]) {
      const cp = ch.codePointAt(0);
      if (/\s/.test(ch) || cp > 0x2600 && cp < 0x2800 || cp > 0x1f000) continue;
      if (/[，、,;；:：]/.test(ch)) { out.push({ pause: 0.6 }); continue; }
      if (/[。.！!？?…～~]/.test(ch)) { out.push({ pause: 1 }); end = ch; continue; }
      if (/[A-Za-z0-9]/.test(ch) && out.length && out[out.length - 1].lat) continue;   // two latin letters = one syllable
      out.push({ v: cp % 5, on: (cp >> 3) % 3, lat: /[A-Za-z0-9]/.test(ch) }); end = '';
    }
    const syl = out.filter((x) => !x.pause), CAP = 14;
    if (syl.length > CAP) { const keep = new Set(); for (let i = 0; i < CAP; i++) keep.add(syl[Math.floor(i * syl.length / CAP)]); return { list: out.filter((x) => x.pause || keep.has(x)), end }; }
    return { list: out, end };
  }
  let lastSpeak = 0, duckT = 0;
  /** voice a line for character `c`; returns its length in seconds (0 = silent). o = { emo, pan, vol } */
  function speak(c, text, o = {}) {
    if (!ctx || !unlocked || !cfg().on || cfg().voice <= 0.01 || ctx.state !== 'running' || document.hidden || nv() > 14) return 0;
    const now = performance.now(); if (now - lastSpeak < 200) return 0; lastSpeak = now;
    const { list, end } = syllables(text); if (!list.some((x) => !x.pause)) return 0;
    const vc = voiceOf(c), emo = VEMO[o.emo] || VEMO.neutral, n = list.filter((x) => !x.pause).length;
    const f0 = vc.f0 * emo.p, step = 0.092 / (vc.rate * emo.r), t0 = T() + 0.03, peak = 0.5 * (o.vol == null ? 1 : o.vol) * emo.vol;
    curPan = o.pan || 0;
    try {
      const osc = ctx.createOscillator(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g1 = ctx.createGain(), g2 = ctx.createGain(), amp = ctx.createGain(), lp = ctx.createBiquadFilter();
      osc.type = vc.kind; f1.type = f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 8; g1.gain.value = 1.0; g2.gain.value = 0.55 * vc.bright * emo.br;
      lp.type = 'lowpass'; lp.frequency.value = Math.min(6500, 2600 * vc.bright * emo.br + 900); amp.gain.value = 0.0001;
      osc.connect(f1); osc.connect(f2); f1.connect(g1); f2.connect(g2); g1.connect(amp); g2.connect(amp); amp.connect(lp); lp.connect(out('voice'));
      // vibrato (the shy / sad / nervous voices wobble a little more)
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2 + (emo.wob || 0) * 1.8; lg.gain.value = f0 * (vc.vib + (emo.wob || 0) * 0.012); lfo.connect(lg); lg.connect(osc.frequency);
      let t = t0, i = 0, tEnd = t0;
      for (const sy of list) {
        if (sy.pause) { t += step * sy.pause * (end === '…' ? 1.6 : 1); continue; }
        const k = i / Math.max(1, n - 1); i++;
        let f = f0 * (1 + Math.sin(i * 0.9 + (hs(text) % 7)) * 0.055 + emo.up * (k - 0.3));
        if (end === '？' || end === '?') f *= 1 + 0.28 * Math.max(0, (k - 0.55) / 0.45);
        else if (end === '…') f *= 1 - 0.14 * k;
        else if ((end === '！' || end === '!') && i === 1) f *= 1.1;
        const vw = VOW[sy.v], dur = step * (end === '…' && k > 0.8 ? 1.5 : 1);
        osc.frequency.setTargetAtTime(f, t, 0.012); f1.frequency.setTargetAtTime(vw[0] * (0.9 + vc.bright * 0.2), t, 0.012); f2.frequency.setTargetAtTime(vw[1] * (0.9 + vc.bright * 0.15), t, 0.012);
        amp.gain.setTargetAtTime(peak * (0.75 + 0.25 * Math.sin(i * 1.7) ** 2), t, 0.01); amp.gain.setTargetAtTime(peak * 0.12, t + dur * 0.62, 0.012);
        if (sy.on === 1) noise('voice', { t: t - T(), d: 0.03, v: 0.06 * emo.vol, f: 3600, q: 1.1 });                 // a soft consonant puff
        if (emo.breath && sy.on !== 2) noise('voice', { t: t - T(), d: 0.07, v: 0.025 * emo.breath, type: 'highpass', f: 4200 });
        t += dur; tEnd = t;
      }
      amp.gain.setTargetAtTime(0.0001, tEnd, 0.03);
      osc.start(t0); lfo.start(t0); osc.stop(tEnd + 0.15); lfo.stop(tEnd + 0.15); hold(tEnd + 0.15);
      duck(tEnd - t0 + 0.4);
      return tEnd - t0;
    } catch (e) { return 0; } finally { curPan = 0; }
  }
  /** music steps back (to ~55 %) while somebody is talking, then returns */
  function duck(sec) {
    if (!ctx || !bus.music) return; const c = cfg(), t = T();
    bus.music.gain.cancelScheduledValues(t); bus.music.gain.setTargetAtTime(c.music * 0.55, t, 0.07); bus.music.gain.setTargetAtTime(c.music, t + sec, 0.45);
  }

  // ---------------- 11.0 world placement, body sounds, footsteps ----------------
  /** where on the screen is this actor → stereo pan and loudness (null = off-screen / not the island view) */
  function placement(a) {
    try {
      const W = OC.World, A = OC.App; if (A && A.curTab && A.curTab !== 'island') return null;
      if (!W || !a || a.x == null) return { pan: 0, vol: 1 };
      const p = W.project(a.x, a.y, a.lvl || 0, 20), w = innerWidth || 393, h = innerHeight || 852;
      if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) return null;
      return { pan: Math.max(-0.8, Math.min(0.8, (p.x - w / 2) / (w / 2) * 0.8)), vol: A && A.player === a ? 1 : 0.65 };
    } catch (e) { return { pan: 0, vol: 1 }; }
  }
  const ACT_SND = { clap: 'clap', highfive: 'clap', wave: 'whoosh', wave_far: 'whoosh', spin: 'whoosh', flip: 'whoosh', swish: 'whoosh', sweep: 'whoosh', roll: 'whoosh', blow: 'whoosh', shoo: 'whoosh',
    sneeze: 'sneeze', hiccup: 'hiccup', yawn: 'yawn', stretch: 'yawn', stretch2: 'yawn', stretchcat: 'yawn', sigh: 'sigh', sulk: 'sigh', sad: 'sniffle', worried: 'sniffle', knock: 'knock', stomp: 'bonk', hurt: 'bonk',
    shiver: 'shiver', dizzy: 'dizzy', trip: 'trip', photo: 'shutter', selfie: 'shutter', aha: 'aha', drum: 'drum', cheer: 'cheer', wish: 'wish', facepalm: 'slap', jump: 'jump', giggle: 'giggle', sleep: 'snore',
    thumbsup: 'sparkleStep', peace: 'sparkleStep', eat: 'chew', drink: 'gulp', hug: 'hug', poked: 'poke', dig: 'chop', cast: 'whoosh', reel: 'reel', wash: 'water' };
  /** an actor starts an action → its little body sound, placed on the screen */
  function action(a, name) {
    const snd = ACT_SND[name]; if (!snd || !ctx || !unlocked) return false;
    const at = placement(a); if (!at) return false;
    return play(snd, { pan: at.pan, vol: at.vol });
  }
  const GROUND = { isle: 'grass', forest: 'leaf', beach: 'sand', street: 'stone', home: 'wood', cafe: 'wood', library: 'wood', hill: 'grass', fair: 'stone' };
  let footT = 0;
  /** one footstep (called from the walk cycle); quiet, by ground, panned to where the OC is */
  function foot(a) {
    if (!ctx || !unlocked) return null; const now = performance.now(); if (now - footT < 120) return null;
    const at = placement(a); if (!at) return null; const area = OC.World && OC.World.area ? OC.World.area.id : 'isle';
    const name = 'foot_' + (GROUND[area] || 'grass'); footT = now;
    return play(name, { pan: at.pan, vol: at.vol * (a.run ? 1.4 : 0.9) * (a.lift > 0 ? 0 : 1) }) ? name : null;
  }

  // ================= 8.0 music: original, generated live (no recordings) =================
  // Each mood = tempo, key, a 4-chord loop and an instrument set. A 2-bar motif is generated per section and repeated
  // with small variations (A A' B A), so it sounds like a tune rather than random notes. Scheduled ~0.6 s ahead on the
  // audio clock (setInterval only feeds the audio scheduler; no game logic depends on it).
  let mfade = null, mood = null, mTimer = 0, mNext = 0, mBeat = 0, motif = null, motifB = null, section = 0;
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const MOODS = {
    title: { bpm: 84, root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], lead: 'bell', pad: 0.05, density: 0.55 },
    day: { bpm: 96, root: 62, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], lead: 'pluck', pad: 0.04, density: 0.62 },
    dusk: { bpm: 78, root: 57, scale: [0, 2, 3, 7, 10], chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], lead: 'pluck', pad: 0.05, density: 0.45 },
    night: { bpm: 66, root: 64, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [-3, 0, 4], [-8, -5, -1], [-5, -1, 2]], lead: 'box', pad: 0.035, density: 0.35 },
    rain: { bpm: 70, root: 55, scale: [0, 2, 3, 5, 7, 10], chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], lead: 'piano', pad: 0.045, density: 0.4 },
    minigame: { bpm: 112, root: 65, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [7, 11, 14], [-3, 0, 4], [5, 9, 12]], lead: 'pluck', pad: 0.03, density: 0.72 },
    cozy: { bpm: 72, root: 58, scale: [0, 2, 4, 5, 7, 9, 11], chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-5, -1, 2, 5], [2, 5, 9, 12]], lead: 'box', pad: 0.04, density: 0.4 },
    indoor: { bpm: 88, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [2, 5, 9, 12], [-5, -1, 2, 5]], lead: 'piano', pad: 0.035, density: 0.5 },
  };
  function voice(kind, f, t, d, v) {
    if (!ctx || nvM() > 26) return;
    const g = ctx.createGain(), o = ctx.createOscillator(); g.connect(mfade);
    if (kind === 'pad') { o.type = 'triangle'; const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 1.004; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; o.connect(lp); o2.connect(lp); lp.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + d * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + d); o2.start(t); o2.stop(t + d + 0.05); }
    else { o.type = kind === 'bell' || kind === 'box' ? 'sine' : kind === 'piano' ? 'triangle' : 'sine'; o.connect(g);
      const h2 = ctx.createOscillator(), g2 = ctx.createGain(); h2.type = 'sine'; h2.frequency.value = f * (kind === 'bell' ? 2.76 : kind === 'box' ? 4 : 2); g2.gain.value = kind === 'pluck' ? 0.25 : 0.18; h2.connect(g2); g2.connect(g); h2.start(t); h2.stop(t + d + 0.05);
      const dec = kind === 'bell' || kind === 'box' ? d * 1.6 : kind === 'piano' ? d * 1.2 : d * 0.8;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); }
    o.frequency.value = f; o.start(t); o.stop(t + d * 1.7 + 0.1); holdM(t + d * 1.7 + 0.1);
  }
  function makeMotif(m) { const out = []; let deg = Math.floor(Math.random() * m.scale.length); for (let i = 0; i < 16; i++) { if (Math.random() > m.density) { out.push(null); continue; } deg = Math.max(0, Math.min(m.scale.length * 2 - 1, deg + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)])); out.push(deg); } if (out.every((x) => x == null)) out[0] = 0; return out; }
  function degNote(m, deg) { const n = m.scale.length; return m.root + 12 + m.scale[deg % n] + 12 * Math.floor(deg / n); }
  function schedule() {
    if (!ctx || !mood || !cfg().on || cfg().music <= 0 || document.hidden) return;
    const m = MOODS[mood], beat = 60 / m.bpm, eighth = beat / 2;
    while (mNext < ctx.currentTime + 0.6) {
      const t = Math.max(mNext, ctx.currentTime + 0.02), step = mBeat % 32, bar = Math.floor(mBeat / 8) % 4, ch = m.chords[bar];
      if (mBeat % 32 === 0) { section++; if (!motif || section % 4 === 1) motif = makeMotif(m); if (!motifB || section % 8 === 3) motifB = makeMotif(m); }
      if (mBeat % 8 === 0) { for (const iv of ch.slice(0, 3)) voice('pad', NOTE(m.root + iv), t, beat * 4.1, m.pad); voice('pluck', NOTE(m.root - 12 + ch[0]), t, beat * 1.4, 0.05); }
      if (mBeat % 8 === 4 && mood !== 'night') voice('pluck', NOTE(m.root - 12 + ch[0] + 7), t, beat, 0.035);
      // A A' B A: the second pass varies one note, the third uses the B motif
      const sec = section % 4, src = sec === 2 ? motifB : motif, deg = src[step % 16];
      if (deg != null && !(sec === 1 && step % 16 === 13)) voice(m.lead, NOTE(degNote(m, deg + (sec === 1 && step % 16 === 6 ? 1 : 0))), t, eighth * 1.6, m.lead === 'box' ? 0.05 : 0.06);
      // 11.0 intensity layers: 1 = a soft shaker + answering bells on the rests, 2 = a gentle kick on the beats too
      if (intensity >= 1 && mood !== 'night') {
        perc(t, mBeat % 2 ? 0.045 : 0.026);
        if (deg == null && mBeat % 2 === 1 && (mBeat * 7) % 5 < 2) voice('bell', NOTE(degNote(m, (motif[(step + 5) % 16] == null ? 2 : motif[(step + 5) % 16])) + 12), t, eighth * 1.4, 0.03);
        if (intensity >= 2 && mBeat % 4 === 0) kick(t);
      }
      mNext += eighth; mBeat++;
    }
  }
  let intensity = 0; const stats = { perc: 0, kick: 0 };
  /** 0 calm · 1 lively · 2 festive — the app sets it from the mood of the OC, mini-games and events */
  let intLock = 0;
  /** `holdMs` keeps this level against the app's own mood-based updates for that long (a performance, a party) */
  function setIntensity(i, holdMs) { const now = performance.now(); if (!holdMs && now < intLock) return; if (holdMs) intLock = now + holdMs; intensity = Math.max(0, Math.min(2, i | 0)); }
  function perc(t, v) { if (!ctx || nvM() > 26) return; stats.perc++; const s2 = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); s2.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 6000; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0002, t + 0.05); s2.connect(hp); hp.connect(g); g.connect(mfade); s2.start(t, Math.random()); s2.stop(t + 0.07); holdM(t + 0.07); }
  function kick(t) { if (!ctx || nvM() > 26) return; stats.kick++; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.11); g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0002, t + 0.16); o.connect(g); g.connect(mfade); o.start(t); o.stop(t + 0.18); holdM(t + 0.18); }
  /** a short phrase in the key of the current music: 'win' (up), 'warm' (settles), 'wonder' (sparkle) */
  function stinger(kind, delay = 0) {
    if (!ctx || !unlocked || !cfg().on || document.hidden) return false;
    const m = MOODS[mood || 'day'], sc = m.scale, root = m.root + 12, seq = { win: [0, 2, 4, 7], warm: [4, 2, 0], wonder: [0, 3, 5, 7, 9] }[kind] || [0, 2, 4];
    seq.forEach((d, i) => tone('event', NOTE(root + sc[d % sc.length] + 12 * Math.floor(d / sc.length)), { t: delay + i * 0.1, d: kind === 'warm' ? 0.5 : 0.28, v: 0.07, type: 'triangle' }));
    duck(1.2 + delay); stats.sting = stats.sting || {}; stats.sting[kind] = (stats.sting[kind] || 0) + 1; return true;
  }
  /** 12.0: the few moments that earn a short phrase in the key of the music — one table, one cool-down (never two phrases on top of each other),
   *  nothing while sound is off / the page is hidden / the game is catching up offline. `delay` lets the small sound effect of the same moment finish first. */
  const CUES = { skill: ['win', 0.25], asp: ['win', 0.3], claim: ['win', 0.15], mini: ['win', 0.2], req: ['warm', 0.2], relUp: ['warm', 0.4], reconcile: ['warm', 0.3], photo: ['warm', 0.2], discover: ['wonder', 0.2], taste: ['wonder', 0.2] };
  let cueAt = -1e9; stats.cues = {};
  function cue(name) {
    const c = CUES[name]; if (!c || !ctx || !unlocked || !cfg().on || document.hidden || (OC.Sim && OC.Sim.catching)) return false;
    const now = performance.now(); if (now - cueAt < 3000) return false;   // real time: a suspended audio clock must not freeze the cool-down
    if (!stinger(c[0], c[1])) return false; cueAt = now; stats.cues[name] = (stats.cues[name] || 0) + 1; stats.lastCue = name; return true;
  }
  /** choose the background music: title | day | dusk | night | rain | indoor | null (silence). Cross-fades over ~1.5 s */
  function music(want) {
    if (!init()) { mood = want; return; }
    if (want === mood) return;
    const t0 = ctx.currentTime;
    mfade.gain.cancelScheduledValues(t0); mfade.gain.setValueAtTime(Math.max(0.0001, mfade.gain.value), t0); mfade.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
    setTimeout(() => { mood = want; if (!ctx || !want) return; mBeat = 0; section = 0; motif = motifB = null; mNext = ctx.currentTime + 0.1; const t1 = ctx.currentTime; mfade.gain.cancelScheduledValues(t1); mfade.gain.setValueAtTime(0.0001, t1); mfade.gain.exponentialRampToValueAtTime(1, t1 + 2.5); }, 1250);
    if (!mTimer) mTimer = setInterval(schedule, 150);
  }
  /** pick the mood from place / weather / time (app calls this when they change) */
  function musicFor(o) { const P = OC.Places && OC.Places.get(o.area); if (o.mini) return 'minigame'; return P && P.interior ? (o.phase === 'night' ? 'cozy' : 'indoor') : o.wx === 'rain' ? 'rain' : o.phase === 'night' ? 'night' : o.phase === 'dusk' ? 'dusk' : 'day'; }

  function suspend(v) { if (!ctx) return; if (v) ctx.suspend(); else if (unlocked) ctx.resume(); }

  function boot() {
    const first = () => { unlock(); window.removeEventListener('pointerdown', first, true); };
    window.addEventListener('pointerdown', first, true);
    document.addEventListener('visibilitychange', () => suspend(document.hidden));
    // gentle UI feedback for any tap on a control
    document.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('button, .row.tap, .tile, .chip-btn, [role="tab"]'); if (t && !t.disabled) play(t.closest('.tabbar') ? 'tab' : 'tap'); }, true);
    OC.Store.on('coins', (e) => { if (e && e.d > 0) play('coin'); });
    OC.Store.on('life:relUp', () => cue('relUp'));   // 12.0: two OCs grow closer (a friendship, a best friend)
  }
  OC.Sound = { boot, init, unlock, play, ambient, tick, apply, cfg, suspend, LIB, music, musicFor, speak, voiceOf, VEMO, duck, action, foot, placement, setIntensity, stinger, cue, CUES, ACT_SND, get intensity() { return intensity; }, get stats() { return stats; }, _tap() { return ctx ? { ctx, master, bus } : null; }, get voices() { return nv(); }, get musicVoices() { return nvM(); }, get mood() { return mood; }, MOODS, get ready() { return !!ctx && unlocked; }, get state() { return ctx ? ctx.state : 'none'; } };
})();
