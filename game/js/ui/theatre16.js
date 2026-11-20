/* OC Shimeji 16.11 — big moments as small scenes (OC.Theatre), the replay list, and the 健康 app.
 *
 *   OC.Theatre.play(sc)  sc = { kind, title, sub, ocs, lines: [{ who, text }], key }. Every scene is written down first
 *                        (save.life.theatre16, once per key, newest 40). If you are looking at the island right now it plays:
 *                        a soft letterbox, a title, then the lines one by one with each speaker's portrait — tap to go on, ×2,
 *                        跳過. Otherwise it is "missed": a letter, and a dot in the 回放 app, where every scene can be played again.
 *                        A scene never changes data (whatever it shows has already happened); the characters in it are held with
 *                        'stage' while it plays and always released.
 *   big moments          a farewell (OC.Health16), making up after a cold war (OC.Feud16), a birth or adoption (home16:child),
 *                        graduating (Career16 memory), a date that both came to (outing:done).
 *   健康 app             per character: the conditions and what helps, the life mode, the twilight; the feuds and what you can do;
 *                        the memorial (with 讓牠回來).
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = () => OC.Store, Ch = () => OC.Chars, Sim = () => OC.Sim, B = () => OC.Brain, M = () => OC.Mind;
  const h = (...a) => OC.UI.h(...a), name = (c) => Ch().name(c);
  const list = () => S().life.theatre16 || (S().life.theatre16 = []);
  const reduce = () => !!S().settings.reduceMotion;
  const KIND = { farewell: ['告別', 'heart'], reconcile: ['和好', 'flag'], birth: ['新的家人', 'home'], grad: ['畢業', 'book'], date: ['約會', 'heart'] };
  let cur = null, el = null, autoT = 0;

  function present() {
    return document.visibilityState === 'visible' && OC.App && OC.App.curTab === 'island' && !(OC.UI.stack && OC.UI.stack.length) && !document.querySelector('.page.open') && !(OC.Mini && OC.Mini.active) && !(OC.Fair16 && OC.Fair16.cur) && !(OC.Stage && OC.Stage.busy);
  }
  /** write it down; play it if you are here, otherwise it waits in 回放 */
  function play(sc) {
    if (!sc || !sc.title) return null;
    const L = list(); if (sc.key && L.some((x) => x.key === sc.key)) return null;
    const e = { id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), key: sc.key || null, kind: sc.kind || 'event', title: sc.title, sub: sc.sub || '', ocs: (sc.ocs || []).slice(0, 8),
      names: Object.fromEntries((sc.ocs || []).concat((sc.lines || []).map((l) => l.who)).filter(Boolean).map((id) => [id, name(Ch().get(id) || (S().life.passed16 && S().life.passed16[id] && S().life.passed16[id].char))])),
      lines: (sc.lines || []).slice(0, 10), day: Sim().day(), cal: OC.Clock.cal ? OC.Clock.cal().text : '', seen: false, at: Date.now() };
    L.unshift(e); if (L.length > 40) L.length = 40; St().touch('life', { theatre: true });
    if (S().life.settings.theatre16 === false) return e;   /* the player turned the scenes off: written down in 回放 only */
    if (!cur && present() && !Sim().catching) show(e, false);
    else if (OC.Budget) OC.Budget.mail({ kind: 'theatre', title: `錯過了：${e.title}`, text: '「回放」App 可以再看一次。', key: 'th16miss:' + e.id });
    return e;
  }
  function portrait(id, e) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 72; cv.className = 'th16-av';
    const c = Ch().get(id) || (S().life.passed16 && S().life.passed16[id] && S().life.passed16[id].char);
    if (c) try { OC.CharRender.portrait(cv, c); } catch (err) { /* decoration */ }
    return cv;
  }
  /** play a recorded scene (replay = from the 回放 app: nobody is held) */
  function show(e, replay) {
    if (cur) finish(); e.seen = true; St().touch('life', { theatre: true });
    const held = replay ? [] : e.ocs.filter((id) => B().get(id)); for (const id of held) B().hold(id, 'stage');
    cur = { e, i: -1, speed: 1, held, replay };
    el = h('div.th16' + (reduce() ? '.rm' : ''), { role: 'dialog', 'aria-label': e.title, 'data-th16': e.kind, on: { click: (ev) => { if (ev.target.closest('.th16-btns')) return; next(); } } },
      h('div.th16-bar.top'), h('div.th16-bar.bot'),
      h('div.th16-title', null, h('small', null, (KIND[e.kind] || ['小劇場'])[0]), h('b', null, e.title), e.sub ? h('span', null, e.sub) : null),
      h('div.th16-line', { 'aria-live': 'polite' }),
      h('div.th16-btns', null,
        h('button.btn.s', { 'data-th16': 'speed', 'aria-label': '加速', on: { click: (ev) => { cur.speed = cur.speed === 1 ? 2 : 1; ev.currentTarget.textContent = cur.speed === 1 ? '×2' : '×1'; arm(); } } }, '×2'),
        h('button.btn.s', { 'data-th16': 'skip', 'aria-label': '跳過', on: { click: () => finish() } }, '跳過 ›')));
    document.body.append(el); requestAnimationFrame(() => el && el.classList.add('on'));
    if (OC.Sound && OC.Sound.cue) OC.Sound.cue(e.kind === 'farewell' ? 'farewell' : 'reconcile');
    setTimeout(() => next(), reduce() ? 300 : 1400);
  }
  function arm() { clearTimeout(autoT); if (!cur) return; autoT = setTimeout(next, 2800 / cur.speed); }
  function next() {
    if (!cur || !el) return; cur.i++;
    const L = cur.e.lines; if (cur.i >= L.length) { if (cur.i > L.length) { finish(); return; } el.querySelector('.th16-line').replaceChildren(h('div.th16-end', null, '—')); arm(); return; }
    const ln = L[cur.i], who = cur.e.names[ln.who] || '';
    el.querySelector('.th16-line').replaceChildren(h('div.th16-say', { 'data-i': cur.i }, portrait(ln.who, cur.e), h('div', null, h('b', null, who), h('p', null, ln.text))));
    arm();
  }
  function finish() {
    clearTimeout(autoT); if (!cur) return; const c = cur; cur = null;
    for (const id of c.held) B().unhold(id, 'stage');
    if (el) { const x = el; el = null; x.classList.remove('on'); x.classList.add('closing'); x.style.pointerEvents = 'none'; setTimeout(() => x.remove(), reduce() ? 0 : 300); }
  }
  const unseen = () => list().filter((x) => !x.seen).length;

  /* the big moments that come from elsewhere */
  function wire() {
    St().on('home16:child', (e) => {
      const c = e && Ch().get(e.id || e.child); if (!c) return; const fam = (e.parents || []).map((id) => Ch().get(id)).filter(Boolean);
      const lines = fam.map((p) => { const ln = OC.Talk.say('th16_birth', p, c); return ln && { who: p.id, text: ln.text }; }).filter(Boolean);
      play({ kind: 'birth', title: `${name(c)}來到了這個家`, sub: e.adopt ? '領養' : '出生', ocs: [c.id].concat(fam.map((p) => p.id)), lines, key: 'birth16:' + c.id });
    });
    St().on('outing:done', (e) => {
      const p = e && (S().life.plans16 || []).find((x) => x.id === e.id); if (!p || p.kind !== 'date' || (e.came || []).length < 2) return;
      const [a, b] = e.came.map((id) => Ch().get(id)); if (!a || !b) return;
      const lines = [[a, b], [b, a]].map(([x, y]) => { const ln = OC.Talk.say('th16_date', x, y); return ln && { who: x.id, text: ln.text }; }).filter(Boolean);
      play({ kind: 'date', title: `${name(a)}和${name(b)}的約會`, sub: (OC.Places.get(p.place) || {}).zh || '', ocs: [a.id, b.id], lines, key: 'date16:' + p.id });
    });
    St().on('career16:grad', (e) => {
      const c = e && Ch().get(e.id); if (!c) return; const ln = OC.Talk.say('th16_grad', c, null);
      play({ kind: 'grad', title: `${name(c)}畢業了`, sub: e.level || '', ocs: [c.id], lines: ln ? [{ who: c.id, text: ln.text }] : [], key: 'grad16:' + c.id + ':' + (e.level || '') });
    });
  }

  // ================================================================ pages
  const av = (c) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; cv.className = 'h16-av'; try { OC.CharRender.portrait(cv, c); } catch (e) { /* decoration */ } return cv; };
  const re = (p) => { p._sig = ''; p.refresh(p); };
  OC.Pages.define('theatre16', '回放', {
    sub: true,
    build(p, el2) { p.box = h('div.th16-list'); el2.append(p.box); },
    refresh(p) {
      const L = list(), sig = JSON.stringify(L.map((x) => [x.id, x.seen])); if (p._sig === sig) return; p._sig = sig;
      p.box.replaceChildren(...(L.length ? L.map((x) => h('button.card.th16-item' + (x.seen ? '' : '.new'), { 'data-th': x.id, on: { click: () => { OC.App && OC.App.tab && OC.App.tab('island'); setTimeout(() => show(x, true), 200); } } },
        OC.UI.sticker((KIND[x.kind] || ['', 'star'])[1]), h('div.grow', null, h('b', null, x.title), h('div.muted', null, [x.cal, x.sub].filter(Boolean).join('・'))), x.seen ? null : h('span.badge', null, '新'))) : [h('div.muted.card', null, '還沒有小劇場。重要的時刻（告別、和好、新的家人、畢業、約會）會記在這裡。')]));
    },
  });

  OC.Pages.define('health16', '健康', {
    sub: true,
    build(p, el2) { p.box = h('div.p16'); el2.append(p.box); },
    refresh(p) {
      const H = OC.Health16, F = OC.Feud16, cs = Ch().all(), rf = F ? F.rifts() : [];
      const sig = JSON.stringify([cs.map((c) => [c.id, H.H(c).conds, H.H(c).mode, H.H(c).twilight, H.H(c).grief]), rf.map((r) => [r.a, r.b, r.stage, r.cause16, (r.talk16 || []).length]), Object.keys(H.passed()), S().life.settings.death16, S().life.settings.health16, p.msg, Sim().day()]);
      if (p._sig === sig) return; p._sig = sig;
      p.box.replaceChildren(peopleCard(p), feudCard(p), memorialCard(p));
    },
  });
  function peopleCard(p) {
    const H = OC.Health16, st = S().life.settings;
    const rows = Ch().all().map((c) => {
      const x = H.H(c), act = H.active(c), age = H.ageOf(c);
      return h('div.h16-hrow', { 'data-hc': c.id }, av(c), h('div.grow', null,
        h('b', null, name(c)), h('small.muted', null, age != null ? `　${age} 歲` : ''),
        act.length ? h('div', null, ...act.map((k) => { const C = H.CONDS[k.id]; return h('div.h16-cond', { 'data-cond': k.id }, h('span', null, `${C.ic} ${C.zh}`), h('small.muted', null, `　${k.cause || ''}${k.chronic ? '・老毛病' : `・還要約 ${Math.max(1, Math.round((k.until - Sim().now()) / 60))} 小時`}`), h('div.muted', null, C.med.length ? '有幫助：' + C.med.map((m) => (OC.Style.ITEMS[m] || {}).zh).join('、') + '（晴日雜貨攤）・多休息' : '好好休息就會好')); })) : h('div.muted', null, '健康'),
        x.twilight ? h('div.h16-tw', null, `最近常常說累（第 ${Sim().day() - x.twilight.since + 1} 天，七天後道別）`) : null,
        x.grief ? h('div.muted', null, `還在想念${name((H.passed()[x.grief.who] || {}).char) || ''}`) : null,
        h('div.chips', null, ...H.MODES.map(([k, zh]) => h('button.chip' + (H.modeOf(c) === k ? '.on' : ''), { 'data-mode': k, title: zh, on: { click: () => { H.setMode(c, k); re(p); } } }, { nodeath: '一般', natural: '自然壽命', immortal: '不老不病' }[k]))), h('small.muted', null, H.MODES.find((m) => m[0] === H.modeOf(c))[1])));
    });
    return h('div.card.p16-card', { 'data-card': 'health' }, h('div.hstack', null, OC.UI.sticker('heart'), h('b.grow', null, '大家的身體')),
      st.health16 === false ? h('div.muted', null, '「生病與健康」在生活設定裡關閉了。') : null,
      h('div.muted', null, st.death16 ? '「壽命與告別」已打開：選「自然」的角色，年紀到了會道別。' : '「壽命與告別」沒有打開（生活設定）：誰都不會離開。'), ...rows);
  }
  const STG = { cold: '冷戰中', thaw: '慢慢緩和', reconciled: '和好了', drifted: '疏遠了' };
  function feudCard(p) {
    const F = OC.Feud16; if (!F) return h('div');
    const rs = F.rifts().filter((r) => Ch().get(r.a) && Ch().get(r.b) && r.stage !== 'gone').sort((x, y) => (F.liveRift(y) ? 1 : 0) - (F.liveRift(x) ? 1 : 0)).slice(0, 8);
    return h('div.card.p16-card', { 'data-card': 'feud' }, h('div.hstack', null, OC.UI.sticker('flag'), h('b.grow', null, '關係問題')),
      ...(rs.length ? rs.map((r) => {
        const a = Ch().get(r.a), b = Ch().get(r.b), live = F.liveRift(r), meds = live ? F.mediators(r) : [];
        return h('div.h16-feud', { 'data-rift': r.a + '|' + r.b, 'data-stage': r.stage },
          h('div', null, h('b', null, `${name(a)} ⇄ ${name(b)}`), h('span.tag', null, STG[r.stage] || r.stage)),
          r.cause16 ? h('div.muted', null, '起因：' + r.cause16) : null,
          ...(r.talk16 || []).slice(0, 2).map((t) => h('div.muted', null, `${name(Ch().get(t.by))}跟${name(Ch().get(t.to))}抱怨過${t.by === r.a ? name(b) : name(a)}${t.believe ? '' : '（對方不太認同）'}`)),
          live ? h('div.chips', null,
            h('button.chip', { 'data-fd': 'talk', on: { click: () => { const ok = OC.Arcs.mediate(r.a, r.b); p.msg = ok ? '牠們好好談過了。' : '還需要一點時間。'; re(p); } } }, '讓牠們談談'),
            h('button.chip', { 'data-fd': 'sorryA', on: { click: () => { const x = F.askApology(r.a, r.b); p.msg = x.ok ? `${name(a)}去找${name(b)}道歉了。` : x.why; re(p); } } }, `請${name(a)}道歉`),
            h('button.chip', { 'data-fd': 'sorryB', on: { click: () => { const x = F.askApology(r.b, r.a); p.msg = x.ok ? `${name(b)}去找${name(a)}道歉了。` : x.why; re(p); } } }, `請${name(b)}道歉`),
            ...meds.slice(0, 2).map((m) => h('button.chip', { 'data-fd': 'med', 'data-m': m.id, on: { click: () => { const x = F.askMediator(r, m.id); p.msg = x.ok ? `${name(m)}去幫忙了。` : x.why; re(p); } } }, `請${name(m)}幫忙`))) : null,
          live ? h('div.muted', null, '送對方小禮物（互動選單的「禮物」）也會讓氣氛緩和。') : null);
      }) : [h('div.muted', null, '目前大家相處得還好。')]),
      p.msg ? h('div.p16-msg', { role: 'status' }, p.msg) : null);
  }
  function memorialCard(p) {
    const P = OC.Health16.passed(), ids = Object.keys(P); if (!ids.length) return h('div');
    return h('div.card.p16-card', { 'data-card': 'memorial' }, h('div.hstack', null, OC.UI.sticker('star'), h('b.grow', null, '紀念')),
      ...ids.map((id) => { const x = P[id]; return h('div.h16-hrow', { 'data-passed': id }, av(x.char), h('div.grow', null, h('b', null, name(x.char)), h('div.muted', null, `${x.cal}・${x.age != null ? x.age + ' 歲' : ''}・${(x.friends || []).length} 位朋友送行`)),
        h('button.btn.s.ghost', { 'data-restore': id, on: { click: () => { OC.Health16.restore(id); p.msg = `${name(x.char)}回來了（之後不會再離開，可以在上面改）。`; re(p); } } }, '讓牠回來')); }));
  }
  OC.Theatre = { play, show, finish, list, unseen, wire, present, get cur() { return cur; } };
})();
