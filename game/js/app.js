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
  let player = null, curTab = 'island', decorate = false, placing = null, dlgOpen = null, paused = false;
  const overlays = () => $('#overlays');

  // =============================== theme ===============================
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  let nativeSysDark = null;
  function sysDark() { if (nativeSysDark != null) return nativeSysDark; try { if (NATIVE) return NATIVE.isSystemDark(); } catch (e) { /* */ } return mq ? mq.matches : false; }
  /** 12.0 interface style: 'refined' (default) or 'toy' (the 10.0 look) */
  /* 14.0: one style for the whole app — the old style setting is gone (saves that still carry it are simply ignored) */
  function applyStyle() { const st = S().settings; delete st.style; delete st.styleV; delete document.documentElement.dataset.style; }
  function applyTheme() { const m = S().settings.theme, dark = m === 'dark' || (m === 'system' && sysDark()); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; applyStyle(); }
  function setTheme(mode) { S().settings.theme = mode; St.touch('settings'); applyTheme(); if (NATIVE) try { NATIVE.setThemeMode(mode); } catch (e) { /* */ } }
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);

  // =============================== performance ===============================
  const DPR = Math.min(window.devicePixelRatio || 1, 3);
  function perfOf(mode) {
    const c = S().settings.custom;
    switch (mode) {
      case 'high': return { soft: true, ratio: Math.min(DPR, 2), shadows: 2048, fx: true, grass: 1, fps: 60, bb: 320, bbMax: 768, lights: true, grade: true, dof: true };
      case 'saver': return { ratio: 1, shadows: 0, fx: false, grass: 0, fps: 30, bb: 192, bbMax: 256, lights: false, grade: false, dof: false };
      case 'custom': return { soft: c.shadows === 'high', ratio: Math.min(DPR, c.scale), shadows: c.shadows === 'off' ? 0 : c.shadows === 'high' ? 2048 : 1024, fx: c.fx, grass: c.grass ? 0.8 : 0, fps: c.fps, bb: c.scale >= 1.75 ? 320 : c.scale >= 1.25 ? 256 : 192, bbMax: c.scale >= 1.75 ? 768 : c.scale >= 1.25 ? 512 : 256, lights: c.shadows !== 'off' };
      default: return { ratio: Math.min(DPR, 1.5), shadows: 1024, fx: true, grass: 0.6, fps: 60, bb: 256, bbMax: 512, lights: true, grade: true, dof: false };
    }
  }
  let Q = null;
  /* 14.1: in 'balanced' the game watches its own frame rate and steps the resolution down (and the shadow map with it) when the device
   * cannot keep up, instead of staying slow. It only ever steps down, at most twice, and starts again from the top when the mode is
   * re-applied or the app restarts. Not in automated runs (software rendering is always "slow"; those have their own fixed settings). */
  let adaptLv = 0, adaptBad = 0;
  function adaptStep(fps) {   /* called every half second with the measured rate; returns true when it stepped down */
    if (S().settings.perf !== 'balanced' || adaptLv >= 2 || paused || document.hidden) { adaptBad = 0; return false; }
    if (fps < 42 && fps > 1) adaptBad++; else adaptBad = 0;
    if (adaptBad < 6) return false;   /* three seconds in a row */
    adaptBad = 0; adaptLv++; applyPerf(true); return true;
  }
  function applyPerf(keepAdapt) {
    if (!keepAdapt) { adaptLv = 0; adaptBad = 0; }
    Q = perfOf(S().settings.perf);
    if (adaptLv && S().settings.perf === 'balanced') { Q.ratio = Math.max(1, Q.ratio - 0.25 * adaptLv); Q.shadows = adaptLv >= 2 ? 512 : Q.shadows; Q.grass = adaptLv >= 2 ? 0.35 : Q.grass; Q.bb = adaptLv >= 2 ? 192 : Q.bb; Q.bbMax = adaptLv >= 2 ? 384 : Q.bbMax; } if (Q.grade == null) Q.grade = !!Q.fx; if (Q.dof == null) Q.dof = false;
    Wd.setQuality(Q); fpsEl.hidden = !S().settings.showFps;
    const root = document.documentElement; root.classList.toggle('grade', !!Q.grade); root.classList.toggle('dof', !!Q.dof); root.classList.toggle('lite', !Q.fx);   // saver: no backdrop blur (costly on weak GPUs), opaque glass instead
  }
  /** 10.0 safety net: an interaction hold whose owner is gone (nothing carried, no dialogue, no ring menu) is released after 2 s,
   *  so an OC can never stay frozen because some UI path forgot to let go */
  let wdT = 0; const orphanSince = {}, heldSince = {}; const MAX_AGE = { call: 20000, pet: 6000, play: 8000, feed: 25000, gesture: 45000, group: 120000, game: 150000 };
  function holdWatchdog() {
    const now = performance.now(); if (now - wdT < 1000) return; wdT = now;   // real time: slow frames must not stretch the guarantee
    for (const k of Object.keys(heldSince)) { const [id, r] = k.split(':'); const b = OC.Brain.brains[id]; if (!b || !b.holds.has(r)) delete heldSince[k]; }   // released normally
    for (const b of Object.values(OC.Brain.brains || {})) {
      if (!b || !b.holds || !b.holds.size) continue;
      const own = { drag: () => (carry && carry.id === b.id) || OC.Touch.active || OC.Touch.flying, dialogue: () => !!dlgOpen, menu: () => OC.Radial.open_ && OC.Radial.target === b.id };
      for (const r of [...b.holds]) {
        const k = b.id + ':' + r;
        // short interaction holds released by a timer / walk callback: never longer than this (a lost callback must not freeze an OC)
        if (r === 'pet' && OC.Touch.petting === b.id) { delete heldSince[k]; continue; }   // a stroking session lasts as long as the finger rubs
        if (MAX_AGE[r]) { if (!heldSince[k]) heldSince[k] = now; else if (now - heldSince[k] > MAX_AGE[r]) { delete heldSince[k]; OC.Brain.unhold(b.id, r); } continue; }
        if (!own[r]) continue;
        if (own[r]()) { delete orphanSince[k]; continue; }
        if (!orphanSince[k]) orphanSince[k] = now; else if (now - orphanSince[k] > 2000) { delete orphanSince[k]; OC.Brain.unhold(b.id, r); }
      }
    }
  }
  /** 10.0 sun glow over the world (soft-light): warm by day, golden in the afternoon, cool moonlight at night, faint in bad weather */
  let glowT = 0, glowKey = '';
  function updateGlow(dt) {
    glowT -= dt; if (glowT > 0) return; glowT = 0.5;
    const h = OC.Clock.hour(), wx = OC.Clock.weather(), n = OC.Env.nightness(h), bad = wx === 'rain' ? 0.35 : wx === 'cloudy' || wx === 'fog' ? 0.6 : 1;
    const gold = h >= 15 && h < 19 ? 1 - Math.abs(h - 17.2) / 2.2 : 0;
    const c = n > 0.5 ? '#7C86E8' : gold > 0.15 ? '#FFB46A' : '#FFE6B8', a = (n > 0.5 ? 0.35 : 0.42 + Math.max(0, gold) * 0.25) * bad;
    const k = c + a.toFixed(2); if (k === glowKey) return; glowKey = k;
    const r = document.documentElement.style; r.setProperty('--glow-c', c); r.setProperty('--glow-a', a.toFixed(2));
  }
  function applyMotion() { const r = S().settings.reduceMotion; document.documentElement.classList.toggle('reduce-motion', r); Wd.reduce = r; }

  // =============================== live portraits ===============================
  // a canvas that shows a character with idle life (blink / breath); fn() → { char, pose }
  const lives = [];
  function live(canvas, fn) { lives.push({ canvas, fn, blinkAt: performance.now() + 2000, t0: performance.now() }); }
  let lastLive = 0;
  function drawLives(now) {
    if (now - lastLive < 120) return; lastLive = now;
    for (const L of lives) {
      if (!L.canvas.isConnected || L.canvas.offsetParent === null) continue;
      const o = L.fn(); if (!o || !o.char) continue;
      if (now > L.blinkAt + 130) L.blinkAt = now + 2200 + Math.random() * 2600;
      const pose = Object.assign({ action: 'idle', at: (now - L.t0) / 1000, blink: now > L.blinkAt ? 1 : 0, breath: Math.sin(now / 600) }, o.pose || {});
      OC.CharRender.portrait(L.canvas, o.char, { pose, t: (now - L.t0) / 1000, fill: o.fill });
    }
  }

  // =============================== HUD (10.0 layout) ===============================
  // top-left: avatar + name plate (coins, mood) → status card · under it: weather / time pill → time panel
  // top-right: bell (only with notices) · right rail: quick bag, camera, decorate
  // bottom-right: today's quest card → 日常 · bottom: tab bar
  // The HUD calms down (fades back) while you look around the island and returns when you stop (hudCalm).
  let hud = {}, fpsEl, calmT = 0;
  const stk = (n, c) => OC.UI.sticker(n, c);
  function buildHUD() {
    const el = $('#hud');
    hud.av = h('canvas', { width: 128, height: 128 }); hud.name = h('b.hud-name'); hud.mood = h('span.hud-moodtxt');
    hud.coins = h('span.num'); hud.moodBar = h('i');
    hud.ctl = h('span.hud-ctl', { hidden: true });
    hud.me = h('button.hud-me', { 'aria-label': '角色狀態（長按：操控模式）', 'aria-expanded': 'false', on: { click: () => { if (hud._lp) { hud._lp = false; return; } haptic('tick'); toggleStatus(); } } },
      h('div.hud-av', null, hud.av),
      h('div.hud-plate', null,
        h('div.hud-row', null, hud.name, hud.ctl, h('span.hud-coins', { 'aria-label': '星幣' }, stk('coin', 's'), hud.coins)),
        h('div.hud-row', null, stk('heart', 's'), h('div.hud-bar', null, hud.moodBar), hud.mood)));
    { let lp = 0; hud.me.addEventListener('pointerdown', () => { hud._lp = false; clearTimeout(lp); lp = setTimeout(() => { hud._lp = true; haptic('long'); OC.LifeUI.controlSheet(); }, 520); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) hud.me.addEventListener(ev, () => clearTimeout(lp)); }
    hud.time = h('span.num'); hud.wx = h('span'); hud.wxIc = h('span.hud-wx');
    hud.timeBtn = h('button.hud-time', { 'aria-label': '時間與天氣', on: { click: () => { haptic('tick'); timePanel(); } } }, hud.wxIc, h('div', null, h('b', null, hud.wx), hud.time));
    hud.badge = h('span.badge.num');
    hud.bell = h('button.hud-sq.hud-bell', { 'aria-label': '通知', hidden: true, on: { click: () => { haptic('tick'); OC.LifeUI.notices(); } } }, stk('bell'), hud.badge);
    hud.cam = h('button.rail-btn', { 'aria-label': '鏡頭模式', on: { click: () => { haptic('tick'); rail(false); camSheet(); } } }, stk('camera'), h('small', null, '鏡頭'));
    hud.deco = h('button.rail-btn', { 'aria-label': '佈置模式', on: { click: () => { haptic('tick'); rail(false); setDecorate(!decorate); } } }, stk('sofa'), h('small', null, '佈置'));
    hud.railBtn = h('button.rail-btn.rail-toggle', { 'aria-label': '工具', 'aria-expanded': 'false', on: { click: () => { haptic('tick'); rail(!hud.rail.classList.contains('open')); } } }, stk('more'));
    hud.rail = h('div.hud-rail', null, hud.railBtn, hud.cam, hud.deco);
    hud.questT = h('b.ellipsis'); hud.questS = h('small.ellipsis'); hud.questIc = h('span.hud-qic');
    hud.quest = h('button.hud-quest', { 'aria-label': '今天的任務', hidden: true, on: { click: () => { haptic('tick'); tab('more'); } } }, hud.questIc, h('div.grow', null, hud.questT, hud.questS), icon('chev', 's'));
    // ≤ 6 permanent controls (name plate, weather, 3 tools, quest card); the bell only appears with notices.
    // Settings live in 日常 › 設定 and tapping your OC opens its ring menu — no duplicate buttons on the island.
    el.append(hud.me, hud.timeBtn, h('div.hud-sys', null, hud.bell), hud.rail, hud.quest);
    live(hud.av, () => ({ char: me(), pose: Object.assign({ face: 0.2 }, moodPose()) }));
    fpsEl = h('div.fps'); $('#app').append(fpsEl);
    updateHUD();
  }
  /** 12.0 minimal HUD: one tools handle; it opens bag · camera · decorate and folds itself back after a few seconds */
  let railT = 0;
  function rail(open) {
    if (!hud.rail) return; hud.rail.classList.toggle('open', !!open); hud.railBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); clearTimeout(railT);
    if (open) railT = setTimeout(() => rail(false), 5000);
  }
  /** the HUD also dims after a few quiet seconds (never while a card or menu is open) */
  let idleT = 0;
  function hudAwake() { const el = $('#hud'); if (!el) return; el.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (hud.rail && !statusEl && !OC.UI.stack.length && !hud.rail.classList.contains('open')) el.classList.add('idle'); else hudAwake(); }, 6000); }
  document.addEventListener('pointerdown', () => hudAwake(), true);
  /** while the player pans / zooms the island the HUD steps back (more of the world, less chrome) */
  function hudCalm() { const el = $('#hud'); if (!el) return; el.classList.add('calm'); clearTimeout(calmT); calmT = setTimeout(() => el.classList.remove('calm'), 1100); }
  let lastHudKey = '';
  function questCard() {
    if (!OC.Quests) return null;
    const q = OC.Quests.list('daily').find((x) => !x.claimed); if (!q) return null;
    return { t: q.done ? `完成了！領取獎勵` : q.zh, s: q.done ? q.zh : `${q.d || ''}（${q.prog}/${q.n}）`, ic: q.done ? 'gift' : 'flag', done: q.done };
  }
  function updateHUD() {
    const L = OC.Clock.label(), c = me(), doing = OC.LifeUI.doingText(c), nn = OC.LifeUI.noticeCount(), q = questCard(), mood = Math.round(c.needs.mood || 0);
    const key = [OC.Chars.name(c), c.life.control || 'semi', OC.Mind.label(c), doing, L.time, L.wx, L.phase, S().coins, L.date, nn, mood, q && q.t + q.s].join('|');
    if (key === lastHudKey) return; lastHudKey = key;
    hud.name.textContent = OC.Chars.name(c); hud.mood.textContent = doing || OC.Mind.label(c);
    { const m = c.life.control || 'semi'; hud.ctl.hidden = m === 'semi'; hud.ctl.textContent = OC.LifeUI.ctlZh(m); hud.ctl.dataset.m = m; }
    hud.moodBar.style.width = Math.max(4, Math.min(100, mood)) + '%'; hud.moodBar.classList.toggle('low', mood < 30);
    hud.bell.hidden = !nn; hud.badge.textContent = nn > 9 ? '9+' : nn;
    hud.time.textContent = L.time; hud.wx.textContent = L.phase === 'night' && L.wx === 'clear' ? '晴朗的夜' : L.wxZh;
    const wi = L.phase === 'night' && (L.wx === 'clear' || L.wx === 'cloudy') ? 'moon' : L.wxIcon;
    if (hud.wxIc.dataset.k !== wi) { hud.wxIc.dataset.k = wi; hud.wxIc.replaceChildren(stk(wi, 'm')); }
    hud.coins.textContent = S().coins.toLocaleString();
    hud.quest.hidden = !q; if (q) { hud.questT.textContent = q.t; hud.questS.textContent = q.s; hud.quest.classList.toggle('ready', q.done); if (hud.questIc.dataset.k !== q.ic) { hud.questIc.dataset.k = q.ic; hud.questIc.replaceChildren(stk(q.ic, 'm')); } }
  }
  // =============================== 8.0 time & weather panel ===============================
  const TIME_PRESETS = [['凌晨', 3], ['清晨', 5.5], ['早晨', 7.5], ['上午', 10], ['中午', 12.5], ['下午', 15], ['黃昏', 17.75], ['晚上', 20], ['深夜', 23]];
  const fmtH = (x) => `${String(Math.floor(x) % 24).padStart(2, '0')}:${String(Math.round((x % 1) * 60) % 60).padStart(2, '0')}`;
  function timePanel() {
    sheet('時間與天氣', (b, api) => {
      const st = S().settings, big = h('div.time-big.num'), sub = h('div.muted'), chips = h('div.time-chips');
      const modeSeg = OC.UI.seg([['real', '真實時間'], ['cycle', '遊戲循環'], ['fixed', '固定時刻']], st.time === 'cycle' ? 'cycle' : st.time === 'real' ? 'real' : 'fixed', (v) => {
        if (v === 'fixed') { st.fixedHour = OC.Clock.hour(); st.time = 'fixed'; St.touch('settings'); } else OC.Sim.setMode(v);
        St.emit('time:set', { mode: v }); draw();
      });
      const speed = OC.UI.seg(OC.Sim.SPEEDS.map((v) => [String(v), `×${v}`]), String(st.timeSpeed || 1), (v) => { OC.Sim.setSpeed(+v); draw(); });
      const pause = OC.UI.toggle(!!st.timePaused, (v) => { st.timePaused = v; St.touch('settings'); draw(); });
      const slider = h('input', { type: 'range', min: 0, max: 23.75, step: 0.25, 'aria-label': '時刻', style: { width: '100%' }, on: { input: (e) => { st.time = 'fixed'; st.fixedHour = +e.target.value; St.touch('settings'); St.emit('time:set', { hour: st.fixedHour }); draw(true); } } });
      const wx = OC.UI.seg([['auto', '自動'], ['clear', '晴'], ['cloudy', '多雲'], ['rain', '雨'], ['fog', '霧']], st.weather, (v) => { st.weather = v; St.touch('settings', { k: 'weather', v }); St.emit('time:weather', v); });
      const cycleBox = h('div', null, h('div.hstack', { style: { marginTop: '12px' } }, h('span.grow', null, '倍速'), speed), h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '暫停時間（需求也一起暫停）'), pause));
      function pick(hh) {
        if (st.time === 'cycle') { const gm = OC.Sim.skipTo(hh); toast(gm ? `快轉了 ${Math.round(gm / 60 * 10) / 10} 小時（大家照常生活，不會給額外獎勵）` : '已經是這個時間', 'clock'); }
        else { st.time = 'fixed'; st.fixedHour = hh; St.touch('settings'); }
        haptic('tick'); St.emit('time:set', { hour: hh }); draw();
      }
      function draw(fromSlider) {
        const L = OC.Clock.label(), hh = OC.Clock.hour();
        big.textContent = fmtH(hh); sub.textContent = `${L.date}（${L.week}）・${OC.Clock.PHASE_ZH[OC.Clock.phase(hh)]}・${{ real: '跟隨手機時間', cycle: st.timePaused ? '遊戲循環（暫停中）' : `遊戲循環 ×${st.timeSpeed || 1}・一天約 ${Math.round(24 / (st.timeSpeed || 1))} 分鐘`, fixed: '固定在這個時刻' }[st.time === 'cycle' ? 'cycle' : st.time === 'real' ? 'real' : 'fixed']}`;
        modeSeg.set(st.time === 'cycle' ? 'cycle' : st.time === 'real' ? 'real' : 'fixed'); cycleBox.hidden = st.time !== 'cycle';
        if (!fromSlider) slider.value = String(Math.round(hh * 4) / 4);
        chips.replaceChildren(...TIME_PRESETS.map(([zh, v]) => h('button.chip-btn' + (Math.abs(hh - v) < 0.5 ? '.on' : ''), { on: { click: () => pick(v) } }, zh, h('small', null, ' ' + fmtH(v)))));
      }
      b.append(h('div.center', null, big, sub), h('div', { style: { marginTop: '10px' } }, modeSeg), chips, h('div.muted', { style: { marginTop: '10px', fontSize: 'var(--fs-s)' } }, '拖曳設定時刻（固定時刻模式）'), slider, cycleBox,
        h('div.section-title', null, '天氣'), wx, h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '8px' } }, '天空、光影、燈光、角色作息與事件都會跟著時間改變；遊戲循環快轉時，跳過的時間會照常模擬（像離開 App 一樣，不給獎勵）。'));
      draw(); const iv = setInterval(() => { if (!b.isConnected) { clearInterval(iv); return; } draw(document.activeElement === slider); }, 1000);
      St.emit('time:panel');
    });
  }

  // =============================== 8.0 status card (top-left) ===============================
  let statusEl = null, statusT = 0;
  function toggleStatus(force) {
    const open = force != null ? force : !statusEl;
    if (!open) { if (statusEl) { const el = statusEl; statusEl = null; el.classList.remove('on'); OC.UI.popLayer(el._layer); setTimeout(() => el.remove(), 220); hud.me.setAttribute('aria-expanded', 'false'); } return; }
    if (statusEl) return;
    const el = h('div.status-card', { role: 'dialog', 'aria-label': '角色狀態' });
    el._layer = { scrim: false, close: () => toggleStatus(false) }; OC.UI.pushLayer(el._layer);
    const cv = h('canvas', { width: 128, height: 128 }); cv.className = 'sc-av';
    live(cv, () => ({ char: me(), pose: Object.assign({ face: 0.2 }, moodPose()) }));
    el._f = { name: h('b'), title: h('small.sc-title'), mood: h('div.sc-mood'), doing: h('div.sc-doing'), wish: h('div.sc-wish'), bars: {} };
    const grid = h('div.sc-needs', null, ...OC.LifeData.NEEDS.map((n) => { const i = h('i', { style: { '--c': n.c } }); el._f.bars[n.id] = i; return h('div.sc-need', { title: n.how }, icon(n.ic, 's'), h('span', null, n.zh), h('div.bar', null, i)); }));
    el._f.who = h('div.sc-who');
    el._f.ctlD = h('div.sc-ctld'); el._f.ctl = OC.UI.seg(OC.LifeUI.CTL.map(([v, zh, ic]) => [v, zh, ic]), me().life.control || 'semi', (v) => { OC.Brain.setControl(S().activeId, v); el._f.ctlD.textContent = OC.LifeUI.CTL.find((x) => x[0] === v)[3]; lastHudKey = ''; });
    el._f.ctlD.textContent = (OC.LifeUI.CTL.find((x) => x[0] === (me().life.control || 'semi')) || OC.LifeUI.CTL[1])[3];
    el.append(h('div.sc-head', null, cv, h('div.grow', null, el._f.name, el._f.title, el._f.mood, el._f.doing)), grid, el._f.wish, el._f.who, h('div.sc-ctl', null, el._f.ctl, el._f.ctlD),
      h('div.sc-actions', null,
        h('button.btn.s', { on: { click: () => { toggleStatus(false); OC.LifeUI.think(S().activeId); } } }, icon('sparkle', 's'), '想法'),
        h('button.btn.s', { on: { click: () => { toggleStatus(false); setCamMode('focus', player); } } }, icon('eye', 's'), '特寫'),
        h('button.btn.s.primary', { on: { click: () => { toggleStatus(false); OC.Pages.open('profile', { id: S().activeId }); } } }, icon('person', 's'), '完整檔案')));
    $('#hud').append(el); statusEl = el; hud.me.setAttribute('aria-expanded', 'true');
    el._sig = ''; updateStatus(true); requestAnimationFrame(() => el.classList.add('on'));
    document.addEventListener('pointerdown', function off(e) { if (!statusEl || statusEl !== el) { document.removeEventListener('pointerdown', off, true); return; } if (!el.contains(e.target) && !hud.me.contains(e.target)) { document.removeEventListener('pointerdown', off, true); toggleStatus(false); } }, true);
    St.emit('status:open');
  }
  /** in-place update (text + bar widths only; the roster row is rebuilt only when the roster changes) */
  function updateStatus(force) {
    const el = statusEl; if (!el) return; const now = performance.now(); if (!force && now - statusT < 400) return; statusT = now;
    const c = me(), f = el._f, b = OC.Brain.get(c.id), wish = OC.Mind.activeWishes(c)[0];
    const set = (n, t) => { if (n.textContent !== t) n.textContent = t; };
    set(f.name, OC.Chars.name(c)); set(f.title, (OC.Growth && OC.Growth.titleOf(c)) || OC.Chars.typeTitle(c));
    set(f.mood, `${OC.Mind.label(c)}`); set(f.doing, [OC.LifeUI.doingText(c), (OC.Places.get(c.life.loc || Wd.area.id) || {}).zh].filter(Boolean).join('・') || '自由活動中');
    set(f.wish, wish ? `想要：${wish.text || ''}` : (OC.Requests && OC.Requests.ofOC(c.id) ? `有事想拜託你：${OC.Requests.ofOC(c.id).text}` : '')); f.wish.hidden = !f.wish.textContent;
    for (const [k, i] of Object.entries(f.bars)) { const w = Math.round(Math.max(0, Math.min(100, c.needs[k]))) + '%'; if (i.style.width !== w) i.style.width = w; i.classList.toggle('low', c.needs[k] < 25); }
    const sig = OC.Chars.all().map((x) => x.id + x.updated).join() + S().activeId;
    if (el._sig !== sig) { el._sig = sig; const all = OC.Chars.all(); f.who.hidden = all.length < 2;
      f.who.replaceChildren(h('small.muted', null, '切換操控'), ...all.map((x) => { const cv2 = h('canvas', { width: 72, height: 72 }); OC.CharRender.portrait(cv2, x, { pose: { mouth: 'smile' } }); return h('button.sc-pick' + (x.id === S().activeId ? '.on' : ''), { 'aria-label': '操控' + OC.Chars.name(x), on: { click: () => { if (x.id !== S().activeId) { OC.Chars.setActive(x.id); toast(`現在操控：${OC.Chars.name(x)}`, 'person'); } updateStatus(true); } } }, cv2); })); }
  }

  // =============================== tab bar ===============================
  const TABS = [['island', '小島', 'island'], ['char', '角色', 'person'], ['workshop', '工坊', 'brush'], ['explore', '探索', 'compass'], ['more', '日常', 'flag']];
  let tabEls = {}, ink;
  function buildTabbar() {
    const bar = h('nav.tabbar', { 'aria-label': '主選單' }); ink = h('div.tab-ink'); bar.append(ink);
    TABS.forEach(([id, label, ic], i) => { const b = h('button.tab', { 'aria-label': label, on: { click: () => { haptic('tick'); tab(id); } } }, OC.UI.sticker(ic), h('span', null, label)); b.dataset.i = i; tabEls[id] = b; bar.append(b); });
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
    bagFab = h('button.rail-btn.bag-fab', { 'aria-label': '快速背包', on: { click: () => { haptic('tick'); rail(false); tray.classList.contains('open') ? closeTray() : openTray(); } } }, OC.UI.sticker('bag'), h('small', null, '背包'));
    slots = h('div.slots');
    const grab = h('div.grab', { 'aria-label': '拖曳以移動或收合' });
    tray = h('div.tray', { role: 'region', 'aria-label': '快速背包' }, h('div.tray-head', null, h('b', null, '快速背包'), grab, h('button.btn.ghost.s', { on: { click: () => { closeTray(); OC.Pages.open('bag'); } } }, '全部'), h('button.icon-btn', { 'aria-label': '收起', on: { click: closeTray } }, icon('close', 's'))), slots);
    // drag the header to reposition (up) or collapse (down)
    let y0 = null, base = 0;
    grab.addEventListener('pointerdown', (e) => { grab.setPointerCapture(e.pointerId); y0 = e.clientY; base = trayY; tray.style.transition = 'none'; });
    grab.addEventListener('pointermove', (e) => { if (y0 == null) return; trayY = Math.min(80, Math.max(-(window.innerHeight * 0.45), base + e.clientY - y0)); tray.style.setProperty('--tray-y', trayY + 'px'); });
    const up = () => { if (y0 == null) return; y0 = null; tray.style.transition = ''; if (trayY > 50) { trayY = 0; tray.style.setProperty('--tray-y', '0px'); closeTray(); } };
    grab.addEventListener('pointerup', up); grab.addEventListener('pointercancel', up);
    $('#app').append(tray); hud.rail.prepend(bagFab);
  }
  function openTray() { renderSlots(); tray.classList.add('open'); bagFab.classList.add('on'); }
  function closeTray() { tray.classList.remove('open'); bagFab.classList.remove('on'); }
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
  /** OCs the item can be dropped on, with a reason when not allowed now */
  function dropCands(id) {
    const k = OC.Items.useKind(id), out = [];
    if (k === 'place') return out;
    for (const r of OC.Use.receivers(id)) out.push({ a: r.a, oc: r.c.id, why: r.why });
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
    if (best) return Object.assign({ kind: 'oc' }, best);
    if (it && (it.type === 'self' || it.type === 'mate')) { const oc = it.type === 'self' ? S().activeId : it.id; const c = dropCands(id).find((t) => t.oc === oc); return c ? Object.assign({ kind: 'oc' }, c) : null; }
    return null;
  }
  function dropItem(sx, sy, id) {
    const t = dropTarget(sx, sy, id);
    if (!t) { toast('拖到 OC 身上使用或送禮。放開在空白處＝取消', 'info'); return; }
    if (t.why) { toast(t.why, 'info'); return; }
    if (t.kind === 'oc') { const r = OC.Use.use(id, t.oc); if (r && r.then) r.then(() => renderSlots()); }
    if (t.kind === 'place') { closeTray(); startPlacement({ id }, t.p); }
    renderSlots();
  }
  St.on && St.on('inv', () => { if (tray && tray.classList.contains('open')) renderSlots(); });

  // =============================== actors ===============================
  const me = () => OC.Chars.active();
  const MAX_MATES = 5, SPOTS = [[260, 700], [330, 720], [210, 600], [380, 650], [300, 760]];
  function makePlayer(pos) {
    player = Wd.actor({ player: true, xray: true, x: pos.x, y: pos.y, char: () => testChar || me(), interact: { type: 'self', hit: { w: 44, h: 42, d: 6 }, prio: 3 } });
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
    if (Math.random() < 0.5 && OC.Anim11) { const f = OC.Anim11.fidget(c); if (f) { Wd.setAction(a, f.action, { dur: f.dur, priority: 1 }); if (f.action === 'sneeze') OC.Sound && OC.Sound.play('poke'); return; } }   // 11.0: spontaneous little actions
    const r = Math.random(), emo = OC.LifeData.EMOTIONS[OC.Mind.dominant(c)];
    if (emo.act && OC.Mind.intensity(c, OC.Mind.dominant(c)) > 0.35 && r < 0.45) { if (emo.act === 'jump') Wd.jump(a); else Wd.setAction(a, emo.act, { dur: 1.6, priority: 1 }); if (emo.e) emote(a, emo.e); return; }
    if (r < b.sitChance) Wd.setAction(a, 'sit', { dur: 4 + Math.random() * 4, priority: 1 });
    else if (b.habit === 'hum' && r < 0.7) emote(a, '♪');
    else if (b.habit === 'stretch' && r < 0.6) Wd.setAction(a, 'stretch', { dur: 1.6, priority: 1 });
    else if (b.lookAround) { a.tFace = (Math.random() - 0.5) * 1.6; }
    else if (r > 0.85 && b.emoteScale > 1) Wd.setAction(a, 'happy', { dur: 1, priority: 1 });
  }
  function makeMates() {
    mates = {};
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
    const a = Wd.actor({ mate: c.id, x: p.x, y: p.y, char: () => OC.Chars.get(c.id), interact: { type: 'mate', id: c.id, hit: { w: 44, h: 42, d: 6 }, prio: 2, label: OC.Chars.name(c) } });
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
      f.x = p.x; f.y = p.y; { const hid = !!(f.a && f.a.hidden); if (Math.abs(p.x - (f.px || -9e9)) > 0.4 || Math.abs(p.y - (f.py || -9e9)) > 0.4) { f.px = p.x; f.py = p.y; f.el.style.left = p.x + 'px'; f.el.style.top = p.y + 'px'; } if (hid !== f.hid) { f.hid = hid; f.el.style.visibility = hid ? 'hidden' : ''; } }   /* 14.1: write styles only when the bubble actually moved */
    }
    // speech bubbles never cover each other: push the later one up
    const bs = floats.filter((f) => f.keep).sort((x, y) => x.y - y.y);
    for (let i = 0; i < bs.length; i++) { const f = bs[i]; f.h = f.h || f.el.offsetHeight || 30; f.w = f.w || f.el.offsetWidth || 80; for (let j = 0; j < i; j++) { const g = bs[j]; if (Math.abs(g.x - f.x) < (g.w + f.w) / 2 && Math.abs(g.y - f.y) < (g.h + f.h) / 2 + 4) { g.y = f.y - (g.h + f.h) / 2 - 6; g.py = g.y; g.el.style.top = g.y + 'px'; } } }
  }

  // =============================== interactions ===============================
  function busy() { return dlgOpen || placing; }
  function onTap(r) {
    if (window.__ocInputLog) window.__ocInputLog.push(`onTap dlg=${!!dlgOpen} placing=${!!placing} decorate=${decorate} covered=${curTab}`);
    if (dlgOpen) { advanceDialogue(); return; }
    if (placing) return;
    if (observing) { stopObserve(); }
    const it = r.it;
    // 11.0: a tap on a tree / bush / flower patch shakes it (leaves come down, it rustles) — the OC keeps doing what it was doing
    if ((!it || (OC.Fun && OC.Fun.seeking)) && !decorate && r.s && Wd.shakeAt) { /* 13.0: while you are looking for a hiding character, a tree standing on a garden bed or next to a bench still shakes */ const sh = Wd.shakeAt(r.s.x, r.s.y); if (sh) { Wd.shake(sh); haptic('tick'); OC.Sound && OC.Sound.play('rustle', { pan: Math.max(-0.8, Math.min(0.8, (r.s.x - innerWidth / 2) / (innerWidth / 2) * 0.8)) }); St.emit('world:shake', OC.World.swayInfo ? OC.World.swayInfo(sh) : null); return; } }
    if (!it || !['self', 'mate'].includes(it.type)) { standUp(); OC.Brain.playerAct(S().activeId); }
    if (decorate && it && it.type === 'furn') { startPlacement({ uid: it.uid }); return; }
    if (!it) { const t = Wd.nearestWalkable(r.p.x, r.p.y, 24); if (t && Wd.walkTo(player, t.x, t.y)) marker(t); else toast('那裡走不過去', 'info'); return; }
    haptic();
    switch (it.type) {
      case 'self': case 'mate': menuFor(it, screenOf(it.type === 'self' ? player : mates[it.id])); break;
      case 'drop': goThen(it.drop.x, it.drop.y + 2, () => pickDrop(it.drop)); break;
      case 'tree': goThen(it.at.x, it.at.y, () => shakeTree(it)); break;
      case 'bed': goThen(it.at.x, it.at.y, () => pickFlower(it)); break;
      case 'bench': goThen(it.at.x, it.at.y, () => sit(it.seat)); break;
      case 'home': goThen(it.at.x, it.at.y, () => travel('home')); break;
      case 'shop': if (OC.WorldUI.tap(it)) break; goThen(it.at.x, it.at.y, () => { face(player, 0, 1); OC.Pages.open('shop', { shop: 'general' }); }); break;
      case 'travel': goThen(it.at.x, it.at.y, () => tab('explore')); break;
      case 'travelHome': goThen(it.at.x, it.at.y, () => travel('isle')); break;
      case 'furn': if (decorate) { furnInteract(it); break; } menuFor(it, Wd.project(it.x, it.y, Wd.levelAt(it.x, it.y), 30)); break;
      default: OC.WorldUI.tap(it);
    }
  }
  function onLongPress(r) {
    haptic();
    const it = r.it;
    if (it && (it.type === 'mate' || it.type === 'self') && !placing && !dlgOpen) return startCarry(it.type === 'self' ? S().activeId : it.id);
    if (!it) { menuFor({ type: 'ground', p: r.p }, Wd.project(r.p.x, r.p.y, Wd.levelAt(r.p.x, r.p.y), 0)); return; }
    if (it.type === 'tree') { const left = treeReadyIn(it); toast(left <= 0 ? `${it.label}・果實成熟了，點一下就能搖` : `${it.label}・還要約 ${Math.ceil(left)} 分鐘長出果實`, 'leaf'); return; }
    if (it.type === 'furn') { toast(`${Sty.ITEMS[it.id].zh}・開啟佈置模式即可移動`, 'sofa'); return; }
    toast(it.label || (it.type === 'self' ? `${OC.Chars.name(me())}・${OC.Chars.typeTitle(me())}` : '物品'), 'info');
  }
  let mk = null;
  /** 11.0: a ripple where you tapped (two rings + a dot that stays until the OC has arrived) */
  function marker(p) {
    if (!mk) { mk = h('div.tap-ripple', null, h('i'), h('i'), h('b')); overlays().append(mk); }
    mk.classList.remove('on'); void mk.offsetWidth; mk.classList.add('on'); mk.style.opacity = 1;
    mk.dataset.x = p.x; mk.dataset.y = p.y; mk._t0 = performance.now(); mk._hold = true; OC.Sound && OC.Sound.play('ping');
    positionMarker();   // right now, not on the next frame (a slow frame must never show it in the corner)
  }
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
  // =============================== 8.0 context ring ===============================
  /** screen point above an actor's head */
  function screenOf(a) { if (!a) return { x: innerWidth / 2, y: innerHeight / 2 }; return Wd.project(a.x, a.y, a.lvl || 0, a.gy - (a.lvl || 0) * Wd.HY + 70); }
  function menuFor(it, pt) {
    if (!it || !pt) return;
    const L = OC.LifeUI, Pg = OC.Pages;
    if (it.type === 'self' || it.type === 'mate') {
      const id = it.type === 'self' ? S().activeId : it.id, c = OC.Chars.get(id), a = actorOf(id), self = id === S().activeId; if (!c || !a) return;
      const b = OC.Brain.get(id), asleep = b && b.act === 'sleep' && b.st === 'do', sl = asleep ? '正在睡覺' : null, busy = b && b.holds.has('event') ? '正在特別的事情中' : null;
      // 10.1: the OC pays attention while the ring is open — it stops, turns to you with a little bounce — and is released
      // when the ring closes (whatever way it closes; a watchdog also releases an orphaned 'menu' hold)
      const ring = (title, subTxt, items) => {
        const held = !sl && OC.Brain.hold(id, 'menu'); if (held) { a.path = null; a.tFace = 0; a.tBack = 0; a.squashT = 0; }   // a sleeping OC is not woken by the menu
        OC.Radial.open({ x: pt.x, y: pt.y, title, sub: subTxt, target: id, track: () => (a.dead || a.hidden ? null : screenOf(a)), onClose: () => { if (held) OC.Brain.unhold(id, 'menu'); }, items });
      };
      // 11.0: 親近 opens a second ring (pat · hug · high-five · poke · hold hands); the first ring keeps the everyday actions
      const closeness = () => ring(OC.Chars.name(c), '想怎麼親近？', [
        { ic: 'paw', label: '摸頭', main: true, off: sl, run: () => L.pet(id) },
        { ic: 'heart', label: '抱抱', off: sl || busy, run: () => L.hug(id) },
        { ic: 'hand', label: '擊掌', off: sl || busy, run: () => L.highfive(id) },
        { ic: 'sparkle', label: '戳戳', off: sl || busy, run: () => L.poke(id) },
        { ic: 'users', label: '牽手', off: self ? '自己牽不了自己' : (sl || busy), run: () => L.handhold(id) },
      ]);
      // 13.0: 玩耍 opens a ring of games you play WITH the character
      const playRing = () => ring(OC.Chars.name(c), '想玩什麼？', [
        { ic: 'dice', label: '陪牠玩', main: true, off: sl || busy, run: () => L.play(id) },
        { ic: 'hand', label: '猜拳', off: sl || busy, run: () => OC.Fun.rps(id) },
        { ic: 'eye', label: '躲貓貓', off: self ? '操控中的角色不能自己躲（找別的角色玩）' : (sl || busy), run: () => OC.Fun.hide(id) },
      ]);
      ring(OC.Chars.name(c), `${OC.Mind.label(c)}${OC.LifeUI.doingText(c) ? '・' + OC.LifeUI.doingText(c) : ''}`, [
        { ic: 'heart', label: '親近', main: true, run: () => setTimeout(closeness, 60) },
        { ic: 'chat', label: self ? '打招呼' : '聊天', off: sl || busy, run: () => (self ? greetFrom(a, c) : L.chat(id)) },
        { ic: 'apple', label: '餵食', off: busy, run: () => L.feed(id) },
        { ic: 'gift', label: '送禮', off: busy, run: () => L.gift(id) },
        { ic: 'dice', label: '玩耍', off: sl || busy, run: () => (!OC.Fun ? L.play(id) : setTimeout(playRing, 60)) },
        self ? { ic: 'eye', label: '跟拍', run: () => setCamMode('focus', a) } : { ic: 'hand', label: '叫過來', off: busy, run: () => L.call(id) },
        { ic: 'person', label: '檔案', run: () => Pg.open('profile', { id }) },
        { ic: 'more', label: '更多', run: () => L.interact(id) },
      ]);
      St.emit('menu:open', { kind: 'oc', id });
      return;
    }
    if (it.type === 'furn') {
      const def = Sty.ITEMS[it.id] || { zh: '家具' };
      OC.Radial.open({ x: pt.x, y: pt.y, title: def.zh, sub: '家具', items: [
        { ic: 'hand', label: '使用', main: true, run: () => { if (!OC.WorldUI.tap(it)) furnInteract(it); } },
        { ic: 'move', label: '移動', off: (OC.Places.get(Wd.area.id) || {}).decor === false ? '這裡不能佈置' : null, run: () => startPlacement({ uid: it.uid }) },
        { ic: 'bag', label: '收回', off: (OC.Places.get(Wd.area.id) || {}).decor === false ? '這裡不能佈置' : null, run: () => { startPlacement({ uid: it.uid }); storeFurniture(); } },
        { ic: 'info', label: '資訊', run: () => OC.Pages.itemSheet ? OC.Pages.itemSheet(it.id) : toast(def.zh, 'info') },
      ] });
      St.emit('menu:open', { kind: 'furn' });
      return;
    }
    if (it.type === 'ground') {
      const q = it.p, ok = Wd.walkable(q.x, q.y), others = Object.keys(mates);
      OC.Radial.open({ x: pt.x, y: pt.y + 40, title: ok ? '這裡' : '走不過去的地方', items: [
        { ic: 'walk', label: '走過去', main: true, off: ok ? null : '走不過去', run: () => { const t = Wd.nearestWalkable(q.x, q.y, 24); if (t && Wd.walkTo(player, t.x, t.y)) marker(t); } },
        { ic: 'hand', label: '大家過來', off: others.length ? null : '這裡沒有其他 OC', run: () => others.forEach((id, i) => setTimeout(() => OC.LifeUI.call(id), i * 250)) },
        { ic: 'sofa', label: '放家具', off: (OC.Places.get(Wd.area.id) || {}).decor === false ? '這裡不能佈置' : null, run: () => setDecorate(true) },
        { ic: 'eye', label: '看這裡', run: () => { setCamMode('free'); Wd.shot({ x: q.x, y: q.y, speed: 3 }); setTimeout(() => Wd.shot(null), 900); } },
      ] });
      St.emit('menu:open', { kind: 'ground' });
    }
  }
  // =============================== 8.0 camera modes ===============================
  const CAM_ZH = { classic: ['經典 2.5D', 'island'], follow: ['跟隨角色', 'walk'], focus: ['角色特寫', 'eye'], free: ['自由鏡頭', 'compass'] };
  function setCamMode(m, subj) {
    if (!CAM_ZH[m]) return; S().view.mode = m; St.touch('view');
    Wd.setMode(m, { subject: subj || (m === 'classic' ? null : player) });
    if (hud.cam) { hud.cam.querySelector('small').textContent = { classic: '鏡頭', follow: '跟隨', focus: '特寫', free: '自由' }[m]; hud.cam.classList.toggle('on', m !== 'classic'); }
    St.emit('cam:mode', m);
  }
  function camSheet() {
    sheet('鏡頭', (b, api) => {
      b.append(h('div.list', null, ...Object.entries(CAM_ZH).map(([k, [zh, ic]]) => OC.UI.row(ic, zh, { classic: '固定斜俯視角，跟著操控中的 OC（佈置與探索最方便）', follow: '平滑跟著選定的 OC，可以兩指旋轉視角', focus: '拉近到選定的 OC，看表情與換裝', free: '不自動跟隨：單指拖曳移動、兩指縮放與旋轉' }[k], S().view.mode === k ? icon('check') : null, () => { api.close(); setCamMode(k); }))),
        h('div.hstack', { style: { gap: '8px', marginTop: '12px' } }, h('button.btn.grow', { on: { click: () => { Wd.rotateTo(0); S().view.yaw = 0; } } }, icon('rotate', 's'), '轉回正面'), h('button.btn.grow', { on: { click: () => { Wd.recenter(); } } }, icon('person', 's'), '回到角色')),
        h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '8px' } }, '特殊事件會暫時用電影鏡頭，結束後回到你原本的鏡頭。'));
    });
  }
  function reactEat() { if (!player) return; const b = OC.Chars.behavior(me()); Wd.setAction(player, 'eat', { dur: b.chew, priority: 4 }); emote(player, '♥'); }
  function moodPose() { const m = Gm.moodFace(); return { eyes: m.eyes === 'round' ? undefined : m.eyes, mouth: m.mouth === 'cat' ? undefined : m.mouth, blush: m.blush ? 0.8 : 0 }; }
  // speech bubble above an actor
  /** speech bubble above an actor (one per actor; name tag; never overlaps another bubble) → seconds shown */
  function bubble(a, text, name, dur, o = {}) {
    const d = dur || Math.max(1.8, Math.min(5.2, 1.3 + text.length * 0.11)) * (o.thought ? 0.9 : 1);
    if (curTab !== 'island') return d;
    // 11.0: every spoken line has a voice (thoughts are silent): a babble shaped by who it is and how they feel
    if (!o.thought && text && OC.Sound && OC.Sound.speak) { try { const c = a.char && a.char(), at = OC.Sound.placement(a); if (c && at) OC.Sound.speak(c, text, { emo: o.emo || (OC.Mind && c.life ? OC.Mind.dominant(c) : 'neutral'), pan: at.pan, vol: at.vol }); } catch (e) { /* silent */ } }
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
  /** put an OC down. info.fling: 0 = set down, 1 = tossed (bounced), 2 = thrown hard — reactions follow personality */
  function dragEnd(p, info = {}) {
    if (!carry) return; const { id, a, c, wasSleeping } = carry; carry = null; a.lift = 0; a.swing = 0; const fl = info.fling || 0;
    const b = OC.Chars.behavior(c); let cat = 'call';
    const brave = c.personality.energy > 60 || OC.Chars.has(c, 'energetic') || OC.Chars.has(c, 'brave');
    if (fl >= 2) { Wd.setAction(a, brave ? 'cheer' : 'hurt', { dur: 1.6, priority: 8 }); emote(a, brave ? '★' : '@'); }
    else if (fl === 1) { Wd.setAction(a, brave ? 'happy' : 'surprised', { dur: 1.1, priority: 8 }); }
    else { Wd.setAction(a, 'idle'); Wd.jump(a); }
    if (wasSleeping) { OC.Mind.feel(c, 'annoyed', 0.45, '睡覺被吵醒'); cat = 'prank_bad'; }
    else if (fl >= 2) { if (brave) { OC.Mind.feel(c, 'excited', 0.5, '被你丟得高高的'); cat = 'prank_ok'; } else { OC.Mind.feel(c, 'nervous', 0.5, '被丟出去了'); cat = 'prank_bad'; } }
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


  // ---- dialogue box ----
  let dlg;
  function buildDialogue() { dlg = { el: h('div.dlg', { role: 'dialog', 'aria-live': 'polite', on: { click: (e) => { if (!e.target.closest('button')) advanceDialogue(); } } }), who: h('div.who'), line: h('div.line'), choices: h('div.choices'), next: h('div.next', null, icon('next', 's')) }; dlg.el.append(dlg.who, dlg.line, dlg.choices, dlg.next); $('#app').append(dlg.el); }
  function showDialogue(who, lines, choices, done, custom) {
    closeTray();
    if (dlgOpen) endDialogue();   // 10.0 fix: a dialogue replaced by another one never ran its done() — the OC stayed held ('dialogue') forever
    dlgOpen = { lines: lines.slice(), choices, done, i: 0, custom: !!custom, layer: { scrim: false, close: () => endDialogue() } }; document.body.classList.add('talking');
    OC.UI.pushLayer(dlgOpen.layer);
    dlg.who.textContent = who;
    // 13.0: the name tab takes the speaker's own colour and the text is typed with that character's voice
    const sp = OC.Chars.all().find((c) => OC.Chars.name(c) === who) || null; dlgOpen.speaker = sp;
    { const TAB = ['#F2542D', '#19A7CE', '#8F6FE8', '#1FB57A', '#F0527E', '#E08A00', '#3D9BE9']; let hsh = 0; for (const ch of (sp ? sp.id : who)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; dlg.el.style.setProperty('--who', TAB[hsh % TAB.length]); }   // a strong colour per character (always readable with white text)
    dlg.el.classList.add('open'); renderLine();
  }
  function renderLine() {
    const d = dlgOpen, last = d.i >= d.lines.length - 1;
    typeLine(d.lines[d.i]);
    dlg.choices.replaceChildren(); dlg.next.hidden = last && d.choices.length > 0;
    if (last && d.choices.length) dlg.choices.append(...d.choices.map((c) => h('button.btn.block', { on: { click: () => { haptic(); if (d.custom) { d.choices = []; const more = c.fx(); if (more && more.length) { d.lines.push(...more); d.i++; renderLine(); } else endDialogue(); return; } c.fx(); const reply = ['（看起來很開心）', '嘿嘿，謝謝你～', '好呀！'][Math.floor(Math.random() * 3)]; dlgOpen.choices = []; dlgOpen.lines.push(reply); dlgOpen.i++; renderLine(); } } }, c.label)));
  }
  let typeT = 0;
  function typeLine(s) {
    clearInterval(typeT); let k = 0; dlg.line.textContent = ''; dlg.full = s; const chars = [...String(s)];
    const sp = dlgOpen && dlgOpen.speaker;
    if (sp && OC.Sound && OC.Sound.speak && !(dlgOpen && dlgOpen.voiced === s)) { try { OC.Sound.speak(sp, s, { emo: OC.Mind && sp.life ? OC.Mind.dominant(sp) : 'neutral', pan: 0, vol: 0.9 }); } catch (e) { /* sound is optional */ } if (dlgOpen) dlgOpen.voiced = s; }
    if (S().settings.reduceMotion) { dlg.line.textContent = s; return; }
    typeT = setInterval(() => { const ch = chars[k++]; if (ch == null) { clearInterval(typeT); dlg.line.textContent = s; return; } const el = document.createElement('span'); el.className = 'ch'; el.textContent = ch; dlg.line.append(el); if (k >= chars.length) { clearInterval(typeT); setTimeout(() => { if (dlg.full === s) dlg.line.textContent = s; }, 200); } }, /[，。！？、…]/.test(chars[k - 1] || '') ? 90 : 30);
  }
  function advanceDialogue() {
    const d = dlgOpen; if (!d) return;
    if (dlg.line.textContent !== dlg.full) { clearInterval(typeT); dlg.line.textContent = dlg.full; return; }
    if (d.i < d.lines.length - 1) { d.i++; renderLine(); return; }
    if (d.choices.length) return;   // must pick a choice
    endDialogue();
  }
  function endDialogue() { const d = dlgOpen; if (!d) return; dlgOpen = null; document.body.classList.remove('talking'); OC.UI.popLayer(d.layer); dlg.el.classList.remove('open'); clearInterval(typeT); d.done && d.done(); }

  // =============================== decorate / placement ===============================
  let decoEl = null;
  function setDecorate(v) { decorate = v; hud.deco.classList.toggle('on', !!v); hud.deco.setAttribute('aria-pressed', v); decoBanner(v); if (!v && placing) cancelPlacement(); }
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
    $('#app').append(placeBar); bagFab.classList.add('hide'); $('#hud').classList.add('placing'); Wd.ghostSnap(6); syncPlace();
    toast('拖曳家具移動；可以旋轉、縮放、復原', 'move');
  }
  /** nearest valid spot (spiral search on the 6-unit placement grid) */
  function findSpot(f, x0, y0) {
    for (let r = 0; r <= 120; r += 6) for (let a = 0; a < Math.PI * 2; a += r ? 6 / r : 7) { const g = Object.assign({}, f, { x: Math.round((x0 + Math.cos(a) * r) / 6) * 6, y: Math.round((y0 + Math.sin(a) * r) / 6) * 6 }); snapWall(g); if (Wd.canPlace(g)) return { x: g.x, y: g.y }; }
    return { x: x0, y: y0 };
  }
  function syncPlace() { if (!placeBar) return; const ok = Wd.ghost && Wd.ghost.ok; const b = placeBar.querySelector('[data-ok]'); b.disabled = !ok; b.classList.toggle('locked', !ok); }
  function endPlacementUI() { if (placeBar) { placeBar.remove(); placeBar = null; } Wd.setGhost(null); if (placing && placing.layer) OC.UI.popLayer(placing.layer); placing = null; $('#hud').classList.remove('placing'); if (curTab === 'island') bagFab.classList.remove('hide'); }
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
    makePlayer(pos && Wd.walkable(pos.x, pos.y) ? pos : def.spawn); makeMates(); spawnDailies();
    S().pos = { area: id, x: player.x, y: player.y };
    OC.WorldUI.arrived(id, o.from); syncTreeFruit(); applyPerf(); Gm.checkAch();
    if (followNext) {   // 13.0: we came here because the character we follow led the way (or the OC we were watching left)
      const f = followNext; followNext = null;
      if (f.lead) { const b = OC.Brain.get(f.lead); if (b && player && player.cid === f.lead) { b.ledAt = OC.Sim.now(); if (f.act && OC.LifeData.ACTS[f.act]) { b.queued = f.act; b.thinkAt = 0; } } }
      if (f.observe) { const c = OC.Chars.get(f.observe); if (c && c.life.trip && mates[f.observe]) OC.Brain.arrived(f.observe); setTimeout(() => { if (actorOf(f.observe)) observe(f.observe); }, 700); }
    }
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
  function applyControl() { if (joy) joy.hidden = curTab !== 'island' || S().settings.control !== 'joy'; document.documentElement.classList.toggle('joy-on', S().settings.control === 'joy'); }

  // =============================== main loop ===============================
  let hudT = 0;
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
    if (!covered || !world_rendered_once) { OC.Ambient.update(dt); Wd.frame(now, dt); world_rendered_once = true; updateOverlays(dt); positionMarker(); } else Wd.tickActors(dt);
    // life simulation: fixed steps fed with REAL elapsed time (independent of the fps cap)
    OC.Sim.update((now - lastSim) / 1000); lastSim = now;
    OC.Events.update(dt); updateObserve(); OC.WorldUI.tick(dt, now / 1000);
    if (now - presT > 1000) { presT = now; syncPresence(); }
    OC.Stage.tick(dt); OC.Sound.tick(dt); OC.PetSync.tick(dt); if (curTab === 'island') OC.Requests.frame();
    if (now - reqT > 2000) { reqT = now; OC.Requests.tick(); OC.Quests.refresh(); }
    if (now - aspT > 20000) { aspT = now; OC.Growth.tick(); }
    const wx = OC.Clock.weather(); if (wx !== lastWx) { if (lastWx) St.emit('life:weather', { wx, from: lastWx }); lastWx = wx; }
    const night = OC.Clock.phase(OC.Clock.hour()) === 'night'; if (Wd.area && (night !== lastNight || wx !== lastAmbWx)) { lastNight = night; lastAmbWx = wx; OC.Sound.ambient({ area: Wd.area.id, wx, night }); }
    if (Wd.area && player) {
      const ph = OC.Clock.phase(OC.Clock.hour()), mini = !!(OC.Mini && OC.Mini.active), mk = `${Wd.area.id}|${wx}|${ph}|${mini ? 1 : 0}`;
      if (mk !== lastMusicKey) { lastMusicKey = mk; OC.Sound.music(OC.Sound.musicFor({ area: Wd.area.id, wx, phase: ph, mini })); }
      // 11.0: the music follows the mood — lively when the OC is happy / excited or something is going on, calm otherwise
      if (!intT || performance.now() - intT > 1500) { intT = performance.now(); const c = OC.Chars.active(), dom = c && c.life && OC.Mind ? OC.Mind.dominant(c) : 'neutral'; OC.Sound.setIntensity(mini ? 1 : OC.Stage && OC.Stage.busy ? 2 : dom === 'excited' ? 2 : dom === 'happy' || dom === 'proud' ? 1 : 0); }
    }
    if (now - holdT > 400) { holdT = now; syncEditorHolds(); }   // real time (dt is capped per frame)
    drawLives(now);
    if (player) {
      // footsteps → stats, auto-pick drops the player walks over
      if (player.dist > 10) { const n = Math.floor(player.dist / 10); player.dist -= n * 10; S().stats.steps += n; saveStepT += n; if (saveStepT > 50) { saveStepT = 0; St.mark(); Gm.checkAch(); } }
      for (const d of Wd.drops.slice()) if (d.t > 0.7 && Math.hypot(d.x - player.x, d.y - player.y) < 9) pickDrop(d);
      if (player.path || player.joy) S().pos = { area: Wd.area.id, x: player.x, y: player.y };
    }
    autoSaveT += dt; if (autoSaveT > 30) { autoSaveT = 0; saveMatePos(); if (St.dirty) St.persist(); }
    if (hud.name && now - hudT > 200) { hudT = now; updateHUD(); }   /* 14.1: the HUD text changes a few times a minute — building its key 60 times a second was wasted work */
    updateGlow(dt);
    holdWatchdog();
    OC.LifeUI.tick(dt);
    if (OC.Mind11) OC.Mind11.update(dt);
    if (OC.Arcs) OC.Arcs.update(dt);
    if (statusEl) updateStatus();
    fpsN++; fpsT += dt; if (fpsT > 0.5 && fpsEl) { const fps = fpsN / fpsT; fpsEl.textContent = `${Math.round(fps)} fps`; fpsN = 0; fpsT = 0; if (!navigator.webdriver && curTab === 'island' && !OC.UI.stack.length) adaptStep(fps); }
  }
  let intT = 0, lastMusicKey = '', world_rendered_once = false, reqT = 0, aspT = 0, lastNight = null, lastAmbWx = null;
  function saveMatePos() { if (!Wd.area) return; for (const [id, a] of Object.entries(mates)) { const c = OC.Chars.get(id); if (c) c.life.pos = { area: Wd.area.id, x: Math.round(a.x), y: Math.round(a.y) }; } }
  /** OCs open in the editor / workshop are "dressing": they pause their life until the page closes */
  function syncEditorHolds() {
    const now = new Set(); for (const k of ['charedit', 'workshop']) { const pg = OC.Pages.pages[k]; if (pg && pg.el && pg.el.classList.contains('open') && pg.params && pg.params.id) now.add(pg.params.id); }
    for (const id of now) if (!editing.has(id)) OC.Brain.hold(id, 'editor');
    for (const id of editing) if (!now.has(id)) OC.Brain.unhold(id, 'editor');
    editing = now;
  }
  function positionMarker() {
    if (!mk || mk.style.opacity === '0') return;
    // the dot stays while the OC is on its way; once it has arrived (or after 12 s) it fades
    if (mk._hold && performance.now() - mk._t0 > 700 && (!player || !player.path || performance.now() - mk._t0 > 12000)) { mk._hold = false; mk.classList.remove('on'); mk.style.opacity = 0; return; }
    const x = +mk.dataset.x, y = +mk.dataset.y, l = Wd.levelAt(x, y), p = Wd.project(x, y, l, Wd.groundY(x, y) - l * Wd.HY); mk.style.left = p.x + 'px'; mk.style.top = p.y + 'px';
  }

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
  // 13.0 "got it!": the first time an item is found, the character you play holds it up for a moment (only a pose: the item is already yours)
  St.on('inv', (e) => { if (!(e && e.first && e.n > 0 && OC.Style.ITEMS[e.id]) || !player || curTab !== 'island' || dlgOpen || (OC.Stage && OC.Stage.busy) || OC.Sim.catching) return; const a = player; if (a.act && a.act.priority > 4) return; a.overrides = Object.assign({}, a.overrides || {}, { held: e.id }); a.key = ''; if (Wd.setAction(a, 'cheer', { dur: 1.7, priority: 4 })) floatText(a, '✦', 'var(--sun)'); setTimeout(() => { if (a.overrides && a.overrides.held === e.id) { delete a.overrides.held; if (!Object.keys(a.overrides).length) a.overrides = null; a.key = ''; } }, 1800); });
  St.on('inv', (e) => { if (e && e.first && e.n > 0 && OC.Style.ITEMS[e.id]) { const it = OC.Style.ITEMS[e.id]; OC.Stage.card({ kind: 'discover', item: e.id, title: `圖鑑新增：${it.zh}`, sub: `${(OC.Items.KINDS[it.kind] || {}).zh || ''}・${OC.Items.RARITY[it.rarity || 1]}・+${OC.Shops.INCOME.find} 星幣` }); } });
  St.on('play:skillUp', (e) => OC.Stage.perform('levelup', Object.assign({}, e)));
  St.on('play:aspDone', (e) => OC.Stage.perform('aspDone', e));
  St.on('play:aspStep', (e) => OC.Stage.perform('aspStep', Object.assign({ zh: e.zh }, e)));
  St.on('play:aspNew', (e) => { const x = OC.PlayData.ASPIRATIONS[e.id]; if (e.by === 'auto' && x) OC.Stage.perform('aspNew', { oc: e.oc, zh: x.zh, vars: { asp: x.zh } }); });
  St.on('play:title', (e) => OC.Stage.card({ kind: 'title', ic: 'star', title: `新稱號：「${e.zh}」`, sub: '可以在角色檔案的「成長」讓 OC 戴上' }));
  St.on('play:found', (e) => { const it = OC.Style.ITEMS[e.item]; const c = OC.Chars.get(e.oc); if (it && c) OC.Stage.card({ kind: 'discover', item: e.item, title: e.gift ? `${OC.Chars.name(c)}送你${it.zh}` : `${OC.Chars.name(c)}找到了${it.zh}`, sub: '技能帶來的驚喜' }); });
  St.on('reward', (r) => { if (r.why !== '成就' && r.why !== '新發現') setTimeout(() => toast(`${r.why} +${r.coins} 星幣`, 'coin'), 900); });
  // (9.0) the discovery card above is the only feedback — the extra toast made two notices per item
  St.on('saveError', () => toast('存檔空間不足：請刪除一些作品', 'info'));
  ['inv', 'coins', 'needs', 'chars', 'animations', 'assets', 'quest', 'ach', 'goal', 'placed', 'growth', 'life'].forEach((ev) => St.on(ev, () => { clearTimeout(refreshT); refreshT = setTimeout(() => OC.Pages.refreshOpen(), 120); }));
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
    OC.Brain.init(lifeHooks); OC.Events.init(lifeHooks); if (OC.Arcs) OC.Arcs.init(); if (OC.Fun) OC.Fun.init();
    OC.Sim.onStep((g) => OC.Places.growAll(g)); OC.Sim.onAbstract((g) => OC.Places.growAll(g));
    OC.Sim.catchUp('boot');
    if (NATIVE) { try { const ins = NATIVE.insets(); if (ins) window.OCApp.setInsets(...ins.split(',').map(Number)); } catch (e) { /* */ } }
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    Wd.init($('#world'), { hooks: { tap: onTap, longPress: onLongPress, dragMove, dragEnd, claimDown: (r, p) => !decorate && OC.Touch.down(r, p), claimMove: (d, p) => OC.Touch.move(d, p), claimUp: (d, p) => OC.Touch.up(d, p), claimCancel: () => OC.Touch.cancel(), panned: () => { St.emit('cam:pan'); hudCalm(); }, rotated: (y) => { S().view.yaw = y; St.emit('cam:rotate', y); }, ghostMoved: () => syncPlace(), ghostDone: () => placing && placing.commit && placing.commit(), lampOn: (uid) => S().world.lamps[uid] !== false, contextLost: () => { toast('畫面需要重新整理', 'refresh'); setTimeout(() => { if (Wd.renderer.getContext().isContextLost() && !document.hidden && window.__ocFail) window.__ocFail('3D 畫面中斷了', '顯示晶片的繪圖環境遺失且沒有恢復。請試試「用省電模式重新開啟」。', 'webglcontextlost'); }, 5000); } } });
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
    if (e.k === 'talks' && st.talks >= 20) OC.Chars.suggest(c, 'trait', 'social', '常常和 OC 聊天');
    if (e.k === 'shakes' && st.shakes >= 10) OC.Chars.suggest(c, 'hobby', '照顧果樹', '搖了很多次果樹');
  });
  St.on('growthSuggest', (e) => { lastHudKey = ''; toast(`${OC.Chars.name(e.c)}好像${e.type === 'trait' ? '有了新的個性' : e.type === 'habit' ? '有了新習慣' : '發現了新興趣'}：「${(e.s && e.s.zh) || e.value}」（點右上角的鈴鐺決定）`, 'sparkle'); });

  // ---- hooks used by the life engines (js/life/brain.js, events.js) ----
  const onScreen = (a) => { if (!a || curTab !== 'island') return false; const p = Wd.project(a.x, a.y, a.lvl); return p.x > -40 && p.x < innerWidth + 40 && p.y > -40 && p.y < innerHeight + 40; };
  let followNext = null;
  const canLead = () => curTab === 'island' && !placing && !decorate && !dlgOpen && !paused && !document.hidden && !(OC.UI.stack && OC.UI.stack.length) && !(OC.Radial && OC.Radial.open_) && !(OC.Touch && (OC.Touch.active || OC.Touch.flying || OC.Touch.petting)) && !(OC.Stage && OC.Stage.busy) && !(OC.Events && OC.Events.current) && !(OC.Mini && OC.Mini.active) && !(OC.Tutorial && OC.Tutorial.active) && !(OC.Arcs && OC.Arcs.running) && !(OC.Fun && (OC.Fun.busy || OC.Fun.visiting));
  const lifeHooks = {
    say: (a, text, name, dur, o) => bubble(a, text, name, dur, o),
    depart: (id) => {
      const a = mates[id], follow = observing === id && canLead(); OC.Brain.detach(id); if (a) { Wd.removeActor(a); delete mates[id]; }
      // 13.0: you were following (觀察) this OC and it left for another place → go along and keep following it there
      if (follow) { const c = OC.Chars.get(id), to = c && c.life.loc; if (to && to !== Wd.area.id && OC.Places.open(to)) { if (c.life.trip) c.life.trip.eta = OC.Sim.now(); followNext = { observe: id }; OC.UI.toast(`跟著${OC.Chars.name(c)}去${OC.Places.get(to).zh}`, 'info'); OC.WorldUI.travel(to); } }
    },
    /** 13.0: may the character you follow change the place by itself right now? (only while you are simply watching the world) */
    canLead: () => canLead(),
    /** the character you follow left for another place: the view goes there, then it starts what it wanted to do */
    lead: (id, to, act) => { if (!canLead() || !player || player.cid !== id || !OC.Places.open(to)) return false; const c = OC.Chars.get(id); followNext = { lead: id, act }; OC.UI.toast(`${OC.Chars.name(c)}想去${OC.Places.get(to).zh}${OC.LifeData.ACTS[act] ? '・' + OC.LifeData.ACTS[act].zh : ''}`, 'info'); OC.WorldUI.travel(to); return true; },
    emote: (a, e) => { if (onScreen(a)) emote(a, e); },
    hide: () => {},
    notice: (n) => OC.LifeUI.pushNotice(n),
    cam: (a, on) => { if (on && a) Wd.focus(a, 2.5); else if (!observing) Wd.focus(null); document.documentElement.classList.toggle('cinema', !!on); },
    // 10.1 fix: closing the question without answering (Back, or another dialogue replacing it) used to leave the event — and both
    // characters — waiting until its 90 s timeout; it now continues with the first answer
    choice: (prompt, opts, cb) => { let done = false; const pick = (i) => { if (done) return; done = true; cb(i); };
      showDialogue('', [prompt], opts.map((label, i) => ({ label, fx: () => { pick(i); return null; } })), () => pick(0), true); },
    sound: (id) => { OC.Mind.note(null, 'sound', `音效「${id}」（遊戲尚無音訊系統，只記錄）`); },
    busy: () => !!(dlgOpen || placing || testChar || carry || curTab !== 'island' || OC.UI.stack.length),
  };
  St.on('life:offline', (o) => { if (o.simulated >= 30) setTimeout(() => toast(`離開了約 ${o.min >= 120 ? Math.round(o.min / 60) + ' 小時' : o.min + ' 分鐘'}，大家照自己的步調生活${o.capped ? '（最多計算 8 小時）' : ''}`, 'clock'), 1200); });
  St.on('life:skillUp', (e) => { const c = OC.Chars.get(e.id); if (c) toast(`${OC.Chars.name(c)}的${OC.Mind.SKILLS[e.skill]}升到 Lv.${e.lv}`, 'star'); });
  St.on('life:relType', (e) => { const a = OC.Chars.get(e.a), b = OC.Chars.get(e.b); if (a && b && OC.Mind.RANK[e.to] >= 2 && OC.Mind.RANK[e.to] > (OC.Mind.RANK[e.from] || 0)) toast(`${OC.Chars.name(a)}把${OC.Chars.name(b)}當成${OC.Mind.TYPES[e.to]}了`, 'heart'); });

  OC.App = { adaptStep, get adaptLevel() { return adaptLv; }, canLead: () => canLead(), rail, menuFor, screenOf, setCamMode, camSheet, timePanel, toggleStatus, get placing() { return !!placing; }, loadArea, goThen, floatText, syncPresence, presentHere, observe, stopObserve, actorOf, showDialogue, startCarry, dragMove, dragEnd, onScreen, tab, setTheme, applyPerf, perfOf, applyMotion, applyControl, live, exportPet, exportSave, travel, startPlacement, reactEat, testOnIsland, refreshActors, greetFrom, bubble, get player() { return player; }, get mates() { return mates; }, get curTab() { return curTab; }, get dlgOpen() { return dlgOpen; }, setDecorate, me };
  boot().catch((e) => { console.error(e); if (window.__ocFail) window.__ocFail('遊戲啟動失敗', '啟動時發生錯誤。請試試「用省電模式重新開啟」。', (e && e.stack) || String(e)); });
})();
