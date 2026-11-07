/* OC Shimeji — 逐格動畫工作室 (frame-by-frame animation studio).
 * Works on a *copy* of an AnimDoc; nothing is written until 儲存. Undo/redo (80 steps) over the
 * whole doc (cells are asset ids, so snapshots are tiny). Autosaves a draft for crash recovery.
 * Layout modes keep the preview large on small phones: 預覽 / 時間軸 / 設定.
 */
(function () {
  'use strict';
  const { h, icon, toast, seg, toggle, haptic, confirm, sheet } = OC.UI;
  const A = () => OC.Anim, Ch = () => OC.Chars, S = () => OC.Store.s;
  const DRAFT = 'studio:last', TEST_ID = '__studio_test__';
  const P = {};   // studio state (persists while the page instance lives — e.g. during an island test)

  // ---------------- open / entry points ----------------
  async function open(o = {}) {
    const c = Ch().get(o.charId) || Ch().active();
    if (P.dirty && P.doc && !(o.docId && P.doc.id === o.docId) && !(await OC.UI.guardLeave(() => true))) return;
    let doc = o.docId && A().get(o.docId) ? Ch().clone(A().get(o.docId)) : null;
    if (!doc && !o.docId) { const d = await OC.Assets.draftGet(DRAFT).catch(() => null); if (d && d.doc && Date.now() - d.at < 7 * 864e5 && (await confirm('恢復未儲存的動畫？', `「${d.doc.name}」在 ${new Date(d.at).toLocaleString('zh-TW')} 還沒儲存。`, '恢復'))) { doc = d.doc; o.charId = d.charId || o.charId; } else if (d) await OC.Assets.draftDel(DRAFT); }
    if (!doc) { doc = A().create({ name: o.action ? `${Ch().ACTION_ZH[o.action] || o.action}` : '新動作', owner: c ? c.id : null, action: o.action || 'idle', dir: o.dir || 'any', w: 256, h: 256 }); doc.anchor = { x: 128, y: 230 }; doc.isNew = true; }
    Object.assign(P, { doc, charId: (Ch().get(o.charId) || c || {}).id, cur: 0, sel: null, layer: doc.layers[0].id, playing: false, speed: 1, onion: { on: true, prev: 1, next: 0 }, mode: 'preview', cell: 64, dirty: !!doc.isNew && false, anchorMode: false, ghost: true, mirror: false, clip: null });
    P.hist = OC.UI.history(() => P.doc, (v) => { P.doc = v; afterEdit(true); });
    OC.Pages.open('studio');
  }
  /** called by Paint ("加入動畫影格") */
  async function addFrameAsset(meta, ownerId) {
    if (P.doc && OC.Pages.pages.studio.el && OC.Pages.pages.studio.el.classList.contains('open')) { insertFrames([meta.id], P.cur + 1); return; }
    const c = Ch().get(ownerId) || Ch().active();
    const doc = A().create({ name: '新動作', owner: c.id, action: 'idle', cells: [[meta.id]], w: meta.w, h: meta.h }); doc.anchor = { x: meta.w / 2, y: meta.h * 0.92 };
    A().save(doc); await open({ charId: c.id, docId: doc.id }); toast('建立了新動作，可以繼續加影格', 'film');
  }

  // ---------------- doc operations (all undoable) ----------------
  const n = () => A().count(P.doc);
  const layerOf = (id) => P.doc.layers.find((l) => l.id === id) || P.doc.layers[0];
  function edit(fn) { fn(P.doc); P.hist.commit(); afterEdit(); }
  function afterEdit(fromHistory) { P.doc.updated = Date.now(); P.dirty = true; P.cur = Math.max(0, Math.min(P.cur, n() - 1)); if (!fromHistory) scheduleDraft(); const p = OC.Pages.pages.studio; if (p && p.el) render(p); }
  function insertFrames(ids, at, durs) { edit((d) => { d.layers.forEach((l) => l.cells.splice(at, 0, ...ids.map((id) => (l.id === P.layer ? id : null)))); d.durs.splice(at, 0, ...ids.map((_, i) => (durs ? durs[i] : null))); if (n() > ids.length && isBlank(d)) { /* keep */ } }); P.cur = at; }
  const isBlank = (d) => d.layers.every((l) => l.cells.every((c) => !c));
  const range = () => (P.sel ? [Math.min(P.sel[0], P.sel[1]), Math.max(P.sel[0], P.sel[1])] : [P.cur, P.cur]);
  function op(kind) {
    const [a, b] = range(), len = b - a + 1;
    if (kind === 'blank') { edit((d) => { d.layers.forEach((l) => l.cells.splice(P.cur + 1, 0, null)); d.durs.splice(P.cur + 1, 0, null); }); P.cur++; }
    if (kind === 'dup') { edit((d) => { d.layers.forEach((l) => l.cells.splice(b + 1, 0, ...l.cells.slice(a, b + 1))); d.durs.splice(b + 1, 0, ...d.durs.slice(a, b + 1)); }); P.cur = b + 1; P.sel = null; }
    if (kind === 'del') { if (len >= n()) { toast('至少要保留一格', 'info'); return; } edit((d) => { d.layers.forEach((l) => l.cells.splice(a, len)); d.durs.splice(a, len); }); P.cur = Math.max(0, a - 1); P.sel = null; }
    if (kind === 'rev') { edit((d) => { d.layers.forEach((l) => { const seg2 = l.cells.slice(a, b + 1).reverse(); l.cells.splice(a, len, ...seg2); }); const ds = d.durs.slice(a, b + 1).reverse(); d.durs.splice(a, len, ...ds); }); }
    if (kind === 'copy') { P.clip = { cells: P.doc.layers.map((l) => ({ id: l.id, cells: l.cells.slice(a, b + 1) })), durs: P.doc.durs.slice(a, b + 1) }; toast(`複製了 ${len} 格`, 'copy'); }
    if (kind === 'paste') { if (!P.clip) { toast('還沒有複製任何影格', 'info'); return; } const at = P.cur + 1, cl = P.clip, m = cl.durs.length; edit((d) => { d.layers.forEach((l) => { const src = cl.cells.find((x) => x.id === l.id); l.cells.splice(at, 0, ...(src ? src.cells : Array(m).fill(null))); }); d.durs.splice(at, 0, ...cl.durs); }); P.cur = at; }
    if (kind === 'left' && a > 0) { edit((d) => { d.layers.forEach((l) => { const x = l.cells.splice(a, len); l.cells.splice(a - 1, 0, ...x); }); const x = d.durs.splice(a, len); d.durs.splice(a - 1, 0, ...x); }); P.cur = Math.max(0, P.cur - 1); if (P.sel) P.sel = [a - 1, b - 1]; }
    if (kind === 'right' && b < n() - 1) { edit((d) => { d.layers.forEach((l) => { const x = l.cells.splice(a, len); l.cells.splice(a + 1, 0, ...x); }); const x = d.durs.splice(a, len); d.durs.splice(a + 1, 0, ...x); }); P.cur = Math.min(n() - 1, P.cur + 1); if (P.sel) P.sel = [a + 1, b + 1]; }
    haptic();
  }
  function moveFrame(from, to) { if (from === to) return; edit((d) => { d.layers.forEach((l) => { const [x] = l.cells.splice(from, 1); l.cells.splice(to, 0, x); }); const [x] = d.durs.splice(from, 1); d.durs.splice(to, 0, x); }); P.cur = to; }
  function setDur() {
    const [a, b] = range(); let v = P.doc.durs[a] || Math.round(1000 / P.doc.fps);
    sheet(`影格時長（第 ${a + 1}${b > a ? '–' + (b + 1) : ''} 格）`, (bd, api) => {
      const val = h('span.num', null, v + ' ms'); const inp = h('input', { type: 'range', min: 20, max: 2000, step: 10, value: v, on: { input: (e) => { v = +e.target.value; val.textContent = v + ' ms'; } } });
      bd.append(h('div.hstack', null, h('span.grow', null, '時長'), val), inp,
        h('div.hstack', { style: { marginTop: '12px' } }, h('button.btn.block', { on: { click: () => { edit((d) => { for (let i = a; i <= b; i++) d.durs[i] = null; }); api.close(); } } }, '跟隨 FPS'), h('button.btn.primary.block', { on: { click: () => { edit((d) => { for (let i = a; i <= b; i++) d.durs[i] = v; }); api.close(); } } }, '套用')));
    });
  }
  async function drawFrame() {
    const L = layerOf(P.layer), id = L.cells[P.cur];
    const base = OC.makeCanvas(P.doc.w, P.doc.h); if (id) { const img = await OC.Assets.image(id).catch(() => null); if (img) base.getContext('2d').drawImage(img, 0, 0, P.doc.w, P.doc.h); }
    const underlay = [];
    const pv = P.cur > 0 ? A().composite(P.doc, P.cur - 1) : null; if (pv) underlay.push({ canvas: pv, alpha: 0.22 });
    const others = A().composite(P.doc, P.cur); if (others && P.doc.layers.length > 1) underlay.push({ canvas: compositeExcept(P.cur, L.id), alpha: 0.6 });
    stopPlay();
    await OC.Paint.open({ canvas: base, noRecover: true, title: `第 ${P.cur + 1} 格・${L.name}`, underlay, color: P.lastColor, onCanvas: async (c) => { const r = await OC.Assets.put(c, { kind: 'frame', name: `${P.doc.name} ${P.cur + 1}`, owner: P.charId }); edit((d) => { layerOf(P.layer).cells[P.cur] = r.id; }); } });
  }
  function compositeExcept(i, lid) { const c = OC.makeCanvas(P.doc.w, P.doc.h), x = c.getContext('2d'); for (const l of P.doc.layers) { if (!l.visible || l.id === lid || !l.cells[i]) continue; const im = OC.Assets.peek(l.cells[i]); if (im) { x.globalAlpha = l.opacity; x.drawImage(im, 0, 0, P.doc.w, P.doc.h); } } return c; }
  async function importFrames(replace) {
    const r = await OC.Library.importDialog({ returnFrames: true, owner: P.charId, name: P.doc.name, fitTo: isBlank(P.doc) ? null : [P.doc.w, P.doc.h] });
    if (!r || !r.frames) return;
    if (isBlank(P.doc)) { edit((d) => { d.w = r.w; d.h = r.h; d.layers.forEach((l) => (l.cells = r.frames.map((id) => (l.id === P.layer ? id : null)))); d.durs = r.delays.slice(); if (r.fps) d.fps = r.fps; }); P.cur = 0; await autoAnchor(); return; }
    if (replace) { edit((d) => { layerOf(P.layer).cells[P.cur] = r.frames[0]; }); return; }
    insertFrames(r.frames, P.cur + 1, r.delays);
  }
  async function autoAnchor() { const a = await A().detectAnchor(P.doc); const c = OC.makeCanvas(P.doc.w, P.doc.h); await A().preload(P.doc); const comp = A().composite(P.doc, 0); const box = comp ? A().contentBox(comp) : null; edit((d) => { d.anchor = { x: Math.round(a.x), y: Math.round(a.y) }; if (box) d.points = Object.assign({}, d.points, { head: { x: Math.round(a.x), y: Math.round(box.y0 + box.h * 0.22) } }); d.hitbox = box ? { x: box.x0, y: box.y0, w: box.w, h: box.h } : null; }); toast('已自動偵測腳底位置', 'target'); }

  // ---------------- playback ----------------
  function startPlay() { if (P.playing) return; P.playing = true; P.t0 = performance.now(); P.lastI = -1; loop(); render(OC.Pages.pages.studio); }
  function stopPlay() { if (!P.playing) return; P.playing = false; cancelAnimationFrame(P.raf); const p = OC.Pages.pages.studio; if (p && p.el) render(p); }
  function loop() {
    if (!P.playing) return; P.raf = requestAnimationFrame(loop);
    const f = A().frameAt(P.doc, (performance.now() - P.t0) / 1000, P.speed);
    if (f.i !== P.lastI) { const ev = A().eventsBetween(P.doc, P.lastI, f.i); ev.forEach(showEvent); P.lastI = f.i; P.cur = f.i; drawPreview(); markCell(); }
    if (f.done) stopPlay();
  }
  function showEvent(e) { const lab = { sound: '🔊', particle: '✨', emote: '💬', bubble: '💭', use: '🍎', done: '✔', custom: '★' }[e.type] || '★'; const p = OC.Pages.pages.studio; const el = h('div.float-text', { style: { left: '50%', top: '30%', position: 'absolute' } }, `${lab} ${e.data || e.type}`); p.prevWrap.append(el); setTimeout(() => el.remove(), 1200); }

  // ---------------- autosave draft ----------------
  let draftT = 0;
  function scheduleDraft() { clearTimeout(draftT); draftT = setTimeout(() => OC.Assets.draftPut(DRAFT, { at: Date.now(), doc: P.doc, charId: P.charId }).catch(() => 0), 2500); }

  // ---------------- save / test ----------------
  async function save(silent) {
    const d = P.doc, c = Ch().get(P.charId);
    if (isBlank(d)) { toast('先加入至少一格影格', 'info'); return false; }
    // shared doc used by other OCs → ask before changing theirs
    const users = Ch().all().filter((x) => x.id !== P.charId && Object.values(x.actions || {}).some((m) => Object.values(m).includes(d.id)));
    if (users.length && A().get(d.id) && !silent) {
      const own = await confirm('這個動作也被其他角色使用', `${users.map((u) => u.profile.name).join('、')} 也在用。要另存成「${c ? c.profile.name : ''}」專屬的版本嗎？（選「取消」會一起修改）`, '另存專屬版本');
      if (own) { const old = d.id; d.id = A().uid('an'); d.owner = P.charId; if (c) for (const a of Object.keys(c.actions)) for (const k of Object.keys(c.actions[a])) if (c.actions[a][k] === old) c.actions[a][k] = d.id; }
    }
    delete d.isNew; A().save(Ch().clone(d)); P.dirty = false; P.hist.reset(); OC.Assets.draftDel(DRAFT).catch(() => 0);
    if (c && d.action && !(c.actions[d.action] && Object.values(c.actions[d.action]).includes(d.id))) {
      if (silent || (await confirm('套用到角色', `要讓「${c.profile.name}」的「${Ch().ACTION_ZH[d.action] || d.action}」${d.dir === 'any' ? '' : '（' + dirZh(d.dir) + '）'}使用這段動畫嗎？`, '套用'))) { A().assign(c, d.action, d.dir, d.id); const comp = A().composite(d, 0); if (comp && (!c.appearance.refH || (d.action === 'idle' && d.dir !== 'back'))) { c.appearance.refH = A().contentBox(comp).h; Ch().save(c); } }
    }
    const isNewAnim = !S().stats.animIds || !S().stats.animIds.includes(d.id);
    if (isNewAnim) { S().stats.animIds = [...(S().stats.animIds || []), d.id]; OC.Store.stat('anims'); OC.Game.progress('anim'); OC.Store.needs({ mood: OC.Game.has('artsy') || OC.Game.has('creative') ? 18 : 8 }); }
    if (!silent) toast('動畫已儲存', 'check'); haptic(); render(OC.Pages.pages.studio); return true;
  }
  const dirZh = (d) => ({ any: '全方向', front: '正面', back: '背面', left: '左', right: '右' })[d] || d;
  function testOnIsland() {
    const c = Ch().get(P.charId); if (!c) { toast('先選一個角色', 'info'); return; }
    stopPlay();
    const tmp = Ch().clone(P.doc); tmp.id = TEST_ID; S().animations[TEST_ID] = tmp; A().clearCache();
    const tc = Ch().clone(c); tc.actions = Ch().clone(c.actions || {}); const act = P.doc.action || 'idle';
    tc.actions[act] = Object.assign({}, tc.actions[act] || {}, { [P.doc.dir || 'any']: TEST_ID }); if (P.doc.dir === 'any') { delete tc.actions[act].front; delete tc.actions[act].left; delete tc.actions[act].right; delete tc.actions[act].back; }
    if (!tc.appearance.refH) { const comp = A().composite(tmp, 0); if (comp) tc.appearance.refH = A().contentBox(comp).h; }
    OC.UI.popLayer(OC.Pages.pages.studio.layer); OC.Pages.pages.studio.el.classList.remove('open'); OC.Pages.pages.studio.layer = null;
    OC.App.testOnIsland(tc, act, () => { delete S().animations[TEST_ID]; A().clearCache(); OC.App.tab('workshop'); OC.Pages.open('studio'); });
  }

  // ---------------- page ----------------
  OC.Pages.define('studio', '動畫工作室', {
    sub: true,
    headRight: () => h('div.hstack', { style: { gap: 0 } }, h('button.icon-btn', { 'aria-label': '復原', on: { click: () => { if (!P.hist.undo()) toast('沒有可以復原的步驟', 'info'); } } }, icon('undo')), h('button.icon-btn', { 'aria-label': '重做', on: { click: () => { if (!P.hist.redo()) toast('沒有可以重做的步驟', 'info'); } } }, icon('redo'))),
    build(p, el) {
      p.preview = h('canvas.studio-preview', { width: 640, height: 640, 'aria-label': '動畫預覽' });
      p.prevWrap = h('div.studio-stage', null, p.preview);
      p.transport = h('div.studio-transport'); p.timeline = h('div.studio-timeline'); p.tools = h('div.studio-tools'); p.panel = h('div.studio-panel');
      p.modes = seg([['preview', '預覽'], ['timeline', '時間軸'], ['settings', '設定']], 'preview', (v) => { P.mode = v; render(p); });
      p.footer = h('div.hstack', { style: { marginTop: '12px' } }, h('button.btn.block', { on: { click: () => testOnIsland() } }, icon('island', 's'), '在小島測試'), h('button.btn.primary.block', { on: { click: () => save() } }, icon('check', 's'), '儲存'));
      el.append(p.prevWrap, p.transport, p.modes, p.timeline, p.tools, p.panel, p.footer);
      // preview gestures: anchor mode (tap/drag sets the foot point)
      const at = (e) => { const r = p.preview.getBoundingClientRect(), v = P.view; return [((e.clientX - r.left) / r.width * p.preview.width - v.ox) / v.k, ((e.clientY - r.top) / r.height * p.preview.height - v.oy) / v.k]; };
      let dragA = false;
      p.preview.addEventListener('pointerdown', (e) => { if (!P.anchorMode) return; p.preview.setPointerCapture(e.pointerId); dragA = true; const [x, y] = at(e); P.doc.anchor = { x: Math.round(x), y: Math.round(y) }; drawPreview(); });
      p.preview.addEventListener('pointermove', (e) => { if (!dragA) return; const [x, y] = at(e); P.doc.anchor = { x: Math.round(x), y: Math.round(y) }; drawPreview(); });
      p.preview.addEventListener('pointerup', () => { if (dragA) { dragA = false; P.hist.commit(); afterEdit(); } });
    },
    refresh(p) { if (!P.doc) { open({}); return; } p.el.querySelector('h1').textContent = P.doc.name || '動畫工作室'; render(p); },
    onHide() { stopPlay(); },
  });
  // leaving with unsaved changes → ask (back button / tab switch)
  const origClose = OC.Pages.close;
  OC.Pages.close = function (id) { if (id === 'studio' && P.dirty && !P.leaving && OC.Pages.pages.studio.el && OC.Pages.pages.studio.el.classList.contains('open') && !P.testing) { P.leaving = true; OC.UI.guardLeave(() => true).then((ok) => { P.leaving = false; if (ok) { P.dirty = false; OC.Assets.draftDel(DRAFT).catch(() => 0); origClose(id); } }); return; } origClose(id); };

  function render(p) {
    if (!p || !p.el || !P.doc) return;
    const d = P.doc;
    p.el.querySelector('h1').textContent = (P.dirty ? '● ' : '') + (d.name || '動畫工作室');
    p.modes.set(P.mode);
    // transport
    const loopZh = { loop: '循環', once: '播一次', pingpong: '來回' }[d.loop];
    p.transport.replaceChildren(
      h('button.icon-btn', { 'aria-label': '第一格', on: { click: () => { stopPlay(); P.cur = 0; render(p); } } }, icon('back')),
      h('button.icon-btn', { 'aria-label': '上一格', on: { click: () => { stopPlay(); P.cur = (P.cur - 1 + n()) % n(); render(p); } } }, icon('minus')),
      h('button.btn.s.primary', { style: { minWidth: '72px' }, on: { click: () => (P.playing ? stopPlay() : startPlay()) } }, icon(P.playing ? 'pause' : 'play', 's'), P.playing ? '停止' : '播放'),
      h('button.icon-btn', { 'aria-label': '下一格', on: { click: () => { stopPlay(); P.cur = (P.cur + 1) % n(); render(p); } } }, icon('plus')),
      h('span.spacer'),
      h('button.chip', { style: { padding: '0 12px' }, on: { click: () => { edit((x) => { x.loop = x.loop === 'loop' ? 'pingpong' : x.loop === 'pingpong' ? 'once' : 'loop'; }); } } }, loopZh),
      h('button.chip', { style: { padding: '0 12px' }, on: { click: () => { P.speed = P.speed >= 2 ? 0.25 : P.speed * 2; render(p); } } }, `${P.speed}×`),
      h('span.num.muted', { style: { fontSize: 'var(--fs-s)' } }, `${P.cur + 1}/${n()}`));
    drawPreview();
    renderTimeline(p); renderTools(p); renderPanel(p);
  }
  function drawPreview() {
    const p = OC.Pages.pages.studio, cv = p.preview, x = cv.getContext('2d'), d = P.doc; if (!cv) return;
    const W = cv.width, H = cv.height; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
    const a = d.anchor || { x: d.w / 2, y: d.h * 0.9 };
    const k = Math.min((W * 0.86) / d.w, (H * 0.86) / d.h), ox = W / 2 - d.w * k / 2, oy = H * 0.5 - d.h * k / 2; P.view = { k, ox, oy };
    // checker + ground
    x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface-2'); x.fillRect(0, 0, W, H);
    x.save(); x.translate(ox, oy); x.scale(k, k);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, 0, d.w, d.h);
    // character-size reference (ghost of the rig at the same scale the game will use)
    const c = Ch().get(P.charId);
    if (P.ghost && c && !P.playing) { const comp0 = A().composite(d, 0); const refH = (c.appearance && c.appearance.refH) || (comp0 ? A().contentBox(comp0).h : d.h * 0.8); const unit = refH / OC.CharRender.RIG_H; x.save(); x.globalAlpha = 0.16; const g = Ch().clone(c); g.appearance.mode = 'rig'; g.actions = {}; OC.CharRender.draw(x, g, { action: 'idle', face: 0, noShadow: true }, a.x, a.y, unit, 0); x.restore(); }
    // onion skin
    if (P.onion.on && !P.playing) {
      for (let j = 1; j <= P.onion.prev; j++) { const i = P.cur - j; if (i < 0) break; const f = A().composite(d, i); if (f) { x.globalAlpha = 0.28 / j; tint(x, f, '#F26B5B'); } }
      for (let j = 1; j <= P.onion.next; j++) { const i = P.cur + j; if (i >= n()) break; const f = A().composite(d, i); if (f) { x.globalAlpha = 0.28 / j; tint(x, f, '#3FC1B0'); } }
      x.globalAlpha = 1;
    }
    const f = A().composite(d, P.cur);
    if (f) { x.save(); if (P.mirror) { x.translate(a.x * 2, 0); x.scale(-1, 1); } x.drawImage(f, 0, 0); x.restore(); } else { A().preload(d).then(() => drawPreview()); }
    // ground line, foot anchor, hitbox, head point
    x.strokeStyle = 'rgba(60,140,90,.6)'; x.lineWidth = 2 / k; x.beginPath(); x.moveTo(-20, a.y); x.lineTo(d.w + 20, a.y); x.stroke();
    x.fillStyle = P.anchorMode ? '#F26B5B' : 'rgba(242,107,91,.8)'; x.beginPath(); x.arc(a.x, a.y, (P.anchorMode ? 9 : 6) / k * 2, 0, Math.PI * 2); x.fill();
    if (d.hitbox && !P.playing) { x.setLineDash([6 / k, 5 / k]); x.strokeStyle = 'rgba(91,192,235,.8)'; x.strokeRect(d.hitbox.x, d.hitbox.y, d.hitbox.w, d.hitbox.h); x.setLineDash([]); }
    x.restore();
  }
  function tint(x, f, col) { const k = OC.makeCanvas(f.width, f.height), y = k.getContext('2d'); y.drawImage(f, 0, 0); y.globalCompositeOperation = 'source-in'; y.fillStyle = col; y.fillRect(0, 0, k.width, k.height); x.drawImage(k, 0, 0); }

  // ---------------- timeline ----------------
  function renderTimeline(p) {
    const d = P.doc, [a, b] = range(), cw = P.cell;
    const rows = P.mode === 'timeline' ? [...d.layers].reverse() : [layerOf(P.layer)];
    const wrap = h('div.tl-scroll');
    const cells = [];
    const header = h('div.tl-row.tl-head', null, h('div.tl-label', null, ''), ...Array.from({ length: n() }, (_, i) => h('div.tl-num', { style: { width: cw + 'px' } }, i + 1, d.durs[i] ? h('small', null, ` ${d.durs[i]}ms`) : null, (d.events || []).some((e) => e.frame === i) ? h('small', { style: { color: 'var(--accent)' } }, ' ●') : null)));
    wrap.append(header);
    for (const L of rows) {
      const row = h('div.tl-row', null, h('button.tl-label' + (L.id === P.layer ? '.on' : ''), { on: { click: () => { P.layer = L.id; render(p); } } }, L.visible ? '' : '⦸ ', L.name));
      L.cells.forEach((id, i) => {
        const cv = h('canvas', { width: 96, height: 96 }), cell = h('div.tl-cell' + (i === P.cur ? '.cur' : '') + (i >= a && i <= b && P.sel ? '.sel' : ''), { style: { width: cw + 'px', height: cw + 'px' }, 'data-i': i }, cv);
        if (id) OC.Assets.image(id).then((img) => { const c2 = cv.getContext('2d'), s = Math.min(96 / img.width, 96 / img.height); c2.drawImage(img, (96 - img.width * s) / 2, (96 - img.height * s) / 2, img.width * s, img.height * s); }).catch(() => { cell.classList.add('missing'); });
        bindCell(cell, i, L, p); row.append(cell); cells.push(cell);
      });
      wrap.append(row);
    }
    p.timeline.replaceChildren(wrap, h('div.hstack', { style: { marginTop: '6px' } }, h('span.muted', { style: { fontSize: 'var(--fs-xs)' } }, '格寬'), h('input', { type: 'range', min: 40, max: 120, value: cw, 'aria-label': '時間軸縮放', style: { flex: 1, height: '26px' }, on: { input: (e) => { P.cell = +e.target.value; renderTimeline(p); } } }),
      h('button.chip', { style: { padding: '0 10px' }, on: { click: () => { P.sel = P.sel ? null : [P.cur, P.cur]; render(p); } } }, P.sel ? `選取 ${a + 1}–${b + 1}` : '選取區間')));
    const curEl = wrap.querySelector('.tl-cell.cur'); if (curEl) requestAnimationFrame(() => { const r = curEl.offsetLeft - wrap.clientWidth / 2 + cw / 2; if (Math.abs(wrap.scrollLeft - r) > cw * 2) wrap.scrollLeft = r; });
  }
  function markCell() { const p = OC.Pages.pages.studio; p.timeline.querySelectorAll('.tl-cell').forEach((c) => c.classList.toggle('cur', +c.dataset.i === P.cur)); const t = p.transport.querySelector('.num'); if (t) t.textContent = `${P.cur + 1}/${n()}`; }
  function bindCell(cell, i, L, p) {
    let lp = null, dragging = false, startX = 0;
    cell.addEventListener('pointerdown', (e) => { startX = e.clientX; lp = setTimeout(() => { dragging = true; cell.setPointerCapture(e.pointerId); cell.classList.add('drag'); haptic(); }, 380); });
    cell.addEventListener('pointermove', (e) => { if (!dragging) { if (Math.abs(e.clientX - startX) > 8) clearTimeout(lp); return; } cell.style.transform = `translateX(${e.clientX - startX}px)`; });
    const end = (e) => {
      clearTimeout(lp);
      if (dragging) { dragging = false; cell.classList.remove('drag'); cell.style.transform = ''; const to = Math.max(0, Math.min(n() - 1, i + Math.round((e.clientX - startX) / P.cell))); moveFrame(i, to); return; }
      if (e.type === 'pointercancel' || Math.abs(e.clientX - startX) > 8) return;
      stopPlay(); P.layer = L.id; if (P.sel) P.sel[1] = i; P.cur = i; render(p);
    };
    cell.addEventListener('pointerup', end); cell.addEventListener('pointercancel', end);
  }
  function renderTools(p) {
    const tb = (ic, label, fn) => h('button.studio-tool', { on: { click: fn } }, icon(ic, 's'), label);
    p.tools.replaceChildren(tb('brush', '繪製', drawFrame), tb('plus', '空白格', () => op('blank')), tb('copy', '複製格', () => op('dup')), tb('trash', '刪除', () => op('del')),
      tb('upload', '匯入影格', () => importFrames(false)), tb('refresh', '替換', () => importFrames(true)), tb('clock', '時長', setDur), tb('back', '左移', () => op('left')), tb('next', '右移', () => op('right')),
      tb('rotate', '反轉', () => op('rev')), tb('layers', '複製區間', () => op('copy')), tb('download', '貼上', () => op('paste')));
  }

  // ---------------- side panel (mode-specific) ----------------
  function renderPanel(p) {
    const d = P.doc, box = p.panel; box.replaceChildren();
    if (P.mode === 'preview') {
      box.append(h('div.card', null,
        h('div.hstack', null, h('span.grow', null, '洋蔥皮（紅＝前、綠＝後）'), toggle(P.onion.on, (v) => { P.onion.on = v; drawPreview(); })),
        h('div', { style: { marginTop: '6px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '顯示前面幾格'), seg([['1', '1'], ['2', '2'], ['3', '3']], String(P.onion.prev), (v) => { P.onion.prev = +v; drawPreview(); })),
        h('div', { style: { marginTop: '6px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '顯示後面幾格'), seg([['0', '0'], ['1', '1'], ['2', '2']], String(P.onion.next), (v) => { P.onion.next = +v; drawPreview(); })),
        h('div.hstack', { style: { marginTop: '6px' } }, h('span.grow', null, '角色大小參考'), toggle(P.ghost, (v) => { P.ghost = v; drawPreview(); })),
        h('div.hstack', { style: { marginTop: '6px' } }, h('span.grow', null, '預覽鏡像（看另一側）'), toggle(P.mirror, (v) => { P.mirror = v; drawPreview(); })),
        h('div.hstack', { style: { marginTop: '6px' } }, h('span.grow', null, '設定腳底錨點（點預覽）'), toggle(P.anchorMode, (v) => { P.anchorMode = v; drawPreview(); }), h('button.btn.s', { on: autoAnchor.bind ? { click: autoAnchor } : {} }, '自動'))));
    }
    if (P.mode === 'timeline') {
      const L = layerOf(P.layer);
      box.append(h('div.card', null, h('div.hstack', null, h('b.grow', null, `圖層（${d.layers.length}）`), h('button.btn.s', { on: { click: () => { if (d.layers.length >= 6) { toast('最多 6 個圖層', 'info'); return; } edit((x) => x.layers.push({ id: A().uid('ly'), name: `圖層 ${x.layers.length + 1}`, visible: true, opacity: 1, cells: Array(n()).fill(null) })); P.layer = d.layers[d.layers.length - 1].id; } } }, icon('plus', 's'), '新增圖層')),
        h('div.muted', { style: { fontSize: 'var(--fs-xs)', margin: '4px 0' } }, '例如：身體、眼睛、尾巴各放一層，分別繪製或匯入，播放時自動合成。'),
        h('div.field', { style: { height: '42px' } }, h('input', { value: L.name, maxLength: 12, on: { change: (e) => edit(() => { L.name = e.target.value; }) } })),
        OC.UI.slider({ zh: '透明度' }, L.opacity, (v, live) => { L.opacity = v; d.updated = Date.now(); drawPreview(); if (!live) { P.hist.commit(); afterEdit(); } }, { min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` }),
        h('div.hstack', { style: { flexWrap: 'wrap' } }, h('button.btn.s', { on: { click: () => edit(() => { L.visible = !L.visible; }) } }, icon('eye', 's'), L.visible ? '隱藏' : '顯示'),
          h('button.btn.s', { on: { click: () => { const i = d.layers.indexOf(L); if (i < d.layers.length - 1) edit((x) => { x.layers.splice(i, 1); x.layers.splice(i + 1, 0, L); }); } } }, '上移'),
          h('button.btn.s', { on: { click: () => { const i = d.layers.indexOf(L); if (i > 0) edit((x) => { x.layers.splice(i, 1); x.layers.splice(i - 1, 0, L); }); } } }, '下移'),
          h('button.btn.s', { style: { color: 'var(--danger)' }, on: { click: () => { if (d.layers.length <= 1) { toast('至少保留一個圖層', 'info'); return; } edit((x) => { x.layers = x.layers.filter((l) => l !== L); }); P.layer = d.layers[0].id; } } }, icon('trash', 's'), '刪除圖層'))));
    }
    if (P.mode === 'settings') {
      const c = Ch().get(P.charId);
      const field = (label, el) => h('div', { style: { marginTop: '10px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)', marginBottom: '4px' } }, label), el);
      const actions = Ch().ACTIONS.map((a) => [a[0], a[1]]);
      const customAct = h('input', { value: actions.some((a) => a[0] === d.action) ? '' : d.action, maxLength: 16, placeholder: '或輸入自訂動作名稱', on: { change: (e) => { const v = e.target.value.trim(); if (v) edit((x) => { x.action = v; x.category = 'custom'; }); } } });
      const ev = h('div');
      const renderEv = () => ev.replaceChildren(...(d.events || []).map((e, i) => h('div.row', { style: { marginTop: '4px' } }, h('div.grow', null, `第 ${e.frame + 1} 格・${{ sound: '音效', particle: '粒子', emote: '表情', bubble: '對話氣泡', use: '使用物件', done: '完成通知', custom: '自訂' }[e.type]}`, h('div.sub', null, e.data || '')), h('button.icon-btn', { 'aria-label': '刪除事件', on: { click: () => edit((x) => x.events.splice(i, 1)) } }, icon('trash', 's')))));
      renderEv();
      let evType = 'emote'; const evData = h('input', { maxLength: 30, placeholder: '內容（例如 ♥、sparkle、喝水）' });
      box.append(h('div.card', null,
        field('動作名稱', h('div.field', { style: { height: '44px' } }, h('input', { value: d.name, maxLength: 16, on: { change: (e) => edit((x) => { x.name = e.target.value.trim() || '動作'; }) } }))),
        field('對應動作', h('select.field', { style: { width: '100%' }, on: { change: (e) => edit((x) => { x.action = e.target.value; x.category = e.target.value === 'blink' ? 'overlay' : 'base'; }) } }, ...actions.map(([k, zh]) => h('option', { value: k, selected: d.action === k }, zh)), actions.some((a) => a[0] === d.action) ? null : h('option', { value: d.action, selected: true }, d.action))),
        h('div.field', { style: { marginTop: '6px', height: '44px' } }, customAct),
        field('類別', seg([['base', '主要'], ['overlay', '疊加'], ['emote', '表情'], ['custom', '自訂']], d.category, (v) => edit((x) => { x.category = v; }))),
        field('方向', seg([['any', '全方向'], ['front', '前'], ['back', '後'], ['left', '左'], ['right', '右']], d.dir, (v) => edit((x) => { x.dir = v; }))),
        field('播放方式', seg([['loop', '循環'], ['once', '一次'], ['pingpong', '來回']], d.loop, (v) => edit((x) => { x.loop = v; }))),
        OC.UI.slider({ zh: '循環次數（0＝無限）' }, d.repeat || 0, (v, live) => { if (!live) edit((x) => { x.repeat = v; }); }, { min: 0, max: 10, step: 1 }),
        OC.UI.slider({ zh: 'FPS' }, d.fps, (v, live) => { d.fps = v; d.updated = Date.now(); if (!live) { P.hist.commit(); afterEdit(); } }, { min: 1, max: 30, step: 1 }),
        OC.UI.slider({ zh: '播放優先級' }, d.priority, (v, live) => { if (!live) edit((x) => { x.priority = v; }); }, { min: 0, max: 10, step: 1 }),
        h('div.hstack', { style: { marginTop: '6px' } }, h('span.grow', null, '可以被打斷'), toggle(d.interruptible, (v) => edit((x) => { x.interruptible = v; }))),
        d.category === 'overlay' ? h('div.hstack', { style: { marginTop: '6px' } }, h('span.grow', null, '睡覺時不疊加（閉眼狀態）'), toggle((d.overlay.suppressIn || []).includes('sleep'), (v) => edit((x) => { x.overlay.suppressIn = v ? ['sleep'] : []; }))) : null,
        field('觸發條件', seg([['always', '隨時'], ['day', '白天'], ['night', '夜晚'], ['rain', '下雨']], d.conditions.when || 'always', (v) => edit((x) => { x.conditions.when = v; }))),
        h('div.hstack', { style: { marginTop: '10px' } }, h('span.muted', null, '錨點'), h('span.num', null, `(${(d.anchor || {}).x ?? '-'}, ${(d.anchor || {}).y ?? '-'})`), h('span.spacer'), h('button.btn.s', { on: { click: autoAnchor } }, '自動偵測')),
        OC.UI.slider({ zh: '位移 X' }, d.offset.x, (v, live) => { if (!live) edit((x) => { x.offset.x = v; }); }, { min: -60, max: 60, step: 1 }),
        OC.UI.slider({ zh: '位移 Y' }, d.offset.y, (v, live) => { if (!live) edit((x) => { x.offset.y = v; }); }, { min: -60, max: 60, step: 1 }),
        h('div.muted', { style: { fontSize: 'var(--fs-xs)' } }, `碰撞區域：${d.hitbox ? `${d.hitbox.w}×${d.hitbox.h}` : '未設定（按「自動偵測」）'}・畫布 ${d.w}×${d.h}px`)),
        h('div.card', { style: { marginTop: '10px' } }, h('b', null, '動畫事件'), h('div.muted', { style: { fontSize: 'var(--fs-xs)' } }, `在第 ${P.cur + 1} 格觸發，播放時會顯示，之後提供給生活模擬使用。`), ev,
          h('div', { style: { marginTop: '8px' } }, seg([['emote', '表情'], ['bubble', '氣泡'], ['particle', '粒子'], ['sound', '音效'], ['use', '物件'], ['done', '完成']], evType, (v) => (evType = v))),
          h('div.hstack', { style: { marginTop: '6px' } }, h('div.field', { style: { flex: 1, height: '44px' } }, evData), h('button.btn.s', { on: { click: () => { edit((x) => { x.events = x.events || []; x.events.push({ frame: P.cur, type: evType, data: evData.value.trim() }); }); evData.value = ''; } } }, icon('plus', 's'), '加入'))),
        c ? h('div.card', { style: { marginTop: '10px' } }, h('b', null, `套用到 ${c.profile.name}`), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, c.actions[d.action] && Object.values(c.actions[d.action]).includes(d.id) ? `已用於「${Ch().ACTION_ZH[d.action] || d.action}」` : '儲存時可選擇套用'),
          h('div.hstack', { style: { marginTop: '8px', flexWrap: 'wrap' } },
            h('button.btn.s', { on: { click: async () => { if (await save(true)) { A().assign(c, d.action, d.dir, d.id); toast('已套用', 'check'); render(OC.Pages.pages.studio); } } } }, '儲存並套用'),
            c.actions[d.action] && Object.values(c.actions[d.action]).includes(d.id) ? h('button.btn.s', { on: { click: () => { A().assign(c, d.action, d.dir, null); toast('已取消套用', 'info'); render(OC.Pages.pages.studio); } } }, '取消套用') : null,
            h('button.btn.s', { on: async () => 0 }, ''))) : null,
        h('div.card', { style: { marginTop: '10px' } }, h('b', null, '匯出'), h('div.hstack', { style: { marginTop: '8px', flexWrap: 'wrap' } },
          h('button.btn.s', { on: { click: async () => { if (P.dirty && !(await save(true))) return; const blob = await OC.IO.exportPack({ anims: [d.id], kind: 'animation' }); await OC.IO.deliver(blob, `${d.name}.ocpack`); } } }, icon('download', 's'), '動作包 .ocpack'),
          h('button.btn.s', { on: { click: async () => { await A().preload(d); await OC.IO.deliver(await OC.IO.sheetOf(d), `${d.name}-sheet.png`); } } }, icon('image', 's'), 'Sprite Sheet PNG'))));
      box.querySelectorAll('button.btn.s').forEach((b) => { if (!b.textContent) b.remove(); });
    }
  }
  OC.Studio = { open, addFrameAsset, get state() { return P; }, save, op, importFrames };
})();
