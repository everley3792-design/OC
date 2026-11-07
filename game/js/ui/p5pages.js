/* OC Shimeji — Phase 5 pages & item use.
 *   explore (world map)  places, who is where, exploration, facilities, today's specials, travel / follow
 *   bag                  one inventory: search · categories · sort · favourites · details · use / give / wear / place
 *   shop                 any shop (params.shop): categories, search, daily deal, stock, quantity, buy (OC.Tx) / sell
 *   collection           discoveries by category / place / rarity, sources, who tasted / caught
 *   products             workshop products: register player-made items into a shop (never into the bag)
 *   ledger               transaction log
 *   OC.Use               giving an item to an OC: eat / drink (consumed only after the animation finishes),
 *                        play (toy), gift, wear (clothing / workshop parts), place (furniture)
 *   food preferences     editor (character editor › 喜好) and profile view
 */
(function () {
  'use strict';
  const { h, icon, toast, sheet, confirm, seg, toggle, row, haptic } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, Pg = () => OC.Pages, A = () => OC.App, M = () => OC.Mind, IT = () => OC.Items, PL = () => OC.Places, SH = () => OC.Shops;
  const I = (id) => OC.Style.ITEMS[id];
  const T = (t, small) => h('div.section-title', null, t, small ? h('small', null, small) : null);
  const card = (...k) => h('div.card', null, ...k);
  const small = (t) => h('div.faint', { style: { fontSize: 'var(--fs-xs)' } }, t);
  const img = (id, px = 40) => { const im = OC.Style.itemImg(id); im.style.width = im.style.height = px + 'px'; return im; };
  const name = (c) => OC.Chars.name(c);
  /** pages refresh on many store events (the life sim emits often): rebuild only when what the page shows changed */
  const same = (p, k) => { if (p._sig === k) return true; p._sig = k; return false; };
  const av = (c) => { const cv = h('canvas', { width: 80, height: 80 }); cv.style.cssText = 'width:40px;height:40px;flex:none;border-radius:12px;background:var(--surface-2)'; OC.CharRender.portrait(cv, c, { pose: { mouth: 'smile' } }); return cv; };
  const coin = (n) => h('span.price', null, h('span', { style: { color: 'var(--sun)', display: 'inline-grid' } }, icon('coin', 's')), h('b.num', null, n.toLocaleString()));

  // ======================= world map =======================
  function drawWorld(cv) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height; const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8EDDF2'); g.addColorStop(1, '#4FC3E8'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; const r = OC.rng(5); for (let i = 0; i < 40; i++) { const px = r() * W, py = r() * H; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 10, py - 6, px + 20, py); x.stroke(); }
    const isle = (cx, cy, rx, ry, col, sand = '#F7E3A8') => { x.fillStyle = sand; x.beginPath(); x.ellipse(cx, cy, rx + 10, ry + 9, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
    for (const [id, p] of Object.entries(PL().P)) { if (!p.map) continue; const cx = p.map.x * W, cy = p.map.y * H; if (p.locked) { x.globalAlpha = 0.55; isle(cx, cy, 70, 46, '#BFC7D5', '#E2E6EE'); x.globalAlpha = 1; continue; } isle(cx, cy, id === 'isle' ? 120 : 82, id === 'isle' ? 82 : 56, { isle: '#7CCB5A', street: '#E8D7B8', forest: '#3F9A40', beach: '#F7E3A8' }[id] || '#7CCB5A'); }
    // paths (ferry / bridges) between open places
    x.setLineDash([10, 10]); x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 5; const c0 = PL().P.isle.map;
    for (const id of ['street', 'forest', 'beach']) { const p = PL().P[id].map; x.beginPath(); x.moveTo(c0.x * W, c0.y * H); x.quadraticCurveTo((c0.x + p.x) / 2 * W, Math.min(c0.y, p.y) * H - 40, p.x * W, p.y * H); x.stroke(); }
    x.setLineDash([]);
    // tiny landmarks
    const tree = (px, py, col = '#2F7D3A') => { x.fillStyle = col; x.beginPath(); x.moveTo(px, py - 18); x.lineTo(px + 10, py + 4); x.lineTo(px - 10, py + 4); x.fill(); };
    const fm = PL().P.forest.map; for (let i = 0; i < 9; i++) tree(fm.x * W - 50 + (i % 3) * 40 + (i > 2 ? 10 : 0), fm.y * H - 26 + Math.floor(i / 3) * 22);
    const hm = (px, py, roof) => { x.fillStyle = '#FFF4DE'; x.fillRect(px - 12, py - 8, 24, 16); x.fillStyle = roof; x.beginPath(); x.moveTo(px - 15, py - 8); x.lineTo(px, py - 22); x.lineTo(px + 15, py - 8); x.fill(); };
    const im = PL().P.isle.map; hm(im.x * W - 20, im.y * H - 10, '#F26B5B'); hm(im.x * W + 40, im.y * H + 20, '#FFC93C');
    const sm = PL().P.street.map; ['#F26B5B', '#9B7BE0', '#3FC1B0', '#FFC93C'].forEach((c, i) => hm(sm.x * W - 45 + i * 30, sm.y * H - 4 + (i % 2) * 6, c));
    const bm = PL().P.beach.map; x.fillStyle = '#F26B5B'; x.beginPath(); x.moveTo(bm.x * W - 20, bm.y * H); x.lineTo(bm.x * W, bm.y * H - 24); x.lineTo(bm.x * W + 20, bm.y * H); x.fill();
  }
  const OCS_AT = (pl) => OC.Chars.all().filter((c) => c.status.onIsland && (c.id === S().activeId ? (OC.World.area && OC.World.area.id) : c.life.loc || 'isle') === pl);
  const where = (c) => { const pl = c.id === S().activeId ? OC.World.area && OC.World.area.id : c.life.loc || 'isle'; const tr = c.life.trip && c.life.trip.eta > OC.Sim.now(); return { pl, tr }; };
  function specials(id) {
    const out = [], wx = OC.Clock.weather(), ph = OC.Clock.phase(OC.Clock.hour());
    if (id === 'beach') { if (ph === 'night') out.push('夜晚：月光水母出沒'); if (wx === 'clear') out.push('晴天：彩虹小魚'); if (ph === 'dusk') out.push('黃昏：星斑鯛、夕陽'); }
    if (id === 'forest') { if (wx === 'rain') out.push('雨天：雲紋錦鯉、雨天蝸牛'); if (ph === 'night') out.push('夜晚：螢火蟲'); out.push('每天的採集點會重新長出來'); }
    if (id === 'street') { const d = SH().deal('food'); if (d) out.push(`食品店特價：${I(d).zh}`); out.push('每日市場：今天的種子與食材'); }
    if (id === 'cafe' && wx === 'rain') out.push('雨天暖飲 85 折');
    if (id === 'isle') { const ready = Object.values(S().garden).filter((p) => p.seed && p.growth >= 1).length; if (ready) out.push(`菜園：${ready} 塊可以收成`); }
    return out;
  }
  Pg().define('explore', '地圖', {
    build(p, el) {
      p.map = h('div.map-wrap'); const cv = h('canvas', { width: 720, height: 720 }); p.map.append(cv); drawWorld(cv);
      p.pins = {}; for (const [id, pl] of Object.entries(PL().P)) { if (!pl.map) continue; const pin = h('button.map-pin' + (pl.locked ? '.locked' : ''), { style: { left: pl.map.x * 100 + '%', top: pl.map.y * 100 + '%' }, 'aria-label': pl.zh, on: { click: () => { p.sel = id; p.refresh(p); } } }, h('div.pin', { style: { '--c': pl.col } }, icon(pl.icon, 's')), h('label', null, pl.zh), h('div.pin-ocs')); p.map.append(pin); p.pins[id] = pin; }
      p.info = h('div', { style: { marginTop: '12px' } }); p.who = h('div');
      el.append(p.map, p.info, p.who);
    },
    refresh(p) {
      const cur = OC.World.area ? OC.World.area.id : 'isle', curTop = PL().top(cur); p.sel = p.sel || curTop;
      if (same(p, [p.sel, cur, OC.Clock.weather(), OC.Clock.phase(OC.Clock.hour()), Object.keys(S().places.visited).length, Object.keys(S().seen).length, OC.Chars.all().map((c) => { const w = where(c); return c.id + w.pl + w.tr + OC.LifeUI.doingText(c); }).join()].join('|'))) return;
      for (const [id, pin] of Object.entries(p.pins)) { pin.classList.toggle('on', id === p.sel); pin.classList.toggle('here', id === curTop); const ocs = OCS_AT(id).concat(Object.entries(PL().P).filter(([, q]) => q.parent === id).flatMap(([k]) => OCS_AT(k))); pin.querySelector('.pin-ocs').replaceChildren(...ocs.slice(0, 4).map((c) => h('i', { title: name(c) }, name(c).slice(0, 1)))); }
      const subs = [p.sel].concat(Object.entries(PL().P).filter(([, q]) => q.parent === p.sel).map(([k]) => k));
      p.info.replaceChildren(...subs.map((id) => placeCard(id, cur)));
      p.who.replaceChildren(T('大家在哪裡', `${OC.Chars.all().filter((c) => c.status.onIsland).length} 位`), h('div.list', null, ...OC.Chars.all().filter((c) => c.status.onIsland).map((c) => { const w = where(c), P0 = PL().get(w.pl); const d = OC.LifeUI.doingText(c); return row(av(c), `${name(c)}${c.id === S().activeId ? '（操控中）' : ''}`, `${w.tr ? '正在前往' : '在'}${P0 ? P0.zh : '?'}${d && !w.tr ? '・' + d : ''}`, w.pl !== cur && c.id !== S().activeId && P0 && !P0.locked ? h('button.btn', { on: { click: () => OC.WorldUI.travel(w.pl) } }, '前往') : null); })));
    },
  });
  function placeCard(id, cur) {
    const pl = PL().get(id), pr = PL().progress(id), ocs = OCS_AT(id), here = id === cur, visited = S().places.visited[id];
    if (pl.locked) return card(h('div.hstack', null, h('h2', { style: { margin: 0, flex: 1, fontSize: 'var(--fs-xl)' } }, pl.zh), h('span.tag', null, icon('lock', 's'), '未開放')), h('p.muted', null, pl.d), h('div.lock-note', null, icon('info', 's'), pl.why));
    return card(
      h('div.hstack', null, h('div.place-thumb', { style: { '--c': pl.col } }, icon(pl.icon)), h('div.grow', null, h('b', { style: { fontSize: 'var(--fs-l)' } }, pl.zh), h('div.hstack', { style: { gap: '4px', flexWrap: 'wrap', marginTop: '2px' } }, h('span.tag.teal', null, PL().TYPES[pl.type]), here ? h('span.tag.accent', null, '你在這裡') : null, !visited ? h('span.tag.sun', null, '還沒去過') : null))),
      h('p.muted', { style: { margin: '8px 0' } }, pl.d),
      pl.finds && pl.finds.length ? h('div', null, h('div.hstack', { style: { fontSize: 'var(--fs-s)' } }, h('span.grow', null, '探索進度'), h('b.num', null, `${pr.found}/${pr.total}`)), h('div.bar', null, h('i', { style: { width: pr.pct + '%', '--c': pl.col } }))) : null,
      h('div.chips', { style: { marginTop: '8px' } }, ...pl.facilities.map((f) => h('span.tag', null, f))),
      specials(id).length ? h('div', { style: { marginTop: '8px' } }, ...specials(id).map((t) => small('✦ ' + t))) : null,
      ocs.length ? h('div', { style: { marginTop: '8px', fontSize: 'var(--fs-s)' } }, '在這裡：', ocs.map(name).join('、')) : null,
      !here ? h('button.btn.primary.block', { style: { marginTop: '12px' }, on: { click: () => OC.WorldUI.travel(id) } }, icon('compass', 's'), `前往${pl.zh}`) : null);
  }

  Pg().define('more', '更多', {
    build(p, el) { p.list = h('div'); el.append(p.list); },
    refresh(p) {
      const Gm = OC.Game, claimable = Gm.todayQuests().filter((q) => q.prog >= q.n && !q.claimed).length;
      if (same(p, [claimable, JSON.stringify(Gm.todayQuests().map((q) => q.claimed)), Object.keys(S().ach).length, Object.keys(S().seen).length, S().goal, S().coins, JSON.stringify(S().inv), Object.keys((S().custom || {}).items || {}).length].join('|'))) return;
      const all = Object.keys(OC.Style.ITEMS).filter((id) => !I(id).custom), seen = all.filter((id) => S().seen[id]).length;
      p.list.replaceChildren(
        h('div.list', null,
          row('flag', '今日任務', `${Gm.todayQuests().filter((q) => q.claimed).length}/4 已領取`, h('div.hstack', null, claimable ? h('span.badge', null, claimable) : null, icon('chev', 'chev')), () => Pg().open('quests')),
          row('trophy', '成就', `${Object.keys(S().ach).length}/${Gm.ACH.length}`, null, () => Pg().open('ach')),
          row('book', '圖鑑', `${seen}/${all.length}`, null, () => Pg().open('collection')),
          row('target', '人生目標', (Gm.GOALS.find((g) => g.id === S().goal) || { zh: '尚未選擇' }).zh, null, () => Pg().open('goals'))),
        h('div.list', { style: { marginTop: '12px' } },
          row('bag', '背包', `${Object.values(S().inv).reduce((a, b) => a + b, 0)} 件物品`, null, () => Pg().open('bag')),
          row('cart', '晴日雜貨攤', '其他商店在晴日商店街', null, () => Pg().open('shop', { shop: 'general' })),
          row('cart', '工坊商品', `${Object.keys((S().custom || {}).items || {}).length} 件`, null, () => Pg().open('products')),
          row('coin', '交易紀錄', `${S().coins.toLocaleString()} 星幣`, null, () => Pg().open('ledger'))),
        h('div.list', { style: { marginTop: '12px' } },
          row('gear', '設定', '主題、效能、時間天氣、操作、資料', null, () => Pg().open('settings')),
          row('info', '關於', null, null, () => Pg().open('about'))));
    },
  });

  // ======================= item use (OC.Use) =======================
  /** OCs that can receive an item now (present, awake / not busy) → [{ c, a, why }] */
  function receivers(id) {
    const out = [], kind = IT().useKind(id);
    for (const c of OC.Chars.all()) {
      const a = A().actorOf(c.id); if (!a) continue; const b = OC.Brain.get(c.id);
      let why = null; if (b && b.holds.size) why = '正在忙'; else if (b && b.st === 'do' && b.act === 'sleep' && kind !== 'wear') why = '正在睡覺'; else if (a.hidden) why = '在屋子裡';
      if ((kind === 'eat') && c.needs.food > 95) why = why || '吃不下了';
      out.push({ c, a, why });
    }
    return out;
  }
  function chooseOC(id, verb, fn) {
    const list = receivers(id); if (!list.length) { toast('這裡沒有 OC 可以給', 'info'); return; }
    if (list.length === 1 && !list[0].why) { fn(list[0].c.id); return; }
    sheet(`${verb}給誰？`, (b, api) => b.append(h('div.list', null, ...list.map(({ c, why }) => row(av(c), name(c), why || `${M().label(c)}${OC.LifeUI.doingText(c) ? '・' + OC.LifeUI.doingText(c) : ''}`, why ? h('span.tag', null, why) : null, why ? null : () => { api.close(); fn(c.id); })))));
  }
  /** eat / drink: animation first; the item is used only if the OC finishes */
  function feed(ocId, id) {
    const c = OC.Chars.get(ocId), a = A().actorOf(ocId), it = I(id); if (!c || !a || !it) return Promise.resolve(false);
    if (St.count(id) < 1) { toast('背包裡沒有了', 'info'); return Promise.resolve(false); }
    const drink = it.kind === 'drink'; if (!drink && c.needs.food > 95) { const ln = OC.Talk.say('fed_full', c, null); if (ln) A().bubble(a, ln.text, name(c)); return Promise.resolve(false); }
    const pref = OC.Taste.pref(c, id), tasted = (OC.Taste.prefs(c).tasted[id] || {}).n, first = !tasted, chew = OC.Chars.behavior(c).chew;
    OC.Brain.hold(ocId, 'feed'); a.tFace = 0.2; a.tBack = 0; haptic();
    const token = {}; a._feed = token;
    if (first) { OC.World.setAction(a, 'think', { dur: 0.9, priority: 8 }); A().floatText(a, '?', 'var(--purple)'); const ln = OC.Talk.say('tasted_first', c, null); if (ln) A().bubble(a, ln.text, name(c), 1.4); }
    return new Promise((resolve) => {
      setTimeout(() => { if (a._feed !== token) return resolve(false); OC.World.setAction(a, drink ? 'drink' : 'eat', { dur: chew + 0.2, priority: 8 }); }, first ? 950 : 50);
      setTimeout(() => {
        const b = OC.Brain.get(ocId), ok = a._feed === token && b && b.holds.has('feed') && [...b.holds].every((x) => x === 'feed') && St.count(id) >= 1;
        a._feed = null;
        if (!ok) { OC.Brain.unhold(ocId, 'feed'); toast('被打斷了，東西還在背包裡', 'info'); return resolve(false); }
        const r = OC.Tx.run(OC.Tx.uid('feed'), { pay: { items: { [id]: 1 } } }, `${name(c)}吃了${it.zh}`, { oc: ocId });
        if (!r.ok) { OC.Brain.unhold(ocId, 'feed'); toast(r.why[0], 'info'); return resolve(false); }
        const t = OC.Taste.taste(c, id), fx = Object.assign({}, it.use || { food: 10 });
        if (t.lv >= 2) fx.mood = (fx.mood || 0) + 10; if (t.lv === 1) fx.mood = (fx.mood || 0) + 4; if (t.lv <= -1) { fx.mood = (fx.mood || 0) - (t.lv === -2 ? 10 : 4); if (fx.food) fx.food = Math.round(fx.food * 0.7); }
        if (OC.Chars.has(c, 'foodie') && t.lv >= 0) fx.mood = (fx.mood || 0) + 4;
        M().needs(c, fx, it.zh);
        const emo = { 2: ['excited', 0.75], 1: ['happy', 0.5], 0: ['content', 0.25], '-1': ['confused', 0.35], '-2': ['annoyed', 0.55] }[t.lv];
        M().feel(c, emo[0], emo[1], `吃了${it.zh}`); M().player(c, { aff: t.lv >= 1 ? 3 : t.lv === 0 ? 1 : 0, fam: 1 }); M().wishEvent(c, { type: 'fed', item: id }, 'player');
        if (t.first || t.lv === 2 || t.lv === -2) M().remember(c, { type: 'player', imp: t.lv === 2 ? 0.7 : t.first ? 0.5 : 0.55, text: `${t.first ? '第一次吃' : '吃了'}你給的${it.zh}，${OC.Taste.LV[t.lv]}${t.lv >= 1 ? '！' : '…'}`, data: { item: id, lv: t.lv }, key: r.entry.key });
        const act = t.lv === 2 ? 'jump' : t.lv === 1 ? 'happy' : t.lv === -1 ? 'sad' : t.lv === -2 ? (OC.Chars.has(c, 'sensitive') ? 'cry' : 'angry') : 'idle';
        if (act === 'jump') { OC.World.jump(a); OC.World.setAction(a, 'happy', { dur: 1.6, priority: 8 }); } else if (act !== 'idle') OC.World.setAction(a, act, { dur: 1.6, priority: 8 });
        if (t.lv === 2) { A().floatText(a, '♥♥', 'var(--heart)'); } if (t.lv <= -1) A().floatText(a, '💦', 'var(--blue)');
        if (it.anim && t.lv >= 0) OC.World.setAction(a, it.anim, { dur: 1.6, priority: 8 });
        const ln = it.reaction && t.lv >= 0 ? { text: it.reaction } : OC.Talk.say({ 2: 'tasted_fav', 1: 'tasted_like', 0: 'tasted_ok', '-1': 'tasted_dislike', '-2': 'tasted_hate' }[t.lv], c, null, { item: id }); if (ln) A().bubble(a, ln.text, name(c));
        if (t.discovered) setTimeout(() => toast(`發現了！${name(c)}${OC.Taste.LV[t.lv] === '普通' ? '覺得' + it.zh + '普普通通' : OC.Taste.LV[t.lv] + it.zh}`, 'heart'), 600);
        St.stat('eaten'); OC.Game.progress('eat');
        setTimeout(() => OC.Brain.unhold(ocId, 'feed'), 1700); resolve(true);
      }, (first ? 950 : 50) + (chew + 0.25) * 1000);
    });
  }
  function play(ocId, id) {
    const c = OC.Chars.get(ocId), a = A().actorOf(ocId), it = I(id); if (!c || !a) return;
    const key = `toy:${id}:${ocId}:${OC.Sim.day()}`, fresh = !(c.life.toyDay && c.life.toyDay[id] === OC.Sim.day());
    OC.Brain.hold(ocId, 'play'); OC.World.setAction(a, 'play', { dur: 3, priority: 8 }); OC.World.jump(a);
    setTimeout(() => {
      (c.life.toyDay = c.life.toyDay || {})[id] = OC.Sim.day();
      M().needs(c, fresh ? it.use || { fun: 15 } : { fun: 4 }, '玩' + it.zh); M().feel(c, 'happy', fresh ? 0.5 : 0.2, '和你玩' + it.zh); M().player(c, { aff: fresh ? 2 : 0, fam: 1 }); M().wishEvent(c, { type: 'played' }, 'player'); M().skill(c, 'sport', 0.6);
      if (fresh) M().remember(c, { type: 'player', imp: 0.4, text: `和你一起玩${it.zh}`, key });
      const ln = OC.Talk.say(fresh ? 'toy' : 'played', c, null); if (ln) A().bubble(a, ln.text, name(c)); OC.Brain.unhold(ocId, 'play');
    }, 3000);
    if (!fresh) toast('今天已經玩過這個了，牠還是陪你玩了一下', 'info');
  }
  function give(ocId, id) {
    const c = OC.Chars.get(ocId), a = A().actorOf(ocId), it = I(id); if (!c || !a) return;
    const r = OC.Tx.run(OC.Tx.uid('gift'), { pay: { items: { [id]: 1 } } }, `送給${name(c)}：${it.zh}`); if (!r.ok) { toast(r.why[0], 'info'); return; }
    const likes = c.tastes.likeItems.includes(id) || (c.profile.likes || []).some((l) => l && it.zh.includes(l)), dis = c.tastes.dislikeItems.includes(id);
    M().feel(c, likes ? 'excited' : dis ? 'confused' : 'happy', likes ? 0.7 : 0.35, `收到你送的${it.zh}`); M().player(c, { aff: likes ? 4 : dis ? 0 : 2, fam: 1 }); M().needs(c, Object.assign({ social: 6 }, it.use || {}));
    M().remember(c, { type: 'player', imp: likes ? 0.65 : 0.4, text: `收到你送的${it.zh}`, data: { item: id }, key: r.entry.key });
    OC.World.setAction(a, it.anim && !dis ? it.anim : likes ? 'happy' : dis ? 'shy' : 'greet', { dur: 1.6, priority: 8 }); const ln = it.reaction && !dis ? { text: it.reaction } : OC.Talk.say(likes ? 'fed_like' : dis ? 'fed_bad' : 'gift_r', c, null, { item: id }); if (ln) A().bubble(a, ln.text, name(c)); St.stat('gifts');
  }
  /** clothing: built-in looks change a look value; workshop clothing becomes a part on its anchor. Not consumed. */
  function wear(ocId, id) {
    const c = OC.Chars.get(ocId), a = A().actorOf(ocId), it = I(id); if (!c || !it) return;
    if (it.custom) { const has = c.parts.find((p) => p.fromItem === id); if (has) { c.parts = c.parts.filter((p) => p.fromItem !== id); toast(`脫下了${it.zh}`, 'shirt'); } else { const [anchor, z] = OC.Rig.SLOT_DEFAULT[it.anchor] || ['head', 'front']; c.parts.push({ id: 'pt' + Date.now().toString(36), slot: it.anchor || 'accessory', assetId: it.asset, anchor, z, x: 0, y: it.anchor === 'hat' ? -12 : 0, scale: 0.8, rot: 0, flip: false, mirror: false, visible: true, fromItem: id }); toast(`穿上了${it.zh}`, 'shirt'); } }
    else { const slot = it.slot, cur = c.look[slot]; if (cur === it.val) { c.look[slot] = slot === 'shirt' ? OC.Chars.LOOK_DEFAULT.shirt : 'none'; toast(`脫下了${it.zh}`, 'shirt'); } else { c.look[slot] = it.val; toast(`${name(c)}穿上了${it.zh}`, 'shirt'); } }
    OC.Chars.save(c); if (a) { a.key = ''; OC.World.setAction(a, 'happy', { dur: 1.2, priority: 7 }); const ln = OC.Talk.say('wear', c, null); if (ln) A().bubble(a, ln.text, name(c)); }
    M().feel(c, 'happy', 0.3, '換了新衣服'); M().player(c, { fam: 1 });
  }
  function use(id, ocId) {
    const k = IT().useKind(id);
    const run = (oid) => (k === 'eat' || k === 'drink' ? feed(oid, id) : k === 'play' ? play(oid, id) : k === 'wear' ? wear(oid, id) : give(oid, id));
    if (k === 'place') { A().startPlacement({ id }); return; }
    if (ocId) return run(ocId);
    chooseOC(id, { eat: '餵', drink: '給', play: '一起玩', wear: '穿', gift: '送' }[k] || '給', run);
  }
  OC.Use = { use, feed, play, give, wear, receivers, chooseOC };

  // ======================= item details sheet (bag / quick bag) =======================
  function facts(id) {
    const it = I(id), out = [];
    out.push(`${(IT().KINDS[it.kind] || {}).zh || it.kind}・${IT().RARITY[it.rarity] || ''}`);
    if (it.use) out.push('效果：' + Object.entries(it.use).map(([k, v]) => `${(OC.LifeData.NEEDS.find((n) => n.id === k) || { zh: k }).zh}${v > 0 ? '+' : ''}${v}`).join(' '));
    if (it.flavor) out.push('口味：' + Object.keys(it.flavor).map((k) => IT().FLAVORS[k]).join('、') + (it.texture ? `・${IT().TEXTURES[it.texture]}` : '') + (it.temp ? `・${it.temp === 'hot' ? '熱' : it.temp === 'cold' ? '冰' : '常溫'}` : ''));
    if (it.grow) out.push(`種下後約 ${it.grow.days} 天收成${I(it.grow.crop).zh}`);
    if (it.src && it.src.length) out.push('取得：' + it.src.join('、'));
    if (it.sell) out.push(`在雜貨攤／每日市場可以賣 ${it.sell} 星幣`);
    return out;
  }
  function itemSheet(id, after) {
    const it = I(id); if (!it) return;
    sheet(it.zh, (b, api) => {
      const k = IT().useKind(id), fav = (S().favs || {})[id];
      const done = () => { api.close(); after && after(); };
      const acts = [];
      if (k === 'eat' || k === 'drink') acts.push(h('button.btn.primary.block', { on: { click: () => { api.close(); use(id); } } }, icon('apple', 's'), k === 'drink' ? '給 OC 喝' : '給 OC 吃'));
      if (k === 'play') acts.push(h('button.btn.primary.block', { on: { click: () => { api.close(); use(id); } } }, icon('play', 's'), '和 OC 一起玩'));
      if (k === 'wear') acts.push(h('button.btn.primary.block', { on: { click: () => { api.close(); use(id); } } }, icon('shirt', 's'), '穿上／脫下'));
      if (k === 'place') acts.push(h('button.btn.primary.block', { on: { click: () => { done(); A().startPlacement({ id }); } } }, icon('sofa', 's'), '拿出來佈置'));
      if (k === 'gift') acts.push(h('button.btn.block', { on: { click: () => { api.close(); use(id); } } }, icon('gift', 's'), '送給 OC'));
      if (it.grow) acts.push(h('div.lock-note', null, icon('info', 's'), '到晴日島的菜園（右下方）點一下就能種下。'));
      b.append(h('div.hstack', null, img(id, 72), h('div.grow', null, h('div.muted', null, `持有 ${St.count(id)} 個`), h('p', { style: { margin: '4px 0' } }, it.d || ''), ...facts(id).map(small))),
        h('div.vstack', { style: { marginTop: '12px', gap: '8px' } }, ...acts, h('button.btn.ghost.block', { on: { click: () => { const on = IT().toggleFav(id); toast(on ? '加入收藏' : '取消收藏', 'star'); done(); } } }, icon('star', 's'), fav ? '取消收藏' : '收藏（快捷背包優先顯示）')));
    });
  }
  Pg().itemSheet = itemSheet;

  // ======================= bag =======================
  Pg().define('bag', '背包', {
    sub: true,
    build(p, el) {
      p.q = h('input.input', { type: 'search', placeholder: '搜尋名稱、類別、標籤…', 'aria-label': '搜尋', on: { input: () => p.refresh(p) } });
      p.group = 'all'; p.sort = 'kind';
      p.chips = h('div.chips.scroll'); p.sortSel = h('select.input.s', { 'aria-label': '排序', on: { change: (e) => { p.sort = e.target.value; p.refresh(p); } } }, ...[['kind', '依類別'], ['name', '依名稱'], ['count', '依數量'], ['rarity', '依稀有度'], ['price', '依價格']].map(([v, t]) => h('option', { value: v }, t)));
      p.grid = h('div.grid.c4'); p.sum = h('div.muted', { style: { fontSize: 'var(--fs-s)' } });
      el.append(h('div.hstack', null, p.q, p.sortSel), p.chips, p.sum, p.grid, small('背包和快捷背包是同一份庫存。物品只能從商店、探索、活動、收成與獎勵取得。'));
    },
    refresh(p) {
      if (same(p, [JSON.stringify(S().inv), JSON.stringify(S().favs || {}), p.q.value, p.group, p.sort].join('|'))) return;
      const owned = Object.keys(S().inv).filter((id) => I(id) && St.count(id) > 0);
      const groups = [['all', '全部'], ['fav', '★ 收藏']].concat(IT().GROUPS.map(([k, zh]) => [k, zh]));
      p.chips.replaceChildren(...groups.map(([k, zh]) => { const n = k === 'all' ? owned.length : k === 'fav' ? owned.filter((id) => (S().favs || {})[id]).length : owned.filter((id) => IT().groupOf(id) === k).length; return h('button.chip-btn' + (p.group === k ? '.on' : ''), { on: { click: () => { p.group = k; p.refresh(p); } } }, `${zh} ${n}`); }));
      const list = IT().query(owned, { q: p.q.value, group: p.group === 'fav' ? 'all' : p.group, fav: p.group === 'fav', sort: p.sort });
      p.sum.textContent = `${list.length} 種・共 ${list.reduce((a, id) => a + St.count(id), 0)} 個`;
      p.grid.replaceChildren(...(list.length ? list.map((id) => h('button.tile', { on: { click: () => itemSheet(id, () => p.refresh(p)) } }, img(id, 44), h('span.ellipsis', null, I(id).zh), h('span.count', null, '×' + St.count(id)), (S().favs || {})[id] ? h('span.fav', null, '★') : null)) : [h('div.empty', { style: { gridColumn: '1 / -1' } }, owned.length ? '沒有符合的物品' : '背包是空的。搖果樹、採集、釣魚或到商店逛逛吧！')]));
    },
  });

  // ======================= shop =======================
  Pg().define('shop', '商店', {
    sub: true,
    build(p, el) {
      p.head = h('div'); p.tabs = seg([['buy', '購買'], ['sell', '賣出']], 'buy', (v) => { p.mode = v; p.refresh(p); }); p.mode = 'buy';
      p.q = h('input.input', { type: 'search', placeholder: '搜尋商品', 'aria-label': '搜尋商品', on: { input: () => p.refresh(p) } }); p.cat = 'all'; p.chips = h('div.chips.scroll'); p.body = h('div');
      el.append(p.head, p.tabsWrap = h('div', { style: { marginTop: '10px' } }, p.tabs), h('div', { style: { marginTop: '10px' } }, p.q), p.chips, p.body);
    },
    refresh(p) {
      const sid = (p.params && p.params.shop) || p.sid || 'general'; p.sid = sid; const shop = SH().get(sid);
      if (same(p, [sid, p.mode, p.cat, p.q.value, S().coins, JSON.stringify(S().inv), OC.Sim.day(), OC.Clock.weather(), JSON.stringify(S().shops[sid] || {}), Object.keys((S().custom || {}).items || {}).length].join('|'))) return;
      p.el.querySelector('h1').textContent = shop.zh;
      p.tabsWrap.hidden = !shop.sells; if (!shop.sells) p.mode = 'buy';
      const d = SH().deal(sid);
      p.head.replaceChildren(card(h('div.hstack', null, h('div.place-thumb', { style: { '--c': 'var(--accent)' } }, icon(shop.ic)), h('div.grow', null, h('b', null, shop.zh), small(shop.eatHere ? '點餐後可以直接請 OC 吃，或帶走放進背包' : shop.rotate ? '每天換一批商品，數量有限' : '每天有一件今日特價')), coin(S().coins))), d ? h('div.deal', null, icon('sparkle', 's'), `今日特價：${I(d).zh}（8 折）`) : null);
      if (p.mode === 'sell') { renderSell(p); return; }
      const list = SH().stock(sid), cats = Array.from(new Set(list.map((id) => IT().groupOf(id))));
      p.chips.replaceChildren(...[['all', '全部']].concat(IT().GROUPS.filter(([k]) => cats.includes(k)).map(([k, zh]) => [k, zh])).map(([k, zh]) => h('button.chip-btn' + (p.cat === k ? '.on' : ''), { on: { click: () => { p.cat = k; p.refresh(p); } } }, zh)));
      const shown = IT().query(list, { q: p.q.value, group: p.cat, sort: 'price' });
      p.body.replaceChildren(h('div.shop-grid', null, ...shown.map((id) => {
        const pr = SH().price(sid, id), left = SH().left(sid, id), own = SH().owned(id), it = I(id);
        return h('button.shop-item' + (own || left === 0 ? '.dim' : ''), { on: { click: () => buySheet(p, sid, id) } }, img(id, 52), h('b.ellipsis', null, it.zh), h('div.hstack', { style: { justifyContent: 'center', gap: '4px' } }, pr.price < pr.base ? h('s.faint', null, pr.base) : null, coin(pr.price)), pr.tag ? h('span.badge-tag', null, pr.tag) : null, it.custom ? h('span.badge-tag.teal', null, '工坊商品') : null, own ? h('span.tag.teal', null, '已擁有') : left !== Infinity ? h('span.tag', null, left ? `剩 ${left}` : '賣完了') : null);
      })), shown.length ? null : h('div.empty', null, '沒有符合的商品'));
    },
  });
  function buySheet(p, sid, id) {
    const it = I(id), shop = SH().get(sid), pr = SH().price(sid, id), left = SH().left(sid, id), own = SH().owned(id);
    let n = 1; const max = Math.max(1, Math.min(left === Infinity ? 20 : left, it.kind === 'clothing' ? 1 : 20, Math.floor(S().coins / pr.price) || 1));
    sheet(it.zh, (b, api) => {
      const num = h('b.num', null, '1'), tot = h('span'), btn = h('button.btn.primary.block');
      const sync = () => { num.textContent = n; tot.replaceChildren('合計 ', coin(pr.price * n)); btn.disabled = own || left === 0 || S().coins < pr.price * n; btn.textContent = own ? '已擁有' : left === 0 ? '今天賣完了' : S().coins < pr.price * n ? '星幣不夠' : `購買 ×${n}`; };
      btn.addEventListener('click', () => {
        const r = SH().buy(sid, id, n); if (!r.ok) { toast(r.why, 'info'); return; }
        haptic(); toast(`買了 ${it.zh} ×${n}（-${r.total} 星幣）`, 'cart'); if (r.firsts && r.firsts.length) OC.WorldUI.discovered(r.firsts);
        api.close(); p.refresh(p);
        if (shop.eatHere && (it.kind === 'food' || it.kind === 'drink')) setTimeout(() => confirm('現在就吃嗎？', `要請 OC 在${shop.zh}吃${it.zh}嗎？（也可以留在背包）`, '現在吃').then((y) => { if (y) use(id); }), 350);
      });
      b.append(h('div.hstack', null, img(id, 72), h('div.grow', null, h('p', { style: { margin: '0 0 4px' } }, it.d || ''), ...facts(id).filter((t) => !t.startsWith('在雜貨攤')).map(small))),
        it.custom ? small('這是你在工坊做的原創商品') : null,
        h('div.hstack', { style: { marginTop: '12px' } }, h('button.icon-btn', { 'aria-label': '減少', on: { click: () => { n = Math.max(1, n - 1); sync(); } } }, icon('minus')), num, h('button.icon-btn', { 'aria-label': '增加', on: { click: () => { n = Math.min(max, n + 1); sync(); } } }, icon('plus')), h('span.grow'), tot),
        h('div', { style: { marginTop: '12px' } }, btn));
      sync();
    });
  }
  function renderSell(p) {
    const inv = Object.keys(S().inv).filter((id) => I(id) && I(id).sell && St.count(id) > 0 && I(id).kind !== 'clothing');
    p.chips.replaceChildren();
    p.body.replaceChildren(inv.length ? h('div.list', null, ...IT().query(inv, { q: p.q.value, sort: 'kind' }).map((id) => { const it = I(id); return row(img(id, 40), `${it.zh} ×${St.count(id)}`, `每個 ${it.sell} 星幣`, h('div.hstack', { style: { gap: '4px' } }, h('button.btn.s', { on: { click: () => doSell(p, id, 1) } }, '賣 1'), St.count(id) > 1 ? h('button.btn.s', { on: { click: async () => { if (await confirm('全部賣出', `賣出 ${it.zh} ×${St.count(id)}，得到 ${it.sell * St.count(id)} 星幣？`, '賣出')) doSell(p, id, St.count(id)); } } }, '全部') : null)); })) : h('div.empty', null, '沒有可以賣的東西'));
  }
  function doSell(p, id, n) { const g = OC.Game.sell(id, n); if (g) { haptic(); toast(`賣出 ${I(id).zh} ×${n}，得到 ${g} 星幣`, 'coin'); } p.refresh(p); }

  // ======================= collection =======================
  const COLL = [['fish', '魚類', (id) => I(id).kind === 'fish'], ['bug', '小生物', (id) => I(id).kind === 'bug'], ['sea', '海洋收藏', (id) => I(id).kind === 'sea'], ['plant', '植物與作物', (id) => ['crop', 'seed'].includes(I(id).kind) || ['berry', 'herb', 'acorn', 'mushroom', 'flower', 'sunflower', 'apple', 'orange', 'peach'].includes(id)], ['food', '料理與飲料', (id) => (I(id).kind === 'food' || I(id).kind === 'drink') && !['berry', 'mushroom', 'apple', 'orange', 'peach', 'cheese', 'honey'].includes(id)], ['home', '家具', (id) => I(id).kind === 'furniture'], ['wear', '服飾', (id) => I(id).kind === 'clothing'], ['other', '其他', (id) => ['gift', 'toy', 'material'].includes(I(id).kind)]];
  Pg().define('collection', '圖鑑', {
    sub: true,
    build(p, el) { p.cat = 'fish'; p.chips = h('div.chips.scroll'); p.body = h('div'); p.places = h('div'); el.append(p.chips, p.body, T('地點探索'), p.places); },
    refresh(p) {
      if (same(p, [p.cat, Object.keys(S().seen).length, JSON.stringify(S().inv), Object.keys(S().places.visited).length].join('|'))) return;
      const all = Object.keys(OC.Style.ITEMS).filter((id) => !I(id).custom);
      p.chips.replaceChildren(...COLL.map(([k, zh, f]) => { const ids = all.filter(f), got = ids.filter((id) => S().seen[id]).length; return h('button.chip-btn' + (p.cat === k ? '.on' : ''), { on: { click: () => { p.cat = k; p.refresh(p); } } }, `${zh} ${got}/${ids.length}`); }));
      const ids = all.filter(COLL.find((c) => c[0] === p.cat)[2]).sort((a, b) => I(a).rarity - I(b).rarity || I(a).zh.localeCompare(I(b).zh, 'zh-Hant'));
      const tot = all.filter((id) => S().seen[id]).length;
      p.body.replaceChildren(card(h('div.hstack', null, h('span.grow', null, '已發現'), h('b.num', null, `${tot}/${all.length}`)), h('div.bar', null, h('i', { style: { width: Math.round(tot / all.length * 100) + '%', '--c': 'var(--accent)' } }))),
        h('div.grid.c4', { style: { marginTop: '10px' } }, ...ids.map((id) => { const seen = S().seen[id]; return h('button.tile' + (seen ? '' : '.locked'), { on: { click: () => seen ? collSheet(id) : toast(`還沒發現。提示：${(I(id).src || ['到處探索看看']).join('、')}`, 'compass') } }, seen ? img(id, 44) : h('div.q', null, '？'), h('span.ellipsis', null, seen ? I(id).zh : '？？？'), seen && St.count(id) ? h('span.count', null, '×' + St.count(id)) : null, h('span.rar', null, '★'.repeat(I(id).rarity))); })));
      p.places.replaceChildren(h('div.list', null, ...Object.entries(PL().P).filter(([, q]) => !q.locked).map(([id, q]) => { const pr = PL().progress(id); return row(h('div.place-thumb.s', { style: { '--c': q.col } }, icon(q.icon, 's')), q.zh, S().places.visited[id] ? `探索 ${pr.found}/${pr.total}・第一次造訪 ${new Date(S().places.visited[id]).toLocaleDateString('zh-TW')}` : '還沒去過'); })));
    },
  });
  function collSheet(id) {
    const it = I(id), who = OC.Chars.all().map((c) => [c, (OC.Taste.prefs(c).tasted[id] || {}).n]).filter(([, n]) => n);
    const places = Object.entries(PL().P).filter(([, q]) => (q.finds || []).includes(id)).map(([, q]) => q.zh);
    sheet(it.zh, (b) => b.append(h('div.center', null, img(id, 96)), h('p', null, it.d || ''), ...facts(id).map(small), places.length ? small('地點：' + places.join('、')) : null, small(`第一次取得：${new Date(S().seen[id]).toLocaleString('zh-TW')}`), who.length ? small('品嚐過：' + who.map(([c, n]) => `${name(c)}（${n} 次・${OC.Taste.LV[OC.Taste.pref(c, id).lv]}）`).join('、')) : null));
  }

  // ======================= workshop products =======================
  Pg().define('products', '工坊商品', {
    sub: true,
    build(p, el) { p.body = h('div'); el.append(card(h('b', null, '把你畫的、匯入的圖片變成遊戲裡的商品'), small('工坊只負責「創作與上架」：商品會出現在你選的商店，要用星幣購買才會進入背包。'), h('button.btn.primary.block', { style: { marginTop: '10px' }, on: { click: () => editProduct(null, () => p.refresh(p)) } }, icon('plus', 's'), '新增商品')), p.body); },
    refresh(p) {
      if (same(p, JSON.stringify((S().custom || {}).items || {}) + JSON.stringify(S().inv))) return;
      const C = Object.values((S().custom || {}).items || {});
      p.body.replaceChildren(T('我的商品', `${C.length} 件`), C.length ? h('div.list', null, ...C.map((d) => row(img(d.id, 40), d.zh, `${(IT().KINDS[d.kind] || {}).zh}・${SH().get(d.shop).zh}・${d.price} 星幣・持有 ${St.count(d.id)}`, null, () => editProduct(d, () => p.refresh(p))))) : card(h('span.faint', null, '還沒有商品')));
    },
  });
  function editProduct(d, after) {
    const v = Object.assign({ zh: '', kind: 'food', price: 80, power: 20, tags: [], shop: null, d: '', anchor: 'accessory', sit: false, flavor: null, reaction: '', anim: '' }, d ? JSON.parse(JSON.stringify(d)) : {});
    sheet(d ? '編輯商品' : '新增商品', (b, api) => {
      const prev = h('div.prod-prev'); const showPrev = () => { prev.replaceChildren(v.asset ? (() => { const im = h('img', { alt: '' }); OC.Assets.thumbURL(v.asset).then((u) => { im.src = u; }).catch(() => {}); return im; })() : h('span.faint', null, '還沒有圖片')); };
      const nameIn = h('input.input', { value: v.zh, maxlength: 16, placeholder: '商品名稱', on: { input: (e) => (v.zh = e.target.value) } });
      const kindSeg = seg(IT().CUSTOM_KINDS.map((k) => [k, IT().KINDS[k].zh]), v.kind, (k) => { v.kind = k; v.shop = null; render(); });
      const priceIn = h('input', { type: 'range', min: 10, max: 2000, step: 10, value: v.price, 'aria-label': '價格', on: { input: (e) => { v.price = +e.target.value; priceLab.textContent = v.price + ' 星幣'; } } }), priceLab = h('b.num', null, v.price + ' 星幣');
      const extra = h('div');
      const render = () => {
        const shops = Object.entries(SH().SHOPS).filter(([k]) => k !== 'cafe' || v.kind === 'food' || v.kind === 'drink');
        extra.replaceChildren(
          ['food', 'drink', 'toy', 'gift'].includes(v.kind) ? h('div', null, h('div.muted', null, `效果強度：${v.power}`), h('input', { type: 'range', min: 5, max: 40, step: 1, value: v.power, 'aria-label': '效果強度', on: { input: (e) => { v.power = +e.target.value; e.target.previousSibling.textContent = `效果強度：${v.power}`; } } })) : null,
          v.kind === 'food' || v.kind === 'drink' ? h('div', null, h('div.muted', null, '口味（影響 OC 的喜好）'), h('div.chips', null, ...Object.entries(IT().FLAVORS).map(([k, zh]) => h('button.chip-btn' + (v.flavor && v.flavor[k] ? '.on' : ''), { on: { click: () => { v.flavor = v.flavor || {}; if (v.flavor[k]) delete v.flavor[k]; else v.flavor[k] = 1; render(); } } }, zh)))) : null,
          v.kind === 'clothing' ? h('div', null, h('div.muted', null, '穿戴位置'), seg([['hat', '頭上'], ['accessory', '頭部飾品'], ['faceacc', '臉上'], ['clothing', '身上'], ['back', '背後'], ['held', '手上']], v.anchor, (k) => (v.anchor = k))) : null,
          v.kind === 'furniture' ? h('div.hstack', null, h('span.grow', null, 'OC 可以坐在上面'), toggle(v.sit, (x) => (v.sit = x))) : null,
          h('div.muted', { style: { marginTop: '8px' } }, '上架到'), h('select.input', { on: { change: (e) => (v.shop = e.target.value) } }, ...shops.map(([k, s]) => h('option', { value: k, selected: (v.shop || IT().defaultShop(v.kind)) === k }, s.zh))));
      };
      const desc = h('textarea.input', { rows: 2, maxlength: 80, placeholder: '商品介紹（可留空）', on: { input: (e) => (v.d = e.target.value) } }); desc.value = v.d || '';
      b.append(h('div.hstack', null, prev, h('div.vstack.grow', { style: { gap: '6px' } }, h('button.btn.s', { on: { click: async () => { const a = await OC.Library.pick({ title: '選擇商品圖片' }); if (a) { v.asset = a.id; showPrev(); } } } }, icon('image', 's'), '從素材庫選'), h('button.btn.s', { on: { click: async () => { const m = await OC.Paint.open({ w: 256, h: 256 }); if (m && m.id) { v.asset = m.id; showPrev(); } } } }, icon('brush', 's'), '畫一張'))),
        h('div.muted', { style: { marginTop: '10px' } }, '名稱'), nameIn, h('div.muted', { style: { marginTop: '10px' } }, '類別'), h('div', { style: { overflowX: 'auto' } }, kindSeg),
        h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow.muted', null, '價格'), priceLab), priceIn, extra, h('div.muted', { style: { marginTop: '8px' } }, '介紹'), desc,
        h('div.muted', { style: { marginTop: '8px' } }, '標籤（用逗號分隔，可搜尋）'), h('input.input', { value: (v.tags || []).join('、'), maxlength: 40, placeholder: '例如：甜點、夏天', on: { input: (e) => (v.tags = e.target.value.split(/[,，、]/).map((t) => t.trim()).filter(Boolean).slice(0, 6)) } }),
        h('div.muted', { style: { marginTop: '8px' } }, 'OC 拿到時說的話（可留空＝依個性自動）'), h('input.input', { value: v.reaction || '', maxlength: 30, placeholder: '例如：哇，是粉紅糰子！', on: { input: (e) => (v.reaction = e.target.value) } }),
        h('div.muted', { style: { marginTop: '8px' } }, 'OC 的反應動作'), h('select.input', { on: { change: (e) => (v.anim = e.target.value) } }, ...[['', '依喜好自動'], ['happy', '開心'], ['jump', '跳起來'], ['shy', '害羞'], ['greet', '揮手'], ['dance', '跳舞'], ['surprised', '驚訝']].filter(([k]) => !k || OC.Chars.ACTION_ZH[k]).map(([k, zh]) => h('option', { value: k, selected: (v.anim || '') === k }, zh))),
        h('div.hstack', { style: { marginTop: '12px' } }, d ? h('button.btn.block', { on: { click: async () => { if (St.count(d.id)) { toast('背包裡還有這件商品，不能刪除', 'info'); return; } if (await confirm('刪除商品', `刪除「${d.zh}」？已經擺放在場景中的也會消失。`, '刪除', true)) { for (const r of Object.values(S().rooms)) for (let i = r.length - 1; i >= 0; i--) if (r[i].id === d.id) r.splice(i, 1); IT().removeCustom(d.id); api.close(); after && after(); } } } }, '刪除') : null,
          h('button.btn.primary.block', { on: { click: () => { const r = IT().saveCustom(Object.assign({}, v, { id: d && d.id, shop: v.shop || IT().defaultShop(v.kind) })); if (!r.ok) { toast(r.errors[0], 'info'); return; } toast(`「${v.zh}」已上架到${SH().get(v.shop || IT().defaultShop(v.kind)).zh}`, 'check'); api.close(); after && after(); } } }, icon('check', 's'), d ? '儲存' : '上架')));
      showPrev(); render();
    });
  }

  // ======================= ledger =======================
  Pg().define('ledger', '交易紀錄', {
    sub: true,
    refresh(p, el) {
      if (same(p, OC.Tx.log.length + ':' + (OC.Tx.log[0] ? OC.Tx.log[0].key : ''))) return;
      const L = OC.Tx.log.slice(0, 120);
      el.replaceChildren(small('所有星幣與物品的變化都會記錄在這裡（最近 300 筆）。'), L.length ? h('div.list', null, ...L.map((e) => { const items = (o) => Object.entries((o && o.items) || {}).map(([id, n]) => `${(I(id) || { zh: id }).zh}×${n}`).join('、'); const plus = [e.get && e.get.coins ? `+${e.get.coins} 星幣` : '', items(e.get)].filter(Boolean).join(' '), minus = [e.pay && e.pay.coins ? `-${e.pay.coins} 星幣` : '', items(e.pay) ? '−' + items(e.pay) : ''].filter(Boolean).join(' '); return row(null, e.reason || '交易', `${new Date(e.at).toLocaleString('zh-TW')}　${[plus, minus].filter(Boolean).join('　')}`); })) : card(h('span.faint', null, '還沒有交易')));
    },
  });

  // ======================= food preferences (editor + profile) =======================
  const FOODS = () => Object.keys(OC.Style.ITEMS).filter((id) => IT().isFood(id) && !I(id).custom || (I(id).custom && (I(id).kind === 'food' || I(id).kind === 'drink')));
  const LV_OPTS = [['-2', '😖'], ['-1', '🙁'], ['0', '🙂'], ['1', '😋'], ['2', '😍']];
  function foodPrefs(c, x) {
    const box = h('div');
    const render = () => {
      const t = OC.Taste.prefs(c);
      box.replaceChildren(
        T('口味傾向', '影響還沒吃過的食物'), card(...Object.entries(IT().FLAVORS).map(([k, zh]) => h('div.hstack', null, h('span', { style: { width: '44px' } }, zh), seg([['-2', '很討厭'], ['-1', '不愛'], ['0', '普通'], ['1', '喜歡'], ['2', '超愛']], String(t.flavor[k] || 0), (v) => { t.flavor[k] = +v; x.changed('tastes'); })))),
        T('飲食喜好', '鎖定＝吃了也不會被改變'), h('div.list', null, ...FOODS().sort((a, b) => I(a).zh.localeCompare(I(b).zh, 'zh-Hant')).map((id) => {
          const pf = OC.Taste.pref(c, id), src = t.food[id] ? t.food[id].src : 'unknown';
          return h('div.food-row', null, img(id, 32), h('div.grow', null, h('div.ellipsis', null, I(id).zh), small(src === 'player' ? '你設定的' : src === 'discovered' ? `吃了才知道・${OC.Taste.LV[pf.lv]}` : '還沒吃過（自動）')),
            seg(LV_OPTS, src === 'unknown' ? '' : String(pf.lv), (v) => { OC.Taste.setPref(c, id, +v, true); x.changed('tastes', +v > 0 ? 'happy' : +v < 0 ? 'sad' : null); render(); }),
            src !== 'unknown' ? h('button.icon-btn', { 'aria-label': t.food[id].locked ? '解除鎖定' : '鎖定', on: { click: () => { t.food[id].locked = !t.food[id].locked; if (!t.food[id].locked && t.food[id].src === 'player') delete t.food[id]; x.changed('tastes'); render(); } } }, icon(t.food[id].locked ? 'lock' : 'refresh', 's')) : null);
        })));
    };
    render(); return box;
  }
  const origTastes = OC.CharEdit.sections.tastes;
  OC.CharEdit.sections.tastes = function (c, x) {
    const el = origTastes(c, x);
    // replace the old all-items grid with: food preferences (5 levels) + a non-food like / dislike grid
    const grid = el.querySelector('.grid.c4'); if (grid) { [...grid.children].forEach((b) => { if (IT().isFood(b.dataset.v) || I(b.dataset.v).kind === 'furniture' || I(b.dataset.v).custom) b.remove(); }); const t = grid.previousElementSibling; if (t) t.firstChild.textContent = '喜歡的物品（禮物）'; }
    el.append(foodPrefs(c, x)); return el;
  };
  /** profile card: tasted foods, favourites, discoveries */
  function foodCard(c) {
    const t = OC.Taste.prefs(c), tasted = Object.entries(t.tasted).sort((a, b) => b[1].last - a[1].last);
    const fav = FOODS().filter((id) => t.food[id] && t.food[id].lv === 2), hate = FOODS().filter((id) => t.food[id] && t.food[id].lv === -2);
    return h('div', null, T('飲食', `品嚐過 ${tasted.length} 種`), card(
      h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '最愛'), fav.length ? h('div.chips', null, ...fav.map((id) => h('span.tag.accent', null, img(id, 18), I(id).zh))) : small('還沒有（多讓牠嚐嚐看）'),
      h('div.muted', { style: { fontSize: 'var(--fs-s)', marginTop: '8px' } }, '最討厭'), hate.length ? h('div.chips', null, ...hate.map((id) => h('span.tag', null, img(id, 18), I(id).zh))) : small('還沒有'),
      tasted.length ? h('div', { style: { marginTop: '8px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '品嚐紀錄'), ...tasted.slice(0, 10).map(([id, r]) => small(`${I(id) ? I(id).zh : id}・${r.n} 次・第一次的反應：${OC.Taste.LV[{ fav: 2, like: 1, ok: 0, dislike: -1, hate: -2 }[r.reaction]] || '—'}・現在：${OC.Taste.LV[OC.Taste.pref(c, id).lv]}`))) : null,
      small('喜好在「編輯角色 › 喜好」設定；你鎖定的喜好不會被品嚐改變。')));
  }
  OC.P5UI = { foodCard, drawWorld, itemSheet, buySheet, editProduct };
})();
