/* OC Shimeji 12.0 — OC.PetSound: the little sounds of a desktop pet.
 * Each OC gets its own set of short clips (a tap blip, a purr, a babble of 2–4 syllables, a jump, a landing, a munch …) synthesised
 * offline (OfflineAudioContext, 22 050 Hz, mono) from the OC's own voice (OC.Sound.voiceOf: pitch, waveform, brightness) and exported as
 * tiny 16-bit WAV files over the bridge (OCNative.petSounds). The phone plays them with SoundPool — so the desktop pet sounds like the
 * same character as in the game, with no stock sound and no network. When to play which clip is decided natively (core:pet PetSound,
 * unit-tested); the list below must equal PetSound.CLIPS (a test reads the Kotlin file and compares).
 * Everything is deterministic: the same OC and voice always render the same bytes (so a re-export is skipped when nothing changed).
 */
(function () {
  'use strict';
  const SR = 22050;
  /** file names (without .wav) — the contract with android/core/pet/PetSound.kt */
  const CLIPS = ['tap_a', 'tap_b', 'purr', 'wake', 'jump', 'land', 'whoosh', 'talk_a', 'talk_b', 'talk_c', 'munch', 'gift', 'meet_good', 'meet_bad'];
  const ZH = { tap_a: '點一下（上揚）', tap_b: '點一下（下滑）', purr: '被摸摸（呼嚕）', wake: '醒來', jump: '跳起來', land: '落地', whoosh: '被丟出去', talk_a: '說話（一）', talk_b: '說話（二）', talk_c: '說話（三）', munch: '吃東西', gift: '收到禮物', meet_good: '碰面（開心）', meet_bad: '碰面（鬧彆扭）' };
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const prng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /** the voice of one OC for the desktop (pitch is moved into a range small speakers play well) */
  function voice(c) {
    const v = OC.Sound && OC.Sound.voiceOf ? OC.Sound.voiceOf(c) : { f0: 240, kind: 'triangle', bright: 0.8, vib: 0.01, rate: 1 };
    return { f0: Math.max(220, Math.min(520, v.f0 * 1.35)), kind: v.kind === 'sawtooth' ? 'triangle' : v.kind === 'square' ? 'triangle' : v.kind, bright: v.bright, vib: v.vib, rate: v.rate || 1 };
  }

  // ---- recipes: each schedules nodes on an OfflineAudioContext and returns the clip length in seconds
  function R(ctx, v, rnd) {
    const noiseBuf = (() => { const b = ctx.createBuffer(1, SR, SR), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; return b; })();
    const out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination);
    const lp = (f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = 'lowpass'; n.frequency.value = f; n.Q.value = q; return n; };
    const tone = (t, f0, f1, d, vol, type, o = {}) => {
      const os = ctx.createOscillator(), g = ctx.createGain(), fl = lp(o.cut || (1200 + v.bright * 3200));
      os.type = type || v.kind; os.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) os.frequency.exponentialRampToValueAtTime(f1, t + d);
      if (v.vib > 0 && !o.noVib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = f0 * v.vib; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + d + 0.05); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, d * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      os.connect(fl); fl.connect(g); g.connect(out); os.start(t); os.stop(t + d + 0.03); return t + d;
    };
    const noise = (t, d, vol, f, q, type) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q || 1;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(fl); fl.connect(g); g.connect(out); s.start(t); s.stop(t + d + 0.02); return t + d;
    };
    const f0 = v.f0;
    return {
      tap_a() { return tone(0, f0 * 1.5, f0 * 1.95, 0.09, 0.5); },
      tap_b() { return tone(0, f0 * 1.3, f0 * 0.98, 0.11, 0.5); },
      purr() {   // a low buzz, amplitude-modulated at ~24 Hz, fading in and out
        const os = ctx.createOscillator(), g = ctx.createGain(), am = ctx.createOscillator(), ag = ctx.createGain(), fl = lp(520);
        os.type = 'sawtooth'; os.frequency.value = Math.max(70, f0 / 3.2); am.frequency.value = 22 + rnd() * 5; ag.gain.value = 0.35; g.gain.value = 0.35; am.connect(ag); ag.connect(g.gain);
        const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, 0); env.gain.exponentialRampToValueAtTime(0.9, 0.12); env.gain.setValueAtTime(0.9, 0.5); env.gain.exponentialRampToValueAtTime(0.0001, 0.7);
        os.connect(fl); fl.connect(g); g.connect(env); env.connect(out); os.start(0); am.start(0); os.stop(0.72); am.stop(0.72); return 0.72;
      },
      wake() { tone(0, f0 * 1.0, f0 * 1.1, 0.1, 0.5); return tone(0.14, f0 * 1.5, f0 * 1.6, 0.14, 0.5); },
      jump() { return tone(0, f0 * 1.0, f0 * 2.3, 0.17, 0.5, 'sine'); },
      land() { noise(0, 0.1, 0.6, 520, 0.8, 'lowpass'); return tone(0, 120, 70, 0.14, 0.7, 'sine', { cut: 400, noVib: true }); },
      whoosh() { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; fl.type = 'bandpass'; fl.Q.value = 1.4; fl.frequency.setValueAtTime(420, 0); fl.frequency.exponentialRampToValueAtTime(2600, 0.22); fl.frequency.exponentialRampToValueAtTime(500, 0.52);
        g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.55, 0.15); g.gain.exponentialRampToValueAtTime(0.0001, 0.55); s.connect(fl); fl.connect(g); g.connect(out); s.start(0); s.stop(0.58); return 0.55; },
      munch() { let t = 0; for (let i = 0; i < 4; i++) { noise(t, 0.07, 0.5, 1700 + rnd() * 500, 1.2); tone(t, 180 + rnd() * 40, 120, 0.05, 0.25, 'sine', { noVib: true }); t += 0.11; } return t; },
      gift() { let t = 0; for (const r of [1, 1.26, 1.5, 2]) { tone(t, f0 * r, null, 0.12, 0.4, 'triangle'); t += 0.075; } noise(t - 0.1, 0.25, 0.08, 6000, 0.8, 'highpass'); return t + 0.2; },
      meet_good() { tone(0, f0 * 1.0, null, 0.26, 0.4, 'triangle'); return tone(0.12, f0 * 1.5, null, 0.34, 0.4, 'triangle'); },
      meet_bad() { tone(0, f0 * 0.9, f0 * 0.86, 0.28, 0.4, 'triangle', { cut: 900 }); return tone(0.2, f0 * 0.75, f0 * 0.7, 0.36, 0.4, 'triangle', { cut: 800 }); },
      /** a short babble: n syllables with their own pitch contour (rising question / falling statement / even) */
      talk(kind) {
        const n = kind === 'c' ? 4 : kind === 'b' ? 2 : 3, contour = kind === 'a' ? 1 : kind === 'b' ? -1 : 0; let t = 0;
        for (let i = 0; i < n; i++) {
          const k = i / Math.max(1, n - 1), pitch = f0 * (1 + 0.28 * contour * (k - 0.3) + (rnd() - 0.5) * 0.16), d = 0.07 + rnd() * 0.05;
          tone(t, pitch, pitch * (1 + (rnd() - 0.45) * 0.14), d, 0.42, v.kind, { cut: 900 + v.bright * 2600 }); t += d + 0.025 + rnd() * 0.02;
        } return t;
      },
    };
  }
  const recipe = (r, name) => name.startsWith('talk_') ? () => r.talk(name.slice(5)) : r[name];

  /** render one clip → Float32Array (mono), peak-normalised to 0.8 with a 6 ms fade in/out so it never clicks */
  async function render(name, v, seed) {
    if (!CLIPS.includes(name)) throw new Error('unknown clip ' + name);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) throw new Error('no OfflineAudioContext');
    const ctx = new OAC(1, Math.round(SR * 1.2), SR), r = R(ctx, v, prng(hash(seed + ':' + name)));
    const len = Math.min(1.1, Math.max(0.05, recipe(r, name)() + 0.04));
    const buf = await ctx.startRendering(), full = buf.getChannelData(0), n = Math.min(full.length, Math.round(len * SR)), d = new Float32Array(n);
    let pk = 0; for (let i = 0; i < n; i++) { d[i] = full[i]; pk = Math.max(pk, Math.abs(d[i])); }
    const g = pk > 1e-4 ? 0.8 / pk : 0, fade = Math.round(0.006 * SR);
    for (let i = 0; i < n; i++) { let e = 1; if (i < fade) e = i / fade; else if (n - 1 - i < fade) e = (n - 1 - i) / fade; d[i] *= g * e; }
    return d;
  }
  /** 16-bit PCM mono WAV */
  function wav(f32) {
    const n = f32.length, b = new ArrayBuffer(44 + n * 2), dv = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, f32[i])) * 32767, true);
    return b;
  }
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  /** every clip of one OC: { clips: {name: 'data:audio/wav;base64,…'}, bytes, ms } */
  async function renderAll(c) {
    const t0 = performance.now(), v = voice(c), clips = {}; let bytes = 0;
    for (const nm of CLIPS) { const f = await render(nm, v, c.id), buf = wav(f); clips[nm] = 'data:audio/wav;base64,' + b64(buf); bytes += buf.byteLength; }
    return { clips, bytes, ms: Math.round(performance.now() - t0) };
  }
  /** what the voice of this OC is made of (so a re-export happens only when it changes) */
  const sigOf = (c) => { const v = voice(c); return [CLIPS.join(','), c.id, Math.round(v.f0), v.kind, Math.round(v.bright * 100), Math.round(v.vib * 1000)].join('|'); };
  /** decode a data URL back to samples for the tests / the preview button */
  function peek(dataUrl) {
    const u = Uint8Array.from(atob(String(dataUrl).split(',')[1] || ''), (ch) => ch.charCodeAt(0)), dv = new DataView(u.buffer), tag = (o) => String.fromCharCode(u[o], u[o + 1], u[o + 2], u[o + 3]);
    if (u.length < 46 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
    const n = dv.getUint32(40, true) / 2, s = new Float32Array(n); for (let i = 0; i < n; i++) s[i] = dv.getInt16(44 + i * 2, true) / 32768;
    let pk = 0, ss = 0; for (const x of s) { pk = Math.max(pk, Math.abs(x)); ss += x * x; }
    return { rate: dv.getUint32(24, true), ch: dv.getUint16(22, true), bits: dv.getUint16(34, true), n, dur: n / dv.getUint32(24, true), peak: pk, rms: Math.sqrt(ss / Math.max(1, n)), first: Math.abs(s[0] || 0), last: Math.abs(s[n - 1] || 0), samples: s };
  }
  /** play one clip here (the preview button in the pet center; the same samples the phone will play) */
  async function preview(c, name) {
    const OAC = window.AudioContext || window.webkitAudioContext; if (!OAC) return false;
    const f = await render(name, voice(c), c.id), ctx = (preview.ctx = preview.ctx || new OAC()), b = ctx.createBuffer(1, f.length, SR); b.getChannelData(0).set(f);
    const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = Math.max(0, Math.min(1, (OC.Store.s.pet.global.soundVol == null ? 0.6 : OC.Store.s.pet.global.soundVol))); s.buffer = b; s.connect(g); g.connect(ctx.destination); s.start(); return true;
  }
  OC.PetSound = { CLIPS, ZH, SR, voice, render, wav, renderAll, sigOf, peek, preview };
})();
