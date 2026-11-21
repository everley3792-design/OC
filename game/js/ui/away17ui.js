/* OC Shimeji 17.1 — 「你不在的時候」, the timeline page and the end-of-day card.
 *
 *   away page   after an absence of an hour or more (OC.Away digest): how long you were gone, how many big moments, the three
 *               best ones, then every day — its big moments and one line per person. It needs no answer, so it does not use the
 *               interruption budget; 「繼續觀察」 closes it, the back key too.
 *   timeline    page 'chron17' (口袋手機「時間線」, the time panel): one day at a time (‹ ›), everyone or one person; the newest on top;
 *               a long press keeps a line in 收藏; a tap on a line takes the camera to that person if they are here.
 *   day card    when a day ends while you watch: 「春 3 結束了」 with how many things happened.
 * Everything here only reads OC.Chronicle / OC.Away.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, Ch = () => OC.Chars, C = () => OC.Chronicle, Sim = () => OC.Sim;
  const h = (...a) => OC.UI.h(...a), name = (c) => Ch().name(c);
  const hm = (gm) => { const m = ((Math.round(gm) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const dayLabel = (d) => { const t = Sim().day(); const base = OC.Clock.cal ? OC.Clock.cal(d).text : '第 ' + d + ' 天'; return d === t ? `今天・${base}` : d === t - 1 ? `昨天・${base}` : base; };
  const av = (c, cls = 'aw17-av') => { const cv = document.createElement('canvas'); cv.width = cv.height = 48; cv.className = cls; try { OC.CharRender.portrait(cv, c); } catch (e) { /* the face is decoration */ } return cv; };
  const line = (x, o = {}) => h('div.aw17-line' + (x.w >= 0.45 && x.k !== 'act' ? '.big' : '') + (x.k === 'act' ? '.act' : ''), { 'data-h': x.id }, h('b.num', null, hm(x.gm)), h('span', null, x.text), o.tag ? h('small.tag', null, o.tag) : null);

  const trimName = (t, n) => { t = t.replace(/^[^：]*：/, ''); return n && t.startsWith(n) ? t.slice(n.length) : t; };

  // ================================================================ 「你不在的時候」
  let open = null;
  function showAway(info) {
    const dg = OC.Away.digest(info); if (!dg || open) return;
    const el = h('div.aw17', { role: 'dialog', 'aria-label': '你不在的時候' });
    const close = () => { if (!open) return; const x = open; open = null; OC.UI.popLayer(x); el.classList.add('out'); setTimeout(() => el.remove(), 300); };
    const layer = { el, close };
    const days = dg.days.slice(-7);   /* a week at most on this page; the rest is in the timeline */
    el.append(
      h('div.aw17-head', null, h('small', null, '你不在的時候'), h('b', null, `你離開了 ${OC.Away.span(dg.min)}`),
        h('span', null, dg.nBig ? `這段時間發生了 ${dg.nBig} 件大事、${dg.n} 件小事` : `這段時間大家照自己的步調生活（${dg.n} 件小事）`),
        dg.capped ? h('small.muted', null, '超過 30 天的部分沒有推算，大家直接到了現在。') : null),
      h('div.aw17-body', null,
        dg.best.length ? h('div.aw17-card', { 'data-sec': 'best' }, h('div.hstack', null, OC.UI.sticker('star'), h('b.grow', null, '名場面')), ...dg.best.map((x) => h('div.aw17-best', null, h('small.muted', null, dayLabel(x.d) + ' ' + hm(x.gm)), h('p', null, x.text)))) : null,
        ...days.map((D) => h('div.aw17-card', { 'data-day': D.d }, h('div.hstack', null, h('b.grow', null, dayLabel(D.d)), h('small.muted', null, `${D.n} 件事`)),
          ...D.big.map((x) => line(x)),
          D.people.length ? h('div.aw17-people', null, ...D.people.map((p) => { const c = Ch().get(p.id); return h('div.aw17-person', null, av(c), h('div.grow', null, h('b', null, name(c)), h('span', null, trimName(p.line.text, name(c))))); })) : null)),
        dg.days.length > 7 ? h('p.muted.center', null, `更早的 ${dg.days.length - 7} 天在「時間線」裡`) : null),
      h('div.aw17-foot', null,
        h('button.btn.ghost', { 'data-aw17': 'timeline', on: { click: () => { close(); OC.Pages.open('chron17', { day: Math.floor(dg.to / 1440), away: true }); } } }, '看完整時間線'),
        h('button.btn.primary.grow', { 'data-aw17': 'continue', on: { click: close } }, '繼續觀察')));
    document.getElementById('app').append(el); OC.UI.pushLayer(layer); open = layer;
    if (OC.Pick && OC.Pick.guard) OC.Pick.guard(el);
    requestAnimationFrame(() => el.classList.add('on'));
  }

  // ================================================================ the timeline page
  OC.Pages.define('chron17', '時間線', {
    sub: true,
    build(p, el) { p.top = h('div.ch17-top'); p.box = h('div.ch17-list'); el.append(p.top, p.box); p.f = { day: null, who: null, place: null, tab: 'day' }; },
    refresh(p, el) {
      const arg = p.params; p.params = null;
      if (arg) p.f = { day: null, who: null, place: null, tab: 'day' };   /* every opening starts on today, everyone, every place */
      if (arg && arg.day != null) { const ds = C().days(); p.f.day = (!arg.away || C().day(arg.day).length || !ds.length) ? arg.day : (ds.find((d) => d <= arg.day) != null ? ds.find((d) => d <= arg.day) : arg.day); p.f.tab = 'day'; }   /* an absence that ended just after midnight: open on the last day with something in it */
      if (p.f.day == null) p.f.day = Sim().day();
      const C0 = C(), list = p.f.tab === 'fav' ? C0.favs() : C0.day(p.f.day), favN = C0.favs().length;
      const today = p.f.tab === 'day' && p.f.day === Sim().day(), nowSig = today ? Ch().all().map((c) => (OC.LifeUI && OC.LifeUI.doingText ? OC.LifeUI.doingText(c) : '') + (c.life.loc || '')).join('|') : '';
      const sig = JSON.stringify([p.f, list.length, list.length && list[list.length - 1].id, favN, Ch().all().map((c) => c.id), nowSig]); if (p._sig === sig) return; p._sig = sig;
      const places = [...new Set(list.map((x) => plc(x.place)).filter(Boolean))];
      const days = C0.days(), i = days.indexOf(p.f.day), older = i >= 0 ? days[i + 1] : days.find((d) => d < p.f.day), newer = i > 0 ? days[i - 1] : [...days].reverse().find((d) => d > p.f.day);
      const re = () => { p._sig = ''; p.refresh(p, el); };
      const chip = (on, label, attrs, fn) => h('button.chip' + (on ? '.on' : ''), Object.assign({ on: { click: fn } }, attrs), label);
      p.top.replaceChildren(
        h('div.chips', null, chip(p.f.tab === 'day', '時間線', { 'data-tab': 'day' }, () => { p.f.tab = 'day'; re(); }), chip(p.f.tab === 'fav', `收藏 ${favN}`, { 'data-tab': 'fav' }, () => { p.f.tab = 'fav'; re(); })),
        p.f.tab === 'day' ? h('div.ch17-nav', null,
          h('button.icon-btn', { 'aria-label': '前一天', 'data-nav': 'older', disabled: older == null, on: { click: () => { if (older != null) { p.f.day = older; re(); } } } }, OC.UI.icon('back')),
          h('b.grow.center', null, dayLabel(p.f.day)),
          h('button.icon-btn', { 'aria-label': '後一天', 'data-nav': 'newer', disabled: newer == null, on: { click: () => { if (newer != null) { p.f.day = newer; re(); } } } }, OC.UI.icon('next'))) : null,
        p.f.tab === 'day' && list.length ? h('button.btn.s.ch17-play', { 'data-replay': p.f.day, on: { click: () => Replay.open(p.f.day) } }, OC.UI.icon('play', 's'), '回放這一天') : null,
        h('div.chips.scroll', null, chip(!p.f.who, '全員', { 'data-who': '' }, () => { p.f.who = null; re(); }), ...Ch().all().map((c) => chip(p.f.who === c.id, name(c), { 'data-who': c.id }, () => { p.f.who = c.id; re(); }))),
        places.length >= 2 ? h('div.chips.scroll', null, chip(!p.f.place, '所有地點', { 'data-place': '' }, () => { p.f.place = null; re(); }), ...places.map((id) => chip(p.f.place === id, (OC.Places.get(id) || { zh: id }).zh, { 'data-place': id }, () => { p.f.place = p.f.place === id ? null : id; re(); }))) : null,
        today ? h('div.ch17-now', null, h('small.muted', null, '正在發生'), ...Ch().all().filter((c) => !p.f.who || c.id === p.f.who).map((c) => { const P = OC.Places.get(c.life.loc || 'isle'); return h('button.ch17-nowrow', { 'data-now': c.id, on: { click: () => goTo(c.id) } }, av(c), h('div.grow', null, h('b', null, name(c)), h('span', null, [OC.LifeUI && OC.LifeUI.doingText ? OC.LifeUI.doingText(c) : '', P ? P.zh : ''].filter(Boolean).join('・') || '自由活動中'))); })) : null);
      const rows = list.filter((x) => (!p.f.who || x.who.includes(p.f.who)) && (!p.f.place || plc(x.place) === p.f.place)).slice().sort((a, b) => b.gm - a.gm).slice(0, 300);
      p.box.replaceChildren(...(rows.length ? rows.map((x) => row(x, p, re)) : [h('div.muted.card', null, p.f.tab === 'fav' ? '在時間線裡長按一條，就能收藏到這裡。' : '這一天還沒有發生什麼。')]),
        p.f.tab === 'day' ? h('p.muted.center', null, '長按一條＝收藏；點一下＝鏡頭去找那個人；左邊有色條的是你不在時發生的') : null);
    },
  });
  let quietUntil = 0;
  /** the camera goes to that person if they are in this scene; otherwise say where they are */
  function goTo(id) {
    const a = id && OC.App.actorOf(id);
    if (a) { OC.App.tab('island'); setTimeout(() => OC.World.focus(a, 2.2), 250); return; }
    const c = id && Ch().get(id), P = c && OC.Places.get(c.life.loc || 'isle'); OC.UI.toast(c ? `${name(c)}現在在${P ? P.zh : '別的地方'}（地圖可以過去）` : '這件事沒有人在這裡', 'info');
  }
  const plc = (pl) => { const id = String(pl || '').replace('place:', ''); return OC.Places.get(id) ? id : ''; };
  function row(x, p, re) {
    const el = line(x, { tag: C().isFav(x.id) ? '★' : null }); if (x.away) el.classList.add('away');
    let t = 0;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', () => { clearTimeout(t); t = setTimeout(() => { quietUntil = performance.now() + 900;   /* the finger lifting after a long press is not a tap (the list was rebuilt under it) */ const r = C().isFav(x.id) ? (C().unfav(x.id), { ok: true, un: true }) : C().fav(x); OC.UI.toast(r.ok ? (r.un ? '取消收藏' : '收藏了') : r.why, 'star'); OC.UI.haptic && OC.UI.haptic('tick'); re(); }, 550); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => clearTimeout(t));
    el.addEventListener('click', () => { if (performance.now() < quietUntil) return; goTo(x.who[0]); });
    return el;
  }


  // ================================================================ replaying a day (17.1): the timeline played back; changes nothing
  const SPEEDS = [1, 4, 16, 64, 256, 1024], ISLAND_MAX = 64;   /* game minutes per real second; on the island at most 64× */
  const Replay = (() => {
    let R = null;
    function open(day) {
      close();
      const lines = C().day(day).slice().sort((a, b) => a.gm - b.gm); if (!lines.length) { OC.UI.toast('這一天沒有紀錄', 'info'); return; }
      const g0 = day * 1440, el = h('div.rp17', { role: 'dialog', 'aria-label': '回放' });
      R = { day, lines, g0, t: Math.max(0, Math.floor((lines[0].gm - g0) / 10) * 10), speed: 16, playing: true, i: 0, el, island: false, raf: 0, last: performance.now() };
      R.layer = { el, close: () => close() };
      R.clock = h('b.rp17-clock.num'); R.now = h('div.rp17-now'); R.feed = h('div.rp17-feed');
      R.bar = h('input.rp17-bar', { type: 'range', min: 0, max: 1440, step: 1, value: R.t, 'aria-label': '跳到', on: { input: (e) => jump(+e.target.value) } });
      R.play = h('button.icon-btn', { 'aria-label': '暫停', 'data-rp': 'play', on: { click: () => { R.playing = !R.playing; R.last = performance.now(); draw(); } } });
      R.speeds = h('div.chips.rp17-speeds');
      R.mode = h('button.btn.s', { 'data-rp': 'island', on: { click: () => setIsland(!R.island) } });
      el.append(h('div.rp17-head', null, h('div.grow', null, h('small', null, '回放'), h('b', null, dayLabel(day))), R.clock, h('button.icon-btn', { 'aria-label': '關閉', 'data-rp': 'close', on: { click: close } }, OC.UI.icon('close'))),
        R.feed, h('div.rp17-ctl', null, R.now, h('div.hstack', null, R.play, R.bar), R.speeds, h('div.hstack', null, R.mode, h('small.muted.grow', null, '回放只是重看，不會改變任何事'))));
      document.getElementById('app').append(el); OC.UI.pushLayer(R.layer); if (OC.Pick && OC.Pick.guard) OC.Pick.guard(el);
      jump(R.t); draw(); requestAnimationFrame(() => el.classList.add('on'));
      R.raf = requestAnimationFrame(tick);
    }
    function close() {
      if (!R) return; const x = R; R = null; cancelAnimationFrame(x.raf); OC.UI.popLayer(x.layer); x.el.remove();
      document.documentElement.classList.remove('rp17-island');
    }
    /** move to a minute of the day: everything before it is shown, nothing is re-spoken */
    function jump(t) {
      R.t = Math.max(0, Math.min(1440, t)); R.i = R.lines.findIndex((x) => x.gm - R.g0 > R.t); if (R.i < 0) R.i = R.lines.length;
      R.feed.replaceChildren(...R.lines.slice(0, R.i).slice(-60).map(row17)); R.feed.scrollTop = R.feed.scrollHeight; draw();
    }
    const row17 = (x) => { const el = line(x); el.addEventListener('click', () => jump(x.gm - R.g0 - 0.01)); return el; };
    function show(x) {
      R.feed.append(row17(x)); while (R.feed.children.length > 60) R.feed.firstChild.remove(); R.feed.scrollTop = R.feed.scrollHeight;
      R.now.textContent = x.text;
      if (R.island && x.who[0]) {   /* on the island: the one it was about says it again (a thought: no voice), the camera looks — nothing else */
        const a = OC.App.actorOf(x.who[0]); if (a) { OC.App.bubble(a, trimName(x.text, name(Ch().get(x.who[0]) || {})), null, 2.6, { thought: true }); if (R.speed <= 16 && x.k !== 'act') OC.World.focus(a, 2.2); }
      }
    }
    function tick(now) {
      if (!R) return; const dt = Math.min(0.25, (now - R.last) / 1000); R.last = now;
      if (R.playing) {
        R.t = Math.min(1440, R.t + dt * R.speed);
        let n = 0; while (R.i < R.lines.length && R.lines[R.i].gm - R.g0 <= R.t && n++ < 40) show(R.lines[R.i++]);
        if (R.t >= 1440) R.playing = false;
        draw();
      }
      R.raf = requestAnimationFrame(tick);
    }
    function setIsland(v) {
      R.island = v; if (v) { OC.UI.popLayer(R.layer); OC.App.tab('island'); OC.UI.pushLayer(R.layer); if (R.speed > ISLAND_MAX) R.speed = ISLAND_MAX; }   /* tab() closes every layer: step out of the stack for it */
      document.documentElement.classList.toggle('rp17-island', v); R.el.classList.toggle('mini', v); draw();
    }
    let sigD = '';
    function draw() {
      if (!R) return; const m = Math.floor(R.t), sig = [m, R.playing, R.speed, R.island].join();
      if (sig === sigD) return; sigD = sig;
      R.clock.textContent = hm(R.g0 + m); if (+R.bar.value !== m) R.bar.value = m;
      R.play.replaceChildren(OC.UI.icon(R.playing ? 'pause' : 'play')); R.play.setAttribute('aria-label', R.playing ? '暫停' : '播放');
      R.speeds.replaceChildren(...SPEEDS.filter((v) => !R.island || v <= ISLAND_MAX).map((v) => h('button.chip' + (R.speed === v ? '.on' : ''), { 'data-speed': v, on: { click: () => { R.speed = v; R.playing = true; R.last = performance.now(); draw(); } } }, `${v}×`)));
      R.mode.replaceChildren(OC.UI.icon(R.island ? 'layers' : 'eye', 's'), R.island ? '回到清單' : '在島上看');
    }
    return { open, close, get state() { return R ? { day: R.day, t: R.t, i: R.i, n: R.lines.length, speed: R.speed, playing: R.playing, island: R.island } : null; }, jump: (t) => R && jump(t), SPEEDS };
  })();

  // ================================================================ the end of a day you watched
  function dayCard(d, from) {
    if (Sim().catching || S().life.settings.away17 === false) return;
    const e = C().closeDay(from); if (!e || !e.n) return;
    if (OC.Stage && OC.Stage.card) OC.Stage.card({ kind: 'day', ic: 'clock', title: `${OC.Clock.cal ? OC.Clock.cal(from).text : '這一天'} 結束了`, sub: [e.big ? `${e.n} 件事・${e.big} 件大事（時間線看得到）` : `${e.n} 件事（時間線看得到）`].concat(ahead(d)).join('｜'), ms: 5200 });
  }
  /** what the new day holds: birthdays and plans (only what is really set) */
  function ahead(d) {
    const out = [];
    try { for (const b of (OC.Island && OC.Island.birthdays ? OC.Island.birthdays() : [])) if (b.today) out.push(`今天是${name(b.c)}的生日`); } catch (e) { /* no birthdays */ }
    try { for (const p of (OC.Outing16 ? OC.Outing16.plans() : [])) if (p.day === d && p.status === 'planned') { const P = OC.Places.get(p.place); out.push(`${String(p.hour).padStart(2, '0')}:00 ${[p.host].concat(p.guests.filter((g) => p.rsvp[g] && p.rsvp[g].yes)).map((id) => name(Ch().get(id) || {})).join('、')}要去${P ? P.zh : ''}`); } } catch (e) { /* no plans */ }
    return out.slice(0, 3);
  }

  function init() {
    OC.Store.on('away:digest', (info) => setTimeout(() => showAway(info), 700));
    Sim().onDay(dayCard);
  }
  OC.AwayUI = { init, showAway, Replay, get open() { return !!open; } };
})();
