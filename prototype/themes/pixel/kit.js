/* Scheme B — 像素森語 Pixel Grove : design kit
 * Two pixel grids: WORLD 270x480 (x4 = 1080x1920) and UI 540x960 (x2).
 * All shapes are integer scanline fills (no anti-aliasing); sprites get an automatic
 * 1px outline; night lighting is palette-quantized with 4x4 Bayer dithering.
 */
(function () {
  'use strict';
  const { clamp, lerp, rng, TAU } = OC;

  const P = {
    k0: '#1B1726', k1: '#2E2638', ink: '#3A2A33', inkSoft: '#6A5560',
    g0: '#1F3B30', g1: '#2E5A3C', g2: '#3F7A45', g3: '#5C9B4C', g4: '#85BC5A', g5: '#B5D96A', g6: '#DCEB9A',
    e0: '#3A2A26', e1: '#5C3F33', e2: '#84593F', e3: '#AD7B4F', e4: '#D3A66A', e5: '#EDCF93',
    s0: '#4B4A55', s1: '#6E6C77', s2: '#9A97A0', s3: '#C4C0C2',
    w0: '#1F3A5F', w1: '#2B5C8A', w2: '#3E85B0', w3: '#5FB0D0', w4: '#9BD7E6', w5: '#D8F2F2',
    r0: '#7A2E3B', r1: '#B5454B', r2: '#E06F5B', r3: '#F29C6B', r4: '#F7C77E', r5: '#FBE7A6',
    p0: '#4A3460', p1: '#7A5C9E', p2: '#A98CD0', p3: '#D2B8EC', pk: '#F1B6C7', pk2: '#FFE0E6',
    c0: '#FFF7E6', c1: '#F6E9CF', c2: '#E4CFA6', white: '#FFFFFF',
    n0: '#141A33', n1: '#232A52', n2: '#39407A', n3: '#5A5FA0', n4: '#8A8FCF',
    ng0: '#22383F', ng1: '#2F4D4E', ng2: '#3F6560', ng3: '#557F70', nb0: '#3E3550', nb1: '#5A4A63',
  };
  const PAL = Object.values(P).filter((v, i, a) => a.indexOf(v) === i);
  const RGB = PAL.map((h) => OC.hexToRgb(h));

  // ---------- palette quantization LUT (5 bits per channel) ----------
  const LUT = new Uint8Array(32768);
  (function buildLUT() {
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
      const R = r * 8 + 4, G = g * 8 + 4, B = b * 8 + 4;
      let best = 0, bd = 1e9;
      for (let i = 0; i < RGB.length; i++) {
        const c = RGB[i]; const dr = R - c[0], dg = G - c[1], db = B - c[2];
        const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
        if (d < bd) { bd = d; best = i; }
      }
      LUT[(r << 10) | (g << 5) | b] = best;
    }
  })();
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.5) * 22);
  function quantize(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = BAYER[(y & 3) * 4 + (x & 3)];
      const r = clamp(d[i] + o, 0, 255) >> 3, g = clamp(d[i + 1] + o, 0, 255) >> 3, b = clamp(d[i + 2] + o, 0, 255) >> 3;
      const c = RGB[LUT[(r << 10) | (g << 5) | b]];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---------- integer primitives ----------
  const R = Math.round;
  function rect(ctx, x, y, w, h, c) { if (c) ctx.fillStyle = c; ctx.fillRect(R(x), R(y), R(w), R(h)); }
  function oval(ctx, cx, cy, rx, ry, c) {
    if (c) ctx.fillStyle = c;
    const Ry = Math.max(0.5, ry);
    for (let y = -Math.ceil(Ry); y <= Math.ceil(Ry); y++) {
      const yy = (y + 0.5 * Math.sign(-y || 1) * 0) / Ry;
      const k = 1 - (y / (Ry + 0.35)) ** 2; if (k <= 0) continue;
      const hw = rx * Math.sqrt(k);
      const x0 = R(cx - hw), x1 = R(cx + hw);
      if (x1 > x0) ctx.fillRect(x0, R(cy) + y, x1 - x0, 1);
    }
  }
  function poly(ctx, pts, c) {
    if (c) ctx.fillStyle = c;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) { const xa = R(xs[i]), xb = R(xs[i + 1]); if (xb > xa) ctx.fillRect(xa, y, xb - xa, 1); }
    }
  }
  function line(ctx, x0, y0, x1, y1, c, w = 1) {
    if (c) ctx.fillStyle = c;
    x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 2000; n++) {
      ctx.fillRect(x0, y0, w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Draw a string bitmap. map: {'1': color,...}; s = integer pixel size. */
  function bmp(ctx, rows, x, y, map, s = 1) {
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i]; const c = map[ch]; if (!c) continue;
      ctx.fillStyle = c; ctx.fillRect(R(x) + i * s, R(y) + j * s, s, s);
    }
  }
  /** Add a 1px outline (4-neighbour) to everything opaque on a canvas. */
  function outline(cv, col = P.k1, px = 1) {
    const x = cv.getContext('2d'), w = cv.width, h = cv.height;
    const img = x.getImageData(0, 0, w, h), d = img.data, a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    for (let i = 0; i < w * h; i++) { if (!a[i]) d[i * 4 + 3] = 0; else d[i * 4 + 3] = 255; }
    const c = OC.hexToRgb(col);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = y * w + xx; if (a[i]) continue;
      let n = false;
      for (let k = 1; k <= px && !n; k++) n = (xx >= k && a[i - k]) || (xx < w - k && a[i + k]) || (y >= k && a[i - w * k]) || (y < h - k && a[i + w * k]);
      if (n) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
    }
    x.putImageData(img, 0, 0);
    return cv;
  }
  const spriteCache = new Map();
  function sprite(key, w, h, draw, ol = P.k1, olpx = 1) {
    if (key && spriteCache.has(key)) return spriteCache.get(key);
    const cv = OC.makeCanvas(w, h); const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    draw(x); outline(cv, ol, olpx);
    if (key) { if (spriteCache.size > 4000) spriteCache.clear(); spriteCache.set(key, cv); }
    return cv;
  }
  function blit(ctx, cv, x, y, s = 1) { ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, R(x), R(y), cv.width * s, cv.height * s); }

  // ---------- icons (9x9 bitmaps) ----------
  const IC = {
    bag: ['..11111..', '.1.....1.', '111111111', '122222221', '122111221', '122333221', '122222221', '122222221', '.1111111.'],
    map: ['111111111', '144444441', '143444441', '144344341', '144434441', '144443431', '144444341', '144444441', '111111111'],
    menu: ['.........', '111111111', '122222221', '.........', '111111111', '122222221', '.........', '111111111', '122222221'],
    coin: ['..11111..', '.1333331.', '133222231', '132212231', '132212231', '132212231', '132222231', '.1222221.', '..11111..'],
    sun: ['1...1...1', '.1.111.1.', '..12221..', '.1222221.', '112222211', '.1222221.', '..12221..', '.1.111.1.', '1...1...1'],
    moon: ['...1111..', '..1222...', '.1222....', '.122.....', '.122.....', '.122.....', '.1222....', '..12221..', '...1111..'],
    heart: ['.11...11.', '1331.1221', '132212221', '122222221', '.1222221.', '..12221..', '...121...', '....1....', '.........'],
    heartE: ['.11...11.', '1441.1441', '144414441', '144444441', '.1444441.', '..14441..', '...141...', '....1....', '.........'],
    star: ['....1....', '...131...', '...121...', '111222111', '.1222221.', '..12221..', '.1221221.', '.121.121.', '.1.....1.'],
    cloud: ['.........', '...111...', '..12221..', '.11222211', '122222221', '122222221', '.1111111.', '.........', '.........'],
    paw: ['..11.11..', '..11.11..', '11.....11', '11.111.11', '..11111..', '.1111111.', '.1111111.', '..11.11..', '.........'],
    home: ['....1....', '...111...', '..11111..', '.1111111.', '111111111', '.1222221.', '.1221221.', '.1221221.', '.1111111.'],
    pin: ['..11111..', '.1222221.', '.1233221.', '.1233221.', '.1222221.', '..12221..', '...121...', '...121...', '....1....'],
    chat: ['.1111111.', '122222221', '123232321', '122222221', '.1111111.', '..11.....', '.1.......', '.........', '.........'],
    gear: ['...111...', '.1.121.1.', '..12221..', '112212211', '1221.1221', '112212211', '..12221..', '.1.121.1.', '...111...'],
    leaf: ['......111', '....12221', '...123221', '..1232221', '.1232221.', '.132221..', '.12221...', '1.111....', '1........'],
    face: ['..11111..', '.1222221.', '122222221', '121222121', '122222221', '123222321', '122111221', '.1222221.', '..11111..'],
    clock: ['..11111..', '.1222221.', '122212221', '122212221', '122211221', '122222221', '122222221', '.1222221.', '..11111..'],
    walk: ['...11....', '...11....', '..1111...', '.1.11.1..', '...11....', '..1..1...', '..1..1...', '.1....1..', '.........'],
    pencil: ['.......11', '......121', '.....121.', '....121..', '...121...', '..121....', '.133.....', '.33......', '3........'],
    eraser: ['.....111.', '....12221', '...122221', '..1332221', '.1333311.', '133331...', '.1111....', '.........', '.........'],
    onion: ['11111....', '1...1....', '1.22222..', '1.2.1.2..', '11111.2..', '..2...2..', '..22222..', '.........', '.........'],
    play: ['.1.......', '.11......', '.121.....', '.1221....', '.12221...', '.1221....', '.121.....', '.11......', '.1.......'],
    pause: ['.........', '.11..11..', '.11..11..', '.11..11..', '.11..11..', '.11..11..', '.11..11..', '.11..11..', '.........'],
    plus: ['.........', '...111...', '...111...', '111111111', '111111111', '111111111', '...111...', '...111...', '.........'],
    check: ['.........', '.......11', '......11.', '.....11..', '11..11...', '.1111....', '..11.....', '.........', '.........'],
    back: ['....11...', '...11....', '..11.....', '.11......', '11.......', '.11......', '..11.....', '...11....', '....11...'],
    right: ['...11....', '....11...', '.....11..', '......11.', '.......11', '......11.', '.....11..', '....11...', '...11....'],
    down: ['.........', '.........', '111111111', '.1111111.', '..11111..', '...111...', '....1....', '.........', '.........'],
    close: ['11.....11', '111...111', '.111.111.', '..11111..', '...111...', '..11111..', '.111.111.', '111...111', '11.....11'],
    rain: ['...111...', '..12221..', '.1122221.', '122222221', '.1111111.', '.3..3..3.', '3..3..3..', '.........', '.........'],
  };
  function icon(ctx, name, x, y, s = 2, c1 = P.ink, c2, c3) {
    const rows = IC[name]; if (!rows) return;
    const map = { 1: c1, 2: c2 || c1, 3: c3 || P.white, 4: P.c2 };
    if (name === 'map') Object.assign(map, { 4: P.w4, 3: P.r1 });
    if (name === 'coin') Object.assign(map, { 1: P.e2, 2: P.r4, 3: P.r5 });
    if (name === 'heart') Object.assign(map, { 1: P.r0, 2: P.r2, 3: P.pk });
    if (name === 'heartE') Object.assign(map, { 1: P.e2, 4: P.c2 });
    if (name === 'sun') Object.assign(map, { 1: P.r3, 2: P.r4 });
    if (name === 'moon') Object.assign(map, { 1: P.n2, 2: P.r5 });
    if (name === 'star') Object.assign(map, { 1: P.e2, 2: P.r4, 3: P.r5 });
    if (name === 'cloud' || name === 'rain') Object.assign(map, { 1: P.s1, 2: P.c0, 3: P.w3 });
    bmp(ctx, rows, x - 4.5 * s, y - 4.5 * s, map, s);
  }

  // ---------- items (16x16 sprite art, outlined) ----------
  function itemSprite(id) {
    return sprite('item:' + id, 18, 18, (x) => {
      const o = 1; // offset for outline room
      x.translate(o, o);
      switch (id) {
        case 'cake': rect(x, 2, 8, 12, 6, P.e4); rect(x, 2, 6, 12, 3, P.c0); rect(x, 2, 10, 12, 1, P.pk); rect(x, 3, 8, 1, 1, P.c0); rect(x, 7, 9, 1, 1, P.c0); rect(x, 11, 8, 1, 1, P.c0); oval(x, 8, 4, 2.6, 2.4, P.r1); rect(x, 7, 3, 1, 1, P.pk); rect(x, 7, 1, 2, 1, P.g4); rect(x, 2, 13, 12, 1, P.e3); break;
        case 'apple': oval(x, 8, 9, 5.6, 5.2, P.r1); oval(x, 7, 8, 4, 3.8, P.r2); rect(x, 5, 6, 2, 2, P.pk); rect(x, 8, 2, 1, 3, P.e1); rect(x, 9, 2, 3, 2, P.g4); break;
        case 'milk': rect(x, 4, 4, 8, 11, P.c0); rect(x, 4, 8, 8, 4, P.w4); rect(x, 5, 1, 6, 3, P.r3); rect(x, 10, 4, 2, 11, P.c2); break;
        case 'flower': rect(x, 7, 9, 2, 6, P.g3); rect(x, 9, 11, 2, 2, P.g4); for (const [a, b] of [[8, 2], [4, 5], [12, 5], [5, 9], [11, 9]]) oval(x, a, b + 1, 2.4, 2.2, P.white); oval(x, 8, 6, 2, 2, P.r4); break;
        case 'fish': oval(x, 7, 8, 6, 3.4, P.w3); oval(x, 7, 7, 5, 2, P.w4); poly(x, [[12, 8], [16, 4], [16, 12]], P.w2); rect(x, 3, 7, 1, 1, P.k1); break;
        case 'star': poly(x, [[8, 0], [10, 5], [16, 6], [11, 10], [13, 16], [8, 12], [3, 16], [5, 10], [0, 6], [6, 5]], P.r4); rect(x, 6, 6, 2, 2, P.r5); break;
        case 'shell': oval(x, 8, 9, 6, 5, P.pk); for (const dx of [-4, -2, 0, 2, 4]) line(x, 8, 14, 8 + dx, 5, P.r2); rect(x, 6, 13, 4, 2, P.pk2); break;
        case 'seed': oval(x, 8, 9, 5, 6, P.e4); oval(x, 7, 8, 3, 4, P.e5); rect(x, 7, 1, 2, 3, P.g3); rect(x, 9, 1, 3, 2, P.g4); break;
        case 'lamp': rect(x, 7, 9, 2, 6, P.c0); rect(x, 4, 14, 8, 2, P.e3); oval(x, 8, 6, 7, 4.2, P.r1); oval(x, 7, 5, 5, 2.6, P.r2); rect(x, 4, 4, 2, 2, P.c0); rect(x, 10, 3, 2, 1, P.c0); break;
        case 'cushion': oval(x, 8, 10, 7.6, 4.6, P.p3); oval(x, 4, 7, 3.4, 3, P.c0); oval(x, 11, 7, 4, 3.4, P.c0); oval(x, 8, 11, 6, 2.5, P.p2); break;
        case 'plant': for (const [a, b] of [[4, 4], [8, 1], [12, 4], [6, 6], [10, 6]]) oval(x, a, b + 2, 2.4, 3.4, P.g4); rect(x, 3, 9, 10, 2, P.r3); poly(x, [[4, 11], [12, 11], [11, 16], [5, 16]], P.r2); break;
        case 'rug': oval(x, 8, 10, 8, 4.5, P.r4); oval(x, 8, 11, 2.4, 1.8, P.r2); for (const [a, b] of [[4, 8], [6, 7], [10, 7], [12, 8]]) rect(x, a, b, 1, 1, P.r2); break;
      }
    });
  }
  function item(ctx, id, x, y, s = 2) { const cv = itemSprite(id); blit(ctx, cv, x - (cv.width * s) / 2, y - (cv.height * s) / 2, s); }

  // ---------- UI frames (UI grid units = 1 UI px = 2 screen px) ----------
  function panel(ctx, x, y, w, h, style = 'wood') {
    x = R(x); y = R(y); w = R(w); h = R(h);
    const S = {
      wood: [P.e0, P.e3, P.e4, P.c1, P.c2],
      paper: [P.e1, P.c2, P.c0, P.c0, P.c1],
      leaf: [P.g0, P.g3, P.g4, P.c1, P.c2],
      dark: [P.k0, P.k1, P.inkSoft, P.k1, P.k0],
      berry: [P.r0, P.r2, P.r3, P.c1, P.c2],
    }[style];
    ctx.fillStyle = 'rgba(20,14,30,0.28)'; ctx.fillRect(x + 2, y + h, w - 2, 3); ctx.fillRect(x + w, y + 3, 2, h - 1);
    rect(ctx, x + 2, y, w - 4, h, S[0]); rect(ctx, x, y + 2, w, h - 4); rect(ctx, x + 1, y + 1, w - 2, h - 2);
    rect(ctx, x + 2, y + 2, w - 4, h - 4, S[1]);
    rect(ctx, x + 3, y + 2, w - 6, 1, S[2]);
    rect(ctx, x + 4, y + 4, w - 8, h - 8, S[0]);
    rect(ctx, x + 5, y + 5, w - 10, h - 10, S[3]);
    rect(ctx, x + 5, y + h - 7, w - 10, 2, S[4]);
  }
  function btn(ctx, x, y, w, h, label, opt = {}) {
    const pr = opt.pressed ? 2 : 0;
    const c = opt.color || P.g3, hi = opt.hi || P.g4, lo = opt.lo || P.g1;
    rect(ctx, x + 1, y + h - 1, w - 2, 3, 'rgba(20,14,30,0.3)');
    y += pr;
    rect(ctx, x + 1, y, w - 2, h, P.k1); rect(ctx, x, y + 1, w, h - 2, P.k1);
    rect(ctx, x + 1, y + 1, w - 2, h - 2, c); rect(ctx, x + 2, y + 1, w - 4, 2, hi); if (!opt.pressed) rect(ctx, x + 1, y + h - 4, w - 2, 3, lo);
    if (label) txt(ctx, label, x + w / 2, y + (h - 16) / 2 - 1, { c: opt.tc || P.white, align: 'center', sh: opt.sh || lo, size: opt.size });
  }
  function txt(ctx, s, x, y, o = {}) {
    const size = o.size || 16;
    ctx.save();
    ctx.font = `${size}px ${o.font || 'Unifont'}`;
    ctx.textBaseline = 'top'; ctx.textAlign = o.align || 'left';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.sh) { ctx.fillStyle = o.sh; ctx.fillText(s, R(x) + 1, R(y) + 1); }
    ctx.fillStyle = o.c || P.ink; ctx.fillText(s, R(x), R(y));
    ctx.restore();
  }
  // retro glove cursor
  const HAND = ['..11.......', '.1221......', '.1221......', '.1221111...', '.122122211.', '11222222221', '12122222221', '12222222221', '.1222222221', '..12222221.', '...1222221.', '...1111111.'];
  const HAND_DOWN = ['...........', '...........', '..11.......', '.12211111..', '.1221222211', '11222222221', '12122222221', '12222222221', '.1222222221', '..12222221.', '...1222221.', '...1111111.'];
  function cursor(ctx, f) {
    if (!f || f.alpha <= 0.05) return;
    ctx.save(); ctx.globalAlpha = f.alpha > 0.5 ? 1 : 0; // pixel UI: no fades on the cursor, it pops
    if (f.down && f.sinceChange < 0.25) { const r = R(6 + f.sinceChange * 40); ctx.fillStyle = P.white; for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; ctx.fillRect(R(f.x + Math.cos(a) * r), R(f.y + Math.sin(a) * r), 2, 2); } }
    bmp(ctx, f.down ? HAND_DOWN : HAND, f.x - 3 * 2, f.y - 1 * 2, { 1: P.k1, 2: P.white }, 2);
    ctx.restore();
  }
  function statusBar(ctx, time, c = P.white) {
    txt(ctx, time, 20, 6, { c, font: 'Silkscreen', size: 16 });
    for (let i = 0; i < 4; i++) rect(ctx, 446 + i * 6, 18 - i * 3, 4, 4 + i * 3, c);
    rect(ctx, 476, 9, 26, 13, c); rect(ctx, 478, 11, 22, 9, 'rgba(0,0,0,0.35)'); rect(ctx, 478, 11, 16, 9, c); rect(ctx, 502, 13, 2, 5, c);
  }

  OC.X = { P, PAL, quantize, rect, oval, poly, line, bmp, outline, sprite, blit, icon, item, itemSprite, panel, btn, txt, cursor, statusBar, R };
})();
