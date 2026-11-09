/* OC Shimeji 12.0 — OC.Dress: finishing touches for the 3D places (visual only, nothing here is a facility).
 * The rooms and the shop street were mostly bare floor; this adds what makes a place feel lived in — framed prints, a wall shelf with cups,
 * rugs, fairy lights that glow at night, window light on the floor that follows the time of day, planters and crates in front of shops.
 * Rules: shared geometry / materials (Models.geo / mat), only a handful of draw calls per place, the walkable area is never covered
 * (corner pieces register a small obstacle), muted colours (the art direction is the same, the tone is calmer), nothing animates except the light.
 */
(function () {
  'use strict';
  const Mo = OC.Models, { add, rbox, cyl, sphere, mat } = Mo;
  const TAU = Math.PI * 2;
  const night = Mo.night;

  /** a framed print facing +z: art = [[dx, dy, w, h, colour], …] drawn flat inside the mat */
  function frame(w, h, art, wood = '#7A5230') {
    const g = new THREE.Group();
    add(g, rbox(w + 4, h + 4, 2.2, 0.8), mat(wood), 0, 0, 0.8, { cast: false });
    add(g, rbox(w, h, 1.2, 0.4), mat('#FFF7EA'), 0, 0, 1.8, { cast: false });
    for (const [dx, dy, aw, ah, c] of art) add(g, rbox(aw, ah, 0.8, 0.3), mat(c), dx, dy, 2.5, { cast: false });
    g.userData.noContact = true; return g;
  }
  const PRINTS = {
    hills: [[0, -h2(14), 18, 6, '#9DB89A'], [-4, -h2(14) + 4, 9, 6, '#7FA27F'], [3, 3, 7, 7, '#F2D6A0']],
    sun: [[0, 0, 16, 14, '#DCEAF2'], [0, 2, 8, 8, '#F2B98A'], [0, -5, 16, 3, '#9DB89A']],
    lines: [[-5, 0, 3, 16, '#C98C6B'], [0, 0, 3, 12, '#8FA9B8'], [5, 0, 3, 18, '#B7A06E']],
    boat: [[0, -4, 16, 5, '#8FA9B8'], [0, 2, 3, 10, '#FFF7EA'], [3, 3, 6, 7, '#C98C6B']],
  };
  function h2(n) { return n / 2 - 3; }

  /** a rug lying on the floor (world units: w wide, d deep) — flat, never an obstacle */
  function rug(w, d, c1, c2, c3) {
    const g = new THREE.Group();
    add(g, rbox(w, 0.7, d, 0.3), mat(c1), 0, 0.35, 0, { cast: false });
    add(g, rbox(w - 7, 0.85, d - 7, 0.3), mat(c2), 0, 0.42, 0, { cast: false });
    if (c3) for (let i = -2; i <= 2; i++) add(g, rbox(2.2, 0.95, d - 12, 0.2), mat(c3), i * (w - 16) / 5, 0.47, 0, { cast: false });
    g.userData.noContact = true; return g;
  }

  /** warm bulbs on a sagging cord between two points (world x, height), z fixed — 1 instanced draw + 1 tube */
  function fairyLights(x0, x1, y0, sag, z, n = 12) {
    const g = new THREE.Group(), pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y0 - Math.sin(t * Math.PI) * sag, z)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.3, 4), mat('#4A3A32')); tube.castShadow = false; g.add(tube);
    const bm = mat('#FFF1C9', { p: { emissive: new THREE.Color('#FFCF73'), emissiveIntensity: 0.35 } }); night.windows.push(bm);
    const im = new THREE.InstancedMesh(sphere(1.7, 8, 6), bm, n), M4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; M4.makeTranslation(x0 + (x1 - x0) * t, y0 - Math.sin(t * Math.PI) * sag - 1.6, z + 0.3); im.setMatrixAt(i, M4); }
    im.castShadow = false; im.receiveShadow = false; g.add(im); g.userData.noContact = true; return g;
  }

  /** window light on the floor: a soft warm parallelogram (gradient, no hard edges) that fades out at night (one draw call each) */
  let lightTex = null;
  function lightTexture() {
    if (lightTex) return lightTex;
    lightTex = OC.Env.texture(32, 64, (x, w, h) => {
      const v = x.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,255,255,0.95)'); v.addColorStop(0.55, 'rgba(255,255,255,0.45)'); v.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'destination-in'; const hz = x.createLinearGradient(0, 0, w, 0); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(0.3, 'rgba(0,0,0,1)'); hz.addColorStop(0.7, 'rgba(0,0,0,1)'); hz.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = hz; x.fillRect(0, 0, w, h);
    }); lightTex.userData.cached = true; lightTex.wrapS = lightTex.wrapT = THREE.ClampToEdgeWrapping; return lightTex;
  }
  function lightPatch(ctx, x, y, w, d, skew) {
    const m = new THREE.MeshBasicMaterial({ color: '#FFE2A0', map: lightTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.applyMatrix4(new THREE.Matrix4().makeShear(0, skew, 0, 0, 0, 0));
    const me = new THREE.Mesh(g, m); me.position.copy(ctx.V3(x, y, 0, 0.55)); me.renderOrder = 1; ctx.root.add(me);
    ctx.tick((t, dt, env) => { m.opacity = 0.2 * (1 - Math.min(1, (env && env.night) || 0)); });
    return me;
  }

  /** wall shelf with a few cups and jars (back wall, facing +z) */
  function cupShelf(w = 44, seed = 1) {
    const g = new THREE.Group(), r = OC.rng(seed);
    add(g, rbox(w, 2.2, 7, 0.8), mat('#9A6A3E'), 0, 0, 3.5, { cast: false });
    for (const sx of [-1, 1]) add(g, rbox(2, 6, 5, 0.6), mat('#7A5230'), sx * (w / 2 - 5), -3.4, 2.6, { cast: false });
    const cols = ['#FFF7EA', '#BFD6D2', '#E7B9A0', '#FFF7EA', '#D9C7A6'];
    for (let i = 0; i < 6; i++) { const x = -w / 2 + 6 + i * ((w - 12) / 5); if (i % 3 === 2) add(g, cyl(2.2, 2.4, 6.5, 10), mat('#C9D8C2'), x, 4.3, 3.6, { cast: false }); else add(g, cyl(1.9, 1.5, 3.4, 10), mat(cols[(r() * cols.length) | 0]), x, 2.7, 3.6, { cast: false }); }
    g.userData.noContact = true; return g;
  }

  /** a tall floor lamp with a linen shade (glows at night) */
  function floorLamp() {
    const g = new THREE.Group(), gm = mat('#FFF1C9', { p: { emissive: new THREE.Color('#FFCF73'), emissiveIntensity: 0.1 } }); night.windows.push(gm);
    add(g, cyl(5, 6, 1.6, 14), mat('#5B4638'), 0, 0.8, 0); add(g, cyl(0.7, 0.7, 36, 6), mat('#5B4638'), 0, 19, 0); add(g, cyl(5.5, 7.5, 8, 14), gm, 0, 38, 0);
    return g;
  }

  /** crates with fruit, and a planter, for the shop street */
  function crates(seed = 1, col = '#EE4B4B') {
    const g = new THREE.Group(), woodM = mat('#B07E4B'), r = OC.rng(seed);
    add(g, rbox(14, 8, 10, 1.2), woodM, 0, 4, 0); add(g, rbox(14, 8, 10, 1.2), mat('#C88B55'), 9, 4, 3); add(g, rbox(13, 7, 9, 1.2), mat('#C88B55'), 3, 11.5, 1, { ry: 0.25 });
    for (let k = 0; k < 5; k++) add(g, sphere(2.1, 8, 6), mat(col), 3 - 4 + k * 2.1 + r(), 16.5 + r() * 0.8, 1 + (r() - 0.5) * 3, { cast: false });
    return g;
  }

  // ---------------------------------------------------------------- places
  const Z = (ctx, dy) => dy / ctx.SIN;
  /** every room: window light on the floor under each window */
  function windows(ctx, area, xs) { for (const x of xs) lightPatch(ctx, x, area.room.y0 + 46, 24, 46 / ctx.SIN, 0.8); }

  function room(ctx, area) {
    const R = area.room, cx = (R.x0 + R.x1) / 2, P = (o, x, y, up = 0) => { o.position.copy(ctx.V3(x, y, 0, up)); ctx.root.add(o); return o; };
    const strings = (x0, x1, y, sag) => ctx.root.add(fairyLights(x0, x1, y, sag, ctx.Zof(R.y0) + 1.4));   // fairy lights along the top of the back wall (world coordinates)
    if (area.id === 'home') {
      windows(ctx, area, [cx - 70, cx + 70]);
      P(frame(13, 15, PRINTS.hills), 172, R.y0 + 1, 31); P(frame(13, 15, PRINTS.sun), 228, R.y0 + 1, 31); P(frame(15, 11, PRINTS.boat), 306, R.y0 + 1, 30);
      strings(cx - 96, cx + 96, 41, 4);
      const fl = floorLamp(); P(fl, R.x1 - 14, R.y0 + 20); ctx.block(R.x1 - 14, R.y0 + 20, 12, 8);
    } else if (area.id === 'cafe') {
      windows(ctx, area, [cx - 120, cx + 120]);
      P(frame(14, 18, PRINTS.lines, '#5B4638'), 130, R.y0 + 1, 30); P(frame(18, 13, PRINTS.sun, '#5B4638'), 330, R.y0 + 1, 34); P(frame(13, 15, PRINTS.hills, '#5B4638'), 360, R.y0 + 1, 30);
      P(cupShelf(46, 3), 90, R.y0 + 1, 33);
      const rg = rug(150, 74 / ctx.SIN, '#7C9A92', '#DDE8E1', '#B8CFC6'); P(rg, 220, 440, 0.3);
      strings(cx - 160, cx + 160, 42, 5);
    } else if (area.id === 'library') {
      windows(ctx, area, [cx]);
      P(frame(16, 12, PRINTS.boat, '#5B4638'), 200, R.y0 + 1, 40); P(frame(12, 15, PRINTS.hills, '#5B4638'), 245, R.y0 + 1, 40); P(frame(16, 12, PRINTS.lines, '#5B4638'), 380, R.y0 + 1, 38);
      const rg = rug(180, 90 / ctx.SIN, '#7A3F45', '#C9A98B', '#A6676B'); P(rg, 220, 410, 0.3);
      const fl = floorLamp(); P(fl, 340, 480); ctx.block(340, 480, 12, 8);
      strings(cx - 150, cx + 150, 44, 4);
    }
  }

  /** the shop street: planters and crates in front of the shops (the doors stay clear) */
  function street(ctx, shops) {
    for (const s of shops) {
      for (const k of [-1, 1]) { const b = Mo.flowerBed(30, 14, Math.round(s.x + k * 7 + s.y)); b.position.copy(ctx.V3(s.x + k * 52, s.y + 34, 0, 1.2)); ctx.root.add(b); ctx.contact && ctx.contact(s.x + k * 52, s.y + 34, 0, 1.2, 44, 22); ctx.block(s.x + k * 52, s.y + 34, 30, 12); }
    }
    const c1 = crates(2, '#EE4B4B'); c1.position.copy(ctx.V3(shops[0].x + 56, shops[0].y + 10, 0, 1.2)); ctx.root.add(c1); ctx.contact && ctx.contact(shops[0].x + 56, shops[0].y + 10, 0, 1.2, 40, 20); ctx.block(shops[0].x + 56, shops[0].y + 10, 28, 12);
    const c2 = crates(5, '#FF9A3C'); c2.position.copy(ctx.V3(shops[2].x - 56, shops[2].y + 10, 0, 1.2)); ctx.root.add(c2); ctx.contact && ctx.contact(shops[2].x - 56, shops[2].y + 10, 0, 1.2, 40, 20); ctx.block(shops[2].x - 56, shops[2].y + 10, 28, 12);
  }

  OC.Dress = { frame, rug, fairyLights, lightPatch, cupShelf, floorLamp, crates, room, street, PRINTS };
})();
