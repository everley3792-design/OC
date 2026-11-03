/* Scheme C — Inkpot Tales : storyboard shots */
(function () {
  'use strict';
  const { TAU, clamp, lerp, E, spring, wobble, rng, finger, walkPath, typewriter, blink, breath, DATA, mix, rgba, text } = OC;
  const { P, F, setBoil, ink, blob, blobPts, inkLine, inkPath, hatchArea, card, tape, stamp, inkBtn, icon, item, touch, statusBar } = OC.S;
  const C = OC.S.CHAR, Wd = OC.S.WORLD;

  const q12 = (t) => Math.floor(t * 12) / 12; // animate "on twos"
  const idle = (t, seed, o = {}) => { const tq = q12(t); return Object.assign({ breath: breath(tq, 0.4, seed * 0.2), blink: blink(tq, seed), tail: Math.sin(tq * 2.4 + seed) * 0.3 }, o); };
  const dp = (ctx, t) => { ctx.scale(OC.DP, OC.DP); setBoil(t); };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  function paper(ctx, c = P.paper) { ctx.fillStyle = c; ctx.fillRect(0, 0, 360, 640); }
  function heading(ctx, s, x, y, opt = {}) {
    text(ctx, s, x, y, { font: F(opt.size || 20, 700), color: P.ink, align: opt.align || 'left' });
    ctx.font = F(opt.size || 20, 700); const w = ctx.measureText(s).width;
    const x0 = opt.align === 'center' ? x - w / 2 : x;
    inkLine(ctx, [[x0 - 2, y + 6], [x0 + w * 0.5, y + 4], [x0 + w + 4, y + 6.5]], 2.2, rgba(opt.ul || P.mustard, 0.8), 77, 0.6);
  }
  function backBtn(ctx) { stamp(ctx, 30, 50, 14, 'back', P.ink, { fill: P.card, rot: 0 }); }

  function hud(ctx, t, o = {}) {
    const lt = o.lt ?? 9, night = o.night || 0;
    const on = (k) => E.outBack(clamp((lt - 0.3 - k * 0.12) / 0.35), 1.6);
    let q = on(0);
    if (q > 0) { ctx.save(); ctx.translate(16, 30); ctx.scale(q, q); card(ctx, 0, 0, 120, 30, { rot: -0.03, id: 11, fill: P.card }); tape(ctx, 8, 2, 22, -0.6, P.rose); icon(ctx, night > 0.55 ? 'moon' : 'sun', 18, 15, 15); text(ctx, '春·3日', 32, 20, { font: F(11), color: P.ink2 }); text(ctx, o.clock || '10:20', 110, 20, { font: F(13, 700), color: P.ink, align: 'right' }); ctx.restore(); }
    q = on(1);
    if (q > 0) { ctx.save(); ctx.translate(344, 45); ctx.scale(q, q); card(ctx, -86, -15, 86, 30, { rot: 0.03, id: 12 }); icon(ctx, 'coin', -70, 0, 15); text(ctx, fmt(o.coins ?? DATA.coins), -8, 5, { font: F(13, 700), color: P.ink, align: 'right' }); ctx.restore(); }
    q = on(2);
    if (q > 0) { ctx.save(); ctx.translate(48, 594); ctx.scale(q, q); ctx.rotate(-0.06); card(ctx, -32, -36, 64, 74, { id: 13, fill: '#FFFFFF' }); ctx.fillStyle = P.sky; ctx.fillRect(-27, -31, 54, 50); ctx.save(); ctx.beginPath(); ctx.rect(-27, -31, 54, 50); ctx.clip(); C.draw(ctx, 'mochi', idle(t, 1, { noShadow: true }), 0, 46, 1.25, q12(t)); ctx.restore(); text(ctx, '麻糬 ♥', 0, 32, { font: F(10, 700), color: P.ink, align: 'center' }); tape(ctx, 0, -36, 26, 0.1, P.mustard); ctx.restore(); }
    q = on(3);
    if (q > 0) {
      stamp(ctx, 318, 590, 25 * (o.bagPress || 1), 'bag', P.ink, { fill: P.card, scale: q, rot: 0.05 });
      stamp(ctx, 262, 602, 19 * (o.mapPress || 1), 'map', P.ink, { fill: P.card, scale: q, rot: -0.06 });
      stamp(ctx, 324, 534, 15, 'menu', P.ink, { fill: P.card, scale: q, rot: 0 });
    }
  }

  // ---------------- 1. LOGO ----------------
  function logo(ctx, lt, t) {
    dp(ctx, t); paper(ctx);
    // doodle stars
    const r = rng(4);
    for (let i = 0; i < 9; i++) { const x = 30 + r() * 300, y = 80 + r() * 480, d = r() * 1.5; const q = E.outBack(clamp((lt - 0.4 - d) / 0.3), 2); if (q > 0) { ctx.save(); ctx.translate(x, y); ctx.scale(q, q); icon(ctx, i % 3 ? 'star' : 'heart', 0, 0, 10 + (i % 3) * 3); ctx.restore(); } }
    // title written left -> right (pen reveal)
    ctx.save();
    ctx.font = F(52, 700); const w = ctx.measureText('OC Shimeji').width;
    const rev = E.inOutSine(clamp((lt - 0.1) / 1.0));
    ctx.beginPath(); ctx.rect(180 - w / 2 - 4, 180, (w + 8) * rev, 80); ctx.clip();
    text(ctx, 'OC Shimeji', 182, 252, { font: F(52, 700), color: P.terra, align: 'center' });
    text(ctx, 'OC Shimeji', 180, 250, { font: F(52, 700), color: P.ink, align: 'center' });
    ctx.restore();
    if (rev < 1 && rev > 0) { const px = 180 - w / 2 + w * rev, py = 236; ctx.save(); ctx.translate(px, py); ctx.rotate(0.6); ink(ctx, [[0, 0], [4, -2], [4, -30], [-4, -30], [-4, -2]], P.mustard, { id: 3, lw: 1.4 }); ctx.restore(); }
    // underline swash draws on
    const sw = clamp((lt - 1.0) / 0.5);
    if (sw > 0) { const pts = []; for (let i = 0; i <= 20 * sw; i++) { const q = i / 20; pts.push([70 + q * 220, 268 + Math.sin(q * Math.PI * 2) * 3 - q * 4]); } if (pts.length > 1) inkLine(ctx, pts, 3, P.teal, 9, 0.4); }
    // red seal slams in
    const sl = clamp((lt - 1.35) / 0.18);
    if (sl > 0) { const s = lerp(1.7, 1, E.inCubic(sl)) + wobble(lt - 1.53, 4, 9) * 0.06; stamp(ctx, 292, 196, 22, null, P.red, { scale: s, rot: -0.2, label: '桌寵', ls: 13, alpha: sl }); if (lt > 1.53) { const r2 = rng(2); for (let i = 0; i < 7; i++) blob(ctx, 292 + (r2() - 0.5) * 70, 196 + (r2() - 0.5) * 60, 1.2 + r2(), 1.2 + r2(), P.red, { lw: 0, id: i, n: 5 }); } }
    text(ctx, '我的 OC，住進你的手機', 180, 304, { font: F(14), color: P.ink2, align: 'center', alpha: clamp((lt - 1.3) / 0.4), ls: 2 });
    // Mochi "drawn on": revealed by a diagonal wipe, then waves
    const dr = clamp((lt - 0.7) / 0.9);
    if (dr > 0) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(0, 640); ctx.lineTo(0, 640 - dr * 900); ctx.lineTo(dr * 700, 640); ctx.closePath(); ctx.clip();
      C.draw(ctx, 'mochi', idle(t, 1, { eyes: lt > 1.9 ? 'happy' : 'round', mouth: lt > 1.9 ? 'smile' : 'cat', armR: lt > 1.9 ? (Math.floor(lt * 6) % 2 ? -2.6 : -2.1) : undefined }), 180, 470, 2.6, q12(t));
      ctx.restore();
    }
  }

  // ---------------- 2. ISLAND ----------------
  const WALK = [{ t: 0.9, x: 150, y: 386 }, { t: 2.7, x: 214, y: 418 }];
  function island(ctx, lt, t) {
    dp(ctx, t);
    const tq = q12(t), lq = q12(lt);
    const night = E.inOutSine(clamp((lt - 3.7) / 2.1));
    const w = walkPath(WALK, lq, 12);
    const turn = lq - 2.75;
    const face = lq < 2.75 ? (lq > 0.7 ? 0.9 : 0) : turn < 0.17 ? 0.45 : 0;
    const look = clamp((lt - 4.0) / 0.4);
    const ms = idle(t, 1, { face, walk: w.moving ? 1 : 0, phase: w.phase, armR: lq > 3.0 && lq < 3.9 ? (Math.floor(lt * 6) % 2 ? -2.6 : -2.0) : undefined, eyes: lq > 3.0 && lq < 3.9 ? 'happy' : look > 0.5 ? 'sparkle' : 'round', mouth: lq > 3.0 && lq < 3.9 ? 'smile' : look > 0.5 ? 'o' : 'cat', lookY: -look * 1.5, earL: wobble(turn, 3, 4) * 0.5, earR: wobble(turn - 0.08, 3, 4) * 0.5, squash: turn > 0 && turn < 0.1 ? 0.92 : 1 });
    const z = lerp(0.95, 1.3, E.inOutCubic(clamp((lt + 0.3) / 2.7)));
    Wd.drawVillage(ctx, { t: tq, night, cam: { x: lerp(186, w.x, 0.6 * clamp(lt / 2.7)), y: lerp(360, w.y - 30, 0.7 * clamp(lt / 2.7)), z }, chars: [
      { d: 'mochi', s: ms, x: w.x, y: w.y, emote: lt > 4.5 ? { kind: '♪', p: clamp((lt - 4.5) / 1.4) } : null },
      { d: 'kuri', s: idle(t, 2, { face: 0.6 }), x: 246, y: 520 },
      { d: 'sora', s: idle(t, 3, { eyes: 'sleepy', mouth: 'flat' }), x: 330, y: 452, emote: { kind: 'zzz', p: (t * 0.3) % 1 } },
    ] });
    const mins = lerp(620, 1265, night);
    const clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
    hud(ctx, t, { lt, night, clock });
    statusBar(ctx, clock, night > 0.6 ? P.card : P.ink);
  }

  // ---------------- 3. CREATOR (sticker sheet) ----------------
  const EYES = ['round', 'sparkle', 'happy', 'sleepy', 'wide', 'dot', 'round', 'sleepy'];
  const EARS = ['cat', 'bunny', 'bear', 'fold', 'sprout', 'cat', 'bunny', 'bear'];
  const POTS = [P.cream, '#F6D2C4', '#D9D2F0', '#CFE6E3', '#E5EDC4', '#E7C08F'];
  function creator(ctx, lt, t) {
    dp(ctx, t); paper(ctx);
    // spiral binding
    for (let i = 0; i < 16; i++) { ctx.fillStyle = P.paper3; ctx.beginPath(); ctx.arc(10, 40 + i * 38, 4, 0, TAU); ctx.fill(); inkLine(ctx, [[2, 36 + i * 38], [12, 38 + i * 38], [14, 44 + i * 38]], 1.4, P.ink2, i); }
    backBtn(ctx);
    heading(ctx, '捏捏臉', 56, 58, { size: 22 });
    text(ctx, '把貼紙貼到臉上試試看！', 58, 82, { font: F(11), color: P.ink2 });
    // index tabs (right edge)
    const tab = lt < 1.75 ? 0 : 4;
    ['眼', '眉', '嘴', '腮', '耳', '色'].forEach((n, i) => { const y = 112 + i * 40, act = i === tab; card(ctx, act ? 322 : 330, y, 40, 34, { fill: [P.rose, P.mustard, P.teal, P.lilac, P.grass, P.sand][i], id: 30 + i, deckle: 0.6 }); text(ctx, n, act ? 340 : 348, y + 22, { font: F(14, 700), color: P.ink, align: 'center' }); });
    const f = finger([
      { t: 0.45, x: 220, y: 600 }, { t: 0.7, x: 118, y: 498 }, { t: 0.78, x: 118, y: 498, down: true }, { t: 1.05, x: 168, y: 258, down: true }, { t: 1.12, x: 168, y: 258 },
      { t: 1.55, x: 340, y: 285 }, { t: 1.65, x: 340, y: 285, down: true }, { t: 1.78, x: 340, y: 285 },
      { t: 2.05, x: 118, y: 498 }, { t: 2.12, x: 118, y: 498, down: true }, { t: 2.42, x: 168, y: 196, down: true }, { t: 2.5, x: 168, y: 196 },
      { t: 2.85, x: 112, y: 612 }, { t: 2.92, x: 112, y: 612, down: true }, { t: 3.05, x: 112, y: 612 },
      { t: 3.4, x: 130, y: 280 }, { t: 3.48, x: 130, y: 280, down: true }, { t: 4.1, x: 230, y: 282, down: true }, { t: 4.2, x: 230, y: 282 }], lt);
    const eyeSel = lt > 1.06 ? 1 : 0, earSel = lt > 2.44 ? 1 : 0, colP = clamp((lt - 2.95) / 0.35);
    const D = Object.assign({}, C.DESIGNS.mochi, { fur: mix(P.cream, POTS[2], colP), shade: mix('#E9D9BE', '#B9AEDF', colP) });
    const drag = clamp((lt - 3.48) / 0.62);
    const face = lt < 4.1 ? Math.round(drag * 4) / 4 * 0.9 : lt < 4.25 ? 0.45 : 0;
    // spotlight doodle
    blob(ctx, 168, 262, 108, 104, rgba(P.mustard, 0.18), { lw: 1.2, id: 41, n: 18, wob: 0.06, stroke: rgba(P.ink, 0.5) });
    const pop = (lt > 1.06 && lt < 1.3) || (lt > 2.44 && lt < 2.68);
    C.draw(ctx, D, idle(t, 1, { face, eyes: pop ? 'happy' : EYES[eyeSel], mouth: pop ? 'open' : 'cat', ears: EARS[earSel], squash: pop ? (Math.floor(lt * 12) % 2 ? 0.9 : 1.06) : 1, earL: earSel && lt < 2.9 ? wobble(q12(lt) - 2.44, 3, 4) * 0.6 : 0, earR: earSel && lt < 2.9 ? wobble(q12(lt) - 2.48, 3, 4) * 0.6 : 0, blush: colP }), 168, 350, 3.1, q12(t));
    if (lt > 3.48 && lt < 4.25) { inkLine(ctx, [[100, 380], [168, 392], [236, 380]], 1.4, P.ink2, 5); icon(ctx, 'back', 96, 380, 10, P.ink2); }
    // name label taped
    card(ctx, 124, 392, 90, 26, { rot: 0.03, id: 44 }); tape(ctx, 124, 395, 18, -0.7, P.teal); text(ctx, '麻糬 ✎', 170, 410, { font: F(13, 700), color: P.ink, align: 'center' });
    // sticker sheet
    card(ctx, 26, 436, 290, 148, { fill: '#FFFDF6', id: 50, rot: -0.012 });
    tape(ctx, 170, 438, 50, 0.04, P.mustard);
    const swap = clamp((lt - 1.75) / 0.2);
    for (let i = 0; i < 8; i++) {
      const cx = 62 + (i % 4) * 72, cy = 478 + Math.floor(i / 4) * 64;
      const used = (tab === 0 && i === 1 && lt > 0.78) || (tab === 4 && i === 1 && lt > 2.12);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(((i * 37) % 7 - 3) * 0.03);
      if (used) { inkPath(ctx, blobPts(0, 0, 27, 24, 12, i + 9, 0.05), true, i, 0); ctx.setLineDash([3, 3]); ctx.strokeStyle = rgba(P.ink, 0.35); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); ctx.restore(); continue; }
      blob(ctx, 0, 0, 27, 24, '#FFFFFF', { lw: 1, id: i + 9, n: 12, wob: 0.05, stroke: rgba(P.ink, 0.4) });
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.clip();
      const mk = (mode, a) => { ctx.globalAlpha = a; C.draw(ctx, 'mochi', mode === 0 ? { eyes: EYES[i], noShadow: true } : { ears: EARS[i], noShadow: true }, 0, mode === 0 ? 56 : 70, mode === 0 ? 1.55 : 1.15, q12(t)); };
      if (swap < 1) mk(0, 1 - swap); if (swap > 0) mk(1, swap);
      ctx.restore(); ctx.restore();
    }
    // peeled sticker flying to face
    const fly = (t0, t1, mode, i) => { if (lt < t0 || lt > t1 || !f) return; ctx.save(); ctx.translate(f.x, f.y - 6); ctx.rotate(Math.sin(lt * 12) * 0.12); ctx.scale(1.15, 1.15); blob(ctx, 0, 0, 27, 24, '#FFFFFF', { lw: 1.2, id: 99, n: 12, wob: 0.05 }); ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.clip(); C.draw(ctx, 'mochi', mode === 0 ? { eyes: EYES[i], noShadow: true } : { ears: EARS[i], noShadow: true }, 0, mode === 0 ? 56 : 70, mode === 0 ? 1.55 : 1.15, q12(t)); ctx.restore(); };
    fly(0.78, 1.06, 0, 1); fly(2.12, 2.44, 1, 1);
    if (lt > 1.06 && lt < 1.4) text(ctx, '啪！', 226, 238, { font: F(18, 700), color: P.terra, align: 'center' });
    // paint pots
    POTS.forEach((c, i) => { const x = 48 + i * 44, y = 612; blob(ctx, x, y, 15, 11, c, { lw: 1.5, id: 60 + i, n: 12 }); if ((colP > 0.5 ? 2 : 0) === i) inkLine(ctx, [[x - 16, y + 15], [x, y + 18], [x + 16, y + 15]], 2, P.terra, 66); });
    touch(ctx, f);
    statusBar(ctx, '10:24');
  }

  // ---------------- 4. PROFILE (ID card) ----------------
  function jar(ctx, x, y, v, c, label, id, t) {
    ink(ctx, [[x - 15, y - 34], [x + 15, y - 34], [x + 17, y - 26], [x + 17, y + 4], [x + 13, y + 10], [x - 13, y + 10], [x - 17, y + 4], [x - 17, y - 26]], 'rgba(255,255,255,0.6)', { id, lw: 1.6 });
    ctx.save(); inkPath(ctx, [[x - 15, y - 26], [x + 15, y - 26], [x + 16, y + 4], [x + 12, y + 9], [x - 12, y + 9], [x - 16, y + 4]], true, id, 0); ctx.clip();
    const top = y + 9 - v * 34;
    ctx.beginPath(); ctx.moveTo(x - 20, top); for (let k = 0; k <= 8; k++) ctx.lineTo(x - 20 + k * 5, top + Math.sin(t * 5 + k + id) * 1.2); ctx.lineTo(x + 20, y + 12); ctx.lineTo(x - 20, y + 12); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
    ctx.restore();
    ink(ctx, [[x - 13, y - 40], [x + 13, y - 40], [x + 13, y - 34], [x - 13, y - 34]], P.wood, { id: id + 1, lw: 1.4 });
    text(ctx, label, x, y + 26, { font: F(11, 700), color: P.ink, align: 'center' });
  }
  function profile(ctx, lt, t) {
    dp(ctx, t); paper(ctx, P.paper2);
    backBtn(ctx); heading(ctx, '角色手帳', 180, 58, { align: 'center', size: 20 });
    card(ctx, 18, 78, 324, 176, { id: 70, fill: P.card });
    // polaroid
    ctx.save(); ctx.translate(82, 162); ctx.rotate(-0.05);
    card(ctx, -54, -70, 108, 132, { id: 71, fill: '#FFFFFF' });
    ctx.fillStyle = P.sky; ctx.fillRect(-46, -62, 92, 96); ctx.save(); ctx.beginPath(); ctx.rect(-46, -62, 92, 96); ctx.clip(); C.draw(ctx, 'mochi', idle(t, 1, { noShadow: true, eyes: lt > 3.4 ? 'happy' : 'round' }), 0, 86, 2.4, q12(t)); ctx.restore();
    text(ctx, 'Mochi', 0, 52, { font: F(13, 700), color: P.ink2, align: 'center' });
    tape(ctx, 0, -70, 40, 0.06, P.rose);
    ctx.restore();
    const field = (k, v, y) => { text(ctx, k, 156, y, { font: F(11), color: P.ink2 }); text(ctx, v, 200, y, { font: F(15, 700), color: P.ink }); inkLine(ctx, [[196, y + 5], [330, y + 4]], 0.8, rgba(P.ink, 0.4), y); };
    field('名字', '麻糬', 112); field('生日', '春 · 3日', 140); field('身分', '你的 OC', 168);
    DATA.traits.forEach((tr, i) => { const q = clamp((lt - 0.4 - i * 0.15) / 0.18); if (q <= 0) return; const s = lerp(1.6, 1, E.inCubic(q)); ctx.save(); ctx.translate(176 + (i % 2) * 82, 198 + Math.floor(i / 2) * 26); ctx.rotate((i % 2 ? 0.05 : -0.06)); ctx.scale(s, s); ctx.globalAlpha = q; ctx.strokeStyle = [P.red, P.teal, P.plum, P.terra][i]; ctx.lineWidth = 1.3; OC.rr(ctx, -2, -12, 78, 21, 5); ctx.stroke(); text(ctx, tr, 37, 3, { font: F(11, 700), color: [P.red, P.teal, P.plum, P.terra][i], align: 'center' }); ctx.restore(); });
    // jars
    heading(ctx, '今日狀態', 22, 290, { size: 15, ul: P.teal });
    text(ctx, '自主行動：發呆中…', 338, 290, { font: F(11), color: P.ink2, align: 'right' });
    const cols = [P.terra, P.mustard, P.rose, P.water2, P.grass2];
    DATA.needs.forEach((n, i) => jar(ctx, 46 + i * 67, 350, n.v * E.outCubic(clamp((lt - 0.3 - i * 0.1) / 0.9)), cols[i], n.zh, 80 + i * 3, t));
    // sticky note thought
    ctx.save(); ctx.translate(180, 422); ctx.rotate(-0.015); card(ctx, -160, -20, 320, 44, { fill: '#FCEFA8', id: 90 }); text(ctx, typewriter('「風好舒服…等等去池塘看看栗子吧。」', clamp((lt - 0.8) / 1.3)), -146, 7, { font: F(13), color: P.ink }); ctx.restore();
    // relationships: photos on yarn
    heading(ctx, '好朋友們', 22, 480, { size: 15, ul: P.rose });
    inkLine(ctx, [[14, 500], [120, 512], [240, 508], [350, 498]], 1.4, P.terra, 91, 0.6);
    DATA.relations.concat([{ who: 'mochi', zh: '自己', hearts: 5 }]).slice(0, 2).forEach((r, i) => {
      const x = 92 + i * 150, y = 560, sw = Math.sin(t * 1.6 + i) * 0.04 + (i === 0 && lt > 3.2 && lt < 3.6 ? wobble(lt - 3.2, 3, 4) * 0.2 : 0);
      ctx.save(); ctx.translate(x, 508); ctx.rotate(sw);
      card(ctx, -46, 4, 92, 106, { fill: '#FFFFFF', id: 95 + i });
      ctx.fillStyle = i ? '#E6E0F5' : '#F7E2CF'; ctx.fillRect(-40, 10, 80, 64); ctx.save(); ctx.beginPath(); ctx.rect(-40, 10, 80, 64); ctx.clip(); C.draw(ctx, r.who, idle(t, 4 + i, { noShadow: true }), 0, 132, 2, q12(t)); ctx.restore();
      text(ctx, `${DATA.cast[r.who].zh} · ${r.zh}`, 0, 90, { font: F(12, 700), color: P.ink, align: 'center' });
      for (let h = 0; h < 5; h++) icon(ctx, h < r.hearts ? 'heart' : 'heartO', -26 + h * 13, 102, 10);
      ink(ctx, [[-4, -2], [4, -2], [4, 10], [-4, 10]], P.wood, { id: 97 + i, lw: 1.2 });
      ctx.restore();
    });
    touch(ctx, finger([{ t: 2.9, x: 250, y: 470 }, { t: 3.15, x: 96, y: 560 }, { t: 3.2, x: 96, y: 560, down: true }, { t: 3.35, x: 96, y: 560 }], lt));
    statusBar(ctx, '10:26');
  }

  // ---------------- 5. DIALOGUE (comic) ----------------
  function balloon(ctx, x, y, w, h, tx, ty, str, a = 1, name) {
    if (a <= 0) return;
    const s = a < 1 ? E.outBack(a, 1.8) : 1;
    ctx.save(); ctx.translate(tx, ty); ctx.scale(s, s); ctx.translate(-tx, -ty);
    const pts = []; for (let i = 0; i < 20; i++) { const an = (i / 20) * TAU; pts.push([x + w / 2 + Math.cos(an) * (w / 2) * 1.04, y + h / 2 + Math.sin(an) * (h / 2) * 1.1]); }
    const idx = pts.reduce((b, p, i) => (Math.hypot(p[0] - tx, p[1] - ty) < Math.hypot(pts[b][0] - tx, pts[b][1] - ty) ? i : b), 0);
    pts.splice(idx, 1, [pts[idx][0] - 8, pts[idx][1]], [tx, ty], [pts[idx][0] + 8, pts[idx][1]]);
    ink(ctx, pts, '#FFFFFF', { id: x + y, lw: 2, off: 0 });
    if (name) { card(ctx, x + 6, y - 12, name.length * 14 + 18, 20, { fill: P.mustard, id: x, rot: -0.05 }); text(ctx, name, x + 15 + (name.length * 14) / 2, y + 3, { font: F(12, 700), color: P.ink, align: 'center' }); }
    text(ctx, str, x + w / 2, y + h / 2 + 6, { font: F(15, 700), color: P.ink, align: 'center' });
    ctx.restore();
  }
  function dialogue(ctx, lt, t) {
    dp(ctx, t);
    const lq = q12(lt);
    const kw = walkPath([{ t: -0.2, x: 252, y: 432 }, { t: 1.0, x: 206, y: 430 }], lq, 12);
    const j = lq - 3.15;
    const air = j > 0 && j < 0.45 ? Math.sin((j / 0.45) * Math.PI) : 0;
    const ks = idle(t, 2, { face: -0.8, walk: kw.moving ? 1 : 0, phase: kw.phase, lift: air * 20, squash: j > -0.2 && j < 0 ? 0.78 : j > 0 && j < 0.15 ? 1.18 : j > 0.45 && j < 0.6 ? 0.8 : 1,
      eyes: lq > 3.15 ? 'happy' : lq > 2.95 ? 'wide' : 'round', mouth: lq > 3.15 ? 'open' : lq > 1 && lq < 2.2 && Math.floor(lt * 8) % 2 ? 'o' : 'cat', ear: lq > 2.95 && lq < 3.15 ? -0.5 : 0, earL: wobble(j - 0.3, 3, 4) * 0.6, earR: wobble(j - 0.35, 3, 4) * 0.6, armL: air ? -2.6 : undefined, armR: air ? -2.6 : undefined, blush: lq > 3.3 ? 1 : 0, brows: lq > 2.95 && lq < 3.2 ? 'up' : null });
    const ms = idle(t, 1, { face: 0.75, eyes: lq > 3.5 ? 'happy' : 'round', mouth: lq > 3.5 ? 'smile' : 'cat', blush: lq > 3.6 ? 1 : 0 });
    Wd.drawVillage(ctx, { t: q12(t), cam: { x: 186, y: 410, z: 2.0 }, chars: [
      { d: 'mochi', s: ms, x: 158, y: 432 },
      { d: 'kuri', s: ks, x: kw.x, y: kw.y, emote: lq > 2.95 && lq < 3.4 ? { kind: '!', p: clamp((lt - 2.95) / 0.45) } : lq > 3.45 ? { kind: '♥', p: clamp((lt - 3.45) / 1.4) } : null },
    ] });
    // motion lines + onomatopoeia
    if (air > 0.1) { for (let i = 0; i < 3; i++) inkLine(ctx, [[220 + i * 8, 380 - 0], [220 + i * 8, 400]], 1.6, P.ink, 300 + i); }
    if (lq > 3.2 && lq < 3.9) { ctx.save(); ctx.translate(276, 236); ctx.rotate(0.15); text(ctx, '蹦！', 0, 0, { font: F(30, 700), color: P.terra, align: 'center', stroke: P.card, strokeW: 4 }); ctx.restore(); }
    const b1 = clamp((lt - 0.95) / 0.2) * (lt < 2.8 ? 1 : 0);
    balloon(ctx, 64, 116, 248, 60, 238, 210, typewriter(DATA.dialogue.a, clamp((lt - 1.05) / 1.0)), b1, '栗子');
    if (lt > 2.8 && lt < 3.1) balloon(ctx, 30, 130, 170, 50, 120, 220, '一起去森林散步？', 1);
    const b2 = clamp((lt - 3.75) / 0.2);
    balloon(ctx, 92, 112, 210, 58, 236, 200, typewriter(DATA.dialogue.b, clamp((lt - 3.85) / 0.6)), b2, '栗子');
    // choice notes
    if (lt > 2.15 && lt < 3.0) {
      DATA.dialogue.choices.forEach((c, i) => { const q = E.outBack(clamp((lt - 2.15 - i * 0.1) / 0.3), 1.6); const sel = i === 0 && lt > 2.75; ctx.save(); ctx.translate(180, 506 + i * 52); ctx.rotate(i ? 0.03 : -0.025); ctx.scale(q, q); card(ctx, -110, -20, 220, 40, { fill: sel ? '#FCEFA8' : P.card, id: 120 + i }); tape(ctx, -100, -18, 22, -0.5, i ? P.teal : P.rose); icon(ctx, i === 0 ? 'walk' : 'heart', -84, 0, 14); text(ctx, c, -68, 5, { font: F(14, 700), color: P.ink }); ctx.restore(); });
    }
    touch(ctx, finger([{ t: 2.4, x: 230, y: 600 }, { t: 2.65, x: 190, y: 506 }, { t: 2.72, x: 190, y: 506, down: true }, { t: 2.88, x: 190, y: 506 }], lt));
    statusBar(ctx, '10:32');
  }

  // ---------------- 6. MAP (fold-out) ----------------
  const PL = { village: [176, 330], forest: [92, 196], beach: [262, 448], hill: [262, 190], market: [86, 452] };
  function mapPaper(ctx, t, sel, route) {
    ctx.fillStyle = '#EADCB8'; ctx.fillRect(16, 96, 328, 448);
    ctx.save(); ctx.beginPath(); ctx.rect(16, 96, 328, 448); ctx.clip();
    ctx.strokeStyle = rgba(P.teal, 0.35); ctx.lineWidth = 0.9; for (let y = 110; y < 540; y += 14) { ctx.beginPath(); for (let x = 16; x < 345; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.2 + y) * 1.2); ctx.stroke(); }
    const isl = (k, rx, ry, c, id) => { const [x, y] = PL[k]; blob(ctx, x, y, rx, ry, c, { id, lw: 1.8, n: 16, wob: 0.12, hatch: { x0: x, y0: y, x1: x + rx, y1: y + ry, gap: 3, col: rgba(P.ink, 0.25) } }); };
    isl('village', 60, 44, P.grass, 130); isl('forest', 46, 36, P.forest, 131); isl('beach', 40, 26, P.sand, 132); isl('hill', 42, 32, P.grass, 133); isl('market', 36, 26, P.grass, 134);
    for (const [dx, dy] of [[-18, 4], [0, -8], [16, 6], [-4, 12]]) Wd.pine(ctx, PL.forest[0] + dx, PL.forest[1] + dy, 0.45, t, 140 + dx);
    Wd.acornHouse(ctx, PL.village[0] - 14, PL.village[1] + 8, 0.42, t, 0, 150); Wd.acornHouse(ctx, PL.village[0] + 20, PL.village[1] + 16, 0.34, t, 0, 151, '#7E5A8E');
    // windmill (hill) blades on twos
    const a = Math.floor(t * 6) * 0.35; ctx.save(); ctx.translate(PL.hill[0], PL.hill[1] - 18); ink(ctx, [[-3, 0], [3, 0], [4, 20], [-4, 20]], P.card, { id: 160, lw: 1.3 }); ctx.rotate(a); for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ink(ctx, [[-2, 0], [2, 0], [3, 13], [-3, 13]], P.terra, { id: 161 + k, lw: 1.2 }); } ctx.restore();
    for (let i = 0; i < 3; i++) item(ctx, 'shell', PL.beach[0] - 18 + i * 16, PL.beach[1] + 2, 12);
    ink(ctx, [[PL.market[0] - 16, PL.market[1] - 6], [PL.market[0] + 16, PL.market[1] - 6], [PL.market[0] + 14, PL.market[1] - 14], [PL.market[0] - 14, PL.market[1] - 14]], P.red, { id: 170, lw: 1.3 });
    // compass rose
    ctx.save(); ctx.translate(310, 512); ink(ctx, [[0, -14], [3, 0], [0, 14], [-3, 0]], P.mustard, { id: 171, lw: 1.2 }); text(ctx, 'N', 0, -17, { font: F(9, 700), color: P.ink, align: 'center' }); ctx.restore();
    // route draws itself
    if (route > 0) { const [ax, ay] = PL.village, [bx, by] = PL.forest; ctx.setLineDash([5, 5]); const pts = []; for (let i = 0; i <= 20 * route; i++) { const q = i / 20; pts.push([lerp(ax, bx, q) + Math.sin(q * Math.PI) * 20, lerp(ay, by, q)]); } if (pts.length > 1) inkLine(ctx, pts, 2, P.red, 172, 0.3); ctx.setLineDash([]); }
    if (sel) { const [x, y] = PL[sel]; const pts = []; for (let i = 0; i < 26; i++) { const an = (i / 24) * TAU; pts.push([x + Math.cos(an) * (54 + i * 0.3), y + Math.sin(an) * (42 + i * 0.2)]); } inkLine(ctx, pts, 2, P.red, 173, 0.8); }
    Object.entries(PL).forEach(([k, [x, y]]) => { const name = DATA.places.find((d) => d.id === k).zh; ctx.font = F(12, 700); const w = ctx.measureText(name).width + 14; card(ctx, x - w / 2, y + 22, w, 20, { id: 180 + x, fill: P.card, rot: (x % 3 - 1) * 0.03 }); text(ctx, name, x, y + 37, { font: F(12, 700), color: P.ink, align: 'center' }); });
    ctx.restore();
    // creases
    for (const cx of [125, 235]) { const g = ctx.createLinearGradient(cx - 8, 0, cx + 8, 0); g.addColorStop(0, 'rgba(120,90,60,0)'); g.addColorStop(0.5, 'rgba(120,90,60,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0.15)'); ctx.fillStyle = g; ctx.fillRect(cx - 8, 96, 16, 448); }
    ctx.strokeStyle = rgba(P.ink, 0.5); ctx.lineWidth = 1.2; ctx.strokeRect(16, 96, 328, 448);
  }
  function map(ctx, lt, t) {
    dp(ctx, t);
    Wd.drawVillage(ctx, { t: q12(t), cam: { x: 200, y: 390, z: 1.3 }, chars: [{ d: 'mochi', s: idle(t, 1), x: 214, y: 418 }, { d: 'kuri', s: idle(t, 2, { face: -0.6 }), x: 246, y: 430 }] });
    hud(ctx, t, { mapPress: lt > 0.3 && lt < 0.45 ? 0.88 : 1 });
    // unfold: 3 panels open like an accordion
    const u = E.outCubic(clamp((lt - 0.45) / 0.55));
    const forest = clamp((lt - 2.75) / 0.01);
    if (u > 0 && lt < 2.75) {
      ctx.fillStyle = `rgba(59,42,37,${0.35 * u})`; ctx.fillRect(0, 0, 360, 640);
      ctx.save();
      const W0 = 328 * u, x0 = 180 - W0 / 2;
      ctx.translate(x0 + W0 / 2, 320); ctx.scale(Math.max(0.01, u), 0.9 + u * 0.1); ctx.translate(-180, -320);
      mapPaper(ctx, q12(t), lt > 1.45 ? 'forest' : null, clamp((lt - 1.5) / 0.6));
      ctx.restore();
      if (u > 0.9) {
        card(ctx, 110, 58, 140, 34, { id: 190, fill: P.card, rot: -0.02 }); tape(ctx, 116, 60, 20, -0.6, P.rose); text(ctx, '世界地圖', 180, 81, { font: F(16, 700), color: P.ink, align: 'center' });
        stamp(ctx, 326, 112, 13, 'close', P.ink, { fill: P.card });
      }
      const ic = E.outBack(clamp((lt - 1.65) / 0.35), 1.4);
      if (ic > 0) {
        ctx.save(); ctx.translate(180, 588 + (1 - ic) * 120); ctx.rotate(-0.02);
        card(ctx, -160, -40, 320, 82, { fill: P.card, id: 191, lines: true }); tape(ctx, -140, -38, 28, -0.5, P.teal);
        text(ctx, '苔光森林', -144, -12, { font: F(18, 700), color: P.ink }); icon(ctx, 'rain', -40, -18, 15); text(ctx, '小雨 · 3分', -28, -13, { font: F(11), color: P.ink2 });
        text(ctx, '雨後苔蘚會發光，有稀有蘑菇！', -144, 14, { font: F(11), color: P.ink2 });
        inkBtn(ctx, 64, -24, 82, 36, '出發！', { pressed: lt > 2.4 && lt < 2.55, fill: P.mustard });
        ctx.restore();
      }
    }
    if (lt >= 2.75) {
      const lq = q12(lt);
      const w = walkPath([{ t: 2.9, x: 186, y: 650 }, { t: 4.5, x: 190, y: 530 }], lq, 12);
      Wd.drawForest(ctx, { t: q12(t), chars: [{ d: 'mochi', s: idle(t, 1, { back: 1, walk: w.moving ? 1 : 0, phase: w.phase, hold: 'leaf' }), x: w.x, y: w.y, sc: 1.4 }] });
      // handwritten title
      const wr = clamp((lt - 3.3) / 0.7);
      ctx.save(); ctx.beginPath(); ctx.rect(80, 70, 200 * wr, 80); ctx.clip();
      card(ctx, 92, 84, 176, 56, { fill: P.card, id: 192, rot: -0.03 }); text(ctx, '苔光森林', 180, 120, { font: F(26, 700), color: P.forest2, align: 'center' });
      ctx.restore();
      if (wr >= 1) { tape(ctx, 96, 88, 26, -0.6, P.mustard); text(ctx, '～ 小雨 ～', 180, 160, { font: F(13, 700), color: P.card, align: 'center', stroke: P.ink, strokeW: 3 }); }
      // page-turn in from the map
      const pt = clamp((lt - 2.75) / 0.45);
      if (pt < 1) { ctx.save(); const x = 360 * E.inOutCubic(pt); ctx.beginPath(); ctx.rect(x, 0, 360 - x, 640); ctx.clip(); ctx.fillStyle = '#EADCB8'; ctx.fillRect(0, 0, 360, 640); ctx.restore(); const g = ctx.createLinearGradient(x - 24, 0, x + 6, 0); g.addColorStop(0, 'rgba(60,40,30,0)'); g.addColorStop(1, 'rgba(60,40,30,0.35)'); ctx.fillStyle = g; ctx.fillRect(x - 24, 0, 30, 640); }
    }
    touch(ctx, finger([{ t: 0.05, x: 220, y: 560 }, { t: 0.3, x: 262, y: 602 }, { t: 0.33, x: 262, y: 602, down: true }, { t: 0.48, x: 262, y: 602 }, { t: 1.15, x: 120, y: 260 }, { t: 1.38, x: 96, y: 210 }, { t: 1.45, x: 96, y: 210, down: true }, { t: 1.6, x: 96, y: 210 }, { t: 2.2, x: 285, y: 584 }, { t: 2.4, x: 285, y: 582, down: true }, { t: 2.55, x: 285, y: 582 }], lt));
    statusBar(ctx, '10:41', lt > 2.75 ? P.card : P.ink);
  }

  // ---------------- 7. INVENTORY ----------------
  function inventory(ctx, lt, t) {
    dp(ctx, t);
    const lq = q12(lt);
    const f = finger([{ t: 0.0, x: 300, y: 560 }, { t: 0.2, x: 318, y: 590 }, { t: 0.25, x: 318, y: 590, down: true }, { t: 0.4, x: 318, y: 590 }, { t: 0.85, x: 62, y: 470 }, { t: 0.95, x: 62, y: 470, down: true }, { t: 1.4, x: 62, y: 470, down: true }, { t: 2.2, x: 182, y: 262, down: true }, { t: 2.28, x: 182, y: 262 }], lt);
    const eat = lq - 2.3, chew = eat > 0 && eat < 0.9, happy = eat > 0.9;
    const near = f && lt > 1.4 && lt < 2.3 && f.y < 380;
    const ms = idle(t, 1, { eyes: happy ? 'happy' : near ? 'sparkle' : 'round', mouth: chew ? 'chew' : happy ? 'smile' : near ? 'open' : 'cat', squash: chew ? (Math.floor(lt * 6) % 2 ? 0.94 : 1.04) : 1, lift: happy && eat < 1.8 && Math.floor(eat * 6) % 2 ? 6 : 0, blush: happy ? 1 : 0, ear: near ? -0.35 : 0 });
    Wd.drawVillage(ctx, { t: q12(t), cam: { x: 200, y: 360, z: 1.9 }, chars: [{ d: 'mochi', s: ms, x: 192, y: 344, emote: happy ? { kind: '♥', p: clamp((eat - 0.9) / 1.3) } : null }] });
    const sheet = E.outBack(clamp((lt - 0.3) / 0.4), 1.2) * (1 - E.inOutCubic(clamp((lt - 1.45) / 0.4)) * 0.6);
    if (sheet < 0.05) hud(ctx, t, { bagPress: lt > 0.2 && lt < 0.4 ? 0.88 : 1 });
    if (sheet > 0.01) {
      ctx.save(); ctx.translate(0, (1 - sheet) * 260);
      card(ctx, 10, 398, 340, 250, { fill: P.card, id: 210, lines: true, rot: -0.008 });
      tape(ctx, 60, 400, 50, -0.08, P.terra); text(ctx, '背包', 60, 432, { font: F(18, 700), color: P.ink, align: 'center' });
      ['全部', '食物', '素材', '家具'].forEach((n, i) => { const x = 166 + i * 46; if (!i) blob(ctx, x, 427, 20, 11, rgba(P.mustard, 0.7), { lw: 0, id: 211, n: 10 }); text(ctx, n, x, 432, { font: F(12, 700), color: i ? P.ink2 : P.ink, align: 'center' }); });
      DATA.items.forEach((it, i) => {
        const x = 62 + (i % 4) * 78, y = 482 + Math.floor(i / 4) * 76;
        blob(ctx, x, y, 28, 26, i % 2 ? '#F8EFD9' : '#F2F4E2', { lw: 1.1, id: 220 + i, n: 12, stroke: rgba(P.ink, 0.5) });
        if (!(it.id === 'cake' && lt > 0.95 && lt < 2.3)) item(ctx, it.id, x, y - 2, 36);
        text(ctx, '×' + (it.id === 'cake' && lt > 2.3 ? it.n - 1 : it.n), x + 26, y + 26, { font: F(11, 700), color: P.ink2, align: 'right' });
      });
      ctx.restore();
    }
    if (f && lt > 0.95 && lt < 1.4) { const q = (lt - 0.95) / 0.45; ctx.strokeStyle = P.terra; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(f.x, f.y - 2, 32, -Math.PI / 2, -Math.PI / 2 + TAU * q); ctx.stroke(); }
    if (f && lt > 0.95 && lt < 2.3) { ctx.save(); ctx.translate(f.x, f.y - 26); ctx.rotate(Math.sin(q12(lt) * 10) * 0.12); item(ctx, 'cake', 0, 0, 46); ctx.restore(); }
    if (chew) { const k = Math.floor(lt * 6) % 2; text(ctx, '嚼', 238 + k * 3, 200 - k * 4, { font: F(22, 700), color: P.terra, align: 'center', stroke: P.card, strokeW: 4 }); text(ctx, '嚼', 262 - k * 2, 186 + k * 3, { font: F(18, 700), color: P.terra, align: 'center', stroke: P.card, strokeW: 4 }); }
    if (happy) { const q = clamp((eat - 0.9) / 0.2); stamp(ctx, 108, 180, 30, null, P.red, { scale: lerp(1.6, 1, E.inCubic(q)), alpha: q, rot: -0.15, label: '+18 飽足', ls: 11 }); }
    touch(ctx, f);
    statusBar(ctx, '10:45');
  }

  // ---------------- 8. SHOP (price tags on a string) ----------------
  function shop(ctx, lt, t) {
    dp(ctx, t); paper(ctx, '#F3E6CC');
    // awning
    for (let i = 0; i < 9; i++) ink(ctx, [[i * 40 - 2, 26], [i * 40 + 40, 26], [i * 40 + 40, 70], [i * 40 + 30, 80], [i * 40 + 20, 70], [i * 40 + 10, 80], [i * 40 - 2, 70]], i % 2 ? P.card : P.terra, { id: 230 + i, lw: 1.5 });
    const sold = lt > 1.45;
    C.draw(ctx, 'sora', idle(t, 3, { eyes: sold ? 'happy' : 'round', mouth: sold ? 'smile' : 'cat', armR: sold ? (Math.floor(lt * 6) % 2 ? -2.6 : -2.0) : undefined }), 76, 196, 1.9, q12(t));
    ink(ctx, [[8, 170], [352, 170], [352, 206], [8, 206]], P.wood, { id: 240, lw: 1.8, hatch: { x0: 8, y0: 186, x1: 352, y1: 206, gap: 3, col: rgba(P.ink, 0.3) } });
    heading(ctx, '雲朵市集', 154, 118, { size: 22 });
    text(ctx, '今天有新到的燈喔～', 156, 144, { font: F(12), color: P.ink2 });
    const coins = lerp(DATA.coins, DATA.coins - 120, E.outCubic(clamp((lt - 1.5) / 0.8)));
    card(ctx, 252, 90, 96, 30, { id: 241, rot: 0.03 }); icon(ctx, 'coin', 268, 105, 15); text(ctx, fmt(coins), 338, 110, { font: F(14, 700), color: P.ink, align: 'right' });
    // string + tags
    inkLine(ctx, [[0, 236], [90, 248], [180, 252], [270, 248], [360, 236]], 1.5, P.ink2, 242, 0.5);
    DATA.shop.forEach((s, i) => {
      const x = 46 + i * 89, y = 246 + Math.sin((i / 3) * Math.PI) * 6;
      const pulled = i === 0 && lt > 0.55;
      const sw = Math.sin(t * 2 + i * 1.3) * 0.06 + (pulled ? wobble(lt - 0.55, 2, 3) * 0.3 : 0);
      ctx.save(); ctx.translate(x, y); ctx.rotate(sw); if (pulled) ctx.translate(0, E.outBack(clamp((lt - 0.55) / 0.25)) * 8);
      inkLine(ctx, [[0, 0], [0, 14]], 1.2, P.ink, 243 + i);
      card(ctx, -38, 14, 76, 110, { fill: pulled ? '#FCEFA8' : P.card, id: 250 + i });
      blob(ctx, 0, 22, 3, 3, '#F3E6CC', { lw: 1, id: 260 + i, n: 6 });
      item(ctx, s.id, 0, 62, 50);
      text(ctx, s.zh, 0, 104, { font: F(12, 700), color: P.ink, align: 'center' });
      icon(ctx, 'coin', -14, 116, 11); text(ctx, String(s.price), 14, 120, { font: F(12, 700), color: P.ink, align: 'center' });
      if (i === 0 && lt > 1.45) { const q = clamp((lt - 1.45) / 0.15); stamp(ctx, 0, 64, 26, null, P.red, { scale: lerp(1.8, 1, E.inCubic(q)), alpha: q, rot: -0.3, label: '已購買', ls: 12 }); }
      ctx.restore();
    });
    // detail note + buy
    const bb = E.outBack(clamp((lt - 0.75) / 0.35), 1.3);
    if (bb > 0) {
      ctx.save(); ctx.translate(180, 470 + (1 - bb) * 140); ctx.rotate(0.01);
      card(ctx, -160, -50, 320, 108, { fill: P.card, id: 270, lines: true }); tape(ctx, 140, -48, 30, 0.5, P.teal);
      item(ctx, 'lamp', -122, 2, 52);
      text(ctx, '蘑菇檯燈', -86, -16, { font: F(17, 700), color: P.ink }); text(ctx, '夜裡會發出柔柔的光。', -86, 6, { font: F(12), color: P.ink2 });
      inkBtn(ctx, 26, 18, 120, 32, sold ? '放進背包了！' : '買下 · 120', { pressed: lt > 1.25 && lt < 1.42, fill: sold ? P.grass : P.mustard, size: 13 });
      ctx.restore();
    }
    if (lt > 1.45 && lt < 2.3) for (let i = 0; i < 5; i++) { const q = E.inOutCubic(clamp((lt - 1.45 - i * 0.06) / 0.55)); if (q <= 0 || q >= 1) continue; icon(ctx, 'coin', lerp(266, 268, q) + Math.sin(q * Math.PI) * (i - 2) * 14, lerp(504, 105, q) - Math.sin(q * Math.PI) * 30, 12); }
    backBtn(ctx);
    touch(ctx, finger([{ t: 0.25, x: 150, y: 420 }, { t: 0.5, x: 46, y: 320 }, { t: 0.55, x: 46, y: 320, down: true }, { t: 0.7, x: 46, y: 320 }, { t: 1.15, x: 266, y: 504 }, { t: 1.25, x: 266, y: 504, down: true }, { t: 1.42, x: 266, y: 504 }], lt));
    statusBar(ctx, '10:52');
  }

  // ---------------- 9. STUDIO (flipbook) ----------------
  const SKETCH = Object.assign({}, C.DESIGNS.mochi, { fur: '#FFFDF6', shade: '#F4EEDF', inner: '#F6E2D8', accCol: '#FFFDF6', patch: null });
  const STROKE = (() => { const p = []; for (let i = 0; i <= 24; i++) { const a = i / 24; p.push([236 + a * 34, 188 - Math.sin(a * Math.PI) * 26]); } return p; })();
  function studio(ctx, lt, t) {
    dp(ctx, t); paper(ctx, '#E9DCC0');
    backBtn(ctx); heading(ctx, '翻頁動畫本', 56, 58, { size: 20 }); text(ctx, '耳朵揮揮 · 8 fps', 58, 82, { font: F(11), color: P.ink2 });
    inkBtn(ctx, 268, 38, 74, 30, '匯出', { fill: P.lilac, size: 12 });
    const playing = lt > 2.35;
    const frames = lt > 1.75 ? 5 : 4;
    const cur = playing ? Math.floor((lt - 2.35) * 8) % frames : frames - 1;
    const earF = (k) => [0, 0.35, 0.7, 0.35, 0.1][k % 5];
    // stacked sheets
    for (let i = 3; i >= 1; i--) card(ctx, 32 + i * 4, 104 + i * 4, 290, 290, { fill: mix(P.card, P.paper3, i / 4), id: 300 + i, rot: (i - 2) * 0.012 });
    const flip = playing ? ((lt - 2.35) * 8) % 1 : 1;
    card(ctx, 32, 104, 290, 290, { fill: '#FFFDF6', id: 300 });
    // onion skin (previous frame) in lilac ink
    if (!playing) { ctx.save(); ctx.globalAlpha = 0.3; C.draw(ctx, Object.assign({}, SKETCH, { fur: '#E4DDF5' }), { earR: earF(cur - 1) * 1.4, armR: -earF(cur - 1) * 3, noShadow: true }, 178, 352, 3.0, q12(t)); ctx.restore(); }
    C.draw(ctx, SKETCH, { earR: earF(cur) * 1.4, armR: -earF(cur) * 3, eyes: cur > 1 ? 'happy' : 'round', mouth: cur > 1 ? 'smile' : 'cat', noShadow: true }, 178, 352, 3.0, q12(t));
    // pencil stroke being drawn (motion arc)
    const sp = playing ? 1 : clamp((lt - 0.3) / 1.0);
    if (sp > 0) { const n = Math.max(2, Math.floor(STROKE.length * sp)); inkLine(ctx, STROKE.slice(0, n), 2.2, P.terra, 310, 0.4); if (sp >= 1) { inkLine(ctx, STROKE.map(([x, y]) => [x + 4, y + 9]), 1.4, P.terra, 311, 0.4); } }
    // page curl while flipping
    if (playing && flip < 0.35) { const k = flip / 0.35; ctx.save(); ctx.beginPath(); ctx.moveTo(322, 394 - 120 * (1 - k)); ctx.lineTo(322 - 120 * (1 - k), 394); ctx.lineTo(322, 394); ctx.closePath(); ctx.fillStyle = P.paper3; ctx.fill(); ctx.strokeStyle = rgba(P.ink, 0.5); ctx.stroke(); ctx.restore(); }
    text(ctx, `第 ${cur + 1} 頁`, 300, 128, { font: F(12, 700), color: P.ink2, align: 'right' });
    // tools
    [['pencil', P.mustard], ['eraser', P.rose], ['onion', P.lilac]].forEach(([n, c], i) => stamp(ctx, 48 + i * 46, 432, 17, n, P.ink, { fill: i === 0 ? '#FCEFA8' : P.card, rot: 0 }));
    stamp(ctx, 316, 432, 20, playing ? 'pause' : 'play', P.ink, { fill: P.card, rot: 0, scale: lt > 2.22 && lt < 2.36 ? 0.88 : 1 });
    // frames pegged on a string
    inkLine(ctx, [[0, 474], [120, 486], [240, 484], [360, 472]], 1.4, P.ink2, 320, 0.5);
    for (let i = 0; i < frames; i++) {
      const x = 44 + i * 68, y = 480;
      const pop = i === 4 ? E.outBack(clamp((lt - 1.75) / 0.3), 1.8) : 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + i) * 0.04); ctx.scale(pop, pop);
      card(ctx, -28, 6, 56, 64, { fill: i === cur ? '#FCEFA8' : '#FFFDF6', id: 330 + i });
      C.draw(ctx, SKETCH, { earR: earF(i) * 1.4, armR: -earF(i) * 3, noShadow: true }, 0, 64, 0.95, 0);
      ink(ctx, [[-3, -4], [3, -4], [3, 12], [-3, 12]], P.wood, { id: 340 + i, lw: 1.1 });
      text(ctx, String(i + 1), 0, 82, { font: F(11, 700), color: P.ink2, align: 'center' });
      ctx.restore();
    }
    if (frames < 5 || lt < 2.05) { blob(ctx, 44 + frames * 68, 518, 18, 18, null, { lw: 1.2, id: 350, n: 10, stroke: rgba(P.ink, 0.5) }); icon(ctx, 'plus', 44 + frames * 68, 518, 14, P.ink2); }
    card(ctx, 18, 574, 324, 52, { fill: P.card, id: 360, lines: true });
    text(ctx, '提示：在下一頁畫出耳朵的位置，按 ▶ 就會動起來！', 30, 604, { font: F(11), color: P.ink2 });
    const pk = STROKE.filter((_, i) => i % 3 === 0).map((p, i) => ({ t: 0.3 + i * 0.12, x: p[0], y: p[1], down: true }));
    touch(ctx, finger([{ t: 0.1, x: 220, y: 240 }, ...pk, { t: 1.4, x: 290, y: 240 }, { t: 1.62, x: 316, y: 518 }, { t: 1.68, x: 316, y: 518, down: true }, { t: 1.82, x: 316, y: 518 }, { t: 2.12, x: 316, y: 432 }, { t: 2.22, x: 316, y: 432, down: true }, { t: 2.36, x: 316, y: 432 }], lt));
    statusBar(ctx, '11:03');
  }

  // ---------------- 10. PET ----------------
  function pet(ctx, lt, t) {
    dp(ctx, t);
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#3C4A72'); g.addColorStop(0.55, '#B07A86'); g.addColorStop(1, '#E9B58C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(40 + i * 80, 640, 110 - (i % 2) * 30, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = '300 54px sans-serif'; ctx.fillText('21:42', 34, 180);
    ctx.font = '14px sans-serif'; ctx.globalAlpha = 0.85; ctx.fillText('11月3日 星期二 · 18°', 38, 206); ctx.globalAlpha = 1;
    const apps = ['chat', 'face', 'play', 'map', 'clock', 'leaf', 'gear', 'paw'];
    apps.forEach((ic, i) => { const x = 52 + (i % 4) * 85, y = 300 + Math.floor(i / 4) * 86; OC.rr(ctx, x - 24, y - 24, 48, 48, 14); ctx.fillStyle = i === 7 ? P.mustard : 'rgba(255,255,255,0.9)'; ctx.fill(); icon(ctx, ic, x, y, 24); ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(['訊息', '相機', '音樂', '地圖', '時鐘', '相簿', '設定', 'OC Shimeji'][i], x, y + 38); ctx.textAlign = 'left'; });
    OC.rr(ctx, 20, 520, 320, 70, 26); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
    ['chat', 'face', 'play', 'gear'].forEach((n, i) => { const x = 62 + i * 79; OC.rr(ctx, x - 22, 533, 44, 44, 13); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); icon(ctx, n, x, 555, 22); });
    const lq = q12(lt);
    const f = finger([{ t: 1.75, x: 120, y: 420 }, { t: 2.05, x: 150, y: 490 }, { t: 2.12, x: 150, y: 490, down: true }, { t: 2.35, x: 150, y: 484, down: true }, { t: 2.85, x: 210, y: 330, down: true }, { t: 3.3, x: 236, y: 212, down: true }, { t: 3.35, x: 236, y: 212 }], lt);
    let px, py, s, rot = 0;
    if (lq < 0.85) { const q = clamp((lq - 0.25) / 0.6); px = lerp(304, 262, q); py = lerp(392, 518, q) - Math.sin(q * Math.PI) * 70; s = idle(t, 1, { eyes: 'happy', mouth: 'open', armL: -2.6, armR: -2.6, noShadow: q < 1, squash: q > 0.2 && q < 0.8 ? 1.12 : 1 }); if (q > 0.1 && q < 0.9) for (let i = 0; i < 3; i++) inkLine(ctx, [[px - 8 + i * 8, py - 70], [px - 8 + i * 8 + 4, py - 84]], 1.4, P.card, 400 + i); }
    else if (lq < 2.12) { const w = walkPath([{ t: 1.0, x: 262, y: 518 }, { t: 2.0, x: 150, y: 518 }], lq, 12); px = w.x; py = w.y; s = idle(t, 1, { face: -0.85, walk: w.moving ? 1 : 0, phase: w.phase, squash: lq < 1.0 ? 0.82 : 1 }); }
    else if (lq < 3.35) { px = f.x; py = f.y + 46; rot = Math.floor(lt * 8) % 2 ? 0.14 : -0.12; s = idle(t, 1, { eyes: 'wide', mouth: 'o', walk: 1, phase: lt * 7, armL: -2.6, armR: -2.6, brows: 'up', noShadow: true }); }
    else { const l2 = lq - 3.6; px = 236; py = 250; s = idle(t, 1, { squash: l2 > -0.25 && l2 < 0.1 ? 0.78 : 1, eyes: l2 > 0.75 && l2 < 1.25 ? 'happy' : l2 > 1.25 ? 'sleepy' : 'happy', mouth: l2 > 0.75 && l2 < 1.25 ? 'open' : 'cat', blush: 1 }); }
    ctx.save(); ctx.translate(px, py - 50); ctx.rotate(rot); ctx.translate(-px, -(py - 50));
    C.draw(ctx, 'mochi', s, px, py, 1.15, q12(t));
    ctx.restore();
    if (lq > 2.12 && lq < 3.35) text(ctx, '哇—！', px + 40, py - 70, { font: F(18, 700), color: P.mustard, align: 'center', stroke: P.ink, strokeW: 3 });
    if (lq > 3.55 && lq < 3.95) text(ctx, '咚！', 290, 236, { font: F(20, 700), color: P.card, align: 'center', stroke: P.ink, strokeW: 3 });
    if (lq > 3.95) balloon(ctx, 92, 128, 126, 40, 214, 192, '休息一下吧～', clamp((lt - 3.95) / 0.15));
    card(ctx, 60, 30, 240, 26, { fill: P.card, id: 420 }); tape(ctx, 66, 32, 20, -0.6, P.red);
    text(ctx, 'Android 懸浮桌寵 · 視覺模擬（未實機驗證）', 186, 48, { font: F(10.5, 700), color: P.ink, align: 'center' });
    touch(ctx, f);
    statusBar(ctx, '21:42', '#fff');
  }

  // ---------------- 11. END ----------------
  function end(ctx, lt, t) {
    dp(ctx, t); paper(ctx);
    const a = clamp(lt / 0.3);
    ctx.save(); ctx.globalAlpha = a;
    C.draw(ctx, 'mochi', idle(t, 1, { eyes: 'happy', mouth: 'smile', armR: Math.floor(lt * 6) % 2 ? -2.6 : -2.0 }), 120, 312, 1.6, q12(t));
    C.draw(ctx, 'kuri', idle(t, 2, { face: -0.3 }), 186, 316, 1.5, q12(t));
    C.draw(ctx, 'sora', idle(t, 3, { face: -0.4, eyes: 'sleepy' }), 248, 320, 1.4, q12(t));
    text(ctx, '方案 C', 180, 380, { font: F(14, 700), color: P.terra, align: 'center', ls: 4 });
    heading(ctx, '手帳繪本', 180, 422, { align: 'center', size: 32 });
    text(ctx, 'Inkpot Tales', 180, 456, { font: F(16, 700), color: P.ink2, align: 'center', ls: 2 });
    text(ctx, '手繪墨線 · 剪貼手帳 UI · 一拍二的繪本節奏', 180, 488, { font: F(12), color: P.ink2, align: 'center' });
    ctx.restore();
  }

  // ---------------- transitions / chapter / post ----------------
  function transition(ctx, A, B, p) {
    const q = E.inOutCubic(p);
    const x = 1080 * (1 - q);
    ctx.drawImage(A, 0, 0);
    ctx.fillStyle = `rgba(59,42,37,${0.25 * q})`; ctx.fillRect(0, 0, x, 1920);
    ctx.save(); ctx.beginPath(); ctx.rect(x, 0, 1080 - x, 1920); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
    // curled page edge
    const g = ctx.createLinearGradient(x, 0, x + 70, 0); g.addColorStop(0, 'rgba(255,250,235,0.85)'); g.addColorStop(0.3, 'rgba(240,225,195,0.6)'); g.addColorStop(1, 'rgba(240,225,195,0)');
    ctx.fillStyle = g; ctx.fillRect(x, 0, 70, 1920);
    const s = ctx.createLinearGradient(x - 40, 0, x, 0); s.addColorStop(0, 'rgba(60,40,30,0)'); s.addColorStop(1, 'rgba(60,40,30,0.35)');
    ctx.fillStyle = s; ctx.fillRect(x - 40, 0, 40, 1920);
  }
  function chapter(ctx, s, a, idx) {
    if (s.id === 'pet' || s.id === 'logo' || s.id === 'end') return;
    ctx.scale(OC.DP, OC.DP); ctx.globalAlpha = a;
    const label = `${String(idx).padStart(2, '0')} · ${s.zh}`;
    ctx.font = F(10, 700); const w = ctx.measureText(label).width + 22;
    tape(ctx, 180, 12, w, 0, P.mustard, 0.75);
    text(ctx, label, 180, 15.5, { font: F(10, 700), color: P.ink, align: 'center' });
  }
  function post(ctx) {
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.6;
    ctx.drawImage(OC.S.grain(), 0, 0, 1080, 1920);
  }

  OC.themes.sketch = {
    id: 'sketch', name: '手帳繪本 Inkpot Tales', short: 'C',
    fonts: [
      { family: 'LXGW WenKai TC', url: 'assets/fonts/LXGWWenKaiTC-Regular.woff', descriptors: { weight: '400' } },
      { family: 'LXGW WenKai TC', url: 'assets/fonts/LXGWWenKaiTC-Bold.woff', descriptors: { weight: '700' } },
    ],
    init() { OC.S.grain(); },
    shots: { logo, island, creator, profile, dialogue, map, inventory, shop, studio, pet, end },
    transition, chapter, post,
  };
})();
