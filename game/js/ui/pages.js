/* OC Shimeji — pages. Each page is built once (structure) and refreshed in place when its
 * data changes. Rule: the profile is for VIEWING, the editor / wardrobe are for EDITING;
 * every page has at most one primary button; features that are not implemented are shown
 * as clearly locked (未開放) instead of fake buttons.
 */
(function () {
  'use strict';
  const { h, icon, toast, sheet, confirm, seg, toggle, row, lockedRow, swatches, haptic } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, Gm = OC.Game, Sty = OC.Style;
  const pages = {};
  const app = () => OC.App;

  // 10.0: every page head carries a sticker (what this place is), on a white toy pad
  const PAGE_STK = { char: 'person', profile: 'person', charedit: 'person', workshop: 'brush', studio: 'sparkle', library: 'sparkle', explore: 'compass', more: 'flag', quests: 'flag', goals: 'star',
    bag: 'bag', shop: 'shop', products: 'shop', ledger: 'coin', settings: 'gear', about: 'star', collection: 'book', ach: 'trophy', needs: 'heart', npc: 'users', lifeset: 'heart', dialogue: 'chat', lifedev: 'gear',
    petcenter: 'phone', petone: 'phone', petapps: 'phone', pettools: 'clock', petdiag: 'gear' };
  function head(title, sub, right, stk) {
    return h('div.page-head', null, h('div.head-bg'), sub ? h('button.icon-btn', { 'aria-label': '返回', on: { click: () => OC.UI.back() } }, icon('back')) : null,
      stk && OC.UI.sticker ? h('span.stk-pad', null, OC.UI.sticker(stk)) : null, h('h1', null, title), right || null);
  }
  function define(id, title, o) { pages[id] = Object.assign({ id, title, sub: !!o.sub, el: null }, o); }
  function ensure(p) {
    if (p.el) return p;
    p.el = h('section.page' + (p.sub ? '.sub' : ''), { 'data-page': p.id, 'aria-label': p.title });
    p.el.append(head(p.title, p.sub, p.headRight && p.headRight(p), p.stk || PAGE_STK[p.id]));
    p.inner = h('div.page-inner'); p.el.append(p.inner);
    document.getElementById('pages').append(p.el);
    p.build && p.build(p, p.inner);
    return p;
  }
  function open(id, params) {
    const p = ensure(pages[id]); p.params = params || {};
    if (p.sub) {
      if (p.layer) OC.UI.popLayer(p.layer);
      p.layer = { scrim: false, close: () => close(id) }; OC.UI.pushLayer(p.layer);
      p.el.scrollTop = 0;
    }
    p.refresh && p.refresh(p, p.inner);
    p.wantOpen = true;
    requestAnimationFrame(() => { if (p.wantOpen) p.el.classList.add('open'); });   // 8.0: a close in the same frame (fast tab switching on a slow phone) must win
    p.onShow && p.onShow(p);
    return p;
  }
  function close(id) { const p = pages[id]; if (!p || !p.el) return; p.wantOpen = false; p.el.classList.remove('open'); if (p.layer) { OC.UI.popLayer(p.layer); p.layer = null; } p.onHide && p.onHide(p); }
  function refreshOpen() { for (const p of Object.values(pages)) if (p.el && p.el.classList.contains('open') && p.refresh) p.refresh(p, p.inner); }

  const card = (...k) => h('div.card', null, ...k);
  const title = (t, small) => h('div.section-title', null, t, small ? h('small', null, small) : null);
  const bar = (v, c) => h('div.bar', null, h('i', { style: { width: Math.round(v) + '%', '--c': c } }));
  const hearts = (fr) => { const l = Gm.friendLevel(fr), el = h('span.hstack', { style: { gap: '2px', color: 'var(--heart)' } }); for (let i = 1; i < Gm.LEVELS.length; i++) el.append(icon(i <= l ? 'heart' : 'heart', 's' + (i <= l ? ' fill' : ''))); el.querySelectorAll('svg').forEach((s, i) => { if (i + 1 <= l) { s.style.fill = 'currentColor'; } else s.style.opacity = 0.35; }); return el; };
  const portraitCanvas = (px = 240) => { const c = h('canvas'); c.width = px; c.height = px; return c; };

  // =====================================================================
  // 需求 needs (real values + how to restore them)
  // =====================================================================
  define('needs', '需求', {
    sub: true,
    refresh(p, el) {
      const c = OC.Chars.active();
      el.replaceChildren(h('p.muted', null, `${OC.Chars.name(c)}現在：${OC.Mind.label(c)}。需求依照遊戲時間變化；OC 會自己去滿足它們，你也可以幫忙。`), ...Gm.NEEDS.map((n) => card(h('div.need', null, h('div.dot', { style: { '--c': n.c } }, icon(n.ic, 's')), h('b', null, n.zh), bar(c.needs[n.id], n.c), h('span.val.num', null, Math.round(c.needs[n.id]))), h('div.muted', { style: { fontSize: 'var(--fs-s)', marginTop: '8px' } }, '恢復：', n.how), n.decay ? h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '2px' } }, `基本每遊戲小時下降約 ${n.decay}（會依個性、天氣與正在做的事改變）；離開遊戲時最多模擬 8 小時，且不會低於 15。`) : null)));
    },
  });


  // =====================================================================
  // 人生目標 life goals
  // =====================================================================
  define('goals', '人生目標', {
    sub: true,
    refresh(p, el) {
      el.replaceChildren(h('p.muted', null, '選一個長期目標，進度會依你在島上實際做的事累積。'), ...Gm.GOALS.map((g) => {
        const on = S().goal === g.id, v = Math.min(g.v(), g.n);
        return h('div.card', { style: on ? { boxShadow: '0 0 0 2.5px var(--accent), var(--shadow-1)' } : null }, h('div.hstack', null, icon(g.ic), h('div.grow', null, h('b', null, g.zh), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, g.d)), on ? h('span.tag.accent', null, '進行中') : h('button.btn.s', { on: { click: () => { S().goal = g.id; St.touch('goal'); toast(`人生目標：${g.zh}`, 'flag'); p.refresh(p, el); } } }, '設為目標')), h('div.hstack', { style: { marginTop: '10px' } }, h('div.grow', null, bar(100 * v / g.n, 'var(--teal)')), h('span.num', null, `${v}/${g.n}`)), v >= g.n ? h('div.tag.teal', { style: { marginTop: '8px' } }, icon('check', 's'), '已達成') : null);
      }));
    },
  });

  // =====================================================================
  // 探索 explore / world map
  // =====================================================================
  const PLACES = [
    { id: 'isle', zh: '晴日島', d: '你的家。果樹、雜貨攤和你的 OC 都在這裡。', x: 0.5, y: 0.62, open: true, finds: ['apple', 'orange', 'peach', 'flower', 'shell'] },
    { id: 'forest', zh: '苔光森林', d: '安靜的森林，可以採到森林蘑菇。夜晚有螢火蟲。', x: 0.26, y: 0.28, open: true, finds: ['mushroom'] },
    { id: 'beach', zh: '星砂海灘', d: '傳說中星砂會發光的海灘。', x: 0.8, y: 0.3, open: false },
    { id: 'hill', zh: '風車丘', d: '風很大的山丘，有一座老風車。', x: 0.18, y: 0.78, open: false },
    { id: 'market', zh: '雲朵市集', d: '每週一次的市集。', x: 0.78, y: 0.82, open: false },
  ];
  define('explore', '探索', {
    build(p, el) {
      p.map = h('div.map-wrap'); const cv = portraitCanvas(720); cv.height = 720; p.map.append(cv); drawMap(cv);
      p.pins = PLACES.map((pl) => { const pin = h('button.map-pin' + (pl.open ? '' : '.locked'), { style: { left: pl.x * 100 + '%', top: pl.y * 100 + '%' }, 'aria-label': pl.zh, on: { click: () => { p.sel = pl.id; p.refresh(p); } } }, h('div.pin', null, icon(pl.open ? (pl.id === 'isle' ? 'home' : 'leaf') : 'lock', 's')), h('label', null, pl.zh)); p.map.append(pin); return pin; });
      p.info = h('div', { style: { marginTop: '12px' } });
      el.append(p.map, p.info);
    },
    refresh(p) {
      const cur = OC.World.area ? OC.World.area.id : 'isle'; p.sel = p.sel || cur;
      PLACES.forEach((pl, i) => p.pins[i].classList.toggle('on', pl.id === p.sel));
      const pl = PLACES.find((x) => x.id === p.sel), here = pl.id === cur;
      const finds = pl.finds ? h('div.hstack', { style: { flexWrap: 'wrap', marginTop: '8px' } }, ...pl.finds.map((f) => { const im = Sty.itemImg(f); im.style.width = im.style.height = '28px'; return h('span.tag', null, S().seen[f] ? im : icon('lock', 's'), S().seen[f] ? Sty.ITEMS[f].zh : '？？？'); })) : null;
      p.info.replaceChildren(card(h('div.hstack', null, h('h2', { style: { margin: 0, flex: 1, fontSize: 'var(--fs-xl)' } }, pl.zh), here ? h('span.tag.teal', null, '你在這裡') : pl.open ? null : h('span.tag', null, icon('lock', 's'), '未開放')), h('p.muted', null, pl.d), finds,
        pl.open && !here ? h('button.btn.primary.block', { style: { marginTop: '12px' }, on: { click: () => app().travel(pl.id) } }, icon('compass', 's'), '出發') : null,
        !pl.open ? h('div.lock-note', { style: { marginTop: '10px' } }, icon('info', 's'), '這個地點會在之後的版本開放。') : null));
    },
  });
  function drawMap(cv) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height;
    x.fillStyle = '#5BC0EB'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; const r = OC.rng(4); for (let i = 0; i < 40; i++) { const px = r() * W, py = r() * H; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 14, py - 6, px + 28, py); x.stroke(); }
    const land = (cx, cy, rx, ry, col, seed) => { x.save(); x.fillStyle = 'rgba(255,255,255,.5)'; OC.V.blob(x, cx, cy + 6, rx + 14, ry + 14, seed); x.fill(); x.fillStyle = '#F7E3A8'; OC.V.blob(x, cx, cy, rx + 8, ry + 8, seed); x.fill(); x.fillStyle = col; OC.V.blob(x, cx, cy, rx, ry, seed); x.fill(); x.restore(); };
    land(W * 0.5, H * 0.62, 150, 120, '#86CF5E', 3); land(W * 0.26, H * 0.28, 110, 90, '#3F9A50', 5); land(W * 0.8, H * 0.3, 80, 60, '#F7E3A8', 2); land(W * 0.18, H * 0.78, 70, 60, '#9ACF6E', 7); land(W * 0.78, H * 0.82, 80, 56, '#B9DA7A', 9);
    x.setLineDash([10, 12]); x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 4; x.beginPath(); x.moveTo(W * 0.5, H * 0.62 + 120); x.quadraticCurveTo(W * 0.1, H * 0.6, W * 0.26, H * 0.28 + 60); x.stroke(); x.setLineDash([]);
  }

  // =====================================================================
  // 更多 more
  // =====================================================================
  define('more', '更多', {
    build(p, el) { p.list = h('div'); el.append(p.list); },
    refresh(p) {
      const claimable = Gm.todayQuests().filter((q) => q.prog >= q.n && !q.claimed).length;
      const achN = Object.keys(S().ach).length, seenN = Object.keys(S().seen).filter((k) => Gm.COLLECTIBLE().includes(k)).length;
      p.list.replaceChildren(
        h('div.list', null,
          row('flag', '今日任務', `${Gm.todayQuests().filter((q) => q.claimed).length}/4 已領取`, h('div.hstack', null, claimable ? h('span.badge', null, claimable) : null, icon('chev', 'chev')), () => open('quests')),
          row('trophy', '成就', `${achN}/${Gm.ACH.length}`, null, () => open('ach')),
          row('book', '圖鑑', `${seenN}/${Gm.COLLECTIBLE().length}`, null, () => open('collection')),
          row('target', '人生目標', (Gm.GOALS.find((g) => g.id === S().goal) || { zh: '尚未選擇' }).zh, null, () => open('goals'))),
        h('div.list', { style: { marginTop: '12px' } },
          row('bag', '背包', `${Object.values(S().inv).reduce((a, b) => a + b, 0)} 件物品`, null, () => open('bag')),
          row('cart', '商店', '也可以在島上的晴日雜貨攤開啟', null, () => open('shop'))),
        h('div.list', { style: { marginTop: '12px' } },
          row('gear', '設定', '主題、效能、時間天氣、操作、資料', null, () => open('settings')),
          row('info', '關於', null, null, () => open('about'))));
    },
  });

  define('quests', '今日任務', {
    sub: true,
    refresh(p, el) {
      const list = Gm.todayQuests();
      el.replaceChildren(h('p.muted', null, '每天換一組任務（依照真實日期）。完成後領取星幣。'), ...list.map((q) => { const done = q.prog >= q.n; return card(h('div.hstack', null, icon(q.ic), h('div.grow', null, h('b', null, q.zh), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, q.d)), q.claimed ? h('span.tag.teal', null, icon('check', 's'), '已領取') : done ? h('button.btn.s.sun', { on: { click: () => { const r = Gm.claim(q.id); if (r) { toast(`獲得 ${r} 星幣`, 'coin'); haptic(); } p.refresh(p, el); } } }, icon('coin', 's'), `領取 ${q.reward}`) : h('span.tag', null, icon('coin', 's'), q.reward)), h('div.hstack', { style: { marginTop: '10px' } }, h('div.grow', null, bar(100 * q.prog / q.n, 'var(--sun)')), h('span.num', null, `${q.prog}/${q.n}`))); }));
    },
  });
  define('ach', '成就', {
    sub: true,
    refresh(p, el) { el.replaceChildren(h('div.grid.c2', null, ...Gm.ACH.map((a) => { const got = S().ach[a.id], v = Math.min(a.v(), a.n); return h('div.card', { style: { padding: '12px', opacity: got ? 1 : 0.75 } }, h('div.hstack', null, h('span', { style: { color: got ? 'var(--sun)' : 'var(--locked)' } }, icon('trophy')), h('b.grow', null, a.zh)), h('div.muted', { style: { fontSize: 'var(--fs-xs)', margin: '4px 0 8px' } }, a.d), got ? h('span.tag.sun', null, new Date(got).toLocaleDateString('zh-TW')) : h('div', null, bar(100 * v / a.n, 'var(--sun)'), h('div.faint.num', { style: { fontSize: 'var(--fs-xs)', marginTop: '4px' } }, `${v}/${a.n}`))); }))); },
  });
  define('collection', '圖鑑', {
    sub: true,
    refresh(p, el) {
      const ids = Gm.COLLECTIBLE();
      el.replaceChildren(h('p.muted', null, `已收集 ${ids.filter((k) => S().seen[k]).length}/${ids.length}`), h('div.grid.c3', null, ...ids.map((k) => { const seen = S().seen[k], it = Sty.ITEMS[k]; const t = h('button.tile' + (seen ? '' : '.locked'), { on: { click: () => seen ? sheet(it.zh, (b) => b.append(h('div.center', null, Sty.itemImg(k)), h('p', null, it.d), h('div.muted', null, `${Sty.KIND_ZH[it.kind]}・第一次取得：${new Date(seen).toLocaleDateString('zh-TW')}`))) : toast('還沒發現這個物品', 'lock') } }, seen ? Sty.itemImg(k) : icon('lock', 'l'), seen ? it.zh : '？？？'); const im = t.querySelector('img'); if (im) { im.style.width = '60%'; } return t; })));
    },
  });

  // =====================================================================
  // 商店 shop (buy / sell with real coins)
  // =====================================================================
  define('shop', '晴日雜貨攤', {
    sub: true,
    build(p, el) { p.coins = h('span.num'); p.mode = 'buy'; p.tabs = seg([['buy', '購買'], ['sell', '賣出']], 'buy', (v) => { p.mode = v; p.refresh(p, el); }); p.body = h('div', { style: { marginTop: '12px' } }); el.append(card(h('div.hstack', null, icon('coin'), h('span.grow', null, '持有星幣'), p.coins)), h('div', { style: { marginTop: '12px' } }, p.tabs), p.body); },
    refresh(p) {
      p.coins.textContent = S().coins.toLocaleString();
      if (p.mode === 'buy') {
        p.body.replaceChildren(h('div.list', null, ...Sty.SHOP.map((id) => { const it = Sty.ITEMS[id], owned = St.count(id), im = Sty.itemImg(id); im.style.width = im.style.height = '40px'; const sold = it.kind === 'clothing' && owned; return row(im, it.zh, `${Sty.KIND_ZH[it.kind]}・${it.d}`, sold ? h('span.tag.teal', null, '已擁有') : h('button.btn.s' + (S().coins >= it.price ? '.sun' : ''), { 'aria-label': `購買 ${it.zh}`, on: { click: () => { const r = Gm.buy(id); toast(r.ok ? `買了 ${it.zh}` : r.why, r.ok ? 'cart' : 'info'); if (r.ok) haptic(); p.refresh(p); } } }, icon('coin', 's'), it.price)); })));
      } else {
        const inv = Object.keys(S().inv).filter((id) => Sty.ITEMS[id] && Sty.ITEMS[id].sell);
        p.body.replaceChildren(inv.length ? h('div.list', null, ...inv.map((id) => { const it = Sty.ITEMS[id], im = Sty.itemImg(id); im.style.width = im.style.height = '40px'; return row(im, `${it.zh} ×${St.count(id)}`, `每個 ${it.sell} 星幣`, h('button.btn.s', { on: { click: () => { const g = Gm.sell(id); if (g) { toast(`賣出 ${it.zh}，獲得 ${g} 星幣`, 'coin'); haptic(); } p.refresh(p); } } }, '賣 1 個')); })) : card(h('div.empty', null, '背包裡沒有可以賣的東西。')));
      }
    },
  });

  // =====================================================================
  // 背包 bag (full)
  // =====================================================================
  define('bag', '背包', {
    sub: true,
    refresh(p, el) {
      const groups = {}; for (const id of Object.keys(S().inv)) { const k = Sty.ITEMS[id] ? Sty.ITEMS[id].kind : 'material'; (groups[k] = groups[k] || []).push(id); }
      const kinds = ['food', 'gift', 'material', 'furniture', 'clothing'].filter((k) => groups[k]);
      if (!kinds.length) { el.replaceChildren(card(h('div.empty', null, '背包是空的。搖搖果樹、到海邊撿貝殼吧！'))); return; }
      el.replaceChildren(...kinds.flatMap((k) => [title(Sty.KIND_ZH[k]), h('div.grid.c4', null, ...groups[k].map((id) => { const t = h('button.tile', { on: { click: () => itemSheet(id, () => p.refresh(p, el)) } }, Sty.itemImg(id), Sty.ITEMS[id].zh, h('span.count', null, '×' + St.count(id))); t.querySelector('img').style.width = '58%'; return t; }))]));
    },
  });
  function itemSheet(id, after) {
    const it = Sty.ITEMS[id];
    sheet(it.zh, (b, api) => {
      const acts = [];
      if (it.use) acts.push(h('button.btn.primary.block', { on: { click: () => { const fx = Gm.eat(id); if (fx) { toast(`${OC.Chars.name(OC.Chars.active())} 吃了${it.zh}`, 'apple'); app().reactEat(); } api.close(); after && after(); } } }, icon('apple', 's'), it.kind === 'food' ? '吃' : '使用'));
      if (it.kind === 'furniture') acts.push(h('button.btn.primary.block', { on: { click: () => { api.close(); OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); app().tab('island'); app().startPlacement({ id }); } } }, icon('sofa', 's'), '放到島上'));
      if (it.kind === 'clothing') acts.push(h('button.btn.primary.block', { on: { click: () => { api.close(); open('wardrobe'); } } }, icon('shirt', 's'), '到衣櫥穿上'));
      b.append(h('div.center', null, Sty.itemImg(id)), h('p', null, it.d), h('div.muted', { style: { fontSize: 'var(--fs-s)', marginBottom: '12px' } }, `持有 ${St.count(id)} 個${it.sell ? `・可賣 ${it.sell} 星幣` : ''}${it.use ? '・' + Object.entries(it.use).map(([k, v]) => `${Gm.NEEDS.find((n) => n.id === k).zh}+${v}`).join(' ') : ''}`), h('div.vstack', null, ...acts), it.kind === 'gift' || it.kind === 'food' ? h('div.lock-note', { style: { marginTop: '10px' } }, icon('info', 's'), '想送給居民：在島上打開快速背包，把物品拖到居民身上。') : null);
    });
  }

  // =====================================================================
  // 設定 settings
  // =====================================================================
  define('settings', '設定', {
    sub: true,
    build(p, el) {
      const s = () => S().settings, set = (k, v) => { s()[k] = v; St.touch('settings', { k, v }); };
      p.theme = seg([['light', '淺色', 'sun'], ['dark', '深色', 'moon'], ['system', '跟隨系統', 'phone']], s().theme, (v) => app().setTheme(v));
      p.perf = seg([['high', '高'], ['balanced', '平衡'], ['saver', '省電'], ['custom', '自訂']], s().perf, (v) => { set('perf', v); app().applyPerf(); p.refresh(p); });
      p.custom = h('div.vstack', { style: { marginTop: '10px' } });
      const c = () => s().custom, setC = (k, v) => { c()[k] = v; St.touch('settings'); app().applyPerf(); };
      p.custom.append(
        h('div', null, h('div.muted', null, '幀率上限'), seg([['30', '30 fps'], ['60', '60 fps']], String(c().fps), (v) => setC('fps', +v))),
        h('div', null, h('div.muted', null, '陰影'), seg([['off', '關'], ['low', '低'], ['high', '高']], c().shadows, (v) => setC('shadows', v))),
        h('div.hstack', null, h('span.grow', null, '天氣與環境特效（雨、螢火蟲、雲影）'), toggle(c().fx, (v) => setC('fx', v))),
        h('div.hstack', null, h('span.grow', null, '隨風擺動的草'), toggle(c().grass, (v) => setC('grass', v))),
        h('div', null, h('div.muted', null, '畫面解析度'), h('input', { type: 'range', min: 0.75, max: 2, step: 0.25, value: c().scale, 'aria-label': '畫面解析度', on: { change: (e) => setC('scale', +e.target.value) } })));
      p.ctrl = seg([['tap', '點擊移動'], ['joy', '虛擬搖桿']], s().control, (v) => { set('control', v); app().applyControl(); });
      const fileIn = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, on: { change: async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const txt = await f.text(); if (await confirm('匯入存檔', '目前的進度會被覆蓋，確定嗎？', '匯入', true)) { St.importJSON(txt); location.reload(); } } catch (err) { toast('匯入失敗：' + err.message, 'info'); } } } });
      el.append(
        title('外觀主題'), card(p.theme, h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '8px' } }, '只影響介面；島上的白天黑夜依照遊戲時間。')),
        
        title('效能'), card(p.perf, h('div.muted', { style: { fontSize: 'var(--fs-s)', marginTop: '8px' }, 'data-perf-desc': '' }), p.custom, h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '角色畫質', h('div.muted', { style: { fontSize: 'var(--fs-xs)' } }, '「最高」＝角色永遠用螢幕原本的解析度畫，比較耗電')), (p.charQ = seg([['auto', '自動'], ['max', '最高']], s().charQ || 'auto', (v) => { set('charQ', v); app().applyPerf(); }))), h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '顯示 FPS'), toggle(s().showFps, (v) => { set('showFps', v); app().applyPerf(); }))),
        title('世界'), card(h('button.btn.block', { on: { click: () => app().timePanel() } }, icon('clock', 's'), '時間與天氣…'), h('div.faint', { 'data-time-desc': '', style: { fontSize: 'var(--fs-xs)', marginTop: '6px' } }),
          h('div.muted', { style: { marginTop: '12px' } }, '日曆'), (p.calSeg = seg([['game', '遊戲曆'], ['real', '實時曆']], OC.Clock.calMode(), (v) => { set('calendar', v); toast(v === 'game' ? '遊戲曆：一年四季、每季 28 天' : '實時曆：照手機的日期（12 個月）', 'clock'); p.refresh(p); })),
          h('div.faint', { 'data-cal-desc': '', style: { fontSize: 'var(--fs-xs)', marginTop: '6px' } }),
          h('div.muted', { style: { marginTop: '12px' } }, '季節'), seg([['auto', '依日期'], ['spring', '春'], ['summer', '夏'], ['autumn', '秋'], ['winter', '冬']], OC.Clock.SEASONS.includes(s().season) ? s().season : 'auto', (v) => { set('season', v); toast(`季節：${v === 'auto' ? '依日期（' + OC.Clock.SEASON_ZH[OC.Clock.season()] + '）' : OC.Clock.SEASON_ZH[v]}。下次開啟遊戲時套用到整個世界的顏色`, 'leaf'); }),
          h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '6px' } }, '樹葉與草地的顏色、飄落的花瓣／落葉／雪。為了不在遊戲中重新編譯著色器，改了之後下次開啟才會換。'),
          (p.seasonNow = h('button.btn.s', { style: { marginTop: '8px' }, hidden: true, on: { click: () => { OC.Store.persist(); location.reload(); } } }, icon('leaf', 's'), '現在換季（重新載入遊戲）'))),
        title('生活'), h('div.list', null, row('users', '生活設定', '自主程度、不做的活動、戀愛、成長建議', null, () => open('lifeset')), row('chat', '對話與事件資料', '自訂台詞、匯入／匯出', null, () => open('dialogue')), S().settings.dev ? row('target', '開發者診斷', null, null, () => open('lifedev')) : null),
        title('操作'), card(h('div.muted', null, '移動方式'), p.ctrl, h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '觸覺回饋'), toggle(s().haptics, (v) => set('haptics', v))), h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '減少動態效果'), toggle(s().reduceMotion, (v) => { set('reduceMotion', v); app().applyMotion(); })),
          h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '買東西、撿東西要走過去', h('div.faint', { style: { fontSize: 'var(--fs-xs)' } }, '關閉（預設）：逛商店、撿東西、摘花、採集直接完成，角色不用先走到那裡')), toggle(!!s().walkTo, (v) => set('walkTo', v))),
          h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '點一下就做'), toggle(!!s().quickTap, (v) => set('quickTap', v))), h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '2px' } }, '關閉（預設）：點東西只會選取它，旁邊出現動作卡，按了才做——不會因為誤觸就坐下、採花或換地點。開啟：點一下就直接走過去做。')),
        // 聲音：Phase 6 adds the real sound settings at the end of this page (js/ui/p6pages.js)
        title('資料'), fileIn, h('div.list', null,
          row('film', '重新觀看開場與教學', '開場動畫，然後由你的 OC 再教一次', null, async () => { close('settings'); app().tab('island'); await OC.Intro.opening({}); OC.Tutorial.start({ restart: true, force: true }); }),
          row('download', '匯出存檔', '存成 JSON 檔備份', null, () => app().exportSave()),
          row('upload', '匯入存檔', '從 JSON 檔還原', null, () => fileIn.click()),
          row('refresh', '重新開始', '刪除進度（保留設定）', null, async () => { if (await confirm('重新開始', '所有角色、物品與進度都會刪除，無法復原。', '刪除並重新開始', true)) { St.reset(); location.reload(); } })),
        h('div.faint', { style: { fontSize: 'var(--fs-xs)', margin: '10px 4px' }, 'data-saved': '' }, ''));
      /* 15.1: a board of the sections at the top (the device-settings principle): one tap jumps to the section */
      const STK = { '外觀主題': 'sun', '效能': 'sparkle', '世界': 'cloud', '生活': 'users', '操作': 'hand', '聲音': 'music', '資料': 'book' };
      requestAnimationFrame(() => { const heads = [...el.querySelectorAll('.section-title')].filter((t) => STK[t.firstChild && t.firstChild.textContent]);
        el.prepend(h('div.set-board', null, ...heads.map((t) => { const zh = t.firstChild.textContent; return h('button.set-tile', { on: { click: () => { haptic('tick'); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); } } }, OC.UI.sticker(STK[zh]), h('small', null, zh === '外觀主題' ? '外觀' : zh)); }))); });
    },
    refresh(p) {
      const s = S().settings; p.theme.set(s.theme); p.perf.set(s.perf);
      { const cl = OC.Clock.cal(), d = p.el.querySelector('[data-cal-desc]'); if (p.calSeg) p.calSeg.set(OC.Clock.calMode());
        if (d) d.textContent = cl.mode === 'game' ? `今天是第 ${cl.year} 年 ${cl.text}。一年＝春夏秋冬各 28 天；一天＝遊戲時鐘的一天（「真實時間」模式下就是現實的一天，「遊戲循環」依倍速）。生日可以寫「春 12」，寫成 3/14 會換算到對應的季節。` : `今天是 ${cl.text}。季節、節日、生日都照手機的日期——角色的年齡也會照現實的時間過，所以長得很慢。`;
        if (p.seasonNow) p.seasonNow.hidden = !(OC.World && OC.World.season && OC.Clock.season() !== OC.World.season); } if (p.charQ) p.charQ.set(s.charQ || 'auto');
      { const d = p.el.querySelector('[data-time-desc]'); if (d) d.textContent = `目前：${{ real: '跟隨手機時間', cycle: `遊戲循環 ×${s.timeSpeed || 1}${s.timePaused ? '（暫停）' : ''}`, fixed: `固定在 ${String(Math.floor(s.fixedHour || 12)).padStart(2, '0')}:${String(Math.round(((s.fixedHour || 12) % 1) * 60)).padStart(2, '0')}` }[s.time] || '固定時段'}・天氣 ${{ auto: '自動', clear: '晴', cloudy: '多雲', rain: '雨', fog: '霧' }[s.weather] || s.weather}`; }
      p.ctrl.set(s.control);
      p.custom.hidden = s.perf !== 'custom';
      const q = app().perfOf(s.perf);
      p.el.querySelector('[data-perf-desc]').textContent = `${q.fps} fps・陰影${q.shadows ? (q.shadows >= 2048 ? '高' : '低') : '關'}・特效${q.fx ? '開' : '關'}・草${q.grass ? '開' : '關'}・解析度 ×${q.ratio}`;
      p.el.querySelector('[data-saved]').textContent = '存檔位置：本機（localStorage' + (St.NATIVE ? ' + App 內部儲存備份' : '') + '）';
    },
  });
  define('about', '關於', {
    sub: true,
    refresh(p, el) {
      const v = St.NATIVE ? St.NATIVE.appVersion() : 'Web 預覽';
      el.replaceChildren(h('div.center', { style: { margin: '20px 0' } }, h('div.logo', null, 'OC ', h('b', null, 'Shimeji')), h('div.muted', null, '原創角色生活模擬＋桌寵')), h('div.list', null, row('info', '版本', v + (S().settings.dev ? '・開發者模式' : ''), null, () => { p.taps = (p.taps || 0) + 1; if (p.taps >= 5) { p.taps = 0; S().settings.dev = !S().settings.dev; St.touch('settings'); toast(S().settings.dev ? '已開啟開發者診斷（設定 → 生活）' : '已關閉開發者模式', 'info'); p.refresh(p, el); } }), row('layers', '畫面', '3D 固定視角世界（three.js r158）＋ 2D 角色')), title('授權'), card(h('div.muted', { style: { fontSize: 'var(--fs-s)', lineHeight: 1.7 } }, 'three.js — MIT License', h('br'), 'jf open 粉圓（Huninn）— SIL Open Font License 1.1', h('br'), 'Nunito — SIL Open Font License 1.1', h('br'), '所有角色、場景與介面美術皆為原創。')), title('隱私'), card(h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '遊戲完全離線運作，不連網、不蒐集任何資料；存檔只保存在這台裝置上。')));
    },
  });

  OC.Pages = { pages, define, open, close, ensure, refreshOpen, itemSheet, PLACES };
})();
