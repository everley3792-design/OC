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
    const st = { react: null, walk: false, t0: performance.now(), blinkAt: 0, face: 0.15, selected: null, dirDemo: null };
    const ctx = cv.getContext('2d');
    let unit = 1, feetY = 0;
    function pose(now) {
      const t = (now - st.t0) / 1000; if (now > st.blinkAt + 130) st.blinkAt = now + 2200 + Math.random() * 2400;
      const p = { action: 'idle', at: t, face: st.face, back: 0, blink: now > st.blinkAt ? 1 : 0, breath: Math.sin(now / 600), dir: 'front', noShadow: false };
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
      OC.CharRender.draw(ctx, c, p, W / 2, feetY, unit, p.at);
      if (st.selected) drawSel(c);
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
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); const pts = [...ptr.values()];
      g = pts.length === 2 ? { kind: 'pinch', d0: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]), a0: Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]), part: snapshot() } : { kind: 'drag', x0: e.clientX, y0: e.clientY, moved: false, part: snapshot(), face0: st.face }; });
    cv.addEventListener('pointermove', (e) => {
      if (!ptr.has(e.pointerId) || !g) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
      const r = cv.getBoundingClientRect(), k = cv.width / r.width / unit, c = getChar(), part = c && st.selected && c.parts.find((q) => q.id === st.selected);
      if (g.kind === 'pinch' && ptr.size === 2 && part) { const pts = [...ptr.values()], d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]), a = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]); part.scale = Math.max(0.1, Math.min(6, g.part.scale * d / g.d0)); part.rot = Math.round(g.part.rot + ((a - g.a0) * 180) / Math.PI); o.onPart && o.onPart(part, true); return; }
      if (g.kind !== 'drag') return;
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0; if (Math.hypot(dx, dy) > 6) g.moved = true;
      if (part) { part.x = Math.round((g.part.x + dx * k) * 10) / 10; part.y = Math.round((g.part.y + dy * k) * 10) / 10; o.onPart && o.onPart(part, true); }
      else st.face = Math.max(-1, Math.min(1, g.face0 + dx / 120));
    });
    const up = (e) => { ptr.delete(e.pointerId); if (!g) return; const c = getChar(), part = c && st.selected && c.parts.find((q) => q.id === st.selected);
      if (g.kind === 'drag' && !g.moved && !part) react('happy', 1.1); if (part && (g.moved || g.kind === 'pinch')) o.onPart && o.onPart(part, false); if (!ptr.size) g = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    function snapshot() { const c = getChar(), p = c && st.selected && c.parts.find((q) => q.id === st.selected); return p ? { x: p.x || 0, y: p.y || 0, scale: p.scale || 1, rot: p.rot || 0 } : null; }
    function react(action, dur = 1.2, extra) { st.react = { action, t0: performance.now(), until: performance.now() + dur * 1000, extra }; }
    st.raf = requestAnimationFrame(frame);
    return { el, canvas: cv, react, set walk(v) { st.walk = v; }, get walk() { return st.walk; }, select(id) { st.selected = id; }, turn(f) { st.face = f; }, restart() { if (!st.raf) st.raf = requestAnimationFrame(frame); } };
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
  const S_ = {
    template(c, x) {
      const box = h('div');
      box.append(T('從範本開始', '可再自由修改'), tiles(Object.entries(Sty().PRESETS).map(([k, v]) => [k, v.name]), null, (k) => { const keep = Ch().clone({ profile: c.profile, personality: c.personality, quirks: c.quirks, speech: c.speech, parts: c.parts, actions: c.actions }); Object.assign(c.look, Ch().clone(Ch().fromPreset(k).look)); Object.assign(c, keep); x.changed('look', 'happy'); x.rebuild(); }, (k) => mini(Ch().fromPreset(k))));
      box.append(T('種族'), seg(Ch().SPECIES.slice(0, 4), c.profile.species, (v) => { c.profile.species = v; if (v === 'bunny') c.look.ears = 'bunny'; if (v === 'bear') c.look.ears = 'bear'; if (v === 'cat') c.look.ears = 'cat'; x.changed('look', 'surprised'); x.rebuild(); }));
      box.append(h('button.btn.block', { style: { marginTop: '12px' }, on: { click: () => { randomize(c, x.level); x.changed('look', 'surprised'); x.rebuild(); } } }, icon('dice', 's'), '隨機搭配'));
      return box;
    },
    body(c, x) {
      const L = c.look, ch = (k) => (v, live) => { L[k] = v; x.changed('look', live ? null : 'idle'); };
      return h('div', null, T('比例與體型'), num('頭部大小', L.headSize, 0.75, 1.3, 0.01, ch('headSize')), num('身體寬度', L.bodyW, 0.75, 1.4, 0.01, ch('bodyW')), num('身體長度', L.bodyH, 0.75, 1.4, 0.01, ch('bodyH')), num('腿長', L.legLen, 0.6, 1.7, 0.01, ch('legLen')),
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
      return h('div', null, T('性格', '拖動滑桿，角色會即時反應'), h('div.center', { style: { margin: '6px 0 10px' } }, title),
        ...Ch().SLIDERS.map((d) => OC.UI.slider(d, P[d.id], (v, live) => { P[d.id] = v; title.textContent = Ch().typeTitle(c); if (!live) { x.changed('personality', reactFor[d.id] === 'walk' ? null : reactFor[d.id]); if (d.id === 'pace') { x.stage.walk = true; setTimeout(() => (x.stage.walk = false), 2200); } } })));
    },
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
    speech(c, x) {
      const Sp = c.speech, sample = h('div.speech', { style: { position: 'static', transform: 'none', display: 'inline-block', animation: 'none', maxWidth: '100%' } });
      const upd = () => { sample.textContent = Ch().speak(c, Sp.catchphrase || '今天也要一起玩喔！'); };
      const cp = h('input', { value: Sp.catchphrase, maxLength: 20, placeholder: '口頭禪（可略過）', on: { input: (e) => { Sp.catchphrase = e.target.value; upd(); x.changed('speech'); } } });
      const en = h('input', { value: Sp.ending, maxLength: 6, placeholder: '口癖、句尾（例如：喵、啦）', on: { input: (e) => { Sp.ending = e.target.value; upd(); x.changed('speech'); } } });
      upd();
      return h('div', null, T('說話方式'), seg(Ch().SPEECH, Sp.style, (v) => { Sp.style = v; upd(); x.changed('speech', 'greet'); }), h('div.field', { style: { marginTop: '10px' } }, cp), h('div.field', { style: { marginTop: '8px' } }, en), h('div.center', { style: { marginTop: '14px' } }, sample));
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
