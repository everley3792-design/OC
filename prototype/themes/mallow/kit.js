/* Scheme A — 棉霧島 Mallow Mist : design kit (tokens, type, icons, item art, UI parts)
 * Language: soft-matte "marshmallow clay". No outlines; volume from gentle gradients,
 * contact shadows and a warm rim light. UI = tiny frosted-cream pills that float.
 */
(function () {
  'use strict';
  const { rr, ellipse, TAU, clamp, lerp, rgba, mix, E } = OC;

  const P = {
    paper: '#FFF8F2', mist: '#F7EFF4', cream: '#FFFDF9', card: '#FFFBF7',
    ink: '#6E5A64', ink2: '#9C8892', ink3: '#C9B9C0', line: '#EFE2E6',
    peach: '#F5A893', coral: '#EC8C78', peachSoft: '#FBD9CC',
    lav: '#C7B6EA', lavSoft: '#E9E1F8', sky: '#BEDDF3', mint: '#BFE4CF', mintDeep: '#8FCAA9',
    butter: '#FBE3A0', rose: '#F6C2CC', berry: '#E87E93',
    grass: '#BFE1A4', grassHi: '#D8EFC2', grassLo: '#A2CF8C',
    earth: '#EED4BD', earthLo: '#D9B49B', earthDeep: '#C79C86', sand: '#F8E7CF',
    water: '#ABDAEC', waterDeep: '#8EC6E0', foam: '#EEF9FC',
    leaf: '#A9D898', leafLo: '#86C285', leafHi: '#D2EDB9', trunk: '#CDA58C',
    night: '#7C83C2', gold: '#FFDCB8',
  };

  const FONT = (w, s) => `${w} ${s}px Fredoka, Huninn`;
  const ZH = (s) => `${s}px Huninn, Fredoka`;

  // ------- soft shadow helper (no blur filters: cheap on mobile) -------
  function softShadow(ctx, x, y, rx, ry, a = 0.16, col = '#7a5c6a') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.6, rgba(col, a * 0.55)); g.addColorStop(1, rgba(col, 0));
    ctx.save(); ctx.fillStyle = g; ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
    ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill(); ctx.restore();
  }
  /** Frosted pill / card with layered ambient shadow. */
  function frost(ctx, x, y, w, h, r, opt = {}) {
    ctx.save();
    const a = opt.alpha == null ? 1 : opt.alpha;
    ctx.globalAlpha *= a;
    // ambient + key shadow (two soft layers)
    rr(ctx, x, y + 2.5, w, h, r); ctx.fillStyle = 'rgba(150,110,130,0.10)'; ctx.fill();
    rr(ctx, x - 0.5, y + 1, w + 1, h + 1, r); ctx.fillStyle = 'rgba(150,110,130,0.07)'; ctx.fill();
    rr(ctx, x, y, w, h, r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, opt.top || 'rgba(255,253,250,0.94)');
    g.addColorStop(1, opt.bottom || 'rgba(255,247,243,0.90)');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    ctx.restore();
  }

  // ------- icons: 24-unit grid, 1.9 stroke, round caps -------
  function icon(ctx, name, x, y, s = 16, col = P.ink, lw = 1.9) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const B = () => ctx.beginPath(), S = () => ctx.stroke(), F = () => ctx.fill();
    switch (name) {
      case 'bag': B(); rr(ctx, 4.5, 8, 15, 12.5, 4.5); S(); B(); ctx.moveTo(8.5, 8); ctx.bezierCurveTo(8.5, 2.8, 15.5, 2.8, 15.5, 8); S(); B(); ctx.moveTo(9, 13.5); ctx.quadraticCurveTo(12, 15.5, 15, 13.5); S(); break;
      case 'map': B(); ctx.moveTo(3.5, 6.5); ctx.lineTo(9, 4.5); ctx.lineTo(15, 6.5); ctx.lineTo(20.5, 4.5); ctx.lineTo(20.5, 17.5); ctx.lineTo(15, 19.5); ctx.lineTo(9, 17.5); ctx.lineTo(3.5, 19.5); ctx.closePath(); S(); B(); ctx.moveTo(9, 4.5); ctx.lineTo(9, 17.5); ctx.moveTo(15, 6.5); ctx.lineTo(15, 19.5); S(); break;
      case 'dots': for (const dx of [6, 12, 18]) { B(); ctx.arc(dx, 12, 1.7, 0, TAU); F(); } break;
      case 'coin': B(); ctx.arc(12, 12, 8, 0, TAU); S(); B(); ctx.moveTo(12, 7.5); ctx.lineTo(13.4, 10.6); ctx.lineTo(16.6, 11); ctx.lineTo(14.2, 13.2); ctx.lineTo(14.9, 16.4); ctx.lineTo(12, 14.8); ctx.lineTo(9.1, 16.4); ctx.lineTo(9.8, 13.2); ctx.lineTo(7.4, 11); ctx.lineTo(10.6, 10.6); ctx.closePath(); F(); break;
      case 'sun': B(); ctx.arc(12, 12, 4.2, 0, TAU); S(); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; B(); ctx.moveTo(12 + Math.cos(a) * 7, 12 + Math.sin(a) * 7); ctx.lineTo(12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9); S(); } break;
      case 'moon': B(); ctx.arc(12, 12, 7.5, 0.95, TAU - 0.95 + 0.02, false); ctx.arc(15.6, 9.4, 5.9, TAU - 1.65, 1.65 + 0.02, true); ctx.closePath(); S(); break;
      case 'cloud': B(); ctx.moveTo(7, 17.5); ctx.arc(7.5, 13.5, 4, Math.PI * 0.6, Math.PI * 1.45); ctx.arc(12.5, 10, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.arc(17, 13.8, 3.8, Math.PI * 1.5, Math.PI * 0.45); ctx.closePath(); S(); break;
      case 'rain': icon(ctx, 'cloud', 12, 10, 20, col, lw); for (const dx of [8, 12, 16]) { B(); ctx.moveTo(dx, 18); ctx.lineTo(dx - 1, 21); S(); } break;
      case 'heart': B(); ctx.moveTo(12, 19.5); ctx.bezierCurveTo(2, 13, 4, 4.5, 12, 8.5); ctx.bezierCurveTo(20, 4.5, 22, 13, 12, 19.5); ctx.closePath(); F(); break;
      case 'heartO': B(); ctx.moveTo(12, 19.5); ctx.bezierCurveTo(2, 13, 4, 4.5, 12, 8.5); ctx.bezierCurveTo(20, 4.5, 22, 13, 12, 19.5); ctx.closePath(); S(); break;
      case 'star': B(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.8 : 8.5; ctx.lineTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r); } ctx.closePath(); F(); break;
      case 'sparkle': B(); ctx.moveTo(12, 3); ctx.quadraticCurveTo(13, 11, 21, 12); ctx.quadraticCurveTo(13, 13, 12, 21); ctx.quadraticCurveTo(11, 13, 3, 12); ctx.quadraticCurveTo(11, 11, 12, 3); F(); break;
      case 'back': B(); ctx.moveTo(14.5, 5.5); ctx.lineTo(8, 12); ctx.lineTo(14.5, 18.5); S(); break;
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
      case 'paw': B(); ctx.ellipse(12, 15, 4.6, 3.8, 0, 0, TAU); F(); for (const [px, py, r] of [[6.5, 10.5, 1.9], [9.6, 6.8, 1.9], [14.4, 6.8, 1.9], [17.5, 10.5, 1.9]]) { B(); ctx.arc(px, py, r, 0, TAU); F(); } break;
      case 'home': B(); ctx.moveTo(4.5, 11); ctx.lineTo(12, 4.5); ctx.lineTo(19.5, 11); ctx.moveTo(6.5, 9.5); ctx.lineTo(6.5, 19); ctx.lineTo(17.5, 19); ctx.lineTo(17.5, 9.5); S(); break;
      case 'leaf': B(); ctx.moveTo(5, 19); ctx.bezierCurveTo(4, 9, 11, 4, 20, 4.5); ctx.bezierCurveTo(20, 13, 14, 20, 5, 19); ctx.closePath(); S(); B(); ctx.moveTo(5, 19); ctx.lineTo(14, 10); S(); break;
      case 'face': B(); ctx.arc(12, 12, 8, 0, TAU); S(); B(); ctx.arc(9, 11, 1.1, 0, TAU); ctx.arc(15, 11, 1.1, 0, TAU); F(); B(); ctx.arc(12, 13.5, 2.5, 0.2, Math.PI - 0.2); S(); break;
      case 'shirt': B(); ctx.moveTo(8.5, 4.5); ctx.lineTo(4, 8); ctx.lineTo(6.5, 11.5); ctx.lineTo(7.5, 10.5); ctx.lineTo(7.5, 19.5); ctx.lineTo(16.5, 19.5); ctx.lineTo(16.5, 10.5); ctx.lineTo(17.5, 11.5); ctx.lineTo(20, 8); ctx.lineTo(15.5, 4.5); ctx.quadraticCurveTo(12, 7.5, 8.5, 4.5); S(); break;
      case 'film': B(); rr(ctx, 4, 5, 16, 14, 3); S(); for (const yy of [8, 12, 16]) { B(); ctx.arc(7, yy, 0.9, 0, TAU); ctx.arc(17, yy, 0.9, 0, TAU); F(); } break;
      case 'pin': B(); ctx.moveTo(12, 20.5); ctx.bezierCurveTo(5, 13, 5.5, 4, 12, 4); ctx.bezierCurveTo(18.5, 4, 19, 13, 12, 20.5); ctx.closePath(); S(); B(); ctx.arc(12, 10.5, 2.3, 0, TAU); S(); break;
      case 'clock': B(); ctx.arc(12, 12, 8, 0, TAU); S(); B(); ctx.moveTo(12, 7.5); ctx.lineTo(12, 12); ctx.lineTo(15, 14); S(); break;
      case 'walk': B(); ctx.arc(13, 5.5, 2, 0, TAU); F(); B(); ctx.moveTo(12, 9); ctx.lineTo(10.5, 14); ctx.lineTo(13, 16); ctx.lineTo(12.5, 20); ctx.moveTo(10.5, 14); ctx.lineTo(8, 19.5); ctx.moveTo(11.5, 10); ctx.lineTo(8, 12.5); ctx.moveTo(12.3, 10.5); ctx.lineTo(16, 12.5); S(); break;
      case 'chat': B(); rr(ctx, 4, 5, 16, 11.5, 5); S(); B(); ctx.moveTo(9, 16.5); ctx.lineTo(7.5, 20); ctx.lineTo(12.5, 16.5); S(); break;
      default: B(); ctx.arc(12, 12, 6, 0, TAU); S();
    }
    ctx.restore();
  }

  // ------- item illustrations (soft clay) on a 24-unit grid -------
  function item(ctx, id, x, y, s = 24) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12);
    const blob = (cx, cy, rx, ry, c1, c2) => { const g = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.45, 0.5, cx, cy, Math.max(rx, ry) * 1.1); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ellipse(ctx, cx, cy, rx, ry); ctx.fill(); };
    softShadow(ctx, 12, 20.5, 8, 2.2, 0.18);
    switch (id) {
      case 'cake':
        ctx.fillStyle = '#F3D2B5'; rr(ctx, 4.5, 11, 15, 8.5, 3); ctx.fill();
        ctx.fillStyle = '#FFF6EE'; rr(ctx, 4.5, 9.5, 15, 5, 2.5); ctx.fill();
        ctx.fillStyle = '#F7B8C2'; rr(ctx, 4.5, 14.3, 15, 1.8, 0.9); ctx.fill();
        for (const dx of [7, 10, 13, 16]) { ctx.fillStyle = '#FFF6EE'; ellipse(ctx, dx + 0.5, 14, 1.6, 1.4); ctx.fill(); }
        blob(12, 7.2, 3.2, 3.4, '#FF9FA8', '#E8576E'); ctx.fillStyle = '#9ED39A'; ellipse(ctx, 12, 4.2, 2, 1); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ellipse(ctx, 10.9, 6.2, 0.8, 1.1); ctx.fill(); break;
      case 'apple':
        blob(12, 13, 7, 6.6, '#FFA3A0', '#E26A6E'); ctx.strokeStyle = '#B98A6F'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(12, 7.5); ctx.lineTo(12.6, 4.5); ctx.stroke();
        ctx.fillStyle = '#A4D79A'; ellipse(ctx, 15, 5.5, 2.6, 1.3, -0.4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ellipse(ctx, 9.3, 10.6, 1.4, 2); ctx.fill(); break;
      case 'milk':
        ctx.fillStyle = '#FFFFFF'; rr(ctx, 7.5, 7, 9, 13, 3.5); ctx.fill(); ctx.fillStyle = '#BEDDF3'; rr(ctx, 7.5, 12, 9, 5, 1); ctx.fill();
        ctx.fillStyle = '#F5A893'; rr(ctx, 8.5, 4, 7, 3.5, 1.5); ctx.fill(); ctx.fillStyle = 'rgba(150,120,140,.12)'; rr(ctx, 13.5, 7.5, 2.5, 12, 1.2); ctx.fill(); break;
      case 'flower':
        ctx.strokeStyle = '#8FCA8D'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(12, 20); ctx.quadraticCurveTo(11, 15, 12, 11); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; ctx.fillStyle = '#FFFFFF'; ellipse(ctx, 12 + Math.cos(a) * 3.6, 9 + Math.sin(a) * 3.6, 2.6, 2.6); ctx.fill(); }
        blob(12, 9, 2.3, 2.3, '#FFE7A6', '#F5C35E'); break;
      case 'fish':
        blob(11, 12.5, 7, 4, '#D6E6F2', '#9DBBD6'); ctx.fillStyle = '#9DBBD6'; ctx.beginPath(); ctx.moveTo(17, 12.5); ctx.lineTo(21, 9); ctx.lineTo(21, 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6E5A64'; ellipse(ctx, 7.5, 11.5, 0.9, 0.9); ctx.fill(); break;
      case 'star':
        ctx.fillStyle = '#FBE3A0'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.8 : 8; ctx.lineTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ellipse(ctx, 10.4, 10.4, 1.4, 1); ctx.fill(); ctx.fillStyle = '#F1B970'; ellipse(ctx, 13.5, 14.5, 2.5, 1.2); ctx.globalAlpha = 0.4; ctx.fill(); break;
      case 'shell':
        blob(12, 13, 7, 6, '#FFE3DA', '#F2B7A8'); ctx.strokeStyle = 'rgba(210,140,130,.5)'; ctx.lineWidth = 0.9; for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) { ctx.beginPath(); ctx.moveTo(12, 18); ctx.lineTo(12 + Math.sin(a) * 7, 13 - Math.cos(a) * 6); ctx.stroke(); } break;
      case 'seed':
        blob(12, 13, 6, 7, '#F4DDB8', '#D9B48A'); ctx.fillStyle = '#8FCA8D'; ellipse(ctx, 12, 5.5, 2.4, 1.2, 0.3); ctx.fill(); ctx.fillStyle = '#6E5A64'; ctx.font = '5px Fredoka'; ctx.textAlign = 'center'; ctx.fillText('✿', 12, 15); break;
      case 'lamp':
        ctx.fillStyle = '#FFF4E4'; rr(ctx, 10.5, 11, 3, 8, 1.5); ctx.fill(); blob(12, 10, 8, 5.5, '#FFC7B9', '#EE8F86');
        ctx.fillStyle = '#FFF4E4'; for (const [dx, dy, r] of [[8.5, 8.5, 1.2], [14, 7.3, 1], [15.5, 10.2, 0.8]]) { ellipse(ctx, dx, dy, r, r); ctx.fill(); }
        ctx.fillStyle = '#F0D7C4'; ellipse(ctx, 12, 19.5, 4, 1.4); ctx.fill(); break;
      case 'cushion':
        blob(12, 13, 9, 5.8, '#FFFFFF', '#DCD4F2'); blob(7, 10.5, 3.8, 3.3, '#FFFFFF', '#E3DCF5'); blob(16, 10, 4.4, 3.6, '#FFFFFF', '#E3DCF5'); break;
      case 'plant':
        ctx.fillStyle = '#A9D898'; for (const a of [-0.8, -0.2, 0.4, 1.0]) { ctx.save(); ctx.translate(12, 11); ctx.rotate(a); ellipse(ctx, 0, -4.5, 2.4, 4.8); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = '#F2B49F'; ctx.beginPath(); ctx.moveTo(7, 12); ctx.lineTo(17, 12); ctx.lineTo(15.5, 20); ctx.lineTo(8.5, 20); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#F7C7B6'; rr(ctx, 6.5, 11, 11, 2.6, 1.3); ctx.fill(); break;
      case 'rug':
        blob(12, 14, 10, 5, '#FBE3A0', '#F2C978'); ctx.fillStyle = '#F5A893'; ellipse(ctx, 12, 15, 3, 2); ctx.fill(); for (const [dx, dy] of [[8, 12.5], [10.5, 11], [13.5, 11], [16, 12.5]]) { ellipse(ctx, dx, dy, 1.1, 0.8); ctx.fill(); } break;
      default: blob(12, 12, 7, 7, '#fff', '#ddd');
    }
    ctx.restore();
  }

  // ------- UI parts -------
  function pill(ctx, x, y, w, h, label, opt = {}) {
    frost(ctx, x, y, w, h, h / 2, opt);
    if (label) OC.text(ctx, label, x + w / 2 + (opt.dx || 0), y + h / 2 + 0.5, { font: opt.font || FONT(600, 10), color: opt.color || P.ink, align: 'center', base: 'middle' });
  }
  function solidPill(ctx, x, y, w, h, label, col = P.peach, tcol = '#fff', font = FONT(600, 11)) {
    ctx.save();
    rr(ctx, x, y + 2, w, h, h / 2); ctx.fillStyle = rgba(mix(col, '#7a4a5a', 0.4), 0.25); ctx.fill();
    rr(ctx, x, y, w, h, h / 2);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, mix(col, '#ffffff', 0.18)); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    if (label) OC.text(ctx, label, x + w / 2, y + h / 2 + 0.5, { font, color: tcol, align: 'center', base: 'middle' });
  }
  function roundBtn(ctx, x, y, r, iconName, opt = {}) {
    ctx.save();
    const s = opt.scale || 1;
    ctx.translate(x, y); ctx.scale(s, s);
    softShadow(ctx, 0, r * 0.55, r * 1.05, r * 0.6, 0.22);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, opt.c1 || '#FFFFFF'); g.addColorStop(1, opt.c2 || '#FFF2EC');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
    if (iconName) icon(ctx, iconName, 0, 0, opt.is || r * 0.95, opt.ic || P.ink, opt.lw || 1.9);
    ctx.restore();
  }
  /** Soft touch indicator: translucent dot + expanding ring on press. */
  function touch(ctx, f) {
    if (!f || f.alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = f.alpha;
    const pr = f.down ? E.outCubic(clamp(f.sinceChange / 0.18)) : 1 - E.outCubic(clamp(f.sinceChange / 0.25));
    if (f.down || f.sinceChange < 0.5) {
      const rp = clamp(f.sinceChange / 0.5);
      if (f.down) { ctx.globalAlpha = f.alpha * (1 - rp) * 0.6; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, 10 + rp * 14, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = f.alpha;
    const r = 9 - pr * 1.5;
    ctx.fillStyle = `rgba(255,255,255,${0.55 + pr * 0.2})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(236,140,120,0.85)'; ctx.stroke();
    ctx.restore();
  }
  function statusBar(ctx, time = '10:20', col = P.ink, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    OC.text(ctx, time, 18, 15, { font: FONT(600, 9.5), color: col });
    // signal + battery (generic)
    ctx.fillStyle = col;
    for (let i = 0; i < 4; i++) { rr(ctx, 304 + i * 3.3, 13 - i * 1.6, 2.2, 2.6 + i * 1.6, 0.6); ctx.fill(); }
    ctx.strokeStyle = col; ctx.lineWidth = 0.9; rr(ctx, 322, 7.2, 15, 7.6, 2); ctx.stroke(); rr(ctx, 323.6, 8.8, 9.5, 4.4, 1); ctx.fill(); rr(ctx, 337.5, 9.6, 1.2, 2.8, 0.5); ctx.fill();
    ctx.restore();
  }
  function navBar(ctx, col = P.ink, a = 0.35) { ctx.save(); ctx.globalAlpha *= a; rr(ctx, 140, 629, 80, 3.5, 2); ctx.fillStyle = col; ctx.fill(); ctx.restore(); }

  OC.M = { P, FONT, ZH, softShadow, frost, icon, item, pill, solidPill, roundBtn, touch, statusBar, navBar };
})();
