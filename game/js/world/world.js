/* OC Shimeji — world engine.
 * 3D world (three.js) seen through a FIXED orthographic camera tilted 50° (pan + zoom only).
 * All game logic runs in 2D "design" coordinates (x, y) = screen position at zoom 1, plus a
 * terrain level; the renderer maps them with the alignment formula
 *     X = x,  Z = (y + lvl·24) / sin50°,  Y = lvl·24 / cos50°
 * so taps convert to world positions without ray casting and every 2D layout stays valid.
 * Characters are 2D: a vertical billboard per actor whose texture is repainted only when
 * the quantised pose changes (breathing/bob are mesh transforms → no per-frame uploads).
 */
(function () {
  'use strict';
  const { clamp, lerp, TAU } = OC;
  const TH = (50 * Math.PI) / 180, SIN = Math.sin(TH), COS = Math.cos(TH), H2D = 24, HY = H2D / COS;
  const Zof = (y, lvl = 0) => (y + lvl * H2D) / SIN;
  const V3 = (x, y, lvl = 0, up = 0) => new THREE.Vector3(x, lvl * HY + up, Zof(y, lvl));
  const CELL = 6;
  const RIG_UNIT = 0.58;            // world units per rig unit → OC ≈ 30 dp tall on screen
  const BB_W = 120 * RIG_UNIT, BB_H = BB_W / COS, FEET = 0.9;

  let R, canvas, scene, cam, env, area = null, root = null;
  let W = 360, H = 640, zoom = 1.9, camX = 300, camY = 470, panX = 0, panY = 0, follow = true;
  let quality = { ratio: 1.5, shadows: 1024, fx: true, grass: 1, fps: 60, bb: 256 };
  let grid = null, actors = [], interacts = [], ticks = [], sways = [], drops = [], furn = [];
  let hooks = {};
  let time = 0, hourFn = () => 12, weatherFn = () => 'clear', reduce = false;
  let grassMesh = null, grassMax = 0;
  const tmpV = new THREE.Vector3(), bbTint = new THREE.Color('#FFFFFF');

  // ====================== navigation grid ======================
  function buildGrid() {
    const b = area.bounds, nx = Math.ceil((b.x1 - b.x0) / CELL), ny = Math.ceil((b.y1 - b.y0) / CELL);
    grid = { nx, ny, x0: b.x0, y0: b.y0, walk: new Uint8Array(nx * ny), lvl: new Float32Array(nx * ny) };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = b.x0 + (i + 0.5) * CELL, y = b.y0 + (j + 0.5) * CELL, k = j * nx + i;
      grid.walk[k] = area.walk(x, y) ? 1 : 0; grid.lvl[k] = area.level(x, y);
    }
    for (const o of area.obstacles) markRect(o, 0);
    for (const f of furn) if (!OC.Style.ITEMS[f.id].walk) markRect(furnRect(f), 0);
  }
  function markRect(r, v) {
    const i0 = Math.floor((r.x - r.w / 2 - grid.x0) / CELL), i1 = Math.floor((r.x + r.w / 2 - grid.x0) / CELL);
    const j0 = Math.floor((r.y - r.h / 2 - grid.y0) / CELL), j1 = Math.floor((r.y + r.h / 2 - grid.y0) / CELL);
    for (let j = Math.max(0, j0); j <= Math.min(grid.ny - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(grid.nx - 1, i1); i++) grid.walk[j * grid.nx + i] = v;
  }
  const cellOf = (x, y) => [Math.floor((x - grid.x0) / CELL), Math.floor((y - grid.y0) / CELL)];
  function walkable(x, y) { const [i, j] = cellOf(x, y); return i >= 0 && j >= 0 && i < grid.nx && j < grid.ny && grid.walk[j * grid.nx + i] === 1; }
  function levelAt(x, y) { return area.level(x, y); }
  function groundY(x, y) { const l = levelAt(x, y); return l * HY + area.ground(x, y, l); }
  /** nearest walkable point to (x, y) */
  function nearestWalkable(x, y, maxR = 60) {
    if (walkable(x, y)) return { x, y };
    for (let r = CELL; r <= maxR; r += CELL / 2) for (let a = 0; a < TAU; a += 0.35) { const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (walkable(px, py)) return { x: px, y: py }; }
    return null;
  }
  /** A* on the cell grid (8-neighbour, no corner cutting) + string pulling */
  function findPath(x0, y0, x1, y1) {
    const g = grid, s = cellOf(x0, y0), e = cellOf(x1, y1);
    const idx = (i, j) => j * g.nx + i, ok = (i, j) => i >= 0 && j >= 0 && i < g.nx && j < g.ny && g.walk[idx(i, j)] === 1;
    if (!ok(e[0], e[1])) return null;
    const N = g.nx * g.ny, gs = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; const push = (k, f) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const si = ok(s[0], s[1]) ? s : (() => { const n = nearestWalkable(x0, y0, 30); return n ? cellOf(n.x, n.y) : null; })();
    if (!si) return null;
    const sk = idx(si[0], si[1]), ek = idx(e[0], e[1]); gs[sk] = 0; push(sk, 0);
    const hf = (i, j) => { const dx = Math.abs(i - e[0]), dy = Math.abs(j - e[1]); return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    let it = 0;
    while (heap.length && it++ < 40000) {
      const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === ek) break;
      const i = k % g.nx, j = (k / g.nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (!ok(ni, nj)) continue;
        if (di && dj && (!ok(i + di, j) || !ok(i, j + dj))) continue;
        const dl = Math.abs(g.lvl[idx(ni, nj)] - g.lvl[k]); if (dl > 0.3) continue;   // no stepping up cliffs
        const nk = idx(ni, nj), c = gs[k] + (di && dj ? Math.SQRT2 : 1);
        if (c < gs[nk]) { gs[nk] = c; from[nk] = k; push(nk, c + hf(ni, nj)); }
      }
    }
    if (from[ek] < 0 && ek !== sk) return null;
    const cells = []; for (let k = ek; k >= 0; k = from[k]) { cells.push(k); if (k === sk) break; }
    cells.reverse();
    const pts = cells.map((k) => ({ x: g.x0 + ((k % g.nx) + 0.5) * CELL, y: g.y0 + (((k / g.nx) | 0) + 0.5) * CELL }));
    pts[pts.length - 1] = { x: x1, y: y1 };
    // string pulling with line-of-sight on the grid
    const out = [pts[0]]; let a = 0;
    while (a < pts.length - 1) { let b = pts.length - 1; while (b > a + 1 && !los(pts[a], pts[b])) b--; out.push(pts[b]); a = b; }
    out.shift();
    return out;
  }
  function los(p, q) {
    const d = Math.hypot(q.x - p.x, q.y - p.y), n = Math.ceil(d / (CELL * 0.5)); let l0 = levelAt(p.x, p.y);
    for (let i = 1; i <= n; i++) { const x = lerp(p.x, q.x, i / n), y = lerp(p.y, q.y, i / n); if (!walkable(x, y) || !walkable(x + 2.5, y) || !walkable(x - 2.5, y)) return false; const l = levelAt(x, y); if (Math.abs(l - l0) > 0.3) return false; l0 = l; }
    return true;
  }

  // ====================== actors (2D billboards) ======================
  let blobTex = null, silMat = null;
  function makeBlob() {
    if (blobTex) return blobTex;
    blobTex = OC.Env.texture(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(30,40,40,0.42)'); g.addColorStop(0.6, 'rgba(30,40,40,0.22)'); g.addColorStop(1, 'rgba(30,40,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
    blobTex.wrapS = blobTex.wrapT = THREE.ClampToEdgeWrapping; return blobTex;
  }
  const bbGeo = () => { const g = new THREE.PlaneGeometry(BB_W, BB_H); g.translate(0, BB_H / 2 - (1 - FEET) * BB_H, 0); return g; };
  function silMaterial(tex) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthFunc: THREE.GreaterDepth, fog: false,
      uniforms: { map: { value: tex }, uCol: { value: new THREE.Color('#7B6BE0') } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 uCol; varying vec2 vUv; void main(){ float a = texture2D(map, vUv).a; if (a < 0.5) discard; gl_FragColor = vec4(uCol, 0.42); }',
    });
  }
  function actor(o) {
    // o.char(): the character record (roster OC, or a preset for residents)
    const a = Object.assign({ x: 0, y: 0, lvl: 0, gy: 0, path: null, speed: 62, face: 0.3, back: 0, tFace: 0.3, tBack: 0, walk: 0, phase: 0, blinkT: 2 + Math.random() * 3, blink: 0, t: 0, lift: 0, squash: 1, key: '', dir: 'front', act: null, turnT: 0, lastMirror: false, sc: 1 }, o);
    const res = quality.bb, c = OC.makeCanvas(res, res), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    const m = new THREE.Mesh(bbGeo(), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08, depthWrite: true, side: THREE.DoubleSide, fog: false }));
    m.renderOrder = 2;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: makeBlob(), transparent: true, depthWrite: false, fog: false })); sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1;
    a.c = c; a.tex = tex; a.m = m; a.sh = sh;
    if (a.xray) { a.sil = new THREE.Mesh(m.geometry, silMaterial(tex)); a.sil.renderOrder = 1.5; root.add(a.sil); }
    root.add(m); root.add(sh);
    a.gy = groundY(a.x, a.y);
    actors.push(a); return a;
  }
  function resizeActorCanvas(a) { const r = quality.bb; if (a.c.width === r) return; a.c.width = a.c.height = r; a.key = ''; a.tex.dispose(); a.tex = new THREE.CanvasTexture(a.c); a.tex.colorSpace = THREE.SRGBColorSpace; a.tex.generateMipmaps = false; a.tex.minFilter = THREE.LinearFilter; a.m.material.map = a.tex; if (a.sil) a.sil.material.uniforms.map.value = a.tex; }

  /** start an action on an actor. o = { dur (s), priority, once } — lower priority never interrupts higher */
  function setAction(a, action, o = {}) {
    if (a.act && a.act.priority > (o.priority || 0) && (a.act.until == null || a.t < a.act.until) && action !== 'idle') return false;
    a.act = action === 'idle' ? null : { action, t0: a.t, until: o.dur != null ? a.t + o.dur : null, priority: o.priority || 0, once: !!o.once, keepMoving: !!o.keepMoving };
    a.key = ''; return true;
  }
  function currentAction(a) {
    if (a.act && a.act.until != null && a.t >= a.act.until) a.act = null;
    const moving = a.walk > 0.3;
    if (a.act && (!moving || a.act.keepMoving)) return { action: a.act.action, at: a.t - a.act.t0 };
    if (a.act && moving && a.act.priority < 5) a.act = null;
    if (moving) return { action: a.run ? 'run' : 'walk', at: a.t };
    return { action: 'idle', at: a.t };
  }
  function poseOf(a) {
    const ca = currentAction(a);
    return { action: ca.action, at: ca.at, dir: a.dir, face: a.face, back: a.back, walk: a.walk, phase: a.phase, blink: a.blink, breath: 0, lookX: a.lookX || 0, eyes: a.eyes, mouth: a.mouth, blush: a.blush || 0, overrides: a.overrides || null };
  }
  function paintActor(a) {
    const ch = a.char(); if (!ch) return;
    const p = poseOf(a), pl = OC.CharRender.plan(ch, p);
    // a sprite that mirrors (left ↔ right) does a quick squash-turn instead of snapping
    if (pl.sprite && pl.mirror !== a.lastMirror) { a.turnT = 0.16; a.lastMirror = pl.mirror; }
    if (pl.sprite && pl.done && a.act && a.act.once) a.act = null;
    a.isSprite = pl.sprite;
    const key = OC.CharRender.key(ch, p, pl);
    if (key === a.key) return;
    a.key = key;
    const r = a.c.width, x = a.c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, r, r);
    const res = OC.CharRender.draw(x, ch, p, r / 2, r * FEET, r / 120, a.t);
    if (res && res.loading) a.key = '';   // try again next frame once the frames are decoded
    a.tex.needsUpdate = true;
  }
  function updateActor(a, dt) {
    a.t += dt;
    const ch = a.char && a.char(), beh = ch ? OC.Chars.behavior(ch) : null;
    if (beh && !a.fixedSpeed) a.speed = beh.speed * (a.run ? 1.6 : 1);
    // blink (rate follows personality)
    a.blinkT -= dt; if (a.blinkT < 0) { a.blink = 1; if (a.blinkT < -0.12) { a.blink = 0; a.blinkT = (beh ? beh.blinkEvery : 2.8) * (0.7 + Math.random() * 0.6); } }
    // path following
    let moving = false;
    const busy = a.act && a.act.priority >= 5 && (a.act.until == null || a.t < a.act.until);
    if (a.path && a.path.length && !busy) {
      const p = a.path[0], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy), step = a.speed * dt;
      if (d <= step) { a.x = p.x; a.y = p.y; a.path.shift(); if (!a.path.length) { a.path = null; a.onArrive && (a.onArrive(a), (a.onArrive = null)); } }
      else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
      if (d > 0.01) { a.tFace = clamp((dx / d) * 1.1, -1, 1); a.tBack = dy < -0.45 * d ? 1 : 0; }
      moving = true; a.dist = (a.dist || 0) + Math.min(d, step);
    } else if (a.joy && !busy) {
      const { jx, jy } = a.joy, m = Math.hypot(jx, jy);
      if (m > 0.15) {
        const sp = a.speed * Math.min(1, m) * dt, nx = a.x + (jx / m) * sp, ny = a.y + (jy / m) * sp;
        const l0 = levelAt(a.x, a.y);
        const tryMove = (tx, ty) => walkable(tx, ty) && Math.abs(levelAt(tx, ty) - l0) < 0.3;
        if (tryMove(nx, ny)) { a.x = nx; a.y = ny; } else if (tryMove(nx, a.y)) a.x = nx; else if (tryMove(a.x, ny)) a.y = ny;
        a.tFace = clamp((jx / m) * 1.1, -1, 1); a.tBack = jy < -0.45 * m ? 1 : 0; moving = true; a.dist = (a.dist || 0) + sp;
      }
    }
    a.walk = lerp(a.walk, moving ? 1 : 0, 1 - Math.exp(-dt * 12)); if (moving) a.phase += dt * (a.speed / 15);
    // smooth turning for the rig; 4 directions (with hysteresis) for frame animations
    a.face = lerp(a.face, a.tFace, 1 - Math.exp(-dt * 7)); a.back = lerp(a.back, a.tBack, 1 - Math.exp(-dt * 6));
    const want = a.tBack > 0.5 ? 'back' : a.tFace < -0.55 ? 'left' : a.tFace > 0.55 ? 'right' : a.dir === 'back' || (Math.abs(a.tFace) < 0.35) ? 'front' : a.dir;
    if (want !== a.dir) { a.dirHold = (a.dirHold || 0) + dt; if (a.dirHold > 0.08) { a.dir = want; a.dirHold = 0; } } else a.dirHold = 0;
    if (a.jumpT != null) { a.jumpT += dt; const q = a.jumpT / 0.5; if (q >= 1) { a.jumpT = null; a.lift = 0; a.squashT = 0; } else a.lift = Math.sin(q * Math.PI) * (beh ? beh.jumpHeight : 14); }
    if (a.squashT != null) { a.squashT += dt; const q = a.squashT / 0.3; a.squash = q >= 1 ? 1 : 1 - Math.sin(q * Math.PI) * 0.12; if (q >= 1) a.squashT = null; }
    if (a.turnT > 0) a.turnT = Math.max(0, a.turnT - dt);
    if (a.update) a.update(a, dt);
    a.lvl = levelAt(a.x, a.y);
    const gy = groundY(a.x, a.y) + (a.seatY || 0); a.gy = lerp(a.gy, gy, 1 - Math.exp(-dt * 14));
    paintActor(a);
    const z = Zof(a.y, a.lvl), br = (a.act && a.act.action === 'sleep') ? Math.sin(a.t * 1.6) * 0.02 : Math.sin(a.t * 2.4) * 0.012;
    const bob = a.isSprite ? a.walk * Math.abs(Math.sin(a.phase * Math.PI)) * 1.2 * (beh ? beh.bounce : 1) : 0;
    a.m.position.set(a.x, a.gy + 0.6 + (a.lift + bob) * RIG_UNIT, z + 1.5);
    const turn = a.turnT > 0 ? Math.max(0.08, Math.abs(1 - 2 * (1 - a.turnT / 0.16))) : 1;
    const sx = turn * (a.sc || 1), sy = (1 + br) * a.squash * (a.sc || 1);
    a.m.scale.set(sx / Math.sqrt(a.squash), sy, 1);
    a.m.rotation.z = a.isSprite ? a.walk * Math.sin(a.phase * Math.PI) * (beh ? beh.sway : 0.04) : 0;
    if (a.sil) { a.sil.position.copy(a.m.position); a.sil.scale.copy(a.m.scale); a.sil.rotation.copy(a.m.rotation); }
    const lift = a.lift / 30; a.sh.position.set(a.x, a.gy + 0.25, z + 1.5); a.sh.scale.set(26 * (a.sc || 1) * (1 - lift * 0.4), 14 * (a.sc || 1) * (1 - lift * 0.4), 1);
    a.m.material.color.copy(bbTint);
    // inside a building (life AI): hidden but still simulated
    const vis = !a.hidden; if (a.m.visible !== vis) { a.m.visible = vis; a.sh.visible = vis; if (a.sil) a.sil.visible = vis; }
  }
  function removeActor(a) { root.remove(a.m); root.remove(a.sh); if (a.sil) root.remove(a.sil); a.tex.dispose(); actors = actors.filter((b) => b !== a); }
  function walkTo(a, x, y, onArrive) {
    const t = nearestWalkable(x, y, 40); if (!t) return false;
    const p = findPath(a.x, a.y, t.x, t.y); if (!p) return false;
    a.path = p; a.onArrive = onArrive || null; a.joy = null; return true;
  }
  function jump(a) { if (a.jumpT == null) { a.jumpT = 0; } }

  // ====================== camera ======================
  function applyCam() {
    const b = area.bounds, vw = W / zoom, vh = H / zoom;
    let cx = camX + panX, cy = camY + panY;
    cx = vw >= b.x1 - b.x0 ? (b.x0 + b.x1) / 2 : clamp(cx, b.x0 + vw / 2, b.x1 - vw / 2);
    cy = vh >= b.y1 - b.y0 ? (b.y0 + b.y1) / 2 : clamp(cy, b.y0 + vh / 2 - 40, b.y1 - vh / 2 + 40);
    panX = cx - camX; panY = cy - camY;
    cam.left = -W / 2 / zoom; cam.right = W / 2 / zoom; cam.top = H / 2 / zoom; cam.bottom = -H / 2 / zoom; cam.updateProjectionMatrix();
    const tgt = new THREE.Vector3(cx, 0, Zof(cy)); cam.position.copy(tgt).add(new THREE.Vector3(0, SIN * 1200, COS * 1200)); cam.lookAt(tgt);
    return { cx, cy };
  }
  function screenToDesign(sx, sy) { const cx = camX + panX, cy = camY + panY; return { x: cx + (sx - W / 2) / zoom, y: cy + (sy - H / 2) / zoom }; }
  /** design point (+height in world units) → CSS px on screen */
  function project(x, y, lvl = 0, up = 0) { tmpV.copy(V3(x, y, lvl, up)).project(cam); return { x: (tmpV.x * 0.5 + 0.5) * W, y: (-tmpV.y * 0.5 + 0.5) * H }; }
  function setZoom(z, ax, ay) {
    const nz = clamp(z, 1.15, 3.2); if (ax != null) { const before = screenToDesign(ax, ay); zoom = nz; const after = screenToDesign(ax, ay); panX += before.x - after.x; panY += before.y - after.y; } else zoom = nz;
    follow = false;
  }

  // ====================== picking ======================
  function pick(sx, sy) {
    const p = screenToDesign(sx, sy);
    let best = null, bestD = 1e9;
    const consider = (it) => {
      if (it.hidden) return; const h = it.hit || { w: 24, h: 30 };
      const sy0 = it.y - (it.lvl || 0) * 0 - h.h, inX = Math.abs(p.x - it.x) <= h.w / 2, inY = p.y >= sy0 && p.y <= it.y + (h.d || 8);
      if (inX && inY) { const d = Math.abs(p.x - it.x) + Math.abs(p.y - (it.y - h.h / 2)) * 0.5 - (it.prio || 0) * 100; if (d < bestD) { bestD = d; best = it; } }
    };
    actors.forEach((a) => { if (a.interact) consider(Object.assign(a.interact, { x: a.x, y: a.y, lvl: a.lvl })); });
    drops.forEach((d) => consider(d.it)); interacts.forEach(consider); furn.forEach((f) => f.it && consider(f.it));
    return { p, it: best };
  }

  // ====================== drops (fruit, shells…) ======================
  function spawnDrop(id, fromX, fromY, toX, toY, lvl, color) {
    const m = OC.Models.mesh(OC.Models.sphere(3, 12, 10), OC.Models.mat(color || '#EE4B4B'), true, false);
    root.add(m);
    const d = { id, x: toX, y: toY, lvl, t: 0, m, fx: fromX, fy: fromY, it: null };
    d.it = { type: 'drop', id, x: toX, y: toY, lvl, hit: { w: 18, h: 16, d: 8 }, prio: 1, drop: d };
    drops.push(d); return d;
  }
  function removeDrop(d) { root.remove(d.m); drops = drops.filter((x) => x !== d); }

  // ====================== furniture ======================
  function furnRect(f) { const fp = OC.Style.ITEMS[f.id].fp || [1, 1]; const rot = (f.rot || 0) % 2; const w = (rot ? fp[1] : fp[0]) * 18, d = (rot ? fp[0] : fp[1]) * 18 * SIN; return { x: f.x, y: f.y, w, h: d }; }
  function addFurniture(f) {
    const g = OC.Models.furniture(f.id); g.position.copy(V3(f.x, f.y, levelAt(f.x, f.y), area.ground(f.x, f.y, levelAt(f.x, f.y)))); g.rotation.y = -(f.rot || 0) * Math.PI / 2;
    root.add(g); const def = OC.Style.ITEMS[f.id];
    const it = { type: 'furn', uid: f.uid, id: f.id, x: f.x, y: f.y, hit: { w: 26, h: def.walk ? 10 : 24, d: 8 } };
    const rec = Object.assign({}, f, { g, it }); furn.push(rec);
    if (def.walk !== true && grid) markRect(furnRect(f), 0);
    if (g.userData.glow) OC.Models.night.lamps.push({ m: g.userData.glow, L: null, furn: f.uid });
    return rec;
  }
  function removeFurniture(uid) { const r = furn.find((f) => f.uid === uid); if (!r) return; root.remove(r.g); furn = furn.filter((f) => f !== r); const L = OC.Models.night.lamps; for (let k = L.length - 1; k >= 0; k--) if (L[k].furn === uid) L.splice(k, 1); buildGrid(); }
  function canPlace(f) {
    const r = furnRect(f), l = levelAt(f.x, f.y);
    for (let y = r.y - r.h / 2 + 2; y <= r.y + r.h / 2 - 2; y += 4) for (let x = r.x - r.w / 2 + 2; x <= r.x + r.w / 2 - 2; x += 4) {
      if (!walkable(x, y) || Math.abs(levelAt(x, y) - l) > 0.01 || area.noBuild && area.noBuild(x, y)) return false;
    }
    for (const a of actors) if (Math.abs(a.x - f.x) < r.w / 2 + 4 && Math.abs(a.y - f.y) < r.h / 2 + 4) return false;
    return true;
  }
  // placement ghost
  let ghost = null;
  function setGhost(f) {
    if (ghost) { root.remove(ghost.g); root.remove(ghost.ring); ghost = null; }
    if (!f) return;
    const g = OC.Models.furniture(f.id); g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.78; o.castShadow = false; } });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#3FC1B0', transparent: true, opacity: 0.35, depthWrite: false })); ring.rotation.x = -Math.PI / 2; root.add(ring);
    root.add(g); ghost = { g, ring, f };
    moveGhost(f.x, f.y, f.rot || 0);
  }
  function moveGhost(x, y, rot) {
    if (!ghost) return false;
    const sn = 6; x = Math.round(x / sn) * sn; y = Math.round(y / sn) * sn;
    Object.assign(ghost.f, { x, y, rot });
    const l = levelAt(x, y), ok = canPlace(ghost.f); ghost.ok = ok;
    ghost.g.position.copy(V3(x, y, l, area.ground(x, y, l) + 0.3)); ghost.g.rotation.y = -rot * Math.PI / 2;
    const r = furnRect(ghost.f); ghost.ring.scale.set(r.w + 6, (r.h + 6) / SIN, 1); ghost.ring.position.copy(V3(x, y, l, area.ground(x, y, l) + 0.5));
    ghost.ring.material.color.set(ok ? '#3FC1B0' : '#F26B5B');
    return ok;
  }

  // ====================== area lifecycle ======================
  function clearArea() {
    if (root) scene.remove(root);   // geometries/materials are cached & shared across areas
    actors = []; interacts = []; ticks = []; sways = []; drops = []; furn = []; grassMesh = null; ghost = null;
    OC.Models.night.windows.length = 0; OC.Models.night.lamps.length = 0;
  }
  function loadArea(def, opts = {}) {
    clearArea(); area = def; root = new THREE.Group(); scene.add(root);
    const ctx = {
      root, V3, Zof, SIN, COS, HY, env, quality,
      block: (x, y, w, h) => area.obstacles.push({ x, y, w, h }),
      interact: (it) => { interacts.push(it); return it; },
      sway: (o, seed, amp) => sways.push({ o, seed, amp }),
      tick: (fn) => ticks.push(fn),
      grass: (mesh, max) => { grassMesh = mesh; grassMax = max; mesh.count = Math.round(max * quality.grass); },
    };
    area.obstacles = [];
    area.build(ctx);
    grid = null; buildGrid();
    (opts.furniture || []).forEach(addFurniture);
    const sp = opts.pos && walkable(opts.pos.x, opts.pos.y) ? opts.pos : area.spawn;
    camX = sp.x; camY = sp.y; panX = panY = 0; follow = true;
    return ctx;
  }

  // ====================== input ======================
  const ptrs = new Map(); let gesture = null, pressTimer = 0;
  function onDown(e) {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    if (ptrs.size === 1) {
      const p = ptrs.get(e.pointerId); const g = { kind: 'press', id: e.pointerId, moved: false };
      if (ghost) { const d = screenToDesign(e.clientX, e.clientY); if (Math.abs(d.x - ghost.f.x) < 26 && Math.abs(d.y - ghost.f.y) < 26) g.kind = 'ghost'; }
      gesture = g;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => { if (gesture === g && !g.moved && g.kind === 'press') { g.kind = 'long'; const r = hooks.longPress && hooks.longPress(pick(p.x, p.y)); if (r && r.drag) g.kind = 'drag'; } }, 480);
    } else if (ptrs.size === 2) {
      clearTimeout(pressTimer);
      const [a, b] = [...ptrs.values()]; gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
  }
  function onMove(e) {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (!gesture) return;
    if (gesture.kind === 'pinch' && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      setZoom(gesture.z0 * d / gesture.d0, mx, my);
      panX -= (mx - gesture.mx) / zoom; panY -= (my - gesture.my) / zoom; gesture.mx = mx; gesture.my = my; follow = false;
      return;
    }
    if (gesture.kind === 'drag') { hooks.dragMove && hooks.dragMove(screenToDesign(p.x, p.y)); return; }
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 9) gesture.moved = true;
    if (gesture.kind === 'ghost' && gesture.moved) { const d = screenToDesign(p.x, p.y); moveGhost(d.x, d.y, ghost.f.rot || 0); hooks.ghostMoved && hooks.ghostMoved(ghost.ok); return; }
    if ((gesture.kind === 'press' || gesture.kind === 'pan') && gesture.moved) { gesture.kind = 'pan'; clearTimeout(pressTimer); panX -= dx / zoom; panY -= dy / zoom; follow = false; hooks.panned && hooks.panned(); }
  }
  function onUp(e) {
    const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); clearTimeout(pressTimer);
    if (!gesture) return;
    if (gesture.kind === 'pinch') { if (ptrs.size === 0) gesture = null; return; }
    if (gesture.kind === 'drag') { hooks.dragEnd && hooks.dragEnd(p ? screenToDesign(p.x, p.y) : null); gesture = null; return; }
    if (gesture.kind === 'press' && !gesture.moved && p && e.type !== 'pointercancel') {
      const r = pick(p.x, p.y);
      if (ghost) { moveGhost(r.p.x, r.p.y, ghost.f.rot || 0); hooks.ghostMoved && hooks.ghostMoved(ghost.ok); }
      else hooks.tap && hooks.tap(r);
    }
    gesture = null;
  }
  function onWheel(e) { e.preventDefault(); setZoom(zoom * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }

  // ====================== main ======================
  function init(cv, opt = {}) {
    canvas = cv; hooks = opt.hooks || {};
    R = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
    R.outputColorSpace = THREE.SRGBColorSpace; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.background = new THREE.Color(OC.Style.P.sea);
    cam = new THREE.OrthographicCamera(-180, 180, 320, -320, 1, 4000);
    env = OC.Env.create(scene); env.setShadows(quality.shadows);
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); hooks.contextLost && hooks.contextLost(); });
    resize();
  }
  function resize() {
    if (!canvas || !R) return;
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    R.setPixelRatio(quality.ratio); R.setSize(W, H, false);
  }
  function setQuality(q) {
    const bbChanged = q.bb !== quality.bb, shChanged = q.shadows !== quality.shadows;
    quality = Object.assign({}, q);
    R.setPixelRatio(q.ratio); R.setSize(W, H, false);
    if (shChanged) {
      const was = R.shadowMap.enabled; R.shadowMap.enabled = !!q.shadows;
      env.setShadows(q.shadows);
      if (was !== !!q.shadows) scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); });
    }
    env.setQuality(q);
    if (grassMesh) grassMesh.count = Math.round(grassMax * q.grass);
    OC.Models.night.lamps.forEach((l) => { if (l.L) l.L.visible = q.lights !== false; });
    if (bbChanged) actors.forEach(resizeActorCanvas);
  }
  let last = 0, envCur = null, camTarget = null;
  /** move actors without rendering (the world is covered by a page) — keeps the life simulation moving */
  function tickActors(dt) { if (!area) return; for (const a of actors.slice()) updateActor(a, dt); }
  /** camera follows another actor (observe / important events); null = back to the player */
  function focus(a, z) { camTarget = a || null; if (a) { panX = panY = 0; follow = true; if (z) zoom = clamp(z, 1.15, 3.2); } }
  function frame(now, dt) {
    if (!area) return;
    time += dt;
    const h = hourFn(), wx = weatherFn();
    // camera follows the player gently; manual pan decays back when the player moves
    const pl = (camTarget && actors.includes(camTarget) && camTarget) || actors.find((a) => a.player);
    if (pl) {
      const k = 1 - Math.exp(-dt * 5); camX = lerp(camX, pl.x, k); camY = lerp(camY, pl.y - 14, k);
      if ((pl.path || (pl.joy && Math.hypot(pl.joy.jx, pl.joy.jy) > 0.15)) && !follow) { panX = lerp(panX, 0, 1 - Math.exp(-dt * 2.2)); panY = lerp(panY, 0, 1 - Math.exp(-dt * 2.2)); if (Math.abs(panX) + Math.abs(panY) < 1) follow = true; }
    }
    const { cx, cy } = applyCam();
    if (envCur) bbTint.set(OC.mix(OC.mix('#FFFFFF', '#FFE3CC', clamp(1 - Math.abs(h - 18) / 1.6) * 0.8), '#A9B1E4', envCur.night * 0.85)).multiplyScalar(1 - envCur.rain * 0.12);
    for (const a of actors.slice()) updateActor(a, dt);
    for (const s of sways) s.o.rotation.z = Math.sin(time * 1.3 + s.seed) * s.amp * (envCur ? envCur.wind : 1) * (reduce ? 0.3 : 1);
    for (const f of ticks) f(time, dt, envCur);
    for (const d of drops.slice()) {
      d.t += dt; const q = Math.min(1, d.t / 0.7), l = d.lvl;
      const x = lerp(d.fx, d.x, q), y = lerp(d.fy, d.y, q), base = groundY(d.x, d.y);
      const hop = q < 1 ? Math.abs(Math.sin(q * Math.PI * 1.6)) * (1 - q) * 30 + (1 - q) * 28 : 0;
      d.m.position.copy(V3(x, y, l, base - l * HY + 3 + hop));
    }
    envCur = env.update({ dt, t: time, hour: h, weather: wx, focus: { x: cx, z: Zof(cy), y: 0 }, view: { w: W / zoom, h: H / zoom / SIN }, groundAt: (X, Z) => { const y = Z * SIN; return walkable(X, y) && levelAt(X, y) < 0.01 ? groundY(X, y) : (area.seaY != null ? area.seaY : null); }, pxScale: zoom * quality.ratio, reduce, instant: dt > 1 });
    // night lights
    const n = envCur.night;
    OC.Models.night.windows.forEach((m) => { m.emissiveIntensity = n * 1.25; });
    OC.Models.night.lamps.forEach((l) => { const on = l.furn ? (hooks.lampOn ? hooks.lampOn(l.furn) : true) : true; l.m.emissiveIntensity = on ? n * 1.5 : 0; if (l.L) l.L.intensity = on ? n * 900 : 0; });
    if (area.bg) scene.background.set(OC.mix(area.bg, '#14202E', envCur.night * 0.7)); else scene.background.set(envCur.sea);
    R.render(scene, cam);
  }

  OC.World = {
    init, resize, setQuality, loadArea, frame, tickActors, focus, actor, removeActor, setAction, poseOf, walkTo, jump, findPath, walkable, levelAt, groundY, nearestWalkable,
    screenToDesign, project, setZoom, pick, spawnDrop, removeDrop, addFurniture, removeFurniture, canPlace, setGhost, moveGhost, furnRect, buildGrid,
    V3, Zof, SIN, COS, HY, CELL,
    get actors() { return actors; }, get interacts() { return interacts; }, get drops() { return drops; }, get furn() { return furn; }, get ghost() { return ghost; }, get camTarget() { return camTarget; }, get area() { return area; }, get env() { return envCur; }, get zoom() { return zoom; }, get renderer() { return R; }, get quality() { return quality; },
    set hourFn(f) { hourFn = f; }, set weatherFn(f) { weatherFn = f; }, set reduce(v) { reduce = v; }, set hooks(h) { hooks = h; },
    recenter() { panX = 0; panY = 0; follow = true; },
    stopGesture() { ptrs.clear(); gesture = null; clearTimeout(pressTimer); },
  };
})();
