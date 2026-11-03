/* Scheme B — Pixel Grove : character rig (native 32x40 sprite, feet at 16,37)
 * Built from integer primitives every frame (cached by quantized state), outlined,
 * then blitted at integer scales only (world x1, portraits x5-x7 on the UI grid).
 * Motion is deliberately stepped: walk = 4 frames/stride, turn = 5 snapped angles,
 * breathing = 1px, blink = 2 frames.  Same state fields as the shared rig.
 */
(function () {
  'use strict';
  const { clamp } = OC;
  const { P, rect, oval, poly, bmp, sprite, blit, R } = OC.X;

  const DESIGNS = {
    mochi: { fur: P.c0, shade: P.c2, deep: P.e4, inner: P.pk, cheek: P.pk, eye: P.k1, muzzle: P.white, ears: 'cat', acc: 'scarf', accCol: P.r2, accHi: P.r3, clip: 'star', tail: 'cat' },
    kuri: { fur: P.e4, shade: P.e3, deep: P.e2, inner: P.pk, cheek: P.r3, eye: P.k1, muzzle: P.e5, ears: 'bunny', acc: 'scarf', accCol: P.g3, accHi: P.g4, clip: 'leaf', tail: 'puff' },
    sora: { fur: P.p3, shade: P.p2, deep: P.p1, inner: P.pk, cheek: P.pk, eye: P.k1, muzzle: P.c0, ears: 'bear', acc: 'beanie', accCol: P.pk, accHi: P.pk2, clip: null, tail: 'puff' },
  };
  const EYES = {
    round: ['21', '11', '11'], wide: ['211', '111', '111'], sparkle: ['211', '111', '112'], happy: ['.1.', '1.1'],
    sleepy: ['...', '111'], dot: ['.', '1'], closed: ['..', '..', '11'],
  };
  const MOUTH = {
    cat: ['1.1.1', '.1.1.'], smile: ['1...1', '.111.'], o: ['11', '11'], open: ['1111', '1331', '.11.'],
    flat: ['111'], tongue: ['11111', '..3..'], wave: ['.1.1', '1.1.'],
  };

  function build(D, s, t) {
    const fxRaw = s.face || 0;
    const fx = Math.round(fxRaw * 2) / 2; // snapped: -1,-.5,0,.5,1
    const back = (s.back || 0) > 0.5;
    const walk = (s.walk || 0) > 0.3;
    const wf = walk ? Math.floor((s.phase || 0) * 2) % 4 : 0;
    const bob = walk && (wf === 1 || wf === 3) ? -1 : 0;
    const br = (s.breath || 0) > 0.35 ? -1 : 0;
    const squashDy = R((1 - (s.squash || 1)) * 9);
    const ears = s.ears || D.ears;
    const earUp = R(-(s.ear || 0) * 4);
    const eL = R((s.earL || 0) * 3), eR = R((s.earR || 0) * 3);
    const blinkC = (s.blink || 0) > 0.5;
    let eyes = s.eyes || 'round';
    if (blinkC && eyes !== 'happy' && eyes !== 'sleepy') eyes = 'closed';
    const mouth = s.mouth === 'chew' ? (Math.floor((t || 0) * 8) % 2 ? 'o' : 'flat') : s.mouth || 'cat';
    const armL = s.armL != null ? (s.armL < -1 ? 1 : 0) : 0, armR = s.armR != null ? (s.armR < -1 ? (Math.floor((t || 0) * 8) % 2 ? 1 : 2) : 0) : 0;
    const tailW = R(Math.sin(s.tail || 0) * 2);
    const hold = s.hold;
    const key = ['c', D.fur, D.ears, ears, fx, back, wf, bob, br, squashDy, earUp, eL, eR, eyes, mouth, armL, armR, tailW, s.brows || '', s.cheeks || '', (s.blush || 0) > 0.5, s.clip, hold].join('|');
    return sprite(key, 32, 40, (x) => {
      const ox = 16, oy = 37;
      const X = (v) => ox + v, Y = (v) => oy + v;
      const hy = -17 + bob + br * 0 + squashDy; // head center
      const by = -6 + bob;
      const hx = R(fx * 1);
      // tail behind
      const tailSide = fx > 0 ? -1 : 1;
      const drawTail = () => {
        if (D.tail === 'puff') oval(x, X(tailSide * 6.5 + tailW * 0.5), Y(by + 1), 2.6, 2.4, D.fur);
        else { for (let i = 0; i < 6; i++) rect(x, X(tailSide * (5 + i * 0.7) + (i > 3 ? tailW : 0)), Y(by + 1 - i * 1.3), 2, 2, i > 3 ? D.shade : D.fur); }
      };
      if (!back) drawTail();
      // legs (4-frame walk)
      const lUp = wf === 1 ? 1 : 0, rUp = wf === 3 ? 1 : 0;
      const sideK = Math.abs(fx) > 0.6 ? 0.4 : 1;
      rect(x, X(R(-4 * sideK) + (wf === 1 ? fx * 1 : 0)), Y(-3 - lUp), 3, 3, D.shade);
      rect(x, X(R(1 * sideK) + (wf === 3 ? fx * 1 : 0)), Y(-3 - rUp), 3, 3, D.shade);
      // body
      oval(x, X(0), Y(by), 5.6, 4.6, D.shade);
      oval(x, X(-0.4), Y(by - 0.5), 4.8, 3.9, D.fur);
      if (!back) oval(x, X(R(fx * 1.5)), Y(by + 1), 2.6, 2.2, D.muzzle);
      // arms
      const ay = by - 3;
      if (armL) rect(x, X(-8), Y(ay - 3), 2, 3, D.fur); else rect(x, X(-7), Y(ay), 2, 3, D.shade);
      if (armR === 1) rect(x, X(6), Y(ay - 4), 2, 3, D.fur); else if (armR === 2) rect(x, X(7), Y(ay - 3), 2, 3, D.fur); else rect(x, X(5), Y(ay), 2, 3, D.shade);
      // scarf
      if (D.acc === 'scarf') { rect(x, X(-5), Y(by - 4), 10, 2, D.accCol); rect(x, X(-4), Y(by - 4), 8, 1, D.accHi); if (!back) rect(x, X(fx >= 0 ? 2 : -4), Y(by - 3), 2, 3, D.accCol); }
      // ears (behind head)
      const earPair = (side) => {
        const e = side < 0 ? eL : eR, bx = hx + side * (fx * side > 0 ? 6 : 7);
        if (ears === 'cat') { poly(x, [[X(bx - side * 3), Y(hy - 3)], [X(bx - side * 1 + side * e), Y(hy - 12 + earUp)], [X(bx + side * 3), Y(hy - 5)]], D.fur); poly(x, [[X(bx - side * 1.5), Y(hy - 4)], [X(bx - side * 0.5 + side * e), Y(hy - 9 + earUp)], [X(bx + side * 1.5), Y(hy - 5)]], D.inner); }
        else if (ears === 'bunny') { oval(x, X(bx - side * 2 + side * e), Y(hy - 11 + earUp), 2.2, 6, D.fur); oval(x, X(bx - side * 2 + side * e), Y(hy - 11 + earUp), 0.9, 4.2, D.inner); }
        else if (ears === 'bear') { oval(x, X(bx), Y(hy - 6 + earUp), 3, 2.8, D.fur); oval(x, X(bx), Y(hy - 6 + earUp), 1.4, 1.3, D.inner); }
        else if (ears === 'fold') { poly(x, [[X(bx - side * 3), Y(hy - 4)], [X(bx), Y(hy - 9 + earUp)], [X(bx + side * 4), Y(hy - 5 + e)]], D.shade); }
        else if (ears === 'sprout' && side < 0) { rect(x, X(0), Y(hy - 11), 1, 4, P.g3); oval(x, X(-3), Y(hy - 12), 2.6, 1.3, P.g4); oval(x, X(3), Y(hy - 13), 2.6, 1.3, P.g4); }
      };
      earPair(-1); earPair(1);
      // head with pixel shading
      oval(x, X(hx), Y(hy), 9.6, 7.6, D.shade);
      oval(x, X(hx - 0.6), Y(hy - 0.8), 8.8, 6.7, D.fur);
      rect(x, X(hx - 6), Y(hy - 6), 3, 1, P.white);
      if (!back) {
        const ex = R(fx * 3);
        const map = { 1: D.eye, 2: P.white };
        const ew = (EYES[eyes][0] || '').length;
        for (const side of [-1, 1]) {
          const far = side * fx < 0 && Math.abs(fx) > 0.6;
          const cx = hx + ex + side * (Math.abs(fx) > 0.6 ? 3 : 4);
          const rows = far ? EYES[eyes].map((r) => r.slice(0, 1)) : EYES[eyes];
          bmp(x, rows, X(cx - R(ew / 2)), Y(hy - 2 + (eyes === 'happy' ? 1 : 0) + (eyes === 'sleepy' ? 0 : 0)), map);
          if (s.brows === 'up') rect(x, X(cx - 1), Y(hy - 5), 2, 1, D.deep);
          else if (s.brows === 'worry') { rect(x, X(cx - (side < 0 ? 1 : 0)), Y(hy - 4), 1, 1, D.deep); rect(x, X(cx + (side < 0 ? 0 : -1)), Y(hy - 5), 1, 1, D.deep); }
          else if (s.brows === 'soft') rect(x, X(cx - 1), Y(hy - 4), 2, 1, D.shade);
          // cheeks
          const blushOn = (s.blush || 0) > 0.5 || (s.cheeks || 'blush') !== 'none';
          if (blushOn && !far) rect(x, X(cx + side * 2 - (side < 0 ? 1 : 0)), Y(hy + 2), 2, 1, (s.blush || 0) > 0.5 ? P.r2 : D.cheek);
        }
        const m = MOUTH[mouth] || MOUTH.cat;
        bmp(x, m, X(hx + ex - R(m[0].length / 2)), Y(hy + 3), { 1: D.eye, 3: P.pk });
      } else {
        rect(x, X(hx - 1), Y(hy - 6), 3, 1, D.shade);
      }
      // hat / clip
      if (D.acc === 'beanie') { oval(x, X(hx), Y(hy - 4), 9.4, 4.2, D.accCol); rect(x, X(hx - 9), Y(hy - 3), 19, 2, D.accHi); oval(x, X(hx + tailW * 0.5), Y(hy - 9), 2.2, 2, P.c0); }
      const clip = s.clip !== undefined ? s.clip : D.clip;
      if (clip && !back) {
        const cx = X(hx - 7 + R(fx)), cy = Y(hy - 6);
        if (clip === 'star') bmp(x, ['.1.', '111', '1.1'], cx, cy, { 1: P.r4 });
        else if (clip === 'leaf') bmp(x, ['.11', '11.'], cx, cy, { 1: P.g3 });
        else if (clip === 'flower') bmp(x, ['.1.', '121', '.1.'], cx, cy, { 1: P.white, 2: P.r4 });
      }
      if (back) drawTail();
      if (hold === 'leaf') { rect(x, X(3), Y(hy - 12), 1, 10, P.g1); poly(x, [[X(-11), Y(hy - 10)], [X(-6), Y(hy - 16)], [X(4), Y(hy - 17)], [X(13), Y(hy - 12)], [X(1), Y(hy - 12)]], P.g3); rect(x, X(-4), Y(hy - 15), 7, 1, P.g4); }
    });
  }

  /** draw at feet (x,y) on a pixel buffer at integer scale k */
  function draw(ctx, D, s, x, y, k = 1, t = 0) {
    if (typeof D === 'string') D = DESIGNS[D];
    const lift = R(s.lift || 0);
    if (!s.noShadow) { const w = Math.max(6, 12 - R(lift / 3)); ctx.fillStyle = 'rgba(20,20,40,0.28)'; ctx.fillRect(R(x - (w / 2) * k), R(y - 1 * k), w * k, 2 * k); ctx.fillRect(R(x - (w / 2 - 1) * k), R(y), (w - 2) * k, 1 * k); }
    const cv = build(D, s, t);
    blit(ctx, cv, x - 16 * k, y - (37 + lift) * k, k);
  }
  /** pixel emote above head; (x,y) = bubble bottom anchor on world buffer */
  function emote(ctx, kind, x, y, p, k = 1) {
    if (p <= 0 || p >= 1) return;
    const hop = p < 0.12 ? -2 : 0;
    x = R(x); y = R(y) + hop;
    if (kind === 'zzz') { const f = Math.floor(p * 9) % 3; for (let i = 0; i <= f; i++) OC.X.txt(ctx, 'z', x + i * 4, y - 10 - i * 5, { c: P.white, font: 'Silkscreen', size: 8, sh: P.n2 }); return; }
    if (kind === '♥') { const f = Math.floor(p * 10); OC.X.icon(ctx, 'heart', x, y - 8 - (f % 2), k); if (p > 0.3) OC.X.icon(ctx, 'heart', x + 8, y - 14 - (f % 2), k); return; }
    rect(ctx, x - 6, y - 15, 13, 12, P.k1); rect(ctx, x - 5, y - 14, 11, 10, P.white); rect(ctx, x - 1, y - 3, 3, 2, P.k1); rect(ctx, x, y - 4, 1, 2, P.white);
    if (kind === '!') { rect(ctx, x, y - 13, 1, 5, P.r1); rect(ctx, x, y - 7, 1, 1, P.r1); rect(ctx, x + 1, y - 13, 1, 5, P.r1); rect(ctx, x + 1, y - 7, 1, 1, P.r1); }
    else if (kind === '♪') bmp(ctx, ['..11', '..1.', '..1.', '111.', '11..'], x - 2, y - 12, { 1: P.p1 });
    else if (kind === '?') bmp(ctx, ['111', '..1', '.1.', '...', '.1.'], x - 1, y - 12, { 1: P.w1 });
  }

  OC.X.CHAR = { DESIGNS, draw, emote, build };
})();
