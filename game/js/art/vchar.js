/* Shared parameterized character rig for Round-2 schemes.
 * Same skeleton & state fields as round 1 (face, back, walk, phase, breath, blink, eyes,
 * brows, mouth, blush, ear/earL/earR, tail, armL/armR, squash, lift, tilt, lookX/lookY…)
 * plus face-maker params for F (eyeGap, eyeSize, eyeRot, eyeY, browRot, browY, mouthY)
 * and comic overlays (sweat, shock). ST = scheme style; D = character design.
 */
(function () {
  'use strict';
  const { TAU, clamp, lerp, ellipse, rr, mix, rgba } = OC;

  function mat(ST, base, shade) {
    return {
      mode: ST.mat, base, shade, lw: ST.lw || 1.3,
      outline: ST.outline ? (typeof ST.outline === 'function' ? ST.outline(base) : ST.outline) : null,
      hi: ST.rim ? rgba(ST.rim, 0.65) : null, dx: ST.dx ?? 2.4, dy: ST.dy ?? 2.6,
    };
  }
  const P = (ctx, fn, m) => OC.V.paint(ctx, fn, m);
  const El = (ctx, cx, cy, rx, ry, rot = 0) => (ox, oy) => ellipse(ctx, cx + ox, cy + oy, rx, ry, rot);

  // ---------------- faces ----------------
  function eyeIris(ctx, D, s, open, style, side) {
    const lid = D.eye;
    if (style === 'happy' || (open < 0.2 && style !== 'sleepy')) {
      ctx.strokeStyle = lid; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
      if (style === 'happy') { ctx.moveTo(-3.2, 1.3); ctx.quadraticCurveTo(0, -3, 3.2, 1.3); } else { ctx.moveTo(-3.2, 0.5); ctx.quadraticCurveTo(0, 2, 3.2, 0.5); }
      ctx.stroke(); return;
    }
    const wide = style === 'wide', R = wide ? 1.15 : 1;
    const h = 4.5 * R * (style === 'sleepy' ? 0.55 : open);
    ctx.save();
    ellipse(ctx, 0, 0, 3.3 * R, h); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.clip();
    const lx = (s.lookX || 0) * 0.9;
    ellipse(ctx, lx, 0.6, wide ? 1.9 : 2.6, wide ? 2.4 : 3.5); ctx.fillStyle = D.iris || '#3F8F9A'; ctx.fill();
    ellipse(ctx, lx, 1.4, wide ? 1.1 : 1.6, 1.2); ctx.fillStyle = rgba('#ffffff', 0.25); ctx.fill();
    ellipse(ctx, lx, 0.4, wide ? 0.8 : 1.1, wide ? 1.1 : 1.6); ctx.fillStyle = lid; ctx.fill();
    ctx.fillStyle = '#fff';
    if (style === 'sparkle') { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 0.45 : 1.7; ctx.lineTo(lx - 0.7 + Math.cos(a) * r, -0.9 + Math.sin(a) * r); } ctx.fill(); }
    else { ellipse(ctx, lx - 0.9, -1.2, 0.9, 0.9); ctx.fill(); }
    ctx.restore();
    // upper lid line (heavier toward outer corner)
    ctx.strokeStyle = lid; ctx.lineCap = 'round'; ctx.lineWidth = 1.15;
    ctx.beginPath(); ctx.ellipse(0, 0, 3.3 * R, h, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.lineWidth = 0.6; ctx.strokeStyle = rgba(lid, 0.45); ctx.beginPath(); ctx.ellipse(0, 0, 3.3 * R, h, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
  function eyeDot(ctx, D, s, open, style) {
    ctx.fillStyle = D.eye; ctx.strokeStyle = D.eye; ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
    if (style === 'happy' || (open < 0.2 && style !== 'sleepy')) { ctx.beginPath(); if (style === 'happy') { ctx.moveTo(-2.8, 1.2); ctx.quadraticCurveTo(0, -2.6, 2.8, 1.2); } else { ctx.moveTo(-2.4, 0.4); ctx.lineTo(2.4, 0.4); } ctx.stroke(); return; }
    if (style === 'sleepy') { ctx.beginPath(); ctx.moveTo(-2.6, 0.8); ctx.quadraticCurveTo(0, 2.2, 2.6, 0.8); ctx.stroke(); return; }
    const big = style === 'wide' ? 1.3 : 1;
    ellipse(ctx, (s.lookX || 0) * 0.5, 0, 1.9 * big, 2.7 * big * open); ctx.fill();
    ctx.fillStyle = '#fff';
    if (style === 'sparkle') { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 0.35 : 1.3; ctx.lineTo(-0.5 + Math.cos(a) * r, -0.9 + Math.sin(a) * r); } ctx.fill(); }
    else { ellipse(ctx, -0.6, -1.1 * open, 0.75, 0.75 * open); ctx.fill(); }
  }
  function eyeMii(ctx, D, s, open, style) {
    const sz = s.eyeSize || 1;
    ctx.strokeStyle = D.eye; ctx.lineCap = 'round';
    if (style === 'happy' || (open < 0.2 && style !== 'sleepy')) { ctx.lineWidth = 1.8; ctx.beginPath(); if (style === 'happy') { ctx.moveTo(-3.2 * sz, 1.4); ctx.quadraticCurveTo(0, -3 * sz, 3.2 * sz, 1.4); } else { ctx.moveTo(-3 * sz, 0.4); ctx.lineTo(3 * sz, 0.4); } ctx.stroke(); return; }
    const wide = style === 'wide';
    const rx = 3.2 * sz * (wide ? 1.15 : 1), ry = 3.7 * sz * (wide ? 1.2 : 1) * (style === 'sleepy' ? 0.5 : open);
    ellipse(ctx, 0, style === 'sleepy' ? 1.6 : 0, rx, ry); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 0.9; ctx.stroke();
    ctx.save(); ellipse(ctx, 0, style === 'sleepy' ? 1.6 : 0, rx, ry); ctx.clip();
    const pr = wide ? 1.2 : 1.9;
    ellipse(ctx, (s.lookX || 0) * 1.1, 0.6 + (s.lookY || 0) * 0.5, pr * sz, pr * 1.15 * sz); ctx.fillStyle = D.eye; ctx.fill();
    ctx.fillStyle = '#fff';
    if (style === 'sparkle') { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 0.4 : 1.6; ctx.lineTo(-0.6 + Math.cos(a) * r, -0.6 + Math.sin(a) * r); } ctx.fill(); }
    else { ellipse(ctx, -0.7 * sz, -0.6 * sz, 0.7 * sz, 0.7 * sz); ctx.fill(); }
    ctx.restore();
  }
  function mouth(ctx, D, s, style, t, sc = 1) {
    ctx.save(); ctx.scale(sc, sc);
    ctx.strokeStyle = D.eye; ctx.fillStyle = D.eye; ctx.lineWidth = 1.25; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (style) {
      case 'smile': ctx.beginPath(); ctx.moveTo(-2.8, -0.4); ctx.quadraticCurveTo(0, 2.8, 2.8, -0.4); ctx.stroke(); break;
      case 'grin': ctx.beginPath(); ctx.moveTo(-3.4, -0.6); ctx.quadraticCurveTo(0, 4.2, 3.4, -0.6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-2.6, -0.4, 5.2, 0.9); break;
      case 'o': ellipse(ctx, 0, 0.6, 1.5, 1.9); ctx.fill(); break;
      case 'open': ctx.beginPath(); ctx.moveTo(-3.2, -0.5); ctx.quadraticCurveTo(0, 5, 3.2, -0.5); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#F2788A'; ellipse(ctx, 0, 2.3, 1.7, 1); ctx.fill(); break;
      case 'flat': ctx.beginPath(); ctx.moveTo(-2, 0.4); ctx.lineTo(2, 0.4); ctx.stroke(); break;
      case 'tongue': ctx.beginPath(); ctx.moveTo(-2.6, 0); ctx.quadraticCurveTo(-1.3, 1.3, 0, 0); ctx.quadraticCurveTo(1.3, 1.3, 2.6, 0); ctx.stroke(); ctx.fillStyle = '#F2788A'; ellipse(ctx, 0.4, 1.9, 1.2, 1.3); ctx.fill(); break;
      case 'chew': { const c = Math.abs(Math.sin((t || 0) * 14)); ellipse(ctx, 0, 0.5, 1.9, 0.4 + c * 1.5); ctx.fill(); break; }
      case 'wave': ctx.beginPath(); ctx.moveTo(-3, 0); for (let i = 0; i <= 6; i++) ctx.lineTo(-3 + i, i % 2 ? 0.9 : -0.2); ctx.stroke(); break;
      case 'frown': ctx.beginPath(); ctx.moveTo(-2.4, 1.2); ctx.quadraticCurveTo(0, -0.8, 2.4, 1.2); ctx.stroke(); break;
      default: ctx.beginPath(); ctx.moveTo(-2.8, -0.2); ctx.quadraticCurveTo(-1.4, 1.7, 0, -0.1); ctx.quadraticCurveTo(1.4, 1.7, 2.8, -0.2); ctx.stroke();
    }
    ctx.restore();
  }
  function face(ctx, D, s, ST, t) {
    const fx = s.face || 0, open = 1 - clamp(s.blink || 0), style = s.eyes || 'round';
    const mii = ST.face === 'mii';
    const gap = mii ? (s.eyeGap ?? 6.8) : ST.face === 'dot' ? 7.6 : 7;
    const eyeY = (ST.eyeY ?? 1.5) + (s.eyeY || 0) + (s.lookY || 0) * 0.6;
    for (const side of [-1, 1]) {
      const near = side * fx > 0;
      const ex = side * gap * (1 - 0.22 * Math.abs(fx)) + fx * 6.5;
      ctx.save(); ctx.translate(ex, eyeY); ctx.scale(near ? 1 - 0.42 * Math.abs(fx) : 1, 1);
      if (mii) ctx.rotate((s.eyeRot || 0) * side);
      if (ST.face === 'iris') eyeIris(ctx, D, s, open, style, side);
      else if (ST.face === 'dot') eyeDot(ctx, D, s, open, style);
      else eyeMii(ctx, D, s, open, style);
      ctx.restore();
      // brows
      const b = s.brows || (mii ? 'soft' : null);
      if (b) {
        const bx = ex, by = eyeY - (mii ? 5.6 + (s.browY || 0) : 5.2);
        let rot = (s.browRot || 0) * side; if (b === 'up') rot -= 0.25 * side; if (b === 'worry') rot += 0.4 * side; if (b === 'angry') rot -= 0.45 * side;
        ctx.save(); ctx.translate(bx, by - (b === 'up' ? 1.2 : 0)); ctx.rotate(-rot); ctx.strokeStyle = mii ? D.eye : rgba(D.eye, 0.75); ctx.lineCap = 'round';
        ctx.lineWidth = mii ? 1.9 : 1.2; ctx.beginPath(); ctx.moveTo(-2.4, 0.3); ctx.quadraticCurveTo(0, -0.8, 2.4, 0.3); ctx.stroke(); ctx.restore();
      }
      // cheeks
      const cx = side * (ST.face === 'dot' ? 10.8 : 10.4) * (1 - 0.25 * Math.abs(fx)) + fx * 5.2, cy = eyeY + (ST.face === 'dot' ? 4.2 : 3.8);
      const ca = (ST.cheekA ?? 0.55) + (s.blush || 0) * 0.35;
      if (!(near && Math.abs(fx) > 0.6)) {
        ctx.fillStyle = rgba(D.cheek, Math.min(0.95, ca));
        if (ST.face === 'dot') { ellipse(ctx, cx, cy, 3.3, 2.6); ctx.fill(); }
        else { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 3.6); g.addColorStop(0, rgba(D.cheek, ca)); g.addColorStop(1, rgba(D.cheek, 0)); ctx.fillStyle = g; ellipse(ctx, cx, cy, 3.8, 2.5); ctx.fill(); }
        if ((s.blush || 0) > 0.5) { ctx.strokeStyle = rgba(D.cheek, 0.95); ctx.lineWidth = 0.8; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx + k * 1.5 - 0.6, cy + 0.9); ctx.lineTo(cx + k * 1.5 + 0.6, cy - 0.9); ctx.stroke(); } }
      }
    }
    // nose (mii / iris)
    const mx = fx * 7.4, my = eyeY + 5 + (s.mouthY || 0);
    if (mii) { ctx.strokeStyle = rgba(D.eye, 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mx, my - 2.2, 1, 0.2, Math.PI - 0.2); ctx.stroke(); }
    else { ctx.fillStyle = mix(D.cheek, D.eye, 0.3); ellipse(ctx, mx, my - 2.1, 0.9, 0.6); ctx.fill(); }
    ctx.save(); ctx.translate(mx, my); mouth(ctx, D, s, s.mouth || 'cat', t, mii ? 1.15 : 1); ctx.restore();
    // comic overlays
    if (s.sweat) { ctx.save(); ctx.translate(13, -8); ctx.fillStyle = '#9FD3FF'; ctx.strokeStyle = '#4C8DD0'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(3, 1, 0, 2.5); ctx.quadraticCurveTo(-3, 1, 0, -4); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (s.shock) { ctx.save(); ctx.strokeStyle = rgba('#5B6FD6', 0.75); ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 2.4, -12); ctx.lineTo(i * 2.4, -7.5); ctx.stroke(); } ctx.restore(); }
  }

  // ---------------- ears ----------------
  function ear(ctx, D, ST, type, side, s) {
    const fx = s.face || 0, extra = side < 0 ? (s.earL || 0) : (s.earR || 0);
    const H = ST.head;
    const bx = side * H.rx * 0.56 + fx * 4.2, by = -H.ry * 0.62;
    const ang = side * (0.32 + (s.ear || 0)) + extra * side;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ang); ctx.scale((1 - Math.max(0, side * fx) * 0.18) * (ST.earScale || 1), ST.earScale || 1);
    const fur = mat(ST, D.fur, D.shade), inner = { mode: 'flat', base: D.inner, shade: D.inner };
    if (type === 'cat') { P(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-7 + ox, 3 + oy); ctx.quadraticCurveTo(-5.5 + ox, -9 + oy, -0.5 + ox, -13.5 + oy); ctx.quadraticCurveTo(5.5 + ox, -8 + oy, 7 + ox, 3 + oy); ctx.closePath(); }, fur); P(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-3.6 + ox, 1 + oy); ctx.quadraticCurveTo(-3 + ox, -6.5 + oy, -0.6 + ox, -9.5 + oy); ctx.quadraticCurveTo(2.8 + ox, -5.5 + oy, 3.6 + ox, 1 + oy); ctx.closePath(); }, inner); }
    else if (type === 'bunny') { ctx.rotate(side * 0.18); P(ctx, El(ctx, 0, -11, 5, 13.5), fur); P(ctx, El(ctx, 0, -10.5, 2.4, 10), inner); }
    else if (type === 'bear') { P(ctx, El(ctx, 0, -3, 6, 6), fur); P(ctx, El(ctx, 0, -2.5, 3.2, 3.2), inner); }
    else if (type === 'fold') { P(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-6.5 + ox, 3 + oy); ctx.quadraticCurveTo(-5 + ox, -6 + oy, 0 + ox, -8 + oy); ctx.quadraticCurveTo(7 + ox, -7 + oy, 5 + ox, 2 + oy); ctx.closePath(); }, fur); }
    else if (type === 'round') { P(ctx, El(ctx, 0, -1, 5, 4.5), fur); }
    else if (type === 'sprout' && side < 0) { ctx.rotate(-ang * 0.6 + 0.3); ctx.strokeStyle = '#4FA35A'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0.5, -7); ctx.stroke(); P(ctx, El(ctx, -4.2, -8, 4.6, 2.4, 0.35), mat(ST, '#7CCB5A', '#4FA35A')); P(ctx, El(ctx, 4.8, -9, 4.6, 2.4, -0.35), mat(ST, '#7CCB5A', '#4FA35A')); }
    ctx.restore();
  }

  function tailDraw(ctx, D, ST, s, bodyY) {
    const fx = s.face || 0, side = fx > 0.15 ? -1 : 1, wag = s.tail || 0;
    ctx.save(); ctx.translate(side * 7, bodyY + 4); ctx.rotate(side * (0.5 + wag));
    if (D.tail === 'puff') P(ctx, El(ctx, side * 2, -4, 5, 4.6), mat(ST, D.fur, D.shade));
    else {
      const path = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(side * 6, -2, side * 9, -9, side * 6 + wag * 4, -15); };
      if (ST.outline) { path(); ctx.strokeStyle = typeof ST.outline === 'function' ? ST.outline(D.fur) : ST.outline; ctx.lineCap = 'round'; ctx.lineWidth = 4.4 + (ST.lw || 1.3) * 2; ctx.stroke(); }
      path(); ctx.strokeStyle = D.fur; ctx.lineCap = 'round'; ctx.lineWidth = 4.4; ctx.stroke();
      if (D.tailTip) { ctx.beginPath(); ctx.arc(side * 6 + wag * 4, -15, 2.2, 0, TAU); ctx.fillStyle = D.tailTip; ctx.fill(); }
    }
    ctx.restore();
  }

  /** draw(ctx, D, state, feetX, feetY, scale, time, ST) */
  function draw(ctx, D, s, x, y, sc, t, ST) {
    const fx = s.face || 0, back = s.back || 0, walk = s.walk || 0, ph = s.phase || 0;
    const br = s.breath || 0, lift = s.lift || 0, sq = s.squash || 1;
    const stepS = Math.sin(ph * Math.PI), bob = walk * Math.abs(stepS) * 2.2;
    const H = ST.head, Bd = ST.body;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    if (!s.noShadow) OC.V.shadow(ctx, 0, 0.5, 15 * (1 - clamp(lift / 50) * 0.5), 4.2, (ST.shadowA ?? 0.24) * (1 - clamp(lift / 60) * 0.6), ST.shadowCol || '#3a2c30');
    ctx.translate(0, -lift); ctx.rotate(s.lean || 0); ctx.scale(1 / Math.sqrt(sq), sq);
    const bodyY = Bd.y - bob * 0.6 + br * 0.15;
    const headY = H.y - bob + br * 0.55 + (s.headDy || 0);
    const hx = fx * 1.4 + (s.headDx || 0);
    if (back < 0.5) tailDraw(ctx, D, ST, s, bodyY);
    // legs / feet
    for (const side of [-1, 1]) {
      const lx = side * 4.6 * (1 - 0.45 * Math.abs(fx)) + fx * walk * stepS * side * 3.2;
      const ly = -2.2 - Math.max(0, walk * stepS * -side) * 2.4;
      P(ctx, (ox, oy) => rr(ctx, lx - 3.1 + ox, ly - 4 + oy, 6.2, 6.6, 3), mat(ST, D.legs || D.fur, D.shade));
    }
    // body (fur or clothes)
    const bw = Bd.rx * (1 + br * 0.018), bh = Bd.ry * (1 + br * 0.03);
    const bodyCol = D.shirt || D.fur, bodyShade = D.shirt ? mix(D.shirt, '#20202a', 0.28) : D.shade;
    P(ctx, El(ctx, 0, bodyY, bw, bh), mat(ST, bodyCol, bodyShade));
    if (D.shirt && back < 0.5) { // collar / pattern
      ctx.save(); ellipse(ctx, 0, bodyY, bw, bh); ctx.clip();
      if (D.pattern === 'stripe') { ctx.fillStyle = rgba('#ffffff', 0.55); for (let k = -3; k <= 3; k++) ctx.fillRect(-bw, bodyY + k * 3.6, bw * 2, 1.6); }
      if (D.pattern === 'star') OC.V.icon(ctx, 'star', fx * 3, bodyY + 2, 7, rgba('#ffffff', 0.85));
      ctx.restore();
      ctx.fillStyle = D.fur; ctx.beginPath(); ctx.moveTo(-4 + fx * 2, bodyY - bh + 1.5); ctx.lineTo(fx * 2, bodyY - bh + 5); ctx.lineTo(4 + fx * 2, bodyY - bh + 1.5); ctx.closePath(); ctx.fill();
    } else if (back < 0.5) { ctx.fillStyle = rgba(D.muzzle || '#fff', 0.85); ellipse(ctx, fx * 3, bodyY + 2, 6 * (1 - Math.abs(fx) * 0.3), 5.5); ctx.fill(); }
    // arms
    for (const side of [-1, 1]) {
      const sw = (side < 0 ? s.armL : s.armR) ?? walk * stepS * side * 0.6;
      ctx.save(); ctx.translate(side * (bw - 1.4) * (1 - 0.3 * Math.abs(fx)), bodyY - 3); ctx.rotate(side * 0.35 + sw * side);
      P(ctx, El(ctx, 0, 3.6, 2.9, 4.4), mat(ST, D.shirt || D.fur, D.shirt ? bodyShade : D.shade));
      if (D.shirt) { ctx.fillStyle = D.fur; ellipse(ctx, 0, 7.2, 2.3, 1.9); ctx.fill(); }
      ctx.restore();
    }
    // scarf with wind
    if (D.acc === 'scarf' && back < 0.95) {
      const sy = bodyY - bh + 2;
      const wind = ST.wind ? 1 : 0.35;
      const dir = fx > 0.2 ? -1 : 1;
      ctx.save();
      const tail = []; for (let i = 0; i <= 8; i++) { const q = i / 8; tail.push([dir * (3 + q * 16 * wind), sy + 2 + q * (6 - 4 * wind) + Math.sin(t * 9 - q * 5) * 2.2 * q * wind]); }
      const draw2 = (w, c) => { ctx.beginPath(); tail.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
      if (ST.outline) draw2(4.4 + 2.2, typeof ST.outline === 'function' ? ST.outline(D.accCol) : ST.outline);
      draw2(4.4, D.accCol);
      P(ctx, (ox, oy) => rr(ctx, -9.5 + ox, sy - 2.4 + oy, 19, 4.8, 2.4), mat(ST, D.accCol, mix(D.accCol, '#20202a', 0.3)));
      ctx.restore();
    }
    // head
    ctx.save(); ctx.translate(hx, headY); ctx.rotate(s.tilt || 0);
    const ears = s.ears || D.ears;
    ear(ctx, D, ST, ears, -1, s); ear(ctx, D, ST, ears, 1, s);
    P(ctx, El(ctx, 0, 0, H.rx * (1 + br * 0.006), H.ry), mat(ST, D.fur, D.shade));
    if (ST.mat === 'gloss') { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ellipse(ctx, -H.rx * 0.42, -H.ry * 0.52, H.rx * 0.28, H.ry * 0.16, -0.5); ctx.fill(); }
    if (ST.mat === 'flat') { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ellipse(ctx, -H.rx * 0.35, -H.ry * 0.55, H.rx * 0.32, H.ry * 0.18, -0.3); ctx.fill(); }
    if (D.hair) { // fringe (F)
      P(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-H.rx + 0.5 + ox, -1 + oy); ctx.quadraticCurveTo(-H.rx * 0.9 + ox, -H.ry * 1.05 + oy, 0 + ox, -H.ry * 1.02 + oy); ctx.quadraticCurveTo(H.rx * 0.9 + ox, -H.ry * 1.05 + oy, H.rx - 0.5 + ox, -1 + oy); ctx.quadraticCurveTo(H.rx * 0.45 + ox, -H.ry * 0.62 + oy, 2 + ox, -H.ry * 0.55 + oy); ctx.quadraticCurveTo(-H.rx * 0.5 + ox, -H.ry * 0.7 + oy, -H.rx + 0.5 + ox, -1 + oy); ctx.closePath(); }, mat(ST, D.hair, mix(D.hair, '#101018', 0.3)));
    }
    const fa = 1 - clamp(back * 1.6);
    if (fa > 0) { ctx.save(); ctx.globalAlpha *= fa; face(ctx, D, s, ST, t); ctx.restore(); }
    if (D.acc === 'beanie') {
      P(ctx, (ox, oy) => { ctx.beginPath(); ctx.ellipse(ox, -4.5 + oy, H.rx * 0.95, H.ry * 0.8, 0, Math.PI, TAU); ctx.closePath(); }, mat(ST, D.accCol, mix(D.accCol, '#20202a', 0.25)));
      P(ctx, (ox, oy) => rr(ctx, -H.rx * 0.97 + ox, -6.5 + oy, H.rx * 1.94, 4.6, 2.3), mat(ST, mix(D.accCol, '#ffffff', 0.4), D.accCol));
      P(ctx, El(ctx, (s.tail || 0) * 2, -H.ry * 0.8 - 5, 3.8, 3.4), mat(ST, '#FFFFFF', '#E6DCD8'));
    }
    if (D.acc === 'hood') {
      P(ctx, (ox, oy) => { ctx.beginPath(); ctx.ellipse(ox, -2 + oy, H.rx * 1.08, H.ry * 1.02, 0, Math.PI * 0.92, Math.PI * 2.08); ctx.quadraticCurveTo(H.rx * 0.5 + ox, -H.ry * 0.55 + oy, 0 + ox, -H.ry * 0.6 + oy); ctx.quadraticCurveTo(-H.rx * 0.5 + ox, -H.ry * 0.55 + oy, -H.rx * 1.05 + ox, 1 + oy); ctx.closePath(); }, mat(ST, D.accCol, mix(D.accCol, '#20202a', 0.3)));
    }
    if (D.clip && back < 0.6) { ctx.save(); ctx.translate(-H.rx * 0.6 + fx * 4, -H.ry * 0.6); ctx.rotate(-0.3); if (D.clip === 'star') OC.V.icon(ctx, 'star', 0, 0, 8.5, '#FFD23F'); else if (D.clip === 'leaf') { ctx.fillStyle = '#7CCB5A'; ellipse(ctx, 0, 0, 4.4, 2.2, -0.5); ctx.fill(); } else if (D.clip === 'flower') { for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5; ctx.fillStyle = '#fff'; ellipse(ctx, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 1.7, 1.7); ctx.fill(); } ctx.fillStyle = '#FFC93C'; ellipse(ctx, 0, 0, 1.4, 1.4); ctx.fill(); } ctx.restore(); }
    ctx.restore();
    if (back >= 0.5) tailDraw(ctx, D, ST, s, bodyY);
    if (s.hold === 'leaf') {
      ctx.save(); ctx.translate(4, headY - H.ry - 4); ctx.rotate(-0.12 + Math.sin(t * 2) * 0.03);
      ctx.strokeStyle = '#4FA35A'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, 20); ctx.stroke();
      P(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-24 + ox, 3 + oy); ctx.quadraticCurveTo(-18 + ox, -14 + oy, ox, -14 + oy); ctx.quadraticCurveTo(18 + ox, -14 + oy, 24 + ox, 3 + oy); ctx.quadraticCurveTo(12 + ox, -2 + oy, ox, 2 + oy); ctx.quadraticCurveTo(-12 + ox, -2 + oy, -24 + ox, 3 + oy); ctx.closePath(); }, mat(ST, '#7CCB5A', '#4C9A4A'));
      ctx.restore();
    }
    ctx.restore();
  }

  OC.VC = { draw, face, mouth };
})();
