/* Scheme E — Sunny Isle : world (bright flat toy island, oblique top-down, Y-sorted) */
(function () {
  'use strict';
  const { TAU, clamp, lerp, ellipse, rr, mix, rgba, rng, gradientAt, E } = OC;
  const V = OC.V, I = OC.IS, P = I.P;

  const MAIN = { cx: 200, cy: 405, rx: 182, ry: 216, seed: 3.4 };
  const TER = { cx: 206, cy: 250, rx: 124, ry: 66, seed: 7.3, h: 24 };
  const RIVER = [[292, 300], [286, 350], [300, 400], [332, 446], [372, 480], [420, 500]];

  const flatM = (base, shade) => ({ mode: 'flat', base, shade: shade || mix(base, '#2a3a20', 0.3), dx: 1.8, dy: 2 });
  const El = (ctx, cx, cy, rx, ry, rot = 0) => (ox, oy) => ellipse(ctx, cx + ox, cy + oy, rx, ry, rot);

  function fruitTree(ctx, x, y, s, t, seed, fruit = '#FF9A3C') {
    const sw = Math.sin(t * 1.4 + seed) * 0.8;
    V.shadow(ctx, x + 2, y + 1, 20 * s, 6 * s, 0.22, '#2c5a3a');
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    V.paint(ctx, (ox, oy) => rr(ctx, -3.5 + ox, -16 + oy, 7, 17, 3), flatM(P.wood, P.woodLo));
    V.paint(ctx, El(ctx, sw, -32, 19, 17), flatM('#5FBF4E', '#3E9C3A'));
    V.paint(ctx, El(ctx, sw - 6, -38, 9, 6), flatM('#7AD563', '#5FBF4E'));
    for (const [fx, fy] of [[-10, -30], [8, -36], [4, -24], [-3, -40], [12, -27]]) { ctx.fillStyle = fruit; ellipse(ctx, fx + sw, fy, 2.6, 2.6); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ellipse(ctx, fx + sw - 0.8, fy - 0.9, 0.8, 0.8); ctx.fill(); }
    ctx.restore();
  }
  function palm(ctx, x, y, s, t, seed) {
    const sw = Math.sin(t * 1.2 + seed) * 1.5;
    V.shadow(ctx, x + 10, y + 1, 18 * s, 5 * s, 0.22, '#2c5a3a');
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = '#C99863'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, -22, 2 + sw * 0.3, -44); ctx.stroke();
    ctx.strokeStyle = '#B07E4B'; ctx.lineWidth = 1; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-3.5 - (i < 3 ? 2 : 0), -i * 7.5); ctx.lineTo(2.5, -i * 7.5 - 1); ctx.stroke(); }
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.62 + sw * 0.03; ctx.save(); ctx.translate(2 + sw * 0.3, -44); ctx.rotate(a); V.paint(ctx, El(ctx, 0, -11, 4.2, 13), flatM('#52B84A', '#3B9A3A')); ctx.restore(); }
    for (const dx of [-3, 3]) { ctx.fillStyle = '#8A5A33'; ellipse(ctx, 2 + dx + sw * 0.3, -41, 2.6, 2.6); ctx.fill(); }
    ctx.restore();
  }
  function cottage(ctx, x, y, s, t, roof, night, seed) {
    V.shadow(ctx, x + 6, y + 2, 38 * s, 9 * s, 0.24, '#2c5a3a');
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    V.paint(ctx, (ox, oy) => rr(ctx, -26 + ox, -30 + oy, 52, 31, 4), flatM('#FFF4DC', '#E8D3AE'));
    V.paint(ctx, (ox, oy) => rr(ctx, -6.5 + ox, -18 + oy, 13, 18, 4), flatM('#C88B55', '#A06A3C'));
    ctx.fillStyle = P.yellow; ellipse(ctx, 3.5, -9, 1.2, 1.2); ctx.fill();
    for (const wx of [-17, 17]) { V.paint(ctx, (ox, oy) => rr(ctx, wx - 5.5 + ox, -24 + oy, 11, 10, 2.5), flatM(night > 0.5 ? '#FFE08A' : '#9EE3F5', night > 0.5 ? '#F2C14E' : '#6CC8E3')); ctx.fillStyle = '#fff'; ctx.fillRect(wx - 0.6, -24, 1.2, 10); }
    // gable roof with eave
    V.paint(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-32 + ox, -27 + oy); ctx.lineTo(0 + ox, -54 + oy); ctx.lineTo(32 + ox, -27 + oy); ctx.quadraticCurveTo(33 + ox, -22 + oy, 28 + ox, -22 + oy); ctx.lineTo(-28 + ox, -22 + oy); ctx.quadraticCurveTo(-33 + ox, -22 + oy, -32 + ox, -27 + oy); ctx.closePath(); }, flatM(roof, mix(roof, '#3a1a10', 0.3)));
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(-24, -30); ctx.lineTo(0, -50); ctx.lineTo(4, -47); ctx.lineTo(-18, -30); ctx.closePath(); ctx.fill();
    V.paint(ctx, (ox, oy) => rr(ctx, 14 + ox, -56 + oy, 7, 14, 2), flatM('#E8D3AE'));
    // mailbox
    ctx.fillStyle = P.wood; ctx.fillRect(34, -12, 2, 12); V.paint(ctx, (ox, oy) => rr(ctx, 30 + ox, -18 + oy, 10, 7, 3), flatM(roof));
    ctx.restore();
  }
  function tent(ctx, x, y, t) {
    V.shadow(ctx, x + 4, y + 2, 32, 8, 0.22, '#2c5a3a');
    V.paint(ctx, (ox, oy) => rr(ctx, x - 24 + ox, y - 16 + oy, 48, 16, 3), flatM('#FFF4DC', '#E8D3AE'));
    for (let i = 0; i < 6; i++) V.paint(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(x - 30 + i * 10 + ox, y - 18 + oy); ctx.lineTo(x - 20 + i * 10 + ox, y - 18 + oy); ctx.lineTo(x - 16 + i * 10 + ox, y - 36 + oy); ctx.lineTo(x - 26 + i * 10 + ox, y - 36 + oy); ctx.closePath(); }, flatM(i % 2 ? '#FFFFFF' : P.teal));
    for (const [ix, id] of [[-12, 'apple'], [0, 'cake'], [12, 'flower']]) OC.V.item(ctx, id, x + ix, y - 8, 10, { mode: 'flat', noShadow: true });
  }
  function bed(ctx, x, y, seed) { const r = rng(seed); const cols = [P.coral, P.yellow, '#FFFFFF', P.pink, P.purple]; for (let i = 0; i < 9; i++) { const fx = x + (i % 3) * 7 - 7 + r() * 2, fy = y + Math.floor(i / 3) * 5 - 5; ctx.fillStyle = '#3E9C3A'; ellipse(ctx, fx, fy + 2, 3, 1.6); ctx.fill(); ctx.fillStyle = cols[(i + seed) % cols.length]; for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5; ellipse(ctx, fx + Math.cos(a) * 1.5, fy - 1 + Math.sin(a) * 1.5, 1.2, 1.2); ctx.fill(); } ctx.fillStyle = P.yellow; ellipse(ctx, fx, fy - 1, 0.8, 0.8); ctx.fill(); } }
  function lamp(ctx, x, y, night) { V.shadow(ctx, x, y, 5, 2, 0.2); ctx.fillStyle = '#6B4F3A'; rr(ctx, x - 1.2, y - 20, 2.4, 20, 1); ctx.fill(); V.paint(ctx, El(ctx, x, y - 23, 4, 4.5), flatM(night > 0.4 ? '#FFE08A' : '#FFF8E7')); }

  const PROPS = [];
  (function () {
    [[118, 212, 0.95, 1], [300, 214, 1, 2], [60, 372, 1, 3], [150, 360, 0.8, 4], [342, 380, 0.9, 5], [86, 520, 1, 6], [246, 556, 0.85, 7], [290, 330, 0.75, 8]].forEach(([x, y, s, sd]) => PROPS.push({ k: 'tree', x, y, s, sd, fr: sd % 3 === 0 ? '#F2575B' : sd % 3 === 1 ? '#FF9A3C' : '#FFD23F' }));
    [[44, 588, 1, 1], [352, 600, 0.95, 2], [150, 632, 0.85, 3]].forEach(([x, y, s, sd]) => PROPS.push({ k: 'palm', x, y, s, sd }));
    PROPS.push({ k: 'house', x: 196, y: 262, s: 1, roof: P.coral, sd: 1 });
    PROPS.push({ k: 'house', x: 108, y: 452, s: 0.9, roof: P.yellow, sd: 2 });
    PROPS.push({ k: 'tent', x: 248, y: 470 });
    [[190, 330, 1], [150, 500, 2], [210, 590, 3], [320, 520, 4]].forEach(([x, y, sd]) => PROPS.push({ k: 'bed', x, y, sd }));
    [[158, 412], [232, 420], [180, 548]].forEach(([x, y]) => PROPS.push({ k: 'lamp', x, y }));
  })();
  const LIGHTS = [[179, 244, 0.8], [213, 244, 0.8], [93, 437, 0.7], [123, 437, 0.7], [158, 389, 0.7], [232, 397, 0.7], [180, 525, 0.7]];

  function riverPath(ctx) { ctx.beginPath(); ctx.moveTo(RIVER[0][0], RIVER[0][1]); for (let i = 1; i < RIVER.length - 1; i++) { const mx = (RIVER[i][0] + RIVER[i + 1][0]) / 2, my = (RIVER[i][1] + RIVER[i + 1][1]) / 2; ctx.quadraticCurveTo(RIVER[i][0], RIVER[i][1], mx, my); } const L = RIVER[RIVER.length - 1]; ctx.lineTo(L[0], L[1]); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }

  function drawIsle(ctx, o) {
    const t = o.t, night = o.night || 0, cam = o.cam || { x: 200, y: 400, z: 1 };
    ctx.save();
    ctx.fillStyle = mix(P.sea, '#3A4E9A', night); ctx.fillRect(0, 0, 360, 640);
    ctx.translate(180, 320); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    // sea sparkle ripples
    const r = rng(4);
    for (let i = 0; i < 40; i++) { const x = -80 + r() * 560, y = -40 + r() * 820, ph = r() * TAU, a = Math.max(0, Math.sin(t * 1.5 + ph)); ctx.fillStyle = `rgba(255,255,255,${0.6 * a})`; rr(ctx, x - 4, y - 1, 8 + a * 4, 2, 1); ctx.fill(); }
    // shallow + foam rings
    ctx.fillStyle = mix(P.shallow, '#5A6EB4', night); V.blob(ctx, MAIN.cx, MAIN.cy + 8, MAIN.rx + 22, MAIN.ry + 22, MAIN.seed); ctx.fill();
    const fq = (t * 0.5) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.9 - fq * 0.6})`; ctx.lineWidth = 3; V.blob(ctx, MAIN.cx, MAIN.cy + 6, MAIN.rx + 6 + fq * 10, MAIN.ry + 6 + fq * 10, MAIN.seed); ctx.stroke();
    // pier
    V.paint(ctx, (ox, oy) => rr(ctx, 186 + ox, 600 + oy, 28, 70, 3), flatM('#D9A26A', '#B07E4B'));
    ctx.strokeStyle = '#B07E4B'; ctx.lineWidth = 1; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.moveTo(186, 606 + k * 7.5); ctx.lineTo(214, 606 + k * 7.5); ctx.stroke(); }
    // beach + grass with lawn stripes
    ctx.fillStyle = P.sand; V.blob(ctx, MAIN.cx, MAIN.cy, MAIN.rx, MAIN.ry, MAIN.seed); ctx.fill();
    ctx.save(); V.blob(ctx, MAIN.cx, MAIN.cy - 14, MAIN.rx - 18, MAIN.ry - 34, MAIN.seed + 0.5); ctx.clip();
    ctx.fillStyle = mix(P.grassA, '#4E7A6A', night * 0.2); ctx.fillRect(-100, -100, 600, 900);
    ctx.fillStyle = mix(P.grassB, '#46705F', night * 0.2); ctx.save(); ctx.translate(200, 400); ctx.rotate(-0.5); for (let k = -20; k < 20; k += 2) ctx.fillRect(-500, k * 14, 1000, 14); ctx.restore();
    // grass tufts
    ctx.fillStyle = P.grassLo; const r2 = rng(6); for (let i = 0; i < 70; i++) { const x = 30 + r2() * 340, y = 200 + r2() * 420; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 1.5, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + 1.5, y - 5); ctx.lineTo(x + 3, y); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; V.blob(ctx, MAIN.cx, MAIN.cy - 14, MAIN.rx - 18, MAIN.ry - 34, MAIN.seed + 0.5); ctx.stroke();
    // sand paths (rounded tiles)
    for (const [x, y] of [[150, 310], [156, 330], [164, 350], [172, 372], [184, 392], [196, 412], [208, 432], [222, 452], [236, 468], [190, 432], [176, 456], [160, 476], [146, 494]]) { V.paint(ctx, (ox, oy) => rr(ctx, x - 7 + ox, y - 5 + oy, 14, 10, 4), flatM('#F7E3A8', '#E2C47E')); }
    // river + bridge
    riverPath(ctx); ctx.lineWidth = 24; ctx.strokeStyle = '#E2C47E'; ctx.stroke();
    riverPath(ctx); ctx.lineWidth = 19; ctx.strokeStyle = mix(P.river, '#4258A8', night); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) { const q = (t * 0.18 + i / 10) % 1, seg = Math.floor(q * (RIVER.length - 1)), f = q * (RIVER.length - 1) - seg, A = RIVER[seg], B = RIVER[seg + 1]; const x = lerp(A[0], B[0], f) + ((i % 3) - 1) * 4, y = lerp(A[1], B[1], f); ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.lineTo(x + 2.5, y + 1); ctx.stroke(); }
    V.paint(ctx, (ox, oy) => rr(ctx, 278 + ox, 372 + oy, 36, 18, 4), flatM('#D9A26A', '#B07E4B'));
    ctx.strokeStyle = '#B07E4B'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(282 + k * 6, 372); ctx.lineTo(282 + k * 6, 390); ctx.stroke(); }
    ctx.fillStyle = P.wood; for (const px of [278, 314]) { rr(ctx, px - 1.5, 366, 3, 10, 1); ctx.fill(); rr(ctx, px - 1.5, 384, 3, 10, 1); ctx.fill(); }
    // terrace: earth cliff with grass lip
    for (let k = TER.h; k > 0; k -= 1.5) { ctx.fillStyle = mix(P.cliff, P.cliffLo, k / TER.h); V.blob(ctx, TER.cx, TER.cy + k, TER.rx, TER.ry, TER.seed); ctx.fill(); }
    ctx.strokeStyle = 'rgba(120,80,40,0.35)'; ctx.lineWidth = 1.5; for (let i = 0; i < 26; i++) { const a = 0.15 + (i / 26) * (Math.PI - 0.3); const x = TER.cx + Math.cos(a) * TER.rx * 0.97, y = TER.cy + Math.sin(a) * TER.ry * 0.97; ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x, y + TER.h - 4); ctx.stroke(); }
    ctx.fillStyle = mix(P.lip, '#46705F', night * 0.2); V.blob(ctx, TER.cx, TER.cy + 4, TER.rx + 1, TER.ry + 1, TER.seed); ctx.fill();
    for (let i = 0; i < 30; i++) { const a = 0.1 + (i / 30) * (Math.PI - 0.2); ellipse(ctx, TER.cx + Math.cos(a) * TER.rx, TER.cy + 4 + Math.sin(a) * TER.ry, 5, 4.5); ctx.fill(); }
    ctx.fillStyle = mix('#8BD566', '#4E7A6A', night * 0.2); V.blob(ctx, TER.cx, TER.cy, TER.rx, TER.ry, TER.seed); ctx.fill();
    // ramp
    V.paint(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(136 + ox, 306 + oy); ctx.lineTo(162 + ox, 306 + oy); ctx.lineTo(168 + ox, 334 + oy); ctx.lineTo(142 + ox, 334 + oy); ctx.closePath(); }, flatM('#F7E3A8', '#E2C47E'));
    // waterfall from terrace into river
    ctx.fillStyle = mix(P.river, '#4258A8', night); rr(ctx, 284, 292, 16, 16, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4; for (let k = 0; k < 4; k++) { const o2 = ((t * 30 + k * 5) % 14); ctx.beginPath(); ctx.moveTo(287 + k * 3.5, 292 + o2); ctx.lineTo(287 + k * 3.5, 296 + o2); ctx.stroke(); }
    for (let k = 0; k < 3; k++) { const q = (t * 0.9 + k / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - q)})`; ellipse(ctx, 292 + (k - 1) * 6, 310, 3 + q * 4, 2 + q * 2); ctx.fill(); }
    // y-sorted
    const list = PROPS.map((p) => ({ y: p.y, p }));
    for (const c of o.chars || []) list.push({ y: c.y, c });
    if (o.towel) list.push({ y: 554, towel: true });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.towel) { V.paint(ctx, (ox, oy) => rr(ctx, 280 + ox, 540 + oy, 40, 20, 4), flatM(P.pink)); ctx.fillStyle = '#fff'; for (let k = 0; k < 4; k++) ctx.fillRect(284 + k * 9, 540, 4, 20); continue; }
      if (it.p) { const p = it.p; if (p.k === 'tree') fruitTree(ctx, p.x, p.y, p.s, t, p.sd, p.fr); else if (p.k === 'palm') palm(ctx, p.x, p.y, p.s, t, p.sd); else if (p.k === 'house') cottage(ctx, p.x, p.y, p.s, t, p.roof, night, p.sd); else if (p.k === 'tent') tent(ctx, p.x, p.y, t); else if (p.k === 'bed') bed(ctx, p.x, p.y, p.sd); else if (p.k === 'lamp') lamp(ctx, p.x, p.y, night); }
      else { const c = it.c; I.ch(ctx, c.d, c.s, c.x, c.y, c.sc || 1, t); if (c.emote) I.emote(ctx, c.emote.kind, c.x + 6, c.y - 58 * (c.sc || 1), c.emote.p); }
    }
    // drifting cloud shadows
    for (let i = 0; i < 2; i++) { const cx = ((t * 10 + i * 280) % 680) - 160, cy = 280 + i * 220; ctx.fillStyle = 'rgba(40,80,90,0.08)'; ellipse(ctx, cx, cy, 70, 30); ctx.fill(); ellipse(ctx, cx + 40, cy - 10, 50, 24); ctx.fill(); }
    ctx.restore();
    if (night > 0.001) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = gradientAt([[0, '#FFFFFF'], [0.35, '#FFE0B8'], [0.6, '#F0A8B0'], [0.8, '#A9AEE6'], [1, '#959DE2']], night); ctx.fillRect(0, 0, 360, 640);
      ctx.globalCompositeOperation = 'screen'; const glow = clamp((night - 0.4) / 0.45);
      for (const [x, y, k] of LIGHTS) { const sx = (x - cam.x) * cam.z + 180, sy = (y - cam.y) * cam.z + 320, R = 34 * k * cam.z; const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R); g.addColorStop(0, `rgba(255,214,120,${0.7 * glow})`); g.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = g; ctx.fillRect(sx - R, sy - R, R * 2, R * 2); }
      const r3 = rng(21); for (let i = 0; i < 30; i++) { const x = r3() * 360, y = r3() * 640; const a = glow * Math.max(0, Math.sin(t * 3 + i)); ctx.fillStyle = `rgba(255,255,220,${a})`; V.icon(ctx, 'sparkle', x, y, 4 + (i % 3), `rgba(255,255,220,${a})`); }
      ctx.restore();
    }
  }

  function drawWoods(ctx, o) {
    const t = o.t;
    ctx.fillStyle = '#7CC860'; ctx.fillRect(0, 0, 360, 640);
    ctx.fillStyle = '#6DBA52'; ctx.save(); ctx.rotate(-0.5); for (let k = -20; k < 40; k += 2) ctx.fillRect(-300, k * 14, 900, 14); ctx.restore();
    ctx.fillStyle = '#F7E3A8'; for (let i = 0; i < 14; i++) { const y = 660 - i * 40, x = 180 + Math.sin(i * 0.6) * 30; rr(ctx, x - 10, y - 7, 20, 14, 5); ctx.fill(); }
    const items = [];
    const cedar = (x, y, s) => items.push({ y, f: () => { V.shadow(ctx, x + 4, y + 1, 18 * s, 5 * s, 0.22, '#2c5a3a'); ctx.save(); ctx.translate(x, y); ctx.scale(s, s); V.paint(ctx, (ox, oy) => rr(ctx, -3 + ox, -10 + oy, 6, 11, 2), flatM(P.wood)); for (let i = 0; i < 3; i++) V.paint(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-15 + i * 3 + ox, -8 - i * 12 + oy); ctx.quadraticCurveTo(ox, -32 - i * 12 + oy, 15 - i * 3 + ox, -8 - i * 12 + oy); ctx.closePath(); }, flatM('#3FA357', '#2C8446')); ctx.restore(); } });
    for (const [x, y, s] of [[40, 120, 1.4], [320, 110, 1.5], [70, 260, 1.5], [300, 280, 1.4], [30, 420, 1.6], [330, 450, 1.5], [80, 600, 1.4], [300, 620, 1.5], [180, 80, 1.2]]) cedar(x, y, s);
    for (const [x, y, c] of [[110, 330, P.coral], [250, 380, P.purple], [120, 520, P.yellow], [250, 560, P.coral]]) items.push({ y, f: () => { V.paint(ctx, (ox, oy) => rr(ctx, x - 2 + ox, y - 7 + oy, 4, 7, 2), flatM('#FFF4DC')); V.paint(ctx, (ox, oy) => { ctx.beginPath(); ctx.ellipse(x + ox, y - 7 + oy, 7, 5.5, 0, Math.PI, TAU); ctx.closePath(); }, flatM(c)); ctx.fillStyle = '#fff'; ellipse(ctx, x - 2, y - 9, 1.2, 1.2); ctx.fill(); } });
    for (const [px, py, pr] of [[200, 420, 14], [160, 520, 11]]) items.push({ y: py - 1, f: () => { ctx.fillStyle = '#8FD4EE'; ellipse(ctx, px, py, pr, pr * 0.42); ctx.fill(); const q = (t * 1.3 + px * 0.01) % 1; ctx.strokeStyle = `rgba(255,255,255,${1 - q})`; ctx.lineWidth = 1.2; ellipse(ctx, px, py, 2 + q * pr * 0.7, (2 + q * pr * 0.7) * 0.42); ctx.stroke(); } });
    for (const c of o.chars || []) items.push({ y: c.y, f: () => I.ch(ctx, c.d, c.s, c.x, c.y, c.sc || 1, t) });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.f());
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; const r = rng(5);
    for (let i = 0; i < 60; i++) { const sp = 260 + r() * 100, x0 = r() * 400, y = ((t * sp + r() * 700) % 700) - 30, x = x0 - y * 0.15; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1.5, y + 8); ctx.stroke(); }
    ctx.fillStyle = 'rgba(120,170,220,0.12)'; ctx.fillRect(0, 0, 360, 640);
  }

  OC.IS.WORLD = { drawIsle, drawWoods, fruitTree, palm, cottage };
})();
