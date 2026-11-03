/* Scheme A — Mallow Mist : character rig
 * Mochi-round chibi creatures. Every part is a separate layer so the same data can
 * later be exported as an editable part-sheet (see docs/asset-format.md).
 * Local space: origin at feet, 1 unit = 1dp at scale 1, total height ~ 50.
 * State (all optional):
 *   face -1..1 (turn L/R)  back 0..1 (rear view)  walk 0..1 (blend)  phase (steps)
 *   breath -1..1  blink 0..1  eyes/brows/mouth/cheeks (style ids)  ear (rad offset)
 *   earL/earR (extra rad)  tail (rad)  squash (y-scale)  lift (px)  tilt (rad)
 *   armL/armR (rad)  lookY  blush 0..1  hold (item id held overhead)
 */
(function () {
  'use strict';
  const { TAU, clamp, lerp, ellipse, rr, mix, rgba } = OC;
  const { P, softShadow } = OC.M;

  const DESIGNS = {
    mochi: { fur: '#FFF6EC', shade: '#F1DCCB', inner: '#F8C4C0', cheek: '#F7A39A', eye: '#4F3A47', muzzle: '#FFFFFF', ears: 'cat', acc: 'scarf', accCol: '#F5A893', clip: 'star', tail: 'cat' },
    kuri: { fur: '#EDC39D', shade: '#D9A47E', inner: '#F6D2BE', cheek: '#F09C88', eye: '#4B3540', muzzle: '#FFF1E2', ears: 'bunny', acc: 'scarf', accCol: '#A9D8B8', clip: 'leaf', tail: 'puff' },
    sora: { fur: '#CFD0F2', shade: '#AEAFE0', inner: '#F1CBE0', cheek: '#EFA6C6', eye: '#45405F', muzzle: '#F2F1FF', ears: 'bear', acc: 'beanie', accCol: '#F4BFCB', clip: null, tail: 'puff' },
  };

  function g2(ctx, x0, y0, x1, y1, a, b) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function rad(ctx, cx, cy, r, a, b, ox = -0.35, oy = -0.45) { const g = ctx.createRadialGradient(cx + r * ox, cy + r * oy, r * 0.05, cx, cy, r * 1.15); g.addColorStop(0, a); g.addColorStop(1, b); return g; }

  function drawEar(ctx, D, type, side, s, hx, hy) {
    // side: -1 left, +1 right (screen). Ear pivots at head top, rotates by s.ear + per side.
    const fx = s.face || 0;
    const extra = side < 0 ? (s.earL || 0) : (s.earR || 0);
    const baseX = hx + side * 9.5 + fx * 4.2 - (side * fx > 0 ? side * 1.5 : 0);
    const baseY = hy - 9.5;
    const ang = side * (0.32 + (s.ear || 0)) + extra * side;
    ctx.save(); ctx.translate(baseX, baseY); ctx.rotate(ang);
    const sc = 1 - Math.max(0, side * fx) * 0.18;
    ctx.scale(sc, 1);
    const fur = D.fur, shade = D.shade, inner = D.inner;
    if (type === 'cat') {
      ctx.beginPath(); ctx.moveTo(-7, 3); ctx.quadraticCurveTo(-5.5, -9, -0.5, -13.5); ctx.quadraticCurveTo(5.5, -8, 7, 3); ctx.closePath();
      ctx.fillStyle = g2(ctx, 0, -13, 0, 3, mix(fur, '#ffffff', 0.3), shade); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-3.6, 1); ctx.quadraticCurveTo(-3, -6.5, -0.6, -9.5); ctx.quadraticCurveTo(2.8, -5.5, 3.6, 1); ctx.closePath();
      ctx.fillStyle = g2(ctx, 0, -9, 0, 2, inner, mix(inner, fur, 0.4)); ctx.fill();
    } else if (type === 'bunny') {
      ctx.rotate(side * 0.18);
      ctx.beginPath(); ctx.ellipse(0, -11, 5, 13.5, 0, 0, TAU);
      ctx.fillStyle = g2(ctx, 0, -24, 0, 2, mix(fur, '#ffffff', 0.25), shade); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -10.5, 2.4, 10, 0, 0, TAU); ctx.fillStyle = inner; ctx.fill();
    } else if (type === 'bear') {
      ctx.beginPath(); ctx.arc(0, -3, 6, 0, TAU); ctx.fillStyle = rad(ctx, 0, -3, 6, mix(fur, '#fff', 0.3), shade); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -2.5, 3.2, 0, TAU); ctx.fillStyle = inner; ctx.fill();
    } else if (type === 'fold') {
      ctx.beginPath(); ctx.moveTo(-6.5, 3); ctx.quadraticCurveTo(-5, -6, 0, -8); ctx.quadraticCurveTo(7, -7, 5, 2); ctx.closePath();
      ctx.fillStyle = g2(ctx, 0, -8, 0, 3, mix(fur, '#fff', 0.2), shade); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-1, -7.5); ctx.quadraticCurveTo(6, -6.5, 6.5, 0); ctx.quadraticCurveTo(2, -1, -1, -7.5); ctx.fillStyle = mix(shade, '#000', 0.04); ctx.fill();
    } else if (type === 'sprout') {
      ctx.rotate(-ang * 0.6);
      if (side > 0) { ctx.restore(); return; }
      ctx.translate(-side * 9, 0);
      ctx.strokeStyle = '#8FCA8D'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(0, -4, 0.5, -7); ctx.stroke();
      ctx.fillStyle = '#A9D898'; ellipse(ctx, -4.2, -8, 4.6, 2.4, 0.35); ctx.fill(); ellipse(ctx, 4.8, -9, 4.6, 2.4, -0.35); ctx.fill();
    }
    ctx.restore();
  }

  function drawEyes(ctx, D, s, hx, hy, style) {
    const fx = s.face || 0;
    const blink = clamp(s.blink || 0);
    for (const side of [-1, 1]) {
      const near = side * fx > 0;
      const ex = hx + side * 7.2 * (1 - 0.22 * Math.abs(fx)) + fx * 6.5;
      const ey = hy + 1.5 + (s.lookY || 0);
      const wsc = near ? 1 - 0.42 * Math.abs(fx) : 1;
      ctx.save(); ctx.translate(ex, ey); ctx.scale(wsc, 1);
      ctx.fillStyle = D.eye; ctx.strokeStyle = D.eye; ctx.lineCap = 'round'; ctx.lineWidth = 1.7;
      const open = 1 - blink;
      if (style === 'happy' || (open < 0.2 && style !== 'sleepy')) {
        ctx.beginPath();
        if (style === 'happy') { ctx.moveTo(-3.2, 1.2); ctx.quadraticCurveTo(0, -3.2, 3.2, 1.2); }
        else { ctx.moveTo(-3, 0.6); ctx.quadraticCurveTo(0, 2.2, 3, 0.6); }
        ctx.stroke();
      } else if (style === 'sleepy') {
        const h = 2.6 * Math.max(0.15, open);
        ctx.beginPath(); ctx.ellipse(0, 0.8, 3.3, h, 0, 0, Math.PI); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-3.8, 0.6); ctx.lineTo(3.8, 0.6); ctx.stroke();
        if (open > 0.3) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ellipse(ctx, -1, 1.6, 0.8, 0.7); ctx.fill(); }
      } else if (style === 'dot') {
        ellipse(ctx, 0, 0, 2.2, 2.4 * open); ctx.fill();
      } else {
        // round / sparkle / wide
        const big = style === 'wide' ? 1.2 : 1;
        ellipse(ctx, 0, 0, 3.4 * big, 4.2 * open * big); ctx.fill();
        if (open > 0.35) {
          ctx.fillStyle = 'rgba(255,255,255,.95)';
          if (style === 'sparkle') {
            ctx.beginPath(); const r1 = 2.0, r2 = 0.5; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2; const r = i % 2 ? r2 : r1; ctx.lineTo(-0.6 + Math.cos(a) * r, -1.1 * open + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
            ellipse(ctx, 1.4, 1.8 * open, 0.6, 0.6); ctx.fill();
          } else {
            ellipse(ctx, -1.1, -1.5 * open, 1.35, 1.35 * open); ctx.fill();
            ellipse(ctx, 1.3, 1.5 * open, 0.6, 0.6 * open); ctx.fill();
          }
          // soft lower-lid tint
          ctx.fillStyle = rgba(D.cheek, 0.25); ellipse(ctx, 0, 3.3 * open, 2.8, 0.9); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  function drawBrows(ctx, D, s, hx, hy, style) {
    if (!style || style === 'none') return;
    const fx = s.face || 0;
    ctx.save(); ctx.strokeStyle = rgba(D.eye, 0.75); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const bx = hx + side * 7.4 * (1 - 0.22 * Math.abs(fx)) + fx * 6.5, by = hy - 5.6 + (s.lookY || 0) * 0.5;
      ctx.beginPath();
      if (style === 'soft') { ctx.moveTo(bx - 2.2, by + 0.3); ctx.quadraticCurveTo(bx, by - 0.9, bx + 2.2, by + 0.3); }
      else if (style === 'up') { ctx.moveTo(bx - 2.2, by - 0.4); ctx.quadraticCurveTo(bx, by - 2.2, bx + 2.2, by - 0.4); }
      else if (style === 'worry') { ctx.moveTo(bx - 2.2 * side, by - 1); ctx.lineTo(bx + 2.2 * side, by + 0.6); }
      else if (style === 'dot') { ctx.arc(bx, by, 0.9, 0, TAU); ctx.fillStyle = rgba(D.eye, 0.7); ctx.fill(); continue; }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMouth(ctx, D, s, hx, hy, style, t) {
    const fx = s.face || 0;
    const mx = hx + fx * 7.6, my = hy + 6.6;
    ctx.save(); ctx.strokeStyle = D.eye; ctx.fillStyle = D.eye; ctx.lineWidth = 1.25; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // tiny nose
    ctx.fillStyle = mix(D.cheek, D.eye, 0.25); ellipse(ctx, mx, my - 2.2, 0.9, 0.6); ctx.fill(); ctx.fillStyle = D.eye;
    switch (style) {
      case 'smile': ctx.beginPath(); ctx.moveTo(mx - 2.6, my - 0.3); ctx.quadraticCurveTo(mx, my + 2.6, mx + 2.6, my - 0.3); ctx.stroke(); break;
      case 'o': ctx.beginPath(); ctx.ellipse(mx, my + 0.6, 1.4, 1.8, 0, 0, TAU); ctx.fill(); break;
      case 'open': ctx.beginPath(); ctx.moveTo(mx - 3, my - 0.4); ctx.quadraticCurveTo(mx, my + 5, mx + 3, my - 0.4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#F59AA2'; ellipse(ctx, mx, my + 2.2, 1.6, 0.9); ctx.fill(); break;
      case 'flat': ctx.beginPath(); ctx.moveTo(mx - 1.8, my + 0.4); ctx.lineTo(mx + 1.8, my + 0.4); ctx.stroke(); break;
      case 'tongue': ctx.beginPath(); ctx.moveTo(mx - 2.6, my); ctx.quadraticCurveTo(mx - 1.3, my + 1.3, mx, my); ctx.quadraticCurveTo(mx + 1.3, my + 1.3, mx + 2.6, my); ctx.stroke(); ctx.fillStyle = '#F59AA2'; ellipse(ctx, mx + 0.4, my + 1.9, 1.2, 1.3); ctx.fill(); break;
      case 'chew': { const c = Math.abs(Math.sin((t || 0) * 14)); ctx.beginPath(); ctx.ellipse(mx, my + 0.5, 1.8, 0.4 + c * 1.4, 0, 0, TAU); ctx.fill(); break; }
      case 'wave': ctx.beginPath(); ctx.moveTo(mx - 3, my); for (let i = 0; i <= 6; i++) ctx.lineTo(mx - 3 + i, my + (i % 2 ? 0.9 : -0.2)); ctx.stroke(); break;
      default: // 'cat' ω
        ctx.beginPath(); ctx.moveTo(mx - 2.8, my - 0.2); ctx.quadraticCurveTo(mx - 1.4, my + 1.7, mx, my - 0.1); ctx.quadraticCurveTo(mx + 1.4, my + 1.7, mx + 2.8, my - 0.2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawCheeks(ctx, D, s, hx, hy, style) {
    const fx = s.face || 0, a = clamp(0.5 + (s.blush || 0) * 0.5);
    for (const side of [-1, 1]) {
      const near = side * fx > 0;
      const cx = hx + side * 11 * (1 - 0.25 * Math.abs(fx)) + fx * 5.5, cy = hy + 5.2;
      const w = near ? 1 - 0.45 * Math.abs(fx) : 1;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(w, 1);
      if (style === 'heart') { ctx.fillStyle = rgba(D.cheek, 0.8); OC.M.icon(ctx, 'heart', 0, 0, 6, rgba(D.cheek, 0.85)); }
      else if (style === 'swirl') { ctx.strokeStyle = rgba(D.cheek, 0.85); ctx.lineWidth = 0.9; ctx.beginPath(); for (let i = 0; i < 30; i++) { const a2 = i * 0.42, r = i * 0.09; ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); } ctx.stroke(); }
      else if (style === 'lines') { ctx.strokeStyle = rgba(D.cheek, 0.9); ctx.lineWidth = 0.9; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 1.6 - 0.6, 1); ctx.lineTo(i * 1.6 + 0.6, -1); ctx.stroke(); } }
      else if (style !== 'none') {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 3.6);
        g.addColorStop(0, rgba(D.cheek, 0.75 * a)); g.addColorStop(1, rgba(D.cheek, 0));
        ctx.fillStyle = g; ellipse(ctx, 0, 0, 3.8, 2.6); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawTail(ctx, D, s, bodyY) {
    const fx = s.face || 0, back = s.back || 0;
    const side = fx > 0.15 ? -1 : fx < -0.15 ? 1 : 1;
    const wag = s.tail || 0;
    ctx.save();
    ctx.translate(side * 7, bodyY + 4);
    ctx.rotate(side * (0.5 + wag));
    if (D.tail === 'puff') {
      ctx.fillStyle = rad(ctx, 0, -5, 5, mix(D.fur, '#fff', 0.35), D.shade); ellipse(ctx, side * 2, -4, 5, 4.6); ctx.fill();
    } else {
      ctx.strokeStyle = D.fur; ctx.lineCap = 'round'; ctx.lineWidth = 4.4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(side * 6, -2, side * 9, -9, side * 6 + wag * 4, -15); ctx.stroke();
      ctx.strokeStyle = D.shade; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(side * 1, 1.5); ctx.bezierCurveTo(side * 7, 0, side * 10.5, -8, side * 7.5 + wag * 4, -14); ctx.stroke();
    }
    ctx.restore();
  }

  /** Main draw. x,y = feet on screen; sc = scale. t = time for micro motion. */
  function draw(ctx, D, s, x, y, sc = 1, t = 0) {
    if (typeof D === 'string') D = DESIGNS[D];
    const fx = s.face || 0, back = s.back || 0, walk = s.walk || 0, ph = s.phase || 0;
    const br = s.breath || 0, lift = s.lift || 0, sq = s.squash || 1;
    const stepS = Math.sin(ph * Math.PI);
    const bob = walk * Math.abs(stepS) * 2.2;
    ctx.save();
    ctx.translate(x, y); ctx.scale(sc, sc);
    // contact shadow shrinks as character lifts
    if (!s.noShadow) softShadow(ctx, 0, 0.5, 15 * (1 - clamp(lift / 50) * 0.5), 4.2, 0.2 * (1 - clamp(lift / 60) * 0.6));
    ctx.translate(0, -lift);
    ctx.rotate(s.lean || 0);
    ctx.scale(1 / Math.sqrt(sq), sq);

    const bodyY = -10 - bob * 0.6 + br * 0.15;
    const headY = -31 - bob + br * 0.55 + (s.headDy || 0);
    const hx = fx * 1.4 + (s.headDx || 0);

    // tail (behind unless rear view)
    if (back < 0.5) drawTail(ctx, D, s, bodyY);

    // legs
    for (const side of [-1, 1]) {
      const swing = walk * stepS * side;
      const lx = side * 4.6 * (1 - 0.45 * Math.abs(fx)) + fx * swing * 3.2;
      const ly = -2.2 - Math.max(0, walk * stepS * -side) * 2.4;
      ctx.fillStyle = g2(ctx, 0, ly - 4, 0, ly + 3, D.fur, D.shade);
      rr(ctx, lx - 3, ly - 4, 6, 6.6, 3); ctx.fill();
    }
    // body
    ctx.save(); ctx.translate(0, bodyY);
    const bw = 10.6 * (1 + br * 0.018), bh = 9.4 * (1 + br * 0.03);
    ctx.fillStyle = rad(ctx, 0, 0, 11, mix(D.fur, '#ffffff', 0.45), D.shade, -0.3, -0.5);
    ellipse(ctx, 0, 0, bw, bh); ctx.fill();
    if (back < 0.5) { ctx.fillStyle = rgba(D.muzzle, 0.85); ellipse(ctx, fx * 3, 2, 6 * (1 - Math.abs(fx) * 0.3), 5.5); ctx.fill(); }
    ctx.restore();

    // arms
    for (const side of [-1, 1]) {
      const sw = (side < 0 ? s.armL : s.armR) ?? walk * stepS * side * 0.6;
      ctx.save(); ctx.translate(side * 9.2 * (1 - 0.3 * Math.abs(fx)), bodyY - 3); ctx.rotate(side * 0.35 + sw * side);
      ctx.fillStyle = g2(ctx, 0, -2, 0, 7, D.fur, D.shade); ellipse(ctx, 0, 3.6, 2.9, 4.4); ctx.fill();
      ctx.restore();
    }

    // accessory: scarf
    if (D.acc === 'scarf' && back < 0.9) {
      ctx.save(); ctx.translate(0, bodyY - 7.2);
      ctx.fillStyle = g2(ctx, 0, -2, 0, 3, mix(D.accCol, '#fff', 0.25), D.accCol);
      rr(ctx, -9.5, -2.3, 19, 4.8, 2.4); ctx.fill();
      const kx = fx * 5 + 3.5 * (fx >= 0 ? 1 : -1);
      ctx.save(); ctx.translate(kx, 1.5); ctx.rotate(0.25 + (s.scarf || 0) + walk * Math.sin(ph * Math.PI * 2 + 1) * 0.12);
      ctx.fillStyle = D.accCol; rr(ctx, -2, 0, 4.2, 7, 2); ctx.fill(); ctx.restore();
      ctx.restore();
    }

    // head group
    ctx.save(); ctx.translate(hx, headY); ctx.rotate(s.tilt || 0);
    const ears = s.ears || D.ears;
    // ears behind head
    drawEar(ctx, D, ears, -1, s, 0, 0); drawEar(ctx, D, ears, 1, s, 0, 0);
    const hrx = 17.2 * (1 + br * 0.006), hry = 14.6;
    ctx.fillStyle = rad(ctx, 0, 0, 17, mix(D.fur, '#ffffff', 0.55), D.shade, -0.32 + fx * 0.15, -0.55);
    ellipse(ctx, 0, 0, hrx, hry); ctx.fill();
    // warm rim light (bottom-right)
    ctx.save(); ellipse(ctx, 0, 0, hrx, hry); ctx.clip();
    ctx.strokeStyle = 'rgba(255,214,190,0.45)'; ctx.lineWidth = 2; ellipse(ctx, -1.2, -1.4, hrx, hry); ctx.stroke();
    ctx.restore();

    const fa = 1 - clamp(back * 1.6);
    if (fa > 0) {
      ctx.save(); ctx.globalAlpha *= fa;
      drawCheeks(ctx, D, s, 0, 0, s.cheeks || 'blush');
      drawEyes(ctx, D, s, 0, 0, s.eyes || 'round');
      drawBrows(ctx, D, s, 0, 0, s.brows);
      drawMouth(ctx, D, s, 0, 0, s.mouth || 'cat', t);
      ctx.restore();
    }
    if (back > 0.4) { // back-of-head tuft
      ctx.globalAlpha = clamp((back - 0.4) * 2);
      ctx.fillStyle = D.shade; ellipse(ctx, 0, -11, 3, 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    // hair clip / hat
    if (D.acc === 'beanie') {
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, -4.5, 16.2, 11.5, 0, Math.PI, TAU); ctx.closePath();
      ctx.fillStyle = g2(ctx, 0, -16, 0, -4, mix(D.accCol, '#fff', 0.3), D.accCol); ctx.fill();
      ctx.fillStyle = mix(D.accCol, '#fff', 0.45); rr(ctx, -16.5, -6.5, 33, 4.6, 2.3); ctx.fill();
      ctx.fillStyle = '#FFF8F2'; ellipse(ctx, 0 + (s.tail || 0) * 2, -17.5, 4, 3.6); ctx.fill();
      ctx.restore();
    }
    const clip = s.clip !== undefined ? s.clip : D.clip;
    if (clip && back < 0.6) {
      ctx.save(); ctx.translate(-10 + fx * 4, -9); ctx.rotate(-0.3);
      if (clip === 'star') OC.M.icon(ctx, 'star', 0, 0, 8.5, '#FBD87E');
      else if (clip === 'leaf') { ctx.fillStyle = '#A9D898'; ellipse(ctx, 0, 0, 4.4, 2.2, -0.5); ctx.fill(); ctx.fillStyle = '#8FCA8D'; ellipse(ctx, 3, 1.8, 3, 1.6, 0.4); ctx.fill(); }
      else if (clip === 'flower') { for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5; ctx.fillStyle = '#fff'; ellipse(ctx, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 1.7, 1.7); ctx.fill(); } ctx.fillStyle = '#FBD87E'; ellipse(ctx, 0, 0, 1.4, 1.4); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore(); // head

    if (back >= 0.5) drawTail(ctx, D, s, bodyY);

    // held item overhead (e.g. leaf umbrella)
    if (s.hold === 'leaf') {
      ctx.save(); ctx.translate(4, headY - 18); ctx.rotate(-0.12 + Math.sin(t * 2) * 0.03);
      ctx.strokeStyle = '#8FBF7E'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, 20); ctx.stroke();
      ctx.fillStyle = g2(ctx, 0, -10, 0, 4, '#C6E9AE', '#86C285');
      ctx.beginPath(); ctx.moveTo(-24, 3); ctx.quadraticCurveTo(-18, -14, 0, -14); ctx.quadraticCurveTo(18, -14, 24, 3); ctx.quadraticCurveTo(12, -2, 0, 2); ctx.quadraticCurveTo(-12, -2, -24, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(0, -13); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /** Emote bubble above a character (screen space). kind: '!','♥','♪','?','zzz','…' ; p: 0..1 life */
  function emote(ctx, kind, x, y, p, sc = 1) {
    if (p <= 0 || p >= 1) return;
    const a = OC.clamp(p / 0.15) * OC.clamp((1 - p) / 0.2);
    const pop = OC.E.outBack(OC.clamp(p / 0.25), 1.6);
    ctx.save(); ctx.translate(x, y - pop * 4); ctx.scale(sc * (0.6 + pop * 0.4), sc * (0.6 + pop * 0.4)); ctx.globalAlpha *= a;
    if (kind === '♥') {
      for (let i = 0; i < 3; i++) { const q = OC.clamp(p * 1.4 - i * 0.18); if (q <= 0) continue; OC.M.icon(ctx, 'heart', (i - 1) * 7 + Math.sin(q * 6 + i) * 2, -q * 16, 8 - i, i === 1 ? P.berry : P.rose); }
    } else if (kind === 'zzz') {
      for (let i = 0; i < 3; i++) { const q = (p * 1.6 + i * 0.33) % 1; OC.text(ctx, 'z', i * 4 + q * 6, -q * 14, { font: OC.M.FONT(600, 6 + i * 1.5), color: P.lav, alpha: Math.sin(q * Math.PI) }); }
    } else {
      OC.M.frost(ctx, -8, -18, 16, 15, 7.5);
      ctx.beginPath(); ctx.moveTo(-2.5, -3.5); ctx.lineTo(0, 1); ctx.lineTo(2.5, -3.5); ctx.fillStyle = 'rgba(255,251,247,.94)'; ctx.fill();
      OC.text(ctx, kind, 0, -10, { font: OC.M.FONT(700, 10), color: kind === '!' ? P.coral : P.ink, align: 'center', base: 'middle' });
    }
    ctx.restore();
  }

  OC.M.CHAR = { DESIGNS, draw, emote };
})();
