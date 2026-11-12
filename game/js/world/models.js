/* OC Shimeji — stylized cosy 3D models (Sunny Isle direction).
 * Units = design dp. Every model stands on y = 0 with its footprint centred on the origin;
 * +Z faces the camera. Geometries and materials are cached and shared so the whole island
 * is a few hundred draw calls at most (phone budget). Soft edges come from bevelled
 * extrusions / lathes, never from post-processing.
 */
(function () {
  'use strict';
  const { TAU, rng, mix } = OC;
  const P = OC.Style.P;
  const G = {}, MT = {};
  const night = { windows: [], lamps: [] };   // materials the light rig drives at night

  function mat(color, o = {}) {
    // materials with their own texture are per-scene (disposed with the scene), never cached by a serialized key
    if (o.p && (o.p.map || o.p.alphaMap)) return o.std ? new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o.p)) : new THREE.MeshLambertMaterial(Object.assign({ color }, o.p));
    const k = color + JSON.stringify(o);
    if (MT[k]) return MT[k];
    const m = o.std ? new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o.p || {})) : new THREE.MeshLambertMaterial(Object.assign({ color }, o.p || {}));
    m.userData.cached = true; return (MT[k] = m);
  }
  function geo(key, make) { if (G[key]) return G[key]; const g = make(); g.userData.cached = true; return (G[key] = g); }
  function mesh(g, m, cast = true, recv = true) { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = recv; return x; }
  function add(par, g, m, x = 0, y = 0, z = 0, o = {}) {
    const me = mesh(g, m, o.cast !== false, o.recv !== false); me.position.set(x, y, z);
    if (o.rx) me.rotation.x = o.rx; if (o.ry) me.rotation.y = o.ry; if (o.rz) me.rotation.z = o.rz; if (o.s) me.scale.set(...o.s);
    par.add(me); return me;
  }
  /**
   * 14.0 (performance): a static model is built from dozens of little meshes — one draw call each, twice with shadows. fuse() bakes the
   * meshes that share a material (and the same shadow flags) into one mesh. Only for models nothing moves inside of (houses, stalls,
   * benches, fences, beds…); materials stay the same objects, so night lighting of windows keeps working. The baked geometry is this
   * model's own (not cached): the area disposes it when it unloads.
   */
  function fuse(g) {
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), buckets = new Map(), m4 = new THREE.Matrix4();
    g.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.map || (o.userData && o.userData.keep)) return; const k = o.material.uuid + (o.castShadow ? 'c' : '-') + (o.receiveShadow ? 'r' : '-'); (buckets.get(k) || buckets.set(k, []).get(k)).push(o); });
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      let n = 0; const parts = [];
      for (const o of list) { let q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); m4.multiplyMatrices(inv, o.matrixWorld); q.applyMatrix4(m4); if (!q.attributes.normal) q.computeVertexNormals(); parts.push(q); n += q.attributes.position.count; }
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let at = 0;
      for (const q of parts) { pos.set(q.attributes.position.array, at * 3); nor.set(q.attributes.normal.array, at * 3); at += q.attributes.position.count; q.dispose(); }
      const big = new THREE.BufferGeometry(); big.setAttribute('position', new THREE.BufferAttribute(pos, 3)); big.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); big.computeBoundingSphere();
      const me = mesh(big, list[0].material, list[0].castShadow, list[0].receiveShadow);
      for (const o of list) o.parent.remove(o);
      g.add(me);
    }
    return g;
  }
  /** rounded box (bevelled extrusion), centred */
  function rbox(w, h, d, r = 2) {
    return geo(`rb${w}|${h}|${d}|${r}`, () => {
      r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
      const s = new THREE.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
      s.moveTo(x, y - r * 0); s.absarc(x + W, y, 0.0001, -Math.PI / 2, 0); s.absarc(x + W, y + H, 0.0001, 0, Math.PI / 2); s.absarc(x, y + H, 0.0001, Math.PI / 2, Math.PI); s.absarc(x, y, 0.0001, Math.PI, Math.PI * 1.5);
      const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 4 });
      g.center(); g.computeVertexNormals(); return g;
    });
  }
  const sphere = (r, ws = 14, hs = 10) => geo(`sp${r}|${ws}`, () => new THREE.SphereGeometry(r, ws, hs));
  const ico = (r, d = 1) => geo(`ic${r}|${d}`, () => new THREE.IcosahedronGeometry(r, d));
  const cyl = (rt, rb, h, n = 12) => geo(`cy${rt}|${rb}|${h}|${n}`, () => new THREE.CylinderGeometry(rt, rb, h, n));
  const cone = (r, h, n = 14) => geo(`co${r}|${h}|${n}`, () => new THREE.ConeGeometry(r, h, n));
  const lathe = (key, pts, n = 16) => geo('la' + key, () => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), n));

  // ======================= buildings =======================
  /** cottage: o = { wall, roof, trim, door, w, d, h } */
  function house(o = {}) {
    const g = new THREE.Group();
    const w = o.w || 70, d = o.d || 52, h = o.h || 46, roofC = o.roof || P.coral;
    const wallM = mat(o.wall || '#FFF4DE'), trimM = mat(o.trim || '#FFFFFF'), stoneM = mat('#D9C7A6'), roofM = mat(roofC), roofLo = mat(mix(roofC, '#5a2010', 0.2));
    // stone plinth + walls
    add(g, rbox(w + 6, 8, d + 6, 3), stoneM, 0, 4, 0);
    /* 14.1: remodelled body — softer walls, round corner posts with a cap, a band under the eaves, arches over the door and windows */
    add(g, rbox(w, h, d, 8), wallM, 0, 8 + h / 2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { add(g, cyl(3.2, 3.6, h, 12), trimM, sx * (w / 2 - 2), 8 + h / 2, sz * (d / 2 - 2)); add(g, sphere(4, 10, 8), trimM, sx * (w / 2 - 2), 8 + h + 0.5, sz * (d / 2 - 2), { cast: false }).scale.set(1, 0.6, 1); }
    add(g, rbox(w + 2, 4, d + 2, 2), trimM, 0, 8 + h - 2, 0, { cast: false });
    { const arch = (x, y, r, m) => { const a2 = add(g, cyl(r, r, 2.6, 18), m, x, y, d / 2 + 0.7, { rx: Math.PI / 2, cast: false }); a2.scale.set(1, 1, 0.62); return a2; };
      arch(0, 8 + 36, 11.5, trimM); arch(0, 8 + 35.2, 8.6, mat(o.door || P.wood));
      for (const sx of [-1, 1]) arch(sx * (w * 0.31), 8 + h * 0.58 + 8.2, 8.8, trimM); }
    // gable roof: two bevelled slabs + ridge + shingle bands
    const run = w / 2 + 8, rise = 30, len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    const slabG = rbox(len, 5, d + 18, 2.4);
    for (const sx of [-1, 1]) {
      const s = add(g, slabG, roofM, sx * run / 2, 8 + h + rise / 2 + 1, 0); s.rotation.z = -sx * ang;
      for (let k = 1; k <= 3; k++) { const f = k / 4; const b = add(g, rbox(2.2, 1.6, d + 18.5, 0.7), roofLo, sx * (run - f * run), 8 + h + f * rise + 3.4, 0, { cast: false }); b.rotation.z = -sx * ang; }
    }
    add(g, cyl(3.4, 3.4, d + 20, 10), roofLo, 0, 8 + h + rise + 2.6, 0, { rx: Math.PI / 2 });
    // gable walls (front & back triangles)
    const tri = geo(`tri${w}`, () => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, rise - 2); s.lineTo(w / 2, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: d - 2, bevelEnabled: false }); });
    add(g, tri, wallM, 0, 8 + h - 0.5, -d / 2 + 1);
    // round gable window
    add(g, cyl(5, 5, 2, 18), trimM, 0, 8 + h + 11, d / 2 + 0.4, { rx: Math.PI / 2, cast: false });
    const gw = mat('#9EE3F5', { p: { emissive: new THREE.Color('#FFC860'), emissiveIntensity: 0 } }); night.windows.push(gw);
    add(g, cyl(3.6, 3.6, 2.4, 18), gw, 0, 8 + h + 11, d / 2 + 0.6, { rx: Math.PI / 2, cast: false });
    // chimney
    add(g, rbox(10, 22, 10, 2), stoneM, w * 0.26, 8 + h + rise * 0.6, -d * 0.18);
    add(g, rbox(12, 3, 12, 1.2), mat('#B9A27E'), w * 0.26, 8 + h + rise * 0.6 + 11, -d * 0.18);
    // door with frame + arch + knob + step + lantern
    const doorC = o.door || P.wood;
    add(g, rbox(22, 37, 3, 2.5), trimM, 0, 8 + 18, d / 2 + 0.6);
    add(g, rbox(17, 33, 3, 3), mat(doorC), 0, 8 + 16.5, d / 2 + 1.4);
    for (let k = -1; k <= 1; k += 2) add(g, rbox(0.8, 26, 0.8, 0.3), mat(mix(doorC, '#3a2010', 0.25)), k * 4, 8 + 15, d / 2 + 3.1, { cast: false });
    add(g, sphere(1.5, 10, 8), mat(P.yellow), 5.4, 8 + 15, d / 2 + 3.4, { cast: false });
    add(g, rbox(28, 4, 12, 1.6), stoneM, 0, 2, d / 2 + 8);
    const lantM = mat('#FFF6D8', { p: { emissive: new THREE.Color('#FFCF73'), emissiveIntensity: 0 } }); night.windows.push(lantM);
    add(g, rbox(4, 6, 4, 1), lantM, 14, 8 + 30, d / 2 + 3, { cast: false });
    // windows with frames, shutters, flower boxes
    for (const sx of [-1, 1]) {
      const wx = sx * (w * 0.31);
      const wm = mat('#A6E4F4', { p: { emissive: new THREE.Color('#FFC860'), emissiveIntensity: 0 } }); night.windows.push(wm);
      add(g, rbox(17, 17, 2.5, 2), trimM, wx, 8 + h * 0.58, d / 2 + 0.6, { cast: false });
      add(g, rbox(13, 13, 2.5, 1.5), wm, wx, 8 + h * 0.58, d / 2 + 1.1, { cast: false });
      add(g, rbox(1.4, 13, 3, 0.4), trimM, wx, 8 + h * 0.58, d / 2 + 1.5, { cast: false });
      add(g, rbox(13, 1.4, 3, 0.4), trimM, wx, 8 + h * 0.58, d / 2 + 1.5, { cast: false });
      for (const k of [-1, 1]) add(g, rbox(5, 16, 1.6, 1), mat(o.shutter || P.teal), wx + k * 11.5, 8 + h * 0.58, d / 2 + 1.2, { cast: false });
      add(g, rbox(17, 5, 6, 1.5), mat(P.wood), wx, 8 + h * 0.58 - 11, d / 2 + 3.4);
      const fr = rng(Math.round(wx * 7 + w));
      for (let i = 0; i < 5; i++) add(g, sphere(2, 8, 6), mat([P.coral, P.yellow, '#FFFFFF', P.pink][i % 4]), wx - 6 + i * 3 + fr() - 0.5, 8 + h * 0.58 - 7.5 + fr(), d / 2 + 3.4 + fr() * 1.5, { cast: false });
    }
    /* 14.0: remodelled front — a scalloped striped awning over the door, round caps on the ridge, a potted shrub and a little mailbox */
    const awA = mat(roofC), awB = mat('#FFF8EA');
    for (let k = -2; k <= 2; k++) { const st = add(g, rbox(5.6, 2.2, 13, 1), k % 2 ? awB : awA, k * 5.6, 8 + 40.5, d / 2 + 6.5, { cast: k === 0 }); st.rotation.x = 0.36; add(g, sphere(2.8, 10, 8), k % 2 ? awB : awA, k * 5.6, 8 + 37.6, d / 2 + 12.4, { cast: false }).scale.set(1, 0.7, 0.5); }
    for (const sz of [-1, 1]) add(g, sphere(4.4, 12, 10), roofLo, 0, 8 + h + rise + 2.6, sz * (d / 2 + 10), { cast: false });
    add(g, cyl(4.2, 3.4, 6, 12), mat('#C98C5A'), -w * 0.2, 3 + 4, d / 2 + 6.5);
    add(g, sphere(5.4, 12, 10), mat('#5CBB4E'), -w * 0.2, 3 + 11.5, d / 2 + 6.5).scale.set(1, 0.9, 1);
    add(g, cyl(0.9, 0.9, 13, 8), mat(P.wood), w * 0.36, 6.5, d / 2 + 7, { cast: false });
    add(g, rbox(7, 5, 5, 2), mat(o.shutter || P.teal), w * 0.36, 14.5, d / 2 + 7);
    add(g, rbox(0.8, 4, 2, 0.3), mat(P.coral), w * 0.36 + 4, 16.5, d / 2 + 7, { cast: false });
    g.userData.size = { w: w + 6, d: d + 6 };
    return fuse(g);
  }

  /** market stall with striped awning */
  function stall() {
    const g = new THREE.Group();
    const woodM = mat('#D9A26A'), woodLo = mat('#B07E4B');
    add(g, rbox(64, 18, 26, 3), mat('#FFF4DC'), 0, 9, 2);
    add(g, rbox(66, 3, 28, 1.4), woodM, 0, 19.5, 2);
    /* 14.1: remodelled — sturdier round posts with caps, a plump scalloped awning, a cloth skirt on the counter, a barrel and two hanging lanterns */
    for (const [px, pz] of [[-30, 14], [30, 14], [-30, -12], [30, -12]]) { add(g, cyl(2.1, 2.4, 54, 10), mat('#FFFFFF'), px, 27, pz); add(g, sphere(3, 10, 8), mat(P.coral), px, 59 + (pz < 0 ? 4 : -3), pz, { cast: false }); }
    for (let i = 0; i < 8; i++) add(g, rbox(8.2, 13, 1.2, 0.6), mat(i % 2 ? '#FFF4DC' : P.teal), -28.7 + i * 8.2, 11.5, 15.4, { cast: false });
    add(g, cyl(6.5, 5.6, 13, 14), woodLo, 39, 6.5, 6); add(g, cyl(6.9, 6.9, 1.4, 14), mat('#8A5A33'), 39, 4, 6, { cast: false }); add(g, cyl(6.9, 6.9, 1.4, 14), mat('#8A5A33'), 39, 10, 6, { cast: false });
    { const lm = mat('#FFF6D8', { p: { emissive: new THREE.Color('#FFCF73'), emissiveIntensity: 0 } }); night.windows.push(lm); for (const lx of [-24, 24]) { add(g, cyl(0.4, 0.4, 5, 6), woodLo, lx, 47.5, 19, { cast: false }); add(g, sphere(2.8, 10, 8), lm, lx, 43.5, 19, { cast: false }).scale.set(1, 1.2, 1); } }
    const roof = new THREE.Group(); roof.position.set(0, 56, 2); roof.rotation.x = 0.22; g.add(roof);
    for (let i = 0; i < 8; i++) add(roof, rbox(8.6, 2.4, 38, 1), mat(i % 2 ? '#FFFFFF' : P.teal), -30 + i * 8.6, 0, 0);
    for (let i = 0; i < 8; i++) { const c = add(roof, sphere(4.3, 12, 8), mat(i % 2 ? '#FFFFFF' : P.teal), -30 + i * 8.6, -0.6, 19.4, { cast: false }); c.scale.set(1, 0.85, 0.5); }
    // crates of fruit
    for (const [cx, col] of [[-18, '#EE4B4B'], [0, '#FF9A3C'], [18, '#FFB3A7']]) {
      add(g, rbox(15, 7, 11, 1.2), woodLo, cx, 24.5, 4);
      for (let k = 0; k < 4; k++) add(g, sphere(2.6, 10, 8), mat(col), cx - 4 + (k % 2) * 8 - (k > 1 ? 2 : 0), 29 + (k > 1 ? 1.5 : 0), 2 + (k % 2) * 3 + (k > 1 ? 2 : 0), { cast: false });
    }
    // sign
    const sign = add(g, rbox(26, 9, 2, 2), mat(P.coral), 0, 48, 20.6, { cast: false }); sign.rotation.x = 0.22;
    add(g, ico(2.2, 0), mat('#FFFFFF'), -8, 48.6, 21.6, { cast: false }); add(g, ico(2.2, 0), mat('#FFFFFF'), 8, 48.6, 21.6, { cast: false });
    g.userData.size = { w: 66, d: 30 };
    return fuse(g);
  }

  // ======================= nature =======================
  function trunk(h, r0, r1) { return lathe(`tr${h}|${r0}|${r1}`, [[0, 0], [r0 * 1.5, 0], [r0 * 1.05, h * 0.12], [r1, h], [0, h]], 10); }
  /** fruit tree → { group, crown, fruits[] } */
  function fruitTree(fruit, seed = 1) {
    const g = new THREE.Group(); const r = rng(seed * 97 + 3);
    add(g, trunk(28, 3.6, 2.6), mat(P.wood), 0, 0, 0);
    const crown = new THREE.Group(); crown.position.y = 38; g.add(crown);
    /* 14.0: remodelled — a plump, smooth crown in three rounded tiers (wide skirt, middle, cap), darker underneath and with a few
     * lighter puffs on the sunny side; the same footprint, the same { group, crown, fruits } as before */
    const leaf = mat('#5CBB4E'), leafHi = mat('#7AD25F'), leafLo = mat('#47A046');
    const puff = sphere(10, 16, 12);
    const tiers = [[0, -3, 0, 1.75, 1.05, leafLo], [0, 5, 0, 1.5, 1.05, leaf], [0, 14, 0, 1.08, 0.95, leaf],
      [-11, 1, 5, 0.92, 0.85, leaf], [11, 2, -3, 0.95, 0.85, leaf], [1, 0, 12, 0.9, 0.8, leaf], [-3, 3, -11, 0.85, 0.8, leafLo],
      [-7, 12, 6, 0.6, 0.55, leafHi], [-12, 5, 9, 0.42, 0.4, leafHi], [-2, 19, 4, 0.5, 0.42, leafHi]];
    for (const [x, y, z, sx, sy, m] of tiers) { const b = add(crown, puff, m, x + (r() - 0.5) * 1.5, y, z + (r() - 0.5) * 1.5); b.scale.set(sx, sy, sx * 0.96); }
    const fruits = [];
    const fm = mat(fruit);
    for (let i = 0; i < 6; i++) { const a = r() * TAU, yy = r() * 14 - 4; const f = add(crown, sphere(2.8, 12, 10), fm, Math.cos(a) * 14, yy, Math.sin(a) * 12 + 4, { cast: false }); f.userData.keep = true; /* fruit is picked one by one */ fruits.push(f); }
    fuse(crown);
    g.userData.size = { w: 14, d: 12 };
    return { group: g, crown, fruits };
  }
  function palm(seed = 1) {
    const g = new THREE.Group(); let px = 0, py = 0;
    const segM = [mat('#C99863'), mat('#B98955')];
    for (let i = 0; i < 7; i++) { const s = add(g, cyl(2.7 - i * 0.14, 3.1 - i * 0.14, 9.4, 10), segM[i % 2], px, py + 4.7, 0); s.rotation.z = -0.07 * i; px += 0.7 * i; py += 8.8; }
    const top = new THREE.Group(); top.position.set(px, py, 0); g.add(top);
    const lf = geo('palmleaf', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(9, 4.2, 22, 0.5); s.quadraticCurveTo(10, -2.2, 0, 0); const e = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.6, bevelSegments: 1 }); e.rotateX(Math.PI / 2); return e; });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + seed; const m = add(top, lf, mat(k % 2 ? '#52B84A' : '#47A845'), 0, 0, 0); m.rotation.set(0, -a, -0.45 - (k % 3) * 0.08); }
    for (const [dx, dz] of [[-2, 2], [2, 2], [0, -1.5]]) add(top, sphere(2.7, 10, 8), mat('#8A5A33'), dx, -2.5, dz);
    g.userData.size = { w: 8, d: 8 };
    return { group: g, crown: top };
  }
  function cedar(seed = 1) {
    const g = new THREE.Group();
    add(g, trunk(16, 3.4, 2.6), mat(P.wood));
    const crown = new THREE.Group(); g.add(crown);
    /* 14.0: remodelled — three rounded, overlapping tiers (a turned profile with a soft lip), a small round tip */
    const tier = lathe('cedar14', [[0, 0], [15, 0.6], [17.5, 3.2], [16.5, 6.5], [9, 16], [3.2, 22.5], [0, 23.5]], 14);
    const cols = ['#2F8A49', '#39994F', '#45A957'];
    for (let i = 0; i < 3; i++) { const k = 1 - i * 0.22; const t = add(crown, tier, mat(cols[i]), 0, 14 + i * 13.5, 0, { ry: i * 0.5 + seed }); t.scale.set(k, 0.95, k); }
    add(crown, sphere(10, 16, 12), mat(cols[2]), 0, 56, 0).scale.set(0.3, 0.42, 0.3);
    fuse(crown);
    g.userData.size = { w: 14, d: 12 };
    return { group: g, crown };
  }
  function bush(seed = 1, col = '#5DB64C') {
    const g = new THREE.Group(); const r = rng(seed * 31);
    /* 14.0: remodelled — smooth round puffs (one big, three leaning on it), lighter on top */
    const lo = mix(col, '#2e6a30', 0.18), hi = mix(col, '#c8f08a', 0.22), puff = sphere(10, 16, 12);
    for (const [x, y, z, k, m] of [[0, 5.5, 0, 0.82, col], [-6.5, 4.5, 1.5, 0.6, lo], [6.5, 4.5, -1, 0.62, col], [1, 4, 5, 0.55, lo], [-2.5, 9.5, 1.5, 0.4, hi]]) { const b = add(g, puff, mat(m), x + (r() - 0.5) * 2, y, z + (r() - 0.5) * 1.5); b.scale.set(k, k * 0.86, k * 0.92); }
    if (seed % 2) for (let i = 0; i < 5; i++) add(g, sphere(1.4, 8, 6), mat(seed % 4 === 1 ? '#FFFFFF' : P.pink), (r() - 0.5) * 14, 8 + r() * 4, 3 + r() * 4, { cast: false });
    fuse(g);
    g.userData.size = { w: 18, d: 12 };
    return { group: g, crown: g };
  }
  function rock(s = 1, seed = 1) {
    const g = new THREE.Group();
    const r = add(g, geo(`rock${seed % 3}`, () => { /* 14.0: remodelled — a rounder, river-worn pebble (smooth sphere pushed by a few slow waves) instead of a jagged lump */ const q = new THREE.SphereGeometry(8, 18, 12); const p = q.attributes.position; const sd = seed % 3 + 1; for (let i = 0; i < p.count; i++) { const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i); const k = 1 + 0.09 * Math.sin(X * 0.42 + sd * 1.7) + 0.08 * Math.sin(Z * 0.5 + sd * 2.9) + 0.06 * Math.sin(Y * 0.7 + sd); p.setXYZ(i, X * k, (Y < 0 ? Y * 0.55 : Y) * k, Z * k); } q.computeVertexNormals(); return q; }), mat(P.stone), 0, 3.5 * s, 0);
    r.scale.set(s, s * 0.62, s);
    g.userData.size = { w: 14 * s, d: 12 * s };
    return g;
  }
  /** raised flower bed with a stone border, mixed blooms */
  function flowerBed(w = 34, d = 18, seed = 1) {
    const g = new THREE.Group(); const r = rng(seed * 13);
    add(g, rbox(w, 3, d, 1.4), mat('#8C6A4E'), 0, 1.5, 0);
    for (let i = 0; i < Math.round((w + d) / 4.5); i++) { const t = i / Math.round((w + d) / 4.5), per = 2 * (w + d), p = t * per; let x, z; if (p < w) { x = -w / 2 + p; z = -d / 2; } else if (p < w + d) { x = w / 2; z = -d / 2 + p - w; } else if (p < 2 * w + d) { x = w / 2 - (p - w - d); z = d / 2; } else { x = -w / 2; z = d / 2 - (p - 2 * w - d); } add(g, ico(2.4, 0), mat(i % 2 ? P.stone : '#DAD3C5'), x, 2.2, z); }
    const stems = mat('#4E9E46'), cols = [P.coral, P.yellow, '#FFFFFF', P.pink, P.purple];
    const blooms = [];
    for (let i = 0; i < Math.round(w * d / 30); i++) {
      const x = (r() - 0.5) * (w - 6), z = (r() - 0.5) * (d - 6), hh = 4 + r() * 3;
      const f = new THREE.Group(); f.position.set(x, 3, z); g.add(f);
      add(f, cyl(0.4, 0.4, hh, 4), stems, 0, hh / 2, 0, { cast: false });
      const lv = add(f, sphere(1.6, 6, 4), stems, 0.9, hh * 0.4, 0, { cast: false }); lv.scale.set(1, 0.4, 0.6);
      const c = cols[(i + seed) % 5];
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; add(f, sphere(1.2, 6, 4), mat(c), Math.cos(a) * 1.3, hh + 0.4, Math.sin(a) * 1.3, { cast: false }); }
      add(f, sphere(0.9, 6, 4), mat('#FFD34D'), 0, hh + 0.7, 0, { cast: false });
      fuse(f);   /* 14.0: a flower is 8 little meshes → 3 (stem + leaf, petals, centre); it still sways as one */
      blooms.push(f);
    }
    g.userData.size = { w, d }; g.userData.blooms = blooms;
    return g;
  }
  function fence(len = 20) {
    const g = new THREE.Group(); const m = mat('#EAD3AE');
    for (let x = -len / 2; x <= len / 2 + 0.1; x += 10) { add(g, rbox(3.2, 12, 3.2, 1.2), m, x, 6, 0); add(g, cone(2.3, 2.6, 4), m, x, 13.3, 0, { ry: Math.PI / 4 }); }
    add(g, rbox(len, 2, 1.6, 0.7), m, 0, 9, 0); add(g, rbox(len, 2, 1.6, 0.7), m, 0, 4.5, 0);
    return fuse(g);
  }
  function lampPost(withLight) {
    const g = new THREE.Group();
    add(g, cyl(2.4, 3, 3, 10), mat('#6B4F3A'), 0, 1.5, 0);
    add(g, cyl(1.2, 1.6, 30, 10), mat('#6B4F3A'), 0, 16, 0);
    const capM = mat('#FFF8E7', { p: { emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0 } });
    add(g, sphere(4.6, 14, 12), capM, 0, 33, 0, { cast: false });
    add(g, cone(6, 4.4, 12), mat(P.coral), 0, 39.2, 0);
    add(g, sphere(1.3, 8, 6), mat(P.coral), 0, 42, 0);
    let L = null;
    if (withLight) { L = new THREE.PointLight('#FFC870', 0, 140, 1.7); L.position.y = 33; g.add(L); }
    night.lamps.push({ m: capM, L });
    g.userData.size = { w: 6, d: 6 };
    return fuse(g);
  }
  function bench() {
    const g = new THREE.Group(); const wM = mat('#D9A26A'), leg = mat('#6B4F3A');
    for (let i = 0; i < 3; i++) add(g, rbox(36, 2, 3.4, 0.8), wM, 0, 9, -3.6 + i * 3.6);
    for (let i = 0; i < 2; i++) add(g, rbox(36, 3, 2, 0.8), wM, 0, 14 + i * 4.6, -6.8, { rx: -0.12 });
    for (const sx of [-15, 15]) { add(g, rbox(2.4, 9, 9, 0.8), leg, sx, 4.5, -0.5); add(g, rbox(2.4, 12, 2, 0.8), leg, sx, 14, -6.8); }
    g.userData.size = { w: 38, d: 12 };
    return fuse(g);
  }
  function signpost(text) {
    const g = new THREE.Group();
    add(g, cyl(1.4, 1.6, 28, 8), mat(P.wood), 0, 14, 0);
    const b = add(g, rbox(26, 9, 2.4, 2), mat('#F7E3A8'), 4, 24, 1); b.rotation.z = -0.05;
    add(g, cone(4.4, 6, 3), mat('#F7E3A8'), 18.5, 24, 1, { rz: -Math.PI / 2 });
    g.userData.size = { w: 8, d: 6 };
    return g;
  }
  function mushroom(col = P.coral, s = 1) {
    const g = new THREE.Group();
    add(g, lathe('mstem', [[0, 0], [2.6, 0], [2.1, 4], [2.3, 8], [0, 8]], 10), mat('#FFF4DC'));
    const cap = add(g, geo('mcap', () => new THREE.SphereGeometry(7, 16, 10, 0, TAU, 0, Math.PI / 2)), mat(col), 0, 7.5, 0); cap.scale.y = 0.75;
    for (let i = 0; i < 4; i++) { const a = i * 1.7; add(g, sphere(1.1, 6, 4), mat('#FFFFFF'), Math.cos(a) * 4, 10.2 - (i % 2), Math.sin(a) * 4 + 1, { cast: false }); }
    g.scale.setScalar(s);
    g.userData.size = { w: 10 * s, d: 10 * s };
    return g;
  }
  function stump() { const g = new THREE.Group(); add(g, cyl(6, 7, 7, 12), mat(P.wood), 0, 3.5, 0); add(g, cyl(5.6, 5.6, 0.6, 12), mat('#F2D3A4'), 0, 7.2, 0, { cast: false }); g.userData.size = { w: 14, d: 12 }; return g; }
  function bridge(len = 46, wid = 24) {
    const g = new THREE.Group(); const pl = mat('#D9A26A'), pl2 = mat('#C88F58'), post = mat(P.woodLo), cap = mat('#FFF4DC');
    const n = Math.round(len / 5.4), hump = (t) => 4 + Math.sin(t * Math.PI) * 3;
    for (let k = 0; k < n; k++) { const x = -len / 2 + (k + 0.5) * (len / n); add(g, rbox(len / n - 0.6, 2.4, wid, 1.1), k % 2 ? pl : pl2, x, hump((k + 0.5) / n), 0); }
    /* 14.1: remodelled — the handrail follows the hump of the bridge (five round posts with pale caps a side, rails in short segments) */
    for (const sz of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 4; k++) { const t = k / 4, x = -len / 2 + 2 + t * (len - 4), y = hump(t); pts.push([x, y]); add(g, cyl(1.5, 1.8, 11, 10), post, x, y + 5, sz * (wid / 2 - 1)); add(g, sphere(2.1, 10, 8), cap, x, y + 11, sz * (wid / 2 - 1), { cast: false }); }
      for (let k = 0; k < 4; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], L = Math.hypot(x1 - x0, y1 - y0); for (const up of [8.6, 4.6]) { const r = add(g, cyl(0.75, 0.75, L, 8), post, (x0 + x1) / 2, (y0 + y1) / 2 + up, sz * (wid / 2 - 1), { cast: up > 6 }); r.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2; } }
    }
    return fuse(g);
  }

  // ======================= furniture (placeable) =======================
  const FURN = {
    lamp() { const g = new THREE.Group(); add(g, lathe('flamp', [[0, 0], [5, 0], [5, 1.6], [1.6, 2.4], [1.4, 14], [0, 14]], 12), mat('#FFF3E0')); const m = mat('#F06A5A', { p: { emissive: new THREE.Color('#FFB86B'), emissiveIntensity: 0 } }); const c = add(g, geo('flcap', () => new THREE.SphereGeometry(9, 16, 10, 0, TAU, 0, Math.PI / 2)), m, 0, 13, 0); c.scale.y = 0.72; for (let i = 0; i < 4; i++) add(g, sphere(1.3, 6, 4), mat('#FFFFFF'), Math.cos(i * 1.6) * 5.4, 16.6, Math.sin(i * 1.6) * 5.4, { cast: false }); g.userData.glow = m; return g; },
    cushion() { const g = new THREE.Group(); const c = add(g, sphere(9, 18, 12), mat('#B9A7F0'), 0, 4, 0); c.scale.set(1, 0.42, 1); for (const [x, z] of [[-5, -3], [4, -4], [0, 3]]) { const p = add(g, sphere(4.4, 10, 8), mat('#D6CBF7'), x, 6.4, z, { cast: false }); p.scale.y = 0.5; } return g; },
    plant() { const g = new THREE.Group(); add(g, lathe('pot', [[0, 0], [4.6, 0], [6, 9], [6.6, 9.4], [6.6, 10.6], [0, 10.6]], 14), mat('#E2895A')); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const l = add(g, sphere(3, 8, 6), mat(i % 2 ? '#5FBF62' : '#4FAA45'), Math.cos(a) * 3.4, 15 + (i % 3) * 2, Math.sin(a) * 3.4); l.scale.set(0.7, 1.6, 0.7); l.rotation.z = Math.cos(a) * 0.5; l.rotation.x = -Math.sin(a) * 0.5; } return g; },
    rug() { const g = new THREE.Group(); const r = add(g, cyl(15, 15, 1, 28), mat('#FFC93C'), 0, 0.6, 0, { cast: false }); r.scale.z = 0.86; add(g, cyl(5, 5, 1.1, 18), mat('#F06A5A'), 0, 0.8, 2, { cast: false }); for (let i = 0; i < 4; i++) add(g, cyl(2, 2, 1.1, 10), mat('#F06A5A'), -6 + i * 4, 0.8, -5 + Math.abs(i - 1.5) * 1.6, { cast: false }); return g; },
    chair() { const g = new THREE.Group(); const w = mat('#D9A26A'), d = mat('#B07E4B'); add(g, rbox(16, 3, 15, 1.2), w, 0, 10, 0); add(g, rbox(16, 14, 3, 1.4), w, 0, 18, -6.5); for (const [x, z] of [[-6, -5.5], [6, -5.5], [-6, 5.5], [6, 5.5]]) add(g, rbox(2.4, 9, 2.4, 0.8), d, x, 4.5, z); return g; },
    bed() { const g = new THREE.Group(); const w = mat('#D9A26A'), d = mat('#B07E4B'); add(g, rbox(18, 4, 34, 1.4), w, 0, 5, 0); add(g, rbox(18, 12, 3, 1.4), d, 0, 9, -16); add(g, rbox(18, 7, 3, 1.4), d, 0, 6.5, 16); for (const [x, z] of [[-7.5, -14.5], [7.5, -14.5], [-7.5, 14.5], [7.5, 14.5]]) add(g, rbox(2.4, 4, 2.4, 0.8), d, x, 2, z); add(g, rbox(16, 3.2, 30, 1.4), mat('#FFF7EC'), 0, 8.4, 0, { cast: false }); add(g, rbox(16.4, 2.4, 18, 1.2), mat('#9FD3FF'), 0, 9.6, 5, { cast: false }); const pl = add(g, sphere(5, 12, 8), mat('#FFFFFF'), 0, 10.6, -10, { cast: false }); pl.scale.set(1.3, 0.45, 0.8); const st = add(g, sphere(1.6, 8, 6), mat('#FFD23F'), 3, 11, 6, { cast: false }); st.scale.y = 0.4; return g; },
    table() { const g = new THREE.Group(); const t = add(g, cyl(15, 15, 2.6, 24), mat('#D9A26A'), 0, 16, 0); add(g, cyl(2, 2.4, 15, 10), mat('#B07E4B'), 0, 7.5, 0); add(g, cyl(7, 7.6, 1.6, 16), mat('#B07E4B'), 0, 0.8, 0); add(g, cyl(5, 5, 0.6, 16), mat('#FFFFFF'), -4, 17.6, 2, { cast: false }); add(g, sphere(2.4, 10, 8), mat('#EE4B4B'), 5, 19.6, -2); return g; },
  };
  function furniture(id) { const it = OC.Style.ITEMS[id]; const g = it && it.custom && OC.Models.standee ? OC.Models.standee(it) : (FURN[id] || FURN.plant)(); g.userData.furn = id; return g; }

  OC.Models = { FURN, fuse, trunk, mat, geo, mesh, add, rbox, sphere, ico, cyl, cone, lathe, house, stall, fruitTree, palm, cedar, bush, rock, flowerBed, fence, lampPost, bench, signpost, mushroom, stump, bridge, furniture, night };
})();
