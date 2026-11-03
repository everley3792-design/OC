/* Scheme A — Mallow Mist : storyboard shots, transitions, chapter labels */
(function () {
  'use strict';
  const { TAU, clamp, lerp, seg, E, spring, wobble, ellipse, rr, mix, rgba, text, typewriter, blink, breath, walkPath, finger, rng, DATA } = OC;
  const { P, FONT, ZH, softShadow, frost, icon, item, pill, solidPill, roundBtn, touch, statusBar, navBar } = OC.M;
  const C = OC.M.CHAR, Wd = OC.M.WORLD;

  const idle = (t, seed, o = {}) => Object.assign({
    breath: breath(t, 0.36, seed * 0.17), blink: blink(t, seed), tail: Math.sin(t * 2.1 + seed) * 0.16,
    ear: Math.sin(t * 0.8 + seed) * 0.03,
  }, o);
  const dp = (ctx) => ctx.scale(OC.DP, OC.DP);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  function bg(ctx, a = '#FFF6F0', b = '#EFE7F6') {
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, a); g.addColorStop(1, b);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
  }
  function bokeh(ctx, t, n = 7, seed = 3) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * 360 + Math.sin(t * 0.3 + i) * 8, y = r() * 640 + Math.cos(t * 0.25 + i) * 8, R = 30 + r() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, rgba(['#FFFFFF', '#FBD9CC', '#E9E1F8', '#D9EEF7'][i % 4], 0.55)); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }
  }
  function header(ctx, title, opt = {}) {
    roundBtn(ctx, 30, 50, 15, opt.left || 'back', { is: 15 });
    text(ctx, title, 180, 51, { font: FONT(600, 15), color: P.ink, align: 'center', base: 'middle' });
    if (opt.sub) text(ctx, opt.sub, 180, 67, { font: ZH(9), color: P.ink2, align: 'center', base: 'middle' });
  }
  function miniHead(ctx, d, x, y, sc, t, seed, o = {}) {
    C.draw(ctx, d, idle(t, seed, Object.assign({ noShadow: true }, o)), x, y + 31 * sc, sc, t);
  }

  // ---------------- HUD ----------------
  function hud(ctx, t, o = {}) {
    const a = o.alpha == null ? 1 : o.alpha;
    const appear = (k) => E.outCubic(clamp(((o.lt ?? 9) - 0.3 - k * 0.12) / 0.5));
    const night = o.night || 0;
    ctx.save(); ctx.globalAlpha *= a;
    // time / weather pill
    let q = appear(0);
    ctx.save(); ctx.globalAlpha *= q; ctx.translate(0, (1 - q) * -8);
    frost(ctx, 14, 30, 104, 24, 12);
    icon(ctx, night > 0.55 ? 'moon' : 'sun', 29, 42, 13, night > 0.55 ? '#9B8FD6' : '#F2A66E', 2);
    text(ctx, '春 · 3日', 40, 42.5, { font: ZH(9.5), color: P.ink2, base: 'middle' });
    text(ctx, o.clock || '10:20', 110, 42.5, { font: FONT(600, 10.5), color: P.ink, base: 'middle', align: 'right' });
    ctx.restore();
    // coins
    q = appear(1);
    ctx.save(); ctx.globalAlpha *= q; ctx.translate(0, (1 - q) * -8);
    frost(ctx, 262, 30, 84, 24, 12);
    icon(ctx, 'coin', 277, 42, 13, '#F2B65E', 1.8);
    text(ctx, fmt(o.coins ?? DATA.coins), 337, 42.5, { font: FONT(600, 11), color: P.ink, base: 'middle', align: 'right' });
    ctx.restore();
    // portrait + mood ring
    q = appear(2);
    ctx.save(); ctx.globalAlpha *= q; ctx.translate((1 - q) * -10, 0);
    roundBtn(ctx, 38, 592, 21, null);
    ctx.save(); ctx.beginPath(); ctx.arc(38, 592, 18.5, 0, TAU); ctx.clip(); miniHead(ctx, 'mochi', 38, 600, 0.95, t, 1); ctx.restore();
    ctx.strokeStyle = P.peach; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(38, 592, 23.5, -Math.PI / 2, -Math.PI / 2 + TAU * 0.86); ctx.stroke();
    ctx.restore();
    // action cluster
    q = appear(3);
    ctx.save(); ctx.globalAlpha *= q; ctx.translate((1 - q) * 10, 0);
    roundBtn(ctx, 318, 590, 23, 'bag', { scale: o.bagPress || 1, is: 20 });
    roundBtn(ctx, 268, 600, 17, 'map', { scale: o.mapPress || 1, is: 15 });
    roundBtn(ctx, 318, 543, 15, 'dots', { is: 14 });
    ctx.restore();
    ctx.restore();
  }

  // ---------------- 1. LOGO ----------------
  function logo(ctx, lt, t) {
    dp(ctx); bg(ctx, '#FFF5EE', '#EADFF5'); bokeh(ctx, t, 9, 2);
    // sun glow
    const g = ctx.createRadialGradient(180, 250, 0, 180, 250, 200); g.addColorStop(0, 'rgba(255,236,214,0.9)'); g.addColorStop(1, 'rgba(255,236,214,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    for (let i = 0; i < 4; i++) { ctx.save(); ctx.globalAlpha = 0.85; Wd.cloud(ctx, ((t * (5 + i) + i * 110) % 520) - 100, 120 + i * 120, 0.8 + (i % 2) * 0.4); ctx.restore(); }
    // title letters rise in with soft overshoot
    const word = 'OC Shimeji';
    ctx.save(); ctx.font = FONT(700, 46);
    let total = 0; const widths = [...word].map((ch) => { const w = ctx.measureText(ch).width; total += w; return w; });
    let x = 180 - total / 2;
    [...word].forEach((ch, i) => {
      const q = clamp((lt - 0.25 - i * 0.055) / 0.55);
      const y = 300 + (1 - E.outBack(q)) * 22;
      ctx.globalAlpha = E.outCubic(q);
      const gg = ctx.createLinearGradient(0, y - 40, 0, y);
      gg.addColorStop(0, '#F3A08B'); gg.addColorStop(1, '#C78AA3');
      ctx.fillStyle = 'rgba(160,110,130,0.14)'; ctx.fillText(ch, x + 1, y + 3);
      ctx.fillStyle = ch === ' ' ? 'transparent' : gg; ctx.fillText(ch, x, y);
      x += widths[i];
    });
    ctx.restore();
    const sq = E.outCubic(clamp((lt - 1.0) / 0.6));
    text(ctx, '我的 OC，住進你的手機', 180, 336, { font: ZH(13), color: P.ink2, align: 'center', alpha: sq, ls: 3 });
    // Mochi peeks up from behind the title (anticipation -> pop -> settle)
    const pk = clamp((lt - 1.15) / 1.0);
    if (pk > 0) {
      const rise = spring(lt - 1.15, 1.6, 5.5);
      const s = idle(t, 1, { eyes: lt > 1.9 ? 'happy' : 'round', mouth: lt > 1.9 ? 'smile' : 'cat', earL: wobble(lt - 1.45, 3, 5) * 0.5, earR: wobble(lt - 1.5, 3, 5) * 0.5, armR: lt > 1.9 ? -2.2 + Math.sin(lt * 10) * 0.35 : undefined });
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 360, 266); ctx.clip();
      C.draw(ctx, 'mochi', Object.assign(s, { noShadow: true }), 250, 266 + (1 - rise) * 80, 1.7, t);
      ctx.restore();
    }
    // tiny loading dots
    for (let i = 0; i < 3; i++) { ctx.fillStyle = rgba(P.peach, 0.35 + 0.65 * Math.max(0, Math.sin(t * 4 - i * 0.7))); ellipse(ctx, 170 + i * 10, 560, 2.4, 2.4); ctx.fill(); }
  }

  // ---------------- 2. ISLAND ----------------
  const MOCHI_WALK = [{ t: 0.9, x: 196, y: 398 }, { t: 2.7, x: 262, y: 432 }];
  function islandState(lt, t) {
    const w = walkPath(MOCHI_WALK, lt, 13);
    const moving = w.moving;
    const turnT = lt - 2.75;
    const face = lt < 2.75 ? (lt > 0.75 ? 0.85 : lerp(0, 0.85, E.inOutCubic(clamp((lt - 0.45) / 0.3)))) : 0.85 * (1 - spring(turnT, 1.4, 6));
    const nightLook = clamp((lt - 4.0) / 0.6);
    const s = idle(t, 1, {
      face, walk: moving ? Math.sin(Math.PI * clamp(w.segT || 0)) ** 0.4 : 0, phase: w.phase,
      earL: wobble(turnT, 3.2, 4.5) * 0.4 + wobble(lt - 0.8, 3, 5) * 0.15, earR: wobble(turnT - 0.05, 3.2, 4.5) * 0.4,
      armR: lt > 3.0 && lt < 3.9 ? -2.3 + Math.sin((lt - 3.0) * 12) * 0.35 : undefined,
      eyes: lt > 3.0 && lt < 3.9 ? 'happy' : nightLook > 0.5 ? 'sparkle' : 'round',
      mouth: lt > 3.0 && lt < 3.9 ? 'smile' : nightLook > 0.3 ? 'o' : 'cat',
      lookY: -nightLook * 1.6, tilt: -nightLook * 0.12, headDy: -nightLook * 1.2,
      lean: moving ? 0.05 : 0, squash: 1 + wobble(turnT, 2.5, 6) * 0.04,
    });
    return { x: w.x, y: w.y, s };
  }
  function island(ctx, lt, t) {
    dp(ctx);
    const night = E.inOutSine(clamp((lt - 3.7) / 2.1));
    const zIn = E.inOutCubic(clamp((lt + 0.2) / 2.6));
    const m = islandState(lt, t);
    const cam = { x: lerp(200, m.x - 10, zIn * 0.75), y: lerp(392, m.y - 20, zIn * 0.7), z: lerp(0.8, 1.22, zIn) };
    const chars = [
      { d: 'mochi', s: m.s, x: m.x, y: m.y },
      { d: 'kuri', s: idle(t, 2, { face: 0.55, eyes: 'round', tail: Math.sin(t * 3) * 0.3 }), x: 124, y: 452 },
      { d: 'sora', s: idle(t, 3, { eyes: 'sleepy', blink: 0.6 + Math.sin(t) * 0.1, mouth: 'flat', tilt: 0.12, squash: 0.97 + breath(t, 0.3) * 0.015 }), x: 320, y: 562, emote: { kind: 'zzz', p: (t * 0.35) % 1 } },
    ];
    if (lt > 4.5) chars[0].emote = { kind: '♪', p: clamp((lt - 4.5) / 1.4) };
    Wd.drawIsland(ctx, { t, cam, night, chars });
    const mins = lerp(10 * 60 + 20, 21 * 60 + 5, night);
    const clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
    hud(ctx, t, { lt, night, clock });
    statusBar(ctx, clock, night > 0.6 ? '#fff' : P.ink);
  }

  // ---------------- 3. CREATOR ----------------
  const EYE_OPTS = [['round', 'soft'], ['sparkle', 'soft'], ['happy', 'up'], ['sleepy', 'none'], ['dot', 'dot'], ['wide', 'up'], ['round', 'worry'], ['sleepy', 'soft']];
  const EAR_OPTS = ['cat', 'bunny', 'bear', 'fold', 'sprout', 'cat', 'bunny', 'bear'];
  const TABS = ['眼睛', '眉毛', '嘴巴', '腮紅', '耳朵', '毛色'];
  const SW = ['#FFF6EC', '#FBE0D6', '#E6DEF7', '#D7EAF6', '#DDEFD3', '#EDC39D'];
  function creator(ctx, lt, t) {
    dp(ctx); bg(ctx, '#FFF5EF', '#F1E8F7'); bokeh(ctx, t, 6, 9);
    header(ctx, '捏臉工作室', { sub: '自由創角 · 外觀' });
    solidPill(ctx, 282, 38, 62, 25, '完成', P.peach, '#fff', FONT(600, 11));
    const f = finger([
      { t: 0.55, x: 230, y: 560 }, { t: 0.85, x: 133, y: 486 }, { t: 0.95, x: 133, y: 486, down: true }, { t: 1.12, x: 133, y: 486 },
      { t: 1.55, x: 247, y: 420 }, { t: 1.65, x: 247, y: 420, down: true }, { t: 1.8, x: 247, y: 420 },
      { t: 2.2, x: 133, y: 486 }, { t: 2.3, x: 133, y: 486, down: true }, { t: 2.45, x: 133, y: 486 },
      { t: 2.85, x: 120, y: 612 }, { t: 2.95, x: 120, y: 612, down: true }, { t: 3.1, x: 120, y: 612 },
      { t: 3.45, x: 150, y: 250 }, { t: 3.55, x: 150, y: 250, down: true }, { t: 4.2, x: 250, y: 256, down: true }, { t: 4.3, x: 250, y: 256 },
    ], lt);
    const eyeSel = lt < 1.0 ? 0 : 1;
    const tab = lt < 1.7 ? 0 : 4;
    const earSel = lt < 2.35 ? 0 : 1;
    const colP = E.inOutCubic(clamp((lt - 3.0) / 0.5));
    const D = Object.assign({}, C.DESIGNS.mochi, { fur: mix('#FFF6EC', SW[2], colP), shade: mix('#F1DCCB', '#CFC2EC', colP) });
    // turntable drag
    const drag = clamp((lt - 3.55) / 0.65), rel = lt - 4.2;
    const face = lt < 4.2 ? E.inOutSine(drag) * 0.9 : 0.9 * (1 - spring(rel, 1.3, 5));
    // pedestal
    softShadow(ctx, 180, 338, 92, 18, 0.18);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ellipse(ctx, 180, 334, 80, 15); ctx.fill();
    ctx.strokeStyle = 'rgba(245,168,147,0.35)'; ctx.lineWidth = 1; ellipse(ctx, 180, 334, 88, 18); ctx.stroke();
    const pop = wobble(lt - 1.0, 2.2, 6) * 0.07 + wobble(lt - 2.38, 2.2, 6) * 0.06;
    const s = idle(t, 1, {
      face, eyes: lt > 1.0 && lt < 1.45 ? 'happy' : EYE_OPTS[eyeSel][0], brows: EYE_OPTS[eyeSel][1], mouth: lt > 1.0 && lt < 1.45 ? 'smile' : 'cat',
      ears: EAR_OPTS[earSel], squash: 1 + pop, earL: wobble(lt - 2.38, 2.8, 4) * 0.6, earR: wobble(lt - 2.42, 2.8, 4) * 0.6,
      blush: colP,
    });
    C.draw(ctx, D, s, 180, 334, 3.4, t);
    // name tag
    frost(ctx, 140, 96, 80, 24, 12);
    text(ctx, '麻糬', 172, 108.5, { font: FONT(600, 12), color: P.ink, align: 'center', base: 'middle' });
    icon(ctx, 'brush', 202, 108, 10, P.ink2, 2);
    // sheet
    ctx.save();
    rr(ctx, 0, 386, 360, 280, 26); ctx.fillStyle = 'rgba(150,110,130,0.10)'; ctx.fill();
    rr(ctx, 0, 389, 360, 280, 26); ctx.fillStyle = 'rgba(255,252,249,0.97)'; ctx.fill();
    rr(ctx, 165, 397, 30, 3.5, 2); ctx.fillStyle = P.line; ctx.fill();
    ctx.restore();
    // tabs
    let tx = 18;
    TABS.forEach((name, i) => {
      ctx.font = ZH(11); const w = ctx.measureText(name).width + 22;
      const act = i === tab;
      if (act) { rr(ctx, tx, 409, w, 24, 12); ctx.fillStyle = P.peachSoft; ctx.fill(); }
      text(ctx, name, tx + w / 2, 421.5, { font: ZH(11), color: act ? P.coral : P.ink2, align: 'center', base: 'middle' });
      tx += w + 4;
    });
    // option grid (cross-fade on tab change)
    const swap = clamp((lt - 1.7) / 0.3);
    for (let i = 0; i < 8; i++) {
      const cx = 52 + (i % 4) * 85, cy = 486 + Math.floor(i / 4) * 74;
      const selected = tab === 0 ? i === eyeSel : i === earSel;
      const press = f && f.down && Math.hypot(f.x - cx, f.y - cy) < 30 ? 0.94 : 1;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(press, press); ctx.translate(-cx, -cy);
      rr(ctx, cx - 37, cy - 31, 74, 64, 18); ctx.fillStyle = selected ? '#FFF1EB' : '#FBF5F3'; ctx.fill();
      if (selected) { ctx.strokeStyle = P.peach; ctx.lineWidth = 2; rr(ctx, cx - 37, cy - 31, 74, 64, 18); ctx.stroke(); }
      ctx.save(); rr(ctx, cx - 37, cy - 31, 74, 64, 18); ctx.clip();
      const mk = (mode, a) => {
        ctx.globalAlpha = a;
        const o = mode === 0 ? { eyes: EYE_OPTS[i][0], brows: EYE_OPTS[i][1], noShadow: true } : { ears: EAR_OPTS[i], noShadow: true, clip: i > 4 ? 'flower' : null };
        C.draw(ctx, 'mochi', idle(t, 10 + i, o), cx, cy + (mode === 0 ? 62 : 72), mode === 0 ? 1.9 : 1.45, t);
      };
      if (swap < 1) mk(0, 1 - swap);
      if (swap > 0) mk(1, swap);
      ctx.restore(); ctx.restore();
      if (selected) { ctx.beginPath(); ctx.arc(cx + 30, cy - 24, 6.5, 0, TAU); ctx.fillStyle = P.peach; ctx.fill(); icon(ctx, 'check', cx + 30, cy - 24, 9, '#fff', 3); }
    }
    // swatches
    SW.forEach((c, i) => {
      const x = 46 + i * 37, y = 612; const sel = (colP > 0.5 ? 2 : 0) === i;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fillStyle = c; ctx.fill();
      ctx.strokeStyle = sel ? P.peach : 'rgba(150,120,130,.18)'; ctx.lineWidth = sel ? 2.4 : 1; ctx.beginPath(); ctx.arc(x, y, sel ? 15 : 12, 0, TAU); ctx.stroke();
    });
    icon(ctx, 'sparkle', 312, 612, 14, P.ink3);
    touch(ctx, f);
  }

  // ---------------- 4. PROFILE ----------------
  function ring(ctx, x, y, r, v, col, ic) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(col, 0.2); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * v); ctx.stroke();
    icon(ctx, ic, x, y, 14, mix(col, P.ink, 0.35), 2);
  }
  function profile(ctx, lt, t) {
    dp(ctx); bg(ctx, '#FFF7F1', '#F6EEF5');
    const scroll = E.inOutCubic(clamp((lt - 2.0) / 0.8)) * 92;
    ctx.save(); ctx.translate(0, -scroll);
    // hero card
    frost(ctx, 16, 84, 328, 150, 26);
    const pg = ctx.createRadialGradient(80, 150, 5, 80, 160, 60); pg.addColorStop(0, '#FFF1EA'); pg.addColorStop(1, '#F8DCD2');
    ctx.beginPath(); ctx.arc(80, 159, 50, 0, TAU); ctx.fillStyle = pg; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(80, 159, 50, 0, TAU); ctx.clip();
    C.draw(ctx, 'mochi', idle(t, 1, { noShadow: true, eyes: lt > 3.3 ? 'happy' : 'round', mouth: lt > 3.3 ? 'smile' : 'cat' }), 80, 248, 2.6, t);
    ctx.restore();
    text(ctx, '麻糬', 146, 124, { font: FONT(700, 22), color: P.ink });
    text(ctx, 'Mochi · 你的 OC', 147, 143, { font: FONT(500, 10), color: P.ink2 });
    let cx = 146, cy = 158;
    DATA.traits.forEach((tr, i) => {
      ctx.font = ZH(9.5); const w = ctx.measureText(tr).width + 16;
      if (cx + w > 334) { cx = 146; cy += 24; }
      const q = E.outCubic(clamp((lt - 0.3 - i * 0.08) / 0.4));
      ctx.save(); ctx.globalAlpha = q;
      rr(ctx, cx, cy + (1 - q) * 5, w, 19, 9.5); ctx.fillStyle = [P.peachSoft, P.lavSoft, '#DDF0E4', '#FDF0CC'][i]; ctx.fill();
      text(ctx, tr, cx + w / 2, cy + 10 + (1 - q) * 5, { font: ZH(9.5), color: P.ink, align: 'center', base: 'middle' });
      ctx.restore(); cx += w + 5;
    });
    // needs
    text(ctx, '今日狀態', 24, 268, { font: ZH(13), color: P.ink });
    text(ctx, '自主生活中 · 正在發呆', 336, 268, { font: ZH(9.5), color: P.ink2, align: 'right' });
    frost(ctx, 16, 280, 328, 108, 22);
    const cols = [P.peach, '#F2C46B', '#E99AB0', '#9DC7E8', '#8FCAA9'];
    const ics = ['heart', 'sun', 'face', 'chat', 'sparkle'];
    DATA.needs.forEach((n, i) => {
      const x = 50 + i * 65, q = E.outCubic(clamp((lt - 0.4 - i * 0.1) / 0.9));
      ring(ctx, x, 322, 19, n.v * q, cols[i], ics[i]);
      text(ctx, n.zh, x, 359, { font: ZH(10), color: P.ink, align: 'center' });
      text(ctx, Math.round(n.v * 100 * q) + '%', x, 373, { font: FONT(500, 9), color: P.ink2, align: 'center' });
    });
    // thought bubble
    frost(ctx, 16, 398, 328, 46, 18, { top: 'rgba(255,244,238,.95)', bottom: 'rgba(255,240,234,.92)' });
    icon(ctx, 'chat', 38, 421, 14, P.coral);
    text(ctx, typewriter('「風好舒服… 等等去池塘看看栗子吧。」', clamp((lt - 0.8) / 1.2)), 54, 425, { font: ZH(11), color: P.ink });
    // relationships
    text(ctx, '關係', 24, 474, { font: ZH(13), color: P.ink });
    DATA.relations.forEach((r, i) => {
      const y = 486 + i * 62;
      const press = lt > 3.25 && lt < 3.45 && i === 0;
      frost(ctx, 16, y, 328, 54, 20, press ? { top: '#FFF0EA', bottom: '#FDE7DF' } : {});
      ctx.save(); ctx.beginPath(); ctx.arc(45, y + 27, 19, 0, TAU); ctx.fillStyle = '#F8EEE9'; ctx.fill(); ctx.clip();
      miniHead(ctx, r.who, 45, y + 36, 0.92, t, 4 + i); ctx.restore();
      text(ctx, DATA.cast[r.who].zh, 74, y + 23, { font: ZH(13), color: P.ink });
      text(ctx, r.zh, 74, y + 40, { font: ZH(9.5), color: P.ink2 });
      for (let h = 0; h < 5; h++) icon(ctx, h < r.hearts ? 'heart' : 'heartO', 230 + h * 19, y + 27, 13, h < r.hearts ? P.berry : P.ink3, 1.6);
    });
    // life goal card (revealed by scroll)
    text(ctx, '生活目標', 24, 628, { font: ZH(13), color: P.ink });
    frost(ctx, 16, 640, 328, 62, 20);
    item(ctx, 'flower', 46, 671, 28);
    text(ctx, '讓小島開滿 10 種花', 72, 664, { font: ZH(12), color: P.ink });
    rr(ctx, 72, 676, 200, 7, 3.5); ctx.fillStyle = '#F3E6E3'; ctx.fill();
    rr(ctx, 72, 676, 200 * 0.6 * E.outCubic(clamp((lt - 2.4) / 0.8)), 7, 3.5); ctx.fillStyle = P.mintDeep; ctx.fill();
    text(ctx, '6 / 10', 330, 682, { font: FONT(600, 10), color: P.ink2, align: 'right' });
    ctx.restore();
    // fixed header with fade background
    const hg = ctx.createLinearGradient(0, 0, 0, 84); hg.addColorStop(0, 'rgba(255,247,241,1)'); hg.addColorStop(0.75, 'rgba(255,247,241,.95)'); hg.addColorStop(1, 'rgba(255,247,241,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, 360, 84);
    header(ctx, '角色檔案');
    roundBtn(ctx, 330, 50, 15, 'gear', { is: 15 });
    touch(ctx, finger([{ t: 1.7, x: 250, y: 600 }, { t: 2.0, x: 250, y: 600, down: true }, { t: 2.8, x: 250, y: 508, down: true }, { t: 2.9, x: 250, y: 508 }, { t: 3.2, x: 190, y: 420 }, { t: 3.27, x: 190, y: 420, down: true }, { t: 3.45, x: 190, y: 420 }], lt));
  }

  // ---------------- 5. DIALOGUE ----------------
  function bubble(ctx, x, y, w, h, tailX, name, str, a = 1) {
    ctx.save(); ctx.globalAlpha *= a;
    const pop = E.outBack(clamp(a), 1.4);
    ctx.translate(tailX, y + h); ctx.scale(0.9 + pop * 0.1, 0.9 + pop * 0.1); ctx.translate(-tailX, -(y + h));
    frost(ctx, x, y, w, h, 18);
    ctx.beginPath(); ctx.moveTo(tailX - 7, y + h - 0.5); ctx.quadraticCurveTo(tailX, y + h + 5, tailX + 2, y + h + 11); ctx.quadraticCurveTo(tailX + 4, y + h + 4, tailX + 9, y + h - 0.5); ctx.fillStyle = 'rgba(255,249,245,0.96)'; ctx.fill();
    if (name) { solidPill(ctx, x + 14, y - 10, ctx.measureText(name).width + 36, 20, name, P.peach, '#fff', ZH(10.5)); }
    text(ctx, str, x + 16, y + h / 2 + 5, { font: ZH(13), color: P.ink });
    ctx.restore();
  }
  function dialogue(ctx, lt, t) {
    dp(ctx);
    const kw = walkPath([{ t: -0.2, x: 262, y: 452 }, { t: 1.0, x: 212, y: 450 }], lt, 12);
    const jumpT = lt - 3.2;
    const antic = clamp((lt - 2.95) / 0.25) * (1 - clamp((lt - 3.2) / 0.05));
    const air = jumpT > 0 && jumpT < 0.42 ? Math.sin((jumpT / 0.42) * Math.PI) : 0;
    const land = wobble(jumpT - 0.42, 2.4, 6);
    const reacting = lt > 2.95;
    const ks = idle(t, 2, {
      face: -0.75, walk: kw.moving ? 1 : 0, phase: kw.phase,
      lift: air * 16, squash: 1 - antic * 0.16 + air * 0.1 - land * 0.12,
      ear: -antic * 0.5 + air * -0.25, earL: wobble(jumpT - 0.3, 2.6, 4) * 0.55, earR: wobble(jumpT - 0.33, 2.6, 4) * 0.55,
      eyes: lt > 3.15 ? 'happy' : lt > 2.95 ? 'wide' : 'round', mouth: lt > 3.15 ? 'open' : lt > 1.0 && lt < 2.2 ? (Math.sin(t * 18) > 0 ? 'o' : 'cat') : 'cat',
      armL: air > 0 ? -2.4 : undefined, armR: air > 0 ? -2.4 : undefined, tail: Math.sin(t * (reacting ? 9 : 2)) * (reacting ? 0.5 : 0.15),
      blush: lt > 3.3 ? 1 : 0, brows: lt > 2.95 && lt < 3.2 ? 'up' : null,
    });
    const ms = idle(t, 1, { face: 0.7, eyes: lt > 3.5 ? 'happy' : 'round', mouth: lt > 3.5 ? 'smile' : lt > 2.8 && lt < 3.1 ? 'o' : 'cat', blush: clamp((lt - 3.4) / 0.5), lookY: -air * 1.2, tilt: lt > 3.5 ? -0.08 : 0 });
    const chars = [
      { d: 'mochi', s: ms, x: 164, y: 452 },
      { d: 'kuri', s: ks, x: kw.x, y: kw.y, emote: lt > 2.95 && lt < 3.35 ? { kind: '!', p: clamp((lt - 2.95) / 0.45) } : lt > 3.4 ? { kind: '♥', p: clamp((lt - 3.4) / 1.4) } : null },
    ];
    const z = lerp(1.9, 2.05, E.inOutSine(clamp(lt / 5)));
    Wd.drawIsland(ctx, { t, cam: { x: 188, y: 430, z }, night: 0, chars });
    // vignette to focus the conversation
    const vg = ctx.createRadialGradient(180, 330, 120, 180, 330, 380); vg.addColorStop(0, 'rgba(255,248,242,0)'); vg.addColorStop(1, 'rgba(255,240,235,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, 360, 640);
    const b1 = clamp((lt - 0.95) / 0.3) * (1 - clamp((lt - 2.75) / 0.25));
    if (b1 > 0) bubble(ctx, 54, 150, 262, 48, 230, '栗子', typewriter(DATA.dialogue.a, clamp((lt - 1.1) / 1.0)), b1);
    const b2 = clamp((lt - 3.75) / 0.3);
    if (b2 > 0) bubble(ctx, 84, 150, 210, 48, 232, '栗子', typewriter(DATA.dialogue.b, clamp((lt - 3.85) / 0.7)), b2);
    // choices
    const ca = clamp((lt - 2.15) / 0.3) * (1 - clamp((lt - 3.0) / 0.25));
    if (ca > 0) {
      DATA.dialogue.choices.forEach((c, i) => {
        const q = E.outCubic(clamp((lt - 2.15 - i * 0.08) / 0.35));
        const sel = i === 0 && lt > 2.75;
        ctx.save(); ctx.globalAlpha = ca; ctx.translate(0, (1 - q) * 16);
        frost(ctx, 70, 486 + i * 46, 220, 36, 18, sel ? { top: '#FFE9E1', bottom: '#FCDCD1' } : {});
        icon(ctx, i === 0 ? 'walk' : 'heart', 92, 504 + i * 46, 13, P.coral);
        text(ctx, c, 108, 508.5 + i * 46, { font: ZH(12.5), color: P.ink });
        ctx.restore();
      });
    }
    statusBar(ctx, '10:32', P.ink);
    touch(ctx, finger([{ t: 2.45, x: 230, y: 560 }, { t: 2.7, x: 190, y: 506 }, { t: 2.78, x: 190, y: 506, down: true }, { t: 2.95, x: 190, y: 506 }], lt));
  }

  // ---------------- 6. MAP ----------------
  const PLACES = [
    { id: 'village', x: 168, y: 338, rx: 58, ry: 40, c: '#C9E8B4' },
    { id: 'forest', x: 92, y: 210, rx: 50, ry: 36, c: '#A9D6A0' },
    { id: 'beach', x: 270, y: 450, rx: 44, ry: 30, c: '#F9E3C3' },
    { id: 'hill', x: 268, y: 200, rx: 46, ry: 32, c: '#D4EAB7' },
    { id: 'market', x: 82, y: 470, rx: 40, ry: 28, c: '#F6D8D8' },
  ];
  function mapView(ctx, lt, t, zoom) {
    ctx.save();
    const fz = zoom || { s: 1, x: 180, y: 320 };
    ctx.translate(180, 320); ctx.scale(fz.s, fz.s); ctx.translate(-fz.x, -fz.y);
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#D5ECF5'); g.addColorStop(1, '#BFE0EF');
    ctx.fillStyle = g; ctx.fillRect(-200, -200, 760, 1040);
    // map grid & waves
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8;
    for (let y = 0; y < 640; y += 24) for (let x = (y / 24) % 2 * 20; x < 360; x += 40) { ctx.beginPath(); ctx.moveTo(x, y + Math.sin(t + x) * 1.5); ctx.quadraticCurveTo(x + 5, y - 3, x + 10, y); ctx.stroke(); }
    // routes
    ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(160,120,130,0.45)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const [a, b] of [[0, 1], [0, 2], [0, 3], [0, 4]]) { const A = PLACES[a], B = PLACES[b]; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo((A.x + B.x) / 2 + 20, (A.y + B.y) / 2 - 10, B.x, B.y); ctx.stroke(); }
    ctx.setLineDash([]);
    PLACES.forEach((p, i) => {
      Wd.plateau(ctx, p.x, p.y, p.rx, p.ry, i * 1.7 + 0.5, 9, mix(p.c, '#ffffff', 0.35), p.c, '#EBCDB6', '#D3AA92');
      if (p.id === 'forest') for (const [dx, dy, s] of [[-20, 0, 0.45], [6, -12, 0.5], [22, 6, 0.4], [-4, 14, 0.38]]) Wd.tree(ctx, p.x + dx, p.y + dy, s, t, i + dx, 'pine');
      if (p.id === 'village') { Wd.house(ctx, p.x - 12, p.y + 4, 0.4, t, '#F8B9A6', '#E9907E', 0, 1); Wd.house(ctx, p.x + 22, p.y + 14, 0.32, t, '#D5C6F1', '#A996D8', 0, 2); Wd.tree(ctx, p.x + 30, p.y - 10, 0.4, t, 3); }
      if (p.id === 'hill') { ctx.fillStyle = '#FFF6EE'; rr(ctx, p.x - 4, p.y - 26, 8, 22, 3); ctx.fill(); ctx.save(); ctx.translate(p.x, p.y - 24); ctx.rotate(t * 1.5); ctx.fillStyle = '#FFFDF8'; for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); rr(ctx, -2.5, 1, 5, 11, 2.5); ctx.fill(); } ctx.fillStyle = P.peach; ellipse(ctx, 0, 0, 2.4, 2.4); ctx.fill(); ctx.restore(); }
      if (p.id === 'beach') for (let k = 0; k < 3; k++) item(ctx, 'shell', p.x - 16 + k * 14, p.y + 2, 10);
      if (p.id === 'market') { ctx.fillStyle = P.peach; rr(ctx, p.x - 16, p.y - 16, 32, 8, 3); ctx.fill(); ctx.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { rr(ctx, p.x - 14 + k * 8, p.y - 16, 4, 8, 1); ctx.fill(); } ctx.fillStyle = '#F2DCCB'; rr(ctx, p.x - 14, p.y - 8, 28, 10, 2); ctx.fill(); }
    });
    ctx.restore();
  }
  function map(ctx, lt, t) {
    dp(ctx);
    // under: island with HUD; map reveals from map button
    const rev = E.inOutCubic(clamp((lt - 0.45) / 0.65));
    if (rev < 1) {
      const m = { x: 262, y: 432 };
      Wd.drawIsland(ctx, { t, cam: { x: 252, y: 412, z: 1.22 }, night: 0, chars: [{ d: 'mochi', s: idle(t, 1, {}), x: m.x, y: m.y }, { d: 'kuri', s: idle(t, 2, { face: -0.5 }), x: 212, y: 450 }] });
      hud(ctx, t, { mapPress: lt > 0.3 && lt < 0.5 ? 0.9 : 1 });
    }
    const zoomP = E.inOutCubic(clamp((lt - 2.6) / 0.8));
    const forestA = E.inOutSine(clamp((lt - 3.05) / 0.5));
    if (rev > 0) {
      ctx.save();
      const R = rev * 760;
      ctx.beginPath(); ctx.arc(268, 600, R, 0, TAU); ctx.clip();
      const fp = PLACES[1];
      mapView(ctx, lt, t, { s: 1 + zoomP * 2.4, x: lerp(180, fp.x, zoomP), y: lerp(320, fp.y, zoomP) });
      // pins + labels
      const ua = 1 - zoomP;
      if (ua > 0) {
        ctx.save(); ctx.globalAlpha = ua;
        PLACES.forEach((p, i) => {
          const pa = E.outBack(clamp((lt - 0.8 - i * 0.07) / 0.4), 1.5);
          const sel = p.id === 'forest' && lt > 1.45;
          const bounce = sel ? wobble(lt - 1.45, 2.5, 5) * 0.2 : 0;
          const name = DATA.places.find((d) => d.id === p.id).zh;
          ctx.save(); ctx.translate(p.x, p.y - p.ry - 8); ctx.scale(pa * (1 + bounce), pa * (1 - bounce * 0.5));
          ctx.font = ZH(10.5); const w = ctx.measureText(name).width + 30;
          frost(ctx, -w / 2, -22, w, 22, 11, sel ? { top: '#FFE9E1', bottom: '#FCDCD1' } : {});
          icon(ctx, p.id === 'village' ? 'home' : 'pin', -w / 2 + 12, -11, 11, sel ? P.coral : P.ink2, 2);
          text(ctx, name, -w / 2 + 21, -10.5, { font: ZH(10.5), color: P.ink, base: 'middle' });
          ctx.restore();
        });
        // current location marker (Mochi head)
        const vp = PLACES[0];
        ctx.save(); ctx.beginPath(); ctx.arc(vp.x - 30, vp.y + 4, 13, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = P.peach; ctx.lineWidth = 2; ctx.stroke(); ctx.clip();
        miniHead(ctx, 'mochi', vp.x - 30, vp.y + 9, 0.62, t, 1); ctx.restore();
        // title & close
        pill(ctx, 120, 36, 120, 28, '世界地圖', { font: ZH(13) });
        roundBtn(ctx, 330, 50, 15, 'close', { is: 14 });
        // info card
        const ic = E.outCubic(clamp((lt - 1.6) / 0.45));
        if (ic > 0) {
          ctx.save(); ctx.translate(0, (1 - ic) * 140);
          frost(ctx, 16, 496, 328, 120, 26);
          text(ctx, '苔光森林', 34, 528, { font: ZH(17), color: P.ink });
          text(ctx, 'Mosslight Woods', 34, 546, { font: FONT(500, 10), color: P.ink2 });
          icon(ctx, 'rain', 236, 520, 15, '#8DB6D8'); text(ctx, '小雨', 250, 524, { font: ZH(10.5), color: P.ink2 });
          icon(ctx, 'clock', 290, 520, 13, P.ink2); text(ctx, '3 分', 302, 524, { font: ZH(10.5), color: P.ink2 });
          text(ctx, '雨後的苔蘚會發光，聽說能找到稀有蘑菇。', 34, 572, { font: ZH(10.5), color: P.ink2 });
          const pr = lt > 2.45 && lt < 2.62 ? 0.95 : 1;
          ctx.save(); ctx.translate(262, 594); ctx.scale(pr, pr); solidPill(ctx, -46, -14, 92, 30, '出發', P.peach, '#fff', ZH(13)); ctx.restore();
          ctx.restore();
        }
        ctx.restore();
      }
      // soft rim on reveal edge
      if (rev < 1) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(268, 600, R, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    // fly into forest
    if (forestA > 0) {
      ctx.save(); ctx.globalAlpha = forestA;
      const w = walkPath([{ t: 3.0, x: 196, y: 640 }, { t: 4.6, x: 188, y: 520 }], lt, 12);
      Wd.drawForest(ctx, { t, rain: 1, chars: [{ d: 'mochi', s: idle(t, 1, { back: 0.85, walk: w.moving ? 1 : 0, phase: w.phase, hold: 'leaf', tail: Math.sin(t * 3) * 0.3 }), x: w.x, y: w.y, sc: 1.35 }] });
      // location title card (BotW-like, minimal)
      const la = clamp((lt - 3.5) / 0.4);
      ctx.globalAlpha = forestA * la;
      text(ctx, '苔光森林', 180, 120, { font: ZH(22), color: '#fff', align: 'center', ls: 6, stroke: 'rgba(90,120,110,0.25)', strokeW: 4 });
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; rr(ctx, 130, 132, 100 * la, 1.5, 1); ctx.fill();
      text(ctx, 'Mosslight Woods · 小雨', 180, 150, { font: FONT(500, 10), color: '#fff', align: 'center', ls: 2 });
      ctx.restore();
    }
    statusBar(ctx, '10:41', forestA > 0.5 ? '#fff' : P.ink);
    touch(ctx, finger([
      { t: 0.05, x: 220, y: 560 }, { t: 0.3, x: 268, y: 600 }, { t: 0.35, x: 268, y: 600, down: true }, { t: 0.5, x: 268, y: 600 },
      { t: 1.2, x: 100, y: 160 }, { t: 1.4, x: 92, y: 160, down: true }, { t: 1.55, x: 92, y: 160 },
      { t: 2.25, x: 262, y: 594 }, { t: 2.45, x: 262, y: 594, down: true }, { t: 2.62, x: 262, y: 594 }], lt));
  }

  // ---------------- 7. INVENTORY ----------------
  function inventory(ctx, lt, t) {
    dp(ctx);
    const f = finger([
      { t: 0.0, x: 300, y: 560 }, { t: 0.2, x: 318, y: 590 }, { t: 0.25, x: 318, y: 590, down: true }, { t: 0.4, x: 318, y: 590 },
      { t: 0.85, x: 52, y: 470 }, { t: 0.95, x: 52, y: 470, down: true }, { t: 1.45, x: 52, y: 470, down: true },
      { t: 2.25, x: 186, y: 262, down: true }, { t: 2.3, x: 186, y: 262 }], lt);
    const sheet = E.outCubic(clamp((lt - 0.3) / 0.45)) * (1 - E.inOutCubic(clamp((lt - 1.5) / 0.5)) * 0.62);
    const dragging = lt > 1.45 && lt < 2.3;
    const eatT = lt - 2.32;
    const chew = eatT > 0 && eatT < 0.9;
    const happy = eatT > 0.9;
    const cake = f && lt > 0.95 && lt < 2.32 ? { x: f.x, y: f.y } : null;
    const notice = clamp((lt - 1.5) / 0.3);
    const ms = idle(t, 1, {
      face: 0, eyes: happy ? 'happy' : notice > 0.5 ? 'sparkle' : 'round', mouth: chew ? 'chew' : happy ? 'smile' : notice > 0.5 ? 'open' : 'cat',
      lookY: cake ? clamp((cake.y - 260) / 60, -1.5, 1.5) : 0, headDx: cake ? clamp((cake.x - 180) / 40, -2, 2) : 0,
      squash: 1 + (chew ? Math.sin(eatT * 14) * 0.03 : 0) + wobble(eatT - 0.9, 2.2, 5) * 0.06, ear: -notice * 0.15, blush: happy ? 1 : 0,
      tail: Math.sin(t * (notice > 0.5 ? 8 : 2)) * (notice > 0.5 ? 0.45 : 0.15), lift: happy ? Math.max(0, Math.sin((eatT - 0.9) * 7)) * 5 * clamp(1.6 - eatT) : 0,
    });
    Wd.drawIsland(ctx, { t, cam: { x: 230, y: 330, z: 1.85 }, night: 0, chars: [{ d: 'mochi', s: ms, x: 214, y: 334, emote: happy ? { kind: '♥', p: clamp((eatT - 0.9) / 1.3) } : null }] });
    // dim + sheet
    ctx.fillStyle = `rgba(110,90,100,${0.16 * sheet})`; ctx.fillRect(0, 0, 360, 640);
    hud(ctx, t, { alpha: 1 - clamp(sheet * 2), bagPress: lt > 0.2 && lt < 0.4 ? 0.9 : 1 });
    const sy = lerp(640, 392, sheet);
    if (sheet > 0.001) {
      ctx.save(); ctx.translate(0, sy - 392);
      rr(ctx, 0, 389, 360, 300, 26); ctx.fillStyle = 'rgba(150,110,130,0.12)'; ctx.fill();
      rr(ctx, 0, 392, 360, 300, 26); ctx.fillStyle = 'rgba(255,252,249,0.98)'; ctx.fill();
      rr(ctx, 165, 400, 30, 3.5, 2); ctx.fillStyle = P.line; ctx.fill();
      text(ctx, '背包', 22, 430, { font: ZH(15), color: P.ink });
      ['全部', '食物', '素材', '家具'].forEach((n, i) => { const x = 150 + i * 48; if (i === 0) { rr(ctx, x - 20, 416, 40, 20, 10); ctx.fillStyle = P.peachSoft; ctx.fill(); } text(ctx, n, x, 426.5, { font: ZH(10), color: i === 0 ? P.coral : P.ink2, align: 'center', base: 'middle' }); });
      DATA.items.forEach((it, i) => {
        const x = 52 + (i % 4) * 85, y = 470 + Math.floor(i / 4) * 78;
        const lifted = it.id === 'cake' && lt > 0.95;
        rr(ctx, x - 36, y - 32, 72, 66, 18); ctx.fillStyle = '#FBF5F2'; ctx.fill();
        if (!lifted || lt > 2.3) item(ctx, it.id, x, y - 4, 38);
        else { ctx.globalAlpha = 0.25; item(ctx, it.id, x, y - 4, 38); ctx.globalAlpha = 1; }
        text(ctx, '×' + (it.id === 'cake' && lt > 2.3 ? it.n - 1 : it.n), x + 28, y + 26, { font: FONT(600, 9), color: P.ink2, align: 'right' });
      });
      ctx.restore();
    }
    // long-press progress ring + dragged item (lags behind finger, tilts with motion)
    if (f && lt > 0.95 && lt < 1.45) {
      const q = (lt - 0.95) / 0.5; ctx.strokeStyle = P.peach; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(f.x, f.y - 4, 26, -Math.PI / 2, -Math.PI / 2 + TAU * q); ctx.stroke();
    }
    if (cake) {
      const prev = finger([{ t: 0.85, x: 52, y: 470 }, { t: 1.45, x: 52, y: 470, down: true }, { t: 2.25, x: 186, y: 262, down: true }], lt - 0.08) || cake;
      const lift = E.outBack(clamp((lt - 1.3) / 0.25), 1.5);
      const tilt = clamp((cake.x - prev.x) * 0.04, -0.4, 0.4);
      const shrink = 1 - clamp((lt - 2.2) / 0.12);
      ctx.save(); ctx.translate(lerp(cake.x, prev.x, 0.4), lerp(cake.y, prev.y, 0.4) - 18 * lift); ctx.rotate(tilt); ctx.scale((1 + lift * 0.25) * shrink, (1 + lift * 0.25) * shrink);
      softShadow(ctx, 0, 30, 18, 5, 0.18 * lift);
      item(ctx, 'cake', 0, 0, 44); ctx.restore();
    }
    // feedback: need bar + floating text
    if (eatT > 0.9) {
      const q = clamp((eatT - 0.9) / 1.0);
      ctx.save(); ctx.globalAlpha = clamp((eatT - 0.9) / 0.25) * clamp((2.9 - eatT) / 0.3);
      frost(ctx, 114, 140, 132, 30, 15);
      icon(ctx, 'heart', 131, 155, 12, P.peach);
      rr(ctx, 142, 151, 78, 7, 3.5); ctx.fillStyle = '#F3E6E3'; ctx.fill();
      rr(ctx, 142, 151, 78 * lerp(0.42, 0.6, E.outCubic(q)), 7, 3.5); ctx.fillStyle = P.peach; ctx.fill();
      text(ctx, '+18', 238, 156, { font: FONT(700, 10), color: P.coral, align: 'right', base: 'middle' });
      ctx.restore();
      text(ctx, '好好吃～', 214, 196 - q * 10, { font: ZH(12), color: P.coral, align: 'center', alpha: clamp(1.4 - q) });
    }
    // crumbs
    if (chew) { const r = rng(4); for (let i = 0; i < 6; i++) { const q = (eatT * 1.6 + r()) % 1; ctx.fillStyle = rgba('#F3D2B5', 1 - q); ellipse(ctx, 214 + (r() - 0.5) * 30 * q, 224 + q * 30, 1.6, 1.6); ctx.fill(); } }
    statusBar(ctx, '10:45', P.ink);
    touch(ctx, f);
  }

  // ---------------- 8. SHOP ----------------
  function shop(ctx, lt, t) {
    dp(ctx); bg(ctx, '#FFF6EF', '#F7ECEE');
    // stall awning
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#FFFFFF' : '#F8C3B3'; ctx.beginPath(); ctx.moveTo(i * 40, 30); ctx.lineTo(i * 40 + 40, 30); ctx.lineTo(i * 40 + 40, 74); ctx.arc(i * 40 + 20, 74, 20, 0, Math.PI); ctx.fill(); }
    ctx.fillStyle = 'rgba(150,110,130,0.08)'; ctx.fillRect(0, 94, 360, 4);
    // shopkeeper
    const sold = lt > 1.45;
    C.draw(ctx, 'sora', idle(t, 3, { eyes: sold ? 'happy' : 'round', mouth: sold ? 'smile' : 'cat', armR: sold ? -2.2 + Math.sin(t * 10) * 0.3 : undefined, clip: null }), 76, 210, 2.0, t);
    ctx.fillStyle = '#F2DCCB'; rr(ctx, 14, 178, 332, 34, 14); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; rr(ctx, 14, 178, 332, 6, 3); ctx.fill();
    text(ctx, '雲朵市集', 150, 128, { font: ZH(20), color: P.ink });
    text(ctx, '今天有新到的燈喔～', 151, 150, { font: ZH(11), color: P.ink2 });
    const coins = lerp(DATA.coins, DATA.coins - 120, E.outCubic(clamp((lt - 1.5) / 0.8)));
    const cp = wobble(lt - 2.2, 3, 6) * 0.08;
    ctx.save(); ctx.translate(304, 129); ctx.scale(1 + cp, 1 + cp); frost(ctx, -40, -12, 80, 24, 12); icon(ctx, 'coin', -26, 0, 13, '#F2B65E', 1.8); text(ctx, fmt(coins), 32, 0.5, { font: FONT(600, 11), color: P.ink, base: 'middle', align: 'right' }); ctx.restore();
    // cards
    DATA.shop.forEach((s, i) => {
      const x = 18 + (i % 2) * 166, y = 228 + Math.floor(i / 2) * 150;
      const sel = s.id === 'lamp' && lt > 0.55;
      const lift = sel ? E.outBack(clamp((lt - 0.55) / 0.3), 1.4) : 0;
      ctx.save(); ctx.translate(0, -lift * 4);
      frost(ctx, x, y, 158, 140, 22, sel ? { top: '#FFF3EE', bottom: '#FFEAE2' } : {});
      if (sel) { ctx.strokeStyle = P.peach; ctx.lineWidth = 2; rr(ctx, x, y, 158, 140, 22); ctx.stroke(); }
      const bgc = [P.peachSoft, P.lavSoft, '#DDF0E4', '#FDF0CC'][i];
      ctx.fillStyle = bgc; ellipse(ctx, x + 79, y + 56, 40, 36); ctx.fill();
      const glow = s.id === 'lamp' ? 0.5 + Math.sin(t * 2) * 0.1 : 0;
      if (glow) { const gg = ctx.createRadialGradient(x + 79, y + 50, 0, x + 79, y + 50, 40); gg.addColorStop(0, `rgba(255,220,170,${glow})`); gg.addColorStop(1, 'rgba(255,220,170,0)'); ctx.fillStyle = gg; ctx.fillRect(x + 39, y + 10, 80, 80); }
      item(ctx, s.id, x + 79, y + 54 + Math.sin(t * 2 + i) * 1.5, 58);
      text(ctx, s.zh, x + 16, y + 116, { font: ZH(12), color: P.ink });
      icon(ctx, 'coin', x + 112, y + 112, 11, '#F2B65E', 1.8); text(ctx, String(s.price), x + 144, y + 116, { font: FONT(600, 11), color: P.ink, align: 'right' });
      ctx.restore();
    });
    // buy bar
    const bb = E.outCubic(clamp((lt - 0.75) / 0.4));
    if (bb > 0) {
      ctx.save(); ctx.translate(0, (1 - bb) * 90);
      frost(ctx, 16, 546, 328, 66, 24);
      item(ctx, 'lamp', 50, 578, 34);
      text(ctx, '蘑菇檯燈', 76, 572, { font: ZH(13), color: P.ink });
      text(ctx, '夜裡會發出柔柔的光', 76, 590, { font: ZH(10), color: P.ink2 });
      const pr = lt > 1.3 && lt < 1.48 ? 0.94 : 1;
      ctx.save(); ctx.translate(284, 579); ctx.scale(pr, pr);
      solidPill(ctx, -46, -16, 92, 32, sold ? '已購買' : '購買 · 120', sold ? P.mintDeep : P.peach, '#fff', ZH(12));
      ctx.restore(); ctx.restore();
    }
    // coins flying + item to bag
    if (lt > 1.45 && lt < 2.4) {
      for (let i = 0; i < 6; i++) {
        const q = E.inOutCubic(clamp((lt - 1.45 - i * 0.06) / 0.55)); if (q <= 0 || q >= 1) continue;
        const x = lerp(284, 278, q) + Math.sin(q * Math.PI) * (i - 2.5) * 12, y = lerp(579, 129, q) - Math.sin(q * Math.PI) * 30;
        icon(ctx, 'coin', x, y, 10, '#F2B65E', 1.8);
      }
    }
    const toast = clamp((lt - 1.9) / 0.3) * clamp((3.2 - lt) / 0.3);
    if (toast > 0) { ctx.save(); ctx.globalAlpha = toast; pill(ctx, 112, 498 - toast * 6, 136, 28, '', {}); icon(ctx, 'check', 132, 506 - toast * 6 + 6, 13, P.mintDeep, 2.4); text(ctx, '已放入背包', 190, 512.5 - toast * 6, { font: ZH(11), color: P.ink, align: 'center', base: 'middle' }); ctx.restore(); }
    roundBtn(ctx, 30, 50, 15, 'back', { is: 15 });
    statusBar(ctx, '10:52', P.ink);
    touch(ctx, finger([{ t: 0.25, x: 140, y: 380 }, { t: 0.5, x: 98, y: 290 }, { t: 0.55, x: 98, y: 290, down: true }, { t: 0.7, x: 98, y: 290 }, { t: 1.2, x: 284, y: 579 }, { t: 1.3, x: 284, y: 579, down: true }, { t: 1.48, x: 284, y: 579 }], lt));
  }

  // ---------------- 9. STUDIO ----------------
  const DOODLE = (() => { const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40; pts.push([250 + Math.sin(a * Math.PI * 2) * 14 + a * 22, 150 - a * 34 + Math.cos(a * Math.PI * 2) * 8]); } return pts; })();
  function studio(ctx, lt, t) {
    dp(ctx); bg(ctx, '#FBF4F2', '#EFE8F4');
    header(ctx, '動畫工坊', { sub: '耳朵揮揮 · 8 fps' });
    solidPill(ctx, 282, 38, 62, 25, '匯出', P.lav, '#fff', ZH(11));
    // tool rail
    frost(ctx, 12, 112, 38, 214, 19);
    ['brush', 'eraser', 'onion', 'layers'].forEach((n, i) => {
      if (i === 0) { ctx.beginPath(); ctx.arc(31, 136 + i * 42, 14, 0, TAU); ctx.fillStyle = P.peachSoft; ctx.fill(); }
      icon(ctx, n, 31, 136 + i * 42, 16, i === 0 ? P.coral : P.ink2);
    });
    ctx.beginPath(); ctx.arc(31, 302, 9, 0, TAU); ctx.fillStyle = P.peach; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    // canvas board
    const playing = lt > 2.35;
    const frames = lt > 1.75 ? 7 : 6;
    const curF = playing ? Math.floor((lt - 2.35) * 8) % frames : frames - 1;
    softShadow(ctx, 196, 340, 140, 14, 0.12);
    rr(ctx, 60, 104, 288, 236, 22); ctx.fillStyle = '#FFFEFB'; ctx.fill();
    ctx.save(); rr(ctx, 60, 104, 288, 236, 22); ctx.clip();
    ctx.strokeStyle = 'rgba(200,180,190,0.18)'; ctx.lineWidth = 0.6;
    for (let x = 60; x < 350; x += 16) { ctx.beginPath(); ctx.moveTo(x, 104); ctx.lineTo(x, 340); ctx.stroke(); }
    for (let y = 104; y < 340; y += 16) { ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(350, y); ctx.stroke(); }
    const earFor = (k) => [0, 0.25, 0.5, 0.6, 0.45, 0.2, 0.05][k % 7];
    // onion skin (previous frame)
    if (!playing) { ctx.save(); ctx.globalAlpha = 0.28; C.draw(ctx, Object.assign({}, C.DESIGNS.mochi, { fur: '#D9CCF4', shade: '#BFAEEA' }), { earR: earFor(curF - 1) * 1.2, armR: -earFor(curF - 1) * 3, eyes: 'round', noShadow: true }, 202, 318, 3.4, t); ctx.restore(); }
    C.draw(ctx, 'mochi', { earR: earFor(curF) * 1.2, armR: -earFor(curF) * 3, eyes: curF % 7 > 2 ? 'happy' : 'round', mouth: curF % 7 > 2 ? 'smile' : 'cat', breath: 0 }, 202, 318, 3.4, t);
    // user doodle stroke
    const dp2 = playing ? 1 : clamp((lt - 0.35) / 1.0);
    if (dp2 > 0) {
      ctx.strokeStyle = P.coral; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); const n = Math.floor(DOODLE.length * dp2);
      for (let i = 0; i < n; i++) { const [x, y] = DOODLE[i]; const jx = playing ? Math.sin(curF * 2 + i) * 0.6 : 0; i ? ctx.lineTo(x + jx, y) : ctx.moveTo(x + jx, y); }
      ctx.stroke();
      if (dp2 >= 1) { OC.M.icon(ctx, 'heart', 290 + (playing ? Math.sin(curF) * 2 : 0), 108 + 0, 12, P.berry); }
    }
    ctx.restore();
    frost(ctx, 274, 112, 66, 20, 10); text(ctx, `${curF + 1} / ${frames}`, 307, 122.5, { font: FONT(600, 10), color: P.ink2, align: 'center', base: 'middle' });
    // timeline
    frost(ctx, 12, 356, 336, 132, 24);
    text(ctx, '時間軸', 28, 380, { font: ZH(12), color: P.ink });
    pill(ctx, 230, 367, 52, 20, '8 fps', { font: FONT(600, 9.5) });
    const pr = lt > 2.25 && lt < 2.4 ? 0.9 : 1;
    roundBtn(ctx, 316, 377, 14, playing ? 'pause' : 'play', { scale: pr, ic: P.coral, is: 13 });
    for (let i = 0; i < frames; i++) {
      const slide = i === 6 ? E.outBack(clamp((lt - 1.75) / 0.35), 1.4) : 1;
      const x = 26 + i * 44, y = 398;
      ctx.save(); ctx.globalAlpha = slide; ctx.translate(x + 19, y + 26); ctx.scale(slide, slide); ctx.translate(-x - 19, -y - 26);
      rr(ctx, x, y, 38, 52, 10); ctx.fillStyle = i === curF ? '#FFF0EA' : '#FBF7F5'; ctx.fill();
      if (i === curF) { ctx.strokeStyle = P.peach; ctx.lineWidth = 2; rr(ctx, x, y, 38, 52, 10); ctx.stroke(); }
      ctx.save(); rr(ctx, x, y, 38, 52, 10); ctx.clip();
      C.draw(ctx, 'mochi', { earR: earFor(i) * 1.2, armR: -earFor(i) * 3, noShadow: true }, x + 19, y + 47, 0.75, 0);
      ctx.restore();
      text(ctx, String(i + 1), x + 19, y + 64, { font: FONT(500, 8.5), color: P.ink3, align: 'center' });
      ctx.restore();
    }
    if (frames < 7 || lt < 2.1) { const x = 26 + frames * 44; rr(ctx, x, 398, 30, 52, 10); ctx.strokeStyle = P.ink3; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); icon(ctx, 'plus', x + 15, 424, 13, P.ink2); }
    // layers card
    frost(ctx, 12, 500, 336, 100, 24);
    text(ctx, '圖層', 28, 524, { font: ZH(12), color: P.ink });
    ['特效', '角色線稿', '上色', '背景'].forEach((n, i) => {
      const y = 538 + i * 0 , x = 28 + i * 80;
      rr(ctx, x, 538, 72, 46, 14); ctx.fillStyle = i === 0 ? '#FFF0EA' : '#FBF7F5'; ctx.fill();
      text(ctx, n, x + 36, 568, { font: ZH(10), color: i === 0 ? P.coral : P.ink2, align: 'center' });
      icon(ctx, i === 0 ? 'sparkle' : i === 1 ? 'brush' : i === 2 ? 'face' : 'leaf', x + 36, 552, 11, i === 0 ? P.coral : P.ink3);
    });
    statusBar(ctx, '11:03', P.ink);
    touch(ctx, finger([{ t: 0.15, x: 230, y: 200 }, ...DOODLE.filter((_, i) => i % 4 === 0).map((p, i) => ({ t: 0.35 + i * 0.1, x: p[0], y: p[1], down: true })), { t: 1.45, x: 272, y: 116 }, { t: 1.62, x: 293, y: 424 }, { t: 1.7, x: 293, y: 424, down: true }, { t: 1.85, x: 293, y: 424 }, { t: 2.18, x: 316, y: 377 }, { t: 2.25, x: 316, y: 377, down: true }, { t: 2.4, x: 316, y: 377 }], lt));
  }

  // ---------------- 10. FLOATING PET (visual mock) ----------------
  const APPS = [['chat', '#BFE4CF', '訊息'], ['face', '#FBD9CC', '相機'], ['play', '#E9E1F8', '音樂'], ['map', '#D7EAF6', '地圖'], ['clock', '#FDF0CC', '時鐘'], ['leaf', '#DDF0E4', '相簿'], ['gear', '#EEE7EA', '設定'], ['paw', '#F5A893', 'OC Shimeji']];
  function petPose(lt) {
    // returns {x,y, state}
    const jump = clamp((lt - 0.25) / 0.6);
    if (lt < 0.85) {
      const x = lerp(292, 262, jump), y = lerp(386, 512, jump) - Math.sin(jump * Math.PI) * 60;
      return { x, y, mode: 'jump', q: jump };
    }
    if (lt < 2.05) { const w = walkPath([{ t: 1.0, x: 262, y: 512 }, { t: 2.0, x: 150, y: 512 }], lt, 11); return { x: w.x, y: w.y, mode: 'walk', w }; }
    if (lt < 3.35) return { mode: 'drag' };
    const fall = clamp((lt - 3.35) / 0.25);
    return { x: 236, y: lerp(232, 248, E.inQuad(fall)), mode: lt < 3.6 ? 'fall' : 'sit' };
  }
  function pet(ctx, lt, t) {
    dp(ctx);
    // wallpaper
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#9A9AD6'); g.addColorStop(0.55, '#D3B5D8'); g.addColorStop(1, '#F6C9BD');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.globalAlpha = 0.5; Wd.cloud(ctx, ((t * 4 + i * 90) % 480) - 80, 300 + i * 60, 0.8 + (i % 3) * 0.3); ctx.restore(); }
    const r = rng(8); for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.max(0, Math.sin(t * 2 + i))})`; ellipse(ctx, r() * 360, r() * 260, 0.9, 0.9); ctx.fill(); }
    // clock widget
    rr(ctx, 26, 118, 308, 130, 30); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
    text(ctx, '21:42', 50, 190, { font: FONT(600, 52), color: '#fff' });
    text(ctx, '11月3日 星期二', 52, 220, { font: ZH(12), color: 'rgba(255,255,255,.9)' });
    icon(ctx, 'moon', 290, 150, 22, '#fff', 2); text(ctx, '18°', 300, 186, { font: FONT(600, 15), color: '#fff', align: 'right' });
    // app grid
    APPS.forEach((a, i) => {
      const x = 52 + (i % 4) * 85, y = 300 + Math.floor(i / 4) * 86;
      rr(ctx, x - 24, y - 24, 48, 48, 15); ctx.fillStyle = rgba(a[1], i === 7 ? 1 : 0.92); ctx.fill();
      icon(ctx, a[0], x, y, 22, i === 7 ? '#fff' : P.ink, 2);
      text(ctx, a[2], x, y + 38, { font: ZH(9.5), color: '#fff', align: 'center' });
    });
    // dock
    rr(ctx, 20, 520, 320, 70, 28); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
    ['chat', 'face', 'play', 'gear'].forEach((n, i) => { const x = 62 + i * 79; rr(ctx, x - 22, 533, 44, 44, 14); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill(); icon(ctx, n, x, 555, 20, P.ink, 2); });
    // status bar
    statusBar(ctx, '21:42', '#fff');
    // the pet
    const pp = petPose(lt);
    const f = finger([{ t: 1.75, x: 120, y: 420 }, { t: 2.05, x: 150, y: 492 }, { t: 2.12, x: 150, y: 492, down: true }, { t: 2.35, x: 150, y: 486, down: true }, { t: 2.85, x: 210, y: 330, down: true }, { t: 3.3, x: 236, y: 212, down: true }, { t: 3.35, x: 236, y: 212 }], lt);
    let px, py, s, swing = 0;
    if (pp.mode === 'drag') {
      const fp = f || { x: 236, y: 212 };
      const lag = finger([{ t: 2.12, x: 150, y: 492, down: true }, { t: 2.35, x: 150, y: 486, down: true }, { t: 2.85, x: 210, y: 330, down: true }, { t: 3.3, x: 236, y: 212, down: true }], lt - 0.12) || fp;
      swing = clamp((fp.x - lag.x) * 0.06, -0.6, 0.6) + Math.sin(lt * 9) * 0.06;
      const pick = E.outBack(clamp((lt - 2.12) / 0.2), 1.6);
      px = fp.x; py = fp.y + 20 + (1 - pick) * 0;
      s = idle(t, 1, { eyes: 'wide', mouth: 'o', walk: 1, phase: lt * 7, armL: -2.6, armR: -2.6, ear: 0.25, earL: Math.sin(lt * 12) * 0.2, earR: Math.sin(lt * 12 + 1) * 0.2, noShadow: true, tail: Math.sin(lt * 14) * 0.5, brows: 'up' });
      ctx.save(); ctx.translate(px, py - 46); ctx.rotate(swing); ctx.translate(-px, -(py - 46));
      C.draw(ctx, 'mochi', s, px, py + 2, 1.05, t);
      ctx.restore();
    } else {
      px = pp.x; py = pp.y;
      if (pp.mode === 'jump') s = idle(t, 1, { squash: 1 + Math.sin(pp.q * Math.PI) * 0.1 - (pp.q > 0.95 ? 0.1 : 0), eyes: 'happy', mouth: 'open', armL: -2, armR: -2, earL: -0.3, earR: -0.3, noShadow: pp.q < 0.9 });
      else if (pp.mode === 'walk') s = idle(t, 1, { face: -0.85, walk: pp.w.moving ? 1 : 0, phase: pp.w.phase, squash: 1 - wobble(lt - 0.85, 2.4, 6) * 0.12, earL: wobble(lt - 0.85, 3, 5) * 0.4, earR: wobble(lt - 0.87, 3, 5) * 0.4 });
      else {
        const lt2 = lt - 3.6;
        const yawn = lt2 > 0.75 && lt2 < 1.25;
        s = idle(t, 1, { squash: 1 - wobble(lt2, 2.4, 5) * 0.14, eyes: yawn ? 'happy' : lt2 > 1.25 ? 'sleepy' : 'happy', mouth: yawn ? 'open' : 'cat', earL: wobble(lt2, 3, 4) * 0.5, earR: wobble(lt2 - 0.04, 3, 4) * 0.5, blush: 1, tail: Math.sin(t * 2) * 0.3 });
      }
      C.draw(ctx, 'mochi', s, px, py, 1.05, t);
      if (pp.mode === 'sit' && lt > 3.9) {
        const ba = clamp((lt - 3.9) / 0.25);
        ctx.save(); ctx.globalAlpha = ba; frost(ctx, px - 92, py - 92, 98, 30, 15); text(ctx, '一起休息一下吧～', px - 43, py - 76.5, { font: ZH(10), color: P.ink, align: 'center', base: 'middle' }); ctx.restore();
      }
    }
    // visual-mock disclaimer (always on during this shot)
    pill(ctx, 64, 30, 232, 24, '', { alpha: 0.95 });
    ctx.beginPath(); ctx.arc(82, 42, 4, 0, TAU); ctx.fillStyle = P.peach; ctx.fill();
    text(ctx, 'Android 懸浮桌寵 · 視覺模擬（未實機驗證）', 186, 42.5, { font: ZH(9.5), color: P.ink, align: 'center', base: 'middle' });
    touch(ctx, f);
  }

  // ---------------- 11. END ----------------
  function end(ctx, lt, t) {
    dp(ctx); bg(ctx, '#FFF5EE', '#EADFF5'); bokeh(ctx, t, 8, 2);
    const a = E.outCubic(clamp(lt / 0.5));
    ctx.save(); ctx.globalAlpha = a;
    C.draw(ctx, 'mochi', idle(t, 1, { eyes: 'happy', mouth: 'smile', armR: -2.2 + Math.sin(t * 9) * 0.35 }), 132, 312, 1.6, t);
    C.draw(ctx, 'kuri', idle(t, 2, { face: -0.3, eyes: 'round' }), 192, 318, 1.4, t);
    C.draw(ctx, 'sora', idle(t, 3, { face: -0.4, eyes: 'sleepy' }), 244, 322, 1.3, t);
    text(ctx, '方案 A', 180, 380, { font: ZH(13), color: P.coral, align: 'center', ls: 4 });
    text(ctx, '棉霧島', 180, 420, { font: ZH(32), color: P.ink, align: 'center', ls: 6 });
    text(ctx, 'Mallow Mist', 180, 446, { font: FONT(600, 14), color: P.ink2, align: 'center', ls: 3 });
    text(ctx, '柔霧黏土 · 漂浮極簡 HUD · 慢節奏彈性動畫', 180, 480, { font: ZH(11), color: P.ink2, align: 'center' });
    ctx.restore();
  }

  // ---------------- transitions & overlays ----------------
  function transition(ctx, A, B, p, from, to) {
    const q = E.inOutCubic(p);
    ctx.save();
    if (from === 'logo') {
      // mist bloom: logo dissolves into a soft white cloud, island emerges from it
      ctx.drawImage(B, 0, 0);
      ctx.globalAlpha = 1 - q; ctx.translate(540, 900); ctx.scale(1 + q * 0.15, 1 + q * 0.15); ctx.translate(-540, -900); ctx.drawImage(A, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const m = Math.sin(p * Math.PI); ctx.globalAlpha = m * 0.55; ctx.fillStyle = '#FFF8F4'; ctx.fillRect(0, 0, OC.W, OC.H);
    } else {
      // soft lift: outgoing recedes (scale .96, fade), incoming rises 24px with fade
      ctx.globalAlpha = 1; ctx.save(); ctx.translate(540, 960); ctx.scale(1 - q * 0.04, 1 - q * 0.04); ctx.translate(-540, -960); ctx.drawImage(A, 0, 0); ctx.restore();
      ctx.globalAlpha = q; ctx.drawImage(B, 0, (1 - q) * 72);
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.25; ctx.fillStyle = '#FFF8F4'; ctx.fillRect(0, 0, OC.W, OC.H);
    }
    ctx.restore();
  }
  function chapter(ctx, s, a, idx) {
    if (s.id === 'pet' || s.id === 'end' || s.id === 'logo') return;
    ctx.scale(OC.DP, OC.DP);
    ctx.globalAlpha = a * 0.9;
    const label = `${String(idx).padStart(2, '0')}  ${s.zh}`;
    ctx.font = ZH(8.5); const w = ctx.measureText(label).width + 18;
    rr(ctx, 180 - w / 2, 4, w, 15, 7.5); ctx.fillStyle = 'rgba(110,90,100,0.55)'; ctx.fill();
    text(ctx, label, 180, 12, { font: ZH(8.5), color: '#fff', align: 'center', base: 'middle' });
  }

  OC.themes.mallow = {
    id: 'mallow', name: '棉霧島 Mallow Mist', short: 'A',
    fonts: [
      { family: 'Huninn', url: 'assets/fonts/Huninn-Regular.woff', descriptors: { weight: '100 900' } },
      { family: 'Fredoka', url: 'assets/fonts/Fredoka-Medium.woff', descriptors: { weight: '500' } },
      { family: 'Fredoka', url: 'assets/fonts/Fredoka-SemiBold.woff', descriptors: { weight: '600' } },
      { family: 'Fredoka', url: 'assets/fonts/Fredoka-Bold.woff', descriptors: { weight: '700' } },
    ],
    shots: { logo, island, creator, profile, dialogue, map, inventory, shop, studio, pet, end },
    transition, chapter,
  };
})();
