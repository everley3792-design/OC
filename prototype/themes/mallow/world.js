/* Scheme A — Mallow Mist : 2.5D world (oblique top-down, layered, Y-sorted)
 * No 3D: terraces are 2D shapes extruded by stacking offset fills; depth = Y-sort.
 */
(function () {
  'use strict';
  const { TAU, clamp, lerp, ellipse, rr, mix, rgba, rng, noise1, gradientAt, E } = OC;
  const { P, softShadow } = OC.M;
  const CH = () => OC.M.CHAR;

  function blob(ctx, cx, cy, rx, ry, seed, n = 72) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const k = 1 + 0.045 * Math.sin(3 * a + seed) + 0.03 * Math.sin(5 * a + seed * 2.1) + 0.02 * Math.sin(8 * a + seed * 0.7);
      const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  /** Extruded plateau: cliff by stacking, then soft top with rim light. */
  function plateau(ctx, cx, cy, rx, ry, seed, h, topA, topB, cliffA, cliffB) {
    for (let k = h; k > 0; k -= 1.5) {
      const q = k / h;
      ctx.fillStyle = mix(cliffA, cliffB, q);
      blob(ctx, cx, cy + k, rx, ry, seed); ctx.fill();
    }
    // strata line on the cliff
    ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
    blob(ctx, cx, cy + h * 0.5, rx, ry, seed); ctx.stroke(); ctx.restore();
    const g = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
    g.addColorStop(0, topA); g.addColorStop(1, topB);
    ctx.fillStyle = g; blob(ctx, cx, cy, rx, ry, seed); ctx.fill();
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.6; blob(ctx, cx, cy + 0.6, rx - 1, ry - 1, seed); ctx.stroke(); ctx.restore();
  }

  // ---------------- props ----------------
  function tree(ctx, x, y, s, t, seed, kind = 'puff', night = 0) {
    const sway = Math.sin(t * 1.1 + seed * 1.7) * 1.3 + Math.sin(t * 2.3 + seed) * 0.4;
    softShadow(ctx, x + 4 * s, y + 1, 24 * s, 7 * s, 0.22);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (kind === 'pine') {
      ctx.fillStyle = P.trunk; rr(ctx, -3, -10, 6, 11, 2); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const yy = -14 - i * 13, w = 22 - i * 5;
        ctx.save(); ctx.translate(sway * (0.3 + i * 0.25), 0);
        const g = ctx.createLinearGradient(-w, yy - 14, w, yy + 6); g.addColorStop(0, '#CDEBC0'); g.addColorStop(1, '#8BC5A0');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w, yy + 4); ctx.quadraticCurveTo(0, yy - 26, w, yy + 4); ctx.quadraticCurveTo(0, yy + 9, -w, yy + 4); ctx.fill();
        ctx.restore();
      }
    } else {
      ctx.fillStyle = P.trunk; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-2, -12, -2.5, -22); ctx.lineTo(2.5, -22); ctx.quadraticCurveTo(2, -12, 4, 0); ctx.fill();
      const blobs = [[-11, -30, 14], [11, -31, 13], [0, -42, 16], [-5, -27, 12], [6, -26, 12]];
      blobs.forEach(([bx, by, r], i) => {
        const sx = sway * (0.6 + (-by - 20) / 40);
        const g = ctx.createRadialGradient(bx + sx - r * 0.4, by - r * 0.5, 1, bx + sx, by, r * 1.2);
        g.addColorStop(0, P.leafHi); g.addColorStop(0.55, P.leaf); g.addColorStop(1, P.leafLo);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx + sx, by, r, 0, TAU); ctx.fill();
      });
      // blossoms
      const r = rng(seed * 31);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#FFFFFF' : '#FFD7DC'; ellipse(ctx, -14 + r() * 28 + sway * 0.8, -48 + r() * 26, 1.6, 1.6); ctx.fill(); }
    }
    ctx.restore();
  }
  function bush(ctx, x, y, s, t, seed) {
    softShadow(ctx, x, y, 14 * s, 4 * s, 0.18);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const sw = Math.sin(t * 1.5 + seed) * 0.6;
    for (const [bx, by, r] of [[-7, -6, 7], [6, -6, 7.5], [0, -10, 8]]) {
      const g = ctx.createRadialGradient(bx - 2 + sw, by - 3, 0.5, bx + sw, by, r * 1.2); g.addColorStop(0, '#D9F0C6'); g.addColorStop(1, '#97CB8C');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx + sw, by, r, 0, TAU); ctx.fill();
    }
    for (const [bx, by] of [[-6, -9], [4, -12], [8, -5]]) { ctx.fillStyle = '#F7A1AE'; ellipse(ctx, bx + sw, by, 1.5, 1.5); ctx.fill(); }
    ctx.restore();
  }
  function house(ctx, x, y, s, t, roof, roofLo, night, seed) {
    softShadow(ctx, x + 6, y + 2, 46 * s, 11 * s, 0.24);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    // body
    const g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#FFF9F2'); g.addColorStop(1, '#F1DCCD');
    ctx.fillStyle = g; rr(ctx, -30, -36, 60, 37, 12); ctx.fill();
    // round door
    ctx.fillStyle = '#D6A88E'; ctx.beginPath(); ctx.moveTo(-8, 1); ctx.lineTo(-8, -14); ctx.arc(0, -14, 8, Math.PI, 0); ctx.lineTo(8, 1); ctx.fill();
    ctx.fillStyle = '#F5D3A0'; ellipse(ctx, 4.5, -8, 1.2, 1.2); ctx.fill();
    // windows (glow at night)
    for (const wx of [-19, 19]) {
      const wg = mix('#CFE6F3', '#FFD993', night);
      ctx.fillStyle = '#F0D9C8'; ellipse(ctx, wx, -18, 6.4, 6.4); ctx.fill();
      ctx.fillStyle = wg; ellipse(ctx, wx, -18, 4.8, 4.8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(wx - 4.8, -18); ctx.lineTo(wx + 4.8, -18); ctx.moveTo(wx, -22.8); ctx.lineTo(wx, -13.2); ctx.stroke();
    }
    // chimney + steam
    ctx.fillStyle = '#E9CDBB'; rr(ctx, 14, -66, 9, 16, 3); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const q = (t * 0.32 + i / 4 + seed * 0.13) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - q)})`;
      ellipse(ctx, 18.5 + Math.sin(q * 5 + i) * 3 + q * 8, -70 - q * 28, 3 + q * 5, 3 + q * 5); ctx.fill();
    }
    // dome roof with frosting drip edge
    const rg = ctx.createRadialGradient(-12, -62, 2, 0, -44, 44); rg.addColorStop(0, mix(roof, '#ffffff', 0.45)); rg.addColorStop(1, roofLo);
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.moveTo(-37, -33); ctx.bezierCurveTo(-36, -74, 36, -74, 37, -33);
    for (let i = 0; i <= 8; i++) { const xx = 37 - i * 9.25; ctx.quadraticCurveTo(xx - 4.6, -24 - (i % 2 ? 4 : 0), xx - 9.25, -33); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ellipse(ctx, -14, -57, 7, 3.4, -0.5); ctx.fill();
    ctx.restore();
  }
  function lamp(ctx, x, y, night) {
    softShadow(ctx, x, y, 6, 2, 0.2);
    ctx.fillStyle = '#D6B5A2'; rr(ctx, x - 1.2, y - 22, 2.4, 22, 1.2); ctx.fill();
    ctx.fillStyle = mix('#FFF4E4', '#FFE0A0', night); ellipse(ctx, x, y - 25, 4.6, 5.2); ctx.fill();
    ctx.fillStyle = '#F5A893'; rr(ctx, x - 4.2, y - 31.5, 8.4, 2.6, 1.3); ctx.fill();
  }
  function flower(ctx, x, y, c, t, seed) {
    const sw = Math.sin(t * 2 + seed) * 0.8;
    ctx.strokeStyle = '#94C98A'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sw, y - 5); ctx.stroke();
    ctx.fillStyle = c; for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5; ellipse(ctx, x + sw + Math.cos(a) * 1.5, y - 5 + Math.sin(a) * 1.5, 1.2, 1.2); ctx.fill(); }
    ctx.fillStyle = '#FBE3A0'; ellipse(ctx, x + sw, y - 5, 0.9, 0.9); ctx.fill();
  }

  // static layout ----------------------------------------------------------
  const MAIN = { cx: 200, cy: 392, rx: 178, ry: 212, seed: 1.3, h: 30 };
  const TER = { cx: 214, cy: 254, rx: 116, ry: 66, seed: 4.1, h: 22 };
  const POND = { cx: 98, cy: 476, rx: 46, ry: 25 };
  const PROPS = [];
  (function build() {
    const T = (x, y, s, kind = 'puff') => PROPS.push({ k: 'tree', x, y, s, kind, seed: x * 0.13 + y * 0.07 });
    T(118, 222, 0.95); T(312, 226, 1.05); T(170, 205, 0.75, 'pine'); T(336, 278, 0.8); T(98, 270, 0.7, 'pine');
    T(40, 372, 1.05); T(362, 382, 0.9, 'pine'); T(52, 552, 0.95); T(352, 548, 1.1); T(206, 588, 0.75); T(30, 450, 0.8, 'pine');
    PROPS.push({ k: 'house', x: 244, y: 268, s: 1.0, roof: '#F8B9A6', roofLo: '#E9907E', seed: 1 });
    PROPS.push({ k: 'house', x: 300, y: 482, s: 0.9, roof: '#D5C6F1', roofLo: '#A996D8', seed: 2 });
    for (const [x, y, s] of [[192, 468, 0.9], [342, 430, 0.8], [76, 408, 0.85], [254, 538, 0.95], [150, 560, 0.8]]) PROPS.push({ k: 'bush', x, y, s, seed: x });
    for (const [x, y] of [[176, 356], [274, 446], [136, 452]]) PROPS.push({ k: 'lamp', x, y });
    const r = rng(77);
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU, d = Math.sqrt(r());
      const x = MAIN.cx + Math.cos(a) * d * (MAIN.rx - 30), y = MAIN.cy + 30 + Math.sin(a) * d * (MAIN.ry - 70);
      if (Math.hypot((x - POND.cx) / (POND.rx + 8), (y - POND.cy) / (POND.ry + 8)) < 1) continue;
      if (y < 340 && Math.abs(x - 214) < 120) continue;
      PROPS.push({ k: 'flower', x, y, c: ['#FFFFFF', '#FFD3DA', '#E6DCFA', '#FFE6A8'][i % 4], seed: i });
    }
  })();
  const PATH = [[150, 348], [168, 372], [190, 392], [214, 406], [240, 420], [262, 436], [282, 452], [298, 470], [158, 410], [142, 428], [128, 446]];
  const LIGHTS = [[225, 250, 1], [263, 250, 1], [283, 466, 0.9], [317, 466, 0.9], [176, 331, 0.7], [274, 421, 0.7], [136, 427, 0.7]];

  function lightingTint(night) {
    return gradientAt([[0, '#FFFFFF'], [0.35, '#FFE7D2'], [0.6, '#E7B9C6'], [0.8, '#B4AEDD'], [1, '#A2A7DD']], night);
  }

  /**
   * drawIsland(ctx, o) — ctx already scaled to dp.
   * o: { t, cam:{x,y,z}, night, chars:[{d, s, x, y, sc, emote:{kind,p}}], noHud }
   */
  function drawIsland(ctx, o) {
    const t = o.t, night = o.night || 0, cam = o.cam || { x: 200, y: 400, z: 1 };
    ctx.save();
    // water
    const wg = ctx.createLinearGradient(0, 0, 0, 640);
    wg.addColorStop(0, mix('#BFE3F1', '#5E6FAE', night)); wg.addColorStop(1, mix('#A2D2E8', '#4A5A99', night));
    ctx.fillStyle = wg; ctx.fillRect(0, 0, 360, 640);

    ctx.translate(180, 320); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    // water sparkles
    const r = rng(5);
    for (let i = 0; i < 46; i++) {
      const x = -60 + r() * 520, y = 60 + r() * 700, ph = r() * TAU;
      const a = Math.max(0, Math.sin(t * 1.6 + ph));
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * a})`; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(x - 3 - a * 2, y); ctx.lineTo(x + 3 + a * 2, y); ctx.stroke();
    }
    // shoreline foam rings (waves breathing outwards)
    for (let i = 0; i < 3; i++) {
      const q = (t * 0.22 + i / 3) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - q)})`; ctx.lineWidth = 2.2 * (1 - q) + 0.5;
      blob(ctx, MAIN.cx, MAIN.cy + MAIN.h + 2, MAIN.rx + 4 + q * 20, MAIN.ry + 4 + q * 20, MAIN.seed); ctx.stroke();
    }
    // pier (behind island front edge water)
    ctx.fillStyle = '#E3C3AA';
    for (let i = 0; i < 5; i++) { rr(ctx, 296 + i * 3, 594 + i * 11, 28, 8, 2.5); ctx.fill(); }
    ctx.fillStyle = '#CFAE97'; for (const [px, py] of [[298, 610], [322, 610], [304, 640], [328, 640]]) { rr(ctx, px - 1.6, py - 4, 3.2, 12, 1.4); ctx.fill(); }

    // main island
    plateau(ctx, MAIN.cx, MAIN.cy, MAIN.rx, MAIN.ry, MAIN.seed, MAIN.h, P.sand, '#F3DCC0', '#E9CCB4', '#CFA48C');
    ctx.fillStyle = (() => { const g = ctx.createLinearGradient(0, 180, 0, 600); g.addColorStop(0, P.grassHi); g.addColorStop(1, P.grass); return g; })();
    blob(ctx, MAIN.cx, MAIN.cy - 10, MAIN.rx - 14, MAIN.ry - 22, MAIN.seed + 0.4); ctx.fill();
    // soft grass texture dabs
    const r2 = rng(11);
    for (let i = 0; i < 90; i++) {
      const a = r2() * TAU, d = Math.sqrt(r2());
      const x = MAIN.cx + Math.cos(a) * d * (MAIN.rx - 34), y = MAIN.cy + Math.sin(a) * d * (MAIN.ry - 46);
      ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.18)' : 'rgba(130,180,110,0.14)';
      ellipse(ctx, x, y, 6 + r2() * 8, 2.5 + r2() * 2.5); ctx.fill();
    }
    // pond
    ctx.fillStyle = '#C9DDB4'; ellipse(ctx, POND.cx, POND.cy + 1.5, POND.rx + 5, POND.ry + 4.5); ctx.fill();
    const pg = ctx.createLinearGradient(0, POND.cy - POND.ry, 0, POND.cy + POND.ry);
    pg.addColorStop(0, mix('#8CC8E0', '#4E5E9A', night)); pg.addColorStop(1, mix('#B7E1EF', '#6C7AB3', night));
    ctx.fillStyle = pg; ellipse(ctx, POND.cx, POND.cy, POND.rx, POND.ry); ctx.fill();
    ctx.save(); ellipse(ctx, POND.cx, POND.cy, POND.rx, POND.ry); ctx.clip();
    for (let i = 0; i < 3; i++) { // ripples from a drip point
      const q = (t * 0.45 + i / 3) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - q)})`; ctx.lineWidth = 1;
      ellipse(ctx, POND.cx + 10, POND.cy + 4, 3 + q * 26, 1.6 + q * 13); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ellipse(ctx, POND.cx - 18, POND.cy - 10, 12, 2.2); ctx.fill();
    ctx.restore();
    for (const [lx, ly, lr] of [[70, 470, 6], [116, 486, 5], [84, 462, 4]]) { ctx.fillStyle = '#A9D898'; ctx.beginPath(); ctx.ellipse(lx + Math.sin(t + lx) * 0.6, ly, lr, lr * 0.55, 0, 0.4, TAU - 0.1); ctx.lineTo(lx, ly); ctx.fill(); }
    ctx.fillStyle = '#FFD3DA'; ellipse(ctx, 70, 468, 2, 1.6); ctx.fill();

    // path stones
    for (const [x, y] of PATH) { ctx.fillStyle = 'rgba(160,120,110,0.12)'; ellipse(ctx, x, y + 1.6, 9, 4.6); ctx.fill(); ctx.fillStyle = '#FAEBDD'; ellipse(ctx, x, y, 9, 4.6); ctx.fill(); }

    // terrace (upper level)
    plateau(ctx, TER.cx, TER.cy, TER.rx, TER.ry, TER.seed, TER.h, '#D9F0C4', '#C3E3AC', '#EBCDB6', '#D3AA92');
    // stairs carved into terrace cliff
    for (let i = 0; i < 4; i++) { ctx.fillStyle = mix('#FAEBDD', '#E5CBB8', i / 4); rr(ctx, 136 - i * 0.5, 312 + i * 7, 26 + i, 7.5, 2.5); ctx.fill(); }
    // little fence on the terrace
    ctx.fillStyle = '#F2DCCB'; for (let i = 0; i < 6; i++) { rr(ctx, 284 + i * 9, 296 - i * 2.2, 3.5, 10, 1.6); ctx.fill(); } ctx.fillRect(284, 299 - 0, 50, 2);

    // cloud shadows drifting over land
    ctx.save(); blob(ctx, MAIN.cx, MAIN.cy, MAIN.rx, MAIN.ry, MAIN.seed); ctx.clip();
    for (let i = 0; i < 2; i++) {
      const cx = ((t * 9 + i * 260) % 640) - 140, cy = 260 + i * 210;
      const g = ctx.createRadialGradient(cx, cy, 5, cx, cy, 80); g.addColorStop(0, 'rgba(110,120,150,0.13)'); g.addColorStop(1, 'rgba(110,120,150,0)');
      ctx.fillStyle = g; ellipse(ctx, cx, cy, 90, 46); ctx.fill();
    }
    ctx.restore();

    // ---- Y-sorted drawables ----
    const list = PROPS.map((p) => ({ y: p.y, p }));
    for (const c of o.chars || []) list.push({ y: c.y, c });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.p) {
        const p = it.p;
        if (p.k === 'tree') tree(ctx, p.x, p.y, p.s, t, p.seed, p.kind, night);
        else if (p.k === 'house') house(ctx, p.x, p.y, p.s, t, p.roof, p.roofLo, night, p.seed);
        else if (p.k === 'bush') bush(ctx, p.x, p.y, p.s, t, p.seed);
        else if (p.k === 'lamp') lamp(ctx, p.x, p.y, night);
        else if (p.k === 'flower') flower(ctx, p.x, p.y, p.c, t, p.seed);
      } else {
        const c = it.c;
        CH().draw(ctx, c.d, c.s, c.x, c.y, c.sc || 1, t);
        if (c.emote) CH().emote(ctx, c.emote.kind, c.x + 6, c.y - 58 * (c.sc || 1), c.emote.p);
      }
    }
    // falling petals
    const r3 = rng(19);
    for (let i = 0; i < 8; i++) {
      const sp = 0.12 + r3() * 0.08, q = (t * sp + r3()) % 1;
      const x = 20 + r3() * 360 + Math.sin(q * 9 + i) * 10, y = 160 + q * 480;
      ctx.save(); ctx.translate(x, y); ctx.rotate(q * 9 + i); ctx.fillStyle = 'rgba(255,214,222,0.85)'; ellipse(ctx, 0, 0, 2.2, 1.2); ctx.fill(); ctx.restore();
    }
    ctx.restore();

    // ---- lighting pass (screen space) ----
    if (night > 0.001) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = lightingTint(night); ctx.fillRect(0, 0, 360, 640);
      ctx.globalCompositeOperation = 'screen';
      const glow = clamp((night - 0.45) / 0.4);
      const toS = (x, y) => [(x - cam.x) * cam.z + 180, (y - cam.y) * cam.z + 320];
      for (const [x, y, k] of LIGHTS) {
        const [sx, sy] = toS(x, y);
        const R = 34 * k * cam.z * (1 + Math.sin(t * 3 + x) * 0.04);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
        g.addColorStop(0, `rgba(255,205,140,${0.7 * glow})`); g.addColorStop(1, 'rgba(255,200,130,0)');
        ctx.fillStyle = g; ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
      }
      // fireflies
      for (let i = 0; i < 16; i++) {
        const bx = 40 + hashN(i) * 300, by = 300 + hashN(i + 40) * 260;
        const x = bx + Math.sin(t * 0.7 + i) * 14 + noise1(t * 0.5 + i * 3) * 12, y = by + Math.cos(t * 0.6 + i * 2) * 10;
        const [sx, sy] = toS(x, y);
        const a = glow * (0.5 + 0.5 * Math.sin(t * 4 + i * 1.7));
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6); g.addColorStop(0, `rgba(255,240,160,${a})`); g.addColorStop(1, 'rgba(255,240,160,0)');
        ctx.fillStyle = g; ctx.fillRect(sx - 6, sy - 6, 12, 12);
      }
      ctx.restore();
    }
    // overhead drifting clouds (parallax, above everything)
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const x = ((t * (6 + i * 2) + i * 170) % 560) - 120, y = [70, 520, 300][i];
      ctx.globalAlpha = (0.55 - i * 0.12) * (1 - night * 0.5);
      cloud(ctx, x, y, 1 + i * 0.25);
    }
    ctx.restore();
  }
  const hashN = (n) => { const s = Math.sin(n * 91.7 + 13.1) * 43758.5; return s - Math.floor(s); };
  function cloud(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    for (const [cx, cy, r] of [[0, 0, 18], [18, -6, 22], [38, 0, 17], [20, 6, 18]]) {
      const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------------- forest location ----------------
  function drawForest(ctx, o) {
    const t = o.t, rain = o.rain == null ? 1 : o.rain;
    // misty sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, 640);
    g.addColorStop(0, '#DCE8E4'); g.addColorStop(0.5, '#CFE3D3'); g.addColorStop(1, '#B8D9B6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    // far tree silhouettes (3 parallax bands with mist between)
    const bands = [['#C3D8D2', 150, 0.35], ['#A9CDB7', 210, 0.55], ['#93C3A4', 270, 0.8]];
    bands.forEach(([c, y, s], bi) => {
      ctx.fillStyle = c;
      for (let i = -1; i < 9; i++) {
        const x = i * 52 + (bi % 2) * 26 + Math.sin(t * 0.3 + i) * 0.5;
        ctx.beginPath(); ctx.moveTo(x - 30 * s - 10, y + 60); ctx.quadraticCurveTo(x, y - 130 * s - 30, x + 30 * s + 10, y + 60); ctx.fill();
      }
      ctx.fillStyle = 'rgba(240,248,244,0.45)'; ctx.fillRect(0, y + 30, 360, 60);
    });
    // ground: oblique mossy clearing
    const gg = ctx.createLinearGradient(0, 300, 0, 640); gg.addColorStop(0, '#B4DBA6'); gg.addColorStop(1, '#9CCD8F');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(0, 330); ctx.quadraticCurveTo(180, 300, 360, 330); ctx.lineTo(360, 640); ctx.lineTo(0, 640); ctx.fill();
    // winding path
    ctx.fillStyle = '#F2E2CF'; ctx.beginPath(); ctx.moveTo(150, 330); ctx.quadraticCurveTo(110, 430, 175, 500); ctx.quadraticCurveTo(230, 560, 190, 640); ctx.lineTo(270, 640); ctx.quadraticCurveTo(290, 540, 220, 480); ctx.quadraticCurveTo(170, 420, 190, 330); ctx.fill();
    // puddles with rain rings
    for (const [px, py, pr] of [[205, 520, 16], [160, 430, 11], [240, 600, 18]]) {
      ctx.fillStyle = 'rgba(160,200,215,0.75)'; ellipse(ctx, px, py, pr, pr * 0.4); ctx.fill();
      for (let k = 0; k < 2; k++) { const q = (t * 1.3 + k * 0.5 + px * 0.01) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - q) * rain})`; ctx.lineWidth = 0.8; ellipse(ctx, px + (k ? 5 : -4), py, 2 + q * pr * 0.6, (2 + q * pr * 0.6) * 0.4); ctx.stroke(); }
    }
    // glowing mushrooms
    const mush = (x, y, s, c) => { softShadow(ctx, x, y, 7 * s, 2 * s, 0.2); ctx.fillStyle = '#FFF6EA'; rr(ctx, x - 2 * s, y - 7 * s, 4 * s, 7 * s, 2 * s); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y - 7 * s, 7 * s, 5 * s, 0, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ellipse(ctx, x - 2 * s, y - 9 * s, 1.2 * s, 1 * s); ctx.fill(); const gl = ctx.createRadialGradient(x, y - 8 * s, 0, x, y - 8 * s, 16 * s); gl.addColorStop(0, rgba(c, 0.35 + Math.sin(t * 2 + x) * 0.1)); gl.addColorStop(1, rgba(c, 0)); ctx.fillStyle = gl; ctx.fillRect(x - 16 * s, y - 24 * s, 32 * s, 32 * s); };
    // big trees (y-sorted with character)
    const items = [
      { y: 360, f: () => tree(ctx, 60, 360, 1.5, t, 3, 'pine') }, { y: 372, f: () => tree(ctx, 300, 372, 1.6, t, 4, 'pine') },
      { y: 450, f: () => tree(ctx, 330, 450, 1.3, t, 5) }, { y: 470, f: () => tree(ctx, 30, 470, 1.4, t, 6) },
      { y: 420, f: () => mush(95, 420, 1.2, '#F5A893') }, { y: 492, f: () => mush(270, 492, 1, '#C7B6EA') }, { y: 560, f: () => mush(120, 560, 1.4, '#F6C2CC') },
      { y: 540, f: () => bush(ctx, 300, 540, 1.2, t, 7) }, { y: 600, f: () => bush(ctx, 60, 600, 1.3, t, 8) },
    ];
    for (const c of o.chars || []) items.push({ y: c.y, f: () => CH().draw(ctx, c.d, c.s, c.x, c.y, c.sc || 1, t) });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.f());
    // foreground ferns framing
    ctx.fillStyle = 'rgba(120,180,120,0.9)';
    for (const [fx, fy, fs, fl] of [[-6, 640, 1.4, 1], [372, 650, 1.6, -1]]) {
      for (let k = 0; k < 5; k++) { ctx.save(); ctx.translate(fx, fy); ctx.rotate(fl * (-1.2 + k * 0.35) + Math.sin(t * 1.2 + k) * 0.04); ctx.scale(fs, fs); ellipse(ctx, 0, -30, 6, 30); ctx.fill(); ctx.restore(); }
    }
    // rain
    if (rain > 0) {
      ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.55 * rain})`; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
      const r = rng(3);
      for (let i = 0; i < 110; i++) {
        const sp = 300 + r() * 160, x0 = r() * 420, ph = r();
        const y = ((t * sp + ph * 700) % 700) - 30, x = x0 - y * 0.18;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2.2, y + 11); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = `rgba(200,215,230,${0.18 * rain})`; ctx.fillRect(0, 0, 360, 640);
    }
  }

  OC.M.WORLD = { drawIsland, drawForest, tree, house, bush, cloud, blob, plateau, MAIN, TER, POND };
})();
