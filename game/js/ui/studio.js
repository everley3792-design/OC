/* OC Shimeji — 逐格動畫工作室 (frame-animation studio), the basic but real version:
 * brush / eraser / fill, palette, 3 sizes, per-frame undo, frames strip (add / duplicate /
 * delete / reorder), onion skin, OC guide underlay, live playback, save as PNG frames.
 * Saved animations can become the OC's in-world appearance or the desktop pet.
 */
(function () {
  'use strict';
  const { h, icon, toast, seg, haptic, confirm } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store;
  const N = 256, MAX_FRAMES = 24;
  const PALETTE = ['#3B2B25', '#FFFFFF', '#F26B5B', '#FF9A3C', '#FFC93C', '#6CCB5F', '#3FC1B0', '#5BC0EB', '#9B7BE0', '#F48FB1', '#E7A86A', '#8E6A54'];

  OC.Pages.define('studio', '逐格動畫工作室', {
    sub: true,
    build(p, el) {
      p.cv = h('canvas.studio-canvas', { width: N, height: N, 'aria-label': '畫布' });
      p.under = h('canvas', { width: N, height: N }); p.under.className = 'studio-canvas'; Object.assign(p.under.style, { position: 'absolute', inset: 0, pointerEvents: 'none', background: 'transparent', boxShadow: 'none' });
      p.cv.style.position = 'relative'; p.cv.style.background = 'transparent';
      const stage = h('div', { style: { position: 'relative', borderRadius: 'var(--r-l)', background: '#FFFFFF', boxShadow: 'var(--shadow-1)' } }, p.under, p.cv);
      p.ctx = p.cv.getContext('2d', { willReadFrequently: true });
      p.tool = 'brush'; p.color = PALETTE[0]; p.size = 6; p.onion = true; p.guide = true;
      const toolBtn = (id, ic, label) => h('button.icon-btn', { 'data-tool': id, 'aria-label': label, on: { click: () => { p.tool = id; syncTools(p); haptic(); } } }, icon(ic));
      p.tools = h('div.toolbar', null, toolBtn('brush', 'brush', '畫筆'), toolBtn('eraser', 'eraser', '橡皮擦'), toolBtn('fill', 'target', '填色'),
        h('span.spacer'), h('button.icon-btn', { 'aria-label': '復原', on: { click: () => undo(p) } }, icon('undo')), h('button.icon-btn', { 'aria-label': '清空這一格', on: { click: () => { pushUndo(p); p.ctx.clearRect(0, 0, N, N); commit(p); } } }, icon('trash')));
      p.sizes = seg([['3', '細'], ['6', '中'], ['12', '粗']], '6', (v) => (p.size = +v));
      p.pal = OC.UI.swatches(PALETTE, p.color, (c) => { p.color = c; if (p.tool === 'eraser') { p.tool = 'brush'; syncTools(p); } });
      p.pal.querySelectorAll('.swatch').forEach((s) => { s.style.width = s.style.height = '34px'; });
      p.strip = h('div.frames');
      p.play = h('button.btn.s', { on: { click: () => togglePlay(p) } }, icon('play', 's'), '播放');
      p.fps = seg([['4', '4'], ['6', '6'], ['8', '8'], ['12', '12']], '6', (v) => { p.anim.fps = +v; });
      p.name = h('input', { maxLength: 16, 'aria-label': '作品名稱', on: { input: (e) => (p.anim.name = e.target.value) } });
      const frameBtns = h('div.hstack', null,
        h('button.btn.s', { on: { click: () => addFrame(p, false) } }, icon('plus', 's'), '新增'),
        h('button.btn.s', { on: { click: () => addFrame(p, true) } }, icon('copy', 's'), '複製'),
        h('button.btn.s', { on: { click: () => delFrame(p) } }, icon('trash', 's'), '刪除'),
        h('span.spacer'), p.play);
      const toggles = h('div.hstack', { style: { marginTop: '8px' } },
        h('span.grow', null, '洋蔥皮（顯示前一格）'), OC.UI.toggle(true, (v) => { p.onion = v; drawUnder(p); }));
      const toggles2 = h('div.hstack', { style: { marginTop: '8px' } },
        h('span.grow', null, '描圖底稿（我的 OC 輪廓）'), OC.UI.toggle(true, (v) => { p.guide = v; drawUnder(p); }));
      el.append(stage, h('div.card', { style: { marginTop: '10px', padding: '10px 12px' } }, p.tools, h('div', { style: { margin: '8px 0' } }, p.pal), p.sizes),
        h('div.section-title', null, '影格', h('small', { 'data-count': '' })), p.strip, frameBtns, h('div.card', { style: { marginTop: '10px' } }, h('div.muted', null, '播放速度（每秒格數）'), p.fps, toggles, toggles2),
        h('div.section-title', null, '作品名稱'), h('div.field', null, p.name),
        h('button.btn.primary.block', { style: { marginTop: '16px' }, on: { click: () => save(p) } }, icon('check', 's'), '儲存作品'));
      bindDraw(p);
    },
    refresh(p) {
      stopPlay(p);
      const src = p.params.id && S().anims.find((a) => a.id === p.params.id);
      p.anim = src ? { id: src.id, name: src.name, fps: src.fps, frames: src.frames.slice() } : { id: null, name: `我的動畫 ${S().anims.length + 1}`, fps: 6, frames: [null] };
      p.cur = 0; p.undo = []; p.name.value = p.anim.name; p.fps.set(String(p.anim.fps)); p.dirty = false;
      p.imgs = []; // decoded frames
      Promise.all(p.anim.frames.map(loadImg)).then((imgs) => { p.imgs = imgs; showFrame(p, 0); renderStrip(p); });
      syncTools(p);
    },
    onHide(p) { stopPlay(p); },
  });
  const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  function syncTools(p) { p.tools.querySelectorAll('[data-tool]').forEach((b) => { const on = b.dataset.tool === p.tool; b.style.color = on ? 'var(--accent)' : ''; b.setAttribute('aria-pressed', on); }); }
  function showFrame(p, i) {
    p.cur = i; p.ctx.clearRect(0, 0, N, N); if (p.imgs[i]) p.ctx.drawImage(p.imgs[i], 0, 0, N, N);
    p.undo = []; drawUnder(p); markStrip(p);
  }
  function drawUnder(p) {
    const x = p.under.getContext('2d'); x.clearRect(0, 0, N, N);
    if (p.guide) { x.save(); x.globalAlpha = 0.16; OC.Style.drawOC(x, S().oc, { blink: 0, mouth: 'smile', noShadow: true }, N / 2, N * 0.9, N / 82, 0); x.restore(); }
    if (p.onion && p.cur > 0 && p.imgs[p.cur - 1]) { x.save(); x.globalAlpha = 0.28; x.drawImage(p.imgs[p.cur - 1], 0, 0, N, N); x.restore(); }
  }
  function commit(p) {
    // store the current canvas as this frame's image (sync via a canvas copy, async PNG later)
    const c = OC.makeCanvas(N, N); c.getContext('2d').drawImage(p.cv, 0, 0); p.imgs[p.cur] = c; p.anim.frames[p.cur] = 'dirty'; p.dirty = true;
    updateThumb(p, p.cur);
  }
  function pushUndo(p) { p.undo.push(p.ctx.getImageData(0, 0, N, N)); if (p.undo.length > 20) p.undo.shift(); }
  function undo(p) { const d = p.undo.pop(); if (!d) { toast('沒有可以復原的步驟', 'info'); return; } p.ctx.putImageData(d, 0, 0); commit(p); }
  function bindDraw(p) {
    let drawing = false, last = null;
    const pos = (e) => { const r = p.cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * N, y: ((e.clientY - r.top) / r.height) * N }; };
    p.cv.addEventListener('pointerdown', (e) => {
      if (p.playing) stopPlay(p);
      p.cv.setPointerCapture(e.pointerId); const q = pos(e); pushUndo(p);
      if (p.tool === 'fill') { flood(p, Math.floor(q.x), Math.floor(q.y), p.color); commit(p); return; }
      drawing = true; last = q; stroke(p, q, q);
    });
    p.cv.addEventListener('pointermove', (e) => { if (!drawing) return; const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; for (const ev of evs) { const q = pos(ev); stroke(p, last, q); last = q; } });
    const end = () => { if (drawing) { drawing = false; commit(p); } };
    p.cv.addEventListener('pointerup', end); p.cv.addEventListener('pointercancel', end);
  }
  function stroke(p, a, b) {
    const x = p.ctx; x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = p.size * (p.tool === 'eraser' ? 2 : 1);
    x.globalCompositeOperation = p.tool === 'eraser' ? 'destination-out' : 'source-over'; x.strokeStyle = p.color;
    x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x + 0.01, b.y); x.stroke(); x.restore();
  }
  function flood(p, sx, sy, hex) {
    const img = p.ctx.getImageData(0, 0, N, N), d = img.data, idx = (x, y) => (y * N + x) * 4;
    const [r, g, b] = OC.hexToRgb(hex), i0 = idx(sx, sy), tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
    if (tr === r && tg === g && tb === b && ta === 255) return;
    const same = (i) => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) + Math.abs(d[i + 3] - ta) < 60;
    const st = [[sx, sy]], seen = new Uint8Array(N * N);
    while (st.length) { const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= N || y >= N) continue; const k = y * N + x; if (seen[k]) continue; seen[k] = 1; const i = k * 4; if (!same(i)) continue; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
    p.ctx.putImageData(img, 0, 0);
  }
  function renderStrip(p) {
    p.strip.replaceChildren(...p.anim.frames.map((_, i) => { const c = h('canvas.frame-thumb', { width: 116, height: 116, 'aria-label': `第 ${i + 1} 格`, on: { click: () => { stopPlay(p); showFrame(p, i); } } }); const w = h('div', { style: { position: 'relative', flex: 'none' } }, c, h('span', { style: { position: 'absolute', left: '5px', top: '2px', font: '900 10px var(--font-num)', color: '#8F7660' } }, i + 1)); return w; }));
    p.anim.frames.forEach((_, i) => updateThumb(p, i)); markStrip(p);
    p.el.querySelector('[data-count]').textContent = `${p.anim.frames.length}/${MAX_FRAMES}`;
  }
  function updateThumb(p, i) { const w = p.strip.children[i]; if (!w) return; const c = w.querySelector('canvas'), x = c.getContext('2d'); x.clearRect(0, 0, 116, 116); if (p.imgs[i]) x.drawImage(p.imgs[i], 0, 0, 116, 116); }
  function markStrip(p) { [...p.strip.children].forEach((w, i) => w.querySelector('canvas').classList.toggle('on', i === p.cur)); }
  function addFrame(p, dup) {
    if (p.anim.frames.length >= MAX_FRAMES) { toast(`最多 ${MAX_FRAMES} 格`, 'info'); return; }
    const i = p.cur + 1; let img = null;
    if (dup && p.imgs[p.cur]) { img = OC.makeCanvas(N, N); img.getContext('2d').drawImage(p.imgs[p.cur], 0, 0); }
    p.anim.frames.splice(i, 0, img ? 'dirty' : null); p.imgs.splice(i, 0, img); p.dirty = true; renderStrip(p); showFrame(p, i);
  }
  async function delFrame(p) {
    if (p.anim.frames.length <= 1) { pushUndo(p); p.ctx.clearRect(0, 0, N, N); commit(p); return; }
    if (!(await confirm('刪除影格', `刪除第 ${p.cur + 1} 格？`, '刪除', true))) return;
    p.anim.frames.splice(p.cur, 1); p.imgs.splice(p.cur, 1); p.dirty = true; renderStrip(p); showFrame(p, Math.max(0, p.cur - 1));
  }
  function togglePlay(p) { if (p.playing) stopPlay(p); else startPlay(p); }
  function startPlay(p) {
    p.playing = true; p.play.replaceChildren(icon('pause', 's'), '停止'); p.under.style.visibility = 'hidden';
    let i = 0, t0 = performance.now();
    const step = (now) => { if (!p.playing) return; const fi = Math.floor(((now - t0) / 1000) * p.anim.fps) % p.anim.frames.length; if (fi !== i || now === t0) { i = fi; p.ctx.clearRect(0, 0, N, N); if (p.imgs[i]) p.ctx.drawImage(p.imgs[i], 0, 0, N, N); markStripIdx(p, i); } p.raf = requestAnimationFrame(step); };
    p.raf = requestAnimationFrame(step);
  }
  function markStripIdx(p, i) { [...p.strip.children].forEach((w, k) => w.querySelector('canvas').classList.toggle('on', k === i)); }
  function stopPlay(p) { if (!p.playing) return; p.playing = false; cancelAnimationFrame(p.raf); p.play.replaceChildren(icon('play', 's'), '播放'); p.under.style.visibility = ''; showFrame(p, p.cur); }
  function toURL(img) { if (!img) { const c = OC.makeCanvas(N, N); return c.toDataURL('image/png'); } if (img.src && !(img instanceof HTMLCanvasElement)) return img.src; return img.toDataURL('image/png'); }
  function save(p) {
    stopPlay(p);
    if (!p.imgs.some(Boolean)) { toast('先畫點東西再儲存吧', 'brush'); return; }
    const frames = p.imgs.map(toURL);
    const isNew = !p.anim.id;
    const rec = { id: p.anim.id || 'a' + Date.now().toString(36), name: (p.anim.name || '').trim() || '未命名', fps: p.anim.fps, w: N, h: N, frames };
    const list = S().anims, i = list.findIndex((a) => a.id === rec.id);
    if (i >= 0) list[i] = rec; else list.push(rec);
    p.anim.id = rec.id; p.params.id = rec.id;
    OC.App.invalidateSprite(rec.id);
    St.touch('anims');
    if (isNew) { St.stat('anims'); OC.Game.progress('anim'); St.needs({ mood: OC.Game.has('artsy') ? 18 : 8 }); }
    toast('作品已儲存', 'check'); haptic();
  }
  OC.Studio = { N };
})();
