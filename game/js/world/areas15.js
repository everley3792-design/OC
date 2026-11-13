/* OC Shimeji — 15.2: two new outdoor places, 風車丘 (Windmill Hill) and 彩虹遊樂園 (Rainbow Fair).
 * Same rules as areas.js / areas2.js: design coordinates, analytic walk / level / ground, obstacles through ctx.block,
 * facilities through ctx.interact (each type has a describe() entry in app.js, a tap in worldui.js and an affordance in brain.js).
 * Static models are fused (Models.fuse); only the parts that move on their own (sails, carousel ring, wheel, cabins, balloons) stay apart.
 * All shapes, colours and names are original.
 */
(function () {
  'use strict';
  const { TAU, rng, mix } = OC;
  const Mo = OC.Models, H = OC.Areas._h, P = OC.Style.P;
  const { place, inBlob, blobPts, slab, stoneTiles, grassField } = H;
  const { mat, add, rbox, sphere, cyl, cone, fuse } = Mo;

  // ======================= models =======================
  /** a stone windmill; returns { group, sails } — the sails turn (ctx.tick) */
  function windmill() {
    const g = new THREE.Group();
    const stone = mat('#EFE3CC'), stoneLo = mat('#D8C8A8'), wood = mat('#B07E4B'), woodLo = mat('#8A5E36'), roof = mat('#D8684E'), cream = mat('#FFF8E8');
    add(g, Mo.lathe('mill', [[0, 0], [30, 0], [30, 4], [27, 6], [24, 40], [20, 72], [0, 72]], 20), stone, 0, 0, 0);
    add(g, cyl(31, 31, 4, 20), stoneLo, 0, 2, 0);
    for (const y of [24, 48]) add(g, cyl(26 - y * 0.08 + 0.6, 26 - y * 0.08 + 0.6, 2.4, 20), stoneLo, 0, y, 0);
    add(g, cone(25, 26, 16), roof, 0, 85, 0); add(g, sphere(3.2, 10, 8), mat('#F7C83F'), 0, 99, 0);
    add(g, cyl(24, 24, 3, 16), mat('#B8513C'), 0, 73.5, 0);
    // door, windows, a little porch with sacks
    add(g, rbox(14, 22, 3, 2), wood, 0, 11, 28.5); add(g, sphere(1.1, 8, 6), mat('#F7C83F'), 4, 11, 30.2);
    for (const [x, y] of [[-10, 46], [10, 30]]) { add(g, rbox(8, 10, 2, 1.5), mat('#7FC8E8'), x, y, 23 - y * 0.08); add(g, rbox(10, 1.6, 2.4, 0.6), cream, x, y - 6, 23.4 - y * 0.08); }
    add(g, rbox(30, 2.4, 12, 1), woodLo, 0, 1.2, 34);
    for (const [x, c] of [[-22, '#F2E6CF'], [-17, '#E8D3B0'], [20, '#F2E6CF']]) { add(g, Mo.lathe('sack', [[0, 0], [4.6, 0], [5.2, 4], [4.6, 8], [2.4, 10], [0, 10.4]], 10), mat(c), x, 0, 30); }
    fuse(g);
    // the sails: a hub, four arms, lattice cloth — one group, fused on its own, turning around the hub
    const s = new THREE.Group(); s.position.set(0, 66, 26);
    add(s, sphere(4, 12, 10), woodLo, 0, 0, 0); add(s, cyl(2, 2, 8, 8), woodLo, 0, 0, -3, { rx: Math.PI / 2 });
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2 + 0.3;
      add(arm, rbox(2.6, 54, 2, 0.8), wood, 0, 29, 1);
      add(arm, rbox(12, 40, 1, 0.4), cream, 6.6, 33, 1.6);
      for (let k = 0; k < 5; k++) add(arm, rbox(12.6, 1.2, 1.4, 0.4), woodLo, 6.6, 15 + k * 9, 2.2);
      s.add(arm);
    }
    fuse(s); g.add(s);
    return { group: g, sails: s };
  }
  /** a row of lavender (one InstancedMesh for all the tufts of a field) */
  function lavenderField(ctx, rows) {
    const list = []; const r = rng(42);
    for (const [x0, y0, x1, y1] of rows) { const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 7); for (let i = 0; i <= n; i++) list.push([x0 + (x1 - x0) * i / n + (r() - 0.5) * 2, y0 + (y1 - y0) * i / n + (r() - 0.5) * 2, 0.8 + r() * 0.4]); }
    const geoT = cone(3.4, 9, 6), m1 = mat('#A58BE0'), im = new THREE.InstancedMesh(geoT, m1, list.length); im.castShadow = true; im.receiveShadow = true;
    const geoS = cyl(2.6, 3.2, 3, 6), m2 = mat('#6FA65A'), im2 = new THREE.InstancedMesh(geoS, m2, list.length); im2.receiveShadow = true;
    const q = new THREE.Object3D();
    list.forEach(([x, y, s], i) => { q.position.copy(ctx.V3(x, y, 0, 1.5 + 4.5 * s + 2)); q.scale.set(s, s, s); q.rotation.set(0, r() * TAU, 0); q.updateMatrix(); im.setMatrixAt(i, q.matrix); q.position.copy(ctx.V3(x, y, 0, 3)); q.updateMatrix(); im2.setMatrixAt(i, q.matrix); });
    ctx.root.add(im, im2);
  }
  /** a picnic blanket with a basket */
  function picnic() {
    const g = new THREE.Group();
    const a = mat('#F26B5B'), b = mat('#FFF4DC');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) add(g, rbox(9, 0.8, 9, 0.3), (i + j) % 2 ? a : b, -13.5 + i * 9, 0.5, -9 + j * 9, { cast: false });
    add(g, rbox(12, 7, 8, 2), mat('#C88B55'), 14, 4, -12); add(g, Mo.lathe('handle', [[5.6, 0], [6.2, 0], [6.2, 0.6], [5.6, 0.6]], 12), mat('#8A5E36'), 14, 7.5, -12, { rz: Math.PI / 2 });
    return fuse(g);
  }
  /** a kite on a string that floats over the hilltop (pure decoration) */
  function kite(col) { const g = new THREE.Group(); const k = add(g, rbox(10, 14, 0.6, 0.3), mat(col), 0, 0, 0, { rz: Math.PI / 4 }); k.scale.set(1, 1, 1); add(g, rbox(0.4, 26, 0.4, 0.1), mat('#FFFFFF'), 0, -18, 0, { cast: false }); return g; }

  /** carousel: a still deck, a turning ring of horses under a scalloped canopy; returns { group, ring, horses } */
  function carousel() {
    const g = new THREE.Group();
    const deck = mat('#FFF4DC'), gold = mat('#F2C14E'), pink = mat('#F29AB4'), mint = mat('#7FD8C4'), white = mat('#FFFFFF');
    add(g, cyl(48, 50, 5, 28), mat('#E2CFA8'), 0, 2.5, 0); add(g, cyl(46, 46, 1.2, 28), deck, 0, 5.4, 0);
    add(g, cyl(5, 5, 50, 12), gold, 0, 30, 0);
    // two still carriage benches at the front (where riders sit)
    for (const x of [-16, 16]) { add(g, rbox(18, 8, 10, 3), x < 0 ? mint : pink, x, 9.5, 36); add(g, rbox(18, 12, 3, 1.5), x < 0 ? mint : pink, x, 14, 31); add(g, rbox(19, 1.4, 11, 0.5), gold, x, 13.6, 36); }
    fuse(g);
    const ring = new THREE.Group(); ring.position.y = 0; g.add(ring);
    const cano = new THREE.Group(); cano.position.y = 55;
    add(cano, cone(54, 18, 16), pink, 0, 9, 0); add(cano, cyl(54, 54, 5, 16), white, 0, -2, 0);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; add(cano, sphere(3.6, 8, 6), i % 2 ? pink : mint, Math.cos(a) * 54, -6, Math.sin(a) * 54); }
    add(cano, sphere(5, 12, 8), gold, 0, 20, 0);
    fuse(cano); ring.add(cano);
    const horses = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, hz = new THREE.Group(); hz.position.set(Math.cos(a) * 32, 0, Math.sin(a) * 32); hz.rotation.y = -a;
      const body = new THREE.Group();
      const c = mat(['#FFFFFF', '#FFE9B8', '#DDEBFF'][i % 3]);
      add(body, rbox(7, 7, 16, 3), c, 0, 0, 0); add(body, rbox(5, 9, 5, 2), c, 0, 5, 7.6, { rx: -0.35 }); add(body, rbox(4.6, 3.6, 7, 1.6), c, 0, 9.6, 10);
      add(body, rbox(1.6, 8, 2, 0.6), c, -2, -6, 5); add(body, rbox(1.6, 8, 2, 0.6), c, 2, -6, -5);
      add(body, rbox(7.6, 1.4, 6, 0.5), i % 2 ? pink : mint, 0, 3.8, -1);
      add(body, rbox(1.4, 6, 1.4, 0.5), mat(['#F29AB4', '#A58BE0', '#7FD8C4'][i % 3]), 0, 9, 4);
      add(body, cyl(0.9, 0.9, 52, 6), gold, 0, 14, 0);
      fuse(body); body.position.y = 22; hz.add(body); ring.add(hz); horses.push(body);
    }
    return { group: g, ring, horses };
  }
  /** Ferris wheel: two still legs and a turning wheel; cabins stay upright. returns { group, wheel, cabins } */
  function ferrisWheel() {
    const g = new THREE.Group(), R = 62, C = 80;
    const steel = mat('#FFFFFF'), steelLo = mat('#D6DCE6'), base = mat('#E2CFA8');
    add(g, rbox(70, 6, 30, 3), base, 0, 3, 0);
    for (const z of [-9, 9]) for (const s of [-1, 1]) { const leg = add(g, rbox(3, 86, 3, 1), steelLo, s * 18, C / 2 + 2, z); leg.rotation.z = s * 0.24; }
    add(g, cyl(2.4, 2.4, 24, 10), steelLo, 0, C, 0, { rx: Math.PI / 2 });
    // ticket booth
    add(g, rbox(14, 16, 10, 3), mat('#F7C83F'), 28, 8, 12); add(g, rbox(16, 3, 12, 1.4), mat('#F26B5B'), 28, 17.5, 12);
    fuse(g);
    const wheel = new THREE.Group(); wheel.position.set(0, C, 0); g.add(wheel);
    for (const z of [-7, 7]) { add(wheel, Mo.geo('fwrim' + R, () => new THREE.TorusGeometry(R, 1.6, 6, 48)), steel, 0, 0, z, { cast: true }); add(wheel, Mo.geo('fwrim2' + R, () => new THREE.TorusGeometry(R * 0.45, 1.1, 6, 32)), steel, 0, 0, z); }
    for (let i = 0; i < 12; i++) { const sp = add(wheel, rbox(1.4, R * 2, 1.4, 0.4), steelLo, 0, 0, i % 2 ? 7 : -7); sp.rotation.z = (i / 12) * Math.PI * 2; }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; add(wheel, sphere(1.8, 6, 5), mat(['#F26B5B', '#F7C83F', '#7FD8C4', '#A58BE0'][i % 4], { p: { emissive: '#000000' } }), Math.cos(a) * R, Math.sin(a) * R, 8.5, { cast: false }); }
    add(wheel, sphere(5, 12, 10), mat('#F7C83F'), 0, 0, 0);
    fuse(wheel);
    const cabins = [], cols = ['#F26B5B', '#F7C83F', '#7FD8C4', '#A58BE0', '#62B5E5', '#F29AB4', '#92D680', '#F5A84B'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, cb = new THREE.Group();
      add(cb, rbox(14, 10, 12, 3), mat(cols[i]), 0, -9, 0); add(cb, rbox(15, 3, 13, 1.4), mat('#FFFFFF'), 0, -3, 0); add(cb, rbox(10, 5, 12.6, 1), mat('#BFE6F5'), 0, -8, 0);
      add(cb, cyl(0.6, 0.6, 6, 6), steelLo, 0, -1, 0);
      fuse(cb); { const fl = add(cb, sphere(2.6, 10, 8), mat('#FFFFFF', { p: { emissive: '#F7C83F', emissiveIntensity: 0.9 } }), 0, 5, 0, { cast: false }); fl.userData.keep = true; fl.visible = false; cb.userData.flag = fl; }
      cb.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); cb.userData.a = a; wheel.add(cb); cabins.push(cb);
    }
    return { group: g, wheel, cabins };
  }
  /** the open-air stage (concert minigame) */
  function stage() {
    const g = new THREE.Group();
    const board = mat('#C88B55'), boardLo = mat('#A06C3C'), cur = mat('#D8505A'), curLo = mat('#B03C48'), gold = mat('#F2C14E'), cream = mat('#FFF4DC');
    add(g, rbox(120, 10, 52, 3), board, 0, 5, 0); add(g, rbox(122, 2, 54, 1), boardLo, 0, 10.5, 0);
    for (let i = 0; i < 3; i++) add(g, rbox(36, 3.4, 6, 1), boardLo, 0, 1.7 + i * 3.4, 30 - i * 5);
    add(g, rbox(120, 64, 4, 2), cream, 0, 42, -24);
    for (const s of [-1, 1]) { add(g, rbox(8, 70, 8, 3), gold, s * 58, 45, -18); for (let k = 0; k < 5; k++) add(g, rbox(6, 56, 3, 2.6), k % 2 ? cur : curLo, s * (48 - k * 4.4), 40, -20 + k * 0.6); }
    add(g, rbox(126, 12, 10, 4), cur, 0, 82, -18); add(g, rbox(128, 3, 11, 1), gold, 0, 76, -18);
    for (let i = 0; i < 9; i++) add(g, sphere(2, 8, 6), gold, -48 + i * 12, 88.5, -18);
    for (const x of [-40, 40]) { add(g, cyl(2, 3, 14, 8), mat('#5A5A6A'), x, 17, 18); add(g, sphere(4, 10, 8), mat('#FFF1B0'), x, 25, 18); }
    fuse(g);
    const sg = Mo.sign('星光舞台', '#D8505A', 48); sg.position.set(0, 82, -12.5); g.add(sg);
    return g;
  }
  /** a game booth: counter, striped awning, prizes on shelves (ring toss) */
  function booth(o) {
    const g = new THREE.Group(); const a = mat(o.a), b = mat('#FFFFFF'), wood = mat('#D9A26A');
    add(g, rbox(60, 18, 22, 3), mat('#FFF4DC'), 0, 9, 2); add(g, rbox(62, 3, 24, 1.4), wood, 0, 19, 2);
    for (const s of [-1, 1]) add(g, rbox(3.4, 44, 3.4, 1), wood, s * 28, 22, -8);
    for (let i = 0; i < 6; i++) add(g, rbox(10, 2.4, 26, 1), i % 2 ? b : a, -25 + i * 10, 46 + (i % 2) * 0.3, 0, { rx: 0.28 });
    if (o.bottles) for (let i = 0; i < 7; i++) add(g, Mo.lathe('bottle', [[0, 0], [2.4, 0], [2.4, 5], [1, 7.6], [1, 9.6], [0, 9.6]], 8), mat(['#7FD8C4', '#F29AB4', '#F7C83F', '#62B5E5'][i % 4]), -21 + i * 7, 20.5, -2);
    if (o.snacks) { for (let i = 0; i < 3; i++) add(g, sphere(5, 10, 8), mat(['#F9C4DA', '#FFFFFF', '#C9E6FF'][i]), -14 + i * 14, 27, -4); for (let i = 0; i < 3; i++) add(g, cyl(0.5, 0.5, 6, 5), mat('#FFFFFF'), -14 + i * 14, 21.5, -4); }
    fuse(g);
    const sg = Mo.sign(o.title, o.a, 44); sg.position.set(0, 54, 7); g.add(sg);
    return g;
  }
  /** the rainbow gate over the entrance */
  function rainbowGate() {
    const g = new THREE.Group();
    const cols = ['#F26B5B', '#F5A84B', '#F7C83F', '#92D680', '#62B5E5', '#A58BE0'];
    cols.forEach((c, i) => add(g, Mo.geo('rg' + i, () => new THREE.TorusGeometry(56 - i * 3.4, 1.9, 6, 40, Math.PI)), mat(c), 0, 4, 0));
    for (const s of [-1, 1]) { add(g, rbox(10, 34, 10, 3), mat('#FFF4DC'), s * 50, 17, 0); add(g, sphere(6, 12, 8), mat('#F7C83F'), s * 50, 38, 0); }
    fuse(g);
    const sg = Mo.sign('彩虹遊樂園', '#F26B5B', 64); sg.position.set(0, 58, 2); g.add(sg);
    return g;
  }
  /** a bunch of balloons (one group, bobs as a whole) */
  function balloons() {
    const g = new THREE.Group();
    [['#F26B5B', -5, 30], ['#F7C83F', 4, 34], ['#7FD8C4', 9, 27], ['#A58BE0', -1, 38]].forEach(([c, x, y]) => { const b = add(g, sphere(5, 12, 10), mat(c), x, y, 0); b.scale.set(1, 1.18, 1); add(g, cyl(0.25, 0.25, y - 4, 4), mat('#FFFFFF'), x * 0.5, (y - 4) / 2, 0, { cast: false }); });
    return fuse(g);
  }

  // ======================= 風車丘 Windmill Hill =======================
  const HILL = { cx: 300, cy: 600, rx: 262, ry: 330, seed: 2.3 };
  const MILL = { x: 300, y: 380 };
  const hill = {
    id: 'hill', zh: '風車丘', bounds: { x0: 0, y0: 200, x1: 600, y1: 1000 }, spawn: { x: 300, y: 880 }, bg: '#7FC4A8',
    spots: [{ id: 'top', zh: '山丘頂', x: 300, y: 500, verbs: ['view', 'play'], n: 4, r: 26 }, { id: 'field', zh: '薰衣草田邊', x: 140, y: 650, verbs: ['view'], n: 2, r: 14 }],
    exits: [{ to: 'map', x: 300, y: 920, label: '路牌' }],
    level: () => 0, ground: () => 1.5,
    walk(x, y) { if (!inBlob(HILL, x, y, -14)) return false; if (Math.hypot(x - MILL.x, (y - MILL.y) * 1.5) < 40) return false; return true; },
    noBuild: () => true,
    build(ctx) {
      const { root, Zof } = ctx; ctx.bounds = hill.bounds;
      const lawn = Mo.mat('#FFFFFF', { p: { map: H.lawnTex() } }); lawn.map.repeat.set(1 / 90, 1 / 90);
      const base = new THREE.Mesh(new THREE.PlaneGeometry(2200, 2600), Mo.mat('#86C77A')); base.rotation.x = -Math.PI / 2; base.position.set(300, -2, Zof(600)); base.receiveShadow = true; root.add(base);
      root.add(slab(blobPts(ctx, HILL), 1.5, 5, [lawn, Mo.mat('#5DA84E')], 2));
      // the windmill, turning with the wind (faster in rain / fog)
      const wm = windmill(); place(ctx, wm.group, MILL.x, MILL.y, 0, 1.5); ctx.block(MILL.x, MILL.y, 64, 40);
      ctx.tick((t, dt) => { const wx = OC.Clock.weather(); wm.sails.rotation.z -= dt * (wx === 'rain' ? 1.1 : wx === 'fog' ? 0.8 : 0.5); });
      ctx.interact({ type: 'shop', shop: 'mill', x: MILL.x, y: MILL.y + 22, hit: { w: 64, h: 110, d: 10 }, at: { x: MILL.x, y: MILL.y + 46 }, label: '風車磨坊' });
      // lavender field (pick a sprig: the same flower bed interaction as the isle)
      const rows = []; for (let i = 0; i < 5; i++) rows.push([70 + i * 4, 560 + i * 26, 200 + i * 4, 560 + i * 26]);
      lavenderField(ctx, rows); ctx.block(140, 612, 136, 60);
      for (const [i, y] of [[0, 600], [1, 650]]) ctx.interact({ type: 'bed', id: 'hill_lav' + i, item: 'lavender', x: 140, y, hit: { w: 120, h: 30, d: 10 }, at: { x: 140, y: y + (i ? 46 : -52) }, label: '薰衣草田' });
      // picnic blanket (lie down) and kites over the hilltop
      const pc = picnic(); place(ctx, pc, 440, 610, 0, 1.5);
      ctx.interact({ type: 'towel', x: 440, y: 612, hit: { w: 40, h: 26, d: 10 }, at: { x: 440, y: 630 }, label: '野餐墊' });
      const kites = [kite('#F26B5B'), kite('#7FD8C4')]; kites.forEach((k, i) => { place(ctx, k, 270 + i * 70, 470 - i * 30, 0, 70 + i * 12); });
      ctx.tick((t) => kites.forEach((k, i) => { k.rotation.z = Math.sin(t * 1.3 + i * 2) * 0.25; k.position.x = 270 + i * 70 + Math.sin(t * 0.7 + i) * 6; }));
      // benches facing the view, fences, trees, rocks, the path
      for (const [x, y] of [[200, 790], [400, 790]]) { const b = Mo.bench(); place(ctx, b, x, y, 0, 1.5); ctx.block(x, y, 38, 8); ctx.interact({ type: 'bench', x, y: y + 3, hit: { w: 40, h: 26, d: 6 }, at: { x, y: y + 12 }, seat: { x, y: y + 1, up: 7 }, label: '長椅' }); }
      for (const [x, y, len] of [[110, 520, 60], [180, 520, 60], [450, 470, 70]]) { const f = Mo.fence(len); place(ctx, f, x, y, 0, 1.5); ctx.block(x, y, len / 2 + 2, 4); }
      for (const [x, y, s] of [[90, 380, 1.1], [520, 420, 1.2], [80, 820, 1], [530, 760, 1.15], [470, 330, 1]]) { const c = Mo.cedar(x + y); c.group.scale.setScalar(s); place(ctx, c.group, x, y, 0, 1.5); ctx.block(x, y, 13, 8); }
      for (const [x, y, i] of [[180, 430, 2], [430, 720, 3]]) { const tr = Mo.fruitTree('#F2C14E', i); place(ctx, tr.group, x, y, 0, 1.5); ctx.block(x, y, 12, 8); ctx.sway(tr.crown, i * 1.3, 0.035); }
      [[540, 600, 0.9], [60, 640, 0.7], [380, 860, 0.6]].forEach(([x, y, s], i) => { const rk = Mo.rock(s, i + 2); place(ctx, rk, x, y, 0, 0.5); ctx.block(x, y, 13 * s, 8 * s); });
      [[250, 870], [350, 870], [510, 520]].forEach(([x, y], i) => { const b = Mo.bush(i + 9, '#5DB64C'); place(ctx, b.group, x, y, 0, 1.5); ctx.block(x, y, 16, 9); ctx.sway(b.group, i * 2.1, 0.04); });
      stoneTiles(ctx, [[300, 900], [300, 760], [306, 620], [300, 470]], 12, '#E8D7A8');
      const sg = Mo.signpost(); place(ctx, sg, 330, 905, 0, 1.5); ctx.block(330, 905, 6, 4);
      ctx.interact({ type: 'exit', to: 'map', x: 330, y: 905, hit: { w: 40, h: 36, d: 6 }, at: { x: 316, y: 900 }, label: '路牌：前往其他地方' });
      grassField(ctx, (x, y) => (hill.walk(x, y) && !(x > 60 && x < 220 && y > 540 && y < 690) && Math.abs(x - 303) > 12 ? 0 : null), 1700, 15, ['#6FC24F', '#7ACB58', '#8AD765', '#66BA4C']);
      hill.forageSpots = [[90, 720, 'herb'], [520, 520, 'berry'], [470, 880, 'herb']];
      hill.critterSpots = [[150, 600, 'b_butterfly'], [420, 680, 'b_hopper'], [250, 760, 'b_ladybug'], [480, 380, 'b_hopper']];
    },
  };

  // ======================= 彩虹遊樂園 Rainbow Fair =======================
  const PLAZA = { cx: 300, cy: 600, rx: 270, ry: 340, seed: 4.4 };
  const FW = { x: 150, y: 330 }, CAR = { x: 430, y: 470 }, STG = { x: 300, y: 300 };
  const fair = {
    id: 'fair', zh: '彩虹遊樂園', bounds: { x0: 0, y0: 200, x1: 600, y1: 1000 }, spawn: { x: 300, y: 880 }, bg: '#9FD3E8',
    spots: [{ id: 'plaza', zh: '中央廣場', x: 300, y: 600, verbs: ['view', 'play'], n: 4, r: 30 }, { id: 'front', zh: '舞台前', x: 300, y: 400, verbs: ['view'], n: 3, r: 26 }],
    exits: [{ to: 'map', x: 300, y: 920, label: '路牌' }],
    level: () => 0, ground: () => 1.2,
    walk(x, y) {
      if (!inBlob(PLAZA, x, y, -12)) return false;
      if (Math.abs(x - FW.x) < 40 && Math.abs(y - FW.y) < 20) return false;
      if (Math.hypot(x - CAR.x, (y - CAR.y) / 0.766) < 52) return false;
      if (Math.abs(x - STG.x) < 64 && y < STG.y + 22 && y > STG.y - 30) return false;
      return true;
    },
    noBuild: () => true,
    build(ctx) {
      const { root, Zof } = ctx; ctx.bounds = fair.bounds;
      const base = new THREE.Mesh(new THREE.PlaneGeometry(2200, 2600), Mo.mat('#8BCB76')); base.rotation.x = -Math.PI / 2; base.position.set(300, -1, Zof(600)); base.receiveShadow = true; root.add(base);
      root.add(slab(blobPts(ctx, PLAZA), 1.2, 3, [Mo.tmat('pave2', Mo.paveTex2()), Mo.mat('#CDBB98')], 1));
      // Ferris wheel (turns slowly; cabins stay level)
      const fw = ferrisWheel(); place(ctx, fw.group, FW.x, FW.y, 0, 1.2); ctx.block(FW.x, FW.y, 76, 16);
      ctx.tick((t, dt) => { fw.wheel.rotation.z += dt * 0.12; for (const c of fw.cabins) c.rotation.z = -fw.wheel.rotation.z; });
      ctx.interact({ type: 'wheel', x: FW.x + 28, y: FW.y + 12, hit: { w: 60, h: 140, d: 10 }, at: { x: FW.x + 28, y: FW.y + 34 }, label: '摩天輪' });
      fair.wheel = fw;
      // carousel (the ring turns, the horses rise and fall; riders sit in the two front carriages)
      const cr = carousel(); place(ctx, cr.group, CAR.x, CAR.y, 0, 1.2);
      ctx.tick((t, dt) => { cr.ring.rotation.y += dt * 0.5; cr.horses.forEach((hz, i) => (hz.position.y = 22 + Math.sin(t * 2.2 + i * 1.7) * 3)); });
      ctx.interact({ type: 'ride', ride: 'carousel', x: CAR.x, y: CAR.y + 44, hit: { w: 90, h: 80, d: 12 }, at: { x: CAR.x, y: CAR.y + 62 }, label: '旋轉木馬', seats: [[CAR.x - 16, CAR.y + 28], [CAR.x + 16, CAR.y + 28]] });
      // the stage (concert minigame)
      const st = stage(); place(ctx, st, STG.x, STG.y, 0, 1.2); ctx.block(STG.x, STG.y - 4, 62, 24);
      ctx.interact({ type: 'stage', x: STG.x, y: STG.y + 18, hit: { w: 120, h: 90, d: 12 }, at: { x: STG.x, y: STG.y + 40 }, label: '星光舞台' });
      // booths: ring toss + snacks
      const rt = booth({ title: '套圈圈', a: '#62B5E5', bottles: true }); place(ctx, rt, 130, 640, 0, 1.2); ctx.block(130, 640, 32, 12);
      ctx.interact({ type: 'toss', x: 130, y: 648, hit: { w: 60, h: 60, d: 10 }, at: { x: 130, y: 668 }, label: '套圈圈' });
      const sn = booth({ title: '點心攤', a: '#F29AB4', snacks: true }); place(ctx, sn, 480, 680, 0, 1.2); ctx.block(480, 680, 32, 12);
      ctx.interact({ type: 'shop', shop: 'fair', x: 480, y: 688, hit: { w: 60, h: 60, d: 10 }, at: { x: 480, y: 708 }, label: '點心攤' });
      // gate, balloons, benches, flower beds, lamps
      const gt = rainbowGate(); place(ctx, gt, 300, 860, 0, 1.2); for (const s of [-1, 1]) ctx.block(300 + s * 50, 860, 7, 6);
      const bl = balloons(); place(ctx, bl, 236, 840, 0, 1.2); ctx.block(236, 840, 4, 4);
      ctx.tick((t) => { bl.rotation.z = Math.sin(t * 0.9) * 0.05; bl.position.y = ctx.V3(236, 840, 0, 1.2).y + Math.sin(t * 1.3) * 1.2; });
      for (const [x, y] of [[230, 760], [370, 760], [210, 520]]) { const b = Mo.bench(); place(ctx, b, x, y, 0, 1.2); ctx.block(x, y, 38, 8); ctx.interact({ type: 'bench', x, y: y + 3, hit: { w: 40, h: 26, d: 6 }, at: { x, y: y + 12 }, seat: { x, y: y + 1, up: 7 }, label: '長椅' }); }
      for (const [x, y, i] of [[90, 800, 5], [510, 800, 6], [540, 560, 7]]) { const fb = Mo.flowerBed(30, 12, i); place(ctx, fb, x, y, 0, 1.2); ctx.block(x, y, 30, 12 * ctx.SIN); }
      for (const [x, y] of [[200, 640], [400, 640], [300, 470]]) { const lp = Mo.lampPost(ctx.quality.lights !== false && x === 300); place(ctx, lp, x, y, 0, 1.2); ctx.block(x, y, 6, 4); }
      [[60, 420], [560, 380], [70, 960], [540, 950]].forEach(([x, y], i) => { const t = Mo.bush(i + 3, '#5DB64C'); place(ctx, t.group, x, y, 0, 1.2); ctx.sway(t.group, i * 1.9, 0.04); });
      const sg = Mo.signpost(); place(ctx, sg, 340, 920, 0, 1.2); ctx.block(340, 920, 6, 4);
      ctx.interact({ type: 'exit', to: 'map', x: 340, y: 920, hit: { w: 40, h: 36, d: 6 }, at: { x: 324, y: 912 }, label: '路牌：前往其他地方' });
    },
  };

  Object.assign(OC.Areas, { hill, fair });
  OC.Models15 = { windmill, carousel, ferrisWheel, stage, booth, rainbowGate, balloons, picnic };
  void mix; void P;
})();
