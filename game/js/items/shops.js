/* OC Shimeji — shops & prices (Phase 5). Predictable rules (no surprise gacha):
 *   - each shop has a fixed catalogue (+ the player's workshop products assigned to it)
 *   - one 「今日特價」 item per shop per game day (−20%), chosen from the catalogue by the day number
 *   - rainy days: hot drinks / soup at the café −15% 「雨天暖飲」
 *   - 每日市場 sells a rotating set of 6 items with limited daily stock (resets every game day)
 *   - clothing is a one-time unlock (owned → 「已擁有」); everything else has no limit except the market
 * Buying / selling always goes through OC.Tx (validated, atomic, logged).
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, I = () => OC.Style.ITEMS;
  const SHOPS = {
    general: { zh: '晴日雜貨攤', place: 'isle', ic: 'cart', sells: true, items: ['milk', 'cake', 'star', 'bread', 'seed_tomato', 'seed_potato', 'plant', 'cushion', 'chair', 'lamp', 'rug', 'table', 'bed'] },
    food: { zh: '晴日食品店', place: 'street', ic: 'apple', items: ['bread', 'milk', 'cake', 'onigiri', 'cookie', 'cocoa', 'lemonade', 'flour', 'sugar', 'egg', 'rice', 'cheese', 'honey', 'seed_tomato', 'seed_carrot', 'seed_potato'] },
    clothes: { zh: '小針線服裝店', place: 'street', ic: 'shirt', items: ['acc-scarf', 'acc-hood', 'acc-crown', 'acc-bow', 'acc-sunhat', 'acc-glasses', 'clip-star', 'clip-leaf', 'pat-star', 'pat-dots', 'pat-heart', 'shirt-sun', 'shirt-mint', 'shirt-berry'] },
    furniture: { zh: '木木家具行', place: 'street', ic: 'sofa', items: ['chair', 'table', 'cushion', 'bed', 'sofa', 'desk', 'bookshelf', 'toybox', 'stove', 'wardrobe', 'painting', 'clock', 'bigpot', 'plant', 'lamp', 'lantern', 'rug', 'campfire', 'swing'] },
    gift: { zh: '星星禮品屋', place: 'street', ic: 'gift', items: ['star', 'giftbox', 'letter', 'plush', 'ball', 'yoyo', 'kite', 'blocks'] },
    market: { zh: '每日市場', place: 'street', ic: 'leaf', sells: true, rotate: ['seed_tomato', 'seed_carrot', 'seed_potato', 'seed_straw', 'seed_sun', 'tomato', 'carrot', 'potato', 'honey', 'juice', 'egg', 'herb', 'berry'], daily: 6, stock: [2, 5] },
    mill: { zh: '風車磨坊', place: 'hill', ic: 'leaf', items: ['flour', 'bread', 'honey', 'pinwheel', 'lavender', 'seed_sun', 'kite', 'tea'] },
    fair: { zh: '遊樂園點心攤', place: 'fair', ic: 'apple', eatHere: true, items: ['cotton_candy', 'popcorn', 'soda_float', 'lemonade', 'juice'] },
    cafe: { zh: '雲朵咖啡館', place: 'cafe', ic: 'apple', eatHere: true, items: ['latte', 'cocoa', 'tea', 'lemonade', 'juice', 'bread', 'pancake', 'pudding', 'soup_mush', 'curry', 'salad'] },
  };
  const gday = () => OC.Sim.day();
  const h = (n) => OC.hash(n);
  /** catalogue for today (+ workshop products assigned to this shop) */
  function stock(id) {
    const s = SHOPS[id]; if (!s) return [];
    let list = s.items ? s.items.slice() : [];
    if (s.rotate) { const d = gday(); list = s.rotate.map((x, i) => [x, h(d * 7.31 + i * 1.7)]).sort((a, b) => a[1] - b[1]).slice(0, s.daily).map((x) => x[0]); }
    for (const [cid, it] of Object.entries(I())) if (it.custom && it.shop === id) list.push(cid);
    return list.filter((x) => I()[x] && (I()[x].price || I()[x].custom));
  }
  function deal(id) { const s = SHOPS[id]; if (!s || s.rotate) return null; const list = stock(id).filter((x) => !I()[x].custom); if (!list.length) return null; return list[Math.floor(h(gday() * 3.7 + id.length * 11.1) * list.length)]; }
  /** price today → { price, base, tag } */
  function price(shop, item) {
    const it = I()[item]; let base = it.price || Math.round((it.sell || 10) * 2.2); if (shop === 'market' && !it.price) base = Math.round((it.sell || 10) * 1.8);
    let p = base, tag = null;
    if (deal(shop) === item) { p = Math.round(base * 0.8); tag = '今日特價'; }
    if (shop === 'cafe' && OC.Clock.weather() === 'rain' && (it.temp === 'hot')) { p = Math.round(p * 0.85); tag = tag ? tag + '・雨天暖飲' : '雨天暖飲'; }
    return { price: Math.max(1, p), base, tag };
  }
  function left(shop, item) { const s = SHOPS[shop]; if (!s.stock) return Infinity; const st = (S().shops[shop] = S().shops[shop] || { day: gday(), sold: {} }); if (st.day !== gday()) { st.day = gday(); st.sold = {}; } const n = s.stock[0] + Math.floor(h(gday() * 5.3 + item.length * 2.9) * (s.stock[1] - s.stock[0] + 1)); return Math.max(0, n - (st.sold[item] || 0)); }
  const owned = (item) => I()[item].kind === 'clothing' && St.count(item) > 0;
  /** buy n → { ok, why, total } (one atomic transaction) */
  function buy(shop, item, n = 1) {
    if (!SHOPS[shop] || !stock(shop).includes(item)) return { ok: false, why: '這家店沒有賣這個' };
    if (!(n >= 1 && n <= 99 && Math.floor(n) === n)) return { ok: false, why: '數量不正確' };
    if (owned(item)) return { ok: false, why: '已經擁有了' }; if (I()[item].kind === 'clothing' && n > 1) n = 1;
    if (left(shop, item) < n) return { ok: false, why: '今天賣完了' };
    const { price: p } = price(shop, item), total = p * n;
    const r = OC.Tx.run(OC.Tx.uid('buy'), { pay: { coins: total }, get: { items: { [item]: n } } }, `${SHOPS[shop].zh}：${I()[item].zh} ×${n}`, { shop });
    if (!r.ok) return { ok: false, why: r.why[0] };
    if (SHOPS[shop].stock) { const st = S().shops[shop]; st.sold[item] = (st.sold[item] || 0) + n; St.touch('shops'); }
    St.stat('bought', n); OC.Game.progress('buy', n, { shop, item }); return { ok: true, total, firsts: r.firsts };
  }
  /** shops that buy back: general store & market */
  function sell(item, n = 1) { return OC.Game.sell(item, n); }

  /* other income (each with an idempotent key, so restarts / repeated events never pay twice):
   *   achievements +ach.reward (default 150) · first visit to a place +80 · each new discovery +10
   *   (quests, OC wishes, selling, foraging / fishing / harvest are paid where they happen) */
  const INCOME = { visit: 80, find: 10 };
  function income() {
    // achievements are claimed by the player since Phase 6 (OC.Achieve.claim, same idempotency key ach:<id>)
    St.on('inv', (e) => { if (e && e.first && OC.Tx.run(`find:${e.id}`, { get: { coins: INCOME.find } }, `新發現：${I()[e.id] ? I()[e.id].zh : e.id}`).ok) St.emit('reward', { coins: INCOME.find, why: '新發現' }); });
    St.on('places', (e) => { if (e && e.first && OC.Places.get(e.id) && OC.Tx.run(`visit:${e.id}`, { get: { coins: INCOME.visit } }, `第一次造訪${OC.Places.get(e.id).zh}`).ok) St.emit('reward', { coins: INCOME.visit, why: '探索新地點' }); });
  }
  OC.Shops = { INCOME, income, SHOPS, stock, deal, price, left, owned, buy, sell, get: (id) => SHOPS[id] || null };
})();
