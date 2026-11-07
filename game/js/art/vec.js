/* Shared vector toolkit for Round-2 schemes (D Windsong / E Sunny Isle / F Quirkville).
 * Shapes, extruded terrain, icon geometry and item art — each theme passes its own
 * materials (shading mode, outline, palette) so the *look* stays scheme-specific.
 */
(function () {
  'use strict';
  const { TAU, clamp, lerp, rr, ellipse, mix, rgba, rng } = OC;

  function blob(ctx, cx, cy, rx, ry, seed, n = 64, wob = 1) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const k = 1 + wob * (0.045 * Math.sin(3 * a + seed) + 0.03 * Math.sin(5 * a + seed * 2.1) + 0.02 * Math.sin(8 * a + seed * 0.7));
      const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  /** Extruded plateau. m = {top:[a,b], cliff:[a,b], strata?:color, rim?:color, outline?:color, lw, wob, steps} */
  function plateau(ctx, cx, cy, rx, ry, seed, h, m) {
    const wob = m.wob ?? 1;
    for (let k = h; k > 0; k -= 1.5) { ctx.fillStyle = mix(m.cliff[0], m.cliff[1], k / h); blob(ctx, cx, cy + k, rx, ry, seed, 64, wob); ctx.fill(); }
    if (m.strata) { ctx.save(); ctx.strokeStyle = m.strata; ctx.lineWidth = 1.1; for (const f of m.strataAt || [0.45]) { blob(ctx, cx, cy + h * f, rx, ry, seed, 64, wob); ctx.stroke(); } ctx.restore(); }
    if (m.outline) { ctx.save(); ctx.strokeStyle = m.outline; ctx.lineWidth = m.lw || 1.4; blob(ctx, cx, cy + h, rx, ry, seed, 64, wob); ctx.stroke(); ctx.restore(); }
    const g = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry); g.addColorStop(0, m.top[0]); g.addColorStop(1, m.top[1]);
    ctx.fillStyle = g; blob(ctx, cx, cy, rx, ry, seed, 64, wob); ctx.fill();
    if (m.rim) { ctx.save(); ctx.strokeStyle = m.rim; ctx.lineWidth = m.rimW || 1.6; blob(ctx, cx, cy + 0.6, rx - 1, ry - 1, seed, 64, wob); ctx.stroke(); ctx.restore(); }
    if (m.outline) { ctx.save(); ctx.strokeStyle = m.outline; ctx.lineWidth = m.lw || 1.4; blob(ctx, cx, cy, rx, ry, seed, 64, wob); ctx.stroke(); ctx.restore(); }
  }
  function shadow(ctx, x, y, rx, ry, a = 0.2, col = '#3a2c30') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.65, rgba(col, a * 0.5)); g.addColorStop(1, rgba(col, 0));
    ctx.save(); ctx.fillStyle = g; ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y); ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill(); ctx.restore();
  }
  /**
   * Paint a closed shape with a scheme material.
   * path(ox, oy) must build the path offset by (ox, oy).
   * mat = { mode:'cel'|'flat'|'gloss', base, shade, hi, outline, lw, dx, dy }
   */
  function paint(ctx, path, mat) {
    const dx = mat.dx ?? 2.2, dy = mat.dy ?? 2.4;
    ctx.save();
    if (mat.mode === 'cel') {
      path(0, 0); ctx.fillStyle = mat.shade; ctx.fill();
      ctx.save(); path(0, 0); ctx.clip(); path(-dx, -dy); ctx.fillStyle = mat.base; ctx.fill();
      if (mat.hi) { path(dx * 0.55, dy * 0.55); ctx.strokeStyle = mat.hi; ctx.lineWidth = 1.1; ctx.stroke(); }
      ctx.restore();
    } else if (mat.mode === 'gloss') {
      path(0, 0); ctx.fillStyle = mat.base; ctx.fill();
      ctx.save(); path(0, 0); ctx.clip();
      path(-dx * 0.9, -dy * 1.1); ctx.lineWidth = 3.5; ctx.strokeStyle = rgba(mat.shade, 0.55); ctx.stroke();
      ctx.restore();
    } else { // flat
      path(0, 0); ctx.fillStyle = mat.base; ctx.fill();
      ctx.save(); path(0, 0); ctx.clip(); path(-dx * 0.6, -dy * 1.4); ctx.lineWidth = 4.5; ctx.strokeStyle = rgba(mat.shade, 0.6); ctx.stroke(); ctx.restore();
    }
    if (mat.outline) { path(0, 0); ctx.strokeStyle = mat.outline; ctx.lineWidth = mat.lw || 1.3; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.restore();
  }

  // ---------- icon geometry (24-unit grid). mode: 'line' | 'bold' ----------
  function icon(ctx, name, x, y, s = 16, col = '#333', lw = 1.9) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const B = () => ctx.beginPath(), S = () => ctx.stroke(), F = () => ctx.fill();
    switch (name) {
      case 'bag': B(); rr(ctx, 4.5, 8, 15, 12.5, 4.5); S(); B(); ctx.moveTo(8.5, 8); ctx.bezierCurveTo(8.5, 2.8, 15.5, 2.8, 15.5, 8); S(); B(); ctx.moveTo(9, 13.5); ctx.quadraticCurveTo(12, 15.5, 15, 13.5); S(); break;
      case 'map': B(); ctx.moveTo(3.5, 6.5); ctx.lineTo(9, 4.5); ctx.lineTo(15, 6.5); ctx.lineTo(20.5, 4.5); ctx.lineTo(20.5, 17.5); ctx.lineTo(15, 19.5); ctx.lineTo(9, 17.5); ctx.lineTo(3.5, 19.5); ctx.closePath(); S(); B(); ctx.moveTo(9, 4.5); ctx.lineTo(9, 17.5); ctx.moveTo(15, 6.5); ctx.lineTo(15, 19.5); S(); break;
      case 'dots': for (const dx of [6, 12, 18]) { B(); ctx.arc(dx, 12, 1.8, 0, TAU); F(); } break;
      case 'coin': B(); ctx.arc(12, 12, 8, 0, TAU); S(); B(); ctx.moveTo(12, 7.5); ctx.lineTo(13.4, 10.6); ctx.lineTo(16.6, 11); ctx.lineTo(14.2, 13.2); ctx.lineTo(14.9, 16.4); ctx.lineTo(12, 14.8); ctx.lineTo(9.1, 16.4); ctx.lineTo(9.8, 13.2); ctx.lineTo(7.4, 11); ctx.lineTo(10.6, 10.6); ctx.closePath(); F(); break;
      case 'sun': B(); ctx.arc(12, 12, 4.2, 0, TAU); S(); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; B(); ctx.moveTo(12 + Math.cos(a) * 7, 12 + Math.sin(a) * 7); ctx.lineTo(12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9); S(); } break;
      case 'moon': B(); ctx.arc(12, 12, 7.5, 0.95, TAU - 0.93, false); ctx.arc(15.6, 9.4, 5.9, TAU - 1.65, 1.67, true); ctx.closePath(); S(); break;
      case 'cloud': B(); ctx.moveTo(7, 17.5); ctx.arc(7.5, 13.5, 4, Math.PI * 0.6, Math.PI * 1.45); ctx.arc(12.5, 10, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.arc(17, 13.8, 3.8, Math.PI * 1.5, Math.PI * 0.45); ctx.closePath(); S(); break;
      case 'rain': B(); ctx.moveTo(7, 15); ctx.arc(7.5, 11.5, 3.5, Math.PI * 0.6, Math.PI * 1.45); ctx.arc(12.5, 8.5, 4.5, Math.PI * 1.1, Math.PI * 1.9); ctx.arc(17, 12, 3.4, Math.PI * 1.5, Math.PI * 0.45); ctx.closePath(); S(); for (const dx of [8, 12, 16]) { B(); ctx.moveTo(dx, 18); ctx.lineTo(dx - 1, 21); S(); } break;
      case 'heart': B(); ctx.moveTo(12, 19.5); ctx.bezierCurveTo(2, 13, 4, 4.5, 12, 8.5); ctx.bezierCurveTo(20, 4.5, 22, 13, 12, 19.5); ctx.closePath(); F(); break;
      case 'heartO': B(); ctx.moveTo(12, 19.5); ctx.bezierCurveTo(2, 13, 4, 4.5, 12, 8.5); ctx.bezierCurveTo(20, 4.5, 22, 13, 12, 19.5); ctx.closePath(); S(); break;
      case 'star': B(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.8 : 8.5; ctx.lineTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r); } ctx.closePath(); F(); break;
      case 'sparkle': B(); ctx.moveTo(12, 3); ctx.quadraticCurveTo(13, 11, 21, 12); ctx.quadraticCurveTo(13, 13, 12, 21); ctx.quadraticCurveTo(11, 13, 3, 12); ctx.quadraticCurveTo(11, 11, 12, 3); F(); break;
      case 'back': B(); ctx.moveTo(14.5, 5.5); ctx.lineTo(8, 12); ctx.lineTo(14.5, 18.5); S(); break;
      case 'next': B(); ctx.moveTo(9.5, 5.5); ctx.lineTo(16, 12); ctx.lineTo(9.5, 18.5); S(); break;
      case 'close': B(); ctx.moveTo(7, 7); ctx.lineTo(17, 17); ctx.moveTo(17, 7); ctx.lineTo(7, 17); S(); break;
      case 'check': B(); ctx.moveTo(6, 12.5); ctx.lineTo(10.2, 16.5); ctx.lineTo(18, 7.5); S(); break;
      case 'plus': B(); ctx.moveTo(12, 6); ctx.lineTo(12, 18); ctx.moveTo(6, 12); ctx.lineTo(18, 12); S(); break;
      case 'play': B(); ctx.moveTo(8.5, 6); ctx.lineTo(18, 12); ctx.lineTo(8.5, 18); ctx.closePath(); F(); break;
      case 'pause': B(); rr(ctx, 7, 6, 3.6, 12, 1.5); F(); B(); rr(ctx, 13.4, 6, 3.6, 12, 1.5); F(); break;
      case 'brush': B(); ctx.moveTo(18.5, 4.5); ctx.lineTo(10, 13); S(); B(); ctx.moveTo(10.5, 12.5); ctx.bezierCurveTo(6, 12, 5, 16, 4.5, 19.5); ctx.bezierCurveTo(9, 19.5, 12, 18, 11.5, 13.5); ctx.closePath(); F(); break;
      case 'eraser': ctx.save(); ctx.translate(12, 12); ctx.rotate(-0.7); B(); rr(ctx, -8, -4.5, 16, 9, 2.5); S(); B(); ctx.moveTo(-1, -4.5); ctx.lineTo(-1, 4.5); S(); ctx.restore(); break;
      case 'onion': B(); ctx.arc(10, 12, 6, 0, TAU); S(); ctx.globalAlpha *= 0.45; B(); ctx.arc(14.5, 12, 6, 0, TAU); S(); break;
      case 'layers': B(); ctx.moveTo(12, 4.5); ctx.lineTo(20, 9); ctx.lineTo(12, 13.5); ctx.lineTo(4, 9); ctx.closePath(); S(); B(); ctx.moveTo(4, 13); ctx.lineTo(12, 17.5); ctx.lineTo(20, 13); S(); break;
      case 'gear': B(); ctx.arc(12, 12, 3, 0, TAU); S(); B(); for (let i = 0; i < 16; i++) { const a = (i * TAU) / 16, r = i % 2 ? 6.2 : 8.4; ctx.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r); } ctx.closePath(); S(); break;
      case 'paw': B(); ctx.ellipse(12, 15, 4.6, 3.8, 0, 0, TAU); F(); for (const [px, py] of [[6.5, 10.5], [9.6, 6.8], [14.4, 6.8], [17.5, 10.5]]) { B(); ctx.arc(px, py, 1.9, 0, TAU); F(); } break;
      case 'home': B(); ctx.moveTo(4.5, 11); ctx.lineTo(12, 4.5); ctx.lineTo(19.5, 11); ctx.moveTo(6.5, 9.5); ctx.lineTo(6.5, 19); ctx.lineTo(17.5, 19); ctx.lineTo(17.5, 9.5); S(); break;
      case 'leaf': B(); ctx.moveTo(5, 19); ctx.bezierCurveTo(4, 9, 11, 4, 20, 4.5); ctx.bezierCurveTo(20, 13, 14, 20, 5, 19); ctx.closePath(); S(); B(); ctx.moveTo(5, 19); ctx.lineTo(14, 10); S(); break;
      case 'face': B(); ctx.arc(12, 12, 8, 0, TAU); S(); B(); ctx.arc(9, 11, 1.1, 0, TAU); ctx.arc(15, 11, 1.1, 0, TAU); F(); B(); ctx.arc(12, 13.5, 2.5, 0.2, Math.PI - 0.2); S(); break;
      case 'shirt': B(); ctx.moveTo(8.5, 4.5); ctx.lineTo(4, 8); ctx.lineTo(6.5, 11.5); ctx.lineTo(7.5, 10.5); ctx.lineTo(7.5, 19.5); ctx.lineTo(16.5, 19.5); ctx.lineTo(16.5, 10.5); ctx.lineTo(17.5, 11.5); ctx.lineTo(20, 8); ctx.lineTo(15.5, 4.5); ctx.quadraticCurveTo(12, 7.5, 8.5, 4.5); S(); break;
      case 'pin': B(); ctx.moveTo(12, 20.5); ctx.bezierCurveTo(5, 13, 5.5, 4, 12, 4); ctx.bezierCurveTo(18.5, 4, 19, 13, 12, 20.5); ctx.closePath(); S(); B(); ctx.arc(12, 10.5, 2.3, 0, TAU); S(); break;
      case 'clock': B(); ctx.arc(12, 12, 8, 0, TAU); S(); B(); ctx.moveTo(12, 7.5); ctx.lineTo(12, 12); ctx.lineTo(15, 14); S(); break;
      case 'walk': B(); ctx.arc(13, 5.5, 2, 0, TAU); F(); B(); ctx.moveTo(12, 9); ctx.lineTo(10.5, 14); ctx.lineTo(13, 16); ctx.lineTo(12.5, 20); ctx.moveTo(10.5, 14); ctx.lineTo(8, 19.5); ctx.moveTo(11.5, 10); ctx.lineTo(8, 12.5); ctx.moveTo(12.3, 10.5); ctx.lineTo(16, 12.5); S(); break;
      case 'chat': B(); rr(ctx, 4, 5, 16, 11.5, 5); S(); B(); ctx.moveTo(9, 16.5); ctx.lineTo(7.5, 20); ctx.lineTo(12.5, 16.5); S(); break;
      case 'phone': B(); rr(ctx, 6.5, 3, 11, 18, 3); S(); B(); ctx.arc(12, 17.5, 1, 0, TAU); F(); break;
      case 'compass': B(); ctx.arc(12, 12, 8.5, 0, TAU); S(); B(); ctx.moveTo(12, 5.5); ctx.lineTo(14, 12); ctx.lineTo(12, 18.5); ctx.lineTo(10, 12); ctx.closePath(); F(); break;
      case 'fire': B(); ctx.moveTo(12, 3.5); ctx.bezierCurveTo(16, 8, 19, 11, 17.5, 15.5); ctx.bezierCurveTo(16.5, 19, 13.5, 20.5, 12, 20.5); ctx.bezierCurveTo(8, 20.5, 5.5, 17.5, 6.5, 13.5); ctx.bezierCurveTo(7, 11, 9, 10, 9, 7.5); ctx.bezierCurveTo(10.5, 9, 11, 10.5, 11, 12); ctx.bezierCurveTo(12.5, 10, 12.5, 7, 12, 3.5); F(); break;
      case 'camera': B(); rr(ctx, 3.5, 7, 17, 12, 3); S(); B(); ctx.arc(12, 13, 3.4, 0, TAU); S(); B(); ctx.moveTo(8.5, 7); ctx.lineTo(10, 4.5); ctx.lineTo(14, 4.5); ctx.lineTo(15.5, 7); S(); break;
      case 'dice': B(); rr(ctx, 4.5, 4.5, 15, 15, 4); S(); for (const [px, py] of [[8.5, 8.5], [15.5, 15.5], [12, 12], [15.5, 8.5], [8.5, 15.5]]) { B(); ctx.arc(px, py, 1.3, 0, TAU); F(); } break;
      case 'tv': B(); rr(ctx, 3.5, 6.5, 17, 12, 3); S(); B(); ctx.moveTo(9, 3); ctx.lineTo(12, 6.5); ctx.lineTo(15, 3); S(); break;
      case 'gift': B(); rr(ctx, 4.5, 10, 15, 10, 2); S(); B(); rr(ctx, 3.5, 7, 17, 4, 1.5); S(); B(); ctx.moveTo(12, 7); ctx.lineTo(12, 20); S(); B(); ctx.moveTo(12, 7); ctx.bezierCurveTo(9, 2, 5, 5, 12, 7); ctx.bezierCurveTo(19, 5, 15, 2, 12, 7); S(); break;
      case 'cart': B(); ctx.moveTo(3, 5); ctx.lineTo(6, 5); ctx.lineTo(8.5, 15); ctx.lineTo(18, 15); ctx.lineTo(20, 8); ctx.lineTo(7, 8); S(); B(); ctx.arc(9.5, 18.5, 1.5, 0, TAU); ctx.arc(16.5, 18.5, 1.5, 0, TAU); F(); break;
      case 'music': B(); ctx.moveTo(9, 17); ctx.lineTo(9, 5.5); ctx.lineTo(18, 4); ctx.lineTo(18, 15.5); S(); B(); ctx.ellipse(7, 17, 2.5, 2, 0, 0, TAU); ctx.ellipse(16, 15.5, 2.5, 2, 0, 0, TAU); F(); break;
      case 'film': B(); rr(ctx, 4, 5, 16, 14, 3); S(); for (const yy of [8, 12, 16]) { B(); ctx.arc(7, yy, 0.9, 0, TAU); ctx.arc(17, yy, 0.9, 0, TAU); F(); } break;
      case 'person': B(); ctx.arc(12, 8, 3.6, 0, TAU); S(); B(); ctx.moveTo(5, 20); ctx.bezierCurveTo(5, 13.5, 19, 13.5, 19, 20); S(); break;
      default: B(); ctx.arc(12, 12, 6, 0, TAU); S();
    }
    ctx.restore();
  }

  // ---------- item art (24-unit). st = { mode, outline, lw } ----------
  function item(ctx, id, x, y, s = 24, st = {}) {
    OC.V._ctx = ctx;
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12);
    const M = (base, shade) => Object.assign({ mode: st.mode || 'flat', base, shade: shade || mix(base, '#3a2030', 0.25), outline: st.outline, lw: st.lw || 1.1, dx: 1.2, dy: 1.4 }, st.hi ? { hi: st.hi } : {});
    const El = (cx, cy, rx, ry, base, shade) => paint(ctx, (ox, oy) => ellipse(ctx, cx + ox, cy + oy, rx, ry), M(base, shade));
    const Rr = (x0, y0, w, h, r, base, shade) => paint(ctx, (ox, oy) => rr(ctx, x0 + ox, y0 + oy, w, h, r), M(base, shade));
    const Pl = (pts, base, shade) => paint(ctx, (ox, oy) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0] + ox, p[1] + oy) : ctx.moveTo(p[0] + ox, p[1] + oy))); ctx.closePath(); }, M(base, shade));
    if (!st.noShadow) shadow(ctx, 12, 20.8, 8, 2.2, 0.2);
    switch (id) {
      case 'cake': Rr(4.5, 10, 15, 10, 3, '#F6D2AE'); Rr(4.5, 8.5, 15, 5, 2.5, '#FFF8F0'); El(12, 6.6, 3, 3, '#F0455A'); El(12, 3.8, 1.8, 0.9, '#5FBF62'); break;
      case 'apple': El(12, 13, 7, 6.6, '#EE4B4B'); ctx.strokeStyle = st.outline || '#8a5a3c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(12, 7.5); ctx.lineTo(12.6, 4.5); ctx.stroke(); El(15.2, 5.6, 2.6, 1.3, '#5FBF62'); break;
      case 'milk': Rr(7.5, 7, 9, 13, 3, '#FFFFFF', '#C9D6E6'); Rr(7.5, 12, 9, 4.5, 1, '#5DA9E9'); Rr(8.5, 4, 7, 3.5, 1.5, '#F07B5A'); break;
      case 'flower': ctx.strokeStyle = '#4FA35A'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(12, 20); ctx.quadraticCurveTo(11, 15, 12, 11); ctx.stroke(); for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5 - 1.57; El(12 + Math.cos(a) * 3.6, 9 + Math.sin(a) * 3.6, 2.6, 2.6, '#FFFFFF', '#E9D9E6'); } El(12, 9, 2.2, 2.2, '#FFC93C'); break;
      case 'fish': Pl([[3, 12], [8, 8.5], [15, 9], [18, 12], [15, 15], [8, 15.5]], '#7FB8E8'); Pl([[17, 12], [21, 8.5], [21, 15.5]], '#5C98D0'); El(7, 11.2, 0.8, 0.8, '#2b2b2b'); break;
      case 'star': { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.8 : 8.5; p.push([12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r]); } Pl(p, '#FFD23F'); break; }
      case 'shell': Pl([[4, 16], [6, 8], [12, 5], [18, 8], [20, 16], [12, 19]], '#FFB3A7'); break;
      case 'seed': El(12, 13, 6, 7, '#E8C38A'); El(12, 5.5, 2.4, 1.2, '#5FBF62'); break;
      case 'lamp': Rr(10.5, 11, 3, 8, 1.5, '#FFF3E0'); El(12, 9.5, 8, 5.5, '#F06A5A'); El(9, 7.6, 1.3, 1.1, '#FFFFFF'); El(14.5, 6.8, 1.1, 0.9, '#FFFFFF'); El(12, 19.6, 4, 1.3, '#C98E5A'); break;
      case 'cushion': El(12, 13, 9, 5.8, '#B9A7F0'); El(7.5, 10.5, 3.6, 3.2, '#D6CBF7'); El(16, 10, 4.2, 3.4, '#D6CBF7'); break;
      case 'plant': for (const a of [-0.8, -0.2, 0.4, 1]) { ctx.save(); ctx.translate(12, 11); ctx.rotate(a); El(0, -4.5, 2.4, 4.8, '#5FBF62'); ctx.restore(); } Pl([[7, 12], [17, 12], [15.5, 20], [8.5, 20]], '#E2895A'); break;
      case 'rug': El(12, 14, 10, 5, '#FFC93C'); El(12, 15, 3, 2, '#F06A5A'); break;
      default: El(12, 12, 7, 7, '#ddd');
    }
    ctx.restore();
  }

  OC.V = { blob, plateau, shadow, paint, icon, item, _ctx: null };
})();
