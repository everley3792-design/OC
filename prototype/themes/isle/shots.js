/* Scheme E — Sunny Isle : storyboard shots */
(function () {
  'use strict';
  const { TAU, clamp, lerp, E, spring, wobble, ellipse, rr, mix, rgba, text, typewriter, finger, walkPath, rng, DATA } = OC;
  const V = OC.V, I = OC.IS, P = I.P, A = OC.ACT, Wd = OC.IS.WORLD;
  const { F, ZH, ch, panel, toy, roundToy, tag, chunky, hand, statusBar, itemE, polka } = I;
  const dp = (ctx) => ctx.scale(OC.DP, OC.DP);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const isle = (ctx, t, cam, night = 0, chars = [], towel = true) => Wd.drawIsle(ctx, { t, cam, night, chars, towel });
  const baseChars = (t) => [
    { d: 'kuri', s: A.idle(t, 2, { face: 0.55 }), x: 128, y: 482 },
    { d: 'sora', s: A.idle(t, 3, { eyes: 'sleepy', mouth: 'flat', blink: 0.6, tilt: 0.15 }), x: 300, y: 556, emote: { kind: 'zzz', p: (t * 0.35) % 1 } },
  ];
  /** letter-pop text: each glyph bounces in */
  function popText(ctx, str, x, y, p, font, col, lh = 0) {
    const chars = Array.from(str), n = chars.length * p;
    ctx.save(); ctx.font = font; let cx = x;
    chars.forEach((c, i) => { const q = clamp(n - i); if (q <= 0) return; const s = E.outBack(clamp(q * 1.6), 2.4); ctx.save(); ctx.translate(cx, y); ctx.scale(s, s); ctx.fillStyle = col; ctx.textBaseline = 'alphabetic'; ctx.fillText(c, 0, 0); ctx.restore(); cx += ctx.measureText(c).width; });
    ctx.restore();
  }

  function hud(ctx, t, o = {}) {
    const lt = o.lt ?? 9, on = (k) => E.outBack(clamp((lt - 0.3 - k * 0.12) / 0.35), 1.8), night = o.night || 0;
    let q = on(0);
    if (q > 0) { ctx.save(); ctx.translate(18, 48); ctx.scale(q, q); chunky(ctx, o.clock || '10:20', 0, 0, 24, '#fff', P.brown); panel(ctx, 0, 8, 102, 20, 10); V.icon(ctx, night > 0.55 ? 'moon' : 'sun', 12, 18, 12, night > 0.55 ? P.purple : '#FF9A3C', 2.2); text(ctx, '3月3日（三）', 22, 18.5, { font: ZH(10), color: P.brown, base: 'middle' }); ctx.restore(); }
    q = on(1);
    if (q > 0) { ctx.save(); ctx.translate(342, 40); ctx.scale(q, q); panel(ctx, -92, -14, 92, 28, 14); V.icon(ctx, 'coin', -76, 0, 15, '#F2A900', 2.4); text(ctx, fmt(o.coins ?? DATA.coins), -10, 1, { font: F(900, 13), color: P.brown, align: 'right', base: 'middle' }); ctx.restore(); }
    q = on(2);
    if (q > 0) { ctx.save(); ctx.translate(40, 594); ctx.scale(q, q); ctx.beginPath(); ctx.arc(0, 3, 23, 0, TAU); ctx.fillStyle = P.panel2; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 23, 0, TAU); ctx.fillStyle = P.cream; ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.clip(); ch(ctx, 'mochi', A.idle(t, 1, { noShadow: true }), 0, 38, 1.0, t); ctx.restore(); roundToy(ctx, 17, -15, 8, P.coral, 'heart', { is: 9, lw: 2 }); ctx.restore(); }
    q = on(3);
    if (q > 0) { ctx.save(); ctx.translate(316, 592); ctx.scale(q, q); roundToy(ctx, 0, 0, 26, P.yellow, 'phone', { pressed: o.phonePress, is: 24, lw: 2.8 }); ctx.restore(); ctx.save(); ctx.translate(264, 604); ctx.scale(q, q); roundToy(ctx, 0, 0, 19, P.teal, 'bag', { pressed: o.bagPress, is: 19, lw: 2.6 }); ctx.restore(); }
  }

  // ---------------- 1. LOGO ----------------
  function logo(ctx, lt, t) {
    dp(ctx);
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#6FD3F5'); g.addColorStop(1, '#B9ECFA'); ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    ctx.save(); ctx.translate(180, 250); ctx.rotate(t * 0.08); for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); if (i % 2) continue; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-90, -600); ctx.lineTo(90, -600); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill(); } ctx.restore();
    for (let i = 0; i < 4; i++) { const x = ((t * (6 + i * 2) + i * 120) % 520) - 100, y = 80 + i * 90; ctx.fillStyle = '#fff'; for (const [dx, dy, r] of [[0, 0, 14], [16, -6, 18], [34, 0, 13]]) { ellipse(ctx, x + dx, y + dy, r, r * 0.8); ctx.fill(); } }
    // island bobbing below
    ctx.save(); ctx.translate(0, 330 + Math.sin(t * 1.5) * 3); ctx.beginPath(); ctx.rect(0, 0, 360, 310); ctx.clip(); ctx.translate(0, -60); isle(ctx, t, { x: 200, y: 400, z: 0.62 }, 0, [], true); ctx.restore();
    const g2 = ctx.createLinearGradient(0, 300, 0, 380); g2.addColorStop(0, '#B9ECFA'); g2.addColorStop(1, 'rgba(185,236,250,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 300, 360, 80);
    // title: letters bounce in
    const word = 'OC Shimeji';
    ctx.save(); ctx.font = F(900, 46); const w = ctx.measureText(word).width; let x = 180 - w / 2; ctx.restore();
    [...word].forEach((c, i) => { const q = clamp((lt - 0.2 - i * 0.07) / 0.45); if (q <= 0) { ctx.font = F(900, 46); x += ctx.measureText(c).width; return; } const s = E.outBack(q, 2.6), bob = Math.sin(t * 3 + i * 0.6) * 2 * clamp(lt - 1.2); ctx.save(); ctx.translate(x, 210 + bob); ctx.scale(s, s); chunky(ctx, c, 0, 0, 46, ['#fff', '#FFE36E', '#fff', '#fff', '#FFB3C7', '#fff', '#9EF0D8', '#fff', '#fff', '#FFE36E'][i], P.brown); ctx.restore(); ctx.font = F(900, 46); x += ctx.measureText(c).width; });
    const sq = E.outBack(clamp((lt - 1.1) / 0.35), 2);
    if (sq > 0) { ctx.save(); ctx.translate(180, 244); ctx.scale(sq, sq); panel(ctx, -100, -14, 200, 28, 14); text(ctx, '我的 OC，住進你的手機', 0, 0.5, { font: ZH(13), color: P.brown, align: 'center', base: 'middle' }); ctx.restore(); }
    const pk = lt - 1.3;
    if (pk > 0) { const rise = spring(pk, 1.8, 5.5); ch(ctx, 'mochi', A.idle(t, 1, { eyes: lt > 1.9 ? 'happy' : 'round', mouth: lt > 1.9 ? 'grin' : 'cat', armR: lt > 1.9 ? -2.3 + Math.sin(lt * 10) * 0.35 : undefined, earL: wobble(pk - 0.25, 3, 5) * 0.5, earR: wobble(pk - 0.3, 3, 5) * 0.5 }), 180, 400 - rise * 40, 2.0, t); }
    if (lt > 1.8) { const b = 0.94 + Math.sin(t * 5) * 0.06; ctx.save(); ctx.translate(180, 560); ctx.scale(b, b); toy(ctx, -64, -16, 128, 32, P.coral, '開始玩！', { font: ZH(14) }); ctx.restore(); }
  }

  // ---------------- 2. ISLAND ----------------
  const WALK = [{ t: 0.9, x: 182, y: 398 }, { t: 2.7, x: 232, y: 452 }];
  function island(ctx, lt, t) {
    dp(ctx);
    const night = E.inOutSine(clamp((lt - 3.7) / 2.1)), m = A.island(lt, t, WALK), z = E.inOutCubic(clamp((lt + 0.2) / 2.6));
    isle(ctx, t, { x: lerp(200, m.x - 10, z * 0.75), y: lerp(405, m.y - 10, z * 0.7), z: lerp(0.8, 1.25, z) }, night, [{ d: 'mochi', s: m.s, x: m.x, y: m.y, emote: m.emote }, ...baseChars(t)]);
    const mins = lerp(620, 1265, night), clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
    hud(ctx, t, { lt, night, clock });
    statusBar(ctx, clock, night > 0.6 ? '#fff' : P.brown);
  }

  // ---------------- 3. CREATOR ----------------
  const EYES = ['round', 'sparkle', 'happy', 'sleepy', 'wide', 'dot', 'round', 'sleepy'];
  const EARS = ['cat', 'bunny', 'bear', 'fold', 'sprout', 'round', 'cat', 'bunny'];
  const SW = ['#FFF7EC', '#FFD9C9', '#DDE0FF', '#CDEFE6', '#FFF0A8', '#E7A86A'];
  function creator(ctx, lt, t) {
    dp(ctx); polka(ctx, '#FFE38A', '#FFD458', t);
    const f = finger([{ t: 0.5, x: 230, y: 600 }, { t: 0.82, x: 118, y: 492 }, { t: 0.9, x: 118, y: 492, down: true }, { t: 1.05, x: 118, y: 492 }, { t: 1.45, x: 238, y: 432 }, { t: 1.55, x: 238, y: 432, down: true }, { t: 1.7, x: 238, y: 432 }, { t: 2.1, x: 118, y: 492 }, { t: 2.2, x: 118, y: 492, down: true }, { t: 2.35, x: 118, y: 492 }, { t: 2.75, x: 110, y: 608 }, { t: 2.85, x: 110, y: 608, down: true }, { t: 3.0, x: 110, y: 608 }, { t: 3.4, x: 140, y: 250 }, { t: 3.5, x: 140, y: 250, down: true }, { t: 4.15, x: 240, y: 256, down: true }, { t: 4.25, x: 240, y: 256 }], lt);
    const tab = lt < 1.6 ? 0 : 4, eye = lt > 0.95 ? 1 : 0, ear = lt > 2.25 ? 1 : 0, colP = E.inOutCubic(clamp((lt - 2.85) / 0.35));
    const drag = clamp((lt - 3.5) / 0.65), face = lt < 4.15 ? E.inOutSine(drag) * 0.9 : 0.9 * (1 - spring(lt - 4.15, 1.3, 5));
    tag(ctx, 92, 48, '打扮鏡', P.teal, -0.06);
    toy(ctx, 268, 34, 76, 30, P.green, '完成', { font: ZH(13), icon: 'check', is: 13 });
    // mirror
    ctx.save(); ctx.beginPath(); ctx.arc(180, 238, 128, 0, TAU); ctx.fillStyle = '#B07E4B'; ctx.fill(); ctx.beginPath(); ctx.arc(180, 234, 128, 0, TAU); ctx.fillStyle = P.wood; ctx.fill();
    ctx.beginPath(); ctx.arc(180, 234, 114, 0, TAU); const mg = ctx.createLinearGradient(0, 120, 0, 350); mg.addColorStop(0, '#E6FAFF'); mg.addColorStop(1, '#BFEAF5'); ctx.fillStyle = mg; ctx.fill(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(90, 160); ctx.lineTo(130, 130); ctx.lineTo(100, 280); ctx.lineTo(80, 290); ctx.closePath(); ctx.fill();
    const D = Object.assign({}, I.DES.mochi, { fur: mix('#FFF7EC', SW[2], colP), shade: mix('#EBD5C0', '#B9BEEA', colP) });
    const pop = (lt > 0.95 && lt < 1.4) || (lt > 2.25 && lt < 2.7);
    ch(ctx, D, A.idle(t, 1, { face, eyes: pop ? 'happy' : EYES[eye], mouth: pop ? 'grin' : 'cat', ears: EARS[ear], squash: 1 + wobble(lt - 0.95, 2.5, 5) * 0.08 + wobble(lt - 2.25, 2.5, 5) * 0.08, earL: wobble(lt - 2.25, 2.8, 4) * 0.6, earR: wobble(lt - 2.3, 2.8, 4) * 0.6 }), 180, 330, 3.3, t);
    ctx.restore();
    if (pop) for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + lt * 2; V.icon(ctx, 'sparkle', 180 + Math.cos(a) * 92, 230 + Math.sin(a) * 92, 12, '#fff'); }
    // panel
    panel(ctx, 10, 396, 340, 250, 26);
    const cats = [['face', P.coral], ['brush', P.yellow], ['chat', P.pink], ['heart', P.purple], ['paw', P.teal], ['sparkle', P.blue]];
    cats.forEach(([ic, c], i) => { const x = 42 + i * 55, on = i === tab; roundToy(ctx, x, 432 - (on ? 3 : 0), on ? 20 : 16, on ? c : '#E8D9B8', ic, { is: on ? 18 : 15, ic: on ? '#fff' : P.brown2 }); });
    const swap = clamp((lt - 1.6) / 0.25);
    for (let i = 0; i < 8; i++) {
      const cx = 52 + (i % 4) * 85, cy = 492 + Math.floor(i / 4) * 66, sel = tab === 0 ? i === eye : i === ear;
      const bounce = sel ? wobble(lt - (tab === 0 ? 0.95 : 2.25), 3, 5) * 0.12 : 0;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + bounce, 1 + bounce); ctx.translate(-cx, -cy);
      rr(ctx, cx - 36, cy - 28 + 3, 72, 58, 16); ctx.fillStyle = sel ? '#E8A800' : P.panel2; ctx.fill();
      rr(ctx, cx - 36, cy - 28, 72, 58, 16); ctx.fillStyle = sel ? '#FFF1B8' : '#FFFFFF'; ctx.fill();
      if (sel) { ctx.lineWidth = 3; ctx.strokeStyle = P.yellow; ctx.stroke(); }
      ctx.save(); rr(ctx, cx - 36, cy - 28, 72, 58, 16); ctx.clip();
      const mk = (mode, a) => { ctx.globalAlpha = a; ch(ctx, 'mochi', mode === 0 ? { eyes: EYES[i], noShadow: true } : { ears: EARS[i], noShadow: true }, cx, cy + (mode === 0 ? 60 : 72), mode === 0 ? 1.8 : 1.35, t); };
      if (swap < 1) mk(0, 1 - swap); if (swap > 0) mk(1, swap);
      ctx.restore(); ctx.restore();
      if (sel) roundToy(ctx, cx + 30, cy - 24, 9, P.green, 'check', { is: 11, lw: 3 });
    }
    SW.forEach((c, i) => { const x = 46 + i * 50, y = 606, sel = (colP > 0.5 ? 2 : 0) === i; ctx.beginPath(); ctx.arc(x, y + 3, 15, 0, TAU); ctx.fillStyle = 'rgba(90,60,30,0.2)'; ctx.fill(); ctx.beginPath(); ctx.arc(x, y - (sel ? 3 : 0), 15, 0, TAU); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = sel ? 4 : 2; ctx.strokeStyle = sel ? P.yellow : '#fff'; ctx.stroke(); });
    statusBar(ctx, '10:24');
    hand(ctx, f);
  }

  // ---------------- 4. PROFILE ----------------
  function pillBar(ctx, x, y, w, v, col, ic, label) {
    roundToy(ctx, x, y, 12, col, ic, { is: 13, lw: 2.4 });
    text(ctx, label, x + 20, y + 4, { font: ZH(12), color: P.brown });
    rr(ctx, x + 60, y - 6, w, 12, 6); ctx.fillStyle = '#F1E2C2'; ctx.fill();
    rr(ctx, x + 60, y - 6, Math.max(12, w * v), 12, 6); ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 0.4; rr(ctx, x + 64, y - 4.5, Math.max(4, w * v - 8), 3.5, 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1;
  }
  function profile(ctx, lt, t) {
    dp(ctx); polka(ctx, '#A9E6F2', '#93DCEB', t);
    tag(ctx, 96, 48, '島民卡', P.coral, -0.05);
    panel(ctx, 14, 72, 332, 214, 24);
    rr(ctx, 14, 72, 332, 34, 24); ctx.fillStyle = P.teal; ctx.fill(); ctx.fillRect(14, 90, 332, 16);
    text(ctx, 'RESIDENT CARD', 32, 94, { font: F(900, 12), color: '#fff', ls: 2 }); V.icon(ctx, 'leaf', 322, 89, 16, '#fff', 2.4);
    // photo
    rr(ctx, 30, 120, 112, 132, 10); ctx.fillStyle = '#fff'; ctx.fill(); rr(ctx, 36, 126, 100, 100, 6); ctx.fillStyle = '#BFEAF5'; ctx.fill();
    ctx.save(); rr(ctx, 36, 126, 100, 100, 6); ctx.clip(); ctx.fillStyle = '#8FD86A'; ctx.fillRect(36, 200, 100, 30); ch(ctx, 'mochi', A.idle(t, 1, { eyes: lt > 3.3 ? 'happy' : 'round', mouth: lt > 3.3 ? 'grin' : 'cat' }), 86, 222, 2.0, t); ctx.restore();
    text(ctx, 'Mochi', 86, 243, { font: F(900, 12), color: P.brown2, align: 'center' });
    chunky(ctx, '麻糬', 156, 146, 24, '#fff', P.brown, { font: `900 24px Huninn, Nunito` });
    const row = (k, v, y) => { text(ctx, k, 158, y, { font: ZH(10.5), color: P.brown2 }); text(ctx, v, 214, y, { font: ZH(12), color: P.brown }); ctx.strokeStyle = '#EAD7AE'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(158, y + 6); ctx.lineTo(332, y + 6); ctx.stroke(); ctx.setLineDash([]); };
    row('生日', '春 3 日', 172); row('個性', '悠閒・好奇', 196); row('口頭禪', '「軟軟的～」', 220);
    DATA.traits.slice(0, 3).forEach((tr, i) => { const q = E.outBack(clamp((lt - 0.3 - i * 0.12) / 0.35), 2); if (q <= 0) return; const w = I.textW(ctx, tr, ZH(10)) + 16, x = 158 + [0, 74, 0][i] + (i === 2 ? 0 : 0), y = i === 2 ? 254 : 236; ctx.save(); ctx.translate(x + w / 2, y + 9); ctx.scale(q, q); rr(ctx, -w / 2, -9, w, 18, 9); ctx.fillStyle = [P.pink, P.purple, P.green][i]; ctx.fill(); text(ctx, tr, 0, 0.5, { font: ZH(10), color: '#fff', align: 'center', base: 'middle' }); ctx.restore(); });
    // needs
    panel(ctx, 14, 300, 332, 172, 24);
    text(ctx, '今天的狀態', 32, 326, { font: ZH(14), color: P.brown });
    text(ctx, '在散步中 ♪', 330, 326, { font: ZH(11), color: P.teal, align: 'right' });
    const cols = [P.coral, P.yellow, P.pink, P.blue, P.green], ics = ['heart', 'sun', 'face', 'chat', 'sparkle'];
    DATA.needs.forEach((n, i) => pillBar(ctx, 40, 350 + i * 25, 210, n.v * E.outCubic(clamp((lt - 0.4 - i * 0.1) / 0.7)), cols[i], ics[i], n.zh));
    // friends
    panel(ctx, 14, 486, 332, 124, 24);
    text(ctx, '好朋友', 32, 512, { font: ZH(14), color: P.brown });
    DATA.relations.forEach((r, i) => {
      const x = 36 + i * 154, y = 526, wig = i === 0 && lt > 3.2 ? wobble(lt - 3.2, 4, 5) * 0.12 : 0;
      ctx.save(); ctx.translate(x + 66, y + 32); ctx.rotate(wig); ctx.translate(-x - 66, -y - 32);
      rr(ctx, x, y, 132, 64, 16); ctx.fillStyle = i === 0 ? '#FFF1B8' : '#fff'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(x + 30, y + 32, 22, 0, TAU); ctx.fillStyle = '#BFEAF5'; ctx.fill(); ctx.clip(); ch(ctx, r.who, A.idle(t, 4 + i, { noShadow: true }), x + 30, y + 70, 1.1, t); ctx.restore();
      text(ctx, DATA.cast[r.who].zh, x + 60, y + 28, { font: ZH(13), color: P.brown });
      for (let h = 0; h < 5; h++) V.icon(ctx, h < r.hearts ? 'heart' : 'heartO', x + 64 + h * 13, y + 46, 11, h < r.hearts ? P.coral : '#D9C49A', 2);
      ctx.restore();
    });
    statusBar(ctx, '10:26');
    hand(ctx, finger([{ t: 2.9, x: 220, y: 450 }, { t: 3.12, x: 100, y: 560 }, { t: 3.2, x: 100, y: 560, down: true }, { t: 3.36, x: 100, y: 560 }], lt));
  }

  // ---------------- 5. DIALOGUE ----------------
  function bubble(ctx, name, str, p, a, col = P.coral) {
    if (a <= 0) return;
    const s = E.outBack(clamp(a), 1.8);
    ctx.save(); ctx.translate(180, 548); ctx.scale(s, s); ctx.translate(-180, -548);
    ctx.beginPath(); for (let i = 0; i <= 40; i++) { const an = (i / 40) * TAU; const k = 1 + Math.sin(an * 6 + 0.5) * 0.015; ctx.lineTo(180 + Math.cos(an) * 166 * k, 548 + Math.sin(an) * 52 * k); } ctx.closePath();
    ctx.fillStyle = 'rgba(90,60,30,0.18)'; ctx.save(); ctx.translate(0, 5); ctx.fill(); ctx.restore(); ctx.fillStyle = P.cream; ctx.fill();
    tag(ctx, 72, 500, name, col, -0.08);
    popText(ctx, str, 44, 556, p, ZH(15), P.brown);
    if (p >= 1) { const by = 584 + Math.abs(Math.sin(OC._t * 5)) * -3; ctx.beginPath(); ctx.moveTo(174, by); ctx.lineTo(186, by); ctx.lineTo(180, by + 7); ctx.closePath(); ctx.fillStyle = P.coral; ctx.fill(); }
    ctx.restore();
  }
  function dialogue(ctx, lt, t) {
    dp(ctx); OC._t = t;
    const D = A.dialogue(lt, t, [232, 486], [188, 484]);
    isle(ctx, t, { x: 168, y: 460, z: lerp(2.0, 2.12, E.inOutSine(clamp(lt / 5))) }, 0, [{ d: 'mochi', s: D.mochi, x: 142, y: 486 }, { d: 'kuri', s: D.kuri, x: D.kx, y: D.ky, emote: D.emote }]);
    if (lt > 3.2 && lt < 4.0) { ctx.save(); ctx.globalAlpha = clamp((4.0 - lt) / 0.3); chunky(ctx, '哇！', 268, 210 - E.outBack(clamp((lt - 3.2) / 0.3)) * 10, 26, '#fff', P.coral); ctx.restore(); }
    const a1 = clamp((lt - 0.95) / 0.25) * (1 - clamp((lt - 2.75) / 0.2));
    if (a1 > 0) bubble(ctx, '栗子', DATA.dialogue.a, clamp((lt - 1.05) / 1.0), a1, P.yellow);
    const a2 = clamp((lt - 3.75) / 0.25);
    if (a2 > 0) bubble(ctx, '栗子', DATA.dialogue.b, clamp((lt - 3.85) / 0.7), a2, P.yellow);
    const ca = clamp((lt - 2.15) / 0.25) * (1 - clamp((lt - 3.0) / 0.2));
    if (ca > 0) DATA.dialogue.choices.forEach((c, i) => { const q = E.outBack(clamp((lt - 2.15 - i * 0.08) / 0.3), 2); const y = 452 + i * 50; ctx.save(); ctx.globalAlpha = ca; ctx.translate(250, y + 18); ctx.scale(q, q); ctx.translate(-250, -(y + 18)); panel(ctx, 150, y, 196, 38, 19, i === 0 && lt > 2.75 ? '#FFF1B8' : P.cream); text(ctx, c, 248, y + 20, { font: ZH(13.5), color: P.brown, align: 'center', base: 'middle' }); ctx.restore(); });
    statusBar(ctx, '10:32');
    hand(ctx, finger([{ t: 2.4, x: 300, y: 560 }, { t: 2.65, x: 262, y: 472 }, { t: 2.72, x: 262, y: 472, down: true }, { t: 2.88, x: 262, y: 472 }], lt));
  }

  // ---------------- 6. MAP (phone app → map → iris travel) ----------------
  const APPS9 = [['map', '地圖', P.green], ['camera', '相機', P.coral], ['star', '圖鑑', P.yellow], ['brush', '設計', P.pink], ['check', '任務', P.blue], ['person', '島民', P.purple], ['cart', '商店', P.teal], ['film', '動畫', '#FF9A3C'], ['gear', '設定', '#A8876A']];
  const PINS = [['village', 176, 340, 'home', P.coral], ['forest', 96, 214, 'leaf', P.green], ['beach', 262, 456, 'sun', P.yellow], ['hill', 262, 204, 'compass', P.purple], ['market', 86, 462, 'cart', P.teal]];
  function mapArt(ctx, t, sel) {
    ctx.fillStyle = '#5FCBEF'; ctx.fillRect(-200, -200, 760, 1040);
    const r = rng(3); for (let i = 0; i < 50; i++) { const x = r() * 360, y = r() * 640; ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(ctx, x, y + Math.sin(t + i) * 1.5, 10, 2.2, 1); ctx.fill(); }
    const isl = (x, y, rx, ry, sd, c) => { ctx.fillStyle = P.sand; V.blob(ctx, x, y + 4, rx + 6, ry + 6, sd); ctx.fill(); ctx.fillStyle = c; V.blob(ctx, x, y, rx, ry, sd); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; V.blob(ctx, x, y + 6, rx + 12, ry + 12, sd); ctx.stroke(); };
    isl(176, 340, 70, 54, 1.2, P.grassA); isl(96, 214, 50, 40, 4.4, '#3FA357'); isl(262, 456, 46, 30, 6.4, '#F7E3A8'); isl(262, 204, 48, 38, 2.4, '#9ADB6E'); isl(86, 462, 40, 28, 8.4, P.grassA);
    for (const [dx, dy] of [[-16, 4], [4, -10], [18, 6]]) { ctx.fillStyle = '#2C8446'; ctx.beginPath(); ctx.moveTo(96 + dx - 8, 214 + dy + 4); ctx.lineTo(96 + dx, 214 + dy - 12); ctx.lineTo(96 + dx + 8, 214 + dy + 4); ctx.fill(); }
    Wd.cottage(ctx, 164, 346, 0.4, t, P.coral, 0, 1); Wd.cottage(ctx, 194, 352, 0.34, t, P.yellow, 0, 2);
    ctx.setLineDash([4, 5]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (const p of PINS.slice(1)) { ctx.beginPath(); ctx.moveTo(176, 340); ctx.quadraticCurveTo((176 + p[1]) / 2 + 16, (340 + p[2]) / 2, p[1], p[2]); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  function map(ctx, lt, t) {
    dp(ctx); OC._t = t;
    if (lt < 3.0) {
      isle(ctx, t, { x: 222, y: 440, z: 1.25 }, 0, [{ d: 'mochi', s: A.idle(t, 1), x: 232, y: 452 }, ...baseChars(t)]);
      const phone = E.outBack(clamp((lt - 0.4) / 0.4), 1.2) * (1 - E.inCubic(clamp((lt - 1.15) / 0.3)));
      if (phone < 0.05 && lt < 1) hud(ctx, t, { phonePress: lt > 0.28 && lt < 0.42 });
      if (phone > 0.01) {
        ctx.fillStyle = `rgba(40,30,20,${0.35 * Math.min(1, phone)})`; ctx.fillRect(0, 0, 360, 640);
        ctx.save(); ctx.translate(0, (1 - phone) * 520);
        rr(ctx, 56, 128 + 6, 248, 400, 34); ctx.fillStyle = 'rgba(70,40,20,0.25)'; ctx.fill();
        rr(ctx, 56, 128, 248, 400, 34); ctx.fillStyle = P.yellow; ctx.fill();
        rr(ctx, 66, 138, 228, 380, 26); const sg = ctx.createLinearGradient(0, 138, 0, 518); sg.addColorStop(0, '#FFF8E7'); sg.addColorStop(1, '#FFEFC8'); ctx.fillStyle = sg; ctx.fill();
        text(ctx, '10:41', 180, 172, { font: F(900, 22), color: P.brown, align: 'center' }); text(ctx, 'OC Phone', 180, 190, { font: F(800, 10), color: P.brown2, align: 'center', ls: 2 });
        APPS9.forEach(([ic, n, c], i) => { const x = 104 + (i % 3) * 76, y = 236 + Math.floor(i / 3) * 86; const pr = i === 0 && lt > 0.95 && lt < 1.12; ctx.save(); ctx.translate(x, y); if (pr) ctx.scale(0.9, 0.9); rr(ctx, -26, -26 + 3, 52, 52, 18); ctx.fillStyle = mix(c, '#3a2414', 0.25); ctx.fill(); rr(ctx, -26, -26, 52, 52, 18); ctx.fillStyle = c; ctx.fill(); V.icon(ctx, ic, 0, 0, 26, '#fff', 2.8); ctx.restore(); text(ctx, n, x, y + 42, { font: ZH(11), color: P.brown, align: 'center' }); });
        ctx.restore();
      }
      // app zoom into map
      const zq = E.inOutCubic(clamp((lt - 1.1) / 0.4));
      if (zq > 0) {
        ctx.save(); const cx = lerp(104, 180, zq), cy = lerp(236, 320, zq), w = lerp(52, 360, zq), h = lerp(52, 640, zq);
        rr(ctx, cx - w / 2, cy - h / 2, w, h, lerp(18, 0, zq)); ctx.clip();
        ctx.translate(cx - w / 2, cy - h / 2); ctx.scale(w / 360, h / 640); mapArt(ctx, t, lt > 1.75 ? 'forest' : null);
        ctx.restore();
        if (zq >= 1) {
          PINS.forEach(([id, x, y, ic, c], i) => { const on = id === 'forest' && lt > 1.75; const pq = E.outBack(clamp((lt - 1.5 - i * 0.06) / 0.3), 2.2); const bob = on ? -Math.abs(Math.sin(t * 6)) * 4 : 0; ctx.save(); ctx.translate(x, y - 16 + bob); ctx.scale(pq * (on ? 1.15 : 1), pq * (on ? 1.15 : 1)); roundToy(ctx, 0, 0, 13, c, ic, { is: 14, lw: 2.6 }); ctx.restore(); });
          ctx.save(); ctx.beginPath(); ctx.arc(150, 352, 15, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.coral; ctx.stroke(); ctx.clip(); ch(ctx, 'mochi', A.idle(t, 1, { noShadow: true }), 150, 378, 0.75, t); ctx.restore();
          tag(ctx, 180, 56, '島嶼地圖', P.green, -0.04);
          if (lt > 1.75) { const lq = E.outBack(clamp((lt - 1.75) / 0.3), 2); ctx.save(); ctx.translate(96, 170); ctx.scale(lq, lq); panel(ctx, -48, -15, 96, 30, 15); text(ctx, '苔光森林', 0, 0.5, { font: ZH(13), color: P.brown, align: 'center', base: 'middle' }); ctx.restore(); }
          const ic = E.outBack(clamp((lt - 1.9) / 0.35), 1.5);
          if (ic > 0) { ctx.save(); ctx.translate(0, (1 - ic) * 160); panel(ctx, 14, 506, 332, 110, 26); text(ctx, '苔光森林', 34, 540, { font: ZH(18), color: P.brown }); V.icon(ctx, 'rain', 40, 566, 15, P.blue, 2.4); text(ctx, '下小雨', 54, 570, { font: ZH(11.5), color: P.brown2 }); V.icon(ctx, 'clock', 112, 566, 13, P.brown2, 2.2); text(ctx, '3 分鐘', 124, 570, { font: ZH(11.5), color: P.brown2 }); text(ctx, '雨後會長出可愛的蘑菇！', 34, 596, { font: ZH(11.5), color: P.brown2 }); toy(ctx, 234, 538, 96, 40, P.yellow, '出發！', { font: ZH(15), tc: P.brown, pressed: lt > 2.45 && lt < 2.6 }); ctx.restore(); }
        }
      }
    }
    // iris travel
    if (lt >= 2.6) {
      const cin = clamp((lt - 2.6) / 0.4), cout = clamp((lt - 3.0) / 0.45);
      if (lt >= 3.0) { const w = walkPath([{ t: 3.0, x: 186, y: 660 }, { t: 4.6, x: 182, y: 520 }], lt, 12); Wd.drawWoods(ctx, { t, chars: [{ d: 'mochi', s: A.idle(t, 1, { back: 0.85, walk: w.moving ? 1 : 0, phase: w.phase, hold: 'leaf' }), x: w.x, y: w.y, sc: 1.4 }] }); }
      const R = lt < 3.0 ? lerp(420, 0, E.inCubic(cin)) : lerp(0, 420, E.outCubic(cout));
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 360, 640); ctx.arc(lt < 3 ? 290 : 182, lt < 3 ? 558 : 470, Math.max(0.01, R), 0, TAU, true); ctx.fillStyle = '#2B1E14'; ctx.fill('evenodd'); ctx.restore();
      if (lt > 3.4) { const q = E.outBack(clamp((lt - 3.4) / 0.4), 2); ctx.save(); ctx.translate(180, 120); ctx.scale(q, q); panel(ctx, -100, -26, 200, 52, 26, '#FFF8E7'); chunky(ctx, '苔光森林', 0, 8, 22, P.green, '#fff', { align: 'center', font: `900 22px Huninn, Nunito` }); ctx.restore(); }
    }
    statusBar(ctx, '10:41', lt > 3 ? '#fff' : P.brown);
    hand(ctx, finger([{ t: 0.05, x: 270, y: 540 }, { t: 0.25, x: 316, y: 592 }, { t: 0.3, x: 316, y: 592, down: true }, { t: 0.45, x: 316, y: 592 }, { t: 0.85, x: 104, y: 236 }, { t: 0.95, x: 104, y: 236, down: true }, { t: 1.12, x: 104, y: 236 }, { t: 1.6, x: 96, y: 198 }, { t: 1.72, x: 96, y: 198, down: true }, { t: 1.86, x: 96, y: 198 }, { t: 2.3, x: 282, y: 558 }, { t: 2.45, x: 282, y: 558, down: true }, { t: 2.6, x: 282, y: 558 }], lt));
  }

  // ---------------- 7. INVENTORY ----------------
  function inventory(ctx, lt, t) {
    dp(ctx);
    const f = finger([{ t: 0.0, x: 230, y: 580 }, { t: 0.2, x: 264, y: 604 }, { t: 0.25, x: 264, y: 604, down: true }, { t: 0.4, x: 264, y: 604 }, { t: 0.85, x: 48, y: 486 }, { t: 0.95, x: 48, y: 486, down: true }, { t: 1.45, x: 48, y: 486, down: true }, { t: 2.25, x: 182, y: 232, down: true }, { t: 2.3, x: 182, y: 232 }], lt);
    const ev = A.eat(lt, t, f, 180, 262);
    isle(ctx, t, { x: 182, y: 388, z: 1.85 }, 0, [{ d: 'mochi', s: ev.s, x: 182, y: 352, emote: ev.happy ? { kind: '♥', p: clamp((ev.eatT - 0.9) / 1.3) } : null }]);
    const open = E.outBack(clamp((lt - 0.3) / 0.4), 1.3) * (1 - E.inOutCubic(clamp((lt - 1.5) / 0.4)) * 0.5);
    if (open < 0.05) hud(ctx, t, { bagPress: lt > 0.2 && lt < 0.4 });
    if (open > 0.01) {
      ctx.save(); ctx.translate(0, (1 - open) * 280);
      panel(ctx, 10, 418, 340, 216, 30);
      tag(ctx, 70, 418, '口袋', P.teal, -0.06);
      DATA.items.concat([{ id: 'apple', n: 1 }, { id: 'star', n: 3 }]).slice(0, 10).forEach((it, i) => {
        const x = 48 + (i % 5) * 66, y = 486 + Math.floor(i / 5) * 72;
        ctx.beginPath(); ctx.arc(x, y + 3, 27, 0, TAU); ctx.fillStyle = P.panel2; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, 27, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
        if (!(it.id === 'cake' && i === 0 && lt > 0.95 && lt < 2.32)) itemE(ctx, it.id, x, y - 1, 36);
        if (it.n > 1 || i === 0) { roundToy(ctx, x + 19, y + 18, 8, P.brown2, 'dots', { is: 1 }); text(ctx, String(it.id === 'cake' && i === 0 && lt > 2.32 ? it.n - 1 : it.n), x + 19, y + 19, { font: F(900, 9), color: '#fff', align: 'center', base: 'middle' }); }
      });
      if (lt > 0.5 && lt < 0.95) { panel(ctx, 12, 432, 86, 22, 11, '#FFF1B8'); text(ctx, '草莓蛋糕', 55, 443.5, { font: ZH(11), color: P.brown, align: 'center', base: 'middle' }); }
      ctx.restore();
    }
    if (f && lt > 0.95 && lt < 1.45) { ctx.strokeStyle = P.yellow; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(f.x, f.y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * ((lt - 0.95) / 0.5)); ctx.stroke(); }
    if (f && lt > 0.95 && lt < 2.32) { ctx.save(); ctx.translate(f.x, f.y - 26); ctx.rotate(Math.sin(t * 8) * 0.12); const s = 1 + Math.sin(t * 10) * 0.04; ctx.scale(s, s); itemE(ctx, 'cake', 0, 0, 44); ctx.restore(); }
    if (ev.chew) { const k = Math.floor(lt * 8) % 2; chunky(ctx, '嚼嚼', 240 + k * 2, 200 - k * 3, 18, '#fff', P.coral); }
    if (ev.happy) { const q = clamp((ev.eatT - 0.9) / 1.0); const s = E.outBack(clamp((ev.eatT - 0.9) / 0.3), 2.2); ctx.save(); ctx.translate(180, 140 - q * 8); ctx.scale(s, s); ctx.globalAlpha = clamp((2.9 - ev.eatT) / 0.3); panel(ctx, -56, -16, 112, 32, 16, '#FFF1B8'); V.icon(ctx, 'heart', -36, 0, 14, P.coral); text(ctx, '飽足 +18', 8, 1, { font: ZH(13), color: P.brown, align: 'center', base: 'middle' }); ctx.restore(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + ev.eatT * 3; V.icon(ctx, 'sparkle', 180 + Math.cos(a) * 50 * q, 230 + Math.sin(a) * 40 * q, 9, P.yellow); } }
    statusBar(ctx, '10:45');
    hand(ctx, f);
  }

  // ---------------- 8. SHOP ----------------
  function shop(ctx, lt, t) {
    dp(ctx); polka(ctx, '#9EE6D9', '#8ADCCD', t);
    // sign board
    ctx.save(); ctx.translate(180, 60); ctx.rotate(Math.sin(t * 1.5) * 0.02); rr(ctx, -96, -22 + 4, 192, 44, 12); ctx.fillStyle = P.woodLo; ctx.fill(); rr(ctx, -96, -22, 192, 44, 12); ctx.fillStyle = P.wood; ctx.fill(); chunky(ctx, '雲朵商店', 0, 8, 22, '#FFF8E7', P.woodLo, { align: 'center', font: `900 22px Huninn, Nunito` }); ctx.restore();
    const sold = lt > 1.75;
    ch(ctx, Object.assign({}, I.DES.sora, { shirt: '#3FC1B0' }), A.idle(t, 3, { eyes: sold ? 'happy' : 'round', mouth: sold ? 'grin' : 'smile', armR: sold ? -2.3 + Math.sin(t * 10) * 0.3 : undefined }), 70, 200, 2.0, t);
    rr(ctx, 10, 172, 340, 36, 10); ctx.fillStyle = P.woodLo; ctx.fill(); rr(ctx, 10, 168, 340, 36, 10); ctx.fillStyle = P.wood; ctx.fill();
    const coins = lerp(DATA.coins, DATA.coins - 120, E.outCubic(clamp((lt - 1.8) / 0.6)));
    panel(ctx, 238, 108, 104, 30, 15); V.icon(ctx, 'coin', 256, 123, 15, '#F2A900', 2.4); text(ctx, fmt(coins), 332, 124, { font: F(900, 13), color: P.brown, align: 'right', base: 'middle' });
    DATA.shop.forEach((s, i) => {
      const x = 18 + (i % 2) * 166, y = 222 + Math.floor(i / 2) * 156, sel = i === 0 && lt > 0.55;
      const wig = sel ? wobble(lt - 0.55, 3, 4) * 0.08 : 0;
      ctx.save(); ctx.translate(x + 79, y + 70); ctx.rotate(wig); ctx.translate(-x - 79, -y - 70);
      panel(ctx, x, y, 158, 144, 22, sel ? '#FFF1B8' : P.cream);
      ctx.beginPath(); ctx.arc(x + 79, y + 58, 40, 0, TAU); ctx.fillStyle = ['#FFE1DA', '#E8E2FF', '#DDF6D6', '#FFF1B8'][i]; ctx.fill();
      itemE(ctx, s.id, x + 79, y + 56 + Math.sin(t * 2 + i) * 2, 60);
      text(ctx, s.zh, x + 18, y + 124, { font: ZH(13), color: P.brown });
      // price tag
      ctx.save(); ctx.translate(x + 124, y + 118); ctx.rotate(0.12); ctx.beginPath(); ctx.moveTo(-18, -10); ctx.lineTo(14, -10); ctx.lineTo(22, 0); ctx.lineTo(14, 10); ctx.lineTo(-18, 10); ctx.closePath(); ctx.fillStyle = P.yellow; ctx.fill(); ctx.beginPath(); ctx.arc(14, 0, 2, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); text(ctx, String(s.price), -2, 0.5, { font: F(900, 11), color: P.brown, align: 'center', base: 'middle' }); ctx.restore();
      ctx.restore();
    });
    // confirm bubble from the shopkeeper
    const cb = E.outBack(clamp((lt - 0.85) / 0.3), 1.8) * (1 - clamp((lt - 2.6) / 0.3));
    if (cb > 0) { ctx.save(); ctx.translate(180, 560); ctx.scale(cb, cb); ctx.translate(-180, -560); panel(ctx, 20, 520, 320, 92, 28); tag(ctx, 70, 520, '蘇拉', P.teal); popText(ctx, sold ? '謝謝光臨～下次再來喔！' : '蘑菇檯燈，要買嗎？', 40, 560, clamp((lt - (sold ? 1.8 : 0.95)) / 0.5), ZH(15), P.brown); if (!sold) { toy(ctx, 160, 572, 80, 30, P.coral, '買！', { font: ZH(13), pressed: lt > 1.55 && lt < 1.72 }); toy(ctx, 248, 572, 80, 30, '#C9B79A', '再想想', { font: ZH(12) }); } ctx.restore(); }
    if (lt > 1.72 && lt < 2.6) { for (let i = 0; i < 6; i++) { const q = clamp((lt - 1.72 - i * 0.05) / 0.5); if (q <= 0 || q >= 1) continue; V.icon(ctx, 'coin', lerp(200, 256, q) + (i - 2.5) * 6 * Math.sin(q * Math.PI), lerp(586, 123, q) - Math.sin(q * Math.PI) * 50, 13, '#F2A900', 2.4); } chunky(ctx, '叮！', 300, 100 - clamp((lt - 2.2) / 0.3) * 8, 18, P.yellow, P.brown); }
    statusBar(ctx, '10:52');
    hand(ctx, finger([{ t: 0.3, x: 200, y: 330 }, { t: 0.5, x: 96, y: 280 }, { t: 0.55, x: 96, y: 280, down: true }, { t: 0.7, x: 96, y: 280 }, { t: 1.4, x: 200, y: 588 }, { t: 1.55, x: 200, y: 588, down: true }, { t: 1.72, x: 200, y: 588 }], lt));
  }

  // ---------------- 9. STUDIO ----------------
  const STROKE = (() => { const p = []; for (let i = 0; i <= 30; i++) { const a = i / 30; p.push([236 + a * 34, 168 - Math.sin(a * Math.PI) * 30]); } return p; })();
  function studio(ctx, lt, t) {
    dp(ctx); polka(ctx, '#FFD9E4', '#FFC6D6', t);
    tag(ctx, 100, 48, '動畫工房', P.pink, -0.05);
    toy(ctx, 268, 34, 76, 30, P.purple, '分享', { font: ZH(13) });
    const playing = lt > 2.35, frames = lt > 1.75 ? 6 : 5, cur = playing ? Math.floor((lt - 2.35) * 8) % frames : frames - 1;
    const earF = (k) => [0, 0.3, 0.6, 0.7, 0.4, 0.1][((k % 6) + 6) % 6];
    // easel
    ctx.fillStyle = P.woodLo; ctx.save(); ctx.lineWidth = 7; ctx.strokeStyle = P.wood; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(110, 360); ctx.lineTo(80, 420); ctx.moveTo(250, 360); ctx.lineTo(280, 420); ctx.stroke(); ctx.restore();
    panel(ctx, 36, 84, 288, 284, 18, P.wood, P.woodLo);
    rr(ctx, 48, 96, 264, 252, 10); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.save(); rr(ctx, 48, 96, 264, 252, 10); ctx.clip();
    if (!playing) { ctx.save(); ctx.globalAlpha = 0.3; ch(ctx, Object.assign({}, I.DES.mochi, { fur: '#C9F0FF', shirt: '#9FDDF2', shade: '#9FDDF2' }), { earR: earF(cur - 1), armR: -earF(cur - 1) * 3, noShadow: true }, 180, 330, 3.1, t); ctx.restore(); }
    ch(ctx, 'mochi', { earR: earF(cur), armR: -earF(cur) * 3, eyes: cur > 2 ? 'happy' : 'round', mouth: cur > 2 ? 'grin' : 'cat', noShadow: true }, 180, 330, 3.1, t);
    const sp = playing ? 1 : clamp((lt - 0.3) / 1.0);
    if (sp > 0) { ctx.strokeStyle = P.coral; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); STROKE.slice(0, Math.max(2, Math.floor(STROKE.length * sp))).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); if (sp >= 1) V.icon(ctx, 'sparkle', 280, 128, 12, P.yellow); }
    ctx.restore();
    // tools
    [[P.coral, 'brush'], [P.yellow, 'eraser'], [P.teal, 'onion'], [P.purple, 'layers']].forEach(([c, ic], i) => roundToy(ctx, 44 + i * 50, 404 - (i === 0 ? 3 : 0), i === 0 ? 19 : 16, c, ic, { is: 16 }));
    roundToy(ctx, 316, 404, 21, P.green, playing ? 'pause' : 'play', { pressed: lt > 2.22 && lt < 2.36, is: 18 });
    panel(ctx, 10, 438, 340, 150, 26);
    text(ctx, '影格', 30, 464, { font: ZH(14), color: P.brown });
    for (let i = 0; i < frames; i++) {
      const x = 26 + i * 54, y = 478, pop = i === 5 ? E.outBack(clamp((lt - 1.75) / 0.3), 2.2) : 1;
      ctx.save(); ctx.translate(x + 23, y + 30); ctx.scale(pop, pop); ctx.translate(-x - 23, -y - 30);
      rr(ctx, x, y + 3, 46, 60, 10); ctx.fillStyle = i === cur ? '#E8A800' : P.panel2; ctx.fill(); rr(ctx, x, y, 46, 60, 10); ctx.fillStyle = i === cur ? '#FFF1B8' : '#fff'; ctx.fill();
      ctx.save(); rr(ctx, x, y, 46, 60, 10); ctx.clip(); ch(ctx, 'mochi', { earR: earF(i), armR: -earF(i) * 3, noShadow: true }, x + 23, y + 56, 0.85, 0); ctx.restore();
      roundToy(ctx, x + 40, y + 4, 8, i === cur ? P.coral : P.brown2, 'dots', { is: 1 }); text(ctx, String(i + 1), x + 40, y + 5, { font: F(900, 9), color: '#fff', align: 'center', base: 'middle' });
      ctx.restore();
    }
    if (frames < 6 || lt < 2.05) roundToy(ctx, 26 + frames * 54 + 22, 508, 15, P.teal, 'plus', { is: 16, pressed: lt > 1.68 && lt < 1.82 });
    text(ctx, '8 fps · 循環播放', 30, 570, { font: ZH(11), color: P.brown2 });
    statusBar(ctx, '11:03');
    const pk = STROKE.filter((_, i) => i % 4 === 0).map((p, i) => ({ t: 0.3 + i * 0.13, x: p[0], y: p[1], down: true }));
    hand(ctx, finger([{ t: 0.1, x: 220, y: 230 }, ...pk, { t: 1.45, x: 300, y: 400 }, { t: 1.62, x: 318, y: 508 }, { t: 1.7, x: 318, y: 508, down: true }, { t: 1.85, x: 318, y: 508 }, { t: 2.12, x: 316, y: 404 }, { t: 2.22, x: 316, y: 404, down: true }, { t: 2.38, x: 316, y: 404 }], lt));
  }

  // ---------------- 10. PET ----------------
  function pet(ctx, lt, t) {
    dp(ctx);
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#FFB98A'); g.addColorStop(0.5, '#FF9EB5'); g.addColorStop(1, '#9E9CF0'); ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    for (let i = 0; i < 4; i++) { const x = ((t * 5 + i * 110) % 500) - 70, y = 260 + i * 70; ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (const [dx, dy, r] of [[0, 0, 14], [16, -6, 18], [34, 0, 13]]) { ellipse(ctx, x + dx, y + dy, r, r * 0.8); ctx.fill(); } }
    chunky(ctx, '21:42', 34, 180, 52, '#fff', '#C2607A'); text(ctx, '11月4日（三）· 18°', 40, 210, { font: ZH(13), color: '#fff' });
    A.APPS.forEach(([ic, n], i) => { const [x, y] = A.appPos(i); const c = [P.green, P.coral, P.purple, P.blue, P.yellow, P.teal, '#A8876A', P.pink][i]; rr(ctx, x - 24, y - 24 + 3, 48, 48, 17); ctx.fillStyle = mix(c, '#3a2414', 0.25); ctx.fill(); rr(ctx, x - 24, y - 24, 48, 48, 17); ctx.fillStyle = c; ctx.fill(); V.icon(ctx, ic, x, y, 24, '#fff', 2.6); text(ctx, n, x, y + 39, { font: ZH(10), color: '#fff', align: 'center' }); });
    rr(ctx, 20, 520, 320, 70, 28); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
    ['chat', 'camera', 'music', 'gear'].forEach((n, i) => { const x = 62 + i * 79; rr(ctx, x - 22, 533, 44, 44, 15); ctx.fillStyle = '#FFF8E7'; ctx.fill(); V.icon(ctx, n, x, 555, 22, P.brown, 2.4); });
    statusBar(ctx, '21:42', '#fff');
    const pp = A.pet(lt, t);
    ctx.save(); ctx.translate(pp.x, pp.y - 46); ctx.rotate(pp.swing); ctx.translate(-pp.x, -(pp.y - 46)); ch(ctx, 'mochi', pp.s, pp.x, pp.y, 1.05, t); ctx.restore();
    if (pp.mode === 'drag') chunky(ctx, '哇～', pp.x + 32, pp.y - 62, 15, '#fff', P.coral);
    if (pp.mode === 'sit' && lt > 3.9) { const q = E.outBack(clamp((lt - 3.9) / 0.3), 2); ctx.save(); ctx.translate(pp.x - 56, pp.y - 80); ctx.scale(q, q); panel(ctx, -58, -16, 116, 32, 16); text(ctx, '一起休息吧～', 0, 0.5, { font: ZH(12), color: P.brown, align: 'center', base: 'middle' }); ctx.restore(); }
    panel(ctx, 52, 30, 256, 26, 13); ctx.beginPath(); ctx.arc(70, 43, 4, 0, TAU); ctx.fillStyle = P.coral; ctx.fill();
    text(ctx, 'Android 懸浮桌寵 · 視覺模擬（未實機驗證）', 186, 43.5, { font: ZH(10), color: P.brown, align: 'center', base: 'middle' });
    hand(ctx, pp.f);
  }

  // ---------------- 11. END ----------------
  function end(ctx, lt, t) {
    dp(ctx); polka(ctx, '#FFE38A', '#FFD458', t);
    const a = E.outBack(clamp(lt / 0.5), 1.6);
    ctx.save(); ctx.translate(180, 380); ctx.scale(a, a); ctx.translate(-180, -380);
    ch(ctx, 'mochi', A.idle(t, 1, { eyes: 'happy', mouth: 'grin', armR: -2.2 + Math.sin(t * 9) * 0.35 }), 128, 318, 1.6, t);
    ch(ctx, 'kuri', A.idle(t, 2, { face: -0.3, eyes: 'happy' }), 190, 322, 1.5, t);
    ch(ctx, 'sora', A.idle(t, 3, { face: -0.4, eyes: 'sleepy' }), 248, 326, 1.4, t);
    tag(ctx, 180, 368, '方案 E', P.coral, -0.04);
    chunky(ctx, '晴日島嶼', 180, 424, 32, '#fff', P.brown, { align: 'center', font: `900 32px Huninn, Nunito` });
    text(ctx, 'SUNNY ISLE', 180, 452, { font: F(900, 14), color: P.brown, align: 'center', ls: 3 });
    text(ctx, '玩具般的明亮色彩 · 圓潤厚實的 UI · 彈跳的手感', 180, 484, { font: ZH(12), color: P.brown, align: 'center' });
    ctx.restore();
  }

  function transition(ctx, A_, B, p) {
    const W = 1080, H = 1920, cx = 540, cy = 900, Rm = 1250;
    if (p < 0.5) { ctx.drawImage(A_, 0, 0); const R = lerp(Rm, 0, E.inCubic(p * 2)); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, Math.max(0.01, R), 0, TAU, true); ctx.fillStyle = '#2B1E14'; ctx.fill('evenodd'); }
    else { ctx.drawImage(B, 0, 0); const R = lerp(0, Rm, E.outCubic((p - 0.5) * 2)); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, Math.max(0.01, R), 0, TAU, true); ctx.fillStyle = '#2B1E14'; ctx.fill('evenodd'); }
  }
  function chapter(ctx, s, a, idx) {
    if (s.id === 'pet' || s.id === 'end' || s.id === 'logo') return;
    ctx.scale(OC.DP, OC.DP); ctx.globalAlpha = a;
    const label = `${String(idx).padStart(2, '0')} ${s.zh}`; ctx.font = ZH(9); const w = ctx.measureText(label).width + 20;
    rr(ctx, 180 - w / 2, 4, w, 16, 8); ctx.fillStyle = 'rgba(255,248,231,0.92)'; ctx.fill();
    text(ctx, label, 180, 12.5, { font: ZH(9), color: P.brown, align: 'center', base: 'middle' });
  }

  OC.themes.isle = {
    id: 'isle', name: '晴日島嶼 Sunny Isle', short: 'E',
    fonts: [
      { family: 'Huninn', url: 'assets/fonts/Huninn-Regular.woff', descriptors: { weight: '100 900' } },
      { family: 'Nunito', url: 'assets/fonts/Nunito-ExtraBold.woff', descriptors: { weight: '800' } },
      { family: 'Nunito', url: 'assets/fonts/Nunito-Black.woff', descriptors: { weight: '900' } },
    ],
    shots: { logo, island, creator, profile, dialogue, map, inventory, shop, studio, pet, end },
    transition, chapter,
  };
})();
