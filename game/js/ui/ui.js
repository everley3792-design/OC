/* OC Shimeji — UI toolkit: tiny DOM builder, line-icon set, sheets, toasts, dialogs and the
 * page stack. Components only use Design Tokens (css/tokens.css). Pages are built once and
 * patched in place (no full re-render on theme change — colours come from CSS variables).
 */
(function () {
  'use strict';
  // conditional children (cond ? node : null) are common in the UI code: never render them as "null"
  for (const P of [Element.prototype, DocumentFragment.prototype]) for (const m of ['append', 'replaceChildren', 'prepend']) { const orig = P[m]; P[m] = function (...k) { return orig.apply(this, k.filter((x) => x != null && x !== false)); }; }
  function h(tag, attrs, ...kids) {
    const [t, ...cls] = tag.split('.'); const el = document.createElement(t || 'div');
    if (cls.length) el.className = cls.join(' ');
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'on') for (const ev of Object.keys(v)) el.addEventListener(ev, v[ev]);
      else if (k === 'style' && typeof v === 'object') { for (const sk of Object.keys(v)) { if (v[sk] == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
      else if (k === 'class') el.className += ' ' + v;
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(3)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  const $ = (s, r = document) => r.querySelector(s);

  // ---- icons (24-grid line icons, original) ----
  const IC = {
    island: '<path d="M3 17c3-1.2 6-1.2 9 0s6 1.2 9 0"/><path d="M6 14c1-4 4-6 7-6"/><path d="M13 8c0-2 1.5-3.5 3.5-3.5M13 8c-1.6-1.6-3.6-1.8-5.2-.8M13 8c2 0 3.8 1 4.6 2.6"/>',
    person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/>',
    brush: '<path d="M18.5 4.5 10 13"/><path d="M10.5 12.5c-4.5-.5-5.5 3.5-6 7 4.5 0 7.5-1.5 7-6z"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m14.8 9.2-1.9 4.1-4.1 1.9 1.9-4.1z"/>',
    more: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
    bag: '<rect x="4.5" y="8" width="15" height="12.5" rx="4.5"/><path d="M8.5 8c0-5.2 7-5.2 7 0M9 13.5c2 1.4 4 1.4 6 0"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.2c0-1.2 1.1-1.8 2.5-1.8s2.5.6 2.5 1.6c0 2.4-5 1.2-5 3.8 0 1 1.1 1.7 2.5 1.7s2.5-.6 2.5-1.8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.8 9.6 4.2 4.2 0 0 0 7 18z"/>',
    rain: '<path d="M7 15h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.8 6.6 4.2 4.2 0 0 0 7 15z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>',
    fog: '<path d="M7 12h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.8 3.6 4.2 4.2 0 0 0 7 12z" transform="translate(0 1)"/><path d="M4 16h16M6 19.5h12"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
    sunrise: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v4M9.5 6.5 12 4l2.5 2.5M4.8 12.2l1.4 1M19.2 12.2l-1.4 1"/>',
    sunset: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v4M9.5 5.5 12 8l2.5-2.5M4.8 12.2l1.4 1M19.2 12.2l-1.4 1"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>', next: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    close: '<path d="M7 7l10 10M17 7 7 17"/>', check: '<path d="M6 12.5l4.2 4L18 7.5"/>', plus: '<path d="M12 6v12M6 12h12"/>', minus: '<path d="M6 12h12"/>',
    play: '<path d="M8.5 6v12l9.5-6z" fill="currentColor" stroke="none"/>', pause: '<path d="M8 6v12M16 6v12"/>',
    heart: '<path d="M12 19.5C2 13 4 4.5 12 8.5c8-4 10 4.5 0 11z"/>', star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    map: '<path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
    trophy: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0z"/><path d="M8 6.5H5a3 3 0 0 0 3 3.5M16 6.5h3a3 3 0 0 1-3 3.5M12 13.5V17M8.5 20h7M10 17h4"/>',
    book: '<path d="M5 5.5A2 2 0 0 1 7 4h11v14H7a2 2 0 0 0-2 2z"/><path d="M5 20V5.5M9 8h6"/>',
    flag: '<path d="M6 21V4M6 4.5h10l-2 3.5 2 3.5H6"/>', cart: '<path d="M3 5h3l2.5 10h9.5l2-7H7"/><circle cx="9.5" cy="18.5" r="1.4"/><circle cx="16.5" cy="18.5" r="1.4"/>',
    shirt: '<path d="M8.5 4.5 4 8l2.5 3.5 1-1v9h9v-9l1 1L20 8l-4.5-3.5c-.8 1.6-2 2.4-3.5 2.4s-2.7-.8-3.5-2.4z"/>',
    sofa: '<path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11"/><path d="M3.5 12.5a1.5 1.5 0 0 1 3 0V14h11v-1.5a1.5 1.5 0 0 1 3 0V18h-17zM6 18v2M18 18v2"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4.5-4.5 3 3 2.5-2.5L19 17"/>',
    film: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4"/>',
    eraser: '<path d="m14 5 5 5-8 8H7l-3-3z"/><path d="M9 10l5 5M11 18h8"/>', undo: '<path d="M9 7 5 11l4 4"/><path d="M5 11h9a5 5 0 0 1 0 10h-2"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>', copy: '<rect x="8" y="8" width="11" height="11" rx="2.5"/><path d="M16 8V6.5A1.5 1.5 0 0 0 14.5 5h-8A1.5 1.5 0 0 0 5 6.5v8A1.5 1.5 0 0 0 6.5 16H8"/>',
    onion: '<circle cx="10" cy="12" r="5.5"/><circle cx="14.5" cy="12" r="5.5" opacity=".45"/>', rotate: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 4.5V8h-3.5"/>',
    move: '<path d="M12 4v16M4 12h16M12 4l-2.5 2.5M12 4l2.5 2.5M12 20l-2.5-2.5M12 20l2.5-2.5M4 12l2.5-2.5M4 12l2.5 2.5M20 12l-2.5-2.5M20 12l-2.5 2.5"/>',
    paw: '<ellipse cx="12" cy="15.5" rx="4.4" ry="3.6"/><circle cx="6.6" cy="10.6" r="1.7"/><circle cx="9.7" cy="6.9" r="1.7"/><circle cx="14.3" cy="6.9" r="1.7"/><circle cx="17.4" cy="10.6" r="1.7"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/>', chev: '<path d="M10 7l5 5-5 5"/>', edit: '<path d="M5 19l1-4L16 5l3 3L9 18z"/><path d="M14 7l3 3"/>',
    sparkle: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>', leaf: '<path d="M5 19C4 9 11 4 20 4.5 20 13 14 20 5 19z"/><path d="M5 19 14 10"/>',
    chat: '<rect x="4" y="5" width="16" height="11.5" rx="5"/><path d="M9 16.5 7.5 20l5-3.5"/>', gift: '<rect x="4.5" y="10" width="15" height="10" rx="2"/><rect x="3.5" y="7" width="17" height="3.5" rx="1.5"/><path d="M12 7v13M12 7c-3-5-7-2 0 0 7-2 3-5 0 0"/>',
    zap: '<path d="M13 3 6 13.5h5L10 21l8-11h-5z"/>', apple: '<path d="M12 8c-6-3-9 3-7 8 1.3 3.2 4 4.6 7 3.2 3 1.4 5.7 0 7-3.2 2-5-1-11-7-8z"/><path d="M12 8c0-2 .8-3.6 2.5-4.5"/>',
    smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14c1.8 2.4 5.2 2.4 7 0M9 9.8v.1M15 9.8v.1"/>', users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c0-3.4 2.5-5.6 5.5-5.6s5.5 2.2 5.5 5.6"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17 13.6c2.2.5 3.5 2.4 3.5 5.4"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>', upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>', refresh: '<path d="M19 12a7 7 0 0 1-12.6 4.2M5 12a7 7 0 0 1 12.6-4.2"/><path d="M18 4v4h-4M6 20v-4h4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    phone: '<rect x="6.5" y="3" width="11" height="18" rx="3"/><path d="M11 17.5h2"/>', layers: '<path d="m12 4.5 8 4.5-8 4.5-8-4.5z"/><path d="m4 13 8 4.5 8-4.5"/>', hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 6.5-6 6.5-2.5 0-4-1.2-5.5-3.6L4 14.3a1.4 1.4 0 0 1 2.3-1.5L8 15"/>',
    walk: '<circle cx="13" cy="5" r="2"/><path d="M12 9l-1.5 5 2.5 2-.5 4M10.5 14 8 19.5M11.5 10 8 12.5M12.3 10.5 16 12.5"/>',
    music: '<path d="M9 17V5.5L18 4v11.5"/><ellipse cx="7" cy="17" rx="2.5" ry="2"/><ellipse cx="16" cy="15.5" rx="2.5" ry="2"/>',
    dice: '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/><circle cx="8.8" cy="8.8" r="1.2" fill="currentColor"/><circle cx="15.2" cy="15.2" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    redo: '<path d="M15 7l4 4-4 4"/><path d="M19 11h-9a5 5 0 0 0 0 10h2"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    home: '<path d="M4.5 11 12 4.5l7.5 6.5M6.5 9.5V19h11V9.5"/><path d="M10 19v-5h4v5"/>', sleep: '<path d="M4 18h16M5 18v-6h14v6M7 12V9.5A1.5 1.5 0 0 1 8.5 8H11v4"/><path d="M14 4.5h3l-3 3h3"/>',
  };
  function icon(name, cls = '') { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic ' + cls); s.setAttribute('aria-hidden', 'true'); s.innerHTML = IC[name] || IC.info; return s; }

  // ---- haptics ----
  /** graded, gentle haptics (Settings › 觸覺回饋 turns all of it off). kind: tick | light (default) | confirm | long | heavy | error
   *  Android: HapticFeedbackConstants through the bridge (respects the system's own touch-feedback setting); web: short vibrate patterns */
  const VIB = { tick: 5, light: 8, confirm: [8, 40, 10], long: 18, heavy: 26, error: [18, 50, 18] };
  function haptic(kind) {
    const s = OC.Store.s; if (!s || !s.settings.haptics) return; kind = typeof kind === 'string' && VIB[kind] ? kind : 'light';
    try { const N = OC.Store.NATIVE; if (N) { if (N.hapticKind) N.hapticKind(kind); else N.haptic(); } else if (navigator.vibrate) navigator.vibrate(VIB[kind]); } catch (e) { /* devices without a vibrator */ }
  }

  // ---- toasts ----
  let toastWrap = null;
  function toast(msg, ic) {
    if (!toastWrap) { toastWrap = h('div.toast-wrap'); toastWrap.setAttribute('aria-live', 'polite'); document.getElementById('app').append(toastWrap); }
    const t = h('div.toast', { role: 'status' }, ic ? (typeof ic === 'string' ? icon(ic, 's') : ic) : null, msg);
    toastWrap.append(t); while (toastWrap.children.length > 3) toastWrap.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 2200);
  }

  // ---- overlay stack (sheets, dialogs, sub pages) — Back closes the top one ----
  const stack = [];
  let scrim = null;
  function ensureScrim() { if (!scrim) { scrim = h('div'); scrim.id = 'scrim'; scrim.addEventListener('click', () => { const top = stack[stack.length - 1]; if (top && top.dismissible !== false) top.close(); }); document.getElementById('app').append(scrim); } return scrim; }
  function syncScrim() { ensureScrim().classList.toggle('on', stack.some((s) => s.scrim)); }
  function pushLayer(layer) { stack.push(layer); syncScrim(); }
  function popLayer(layer) { const i = stack.indexOf(layer); if (i >= 0) stack.splice(i, 1); syncScrim(); }
  function back() { const top = stack[stack.length - 1]; if (top) { if (top.dismissible !== false) top.close(); return true; } return false; }

  /** bottom sheet. content: Node or (body) => void. returns {close, body} */
  function sheet(title, content, opt = {}) {
    const body = h('div.sheet-body');
    const el = h('div.sheet', { role: 'dialog', 'aria-label': title }, h('div.grab'), title ? h('div.hstack', null, h('h2', { style: { flex: 1 } }, title), h('button.icon-btn', { 'aria-label': '關閉', on: { click: () => api.close() } }, icon('close'))) : null, body);
    document.getElementById('app').append(el);
    const api = { el, body, scrim: true, dismissible: opt.dismissible, close() { el.classList.remove('open'); popLayer(api); setTimeout(() => el.remove(), 400); opt.onClose && opt.onClose(); } };
    if (typeof content === 'function') content(body, api); else if (content) body.append(content);
    // swipe-down to close (on the grab area / header)
    let y0 = null; el.addEventListener('pointerdown', (e) => { if (e.target.closest('.sheet-body')) return; y0 = e.clientY; el.style.transition = 'none'; });
    el.addEventListener('pointermove', (e) => { if (y0 == null) return; const d = Math.max(0, e.clientY - y0); el.style.transform = `translateY(${d}px)`; });
    const end = (e) => { if (y0 == null) return; const d = e.clientY - y0; y0 = null; el.style.transition = ''; el.style.transform = ''; if (d > 90) api.close(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    pushLayer(api); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
    return api;
  }
  function confirm(title, msg, okLabel = '確定', danger) {
    return new Promise((res) => {
      const s = sheet(title, (b, api) => {
        b.append(h('p.muted', null, msg), h('div.hstack', { style: { marginTop: '16px' } }, h('button.btn.block', { on: { click: () => { res(false); api.close(); } } }, '取消'), h('button.btn.block' + (danger ? '' : '.primary'), { style: danger ? { background: 'var(--danger)', color: '#fff' } : null, on: { click: () => { res(true); api.close(); } } }, okLabel)));
      }, { onClose: () => res(false) });
      return s;
    });
  }

  // ---- form controls ----
  function seg(options, value, onChange) {
    const el = h('div.seg', { role: 'radiogroup' });
    const set = (v) => { [...el.children].forEach((b) => { b.classList.toggle('on', b.dataset.v === String(v)); b.setAttribute('aria-checked', b.dataset.v === String(v)); }); };
    options.forEach(([v, label, ic]) => el.append(h('button', { role: 'radio', 'data-v': v, on: { click: () => { haptic(); set(v); onChange(v); } } }, ic ? icon(ic, 's') : null, ic ? ' ' : null, label)));
    set(value); el.set = set; return el;
  }
  function toggle(value, onChange) { const el = h('button.switch', { role: 'switch', 'aria-checked': !!value }); el.classList.toggle('on', !!value); el.addEventListener('click', () => { const v = !el.classList.contains('on'); el.classList.toggle('on', v); el.setAttribute('aria-checked', v); haptic(); onChange(v); }); return el; }
  function row(ic, title, sub, right, onClick) {
    const el = h('div.row' + (onClick ? '.tap' : ''), onClick ? { role: 'button', tabindex: 0, on: { click: onClick } } : null, ic ? (typeof ic === 'string' ? icon(ic) : ic) : null, h('div.grow', null, h('div.title', null, title), sub ? h('div.sub', null, sub) : null), right || (onClick ? icon('chev', 'chev') : null));
    return el;
  }
  function lockedRow(ic, title, why) { return row(ic, title, why || '尚未開放', h('span.tag', null, icon('lock', 's'), '未開放')); }
  const swatches = (cols, value, onPick) => { const el = h('div.swatches'); cols.forEach((c) => el.append(h('button.swatch', { 'aria-label': c, style: { '--c': c }, 'data-v': c, on: { click: () => { haptic(); [...el.children].forEach((b) => b.classList.toggle('on', b.dataset.v === c)); onPick(c); } } }))); [...el.children].forEach((b) => b.classList.toggle('on', b.dataset.v === value)); return el; };

  OC.UI = { h, $, icon, IC, toast, sheet, confirm, seg, toggle, row, lockedRow, swatches, haptic, pushLayer, popLayer, back, stack };
})();
