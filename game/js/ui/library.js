/* OC Shimeji — asset library: import pipeline (files → frames → options → assets / animation /
 * parts), the picker used by the editors, and the 素材庫 management page.
 */
(function () {
  'use strict';
  const { h, icon, toast, sheet, seg, toggle, haptic, confirm } = OC.UI;
  const A = () => OC.Assets, IO = () => OC.IO, S = () => OC.Store.s, St = OC.Store;
  const KIND_ZH = { part: '部件', frame: '影格', drawing: '繪圖', import: '匯入', baked: '合成' };

  // ---------------- files ----------------
  function chooseFiles(o = {}) {
    return new Promise((res) => {
      const inp = h('input', { type: 'file', accept: o.accept || 'image/*,.gif,.png,.webp,.zip,.ocpack', multiple: o.multiple !== false, style: { display: 'none' } });
      let done = false; const finish = (v) => { if (done) return; done = true; inp.remove(); res(v); };
      inp.addEventListener('change', () => finish([...inp.files]));
      inp.addEventListener('cancel', () => finish([]));
      document.body.append(inp); inp.click();
      window.addEventListener('focus', () => setTimeout(() => { if (!inp.files || !inp.files.length) finish([]); }, 1200), { once: true });
    });
  }
  /** any files → ordered frames [{canvas, delay, name}] (+ warnings) */
  async function framesFromFiles(files) {
    const out = [], warnings = [];
    const sorted = [...files].sort((a, b) => IO().naturalCmp(a.name, b.name));
    if (sorted.length > A().LIMITS.maxFramesPerImport) throw new Error(`一次最多 ${A().LIMITS.maxFramesPerImport} 個檔案`);
    for (const f of sorted) {
      const d = await IO().decodeFile(f);
      if (d.warning) warnings.push(`${f.name}：${d.warning}`);
      if (d.kind === 'zip') {
        const imgs = d.entries.filter((e) => IO().IMG_EXT.includes(IO().ext(e.name)));
        if (!imgs.length) throw new Error(`「${f.name}」裡沒有圖片`);
        for (const e of imgs) { const bytes = await e.get(); const sub = await IO().decodeFile(new File([bytes], e.name.split('/').pop())); sub.frames.forEach((fr, i) => out.push(Object.assign(fr, { name: e.name + (sub.frames.length > 1 ? '#' + i : '') }))); }
      } else d.frames.forEach((fr, i) => out.push(Object.assign(fr, { name: f.name + (d.frames.length > 1 ? '#' + i : '') })));
      if (out.length > A().LIMITS.maxFramesPerImport) throw new Error(`影格太多（超過 ${A().LIMITS.maxFramesPerImport}）`);
    }
    if (!out.length) throw new Error('沒有讀到任何圖片');
    return { frames: out, warnings };
  }
  function hasOpaqueCorners(c) { const x = c.getContext('2d'), w = c.width, hh = c.height; return [[0, 0], [w - 1, 0], [0, hh - 1], [w - 1, hh - 1]].every(([a, b]) => x.getImageData(a, b, 1, 1).data[3] > 250); }
  /** apply import options to canvases */
  function process(frames, o) {
    let cs = frames.map((f) => { let c = f.canvas; if (o.keyOut) c = IO().keyOut(cloneCanvas(c)); if (o.rotate) c = rotate90(c, o.rotate); if (o.flip) c = flipH(c); return c; });
    if (o.trim) { const boxes = cs.map((c) => OC.Anim.contentBox(c)); const x0 = Math.min(...boxes.map((b) => b.x0)), y0 = Math.min(...boxes.map((b) => b.y0)), x1 = Math.max(...boxes.map((b) => b.x1)), y1 = Math.max(...boxes.map((b) => b.y1)); cs = cs.map((c) => { const k = OC.makeCanvas(x1 - x0 + 9, y1 - y0 + 9); k.getContext('2d').drawImage(c, -x0 + 4, -y0 + 4); return k; }); }
    if (o.scale && o.scale !== 1) cs = cs.map((c) => { const k = OC.makeCanvas(Math.max(1, Math.round(c.width * o.scale)), Math.max(1, Math.round(c.height * o.scale))); const x = k.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, k.width, k.height); return k; });
    return IO().normalizeFrames(cs);
  }
  const cloneCanvas = (c) => { const k = OC.makeCanvas(c.width, c.height); k.getContext('2d').drawImage(c, 0, 0); return k; };
  function rotate90(c, n) { let k = c; for (let i = 0; i < ((n % 4) + 4) % 4; i++) { const r = OC.makeCanvas(k.height, k.width), x = r.getContext('2d'); x.translate(r.width, 0); x.rotate(Math.PI / 2); x.drawImage(k, 0, 0); k = r; } return k; }
  function flipH(c) { const k = OC.makeCanvas(c.width, c.height), x = k.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return k; }

  /** canvases → assets → animation doc */
  async function makeAnim(canvases, o = {}) {
    const ids = [];
    for (let i = 0; i < canvases.length; i++) { const r = await A().put(canvases[i], { kind: 'frame', name: `${o.name || '動作'} ${i + 1}`, owner: o.owner || null }); ids.push(r.id); o.onProgress && o.onProgress(i + 1, canvases.length); }
    const doc = OC.Anim.create({ name: o.name || '新動作', owner: o.owner || null, action: o.action || 'idle', dir: o.dir || 'any', fps: o.fps || 8, cells: [ids], w: canvases[0].width, h: canvases[0].height, loop: o.loop });
    if (o.delays && o.delays.some((d) => d && Math.abs(d - o.delays[0]) > 5)) doc.durs = o.delays.map((d) => Math.max(20, d || 100)); else if (o.delays && o.delays[0]) doc.fps = Math.max(1, Math.min(30, Math.round(1000 / o.delays[0])));
    const box = OC.Anim.contentBox(canvases[0]); doc.anchor = box.foot; doc.points = { head: { x: box.foot.x, y: box.y0 + box.h * 0.22 } };
    OC.Anim.save(doc); return { doc, box };
  }
  /** creator: build a sprite character from player files */
  async function spriteCharFromFiles(c, files) {
    const { frames, warnings } = await framesFromFiles(files);
    const auto = hasOpaqueCorners(frames[0].canvas);
    const cs = process(frames, { keyOut: auto, trim: true });
    const { doc, box } = await makeAnim(cs, { name: '待機', owner: c.id, action: 'idle', delays: frames.map((f) => f.delay) });
    c.actions.idle = { any: doc.id }; c.appearance.mode = 'sprite'; c.appearance.refH = box.h;
    if (auto) toast('已自動去除背景（可在素材庫調整）', 'image');
    warnings.forEach((w) => toast(w, 'info'));
    return doc;
  }

  // ---------------- import dialog ----------------
  /** o = { purpose:'assets'|'anim'|'part', owner, action, dir, onDone(result) } */
  async function importDialog(o = {}) {
    const files = await chooseFiles({ multiple: true }); if (!files.length) return null;
    if (files.length === 1 && ['ocpack', 'zip'].includes(IO().ext(files[0].name))) { const buf = await files[0].arrayBuffer(); try { const pack = await IO().readPack(buf); return packDialog(pack); } catch (e) { if (IO().ext(files[0].name) === 'ocpack') { toast(e.message, 'info'); return null; } } }
    let src;
    try { toast('讀取中…', 'image'); src = await framesFromFiles(files); } catch (e) { toast(e.message, 'info'); S().imports.unshift({ at: Date.now(), kind: 'file', name: files[0].name, ok: false, msg: e.message }); St.touch(); return null; }
    src.warnings.forEach((w) => toast(w, 'info'));
    return new Promise((resolve) => {
      const opts = { keyOut: hasOpaqueCorners(src.frames[0].canvas), trim: true, scale: 1, rotate: 0, flip: false, as: o.returnFrames ? 'anim' : o.purpose === 'anim' ? 'anim' : src.frames.length > 1 ? 'anim' : 'assets', sheet: null, fps: 8 };
      let result = null;
      sheet(`匯入 ${src.frames.length} 張圖片`, (b, api) => {
        const grid = h('div.grid.c4', { style: { marginTop: '8px' } }), info = h('div.muted', { style: { fontSize: 'var(--fs-s)' } });
        const sheetBox = h('div.card', { style: { marginTop: '8px' } }); let order = src.frames.map((_, i) => i);
        let current = [];
        const frames = () => { if (opts.sheet) { try { return IO().sliceSheet(src.frames[0].canvas, opts.sheet).frames.map((c) => ({ canvas: c, delay: 1000 / opts.fps })); } catch (e) { info.textContent = e.message; return []; } } return order.map((i) => src.frames[i]); };
        function preview() {
          const fr = frames(); current = fr.length ? process(fr, opts) : [];
          grid.replaceChildren(...current.slice(0, 48).map((c, i) => { const k = h('canvas', { width: 96, height: 96 }); Object.assign(k.style, { width: '100%', aspectRatio: '1', borderRadius: '10px', background: 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/14px 14px' }); const x = k.getContext('2d'), s = Math.min(96 / c.width, 96 / c.height); x.drawImage(c, (96 - c.width * s) / 2, (96 - c.height * s) / 2, c.width * s, c.height * s);
            return h('div', { style: { position: 'relative' } }, k, h('span.num', { style: { position: 'absolute', left: '6px', top: '2px', fontSize: '10px', color: '#8F7660' } }, i + 1)); }));
          info.textContent = current.length ? `${current.length} 張・${current[0].width}×${current[0].height}px${current.length > 48 ? '（只預覽前 48 張）' : ''}` : '';
        }
        const sheetFields = () => {
          if (!opts.sheet) { sheetBox.replaceChildren(h('div.hstack', null, h('span.grow', null, '這是 Sprite Sheet（一張圖裡有很多格）'), h('button.btn.s', { on: { click: () => { const sw = src.frames[0].canvas.width, shh = src.frames[0].canvas.height, cols = Math.max(1, Math.round(sw / Math.min(sw, shh))); opts.sheet = { cols, rows: Math.max(1, Math.round(shh / (sw / cols))), margin: 0, spacing: 0, order: 'row', skipEmpty: true }; opts.as = 'anim'; sheetFields(); preview(); } } }, '切割'))); return; }
          const n = (label, k, min, max) => h('label.hstack', { style: { flex: 1, minWidth: '120px' } }, h('span.muted', { style: { fontSize: 'var(--fs-s)' } }, label), h('div.field', { style: { height: '40px', flex: 1 } }, h('input', { type: 'number', min, max, value: opts.sheet[k] || '', placeholder: '自動', on: { change: (e) => { opts.sheet[k] = e.target.value ? +e.target.value : undefined; preview(); } } })));
          sheetBox.replaceChildren(h('div.hstack', null, h('b.grow', null, 'Sprite Sheet 切割'), h('button.btn.s.ghost', { on: { click: () => { opts.sheet = null; sheetFields(); preview(); } } }, '取消切割')),
            h('div.hstack', { style: { flexWrap: 'wrap', marginTop: '8px' } }, n('欄', 'cols', 1, 64), n('列', 'rows', 1, 64), n('格寬', 'cellW', 2, 4096), n('格高', 'cellH', 2, 4096), n('邊界', 'margin', 0, 256), n('間距', 'spacing', 0, 256)),
            h('div.hstack', { style: { marginTop: '8px' } }, h('span.grow', null, '排列'), seg([['row', '先橫後直'], ['col', '先直後橫']], opts.sheet.order, (v) => { opts.sheet.order = v; preview(); })),
            h('div.hstack', { style: { marginTop: '8px' } }, h('span.grow', null, '略過空白格'), toggle(opts.sheet.skipEmpty, (v) => { opts.sheet.skipEmpty = v; preview(); })));
        };
        const opt = (label, k) => h('div.hstack', { style: { marginTop: '6px' } }, h('span.grow', null, label), toggle(opts[k], (v) => { opts[k] = v; preview(); }));
        b.append(info, grid,
          src.frames.length > 1 ? h('div.hstack', { style: { marginTop: '8px' } }, h('span.grow.muted', { style: { fontSize: 'var(--fs-s)' } }, '已依檔名自然排序（1, 2, 10）'), h('button.btn.s', { on: { click: () => { order.reverse(); preview(); } } }, '反轉順序')) : null,
          src.frames.length === 1 ? sheetBox : null,
          h('div.card', { style: { marginTop: '10px' } }, opt('去除背景（以角落顏色為準）', 'keyOut'), opt('裁掉透明留白', 'trim'), opt('左右鏡像', 'flip'),
            h('div.hstack', { style: { marginTop: '6px' } }, h('span.grow', null, '旋轉'), seg([['0', '0°'], ['1', '90°'], ['2', '180°'], ['3', '270°']], '0', (v) => { opts.rotate = +v; preview(); })),
            h('div', { style: { marginTop: '6px' } }, OC.UI.slider({ zh: '縮放' }, 1, (v) => { opts.scale = v; }, { min: 0.1, max: 2, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` }))),
          h('div.section-title', null, '匯入成'),
          seg([['assets', '個別素材'], ['anim', '動畫影格'], ['part', '角色部件']], opts.as, (v) => { opts.as = v; }),
          h('div', { style: { marginTop: '8px' } }, OC.UI.slider({ zh: '播放速度（作為動畫時）' }, opts.fps, (v) => { opts.fps = v; }, { min: 1, max: 30, step: 1, fmt: (v) => `${v} fps` })),
          h('button.btn.primary.block', { style: { marginTop: '14px' }, on: { click: async (e) => {
            if (!current.length) { toast('沒有可匯入的影格', 'info'); return; }
            e.currentTarget.disabled = true; e.currentTarget.textContent = '匯入中…';
            try { result = await commit(current, opts, o, frames()); api.close(); } catch (err) { toast(err.message, 'info'); e.currentTarget.disabled = false; e.currentTarget.textContent = '匯入'; }
          } } }, icon('check', 's'), '匯入'));
        sheetFields(); preview();
        b.querySelectorAll('input[type=range]')[0].addEventListener('change', preview);
      }, { onClose: () => resolve(result) });
    });
  }
  /** place frames on a fixed canvas (studio frame size), bottom-centre, shrink if larger */
  function fitTo(canvases, w, hh) { return canvases.map((c) => { if (c.width === w && c.height === hh) return c; const s = Math.min(1, w / c.width, hh / c.height), k = OC.makeCanvas(w, hh), x = k.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, Math.round((w - c.width * s) / 2), Math.round(hh - c.height * s), c.width * s, c.height * s); return k; }); }
  async function commit(canvases, opts, o, rawFrames) {
    const name = (o.name || '匯入').slice(0, 16);
    let result;
    if (o.returnFrames) {
      const cs = o.fitTo ? fitTo(canvases, o.fitTo[0], o.fitTo[1]) : canvases, ids = [];
      for (let i = 0; i < cs.length; i++) ids.push((await A().put(cs[i], { kind: 'frame', name: `${name} ${i + 1}`, owner: o.owner || null })).id);
      const delays = opts.sheet ? cs.map(() => null) : rawFrames.map((f) => (f.delay && f.delay !== 100 ? f.delay : null));
      result = { frames: ids, delays, w: cs[0].width, h: cs[0].height, fps: opts.fps };
      S().imports.unshift({ at: Date.now(), kind: 'frames', name, n: ids.length, ok: true }); St.touch(); o.onDone && o.onDone(result); return result;
    }
    if (opts.as === 'anim') {
      const delays = opts.sheet ? null : rawFrames.map((f) => f.delay);
      result = await makeAnim(canvases, { name, owner: o.owner, action: o.action || 'idle', dir: o.dir || 'any', fps: opts.fps, delays: delays && rawFrames.length > 1 && rawFrames.some((f) => f.delay && f.delay !== 100) ? delays : null });
      toast(`建立了動作（${canvases.length} 格）`, 'film');
    } else {
      const ids = []; for (const c of canvases) ids.push(await A().put(c, { kind: opts.as === 'part' ? 'part' : 'import', name, owner: o.owner || null }));
      result = { assets: ids }; toast(`匯入 ${ids.length} 張素材`, 'image');
    }
    S().imports.unshift({ at: Date.now(), kind: opts.as, name, n: canvases.length, ok: true }); S().imports = S().imports.slice(0, 30); St.touch();
    o.onDone && o.onDone(result);
    return result;
  }

  // ---------------- packs ----------------
  function packDialog(pack) {
    return new Promise((resolve) => {
      const m = pack.manifest; let done = null;
      sheet('匯入素材包', (b, api) => {
        b.append(h('div.card', null, h('div', null, `類型：${{ character: '單一角色', characters: '角色群組', animation: '動畫', backup: '完整備份' }[m.kind] || m.kind}`), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, `建立於 ${String(m.created).slice(0, 10)}・來源 ${m.app}`),
          h('div', { style: { marginTop: '8px' } }, `角色 ${m.chars.length}・動作 ${m.animations.length}・圖片 ${m.assets.length}`),
          m.chars.length ? h('div.hstack', { style: { flexWrap: 'wrap', marginTop: '8px' } }, ...m.chars.map((c) => h('span.tag.accent', null, c.profile.name || '無名'))) : null),
          pack.problems.length ? h('div.card', { style: { marginTop: '8px', color: 'var(--danger)' } }, h('b', null, `發現 ${pack.problems.length} 個問題`), h('div', { style: { fontSize: 'var(--fs-s)' } }, pack.problems.slice(0, 5).join('、'))) : h('div.lock-note', { style: { marginTop: '8px' } }, icon('check', 's'), '檢查通過：所有圖片與相依資料完整'));
        const conflicts = m.chars.filter((c) => OC.Chars.get(c.id));
        let mode = 'new';
        b.append(h('div.section-title', null, '匯入方式'), seg([['new', '另存新角色'], ['merge', '合併（略過已有）'], ['replace', '取代同一個']], mode, (v) => { mode = v; }),
          h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '6px' } }, conflicts.length ? `有 ${conflicts.length} 個角色和你現有的是同一個（${conflicts.map((c) => c.profile.name).join('、')}）。「另存新角色」不會覆蓋任何資料。` : '「另存新角色」永遠不會覆蓋現有資料。'),
          h('button.btn.primary.block', { style: { marginTop: '14px' }, disabled: pack.problems.length > 0, on: { click: async (e) => {
            if (mode === 'replace' && conflicts.length && !(await confirm('取代角色', `會用素材包內容覆蓋 ${conflicts.map((c) => c.profile.name).join('、')}，確定嗎？`, '取代', true))) return;
            e.currentTarget.disabled = true; const btn = e.currentTarget;
            try { done = await OC.IO.applyPack(pack, mode, (i, n) => (btn.textContent = `匯入中 ${i}/${n}`)); toast(`匯入完成：角色 ${done.chars.length}・動作 ${done.anims}・圖片 ${done.assets}`, 'check'); api.close(); }
            catch (err) { toast('匯入失敗：' + err.message, 'info'); btn.disabled = false; btn.textContent = '匯入'; }
          } } }, icon('download', 's'), '匯入'));
      }, { onClose: () => resolve(done) });
    });
  }
  async function importPackFile() { const files = await chooseFiles({ multiple: false, accept: '.ocpack,.zip,application/zip' }); if (!files.length) return null; if ((await OC.IO.sniff(await files[0].slice(0, 64).arrayBuffer())) !== 'application/zip') { toast(`「${files[0].name}」不是 OC Shimeji 角色包（.ocpack）`, 'info'); return null; } try { const pack = await OC.IO.readPack(await files[0].arrayBuffer()); return packDialog(pack); } catch (e) { toast(e.message, 'info'); return null; } }

  // ---------------- picker ----------------
  function pick(o = {}) {
    return new Promise((resolve) => {
      let chosen = null, filter = o.owner ? 'mine' : 'all';
      sheet(o.title || '選擇素材', (b, api) => {
        const grid = h('div.grid.c4', { style: { marginTop: '10px' } });
        const render = () => {
          const items = A().list((m) => (!o.kinds || o.kinds.includes(m.kind)) && (filter === 'all' || (filter === 'mine' ? m.owners.includes(o.owner) : !m.owners.length)));
          grid.replaceChildren(...(items.length ? items.slice(0, 200).map((m) => { const im = h('img', { alt: m.name, style: { width: '100%', aspectRatio: '1', objectFit: 'contain', borderRadius: '10px', background: 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/14px 14px' } }); A().thumbURL(m.id).then((u) => (im.src = u)); return h('button', { 'aria-label': m.name || '素材', on: { click: () => { chosen = m; api.close(); } } }, im, h('div.faint', { style: { fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, m.name || KIND_ZH[m.kind] || '')); }) : [h('div.empty', { style: { gridColumn: '1/-1' } }, '還沒有素材')]));
        };
        b.append(o.owner ? seg([['mine', '這個角色'], ['shared', '共用'], ['all', '全部']], filter, (v) => { filter = v; render(); }) : null, grid,
          h('div.hstack', { style: { marginTop: '12px' } }, h('button.btn.block', { on: { click: async () => { const r = await importDialog({ purpose: 'part', owner: o.owner || null }); if (r && r.assets) render(); } } }, icon('upload', 's'), '匯入圖片'), h('button.btn.block', { on: { click: () => { api.close(); OC.Paint.open({ purpose: 'part', owner: o.owner, onSaved: (m) => resolve(m) }); } } }, icon('brush', 's'), '畫一個')));
        render();
      }, { onClose: () => resolve(chosen) });
    });
  }

  // ---------------- references / integrity ----------------
  function usedBy(id) {
    const out = [];
    for (const c of OC.Chars.all()) if ((c.parts || []).some((p) => p.assetId === id || p.closedId === id)) out.push(`角色「${c.profile.name}」的部件`);
    for (const d of OC.Anim.list()) if (OC.Anim.assetsOf(d).includes(id)) out.push(`動作「${d.name}」`);
    return out;
  }
  function missingRefs() {
    const refs = [];
    for (const c of OC.Chars.all()) for (const p of c.parts || []) if (!A().has(p.assetId)) refs.push({ where: `角色「${c.profile.name}」部件`, fix: () => { c.parts = c.parts.filter((q) => q !== p); OC.Chars.save(c); } });
    for (const d of OC.Anim.list()) { const miss = OC.Anim.assetsOf(d).filter((id) => !A().has(id)); if (miss.length) refs.push({ where: `動作「${d.name}」${miss.length} 格`, fix: () => { d.layers.forEach((l) => { l.cells = l.cells.map((x) => (x && !A().has(x) ? null : x)); }); OC.Anim.save(d); } }); }
    return refs;
  }

  // ---------------- 素材庫 page ----------------
  OC.Pages.define('library', '素材庫', {
    sub: true,
    build(p, el) {
      p.filter = 'all'; p.q = '';
      p.stats = h('div.muted', { style: { fontSize: 'var(--fs-s)' } });
      p.tabs = seg([['all', '全部'], ['part', '部件'], ['frame', '影格'], ['drawing', '繪圖'], ['import', '匯入']], 'all', (v) => { p.filter = v; p.refresh(p); });
      const q = h('input', { placeholder: '搜尋名稱', 'aria-label': '搜尋', on: { input: (e) => { p.q = e.target.value.trim(); p.refresh(p); } } });
      p.grid = h('div.grid.c3', { style: { marginTop: '10px' } }); p.warn = h('div');
      el.append(p.stats, p.warn, h('div.hstack', { style: { margin: '10px 0' } }, h('button.btn.primary.block', { on: { click: async () => { await importDialog({ purpose: 'assets' }); p.refresh(p); } } }, icon('upload', 's'), '匯入圖片'), h('button.btn.block', { on: { click: () => OC.Paint.open({ purpose: 'drawing', onSaved: () => p.refresh(p) }) } }, icon('brush', 's'), '新繪圖')),
        h('div.field', { style: { height: '44px', marginBottom: '8px' } }, q), p.tabs, p.grid);
    },
    refresh(p) {
      const u = A().usage(); p.stats.textContent = `共 ${u.n} 個素材・${(u.bytes / 1048576).toFixed(1)} MB（存於本機 IndexedDB）`;
      const miss = missingRefs();
      p.warn.replaceChildren(miss.length ? h('div.card', { style: { marginTop: '8px' } }, h('div.hstack', null, icon('info', 's'), h('b.grow', null, `${miss.length} 處引用的素材遺失`), h('button.btn.s', { on: { click: () => { miss.forEach((m) => m.fix()); toast('已清除遺失的引用', 'check'); p.refresh(p); } } }, '清除引用')), h('div.faint', { style: { fontSize: 'var(--fs-xs)' } }, miss.slice(0, 4).map((m) => m.where).join('、'))) : '');
      const items = A().list((m) => (p.filter === 'all' || m.kind === p.filter) && (!p.q || (m.name || '').includes(p.q)));
      p.grid.replaceChildren(...(items.length ? items.slice(0, 300).map((m) => { const im = h('img', { alt: m.name, style: { width: '100%', aspectRatio: '1', objectFit: 'contain', borderRadius: '12px', background: 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/14px 14px' } }); A().thumbURL(m.id).then((x) => (im.src = x)); return h('button', { style: { textAlign: 'left' }, on: { click: () => assetSheet(m, () => p.refresh(p)) } }, im, h('div', { style: { fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, m.name || '未命名'), h('div.faint', { style: { fontSize: '10px' } }, `${KIND_ZH[m.kind] || m.kind}・${m.w}×${m.h}`)); }) : [h('div.empty', { style: { gridColumn: '1/-1' } }, '沒有素材')]));
    },
  });
  function assetSheet(m, after) {
    sheet(m.name || '素材', (b, api) => {
      const im = h('img', { style: { maxWidth: '100%', maxHeight: '240px', display: 'block', margin: '0 auto', background: 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/14px 14px', borderRadius: '12px' } }); A().blob(m.id).then((bl) => (im.src = URL.createObjectURL(bl)));
      const nm = h('input', { value: m.name || '', maxLength: 24, on: { change: async (e) => { await A().update(m.id, { name: e.target.value.trim() }); after(); } } });
      const owners = m.owners.map((id) => (OC.Chars.get(id) || {}).profile).filter(Boolean).map((p) => p.name);
      const uses = usedBy(m.id);
      b.append(im, h('div.field', { style: { marginTop: '10px' } }, nm), h('div.muted', { style: { fontSize: 'var(--fs-s)', margin: '8px 0' } }, `${KIND_ZH[m.kind] || m.kind}・${m.w}×${m.h}px・${(m.size / 1024).toFixed(0)} KB・${owners.length ? '專屬：' + owners.join('、') : '共用素材'}`),
        h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, uses.length ? `使用於：${uses.slice(0, 4).join('、')}${uses.length > 4 ? '…' : ''}` : '目前沒有被使用'),
        h('div.list', { style: { marginTop: '10px' } },
          OC.UI.row('brush', '在繪畫工坊編輯', '裁切、旋轉、翻轉、修改', null, () => { api.close(); OC.Paint.open({ assetId: m.id, onSaved: after }); }),
          OC.UI.row('refresh', '用新檔案取代', '所有使用到的地方會一起更新', null, async () => { const f = await chooseFiles({ multiple: false }); if (!f.length) return; try { const d = await OC.IO.decodeFile(f[0]); await A().replace(m.id, d.frames[0].canvas); OC.Anim.clearCache(); OC.Store.emit('animations'); toast('已取代', 'check'); api.close(); after(); } catch (e) { toast(e.message, 'info'); } }),
          OC.UI.row('copy', '複製一份', null, null, async () => { await A().duplicate(m.id); toast('已複製', 'copy'); api.close(); after(); }),
          OC.UI.row('layers', m.owners.length ? '改為共用素材' : '設為目前角色專屬', null, null, async () => { await A().update(m.id, { owners: m.owners.length ? [] : [OC.Chars.active().id] }); api.close(); after(); }),
          OC.UI.row('download', '匯出 PNG', null, null, async () => { await OC.IO.deliver(await A().blob(m.id), `${(m.name || m.id).replace(/[\\/:*?"<>|]/g, '_')}.png`); }),
          OC.UI.row('trash', '刪除', uses.length ? '⚠ 仍在使用中' : null, null, async () => { if (!(await confirm('刪除素材', uses.length ? `這張圖仍被 ${uses.length} 處使用，刪除後那些地方會變成空白。確定嗎？` : '確定要刪除嗎？', '刪除', true))) return; await A().remove(m.id); api.close(); after(); })));
    });
  }

  OC.Library = { chooseFiles, framesFromFiles, process, makeAnim, spriteCharFromFiles, importDialog, packDialog, importPackFile, pick, usedBy, missingRefs, assetSheet, hasOpaqueCorners };
})();
