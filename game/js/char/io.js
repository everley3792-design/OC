/* OC Shimeji — import / export.
 *  decodeFile(file)        → { kind:'still'|'animated', frames:[{canvas, delay}] , name, w, h }
 *     PNG/JPEG/WebP stills; animated GIF/APNG/WebP via ImageDecoder (WebCodecs); a built-in GIF
 *     decoder is the fallback; ZIP returns its image entries (natural order).
 *  sliceSheet(img, opts)   → canvases (grid by cols/rows or cell size, margin, spacing, order, skip empty)
 *  zip reader / writer     (store + deflate-raw via DecompressionStream; writer uses store)
 *  exportPack / readPack / applyPack  .ocpack = zip { manifest.json, assets/<id>.png }
 * Every failure produces a readable Chinese message — never a silent "accepted but unusable".
 */
(function () {
  'use strict';
  const naturalCmp = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const ext = (n) => (n.split('.').pop() || '').toLowerCase();
  const IMG_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'apng', 'bmp'];
  const MAX_FILE = 40 * 1024 * 1024;

  function toCanvas(src, w, h) { const c = OC.makeCanvas(w || src.width || src.displayWidth, h || src.height || src.displayHeight); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c; }
  async function sniff(buf) {
    const b = new Uint8Array(buf.slice(0, 64));
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) { const s = new TextDecoder('latin1').decode(new Uint8Array(buf.slice(0, Math.min(buf.byteLength, 4096)))); return s.includes('acTL') ? 'image/apng' : 'image/png'; }
    if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) { const s = new TextDecoder('latin1').decode(new Uint8Array(buf.slice(0, 64))); return s.includes('ANIM') || s.includes('ANMF') ? 'image/webp-anim' : 'image/webp'; }
    if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'application/zip';
    if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
    return '';
  }

  /** decode one file → frames */
  async function decodeFile(file) {
    if (file.size > MAX_FILE) throw new Error(`「${file.name}」太大（${(file.size / 1048576).toFixed(1)} MB），單檔上限 40 MB`);
    const buf = await file.arrayBuffer(), type = await sniff(buf);
    if (!type) throw new Error(`「${file.name}」不是支援的格式（PNG、JPEG、WebP、GIF、APNG、ZIP）`);
    if (type === 'application/zip') return { kind: 'zip', name: file.name, entries: await readZip(buf) };
    const animated = type === 'image/gif' || type === 'image/apng' || type === 'image/webp-anim';
    if (animated) {
      const mime = type === 'image/apng' ? 'image/png' : type === 'image/webp-anim' ? 'image/webp' : type;
      if (window.ImageDecoder && (await ImageDecoder.isTypeSupported(mime).catch(() => false))) {
        try { return Object.assign(await decodeAnimated(buf, mime), { name: file.name }); } catch (e) { if (type !== 'image/gif') throw new Error(`「${file.name}」動畫解碼失敗：${e.message}`); }
      }
      if (type === 'image/gif') return Object.assign(decodeGif(new Uint8Array(buf)), { name: file.name });
      const still = await decodeStill(buf, mime);
      return { kind: 'still', name: file.name, frames: [{ canvas: still, delay: 100 }], w: still.width, h: still.height, warning: '這個系統不支援解析此動畫格式，只讀取到第一格' };
    }
    const c = await decodeStill(buf, type);
    return { kind: 'still', name: file.name, frames: [{ canvas: c, delay: 100 }], w: c.width, h: c.height };
  }
  async function decodeStill(buf, type) {
    const blob = new Blob([buf], { type });
    try { const bmp = await createImageBitmap(blob); const c = toCanvas(bmp); bmp.close && bmp.close(); return c; }
    catch (e) { const img = await new Promise((res, rej) => { const u = URL.createObjectURL(blob), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('圖片已損壞或無法解碼')); }; i.src = u; }); return toCanvas(img, img.naturalWidth, img.naturalHeight); }
  }
  async function decodeAnimated(buf, mime) {
    const dec = new ImageDecoder({ data: buf, type: mime });
    await dec.tracks.ready; const n = dec.tracks.selectedTrack ? dec.tracks.selectedTrack.frameCount : 1;
    if (n > OC.Assets.LIMITS.maxFramesPerImport) throw new Error(`影格太多（${n}），上限 ${OC.Assets.LIMITS.maxFramesPerImport}`);
    const frames = [];
    for (let i = 0; i < n; i++) { const { image } = await dec.decode({ frameIndex: i }); const c = toCanvas(image, image.displayWidth, image.displayHeight); frames.push({ canvas: c, delay: Math.max(20, Math.round((image.duration || 100000) / 1000)) }); image.close(); }
    dec.close();
    return { kind: n > 1 ? 'animated' : 'still', frames, w: frames[0].canvas.width, h: frames[0].canvas.height };
  }

  // ---------- built-in GIF decoder (fallback) ----------
  function decodeGif(b) {
    let p = 6; const W = b[p] | (b[p + 1] << 8), H = b[p + 2] | (b[p + 3] << 8), flags = b[p + 4]; p += 7;
    let gct = null; if (flags & 0x80) { const n = 2 << (flags & 7); gct = b.subarray(p, p + n * 3); p += n * 3; }
    const canvas = OC.makeCanvas(W, H), cx = canvas.getContext('2d'); let img = cx.createImageData(W, H);
    const frames = []; let delay = 100, trans = -1, disposal = 0, prev = null;
    while (p < b.length) {
      const t = b[p++];
      if (t === 0x3b) break;
      if (t === 0x21) { const label = b[p++]; if (label === 0xf9) { const pk = b[p + 1]; disposal = (pk >> 2) & 7; delay = ((b[p + 2] | (b[p + 3] << 8)) || 10) * 10; trans = pk & 1 ? b[p + 4] : -1; } while (b[p]) p += b[p] + 1; p++; continue; }
      if (t !== 0x2c) throw new Error('GIF 結構錯誤');
      const fx = b[p] | (b[p + 1] << 8), fy = b[p + 2] | (b[p + 3] << 8), fw = b[p + 4] | (b[p + 5] << 8), fh = b[p + 6] | (b[p + 7] << 8), lf = b[p + 8]; p += 9;
      let ct = gct; if (lf & 0x80) { const n = 2 << (lf & 7); ct = b.subarray(p, p + n * 3); p += n * 3; }
      const interlace = lf & 0x40, minCode = b[p++]; const chunks = []; while (b[p]) { chunks.push(b.subarray(p + 1, p + 1 + b[p])); p += b[p] + 1; } p++;
      const data = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0)); let o = 0; for (const c of chunks) { data.set(c, o); o += c.length; }
      const px = lzw(data, minCode, fw * fh);
      if (disposal === 3) prev = new Uint8ClampedArray(img.data);
      const rows = interlace ? [...range(0, fh, 8), ...range(4, fh, 8), ...range(2, fh, 4), ...range(1, fh, 2)] : range(0, fh, 1);
      rows.forEach((row, ri) => { for (let x = 0; x < fw; x++) { const ci = px[ri * fw + x]; if (ci === trans || ci == null) continue; const X = fx + x, Y = fy + row; if (X >= W || Y >= H) continue; const k = (Y * W + X) * 4; img.data[k] = ct[ci * 3]; img.data[k + 1] = ct[ci * 3 + 1]; img.data[k + 2] = ct[ci * 3 + 2]; img.data[k + 3] = 255; } });
      cx.putImageData(img, 0, 0); frames.push({ canvas: toCanvas(canvas), delay });
      if (frames.length > OC.Assets.LIMITS.maxFramesPerImport) throw new Error('GIF 影格太多');
      if (disposal === 2) { for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) { if (x >= W || y >= H) continue; img.data[(y * W + x) * 4 + 3] = 0; } }
      if (disposal === 3 && prev) img = new ImageData(prev, W, H);
      trans = -1; disposal = 0; delay = 100;
    }
    if (!frames.length) throw new Error('GIF 沒有影格');
    return { kind: frames.length > 1 ? 'animated' : 'still', frames, w: W, h: H };
  }
  function range(a, b, s) { const r = []; for (let i = a; i < b; i += s) r.push(i); return r; }
  function lzw(data, minCode, n) {
    const out = new Uint8Array(n); const clear = 1 << minCode, eoi = clear + 1; let size = minCode + 1, mask = (1 << size) - 1, next = eoi + 1;
    const prefix = new Int16Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4097);
    for (let i = 0; i < clear; i++) suffix[i] = i;
    let bits = 0, cur = 0, pos = 0, op = 0, old = -1, first = 0;
    while (op < n) {
      while (bits < size) { if (pos >= data.length) return out; cur |= data[pos++] << bits; bits += 8; }
      let code = cur & mask; cur >>= size; bits -= size;
      if (code === clear) { size = minCode + 1; mask = (1 << size) - 1; next = eoi + 1; old = -1; continue; }
      if (code === eoi) break;
      if (old === -1) { out[op++] = suffix[code]; old = code; first = code; continue; }
      let sp = 0, in_ = code;
      if (code >= next) { stack[sp++] = first; code = old; }
      while (code > clear) { stack[sp++] = suffix[code]; code = prefix[code]; }
      first = suffix[code]; stack[sp++] = first;
      while (sp && op < n) out[op++] = stack[--sp];
      if (next < 4096) { prefix[next] = old; suffix[next] = first; next++; if ((next & mask) === 0 && next < 4096) { size++; mask = (1 << size) - 1; } }
      old = in_;
    }
    return out;
  }

  // ---------- sprite sheet ----------
  /** o = { cols, rows, cellW, cellH, margin, spacing, order:'row'|'col', skipEmpty } */
  function sliceSheet(src, o) {
    const W = src.width, H = src.height, m = o.margin || 0, sp = o.spacing || 0;
    const cols = o.cols || Math.max(1, Math.floor((W - 2 * m + sp) / ((o.cellW || W) + sp))), rows = o.rows || Math.max(1, Math.floor((H - 2 * m + sp) / ((o.cellH || H) + sp)));
    const cw = o.cellW || Math.floor((W - 2 * m - sp * (cols - 1)) / cols), ch = o.cellH || Math.floor((H - 2 * m - sp * (rows - 1)) / rows);
    if (cw < 2 || ch < 2) throw new Error('分割尺寸太小');
    const out = [];
    const cell = (c, r) => { const x0 = m + c * (cw + sp), y0 = m + r * (ch + sp); if (x0 + cw > W + 0.5 || y0 + ch > H + 0.5) return; const k = OC.makeCanvas(cw, ch); const x = k.getContext('2d'); x.drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch); if (o.skipEmpty && isEmpty(k)) return; out.push(k); };
    if (o.order === 'col') { for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) cell(c, r); } else { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cell(c, r); }
    return { frames: out, cols, rows, cw, ch };
  }
  function isEmpty(c) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i] > 10) return false; return true; }
  /** make near-background pixels transparent (key = colour at a corner) */
  function keyOut(c, tol = 48) {
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), a = d.data, k = [a[0], a[1], a[2]];
    if (a[3] < 250) return c;
    for (let i = 0; i < a.length; i += 4) { const dd = Math.abs(a[i] - k[0]) + Math.abs(a[i + 1] - k[1]) + Math.abs(a[i + 2] - k[2]); if (dd < tol) a[i + 3] = 0; else if (dd < tol * 1.6) a[i + 3] = Math.min(a[i + 3], ((dd - tol) / (tol * 0.6)) * 255); }
    x.putImageData(d, 0, 0); return c;
  }
  /** trim transparent margins, keep `pad` px */
  function trim(c, pad = 4) { const b = OC.Anim.contentBox(c); if (b.w >= c.width && b.h >= c.height) return c; const k = OC.makeCanvas(b.w + pad * 2, b.h + pad * 2); k.getContext('2d').drawImage(c, b.x0 - pad, b.y0 - pad, k.width, k.height, 0, 0, k.width, k.height); return k; }
  /** put frames on one common canvas (largest size), bottom-centre aligned — consistent foot line */
  function normalizeFrames(canvases) {
    const W = Math.max(...canvases.map((c) => c.width)), H = Math.max(...canvases.map((c) => c.height));
    return canvases.map((c) => { if (c.width === W && c.height === H) return c; const k = OC.makeCanvas(W, H); k.getContext('2d').drawImage(c, Math.round((W - c.width) / 2), H - c.height); return k; });
  }

  // ---------- ZIP ----------
  async function readZip(buf) {
    const d = new DataView(buf), u8 = new Uint8Array(buf); let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (d.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('ZIP 檔已損壞（找不到目錄）');
    const n = d.getUint16(eocd + 10, true); let p = d.getUint32(eocd + 16, true); const out = [];
    for (let k = 0; k < n; k++) {
      if (d.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP 目錄損壞');
      const method = d.getUint16(p + 10, true), csize = d.getUint32(p + 20, true), usize = d.getUint32(p + 24, true), nl = d.getUint16(p + 28, true), xl = d.getUint16(p + 30, true), cl = d.getUint16(p + 32, true), off = d.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      if (name.endsWith('/') || name.startsWith('__MACOSX') || name.split('/').pop().startsWith('.')) continue;
      const lnl = d.getUint16(off + 26, true), lxl = d.getUint16(off + 28, true), start = off + 30 + lnl + lxl;
      out.push({ name, method, csize, usize, get: async () => {
        const raw = u8.subarray(start, start + csize);
        if (method === 0) return raw.slice();
        if (method === 8) { if (!window.DecompressionStream) throw new Error('這個系統不能解壓縮 ZIP（請改用不壓縮的 ZIP）'); const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(ds).arrayBuffer()); }
        throw new Error(`不支援的 ZIP 壓縮方式（${method}）`);
      } });
    }
    return out.sort((a, b) => naturalCmp(a.name, b.name));
  }
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  /** files: [{ name, data:Uint8Array }] → Blob (store method) */
  function writeZip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, f.data);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + f.data.length;
    }
    const cs = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }

  // ---------- packs ----------
  const FORMAT = 'ocshimeji-pack', VERSION = 1;
  /** gather everything a character needs */
  function charDeps(c) {
    const anims = new Set(); for (const a of Object.values(c.actions || {})) for (const id of Object.values(a)) if (OC.Anim.get(id)) anims.add(id);
    for (const d of OC.Anim.list((x) => x.owner === c.id)) anims.add(d.id);
    const assets = new Set((c.parts || []).flatMap((p) => [p.assetId, p.closedId]).filter(Boolean));
    for (const id of anims) OC.Anim.assetsOf(OC.Anim.get(id)).forEach((a) => assets.add(a));
    return { anims: [...anims], assets: [...assets] };
  }
  /** opts = { chars:[ids], anims:[ids], assets:[ids], kind, progress:boolean } → Blob */
  async function exportPack(o) {
    const chars = (o.chars || []).map((id) => OC.Chars.get(id)).filter(Boolean);
    const animIds = new Set(o.anims || []), assetIds = new Set(o.assets || []);
    for (const c of chars) { const d = charDeps(c); d.anims.forEach((x) => animIds.add(x)); d.assets.forEach((x) => assetIds.add(x)); }
    for (const id of animIds) OC.Anim.assetsOf(OC.Anim.get(id)).forEach((a) => assetIds.add(a));
    const missing = OC.Assets.missing([...assetIds]); if (missing.length) throw new Error(`有 ${missing.length} 個素材遺失，無法完整匯出`);
    const files = [], assets = [];
    for (const id of assetIds) { const b = await OC.Assets.blob(id); const m = OC.Assets.meta.get(id); files.push({ name: `assets/${id}.png`, data: new Uint8Array(await b.arrayBuffer()) }); assets.push({ id, file: `assets/${id}.png`, w: m.w, h: m.h, kind: m.kind, name: m.name, size: m.size }); }
    const manifest = { format: FORMAT, version: VERSION, app: OC.Store.NATIVE ? OC.Store.NATIVE.appVersion() : 'web', kind: o.kind || (chars.length > 1 ? 'characters' : chars.length ? 'character' : 'animation'), created: new Date().toISOString(),
      chars: chars.map((c) => OC.Chars.clone(c)), animations: [...animIds].map((id) => OC.Chars.clone(OC.Anim.get(id))), assets };
    if (o.progress) { const s = OC.Chars.clone(OC.Store.s); delete s.chars; delete s.animations; manifest.progress = s; }
    files.unshift({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) });
    return writeZip(files);
  }
  /** read + validate a pack → { manifest, entries, problems[] } */
  async function readPack(buf) {
    const entries = await readZip(buf), mf = entries.find((e) => e.name === 'manifest.json');
    if (!mf) throw new Error('不是 OC Shimeji 素材包（缺少 manifest.json）');
    let manifest; try { manifest = JSON.parse(new TextDecoder().decode(await mf.get())); } catch (e) { throw new Error('manifest.json 格式錯誤'); }
    if (manifest.format !== FORMAT) throw new Error('不是 OC Shimeji 素材包');
    if (manifest.version > VERSION) throw new Error(`素材包版本較新（v${manifest.version}），請先更新 App`);
    const names = new Set(entries.map((e) => e.name)), problems = [];
    for (const a of manifest.assets || []) if (!names.has(a.file)) problems.push(`缺少圖片 ${a.file}`);
    const known = new Set((manifest.assets || []).map((a) => a.id));
    for (const d of manifest.animations || []) for (const id of d.layers.flatMap((l) => l.cells).filter(Boolean)) if (!known.has(id)) problems.push(`動作「${d.name}」引用了不存在的圖片`);
    return { manifest, entries, problems };
  }
  /** apply a pack. mode: 'new' (all new ids, never overwrites) | 'replace' (same ids overwrite) | 'merge' (skip existing) */
  async function applyPack(pack, mode = 'new', onProgress) {
    const { manifest, entries } = pack, byName = new Map(entries.map((e) => [e.name, e]));
    const map = new Map(), fresh = (old, p) => (mode === 'new' ? p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) : old);
    let i = 0;
    for (const a of manifest.assets || []) {
      const id = fresh(a.id, 'as'); map.set(a.id, id);
      if (mode === 'merge' && OC.Assets.has(a.id)) continue;
      const data = await byName.get(a.file).get();
      await OC.Assets.putBlob(new Blob([data], { type: 'image/png' }), { id, kind: a.kind || 'import', name: a.name || '' });
      onProgress && onProgress(++i, manifest.assets.length);
    }
    const animMap = new Map();
    for (const d0 of manifest.animations || []) {
      const d = OC.Chars.clone(d0); const nid = fresh(d.id, 'an'); animMap.set(d.id, nid); d.id = nid;
      if (mode === 'merge' && OC.Anim.get(d0.id)) continue;
      d.layers.forEach((l) => { l.cells = l.cells.map((c) => (c ? map.get(c) || c : null)); });
      OC.Store.s.animations[d.id] = d;
    }
    const added = [];
    for (const c0 of manifest.chars || []) {
      const c = OC.Chars.normalize(OC.Chars.clone(c0)); const old = c.id;
      if (mode === 'merge' && OC.Chars.get(old)) continue;
      c.id = mode === 'new' ? OC.Chars.newId() : old;
      for (const d of Object.values(OC.Store.s.animations)) if (d.owner === old && animMap.has(d.id) === false && mode === 'new') { /* untouched */ }
      for (const nid of animMap.values()) { const d = OC.Store.s.animations[nid]; if (d && d.owner === old) d.owner = c.id; }
      for (const a of Object.keys(c.actions || {})) for (const dir of Object.keys(c.actions[a])) c.actions[a][dir] = animMap.get(c.actions[a][dir]) || c.actions[a][dir];
      (c.parts || []).forEach((p) => { p.assetId = map.get(p.assetId) || p.assetId; if (p.closedId) p.closedId = map.get(p.closedId) || p.closedId; });
      if (mode === 'new' && OC.Chars.all().some((x) => x.profile.name === c.profile.name)) c.profile.name += '（匯入）';
      c.status.onIsland = false;
      if (mode === 'replace' && OC.Chars.get(c.id)) OC.Chars.save(c); else OC.Chars.add(c);
      added.push(c);
    }
    OC.Store.s.imports.unshift({ at: Date.now(), kind: manifest.kind, n: added.length, anims: animMap.size, assets: map.size, mode }); OC.Store.s.imports = OC.Store.s.imports.slice(0, 30);
    OC.Store.touch('chars'); OC.Anim.clearCache();
    return { chars: added, anims: animMap.size, assets: map.size };
  }

  // ---------- save / share a blob ----------
  async function deliver(blob, name) {
    const N = OC.Store.NATIVE;
    if (N && N.shareFile) {
      const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
      return N.shareFile(name, blob.type || 'application/octet-stream', b64);
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return true;
  }
  /** a sprite sheet PNG (single row) of an animation */
  async function sheetOf(doc) {
    await OC.Anim.preload(doc); const n = OC.Anim.count(doc), c = OC.makeCanvas(doc.w * n, doc.h), x = c.getContext('2d');
    for (let i = 0; i < n; i++) { const f = OC.Anim.composite(doc, i); if (f) x.drawImage(f, i * doc.w, 0); }
    return OC.Assets.canvasToBlob(c);
  }

  OC.IO = { decodeFile, decodeGif, sliceSheet, keyOut, trim, normalizeFrames, readZip, writeZip, crc32, exportPack, readPack, applyPack, charDeps, deliver, sheetOf, naturalCmp, IMG_EXT, ext, sniff, FORMAT };
})();
