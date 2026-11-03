/* Scheme C — 手帳繪本 Inkpot Tales : design kit
 * Hand-inked storybook. Ink lines "boil" (re-jitter at 8 fps), fills are printed
 * slightly off-register (risograph feel), shadows are hatched, everything sits on paper grain.
 * UI = scrapbook: deckled paper cards, washi tape, rubber stamps, handwriting.
 */
(function () {
  'use strict';
  const { TAU, clamp, lerp, rng, hash, mix, rgba } = OC;

  const P = {
    paper: '#F6EEDC', paper2: '#EFE3C8', paper3: '#E6D5B3', card: '#FBF6EA',
    ink: '#3B2A25', ink2: '#7A6355', ink3: '#B09A86',
    grass: '#A9C878', grass2: '#86AE5F', grass3: '#6A9450', forest: '#4F7D57', forest2: '#3D6448',
    teal: '#5FA8A0', water: '#9BD0CB', water2: '#6FB3B0', sky: '#CFE3E6',
    mustard: '#E8B64C', terra: '#D9734E', rose: '#E89C9C', plum: '#8E6A9E', lilac: '#BDB2DE',
    sand: '#F0DCAE', wood: '#B98352', wood2: '#8C5E3A', cream: '#FBF3E4', red: '#C9473B',
  };
  const F = (s, w = 400) => `${w} ${s}px "LXGW WenKai TC"`;

  // boil: global step, set by shots each frame
  const B = { step: 0 };
  function setBoil(t) { B.step = Math.floor(t * 8); }
  function j(id, k, amp) { return (hash(id * 13.7 + k * 7.1 + B.step * 3.3) - 0.5) * 2 * amp; }

  /** Smooth closed/open ink path through jittered points. */
  function densify(pts, closed, step = 9) {
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      out.push(a);
      if (!closed && i === n - 1) break;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.floor(L / step);
      for (let m = 1; m < k; m++) out.push([a[0] + ((b[0] - a[0]) * m) / k, a[1] + ((b[1] - a[1]) * m) / k]);
    }
    return out;
  }
  function inkPath(ctx, pts, closed = true, id = 1, amp = 0.6) {
    if (closed && pts.length < 12) pts = densify(pts, true);
    const q = pts.map((p, i) => [p[0] + j(id, i, amp), p[1] + j(id + 50, i, amp)]);
    ctx.beginPath();
    if (closed) {
      const n = q.length;
      const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let s = m(q[n - 1], q[0]); ctx.moveTo(s[0], s[1]);
      for (let i = 0; i < n; i++) { const e = m(q[i], q[(i + 1) % n]); ctx.quadraticCurveTo(q[i][0], q[i][1], e[0], e[1]); }
      ctx.closePath();
    } else {
      ctx.moveTo(q[0][0], q[0][1]);
      for (let i = 1; i < q.length - 1; i++) { const e = [(q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2]; ctx.quadraticCurveTo(q[i][0], q[i][1], e[0], e[1]); }
      const L = q[q.length - 1]; ctx.lineTo(L[0], L[1]);
    }
  }
  function blobPts(cx, cy, rx, ry, n = 14, seed = 1, wob = 0.05) {
    const r = rng(seed * 101), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, k = 1 + (r() - 0.5) * 2 * wob; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    return pts;
  }
  /** Ink shape: off-register fill + boiling outline. */
  function ink(ctx, pts, fill, opt = {}) {
    const id = opt.id || 1, lw = opt.lw ?? 1.5, amp = opt.amp ?? 0.55, off = opt.off ?? 0.9;
    if (fill) { ctx.save(); ctx.translate(off, off * 0.8); inkPath(ctx, pts, true, id + 7, amp * 0.6); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }
    if (opt.hatch) { ctx.save(); inkPath(ctx, pts, true, id + 7, 0); ctx.clip(); hatchArea(ctx, opt.hatch); ctx.restore(); }
    if (lw > 0) { inkPath(ctx, pts, true, id, amp); ctx.strokeStyle = opt.stroke || P.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  }
  function blob(ctx, cx, cy, rx, ry, fill, opt = {}) { ink(ctx, blobPts(cx, cy, rx, ry, opt.n || 14, opt.id || 1, opt.wob ?? 0.04), fill, opt); }
  /** hatch: {x0,y0,x1,y1, gap, ang, col, lw} lines drawn inside current clip */
  function hatchArea(ctx, h) {
    ctx.save(); ctx.beginPath(); ctx.rect(Math.min(h.x0, h.x1), Math.min(h.y0, h.y1), Math.abs(h.x1 - h.x0), Math.abs(h.y1 - h.y0)); ctx.clip();
    ctx.strokeStyle = h.col || rgba(P.ink, 0.5); ctx.lineWidth = h.lw || 0.8; ctx.lineCap = 'round';
    const gap = h.gap || 3.2, a = h.ang ?? -0.8;
    const cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2, R = Math.hypot(h.x1 - h.x0, h.y1 - h.y0);
    ctx.translate(cx, cy); ctx.rotate(a);
    for (let k = -R; k < R; k += gap) { ctx.beginPath(); ctx.moveTo(-R + j(k, 1, 0.6), k); ctx.lineTo(R, k + j(k, 2, 0.6)); ctx.stroke(); }
    ctx.restore();
  }
  function inkLine(ctx, pts, lw = 1.5, col = P.ink, id = 3, amp = 0.5) { inkPath(ctx, pts, false, id, amp); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }

  // ---------- paper ----------
  let GRAIN = null;
  function grain() {
    if (GRAIN) return GRAIN;
    const w = 540, h = 960, c = OC.makeCanvas(w, h), x = c.getContext('2d');
    const img = x.createImageData(w, h), d = img.data, r = rng(42);
    for (let i = 0; i < w * h; i++) { const v = 236 + r() * 19 - (r() < 0.02 ? 25 : 0); d[i * 4] = v; d[i * 4 + 1] = v - 2; d[i * 4 + 2] = v - 8; d[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0);
    x.strokeStyle = 'rgba(150,120,90,0.10)'; x.lineWidth = 0.7;
    for (let i = 0; i < 260; i++) { const a = r() * TAU, l = 4 + r() * 12, px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.6) * l, py + Math.sin(a + 0.6) * l, px + Math.cos(a) * l * 2, py + Math.sin(a) * l * 2); x.stroke(); }
    const vg = x.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.75); vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(200,170,130,0.35)');
    x.fillStyle = vg; x.fillRect(0, 0, w, h);
    GRAIN = c; return c;
  }
  /** deckled paper card */
  function card(ctx, x, y, w, h, opt = {}) {
    const id = opt.id || (x * 3 + y);
    const r = rng(id), pts = [];
    const n1 = Math.max(4, Math.round(w / 9)), n2 = Math.max(4, Math.round(h / 9)), d = opt.deckle ?? 1.1;
    for (let i = 0; i <= n1; i++) pts.push([x + (w * i) / n1, y + (r() - 0.5) * d]);
    for (let i = 1; i <= n2; i++) pts.push([x + w + (r() - 0.5) * d, y + (h * i) / n2]);
    for (let i = n1 - 1; i >= 0; i--) pts.push([x + (w * i) / n1, y + h + (r() - 0.5) * d]);
    for (let i = n2 - 1; i > 0; i--) pts.push([x + (r() - 0.5) * d, y + (h * i) / n2]);
    ctx.save();
    if (opt.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(opt.rot); ctx.translate(-x - w / 2, -y - h / 2); }
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0] + 2, p[1] + 3) : ctx.moveTo(p[0] + 2, p[1] + 3))); ctx.closePath(); ctx.fillStyle = 'rgba(90,60,40,0.16)'; ctx.fill();
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = opt.fill || P.card; ctx.fill();
    if (opt.lines) { ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(95,168,160,0.25)'; ctx.lineWidth = 0.7; for (let yy = y + 22; yy < y + h; yy += 16) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); } ctx.restore(); }
    if (opt.edge !== false) { ctx.strokeStyle = rgba(P.ink, 0.25); ctx.lineWidth = 0.6; ctx.stroke(); }
    ctx.restore();
  }
  function tape(ctx, x, y, w, rot = -0.1, col = P.teal, alpha = 0.55) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= alpha;
    ctx.beginPath(); ctx.moveTo(-w / 2, -6); for (let i = 0; i <= 4; i++) ctx.lineTo(-w / 2 + (i % 2) * 1.5, -6 + i * 3); ctx.lineTo(w / 2, 6); for (let i = 4; i >= 0; i--) ctx.lineTo(w / 2 - (i % 2) * 1.5, -6 + i * 3); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha *= 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; for (let k = -w / 2 + 4; k < w / 2; k += 6) { ctx.beginPath(); ctx.moveTo(k, -5); ctx.lineTo(k + 3, 5); ctx.stroke(); }
    ctx.restore();
  }
  function stamp(ctx, x, y, r, iconName, col = P.red, opt = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(opt.rot || -0.08); const s = opt.scale || 1; ctx.scale(s, s);
    ctx.globalAlpha *= opt.alpha ?? 1;
    if (opt.fill) { blob(ctx, 0, 0, r, r, opt.fill, { lw: 1.6, stroke: col, id: x + y, n: 16 }); }
    else { ctx.strokeStyle = col; ctx.lineWidth = 1.6; inkPath(ctx, blobPts(0, 0, r, r, 16, x + y, 0.03), true, x + y, 0.5); ctx.stroke(); ctx.lineWidth = 0.8; inkPath(ctx, blobPts(0, 0, r - 3, r - 3, 16, x + y + 1, 0.03), true, x + y + 1, 0.5); ctx.stroke(); }
    if (iconName) icon(ctx, iconName, 0, 0, r * 1.05, col);
    if (opt.label) OC.text(ctx, opt.label, 0, 0.5, { font: F(opt.ls || 11, 700), color: col, align: 'center', base: 'middle' });
    ctx.restore();
  }
  /** ink button: marker-fill offset under a boiling outline */
  function inkBtn(ctx, x, y, w, h, label, opt = {}) {
    const pr = opt.pressed ? 1.5 : 0;
    const pts = [[x, y + pr], [x + w, y + pr], [x + w, y + h + pr], [x, y + h + pr]];
    const r = Math.min(h / 2, 10);
    const rp = []; // rounded corners as dense points
    for (const [cx, cy, a0] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]]) for (let k = 0; k <= 3; k++) { const a = a0 + (k / 3) * (Math.PI / 2); rp.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r + pr]); }
    if (!opt.pressed) { ctx.save(); ctx.translate(2, 2.5); inkPath(ctx, rp, true, 9, 0); ctx.fillStyle = rgba(P.ink, 0.85); ctx.fill(); ctx.restore(); }
    ink(ctx, rp, opt.fill || P.mustard, { id: x + y, off: 1.6, lw: 1.5 });
    if (label) OC.text(ctx, label, x + w / 2, y + h / 2 + 1 + pr, { font: F(opt.size || 13, 700), color: opt.color || P.ink, align: 'center', base: 'middle' });
  }

  // ---------- ink icons ----------
  function icon(ctx, name, x, y, s = 16, col = P.ink, lw) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12);
    const L = (pts, w = lw || 2) => inkLine(ctx, pts, w, col, name.length + pts.length, 0.35);
    const O = (pts, fill) => { ink(ctx, pts, fill || null, { lw: lw || 2, stroke: col, id: name.length * 7 + pts.length, amp: 0.35, off: 0.8 }); };
    switch (name) {
      case 'bag': O([[5, 9], [19, 9], [20, 20], [4, 20]], rgba(P.terra, 0.6)); L([[8.5, 9], [9, 4.5], [15, 4.5], [15.5, 9]]); L([[10, 13], [14, 13]]); break;
      case 'map': O([[4, 6], [9, 4], [15, 6], [20, 4], [20, 18], [15, 20], [9, 18], [4, 20]], rgba(P.sand, 0.9)); L([[9, 4], [9, 18]], 1.2); L([[15, 6], [15, 20]], 1.2); L([[6, 15], [10, 11], [13, 14], [18, 9]], 1.2); break;
      case 'menu': for (const yy of [7, 12, 17]) L([[5, yy], [19, yy + 0.5]]); break;
      case 'coin': O(blobPts(12, 12, 8, 8, 10, 3, 0.02), P.mustard); L([[12, 8], [12, 16]], 1.6); break;
      case 'sun': O(blobPts(12, 12, 4.5, 4.5, 8, 4, 0.02), P.mustard); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; L([[12 + Math.cos(a) * 7, 12 + Math.sin(a) * 7], [12 + Math.cos(a) * 9.5, 12 + Math.sin(a) * 9.5]], 1.6); } break;
      case 'moon': O([[15, 4], [9, 6], [7, 12], [9, 18], [15, 20], [11, 16], [10, 12], [11, 8]], P.mustard); break;
      case 'heart': O([[12, 20], [4, 12], [5, 6], [9, 5], [12, 8], [15, 5], [19, 6], [20, 12]], P.rose); break;
      case 'heartO': O([[12, 20], [4, 12], [5, 6], [9, 5], [12, 8], [15, 5], [19, 6], [20, 12]]); break;
      case 'star': { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4 : 9; p.push([12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r]); } O(p, P.mustard); break; }
      case 'back': L([[15, 5], [8, 12], [15, 19]], 2.4); break;
      case 'close': L([[6, 6], [18, 18]], 2.4); L([[18, 6], [6, 18]], 2.4); break;
      case 'check': L([[5, 12], [10, 17], [19, 6]], 2.6); break;
      case 'plus': L([[12, 5], [12, 19]], 2.4); L([[5, 12], [19, 12]], 2.4); break;
      case 'play': O([[8, 5], [19, 12], [8, 19]], P.terra); break;
      case 'pause': O([[7, 5], [10, 5], [10, 19], [7, 19]], P.terra); O([[14, 5], [17, 5], [17, 19], [14, 19]], P.terra); break;
      case 'pencil': O([[16, 4], [20, 8], [9, 19], [4, 20], [5, 15]], P.mustard); L([[5, 15], [9, 19]], 1.4); break;
      case 'eraser': O([[13, 4], [20, 11], [12, 19], [5, 12]], P.rose); L([[9, 8], [16, 15]], 1.4); break;
      case 'onion': O([[4, 5], [14, 5], [14, 15], [4, 15]]); O([[9, 9], [20, 9], [20, 19], [9, 19]], rgba(P.lilac, 0.6)); break;
      case 'gear': O(blobPts(12, 12, 8, 8, 12, 9, 0.12), P.paper3); O(blobPts(12, 12, 3, 3, 8, 2, 0.02), P.card); break;
      case 'home': O([[4, 12], [12, 4], [20, 12], [18, 12], [18, 20], [6, 20], [6, 12]], P.terra); break;
      case 'pin': O([[12, 21], [6, 12], [7, 6], [12, 3.5], [17, 6], [18, 12]], P.red); O(blobPts(12, 9, 2.4, 2.4, 6, 3, 0), P.card); break;
      case 'chat': O([[4, 5], [20, 5], [20, 16], [11, 16], [7, 20], [8, 16], [4, 16]], P.card); break;
      case 'paw': O(blobPts(12, 15, 5, 4, 8, 2, 0.05), P.terra); for (const [px, py] of [[6, 10], [9.5, 6], [14.5, 6], [18, 10]]) O(blobPts(px, py, 2, 2, 6, px, 0), P.terra); break;
      case 'leaf': O([[5, 19], [5, 10], [11, 5], [20, 4], [19, 13], [13, 19]], P.grass); L([[5, 19], [14, 10]], 1.2); break;
      case 'face': O(blobPts(12, 12, 8, 8, 10, 5, 0.03), P.cream); O(blobPts(9, 11, 0.8, 1.2, 5, 1, 0), P.ink); O(blobPts(15, 11, 0.8, 1.2, 5, 2, 0), P.ink); L([[9.5, 15], [12, 16.5], [14.5, 15]], 1.3); break;
      case 'clock': O(blobPts(12, 12, 8, 8, 10, 7, 0.02), P.card); L([[12, 7], [12, 12], [15.5, 14]], 1.6); break;
      case 'rain': O([[5, 13], [7, 8], [12, 6], [17, 8], [19, 13]], P.card); for (const dx of [8, 12, 16]) L([[dx, 16], [dx - 1.5, 20]], 1.5); break;
      case 'walk': O(blobPts(13, 5, 2, 2, 6, 1, 0), P.ink); L([[12, 9], [11, 14], [14, 17], [13, 21]]); L([[11, 14], [8, 20]]); L([[11.5, 10], [8, 13]]); L([[12.5, 10.5], [16, 13]]); break;
      default: O(blobPts(12, 12, 6, 6, 8, 1, 0));
    }
    ctx.restore();
  }

  // ---------- doodled items ----------
  function item(ctx, id, x, y, s = 24) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12);
    const O = (pts, fill, extra = {}) => ink(ctx, pts, fill, Object.assign({ lw: 1.3, id: id.length * 11 + pts.length, amp: 0.35 }, extra));
    const Bb = (cx, cy, rx, ry, fill, extra = {}) => blob(ctx, cx, cy, rx, ry, fill, Object.assign({ lw: 1.3, id: cx * 3 + cy, amp: 0.35 }, extra));
    const L = (pts, w = 1.2, c = P.ink) => inkLine(ctx, pts, w, c, pts.length + 3, 0.3);
    switch (id) {
      case 'cake': O([[4, 11], [20, 11], [20, 20], [4, 20]], P.sand); O([[4, 9], [20, 9], [20, 13], [4, 13]], P.cream); L([[4, 15.5], [20, 15.5]], 1.1, P.rose); Bb(12, 6.5, 3, 3, P.red); L([[11, 3.5], [12.5, 2.5]], 1.2, P.forest); break;
      case 'apple': Bb(12, 13, 7, 6.5, P.red, { hatch: { x0: 12, y0: 12, x1: 20, y1: 20, gap: 2.5 } }); L([[12, 7], [13, 3.5]]); O([[13, 5], [17, 3], [18, 6]], P.grass); break;
      case 'milk': O([[7, 7], [17, 7], [17, 20], [7, 20]], P.card); O([[8, 3], [16, 3], [17, 7], [7, 7]], P.terra); O([[7, 12], [17, 12], [17, 16], [7, 16]], P.water); break;
      case 'flower': L([[12, 20], [12, 11]], 1.4, P.forest); for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5 - 1.57; Bb(12 + Math.cos(a) * 4, 9 + Math.sin(a) * 4, 2.6, 2.6, P.card); } Bb(12, 9, 2, 2, P.mustard); break;
      case 'fish': O([[3, 12], [8, 8], [15, 9], [18, 12], [15, 15], [8, 16]], P.water); O([[17, 12], [21, 8], [21, 16]], P.water2); Bb(7, 11, 0.7, 0.7, P.ink, { lw: 0 }); break;
      case 'star': { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4 : 9; p.push([12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r]); } O(p, P.mustard); break; }
      case 'shell': O([[4, 16], [6, 8], [12, 5], [18, 8], [20, 16], [12, 19]], P.rose); for (const dx of [-5, 0, 5]) L([[12, 18], [12 + dx, 7]], 0.9); break;
      case 'seed': Bb(12, 13, 6, 7, P.sand); L([[12, 6], [12, 3]], 1.2, P.forest); O([[12, 4], [16, 2], [15, 5]], P.grass); break;
      case 'lamp': L([[12, 12], [12, 19]], 1.6); O([[7, 19], [17, 19], [16, 21], [8, 21]], P.wood); O([[3, 12], [6, 5], [12, 3], [18, 5], [21, 12]], P.terra); Bb(9, 7, 1.4, 1.2, P.card, { lw: 0.8 }); Bb(15, 6, 1.2, 1, P.card, { lw: 0.8 }); break;
      case 'cushion': O([[3, 15], [4, 10], [9, 8], [13, 9], [17, 7], [21, 11], [20, 17], [12, 19]], P.lilac, { hatch: { x0: 3, y0: 14, x1: 21, y1: 20, gap: 2.4 } }); break;
      case 'plant': for (const a of [-0.8, -0.2, 0.4, 1]) { ctx.save(); ctx.translate(12, 11); ctx.rotate(a); O([[0, 0], [-2.5, -5], [0, -9], [2.5, -5]], P.grass); ctx.restore(); } O([[6, 11], [18, 11], [16, 20], [8, 20]], P.terra); break;
      case 'rug': Bb(12, 14, 10, 5, P.mustard); Bb(12, 15, 3, 2, P.terra); break;
    }
    ctx.restore();
  }

  // ---------- touch doodle ----------
  function touch(ctx, f) {
    if (!f || f.alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = f.alpha;
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    inkPath(ctx, blobPts(f.x, f.y, f.down ? 7 : 9, f.down ? 7 : 9, 10, 4, 0.08), true, 4, 0.7); ctx.stroke();
    ctx.fillStyle = rgba(P.mustard, 0.45); ctx.fill();
    if (f.down && f.sinceChange < 0.35) { const q = f.sinceChange / 0.35; for (let i = 0; i < 3; i++) { const a = -2.2 + i * 0.55; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * (11 + q * 4), f.y + Math.sin(a) * (11 + q * 4)); ctx.lineTo(f.x + Math.cos(a) * (16 + q * 6), f.y + Math.sin(a) * (16 + q * 6)); ctx.stroke(); } }
    ctx.restore();
  }
  function statusBar(ctx, time, col = P.ink) {
    OC.text(ctx, time, 18, 15, { font: F(11, 700), color: col });
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { ctx.fillRect(304 + i * 3.3, 13 - i * 1.6, 2.2, 2.6 + i * 1.6); }
    ctx.strokeRect(322, 7.5, 15, 7.5); ctx.fillRect(323.5, 9, 10, 4.5); ctx.fillRect(337.5, 9.6, 1.2, 3);
    ctx.restore();
  }

  OC.S = { P, F, setBoil, inkPath, blobPts, ink, blob, hatchArea, inkLine, grain, card, tape, stamp, inkBtn, icon, item, touch, statusBar };
})();
