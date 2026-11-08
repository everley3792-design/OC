/* OC Shimeji — app shell: boot, theme, performance modes, HUD, tab bar, quick bag, world
 * interactions, dialogue, furniture placement, travel, desktop-pet export and the native
 * bridge hooks (window.OCApp). Owns the single requestAnimationFrame loop.
 */
(function () {
  'use strict';
  const { h, icon, toast, sheet, haptic } = OC.UI;
  const St = OC.Store, S = () => St.s, Gm = OC.Game, Sty = OC.Style, Wd = OC.World;
  const $ = (s) => document.querySelector(s);
  const NATIVE = St.NATIVE;
  let player = null, npcs = {}, curTab = 'island', decorate = false, placing = null, dlgOpen = null, paused = false;
  const overlays = () => $('#overlays');

  // =============================== theme ===============================
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  let nativeSysDark = null;
  function sysDark() { if (nativeSysDark != null) return nativeSysDark; try { if (NATIVE) return NATIVE.isSystemDark(); } catch (e) { /* */ } return mq ? mq.matches : false; }
  function applyTheme() { const m = S().settings.theme, dark = m === 'dark' || (m === 'system' && sysDark()); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }
  function setTheme(mode) { S().settings.theme = mode; St.touch('settings'); applyTheme(); if (NATIVE) try { NATIVE.setThemeMode(mode); } catch (e) { /* */ } }
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);

  // =============================== performance ===============================
  const DPR = Math.min(window.devicePixelRatio || 1, 3);
  function perfOf(mode) {
    const c = S().settings.custom;
    switch (mode) {
      case 'high': return { ratio: Math.min(DPR, 2), shadows: 2048, fx: true, grass: 1, fps: 60, bb: 320, lights: true };
      case 'saver': return { ratio: 1, shadows: 0, fx: false, grass: 0, fps: 30, bb: 192, lights: false };
      case 'custom': return { ratio: Math.min(DPR, c.scale), shadows: c.shadows === 'off' ? 0 : c.shadows === 'high' ? 2048 : 1024, fx: c.fx, grass: c.grass ? 0.8 : 0, fps: c.fps, bb: c.scale >= 1.75 ? 320 : c.scale >= 1.25 ? 256 : 192, lights: c.shadows !== 'off' };
      default: return { ratio: Math.min(DPR, 1.5), shadows: 1024, fx: true, grass: 0.6, fps: 60, bb: 256, lights: true };
    }
  }
  let Q = null;
  function applyPerf() { Q = perfOf(S().settings.perf); Wd.setQuality(Q); fpsEl.hidden = !S().settings.showFps; }
  function applyMotion() { const r = S().settings.reduceMotion; document.documentElement.classList.toggle('reduce-motion', r); Wd.reduce = r; }

  // =============================== live portraits ===============================
  // a canvas that shows a character with idle life (blink / breath); fn() → { char, pose }
  const lives = [];
  function live(canvas, fn) { lives.push({ canvas, fn, blinkAt: performance.now() + 2000, t0: performance.now() }); }
  let lastLive = 0;
  function drawLives(now) {
    if (now - lastLive < 66) return; lastLive = now;
    for (const L of lives) {
      if (!L.canvas.isConnected || L.canvas.offsetParent === null) continue;
      const o = L.fn(); if (!o || !o.char) continue;
      if (now > L.blinkAt + 130) L.blinkAt = now + 2200 + Math.random() * 2600;
      const pose = Object.assign({ action: 'idle', at: (now - L.t0) / 1000, blink: now > L.blinkAt ? 1 : 0, breath: Math.sin(now / 600) }, o.pose || {});
      OC.CharRender.portrait(L.canvas, o.char, { pose, t: (now - L.t0) / 1000, fill: o.fill });
    }
  }

  // =============================== HUD ===============================
  let hud = {}, fpsEl;
  function buildHUD() {
    const el = $('#hud');
    hud.av = h('canvas', { width: 96, height: 96 }); hud.name = h('div.name'); hud.mood = h('div.mood');
    hud.me = h('button.hud-me', { 'aria-label': '我的角色', on: { click: () => tab('char') } }, h('div.avatar', null, hud.av), h('div', null, hud.name, hud.mood));
    hud.time = h('span.num'); hud.wx = h('span'); hud.wxIc = h('span');
    hud.coins = h('span.num');
    hud.deco = h('button.icon-btn', { 'aria-label': '佈置模式', on: { click: () => setDecorate(!decorate) } }, icon('sofa'));
    hud.badge = h('span.badge.num'); hud.bell = h('button.icon-btn.hud-bell', { 'aria-label': '通知', hidden: true, on: { click: () => OC.LifeUI.notices() } }, icon('bell'), hud.badge);
    el.append(hud.me, h('div.hud-right', null, h('button.hud-time', { 'aria-label': '時間與天氣', on: { click: () => timeSheet() } }, hud.wxIc, hud.time, h('span.faint', null, '・'), hud.wx), h('div.hstack', { style: { gap: '6px' } }, h('div.chip', { 'aria-label': '星幣' }, h('span', { style: { color: 'var(--sun)', display: 'grid' } }, icon('coin', 's')), hud.coins), hud.bell, hud.deco)));
    live(hud.av, () => ({ char: me(), pose: Object.assign({ face: 0.2 }, moodPose()) }));
    hud.mood.classList.add('ellipsis');
    fpsEl = h('div.fps'); $('#app').append(fpsEl);
    updateHUD();
  }
  let lastHudKey = '';
  function updateHUD() {
    const L = OC.Clock.label(), c = me(), doing = OC.LifeUI.doingText(c), nn = OC.LifeUI.noticeCount();
    const key = [OC.Chars.name(c), OC.Mind.label(c), doing, L.time, L.wx, S().coins, L.date, nn].join('|');
    if (key === lastHudKey) return; lastHudKey = key;
    hud.name.textContent = OC.Chars.name(c); hud.mood.textContent = `${OC.Mind.label(c)}${doing ? '・' + doing : ''}`;
    hud.bell.hidden = !nn; hud.badge.textContent = nn > 9 ? '9+' : nn;
    hud.time.textContent = `${L.date} ${L.time}`; hud.wx.textContent = L.wxZh; hud.wxIc.replaceChildren(icon(L.phase === 'night' ? 'moon' : L.wxIcon, 's'));
    hud.coins.textContent = S().coins.toLocaleString();
  }
  function timeSheet() {
    const L = OC.Clock.label();
    sheet('時間與天氣', (b) => b.append(h('div.list', null, OC.UI.row(L.phase === 'night' ? 'moon' : 'sun', `${L.date}（${L.week}）${L.time}`, S().settings.time === 'real' ? '跟隨手機的真實時間' : S().settings.time === 'cycle' ? `自動循環・速度 ×${OC.Sim.speed()}（一天約 ${Math.round(24 / OC.Sim.speed())} 分鐘）` : `固定為${L.phaseZh}（設定中可改回現實）`), OC.UI.row(L.wxIcon, `天氣：${L.wxZh}`, S().settings.weather === 'auto' ? '每 6 小時依日期自動變化' : '固定天氣（設定中可改回自動）')), h('button.btn.block', { style: { marginTop: '12px' }, on: { click: () => { OC.UI.back(); OC.Pages.open('settings'); } } }, icon('gear', 's'), '在設定中調整')));
  }

  // =============================== tab bar ===============================
  const TABS = [['island', '小島', 'island'], ['char', '角色', 'person'], ['workshop', '工坊', 'brush'], ['explore', '探索', 'compass'], ['more', '日常', 'flag']];
  let tabEls = {}, ink;
  function buildTabbar() {
    const bar = h('nav.tabbar', { 'aria-label': '主選單' }); ink = h('div.tab-ink'); bar.append(ink);
    TABS.forEach(([id, label, ic], i) => { const b = h('button.tab', { 'aria-label': label, on: { click: () => { haptic(); tab(id); } } }, icon(ic), label); b.dataset.i = i; tabEls[id] = b; bar.append(b); });
    $('#app').append(bar);
  }
  function tab(id) {
    // close sub pages / sheets first
    while (OC.UI.stack.length) { const top = OC.UI.stack[OC.UI.stack.length - 1]; top.close(); if (OC.UI.stack[OC.UI.stack.length - 1] === top) OC.UI.stack.pop(); }
    if (placing) cancelPlacement();
    for (const [t] of TABS) if (t !== 'island' && t !== id) OC.Pages.close(t);
    curTab = id;
    Object.entries(tabEls).forEach(([k, b]) => { b.classList.toggle('on', k === id); b.setAttribute('aria-current', k === id ? 'page' : 'false'); });
    ink.style.transform = `translateX(${TABS.findIndex((t) => t[0] === id) * 100}%)`;
    const isl = id === 'island';
    $('#hud').classList.toggle('hide', !isl); bagFab.classList.toggle('hide', !isl); if (!isl) closeTray();
    if (joy) joy.hidden = !isl || S().settings.control !== 'joy';
    if (!isl) OC.Pages.open(id);
    if (isl && decorate) decoBanner(true);
  }

  // =============================== quick bag ===============================
  let bagFab, tray, slots, trayY = 0;
  function buildBag() {
    bagFab = h('button.bag-fab', { 'aria-label': '快速背包', on: { click: () => (tray.classList.contains('open') ? closeTray() : openTray()) } }, icon('bag', 'l'));
    slots = h('div.slots');
    const grab = h('div.grab', { 'aria-label': '拖曳以移動或收合' });
    tray = h('div.tray', { role: 'region', 'aria-label': '快速背包' }, h('div.tray-head', null, h('b', null, '快速背包'), grab, h('button.btn.ghost.s', { on: { click: () => { closeTray(); OC.Pages.open('bag'); } } }, '全部'), h('button.icon-btn', { 'aria-label': '收起', on: { click: closeTray } }, icon('close', 's'))), slots);
    // drag the header to reposition (up) or collapse (down)
    let y0 = null, base = 0;
    grab.addEventListener('pointerdown', (e) => { grab.setPointerCapture(e.pointerId); y0 = e.clientY; base = trayY; tray.style.transition = 'none'; });
    grab.addEventListener('pointermove', (e) => { if (y0 == null) return; trayY = Math.min(80, Math.max(-(window.innerHeight * 0.45), base + e.clientY - y0)); tray.style.setProperty('--tray-y', trayY + 'px'); });
    const up = () => { if (y0 == null) return; y0 = null; tray.style.transition = ''; if (trayY > 50) { trayY = 0; tray.style.setProperty('--tray-y', '0px'); closeTray(); } };
    grab.addEventListener('pointerup', up); grab.addEventListener('pointercancel', up);
    $('#app').append(tray, bagFab);
  }
  function openTray() { renderSlots(); tray.classList.add('open'); bagFab.classList.add('hide'); }
  function closeTray() { tray.classList.remove('open'); if (curTab === 'island') bagFab.classList.remove('hide'); }
  function renderSlots() {
    const fav = S().favs || {};
    const ids = Object.keys(S().inv).filter((id) => Sty.ITEMS[id] && St.count(id) > 0).sort((a, b) => (fav[b] ? 1 : 0) - (fav[a] ? 1 : 0) || OC.Items.groupOf(a).localeCompare(OC.Items.groupOf(b)));
    if (!ids.length) { slots.replaceChildren(h('div.empty', { style: { padding: '14px' } }, '背包是空的')); return; }
    slots.replaceChildren(...ids.map((id) => { const c = Sty.itemCanvas(id, 96); const cv = h('canvas', { width: 96, height: 96 }); cv.getContext('2d').drawImage(c, 0, 0); const sl = h('div.slot', { role: 'button', 'aria-label': `${Sty.ITEMS[id].zh} ${St.count(id)} 個`, 'data-id': id }, cv, h('span.count', null, St.count(id)), fav[id] ? h('span.fav', null, '★') : null); bindSlot(sl, id); return sl; }));
  }
  // drag priority: a vertical move (or a held horizontal move) starts a drag; a quick horizontal swipe scrolls the tray; a tap opens details
  let rings = [];
  function showRings(id) {
    clearRings(); const k = OC.Items.useKind(id);
    for (const t of dropCands(id)) { const el = h('div.drop-ring' + (t.why ? '.no' : ''), null, t.why ? h('span', null, t.why) : null); overlays().append(el); rings.push({ el, a: t.a }); }
    if (k === 'place' && !(OC.Places.get(Wd.area.id) || {}).decor) toast('這裡不能擺家具（到晴日島或家裡吧）', 'info');
    placeRings();
  }
  function placeRings() { for (const r of rings) { if (r.a.hidden || r.a.dead) { r.el.hidden = true; continue; } const p = Wd.project(r.a.x, r.a.y, r.a.lvl, (r.a.gy - r.a.lvl * Wd.HY) + 20); r.el.hidden = false; r.el.style.left = p.x + 'px'; r.el.style.top = p.y + 'px'; } }
  function clearRings() { rings.forEach((r) => r.el.remove()); rings = []; }
  /** OCs (and residents for gifts) the item can be dropped on, with a reason when not allowed now */
  function dropCands(id) {
    const k = OC.Items.useKind(id), out = [];
    if (k === 'place') return out;
    for (const r of OC.Use.receivers(id)) out.push({ a: r.a, oc: r.c.id, why: r.why });
    if (k === 'gift' || k === 'eat' || k === 'drink' || k === 'play') for (const [nid, n] of Object.entries(npcs)) if (Sty.ITEMS[id].kind !== 'furniture') out.push({ a: n, npc: nid, why: null });
    return out;
  }
  function bindSlot(sl, id) {
    let st = null, ghost = null;
    sl.addEventListener('pointerdown', (e) => { sl.setPointerCapture(e.pointerId); st = { x: e.clientX, y: e.clientY, t: performance.now(), drag: false }; });
    sl.addEventListener('pointermove', (e) => {
      if (!st) return;
      if (!st.drag && (Math.abs(e.clientY - st.y) > 12 || (Math.abs(e.clientX - st.x) > 12 && performance.now() - st.t > 220))) { st.drag = true; ghost = h('div.drag-ghost'); ghost.append(Sty.itemImg(id)); ghost.firstChild.style.width = '100%'; $('#app').append(ghost); haptic(); showRings(id); }
      if (st.drag) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; const t = dropTarget(e.clientX, e.clientY, id); ghost.classList.toggle('hit', !!(t && !t.why)); ghost.classList.toggle('bad', !!(t && t.why)); rings.forEach((r) => r.el.classList.toggle('hot', !!(t && t.a === r.a))); }
    });
    const end = (e) => {
      if (!st) return; const was = st; st = null;
      if (was.drag) { ghost.remove(); ghost = null; clearRings(); if (e.type !== 'pointercancel') dropItem(e.clientX, e.clientY, id); else toast('取消了', 'info'); return; }
      if (e.type !== 'pointercancel') OC.Pages.itemSheet(id, renderSlots);
    };
    sl.addEventListener('pointerup', end); sl.addEventListener('pointercancel', end);
  }
  function dropTarget(sx, sy, id) {
    const r = Wd.pick(sx, sy - 24); const it = r.it, k = OC.Items.useKind(id);
    if (k === 'place') return (OC.Places.get(Wd.area.id) || {}).decor ? { kind: 'place', p: r.p } : { kind: 'place', why: '這裡不能擺家具' };
    // only receivers count (a bench or a plot under the finger must not swallow the drop): nearest one within ~40px of its body
    let best = null, bd = 42;
    for (const t of dropCands(id)) { if (t.a.hidden) continue; const p = Wd.project(t.a.x, t.a.y, t.a.lvl, (t.a.gy - t.a.lvl * Wd.HY) + 18), d = Math.hypot(p.x - sx, p.y - (sy - 24)); if (d < bd) { bd = d; best = t; } }
    if (best) return best.npc ? { kind: 'npc', npc: best.npc, a: best.a } : Object.assign({ kind: 'oc' }, best);
    if (it && (it.type === 'self' || it.type === 'mate')) { const oc = it.type === 'self' ? S().activeId : it.id; const c = dropCands(id).find((t) => t.oc === oc); return c ? Object.assign({ kind: 'oc' }, c) : null; }
    if (it && it.type === 'npc') return { kind: 'npc', npc: it.id, a: npcs[it.id] };
    return null;
  }
  function dropItem(sx, sy, id) {
    const t = dropTarget(sx, sy, id);
    if (!t) { toast('拖到 OC 身上使用，拖到居民身上送禮。放開在空白處＝取消', 'info'); return; }
    if (t.why) { toast(t.why, 'info'); return; }
    if (t.kind === 'oc') { const r = OC.Use.use(id, t.oc); if (r && r.then) r.then(() => renderSlots()); }
    if (t.kind === 'npc') giveGift(t.npc, id);
    if (t.kind === 'place') { closeTray(); startPlacement({ id }, t.p); }
    renderSlots();
  }
  St.on && St.on('inv', () => { if (tray && tray.classList.contains('open')) renderSlots(); });

  // =============================== actors ===============================
  const me = () => OC.Chars.active();
  const MAX_MATES = 5, SPOTS = [[260, 700], [330, 720], [210, 600], [380, 650], [300, 760]];
  function makePlayer(pos) {
    player = Wd.actor({ player: true, xray: true, x: pos.x, y: pos.y, char: () => testChar || me(), interact: { type: 'self', hit: { w: 26, h: 40, d: 6 }, prio: 3 } });
    player.cid = S().activeId;
    player.update = (a, dt) => { applyFace(a, me()); personalityIdle(a, dt, me()); };
    OC.Brain.attach(player, me(), { manual: true });
  }
  /** the dominant emotion shows on the face whenever the OC is not playing an action */
  function applyFace(a, c) {
    if (!c || a.act) { a.eyes = a.mouth = undefined; a.overrides = null; return; }
    const f = OC.Mind.face(c); a.eyes = f.eyes; a.mouth = f.mouth;
    a.overrides = f.brows || f.sweat || f.lookY ? { brows: f.brows, sweat: f.sweat, lookY: f.lookY } : null;
    if (!a.blushHold) a.blush = f.blush ? 0.8 : 0;
  }
  /** small personality / emotion idles while an OC is between activities (observable differences) */
  function personalityIdle(a, dt, c) {
    const br = a.brain;
    if (!c || a.path || a.joy || a.act || a.mode === 'talk' || (br && br.st !== 'think')) { a.idleT = 0; return; }
    const b = OC.Chars.behavior(c); a.idleT = (a.idleT || 0) + dt;
    if (a.idleT < b.fidgetEvery) return; a.idleT = 0;
    const r = Math.random(), emo = OC.LifeData.EMOTIONS[OC.Mind.dominant(c)];
    if (emo.act && OC.Mind.intensity(c, OC.Mind.dominant(c)) > 0.35 && r < 0.45) { if (emo.act === 'jump') Wd.jump(a); else Wd.setAction(a, emo.act, { dur: 1.6, priority: 1 }); if (emo.e) emote(a, emo.e); return; }
    if (r < b.sitChance) Wd.setAction(a, 'sit', { dur: 4 + Math.random() * 4, priority: 1 });
    else if (b.habit === 'hum' && r < 0.7) emote(a, '♪');
    else if (b.habit === 'stretch' && r < 0.6) Wd.setAction(a, 'stretch', { dur: 1.6, priority: 1 });
    else if (b.lookAround) { a.tFace = (Math.random() - 0.5) * 1.6; }
    else if (r > 0.85 && b.emoteScale > 1) Wd.setAction(a, 'happy', { dur: 1, priority: 1 });
  }
  function makeNPCs() {
    npcs = {}; mates = {};
    // 8.0: residents are opt-in (Settings › 世界 › 小島居民); a new game only has the player's own OCs
    for (const [id, cfg] of Object.entries(S().world.residents ? Wd.area.NPC || {} : {})) {
      const d = Gm.NPCS[id], c = OC.CharRender.presetChar(d.preset);
      const a = Wd.actor({ id, x: cfg.home.x, y: cfg.home.y, char: () => c, interact: { type: 'npc', id, hit: { w: 28, h: 40, d: 6 }, prio: 2, label: d.zh }, fixedSpeed: true, speed: 34 });
      a.home = cfg.home; a.r = cfg.r; a.wait = 1 + Math.random() * 3;
      a.update = (b, dt) => wander(b, dt);
      npcs[id] = a;
    }
    // the player's other OCs who are at this place (they live everywhere now; js/life/brain.js moves them)
    presentHere().forEach((c, i) => addMate(c, i));
  }
  /** OCs that are at the current place (and not still on the way) */
  function presentHere() { const now = OC.Sim.now(); return OC.Chars.all().filter((c) => c.id !== S().activeId && c.status.onIsland && (c.life.loc || 'isle') === Wd.area.id && !(c.life.trip && c.life.trip.eta > now)).slice(0, MAX_MATES); }
  /** someone arrived / left while we are here → add / remove actors (arrivals walk in from the door) */
  function syncPresence() {
    if (!Wd.area || !player) return; const want = presentHere().map((c) => c.id);
    for (const id of Object.keys(mates)) if (!want.includes(id)) { const b = OC.Brain.get(id); if (b && b.leaving) continue; OC.Brain.detach(id); Wd.removeActor(mates[id]); delete mates[id]; }
    want.forEach((id, i) => { if (mates[id]) return; const c = OC.Chars.get(id), tr = c.life.trip; addMate(c, i, tr ? OC.Brain.entryPoint(tr.from) : null); if (tr) OC.Brain.arrived(id); });
  }
  function spawnPos(c, i) {
    const p = c.life.pos; if (p && p.area === Wd.area.id && Wd.walkable(p.x, p.y)) return p;
    const [x, y] = SPOTS[i % SPOTS.length]; return { x: x + (i >= SPOTS.length ? 14 : 0), y };
  }
  function addMate(c, i, at) {
    const p = at || spawnPos(c, i);
    const a = Wd.actor({ mate: c.id, x: p.x, y: p.y, char: () => OC.Chars.get(c.id), interact: { type: 'mate', id: c.id, hit: { w: 28, h: 40, d: 6 }, prio: 2, label: OC.Chars.name(c) } });
    a.update = (b, dt) => { const cc = OC.Chars.get(c.id); applyFace(b, cc); personalityIdle(b, dt, cc); };
    mates[c.id] = a; OC.Brain.attach(a, c); return a;
  }
  let mates = {};
  function wander(b, dt) { if (b.mode === 'talk' || b.act) return; if (!b.path) { b.wait -= dt; if (b.wait < 0) { b.wait = 4 + Math.random() * 6; const ang = Math.random() * Math.PI * 2, rr = Math.random() * b.r; Wd.walkTo(b, b.home.x + Math.cos(ang) * rr, b.home.y + Math.sin(ang) * rr * 0.7); } } }
  /** roster changes: add / remove island OCs and swap the played OC without moving anyone else */
  function refreshActors() {
    if (!Wd.area || !player) return;
    const act = S().activeId;
    if (player.cid !== act) {
      const old = player.cid, oldPos = { x: player.x, y: player.y };
      OC.Brain.detach(old); standUp();
      const m = mates[act]; if (m) { player.x = m.x; player.y = m.y; player.path = null; OC.Brain.detach(act); Wd.removeActor(m); delete mates[act]; }
      player.cid = act; player.key = ''; OC.Brain.attach(player, me(), { manual: true });
      const oc = OC.Chars.get(old); if (oc && oc.status.onIsland && Object.keys(mates).length < MAX_MATES) { oc.life.loc = Wd.area.id; oc.life.trip = null; addMate(oc, 0, oldPos); }
      const nc = me(); if (nc) { nc.life.loc = Wd.area.id; nc.life.trip = null; }
    }
    syncPresence();
    player.key = ''; for (const a of Object.values(mates)) a.key = '';
  }
  const actorOf = (id) => (player && player.cid === id ? player : mates[id] || null);
  /** greeting in the OC's own style + a line in its speech style */
  function greetFrom(a, c) {
    const b = OC.Chars.behavior(c); Wd.setAction(a, 'greet', { dur: 1.4, priority: 3 }); if (b.greet === 'jump') Wd.jump(a);
    const lines = c.speech.catchphrase ? [c.speech.catchphrase] : ['你好呀！', '今天天氣真好。', '嗨！', '要一起玩嗎？'];
    const ln = OC.Talk.say('greet', c, null); bubble(a, ln ? ln.text : OC.Chars.speak(c, lines[Math.floor(Math.random() * lines.length)]), OC.Chars.name(c));
    if (b.blushOnTalk) { a.blush = 1; a.blushHold = true; setTimeout(() => { a.blush = 0; a.blushHold = false; }, 1600); }
  }

  // =============================== world overlays (emotes / float text / prompts) ===============================
  const floats = [];
  function emote(a, kind, dur = 1.4) { const el = h('div.float-text', { style: { animationDuration: dur + 's', fontSize: '22px' } }, kind); overlays().append(el); floats.push({ el, a, up: 46, t: 0, dur }); }
  function floatText(a, text, color) { const el = h('div.float-text', { style: { color: color || 'var(--accent)' } }, text); overlays().append(el); floats.push({ el, a, up: 40, t: 0, dur: 1.4 }); }
  function floatAt(x, y, lvl, text, color) { const el = h('div.float-text', { style: { color: color || 'var(--accent)' } }, text); overlays().append(el); floats.push({ el, pos: { x, y, lvl }, up: 20, t: 0, dur: 1.4 }); }
  function updateOverlays(dt) {
    if (rings.length) placeRings();
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt; if (f.t > f.dur) { f.el.remove(); floats.splice(i, 1); continue; }
      const p = f.a ? Wd.project(f.a.x, f.a.y, f.a.lvl, (f.a.gy - f.a.lvl * Wd.HY) + f.up) : Wd.project(f.pos.x, f.pos.y, f.pos.lvl, f.up);
      f.x = p.x; f.y = p.y; f.el.style.left = p.x + 'px'; f.el.style.top = p.y + 'px'; f.el.style.visibility = f.a && f.a.hidden ? 'hidden' : '';
    }
    // speech bubbles never cover each other: push the later one up
    const bs = floats.filter((f) => f.keep).sort((x, y) => x.y - y.y);
    for (let i = 0; i < bs.length; i++) { const f = bs[i]; f.h = f.h || f.el.offsetHeight || 30; f.w = f.w || f.el.offsetWidth || 80; for (let j = 0; j < i; j++) { const g = bs[j]; if (Math.abs(g.x - f.x) < (g.w + f.w) / 2 && Math.abs(g.y - f.y) < (g.h + f.h) / 2 + 4) { g.y = f.y - (g.h + f.h) / 2 - 6; g.el.style.top = g.y + 'px'; } } }
  }

  // =============================== interactions ===============================
  function busy() { return dlgOpen || placing; }
  function onTap(r) {
    if (window.__ocInputLog) window.__ocInputLog.push(`onTap dlg=${!!dlgOpen} placing=${!!placing} decorate=${decorate} covered=${curTab}`);
    if (dlgOpen) { advanceDialogue(); return; }
    if (placing) return;
    if (observing) { stopObserve(); }
    const it = r.it;
    if (!it || !['self', 'mate'].includes(it.type)) { standUp(); OC.Brain.playerAct(S().activeId); }
    if (decorate && it && it.type === 'furn') { startPlacement({ uid: it.uid }); return; }
    if (!it) { const t = Wd.nearestWalkable(r.p.x, r.p.y, 24); if (t && Wd.walkTo(player, t.x, t.y)) marker(t); else toast('那裡走不過去', 'info'); return; }
    haptic();
    switch (it.type) {
      case 'self': OC.LifeUI.interact(S().activeId); break;
      case 'mate': OC.LifeUI.interact(it.id); break;
      case 'npc': approachNpc(it.id); break;
      case 'drop': goThen(it.drop.x, it.drop.y + 2, () => pickDrop(it.drop)); break;
      case 'tree': goThen(it.at.x, it.at.y, () => shakeTree(it)); break;
      case 'bed': goThen(it.at.x, it.at.y, () => pickFlower(it)); break;
      case 'bench': goThen(it.at.x, it.at.y, () => sit(it.seat)); break;
      case 'home': goThen(it.at.x, it.at.y, () => travel('home')); break;
      case 'shop': if (OC.WorldUI.tap(it)) break; goThen(it.at.x, it.at.y, () => { face(player, 0, 1); OC.Pages.open('shop', { shop: 'general' }); }); break;
      case 'npcHome': if (!S().world.residents) { goThen(it.at.x, it.at.y, () => { face(player, 0, 1); toast('一間空著的小屋（設定 › 世界 可以邀請居民栗子、小空搬來）', 'home'); }); break; }
        goThen(it.at.x, it.at.y, () => { face(player, 0, 1); const n = npcs[it.npc]; toast(`${it.label}${n && Math.hypot(n.x - player.x, n.y - player.y) < 140 ? `・${Gm.NPCS[it.npc].zh}就在附近` : '・現在不在家'}`, 'home'); }); break;
      case 'travel': goThen(it.at.x, it.at.y, () => tab('explore')); break;
      case 'travelHome': goThen(it.at.x, it.at.y, () => travel('isle')); break;
      case 'furn': if (!decorate && OC.WorldUI.tap(it)) break; furnInteract(it); break;
      default: OC.WorldUI.tap(it);
    }
  }
  function onLongPress(r) {
    haptic();
    const it = r.it;
    if (it && (it.type === 'mate' || it.type === 'self') && !placing && !dlgOpen) return startCarry(it.type === 'self' ? S().activeId : it.id);
    if (!it) { const lv = Wd.levelAt(r.p.x, r.p.y); toast(Wd.walkable(r.p.x, r.p.y) ? (lv > 0.99 ? '高台' : lv > 0 ? '石階' : '地面') + '・可以走' : '走不過去的地方', 'info'); return; }
    if (it.type === 'tree') { const left = treeReadyIn(it); toast(left <= 0 ? `${it.label}・果實成熟了，點一下就能搖` : `${it.label}・還要約 ${Math.ceil(left)} 分鐘長出果實`, 'leaf'); return; }
    if (it.type === 'npc') { const n = Gm.npc(it.id); toast(`${Gm.NPCS[it.id].zh}・${n.met ? Gm.LEVEL_ZH[Gm.friendLevel(n.fr)] : '還沒見過面'}`, 'heart'); return; }
    if (it.type === 'furn') { toast(`${Sty.ITEMS[it.id].zh}・開啟佈置模式即可移動`, 'sofa'); return; }
    toast(it.label || (it.type === 'self' ? `${OC.Chars.name(me())}・${OC.Chars.typeTitle(me())}` : '物品'), 'info');
  }
  let mk = null;
  function marker(p) { if (!mk) { mk = h('div', { style: { position: 'absolute', width: '22px', height: '12px', margin: '-6px 0 0 -11px', borderRadius: '50%', border: '2.5px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,.15)', pointerEvents: 'none', transition: 'opacity 300ms' } }); overlays().append(mk); } mk.dataset.x = p.x; mk.dataset.y = p.y; mk.style.opacity = 1; clearTimeout(mk._t); mk._t = setTimeout(() => (mk.style.opacity = 0), 900); }
  function goThen(x, y, fn) { const near = Math.hypot(player.x - x, player.y - y) < 8; if (near) { fn(); return; } if (!Wd.walkTo(player, x, y, () => fn())) toast('到不了那裡', 'info'); }
  function face(a, dx, dy) { a.tFace = Math.max(-1, Math.min(1, dx)); a.tBack = dy < 0 ? 1 : 0; }
  function standUp() { if (player && player.mode === 'sit') { player.mode = 'idle'; player.seatY = 0; Wd.setAction(player, 'idle'); OC.Brain.release(player.cid); } }
  /** the played OC sits on a seat slot (reserved so no other OC takes it) */
  function sit(seat) {
    const slots = []; for (const o of OC.Brain.aff) for (const sl of o.slots) if (sl.seatY && Math.hypot(sl.x - seat.x, sl.y - seat.y) < 14) slots.push(sl);
    slots.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
    const sl = slots.find((x) => OC.Brain.free(x, player.cid));
    if (slots.length && !sl) { toast('位子都被坐走了', 'info'); return; }
    if (sl) { OC.Brain.reserve(sl, player.cid); seat = { x: sl.x, y: sl.y, up: sl.seatY }; }
    player.x = seat.x; player.y = seat.y; player.seatY = seat.up; player.mode = 'sit'; player.path = null; face(player, 0, 1); Wd.setAction(player, 'sit', { priority: 4 }); emote(player, '♪'); toast('坐下來休息…（精力會慢慢恢復）', 'zap'); }
  function restHome() {
    face(player, 0, -1); const f = $('#fade'); f.style.opacity = 1; f.style.pointerEvents = 'auto';
    Wd.setAction(player, 'sleep', { dur: 1.2, priority: 5 });
    setTimeout(() => { St.needs({ energy: Gm.has('sleepy') ? 60 : 45, sleep: 30, comfort: 15, mood: 5 }); f.style.opacity = 0; f.style.pointerEvents = 'none'; toast('在家休息了一下，精神好多了！', 'home'); face(player, 0, 1); }, 1100);
  }
  // trees: fruit regrows 20 real minutes after a shake
  const REGROW_MIN = 20;
  function treeReadyIn(it) { const t = S().world.trees[it.id] || 0; return REGROW_MIN - (Date.now() - t) / 60000; }
  function syncTreeFruit() { for (const it of (Wd.area.id === 'isle' ? interactsOf('tree') : [])) { const ripe = treeReadyIn(it) <= 0; it.tree.fruits.forEach((f, i) => (f.visible = ripe && i < 4)); } }
  function interactsOf(type) { return Wd.interacts.filter((i) => i.type === type); }
  function shakeTree(it) {
    face(player, 0, -1); St.stat('shakes'); Gm.progress('shake');
    let k = 0; const crown = it.tree.crown, base = crown.rotation.z; const shake = setInterval(() => { crown.position.x = Math.sin(k * 1.9) * 2.2 * (1 - k / 16); if (++k > 16) { clearInterval(shake); crown.position.x = 0; } }, 30);
    if (treeReadyIn(it) > 0) { toast(`沒有果實…還要約 ${Math.ceil(treeReadyIn(it))} 分鐘`, 'leaf'); return; }
    S().world.trees[it.id] = Date.now(); St.touch();
    const n = 2 + (Math.random() < 0.5 ? 1 : 0) + (Gm.has('curious') && Math.random() < 0.35 ? 1 : 0);
    it.tree.fruits.forEach((f) => (f.visible = false));
    for (let i = 0; i < n; i++) { const a = -0.6 + i * 0.6 + Math.random() * 0.3; const tx = it.x + Math.cos(a) * 22, ty = it.y + 10 + Math.abs(Math.sin(a)) * 8 + i * 3; const p = Wd.nearestWalkable(tx, ty, 20) || { x: it.at.x, y: it.at.y }; Wd.spawnDrop(it.fruit, it.x, it.y - 6, p.x, p.y, it.lvl || 0, it.color).key = `tree:${it.id}:${S().world.trees[it.id]}:${i}`; }
    haptic(); emote(player, '!');
  }
  function pickDrop(d) {
    if (!Wd.drops.includes(d)) return;
    const r = OC.Tx.run(d.key || OC.Tx.uid('drop'), { get: { items: { [d.id]: 1 } } }, '撿到'); Wd.removeDrop(d); if (!r.ok) return; floatAt(d.x, d.y, d.lvl, `+1 ${Sty.ITEMS[d.id].zh}`);
    if (d.daily) { const w = S().world[d.daily]; w.taken.push(d.spot); St.touch(); St.stat('picked'); Gm.progress('pick', 1, { item: d.id }); if (Gm.has('curious') && Math.random() < 0.25 && OC.Tx.run((d.key || 'drop') + ':bonus', { get: { items: { [d.id]: 1 } } }, '好奇心多找到').ok) { toast('好奇心發作，多找到一個！', 'sparkle'); } }
    if (tray.classList.contains('open')) renderSlots();
  }
  function pickFlower(it) {
    face(player, 0, -1); const k = it.id, last = S().world.trees[k] || 0, left = 8 - (Date.now() - last) / 60000;
    if (left > 0) { toast(`花還沒長好，約 ${Math.ceil(left)} 分鐘後再來`, 'leaf'); return; }
    S().world.trees[k] = Date.now(); OC.Tx.run(`flower:${k}:${S().world.trees[k]}`, { get: { items: { flower: 1 } } }, '摘花'); St.needs({ mood: 3 }); St.stat('picked'); Gm.progress('pick', 1, { item: 'flower' });
    floatAt(it.x, it.y, it.lvl || 0, '+1 小雛菊'); haptic();
  }
  function spawnDailies() {
    const day = OC.Clock.dayKey(), area = Wd.area;
    const cfg = { isle: ['shells', 'shell', area.shellSpots, 4], forest: ['mush', 'mushroom', area.mushSpots, 5], beach: ['beachShells', null, area.shellSpots, 6] }[area.id]; if (!cfg) return;
    const [key, item0, spots, pickN] = cfg; if (!spots) return;
    const w = (S().world[key] = S().world[key] || { day: '', taken: [] }); if (w.day !== day) { w.day = day; w.taken = []; St.touch(); }
    const seed = OC.hash(new Date().getDate() * 7.7 + ({ isle: 1, forest: 2, beach: 3 }[area.id]));
    const order = spots.map((s, i) => [OC.hash(seed * 100 + i), i]).sort((a, b) => a[0] - b[0]).slice(0, pickN).map((x) => x[1]);
    for (const i of order) {
      if (w.taken.includes(i)) continue; const [x, y] = spots[i]; if (!Wd.walkable(x, y)) continue;
      const r = OC.hash(seed * 31 + i * 7.3), item = item0 || (r > 0.93 ? 'sea_glass' : r > 0.78 ? 'shell_conch' : r > 0.6 ? 'shell_star' : 'shell');
      const col = { shell: '#FFB3A7', mushroom: '#F26B5B', shell_star: '#FF9A6B', shell_conch: '#F7D1B5', sea_glass: '#7FD3C4' }[item];
      const d = Wd.spawnDrop(item, x, y, x, y, 0, col); d.t = 1; d.daily = key; d.spot = i; d.key = `daily:${area.id}:${day}:${i}`; if (item === 'mushroom') d.m.scale.set(1.1, 0.7, 1.1);
    }
  }
  function furnInteract(it) {
    const def = Sty.ITEMS[it.id];
    if (def.sit) { goThen(it.x, it.y + 12, () => sit({ x: it.x, y: it.y + 1, up: it.id === 'chair' ? 9 : 4 })); return; }
    if (it.id === 'lamp') { const L = S().world.lamps; L[it.uid] = L[it.uid] === false; St.touch(); toast(L[it.uid] === false ? '關掉了檯燈' : '打開了檯燈（晚上會亮）', 'sun'); return; }
    toast(`${def.zh}・長按或開啟佈置模式可以移動`, 'sofa');
  }
  function reactEat() { if (!player) return; const b = OC.Chars.behavior(me()); Wd.setAction(player, 'eat', { dur: b.chew, priority: 4 }); emote(player, '♥'); }
  function moodPose() { const m = Gm.moodFace(); return { eyes: m.eyes === 'round' ? undefined : m.eyes, mouth: m.mouth === 'cat' ? undefined : m.mouth, blush: m.blush ? 0.8 : 0 }; }
  // speech bubble above an actor
  /** speech bubble above an actor (one per actor; name tag; never overlaps another bubble) → seconds shown */
  function bubble(a, text, name, dur, o = {}) {
    const d = dur || Math.max(1.8, Math.min(5.2, 1.3 + text.length * 0.11)) * (o.thought ? 0.9 : 1);
    if (curTab !== 'island') return d;
    for (let i = floats.length - 1; i >= 0; i--) if (floats[i].a === a && floats[i].keep) { floats[i].el.remove(); floats.splice(i, 1); }
    const el = h('div.speech' + (o.thought ? '.thought' : ''), null, name ? h('b.who', null, name) : null, h('span', null, text));
    overlays().append(el); floats.push({ el, a, up: 52, t: 0, dur: d, keep: true }); return d;
  }

  // ---------- carry an OC (long-press + drag): interrupts what it was doing ----------
  let carry = null;
  function startCarry(id) {
    const a = actorOf(id), c = OC.Chars.get(id); if (!a || !c) return null;
    if (a === player) standUp();
    const wasSleeping = a.brain && a.brain.st === 'do' && a.brain.act === 'sleep';
    OC.Brain.hold(id, 'drag'); a.path = null; a.seatY = 0; a.hidden = false; a.lift = 9; Wd.setAction(a, 'drag', { priority: 9 });
    carry = { id, a, c, wasSleeping }; OC.Mind.feel(c, 'surprised', 0.6, '被抱起來'); return { drag: true };
  }
  function dragMove(p) { if (!carry) return; const q = Wd.nearestWalkable(p.x, p.y + 14, 30); if (q) { carry.a.x = q.x; carry.a.y = q.y; } carry.a.lift = 9; }
  function dragEnd() {
    if (!carry) return; const { id, a, c, wasSleeping } = carry; carry = null; a.lift = 0; Wd.setAction(a, 'idle'); Wd.jump(a);
    const b = OC.Chars.behavior(c); let cat = 'call';
    if (wasSleeping) { OC.Mind.feel(c, 'annoyed', 0.45, '睡覺被吵醒'); cat = 'prank_bad'; }
    else if (OC.Chars.has(c, 'shy')) OC.Mind.feel(c, 'shy', 0.5, '被抱起來');
    else if (b.emoteScale > 1) OC.Mind.feel(c, 'excited', 0.35, '被抱起來');
    OC.Mind.player(c, { fam: 1 }); const ln = OC.Talk.say(cat, c, null); if (ln) bubble(a, ln.text, OC.Chars.name(c));
    if (id === S().activeId) S().pos = { area: Wd.area.id, x: a.x, y: a.y };
    setTimeout(() => OC.Brain.unhold(id, 'drag'), 1200);
  }

  // ---------- observe an OC (camera follows, its thoughts are shown) ----------
  let observing = null, obsBar = null;
  function observe(id) {
    const a = actorOf(id); if (!a) return; stopObserve(); observing = id; Wd.focus(a, 2.4);
    obsBar = h('div.obs-bar', { role: 'status' }); $('#app').append(obsBar); updateObserve();
  }
  function stopObserve() { observing = null; Wd.focus(null); if (obsBar) { obsBar.remove(); obsBar = null; } }
  function updateObserve() {
    if (!observing || !obsBar) return; const c = OC.Chars.get(observing), b = OC.Brain.get(observing); if (!c) { stopObserve(); return; }
    const key = [OC.Mind.label(c), b && b.st, b && b.act, b && b.dbg.reason].join('|'); if (obsBar.dataset.k === key) return; obsBar.dataset.k = key;
    obsBar.replaceChildren(h('b', null, `觀察中・${OC.Chars.name(c)}`), h('span', null, `${OC.LifeUI.doingText(c)}・${OC.Mind.label(c)}`), b && b.dbg.reason ? h('span.faint', null, '想法：' + b.dbg.reason) : null, h('button.btn.s', { on: { click: stopObserve } }, '結束'));
  }

  // ---------- test an animation on the island (from the animation studio) ----------
  let testChar = null, testBar = null;
  function testOnIsland(c, action, onReturn) {
    testChar = c; tab('island'); if (player) { player.key = ''; Wd.setAction(player, action, { priority: 6 }); }
    testBar = h('div.place-bar', { style: { top: 'calc(var(--sat) + 104px)', bottom: 'auto' } },
      h('button.btn.s', { on: { click: () => player && Wd.setAction(player, action, { priority: 6 }) } }, icon('play', 's'), '播放動作'),
      h('button.btn.s', { on: { click: () => { Wd.setAction(player, 'idle'); for (let k = 0; k < 12; k++) { const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 60, t = Wd.nearestWalkable(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r * 0.7, 30); if (t && Wd.walkTo(player, t.x, t.y)) return; } toast('附近沒有可以走的地方', 'info'); } } }, icon('walk', 's'), '走走看'),
      h('button.btn.s.primary', { on: { click: () => endTest(onReturn) } }, icon('back', 's'), '回工作室'));
    $('#app').append(testBar); testBar.layer = { scrim: false, close: () => endTest(onReturn) }; OC.UI.pushLayer(testBar.layer);
    toast('測試模式：點地面讓角色移動，看看動作在場景中的樣子', 'film');
  }
  function endTest(onReturn) { if (!testBar) return; OC.UI.popLayer(testBar.layer); testBar.remove(); testBar = null; testChar = null; if (player) { Wd.setAction(player, 'idle'); player.key = ''; } onReturn && onReturn(); }


  // ---- NPC talk & gifts ----
  function approachNpc(id) {
    const n = npcs[id]; if (!n) return;
    const side = player.x < n.x ? -1 : 1, tx = n.x + side * 20, ty = n.y + 4;
    n.path = null; n.wait = 8;
    goThen(tx, ty, () => { if (Math.hypot(n.x - player.x, n.y - player.y) > 44) { approachNpc(id); return; } talk(id); });
  }
  function talk(id) {
    const n = npcs[id]; n.mode = 'talk'; n.path = null; face(n, player.x - n.x, 0.1); face(player, n.x - player.x, 0.1); player.mode = 'talk';
    emote(n, '!', 0.9);
    const dl = Gm.dialogue(id);
    showDialogue(Gm.NPCS[id].zh, dl.lines, dl.choices, () => { Gm.talked(id); n.mode = 'idle'; n.wait = 2; player.mode = 'idle'; });
  }
  function giveGift(id, item) {
    const n = npcs[id]; if (!n) return;
    const r = Gm.gift(id, item); if (!r) return;
    n.mode = 'talk'; n.path = null; face(n, player.x - n.x, 0.1); emote(n, r.mood === 'love' ? '♥' : r.mood === 'meh' ? '…' : '♪');
    showDialogue(Gm.NPCS[id].zh, [r.line], [], () => { n.mode = 'idle'; n.wait = 2; });
  }
  // ---- dialogue box ----
  let dlg;
  function buildDialogue() { dlg = { el: h('div.dlg', { role: 'dialog', 'aria-live': 'polite', on: { click: (e) => { if (!e.target.closest('button')) advanceDialogue(); } } }), who: h('div.who'), line: h('div.line'), choices: h('div.choices'), next: h('div.next', null, icon('next', 's')) }; dlg.el.append(dlg.who, dlg.line, dlg.choices, dlg.next); $('#app').append(dlg.el); }
  function showDialogue(who, lines, choices, done, custom) {
    closeTray();
    dlgOpen = { lines: lines.slice(), choices, done, i: 0, custom: !!custom, layer: { scrim: false, close: () => endDialogue() } };
    OC.UI.pushLayer(dlgOpen.layer);
    dlg.who.textContent = who; dlg.el.classList.add('open'); renderLine();
  }
  function renderLine() {
    const d = dlgOpen, last = d.i >= d.lines.length - 1;
    typeLine(d.lines[d.i]);
    dlg.choices.replaceChildren(); dlg.next.hidden = last && d.choices.length > 0;
    if (last && d.choices.length) dlg.choices.append(...d.choices.map((c) => h('button.btn.block', { on: { click: () => { haptic(); if (d.custom) { d.choices = []; const more = c.fx(); if (more && more.length) { d.lines.push(...more); d.i++; renderLine(); } else endDialogue(); return; } c.fx(); const reply = ['（看起來很開心）', '嘿嘿，謝謝你～', '好呀！'][Math.floor(Math.random() * 3)]; dlgOpen.choices = []; dlgOpen.lines.push(reply); dlgOpen.i++; renderLine(); } } }, c.label)));
  }
  let typeT = 0;
  function typeLine(s) { clearInterval(typeT); let k = 0; dlg.line.textContent = ''; dlg.full = s; typeT = setInterval(() => { k += 1; dlg.line.textContent = s.slice(0, k); if (k >= s.length) clearInterval(typeT); }, S().settings.reduceMotion ? 0 : 28); }
  function advanceDialogue() {
    const d = dlgOpen; if (!d) return;
    if (dlg.line.textContent !== dlg.full) { clearInterval(typeT); dlg.line.textContent = dlg.full; return; }
    if (d.i < d.lines.length - 1) { d.i++; renderLine(); return; }
    if (d.choices.length) return;   // must pick a choice
    endDialogue();
  }
  function endDialogue() { const d = dlgOpen; if (!d) return; dlgOpen = null; OC.UI.popLayer(d.layer); dlg.el.classList.remove('open'); clearInterval(typeT); d.done && d.done(); }
  function goToNpc(id) { setTimeout(() => approachNpc(id), 300); }

  // =============================== decorate / placement ===============================
  let decoEl = null;
  function setDecorate(v) { decorate = v; hud.deco.style.color = v ? 'var(--accent)' : ''; hud.deco.setAttribute('aria-pressed', v); decoBanner(v); if (!v && placing) cancelPlacement(); }
  function decoBanner(v) {
    if (decoEl) { decoEl.remove(); decoEl = null; }
    if (!v) return;
    decoEl = h('div.toast', { style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 'calc(var(--sat) + 104px)', zIndex: 33, animation: 'none', pointerEvents: 'auto' } }, icon('sofa', 's'), '佈置模式：點家具移動，或把背包裡的家具拖到地上', h('button.icon-btn', { 'aria-label': '結束佈置', style: { width: '32px', height: '32px' }, on: { click: () => setDecorate(false) } }, icon('close', 's')));
    $('#app').append(decoEl);
  }
  let placeBar = null;
  // ---------- placement (per place; decor places only): move · rotate · scale · undo / redo · store ----------
  const room = () => OC.Places.room(Wd.area.id);
  const canDecor = () => { const p = OC.Places.get(Wd.area.id); return !!(p && p.decor); };
  /** wall items stand against the back wall of a room */
  function snapWall(f) { const def = Sty.ITEMS[f.id]; if (def && def.wall && Wd.area.wallY != null) { const r = Wd.furnRect(f); f.y = Math.round((Wd.area.wallY + r.h / 2 + 4) / 2) * 2; } }
  function startPlacement(o, at) {
    if (!canDecor()) { toast(`${OC.Places.get(Wd.area.id).zh}不能佈置；可以在晴日島或我的家佈置`, 'info'); return; }
    if (o.id && !St.count(o.id)) { toast('背包裡沒有這件家具', 'info'); return; }
    const def = Sty.ITEMS[o.id || (room().find((p) => p.uid === o.uid) || {}).id]; if (def && def.outdoor && Wd.area.interior) { toast(`${def.zh}要放在戶外`, 'info'); return; }
    cancelPlacement(true); closeTray();
    let f;
    if (o.uid) { const rec = room().find((p) => p.uid === o.uid); if (!rec || rec.fixed) { if (rec) toast('這件是場景的一部分，不能移動', 'info'); return; } f = Object.assign({ sc: 1 }, rec); Wd.removeFurniture(o.uid); placing = { mode: 'move', f, orig: Object.assign({}, rec) }; }
    else { const p = at || player; f = { id: o.id, x: p.x, y: p.y, rot: 0, sc: 1 }; snapWall(f); if (!at || !Wd.canPlace(f)) Object.assign(f, findSpot(f, p.x, p.y + (at ? 0 : 24))); placing = { mode: 'new', f }; }
    placing.hist = [Object.assign({}, f)]; placing.hi = 0; placing.snap = true;
    Wd.setGhost(f);
    placing.layer = { scrim: false, close: () => cancelPlacement() }; OC.UI.pushLayer(placing.layer);
    const commitH = () => { placing.hist = placing.hist.slice(0, placing.hi + 1); placing.hist.push(Object.assign({}, Wd.ghost.f)); placing.hi = placing.hist.length - 1; syncPlace(); };
    const apply = (g) => { Object.assign(f, g); Wd.ghost.f.sc = f.sc; Wd.moveGhost(f.x, f.y, f.rot); syncPlace(); };
    placing.commit = commitH;
    placeBar = h('div.place-bar.v5', null,
      h('button.icon-btn', { 'aria-label': '復原', on: { click: () => { if (placing.hi > 0) { placing.hi--; apply(placing.hist[placing.hi]); } } } }, icon('undo', 's')),
      h('button.icon-btn', { 'aria-label': '重做', on: { click: () => { if (placing.hi < placing.hist.length - 1) { placing.hi++; apply(placing.hist[placing.hi]); } } } }, icon('redo', 's')),
      h('button.icon-btn', { 'aria-label': '旋轉', on: { click: () => { f.rot = ((f.rot || 0) + 1) % 4; Object.assign(f, Wd.ghost.f, { rot: f.rot }); snapWall(f); Wd.moveGhost(f.x, f.y, f.rot); commitH(); } } }, icon('rotate', 's')),
      h('button.icon-btn', { 'aria-label': '縮小', on: { click: () => { Object.assign(f, Wd.ghost.f); f.sc = Math.max(0.8, +(f.sc - 0.1).toFixed(2)); apply(f); commitH(); } } }, icon('minus', 's')),
      h('button.icon-btn', { 'aria-label': '放大', on: { click: () => { Object.assign(f, Wd.ghost.f); f.sc = Math.min(1.3, +(f.sc + 0.1).toFixed(2)); apply(f); commitH(); } } }, icon('plus', 's')),
      h('button.icon-btn', { 'aria-label': '吸附格線', 'aria-pressed': 'true', on: { click: (e) => { placing.snap = !placing.snap; Wd.ghostSnap(placing.snap ? 6 : 2); e.currentTarget.setAttribute('aria-pressed', placing.snap); e.currentTarget.classList.toggle('off', !placing.snap); toast(placing.snap ? '吸附格線：開' : '自由擺放', 'move'); } } }, icon('target', 's')),
      placing.mode === 'move' ? h('button.icon-btn', { 'aria-label': '收回背包', on: { click: () => storeFurniture() } }, icon('bag', 's')) : null,
      h('button.icon-btn', { 'aria-label': '取消', on: { click: () => cancelPlacement() } }, icon('close', 's')),
      h('button.btn.s.primary', { 'data-ok': '', on: { click: () => confirmPlacement() } }, icon('check', 's'), '放這裡'));
    $('#app').append(placeBar); bagFab.classList.add('hide'); Wd.ghostSnap(6); syncPlace();
    toast('拖曳家具移動；可以旋轉、縮放、復原', 'move');
  }
  /** nearest valid spot (spiral search on the 6-unit placement grid) */
  function findSpot(f, x0, y0) {
    for (let r = 0; r <= 120; r += 6) for (let a = 0; a < Math.PI * 2; a += r ? 6 / r : 7) { const g = Object.assign({}, f, { x: Math.round((x0 + Math.cos(a) * r) / 6) * 6, y: Math.round((y0 + Math.sin(a) * r) / 6) * 6 }); snapWall(g); if (Wd.canPlace(g)) return { x: g.x, y: g.y }; }
    return { x: x0, y: y0 };
  }
  function syncPlace() { if (!placeBar) return; const ok = Wd.ghost && Wd.ghost.ok; const b = placeBar.querySelector('[data-ok]'); b.disabled = !ok; b.classList.toggle('locked', !ok); }
  function endPlacementUI() { if (placeBar) { placeBar.remove(); placeBar = null; } Wd.setGhost(null); if (placing && placing.layer) OC.UI.popLayer(placing.layer); placing = null; if (curTab === 'island') bagFab.classList.remove('hide'); }
  function cancelPlacement(silent) { if (!placing) return; if (placing.mode === 'move') Wd.addFurniture(placing.orig); endPlacementUI(); OC.Brain.rebuild(); if (!silent) toast('已取消', 'close'); }
  function confirmPlacement() {
    const g = Wd.ghost; if (!g || !g.ok) { toast('這裡放不下', 'info'); return; }
    const f = Object.assign({}, g.f), R = room();
    if (placing.mode === 'new') { const r = OC.Tx.run(OC.Tx.uid('place'), { pay: { items: { [f.id]: 1 } } }, `佈置 ${Sty.ITEMS[f.id].zh}`, { place: Wd.area.id }); if (!r.ok) { toast(r.why[0], 'info'); endPlacementUI(); return; } f.uid = 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1e3); R.push(f); }
    else { const i = R.findIndex((p) => p.uid === placing.orig.uid); f.uid = placing.orig.uid; R[i] = f; }
    Wd.addFurniture(f); OC.Brain.rebuild(); OC.Brain.noticeNew('furn:' + f.uid); St.stat('placed'); Gm.progress('place', 1, { item: f.id, place: Wd.area.id }); OC.Sound && OC.Sound.play('place'); St.needs({ mood: Gm.has('tidy') ? 8 : 3 }); St.touch('placed');
    endPlacementUI(); haptic(); toast('佈置完成！', 'check');
  }
  function storeFurniture() {
    const uid = placing.orig.uid, R = room(), i = R.findIndex((p) => p.uid === uid); if (i < 0) return;
    const r = OC.Tx.run(`store:${uid}`, { get: { items: { [placing.orig.id]: 1 } } }, `收回 ${Sty.ITEMS[placing.orig.id].zh}`);
    if (!r.ok && !r.dup) { toast(r.why[0], 'info'); return; }
    R.splice(i, 1); St.touch('placed'); placing.mode = 'new'; endPlacementUI(); setTimeout(() => OC.Brain.rebuild(), 0); toast('收回背包了', 'bag');
  }

  // =============================== places / travel ===============================
  /** build a place (its own furniture), put the played OC there, bring the OCs who are there */
  function loadArea(id, pos, o = {}) {
    const def = OC.Areas[id];
    stopObserve(); OC.Brain.detachAll();
    Wd.loadArea(def, { pos, furniture: OC.Places.room(id) });
    OC.Brain.rebuild();
    makePlayer(pos && Wd.walkable(pos.x, pos.y) ? pos : def.spawn); makeNPCs(); spawnDailies();
    S().pos = { area: id, x: player.x, y: player.y };
    OC.WorldUI.arrived(id, o.from); syncTreeFruit(); applyPerf(); Gm.checkAch();
  }
  function travel(id) { OC.WorldUI.travel(id); }

  // =============================== desktop pet export ===============================
  /** render every desktop OC's real actions (frames or rig) for the overlay pets (Phase 7: OC.PetSync) */
  async function exportPet() {
    if (!NATIVE || !OC.PetSync.native()) return false;
    let ok = true; for (const id of OC.PetSync.on()) ok = (await OC.PetSync.exportSprites(id, true)) && ok;
    OC.PetSync.push('export'); return ok;
  }

  // =============================== save export ===============================
  function exportSave() {
    const json = St.exportJSON(), name = `oc-shimeji-save-${OC.Clock.dayKey()}.json`;
    if (NATIVE && NATIVE.shareSave) { try { NATIVE.shareSave(json, name); return; } catch (e) { /* fall back */ } }
    const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: name }); document.body.append(a); a.click(); a.remove(); toast('已下載存檔', 'download');
  }

  // =============================== joystick ===============================
  let joy = null;
  function buildJoystick() {
    joy = h('div.joystick', { role: 'application', 'aria-label': '虛擬搖桿' }); const knob = h('i'); joy.append(knob); joy.hidden = true;
    let id = null, cx = 0, cy = 0;
    joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); id = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; standUp(); OC.Brain.playerAct(S().activeId); move(e); });
    const move = (e) => { if (e.pointerId !== id) return; let dx = e.clientX - cx, dy = e.clientY - cy; const m = Math.hypot(dx, dy), R = 40; if (m > R) { dx *= R / m; dy *= R / m; } knob.style.transform = `translate(${dx}px, ${dy}px)`; if (player && !busy()) { player.path = null; player.joy = { jx: dx / R, jy: dy / R }; } };
    const up = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; if (player) player.joy = null; };
    joy.addEventListener('pointermove', move); joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up);
    $('#app').append(joy);
  }
  function applyControl() { if (joy) joy.hidden = curTab !== 'island' || S().settings.control !== 'joy'; }

  // =============================== main loop ===============================
  let presT = 0, autoSaveT = 0, last = performance.now(), lastSim = performance.now(), acc = 0, fpsN = 0, fpsT = 0, saveStepT = 0, lastWx = null, holdT = 0, editing = new Set();
  function loop(now) {
    requestAnimationFrame(loop);
    if (paused) { last = now; lastSim = now; return; }
    const minDt = 1000 / (Q ? Q.fps : 60) - 1.5;
    if (now - last < minDt) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    // render the world only while it is visible (a tab page covers it fully otherwise)
    const covered = curTab !== 'island' || OC.UI.stack.some((l) => l.close && Object.values(OC.Pages.pages).some((p) => p.layer === l));
    const ov = overlays(); if (ov && ov.style.visibility !== (covered ? 'hidden' : '')) ov.style.visibility = covered ? 'hidden' : '';   // world bubbles never show over pages
    if (!covered || !world_rendered_once) { Wd.frame(now, dt); world_rendered_once = true; updateOverlays(dt); positionMarker(); } else Wd.tickActors(dt);
    // life simulation: fixed steps fed with REAL elapsed time (independent of the fps cap)
    OC.Sim.update((now - lastSim) / 1000); lastSim = now;
    OC.Events.update(dt); updateObserve(); OC.WorldUI.tick(dt, now / 1000);
    if (now - presT > 1000) { presT = now; syncPresence(); }
    OC.Stage.tick(dt); OC.Sound.tick(dt); OC.PetSync.tick(dt); if (curTab === 'island') OC.Requests.frame();
    if (now - reqT > 2000) { reqT = now; OC.Requests.tick(); OC.Quests.refresh(); }
    if (now - aspT > 20000) { aspT = now; OC.Growth.tick(); }
    const wx = OC.Clock.weather(); if (wx !== lastWx) { if (lastWx) St.emit('life:weather', { wx, from: lastWx }); lastWx = wx; }
    const night = OC.Clock.phase(OC.Clock.hour()) === 'night'; if (Wd.area && (night !== lastNight || wx !== lastAmbWx)) { lastNight = night; lastAmbWx = wx; OC.Sound.ambient({ area: Wd.area.id, wx, night }); }
    if (now - holdT > 400) { holdT = now; syncEditorHolds(); }   // real time (dt is capped per frame)
    drawLives(now);
    if (player) {
      // footsteps → stats, auto-pick drops the player walks over
      if (player.dist > 10) { const n = Math.floor(player.dist / 10); player.dist -= n * 10; S().stats.steps += n; saveStepT += n; if (saveStepT > 50) { saveStepT = 0; St.mark(); Gm.checkAch(); } }
      for (const d of Wd.drops.slice()) if (d.t > 0.7 && Math.hypot(d.x - player.x, d.y - player.y) < 9) pickDrop(d);
      if (player.path || player.joy) S().pos = { area: Wd.area.id, x: player.x, y: player.y };
    }
    autoSaveT += dt; if (autoSaveT > 30) { autoSaveT = 0; saveMatePos(); if (St.dirty) St.persist(); }
    if (hud.name) updateHUD();
    fpsN++; fpsT += dt; if (fpsT > 0.5 && fpsEl) { fpsEl.textContent = `${Math.round(fpsN / fpsT)} fps`; fpsN = 0; fpsT = 0; }
  }
  let world_rendered_once = false, reqT = 0, aspT = 0, lastNight = null, lastAmbWx = null;
  function saveMatePos() { if (!Wd.area) return; for (const [id, a] of Object.entries(mates)) { const c = OC.Chars.get(id); if (c) c.life.pos = { area: Wd.area.id, x: Math.round(a.x), y: Math.round(a.y) }; } }
  /** OCs open in the editor / workshop are "dressing": they pause their life until the page closes */
  function syncEditorHolds() {
    const now = new Set(); for (const k of ['charedit', 'workshop']) { const pg = OC.Pages.pages[k]; if (pg && pg.el && pg.el.classList.contains('open') && pg.params && pg.params.id) now.add(pg.params.id); }
    for (const id of now) if (!editing.has(id)) OC.Brain.hold(id, 'editor');
    for (const id of editing) if (!now.has(id)) OC.Brain.unhold(id, 'editor');
    editing = now;
  }
  function positionMarker() { if (!mk || mk.style.opacity === '0') return; const p = Wd.project(+mk.dataset.x, +mk.dataset.y, Wd.levelAt(+mk.dataset.x, +mk.dataset.y), Wd.groundY(+mk.dataset.x, +mk.dataset.y) - Wd.levelAt(+mk.dataset.x, +mk.dataset.y) * Wd.HY); mk.style.left = p.x + 'px'; mk.style.top = p.y + 'px'; }

  // =============================== native bridge hooks ===============================
  window.OCApp = {
    setInsets(t, r, b, l) { const s = document.documentElement.style; s.setProperty('--sat', t + 'px'); s.setProperty('--sar', r + 'px'); s.setProperty('--sab', b + 'px'); s.setProperty('--sal', l + 'px'); },
    onSystemTheme(dark) { nativeSysDark = !!dark; applyTheme(); },
    lifecycle(state) {
      if (state === 'pause') { if (paused) return; paused = true; S().life.lastReal = Date.now(); saveMatePos(); OC.PetSync.onPause(); St.persist(); }
      // resume: offline catch-up FIRST (no events / rewards), then the desktop pets' interactions are applied once
      else { if (!paused) return; paused = false; OC.Sim.catchUp('resume'); OC.PetSync.onResume(); syncTreeFruit(); last = lastSim = performance.now(); window.OCApp.onPermission('resume', 'ok'); }   // permissions may have changed in system settings
    },
    /** pet sync (future App-context dialogue): current mood + a line for the pet OC, as JSON */
    petContext(app) { try { return JSON.stringify(OC.LifeUI.petState(app)); } catch (e) { return '{}'; } },
    back() { if (OC.UI.back()) return true; if (curTab !== 'island') { tab('island'); return true; } return false; },
    onPetState() { const pg = OC.Pages.pages.petcenter; if (pg && pg.el && pg.el.classList.contains('open')) { pg._sig = ''; pg.refresh(pg); } },
    /** runtime permission answer (notifications) → refresh the pet pages */
    onPermission(kind, result) { if (result === 'unavailable') toast('這支手機沒有這個設定頁面', 'info'); for (const k of ['petcenter', 'pettools', 'petapps']) { const pg = OC.Pages.pages[k]; if (pg && pg.el && pg.el.classList.contains('open')) { pg._sig = ''; pg.refresh(pg); } } },
    /** widget "放出桌寵": export the current look, then start (same path as the pet center button) */
    startPets() { OC.PetSync.start().then((r) => { if (!r.ok && r.why !== 'permission') toast(r.why, 'info'); }); },
    /** notification / widget / pet double-tap → a page */
    openPage(id) { if (!OC.Pages.pages[id]) return false; if (curTab !== 'island' && curTab !== 'more') tab('more'); OC.Pages.open(id); return true; },
  };
  document.addEventListener('visibilitychange', () => window.OCApp.lifecycle(document.hidden ? 'pause' : 'resume'));
  window.addEventListener('resize', () => Wd.resize());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.OCApp.back(); });

  // ---- store events → feedback ----
  St.on('questDone', (q) => toast(`任務完成：${q.zh}（到「更多 → 今日任務」領取）`, 'flag'));
  // ---- Phase 6 feedback: small cards (never a big panel), performances when the OC is on screen ----
  St.on('achUnlocked', (a) => OC.Stage.card({ kind: 'ach', ic: 'trophy', title: `達成成就：${a.zh}`, sub: `${a.d}・到「日常 › 成就」領取獎勵` }));
  St.on('play:questDone', (e) => OC.Stage.card({ kind: 'quest', ic: e.hidden ? 'star' : 'flag', title: e.hidden ? `發現隱藏任務：${e.q.zh}` : `任務完成：${e.q.zh}`, sub: '到「日常 › 任務」領取獎勵' }));
  St.on('inv', (e) => { if (e && e.first && e.n > 0 && OC.Style.ITEMS[e.id]) { const it = OC.Style.ITEMS[e.id]; OC.Stage.card({ kind: 'discover', item: e.id, title: `圖鑑新增：${it.zh}`, sub: `${(OC.Items.KINDS[it.kind] || {}).zh || ''}・${OC.Items.RARITY[it.rarity || 1]}・+${OC.Shops.INCOME.find} 星幣` }); } });
  St.on('play:skillUp', (e) => OC.Stage.perform('levelup', Object.assign({}, e)));
  St.on('play:aspDone', (e) => OC.Stage.perform('aspDone', e));
  St.on('play:aspStep', (e) => OC.Stage.perform('aspStep', Object.assign({ zh: e.zh }, e)));
  St.on('play:aspNew', (e) => { const x = OC.PlayData.ASPIRATIONS[e.id]; if (e.by === 'auto' && x) OC.Stage.perform('aspNew', { oc: e.oc, zh: x.zh, vars: { asp: x.zh } }); });
  St.on('play:title', (e) => OC.Stage.card({ kind: 'title', ic: 'star', title: `新稱號：「${e.zh}」`, sub: '可以在角色檔案的「成長」讓 OC 戴上' }));
  St.on('play:found', (e) => { const it = OC.Style.ITEMS[e.item]; const c = OC.Chars.get(e.oc); if (it && c) OC.Stage.card({ kind: 'discover', item: e.item, title: e.gift ? `${OC.Chars.name(c)}送你${it.zh}` : `${OC.Chars.name(c)}找到了${it.zh}`, sub: '技能帶來的驚喜' }); });
  St.on('reward', (r) => { if (r.why !== '成就' && r.why !== '新發現') setTimeout(() => toast(`${r.why} +${r.coins} 星幣`, 'coin'), 900); });
  St.on('friendUp', (e) => toast(`和${Gm.NPCS[e.id].zh}的友情升到「${Gm.LEVEL_ZH[e.level]}」！`, 'heart'));
  St.on('inv', (e) => { if (e.first && e.n > 0) toast(`圖鑑新增：${Sty.ITEMS[e.id].zh}`, 'book'); });
  St.on('saveError', () => toast('存檔空間不足：請刪除一些作品', 'info'));
  ['inv', 'coins', 'needs', 'npc', 'chars', 'animations', 'assets', 'quest', 'ach', 'goal', 'placed', 'growth', 'life'].forEach((ev) => St.on(ev, () => { clearTimeout(refreshT); refreshT = setTimeout(() => OC.Pages.refreshOpen(), 120); }));
  let refreshT = 0;

  // =============================== boot ===============================
  async function boot() {
    if (window.__ocFailed) return;   // the boot guard already explained a fatal problem
    St.load();
    // the native preference also drives the splash / window background → it is the source of truth
    if (NATIVE) { try { const m = NATIVE.getThemeMode(); if (['light', 'dark', 'system'].includes(m)) S().settings.theme = m; } catch (e) { /* */ } }
    applyTheme(); applyMotion();
    // low-power start: explicit (?safe=1 from the native error screen) or a weak phone on first run
    const weak = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    if (/[?&]safe=1/.test(location.search) || (!S().onboarded && weak)) { S().settings.perf = 'saver'; St.touch(); }
    await OC.Assets.init();
    // Phase 4 life simulation: engines + absence catch-up (capped, no events, no rewards)
    OC.Items.registerCustom();                       // workshop products → item catalogue
    OC.Shops.income();                               // exploration / discovery income (idempotent)
    // Phase 6: one progress bus feeds quests, requests, aspirations, achievements; feedback = cards + performances + sound
    OC.Growth.extendSkills(); OC.Progress.wire();
    OC.Progress.on((d) => OC.Quests.onEvent(d)); OC.Progress.on((d) => OC.Requests.onEvent(d)); OC.Progress.on((d) => OC.Growth.onEventAsp(d));
    OC.Sound.boot();
    St.on('life:skillUp', (e) => OC.Growth.onSkillUp({ oc: e.id, skill: e.skill, lv: e.lv }));
    OC.Brain.init(lifeHooks); OC.Events.init(lifeHooks);
    OC.Sim.onStep((g) => OC.Places.growAll(g)); OC.Sim.onAbstract((g) => OC.Places.growAll(g));
    OC.Sim.catchUp('boot');
    if (NATIVE) { try { const ins = NATIVE.insets(); if (ins) window.OCApp.setInsets(...ins.split(',').map(Number)); } catch (e) { /* */ } }
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    Wd.init($('#world'), { hooks: { tap: onTap, longPress: onLongPress, dragMove, dragEnd, ghostMoved: () => syncPlace(), ghostDone: () => placing && placing.commit && placing.commit(), lampOn: (uid) => S().world.lamps[uid] !== false, contextLost: () => { toast('畫面需要重新整理', 'refresh'); setTimeout(() => { if (Wd.renderer.getContext().isContextLost() && !document.hidden && window.__ocFail) window.__ocFail('3D 畫面中斷了', '顯示晶片的繪圖環境遺失且沒有恢復。請試試「用省電模式重新開啟」。', 'webglcontextlost'); }, 5000); }, panned: () => {} } });
    Wd.hourFn = () => OC.Clock.hour(); Wd.weatherFn = () => OC.Clock.weather();
    requestAnimationFrame(loop);
    window.__ocBooted = true;
    $('#boot').classList.add('done'); setTimeout(() => { const b = $('#boot'); if (b && b.classList.contains('done')) b.remove(); }, 500);
    // 8.0 first impression: logo → (first run) opening flight over the island → welcome → creator; returning players: logo → welcome
    const firstRun = !S().onboarded || !OC.Chars.all().length;
    await OC.Intro.logo();
    if (firstRun) {
      Wd.loadArea(OC.Areas.isle, { furniture: OC.Places.room('isle') });   // the island without anyone on it yet
      if (!S().intro.seen) await OC.Intro.opening({ keepShot: true });
      await OC.Intro.welcome({ returning: false });
      await OC.Creator.start({ first: true });
      Wd.shot(null);
    }
    if (S().legacyAnims && S().legacyAnims.length) OC.Chars.migrateLegacyAnims().then((n) => n && toast(`已把 ${n} 段舊作品搬到新的素材庫`, 'film')).catch((e) => console.error('[migrate]', e));
    if (!S().activeId || !OC.Chars.get(S().activeId)) S().activeId = S().roster[0];
    buildHUD(); buildTabbar(); buildBag(); buildDialogue(); buildJoystick();
    if (/[?&]dev=1/.test(location.search)) { S().settings.dev = true; }
    const pos = S().pos || {}; loadArea(OC.Areas[pos.area] ? pos.area : 'isle', pos.area ? pos : null);
    applyPerf(); applyControl(); syncTreeFruit(); tab('island'); updateHUD(); Gm.todayQuests(); Gm.checkAch();
    Wd.setMode(S().view.mode || 'classic', { subject: player }); if (S().view.mode !== 'classic' && S().view.yaw) Wd.yaw = S().view.yaw;
    if (firstRun) { last = lastSim = performance.now(); window.__ocReady = true; await OC.Intro.debut(player, me()); OC.Tutorial && OC.Tutorial.start(); }
    else {
      if (OC.Tutorial && !S().intro.tutorial.done && !S().intro.tutorial.skipped && S().intro.tutorial.step > 0) setTimeout(() => OC.Tutorial.start(), 1200);   // resume an unfinished tutorial
      OC.Intro.welcome({ returning: true, name: OC.Chars.name(me()) }).then(async (v) => { if (v === 'new') newGame(); });
    }
    last = lastSim = performance.now();   // boot time is not simulated time
    window.__ocReady = true;
  }
  /** welcome › 新遊戲 on an existing save: never silent — offer a backup first, then reset (settings kept) */
  function newGame() {
    sheet('開始新遊戲？', (b, api) => b.append(h('p.muted', null, '目前的角色與進度會被新的存檔取代（設定會保留）。建議先匯出存檔，之後可以在設定 › 資料匯入還原。'),
      h('button.btn.block', { style: { marginTop: '8px' }, on: { click: () => exportSave() } }, icon('download', 's'), '先匯出存檔備份'),
      h('button.btn.block', { style: { marginTop: '8px', background: 'var(--danger)', color: '#fff' }, on: { click: () => { api.close(); St.reset(); location.reload(); } } }, '開始新遊戲'),
      h('button.btn.ghost.block', { style: { marginTop: '8px' }, on: { click: () => api.close() } }, '取消')));
  }

  // roster changes (new OC, switch, join/leave island) → refresh actors without reloading the area
  let charsT = 0;
  St.on('chars', () => { clearTimeout(charsT); charsT = setTimeout(() => { if (hud.name) { lastHudKey = ''; updateHUD(); } if (player) player.key = ''; refreshActors(); }, 60); });
  St.on('animations', () => { if (player) player.key = ''; for (const a of Wd.actors) a.key = ''; });
  // life experience → suggestions (never applied without the player's consent; see OC.Chars.suggest/resolve)
  St.on('stat', (e) => {
    const c = me(); if (!c) return; const st = S().stats;
    if (e.k === 'picked' && st.picked >= 15) OC.Chars.suggest(c, 'trait', 'nature', '最近常常摘花、撿貝殼');
    if (e.k === 'eaten' && st.eaten >= 15) OC.Chars.suggest(c, 'trait', 'foodie', '吃了好多好吃的東西');
    if (e.k === 'anims' && st.anims >= 3) OC.Chars.suggest(c, 'trait', 'creative', '做了好幾段動畫');
    if (e.k === 'talks' && st.talks >= 20) OC.Chars.suggest(c, 'trait', 'social', '常常和居民聊天');
    if (e.k === 'shakes' && st.shakes >= 10) OC.Chars.suggest(c, 'hobby', '照顧果樹', '搖了很多次果樹');
  });
  St.on('growthSuggest', (e) => { lastHudKey = ''; toast(`${OC.Chars.name(e.c)}好像${e.type === 'trait' ? '有了新的個性' : e.type === 'habit' ? '有了新習慣' : '發現了新興趣'}：「${(e.s && e.s.zh) || e.value}」（點右上角的鈴鐺決定）`, 'sparkle'); });

  // ---- hooks used by the life engines (js/life/brain.js, events.js) ----
  const onScreen = (a) => { if (!a || curTab !== 'island') return false; const p = Wd.project(a.x, a.y, a.lvl); return p.x > -40 && p.x < innerWidth + 40 && p.y > -40 && p.y < innerHeight + 40; };
  const lifeHooks = {
    say: (a, text, name, dur, o) => bubble(a, text, name, dur, o),
    depart: (id) => { const a = mates[id]; OC.Brain.detach(id); if (a) { Wd.removeActor(a); delete mates[id]; } },
    emote: (a, e) => { if (onScreen(a)) emote(a, e); },
    hide: () => {},
    notice: (n) => OC.LifeUI.pushNotice(n),
    cam: (a, on) => { if (on && a) Wd.focus(a, 2.5); else if (!observing) Wd.focus(null); document.documentElement.classList.toggle('cinema', !!on); },
    choice: (prompt, opts, cb) => showDialogue('', [prompt], opts.map((label, i) => ({ label, fx: () => { cb(i); return null; } })), null, true),
    sound: (id) => { OC.Mind.note(null, 'sound', `音效「${id}」（遊戲尚無音訊系統，只記錄）`); },
    busy: () => !!(dlgOpen || placing || testChar || carry || curTab !== 'island' || OC.UI.stack.length),
  };
  St.on('life:offline', (o) => { if (o.simulated >= 30) setTimeout(() => toast(`離開了約 ${o.min >= 120 ? Math.round(o.min / 60) + ' 小時' : o.min + ' 分鐘'}，大家照自己的步調生活${o.capped ? '（最多計算 8 小時）' : ''}`, 'clock'), 1200); });
  St.on('life:skillUp', (e) => { const c = OC.Chars.get(e.id); if (c) toast(`${OC.Chars.name(c)}的${OC.Mind.SKILLS[e.skill]}升到 Lv.${e.lv}`, 'star'); });
  St.on('life:relType', (e) => { const a = OC.Chars.get(e.a), b = OC.Chars.get(e.b); if (a && b && OC.Mind.RANK[e.to] >= 2 && OC.Mind.RANK[e.to] > (OC.Mind.RANK[e.from] || 0)) toast(`${OC.Chars.name(a)}把${OC.Chars.name(b)}當成${OC.Mind.TYPES[e.to]}了`, 'heart'); });

  OC.App = { loadArea, goThen, floatText, syncPresence, presentHere, observe, stopObserve, actorOf, showDialogue, startCarry, dragMove, dragEnd, onScreen, tab, setTheme, applyPerf, perfOf, applyMotion, applyControl, live, exportPet, exportSave, travel, startPlacement, reactEat, goToNpc, testOnIsland, refreshActors, greetFrom, bubble, get player() { return player; }, get npcs() { return npcs; }, get mates() { return mates; }, get curTab() { return curTab; }, get dlgOpen() { return dlgOpen; }, setDecorate, me };
  boot().catch((e) => { console.error(e); if (window.__ocFail) window.__ocFail('遊戲啟動失敗', '啟動時發生錯誤。請試試「用省電模式重新開啟」。', (e && e.stack) || String(e)); });
})();
