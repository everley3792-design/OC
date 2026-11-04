/* Scheme F — Quirkville : storyboard shots */
(function () {
  'use strict';
  const { TAU, clamp, lerp, E, spring, wobble, ellipse, rr, mix, rgba, text, typewriter, finger, walkPath, rng, DATA } = OC;
  const V = OC.V, Q = OC.QK, P = Q.P, A = OC.ACT, Wd = OC.QK.WORLD;
  const { B, ZB, ch, card, gloss, orb, thought, burst, cap, stylus, statusBar, itemF, shapesBg } = Q;
  const dp = (ctx) => ctx.scale(OC.DP, OC.DP);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const town = (ctx, t, cam, night = 0, chars = []) => Wd.drawTown(ctx, { t, cam, night, chars });
  const baseChars = (t) => [
    { d: 'kuri', s: A.idle(t, 2, { face: -0.4 }), x: 300, y: 502, wish: ['heart', P.mag] },
    { d: 'sora', s: A.idle(t, 3, { eyes: 'sleepy', mouth: 'flat', blink: 0.6, tilt: 0.12 }), x: 96, y: 516, wish: ['moon', P.purple] },
  ];

  function hud(ctx, t, o = {}) {
    const lt = o.lt ?? 9, on = (k) => E.outBack(clamp((lt - 0.3 - k * 0.12) / 0.35), 1.8), night = o.night || 0;
    let q = on(0);
    if (q > 0) { ctx.save(); ctx.translate(12, 30); ctx.scale(q, q); card(ctx, 0, 0, 152, 28, { r: 14 }); orb(ctx, 15, 14, 10, night > 0.55 ? P.purple : P.orange, night > 0.55 ? 'moon' : 'sun', { is: 11, lw: 2.4 }); text(ctx, o.clock || '10:20', 32, 15, { font: B(900, 14), color: P.ink, base: 'middle' }); text(ctx, '星期三・晴', 82, 15, { font: ZB(700, 10), color: P.ink2, base: 'middle' }); ctx.restore(); }
    q = on(1);
    if (q > 0) { ctx.save(); ctx.translate(348, 30); ctx.scale(q, q); card(ctx, -100, 0, 100, 28, { r: 14 }); orb(ctx, -86, 14, 10, P.yellow, 'coin', { is: 12, lw: 2.2 }); text(ctx, fmt(o.coins ?? DATA.coins), -10, 15, { font: B(900, 13), color: P.ink, align: 'right', base: 'middle' }); ctx.restore(); }
    q = on(2);
    if (q > 0) {
      ctx.save(); ctx.translate(0, (1 - q) * 80);
      card(ctx, 12, 566, 336, 60, { r: 30 });
      ctx.save(); ctx.beginPath(); ctx.arc(44, 596, 22, 0, TAU); ctx.fillStyle = '#E8F6FF'; ctx.fill(); ctx.clip(); ch(ctx, 'mochi', A.idle(t, 1, { noShadow: true }), 44, 636, 1.0, t); ctx.restore();
      ctx.beginPath(); ctx.arc(44, 596, 22, 0, TAU); ctx.strokeStyle = P.mag; ctx.lineWidth = 2.5; ctx.stroke();
      text(ctx, '麻糬', 76, 590, { font: ZB(900, 12), color: P.ink }); text(ctx, '心情 ♥ 很好', 76, 606, { font: ZB(700, 9.5), color: P.mag });
      orb(ctx, 212, 596, 20, P.blue, 'map', { pressed: o.mapPress, is: 19 }); orb(ctx, 262, 596, 20, P.orange, 'bag', { pressed: o.bagPress, is: 19 }); orb(ctx, 312, 596, 20, P.mag, 'dots', { is: 18 });
      ctx.restore();
    }
  }

  // ---------------- 1. LOGO ----------------
  function logo(ctx, lt, t) {
    dp(ctx); shapesBg(ctx, t, '#FFFFFF');
    const rise = spring(lt - 0.2, 1.5, 5.5);
    ctx.save(); ctx.translate(-14, 420 + (1 - rise) * 320); ctx.scale(1.08, 1.08); ctx.translate(0, -300); Wd.apartment(ctx, t, 0); ctx.restore();
    const word = 'OC Shimeji', cols = [P.mag, P.orange, P.ink, P.blue, P.lime, P.purple, P.mag, P.teal, P.orange, P.blue];
    ctx.font = B(900, 46); const w = ctx.measureText(word).width; let x = 180 - w / 2;
    [...word].forEach((c, i) => { ctx.font = B(900, 46); const cw = ctx.measureText(c).width; const q = clamp((lt - 0.5 - i * 0.06) / 0.4); if (q > 0) { const s = E.outBack(q, 2.4), r = Math.sin(t * 2 + i) * 0.05; ctx.save(); ctx.translate(x + cw / 2, 170); ctx.rotate(r); ctx.scale(s, s); cap(ctx, c, 0, 0, 46, c === ' ' ? 'transparent' : cols[i], { font: B(900, 46) }); ctx.restore(); } x += cw; });
    const sq = E.outBack(clamp((lt - 1.2) / 0.35), 2);
    if (sq > 0) { ctx.save(); ctx.translate(180, 200); ctx.scale(sq, sq); card(ctx, -100, -14, 200, 28, { r: 14, fill: P.ink }); text(ctx, '我的 OC，住進你的手機', 0, 0.5, { font: ZB(700, 12), color: '#fff', align: 'center', base: 'middle' }); ctx.restore(); }
    if (lt > 1.9) { const b = 1 + Math.sin(t * 6) * 0.04; ctx.save(); ctx.translate(180, 582); ctx.scale(b, b); gloss(ctx, -72, -18, 144, 36, P.mag, '點一下開始！', { font: ZB(900, 14) }); ctx.restore(); }
  }

  // ---------------- 2. ISLAND ----------------
  const WALK = [{ t: 0.9, x: 128, y: 482 }, { t: 2.7, x: 180, y: 516 }];
  function island(ctx, lt, t) {
    dp(ctx);
    const night = E.inOutSine(clamp((lt - 3.7) / 2.1)), m = A.island(lt, t, WALK), z = E.inOutCubic(clamp((lt + 0.2) / 2.6));
    town(ctx, t, { x: lerp(200, m.x + 10, z * 0.75), y: lerp(400, m.y - 40, z * 0.7), z: lerp(0.8, 1.22, z) }, night, [{ d: 'mochi', s: m.s, x: m.x, y: m.y, emote: m.emote }, ...baseChars(t)]);
    const mins = lerp(620, 1265, night), clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
    hud(ctx, t, { lt, night, clock });
    statusBar(ctx, clock, night > 0.6 ? '#fff' : P.ink);
  }

  // ---------------- 3. CREATOR (face maker with sliders) ----------------
  const SLIDERS = [['大小', 0], ['間距', 1], ['角度', 2], ['高度', 3]];
  const SW = ['#FFF8EE', '#FFE0D2', '#E2DEFF', '#D6F3EE', '#FFF3B0', '#F0B27A'];
  function slider(ctx, x, y, w, v, label, col, active) {
    text(ctx, label, x, y + 4, { font: ZB(900, 11.5), color: P.ink });
    rr(ctx, x + 40, y - 3, w, 6, 3); ctx.fillStyle = P.line; ctx.fill();
    rr(ctx, x + 40, y - 3, w * v, 6, 3); ctx.fillStyle = col; ctx.fill();
    orb(ctx, x + 40 + w * v, y, active ? 11 : 9, col, null);
    text(ctx, String(Math.round(v * 100)), x + 54 + w, y + 4, { font: B(900, 10), color: P.ink2 });
  }
  function creator(ctx, lt, t) {
    dp(ctx); shapesBg(ctx, t);
    card(ctx, 12, 30, 336, 40, { r: 20, head: P.mag, hh: 40, title: '臉部製作室' });
    gloss(ctx, 272, 36, 68, 28, P.lime, '完成', { font: ZB(900, 12) });
    // live params
    const kSize = finger([{ t: 0.55, x: 156, y: 474 }, { t: 0.65, x: 156, y: 474, down: true }, { t: 1.3, x: 222, y: 474, down: true }, { t: 1.36, x: 222, y: 474 }], lt);
    const vSize = lt < 0.65 ? 0.4 : lt < 1.3 ? lerp(0.4, 0.75, E.inOutSine((lt - 0.65) / 0.65)) : 0.75;
    const vAng = lt < 1.55 ? 0.5 : lt < 2.0 ? lerp(0.5, 0.72, E.inOutSine((lt - 1.55) / 0.45)) : 0.72;
    const tab = lt < 2.2 ? 0 : 3, ear = lt > 2.45 ? 1 : 0, colP = E.inOutCubic(clamp((lt - 2.9) / 0.35));
    const dice = lt > 3.45 && lt < 3.95, diceK = Math.floor(lt * 10);
    const eyesR = ['round', 'wide', 'sparkle', 'dot', 'round'];
    const s = A.idle(t, 1, {
      eyeSize: lerp(0.75, 1.35, vSize), eyeRot: (vAng - 0.5) * 1.0, eyeGap: dice ? 6 + (diceK % 3) : 6.8, eyes: dice ? eyesR[diceK % 5] : lt > 3.95 && lt < 4.6 ? 'happy' : 'round',
      mouth: dice ? ['o', 'grin', 'wave', 'tongue'][diceK % 4] : lt > 3.95 && lt < 4.6 ? 'grin' : 'smile', brows: dice ? ['up', 'worry', 'angry'][diceK % 3] : 'soft',
      ears: ['cat', 'bunny'][ear], earL: wobble(lt - 2.45, 2.8, 4) * 0.6, earR: wobble(lt - 2.5, 2.8, 4) * 0.6, squash: 1 + wobble(lt - 3.95, 3, 5) * 0.1 + (dice ? Math.sin(lt * 40) * 0.03 : 0), sweat: dice,
    });
    const D = Object.assign({}, Q.DES.mochi, { fur: mix('#FFF8EE', SW[2], colP), shade: mix('#E9D9C6', '#C2BCF0', colP) });
    ctx.save(); ctx.beginPath(); ctx.arc(180, 236, 132, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = 2; ctx.stroke(); ctx.clip();
    ctx.fillStyle = '#E8F6FF'; ctx.fillRect(40, 250, 280, 140);
    ch(ctx, D, s, 180, 392, 4.4, t);
    ctx.restore();
    if (lt > 3.95 && lt < 4.7) { burst(ctx, 290, 130, 40, P.yellow, t, clamp((4.7 - lt) / 0.3)); cap(ctx, '噗哈！', 290, 138, 20, P.orange); }
    // bottom editor
    card(ctx, 12, 380, 336, 248, { r: 22 });
    const tabs = [['眼睛', P.mag], ['眉毛', P.orange], ['嘴巴', P.yellow], ['耳朵', P.blue], ['顏色', P.lime]];
    tabs.forEach(([n, c], i) => { const x = 22 + i * 64, on = i === tab; rr(ctx, x, 392 - (on ? 4 : 0), 58, 26, 13); ctx.fillStyle = on ? c : '#F0F2F7'; ctx.fill(); text(ctx, n, x + 29, 405.5 - (on ? 4 : 0), { font: ZB(900, 11.5), color: on ? '#fff' : P.ink2, align: 'center', base: 'middle' }); });
    if (tab === 0) {
      slider(ctx, 30, 474 - 30, 200, 0.5, '高度', P.mag, false);
      slider(ctx, 30, 474, 200, vSize, '大小', P.mag, kSize && kSize.down);
      slider(ctx, 30, 504, 200, 0.45, '間距', P.mag, false);
      slider(ctx, 30, 534, 200, vAng, '角度', P.mag, lt > 1.55 && lt < 2.0);
    } else {
      ['cat', 'bunny', 'bear', 'fold'].forEach((e, i) => { const x = 54 + i * 76, y = 476, sel = i === ear; rr(ctx, x - 32, y - 34, 64, 64, 16); ctx.fillStyle = sel ? '#E1EEFF' : '#F4F6FA'; ctx.fill(); if (sel) { ctx.strokeStyle = P.blue; ctx.lineWidth = 2.5; ctx.stroke(); } ctx.save(); rr(ctx, x - 32, y - 34, 64, 64, 16); ctx.clip(); ch(ctx, 'mochi', { ears: e, noShadow: true }, x, y + 48, 1.3, t); ctx.restore(); });
    }
    SW.forEach((c, i) => { const x = 40 + i * 40, y = 584, sel = (colP > 0.5 ? 2 : 0) === i; ctx.beginPath(); ctx.arc(x, y, sel ? 14 : 12, 0, TAU); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = sel ? 3 : 1.2; ctx.strokeStyle = sel ? P.mag : P.line; ctx.stroke(); });
    orb(ctx, 314, 584, 20, P.purple, 'dice', { pressed: lt > 3.4 && lt < 3.55, is: 20 });
    statusBar(ctx, '10:24');
    stylus(ctx, finger([{ t: 0.4, x: 200, y: 520 }, { t: 0.55, x: 156, y: 474 }, { t: 0.65, x: 156, y: 474, down: true }, { t: 1.3, x: 222, y: 474, down: true }, { t: 1.36, x: 222, y: 474 }, { t: 1.5, x: 170, y: 534 }, { t: 1.55, x: 170, y: 534, down: true }, { t: 2.0, x: 214, y: 534, down: true }, { t: 2.06, x: 214, y: 534 }, { t: 2.15, x: 214, y: 405 }, { t: 2.2, x: 214, y: 405, down: true }, { t: 2.3, x: 214, y: 405 }, { t: 2.4, x: 130, y: 476 }, { t: 2.45, x: 130, y: 476, down: true }, { t: 2.58, x: 130, y: 476 }, { t: 2.85, x: 120, y: 584 }, { t: 2.9, x: 120, y: 584, down: true }, { t: 3.02, x: 120, y: 584 }, { t: 3.35, x: 314, y: 584 }, { t: 3.4, x: 314, y: 584, down: true }, { t: 3.55, x: 314, y: 584 }], lt));
  }

  // ---------------- 4. PROFILE ----------------
  function profile(ctx, lt, t) {
    dp(ctx); shapesBg(ctx, t);
    card(ctx, 12, 30, 336, 214, { r: 22, head: P.mag, hh: 34, title: '居民檔案' });
    ctx.save(); ctx.beginPath(); ctx.arc(76, 142, 52, 0, TAU); ctx.fillStyle = '#E8F6FF'; ctx.fill(); ctx.clip(); ch(ctx, 'mochi', A.idle(t, 1, { noShadow: true, eyes: lt > 3.3 ? 'happy' : 'round', mouth: lt > 3.3 ? 'grin' : 'smile' }), 76, 238, 2.4, t); ctx.restore();
    ctx.beginPath(); ctx.arc(76, 142, 52, 0, TAU); ctx.strokeStyle = P.mag; ctx.lineWidth = 3; ctx.stroke();
    text(ctx, '麻糬', 142, 104, { font: ZB(900, 24), color: P.ink });
    rr(ctx, 142, 112, 64, 18, 9); ctx.fillStyle = P.mag; ctx.fill(); text(ctx, '你的 OC', 174, 121.5, { font: ZB(900, 9.5), color: '#fff', align: 'center', base: 'middle' });
    text(ctx, '生日 春3日 ・ 喜歡的東西：草莓蛋糕', 142, 146, { font: ZB(700, 10), color: P.ink2 });
    DATA.traits.forEach((tr, i) => { const q = E.outBack(clamp((lt - 0.3 - i * 0.1) / 0.3), 2); if (q <= 0) return; const x = 142 + (i % 2) * 98, y = 162 + Math.floor(i / 2) * 26; ctx.save(); ctx.translate(x + 46, y + 10); ctx.scale(q, q); rr(ctx, -46, -10, 92, 20, 10); ctx.fillStyle = ['#FFE0EC', '#E1EEFF', '#FFF0C9', '#E3F7D6'][i]; ctx.fill(); text(ctx, tr, 0, 0.5, { font: ZB(700, 10), color: P.ink, align: 'center', base: 'middle' }); ctx.restore(); });
    // personality chart
    card(ctx, 12, 254, 160, 178, { r: 18, head: P.blue, hh: 26, title: '性格' });
    const gx = 26, gy = 290, gs = 132;
    rr(ctx, gx, gy, gs, 128, 8); ctx.fillStyle = '#F4F7FB'; ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx + gs / 2, gy); ctx.lineTo(gx + gs / 2, gy + 128); ctx.moveTo(gx, gy + 64); ctx.lineTo(gx + gs, gy + 64); ctx.stroke();
    text(ctx, '活潑', gx + gs - 4, gy + 60, { font: ZB(700, 8.5), color: P.ink3, align: 'right' }); text(ctx, '文靜', gx + 4, gy + 60, { font: ZB(700, 8.5), color: P.ink3 }); text(ctx, '隨性', gx + gs / 2 + 4, gy + 12, { font: ZB(700, 8.5), color: P.ink3 }); text(ctx, '認真', gx + gs / 2 + 4, gy + 124, { font: ZB(700, 8.5), color: P.ink3 });
    const dq = E.outBack(clamp((lt - 0.6) / 0.4), 2), px = gx + gs * 0.36, py = gy + 128 * 0.3;
    if (dq > 0.05) { ctx.beginPath(); ctx.arc(px, py, Math.max(0.5, 14 * dq + Math.sin(t * 4) * 1.5), 0, TAU); ctx.fillStyle = rgba(P.mag, 0.2); ctx.fill(); orb(ctx, px, py, 7 * dq, P.mag, null); }
    text(ctx, '悠哉夢想家', gx + gs / 2, gy + 146 - 8, { font: ZB(900, 10.5), color: P.mag, align: 'center' });
    // needs
    card(ctx, 180, 254, 168, 178, { r: 18, head: P.orange, hh: 26, title: '今日需求' });
    const cols = [P.mag, P.orange, P.yellow, P.blue, P.lime], ics = ['heart', 'sun', 'face', 'chat', 'sparkle'];
    DATA.needs.forEach((n, i) => { const y = 300 + i * 26, v = n.v * E.outCubic(clamp((lt - 0.4 - i * 0.1) / 0.7)); orb(ctx, 200, y, 9, cols[i], ics[i], { is: 10, lw: 2.2 }); text(ctx, n.zh, 214, y + 4, { font: ZB(700, 10), color: P.ink }); rr(ctx, 246, y - 4, 88, 8, 4); ctx.fillStyle = P.line; ctx.fill(); rr(ctx, 246, y - 4, Math.max(8, 88 * v), 8, 4); ctx.fillStyle = cols[i]; ctx.fill(); });
    // relationship graph
    card(ctx, 12, 442, 336, 182, { r: 18, head: P.lime, hh: 26, title: '人際關係' });
    const nodes = [['mochi', 180, 540], ['kuri', 70, 520], ['sora', 290, 560]];
    const lq = clamp((lt - 1.2) / 0.6);
    for (const [k, i] of [[1, 0], [2, 1]]) { const [, x, y] = nodes[k]; ctx.strokeStyle = k === 1 ? P.mag : P.blue; ctx.lineWidth = k === 1 ? 4 : 2.5; ctx.setLineDash(k === 1 ? [] : [5, 5]); ctx.beginPath(); ctx.moveTo(180, 540); ctx.lineTo(lerp(180, x, lq), lerp(540, y, lq)); ctx.stroke(); ctx.setLineDash([]); if (lq >= 1) { const mx = (180 + x) / 2, my = (540 + y) / 2; rr(ctx, mx - 22, my - 10, 44, 20, 10); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = k === 1 ? P.mag : P.blue; ctx.lineWidth = 1.5; ctx.stroke(); text(ctx, k === 1 ? '♥ 摯友' : '鄰居', mx, my + 0.5, { font: ZB(900, 9.5), color: k === 1 ? P.mag : P.blue, align: 'center', base: 'middle' }); } }
    nodes.forEach(([who, x, y], i) => { const big = i === 0 ? 26 : 22, wig = i === 1 && lt > 3.2 ? wobble(lt - 3.2, 4, 5) * 0.12 : 0; ctx.save(); ctx.translate(x, y); ctx.scale(1 + wig, 1 + wig); ctx.beginPath(); ctx.arc(0, 0, big, 0, TAU); ctx.fillStyle = '#E8F6FF'; ctx.fill(); ctx.save(); ctx.clip(); ch(ctx, who, A.idle(t, 4 + i, { noShadow: true }), 0, big * 1.9, big / 22, t); ctx.restore(); ctx.strokeStyle = i === 0 ? P.mag : P.line; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); text(ctx, DATA.cast[who].zh, x, y + big + 13, { font: ZB(900, 10.5), color: P.ink, align: 'center' }); });
    statusBar(ctx, '10:26');
    stylus(ctx, finger([{ t: 2.9, x: 140, y: 470 }, { t: 3.12, x: 70, y: 520 }, { t: 3.2, x: 70, y: 520, down: true }, { t: 3.36, x: 70, y: 520 }], lt));
  }

  // ---------------- 5. DIALOGUE ----------------
  function balloon(ctx, x, y, w, h, tx, ty, name, col, str, a) {
    if (a <= 0) return;
    const s = E.outBack(clamp(a), 2);
    ctx.save(); ctx.translate(tx, ty); ctx.scale(s, s); ctx.translate(-tx, -ty);
    rr(ctx, x, y + 3, w, h, 16); ctx.fillStyle = 'rgba(43,45,66,0.12)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 10, y + h - 1); ctx.lineTo(tx, ty); ctx.lineTo(tx + 8, y + h - 1); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.4; ctx.stroke();
    rr(ctx, x, y, w, h, 16); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(tx - 9, y + h - 2.5, 16, 4);
    rr(ctx, x + 12, y - 10, name.length * 13 + 18, 20, 10); ctx.fillStyle = col; ctx.fill(); text(ctx, name, x + 21 + name.length * 6.5, y + 0.5, { font: ZB(900, 11), color: '#fff', align: 'center', base: 'middle' });
    text(ctx, str, x + w / 2, y + h / 2 + 6, { font: ZB(900, 14), color: P.ink, align: 'center' });
    ctx.restore();
  }
  function dialogue(ctx, lt, t) {
    dp(ctx);
    const D = A.dialogue(lt, t, [236, 522], [192, 520]);
    const z = lerp(2.0, 2.1, E.inOutSine(clamp(lt / 5)));
    const cam = { x: 172, y: 492, z };
    // reaction burst behind Kuri (screen space, under the world chars is not possible → draw before with alpha)
    town(ctx, t, cam, 0, [{ d: 'mochi', s: D.mochi, x: 150, y: 522 }, { d: 'kuri', s: D.kuri, x: D.kx, y: D.ky, emote: lt > 3.4 ? D.emote : null }]);
    const kx = (D.kx - cam.x) * z + 180, ky = (D.ky - 40 - cam.y) * z + 320;
    if (lt > 2.95 && lt < 3.9) { const a = clamp((lt - 2.95) / 0.1) * clamp((3.9 - lt) / 0.3); ctx.save(); ctx.globalCompositeOperation = 'multiply'; burst(ctx, kx, ky, 170, P.yellow, t, a * 0.9); ctx.restore(); cap(ctx, '！？', kx + 46, ky - 70 - E.outBack(clamp((lt - 2.95) / 0.25), 2) * 6, 30, P.mag); }
    if (lt > 3.45 && lt < 4.4) cap(ctx, '好耶～！', kx + 70, ky + 40, 22, P.orange);
    const a1 = clamp((lt - 0.95) / 0.2) * (1 - clamp((lt - 2.75) / 0.2));
    balloon(ctx, 48, 120, 264, 56, kx - 10, ky - 60, '栗子', P.blue, typewriter(DATA.dialogue.a, clamp((lt - 1.05) / 1.0)), a1);
    const a2 = clamp((lt - 3.9) / 0.2);
    balloon(ctx, 92, 120, 200, 56, kx - 10, ky - 60, '栗子', P.blue, typewriter(DATA.dialogue.b, clamp((lt - 4.0) / 0.6)), a2);
    const ca = clamp((lt - 2.15) / 0.25) * (1 - clamp((lt - 3.0) / 0.2));
    if (ca > 0) DATA.dialogue.choices.forEach((c, i) => { const q = E.outBack(clamp((lt - 2.15 - i * 0.08) / 0.3), 2); ctx.save(); ctx.globalAlpha = ca; ctx.translate(180, 540 + i * 48); ctx.scale(q, q); gloss(ctx, -130, -19, 260, 38, i ? P.blue : P.mag, c, { font: ZB(900, 14), pressed: i === 0 && lt > 2.75 && lt < 2.9 }); ctx.restore(); });
    statusBar(ctx, '10:32');
    stylus(ctx, finger([{ t: 2.4, x: 260, y: 600 }, { t: 2.65, x: 180, y: 540 }, { t: 2.72, x: 180, y: 540, down: true }, { t: 2.88, x: 180, y: 540 }], lt));
  }

  // ---------------- 6. MAP ----------------
  const SPOTS = [['village', 180, 330, 'home', P.mag, '奇趣公寓'], ['forest', 90, 220, 'leaf', P.lime, '森林公園'], ['beach', 270, 444, 'sun', P.yellow, '星砂海灘'], ['hill', 270, 220, 'compass', P.purple, '風車丘'], ['market', 90, 446, 'cart', P.orange, '雲朵市集']];
  function townMap(ctx, t) {
    rr(ctx, 20, 92, 320, 380, 14); ctx.fillStyle = '#DFF3C8'; ctx.fill();
    ctx.save(); rr(ctx, 20, 92, 320, 380, 14); ctx.clip();
    ctx.fillStyle = '#9CDCFF'; ctx.beginPath(); ctx.moveTo(20, 400); ctx.quadraticCurveTo(200, 360, 340, 420); ctx.lineTo(340, 472); ctx.lineTo(20, 472); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (const [a, b] of [[[180, 330], [90, 220]], [[180, 330], [270, 220]], [[180, 330], [90, 446]], [[180, 330], [270, 444]], [[90, 220], [270, 220]]]) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); for (const [a, b] of [[[180, 330], [90, 220]], [[180, 330], [270, 220]]]) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } ctx.setLineDash([]);
    for (const [x, y, c] of [[60, 180, P.grassLo], [110, 190, P.grass], [76, 250, P.lime], [120, 240, P.grassLo]]) { ctx.fillStyle = c; ellipse(ctx, x, y, 12, 12); ctx.fill(); }
    ctx.restore();
  }
  function stripes(ctx, p, cols, cover) { // diagonal stripe wipe (dp space)
    ctx.save(); ctx.translate(180, 320); ctx.rotate(-0.42);
    cols.forEach((c, i) => { const q = clamp(p * 1.6 - i * 0.1); const w = 760, h = 150; const x = cover ? lerp(-w - 400, -w / 2, E.inOutCubic(q)) : lerp(-w / 2, w + 400 - w, E.inOutCubic(q)); ctx.fillStyle = c; ctx.fillRect(x, -380 + i * h * 0.9 - 20, w, h); });
    ctx.restore();
  }
  function map(ctx, lt, t) {
    dp(ctx);
    const pre = lt < 2.75;
    if (pre) {
      town(ctx, t, { x: 186, y: 476, z: 1.22 }, 0, [{ d: 'mochi', s: A.idle(t, 1), x: 180, y: 516 }, ...baseChars(t)]);
      const up = E.outBack(clamp((lt - 0.45) / 0.45), 1.2);
      if (up < 0.05) hud(ctx, t, { mapPress: lt > 0.28 && lt < 0.45 });
      if (up > 0.01) {
        ctx.fillStyle = `rgba(43,45,66,${0.3 * Math.min(1, up)})`; ctx.fillRect(0, 0, 360, 640);
        ctx.save(); ctx.translate(0, (1 - up) * 560);
        card(ctx, 10, 40, 340, 590, { r: 24, head: P.blue, hh: 40, title: '城鎮地圖' });
        orb(ctx, 324, 60, 13, P.mag, 'close', { is: 12 });
        townMap(ctx, t);
        SPOTS.forEach(([id, x, y, ic, c, n], i) => { const on = id === 'forest' && lt > 1.45; const q = E.outBack(clamp((lt - 0.8 - i * 0.06) / 0.3), 2.2); const bob = on ? -Math.abs(Math.sin(t * 6)) * 5 : 0; ctx.save(); ctx.translate(x, y - 10 + bob); ctx.scale(q * (on ? 1.2 : 1), q * (on ? 1.2 : 1)); orb(ctx, 0, 0, 15, c, ic, { is: 16 }); ctx.restore(); rr(ctx, x - 28, y + 10, 56, 17, 8.5); ctx.fillStyle = on ? c : '#fff'; ctx.fill(); text(ctx, n, x, y + 19, { font: ZB(900, 9.5), color: on ? '#fff' : P.ink, align: 'center', base: 'middle' }); });
        ctx.save(); ctx.beginPath(); ctx.arc(150, 352, 14, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = P.mag; ctx.lineWidth = 2.5; ctx.stroke(); ctx.clip(); ch(ctx, 'mochi', A.idle(t, 1, { noShadow: true }), 150, 378, 0.7, t); ctx.restore();
        const ic = E.outBack(clamp((lt - 1.6) / 0.35), 1.6);
        if (ic > 0) { ctx.save(); ctx.translate(0, (1 - ic) * 100); card(ctx, 22, 486, 316, 128, { r: 18, fill: '#F4F7FB' }); orb(ctx, 52, 520, 18, P.lime, 'leaf', { is: 18 }); text(ctx, '森林公園', 80, 516, { font: ZB(900, 17), color: P.ink }); text(ctx, '小雨 ・ 走路 3 分', 80, 536, { font: ZB(700, 10.5), color: P.ink2 }); thought(ctx, 300, 520, 'heart', P.mag, t, 1); text(ctx, '栗子也想去！', 36, 572, { font: ZB(700, 11), color: P.mag }); gloss(ctx, 214, 562, 112, 36, P.lime, '出發！', { font: ZB(900, 14), pressed: lt > 2.45 && lt < 2.6 }); ctx.restore(); }
        ctx.restore();
      }
      if (lt > 2.6) stripes(ctx, (lt - 2.6) / 0.3, [P.mag, P.yellow, P.blue, P.lime, P.orange, P.purple], true);
    } else {
      const w = walkPath([{ t: 3.0, x: 186, y: 660 }, { t: 4.6, x: 182, y: 520 }], lt, 12);
      Wd.drawPark(ctx, { t, chars: [{ d: 'mochi', s: A.idle(t, 1, { back: 0.85, walk: w.moving ? 1 : 0, phase: w.phase, hold: 'leaf' }), x: w.x, y: w.y, sc: 1.4 }] });
      if (lt < 3.2) stripes(ctx, (lt - 2.75) / 0.45, [P.mag, P.yellow, P.blue, P.lime, P.orange, P.purple], false);
      const cq = E.outCubic(clamp((lt - 3.3) / 0.35));
      if (cq > 0) { ctx.save(); ctx.translate((1 - cq) * -360, 0); ctx.fillStyle = P.mag; ctx.beginPath(); ctx.moveTo(0, 96); ctx.lineTo(250, 96); ctx.lineTo(232, 136); ctx.lineTo(0, 136); ctx.closePath(); ctx.fill(); text(ctx, '森林公園', 28, 124, { font: ZB(900, 22), color: '#fff' }); ctx.fillStyle = P.yellow; ctx.fillRect(0, 136, 180, 20); text(ctx, '小雨 ・ 下午 2:41', 28, 150, { font: ZB(900, 10), color: P.ink }); ctx.restore(); }
    }
    statusBar(ctx, '10:41', lt > 2.8 ? '#fff' : P.ink);
    stylus(ctx, finger([{ t: 0.05, x: 250, y: 560 }, { t: 0.25, x: 212, y: 596 }, { t: 0.3, x: 212, y: 596, down: true }, { t: 0.45, x: 212, y: 596 }, { t: 1.2, x: 120, y: 300 }, { t: 1.38, x: 90, y: 210 }, { t: 1.45, x: 90, y: 210, down: true }, { t: 1.6, x: 90, y: 210 }, { t: 2.3, x: 270, y: 580 }, { t: 2.45, x: 270, y: 580, down: true }, { t: 2.6, x: 270, y: 580 }], lt));
  }

  // ---------------- 7. INVENTORY ----------------
  function inventory(ctx, lt, t) {
    dp(ctx);
    const f = finger([{ t: 0.0, x: 230, y: 560 }, { t: 0.2, x: 262, y: 596 }, { t: 0.25, x: 262, y: 596, down: true }, { t: 0.4, x: 262, y: 596 }, { t: 0.85, x: 124, y: 462 }, { t: 0.95, x: 124, y: 462, down: true }, { t: 1.45, x: 124, y: 462, down: true }, { t: 2.25, x: 180, y: 226, down: true }, { t: 2.3, x: 180, y: 226 }], lt);
    const ev = A.eat(lt, t, f, 180, 262);
    town(ctx, t, { x: 186, y: 506, z: 1.95 }, 0, [{ d: 'mochi', s: ev.s, x: 186, y: 474, emote: ev.happy ? { kind: '♥', p: clamp((ev.eatT - 0.9) / 1.3) } : null }]);
    const open = E.outBack(clamp((lt - 0.3) / 0.4), 1.2) * (1 - E.inOutCubic(clamp((lt - 1.5) / 0.4)) * 0.55);
    if (open < 0.05) hud(ctx, t, { bagPress: lt > 0.2 && lt < 0.4 });
    if (open > 0.01) {
      ctx.save(); ctx.translate(0, (1 - open) * 300);
      card(ctx, 10, 384, 340, 248, { r: 24, head: P.orange, hh: 36, title: '背包' });
      [['食物', P.orange], ['禮物', P.mag], ['衣服', P.blue], ['家具', P.lime]].forEach(([n, c], i) => { const y = 432 + i * 44, on = i === 0; rr(ctx, 18, y, 66, 36, 12); ctx.fillStyle = on ? c : '#F0F2F7'; ctx.fill(); text(ctx, n, 51, y + 18.5, { font: ZB(900, 12), color: on ? '#fff' : P.ink2, align: 'center', base: 'middle' }); });
      DATA.items.slice(0, 6).forEach((it, i) => {
        const x = 124 + (i % 3) * 78, y = 462 + Math.floor(i / 3) * 84;
        rr(ctx, x - 34, y - 32, 68, 76, 14); ctx.fillStyle = '#F4F7FB'; ctx.fill();
        if (!(it.id === 'cake' && lt > 0.95 && lt < 2.32)) itemF(ctx, it.id, x, y - 4, 40);
        text(ctx, it.zh, x, y + 34, { font: ZB(700, 9.5), color: P.ink, align: 'center' });
        rr(ctx, x + 12, y - 30, 20, 14, 7); ctx.fillStyle = P.ink; ctx.fill(); text(ctx, '×' + (it.id === 'cake' && lt > 2.32 ? it.n - 1 : it.n), x + 22, y - 22.5, { font: B(900, 8.5), color: '#fff', align: 'center', base: 'middle' });
      });
      ctx.restore();
    }
    if (f && lt > 0.95 && lt < 1.45) { ctx.strokeStyle = P.mag; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(f.x, f.y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * ((lt - 0.95) / 0.5)); ctx.stroke(); }
    if (f && lt > 0.95 && lt < 2.32) { ctx.save(); ctx.translate(f.x, f.y - 26); ctx.rotate(Math.sin(t * 7) * 0.1); itemF(ctx, 'cake', 0, 0, 48); ctx.restore(); }
    if (ev.chew) cap(ctx, Math.floor(lt * 8) % 2 ? '嚼～' : '嚼嚼', 262, 210, 18, P.orange);
    if (ev.happy) { const q = clamp((ev.eatT - 0.9) / 1.0), a = clamp((ev.eatT - 0.9) / 0.15) * clamp((2.9 - ev.eatT) / 0.3); burst(ctx, 180, 150, 90, P.yellow, t, a * 0.8); ctx.save(); ctx.globalAlpha = a; const s = E.outBack(clamp((ev.eatT - 0.9) / 0.3), 2.6); ctx.translate(180, 150); ctx.scale(s, s); cap(ctx, '好吃！', 0, 0, 34, P.mag); ctx.restore(); ctx.save(); ctx.globalAlpha = a; card(ctx, 110, 172, 140, 30, { r: 15 }); orb(ctx, 128, 187, 10, P.mag, 'heart', { is: 11 }); rr(ctx, 144, 183, 70, 8, 4); ctx.fillStyle = P.line; ctx.fill(); rr(ctx, 144, 183, 70 * lerp(0.42, 0.6, E.outCubic(q)), 8, 4); ctx.fillStyle = P.mag; ctx.fill(); text(ctx, '+18', 238, 188, { font: B(900, 11), color: P.mag, align: 'center', base: 'middle' }); ctx.restore(); }
    statusBar(ctx, '10:45');
    stylus(ctx, f);
  }

  // ---------------- 8. SHOP ----------------
  function shop(ctx, lt, t) {
    dp(ctx); shapesBg(ctx, t);
    card(ctx, 12, 30, 336, 150, { r: 22, head: P.orange, hh: 36, title: '便利商店' });
    const sold = lt > 1.45;
    ctx.save(); rr(ctx, 24, 74, 110, 96, 14); ctx.fillStyle = '#E8F6FF'; ctx.fill(); ctx.clip(); for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#fff' : P.orange; ctx.fillRect(24 + k * 19, 74, 19, 14); } ch(ctx, 'sora', A.idle(t, 3, { eyes: sold ? 'happy' : 'round', mouth: sold ? 'grin' : 'smile', armR: sold ? -2.3 + Math.sin(t * 10) * 0.3 : undefined }), 79, 220, 2.0, t); ctx.restore();
    text(ctx, sold ? '謝謝光臨！' : '歡迎光臨～', 146, 104, { font: ZB(900, 15), color: P.ink });
    text(ctx, '今日推薦：會發光的蘑菇檯燈', 146, 126, { font: ZB(700, 10), color: P.ink2 });
    const coins = lerp(DATA.coins, DATA.coins - 120, E.outCubic(clamp((lt - 1.5) / 0.6)));
    card(ctx, 228, 140, 108, 28, { r: 14, fill: '#F4F7FB' }); orb(ctx, 242, 154, 10, P.yellow, 'coin', { is: 12, lw: 2.2 }); text(ctx, fmt(coins), 326, 155, { font: B(900, 13), color: P.ink, align: 'right', base: 'middle' });
    card(ctx, 12, 190, 336, 300, { r: 22 });
    [['家具', P.orange], ['食物', P.mag], ['服飾', P.blue]].forEach(([n, c], i) => { const x = 22 + i * 74, on = i === 0; rr(ctx, x, 202, 66, 26, 13); ctx.fillStyle = on ? c : '#F0F2F7'; ctx.fill(); text(ctx, n, x + 33, 215.5, { font: ZB(900, 11.5), color: on ? '#fff' : P.ink2, align: 'center', base: 'middle' }); });
    DATA.shop.forEach((s, i) => {
      const x = 26 + (i % 2) * 160, y = 240 + Math.floor(i / 2) * 120, sel = i === 0 && lt > 0.55;
      const wig = sel ? wobble(lt - 0.55, 3, 5) * 0.06 : 0;
      ctx.save(); ctx.translate(x + 74, y + 54); ctx.scale(1 + wig, 1 + wig); ctx.translate(-x - 74, -y - 54);
      rr(ctx, x, y, 148, 108, 16); ctx.fillStyle = sel ? '#FFF1E0' : '#F4F7FB'; ctx.fill(); if (sel) { ctx.strokeStyle = P.orange; ctx.lineWidth = 3; ctx.stroke(); }
      itemF(ctx, s.id, x + 48, y + 48, 54);
      text(ctx, s.zh, x + 92, y + 40, { font: ZB(900, 11), color: P.ink, align: 'center' });
      rr(ctx, x + 70, y + 54, 46, 20, 10); ctx.fillStyle = P.yellow; ctx.fill(); text(ctx, String(s.price), x + 93, y + 64.5, { font: B(900, 11), color: P.ink, align: 'center', base: 'middle' });
      if (i === 0 && sold) { const q = clamp((lt - 1.45) / 0.15); ctx.save(); ctx.translate(x + 74, y + 58); ctx.rotate(-0.2); ctx.scale(lerp(1.8, 1, E.inCubic(q)), lerp(1.8, 1, E.inCubic(q))); ctx.globalAlpha = q; rr(ctx, -46, -16, 92, 32, 8); ctx.strokeStyle = P.mag; ctx.lineWidth = 3; ctx.stroke(); text(ctx, '已購買！', 0, 1, { font: ZB(900, 15), color: P.mag, align: 'center', base: 'middle' }); ctx.restore(); }
      ctx.restore();
    });
    const bb = E.outBack(clamp((lt - 0.75) / 0.35), 1.6);
    if (bb > 0) { ctx.save(); ctx.translate(0, (1 - bb) * 140); card(ctx, 12, 500, 336, 112, { r: 22 }); itemF(ctx, 'lamp', 60, 554, 62); text(ctx, '蘑菇檯燈', 106, 540, { font: ZB(900, 16), color: P.ink }); text(ctx, '晚上會發出暖暖的光，讓房間更可愛。', 106, 560, { font: ZB(700, 9.5), color: P.ink2 }); gloss(ctx, 210, 572, 124, 32, sold ? P.lime : P.orange, sold ? '放進背包了' : '購買 120', { font: ZB(900, 13), pressed: lt > 1.25 && lt < 1.42 }); ctx.restore(); }
    if (lt > 1.45 && lt < 2.3) for (let i = 0; i < 6; i++) { const q = E.inOutCubic(clamp((lt - 1.45 - i * 0.06) / 0.55)); if (q <= 0 || q >= 1) continue; orb(ctx, lerp(272, 242, q) + Math.sin(q * Math.PI) * (i - 2.5) * 10, lerp(588, 154, q) - Math.sin(q * Math.PI) * 30, 7, P.yellow, 'coin', { is: 8, lw: 1.8 }); }
    statusBar(ctx, '10:52');
    stylus(ctx, finger([{ t: 0.3, x: 200, y: 320 }, { t: 0.5, x: 100, y: 294 }, { t: 0.55, x: 100, y: 294, down: true }, { t: 0.7, x: 100, y: 294 }, { t: 1.12, x: 272, y: 588 }, { t: 1.25, x: 272, y: 588, down: true }, { t: 1.42, x: 272, y: 588 }], lt));
  }

  // ---------------- 9. STUDIO (TV studio) ----------------
  const STROKE = (() => { const p = []; for (let i = 0; i <= 30; i++) { const a = i / 30; p.push([236 + a * 34, 174 - Math.sin(a * Math.PI) * 30]); } return p; })();
  function studio(ctx, lt, t) {
    dp(ctx); shapesBg(ctx, t);
    card(ctx, 12, 30, 336, 36, { r: 18, head: P.purple, hh: 36, title: '動畫劇場' });
    const playing = lt > 2.35, frames = lt > 1.75 ? 6 : 5, cur = playing ? Math.floor((lt - 2.35) * 8) % frames : frames - 1;
    const earF = (k) => [0, 0.3, 0.6, 0.7, 0.4, 0.1][((k % 6) + 6) % 6];
    // TV set
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(150, 84); ctx.lineTo(128, 70); ctx.moveTo(210, 84); ctx.lineTo(232, 70); ctx.stroke(); orb(ctx, 128, 70, 5, P.mag, null); orb(ctx, 232, 70, 5, P.yellow, null);
    gloss(ctx, 24, 84, 312, 286, P.purple, null, { r: 34 });
    rr(ctx, 40, 100, 280, 232, 22); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.save(); rr(ctx, 40, 100, 280, 232, 22); ctx.clip();
    ctx.fillStyle = '#E8F6FF'; ctx.fillRect(40, 270, 280, 70);
    if (!playing) { ctx.save(); ctx.globalAlpha = 0.3; ch(ctx, Object.assign({}, Q.DES.mochi, { fur: '#FFC9E0', shirt: '#FFB3D1' }), { earR: earF(cur - 1), armR: -earF(cur - 1) * 3, noShadow: true }, 180, 320, 3.0, t); ctx.restore(); }
    ch(ctx, 'mochi', { earR: earF(cur), armR: -earF(cur) * 3, eyes: cur > 2 ? 'happy' : 'round', mouth: cur > 2 ? 'grin' : 'smile', noShadow: true }, 180, 320, 3.0, t);
    const sp = playing ? 1 : clamp((lt - 0.3) / 1.0);
    if (sp > 0) { ctx.strokeStyle = P.mag; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); STROKE.slice(0, Math.max(2, Math.floor(STROKE.length * sp))).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
    ctx.restore();
    if (playing && Math.floor(t * 2) % 2 === 0) { rr(ctx, 248, 108, 64, 20, 10); ctx.fillStyle = '#FF3B5C'; ctx.fill(); text(ctx, '● ON AIR', 280, 118.5, { font: B(900, 9.5), color: '#fff', align: 'center', base: 'middle' }); }
    for (const [x, c] of [[64, P.yellow], [96, P.lime]]) orb(ctx, x, 352, 8, c, null);
    // tools
    [['brush', P.mag], ['eraser', P.orange], ['onion', P.teal], ['layers', P.blue]].forEach(([ic, c], i) => orb(ctx, 44 + i * 50, 404, i === 0 ? 19 : 16, c, ic, { is: 16 }));
    orb(ctx, 314, 404, 21, P.lime, playing ? 'pause' : 'play', { pressed: lt > 2.22 && lt < 2.36, is: 18 });
    // film strip
    rr(ctx, 10, 438, 340, 116, 14); ctx.fillStyle = P.ink; ctx.fill();
    for (let k = 0; k < 17; k++) { rr(ctx, 18 + k * 20, 444, 10, 7, 2); ctx.fillStyle = '#fff'; ctx.fill(); rr(ctx, 18 + k * 20, 541, 10, 7, 2); ctx.fill(); }
    for (let i = 0; i < frames; i++) {
      const x = 22 + i * 54, y = 458, pop = i === 5 ? E.outBack(clamp((lt - 1.75) / 0.3), 2.2) : 1;
      ctx.save(); ctx.translate(x + 23, y + 37); ctx.scale(pop, pop); ctx.translate(-x - 23, -y - 37);
      rr(ctx, x, y, 46, 74, 6); ctx.fillStyle = '#fff'; ctx.fill(); if (i === cur) { ctx.strokeStyle = P.yellow; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.save(); rr(ctx, x, y, 46, 74, 6); ctx.clip(); ch(ctx, 'mochi', { earR: earF(i), armR: -earF(i) * 3, noShadow: true }, x + 23, y + 68, 0.85, 0); ctx.restore();
      ctx.restore();
    }
    if (frames < 6 || lt < 2.05) orb(ctx, 22 + frames * 54 + 22, 495, 15, P.mag, 'plus', { is: 16, pressed: lt > 1.68 && lt < 1.82 });
    card(ctx, 12, 566, 336, 50, { r: 18 }); text(ctx, '8 fps ・ 6 格 ・ 耳朵揮揮', 30, 595, { font: ZB(900, 12), color: P.ink }); gloss(ctx, 252, 576, 84, 30, P.mag, '分享', { font: ZB(900, 12) });
    statusBar(ctx, '11:03');
    const pk = STROKE.filter((_, i) => i % 4 === 0).map((p, i) => ({ t: 0.3 + i * 0.13, x: p[0], y: p[1], down: true }));
    stylus(ctx, finger([{ t: 0.1, x: 220, y: 230 }, ...pk, { t: 1.45, x: 300, y: 420 }, { t: 1.62, x: 314, y: 495 }, { t: 1.7, x: 314, y: 495, down: true }, { t: 1.85, x: 314, y: 495 }, { t: 2.12, x: 314, y: 404 }, { t: 2.22, x: 314, y: 404, down: true }, { t: 2.38, x: 314, y: 404 }], lt));
  }

  // ---------------- 10. PET ----------------
  function pet(ctx, lt, t) {
    dp(ctx);
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#7FD3FF'); g.addColorStop(1, '#E3F4FF'); ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    for (let i = 0; i < 10; i++) { const x = (i * 97 + t * 10) % 420 - 30, y = 240 + (i * 61) % 400; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.4 + i); ctx.globalAlpha = 0.2; ctx.fillStyle = [P.mag, P.yellow, P.lime, '#fff'][i % 4]; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); ctx.restore(); }
    cap(ctx, '21:42', 34, 180, 54, P.ink, { align: 'left', font: B(900, 54) }); text(ctx, '11月4日 星期三・18°', 40, 210, { font: ZB(700, 13), color: P.ink });
    A.APPS.forEach(([ic, n], i) => { const [x, y] = A.appPos(i); gloss(ctx, x - 24, y - 24, 48, 48, [P.lime, P.mag, P.purple, P.blue, P.yellow, P.teal, '#9AA0B2', P.orange][i], null, { icon: ic, is: 24, r: 16 }); text(ctx, n, x, y + 39, { font: ZB(700, 10), color: P.ink, align: 'center' }); });
    card(ctx, 20, 520, 320, 70, { r: 28, fill: 'rgba(255,255,255,0.6)' });
    ['chat', 'camera', 'music', 'gear'].forEach((n, i) => { const x = 62 + i * 79; gloss(ctx, x - 22, 533, 44, 44, '#FFFFFF', null, { r: 15 }); V.icon(ctx, n, x, 555, 22, P.ink, 2.4); });
    statusBar(ctx, '21:42');
    const pp = A.pet(lt, t);
    ctx.save(); ctx.translate(pp.x, pp.y - 46); ctx.rotate(pp.swing); ctx.translate(-pp.x, -(pp.y - 46)); ch(ctx, 'mochi', pp.s, pp.x, pp.y, 1.05, t); ctx.restore();
    if (pp.mode === 'drag') cap(ctx, '哇哇！', pp.x + 34, pp.y - 64, 15, P.mag);
    if (pp.mode === 'sit' && lt > 3.9) { thought(ctx, pp.x + 24, pp.y - 70, 'heart', P.mag, t, clamp((lt - 3.9) / 0.3)); }
    card(ctx, 52, 30, 256, 26, { r: 13 }); ctx.beginPath(); ctx.arc(70, 43, 4, 0, TAU); ctx.fillStyle = P.mag; ctx.fill();
    text(ctx, 'Android 懸浮桌寵 · 視覺模擬（未實機驗證）', 186, 43.5, { font: ZB(700, 9.5), color: P.ink, align: 'center', base: 'middle' });
    stylus(ctx, pp.f);
  }

  // ---------------- 11. END ----------------
  function end(ctx, lt, t) {
    dp(ctx); shapesBg(ctx, t, '#FFFFFF');
    const a = E.outBack(clamp(lt / 0.5), 1.6);
    ctx.save(); ctx.translate(180, 380); ctx.scale(a, a); ctx.translate(-180, -380);
    ch(ctx, 'mochi', A.idle(t, 1, { eyes: 'happy', mouth: 'grin', armR: -2.2 + Math.sin(t * 9) * 0.35 }), 126, 316, 1.6, t);
    ch(ctx, 'kuri', A.idle(t, 2, { face: -0.3, eyes: 'happy', mouth: 'smile' }), 190, 320, 1.5, t);
    ch(ctx, 'sora', A.idle(t, 3, { face: -0.4, eyes: 'sleepy' }), 250, 324, 1.4, t);
    rr(ctx, 140, 352, 80, 22, 11); ctx.fillStyle = P.mag; ctx.fill(); text(ctx, '方案 F', 180, 363.5, { font: ZB(900, 11), color: '#fff', align: 'center', base: 'middle' });
    cap(ctx, '奇趣鎮', 180, 420, 36, P.ink);
    text(ctx, 'QUIRKVILLE', 180, 448, { font: B(900, 14), color: P.blue, align: 'center', ls: 3 });
    text(ctx, '亮面玩具質感 · 滑桿捏臉 · 居民心願泡泡 · 喜劇節奏', 180, 480, { font: ZB(700, 11), color: P.ink2, align: 'center' });
    ctx.restore();
  }

  function transition(ctx, A_, B, p) {
    const cols = [P.mag, P.yellow, P.blue, P.lime, P.orange, P.purple];
    ctx.drawImage(p < 0.5 ? A_ : B, 0, 0);
    ctx.save(); ctx.scale(OC.DP, OC.DP);
    if (p < 0.5) stripes(ctx, p * 2, cols, true); else stripes(ctx, (p - 0.5) * 2, cols, false);
    ctx.restore();
  }
  function chapter(ctx, s, a, idx) {
    if (s.id === 'pet' || s.id === 'end' || s.id === 'logo') return;
    ctx.scale(OC.DP, OC.DP); ctx.globalAlpha = a;
    const label = `${String(idx).padStart(2, '0')} ${s.zh}`; ctx.font = ZB(700, 8.5); const w = ctx.measureText(label).width + 20;
    rr(ctx, 180 - w / 2, 4, w, 16, 8); ctx.fillStyle = P.ink; ctx.fill();
    text(ctx, label, 180, 12.5, { font: ZB(700, 8.5), color: '#fff', align: 'center', base: 'middle' });
  }

  OC.themes.quirk = {
    id: 'quirk', name: '奇趣鎮 Quirkville', short: 'F',
    fonts: [
      { family: 'Noto Sans TC', url: 'assets/fonts/NotoSansTC-Bold.woff', descriptors: { weight: '700' } },
      { family: 'Noto Sans TC', url: 'assets/fonts/NotoSansTC-Black.woff', descriptors: { weight: '900' } },
      { family: 'Nunito', url: 'assets/fonts/Nunito-Black.woff', descriptors: { weight: '900' } },
    ],
    shots: { logo, island, creator, profile, dialogue, map, inventory, shop, studio, pet, end },
    transition, chapter,
  };
})();
