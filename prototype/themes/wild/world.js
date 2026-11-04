/* Scheme D — Windsong Fields : world (oblique top-down, cel-shaded, wind-driven) */
(function () {
  'use strict';
  const { TAU, clamp, lerp, ellipse, rr, mix, rgba, rng, noise1, gradientAt, E } = OC;
  const V = OC.V, W = OC.WS, P = W.P;

  const MAIN = { cx: 200, cy: 410, rx: 178, ry: 214, seed: 2.2, h: 40 };
  const RIDGE = { cx: 214, cy: 236, rx: 122, ry: 66, seed: 5.1, h: 28 };
  const RIVER = [[18, 300], [70, 330], [120, 380], [170, 432], [215, 470], [262, 520], [310, 556], [372, 586]];
  const CAMP = { x: 196, y: 532 };
  const MILL = { x: 296, y: 396 };
  const TREE = { x: 84, y: 384 };

  // wind: gust strength travelling across the field (diagonal), 0..1
  const gust = (x, y, t) => clamp(0.35 + 0.65 * Math.max(0, Math.sin((x * 0.6 + y * 0.3) * 0.03 - t * 1.6)) * (0.6 + 0.4 * noise1(t * 0.3 + x * 0.01)));

  function cel(ctx, path, base, shade, o = {}) { V.paint(ctx, path, { mode: 'cel', base, shade, outline: o.outline ?? mix(base, '#2a1c1c', 0.6), lw: o.lw ?? 1.2, hi: o.hi ?? 'rgba(255,246,218,0.6)', dx: o.dx ?? 2.6, dy: o.dy ?? 2.8 }); }
  const El = (ctx, cx, cy, rx, ry, rot = 0) => (ox, oy) => ellipse(ctx, cx + ox, cy + oy, rx, ry, rot);

  function grassTuft(ctx, x, y, t, s = 1, col = P.grassLo) {
    const g = gust(x, y, t);
    ctx.strokeStyle = col; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const bx = x + (i - 1.5) * 2.2 * s, h = (7 + (i % 2) * 3) * s, bend = (0.25 + g * 0.9) * h * 0.6;
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + bend * 0.3, y - h * 0.6, bx + bend, y - h); ctx.stroke();
    }
  }
  function lumpTree(ctx, x, y, s, t, seed) {
    const g = gust(x, y, t), sw = g * 2.4 + Math.sin(t * 1.3 + seed) * 0.6;
    V.shadow(ctx, x + 10 * s, y + 2, 40 * s, 10 * s, 0.3, '#24301f');
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    cel(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-6 + ox, oy); ctx.quadraticCurveTo(-3 + ox, -18 + oy, -9 + ox, -34 + oy); ctx.lineTo(-2 + ox, -32 + oy); ctx.lineTo(2 + ox, -40 + oy); ctx.lineTo(6 + ox, -32 + oy); ctx.quadraticCurveTo(3 + ox, -16 + oy, 7 + ox, oy); ctx.closePath(); }, P.wood, P.woodLo);
    const L = [[-20, -48, 20, 15], [18, -50, 19, 15], [-2, -64, 23, 17], [-6, -44, 16, 12], [10, -42, 15, 11]];
    for (const [bx, by, rx, ry] of L) cel(ctx, El(ctx, bx + sw * (-by / 60), by, rx, ry), P.grass, P.grassLo, { dx: 4, dy: 5, outline: '#3c4f2a' });
    ctx.restore();
  }
  function pine(ctx, x, y, s, t) {
    const sw = gust(x, y, t) * 1.6;
    V.shadow(ctx, x + 6, y + 1, 16 * s, 5 * s, 0.3, '#24301f');
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    cel(ctx, (ox, oy) => rr(ctx, -2.5 + ox, -10 + oy, 5, 11, 2), P.wood, P.woodLo);
    for (let i = 0; i < 3; i++) { const yy = -10 - i * 12, w = 15 - i * 3.5; cel(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-w + ox + sw * i * 0.4, yy + oy); ctx.lineTo(sw * (i + 1) * 0.5 + ox, yy - 18 + oy); ctx.lineTo(w + ox + sw * i * 0.4, yy + oy); ctx.closePath(); }, '#7E9B57', '#4F6B3A', { outline: '#34452a', dx: 3, dy: 1 }); }
    ctx.restore();
  }
  function boulder(ctx, x, y, s, seed) { V.shadow(ctx, x + 3, y + 1, 12 * s, 3.5 * s, 0.28, '#24301f'); cel(ctx, (ox, oy) => { V.blob(ctx, x + ox, y - 5 * s + oy, 9 * s, 6.5 * s, seed, 18, 3); }, P.rockHi, P.rock, { outline: '#5a5044' }); ctx.fillStyle = rgba('#7E9B57', 0.8); ellipse(ctx, x - 2 * s, y - 9.5 * s, 5 * s, 1.8 * s); ctx.fill(); }
  function ruins(ctx, x, y, t, night) {
    V.shadow(ctx, x + 6, y + 2, 44, 9, 0.3, '#24301f');
    const pillar = (px, h) => { cel(ctx, (ox, oy) => rr(ctx, px - 6 + ox, y - h + oy, 12, h, 2), '#CFC6B0', '#9C927E', { outline: '#5e5648' }); for (let k = 1; k < h / 10; k++) { ctx.strokeStyle = rgba('#5e5648', 0.5); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(px - 6, y - k * 10); ctx.lineTo(px + 6, y - k * 10 + 0.6); ctx.stroke(); } };
    pillar(x - 22, 46); pillar(x + 22, 40);
    cel(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(x - 30 + ox, y - 44 + oy); ctx.quadraticCurveTo(x + ox, y - 66 + oy, x + 30 + ox, y - 40 + oy); ctx.lineTo(x + 28 + ox, y - 33 + oy); ctx.quadraticCurveTo(x + ox, y - 55 + oy, x - 28 + ox, y - 37 + oy); ctx.closePath(); }, '#D8D0BB', '#A39983', { outline: '#5e5648' });
    // rune glyphs: dim by day, glow teal by night (original motif: spiral + bars)
    const g = clamp((night - 0.4) / 0.4) * (0.75 + 0.25 * Math.sin(t * 2));
    ctx.save(); ctx.strokeStyle = mix('#7B8C84', P.glow, g); ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    if (g > 0) { ctx.shadowColor = P.glow; ctx.shadowBlur = 8 * g; }
    for (const px of [x - 22, x + 22]) { ctx.beginPath(); for (let k = 0; k < 18; k++) { const a = k * 0.5, r = k * 0.22; ctx.lineTo(px + Math.cos(a) * r, y - 26 + Math.sin(a) * r); } ctx.stroke(); ctx.beginPath(); ctx.moveTo(px - 3, y - 14); ctx.lineTo(px + 3, y - 14); ctx.moveTo(px - 2, y - 10); ctx.lineTo(px + 2, y - 10); ctx.stroke(); }
    ctx.restore();
    // moss
    ctx.fillStyle = rgba('#7E9B57', 0.9); ellipse(ctx, x - 22, y - 46, 7, 2.2); ctx.fill(); ellipse(ctx, x + 6, y - 58, 9, 2.4); ctx.fill();
  }
  function windmill(ctx, x, y, t, night) {
    V.shadow(ctx, x + 10, y + 2, 34, 9, 0.3, '#24301f');
    cel(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(x - 20 + ox, y + oy); ctx.lineTo(x - 16 + ox, y - 34 + oy); ctx.lineTo(x + 16 + ox, y - 34 + oy); ctx.lineTo(x + 20 + ox, y + oy); ctx.closePath(); }, '#E3D7BC', '#B5A68A', { outline: '#5e5648' });
    for (let k = 0; k < 3; k++) { ctx.strokeStyle = rgba('#5e5648', 0.45); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 18, y - 10 - k * 9); ctx.lineTo(x + 18, y - 10 - k * 9); ctx.stroke(); }
    cel(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(x - 22 + ox, y - 32 + oy); ctx.lineTo(x + ox, y - 56 + oy); ctx.lineTo(x + 22 + ox, y - 32 + oy); ctx.closePath(); }, P.red, '#8E3A2C', { outline: '#4e2219' });
    cel(ctx, (ox, oy) => rr(ctx, x - 5 + ox, y - 15 + oy, 10, 15, 4), P.woodLo, '#5a3d27');
    ctx.fillStyle = night > 0.5 ? '#FFD27A' : '#5C7C86'; ellipse(ctx, x + 10, y - 24, 3, 3.4); ctx.fill();
    // cloth sails (rotate with wind)
    const a = t * (0.9 + gust(x, y, t) * 1.4);
    ctx.save(); ctx.translate(x, y - 40);
    for (let k = 0; k < 4; k++) { ctx.save(); ctx.rotate(a + (k * Math.PI) / 2); ctx.strokeStyle = P.woodLo; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26); ctx.stroke(); cel(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(1 + ox, -6 + oy); ctx.lineTo(9 + ox, -9 + oy); ctx.lineTo(8 + ox, -26 + oy); ctx.lineTo(1 + ox, -25 + oy); ctx.closePath(); }, P.cloth, '#BFAF8C', { outline: '#6a5c46', dx: 1, dy: 1 }); ctx.restore(); }
    ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fillStyle = P.woodLo; ctx.fill();
    ctx.restore();
  }
  function camp(ctx, x, y, t, night) {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; cel(ctx, El(ctx, x + Math.cos(a) * 11, y + Math.sin(a) * 6, 3.6, 2.6), P.rockHi, P.rock, { outline: '#5a5044', dx: 1, dy: 1 }); }
    ctx.fillStyle = '#4a3324'; ellipse(ctx, x, y, 8, 4.4); ctx.fill();
    // logs (seats)
    for (const [lx, ly] of [[x - 30, y + 4], [x + 32, y - 2]]) cel(ctx, (ox, oy) => rr(ctx, lx - 11 + ox, ly - 5 + oy, 22, 8, 4), P.wood, P.woodLo);
    // flames: layered, flickering
    const fl = (k, s, c) => { ctx.save(); ctx.translate(x, y - 1); ctx.scale(s * (1 + Math.sin(t * 13 + k) * 0.08), s * (1 + Math.sin(t * 11 + k * 2) * 0.12)); V.icon(ctx, 'fire', Math.sin(t * 7 + k) * 0.6, -7, 16, c); ctx.restore(); };
    fl(0, 1.25, '#E35B2C'); fl(1, 0.9, '#F5A030'); fl(2, 0.5, '#FFE18A');
    // tripod pot
    ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x - 10, y + 3); ctx.lineTo(x, y - 22); ctx.lineTo(x + 10, y + 3); ctx.stroke();
    cel(ctx, El(ctx, x, y - 12, 6, 4.6), '#4f4a46', '#2f2c2a', { outline: '#1e1c1b', dx: 1, dy: 1 });
    for (let i = 0; i < 4; i++) { const q = (t * 0.5 + i / 4) % 1; ctx.fillStyle = `rgba(240,236,228,${0.55 * (1 - q)})`; ellipse(ctx, x + Math.sin(q * 6 + i) * 4 - q * 10, y - 22 - q * 34, 3 + q * 6, 3 + q * 6); ctx.fill(); }
  }

  const TUFTS = [], FLOWERS = [], PROPS = [];
  (function () {
    const r = rng(41);
    for (let i = 0; i < 230; i++) { const a = r() * TAU, d = Math.sqrt(r()); const x = MAIN.cx + Math.cos(a) * d * (MAIN.rx - 24), y = MAIN.cy + 40 + Math.sin(a) * d * (MAIN.ry - 70); if (Math.hypot(x - CAMP.x, (y - CAMP.y) * 1.5) < 44) continue; TUFTS.push([x, y, 0.8 + r() * 0.5]); }
    for (let i = 0; i < 70; i++) { const x = 40 + r() * 320, y = 320 + r() * 280; FLOWERS.push([x, y, ['#FFFFFF', '#F2D25C', '#E5786A', '#C9B8E8'][i % 4]]); }
    [[52, 470, 1.0], [342, 470, 0.9], [96, 606, 0.85], [318, 600, 0.95]].forEach(([x, y, s]) => PROPS.push({ k: 'pine', x, y, s }));
    [[60, 228, 0.8], [362, 250, 0.75], [140, 196, 0.7]].forEach(([x, y, s]) => PROPS.push({ k: 'pine', x, y, s }));
    [[150, 480, 1, 3], [268, 470, 0.8, 7], [120, 560, 1.2, 9], [242, 600, 0.9, 11], [176, 270, 1, 13]].forEach(([x, y, s, sd]) => PROPS.push({ k: 'rock', x, y, s, sd }));
    PROPS.push({ k: 'tree', x: TREE.x, y: TREE.y, s: 1.15 }); PROPS.push({ k: 'ruins', x: 252, y: 250 }); PROPS.push({ k: 'mill', x: MILL.x, y: MILL.y }); PROPS.push({ k: 'camp', x: CAMP.x, y: CAMP.y });
  })();
  const LIGHTS = [[CAMP.x, CAMP.y - 8, 1.4, '255,150,70'], [MILL.x + 10, MILL.y - 24, 0.6, '255,200,120'], [230, 224, 0.7, '127,230,217'], [274, 224, 0.7, '127,230,217']];

  function riverPath(ctx, w) { ctx.beginPath(); ctx.moveTo(RIVER[0][0], RIVER[0][1]); for (let i = 1; i < RIVER.length - 1; i++) { const mx = (RIVER[i][0] + RIVER[i + 1][0]) / 2, my = (RIVER[i][1] + RIVER[i + 1][1]) / 2; ctx.quadraticCurveTo(RIVER[i][0], RIVER[i][1], mx, my); } const L = RIVER[RIVER.length - 1]; ctx.lineTo(L[0], L[1]); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }

  function drawField(ctx, o) {
    const t = o.t, night = o.night || 0, cam = o.cam || { x: 200, y: 400, z: 1 };
    ctx.save();
    // sea of clouds far below
    const sg = ctx.createLinearGradient(0, 0, 0, 640); sg.addColorStop(0, mix('#E9EEE6', '#5B6A8E', night)); sg.addColorStop(1, mix('#C9D8D8', '#3E4C72', night));
    ctx.fillStyle = sg; ctx.fillRect(0, 0, 360, 640);
    ctx.translate(180, 320); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    const r = rng(9);
    for (let i = 0; i < 26; i++) { const x = ((r() * 600 + t * (3 + r() * 4)) % 700) - 150, y = r() * 860 - 80, R = 30 + r() * 50; ctx.fillStyle = rgba(mix('#FFFFFF', '#8A93B8', night), 0.55); ellipse(ctx, x, y, R, R * 0.45); ctx.fill(); }
    // main plateau (stratified cliffs)
    V.plateau(ctx, MAIN.cx, MAIN.cy, MAIN.rx, MAIN.ry, MAIN.seed, MAIN.h, { top: ['#B8CC78', '#97B260'], cliff: [P.rock, P.rockLo], strata: rgba('#5e5648', 0.45), strataAt: [0.3, 0.6], rim: 'rgba(255,246,218,0.5)', outline: '#4b4336', lw: 1.3 });
    // mist hugging the cliff base
    for (let i = 0; i < 6; i++) { const x = 40 + i * 60 + Math.sin(t * 0.3 + i) * 10, y = MAIN.cy + MAIN.ry + MAIN.h - 6; ctx.fillStyle = rgba(mix('#FFFFFF', '#9AA3C8', night), 0.55); ellipse(ctx, x, y, 46, 12); ctx.fill(); }
    // light painterly ground patches
    const r2 = rng(13);
    for (let i = 0; i < 40; i++) { const a = r2() * TAU, d = Math.sqrt(r2()); const x = MAIN.cx + Math.cos(a) * d * (MAIN.rx - 40), y = MAIN.cy + 30 + Math.sin(a) * d * (MAIN.ry - 70); ctx.fillStyle = i % 2 ? rgba('#D4DE96', 0.45) : rgba('#7E9B57', 0.28); ellipse(ctx, x, y, 14 + r2() * 18, 5 + r2() * 5); ctx.fill(); }
    // river
    ctx.save(); V.blob(ctx, MAIN.cx, MAIN.cy, MAIN.rx - 4, MAIN.ry - 4, MAIN.seed); ctx.clip();
    riverPath(ctx, 26); ctx.strokeStyle = '#6E7F55'; ctx.stroke();
    riverPath(ctx, 22); ctx.strokeStyle = mix(P.water, '#3c4e7a', night); ctx.stroke();
    riverPath(ctx, 10); ctx.strokeStyle = mix(P.waterHi, '#6b7cb0', night); ctx.globalAlpha = 0.45; ctx.stroke(); ctx.globalAlpha = 1;
    // flow strokes
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) { const q = (t * 0.12 + i / 14) % 1, seg = Math.floor(q * (RIVER.length - 1)), f = q * (RIVER.length - 1) - seg; const A = RIVER[seg], B = RIVER[seg + 1]; const x = lerp(A[0], B[0], f) + ((i % 3) - 1) * 5, y = lerp(A[1], B[1], f); ctx.beginPath(); ctx.moveTo(x - 3, y - 2); ctx.lineTo(x + 3, y + 2); ctx.stroke(); }
    ctx.restore();
    for (const [sx, sy] of [[176, 428], [190, 442], [204, 456]]) cel(ctx, El(ctx, sx, sy, 6, 3.6), P.rockHi, P.rock, { outline: '#5a5044', dx: 1, dy: 1 });
    // ridge (upper level)
    V.plateau(ctx, RIDGE.cx, RIDGE.cy, RIDGE.rx, RIDGE.ry, RIDGE.seed, RIDGE.h, { top: ['#C9D38D', '#A9BD6E'], cliff: [P.rockHi, P.rock], strata: rgba('#5e5648', 0.4), strataAt: [0.5], rim: 'rgba(255,246,218,0.55)', outline: '#4b4336', lw: 1.3 });
    // slope path
    ctx.fillStyle = rgba('#E7D9B2', 0.9); for (let i = 0; i < 5; i++) { ellipse(ctx, 128 + i * 7, 300 + i * 9, 9, 4); ctx.fill(); }
    // flowers
    for (const [x, y, c] of FLOWERS) { ctx.fillStyle = c; ellipse(ctx, x, y, 1.3, 1.3); ctx.fill(); }
    // y-sorted: props, tufts, characters
    const list = PROPS.map((p) => ({ y: p.y, p }));
    for (const tf of TUFTS) list.push({ y: tf[1], tf });
    for (const c of o.chars || []) list.push({ y: c.y, c });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.tf) grassTuft(ctx, it.tf[0], it.tf[1], t, it.tf[2]);
      else if (it.p) { const p = it.p; if (p.k === 'pine') pine(ctx, p.x, p.y, p.s, t); else if (p.k === 'tree') lumpTree(ctx, p.x, p.y, p.s, t, 3); else if (p.k === 'rock') boulder(ctx, p.x, p.y, p.s, p.sd); else if (p.k === 'ruins') ruins(ctx, p.x, p.y, t, night); else if (p.k === 'mill') windmill(ctx, p.x, p.y, t, night); else if (p.k === 'camp') camp(ctx, p.x, p.y, t, night); }
      else { const c = it.c; W.ch(ctx, c.d, c.s, c.x, c.y, c.sc || 1, t); if (c.emote) W.emote(ctx, c.emote.kind, c.x + 6, c.y - 58 * (c.sc || 1), c.emote.p); }
    }
    ctx.restore();
    // lighting
    if (night > 0.001) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = gradientAt([[0, '#FFFFFF'], [0.35, '#FFD9AE'], [0.6, '#E2A189'], [0.8, '#8A8CC0'], [1, '#6E79B4']], night); ctx.fillRect(0, 0, 360, 640);
      ctx.globalCompositeOperation = 'screen';
      const glow = clamp((night - 0.4) / 0.45);
      for (const [x, y, k, c] of LIGHTS) { const sx = (x - cam.x) * cam.z + 180, sy = (y - cam.y) * cam.z + 320, R = 46 * k * cam.z * (1 + Math.sin(t * 9 + x) * 0.04); const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R); g.addColorStop(0, `rgba(${c},${0.65 * glow})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(sx - R, sy - R, R * 2, R * 2); }
      for (let i = 0; i < 18; i++) { const x = 40 + ((i * 97) % 300) + Math.sin(t * 0.7 + i) * 12, y = 250 + ((i * 59) % 330) + Math.cos(t * 0.6 + i) * 8; const a = glow * (0.5 + 0.5 * Math.sin(t * 4 + i)); const g = ctx.createRadialGradient(x, y, 0, x, y, 6); g.addColorStop(0, `rgba(190,255,220,${a})`); g.addColorStop(1, 'rgba(190,255,220,0)'); ctx.fillStyle = g; ctx.fillRect(x - 6, y - 6, 12, 12); }
      ctx.restore();
    } else {
      // warm sun wash, top-left
      const g = ctx.createRadialGradient(40, 40, 10, 40, 40, 420); g.addColorStop(0, 'rgba(255,240,200,0.28)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    }
    windStreaks(ctx, t, 1 - night * 0.6);
  }
  function windStreaks(ctx, t, a = 1) {
    ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.7 * a})`; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const q = (t * 0.32 + i * 0.37) % 1, y0 = 80 + ((i * 131) % 460), x0 = -60 + q * 480;
      const life = Math.sin(q * Math.PI);
      ctx.globalAlpha = life; ctx.beginPath();
      for (let k = 0; k <= 20; k++) { const u = k / 20; const x = x0 + u * 70, y = y0 + u * 18 + Math.sin(u * 5 + t * 2 + i) * 4; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      if (i % 2 === 0) { ctx.beginPath(); ctx.arc(x0 + 70, y0 + 14, 5, -1, 2.4); ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawWoods(ctx, o) {
    const t = o.t;
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#9FB4AE'); g.addColorStop(1, '#5E7A63'); ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    for (let b = 0; b < 3; b++) { ctx.fillStyle = mix('#7F978C', '#3F5A49', b / 2); for (let i = 0; i < 9; i++) { const x = i * 46 + b * 17; ctx.fillRect(x, 0, 12 + b * 4, 300 + b * 30); } ctx.fillStyle = rgba('#DDE6DF', 0.35); ctx.fillRect(0, 230 + b * 30, 360, 40); }
    ctx.fillStyle = '#5E7F4E'; ctx.fillRect(0, 320, 360, 320);
    ctx.fillStyle = rgba('#E7D9B2', 0.85); ctx.beginPath(); ctx.moveTo(150, 320); ctx.quadraticCurveTo(120, 450, 170, 520); ctx.quadraticCurveTo(220, 590, 190, 640); ctx.lineTo(260, 640); ctx.quadraticCurveTo(280, 560, 220, 500); ctx.quadraticCurveTo(170, 430, 196, 320); ctx.fill();
    const items = [];
    for (const [x, y, s] of [[40, 380, 1.6], [320, 370, 1.7], [30, 520, 1.5], [330, 540, 1.4]]) items.push({ y, f: () => pine(ctx, x, y, s, t) });
    for (const [x, y] of [[100, 430], [260, 480], [90, 600]]) items.push({ y, f: () => { ctx.fillStyle = '#EDE6D6'; rr(ctx, x - 2, y - 8, 4, 8, 2); ctx.fill(); cel(ctx, (ox, oy) => { ctx.beginPath(); ctx.ellipse(x + ox, y - 8 + oy, 7, 5, 0, Math.PI, TAU); ctx.closePath(); }, '#7FE6D9', '#3FA79B', { outline: '#2b5d58', dx: 1, dy: 1 }); const gg = ctx.createRadialGradient(x, y - 8, 0, x, y - 8, 20); gg.addColorStop(0, 'rgba(127,230,217,0.45)'); gg.addColorStop(1, 'rgba(127,230,217,0)'); ctx.fillStyle = gg; ctx.fillRect(x - 20, y - 28, 40, 40); } });
    for (let i = 0; i < 40; i++) { const x = (i * 83) % 360, y = 330 + ((i * 47) % 300); items.push({ y, f: () => grassTuft(ctx, x, y, t, 1, '#3F5E35') }); }
    for (const c of o.chars || []) items.push({ y: c.y, f: () => W.ch(ctx, c.d, c.s, c.x, c.y, c.sc || 1, t) });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.f());
    // rain + puddle rings
    ctx.strokeStyle = 'rgba(230,240,245,0.5)'; ctx.lineWidth = 0.9; const r = rng(3);
    for (let i = 0; i < 100; i++) { const sp = 320 + r() * 140, x0 = r() * 420, y = ((t * sp + r() * 700) % 700) - 30, x = x0 - y * 0.25; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2.6, y + 11); ctx.stroke(); }
    ctx.fillStyle = 'rgba(150,170,190,0.18)'; ctx.fillRect(0, 0, 360, 640);
  }

  OC.WS.WORLD = { drawField, drawWoods, pine, lumpTree, windStreaks, MAIN, CAMP, MILL };
})();
