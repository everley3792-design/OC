/* OC Shimeji — 16.3 background removal for picture characters (OC.Cutout).
 * Replaces the old global colour key (which also erased the same colour inside the character — white eyes on a white page):
 *   detect(canvas)            → { has, rgb, share } — is there a plain background around the picture?
 *   remove(canvas, o)         → a NEW canvas: flood fill from the picture's border (only background connected to the edge),
 *                               soft edge (partial alpha + colour unmixed from the background), optional extra seeds (the wand)
 *   wand(canvas, x, y, tol)   → a NEW canvas: also clear the region connected to (x, y) (a closed gap between arms …)
 * Never changes its input. The original file stays in the asset store (OC.Assets.original) — the editor can always go back.
 */
(function () {
  'use strict';
  const mk = (w, h) => OC.makeCanvas(w, h);
  const ctx2 = (c) => c.getContext('2d', { willReadFrequently: true });
  const clone = (c) => { const k = mk(c.width, c.height); ctx2(k).drawImage(c, 0, 0); return k; };
  const dist = (a, i, rgb) => Math.abs(a[i] - rgb[0]) + Math.abs(a[i + 1] - rgb[1]) + Math.abs(a[i + 2] - rgb[2]);

  /** look at the border: a plain (or nearly plain) colour all around = a background to remove */
  function detect(c) {
    const w = c.width, h = c.height, d = ctx2(c).getImageData(0, 0, w, h).data, px = [];
    /* look at the border of the visible part (an import adds a transparent margin around the picture) */
    const b = bounds(c, 8), X0 = b.x0, Y0 = b.y0, X1 = b.x1 - 1, Y1 = b.y1 - 1;
    const take = (x, y) => { const i = (y * w + x) * 4; if (d[i + 3] > 250) px.push([d[i], d[i + 1], d[i + 2]]); else px.push(null); };
    const step = Math.max(1, Math.floor((X1 - X0 + Y1 - Y0) / 300));
    for (let x = X0; x <= X1; x += step) { take(x, Y0); take(x, Y1); }
    for (let y = Y0; y <= Y1; y += step) { take(X0, y); take(X1, y); }
    const opaque = px.filter(Boolean); if (opaque.length < px.length * 0.6) return { has: false, transparent: true, share: 0 };
    /* the most common colour (bucketed) */
    const bins = new Map(); for (const p of opaque) { const k = (p[0] >> 4) + ',' + (p[1] >> 4) + ',' + (p[2] >> 4); bins.set(k, (bins.get(k) || 0) + 1); }
    const top = [...bins.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map((v) => +v);
    const near = opaque.filter((p) => Math.abs((p[0] >> 4) - top[0]) <= 1 && Math.abs((p[1] >> 4) - top[1]) <= 1 && Math.abs((p[2] >> 4) - top[2]) <= 1);
    const rgb = [0, 1, 2].map((k) => Math.round(near.reduce((s, p) => s + p[k], 0) / near.length));
    const share = near.length / px.length;
    return { has: share >= 0.7, rgb, share };
  }

  /** flood fill from every border pixel close to the background colour (and from extra seeds); soft edge; returns a new canvas */
  function remove(c, o = {}) {
    const tol = o.tol != null ? o.tol : 42, w = c.width, h = c.height, out = clone(c), g = ctx2(out), img = g.getImageData(0, 0, w, h), a = img.data;
    const det = o.rgb ? { rgb: o.rgb } : detect(c); if (!det.rgb) return out;
    const rgb = det.rgb, bg = new Uint8Array(w * h), q = new Int32Array(w * h); let qh = 0, qt = 0;
    const push = (x, y) => { const p = y * w + x; if (bg[p]) return; const i = p * 4; if (a[i + 3] < 8 || dist(a, i, rgb) < tol) { bg[p] = 1; q[qt++] = p; } };
    if (o.edges !== false) { for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); } for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); } }
    for (const s of o.seeds || []) { const x = Math.round(s.x), y = Math.round(s.y); if (x >= 0 && y >= 0 && x < w && y < h) { const p = y * w + x; if (!bg[p]) { bg[p] = 1; q[qt++] = p; } } }
    while (qh < qt) { const p = q[qh++], x = p % w, y = (p / w) | 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
    /* clear the background; the pixels touching it get a soft edge and lose the background's tint */
    const soft = tol * (o.feather != null ? o.feather : 1.7);
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (bg[p]) { a[i + 3] = 0; continue; }
      const x = p % w, y = (p / w) | 0, edge = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w]);
      if (!edge) continue;
      const dd = dist(a, i, rgb); if (dd >= soft) continue;
      const al = Math.max(0.12, (dd - tol * 0.5) / (soft - tol * 0.5)); /* 0…1 */
      for (let k = 0; k < 3; k++) a[i + k] = Math.max(0, Math.min(255, Math.round((a[i + k] - rgb[k] * (1 - al)) / al)));
      a[i + 3] = Math.round(a[i + 3] * Math.min(1, al));
    }
    g.putImageData(img, 0, 0); return out;
  }
  /** the wand: also clear what is connected to (x, y) and close to that pixel's colour */
  function wand(c, x, y, tol = 42) {
    const d = ctx2(c).getImageData(Math.round(x), Math.round(y), 1, 1).data; if (d[3] < 8) return clone(c);
    return remove(c, { tol, rgb: [d[0], d[1], d[2]], edges: false, seeds: [{ x, y }] });
  }
  /** share of pixels that are see-through (for the tests and the panel) */
  function clearShare(c) { const d = ctx2(c).getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 8) n++; return n / (d.length / 4); }
  /** the bounds of what is not see-through (image px) */
  function bounds(c, thr = 24) {
    const w = c.width, h = c.height, d = ctx2(c).getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? { x0: 0, y0: 0, x1: w, y1: h, w, h } : { x0, y0, x1: x1 + 1, y1: y1 + 1, w: x1 + 1 - x0, h: y1 + 1 - y0 };
  }

  OC.Cutout = { detect, remove, wand, clearShare, bounds, clone };
})();
