/* OC Shimeji — Phase 1 visual prototype : shared core
 * Deterministic, time-driven rendering helpers. Every frame is a pure function
 * of time t (seconds) so the same prototype can be played live in a browser
 * or recorded frame-by-frame into MP4 without dropped frames.
 *
 * Design space: 360 x 640 dp (Android xxhdpi = 3x -> 1080 x 1920 px).
 */
(function (G) {
  'use strict';

  const W = 1080, H = 1920, DP = 3, DW = 360, DH = 640;

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);
  const TAU = Math.PI * 2;

  const E = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outSine: (t) => Math.sin((t * Math.PI) / 2),
    // gentle overshoot (c1 = 1.2 instead of the usual 1.70158: "soft, never bouncy")
    outBack: (t, c1 = 1.2) => { const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    inBack: (t, c1 = 1.2) => { const c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  };

  /** Step response of a damped spring: 0 -> 1 with soft overshoot. */
  function spring(t, freq = 2.2, damp = 6) {
    if (t <= 0) return 0;
    return 1 - Math.exp(-damp * t) * Math.cos(TAU * freq * t);
  }
  /** Damped oscillation impulse response (follow-through, ear flops, wobble). */
  function wobble(t, freq = 3, damp = 5) {
    if (t <= 0) return 0;
    return Math.exp(-damp * t) * Math.sin(TAU * freq * t);
  }

  // ---------- deterministic random / noise ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise1(x) { const i = Math.floor(x), f = x - i; return lerp(hash(i), hash(i + 1), smooth(f)); }

  // ---------- color ----------
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
  }
  function rgba(hex, a) { const c = hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
  /** Interpolate through a list of [t, color] stops. */
  function gradientAt(stops, t) {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
        return mix(c0, c1, (t - t0) / (t1 - t0));
      }
    }
    return stops[stops.length - 1][1];
  }

  // ---------- canvas helpers ----------
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function ellipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); }
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function typewriter(str, p) {
    const chars = Array.from(str);
    return chars.slice(0, Math.floor(chars.length * clamp(p))).join('');
  }
  function text(ctx, str, x, y, opt = {}) {
    ctx.save();
    ctx.font = opt.font || '12px sans-serif';
    ctx.fillStyle = opt.color || '#000';
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.base || 'alphabetic';
    if (opt.alpha != null) ctx.globalAlpha *= opt.alpha;
    if (opt.ls) { try { ctx.letterSpacing = opt.ls + 'px'; } catch (e) {} }
    if (opt.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = opt.stroke; ctx.lineWidth = opt.strokeW || 3; ctx.strokeText(str, x, y); }
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // ---------- character animation helpers (shared rig parameters) ----------
  /** Natural blink: closes fast, opens a bit slower, irregular interval, occasional double blink. */
  function blink(t, seed = 1) {
    const r = rng(seed * 9973);
    let at = 0.6 + r() * 1.2;
    while (at < t + 1) {
      const d = t - at;
      if (d >= 0 && d < 0.22) {
        return d < 0.07 ? E.inQuad(d / 0.07) : 1 - E.outQuad((d - 0.07) / 0.15);
      }
      at += r() < 0.18 ? 0.32 : 2.2 + r() * 2.6;
    }
    return 0;
  }
  /** Breathing: slow inhale, slightly faster exhale. Returns -1..1 */
  function breath(t, rate = 0.38, phase = 0) {
    const p = (t * rate + phase) % 1;
    return p < 0.55 ? Math.sin((p / 0.55) * Math.PI / 2) * 2 - 1 : Math.cos(((p - 0.55) / 0.45) * Math.PI / 2) * 2 - 1;
  }
  /**
   * Walk path sampler. keys: [{t, x, y}] — returns position, facing and walk phase.
   * Speed-aware: phase advances with distance travelled so feet never slide.
   */
  function walkPath(keys, t, stride = 14) {
    if (t <= keys[0].t) return { x: keys[0].x, y: keys[0].y, moving: false, phase: 0, vx: 0, vy: 0, dist: 0 };
    let dist = 0;
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1], b = keys[i];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (t <= b.t) {
        const raw = (t - a.t) / (b.t - a.t);
        const ease = b.ease || E.inOutSine;
        const p = ease(raw);
        const x = lerp(a.x, b.x, p), y = lerp(a.y, b.y, p);
        const d = dist + segLen * p;
        const moving = segLen > 0.5 && raw > 0 && raw < 1;
        return { x, y, moving, phase: d / stride, vx: (b.x - a.x), vy: (b.y - a.y), dist: d, segT: raw };
      }
      dist += segLen;
    }
    const L = keys[keys.length - 1];
    return { x: L.x, y: L.y, moving: false, phase: dist / stride, vx: 0, vy: 0, dist };
  }
  /** Time since the most recent key whose t <= now, or -1. */
  function since(times, t) {
    let best = -1;
    for (const k of times) if (t >= k) best = t - k;
    return best;
  }
  /** Finger / touch path. keys: [{t,x,y,down}] -> {x,y,down,alpha,press,tap} */
  function finger(keys, t) {
    if (!keys.length || t < keys[0].t - 0.25 || t > keys[keys.length - 1].t + 0.3) return null;
    let x = keys[0].x, y = keys[0].y, down = false, lastChange = -9;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (t >= k.t) {
        x = k.x; y = k.y;
        if (k.down !== down) { down = !!k.down; lastChange = k.t; }
        const n = keys[i + 1];
        if (n && t < n.t) {
          const p = E.inOutCubic((t - k.t) / (n.t - k.t));
          x = lerp(k.x, n.x, p); y = lerp(k.y, n.y, p);
        }
      }
    }
    const first = keys[0].t, last = keys[keys.length - 1].t;
    const alpha = clamp((t - (first - 0.25)) / 0.25) * clamp((last + 0.3 - t) / 0.3);
    return { x, y, down, alpha, sinceChange: t - lastChange };
  }

  // ---------- shared storyboard ----------
  // All three art directions share these shots and timings so videos can be
  // compared side by side. Each theme provides its own renderer per shot.
  const SHOTS = [
    { id: 'logo', t0: 0.0, t1: 3.0, zh: '開場 Logo', en: 'Opening' },
    { id: 'island', t0: 3.0, t1: 9.0, zh: '2.5D 小島 · 極簡 HUD · 日夜', en: 'Island · HUD · Day→Night' },
    { id: 'creator', t0: 9.0, t1: 14.0, zh: '自由創角 · 捏臉', en: 'Character creator' },
    { id: 'profile', t0: 14.0, t1: 18.0, zh: '角色檔案 · 生活狀態', en: 'Profile · Needs' },
    { id: 'dialogue', t0: 18.0, t1: 23.0, zh: '對話 · 互動 · 特殊反應', en: 'Dialogue · Reaction' },
    { id: 'map', t0: 23.0, t1: 27.5, zh: '世界地圖 · 地點切換', en: 'World map · Travel' },
    { id: 'inventory', t0: 27.5, t1: 31.5, zh: '背包 · 拖曳使用物品', en: 'Bag · Drag to use' },
    { id: 'shop', t0: 31.5, t1: 34.5, zh: '商店', en: 'Shop' },
    { id: 'studio', t0: 34.5, t1: 38.5, zh: '逐幀動畫工坊', en: 'Frame animation studio' },
    { id: 'pet', t0: 38.5, t1: 43.5, zh: 'Android 懸浮桌寵（視覺模擬）', en: 'Floating pet (visual mock)' },
    { id: 'end', t0: 43.5, t1: 45.0, zh: '', en: '' },
  ];
  const DURATION = 45.0, FPS = 30, TRANS = 0.6; // transition overlap (seconds)

  const DATA = {
    title: 'OC Shimeji',
    cast: {
      mochi: { zh: '麻糬', en: 'Mochi', role: '你的 OC', bday: '春 · 第 3 天' },
      kuri: { zh: '栗子', en: 'Kuri' },
      sora: { zh: '蘇拉', en: 'Sora' },
    },
    needs: [
      { id: 'food', zh: '飽足', en: 'Full', v: 0.42 },
      { id: 'energy', zh: '精神', en: 'Energy', v: 0.78 },
      { id: 'mood', zh: '心情', en: 'Mood', v: 0.86 },
      { id: 'social', zh: '社交', en: 'Social', v: 0.55 },
      { id: 'clean', zh: '清潔', en: 'Clean', v: 0.7 },
    ],
    traits: ['好奇心旺盛', '愛做白日夢', '小小美食家', '慢條斯理'],
    relations: [
      { who: 'kuri', zh: '摯友', hearts: 4 },
      { who: 'sora', zh: '鄰居', hearts: 2 },
    ],
    dialogue: {
      a: '麻糬！今天的雲好像棉花糖耶～',
      choices: ['一起去森林散步？', '我想吃棉花糖…'],
      b: '真的嗎？好耶！走吧！',
    },
    places: [
      { id: 'village', zh: '棉花村', en: 'Cotton Village' },
      { id: 'forest', zh: '苔光森林', en: 'Mosslight Woods' },
      { id: 'beach', zh: '星砂海灘', en: 'Starsand Shore' },
      { id: 'hill', zh: '風車丘', en: 'Windmill Hill' },
      { id: 'market', zh: '雲朵市集', en: 'Cloud Market' },
    ],
    items: [
      { id: 'cake', zh: '草莓蛋糕', n: 2 }, { id: 'apple', zh: '蜜蘋果', n: 5 }, { id: 'milk', zh: '鮮奶', n: 1 },
      { id: 'flower', zh: '小雛菊', n: 8 }, { id: 'fish', zh: '小魚乾', n: 3 }, { id: 'star', zh: '星星糖', n: 12 },
      { id: 'shell', zh: '貝殼', n: 4 }, { id: 'seed', zh: '種子', n: 9 },
    ],
    shop: [
      { id: 'lamp', zh: '蘑菇檯燈', price: 120 }, { id: 'cushion', zh: '雲朵靠墊', price: 80 },
      { id: 'plant', zh: '小盆栽', price: 60 }, { id: 'rug', zh: '貓掌地毯', price: 150 },
    ],
    coins: 3240,
  };

  G.OC = {
    W, H, DP, DW, DH, TAU, clamp, lerp, seg, smooth, E, spring, wobble, rng, hash, noise1,
    hexToRgb, rgbToHex, mix, rgba, gradientAt, rr, ellipse, makeCanvas, typewriter, text,
    blink, breath, walkPath, since, finger, SHOTS, DURATION, FPS, TRANS, DATA,
    themes: {},
  };
})(window);
