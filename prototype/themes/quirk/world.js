/* Scheme F — Quirkville : town world (oblique top-down; apartment block = 2D box faces) */
(function () {
  'use strict';
  const { TAU, clamp, lerp, ellipse, rr, mix, rgba, rng, gradientAt, E } = OC;
  const V = OC.V, Q = OC.QK, P = Q.P;

  const MAIN = { cx: 200, cy: 410, rx: 184, ry: 218, seed: 6.2 };
  const APT = { x0: 112, x1: 292, y: 300, H: 112, D: 30 };
  const FOUNT = { x: 194, y: 448 };
  const glossM = (base, shade) => ({ mode: 'gloss', base, shade: shade || mix(base, '#1a1a30', 0.35), outline: '#3a3550', lw: 0.9, dx: 2, dy: 2.2 });
  const El = (ctx, cx, cy, rx, ry) => (ox, oy) => ellipse(ctx, cx + ox, cy + oy, rx, ry);

  function lolli(ctx, x, y, s, t, c, seed) {
    const sw = Math.sin(t * 1.3 + seed) * 0.6;
    V.shadow(ctx, x + 3, y + 1, 14 * s, 4 * s, 0.2, '#2b2d42');
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    V.paint(ctx, (ox, oy) => rr(ctx, -2 + ox, -18 + oy, 4, 18, 2), glossM('#B98A5A'));
    V.paint(ctx, El(ctx, sw, -30, 15, 15), glossM(c));
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ellipse(ctx, sw - 6, -37, 5, 3); ctx.fill();
    ctx.restore();
  }
  function planter(ctx, x, y, seed) {
    V.paint(ctx, (ox, oy) => rr(ctx, x - 14 + ox, y - 10 + oy, 28, 10, 3), glossM('#FFFFFF', '#C9CFDA'));
    const cols = [P.mag, P.yellow, P.orange, P.purple];
    for (let i = 0; i < 5; i++) { ctx.fillStyle = P.grassLo; ellipse(ctx, x - 10 + i * 5, y - 11, 3, 2); ctx.fill(); ctx.fillStyle = cols[(i + seed) % 4]; ellipse(ctx, x - 10 + i * 5, y - 13, 2.2, 2.2); ctx.fill(); }
  }
  function lamp(ctx, x, y, night) { V.shadow(ctx, x, y, 5, 2, 0.18); ctx.fillStyle = '#4A4E69'; rr(ctx, x - 1.2, y - 22, 2.4, 22, 1); ctx.fill(); V.paint(ctx, El(ctx, x, y - 25, 4.4, 4.4), glossM(night > 0.4 ? '#FFE680' : '#FFFFFF')); }
  function bench(ctx, x, y) { V.paint(ctx, (ox, oy) => rr(ctx, x - 16 + ox, y - 9 + oy, 32, 6, 2), glossM(P.orange)); V.paint(ctx, (ox, oy) => rr(ctx, x - 16 + ox, y - 15 + oy, 32, 5, 2), glossM(P.orange)); ctx.fillStyle = '#4A4E69'; ctx.fillRect(x - 13, y - 3, 2, 3); ctx.fillRect(x + 11, y - 3, 2, 3); }
  function umbrellaTable(ctx, x, y, c) {
    V.shadow(ctx, x + 2, y + 1, 18, 5, 0.18);
    V.paint(ctx, El(ctx, x, y - 8, 11, 4), glossM('#FFFFFF', '#C9CFDA'));
    ctx.fillStyle = '#9AA0B2'; ctx.fillRect(x - 1, y - 30, 2, 22);
    V.paint(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(x - 22 + ox, y - 26 + oy); ctx.quadraticCurveTo(x + ox, y - 46 + oy, x + 22 + ox, y - 26 + oy); ctx.closePath(); }, glossM(c));
    ctx.fillStyle = '#fff'; for (let k = -1; k <= 1; k += 2) { ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x + k * 9, y - 26); ctx.lineTo(x + k * 3, y - 26); ctx.closePath(); ctx.fill(); }
  }
  function fountain(ctx, x, y, t, night) {
    V.paint(ctx, El(ctx, x, y, 34, 15), glossM('#FFFFFF', '#C9CFDA'));
    ctx.fillStyle = mix('#7FD3FF', '#6A7CF0', night); ellipse(ctx, x, y - 1, 28, 11); ctx.fill();
    for (let k = 0; k < 3; k++) { const q = (t * 0.7 + k / 3) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - q)})`; ctx.lineWidth = 1; ellipse(ctx, x, y - 1, 6 + q * 20, 2.5 + q * 8); ctx.stroke(); }
    V.paint(ctx, (ox, oy) => rr(ctx, x - 5 + ox, y - 18 + oy, 10, 16, 3), glossM('#FFFFFF', '#C9CFDA'));
    // jets: parabolic droplets
    for (let j = 0; j < 14; j++) { const a = (j / 14) * TAU, q = (t * 1.2 + j * 0.13) % 1; const dx = Math.cos(a) * 18 * q, dy = -26 * Math.sin(q * Math.PI) + Math.sin(a) * 6 * q; ctx.fillStyle = `rgba(200,240,255,${0.9 - q * 0.4})`; ellipse(ctx, x + dx, y - 18 + dy, 1.6, 1.6); ctx.fill(); }
  }
  function apartment(ctx, t, night) {
    const { x0, x1, y, H, D } = APT, w = x1 - x0;
    V.shadow(ctx, (x0 + x1) / 2 + 10, y + 2, w * 0.6, 12, 0.25, '#2b2d42');
    // roof (top face)
    ctx.fillStyle = '#E6EAF2'; rr(ctx, x0, y - H - D, w, D, 6); ctx.fill(); ctx.strokeStyle = '#3a3550'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = '#C9CFDA'; rr(ctx, x0 + 10, y - H - D + 8, 26, 14, 3); ctx.fill();
    V.paint(ctx, (ox, oy) => rr(ctx, x1 - 44 + ox, y - H - D + 6 + oy, 30, 16, 4), glossM(P.lime));
    ctx.strokeStyle = '#4A4E69'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x0 + 60, y - H - D + 14); ctx.lineTo(x0 + 60, y - H - D - 6); ctx.moveTo(x0 + 54, y - H - D - 2); ctx.lineTo(x0 + 66, y - H - D - 2); ctx.stroke();
    // facade (front face)
    const fg = ctx.createLinearGradient(0, y - H, 0, y); fg.addColorStop(0, '#FFFFFF'); fg.addColorStop(1, '#EEF1F7');
    ctx.fillStyle = fg; rr(ctx, x0, y - H, w, H, 4); ctx.fill(); ctx.strokeStyle = '#3a3550'; ctx.lineWidth = 0.9; ctx.stroke();
    // floor bands
    ctx.fillStyle = '#FFD93D'; ctx.fillRect(x0, y - H, w, 6);
    const cols = 5, rows = 3, cw = w / cols;
    const curtains = [P.mag, P.sky, P.lime, P.orange, P.purple, P.teal, P.yellow, P.blue];
    const heads = { '1,0': 'kuri', '3,1': 'sora', '0,2': 'mochi' };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (r === 2 && c === 2) continue; // door slot
      const wx = x0 + c * cw + 7, wy = y - H + 14 + r * 32, ww = cw - 14, wh = 22;
      const lit = night > 0.5 && ((r * 7 + c * 3) % 5 !== 0);
      ctx.fillStyle = lit ? '#FFE9A0' : '#BFE7FF'; rr(ctx, wx, wy, ww, wh, 3); ctx.fill(); ctx.strokeStyle = '#3a3550'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = curtains[(r * cols + c) % curtains.length]; ctx.fillRect(wx + 1, wy + 1, 6, wh - 2); ctx.fillRect(wx + ww - 7, wy + 1, 6, wh - 2);
      const who = heads[`${c},${r}`];
      if (who) { ctx.save(); rr(ctx, wx, wy, ww, wh, 3); ctx.clip(); const peek = 0.5 + 0.5 * Math.sin(t * 1.2 + c + r); Q.ch(ctx, who, { noShadow: true, eyes: 'happy', mouth: 'smile', armR: Math.sin(t * 8 + c) * 0.4 - 2.2 }, wx + ww / 2, wy + wh + 30 - peek * 8, 0.62, t); ctx.restore(); }
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(wx + 8, wy + 3, 3, wh - 6);
    }
    // door + awning
    const dx = x0 + 2 * cw + 8, dw = cw - 16;
    ctx.fillStyle = '#5A6B8C'; rr(ctx, dx, y - 30, dw, 30, 3); ctx.fill(); ctx.fillStyle = '#BFE7FF'; ctx.fillRect(dx + 4, y - 26, dw - 8, 10);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#fff' : P.mag; ctx.beginPath(); ctx.moveTo(dx - 6 + k * (dw + 12) / 4, y - 36); ctx.lineTo(dx - 6 + (k + 1) * (dw + 12) / 4, y - 36); ctx.lineTo(dx - 6 + (k + 1) * (dw + 12) / 4, y - 30); ctx.arc(dx - 6 + (k + 0.5) * (dw + 12) / 4, y - 30, (dw + 12) / 8, 0, Math.PI); ctx.closePath(); ctx.fill(); }
    // sign
    V.paint(ctx, (ox, oy) => rr(ctx, (x0 + x1) / 2 - 34 + ox, y - H - 12 + oy, 68, 18, 9), glossM(P.blue));
    OC.text(ctx, '奇趣公寓', (x0 + x1) / 2, y - H - 2.5, { font: Q.ZB(900, 9.5), color: '#fff', align: 'center', base: 'middle' });
  }

  const PROPS = [];
  (function () {
    [[60, 340, P.grass], [340, 340, P.lime], [40, 470, P.grassLo], [356, 430, P.grass], [80, 590, P.lime], [326, 590, P.grass], [140, 320, P.lime], [262, 322, P.grass]].forEach(([x, y, c], i) => PROPS.push({ k: 'lolli', x, y, s: 1, c, sd: i }));
    PROPS.push({ k: 'apt', y: APT.y });
    PROPS.push({ k: 'fount', x: FOUNT.x, y: FOUNT.y });
    PROPS.push({ k: 'umb', x: 300, y: 482, c: P.mag }); PROPS.push({ k: 'umb', x: 338, y: 518, c: P.sky });
    PROPS.push({ k: 'bench', x: 96, y: 512 }); PROPS.push({ k: 'bench', x: 250, y: 560 });
    [[150, 378, 1], [240, 378, 2], [150, 540, 3]].forEach(([x, y, sd]) => PROPS.push({ k: 'plant', x, y, sd }));
    [[120, 420], [270, 420], [194, 560]].forEach(([x, y]) => PROPS.push({ k: 'lamp', x, y }));
  })();
  const LIGHTS = [[194, 432, 1.0], [120, 397, 0.6], [270, 397, 0.6], [194, 537, 0.6], [202, 230, 1.6], [300, 470, 0.6]];

  function drawTown(ctx, o) {
    const t = o.t, night = o.night || 0, cam = o.cam || { x: 200, y: 410, z: 1 };
    ctx.save();
    ctx.fillStyle = mix(P.sea, '#3B4A9A', night); ctx.fillRect(0, 0, 360, 640);
    ctx.translate(180, 320); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    const r = rng(8); for (let i = 0; i < 30; i++) { const x = -80 + r() * 560, y = -40 + r() * 820, a = Math.max(0, Math.sin(t * 1.4 + r() * 6)); ctx.strokeStyle = `rgba(255,255,255,${0.7 * a})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    // pier
    V.paint(ctx, (ox, oy) => rr(ctx, 186 + ox, 606 + oy, 26, 64, 3), glossM('#F2E3C6', '#D6BF97'));
    // island: beach rim + grass + plaza
    ctx.fillStyle = '#FFF2D0'; V.blob(ctx, MAIN.cx, MAIN.cy, MAIN.rx, MAIN.ry, MAIN.seed, 64, 0.6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; V.blob(ctx, MAIN.cx, MAIN.cy + 5, MAIN.rx + 6 + Math.sin(t * 2) * 2, MAIN.ry + 6 + Math.sin(t * 2) * 2, MAIN.seed, 64, 0.6); ctx.stroke();
    ctx.fillStyle = mix(P.grass, '#4E8A6A', night * 0.2); V.blob(ctx, MAIN.cx, MAIN.cy - 10, MAIN.rx - 16, MAIN.ry - 30, MAIN.seed + 0.4, 64, 0.6); ctx.fill();
    // paved plaza (tile grid, clipped)
    ctx.save(); ellipse(ctx, 194, 470, 128, 98); ctx.rect(110, 240, 190, 70); ctx.clip();
    ctx.fillStyle = P.pave; ctx.fillRect(40, 200, 330, 400);
    ctx.strokeStyle = P.paveLo; ctx.lineWidth = 0.8; for (let x = 40; x < 370; x += 14) { ctx.beginPath(); ctx.moveTo(x, 200); ctx.lineTo(x, 600); ctx.stroke(); } for (let y = 200; y < 600; y += 10) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(370, y); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ellipse(ctx, 194, 470, 128, 98); ctx.stroke();
    // path to pier
    ctx.fillStyle = P.pave; rr(ctx, 182, 560, 34, 60, 6); ctx.fill();
    // y-sorted
    const list = PROPS.map((p) => ({ y: p.y, p }));
    for (const c of o.chars || []) list.push({ y: c.y, c });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.p) { const p = it.p; if (p.k === 'lolli') lolli(ctx, p.x, p.y, p.s, t, p.c, p.sd); else if (p.k === 'apt') apartment(ctx, t, night); else if (p.k === 'fount') fountain(ctx, p.x, p.y, t, night); else if (p.k === 'umb') umbrellaTable(ctx, p.x, p.y, p.c); else if (p.k === 'bench') bench(ctx, p.x, p.y); else if (p.k === 'plant') planter(ctx, p.x, p.y, p.sd); else if (p.k === 'lamp') lamp(ctx, p.x, p.y, night); }
      else { const c = it.c; Q.ch(ctx, c.d, c.s, c.x, c.y, c.sc || 1, t); if (c.wish) Q.thought(ctx, c.x + (c.x > 250 ? -22 : 18) * (c.sc || 1), c.y - 66 * (c.sc || 1), c.wish[0], c.wish[1], t, 1); if (c.emote) Q.emote(ctx, c.emote.kind, c.x + 6, c.y - 62 * (c.sc || 1), c.emote.p, t); }
    }
    ctx.restore();
    if (night > 0.001) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = gradientAt([[0, '#FFFFFF'], [0.35, '#FFE2C2'], [0.6, '#F0B0C8'], [0.8, '#A9A8E8'], [1, '#949CE6']], night); ctx.fillRect(0, 0, 360, 640);
      ctx.globalCompositeOperation = 'screen'; const glow = clamp((night - 0.4) / 0.45);
      for (const [x, y, k] of LIGHTS) { const sx = (x - cam.x) * cam.z + 180, sy = (y - cam.y) * cam.z + 320, R = 36 * k * cam.z; const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R); g.addColorStop(0, `rgba(255,220,140,${0.6 * glow})`); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.fillRect(sx - R, sy - R, R * 2, R * 2); }
      ctx.restore();
    }
  }

  function drawPark(ctx, o) {
    const t = o.t;
    ctx.fillStyle = '#86CF55'; ctx.fillRect(0, 0, 360, 640);
    ctx.fillStyle = '#79C24A'; for (let y = 0; y < 640; y += 24) for (let x = (y / 24) % 2 * 24; x < 360; x += 48) ctx.fillRect(x, y, 24, 24);
    ctx.fillStyle = P.pave; for (let i = 0; i < 16; i++) { const y = 660 - i * 40, x = 180 + Math.sin(i * 0.5) * 26; rr(ctx, x - 22, y - 16, 44, 32, 8); ctx.fill(); }
    const items = [];
    for (const [x, y, s, c] of [[40, 140, 1.8, P.grassLo], [320, 120, 1.9, P.grass], [60, 300, 2, P.lime], [300, 300, 1.8, P.grassLo], [30, 470, 2, P.grass], [330, 480, 2.1, P.lime], [80, 630, 1.9, P.grass], [300, 640, 2, P.grassLo]]) items.push({ y, f: () => lolli(ctx, x, y, s, t, c, x) });
    for (const [x, y, c] of [[110, 360, P.mag], [250, 420, P.purple], [120, 540, P.orange]]) items.push({ y, f: () => { V.paint(ctx, (ox, oy) => rr(ctx, x - 2 + ox, y - 8 + oy, 4, 8, 2), glossM('#FFFFFF')); V.paint(ctx, (ox, oy) => { ctx.beginPath(); ctx.ellipse(x + ox, y - 8 + oy, 8, 6, 0, Math.PI, TAU); ctx.closePath(); }, glossM(c)); } });
    for (const [px, py, pr] of [[196, 420, 14], [160, 520, 11]]) items.push({ y: py - 1, f: () => { ctx.fillStyle = '#9CDCFF'; ellipse(ctx, px, py, pr, pr * 0.42); ctx.fill(); const q = (t * 1.3 + px * 0.01) % 1; ctx.strokeStyle = `rgba(255,255,255,${1 - q})`; ctx.lineWidth = 1.2; ellipse(ctx, px, py, 2 + q * pr * 0.7, (2 + q * pr * 0.7) * 0.42); ctx.stroke(); } });
    for (const c of o.chars || []) items.push({ y: c.y, f: () => Q.ch(ctx, c.d, c.s, c.x, c.y, c.sc || 1, t) });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.f());
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; const r = rng(5);
    for (let i = 0; i < 60; i++) { const sp = 260 + r() * 100, x0 = r() * 400, y = ((t * sp + r() * 700) % 700) - 30, x = x0 - y * 0.12; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1.2, y + 8); ctx.stroke(); }
    ctx.fillStyle = 'rgba(120,160,230,0.12)'; ctx.fillRect(0, 0, 360, 640);
  }

  OC.QK.WORLD = { drawTown, drawPark, apartment, lolli, APT };
})();
