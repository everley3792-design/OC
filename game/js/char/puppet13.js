/* OC Shimeji 13.0 — OC.Puppet: life for picture characters.
 * A character made from one imported picture has no frames for walking, eating, sleeping … Until the player draws them, the picture itself
 * performs: it leans, hops, squashes and shakes with the action (the body motion of the rig — every action of the game, including the 107
 * of OC.Anim11 — is reused), and the same comic marks appear around it (hearts, Zzz, notes, anger vein, tears, sweat, a thought, a book,
 * a fishing rod …) plus a few of its own (crumbs while eating, "!" when startled, blush lines). So nothing a picture character does is
 * invisible. An action the player DID draw (more than one frame, assigned to that action) plays exactly as drawn — no puppet on top.
 *
 * Also here: the framing of the picture (OC.Puppet.frameOf): flip, zoom, offset, crop and which way the art looks, so walking left / right
 * mirrors correctly. All of it is applied at draw time — the original file is never changed.
 */
(function () {
  'use strict';
  const TAU = Math.PI * 2, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const DEF = { flip: false, zoom: 1, dx: 0, dy: 0, crop: { l: 0, t: 0, r: 0, b: 0 }, faces: 'right' };
  /** the picture's framing with defaults filled in (never writes to the character) */
  function frameOf(c) { const f = (c && c.appearance && c.appearance.frame) || {}; return { flip: !!f.flip, zoom: clamp(+f.zoom || 1, 0.3, 3), dx: clamp(+f.dx || 0, -60, 60), dy: clamp(+f.dy || 0, -60, 60), crop: Object.assign({ l: 0, t: 0, r: 0, b: 0 }, f.crop || {}), faces: ['left', 'front', 'right'].includes(f.faces) ? f.faces : 'right' }; }
  const isDefault = (c) => { const f = frameOf(c), k = f.crop; return !f.flip && f.zoom === 1 && !f.dx && !f.dy && !k.l && !k.t && !k.r && !k.b && f.faces === 'right'; };
  /** should the picture be mirrored for this pose? (the player's own flip, and the direction it walks in) */
  function mirror(c, sp, p) {
    const f = frameOf(c); let m = !!sp.mirror;
    if (!sp.slot || sp.slot === 'any' || sp.slot === 'front') {   // one picture for every direction: turn it to where the character looks
      if (f.faces !== 'front' && (p.back || 0) < 0.5) { const face = p.face == null ? (p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0) : p.face; m = f.faces === 'right' ? face < -0.02 : face > 0.02; }
    }
    return m !== f.flip;
  }

  // ---- extra motion for a rigid picture, on top of the rig's body pose: [dx, dy, rot, squash] as functions of the time in the action
  const sin = Math.sin, abs = Math.abs;
  const hop = (at, f = 6, h = 2.6) => -abs(sin(at * f)) * h;
  const MOVES = {
    eat: (at) => [0, 0, 0.03, 1 + 0.05 * sin(at * 14)], drink: (at) => [0, 0, -0.05 - 0.03 * sin(at * 3), 1], taste: (at) => [0, 0, 0.03, 1 + 0.05 * sin(at * 14)],
    yum: (at) => [0, hop(at, 7, 2.2), 0, 1 + 0.03 * sin(at * 14)], yuck: (at) => [sin(at * 30) * 0.5, 0, -0.06, 0.97],
    sleep: (at) => [0, 1.2, 0.1, 1 + 0.025 * sin(at * 1.7)], nap: (at) => [0, 1.2, 0.1, 1 + 0.025 * sin(at * 1.7)], sit: () => [0, 1.6, 0, 0.95],
    happy: (at) => [0, hop(at, 6, 3), 0, 1], cheer: (at) => [0, hop(at, 8, 3.6), sin(at * 8) * 0.05, 1], proud: (at) => [0, -1, -0.05, 1.03], receive: (at) => [0, hop(at, 6, 2), 0, 1],
    play: (at) => [sin(at * 5) * 1.5, hop(at, 7, 3), sin(at * 5) * 0.1, 1], dance: (at) => [sin(at * 4) * 2, hop(at, 8, 2.4), sin(at * 4) * 0.14, 1], sing: (at) => [0, 0, sin(at * 3) * 0.06, 1 + 0.02 * sin(at * 12)],
    sad: (at) => [0, 0.8, 0.07, 0.97], cry: (at) => [sin(at * 22) * 0.35, 0.8, 0.08, 0.97], hurt: (at) => [sin(at * 40) * 0.5 * Math.max(0, 1 - at), 0, -0.06, 0.96],
    angry: (at) => [sin(at * 42) * 0.55, 0, 0.03, 1], shy: (at) => [0, 0, -0.06 + sin(at * 2.5) * 0.02, 0.98], surprised: (at) => [0, at < 0.3 ? -sin((at / 0.3) * Math.PI) * 3 : 0, -0.04, at < 0.3 ? 1 + 0.16 * sin((at / 0.3) * Math.PI) : 1],
    talk: (at) => [0, 0, sin(at * 5) * 0.02, 1 + 0.022 * sin(at * 16)], greet: (at) => [0, 0, sin(at * 8) * 0.09, 1], wave: (at) => [0, 0, sin(at * 8) * 0.09, 1], nod: (at) => [0, abs(sin(at * 7)) * 1, 0.05 * abs(sin(at * 7)), 1], shake: (at) => [sin(at * 12) * 1.2, 0, 0, 1],
    think: (at) => [0, 0, -0.04, 1], read: (at) => [0, 0, 0.03, 1], study: (at) => [0, 0, 0.04 + sin(at * 2) * 0.01, 1], sketch: (at) => [0, 0, 0.03 + sin(at * 7) * 0.012, 1],
    pet: (at) => [0, 0.6, sin(at * 5) * 0.04, 0.94 + 0.02 * sin(at * 6)], stretch: (at) => [0, 0, 0, 1 + 0.07 * sin(Math.min(1, at / 1.4) * Math.PI)], yawn: (at) => [0, 0, -0.05 * sin(Math.min(1, at / 1.5) * Math.PI), 1 + 0.05 * sin(Math.min(1, at / 1.5) * Math.PI)],
    fish: (at) => [0, 0, -0.03 + sin(at * 1.5) * 0.015, 1], cook: (at) => [sin(at * 6) * 0.5, 0, 0.03, 1], tend: (at) => [0, 0.5, 0.06 + sin(at * 3) * 0.02, 1], forage: (at) => [0, 1, 0.09 + sin(at * 4) * 0.03, 0.97], browse: (at) => [sin(at * 1.2) * 1, 0, sin(at * 1.2) * 0.03, 1],
    laugh: (at) => [0, hop(at, 10, 1.4), -0.04, 1 + 0.03 * sin(at * 20)], drag: (at) => [0, 0, sin(at * 5) * 0.16, 1.04], fall: () => [0, 0, 0.08, 1.07], climb: (at) => [sin(at * 8) * 0.8, 0, sin(at * 8) * 0.04, 1], hang: (at) => [0, 0, sin(at * 2.4) * 0.1, 1.03], peek: (at) => [0, 0, 0.05 + sin(at * 2) * 0.02, 1],
  };
  /** marks only a picture needs (the rig shows these with its face): which ones per action */
  const OWN = { eat: 'crumbs', taste: 'crumbs', yum: 'crumbs sparkle', surprised: 'bang', shy: 'blush', cry: 'tear', sad: 'gloom', hurt: 'shock', angry: 'fxAnger', sleep: 'zzz', nap: 'zzz', sing: 'notes', dance: 'notes', happy: 'sparkle', cheer: 'sparkle', proud: 'sparkle', pet: 'fxHeart', think: 'thought', talk: 'talk', laugh: 'talk', yawn: 'puffO', drink: 'fxCup' };
  const chainOf = (action) => [action].concat(((OC.Chars.ACTIONS.find((a) => a[0] === action) || [])[3]) || [], (OC.Anim11 && OC.Anim11.LIB && OC.Anim11.LIB[action] && OC.Anim11.LIB[action].fb) || []);
  /** is this pose performed by the picture itself (true) or by frames the player drew for it (false)? */
  function active(c, sp, p) {
    const action = p.action || 'idle'; if (!sp || !sp.doc) return false;
    if (p.touch) return true;                                                   // being stroked: lean into the finger, hearts
    if (sp.action === action) return false;                                     // drawn by the player for this very action (or simply standing)
    if (sp.action !== 'idle' && OC.Anim.count(sp.doc) > 1) return false;        // a related animation the player drew stands in (walk for run …)
    return true;
  }
  /** pose of the picture: { dx, dy, rot, sq, s (rig state with mark flags), own[] } — all in rig units / radians */
  function pose(c, p, t) {
    const action = p.action || 'idle', at = p.at || 0;
    const s = OC.CharRender.rigState(c, p, t);
    let m = null, own = ''; for (const a of chainOf(action)) { if (!m && MOVES[a]) m = MOVES[a](at); if (!own && OWN[a]) own = OWN[a]; if (m && own) break; }
    m = m || [0, 0, 0, 1];
    const w = p.walk || 0, ph = (p.phase || 0) * Math.PI;
    const dx = (s.shiftX || 0) + m[0], dy = -(s.lift || 0) + m[1] - abs(sin(ph)) * 1.3 * w, rot = (s.lean || 0) * 1.6 + m[2] + sin(ph) * 0.07 * w, sq = (s.squash || 1) * m[3] * (1 + 0.03 * w * sin(ph * 2));
    for (const k of own.split(' ')) if (k) s[k] = true;
    if (action === 'idle' || !action) { s.zzz = false; }
    return { dx, dy, rot, sq, s, own };
  }
  /** the marks around a picture: the rig's shared marks + the picture-only ones. ctx is at the feet, 1 unit = 1 rig unit, not mirrored. */
  function marks(ctx, pu, t, H, face) {
    const s = pu.s, G = { hx: 0, headY: -H * 0.76, Hrx: H * 0.26, Hry: H * 0.2, bodyY: -H * 0.3, fx: face || 0, back: 0 };
    if (OC.Rig && OC.Rig.marks) OC.Rig.marks(ctx, s, t, G);
    const top = G.headY - G.Hry, rgba = OC.rgba;
    if (s.crumbs) { ctx.save(); for (let i = 0; i < 5; i++) { const q = (t * 1.6 + i * 0.21) % 1, a = i * 1.9; ctx.fillStyle = rgba(i % 2 ? '#E8B36B' : '#C98C4A', 1 - q); ctx.beginPath(); ctx.arc(G.hx + (face || 0.4) * 5 + Math.cos(a) * (2 + q * 5), G.headY + 5 + q * 9 + Math.sin(a) * 1.5, 0.9, 0, TAU); ctx.fill(); } ctx.restore(); }
    if (s.bang) { const q = Math.min(1, (t * 3) % 2.2); ctx.save(); ctx.translate(G.hx + G.Hrx * 0.7, top - 3 - q * 1.5); ctx.rotate(0.2); ctx.fillStyle = '#F2B33D'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-1.3, -6); ctx.lineTo(1.3, -6); ctx.lineTo(0.7, 0.4); ctx.lineTo(-0.7, 0.4); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.beginPath(); ctx.arc(0, 2.6, 1.1, 0, TAU); ctx.stroke(); ctx.fill(); ctx.restore(); }
    if (s.blush) { ctx.save(); ctx.strokeStyle = rgba('#FF7A9A', 0.85); ctx.lineWidth = 0.9; ctx.lineCap = 'round'; for (const side of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(side * (G.Hrx * 0.55) + i * 1.5 - 1.5, G.headY + 3); ctx.lineTo(side * (G.Hrx * 0.55) + i * 1.5 - 2.4, G.headY + 5.4); ctx.stroke(); } ctx.restore(); }
    if (s.tear) { ctx.save(); ctx.fillStyle = '#7FC4F5'; for (const side of [-1, 1]) { const q = (t * 0.9 + (side > 0 ? 0.5 : 0)) % 1; ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.ellipse(side * G.Hrx * 0.45, G.headY + 2 + q * 8, 1, 1.5, 0, 0, TAU); ctx.fill(); } ctx.restore(); }
    if (s.sweat) { ctx.save(); ctx.translate(G.Hrx * 0.8, G.headY - G.Hry * 0.5); ctx.fillStyle = '#9FD3FF'; ctx.strokeStyle = '#4C8DD0'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(3, 1, 0, 2.5); ctx.quadraticCurveTo(-3, 1, 0, -4); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (s.shock) { ctx.save(); ctx.strokeStyle = rgba('#5B6FD6', 0.75); ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 2.6, top - 5); ctx.lineTo(i * 2.6, top - 0.5); ctx.stroke(); } ctx.restore(); }
    if (s.talk) { ctx.save(); ctx.strokeStyle = rgba('#8E7BE0', 0.8); ctx.lineWidth = 0.9; ctx.lineCap = 'round'; const k = 0.6 + 0.4 * abs(sin(t * 9)), sx = (face || 0.4) >= 0 ? 1 : -1; for (let i = -1; i <= 1; i++) { const a = i * 0.5; ctx.beginPath(); ctx.moveTo(sx * (G.Hrx + 1.5) , G.headY + 2 + i * 1.6); ctx.lineTo(sx * (G.Hrx + 1.5 + 3.2 * k * Math.cos(a)), G.headY + 2 + i * 1.6 + 3.2 * k * Math.sin(a)); ctx.stroke(); } ctx.restore(); }
    if (s.puffO) { const q = (t * 0.8) % 1; ctx.save(); ctx.strokeStyle = rgba('#9AA3B5', 0.9 - q * 0.9); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(G.hx + (face >= 0 ? 1 : -1) * (G.Hrx + 2 + q * 4), G.headY + 2 - q * 3, 1.4 + q * 2, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
  OC.Puppet = { DEF, frameOf, isDefault, mirror, active, pose, marks, MOVES, OWN };
})();
