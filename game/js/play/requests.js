/* OC Shimeji — character requests (Phase 6, Tomodachi-style little wishes told to the player).
 * Flow: an OC near the player gets an idea (personality, needs, tastes, relationships, recent life) → a small
 * 「💭」 badge appears above it → the player taps it (or the OC in the interact menu) → the OC asks in its own
 * voice → 好啊 / 等一下 / 這次不行 → while active, normal play completes it through OC.Progress → a performance
 * (OC.Stage), rewards (OC.Tx key req:<id>, once), relationship, emotion, a memory, and sometimes a follow-up later.
 * Declining is fine: a mild, in-character reaction and a cooldown for that kind of request — no relationship loss.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, PD = () => OC.PlayData, M = () => OC.Mind, Sim = () => OC.Sim, A = () => OC.App;
  const { h, icon, toast, sheet } = OC.UI;
  const R = () => { const p = (S().play = S().play || {}); return (p.req = p.req || { list: [], cd: {}, nextAt: 0, n: 0, seq: 0 }); };
  const name = (c) => OC.Chars.name(c);
  const itemZh = (id) => (OC.Style.ITEMS[id] ? OC.Style.ITEMS[id].zh : id);
  const OPEN = ['offer', 'active'];
  function text(r) { const d = PD().REQUESTS[r.type]; const o = r.data.other && OC.Chars.get(r.data.other); return d.zh.replace('{item}', r.data.item ? itemZh(r.data.item) : '').replace('{other}', o ? name(o) : '朋友').replace('{place}', r.data.place ? OC.Places.get(r.data.place).zh : ''); }
  function goalOf(r) { const g = JSON.parse(JSON.stringify(PD().REQUESTS[r.type].goal)); for (const [k, v] of Object.entries(g.w || {})) if (typeof v === 'string' && v.startsWith('{')) g.w[k] = r.data[v.slice(1, -1)]; return g; }
  const open = () => R().list.filter((r) => OPEN.includes(r.state));
  const ofOC = (id) => open().find((r) => r.oc === id) || null;

  // ---------------- generation ----------------
  function present() { return OC.Chars.all().filter((c) => { const a = A().actorOf(c.id), b = OC.Brain.get(c.id); return a && !a.hidden && b && !b.holds.size && !(b.st === 'do' && b.act === 'sleep') && !b.leaving; }); }
  function newRequest(force, ocId, typeId) {
    const s = R(), now = Sim().now();
    const cands = present().filter((c) => !ofOC(c.id) && (!ocId || c.id === ocId));
    if (!cands.length) return null;
    const c = ocId ? cands[0] : Sim().wpick(cands, (x) => 0.5 + x.personality.social / 100 + ((x.life.player.aff || 0) > 10 ? 0.3 : 0) + (x.id === S().activeId ? -0.3 : 0)); if (!c) return null;
    const cd = (s.cd[c.id] = s.cd[c.id] || {}), fu = c.life.reqNext && c.life.reqNext.at <= now ? c.life.reqNext.type : null;
    const types = Object.entries(PD().REQUESTS).filter(([t]) => (!typeId || t === typeId) && !(cd[t] > now)).map(([t, d]) => [t, Math.max(0, d.w(c)) * (t === fu ? 3 : 1)]);
    for (let tries = 0; tries < 4 && types.length; tries++) {
      const ch = Sim().wpick(types, (x) => x[1]); if (!ch) return null; const d = PD().REQUESTS[ch[0]];
      const data = d.pick(c); if (!data) { types.splice(types.indexOf(ch), 1); continue; }
      const r = { id: 'r' + (++s.seq) + now.toString(36).slice(-4), oc: c.id, type: ch[0], data, state: 'offer', at: now, until: now + 360, follow: ch[0] === fu };
      r.text = text(r); s.list.unshift(r); if (s.list.length > 60) s.list.length = 60;
      if (ch[0] === fu) c.life.reqNext = null;
      St.touch('play', { req: r.id }); St.emit('play:reqNew', r);
      return r;
    }
    return null;
  }
  let lastTick = 0;
  /** low frequency: expire, maybe create (app loop, real time) */
  function tick() {
    const s = R(), now = Sim().now(); if (!s.nextAt) s.nextAt = now + 30;
    for (const r of s.list) {
      if (r.state === 'offer' && now > r.until) { r.state = 'expired'; St.touch('play'); }
      if (r.state === 'active' && now > r.until) { r.state = 'expired'; const c = OC.Chars.get(r.oc); if (c) { M().note(c, 'request', `「${r.text}」的事，${name(c)}說沒關係了`); const ln = OC.Talk.say('req_expire', c, null); if (ln && A().actorOf(c.id)) A().bubble(A().actorOf(c.id), ln.text, name(c)); } St.touch('play'); }
    }
    if (S().life.settings.autonomy === 'paused') return;
    if (open().length < 2 && now >= s.nextAt) { const r = newRequest(); s.nextAt = now + (r ? 60 + Sim().rnd() * 90 : 20); }
  }

  // ---------------- badges above OCs that have something to say ----------------
  const badges = {};
  function frame() {
    const ov = document.getElementById('overlays'); if (!ov || !OC.World.area) return;
    const want = new Set();
    for (const r of open()) {
      if (r.state !== 'offer' || (r.laterUntil && Sim().now() < r.laterUntil)) continue;
      const a = A().actorOf(r.oc); if (!a || a.hidden) continue; want.add(r.oc);
      let el = badges[r.oc]; if (!el) { el = badges[r.oc] = h('button.req-badge', { 'aria-label': '有話想說' }, icon(PD().REQUESTS[r.type].ic || 'chat', 's')); ov.append(el); }
      el.dataset.r = r.id; el.onclick = (e) => { e.stopPropagation(); openSheet(el.dataset.r); };
      const p = OC.World.project(a.x, a.y, a.lvl, (a.gy - a.lvl * OC.World.HY) + 54); el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    }
    for (const [id, el] of Object.entries(badges)) if (!want.has(id)) { el.remove(); delete badges[id]; }
  }
  function clearBadges() { for (const [id, el] of Object.entries(badges)) { el.remove(); delete badges[id]; } }

  // ---------------- asking ----------------
  function openSheet(id) {
    const r = R().list.find((x) => x.id === id); if (!r) return; const c = OC.Chars.get(r.oc); if (!c) return;
    const d = PD().REQUESTS[r.type], a = A().actorOf(c.id);
    if (r.state === 'offer' && a) { OC.World.setAction(a, OC.Chars.has(c, 'shy') ? 'shy' : 'talk', { dur: 1.6, priority: 6 }); if (A().player) OC.Brain.face(a, A().player); }
    OC.Sound && OC.Sound.play('pop');
    const line = r.state === 'offer' ? OC.Talk.say('req_ask', c, null, { vars: { want: r.text } }) : null;
    sheet(null, (b, api) => {
      const cv = h('canvas', { width: 128, height: 128 }); cv.style.cssText = 'width:64px;height:64px;flex:none;border-radius:16px;background:var(--surface-2)';
      A().live(cv, () => ({ char: OC.Chars.get(c.id), pose: { face: 0.3, action: r.state === 'offer' ? (OC.Chars.has(c, 'shy') ? 'shy' : 'talk') : 'idle' } }));
      const rw = d.reward, why = whyText(c, r);
      b.append(h('div.req-card', null,
        h('div.hstack', null, cv, h('div.grow', null, h('b', null, name(c)), h('div.req-line', null, line ? `「${line.text}」` : `「${r.text}」`))),
        h('div.req-goal', null, icon(d.ic || 'chat', 's'), h('span.grow', null, r.text), h('span.price', null, icon('coin', 's'), h('b.num', null, rw.coins || 0))),
        why ? h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '4px' } }, why) : null,
        r.state === 'active' ? h('div.muted', { style: { fontSize: 'var(--fs-s)', marginTop: '6px' } }, howText(r)) : null));
      const btns = h('div.vstack', { style: { gap: '8px', marginTop: '12px' } });
      if (r.state === 'offer') btns.append(h('button.btn.primary.block', { on: { click: () => { api.close(); answer(r.id, 'accept'); } } }, icon('heart', 's'), '好啊，交給我！'),
        h('div.hstack', null, h('button.btn.block', { on: { click: () => { api.close(); answer(r.id, 'later'); } } }, '等一下'), h('button.btn.ghost.block', { on: { click: () => { api.close(); answer(r.id, 'decline'); } } }, '這次不行')));
      else if (r.state === 'active') { const hb = helpButton(r, api); if (hb) btns.append(hb); }
      b.append(btns);
    });
  }
  function whyText(c, r) {
    switch (r.type) {
      case 'taste': return OC.Taste.pref(c, r.data.item).lv >= 1 ? '這是牠喜歡的味道。' : '牠還沒吃過，好奇是什麼味道。';
      case 'rest': return '牠看起來有點累。';
      case 'meet': return '牠們還不太熟。';
      case 'visit': return c.life.places && c.life.places[r.data.place] ? '牠很喜歡那裡。' : '牠還沒去過那裡。';
      default: return r.follow ? '上次的事讓牠有了新的想法。' : '';
    }
  }
  function howText(r) {
    switch (r.type) {
      case 'taste': return `把${itemZh(r.data.item)}拖到牠身上，或在互動選單「餵食」。商店或料理都可能有。`;
      case 'sweet': return '給牠吃一樣甜的東西（看食物的口味）。';
      case 'toy': return `陪牠玩${itemZh(r.data.item)}（星星禮品屋有賣）。`;
      case 'shell': return '送牠一樣海灘撿到的東西（貝殼、海玻璃…）。';
      case 'flower': return '送牠一朵花（花圃可以摘）。';
      case 'lost': return `送牠一個${itemZh(r.data.item)}。`;
      case 'meet': return '讓牠們聊聊天。可以按「幫忙介紹」。';
      case 'visit': return '讓牠去那裡（可以按「帶牠去」）。';
      case 'learn': return '讓牠在葉影圖書館讀書。';
      case 'rest': return '讓牠睡個午覺（可以安排）。';
      case 'outfit': return '幫牠穿上一件衣服或飾品。';
      case 'together': return '在牠身邊釣一條魚。';
      default: return '';
    }
  }
  function helpButton(r, api) {
    const d = PD().REQUESTS[r.type]; if (!d.help) return null;
    const lab = { introduce: '幫忙介紹', go: '帶牠去', nap: '安排午睡' }[d.help];
    return h('button.btn.primary.block', { on: { click: () => { api.close(); help(r.id); } } }, icon('hand', 's'), lab);
  }
  function help(id) {
    const r = R().list.find((x) => x.id === id); if (!r || r.state !== 'active') return; const c = OC.Chars.get(r.oc), d = PD().REQUESTS[r.type];
    const b = OC.Brain.get(r.oc);
    if (d.help === 'introduce') {
      const o = OC.Brain.get(r.data.other); if (!b || !b.a || !o || !o.a) { toast(`${name(OC.Chars.get(r.data.other) || c)}現在不在這裡`, 'info'); return; }
      b.holds.clear(); o.holds.clear(); if (b.st !== 'think') OC.Brain.abort(b, '介紹'); if (o.st === 'go') OC.Brain.abort(o, '介紹');
      if (!OC.Brain.Social.start(b, o, 'chat')) toast('現在找不到地方讓牠們聊天，等一下再試試', 'info'); else toast('牠們開始聊天了', 'users');
    } else if (d.help === 'go') {
      if (OC.Places.get(r.data.place) && (c.life.loc || 'isle') === r.data.place && !c.life.trip) { OC.Progress.emit('arrive', { oc: c.id, place: r.data.place }); return; }
      if (!b || !b.a) { toast(`${name(c)}不在這裡`, 'info'); return; }
      if (S().life.settings.travel === false) { toast('生活設定關閉了「OC 可以自己去別的地方」', 'info'); return; }
      b.holds.clear(); OC.Brain.startTravel(b, r.data.place, r.type === 'learn' ? 'read' : 'observe');
      toast(`${name(c)}出發去${OC.Places.get(r.data.place).zh}了`, 'compass');
    } else if (d.help === 'nap') { if (OC.Brain.command(r.oc, 'nap') === false) toast('牠現在沒辦法午睡', 'info'); else toast(`${name(c)}去找地方午睡了`, 'sleep'); }
  }
  function answer(id, how) {
    const r = R().list.find((x) => x.id === id); if (!r || r.state !== 'offer') return; const c = OC.Chars.get(r.oc); if (!c) return;
    const a = A().actorOf(c.id), now = Sim().now();
    if (how === 'accept') {
      r.state = 'active'; r.until = now + PD().REQUESTS[r.type].life; r.acceptedAt = now;
      M().feel(c, 'happy', 0.35, '你答應幫忙'); M().player(c, { fam: 1 });
      OC.Stage && OC.Stage.perform('accept', { oc: c.id }); OC.Sound && OC.Sound.play('chime');
    } else if (how === 'later') {
      r.laterUntil = now + 90; r.until = Math.max(r.until, now + 360);
      const ln = OC.Talk.say('req_later', c, null); if (ln && a) A().bubble(a, ln.text, name(c));
    } else {
      r.state = 'declined'; R().cd[c.id] = R().cd[c.id] || {}; R().cd[c.id][r.type] = now + 1440;
      if (OC.Chars.has(c, 'sensitive')) M().feel(c, 'down', 0.15, '請求被拒絕'); else if (OC.Chars.has(c, 'stubborn')) M().feel(c, 'annoyed', 0.1, '請求被拒絕');
      OC.Stage && OC.Stage.perform('decline', { oc: c.id });
    }
    St.touch('play', { req: r.id }); St.emit('play:req', { id: r.id, how });
  }

  // ---------------- completion ----------------
  function onEvent(d) {
    for (const r of open()) {
      if (r.state !== 'active') continue;
      if (!OC.Progress.match(goalOf(r), d, { oc: r.oc })) continue;
      complete(r, d);
    }
  }
  function complete(r, d) {
    const c = OC.Chars.get(r.oc); if (!c) return; const def = PD().REQUESTS[r.type];
    r.state = 'done'; r.doneAt = Sim().now(); R().n++;
    // a small thank-you gift sometimes (an item the OC likes or found), in the SAME transaction
    const thanks = Sim().rnd() < 0.3 ? (c.tastes.likeItems.find((i) => OC.Style.ITEMS[i] && OC.Style.ITEMS[i].kind !== 'furniture') || Sim().pick(['berry', 'flower', 'acorn', 'shell'].filter((i) => OC.Style.ITEMS[i]))) : null;
    const reward = Object.assign({}, def.reward, thanks ? { items: { [thanks]: 1 } } : {});
    const g = OC.Quests.grant('req:' + r.id, reward, `${name(c)}的請求：${r.text}`);
    M().player(c, { aff: 4, fam: 2 }); M().feel(c, OC.Chars.has(c, 'shy') ? 'shy' : 'happy', 0.6, `你幫我${r.text.replace(/^想/, '')}`);
    M().remember(c, { type: 'player', imp: 0.6, text: `你幫我實現了「${r.text}」`, data: { req: r.type, item: r.data.item || null }, who: r.data.other ? [r.data.other] : [], key: 'req:' + r.id });
    M().wishEvent(c, { type: 'request' }, 'player');
    // follow-ups: some requests lead to another one later (the story goes on)
    const fu = PD().FOLLOWUPS[r.type]; if (fu && Sim().rnd() < 0.5) c.life.reqNext = { type: Sim().pick(fu), at: Sim().now() + 240 + Sim().rnd() * 600, from: r.id };
    // doing the same kind of thing together often can become a new hobby (player decides)
    const same = R().list.filter((x) => x.oc === c.id && x.type === r.type && x.state === 'done').length;
    const hob = { learn: '閱讀', together: '釣魚', toy: '玩遊戲', taste: '美食', visit: '旅行', outfit: '打扮' }[r.type];
    if (hob && same >= 3) M().suggest(c, 'hobby', hob, `和你一起完成了 ${same} 次「${PD().REQUESTS[r.type].zh.replace(/\{.*?\}/g, '…')}」`);
    OC.Progress.emit('request', { oc: c.id, type: r.type });
    St.touch('play', { req: r.id });
    St.emit('play:reqDone', { r, reward, thanks, dup: g.dup });
    if (OC.Stage) OC.Stage.perform('reqDone', { oc: c.id, req: r, reward, thanks });
  }

  /** force a request (tests / developer tools) */
  function debugOffer(ocId, type) { const r = newRequest(true, ocId, type); return r; }
  const list = () => R().list;

  OC.Requests = { tick, frame, clearBadges, openSheet, answer, help, onEvent, list, open, ofOC, text, goalOf, debugOffer, howText };
})();
