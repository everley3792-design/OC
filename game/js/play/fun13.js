/* OC Shimeji 13.0 — OC.Fun: things to do WITH your characters, and characters that come to you.
 *   rps(id)      rock–paper–scissors, first to two wins; the OC's pick follows its personality; real input, win / lose / draw
 *   hide(id)     hide-and-seek: the OC hides behind a tree / bush of the place, you shake them to find it before the time is up
 *   shake drops  shaking a tree may drop a few coins or a fruit — decided once per tree per day (no farming by tapping again)
 *   visits       now and then an OC walks up to you by itself: invites you to play, brings a small gift, asks you something and remembers
 *                the answer, tells you what it noticed about someone else, or asks you to meet somewhere tomorrow (and remembers if you came)
 * Rules kept: coins / items only through OC.Tx with fixed keys (once per OC per day); one progress event per play; every hold ('game') is
 * released on every way out and by the app's watchdog; nothing happens while a page, a dialogue, an event or a performance is in the way;
 * all the wording is data (LifeData.LINES) so every character says it in its own voice.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, Ch = () => OC.Chars, M = () => OC.Mind, B = () => OC.Brain, W = () => OC.World, A = () => OC.App, Sim = () => OC.Sim;
  const { h, toast, haptic } = OC.UI;
  const nm = (c) => Ch().name(c), has = (c, t) => !!c && c.personality.traits.includes(t), day = () => OC.Clock.dayKey();
  const say = (cat, c, extra) => { const r = OC.Talk.say(cat, c, null, Object.assign({ vars: extra || {} }, extra || {})); return r ? r.text : null; };
  const bubble = (id, cat, extra, dur) => { const a = A().actorOf(id), c = Ch().get(id), t = c && say(cat, c, extra); if (a && t) A().bubble(a, t, nm(c), dur || 2.4); return t; };
  const act = (id, action, dur) => { const a = A().actorOf(id); if (a) W().setAction(a, action, { dur: dur || 1.6, priority: 6 }); };
  const st13 = () => { const L = S().life; return (L.fun13 = Object.assign({ dates: [], visitAt: 0, lastTopic: '', n: { rps: 0, hide: 0, visits: 0, dates: 0, drops: 0 } }, L.fun13 || {})); };
  const hsh = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  let cur = null;   // the running game: { game, id, … }
  const busy = () => !!cur;
  function begin(game, id) { if (cur) return false; const b = B().get(id), a = A().actorOf(id); if (!b || !a || a.hidden) { toast('牠現在不在這裡', 'info'); return false; } B().hold(id, 'game'); cur = { game, id, t0: performance.now() }; return true; }
  function end(result) {
    if (!cur) return; const g = cur; cur = null; B().unhold(g.id, 'game'); if (g.el) g.el.remove(); if (g.zoom0 && W().zoomTo) W().zoomTo(g.zoom0); if (g.timer) clearInterval(g.timer); if (g.off) g.off();
    const a = A().actorOf(g.id); if (a && a.hidden && g.game === 'hide') a.hidden = false;
    St.emit('fun:end', { game: g.game, id: g.id, result });
  }
  /** the shared outcome of a game: needs, closeness, a memory a day, the first win of the day pays, one progress event */
  function settle(c, game, win, zh) {
    M().needs(c, { fun: 14, social: 8 }); M().player(c, { fam: 1, aff: win === 0 ? 1 : 2 });
    M().feel(c, win === 1 ? (has(c, 'competitive') ? 'annoyed' : 'happy') : win === -1 ? (has(c, 'competitive') ? 'proud' : 'happy') : 'happy', 0.35, `和你玩${zh}`);
    M().remember(c, { type: 'player', imp: 0.4, text: `和你玩了${zh}${win === 1 ? '（你贏了）' : win === -1 ? '（牠贏了）' : ''}`, key: `fun:${game}:${c.id}:${day()}` });
    if (win === 1) { const r = OC.Tx.run(`fun:${game}:${c.id}:${day()}`, { get: { coins: game === 'hide' ? 25 : 20 } }, `和${nm(c)}玩${zh}`); if (r.ok) St.emit('reward', { coins: game === 'hide' ? 25 : 20, why: zh }); if (OC.Sound && OC.Sound.cue) OC.Sound.cue('mini'); }
    if (OC.Progress) OC.Progress.emit('play', { oc: c.id, game, win: win === 1 });
    st13().n[game]++; St.touch('life', { fun: game });
  }

  // =============================================================================== rock – paper – scissors
  const RPS = [['rock', '石頭', '✊'], ['scissors', '剪刀', '✌'], ['paper', '布', '✋']], BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
  /** what the OC throws: stubborn ones repeat themselves, clever / competitive ones answer your last throw, the rest is chance */
  function ocPick(c, g) {
    const r = Math.random();
    if (g.ocLast && has(c, 'stubborn') && r < 0.6) return g.ocLast;
    if (g.youLast && (has(c, 'competitive') || has(c, 'scholar')) && r < 0.45) return Object.keys(BEATS).find((k) => BEATS[k] === g.youLast);
    return RPS[Math.floor(Math.random() * 3)][0];
  }
  function rps(id) {
    const c = Ch().get(id); if (!c || !begin('rps', id)) return false;
    const g = cur; Object.assign(g, { you: 0, oc: 0, round: 0, phase: 'pick', youLast: null, ocLast: null, log: [] });
    const score = h('div.fun-score'), msg = h('div.fun-msg'), hands = h('div.fun-hands'), row = h('div.fun-row');
    g.el = h('div.fun-panel', { role: 'dialog', 'aria-label': '猜拳' }, h('div.hstack', null, h('b.grow', null, `和${nm(c)}猜拳`), h('button.icon-btn', { 'aria-label': '不玩了', on: { click: () => { bubble(id, 'fun_quit'); end('quit'); } } }, OC.UI.icon('close', 's'))), score, hands, msg, row);
    const draw = () => { score.replaceChildren(h('span', null, `你 ${g.you}`), h('i', null, '先贏兩次'), h('span', null, `${nm(c)} ${g.oc}`)); };
    const throwIt = (pick) => {
      if (g.phase !== 'pick' || cur !== g) return; g.phase = 'show'; g.round++; haptic();
      const o = ocPick(c, g), res = pick === o ? 0 : BEATS[pick] === o ? 1 : -1; g.youLast = pick; g.ocLast = o; g.log.push([pick, o, res]);
      if (res === 1) g.you++; else if (res === -1) g.oc++;
      const zh = (k) => RPS.find((x) => x[0] === k);
      hands.replaceChildren(h('div.fun-hand.you', null, h('b', null, zh(pick)[2]), h('span', null, zh(pick)[1])), h('i', null, res === 1 ? '你贏' : res === -1 ? '牠贏' : '平手'), h('div.fun-hand', null, h('b', null, zh(o)[2]), h('span', null, zh(o)[1])));
      act(id, res === -1 ? 'rps_win' : res === 1 ? 'rps_lose' : 'rps', 1.4); OC.Sound && OC.Sound.play(res === 1 ? 'chime' : res === -1 ? 'pop' : 'tick');
      draw(); g.state = res;
      setTimeout(() => {
        if (cur !== g) return;
        if (g.you >= 2 || g.oc >= 2) { const win = g.you > g.oc ? 1 : -1; bubble(id, win === 1 ? 'rps_lose' : 'rps_win'); settle(c, 'rps', win, '猜拳'); msg.textContent = win === 1 ? '你贏了！' : `${nm(c)}贏了`; g.phase = 'done'; g.result = win; setTimeout(() => { if (cur === g) end(win === 1 ? 'win' : 'lose'); }, 1500); }
        else { g.phase = 'pick'; msg.textContent = res === 0 ? '平手，再來' : '下一拳'; }
      }, 900);
    };
    row.append(...RPS.map(([k, zh, gl]) => h('button.btn.fun-pick', { 'data-pick': k, on: { click: () => throwIt(k) } }, h('b', null, gl), zh)));
    draw(); msg.textContent = '出什麼？'; document.getElementById('app').append(g.el); requestAnimationFrame(() => g.el.classList.add('on'));
    act(id, 'rps', 1.2); bubble(id, 'rps_start');
    return true;
  }

  // =============================================================================== hide and seek
  const onScr = (s) => s && s.x > 40 && s.x < innerWidth - 40 && s.y > 210 && s.y < innerHeight - 190;   /* on screen and clear of the HUD */
  const targets = () => (W().swayTargets ? W().swayTargets() : []).filter(Boolean);
  function hide(id) {
    const c = Ch().get(id), all = targets();
    if (!c) return false; if (all.length < 3) { toast('這裡沒有地方可以躲（去有樹或草叢的地方）', 'info'); return false; }
    if (!begin('hide', id)) return false;
    const g = cur, a = A().actorOf(id);
    /* zoomed in so far that hardly any tree is in view: pull back for the game, and go back to that zoom afterwards */
    if (all.filter(onScr).length < 3 && W().zoomTo && W().saveView) { g.zoom0 = W().saveView().zoom; W().zoomTo(1.15); }
    let spot = null;
    Object.assign(g, { spot: null, left: 45, wrong: 0, phase: 'count', found: false });
    const bar = h('div.fun-bar', { role: 'status' }); g.el = bar; document.getElementById('app').append(bar);
    const show = () => bar.replaceChildren(h('b', null, g.phase === 'count' ? `${nm(c)}去躲了…` : `找找${nm(c)}躲在哪`), g.phase === 'seek' ? h('span.num', null, `${Math.ceil(g.left)} 秒`) : null, h('button.btn.s', { on: { click: () => finish(false, true) } }, '不玩了'));
    bubble(id, 'hide_start'); show();
    const hideAt = setTimeout(() => { if (cur !== g) return; const acts = Ch().all().map((x) => A().actorOf(x.id)).filter((x) => x && x !== a && !x.hidden), clear = (t) => !acts.some((x) => Math.abs(x.x - t.dx) < 30 && x.y - t.dy > -10 && x.y - t.dy < 90); /* not behind someone who is standing in front of it: a tap there would land on that character */ const now0 = targets(), now = now0.filter(clear).length >= 3 ? now0.filter(clear) : now0, vis = now.filter(onScr), pool = vis.length ? vis : now.slice().sort((p, q) => Math.hypot(p.dx - a.x, p.dy - a.y) - Math.hypot(q.dx - a.x, q.dy - a.y)).slice(0, 6); spot = g.spot = pool[Math.floor(Math.random() * pool.length)]; /* picked when it actually hides: the view may have moved since the game was started */ a.hidden = true; a.path = null; g.phase = 'seek'; show(); OC.Sound && OC.Sound.play('pop'); }, 1600);
    const onShake = (e) => {
      if (cur !== g || g.phase !== 'seek' || !e || !spot) return;
      if (Math.hypot(e.dx - spot.dx, e.dy - spot.dy) < 8) finish(true); else { g.wrong++; if (g.wrong % 3 === 0) hint(); }
    };
    const hint = () => { if (!spot) return; const t = targets().find((x) => Math.hypot(x.dx - spot.dx, x.dy - spot.dy) < 2) || spot; /* where it is on screen now, not where it was */ const sh = W().shakeAt(t.x, t.y); if (sh) W().shake(sh); OC.Sound && OC.Sound.play('giggle'); };
    St.on('world:shake', onShake); g.off = () => { clearTimeout(hideAt); if (St.off) St.off('world:shake', onShake); else g.dead = true; };
    g.timer = setInterval(() => { if (cur !== g || g.phase !== 'seek') return; g.left -= 0.5; show(); if (Math.abs(g.left - 20) < 0.01 || Math.abs(g.left - 8) < 0.01) hint(); if (g.left <= 0) finish(false); }, 500);
    function finish(found, quit) {
      if (cur !== g || g.phase === 'done') return; g.phase = 'done'; g.found = found; clearInterval(g.timer);
      const p = (spot && W().nearestWalkable(spot.dx, spot.dy + 14, 40)) || { x: a.x, y: a.y }; a.x = p.x; a.y = p.y; a.hidden = false; a.key = '';
      act(id, found ? 'surprised' : 'proud', 1.6); bubble(id, quit ? 'fun_quit' : found ? 'hide_found' : 'hide_fail');
      if (!quit) settle(c, 'hide', found ? 1 : -1, '躲貓貓');
      setTimeout(() => { if (cur === g) end(quit ? 'quit' : found ? 'win' : 'lose'); }, 1400);
    }
    g.finish = finish;
    return true;
  }

  // =============================================================================== shaking a tree
  const DROPS = ['apple', 'berry', 'flower'];
  St.on('world:shake', (e) => {
    if (!e || cur || !W().area || OC.Sim.catching) return;
    const key = `shake:${W().area.id}:${Math.round(e.dx)}_${Math.round(e.dy)}:${day()}`, roll = hsh(key) % 100;
    if (roll >= 34 || (OC.Tx.done && OC.Tx.done(key))) return;   // decided once per tree per day: tapping again changes nothing
    const item = DROPS.filter((i) => OC.Style.ITEMS[i])[roll % 3], get = roll < 20 ? { coins: 5 + (roll % 3) * 5 } : item ? { items: { [item]: 1 } } : { coins: 5 };
    const r = OC.Tx.run(key, { get }, '搖樹掉下來的'); if (!r.ok) return;
    st13().n.drops++; OC.Sound && OC.Sound.play('pickup'); haptic('confirm');
    toast(get.coins ? `樹上掉下 ${get.coins} 星幣` : `樹上掉下一個${OC.Style.ITEMS[item].zh}`, 'gift');
  });

  // =============================================================================== an OC comes to you
  const QUESTIONS = [
    { id: 'season', q: '如果只能留一個季節，你會選哪一個？', a: [['春天', '我也喜歡春天。花開的時候，連空氣都是軟的。'], ['夏天', '夏天啊。那我們之後一起去海邊。'], ['秋天', '秋天的光很好看。我記住了。'], ['冬天', '冬天適合窩著。下次冷的時候我來找你。']] },
    { id: 'morning', q: '你是早上比較有精神，還是晚上？', a: [['早上', '那早上我會小聲一點，不吵你做事。'], ['晚上', '難怪你常常很晚還在。別太累了。']] },
    { id: 'alone', q: '心情不好的時候，你想要有人陪，還是自己待著？', a: [['有人陪', '好。那時候我會過來，不說話也可以。'], ['自己待著', '知道了。我會在不遠的地方。']] },
    { id: 'sweet', q: '甜的和鹹的，只能選一種的話？', a: [['甜的', '記下來了。下次有甜的先留給你。'], ['鹹的', '原來你是鹹派。我有印象了。']] },
    { id: 'place', q: '島上你最喜歡哪裡？', a: [['海邊', '我也常去海邊發呆。'], ['森林', '森林很安靜，適合想事情。'], ['家裡', '家裡最安心，我懂。'], ['商店街', '那下次一起去逛。']] },
    { id: 'rain', q: '下雨天你會出門嗎？', a: [['會，喜歡雨', '那我們可以一起聽雨。'], ['不會，待在家', '也好，我去找你就是了。']] },
  ];
  const TOPICS = ['play', 'gift', 'ask', 'gossip', 'date'];
  let vT = 0, visiting = null;
  function canVisit() { return A().canLead && A().canLead() && !cur && !visiting && A().player && !A().player.hidden; }
  /** who would come over now? someone here, not manual, free, on good terms with you (a hook for the tests too) */
  function visitor() {
    const out = []; for (const id of Object.keys(A().mates || {})) { const b = B().get(id), c = Ch().get(id); if (!b || !c || !b.a || b.a.hidden || B().manualMode(b) || !B().available(b)) continue; if (M().dominant(c) === 'annoyed' || (c.needs.sleep < 20)) continue; out.push(c); }
    out.sort((x, y) => ((y.life.player.aff || 0) + (has(y, 'clingy') ? 20 : 0) + (has(y, 'aloof') ? -30 : 0)) - ((x.life.player.aff || 0) + (has(x, 'clingy') ? 20 : 0) + (has(x, 'aloof') ? -30 : 0)));
    return out[0] || null;
  }
  function pickTopic(c) {
    const F = st13(), w = { play: 1 + (has(c, 'playful') ? 1.2 : 0) + (c.needs.fun < 50 ? 0.6 : 0), gift: 0.7 + (has(c, 'generous') ? 1.2 : 0) - (has(c, 'stingy') ? 0.6 : 0), ask: 1 + (has(c, 'curious') ? 0.8 : 0), gossip: 0.6 + (has(c, 'talkative') || has(c, 'storyteller') ? 0.9 : 0), date: 0.6 + ((c.life.player.aff || 0) > 30 ? 0.6 : 0) };
    if (Ch().all().length < 2) w.gossip = 0; if (F.dates.some((d) => d.oc === c.id && d.state === 'set')) w.date = 0; if (OC.Tx.done && OC.Tx.done(`visitgift:${c.id}:${day()}`)) w.gift = 0;
    if (F.lastTopic) w[F.lastTopic] *= 0.25;
    let tot = 0; for (const k of TOPICS) tot += Math.max(0, w[k]); let r = Math.random() * tot; for (const k of TOPICS) { r -= Math.max(0, w[k]); if (r <= 0) return k; } return 'ask';
  }
  /** an OC walks to you and starts a conversation (topic may be forced by the tests) → true when it started */
  function visit(c, topic) {
    c = c || visitor(); if (!c || !canVisit()) return false;
    const id = c.id, a = A().actorOf(id), P = A().player; if (!a) return false;
    topic = topic || pickTopic(c); const F = st13(); F.visitAt = Date.now(); F.lastTopic = topic; F.n.visits++;
    visiting = { id, topic, t0: performance.now() }; B().hold(id, 'game');
    const open = () => { if (!visiting || visiting.id !== id) return; B().face(a, P); P.tFace = a.x > P.x ? 0.5 : -0.5; talk(c, topic); };
    const tgt = W().nearestWalkable(P.x + (a.x < P.x ? -24 : 24), P.y + 2, 30) || { x: P.x, y: P.y };
    if (Math.hypot(a.x - tgt.x, a.y - tgt.y) < 30 || !W().walkTo(a, tgt.x, tgt.y, open)) open();
    visiting.guard = setTimeout(() => { if (visiting && visiting.id === id && !visiting.talking) open(); }, 9000);   // a blocked path must not leave it waiting
    St.emit('fun:visit', { id, topic }); return true;
  }
  function leave(id) { if (visiting) clearTimeout(visiting.guard); visiting = null; B().unhold(id, 'game'); }
  function talk(c, topic) {
    const id = c.id, name = nm(c), F = st13(); visiting.talking = true;
    const dlg = (lines, choices) => A().showDialogue(name, lines, choices, () => leave(id), true);
    const bye = (t) => (t ? [t] : []);
    if (topic === 'play') {
      const game = (W().swayTargets ? W().swayTargets().length : 0) >= 3 && Math.random() < 0.5 ? 'hide' : 'rps';
      dlg([say('visit_play', c, { game: game === 'hide' ? '躲貓貓' : '猜拳' }) || `要不要玩${game === 'hide' ? '躲貓貓' : '猜拳'}？`], [
        { label: '好啊', fx: () => { setTimeout(() => (game === 'hide' ? hide(id) : rps(id)), 350); return []; } },
        { label: '下次吧', fx: () => { M().feel(c, 'down', has(c, 'sensitive') ? 0.25 : 0.1, '你沒空陪牠玩'); return bye(say('visit_no', c)); } }]);
    } else if (topic === 'gift') {
      const item = (has(c, 'gardener') || has(c, 'nature') ? 'flower' : has(c, 'foodie') || has(c, 'chef') || has(c, 'gourmet') ? 'apple' : ['berry', 'apple', 'flower'][hsh(id + day()) % 3]), it = OC.Style.ITEMS[item] ? item : 'apple';
      dlg([say('visit_gift', c, { item: OC.Style.ITEMS[it].zh }) || `這個給你。`], [
        { label: '謝謝，收下了', fx: () => { const r = OC.Tx.run(`visitgift:${id}:${day()}`, { get: { items: { [it]: 1 } } }, `${name}送你的`); if (r.ok) { M().player(c, { aff: 2, fam: 1 }); M().feel(c, 'happy', 0.3, '你收下了牠的禮物'); M().remember(c, { type: 'player', imp: 0.45, text: `送了你一個${OC.Style.ITEMS[it].zh}`, key: `visitgift:${id}:${day()}` }); } return bye(say('visit_thanks', c)); } },
        { label: '你留著吧', fx: () => bye(say('visit_keep', c)) }]);
    } else if (topic === 'ask') {
      const m13 = (c.life.m13 = c.life.m13 || { answers: {} }), open = QUESTIONS.filter((q) => !(m13.answers[q.id])), Q = (open.length ? open : QUESTIONS)[Math.floor(Math.random() * (open.length || QUESTIONS.length))];
      dlg([(say('visit_ask', c) || '我想問你一件事。'), Q.q], Q.a.map(([label, reply]) => ({ label, fx: () => { m13.answers[Q.id] = label; M().player(c, { aff: 1, fam: 2 }); M().remember(c, { type: 'player', imp: 0.5, text: `問你「${Q.q}」，你說：${label}`, key: `ask:${id}:${Q.id}` }); St.touch('life', { ask: Q.id }); return [OC.Chars.speak(c, reply, { to: 'player', cat: 'visit_ask' })]; } })));
    } else if (topic === 'gossip') {
      const others = Ch().all().filter((o) => o.id !== id && o.id !== S().activeId), k = (c.life.m11 && c.life.m11.know) || {}, o = others.find((x) => k[x.id]) || others[0];
      if (!o) return talk(c, 'ask');
      const kn = k[o.id] || {}, fav = OC.Mind11 && OC.Mind11.favAct ? OC.Mind11.favAct(kn) : null, what = kn.mood && ['down', 'lonely', 'tired'].includes(kn.mood) ? '最近看起來有點沒精神' : fav && OC.LifeData.ACTS[fav] ? `最近常常在${OC.LifeData.ACTS[fav].zh}` : '最近過得不錯的樣子';
      dlg([say('visit_gossip', c, { otherZh: nm(o), what }) || `${nm(o)}${what}。`], [
        { label: '我去看看牠', fx: () => { M().player(c, { fam: 1 }); return bye(say('visit_ok', c)); } }, { label: '原來如此', fx: () => bye(say('visit_ok', c)) }]);
    } else if (topic === 'date') {
      const places = OC.Places.list().filter((p) => OC.Places.open(p) && !OC.Places.get(p).interior && p !== (W().area && W().area.id)), place = places[hsh(id + day()) % Math.max(1, places.length)] || 'isle', phase = ['morning', 'noon', 'dusk'][hsh(day() + id) % 3], pzh = { morning: '早上', noon: '中午', dusk: '傍晚' }[phase];
      dlg([say('date_ask', c, { placeZh: OC.Places.get(place).zh, when: pzh }) || `明天${pzh}，要不要一起去${OC.Places.get(place).zh}？`], [
        { label: '約好了', fx: () => { F.dates.push({ oc: id, place, day: Sim().day() + 1, phase, state: 'set', at: Date.now() }); F.n.dates++; M().feel(c, 'excited', 0.35, '和你約好了'); M().remember(c, { type: 'player', imp: 0.5, text: `和你約好明天${pzh}在${OC.Places.get(place).zh}見`, key: `date:set:${id}:${Sim().day()}` }); St.touch('life', { date: id }); return bye(say('date_set', c)); } },
        { label: '那天不行', fx: () => bye(say('visit_no', c)) }]);
    }
  }
  /** appointments: kept when you are at the place in that part of the day (the OC shows up and comes to you); missed after the day is over */
  function checkDates() {
    const F = st13(), d = Sim().day(), ph = OC.Clock.phase(OC.Clock.hour());
    for (const x of F.dates) {
      if (x.state !== 'set') continue; const c = Ch().get(x.oc); if (!c) { x.state = 'gone'; continue; }
      if (d > x.day) { x.state = 'missed'; M().feel(c, 'down', has(c, 'sensitive') || has(c, 'clingy') ? 0.45 : 0.25, '你沒有來赴約'); M().player(c, { aff: -2 }); M().remember(c, { type: 'player', imp: 0.5, text: `在${OC.Places.get(x.place).zh}等你，但你沒有來`, key: `date:missed:${x.oc}:${x.day}` }); St.touch('life', { date: 'missed' }); continue; }
      if (d === x.day && ph === x.phase && W().area && W().area.id === x.place && canVisit()) {
        if (!A().actorOf(x.oc)) { c.life.loc = x.place; c.life.trip = null; c.life.cur = null; A().syncPresence(); }
        const a = A().actorOf(x.oc); if (!a) continue;
        x.state = 'kept'; M().player(c, { aff: 4, fam: 3 }); M().feel(c, 'happy', 0.6, '你真的來了'); M().needs(c, { social: 20, fun: 10 });
        M().remember(c, { type: 'milestone', imp: 0.7, text: `和你約在${OC.Places.get(x.place).zh}，你真的來了`, key: `date:kept:${x.oc}:${x.day}` });
        if (OC.Sound && OC.Sound.cue) OC.Sound.cue('relUp'); if (OC.Progress) OC.Progress.emit('date', { oc: x.oc, place: x.place });
        visiting = { id: x.oc, topic: 'meet', t0: performance.now(), talking: true }; B().hold(x.oc, 'game');
        A().showDialogue(nm(c), [say('date_meet', c, { placeZh: OC.Places.get(x.place).zh }) || '你來了。'], [], () => leave(x.oc), true); St.touch('life', { date: 'kept' });
      }
    }
    if (F.dates.length > 30) F.dates.splice(0, F.dates.length - 30);
  }
  function step(g) {
    vT += g; if (vT < 20) return; vT = 0;
    try { checkDates(); if (!canVisit()) return; const F = st13(); if (S().life.settings.autonomy === 'paused' || S().life.settings.visits === false) return; if (Date.now() - Math.max(F.visitAt || 0, bootAt) < 4 * 60e3) return; /* nobody drops by in the first minutes after the game opens */ if (Math.random() < 0.3) visit(); } catch (e) { console.error('[fun13]', e); }
  }
  let bootAt = Date.now();
  function init() { bootAt = Date.now(); if (Sim().onStep) Sim().onStep(step); }

  // ---- wording (data): [category, text, conditions, weight]
  const P = { voice: 'plain' }, Bv = { voice: 'bright' }, C = { voice: 'calm' }, K = { voice: 'cool' };
  const LINES = [
    ['rps_start', '來。輸的人不准賴皮。', P], ['rps_start', '猜拳啊，我可不會放水。', K], ['rps_start', '好，我準備好了。', C], ['rps_start', '這個我很強喔！', Bv],
    ['rps_win', '我贏了。再練練吧。', K], ['rps_win', '嘿，這次是我的。', P], ['rps_win', '運氣不錯。謝謝你陪我玩。', C], ['rps_win', '贏了贏了！再一次？', Bv], ['rps_win', '哼，當然是我贏。', { trait: 'competitive' }, 4],
    ['rps_lose', '輸了。你是不是偷看我的手？', P], ['rps_lose', '……再一次。這次不算。', { trait: 'competitive' }, 4], ['rps_lose', '你贏了。我認了。', C], ['rps_lose', '嘖。下次不會了。', K], ['rps_lose', '哇，你好厲害！', Bv],
    ['hide_start', '數到三才可以找。不准偷看。', P], ['hide_start', '我去躲了。找不到別哭。', K], ['hide_start', '閉上眼睛。我會躲得很好。', C], ['hide_start', '來找我來找我！', Bv],
    ['hide_found', '被找到了。你怎麼知道是這裡？', P], ['hide_found', '……這麼快。', K], ['hide_found', '找到我了。我有點開心。', C], ['hide_found', '啊——被發現了！', Bv],
    ['hide_fail', '時間到。我躲在這裡很久了。', P], ['hide_fail', '我就說你找不到。', K], ['hide_fail', '沒關係，下次我躲簡單一點。', C], ['hide_fail', '嘿嘿，我贏了！', Bv],
    ['fun_quit', '好，那下次再玩。', P], ['fun_quit', '嗯。隨時可以再找我。', C], ['fun_quit', '這就不玩了？好吧。', K],
    ['visit_play', '現在有空嗎？陪我玩一局{game}。', P], ['visit_play', '我有點無聊。{game}，來不來？', K], ['visit_play', '如果你不忙的話，我想玩{game}。', C], ['visit_play', '我們來玩{game}好不好？', Bv],
    ['visit_gift', '剛才找到一個{item}，想到你就拿過來了。', P], ['visit_gift', '這個{item}給你。別問為什麼。', K], ['visit_gift', '不是什麼貴重的東西。一個{item}，希望你喜歡。', C], ['visit_gift', '你看你看，{item}！送你！', Bv],
    ['visit_thanks', '你喜歡就好。', P], ['visit_thanks', '嗯。', K], ['visit_thanks', '收下了就不能退喔。', C], ['visit_keep', '那我先幫你保管。', P], ['visit_keep', '好吧。', K],
    ['visit_ask', '我可以問你一件事嗎。', P], ['visit_ask', '有件事我一直想知道。', C], ['visit_ask', '問你一個問題，老實回答。', K], ['visit_ask', '我有個問題！', Bv],
    ['visit_gossip', '跟你說，{otherZh}{what}。', P], ['visit_gossip', '我注意到{otherZh}{what}。你知道嗎？', C], ['visit_gossip', '{otherZh}{what}。只是告訴你一聲。', K],
    ['visit_ok', '嗯，那就這樣。', P], ['visit_ok', '好。我先去忙了。', C], ['visit_no', '沒關係，改天。', P], ['visit_no', '知道了。', K], ['visit_no', '好，那我自己去。', C], ['visit_no', '……喔。', { trait: 'sensitive' }, 3],
    ['date_ask', '明天{when}你有空嗎？我想跟你去{placeZh}。', P], ['date_ask', '明天{when}，{placeZh}。來不來隨你。', K], ['date_ask', '如果可以的話，明天{when}一起去{placeZh}走走？', C], ['date_ask', '明天{when}我們去{placeZh}吧！', Bv],
    ['date_set', '那就說定了。', P], ['date_set', '我會等你。', C], ['date_set', '別遲到。', K], ['date_set', '太好了，我好期待！', Bv],
    ['date_meet', '你來了。我還在想你會不會忘記。', P], ['date_meet', '準時。不錯。', K], ['date_meet', '你真的來了。今天{placeZh}看起來特別好。', C], ['date_meet', '你來了！我等好久了！', Bv],
  ];
  const D = OC.LifeData; if (D && D.LINES) LINES.forEach((x, i) => D.LINES.push({ id: 'f13_' + i, cat: x[0], text: x[1], c: x[2] || null, w: x[3] || 1, m: true }));

  OC.Fun = { init, rps, hide, visit, visitor, pickTopic, checkDates, step, end, QUESTIONS, TOPICS, get state() { return cur ? { game: cur.game, id: cur.id, phase: cur.phase, you: cur.you, oc: cur.oc, round: cur.round, left: cur.left, spot: cur.spot ? { x: cur.spot.x, y: cur.spot.y, dx: cur.spot.dx, dy: cur.spot.dy } : null, wrong: cur.wrong, result: cur.result } : null; }, get visiting() { return visiting ? { id: visiting.id, topic: visiting.topic } : null; }, get busy() { return busy(); }, get seeking() { return !!cur && cur.game === 'hide' && cur.phase === 'seek'; }, get data() { return st13(); } };
})();
