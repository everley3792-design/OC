/* OC Shimeji — Phase 5 models: interiors, shop street, beach, garden, new furniture.
 * Same rules as models.js: units = design dp, origin at the footprint centre on y = 0, +Z faces
 * the camera, bevelled / lathed soft edges, geometry & material cache (OC.Models.geo / mat),
 * text signs are small canvas textures cached per text.
 */
(function () {
  'use strict';
  const { TAU, rng, mix } = OC;
  const Mo = OC.Models, { mat, geo, add, rbox, sphere, cyl, cone, FURN } = Mo;
  const P = OC.Style.P;
  const texCache = {};
  /** cached canvas texture (signs, floors, wallpaper) */
  function ctex(key, w, h, draw, rep) { if (texCache[key]) return texCache[key]; const t = OC.Env.texture(w, h, draw, rep); t.userData.cached = true; return (texCache[key] = t); }
  const TM = {};
  /** cached Lambert material with a cached map */
  function tmat(key, map) { if (TM[key]) return TM[key]; const m = new THREE.MeshLambertMaterial({ color: '#FFFFFF', map }); m.userData.cached = true; m.userData.key = key; /* which texture it is (for diagnostics and tests) */ return (TM[key] = m); }

  // ---------------- textures ----------------
  const plankTex = (base) => ctex('plank' + base, 128, 128, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); const r = rng(4); for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '90,50,20'},${0.05 + r() * 0.06})`; x.fillRect(0, i * 16, w, 16); x.fillStyle = 'rgba(90,50,20,.22)'; x.fillRect(0, i * 16 + 15, w, 1.5); x.fillRect(((i * 37) % 4) * 32, i * 16, 1.5, 16); } }, [1 / 48, 1 / 48]);
  const wallTex = (base, stripe) => ctex('wall' + base + stripe, 64, 64, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); x.fillStyle = stripe; for (let i = 0; i < 4; i++) x.fillRect(i * 16 + 6, 0, 4, h); }, [1 / 24, 1 / 24]);
  const tileTex = (a, b) => ctex('tile' + a + b, 64, 64, (x, w, h) => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * 16, j * 16, 16, 16); } }, [1 / 28, 1 / 28]);
  const paveTex2 = () => ctex('pave2', 128, 128, (x, w, h) => { x.fillStyle = '#E8DCC2'; x.fillRect(0, 0, w, h); const r = rng(9); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(${150 + r() * 30},${130 + r() * 20},${100},${0.18 + r() * 0.12})`; const o = (j % 2) * 8; x.beginPath(); x.roundRect ? x.roundRect(i * 16 + o + 1, j * 16 + 1, 14, 14, 3) : x.rect(i * 16 + o + 1, j * 16 + 1, 14, 14); x.fill(); } }, [1 / 36, 1 / 36]);
  function signTex(text, bg, fg = '#FFFFFF') { return ctex('sign:' + text + bg, 256, 64, (x, w, h) => { x.fillStyle = bg; x.beginPath(); x.roundRect ? x.roundRect(4, 4, w - 8, h - 8, 18) : x.rect(4, 4, w - 8, h - 8); x.fill(); x.fillStyle = fg; x.font = 'bold 34px "Zen Maru Gothic", "Noto Sans TC", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2); }); }
  /** flat sign plane (text), facing the camera */
  function sign(text, bg, w = 40) { const m = new THREE.Mesh(geo('signp' + w, () => new THREE.PlaneGeometry(w, w / 4)), new THREE.MeshLambertMaterial({ map: signTex(text, bg), transparent: true })); m.material.userData.cached = true; return m; }
  Mo.sign = sign; Mo.ctex = ctex; Mo.plankTex = plankTex; Mo.paveTex2 = paveTex2;

  // ---------------- interior room shell (back + side walls; the front is open towards the camera) ----------------
  /** w × d floor (design units, d along the screen y), wall height h. o: floor, wall, stripe, trim, windows[] (x offsets) */
  function room(o) {
    const g = new THREE.Group(), w = o.w, d = o.d, h = o.h || 46, SIN = OC.World.SIN, D = d / SIN;
    const floor = new THREE.Mesh(geo(`rfl${w}|${D}`, () => new THREE.BoxGeometry(w, 3, D)), tmat('fl' + (o.tile ? o.tile.join() : o.floor), o.tile ? tileTex(o.tile[0], o.tile[1]) : plankTex(o.floor || '#E2B27A')));
    floor.position.set(0, -1.5, 0); floor.receiveShadow = true; g.add(floor);
    const wallM = tmat('wl' + o.wall + o.stripe, wallTex(o.wall || '#FFF1DE', o.stripe || '#FBE3C7')), trimM = mat(o.trim || '#D9A26A');
    const back = add(g, rbox(w + 8, h, 6, 1.5), wallM, 0, h / 2, -D / 2 - 3); back.receiveShadow = true;
    add(g, rbox(w + 8, 4, 7, 1.5), trimM, 0, 2, -D / 2 - 2.5);
    add(g, rbox(w + 10, 4, 9, 1.6), trimM, 0, h + 1, -D / 2 - 3);
    for (const sx of [-1, 1]) { const sw = add(g, rbox(6, h * 0.62, D + 6, 1.5), wallM, sx * (w / 2 + 3), h * 0.31, -3); sw.receiveShadow = true; add(g, rbox(8, 3, D + 8, 1.2), trimM, sx * (w / 2 + 3), h * 0.62, -3); }
    // windows on the back wall (glow at night)
    for (const wx of o.windows || []) {
      const wm = mat('#BFE9F7', { p: { emissive: new THREE.Color('#FFC860'), emissiveIntensity: 0 } }); Mo.night.windows.push(wm);
      add(g, rbox(26, 22, 3, 2), mat('#FFFFFF'), wx, h * 0.55, -D / 2 + 0.5, { cast: false });
      add(g, rbox(21, 17, 3, 1.5), wm, wx, h * 0.55, -D / 2 + 1, { cast: false });
      add(g, rbox(1.4, 17, 3.4, 0.4), mat('#FFFFFF'), wx, h * 0.55, -D / 2 + 1.6, { cast: false });
      for (const k of [-1, 1]) add(g, rbox(9, 22, 1.6, 1), mat(o.curtain || '#F48FB1'), wx + k * 15, h * 0.55, -D / 2 + 2, { cast: false });
    }
    // front lip (where the cut-away front wall would be) + door mat
    add(g, rbox(w + 8, 3, 4, 1.2), trimM, 0, 1, D / 2 + 2);
    if (o.door != null) { add(g, rbox(24, 1.2, 10, 0.6), mat(o.mat || '#F26B5B'), o.door, 0.6, D / 2 - 4, { cast: false }); }
    return g;
  }
  /** cafe counter with display case + register */
  function counter(w = 90) {
    const g = new THREE.Group(); add(g, rbox(w, 22, 18, 3), mat('#D9A26A'), 0, 11, 0); add(g, rbox(w + 4, 3, 21, 1.4), mat('#FFF4DC'), 0, 23.5, 0);
    for (let i = 0; i < 4; i++) add(g, rbox(w / 5, 14, 2, 1), mat(i % 2 ? '#C88B55' : '#B97A45'), -w * 0.3 + i * w / 5, 11, 9.4, { cast: false });
    const glass = add(g, rbox(w * 0.45, 10, 14, 2), new THREE.MeshLambertMaterial({ color: '#DFF5FA', transparent: true, opacity: 0.55 }), -w * 0.2, 30, 0, { cast: false }); glass.material.userData.cached = true;
    ['#F2C36B', '#F48FB1', '#8A5A3C', '#FFD45C'].forEach((c, i) => add(g, sphere(2.4, 10, 8), mat(c), -w * 0.32 + i * 6, 27.5, 0, { cast: false }));
    add(g, rbox(12, 8, 9, 1.5), mat('#556080'), w * 0.3, 29, 0); add(g, rbox(9, 5, 2, 0.6), mat('#BFE9F7'), w * 0.3, 33, -3, { cast: false });
    return g;
  }
  function menuBoard(title = 'MENU') { const g = new THREE.Group(); add(g, rbox(38, 26, 2, 2), mat('#3D4A3E'), 0, 13, 0); const s = sign(title, '#3D4A3E', 32); s.position.set(0, 18, 1.2); g.add(s); for (let i = 0; i < 3; i++) add(g, rbox(24, 1.2, 0.6, 0.3), mat('#FFFFFF'), 0, 12 - i * 3.4, 1.3, { cast: false }); return g; }
  function pendant(col = '#FFC93C') { const g = new THREE.Group(); add(g, cyl(0.4, 0.4, 16, 6), mat('#3B2B25'), 0, 8, 0, { cast: false }); const m = mat(col, { p: { emissive: new THREE.Color('#FFCF73'), emissiveIntensity: 0 } }); Mo.night.windows.push(m); const sh = add(g, geo('pendant', () => new THREE.SphereGeometry(5, 14, 8, 0, TAU, 0, Math.PI / 2)), m, 0, -1, 0, { cast: false }); sh.rotation.x = Math.PI; return g; }
  /** shop building with big display window, awning, hanging sign and door */
  function shopFront(o) {
    const g = Mo.house({ w: o.w || 76, d: o.d || 46, h: o.h || 40, roof: o.roof, shutter: o.accent, wall: o.wall || '#FFF4DE', door: o.door || P.wood });
    const d = (o.d || 46), w = o.w || 76;
    // awning stripes over the front
    const aw = new THREE.Group(); aw.position.set(0, 8 + (o.h || 40) * 0.86, d / 2 + 6); aw.rotation.x = 0.35; g.add(aw);
    for (let i = 0; i < 9; i++) add(aw, rbox(w / 9, 1.6, 16, 0.6), mat(i % 2 ? '#FFFFFF' : o.accent || P.teal), -w / 2 + (i + 0.5) * w / 9, 0, 0, { cast: false });
    const s = sign(o.title, o.signBg || '#5B4433', 44); s.position.set(0, 8 + (o.h || 40) + 6, d / 2 + 2); g.add(s);
    if (o.goods) o.goods.forEach((c, i) => add(g, sphere(2.2, 8, 6), mat(c), -w * 0.31 + (i % 3) * 3 - 3, 8 + (o.h || 40) * 0.5 + Math.floor(i / 3) * 3, d / 2 + 3, { cast: false }));
    return g;
  }
  /** wooden pier into the sea (len along the screen y) */
  function pier(len = 90, w = 28) { const g = new THREE.Group(), SIN = OC.World.SIN, L = len / SIN; for (let k = 0; k < Math.floor(L / 8); k++) add(g, rbox(w + 2, 2.2, 7, 0.9), mat(k % 2 ? '#D9A26A' : '#CF9860'), 0, 0, -L / 2 + 4 + k * 8.2); for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) add(g, cyl(1.8, 1.8, 14, 8), mat(P.woodLo || '#B07E4B'), sx * (w / 2 - 1), -5, -L / 2 + 6 + k * (L - 12) / 3); return g; }
  function umbrella(col = '#F26B5B') { const g = new THREE.Group(); add(g, cyl(0.9, 0.9, 40, 8), mat('#FFFFFF'), 0, 20, 0); const top = add(g, geo('umb', () => new THREE.ConeGeometry(26, 9, 12, 1, true)), mat(col), 0, 41, 0); top.material.side = THREE.DoubleSide; for (let i = 0; i < 6; i++) add(g, cyl(0.5, 0.5, 26, 4), mat('#FFFFFF'), Math.cos(i * TAU / 6) * 12, 39, Math.sin(i * TAU / 6) * 12, { rz: Math.cos(i * TAU / 6) * 1.2, rx: -Math.sin(i * TAU / 6) * 1.2, cast: false }); return g; }
  function towel(col = '#5BC0EB') { const g = new THREE.Group(); add(g, rbox(18, 0.8, 30, 0.4), mat(col), 0, 0.4, 0, { cast: false }); for (let i = 0; i < 3; i++) add(g, rbox(18.2, 0.9, 3, 0.3), mat('#FFFFFF'), 0, 0.5, -10 + i * 10, { cast: false }); return g; }
  function sandcastle() { const g = new THREE.Group(), sm = mat('#F2D28B'); add(g, rbox(26, 8, 22, 3), sm, 0, 4, 0); for (const [x, z] of [[-9, -7], [9, -7], [-9, 7], [9, 7]]) { add(g, cyl(4, 4.6, 14, 10), sm, x, 11, z); add(g, cone(4.8, 6, 10), sm, x, 21, z); } add(g, cyl(5, 6, 18, 10), sm, 0, 16, 0); add(g, cone(1.2, 8, 6), mat('#FFFFFF'), 0, 30, 0, { cast: false }); add(g, rbox(6, 4, 0.4, 0.2), mat('#F26B5B'), 3, 32, 0, { cast: false }); return g; }
  function tidePool() { const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const r = Mo.rock(0.6 + (i % 3) * 0.2, i + 9); r.position.set(Math.cos(i) * 20, 0, Math.sin(i) * 14); g.add(r); } const w = new THREE.Mesh(geo('tpw', () => new THREE.CircleGeometry(14, 20)), mat('#7FD3E8')); w.rotation.x = -Math.PI / 2; w.position.y = 0.6; w.scale.set(1.3, 1, 1); g.add(w); return g; }
  /** garden plot. stage 0 empty soil … 4 ripe; crop colour from the item */
  function gardenPlot() { const g = new THREE.Group(); add(g, rbox(30, 4, 20, 1.6), mat('#B07E4B'), 0, 2, 0); add(g, rbox(26, 2, 16, 1.2), mat('#7A5230'), 0, 4, 0, { cast: false }); const crop = new THREE.Group(); crop.position.y = 5; g.add(crop); g.userData.crop = crop; const wet = add(g, rbox(26.2, 0.4, 16.2, 0.2), new THREE.MeshLambertMaterial({ color: '#4A3220', transparent: true, opacity: 0.0 }), 0, 5.1, 0, { cast: false }); wet.material.userData.cached = false; g.userData.wet = wet; return g; }
  function setPlot(g, stage, col, watered) {
    const crop = g.userData.crop; while (crop.children.length) crop.remove(crop.children[0]);
    g.userData.wet.material.opacity = watered ? 0.55 : 0;
    if (!stage) return;
    for (let i = 0; i < 6; i++) {
      const x = -8 + (i % 3) * 8, z = -4 + Math.floor(i / 3) * 8;
      if (stage === 1) { add(crop, sphere(1.4, 6, 5), mat('#7CCB5A'), x, 1, z, { cast: false }); continue; }
      const hgt = stage === 2 ? 4 : 7; add(crop, cyl(0.5, 0.6, hgt, 5), mat('#4FA35A'), x, hgt / 2, z, { cast: false });
      for (const s of [-1, 1]) add(crop, sphere(2.2, 7, 5), mat(stage >= 3 ? '#5FBF62' : '#7CCB5A'), x + s * 1.6, hgt * 0.8, z, { s: [1, 0.45, 0.8], cast: false });
      if (stage >= 3) add(crop, sphere(stage === 4 ? 2.4 : 1.4, 8, 6), mat(stage === 4 ? col : '#FFFFFF'), x, hgt + 1, z, { cast: false });
    }
  }
  /** berry bush / herb patch that shows its fruit when available */
  function forageBush(kind = 'berry') { const b = Mo.bush(kind === 'berry' ? 7 : 3, kind === 'berry' ? '#4FA845' : '#6CC257'); const fr = new THREE.Group(); b.group.add(fr); const col = kind === 'berry' ? '#C2385B' : kind === 'herb' ? '#9BE07A' : '#B07E4B'; for (let i = 0; i < 6; i++) add(fr, sphere(kind === 'berry' ? 1.8 : 1.4, 7, 5), mat(col), Math.cos(i * 1.7) * 8, 10 + Math.sin(i * 2.3) * 3, Math.sin(i * 1.7) * 6 + 4, { cast: false }); b.group.userData.fruit = fr; return b.group; }
  /** a small critter marker (wiggles; tap to try to catch) */
  function critter(col = '#7FD3F7') { const g = new THREE.Group(); for (const s of [-1, 1]) add(g, sphere(2.2, 8, 6), mat(col), s * 2, 0, 0, { s: [1, 0.3, 1.2], cast: false }); add(g, cyl(0.5, 0.5, 4, 5), mat('#3B2B25'), 0, 0, 0, { rx: Math.PI / 2, cast: false }); return g; }
  /** fishing spot ring on the water */
  function ripple() { const m = new THREE.Mesh(geo('ripple', () => new THREE.RingGeometry(5, 7, 24)), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.6 })); m.rotation.x = -Math.PI / 2; m.material.userData.cached = false; return m; }
  /** player-made furniture: a standee with the product image */
  function standee(it) {
    const g = new THREE.Group(); add(g, cyl(9, 10, 2, 16), mat('#D9A26A'), 0, 1, 0);
    const im = OC.Assets && OC.Assets.peek(it.asset); const t = new THREE.Texture(); if (im) { t.image = im; t.needsUpdate = true; } else if (OC.Assets) OC.Assets.image(it.asset).then((i) => { t.image = i; t.needsUpdate = true; }).catch(() => {});
    t.colorSpace = THREE.SRGBColorSpace; const h = 30, w = im ? h * im.width / im.height : 26;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide })); pl.position.y = 2 + h / 2; pl.castShadow = true; g.add(pl); return g;
  }

  // ---------------- new furniture (OC.Models.furniture uses FURN) ----------------
  Object.assign(FURN, {
    sofa() { const g = new THREE.Group(), c = mat('#9FD3FF'), c2 = mat('#BFE3FF'); add(g, rbox(40, 9, 18, 3), c, 0, 6, 0); add(g, rbox(40, 16, 6, 3), c, 0, 14, -7); for (const sx of [-1, 1]) add(g, rbox(6, 13, 18, 2.5), c, sx * 19, 9, 0); for (const sx of [-1, 1]) add(g, rbox(16, 3, 13, 2), c2, sx * 8.5, 11.5, 1.5); for (const [x, z] of [[-17, -6], [17, -6], [-17, 6], [17, 6]]) add(g, cyl(1.2, 1.2, 3, 6), mat('#B07E4B'), x, 1.5, z); return g; },
    desk() { const g = new THREE.Group(), w = mat('#D9A26A'), d = mat('#B07E4B'); add(g, rbox(38, 3, 18, 1.2), w, 0, 17, -2); add(g, rbox(3, 16, 16, 1), d, -17, 8, -2); add(g, rbox(12, 16, 16, 1.4), w, 13, 8, -2); add(g, rbox(10, 4, 1.2, 0.4), mat('#C88B55'), 13, 12, 6.4, { cast: false }); add(g, rbox(10, 1, 7, 0.4), mat('#FFF7EC'), -4, 19, -2, { cast: false }); add(g, cyl(1.4, 1.6, 6, 8), mat('#5BC0EB'), 8, 21.5, -6); add(g, rbox(13, 11, 13, 1.6), w, -2, 9, 12); add(g, rbox(13, 12, 2, 1), w, -2, 15, 17.5); return g; },
    bookshelf() { const g = new THREE.Group(), w = mat('#B07E4B'), cols = ['#F26B5B', '#5BC0EB', '#FFC93C', '#3FC1B0', '#9B7BE0', '#F48FB1']; add(g, rbox(40, 46, 12, 1.5), w, 0, 23, 0); for (let r = 0; r < 3; r++) { add(g, rbox(36, 12, 9, 0.6), mat('#7A5230'), 0, 8 + r * 14, 1.6, { cast: false }); const R = rng(r + 3); let x = -16; while (x < 15) { const bw = 2.6 + R() * 2; add(g, rbox(bw, 9 + R() * 2, 7, 0.4), mat(cols[Math.floor(R() * cols.length)]), x + bw / 2, 7 + r * 14, 2.4, { cast: false }); x += bw + 0.6; } } return g; },
    toybox() { const g = new THREE.Group(); add(g, rbox(20, 13, 15, 2), mat('#FFC93C'), 0, 6.5, 0); add(g, rbox(21, 3, 16, 1.4), mat('#F26B5B'), 0, 14, -1); add(g, sphere(3, 10, 8), mat('#5BC0EB'), -5, 16, 2); add(g, rbox(4, 4, 4, 0.8), mat('#3FC1B0'), 5, 16.5, 2); return g; },
    stove() { const g = new THREE.Group(); add(g, rbox(40, 22, 16, 2), mat('#FFFFFF'), 0, 11, 0); add(g, rbox(42, 3, 18, 1.2), mat('#3FC1B0'), 0, 23.5, 0); for (const x of [-9, 9]) add(g, cyl(4, 4, 1, 14), mat('#3B2B25'), x, 25.4, 0, { cast: false }); add(g, rbox(16, 10, 2, 1), mat('#C9E8EE'), 9, 11, 8.2, { cast: false }); add(g, cyl(4.5, 4, 5, 12), mat('#9AA3B5'), -9, 28, 0); add(g, rbox(40, 22, 2, 1), mat('#FFF1DE'), 0, 36, -7); return g; },
    wardrobe() { const g = new THREE.Group(), w = mat('#E7C9A4'); add(g, rbox(36, 46, 14, 2), w, 0, 23, 0); add(g, rbox(0.8, 40, 1, 0.3), mat('#B07E4B'), 0, 24, 7.2, { cast: false }); for (const x of [-3, 3]) add(g, sphere(1, 6, 5), mat('#B07E4B'), x, 24, 7.4, { cast: false }); add(g, rbox(38, 3, 15, 1.2), mat('#D9A26A'), 0, 47, 0); return g; },
    painting() { const g = new THREE.Group(); add(g, rbox(2, 34, 2, 0.6), mat('#B07E4B'), 0, 17, -3); const fr = add(g, rbox(28, 20, 2, 1), mat('#D9A26A'), 0, 30, 0); void fr; add(g, rbox(24, 16, 2.2, 0.6), mat('#5BC0EB'), 0, 30, 0.2, { cast: false }); add(g, rbox(24, 6, 2.4, 0.6), mat('#3FA0D8'), 0, 26, 0.3, { cast: false }); add(g, sphere(2, 8, 6), mat('#FFE066'), 6, 34, 1, { cast: false }); return g; },
    clock() { const g = new THREE.Group(); add(g, rbox(14, 44, 10, 3), mat('#B07E4B'), 0, 22, 0); add(g, cyl(5, 5, 1, 18), mat('#FFF7EC'), 0, 36, 5.2, { rx: Math.PI / 2, cast: false }); add(g, rbox(0.6, 4, 0.4, 0.2), mat('#3B2B25'), 0, 37.5, 5.9, { cast: false }); const pend = add(g, cyl(2, 2, 1, 12), mat('#FFD23F'), 0, 18, 5.2, { rx: Math.PI / 2, cast: false }); g.userData.tick = (t) => { pend.position.x = Math.sin(t * 3) * 2.5; }; return g; },
    bigpot() { const g = new THREE.Group(); add(g, cyl(7, 5, 12, 14), mat('#E2895A'), 0, 6, 0); for (let i = 0; i < 9; i++) { const a = i * 0.7; add(g, sphere(4, 8, 6), mat(i % 2 ? '#5FBF62' : '#4FAA45'), Math.cos(a) * 5, 16 + (i % 3) * 4, Math.sin(a) * 4, { s: [0.8, 1.4, 0.8] }); } return g; },
    campfire() { const g = new THREE.Group(); for (let i = 0; i < 8; i++) { const r = Mo.rock(0.35, i + 2); r.position.set(Math.cos(i * TAU / 8) * 11, 0, Math.sin(i * TAU / 8) * 8); g.add(r); } for (const r of [0.6, -0.6]) add(g, cyl(1.6, 1.6, 18, 8), mat('#8A5A3C'), 0, 3, 0, { rz: Math.PI / 2, ry: r }); const fm = mat('#FF9A3C', { p: { emissive: new THREE.Color('#FF7A2A'), emissiveIntensity: 0.9 } }); const f1 = add(g, cone(5, 13, 8), fm, 0, 10, 0, { cast: false }); const f2 = add(g, cone(3, 9, 8), mat('#FFE066', { p: { emissive: new THREE.Color('#FFD23F'), emissiveIntensity: 1 } }), 1, 9, 1, { cast: false }); g.userData.tick = (t) => { const s = 1 + Math.sin(t * 9) * 0.08; f1.scale.set(s, 1 + Math.sin(t * 7) * 0.12, s); f2.scale.set(1, 1 + Math.sin(t * 11) * 0.15, 1); }; return g; },
    swing() { const g = new THREE.Group(), w = mat('#D9A26A'); for (const sx of [-1, 1]) { add(g, cyl(1.4, 1.6, 42, 8), w, sx * 22, 21, -6, { rz: sx * 0.08 }); add(g, cyl(1.4, 1.6, 42, 8), w, sx * 22, 21, 6, { rz: sx * 0.08 }); } add(g, cyl(1.4, 1.4, 48, 8), w, 0, 42, 0, { rz: Math.PI / 2 }); const seat = new THREE.Group(); seat.position.y = 42; g.add(seat); for (const sx of [-1, 1]) add(seat, cyl(0.4, 0.4, 30, 4), mat('#8A6A4A'), sx * 14, -15, 0, { cast: false }); add(seat, rbox(34, 2.4, 9, 1), mat('#F26B5B'), 0, -30, 0); g.userData.tick = (t) => { seat.rotation.x = Math.sin(t * 1.2) * 0.12; }; return g; },
    lantern() { const g = new THREE.Group(); add(g, cyl(0.8, 1, 28, 6), mat('#8A6A4A'), 0, 14, 0); const lm = mat('#FFC93C', { p: { emissive: new THREE.Color('#FFB347'), emissiveIntensity: 0 } }); Mo.night.windows.push(lm); add(g, sphere(6, 12, 10), lm, 0, 30, 0, { s: [1, 1.2, 1], cast: false }); add(g, cyl(3, 3, 1.6, 10), mat('#B07E4B'), 0, 37, 0); add(g, cyl(3, 3, 1.6, 10), mat('#B07E4B'), 0, 23, 0); return g; },
  });

  Object.assign(Mo, { tmat, room, counter, menuBoard, pendant, shopFront, pier, umbrella, towel, sandcastle, tidePool, gardenPlot, setPlot, forageBush, critter, ripple, standee, texCache });
})();
