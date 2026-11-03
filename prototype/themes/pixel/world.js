/* Scheme B — Pixel Grove : world (300x560 px map, 270x480 view, integer camera & zoom) */
(function () {
  'use strict';
  const { clamp, rng, lerp, gradientAt } = OC;
  const { P, rect, oval, poly, line, bmp, sprite, blit, quantize, R } = OC.X;
  const CH = () => OC.X.CHAR;

  const MW = 300, MH = 560;
  let STATIC = null;

  function rrect(x, X0, Y0, w, h, r, c) { rect(x, X0 + r, Y0, w - 2 * r, h, c); rect(x, X0, Y0 + r, w, h - 2 * r, c); for (const [cx, cy] of [[X0 + r, Y0 + r], [X0 + w - r, Y0 + r], [X0 + r, Y0 + h - r], [X0 + w - r, Y0 + h - r]]) oval(x, cx, cy, r, r, c); }
  function tufts(x, x0, y0, w, h, n, seed, cols) { const r = rng(seed); for (let i = 0; i < n; i++) { const tx = R(x0 + r() * w), ty = R(y0 + r() * h), c = cols[i % cols.length]; rect(x, tx, ty, 1, 1, c); rect(x, tx + 2, ty, 1, 1, c); rect(x, tx + 1, ty + 1, 1, 1, c); } }
  function cliff(x, x0, y0, w, h) {
    rect(x, x0, y0, w, h, P.s1);
    for (let i = 0; i < w; i += 4) { rect(x, x0 + i, y0 + 1, 1, h - 2, P.s0); rect(x, x0 + i + 2, y0 + 2, 1, h - 4, P.s2); }
    rect(x, x0, y0, w, 2, P.g2); rect(x, x0, y0 + h - 1, w, 1, P.k1);
  }

  function buildStatic() {
    const cv = OC.makeCanvas(MW, MH), x = cv.getContext('2d');
    // sand rim + main land
    rrect(x, 12, 36, 276, 452, 30, P.e5);
    cliff(x, 26, 486, 248, 12); rrect(x, 14, 470, 18, 20, 8, P.e5); rrect(x, 268, 470, 18, 20, 8, P.e5);
    rrect(x, 18, 40, 264, 444, 26, P.g4);
    tufts(x, 22, 190, 256, 290, 260, 3, [P.g3, P.g5]);
    // flowers carpet patches
    const r = rng(9);
    for (let i = 0; i < 90; i++) { const fx = 30 + r() * 240, fy = 210 + r() * 260; if (Math.hypot((fx - 75) / 44, (fy - 330) / 26) < 1) continue; rect(x, R(fx), R(fy), 1, 1, [P.white, P.pk, P.r4, P.p3][i % 4]); rect(x, R(fx), R(fy) + 1, 1, 1, P.g2); }
    // plateau (upper level)
    rrect(x, 36, 64, 214, 118, 18, P.g5);
    tufts(x, 42, 70, 200, 104, 120, 5, [P.g4, P.g6]);
    cliff(x, 44, 182, 198, 13); rect(x, 36, 170, 8, 12, P.g5); rect(x, 242, 170, 8, 12, P.g5);
    // stairs
    for (let i = 0; i < 5; i++) { rect(x, 58, 180 + i * 3.4, 18, 3, i % 2 ? P.c2 : P.e5); rect(x, 58, 182 + i * 3.4, 18, 1, P.e3); }
    // path (dirt blobs)
    const path = [[67, 200], [78, 214], [92, 228], [108, 240], [126, 250], [146, 262], [166, 276], [184, 290], [200, 304], [212, 318], [100, 262], [92, 282], [96, 298]];
    for (const [px, py] of path) oval(x, px, py, 9, 6, P.e4);
    for (const [px, py] of path) { oval(x, px - 1, py - 1, 7, 4, P.e5); rect(x, px + 3, py + 2, 2, 1, P.e3); }
    // pond
    oval(x, 75, 331, 37, 21, P.s2); oval(x, 75, 330, 35, 19, P.w2); oval(x, 73, 328, 30, 15, P.w3);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; rect(x, R(75 + Math.cos(a) * 36), R(331 + Math.sin(a) * 20), 3, 2, i % 3 ? P.s3 : P.s1); }
    for (const [lx, ly] of [[58, 334], [88, 340], [66, 322]]) { oval(x, lx, ly, 4, 2.4, P.g2); rect(x, lx + 1, ly - 1, 2, 1, P.g3); }
    rect(x, 57, 333, 2, 1, P.pk);
    // garden rows
    for (let i = 0; i < 4; i++) { rect(x, 168, 384 + i * 10, 70, 6, P.e2); rect(x, 168, 384 + i * 10, 70, 1, P.e1); for (let k = 0; k < 9; k++) { rect(x, 172 + k * 8, 382 + i * 10, 1, 3, P.g2); rect(x, 171 + k * 8, 381 + i * 10, 3, 1, P.g3); } }
    // pier
    for (let i = 0; i < 6; i++) { rect(x, 232, 494 + i * 8, 22, 7, i % 2 ? P.e3 : P.e4); rect(x, 232, 500 + i * 8, 22, 1, P.e1); }
    rect(x, 232, 540, 2, 8, P.e1); rect(x, 252, 540, 2, 8, P.e1);
    // fence on plateau
    for (let i = 0; i < 7; i++) rect(x, 188 + i * 7, 158, 2, 8, P.e2);
    rect(x, 188, 160, 44, 1, P.e3); rect(x, 188, 163, 44, 1, P.e3);
    return cv;
  }

  // ---------------- props ----------------
  function tree(x, tx, ty, t, seed, kind) {
    const sw = Math.floor(t * 2 + seed) % 4 === 0 ? 1 : 0; // stepped sway
    rect(x, tx - 9, ty - 1, 18, 3, 'rgba(10,25,20,0.35)');
    if (kind === 'pine') {
      rect(x, tx - 1, ty - 7, 3, 7, P.e1);
      for (let i = 0; i < 3; i++) { const w = 11 - i * 3, yy = ty - 8 - i * 7; poly(x, [[tx - w + sw, yy], [tx + sw * (i > 0 ? 1 : 0), yy - 11], [tx + w + sw, yy]], P.g1); poly(x, [[tx - w + 3 + sw, yy - 1], [tx + sw, yy - 9], [tx + 1 + sw, yy - 1]], P.g2); }
      return;
    }
    rect(x, tx - 2, ty - 10, 4, 10, P.e1); rect(x, tx - 1, ty - 10, 1, 9, P.e2);
    const s = sw;
    oval(x, tx + s, ty - 20, 13, 10, P.g1);
    oval(x, tx - 5 + s, ty - 24, 8, 7, P.g2); oval(x, tx + 5 + s, ty - 23, 8, 7, P.g2); oval(x, tx + s, ty - 28, 8, 6, P.g2);
    oval(x, tx - 6 + s, ty - 26, 4, 3, P.g3); oval(x, tx + 2 + s, ty - 30, 4, 3, P.g3); oval(x, tx + 7 + s, ty - 24, 3, 2, P.g3);
    rect(x, tx - 7 + s, ty - 28, 2, 1, P.g4); rect(x, tx + 1 + s, ty - 32, 2, 1, P.g4);
    const r = rng(seed * 7); for (let i = 0; i < 3; i++) rect(x, R(tx - 8 + r() * 16 + s), R(ty - 30 + r() * 14), 1, 1, seed % 2 ? P.r2 : P.pk);
  }
  function house(x, hx, hy, t, roof, roofLo, night, seed) {
    rect(x, hx - 26, hy - 1, 54, 4, 'rgba(10,25,20,0.35)');
    // walls
    rect(x, hx - 24, hy - 24, 48, 24, P.c1); rect(x, hx - 24, hy - 24, 48, 2, P.c2);
    for (const bx of [-24, -9, 8, 22]) rect(x, hx + bx, hy - 24, 2, 24, P.e3);
    rect(x, hx - 24, hy - 2, 48, 2, P.e2);
    // door
    rect(x, hx - 4, hy - 15, 9, 15, P.e1); rect(x, hx - 3, hy - 14, 7, 14, P.e2); rect(x, hx + 2, hy - 8, 1, 1, P.r4);
    // windows
    const wc = night > 0.5 ? P.r4 : P.w4;
    for (const wx of [-18, 12]) { rect(x, hx + wx - 1, hy - 18, 9, 8, P.e2); rect(x, hx + wx, hy - 17, 7, 6, wc); rect(x, hx + wx + 3, hy - 17, 1, 6, P.e2); rect(x, hx + wx, hy - 15, 7, 1, P.e2); if (night < 0.5) rect(x, hx + wx + 1, hy - 16, 1, 1, P.white); }
    // roof (tiles)
    poly(x, [[hx - 30, hy - 22], [hx - 18, hy - 44], [hx + 18, hy - 44], [hx + 30, hy - 22]], roofLo);
    for (let i = 0; i < 5; i++) { const yy = hy - 42 + i * 4; const k = (i * 4 + 2) / 22; rect(x, R(hx - 18 - k * 12), yy, R(36 + k * 24), 2, roof); }
    rect(x, hx - 18, hy - 45, 36, 2, roofLo);
    // chimney + stepped smoke
    rect(x, hx + 12, hy - 52, 6, 10, P.s1); rect(x, hx + 11, hy - 53, 8, 2, P.s0);
    for (let i = 0; i < 3; i++) { const q = ((Math.floor(t * 4) / 4) * 0.4 + i / 3 + seed * 0.2) % 1; const s = 1 + R(q * 3); oval(x, hx + 15 + R(q * 6), hy - 56 - R(q * 22), s, s, q > 0.6 ? P.s3 : P.c0); }
  }
  function lamp(x, lx, ly, night) { rect(x, lx - 3, ly - 1, 7, 2, 'rgba(10,25,20,0.3)'); rect(x, lx, ly - 16, 1, 16, P.s0); rect(x, lx - 2, ly - 20, 5, 5, P.k1); rect(x, lx - 1, ly - 19, 3, 3, night > 0.4 ? P.r5 : P.c1); }
  function bush(x, bx, by, seed) { oval(x, bx, by - 4, 8, 5, P.g2); oval(x, bx - 2, by - 6, 4, 3, P.g3); rect(x, bx + 3, by - 7, 1, 1, P.r2); rect(x, bx - 4, by - 4, 1, 1, P.r2); }

  const PROPS = [];
  (function () {
    const T = (x, y, k) => PROPS.push({ k: 'tree', x, y, kind: k, seed: (x * 7 + y) % 13 });
    T(56, 96); T(248, 92, 'pine'); T(100, 80); T(206, 78, 'pine'); T(232, 120);
    T(24, 224); T(28, 292, 'pine'); T(30, 410); T(278, 236, 'pine'); T(276, 300); T(282, 420); T(64, 468); T(150, 470, 'pine'); T(200, 474);
    PROPS.push({ k: 'house', x: 146, y: 150, roof: P.r2, roofLo: P.r1, seed: 1 });
    PROPS.push({ k: 'house', x: 212, y: 332, roof: P.p2, roofLo: P.p1, seed: 2 });
    for (const [x, y] of [[120, 252], [190, 296], [104, 300]]) PROPS.push({ k: 'lamp', x, y });
    for (const [x, y] of [[40, 360], [130, 360], [258, 370], [118, 420]]) PROPS.push({ k: 'bush', x, y });
  })();
  const LIGHTS = [[128, 141, 1], [158, 141, 1], [194, 323, 1], [224, 323, 1], [120, 233, 0.7], [190, 277, 0.7], [104, 281, 0.7]];

  function water(x, w, h, cx, cy, t, night) {
    rect(x, 0, 0, w, h, night > 0.5 ? P.w1 : P.w2);
    const step = Math.floor(t * 4);
    const r = rng(2);
    for (let i = 0; i < 70; i++) { const wx = r() * (MW + 40) - 20, wy = r() * (MH + 20); const ph = Math.floor(r() * 4); if ((step + ph) % 4 === 3) continue; const ox = (step + ph) % 4 === 1 ? 1 : 0; rect(x, R(wx - cx + ox), R(wy - cy), 4, 1, P.w3); rect(x, R(wx - cx + 4 + ox), R(wy - cy + 1), 2, 1, P.w3); }
    // shoreline foam (stepped)
    const f = step % 2;
    rect(x, 26 - cx, 498 - cy + f, 248, 1, P.w5); rect(x, 30 - cx, 501 - cy + f, 240, 1, P.w4);
  }

  /**
   * draw island into a world buffer. o: {t, cam:{x,y}, z (1|2), night, chars:[{d,s,x,y,emote}]}
   */
  function drawIsland(x, o) {
    if (!STATIC) STATIC = buildStatic();
    const t = o.t, night = o.night || 0, cam = o.cam || { x: 15, y: 0 };
    const vw = x.canvas.width, vh = x.canvas.height;
    const cx = R(cam.x), cy = R(cam.y);
    water(x, vw, vh, cx, cy, t, night);
    x.drawImage(STATIC, -cx, -cy);
    // pond ripples (stepped)
    const q = Math.floor(t * 6) % 12;
    if (q < 9) { const rr2 = 2 + q * 2; oval(x, 86 - cx, 334 - cy, rr2, rr2 * 0.5, P.w4); oval(x, 86 - cx, 334 - cy, Math.max(0, rr2 - 1), Math.max(0, rr2 * 0.5 - 1), P.w3); }
    // y-sorted
    const list = PROPS.map((p) => ({ y: p.y, p }));
    for (const c of o.chars || []) list.push({ y: c.y, c });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.p) {
        const p = it.p, px = p.x - cx, py = p.y - cy;
        if (py < -80 || py > vh + 60) continue;
        if (p.k === 'tree') tree(x, px, py, t, p.seed, p.kind);
        else if (p.k === 'house') house(x, px, py, t, p.roof, p.roofLo, night, p.seed);
        else if (p.k === 'lamp') lamp(x, px, py, night);
        else if (p.k === 'bush') bush(x, px, py, p.seed);
      } else {
        const c = it.c;
        CH().draw(x, c.d, c.s, c.x - cx, c.y - cy, 1, t);
        if (c.emote) CH().emote(x, c.emote.kind, c.x - cx + 2, c.y - cy - 28, c.emote.p);
      }
    }
    // drifting leaves (stepped)
    const lr = rng(4);
    for (let i = 0; i < 6; i++) { const sp = 10 + lr() * 8; const lx = R((lr() * 300 + Math.floor(t * 8) / 8 * sp) % 300) - cx, ly = R((lr() * 500 + Math.floor(t * 8) / 8 * sp * 1.4) % 520) - cy; rect(x, lx, ly, 2, 1, P.g5); rect(x, lx + 1, ly + 1, 1, 1, P.g3); }
    if (night > 0.01) light(x, vw, vh, night, t, LIGHTS.map(([a, b, k]) => [a - cx, b - cy, k]));
  }

  function light(x, vw, vh, night, t, lights) {
    x.save();
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = gradientAt([[0, '#FFFFFF'], [0.35, '#FFE2C0'], [0.6, '#D9A6B8'], [0.8, '#9C9FD0'], [1, '#8088C4']], night);
    x.fillRect(0, 0, vw, vh);
    x.globalCompositeOperation = 'lighter';
    const glow = clamp((night - 0.45) / 0.4);
    for (const [lx, ly, k] of lights) {
      const Rr = 26 * k;
      const g = x.createRadialGradient(lx, ly, 0, lx, ly, Rr);
      g.addColorStop(0, `rgba(255,190,110,${0.5 * glow})`); g.addColorStop(1, 'rgba(255,190,110,0)');
      x.fillStyle = g; x.fillRect(lx - Rr, ly - Rr, Rr * 2, Rr * 2);
    }
    x.restore();
    quantize(x, vw, vh);
    // fireflies drawn after quantize: crisp 1px blinkers
    if (glow > 0) { const r = rng(12); for (let i = 0; i < 14; i++) { const fx = R(r() * vw + Math.sin(Math.floor(t * 6) / 6 + i) * 6), fy = R(r() * vh * 0.8 + vh * 0.2 + Math.cos(Math.floor(t * 6) / 6 * 0.8 + i) * 5); if ((Math.floor(t * 6) + i) % 3) { rect(x, fx, fy, 1, 1, P.r5); if (glow > 0.5) { rect(x, fx - 1, fy, 1, 1, P.r4); rect(x, fx + 1, fy, 1, 1, P.r4); } } } }
  }

  // ---------------- forest location ----------------
  function drawForest(x, o) {
    const t = o.t, vw = x.canvas.width, vh = x.canvas.height;
    rect(x, 0, 0, vw, vh, P.g0);
    // misty far layers
    const layers = [[P.g1, 120, 26], [P.g2, 170, 34]];
    layers.forEach(([c, base, h], li) => { for (let i = -1; i < 12; i++) { const tx = i * 26 + li * 13; poly(x, [[tx - 14, base + 40], [tx, base - h - (i % 3) * 8], [tx + 14, base + 40]], c); } rect(x, 0, base + 40, vw, 30, c); });
    // dithered mist band
    for (let y = 150; y < 200; y++) for (let xx = (y % 2); xx < vw; xx += 2) if ((xx + y * 3) % 5 < 2) rect(x, xx, y, 1, 1, P.s3);
    // ground
    rect(x, 0, 220, vw, vh - 220, P.g2); tufts(x, 0, 225, vw, 255, 180, 21, [P.g1, P.g3]);
    // path
    for (let i = 0; i < 30; i++) { const yy = 220 + i * 9, xx = 135 + Math.sin(i * 0.35) * 26; oval(x, xx, yy, 14 + i * 0.6, 6, P.e3); }
    for (let i = 0; i < 30; i++) { const yy = 220 + i * 9, xx = 133 + Math.sin(i * 0.35) * 26; oval(x, xx, yy - 1, 10 + i * 0.5, 4, P.e4); }
    // puddles + ripples
    const st = Math.floor(t * 6);
    for (const [px, py, pr] of [[150, 330, 10], [118, 400, 12], [160, 440, 9]]) { oval(x, px, py, pr, pr * 0.4, P.w2); oval(x, px - 1, py - 1, pr - 2, pr * 0.3, P.w3); const k = (st + px) % 4; oval(x, px + 2, py, k * 2 + 1, k + 0.5, P.w4); oval(x, px + 2, py, k * 2, k, P.w3); }
    // trunks & mushrooms (y-sorted with chars)
    const items = [];
    const trunk = (tx, ty, w) => items.push({ y: ty, f: () => { rect(x, tx - w / 2, -10, w, ty + 10, P.e1); rect(x, tx - w / 2 + 2, -10, 2, ty + 10, P.e2); rect(x, tx + w / 2 - 3, -10, 2, ty + 10, P.k1); oval(x, tx, ty, w * 0.8, 3, P.e1); rect(x, tx - w / 2 - 3, ty - 2, w + 6, 3, P.g1); } });
    trunk(20, 300, 18); trunk(250, 290, 22); trunk(60, 420, 14); trunk(230, 460, 20);
    const mush = (mx, my, c) => items.push({ y: my, f: () => { rect(x, mx - 1, my - 5, 3, 5, P.c0); oval(x, mx, my - 6, 5, 3, c); rect(x, mx - 2, my - 8, 1, 1, P.white); rect(x, mx + 2, my - 7, 1, 1, P.white); } });
    mush(90, 330, P.r2); mush(196, 380, P.p2); mush(84, 452, P.pk); mush(212, 300, P.r3);
    for (const c of o.chars || []) items.push({ y: c.y, f: () => CH().draw(x, c.d, c.s, c.x, c.y, 1, t) });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.f());
    // canopy overhead
    for (let i = 0; i < 9; i++) { oval(x, i * 34 - 4, 6 + (i % 2) * 6, 26, 18, P.g1); oval(x, i * 34, 2 + (i % 2) * 6, 18, 12, P.g2); }
    // rain: 2px diagonal streaks, stepped at 12fps
    if ((o.rain ?? 1) > 0) {
      const rs = Math.floor(t * 12); const r = rng(6);
      for (let i = 0; i < 90; i++) { const sp = 18 + r() * 10, x0 = r() * (vw + 60), y0 = r() * vh; const yy = R((y0 + rs * sp) % (vh + 20)) - 10, xx = R(x0 - yy * 0.25) % (vw + 40); line(x, xx, yy, xx - 2, yy + 6, P.w4); }
      light(x, vw, vh, 0.3, t, [[90, 324, 0.6], [196, 374, 0.6], [84, 446, 0.6], [212, 294, 0.5]]);
    }
  }

  OC.X.WORLD = { drawIsland, drawForest, tree, house, MW, MH };
})();
