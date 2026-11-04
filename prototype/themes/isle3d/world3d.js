/* Round 3 — Hybrid: 3D fixed-camera world + 2D characters (Sunny Isle art direction)
 *
 * The world is a real three.js scene (extruded clay terrain, soft shadows, light rig),
 * seen through a FIXED orthographic camera tilted 50°. Ground coordinates are mapped so a
 * point (x, y) of the old 2D world projects to exactly the same screen position:
 *     X = x,  Z = (y + level·H2D) / sin50°,  Y = level·H2D / cos50°
 * so every 2D layout, finger path and UI anchor keeps working unchanged.
 * Characters stay 2D (same rig as scheme E): each one is painted into a canvas texture
 * every frame and shown on a camera-facing billboard, so depth/occlusion against houses
 * and trees is correct while OC drawings & frame animation remain pure 2D.
 */
(function () {
  'use strict';
  const { TAU, clamp, lerp, rng, mix, gradientAt, ellipse, rr } = OC;
  const I = OC.IS, P = I.P;

  const TH = (50 * Math.PI) / 180, SIN = Math.sin(TH), COS = Math.cos(TH);
  const H2D = 24, HY = H2D / COS;
  const Zof = (y, lvl = 0) => (y + lvl * H2D) / SIN;
  const V3 = (x, y, lvl = 0, up = 0) => new THREE.Vector3(x, lvl * HY + up, Zof(y, lvl));

  let R, glc, scene, woods, cam, sun, hemi, sea, seaGeo, foam, smoke = [], sway = [], lamps = [], windows = [], drips = [], riverFoam = [], sails = [];
  let billboards = [], blob = null, built = false, NIGHT = 0;

  const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.78, metalness: 0 }, o));
  function mesh(geo, mat, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; }
  function blobPts(cx, cy, rx, ry, seed, lvl = 0, n = 72) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const k = 1 + 0.045 * Math.sin(3 * a + seed) + 0.03 * Math.sin(5 * a + seed * 2.1) + 0.02 * Math.sin(8 * a + seed * 0.7); pts.push(new THREE.Vector2(cx + Math.cos(a) * rx * k, -Zof(cy + Math.sin(a) * ry * k, lvl))); }
    return pts;
  }
  /** extruded slab whose top cap sits at world Y = top */
  function slab(pts, top, depth, mats, bevel = 0) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
    const m = new THREE.Mesh(g, mats); m.rotation.x = -Math.PI / 2; m.position.y = top - depth - bevel; m.castShadow = true; m.receiveShadow = true; return m;
  }
  function canvasTex(w, h, draw, rep) { const c = OC.makeCanvas(w, h); draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } t.anisotropy = 4; return t; }
  const lawnTex = () => canvasTex(256, 256, (x, w, h) => { x.fillStyle = P.grassA; x.fillRect(0, 0, w, h); x.fillStyle = P.grassB; x.save(); x.translate(w / 2, h / 2); x.rotate(-0.5); for (let k = -8; k < 8; k += 2) x.fillRect(-w, k * 32, w * 2, 32); x.restore(); x.fillStyle = P.grassLo; const r = rng(3); for (let i = 0; i < 40; i++) { const px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px - 3, py); x.lineTo(px - 1, py - 5); x.lineTo(px + 1, py); x.lineTo(px + 3, py - 6); x.lineTo(px + 4, py); x.fill(); } }, 1 / 128);

  // ---------------- props ----------------
  function roundBox(w, h, d, r) { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * Math.min(r, 2), bevelEnabled: true, bevelThickness: Math.min(r, 2), bevelSize: Math.min(r, 2), bevelSegments: 2 }); g.center(); return g; }
  function cottage(par, x, y, lvl, s, roofCol) {
    const g = new THREE.Group(); const base = V3(x, y, lvl); g.position.copy(base); g.scale.setScalar(s);
    const wall = mesh(roundBox(54, 40, 40, 4), M('#FFF2D8')); wall.position.set(0, 20, -20); g.add(wall);
    const brick = mesh(roundBox(58, 9, 44, 3), M('#E3B98A')); brick.position.set(0, 4.5, -20); g.add(brick);
    const roofS = new THREE.Shape(); roofS.moveTo(-34, 0); roofS.lineTo(0, 30); roofS.lineTo(34, 0); roofS.lineTo(30, -3); roofS.lineTo(0, 24); roofS.lineTo(-30, -3); roofS.closePath();
    const roofG = new THREE.ExtrudeGeometry(roofS, { depth: 46, bevelEnabled: true, bevelThickness: 2.5, bevelSize: 2.5, bevelSegments: 3 }); roofG.translate(0, 0, -23);
    const roof = mesh(roofG, M(roofCol, { roughness: 0.65 })); roof.position.set(0, 40, -20); g.add(roof);
    const shM = M(mix(roofCol, '#5a2010', 0.18), { roughness: 0.7 });
    for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const u = (k + 0.6) / 4.6; const sh = mesh(new THREE.CylinderGeometry(1.6, 1.6, 47, 8), shM, false); sh.rotation.x = Math.PI / 2; sh.position.set(sd * (34 - u * 32) , 40 + u * 29 + 1.8, -20); g.add(sh); }
    const gable = new THREE.Shape(); gable.moveTo(-30, 0); gable.lineTo(0, 25); gable.lineTo(30, 0); gable.closePath();
    const gab = mesh(new THREE.ExtrudeGeometry(gable, { depth: 38, bevelEnabled: false }), M('#FFF2D8')); gab.position.set(0, 39.5, -39); g.add(gab);
    const ridge = mesh(new THREE.CylinderGeometry(3, 3, 50, 10), M(mix(roofCol, '#5a2010', 0.25))); ridge.rotation.x = Math.PI / 2; ridge.position.set(0, 70.5, -20); g.add(ridge);
    const chim = mesh(roundBox(8, 18, 8, 2), M('#E3B98A')); chim.position.set(16, 66, -28); g.add(chim);
    const door = mesh(roundBox(13, 20, 3, 3), M('#C88B55')); door.position.set(0, 10, 0.8); g.add(door);
    const knob = mesh(new THREE.SphereGeometry(1.1, 8, 8), M(P.yellow)); knob.position.set(3.8, 10, 2.6); g.add(knob);
    for (const wx of [-17, 17]) { const wm = M('#9EE3F5', { emissive: new THREE.Color('#FFC860'), emissiveIntensity: 0 }); const w = mesh(roundBox(11, 10, 2, 2), wm, false); w.position.set(wx, 26, 0.6); g.add(w); windows.push(wm); const fr = mesh(new THREE.BoxGeometry(1.2, 10, 2.6), M('#FFFFFF'), false); fr.position.set(wx, 26, 0.8); g.add(fr); }
    const step = mesh(roundBox(18, 3, 8, 1.5), M('#E3B98A')); step.position.set(0, 1.5, 4); g.add(step);
    const post = mesh(new THREE.CylinderGeometry(1.2, 1.2, 12, 8), M(P.wood)); post.position.set(36, 6, 2); g.add(post);
    const box = mesh(roundBox(10, 7, 7, 2.5), M(roofCol)); box.position.set(36, 15, 2); g.add(box);
    par.add(g);
    smoke.push({ base: V3(x + 16 * s, y, lvl, 78 * s), list: [0, 1, 2, 3].map(() => { const m = mesh(new THREE.SphereGeometry(3.4, 10, 10), M('#FFFFFF', { transparent: true, opacity: 0.8 }), false, false); par.add(m); return m; }) });
  }
  function fruitTree(par, x, y, lvl, s, fruit, seed) {
    const g = new THREE.Group(); g.position.copy(V3(x, y, lvl)); g.scale.setScalar(s);
    const tr = mesh(new THREE.CylinderGeometry(2.6, 4, 22, 10), M(P.wood)); tr.position.y = 11; g.add(tr);
    const crown = new THREE.Group(); crown.position.y = 30;
    for (const [cx, cy, cz, r] of [[0, 8, 0, 15], [-10, 0, 2, 11], [10, 1, -2, 11], [0, 2, 9, 11], [3, 14, -4, 9]]) { const b = mesh(new THREE.IcosahedronGeometry(r, 2), M('#5FBF4E', { roughness: 0.9 })); b.position.set(cx, cy, cz); crown.add(b); }
    const fr = rng(seed * 13); for (let i = 0; i < 7; i++) { const a = fr() * TAU, yy = fr() * 16 - 2; const f = mesh(new THREE.SphereGeometry(2.4, 10, 10), M(fruit, { roughness: 0.4 }), false); f.position.set(Math.cos(a) * 13, yy, Math.sin(a) * 12 + 2); crown.add(f); }
    g.add(crown); par.add(g); sway.push({ o: crown, seed, amp: 0.05 });
  }
  function palm(par, x, y, lvl, s, seed) {
    const g = new THREE.Group(); g.position.copy(V3(x, y, lvl)); g.scale.setScalar(s);
    let px = 0, py = 0; const segs = 6;
    for (let i = 0; i < segs; i++) { const seg = mesh(new THREE.CylinderGeometry(2.6 - i * 0.15, 3 - i * 0.15, 9, 9), M(i % 2 ? '#C99863' : '#B98955')); seg.position.set(px, py + 4.5, 0); seg.rotation.z = -0.06 * i; g.add(seg); px += 0.6 * i; py += 8.6; }
    const top = new THREE.Group(); top.position.set(px, py, 0);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; const lf = mesh(new THREE.SphereGeometry(1, 12, 8), M('#52B84A', { roughness: 0.85 })); lf.scale.set(16, 1.4, 4.2); lf.position.set(Math.cos(a) * 13, -3, Math.sin(a) * 13); lf.rotation.y = -a; lf.rotation.z = -0.35; top.add(lf); }
    for (const dx of [-2, 2]) { const c = mesh(new THREE.SphereGeometry(2.6, 10, 10), M('#8A5A33')); c.position.set(dx, -2, 2); top.add(c); }
    g.add(top); par.add(g); sway.push({ o: top, seed, amp: 0.08 });
  }
  function lampPost(par, x, y, lvl) {
    const g = new THREE.Group(); g.position.copy(V3(x, y, lvl));
    const p = mesh(new THREE.CylinderGeometry(1.4, 1.8, 26, 10), M('#6B4F3A')); p.position.y = 13; g.add(p);
    const capM = M('#FFF8E7', { emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0 });
    const cap = mesh(new THREE.SphereGeometry(4.6, 14, 12), capM, false); cap.position.y = 29; g.add(cap);
    const hat = mesh(new THREE.ConeGeometry(5.5, 4, 12), M(P.coral)); hat.position.y = 35; g.add(hat);
    const L = new THREE.PointLight('#FFC870', 0, 120, 1.6); L.position.y = 29; g.add(L);
    par.add(g); lamps.push({ m: capM, L });
  }
  function bed(par, x, y, seed) { const r = rng(seed); const cols = [P.coral, P.yellow, '#FFFFFF', P.pink, P.purple]; for (let i = 0; i < 9; i++) { const p = V3(x + (i % 3) * 7 - 7 + r() * 2, y + Math.floor(i / 3) * 6 - 6); const leaf = mesh(new THREE.SphereGeometry(3.2, 8, 6), M('#3E9C3A'), false); leaf.scale.y = 0.5; leaf.position.copy(p).add(new THREE.Vector3(0, 1.5, 0)); par.add(leaf); const fl = mesh(new THREE.SphereGeometry(2.1, 10, 8), M(cols[(i + seed) % 5], { roughness: 0.5 }), false); fl.position.copy(p).add(new THREE.Vector3(0, 5, 0)); par.add(fl); } }
  function tent(par, x, y) {
    const g = new THREE.Group(); g.position.copy(V3(x, y));
    const counter = mesh(roundBox(48, 16, 22, 3), M('#FFF4DC')); counter.position.set(0, 8, -6); g.add(counter);
    for (const [px, pz] of [[-22, 4], [22, 4], [-22, -16], [22, -16]]) { const p = mesh(new THREE.CylinderGeometry(1.2, 1.2, 40, 8), M('#FFFFFF')); p.position.set(px, 20, pz); g.add(p); }
    for (let i = 0; i < 6; i++) { const stripe = mesh(new THREE.BoxGeometry(8.4, 1.8, 30), M(i % 2 ? '#FFFFFF' : P.teal, { roughness: 0.6 })); stripe.position.set(-21 + i * 8.4, 42, -6); stripe.rotation.x = 0.25; g.add(stripe); }
    for (const [ix, c] of [[-12, '#EE4B4B'], [0, '#F6D2AE'], [12, '#FFFFFF']]) { const f = mesh(new THREE.SphereGeometry(3.2, 10, 10), M(c)); f.position.set(ix, 19, 0); g.add(f); }
    par.add(g);
  }

  // ---------------- island scene ----------------
  const MAIN = { cx: 200, cy: 405, rx: 182, ry: 216, seed: 3.4 };
  const TER = { cx: 206, cy: 250, rx: 124, ry: 66, seed: 7.3 };
  const RIVER = [[292, 300], [286, 350], [300, 400], [332, 446], [372, 480], [420, 500]];
  function ribbon(pts, w, Y, mat, recv = true) {
    const L = [], Rr = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b[0] - a[0], dy = Zof(b[1]) - Zof(a[1]), l = Math.hypot(dx, dy) || 1; const nx = -dy / l, nz = dx / l; const X = pts[i][0], Zc = Zof(pts[i][1]); L.push([X + nx * w, Zc + nz * w]); Rr.push([X - nx * w, Zc - nz * w]); }
    const s = new THREE.Shape(); s.moveTo(L[0][0], -L[0][1]); L.slice(1).forEach((p) => s.lineTo(p[0], -p[1])); Rr.reverse().forEach((p) => s.lineTo(p[0], -p[1])); s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 12), mat); m.rotation.x = -Math.PI / 2; m.position.y = Y; m.receiveShadow = recv; return m;
  }
  function buildIsland() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(P.sea);
    hemi = new THREE.HemisphereLight('#FFFFFF', '#7AA86A', 1.25); scene.add(hemi);
    sun = new THREE.DirectionalLight('#FFF1DA', 2.1); sun.position.set(-220, 380, 520); sun.target.position.set(200, 0, 520); scene.add(sun.target);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -330, right: 330, top: 380, bottom: -380, near: 10, far: 1600 }); sun.shadow.bias = -0.0006; sun.shadow.radius = 4; scene.add(sun);
    // sea (animated vertex waves)
    seaGeo = new THREE.PlaneGeometry(1400, 1800, 70, 90); sea = mesh(seaGeo, M(P.sea, { roughness: 0.35 }), false, true); sea.rotation.x = -Math.PI / 2; sea.position.set(200, -40, 560); scene.add(sea);
    const shallow = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(blobPts(MAIN.cx, MAIN.cy + 8, MAIN.rx + 26, MAIN.ry + 26, MAIN.seed)), 8), M(P.shallow, { roughness: 0.4 })); shallow.rotation.x = -Math.PI / 2; shallow.position.y = -38.5; shallow.receiveShadow = true; scene.add(shallow);
    foam = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.0, 96), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.8 })); foam.rotation.x = -Math.PI / 2; foam.position.set(MAIN.cx, -38, Zof(MAIN.cy + 6)); scene.add(foam);
    // island body: sand slab → earth → grass cap (bevelled, clay-soft edges)
    scene.add(slab(blobPts(MAIN.cx, MAIN.cy, MAIN.rx, MAIN.ry, MAIN.seed), -1, 40, [M(P.sand, { roughness: 0.9 }), M(P.sandLo)], 3));
    const lawn = lawnTex();
    scene.add(slab(blobPts(MAIN.cx, MAIN.cy - 14, MAIN.rx - 18, MAIN.ry - 34, MAIN.seed + 0.5), 1.5, 3, [M('#FFFFFF', { map: lawn, roughness: 0.95 }), M(P.lip)], 2.2));
    // terrace (one level up): earth cliff + bevelled grass cap
    scene.add(slab(blobPts(TER.cx, TER.cy, TER.rx, TER.ry, TER.seed, 1), HY - 3, HY, [M(P.cliff), M(P.cliff, { roughness: 0.95 })], 0));
    scene.add(slab(blobPts(TER.cx, TER.cy, TER.rx + 1, TER.ry + 1, TER.seed, 1), HY + 1, 3, [M('#FFFFFF', { map: lawn, roughness: 0.95 }), M(P.lip)], 2.5));
    // ramp
    const ramp = mesh(new THREE.BoxGeometry(26, 2, Zof(334) - Zof(306) + 12), M(P.sand)); ramp.position.set(152, HY / 2, (Zof(306, 0.6) + Zof(334)) / 2); ramp.rotation.x = Math.atan2(HY, Zof(334) - Zof(306)); ramp.receiveShadow = true; scene.add(ramp);
    // sand path tiles
    for (const [x, y] of [[150, 344], [164, 350], [172, 372], [184, 392], [196, 412], [208, 432], [222, 452], [236, 468], [190, 432], [176, 456], [160, 476], [146, 494]]) { const tl = mesh(roundBox(14, 2.2, 11, 3), M('#F7E3A8'), false); tl.position.copy(V3(x, y, 0, 3)); scene.add(tl); }
    // river, banks, foam dashes, bridge, waterfall
    scene.add(ribbon(RIVER, 12, 3.6, M('#E2C47E')));
    scene.add(ribbon(RIVER, 9.5, 4.0, M(P.river, { roughness: 0.25 })));
    for (let i = 0; i < 12; i++) { const d = mesh(new THREE.BoxGeometry(5, 0.6, 1.4), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }), false, false); scene.add(d); riverFoam.push(d); }
    for (let k = 0; k < 7; k++) { const pl = mesh(roundBox(5, 3, 26, 1), M('#D9A26A')); pl.position.copy(V3(281 + k * 5.4, 381, 0, 6)); scene.add(pl); }
    for (const [px, py] of [[278, 372], [314, 372], [278, 390], [314, 390]]) { const p = mesh(new THREE.CylinderGeometry(1.6, 1.6, 12, 8), M(P.wood)); p.position.copy(V3(px, py, 0, 8)); scene.add(p); }
    const fall = mesh(new THREE.PlaneGeometry(16, HY + 4), M(P.river, { roughness: 0.2 }), false); fall.position.copy(V3(292, 296, 0, HY / 2)); fall.position.z = Zof(300); scene.add(fall);
    for (let k = 0; k < 6; k++) { const s = mesh(new THREE.BoxGeometry(1.4, 6, 0.8), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }), false, false); scene.add(s); drips.push({ m: s, k }); }
    // pier
    for (let k = 0; k < 9; k++) { const pl = mesh(roundBox(30, 2.4, 7, 1), M('#D9A26A')); pl.position.set(200, -1, Zof(604 + k * 7.6)); scene.add(pl); }
    for (const px of [187, 213]) for (const py of [612, 640, 664]) { const p = mesh(new THREE.CylinderGeometry(1.8, 1.8, 30, 8), M('#B07E4B')); p.position.set(px, -16, Zof(py)); scene.add(p); }
    // fence along terrace edge
    for (let i = 0; i < 9; i++) { const a = 0.25 + (i / 8) * 0.9; const x = TER.cx + Math.cos(a) * TER.rx * 0.9, y = TER.cy + Math.sin(a) * TER.ry * 0.88; const p = mesh(roundBox(3.4, 12, 3.4, 1.4), M('#E9C9A0')); p.position.copy(V3(x, y, 1, 6)); scene.add(p); }
    // props (same layout as the 2D scheme)
    cottage(scene, 196, 262, 1, 1, P.coral);
    cottage(scene, 108, 452, 0, 0.9, P.yellow);
    tent(scene, 248, 470);
    [[118, 212, 0.95, 1, 1], [300, 214, 1, 2, 1], [60, 372, 1, 3, 0], [150, 360, 0.8, 4, 0], [342, 380, 0.9, 5, 0], [86, 520, 1, 6, 0], [246, 556, 0.85, 7, 0], [290, 330, 0.75, 8, 0]].forEach(([x, y, s, sd, lv]) => fruitTree(scene, x, y, lv, s, sd % 3 === 0 ? '#F2575B' : sd % 3 === 1 ? '#FF9A3C' : '#FFD23F', sd));
    [[44, 588, 1, 1], [352, 600, 0.95, 2], [150, 632, 0.85, 3]].forEach(([x, y, s, sd]) => palm(scene, x, y, 0, s, sd));
    [[190, 330, 1], [150, 500, 2], [210, 590, 3], [320, 520, 4]].forEach(([x, y, sd]) => bed(scene, x, y, sd));
    [[158, 412], [232, 420], [180, 548]].forEach(([x, y]) => lampPost(scene, x, y, 0));
    for (const [x, y, s] of [[34, 470, 1], [366, 450, 0.8], [270, 610, 0.9], [120, 600, 0.7]]) { const r = mesh(new THREE.DodecahedronGeometry(7 * s, 1), M('#C9C2B4', { roughness: 0.9 })); r.scale.y = 0.6; r.position.copy(V3(x, y, 0, 3)); scene.add(r); }
    const towel = mesh(roundBox(40, 1.5, 20 / SIN * 0.9, 2), M(P.pink)); towel.position.copy(V3(300, 550, 0, 1)); scene.add(towel);
    // blob shadow material for billboards
    blob = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(30,50,40,0.5)'); g.addColorStop(1, 'rgba(30,50,40,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  }
  // ---------------- woods scene (travel destination) ----------------
  let rainDrops = [];
  function buildWoods() {
    woods = new THREE.Scene(); woods.background = new THREE.Color('#7CC860');
    woods.add(new THREE.HemisphereLight('#E6F2FF', '#5E8A4A', 1.2));
    const d = new THREE.DirectionalLight('#F2F6FF', 1.2); d.position.set(-200, 400, 600); d.target.position.set(180, 0, 420); woods.add(d.target); d.castShadow = true; d.shadow.mapSize.set(1024, 1024); Object.assign(d.shadow.camera, { left: -300, right: 300, top: 420, bottom: -420, near: 10, far: 1600 }); woods.add(d);
    const ground = mesh(new THREE.PlaneGeometry(800, 1400), M('#FFFFFF', { map: lawnTex() }), false, true); ground.rotation.x = -Math.PI / 2; ground.position.set(180, 0, 450); ground.material.map.repeat.set(4, 7); woods.add(ground);
    for (let i = 0; i < 16; i++) { const y = 660 - i * 40, x = 180 + Math.sin(i * 0.6) * 30; const s = mesh(roundBox(20, 2.4, 15, 4), M('#F7E3A8'), false); s.position.copy(V3(x, y, 0, 1.2)); woods.add(s); }
    const cedar = (x, y, s) => { const g = new THREE.Group(); g.position.copy(V3(x, y)); g.scale.setScalar(s); const tr = mesh(new THREE.CylinderGeometry(2.6, 3.4, 14, 8), M(P.wood)); tr.position.y = 7; g.add(tr); for (let i = 0; i < 3; i++) { const c = mesh(new THREE.ConeGeometry(16 - i * 3.5, 20, 14), M(i % 2 ? '#3FA357' : '#2C8446', { roughness: 0.9 })); c.position.y = 20 + i * 13; g.add(c); } woods.add(g); sway.push({ o: g, seed: x, amp: 0.02 }); };
    for (const [x, y, s] of [[40, 120, 1.4], [320, 110, 1.5], [70, 260, 1.5], [300, 280, 1.4], [30, 420, 1.6], [330, 450, 1.5], [80, 600, 1.4], [300, 620, 1.5], [180, 80, 1.2], [120, 180, 1.1], [250, 200, 1.2]]) cedar(x, y, s);
    for (const [x, y, c] of [[110, 330, P.coral], [250, 380, P.purple], [120, 520, P.yellow], [250, 560, P.coral]]) { const st = mesh(new THREE.CylinderGeometry(2, 2.4, 8, 10), M('#FFF4DC')); st.position.copy(V3(x, y, 0, 4)); woods.add(st); const cap = mesh(new THREE.SphereGeometry(7, 16, 10, 0, TAU, 0, Math.PI / 2), M(c, { roughness: 0.5 })); cap.position.copy(V3(x, y, 0, 8)); woods.add(cap); }
    for (const [px, py, pr] of [[200, 420, 14], [160, 520, 11]]) { const p = new THREE.Mesh(new THREE.CircleGeometry(pr, 24), M('#8FD4EE', { roughness: 0.15 })); p.scale.y = 0.42 / SIN; p.rotation.x = -Math.PI / 2; p.position.copy(V3(px, py, 0, 0.6)); p.receiveShadow = true; woods.add(p); }
  }

  // ---------------- billboards (2D characters inside the 3D world) ----------------
  const BB_UNITS = 120, BB_PX = 3, FEET = 108;
  function billboard(i) {
    if (billboards[i]) return billboards[i];
    const c = OC.makeCanvas(BB_UNITS * BB_PX, BB_UNITS * BB_PX); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.06, depthWrite: true }));
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2;
    return (billboards[i] = { c, tex, m, sh });
  }
  function placeChars(sc, chars, t) {
    billboards.forEach((b) => { b.m.visible = false; b.sh.visible = false; });
    const up = new THREE.Vector3(0, COS, -SIN);
    (chars || []).forEach((ch, i) => {
      const b = billboard(i); if (b.m.parent !== sc) { sc.add(b.m); sc.add(b.sh); }
      const x = b.c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, b.c.width, b.c.height);
      I.ch(x, ch.d, Object.assign({}, ch.s, { noShadow: true }), (BB_UNITS / 2) * BB_PX, FEET * BB_PX, BB_PX, t);
      b.tex.needsUpdate = true;
      b.m.material.color.set(gradientAt([[0, '#FFFFFF'], [0.4, '#FFE6D2'], [0.8, '#AEB4E6'], [1, '#9EA6E0']], NIGHT));
      const k = ch.sc || 1, foot = V3(ch.x, ch.y, ch.lvl || 0, 2);
      b.m.scale.set(BB_UNITS * k, BB_UNITS * k, 1);
      b.m.quaternion.copy(cam.quaternion);
      b.m.position.copy(foot).addScaledVector(up, (BB_UNITS / 2 - (BB_UNITS - FEET)) * k);
      b.m.visible = true;
      const lift = (ch.s.lift || 0) / 50; b.sh.visible = true; b.sh.position.copy(foot).add(new THREE.Vector3(0, -1.2, 0)); b.sh.scale.set(30 * k * (1 - lift * 0.5), (12 / SIN) * k * (1 - lift * 0.5), 1);
    });
  }

  function setCam(c) {
    const z = c.z || 1; cam.left = -180 / z; cam.right = 180 / z; cam.top = 320 / z; cam.bottom = -320 / z; cam.updateProjectionMatrix();
    const target = new THREE.Vector3(c.x, 0, Zof(c.y));
    cam.position.copy(target).add(new THREE.Vector3(0, SIN * 1200, COS * 1200)); cam.lookAt(target);
  }
  function init() {
    if (built) return; built = true;
    glc = OC.makeCanvas(1080, 1920);
    R = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true });
    R.setPixelRatio(1); R.setSize(1080, 1920, false); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.outputColorSpace = THREE.SRGBColorSpace;
    cam = new THREE.OrthographicCamera(-180, 180, 320, -320, 1, 4000);
    buildIsland(); buildWoods();
  }
  function animate(t, night) {
    const pos = seaGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * 0.03 + t * 1.6) * 1.6 + Math.cos(y * 0.025 + t * 1.2) * 1.4); }
    pos.needsUpdate = true; seaGeo.computeVertexNormals();
    const fq = (t * 0.5) % 1; foam.scale.set(MAIN.rx + 10 + fq * 12, (MAIN.ry + 10 + fq * 12) / SIN, 1); foam.material.opacity = 0.85 - fq * 0.6;
    for (const s of sway) s.o.rotation.z = Math.sin(t * 1.3 + s.seed) * s.amp;
    for (const sm of smoke) sm.list.forEach((m, i) => { const q = (t * 0.32 + i / 4) % 1; m.position.copy(sm.base).add(new THREE.Vector3(Math.sin(q * 5 + i) * 3 + q * 8, q * 34, -q * 10)); m.scale.setScalar(0.8 + q * 1.6); m.material.opacity = 0.8 * (1 - q); });
    riverFoam.forEach((d, i) => { const q = (t * 0.18 + i / riverFoam.length) % 1, sg = Math.floor(q * (RIVER.length - 1)), f = q * (RIVER.length - 1) - sg, A = RIVER[sg], B = RIVER[sg + 1]; d.position.set(lerp(A[0], B[0], f) + ((i % 3) - 1) * 4, 4.5, Zof(lerp(A[1], B[1], f))); d.rotation.y = -Math.atan2(Zof(B[1]) - Zof(A[1]), B[0] - A[0]); });
    drips.forEach(({ m, k }) => { const q = ((t * 1.6 + k / 6) % 1); m.position.set(286 + k * 2.4, HY - q * HY, Zof(300) + 0.6); });
    // light rig: day → golden hour → night
    const g = clamp((night - 0.4) / 0.45);
    sun.color.set(gradientAt([[0, '#FFF1DA'], [0.4, '#FFC48A'], [0.75, '#9AA6E6'], [1, '#8C9BE0']], night)); sun.intensity = lerp(2.1, 0.55, clamp(night * 1.2));
    hemi.color.set(gradientAt([[0, '#FFFFFF'], [0.45, '#FFD9C0'], [1, '#6E79C8']], night)); hemi.groundColor.set(mix('#7AA86A', '#2E3A6A', night)); hemi.intensity = lerp(1.25, 0.55, night);
    sun.position.set(lerp(-220, 260, night), lerp(380, 220, night), 520);
    scene.background.set(mix(P.sea, '#2E3F86', night)); sea.material.color.set(mix(P.sea, '#3A4E9A', night));
    windows.forEach((m) => { m.emissiveIntensity = g * 1.4; m.color.set(mix('#9EE3F5', '#FFE08A', g)); });
    lamps.forEach(({ m, L }) => { m.emissiveIntensity = g * 1.6; L.intensity = g * 650; });
    NIGHT = night;
  }

  /** draw the 3D island into a 2D context (dp space), then 2D overlays (emotes, sparkles). */
  function drawIsle(ctx, o) {
    init();
    const t = o.t, night = o.night || 0, c = o.cam || { x: 200, y: 400, z: 1 };
    animate(t, night); setCam(c); placeChars(scene, o.chars, t);
    R.render(scene, cam);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(glc, 0, 0, 360, 640);
    tiltShift(ctx, 0.5 + 0.5 * clamp((c.z - 0.9) / 1.2));
    ctx.restore();
    const toS = (x, y) => [(x - c.x) * c.z + 180, (y - c.y) * c.z + 320];
    for (const ch of o.chars || []) { if (!ch.emote) continue; const [sx, sy] = toS(ch.x, ch.y); I.emote(ctx, ch.emote.kind, sx + 6 * c.z, sy - 58 * (ch.sc || 1) * c.z, ch.emote.p); }
    if (night > 0.5) { const r = rng(21), a0 = clamp((night - 0.5) / 0.4); for (let i = 0; i < 26; i++) { const x = r() * 360, y = r() * 640, a = a0 * Math.max(0, Math.sin(t * 3 + i)); OC.V.icon(ctx, 'sparkle', x, y, 4 + (i % 3), `rgba(255,255,220,${a})`); } }
  }
  function drawWoods(ctx, o) {
    init();
    const t = o.t; for (const s of sway) s.o.rotation.z = Math.sin(t * 1.3 + s.seed) * s.amp;
    NIGHT = 0; setCam({ x: 180, y: 320, z: 1 }); placeChars(woods, o.chars, t);
    R.render(woods, cam);
    ctx.save(); ctx.drawImage(glc, 0, 0, 360, 640); tiltShift(ctx, 0.6); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; const r = rng(5);
    for (let i = 0; i < 60; i++) { const sp = 260 + r() * 100, x0 = r() * 400, y = ((t * sp + r() * 700) % 700) - 30, x = x0 - y * 0.15; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1.5, y + 8); ctx.stroke(); }
    ctx.fillStyle = 'rgba(120,170,220,0.12)'; ctx.fillRect(0, 0, 360, 640);
  }
  /** miniature "tilt-shift": blur the top & bottom bands of the frame for a toy-diorama feel */
  let TS = null;
  function tiltShift(ctx, k) {
    if (k <= 0) return;
    if (!TS) TS = OC.makeCanvas(360, 640);
    const x = TS.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, 360, 640);
    x.filter = `blur(${(2.2 * k).toFixed(2)}px)`; x.drawImage(glc, 0, 0, 360, 640); x.filter = 'none';
    x.globalCompositeOperation = 'destination-in';
    const g = x.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(0.86, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
    x.fillStyle = g; x.fillRect(0, 0, 360, 640);
    ctx.drawImage(TS, 0, 0);
  }

  OC.IS3 = { init, drawIsle, drawWoods, Zof, SIN, COS, HY };
})();
