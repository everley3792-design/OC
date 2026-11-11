/* OC Shimeji — frame-by-frame animation system.
 *
 * AnimDoc (stored in save.animations; images are asset ids, never pixels):
 * { id, name, owner(charId|null shared), action, category: base|overlay|emote|custom, dir: any|front|back|left|right,
 *   fps, speed, loop: loop|once|pingpong, repeat (0 = forever),
 *   w, h,                                    frame canvas size (px)
 *   layers: [{ id, name, visible, opacity, cells:[assetId|null …] }],   bottom → top
 *   durs:   [ms|null …],                      per-frame duration (null = 1000/fps)
 *   anchor: {x,y} foot point (px), offset: {x,y}, hitbox: {x,y,w,h}, points: { head:{x,y} },
 *   priority 0–10, interruptible, conditions: { when, minEnergy, trait }, events: [{frame, type, data}],
 *   overlay: { suppressIn:[actions] }, updated }
 *
 * Direction fallback: exact → mirror of opposite side (left↔right) → any → front → anything.
 * Action fallback:   the chain in OC.Chars.ACTIONS (e.g. run → walk → idle), finally idle.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store;
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function create(o = {}) {
    const cells = o.cells || [[]];
    const n = Math.max(1, ...cells.map((c) => c.length));
    const doc = {
      id: o.id || uid('an'), name: o.name || '新動作', owner: o.owner === undefined ? null : o.owner, action: o.action || 'idle', category: o.category || 'base', dir: o.dir || 'any',
      fps: o.fps || 8, speed: 1, loop: o.loop || 'loop', repeat: 0, w: o.w || 256, h: o.h || 256,
      layers: cells.map((c, i) => ({ id: uid('ly'), name: i ? `圖層 ${i + 1}` : '主體', visible: true, opacity: 1, cells: Array.from({ length: n }, (_, k) => c[k] || null) })),
      durs: Array.from({ length: n }, () => null), anchor: o.anchor || null, offset: { x: 0, y: 0 }, hitbox: null, points: {},
      priority: o.priority == null ? 1 : o.priority, interruptible: true, conditions: { when: 'always' }, events: [], overlay: { suppressIn: ['sleep'] }, created: Date.now(), updated: Date.now(),
    };
    return doc;
  }
  const get = (id) => S().animations[id] || null;
  function save(doc) { doc.updated = Date.now(); S().animations[doc.id] = doc; compCache.forEach((v, k) => { if (k.startsWith(doc.id + '#')) compCache.delete(k); }); St.touch('animations', { id: doc.id }); return doc; }
  function remove(id) {
    delete S().animations[id];
    for (const c of Object.values(S().chars)) for (const a of Object.keys(c.actions || {})) { for (const d of Object.keys(c.actions[a])) if (c.actions[a][d] === id) delete c.actions[a][d]; if (!Object.keys(c.actions[a]).length) delete c.actions[a]; }
    St.touch('animations', { id, removed: true });
  }
  const list = (f) => Object.values(S().animations).filter(f || (() => true)).sort((a, b) => b.updated - a.updated);
  const count = (doc) => (doc.layers[0] ? doc.layers[0].cells.length : 0);
  const dur = (doc, i) => Math.max(10, doc.durs[i] || 1000 / (doc.fps || 8));
  const total = (doc) => { let t = 0; for (let i = 0; i < count(doc); i++) t += dur(doc, i); return t; };
  /** every asset id the doc uses */
  const assetsOf = (doc) => doc.layers.flatMap((l) => l.cells).filter(Boolean);

  /** frame index at time t (seconds since start) → { i, done } honouring loop mode, repeat count and speed */
  function frameAt(doc, t, speed = 1) {
    const n = count(doc); if (!n) return { i: 0, done: true };
    const T = total(doc), ms = Math.max(0, t * 1000 * (doc.speed || 1) * speed);
    let k = ms, cycle = 0, rev = false;
    if (doc.loop === 'pingpong' && n > 1) { const span = T * 2 - dur(doc, 0) - dur(doc, n - 1); cycle = Math.floor(ms / span); k = ms % span; if (k >= T) { k = k - T; rev = true; } }
    else { cycle = Math.floor(ms / T); k = ms % T; }
    const finite = doc.loop === 'once' || (doc.repeat || 0) > 0;
    const cycles = doc.loop === 'once' ? 1 : doc.repeat || Infinity;
    if (finite && cycle >= cycles) return { i: rev ? 0 : n - 1, done: true };
    let i = 0; let acc = 0;
    if (!rev) { for (i = 0; i < n; i++) { acc += dur(doc, i); if (k < acc) break; } }
    else { for (i = n - 2; i > 0; i--) { acc += dur(doc, i); if (k < acc) break; } }
    return { i: Math.min(n - 1, Math.max(0, i)), done: false, cycle };
  }

  /** composite of all visible layers for frame i (sync; null while images are still loading) */
  const compCache = new Map();
  function composite(doc, i, opts = {}) {
    const key = `${doc.id}#${doc.updated}#${i}#${opts.onlyLayer || ''}`;
    const hit = compCache.get(key); if (hit) return hit;
    const c = OC.makeCanvas(doc.w, doc.h), x = c.getContext('2d'); let ok = true, any = false;
    for (const l of doc.layers) {
      if (!l.visible || (opts.onlyLayer && l.id !== opts.onlyLayer)) continue;
      const id = l.cells[i]; if (!id) continue; any = true;
      const img = OC.Assets.peek(id); if (!img) { ok = false; continue; }
      x.globalAlpha = l.opacity == null ? 1 : l.opacity; x.drawImage(img, 0, 0, doc.w, doc.h);
    }
    if (!ok) return null;
    if (!any) c.empty = true;
    compCache.set(key, c); if (compCache.size > 160) compCache.delete(compCache.keys().next().value);
    return c;
  }
  async function preload(doc) { await Promise.all(assetsOf(doc).map((id) => OC.Assets.image(id).catch(() => null))); }
  /** auto-detect the foot point: bottom-most opaque row, horizontal centre of mass (first frame) */
  async function detectAnchor(doc) {
    await preload(doc);
    const c = composite(doc, 0); if (!c) return { x: doc.w / 2, y: doc.h * 0.9 };
    return contentBox(c).foot;
  }
  function contentBox(c) {
    const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1, sx = 0, sn = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { x0: 0, y0: 0, x1: W, y1: H, w: W, h: H, foot: { x: W / 2, y: H * 0.9 } };
    for (let y = Math.max(y0, y1 - Math.max(2, Math.round((y1 - y0) * 0.12))); y <= y1; y++) for (let x = x0; x <= x1; x++) if (d[(y * W + x) * 4 + 3] > 24) { sx += x; sn++; }
    return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, foot: { x: sn ? sx / sn : (x0 + x1) / 2, y: y1 + 1 } };
  }

  // ---------------- character → docs ----------------
  const OPP = { left: 'right', right: 'left' };
  /** resolve the doc for (char, action, dir) with direction + action fallbacks → { doc, mirror, action, dir } | null */
  function resolve(c, action, dir = 'front') {
    const chain = [action, ...(((OC.Chars.ACTIONS.find((a) => a[0] === action) || [])[3]) || []), 'idle'];
    for (const act of chain) {
      const m = c.actions && c.actions[act]; if (!m) continue;
      const pick = (d) => m[d] && get(m[d]);
      let doc = pick(dir); if (doc) return { doc, mirror: false, action: act, dir, slot: dir };
      if (OPP[dir] && pick(OPP[dir])) return { doc: pick(OPP[dir]), mirror: true, action: act, dir, slot: OPP[dir] };
      doc = pick('any') || pick('front') || pick(dir === 'back' ? 'front' : 'back') || pick('left') || pick('right');
      if (doc) return { doc, mirror: (dir === 'left' && !!m.right && !m.left && doc.id === m.right) || (dir === 'right' && !!m.left && !m.right && doc.id === m.left), action: act, dir, slot: ['any', 'front', 'back', 'left', 'right'].find((k) => m[k] === doc.id) || 'any' };   // 13.0: slot → picture characters turn a one-direction picture themselves
    }
    return null;
  }
  /** assign a doc to a character action+direction */
  function assign(c, action, dir, docId) { c.actions = c.actions || {}; const m = (c.actions[action] = c.actions[action] || {}); if (docId) m[dir || 'any'] = docId; else delete m[dir || 'any']; if (!Object.keys(m).length) delete c.actions[action]; OC.Chars.save(c); }
  /** which actions does a character have custom frames for */
  const coverage = (c) => Object.keys(c.actions || {}).filter((a) => Object.values(c.actions[a]).some((id) => get(id)));

  /** fire the events between two frames (inclusive of `to`) */
  function eventsBetween(doc, from, to) { if (!doc.events || !doc.events.length || from === to) return []; return doc.events.filter((e) => (from < to ? e.frame > from && e.frame <= to : e.frame > from || e.frame <= to)); }

  OC.Anim = { create, get, save, remove, list, count, dur, total, assetsOf, frameAt, composite, preload, detectAnchor, contentBox, resolve, assign, coverage, eventsBetween, uid, clearCache: () => compCache.clear() };
})();
