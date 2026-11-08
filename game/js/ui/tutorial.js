/* OC Shimeji — 8.0 tutorial, guided by the player's own OC (OC.Tutorial).
 * Each step is learned by DOING it (the step completes on the real event), spoken by the OC in its own voice
 * (OC.Chars.speak → sentence endings / catchphrase), with a soft highlight on the control.
 * Skip at any time; progress is saved (S.intro.tutorial) and resumes after a restart; Settings › 重新觀看 replays it.
 */
(function () {
  'use strict';
  const { h, icon } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, A = () => OC.App;
  const STEPS = [
    { id: 'hello', say: '這裡就是我們的小島！我來教你怎麼跟我一起生活。', next: true },
    { id: 'walk', say: '點一下地面，我就會走過去。', hint: '點地面', done: (e) => e === 'walk' },
    { id: 'look', say: '用一根手指拖曳空地看看四周，兩根手指可以縮放。', hint: '拖曳或兩指縮放', done: (e) => e === 'cam:pan' || e === 'cam:zoom' || e === 'cam:rotate' },
    { id: 'ring', say: '點我一下，會出現可以對我做的事。', hint: '點你的 OC', done: (e) => e === 'menu:open' },
    { id: 'pet', say: '在我身上來回摸摸，我會很開心的。', hint: '在 OC 身上左右來回滑', done: (e) => e === 'touch:pet' },
    { id: 'lift', say: '按住我拖一下，可以把我抱起來……輕一點喔！', hint: '按住 OC 拖曳，再放開', done: (e) => e === 'touch:land' },
    { id: 'status', say: '點左上角我的頭像，可以看我現在的心情和需求。', hint: '左上角', target: '.hud-me', done: (e) => e === 'status:open' },
    { id: 'time', say: '右上角是時間。你可以讓時間跟著現實走，或自己調。', hint: '右上角', target: '.hud-time', done: (e) => e === 'time:panel' },
    { id: 'bag', say: '右下角是背包。把食物拖到我身上就能餵我。', target: '.bag-fab', next: true },
    { id: 'tabs', say: '下面的分頁有角色、工坊、探索和日常。想認識更多朋友，也可以自己創造新的 OC。', target: '.tabbar', next: true },
    { id: 'desk', say: '對了，在「日常 › 桌寵管理」，我還可以跑到你的手機桌面上陪你！', next: true, extra: ['去看看', () => OC.Pages.open('petcenter')] },
    { id: 'bye', say: '就這樣！接下來我們就自由地過日子吧。', next: true, last: true },
  ];
  let ui = null, off = [], cur = -1, pollT = 0;

  const st = () => S().intro.tutorial;
  function speakLine(t) { const c = OC.Chars.active(); return c ? OC.Chars.speak(c, t) : t; }

  function start(o = {}) {
    if (OC.Intro && OC.Intro.skipAll() && !o.force) return;
    const T = st(); if (o.restart) { T.step = 0; T.done = false; T.skipped = false; }
    if (T.done || T.skipped) return;
    stop(true); build(); show(Math.min(T.step || 0, STEPS.length - 1));
    const evs = ['menu:open', 'touch:pet', 'touch:land', 'status:open', 'time:panel', 'cam:pan', 'cam:rotate', 'cam:mode'];
    for (const e of evs) off.push(St.on(e, () => fire(e)));
    pollT = setInterval(poll, 400);
  }
  let walk0 = null, zoom0 = null;
  function poll() {
    const p = A().player; if (!p) return;
    if (!walk0) walk0 = { x: p.x, y: p.y }; if (zoom0 == null) zoom0 = OC.World.zoom;
    if (Math.hypot(p.x - walk0.x, p.y - walk0.y) > 30) fire('walk');
    if (Math.abs(OC.World.zoom - zoom0) > 0.2) { zoom0 = OC.World.zoom; fire('cam:zoom'); }
  }
  function fire(e) {
    const s = STEPS[cur]; if (!s || !s.done || !s.done(e)) return;
    OC.Sound && OC.Sound.play('sparkle'); OC.UI.haptic('confirm');
    const a = A().player; if (a) A().floatText(a, '✓', 'var(--success)');
    setTimeout(() => show(cur + 1), 700);
  }
  function build() {
    ui = { card: h('div.tut-card', { role: 'status', 'aria-live': 'polite' }), ring: h('div.tut-ring') };
    document.getElementById('app').append(ui.card, ui.ring);
  }
  function show(i) {
    if (!ui) return;
    if (i >= STEPS.length) { finish(false); return; }
    cur = i; st().step = i; St.touch('intro');
    const s = STEPS[i], c = OC.Chars.active();
    const cv = h('canvas', { width: 96, height: 96 }); if (c) OC.CharRender.portrait(cv, c, { pose: { mouth: 'smile', eyes: 'happy' } });
    ui.card.replaceChildren(h('div.tut-row', null, cv, h('div.grow', null, h('div.tut-text', null, speakLine(s.say)), s.hint ? h('div.tut-hint', null, icon('hand', 's'), s.hint) : null)),
      h('div.tut-actions', null, h('small.faint', null, `${i + 1} / ${STEPS.length}`), h('span.grow'),
        s.last ? null : h('button.btn.ghost.s', { on: { click: () => finish(true) } }, '跳過教學'),
        s.extra ? h('button.btn.s', { on: { click: () => { s.extra[1](); show(i + 1); } } }, s.extra[0]) : null,
        s.next ? h('button.btn.primary.s', { on: { click: () => show(i + 1) } }, s.last ? '開始生活' : '下一步') : h('button.btn.ghost.s', { 'aria-label': '這一步先略過', on: { click: () => show(i + 1) } }, '略過這步')));
    ui.card.classList.remove('on'); requestAnimationFrame(() => ui.card.classList.add('on'));
    const a = A().player; if (a && c && A().bubble) A().bubble(a, speakLine(s.say).slice(0, 26) + (s.say.length > 26 ? '…' : ''), OC.Chars.name(c), 3);
    target(s.target);
  }
  function target(sel) {
    const r = ui.ring; r.classList.remove('on'); if (!sel) return;
    const el = document.querySelector(sel); if (!el) return;
    const b = el.getBoundingClientRect(); Object.assign(r.style, { left: b.left - 6 + 'px', top: b.top - 6 + 'px', width: b.width + 12 + 'px', height: b.height + 12 + 'px' });
    requestAnimationFrame(() => r.classList.add('on'));
  }
  function finish(skipped) {
    const T = st(); if (skipped) T.skipped = true; else T.done = true; T.step = skipped ? cur : STEPS.length; St.touch('intro');
    if (!skipped) { const a = A().player; if (a) { OC.World.setAction(a, 'cheer', { dur: 1.6, priority: 7 }); } }
    stop();
  }
  function stop(silent) {
    clearInterval(pollT); off.forEach((f) => f && f()); off = [];
    if (ui) { const u = ui; ui = null; u.card.classList.remove('on'); u.ring.classList.remove('on'); setTimeout(() => { u.card.remove(); u.ring.remove(); }, silent ? 0 : 300); }
    walk0 = null; zoom0 = null; cur = -1;
  }

  OC.Tutorial = { start, stop, STEPS, get step() { return cur; }, get active() { return !!ui; } };
})();
