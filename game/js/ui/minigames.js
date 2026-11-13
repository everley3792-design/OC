/* OC Shimeji — playable life activities (Phase 5). Each one has real input, a win / lose
 * condition, an animation on the OC, and results through OC.Tx (items), OC.Mind (skill, emotion,
 * memory) and the collection. Shared overlay: a compact bottom panel so the OC stays visible.
 *   fishing   hold to charge → cast → wait for the bite → tap in time → reel: keep the marker in
 *             the fish zone (hold = up, release = down) until the line fills; species by water /
 *             time / weather / skill
 *   cooking   choose a recipe (ingredients from the bag) → chop (tap on the marks) → stir (draw
 *             circles) → heat (stop the needle in the green) → 1–3 stars; nothing is used if it fails
 *   critter   sneak closer by holding while it is calm; if you move while it is alert it flees
 */
(function () {
  'use strict';
  const { h, icon, toast, sheet, haptic } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, M = () => OC.Mind, A = () => OC.App, Sim = () => OC.Sim;
  const I = (id) => OC.Style.ITEMS[id];
  let cur = null;

  function panel(title, hint) {
    close();
    const cv = h('canvas', { width: 600, height: 240 }); cv.style.cssText = 'width:100%;height:120px;touch-action:none';
    const hintEl = h('div.mini-hint', null, hint), el = h('div.mini', { role: 'dialog', 'aria-label': title }, h('div.hstack', null, h('b.grow', null, title), h('button.icon-btn', { 'aria-label': '結束', on: { click: () => end('cancel') } }, icon('close', 's'))), cv, hintEl);
    document.getElementById('app').append(el); requestAnimationFrame(() => el.classList.add('open'));
    const layer = { scrim: false, close: () => end('cancel') }; OC.UI.pushLayer(layer);
    cur = { el, cv, x: cv.getContext('2d'), hint: (t) => (hintEl.textContent = t), layer, raf: 0, down: false, t0: performance.now() };
    cv.addEventListener('pointerdown', (e) => { if (!cur) return; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ } cur.down = true; cur.onDown && cur.onDown(e); });   // a tap while the game is closing
    const up = (e) => { if (!cur) return; cur.down = false; cur.onUp && cur.onUp(e); }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointermove', (e) => cur && cur.onMove && cur.onMove(e));
    OC.Brain.hold(S().activeId, 'activity');
    return cur;
  }
  function loop(fn) { let last = performance.now(); const step = (now) => { if (!cur) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; fn(dt, (now - cur.t0) / 1000); if (cur) cur.raf = requestAnimationFrame(step); }; cur.raf = requestAnimationFrame(step); }
  function close() { if (!cur) return; cancelAnimationFrame(cur.raf); OC.UI.popLayer(cur.layer); const el = cur.el; el.classList.remove('open'); setTimeout(() => el.remove(), 300); cur = null; OC.Brain.unhold(S().activeId, 'activity'); const p = A().player; if (p) OC.World.setAction(p, 'idle'); }
  function end(why) { if (cur && cur.onEnd) cur.onEnd(why); close(); }
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
  const bar = (x, X, Y, W, Hh, v, col) => { x.fillStyle = css('--surface-2'); x.beginPath(); x.roundRect(X, Y, W, Hh, Hh / 2); x.fill(); x.fillStyle = col; x.beginPath(); x.roundRect(X, Y, Math.max(Hh, W * Math.max(0, Math.min(1, v))), Hh, Hh / 2); x.fill(); };
  const me = () => A().me();
  function reward(c, o) {
    if (OC.Sound && OC.Sound.cue) OC.Sound.cue('mini');   // 12.0: only called after a success
    if (o.skill) M().skill(c, o.skill, o.xp || 2);
    if (o.feel) M().feel(c, o.feel[0], o.feel[1], o.feel[2]);
    if (o.mem) M().remember(c, Object.assign({ type: 'activity', imp: 0.45, place: 'place:' + OC.World.area.id }, o.mem));
  }

  // ======================= fishing =======================
  function fishing(water, spot) {
    const c = me(), P = A().player; if (!c || !P) return;
    OC.World.setAction(P, 'fish', { priority: 7 }); P.tFace = 0; P.tBack = 1;
    const g = panel(water === 'pond' ? '池塘釣魚' : '海邊釣魚', '按住蓄力，放開拋竿');
    let st = 'charge', power = 0, pdir = 1, wait = 0, biteT = 0, fish = null, zone = 0.5, zv = 0, mark = 0.5, mv = 0, prog = 0.3, msg = '';
    const lv = M().skillLv(c, 'fishing'), has = (t) => OC.Chars.has(c, t);
    // personality: diligent / gentle are patient (wider zone, longer bite window); curious notices bites faster; lazy reels slower
    const G = OC.Growth, pz = (has('diligent') ? 0.03 : 0) + (has('gentle') ? 0.02 : 0) + (G && G.has(c, 'steady_reel') ? 0.02 : 0), pb = (has('diligent') ? 0.15 : 0) + (has('curious') ? 0.1 : 0), pr = has('lazy') ? 0.85 : has('cheerful') ? 1.08 : 1;
    g.onDown = () => { if (st === 'bite') { st = 'reel'; fish = OC.Places.fishRoll(water, lv + (OC.Growth && OC.Growth.has(c, 'rare_bait') ? 3 : 0)); OC.Sound && OC.Sound.play('bite'); const r = I(fish).rarity; zv = 0.25 + r * 0.12; prog = 0.3; g.hint('按住讓標記往右，放開往左；讓它待在魚的區域裡'); haptic(); } else if (st === 'wait') { st = 'charge'; power = 0; g.hint('太早了！魚嚇跑了…再拋一次'); } };
    g.onUp = () => { if (st === 'charge' && power > 0.05) { OC.Sound && OC.Sound.play('splash'); st = 'wait'; wait = 1.2 + Sim().rnd() * 3.6 - power * 0.6; g.hint('等等看…浮標下沉時快點一下！'); } };
    g.onEnd = (why) => { if (why === 'cancel' && st !== 'done') toast('收竿了', 'info'); };
    loop((dt, t) => {
      const x = g.x, W = 600, Hh = 240; x.clearRect(0, 0, W, Hh);
      x.fillStyle = water === 'pond' ? '#7FD0EA' : '#4FC3E8'; x.beginPath(); x.roundRect(0, 0, W, Hh, 24); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo((i * 120 + t * 30) % 700 - 60, 60 + (i % 3) * 50); x.quadraticCurveTo((i * 120 + t * 30) % 700, 50 + (i % 3) * 50, (i * 120 + t * 30) % 700 + 60, 60 + (i % 3) * 50); x.stroke(); }
      g.dbg = { st, zone, mark, power, prog, pers: { pz, pb, pr } };
      if (st === 'charge') { if (g.down) { power += pdir * dt * 1.2; if (power > 1 || power < 0) { pdir *= -1; power = Math.max(0, Math.min(1, power)); } } bar(x, 40, 180, 520, 24, power, '#FFC93C'); x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif'; x.fillText('力道', 40, 165); }
      if (st === 'wait' || st === 'bite') {
        const bx = 140 + 320 * Math.max(0.2, power), by = 120 + Math.sin(t * 3) * 4 + (st === 'bite' ? 14 : 0);
        x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(20, 0); x.quadraticCurveTo(bx * 0.6, 40, bx, by); x.stroke();
        x.fillStyle = '#F26B5B'; x.beginPath(); x.arc(bx, by, 12, Math.PI, 0); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(bx, by, 12, 0, Math.PI); x.fill();
        if (st === 'wait') { wait -= dt; if (wait <= 0) { st = 'bite'; biteT = 0.95 - lv * 0.03 + pb; haptic(); g.hint('上鉤了！快點一下！'); } }
        else { biteT -= dt; x.fillStyle = '#FFE066'; x.font = 'bold 64px sans-serif'; x.fillText('!', bx - 10, by - 30); if (biteT <= 0) { st = 'charge'; power = 0; g.hint('魚跑掉了…再拋一次（按住蓄力）'); } }
      }
      if (st === 'reel') {
        zone += zv * dt * (Math.sin(t * 1.7) + Math.sin(t * 0.63 + 1) * 0.8); zone = Math.max(0.1, Math.min(0.9, zone)); if (zone <= 0.1 || zone >= 0.9) zv = -zv;
        if (g.down && OC.Sound) OC.Sound.play('reel');
        mv += (g.down ? 1.9 : -1.6) * dt; mv = Math.max(-0.9, Math.min(0.9, mv)); mark = Math.max(0, Math.min(1, mark + mv * dt)); if (mark <= 0 || mark >= 1) mv = 0;
        const r = I(fish).rarity, zw = 0.22 - r * 0.025 + lv * 0.01 + pz, inZone = Math.abs(mark - zone) < zw / 2;
        prog += (inZone ? 0.34 * pr : -0.18 - r * 0.02) * dt; g.dbg = { st, zone, mark, mv, zw, prog, power };
        x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.roundRect(30, 60, 540, 50, 25); x.fill();
        x.fillStyle = inZone ? '#6CCB5F' : '#FFC93C'; x.beginPath(); x.roundRect(30 + (zone - zw / 2) * 540, 60, zw * 540, 50, 20); x.fill();
        x.font = '34px sans-serif'; x.fillText('🐟', 30 + zone * 540 - 17, 98);
        x.fillStyle = '#F26B5B'; x.fillRect(30 + mark * 540 - 4, 52, 8, 66);
        bar(x, 30, 160, 540, 26, prog, '#3FC1B0');
        if (prog >= 1) { st = 'done'; caught(fish); }
        else if (prog <= 0) { st = 'charge'; power = 0; prog = 0.3; g.hint('魚掙脫了…再試一次（按住蓄力）'); M().feel(c, 'down', 0.15, '魚跑掉了'); }
      }
      if (msg) { x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif'; x.fillText(msg, 30, 40); }
    });
    function caught(id) {
      const two = OC.Growth && OC.Growth.has(c, 'double') && Sim().rnd() < 0.12;
      const r = OC.Tx.run(OC.Tx.uid('fish'), { get: { items: { [id]: two ? 2 : 1 } } }, `釣到${I(id).zh}${two ? ' ×2' : ''}`, { water });
      if (!r.ok) { toast(r.why[0], 'info'); close(); return; }
      const rare = I(id).rarity; St.stat('fished'); OC.Sound && OC.Sound.play('splash'); OC.Sound && OC.Sound.play('pickup');
      if (OC.Progress) OC.Progress.emit('fish', { item: id, water, oc: c.id, near: [c.id].concat(Object.keys(A().mates || {})), count: two ? 2 : 1 });
      reward(c, { skill: 'fishing', xp: 3 + rare * 2, feel: [rare >= 3 ? 'excited' : 'happy', 0.4 + rare * 0.1, '釣到' + I(id).zh], mem: { imp: rare >= 3 ? 0.75 : 0.4, text: `在${OC.Places.get(OC.World.area.id).zh}釣到了${I(id).zh}`, key: r.entry.key } });
      close(); haptic(); OC.World.setAction(P, rare >= 3 ? 'jump' : 'happy', { dur: 1.6, priority: 6 }); if (rare >= 3) OC.World.jump(P);
      toast(`釣到了 ${I(id).zh}${two ? ' ×2（技能：偶爾一次兩條）' : ''}！（${OC.Items.RARITY[rare]}）`, 'sparkle'); if (r.firsts.length) OC.WorldUI.discovered(r.firsts);
    }
  }

  // ======================= cooking =======================
  const RECIPES = [
    { out: 'onigiri', need: { rice: 1 } }, { out: 'salad', need: { tomato: 1, carrot: 1 } }, { out: 'cookie', need: { flour: 1, sugar: 1 } },
    { out: 'soup_mush', need: { mushroom: 2, herb: 1 } }, { out: 'pancake', need: { flour: 1, egg: 1, honey: 1 }, unlock: 'recipe_t1' }, { out: 'pudding', need: { egg: 1, milk: 1, sugar: 1 }, unlock: 'recipe_t1' },
    { out: 'curry', need: { rice: 1, potato: 1, carrot: 1 }, unlock: 'recipe_t2' }, { out: 'fruit_tart', need: { flour: 1, sugar: 1, strawberry: 1 }, unlock: 'recipe_t2' }, { out: 'grill_fish', need: { fish: 1, herb: 1 }, unlock: 'recipe_t3' },
    { out: 'juice', need: { fruit: 2 } },
  ];
  const ANY = { fish: (id) => I(id) && I(id).cookAs === 'fish', fruit: (id) => ['apple', 'orange', 'peach', 'berry', 'strawberry'].includes(id) };
  /** concrete ingredients for a recipe from the bag (null if missing) */
  function ingredients(rc) {
    const out = {};
    for (const [k, n] of Object.entries(rc.need)) {
      if (ANY[k]) { const have = Object.keys(S().inv).filter(ANY[k]).sort((a, b) => St.count(b) - St.count(a)); let left = n; for (const id of have) { const t = Math.min(left, St.count(id) - (out[id] || 0)); if (t > 0) { out[id] = (out[id] || 0) + t; left -= t; } if (!left) break; } if (left) return null; }
      else { if (St.count(k) < n) return null; out[k] = n; }
    }
    return out;
  }
  const needText = (rc) => Object.entries(rc.need).map(([k, n]) => `${k === 'fish' ? '任何魚' : k === 'fruit' ? '水果' : I(k).zh}×${n}`).join('、');
  function cooking(spot) {
    const c = me(); if (!c) return;
    sheet('做料理', (b, api) => {
      b.append(h('p.muted', null, '選一道食譜。材料在完成時才會用掉；失敗的話材料還在。'), h('div.list', null, ...RECIPES.map((rc) => {
        const ing = ingredients(rc), im = OC.Style.itemImg(rc.out); im.style.width = im.style.height = '40px';
        const lock = rc.unlock && OC.Growth && !OC.Growth.has(c, rc.unlock) ? OC.Growth.unlockOf(rc.unlock) : null;
        if (lock) return OC.UI.row(im, I(rc.out).zh, `料理 Lv.${lock.lv} 學會（${OC.Chars.name(c)}現在 Lv.${M().skillLv(c, 'cook')}）`, h('span.tag', null, icon('lock', 's'), '還不會'));
        return OC.UI.row(im, I(rc.out).zh, needText(rc), ing ? h('button.btn.s.primary', { on: { click: () => { api.close(); setTimeout(() => cookGame(rc, spot), 250); } } }, '開始') : h('span.tag', null, '材料不足'));
      })));
    });
  }
  function cookGame(rc, spot) {
    const c = me(), P = A().player; if (!c || !P) return;
    OC.World.setAction(P, 'cook', { priority: 7 }); P.tBack = 1;
    const g = panel(`料理：${I(rc.out).zh}`, '切菜：刀子經過記號時點一下');
    let step = 'chop', score = [0, 0, 0], kx = 0, kd = 1, marks = [0.2, 0.5, 0.8], hits = 0, tries = 0, ang = null, stir = 0, stirT = 5, needle = 0, nd = 1;
    // personality & skill: cooks / foodies get a slower knife and a wider heat zone; lazy stirs for less time
    const cl = M().skillLv(c, 'cook'), steady = OC.Growth && OC.Growth.has(c, 'steady'), ks = 0.7 * (OC.Chars.has(c, 'foodie') ? 0.85 : 1) * (1 - Math.min(0.3, cl * 0.04)) * (steady ? 0.85 : 1), hz = 0.07 + (OC.Chars.has(c, 'diligent') ? 0.02 : 0) + cl * 0.005 + (steady ? 0.02 : 0); if (OC.Chars.has(c, 'lazy')) stirT = 4;
    g.onDown = (e) => {
      if (step === 'chop') { tries++; const near = marks.findIndex((m) => m != null && Math.abs(m - kx) < 0.06); if (near >= 0) { hits++; marks[near] = null; haptic(); OC.Sound && OC.Sound.play('chop'); } if (tries >= 5 || hits === 3) { score[0] = hits / 3; step = 'stir'; g.hint('攪拌：在畫面上畫圈圈，把進度填滿'); } }
      else if (step === 'heat') { const d = Math.abs(needle - 0.62); score[2] = d < hz ? 1 : d < 0.16 ? 0.6 : d < 0.28 ? 0.3 : 0; step = 'done'; finish(); }
    };
    g.onMove = (e) => { if (step !== 'stir' || !g.down) return; const r = g.cv.getBoundingClientRect(), a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); if (ang != null) { let d = a - ang; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; stir += Math.abs(d) / (Math.PI * 2) / 4; } ang = a; };
    g.onUp = () => { ang = null; };
    g.onEnd = (why) => { if (why === 'cancel' && step !== 'done') toast('沒做完，材料都還在', 'info'); };
    loop((dt, t) => {
      const x = g.x, W = 600; x.clearRect(0, 0, W, 240); x.fillStyle = css('--surface-2'); x.beginPath(); x.roundRect(0, 0, W, 240, 24); x.fill();
      g.dbg = { step, kx, marks: marks.slice(), stir, needle, score: score.slice() };
      if (step === 'chop') { kx += kd * dt * ks; if (kx > 1 || kx < 0) { kd *= -1; kx = Math.max(0, Math.min(1, kx)); } x.fillStyle = '#F2E6CF'; x.beginPath(); x.roundRect(30, 120, 540, 70, 16); x.fill(); marks.forEach((m) => { if (m == null) return; x.fillStyle = '#F26B5B'; x.fillRect(30 + m * 540 - 3, 110, 6, 90); }); x.fillStyle = '#9AA3B5'; x.beginPath(); x.moveTo(30 + kx * 540, 40); x.lineTo(30 + kx * 540 + 14, 100); x.lineTo(30 + kx * 540 - 14, 100); x.closePath(); x.fill(); x.fillStyle = css('--ink'); x.font = 'bold 26px sans-serif'; x.fillText(`切中 ${hits}/3`, 30, 34); }
      if (step === 'stir') { stirT -= dt; x.strokeStyle = '#B07E4B'; x.lineWidth = 10; x.beginPath(); x.arc(300, 120, 80, 0, Math.PI * 2); x.stroke(); x.fillStyle = '#F2C36B'; x.beginPath(); x.arc(300, 120, 70, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 4; x.beginPath(); x.arc(300, 120, 40, t * 4, t * 4 + Math.PI * 1.2); x.stroke(); bar(x, 30, 214, 540, 18, stir, '#3FC1B0'); x.fillStyle = css('--ink'); x.font = 'bold 26px sans-serif'; x.fillText(`${Math.max(0, stirT).toFixed(1)} 秒`, 30, 34); if (stir >= 1 || stirT <= 0) { score[1] = Math.min(1, stir); step = 'heat'; OC.Sound && OC.Sound.play('sizzle'); g.hint('火候：指針在綠色區域時點一下'); } }
      if (step === 'heat') { needle += nd * dt * 0.9; if (needle > 1 || needle < 0) { nd *= -1; needle = Math.max(0, Math.min(1, needle)); } x.fillStyle = '#FFE0B8'; x.beginPath(); x.roundRect(30, 100, 540, 50, 25); x.fill(); x.fillStyle = '#6CCB5F'; x.beginPath(); x.roundRect(30 + 0.55 * 540, 100, 0.14 * 540, 50, 12); x.fill(); x.fillStyle = '#F26B5B'; x.fillRect(30 + needle * 540 - 4, 90, 8, 70); }
    });
    function finish() {
      const sc = (score[0] + score[1] + score[2]) / 3, stars = sc >= 0.78 ? 3 : sc >= 0.45 ? 2 : sc >= 0.15 ? 1 : 0;
      close();
      if (!stars) { toast('燒焦了…材料都還在，再試一次吧', 'info'); M().feel(c, 'confused', 0.3, '料理失敗'); return; }
      const ing = ingredients(rc); if (!ing) { toast('材料不夠了', 'info'); return; }
      const n = stars === 3 ? 2 : 1;
      const r = OC.Tx.run(OC.Tx.uid('cook'), { pay: { items: ing }, get: { items: { [rc.out]: n } } }, `料理 ${I(rc.out).zh}（${'★'.repeat(stars)}）`, { stars });
      if (!r.ok) { toast(r.why[0], 'info'); return; }
      St.stat('cooked'); haptic(); OC.Sound && OC.Sound.play('chime');
      if (OC.Progress) OC.Progress.emit('cook', { item: rc.out, stars, oc: c.id, count: 1 });
      reward(c, { skill: 'cook', xp: 2 + stars * 2, feel: [stars === 3 ? 'proud' : 'happy', 0.3 + stars * 0.12, '做了' + I(rc.out).zh], mem: { imp: stars === 3 ? 0.6 : 0.4, text: `做了${I(rc.out).zh}（${'★'.repeat(stars)}）`, key: r.entry.key } });
      OC.World.setAction(A().player, 'happy', { dur: 1.4, priority: 6 });
      toast(`完成 ${I(rc.out).zh} ${'★'.repeat(stars)}${n > 1 ? '（完美！多做了一份）' : ''}`, 'sparkle'); if (r.firsts.length) OC.WorldUI.discovered(r.firsts);
    }
  }

  // ======================= critter =======================
  function critter(it) {
    const c = me(), at = it.critter; if (!c || !at) return; const sp = at.species;
    const g = panel(`觀察：${I(sp).zh}`, '牠放鬆時按住慢慢靠近；牠警覺時放開別動');
    let near = 0, alert = 0, seed = Sim().rnd() * 10, done = false;
    g.onEnd = (why) => { if (why === 'cancel' && !done) toast('悄悄離開了', 'info'); };
    loop((dt, t) => {
      const x = g.x; x.clearRect(0, 0, 600, 240); x.fillStyle = OC.World.area.id === 'beach' ? '#F7E3A8' : '#BFE6A8'; x.beginPath(); x.roundRect(0, 0, 600, 240, 24); x.fill();
      const r = I(sp).rarity; alert = Math.max(0, Math.min(1, 0.45 + 0.4 * Math.sin(t * (1.3 + r * 0.25) + seed) + 0.2 * Math.sin(t * 3.1 + seed * 2)));
      g.dbg = { near, alert };
      const lim = OC.Growth && OC.Growth.has(c, 'quiet_steps') ? 0.8 : 0.72;
      if (g.down) { near += dt * (0.32 - r * 0.03) * (OC.Chars.has(c, 'gentle') || OC.Chars.has(c, 'nature') ? 1.15 : 1); if (alert > lim) { done = true; fail(); return; } }
      bar(x, 30, 196, 540, 24, near, '#3FC1B0'); bar(x, 30, 160, 540, 14, alert, alert > 0.72 ? '#F26B5B' : alert > 0.5 ? '#FFC93C' : '#6CCB5F');
      x.save(); x.translate(300 + Math.sin(t * 2) * 30, 80 - near * 20); x.scale(2.6 + near * 1.4, 2.6 + near * 1.4); x.translate(-12, -12); OC.ItemArt[I(sp).art.t](x, I(sp).art.a, I(sp).art.b || '#fff'); x.restore();
      x.fillStyle = '#3B2B25'; x.font = 'bold 24px sans-serif'; x.fillText(alert > 0.72 ? '牠在看你！' : alert > 0.5 ? '有點警覺…' : '放鬆中', 30, 34);
      if (near >= 1 && !done) { done = true; win(); }
    });
    function win() {
      OC.Places.critterDone(it.area, it.i, at.slot);
      const r = OC.Tx.run(at.key, { get: { items: { [sp]: 1 } } }, `捕捉到${I(sp).zh}`);
      close(); OC.WorldUI.refreshVisuals();
      if (!r.ok) { toast(r.dup ? '這隻已經抓過了' : r.why[0], 'info'); return; }
      haptic(); St.stat('critters'); OC.Sound && OC.Sound.play('pickup'); if (OC.Progress) OC.Progress.emit('critter', { item: sp, oc: c.id, place: it.area }); M().skill(c, 'explore', 2); reward(c, { skill: 'garden', xp: 2, feel: ['excited', 0.5, '抓到' + I(sp).zh], mem: { type: 'discover', imp: 0.5, text: `抓到了${I(sp).zh}`, key: at.key } });
      OC.World.setAction(A().player, 'happy', { dur: 1.4, priority: 6 }); toast(`抓到了 ${I(sp).zh}！`, 'sparkle'); if (r.firsts.length) OC.WorldUI.discovered(r.firsts);
    }
    function fail() { OC.Places.critterDone(it.area, it.i, at.slot); close(); OC.WorldUI.refreshVisuals(); toast(`${I(sp).zh}跑掉了…`, 'leaf'); M().feel(c, 'confused', 0.2, I(sp).zh + '跑掉了'); }
  }

  // ======================= 15.2: Rainbow Fair =======================
  const today = () => Sim().day();
  /** concert on the open-air stage: notes slide down three lanes; tap the lane as a note crosses the line.
   *  Paid once per OC per game day (key concert:<oc>:<day>); later shows still count for skills, memories and the progress bus. */
  function concert(it) {
    const c = me(), P = A().player; if (!c || !P) return;
    OC.World.setAction(P, 'sing', { priority: 7 }); P.tFace = 0; P.tBack = 0;
    const g = panel('星光舞台：演唱會', '音符碰到線的時候，按那一條線');
    const lv = M().skillLv(c, 'music'), win = 0.11 + Math.min(0.05, lv * 0.006) + (OC.Chars.has(c, 'outgoing') ? 0.01 : 0), speed = 0.42;
    const r = OC.rng(OC.hash(today() * 3.3 + c.id.length) * 1e6), notes = [];
    for (let i = 0, t = 1.4; i < 24; i++) { t += 0.55 + r() * 0.5; notes.push({ t, lane: Math.floor(r() * 3), st: 0 }); }
    const endT = notes[notes.length - 1].t + 1.2; let hit = 0, perfect = 0, combo = 0, best = 0, done = false, flash = [0, 0, 0], tNow = 0;
    const laneOf = (e) => { const rc = g.cv.getBoundingClientRect(); return Math.max(0, Math.min(2, Math.floor(((e.clientX - rc.left) / rc.width) * 3))); };
    g.onDown = (e) => {
      if (done) return; const ln = laneOf(e); flash[ln] = 0.18; tNow = (performance.now() - g.t0) / 1000;   /* judge at the moment of the press, not the last frame */
      let bestN = null, bd = 9; for (const n of notes) if (!n.st && n.lane === ln) { const d = Math.abs(n.t - tNow); if (d < bd) { bd = d; bestN = n; } }
      if (bestN && bd < win) { bestN.st = bd < win * 0.45 ? 2 : 1; hit++; if (bestN.st === 2) perfect++; combo++; best = Math.max(best, combo); haptic(); OC.Sound && OC.Sound.play('chime'); if (combo % 6 === 0) OC.World.setAction(P, 'dance', { dur: 1.2, priority: 7 }); }
      else { combo = 0; }
    };
    g.onEnd = (why) => { if (why === 'cancel' && !done) { toast('表演中斷了', 'info'); } };
    const crowd = Object.values(A().mates || {}); crowd.forEach((a) => OC.World.setAction(a, 'clap', { dur: 30, priority: 5 }));
    loop((dt, t) => {
      tNow = t; const x = g.x, W = 600; x.clearRect(0, 0, W, 240);
      x.fillStyle = '#3A2B4E'; x.beginPath(); x.roundRect(0, 0, W, 240, 24); x.fill();
      for (let l = 0; l < 3; l++) { x.fillStyle = flash[l] > 0 ? 'rgba(247,200,63,.35)' : 'rgba(255,255,255,.06)'; x.fillRect(l * 200 + 8, 8, 184, 224); flash[l] = Math.max(0, flash[l] - dt); }
      x.fillStyle = '#F7C83F'; x.fillRect(16, 196, 568, 6);
      for (const n of notes) {
        if (!n.st && tNow - n.t > win) { n.st = -1; combo = 0; }
        if (n.st) continue; const y = 196 - (n.t - tNow) * speed * 400; if (y < -20) continue;
        x.fillStyle = ['#F26B5B', '#7FD8C4', '#A58BE0'][n.lane]; x.beginPath(); x.arc(n.lane * 200 + 100, y, 16, 0, Math.PI * 2); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(n.lane * 200 + 95, y - 5, 5, 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.fillText(`${hit}/${notes.length}　連擊 ${combo}`, 24, 38);
      g.dbg = { t0: g.t0, t: tNow, hit, perfect, combo, done, notes: notes.map((n) => ({ t: n.t, lane: n.lane, st: n.st })), win };
      if (t > endT && !done) { done = true; finish(); }
    });
    function finish() {
      const sc = (hit + perfect * 0.5) / (notes.length * 1.5), stars = sc >= 0.8 ? 3 : sc >= 0.5 ? 2 : sc >= 0.2 ? 1 : 0;
      close(); crowd.forEach((a) => OC.World.setAction(a, stars ? 'cheerup' : 'idle', { dur: 1.6, priority: 5 }));
      if (!stars) { toast('有點緊張，下次再上台吧', 'info'); M().feel(c, 'down', 0.15, '演唱會不太順'); return; }
      const pay = 30 + stars * 30 + crowd.length * 10;
      const rr = OC.Tx.run(`concert:${c.id}:${today()}`, { get: { coins: pay } }, `星光舞台演唱會（${'★'.repeat(stars)}）`, { stars });
      St.stat('concerts'); OC.Sound && OC.Sound.play('fanfare');
      if (OC.Progress) OC.Progress.emit('concert', { oc: c.id, stars, place: 'fair', near: [c.id].concat(Object.keys(A().mates || {})) });
      reward(c, { skill: 'music', xp: 3 + stars * 2, feel: [stars === 3 ? 'proud' : 'happy', 0.35 + stars * 0.12, '開了演唱會'], mem: { imp: stars === 3 ? 0.75 : 0.5, text: `在星光舞台開了演唱會（${'★'.repeat(stars)}${crowd.length ? `，有 ${crowd.length} 位朋友在台下` : ''}）`, key: 'concert:' + c.id + ':' + today() } });
      OC.World.setAction(A().player, stars === 3 ? 'jump' : 'bow', { dur: 1.6, priority: 6 }); if (stars === 3) OC.World.jump(A().player);
      toast(`演唱會 ${'★'.repeat(stars)}　最高連擊 ${best}` + (rr.ok ? `　+${pay} 星幣` : '（今天的演出費已經領過了）'), 'sparkle');
    }
  }
  /** ring toss: three rings, 20 coins a game; tap when the swinging marker is over a bottle. Prizes by hits. */
  const TOSS_COST = 20, BOTTLES = [0.14, 0.28, 0.42, 0.56, 0.7, 0.84];
  function toss(it) {
    const c = me(), P = A().player; if (!c || !P) return;
    if (OC.Store.s.coins < TOSS_COST) { toast(`要 ${TOSS_COST} 星幣才能玩`, 'info'); return; }
    const pay = OC.Tx.run(OC.Tx.uid('toss'), { pay: { coins: TOSS_COST } }, '套圈圈（3 個圈）'); if (!pay.ok) { toast(pay.why[0], 'info'); return; }
    OC.World.setAction(P, 'wave', { priority: 7 }); P.tBack = 1;
    const g = panel('套圈圈', '標記停在瓶子上的時候點一下，把圈丟出去');
    const lv = M().skillLv(c, 'sport'); let m = 0.1, dir = 1, left = 3, hits = 0, flying = null, landed = [], done = false;
    const sp = 0.75 - Math.min(0.25, lv * 0.03), tol = 0.035 + (OC.Chars.has(c, 'diligent') ? 0.006 : 0);
    g.onDown = () => { if (flying || done || left <= 0) return; flying = { x: m, t: 0 }; left--; OC.Sound && OC.Sound.play('whoosh'); };
    g.onEnd = (why) => { if (why === 'cancel' && !done) toast('圈還沒丟完，錢不會退喔', 'info'); };
    loop((dt) => {
      const x = g.x; x.clearRect(0, 0, 600, 240); x.fillStyle = css('--surface-2'); x.beginPath(); x.roundRect(0, 0, 600, 240, 24); x.fill();
      x.fillStyle = '#D9A26A'; x.fillRect(20, 150, 560, 14);
      BOTTLES.forEach((b, i) => { x.fillStyle = ['#7FD8C4', '#F29AB4', '#F7C83F', '#62B5E5'][i % 4]; x.beginPath(); x.roundRect(20 + b * 560 - 10, 100, 20, 50, 6); x.fill(); x.fillRect(20 + b * 560 - 4, 84, 8, 18); });
      for (const l of landed) { x.strokeStyle = l.hit ? '#F26B5B' : 'rgba(120,92,52,.5)'; x.lineWidth = 5; x.beginPath(); x.ellipse(20 + l.x * 560, l.hit ? 104 : 170, 16, 6, 0, 0, Math.PI * 2); x.stroke(); }
      if (!flying && !done && left > 0) { m += dir * dt * sp; if (m > 0.95 || m < 0.05) { dir *= -1; m = Math.max(0.05, Math.min(0.95, m)); } x.fillStyle = '#F26B5B'; x.beginPath(); x.moveTo(20 + m * 560, 60); x.lineTo(20 + m * 560 - 10, 40); x.lineTo(20 + m * 560 + 10, 40); x.closePath(); x.fill(); }
      if (flying) { flying.t += dt * 2.4; const y = 220 - Math.sin(Math.min(1, flying.t) * Math.PI) * 150 - flying.t * 60; x.strokeStyle = '#F26B5B'; x.lineWidth = 5; x.beginPath(); x.ellipse(20 + flying.x * 560, Math.max(104, y), 16, 6, 0, 0, Math.PI * 2); x.stroke();
        if (flying.t >= 1) { const hit = BOTTLES.some((b) => Math.abs(b - flying.x) < tol); if (hit) { hits++; haptic(); OC.Sound && OC.Sound.play('chime'); } landed.push({ x: flying.x, hit }); flying = null; if (left <= 0) { done = true; setTimeout(finish, 500); } } }
      x.fillStyle = css('--ink'); x.font = 'bold 26px sans-serif'; x.fillText(`剩 ${left} 個圈　套中 ${hits}`, 24, 34);
      g.dbg = { m, left, hits, flying: !!flying, bottles: BOTTLES, tol, done };
    });
    function finish() {
      if (!cur) return; close();
      const prize = hits >= 3 ? 'prize_star' : hits === 2 ? 'prize_bear' : hits === 1 ? 'popcorn' : null;
      St.stat('toss'); if (OC.Progress) OC.Progress.emit('toss', { oc: c.id, hits, place: 'fair' });
      if (!prize) { toast('一個都沒套中……再來一次？', 'info'); M().feel(c, 'confused', 0.15, '套圈圈沒中'); return; }
      const r = OC.Tx.run('toss:' + pay.entry.key, { get: { items: { [prize]: 1 } } }, `套圈圈獎品：${I(prize).zh}`);
      reward(c, { skill: 'sport', xp: 1 + hits, feel: [hits >= 3 ? 'excited' : 'happy', 0.25 + hits * 0.12, '套中了' + hits + '個'] });
      OC.World.setAction(A().player, hits >= 3 ? 'jump' : 'happy', { dur: 1.4, priority: 6 }); if (hits >= 3) OC.World.jump(A().player);
      toast(`套中 ${hits} 個！獎品：${I(prize).zh}`, 'sparkle'); if (r.firsts && r.firsts.length) OC.WorldUI.discovered(r.firsts);
    }
  }
  /** Ferris wheel: the played OC goes up in a cabin (hidden from the ground; that cabin shows a light) for one turn */
  let riding = null;
  function wheel(it) {
    const c = me(), P = A().player, fw = OC.World.area && OC.World.area.wheel; if (!c || !P || !fw || riding) return;
    const cabin = fw.cabins.reduce((a, b) => { const ya = Math.sin(a.userData.a + fw.wheel.rotation.z), yb = Math.sin(b.userData.a + fw.wheel.rotation.z); return yb < ya ? b : a; });
    OC.Brain.hold(c.id, 'activity'); P.hidden = true; cabin.userData.flag.visible = true; OC.Sound && OC.Sound.play('chime');
    riding = { c, P, cabin, at: Date.now() };
    toast(`${OC.Chars.name(c)}搭上摩天輪了（亮著的那一節）`, 'sparkle');
    const end = () => {
      if (!riding) return; const R = riding; riding = null;
      R.cabin.userData.flag.visible = false; R.P.hidden = false; OC.Brain.unhold(R.c.id, 'activity');
      if (OC.World.area && OC.World.area.id === 'fair') OC.World.setAction(R.P, 'happy', { dur: 1.4, priority: 6 });
      M().feel(R.c, 'happy', 0.4, '搭了摩天輪'); OC.Store.needs && R.c.id === S().activeId && OC.Store.needs({ fun: 12, mood: 8 });
      M().remember(R.c, { type: 'activity', imp: 0.5, place: 'place:fair', text: '搭摩天輪，從最高的地方看到整座島', key: `wheel:${R.c.id}:${today()}` });
      if (OC.Progress) OC.Progress.emit('ride', { oc: R.c.id, kind: 'wheel', place: 'fair' });
    };
    setTimeout(end, 14000);
  }
  const wheelRiding = () => !!riding;

  OC.Mini = { fishing, cooking, cookGame, critter, concert, toss, wheel, wheelRiding, TOSS_COST, RECIPES, ingredients, close, get active() { return !!cur; }, get state() { return cur ? Object.assign({ rect: cur.cv.getBoundingClientRect().toJSON() }, cur.dbg || {}) : null; } };
})();
