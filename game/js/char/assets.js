/* OC Shimeji — binary asset store.
 * Images (drawn, imported, animation frames, parts) live in IndexedDB as Blobs — never as
 * base64 inside the JSON save. The save only keeps asset ids. Each asset has a metadata
 * record (kind, size, owners, tags) and a small thumbnail blob. Decoded images are kept in
 * an LRU cache bounded by pixel count so big animations cannot exhaust phone memory.
 */
(function () {
  'use strict';
  const DB = 'oc-assets', VER = 1;
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
        if (!d.objectStoreNames.contains('thumbs')) d.createObjectStore('thumbs');
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('drafts')) d.createObjectStore('drafts');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function tx(stores, mode, fn) {
    return db().then((d) => new Promise((res, rej) => {
      const t = d.transaction(stores, mode); let out;
      Promise.resolve(fn(t)).then((v) => { out = v; });
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted'));
    }));
  }
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  // ---------- limits (phone-safe) ----------
  const LIMITS = { maxSide: 1024, maxBytes: 8 * 1024 * 1024, maxFramesPerImport: 240, cachePixels: 64 * 1024 * 1024 / 4 };
  const meta = new Map();          // id → metadata (all loaded at boot; small)
  let ready = null;
  function init() {
    if (ready) return ready;
    ready = tx(['meta'], 'readonly', (t) => req(t.objectStore('meta').getAll())).then((all) => { all.forEach((m) => meta.set(m.id, m)); return meta.size; })
      .catch((e) => { console.error('[assets] IndexedDB unavailable', e); return 0; });
    return ready;
  }
  const uid = (p = 'as') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function canvasToBlob(c, type = 'image/png', q) { return new Promise((res) => (c.convertToBlob ? c.convertToBlob({ type, quality: q }).then(res) : c.toBlob(res, type, q))); }
  function makeThumb(src, w, h, px = 96) {
    const s = Math.min(1, px / Math.max(w, h)), c = OC.makeCanvas(Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return canvasToBlob(c, 'image/png');
  }
  /** fit a source into the size limit (keeps original when small enough) */
  function fitCanvas(src, w, h, maxSide = LIMITS.maxSide) {
    const s = Math.min(1, maxSide / Math.max(w, h)); const c = OC.makeCanvas(Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height); return c;
  }

  /**
   * Store a canvas / ImageBitmap / Image as a PNG asset.
   * m = { kind:'part'|'frame'|'drawing'|'import'|'thumb'…, name, owner (charId|null = shared), tags[] , slot }
   */
  async function put(src, m = {}) {
    await init();
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    const c = (w > LIMITS.maxSide || h > LIMITS.maxSide || !(src instanceof HTMLCanvasElement)) ? fitCanvas(src, w, h) : src;
    const blob = await canvasToBlob(c, 'image/png');
    if (blob.size > LIMITS.maxBytes) throw new Error(`圖片太大（${(blob.size / 1048576).toFixed(1)} MB），上限 ${LIMITS.maxBytes / 1048576} MB`);
    const thumb = await makeThumb(c, c.width, c.height);
    const rec = Object.assign({ id: m.id || uid(), kind: 'part', name: '', owners: [], tags: [], created: Date.now() }, m, { w: c.width, h: c.height, size: blob.size, updated: Date.now() });
    if (m.owner !== undefined) { rec.owners = m.owner ? [m.owner] : []; delete rec.owner; }
    await tx(['blobs', 'thumbs', 'meta'], 'readwrite', (t) => { t.objectStore('blobs').put(blob, rec.id); t.objectStore('thumbs').put(thumb, rec.id); t.objectStore('meta').put(rec); });
    meta.set(rec.id, rec); evict(rec.id); OC.Store.emit('assets', { id: rec.id });
    return rec;
  }
  /** store an existing PNG/whatever blob as is (pack import) */
  async function putBlob(blob, m) {
    const img = await decodeBlob(blob);
    return put(img, m);
  }
  async function replace(id, src) { const old = meta.get(id); if (!old) throw new Error('asset missing'); return put(src, Object.assign({}, old, { id })); }
  async function update(id, patch) { const m = meta.get(id); if (!m) return; Object.assign(m, patch, { updated: Date.now() }); await tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put(m)); OC.Store.emit('assets', { id }); }
  async function duplicate(id, patch = {}) { const img = await image(id); return put(img, Object.assign({}, meta.get(id), { id: undefined, name: (meta.get(id).name || '') + ' 複本' }, patch)); }
  async function remove(id) { await tx(['blobs', 'thumbs', 'meta'], 'readwrite', (t) => { t.objectStore('blobs').delete(id); t.objectStore('thumbs').delete(id); t.objectStore('meta').delete(id); }); meta.delete(id); evict(id); OC.Store.emit('assets', { id, removed: true }); }
  const blob = (id) => tx(['blobs'], 'readonly', (t) => req(t.objectStore('blobs').get(id)));
  const thumbBlob = (id) => tx(['thumbs'], 'readonly', (t) => req(t.objectStore('thumbs').get(id)));

  // ---------- decoding + LRU cache ----------
  function decodeBlob(b) {
    if (window.createImageBitmap) return createImageBitmap(b).catch(() => imgFromBlob(b));
    return imgFromBlob(b);
  }
  function imgFromBlob(b) { return new Promise((res, rej) => { const u = URL.createObjectURL(b), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('無法解碼圖片')); }; i.src = u; }); }
  const cache = new Map(); let cachePx = 0; const pending = new Map();
  function evict(id) { const e = cache.get(id); if (e) { cachePx -= e.px; if (e.img.close) e.img.close(); cache.delete(id); } }
  /** decoded image (ImageBitmap / Image) — async */
  function image(id) {
    const e = cache.get(id); if (e) { cache.delete(id); cache.set(id, e); return Promise.resolve(e.img); }
    if (pending.has(id)) return pending.get(id);
    const p = blob(id).then((b) => { if (!b) throw new Error('missing asset ' + id); return decodeBlob(b); }).then((img) => {
      const px = (img.width || 1) * (img.height || 1); cache.set(id, { img, px }); cachePx += px; pending.delete(id);
      for (const [k, v] of cache) { if (cachePx <= LIMITS.cachePixels) break; if (k === id) continue; cachePx -= v.px; cache.delete(k); }
      return img;
    }).catch((err) => { pending.delete(id); throw err; });
    pending.set(id, p); return p;
  }
  /** decoded image if already cached, else null (and starts loading) — for render loops */
  function peek(id) { if (!id) return null; const e = cache.get(id); if (e) return e.img; if (!pending.has(id) && meta.has(id)) image(id).catch(() => 0); return null; }
  const urls = new Map();
  async function thumbURL(id) { if (urls.has(id)) return urls.get(id); const b = await thumbBlob(id); if (!b) return ''; const u = URL.createObjectURL(b); urls.set(id, u); return u; }
  async function dataURL(id) { const b = await blob(id); return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }); }

  // ---------- drafts (autosave / crash recovery) ----------
  const draftPut = (key, val) => tx(['drafts'], 'readwrite', (t) => t.objectStore('drafts').put(val, key));
  const draftGet = (key) => tx(['drafts'], 'readonly', (t) => req(t.objectStore('drafts').get(key)));
  const draftDel = (key) => tx(['drafts'], 'readwrite', (t) => t.objectStore('drafts').delete(key));

  // ---------- queries / integrity ----------
  const list = (f) => [...meta.values()].filter(f || (() => true)).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const has = (id) => meta.has(id);
  /** asset ids referenced by the save that do not exist (missing-asset check) */
  function missing(ids) { return [...new Set(ids)].filter((id) => id && !meta.has(id)); }
  function usage() { let n = 0, bytes = 0; for (const m of meta.values()) { n++; bytes += m.size || 0; } return { n, bytes }; }

  OC.Assets = { init, put, putBlob, replace, update, duplicate, remove, blob, image, peek, thumbURL, dataURL, decodeBlob, canvasToBlob, fitCanvas, list, has, missing, usage, draftPut, draftGet, draftDel, LIMITS, get meta() { return meta; }, uid };
})();
