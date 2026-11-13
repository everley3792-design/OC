/* OC Shimeji — 9.0 ambient life in the 3D world (OC.Ambient): butterflies by day near the OCs, small flocks of birds
 * crossing high above, fish that sometimes jump out of the sea. Cheap (a handful of shared meshes per area), only with
 * effects on, not in the rain / at night / indoors, softened with reduced motion. Purely visual: no game data changes.
 */
(function () {
  'use strict';
  const W = () => OC.World;
  let built = null, t = 0, birdT = 6, fishT = 8;
  const COLS = ['#FFD166', '#F7A1C4', '#9AD7F5', '#FFFFFF', '#C9B6FF'];

  function wingGeo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 3.2, 1.6, 0, 2.8, -1.4, 0], 3)); g.computeVertexNormals(); return g; }
  function build() {
    const root = W().root; if (!root) return null;
    const out = { root, flies: [], birds: [], fish: null, ring: null, group: new THREE.Group() };
    root.add(out.group);
    const geo = wingGeo();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshBasicMaterial({ color: COLS[i % COLS.length], side: THREE.DoubleSide, fog: false });
      const b = new THREE.Group(), l = new THREE.Mesh(geo, m), r = new THREE.Mesh(geo, m); r.scale.x = -1; b.add(l, r); b.visible = false;
      out.group.add(b); out.flies.push({ g: b, l, r, x: 0, y: 0, h: 14, tx: 0, ty: 0, ph: Math.random() * 6, life: 0 });
    }
    const bm = new THREE.MeshBasicMaterial({ color: '#3B3F4A', side: THREE.DoubleSide, fog: false, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 3; i++) { const b = new THREE.Group(), l = new THREE.Mesh(geo, bm), r = new THREE.Mesh(geo, bm); r.scale.x = -1; b.add(l, r); b.scale.setScalar(2.2); b.visible = false; out.group.add(b); out.birds.push({ g: b, l, r, off: [[0, 0], [-14, 10], [12, 12]][i] }); }
    const fm = new THREE.MeshBasicMaterial({ color: '#9FC6D9', fog: false }); const fg = new THREE.SphereGeometry(2.2, 8, 6); fg.scale(1.8, 1, 1);
    out.fish = new THREE.Mesh(fg, fm); out.fish.visible = false; out.group.add(out.fish);
    out.ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.2, 20), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false, fog: false })); out.ring.rotation.x = -Math.PI / 2; out.group.add(out.ring);
    /* 15.3: seasonal drift — petals (spring), falling leaves (autumn), snowflakes (winter); summer has none. One InstancedMesh (one draw call). */
    const SE = W().season || (OC.Clock.season ? OC.Clock.season() : 'summer');
    const DR = { spring: ['#F7B8CF', 18, 0.5], autumn: ['#E8913C', 16, 0.8], winter: ['#FFFFFF', 30, 0.35] }[SE];
    if (DR) {
      const g = SE === 'winter' ? new THREE.CircleGeometry(1.1, 6) : new THREE.PlaneGeometry(2.6, 1.6);
      const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: DR[0], side: THREE.DoubleSide, fog: false, transparent: true, opacity: 0.9, depthWrite: false }), DR[1]);
      im.frustumCulled = false; im.count = 0; out.group.add(im);
      out.drift = { im, base: DR[0], n: DR[1], fall: DR[2], season: SE, p: Array.from({ length: DR[1] }, () => ({ x: 0, y: 0, h: -1, s: Math.random() * 6, v: 0.6 + Math.random() * 0.8 })) };
    }
    /* 15.3: glints on the sea (areas with a sea level): little flat diamonds that twinkle where the water is; warm by day, silver at night */
    if (W().area && W().area.seaY != null) {
      const gg = new THREE.PlaneGeometry(4.2, 1.1); gg.rotateX(-Math.PI / 2);
      const gm = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85, depthWrite: false, fog: false });
      const im = new THREE.InstancedMesh(gg, gm, 28); im.frustumCulled = false; im.count = 0; out.group.add(im);
      out.glint = { im, p: Array.from({ length: 28 }, () => ({ x: 0, y: 0, ph: Math.random() * 6.3, sp: 1.2 + Math.random() * 1.6, ok: false })) };
    }
    return out;
  }
  function glints(dt, Wd, show, env) {
    const g = built.glint; if (!g) return;
    if (!show) { g.im.count = 0; return; }
    const c = Wd.camCenter, b = Wd.area.bounds, sea = Wd.area.seaY; g.im.count = g.p.length;
    g.im.material.color.set(env.night > 0.5 ? '#CFE0FF' : '#FFF6D8');
    g.p.forEach((q, i) => {
      q.ph += dt * q.sp;
      if (!q.ok || q.ph > 6.283) { q.ph = 0; q.ok = false; for (let k = 0; k < 6 && !q.ok; k++) { const x = c.x + (Math.random() - 0.5) * 380, y = c.y + (Math.random() - 0.5) * 560; if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && !Wd.area.walk(x, y)) { q.x = x; q.y = y; q.ok = true; } } }
      const s = q.ok ? Math.max(0, Math.sin(q.ph * 0.5)) ** 3 : 0;
      dq.position.copy(Wd.V3(q.x, q.y, 0, sea + 0.6)); dq.rotation.set(0, (Wd.yaw || 0) + 0.3, 0); dq.scale.set(s, 1, s); dq.updateMatrix(); g.im.setMatrixAt(i, dq.matrix);
    });
    g.im.instanceMatrix.needsUpdate = true;
  }
  const dq = new THREE.Object3D();
  function drift(dt, Wd, show, reduce) {
    const d = built.drift; if (!d) return;
    if (!show) { d.im.count = 0; return; }
    const c = Wd.camCenter, V3 = Wd.V3; d.im.count = d.n;
    d.p.forEach((q, i) => {
      if (q.h < 0) { q.x = c.x + (Math.random() - 0.5) * 420; q.y = c.y + (Math.random() - 0.5) * 560; q.h = 60 + Math.random() * 90; }
      const sp = reduce ? 0.4 : 1; q.h -= dt * 9 * d.fall * q.v * sp; q.s += dt * (d.season === 'winter' ? 0.8 : 2.2) * sp;
      q.x += Math.sin(q.s) * dt * 6 * sp + dt * 4 * sp;
      dq.position.copy(V3(q.x, q.y, 0, q.h)); dq.rotation.set(q.s * 0.7, q.s, q.s * 0.4); dq.updateMatrix(); d.im.setMatrixAt(i, dq.matrix);
    });
    d.im.instanceMatrix.needsUpdate = true;
  }
  function update(dt) {
    const Wd = W(); if (!Wd.area || !Wd.root) return;
    // a reloaded area has a new root group (the area definition object is reused), so compare roots
    if (!built || built.root !== Wd.root) built = build();
    if (!built) return;
    t += dt;
    const env = Wd.env || { night: 0, rain: 0 }, q = Wd.quality || {}, room = !!Wd.area.room, reduce = document.documentElement.classList.contains('reduce-motion');
    const day = !room && q.fx !== false && env.night < 0.4 && env.rain < 0.2, V3 = Wd.V3, yaw = Wd.yaw || 0;
    // butterflies: hover around the OCs, re-target now and then, wings flap
    const people = Wd.actors.filter((a) => a.char && !a.hidden);
    built.flies.forEach((f, i) => {
      const show = day && i < (q.ratio > 1.4 ? 4 : 2) && people.length; f.g.visible = !!show; if (!show) { f.life = 0; return; }
      if (f.life <= 0) { const p = people[i % people.length]; f.x = p.x + (Math.random() - 0.5) * 80; f.y = p.y + (Math.random() - 0.5) * 60; f.life = 1; }
      if (Math.hypot(f.tx - f.x, f.ty - f.y) < 4 || Math.random() < dt * 0.3) { const p = people[(i + Math.floor(t / 7)) % people.length]; f.tx = p.x + (Math.random() - 0.5) * 90; f.ty = p.y + (Math.random() - 0.5) * 70; }
      const k = Math.min(1, dt * 0.9); f.x += (f.tx - f.x) * k; f.y += (f.ty - f.y) * k;
      f.h = 16 + Math.sin(t * 2.1 + f.ph) * 5; const flap = reduce ? 0.6 : Math.sin(t * 16 + f.ph) * 1.1;
      f.l.rotation.y = flap; f.r.rotation.y = -flap;
      const lv = Wd.levelAt(f.x, f.y); f.g.position.copy(V3(f.x, f.y, lv, Wd.groundY(f.x, f.y) - lv * Wd.HY + f.h)); f.g.rotation.set(-0.5, yaw + Math.atan2(f.tx - f.x, f.ty - f.y), 0);
    });
    if (built.drift) built.drift.im.material.color.set(OC.mix(built.drift.base, '#2A3550', Math.min(0.75, (env.night || 0) * 0.8)));   /* dim at night (no glowing leaves) */
    drift(dt, Wd, !room && q.fx !== false && env.rain < 0.3, reduce);
    glints(dt, Wd, !room && q.fx !== false && env.rain < 0.5 && !reduce, env);
    // birds: a small V crosses high over the view every ~20–40 s
    birdT -= dt;
    const flock = built.birds; if (birdT < 0 && day && !reduce) { birdT = 20 + Math.random() * 20; const c = Wd.camCenter, dir = Math.random() < 0.5 ? 1 : -1; flock.st = { x: c.x - dir * 420, y: c.y - 160 - Math.random() * 120, dir, t: 0 }; }
    flock.forEach((b) => { b.g.visible = !!(flock.st && day); });
    if (flock.st) { const s = flock.st; s.t += dt; const x = s.x + s.dir * s.t * 70; flock.forEach((b, i) => { const fl = Math.sin(t * 9 + i) * 0.9; b.l.rotation.y = fl; b.r.rotation.y = -fl; b.g.position.copy(V3(x + b.off[0] * -s.dir, s.y + b.off[1], 0, 210)); b.g.rotation.set(-1.1, yaw + (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2), 0); }); if (s.t > 13) { flock.st = null; flock.forEach((b) => (b.g.visible = false)); } }
    // fish: jump from the sea (areas with a sea level), with a splash ring
    fishT -= dt; const fish = built.fish, ring = built.ring;
    if (fishT < 0 && !room && Wd.area.seaY != null && q.fx !== false) {
      fishT = 9 + Math.random() * 14; const c = Wd.camCenter;
      for (let k = 0; k < 12; k++) { const x = c.x + (Math.random() - 0.5) * 360, y = c.y + (Math.random() - 0.5) * 520; const b = Wd.area.bounds; if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1 || Wd.walkable(x, y) || Wd.area.walk(x, y)) continue; fish.st = { x, y, t: 0 }; break; }
    }
    if (fish.st) { const s = fish.st; s.t += dt; const q2 = s.t / 0.9, sea = Wd.area.seaY;
      fish.visible = q2 < 1; fish.position.copy(V3(s.x + q2 * 14, s.y, 0, sea + Math.sin(Math.min(1, q2) * Math.PI) * 18)); fish.rotation.set(0, yaw, -0.9 + q2 * 1.8);
      if (q2 > 0.95 && !s.splash) { s.splash = true; OC.Sound && OC.Sound.play('splash', { vol: 0.25 }); }
      ring.position.copy(V3(s.x + (q2 > 0.5 ? 14 : 0), s.y, 0, sea + 0.4)); const r = (s.t % 0.9) / 0.9; ring.scale.setScalar(1 + r * 2.5); ring.material.opacity = (1 - r) * 0.55;
      if (s.t > 1.8) { fish.st = null; fish.visible = false; ring.material.opacity = 0; } }
  }
  OC.Ambient = { update, get drift() { return built && built.drift ? { season: built.drift.season, count: built.drift.im.count } : null; }, get glints() { return built && built.glint ? built.glint.im.count : 0; } };
})();
