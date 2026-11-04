/* Scheme F — 奇趣鎮 Quirkville : kit
 * Switch-era "quirky life-sim" language in 2D: glossy toy-plastic characters with
 * geometric, slider-driven faces; clean white UI with colour-coded header bars;
 * residents broadcast wishes in thought bubbles; comic timing and reaction bursts;
 * diagonal stripe wipes. All motifs original.
 */
(function () {
  'use strict';
  const { TAU, clamp, lerp, rr, ellipse, mix, rgba, text, E } = OC;
  const V = OC.V;

  const P = {
    sky: '#7FD3FF', lime: '#A6E35A', mag: '#FF5FA2', orange: '#FF9F1C', blue: '#3D8BFF', yellow: '#FFD93D', purple: '#9B6BFF', teal: '#2EC4B6',
    white: '#FFFFFF', bg: '#F4F7FB', line: '#E3E8F0', ink: '#2B2D42', ink2: '#6B7080', ink3: '#A9AEBB',
    pave: '#EDE7DD', paveLo: '#D9D0C2', grass: '#8FD65A', grassLo: '#6DBB45', sea: '#4CB8F5',
  };
  const B = (w, s) => `${w} ${s}px Nunito, "Noto Sans TC"`;
  const ZB = (w, s) => `${w} ${s}px "Noto Sans TC", Nunito`;

  const ST = { mat: 'gloss', outline: '#3a3550', lw: 0.9, face: 'mii', head: { rx: 15.5, ry: 16.5, y: -33 }, body: { rx: 9, ry: 10.5, y: -11 }, cheekA: 0.38, eyeY: 1.5, shadowA: 0.2, shadowCol: '#2b2d42', dx: 2.4, dy: 2.6, earScale: 0.92 };
  const DES = {
    mochi: { fur: '#FFF8EE', shade: '#E9D9C6', inner: '#FFB3C2', cheek: '#FF8FAE', eye: '#2B2D42', ears: 'cat', tail: 'cat', shirt: '#FF5FA2', legs: '#3A4A6B' },
    kuri: { fur: '#F0B27A', shade: '#D89357', inner: '#FFD3C2', cheek: '#FF8A7A', eye: '#2B2D42', ears: 'bunny', tail: 'puff', shirt: '#3D8BFF', legs: '#5A4632' },
    sora: { fur: '#C7C3F5', shade: '#A7A2E6', inner: '#FFC9E3', cheek: '#FF9ECF', eye: '#2B2D42', ears: 'bear', tail: 'puff', shirt: '#A6E35A', legs: '#3A4A6B', acc: 'beanie', accCol: '#FFD93D' },
  };
  const ch = (ctx, d, s, x, y, sc, t) => OC.VC.draw(ctx, typeof d === 'string' ? DES[d] : d, s, x, y, sc, t, ST);

  function card(ctx, x, y, w, h, o = {}) {
    ctx.save();
    rr(ctx, x, y + 3, w, h, o.r ?? 18); ctx.fillStyle = 'rgba(43,45,66,0.10)'; ctx.fill();
    rr(ctx, x, y, w, h, o.r ?? 18); ctx.fillStyle = o.fill || P.white; ctx.fill();
    if (o.head) { ctx.save(); rr(ctx, x, y, w, h, o.r ?? 18); ctx.clip(); ctx.fillStyle = o.head; ctx.fillRect(x, y, w, o.hh || 30); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w, (o.hh || 30) * 0.45); ctx.restore(); if (o.title) text(ctx, o.title, x + 16, y + (o.hh || 30) / 2 + 1, { font: ZB(900, 13), color: '#fff', base: 'middle' }); }
    ctx.restore();
  }
  /** glossy button: gradient fill + white highlight streak */
  function gloss(ctx, x, y, w, h, col, label, o = {}) {
    const pr = o.pressed ? 0.95 : 1, r = o.r ?? h / 2;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(pr, pr); ctx.translate(-x - w / 2, -y - h / 2);
    rr(ctx, x, y + 3, w, h, r); ctx.fillStyle = rgba(mix(col, '#000', 0.4), 0.3); ctx.fill();
    rr(ctx, x, y, w, h, r); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, mix(col, '#fff', 0.25)); g.addColorStop(1, mix(col, '#000', 0.08)); ctx.fillStyle = g; ctx.fill();
    if (w > 16) { ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(ctx, x + 6, y + 3, w - 12, h * 0.36, h * 0.18); ctx.fill(); ctx.restore(); } else { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ellipse(ctx, x + w * 0.4, y + h * 0.3, w * 0.22, h * 0.14); ctx.fill(); }
    if (o.icon) V.icon(ctx, o.icon, label ? x + 18 : x + w / 2, y + h / 2, o.is || h * 0.5, '#fff', o.lw || 2.6);
    if (label) text(ctx, label, x + w / 2 + (o.icon ? 8 : 0), y + h / 2 + 0.5, { font: o.font || ZB(900, 13), color: '#fff', align: 'center', base: 'middle' });
    ctx.restore();
  }
  function orb(ctx, x, y, r, col, ic, o = {}) { gloss(ctx, x - r, y - r, r * 2, r * 2, col, null, Object.assign({ icon: ic, is: r * 1.05, r }, o)); }
  /** thought bubble with an icon (resident wishes) */
  function thought(ctx, x, y, ic, col, t, p = 1) {
    if (p <= 0) return;
    const bob = Math.sin(t * 2.4 + x) * 2, s = E.outBack(clamp(p), 2);
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = P.line; ctx.lineWidth = 1.2;
    for (const [dx, dy, r] of [[-4, 16, 2.4], [-1, 10, 3.6]]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(2, -6, 13, 0, TAU); ctx.fill(); ctx.stroke();
    orb(ctx, 2, -6, 9, col, ic);
    ctx.restore();
  }
  function burst(ctx, x, y, r, col, t, a = 1) {
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(t * 0.6);
    for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.12, -r); ctx.lineTo(r * 0.12, -r); ctx.closePath(); ctx.fillStyle = i % 2 ? rgba(col, 0.35) : rgba('#ffffff', 0.4); ctx.fill(); }
    ctx.restore();
  }
  /** bold caption text with white outline */
  function cap(ctx, s, x, y, size, col, o = {}) {
    ctx.save(); ctx.font = o.font || ZB(900, size); ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.28; ctx.strokeStyle = o.stroke || '#fff'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.restore();
  }
  function stylus(ctx, f) { // touch: clean ring + dot (stylus-like)
    if (!f || f.alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = f.alpha;
    if (f.down && f.sinceChange < 0.4) { const q = f.sinceChange / 0.4; ctx.strokeStyle = rgba(P.mag, 1 - q); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 8 + q * 16, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(f.x, f.y, f.down ? 6 : 8, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = P.mag; ctx.stroke();
    ctx.beginPath(); ctx.arc(f.x, f.y, 2, 0, TAU); ctx.fillStyle = P.mag; ctx.fill();
    ctx.restore();
  }
  function statusBar(ctx, time, col = P.ink) {
    text(ctx, time, 18, 15, { font: B(900, 10), color: col });
    ctx.save(); ctx.fillStyle = col; for (let i = 0; i < 4; i++) { rr(ctx, 304 + i * 3.3, 13 - i * 1.6, 2.2, 2.6 + i * 1.6, 0.6); ctx.fill(); }
    ctx.strokeStyle = col; ctx.lineWidth = 1; rr(ctx, 322, 7.2, 15, 7.6, 2.5); ctx.stroke(); rr(ctx, 323.6, 8.8, 9.5, 4.4, 1.2); ctx.fill(); ctx.restore();
  }
  const itemF = (ctx, id, x, y, s) => V.item(ctx, id, x, y, s, { mode: 'gloss', outline: '#3a3550', lw: 0.8 });
  function emote(ctx, kind, x, y, p, t) {
    if (p <= 0 || p >= 1) return;
    const a = clamp(p / 0.08) * clamp((1 - p) / 0.2), pop = E.outBack(clamp(p / 0.2), 2.4);
    ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop); ctx.globalAlpha *= a;
    if (kind === '♥') { for (let i = 0; i < 4; i++) { const q = clamp(p * 1.5 - i * 0.15); if (q <= 0) continue; V.icon(ctx, 'heart', (i - 1.5) * 8 + Math.sin(q * 7 + i) * 3, -q * 22, 11 - i, [P.mag, '#FF8FBF', P.mag, '#FFB3D1'][i]); } }
    else if (kind === 'zzz') { thought(ctx, 0, -6, 'moon', P.purple, t || 0, 1); }
    else if (kind === '♪') { thought(ctx, 0, -6, 'music', P.teal, t || 0, 1); }
    else { cap(ctx, kind === '!' ? '！？' : kind, 0, -4, 16, P.mag); }
    ctx.restore();
  }
  function shapesBg(ctx, t, base = P.bg) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, 360, 640);
    const cols = [P.mag, P.yellow, P.sky, P.lime, P.orange, P.purple];
    for (let i = 0; i < 14; i++) { const x = (i * 97 + t * (8 + (i % 3) * 4)) % 420 - 30, y = (i * 151) % 640, k = i % 3; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.4 + i); ctx.globalAlpha = 0.16; ctx.fillStyle = cols[i % 6]; if (k === 0) { ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); } else if (k === 1) { rr(ctx, -10, -10, 20, 20, 5); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(11, 8); ctx.lineTo(-11, 8); ctx.closePath(); ctx.fill(); } ctx.restore(); }
  }

  OC.QK = { P, B, ZB, ST, DES, ch, card, gloss, orb, thought, burst, cap, stylus, statusBar, itemF, emote, shapesBg };
})();
