/* OC Shimeji — 8.0 first impression: logo → opening (a real camera flight over the island) → welcome → debut.
 *
 *   OC.Intro.logo()          original animated mark (≈1.6 s, tap to skip)
 *   OC.Intro.opening(o)      letterboxed flyover of the 3D island with dawn → morning light, subtitles, ambience;
 *                            uses the real world renderer (OC.World.shot), skippable; ends on the title card
 *   OC.Intro.welcome(o)      title card: 開始新遊戲 / 繼續遊戲 / 觀看開場
 *   OC.Intro.debut(actor)    the new OC arrives in the world (drop-in, landing, greeting, name card), camera returns to the player
 * Progress lives in S.intro (seen, tutorial). Automated tests set localStorage 'oc.skipIntro' to go straight to the creator.
 */
(function () {
  'use strict';
  const { h, icon } = OC.UI;
  const W = () => OC.World, S = () => OC.Store.s, snd = (n) => OC.Sound && OC.Sound.play(n);
  const reduce = () => !!(S() && S().settings.reduceMotion);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const skipAll = () => { try { return localStorage.getItem('oc.skipIntro') === '1'; } catch (e) { return false; } };

  const MARK = `<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="ocm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF8EE"/><stop offset="1" stop-color="#FFE3D2"/></linearGradient></defs>
    <path d="M24 54 L22 18 L46 36 Q60 31 74 36 L98 18 L96 54 Q104 66 102 80 Q98 106 60 106 Q22 106 18 80 Q16 66 24 54 Z" fill="url(#ocm)" stroke="#3B2B25" stroke-width="4" stroke-linejoin="round"/>
    <path d="M30 30 L32 46 L41 39 Z M90 30 L88 46 L79 39 Z" fill="#FFB8B0"/>
    <circle class="eye" cx="46" cy="68" r="5" fill="#3B2B25"/><circle class="eye" cx="74" cy="68" r="5" fill="#3B2B25"/>
    <path d="M54 80 Q57 84 60 80 Q63 84 66 80" fill="none" stroke="#3B2B25" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="38" cy="80" rx="6" ry="3.5" fill="#FF9E9E" opacity=".7"/><ellipse cx="82" cy="80" rx="6" ry="3.5" fill="#FF9E9E" opacity=".7"/>
    <path class="leaf" d="M60 14 Q72 2 84 8 Q74 20 60 14 Z" fill="#7BC67E" stroke="#3B2B25" stroke-width="3" stroke-linejoin="round"/></svg>`;

  function letters(t) { return [...t].map((ch, i) => h('span', { style: { animationDelay: `${0.45 + i * 0.05}s` } }, ch === ' ' ? ' ' : ch)); }

  /** original animated logo (tap anywhere to skip) */
  function logo() {
    if (skipAll()) return Promise.resolve();
    return new Promise((res) => {
      const el = h('div.intro-logo', { role: 'img', 'aria-label': 'OC Shimeji' });
      const mark = h('div.intro-mark'); mark.innerHTML = MARK;
      el.append(mark, h('div.intro-word', null, h('b', null, ...letters('OC')), ' ', h('span', null, ...letters('Shimeji'))), h('div.intro-sub', null, '我的 OC，住進你的手機'));
      document.getElementById('app').append(el);
      let done = false; const end = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => { el.remove(); res(); }, 420); };
      el.addEventListener('pointerdown', end);
      setTimeout(() => snd('chime'), 500);
      setTimeout(end, reduce() ? 900 : 2100);
    });
  }

  // ---------------------------------------------------------------- opening
  /** shot list over 晴日島 (design coordinates; hour of day eases dawn → morning) */
  const SHOTS = [
    { at: 0, x: 300, y: 980, zoom: 1.05, yaw: -0.55, instant: true, hour: 5.7, text: '海的另一邊，有一座小小的島。' },
    { at: 4.2, x: 290, y: 690, zoom: 1.55, yaw: 0.28, speed: 0.9, hour: 6.8, text: '島上有會亮起來的路燈、會結果的樹，' },
    { at: 8.4, x: 300, y: 420, zoom: 2.2, yaw: -0.12, speed: 0.9, hour: 8.2, text: '和一間一直等著住客的小屋。' },
    { at: 12.6, x: 300, y: 560, zoom: 1.25, yaw: 0, speed: 0.8, hour: 9.4, text: '住在這裡的，會是一位只屬於你的角色。' },
  ];
  const LENGTH = 16.5;

  /** play the opening; the world must have an area loaded (the caller loads 晴日島 without a player when needed) */
  function opening(o = {}) {
    if (skipAll()) return Promise.resolve({ skipped: true });
    return new Promise((res) => {
      const Wd = W(), hour0 = Wd.hourFn, wx0 = Wd.weatherFn, view0 = Wd.saveView ? Wd.saveView() : null;
      let hour = SHOTS[0].hour, t = 0, idx = -1, done = false, raf = 0, last = performance.now(); const start = last;
      Wd.hourFn = () => hour; Wd.weatherFn = () => 'clear';
      const top = h('div.lb.top'), bot = h('div.lb.bot'), sub = h('div.intro-subtitle', { 'aria-live': 'polite' });
      const skip = h('button.intro-skip', { 'aria-label': '跳過開場', on: { click: () => finish(true) } }, '跳過 ›');
      const el = h('div.intro-film', null, top, bot, sub, skip);
      document.getElementById('app').append(el); requestAnimationFrame(() => el.classList.add('on'));
      try { OC.Sound.ambient({ area: 'isle', wx: 'clear', night: false }); } catch (e) { /* audio is optional */ }
      const tick = (now) => {
        if (done) return;
        const dt = Math.min(0.1, (now - last) / 1000); last = now; t = (now - start) / 1000;   // real time: a slow device must not stretch the film
        while (idx + 1 < SHOTS.length && t >= SHOTS[idx + 1].at) {
          idx++; const s = SHOTS[idx];
          Wd.shot({ x: s.x, y: s.y, zoom: s.zoom, yaw: s.yaw, speed: reduce() ? 8 : s.speed || 1.4, instant: s.instant || reduce() });
          sub.classList.remove('show'); setTimeout(() => { sub.textContent = s.text; sub.classList.add('show'); }, idx ? 380 : 120);
          if (idx === SHOTS.length - 1) setTimeout(() => snd('sparkle'), 900);
        }
        // light follows the film's clock: piecewise-linear dawn → morning between the shots
        { const i = Math.max(0, idx), a = SHOTS[i], b = SHOTS[Math.min(SHOTS.length - 1, i + 1)], q = b === a ? 1 : Math.min(1, (t - a.at) / (b.at - a.at)); hour = a.hour + (b.hour - a.hour) * q; }
        if (t >= LENGTH) { finish(false); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      function finish(skipped) {
        if (done) return; done = true; cancelAnimationFrame(raf);
        el.classList.remove('on'); setTimeout(() => el.remove(), 520);
        Wd.hourFn = hour0; Wd.weatherFn = wx0; Wd.shot(null);
        if (view0 && !o.keepShot) Wd.restoreView(view0);
        if (S()) { S().intro.seen = true; OC.Store.touch('intro'); }
        res({ skipped });
      }
    });
  }

  // ---------------------------------------------------------------- welcome
  /** title card over the live world. returning: 繼續 is the main action. Resolves 'new' | 'continue' */
  function welcome(o = {}) {
    if (skipAll()) return Promise.resolve(o.returning ? 'continue' : 'new');
    return new Promise((res) => {
      const el = h('div.intro-welcome');
      const mark = h('div.intro-mark.s'); mark.innerHTML = MARK;
      const go = (v) => { OC.Sound && OC.Sound.unlock(); snd('tap'); el.classList.add('out'); setTimeout(() => { el.remove(); res(v); }, 380); };
      const replay = async () => { el.classList.add('out'); await wait(300); el.remove(); await opening({ keepShot: false }); document.getElementById('app').append(el); el.classList.remove('out'); };
      el.append(h('div.card.intro-card', null, mark, h('div.intro-word.s', null, h('b', null, 'OC'), ' ', h('span', null, 'Shimeji')),
        h('p.muted', null, o.returning ? `歡迎回來${o.name ? '，' + o.name + '在等你' : ''}。` : '創造一位原創角色，讓他住進晴日島，也住進你的手機桌面。'),
        o.returning ? h('button.btn.primary.block', { on: { click: () => go('continue') } }, icon('play', 's'), '繼續遊戲') : h('button.btn.primary.block', { on: { click: () => go('new') } }, icon('sparkle', 's'), '開始新遊戲'),
        h('div.hstack', { style: { gap: '8px', marginTop: '8px' } },
          h('button.btn.ghost.grow', { on: { click: replay } }, icon('film', 's'), '觀看開場'),
          o.returning ? h('button.btn.ghost.grow', { on: { click: () => go('new') } }, icon('plus', 's'), '新遊戲') : null)));
      document.getElementById('app').append(el); requestAnimationFrame(() => el.classList.add('on'));
    });
  }

  // ---------------------------------------------------------------- debut
  /** the new OC drops into the world: sparkle pillar, landing squash, greeting, name card; camera comes back */
  async function debut(a, c) {
    if (!a || !c || skipAll()) return;
    const Wd = W(), A = OC.App, nm = OC.Chars.name(c);
    OC.Brain && OC.Brain.hold(c.id, 'stage');
    Wd.shot({ x: a.x, y: a.y - 20, zoom: 2.5, yaw: 0, speed: 2.2, instant: true });
    a.lift = reduce() ? 0 : 150; a.tFace = 0; a.tBack = 0;
    const card = h('div.debut-card', null, h('small', null, '新居民'), h('b', null, nm), h('span', null, `${OC.Chars.typeTitle(c)}・搬到了晴日島`));
    document.getElementById('app').append(card);
    snd('sparkle'); OC.Stage && OC.Stage.fx && OC.Stage.fx(a, 'sparkle');
    // fall with gravity, land with a squash (data-free: purely visual)
    const t0 = performance.now();
    await new Promise((r) => { const step = () => { const q = Math.min(1, (performance.now() - t0) / 900); a.lift = 150 * (1 - q * q); if (q < 1) requestAnimationFrame(step); else { a.lift = 0; a.squashT = 0; snd('jump'); r(); } }; if (reduce()) r(); else requestAnimationFrame(step); });
    requestAnimationFrame(() => card.classList.add('on'));
    const p = c.personality, act = p.energy > 65 ? 'cheer' : (OC.Chars.has(c, 'shy') || p.social < 35) ? 'shy' : 'greet';
    Wd.setAction(a, act, { dur: 2.2, priority: 9 });
    const line = (OC.Talk && OC.Talk.say('desk_out', c, null)) || null;
    A.bubble && A.bubble(a, line ? line.text : `我是${nm}，請多指教！`, nm, 2.6);
    await wait(reduce() ? 600 : 2600);
    card.classList.remove('on'); setTimeout(() => card.remove(), 500);
    Wd.shot(null); Wd.setMode('classic', { zoom: 1.9 });
    OC.Brain && OC.Brain.unhold(c.id, 'stage');
  }

  OC.Intro = { logo, opening, welcome, debut, skipAll, MARK, SHOTS };
})();
