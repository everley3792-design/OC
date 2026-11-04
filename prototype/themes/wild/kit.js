/* Scheme D — 風語原野 Windsong Fields : kit
 * Switch-era "open-air adventure" language translated to 2D: painterly cel shading with
 * coloured line art, wind as a visible character, and an exploration-first ultra-quiet HUD
 * (white line icons + soft shadow, no panels). Menus = dark translucent slates over a
 * blurred world, thin hairlines, gold corner-bracket selection. All motifs original.
 */
(function () {
  'use strict';
  const { TAU, clamp, lerp, rr, ellipse, mix, rgba, text, E } = OC;
  const V = OC.V;

  const P = {
    cream: '#F4EBD0', grassHi: '#C4D387', grass: '#9DB765', grassLo: '#6E8C45', grassDeep: '#4A6A3A',
    rockHi: '#D3C6A8', rock: '#A89880', rockLo: '#776B5B', strata: '#8A7C68',
    water: '#6FA8B8', waterHi: '#B6DADB', waterDeep: '#4A7C8E', mist: '#DCE6E2',
    wood: '#A47A52', woodLo: '#7A5638', cloth: '#E5D7B4', red: '#C4553F', gold: '#E3C47A', glow: '#7FE6D9',
    ui: 'rgba(16,20,24,0.66)', uiSolid: '#14181C', line: 'rgba(255,255,255,0.82)', hair: 'rgba(255,255,255,0.22)',
    text: '#F6F2E8', sub: '#B9B4A6', dim: '#7F7B72', ink: '#2E2A24',
  };
  const SANS = (w, s) => `${w} ${s}px "Noto Sans TC"`;
  const SERIF = (s) => `600 ${s}px Cinzel, "Noto Serif TC"`;
  const ZSERIF = (s) => `600 ${s}px "Noto Serif TC"`;

  const ST = {
    mat: 'cel', outline: (b) => mix(b, '#2a1c1c', 0.62), lw: 1.25, face: 'iris', rim: '#FFF6DA',
    head: { rx: 16.2, ry: 14, y: -31 }, body: { rx: 10, ry: 9.4, y: -10 }, wind: true, cheekA: 0.35, shadowCol: '#24301f', shadowA: 0.28,
  };
  const DES = {
    mochi: { fur: '#F7EEDF', shade: '#D6C3A8', inner: '#EDB3A6', cheek: '#E9998A', eye: '#3A2E2A', iris: '#3C9AA5', muzzle: '#FFFDF6', ears: 'cat', tail: 'cat', acc: 'scarf', accCol: '#C4553F', clip: null },
    kuri: { fur: '#D69B66', shade: '#A9744A', inner: '#F0C2A3', cheek: '#D9785E', eye: '#3A2A22', iris: '#7A9A3C', muzzle: '#F6E3CC', ears: 'bunny', tail: 'puff', acc: 'scarf', accCol: '#5E8F7A', clip: 'leaf' },
    sora: { fur: '#BDBEE0', shade: '#8E8FC2', inner: '#EDC2D6', cheek: '#D987AE', eye: '#33304A', iris: '#7B6BB0', muzzle: '#F1F0FF', ears: 'bear', tail: 'puff', acc: 'beanie', accCol: '#6D79B8' },
  };
  const ch = (ctx, d, s, x, y, sc, t) => OC.VC.draw(ctx, typeof d === 'string' ? DES[d] : d, s, x, y, sc, t, ST);

  // ---- type with soft drop shadow (HUD text floats over the world) ----
  function stxt(ctx, s, x, y, o = {}) {
    text(ctx, s, x + 0.6, y + 1, Object.assign({}, o, { color: 'rgba(0,0,0,0.45)' }));
    text(ctx, s, x, y, o);
  }
  function sicon(ctx, n, x, y, s, col = P.text, lw = 1.8) { V.icon(ctx, n, x + 0.6, y + 1, s, 'rgba(0,0,0,0.45)', lw); V.icon(ctx, n, x, y, s, col, lw); }

  /** slate panel: translucent dark with hairline frame */
  function slate(ctx, x, y, w, h, o = {}) {
    ctx.save(); rr(ctx, x, y, w, h, o.r ?? 8); ctx.fillStyle = o.fill || P.ui; ctx.fill();
    if (o.frame !== false) { ctx.strokeStyle = o.stroke || P.hair; ctx.lineWidth = 0.8; ctx.stroke(); }
    ctx.restore();
  }
  /** animated gold corner brackets (selection) */
  function brackets(ctx, x, y, w, h, t, col = P.gold) {
    const p = 1.5 + Math.sin(t * 5) * 1.2, L = Math.min(9, w / 3);
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.shadowColor = rgba(col, 0.7); ctx.shadowBlur = 6;
    for (const [cx, cy, sx, sy] of [[x - p, y - p, 1, 1], [x + w + p, y - p, -1, 1], [x - p, y + h + p, 1, -1], [x + w + p, y + h + p, -1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L); ctx.stroke(); }
    ctx.restore();
  }
  function hairline(ctx, x0, y, x1, a = 0.35) { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, 0.8); }
  function diamond(ctx, x, y, r, col) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); }
  /** input prompt chip: e.g. [tap] 選擇 */
  function prompt(ctx, x, y, glyph, label) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    V.icon(ctx, glyph, x, y, 9, P.uiSolid, 2.2);
    text(ctx, label, x + 11, y + 0.5, { font: SANS(500, 10), color: P.text, base: 'middle' }); ctx.restore();
  }
  function tabs(ctx, names, sel, y, t) {
    ctx.save();
    const w = 300 / names.length;
    names.forEach((n, i) => {
      const x = 30 + w * i + w / 2, on = i === sel;
      text(ctx, n, x, y, { font: SANS(on ? 700 : 500, 12), color: on ? P.text : P.dim, align: 'center' });
      if (on) { diamond(ctx, x, y + 9, 2.4, P.gold); }
    });
    V.icon(ctx, 'back', 16, y - 4, 11, P.sub, 2); V.icon(ctx, 'next', 344, y - 4, 11, P.sub, 2);
    hairline(ctx, 10, y + 15, 350, 0.3);
    ctx.restore();
  }
  /** dark blurred backdrop of an arbitrary draw (world) */
  let BB = null;
  function blurred(ctx, draw, blur = 5, dark = 0.45) {
    if (!BB) BB = OC.makeCanvas(540, 960);
    const b = BB.getContext('2d'); b.setTransform(1.5, 0, 0, 1.5, 0, 0); b.clearRect(0, 0, 360, 640); draw(b);
    ctx.save(); ctx.filter = `blur(${blur}px)`; ctx.drawImage(BB, -8, -8, 376, 656); ctx.restore();
    ctx.fillStyle = `rgba(12,16,20,${dark})`; ctx.fillRect(0, 0, 360, 640);
  }
  function touch(ctx, f) {
    if (!f || f.alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = f.alpha;
    const pr = f.down ? E.outCubic(clamp(f.sinceChange / 0.15)) : 1 - E.outCubic(clamp(f.sinceChange / 0.25));
    if (f.down && f.sinceChange < 0.45) { const q = f.sinceChange / 0.45; ctx.strokeStyle = rgba(P.glow, 0.8 * (1 - q)); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(f.x, f.y, 8 + q * 16, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(f.x, f.y, 7.5 - pr * 1.5, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${0.35 + pr * 0.3})`; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.restore();
  }
  function statusBar(ctx, time, col = P.text) {
    stxt(ctx, time, 18, 15, { font: SANS(700, 9.5), color: col });
    ctx.save(); ctx.fillStyle = col; for (let i = 0; i < 4; i++) { rr(ctx, 304 + i * 3.3, 13 - i * 1.6, 2.2, 2.6 + i * 1.6, 0.6); ctx.fill(); }
    ctx.strokeStyle = col; ctx.lineWidth = 0.9; rr(ctx, 322, 7.2, 15, 7.6, 2); ctx.stroke(); rr(ctx, 323.6, 8.8, 9.5, 4.4, 1); ctx.fill(); ctx.restore();
  }
  const itemD = (ctx, id, x, y, s) => V.item(ctx, id, x, y, s, { mode: 'cel', outline: '#3a2a22', lw: 1.0 });

  /** world-space emote */
  function emote(ctx, kind, x, y, p) {
    if (p <= 0 || p >= 1) return;
    const a = clamp(p / 0.12) * clamp((1 - p) / 0.2), pop = E.outBack(clamp(p / 0.25), 1.4);
    ctx.save(); ctx.translate(x, y - pop * 4); ctx.globalAlpha *= a;
    if (kind === '♥') { for (let i = 0; i < 3; i++) { const q = clamp(p * 1.4 - i * 0.18); if (q <= 0) continue; V.icon(ctx, 'heart', (i - 1) * 7, -q * 16, 8 - i, i === 1 ? P.red : '#E98A7A'); } }
    else if (kind === 'zzz') { for (let i = 0; i < 3; i++) { const q = (p * 1.6 + i * 0.33) % 1; stxt(ctx, 'z', i * 4 + q * 6, -q * 14, { font: SERIF(7 + i * 1.5), color: P.text, alpha: Math.sin(q * Math.PI) }); } }
    else { ctx.beginPath(); ctx.arc(0, -10, 8, 0, TAU); ctx.fillStyle = 'rgba(16,20,24,0.7)'; ctx.fill(); ctx.strokeStyle = P.gold; ctx.lineWidth = 1; ctx.stroke(); text(ctx, kind, 0, -9.5, { font: SANS(900, 10), color: kind === '!' ? P.gold : P.text, align: 'center', base: 'middle' }); }
    ctx.restore();
  }

  OC.WS = { P, SANS, SERIF, ZSERIF, ST, DES, ch, stxt, sicon, slate, brackets, hairline, diamond, prompt, tabs, blurred, touch, statusBar, itemD, emote };
})();
