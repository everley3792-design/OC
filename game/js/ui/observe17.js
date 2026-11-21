/* OC Shimeji 17.2 — observation mode (OC.Observe).
 *
 * One switch (the tools rail, or the time panel) turns the island into something you watch rather than play:
 *   - the play buttons go away; what stays is the time, the timeline, the floor plan and a bar of everyone's faces;
 *   - the character you play (and anyone set to 手動) lives on its own (全自動) — leaving restores every mode, the speed
 *     and who you play, exactly as they were;
 *   - tap a face: the camera follows that person and a card says what they are doing now, how they are (energy, food,
 *     mood), what happened to them today and how things are with the people closest to them;
 *   - the camera goes by itself to what is happening (an event, a gathering, a conversation, someone upset) unless you
 *     turn that off; picking someone yourself keeps the camera on them for a while;
 *   - in the game-cycle time mode the island can run at 1× 2× 5× 10× 30× 60× (walking speeds up a little with it).
 * The floor plan (page plan17) draws each home from above (2D) with a dot for everyone inside; a dot follows that person.
 * Nothing here changes the save except the modes that are switched (and put back): it only reads and moves the camera.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = () => OC.Store, Ch = () => OC.Chars, B = () => OC.Brain, A = () => OC.App, W = () => OC.World, Sim = () => OC.Sim, M = () => OC.Mind;
  const h = (...a) => OC.UI.h(...a), name = (c) => Ch().name(c), haptic = (k) => OC.UI.haptic && OC.UI.haptic(k);
  const SPEEDS = [1, 2, 5, 10, 30, 60];
  const MANUAL_HOLD = 40000;   /* picking someone yourself keeps the director away this long (ms) */
  const DIRECT_EVERY = 6000;   /* the director looks for something better at most this often (ms) */
  function st() { const L = S().life; L.obs17 = Object.assign({ on: false, auto: true, prev: null, follow: null }, L.obs17 || {}); return L.obs17; }
  const on = () => !!(S() && S().life && S().life.obs17 && S().life.obs17.on);
  const placeZh = (id) => ((OC.Places && OC.Places.get(id)) || {}).zh || '';
  const here = () => (W().area && W().area.id) || null;
  const locOf = (c) => (c.id === S().activeId ? here() : c.life.loc || 'isle');
  const actorOf = (id) => (A() && A().actorOf ? A().actorOf(id) : null);

  /* ---------------- entering / leaving ---------------- */
  function make(id) {   /* the one you play (or anyone on 手動) lives on its own while you watch — remember what it was */
    const s = st(), c = Ch().get(id); if (!c || !s.prev) return;
    const m = c.life.control || 'semi'; if (m === 'auto' || s.prev.ctl[id] != null) return;
    if (id === S().activeId || m === 'manual') { s.prev.ctl[id] = m; B().setControl(id, 'auto'); }
  }
  function enter() {
    const s = st(); if (s.on) return false;
    if (OC.Radial && OC.Radial.open_) OC.Radial.close(true);
    if (OC.Pick && OC.Pick.hide) OC.Pick.hide();
    A().tab('island'); A().stopObserve && A().stopObserve();
    s.on = true; s.follow = null; s.prev = { ctl: {}, speed: Sim().speed(), active: S().activeId };
    for (const c of Ch().all()) make(c.id);
    lastDirect = 0; manualAt = 0; St().touch('life', { k: 'obs17', on: true }); St().emit('obs:on');
    apply(); return true;
  }
  function leave() {
    const s = st(); if (!s.on) return false;
    s.on = false; const p = s.prev || { ctl: {} }; s.prev = null; s.follow = null;
    for (const [id, m] of Object.entries(p.ctl)) { const c = Ch().get(id); if (c && c.life.control === 'auto') B().setControl(id, m); }
    if (Sim().speed() !== p.speed) Sim().setSpeed(p.speed || 1);
    W().setWalkMul && W().setWalkMul(1); W().focus(null);
    if (p.active && p.active !== S().activeId && Ch().get(p.active)) { Ch().setActive(p.active); A().refreshActors(); }
    St().touch('life', { k: 'obs17', on: false }); St().emit('obs:off');
    apply(); return true;
  }
  const toggle = () => (on() ? leave() : enter());

  /* ---------------- the bar ---------------- */
  let el = null, ppl = null, card = null, cap = null, ctl = null, pplKey = '', cardKey = '', cardId = null, ctlKey = '';
  function apply() {
    const root = document.documentElement, o = on(); root.classList.toggle('obs17-on', o);
    if (!o) { if (el) { el.remove(); el = null; } cardId = null; return; }
    if (!el) build(); pplKey = ''; ctlKey = ''; refresh(true);
  }
  function build() {
    el = h('div.obs17', { role: 'region', 'aria-label': '觀察模式' });
    const top = h('div.obs17-top', null,
      h('button.obs17-btn', { 'data-obs': 'chron', 'aria-label': '時間線', on: { click: () => { haptic('tick'); OC.Pages.open('chron17', cardId ? { day: Sim().day(), who: cardId } : { day: Sim().day() }); } } }, OC.UI.sticker('book', 's'), h('small', null, '時間線')),
      h('button.obs17-btn', { 'data-obs': 'plan', 'aria-label': '戶型總覽', on: { click: () => { haptic('tick'); OC.Pages.open('plan17', {}); } } }, OC.UI.sticker('home', 's'), h('small', null, '戶型')),
      h('button.obs17-btn.end', { 'data-obs': 'end', 'aria-label': '結束觀察', on: { click: () => { haptic('tick'); leave(); } } }, OC.UI.sticker('eye', 's'), h('small', null, '結束觀察')));
    cap = h('div.obs17-cap', { 'aria-live': 'polite', hidden: true });
    card = h('div.obs17-card', { role: 'dialog', 'aria-label': '人物卡', hidden: true });
    ppl = h('div.obs17-ppl', { role: 'list', 'aria-label': '人物' });
    ctl = h('div.obs17-ctl');
    el.append(top, cap, h('div.obs17-dock', null, card, h('div.obs17-bar', null, ppl, ctl)));
    document.getElementById('app').append(el);
  }
  function faces() {
    const all = Ch().all(), key = all.map((c) => [c.id, name(c), c.look && c.look.shirt, c.appearance && c.appearance.mode].join(':')).join('|'); if (key === pplKey) return; pplKey = key;
    ppl.replaceChildren(...all.map((c) => {
      const cv = h('canvas', { width: 96, height: 96, 'aria-hidden': 'true' });
      try { OC.CharRender.portrait(cv, c, { pose: { action: 'idle', face: 0.2 }, t: 0 }); } catch (e) { /* a broken image: the name still shows */ }
      return h('button.obs17-p', { role: 'listitem', 'data-oc': c.id, 'aria-label': name(c), on: { click: () => { haptic('tick'); pick(c.id); } } }, h('span.obs17-av', null, cv), h('b.ellipsis', null, name(c)), h('small.ellipsis', null, ''));
    }));
  }
  function marks() {
    const s = st();
    for (const b of ppl.querySelectorAll('.obs17-p')) {
      const c = Ch().get(b.dataset.oc); if (!c) continue;
      const loc = locOf(c), away = loc !== here(), trip = c.life.trip, sub = trip ? '在路上' : away ? placeZh(loc) : (OC.LifeUI.doingText(c) || '');
      b.classList.toggle('on', s.follow === c.id); b.classList.toggle('away', away || !!trip);
      const sm = b.querySelector('small'); if (sm.textContent !== sub) sm.textContent = sub;
    }
  }
  function controls() {
    const s = st(), cyc = Sim().mode() === 'cycle', key = [cyc, Sim().speed(), s.auto, S().settings.timePaused].join('|'); if (key === ctlKey) return; ctlKey = key;
    const auto = h('button.chip-btn' + (s.auto ? '.on' : ''), { 'data-obs': 'auto', 'aria-pressed': s.auto ? 'true' : 'false', on: { click: () => { haptic('tick'); s.auto = !s.auto; if (s.auto) manualAt = 0; St().touch('life'); ctlKey = ''; controls(); } } }, '🎥 自動鏡頭');
    const sp = cyc ? OC.UI.seg(SPEEDS.map((v) => [String(v), '×' + v]), String(Sim().speed()), (v) => { setSpeed(+v); }) : h('button.chip-btn', { 'data-obs': 'time', on: { click: () => A().timePanel() } }, '時間：遊戲循環才能加速');
    if (cyc) sp.classList.add('obs17-speed');
    ctl.replaceChildren(auto, sp);
  }
  function setSpeed(v) { if (!SPEEDS.includes(v) || Sim().mode() !== 'cycle') return false; Sim().setSpeed(v, { obs: true }); ctlKey = ''; controls(); walk(); return true; }
  const walk = () => { const v = on() ? Sim().speed() : 1; W().setWalkMul && W().setWalkMul(v >= 30 ? 2 : v >= 10 ? 1.6 : v >= 5 ? 1.3 : 1); };

  /* ---------------- following ---------------- */
  let manualAt = 0, lastDirect = 0, why = '';
  function pick(id, world) {
    manualAt = Date.now(); if (!card) apply();
    if (cardId === id && !card.hidden && !world) { cardId = null; card.hidden = true; return; }   /* the face again closes the card (a tap on the character itself keeps it) */
    follow(id, null); cardId = id; cardKey = ''; showCard();
  }
  function follow(id, reason) {
    const s = st(); s.follow = id; why = reason || '';
    const a = actorOf(id); if (a) W().focus(a, 2.3);
    caption();
  }
  /** someone in another place: the view goes there (you play them while watching; leaving the mode puts the one you played back) */
  function visit(id) {
    const c = Ch().get(id); if (!c || id === S().activeId) return false;
    if (OC.Mini && OC.Mini.wheelRiding && OC.Mini.wheelRiding()) return false;
    make(id); Ch().setActive(id); A().refreshActors(); make(id); st().follow = id; manualAt = Date.now(); return true;
  }
  function caption() {
    const s = st(), c = s.follow && Ch().get(s.follow); if (!cap) return;
    const t = c ? (why ? `🎥 ${why}` : `🎥 ${name(c)}`) : ''; if (cap.textContent !== t) cap.textContent = t; cap.hidden = !t;
  }
  /** what is worth watching right now (only people in front of the camera) */
  function hot() {
    const out = [], add = (id, sc, w) => { if (id && actorOf(id)) out.push({ id, sc, why: w }); };
    const ev = OC.Events && OC.Events.current; if (ev && ev.cast && ev.cast.a && ev.cast.a.id) add(ev.cast.a.id, 100, (ev.ev && ev.ev.zh) || '有事情發生了');
    const ar = OC.Arcs && OC.Arcs.running; if (ar && ar.ids && ar.ids.length) add(ar.ids[0], 80, `${ar.ids.length} 個人聚在一起`);
    for (const cv of (B().convs || [])) if (cv.st === 'talk' && cv.a && cv.b) { const a = Ch().get(cv.a.id), b = Ch().get(cv.b.id); if (a && b) add(a.id, 50 + (OC.Arcs && OC.Arcs.cold(a.id, b.id) ? 20 : 0), `${name(a)}和${name(b)}在${((OC.LifeData.SOCIAL || {})[cv.kind] || {}).zh || '說話'}`); }
    for (const c of Ch().all()) { const e = M().dominant(c); if (['lonely', 'down', 'annoyed', 'jealous', 'nervous'].includes(e)) add(c.id, 30, `${name(c)}${M().label(c)}`); }
    return out.sort((a, b) => b.sc - a.sc);
  }
  function direct(now) {
    const s = st(); if (!s.auto || now - manualAt < MANUAL_HOLD || now - lastDirect < DIRECT_EVERY) return;
    if (document.documentElement.classList.contains('cinema')) return;   /* a cut-scene owns the camera */
    lastDirect = now; const best = hot()[0], cur = s.follow && hot().find((x) => x.id === s.follow);
    if (best && (!cur || best.sc > cur.sc + 15) && best.id !== s.follow) { follow(best.id, best.why); if (cardId) { cardId = best.id; cardKey = ''; } }
    else if (!best && !actorOf(s.follow)) { follow(S().activeId, null); }
  }

  /* ---------------- the person card ---------------- */
  const bar = (zh, v) => h('div.obs17-need', null, h('span', null, zh), h('i', { style: { '--v': Math.max(0, Math.min(100, v | 0)) + '%' } }), h('small.num', null, String(Math.round(v))));
  function today(id) {
    const day = Sim().day(), L = (OC.Chronicle ? OC.Chronicle.day(day) : []).filter((x) => x.who.includes(id));
    const big = L.filter((x) => x.k !== 'act'), pick2 = (big.length ? big : L).slice(-3).reverse();
    return pick2.map((x) => h('li', null, h('small.num', null, hhmm(x.gm)), ' ', x.text));
  }
  const hhmm = (gm) => { const m = Math.floor(((gm % 1440) + 1440) % 1440); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  function close(id) {   /* the people this one is closest to, and how it is going */
    const out = [];
    for (const o of Ch().all()) { if (o.id === id) continue; const r = M().relPeek(id, o.id); if (!r) continue; out.push({ o, r, s: (r.aff || 0) + (r.fam || 0) * 0.5 }); }
    return out.sort((a, b) => b.s - a.s).slice(0, 3).map(({ o, r }) => {
      const cold = OC.Arcs && OC.Arcs.cold(id, o.id), rift = OC.Arcs && OC.Arcs.riftOf(id, o.id);
      const how = cold ? '鬧得有點僵' : rift && rift.stage === 'thaw' ? '慢慢和好中' : (r.aff || 0) >= 60 ? '很要好' : (r.aff || 0) >= 25 ? '處得不錯' : (r.aff || 0) <= -20 ? '不太合' : '普通';
      return h('li', null, h('b', null, name(o)), ` ${M().relLabel(r)}・${how}`);
    });
  }
  function showCard() {
    if (!card || !cardId) return; const c = Ch().get(cardId); if (!c) { cardId = null; card.hidden = true; return; }
    const b = B().get(c.id), loc = locOf(c), away = loc !== here(), doing = c.life.trip ? `在去${placeZh(c.life.trip.to) || '別處'}的路上` : OC.LifeUI.doingText(c) || '沒有特別在做什麼';
    const T = today(c.id), R = close(c.id), n = c.needs || {};
    const key = JSON.stringify([c.id, doing, loc, Math.round((n.energy || 0) / 4), Math.round((n.food || 0) / 4), Math.round((n.mood || 0) / 4), M().label(c), T.length && T[0].textContent, R.map((x) => x.textContent), b && b.dbg && b.dbg.reason]);
    card.hidden = false; if (key === cardKey) return; cardKey = key;
    card.replaceChildren(
      h('div.obs17-ch', null, h('b', null, name(c)), h('span.muted', null, `${placeZh(loc)}・${M().label(c)}`), h('button.obs17-x', { 'aria-label': '關閉人物卡', on: { click: () => { cardId = null; card.hidden = true; } } }, '×')),
      h('div.obs17-now', null, h('span.obs17-k', null, '現在'), doing, b && b.dbg && b.dbg.reason ? h('small.muted', null, `（${b.dbg.reason}）`) : null),
      h('div.obs17-needs', null, bar('精力', n.energy || 0), bar('飽腹', n.food || 0), bar('心情', n.mood || 0)),
      h('div.obs17-sec', null, h('span.obs17-k', null, '今天'), T.length ? h('ul', null, ...T) : h('small.muted', null, '今天還沒有什麼事')),
      h('div.obs17-sec', null, h('span.obs17-k', null, '和誰'), R.length ? h('ul', null, ...R) : h('small.muted', null, '還沒有認識的人')),
      away && !c.life.trip ? h('button.btn.s.primary', { 'data-obs': 'visit', on: { click: () => { haptic('tick'); visit(c.id); } } }, `去${placeZh(loc)}看看`) : null);
  }

  /* ---------------- each frame (called by the app loop; only UI and the camera) ---------------- */
  let t = 0;
  function tick(dt) {
    if (!on()) return; t += dt; if (t < 0.5) return; t = 0;
    if (!el) apply();
    const s = st(), now = Date.now();
    faces(); marks(); controls(); walk();
    if (s.follow) { const a = actorOf(s.follow); if (a && W().camTarget !== a && !document.documentElement.classList.contains('cinema')) W().focus(a); }
    direct(now); caption(); showCard();
  }
  /** a tap in the world while watching: a character = follow it and show its card; anywhere else closes the card */
  function onTap(r) {
    const it = r && r.it;
    if (it && (it.type === 'self' || it.type === 'mate')) { pick(it.type === 'self' ? S().activeId : it.id, true); return true; }
    if (cardId) { cardId = null; card.hidden = true; }
    return true;
  }
  function refresh(force) { if (force) { pplKey = ''; ctlKey = ''; cardKey = ''; } if (!el) return; faces(); marks(); controls(); caption(); showCard(); }

  /* ---------------- floor plan (2D, from above) ---------------- */
  const HOMES = ['home', 'yhouse', 'phouse'];
  const homes = () => HOMES.filter((id) => OC.Areas[id] && OC.Areas[id].room && !((OC.Places.get(id) || {}).locked));
  /** where everyone in a place is on its plan: { id, x, y, exact } (exact = seen on screen; otherwise where they were last / their bed) */
  function dots(pl) {
    const R = OC.Areas[pl].room, out = []; let k = 0;
    for (const c of Ch().all()) {
      if (locOf(c) !== pl || (c.life.trip && c.life.trip.eta > Sim().now())) continue;
      const a = pl === here() ? actorOf(c.id) : null;
      if (a) { out.push({ id: c.id, x: a.x, y: a.y, exact: true }); continue; }
      const p = c.life.pos && c.life.pos.area === pl ? c.life.pos : null;
      if (p && p.x > R.x0 && p.x < R.x1 && p.y > R.y0 && p.y < R.y1) out.push({ id: c.id, x: p.x, y: p.y, exact: false });
      else { const cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2; out.push({ id: c.id, x: cx + ((k % 3) - 1) * 30, y: cy + Math.floor(k / 3) * 24, exact: false }); k++; }
    }
    return out;
  }
  function furn(pl) {
    const SIN = Math.sin(50 * Math.PI / 180);
    return (OC.Places.room(pl) || []).map((f) => { const it = OC.Style.ITEMS[f.id] || {}, fp = it.fp || [1, 1], sc = f.sc || 1, rot = (f.rot || 0) % 2; return { id: f.id, zh: it.zh || '', x: f.x, y: f.y, w: (rot ? fp[1] : fp[0]) * 18 * sc, h: (rot ? fp[0] : fp[1]) * 18 * SIN * sc, wall: !!f.wall }; });
  }
  const css = (v, d) => (getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d);
  function drawPlan(cv, pl, list) {
    const R = OC.Areas[pl].room, pad = 14, dpr = Math.min(2, window.devicePixelRatio || 1), cw = cv.clientWidth || 320;
    const sc = (cw - pad * 2) / (R.x1 - R.x0), chh = Math.round((R.y1 - R.y0) * sc + pad * 2 + 18);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(chh * dpr); cv.style.height = chh + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, chh);
    const X = (x) => pad + (x - R.x0) * sc, Y = (y) => pad + (y - R.y0) * sc;
    g.fillStyle = css('--surface-2', '#F3E7D3'); g.strokeStyle = css('--ink-2', '#7A5C46'); g.lineWidth = 3;
    g.beginPath(); g.roundRect ? g.roundRect(X(R.x0), Y(R.y0), (R.x1 - R.x0) * sc, (R.y1 - R.y0) * sc, 8) : g.rect(X(R.x0), Y(R.y0), (R.x1 - R.x0) * sc, (R.y1 - R.y0) * sc); g.fill(); g.stroke();
    const dx = OC.Areas[pl].door || { x: (R.x0 + R.x1) / 2 }; g.fillStyle = css('--accent', '#5CC6A0'); g.fillRect(X(dx.x) - 14, Y(R.y1) - 2, 28, 5);
    g.font = '11px ' + css('--font', 'sans-serif'); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const f of furn(pl)) { if (f.wall) continue; g.fillStyle = css('--surface-3', '#E6D3B5'); g.strokeStyle = css('--line', '#CDB596'); g.lineWidth = 1; g.fillRect(X(f.x - f.w / 2), Y(f.y - f.h / 2), f.w * sc, f.h * sc); g.strokeRect(X(f.x - f.w / 2), Y(f.y - f.h / 2), f.w * sc, f.h * sc); const lw = f.w * sc; if (lw > 14) { g.fillStyle = css('--ink-3', '#9C8470'); g.fillText(f.zh.slice(lw > 26 ? -2 : -1), X(f.x), Y(f.y)); } }   /* a narrow piece (bed, lamp) still says what it is in one character */
    const hits = [];
    for (const d of list) {
      const c = Ch().get(d.id), x = X(d.x), y = Y(d.y), col = (c.look && c.look.shirt) || '#5BC0EB';
      g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fillStyle = d.exact ? col : css('--surface', '#FFF8EC'); g.fill(); g.lineWidth = 3; g.strokeStyle = col; g.stroke();
      g.fillStyle = css('--ink', '#4A3426'); g.font = 'bold 11px ' + css('--font', 'sans-serif'); g.fillText(name(c), x, y + 18);
      hits.push({ id: d.id, x, y });
    }
    return hits;
  }
  const PLAN = {
    sub: true,
    build(p, el) { p.tabs = h('div.plan17-tabs'); p.cv = h('canvas.plan17-cv', { 'aria-label': '戶型俯瞰圖' }); p.note = h('div.muted.plan17-note'); p.out = h('div.plan17-out'); el.append(p.tabs, h('div.plan17-box', null, p.cv), p.note, p.out); p.hits = []; p.cv.addEventListener('click', (e) => { const r = p.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; const hit = p.hits.find((d) => Math.hypot(d.x - x, d.y - y) < 18); if (hit) { haptic('tick'); goTo(hit.id); } }); },
    refresh(p) {
      const arg = p.params; p.params = null; const hs = homes(); if (!hs.length) { p.note.textContent = '還沒有可以看的住處'; return; }
      if (arg && arg.place && hs.includes(arg.place)) p.pl = arg.place; if (!p.pl || !hs.includes(p.pl)) p.pl = hs.includes(here()) ? here() : hs[0];
      const list = dots(p.pl), outside = Ch().all().filter((c) => !list.some((d) => d.id === c.id));
      const sig = JSON.stringify([p.pl, hs, list.map((d) => [d.id, Math.round(d.x / 6), Math.round(d.y / 6), d.exact]), outside.map((c) => [c.id, locOf(c), !!c.life.trip]), (OC.Places.room(p.pl) || []).length]); if (p._sig === sig) return; p._sig = sig;
      p.tabs.replaceChildren(...hs.map((id) => { const n = dots(id).length; return h('button.chip' + (id === p.pl ? '.on' : ''), { 'data-plan': id, on: { click: () => { haptic('tick'); p.pl = id; p._sig = ''; PLAN.refresh(p); } } }, placeZh(id), n ? h('small.num', null, ' ' + n) : null); }));
      p.hits = drawPlan(p.cv, p.pl, list);
      p.note.textContent = (list.length ? list.some((d) => !d.exact) ? '實心＝現在看到的位置；空心＝大概在這裡（不在畫面上）' : '點圓點：鏡頭跟著那個人' : '現在沒有人在這裡') + '・每間住處都是一層';
      p.out.replaceChildren(...(outside.length ? [h('b', null, '不在這裡')] : []), ...outside.map((c) => h('button.chip', { 'data-plan-oc': c.id, on: { click: () => goTo(c.id) } }, name(c), h('small', null, ' ' + (c.life.trip ? '在路上' : placeZh(locOf(c)))))));
    },
  };
  OC.Pages && OC.Pages.define('plan17', '戶型總覽', PLAN);
  /** from the plan: close it and watch that person (another place = the view goes there) */
  function goTo(id) {
    OC.UI.back && OC.UI.back(); if (!on()) enter();
    const c = Ch().get(id); if (!c) return;
    if (actorOf(id)) { manualAt = Date.now(); follow(id, null); cardId = id; cardKey = ''; showCard(); }
    else if (!c.life.trip) visit(id);
  }

  function init() {
    if (on()) setTimeout(apply, 0);   /* reopened while watching: the bar comes back (the modes were kept in the save) */
    St().on('chars', (e) => { if (on() && e && e.active) { make(S().activeId); pplKey = ''; } });
  }
  OC.Observe = { init, enter, leave, toggle, tick, onTap, pick, follow, visit, setSpeed, hot, dots, homes, refresh, goTo, SPEEDS, get on() { return on(); }, get state() { return st(); }, get card() { return cardId; } };
})();
