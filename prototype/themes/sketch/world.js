/* Scheme C — Inkpot Tales : storybook village (oblique top-down, ink + hatch) */
(function () {
  'use strict';
  const { TAU, clamp, lerp, rng, mix, rgba, gradientAt, noise1 } = OC;
  const { P, ink, blob, blobPts, inkLine, inkPath, hatchArea } = OC.S;
  const CH = () => OC.S.CHAR;

  function pine(ctx, x, y, s, t, id) {
    const sw = Math.floor(t * 4 + id) % 2 ? 0.6 : -0.6;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = rgba(P.ink, 0.15); ctx.beginPath(); ctx.ellipse(4, 1, 16, 4.5, 0, 0, TAU); ctx.fill();
    ink(ctx, [[-3, 0], [3, 0], [2.5, -9], [-2.5, -9]], P.wood2, { id: id + 1, lw: 1.4 });
    for (let i = 0; i < 3; i++) { const yy = -8 - i * 11, w = 15 - i * 3.5; ink(ctx, [[-w + sw * i, yy], [sw * (i + 1), yy - 17], [w + sw * i, yy], [0, yy + 3]], i % 2 ? P.forest : P.forest2, { id: id + 10 + i, lw: 1.5, hatch: { x0: 0, y0: yy - 14, x1: w, y1: yy + 2, gap: 2.8, col: rgba(P.ink, 0.35) } }); }
    ctx.restore();
  }
  function roundTree(ctx, x, y, s, t, id) {
    const sw = Math.floor(t * 4 + id) % 2 ? 0.7 : -0.5;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = rgba(P.ink, 0.15); ctx.beginPath(); ctx.ellipse(4, 1, 18, 5, 0, 0, TAU); ctx.fill();
    ink(ctx, [[-3.5, 0], [3.5, 0], [2.5, -16], [-2.5, -16]], P.wood, { id: id + 1, lw: 1.4 });
    blob(ctx, sw, -30, 17, 15, P.grass2, { id: id + 2, lw: 1.6, n: 16, wob: 0.09, hatch: { x0: 0, y0: -26, x1: 18, y1: -14, gap: 2.8, col: rgba(P.ink, 0.35) } });
    blob(ctx, sw - 5, -35, 6, 4.5, P.grass, { id: id + 3, lw: 0, n: 8 });
    const r = rng(id); for (let i = 0; i < 4; i++) blob(ctx, sw - 10 + r() * 20, -38 + r() * 16, 1.6, 1.6, id % 2 ? P.red : P.mustard, { id: id + 20 + i, lw: 0.8, n: 6 });
    ctx.restore();
  }
  function acornHouse(ctx, x, y, s, t, night, id, cap = P.wood2, wall = P.cream) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = rgba(P.ink, 0.18); ctx.beginPath(); ctx.ellipse(6, 1, 36, 8, 0, 0, TAU); ctx.fill();
    blob(ctx, 0, -18, 28, 20, wall, { id: id, lw: 1.8, n: 18, wob: 0.03, hatch: { x0: 8, y0: -18, x1: 28, y1: 2, gap: 3, col: rgba(P.ink, 0.3) } });
    // door
    ink(ctx, [[-7, 0], [-7, -12], [-4, -17], [4, -17], [7, -12], [7, 0]], P.terra, { id: id + 1, lw: 1.6 });
    blob(ctx, 3.5, -7, 1, 1, P.mustard, { id: 2, lw: 0.6, n: 6 });
    // round window
    const glow = night > 0.5;
    blob(ctx, -17, -18, 5.5, 5.5, glow ? '#FFD884' : P.sky, { id: id + 2, lw: 1.5, n: 10 });
    inkLine(ctx, [[-22, -18], [-12, -18]], 1, P.ink, id + 3); inkLine(ctx, [[-17, -23], [-17, -13]], 1, P.ink, id + 4);
    // acorn cap roof
    ink(ctx, [[-34, -26], [-30, -42], [-14, -52], [14, -52], [30, -42], [34, -26], [20, -22], [0, -21], [-20, -22]], cap, { id: id + 5, lw: 1.9 });
    ctx.save(); inkPath(ctx, [[-34, -26], [-30, -42], [-14, -52], [14, -52], [30, -42], [34, -26], [20, -22], [0, -21], [-20, -22]], true, id + 5, 0); ctx.clip();
    ctx.strokeStyle = rgba(P.ink, 0.45); ctx.lineWidth = 0.9;
    for (let i = -40; i < 40; i += 5) { ctx.beginPath(); ctx.moveTo(i, -20); ctx.lineTo(i + 12, -54); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, -20); ctx.lineTo(i - 12, -54); ctx.stroke(); }
    ctx.restore();
    ink(ctx, [[-2.5, -51], [2.5, -51], [3.5, -60], [-1, -61]], P.wood, { id: id + 6, lw: 1.5 });
    // chimney smoke as ink curls
    for (let i = 0; i < 3; i++) { const q = (Math.floor(t * 8) / 8 * 0.3 + i / 3 + id * 0.1) % 1; ctx.globalAlpha = 1 - q; inkLine(ctx, [[18 + q * 6, -52 - q * 24], [22 + q * 8, -56 - q * 26], [18 + q * 10, -60 - q * 28]], 1.2, P.ink2, id + 30 + i); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function lantern(ctx, x, y, night, id) {
    inkLine(ctx, [[x, y], [x, y - 22]], 1.6, P.ink, id);
    blob(ctx, x, y - 25, 4, 4.6, night > 0.45 ? '#FFD884' : P.terra, { id: id + 1, lw: 1.4, n: 8 });
  }
  function flowerDots(ctx, x, y, c, id) { for (let i = 0; i < 3; i++) blob(ctx, x + i * 4 - 4, y + (i % 2) * 2, 1.7, 1.7, c, { id: id + i, lw: 0.8, n: 6 }); }

  const PROPS = [];
  (function () {
    const r = rng(31);
    [[30, 112, 0.9, 'p'], [74, 98, 1.0, 'p'], [258, 100, 1.0, 'p'], [312, 112, 0.95, 'p'], [345, 96, 0.8, 'p'], [8, 96, 0.8, 'p'],
      [28, 300, 1.1, 'r'], [336, 250, 1.0, 'r'], [40, 600, 1.2, 'p'], [330, 640, 1.1, 'r'], [190, 660, 0.9, 'p'], [350, 430, 0.9, 'p'], [16, 420, 1.0, 'r']].forEach(([x, y, s, k], i) => PROPS.push({ k: k === 'p' ? 'pine' : 'tree', x, y, s, id: 300 + i * 17 }));
    PROPS.push({ k: 'house', x: 106, y: 268, s: 1, id: 500, cap: P.wood2, wall: P.cream });
    PROPS.push({ k: 'house', x: 276, y: 318, s: 0.92, id: 520, cap: '#7E5A8E', wall: '#F3E3C8' });
    PROPS.push({ k: 'house', x: 96, y: 500, s: 0.8, id: 540, cap: P.terra, wall: P.cream });
    [[150, 330], [236, 396], [140, 440]].forEach(([x, y], i) => PROPS.push({ k: 'lamp', x, y, id: 600 + i * 5 }));
    for (let i = 0; i < 26; i++) { const x = 20 + r() * 320, y = 160 + r() * 520; if (Math.hypot(x - 190, (y - 400) * 1.4) < 90) continue; if (Math.hypot(x - 280, y - 540) < 50) continue; PROPS.push({ k: 'flowers', x, y, c: [P.red, P.mustard, P.card, P.rose][i % 4], id: 700 + i * 4 }); }
  })();
  const LIGHTS = [[150, 305, 0.8], [236, 371, 0.8], [140, 415, 0.8], [89, 250, 0.9], [262, 302, 0.9], [83, 486, 0.7]];

  function drawVillage(ctx, o) {
    const t = o.t, night = o.night || 0, cam = o.cam || { x: 180, y: 380, z: 1 };
    ctx.save();
    ctx.fillStyle = P.grass; ctx.fillRect(0, 0, 360, 640);
    ctx.translate(180, 320); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    // ground wash + grass ticks
    ctx.fillStyle = P.grass; ctx.fillRect(-200, -200, 760, 1100);
    const r = rng(5);
    ctx.strokeStyle = rgba(P.grass3, 0.7); ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    for (let i = 0; i < 160; i++) { const x = r() * 380 - 10, y = 120 + r() * 600; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y - 3); ctx.moveTo(x + 2, y); ctx.lineTo(x + 3, y - 3); ctx.stroke(); }
    // cliff ledge + waterfall at top
    ink(ctx, [[-30, -40], [400, -40], [400, 92], [250, 100], [220, 88], [160, 88], [120, 102], [-30, 92]], P.forest2, { id: 11, lw: 1.8 });
    ink(ctx, [[-30, 92], [120, 102], [160, 88], [220, 88], [250, 100], [400, 92], [400, 134], [250, 140], [220, 128], [160, 128], [120, 142], [-30, 134]], P.sand, { id: 12, lw: 1.8, hatch: { x0: -30, y0: 100, x1: 400, y1: 140, gap: 3.4, ang: -1.2, col: rgba(P.ink, 0.28) } });
    for (const yy of [110, 122]) inkLine(ctx, [[-30, yy], [100, yy + 6], [150, yy - 4], [230, yy - 4], [260, yy + 6], [400, yy]], 0.9, rgba(P.ink, 0.5), yy);
    // waterfall
    ink(ctx, [[166, 90], [214, 90], [218, 134], [162, 134]], P.water, { id: 13, lw: 1.6 });
    const ws = Math.floor(t * 10);
    for (let i = 0; i < 7; i++) { const xx = 170 + i * 7, o2 = ((ws * 4 + i * 9) % 40); inkLine(ctx, [[xx, 92 + o2 * 0.5], [xx + 0.5, 100 + o2]], 1.2, '#FFFFFF', 900 + i); }
    blob(ctx, 190, 146, 42, 14, P.water, { id: 14, lw: 1.7, n: 16 });
    for (let i = 0; i < 3; i++) { const q = ((t * 0.8 + i / 3) % 1); ctx.strokeStyle = rgba('#FFFFFF', 1 - q); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(190, 144, 12 + q * 26, 4 + q * 8, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
    // paths & plaza
    ink(ctx, [[176, 156], [204, 156], [214, 250], [206, 330], [172, 330], [166, 250]], P.sand, { id: 15, lw: 1.5 });
    ink(ctx, [[176, 460], [208, 460], [222, 560], [214, 700], [168, 700], [160, 560]], P.sand, { id: 16, lw: 1.5 });
    ink(ctx, [[120, 390], [60, 410], [40, 470], [56, 476], [80, 430], [130, 412]], P.sand, { id: 17, lw: 1.4 });
    blob(ctx, 190, 398, 82, 58, P.sand, { id: 18, lw: 1.8, n: 22, wob: 0.02 });
    blob(ctx, 190, 398, 34, 22, P.paper2, { id: 19, lw: 1.4, n: 16 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; blob(ctx, 190 + Math.cos(a) * 56, 398 + Math.sin(a) * 38, 7, 4.5, P.paper3, { id: 40 + i, lw: 1, n: 8 }); }
    inkLine(ctx, [[180, 398], [190, 392], [200, 398], [190, 404], [180, 398]], 1.2, P.terra, 60);
    // pond
    blob(ctx, 284, 548, 48, 26, P.water, { id: 20, lw: 1.8, n: 18, hatch: { x0: 260, y0: 552, x1: 330, y1: 575, gap: 3, ang: 0, col: rgba(P.water2, 0.8) } });
    for (const [lx, ly] of [[262, 544], [300, 556], [276, 534]]) ink(ctx, [[lx - 5, ly], [lx, ly - 3], [lx + 5, ly], [lx, ly + 3], [lx, ly]], P.grass2, { id: lx, lw: 1.1 });
    { const q = (t * 0.6) % 1; ctx.strokeStyle = rgba(P.ink, 0.5 * (1 - q)); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(292, 548, 4 + q * 20, 2 + q * 9, 0, 0, TAU); ctx.stroke(); }
    // garden box + fence
    ink(ctx, [[224, 440], [300, 440], [300, 470], [224, 470]], P.wood2, { id: 21, lw: 1.5 });
    for (let i = 0; i < 6; i++) blob(ctx, 234 + i * 12, 452, 4, 3, P.grass2, { id: 70 + i, lw: 1, n: 7 });
    for (let i = 0; i < 6; i++) inkLine(ctx, [[30 + i * 12, 210], [30 + i * 12, 196]], 2.2, P.wood2, 80 + i);
    inkLine(ctx, [[26, 200], [96, 200]], 1.6, P.wood2, 88); inkLine(ctx, [[26, 206], [96, 206]], 1.6, P.wood2, 89);

    // y-sorted
    const list = PROPS.map((p) => ({ y: p.y, p }));
    for (const c of o.chars || []) list.push({ y: c.y, c });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.p) {
        const p = it.p;
        if (p.k === 'pine') pine(ctx, p.x, p.y, p.s, t, p.id);
        else if (p.k === 'tree') roundTree(ctx, p.x, p.y, p.s, t, p.id);
        else if (p.k === 'house') acornHouse(ctx, p.x, p.y, p.s, t, night, p.id, p.cap, p.wall);
        else if (p.k === 'lamp') lantern(ctx, p.x, p.y, night, p.id);
        else if (p.k === 'flowers') flowerDots(ctx, p.x, p.y, p.c, p.id);
      } else {
        const c = it.c;
        CH().draw(ctx, c.d, c.s, c.x, c.y, c.sc || 1, t);
        if (c.emote) CH().emote(ctx, c.emote.kind, c.x + 4, c.y - 58 * (c.sc || 1), c.emote.p);
      }
    }
    ctx.restore();
    if (night > 0.01) lightPass(ctx, night, t, LIGHTS.map(([x, y, k]) => [(x - cam.x) * cam.z + 180, (y - cam.y) * cam.z + 320, k * cam.z]));
  }
  function lightPass(ctx, night, t, lights) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = gradientAt([[0, '#FFFFFF'], [0.35, '#FFE1BE'], [0.6, '#E6A9A0'], [0.8, '#9C9AC6'], [1, '#8288BC']], night);
    ctx.fillRect(0, 0, 360, 640);
    ctx.globalCompositeOperation = 'screen';
    const glow = clamp((night - 0.45) / 0.4);
    for (const [x, y, k] of lights) { const R = 40 * k; const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, `rgba(255,200,120,${0.6 * glow})`); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2); }
    for (let i = 0; i < 14; i++) { const x = 30 + ((i * 97) % 300) + Math.sin(t + i) * 10, y = 200 + ((i * 53) % 380) + Math.cos(t * 0.8 + i) * 8; const a = glow * (0.5 + 0.5 * Math.sin(t * 3 + i)); ctx.fillStyle = `rgba(255,236,150,${a})`; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawForest(ctx, o) {
    const t = o.t;
    ctx.fillStyle = '#CFDCCB'; ctx.fillRect(0, 0, 360, 640);
    // far trunks (washed)
    for (let i = 0; i < 9; i++) { const x = i * 44 + 10; ctx.fillStyle = rgba(P.forest, 0.25); ctx.fillRect(x, 0, 14, 300); }
    ctx.fillStyle = P.grass2; ctx.fillRect(0, 280, 360, 360);
    const r = rng(8); ctx.strokeStyle = rgba(P.forest2, 0.6); ctx.lineWidth = 0.9;
    for (let i = 0; i < 120; i++) { const x = r() * 360, y = 290 + r() * 350; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y - 3); ctx.stroke(); }
    ink(ctx, [[150, 280], [196, 280], [230, 400], [250, 520], [236, 650], [140, 650], [128, 520], [140, 400]], P.sand, { id: 801, lw: 1.6 });
    for (const [px, py, pr] of [[180, 420, 12], [210, 520, 16], [160, 580, 11]]) { blob(ctx, px, py, pr, pr * 0.4, P.water, { id: px, lw: 1.2, n: 10 }); const q = (t * 1.4 + px * 0.01) % 1; ctx.strokeStyle = rgba(P.ink, 0.6 * (1 - q)); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(px, py, 2 + q * pr * 0.7, (2 + q * pr * 0.7) * 0.4, 0, 0, TAU); ctx.stroke(); }
    const items = [];
    const trunk = (x, y, w, id) => items.push({ y, f: () => { ink(ctx, [[x - w, -20], [x + w, -20], [x + w * 1.1, y], [x - w * 1.1, y]], P.wood2, { id, lw: 1.8, hatch: { x0: x, y0: 0, x1: x + w, y1: y, gap: 3, ang: -0.2, col: rgba(P.ink, 0.4) } }); for (let k = 0; k < 4; k++) inkLine(ctx, [[x - w * 0.5, 60 + k * 70], [x - w * 0.3, 90 + k * 70]], 1, P.ink, id + k); blob(ctx, x, y, w * 1.6, 5, P.forest2, { id: id + 9, lw: 1.4, n: 10 }); } });
    trunk(30, 360, 16, 810); trunk(320, 350, 20, 820); trunk(70, 520, 12, 830); trunk(300, 560, 18, 840);
    const mush = (x, y, c, id) => items.push({ y, f: () => { ink(ctx, [[x - 2, y], [x + 2, y], [x + 2, y - 7], [x - 2, y - 7]], P.card, { id, lw: 1.2 }); ink(ctx, [[x - 8, y - 6], [x - 5, y - 12], [x + 5, y - 12], [x + 8, y - 6]], c, { id: id + 1, lw: 1.4 }); blob(ctx, x - 2, y - 10, 1.2, 1, P.card, { id: id + 2, lw: 0.6, n: 5 }); const g = ctx.createRadialGradient(x, y - 8, 0, x, y - 8, 18); g.addColorStop(0, rgba(c, 0.35)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.fillRect(x - 18, y - 26, 36, 36); } });
    mush(110, 440, P.terra, 850); mush(262, 470, P.plum, 860); mush(96, 610, P.rose, 870);
    for (const c of o.chars || []) items.push({ y: c.y, f: () => CH().draw(ctx, c.d, c.s, c.x, c.y, c.sc || 1, t) });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.f());
    // canopy
    for (let i = 0; i < 8; i++) blob(ctx, i * 52, 10 + (i % 2) * 14, 40, 30, i % 2 ? P.forest : P.forest2, { id: 880 + i, lw: 1.6, n: 14, wob: 0.1 });
    // ferns foreground
    for (const [fx, fl] of [[-4, 1], [364, -1]]) for (let k = 0; k < 5; k++) { ctx.save(); ctx.translate(fx, 650); ctx.rotate(fl * (-1.2 + k * 0.32)); ink(ctx, [[0, 0], [-6, -26], [0, -50], [6, -26]], P.grass3, { id: 890 + k + fx, lw: 1.4 }); ctx.restore(); }
    // rain: ink strokes on 12s
    const rs = Math.floor(t * 12) / 12; const rr2 = rng(9);
    ctx.strokeStyle = rgba(P.ink, 0.45); ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) { const sp = 300 + rr2() * 120, x0 = rr2() * 420; const y = ((rs * sp + rr2() * 700) % 700) - 30, x = x0 - y * 0.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 10); ctx.stroke(); }
    ctx.fillStyle = 'rgba(160,180,190,0.15)'; ctx.fillRect(0, 0, 360, 640);
  }

  OC.S.WORLD = { drawVillage, drawForest, pine, roundTree, acornHouse };
})();
