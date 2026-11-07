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
    el.append(hud.me, h('div.hud-right', null, h('button.hud-time', { 'aria-label': '時間與天氣', on: { click: () => timeSheet() } }, hud.wxIc, hud.time, h('span.faint', null, '・'), hud.wx), h('div.hstack', { style: { gap: '6px' } }, h('div.chip', { 'aria-label': '金幣' }, h('span', { style: { color: 'var(--sun)', display: 'grid' } }, icon('coin', 's')), hud.coins), hud.deco)));
    live(hud.av, () => ({ char: me(), pose: Object.assign({ face: 0.2 }, moodPose()) }));
    fpsEl = h('div.fps'); $('#app').append(fpsEl);
    updateHUD();
  }
  let lastHudKey = '';
  function updateHUD() {
    const L = OC.Clock.label(), key = [OC.Chars.name(me()), Gm.moodFace().label, L.time, L.wx, S().coins, L.date].join('|');
    if (key === lastHudKey) return; lastHudKey = key;
    hud.name.textContent = OC.Chars.name(me()); hud.mood.textContent = Gm.moodFace().label;
    hud.time.textContent = `${L.date} ${L.time}`; hud.wx.textContent = L.wxZh; hud.wxIc.replaceChildren(icon(L.phase === 'night' ? 'moon' : L.wxIcon, 's'));
    hud.coins.textContent = S().coins.toLocaleString();
  }
  function timeSheet() {
    const L = OC.Clock.label();
    sheet('時間與天氣', (b) => b.append(h('div.list', null, OC.UI.row(L.phase === 'night' ? 'moon' : 'sun', `${L.date}（${L.week}）${L.time}`, S().settings.time === 'real' ? '跟隨手機的真實時間' : `固定為${L.phaseZh}（設定中可改回現實）`), OC.UI.row(L.wxIcon, `天氣：${L.wxZh}`, S().settings.weather === 'auto' ? '每 6 小時依日期自動變化' : '固定天氣（設定中可改回自動）')), h('button.btn.block', { style: { marginTop: '12px' }, on: { click: () => { OC.UI.back(); OC.Pages.open('settings'); } } }, icon('gear', 's'), '在設定中調整')));
  }

  // =============================== tab bar ===============================
  const TABS = [['island', '小島', 'island'], ['char', '角色', 'person'], ['workshop', '工坊', 'brush'], ['explore', '探索', 'compass'], ['more', '更多', 'more']];
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
    const ids = Object.keys(S().inv).filter((id) => Sty.ITEMS[id] && Sty.ITEMS[id].kind !== 'clothing');
    if (!ids.length) { slots.replaceChildren(h('div.empty', { style: { padding: '14px' } }, '背包是空的')); return; }
    slots.replaceChildren(...ids.map((id) => { const c = Sty.itemCanvas(id, 96); const cv = h('canvas', { width: 96, height: 96 }); cv.getContext('2d').drawImage(c, 0, 0); const sl = h('div.slot', { role: 'button', 'aria-label': `${Sty.ITEMS[id].zh} ${St.count(id)} 個`, 'data-id': id }, cv, h('span.count', null, St.count(id))); bindSlot(sl, id); return sl; }));
  }
  function bindSlot(sl, id) {
    let st = null, ghost = null;
    sl.addEventListener('pointerdown', (e) => { sl.setPointerCapture(e.pointerId); st = { x: e.clientX, y: e.clientY, t: performance.now(), drag: false }; });
    sl.addEventListener('pointermove', (e) => {
      if (!st) return;
      if (!st.drag && (Math.abs(e.clientY - st.y) > 12 || (Math.abs(e.clientX - st.x) > 12 && performance.now() - st.t > 220))) { st.drag = true; ghost = h('div.drag-ghost'); ghost.append(Sty.itemImg(id)); ghost.firstChild.style.width = '100%'; $('#app').append(ghost); haptic(); }
      if (st.drag) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; const t = dropTarget(e.clientX, e.clientY, id); ghost.classList.toggle('hit', !!t); }
    });
    const end = (e) => {
      if (!st) return; const was = st; st = null;
      if (was.drag) { ghost.remove(); ghost = null; if (e.type !== 'pointercancel') dropItem(e.clientX, e.clientY, id); return; }
      if (e.type !== 'pointercancel') OC.Pages.itemSheet(id, renderSlots);
    };
    sl.addEventListener('pointerup', end); sl.addEventListener('pointercancel', end);
  }
  function dropTarget(sx, sy, id) {
    const r = Wd.pick(sx, sy - 24); const it = r.it, def = Sty.ITEMS[id];
    if (it && it.type === 'self' && def.use) return { kind: 'eat' };
    if (it && it.type === 'npc') return { kind: 'gift', npc: it.id };
    if (def.kind === 'furniture' && Wd.area.id === 'isle') return { kind: 'place', p: r.p };
    return null;
  }
  function dropItem(sx, sy, id) {
    const t = dropTarget(sx, sy, id); if (!t) { toast('拖到角色身上可以使用，拖到居民身上可以送禮', 'info'); return; }
    if (t.kind === 'eat') { const fx = Gm.eat(id); if (fx) { floatText(player, `+${Object.values(fx).reduce((a, b) => a + b, 0)}`, 'var(--need-food)'); reactEat(); } }
    if (t.kind === 'gift') giveGift(t.npc, id);
    if (t.kind === 'place') { closeTray(); startPlacement({ id }, t.p); }
    renderSlots();
  }

  // =============================== actors ===============================
  const me = () => OC.Chars.active();
  function makePlayer(pos) {
    player = Wd.actor({ player: true, xray: true, x: pos.x, y: pos.y, char: () => testChar || me(), interact: { type: 'self', hit: { w: 26, h: 40, d: 6 }, prio: 3 } });
    player.update = (a, dt) => {
      const mf = Gm.moodFace(); if (!a.act) { a.eyes = mf.eyes === 'round' ? undefined : mf.eyes; a.mouth = mf.mouth === 'cat' ? undefined : mf.mouth; }
      personalityIdle(a, dt, me());
    };
  }
  /** small personality-driven idle behaviours (observable differences between OCs) */
  function personalityIdle(a, dt, c) {
    if (!c || a.path || a.joy || a.act || a.mode === 'talk') { a.idleT = 0; return; }
    const b = OC.Chars.behavior(c); a.idleT = (a.idleT || 0) + dt;
    if (a.idleT < b.fidgetEvery) return; a.idleT = 0;
    const r = Math.random();
    if (r < b.sitChance) Wd.setAction(a, 'sit', { dur: 4 + Math.random() * 4, priority: 1 });
    else if (b.habit === 'hum' && r < 0.7) emote(a, '♪');
    else if (b.habit === 'stretch' && r < 0.6) Wd.setAction(a, 'happy', { dur: 1.2, priority: 1 });
    else if (b.lookAround) { a.tFace = (Math.random() - 0.5) * 1.6; }
    else if (r > 0.85 && b.emoteScale > 1) Wd.setAction(a, 'happy', { dur: 1, priority: 1 });
  }
  function makeNPCs() {
    npcs = {};
    if (Wd.area.id !== 'isle') return;
    for (const [id, cfg] of Object.entries(Wd.area.NPC)) {
      const d = Gm.NPCS[id], c = OC.CharRender.presetChar(d.preset);
      const a = Wd.actor({ id, x: cfg.home.x, y: cfg.home.y, char: () => c, interact: { type: 'npc', id, hit: { w: 28, h: 40, d: 6 }, prio: 2, label: d.zh }, fixedSpeed: true, speed: 34 });
      a.home = cfg.home; a.r = cfg.r; a.wait = 1 + Math.random() * 3;
      a.update = (b, dt) => wander(b, dt);
      npcs[id] = a;
    }
    // the player's other OCs who live on the island
    mates = {};
    const spots = [[260, 700], [330, 720], [210, 600], [380, 650]];
    OC.Chars.all().filter((c) => c.id !== S().activeId && c.status.onIsland).slice(0, 4).forEach((c, i) => {
      const [x, y] = spots[i]; const a = Wd.actor({ mate: c.id, x, y, char: () => OC.Chars.get(c.id), interact: { type: 'mate', id: c.id, hit: { w: 28, h: 40, d: 6 }, prio: 2, label: OC.Chars.name(c) } });
      a.home = { x, y }; a.r = 60; a.wait = 2 + Math.random() * 4; a.update = (b, dt) => { wander(b, dt); personalityIdle(b, dt, OC.Chars.get(c.id)); };
      mates[c.id] = a;
    });
  }
  let mates = {};
  function wander(b, dt) { if (b.mode === 'talk' || b.act) return; if (!b.path) { b.wait -= dt; if (b.wait < 0) { b.wait = 4 + Math.random() * 6; const ang = Math.random() * Math.PI * 2, rr = Math.random() * b.r; Wd.walkTo(b, b.home.x + Math.cos(ang) * rr, b.home.y + Math.sin(ang) * rr * 0.7); } } }
  function refreshActors() { if (!Wd.area) return; for (const a of Object.values(mates)) Wd.removeActor(a); mates = {}; for (const a of Object.values(npcs)) Wd.removeActor(a); makeNPCs(); if (player) player.key = ''; }
  /** greeting in the OC's own style + a line in its speech style */
  function greetFrom(a, c) {
    const b = OC.Chars.behavior(c); Wd.setAction(a, 'greet', { dur: 1.4, priority: 3 }); if (b.greet === 'jump') Wd.jump(a);
    const lines = c.speech.catchphrase ? [c.speech.catchphrase] : ['你好呀！', '今天天氣真好。', '嗨！', '要一起玩嗎？'];
    bubble(a, OC.Chars.speak(c, lines[Math.floor(Math.random() * lines.length)]));
    if (b.blushOnTalk) a.blush = 1, setTimeout(() => (a.blush = 0), 1600);
  }

  // =============================== world overlays (emotes / float text / prompts) ===============================
  const floats = [];
  function emote(a, kind, dur = 1.4) { const el = h('div.float-text', { style: { animationDuration: dur + 's', fontSize: '22px' } }, kind); overlays().append(el); floats.push({ el, a, up: 46, t: 0, dur }); }
  function floatText(a, text, color) { const el = h('div.float-text', { style: { color: color || 'var(--accent)' } }, text); overlays().append(el); floats.push({ el, a, up: 40, t: 0, dur: 1.4 }); }
  function floatAt(x, y, lvl, text, color) { const el = h('div.float-text', { style: { color: color || 'var(--accent)' } }, text); overlays().append(el); floats.push({ el, pos: { x, y, lvl }, up: 20, t: 0, dur: 1.4 }); }
  function updateOverlays(dt) {
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt; if (f.t > f.dur) { f.el.remove(); floats.splice(i, 1); continue; }
      const p = f.a ? Wd.project(f.a.x, f.a.y, f.a.lvl, (f.a.gy - f.a.lvl * Wd.HY) + f.up) : Wd.project(f.pos.x, f.pos.y, f.pos.lvl, f.up);
      f.el.style.left = p.x + 'px'; f.el.style.top = p.y + 'px';
    }
  }

  // =============================== interactions ===============================
  function busy() { return dlgOpen || placing; }
  function onTap(r) {
    if (dlgOpen) { advanceDialogue(); return; }
    if (placing) return;
    standUp();
    const it = r.it;
    if (decorate && it && it.type === 'furn') { startPlacement({ uid: it.uid }); return; }
    if (!it) { const t = Wd.nearestWalkable(r.p.x, r.p.y, 24); if (t && Wd.walkTo(player, t.x, t.y)) marker(t); else toast('那裡走不過去', 'info'); return; }
    haptic();
    switch (it.type) {
      case 'self': greetFrom(player, me()); break;
      case 'mate': { const a = mates[it.id], c = OC.Chars.get(it.id); if (a && c) { face(a, player.x - a.x, 0.1); greetFrom(a, c); } break; }
      case 'npc': approachNpc(it.id); break;
      case 'drop': goThen(it.drop.x, it.drop.y + 2, () => pickDrop(it.drop)); break;
      case 'tree': goThen(it.at.x, it.at.y, () => shakeTree(it)); break;
      case 'bed': goThen(it.at.x, it.at.y, () => pickFlower(it)); break;
      case 'bench': goThen(it.at.x, it.at.y, () => sit(it.seat)); break;
      case 'home': goThen(it.at.x, it.at.y, () => restHome()); break;
      case 'shop': goThen(it.at.x, it.at.y, () => { face(player, 0, 1); OC.Pages.open('shop'); }); break;
      case 'npcHome': goThen(it.at.x, it.at.y, () => { face(player, 0, 1); const n = npcs[it.npc]; toast(`${it.label}${n && Math.hypot(n.x - player.x, n.y - player.y) < 140 ? `・${Gm.NPCS[it.npc].zh}就在附近` : '・現在不在家'}`, 'home'); }); break;
      case 'travel': goThen(it.at.x, it.at.y, () => tab('explore')); break;
      case 'travelHome': goThen(it.at.x, it.at.y, () => travel('isle')); break;
      case 'furn': furnInteract(it); break;
    }
  }
  function onLongPress(r) {
    haptic();
    const it = r.it;
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
  function standUp() { if (player && player.mode === 'sit') { player.mode = 'idle'; player.seatY = 0; Wd.setAction(player, 'idle'); } }
  function sit(seat) { player.x = seat.x; player.y = seat.y; player.seatY = seat.up; player.mode = 'sit'; player.path = null; face(player, 0, 1); Wd.setAction(player, 'sit', { priority: 4 }); emote(player, '♪'); toast('坐下來休息…（精力會慢慢恢復）', 'zap'); }
  function restHome() {
    face(player, 0, -1); const f = $('#fade'); f.style.opacity = 1; f.style.pointerEvents = 'auto';
    Wd.setAction(player, 'sleep', { dur: 1.2, priority: 5 });
    setTimeout(() => { St.needs({ energy: Gm.has('sleepy') ? 60 : 45, mood: 5 }); f.style.opacity = 0; f.style.pointerEvents = 'none'; toast('在家休息了一下，精神好多了！', 'home'); face(player, 0, 1); }, 1100);
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
    for (let i = 0; i < n; i++) { const a = -0.6 + i * 0.6 + Math.random() * 0.3; const tx = it.x + Math.cos(a) * 22, ty = it.y + 10 + Math.abs(Math.sin(a)) * 8 + i * 3; const p = Wd.nearestWalkable(tx, ty, 20) || { x: it.at.x, y: it.at.y }; Wd.spawnDrop(it.fruit, it.x, it.y - 6, p.x, p.y, it.lvl || 0, it.color); }
    haptic(); emote(player, '!');
  }
  function pickDrop(d) {
    if (!Wd.drops.includes(d)) return;
    Wd.removeDrop(d); St.add(d.id, 1, 'pick'); floatAt(d.x, d.y, d.lvl, `+1 ${Sty.ITEMS[d.id].zh}`);
    if (d.daily) { const w = S().world[d.daily]; w.taken.push(d.spot); St.touch(); St.stat('picked'); Gm.progress('pick'); if (Gm.has('curious') && Math.random() < 0.25) { St.add(d.id, 1); toast('好奇心發作，多找到一個！', 'sparkle'); } }
    if (tray.classList.contains('open')) renderSlots();
  }
  function pickFlower(it) {
    face(player, 0, -1); const k = it.id, last = S().world.trees[k] || 0, left = 8 - (Date.now() - last) / 60000;
    if (left > 0) { toast(`花還沒長好，約 ${Math.ceil(left)} 分鐘後再來`, 'leaf'); return; }
    S().world.trees[k] = Date.now(); St.add('flower', 1, 'pick'); St.needs({ mood: 3 }); St.stat('picked'); Gm.progress('pick');
    floatAt(it.x, it.y, it.lvl || 0, '+1 小雛菊'); haptic();
  }
  function spawnDailies() {
    const day = OC.Clock.dayKey(), area = Wd.area;
    const key = area.id === 'isle' ? 'shells' : 'mush', item = area.id === 'isle' ? 'shell' : 'mushroom', spots = area.id === 'isle' ? area.shellSpots : area.mushSpots;
    if (!spots) return; const w = S().world[key]; if (w.day !== day) { w.day = day; w.taken = []; St.touch(); }
    const seed = OC.hash(new Date().getDate() * 7.7 + (area.id === 'isle' ? 1 : 2));
    const pickN = area.id === 'isle' ? 4 : 5, order = spots.map((s, i) => [OC.hash(seed * 100 + i), i]).sort((a, b) => a[0] - b[0]).slice(0, pickN).map((x) => x[1]);
    for (const i of order) { if (w.taken.includes(i)) continue; const [x, y] = spots[i]; if (!Wd.walkable(x, y)) continue; const d = Wd.spawnDrop(item, x, y, x, y, 0, item === 'shell' ? '#FFB3A7' : '#F26B5B'); d.t = 1; d.daily = key; d.spot = i; if (item === 'mushroom') { d.m.scale.set(1.1, 0.7, 1.1); } }
  }
  function furnInteract(it) {
    const def = Sty.ITEMS[it.id];
    if (def.sit) { goThen(it.x, it.y + 12, () => sit({ x: it.x, y: it.y + 1, up: it.id === 'chair' ? 9 : 4 })); return; }
    if (it.id === 'lamp') { const L = S().world.lamps; L[it.uid] = L[it.uid] === false; St.touch(); toast(L[it.uid] === false ? '關掉了檯燈' : '打開了檯燈（晚上會亮）', 'sun'); return; }
    toast(`${def.zh}・長按或開啟佈置模式可以移動`, 'sofa');
  }
  function reactEat() { if (!player) return; const b = OC.Chars.behavior(me()); Wd.setAction(player, 'eat', { dur: b.chew, priority: 4 }); emote(player, '♥'); }
  function moodPose() { const m = Gm.moodFace(); return { eyes: m.eyes === 'round' ? undefined : m.eyes, mouth: m.mouth === 'cat' ? undefined : m.mouth }; }
  // speech bubble above an actor
  function bubble(a, text) { const el = h('div.speech', null, text); overlays().append(el); floats.push({ el, a, up: 52, t: 0, dur: 2.6, keep: true }); }

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
  function showDialogue(who, lines, choices, done) {
    closeTray();
    dlgOpen = { lines: lines.slice(), choices, done, i: 0, layer: { scrim: false, close: () => endDialogue() } };
    OC.UI.pushLayer(dlgOpen.layer);
    dlg.who.textContent = who; dlg.el.classList.add('open'); renderLine();
  }
  function renderLine() {
    const d = dlgOpen, last = d.i >= d.lines.length - 1;
    typeLine(d.lines[d.i]);
    dlg.choices.replaceChildren(); dlg.next.hidden = last && d.choices.length > 0;
    if (last && d.choices.length) dlg.choices.append(...d.choices.map((c) => h('button.btn.block', { on: { click: () => { haptic(); c.fx(); const reply = ['（看起來很開心）', '嘿嘿，謝謝你～', '好呀！'][Math.floor(Math.random() * 3)]; dlgOpen.choices = []; dlgOpen.lines.push(reply); dlgOpen.i++; renderLine(); } } }, c.label)));
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
  function startPlacement(o, at) {
    if (Wd.area.id !== 'isle') { toast('家具只能放在晴日島', 'info'); return; }
    if (o.id && !St.count(o.id)) { toast('背包裡沒有這件家具', 'info'); return; }
    cancelPlacement(true); closeTray();
    let f;
    if (o.uid) { const rec = S().placed.find((p) => p.uid === o.uid); if (!rec) return; f = Object.assign({}, rec); Wd.removeFurniture(o.uid); placing = { mode: 'move', f, orig: Object.assign({}, rec) }; }
    else { const p = at || player; f = { id: o.id, x: p.x, y: p.y, rot: 0 }; if (!at || !Wd.canPlace(f)) Object.assign(f, findSpot(f, p.x, p.y + (at ? 0 : 24))); placing = { mode: 'new', f }; }
    Wd.setGhost(f);
    placing.layer = { scrim: false, close: () => cancelPlacement() }; OC.UI.pushLayer(placing.layer);
    placeBar = h('div.place-bar', null,
      h('button.btn.s', { on: { click: () => { f.rot = ((f.rot || 0) + 1) % 4; Wd.moveGhost(f.x, f.y, f.rot); syncPlace(); } } }, icon('rotate', 's'), '旋轉'),
      placing.mode === 'move' ? h('button.btn.s', { on: { click: () => storeFurniture() } }, icon('bag', 's'), '收回') : null,
      h('button.btn.s', { on: { click: () => cancelPlacement() } }, '取消'),
      h('button.btn.s.primary', { 'data-ok': '', on: { click: () => confirmPlacement() } }, icon('check', 's'), '放這裡'));
    $('#app').append(placeBar); bagFab.classList.add('hide'); syncPlace();
    toast('拖曳家具移動位置，或點地面', 'move');
  }
  /** nearest valid spot (spiral search on the 6-unit placement grid) */
  function findSpot(f, x0, y0) {
    for (let r = 0; r <= 120; r += 6) for (let a = 0; a < Math.PI * 2; a += r ? 6 / r : 7) { const g = Object.assign({}, f, { x: Math.round((x0 + Math.cos(a) * r) / 6) * 6, y: Math.round((y0 + Math.sin(a) * r) / 6) * 6 }); if (Wd.canPlace(g)) return { x: g.x, y: g.y }; }
    return { x: x0, y: y0 };
  }
  function syncPlace() { if (!placeBar) return; const ok = Wd.ghost && Wd.ghost.ok; const b = placeBar.querySelector('[data-ok]'); b.disabled = !ok; b.classList.toggle('locked', !ok); }
  function endPlacementUI() { if (placeBar) { placeBar.remove(); placeBar = null; } Wd.setGhost(null); if (placing && placing.layer) OC.UI.popLayer(placing.layer); placing = null; if (curTab === 'island') bagFab.classList.remove('hide'); }
  function cancelPlacement(silent) { if (!placing) return; if (placing.mode === 'move') Wd.addFurniture(placing.orig); endPlacementUI(); if (!silent) toast('已取消', 'close'); }
  function confirmPlacement() {
    const g = Wd.ghost; if (!g || !g.ok) { toast('這裡放不下', 'info'); return; }
    const f = Object.assign({}, g.f);
    if (placing.mode === 'new') { if (!St.take(f.id)) { toast('背包裡沒有這件家具', 'info'); endPlacementUI(); return; } f.uid = 'f' + Date.now().toString(36); S().placed.push(f); }
    else { const i = S().placed.findIndex((p) => p.uid === placing.orig.uid); f.uid = placing.orig.uid; S().placed[i] = f; }
    Wd.addFurniture(f); St.stat('placed'); Gm.progress('place'); St.needs({ mood: Gm.has('tidy') ? 8 : 3 }); St.touch('placed');
    endPlacementUI(); haptic(); toast('佈置完成！', 'check');
  }
  function storeFurniture() { const uid = placing.orig.uid; S().placed = S().placed.filter((p) => p.uid !== uid); St.add(placing.orig.id, 1, 'store'); placing.mode = 'new'; endPlacementUI(); toast('收回背包了', 'bag'); }

  // =============================== travel / areas ===============================
  function loadArea(id, pos) {
    const def = OC.Areas[id];
    const ctx = Wd.loadArea(def, { pos, furniture: id === 'isle' ? S().placed : [] });
    makePlayer(pos && Wd.walkable(pos.x, pos.y) ? pos : def.spawn); makeNPCs(); spawnDailies();
    S().pos = { area: id, x: player.x, y: player.y };
  }
  function travel(id) {
    if (Wd.area && Wd.area.id === id) { tab('island'); return; }
    const f = $('#fade'); f.style.opacity = 1; f.style.pointerEvents = 'auto';
    setTimeout(() => {
      tab('island'); loadArea(id, null);
      if (id !== 'isle') { S().stats.visits[id] = (S().stats.visits[id] || 0) + 1; Gm.progress('visit'); St.needs({ mood: 6 }); }
      Gm.checkAch(); syncTreeFruit(); applyPerf();
      setTimeout(() => { f.style.opacity = 0; f.style.pointerEvents = 'none'; toast(`來到了${OC.Areas[id].zh}`, 'compass'); }, 250);
    }, 450);
  }

  // =============================== desktop pet export ===============================
  /** render the chosen OC's real actions (frames or rig) into the overlay pet's sprite sets */
  async function exportPet() {
    if (!NATIVE) return false;
    const c = OC.Chars.get(S().petId) || me(); if (!c) return false;
    for (const id of Object.values(c.actions || {}).flatMap((m) => Object.values(m))) { const d = OC.Anim.get(id); if (d) await OC.Anim.preload(d); }
    const px = 192, out = { fps: {}, frames: {} };
    const sample = (action, n, fps, extra) => {
      const r = OC.Anim.resolve(c, action, 'right'); const frames = [];
      const count = r && r.doc && c.actions[r.action] ? Math.min(12, OC.Anim.count(r.doc)) : n;
      const rate = r && r.doc && c.actions[r.action] ? r.doc.fps : fps;
      for (let i = 0; i < count; i++) {
        const k = OC.makeCanvas(px, px), x = k.getContext('2d');
        const at = r && r.doc && c.actions[r.action] ? (i / rate) + 0.001 : i / fps;
        OC.CharRender.draw(x, c, Object.assign({ action, at, dir: 'right', face: 0.6, noShadow: true }, extra ? extra(i, count) : {}), px / 2, px * 0.94, px / 74, at);
        frames.push(k.toDataURL('image/png'));
      }
      out.frames[action === 'greet' ? 'happy' : action] = frames; out.fps[action === 'greet' ? 'happy' : action] = rate;
    };
    sample('idle', 4, 4, (i) => ({ breath: Math.sin((i / 4) * Math.PI * 2), blink: i === 3 ? 1 : 0 }));
    sample('walk', 8, 8, (i) => ({ walk: 1, phase: i / 4 }));
    sample('drag', 2, 6); sample('sit', 2, 3); sample('sleep', 2, 2); sample('happy', 4, 8);
    try { return !!NATIVE.savePetSprites(JSON.stringify(out)); } catch (e) { console.error(e); return false; }
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
    joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); id = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; standUp(); move(e); });
    const move = (e) => { if (e.pointerId !== id) return; let dx = e.clientX - cx, dy = e.clientY - cy; const m = Math.hypot(dx, dy), R = 40; if (m > R) { dx *= R / m; dy *= R / m; } knob.style.transform = `translate(${dx}px, ${dy}px)`; if (player && !busy()) { player.path = null; player.joy = { jx: dx / R, jy: dy / R }; } };
    const up = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; if (player) player.joy = null; };
    joy.addEventListener('pointermove', move); joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up);
    $('#app').append(joy);
  }
  function applyControl() { if (joy) joy.hidden = curTab !== 'island' || S().settings.control !== 'joy'; }

  // =============================== main loop ===============================
  let autoSaveT = 0, last = performance.now(), acc = 0, fpsN = 0, fpsT = 0, needT = 0, saveStepT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (paused) { last = now; return; }
    const minDt = 1000 / (Q ? Q.fps : 60) - 1.5;
    if (now - last < minDt) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    // render the world only while it is visible (a tab page covers it fully otherwise)
    const covered = curTab !== 'island' || OC.UI.stack.some((l) => l.close && Object.values(OC.Pages.pages).some((p) => p.layer === l));
    if (!covered || !world_rendered_once) { Wd.frame(now, dt); world_rendered_once = true; updateOverlays(dt); positionMarker(); }
    drawLives(now);
    if (player) {
      // footsteps → stats, auto-pick drops the player walks over
      if (player.dist > 10) { const n = Math.floor(player.dist / 10); player.dist -= n * 10; S().stats.steps += n; saveStepT += n; if (saveStepT > 50) { saveStepT = 0; St.mark(); Gm.checkAch(); } }
      for (const d of Wd.drops.slice()) if (d.t > 0.7 && Math.hypot(d.x - player.x, d.y - player.y) < 9) pickDrop(d);
      if (player.mode === 'sit') { player.sitT = (player.sitT || 0) + dt; if (player.sitT > 4) { player.sitT = 0; St.needs({ energy: Gm.has('sleepy') ? 4 : 3 }, true); } }
      if (player.path || player.joy) S().pos = { area: Wd.area.id, x: player.x, y: player.y };
    }
    needT += dt; if (needT > 10) { needT = 0; Gm.tickNeeds(); }
    autoSaveT += dt; if (autoSaveT > 60) { autoSaveT = 0; if (St.dirty) St.persist(); }
    if (hud.name) updateHUD();
    fpsN++; fpsT += dt; if (fpsT > 0.5 && fpsEl) { fpsEl.textContent = `${Math.round(fpsN / fpsT)} fps`; fpsN = 0; fpsT = 0; }
  }
  let world_rendered_once = false;
  function positionMarker() { if (!mk || mk.style.opacity === '0') return; const p = Wd.project(+mk.dataset.x, +mk.dataset.y, Wd.levelAt(+mk.dataset.x, +mk.dataset.y), Wd.groundY(+mk.dataset.x, +mk.dataset.y) - Wd.levelAt(+mk.dataset.x, +mk.dataset.y) * Wd.HY); mk.style.left = p.x + 'px'; mk.style.top = p.y + 'px'; }

  // =============================== native bridge hooks ===============================
  window.OCApp = {
    setInsets(t, r, b, l) { const s = document.documentElement.style; s.setProperty('--sat', t + 'px'); s.setProperty('--sar', r + 'px'); s.setProperty('--sab', b + 'px'); s.setProperty('--sal', l + 'px'); },
    onSystemTheme(dark) { nativeSysDark = !!dark; applyTheme(); },
    lifecycle(state) { if (state === 'pause') { paused = true; Gm.tickNeeds(); St.persist(); } else { paused = false; Gm.tickNeeds(); syncTreeFruit(); last = performance.now(); } },
    back() { if (OC.UI.back()) return true; if (curTab !== 'island') { tab('island'); return true; } return false; },
    onPetState() { if (OC.Pages.pages.pet && OC.Pages.pages.pet.el && OC.Pages.pages.pet.el.classList.contains('open')) OC.Pages.pages.pet.refresh(OC.Pages.pages.pet); },
  };
  document.addEventListener('visibilitychange', () => window.OCApp.lifecycle(document.hidden ? 'pause' : 'resume'));
  window.addEventListener('resize', () => Wd.resize());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.OCApp.back(); });

  // ---- store events → feedback ----
  St.on('questDone', (q) => toast(`任務完成：${q.zh}（到「更多 → 今日任務」領取）`, 'flag'));
  St.on('achUnlocked', (a) => toast(`解鎖成就：${a.zh}`, 'trophy'));
  St.on('friendUp', (e) => toast(`和${Gm.NPCS[e.id].zh}的友情升到「${Gm.LEVEL_ZH[e.level]}」！`, 'heart'));
  St.on('inv', (e) => { if (e.first && e.n > 0) toast(`圖鑑新增：${Sty.ITEMS[e.id].zh}`, 'book'); });
  St.on('saveError', () => toast('存檔空間不足：請刪除一些作品', 'info'));
  ['inv', 'coins', 'needs', 'npc', 'chars', 'animations', 'assets', 'quest', 'ach', 'goal', 'placed', 'growth'].forEach((ev) => St.on(ev, () => { clearTimeout(refreshT); refreshT = setTimeout(() => OC.Pages.refreshOpen(), 120); }));
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
    if (NATIVE) { try { const ins = NATIVE.insets(); if (ins) window.OCApp.setInsets(...ins.split(',').map(Number)); } catch (e) { /* */ } }
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    Wd.init($('#world'), { hooks: { tap: onTap, longPress: onLongPress, ghostMoved: () => syncPlace(), lampOn: (uid) => S().world.lamps[uid] !== false, contextLost: () => { toast('畫面需要重新整理', 'refresh'); setTimeout(() => { if (Wd.renderer.getContext().isContextLost() && !document.hidden && window.__ocFail) window.__ocFail('3D 畫面中斷了', '顯示晶片的繪圖環境遺失且沒有恢復。請試試「用省電模式重新開啟」。', 'webglcontextlost'); }, 5000); }, panned: () => {} } });
    Wd.hourFn = () => OC.Clock.hour(); Wd.weatherFn = () => OC.Clock.weather();
    requestAnimationFrame(loop);
    window.__ocBooted = true;
    $('#boot').classList.add('done'); setTimeout(() => { const b = $('#boot'); if (b && b.classList.contains('done')) b.remove(); }, 500);
    if (!S().onboarded || !OC.Chars.all().length) await OC.Creator.start({ first: true });
    if (S().legacyAnims && S().legacyAnims.length) OC.Chars.migrateLegacyAnims().then((n) => n && toast(`已把 ${n} 段舊作品搬到新的素材庫`, 'film')).catch((e) => console.error('[migrate]', e));
    if (!S().activeId || !OC.Chars.get(S().activeId)) S().activeId = S().roster[0];
    buildHUD(); buildTabbar(); buildBag(); buildDialogue(); buildJoystick();
    Gm.tickNeeds();
    const pos = S().pos || {}; loadArea(OC.Areas[pos.area] ? pos.area : 'isle', pos.area ? pos : null);
    applyPerf(); applyControl(); syncTreeFruit(); tab('island'); updateHUD(); Gm.todayQuests(); Gm.checkAch();
    if (!S().stats.tutorial) { S().stats.tutorial = 1; St.touch(); setTimeout(() => toast('點地面移動・拖曳畫面看看四周・兩指縮放', 'hand'), 900); setTimeout(() => toast('點果樹搖一搖、點居民聊天、右下角是快速背包', 'info'), 4200); }
    window.__ocReady = true;
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
  St.on('growthSuggest', (e) => toast(`${OC.Chars.name(e.c)}好像${e.type === 'trait' ? '有了新的個性' : '發現了新興趣'}：「${e.value}」（到角色檔案決定）`, 'sparkle'));

  OC.App = { tab, setTheme, applyPerf, perfOf, applyMotion, applyControl, live, exportPet, exportSave, travel, startPlacement, reactEat, goToNpc, testOnIsland, refreshActors, greetFrom, bubble, get player() { return player; }, get npcs() { return npcs; }, get mates() { return mates; }, setDecorate, me };
  boot().catch((e) => { console.error(e); if (window.__ocFail) window.__ocFail('遊戲啟動失敗', '啟動時發生錯誤。請試試「用省電模式重新開啟」。', (e && e.stack) || String(e)); });
})();
