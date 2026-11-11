/* OC Shimeji — tutorial, guided by the player's own OC (OC.Tutorial). Rebuilt in 13.0 as four short chapters
 * (相遇 · 照顧 · 一起玩 · 出門) that also teach the control modes, shaking trees, playing games and travelling.
 * Each step is learned by DOING it (the step completes on the real event), spoken by the OC in its own voice
 * (OC.Chars.speak → sentence endings / catchphrase), with a soft highlight on the control.
 * Skip at any time; progress is saved (S.intro.tutorial) and resumes after a restart; Settings › 重新觀看 replays it.
 */
(function () {
  'use strict';
  const { h, icon } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, A = () => OC.App;
  // 13.0: four short chapters, each learned by DOING (a step completes on the real event); the OC talks in its own voice.
  const CHAPTERS = ['相遇', '照顧', '一起玩', '出門'];
  const STEPS = [
    { ch: 0, id: 'hello', say: '這裡是我們的島。不用急，我一樣一樣帶你認識。', next: true },
    { ch: 0, id: 'walk', say: '點一下地面，我會走過去。', hint: '點地面', done: (e) => e === 'walk' },
    { ch: 0, id: 'look', say: '用一根手指拖曳空地可以看看四周，兩指能縮放。', hint: '拖曳或兩指縮放', done: (e) => e === 'cam:pan' || e === 'cam:zoom' || e === 'cam:rotate' },
    { ch: 0, id: 'ring', say: '點我一下，會出現可以對我做的事。', hint: '點你的 OC', done: (e) => e === 'menu:open' },
    { ch: 0, id: 'pet', say: '在我身上來回滑動，就是在摸我。力道和位置，我都感覺得到。', hint: '在 OC 身上左右來回滑', done: (e) => e === 'touch:pet' },
    { ch: 0, id: 'lift', say: '按住我並拖曳，可以把我抱起來。放開時，請輕一點。', hint: '按住 OC 拖曳，再放開', done: (e) => e === 'touch:land' },
    { ch: 1, id: 'status', say: '點左上角我的頭像，能看到我現在的心情、需求，還有我在想什麼。', hint: '左上角的頭像', target: '.hud-me', done: (e) => e === 'status:open' },
    { ch: 1, id: 'control', say: '平常我會自己過日子；你一下指令，我就先聽你的。在狀態卡或長按頭像，可以改成「手動」或「全自動」。', hint: '試著切換一次操控模式（也可以先略過）', done: (e) => e === 'control:set' },
    { ch: 1, id: 'time', say: '頭像下方是時間。點開後，可以讓它跟著現實走，或自己調整。', hint: '頭像下方的時間', target: '.hud-time', done: (e) => e === 'time:panel' },
    { ch: 1, id: 'bag', say: '右上角的把手會展開背包、鏡頭與佈置。把食物拖到我身上，就能餵我。', target: '.rail-toggle', next: true },
    { ch: 2, id: 'shake', say: '島上的樹和草叢都可以搖。有時候會掉下東西——每棵每天只有一次機會。', hint: '點一下樹或草叢', done: (e) => e === 'world:shake' },
    { ch: 2, id: 'game', say: '想玩的時候，點我 → 玩耍，可以猜拳或玩躲貓貓。我有時候也會自己來找你。', hint: '點 OC → 玩耍 → 猜拳（玩完一局）', done: (e) => e === 'fun:end' },
    { ch: 3, id: 'map', say: '下方的「探索」是地圖。島外還有森林、海灘、商店街。', hint: '打開下方的「探索」', target: '.tabbar', done: (e) => e === 'tab:explore' },
    { ch: 3, id: 'travel', say: '挑一個地方去看看吧。我自己想去哪裡的時候，畫面也會跟著我過去。', hint: '在地圖上選一個地點前往', done: (e) => e === 'travel' },
    { ch: 3, id: 'tabs', say: '其他分頁是角色、工坊和日常。想認識更多人，可以自己創造新的 OC——每個人的個性都會不一樣。', target: '.tabbar', next: true },
    { ch: 3, id: 'desk', say: '另外，在「日常 › 桌寵管理」，我可以到你的手機桌面上待著。', next: true, extra: ['去看看', () => OC.Pages.open('petcenter')] },
    { ch: 3, id: 'bye', say: '入門就到這裡。這個給你，當作紀念。接下來，我們各自過日子吧。', next: true, last: true },
  ];
  let ui = null, off = [], cur = -1, pollT = 0;

  const st = () => S().intro.tutorial;
  function speakLine(t) { const c = OC.Chars.active(); return c ? OC.Chars.speak(c, t) : t; }

  function start(o = {}) {
    if (OC.Intro && OC.Intro.skipAll() && !o.force) return;
    const T = st(); if (o.restart) { T.step = 0; T.done = false; T.skipped = false; }
    if (T.done || T.skipped) return;
    stop(true); build(); show(Math.min(T.step || 0, STEPS.length - 1));
    const evs = ['menu:open', 'touch:pet', 'touch:land', 'status:open', 'time:panel', 'cam:pan', 'cam:rotate', 'cam:mode', 'control:set', 'world:shake', 'fun:end'];
    for (const e of evs) off.push(St.on(e, () => fire(e)));
    pollT = setInterval(poll, 400);
  }
  let walk0 = null, zoom0 = null, area0 = null;
  function poll() {
    const p = A().player; if (!p) return;
    if (A().curTab === 'explore') fire('tab:explore');
    const ar = OC.World.area && OC.World.area.id; if (area0 == null) area0 = ar; else if (ar && ar !== area0) { area0 = ar; fire('travel'); }
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
    const inCh = STEPS.filter((x) => x.ch === s.ch), k = inCh.indexOf(s);
    ui.card.replaceChildren(h('div.tut-ch', null, h('b', null, `第 ${s.ch + 1} 章・${CHAPTERS[s.ch]}`), h('span.tut-dots', null, ...inCh.map((x, n) => h('i' + (n < k ? '.done' : n === k ? '.now' : '')))), h('small', null, `${s.ch + 1} / ${CHAPTERS.length}`)), h('div.tut-row', null, cv, h('div.grow', null, h('div.tut-text', null, speakLine(s.say)), s.hint ? h('div.tut-hint', null, icon('hand', 's'), s.hint) : null)),
      h('div.tut-actions', null, h('small.faint', null, `${i + 1} / ${STEPS.length}`), h('span.grow'),
        s.last ? null : h('button.btn.ghost.s', { on: { click: () => finish(true) } }, '跳過教學'),
        s.extra ? h('button.btn.s', { on: { click: () => { s.extra[1](); show(i + 1); } } }, s.extra[0]) : null,
        s.next ? h('button.btn.primary.s', { on: { click: () => show(i + 1) } }, s.last ? '開始生活' : '下一步') : h('button.btn.ghost.s', { 'aria-label': '這一步先略過', on: { click: () => show(i + 1) } }, '略過這步')));
    ui.card.classList.remove('on'); { const u = ui; requestAnimationFrame(() => u.card.classList.add('on')); }
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
    // 13.0: finishing the guide (not skipping it) gives a small keepsake, once
    if (!skipped && OC.Tx) { const r = OC.Tx.run('tutorial:13:done', { get: { coins: 60 } }, '完成入門'); if (r.ok) { OC.UI.toast('完成入門：+60 星幣', 'gift'); if (OC.Sound && OC.Sound.cue) OC.Sound.cue('claim'); } }
    stop();
  }
  function stop(silent) {
    clearInterval(pollT); off.forEach((f) => f && f()); off = [];
    if (ui) { const u = ui; ui = null; u.card.classList.remove('on'); u.ring.classList.remove('on'); setTimeout(() => { u.card.remove(); u.ring.remove(); }, silent ? 0 : 300); }
    walk0 = null; zoom0 = null; area0 = null; cur = -1;
  }

  OC.Tutorial = { start, stop, STEPS, CHAPTERS, get step() { return cur; }, get active() { return !!ui; } };
})();
