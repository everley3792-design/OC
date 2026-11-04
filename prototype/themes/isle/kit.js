/* Scheme E — 晴日島嶼 Sunny Isle : kit
 * Switch-era "cosy island life" language in 2D: bright toy-like flat colour, no outlines,
 * chunky rounded geometry, lawn stripes, satisfying toy buttons (coloured face + darker
 * pressed band), bubbly speech balloons with tilted name tags, a phone-style app menu,
 * classic iris-wipe transitions. All shapes, icons and layouts are original.
 */
(function () {
  'use strict';
  const { TAU, clamp, lerp, rr, ellipse, mix, rgba, text, E } = OC;
  const V = OC.V;

  const P = {
    sea: '#4FC3E8', seaDeep: '#2FA3D6', shallow: '#8FE3F2', foam: '#FFFFFF',
    sand: '#F7E3A8', sandLo: '#E9C97E', grassA: '#80CC5C', grassB: '#74C252', grassLo: '#5AA842', lip: '#5DB040',
    cliff: '#CFA36C', cliffLo: '#A97D4C', river: '#5BC8EE', wood: '#C88B55', woodLo: '#A06A3C',
    coral: '#F26B5B', teal: '#3FC1B0', yellow: '#FFC93C', purple: '#9B7BE0', pink: '#F48FB1', blue: '#5BC0EB',
    cream: '#FFF8E7', panel: '#FFF3D6', panel2: '#FBE8BE', brown: '#6B4F3A', brown2: '#A8876A', white: '#FFFFFF', green: '#6CCB5F',
  };
  const F = (w, s) => `${w} ${s}px Nunito, Huninn`;
  const ZH = (s) => `${s}px Huninn, Nunito`;

  const ST = { mat: 'flat', outline: null, face: 'dot', head: { rx: 17.5, ry: 15.6, y: -30 }, body: { rx: 9.6, ry: 8.8, y: -9.6 }, cheekA: 0.72, shadowA: 0.22, shadowCol: '#2c5a3a', dx: 2, dy: 2.2 };
  const DES = {
    mochi: { fur: '#FFF7EC', shade: '#EBD5C0', inner: '#FFB8B0', cheek: '#FF9E9E', eye: '#3B2B25', ears: 'cat', tail: 'cat', shirt: '#5BC0EB', pattern: 'stripe', legs: '#FFF7EC' },
    kuri: { fur: '#E7A86A', shade: '#C98A50', inner: '#FFD0B0', cheek: '#FF8E7A', eye: '#3B2B25', ears: 'bunny', tail: 'puff', shirt: '#FFC93C', pattern: 'star', clip: 'flower' },
    sora: { fur: '#B9B8F0', shade: '#9A98DA', inner: '#FFC4DD', cheek: '#FF9EC4', eye: '#2E2A44', ears: 'bear', tail: 'puff', shirt: '#F48FB1', acc: 'beanie', accCol: '#3FC1B0' },
  };
  const ch = (ctx, d, s, x, y, sc, t) => OC.VC.draw(ctx, typeof d === 'string' ? DES[d] : d, s, x, y, sc, t, ST);

  /** chunky panel: cream body, soft drop + thick bottom lip */
  function panel(ctx, x, y, w, h, r = 18, col = P.cream, lip = P.panel2) {
    ctx.save();
    rr(ctx, x, y + 5, w, h, r); ctx.fillStyle = 'rgba(90,60,30,0.16)'; ctx.fill();
    rr(ctx, x, y + 3, w, h, r); ctx.fillStyle = lip; ctx.fill();
    rr(ctx, x, y, w, h, r); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
  }
  /** toy button: colour face + darker pressed band; press sinks 3px */
  function toy(ctx, x, y, w, h, col, label, o = {}) {
    const pr = o.pressed ? 2.5 : 0, r = o.r ?? h / 2;
    ctx.save();
    rr(ctx, x, y + 4, w, h, r); ctx.fillStyle = 'rgba(70,40,20,0.18)'; ctx.fill();
    rr(ctx, x, y + 3, w, h, r); ctx.fillStyle = mix(col, '#3a2414', 0.28); ctx.fill();
    rr(ctx, x, y + pr, w, h, r); ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 0.35; rr(ctx, x + 4, y + pr + 3, w - 8, h * 0.32, r * 0.7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1;
    if (o.icon) V.icon(ctx, o.icon, x + w / 2 + (label ? -textW(ctx, label, o.font) / 2 - 8 : 0), y + h / 2 + pr, o.is || h * 0.55, o.tc || '#fff', o.lw || 2.6);
    if (label) text(ctx, label, x + w / 2 + (o.icon ? 8 : 0), y + h / 2 + pr + 0.5, { font: o.font || F(900, 13), color: o.tc || '#fff', align: 'center', base: 'middle' });
    ctx.restore();
  }
  function textW(ctx, s, font) { ctx.save(); ctx.font = font || F(900, 13); const w = ctx.measureText(s).width; ctx.restore(); return w; }
  function roundToy(ctx, x, y, r, col, ic, o = {}) {
    const pr = o.pressed ? 2.5 : 0;
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 4, r, 0, TAU); ctx.fillStyle = 'rgba(70,40,20,0.2)'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 3, r, 0, TAU); ctx.fillStyle = mix(col, '#3a2414', 0.28); ctx.fill();
    ctx.beginPath(); ctx.arc(0, pr, r, 0, TAU); ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 0.35; ellipse(ctx, -r * 0.2, pr - r * 0.45, r * 0.55, r * 0.28); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1;
    V.icon(ctx, ic, 0, pr, o.is || r * 1.05, o.ic || '#fff', o.lw || 2.6);
    ctx.restore();
  }
  /** name tag: tilted pill */
  function tag(ctx, x, y, label, col = P.coral, rot = -0.08) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const w = textW(ctx, label, ZH(13)) + 26;
    rr(ctx, -w / 2, -12 + 3, w, 24, 12); ctx.fillStyle = mix(col, '#3a2414', 0.25); ctx.fill();
    rr(ctx, -w / 2, -12, w, 24, 12); ctx.fillStyle = col; ctx.fill();
    text(ctx, label, 0, 0.5, { font: ZH(13), color: '#fff', align: 'center', base: 'middle' });
    ctx.restore();
  }
  /** outlined chunky text (titles, time) */
  function chunky(ctx, s, x, y, size, col = '#fff', stroke = P.brown, o = {}) {
    ctx.save(); ctx.font = o.font || F(900, size); ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic'; ctx.lineJoin = 'round';
    ctx.fillStyle = rgba(stroke, 0.35); ctx.fillText(s, x, y + size * 0.1);
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y);
    ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.restore();
  }
  /** cartoon pointing-hand cursor (rounded glove, original) */
  function hand(ctx, f) {
    if (!f || f.alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = f.alpha; ctx.translate(f.x, f.y + (f.down ? 2 : 0)); ctx.rotate(-0.35); const s = f.down ? 0.92 : 1; ctx.scale(s, s);
    if (f.down && f.sinceChange < 0.35) { const q = f.sinceChange / 0.35; ctx.strokeStyle = rgba(P.yellow, 1 - q); ctx.lineWidth = 2.5; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (10 + q * 6), Math.sin(a) * (10 + q * 6)); ctx.lineTo(Math.cos(a) * (15 + q * 8), Math.sin(a) * (15 + q * 8)); ctx.stroke(); } }
    ctx.fillStyle = '#fff'; ctx.strokeStyle = P.brown; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
    ctx.beginPath(); rr(ctx, -3, -1, 6.5, 16, 3.2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); rr(ctx, -6, 9, 16, 15, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3.5, 12); ctx.lineTo(3.5, 16); ctx.moveTo(7, 12.5); ctx.lineTo(7, 16); ctx.stroke();
    ctx.restore();
  }
  function statusBar(ctx, time, col = P.brown) {
    text(ctx, time, 18, 15, { font: F(900, 10), color: col });
    ctx.save(); ctx.fillStyle = col; for (let i = 0; i < 4; i++) { rr(ctx, 304 + i * 3.3, 13 - i * 1.6, 2.2, 2.6 + i * 1.6, 0.6); ctx.fill(); }
    ctx.strokeStyle = col; ctx.lineWidth = 1; rr(ctx, 322, 7.2, 15, 7.6, 2.5); ctx.stroke(); rr(ctx, 323.6, 8.8, 9.5, 4.4, 1.2); ctx.fill(); ctx.restore();
  }
  const itemE = (ctx, id, x, y, s) => V.item(ctx, id, x, y, s, { mode: 'flat' });
  function emote(ctx, kind, x, y, p) {
    if (p <= 0 || p >= 1) return;
    const a = clamp(p / 0.1) * clamp((1 - p) / 0.2), pop = E.outBack(clamp(p / 0.22), 2.2);
    ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop); ctx.globalAlpha *= a;
    if (kind === '♥') { for (let i = 0; i < 3; i++) { const q = clamp(p * 1.4 - i * 0.18); if (q <= 0) continue; V.icon(ctx, 'heart', (i - 1) * 8 + Math.sin(q * 7 + i) * 2, -q * 18, 10 - i, [P.coral, P.pink, P.yellow][i]); } V.icon(ctx, 'sparkle', 14, -10, 8, P.yellow); }
    else if (kind === 'zzz') { for (let i = 0; i < 3; i++) { const q = (p * 1.6 + i * 0.33) % 1; chunky(ctx, 'Z', i * 5 + q * 6, -q * 14, 7 + i * 2, '#fff', P.purple); } }
    else { ctx.beginPath(); ctx.arc(0, -11, 10, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = P.brown; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(0, 3); ctx.lineTo(3, -2); ctx.fillStyle = '#fff'; ctx.fill(); text(ctx, kind, 0, -10.5, { font: F(900, 13), color: kind === '!' ? P.coral : P.teal, align: 'center', base: 'middle' }); }
    ctx.restore();
  }
  function polka(ctx, c1, c2, t = 0) { ctx.fillStyle = c1; ctx.fillRect(0, 0, 360, 640); ctx.fillStyle = c2; const o = (t * 6) % 40; for (let y = -40; y < 680; y += 40) for (let x = -40; x < 400; x += 40) { ellipse(ctx, x + o + ((y / 40) % 2) * 20, y + o, 5, 5); ctx.fill(); } }

  OC.IS = { P, F, ZH, ST, DES, ch, panel, toy, roundToy, tag, chunky, hand, statusBar, itemE, emote, polka, textW };
})();
