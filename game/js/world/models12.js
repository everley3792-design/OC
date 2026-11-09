/* OC Shimeji 12.0 — remodelled furniture (replaces the simple first versions in models.js / models2.js; same ids, same footprints).
 * More believable proportions and a few honest details (slatted headboard, bedspread and pillows, a tablecloth with a cup and a flower,
 * books that lean, a stove with a window in the oven door and knobs, throw pillows, a desk lamp that glows at night, leaves with a gradient).
 * Everything stays inside the item's footprint (units are design dp, 18 per tile), uses the shared geometry / material caches, and the
 * muted palette of the 12.0 tone. Pieces keep their ids; OC.Models.FURN[id]() still returns a THREE.Group standing on y = 0.
 */
(function () {
  'use strict';
  const Mo = OC.Models, { mat, geo, add, rbox, sphere, cyl, lathe, FURN } = Mo;
  const TAU = Math.PI * 2, rng = OC.rng;
  const WOOD = '#B98A5E', WOOD_D = '#8F6A47', WOOD_L = '#D9B48A', CREAM = '#F6F0E4', LINEN = '#E8DED0';

  /** an elongated leaf (shared ellipsoid): a pivot turned to face outward, the blade leaning away from the stem */
  function leaf(g, col, x, y, z, ang, tilt, s = 1) {
    const piv = new THREE.Group(); piv.position.set(x, y, z); piv.rotation.y = -ang; g.add(piv);
    const l = add(piv, sphere(3, 8, 6), mat(col), 1.2 * s, 1.6 * s, 0, { cast: false }); l.scale.set(0.2 * s, 1.5 * s, 0.62 * s); piv.rotation.z = 0; l.rotation.z = -tilt; return l;
  }
  /** merge many small boxes into ONE cached geometry (one draw call instead of dozens): parts = [[w, h, d, Matrix4], …] */
  function boxes(key, parts) {
    return geo(key, () => {
      const gs = parts.map(([w, h, d, m]) => { const b = new THREE.BoxGeometry(w, h, d); b.applyMatrix4(m); return b; });
      let nv = 0, ni = 0; for (const b of gs) { nv += b.attributes.position.count; ni += b.index.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni); let vo = 0, io = 0;
      for (const b of gs) { pos.set(b.attributes.position.array, vo * 3); nor.set(b.attributes.normal.array, vo * 3); for (let i = 0; i < b.index.count; i++) idx[io++] = b.index.array[i] + vo; vo += b.attributes.position.count; b.dispose(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
    });
  }
  const glowMat = (c, e) => { const m = mat(c, { p: { emissive: new THREE.Color(e), emissiveIntensity: 0 } }); Mo.night.windows.push(m); return m; };

  Object.assign(FURN, {
    bed() {
      const g = new THREE.Group(), w = mat(WOOD), d = mat(WOOD_D);
      for (const [x, z] of [[-8.5, -16], [8.5, -16], [-8.5, 16], [8.5, 16]]) add(g, rbox(2.6, 6, 2.6, 0.8), d, x, 3, z);
      add(g, rbox(20, 3, 34, 1.2), w, 0, 7, 0);                                              // frame
      add(g, rbox(19, 5.5, 31, 2), mat(CREAM), 0, 11.2, 1);                                  // mattress
      add(g, rbox(21, 17, 3, 1.2), d, 0, 12, -17);                                             // headboard + slats
      for (const x of [-6, -2, 2, 6]) add(g, rbox(1.4, 9, 1.2, 0.4), w, x, 13, -15.4, { cast: false });
      add(g, rbox(21, 8, 2.6, 1.2), d, 0, 8.5, 17);                                            // footboard
      add(g, rbox(19.6, 3.4, 19, 1.6), mat('#8FA9B8'), 0, 14.2, 6, { cast: false });         // blanket
      add(g, rbox(19.8, 1.3, 3.4, 0.5), mat('#DCE6EA'), 0, 16, -3, { cast: false });         // folded edge
      for (const x of [-5, 5]) { const p = add(g, sphere(4.6, 12, 8), mat(x < 0 ? '#FFFFFF' : LINEN), x, 15, -11, { cast: false }); p.scale.set(1.25, 0.5, 0.85); }
      return g;
    },
    table() {
      const g = new THREE.Group();
      add(g, cyl(7.4, 7.9, 1.4, 18), mat(WOOD_D), 0, 0.7, 0); add(g, cyl(2.1, 2.5, 14, 10), mat(WOOD), 0, 8, 0);   // base + stem
      add(g, cyl(15, 15, 2.2, 28), mat(WOOD_L), 0, 15.8, 0);                                                      // top
      add(g, lathe('cloth', [[0, 17.4], [13.6, 17.4], [15.8, 16.6], [15.4, 12.6], [0, 12.6]], 28), mat('#F7F1E6'), 0, 0, 0, { cast: false });   // tablecloth
      add(g, cyl(4.2, 3.4, 0.5, 14), mat('#FFFFFF'), -5, 17.8, 3, { cast: false }); add(g, cyl(2.2, 1.8, 3, 12), mat('#FFFFFF'), -5, 19.4, 3, { cast: false });   // saucer + cup
      add(g, cyl(1.5, 1.9, 5, 10), mat('#9DB8B0'), 6, 20, -3, { cast: false }); add(g, sphere(2, 8, 6), mat('#F2B7A8'), 6, 23.4, -3, { cast: false });         // bud vase + flower
      add(g, sphere(2.1, 10, 8), mat('#EE6B5B'), 4, 19, 6, { cast: false });                                                                                  // apple
      return g;
    },
    bookshelf() {
      const g = new THREE.Group(), w = mat('#A9764B'), d = mat(WOOD_D), cols = ['#B5655A', '#7E9FB5', '#D6B56A', '#7FA48B', '#8E7BB0', '#C98CA0', '#E8DED0'];
      add(g, rbox(40, 46, 2, 0.8), d, 0, 23, -5, { cast: false });                                // back
      for (const sx of [-1, 1]) add(g, rbox(2.6, 46, 12, 1), w, sx * 18.7, 23, 0);               // sides
      for (let r = 0; r < 4; r++) add(g, rbox(37, 2.2, 11, 0.6), w, 0, 1.1 + r * 14.6, 0);       // shelves
      add(g, rbox(42, 2.4, 13.5, 1), d, 0, 46.8, 0);                                              // top cap
      const byCol = {}, M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
      for (let r = 0; r < 3; r++) {
        const R = rng(r * 7 + 3); let x = -16;
        while (x < 15) {
          const bw = 2.2 + R() * 2.4, bh = 8 + R() * 4, col = cols[Math.floor(R() * cols.length)], lean = R() < 0.12 ? 0.22 : 0;
          Q.setFromEuler(E.set(0, 0, -lean)); M4.compose(V.set(x + bw / 2, 2.2 + r * 14.6 + bh / 2, 1.2), Q, S1); (byCol[col] = byCol[col] || []).push([bw, bh, 7, M4.clone()]);
          if (lean) x += bh * 0.2; x += bw + 0.5;
        }
      }
      for (const col of Object.keys(byCol)) add(g, boxes('shelfbooks' + col, byCol[col]), mat(col), 0, 0, 0, { cast: false });   // the books: one draw call per colour
      add(g, cyl(2.6, 2.1, 4, 10), mat('#C98C6B'), -11, 49.4, 0, { cast: false }); for (let i = 0; i < 4; i++) leaf(g, i % 2 ? '#6FAF72' : '#5C9E63', -11 + Math.cos(i * 1.6) * 1.4, 54, Math.sin(i * 1.6) * 1.4, i * 1.6, 0.45, 0.8);   // little plant on top
      return g;
    },
    stove() {
      const g = new THREE.Group();
      add(g, rbox(40, 22, 16, 2), mat('#F4F1EA'), 0, 11, 0);                                       // body
      add(g, rbox(42, 3, 18, 1.2), mat('#5E8F86'), 0, 23.5, 0);                                    // worktop
      add(g, rbox(24, 12, 1.4, 1), mat('#4A5560'), -1, 10, 8.3, { cast: false }); add(g, rbox(26, 1.4, 1.6, 0.5), mat('#B8C2C8'), -1, 17.4, 9.2, { cast: false });   // oven window + handle
      for (let i = 0; i < 4; i++) add(g, cyl(1.3, 1.3, 1.6, 8), mat('#3B2B25'), -13.5 + i * 4.6, 20.5, 8.4, { rx: Math.PI / 2, cast: false });                  // knobs
      for (const x of [-9, 9]) { add(g, cyl(4.4, 4.4, 0.8, 16), mat('#3B2B25'), x, 25.3, 0, { cast: false }); add(g, cyl(2.4, 2.4, 0.9, 12), mat('#555F6B'), x, 25.4, 0, { cast: false }); }
      add(g, lathe('kettle', [[0, 0], [4.4, 0], [5, 3], [4, 6.4], [2, 7.2], [0, 7.4]], 14), mat('#9AA3B5'), -9, 25.6, 0); add(g, cyl(0.6, 0.6, 6, 6), mat('#5B4638'), -9, 32.6, 0, { cast: false });
      add(g, cyl(4.3, 4, 5, 12), mat('#C9D3D6'), 9, 28, 0);                                         // pot
      add(g, rbox(40, 24, 2, 1), mat('#FFF1DE'), 0, 36, -7);                                        // backsplash
      for (let i = 0; i < 4; i++) add(g, rbox(0.5, 22, 0.5, 0.15), mat('#E8DAC4'), -15 + i * 10, 36, -5.8, { cast: false });
      add(g, rbox(26, 2, 6, 0.6), mat(WOOD), 0, 44, -5, { cast: false });                          // spice shelf
      for (const x of [-7, 0, 7]) add(g, cyl(1.7, 1.7, 4, 8), mat(['#C9D8C2', '#E7B9A0', '#D9C7A6'][Math.round(x / 7) + 1]), x, 47, -5, { cast: false });
      return g;
    },
    sofa() {
      const g = new THREE.Group(), c = mat('#8FA9B8'), c2 = mat('#A9C0CD');
      for (const [x, z] of [[-17, -6], [17, -6], [-17, 6], [17, 6]]) add(g, cyl(1.2, 1.4, 3.4, 8), mat(WOOD_D), x, 1.7, z);
      add(g, rbox(40, 8, 18, 3), c, 0, 6.5, 0); add(g, rbox(40, 17, 6, 3), c, 0, 14.5, -6.5);       // base + back
      for (const sx of [-1, 1]) add(g, rbox(6.5, 13, 18, 2.8), c, sx * 18.5, 10, 0);                   // arms
      for (const sx of [-1, 1]) add(g, rbox(14.6, 4.6, 13.5, 2.2), c2, sx * 7.6, 11.8, 2);             // seat cushions
      for (const sx of [-1, 1]) { const p = add(g, rbox(13, 12, 3.6, 2), c2, sx * 7.6, 17.5, -2.6); p.rotation.x = -0.12; }   // back cushions
      const t1 = add(g, rbox(8, 8, 3, 1.6), mat('#C98CA0'), -13, 16, 1.6, { cast: false }); t1.rotation.set(-0.25, 0, 0.35);
      const t2 = add(g, rbox(7, 7, 3, 1.4), mat('#D6B56A'), 14, 15.5, 1.4, { cast: false }); t2.rotation.set(-0.25, 0, -0.3);
      return g;
    },
    desk() {
      const g = new THREE.Group(), w = mat(WOOD), d = mat(WOOD_D);
      add(g, rbox(38, 2.6, 18, 1.2), mat(WOOD_L), 0, 17, -2); add(g, rbox(3, 16, 16, 1), d, -17, 8, -2);                 // top + left panel
      add(g, rbox(12, 16, 16, 1.4), w, 13, 8, -2); for (const y of [4.5, 11.5]) { add(g, rbox(10, 5.4, 1, 0.4), mat('#A9764B'), 13, y, 6.2, { cast: false }); add(g, sphere(0.9, 6, 5), mat('#E8DAC4'), 13, y, 7, { cast: false }); }   // drawers
      add(g, rbox(11, 1, 8, 0.4), mat('#FFFDF6'), -6, 18.7, -1, { cast: false });                                          // paper
      for (let i = 0; i < 3; i++) add(g, rbox(8 - i, 1.4, 6, 0.3), mat(['#B5655A', '#7E9FB5', '#D6B56A'][i]), 8, 18.4 + i * 1.5, -6, { cast: false });         // books
      add(g, cyl(1.5, 1.4, 3.4, 8), mat('#FFFFFF'), 14, 20, -5, { cast: false });                                          // mug
      const lm = glowMat('#F4D9A0', '#FFC860');
      add(g, cyl(2.2, 2.6, 0.8, 10), mat('#4A5560'), -14, 18.7, -7, { cast: false }); add(g, cyl(0.35, 0.35, 12, 6), mat('#4A5560'), -14, 25, -7, { cast: false });
      const sh = add(g, cyl(1.4, 3.6, 3.4, 12), lm, -11.5, 31, -7, { cast: false, rz: 0.5 }); void sh; g.userData.glow = lm;   // desk lamp
      add(g, rbox(13, 3, 12, 1.4), w, -2, 9, 12); add(g, rbox(13, 12, 2.4, 1.2), w, -2, 15.5, 17.5);                    // chair seat + back
      for (const [x, z] of [[-7, 7], [3, 7], [-7, 16], [3, 16]]) add(g, rbox(1.6, 8, 1.6, 0.5), d, x, 4, z, { cast: false });
      return g;
    },
    plant() {
      const g = new THREE.Group();
      add(g, lathe('pot12', [[0, 0], [4.4, 0], [5.8, 9], [6.6, 9.4], [6.6, 10.8], [0, 10.8]], 16), mat('#D98A64')); add(g, cyl(5.6, 5.2, 1, 14), mat('#C0734F'), 0, 0.5, 0, { cast: false });
      add(g, cyl(5.8, 5.8, 0.6, 14), mat('#5B4638'), 0, 10.7, 0, { cast: false });                                          // soil
      const greens = ['#5C9E63', '#6FAF72', '#4C8F58'], R = rng(11);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + R() * 0.4; leaf(g, greens[i % 3], Math.cos(a) * 3.2, 15.5 + (i % 3) * 2.2, Math.sin(a) * 3.2, a, 0.55 + (i % 3) * 0.12, 1 + (i % 3) * 0.12); }
      return g;
    },
    bigpot() {
      const g = new THREE.Group();
      add(g, lathe('bigpot12', [[0, 0], [5, 0], [7, 11], [7.8, 11.6], [7.8, 13], [0, 13]], 16), mat('#C98C6B')); add(g, cyl(7.6, 7.6, 0.6, 16), mat('#5B4638'), 0, 12.8, 0, { cast: false });
      const greens = ['#5C9E63', '#6FAF72', '#4C8F58'], R = rng(5);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + R() * 0.3; leaf(g, greens[i % 3], Math.cos(a) * (2 + (i % 3)), 18 + (i % 4) * 2.4, Math.sin(a) * (2 + (i % 3)), a, 0.4 + (i % 4) * 0.12, 1.3 + (i % 3) * 0.15); }
      return g;
    },
  });
  Mo.furniture12 = true;
})();
