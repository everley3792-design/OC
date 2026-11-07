/* OC Shimeji — shared creation-UI components: colour wheel picker, labelled sliders,
 * tag-list editor, undo/redo history. Token-only styling (works in light & dark).
 */
(function () {
  'use strict';
  const { h, icon, sheet, haptic } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store;

  // ---------- colour maths ----------
  function hex2rgb(hx) { const n = parseInt(hx.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb2hex(r, g, b) { return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase(); }
  function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let hh = 0; if (d) { if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; } return [hh, mx ? d / mx : 0, mx]; }
  function hsv2rgb(hh, s, v) { const c = v * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = v - c; const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
  const validHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v);
  function pal() { const s = S(); s.palette = s.palette || { recent: [], favorites: [], custom: [] }; return s.palette; }
  function remember(hx) { const p = pal(); p.recent = [hx, ...p.recent.filter((c) => c !== hx)].slice(0, 12); St.touch(); }
  const BASE = ['#FFFFFF', '#FFF7EC', '#F6E3C8', '#E7A86A', '#C98E62', '#8E6A54', '#3B2B25', '#6F6A7E', '#B9B8F0', '#9B7BE0', '#F48FB1', '#F26B5B', '#FF9A3C', '#FFC93C', '#6CCB5F', '#3FC1B0', '#5BC0EB', '#556080'];

  /** colour wheel picker sheet → Promise<hex|null>; onLive(hex) fires while dragging */
  function pickColor(title, value, onLive) {
    return new Promise((done) => {
      let [hh, ss, vv] = rgb2hsv(...hex2rgb(validHex(value) ? value : '#FFFFFF')), cur = validHex(value) ? value.toUpperCase() : '#FFFFFF', result = null;
      sheet(title || '選擇顏色', (b, api) => {
        const N = 260, cv = h('canvas', { width: N * 2, height: N * 2, 'aria-label': '色環' }); Object.assign(cv.style, { width: N + 'px', height: N + 'px', touchAction: 'none', display: 'block', margin: '0 auto' });
        const x = cv.getContext('2d'); x.scale(2, 2);
        const R0 = 128, R1 = 104, C = N / 2, sq = R1 * 1.25, sq0 = C - sq / 2;
        const ring = (() => { const k = OC.makeCanvas(N * 2, N * 2), y = k.getContext('2d'); y.scale(2, 2); const g = y.createConicGradient ? y.createConicGradient(0, C, C) : null; if (g) { for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, rgb2hex(...hsv2rgb((i * 30) % 360, 1, 1))); y.fillStyle = g; } else { y.fillStyle = '#ccc'; } y.beginPath(); y.arc(C, C, R0, 0, Math.PI * 2); y.arc(C, C, R1, 0, Math.PI * 2, true); y.fill(); return k; })();
        const sw = h('div', { style: { width: '44px', height: '44px', borderRadius: '14px', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.5), var(--shadow-1)' } });
        const hexIn = h('input', { value: cur, maxLength: 7, 'aria-label': 'HEX 色碼', style: { fontFamily: 'var(--font-num)', textTransform: 'uppercase' }, on: { change: (e) => { let v = e.target.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (validHex(v)) setHex(v.toUpperCase()); else e.target.value = cur; } } });
        const fav = h('button.icon-btn', { 'aria-label': '收藏', on: { click: () => { const p = pal(); p.favorites = p.favorites.includes(cur) ? p.favorites.filter((c) => c !== cur) : [cur, ...p.favorites].slice(0, 18); St.touch(); rows(); syncFav(); haptic(); } } }, icon('star'));
        const syncFav = () => { fav.style.color = pal().favorites.includes(cur) ? 'var(--sun)' : ''; };
        const recentRow = h('div.swatches'), favRow = h('div.swatches'), baseRow = h('div.swatches'), customRow = h('div.swatches');
        const chip = (c) => h('button.swatch', { 'aria-label': c, style: { '--c': c, width: '32px', height: '32px' }, on: { click: () => { setHex(c); haptic(); } } });
        function rows() { const p = pal(); recentRow.replaceChildren(...(p.recent.length ? p.recent.map(chip) : [h('span.faint', null, '還沒有')])); favRow.replaceChildren(...(p.favorites.length ? p.favorites.map(chip) : [h('span.faint', null, '按 ★ 收藏目前顏色')])); customRow.replaceChildren(...p.custom.map(chip), h('button.btn.s', { on: { click: () => { const q = pal(); if (!q.custom.includes(cur)) q.custom.push(cur); q.custom = q.custom.slice(-18); St.touch(); rows(); } } }, icon('plus', 's'), '加入調色盤')); baseRow.replaceChildren(...BASE.map(chip)); }
        function render() {
          x.clearRect(0, 0, N, N); x.drawImage(ring, 0, 0, N, N);
          x.fillStyle = rgb2hex(...hsv2rgb(hh, 1, 1)); x.fillRect(sq0, sq0, sq, sq);
          let g = x.createLinearGradient(sq0, 0, sq0 + sq, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(sq0, sq0, sq, sq);
          g = x.createLinearGradient(0, sq0, 0, sq0 + sq); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(sq0, sq0, sq, sq);
          const a = (hh * Math.PI) / 180, rr = (R0 + R1) / 2; mark(C + Math.cos(a) * rr, C + Math.sin(a) * rr); mark(sq0 + ss * sq, sq0 + (1 - vv) * sq);
          sw.style.background = cur; hexIn.value = cur; syncFav();
        }
        function mark(px, py) { x.beginPath(); x.arc(px, py, 9, 0, Math.PI * 2); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); x.lineWidth = 1; x.strokeStyle = 'rgba(0,0,0,.35)'; x.stroke(); }
        function setHex(v) { cur = v; [hh, ss, vv] = rgb2hsv(...hex2rgb(v)); render(); onLive && onLive(cur); }
        let mode = null;
        const at = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * N, ((e.clientY - r.top) / r.height) * N]; };
        const apply = (e) => { const [px, py] = at(e); if (mode === 'ring') { hh = (Math.atan2(py - C, px - C) * 180) / Math.PI; if (hh < 0) hh += 360; } else { ss = Math.max(0, Math.min(1, (px - sq0) / sq)); vv = Math.max(0, Math.min(1, 1 - (py - sq0) / sq)); } cur = rgb2hex(...hsv2rgb(hh, ss, vv)); render(); onLive && onLive(cur); };
        cv.addEventListener('pointerdown', (e) => { const [px, py] = at(e), d = Math.hypot(px - C, py - C); mode = d > R1 - 4 && d < R0 + 8 ? 'ring' : px > sq0 - 6 && px < sq0 + sq + 6 && py > sq0 - 6 && py < sq0 + sq + 6 ? 'sv' : null; if (!mode) return; cv.setPointerCapture(e.pointerId); apply(e); });
        cv.addEventListener('pointermove', (e) => { if (mode) apply(e); });
        cv.addEventListener('pointerup', () => (mode = null)); cv.addEventListener('pointercancel', () => (mode = null));
        const lab = (t) => h('div.muted', { style: { fontSize: 'var(--fs-s)', margin: '12px 0 6px' } }, t);
        b.append(cv, h('div.hstack', { style: { marginTop: '10px' } }, sw, h('div.field', { style: { flex: 1 } }, hexIn), fav),
          lab('最近使用'), recentRow, lab('收藏'), favRow, lab('基本色'), baseRow, lab('我的調色盤'), customRow,
          h('button.btn.primary.block', { style: { marginTop: '16px' }, on: { click: () => { result = cur; api.close(); } } }, icon('check', 's'), '使用這個顏色'));
        rows(); render();
      }, { onClose: () => { if (result) remember(result); done(result); } });
    });
  }
  /** compact colour field: swatch + hex, opens the wheel */
  function colorField(label, value, onChange) {
    const sw = h('span', { style: { width: '30px', height: '30px', borderRadius: '50%', background: value, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.6), var(--shadow-1)', flex: 'none' } });
    const hx = h('span.num.muted', { style: { fontSize: 'var(--fs-s)' } }, value);
    const el = h('button.row.tap', { style: { width: '100%', minHeight: '52px' }, 'aria-label': label, on: { click: async () => { const old = el.value; const v = await pickColor(label, el.value, (c) => { set(c); onChange(c, true); }); if (v) { set(v); onChange(v); } else { set(old); onChange(old, true); } } } }, sw, h('div.grow', { style: { textAlign: 'left' } }, label), hx);
    const set = (v) => { el.value = v; sw.style.background = v; hx.textContent = v; };
    set(value); el.set = set; return el;
  }
  /** slider with end labels */
  function slider(def, value, onChange, o = {}) {
    const val = h('span.num', { style: { minWidth: '34px', textAlign: 'right', fontSize: 'var(--fs-s)' } }, Math.round(value));
    const inp = h('input', { type: 'range', min: o.min ?? 0, max: o.max ?? 100, step: o.step ?? 1, value, 'aria-label': def.zh, on: { input: (e) => { val.textContent = o.fmt ? o.fmt(+e.target.value) : Math.round(+e.target.value * 100) / 100; onChange(+e.target.value, true); }, change: (e) => onChange(+e.target.value, false) } });
    if (o.fmt) val.textContent = o.fmt(value);
    return h('div', { style: { margin: '8px 0' } }, h('div.hstack', null, h('b.grow', { style: { fontSize: 'var(--fs-m)' } }, def.zh), val), inp, def.lo ? h('div.hstack', { style: { fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' } }, h('span.grow', null, def.lo), h('span', null, def.hi)) : null);
  }
  /** editable list of short strings (likes, hobbies, habits…) */
  function tagList(items, onChange, placeholder = '新增…') {
    const wrap = h('div'), chips = h('div.hstack', { style: { flexWrap: 'wrap', gap: '6px', marginBottom: '8px' } });
    const inp = h('input', { placeholder, maxLength: 16, 'aria-label': placeholder, on: { keydown: (e) => { if (e.key === 'Enter') addIt(); } } });
    const addIt = () => { const v = inp.value.trim(); if (!v || items.includes(v)) return; items.push(v); inp.value = ''; render(); onChange(items); haptic(); };
    const render = () => chips.replaceChildren(...items.map((t, i) => h('span.tag.accent', { style: { fontSize: 'var(--fs-s)', padding: '5px 6px 5px 12px' } }, t, h('button', { 'aria-label': `移除 ${t}`, style: { width: '24px', height: '24px', display: 'grid', placeItems: 'center', color: 'inherit' }, on: { click: () => { items.splice(i, 1); render(); onChange(items); } } }, icon('close', 's')))), items.length ? null : h('span.faint', { style: { fontSize: 'var(--fs-s)' } }, '（可略過）'));
    render(); wrap.append(chips, h('div.hstack', null, h('div.field', { style: { flex: 1, height: '46px' } }, inp), h('button.btn.s', { on: { click: addIt } }, icon('plus', 's'), '加入')));
    return wrap;
  }
  /** snapshot-based undo / redo */
  function history(get, set, limit = 60) {
    const past = [], future = []; let last = JSON.stringify(get());
    return {
      commit() { const now = JSON.stringify(get()); if (now === last) return; past.push(last); if (past.length > limit) past.shift(); future.length = 0; last = now; },
      undo() { if (!past.length) return false; future.push(last); last = past.pop(); set(JSON.parse(last)); return true; },
      redo() { if (!future.length) return false; past.push(last); last = future.pop(); set(JSON.parse(last)); return true; },
      reset() { past.length = 0; future.length = 0; last = JSON.stringify(get()); },
      get canUndo() { return past.length > 0; }, get canRedo() { return future.length > 0; }, get dirty() { return past.length > 0; },
    };
  }
  /** confirm leaving with unsaved changes */
  function guardLeave(isDirty) { return isDirty() ? OC.UI.confirm('還沒儲存', '離開後這次的修改會遺失，確定要離開嗎？', '不儲存，離開', true) : Promise.resolve(true); }

  Object.assign(OC.UI, { pickColor, colorField, slider, tagList, history, guardLeave, hex2rgb, rgb2hex, rgb2hsv, hsv2rgb });
})();
