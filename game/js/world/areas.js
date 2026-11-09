/* OC Shimeji — explorable areas. Layout is authored in design coords (x, y, level) and
 * built through the alignment formula; walkability / level / ground height are analytic
 * so the nav grid, the 3D terrain and the tap → world mapping always agree.
 */
(function () {
  'use strict';
  const { TAU, rng, mix, clamp, lerp } = OC;
  const P = OC.Style.P, Mo = OC.Models;

  function inBlob(b, x, y, grow = 0) {
    const dx = (x - b.cx) / (b.rx + grow), dy = (y - b.cy) / (b.ry + grow), a = Math.atan2(dy, dx);
    const k = 1 + 0.045 * Math.sin(3 * a + b.seed) + 0.03 * Math.sin(5 * a + b.seed * 2.1) + 0.02 * Math.sin(8 * a + b.seed * 0.7);
    return dx * dx + dy * dy <= k * k;
  }
  function blobPts(ctx, b, lvl = 0, grow = 0, n = 80) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, k = 1 + 0.045 * Math.sin(3 * a + b.seed) + 0.03 * Math.sin(5 * a + b.seed * 2.1) + 0.02 * Math.sin(8 * a + b.seed * 0.7); pts.push(new THREE.Vector2(b.cx + Math.cos(a) * (b.rx + grow) * k, -ctx.Zof(b.cy + Math.sin(a) * (b.ry + grow) * k, lvl))); }
    return pts;
  }
  function slab(pts, top, depth, mats, bevel = 0, holes) {
    const sh = new THREE.Shape(pts); if (holes) holes.forEach((h) => sh.holes.push(new THREE.Path(h)));
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
    const m = new THREE.Mesh(g, mats); m.rotation.x = -Math.PI / 2; m.position.y = top - depth - bevel; m.castShadow = true; m.receiveShadow = true; return m;
  }
  const tex = OC.Env.texture;
  const lawnTex = () => tex(256, 256, (x, w, h) => {
    x.fillStyle = P.grassA; x.fillRect(0, 0, w, h);
    x.fillStyle = P.grassB; x.save(); x.translate(w / 2, h / 2); x.rotate(-0.5); for (let k = -8; k < 8; k += 2) x.fillRect(-w, k * 32, w * 2, 32); x.restore();
    const r = rng(3); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${r() > 0.5 ? '255,255,220' : '40,110,40'},${0.04 + r() * 0.05})`; x.fillRect(r() * w, r() * h, 2, 2); }
    for (let i = 0; i < 14; i++) { const px = r() * w, py = r() * h; x.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(px + Math.cos(k * 2.1) * 2.2, py + Math.sin(k * 2.1) * 2.2, 1.6, 0, TAU); x.fill(); } }
  }, [1 / 96, 1 / 96]);
  const sandTex = () => tex(128, 128, (x, w, h) => { x.fillStyle = P.sand; x.fillRect(0, 0, w, h); const r = rng(8); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '170,130,70'},${0.08 + r() * 0.1})`; x.fillRect(r() * w, r() * h, 1.5, 1.5); } }, [1 / 40, 1 / 40]);
  const cliffTex = () => tex(128, 128, (x, w, h) => { const bands = ['#D9AE78', '#CFA06A', '#C4945E', '#D4A671']; for (let i = 0; i < 8; i++) { x.fillStyle = bands[i % 4]; x.fillRect(0, (i * h) / 8, w, h / 8 + 1); } const r = rng(5); for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(120,80,40,.18)'; x.beginPath(); x.ellipse(r() * w, r() * h, 3 + r() * 6, 2 + r() * 3, 0, 0, TAU); x.fill(); } }, [1 / 60, 1 / 30]);
  const waterTex = (base, line) => tex(256, 256, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); x.strokeStyle = line; x.lineCap = 'round'; const r = rng(11); for (let i = 0; i < 26; i++) { const px = r() * w, py = r() * h, l = 10 + r() * 22; x.lineWidth = 1.5 + r() * 2; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py - 3, px + l, py); x.stroke(); x.beginPath(); x.moveTo(px - w, py); x.quadraticCurveTo(px - w + l / 2, py - 3, px - w + l, py); x.stroke(); } });
  const paveTex = () => tex(256, 256, (x, w, h) => { x.fillStyle = '#E3D2AE'; x.fillRect(0, 0, w, h); const cx = w / 2, cy = h / 2; for (let ring = 0; ring < 6; ring++) { const r0 = 14 + ring * 19, n = 6 + ring * 7; for (let k = 0; k < n; k++) { const a0 = (k / n) * TAU + ring * 0.3, a1 = ((k + 1) / n) * TAU + ring * 0.3 - 0.06; x.beginPath(); x.arc(cx, cy, r0 + 16, a0, a1); x.arc(cx, cy, r0 + 1.5, a1, a0, true); x.closePath(); x.fillStyle = ['#F1E3C2', '#EADAB6', '#F5E9CE'][(k + ring) % 3]; x.fill(); } } x.fillStyle = '#F7EEDA'; x.beginPath(); x.arc(cx, cy, 13, 0, TAU); x.fill(); });

  function stoneTiles(ctx, pts, every = 11, col = P.path) {
    const list = [];
    for (let s = 0; s < pts.length - 1; s++) { const [ax, ay] = pts[s], [bx, by] = pts[s + 1], L = Math.hypot(bx - ax, (by - ay) / ctx.SIN), n = Math.max(1, Math.round(L / every)); for (let i = 0; i < n; i++) list.push([lerp(ax, bx, i / n), lerp(ay, by, i / n), pts[s][2] || 0]); }
    const g = Mo.rbox(10, 1.6, 8, 0.8), m = Mo.mat('#FFFFFF'), im = new THREE.InstancedMesh(g, m, list.length); im.receiveShadow = true;
    const r = rng(list.length), M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    list.forEach(([x, y, l], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (r() - 0.5) * 0.6); const s = 0.85 + r() * 0.3; M4.compose(ctx.V3(x + (r() - 0.5) * 3, y + (r() - 0.5) * 2, l, 2.2), q, new THREE.Vector3(s, 1, s)); im.setMatrixAt(i, M4); im.setColorAt(i, c.set(mix(col, '#FFFFFF', r() * 0.3))); });
    ctx.root.add(im); return list;
  }
  function grassField(ctx, test, n, seed, colors) {
    const g = Mo.geo('blade', () => { const b = new THREE.ConeGeometry(1.1, 6, 3, 1, true); b.translate(0, 3, 0); return b; });
    const m = ctx.env.windMaterial('#FFFFFF', 0.12), im = new THREE.InstancedMesh(g, m, n); im.receiveShadow = false; im.castShadow = false;
    const r = rng(seed), M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let k = 0, guard = 0;
    while (k < n && guard++ < n * 30) {
      const x = ctx.bounds.x0 + r() * (ctx.bounds.x1 - ctx.bounds.x0), y = ctx.bounds.y0 + r() * (ctx.bounds.y1 - ctx.bounds.y0); const l = test(x, y); if (l == null) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * TAU); const s = 0.7 + r() * 0.7;
      M4.compose(ctx.V3(x, y, l, l > 0.5 ? 1.5 : 1.5), q, new THREE.Vector3(s, s * (0.8 + r() * 0.6), s)); im.setMatrixAt(k, M4); im.setColorAt(k, c.set(colors[(r() * colors.length) | 0])); k++;
    }
    // drawn after the billboards' x-ray pass so blades in front of feet don't trigger the silhouette
    m.transparent = true; im.renderOrder = 3;
    im.count = k; ctx.root.add(im); ctx.grass(im, k); return im;
  }
  function ribbon(ctx, pts, w, Y, mat) {
    const L = [], Rr = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b[0] - a[0], dz = ctx.Zof(b[1]) - ctx.Zof(a[1]), l = Math.hypot(dx, dz) || 1; const nx = -dz / l, nz = dx / l; const X = pts[i][0], Zc = ctx.Zof(pts[i][1]); L.push([X + nx * w, Zc + nz * w]); Rr.push([X - nx * w, Zc - nz * w]); }
    const s = new THREE.Shape(); s.moveTo(L[0][0], -L[0][1]); L.slice(1).forEach((p) => s.lineTo(p[0], -p[1])); Rr.reverse().forEach((p) => s.lineTo(p[0], -p[1])); s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 10), mat); m.rotation.x = -Math.PI / 2; m.position.y = Y; m.receiveShadow = true; ctx.root.add(m); return m;
  }
  function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
  function distPoly(px, py, pts) { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return d; }
  const inRect = (r, x, y) => Math.abs(x - r.x) <= r.w / 2 && Math.abs(y - r.y) <= r.h / 2;
  function place(ctx, obj, x, y, lvl = 0, up = 0) {
    obj.position.copy(ctx.V3(x, y, lvl, up)); ctx.root.add(obj);
    // 12.0: a soft contact shadow under everything that stands on the ground (not lifted lamps, not flat rugs); tall narrow things (trees, posts) get a smaller one
    if (ctx.contact && up < 24 && !obj.userData.noContact) {
      const b = new THREE.Box3().setFromObject(obj), sx = b.max.x - b.min.x, sz = b.max.z - b.min.z, sh = b.max.y - b.min.y;
      if (sh > 4 && sx > 4 && sz > 2) { const tall = sh > Math.max(sx, sz) * 1.25, k = tall ? 0.95 : 1.3; ctx.contact(x, y, lvl, up, clamp(sx * k + 6, 12, 190), clamp(sz * k * 1.15 + 6, 10, 130)); }
    }
    return obj;
  }
  function frontEdge(b, x) { let y = b.cy; while (inBlob(b, x, y + 1) && y < b.cy + b.ry * 1.2) y += 1; return y; }

  // =========================================================================================
  //  晴日島 Sunny Isle
  // =========================================================================================
  const MAIN = { cx: 300, cy: 560, rx: 270, ry: 330, seed: 3.4 };
  const GRASS = { cx: 300, cy: 540, rx: 244, ry: 292, seed: 3.9 };
  const TER = { cx: 300, cy: 385, rx: 185, ry: 88, seed: 7.3 };
  const TER_IN = { cx: 300, cy: 383, rx: 175, ry: 79, seed: 7.3 };
  const RIVER = [[360, 488], [370, 530], [398, 574], [440, 612], [490, 645], [545, 668], [610, 690]];
  const BRIDGE = { x: 401, y: 576, w: 54, h: 17 };
  const PIER = { x: 300, y: 920, w: 28, h: 84 };
  const PLAZA = { x: 290, y: 622, r: 66 };
  const RAMP_RUN = 74;
  const RAMPS = [{ xc: 176, w: 30 }, { xc: 430, w: 30 }].map((r) => Object.assign(r, { yTop: frontEdge(TER, r.xc) - 3 }));
  const WATERFALL_X = 360;
  const isle = {
    id: 'isle', zh: '晴日島', bounds: { x0: 0, y0: 200, x1: 600, y1: 1000 }, spawn: { x: 300, y: 660 }, seaY: -6,
    // Phase 4 affordance spots (life AI): verbs = what OCs can do there; n = capacity
    spots: [
      { id: 'plaza', zh: '廣場', x: 290, y: 624, verbs: ['play', 'view'], n: 4, r: 24 },
      { id: 'pier', zh: '碼頭盡頭', x: 300, y: 948, verbs: ['view'], n: 2, r: 9 },
      { id: 'bridge', zh: '小橋', x: 401, y: 578, verbs: ['view'], n: 2, r: 11 },
      { id: 'terrace', zh: '高台邊', x: 236, y: 452, lvl: 1, verbs: ['view', 'play'], n: 2, r: 12 },
      { id: 'beach', zh: '南邊沙灘', x: 200, y: 900, verbs: ['view', 'play'], n: 3, r: 18 },
      { id: 'falls', zh: '瀑布前', x: 330, y: 512, verbs: ['view'], n: 2, r: 10 },
    ],
    ramp(x, y) { for (const r of RAMPS) if (Math.abs(x - r.xc) <= r.w / 2 && y >= r.yTop && y <= r.yTop + RAMP_RUN) return r; return null; },
    level(x, y) { const r = this.ramp(x, y); if (r) return clamp(1 - (y - r.yTop) / RAMP_RUN); return inBlob(TER, x, y) ? 1 : 0; },
    ground(x, y, l) { if (l > 0.001 && l < 0.999) return 1.6; if (l >= 0.999) return 1.5; if (inRect(PIER, x, y) && !inBlob(MAIN, x, y, -6)) return 0.5; return inBlob(GRASS, x, y) ? 1.5 : -0.6; },
    walk(x, y) {
      if (this.ramp(x, y)) return true;
      if (inBlob(TER, x, y)) return inBlob(TER_IN, x, y) || this.ramp(x, y + 6) != null;
      if (inBlob(TER, x, y - 24, 2)) return false;                       // cliff face
      if (inRect(PIER, x, y)) return true;
      if (!inBlob(MAIN, x, y, -8)) return false;
      if (distPoly(x, y, RIVER) < 14 && !inRect(BRIDGE, x, y)) return false;
      return true;
    },
    noBuild(x, y) { return this.ramp(x, y) || inRect(BRIDGE, x, y) || inRect(PIER, x, y) || Math.hypot(x - PLAZA.x, (y - PLAZA.y) / OC.World.SIN) < 20; },
    build(ctx) { buildIsle(ctx); if (OC.Areas.isleExtra) OC.Areas.isleExtra(ctx); },
  };
  function buildIsle(ctx) {
    const { root, V3, Zof, SIN, HY } = ctx; ctx.bounds = isle.bounds;
    // ---- sea, shallows, foam ----
    const seaT = waterTex('#FFFFFF', 'rgba(255,255,255,0.0)'); seaT.repeat.set(1 / 160, 1 / 160);
    const seaHi = waterTex('#000000', 'rgba(255,255,255,0.75)'); seaHi.repeat.set(1 / 130, 1 / 130);
    const seaM = new THREE.MeshBasicMaterial({ color: P.sea, alphaMap: null });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), seaM); sea.rotation.x = -Math.PI / 2; sea.position.set(300, -6, Zof(600)); root.add(sea);
    const hiM = new THREE.MeshBasicMaterial({ color: '#FFFFFF', alphaMap: seaHi, transparent: true, opacity: 0.35, depthWrite: false });
    const hi = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), hiM); hi.rotation.x = -Math.PI / 2; hi.position.set(300, -5.9, Zof(600)); hi.renderOrder = 0; root.add(hi);
    const shM = new THREE.MeshBasicMaterial({ color: P.shallow });
    const shallow = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(blobPts(ctx, MAIN, 0, 30)), 6), shM); shallow.rotation.x = -Math.PI / 2; shallow.position.y = -5.7; root.add(shallow);
    const foams = [0, 1].map((k) => { const s = new THREE.Shape(blobPts(ctx, MAIN, 0, 12)); s.holes.push(new THREE.Path(blobPts(ctx, MAIN, 0, 6).reverse())); const f = new THREE.Mesh(new THREE.ShapeGeometry(s, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.7, depthWrite: false })); f.rotation.x = -Math.PI / 2; f.position.y = -5.5; root.add(f); return f; });
    const cz = Zof(MAIN.cy);
    ctx.tick((t, dt, env) => {
      if (env) { seaM.color.set(env.sea); shM.color.set(mix(env.sea, '#C8F6F6', 0.42 * (1 - env.night * 0.6))); hiM.opacity = 0.3 * (1 - env.night * 0.5); }
      seaHi.offset.set((t * 0.006) % 1, (t * 0.004) % 1); seaT.offset.set((-t * 0.003) % 1, 0);
      foams.forEach((f, k) => { const q = (t * 0.22 + k * 0.5) % 1, s = 1 + q * 0.055; f.scale.set(s, s, 1); f.position.x = 300 * (1 - s); f.position.z = cz * (1 - s); f.material.opacity = 0.75 * (1 - q) * (1 - q * 0.3); });
    });
    // ---- island body ----
    const sand = Mo.mat('#FFFFFF', { p: { map: sandTex() } });
    root.add(slab(blobPts(ctx, MAIN), -1, 30, [sand, Mo.mat(P.sandLo)], 4));
    const lawn = Mo.mat('#FFFFFF', { p: { map: lawnTex() } });
    root.add(slab(blobPts(ctx, GRASS), 1.5, 3, [lawn, Mo.mat(P.lip)], 1.6));
    // terrace: strata cliff + lawn cap + fence along the visible front edge
    const cliffM = Mo.mat('#FFFFFF', { p: { map: cliffTex() } });
    root.add(slab(blobPts(ctx, TER, 1), HY - 1, HY + 1.5, [Mo.mat(P.cliff), cliffM], 0));
    root.add(slab(blobPts(ctx, TER, 1, 1), HY + 1.5, 3, [lawn, Mo.mat(P.lip)], 2));
    for (let a = 0.12; a < Math.PI - 0.12; a += 0.055) {
      const k = 1 + 0.045 * Math.sin(3 * a + TER.seed) + 0.03 * Math.sin(5 * a + TER.seed * 2.1) + 0.02 * Math.sin(8 * a + TER.seed * 0.7);
      const x = TER.cx + Math.cos(a) * (TER.rx - 7) * k, y = TER.cy + Math.sin(a) * (TER.ry - 7) * k;
      if (RAMPS.some((r) => Math.abs(x - r.xc) < r.w / 2 + 4) || Math.abs(x - WATERFALL_X) < 14) continue;
      const p = Mo.add(root, Mo.rbox(3.4, 12, 3.4, 1.3), Mo.mat('#EAD3AE')); p.position.copy(V3(x, y, 1, 7.5));
      const a2 = a + 0.055, k2 = 1 + 0.045 * Math.sin(3 * a2 + TER.seed) + 0.03 * Math.sin(5 * a2 + TER.seed * 2.1) + 0.02 * Math.sin(8 * a2 + TER.seed * 0.7);
      const x2 = TER.cx + Math.cos(a2) * (TER.rx - 7) * k2, y2 = TER.cy + Math.sin(a2) * (TER.ry - 7) * k2;
      if (RAMPS.some((r) => Math.abs(x2 - r.xc) < r.w / 2 + 4) || Math.abs(x2 - WATERFALL_X) < 14 || a2 >= Math.PI - 0.12) continue;
      const A = V3(x, y, 1, 9.5), B = V3(x2, y2, 1, 9.5), mid = A.clone().add(B).multiplyScalar(0.5), len = A.distanceTo(B);
      const rail = Mo.add(root, Mo.rbox(1.6, 1.8, 1, 0.5), Mo.mat('#EAD3AE'), 0, 0, 0, { cast: false }); rail.position.copy(mid); rail.scale.set(1, 1, len); rail.lookAt(B);
    }
    // ramps: solid stone stairs with low side walls
    for (const r of RAMPS) {
      const N = 9, runZ = (RAMP_RUN - 24) / SIN;
      for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N, y = r.yTop + t * RAMP_RUN, l = 1 - t, top = l * HY + 1.6;
        const st = Mo.add(root, Mo.rbox(r.w, Math.max(2, top), runZ / N + 0.6, 0.8), Mo.mat(i % 2 ? '#E2D3B8' : '#D9C9AC')); st.position.copy(V3(r.xc, y, l, 0)); st.position.y = top / 2 + 0.2;
      }
      for (const sx of [-1, 1]) { const wall = Mo.add(root, Mo.rbox(4, HY * 0.5, runZ, 1.5), Mo.mat(P.stone)); const mid = V3(r.xc + sx * (r.w / 2 + 2), r.yTop + RAMP_RUN / 2, 0.5, 0); wall.position.set(mid.x, HY * 0.35, mid.z); wall.rotation.x = Math.atan2(HY, runZ) * 0.92; }
    }
    // ---- river, waterfall, bridge ----
    const rivT = waterTex('#62CBEF', 'rgba(255,255,255,0.55)'); rivT.repeat.set(1 / 40, 1 / 40);
    ribbon(ctx, RIVER, 18, 1.55, Mo.mat('#E2C47E'));
    const rivM = new THREE.MeshBasicMaterial({ color: '#FFFFFF', map: rivT });
    ribbon(ctx, RIVER, 13, 1.75, rivM);
    const fy = frontEdge(TER, WATERFALL_X);
    const fallT = tex(64, 128, (x, w, h) => { x.fillStyle = '#7FD6F2'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 3; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(5 + i * 9, 0); x.lineTo(5 + i * 9, h * 0.4); x.stroke(); } }, [1, 1]);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(20, HY + 2), new THREE.MeshBasicMaterial({ map: fallT })); fall.position.copy(V3(WATERFALL_X, fy + 22, 0, HY / 2)); root.add(fall);
    const puffs = [0, 1, 2, 3, 4].map(() => Mo.add(root, Mo.sphere(3.6, 10, 8), Mo.mat('#FFFFFF'), 0, 0, 0, { cast: false }));
    ctx.tick((t, dt, env) => { rivT.offset.set((-t * 0.05) % 1, (t * 0.06) % 1); fallT.offset.y = (t * 1.4) % 1; puffs.forEach((p, i) => { const q = (t * 0.7 + i / 5) % 1; p.position.copy(V3(WATERFALL_X - 8 + i * 4, fy + 26 + q * 6, 0, 2 + q * 4)); p.scale.setScalar(0.6 + q * 0.6); }); if (env) { rivM.color.set(mix('#FFFFFF', '#7080C0', env.night * 0.55)); fall.material.color.copy(rivM.color); } });
    const br = Mo.bridge(BRIDGE.w + 4, 22); place(ctx, br, BRIDGE.x, BRIDGE.y, 0, -0.5);
    // ---- plaza, paths ----
    const pz = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA.r, PLAZA.r + 1, 1.2, 48), [Mo.mat('#D9C7A6'), Mo.mat('#FFFFFF', { p: { map: paveTex() } }), Mo.mat('#D9C7A6')]); pz.receiveShadow = true; place(ctx, pz, PLAZA.x, PLAZA.y, 0, 2.1);
    stoneTiles(ctx, [[300, 400, 1], [262, 424, 1], [196, 438, 1]]);
    stoneTiles(ctx, [[176, 520], [200, 560], [240, 590]]);
    stoneTiles(ctx, [[300, 680], [300, 760], [300, 860]]);
    stoneTiles(ctx, [[340, 640], [376, 600], BRIDGE.x - 30 > 0 ? [374, 578] : [374, 578]]);
    stoneTiles(ctx, [[428, 576], [470, 560], [500, 540]]);
    stoneTiles(ctx, [[430, 520], [470, 532]]);
    stoneTiles(ctx, [[230, 640], [150, 670], [118, 668]]);
    // pier + rowboat
    const deck = new THREE.Group(); for (let k = 0; k < 11; k++) Mo.add(deck, Mo.rbox(PIER.w + 2, 2.2, 7, 0.9), Mo.mat(k % 2 ? '#D9A26A' : '#CF9860'), 0, 0, k * 8.2);
    place(ctx, deck, PIER.x, PIER.y - PIER.h / 2 + 2, 0, -0.6);
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) Mo.add(root, Mo.cyl(1.8, 1.8, 12, 8), Mo.mat(P.woodLo), 0, 0, 0).position.copy(V3(PIER.x + sx * 14, PIER.y - PIER.h / 2 + 10 + k * 22, 0, -4));
    const boat = new THREE.Group(); const hull = Mo.add(boat, Mo.geo('hull', () => { const g = new THREE.SphereGeometry(12, 18, 10, 0, TAU, Math.PI / 2, Math.PI / 2); g.scale(1, 0.5, 2.1); return g; }), Mo.mat('#F26B5B'), 0, 3, 0); hull.material.side = THREE.DoubleSide;
    Mo.add(boat, Mo.rbox(20, 1.5, 6, 0.6), Mo.mat('#D9A26A'), 0, 2.5, 4); Mo.add(boat, Mo.rbox(20, 1.5, 6, 0.6), Mo.mat('#D9A26A'), 0, 2.5, -8);
    place(ctx, boat, PIER.x + 30, PIER.y + 26, 0, -5);
    ctx.tick((t) => { boat.position.y = -5 + Math.sin(t * 1.4) * 0.8; boat.rotation.z = Math.sin(t * 1.1) * 0.04; });
    // ---- buildings & props ----
    const home = Mo.house({ roof: P.coral, shutter: P.teal }); place(ctx, home, 300, 352, 1, 1.5);
    ctx.block(300, 352, 80, 48);
    ctx.interact({ type: 'home', x: 300, y: 376, lvl: 1, hit: { w: 80, h: 110, d: 6 }, at: { x: 300, y: 392 }, label: '我的家' });
    const kh = Mo.house({ roof: P.yellow, shutter: P.coral, w: 60, d: 46, h: 40, wall: '#FFF1E0' }); place(ctx, kh, 116, 640, 0, 1.5);
    ctx.block(116, 640, 70, 42); 
    const sh = Mo.house({ roof: P.purple, shutter: P.yellow, w: 60, d: 46, h: 40, wall: '#F7F1FF' }); place(ctx, sh, 500, 506, 0, 1.5);
    ctx.block(500, 506, 70, 42); 
    const st = Mo.stall(); place(ctx, st, 290, 568, 0, 1.5); ctx.block(290, 568, 68, 22);
    ctx.interact({ type: 'shop', x: 290, y: 580, hit: { w: 70, h: 72, d: 6 }, at: { x: 290, y: 598 }, label: '晴日雜貨攤' });
    for (const [x, y] of [[226, 648], [356, 648]]) { const b = Mo.bench(); place(ctx, b, x, y, 0, 1.5); ctx.block(x, y, 38, 8); ctx.interact({ type: 'bench', x, y: y + 3, hit: { w: 40, h: 26, d: 6 }, at: { x, y: y + 12 }, seat: { x, y: y + 1, up: 7 }, label: '長椅' }); }
    for (const [x, y, l, light] of [[236, 590, 0, 1], [346, 590, 0, 1], [262, 405, 1, 1], [190, 712, 0, 0], [452, 548, 0, 0], [330, 852, 0, 0]]) { const lp = Mo.lampPost(light && ctx.quality.lights !== false); place(ctx, lp, x, y, l, l ? 1.5 : 1.5); ctx.block(x, y, 6, 5); }
    // fruit trees (shakeable)
    const trees = [[170, 392, 1, 'apple'], [432, 396, 1, 'orange'], [84, 560, 0, 'peach'], [520, 612, 0, 'apple'], [160, 772, 0, 'orange'], [420, 740, 0, 'peach'], [232, 452, 1, 'peach']];
    const FC = { apple: '#EE4B4B', orange: '#FF9A3C', peach: '#FFB3A7' };
    trees.forEach(([x, y, l, fruit], i) => {
      if (l && !inBlob(TER_IN, x, y)) return;
      const tr = Mo.fruitTree(FC[fruit], i + 1); place(ctx, tr.group, x, y, l, 1.5); ctx.block(x, y, 12, 8); ctx.sway(tr.crown, i * 1.7, 0.035);
      ctx.interact({ type: 'tree', id: 'tree' + i, fruit, color: FC[fruit], x, y, lvl: l, hit: { w: 50, h: 76, d: 6 }, at: { x, y: y + 14 }, label: OC.Style.ITEMS[fruit].zh + '樹', tree: tr });
    });
    // flower beds (pickable)
    [[232, 518, 0, 36, 18], [370, 702, 0, 34, 16], [384, 418, 1, 30, 14]].forEach(([x, y, l, w, d], i) => { const fb = Mo.flowerBed(w, d, i + 2); place(ctx, fb, x, y, l, 1.5); ctx.block(x, y, w, d * SIN); fb.userData.blooms.forEach((b, k) => ctx.sway(b, k * 0.9 + i, 0.08)); ctx.interact({ type: 'bed', id: 'bed' + i, x, y: y + 4, lvl: l, hit: { w: w + 6, h: 22, d: 6 }, at: { x, y: y + 16 }, label: '花圃' }); });
    // palms, bushes, rocks
    [[66, 800, 1], [534, 804, 2], [190, 870, 3], [430, 878, 4]].forEach(([x, y, s]) => { if (!inBlob(MAIN, x, y, -10)) return; const pm = Mo.palm(s); place(ctx, pm.group, x, y, 0, -0.6); ctx.block(x, y, 8, 6); ctx.sway(pm.crown, s * 2.3, 0.07); });
    [[64, 620], [168, 612], [456, 500], [548, 530], [232, 342, 1], [372, 344, 1], [128, 470], [470, 452], [560, 610], [240, 760], [370, 780], [44, 700]].forEach(([x, y, l = 0], i) => { if (!isle.walk(x, y) && !l) return; const b = Mo.bush(i + 1); place(ctx, b.group, x, y, l, 1.5); ctx.block(x, y, 16, 9); ctx.sway(b.group, i, 0.02); });
    [[52, 690, 1], [548, 690, 0.8], [470, 820, 1.1], [116, 838, 0.9], [210, 482, 0.7], [560, 760, 1]].forEach(([x, y, s], i) => { const r = Mo.rock(s, i); place(ctx, r, x, y, 0, 0); ctx.block(x, y, 13 * s, 8 * s); });
    const sign = Mo.signpost(); place(ctx, sign, 334, 872, 0, -0.6); ctx.block(334, 872, 6, 4);
    ctx.interact({ type: 'travel', x: 334, y: 872, hit: { w: 38, h: 34, d: 6 }, at: { x: 318, y: 880 }, label: '告示牌：渡船往苔光森林' });
    ctx.interact({ type: 'travel', x: PIER.x, y: PIER.y + PIER.h / 2 - 4, hit: { w: 60, h: 40, d: 10 }, at: { x: PIER.x, y: PIER.y + PIER.h / 2 - 10 }, label: '渡船' });
    // shells on the beach (daily)
    isle.shellSpots = [[84, 842], [160, 884], [452, 884], [536, 760], [44, 650], [562, 690], [248, 902], [384, 902], [520, 840], [70, 740]];
    // grass blades (instanced, wind-driven)
    grassField(ctx, (x, y) => { if (!isle.walk(x, y)) return null; const l = isle.level(x, y); if (l > 0 && l < 1) return null; if (l === 0 && !inBlob(GRASS, x, y, -4)) return null; if (Math.hypot(x - PLAZA.x, (y - PLAZA.y) / SIN) < PLAZA.r + 4) return null; if (distPoly(x, y, RIVER) < 22) return null; return l; }, 2600, 7, ['#6FC24F', '#7ACB58', '#5DB146', '#8AD765', '#66BA4C']);
  }

  // =========================================================================================
  //  苔光森林 Mosslight Woods
  // =========================================================================================
  const WOOD = { cx: 200, cy: 380, rx: 176, ry: 300, seed: 2.2 };
  const POND = { x: 214, y: 330, rx: 44, ry: 30 };
  const forest = {
    id: 'forest', zh: '苔光森林',
    spots: [{ id: 'pond', zh: '池塘邊', x: 214, y: 372, verbs: ['view'], n: 3, r: 18 }, { id: 'glade', zh: '林間空地', x: 200, y: 600, verbs: ['play', 'view'], n: 3, r: 18 }], bounds: { x0: 0, y0: 40, x1: 400, y1: 720 }, spawn: { x: 200, y: 630 }, bg: '#2E6B3E',
    level: () => 0, ground: () => 1.5,
    walk(x, y) { if (!inBlob(WOOD, x, y, -12)) return false; if (((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2 < 1.15) return false; return true; },
    noBuild: () => true,
    build(ctx) {
      const { root, V3, Zof, SIN } = ctx; ctx.bounds = forest.bounds;
      const lawn = Mo.mat('#FFFFFF', { p: { map: lawnTex() } }); lawn.map.repeat.set(1 / 80, 1 / 80);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 2200), Mo.mat('#3F8A45')); floor.rotation.x = -Math.PI / 2; floor.position.set(200, -1, Zof(380)); floor.receiveShadow = true; root.add(floor);
      root.add(slab(blobPts(ctx, WOOD), 1.5, 3, [lawn, Mo.mat('#4E9E46')], 1.5));
      const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#7FD0EA' })); pond.scale.set(POND.rx, POND.ry / SIN, 1); pond.rotation.x = -Math.PI / 2; place(ctx, pond, POND.x, POND.y, 0, 1.8);
      const lily = []; for (let i = 0; i < 5; i++) { const lp = Mo.add(root, Mo.cyl(4, 4, 0.6, 14), Mo.mat('#5FBF62'), 0, 0, 0, { cast: false }); lp.position.copy(V3(POND.x - 26 + i * 12, POND.y - 10 + (i % 2) * 16, 0, 2.1)); lily.push(lp); }
      ctx.tick((t, dt, env) => { lily.forEach((l, i) => (l.position.y = 2.1 + Math.sin(t * 1.2 + i) * 0.25)); if (env) pond.material.color.set(mix('#7FD0EA', '#3A4E9A', env.night * 0.7)); });
      // ring of cedars (dense edge) + inner trees
      const r = rng(17);
      for (let a = 0; a < TAU; a += 0.17) { const k = 1.02 + r() * 0.1, x = WOOD.cx + Math.cos(a) * WOOD.rx * k, y = WOOD.cy + Math.sin(a) * WOOD.ry * k; if (y > 640 && Math.abs(x - 200) < 50) continue; const c = Mo.cedar(a); c.group.scale.setScalar(1.2 + r() * 0.5); place(ctx, c.group, x, y, 0, 1.5); ctx.sway(c.crown, a * 3, 0.02); }
      for (const [x, y, s] of [[90, 200, 1.3], [320, 210, 1.4], [70, 420, 1.2], [334, 440, 1.3], [110, 560, 1.1], [300, 560, 1.2], [200, 140, 1.2]]) { const c = Mo.cedar(x); c.group.scale.setScalar(s); place(ctx, c.group, x, y, 0, 1.5); ctx.block(x, y, 14, 8); ctx.sway(c.crown, x, 0.02); }
      for (const [x, y] of [[150, 300], [270, 420], [130, 470]]) { const s2 = Mo.stump(); place(ctx, s2, x, y, 0, 1.5); ctx.block(x, y, 14, 8); }
      for (const [x, y, c, s] of [[96, 340, P.coral, 1.3], [300, 330, P.purple, 1.2], [240, 520, P.yellow, 1.1], [60, 520, P.coral, 1]]) { const m = Mo.mushroom(c, s); place(ctx, m, x, y, 0, 1.5); ctx.block(x, y, 10 * s, 6 * s); }
      [[40, 280, 1], [356, 300, 0.8], [170, 230, 0.9]].forEach(([x, y, s], i) => { const rk = Mo.rock(s, i + 4); place(ctx, rk, x, y, 0, 0.5); ctx.block(x, y, 13 * s, 8 * s); });
      [[130, 640], [272, 650], [60, 380], [340, 380], [250, 250]].forEach(([x, y], i) => { const b = Mo.bush(i + 5, '#4FA845'); place(ctx, b.group, x, y, 0, 1.5); ctx.block(x, y, 16, 9); });
      stoneTiles(ctx, [[200, 690], [200, 600], [180, 520], [196, 420]], 12, '#E8D7A8');
      const sign = Mo.signpost(); place(ctx, sign, 236, 664, 0, 1.5); ctx.block(236, 664, 6, 4);
      ctx.interact({ type: 'travelHome', x: 236, y: 664, hit: { w: 40, h: 36, d: 6 }, at: { x: 220, y: 672 }, label: '告示牌：回晴日島' });
      forest.mushSpots = [[120, 250], [282, 270], [98, 450], [320, 500], [180, 380], [262, 600], [60, 300], [150, 560], [340, 240]];
      grassField(ctx, (x, y) => (forest.walk(x, y) ? 0 : null), 1800, 11, ['#4FA845', '#5DB64C', '#3F9A40', '#6CC257']);
      if (OC.Areas.forestExtra) OC.Areas.forestExtra(ctx);
    },
  };

  OC.Areas = { isle, forest, inBlob, _h: { inBlob, blobPts, slab, tex, lawnTex, sandTex, waterTex, paveTex, stoneTiles, grassField, ribbon, place, inRect, distPoly, frontEdge } };
})();
