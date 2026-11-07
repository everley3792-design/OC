/* OC Shimeji — Phase 6 pages.
 *   more (日常)    one hub: quests (today / week / challenges / hidden), character requests, achievements, collection,
 *                 then the other entries (bag, shop, products, ledger, life goal, settings, about)
 *   ach           achievements with categories, progress, hidden hints, claim (OC.Achieve)
 *   collection    unified discovery book: items + places + activities + special events; states 未發現 / 看過 / 持有 / 曾經持有
 *   profile tabs  成長 (title, aspiration, skills & unlocks) · 日誌 (memory cards, filters, favourites, shared memories, replay)
 *   settings      + 聲音 (master / UI / sfx / ambient / event, mute)
 *   interact      the OC's pending request appears at the top of its menu
 *   lifedev       + 遊玩系統 diagnostics (progress log, quests, achievements, aspirations, stage, sound)
 * Pages rebuild only when what they show changes (signatures), so buttons never get replaced under a finger.
 */
(function () {
  'use strict';
  const { h, icon, toast, sheet, seg, toggle, row, haptic } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, Pg = () => OC.Pages, PD = () => OC.PlayData, M = () => OC.Mind, I = (id) => OC.Style.ITEMS[id];
  const T = (t, s2) => h('div.section-title', null, t, s2 ? h('small', null, s2) : null);
  const card = (...k) => h('div.card', null, ...k);
  const small = (t) => h('div.faint', { style: { fontSize: 'var(--fs-xs)' } }, t);
  const same = (p, k) => { if (p._sig === k) return true; p._sig = k; return false; };
  const name = (c) => OC.Chars.name(c);
  const av = (c, px = 40) => { const cv = h('canvas', { width: px * 2, height: px * 2 }); cv.style.cssText = `width:${px}px;height:${px}px;flex:none;border-radius:12px;background:var(--surface-2)`; OC.CharRender.portrait(cv, c, { pose: { mouth: 'smile' } }); return cv; };
  const img = (id, px = 32) => { const im = OC.Style.itemImg(id); im.style.width = im.style.height = px + 'px'; return im; };
  const bar = (v, n, col = 'var(--accent)') => h('div.bar', null, h('i', { style: { width: Math.round((Math.min(v, n) / Math.max(1, n)) * 100) + '%', '--c': col } }));
  const rewardText = (r) => [r.coins ? `${r.coins} 星幣` : null, ...Object.entries(r.items || {}).map(([id, n]) => `${(I(id) || { zh: id }).zh}×${n}`), r.title ? `稱號「${PD().TITLES[r.title]}」` : null].filter(Boolean).join('・');

  function claimFx(r, label) {
    if (!r.ok) { toast(r.why, 'info'); OC.Sound && OC.Sound.play('error'); return; }
    haptic(); OC.Stage.card({ kind: 'quest', ic: 'coin', title: `領取：${label}`, sub: rewardText(r.reward || {}) + (r.dup ? '（之前已入帳）' : ''), sound: 'coin' });
  }

  // ======================= 日常 hub =======================
  function questRow(x, p) {
    const done = x.done && !x.claimed;
    return h('div.q-row' + (x.claimed ? '.claimed' : done ? '.ready' : ''), null,
      h('div.q-ic', null, icon(x.ic || 'flag', 's')),
      h('div.grow', null, h('div.hstack', { style: { gap: '6px' } }, h('b.ellipsis', null, x.zh), x.type === 'place' && x.place ? h('span.tag', null, OC.Places.get(x.place).zh) : null, x.type === 'event' ? h('span.tag.sun', null, '限時') : null, x.type === 'hidden' ? h('span.tag.accent', null, '隱藏') : null),
        h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, x.d || ''), h('div.hstack', { style: { gap: '8px', marginTop: '4px' } }, h('div.grow', null, bar(x.prog, x.n, x.claimed ? 'var(--locked)' : 'var(--teal)')), h('span.num.faint', { style: { fontSize: 'var(--fs-xs)' } }, `${x.prog}/${x.n}`)),
        small('獎勵：' + rewardText(x.reward))),
      x.claimed ? h('span.tag', null, icon('check', 's'), '已領') : done ? h('button.btn.s.primary', { on: { click: () => { claimFx(OC.Quests.claim(x.key), x.zh); p.refresh(p); } } }, '領取') : null);
  }
  function questsTab(p) {
    const today = OC.Quests.list().filter((x) => ['daily', 'place', 'event', 'hidden'].includes(x.type)), week = OC.Quests.list('weekly'), ch = OC.Quests.challenges(), hid = OC.Quests.hiddenInfo();
    return h('div', null,
      T('今天', `${today.filter((x) => x.done).length}/${today.length} 完成・沒做完也沒關係`), h('div.vstack', { style: { gap: '8px' } }, ...today.map((x) => questRow(x, p))),
      T('本週', OC.Quests.weekKey()), h('div.vstack', { style: { gap: '8px' } }, ...week.map((x) => questRow(x, p))),
      T('長期挑戰'), h('div.vstack', { style: { gap: '8px' } }, ...ch.map((c) => c.finished ? h('div.q-row.claimed', null, h('div.q-ic', null, icon(c.ic, 's')), h('div.grow', null, h('b', null, c.zh.replace(/ [IV]+$/, '')), small('全部完成！')), h('span.tag', null, icon('check', 's'))) : questRow({ key: c.key, zh: c.zh, d: `累計 ${c.n}（第 ${c.tier + 1}/${c.tiers} 階）`, ic: c.ic, n: c.n, prog: c.prog, done: c.done, claimed: false, reward: c.reward, type: 'challenge' }, p))),
      T('隱藏任務', `${hid.found}/${hid.total} 已發現`), card(hid.hints.length ? h('div.vstack', { style: { gap: '4px' } }, ...hid.hints.slice(0, 3).map((t) => h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '？ ' + t))) : small('全部都找到了！')),
      small('任務只會出現你已經能去的地方、能取得的東西。每日任務隔天會換；完成但還沒領的會一直保留。'));
  }
  function reqTab(p) {
    const L = OC.Requests.list(), open = L.filter((r) => r.state === 'offer' || r.state === 'active'), done = L.filter((r) => r.state === 'done').slice(0, 8);
    return h('div', null,
      T('OC 的請求', open.length ? `${open.length} 件` : ''), open.length ? h('div.vstack', { style: { gap: '8px' } }, ...open.map((r) => { const c = OC.Chars.get(r.oc); if (!c) return null; return h('div.q-row' + (r.state === 'offer' ? '.ready' : ''), null, av(c), h('div.grow', null, h('b', null, `${name(c)}：${r.text}`), small(r.state === 'offer' ? '有話想對你說（點牠頭上的泡泡，或在這裡聽聽看）' : OC.Requests.howText(r))), h('button.btn.s' + (r.state === 'offer' ? '.primary' : ''), { on: { click: () => OC.Requests.openSheet(r.id) } }, r.state === 'offer' ? '聽聽看' : '查看')); })) : card(h('div.empty', null, '現在沒有人有事情要拜託你。和大家待在一起，牠們有想法時會頭上冒出泡泡。')),
      done.length ? h('div', null, T('完成過的請求', `共 ${S().play.req.n || done.length} 件`), h('div.list', null, ...done.map((r) => { const c = OC.Chars.get(r.oc); return row(c ? av(c, 32) : null, c ? `${name(c)}：${r.text}` : r.text, '完成'); }))) : null);
  }
  function achRow(x, p) {
    return h('div.q-row' + (x.claimed ? '.claimed' : x.got ? '.ready' : x.hidden ? '.hidden' : ''), null,
      h('div.q-ic' + (x.got ? '.gold' : ''), null, icon(x.got ? 'trophy' : x.hidden ? 'lock' : 'trophy', 's')),
      h('div.grow', null, h('b', null, x.hidden ? '？？？' : x.zh), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, x.hidden ? x.hint || '隱藏成就' : x.d),
        !x.hidden && !x.got ? h('div.hstack', { style: { gap: '8px', marginTop: '4px' } }, h('div.grow', null, bar(x.v, x.n, 'var(--sun)')), h('span.num.faint', { style: { fontSize: 'var(--fs-xs)' } }, `${x.v}/${x.n}`)) : null,
        x.got ? small(`${new Date(x.got).toLocaleDateString('zh-TW')} 達成・獎勵：${rewardText(x.reward)}`) : !x.hidden ? small('獎勵：' + rewardText(x.reward)) : null),
      x.claimed ? h('span.tag', null, icon('check', 's'), '已領') : x.got ? h('button.btn.s.primary', { on: { click: () => { claimFx(OC.Achieve.claim(x.id), x.zh); p.refresh(p); } } }, '領取') : null);
  }
  function achTab(p) {
    const L = OC.Achieve.list(), cat = p.achCat || 'all', got = L.filter((x) => x.got).length;
    const chips = h('div.chips.scroll', null, ...[['all', '全部']].concat(OC.Achieve.CATS).map(([k, zh]) => h('button.chip-btn' + (cat === k ? '.on' : ''), { on: { click: () => { p.achCat = k; p.refresh(p); } } }, `${zh} ${k === 'all' ? got : L.filter((x) => x.cat === k && x.got).length}/${k === 'all' ? L.length : L.filter((x) => x.cat === k).length}`)));
    const list = L.filter((x) => cat === 'all' || x.cat === cat).sort((a, b) => (b.got && !b.claimed) - (a.got && !a.claimed) || (!!a.claimed - !!b.claimed) || (b.v / b.n - a.v / a.n));
    return h('div', null, card(h('div.hstack', null, h('span.grow', null, '成就'), h('b.num', null, `${got}/${L.length}`)), bar(got, L.length, 'var(--sun)')), chips, h('div.vstack', { style: { gap: '8px' } }, ...list.map((x) => achRow(x, p))));
  }
  function collTab() {
    const st = collStats();
    return h('div', null, card(h('div.hstack', null, h('span.grow', null, '圖鑑'), h('b.num', null, `${st.found}/${st.total}`)), bar(st.found, st.total, 'var(--teal)'),
      h('div.chips', { style: { marginTop: '8px' } }, ...st.cats.map((c) => h('span.tag', null, `${c.zh} ${c.found}/${c.total}`))),
      h('button.btn.primary.block', { style: { marginTop: '12px' }, on: { click: () => Pg().open('collection') } }, icon('book', 's'), '打開圖鑑')));
  }
  Pg().define('more', '日常', {
    build(p, el) {
      p.tab = 'quests';
      p.head = h('div'); p.tabs = seg([['quests', '任務'], ['req', '請求'], ['ach', '成就'], ['coll', '圖鑑']], 'quests', (v) => { p.tab = v; p._sig = ''; p.refresh(p); });
      p.body = h('div'); p.other = h('div');
      el.append(p.head, h('div', { style: { margin: '10px 0' } }, p.tabs), p.body, T('其他'), p.other);
    },
    refresh(p) {
      const qc = OC.Quests.claimable(), ac = OC.Achieve.claimable(), ro = OC.Requests.open().length;
      const sig = [p.tab, p.achCat, JSON.stringify(S().play.q.list.map((x) => [x.key, x.prog.n, x.done, x.claimed])), JSON.stringify(S().play.q.chal), Object.keys(S().ach).length, JSON.stringify(S().play.ach), OC.Requests.list().map((r) => r.id + r.state).join(), S().coins, Object.keys(S().seen).length].join('|');
      if (same(p, sig)) return;
      p.tabs.querySelectorAll('button').forEach((b) => { const n = { quests: qc, req: ro, ach: ac }[b.dataset.v]; b.querySelector('.badge') && b.querySelector('.badge').remove(); if (n) b.append(h('span.badge', null, n)); });
      p.head.replaceChildren(h('div.hub-head', null, h('div.grow', null, h('b', null, new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })), small('今天想做什麼都可以 — 任務只是靈感。')), h('div.hub-coins', null, icon('coin', 's'), h('b.num', null, S().coins.toLocaleString()))));
      p.body.replaceChildren(p.tab === 'quests' ? questsTab(p) : p.tab === 'req' ? reqTab(p) : p.tab === 'ach' ? achTab(p) : collTab());
      const Gm = OC.Game;
      p.other.replaceChildren(h('div.list', null,
        row('bag', '背包', `${Object.values(S().inv).reduce((a, b) => a + b, 0)} 件物品`, null, () => Pg().open('bag')),
        row('cart', '晴日雜貨攤', '其他商店在晴日商店街', null, () => Pg().open('shop', { shop: 'general' })),
        row('cart', '工坊商品', `${Object.keys((S().custom || {}).items || {}).length} 件`, null, () => Pg().open('products')),
        row('coin', '交易紀錄', `${S().coins.toLocaleString()} 星幣`, null, () => Pg().open('ledger')),
        row('target', '小島目標', (Gm.GOALS.find((g) => g.id === S().goal) || { zh: '尚未選擇' }).zh, null, () => Pg().open('goals')),
        row('gear', '設定', '主題、效能、聲音、時間天氣、操作、資料', null, () => Pg().open('settings')),
        row('info', '關於', null, null, () => Pg().open('about'))));
    },
  });
  Pg().define('ach', '成就', { sub: true, build(p, el) { p.box = h('div'); el.append(p.box); }, refresh(p) { if (same(p, [p.achCat, Object.keys(S().ach).length, JSON.stringify(S().play.ach)].join('|'))) return; p.box.replaceChildren(achTab(p)); } });
  Pg().define('quests', '今日任務', { sub: true, build(p, el) { p.box = h('div'); el.append(p.box); }, refresh(p) { if (same(p, JSON.stringify(S().play.q))) return; p.box.replaceChildren(questsTab(p)); } });

  // ======================= collection (unified) =======================
  const itemCats = [['fish', '魚類', (it) => it.kind === 'fish'], ['bug', '小生物', (it) => it.kind === 'bug'], ['sea', '海洋收藏', (it) => it.kind === 'sea'], ['plant', '植物與作物', (it, id) => ['crop', 'seed'].includes(it.kind) || ['berry', 'herb', 'acorn', 'mushroom', 'flower', 'sunflower', 'apple', 'orange', 'peach'].includes(id)],
    ['food', '料理與飲料', (it, id) => (it.kind === 'food' || it.kind === 'drink') && !['berry', 'mushroom', 'apple', 'orange', 'peach', 'cheese', 'honey'].includes(id)], ['home', '家具與紀念品', (it) => it.kind === 'furniture'], ['wear', '服飾', (it) => it.kind === 'clothing'], ['other', '禮物、玩具與材料', (it) => ['gift', 'toy', 'material'].includes(it.kind)]];
  const ITEM_IDS = () => Object.keys(OC.Style.ITEMS).filter((id) => !I(id).custom);
  const actsSeen = () => { const s = new Set(); for (const c of OC.Chars.all()) for (const [a, r] of Object.entries(c.life.rec.act || {})) if (r.n) s.add(a); return s; };
  const evSeen = () => { const s = new Set(Object.keys(S().play.events || {})); for (const e of S().life.ev.log || []) if (e.why === 'done' || e.why === '背景完成') s.add(e.id); return s; };
  function collStats() {
    const ids = ITEM_IDS(), cats = itemCats.map(([k, zh, f]) => { const L = ids.filter((id) => f(I(id), id)); return { k, zh, total: L.length, found: L.filter((id) => S().seen[id]).length }; });
    const pl = OC.Places.list().filter((id) => OC.Places.open(id)); cats.push({ k: 'place', zh: '地點', total: pl.length, found: pl.filter((id) => S().places.visited[id]).length });
    const acts = Object.keys(OC.LifeData.ACTS); cats.push({ k: 'act', zh: '活動', total: acts.length, found: acts.filter((a) => actsSeen().has(a)).length });
    const evs = OC.Events.defs().filter((e) => !e.custom); cats.push({ k: 'event', zh: '特殊事件', total: evs.length, found: evs.filter((e) => evSeen().has(e.id)).length });
    return { cats, total: cats.reduce((a, c) => a + c.total, 0), found: cats.reduce((a, c) => a + c.found, 0) };
  }
  function stateOf(id) { const seen = S().seen[id], have = OC.Store.count(id) > 0, spot = (S().play.spotted || {})[id]; return have ? 'own' : seen ? 'past' : spot ? 'spotted' : 'none'; }
  const STATE_ZH = { own: '持有中', past: '曾經持有', spotted: '看過', none: '未發現' };
  Pg().define('collection', '圖鑑', {
    sub: true,
    build(p, el) {
      p.cat = 'fish'; p.stat = 'all'; p.rar = 0; p.sort = 'rarity';
      p.q = h('input.input', { type: 'search', placeholder: '搜尋名稱、地點、來源…', 'aria-label': '搜尋圖鑑', on: { input: () => p.refresh(p) } });
      p.sum = h('div'); p.chips = h('div.chips.scroll'); p.filters = h('div.hstack', { style: { gap: '6px', flexWrap: 'wrap' } }); p.body = h('div');
      el.append(p.sum, p.chips, h('div', { style: { margin: '8px 0' } }, p.q), p.filters, p.body);
    },
    refresh(p) {
      const st = collStats(); const fav = S().play.collFav || {};
      if (same(p, [p.cat, p.stat, p.rar, p.sort, p.q.value, st.found, JSON.stringify(S().inv), JSON.stringify(fav)].join('|'))) return;
      p.sum.replaceChildren(card(h('div.hstack', null, h('span.grow', null, '全部發現'), h('b.num', null, `${st.found}/${st.total}`)), bar(st.found, st.total, 'var(--teal)')));
      p.chips.replaceChildren(...[...st.cats.map((c) => [c.k, `${c.zh} ${c.found}/${c.total}`]), ['fav', '★ 收藏']].map(([k, zh]) => h('button.chip-btn' + (p.cat === k ? '.on' : ''), { on: { click: () => { p.cat = k; p.refresh(p); } } }, zh)));
      const sel = (opts, v, f) => h('select.input.s', { on: { change: (e) => { f(e.target.value); p.refresh(p); } } }, ...opts.map(([k, zh]) => h('option', { value: k, selected: String(v) === String(k) }, zh)));
      p.filters.replaceChildren(sel([['all', '全部狀態'], ['own', '持有中'], ['past', '曾經持有'], ['found', '已發現'], ['none', '未發現']], p.stat, (v) => (p.stat = v)), sel([[0, '所有稀有度'], ...OC.Items.RARITY.map((z, i) => [i, z]).slice(1)], p.rar, (v) => (p.rar = +v)), sel([['rarity', '依稀有度'], ['name', '依名稱'], ['date', '依發現時間']], p.sort, (v) => (p.sort = v)));
      const q = p.q.value.trim();
      if (['place', 'act', 'event'].includes(p.cat)) { p.body.replaceChildren(otherGrid(p.cat, q)); return; }
      let ids = ITEM_IDS();
      if (p.cat === 'fav') ids = ids.filter((id) => fav[id]); else { const f = itemCats.find((c) => c[0] === p.cat); if (f) ids = ids.filter((id) => f[2](I(id), id)); }
      ids = ids.filter((id) => { const s2 = stateOf(id); if (p.stat === 'own' && s2 !== 'own') return false; if (p.stat === 'past' && s2 !== 'past') return false; if (p.stat === 'found' && !S().seen[id]) return false; if (p.stat === 'none' && S().seen[id]) return false; if (p.rar && (I(id).rarity || 1) !== p.rar) return false; if (q && !(S().seen[id] && (I(id).zh.includes(q) || (I(id).src || []).join().includes(q)))) return false; return true; });
      ids.sort((a, b) => p.sort === 'name' ? I(a).zh.localeCompare(I(b).zh, 'zh-Hant') : p.sort === 'date' ? (S().seen[b] || 0) - (S().seen[a] || 0) : (I(a).rarity || 1) - (I(b).rarity || 1) || I(a).zh.localeCompare(I(b).zh, 'zh-Hant'));
      p.body.replaceChildren(ids.length ? h('div.grid.c4', null, ...ids.map((id) => { const s2 = stateOf(id), seen = !!S().seen[id]; return h('button.tile.coll' + (seen ? '' : '.locked') + '.' + s2, { on: { click: () => (seen || s2 === 'spotted' ? collSheet(id, p) : toast(`還沒發現。提示：${(I(id).src || ['到處探索看看']).join('、')}`, 'compass')) } }, seen || s2 === 'spotted' ? img(id, 44) : silhouette(id), h('span.ellipsis', null, seen ? I(id).zh : '？？？'), h('span.rar', null, '★'.repeat(I(id).rarity || 1)), s2 === 'own' ? h('span.count', null, '×' + OC.Store.count(id)) : s2 === 'past' ? h('span.count.past', null, '曾有') : null, fav[id] ? h('span.fav', null, '★') : null); })) : h('div.empty', null, '沒有符合的項目'));
    },
  });
  /** a soft silhouette for undiscovered items (keeps the surprise, hints at the shape) */
  function silhouette(id) { const src = OC.Style.itemCanvas(id, 64), c = OC.makeCanvas(64, 64), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--locked').trim() || 'rgba(107,79,58,.38)'; x.fillRect(0, 0, 64, 64); const im = h('img', { src: c.toDataURL(), alt: '', style: { width: '44px', height: '44px', opacity: '0.7' } }); return im; }
  function otherGrid(cat, q) {
    if (cat === 'place') {
      return h('div.vstack', { style: { gap: '8px' } }, ...OC.Places.list().filter((id) => OC.Places.open(id)).filter((id) => !q || OC.Places.get(id).zh.includes(q)).map((id) => { const P0 = OC.Places.get(id), v = S().places.visited[id], pr = OC.Places.progress(id); const evs = (S().life.ev.log || []).filter((e) => e.why && /done|背景/.test(e.why)).length; void evs;
        return h('div.q-row' + (v ? '' : '.hidden'), null, h('div.place-thumb.s', { style: { '--c': v ? P0.col : 'var(--locked)' } }, icon(v ? P0.icon : 'lock', 's')), h('div.grow', null, h('b', null, v ? P0.zh : '？？？'), small(v ? `${OC.Places.TYPES[P0.type]}・第一次造訪 ${new Date(v).toLocaleDateString('zh-TW')}・探索 ${pr.found}/${pr.total}` : '還沒去過'), v && P0.finds && P0.finds.length ? h('div.chips', { style: { marginTop: '4px' } }, ...P0.finds.slice(0, 8).map((f) => (S().seen[f] ? img(f, 22) : h('span.tag', null, '？')))) : null)); }));
    }
    if (cat === 'act') { const seen = actsSeen(); return h('div.grid.c3', null, ...Object.entries(OC.LifeData.ACTS).filter(([, a]) => !q || a.zh.includes(q)).map(([k, a]) => h('div.tile' + (seen.has(k) ? '' : '.locked'), null, h('div', { style: { fontSize: '24px' } }, seen.has(k) ? a.ic || '・' : '？'), h('span', null, seen.has(k) ? a.zh : '？？？')))); }
    const seen = evSeen();
    return h('div.vstack', { style: { gap: '8px' } }, ...OC.Events.defs().filter((e) => !e.custom).filter((e) => !q || (seen.has(e.id) && e.zh.includes(q))).map((e) => h('div.q-row' + (seen.has(e.id) ? '' : '.hidden'), null, h('div.q-ic', null, icon(seen.has(e.id) ? 'sparkle' : 'lock', 's')), h('div.grow', null, h('b', null, seen.has(e.id) ? e.zh : '？？？'), small(seen.has(e.id) ? '已經見證過' : '某天可能會發生…')))));
  }
  function collSheet(id, p) {
    const it = I(id), fav = (S().play.collFav = S().play.collFav || {}), s2 = stateOf(id);
    const tasted = OC.Chars.all().map((c) => [c, OC.Taste.prefs(c).tasted[id]]).filter(([, t]) => t);
    const places = Object.entries(OC.Places.P).filter(([, q]) => (q.finds || []).includes(id)).map(([, q]) => q.zh);
    sheet(it.zh, (b, api) => b.append(
      h('div.center', null, img(id, 96)), h('div.chips', { style: { justifyContent: 'center' } }, h('span.tag.teal', null, STATE_ZH[s2]), h('span.tag.sun', null, OC.Items.RARITY[it.rarity || 1]), h('span.tag', null, (OC.Items.KINDS[it.kind] || {}).zh || it.kind)),
      h('p', null, it.d || ''),
      (it.src || []).length ? small('取得方式：' + it.src.join('、')) : null, places.length ? small('相關地點：' + places.join('、')) : null,
      S().seen[id] ? small(`第一次取得：${new Date(S().seen[id]).toLocaleString('zh-TW')}`) : small('還沒取得過（在商店看過）'),
      OC.Items.isFood(id) ? h('div', { style: { marginTop: '8px' } }, h('b', { style: { fontSize: 'var(--fs-s)' } }, '大家的口味'), ...OC.Chars.all().map((c) => { const t = OC.Taste.prefs(c).tasted[id], pf = OC.Taste.pref(c, id); return h('div.hstack', { style: { gap: '8px', marginTop: '4px' } }, av(c, 28), h('span.grow', null, name(c)), h('span.muted', { style: { fontSize: 'var(--fs-s)' } }, t ? `吃過 ${t.n} 次・${OC.Taste.LV[pf.lv]}` : pf.src === 'player' ? `（你設定：${OC.Taste.LV[pf.lv]}）` : '還沒吃過')); })) : null,
      tasted.length ? null : null,
      h('button.btn.ghost.block', { style: { marginTop: '10px' }, on: { click: () => { if (fav[id]) delete fav[id]; else fav[id] = Date.now(); St.touch('play'); api.close(); p && p.refresh(p); } } }, icon('star', 's'), fav[id] ? '取消收藏標記' : '加上收藏標記')));
  }
  // things seen in shops count as "看過" (spotted) without being owned
  St.on('play', () => {});
  const origShopRefresh = Pg().pages.shop && Pg().pages.shop.refresh;
  if (origShopRefresh) Pg().pages.shop.refresh = function (p, el) { const r = origShopRefresh.call(this, p, el); try { const sid = p.sid; const sp = (S().play.spotted = S().play.spotted || {}); for (const id of OC.Shops.stock(sid)) if (!sp[id]) sp[id] = Date.now(); } catch (e) { /* */ } return r; };

  // ======================= profile: 成長 =======================
  function growth(c, p) {
    const a = c.life.asp || {}, x = a.id && PD().ASPIRATIONS[a.id];
    const sig = [c.id, c.title, JSON.stringify(a), JSON.stringify(c.life.skills), Object.keys(S().play.titles || {}).length].join('|');
    if (p._g && p._gsig === sig) return p._g; p._gsig = sig;
    const titles = OC.Growth.titles();
    const titleSel = h('select.input', { 'aria-label': '稱號', on: { change: (e) => { OC.Growth.wearTitle(c, e.target.value || null); p.refresh(p); } } }, h('option', { value: '' }, titles.length ? '（不戴稱號）' : '還沒有稱號'), ...titles.map((t) => h('option', { value: t.id, selected: c.title === t.id }, t.zh)));
    const aspCard = x ? card(
      h('div.hstack', null, h('div.q-ic.gold', null, icon(x.ic, 's')), h('div.grow', null, h('b', null, `人生目標：${x.zh}`), small(x.d)), a.locked ? h('span.tag', null, icon('lock', 's'), '鎖定') : null),
      h('div.vstack', { style: { gap: '6px', marginTop: '10px' } }, ...x.steps.map((st, i) => { const done = i < a.step, now = i === a.step, n = now ? Math.min(st.goal.n, (a.prog && a.prog.n) || 0) : done ? st.goal.n : 0; return h('div.asp-step' + (done ? '.done' : now ? '.now' : ''), null, h('i', null, done ? '✓' : i + 1), h('div.grow', null, h('div', null, st.zh), now ? bar(n, st.goal.n, 'var(--sun)') : null), now ? h('span.num.faint', null, `${n}/${st.goal.n}`) : null); })),
      small('完成後的獎勵：' + rewardText(x.reward)),
      h('div.hstack', { style: { marginTop: '10px', gap: '6px' } }, h('button.btn.s.block', { on: { click: () => pickAsp(c, p) } }, '換一個目標'), h('button.btn.s.block', { on: { click: () => { OC.Growth.lockAsp(c, !a.locked); p.refresh(p); } } }, a.locked ? '解除鎖定' : '鎖定（不自動換）'), h('button.btn.ghost.s.block', { on: { click: () => { OC.Growth.pauseAsp(c); p.refresh(p); } } }, '先不要'))) :
      card(h('b', null, a.off ? '人生目標：先暫停' : '還沒有人生目標'), small(a.off ? '你讓牠先專心過生活。' : '牠會從生活經驗中慢慢找到想做的事。'), h('button.btn.primary.block', { style: { marginTop: '10px' }, on: { click: () => pickAsp(c, p) } }, '幫牠選一個目標'));
    const doneList = (a.done || []).map((id) => PD().ASPIRATIONS[id]).filter(Boolean);
    const skills = Object.keys(PD().SKILLS).map((sk) => OC.Growth.skillInfo(c, sk)).sort((a1, b1) => b1.xp - a1.xp);
    const el = h('div', null,
      T('稱號'), card(titleSel, small('稱號從成就、挑戰與人生目標取得，全島共用，每位 OC 可以戴一個。')),
      T('人生目標', '長期的夢想'), aspCard, doneList.length ? h('div.chips', { style: { marginTop: '6px' } }, ...doneList.map((d) => h('span.tag.sun', null, icon('star', 's'), d.zh))) : null,
      T('技能', '經常做相關的事就會進步'), h('div.vstack', { style: { gap: '8px' } }, ...skills.map((s2) => h('div.skill-card', null,
        h('div.hstack', null, h('div.q-ic', null, icon(s2.ic, 's')), h('b.grow', null, s2.zh), h('span.lv', null, `Lv.${s2.lv}`)), bar(s2.pct, 100, 'var(--teal)'),
        h('div.unlocks', null, ...s2.unlocks.map((u) => h('div.unl' + (u.on ? '.on' : ''), null, h('span.num', null, `Lv.${u.lv}`), h('span', null, u.zh))))))));
    p._g = el; return el;
  }
  function pickAsp(c, p) {
    sheet('選一個人生目標', (b, api) => b.append(small('牠會比較常做相關的事。完成後有獎勵與稱號；個性的改變仍然會先問你。'), h('div.vstack', { style: { gap: '8px', marginTop: '8px' } }, ...Object.entries(PD().ASPIRATIONS).map(([id, x]) => { const done = (c.life.asp && c.life.asp.done || []).includes(id), fit = x.fit(c); return h('button.q-row' + (done ? '.claimed' : ''), { on: { click: () => { if (done) { toast('這個目標已經完成過了', 'info'); return; } OC.Growth.setAsp(c, id, 'player'); api.close(); p.refresh(p); } } }, h('div.q-ic', null, icon(x.ic, 's')), h('div.grow', { style: { textAlign: 'left' } }, h('b', null, x.zh), small(x.d)), done ? h('span.tag', null, '完成過') : fit > 1.2 ? h('span.tag.teal', null, '很適合') : null); }))));
  }

  // ======================= profile: 日誌 (journal) =======================
  const KINDS = [['', '全部'], ['big', '重要'], ['first', '初次'], ['growth', '成長'], ['social', '社交'], ['player', '和你'], ['discover', '發現'], ['event', '事件'], ['fav', '★ 珍藏']];
  function journal(c, p) {
    const f = p.jf || (p.jf = { k: '', who: '', place: '', small: false });
    const favs = (S().play.memFav = S().play.memFav || {});
    const all = c.life.mem.long.concat(c.life.mem.recent).filter((m, i, arr) => arr.findIndex((y) => y.id === m.id) === i);
    const sig = [c.id, JSON.stringify(f), all.length, all[0] && all[0].id, Object.keys(favs).length].join('|');
    if (p._j && p._jsig === sig) return p._j; p._jsig = sig;
    let list = all.filter((m) => f.small || m.imp >= 0.38 || favs[m.id]);
    if (f.k === 'big') list = list.filter((m) => m.imp >= 0.6 || m.type === 'milestone'); else if (f.k === 'first') list = list.filter((m) => /第一次|初次/.test(m.text)); else if (f.k === 'fav') list = list.filter((m) => favs[m.id]); else if (f.k) list = list.filter((m) => m.type === f.k || (f.k === 'growth' && m.type === 'milestone'));
    if (f.who) list = list.filter((m) => (m.who || []).includes(f.who));
    if (f.place) list = list.filter((m) => String(m.place || '').includes(f.place));
    list.sort((a, b) => b.gm - a.gm);
    const people = OC.Chars.all().filter((o) => o.id !== c.id), places = OC.Places.list().filter((id) => OC.Places.open(id));
    const story = all.filter((m) => m.type === 'milestone' || m.imp >= 0.8).sort((a, b) => a.gm - b.gm).slice(-10);
    const el = h('div', null,
      T('人生故事', '重要的時刻'), story.length ? h('div.timeline', null, ...story.map((m) => h('div.tl-item', null, h('i'), h('div', null, h('b', null, m.text), small(OC.LifeUI.gmLabel(m.gm)))))) : card(h('span.faint', null, '還沒有重要的時刻。一起生活久了就會有。')),
      T('生活日誌', `${list.length} 則`),
      h('div.chips.scroll', null, ...KINDS.map(([k, zh]) => h('button.chip-btn' + (f.k === k ? '.on' : ''), { on: { click: () => { f.k = k; p.refresh(p); } } }, zh))),
      h('div.hstack', { style: { gap: '6px', margin: '6px 0' } },
        h('select.input.s', { 'aria-label': '人物', on: { change: (e) => { f.who = e.target.value; p.refresh(p); } } }, h('option', { value: '' }, '所有人'), ...people.map((o) => h('option', { value: o.id, selected: f.who === o.id }, name(o)))),
        h('select.input.s', { 'aria-label': '地點', on: { change: (e) => { f.place = e.target.value; p.refresh(p); } } }, h('option', { value: '' }, '所有地點'), ...places.map((id) => h('option', { value: id, selected: f.place === id }, OC.Places.get(id).zh))),
        h('label.hstack', { style: { gap: '4px', fontSize: 'var(--fs-s)' } }, toggle(f.small, (v) => { f.small = v; p.refresh(p); }), '小事')),
      list.length ? h('div.mem-cards', null, ...list.slice(0, 50).map((m) => memCard(c, m, favs, p))) : h('div.empty', null, '沒有符合的回憶'),
      small('只整理值得記住的事（走路、普通吃飯不會記）。「回顧」只是重看，不會再給獎勵或改變關係。'));
    p._j = el; return el;
  }
  function memCard(c, m, favs, p) {
    const pl = String(m.place || ''), pid = pl.startsWith('place:') ? pl.slice(6) : null, P0 = pid && OC.Places.get(pid);
    const who = (m.who || []).map((id) => OC.Chars.get(id)).filter(Boolean);
    const shared = who.length && who.some((o) => o.life.mem.long.concat(o.life.mem.recent).some((y) => y.key && m.key && y.key.slice(0, -1) === m.key.slice(0, -1) && y.key !== m.key));
    const E = OC.LifeData.EMOTIONS[m.emo];
    return h('div.mem-card' + (m.imp >= 0.6 ? '.big' : ''), null,
      h('div.mc-top', { style: { '--c': P0 ? P0.col : 'var(--accent)' } }, h('span.emo', null, (E && E.e) || '・'), h('span.grow', null, OC.LifeUI.gmLabel(m.gm)), P0 ? h('span.tag', null, P0.zh) : null, shared ? h('span.tag.teal', null, '共同回憶') : null,
        h('button.icon-btn.s', { 'aria-label': favs[m.id] ? '取消珍藏' : '珍藏', on: { click: () => { if (favs[m.id]) delete favs[m.id]; else favs[m.id] = Date.now(); St.touch('play'); p._jsig = ''; p.refresh(p); } } }, icon('star', 's' + (favs[m.id] ? ' fill' : '')))),
      h('div.mc-text', null, m.text), who.length ? h('div.hstack', { style: { gap: '4px', marginTop: '6px' } }, ...who.map((o) => av(o, 24)), h('span.faint', { style: { fontSize: 'var(--fs-xs)' } }, who.map(name).join('、'))) : null,
      h('div.hstack', { style: { marginTop: '6px' } }, h('span.stars', null, '★'.repeat(Math.max(1, Math.round(m.imp * 5)))), h('span.grow'), m.data && m.data.ev ? h('button.btn.ghost.s', { on: { click: () => OC.LifeUI.replay(c, m) } }, '回顧') : null));
  }

  // ======================= settings: 聲音 =======================
  const sp = Pg().pages.settings, ob = sp.build;
  sp.build = function (p, el) {
    ob.call(this, p, el);
    const cf = () => (S().settings.sound = Object.assign({ on: true, master: 0.8, ui: 0.6, sfx: 0.8, amb: 0.5, event: 0.8 }, S().settings.sound || {}));
    const slider = (k, zh) => h('div.hstack', { style: { marginTop: '8px' } }, h('span', { style: { width: '72px', flex: 'none' } }, zh), h('input', { type: 'range', min: 0, max: 100, value: Math.round(cf()[k] * 100), 'aria-label': zh, style: { flex: 1 }, on: { input: (e) => { cf()[k] = +e.target.value / 100; OC.Sound.apply(); St.touch('settings'); }, change: () => OC.Sound.play(k === 'ui' ? 'tap' : k === 'amb' ? 'water' : k === 'event' ? 'chime' : 'pickup') } }));
    el.append(h('div.section-title', null, '聲音'), h('div.card', null, h('div.hstack', null, h('span.grow', null, '開啟聲音'), toggle(cf().on, (v) => { cf().on = v; OC.Sound.unlock(); OC.Sound.apply(); St.touch('settings'); })),
      slider('master', '主音量'), slider('ui', '介面'), slider('sfx', '角色與物品'), slider('amb', '環境音'), slider('event', '事件與獎勵'),
      small('全部是即時合成的原創音效（沒有外部音檔）。App 切到背景會自動暫停。')));
  };

  // ======================= interact menu: the OC's request on top =======================
  const oi = OC.LifeUI.interact;
  OC.LifeUI.interact = function (id) {
    oi(id);
    const r = OC.Requests.ofOC(id); if (!r) return;
    const sh = [...document.querySelectorAll('.sheet')].pop(); if (!sh) return;
    const bodyEl = sh.querySelector('.sheet-body'); if (!bodyEl) return;
    bodyEl.prepend(h('button.req-banner', { on: { click: () => { const close = sh.querySelector('[aria-label="關閉"]'); if (close) close.click(); else OC.UI.back(); setTimeout(() => OC.Requests.openSheet(r.id), 120); } } }, icon(PD().REQUESTS[r.type].ic || 'chat', 's'), h('span.grow', null, r.state === 'offer' ? '有話想對你說…' : `請求進行中：${r.text}`), icon('chev', 's')));
  };

  // ======================= developer diagnostics: 遊玩系統 =======================
  const dev = Pg().pages.lifedev, dr = dev.refresh;
  dev.refresh = function (p, el) {
    dr.call(this, p, el);
    const box = p.p6 || (p.p6 = h('div')); if (!box.isConnected) p.box.after(box);
    const q = S().play.q;
    box.replaceChildren(h('div.section-title', null, '遊玩系統（第六階段）'),
      h('div.card', null, h('b', null, '最近的進度事件'), ...OC.Progress.log.slice(0, 12).map((e) => small(`${new Date(e.t).toLocaleTimeString('zh-TW')} ${e.ev} ${JSON.stringify(e.d)}`))),
      h('div.card', null, h('b', null, `任務 ${q.list.length}・日 ${q.day}・週 ${q.week}`), ...q.list.map((x) => small(`${x.key} ${x.prog.n || 0}${x.done ? ' 完成' : ''}${x.claimed ? ' 已領' : ''}`)), small('挑戰：' + JSON.stringify(q.chal))),
      h('div.card', null, h('b', null, '成就條件'), ...OC.Achieve.list().map((x) => small(`${x.id} ${x.v}/${x.n}${x.got ? ' ✓' : ''}${x.claimed ? ' 已領' : ''}`))),
      h('div.card', null, h('b', null, '人生目標'), ...OC.Chars.all().map((c) => small(`${name(c)}：${JSON.stringify(c.life.asp || null)}`))),
      h('div.card', null, h('b', null, '請求'), ...OC.Requests.list().slice(0, 10).map((r) => small(`${r.id} ${r.oc} ${r.type} ${r.state} ${JSON.stringify(r.data)}`))),
      h('div.card', null, small(`演出：${OC.Stage.busy ? '播放中' : '閒置'}・佇列 ${OC.Stage.queue}・聲音：${OC.Sound.state}`)));
  };

  OC.P6UI = { growth, journal, collStats, questsTab, achTab, reqTab, collSheet };
})();
