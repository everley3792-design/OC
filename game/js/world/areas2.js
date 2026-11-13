/* OC Shimeji — Phase 5 places: interiors (my home, café, library), the shop street, Starsand
 * Beach, plus gameplay additions to Sunny Isle & Mosslight Woods (garden plots, fishing spots,
 * forage bushes, critter spots, doors). Same rules as areas.js: analytic walk / level / ground,
 * obstacles through ctx.block, interactables through ctx.interact (types handled in app.js and
 * turned into AI affordances by brain.js).
 */
(function () {
  'use strict';
  const { TAU, rng, mix, clamp } = OC;
  const Mo = OC.Models, H = OC.Areas._h, P = OC.Style.P;
  const { place, inBlob, blobPts, slab, stoneTiles, grassField, inRect } = H;

  // ======================= interior template =======================
  /** a room place: floor rect (x0..x1, y0..y1), back wall at y0, door at the bottom centre */
  function interior(o) {
    const R = o.room, D = { x: (R.x0 + R.x1) / 2, y: R.y1 - 6 };
    const area = {
      id: o.id, zh: o.zh, interior: true, bounds: { x0: R.x0 - 70, y0: R.y0 - 90, x1: R.x1 + 70, y1: R.y1 + 80 }, spawn: { x: D.x, y: D.y - 14 }, bg: o.bg || '#3A2E2A',
      room: R, wallY: R.y0 + 4, door: D, decor: o.decor ? { x0: R.x0 + 6, y0: R.y0 + 6, x1: R.x1 - 6, y1: R.y1 - 16 } : null,
      level: () => 0, ground: () => 0.2,
      walk: (x, y) => x > R.x0 + 6 && x < R.x1 - 6 && y > R.y0 + 8 && y < R.y1 - 2,
      noBuild: (x, y) => Math.abs(x - D.x) < 18 && y > R.y1 - 30,
      spots: o.spots || [], exits: [{ to: o.parent, x: D.x, y: R.y1 - 2, label: o.exitZh || '出去' }],
      build(ctx) {
        ctx.bounds = area.bounds;
        /* 15.1: a place you can decorate can also have its walls and floor painted (S().surfaces[id] = { wall, stripe, floor, tile }) */
        const sf = (o.decor && OC.Store.s && OC.Store.s.surfaces && OC.Store.s.surfaces[o.id]) || {};
        const sh = Mo.room({ w: R.x1 - R.x0, d: R.y1 - R.y0, h: o.wallH || 48, floor: sf.tile ? null : (sf.floor || o.floor), tile: sf.tile || (sf.floor ? null : o.tile), wall: sf.wall || o.wall, stripe: sf.stripe || o.stripe, trim: o.trim, curtain: o.curtain, windows: o.windows || [], door: 0, mat: o.mat });
        sh.userData.noContact = true;   // the room shell is not an object standing on the ground
        place(ctx, sh, D.x, (R.y0 + R.y1) / 2, 0, 0);
        // dark surroundings so the cut-away room reads as an interior
        const out = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), Mo.mat(o.bg || '#3A2E2A')); out.rotation.x = -Math.PI / 2; out.position.set(D.x, -4, ctx.Zof(D.y)); ctx.root.add(out);
        ctx.interact({ type: 'exit', to: o.parent, x: D.x, y: R.y1 - 2, hit: { w: 34, h: 26, d: 10 }, at: { x: D.x, y: R.y1 - 10 }, label: o.exitZh || '出去' });
        // warm interior lights (only in quality modes with point lights)
        if (ctx.quality.lights !== false) for (const [lx, ly] of o.lights || [[D.x, (R.y0 + R.y1) / 2]]) { const L = new THREE.PointLight('#FFD7A0', 0, 260, 1.6); L.position.copy(ctx.V3(lx, ly, 0, 60)); ctx.root.add(L); ctx.tick((t, dt, env) => { if (env) L.intensity = 2200 * (0.35 + env.night * 0.9); }); }
        o.build && o.build(ctx, area);
        OC.Dress && OC.Dress.room(ctx, area);   // 12.0: prints, rugs, window light, fairy lights
      },
    };
    return area;
  }

  const home = interior({
    id: 'home', zh: '我的家', parent: 'isle', exitZh: '回到島上', decor: true, room: { x0: 70, y0: 260, x1: 330, y1: 470 }, floor: '#E2B27A', wall: '#FFF1DE', stripe: '#FBE3C7', curtain: '#F48FB1', windows: [-70, 70],
    lights: [[200, 330], [200, 430]],
    build(ctx) { const rug = new THREE.Mesh(new THREE.CircleGeometry(30, 32), Mo.mat('#FFE0B8')); rug.rotation.x = -Math.PI / 2; rug.scale.set(1.4, 1, 1); rug.position.copy(ctx.V3(200, 452, 0, 0.3)); ctx.root.add(rug); },
  });
  const cafe = interior({
    id: 'cafe', zh: '雲朵咖啡館', parent: 'street', exitZh: '回商店街', room: { x0: 50, y0: 250, x1: 390, y1: 520 }, tile: ['#F5E6D3', '#E8D3BA'], wall: '#E9F5EF', stripe: '#D4EEE3', trim: '#9A6A3E', curtain: '#3FC1B0', windows: [-120, 120], mat: '#3FC1B0',
    lights: [[220, 340], [140, 440], [300, 440]],
    build(ctx) {
      const c = Mo.counter(130); place(ctx, c, 230, 292, 0, 0); ctx.block(230, 292, 132, 16);
      ctx.interact({ type: 'counter', shop: 'cafe', x: 230, y: 300, hit: { w: 130, h: 44, d: 8 }, at: { x: 230, y: 316 }, label: '點餐櫃台' });
      const mb = Mo.menuBoard('今日菜單'); place(ctx, mb, 330, 262, 0, 22);
      const st = Mo.FURN.stove(); place(ctx, st, 90, 278, 0, 0); ctx.block(90, 278, 40, 12);
      ctx.interact({ type: 'stove', place: 'cafe', x: 90, y: 284, hit: { w: 44, h: 40, d: 8 }, at: { x: 92, y: 300 }, label: '咖啡館廚房（料理）' });
      for (const [x, y] of [[150, 300], [300, 300], [220, 300]]) { const pd = Mo.pendant(['#FFC93C', '#F48FB1', '#3FC1B0'][Math.round(x) % 3]); place(ctx, pd, x, y + 60, 0, 52); }
      for (const [x, y] of [[66, 500], [374, 500]]) { const pl = Mo.FURN.bigpot(); place(ctx, pl, x, y, 0, 0); ctx.block(x, y, 12, 8); }
    },
  });
  const library = interior({
    id: 'library', zh: '葉影圖書館', parent: 'street', exitZh: '回商店街', room: { x0: 50, y0: 250, x1: 390, y1: 520 }, floor: '#C99A6B', wall: '#F3EEE4', stripe: '#E8E0D0', trim: '#7A5230', curtain: '#556080', windows: [0], mat: '#556080',
    lights: [[150, 400], [290, 400]],
    build(ctx) {
      // bookshelves along the back wall: read here
      for (const x of [95, 155, 285, 345]) { const b = Mo.FURN.bookshelf(); b.scale.set(1.3, 1.3, 1); place(ctx, b, x, 268, 0, 0); ctx.block(x, 268, 52, 10); ctx.interact({ type: 'bookshelf', x, y: 272, hit: { w: 52, h: 60, d: 6 }, at: { x, y: 290 }, label: '書櫃（閱讀）' }); }
      const globe = new THREE.Group(); Mo.add(globe, Mo.cyl(1, 1.4, 14, 8), Mo.mat('#7A5230'), 0, 7, 0); Mo.add(globe, Mo.sphere(7, 16, 12), Mo.mat('#5BC0EB'), 0, 20, 0); place(ctx, globe, 220, 280, 0, 0); ctx.block(220, 280, 14, 8);
      for (const [x, y] of [[66, 500], [374, 500]]) { const pl = Mo.FURN.bigpot(); place(ctx, pl, x, y, 0, 0); ctx.block(x, y, 12, 8); }
    },
  });

  // ======================= 晴日商店街 Sunny Street =======================
  const ST = { x0: 60, y0: 270, x1: 540, y1: 960 };
  const SHOPS = [
    { id: 'food', title: '晴日食品店', x: 140, y: 350, roof: '#F26B5B', accent: '#F26B5B', goods: ['#EE4B4B', '#FF9A3C', '#FFD45C', '#6CCB5F', '#F2C36B', '#FFFFFF'] },
    { id: 'clothes', title: '小針線服裝店', x: 140, y: 560, roof: '#9B7BE0', accent: '#9B7BE0', goods: ['#F48FB1', '#5BC0EB', '#FFC93C', '#3FC1B0', '#F26B5B', '#FFFFFF'] },
    { id: 'furniture', title: '木木家具行', x: 460, y: 350, roof: '#3FC1B0', accent: '#3FC1B0', goods: ['#D9A26A', '#9FD3FF', '#FFC93C', '#B07E4B', '#F26B5B', '#FFFFFF'] },
    { id: 'gift', title: '星星禮品屋', x: 460, y: 560, roof: '#FFC93C', accent: '#F48FB1', goods: ['#F48FB1', '#FFD23F', '#5BC0EB', '#9B7BE0', '#F26B5B', '#FFFFFF'] },
  ];
  const street = {
    id: 'street', zh: '晴日商店街', bounds: { x0: 0, y0: 200, x1: 600, y1: 1000 }, spawn: { x: 300, y: 900 }, bg: '#7CC4A0',
    exits: [{ to: 'map', x: 300, y: 940, label: '路牌' }, { to: 'cafe', x: 140, y: 790, label: '雲朵咖啡館' }, { to: 'library', x: 460, y: 790, label: '葉影圖書館' }],
    doors: { cafe: { x: 140, y: 800 }, library: { x: 460, y: 800 } },
    spots: [{ id: 'square', zh: '市集廣場', x: 300, y: 650, verbs: ['view', 'play'], n: 4, r: 30 }],
    level: () => 0, ground: () => 1.2,
    walk: (x, y) => x > ST.x0 && x < ST.x1 && y > ST.y0 && y < ST.y1,
    noBuild: () => true,
    build(ctx) {
      const { root, Zof } = ctx; ctx.bounds = street.bounds;
      const lawn = Mo.mat('#FFFFFF', { p: { map: H.lawnTex() } });
      const base = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2400), Mo.mat('#8BCB76')); base.rotation.x = -Math.PI / 2; base.position.set(300, -1, Zof(600)); base.receiveShadow = true; root.add(base);
      const pave = new THREE.Mesh(new THREE.BoxGeometry(ST.x1 - ST.x0 + 20, 2.4, (ST.y1 - ST.y0 + 30) / ctx.SIN), Mo.tmat('pave2', Mo.paveTex2())); pave.position.set(300, 0, Zof((ST.y0 + ST.y1) / 2)); pave.receiveShadow = true; root.add(pave);
      void lawn;
      for (const s of SHOPS) { const b = Mo.shopFront(s); place(ctx, b, s.x, s.y, 0, 1.2); ctx.block(s.x, s.y, 84, 44); ctx.interact({ type: 'shop', shop: s.id, x: s.x, y: s.y + 26, hit: { w: 80, h: 100, d: 8 }, at: { x: s.x, y: s.y + 42 }, label: s.title }); }
      const cafeB = Mo.shopFront({ title: '雲朵咖啡館', roof: '#8A5A3C', accent: '#3FC1B0', wall: '#E9F5EF', goods: ['#8A5A3C', '#F2C36B', '#FFFFFF'] }); place(ctx, cafeB, 140, 770, 0, 1.2); ctx.block(140, 770, 84, 44);
      ctx.interact({ type: 'exit', to: 'cafe', x: 140, y: 794, hit: { w: 80, h: 100, d: 8 }, at: { x: 140, y: 810 }, label: '雲朵咖啡館' });
      const libB = Mo.shopFront({ title: '葉影圖書館', roof: '#556080', accent: '#556080', wall: '#F3EEE4', goods: ['#F26B5B', '#5BC0EB', '#FFC93C'] }); place(ctx, libB, 460, 770, 0, 1.2); ctx.block(460, 770, 84, 44);
      ctx.interact({ type: 'exit', to: 'library', x: 460, y: 794, hit: { w: 80, h: 100, d: 8 }, at: { x: 460, y: 810 }, label: '葉影圖書館' });
      OC.Dress && OC.Dress.street(ctx, SHOPS);   // 12.0: planters and crates in front of the shops
      // market square with two stalls (daily market)
      for (const [x, y, flip] of [[245, 640, 0], [355, 640, 1]]) { const m = Mo.stall(); m.scale.set(0.75, 0.75, 0.75); place(ctx, m, x, y, 0, 1.2); ctx.block(x, y, 50, 16); ctx.interact({ type: 'shop', shop: 'market', x, y: y + 6, hit: { w: 52, h: 50, d: 8 }, at: { x, y: y + 22 }, label: '每日市場' }); void flip; }
      // trees, lamps, benches, planters along the avenue
      for (const [x, y] of [[240, 300], [360, 300], [240, 480], [360, 480], [240, 860], [360, 860]]) { const t = Mo.bush((x + y) % 7, '#5DB64C'); place(ctx, t.group, x, y, 0, 1.2); ctx.block(x, y, 16, 9); }
      for (const [x, y] of [[300, 330], [300, 470], [300, 760], [300, 880]]) { const lp = Mo.lampPost(ctx.quality.lights !== false && y === 760); place(ctx, lp, x, y, 0, 1.2); ctx.block(x, y, 6, 4); }
      for (const [x, y] of [[230, 720], [370, 720]]) { const b = Mo.bench(); place(ctx, b, x, y, 0, 1.2); ctx.block(x, y, 38, 8); ctx.interact({ type: 'bench', x, y: y + 3, hit: { w: 40, h: 26, d: 6 }, at: { x, y: y + 12 }, seat: { x, y: y + 1, up: 7 }, label: '長椅' }); }
      for (const [x, y, i] of [[100, 920, 1], [500, 920, 2], [100, 640, 3], [500, 640, 4]]) { const fb = Mo.flowerBed(30, 12, i); place(ctx, fb, x, y, 0, 1.2); ctx.block(x, y, 30, 12 * ctx.SIN); }
      const sg = Mo.signpost(); place(ctx, sg, 300, 940, 0, 1.2); ctx.block(300, 940, 6, 4);
      ctx.interact({ type: 'exit', to: 'map', x: 300, y: 940, hit: { w: 40, h: 36, d: 6 }, at: { x: 286, y: 924 }, label: '路牌：前往其他地方' });
    },
  };

  // ======================= 星砂海灘 Starsand Beach =======================
  const SAND = { cx: 300, cy: 560, rx: 270, ry: 250, seed: 5.1 };
  const PIER2 = { x: 430, y: 860, w: 28, h: 150 };
  const beach = {
    id: 'beach', zh: '星砂海灘', bounds: { x0: 0, y0: 240, x1: 600, y1: 1000 }, spawn: { x: 300, y: 380 }, seaY: -6,
    spots: [{ id: 'shore', zh: '海浪邊', x: 250, y: 770, verbs: ['view', 'play'], n: 3, r: 20 }, { id: 'pierEnd', zh: '碼頭盡頭', x: 430, y: 920, verbs: ['view'], n: 2, r: 9 }],
    level: () => 0, ground: (x, y) => (inRect(PIER2, x, y) && !inBlob(SAND, x, y, -6) ? 0.5 : 0.4),
    walk(x, y) { if (inRect(PIER2, x, y)) return true; return inBlob(SAND, x, y, -10); },
    noBuild: () => true,
    build(ctx) {
      const { root, Zof } = ctx; ctx.bounds = beach.bounds;
      const seaT = H.waterTex('#4FC3E8', 'rgba(255,255,255,0.55)'); seaT.repeat.set(1 / 90, 1 / 90);
      const seaM = new THREE.MeshBasicMaterial({ color: '#FFFFFF', map: seaT });
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), seaM); sea.rotation.x = -Math.PI / 2; sea.position.set(300, -6, Zof(600)); root.add(sea);
      const shallow = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(blobPts(ctx, SAND, 0, 28)), 6), new THREE.MeshBasicMaterial({ color: '#8FE3F2' })); shallow.rotation.x = -Math.PI / 2; shallow.position.y = -5.6; root.add(shallow);
      const sand = Mo.mat('#FFFFFF', { p: { map: H.sandTex() } });
      root.add(slab(blobPts(ctx, SAND), 0.4, 24, [sand, Mo.mat(P.sandLo)], 3));
      ctx.tick((t, dt, env) => { seaT.offset.set((t * 0.008) % 1, (t * 0.005) % 1); if (env) { seaM.color.set(OC.mix('#FFFFFF', '#5A6AB0', env.night * 0.7)); shallow.material.color.set(OC.mix('#8FE3F2', '#3A5A90', env.night * 0.6)); } });
      const pr = Mo.pier(PIER2.h, PIER2.w); place(ctx, pr, PIER2.x, PIER2.y, 0, -0.6);
      for (const [x, y, s] of [[90, 380, 1], [520, 400, 2], [70, 600, 3], [540, 640, 4]]) { if (!inBlob(SAND, x, y, -10)) continue; const pm = Mo.palm(s); place(ctx, pm.group, x, y, 0, 0.4); ctx.block(x, y, 8, 6); ctx.sway(pm.crown, s * 2.3, 0.07); }
      const um = Mo.umbrella('#F26B5B'); place(ctx, um, 230, 520, 0, 0.4); ctx.block(230, 520, 4, 4);
      for (const [x, c] of [[205, '#5BC0EB'], [255, '#FFC93C']]) { const tw = Mo.towel(c); place(ctx, tw, x, 545, 0, 0.4); ctx.interact({ type: 'towel', x, y: 548, hit: { w: 22, h: 14, d: 8 }, at: { x, y: 560 }, label: '沙灘毛巾' }); }
      const sc = Mo.sandcastle(); place(ctx, sc, 380, 600, 0, 0.4); ctx.block(380, 600, 26, 16);
      const tp = Mo.tidePool(); place(ctx, tp, 130, 730, 0, 0.4); ctx.block(130, 730, 40, 20);
      for (const [x, y, s] of [[480, 470, 0.9], [160, 420, 0.7]]) { const r = Mo.rock(s, x); place(ctx, r, x, y, 0, 0); ctx.block(x, y, 13 * s, 8 * s); }
      const sg = Mo.signpost(); place(ctx, sg, 300, 340, 0, 0.4); ctx.block(300, 340, 6, 4);
      ctx.interact({ type: 'exit', to: 'map', x: 300, y: 340, hit: { w: 40, h: 36, d: 6 }, at: { x: 300, y: 358 }, label: '路牌：前往其他地方' });
      // Phase 6: a welcoming entrance — boardwalk from the signpost, warm lamps for the evening, dune grass, driftwood, shells
      const wA = Mo.mat('#D9A26A'), wB = Mo.mat('#C88B55');
      for (let i = 0; i < 6; i++) { const pl = new THREE.Mesh(Mo.rbox(46, 1.4, 9, 0.6), i % 2 ? wA : wB); pl.receiveShadow = true; place(ctx, pl, 300, 374 + i * 13, 0, 0.5); }
      for (const [x, y] of [[262, 396], [338, 396]]) { const lp = Mo.lampPost(ctx.quality.lights !== false); place(ctx, lp, x, y, 0, 0.4); ctx.block(x, y, 6, 5); }
      for (const [x, y, sd] of [[232, 364, 1], [372, 370, 2], [205, 470, 3], [425, 455, 4], [150, 520, 5], [470, 565, 6], [560, 470, 7]]) { if (!inBlob(SAND, x, y, -10)) continue; const g = Mo.bush(sd, '#9BCB6A').group; g.scale.set(0.5, 0.75, 0.5); place(ctx, g, x, y, 0, 0.4); ctx.sway(g, sd * 1.7, 0.05); }
      { const lg = new THREE.Mesh(Mo.cyl(2.6, 3.2, 42, 10), Mo.mat('#A98A6A')); lg.rotation.z = Math.PI / 2; lg.rotation.y = 0.45; lg.castShadow = true; place(ctx, lg, 405, 505, 0, 3); ctx.block(405, 505, 22, 7); }
      for (const [x, y, c] of [[250, 452, '#F7B8C8'], [352, 440, '#FFE3A8'], [178, 600, '#FFFFFF'], [500, 640, '#F7B8C8']]) { const sh = new THREE.Mesh(Mo.sphere(2.2, 8, 6), Mo.mat(c)); sh.scale.set(1, 0.45, 0.8); place(ctx, sh, x, y, 0, 1); }
      // fishing: pier end + shoreline
      for (const [x, y, lab] of [[430, 928, '碼頭釣魚點'], [200, 800, '海邊釣魚點']]) { const rp = Mo.ripple(); place(ctx, rp, x, y + 22, 0, -5); ctx.tick((t) => { const q = (t * 0.6 + x) % 1; rp.scale.setScalar(0.6 + q * 0.8); rp.material.opacity = 0.7 * (1 - q); }); ctx.interact({ type: 'fishing', water: 'sea', x, y: y + 10, hit: { w: 36, h: 24, d: 12 }, at: { x, y }, label: lab }); }
      beach.shellSpots = [[120, 790], [260, 800], [340, 790], [480, 760], [560, 600], [40, 560], [180, 330], [420, 330], [300, 810], [520, 520]];
      beach.critterSpots = [[150, 700, 'b_crab'], [110, 760, 'b_crab'], [470, 720, 'b_crab']];
    },
  };

  // ======================= additions to existing areas =======================
  /** Sunny Isle: vegetable garden (4 plots), pier fishing spot, butterflies near flowers */
  OC.Areas.isle.plots = [[462, 704], [504, 704], [462, 736], [504, 736]].map(([x, y], i) => ({ id: 'isle' + i, x, y }));
  OC.Areas.isle.critterSpots = [[245, 530, 'b_butterfly'], [380, 718, 'b_ladybug'], [395, 430, 'b_butterfly', 1]];
  OC.Areas.forest.critterSpots = [[150, 520, 'b_ladybug'], [260, 470, 'b_beetle'], [120, 300, 'b_butterfly'], [300, 420, 'b_firefly'], [180, 610, 'b_snail']];
  OC.Areas.forest.forageSpots = [[80, 330, 'berry'], [320, 360, 'berry'], [140, 600, 'herb'], [290, 600, 'herb'], [100, 470, 'acorn'], [310, 250, 'berry']];
  OC.Areas.isle.doors = { home: { x: 300, y: 398 } };
  OC.Areas.isle.exits = [{ to: 'home', x: 300, y: 392, label: '我的家' }, { to: 'map', x: 318, y: 880, label: '告示牌' }];
  OC.Areas.forest.exits = [{ to: 'map', x: 220, y: 672, label: '告示牌' }];
  function isleExtra(ctx) {
    const area = OC.Areas.isle;
    for (const p of area.plots) { const g = Mo.gardenPlot(); place(ctx, g, p.x, p.y, 0, 1.5); ctx.block(p.x, p.y, 30, 12); ctx.interact({ type: 'plot', id: p.id, x: p.x, y: p.y + 4, hit: { w: 32, h: 22, d: 8 }, at: { x: p.x, y: p.y + 16 }, label: '菜園', mesh: g }); }
    ctx.interact({ type: 'fishing', water: 'sea', x: 300, y: 958, hit: { w: 36, h: 24, d: 10 }, at: { x: 300, y: 950 }, label: '碼頭釣魚點' });
  }
  function forestExtra(ctx) {
    ctx.interact({ type: 'fishing', water: 'pond', x: 214, y: 368, hit: { w: 40, h: 22, d: 8 }, at: { x: 214, y: 372 }, label: '池塘釣魚點' });
  }

  Object.assign(OC.Areas, { home, cafe, library, street, beach, isleExtra, forestExtra, SHOP_BUILDINGS: SHOPS });
})();
