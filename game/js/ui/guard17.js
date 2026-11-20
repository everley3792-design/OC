/* OC Shimeji 17.0 — the screen guard (OC.Guard): nothing may leave the screen covered, grey or letterboxed with nobody owning it.
 *
 * A player reported: "sometimes the whole screen suddenly looks squashed and grey and nothing responds". Every full-screen covering we
 * have is listed here with the condition under which it is allowed to exist. Once a second the guard looks at each; a covering that has
 * had no owner for GRACE seconds is removed the same way its owner would remove it, and written to a small log (Settings › 關於 ›
 * 畫面安全網紀錄) so that the next report says exactly what was stuck.
 *
 *   #scrim (grey + blur)   only while a layer that wants it is in the stack AND its element is on screen
 *   stack layers           a layer whose element was removed from the page is dropped (it can never be closed otherwise)
 *   html.cinema (bars, no HUD)    only during an event / script / theatre scene
 *   .stage-ui (dark bars, skip)   only while OC.Stage performs or an event runs
 *   body.talking           only while a dialogue is open
 *   .th16 (scene overlay)  only while OC.Theatre plays it
 *   the 3D canvas          a lost WebGL context that does not come back after the app is visible again → a card to reload the view
 *                          (the save is written first)
 * The guard only removes coverings; it never changes game data, and it is off while a test sets window.__ocNoGuard.
 */
(function () {
  'use strict';
  const GRACE = 2.5;   /* seconds a covering may exist without an owner (transitions take ~0.4 s) */
  const since = {}, LOGK = 'oc.guardlog';
  const vis = (el) => { if (!el || !el.isConnected) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 40 && r.height > 40 && r.top < innerHeight - 24 && r.bottom > 24; };
  const log = () => { try { return JSON.parse(localStorage.getItem(LOGK) || '[]'); } catch (e) { return []; } };
  function note(what, detail) {
    const L = log(); L.unshift({ t: Date.now(), what, detail: String(detail || '').slice(0, 160), tab: OC.App && OC.App.curTab, stack: OC.UI.stack.length });
    if (L.length > 30) L.length = 30; try { localStorage.setItem(LOGK, JSON.stringify(L)); } catch (e) { /* storage full: the fix still happened */ }
    console.warn('[guard]', what, detail || '');
  }
  /** has the condition `bad` held for GRACE seconds? */
  function held(k, bad, now) { if (!bad) { delete since[k]; return false; } if (since[k] == null) since[k] = now; return now - since[k] >= GRACE; }

  function check() {
    if (window.__ocNoGuard || document.hidden) return;
    const now = performance.now() / 1000, U = OC.UI, st = U.stack;
    /* layers whose element is gone can never be closed: drop them */
    for (const l of st.slice()) if (l.el && !l.el.isConnected && held('dead:' + st.indexOf(l), true, now)) { U.popLayer(l); note('layer-gone', l.el.className); }
    /* the grey blurred scrim with nothing on it */
    const scrim = document.getElementById('scrim'), on = !!(scrim && scrim.classList.contains('on'));
    const moving = (el) => !!(el && el.getAnimations && el.getAnimations().some((x) => x.playState === 'running'));   /* still sliding in / out (slow phones): not stuck */
    const owners = st.filter((l) => l.scrim), shown = owners.some((l) => vis(l.el) || (l.el == null) || moving(l.el));
    if (held('scrim', on && owners.length && !shown, now)) {
      for (const l of owners.slice().reverse()) if (!vis(l.el)) { try { l.close(); } catch (e) { /* closing failed: drop it */ } if (st.includes(l)) U.popLayer(l); if (l.el && l.el.isConnected && !vis(l.el)) l.el.remove(); }
      note('scrim-without-sheet', owners.map((l) => l.el && l.el.className).join(' | '));
    }
    if (held('scrim-orphan', on && !owners.length, now)) { scrim.classList.remove('on'); note('scrim-orphan'); }
    /* letterbox / hidden HUD with no scene */
    const scene = !!((OC.Events && OC.Events.current) || (OC.Theatre && OC.Theatre.cur) || (OC.Stage && OC.Stage.busy) || (OC.Arcs && OC.Arcs.running));
    const root = document.documentElement;
    if (held('cinema', root.classList.contains('cinema') && !scene, now)) { root.classList.remove('cinema'); OC.World && OC.World.focus && OC.World.focus(null); note('cinema-stuck'); }
    if (held('stagebars', !!document.querySelector('.stage-ui.on') && !scene, now)) { OC.Stage.controls(false); note('stagebars-stuck'); }
    if (held('talking', document.body.classList.contains('talking') && !(OC.App && OC.App.dlgOpen), now)) { document.body.classList.remove('talking'); note('talking-stuck'); }
    for (const x of document.querySelectorAll('.th16:not(.closing)')) if (held('th16', !(OC.Theatre && OC.Theatre.cur), now)) { x.remove(); note('theatre-stuck'); }
    /* the 3D view: a lost context that never came back */
    const R = OC.World && OC.World.renderer, lost = !!(R && R.getContext && R.getContext().isContextLost && R.getContext().isContextLost());
    if (held('gl', lost, now) && now - (since.glCard || 0) > 30) { since.glCard = now; note('webgl-lost'); offerReload(); }
  }
  function offerReload() {
    if (document.querySelector('.guard-card')) return;
    const h = OC.UI.h, card = h('div.guard-card', { role: 'alertdialog' }, h('b', null, '3D 畫面中斷了'), h('p', null, '手機收回了顯示晶片的資源（常見於切換 App 之後）。進度已經存好，重新載入畫面就會恢復。'),
      h('button.btn.primary.block', { on: { click: () => { try { OC.Store.persist && OC.Store.persist(true); } catch (e) { /* the periodic save already ran */ } location.reload(); } } }, '重新載入畫面'));
    document.getElementById('app').append(card);
  }
  function init() { setInterval(() => { try { check(); } catch (e) { console.error('[guard]', e); } }, 1000); document.addEventListener('visibilitychange', () => { for (const k of Object.keys(since)) if (k !== 'glCard') delete since[k]; }); }
  OC.Guard = { init, check, log, note, clear: () => { try { localStorage.removeItem(LOGK); } catch (e) { /* nothing to clear */ } } };
})();
