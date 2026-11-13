/* OC Shimeji — 15.4 「設計亭」 the design kiosk: draw a 12×12 pattern, see it on a character's shirt while you draw, save it,
 * and dress a character in it. A design is tiny data (144 palette indexes), so it lives in the save (S().designs), not in IndexedDB.
 * Wearing it sets the character's look.pattern to 'design:<id>' (the rig draws it, clipped to the shirt); the character data is still
 * the one copy in save.chars, edited through Chars.update. Editing tools have undo / redo, an autosaved draft and a leave prompt.
 * The palette is our own. */
(function () {
  'use strict';
  const { h, icon, toast, haptic } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, Ch = () => OC.Chars;
  const N = 12, PAL = ['', '#FFFFFF', '#F26B5B', '#F7C83F', '#7CC66A', '#38AFC4', '#A58BE0', '#F29AB4', '#6B5440'];
  const blank = () => '0'.repeat(N * N);
  const D = () => (S().designs = S().designs || {});
  const canvasCache = {};

  /** an offscreen canvas of a design (cached by id + data) — the rig draws it on the shirt */
  function canvasOf(id) {
    const d = D()[id]; if (!d) return null; const k = id + ':' + d.px;
    if (canvasCache[id] && canvasCache[id].k === k) return canvasCache[id].cv;
    const cv = OC.makeCanvas(N, N), x = cv.getContext('2d');
    for (let i = 0; i < N * N; i++) { const c = PAL[+d.px[i]]; if (!c) continue; x.fillStyle = c; x.fillRect(i % N, Math.floor(i / N), 1, 1); }
    canvasCache[id] = { k, cv }; return cv;
  }
  /** draw a design onto the shirt (called by the rig inside the shirt's clip) */
  function drawOnShirt(ctx, id, cx, cy, w, hgt) {
    const cv = canvasOf(id); if (!cv) return;
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 0.95;
    ctx.drawImage(cv, cx - w / 2, cy - hgt / 2, w, hgt); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = sm;
  }

  function open(o = {}) {
    const ids = Object.keys(D());
    let cur = o.id && D()[o.id] ? { id: o.id, name: D()[o.id].name, px: D()[o.id].px } : (S().designDraft ? Object.assign({}, S().designDraft) : { id: null, name: '', px: blank() });
    let color = 3, tool = 'pen', hist = [cur.px], hi = 0, dirty = !!(S().designDraft && !o.id), who = Ch().active();
    const el = h('div.onb.design', { role: 'dialog', 'aria-label': '設計亭' });
    const stage = OC.CharEdit.stage(() => preview(), { size: 220 });
    const grid = h('div.dz-grid', { role: 'grid', 'aria-label': '圖樣（12×12）' });
    const cells = []; for (let i = 0; i < N * N; i++) { const b = h('span.dz-cell', { 'data-i': i }); cells.push(b); grid.append(b); }
    const pal = h('div.dz-pal', null, ...PAL.map((c, i) => h('button.dz-sw' + (i === color ? '.on' : ''), { 'aria-label': i ? c : '透明', style: { '--c': c || 'transparent' }, 'data-i': i, on: { click: () => { color = i; tool = i ? 'pen' : 'erase'; paint(); } } })));
    const tools = h('div.hstack.dz-tools', null,
      h('button.btn.s', { 'data-t': 'pen', on: { click: () => { tool = 'pen'; paint(); } } }, icon('edit', 's'), '筆'),
      h('button.btn.s', { 'data-t': 'fill', on: { click: () => { tool = 'fill'; paint(); } } }, icon('sparkle', 's'), '填滿'),
      h('button.icon-btn', { 'aria-label': '復原', on: { click: () => undo() } }, icon('undo')), h('button.icon-btn', { 'aria-label': '重做', on: { click: () => redo() } }, icon('redo')),
      h('button.btn.s.ghost', { on: { click: () => set(blank(), true) } }, '清空'));
    const name = h('input.input', { placeholder: '圖樣的名字', maxlength: 12, value: cur.name || '', on: { input: () => { cur.name = name.value; draft(); } } });
    const whoSel = h('div.chips.scroll', null, ...Ch().all().map((c) => h('button.chip-btn' + (c.id === who.id ? '.on' : ''), { 'data-id': c.id, on: { click: (e) => { who = c; [...whoSel.children].forEach((b) => b.classList.toggle('on', b.dataset.id === c.id)); stage.restart(); } } }, Ch().name(c))));
    const saved = h('div.dz-saved');
    el.append(h('div.hstack', null, h('button.icon-btn', { 'aria-label': '離開', on: { click: () => leave() } }, icon('back')), h('h2.grow', { style: { margin: 0, fontSize: 'var(--fs-xl)' } }, '設計亭')),
      h('div.dz-top', null, stage.el, h('div.vstack', { style: { gap: '6px', minWidth: 0 } }, h('small.muted', null, '試穿的角色'), whoSel)),
      grid, pal, tools, name,
      h('div.hstack', { style: { gap: '8px' } }, h('button.btn.block', { on: { click: () => save() } }, icon('check', 's'), '儲存圖樣'), h('button.btn.primary.block', { on: { click: () => wear() } }, icon('shirt', 's'), `穿上`)),
      h('div.section-title', null, '我的圖樣'), saved);
    Object.assign(el.style, { padding: 'calc(var(--sat) + 10px) 16px calc(var(--sab) + 16px)', gap: '10px', overflowY: 'auto' });
    document.getElementById('app').append(el);
    const layer = { scrim: false, close: () => leave(true) }; OC.UI.pushLayer(layer);   /* closed from outside (system back, changing tab): no question — the draft is kept anyway. Asking here would loop: a closer that keeps closing the top layer would close the question and ask again forever */

    /* drawing with a finger: down paints, moving across cells keeps painting (pen); fill floods once */
    let down = false;
    /* the cell under a finger, from the grid's own box (not elementFromPoint, which is unreliable while the pointer is captured) */
    const at = (e) => { const a = cells[0].getBoundingClientRect(), b = cells[N * N - 1].getBoundingClientRect(), cw = (b.right - a.left) / N, ch = (b.bottom - a.top) / N; const x = Math.floor((e.clientX - a.left) / cw), y = Math.floor((e.clientY - a.top) / ch); return x >= 0 && x < N && y >= 0 && y < N ? y * N + x : -1; };
    let last = -1;
    /* slow frames merge pointer moves: paint every cell on the straight line from the last one so a quick stroke has no gaps */
    const line = (a, b) => { const out = []; let x0 = a % N, y0 = Math.floor(a / N); const x1 = b % N, y1 = Math.floor(b / N), dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy; for (;;) { out.push(y0 * N + x0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } return out; };
    grid.addEventListener('pointerdown', (e) => { e.preventDefault(); try { grid.setPointerCapture(e.pointerId); } catch (err) { /* gone */ } down = true; const i = at(e); last = i; if (i >= 0) hit(i, true); });
    grid.addEventListener('pointermove', (e) => { if (!down || tool === 'fill') return; const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; for (const ev of evs.length ? evs : [e]) { const i = at(ev); if (i < 0) continue; for (const k of last >= 0 ? line(last, i) : [i]) hit(k, false); last = i; } });
    const up = () => { if (down) { down = false; last = -1; commit(); } }; grid.addEventListener('pointerup', up); grid.addEventListener('pointercancel', up);
    function hit(i, first) {
      const v = tool === 'erase' ? 0 : color; let px = cur.px;
      if (tool === 'fill') { if (!first) return; px = flood(px, i, v); } else px = px.slice(0, i) + v + px.slice(i + 1);
      if (px !== cur.px) { cur.px = px; dirty = true; paintCell(i, px); later(); }
    }
    function flood(px, i, v) { const a = px.split(''), from = a[i], to = String(v); if (from === to) return px; const st = [i]; while (st.length) { const k = st.pop(); if (a[k] !== from) continue; a[k] = to; const x = k % N, y = Math.floor(k / N); if (x > 0) st.push(k - 1); if (x < N - 1) st.push(k + 1); if (y > 0) st.push(k - N); if (y < N - 1) st.push(k + N); } return a.join(''); }
    let raf = 0;
    function later() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; paint(); stage.restart(); }); }
    function paintCell(i, px) { if (tool === 'fill') return; const v = +px[i]; cells[i].style.background = PAL[v] || ''; cells[i].classList.toggle('dz-none', !v); }
    function commit() { if (hist[hi] === cur.px) return; hist = hist.slice(0, hi + 1); hist.push(cur.px); if (hist.length > 60) hist.shift(); hi = hist.length - 1; draft(); }
    function set(px, rec) { cur.px = px; dirty = true; if (rec) commit(); paint(); stage.restart(); }
    function undo() { if (hi <= 0) return; hi--; cur.px = hist[hi]; dirty = true; draft(); paint(); stage.restart(); }
    function redo() { if (hi >= hist.length - 1) return; hi++; cur.px = hist[hi]; dirty = true; draft(); paint(); stage.restart(); }
    function draft() { S().designDraft = { id: cur.id, name: cur.name, px: cur.px }; St.touch('designs'); }
    /* the preview: the chosen character, on a copy, wearing the design (a shirt colour is lent when it wears none) */
    const TMP = '__draft';
    function preview() { D()[TMP] = { name: '', px: cur.px }; const c = who || Ch().active(); return Object.assign({}, c, { look: Object.assign({}, c.look, { pattern: 'design:' + TMP, shirt: c.look.shirt && c.look.shirt !== 'none' ? c.look.shirt : '#FFF7EC' }) }); }
    function paint() {
      for (let i = 0; i < N * N; i++) { const v = +cur.px[i]; cells[i].style.background = PAL[v] || ''; cells[i].classList.toggle('dz-none', !v); }
      [...pal.children].forEach((b) => b.classList.toggle('on', +b.dataset.i === (tool === 'erase' ? 0 : color)));
      [...tools.querySelectorAll('[data-t]')].forEach((b) => b.classList.toggle('primary', b.dataset.t === tool));
      saved.replaceChildren(...Object.entries(D()).filter(([k]) => k !== TMP).map(([k, d]) => { const cv = canvasOf(k), im = h('canvas', { width: 48, height: 48 }); const x = im.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#FFF7EC'; x.fillRect(0, 0, 48, 48); if (cv) x.drawImage(cv, 0, 0, 48, 48);
        return h('button.dz-item' + (k === cur.id ? '.on' : ''), { on: { click: () => { if (dirty && cur.px !== (D()[cur.id] || {}).px) { toast('先儲存目前的圖樣', 'info'); return; } cur = { id: k, name: d.name, px: d.px }; name.value = d.name; hist = [cur.px]; hi = 0; dirty = false; paint(); stage.restart(); } } }, im, h('small', null, d.name || '未命名')); }));
      if (!saved.children.length) saved.append(h('div.faint', { style: { fontSize: 'var(--fs-s)' } }, '還沒有圖樣。畫好之後按「儲存圖樣」。'));
    }
    function save() {
      if (!/[1-9]/.test(cur.px)) { toast('先畫一點東西', 'info'); return null; }
      const id = cur.id || 'dz' + Date.now().toString(36); D()[id] = { name: (cur.name || '').trim() || `圖樣 ${Object.keys(D()).filter((k) => k !== TMP).length + 1}`, px: cur.px, at: Date.now() };
      cur.id = id; cur.name = D()[id].name; name.value = cur.name; dirty = false; delete S().designDraft; St.touch('designs'); St.persist && St.persist();
      if (OC.Progress) OC.Progress.emit('design', { id }); haptic(); toast(`儲存了「${cur.name}」`, 'check'); paint(); return id;
    }
    function wear() {
      const id = save(); if (!id || !who) return;
      { const c = Ch().get(who.id); c.look.pattern = 'design:' + id; if (!c.look.shirt || c.look.shirt === 'none') c.look.shirt = '#FFF7EC'; Ch().save(c); who = c; }
      if (OC.Progress) OC.Progress.emit('wear', { oc: who.id, design: id }); toast(`${Ch().name(who)}穿上了「${D()[id].name}」`, 'shirt');
    }
    async function leave(quiet) {
      if (!open_) return;
      if (!quiet && dirty && /[1-9]/.test(cur.px) && cur.px !== (D()[cur.id] || {}).px) { const ok = await OC.UI.confirm('離開設計亭', '這個圖樣還沒儲存。草稿會留著，下次打開會回來。', '離開', false); if (!ok) return; }
      delete D()[TMP]; OC.UI.popLayer(layer); el.style.opacity = 0; setTimeout(() => el.remove(), 260); open_ = null;
    }
    paint(); open_ = { el, get state() { return { px: cur.px, id: cur.id, hi, len: hist.length, dirty }; } };
    void ids;
  }
  let open_ = null;
  OC.Design = { open, canvasOf, drawOnShirt, PAL, N, get open_() { return open_; } };
})();
