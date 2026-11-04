/* Scheme D — Windsong Fields : storyboard shots */
(function () {
  'use strict';
  const { TAU, clamp, lerp, E, spring, wobble, ellipse, rr, mix, rgba, text, typewriter, finger, walkPath, rng, DATA } = OC;
  const V = OC.V, W = OC.WS, P = W.P, A = OC.ACT, Wd = OC.WS.WORLD;
  const { SANS, SERIF, ZSERIF, stxt, sicon, slate, brackets, hairline, diamond, prompt, tabs, blurred, touch, statusBar, itemD } = W;
  const dp = (ctx) => ctx.scale(OC.DP, OC.DP);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const ch = W.ch;

  const field = (ctx, t, cam, night = 0, chars = []) => Wd.drawField(ctx, { t, cam, night, chars });
  const baseChars = (t) => [
    { d: 'kuri', s: A.idle(t, 2, { face: 0.6 }), x: 166, y: 548 },
    { d: 'sora', s: A.idle(t, 3, { eyes: 'sleepy', mouth: 'flat', blink: 0.6 }), x: 102, y: 408, emote: { kind: 'zzz', p: (t * 0.35) % 1 } },
  ];

  function minimap(ctx, cx, cy, r, t, press = 1) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(press, press);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = 'rgba(16,20,24,0.55)'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(160,182,110,0.55)'; V.blob(ctx, -4, 6, r * 0.9, r * 1.05, 2.2); ctx.fill();
    ctx.strokeStyle = 'rgba(140,200,215,0.9)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-r, -8); ctx.quadraticCurveTo(-4, 2, r, 18); ctx.stroke();
    ctx.fillStyle = P.gold; diamond(ctx, 10, -8, 2.2, P.gold); diamond(ctx, -2, 16, 2.2, '#E8735E');
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3)); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
    text(ctx, 'N', 0, -r - 5, { font: SERIF(8), color: P.text, align: 'center', base: 'middle' });
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  }
  function hud(ctx, t, o = {}) {
    const lt = o.lt ?? 9, on = (k) => E.outCubic(clamp((lt - 0.3 - k * 0.15) / 0.6));
    ctx.save();
    let q = on(0); ctx.globalAlpha = q;
    for (let i = 0; i < 4; i++) { V.icon(ctx, 'heart', 22 + i * 15 + 0.6, 40 + 1, 13, 'rgba(0,0,0,0.4)'); V.icon(ctx, 'heart', 22 + i * 15, 40, 13, i < 3 ? '#E8735E' : 'rgba(255,255,255,0.5)'); V.icon(ctx, 'heartO', 22 + i * 15, 40, 13, '#FFF6E8', 1.6); }
    stxt(ctx, '心情', 16, 60, { font: SANS(500, 8.5), color: P.text });
    q = on(1); ctx.globalAlpha = q;
    const night = o.night || 0;
    sicon(ctx, night > 0.55 ? 'moon' : 'sun', 254, 41, 14, night > 0.55 ? '#DDE3FF' : '#FFE29A', 1.9);
    stxt(ctx, o.clock || '10:20', 286, 46, { font: SANS(700, 13), color: P.text, align: 'center' });
    stxt(ctx, '18°C', 342, 46, { font: SANS(500, 10), color: P.text, align: 'right' });
    ctx.save(); ctx.translate(286, 62); ctx.rotate(-0.5 + Math.sin(t * 0.7) * 0.15); stxt(ctx, '➤', 0, 0, { font: SANS(700, 9), color: P.text, align: 'center', base: 'middle' }); ctx.restore();
    stxt(ctx, '微風', 298, 65, { font: SANS(500, 8), color: P.sub });
    q = on(2); ctx.globalAlpha = q;
    sicon(ctx, 'coin', 24, 608, 13, '#FFE29A', 1.8); stxt(ctx, fmt(o.coins ?? DATA.coins), 36, 612, { font: SANS(700, 11), color: P.text });
    q = on(3); ctx.globalAlpha = q;
    minimap(ctx, 314, 584, 34, t, o.mapPress || 1);
    ctx.save(); ctx.translate(258, 610); ctx.scale(o.bagPress || 1, o.bagPress || 1); ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fillStyle = 'rgba(16,20,24,0.45)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.9; ctx.stroke(); V.icon(ctx, 'bag', 0, 0, 15, P.text, 1.8); ctx.restore();
    ctx.beginPath(); ctx.arc(336, 530, 11, 0, TAU); ctx.fillStyle = 'rgba(16,20,24,0.45)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.9; ctx.stroke(); V.icon(ctx, 'dots', 336, 530, 12, P.text);
    ctx.restore();
  }

  // ---------------- 1. LOGO ----------------
  function logo(ctx, lt, t) {
    dp(ctx);
    const s = A.idle(t, 1, { face: 0.3, eyes: lt > 2 ? 'happy' : 'round', tilt: -0.05 });
    field(ctx, t, { x: 210, y: 420 - lt * 6, z: 1.1 }, 0, [{ d: 'mochi', s, x: 214, y: 452 }]);
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, 'rgba(14,18,22,0.78)'); g.addColorStop(0.45, 'rgba(14,18,22,0.25)'); g.addColorStop(0.75, 'rgba(14,18,22,0.05)'); g.addColorStop(1, 'rgba(14,18,22,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    const word = 'OC SHIMEJI';
    ctx.save(); ctx.font = SERIF(30);
    const w = ctx.measureText(word).width + 6 * (word.length - 1); let x = 180 - w / 2;
    [...word].forEach((c, i) => { const q = clamp((lt - 0.3 - i * 0.07) / 0.6); ctx.globalAlpha = E.outCubic(q); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillText(c, x + 1, 171 + (1 - q) * 6); ctx.fillStyle = '#F6F2E8'; ctx.fillText(c, x, 170 + (1 - q) * 6); x += ctx.measureText(c).width + 6; });
    ctx.restore();
    const hl = E.inOutCubic(clamp((lt - 1.0) / 0.8));
    hairline(ctx, 180 - 130 * hl, 186, 180 + 130 * hl, 0.7); diamond(ctx, 180, 186.4, 2.6 * hl, P.gold);
    text(ctx, '我的 OC，住進你的手機', 180, 210, { font: ZSERIF(13), color: P.text, align: 'center', alpha: clamp((lt - 1.3) / 0.5), ls: 3 });
    // light motes
    const r = rng(5); for (let i = 0; i < 24; i++) { const x0 = r() * 360, y0 = r() * 640, q = (t * 0.06 + r()) % 1; ctx.fillStyle = `rgba(255,240,200,${0.6 * Math.sin(q * Math.PI)})`; ellipse(ctx, x0 + Math.sin(t + i) * 8, y0 - q * 60, 1.3, 1.3); ctx.fill(); }
    if (lt > 1.8) text(ctx, '— 點擊開始 —', 180, 600, { font: SANS(500, 11), color: P.text, align: 'center', alpha: 0.5 + 0.5 * Math.sin(t * 3), ls: 3 });
  }

  // ---------------- 2. ISLAND ----------------
  const WALK = [{ t: 0.9, x: 232, y: 440 }, { t: 2.7, x: 282, y: 458 }];
  function island(ctx, lt, t) {
    dp(ctx);
    const night = E.inOutSine(clamp((lt - 3.7) / 2.1));
    const m = A.island(lt, t, WALK);
    const z = E.inOutCubic(clamp((lt + 0.2) / 2.6));
    const cam = { x: lerp(200, m.x - 20, z * 0.75), y: lerp(410, m.y - 10, z * 0.7), z: lerp(0.8, 1.25, z) };
    field(ctx, t, cam, night, [{ d: 'mochi', s: m.s, x: m.x, y: m.y, emote: m.emote }, ...baseChars(t)]);
    const mins = lerp(620, 1265, night), clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
    hud(ctx, t, { lt, night, clock });
    statusBar(ctx, clock);
  }

  // ---------------- 3. CREATOR ----------------
  const EYES = [['round', '原色瞳'], ['sparkle', '星光瞳'], ['happy', '笑眼'], ['sleepy', '睏睏眼'], ['wide', '圓睜眼']];
  const EARS = [['cat', '貓耳'], ['bunny', '兔耳'], ['bear', '熊耳'], ['fold', '折耳'], ['sprout', '嫩芽']];
  const CATS = ['眼睛', '眉毛', '嘴巴', '腮紅', '耳朵', '毛色'];
  function creator(ctx, lt, t) {
    dp(ctx);
    blurred(ctx, (b) => field(b, t, { x: 230, y: 450, z: 1.4 }, 0, []), 6, 0.55);
    stxt(ctx, '外觀', 26, 58, { font: ZSERIF(20), color: P.text });
    text(ctx, 'APPEARANCE', 72, 58, { font: SERIF(9), color: P.sub, ls: 2 });
    hairline(ctx, 10, 68, 350, 0.35);
    const f = finger([{ t: 0.5, x: 200, y: 560 }, { t: 0.82, x: 150, y: 498 }, { t: 0.9, x: 150, y: 498, down: true }, { t: 1.05, x: 150, y: 498 }, { t: 1.45, x: 34, y: 268 }, { t: 1.55, x: 34, y: 268, down: true }, { t: 1.7, x: 34, y: 268 }, { t: 2.1, x: 150, y: 498 }, { t: 2.2, x: 150, y: 498, down: true }, { t: 2.35, x: 150, y: 498 }, { t: 2.7, x: 230, y: 578 }, { t: 2.8, x: 230, y: 578, down: true }, { t: 3.05, x: 262, y: 578, down: true }, { t: 3.15, x: 262, y: 578 }, { t: 3.4, x: 160, y: 280 }, { t: 3.5, x: 160, y: 280, down: true }, { t: 4.15, x: 260, y: 286, down: true }, { t: 4.25, x: 260, y: 286 }], lt);
    const tab = lt < 1.6 ? 0 : 4, eye = lt > 0.95 ? 1 : 0, ear = lt > 2.25 ? 1 : 0, hue = clamp((lt - 2.8) / 0.3);
    const drag = clamp((lt - 3.5) / 0.65), face = lt < 4.15 ? E.inOutSine(drag) * 0.9 : 0.9 * (1 - spring(lt - 4.15, 1.3, 5));
    // category column
    CATS.forEach((c, i) => { const y = 120 + i * 37, on = i === tab; if (on) { slate(ctx, 12, y - 13, 54, 26, { r: 4, fill: 'rgba(255,255,255,0.08)' }); diamond(ctx, 16, y, 2.2, P.gold); } text(ctx, c, 40, y + 4, { font: SANS(on ? 700 : 500, 11), color: on ? P.text : P.dim, align: 'center' }); });
    // dais + character
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ellipse(ctx, 206, 376, 86, 18); ctx.stroke(); ctx.strokeStyle = rgba(P.gold, 0.6); ellipse(ctx, 206, 376, 70, 14); ctx.stroke();
    const sg = ctx.createRadialGradient(206, 300, 10, 206, 300, 150); sg.addColorStop(0, 'rgba(255,240,200,0.22)'); sg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = sg; ctx.fillRect(56, 150, 300, 240); ctx.restore();
    const D = Object.assign({}, W.DES.mochi, { fur: mix('#F7EEDF', '#D9DDF2', hue), shade: mix('#D6C3A8', '#A9AED6', hue) });
    const pop = wobble(lt - 0.95, 2.2, 6) * 0.07 + wobble(lt - 2.25, 2.2, 6) * 0.06;
    ch(ctx, D, A.idle(t, 1, { face, eyes: lt > 0.95 && lt < 1.35 ? 'happy' : EYES[eye][0], mouth: lt > 0.95 && lt < 1.35 ? 'smile' : 'cat', ears: EARS[ear][0], squash: 1 + pop, earL: wobble(lt - 2.25, 2.8, 4) * 0.6, earR: wobble(lt - 2.3, 2.8, 4) * 0.6 }), 206, 376, 3.1, t);
    stxt(ctx, '麻糬', 206, 410, { font: ZSERIF(15), color: P.text, align: 'center' });
    // carousel
    const opts = tab === 0 ? EYES : EARS, sel = tab === 0 ? eye : ear;
    slate(ctx, 14, 450, 332, 100, { r: 8 });
    opts.forEach((o, i) => {
      const x = 52 + i * 64, y = 470;
      ctx.save(); rr(ctx, x - 26, y, 52, 52, 4); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.clip();
      ch(ctx, 'mochi', tab === 0 ? { eyes: o[0], noShadow: true } : { ears: o[0], noShadow: true }, x, y + (tab === 0 ? 86 : 92), tab === 0 ? 1.8 : 1.35, t);
      ctx.restore();
      if (i === sel) brackets(ctx, x - 26, y, 52, 52, t);
    });
    text(ctx, opts[sel][1], 180, 540, { font: SANS(700, 11), color: P.gold, align: 'center' });
    // hue slider
    const hg = ctx.createLinearGradient(60, 0, 300, 0); ['#F7EEDF', '#F2C9B8', '#D9DDF2', '#BFE0D6', '#E8D79A', '#D69B66'].forEach((c, i) => hg.addColorStop(i / 5, c));
    ctx.fillStyle = hg; rr(ctx, 60, 576, 240, 4, 2); ctx.fill();
    diamond(ctx, lerp(84, 156, hue), 578, 6, '#fff'); diamond(ctx, lerp(84, 156, hue), 578, 3.5, P.gold);
    text(ctx, '毛色', 30, 581, { font: SANS(500, 10), color: P.sub });
    prompt(ctx, 40, 614, 'check', '選擇'); prompt(ctx, 130, 614, 'back', '返回'); prompt(ctx, 220, 614, 'walk', '拖曳旋轉');
    statusBar(ctx, '10:24');
    touch(ctx, f);
  }

  // ---------------- 4. PROFILE ----------------
  function wheel(ctx, x, y, r, v, col, ic, label) {
    const n = 8;
    for (let i = 0; i < n; i++) { const a0 = -Math.PI / 2 + (i / n) * TAU + 0.06, a1 = a0 + TAU / n - 0.12; const on = i < Math.round(v * n); ctx.strokeStyle = on ? col : 'rgba(255,255,255,0.14)'; ctx.lineWidth = 4; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke(); }
    V.icon(ctx, ic, x, y, 12, P.text, 1.7);
    text(ctx, label, x, y + r + 13, { font: SANS(500, 9.5), color: P.sub, align: 'center' });
  }
  function profile(ctx, lt, t) {
    dp(ctx);
    blurred(ctx, (b) => field(b, t, { x: 200, y: 430, z: 1.3 }, 0, []), 6, 0.6);
    tabs(ctx, ['檔案', '關係', '目標', '技能'], 0, 54, t);
    // portrait
    const pg = ctx.createRadialGradient(92, 220, 10, 92, 230, 110); pg.addColorStop(0, 'rgba(255,240,200,0.18)'); pg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = pg; ctx.fillRect(0, 100, 200, 260);
    ctx.strokeStyle = rgba(P.gold, 0.5); ctx.lineWidth = 1; ellipse(ctx, 92, 304, 60, 12); ctx.stroke();
    ch(ctx, 'mochi', A.idle(t, 1, { face: 0.25, eyes: lt > 3.3 ? 'happy' : 'round', mouth: lt > 3.3 ? 'smile' : 'cat' }), 92, 304, 3.3, t);
    stxt(ctx, '麻糬', 188, 118, { font: ZSERIF(24), color: P.text });
    text(ctx, '好奇的旅人', 189, 138, { font: SANS(700, 10), color: P.gold, ls: 1 });
    text(ctx, '生日 春・3日　島民 12 日', 189, 156, { font: SANS(500, 9.5), color: P.sub });
    DATA.traits.forEach((tr, i) => { const q = E.outCubic(clamp((lt - 0.3 - i * 0.1) / 0.4)); const x = 188 + (i % 2) * 78, y = 172 + Math.floor(i / 2) * 26; ctx.save(); ctx.globalAlpha = q; rr(ctx, x, y, 72, 20, 3); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.8; ctx.stroke(); diamond(ctx, x + 8, y + 10, 2, P.gold); text(ctx, tr, x + 15, y + 14, { font: SANS(500, 9.5), color: P.text }); ctx.restore(); });
    text(ctx, '「風好舒服…等等去營火那邊。」', 188, 240, { font: SANS(500, 10), color: P.sub, alpha: clamp((lt - 0.8) / 0.4) });
    hairline(ctx, 10, 336, 350, 0.3);
    text(ctx, '生活狀態', 24, 356, { font: SANS(700, 11), color: P.text });
    const cols = ['#E8735E', '#F2C14E', '#E99AC0', '#7FC6E3', '#8FD3A6'], ics = ['heart', 'sun', 'face', 'chat', 'sparkle'];
    DATA.needs.forEach((n, i) => wheel(ctx, 46 + i * 67, 394, 17, n.v * E.outCubic(clamp((lt - 0.4 - i * 0.1) / 0.8)), cols[i], ics[i], n.zh));
    hairline(ctx, 10, 440, 350, 0.3);
    text(ctx, '關係', 24, 460, { font: SANS(700, 11), color: P.text });
    DATA.relations.forEach((r, i) => {
      const y = 472 + i * 54; slate(ctx, 16, y, 328, 46, { r: 6, fill: 'rgba(255,255,255,0.05)' });
      ctx.save(); ctx.beginPath(); ctx.arc(42, y + 23, 17, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); ctx.clip(); ch(ctx, r.who, A.idle(t, 4 + i, { noShadow: true }), 42, y + 54, 0.9, t); ctx.restore();
      text(ctx, DATA.cast[r.who].zh, 70, y + 20, { font: SANS(700, 12), color: P.text }); text(ctx, r.zh, 70, y + 36, { font: SANS(500, 9.5), color: P.sub });
      for (let h = 0; h < 5; h++) V.icon(ctx, h < r.hearts ? 'heart' : 'heartO', 236 + h * 20, y + 23, 13, h < r.hearts ? '#E8735E' : 'rgba(255,255,255,0.4)', 1.5);
      if (i === 0 && lt > 3.2) brackets(ctx, 16, y, 328, 46, t);
    });
    prompt(ctx, 40, 614, 'check', '詳細'); prompt(ctx, 130, 614, 'back', '返回');
    statusBar(ctx, '10:26');
    touch(ctx, finger([{ t: 2.9, x: 220, y: 420 }, { t: 3.12, x: 200, y: 495 }, { t: 3.2, x: 200, y: 495, down: true }, { t: 3.36, x: 200, y: 495 }], lt));
  }

  // ---------------- 5. DIALOGUE ----------------
  function dialogue(ctx, lt, t) {
    dp(ctx);
    const D = A.dialogue(lt, t, [252, 566], [208, 564]);
    field(ctx, t, { x: 190, y: 540, z: lerp(2.0, 2.12, E.inOutSine(clamp(lt / 5))) }, 0, [
      { d: 'mochi', s: D.mochi, x: 160, y: 566 }, { d: 'kuri', s: D.kuri, x: D.kx, y: D.ky, emote: D.emote },
    ]);
    const vg = ctx.createLinearGradient(0, 400, 0, 640); vg.addColorStop(0, 'rgba(10,14,18,0)'); vg.addColorStop(1, 'rgba(10,14,18,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 400, 360, 240);
    if (lt > 0.35 && lt < 0.95) { const a = clamp((lt - 0.35) / 0.15) * clamp((0.95 - lt) / 0.15); ctx.save(); ctx.globalAlpha = a; prompt(ctx, 220, 300, 'chat', '交談'); ctx.restore(); }
    const box = (name, str, p, a) => {
      ctx.save(); ctx.globalAlpha = a;
      slate(ctx, 22, 500, 316, 78, { r: 10, fill: 'rgba(14,18,22,0.72)' });
      text(ctx, name, 40, 494, { font: SANS(700, 11), color: P.gold, ls: 2 }); diamond(ctx, 32, 490.5, 2.2, P.gold);
      const shown = typewriter(str, p), full = Array.from(str);
      // gentle per-character fade on the leading glyph
      text(ctx, shown, 40, 534, { font: SANS(500, 13.5), color: P.text });
      if (p >= 1) { const by = 566 + Math.sin(t * 6) * 1.5; ctx.beginPath(); ctx.moveTo(316, by - 3); ctx.lineTo(322, by - 3); ctx.lineTo(319, by + 1); ctx.closePath(); ctx.fillStyle = P.text; ctx.fill(); }
      ctx.restore();
    };
    const a1 = clamp((lt - 0.95) / 0.25) * (1 - clamp((lt - 2.75) / 0.2));
    if (a1 > 0) box('栗子', DATA.dialogue.a, clamp((lt - 1.05) / 1.0), a1);
    const a2 = clamp((lt - 3.75) / 0.25);
    if (a2 > 0) box('栗子', DATA.dialogue.b, clamp((lt - 3.85) / 0.7), a2);
    const ca = clamp((lt - 2.15) / 0.25) * (1 - clamp((lt - 3.0) / 0.2));
    if (ca > 0) DATA.dialogue.choices.forEach((c, i) => { const q = E.outCubic(clamp((lt - 2.15 - i * 0.08) / 0.3)); const y = 410 + i * 40; ctx.save(); ctx.globalAlpha = ca; ctx.translate((1 - q) * 20, 0); slate(ctx, 150, y, 190, 32, { r: 6, fill: 'rgba(14,18,22,0.72)' }); text(ctx, c, 166, y + 21, { font: SANS(500, 12.5), color: P.text }); if (i === 0) brackets(ctx, 150, y, 190, 32, t); ctx.restore(); });
    statusBar(ctx, '10:32');
    touch(ctx, finger([{ t: 2.4, x: 260, y: 520 }, { t: 2.65, x: 245, y: 426 }, { t: 2.72, x: 245, y: 426, down: true }, { t: 2.88, x: 245, y: 426 }], lt));
  }

  // ---------------- 6. MAP ----------------
  const LOC = [['village', 176, 330, 'home'], ['forest', 96, 206, 'leaf'], ['beach', 262, 448, 'sun'], ['hill', 262, 196, 'compass'], ['market', 86, 456, 'cart']];
  function topoMap(ctx, t, sel, zoom) {
    ctx.save();
    const z = zoom || { s: 1, x: 180, y: 320 };
    ctx.translate(180, 320); ctx.scale(z.s, z.s); ctx.translate(-z.x, -z.y);
    ctx.fillStyle = '#1C2830'; ctx.fillRect(-200, -200, 760, 1040);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.6; for (let x = -200; x < 560; x += 30) { ctx.beginPath(); ctx.moveTo(x, -200); ctx.lineTo(x, 840); ctx.stroke(); } for (let y = -200; y < 840; y += 30) { ctx.beginPath(); ctx.moveTo(-200, y); ctx.lineTo(560, y); ctx.stroke(); }
    const land = [[176, 330, 74, 56, 1.3, '#6E7F57'], [96, 206, 54, 42, 4.2, '#4F6A4A'], [262, 448, 50, 32, 6.1, '#9C9273'], [262, 196, 52, 40, 2.6, '#7D8A5E'], [86, 456, 44, 30, 8.2, '#6E7F57']];
    for (const [x, y, rx, ry, sd, c] of land) {
      for (let k = 4; k >= 1; k--) { ctx.strokeStyle = `rgba(190,210,200,${0.08 + k * 0.03})`; ctx.lineWidth = 0.7; V.blob(ctx, x, y, rx + k * 9, ry + k * 7, sd); ctx.stroke(); }
      ctx.fillStyle = c; V.blob(ctx, x, y, rx, ry, sd); ctx.fill();
      for (let k = 1; k <= 3; k++) { ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.6; V.blob(ctx, x - k * 2, y - k * 2, rx - k * 12, ry - k * 9, sd + k); ctx.stroke(); }
    }
    ctx.restore();
  }
  function map(ctx, lt, t) {
    dp(ctx);
    const rev = E.inOutCubic(clamp((lt - 0.45) / 0.6));
    if (rev < 1) { field(ctx, t, { x: 262, y: 440, z: 1.25 }, 0, [{ d: 'mochi', s: A.idle(t, 1), x: 282, y: 458 }, ...baseChars(t)]); hud(ctx, t, { mapPress: lt > 0.3 && lt < 0.45 ? 0.92 : 1 }); }
    const zp = E.inOutCubic(clamp((lt - 2.6) / 0.6));
    if (rev > 0 && lt < 3.25) {
      ctx.save(); ctx.beginPath(); ctx.arc(314, 584, rev * 760, 0, TAU); ctx.clip();
      const fl = LOC[1];
      topoMap(ctx, t, lt > 1.4 ? 'forest' : null, { s: 1 + zp * 2, x: lerp(180, fl[1], zp), y: lerp(320, fl[2], zp) });
      const ua = 1 - zp;
      ctx.globalAlpha = ua;
      LOC.forEach(([id, x, y, ic], i) => {
        const on = id === 'forest' && lt > 1.4;
        const pa = E.outCubic(clamp((lt - 0.8 - i * 0.06) / 0.3));
        ctx.save(); ctx.globalAlpha = ua * pa;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fillStyle = 'rgba(14,18,22,0.8)'; ctx.fill(); ctx.strokeStyle = on ? P.gold : 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
        V.icon(ctx, ic, x, y, 11, on ? P.gold : P.text, 1.7);
        text(ctx, DATA.places.find((d) => d.id === id).zh, x, y + 22, { font: SANS(500, 10), color: on ? P.gold : P.text, align: 'center' });
        ctx.restore();
      });
      // player arrow + reticle cursor
      ctx.save(); ctx.translate(150, 336); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      const cur = finger([{ t: 0.9, x: 180, y: 320 }, { t: 1.4, x: 96, y: 206 }], lt) || { x: 96, y: 206 };
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cur.x, cur.y, 15 + Math.sin(t * 4) * 1.5, 0, TAU); ctx.stroke();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(cur.x + dx * 11, cur.y + dy * 11); ctx.lineTo(cur.x + dx * 20, cur.y + dy * 20); ctx.stroke(); }
      // header + info
      stxt(ctx, '地圖', 26, 58, { font: ZSERIF(20), color: P.text }); text(ctx, 'MAP', 74, 58, { font: SERIF(9), color: P.sub, ls: 2 }); hairline(ctx, 10, 68, 350, 0.35);
      const ic = E.outCubic(clamp((lt - 1.6) / 0.35));
      if (ic > 0) {
        ctx.save(); ctx.translate(0, (1 - ic) * 30); ctx.globalAlpha = ua * ic;
        slate(ctx, 16, 506, 328, 84, { r: 8 });
        text(ctx, '苔光森林', 34, 534, { font: ZSERIF(17), color: P.text }); text(ctx, 'MOSSLIGHT WOODS', 120, 533, { font: SERIF(8.5), color: P.sub, ls: 1.5 });
        V.icon(ctx, 'rain', 40, 558, 13, P.text); text(ctx, '小雨', 52, 562, { font: SANS(500, 10), color: P.sub }); V.icon(ctx, 'clock', 98, 558, 12, P.text); text(ctx, '步行 3 分', 110, 562, { font: SANS(500, 10), color: P.sub });
        text(ctx, '雨後的苔蘚會發光。', 34, 579, { font: SANS(500, 10), color: P.sub });
        const pr = lt > 2.45 && lt < 2.6;
        ctx.save(); ctx.translate(290, 548); ctx.scale(pr ? 0.94 : 1, pr ? 0.94 : 1); rr(ctx, -38, -14, 76, 28, 14); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill(); text(ctx, '前往', 0, 1, { font: SANS(700, 12), color: P.uiSolid, align: 'center', base: 'middle' }); ctx.restore();
        brackets(ctx, 252, 534, 76, 28, t);
        ctx.restore();
      }
      ctx.restore();
      if (rev < 1) { ctx.strokeStyle = rgba(P.gold, 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(314, 584, rev * 760, 0, TAU); ctx.stroke(); }
    }
    // travel: dissolve to light motes, then the woods
    const wa = clamp((lt - 3.05) / 0.45);
    if (lt > 2.8) {
      const fade = Math.sin(clamp((lt - 2.8) / 0.6) * Math.PI);
      if (wa > 0) { ctx.save(); ctx.globalAlpha = wa; const w = walkPath([{ t: 3.0, x: 196, y: 650 }, { t: 4.6, x: 188, y: 520 }], lt, 12); Wd.drawWoods(ctx, { t, chars: [{ d: 'mochi', s: A.idle(t, 1, { back: 0.85, walk: w.moving ? 1 : 0, phase: w.phase, hold: 'leaf' }), x: w.x, y: w.y, sc: 1.35 }] }); ctx.restore(); }
      ctx.fillStyle = `rgba(236,240,232,${0.85 * fade})`; ctx.fillRect(0, 0, 360, 640);
      const r = rng(7); for (let i = 0; i < 40; i++) { const x = r() * 360, y = r() * 640 - (lt - 2.8) * 120 * (0.5 + r()); ctx.fillStyle = `rgba(255,255,255,${fade})`; ellipse(ctx, x, y, 1.6, 1.6); ctx.fill(); }
      const la = clamp((lt - 3.5) / 0.5);
      if (la > 0) { ctx.save(); ctx.globalAlpha = la; stxt(ctx, '苔光森林', 180, 124, { font: ZSERIF(26), color: P.text, align: 'center', ls: 8 }); hairline(ctx, 60, 138, 300, 0.7); text(ctx, 'MOSSLIGHT WOODS', 180, 156, { font: SERIF(10), color: P.text, align: 'center', ls: 4 }); ctx.restore(); }
    }
    statusBar(ctx, '10:41');
    touch(ctx, finger([{ t: 0.05, x: 250, y: 540 }, { t: 0.3, x: 314, y: 584 }, { t: 0.35, x: 314, y: 584, down: true }, { t: 0.5, x: 314, y: 584 }, { t: 1.3, x: 96, y: 206 }, { t: 1.38, x: 96, y: 206, down: true }, { t: 1.52, x: 96, y: 206 }, { t: 2.25, x: 290, y: 548 }, { t: 2.45, x: 290, y: 548, down: true }, { t: 2.6, x: 290, y: 548 }], lt));
  }

  // ---------------- 7. INVENTORY ----------------
  function inventory(ctx, lt, t) {
    dp(ctx);
    const f = finger([{ t: 0.0, x: 230, y: 580 }, { t: 0.2, x: 258, y: 610 }, { t: 0.25, x: 258, y: 610, down: true }, { t: 0.4, x: 258, y: 610 }, { t: 0.85, x: 56, y: 446 }, { t: 0.95, x: 56, y: 446, down: true }, { t: 1.45, x: 56, y: 446, down: true }, { t: 2.25, x: 112, y: 232, down: true }, { t: 2.3, x: 112, y: 232 }], lt);
    const ev = A.eat(lt, t, f, 110, 262);
    field(ctx, t, { x: 267, y: 482, z: 1.9 }, 0, [{ d: 'mochi', s: ev.s, x: 230, y: 450, emote: ev.happy ? { kind: '♥', p: clamp((ev.eatT - 0.9) / 1.3) } : null }]);
    const open = E.outCubic(clamp((lt - 0.3) / 0.4)) * (1 - E.inOutCubic(clamp((lt - 1.5) / 0.4)) * 0.55);
    if (open < 0.05) hud(ctx, t, { bagPress: lt > 0.2 && lt < 0.4 ? 0.9 : 1 });
    if (open > 0.01) {
      ctx.fillStyle = `rgba(12,16,20,${0.35 * open})`; ctx.fillRect(0, 0, 360, 640);
      ctx.save(); ctx.translate(0, (1 - open) * 260);
      slate(ctx, 10, 372, 340, 252, { r: 10, fill: 'rgba(14,18,22,0.78)' });
      const cats = [['heart', '食物'], ['leaf', '素材'], ['star', '珍貴'], ['home', '家具']];
      cats.forEach(([ic, n], i) => { const x = 50 + i * 80, on = i === 0; V.icon(ctx, ic, x - 12, 396, 12, on ? P.gold : P.dim, 1.8); text(ctx, n, x + 2, 400, { font: SANS(on ? 700 : 500, 11), color: on ? P.text : P.dim }); if (on) diamond(ctx, x - 4, 410, 2, P.gold); });
      hairline(ctx, 16, 416, 344, 0.3);
      DATA.items.forEach((it, i) => {
        const x = 56 + (i % 4) * 82, y = 446 + Math.floor(i / 4) * 70;
        rr(ctx, x - 28, y - 28, 56, 56, 4); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.8; ctx.stroke();
        if (!(it.id === 'cake' && lt > 0.95 && lt < 2.32)) itemD(ctx, it.id, x, y - 2, 36);
        text(ctx, '×' + (it.id === 'cake' && lt > 2.32 ? it.n - 1 : it.n), x + 24, y + 24, { font: SANS(700, 9), color: P.text, align: 'right' });
        if (it.id === 'cake' && lt < 0.95) brackets(ctx, x - 28, y - 28, 56, 56, t);
      });
      text(ctx, '草莓蛋糕　飽足 +18', 26, 608, { font: SANS(500, 10.5), color: P.sub });
      ctx.restore();
    }
    if (f && lt > 0.95 && lt < 1.45) { ctx.strokeStyle = P.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 24, -Math.PI / 2, -Math.PI / 2 + TAU * ((lt - 0.95) / 0.5)); ctx.stroke(); }
    if (f && lt > 0.95 && lt < 2.32) { ctx.save(); ctx.translate(f.x, f.y - 20); ctx.rotate(Math.sin(t * 6) * 0.08); ctx.shadowColor = rgba(P.gold, 0.8); ctx.shadowBlur = 10; itemD(ctx, 'cake', 0, 0, 40); ctx.restore(); }
    if (ev.happy) { const q = clamp((ev.eatT - 0.9) / 1.0); ctx.save(); ctx.globalAlpha = clamp((ev.eatT - 0.9) / 0.2) * clamp((2.9 - ev.eatT) / 0.3); stxt(ctx, '飽足 +18', 180, 120 - q * 6, { font: SANS(700, 14), color: P.text, align: 'center' }); wheel(ctx, 180, 150, 13, lerp(0.42, 0.6, E.outCubic(q)), '#E8735E', 'heart', ''); ctx.restore(); }
    statusBar(ctx, '10:45');
    touch(ctx, f);
  }

  // ---------------- 8. SHOP ----------------
  function shop(ctx, lt, t) {
    dp(ctx);
    blurred(ctx, (b) => field(b, t, { x: 196, y: 520, z: 1.6 }, 0, []), 5, 0.55);
    const sold = lt > 1.45;
    ctx.save(); ctx.beginPath(); ctx.arc(70, 150, 52, 0, TAU); ctx.fillStyle = 'rgba(255,240,200,0.08)'; ctx.fill(); ctx.strokeStyle = rgba(P.gold, 0.5); ctx.lineWidth = 1; ctx.stroke(); ctx.clip();
    ch(ctx, 'sora', A.idle(t, 3, { eyes: sold ? 'happy' : 'round', mouth: sold ? 'smile' : 'cat', armR: sold ? -2.2 + Math.sin(t * 10) * 0.3 : undefined }), 70, 232, 2.6, t); ctx.restore();
    stxt(ctx, '旅行商人', 136, 128, { font: ZSERIF(19), color: P.text }); text(ctx, '蘇拉', 136, 146, { font: SANS(700, 10), color: P.gold, ls: 1 });
    text(ctx, sold ? '「謝謝惠顧，路上小心。」' : '「今天進了些好東西。」', 136, 168, { font: SANS(500, 10.5), color: P.sub });
    const coins = lerp(DATA.coins, DATA.coins - 120, E.outCubic(clamp((lt - 1.5) / 0.8)));
    sicon(ctx, 'coin', 286, 44, 13, '#FFE29A'); stxt(ctx, fmt(coins), 340, 48, { font: SANS(700, 12), color: P.text, align: 'right' });
    hairline(ctx, 10, 214, 350, 0.3);
    DATA.shop.forEach((s, i) => {
      const y = 228 + i * 58, on = i === 0 && lt > 0.55;
      slate(ctx, 16, y, 328, 50, { r: 6, fill: on ? 'rgba(255,255,255,0.1)' : 'rgba(14,18,22,0.6)' });
      itemD(ctx, s.id, 44, y + 25, 34);
      text(ctx, s.zh, 72, y + 22, { font: SANS(700, 12.5), color: P.text }); text(ctx, ['夜裡會發出柔光', '蓬鬆的雲朵', '一點點綠意', '踩起來很舒服'][i], 72, y + 38, { font: SANS(500, 9.5), color: P.sub });
      V.icon(ctx, 'coin', 292, y + 25, 12, '#FFE29A'); text(ctx, String(s.price), 330, y + 29, { font: SANS(700, 12), color: P.text, align: 'right' });
      if (on) brackets(ctx, 16, y, 328, 50, t);
    });
    // hold-to-buy
    const hold = clamp((lt - 1.0) / 0.45);
    slate(ctx, 16, 470, 328, 64, { r: 8 });
    text(ctx, sold ? '已放入背包' : '長按購買', 34, 507, { font: SANS(700, 13), color: sold ? '#8FD3A6' : P.text });
    ctx.save(); ctx.translate(300, 502); ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    ctx.strokeStyle = sold ? '#8FD3A6' : P.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + TAU * (sold ? 1 : hold)); ctx.stroke();
    V.icon(ctx, sold ? 'check' : 'cart', 0, 0, 16, P.text, 2); ctx.restore();
    if (lt > 1.45 && lt < 2.4) for (let i = 0; i < 6; i++) { const q = E.inOutCubic(clamp((lt - 1.45 - i * 0.06) / 0.55)); if (q <= 0 || q >= 1) continue; V.icon(ctx, 'coin', lerp(300, 286, q) + Math.sin(q * Math.PI) * (i - 2.5) * 12, lerp(502, 44, q) - Math.sin(q * Math.PI) * 30, 10, '#FFE29A'); }
    prompt(ctx, 40, 614, 'check', '購買'); prompt(ctx, 130, 614, 'back', '離開');
    statusBar(ctx, '10:52');
    touch(ctx, finger([{ t: 0.3, x: 200, y: 330 }, { t: 0.5, x: 180, y: 252 }, { t: 0.55, x: 180, y: 252, down: true }, { t: 0.7, x: 180, y: 252 }, { t: 0.92, x: 300, y: 502 }, { t: 1.0, x: 300, y: 502, down: true }, { t: 1.47, x: 300, y: 502 }], lt));
  }

  // ---------------- 9. STUDIO ----------------
  const STROKE = (() => { const p = []; for (let i = 0; i <= 30; i++) { const a = i / 30; p.push([238 + a * 34, 170 - Math.sin(a * Math.PI) * 30]); } return p; })();
  function studio(ctx, lt, t) {
    dp(ctx);
    blurred(ctx, (b) => field(b, t, { x: 220, y: 420, z: 1.3 }, 0, []), 6, 0.6);
    stxt(ctx, '動畫工坊', 26, 58, { font: ZSERIF(20), color: P.text }); text(ctx, '耳朵揮揮 · 8 FPS', 116, 58, { font: SANS(500, 9.5), color: P.sub }); hairline(ctx, 10, 68, 350, 0.35);
    const playing = lt > 2.35, frames = lt > 1.75 ? 6 : 5, cur = playing ? Math.floor((lt - 2.35) * 8) % frames : frames - 1;
    const earF = (k) => [0, 0.3, 0.6, 0.7, 0.4, 0.1][((k % 6) + 6) % 6];
    // parchment canvas
    rr(ctx, 36, 84, 288, 262, 6); ctx.fillStyle = '#EFE6CF'; ctx.fill(); ctx.strokeStyle = rgba(P.gold, 0.6); ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); rr(ctx, 36, 84, 288, 262, 6); ctx.clip();
    const r = rng(2); for (let i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(160,140,100,0.08)'; ellipse(ctx, 36 + r() * 288, 84 + r() * 262, 8 + r() * 20, 3 + r() * 6); ctx.fill(); }
    if (!playing) { ctx.save(); ctx.globalAlpha = 0.3; ch(ctx, Object.assign({}, W.DES.mochi, { fur: '#9FE3DA', shade: '#6FC4BA', accCol: '#6FC4BA' }), { earR: earF(cur - 1), armR: -earF(cur - 1) * 3, noShadow: true }, 180, 326, 3.1, t); ctx.restore(); }
    ch(ctx, 'mochi', { earR: earF(cur), armR: -earF(cur) * 3, eyes: cur > 2 ? 'happy' : 'round', mouth: cur > 2 ? 'smile' : 'cat', noShadow: true }, 180, 326, 3.1, t);
    const sp = playing ? 1 : clamp((lt - 0.3) / 1.0);
    if (sp > 0) { ctx.strokeStyle = P.red; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); STROKE.slice(0, Math.max(2, Math.floor(STROKE.length * sp))).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] + (playing ? (cur % 2) : 0)) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
    ctx.restore();
    // tool rail
    ['brush', 'eraser', 'onion', 'layers'].forEach((n, i) => { const x = 60 + i * 52; V.icon(ctx, n, x, 370, 16, i === 0 ? P.gold : P.text, 1.7); if (i === 0) brackets(ctx, x - 14, 356, 28, 28, t); });
    ctx.beginPath(); ctx.arc(300, 370, 13, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); V.icon(ctx, playing ? 'pause' : 'play', 300, 370, 13, P.uiSolid);
    // frames
    slate(ctx, 10, 398, 340, 120, { r: 8 });
    text(ctx, '畫格', 24, 420, { font: SANS(700, 11), color: P.text });
    for (let i = 0; i < frames; i++) {
      const x = 28 + i * 52, y = 432;
      const pop = i === 5 ? E.outCubic(clamp((lt - 1.75) / 0.3)) : 1;
      ctx.save(); ctx.globalAlpha = pop; rr(ctx, x, y, 44, 56, 3); ctx.fillStyle = '#EFE6CF'; ctx.fill(); ctx.clip(); ch(ctx, 'mochi', { earR: earF(i), armR: -earF(i) * 3, noShadow: true }, x + 22, y + 52, 0.82, 0); ctx.restore();
      text(ctx, String(i + 1), x + 22, y + 72, { font: SANS(500, 9), color: P.sub, align: 'center' });
      if (i === cur) brackets(ctx, x, y, 44, 56, t);
    }
    if (frames < 6 || lt < 2.05) { const x = 28 + frames * 52; rr(ctx, x, 432, 44, 56, 3); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); V.icon(ctx, 'plus', x + 22, 460, 14, P.text); }
    slate(ctx, 10, 528, 340, 64, { r: 8 });
    text(ctx, '圖層', 24, 550, { font: SANS(700, 11), color: P.text });
    ['特效', '線稿', '上色', '背景'].forEach((n, i) => { const x = 30 + i * 80; text(ctx, n, x + 30, 578, { font: SANS(i === 0 ? 700 : 500, 10.5), color: i === 0 ? P.gold : P.sub, align: 'center' }); if (i === 0) diamond(ctx, x + 12, 574, 2, P.gold); });
    prompt(ctx, 40, 614, 'brush', '繪製'); prompt(ctx, 130, 614, 'play', '播放'); prompt(ctx, 220, 614, 'back', '返回');
    statusBar(ctx, '11:03');
    const pk = STROKE.filter((_, i) => i % 4 === 0).map((p, i) => ({ t: 0.3 + i * 0.13, x: p[0], y: p[1], down: true }));
    touch(ctx, finger([{ t: 0.1, x: 220, y: 230 }, ...pk, { t: 1.45, x: 290, y: 300 }, { t: 1.62, x: 314, y: 460 }, { t: 1.7, x: 314, y: 460, down: true }, { t: 1.85, x: 314, y: 460 }, { t: 2.15, x: 300, y: 370 }, { t: 2.25, x: 300, y: 370, down: true }, { t: 2.4, x: 300, y: 370 }], lt));
  }

  // ---------------- 10. PET ----------------
  function pet(ctx, lt, t) {
    dp(ctx);
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#2C3B4A'); g.addColorStop(0.55, '#5D7A6A'); g.addColorStop(1, '#C9B98C'); ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = mix('#3E5A55', '#1E2B33', i / 3); ctx.beginPath(); ctx.moveTo(0, 470 - i * 40); for (let x = 0; x <= 360; x += 30) ctx.lineTo(x, 450 - i * 40 - Math.abs(Math.sin(x * 0.02 + i)) * 40); ctx.lineTo(360, 640); ctx.lineTo(0, 640); ctx.fill(); }
    Wd.windStreaks(ctx, t, 0.6);
    stxt(ctx, '21:42', 34, 180, { font: SANS(500, 52), color: '#fff' }); stxt(ctx, '11月4日 星期三 · 18°', 38, 206, { font: SANS(500, 12), color: 'rgba(255,255,255,0.9)' });
    A.APPS.forEach(([ic, n], i) => { const [x, y] = A.appPos(i); rr(ctx, x - 24, y - 24, 48, 48, 14); ctx.fillStyle = i === 7 ? '#C4553F' : 'rgba(16,20,24,0.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8; ctx.stroke(); V.icon(ctx, ic, x, y, 22, '#fff', 1.8); stxt(ctx, n, x, y + 38, { font: SANS(500, 9.5), color: '#fff', align: 'center' }); });
    rr(ctx, 20, 520, 320, 70, 26); ctx.fillStyle = 'rgba(16,20,24,0.35)'; ctx.fill();
    ['chat', 'camera', 'music', 'gear'].forEach((n, i) => { const x = 62 + i * 79; rr(ctx, x - 22, 533, 44, 44, 13); ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fill(); V.icon(ctx, n, x, 555, 20, P.uiSolid, 1.9); });
    statusBar(ctx, '21:42');
    const pp = A.pet(lt, t);
    ctx.save(); ctx.translate(pp.x, pp.y - 46); ctx.rotate(pp.swing); ctx.translate(-pp.x, -(pp.y - 46)); ch(ctx, 'mochi', pp.s, pp.x, pp.y, 1.05, t); ctx.restore();
    if (pp.mode === 'sit' && lt > 3.9) { ctx.save(); ctx.globalAlpha = clamp((lt - 3.9) / 0.25); slate(ctx, pp.x - 104, pp.y - 92, 104, 28, { r: 6, fill: 'rgba(14,18,22,0.75)' }); text(ctx, '一起休息一下吧', pp.x - 52, pp.y - 77.5, { font: SANS(500, 10), color: P.text, align: 'center', base: 'middle' }); ctx.restore(); }
    slate(ctx, 50, 30, 260, 26, { r: 13, fill: 'rgba(14,18,22,0.72)' }); diamond(ctx, 66, 43, 3, P.gold);
    text(ctx, 'Android 懸浮桌寵 · 視覺模擬（未實機驗證）', 186, 43.5, { font: SANS(500, 9.5), color: P.text, align: 'center', base: 'middle' });
    touch(ctx, pp.f);
  }

  // ---------------- 11. END ----------------
  function end(ctx, lt, t) {
    dp(ctx);
    blurred(ctx, (b) => field(b, t, { x: 220, y: 440, z: 1.0 }, 0.3, []), 4, 0.5);
    const a = E.outCubic(clamp(lt / 0.5));
    ctx.save(); ctx.globalAlpha = a;
    ch(ctx, 'mochi', A.idle(t, 1, { eyes: 'happy', mouth: 'smile', armR: -2.2 + Math.sin(t * 9) * 0.35 }), 132, 316, 1.6, t);
    ch(ctx, 'kuri', A.idle(t, 2, { face: -0.3 }), 192, 320, 1.45, t);
    ch(ctx, 'sora', A.idle(t, 3, { face: -0.4, eyes: 'sleepy' }), 246, 324, 1.35, t);
    text(ctx, '方案 D', 180, 382, { font: SANS(700, 12), color: P.gold, align: 'center', ls: 4 });
    stxt(ctx, '風語原野', 180, 422, { font: ZSERIF(30), color: P.text, align: 'center', ls: 6 });
    hairline(ctx, 70, 436, 290, 0.7); diamond(ctx, 180, 436.4, 3, P.gold);
    text(ctx, 'WINDSONG FIELDS', 180, 456, { font: SERIF(11), color: P.text, align: 'center', ls: 4 });
    text(ctx, '賽璐珞彩繪 · 風是主角 · 探索式極簡 HUD', 180, 486, { font: SANS(500, 11), color: P.sub, align: 'center' });
    ctx.restore();
  }

  function transition(ctx, A_, B, p) {
    const q = E.inOutSine(p);
    ctx.globalAlpha = 1; ctx.drawImage(A_, 0, 0);
    ctx.fillStyle = `rgba(10,14,18,${Math.sin(p * Math.PI) * 0.7})`; ctx.fillRect(0, 0, 1080, 1920);
    ctx.globalAlpha = q; ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1;
    const m = Math.sin(p * Math.PI); const w = 1080 * (0.2 + 0.8 * q);
    const g = ctx.createLinearGradient(540 - w / 2, 0, 540 + w / 2, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,240,200,${0.9 * m})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(540 - w / 2, 958, w, 3);
  }
  function chapter(ctx, s, a, idx) {
    if (s.id === 'pet' || s.id === 'end' || s.id === 'logo') return;
    ctx.scale(OC.DP, OC.DP); ctx.globalAlpha = a;
    const label = `${String(idx).padStart(2, '0')}　${s.zh}`;
    ctx.font = SANS(500, 8.5); const w = ctx.measureText(label).width;
    diamond(ctx, 180 - w / 2 - 8, 11.5, 2.2, P.gold);
    stxt(ctx, label, 180, 12, { font: SANS(500, 8.5), color: P.text, align: 'center', base: 'middle' });
  }

  OC.themes.wild = {
    id: 'wild', name: '風語原野 Windsong Fields', short: 'D',
    fonts: [
      { family: 'Noto Sans TC', url: 'assets/fonts/NotoSansTC-Medium.woff', descriptors: { weight: '500' } },
      { family: 'Noto Sans TC', url: 'assets/fonts/NotoSansTC-Bold.woff', descriptors: { weight: '700' } },
      { family: 'Noto Sans TC', url: 'assets/fonts/NotoSansTC-Black.woff', descriptors: { weight: '900' } },
      { family: 'Noto Serif TC', url: 'assets/fonts/NotoSerifTC-SemiBold.woff', descriptors: { weight: '600' } },
      { family: 'Cinzel', url: 'assets/fonts/Cinzel-SemiBold.woff', descriptors: { weight: '600' } },
    ],
    shots: { logo, island, creator, profile, dialogue, map, inventory, shop, studio, pet, end },
    transition, chapter,
  };
})();
