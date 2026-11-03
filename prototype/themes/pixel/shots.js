/* Scheme B — Pixel Grove : storyboard shots */
(function () {
  'use strict';
  const { clamp, lerp, E, wobble, spring, rng, finger, walkPath, typewriter, blink, breath, DATA, TAU } = OC;
  const { P, rect, oval, poly, line, bmp, blit, icon, item, panel, btn, txt, cursor, statusBar, R, quantize } = OC.X;
  const C = OC.X.CHAR, Wd = OC.X.WORLD;

  let WB1, WB2, UI;
  const wb = (z = 1) => { const b = z === 2 ? WB2 : WB1; const x = b.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, b.width, b.height); return x; };
  const ui = () => { const x = UI.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 540, 960); return x; };
  const present = (ctx, buf, s) => { ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, 0, buf.width * s, buf.height * s); };
  const step = (t, fps = 12) => Math.floor(t * fps) / fps; // stepped time for "on 12s" motion
  const idle = (t, seed, o = {}) => Object.assign({ breath: breath(step(t, 6), 0.4, seed * 0.2), blink: blink(t, seed), tail: Math.sin(step(t, 6) * 2 + seed) * 0.5 }, o);
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  function bgCheck(x, t, c1 = P.c1, c2 = P.c0) {
    rect(x, 0, 0, 540, 960, c1);
    const o = Math.floor(t * 8) % 32;
    for (let j = -1; j < 31; j++) for (let i = -1; i < 18; i++) if ((i + j) % 2 === 0) rect(x, i * 32 + o, j * 32 + o, 32, 32, c2);
  }
  function title(x, s, sub, y = 44) {
    panel(x, 120, y, 300, 52, 'berry');
    txt(x, s, 270, y + 13, { align: 'center', c: P.ink, sh: P.c2 });
    if (sub) txt(x, sub, 270, y + 58, { align: 'center', c: P.inkSoft, size: 16 });
  }
  function hud(x, t, o = {}) {
    const lt = o.lt ?? 9, night = o.night || 0;
    const on = (k) => lt > 0.35 + k * 0.1; // pixel UI pops in (no fades)
    if (on(0)) { panel(x, 14, 40, 168, 44, 'dark'); icon(x, night > 0.55 ? 'moon' : 'sun', 38, 62, 2); txt(x, '春3日', 56, 54, { c: P.c1 }); txt(x, o.clock || '10:20', 168, 55, { c: P.r4, font: 'Silkscreen', align: 'right' }); }
    if (on(1)) { panel(x, 392, 40, 134, 44, 'dark'); icon(x, 'coin', 416, 62, 2); txt(x, fmt(o.coins ?? DATA.coins), 512, 55, { c: P.r5, font: 'Silkscreen', align: 'right' }); }
    if (on(2)) {
      panel(x, 14, 852, 84, 84, 'wood');
      x.save(); x.beginPath(); x.rect(20, 858, 72, 70); x.clip(); C.draw(x, 'mochi', idle(t, 1, { noShadow: true }), 56, 966, 3, t); x.restore();
      for (let i = 0; i < 4; i++) icon(x, i < 3 ? 'heart' : 'heartE', 116 + i * 22, 920, 2);
      txt(x, '麻糬', 106, 864, { c: P.white, sh: P.k1 });
    }
    if (on(3)) {
      const b = (bx, by, s, ic, pr) => { btn(x, bx, by, s, s, '', { color: P.c1, hi: P.c0, lo: P.c2, pressed: pr }); icon(x, ic, bx + s / 2, by + s / 2 - 2 + (pr ? 2 : 0), 3, P.ink, P.e3, P.r4); };
      b(446, 852, 80, 'bag', o.bagPress); b(366, 870, 64, 'map', o.mapPress); b(462, 776, 56, 'menu');
    }
  }

  // ---------------- 1. LOGO ----------------
  function logo(ctx, lt, t) {
    const x = wb(1);
    // dawn sky in dithered bands
    const bands = [P.n1, P.n2, P.n3, P.p1, P.p2, P.r3, P.r4];
    const shift = Math.floor(clamp(lt / 3) * 2);
    for (let i = 0; i < bands.length; i++) { rect(x, 0, i * 40 + shift * 6, 270, 40, bands[i]); for (let xx = 0; xx < 270; xx += 2) rect(x, xx + (i % 2), i * 40 + 38 + shift * 6, 1, 2, bands[Math.min(i + 1, bands.length - 1)]); }
    rect(x, 0, 0, 270, shift * 6, P.n1);
    const r = rng(3); for (let i = 0; i < 40; i++) { const sx = R(r() * 270), sy = R(r() * 160); if ((Math.floor(t * 4) + i) % 5) rect(x, sx, sy, 1, 1, P.white); }
    // sun peeking
    oval(x, 200, 262 - R(clamp(lt / 3) * 16), 22, 22, P.r5); oval(x, 200, 262 - R(clamp(lt / 3) * 16), 18, 18, P.white);
    // parallax hills & forest
    const par = (base, c, amp, spd, seed) => { const off = R(step(t, 8) * spd) % 270; for (let xx = 0; xx < 270; xx++) { const h = R(base - Math.abs(Math.sin((xx + off) * 0.05 + seed)) * amp - Math.abs(Math.sin((xx + off) * 0.017 + seed)) * amp); rect(x, xx, h, 1, 480 - h, c); } };
    par(300, P.p1, 18, 2, 1); par(330, P.g1, 14, 5, 2); par(360, P.g2, 10, 8, 3);
    rect(x, 0, 380, 270, 100, P.g3); rect(x, 0, 380, 270, 2, P.g4);
    for (let i = 0; i < 20; i++) { rect(x, (i * 37) % 270, 392 + (i * 13) % 80, 1, 1, P.g5); }
    // Mochi walks in and sits
    const w = walkPath([{ t: 0.6, x: -20, y: 412 }, { t: 1.8, x: 134, y: 412, ease: E.outQuad }], lt, 7);
    const sitting = lt > 1.9;
    C.draw(x, 'mochi', idle(t, 1, { face: sitting ? 0 : 1, walk: w.moving ? 1 : 0, phase: w.phase, eyes: sitting ? 'happy' : 'round', mouth: sitting ? 'smile' : 'cat', armR: lt > 2.1 ? -2 : undefined, squash: sitting && lt < 2.0 ? 0.9 : 1 }), R(w.x), 412, 1, t);
    present(ctx, WB1, 4);
    const u = ui();
    // title: Silkscreen with 4-way outline, letters drop in stepped
    const word = 'OC SHIMEJI';
    u.font = '48px Silkscreen';
    const tw = u.measureText(word).width;
    let cx = 270 - tw / 2;
    [...word].forEach((ch, i) => {
      const q = clamp((lt - 0.2 - i * 0.06) / 0.3);
      if (q <= 0) { cx += u.measureText(ch).width; return; }
      const y = 250 - R((1 - q) * 6) * 8;
      for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [3, 3], [0, 6], [3, 6], [-3, 3]]) txt(u, ch, cx + dx, y + dy, { font: 'Silkscreen', size: 48, c: P.k1 });
      txt(u, ch, cx, y, { font: 'Silkscreen', size: 48, c: i < 2 ? P.r3 : P.c0 });
      txt(u, ch, cx, y, { font: 'Silkscreen', size: 48, c: 'rgba(0,0,0,0)' });
      cx += u.measureText(ch).width;
    });
    if (lt > 0.9) { panel(u, 130, 320, 280, 44, 'dark'); txt(u, '我的 OC，住進你的手機', 270, 334, { align: 'center', c: P.c0 }); }
    if (lt > 1.6 && Math.floor(t * 2.5) % 2 === 0) txt(u, '- TAP TO START -', 270, 640, { align: 'center', font: 'Silkscreen', c: P.white, sh: P.k1 });
    present(ctx, UI, 2);
  }

  // ---------------- 2. ISLAND ----------------
  const MW = [{ t: 0.9, x: 118, y: 252 }, { t: 2.6, x: 166, y: 280 }];
  function mochiIsland(lt, t) {
    const w = walkPath(MW, lt, 7);
    const turn = lt - 2.65;
    const face = lt < 2.65 ? (lt > 0.7 ? 1 : 0) : turn < 0.12 ? 0.5 : 0;
    const look = lt > 4.0;
    return { x: R(w.x), y: R(w.y), s: idle(t, 1, { face, walk: w.moving ? 1 : 0, phase: w.phase, armR: lt > 2.9 && lt < 3.8 ? -2 : undefined, eyes: lt > 2.9 && lt < 3.8 ? 'happy' : look ? 'sparkle' : 'round', mouth: lt > 2.9 && lt < 3.8 ? 'smile' : look ? 'o' : 'cat', earL: wobble(turn, 3, 4) * 0.5, earR: wobble(turn - 0.08, 3, 4) * 0.5 }) };
  }
  function island(ctx, lt, t) {
    const night = clamp(Math.floor(clamp((lt - 3.7) / 2.1) * 8) / 8); // light changes in 8 steps
    const x = wb(1);
    const m = mochiIsland(lt, t);
    const camY = R(lerp(0, 74, E.inOutCubic(clamp((lt + 0.3) / 2.6))));
    Wd.drawIsland(x, { t, cam: { x: 15, y: camY }, night, chars: [
      { d: 'mochi', s: m.s, x: m.x, y: m.y, emote: lt > 4.5 ? { kind: '♪', p: clamp((lt - 4.5) / 1.4) } : null },
      { d: 'kuri', s: idle(t, 2, { face: 0.5 }), x: 112, y: 318 },
      { d: 'sora', s: idle(t, 3, { eyes: 'sleepy', mouth: 'flat' }), x: 252, y: 452, emote: { kind: 'zzz', p: (t * 0.3) % 1 } },
    ] });
    present(ctx, WB1, 4);
    const u = ui();
    const mins = lerp(620, 1265, night);
    const clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
    hud(u, t, { lt, night, clock });
    statusBar(u, clock);
    present(ctx, UI, 2);
  }

  // ---------------- 3. CREATOR ----------------
  const ROWS = [['眼睛', ['圓圓眼', '星星眼']], ['眉毛', ['柔和眉']], ['嘴巴', ['貓咪嘴']], ['耳朵', ['貓耳', '兔耳']], ['毛色', null]];
  const SWATCH = [P.c0, P.pk2, P.p3, P.w4, P.g6, P.e4];
  function creator(ctx, lt, t) {
    const u = ui();
    bgCheck(u, t, P.c1, P.c0);
    title(u, '角色創造', '2 / 4 · 外觀');
    const f = finger([
      { t: 0.5, x: 300, y: 700 }, { t: 0.8, x: 486, y: 582 }, { t: 0.88, x: 486, y: 582, down: true }, { t: 1.02, x: 486, y: 582 },
      { t: 1.9, x: 486, y: 762 }, { t: 1.98, x: 486, y: 762, down: true }, { t: 2.12, x: 486, y: 762 },
      { t: 2.7, x: 340, y: 850 }, { t: 2.8, x: 340, y: 850, down: true }, { t: 2.95, x: 340, y: 850 },
      { t: 3.35, x: 200, y: 330 }, { t: 3.45, x: 200, y: 330, down: true }, { t: 4.15, x: 360, y: 330, down: true }, { t: 4.25, x: 360, y: 330 }], lt);
    const eye = lt > 0.88 ? 1 : 0, ear = lt > 1.98 ? 1 : 0, col = lt > 2.8 ? 2 : 0;
    const drag = clamp((lt - 3.45) / 0.7);
    const face = lt < 4.15 ? Math.floor(drag * 3) / 2 : lt < 4.3 ? 0.5 : 0;
    // mirror panel
    panel(u, 110, 140, 320, 360, 'wood');
    for (let j = 0; j < 10; j++) for (let i = 0; i < 9; i++) rect(u, 120 + i * 33, 150 + j * 34, 33, 34, (i + j) % 2 ? P.c0 : P.c1);
    rect(u, 160, 452, 220, 12, P.c2);
    const D = Object.assign({}, C.DESIGNS.mochi, { fur: SWATCH[col], shade: col ? P.p2 : P.c2 });
    const react = (lt > 0.88 && lt < 1.3) || (lt > 1.98 && lt < 2.4);
    C.draw(u, D, idle(t, 1, { face, eyes: react ? 'happy' : ['round', 'sparkle'][eye], mouth: react ? 'smile' : 'cat', ears: ['cat', 'bunny'][ear], squash: react && Math.floor(t * 10) % 2 ? 0.9 : 1, noShadow: true }), 270, 470, 8, t);
    if (lt > 3.45 && lt < 4.3) { txt(u, '◀  拖曳旋轉  ▶', 270, 508, { align: 'center', c: P.inkSoft }); }
    // selector rows
    ROWS.forEach(([name, vals], i) => {
      const y = 540 + i * 84;
      const active = (i === 0 && lt < 1.6) || (i === 3 && lt >= 1.6 && lt < 2.5) || (i === 4 && lt >= 2.5);
      panel(u, 20, y, 500, 74, active ? 'leaf' : 'paper');
      if (active && Math.floor(t * 4) % 2 === 0) bmp(u, ['1...', '11..', '111.', '11..', '1...'], 6, y + 28, { 1: P.r2 }, 2);
      txt(u, name, 44, y + 27, { c: P.ink });
      if (vals) {
        const v = vals[i === 0 ? eye : i === 3 ? ear : 0];
        const prL = false, prR = f && f.down && Math.abs(f.y - (y + 42)) < 30 && f.x > 440;
        btn(u, 290, y + 18, 40, 40, '', { color: P.c0, hi: P.white, lo: P.c2 }); icon(u, 'back', 310, y + 36, 2, P.ink);
        txt(u, v, 390, y + 27, { align: 'center', c: P.ink });
        btn(u, 460, y + 18, 40, 40, '', { color: P.c0, hi: P.white, lo: P.c2, pressed: prR }); icon(u, 'right', 480, y + 36 + (prR ? 2 : 0), 2, P.ink);
      } else {
        SWATCH.forEach((c, k) => { const sx = 200 + k * 50; rect(u, sx - 2, y + 18, 40, 40, P.k1); rect(u, sx, y + 20, 36, 36, c); rect(u, sx, y + 20, 36, 4, 'rgba(255,255,255,0.4)'); if (k === col) { rect(u, sx - 6, y + 14, 48, 3, P.r1); rect(u, sx - 6, y + 59, 48, 3, P.r1); rect(u, sx - 6, y + 14, 3, 48, P.r1); rect(u, sx + 39, y + 14, 3, 48, P.r1); } });
      }
    });
    statusBar(u, '10:24', P.ink);
    cursor(u, f);
    present(ctx, UI, 2);
  }

  // ---------------- 4. PROFILE ----------------
  function seg(x, x0, y0, n, v, c, lo) { for (let i = 0; i < n; i++) { rect(x, x0 + i * 22, y0, 18, 16, P.k1); rect(x, x0 + i * 22 + 2, y0 + 2, 14, 12, i < Math.round(v * n) ? c : lo); if (i < Math.round(v * n)) rect(x, x0 + i * 22 + 2, y0 + 2, 14, 3, 'rgba(255,255,255,0.35)'); } }
  function profile(ctx, lt, t) {
    const u = ui();
    bgCheck(u, t * 0.5, P.c2, P.c1);
    const tab = lt < 2.35 ? 0 : 1;
    // tabs
    ['狀態', '關係', '目標'].forEach((n, i) => { const x0 = 40 + i * 156; panel(u, x0, 44 + (i === tab ? 0 : 8), 148, 56, i === tab ? 'berry' : 'paper'); txt(u, n, x0 + 74, 62 + (i === tab ? 0 : 8), { align: 'center', c: P.ink }); });
    panel(u, 20, 100, 500, 800, 'wood');
    // header block
    rect(u, 40, 122, 132, 132, P.k1); rect(u, 42, 124, 128, 128, P.w4);
    for (let i = 0; i < 4; i++) rect(u, 42, 124 + i * 32, 128, 16, P.w5);
    u.save(); u.beginPath(); u.rect(42, 124, 128, 128); u.clip();
    C.draw(u, 'mochi', idle(t, 1, { noShadow: true, eyes: lt > 3.4 ? 'happy' : 'round' }), 106, 302, 5, t); u.restore();
    txt(u, '麻糬', 196, 128, { c: P.ink, size: 32 });
    txt(u, 'MOCHI · 你的 OC', 198, 170, { c: P.inkSoft, font: 'Silkscreen' });
    txt(u, '生日 春3日 · 島民 12 天', 198, 196, { c: P.inkSoft });
    DATA.traits.slice(0, 3).forEach((tr, i) => { const w = 16 * tr.length + 16; const x0 = 196 + [0, 104, 0][i] + (i === 2 ? 0 : 0), y0 = 222 + (i === 2 ? 30 : 0); const xx = i === 2 ? 196 : x0; rect(u, xx, y0, w, 24, [P.r2, P.p1, P.g2][i]); rect(u, xx + 2, y0 + 2, w - 4, 2, 'rgba(255,255,255,0.3)'); txt(u, tr, xx + 8, y0 + 4, { c: P.white }); });
    rect(u, 40, 290, 460, 2, P.c2);
    if (tab === 0) {
      const ics = ['heart', 'sun', 'face', 'chat', 'star'], cols = [P.r2, P.r4, P.pk, P.w3, P.g4];
      DATA.needs.forEach((n, i) => {
        const y = 314 + i * 66; const q = clamp((lt - 0.3 - i * 0.12) / 0.6);
        icon(u, ics[i], 62, y + 14, 3);
        txt(u, n.zh, 90, y + 6, { c: P.ink });
        seg(u, 160, y + 6, 12, n.v * (Math.floor(q * 6) / 6), cols[i], P.c2);
        txt(u, String(Math.round(n.v * 100 * q)), 486, y + 6, { c: P.inkSoft, font: 'Silkscreen', align: 'right' });
      });
      panel(u, 40, 650, 460, 110, 'paper');
      icon(u, 'chat', 66, 686, 2, P.e2, P.c0, P.e2);
      txt(u, typewriter('「風好舒服…等等去池塘看看栗子吧。」', clamp((lt - 0.7) / 1.2)), 88, 678, { c: P.ink });
      txt(u, '自主行動：發呆中', 88, 712, { c: P.inkSoft });
      if (Math.floor(t * 2) % 2) bmp(u, ['11111', '.111.', '..1..'], 470, 734, { 1: P.e2 }, 2);
    } else {
      DATA.relations.forEach((r, i) => {
        const y = 314 + i * 112;
        panel(u, 40, y, 460, 100, i === 0 && lt > 3.3 ? 'leaf' : 'paper');
        rect(u, 58, y + 18, 64, 64, P.c2); u.save(); u.beginPath(); u.rect(58, y + 18, 64, 64); u.clip(); C.draw(u, r.who, idle(t, 4 + i, { noShadow: true }), 90, y + 130, 3, t); u.restore();
        txt(u, DATA.cast[r.who].zh, 140, y + 24, { c: P.ink, size: 32 });
        txt(u, r.zh, 140, y + 62, { c: P.inkSoft });
        for (let h = 0; h < 5; h++) icon(u, h < r.hearts ? 'heart' : 'heartE', 330 + h * 32, y + 50, 3);
      });
      panel(u, 40, 548, 460, 100, 'paper');
      item(u, 'flower', 90, 598, 3);
      txt(u, '讓小島開滿 10 種花', 140, 566, { c: P.ink });
      seg(u, 140, 600, 10, 0.6, P.g4, P.c2);
      txt(u, '6/10', 482, 600, { c: P.inkSoft, font: 'Silkscreen', align: 'right' });
    }
    statusBar(u, '10:26', P.ink);
    cursor(u, finger([{ t: 1.9, x: 300, y: 160 }, { t: 2.2, x: 270, y: 78 }, { t: 2.3, x: 270, y: 78, down: true }, { t: 2.45, x: 270, y: 78 }, { t: 3.1, x: 300, y: 380 }, { t: 3.3, x: 300, y: 380, down: true }, { t: 3.45, x: 300, y: 380 }], lt));
    present(ctx, UI, 2);
  }

  // ---------------- 5. DIALOGUE ----------------
  function dialogBox(u, name, who, str, t, showArrow, expr) {
    panel(u, 16, 712, 508, 196, 'wood');
    rect(u, 34, 734, 116, 116, P.k1); rect(u, 36, 736, 112, 112, P.w4); rect(u, 36, 800, 112, 48, P.g4);
    u.save(); u.beginPath(); u.rect(36, 736, 112, 112); u.clip(); C.draw(u, who, idle(t, 2, Object.assign({ noShadow: true }, expr)), 92, 900, 4, t); u.restore();
    panel(u, 30, 680, 120, 44, 'berry'); txt(u, name, 90, 693, { align: 'center', c: P.ink });
    const lines = [str.slice(0, 13), str.slice(13)];
    lines.forEach((l, i) => txt(u, l, 168, 748 + i * 30, { c: P.ink, size: 16 }));
    if (showArrow && Math.floor(t * 3) % 2) icon(u, 'down', 494, 876, 2, P.r1);
  }
  function dialogue(ctx, lt, t) {
    const x = wb(2);
    const kw = walkPath([{ t: -0.3, x: 150, y: 330 }, { t: 1.0, x: 118, y: 328 }], lt, 7);
    const j = lt - 3.15;
    const hop = j > 0 && j < 0.5 ? [3, 7, 9, 7, 3, 0][Math.floor((j / 0.5) * 6)] : 0;
    const ks = idle(t, 2, { face: -1, walk: kw.moving ? 1 : 0, phase: kw.phase, lift: hop, squash: j > -0.2 && j < 0 ? 0.88 : j > 0.5 && j < 0.6 ? 0.88 : 1,
      eyes: lt > 3.15 ? 'happy' : lt > 2.95 ? 'wide' : 'round', mouth: lt > 3.15 ? 'open' : lt > 1.0 && lt < 2.2 && Math.floor(t * 10) % 2 ? 'o' : 'cat', ear: lt > 2.95 && lt < 3.15 ? -0.6 : 0, earL: hop ? 0.6 : 0, earR: hop ? 0.6 : 0, armL: hop ? -2 : undefined, armR: hop ? -2 : undefined, blush: lt > 3.3 ? 1 : 0 });
    const ms = idle(t, 1, { face: 1, eyes: lt > 3.5 ? 'happy' : 'round', mouth: lt > 3.5 ? 'smile' : 'cat', blush: lt > 3.6 ? 1 : 0 });
    Wd.drawIsland(x, { t, cam: { x: 32, y: 222 }, chars: [
      { d: 'mochi', s: ms, x: 88, y: 330 },
      { d: 'kuri', s: ks, x: R(kw.x), y: R(kw.y), emote: lt > 2.95 && lt < 3.4 ? { kind: '!', p: clamp((lt - 2.95) / 0.45) } : lt > 3.4 ? { kind: '♥', p: clamp((lt - 3.4) / 1.5) } : null },
    ] });
    present(ctx, WB2, 8);
    const u = ui();
    if (lt > 0.95 && lt < 2.85) dialogBox(u, '栗子', 'kuri', typewriter(DATA.dialogue.a, clamp((lt - 1.05) / 1.0)), t, lt > 2.1, { face: 0 });
    if (lt > 2.1 && lt < 3.0) {
      panel(u, 250, 548, 274, 156, 'paper');
      DATA.dialogue.choices.forEach((c, i) => { const sel = i === 0; txt(u, c, 290, 578 + i * 50, { c: P.ink }); if (sel && (lt > 2.7 ? Math.floor(t * 8) % 2 : 1)) icon(u, 'right', 272, 586 + i * 50, 2, P.r1); });
    }
    if (lt >= 2.85 && lt < 3.75) dialogBox(u, '麻糬', 'mochi', '一起去森林散步？', t, false, { eyes: 'happy', mouth: 'smile' });
    if (lt >= 3.75) dialogBox(u, '栗子', 'kuri', typewriter(DATA.dialogue.b, clamp((lt - 3.85) / 0.6)), t, lt > 4.5, { eyes: 'happy', mouth: 'open', blush: 1 });
    statusBar(u, '10:32');
    cursor(u, finger([{ t: 2.35, x: 300, y: 700 }, { t: 2.6, x: 360, y: 590 }, { t: 2.68, x: 360, y: 590, down: true }, { t: 2.82, x: 360, y: 590 }], lt));
    present(ctx, UI, 2);
  }

  // ---------------- 6. MAP ----------------
  const MAPPTS = { village: [128, 250], forest: [62, 130], beach: [196, 350], hill: [200, 120], market: [58, 360] };
  function mapScene(x, t, sel) {
    rect(x, 0, 0, 270, 480, P.w2);
    const st = Math.floor(t * 4); const r = rng(8);
    for (let i = 0; i < 60; i++) { const wx = R(r() * 270), wy = R(r() * 480); if ((st + i) % 4) rect(x, wx + ((st + i) % 2), wy, 3, 1, P.w3); }
    const isl = (cx, cy, rx, ry, c) => { oval(x, cx, cy + 3, rx + 2, ry + 2, P.e5); rect(x, cx - rx + 4, cy + ry - 1, rx * 2 - 8, 5, P.s1); oval(x, cx, cy, rx, ry, c); };
    isl(128, 250, 52, 36, P.g4); isl(62, 130, 40, 30, P.g2); isl(196, 350, 36, 22, P.e5); isl(200, 120, 38, 28, P.g5); isl(58, 360, 32, 22, P.g4);
    for (const [a, b] of [[48, 124], [66, 116], [76, 136], [54, 142]]) { poly(x, [[a - 6, b + 4], [a, b - 9], [a + 6, b + 4]], P.g0); }
    Wd.house(x, 120, 252, t, P.r2, P.r1, 0, 1); Wd.house(x, 152, 264, t, P.p2, P.p1, 0, 2);
    rect(x, 198, 102, 3, 16, P.c0); const wf = Math.floor(t * 6) % 2; if (wf) { rect(x, 192, 102, 15, 2, P.r2); rect(x, 198, 96, 2, 15, P.r2); } else { line(x, 193, 97, 206, 110, P.r2); line(x, 206, 97, 193, 110, P.r2); }
    for (let i = 0; i < 3; i++) rect(x, 186 + i * 10, 350, 3, 2, P.pk);
    rect(x, 48, 350, 20, 4, P.r2); rect(x, 50, 354, 16, 6, P.c1);
    // dotted routes
    for (const k of ['forest', 'beach', 'hill', 'market']) { const [ax, ay] = MAPPTS.village, [bx, by] = MAPPTS[k]; for (let i = 2; i < 14; i++) { if (i % 2) continue; const q = i / 16; rect(x, R(lerp(ax, bx, q)), R(lerp(ay, by, q)), 2, 2, P.c0); } }
    // flags
    Object.entries(MAPPTS).forEach(([k, [fx, fy]]) => { const up = k === sel && Math.floor(t * 6) % 2 ? 2 : 0; rect(x, fx, fy - 18 - up, 1, 14, P.k1); rect(x, fx + 1, fy - 18 - up, 8, 5, k === sel ? P.r2 : P.r4); });
  }
  function diamondWipe(ctx, p, cell = 48) {
    ctx.beginPath();
    for (let j = 0; j <= 1920 / cell; j++) for (let i = 0; i <= 1080 / cell; i++) {
      const d = (i * cell + j * cell * 0.6) / (1080 + 1920 * 0.6);
      const s = clamp((p * 1.6 - d * 0.6)) * cell * 1.02;
      if (s <= 0) continue;
      const cx = i * cell, cy = j * cell;
      ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy); ctx.closePath();
    }
  }
  function map(ctx, lt, t) {
    const open = lt > 0.5;
    if (!open) {
      const x = wb(1); Wd.drawIsland(x, { t, cam: { x: 15, y: 74 }, chars: [{ d: 'mochi', s: idle(t, 1), x: 166, y: 280 }, { d: 'kuri', s: idle(t, 2, { face: -0.5 }), x: 190, y: 290 }] });
      present(ctx, WB1, 4);
      const u = ui(); hud(u, t, { mapPress: lt > 0.3 }); statusBar(u, '10:41'); cursor(u, finger([{ t: 0.05, x: 330, y: 820 }, { t: 0.25, x: 398, y: 902 }, { t: 0.3, x: 398, y: 902, down: true }, { t: 0.45, x: 398, y: 902 }], lt)); present(ctx, UI, 2);
      return;
    }
    const sel = lt > 1.4 ? 'forest' : null;
    const x = wb(1); mapScene(x, t, sel); present(ctx, WB1, 4);
    const u = ui();
    panel(u, 14, 36, 512, 64, 'wood'); txt(u, '世界地圖', 270, 56, { align: 'center', c: P.ink });
    btn(u, 470, 46, 44, 44, '', { color: P.r2, hi: P.r3, lo: P.r1 }); icon(u, 'close', 492, 66, 2, P.white);
    Object.entries(MAPPTS).forEach(([k, [fx, fy]]) => { const name = DATA.places.find((d) => d.id === k).zh; const w = name.length * 16 + 16; rect(u, fx * 2 - w / 2, fy * 2 + 8, w, 22, k === sel ? P.r1 : P.k1); txt(u, name, fx * 2, fy * 2 + 11, { align: 'center', c: P.white }); });
    // mochi marker (stepped bounce)
    C.draw(u, 'mochi', idle(t, 1, { noShadow: true }), 236, 470 - (Math.floor(t * 4) % 2) * 4, 2, t);
    if (lt > 1.55) {
      const sy = R(lerp(960, 690, E.outCubic(clamp((lt - 1.55) / 0.25))) / 4) * 4; // snaps in 4px steps
      panel(u, 16, sy, 508, 230, 'wood');
      txt(u, '苔光森林', 44, sy + 26, { c: P.ink, size: 32 });
      txt(u, 'MOSSLIGHT WOODS', 46, sy + 66, { c: P.inkSoft, font: 'Silkscreen' });
      icon(u, 'rain', 330, sy + 42, 3); txt(u, '小雨', 352, sy + 34, { c: P.ink });
      icon(u, 'clock', 422, sy + 42, 2, P.e1, P.c0); txt(u, '3分', 440, sy + 34, { c: P.ink });
      txt(u, '雨後的苔蘚會發光。稀有蘑菇出沒！', 44, sy + 100, { c: P.inkSoft });
      btn(u, 320, sy + 142, 176, 56, '出發 ▶', { pressed: lt > 2.4 && lt < 2.55, color: P.g3, hi: P.g4, lo: P.g1 });
    }
    statusBar(u, '10:41');
    cursor(u, finger([{ t: 0.9, x: 300, y: 400 }, { t: 1.3, x: 124, y: 226 }, { t: 1.38, x: 124, y: 226, down: true }, { t: 1.5, x: 124, y: 226 }, { t: 2.2, x: 408, y: 860 }, { t: 2.4, x: 408, y: 860, down: true }, { t: 2.55, x: 408, y: 860 }], lt));
    present(ctx, UI, 2);
    // diamond wipe into forest
    const wp = clamp((lt - 2.65) / 0.55);
    if (wp > 0) {
      const fx = wb(1);
      const w = walkPath([{ t: 2.9, x: 140, y: 500 }, { t: 4.5, x: 132, y: 400 }], lt, 7);
      Wd.drawForest(fx, { t, chars: [{ d: 'mochi', s: idle(t, 1, { back: 1, walk: w.moving ? 1 : 0, phase: w.phase, hold: 'leaf' }), x: R(w.x), y: R(w.y) }] });
      ctx.save(); diamondWipe(ctx, wp); ctx.clip(); present(ctx, WB1, 4);
      if (lt > 3.4) {
        const u2 = ui();
        const reveal = Math.floor(clamp((lt - 3.4) / 0.6) * 4);
        const name = '苔光森林';
        panel(u2, 110, 150, 320, 96, 'dark');
        txt(u2, name.slice(0, reveal), 270, 168, { align: 'center', c: P.c0, size: 32 });
        if (reveal >= 4) txt(u2, '· 小雨 ·', 270, 210, { align: 'center', c: P.w4 });
        statusBar(u2, '10:41');
        present(ctx, UI, 2);
      }
      ctx.restore();
    }
  }

  // ---------------- 7. INVENTORY ----------------
  function inventory(ctx, lt, t) {
    const f = finger([
      { t: 0.0, x: 420, y: 800 }, { t: 0.2, x: 486, y: 892 }, { t: 0.25, x: 486, y: 892, down: true }, { t: 0.4, x: 486, y: 892 },
      { t: 0.8, x: 74, y: 700 }, { t: 0.9, x: 74, y: 700, down: true }, { t: 1.4, x: 74, y: 700, down: true },
      { t: 2.2, x: 250, y: 330, down: true }, { t: 2.28, x: 250, y: 330 }], lt);
    const eat = lt - 2.3, chew = eat > 0 && eat < 0.9, happy = eat > 0.9;
    const drag = f && lt > 1.4 && lt < 2.3;
    const near = drag && f.y < 520;
    const x = wb(2);
    const ms = idle(t, 1, { eyes: happy ? 'happy' : near ? 'sparkle' : 'round', mouth: chew ? 'chew' : happy ? 'smile' : near ? 'open' : 'cat', lift: happy && Math.floor((eat - 0.9) * 6) % 2 === 0 && eat < 1.8 ? 3 : 0, blush: happy ? 1 : 0, ear: near ? -0.4 : 0, face: drag ? (f.x < 230 ? -0.5 : 0.5) : 0 });
    Wd.drawIsland(x, { t, cam: { x: 108, y: 146 }, chars: [{ d: 'mochi', s: ms, x: 172, y: 258, emote: happy ? { kind: '♥', p: clamp((eat - 0.9) / 1.4) } : null }] });
    present(ctx, WB2, 8);
    const u = ui();
    const open = lt > 0.4;
    const lowered = lt > 1.4 && lt < 2.4;
    if (!open) hud(u, t, { bagPress: lt > 0.22 });
    else {
      const y0 = lowered ? 800 : 600;
      panel(u, 14, y0, 512, 340, 'wood');
      panel(u, 30, y0 - 26, 120, 44, 'berry'); txt(u, '背包', 90, y0 - 13, { align: 'center', c: P.ink });
      ['全部', '食物', '素材', '家具'].forEach((n, i) => { rect(u, 250 + i * 68, y0 + 16, 60, 26, i === 0 ? P.r2 : P.c2); txt(u, n, 280 + i * 68, y0 + 21, { align: 'center', c: i === 0 ? P.white : P.ink }); });
      DATA.items.forEach((it, i) => {
        const sx = 34 + (i % 5) * 96, sy = y0 + 56 + Math.floor(i / 5) * 96;
        rect(u, sx, sy, 84, 84, P.e2); rect(u, sx + 2, sy + 2, 80, 80, P.c2); rect(u, sx + 4, sy + 4, 76, 76, P.c1);
        if (it.id === 'cake' && lt > 0.9 && lt < 2.3) { rect(u, sx, sy, 84, 4, P.r2); rect(u, sx, sy + 80, 84, 4, P.r2); rect(u, sx, sy, 4, 84, P.r2); rect(u, sx + 80, sy, 4, 84, P.r2); }
        else item(u, it.id, sx + 42, sy + 40, 3);
        txt(u, 'x' + (it.id === 'cake' && lt > 2.3 ? it.n - 1 : it.n), sx + 78, sy + 62, { align: 'right', c: P.ink, font: 'Silkscreen' });
      });
    }
    if (f && lt > 0.9 && lt < 1.4) { const q = Math.floor(((lt - 0.9) / 0.5) * 8); for (let i = 0; i < q; i++) { const a = -Math.PI / 2 + (i / 8) * TAU; rect(u, f.x + Math.cos(a) * 40 - 3, f.y + Math.sin(a) * 40 - 3, 6, 6, P.r4); } }
    if (f && lt > 0.9 && lt < 2.3) item(u, 'cake', R(f.x / 2) * 2, R((f.y - 34) / 2) * 2, 4);
    if (eat > 0.9) {
      const q = clamp((eat - 0.9) / 1.1);
      panel(u, 150, 150, 240, 56, 'dark'); icon(u, 'heart', 176, 178, 2);
      seg(u, 196, 170, 8, lerp(0.42, 0.6, Math.floor(q * 4) / 4), P.r2, P.k0);
      txt(u, '+18', 270, 230 - R(q * 6) * 4, { align: 'center', c: P.r4, font: 'Silkscreen', size: 32, sh: P.k1 });
    }
    statusBar(u, '10:45');
    cursor(u, f);
    present(ctx, UI, 2);
  }

  // ---------------- 8. SHOP ----------------
  function shopRoom(x, t, happy) {
    rect(x, 0, 0, 270, 480, P.e1);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 10; i++) { rect(x, i * 28 + (j % 2) * 14, 150 + j * 10, 27, 9, (i + j) % 3 ? P.e3 : P.e2); }
    rect(x, 0, 0, 270, 150, P.c2); for (let i = 0; i < 270; i += 18) rect(x, i, 0, 9, 150, P.c1);
    rect(x, 0, 140, 270, 10, P.e2);
    // shelves with items
    for (let s = 0; s < 2; s++) { rect(x, 20, 40 + s * 46, 230, 6, P.e2); rect(x, 20, 46 + s * 46, 230, 2, P.e1); }
    ['lamp', 'plant', 'cushion', 'rug', 'apple', 'star', 'milk', 'flower'].forEach((id, i) => blit(x, OC.X.itemSprite(id), 30 + (i % 4) * 56, 22 + Math.floor(i / 4) * 46, 1));
    // window with light
    rect(x, 196, 96, 52, 40, P.e1); rect(x, 198, 98, 48, 36, P.w4); rect(x, 221, 98, 2, 36, P.e1);
    // shopkeeper + counter
    C.draw(x, 'sora', idle(t, 3, { eyes: happy ? 'happy' : 'round', mouth: happy ? 'smile' : 'cat', armR: happy ? -2 : undefined }), 82, 196, 2, t);
    rect(x, 10, 176, 250, 30, P.e2); rect(x, 10, 176, 250, 4, P.e4); rect(x, 10, 204, 250, 3, P.e0);
    blit(x, OC.X.itemSprite('lamp'), 190, 156, 1);
  }
  function shop(ctx, lt, t) {
    const sold = lt > 1.4;
    const x = wb(1); shopRoom(x, t, sold); present(ctx, WB1, 4);
    const u = ui();
    panel(u, 14, 36, 300, 60, 'berry'); txt(u, '雲朵市集', 164, 55, { align: 'center', c: P.ink });
    const coins = sold ? lerp(DATA.coins, DATA.coins - 120, Math.floor(clamp((lt - 1.45) / 0.8) * 12) / 12) : DATA.coins;
    panel(u, 330, 36, 196, 60, 'dark'); icon(u, 'coin', 360, 66, 3); txt(u, fmt(coins), 510, 58, { align: 'right', c: P.r5, font: 'Silkscreen' });
    panel(u, 14, 432, 512, 460, 'wood');
    const sel = lt > 0.5 ? 0 : -1;
    DATA.shop.forEach((s, i) => {
      const y = 458 + i * 84;
      if (i === sel) { rect(u, 30, y, 480, 76, P.r5); rect(u, 30, y, 480, 2, P.r4); }
      rect(u, 40, y + 8, 60, 60, P.c2); item(u, s.id, 70, y + 38, 3);
      txt(u, s.zh, 120, y + 14, { c: P.ink });
      txt(u, i === 0 ? '夜裡會發出柔柔的光' : ['', '軟綿綿的雲朵', '一點點綠意', '踩起來很舒服'][i], 120, y + 42, { c: P.inkSoft });
      icon(u, 'coin', 430, y + 38, 2); txt(u, String(s.price), 494, y + 30, { align: 'right', c: P.ink, font: 'Silkscreen' });
      if (i === sel && Math.floor(t * 4) % 2) icon(u, 'right', 22, y + 38, 2, P.r1);
    });
    btn(u, 300, 806, 200, 60, sold ? '已購買 ✓' : '購買', { pressed: lt > 1.25 && lt < 1.42, color: sold ? P.g3 : P.r2, hi: sold ? P.g4 : P.r3, lo: sold ? P.g1 : P.r1 });
    if (lt > 1.45 && lt < 2.4) { const q = clamp((lt - 1.45) / 0.6); for (let i = 0; i < 5; i++) { const qq = clamp(q * 1.4 - i * 0.1); if (qq <= 0 || qq >= 1) continue; icon(u, 'coin', R(lerp(400, 360, qq) + Math.sin(qq * 3) * (i - 2) * 14), R(lerp(830, 66, Math.floor(qq * 8) / 8)), 2); } }
    if (lt > 1.9) { panel(u, 120, 360, 300, 56, 'leaf'); txt(u, '已放入背包！', 270, 378, { align: 'center', c: P.ink }); }
    statusBar(u, '10:52');
    cursor(u, finger([{ t: 0.2, x: 300, y: 600 }, { t: 0.42, x: 260, y: 496 }, { t: 0.5, x: 260, y: 496, down: true }, { t: 0.64, x: 260, y: 496 }, { t: 1.1, x: 400, y: 836 }, { t: 1.25, x: 400, y: 836, down: true }, { t: 1.42, x: 400, y: 836 }], lt));
    present(ctx, UI, 2);
  }

  // ---------------- 9. STUDIO (pixel editor) ----------------
  const ART = [
    '..........................',
    '....11.............11.....',
    '...1221...........1221....',
    '...12231.........13221....',
    '..1222221111111112222221..',
    '..1222222222222222222221..',
    '.122222222222222222222221.',
    '.122222222222222222222221.',
    '12222244222222222244222221',
    '12222254222222222254222221',
    '12222244222222222244222221',
    '12266222222333222222266221',
    '.122222222232322222222221.',
    '.122222222222222222222221.',
    '..1222222222222222222221..',
    '...11222222222222222211...',
    '.....111111111111111111...',
  ];
  const PAINT = [[18, 2], [19, 1], [20, 0], [21, 0], [19, 2], [20, 1], [22, 1]];
  function studio(ctx, lt, t) {
    const u = ui();
    bgCheck(u, 0, P.k1, P.ink);
    panel(u, 14, 36, 512, 60, 'wood'); txt(u, '像素動畫工坊', 40, 56, { c: P.ink }); txt(u, '耳朵揮揮 8FPS', 500, 58, { align: 'right', c: P.inkSoft, font: 'Silkscreen' });
    // tools
    const tools = ['pencil', 'eraser', 'onion', 'plus'];
    tools.forEach((n, i) => { btn(u, 20 + i * 64, 112, 56, 56, '', { color: i === 0 ? P.r4 : P.c1, hi: P.c0, lo: i === 0 ? P.r3 : P.c2 }); icon(u, n, 48 + i * 64, 138, 3, P.ink, P.r2, P.e2); });
    // palette
    [P.k1, P.c0, P.pk, P.r2, P.r4, P.g4, P.w3, P.p2].forEach((c, i) => { rect(u, 290 + i * 29, 116, 26, 48, P.k1); rect(u, 292 + i * 29, 118, 22, 44, c); if (i === 3) { rect(u, 290 + i * 29, 166, 26, 4, P.r4); } });
    // canvas: 26x17 art, zoom 18
    const Z = 18, ox = 36, oy = 200;
    const playing = lt > 2.4;
    const fr = playing ? Math.floor((lt - 2.4) * 8) % 4 : 3;
    panel(u, 22, 186, 496, 336, 'paper');
    for (let j = 0; j < 17; j++) for (let i = 0; i < 26; i++) rect(u, ox + i * Z, oy + j * Z, Z, Z, (i + j) % 2 ? '#F2E6CC' : '#FBF2DE');
    const earShift = [0, 1, 2, 1][fr];
    const pal = { 1: P.k1, 2: P.c0, 3: P.r2, 4: P.k1, 5: P.white, 6: P.pk };
    // onion skin of previous frame
    if (!playing) { u.globalAlpha = 0.25; ART.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && j < 5 && i > 15) rect(u, ox + (i) * Z, oy + (j + 1) * Z, Z, Z, P.p1); })); u.globalAlpha = 1; }
    ART.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return; const dy = j < 5 && i > 15 ? -earShift : 0; rect(u, ox + i * Z, oy + (j + dy) * Z, Z, Z, pal[ch]); }));
    // user painted pixels (red sparkle)
    const n = playing ? PAINT.length : Math.floor(clamp((lt - 0.3) / 1.1) * PAINT.length);
    for (let k = 0; k < n; k++) { const [i, j] = PAINT[k]; rect(u, ox + (i + 3) * Z, oy + (j) * Z, Z, Z, P.r2); }
    // grid lines
    u.fillStyle = 'rgba(58,42,51,0.12)'; for (let i = 0; i <= 26; i++) u.fillRect(ox + i * Z, oy, 1, 17 * Z); for (let j = 0; j <= 17; j++) u.fillRect(ox, oy + j * Z, 26 * Z, 1);
    // frames strip
    panel(u, 14, 540, 512, 220, 'wood');
    txt(u, '影格', 36, 560, { c: P.ink });
    const frames = lt > 1.7 ? 5 : 4;
    for (let i = 0; i < frames; i++) {
      const fx = 34 + i * 92, fy = 594;
      if (i === 4 && lt < 1.95 && Math.floor(t * 10) % 2) continue; // pop-in blink
      rect(u, fx, fy, 84, 84, i === fr ? P.r2 : P.e2); rect(u, fx + 4, fy + 4, 76, 76, P.c0);
      C.draw(u, 'mochi', { earR: [0, 0.5, 0.9, 0.5][i % 4], noShadow: true }, fx + 42, fy + 112, 2, 0);
      txt(u, String(i + 1), fx + 42, fy + 88, { align: 'center', c: P.c0, font: 'Silkscreen' });
    }
    btn(u, 400, 690, 110, 56, '', { color: P.g3, hi: P.g4, lo: P.g1, pressed: lt > 2.25 && lt < 2.4 }); icon(u, playing ? 'pause' : 'play', 455, 716, 3, P.white);
    // preview window
    panel(u, 14, 776, 250, 160, 'dark'); txt(u, '預覽', 34, 792, { c: P.c0 });
    rect(u, 110, 794, 140, 128, P.w4); rect(u, 110, 880, 140, 42, P.g4);
    C.draw(u, 'mochi', idle(t, 1, { earR: playing ? [0, 0.5, 0.9, 0.5][fr] : 0, armR: playing && fr === 2 ? -2 : undefined, noShadow: true }), 180, 912, 3, t);
    panel(u, 276, 776, 250, 160, 'paper'); txt(u, '圖層', 296, 792, { c: P.ink });
    ['特效', '線稿', '上色'].forEach((n, i) => { rect(u, 296, 822 + i * 34, 210, 28, i === 0 ? P.r5 : P.c2); txt(u, n, 306, 828 + i * 34, { c: P.ink }); icon(u, 'face', 488, 836 + i * 34, 1, P.ink); });
    statusBar(u, '11:03');
    const pk = PAINT.map(([i, j], k) => ({ t: 0.3 + k * 0.16, x: ox + (i + 3) * Z + 9, y: oy + j * Z + 9, down: true }));
    cursor(u, finger([{ t: 0.1, x: 300, y: 300 }, ...pk, { t: 1.45, x: 440, y: 240 }, { t: 1.6, x: 216, y: 138 }, { t: 1.68, x: 216, y: 138, down: true }, { t: 1.8, x: 216, y: 138 }, { t: 2.15, x: 455, y: 716 }, { t: 2.25, x: 455, y: 716, down: true }, { t: 2.4, x: 455, y: 716 }], lt));
    present(ctx, UI, 2);
  }

  // ---------------- 10. PET (visual mock on a normal, non-pixel phone OS) ----------------
  function pet(ctx, lt, t) {
    ctx.save(); ctx.scale(3, 3);
    const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#2F4A5C'); g.addColorStop(0.6, '#5E8B7E'); g.addColorStop(1, '#A9C7A0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(60 + i * 60, 600 - (i % 3) * 30, 90, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = '300 54px sans-serif'; ctx.fillText('21:42', 34, 180);
    ctx.font = '14px sans-serif'; ctx.globalAlpha = 0.85; ctx.fillText('11月3日 星期二 · 18°', 38, 206); ctx.globalAlpha = 1;
    const apps = [['#E8F0EA', 'chat'], ['#F6E2D5', 'face'], ['#E4E2F3', 'play'], ['#DCEAF3', 'map'], ['#F8EFD0', 'clock'], ['#E0EFDC', 'leaf'], ['#ECE8E6', 'gear'], ['#5C9B4C', 'paw']];
    apps.forEach(([c, ic], i) => { const x = 52 + (i % 4) * 85, y = 300 + Math.floor(i / 4) * 86; OC.rr(ctx, x - 24, y - 24, 48, 48, 14); ctx.fillStyle = c; ctx.fill(); ctx.save(); ctx.imageSmoothingEnabled = false; icon(ctx, ic, x, y, 2.4, i === 7 ? '#fff' : '#3A2A33', i === 7 ? '#B5D96A' : '#C4C0C2'); ctx.restore(); ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(['訊息', '相機', '音樂', '地圖', '時鐘', '相簿', '設定', 'OC Shimeji'][i], x, y + 38); ctx.textAlign = 'left'; });
    OC.rr(ctx, 20, 520, 320, 70, 26); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
    ['chat', 'face', 'play', 'gear'].forEach((n, i) => { const x = 62 + i * 79; OC.rr(ctx, x - 22, 533, 44, 44, 13); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); icon(ctx, n, x, 555, 2.2, '#3A2A33'); });
    ctx.restore();
    // pet in screen px, pixel scale 4 (same density as the in-game world)
    const k = 4;
    const f = finger([{ t: 1.75, x: 120, y: 420 }, { t: 2.05, x: 150, y: 492 }, { t: 2.12, x: 150, y: 492, down: true }, { t: 2.35, x: 150, y: 486, down: true }, { t: 2.85, x: 210, y: 330, down: true }, { t: 3.3, x: 236, y: 212, down: true }, { t: 3.35, x: 236, y: 212 }], lt);
    let px, py, s;
    if (lt < 0.85) { const q = clamp((lt - 0.25) / 0.6); const qq = Math.floor(q * 8) / 8; px = lerp(300, 262, qq); py = lerp(386, 518, qq) - Math.sin(qq * Math.PI) * 60; s = idle(t, 1, { eyes: 'happy', mouth: 'open', armL: -2, armR: -2, noShadow: q < 1 }); }
    else if (lt < 2.12) { const w = walkPath([{ t: 1.0, x: 262, y: 518 }, { t: 2.0, x: 150, y: 518 }], lt, 22); px = w.x; py = w.y; s = idle(t, 1, { face: -1, walk: w.moving ? 1 : 0, phase: w.phase, squash: lt < 1.0 ? 0.88 : 1 }); }
    else if (lt < 3.35) { px = f.x; py = f.y + 40; s = idle(t, 1, { eyes: 'wide', mouth: 'o', walk: 1, phase: lt * 6, armL: -2, armR: -2, brows: 'up', noShadow: true }); }
    else { const fall = clamp((lt - 3.35) / 0.25); px = 236; py = lerp(252, 250, fall); const l2 = lt - 3.6; s = idle(t, 1, { squash: l2 > 0 && l2 < 0.15 ? 0.88 : 1, eyes: l2 > 0.75 && l2 < 1.25 ? 'happy' : l2 > 1.25 ? 'sleepy' : 'happy', mouth: l2 > 0.75 && l2 < 1.25 ? 'open' : 'cat', blush: 1, noShadow: lt < 3.6 }); }
    // 4px pixel grid snapping of the pet's own position
    px = R(px * 3 / k) * k; py = R(py * 3 / k) * k;
    const swing = lt > 2.12 && lt < 3.35 ? (Math.floor(lt * 8) % 2 ? 1 : -1) * k : 0;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    C.draw(ctx, 'mochi', s, px + swing, py, k, t);
    ctx.restore();
    if (lt > 3.9) { const u = ui(); const bx = R(px / 2) - 220, by = R(py / 2) - 150; panel(u, bx, by, 200, 50, 'paper'); txt(u, '休息一下吧！', bx + 100, by + 16, { align: 'center', c: P.ink }); present(ctx, UI, 2); }
    const u = ui();
    panel(u, 60, 40, 420, 48, 'dark'); rect(u, 80, 58, 10, 10, P.r2); txt(u, 'Android 懸浮桌寵·視覺模擬(未實機驗證)', 280, 56, { align: 'center', c: P.c0 });
    statusBar(u, '21:42'); cursor(u, f ? { ...f, x: f.x * 1.5, y: f.y * 1.5 } : null);
    present(ctx, UI, 2);
  }

  // ---------------- 11. END ----------------
  function end(ctx, lt, t) {
    const u = ui();
    bgCheck(u, t, P.g2, P.g1);
    panel(u, 60, 260, 420, 420, 'wood');
    C.draw(u, 'mochi', idle(t, 1, { eyes: 'happy', mouth: 'smile', armR: -2 }), 190, 450, 4, t);
    C.draw(u, 'kuri', idle(t, 2, { face: -0.5 }), 290, 450, 4, t);
    C.draw(u, 'sora', idle(t, 3, { eyes: 'sleepy' }), 380, 450, 3, t);
    txt(u, '方案 B', 270, 480, { align: 'center', c: P.r1 });
    txt(u, '像素森語', 270, 510, { align: 'center', c: P.ink, size: 32 });
    txt(u, 'PIXEL GROVE', 270, 556, { align: 'center', c: P.inkSoft, font: 'Silkscreen' });
    txt(u, '高位元像素 · 遊戲感框架 · 逐格節奏', 270, 600, { align: 'center', c: P.inkSoft });
    present(ctx, UI, 2);
  }

  // ---------------- transitions & chapter ----------------
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function transition(ctx, A, B, p) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(A, 0, 0);
    const q = Math.floor(p * 17) / 16; // dissolve in 16 discrete steps
    ctx.save(); ctx.beginPath();
    const cell = 24;
    for (let j = 0; j < 1920 / cell; j++) for (let i = 0; i < 1080 / cell; i++) if (B4[(j % 4) * 4 + (i % 4)] / 16 < q) ctx.rect(i * cell, j * cell, cell, cell);
    ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
  }
  function chapter(ctx, s, a, idx) {
    if (s.id === 'pet' || s.id === 'logo' || s.id === 'end' || a < 0.5) return;
    const label = `${String(idx).padStart(2, '0')} ${s.zh}`;
    const u = UI.getContext('2d'); u.clearRect(0, 0, 540, 40);
    const w = label.length * 15 + 20;
    u.fillStyle = 'rgba(27,23,38,0.75)'; u.fillRect(270 - w / 2, 4, w, 24);
    txt(u, label, 270, 8, { align: 'center', c: P.c0 });
    ctx.imageSmoothingEnabled = false; ctx.drawImage(UI, 0, 0, 540, 40, 0, 0, 1080, 80);
  }

  OC.themes.pixel = {
    id: 'pixel', name: '像素森語 Pixel Grove', short: 'B',
    fonts: [
      { family: 'Unifont', url: 'assets/fonts/Unifont.otf' },
      { family: 'Silkscreen', url: 'assets/fonts/Silkscreen-Regular.woff' },
    ],
    init() { WB1 = OC.makeCanvas(270, 480); WB2 = OC.makeCanvas(135, 240); UI = OC.makeCanvas(540, 960); },
    shots: { logo, island, creator, profile, dialogue, map, inventory, shop, studio, pet, end },
    transition, chapter,
  };
})();
