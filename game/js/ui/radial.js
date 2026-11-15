/* OC Shimeji — context menu (OC.Radial): a ring of actions around what you tapped (character, furniture, ground).
 * 10.1: one continuous motion instead of a pop — spotlight + halo bloom, the name tag drops in, the buttons swirl out of the
 * character one after another, labels last; the chosen button pops while the others tuck in; closing plays it in reverse.
 * The ring follows its anchor (o.track) while open, so it stays around a character that is still settling.
 *   OC.Radial.open({ x, y, title, sub, target, track: () => ({x, y}), onClose, items: [{ ic, label, run, off: '理由', main }] })
 * Closes on any outside tap or Back; onClose always runs exactly once (used to release the character).
 */
(function () {
  'use strict';
  const { h, icon, toast, haptic } = OC.UI;
  let cur = null;

  function close(instant) {
    if (!cur) return; const c = cur; cur = null;
    OC.UI.popLayer(c.layer); cancelAnimationFrame(c.raf); document.documentElement.classList.remove('ring-open');
    try { c.onClose && c.onClose(); } catch (e) { console.error(e); }
    if (instant) { c.el.remove(); return; }
    c.el.classList.add('out'); c.el.classList.remove('on');
    setTimeout(() => c.el.remove(), 340);
  }

  /** ring centre from an anchor: above the feet, kept inside the safe screen area (room for the title and the labels) */
  function centre(x, y, R, BTN) {
    const vw = window.innerWidth, vh = window.innerHeight;
    return { cx: Math.max(R + BTN / 2 + 8, Math.min(vw - R - BTN / 2 - 8, x)), cy: Math.max(R + BTN / 2 + 90, Math.min(vh - R - BTN / 2 - 110, y + 34)) };
  }

  function open(o) {
    close(true);
    const items = o.items.filter(Boolean), n = items.length;
    const R = n <= 4 ? 80 : n <= 6 ? 94 : 108, BTN = 58;
    let { cx, cy } = centre(o.x, o.y, R, BTN);
    const el = h('div.radial', { role: 'menu', 'aria-label': o.title || '動作', style: { '--rx': o.x + 'px', '--ry': o.y + 'px' } });
    const ring = h('div.radial-ring', { style: { left: cx + 'px', top: cy + 'px' } });
    ring.append(h('div.radial-halo', { style: { '--hs': (R * 2 + BTN + 30) + 'px' } }));
    ring.append(h('div.radial-hub', { style: { top: -(R + BTN / 2 + 26) + 'px' } }, h('b', null, o.title || ''), o.sub ? h('small', null, o.sub) : null));
    // arc: full circle for many items, a top arc for few (keeps the bottom free so the character stays visible)
    const span = n >= 7 ? Math.PI * 2 : Math.PI * 1.25, start = n >= 7 ? -Math.PI / 2 + Math.PI / n : -Math.PI / 2 - span / 2;
    items.forEach((it, i) => {
      const a = n >= 7 ? start + (i / n) * span : start + (n === 1 ? span / 2 : (i / (n - 1)) * span);
      const a0 = a - 0.55, r0 = R * 0.28;   // they start a little "behind" on the circle → a gentle swirl outwards
      const b = h('button.radial-btn' + (it.off ? '.off' : '') + (it.main ? '.main' : ''), {
        role: 'menuitem', 'aria-label': it.label + (it.off ? `（${it.off}）` : ''), 'aria-disabled': it.off ? 'true' : 'false',
        style: { '--x': Math.cos(a) * R + 'px', '--y': Math.sin(a) * R + 'px', '--x0': Math.cos(a0) * r0 + 'px', '--y0': Math.sin(a0) * r0 + 'px', '--d': 40 + i * 28 + 'ms', '--dc': (n - 1 - i) * 16 + 'ms' },
        on: { click: (e) => {
          e.stopPropagation(); if (!cur || cur.picking) return;
          if (OC.Pick && !OC.Pick.armed(el)) return;   /* 15.0: the finger that opened the ring cannot pick from it */
          if (it.off) { haptic('error'); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); toast(it.off, 'info'); return; }
          if (it.sub) { haptic('tick'); [...ring.querySelectorAll('.radial-btn.cat-on')].forEach((x) => x.classList.remove('cat-on')); b.classList.add('cat-on'); panel(it); return; }   /* 16.4: a category opens its items in the same menu */
          // the chosen button pops, the others tuck in, then the action runs as the ring fades
          cur.picking = true; haptic('confirm'); OC.Sound && OC.Sound.play('tap');
          b.classList.add('picked'); el.classList.add('picking');
          setTimeout(() => { try { it.run(); } catch (err) { console.error(err); } close(); }, 170);   // run first: its own hold starts before the menu hold ends
        } },
      }, OC.UI.STICKERS && OC.UI.STICKERS[it.ic] ? OC.UI.sticker(it.ic) : icon(it.ic), h('span', null, it.label));
      ring.append(b);
    });
    el.append(ring);
    /* 16.4: one level of items under a category — a panel inside the same menu (no second ring, no sheet). A tap runs the item
     * (requests go into the action list); a long press means 「立刻做」 (it goes first). Optional tabs switch the list in place. */
    const pnl = h('div.radial-panel', { role: 'group' }); el.append(pnl);
    function panel(cat) {
      const spec = cat.sub(), tabs = spec.tabs || null; let tab = spec.tab || (tabs && tabs[0] && tabs[0][0]);
      const draw = () => {
        const items = (typeof spec.items === 'function' ? spec.items(tab) : spec.items || []).filter(Boolean);
        pnl.replaceChildren(
          h('div.rp-head', null, h('b', null, cat.label), spec.note ? h('small', null, spec.note) : null),
          tabs ? h('div.rp-tabs', null, ...tabs.map(([k, zh]) => h('button.chip-btn' + (k === tab ? '.on' : ''), { 'data-tab': k, on: { click: (e) => { e.stopPropagation(); tab = k; draw(); } } }, zh))) : null,
          items.length ? h('div.rp-items', null, ...items.map((x) => {
            const bt = h('button.radial-btn.ri' + (x.off ? '.off' : ''), { 'data-item': x.id || x.label, 'aria-label': x.label + (x.off ? `（${x.off}）` : ''), 'aria-disabled': x.off ? 'true' : 'false' }, h('span.ri-ic', null, x.ic && x.ic.length <= 2 ? x.ic : OC.UI.stickerOr(x.ic || 'sparkle')), h('span', null, x.label), x.hint ? h('i.ri-hint', null, x.hint) : null, x.off ? OC.UI.icon('lock', 's') : null);
            let lp = null, longed = false;
            bt.addEventListener('pointerdown', () => { longed = false; clearTimeout(lp); if (x.now) lp = setTimeout(() => { longed = true; fire(true); }, 520); });
            const cancelLp = () => clearTimeout(lp); bt.addEventListener('pointerup', cancelLp); bt.addEventListener('pointerleave', cancelLp); bt.addEventListener('pointercancel', cancelLp);
            const fire = (now) => {
              if (!cur || cur.picking) return; if (OC.Pick && !OC.Pick.armed(el)) return;
              if (x.off) { haptic('error'); toast(x.off, 'info'); return; }
              cur.picking = true; haptic(now ? 'heavy' : 'confirm'); OC.Sound && OC.Sound.play('tap'); bt.classList.add('picked');
              setTimeout(() => { try { x.run({ now: !!now }); } catch (err) { console.error(err); } close(); }, 120);
            };
            bt.addEventListener('click', (e) => { e.stopPropagation(); if (longed) return; fire(false); });
            return bt;
          })) : h('div.rp-empty', null, spec.empty || '這裡沒有可以做的'),
          spec.foot ? h('div.rp-foot', null, spec.foot) : null);
        pnl.classList.add('on'); el.classList.add('has-panel');
      };
      draw(); if (OC.Pick) OC.Pick.guard(pnl, 250);
    }
    el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });   /* a NEW finger outside always closes (the guard is only for the buttons)*/
    document.getElementById('app').append(el); if (OC.Pick) OC.Pick.guard(el);
    const layer = { scrim: false, close: () => close() }; OC.UI.pushLayer(layer);
    cur = { el, layer, target: o.target || null, onClose: o.onClose || null, raf: 0, picking: false };
    // follow the anchor (eased) while open: the character may still be finishing a step
    if (o.track) {
      const c0 = cur; let fx = o.x, fy = o.y;
      const step = () => {
        if (cur !== c0) return; const p = o.track(); if (p) { fx += (p.x - fx) * 0.25; fy += (p.y - fy) * 0.25; const q = centre(fx, fy, R, BTN);
          if (Math.abs(q.cx - cx) > 0.3 || Math.abs(q.cy - cy) > 0.3) { cx = q.cx; cy = q.cy; ring.style.left = cx + 'px'; ring.style.top = cy + 'px'; el.style.setProperty('--rx', fx + 'px'); el.style.setProperty('--ry', fy + 'px'); } }
        c0.raf = requestAnimationFrame(step);
      };
      c0.raf = requestAnimationFrame(step);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => { if (cur && cur.el === el) el.classList.add('on'); }));   // two frames: the start pose is laid out first (no snap)
    document.documentElement.classList.add('ring-open');   // other OCs' bubbles step back while you choose
    haptic('light'); OC.Sound && OC.Sound.play('pop');
    o.onOpen && o.onOpen();
    return el;
  }

  /** 16.4: 「已安排：…　復原」 — no confirmation before; one tap after to take it back */
  let undoEl = null;
  function undoToast(text, undo, ms = 4200, label = '復原') {
    if (undoEl) undoEl.remove(); const el = h('div.undo-toast', { role: 'status' }, h('span.grow', null, text), undo ? h('button.btn.s', { on: { click: () => { try { undo(); } catch (e) { console.error(e); } el.remove(); haptic('tick'); } } }, label) : null);
    document.getElementById('app').append(el); undoEl = el; requestAnimationFrame(() => el.classList.add('on')); setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 300); if (undoEl === el) undoEl = null; }, ms);
  }
  OC.Radial = { open, close, undoToast, get open_() { return !!cur; }, get target() { return cur && cur.target; } };
})();
