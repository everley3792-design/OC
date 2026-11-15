/* OC Shimeji 16.10 — 彩虹遊樂園的新設施（OC.Fair16）
 *
 * Seven new booths at the fair, each a short mini-game played with real touch (one canvas, pointer events):
 *   coaster 雲霄飛車  drag left / right to lean the car: dodge the barrels, catch the stars
 *   bumper  碰碰車    drag to steer, bump the other cars (your companions drive them)
 *   haunted 鬼屋      tap the little ghosts before they reach you; timid companions really get scared
 *   shoot   射擊攤    tap the moving targets; hits in a row make a combo
 *   hoops   投籃      flick upwards; the ball flies along the flick, swish = more points
 *   teacup  旋轉茶杯  circle your finger to spin the cup; keep it in the fun zone, not the dizzy one
 *   maze    鏡子迷宮  drag through the mirror maze (a new one each day) to the exit
 * Before a game you choose who comes along (characters here and free). Each companion decides by personality: the timid
 * do not come on the coaster or into the haunted house (with a reason). Everyone who played gets a memory and feels it
 * (excited / scared / dizzy), and the pair grows closer. A ticket costs 15 星幣 (OC.Tx); the prize comes once per game,
 * character and day (key fair16:<game>:<oc>:<day>), so replaying does not farm prizes. Characters also play by
 * themselves when they are at the fair (an AI activity at the booth; the scary ones are avoided by the timid).
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = () => OC.Store, M = () => OC.Mind, Sim = () => OC.Sim, Ch = () => OC.Chars, A = () => OC.App, B = () => OC.Brain, W = () => OC.World;
  const h = (...a) => OC.UI.h(...a), toast = (t, i) => OC.UI.toast(t, i);
  const has = (c, t) => !!(c && c.personality.traits.includes(t));
  const any = (c, ts) => ts.some((t) => has(c, t));
  const name = (c) => Ch().name(c);
  const TICKET = 15, DUR = 25;
  /* [id, 名稱, 顏色, 可怕, 比賽, 說明, 攤位位置] */
  const GAMES = [
    ['coaster', '雲霄飛車', '#F26B5B', true, false, '左右拖曳讓車子傾斜：閃開木桶、接住星星', [100, 470]],
    ['bumper', '碰碰車', '#62B5E5', false, true, '拖曳開車，撞到別的車就得分', [450, 370]],
    ['haunted', '鬼屋', '#6B5B95', true, false, '小幽靈靠近之前點牠一下', [470, 590]],
    ['shoot', '射擊攤', '#F7C83F', false, true, '點移動的靶，連續打中有加成', [130, 730]],
    ['hoops', '投籃', '#F29A4A', false, true, '往上滑把球丟出去，空心進籃分數最高', [455, 750]],
    ['teacup', '旋轉茶杯', '#F29AB4', false, false, '手指畫圓讓杯子轉，保持在開心的速度，不要轉到頭暈', [150, 565]],
    ['maze', '鏡子迷宮', '#7FD8C4', false, false, '拖曳穿過迷宮找到出口（每天不一樣）', [320, 705]],
  ].map(([id, zh, col, scary, vs, d, at]) => ({ id, zh, col, scary, vs, d, at }));
  const G = Object.fromEntries(GAMES.map((g) => [g.id, g]));
  /* a stable 0…1 number for any key */
  const hs = (k) => { let x = 2166136261; for (const ch of String(k)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return ((x >>> 0) % 100000) / 100000; };
  function rng(seed) { let s = Math.floor(hs(seed) * 2 ** 31) || 1; return () => ((s = Math.imul(s, 48271) % 2147483647) & 0x7fffffff) / 2147483647; }

  // ================================================================ the booths in the world
  const AR = OC.Areas;
  if (AR.fair && AR._fair) {
    const prev = AR.fair.build;
    AR.fair.build = function (ctx) {
      prev.call(this, ctx);
      for (const g of GAMES) {
        const [x, y] = g.at, b = AR._fair.booth({ title: g.zh, a: g.col });
        AR._fair.place(ctx, b, x, y, 0, 1.2); ctx.block(x, y, 32, 12);
        ctx.interact({ type: 'fair16', game: g.id, x, y: y + 8, hit: { w: 60, h: 60, d: 10 }, at: { x, y: y + 28 }, label: g.zh });
      }
    };
    const pw = AR.fair.walk; AR.fair.walk = (x, y) => pw(x, y) && !GAMES.some((g) => Math.abs(x - g.at[0]) < 34 && y > g.at[1] - 10 && y < g.at[1] + 12);
  }
  OC.Places.P.fair.acts = (OC.Places.P.fair.acts || []).concat(['fairride16']);
  OC.LifeData.ACTS.fairride16 = { zh: '玩遊樂設施', ic: '🎢', verb: 'ride16', fx: { fun: 220, social: 30, energy: -20 }, dur: [6, 10], anim: 'cheer', cat: 'fun' };

  // ================================================================ companions
  /** who could come along: characters in this place, awake and free */
  function nearby(meId) {
    return Ch().all().filter((c) => c.id !== meId && A().actorOf && A().actorOf(c.id) && (() => { const b = B().get(c.id); return b && !b.holds.size && !(b.st === 'do' && ['sleep', 'work16', 'school16'].includes(b.act)); })());
  }
  /** will `c` come on this ride? → null (yes) or the reason */
  function refuses(c, g) {
    if (OC.People && OC.People.stage(c) && ['baby', 'toddler'].includes(OC.People.stage(c).id)) return '年紀太小';
    if (g.scary && any(c, ['timid', 'shy', 'nervous']) && !any(c, ['brave', 'adventurous'])) return g.id === 'haunted' ? '鬼屋……我在外面等你們' : '太高太快了，我不要';
    if (g.id === 'teacup' && has(c, 'lightsleeper') && c.needs.energy < 30) return '會暈，下次吧';
    if (c.needs.energy < 15) return '好累，想休息';
    return null;
  }

  // ================================================================ one game
  let cur = null;
  function play(id, o = {}) {
    const g = G[id], me = A().me && A().me(); if (!g || !me) return { ok: false, why: '找不到' };
    if (cur) return { ok: false, why: '正在玩' };
    const pick = new Set((o.with || []).filter((x) => Ch().get(x)));
    if (o.skipSetup) return start(g, me, [...pick]);
    const cands = nearby(me.id); let opened = true;
    OC.UI.sheet(g.zh, (box, api) => {
      box.append(h('p.muted', null, `${g.d}。一張票 ${TICKET} 星幣。`), h('div.muted', null, cands.length ? '跟誰一起？（可以不選）' : '附近沒有其他人，一個人玩。'),
        h('div.chips.f16-with', null, ...cands.map((c) => { const why = refuses(c, g); const b = h('button.chip' + (why ? '.locked' : ''), { 'data-with': c.id, disabled: !!why, title: why || '', on: { click: () => { if (pick.has(c.id)) pick.delete(c.id); else if (pick.size < 3) pick.add(c.id); b.classList.toggle('on', pick.has(c.id)); } } }, name(c) + (why ? `（${why}）` : '')); return b; })),
        h('button.btn.primary.block', { 'data-f16': 'start', style: { marginTop: '10px' }, on: { click: () => { opened = false; api.close(); start(g, me, [...pick]); } } }, `開始（${TICKET} 星幣）`));
      OC.Pick && OC.Pick.guard(box);
    }, { onClose: () => void opened });
    return { ok: true, setup: true };
  }
  function start(g, me, withIds) {
    if (S().coins < TICKET) { toast(`要 ${TICKET} 星幣才能玩`, 'info'); return { ok: false, why: '星幣不夠' }; }
    const pay = OC.Tx.run(OC.Tx.uid('fair16'), { pay: { coins: TICKET } }, `${G[g.id].zh}的票`); if (!pay.ok) { toast((pay.why || ['付不出來'])[0], 'info'); return { ok: false, why: '付不出來' }; }
    const mates = withIds.map((id) => Ch().get(id)).filter((c) => c && !refuses(c, g));
    const ids = [me.id].concat(mates.map((c) => c.id)); for (const id of ids) B().hold(id, 'game');
    const cv = h('canvas', { width: 600, height: 600 }); cv.style.cssText = 'width:100%;max-height:58vh;aspect-ratio:1;touch-action:none;border-radius:18px';
    const info = h('div.mini-hint'), el = h('div.mini.f16', { role: 'dialog', 'aria-label': g.zh, 'data-game': g.id }, h('div.hstack', null, h('b.grow', null, g.zh), h('button.icon-btn', { 'aria-label': '結束', on: { click: () => finish('cancel') } }, OC.UI.icon('close', 's'))), cv, info);
    document.getElementById('app').append(el); requestAnimationFrame(() => el.classList.add('open'));
    const layer = { scrim: false, close: () => finish('cancel') }; OC.UI.pushLayer(layer);
    const rnd = rng(g.id + ':' + Sim().day() + ':' + (S().play && S().play.f16n || 0));
    cur = { g, me, mates, ids, el, cv, x: cv.getContext('2d'), info, layer, t: 0, score: 0, over: false, rnd, pay, raf: 0, st: {}, pts: [] };
    GAME[g.id].init(cur);
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 600, y: (e.clientY - r.top) / r.height * 600, t: performance.now() }; };
    cv.addEventListener('pointerdown', (e) => { if (!cur || cur.over) return; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ } cur.down = pos(e); cur.pts = [cur.down]; GAME[g.id].down && GAME[g.id].down(cur, cur.down); });
    cv.addEventListener('pointermove', (e) => { if (!cur || cur.over || !cur.down) return; const p = pos(e); cur.pts.push(p); if (cur.pts.length > 24) cur.pts.shift(); GAME[g.id].move && GAME[g.id].move(cur, p); });
    const up = (e) => { if (!cur || cur.over || !cur.down) return; const p = pos(e); GAME[g.id].up && GAME[g.id].up(cur, p); cur.down = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    let last = performance.now();
    const step = (now) => { if (!cur) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!cur.over) { cur.t += dt; GAME[g.id].update(cur, dt); if (cur.t >= (cur.dur || DUR) || cur.done) finish('end'); } if (cur) { draw(cur); cur.raf = requestAnimationFrame(step); } };
    cur.raf = requestAnimationFrame(step);
    if (OC.Sound && OC.Sound.play) OC.Sound.play('chime');
    return { ok: true };
  }
  function draw(c) {
    const x = c.x; x.clearRect(0, 0, 600, 600); x.fillStyle = '#FFF7EC'; x.fillRect(0, 0, 600, 600);
    GAME[c.g.id].draw(c, x);
    x.fillStyle = '#6F5438'; x.font = 'bold 26px sans-serif'; x.textAlign = 'left'; x.fillText(`分數 ${Math.round(c.score)}`, 18, 36);
    x.textAlign = 'right'; x.fillText(`${Math.max(0, Math.ceil((c.dur || DUR) - c.t))} 秒`, 582, 36); x.textAlign = 'left';
    c.info.textContent = c.g.d;
  }
  /** the game ends (time, goal or the player closes it): reactions, memories, closeness, the prize */
  function finish(why) {
    const c = cur; if (!c) return; cur = null; c.over = true; cancelAnimationFrame(c.raf); OC.UI.popLayer(c.layer); c.el.classList.remove('open'); setTimeout(() => c.el.remove(), 300);
    for (const id of c.ids) B().unhold(id, 'game');
    S().play.f16n = (S().play.f16n || 0) + 1;
    const g = c.g, day = Sim().day(), score = Math.round(c.score), res = { why, score, mates: [], prize: null, rivals: [] };
    if (why === 'cancel' && c.t < 3) { toast('沒玩就離開了（票不退）', 'info'); return res; }
    const people = [c.me].concat(c.mates);
    /* the rivals' own scores in a contest (their skill and personality) */
    if (g.vs) for (const m of c.mates) { const s2 = Math.round(score * (0.55 + hs(m.id + day + g.id) * 0.7) + (any(m, ['competitive', 'sporty']) ? 6 : 0)); res.rivals.push([m.id, s2]); }
    for (const p of people) {
      const scared = g.scary && any(p, ['timid', 'shy', 'nervous']), brave = any(p, ['brave', 'adventurous']);
      const emo = g.id === 'teacup' && (c.st.dizzy || 0) > 0.6 ? ['confused', 0.3, '轉到頭暈'] : scared ? ['nervous', 0.45, `${g.zh}好可怕`] : ['excited', 0.35 + (brave && g.scary ? 0.2 : 0), g.zh];
      M().feel(p, emo[0], emo[1], emo[2]); p.needs.fun = Math.min(100, p.needs.fun + 25);
      const others = people.filter((q) => q !== p);
      M().remember(p, { type: 'activity', imp: 0.4, who: others.map((q) => q.id), place: 'place:fair', text: others.length ? `和${others.map(name).join('、')}一起玩${g.zh}${scared ? '，嚇死了' : ''}` : `玩了${g.zh}（${score} 分）`, key: `f16:${g.id}:${p.id}:${day}` });
    }
    for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) M().relPair(people[i].id, people[j].id, { fam: 2, aff: 1 }, `一起玩${g.zh}`);
    res.mates = c.mates.map((m) => m.id);
    const prize = score >= 60 ? 'prize_star' : score >= 30 ? 'prize_bear' : score >= 10 ? 'popcorn' : null;
    if (prize) {
      const r = OC.Tx.run(`fair16:${g.id}:${c.me.id}:${day}`, { get: { items: { [prize]: 1 } } }, `${g.zh}的獎品`);
      if (r.ok) { res.prize = prize; toast(`${score} 分！獎品：${OC.Style.ITEMS[prize].zh}`, 'sparkle'); } else toast(`${score} 分（今天的獎品已經拿過了）`, 'info');
    } else toast(`${score} 分`, 'info');
    if (res.rivals.length) { const best = res.rivals.reduce((a, b) => (b[1] > a[1] ? b : a), [c.me.id, score]); if (best[0] !== c.me.id) toast(`${name(Ch().get(best[0]))}贏了（${best[1]} 分）`, 'info'); }
    OC.Progress && OC.Progress.emit('fair', { oc: c.me.id, game: g.id, score, ocs: people.map((p) => p.id), place: 'fair' });
    if (OC.Sound && OC.Sound.cue) OC.Sound.cue('mini');
    St().emit('fair16:end', res); last = res;
    return res;
  }
  let last = null;

  // ================================================================ the seven games (init · update · draw · input)
  const lerp = (a, b, t) => a + (b - a) * t;
  const circle = (x, cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
  const MATE_COL = ['#62B5E5', '#F29AB4', '#7FD8C4'];
  const GAME = {
    coaster: {
      init(c) { c.st = { lean: 0, tx: 300, items: [], spawn: 0, scream: 0 }; c.dur = 22; },
      down(c, p) { c.st.tx = p.x; }, move(c, p) { c.st.tx = p.x; },
      update(c, dt) { const s = c.st; s.lean = lerp(s.lean, s.tx, Math.min(1, dt * 8)); s.spawn -= dt;
        if (s.spawn <= 0) { s.spawn = 0.55; s.items.push({ x: 80 + c.rnd() * 440, y: -20, star: c.rnd() < 0.55 }); }
        for (const it of s.items) { it.y += dt * (260 + c.t * 8); if (!it.hit && Math.abs(it.y - 500) < 26 && Math.abs(it.x - s.lean) < 46) { it.hit = true; if (it.star) { c.score += 6; } else { c.score = Math.max(0, c.score - 4); s.scream = 0.6; } } }
        s.items = s.items.filter((it) => it.y < 640 && !it.hit); s.scream = Math.max(0, s.scream - dt); },
      draw(c, x) { const s = c.st; x.strokeStyle = '#D9A26A'; x.lineWidth = 10; for (let i = 0; i < 2; i++) { x.beginPath(); x.moveTo(60 + i * 480, 0); x.bezierCurveTo(200 + i * 200, 300, 100 + i * 400, 400, 60 + i * 480, 600); x.stroke(); }
        for (const it of s.items) { if (it.star) { x.fillStyle = '#F7C83F'; x.font = '40px sans-serif'; x.fillText('★', it.x - 18, it.y + 14); } else circle(x, it.x, it.y, 20, '#8A5A3C'); }
        x.fillStyle = '#F26B5B'; x.beginPath(); x.roundRect(s.lean - 46, 480, 92, 40, 12); x.fill(); x.font = '24px sans-serif'; x.fillStyle = '#fff'; x.fillText(s.scream > 0 ? '哇——' : '🙂', s.lean - 30, 508);
        c.mates.forEach((m, i) => { x.fillStyle = '#6F5438'; x.font = '18px sans-serif'; x.fillText(name(m) + (any(m, ['adventurous', 'brave']) ? '：好好玩！' : '：抓緊……'), 20, 560 - i * 24); }); },
    },
    bumper: {
      init(c) { c.st = { me: { x: 300, y: 450, vx: 0, vy: 0 }, cars: c.mates.concat(c.mates.length ? [] : [null, null]).slice(0, 3).map((m, i) => ({ m, x: 120 + i * 180, y: 180, vx: (i - 1) * 60 + 40, vy: 70, cd: 0 })), tgt: null }; c.dur = 25; },
      down(c, p) { c.st.tgt = p; }, move(c, p) { c.st.tgt = p; }, up(c) { c.st.tgt = null; },
      update(c, dt) { const s = c.st, me = s.me;
        if (s.tgt) { me.vx += (s.tgt.x - me.x) * dt * 3; me.vy += (s.tgt.y - me.y) * dt * 3; }
        for (const o of [me].concat(s.cars)) { o.vx *= 0.985; o.vy *= 0.985; o.x += o.vx * dt; o.y += o.vy * dt; if (o.x < 50 || o.x > 550) o.vx *= -1; if (o.y < 80 || o.y > 560) o.vy *= -1; o.x = Math.max(50, Math.min(550, o.x)); o.y = Math.max(80, Math.min(560, o.y)); }
        for (const o of s.cars) { o.cd -= dt; if (o.cd > 0) continue; o.vx += (c.rnd() - 0.5) * 30; o.vy += (c.rnd() - 0.5) * 30; const d = Math.hypot(o.x - me.x, o.y - me.y); if (d < 70) { const sp = Math.hypot(me.vx, me.vy); c.score += Math.min(12, 3 + sp / 40); o.vx += (o.x - me.x) * 4; o.vy += (o.y - me.y) * 4; me.vx *= -0.5; me.vy *= -0.5; o.cd = 0.8; OC.UI.haptic && OC.UI.haptic(); } } },
      draw(c, x) { const s = c.st; x.fillStyle = '#E8F0F7'; x.fillRect(30, 60, 540, 520);
        s.cars.forEach((o, i) => { circle(x, o.x, o.y, 34, MATE_COL[i % 3]); x.fillStyle = '#fff'; x.font = '16px sans-serif'; x.fillText(o.m ? name(o.m).slice(0, 3) : '路人車', o.x - 22, o.y + 6); });
        circle(x, s.me.x, s.me.y, 36, '#F26B5B'); x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.fillText(name(c.me).slice(0, 3), s.me.x - 22, s.me.y + 6); },
    },
    haunted: {
      init(c) { c.st = { ghosts: [], spawn: 0.4, hp: 5, boo: [] }; c.dur = 25; },
      down(c, p) { const s = c.st; for (const g of s.ghosts) if (!g.gone && Math.hypot(g.x - p.x, g.y - p.y) < 50) { g.gone = true; c.score += 4; OC.Sound && OC.Sound.play && OC.Sound.play('pop'); return; } },
      update(c, dt) { const s = c.st; s.spawn -= dt; if (s.spawn <= 0) { s.spawn = Math.max(0.35, 1.0 - c.t * 0.025); const a = c.rnd() * Math.PI * 2; s.ghosts.push({ x: 300 + Math.cos(a) * 320, y: 330 + Math.sin(a) * 320, r: 0 }); }
        for (const g of s.ghosts) { if (g.gone) continue; const dx = 300 - g.x, dy = 330 - g.y, d = Math.hypot(dx, dy); g.x += dx / d * dt * 70; g.y += dy / d * dt * 70; g.r += dt;
          if (d < 50) { g.gone = true; s.hp--; c.score = Math.max(0, c.score - 3); const scared = c.mates.find((m) => any(m, ['timid', 'nervous', 'shy']) || c.rnd() < 0.3); if (scared) s.boo.push({ who: scared, t: 1.2 }); } }
        s.ghosts = s.ghosts.filter((g) => !g.gone); s.boo.forEach((b) => (b.t -= dt)); s.boo = s.boo.filter((b) => b.t > 0); if (s.hp <= 0) c.done = true; },
      draw(c, x) { const s = c.st; x.fillStyle = '#2E2645'; x.fillRect(0, 50, 600, 550); circle(x, 300, 330, 34, '#F7C83F');
        for (const g of s.ghosts) { x.globalAlpha = 0.6 + 0.4 * Math.sin(g.r * 6); x.fillStyle = '#F4F1FF'; x.beginPath(); x.arc(g.x, g.y, 26, Math.PI, 0); x.lineTo(g.x + 26, g.y + 24); x.lineTo(g.x - 26, g.y + 24); x.closePath(); x.fill(); x.globalAlpha = 1; circle(x, g.x - 8, g.y - 4, 4, '#2E2645'); circle(x, g.x + 8, g.y - 4, 4, '#2E2645'); }
        x.fillStyle = '#FFF7EC'; x.font = '20px sans-serif'; x.fillText('♥'.repeat(Math.max(0, s.hp)), 20, 580); s.boo.forEach((b, i) => x.fillText(`${name(b.who)}：呀啊——！`, 300, 580 - i * 26)); },
    },
    shoot: {
      init(c) { c.st = { tg: [], spawn: 0, combo: 0 }; c.dur = 20; },
      down(c, p) { const s = c.st; const t = s.tg.find((t2) => !t2.hit && Math.hypot(t2.x - p.x, t2.y - p.y) < t2.r); if (t) { t.hit = true; s.combo++; c.score += 3 + Math.min(5, s.combo); } else s.combo = 0; },
      update(c, dt) { const s = c.st; s.spawn -= dt; if (s.spawn <= 0) { s.spawn = 0.6; const row = Math.floor(c.rnd() * 3); s.tg.push({ x: row % 2 ? 640 : -40, y: 160 + row * 130, v: (row % 2 ? -1 : 1) * (150 + c.rnd() * 120), r: 30 + c.rnd() * 10 }); }
        for (const t of s.tg) t.x += t.v * dt; s.tg = s.tg.filter((t) => !t.hit && t.x > -60 && t.x < 660); },
      draw(c, x) { const s = c.st; for (let r = 0; r < 3; r++) { x.fillStyle = '#E2B27A'; x.fillRect(0, 190 + r * 130, 600, 10); }
        for (const t of s.tg) { circle(x, t.x, t.y, t.r, '#F26B5B'); circle(x, t.x, t.y, t.r * 0.66, '#FFFFFF'); circle(x, t.x, t.y, t.r * 0.33, '#F26B5B'); }
        if (s.combo > 1) { x.fillStyle = '#F2B33D'; x.font = 'bold 30px sans-serif'; x.fillText(`連擊 ×${s.combo}`, 220, 90); } },
    },
    hoops: {
      init(c) { c.st = { ball: null, hoopX: 300, dir: 1, shots: 0, msg: '' }; c.dur = 30; },
      up(c, p) { const s = c.st; if (s.ball) return; const a = c.pts[0] || p, b2 = p, dt = Math.max(0.05, (b2.t - a.t) / 1000), vx = (b2.x - a.x) / dt, vy = (b2.y - a.y) / dt; if (vy > -200) return;
        s.ball = { x: 300, y: 540, vx: vx * 0.6, vy: Math.max(-1100, vy * 0.9), scored: false }; s.shots++; },
      update(c, dt) { const s = c.st; s.hoopX += s.dir * dt * (60 + c.t * 4); if (s.hoopX > 470 || s.hoopX < 130) s.dir *= -1;
        const b = s.ball; if (!b) return; b.vy += 1500 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (!b.scored && b.vy > 0 && Math.abs(b.y - 170) < 14) { const off = Math.abs(b.x - s.hoopX); if (off < 34) { b.scored = true; const swish = off < 14; c.score += swish ? 10 : 6; s.msg = swish ? '空心！' : '進了！'; OC.UI.haptic && OC.UI.haptic(); } }
        if (b.y > 640 || b.x < -40 || b.x > 640) { if (!b.scored) s.msg = '沒進'; s.ball = null; } },
      draw(c, x) { const s = c.st; x.fillStyle = '#FFFFFF'; x.fillRect(s.hoopX - 60, 80, 120, 80); x.strokeStyle = '#F26B5B'; x.lineWidth = 6; x.beginPath(); x.ellipse(s.hoopX, 170, 36, 8, 0, 0, Math.PI * 2); x.stroke();
        if (s.ball) circle(x, s.ball.x, s.ball.y, 22, '#F29A4A'); else circle(x, 300, 540, 22, '#F29A4A');
        x.fillStyle = '#6F5438'; x.font = 'bold 28px sans-serif'; if (s.msg) x.fillText(s.msg, 250, 330); },
    },
    teacup: {
      init(c) { c.st = { ang: 0, spin: 0, dizzy: 0, last: null }; c.dur = 20; },
      down(c, p) { c.st.last = Math.atan2(p.y - 330, p.x - 300); c.st.lt = p.t; },
      /* the cup follows how fast the finger circles (radians per second, smoothed) */
      move(c, p) { const s = c.st, a = Math.atan2(p.y - 330, p.x - 300); if (s.last != null) { let d = a - s.last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; const dts = Math.max(0.016, (p.t - s.lt) / 1000); s.spin = lerp(s.spin, Math.min(14, Math.abs(d) / dts), 0.25); } s.last = a; s.lt = p.t; },
      up(c) { c.st.last = null; },
      update(c, dt) { const s = c.st; s.spin *= Math.exp(-dt * (c.down ? 0.3 : 1.2)); s.ang += s.spin * dt; const fun = s.spin > 2 && s.spin < 7; if (fun) c.score += dt * 3.2; if (s.spin > 8) s.dizzy = Math.min(1, s.dizzy + dt * 0.35); else s.dizzy = Math.max(0, s.dizzy - dt * 0.15); if (s.dizzy >= 1) c.done = true; },
      draw(c, x) { const s = c.st; x.save(); x.translate(300, 330); x.rotate(s.ang); x.fillStyle = '#F29AB4'; x.beginPath(); x.arc(0, 0, 150, 0, Math.PI * 2); x.fill(); x.fillStyle = '#FFF7EC'; x.beginPath(); x.arc(0, 0, 110, 0, Math.PI * 2); x.fill(); for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); circle(x, 130, 0, 10, '#FFFFFF'); } x.restore();
        const col = s.spin > 7 ? '#F26B5B' : s.spin > 2 ? '#3FC1B0' : '#D8D2C8'; x.fillStyle = '#EFE6D6'; x.fillRect(60, 530, 480, 18); x.fillStyle = col; x.fillRect(60, 530, Math.min(480, s.spin / 10 * 480), 18);
        x.fillStyle = '#6F5438'; x.font = '20px sans-serif'; x.fillText(s.spin > 7 ? '太快了！' : s.spin > 2 ? '剛剛好！' : '轉起來…', 60, 520); if (s.dizzy > 0.2) x.fillText(`頭暈 ${Math.round(s.dizzy * 100)}%`, 400, 520); },
    },
    maze: {
      init(c) {
        const N = 9, r = rng('maze:' + Sim().day()), cells = Array.from({ length: N * N }, () => ({ w: [1, 1, 1, 1], v: false }));   /* walls: top, right, bottom, left */
        const stack = [0]; cells[0].v = true;
        while (stack.length) { const i = stack[stack.length - 1], x0 = i % N, y0 = (i / N) | 0, nb = [];
          if (y0 > 0 && !cells[i - N].v) nb.push([i - N, 0, 2]); if (x0 < N - 1 && !cells[i + 1].v) nb.push([i + 1, 1, 3]); if (y0 < N - 1 && !cells[i + N].v) nb.push([i + N, 2, 0]); if (x0 > 0 && !cells[i - 1].v) nb.push([i - 1, 3, 1]);
          if (!nb.length) { stack.pop(); continue; } const [j, a, b] = nb[Math.floor(r() * nb.length)]; cells[i].w[a] = 0; cells[j].w[b] = 0; cells[j].v = true; stack.push(j); }
        c.st = { N, cells, at: 0, cs: 56, ox: 48, oy: 70 }; c.dur = 45;
      },
      move(c, p) { const s = c.st, N = s.N, i = s.at, x0 = i % N, y0 = (i / N) | 0, cx = s.ox + (x0 + 0.5) * s.cs, cy = s.oy + (y0 + 0.5) * s.cs, dx = p.x - cx, dy = p.y - cy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < s.cs * 0.6) return; const w = s.cells[i].w;
        if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0 && !w[1]) s.at = i + 1; else if (dx < 0 && !w[3]) s.at = i - 1; } else { if (dy > 0 && !w[2]) s.at = i + N; else if (dy < 0 && !w[0]) s.at = i - N; }
        if (s.at === N * N - 1 && !c.done) { c.score = Math.round(30 + Math.max(0, 45 - c.t) * 1.5); c.done = true; } },
      update() {},
      draw(c, x) { const s = c.st, N = s.N; x.strokeStyle = '#7FD8C4'; x.lineWidth = 5; x.lineCap = 'round';
        s.cells.forEach((cl, i) => { const X = s.ox + (i % N) * s.cs, Y = s.oy + ((i / N) | 0) * s.cs; x.beginPath(); if (cl.w[0]) { x.moveTo(X, Y); x.lineTo(X + s.cs, Y); } if (cl.w[1]) { x.moveTo(X + s.cs, Y); x.lineTo(X + s.cs, Y + s.cs); } if (cl.w[2]) { x.moveTo(X, Y + s.cs); x.lineTo(X + s.cs, Y + s.cs); } if (cl.w[3]) { x.moveTo(X, Y); x.lineTo(X, Y + s.cs); } x.stroke(); });
        const ex = s.ox + (N - 0.5) * s.cs, ey = s.oy + (N - 0.5) * s.cs; x.fillStyle = '#F7C83F'; x.font = '34px sans-serif'; x.fillText('★', ex - 16, ey + 12);
        circle(x, s.ox + (s.at % N + 0.5) * s.cs, s.oy + (((s.at / N) | 0) + 0.5) * s.cs, 18, '#F26B5B'); },
    },
  };

  // ================================================================ the AI at the fair
  function shape(c, b, list) {
    if (!b || !b.a || W().area.id !== 'fair') return list;
    const timid = any(c, ['timid', 'shy', 'nervous']) && !any(c, ['brave', 'adventurous']);
    for (const x of list) if (x.kind === 'act' && x.act === 'fairride16' && x.target && x.target.slot) {
      let g = G[x.target.slot.obj.game]; if (!g) continue;
      if (g.scary && timid) {   /* the nearest booth is a scary one: go to a calmer one instead, or not at all */
        let alt = null, bd = 1e9; for (const o of B().aff) { const g2 = G[o.game]; if (o.kind !== 'fair16' || !g2 || g2.scary) continue; for (const s2 of o.slots) { if (!B().free(s2, c.id)) continue; const d = Math.hypot(s2.ax - b.a.x, s2.ay - b.a.y); if (d < bd) { bd = d; alt = s2; } } }
        if (alt) { x.target = { slot: alt }; x.why.unshift(`怕${g.zh}，改玩${G[alt.obj.game].zh}`); g = G[alt.obj.game]; } else { x.s -= 1.2; x.why.unshift(`怕${g.zh}`); continue; }
      }
      if (g.scary && any(c, ['adventurous', 'brave'])) { x.s += 0.3; x.why.unshift(`想玩${g.zh}`); }
      if (g.vs && any(c, ['competitive', 'sporty'])) { x.s += 0.2; x.why.unshift('想比賽'); }
    }
    return list;
  }
  function onFinish(c, act, b) {
    if (act !== 'fairride16' || !b.slot) return; const g = G[b.slot.obj.game]; if (!g) return;
    const scared = g.scary && any(c, ['timid', 'shy', 'nervous']);
    M().feel(c, scared ? 'nervous' : 'excited', 0.3, g.zh);
    M().remember(c, { type: 'activity', imp: 0.35, place: 'place:fair', text: `玩了${g.zh}${scared ? '，有點可怕' : ''}`, key: `f16:${g.id}:${c.id}:${Sim().day()}` });
  }

  OC.Fair16 = { GAMES, G, GAME, TICKET, play, start, finish, refuses, nearby, shape, onFinish, get cur() { return cur; }, get last() { return last; }, state: () => (cur ? { game: cur.g.id, t: cur.t, score: cur.score, st: cur.st, dur: cur.dur || DUR } : null) };
})();
