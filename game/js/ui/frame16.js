/* OC Shimeji — 16.3 picture characters: the framing table, the picture panel, background removal (OC.Frame16).
 *   table(getChar, o)  one big framing table instead of three small boxes and a wall of sliders: the picture stands on a foot line
 *                      next to a dashed outline of the standard height. One finger moves it, two fingers zoom, the handles on its
 *                      frame change width (right edge), height (top edge) or both (corner). 「裁切」 switches the handles to the
 *                      four crop edges. Everything writes c.appearance.frame only — applied at draw time, the file is never changed.
 *                      The mapping is the renderer's (render.js: foot anchor, refH, zoom·sx / zoom·sy, offsets in % of the standard height).
 *   panel(c, x, tb)    quick buttons (自動對齊、翻轉、裁切、重設), the two toggles, the background card, numbers folded away
 *   cutSheet(canvases) background removal with a live preview on a checkerboard: tolerance, the wand (tap what should go), undo
 *   applyCut / revertCut  every frame of every action of a character → new assets; the old ids are kept on the doc (doc.cut16)
 */
(function () {
  'use strict';
  const h = (...a) => OC.UI.h(...a), icon = (...a) => OC.UI.icon(...a), toast = (...a) => OC.UI.toast(...a), haptic = (k) => OC.UI.haptic && OC.UI.haptic(k || 'tick');
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const css = (k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const F = (c) => { const f = (c.appearance.frame = Object.assign({ flip: false, zoom: 1, sx: 1, sy: 1, dx: 0, dy: 0, faces: 'right' }, c.appearance.frame || {})); f.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, f.crop || {}); return f; };
  const base = (c) => { const r = OC.Anim.resolve(c, 'idle', 'front'); if (!r) return null; const img = OC.Anim.composite(r.doc, 0); return img ? { doc: r.doc, img } : { doc: r.doc, img: null }; };
  const anchorOf = (doc, f) => { const a0 = doc.anchor || { x: doc.w / 2, y: doc.h * 0.9 }; return { x: a0.x, y: Math.min(a0.y, doc.h * (1 - f.crop.b)) }; };

  /** fit the picture: its visible part as tall as the standard height, feet on the line, centred */
  function autoFit(c) {
    const b = base(c); if (!b || !b.img) return false; const f = F(c), doc = b.doc, rh = OC.CharRender.refH(c, doc), a = anchorOf(doc, f), bx = OC.Cutout.bounds(b.img);
    const sxi = doc.w / b.img.width, syi = doc.h / b.img.height;   /* composite is drawn at doc size */
    const y0 = Math.max(bx.y0 * syi, doc.h * f.crop.t), y1 = Math.min(bx.y1 * syi, doc.h * (1 - f.crop.b)), x0 = Math.max(bx.x0 * sxi, doc.w * f.crop.l), x1 = Math.min(bx.x1 * sxi, doc.w * (1 - f.crop.r));
    const hpx = Math.max(4, y1 - y0); f.zoom = cl(rh / (hpx * f.sy), 0.2, 4);
    f.dy = cl(-(y1 - a.y) * f.zoom * f.sy / rh * 100, -150, 150);
    f.dx = cl(-((x0 + x1) / 2 - a.x) * f.zoom * f.sx / rh * 100 * (f.flip ? -1 : 1), -150, 150);
    return true;
  }

  // ------------------------------------------------------------------ the framing table
  function table(getChar, o = {}) {
    const W0 = o.w || 340, H0 = o.h || 300;
    const cv = h('canvas.fr-cv'), wrap = h('div.fr-table', { 'aria-label': '取景台：單指移動、兩指縮放、拖曳把手改寬高' }, cv), lab = h('div.fr-lab');
    wrap.append(lab);
    let W = W0, H = H0, mode = 'move', U = 0, dragging = null, raf = 0, wantDraw = true;
    const pts = new Map();
    function size() { const r = wrap.getBoundingClientRect(); W = Math.max(200, Math.round(r.width || W0)); H = Math.max(180, Math.round(r.height || H0)); const dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; } cv.style.width = W + 'px'; cv.style.height = H + 'px'; return dpr; }
    const footY = () => H - 34, cx = () => W / 2;
    /** screen rect of the (cropped) picture */
    function geo(c, U_) {
      const b = base(c); if (!b) return null; const f = F(c), doc = b.doc, rh = OC.CharRender.refH(c, doc), a = anchorOf(doc, f), s = U_ / rh * f.zoom, kx = s * f.sx * (f.flip ? -1 : 1), ky = s * f.sy;
      const ox = cx() + f.dx / 100 * U_, oy = footY() + f.dy / 100 * U_;
      const X = (ix) => ox + (ix - a.x) * kx, Y = (iy) => oy + (iy - a.y) * ky;
      const xs = [X(doc.w * f.crop.l), X(doc.w * (1 - f.crop.r))], full = [X(0), X(doc.w)];
      return { b, f, doc, a, s, kx, ky, ox, oy, X, Y, rect: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Y(doc.h * f.crop.t), y1: Y(doc.h * (1 - f.crop.b)) }, full: { x0: Math.min(...full), x1: Math.max(...full), y0: Y(0), y1: Y(doc.h) } };
    }
    function fitU(c) { const f = F(c), b = base(c); if (!b) return (H - 80) * 0.7; const doc = b.doc, rh = OC.CharRender.refH(c, doc); const hU = Math.max(1, (doc.h / rh) * f.zoom * f.sy * 0.9), wU = (doc.w / rh) * f.zoom * f.sx; return Math.max(30, Math.min((H - 70) / hU, (W - 40) / Math.max(0.6, wU + Math.abs(f.dx) / 50))); }
    function draw() {
      raf = 0; if (!wantDraw) return; const c = getChar(); if (!c) return; const dpr = size(), g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      if (!dragging) U = fitU(c);
      /* checkerboard so see-through parts read as see-through */
      const c1 = css('--surface') || '#fff', c2 = css('--surface-2') || css('--bg') || '#eee'; g.fillStyle = c1; g.fillRect(0, 0, W, H); g.fillStyle = c2; for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? 12 : 0; x < W; x += 24) g.fillRect(x, y, 12, 12);
      /* the standard height (dashed) and the foot line */
      const ink = css('--ink-3') || '#999', acc = css('--accent') || '#5b9', sun = css('--sun') || '#fc4';
      g.setLineDash([6, 5]); g.strokeStyle = ink; g.lineWidth = 1.5; const sw = U * 0.5; g.strokeRect(cx() - sw / 2, footY() - U, sw, U); g.setLineDash([]);
      g.fillStyle = ink; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText('標準高度', cx() + sw / 2 + 4, footY() - U + 10);
      g.strokeStyle = acc; g.lineWidth = 2; g.beginPath(); g.moveTo(14, footY()); g.lineTo(W - 14, footY()); g.stroke(); g.fillStyle = acc; g.fillText('腳底', 16, footY() - 5);
      const G = geo(c, U); if (!G) { lab.textContent = '沒有待機圖片'; return; }
      if (!G.b.img) { lab.textContent = '圖片載入中…'; requestAnimationFrame(redraw); return; }
      const f = G.f, doc = G.doc;
      g.save(); g.translate(G.ox, G.oy); g.scale(G.kx, G.ky); g.imageSmoothingEnabled = !c.appearance.pixel; g.imageSmoothingQuality = 'high';
      if (mode === 'crop') { g.globalAlpha = 0.28; g.drawImage(G.b.img, -G.a.x, -G.a.y, doc.w, doc.h); g.globalAlpha = 1; }
      g.beginPath(); g.rect(doc.w * f.crop.l - G.a.x, doc.h * f.crop.t - G.a.y, doc.w * (1 - f.crop.l - f.crop.r), doc.h * (1 - f.crop.t - f.crop.b)); g.clip();
      g.drawImage(G.b.img, -G.a.x, -G.a.y, doc.w, doc.h); g.restore();
      /* its frame and handles */
      const R = G.rect; g.strokeStyle = mode === 'crop' ? sun : acc; g.lineWidth = 2; g.strokeRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
      for (const hd of handles(G)) { g.fillStyle = mode === 'crop' ? sun : acc; g.beginPath(); g.arc(hd.x, hd.y, 7, 0, 7); g.fill(); g.strokeStyle = c1; g.lineWidth = 2; g.stroke(); }
      lab.textContent = mode === 'crop' ? `裁切 上${Math.round(f.crop.t * 100)}% 下${Math.round(f.crop.b * 100)}% 左${Math.round(f.crop.l * 100)}% 右${Math.round(f.crop.r * 100)}%` : `大小 ${Math.round(f.zoom * 100)}%・寬 ${Math.round(f.zoom * f.sx * 100)}%・高 ${Math.round(f.zoom * f.sy * 100)}%`;
    }
    function handles(G) {
      const R = G.rect, mx = (R.x0 + R.x1) / 2, my = (R.y0 + R.y1) / 2;
      if (mode === 'crop') return [{ k: 't', x: mx, y: R.y0 }, { k: 'b', x: mx, y: R.y1 }, { k: 'l', x: R.x0, y: my }, { k: 'r', x: R.x1, y: my }];
      return [{ k: 'e', x: R.x1, y: my }, { k: 'n', x: mx, y: R.y0 }, { k: 'ne', x: R.x1, y: R.y0 }];
    }
    function redraw() { if (!raf) raf = requestAnimationFrame(draw); }
    const local = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', (e) => {
      const c = getChar(); if (!c) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); const p = local(e); pts.set(e.pointerId, p);
      const G = geo(c, U); if (!G) return; const f = F(c);
      if (pts.size === 1) {
        const hd = handles(G).find((q) => Math.hypot(q.x - p.x, q.y - p.y) < 26);
        dragging = { kind: hd ? hd.k : 'move', p0: p, f0: JSON.parse(JSON.stringify(f)), G };
      } else { const a = [...pts.values()]; dragging = { kind: 'pinch', d0: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), f0: JSON.parse(JSON.stringify(f)), G }; }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || !dragging) return; const p = local(e); pts.set(e.pointerId, p); const c = getChar(); const f = F(c), d = dragging, f0 = d.f0, G = d.G;
      if (d.kind === 'pinch') { const a = [...pts.values()]; if (a.length < 2) return; f.zoom = cl(f0.zoom * Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) / Math.max(10, d.d0), 0.2, 4); }
      else {
        const dx = p.x - d.p0.x, dy = p.y - d.p0.y;
        if (d.kind === 'move') { f.dx = cl(f0.dx + dx / U * 100, -150, 150); f.dy = cl(f0.dy + dy / U * 100, -150, 150); }
        else if (d.kind === 'e') { const w0 = G.rect.x1 - G.ox; f.sx = cl(f0.sx * Math.max(0.05, (w0 + dx) / Math.max(4, Math.abs(w0))), 0.2, 4); }
        else if (d.kind === 'n') { const h0 = G.oy - G.rect.y0; f.sy = cl(f0.sy * Math.max(0.05, (h0 - dy) / Math.max(4, h0)), 0.2, 4); }
        else if (d.kind === 'ne') { const h0 = G.oy - G.rect.y0; f.zoom = cl(f0.zoom * Math.max(0.05, (h0 - dy + dx) / Math.max(4, h0)), 0.2, 4); }
        else { /* crop edges, in picture fractions; a sliver always stays */
          const dw = G.doc.w * Math.abs(G.kx), dh = G.doc.h * G.ky, k = f.crop, k0 = f0.crop, flip = f.flip;
          if (d.kind === 't') k.t = cl(k0.t + dy / dh, 0, 0.92 - k.b); if (d.kind === 'b') k.b = cl(k0.b - dy / dh, 0, 0.92 - k.t);
          const L = (v) => cl(v, 0, 0.92 - k.r), Rr = (v) => cl(v, 0, 0.92 - k.l);
          if (d.kind === 'l') { if (flip) k.r = Rr(k0.r + dx / dw); else k.l = L(k0.l + dx / dw); }
          if (d.kind === 'r') { if (flip) k.l = L(k0.l - dx / dw); else k.r = Rr(k0.r - dx / dw); }
        }
      }
      o.onChange && o.onChange(true); redraw();
    });
    const up = (e) => { if (!pts.delete(e.pointerId)) return; if (pts.size === 1 && dragging && dragging.kind === 'pinch') { const p = [...pts.values()][0], c = getChar(); dragging = { kind: 'move', p0: p, f0: JSON.parse(JSON.stringify(F(c))), G: geo(c, U) }; return; } if (!pts.size && dragging) { dragging = null; o.onChange && o.onChange(false); redraw(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => redraw()) : null; if (ro) ro.observe(wrap);
    return { el: wrap, redraw, get mode() { return mode; }, setMode(m) { mode = m; wrap.classList.toggle('crop', m === 'crop'); redraw(); }, pause(v) { wantDraw = !v; if (!v) redraw(); }, get U() { return U; }, geo: () => geo(getChar(), U) };
  }

  // ------------------------------------------------------------------ the picture panel
  function panel(c, x, tb) {
    const box = h('div.fr-panel', { 'data-sec': 'image' });
    const changed = (live) => { x.changed('look', live ? null : 'idle'); tb && tb.redraw(); };
    const build = () => {
      const f = F(c), crop = tb && tb.mode === 'crop';
      const big = (stk, label, fn, on) => h('button.fr-act' + (on ? '.on' : ''), { on: { click: () => { haptic(); fn(); } } }, OC.UI.stickerOr ? OC.UI.stickerOr(stk) : icon(stk), h('small', null, label));
      const acts = h('div.fr-acts', null,
        big('sparkle', '自動對齊', () => { if (autoFit(c)) { changed(); toast('已對齊腳底與標準高度', 'check'); } else toast('圖片還在載入', 'info'); build(); }),
        big('rotate', '左右翻轉', () => { F(c).flip = !F(c).flip; changed(); build(); }, f.flip),
        big('scissors', crop ? '完成裁切' : '裁切', () => { tb && tb.setMode(crop ? 'move' : 'crop'); build(); }, crop),
        big('undo', '重設', () => { c.appearance.frame = null; changed(); build(); }));
      const hint = h('div.fr-hint', null, crop ? '拖曳黃色把手裁掉四邊（最少留一點）。裁切是選用的——通常用不到。' : '在上面的台子：單指拖曳＝移動、兩指＝縮放；右邊把手＝寬、上面＝高、右上角＝一起。');
      const tog = (label, sub, v, fn) => h('div.fr-row', null, h('div.grow', null, h('b', null, label), sub ? h('small', null, sub) : null), OC.UI.toggle(v, fn));
      const toggles = h('div.card.fr-card', null,
        tog('走路時跟著轉向', '圖裡的角色要面向右邊；正面的圖可以關掉', f.faces !== 'front', (v) => { F(c).faces = v ? 'right' : 'front'; changed(); }),
        tog('像素風', '點陣圖放大不會糊', !!c.appearance.pixel, (v) => { c.appearance.pixel = v; changed(); }));
      const fine = h('details.fr-fine', null, h('summary', null, '數值微調'),
        num('整體大小', f.zoom * 100, 20, 400, 1, (v, live) => { F(c).zoom = v / 100; changed(live); }, '%'), num('寬度', f.sx * 100, 20, 400, 1, (v, live) => { F(c).sx = v / 100; changed(live); }, '%'), num('高度', f.sy * 100, 20, 400, 1, (v, live) => { F(c).sy = v / 100; changed(live); }, '%'),
        num('左右位置', f.dx, -150, 150, 1, (v, live) => { F(c).dx = v; changed(live); }), num('上下位置', f.dy, -150, 150, 1, (v, live) => { F(c).dy = v; changed(live); }),
        num('裁上', f.crop.t * 100, 0, 90, 1, (v, live) => { F(c).crop.t = Math.min(v / 100, 0.92 - F(c).crop.b); changed(live); }, '%'), num('裁下', f.crop.b * 100, 0, 90, 1, (v, live) => { F(c).crop.b = Math.min(v / 100, 0.92 - F(c).crop.t); changed(live); }, '%'),
        num('裁左', f.crop.l * 100, 0, 90, 1, (v, live) => { F(c).crop.l = Math.min(v / 100, 0.92 - F(c).crop.r); changed(live); }, '%'), num('裁右', f.crop.r * 100, 0, 90, 1, (v, live) => { F(c).crop.r = Math.min(v / 100, 0.92 - F(c).crop.l); changed(live); }, '%'));
      box.replaceChildren(acts, hint, bgCard(c, x, () => { changed(); build(); }), toggles, fine);
    };
    build(); return box;
  }
  const num = (label, v, min, max, step, fn, unit) => OC.UI.slider({ zh: label }, v, fn, { min, max, step, fmt: (q) => Math.round(q) + (unit || '') });

  /** the background card: what was found around the picture, and one button */
  function bgCard(c, x, after) {
    const card = h('div.card.fr-card.fr-bg'); const b = base(c);
    const docs = docsOf(c), cut = docs.some((d) => d.cut16);
    if (!b || !b.img) { card.append(h('b', null, '背景'), h('small.faint', null, '圖片載入中…')); return card; }
    const det = OC.Cutout.detect(b.img);
    const sw = det.rgb ? h('i.fr-sw', { style: { background: `rgb(${det.rgb.join(',')})` } }) : null;
    card.append(h('div.fr-row', null, h('div.grow', null, h('b', null, '背景'), h('small', null, cut ? '已經去掉背景（原圖還在，可以還原）' : det.transparent ? '背景是透明的，不需要處理' : det.has ? `偵測到單色背景（佔邊緣 ${Math.round(det.share * 100)}%）` : '邊緣顏色不一致，可能沒有單色背景')), sw),
      h('div.hstack', { style: { gap: '8px', marginTop: '8px', flexWrap: 'wrap' } },
        h('button.btn.s' + (det.has && !cut ? '.primary' : ''), { on: { click: async () => { const r = await cutSheet(framesOf(c).slice(0, 1), { title: '去除背景', tol: (docs.find((d) => d.cut16) || {}).cut16 ? docs.find((d) => d.cut16).cut16.tol : 42 }); if (!r) return; toast('處理所有影格中…', 'image'); const n = await applyCut(c, r); toast(n ? `已處理 ${n} 張影格` : '沒有可以處理的影格', 'check'); x.changed('look', 'happy'); after(); } } }, icon('sparkle', 's'), cut ? '重新調整' : '去除背景'),
        cut ? h('button.btn.s.ghost', { on: { click: () => { const n = revertCut(c); toast(n ? '已還原原圖' : '沒有可還原的', 'undo'); x.changed('look', 'happy'); after(); } } }, '還原原圖') : null));
    return card;
  }
  /** every animation doc a character uses */
  function docsOf(c) { const ids = new Set(); for (const m of Object.values(c.actions || {})) for (const id of Object.values(m || {})) if (id) ids.add(id); return [...ids].map((id) => OC.Anim.get(id)).filter(Boolean); }
  function framesOf(c) { const b = base(c); return b && b.img ? [OC.Cutout.clone(b.img)] : []; }

  // ------------------------------------------------------------------ background removal sheet
  /** canvases → { tol, seeds, rgb } chosen with a live preview (or null when cancelled) */
  function cutSheet(canvases, o = {}) {
    return new Promise((resolve) => {
      const src = canvases[0]; if (!src) { resolve(null); return; }
      const det = OC.Cutout.detect(src); let tol = o.tol || 42, seeds = [], on = o.on != null ? o.on : (det.has || !!o.force), done = false;
      const pv = h('canvas.fr-cut-cv'), info = h('small.faint');
      const el = h('div.sheet.fr-cut', { role: 'dialog', 'aria-label': o.title || '去除背景' });
      const close = (v) => { if (done) return; done = true; OC.UI.popLayer(layer); el.remove(); resolve(v); };
      const layer = { scrim: true, el, close: () => close(null) };
      const render = () => {
        const out = on ? OC.Cutout.remove(src, { tol, rgb: det.rgb, seeds: [] }) : OC.Cutout.clone(src);
        let k = out; for (const s of seeds) k = OC.Cutout.wand(k, s.x, s.y, tol);
        const maxW = Math.min(320, innerWidth - 48), sc = Math.min(maxW / src.width, 300 / src.height, 2); pv.width = Math.round(src.width * sc); pv.height = Math.round(src.height * sc);
        const g = pv.getContext('2d'); const c1 = css('--surface'), c2 = css('--surface-2') || css('--bg'); g.fillStyle = c1; g.fillRect(0, 0, pv.width, pv.height); g.fillStyle = c2; for (let y = 0; y < pv.height; y += 10) for (let x = (y / 10) % 2 ? 10 : 0; x < pv.width; x += 20) g.fillRect(x, y, 10, 10);
        g.drawImage(k, 0, 0, pv.width, pv.height); pv._sc = sc;
        info.textContent = `透明的部分：${Math.round(OC.Cutout.clearShare(k) * 100)}%${seeds.length ? `・點掉了 ${seeds.length} 處` : ''}`;
      };
      pv.addEventListener('click', (e) => { const r = pv.getBoundingClientRect(); seeds.push({ x: (e.clientX - r.left) * (pv.width / r.width) / pv._sc, y: (e.clientY - r.top) * (pv.height / r.height) / pv._sc }); haptic(); render(); });
      const sl = OC.UI.slider({ zh: '容許度（越大去得越多）' }, tol, (v, live) => { tol = v; if (!live) render(); }, { min: 8, max: 120, step: 1, fmt: (v) => Math.round(v) });
      el.append(h('div.hstack', null, h('h2.grow', { style: { margin: 0 } }, o.title || '去除背景'), h('button.icon-btn', { 'aria-label': '關閉', on: { click: () => close(null) } }, icon('close'))),
        h('div.fr-cut-pv', null, pv), info,
        h('div.fr-row', null, h('div.grow', null, h('b', null, '去掉邊緣相連的背景'), h('small', null, '只去掉跟圖片邊緣連在一起的顏色——角色身上同樣的顏色會留著')), OC.UI.toggle(on, (v) => { on = v; render(); })),
        sl, h('div.faint', { style: { fontSize: 'var(--fs-xs)', margin: '4px 0 8px' } }, '圍起來的空隙（例如手臂和身體之間）沒有被去掉？直接點預覽裡的那一塊。'),
        h('div.hstack', { style: { gap: '8px' } }, h('button.btn.ghost', { on: { click: () => { seeds.pop(); render(); } } }, icon('undo', 's'), '復原一處'), h('div.grow'), h('button.btn.primary', { on: { click: () => close({ tol, seeds: seeds.slice(), rgb: det.rgb, on }) } }, '套用')));
      document.getElementById('app').append(el); OC.UI.pushLayer(layer); if (OC.Pick && OC.Pick.guard) OC.Pick.guard(el); render();
    });
  }
  /** apply the chosen removal to every frame of every action → new assets; the old frame ids stay on the doc */
  async function applyCut(c, r) {
    let n = 0;
    for (const doc of docsOf(c)) {
      const orig = doc.cut16 ? doc.cut16.orig : doc.layers.map((l) => l.cells.slice());
      const layers = [];
      for (let li = 0; li < doc.layers.length; li++) {
        const cells = [];
        for (const id of orig[li] || []) {
          if (!id) { cells.push(null); continue; }
          let img; try { img = await OC.Assets.image(id); } catch (e) { cells.push(id); continue; }
          const cv = OC.makeCanvas(img.width, img.height); cv.getContext('2d').drawImage(img, 0, 0);
          let k = r.on === false ? cv : OC.Cutout.remove(cv, { tol: r.tol, rgb: r.rgb });
          for (const s of r.seeds || []) if (s.x < k.width && s.y < k.height) k = OC.Cutout.wand(k, s.x, s.y, r.tol);
          const put = await OC.Assets.put(k, { kind: 'frame', name: (doc.name || '影格') + '（去背）', owner: c.id }); cells.push(put.id); n++;
        }
        layers.push(cells);
      }
      doc.layers.forEach((l, i) => { l.cells = layers[i]; }); doc.cut16 = { orig, tol: r.tol, seeds: r.seeds || [], on: r.on !== false };
      OC.Anim.save(doc);
    }
    return n;
  }
  function revertCut(c) { let n = 0; for (const doc of docsOf(c)) if (doc.cut16) { doc.layers.forEach((l, i) => { l.cells = doc.cut16.orig[i] || l.cells; }); delete doc.cut16; OC.Anim.save(doc); n++; } return n; }

  OC.Frame16 = { table, panel, autoFit, cutSheet, applyCut, revertCut, docsOf, F };
})();
