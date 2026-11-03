/* OC Shimeji — frame engine.
 * renderFrame(t) draws one frame of the active theme. Shots overlap by OC.TRANS
 * seconds at every boundary; the theme decides how to composite the two.
 */
(function (G) {
  'use strict';
  const OC = G.OC;
  const { W, H, SHOTS, TRANS, clamp } = OC;

  let theme = null, main = null, ctx = null, bufA = null, bufB = null;

  function shotAt(t) {
    for (const s of SHOTS) if (t >= s.t0 && t < s.t1) return s;
    return SHOTS[SHOTS.length - 1];
  }

  function drawShot(c, s, t) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, W, H);
    theme.shots[s.id](c, t - s.t0, t, s);
    c.restore();
  }

  function renderFrame(t) {
    t = clamp(t, 0, OC.DURATION - 1e-4);
    // transition window?
    let trans = null;
    for (let i = 0; i < SHOTS.length - 1; i++) {
      const b = SHOTS[i].t1;
      if (t >= b - TRANS / 2 && t < b + TRANS / 2) { trans = { from: SHOTS[i], to: SHOTS[i + 1], p: (t - (b - TRANS / 2)) / TRANS }; break; }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (trans) {
      drawShot(bufA.getContext('2d'), trans.from, t);
      drawShot(bufB.getContext('2d'), trans.to, t);
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      theme.transition(ctx, bufA, bufB, trans.p, trans.from.id, trans.to.id, t);
      ctx.restore();
    } else {
      drawShot(ctx, shotAt(t), t);
    }
    if (theme.chapter) {
      const s = shotAt(t);
      if (s.zh) {
        const lt = t - s.t0, d = s.t1 - s.t0;
        const a = clamp((lt - 0.35) / 0.35) * clamp((d - 0.3 - lt) / 0.3);
        if (a > 0) { ctx.save(); theme.chapter(ctx, s, a, SHOTS.indexOf(s)); ctx.restore(); }
      }
    }
    if (theme.post) { ctx.save(); theme.post(ctx, t); ctx.restore(); }
  }

  async function loadFonts(list) {
    for (const f of list) {
      const face = new FontFace(f.family, `url(${f.url})`, f.descriptors || {});
      await face.load();
      document.fonts.add(face);
    }
    await document.fonts.ready;
  }

  async function boot(themeId, canvas) {
    theme = OC.themes[themeId];
    if (!theme) throw new Error('unknown theme ' + themeId);
    main = canvas; main.width = W; main.height = H;
    ctx = main.getContext('2d');
    bufA = OC.makeCanvas(W, H); bufB = OC.makeCanvas(W, H);
    if (theme.fonts) await loadFonts(theme.fonts);
    if (theme.init) await theme.init();
    G.renderFrame = renderFrame;
    G.theme = theme;
    G.ready = true;
    return theme;
  }

  OC.boot = boot;
  OC.renderFrame = (t) => renderFrame(t);
})(window);
