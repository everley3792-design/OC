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
  let area0Room = false, outdoorZoom = 1.9, W = 360, H = 640, zoom = 1.9, camX = 300, camY = 470, panX = 0, panY = 0, follow = true;
  // 8.0 camera: yaw (rotation around the vertical axis, limited), modes, scripted shots
  //   classic = fixed 2.5D (yaw 0, follows the played OC) · follow = follows the selected OC (rotation allowed)
  //   focus = close-up on the selected OC · free = no auto-follow, pan / pinch / twist · cine = scripted (opening, events)
  let yaw = 0, yawGoal = null, mode = 'classic', subject = null, shot = null;
  const YAW_MAX = 0.9;
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
    for (const f of furn) if (!(OC.Style.ITEMS[f.id] || {}).walk) markRect(furnRect(f), 0);
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
    blobTex.wrapS = blobTex.wrapT = THREE.ClampToEdgeWrapping; blobTex.userData.cached = true; return blobTex;
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
    const res = bbRes, c = OC.makeCanvas(res, res), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    const m = new THREE.Mesh(bbGeo(), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08, depthWrite: true, side: THREE.DoubleSide, fog: false }));
    m.renderOrder = 2;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: makeBlob(), transparent: true, depthWrite: false, fog: false })); sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1;
    a.c = c; a.tex = tex; a.m = m; a.sh = sh;
    if (a.xray) { a.sil = new THREE.Mesh(m.geometry, silMaterial(tex)); a.sil.renderOrder = 1.5; root.add(a.sil); }
    root.add(m); root.add(sh);
    a.gy = groundY(a.x, a.y);
    actors.push(a); return a;
  }
  // 8.0: billboard texture resolution follows the character's real size on screen (zoom × pixel ratio), in steps with
  // hysteresis, capped by the performance mode — no more 256 px textures stretched over a 500 px close-up
  const BB_STEPS = [128, 192, 256, 384, 512, 768];
  let bbRes = 256, bbWant = 256, bbWantT = 0;
  function bbTarget() { const need = BB_H * zoom * (quality.ratio || 1) * 1.05, cap = quality.bbMax || Math.max(quality.bb, 256); return Math.min(cap, BB_STEPS.find((v) => v >= need) || 768); }
  function resizeActorCanvas(a) { const r = bbRes; if (a.c.width === r) return; a.c.width = a.c.height = r; a.key = ''; a.tex.dispose(); a.tex = new THREE.CanvasTexture(a.c); a.tex.colorSpace = THREE.SRGBColorSpace; a.tex.generateMipmaps = false; a.tex.minFilter = THREE.LinearFilter; pixelFilter(a); a.m.material.map = a.tex; if (a.sil) a.sil.material.uniforms.map.value = a.tex; }
  /** pixel-art characters keep hard edges (nearest filter); everyone else is smoothly filtered */
  function pixelFilter(a) { const ch = a.char && a.char(), px = !!(ch && ch.appearance && ch.appearance.pixel); const f = px ? THREE.NearestFilter : THREE.LinearFilter; if (a.tex.magFilter !== f) { a.tex.magFilter = f; a.tex.minFilter = f; a.tex.needsUpdate = true; } a.pixel = px; }

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
    if (a.pixel === undefined) pixelFilter(a);
    x.imageSmoothingEnabled = !a.pixel; x.imageSmoothingQuality = 'high';   // big player images are downsampled with a proper filter
    const res = OC.CharRender.draw(x, ch, p, r / 2, r * FEET, r / 120, a.t);
    if (res && res.loading) a.key = '';   // try again next frame once the frames are decoded
    if (!pl.sprite && quality.fx !== false) toyShade(x, r);
    a.tex.needsUpdate = true;
  }
  /** 10.0 "vinyl toy" volume on rig-drawn characters: a soft top light, a cool shade toward the feet and the side away
   *  from the sun (drawn only on the character's own pixels). Imported / painted sprites are left exactly as drawn. */
  function toyShade(x, r) {
    x.save(); x.globalCompositeOperation = 'source-atop';
    const top = r * FEET - r * 0.62, g = x.createLinearGradient(0, top, 0, r * FEET);
    g.addColorStop(0, 'rgba(255, 248, 236, 0.16)'); g.addColorStop(0.38, 'rgba(255, 255, 255, 0)'); g.addColorStop(0.72, 'rgba(70, 50, 130, 0)'); g.addColorStop(1, 'rgba(70, 50, 130, 0.17)');
    x.fillStyle = g; x.fillRect(0, 0, r, r);
    const s = x.createLinearGradient(r * 0.3, 0, r * 0.75, 0); s.addColorStop(0, 'rgba(70, 50, 130, 0)'); s.addColorStop(1, 'rgba(70, 50, 130, 0.07)');
    x.fillStyle = s; x.fillRect(0, 0, r, r);
    x.restore();
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
      if (d > 0.01) { const sd = designToScreenDir(dx, dy), sm = Math.hypot(sd.x, sd.y) || 1; a.tFace = clamp((sd.x / sm) * 1.1, -1, 1); a.tBack = sd.y < -0.45 * sm ? 1 : 0; }
      moving = true; a.dist = (a.dist || 0) + Math.min(d, step);
    } else if (a.joy && !busy) {
      const { jx: sjx, jy: sjy } = a.joy, m = Math.hypot(sjx, sjy);
      // the stick is in screen space → turn it into a design direction for the current yaw
      const jd = screenDelta(sjx, sjy), jm = Math.hypot(jd.x, jd.y) || 1, jx = (jd.x / jm) * m, jy = (jd.y / jm) * m;
      if (m > 0.15) {
        const sp = a.speed * Math.min(1, m) * dt, nx = a.x + (jx / m) * sp, ny = a.y + (jy / m) * sp;
        const l0 = levelAt(a.x, a.y);
        const tryMove = (tx, ty) => walkable(tx, ty) && Math.abs(levelAt(tx, ty) - l0) < 0.3;
        if (tryMove(nx, ny)) { a.x = nx; a.y = ny; } else if (tryMove(nx, a.y)) a.x = nx; else if (tryMove(a.x, ny)) a.y = ny;
        a.tFace = clamp((sjx / m) * 1.1, -1, 1); a.tBack = sjy < -0.45 * m ? 1 : 0; moving = true; a.dist = (a.dist || 0) + sp;
      }
    }
    a.walk = lerp(a.walk, moving ? 1 : 0, 1 - Math.exp(-dt * 12)); if (moving) a.phase += dt * (a.speed / 15);
    // smooth turning for the rig; 4 directions (with hysteresis) for frame animations
    a.face = lerp(a.face, a.tFace, 1 - Math.exp(-dt * 7)); a.back = lerp(a.back, a.tBack, 1 - Math.exp(-dt * 6));
    const want = a.tBack > 0.5 ? 'back' : a.tFace < -0.55 ? 'left' : a.tFace > 0.55 ? 'right' : a.dir === 'back' || (Math.abs(a.tFace) < 0.35) ? 'front' : a.dir;
    if (want !== a.dir) { a.dirHold = (a.dirHold || 0) + dt; if (a.dirHold > 0.08) { a.dir = want; a.dirHold = 0; } } else a.dirHold = 0;
    // 10.0 jump: anticipation (crouch) → stretch at take-off → slight stretch while falling → squash on landing with a small rebound
    if (a.jumpT != null) {
      a.jumpT += dt;
      if (a.jumpT < 0) { a.lift = 0; a.squash = 1 - 0.14 * Math.sin(Math.min(1, 1 + a.jumpT / 0.1) * Math.PI / 2); }
      else { const q = a.jumpT / 0.5; if (q >= 1) { a.jumpT = null; a.lift = 0; a.squashT = 0; } else { a.lift = Math.sin(q * Math.PI) * (beh ? beh.jumpHeight : 14); a.squash = 1 + 0.11 * Math.max(0, 1 - q * 2.5) + 0.05 * Math.max(0, (q - 0.7) / 0.3); } }
    }
    if (a.squashT != null) { a.squashT += dt; const q = a.squashT / 0.42; a.squash = q >= 1 ? 1 : 1 - 0.16 * Math.exp(-q * 3) * Math.cos(q * Math.PI * 2.2); if (q >= 1) a.squashT = null; }
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
    a.m.rotation.order = 'YXZ'; a.m.rotation.y = yaw;
    // held by the player: swing around the hands (pivot ≈ 55 % of the billboard height), not around the feet
    if (a.swing) { const hh = BB_H * 0.55, sx = Math.sin(a.swing) * hh; a.m.position.x += sx * Math.cos(yaw); a.m.position.z -= sx * Math.sin(yaw); a.m.position.y += hh * (1 - Math.cos(a.swing)); }
    a.m.rotation.z = (a.isSprite ? a.walk * Math.sin(a.phase * Math.PI) * (beh ? beh.sway : 0.04) : 0) + (a.swing || 0);
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
  function jump(a) { if (a.jumpT == null) { a.jumpT = reduce ? 0 : -0.1; } }

  // ====================== camera ======================
  function applyCam() {
    const b = area.bounds, vw = W / zoom, vh = H / zoom;
    let cx = camX + panX, cy = camY + panY;
    cx = vw >= b.x1 - b.x0 ? (b.x0 + b.x1) / 2 : clamp(cx, b.x0 + vw / 2, b.x1 - vw / 2);
    cy = vh >= b.y1 - b.y0 ? (b.y0 + b.y1) / 2 : clamp(cy, b.y0 + vh / 2 - 40, b.y1 - vh / 2 + 40);
    panX = cx - camX; panY = cy - camY;
    cam.left = -W / 2 / zoom; cam.right = W / 2 / zoom; cam.top = H / 2 / zoom; cam.bottom = -H / 2 / zoom; cam.updateProjectionMatrix();
    const tgt = new THREE.Vector3(cx, 0, Zof(cy)); cam.position.copy(tgt).add(new THREE.Vector3(Math.sin(yaw) * COS * 1200, SIN * 1200, Math.cos(yaw) * COS * 1200)); cam.lookAt(tgt);
    return { cx, cy };
  }
  /** screen offset (CSS px) → design offset, for the current zoom and yaw (exact inverse of the orthographic camera on the ground plane) */
  function screenDelta(dx, dy) { const u = dx / zoom, v = dy / zoom / SIN, c = Math.cos(yaw), sn = Math.sin(yaw); return { x: u * c + v * sn, y: (-u * sn + v * c) * SIN }; }
  /** design offset → screen direction (for facing / joystick) */
  function designToScreenDir(dx, dy) { const dz = dy / SIN, c = Math.cos(yaw), sn = Math.sin(yaw); return { x: dx * c - dz * sn, y: (dx * sn + dz * c) * SIN }; }
  function screenToDesign(sx, sy) { const cx = camX + panX, cy = camY + panY, d = screenDelta(sx - W / 2, sy - H / 2); return { x: cx + d.x, y: cy + d.y }; }
  /** design point (+height in world units) → CSS px on screen */
  function project(x, y, lvl = 0, up = 0) { tmpV.copy(V3(x, y, lvl, up)).project(cam); return { x: (tmpV.x * 0.5 + 0.5) * W, y: (-tmpV.y * 0.5 + 0.5) * H }; }
  function setZoom(z, ax, ay) {
    zoomGoal = null;
    const nz = clamp(z, 1.15, 3.2); if (ax != null) { const before = screenToDesign(ax, ay); zoom = nz; const after = screenToDesign(ax, ay); panX += before.x - after.x; panY += before.y - after.y; } else zoom = nz;
    if (mode !== 'focus') follow = false;
  }

  // ====================== picking ======================
  function pick(sx, sy) {
    const p = screenToDesign(sx, sy), cx = camX + panX, cy = camY + panY;
    let best = null, bestD = 1e9;
    // hit boxes stand upright on the SCREEN (w wide, h tall above the base, d below), so they stay right when the view is rotated
    const consider = (it) => {
      if (it.hidden) return; const h = it.hit || { w: 24, h: 30 };
      const sd = designToScreenDir(it.x - cx, it.y - cy), bx = W / 2 + sd.x * zoom, by = H / 2 + sd.y * zoom;
      const qx = (sx - bx) / zoom, qy = (sy - by) / zoom, inX = Math.abs(qx) <= h.w / 2, inY = qy >= -h.h && qy <= (h.d || 8);
      if (inX && inY) { const d = Math.abs(qx) + Math.abs(qy + h.h / 2) * 0.5 - (it.prio || 0) * 100; if (d < bestD) { bestD = d; best = it; } }
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
  function furnRect(f) { const it = OC.Style.ITEMS[f.id] || {}; const fp = it.fp || [1, 1], sc = f.sc || 1; const rot = (f.rot || 0) % 2; const w = (rot ? fp[1] : fp[0]) * 18 * sc, d = (rot ? fp[0] : fp[1]) * 18 * SIN * sc; return { x: f.x, y: f.y, w, h: d }; }
  function addFurniture(f) {
    const g = OC.Models.furniture(f.id); g.position.copy(V3(f.x, f.y, levelAt(f.x, f.y), area.ground(f.x, f.y, levelAt(f.x, f.y)))); g.rotation.y = -(f.rot || 0) * Math.PI / 2; if (f.sc && f.sc !== 1) g.scale.setScalar(f.sc);
    root.add(g); const def = OC.Style.ITEMS[f.id] || { zh: '?', fp: [1, 1] };
    if (g.userData.tick) ticks.push((t) => g.userData.tick(t));
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
  let ghost = null, ghostSn = 6;
  function setGhost(f) {
    if (ghost) { root.remove(ghost.g); root.remove(ghost.ring); ghost = null; }
    if (!f) return;
    const g = OC.Models.furniture(f.id); g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.78; o.castShadow = false; } });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#3FC1B0', transparent: true, opacity: 0.35, depthWrite: false })); ring.rotation.x = -Math.PI / 2; root.add(ring);
    root.add(g); ghost = { g, ring, f }; if (f.sc) g.scale.setScalar(f.sc);
    moveGhost(f.x, f.y, f.rot || 0);
  }
  function moveGhost(x, y, rot) {
    if (!ghost) return false;
    const sn = ghostSn; x = Math.round(x / sn) * sn; y = Math.round(y / sn) * sn;
    Object.assign(ghost.f, { x, y, rot });
    const def = OC.Style.ITEMS[ghost.f.id]; if (def && def.wall && area.wallY != null) { const r0 = furnRect(ghost.f); ghost.f.y = y = Math.round((area.wallY + r0.h / 2 + 2) / 2) * 2; }
    ghost.g.scale.setScalar(ghost.f.sc || 1);
    const l = levelAt(x, y), ok = canPlace(ghost.f); ghost.ok = ok;
    ghost.g.position.copy(V3(x, y, l, area.ground(x, y, l) + 0.3)); ghost.g.rotation.y = -rot * Math.PI / 2;
    const r = furnRect(ghost.f); ghost.ring.scale.set(r.w + 6, (r.h + 6) / SIN, 1); ghost.ring.position.copy(V3(x, y, l, area.ground(x, y, l) + 0.5));
    ghost.ring.material.color.set(ok ? '#3FC1B0' : '#F26B5B');
    return ok;
  }

  // ====================== area lifecycle ======================
  /** free everything the old scene created that is not in the shared caches (geometry / material / texture) */
  function disposeTree(obj) {
    const seen = new Set();
    obj.traverse((o) => {
      if (o.geometry && !(o.geometry.userData && o.geometry.userData.cached) && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) {
        if (!m || seen.has(m) || (m.userData && m.userData.cached)) continue; seen.add(m);
        for (const k of ['map', 'alphaMap', 'emissiveMap', 'normalMap']) { const t = m[k]; if (t && !(t.userData && t.userData.cached) && !seen.has(t)) { seen.add(t); t.dispose(); } }
        if (m.uniforms && m.uniforms.map && m.uniforms.map.value && !seen.has(m.uniforms.map.value)) { seen.add(m.uniforms.map.value); m.uniforms.map.value.dispose(); }
        m.dispose();
      }
    });
  }
  function clearArea() {
    if (root) { scene.remove(root); disposeTree(root); }   // shared geometries/materials stay cached; scene-owned ones are freed
    for (const a of actors) if (a.tex) a.tex.dispose();
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
    camX = sp.x; camY = sp.y; panX = panY = 0; follow = true; zoomGoal = null; camTarget = null; shot = null;
    if (def.room) { yaw = 0; yawGoal = null; }   // rooms are built for the front view
    // rooms fit the screen width; outdoor places keep the player's own zoom
    if (def.room) { if (!area0Room) outdoorZoom = zoom; zoom = clamp(W / (def.room.x1 - def.room.x0 + 40), 1.1, 2.4); area0Room = true; } else { if (area0Room) zoom = outdoorZoom; area0Room = false; }
    return ctx;
  }

  // ====================== input ======================
  const ptrs = new Map(); let gesture = null, pressTimer = 0;
  function onDown(e) {
    // a primary pointer starts a new gesture: drop stale pointers whose up never reached the canvas (they would turn a tap into a pinch)
    if (window.__ocInputLog) window.__ocInputLog.push(`down ${e.pointerType} id=${e.pointerId} primary=${e.isPrimary} n=${ptrs.size} g=${gesture && gesture.kind}`);
    if (e.isPrimary) { ptrs.clear(); if (gesture && gesture.kind === 'drag') hooks.dragEnd && hooks.dragEnd(null); if (gesture && gesture.kind === 'claim') hooks.claimCancel && hooks.claimCancel(); gesture = null; }   // 10.0 fix: a lost finger-up on a character used to leave it held in the air forever
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* the pointer can already be gone (released before the handler ran) */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    if (ptrs.size === 1) {
      const p = ptrs.get(e.pointerId); const g = { kind: 'press', id: e.pointerId, moved: false };
      if (ghost) { const d = screenToDesign(e.clientX, e.clientY); if (Math.abs(d.x - ghost.f.x) < 26 && Math.abs(d.y - ghost.f.y) < 26) g.kind = 'ghost'; }
      // 8.0: a finger that lands on a character belongs to the character (pet / pick up / menu), never to the camera
      if (g.kind === 'press' && hooks.claimDown) { const r0 = pick(e.clientX, e.clientY); if (hooks.claimDown(r0, p, e)) { g.kind = 'claim'; gesture = g; clearTimeout(pressTimer); return; } }
      gesture = g;
      clearTimeout(pressTimer);
      // long press: the timer can fire late after a long frame while the pointerup is still queued → confirm on the next frame (queued input is dispatched first)
      pressTimer = setTimeout(() => requestAnimationFrame(() => { if (gesture === g && !g.moved && g.kind === 'press' && ptrs.has(g.id)) { g.kind = 'long'; const r = hooks.longPress && hooks.longPress(pick(p.x, p.y)); if (r && r.drag) g.kind = 'drag'; } }), 480);
    } else if (ptrs.size === 2) {
      clearTimeout(pressTimer);
      const [a, b] = [...ptrs.values()]; gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ang: Math.atan2(b.y - a.y, b.x - a.x), yaw0: yaw };
      if (hooks.claimCancel) hooks.claimCancel();
    }
  }
  function onMove(e) {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (!gesture) return;
    if (gesture.kind === 'pinch' && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      setZoom(gesture.z0 * d / gesture.d0, mx, my);
      // two-finger twist rotates the view (not in the classic 2.5D mode; a small dead zone keeps pinches from turning it)
      if (mode !== 'classic' && mode !== 'cine') { let da = Math.atan2(b.y - a.y, b.x - a.x) - gesture.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > 0.12 || gesture.twisting) { gesture.twisting = true; yawGoal = null; yaw = clamp(gesture.yaw0 + da, -YAW_MAX, YAW_MAX); hooks.rotated && hooks.rotated(yaw); } }
      const pd = screenDelta(mx - gesture.mx, my - gesture.my); panX -= pd.x; panY -= pd.y; gesture.mx = mx; gesture.my = my; if (mode !== 'focus') follow = false;
      return;
    }
    if (gesture.kind === 'drag') { hooks.dragMove && hooks.dragMove(screenToDesign(p.x, p.y)); return; }
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 9) gesture.moved = true;
    if (gesture.kind === 'ghost' && gesture.moved) { const d = screenToDesign(p.x, p.y); moveGhost(d.x, d.y, ghost.f.rot || 0); hooks.ghostMoved && hooks.ghostMoved(ghost.ok); return; }
    if (gesture.kind === 'claim') { hooks.claimMove && hooks.claimMove(screenToDesign(p.x, p.y), p, e); return; }
    if ((gesture.kind === 'press' || gesture.kind === 'pan') && gesture.moved) { gesture.kind = 'pan'; clearTimeout(pressTimer); const pd = screenDelta(dx, dy); panX -= pd.x; panY -= pd.y; follow = false; hooks.panned && hooks.panned(); }
  }
  function onUp(e) {
    const p = ptrs.get(e.pointerId); if (window.__ocInputLog) window.__ocInputLog.push(`up ${e.type} id=${e.pointerId} known=${!!p} n=${ptrs.size} g=${gesture && gesture.kind} moved=${gesture && gesture.moved}`); ptrs.delete(e.pointerId); clearTimeout(pressTimer);
    if (!gesture) return;
    if (gesture.kind === 'pinch') { if (ptrs.size === 0) gesture = null; return; }
    if (gesture.kind === 'claim') { hooks.claimUp && hooks.claimUp(p ? screenToDesign(p.x, p.y) : null, p, e); gesture = null; return; }
    if (gesture.kind === 'drag') { hooks.dragEnd && hooks.dragEnd(p ? screenToDesign(p.x, p.y) : null); gesture = null; return; }
    if (gesture.kind === 'ghost' && gesture.moved) hooks.ghostDone && hooks.ghostDone();
    if (gesture.kind === 'press' && !gesture.moved && p && e.type !== 'pointercancel') {
      const r = pick(p.x, p.y); if (window.__ocInputLog) window.__ocInputLog.push(`tap pick=${r.it ? r.it.type + ':' + (r.it.shop || r.it.id || '') : 'none'} ghost=${!!ghost}`);
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
    canvas.addEventListener('lostpointercapture', (e) => { if (ptrs.has(e.pointerId)) onUp(Object.assign({}, { pointerId: e.pointerId, type: 'pointercancel' })); });
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
    if (bbChanged) { bbRes = bbTarget(); actors.forEach(resizeActorCanvas); }
  }
  let last = 0, envCur = null, camTarget = null;
  /** move actors without rendering (the world is covered by a page) — keeps the life simulation moving */
  function tickActors(dt) { if (!area) return; for (const a of actors.slice()) updateActor(a, dt); }
  /** camera follows another actor (observe / important events); null = back to the player */
  function focus(a, z) { camTarget = a || null; if (a) { panX = panY = 0; follow = true; if (z) zoom = clamp(z, 1.15, 3.2); } }
  /** cinematic camera: ease toward an actor and a zoom (null actor = back to the player) */
  let zoomGoal = null;
  function camTo(a, z) { camTarget = a || null; panX = panY = 0; follow = true; if (z) zoomGoal = clamp(z, 1.15, 3.2); }
  function frame(now, dt) {
    if (!area) return;
    time += dt;
    const h = hourFn(), wx = weatherFn();
    // camera follows the player gently; manual pan decays back when the player moves
    const subj = (camTarget && actors.includes(camTarget) && camTarget) || (mode !== 'classic' && subject && actors.includes(subject) && subject) || actors.find((a) => a.player);
    const pl = mode === 'free' && !camTarget ? null : subj;
    if (shot) {   // scripted shot (opening / tutorial): ease to a design point
      const k = 1 - Math.exp(-dt * (shot.speed || 1.6)); camX = lerp(camX, shot.x, k); camY = lerp(camY, shot.y, k); panX = lerp(panX, 0, k); panY = lerp(panY, 0, k);
    } else if (pl) {
      const k = 1 - Math.exp(-dt * 5), lead = mode === 'follow' && pl.path && pl.path.length ? 0.35 : 0;
      const tx = pl.x + (lead && pl.path[0] ? (pl.path[0].x - pl.x) * lead : 0), ty = pl.y - 14 + (lead && pl.path[0] ? (pl.path[0].y - pl.y) * lead : 0);
      camX = lerp(camX, tx, k); camY = lerp(camY, ty, k);
      const recentre = mode === 'focus' ? 4 : 2.2;
      if (((pl.path || (pl.joy && Math.hypot(pl.joy.jx, pl.joy.jy) > 0.15)) || mode === 'focus') && !follow) { panX = lerp(panX, 0, 1 - Math.exp(-dt * recentre)); panY = lerp(panY, 0, 1 - Math.exp(-dt * recentre)); if (Math.abs(panX) + Math.abs(panY) < 1) follow = true; }
    }
    if (zoomGoal != null) { zoom = lerp(zoom, zoomGoal, 1 - Math.exp(-dt * (reduce ? 20 : 3.2))); if (Math.abs(zoom - zoomGoal) < 0.005) { zoom = zoomGoal; zoomGoal = null; } }
    if (yawGoal != null) { let d = yawGoal - yaw; yaw += d * (1 - Math.exp(-dt * (reduce ? 20 : 3))); if (Math.abs(d) < 0.002) { yaw = yawGoal; yawGoal = null; } }
    const { cx, cy } = applyCam();
    { const w = bbTarget(); if (w !== bbRes) { if (w !== bbWant) { bbWant = w; bbWantT = 0; } else if ((bbWantT += dt) > 0.35) { bbRes = w; actors.forEach(resizeActorCanvas); } } }
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
    init, resize, setQuality, loadArea, frame, tickActors, focus, camTo, actor, removeActor, setAction, poseOf, walkTo, jump, findPath, walkable, levelAt, groundY, nearestWalkable, pick,
    screenToDesign, project, setZoom, pick, spawnDrop, removeDrop, addFurniture, removeFurniture, canPlace, setGhost, moveGhost, furnRect, buildGrid,
    V3, Zof, SIN, COS, HY, CELL,
    get root() { return root; }, get camCenter() { return { x: camX + panX, y: camY + panY }; }, get actors() { return actors; }, get interacts() { return interacts; }, get drops() { return drops; }, get furn() { return furn; }, get ghost() { return ghost; }, get camTarget() { return camTarget; }, get area() { return area; }, get env() { return envCur; }, get zoom() { return zoom; }, get renderer() { return R; }, get quality() { return quality; },
    set hourFn(f) { hourFn = f; }, set weatherFn(f) { weatherFn = f; }, get hourFn() { return hourFn; }, get weatherFn() { return weatherFn; }, set reduce(v) { reduce = v; }, set hooks(h) { hooks = h; },
    recenter() { panX = 0; panY = 0; follow = true; },
    /** camera modes: classic | follow | focus | free (cine is entered by shot()) */
    setMode(m, o = {}) {
      mode = m; if (o.subject !== undefined) subject = o.subject;
      if (m === 'classic' || (area && area.room)) { yawGoal = 0; zoomGoal = clamp(o.zoom || (area && area.room ? zoom : 1.9), 1.15, 3.2); panX = panY = 0; follow = true; }
      else if (m === 'focus') { zoomGoal = clamp(o.zoom || 2.8, 1.15, 3.2); panX = panY = 0; follow = true; }
      else if (m === 'follow') { panX = panY = 0; follow = true; if (o.zoom) zoomGoal = clamp(o.zoom, 1.15, 3.2); }
      else if (m === 'free') { follow = false; }
    },
    get mode() { return mode; }, get yaw() { return yaw; }, set yaw(v) { yaw = clamp(v, -YAW_MAX, YAW_MAX); },
    rotateTo(v) { if (area && area.room) return; yawGoal = clamp(v, -YAW_MAX, YAW_MAX); },
    /** scripted shot: ease the camera to a design point / zoom / yaw (null = end, back to the current mode) */
    shot(o) { if (!o) { shot = null; panX = panY = 0; return; } shot = Object.assign({ speed: 1.6 }, o); if (o.zoom) zoomGoal = clamp(o.zoom, 1.0, 3.2); if (o.yaw != null) yawGoal = clamp(o.yaw, -YAW_MAX, YAW_MAX); if (o.instant) { camX = o.x; camY = o.y; panX = panY = 0; if (o.zoom) { zoom = clamp(o.zoom, 1.0, 3.2); zoomGoal = null; } if (o.yaw != null) { yaw = o.yaw; yawGoal = null; } } },
    /** save / restore what the player was looking at (cinematic events return exactly there) */
    saveView() { return { mode, subject, zoom, yaw, panX, panY, follow }; },
    restoreView(v) { if (!v) return; mode = v.mode; subject = v.subject; zoomGoal = v.zoom; yawGoal = v.yaw; panX = v.panX; panY = v.panY; follow = v.follow; shot = null; },
    screenDelta, screenToDesign, get bbRes() { return bbRes; },
    get root() { return root; },
    ghostSnap(n) { ghostSn = n; },
    /** obstacles / interactables added after the scene was built (forage bushes, critters…) */
    block(x, y, w, h) { area.obstacles.push({ x, y, w, h }); },
    addInteract(it) { interacts.push(it); return it; },
    stopGesture() { ptrs.clear(); gesture = null; clearTimeout(pressTimer); },
  };
})();
