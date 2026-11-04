/* Round 3 — G · 晴日島嶼 3D (Sunny Isle · hybrid)
 * Same UI, characters, acting and storyboard as scheme E; only the world renderer is
 * replaced by the fixed-camera 3D world (world3d.js). This is the point of the hybrid:
 * every 2D system (OC drawing, frame animation, UI, floating pet) stays untouched.
 */
(function () {
  'use strict';
  const { clamp, E, text, rr, TAU } = OC;
  const I = OC.IS, P = I.P, A = OC.ACT;
  const base = OC.themes.isle;

  // swap the world renderer (scheme E's shots look these up at call time)
  OC.IS.WORLD.drawIsle = OC.IS3.drawIsle;
  OC.IS.WORLD.drawWoods = OC.IS3.drawWoods;

  function logo(ctx, lt, t, s) {
    base.shots.logo(ctx, lt, t, s);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(OC.DP, OC.DP);
    const q = E.outBack(clamp((lt - 1.3) / 0.35), 2);
    if (q > 0) { ctx.translate(292, 182); ctx.rotate(0.18); ctx.scale(q, q); I.panel(ctx, -26, -13, 52, 26, 13, P.coral, '#B84A3C'); text(ctx, '3D', 0, 1, { font: I.F(900, 15), color: '#fff', align: 'center', base: 'middle' }); }
    ctx.restore();
  }
  function end(ctx, lt, t) {
    ctx.scale(OC.DP, OC.DP);
    OC.IS3.drawIsle(ctx, { t, cam: { x: 200, y: 410, z: 0.95 }, night: 0.25, chars: [
      { d: 'mochi', s: A.idle(t, 1, { eyes: 'happy', mouth: 'grin', armR: -2.2 + Math.sin(t * 9) * 0.35 }), x: 186, y: 432 },
      { d: 'kuri', s: A.idle(t, 2, { face: -0.3, eyes: 'happy' }), x: 216, y: 440 },
      { d: 'sora', s: A.idle(t, 3, { face: -0.4, eyes: 'sleepy' }), x: 244, y: 448 },
    ] });
    ctx.fillStyle = 'rgba(255,248,231,0.55)'; ctx.fillRect(0, 0, 360, 640);
    const a = E.outBack(clamp(lt / 0.5), 1.6);
    ctx.save(); ctx.translate(180, 470); ctx.scale(a, a); ctx.translate(-180, -470);
    I.tag(ctx, 180, 418, '方案 G', P.coral, -0.04);
    I.chunky(ctx, '晴日島嶼 3D', 180, 470, 30, '#fff', P.brown, { align: 'center', font: '900 30px Huninn, Nunito' });
    text(ctx, 'SUNNY ISLE · HYBRID', 180, 496, { font: I.F(900, 13), color: P.brown, align: 'center', ls: 3 });
    I.panel(ctx, 40, 512, 280, 30, 15); text(ctx, '3D 固定視角世界 ＋ 2D 角色與介面', 180, 527.5, { font: I.ZH(12), color: P.brown, align: 'center', base: 'middle' });
    ctx.restore();
  }

  OC.themes.isle3d = Object.assign({}, base, {
    id: 'isle3d', name: '晴日島嶼 3D Sunny Isle (Hybrid)', short: 'G',
    init() { OC.IS3.init(); },
    shots: Object.assign({}, base.shots, { logo, end }),
  });
})();
