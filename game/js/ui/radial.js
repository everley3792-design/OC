/* OC Shimeji — 8.0 context menu (OC.Radial): a ring of actions around what you tapped (character, furniture, ground).
 * Grouped, with disabled states that say why, a short label under every button (≥ 52 dp targets), and a soft pop-in.
 * The ring is placed so it never covers the character itself (it opens around the head, shifted inside the screen).
 *   OC.Radial.open({ x, y, title, sub, items: [{ id, ic, label, run, off: '理由', main }] })   → closes on any outside tap
 */
(function () {
  'use strict';
  const { h, icon, toast, haptic } = OC.UI;
  let cur = null;

  function close(instant) {
    if (!cur) return; const c = cur; cur = null;
    OC.UI.popLayer(c.layer);
    c.el.classList.remove('on'); setTimeout(() => c.el.remove(), instant ? 0 : 220);
  }

  function open(o) {
    close(true);
    const items = o.items.filter(Boolean), n = items.length;
    const vw = window.innerWidth, vh = window.innerHeight;
    const R = n <= 4 ? 78 : n <= 6 ? 92 : 106, BTN = 56;
    // centre: above the anchor (the head), kept inside the safe screen area
    const cx = Math.max(R + BTN / 2 + 8, Math.min(vw - R - BTN / 2 - 8, o.x));
    const cy = Math.max(R + BTN / 2 + 90, Math.min(vh - R - BTN / 2 - 110, o.y + 34));   // centred on the body: the OC stays visible inside the ring
    const el = h('div.radial', { role: 'menu', 'aria-label': o.title || '動作' });
    const ring = h('div.radial-ring', { style: { left: cx + 'px', top: cy + 'px' } });
    ring.append(h('div.radial-hub', { style: { top: -(R + BTN / 2 + 26) + 'px' } }, h('b', null, o.title || ''), o.sub ? h('small', null, o.sub) : null));
    // arc: full circle for many items, a top arc for few (keeps the bottom free so the character stays visible)
    const span = n >= 7 ? Math.PI * 2 : Math.PI * 1.25, start = n >= 7 ? -Math.PI / 2 + Math.PI / n : -Math.PI / 2 - span / 2;   // full ring leaves the top free for the title
    items.forEach((it, i) => {
      const a = n >= 7 ? start + (i / n) * span : start + (n === 1 ? span / 2 : (i / (n - 1)) * span);
      const b = h('button.radial-btn' + (it.off ? '.off' : '') + (it.main ? '.main' : ''), {
        role: 'menuitem', 'aria-label': it.label + (it.off ? `（${it.off}）` : ''), 'aria-disabled': it.off ? 'true' : 'false',
        style: { '--x': Math.cos(a) * R + 'px', '--y': Math.sin(a) * R + 'px', '--d': i * 22 + 'ms' },
        on: { click: (e) => { e.stopPropagation(); if (it.off) { haptic(); toast(it.off, 'info'); return; } OC.Sound && OC.Sound.play('tap'); haptic(); close(); setTimeout(() => it.run(), 40); } },
      }, icon(it.ic), h('span', null, it.label));
      ring.append(b);
    });
    el.append(ring);
    el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
    document.getElementById('app').append(el);
    const layer = { scrim: false, close: () => close() }; OC.UI.pushLayer(layer);
    cur = { el, layer, target: o.target || null };
    requestAnimationFrame(() => el.classList.add('on'));
    OC.Sound && OC.Sound.play('pop');
    o.onOpen && o.onOpen();
    return el;
  }

  OC.Radial = { open, close, get open_() { return !!cur; }, get target() { return cur && cur.target; } };
})();
