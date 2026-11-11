/* OC Shimeji — extended 2D character rig (Phase 3).
 * Same coordinate system as the Phase-2 rig (feet at 0,0; rig units; −y is up) so the world,
 * portraits and pet export keep working. Adds:
 *   proportions  headSize bodyW bodyH legLen earSize tailSize
 *   face         eyeStyle eyeSize eyeGap eyeY eyeRot browStyle browY mouthStyle mouthY mouthSize noseStyle cheekStyle cheekSize
 *   fur pattern  furPattern patternCol
 *   parts        player images on anchors (head / face / body / tail / earL / earR / handL / handR / feet)
 *                with x, y, scale, rot, flip, opacity, z layer (back|body|head|face|front), mirror,
 *                and slot replacement (eyes / mouth / ears / tail / brows replace the built-in shape)
 * Parts are drawn inside the transform of their anchor, so they follow bob, tilt, turning and
 * walking — they cannot float away from the body.
 */
(function () {
  'use strict';
  const { TAU, clamp, mix, rgba, ellipse, rr } = OC;
  const V = OC.V;
  const ANCHORS = [['head', '頭'], ['face', '臉'], ['body', '身體'], ['tail', '尾巴根部'], ['earL', '左耳'], ['earR', '右耳'], ['handL', '左手'], ['handR', '右手'], ['feet', '腳底']];
  const SLOTS = [['accessory', '飾品'], ['hat', '帽子'], ['clothing', '服裝'], ['faceacc', '臉部飾品'], ['back', '背後（翅膀…）'], ['held', '手持物'], ['pattern', '花紋貼圖'], ['eyes', '眼睛（取代）'], ['mouth', '嘴巴（取代）'], ['ears', '耳朵（取代）'], ['tail', '尾巴（取代）'], ['brows', '眉毛（取代）']];
  const SLOT_DEFAULT = { accessory: ['head', 'front'], hat: ['head', 'front'], clothing: ['body', 'body'], faceacc: ['face', 'face'], back: ['body', 'back'], held: ['handR', 'front'], pattern: ['body', 'body'], eyes: ['face', 'face'], mouth: ['face', 'face'], ears: ['earR', 'head'], tail: ['tail', 'back'], brows: ['face', 'face'] };
  const REPLACE = new Set(['eyes', 'mouth', 'ears', 'tail', 'brows']);
  const EYE_STYLES = [['dot', '豆豆眼'], ['round', '水汪汪'], ['big', '大眼'], ['sparkle', '閃亮'], ['sleepy', '睏睏'], ['line', '瞇瞇眼']];
  const BROW_STYLES = [['none', '無'], ['soft', '柔和'], ['thick', '粗眉'], ['angled', '上揚']];
  const MOUTH_STYLES = [['cat', '貓嘴'], ['smile', '微笑'], ['flat', '一字'], ['grin', '咧嘴'], ['o', '圓嘴'], ['tongue', '吐舌']];
  const NOSE_STYLES = [['dot', '小圓'], ['none', '無'], ['triangle', '三角'], ['heart', '愛心']];
  const CHEEK_STYLES = [['round', '暈染'], ['blush', '圓腮紅'], ['swirl', '漩渦'], ['none', '無']];
  const FUR_PATTERNS = [['none', '無'], ['spots', '斑點'], ['patch', '眼罩斑'], ['socks', '白襪'], ['belly', '肚肚'], ['stripes', '虎斑']];

  const flat = (base, shade) => ({ mode: 'flat', base, shade: shade || mix(base, '#3a2030', 0.22), dx: 2, dy: 2.2 });
  const P = (ctx, fn, m) => V.paint(ctx, fn, m);
  const El = (ctx, cx, cy, rx, ry, rot = 0) => (ox, oy) => ellipse(ctx, cx + ox, cy + oy, rx, ry, rot);

  // ---------------- eyes ----------------
  function eye(ctx, L, s, style, open, side) {
    const col = L.eye, sz = L.eyeSize || 1;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round';
    if (style === 'line' || style === 'happy' || open < 0.2) {
      ctx.lineWidth = 1.6; ctx.beginPath();
      if (style === 'line' || style === 'happy') { ctx.moveTo(-2.9 * sz, 1.2); ctx.quadraticCurveTo(0, -2.6 * sz, 2.9 * sz, 1.2); }
      else { ctx.moveTo(-2.6 * sz, 0.5); ctx.quadraticCurveTo(0, 1.8, 2.6 * sz, 0.5); }
      ctx.stroke(); return;
    }
    if (style === 'sleepy') { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2.8 * sz, 0.6); ctx.quadraticCurveTo(0, 2.4 * sz, 2.8 * sz, 0.6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-2.6 * sz, 0.6); ctx.lineTo(2.6 * sz, 0.6); ctx.stroke(); return; }
    const lx = (s.lookX || 0) * 0.6, ly = (s.lookY || 0) * 0.5, wide = style === 'wide' ? 1.25 : 1;
    if (style === 'round') {
      const h = 4.5 * sz * wide * open;
      ctx.save(); ellipse(ctx, 0, 0, 3.3 * sz * wide, h); ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
      ellipse(ctx, lx, 0.6 + ly, 2.6 * sz, 3.5 * sz); ctx.fillStyle = L.iris || mix(col, '#3F8F9A', 0.6); ctx.fill();
      ellipse(ctx, lx, 0.4 + ly, 1.2 * sz, 1.7 * sz); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#fff'; ellipse(ctx, lx - 0.9, -1.2, 0.9 * sz, 0.9 * sz); ctx.fill(); ctx.restore();
      ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(0, 0, 3.3 * sz * wide, h, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); return;
    }
    if (style === 'big') {
      const rx = 3.4 * sz * wide, ry = 3.9 * sz * wide * open;
      ellipse(ctx, 0, 0, rx, ry); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 0.9; ctx.stroke();
      ctx.save(); ellipse(ctx, 0, 0, rx, ry); ctx.clip(); ellipse(ctx, lx * 1.4, 0.6 + ly, 2 * sz, 2.3 * sz); ctx.fillStyle = col; ctx.fill(); ctx.fillStyle = '#fff'; ellipse(ctx, lx * 1.4 - 0.7, -0.6, 0.7 * sz, 0.7 * sz); ctx.fill(); ctx.restore(); return;
    }
    // dot / sparkle / wide
    ellipse(ctx, lx, ly, 1.9 * sz * wide, 2.7 * sz * wide * open); ctx.fill();
    ctx.fillStyle = '#fff';
    if (style === 'sparkle' || s.eyes === 'sparkle') { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 0.35 : 1.3 * sz; ctx.lineTo(lx - 0.5 + Math.cos(a) * r, -0.9 + Math.sin(a) * r); } ctx.fill(); }
    else { ellipse(ctx, lx - 0.6, -1.1 * open, 0.75 * sz, 0.75 * sz * open); ctx.fill(); }
  }
  function mouth(ctx, L, s, style, t) {
    ctx.save(); const k = L.mouthSize || 1; ctx.scale(k, k);
    ctx.strokeStyle = L.eye; ctx.fillStyle = L.eye; ctx.lineWidth = 1.25; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (style) {
      case 'smile': ctx.beginPath(); ctx.moveTo(-2.8, -0.4); ctx.quadraticCurveTo(0, 2.8, 2.8, -0.4); ctx.stroke(); break;
      case 'grin': ctx.beginPath(); ctx.moveTo(-3.4, -0.6); ctx.quadraticCurveTo(0, 4.2, 3.4, -0.6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-2.6, -0.4, 5.2, 0.9); break;
      case 'o': ellipse(ctx, 0, 0.6, 1.5, 1.9); ctx.fill(); break;
      case 'open': ctx.beginPath(); ctx.moveTo(-3.2, -0.5); ctx.quadraticCurveTo(0, 5, 3.2, -0.5); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#F2788A'; ellipse(ctx, 0, 2.3, 1.7, 1); ctx.fill(); break;
      case 'flat': ctx.beginPath(); ctx.moveTo(-2, 0.4); ctx.lineTo(2, 0.4); ctx.stroke(); break;
      case 'tongue': ctx.beginPath(); ctx.moveTo(-2.6, 0); ctx.quadraticCurveTo(-1.3, 1.3, 0, 0); ctx.quadraticCurveTo(1.3, 1.3, 2.6, 0); ctx.stroke(); ctx.fillStyle = '#F2788A'; ellipse(ctx, 0.4, 1.9, 1.2, 1.3); ctx.fill(); break;
      case 'chew': { const c = Math.abs(Math.sin((t || 0) * (s.chewRate || 14))); ellipse(ctx, 0, 0.5, 1.9, 0.4 + c * 1.5); ctx.fill(); break; }
      case 'frown': ctx.beginPath(); ctx.moveTo(-2.4, 1.2); ctx.quadraticCurveTo(0, -0.8, 2.4, 1.2); ctx.stroke(); break;
      case 'wave': ctx.beginPath(); ctx.moveTo(-3, 0); for (let i = 0; i <= 6; i++) ctx.lineTo(-3 + i, i % 2 ? 0.9 : -0.2); ctx.stroke(); break;
      default: ctx.beginPath(); ctx.moveTo(-2.8, -0.2); ctx.quadraticCurveTo(-1.4, 1.7, 0, -0.1); ctx.quadraticCurveTo(1.4, 1.7, 2.8, -0.2); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------- parts (player images) ----------------
  /** draw one part image centred at the current origin */
  function partImg(ctx, p, img, flipX) {
    if (!img) return;
    const w = img.width, h = img.height, k = (24 * (p.scale || 1)) / Math.max(w, h);
    ctx.save(); ctx.translate(p.x || 0, p.y || 0); ctx.rotate(((p.rot || 0) * Math.PI) / 180);
    ctx.scale((p.flip ? -1 : 1) * (flipX ? -1 : 1) * k, k); ctx.globalAlpha *= p.opacity == null ? 1 : p.opacity;
    ctx.drawImage(img, -w / 2, -h / 2); ctx.restore();
  }
  function partsAt(o, anchor, z) { return (o.parts || []).filter((p) => p.visible !== false && p.anchor === anchor && (z == null || (p.z || 'front') === z) && !REPLACE.has(p.slot)); }
  function replaced(o, slot) { return (o.parts || []).find((p) => p.visible !== false && p.slot === slot); }

  /**
   * draw(ctx, L, s, x, y, sc, t, o)
   *   L look (rig params), s state (face, back, walk, phase, breath, blink, eyes, mouth, lift, squash, lean,
   *   tilt, armL, armR, tail, blush, lookX, lookY, bounce, sway, brows, sweat, shock, zzz), o = { parts, img(id) }
   */
  /** props in the hands and comic marks around the head (hearts, anger vein, Zzz, notes …). G = where the head / body are, in rig units
   *  around the feet: { hx, headY, Hrx, Hry, bodyY, fx (facing −1…1), back }. Used by the rig and by picture characters (13.0). */
  function marks(ctx, s, t, G) {
    const { hx, headY, Hrx, Hry, bodyY, fx, back } = G;
    if (s.book && back < 0.5) { ctx.save(); ctx.translate(fx * 3, bodyY + 3); ctx.fillStyle = '#F26B5B'; ctx.strokeStyle = '#8E3A33'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-6, -2.5); ctx.lineTo(0, -1.2); ctx.lineTo(6, -2.5); ctx.lineTo(6, 2.5); ctx.lineTo(0, 3.6); ctx.lineTo(-6, 2.5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#FFF7EC'; ctx.fillRect(-5.2, -1.6, 4.6, 3.6); ctx.fillRect(0.6, -1.6, 4.6, 3.6); ctx.restore(); }
    if (s.rod) { ctx.save(); ctx.strokeStyle = '#8A5A3C'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(10, bodyY + 4); ctx.lineTo(26, bodyY - 26 + (s.rodBob || 0)); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(26, bodyY - 26 + (s.rodBob || 0)); ctx.lineTo(30, bodyY + 10); ctx.stroke(); ctx.fillStyle = '#F26B5B'; ctx.beginPath(); ctx.arc(30, bodyY + 10 + (s.rodBob || 0) * 0.5, 1.4, 0, TAU); ctx.fill(); ctx.restore(); }
    if (s.pan) { ctx.save(); ctx.translate(11 + fx * 2, bodyY + 3); ctx.fillStyle = '#556080'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.2, 0, 0, TAU); ctx.fill(); ctx.fillRect(5, -0.6, 7, 1.2); ctx.fillStyle = '#F2C36B'; ctx.beginPath(); ctx.ellipse(0, -0.8, 4, 1.2, 0, 0, TAU); ctx.fill(); const q = (t * 1.5) % 1; ctx.fillStyle = 'rgba(255,255,255,' + (0.7 - q * 0.7) + ')'; ctx.beginPath(); ctx.arc(-1 + q * 2, -4 - q * 8, 1.4, 0, TAU); ctx.fill(); ctx.restore(); }
    if (s.can) { ctx.save(); ctx.translate(11 + fx * 2, bodyY + 4); ctx.fillStyle = '#5BC0EB'; ctx.strokeStyle = '#2F7EA8'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.rect(-3, -3, 6, 5); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(3, -1); ctx.lineTo(7, -3.5); ctx.stroke(); const q = (t * 2) % 1; ctx.fillStyle = 'rgba(127,196,245,' + (1 - q) + ')'; ctx.fillRect(7, -3 + q * 6, 0.8, 1.4); ctx.restore(); }
    if (s.thought) { const q = (t * 0.5) % 1; ctx.fillStyle = rgba('#9AA3B5', 0.8); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(10 + i * 3.2, headY - Hry - 1 - i * 3 - q * 1.5, 0.8 + i * 0.45, 0, Math.PI * 2); ctx.fill(); } }
    if (s.sketch && back < 0.5) { ctx.save(); ctx.translate(fx * 3 - 1, bodyY + 2); ctx.fillStyle = '#FFF7EC'; ctx.strokeStyle = '#B07E4B'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.rect(-6, -4, 11, 8); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#9AA3B5'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-4, 1); ctx.quadraticCurveTo(-1, -3, 3, 0); ctx.stroke(); ctx.fillStyle = '#F26B5B'; ctx.save(); ctx.translate(7, -2 + Math.sin(t * 7) * 0.8); ctx.rotate(0.7); ctx.fillRect(-0.6, -4, 1.2, 6); ctx.restore(); ctx.restore(); }
    if (s.held) { const ic = OC.Style && OC.Style.itemCanvas ? OC.Style.itemCanvas(s.held, 48) : null; if (ic) { const hx2 = (s.armR != null && s.armR < -0.6 ? 6 : 11) + fx * 2, hy2 = bodyY - (s.armR != null && s.armR < -0.6 ? 6 : 0); ctx.drawImage(ic, hx2 - 6, hy2 - 8, 12, 12); } }
    // 11.0 comic marks: hearts, anger vein, dizzy spiral, idea bulb, steam puff, bubbles, a cup
    if (s.fxHeart) { for (let i = 0; i < 3; i++) { const q = (t * 0.8 + i * 0.34) % 1; ctx.save(); ctx.globalAlpha = Math.sin(q * Math.PI); V.icon(ctx, 'heart', hx + (i - 1) * 7 + Math.sin(t * 3 + i) * 2, headY - Hry - 2 - q * 14, 4.2 + i * 0.5, '#FF7A9A'); ctx.restore(); } }
    if (s.fxAnger) { ctx.save(); ctx.translate(hx + Hrx * 0.62, headY - Hry * 0.7); ctx.strokeStyle = '#E5534B'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; const k = 1 + Math.sin(t * 14) * 0.12; ctx.scale(k, k); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.moveTo(a * 0.8, b * 0.8); ctx.quadraticCurveTo(a * 3.4, b * 0.4, a * 3.6, b * 3.4); ctx.stroke(); } ctx.restore(); }
    if (s.fxSpiral) { ctx.save(); ctx.translate(hx, headY - Hry - 5); ctx.strokeStyle = '#9B7BE0'; ctx.lineWidth = 1.1; ctx.beginPath(); for (let i = 0; i < 28; i++) { const a = i * 0.45 + t * 6, r = 0.4 + i * 0.22; const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.5; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); ctx.restore(); }
    if (s.fxBulb) { const q = Math.min(1, (t * 2.2) % 3); ctx.save(); ctx.translate(hx + 1, headY - Hry - 7 - Math.min(2, q * 3)); ctx.fillStyle = '#FFD23F'; ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#B07E4B'; ctx.fillRect(-1.4, 3, 2.8, 1.8); ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 0.9; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.7; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a) * 7.2, Math.sin(a) * 7.2); ctx.stroke(); } ctx.restore(); }
    if (s.fxPuff) { for (let i = 0; i < 3; i++) { const q = (t * 1.1 + i * 0.3) % 1; ctx.fillStyle = rgba('#FFFFFF', 0.8 * (1 - q)); ctx.beginPath(); ctx.arc(hx + fx * 6 + 10 + q * 8, headY + 2 - q * 4 + i * 1.2, 1.6 + q * 2.4, 0, TAU); ctx.fill(); } }
    if (s.fxBubbles) { for (let i = 0; i < 4; i++) { const q = (t * 0.6 + i * 0.25) % 1; ctx.strokeStyle = rgba('#9AD7F5', 1 - q); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(hx + 9 + q * 9 + i * 1.5, headY + 3 - q * 16 - i * 2, 1.6 + i * 0.7, 0, TAU); ctx.stroke(); } }
    if (s.fxCup) { ctx.save(); ctx.translate(hx + 8 + fx * 2, bodyY - 5); ctx.fillStyle = '#FFF7EC'; ctx.strokeStyle = '#B07E4B'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.rect(-2.6, -2.6, 5.2, 5); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(2.9, 0, 1.6, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.strokeStyle = rgba('#FFFFFF', 0.8); for (let i = 0; i < 2; i++) { const q = (t * 0.9 + i * 0.5) % 1; ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.moveTo(-1 + i * 2, -3 - q * 4); ctx.quadraticCurveTo(0 + i * 2, -5 - q * 4, -1 + i * 2, -7 - q * 4); ctx.stroke(); } ctx.restore(); }
    if (s.gloom) { ctx.save(); ctx.strokeStyle = rgba('#7A82A8', 0.75); ctx.lineWidth = 0.9; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(hx + i * 5, headY - Hry - 1); ctx.lineTo(hx + i * 5, headY - Hry - 6 - Math.abs(i) * -1.5); ctx.stroke(); } ctx.restore(); }
    if (s.notes) { const q = (t * 0.7) % 1; ctx.save(); ctx.fillStyle = rgba('#9B7BE0', 1 - q); ctx.font = 'bold 8px sans-serif'; ctx.fillText('♪', hx + 12 + q * 5, headY - Hry + 2 - q * 12); ctx.fillStyle = rgba('#F48FB1', Math.max(0, 0.9 - ((q + 0.5) % 1))); ctx.fillText('♫', hx + 17 + ((q + 0.5) % 1) * 4, headY - Hry - 4 - ((q + 0.5) % 1) * 10); ctx.restore(); }
    if (s.sparkle) { ctx.save(); for (let i = 0; i < 3; i++) { const q = (t * 0.9 + i * 0.33) % 1, a = i * 2.1 + t * 0.5; ctx.fillStyle = rgba('#FFC93C', 1 - q); const px = hx + Math.cos(a) * (Hrx + 4), py = headY - Math.abs(Math.sin(a)) * Hry - 3 - q * 4, r = 1.6 * (1 - q * 0.5); ctx.beginPath(); ctx.moveTo(px, py - r * 2); ctx.lineTo(px + r * 0.6, py - r * 0.6); ctx.lineTo(px + r * 2, py); ctx.lineTo(px + r * 0.6, py + r * 0.6); ctx.lineTo(px, py + r * 2); ctx.lineTo(px - r * 0.6, py + r * 0.6); ctx.lineTo(px - r * 2, py); ctx.lineTo(px - r * 0.6, py - r * 0.6); ctx.closePath(); ctx.fill(); } ctx.restore(); }
    if (s.zzz) { const q = (t * 0.6) % 1; ctx.fillStyle = rgba('#8E7BE0', 1 - q); ctx.font = 'bold 7px sans-serif'; ctx.fillText('z', 12 + q * 6, headY - Hry - q * 10); ctx.fillText('Z', 16 + q * 8, headY - Hry - 6 - q * 10); }
  }
  function draw(ctx, L, s, x, y, sc, t, o = {}) {
    const img = o.img || ((id) => OC.Assets && OC.Assets.peek(id));
    const fx = s.face || 0, back = s.back || 0, walk = s.walk || 0, ph = s.phase || 0;
    const br = s.breath || 0, lift = s.lift || 0, sq = s.squash || 1, bounce = s.bounce == null ? 1 : s.bounce;
    const stepS = Math.sin(ph * Math.PI), bob = walk * Math.abs(stepS) * 2.2 * bounce;
    const hs = L.headSize || 1, bw0 = 9.6 * (L.bodyW || 1), bh0 = 8.8 * (L.bodyH || 1), leg = L.legLen || 1;
    const shade = mix(L.fur, '#7a4a30', 0.17), fur = flat(L.fur, shade);
    const legH = 6.6 * (0.6 + 0.4 * leg) + (leg - 1) * 3;
    const bodyY0 = -0.8 - (leg - 1) * 4.2 - bh0;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    if (!s.noShadow) V.shadow(ctx, 0, 0.5, 15 * (1 - clamp(lift / 50) * 0.5), 4.2, 0.22 * (1 - clamp(lift / 60) * 0.6), '#2c5a3a');
    ctx.translate(s.shiftX || 0, -lift); ctx.rotate((s.lean || 0) + walk * Math.sin(ph * Math.PI) * (s.sway || 0)); ctx.scale(1 / Math.sqrt(sq), sq);
    const bodyY = bodyY0 - bob * 0.6 + br * 0.15;
    const Hrx = 17.5 * hs * (1 + br * 0.006), Hry = 15.6 * hs;
    const headY = bodyY0 - bh0 - (Hry - 4) - bob + br * 0.55 + (s.headDy || 0);
    const hx = fx * 1.4 + (s.headDx || 0);
    const bw = bw0 * (1 + br * 0.018), bh = bh0 * (1 + br * 0.03);
    const tailSide = fx > 0.15 ? -1 : 1, tailAt = [tailSide * 7 * (L.bodyW || 1), bodyY + 4];
    const armEnd = {};
    // ---- back layer ----
    const anchorDraw = (anchor, z, ax, ay, rot, flipX) => { for (const p of partsAt(o, anchor, z)) { ctx.save(); ctx.translate(ax, ay); if (rot) ctx.rotate(rot); partImg(ctx, p, img(p.assetId), flipX); ctx.restore(); } };
    anchorDraw('body', 'back', 0, bodyY, 0); anchorDraw('feet', 'back', 0, 0, 0);
    if (back < 0.5) drawTail();
    anchorDraw('tail', 'back', tailAt[0], tailAt[1], 0, tailSide < 0);
    // legs / feet
    for (const side of [-1, 1]) {
      const lx = side * 4.6 * (L.bodyW || 1) * (1 - 0.45 * Math.abs(fx)) + fx * walk * stepS * side * 3.2;
      const ly = -2.2 - Math.max(0, walk * stepS * -side) * 2.4 * bounce - Math.max(0, (side < 0 ? s.legL : s.legR) || 0);
      const legCol = L.furPattern === 'socks' ? L.patternCol : (L.legs || L.fur);
      P(ctx, (ox, oy) => rr(ctx, lx - 3.1 + ox, ly - legH + 2.6 + oy, 6.2, legH, 3), flat(legCol, mix(legCol, '#7a4a30', 0.17)));
    }
    // body
    const bodyCol = L.shirt && L.shirt !== 'none' ? L.shirt : L.fur, clothed = bodyCol !== L.fur;
    const bodyShade = clothed ? mix(bodyCol, '#20202a', 0.28) : shade;
    P(ctx, El(ctx, 0, bodyY, bw, bh), flat(bodyCol, bodyShade));
    if (clothed && back < 0.5) {
      ctx.save(); ellipse(ctx, 0, bodyY, bw, bh); ctx.clip();
      if (L.pattern === 'stripe') { ctx.fillStyle = rgba('#ffffff', 0.55); for (let k = -3; k <= 3; k++) ctx.fillRect(-bw, bodyY + k * 3.6, bw * 2, 1.6); }
      if (L.pattern === 'star') V.icon(ctx, 'star', fx * 3, bodyY + 2, 7, rgba('#ffffff', 0.85));
      if (L.pattern === 'dots') { ctx.fillStyle = rgba('#ffffff', 0.7); for (let k = -2; k <= 2; k++) for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.arc(fx * 2 + k * 3.6 + (j % 2) * 1.8, bodyY + j * 3.4, 0.9, 0, TAU); ctx.fill(); } }
      if (L.pattern === 'heart') V.icon(ctx, 'heart', fx * 3, bodyY + 2, 7, rgba('#ffffff', 0.85));
      ctx.restore();
      ctx.fillStyle = L.fur; ctx.beginPath(); ctx.moveTo(-4 + fx * 2, bodyY - bh + 1.5); ctx.lineTo(fx * 2, bodyY - bh + 5); ctx.lineTo(4 + fx * 2, bodyY - bh + 1.5); ctx.closePath(); ctx.fill();
    } else if (back < 0.5) { ctx.fillStyle = rgba(L.furPattern === 'belly' ? L.patternCol : '#ffffff', L.furPattern === 'belly' ? 1 : 0.85); ellipse(ctx, fx * 3, bodyY + 2 * (L.bodyH || 1), 6 * (L.bodyW || 1) * (1 - Math.abs(fx) * 0.3), 5.5 * (L.bodyH || 1)); ctx.fill(); }
    anchorDraw('body', 'body', 0, bodyY, 0);
    // arms (+ hand anchors)
    for (const side of [-1, 1]) {
      const sw = (side < 0 ? s.armL : s.armR) ?? walk * stepS * side * 0.6;
      ctx.save(); ctx.translate(side * (bw - 1.4) * (1 - 0.3 * Math.abs(fx)), bodyY - 3); ctx.rotate(side * 0.35 + sw * side);
      P(ctx, El(ctx, 0, 3.6, 2.9, 4.4), flat(bodyCol, bodyShade));
      if (clothed) { ctx.fillStyle = L.fur; ellipse(ctx, 0, 7.2, 2.3, 1.9); ctx.fill(); }
      anchorDraw(side < 0 ? 'handL' : 'handR', null, 0, 7.6, 0);
      ctx.restore();
    }
    // scarf
    if (L.acc === 'scarf' && back < 0.95) {
      const sy = bodyY - bh + 2, dir = fx > 0.2 ? -1 : 1, accCol = L.accCol || '#F26B5B';
      const tail = []; for (let i = 0; i <= 8; i++) { const q = i / 8; tail.push([dir * (3 + q * 6), sy + 2 + q * 6 + Math.sin(t * 9 - q * 5) * 0.8 * q]); }
      ctx.beginPath(); tail.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.strokeStyle = accCol; ctx.lineWidth = 4.4; ctx.lineCap = 'round'; ctx.stroke();
      P(ctx, (ox, oy) => rr(ctx, -9.5 + ox, sy - 2.4 + oy, 19, 4.8, 2.4), flat(accCol, mix(accCol, '#20202a', 0.3)));
    }
    // ---- head ----
    ctx.save(); ctx.translate(hx, headY); ctx.rotate(s.tilt || 0);
    const earsRep = replaced(o, 'ears');
    const earPos = (side) => [side * Hrx * 0.56 + fx * 4.2, -Hry * 0.62];
    for (const side of [-1, 1]) {
      const [ex, ey] = earPos(side), ang = side * (0.32 + ((side < 0 ? s.earL : s.earR) ?? s.ear ?? 0));
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang); ctx.scale((1 - Math.max(0, side * fx) * 0.18) * (L.earSize || 1), L.earSize || 1);
      if (earsRep) partImg(ctx, Object.assign({}, earsRep, { x: earsRep.x || 0, y: (earsRep.y || 0) - 6 }), img(earsRep.assetId), side < 0 && earsRep.mirror !== false);
      else builtinEar(ctx, L, side, fur);
      ctx.restore();
      anchorDraw(side < 0 ? 'earL' : 'earR', null, ex, ey, ang);
    }
    P(ctx, El(ctx, 0, 0, Hrx, Hry), fur);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ellipse(ctx, -Hrx * 0.35, -Hry * 0.55, Hrx * 0.32, Hry * 0.18, -0.3); ctx.fill();
    // fur pattern on the head
    if (L.furPattern && L.furPattern !== 'none') { ctx.save(); ellipse(ctx, 0, 0, Hrx, Hry); ctx.clip(); ctx.fillStyle = L.patternCol || '#E7A86A';
      if (L.furPattern === 'spots') for (const [a, b, r] of [[-9, -8, 3.4], [8, -10, 2.6], [12, -2, 2.2], [-13, 1, 2]]) { ellipse(ctx, a + fx * 4, b, r * hs, r * hs); ctx.fill(); }
      if (L.furPattern === 'patch' && back < 0.5) { ellipse(ctx, 7 * hs + fx * 6.5, 1.5, 6.5 * hs, 5.8 * hs); ctx.fill(); }
      if (L.furPattern === 'stripes') for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 4.5 - 1.6 + fx * 3, -Hry); ctx.lineTo(k * 4.5 + fx * 3, -Hry * 0.45); ctx.lineTo(k * 4.5 + 1.6 + fx * 3, -Hry); ctx.fill(); }
      ctx.restore(); }
    anchorDraw('head', 'head', 0, 0, 0);
    // face
    const fa = 1 - clamp(back * 1.6);
    if (fa > 0) { ctx.save(); ctx.globalAlpha *= fa; face(ctx, L, s, t, o, img, hs, Hrx); ctx.restore(); anchorDraw('face', 'face', fx * 6.5, (L.eyeY || 0) + 1.5, 0); }
    // built-in hats / clips
    if (L.acc === 'beanie') {
      const ac = L.accCol || '#3FC1B0';
      P(ctx, (ox, oy) => { ctx.beginPath(); ctx.ellipse(ox, -4.5 * hs + oy, Hrx * 0.95, Hry * 0.8, 0, Math.PI, TAU); ctx.closePath(); }, flat(ac, mix(ac, '#20202a', 0.25)));
      P(ctx, (ox, oy) => rr(ctx, -Hrx * 0.97 + ox, -6.5 * hs + oy, Hrx * 1.94, 4.6, 2.3), flat(mix(ac, '#ffffff', 0.4), ac));
      P(ctx, El(ctx, (s.tail || 0) * 2, -Hry * 0.8 - 5, 3.8, 3.4), flat('#FFFFFF', '#E6DCD8'));
    }
    if (L.acc === 'crown' && back < 0.9) { const cols = ['#FF9EB5', '#FFD23F', '#FFFFFF', '#B7A3F0', '#7FD3F7']; for (let i = 0; i < 9; i++) { const a = Math.PI * (1.08 + i * 0.105), x = Math.cos(a) * Hrx * 0.92, y = -4 + Math.sin(a) * Hry * 0.72; ctx.fillStyle = '#6CCB5F'; ellipse(ctx, x, y + 1, 2, 1.2); ctx.fill(); ctx.fillStyle = cols[i % cols.length]; for (let k = 0; k < 5; k++) { const b = (k * TAU) / 5; ellipse(ctx, x + Math.cos(b) * 1.3, y - 0.6 + Math.sin(b) * 1.3, 1.1, 1.1); ctx.fill(); } ctx.fillStyle = '#FFB347'; ellipse(ctx, x, y - 0.6, 0.8, 0.8); ctx.fill(); } }
    if (L.acc === 'bow' && back < 0.95) { const ac = L.accCol || '#F26B7A'; ctx.save(); ctx.translate(Hrx * 0.35, -Hry * 0.82); P(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(-7 + ox, -6 + oy, -8 + ox, 1 + oy); ctx.quadraticCurveTo(-4 + ox, 3 + oy, ox, oy); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(7 + ox, -6 + oy, 8 + ox, 1 + oy); ctx.quadraticCurveTo(4 + ox, 3 + oy, ox, oy); }, flat(ac, mix(ac, '#20202a', 0.3))); P(ctx, El(ctx, 0, 0, 2, 2), flat(mix(ac, '#ffffff', 0.25), ac)); ctx.restore(); }
    if (L.acc === 'sunhat') { const ac = L.accCol || '#F2D28B'; P(ctx, El(ctx, 0, -Hry * 0.55, Hrx * 1.35, 4.2), flat(ac, mix(ac, '#6b4a2a', 0.3))); P(ctx, (ox, oy) => { ctx.beginPath(); ctx.ellipse(ox, -Hry * 0.6 + oy, Hrx * 0.72, Hry * 0.62, 0, Math.PI, TAU); ctx.closePath(); }, flat(ac, mix(ac, '#6b4a2a', 0.3))); ctx.fillStyle = '#F26B7A'; ctx.fillRect(-Hrx * 0.72, -Hry * 0.66, Hrx * 1.44, 2.2); }
    if (L.acc === 'glasses' && back < 0.5) { ctx.save(); ctx.translate(fx * 6.5, (L.eyeY || 0) + 1.5); ctx.strokeStyle = '#3B2B25'; ctx.lineWidth = 1.1; const g = 5.2 + (L.eyeGap || 0); for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * g, 0, 3.6, 0, TAU); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-g + 3.6, -0.5); ctx.lineTo(g - 3.6, -0.5); ctx.stroke(); ctx.restore(); }
    if (L.acc === 'hood') { const ac = L.accCol || '#3FC1B0'; P(ctx, (ox, oy) => { ctx.beginPath(); ctx.ellipse(ox, -2 + oy, Hrx * 1.08, Hry * 1.02, 0, Math.PI * 0.92, Math.PI * 2.08); ctx.quadraticCurveTo(Hrx * 0.5 + ox, -Hry * 0.55 + oy, ox, -Hry * 0.6 + oy); ctx.quadraticCurveTo(-Hrx * 0.5 + ox, -Hry * 0.55 + oy, -Hrx * 1.05 + ox, 1 + oy); ctx.closePath(); }, flat(ac, mix(ac, '#20202a', 0.3))); }
    if (L.clip && L.clip !== 'none' && back < 0.6) { ctx.save(); ctx.translate(-Hrx * 0.6 + fx * 4, -Hry * 0.6); ctx.rotate(-0.3); if (L.clip === 'star') V.icon(ctx, 'star', 0, 0, 8.5, '#FFD23F'); else if (L.clip === 'leaf') { ctx.fillStyle = '#7CCB5A'; ellipse(ctx, 0, 0, 4.4, 2.2, -0.5); ctx.fill(); } else if (L.clip === 'flower') { for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5; ctx.fillStyle = '#fff'; ellipse(ctx, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 1.7, 1.7); ctx.fill(); } ctx.fillStyle = '#FFC93C'; ellipse(ctx, 0, 0, 1.4, 1.4); ctx.fill(); } ctx.restore(); }
    anchorDraw('head', 'front', 0, 0, 0);
    if (back >= 0.5) anchorDraw('face', 'front', fx * 6.5, 0, 0);
    ctx.restore();
    if (back >= 0.5) drawTail();
    anchorDraw('tail', 'front', tailAt[0], tailAt[1], 0, tailSide < 0);
    anchorDraw('body', 'front', 0, bodyY, 0); anchorDraw('feet', 'front', 0, 0, 0);
    // comic overlays
    marks(ctx, s, t, { hx, headY, Hrx, Hry, bodyY, fx, back });   // props + comic marks (shared with picture characters, see char/puppet13.js)
    ctx.restore();

    function drawTail() {
      const rep = replaced(o, 'tail');
      ctx.save(); ctx.translate(tailAt[0], tailAt[1]);
      if (rep) { ctx.rotate(tailSide * (0.3 + (s.tail || 0))); partImg(ctx, rep, img(rep.assetId), tailSide < 0); ctx.restore(); return; }
      const side = tailSide, wag = s.tail || 0, ts = L.tailSize || 1; ctx.rotate(side * (0.5 + wag)); ctx.scale(ts, ts);
      if (L.tail === 'puff') P(ctx, El(ctx, side * 2, -4, 5, 4.6), fur);
      else if (L.tail !== 'none') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(side * 6, -2, side * 9, -9, side * 6 + wag * 4, -15); ctx.strokeStyle = L.fur; ctx.lineCap = 'round'; ctx.lineWidth = 4.4; ctx.stroke(); if (L.furPattern === 'stripes' || L.furPattern === 'spots') { ctx.strokeStyle = L.patternCol; ctx.lineWidth = 4.6; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]); } }
      ctx.restore();
    }
  }
  function builtinEar(ctx, L, side, fur) {
    const inner = { mode: 'flat', base: L.inner || '#FFB8B0', shade: L.inner || '#FFB8B0' };
    const type = L.ears;
    if (type === 'cat') { P(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-7 + ox, 3 + oy); ctx.quadraticCurveTo(-5.5 + ox, -9 + oy, -0.5 + ox, -13.5 + oy); ctx.quadraticCurveTo(5.5 + ox, -8 + oy, 7 + ox, 3 + oy); ctx.closePath(); }, fur); P(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-3.6 + ox, 1 + oy); ctx.quadraticCurveTo(-3 + ox, -6.5 + oy, -0.6 + ox, -9.5 + oy); ctx.quadraticCurveTo(2.8 + ox, -5.5 + oy, 3.6 + ox, 1 + oy); ctx.closePath(); }, inner); }
    else if (type === 'bunny') { ctx.rotate(side * 0.18); P(ctx, El(ctx, 0, -11, 5, 13.5), fur); P(ctx, El(ctx, 0, -10.5, 2.4, 10), inner); }
    else if (type === 'bear') { P(ctx, El(ctx, 0, -3, 6, 6), fur); P(ctx, El(ctx, 0, -2.5, 3.2, 3.2), inner); }
    else if (type === 'fold') { P(ctx, (ox, oy) => { ctx.beginPath(); ctx.moveTo(-6.5 + ox, 3 + oy); ctx.quadraticCurveTo(-5 + ox, -6 + oy, ox, -8 + oy); ctx.quadraticCurveTo(7 + ox, -7 + oy, 5 + ox, 2 + oy); ctx.closePath(); }, fur); }
    else if (type === 'round') { P(ctx, El(ctx, 0, -1, 5, 4.5), fur); }
    else if (type === 'sprout' && side < 0) { ctx.strokeStyle = '#4FA35A'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0.5, -7); ctx.stroke(); P(ctx, El(ctx, -4.2, -8, 4.6, 2.4, 0.35), flat('#7CCB5A', '#4FA35A')); P(ctx, El(ctx, 4.8, -9, 4.6, 2.4, -0.35), flat('#7CCB5A', '#4FA35A')); }
  }
  function face(ctx, L, s, t, o, img, hs, Hrx) {
    const fx = s.face || 0, open = 1 - clamp(s.blink || 0);
    const style = s.eyes && s.eyes !== 'round' ? s.eyes : (L.eyeStyle || 'dot');
    const gap = (7.4 + (L.eyeGap || 0)) * hs, eyeY = 1.5 + (L.eyeY || 0) + (s.lookY || 0) * 0.6;
    const eyesRep = replaced(o, 'eyes'), browsRep = replaced(o, 'brows');
    for (const side of [-1, 1]) {
      const near = side * fx > 0, ex = side * gap * (1 - 0.22 * Math.abs(fx)) + fx * 6.5;
      ctx.save(); ctx.translate(ex, eyeY); ctx.scale(near ? 1 - 0.42 * Math.abs(fx) : 1, 1); ctx.rotate(((L.eyeRot || 0) * side * Math.PI) / 180 * 20);
      if (eyesRep && !(open < 0.2 && !eyesRep.closedId)) partImg(ctx, Object.assign({}, eyesRep, { x: 0, y: 0, scale: (eyesRep.scale || 0.35) }), img(open < 0.2 && eyesRep.closedId ? eyesRep.closedId : eyesRep.assetId), side < 0 && eyesRep.mirror !== false);
      else eye(ctx, L, s, style, open, side);
      ctx.restore();
      // brows
      const bstyle = s.brows || L.browStyle;
      if (browsRep) { ctx.save(); ctx.translate(ex, eyeY - 5.4 + (L.browY || 0)); partImg(ctx, Object.assign({}, browsRep, { x: 0, y: 0, scale: browsRep.scale || 0.3 }), img(browsRep.assetId), side < 0 && browsRep.mirror !== false); ctx.restore(); }
      else if (bstyle && bstyle !== 'none') {
        let rot = 0; if (bstyle === 'up' || bstyle === 'angled') rot -= 0.25 * side; if (bstyle === 'worry') rot += 0.4 * side; if (bstyle === 'angry') rot -= 0.45 * side;
        ctx.save(); ctx.translate(ex, eyeY - 5.4 - (L.browY || 0) - (bstyle === 'up' ? 1.2 : 0)); ctx.rotate(-rot); ctx.strokeStyle = rgba(L.eye, 0.8); ctx.lineCap = 'round'; ctx.lineWidth = bstyle === 'thick' ? 2.2 : 1.3;
        ctx.beginPath(); ctx.moveTo(-2.4, 0.3); ctx.quadraticCurveTo(0, -0.8, 2.4, 0.3); ctx.stroke(); ctx.restore();
      }
      // cheeks
      const cs = L.cheekStyle || 'round';
      if (cs !== 'none' && !(near && Math.abs(fx) > 0.6)) {
        const cx = side * 10.8 * hs * (1 - 0.25 * Math.abs(fx)) + fx * 5.2, cy = eyeY + 4.2, k = L.cheekSize || 1, ca = 0.72 + (s.blush || 0) * 0.25;
        if (cs === 'blush') { ctx.fillStyle = rgba(L.cheek, Math.min(0.95, ca)); ellipse(ctx, cx, cy, 3.3 * k, 2.6 * k); ctx.fill(); }
        else if (cs === 'swirl') { ctx.strokeStyle = rgba(L.cheek, 0.9); ctx.lineWidth = 0.9; ctx.beginPath(); for (let a = 0; a < 9; a += 0.3) ctx.lineTo(cx + Math.cos(a) * a * 0.3 * k, cy + Math.sin(a) * a * 0.25 * k); ctx.stroke(); }
        else { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 3.8 * k); g.addColorStop(0, rgba(L.cheek, ca)); g.addColorStop(1, rgba(L.cheek, 0)); ctx.fillStyle = g; ellipse(ctx, cx, cy, 3.9 * k, 2.6 * k); ctx.fill(); }
        if ((s.blush || 0) > 0.5) { ctx.strokeStyle = rgba(L.cheek, 0.95); ctx.lineWidth = 0.8; for (let q = -1; q <= 1; q++) { ctx.beginPath(); ctx.moveTo(cx + q * 1.5 - 0.6, cy + 0.9); ctx.lineTo(cx + q * 1.5 + 0.6, cy - 0.9); ctx.stroke(); } }
      }
    }
    // nose + mouth
    const mx = fx * 7.4, my = eyeY + 5 + (L.mouthY || 0);
    const ns = L.noseStyle || 'dot';
    ctx.fillStyle = mix(L.cheek, L.eye, 0.3);
    if (ns === 'dot') { ellipse(ctx, mx, my - 2.1, 0.9, 0.6); ctx.fill(); }
    if (ns === 'triangle') { ctx.beginPath(); ctx.moveTo(mx - 1.2, my - 2.7); ctx.lineTo(mx + 1.2, my - 2.7); ctx.lineTo(mx, my - 1.3); ctx.closePath(); ctx.fill(); }
    if (ns === 'heart') V.icon(ctx, 'heart', mx, my - 2.1, 3, ctx.fillStyle);
    const mouthRep = replaced(o, 'mouth');
    ctx.save(); ctx.translate(mx, my);
    if (mouthRep) { const chew = s.mouth === 'chew' ? 0.8 + 0.2 * Math.abs(Math.sin((t || 0) * (s.chewRate || 14))) : 1; ctx.scale(1, chew); partImg(ctx, Object.assign({}, mouthRep, { x: 0, y: 0, scale: mouthRep.scale || 0.35 }), img(mouthRep.assetId), false); }
    else mouth(ctx, L, s, s.mouth || L.mouthStyle || 'cat', t);
    ctx.restore();
    if (s.sweat) { ctx.save(); ctx.translate(13, -8); ctx.fillStyle = '#9FD3FF'; ctx.strokeStyle = '#4C8DD0'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(3, 1, 0, 2.5); ctx.quadraticCurveTo(-3, 1, 0, -4); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (s.tear) { ctx.save(); ctx.fillStyle = '#7FC4F5'; const q = (t * 0.9) % 1; ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.ellipse(-5.5, -4 + q * 6, 0.9, 1.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(5.5, -3 + ((q + 0.5) % 1) * 6, 0.9, 1.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (s.shock) { ctx.save(); ctx.strokeStyle = rgba('#5B6FD6', 0.75); ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 2.4, -12); ctx.lineTo(i * 2.4, -7.5); ctx.stroke(); } ctx.restore(); }
  }
  /** rig-space anchor positions in the neutral pose (for editor handles) */
  function anchorPos(L, anchor) {
    const hs = L.headSize || 1, bh0 = 8.8 * (L.bodyH || 1), leg = L.legLen || 1, bodyY = -0.8 - (leg - 1) * 4.2 - bh0, Hry = 15.6 * hs, Hrx = 17.5 * hs, headY = bodyY - bh0 - (Hry - 4);
    switch (anchor) {
      case 'head': return [0, headY]; case 'face': return [0, headY + 1.5 + (L.eyeY || 0)]; case 'body': return [0, bodyY];
      case 'tail': return [7 * (L.bodyW || 1), bodyY + 4]; case 'earL': return [-Hrx * 0.56, headY - Hry * 0.62]; case 'earR': return [Hrx * 0.56, headY - Hry * 0.62];
      case 'handL': return [-(9.6 * (L.bodyW || 1)) - 2, bodyY + 4]; case 'handR': return [9.6 * (L.bodyW || 1) + 2, bodyY + 4]; default: return [0, 0];
    }
  }
  /** approximate top of the head in rig units (portrait framing) */
  function height(L) { const hs = L.headSize || 1, [, hy] = anchorPos(L, 'head'); return -(hy - 15.6 * hs - (L.ears === 'bunny' ? 24 : 10) * (L.earSize || 1)); }

  OC.Rig = { draw, marks, anchorPos, height, ANCHORS, SLOTS, SLOT_DEFAULT, REPLACE, EYE_STYLES, BROW_STYLES, MOUTH_STYLES, NOSE_STYLES, CHEEK_STYLES, FUR_PATTERNS };
})();
