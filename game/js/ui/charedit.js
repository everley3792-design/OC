/* OC Shimeji — character editing building blocks (used by the creator flow AND the editor page,
 * so there is a single implementation):
 *   stage()      live preview that blinks / breathes / reacts; drag to turn the OC; with a part
 *                selected: drag = move, two fingers = scale + rotate (rig units, anchored)
 *   sections     template, body, face, earsTail, colors, outfit, parts, expressions,
 *                profile, personality, traits, quirks, tastes, speech, anims
 * Every section edits a *draft* character; the caller decides when to save.
 */
(function () {
  'use strict';
  const { h, icon, toast, seg, toggle, haptic, sheet } = OC.UI;
  const Ch = () => OC.Chars, Rig = () => OC.Rig, Sty = () => OC.Style;
  const T = (t, small) => h('div.section-title', null, t, small ? h('small', null, small) : null);

  // ============================== stage ==============================
  function stage(getChar, o = {}) {
    const px = o.size || 300, cv = h('canvas', { width: px * 2, height: px * 2, 'aria-label': '角色預覽' });
    Object.assign(cv.style, { width: '100%', maxWidth: px + 'px', aspectRatio: '1', display: 'block', margin: '0 auto', touchAction: 'none' });
    const el = h('div.portrait', { style: { height: 'auto', padding: '6px 0', position: 'relative' } }, cv);
    const st = { react: null, walk: false, t0: performance.now(), blinkAt: 0, face: 0.15, selected: null, dirDemo: null, theta: 0.15, omega: 0, look: null, fidgetAt: performance.now() + 4500, lastNow: performance.now() };
    const ctx = cv.getContext('2d');
    let unit = 1, feetY = 0;
    function pose(now) {
      const t = (now - st.t0) / 1000, dt = Math.min(0.1, (now - st.lastNow) / 1000); st.lastNow = now; if (now > st.blinkAt + 130) st.blinkAt = now + 2200 + Math.random() * 2400;
      // 11.0 turntable: the whole turn (front → side → back) with inertia; a spin you flick keeps going and settles
      if (!st.dragging && Math.abs(st.omega) > 0.01) { st.theta += st.omega * dt; st.omega *= Math.exp(-dt * 2.6); } else if (!st.dragging) st.omega = 0;
      const th = st.theta, fcs = Math.sin(th), bk = Math.max(0, Math.min(1, -Math.cos(th) * 1.4));
      st.face = fcs;
      const p = { action: 'idle', at: t, face: fcs, back: bk, blink: now > st.blinkAt ? 1 : 0, breath: Math.sin(now / 600), dir: bk > 0.5 ? 'back' : fcs > 0.55 ? 'right' : fcs < -0.55 ? 'left' : 'front', noShadow: false };
      // the eyes follow the finger / pointer
      if (st.look && now - st.look.t < 1800 && bk < 0.5) { p.lookX = Math.max(-1, Math.min(1, st.look.x)); p.overrides = Object.assign({ lookY: Math.max(-1, Math.min(1, st.look.y)) }, p.overrides || {}); }
      // now and then it does something by itself (mood / personality; only while nothing else is playing)
      if (!st.react && !st.walk && !st.dragging && now > st.fidgetAt && OC.Anim11) { st.fidgetAt = now + 5000 + Math.random() * 5000; const c = getChar(), f = c ? OC.Anim11.fidget(c) : null;   /* 13.0: picture characters perform too (OC.Puppet) */ if (f) st.react = { action: f.action, t0: now, until: now + f.dur * 1000 }; }
      if (st.walk) { p.walk = 1; p.phase = t * 4; p.action = 'walk'; p.face = Math.sin(t * 0.6) * 0.9; p.dir = p.face > 0.5 ? 'right' : p.face < -0.5 ? 'left' : 'front'; }
      if (st.react && now < st.react.until) { p.action = st.react.action; p.at = (now - st.react.t0) / 1000; Object.assign(p, st.react.extra || {}); }
      else st.react = null;
      return p;
    }
    function frame(now) {
      if (!cv.isConnected) { st.raf = 0; return; }
      st.raf = requestAnimationFrame(frame);
      if (cv.offsetParent === null) return;
      const c = getChar(); if (!c) return;
      const W = cv.width, H = cv.height; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      const ht = c.appearance.mode === 'sprite' ? 62 : Rig().height(c.look) + 6;
      unit = Math.min((H * 0.86) / ht, W / 52); feetY = H * 0.93;
      const p = pose(now);
      drawPlatform(W, H, st.theta);
      OC.CharRender.draw(ctx, c, p, W / 2, feetY, unit, p.at);
      if (st.selected) drawSel(c);
    }
    /** a little round stage under the feet with a notch that turns with the character (so the turntable reads even from the front) */
    function drawPlatform(W, H, th) {
      if (o.platform === false) return; const cx = W / 2, cy = H * 0.935, rx = W * 0.34, ry = rx * 0.2;
      ctx.save(); const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.6, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(115,120,240,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2); ctx.stroke();
      const nx = cx + Math.sin(th) * rx * 0.86, ny = cy + Math.cos(th) * ry * 0.86; ctx.fillStyle = 'rgba(115,120,240,.75)'; ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    function drawSel(c) {
      const part = (c.parts || []).find((q) => q.id === st.selected); if (!part) return;
      const [ax, ay] = Rig().anchorPos(c.look, part.anchor);
      const fx = part.anchor === 'face' ? st.face * 6.5 : 0;
      const X = cv.width / 2 + (ax + fx + (part.x || 0)) * unit, Y = feetY + (ay + (part.y || 0)) * unit, s = 12 * (part.scale || 1) * unit;
      ctx.save(); ctx.translate(X, Y); ctx.rotate(((part.rot || 0) * Math.PI) / 180); ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.strokeStyle = '#F26B5B'; ctx.strokeRect(-s, -s, s * 2, s * 2); ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    // gestures
    const ptr = new Map(); let g = null;
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); st.omega = 0; ptr.set(e.pointerId, [e.clientX, e.clientY]); const pts = [...ptr.values()];
      g = pts.length === 2 ? { kind: 'pinch', d0: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]), a0: Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]), part: snapshot() } : { kind: 'drag', x0: e.clientX, y0: e.clientY, moved: false, part: snapshot(), face0: st.face, th0: st.theta }; });
    cv.addEventListener('pointermove', (e) => {
      if (!ptr.has(e.pointerId) || !g) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
      const r = cv.getBoundingClientRect(), k = cv.width / r.width / unit, c = getChar(), part = c && st.selected && c.parts.find((q) => q.id === st.selected);
      if (g.kind === 'pinch' && ptr.size === 2 && part) { const pts = [...ptr.values()], d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]), a = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]); part.scale = Math.max(0.1, Math.min(6, g.part.scale * d / g.d0)); part.rot = Math.round(g.part.rot + ((a - g.a0) * 180) / Math.PI); o.onPart && o.onPart(part, true); return; }
      if (g.kind !== 'drag') return;
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0; if (Math.hypot(dx, dy) > 6) g.moved = true;
      if (part) { part.x = Math.round((g.part.x + dx * k) * 10) / 10; part.y = Math.round((g.part.y + dy * k) * 10) / 10; o.onPart && o.onPart(part, true); }
      else { st.dragging = true; const now = performance.now(), nt = g.th0 + dx / 85; if (g.lastT) st.omega = (nt - st.theta) / Math.max(0.008, (now - g.lastT) / 1000) * 0.6 + st.omega * 0.4; g.lastT = now; st.theta = nt; }
    });
    const up = (e) => { ptr.delete(e.pointerId); if (!g) return; const c = getChar(), part = c && st.selected && c.parts.find((q) => q.id === st.selected);
      st.dragging = false; if (st.omega > 14) st.omega = 14; if (st.omega < -14) st.omega = -14;
      if (g.kind === 'drag' && !g.moved && !part) tapZone(e); if (part && (g.moved || g.kind === 'pinch')) o.onPart && o.onPart(part, false); if (!ptr.size) g = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); st.look = { x: ((e.clientX - r.left) / r.width - 0.5) * 2.4, y: ((e.clientY - r.top) / r.height - 0.35) * 2, t: performance.now() }; });
    /** which part of the character was tapped → a matching reaction (and the creator jumps to that part's options) */
    function tapZone(e) {
      const r = cv.getBoundingClientRect(), c = getChar(); if (!c) return;
      const X = (e.clientX - r.left) / r.width * cv.width, Y = (e.clientY - r.top) / r.height * cv.height, ht = (c.appearance.mode === 'sprite' ? 62 : Rig().height(c.look) + 6) * unit;
      const fr = (feetY - Y) / ht, dx = (X - cv.width / 2) / ht; let z = 'body';
      if (fr > 0.9 && Math.abs(dx) > 0.14) z = 'ears'; else if (fr > 0.5) z = 'head'; else if (fr < 0.14) z = 'feet'; else if (Math.abs(dx) > 0.38) z = 'tail';
      const R = { ears: ['ticklish', 1.0], head: ['giggle', 1.0], body: ['poked', 0.9], feet: ['stomp', 0.9], tail: ['startle', 0.9] }[z];
      react(R[0], R[1]); OC.UI.haptic('tick'); OC.Sound && OC.Sound.play('poke'); o.onZone && o.onZone(z);
    }
    function snapshot() { const c = getChar(), p = c && st.selected && c.parts.find((q) => q.id === st.selected); return p ? { x: p.x || 0, y: p.y || 0, scale: p.scale || 1, rot: p.rot || 0 } : null; }
    function react(action, dur = 1.2, extra) { st.react = { action, t0: performance.now(), until: performance.now() + dur * 1000, extra }; }
    st.raf = requestAnimationFrame(frame);
    return { el, canvas: cv, react, set walk(v) { st.walk = v; }, get walk() { return st.walk; }, select(id) { st.selected = id; }, turn(f) { st.theta = Math.asin(Math.max(-1, Math.min(1, f))); st.omega = 0; }, spin(turns = 1) { st.omega = 6.5 * turns; }, restart() { if (!st.raf) st.raf = requestAnimationFrame(frame); } };
  }

  // ============================== helpers ==============================
  function tiles(list, value, onPick, draw, cols = 3) {
    const g = h(`div.grid.c${cols}`);
    list.forEach(([v, label]) => { const t = h('button.tile', { 'data-v': v, 'aria-pressed': v === value, on: { click: () => { haptic(); [...g.children].forEach((b) => { b.classList.toggle('on', b.dataset.v === String(v)); b.setAttribute('aria-pressed', b.dataset.v === String(v)); }); onPick(v); } } }, draw ? draw(v) : null, label); t.classList.toggle('on', String(v) === String(value)); g.append(t); });
    return g;
  }
  /** mini portrait of a look variant (for option tiles) */
  function mini(c, patch, pose) { const cv = h('canvas', { width: 128, height: 128 }); const k = Ch().clone(c); Object.assign(k.look, patch || {}); k.appearance = Object.assign({}, k.appearance, { mode: 'rig' }); k.actions = {}; OC.CharRender.portrait(cv, k, { pose: Object.assign({ mouth: 'smile' }, pose || {}) }); return cv; }
  const num = (label, value, min, max, step, fn, fmt) => OC.UI.slider({ zh: label }, value, fn, { min, max, step, fmt: fmt || ((v) => (+v).toFixed(step < 1 ? 2 : 0)) });

  // ============================== appearance sections ==============================
  const RANDOM = {
    fur: () => pickOne(['#FFF7EC', '#F6E3C8', '#E7A86A', '#C98E62', '#8E6A54', '#B9B8F0', '#BFE3C8', '#FFD1DC', '#CFE6F5', '#6F6A7E', '#F2C14E', '#FFFFFF', '#D7C2F7', '#FFB38A']),
  };
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function randomize(c, level) {
    const L = c.look, R = Rig();
    L.fur = RANDOM.fur(); L.ears = pickOne(Sty().EARS)[0]; L.tail = pickOne(Sty().TAILS)[0]; L.eye = pickOne(Sty().EYES); L.cheek = pickOne(Sty().CHEEKS);
    L.inner = pickOne(['#FFB8B0', '#FFD0B0', '#FFC4DD', '#F7E3A8']); L.shirt = pickOne(Sty().SHIRTS); L.pattern = pickOne(['none', 'stripe']);
    L.eyeStyle = pickOne(R.EYE_STYLES)[0]; L.mouthStyle = pickOne(R.MOUTH_STYLES.slice(0, 4))[0]; L.cheekStyle = pickOne(R.CHEEK_STYLES.slice(0, 3))[0];
    L.furPattern = Math.random() < 0.45 ? pickOne(R.FUR_PATTERNS)[0] : 'none'; L.patternCol = OC.mix(L.fur, '#5a3a20', 0.35);
    if (level === 'detailed') { L.headSize = +(0.9 + Math.random() * 0.25).toFixed(2); L.bodyW = +(0.85 + Math.random() * 0.35).toFixed(2); L.legLen = +(0.8 + Math.random() * 0.5).toFixed(2); L.eyeSize = +(0.85 + Math.random() * 0.4).toFixed(2); L.eyeGap = +(Math.random() * 2 - 1).toFixed(1); }
  }
  /** 9.0 personality quiz: each answer nudges sliders and may suggest a trait; the preview OC reacts to every answer */
  const QUIZ = [
    { q: '放假的早上，你的 OC 會……', a: [['一早就出門找朋友玩', { energy: 18, social: 18, pace: 10 }, 'extrovert', 'cheer'], ['賴在床上看書', { energy: -15, thinking: 12, social: -10 }, 'bookworm', 'sit'], ['去森林裡探險', { energy: 10, thinking: 6 }, 'curious', 'jump'], ['睡到中午', { energy: -22, pace: -15 }, 'sleepy', 'yawn']] },
    { q: '朋友送了一份禮物，牠會……', a: [['大叫「好開心！」抱住對方', { expression: 22, social: 10 }, 'energetic', 'happy'], ['臉紅說謝謝', { expression: -10 }, 'shy', 'shy'], ['冷靜地點頭，偷偷收好', { expression: -18, speech: -10 }, null, 'nod'], ['馬上拆開研究', { thinking: 15 }, 'curious', 'surprised']] },
    { q: '遇到第一次見面的人……', a: [['主動打招呼', { social: 20, speech: 10 }, 'outgoing', 'greet'], ['躲在朋友後面', { social: -20 }, 'shy', 'shy'], ['先觀察一下', { thinking: 12, social: -6 }, 'introvert', 'think'], ['講個笑話破冰', { social: 12, expression: 12 }, 'humorous', 'laugh']] },
    { q: '房間平常是……', a: [['整整齊齊，東西都有位置', { thinking: 8, pace: 5 }, 'tidy', 'proud'], ['有點亂但找得到', { pace: -5 }, null, 'idle'], ['堆滿畫和收藏', { expression: 10 }, 'artsy', 'happy'], ['到處是吃的', { energy: 5 }, 'foodie', 'eat']] },
    { q: '晚上十二點，牠通常在……', a: [['早就睡了，明天要早起', { energy: 5, pace: 8 }, 'earlybird', 'sleep'], ['精神正好！', { energy: 10 }, 'nightowl', 'cheer'], ['看星星發呆', { thinking: 10, expression: -5 }, 'dreamy', 'think'], ['跟朋友聊天', { social: 15 }, 'extrovert', 'talk']] },
  ];
  function quiz(c, x) {
    const P = c.personality; let i = 0; const picks = [];
    sheet('認識你的 OC', (b, api) => {
      const draw = () => {
        if (i >= QUIZ.length) {
          const traits = [...new Set(picks.filter(Boolean))].filter((t, k, arr) => !(t === 'extrovert' && arr.includes('outgoing'))).filter((t) => !Ch().TRAITS.find((d) => d.id === t && (d.x || []).some((y) => P.traits.includes(y))));
          b.replaceChildren(h('h3', null, '完成！'), h('p.muted', null, `${Ch().typeTitle(c)}。建議的特質：${traits.map((t) => (Ch().TRAITS.find((d) => d.id === t) || {}).zh).filter(Boolean).join('、') || '（沒有）'}`),
            h('button.btn.primary.block', { on: { click: () => { for (const t of traits) if (!P.traits.includes(t) && P.traits.length < 5) P.traits.push(t); api.close(); x.changed('personality', 'cheer'); x.rebuild(); } } }, '加上這些特質'),
            h('button.btn.ghost.block', { style: { marginTop: '6px' }, on: { click: () => { api.close(); x.rebuild(); } } }, '只保留滑桿'));
          return;
        }
        const Q = QUIZ[i];
        b.replaceChildren(h('small.muted', null, `${i + 1} / ${QUIZ.length}`), h('h3', { style: { margin: '6px 0 12px' } }, Q.q),
          ...Q.a.map(([label, d, trait, act]) => h('button.btn.block', { style: { marginTop: '8px', justifyContent: 'flex-start' }, on: { click: () => {
            for (const [k, v] of Object.entries(d)) P[k] = Math.max(0, Math.min(100, (P[k] == null ? 50 : P[k]) + v));
            picks.push(trait); x.changed('personality', act); haptic('tick'); i++; draw();
          } } }, label)));
      };
      draw();
    });
  }

  const S_ = {
    template(c, x) {
      const box = h('div');
      box.append(T('從範本開始', '可再自由修改'), tiles(Object.entries(Sty().PRESETS).map(([k, v]) => [k, v.name]), null, (k) => { const keep = Ch().clone({ profile: c.profile, personality: c.personality, quirks: c.quirks, speech: c.speech, parts: c.parts, actions: c.actions }); Object.assign(c.look, Ch().clone(Ch().fromPreset(k).look)); Object.assign(c, keep); x.changed('look', 'happy'); x.rebuild(); }, (k) => mini(Ch().fromPreset(k))));
      box.append(T('種族'), seg(Ch().SPECIES.slice(0, 4), c.profile.species, (v) => { c.profile.species = v; if (v === 'bunny') c.look.ears = 'bunny'; if (v === 'bear') c.look.ears = 'bear'; if (v === 'cat') c.look.ears = 'cat'; x.changed('look', 'surprised'); x.rebuild(); }));
      box.append(h('button.btn.block', { style: { marginTop: '12px' }, on: { click: () => { randomize(c, x.level); x.changed('look', 'surprised'); x.rebuild(); } } }, icon('dice', 's'), '隨機搭配'));
      return box;
    },
    /** 13.0: framing of a picture character — flip, turning with the walking direction, zoom, position, crop.
     *  Applied when the picture is drawn; the original file is never changed, so everything here can be undone. */
    image(c, x) {
      if (c.appearance.mode !== 'sprite') return null;
      const F = () => { const f = (c.appearance.frame = Object.assign({ flip: false, zoom: 1, dx: 0, dy: 0, faces: 'right' }, c.appearance.frame || {})); f.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, f.crop || {}); return f; };
      const set = (k) => (v, live) => { F()[k] = v; x.changed('look', live ? null : 'idle'); };
      const crop = (k) => (v, live) => { F().crop[k] = v / 100; x.changed('look', live ? null : 'idle'); };
      const pct = (v) => Math.round(v) + '%', box = h('div', { 'data-sec': 'image' });
      const build = () => {
        const fr = F();
        box.replaceChildren(T('調整圖片', '原圖不會被改動，隨時可以重設'),
          h('div.hstack', { style: { marginBottom: '8px' } }, h('span.grow', null, '左右翻轉'), toggle(!!fr.flip, (v) => { F().flip = v; x.changed('look'); })),
          h('div.hstack', null, h('span.grow', null, '走路時跟著左右轉向'), toggle(fr.faces !== 'front', (v) => { F().faces = v ? 'right' : 'front'; x.changed('look'); })),
          h('div.faint', { style: { fontSize: 'var(--fs-xs)', margin: '2px 0 10px' } }, '開啟時，請讓圖裡的角色面向右邊——方向不對就按「左右翻轉」。正面的圖可以關掉，就不會被鏡像。'),
          num('放大縮小', fr.zoom, 0.4, 2.5, 0.01, set('zoom'), (v) => Math.round(v * 100) + '%'), num('水平位置', fr.dx, -50, 50, 1, set('dx')), num('垂直位置', fr.dy, -50, 50, 1, set('dy')),
          T('裁切', '從四邊往內裁掉不要的部分'),
          num('上', fr.crop.t * 100, 0, 45, 1, crop('t'), pct), num('下', fr.crop.b * 100, 0, 45, 1, crop('b'), pct), num('左', fr.crop.l * 100, 0, 45, 1, crop('l'), pct), num('右', fr.crop.r * 100, 0, 45, 1, crop('r'), pct),
          h('button.btn.s.ghost', { style: { marginTop: '6px' }, on: { click: () => { c.appearance.frame = null; x.changed('look'); build(); } } }, '全部重設'),
          h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '8px' } }, '還沒畫的動作（走路、吃飯、睡覺、開心…）圖片會自己表演：搖擺、彈跳，加上愛心、Zzz、碎屑等特效。之後在動畫工作室畫了某個動作，就改播你畫的。'));
      };
      build(); return box;
    },
    body(c, x) {
      const L = c.look, ch = (k) => (v, live) => { L[k] = v; x.changed('look', live ? null : 'idle'); };
      const pix = c.appearance.mode === 'sprite' ? h('div', { style: { marginBottom: '8px' } }, h('div.hstack', null, h('span.grow', null, '像素風（保持銳利邊緣）'), toggle(!!c.appearance.pixel, (v) => { c.appearance.pixel = v; x.changed('look'); })),
        h('div.faint', { style: { fontSize: 'var(--fs-xs)' } }, '點陣圖角色開啟後縮放不會變模糊；一般插畫保持關閉（平滑縮放）。原始圖片永遠保留，不會被壓縮覆蓋。')) : null;
      return h('div', null, pix, T('比例與體型'), num('頭部大小', L.headSize, 0.75, 1.3, 0.01, ch('headSize')), num('身體寬度', L.bodyW, 0.75, 1.4, 0.01, ch('bodyW')), num('身體長度', L.bodyH, 0.75, 1.4, 0.01, ch('bodyH')), num('腿長', L.legLen, 0.6, 1.7, 0.01, ch('legLen')),
        num('耳朵大小', L.earSize, 0.6, 1.5, 0.01, ch('earSize')), num('尾巴大小', L.tailSize, 0.5, 1.6, 0.01, ch('tailSize')), num('整體身高', c.appearance.scale || 1, 0.8, 1.3, 0.01, (v, live) => { c.appearance.scale = v; x.changed('look', live ? null : 'idle'); }));
    },
    face(c, x) {
      const L = c.look, R = Rig(), ch = (k, r) => (v, live) => { L[k] = v; x.changed('look', live ? null : r); };
      const box = h('div', null, T('眼睛'), tiles(R.EYE_STYLES, L.eyeStyle, (v) => { L.eyeStyle = v; x.changed('look', 'idle'); }, (v) => mini(c, { eyeStyle: v }, { face: 0 })));
      if (x.level === 'detailed') box.append(num('眼睛大小', L.eyeSize, 0.6, 1.5, 0.01, ch('eyeSize')), num('眼距', L.eyeGap, -3, 3, 0.1, ch('eyeGap')), num('眼睛高度', L.eyeY, -4, 4, 0.1, ch('eyeY')), num('眼角角度', L.eyeRot, -0.5, 0.5, 0.01, ch('eyeRot')));
      box.append(T('眉毛'), seg(R.BROW_STYLES, L.browStyle, (v) => { L.browStyle = v; x.changed('look', 'angry'); }));
      if (x.level === 'detailed') box.append(num('眉毛高度', L.browY, -3, 3, 0.1, ch('browY')));
      box.append(T('嘴巴'), tiles(R.MOUTH_STYLES, L.mouthStyle, (v) => { L.mouthStyle = v; c.quirks.face = v; x.changed('look', 'idle'); }, (v) => mini(c, { mouthStyle: v }, { face: 0, mouth: v })));
      if (x.level === 'detailed') box.append(num('嘴巴位置', L.mouthY, -3, 4, 0.1, ch('mouthY')), num('嘴巴大小', L.mouthSize, 0.6, 1.6, 0.01, ch('mouthSize')));
      box.append(T('鼻子'), seg(R.NOSE_STYLES, L.noseStyle, (v) => { L.noseStyle = v; x.changed('look'); }), T('臉頰'), seg(R.CHEEK_STYLES, L.cheekStyle, (v) => { L.cheekStyle = v; x.changed('look', 'shy'); }));
      if (x.level === 'detailed') box.append(num('腮紅大小', L.cheekSize, 0.5, 1.6, 0.01, ch('cheekSize')));
      return box;
    },
    earsTail(c, x) {
      const L = c.look;
      return h('div', null, T('耳朵'), tiles(Sty().EARS, L.ears, (v) => { L.ears = v; x.changed('look', 'surprised'); }, (v) => mini(c, { ears: v })), T('尾巴'), seg([...Sty().TAILS, ['none', '沒有']], L.tail, (v) => { L.tail = v; x.changed('look', 'happy'); x.stage.turn(-0.8); }));
    },
    colors(c, x) {
      const L = c.look, R = Rig(), cf = (label, k, r) => OC.UI.colorField(label, L[k], (v, live) => { L[k] = v; x.changed('look', live ? null : r); });
      const box = h('div', null, T('顏色', '色環・HEX・最近使用・收藏'), h('div.list', null, cf('毛色', 'fur', 'happy'), cf('耳朵內側', 'inner'), cf('眼睛', 'eye', 'idle'), cf('腮紅', 'cheek', 'shy')));
      box.append(T('花紋'), tiles(R.FUR_PATTERNS, L.furPattern, (v) => { L.furPattern = v; x.changed('look', 'happy'); }, (v) => mini(c, { furPattern: v })), h('div.list', { style: { marginTop: '10px' } }, cf('花紋顏色', 'patternCol')));
      return box;
    },
    outfit(c, x) {
      const L = c.look, owned = (slot) => OC.Game.wearOptions(slot);
      const opt = (slot, list) => tiles(list.map(([v, l]) => [v, owned(slot).includes(v) ? l : `🔒${l}`]), L[slot], (v) => { if (!owned(slot).includes(v)) { toast('可以在晴日雜貨攤買到，或在「部件」放上自己畫的服裝', 'cart'); return; } L[slot] = v; x.changed('look', 'happy'); }, null, 4);
      return h('div', null, T('上衣', '沒有衣服也可以'), OC.UI.colorField('上衣顏色', L.shirt === 'none' ? '#FFFFFF' : L.shirt, (v, live) => { L.shirt = v; x.changed('look', live ? null : 'happy'); }), h('button.btn.s.ghost', { style: { margin: '6px 0' }, on: { click: () => { L.shirt = 'none'; x.changed('look', 'surprised'); } } }, '不穿上衣'),
        T('圖案'), opt('pattern', Sty().PATTERNS), T('配件'), opt('acc', Sty().ACCS), OC.UI.colorField('配件顏色', L.accCol, (v, live) => { L.accCol = v; x.changed('look', live ? null : 'happy'); }), T('髮夾'), opt('clip', Sty().CLIPS));
    },
    /** custom parts: player images on anchors, with full transform editing */
    parts(c, x) {
      const box = h('div'), R = Rig();
      const list = h('div.list'), editor = h('div');
      const sel = () => c.parts.find((p) => p.id === x.selected);
      function renderList() {
        list.replaceChildren(...(c.parts.length ? c.parts.map((p, i) => {
          const im = h('img', { style: { width: '40px', height: '40px', objectFit: 'contain', borderRadius: '10px', background: 'var(--surface-2)' } }); OC.Assets.thumbURL(p.assetId).then((u) => (im.src = u || ''));
          const r = OC.UI.row(im, (R.SLOTS.find((s) => s[0] === p.slot) || [0, p.slot])[1], `${(R.ANCHORS.find((a) => a[0] === p.anchor) || [0, p.anchor])[1]}・${{ back: '最後面', body: '身體層', head: '頭部層', face: '臉部層', front: '最前面' }[p.z] || ''}${p.visible === false ? '・隱藏' : ''}${OC.Assets.has(p.assetId) ? '' : '・⚠ 素材遺失'}`, x.selected === p.id ? icon('check') : null, () => { x.selected = x.selected === p.id ? null : p.id; x.stage.select(x.selected); renderList(); renderEditor(); });
          return r;
        }) : [h('div.empty', null, '還沒有自訂部件。可以從素材庫選圖、匯入，或到工坊畫一個。')]));
      }
      function renderEditor() {
        const p = sel(); editor.replaceChildren(); if (!p) return;
        const ch = (k) => (v, live) => { p[k] = v; x.changed('parts', null, live); };
        editor.append(h('div.card', { style: { marginTop: '10px' } },
          h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '在預覽上拖曳移動，雙指縮放／旋轉；或用下方滑桿微調。'),
          h('div.hstack', { style: { margin: '8px 0', flexWrap: 'wrap' } }, h('span.muted', null, '位置'), seg(R.ANCHORS, p.anchor, (v) => { p.anchor = v; p.x = 0; p.y = 0; x.changed('parts'); })),
          num('左右', p.x || 0, -40, 40, 0.1, ch('x')), num('上下', p.y || 0, -60, 40, 0.1, ch('y')), num('大小', p.scale || 1, 0.1, 5, 0.01, ch('scale')), num('旋轉', p.rot || 0, -180, 180, 1, ch('rot'), (v) => `${Math.round(v)}°`), num('透明度', p.opacity == null ? 1 : p.opacity, 0.1, 1, 0.01, ch('opacity')),
          h('div.muted', { style: { marginTop: '8px' } }, '圖層'), seg([['back', '最後面'], ['body', '身體'], ['head', '頭'], ['face', '臉'], ['front', '最前面']], p.z || 'front', (v) => { p.z = v; x.changed('parts'); }),
          h('div.hstack', { style: { marginTop: '10px', flexWrap: 'wrap' } },
            h('button.btn.s', { on: { click: () => { p.flip = !p.flip; x.changed('parts'); } } }, icon('rotate', 's'), '左右翻轉'),
            R.REPLACE.has(p.slot) ? h('button.btn.s', { on: { click: () => { p.mirror = p.mirror === false; x.changed('parts'); toast(p.mirror === false ? '另一側不鏡像' : '另一側自動鏡像', 'info'); } } }, '鏡像另一側') : null,
            h('button.btn.s', { on: { click: () => { p.x = 0; x.changed('parts'); x.rebuild(); } } }, '水平置中'),
            h('button.btn.s', { on: { click: () => { const i = c.parts.indexOf(p); if (i < c.parts.length - 1) { c.parts.splice(i, 1); c.parts.splice(i + 1, 0, p); x.changed('parts'); renderList(); } } } }, '上移一層'),
            h('button.btn.s', { on: { click: () => { const i = c.parts.indexOf(p); if (i > 0) { c.parts.splice(i, 1); c.parts.splice(i - 1, 0, p); x.changed('parts'); renderList(); } } } }, '下移一層'),
            h('button.btn.s', { on: { click: () => { p.visible = p.visible === false; x.changed('parts'); renderList(); } } }, icon('eye', 's'), p.visible === false ? '顯示' : '隱藏'),
            h('button.btn.s', { on: { click: () => { const q = Ch().clone(p); q.id = 'pt' + Date.now().toString(36); q.x = (q.x || 0) + 4; c.parts.push(q); x.selected = q.id; x.stage.select(q.id); x.changed('parts'); renderList(); renderEditor(); } } }, icon('copy', 's'), '複製'),
            h('button.btn.s', { style: { color: 'var(--danger)' }, on: { click: () => { c.parts = c.parts.filter((q) => q !== p); x.selected = null; x.stage.select(null); x.changed('parts'); renderList(); renderEditor(); } } }, icon('trash', 's'), '移除'))));
      }
      const addPart = async () => {
        const asset = await OC.Library.pick({ title: '選擇部件圖片', kinds: ['part', 'drawing', 'import', 'frame'], owner: c.id });
        if (!asset) return;
        sheet('放在哪裡？', (b, api) => {
          b.append(h('div.grid.c2', null, ...R.SLOTS.map(([slot, zh]) => h('button.tile', { style: { aspectRatio: 'auto', minHeight: '54px' }, on: { click: () => { const [anchor, z] = R.SLOT_DEFAULT[slot]; const p = { id: 'pt' + Date.now().toString(36), slot, assetId: asset.id, anchor, z, x: 0, y: slot === 'hat' ? -12 : 0, scale: R.REPLACE.has(slot) ? (slot === 'tail' ? 0.8 : slot === 'ears' ? 0.6 : 0.35) : 0.8, rot: 0, flip: false, mirror: true, visible: true }; c.parts.push(p); x.selected = p.id; x.stage.select(p.id); x.changed('parts', 'happy'); api.close(); renderList(); renderEditor(); } } }, h('b', null, zh)))));
        });
      };
      box.append(T('自訂部件', '用自己的圖：眼睛、嘴巴、耳朵、尾巴、服裝、飾品…'), list, h('div.hstack', { style: { marginTop: '10px' } }, h('button.btn.primary.block', { on: { click: addPart } }, icon('plus', 's'), '加入部件'), h('button.btn.block', { on: { click: () => OC.Paint.open({ purpose: 'part', owner: c.id, onSaved: () => toast('畫好了！按「加入部件」選取它', 'brush') }) } }, icon('brush', 's'), '畫一個')), editor);
      x.partsRefresh = () => { renderList(); renderEditor(); };
      renderList(); renderEditor();
      return box;
    },
    expressions(c, x) {
      const list = [['happy', '開心'], ['shy', '害羞'], ['angry', '生氣'], ['sad', '難過'], ['surprised', '驚訝'], ['sleep', '睡覺'], ['eat', '吃東西'], ['greet', '打招呼'], ['sit', '坐下'], ['jump', '跳躍']];
      return h('div', null, T('表情與動作預覽', '套用目前的個性與小怪癖'), h('div.grid.c3', null, ...list.map(([a, zh]) => h('button.tile', { style: { aspectRatio: 'auto', minHeight: '48px' }, on: { click: () => { x.stage.react(a, a === 'sleep' ? 3 : 1.8); haptic(); } } }, zh))),
        h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '走路示範'), toggle(x.stage.walk, (v) => (x.stage.walk = v))));
    },

    // ============================== data sections ==============================
    profile(c, x) {
      const P = c.profile, f = (label, k, o = {}) => { const inp = h(o.area ? 'textarea' : 'input', { value: P[k] || '', maxLength: o.max || 20, placeholder: o.ph || '（可略過）', 'aria-label': label, rows: o.area ? 3 : null, style: o.area ? { width: '100%', border: 0, outline: 'none', background: 'transparent', resize: 'vertical', font: 'inherit', padding: '10px 0' } : null, on: { input: (e) => { P[k] = e.target.value; x.changed('profile'); } } }); return h('div', { style: { marginTop: '10px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)', marginBottom: '4px' } }, label + (o.req ? '（必填）' : '')), h('div.field', { style: o.area ? { height: 'auto' } : null }, inp)); };
      const box = h('div', null, T('基本資料'), f('名字', 'name', { req: true, max: 12, ph: '例如：麻糬' }), f('暱稱', 'nickname', { max: 12 }));
      if (x.level === 'detailed' || x.full) box.append(f('代稱', 'pronoun', { max: 8, ph: '例如：她、他、祂、牠、他們' }), f('性別', 'gender', { max: 10 }), f('年齡', 'age', { max: 8 }), f('生日', 'birthday', { max: 10, ph: '例如：3/14' }),
        h('div', { style: { marginTop: '10px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)', marginBottom: '4px' } }, '種族'), seg(Ch().SPECIES, P.species, (v) => { P.species = v; x.changed('profile'); })));
      box.append(f('一句話介紹', 'intro', { max: 40 }));
      if (x.level === 'detailed' || x.full) {
        box.append(f('背景故事', 'backstory', { area: true, max: 600 }), f('關係偏好', 'relationPref', { max: 30, ph: '例如：喜歡安靜的朋友' }));
        const cf = h('div'); const renderCF = () => { cf.replaceChildren(...P.custom.map((r, i) => h('div.hstack', { style: { marginTop: '6px' } }, h('div.field', { style: { flex: 1, height: '44px' } }, h('input', { value: r.k, placeholder: '欄位', maxLength: 10, on: { input: (e) => { r.k = e.target.value; x.changed('profile'); } } })), h('div.field', { style: { flex: 2, height: '44px' } }, h('input', { value: r.v, placeholder: '內容', maxLength: 40, on: { input: (e) => { r.v = e.target.value; x.changed('profile'); } } })), h('button.icon-btn', { 'aria-label': '刪除欄位', on: { click: () => { P.custom.splice(i, 1); renderCF(); x.changed('profile'); } } }, icon('close', 's'))))); };
        renderCF(); box.append(T('自訂欄位'), cf, h('button.btn.s', { style: { marginTop: '8px' }, on: { click: () => { P.custom.push({ k: '', v: '' }); renderCF(); } } }, icon('plus', 's'), '新增欄位'));
      }
      return box;
    },
    personality(c, x) {
      const P = c.personality, title = h('div.tag.teal', { style: { fontSize: 'var(--fs-m)', padding: '6px 14px' } }, Ch().typeTitle(c));
      const reactFor = { pace: 'walk', energy: 'happy', social: 'greet', expression: 'surprised', thinking: 'idle', speech: 'greet' };
      // 9.0: a playful way in — five little questions (or a dice roll) set the sliders and suggest traits; the OC reacts
      const fun = h('div.hstack', { style: { gap: '8px', margin: '4px 0 6px' } },
        h('button.btn.grow', { on: { click: () => quiz(c, x) } }, icon('chat', 's'), '回答 5 個小問題'),
        h('button.btn.grow', { on: { click: () => { for (const d of Ch().SLIDERS) P[d.id] = Math.round(15 + Math.random() * 70); x.changed('personality', ['happy', 'surprised', 'shy', 'greet'][Math.floor(Math.random() * 4)]); x.rebuild(); } } }, icon('dice', 's'), '隨機性格'));
      return h('div', null, T('性格', '拖動滑桿，角色會即時反應'), fun, h('div.center', { style: { margin: '6px 0 10px' } }, title),
        ...Ch().SLIDERS.map((d) => OC.UI.slider(d, P[d.id], (v, live) => { P[d.id] = v; title.textContent = Ch().typeTitle(c); if (!live) { x.changed('personality', reactFor[d.id] === 'walk' ? null : reactFor[d.id]); if (d.id === 'pace') { x.stage.walk = true; setTimeout(() => (x.stage.walk = false), 2200); } } })));
    },
    /* (personality quiz is defined below as quiz()) */
    traits(c, x) {
      const P = c.personality, box = h('div'), MAX = 5;
      const grid = h('div.grid.c2');
      const sync = () => [...grid.children].forEach((b) => { if (b.dataset.v) b.classList.toggle('on', P.traits.includes(b.dataset.v)); });
      const groups = [...new Set(Ch().TRAITS.map((t) => t.g))];
      for (const gname of groups) {
        grid.append(h('div', { style: { gridColumn: '1 / -1', fontWeight: 700, marginTop: '6px' } }, gname));
        for (const t of Ch().TRAITS.filter((q) => q.g === gname)) grid.append(h('button.tile', { 'data-v': t.id, style: { aspectRatio: 'auto', minHeight: '62px', padding: '8px' }, on: { click: () => {
          if (P.traits.includes(t.id)) P.traits = P.traits.filter((q) => q !== t.id);
          else { const clash = (t.x || []).find((q) => P.traits.includes(q)); if (clash) { toast(`「${t.zh}」和「${Ch().TRAITS.find((q) => q.id === clash).zh}」互相矛盾`, 'info'); return; } if (P.traits.length >= MAX) { toast(`最多 ${MAX} 個特質`, 'info'); return; } P.traits.push(t.id); }
          haptic(); sync(); x.changed('personality', { shy: 'shy', outgoing: 'greet', lazy: 'sit', foodie: 'eat', sleepy: 'sleep', curious: 'surprised', cheerful: 'happy', pessimist: 'sad', stubborn: 'angry' }[t.id] || 'happy');
        } } }, h('b', { style: { color: 'var(--ink)', fontSize: 'var(--fs-m)' } }, t.zh), t.d));
      }
      sync();
      const custom = h('div');
      const renderC = () => custom.replaceChildren(...P.customTraits.map((t, i) => h('div.card', { style: { marginTop: '8px', padding: '10px 12px' } }, h('div.hstack', null, h('b.grow', null, t.name), h('button.icon-btn', { 'aria-label': '刪除', on: { click: () => { P.customTraits.splice(i, 1); renderC(); x.changed('personality'); } } }, icon('trash', 's'))), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, t.desc || ''))));
      renderC();
      const nm = h('input', { placeholder: '特質名稱', maxLength: 10 }), ds = h('input', { placeholder: '描述（可略過）', maxLength: 40 });
      box.append(T('特質', `最多 ${MAX} 個，會影響行為與需求`), grid, T('自訂特質'), custom, h('div.vstack', { style: { marginTop: '8px' } }, h('div.field', null, nm), h('div.field', null, ds), h('button.btn.s', { on: { click: () => { const n = nm.value.trim(); if (!n) return; P.customTraits.push({ id: 'ct' + Date.now().toString(36), name: n, desc: ds.value.trim() }); nm.value = ds.value = ''; renderC(); x.changed('personality', 'happy'); } } }, icon('plus', 's'), '新增自訂特質')));
      return box;
    },
    quirks(c, x) {
      const Q = c.quirks, demo = { walk: () => { x.stage.walk = true; setTimeout(() => (x.stage.walk = false), 2600); }, sit: () => x.stage.react('sit', 2.4), sleep: () => x.stage.react('sleep', 3), eat: () => x.stage.react('eat', OC.Chars.behavior(c).chew + 0.4), greet: () => x.stage.react('greet', 1.6), habit: () => x.stage.react('idle', 0.1), face: () => x.stage.react('idle', 0.1) };
      const box = h('div', null, T('小怪癖', '選擇後會立刻示範'));
      for (const [k, d] of Object.entries(Ch().QUIRKS)) box.append(h('div', { style: { marginTop: '10px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)', marginBottom: '4px' } }, d.zh), seg(d.opts, Q[k], (v) => { Q[k] = v; if (k === 'face') c.look.mouthStyle = v; x.changed('quirks'); demo[k](); })));
      return box;
    },
    tastes(c, x) {
      const P = c.profile, likeItems = c.tastes.likeItems, items = Object.entries(Sty().ITEMS).filter(([, it]) => it.kind !== 'clothing');
      const g = h('div.grid.c4');
      const sync = () => [...g.children].forEach((b) => { const id = b.dataset.v; b.classList.toggle('on', likeItems.includes(id)); b.style.opacity = c.tastes.dislikeItems.includes(id) ? 0.45 : 1; });
      items.forEach(([id, it]) => { const im = Sty().itemImg(id); im.style.width = '56%'; g.append(h('button.tile', { 'data-v': id, on: { click: () => { const L = c.tastes.likeItems, D = c.tastes.dislikeItems; if (L.includes(id)) { L.splice(L.indexOf(id), 1); D.push(id); } else if (D.includes(id)) D.splice(D.indexOf(id), 1); else L.push(id); sync(); x.changed('tastes', L.includes(id) ? 'happy' : D.includes(id) ? 'sad' : null); } } }, im, it.zh)); });
      sync();
      return h('div', null, T('喜歡的東西'), OC.UI.tagList(P.likes, () => x.changed('profile'), '例如：雨天、甜點'), T('討厭的東西'), OC.UI.tagList(P.dislikes, () => x.changed('profile'), '例如：打雷'), T('興趣'), OC.UI.tagList(P.hobbies, () => x.changed('profile'), '例如：畫畫、看書'), T('習慣'), OC.UI.tagList(P.habits, () => x.changed('profile'), '例如：睡前喝牛奶'),
        T('物品喜好', '點一下＝喜歡，再點＝討厭，再點＝取消'), g);
    },
    /** 8.0 speech: style, pronouns, how they call you, ending (with a rate), several catchphrases with conditions, pace,
     *  mood colouring, banned words, names for other OCs — with a live preview of several situations */
    speech(c, x) {
      const Sp = c.speech; Sp.phrases = Sp.phrases || []; Sp.banned = Sp.banned || []; Sp.call = Sp.call || {};
      if (!Sp.phrases.length && Sp.catchphrase) { Sp.phrases.push({ text: Sp.catchphrase, rate: 0.18, when: 'any', at: 'start' }); Sp.catchphrase = ''; }
      const SAMPLES = [['你好！今天天氣真好。', 'happy', 'greet'], ['我有點餓了……', 'down', 'chat'], ['謝謝你送我的禮物！', 'excited', 'gift'], ['我們一起去散步吧？', 'calm', 'chat'], ['今天好累喔。', 'tired', 'chat']];
      const prev = h('div.speech-prev');
      const draw = () => prev.replaceChildren(...SAMPLES.map(([t, emo, cat]) => h('div.speech-line', null, h('small', null, { happy: '開心', down: '低落', excited: '興奮', calm: '平靜', tired: '疲倦' }[emo]), h('span', null, Ch().speak(c, t, { emo, cat, to: 'player' })))));
      const chg = (k) => { draw(); x.changed('speech', k); };
      const chips = (opts, cur, set) => h('div.chips', null, ...opts.map((v) => h('button.chip-btn' + (cur() === v ? '.on' : ''), { on: { click: (e) => { set(v); [...e.currentTarget.parentNode.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget)); chg(); } } }, v)));
      const self = h('input', { value: ['我', '人家', '俺', '本小姐', '在下', '咱'].includes(Sp.self) ? '' : Sp.self, maxLength: 4, placeholder: '自訂', style: { width: '80px' }, on: { input: (e) => { Sp.self = e.target.value.trim() || '我'; chg(); } } });
      const you = h('input', { value: ['你', '妳', '您'].includes(Sp.you) ? '' : Sp.you, maxLength: 4, placeholder: '自訂', style: { width: '80px' }, on: { input: (e) => { Sp.you = e.target.value.trim() || '你'; chg(); } } });
      const pname = h('input', { value: Sp.playerName || '', maxLength: 10, placeholder: '叫你什麼（例如：主人、阿明）', on: { input: (e) => { Sp.playerName = e.target.value.trim(); chg(); } } });
      const en = h('input', { value: Sp.ending, maxLength: 6, placeholder: '句尾口癖（例如：喵、啦、的說）', on: { input: (e) => { Sp.ending = e.target.value; chg(); } } });
      const rate = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: Sp.endingRate == null ? 0.35 : Sp.endingRate, 'aria-label': '句尾出現頻率', style: { width: '100%' }, on: { input: (e) => { Sp.endingRate = +e.target.value; rateL.textContent = rateText(); chg(); } } });
      const rateText = () => { const r = Sp.endingRate == null ? 0.35 : Sp.endingRate; return r <= 0.05 ? '幾乎不用' : r < 0.25 ? '偶爾' : r < 0.5 ? '大約三句一次' : r < 0.85 ? '常常' : '每句都用'; };
      const rateL = h('small.muted', null, rateText());
      const plist = h('div');
      const drawPhrases = () => plist.replaceChildren(...Sp.phrases.map((p, i) => h('div.card.s', { style: { marginTop: '6px', padding: '10px' } },
        h('div.hstack', null, h('input.grow', { value: p.text, maxLength: 20, 'aria-label': '口頭禪', on: { input: (e) => { p.text = e.target.value; chg(); } } }), h('button.icon-btn', { 'aria-label': '刪除口頭禪', on: { click: () => { Sp.phrases.splice(i, 1); drawPhrases(); chg(); } } }, icon('trash', 's'))),
        h('div.hstack', { style: { marginTop: '6px', gap: '6px', flexWrap: 'wrap' } },
          seg([['any', '任何時候'], ['happy', '開心時'], ['sad', '難過時'], ['greet', '打招呼']], p.when || 'any', (v) => { p.when = v; chg(); }),
          seg([['start', '句首'], ['end', '句尾']], p.at || 'start', (v) => { p.at = v; chg(); })),
        h('div.hstack', { style: { marginTop: '6px' } }, h('small.muted', null, '頻率'), h('input.grow', { type: 'range', min: 0.02, max: 0.6, step: 0.02, value: p.rate == null ? 0.18 : p.rate, 'aria-label': '口頭禪頻率', on: { input: (e) => { p.rate = +e.target.value; chg(); } } })))));
      drawPhrases();
      const banned = h('input', { value: Sp.banned.join('、'), placeholder: '不想讓他說的詞，用頓號分開', on: { change: (e) => { Sp.banned = e.target.value.split(/[、,，\s]+/).map((w) => w.trim()).filter(Boolean).slice(0, 20); chg(); } } });
      const others = Ch().all().filter((o) => o.id !== c.id);
      draw();
      return h('div', null, T('說話風格'), seg(Ch().SPEECH, Sp.style, (v) => { Sp.style = v; chg('greet'); }),
        T('預覽', '同一句話在不同心情下'), prev, h('button.btn.ghost.s', { style: { marginTop: '4px' }, on: { click: draw } }, icon('refresh', 's'), '再聽一次'),
        T('自稱'), h('div.hstack', { style: { gap: '6px', flexWrap: 'wrap' } }, chips(['我', '人家', '俺', '本小姐', '在下', '咱'], () => Sp.self, (v) => { Sp.self = v; self.value = ''; }), self),
        T('稱呼你'), h('div.hstack', { style: { gap: '6px', flexWrap: 'wrap' } }, chips(['你', '妳', '您'], () => Sp.you, (v) => { Sp.you = v; you.value = ''; }), you), h('div.field', { style: { marginTop: '8px' } }, pname),
        T('句尾口癖', '不會每句都加'), h('div.field', null, en), h('div.hstack', { style: { marginTop: '6px' } }, h('span.grow', null, '出現頻率'), rateL), rate,
        T('口頭禪', '可以有好幾個，各自設定時機與頻率'), plist, Sp.phrases.length < 5 ? h('button.btn.s', { style: { marginTop: '6px' }, on: { click: () => { Sp.phrases.push({ text: '', rate: 0.18, when: 'any', at: 'start' }); drawPhrases(); } } }, icon('plus', 's'), '新增口頭禪') : null,
        T('說話節奏'), seg([['slow', '慢慢說…'], ['normal', '一般'], ['fast', '說話很快']], Sp.pace || 'normal', (v) => { Sp.pace = v; chg(); }),
        h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '心情會影響語氣'), toggle(Sp.moods !== false, (v) => { Sp.moods = v; chg(); })),
        T('禁用詞'), h('div.field', null, banned),
        others.length ? T('對其他 OC 的專屬稱呼') : null,
        ...others.map((o) => h('div.hstack', { style: { marginTop: '6px' } }, h('span.grow', null, Ch().name(o)), h('input', { value: Sp.call[o.id] || '', maxLength: 8, placeholder: '例如：小栗', style: { width: '120px' }, on: { input: (e) => { if (e.target.value.trim()) Sp.call[o.id] = e.target.value.trim(); else delete Sp.call[o.id]; x.changed('speech'); } } }))));
    },
    /** action → animation assignment (view + link to the studio) */
    anims(c, x) {
      const box = h('div', null, T('動畫配置', '每個動作可指定逐格動畫；沒有的會自動使用備用動作'));
      box.append(h('div.hstack', { style: { margin: '6px 0 10px' } }, h('span.grow', null, '外觀以逐格動畫為主（不使用內建角色骨架）'), toggle(c.appearance.mode === 'sprite', (v) => { if (v && !OC.Anim.resolve(c, 'idle', 'front')) { toast('先在動畫工作室做一個「待機」動作', 'film'); x.rebuild(); return; } c.appearance.mode = v ? 'sprite' : 'rig'; x.changed('look', 'happy'); })));
      const rows = h('div.list');
      for (const [a, zh] of Ch().ACTIONS) {
        const m = c.actions[a] || {}, dirs = Object.keys(m).filter((d) => OC.Anim.get(m[d]));
        const r = OC.Anim.resolve(c, a, 'front');
        rows.append(OC.UI.row(null, `${zh}`, dirs.length ? `自訂：${dirs.map((d) => ({ any: '全方向', front: '前', back: '後', left: '左', right: '右' })[d]).join('、')}` : r ? `沿用「${Ch().ACTION_ZH[r.action] || r.action}」` : (c.appearance.mode === 'sprite' ? '⚠ 沒有可用動作，會改用角色骨架' : '內建骨架動作'), h('button.btn.s', { on: { click: () => OC.Studio.open({ charId: c.id, action: a, docId: m.front || m.any || dirs.map((d) => m[d])[0] || null }) } }, dirs.length ? '編輯' : '製作')));
      }
      const custom = Object.keys(c.actions || {}).filter((a) => !Ch().ACTIONS.some((q) => q[0] === a));
      for (const a of custom) rows.append(OC.UI.row(null, a, '自訂動作', h('button.btn.s', { on: { click: () => OC.Studio.open({ charId: c.id, action: a, docId: Object.values(c.actions[a])[0] }) } }, '編輯')));
      box.append(rows, h('button.btn.block', { style: { marginTop: '10px' }, on: { click: () => OC.Studio.open({ charId: c.id, action: null, docId: null }) } }, icon('plus', 's'), '新增自訂動作'));
      return box;
    },
  };

  OC.CharEdit = { stage, sections: S_, tiles, mini, randomize };
})();
