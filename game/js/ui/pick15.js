/* OC Shimeji 15.0 — OC.Pick: "tapping is selecting, not doing".
 * A tap on something in the world (a bench, a tree, a door, something on the ground …) no longer walks over and does the thing at once.
 * It selects it: a small card appears next to it with its name and what you can do; the action only starts when you press its button.
 * A tap anywhere else (or Back) puts the card away and nothing has happened.
 *   OC.Pick.show({ x, y, title, sub, stk, actions: [{ label, run, primary, off: '理由' }], track: () => ({x, y}) | null, key })
 * The buttons are inert for the first 350 ms: the finger that opened the card can never press one of them by accident
 * (a slow frame, a second "ghost" click, a double tap). OC.Pick.guard(el) gives the same protection to any freshly shown menu.
 */
(function () {
  'use strict';
  const { h, haptic } = OC.UI;
  const ARM_MS = 350;
  let cur = null;

  /** make everything inside el ignore presses until the finger that brought it up is surely gone */
  function guard(el, ms = ARM_MS) { el.classList.add('unarmed'); el.dataset.armAt = String(performance.now() + ms); setTimeout(() => el.classList.remove('unarmed'), ms); return el; }
  const armed = (el) => !el || performance.now() >= +(el.dataset.armAt || 0);

  function close(why) {
    if (!cur) return; const c = cur; cur = null;
    OC.UI.popLayer(c.layer); cancelAnimationFrame(c.raf);
    c.el.classList.remove('on'); setTimeout(() => c.el.remove(), 220);
    OC.Store.emit('pick:close', { key: c.key, why: why || 'dismiss' });
  }

  function place(c, x, y) {
    const vw = window.innerWidth, vh = window.innerHeight, w = c.card.offsetWidth || 200, hh = c.card.offsetHeight || 90;
    const below = y < 250;   /* near the top of the screen the card goes under the thing instead of over it */
    const cx = Math.max(w / 2 + 10, Math.min(vw - w / 2 - 10, x)), cy = below ? Math.min(vh - hh - 120, y + 26) : Math.max(84, y - hh - 54);
    c.card.style.left = cx + 'px'; c.card.style.top = cy + 'px'; c.dot.style.left = x + 'px'; c.dot.style.top = y + 'px';
    c.card.classList.toggle('below', below);
  }

  function show(o) {
    close('replaced');
    const acts = (o.actions || []).filter(Boolean);
    const card = h('div.pick-card', { role: 'dialog', 'aria-label': o.title || '選取的東西' },
      h('div.pick-head', null, o.stk ? OC.UI.stickerOr(o.stk) : null, h('div.grow', null, h('b', null, o.title || ''), o.sub ? h('small', null, o.sub) : null),
        h('button.pick-x', { 'aria-label': '取消', on: { click: (e) => { e.stopPropagation(); close('cancel'); } } }, OC.UI.icon('close', 's'))),
      h('div.pick-acts', null, ...acts.map((a) => h('button.btn' + (a.primary ? '.primary' : '') + (a.off ? '.locked' : ''), { 'aria-disabled': a.off ? 'true' : 'false', on: { click: (e) => {
        e.stopPropagation(); if (!cur || !armed(card)) return;
        if (a.off) { haptic('error'); OC.UI.toast(a.off, 'info'); return; }
        haptic('confirm'); OC.Sound && OC.Sound.play('tap'); const run = a.run; close('picked'); try { run && run(); } catch (err) { console.error(err); }
      } } }, a.label))));
    const dot = h('div.pick-dot', { 'aria-hidden': 'true' });
    const el = h('div.pick', null, dot, card);
    el.addEventListener('pointerdown', (e) => { if (e.target === el) { if (!armed(card)) return; close('outside'); } });
    document.getElementById('app').append(el);
    guard(card);
    const layer = { scrim: false, close: () => close('back') }; OC.UI.pushLayer(layer);
    const c = cur = { el, card, dot, layer, key: o.key || null, raf: 0 };
    place(c, o.x, o.y);
    if (o.track) { const step = () => { if (cur !== c) return; const p = o.track(); if (!p) { close('gone'); return; } place(c, p.x, p.y); c.raf = requestAnimationFrame(step); }; c.raf = requestAnimationFrame(step); }
    requestAnimationFrame(() => { if (cur === c) el.classList.add('on'); });
    haptic('light'); OC.Sound && OC.Sound.play('pop');
    OC.Store.emit('pick:open', { key: c.key });
    return el;
  }

  OC.Pick = { show, close, guard, armed, ARM_MS, get open_() { return !!cur; }, get key() { return cur && cur.key; } };
})();
