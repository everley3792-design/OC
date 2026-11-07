/* OC Shimeji — 繪畫工坊 (paint workshop). Full-screen, minimal chrome:
 *   one finger / stylus draws (pressure aware); two fingers pan + pinch-zoom + rotate the VIEW
 *   tools: brush, eraser, fill, eyedropper, rectangle select (move / copy / delete / flip), move layer
 *   layers: add, duplicate, delete, merge down, reorder, visibility, opacity, rename
 *   undo / redo (60 steps), autosave to IndexedDB every few seconds (crash recovery)
 *   output: save as asset → character part / animation frame / library drawing, or replace an asset
 */
(function () {
  'use strict';
  const { h, icon, toast, seg, toggle, haptic, confirm, sheet } = OC.UI;
  const DRAFT = 'paint:last';

  async function open(o = {}) {
    // recover a crashed / unsaved drawing first
    if (!o.noRecover) { const d = await OC.Assets.draftGet(DRAFT).catch(() => null); if (d && d.layers && d.layers.length && Date.now() - d.at < 7 * 864e5 && !o.assetId && !o.canvas) { if (await confirm('恢復未完成的繪圖？', `上次在 ${new Date(d.at).toLocaleString('zh-TW')} 有一張還沒儲存的作品。`, '恢復')) return openDoc(await fromDraft(d), Object.assign({}, d.opts || {}, o)); await OC.Assets.draftDel(DRAFT); } }
    if (o.assetId) { const img = await OC.Assets.image(o.assetId); return openDoc(newDoc(img.width, img.height, img), o); }
    if (o.canvas) return openDoc(newDoc(o.canvas.width, o.canvas.height, o.canvas), o);
    if (o.w && o.h) return openDoc(newDoc(o.w, o.h), o);
    const size = await chooseSize(); if (!size) return null;
    return openDoc(newDoc(size[0], size[1]), o);
  }
  function chooseSize() {
    return new Promise((res) => { let v = null; sheet('新畫布', (b, api) => {
      const opt = (w, hh, label) => h('button.tile', { style: { aspectRatio: 'auto', minHeight: '58px' }, on: { click: () => { v = [w, hh]; api.close(); } } }, h('b', null, label), `${w}×${hh}`);
      const wi = h('input', { type: 'number', min: 16, max: 1024, value: 512 }), hi = h('input', { type: 'number', min: 16, max: 1024, value: 512 });
      b.append(h('div.grid.c2', null, opt(256, 256, '小'), opt(512, 512, '標準'), opt(1024, 1024, '大'), opt(512, 768, '直式')), h('div.section-title', null, '自訂尺寸'), h('div.hstack', null, h('div.field', { style: { flex: 1 } }, wi), '×', h('div.field', { style: { flex: 1 } }, hi), h('button.btn.s', { on: { click: () => { v = [Math.max(16, Math.min(1024, +wi.value || 512)), Math.max(16, Math.min(1024, +hi.value || 512))]; api.close(); } } }, '建立')), h('p.faint', { style: { fontSize: 'var(--fs-xs)' } }, '背景是透明的。最大 1024 px（手機記憶體考量）。'));
    }, { onClose: () => res(v) }); });
  }
  function layer(w, hh, name, src) { const c = OC.makeCanvas(w, hh); if (src) c.getContext('2d').drawImage(src, 0, 0, w, hh); return { id: 'l' + Math.random().toString(36).slice(2, 8), name, canvas: c, visible: true, opacity: 1 }; }
  function newDoc(w, hh, src) { return { w, h: hh, layers: [layer(w, hh, '圖層 1', src)], active: 0 }; }
  async function fromDraft(d) { const doc = { w: d.w, h: d.h, layers: [], active: d.active || 0 }; for (const l of d.layers) { const img = await OC.Assets.decodeBlob(l.blob); const L = layer(d.w, d.h, l.name, img); L.visible = l.visible; L.opacity = l.opacity; doc.layers.push(L); } return doc; }

  function openDoc(doc, o) {
    return new Promise((resolve) => {
      const app = document.getElementById('app');
      const root = h('div.paint', { role: 'dialog', 'aria-label': '繪畫工坊' });
      const view = h('canvas.paint-view'), vctx = view.getContext('2d');
      const st = { tool: 'brush', color: o.color || '#3B2B25', size: 8, alpha: 1, smooth: 0.35, zoom: 1, rot: 0, px: 0, py: 0, sel: null, floating: null, dirty: false, saved: false };
      const undo = [], redo = [];
      // ---------- chrome ----------
      const title = h('b', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, o.title || '繪畫工坊');
      const top = h('div.paint-top', null,
        h('button.icon-btn', { 'aria-label': '關閉', on: { click: () => tryClose() } }, icon('close')), title,
        h('button.icon-btn', { 'aria-label': '復原', on: { click: () => doUndo() } }, icon('undo')),
        h('button.icon-btn', { 'aria-label': '重做', on: { click: () => doRedo() } }, icon('redo')),
        h('button.icon-btn', { 'aria-label': '圖層', on: { click: () => togglePanel('layers') } }, icon('layers')),
        h('button.btn.s.primary', { on: { click: () => saveDialog() } }, icon('check', 's'), '完成'));
      const swatch = h('button.paint-swatch', { 'aria-label': '顏色', on: { click: async () => { const v = await OC.UI.pickColor('畫筆顏色', st.color); if (v) { st.color = v; sync(); } } } });
      const toolBtn = (id, ic, label) => h('button.icon-btn', { 'data-tool': id, 'aria-label': label, title: label, on: { click: () => { commitFloating(); st.tool = id; if (id !== 'select') st.sel = null; sync(); haptic(); } } }, icon(ic));
      const sizeIn = h('input', { type: 'range', min: 1, max: 80, value: st.size, 'aria-label': '筆刷大小', on: { input: (e) => { st.size = +e.target.value; sync(); } } });
      const tools = h('div.paint-tools', null, toolBtn('brush', 'brush', '畫筆'), toolBtn('eraser', 'eraser', '橡皮擦'), toolBtn('fill', 'target', '填色'), toolBtn('picker', 'eye', '吸管'), toolBtn('select', 'move', '選取'), toolBtn('move', 'hand', '移動圖層'), swatch);
      const sizeRow = h('div.paint-size', null, h('span.num', { 'data-size': '' }), sizeIn, h('button.icon-btn', { 'aria-label': '筆刷設定', on: { click: () => togglePanel('brush') } }, icon('gear', 's')));
      const selBar = h('div.paint-selbar', null,
        h('button.btn.s', { on: { click: () => selAction('copy') } }, icon('copy', 's'), '複製'), h('button.btn.s', { on: { click: () => selAction('flip') } }, '翻轉'),
        h('button.btn.s', { on: { click: () => selAction('delete') } }, icon('trash', 's'), '刪除'), h('button.btn.s', { on: { click: () => { commitFloating(); st.sel = null; sync(); } } }, '完成'));
      const panel = h('div.paint-panel'); let panelKind = null;
      const bottom = h('div.paint-bottom', null, selBar, sizeRow, tools);
      root.append(top, h('div.paint-stage', null, view), panel, bottom); app.append(root);
      const layerUI = { scrim: false, close: () => tryClose() }; OC.UI.pushLayer(layerUI);

      // ---------- view ----------
      let VW = 0, VH = 0; const dpr = Math.min(2, window.devicePixelRatio || 1);
      function fitView() { const r = view.getBoundingClientRect(); VW = r.width; VH = r.height; view.width = Math.round(VW * dpr); view.height = Math.round(VH * dpr); if (!st.fitted) { st.zoom = Math.min((VW - 24) / doc.w, (VH - 24) / doc.h); st.px = VW / 2; st.py = VH / 2; st.fitted = true; } draw(); }
      const toDoc = (cx, cy) => { const r = view.getBoundingClientRect(); let x = cx - r.left - st.px, y = cy - r.top - st.py; const c = Math.cos(-st.rot), s = Math.sin(-st.rot); [x, y] = [x * c - y * s, x * s + y * c]; return [x / st.zoom + doc.w / 2, y / st.zoom + doc.h / 2]; };
      const stroke = OC.makeCanvas(doc.w, doc.h), sctx = stroke.getContext('2d');
      let raf = 0; const draw = () => { if (!raf) raf = requestAnimationFrame(render); };
      const checker = (() => { const c = OC.makeCanvas(16, 16), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#e9e4da'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); return c; })();
      function render() {
        raf = 0; const x = vctx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, view.width, view.height);
        x.setTransform(dpr, 0, 0, dpr, 0, 0); x.translate(st.px, st.py); x.rotate(st.rot); x.scale(st.zoom, st.zoom); x.translate(-doc.w / 2, -doc.h / 2);
        x.save(); x.fillStyle = x.createPattern(checker, 'repeat'); x.fillRect(0, 0, doc.w, doc.h); x.restore();
        x.imageSmoothingEnabled = st.zoom < 2;
        if (o.underlay) for (const u of o.underlay) { x.save(); x.globalAlpha = u.alpha || 0.25; x.drawImage(u.canvas, 0, 0, doc.w, doc.h); x.restore(); }
        doc.layers.forEach((L, i) => {
          if (!L.visible) return; x.save(); x.globalAlpha = L.opacity; x.drawImage(L.canvas, L.dx || 0, L.dy || 0);
          if (i === doc.active && st.drawing && st.tool === 'brush') { x.globalAlpha = L.opacity * st.alpha; x.drawImage(stroke, 0, 0); }
          if (i === doc.active && st.floating) x.drawImage(st.floating.canvas, st.floating.x, st.floating.y);
          x.restore();
        });
        x.strokeStyle = 'rgba(90,60,30,.35)'; x.lineWidth = 1 / st.zoom; x.strokeRect(0, 0, doc.w, doc.h);
        const sel = st.floating ? { x: st.floating.x, y: st.floating.y, w: st.floating.canvas.width, h: st.floating.canvas.height } : st.sel;
        if (sel) { x.setLineDash([6 / st.zoom, 4 / st.zoom]); x.strokeStyle = '#F26B5B'; x.lineWidth = 2 / st.zoom; x.strokeRect(sel.x, sel.y, sel.w, sel.h); x.setLineDash([]); }
      }
      // ---------- history ----------
      function snapshot(kind = 'pixels') { const L = doc.layers[doc.active]; return kind === 'pixels' ? { kind, i: doc.active, data: L.canvas.getContext('2d').getImageData(0, 0, doc.w, doc.h) } : { kind: 'doc', layers: doc.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, data: l.canvas.getContext('2d').getImageData(0, 0, doc.w, doc.h) })), active: doc.active }; }
      function push(kind) { undo.push(snapshot(kind)); if (undo.length > 60) undo.shift(); redo.length = 0; st.dirty = true; scheduleDraft(); }
      function restore(sn) {
        if (sn.kind === 'pixels') { const L = doc.layers[sn.i]; if (L) L.canvas.getContext('2d').putImageData(sn.data, 0, 0); }
        else { doc.layers = sn.layers.map((l) => { const L = layer(doc.w, doc.h, l.name); L.id = l.id; L.visible = l.visible; L.opacity = l.opacity; L.canvas.getContext('2d').putImageData(l.data, 0, 0); return L; }); doc.active = Math.min(sn.active, doc.layers.length - 1); }
      }
      function doUndo() { commitFloating(); const sn = undo.pop(); if (!sn) { toast('沒有可以復原的步驟', 'info'); return; } redo.push(sn.kind === 'pixels' ? snapshotAt(sn.i) : snapshot('doc')); restore(sn); sync(); draw(); scheduleDraft(); }
      function doRedo() { const sn = redo.pop(); if (!sn) { toast('沒有可以重做的步驟', 'info'); return; } undo.push(sn.kind === 'pixels' ? snapshotAt(sn.i) : snapshot('doc')); restore(sn); sync(); draw(); scheduleDraft(); }
      function snapshotAt(i) { const L = doc.layers[i]; return { kind: 'pixels', i, data: L.canvas.getContext('2d').getImageData(0, 0, doc.w, doc.h) }; }
      // ---------- autosave (crash recovery) ----------
      let draftT = 0;
      function scheduleDraft() { clearTimeout(draftT); draftT = setTimeout(saveDraft, 3000); }
      async function saveDraft() { try { const layers = []; for (const L of doc.layers) layers.push({ name: L.name, visible: L.visible, opacity: L.opacity, blob: await OC.Assets.canvasToBlob(L.canvas) }); await OC.Assets.draftPut(DRAFT, { at: Date.now(), w: doc.w, h: doc.h, active: doc.active, layers, opts: { purpose: o.purpose, owner: o.owner, title: o.title } }); } catch (e) { console.warn('[paint] draft', e); } }
      // ---------- input ----------
      const ptrs = new Map(); let g = null, last = null;
      view.addEventListener('pointerdown', (e) => {
        view.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
        if (ptrs.size === 2) { // second finger → cancel the stroke, start view gesture
          if (st.drawing) { st.drawing = false; sctx.clearRect(0, 0, doc.w, doc.h); const sn = undo.pop(); if (sn) restore(sn); }
          const [a, b] = [...ptrs.values()]; g = { kind: 'view', d0: Math.hypot(a.x - b.x, a.y - b.y), a0: Math.atan2(b.y - a.y, b.x - a.x), z0: st.zoom, r0: st.rot, m0: [(a.x + b.x) / 2, (a.y + b.y) / 2], p0: [st.px, st.py] }; draw(); return;
        }
        if (ptrs.size > 2) return;
        const [x, y] = toDoc(e.clientX, e.clientY);
        if (st.tool === 'picker') { pick(x, y); return; }
        if (st.tool === 'fill') { push(); flood(Math.floor(x), Math.floor(y)); draw(); return; }
        if (st.tool === 'select') {
          const f = st.floating, s = st.sel;
          if (f && x >= f.x && y >= f.y && x <= f.x + f.canvas.width && y <= f.y + f.canvas.height) { g = { kind: 'float', x0: x, y0: y, fx: f.x, fy: f.y }; return; }
          if (s && !f && x >= s.x && y >= s.y && x <= s.x + s.w && y <= s.y + s.h) { lift(); g = { kind: 'float', x0: x, y0: y, fx: st.floating.x, fy: st.floating.y }; return; }
          commitFloating(); g = { kind: 'select', x0: x, y0: y }; st.sel = { x, y, w: 0, h: 0 }; return;
        }
        if (st.tool === 'move') { push(); const L = doc.layers[doc.active]; g = { kind: 'move', x0: x, y0: y }; L.dx = 0; L.dy = 0; return; }
        push(); st.drawing = true; sctx.clearRect(0, 0, doc.w, doc.h); last = { x, y, p: pressure(e) }; dab(last, last); draw();
      });
      view.addEventListener('pointermove', (e) => {
        const pt = ptrs.get(e.pointerId); if (!pt) return; pt.x = e.clientX; pt.y = e.clientY;
        if (g && g.kind === 'view' && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x); st.zoom = Math.max(0.1, Math.min(24, g.z0 * d / g.d0)); st.rot = g.r0 + (ang - g.a0); const m = [(a.x + b.x) / 2, (a.y + b.y) / 2]; st.px = g.p0[0] + m[0] - g.m0[0]; st.py = g.p0[1] + m[1] - g.m0[1]; draw(); return; }
        const [x, y] = toDoc(e.clientX, e.clientY);
        if (g && g.kind === 'select') { st.sel = { x: Math.min(g.x0, x), y: Math.min(g.y0, y), w: Math.abs(x - g.x0), h: Math.abs(y - g.y0) }; draw(); return; }
        if (g && g.kind === 'float') { st.floating.x = Math.round(g.fx + x - g.x0); st.floating.y = Math.round(g.fy + y - g.y0); draw(); return; }
        if (g && g.kind === 'move') { const L = doc.layers[doc.active]; L.dx = Math.round(x - g.x0); L.dy = Math.round(y - g.y0); draw(); return; }
        if (!st.drawing) return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of evs) { const [cx, cy] = toDoc(ev.clientX, ev.clientY); const k = st.smooth, nx = last.x + (cx - last.x) * (1 - k), ny = last.y + (cy - last.y) * (1 - k); const cur = { x: nx, y: ny, p: pressure(ev) }; dab(last, cur); last = cur; }
        draw();
      });
      const up = (e) => {
        ptrs.delete(e.pointerId);
        if (g && g.kind === 'view') { if (!ptrs.size) g = null; return; }
        if (g && g.kind === 'move') { const L = doc.layers[doc.active], c = OC.makeCanvas(doc.w, doc.h); c.getContext('2d').drawImage(L.canvas, L.dx || 0, L.dy || 0); const x = L.canvas.getContext('2d'); x.clearRect(0, 0, doc.w, doc.h); x.drawImage(c, 0, 0); L.dx = L.dy = 0; g = null; draw(); return; }
        if (g && g.kind === 'select') { if (st.sel && (st.sel.w < 2 || st.sel.h < 2)) st.sel = null; else if (st.sel) st.sel = { x: Math.round(st.sel.x), y: Math.round(st.sel.y), w: Math.round(st.sel.w), h: Math.round(st.sel.h) }; g = null; sync(); draw(); return; }
        if (g) { g = null; return; }
        if (st.drawing) { st.drawing = false; const L = doc.layers[doc.active], x = L.canvas.getContext('2d'); if (st.tool === 'brush') { x.save(); x.globalAlpha = st.alpha; x.drawImage(stroke, 0, 0); x.restore(); } sctx.clearRect(0, 0, doc.w, doc.h); draw(); }
      };
      view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
      view.addEventListener('wheel', (e) => { e.preventDefault(); const k = Math.exp(-e.deltaY * 0.0015); st.zoom = Math.max(0.1, Math.min(24, st.zoom * k)); draw(); }, { passive: false });
      const pressure = (e) => (e.pointerType === 'pen' && e.pressure > 0 ? 0.25 + e.pressure * 1.1 : 1);
      function dab(a, b) {
        const L = doc.layers[doc.active], x = st.tool === 'eraser' ? L.canvas.getContext('2d') : sctx;
        x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = st.size * ((a.p + b.p) / 2) * (st.tool === 'eraser' ? 1.6 : 1);
        if (st.tool === 'eraser') x.globalCompositeOperation = 'destination-out'; x.strokeStyle = st.color;
        x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x + 0.01, b.y); x.stroke(); x.restore();
      }
      function pick(x, y) { const c = flatten(), d = c.getContext('2d').getImageData(Math.max(0, Math.min(doc.w - 1, Math.floor(x))), Math.max(0, Math.min(doc.h - 1, Math.floor(y))), 1, 1).data; if (d[3] < 10) { toast('這裡是透明的', 'info'); return; } st.color = OC.UI.rgb2hex(d[0], d[1], d[2]); st.tool = 'brush'; sync(); haptic(); }
      function flood(sx, sy) {
        const L = doc.layers[doc.active], x = L.canvas.getContext('2d'), W = doc.w, H = doc.h; if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
        const img = x.getImageData(0, 0, W, H), d = img.data, i0 = (sy * W + sx) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]], [r, gg, b] = OC.UI.hex2rgb(st.color);
        if (t[0] === r && t[1] === gg && t[2] === b && t[3] === 255) return;
        const same = (i) => Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) + Math.abs(d[i + 3] - t[3]) * 2 < 90;
        const seen = new Uint8Array(W * H), stack = [sx + sy * W];
        while (stack.length) { const k = stack.pop(); if (seen[k]) continue; seen[k] = 1; const i = k * 4; if (!same(i)) continue; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; const px = k % W; if (px > 0) stack.push(k - 1); if (px < W - 1) stack.push(k + 1); if (k >= W) stack.push(k - W); if (k < W * (H - 1)) stack.push(k + W); }
        x.putImageData(img, 0, 0);
      }
      // ---------- selection ----------
      function lift() { push(); const s = st.sel, L = doc.layers[doc.active], c = OC.makeCanvas(Math.max(1, s.w), Math.max(1, s.h)); c.getContext('2d').drawImage(L.canvas, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h); L.canvas.getContext('2d').clearRect(s.x, s.y, s.w, s.h); st.floating = { canvas: c, x: s.x, y: s.y }; }
      function commitFloating() { const f = st.floating; if (!f) return; doc.layers[doc.active].canvas.getContext('2d').drawImage(f.canvas, f.x, f.y); st.sel = { x: f.x, y: f.y, w: f.canvas.width, h: f.canvas.height }; st.floating = null; draw(); }
      function selAction(k) {
        if (!st.sel && !st.floating) return;
        if (k === 'copy') { if (st.floating) { const f = st.floating, c = OC.makeCanvas(f.canvas.width, f.canvas.height); c.getContext('2d').drawImage(f.canvas, 0, 0); commitFloating(); st.floating = { canvas: c, x: f.x + 12, y: f.y + 12 }; } else { push(); const s = st.sel, c = OC.makeCanvas(s.w, s.h); c.getContext('2d').drawImage(doc.layers[doc.active].canvas, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h); st.floating = { canvas: c, x: s.x + 12, y: s.y + 12 }; } }
        if (k === 'flip') { if (!st.floating) lift(); const f = st.floating, c = OC.makeCanvas(f.canvas.width, f.canvas.height), x = c.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(f.canvas, 0, 0); f.canvas = c; }
        if (k === 'delete') { if (st.floating) st.floating = null; else { push(); const s = st.sel; doc.layers[doc.active].canvas.getContext('2d').clearRect(s.x, s.y, s.w, s.h); } st.sel = null; }
        sync(); draw();
      }
      // ---------- panels ----------
      function togglePanel(kind) { panelKind = panelKind === kind ? null : kind; renderPanel(); }
      function renderPanel() {
        panel.classList.toggle('open', !!panelKind); panel.replaceChildren(); if (!panelKind) return;
        if (panelKind === 'brush') panel.append(h('div.hstack', null, h('b.grow', null, '筆刷'), h('button.icon-btn', { on: { click: () => togglePanel(null) } }, icon('close', 's'))),
          OC.UI.slider({ zh: '不透明度' }, st.alpha, (v) => { st.alpha = v; }, { min: 0.05, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` }),
          OC.UI.slider({ zh: '平滑' }, st.smooth, (v) => { st.smooth = v; }, { min: 0, max: 0.8, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` }),
          h('div.hstack', { style: { flexWrap: 'wrap', marginTop: '8px' } },
            h('button.btn.s', { on: { click: () => { push('doc'); doc.layers.forEach((L) => flipCanvas(L.canvas)); draw(); } } }, '整張左右翻轉'),
            h('button.btn.s', { on: { click: () => { st.zoom = Math.min((VW - 24) / doc.w, (VH - 24) / doc.h); st.rot = 0; st.px = VW / 2; st.py = VH / 2; draw(); } } }, '重設檢視'),
            h('button.btn.s', { on: { click: () => { st.rot = 0; draw(); } } }, '轉正')));
        if (panelKind === 'layers') {
          panel.append(h('div.hstack', null, h('b.grow', null, `圖層（${doc.layers.length}）`), h('button.btn.s', { on: { click: () => { if (doc.layers.length >= 8) { toast('最多 8 個圖層', 'info'); return; } push('doc'); doc.layers.splice(doc.active + 1, 0, layer(doc.w, doc.h, `圖層 ${doc.layers.length + 1}`)); doc.active++; renderPanel(); draw(); } } }, icon('plus', 's'), '新增'), h('button.icon-btn', { on: { click: () => togglePanel(null) } }, icon('close', 's'))));
          [...doc.layers].reverse().forEach((L) => {
            const i = doc.layers.indexOf(L), th = OC.makeCanvas(44, 44), tx = th.getContext('2d'); tx.drawImage(L.canvas, 0, 0, 44, 44); th.style.cssText = 'width:44px;height:44px;border-radius:8px;background:#fff;flex:none';
            panel.append(h('div.row' + (i === doc.active ? '.on' : ''), { style: { marginTop: '6px', boxShadow: i === doc.active ? 'inset 0 0 0 2px var(--accent)' : null }, on: { click: (e) => { if (e.target.closest('button,input')) return; commitFloating(); doc.active = i; renderPanel(); sync(); } } },
              th, h('div.grow', null, h('input', { value: L.name, maxLength: 12, style: { border: 0, background: 'transparent', width: '100%', font: 'inherit', color: 'inherit' }, on: { change: (e) => (L.name = e.target.value) } }), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: L.opacity, 'aria-label': '圖層透明度', style: { height: '24px' }, on: { input: (e) => { L.opacity = +e.target.value; draw(); }, change: () => scheduleDraft() } })),
              h('button.icon-btn', { 'aria-label': L.visible ? '隱藏' : '顯示', style: { opacity: L.visible ? 1 : 0.4 }, on: { click: () => { L.visible = !L.visible; renderPanel(); draw(); } } }, icon('eye', 's'))));
          });
          const L = doc.layers[doc.active];
          panel.append(h('div.hstack', { style: { flexWrap: 'wrap', marginTop: '8px' } },
            h('button.btn.s', { on: { click: () => { if (doc.layers.length >= 8) return; push('doc'); const c = layer(doc.w, doc.h, L.name + ' 複本', L.canvas); doc.layers.splice(doc.active + 1, 0, c); doc.active++; renderPanel(); draw(); } } }, icon('copy', 's'), '複製'),
            h('button.btn.s', { on: { click: () => { if (doc.active === 0) { toast('最下面的圖層無法向下合併', 'info'); return; } push('doc'); const below = doc.layers[doc.active - 1], x = below.canvas.getContext('2d'); x.save(); x.globalAlpha = L.opacity; x.drawImage(L.canvas, 0, 0); x.restore(); doc.layers.splice(doc.active, 1); doc.active--; renderPanel(); draw(); } } }, '向下合併'),
            h('button.btn.s', { on: { click: () => { if (doc.active >= doc.layers.length - 1) return; push('doc'); [doc.layers[doc.active], doc.layers[doc.active + 1]] = [doc.layers[doc.active + 1], doc.layers[doc.active]]; doc.active++; renderPanel(); draw(); } } }, '上移'),
            h('button.btn.s', { on: { click: () => { if (doc.active <= 0) return; push('doc'); [doc.layers[doc.active], doc.layers[doc.active - 1]] = [doc.layers[doc.active - 1], doc.layers[doc.active]]; doc.active--; renderPanel(); draw(); } } }, '下移'),
            h('button.btn.s', { on: { click: () => { push(); flipCanvas(L.canvas); draw(); } } }, '翻轉此層'),
            h('button.btn.s', { style: { color: 'var(--danger)' }, on: { click: () => { if (doc.layers.length <= 1) { push(); L.canvas.getContext('2d').clearRect(0, 0, doc.w, doc.h); draw(); return; } push('doc'); doc.layers.splice(doc.active, 1); doc.active = Math.max(0, doc.active - 1); renderPanel(); draw(); } } }, icon('trash', 's'), '刪除')));
        }
      }
      function flipCanvas(c) { const k = OC.makeCanvas(c.width, c.height), x = k.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); const y = c.getContext('2d'); y.clearRect(0, 0, c.width, c.height); y.drawImage(k, 0, 0); }
      function flatten() { const c = OC.makeCanvas(doc.w, doc.h), x = c.getContext('2d'); doc.layers.forEach((L, i) => { if (!L.visible) return; x.globalAlpha = L.opacity; x.drawImage(L.canvas, 0, 0); if (i === doc.active && st.floating) x.drawImage(st.floating.canvas, st.floating.x, st.floating.y); }); return c; }
      function sync() {
        root.querySelectorAll('[data-tool]').forEach((b) => { const on = b.dataset.tool === st.tool; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
        swatch.style.background = st.color; root.querySelector('[data-size]').textContent = st.size; sizeIn.value = st.size;
        selBar.classList.toggle('open', st.tool === 'select' && !!(st.sel || st.floating)); draw();
      }
      // ---------- save ----------
      function saveDialog() {
        commitFloating();
        const c = flatten(); if (OC.Anim.contentBox(c).w >= doc.w && OC.Anim.contentBox(c).h >= doc.h && !hasPixels(c)) { toast('畫布是空的', 'info'); return; }
        if (o.onCanvas) { o.onCanvas(c); finish(c); return; }   // studio frame editing: hand the pixels back
        let name = o.name || '';
        sheet('儲存作品', (b, api) => {
          const nm = h('input', { value: name, maxLength: 20, placeholder: '作品名稱', on: { input: (e) => (name = e.target.value) } });
          const save = async (kind, then) => { try { const meta = o.assetId && kind === 'replace' ? await OC.Assets.replace(o.assetId, c) : await OC.Assets.put(c, { kind: kind === 'replace' ? 'drawing' : kind, name: name.trim() || '繪圖', owner: o.owner || null }); if (o.assetId && kind === 'replace') { OC.Anim.clearCache(); OC.Store.emit('animations'); } api.close(); finish(c, meta); then && then(meta); toast('已儲存', 'check'); } catch (e) { toast(e.message, 'info'); } };
          b.append(h('div.field', null, nm), h('div.list', { style: { marginTop: '12px' } },
            o.assetId ? OC.UI.row('refresh', '覆蓋原本的圖', '所有使用它的角色與動作都會更新', null, () => save('replace')) : null,
            OC.UI.row('person', '設為角色部件', `加到「${OC.Chars.name(OC.Chars.get(o.owner) || OC.Chars.active())}」身上`, null, () => save('part', (m) => addAsPart(m, o.owner))),
            OC.UI.row('film', '加入動畫影格', '新增一個動作或接在現有動作後面', null, () => save('frame', (m) => OC.Studio.addFrameAsset(m, o.owner))),
            OC.UI.row('image', '存到素材庫', null, null, () => save(o.purpose === 'part' ? 'part' : 'drawing'))));
        });
      }
      function hasPixels(c) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return true; return false; }
      async function tryClose() { if (st.dirty && !st.saved && !(await confirm('離開繪畫工坊', '作品還沒儲存，草稿會保留，下次可以恢復。', '先離開', false))) return; finish(null); }
      function finish(canvas, meta) {
        if (canvas) { st.saved = true; OC.Assets.draftDel(DRAFT).catch(() => 0); }
        clearTimeout(draftT); if (!canvas && st.dirty) saveDraft();
        OC.UI.popLayer(layerUI); window.removeEventListener('resize', fitView); root.remove();
        if (meta && o.onSaved) o.onSaved(meta, canvas); resolve(meta || canvas || null);
      }
      window.addEventListener('resize', fitView);
      requestAnimationFrame(() => { fitView(); sync(); });
    });
  }
  /** attach an asset to a character as an accessory part */
  function addAsPart(meta, ownerId) {
    const c = OC.Chars.get(ownerId) || OC.Chars.active(); if (!c) return;
    c.parts.push({ id: 'pt' + Date.now().toString(36), slot: 'accessory', assetId: meta.id, anchor: 'head', z: 'front', x: 0, y: -10, scale: 0.8, rot: 0, flip: false, mirror: true, visible: true });
    OC.Chars.save(c); toast(`已加到 ${OC.Chars.name(c)} 的頭上（可在「編輯角色 → 部件」調整位置）`, 'person');
  }
  OC.Paint = { open, addAsPart };
})();
