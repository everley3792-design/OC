/* OC Shimeji — reusable environment system: light rig (time of day), weather, ambient FX.
 * Time of day comes from keyframes over the 24 h clock; weather applies modifiers on top
 * (cloudy / rain / fog). The current state always eases toward the target (τ ≈ 1.6 s) so
 * changes never flash. Fog is always enabled and pushed far away in clear weather, so a
 * weather change never triggers a shader recompile. FX can be switched off by the perf mode.
 */
(function () {
  'use strict';
  const { clamp, lerp, mix } = OC;
  const C = (h) => new THREE.Color(h);

  // ---- time-of-day keyframes ----
  const KEYS = [
    { h: 0, sun: '#8C9BE0', si: 0.42, el: 40, sky: '#5E6BB8', gnd: '#2B355E', hi: 0.55, sea: '#2D4B8F', fog: '#26325C', glow: '#2A3770' },
    { h: 5, sun: '#9AA6E6', si: 0.45, el: 8, sky: '#6E79C8', gnd: '#34406A', hi: 0.6, sea: '#3A5AA0', fog: '#3A4775', glow: '#5B5EA6' },
    { h: 6.2, sun: '#FFB38A', si: 1.0, el: 12, sky: '#FFD0B8', gnd: '#6E7F78', hi: 0.85, sea: '#6FB6DA', fog: '#E9C7C0', glow: '#FFB59A' },
    { h: 8.5, sun: '#FFEBD2', si: 1.95, el: 36, sky: '#FFFFFF', gnd: '#7AA86A', hi: 1.15, sea: '#4FC3E8', fog: '#CFEAF2', glow: '#BDEBFF' },
    { h: 12.5, sun: '#FFF7EA', si: 2.25, el: 60, sky: '#FFFFFF', gnd: '#7FAE6C', hi: 1.25, sea: '#4FC3E8', fog: '#D8F0F6', glow: '#C8F0FF' },
    { h: 16.2, sun: '#FFDDB0', si: 2.05, el: 34, sky: '#FFF2E2', gnd: '#7AA86A', hi: 1.12, sea: '#55BFE2', fog: '#F2E2CC', glow: '#FFE3B8' },
    { h: 18.2, sun: '#FF9D6E', si: 1.35, el: 11, sky: '#FFB9A0', gnd: '#5E5672', hi: 0.88, sea: '#7E9FD6', fog: '#E8A898', glow: '#FF9C7A' },
    { h: 19.6, sun: '#8C9BE0', si: 0.62, el: 18, sky: '#6E79C8', gnd: '#2E3A6A', hi: 0.62, sea: '#3A4E9A', fog: '#323E70', glow: '#4A4F9A' },
    { h: 24, sun: '#8C9BE0', si: 0.42, el: 40, sky: '#5E6BB8', gnd: '#2B355E', hi: 0.55, sea: '#2D4B8F', fog: '#26325C', glow: '#2A3770' },
  ];
  const WX = {
    clear: { si: 1, hi: 1, desat: 0, dark: 0, fogNear: 4000, fogFar: 6000, clouds: 0.1, rain: 0 },
    cloudy: { si: 0.42, hi: 1.12, desat: 0.32, dark: 0.04, fogNear: 1500, fogFar: 3200, clouds: 0.2, rain: 0 },
    rain: { si: 0.24, hi: 0.92, desat: 0.48, dark: 0.16, fogNear: 1150, fogFar: 2300, clouds: 0.16, rain: 1 },
    fog: { si: 0.5, hi: 1.05, desat: 0.3, dark: 0.02, fogNear: 1020, fogFar: 1700, clouds: 0, rain: 0 },
  };
  function keyAt(h) {
    let i = 1; while (i < KEYS.length - 1 && KEYS[i].h <= h) i++;
    const a = KEYS[i - 1], b = KEYS[i], t = clamp((h - a.h) / (b.h - a.h));
    const o = {}; for (const k of Object.keys(a)) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], t) : mix(a[k], b[k], t);
    return o;
  }
  const GREY = '#9AA3AE';
  function nightness(h) { return h >= 20 || h < 5 ? 1 : h >= 18.4 ? clamp((h - 18.4) / 1.6) : h < 6.4 ? 1 - clamp((h - 5) / 1.4) : 0; }

  function texture(w, h, draw, rep) { const c = OC.makeCanvas(w, h); draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); return t; }

  /** wind-swayed instanced grass blades (sway computed in the vertex shader) */
  function windMaterial(base, uniforms, amp = 0.16) {
    const m = new THREE.MeshLambertMaterial({ color: base });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uWind = uniforms.uWind;
      sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sw = sin(uTime * 1.9 + ip.x * 0.045 + ip.z * 0.035) + 0.4 * sin(uTime * 3.3 + ip.x * 0.11);
        transformed.x += sw * transformed.y * ${amp.toFixed(3)} * uWind;
        transformed.z += cos(uTime * 1.5 + ip.z * 0.05) * transformed.y * ${(amp * 0.4).toFixed(3)} * uWind;`);
    };
    m.customProgramCacheKey = () => 'wind' + amp;
    return m;
  }

  function create(scene, opt = {}) {
    const U = { uTime: { value: 0 }, uWind: { value: 1 } };
    const hemi = new THREE.HemisphereLight('#FFFFFF', '#7AA86A', 1.2); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#FFF1DA', 2); scene.add(sun); scene.add(sun.target);
    sun.castShadow = true; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.6;
    scene.fog = new THREE.Fog('#CFEAF2', 4000, 6000);
    const cur = { ready: false };
    const fx = { clouds: null, rain: null, ripples: [], flies: null, petals: null };

    // drifting cloud shadows
    const cloudTex = texture(256, 256, (x, w, h) => { const r = OC.rng(9); for (let i = 0; i < 9; i++) { const cx = r() * w, cy = r() * h, rad = 30 + r() * 46; for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rad); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); } } }, [1.5, 1.5]);
    fx.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1800, 2400), new THREE.MeshBasicMaterial({ color: '#203048', alphaMap: cloudTex, transparent: true, opacity: 0.1, depthWrite: false, fog: false }));
    fx.clouds.rotation.x = -Math.PI / 2; fx.clouds.position.y = 140; fx.clouds.renderOrder = 10; scene.add(fx.clouds);

    // rain streaks (GPU-animated points around the focus)
    {
      const N = 900, pos = new Float32Array(N * 3), r = OC.rng(4);
      for (let i = 0; i < N; i++) { pos[i * 3] = (r() - 0.5) * 520; pos[i * 3 + 1] = r() * 260; pos[i * 3 + 2] = (r() - 0.5) * 900; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { uTime: U.uTime, uCenter: { value: new THREE.Vector3() }, uSize: { value: 18 }, uAlpha: { value: 0 } },
        vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform float uSize; varying float vA;
          void main(){ vec3 p = position; p.y = mod(p.y - uTime * 300.0, 260.0); p.x += (260.0 - p.y) * 0.18; vec4 mv = modelViewMatrix * vec4(p + uCenter, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize; vA = smoothstep(0.0, 30.0, p.y); }`,
        fragmentShader: `uniform float uAlpha; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float x = c.x + c.y * 0.18; float a = (1.0 - smoothstep(0.02, 0.07, abs(x))) * (1.0 - smoothstep(0.25, 0.5, abs(c.y))); gl_FragColor = vec4(0.92, 0.96, 1.0, a * uAlpha * vA); }`,
      });
      fx.rain = new THREE.Points(g, m); fx.rain.frustumCulled = false; fx.rain.renderOrder = 11; scene.add(fx.rain);
      const ringG = new THREE.RingGeometry(0.75, 1, 24); ringG.rotateX(-Math.PI / 2);
      for (let i = 0; i < 26; i++) { const rm = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false })); rm.visible = false; scene.add(rm); fx.ripples.push({ m: rm, ph: i / 26, x: 0, y: 0, seed: i }); }
    }
    // fireflies (night) + petals (day breeze)
    function sparkPoints(N, color, size, glow) {
      const pos = new Float32Array(N * 3), r = OC.rng(color.length * 17 + N);
      for (let i = 0; i < N; i++) { pos[i * 3] = (r() - 0.5) * 420; pos[i * 3 + 1] = 6 + r() * 40; pos[i * 3 + 2] = (r() - 0.5) * 700; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uTime: U.uTime, uCenter: { value: new THREE.Vector3() }, uSize: { value: size }, uAlpha: { value: 0 }, uCol: { value: C(color) }, uDrift: { value: glow ? 0 : 1 } },
        vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform float uSize; uniform float uDrift; varying float vT;
          void main(){ vec3 p = position; float k = p.x * 0.13 + p.z * 0.07;
            if (uDrift > 0.5) { p.x = mod(p.x + uTime * 22.0 + 210.0, 420.0) - 210.0; p.y = 8.0 + mod(p.y - uTime * 6.0, 46.0); p.z += sin(uTime * 0.8 + k) * 10.0; }
            else { p += vec3(sin(uTime * 0.7 + k) * 9.0, sin(uTime * 1.3 + k * 2.0) * 4.0, cos(uTime * 0.6 + k) * 9.0); }
            vT = 0.55 + 0.45 * sin(uTime * 2.4 + k * 5.0);
            vec4 mv = modelViewMatrix * vec4(p + uCenter, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize; }`,
        fragmentShader: `uniform float uAlpha; uniform vec3 uCol; uniform float uDrift; varying float vT; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = uDrift > 0.5 ? 1.0 - smoothstep(0.18, 0.3, length(c * vec2(1.0, 1.8))) : (1.0 - smoothstep(0.0, 0.5, d)) * vT; gl_FragColor = vec4(uCol, a * uAlpha); }`,
      });
      const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 12; scene.add(p); return p;
    }
    fx.flies = sparkPoints(40, '#FFF2A8', 14, true);
    fx.petals = sparkPoints(26, '#FFC4D6', 9, false);

    let fxOn = true;
    function setQuality(q) { fxOn = q.fx; fx.clouds.visible = q.fx; }
    function setShadows(size) {
      if (!size) { sun.castShadow = false; return; }
      sun.castShadow = true;
      if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    }

    /** per frame. o = { dt, t, hour, weather, focus:{x,z,y}, view:{w,h}, groundAt(x,z)->y|null, reduce } */
    function update(o) {
      U.uTime.value = o.t;
      const k0 = keyAt(o.hour), w = WX[o.weather] || WX.clear;
      const tgt = {
        sun: mix(mix(k0.sun, GREY, w.desat), '#30384a', w.dark), si: k0.si * w.si,
        sky: mix(k0.sky, GREY, w.desat * 0.6), gnd: mix(k0.gnd, '#4a5058', w.desat * 0.5), hi: k0.hi * w.hi * (1 - w.dark * 0.5),
        sea: mix(mix(k0.sea, '#7A98A8', w.desat * 0.8), '#203040', w.dark), fog: o.weather === 'fog' ? mix(k0.fog, '#E8EEF2', 0.5 * (1 - nightness(o.hour))) : mix(k0.fog, GREY, w.desat * 0.5),
        glow: mix(k0.glow, GREY, w.desat), el: k0.el, fogNear: w.fogNear, fogFar: w.fogFar, clouds: w.clouds * (1 - nightness(o.hour) * 0.75),
        rain: w.rain, night: nightness(o.hour), wind: o.weather === 'rain' ? 1.7 : o.weather === 'cloudy' ? 1.25 : o.weather === 'fog' ? 0.4 : 1,
      };
      if (!cur.ready) { Object.assign(cur, tgt); cur.ready = true; }
      const a = o.instant ? 1 : 1 - Math.exp(-o.dt / 1.6);
      for (const k of Object.keys(tgt)) cur[k] = typeof tgt[k] === 'number' ? lerp(cur[k], tgt[k], a) : mix(cur[k], tgt[k], a);
      // light rig — sun arcs east→west across the day, shadows fall back/right so faces stay lit
      const h = o.hour, az = ((h - 6) / 12) * Math.PI, el = (cur.el * Math.PI) / 180;
      const dir = new THREE.Vector3(-Math.cos(az) * 0.8 - 0.25, Math.sin(el) * 1.4 + 0.25, 0.9).normalize();
      const F = new THREE.Vector3(o.focus.x, o.focus.y || 0, o.focus.z);
      sun.position.copy(F).addScaledVector(dir, 700); sun.target.position.copy(F);
      const half = Math.max(o.view.w, o.view.h) * 0.62 + 60;
      const sc = sun.shadow.camera; if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 50; sc.far = 1600; sc.updateProjectionMatrix(); }
      // snap to shadow texels to avoid shimmering while the camera pans
      const texel = (2 * half) / (sun.shadow.mapSize.x || 1024);
      sun.target.position.x = Math.round(sun.target.position.x / texel) * texel; sun.target.position.z = Math.round(sun.target.position.z / texel) * texel;
      sun.position.copy(sun.target.position).addScaledVector(dir, 700);
      sun.color.set(cur.sun); sun.intensity = cur.si;
      hemi.color.set(cur.sky); hemi.groundColor.set(cur.gnd); hemi.intensity = cur.hi;
      scene.fog.color.set(cur.fog); scene.fog.near = cur.fogNear; scene.fog.far = cur.fogFar;
      U.uWind.value = o.reduce ? 0.3 : cur.wind;
      // FX
      const fxk = fxOn && !o.reduce;
      fx.clouds.visible = fxOn && cur.clouds > 0.01; fx.clouds.material.opacity = cur.clouds; const cm = fx.clouds.material.alphaMap; cm.offset.x = (o.t * 0.004 * cur.wind) % 1; cm.offset.y = (o.t * 0.0025) % 1;
      fx.clouds.position.x = F.x; fx.clouds.position.z = F.z;
      fx.rain.visible = fxk && cur.rain > 0.02; fx.rain.material.uniforms.uAlpha.value = cur.rain * 0.75; fx.rain.material.uniforms.uCenter.value.set(F.x, F.y || 0, F.z); fx.rain.material.uniforms.uSize.value = o.pxScale * 14;
      fx.ripples.forEach((r) => {
        r.m.visible = fxk && cur.rain > 0.05; if (!r.m.visible) return;
        const q = (o.t * 0.9 + r.ph) % 1;
        if (q < r.last || r.last === undefined) { const rr = OC.hash(r.seed * 31.7 + Math.floor(o.t * 0.9 + r.ph) * 1.13), rz = OC.hash(r.seed * 7.1 + Math.floor(o.t * 0.9 + r.ph) * 3.7); r.x = F.x + (rr - 0.5) * o.view.w * 1.1; r.z = F.z + (rz - 0.5) * o.view.h * 1.2; r.y = o.groundAt ? o.groundAt(r.x, r.z) : 0; }
        r.last = q; if (r.y == null) { r.m.visible = false; return; }
        r.m.position.set(r.x, r.y + 0.4, r.z); r.m.scale.setScalar(1 + q * 6); r.m.material.opacity = (1 - q) * 0.55 * cur.rain;
      });
      fx.flies.visible = fxk && cur.night > 0.4 && cur.rain < 0.3; const fu = fx.flies.material.uniforms; fu.uAlpha.value = clamp((cur.night - 0.4) / 0.4) * (1 - cur.rain); fu.uCenter.value.set(F.x, F.y || 0, F.z); fu.uSize.value = o.pxScale * 7;
      fx.petals.visible = fxk && cur.night < 0.5 && cur.rain < 0.2 && o.weather !== 'fog'; const pu = fx.petals.material.uniforms; pu.uAlpha.value = 0.85 * (1 - cur.night * 2); pu.uCenter.value.set(F.x, F.y || 0, F.z); pu.uSize.value = o.pxScale * 4.5;
      return cur;
    }
    return { U, sun, hemi, cur, fx, update, setQuality, setShadows, windMaterial: (c, amp) => windMaterial(c, U, amp), texture };
  }

  OC.Env = { create, keyAt, nightness, texture, KEYS, WX };
})();
