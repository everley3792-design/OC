/* Scheme C — Inkpot Tales : character rig (ink storybook critters)
 * Bean body + soft-square head, rubber-hose arms, flat feet. Posed "on twos":
 * shots pass time quantized to 12 fps so poses hold for 2 frames, while the ink
 * outline boils at 8 fps independently. Same state fields as the shared rig.
 */
(function () {
  'use strict';
  const { TAU, clamp, mix, rgba } = OC;
  const { P, ink, blob, blobPts, inkLine, inkPath, hatchArea } = OC.S;

  const DESIGNS = {
    mochi: { fur: '#FBF3E4', shade: '#E9D9BE', inner: '#F2B2A6', cheek: '#E98F86', ears: 'cat', acc: 'kerchief', accCol: P.terra, patch: 'star', tail: 'cat', id: 10 },
    kuri: { fur: '#DDA56C', shade: '#C08654', inner: '#F2C7A8', cheek: '#D8644C', ears: 'bunny', acc: 'cape', accCol: P.teal, patch: 'leaf', tail: 'puff', id: 20 },
    sora: { fur: '#BDB7E3', shade: '#9C94CF', inner: '#F0BCD3', cheek: '#D77FA8', ears: 'bear', acc: 'beanie', accCol: P.plum, patch: null, tail: 'puff', id: 30 },
  };

  function headPts(cx, cy, rx, ry) { // soft-square (superellipse-ish)
    const pts = [];
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU, c = Math.cos(a), s = Math.sin(a); const k = 0.75; pts.push([cx + Math.sign(c) * Math.pow(Math.abs(c), k) * rx, cy + Math.sign(s) * Math.pow(Math.abs(s), k) * ry]); }
    return pts;
  }

  function ear(ctx, D, type, side, s, hx, hy) {
    const fx = s.face || 0, e = (side < 0 ? s.earL : s.earR) || 0;
    const bx = hx + side * 9 + fx * 3, by = hy - 9;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(side * (0.25 + (s.ear || 0)) + side * e);
    const id = D.id + side * 3;
    if (type === 'cat') { ink(ctx, [[-6, 3], [-1, -12], [6, 3]], D.fur, { id, lw: 1.6 }); ink(ctx, [[-3, 1.5], [-1, -6.5], [3, 1.5]], D.inner, { id: id + 1, lw: 0 }); }
    else if (type === 'bunny') { ctx.rotate(side * 0.15); blob(ctx, 0, -11, 4.6, 12, D.fur, { id, lw: 1.6, n: 12 }); blob(ctx, 0, -10, 2, 8, D.inner, { id: id + 1, lw: 0, n: 10 }); }
    else if (type === 'bear') { blob(ctx, 0, -2, 5.5, 5.2, D.fur, { id, lw: 1.6, n: 10 }); blob(ctx, 0, -1.5, 2.6, 2.4, D.inner, { id: id + 1, lw: 0, n: 8 }); }
    else if (type === 'fold') { ink(ctx, [[-6, 3], [-3, -6], [6, -4], [3, 3]], D.shade, { id, lw: 1.6 }); }
    else if (type === 'sprout' && side < 0) { ctx.rotate(0.25); inkLine(ctx, [[0, 2], [0, -6]], 1.6, P.forest2, id); ink(ctx, [[0, -6], [-7, -10], [-1, -12]], P.grass, { id: id + 2 }); ink(ctx, [[0, -6], [7, -11], [1, -13]], P.grass, { id: id + 3 }); }
    ctx.restore();
  }

  function face(ctx, D, s, hx, hy, t) {
    const fx = s.face || 0, blink = s.blink || 0;
    const eyes = s.eyes || 'round';
    const ex = (side) => hx + side * 6.5 * (1 - 0.25 * Math.abs(fx)) + fx * 5.5;
    const ey = hy + 1 + (s.lookY || 0);
    for (const side of [-1, 1]) {
      const x = ex(side), near = side * fx > 0.3, w = near ? 0.6 : 1;
      ctx.save(); ctx.translate(x, ey); ctx.scale(w, 1);
      const closed = blink > 0.5;
      if (eyes === 'happy' || (closed && eyes !== 'sleepy')) inkLine(ctx, eyes === 'happy' ? [[-3, 1.5], [0, -2], [3, 1.5]] : [[-2.6, 0.6], [0, 1.8], [2.6, 0.6]], 1.6, P.ink, D.id + side);
      else if (eyes === 'sleepy') { inkLine(ctx, [[-3, 0], [3, 0.3]], 1.6, P.ink, D.id + side); inkLine(ctx, [[-2, 1.6], [2, 1.8]], 1, P.ink, D.id + side + 9); }
      else if (eyes === 'wide') { blob(ctx, 0, 0, 3.6, 4.2, '#FFFFFF', { lw: 1.3, id: D.id + side * 7, n: 10 }); blob(ctx, side * 0.6, 0.6, 1.7, 2.1, P.ink, { lw: 0, id: D.id + side, n: 8 }); }
      else if (eyes === 'sparkle') { blob(ctx, 0, 0, 2.3, 3, P.ink, { lw: 0, id: D.id + side, n: 8 }); ctx.fillStyle = '#fff'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 0.4 : 1.6; ctx.lineTo(-0.4 + Math.cos(a) * r, -0.8 + Math.sin(a) * r); } ctx.fill(); }
      else if (eyes === 'dot') blob(ctx, 0, 0, 1.4, 1.6, P.ink, { lw: 0, id: D.id + side, n: 6 });
      else { blob(ctx, 0, 0, 2.1, 2.9, P.ink, { lw: 0, id: D.id + side, n: 8 }); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-0.6, -1.1, 0.8, 0, TAU); ctx.fill(); }
      ctx.restore();
      // brows
      const b = s.brows;
      if (b) { const bx = x, by = hy - 4.5; const pts = b === 'up' ? [[bx - 2.5, by - 0.6], [bx, by - 2], [bx + 2.5, by - 0.6]] : b === 'worry' ? [[bx - 2.4 * side, by - 1.4], [bx + 2.4 * side, by + 0.4]] : [[bx - 2.4, by], [bx + 2.4, by - 0.3]]; inkLine(ctx, pts, 1.3, P.ink, D.id + 40 + side); }
      // cheeks: pink wash + 3 hatch ticks
      const cx = x + side * 3.5, cy = hy + 5.2;
      const a = 0.45 + (s.blush || 0) * 0.45;
      if (!(near && Math.abs(fx) > 0.6)) {
        ctx.fillStyle = rgba(D.cheek, a); ctx.beginPath(); ctx.ellipse(cx, cy, 3.4 * w, 2, 0, 0, TAU); ctx.fill();
        for (let k = -1; k <= 1; k++) inkLine(ctx, [[cx + k * 1.5 - 0.5, cy + 1], [cx + k * 1.5 + 0.6, cy - 1]], 0.7, rgba(D.cheek, 0.9 + (s.blush || 0) * 0.1), D.id + 60 + k);
      }
    }
    // mouth
    const mx = hx + fx * 6, my = hy + 6;
    const m = s.mouth === 'chew' ? (Math.floor(t * 8) % 2 ? 'o' : 'flat') : s.mouth || 'cat';
    if (m === 'cat') inkLine(ctx, [[mx - 2.8, my - 0.4], [mx - 1.4, my + 1.2], [mx, my - 0.2], [mx + 1.4, my + 1.2], [mx + 2.8, my - 0.4]], 1.3, P.ink, D.id + 70);
    else if (m === 'smile') inkLine(ctx, [[mx - 3, my - 0.6], [mx, my + 2.2], [mx + 3, my - 0.6]], 1.4, P.ink, D.id + 70);
    else if (m === 'o') blob(ctx, mx, my + 0.6, 1.5, 1.9, P.ink, { lw: 0, id: D.id + 71, n: 8 });
    else if (m === 'open') { ink(ctx, [[mx - 3.5, my - 0.8], [mx + 3.5, my - 0.8], [mx, my + 4.5]], P.ink, { lw: 1.2, id: D.id + 72 }); blob(ctx, mx, my + 2.3, 1.6, 1, P.rose, { lw: 0, id: 3, n: 6 }); }
    else if (m === 'flat') inkLine(ctx, [[mx - 2, my + 0.4], [mx + 2, my + 0.5]], 1.3, P.ink, D.id + 70);
    else if (m === 'wave') inkLine(ctx, [[mx - 3, my], [mx - 1.5, my + 1], [mx, my], [mx + 1.5, my + 1], [mx + 3, my]], 1.2, P.ink, D.id + 70);
  }

  function draw(ctx, D, s, x, y, sc = 1, t = 0) {
    if (typeof D === 'string') D = DESIGNS[D];
    const fx = s.face || 0, back = s.back || 0, walk = s.walk || 0, ph = s.phase || 0;
    const stepS = Math.sin(ph * Math.PI);
    const bob = walk * Math.abs(stepS) * 2.4;
    const br = s.breath || 0, lift = s.lift || 0, sq = s.squash || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    if (!s.noShadow) { ctx.fillStyle = rgba(P.ink, 0.18 * (1 - clamp(lift / 50) * 0.5)); ctx.beginPath(); ctx.ellipse(0, 0.5, 14 * (1 - clamp(lift / 50) * 0.4), 3.6, 0, 0, TAU); ctx.fill(); hatchShadow(ctx, lift); }
    ctx.translate(0, -lift); ctx.rotate(s.lean || 0); ctx.scale(1 / Math.sqrt(sq), sq);
    const by = -13 - bob * 0.5, hy = -35 - bob + br * 0.7 + (s.headDy || 0), hx = fx * 1.5 + (s.headDx || 0);
    const tailSide = fx > 0.15 ? -1 : 1;
    const tail = () => {
      const w = s.tail || 0;
      if (D.tail === 'puff') blob(ctx, tailSide * 10 + w * 2, by + 4, 4.5, 4, D.fur, { id: D.id + 80, lw: 1.5, n: 10 });
      else { ctx.save(); ctx.translate(tailSide * 8, by + 6); inkLine(ctx, [[0, 0], [tailSide * 7, -3], [tailSide * 9 + w * 4, -12], [tailSide * 6 + w * 6, -17]], 5.6, P.ink, D.id + 81, 0.4); inkLine(ctx, [[0, 0], [tailSide * 7, -3], [tailSide * 9 + w * 4, -12], [tailSide * 6 + w * 6, -17]], 3.2, D.fur, D.id + 81, 0.4); ctx.restore(); }
    };
    if (back < 0.5) tail();
    // feet
    for (const side of [-1, 1]) {
      const up = Math.max(0, walk * stepS * -side) * 3;
      const fxo = side * 5 * (1 - 0.4 * Math.abs(fx)) + fx * walk * stepS * side * 3;
      blob(ctx, fxo + fx * 1.5, -2.5 - up, 4.6, 2.9, D.shade, { id: D.id + 90 + side, lw: 1.5, n: 10 });
    }
    // body
    const bpts = blobPts(0, by, 11 * (1 + br * 0.015), 12 * (1 + br * 0.02), 16, D.id, 0.03);
    ink(ctx, bpts, D.fur, { id: D.id + 1, lw: 1.7, hatch: { x0: 2, y0: by, x1: 12, y1: by + 12, gap: 2.8, ang: -0.9, col: rgba(P.ink, 0.35) } });
    if (back < 0.5) blob(ctx, fx * 3, by + 3, 6, 6.5, mix(D.fur, '#ffffff', 0.5), { id: D.id + 2, lw: 0, n: 10 });
    if (D.patch === 'star' && back < 0.5) OC.S.icon(ctx, 'star', fx * 3 - 3, by + 4, 7);
    if (D.patch === 'leaf' && back < 0.5) OC.S.icon(ctx, 'leaf', fx * 3 + 3, by + 4, 7);
    // accessory
    if (D.acc === 'kerchief') { ink(ctx, [[-9, by - 9], [9, by - 9], [fx * 4 + 2, by + 1]], D.accCol, { id: D.id + 3, lw: 1.5 }); }
    if (D.acc === 'cape') { ink(ctx, [[-10, by - 9], [10, by - 9], [12, by + 4], [-12, by + 4]], D.accCol, { id: D.id + 3, lw: 1.5 }); blob(ctx, fx * 3, by - 8, 2, 2, P.mustard, { id: 5, lw: 1, n: 6 }); }
    // rubber-hose arms
    for (const side of [-1, 1]) {
      const sw = (side < 0 ? s.armL : s.armR) ?? walk * stepS * side * 0.6;
      const sx = side * 9 * (1 - 0.3 * Math.abs(fx)), sy = by - 5;
      const ang = side * 0.5 + sw * side;
      const ex = sx + Math.sin(ang) * 9 * side * (side), ey = sy + Math.cos(ang) * 9;
      const mx = (sx + ex) / 2 + side * 2.5, my = (sy + ey) / 2;
      inkLine(ctx, [[sx, sy], [mx, my], [ex, ey]], 4.6, P.ink, D.id + 100 + side, 0.3);
      inkLine(ctx, [[sx, sy], [mx, my], [ex, ey]], 2.4, D.fur, D.id + 100 + side, 0.3);
      blob(ctx, ex, ey, 2.4, 2.4, D.fur, { id: D.id + 110 + side, lw: 1.2, n: 8 });
    }
    // head
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(s.tilt || 0);
    const ears = s.ears || D.ears;
    ear(ctx, D, ears, -1, s, 0, 0); ear(ctx, D, ears, 1, s, 0, 0);
    ink(ctx, headPts(0, 0, 15.5, 12.5), D.fur, { id: D.id + 4, lw: 1.9, hatch: { x0: 4, y0: 4, x1: 16, y1: 14, gap: 2.8, ang: -0.9, col: rgba(P.ink, 0.28) } });
    if (back < 0.5) face(ctx, D, s, 0, 0, t);
    else inkLine(ctx, [[-2, -10], [0, -12], [2, -10]], 1.2, P.ink, D.id + 5);
    if (D.acc === 'beanie') { ink(ctx, [[-15, -3], [-13, -11], [-5, -16], [5, -16], [13, -11], [15, -3]], D.accCol, { id: D.id + 6, lw: 1.7 }); inkLine(ctx, [[-14, -4], [14, -4]], 3.6, mix(D.accCol, '#ffffff', 0.35), D.id + 7, 0.3); blob(ctx, (s.tail || 0) * 2, -18, 3.6, 3.4, P.card, { id: D.id + 8, lw: 1.5, n: 10 }); }
    ctx.restore();
    if (back >= 0.5) tail();
    if (s.hold === 'leaf') { ctx.save(); ctx.translate(4, hy - 18); inkLine(ctx, [[0, 0], [3, 18]], 1.6, P.forest2, 3); ink(ctx, [[-24, 3], [-16, -11], [0, -14], [16, -11], [24, 3], [12, -1], [0, 2], [-12, -1]], P.grass, { id: 77, lw: 1.6, hatch: { x0: -20, y0: -4, x1: 20, y1: 3, gap: 3, col: rgba(P.ink, 0.3) } }); ctx.restore(); }
    ctx.restore();
  }
  function hatchShadow(ctx, lift) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(1, 0.8, 12 * (1 - clamp(lift / 50) * 0.4), 3, 0, 0, TAU); ctx.clip(); hatchArea(ctx, { x0: -14, y0: -4, x1: 14, y1: 4, gap: 2.4, ang: -0.6, col: rgba(P.ink, 0.35) }); ctx.restore();
  }
  /** comic emote (screen space) */
  function emote(ctx, kind, x, y, p, sc = 1) {
    if (p <= 0 || p >= 1) return;
    const pop = p < 0.12 ? OC.E.outBack(p / 0.12, 2) : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc * pop, sc * pop);
    if (kind === '!') { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.42; inkLine(ctx, [[Math.cos(a) * 9, Math.sin(a) * 9 - 6], [Math.cos(a) * 16, Math.sin(a) * 16 - 6]], 1.6, P.ink, 200 + i); } OC.text(ctx, '!', 0, -4, { font: OC.S.F(20, 700), color: P.red, align: 'center', base: 'middle', stroke: P.card, strokeW: 3 }); }
    else if (kind === '♥') { for (let i = 0; i < 3; i++) { const q = clamp(p * 1.5 - i * 0.2); if (q <= 0) continue; OC.S.icon(ctx, 'heart', (i - 1) * 9 + Math.sin(q * 6 + i) * 2, -q * 18, 10 - i * 1.5); } }
    else if (kind === 'zzz') { for (let i = 0; i < 3; i++) { const q = (p * 1.5 + i * 0.33) % 1; OC.text(ctx, 'Z', i * 5 + q * 5, -q * 14, { font: OC.S.F(7 + i * 2, 700), color: P.plum, alpha: Math.sin(q * Math.PI) }); } }
    else if (kind === '♪') { OC.text(ctx, '♪', 0, -4, { font: OC.S.F(16, 700), color: P.teal, align: 'center', base: 'middle', stroke: P.card, strokeW: 3 }); }
    ctx.restore();
  }

  OC.S.CHAR = { DESIGNS, draw, emote };
})();
