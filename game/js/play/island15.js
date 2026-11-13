/* OC Shimeji — 15.2 island life content:
 *   OC.Island.roomScore(id)  a score for a room you decorate (furniture value, variety, the basics a home needs, painted walls; crowding costs)
 *                            with five tiers; each tier's reward is claimed by the player (key room:<id>:<tier>, through OC.Quests.grant)
 *   OC.Island.rating()       the island's star rating (1–5) from six real measures, with the weakest one as a tip
 *   OC.Island.news()         「島報」: today's paper, written only from things that really happened (yesterday's memories and ledger,
 *                            today's weather and shop deals, birthdays) — nothing is invented
 *   birthdays                a character's 生日 field (e.g. 3/14) — on that calendar day the character is happy, remembers it, and a cake
 *                            arrives once a year (key bday:<oc>:<year>)
 * Page 'news' (島報) opens from the pocket phone.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, I = (id) => OC.Style.ITEMS[id], Sim = () => OC.Sim, M = () => OC.Mind;
  const name = (c) => OC.Chars.name(c);

  // ======================= room score =======================
  const TIERS = [0, 140, 200, 260, 330, 400];   /* the starter room scores about 120: tier 1 needs the player's own touch */
  const TIER_ZH = ['剛搬進來', '有點樣子了', '舒服的家', '有品味的家', '雜誌等級', '夢想中的家'];
  const BASICS = [['bed', '床', (f) => f.id === 'bed'], ['seat', '可以坐的地方', (f, it) => it.sit], ['table', '桌子', (f) => f.id === 'table' || f.id === 'desk'], ['light', '燈', (f) => ['lamp', 'lantern'].includes(f.id)], ['green', '植物', (f) => ['plant', 'bigpot'].includes(f.id)]];
  function roomScore(id = 'home') {
    const R = OC.Places.room(id).filter((f) => I(f.id)), n = R.length;
    const value = R.reduce((a, f) => a + Math.min(12, Math.round((I(f.id).price || 100) / 40)), 0);
    const kinds = new Set(R.map((f) => f.id)).size, variety = kinds * 6;
    const have = BASICS.map(([k, zh, test]) => ({ k, zh, ok: R.some((f) => test(f, I(f.id))) })), basics = have.filter((b) => b.ok).length * 10;
    const paint = S().surfaces && S().surfaces[id] && Object.keys(S().surfaces[id]).length ? 12 : 0;
    const crowd = Math.max(0, n - 18) * 6;
    const score = Math.max(0, Math.round(value + variety + basics + paint - crowd));
    let tier = 0; for (let i = TIERS.length - 1; i >= 0; i--) if (score >= TIERS[i]) { tier = i; break; }
    const missing = have.filter((b) => !b.ok).map((b) => b.zh);
    return { score, tier, zh: TIER_ZH[tier], next: TIERS[tier + 1] || null, parts: { value, variety, basics, paint, crowd }, n, kinds, missing };
  }
  const tierReward = (t) => ({ coins: 80 * t, items: t === 3 ? { painting: 1 } : t === 5 ? { plush: 1 } : {} });
  const tierKey = (id, t) => `room:${id}:${t}`;
  const claimed = (id, t) => !!(S().ledger && S().ledger.keys && S().ledger.keys[tierKey(id, t)]);
  /** tiers reached but not claimed yet */
  function roomClaimable(id = 'home') { const r = roomScore(id), out = []; for (let t = 1; t <= r.tier; t++) if (!claimed(id, t)) out.push(t); return out; }
  function claimRoom(id, t) {
    const r = roomScore(id); if (t > r.tier) return { ok: false, why: '還沒達到這個等級' };
    const res = OC.Quests.grant(tierKey(id, t), tierReward(t), `房間評分：${TIER_ZH[t]}`);
    if (res.ok && OC.Progress) OC.Progress.emit('room', { place: id, tier: t });
    return Object.assign({ reward: tierReward(t) }, res);
  }

  // ======================= island rating =======================
  function rating() {
    const C = OC.Chars.all(), open = OC.Places.list().filter((p) => OC.Places.open(p));
    const items = Object.keys(OC.Style.ITEMS).filter((id) => !I(id).custom);
    const RL = S().life.rel || {}, pairs = []; for (const c of C) { pairs.push((c.life.player && c.life.player.aff) || 0); for (const d of C) if (d.id !== c.id && RL[c.id + '>' + d.id]) pairs.push(RL[c.id + '>' + d.id].aff); }   /* read only: never creates relation records */
    const plots = Object.values(S().garden || {}), planted = plots.filter((p) => p.seed).length;
    const parts = [
      { k: 'home', zh: '家', v: Math.min(1, roomScore('home').score / 400), tip: '佈置「我的家」（家具種類、床、桌子、燈、植物）' },
      { k: 'explore', zh: '探索', v: open.filter((p) => S().places.visited[p]).length / Math.max(1, open.length), tip: '去還沒去過的地方' },
      { k: 'collect', zh: '收藏', v: Math.min(1, items.filter((id) => S().seen[id]).length / Math.max(1, items.length * 0.6)), tip: '釣魚、採集、觀察小生物，填滿圖鑑' },
      { k: 'bonds', zh: '感情', v: pairs.length ? Math.max(0, Math.min(1, pairs.reduce((a, b) => a + b, 0) / pairs.length / 70)) : 0, tip: '多陪角色聊天、玩耍、送禮' },
      { k: 'garden', zh: '菜園', v: plots.length ? planted / plots.length : 0, tip: '在晴日島的菜園種點東西' },
      { k: 'memories', zh: '回憶', v: Math.min(1, ((S().photos || []).length) / 10), tip: '用手機的「拍照」留下照片' },
    ];
    const avg = parts.reduce((a, p) => a + p.v, 0) / parts.length, stars = Math.max(1, Math.min(5, Math.round(avg * 5 + 0.5)));
    const weak = parts.slice().sort((a, b) => a.v - b.v)[0];
    return { stars, avg, parts, tip: weak.v < 1 ? weak.tip : null };
  }

  // ======================= birthdays =======================
  /** '3/14', '3月14日', '03-14' → { m, d } (null when it cannot be read) */
  function parseBday(s) { const m = String(s || '').match(/(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/); if (!m) return null; const mo = +m[1], d = +m[2]; return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? { m: mo, d } : null; }
  const isToday = (b, now = new Date()) => b && b.m === now.getMonth() + 1 && b.d === now.getDate();
  function birthdays(now = new Date()) {
    const out = [];
    for (const c of OC.Chars.all()) { const b = parseBday(c.profile.birthday); if (!b) continue; let nx = new Date(now.getFullYear(), b.m - 1, b.d); const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (nx < t0) nx = new Date(now.getFullYear() + 1, b.m - 1, b.d); out.push({ c, b, today: isToday(b, now), days: Math.round((nx - t0) / 864e5) }); }
    return out.sort((a, b) => a.days - b.days);
  }
  let lastCheck = 0;
  /** whoever has a birthday today gets their day (cake once a year — the key makes repeats harmless; mood; a memory). Checked at most every 20 s. */
  function checkBirthdays(force) {
    const now = new Date(); if (!force && Date.now() - lastCheck < 20000) return; lastCheck = Date.now();
    if (OC.Sim.catching) { lastCheck = 0; return; }
    for (const x of birthdays(now)) {
      if (!x.today) continue; const key = `bday:${x.c.id}:${now.getFullYear()}`; if (S().ledger && S().ledger.keys && S().ledger.keys[key]) continue;
      const r = OC.Tx.run(key, { get: { items: { cake: 1 } } }, `${name(x.c)}的生日蛋糕`); if (!r.ok) continue;
      M().feel(x.c, 'happy', 0.7, '今天是生日'); M().remember(x.c, { type: 'event', imp: 0.85, text: `${now.getFullYear()} 年的生日。收到了蛋糕。`, key });
      OC.UI.toast(`今天是 ${name(x.c)} 的生日！背包裡多了一個蛋糕，可以送給${M().pron(x.c)}。`, 'gift');
      if (OC.Progress) OC.Progress.emit('birthday', { oc: x.c.id });
    }
  }

  // ======================= the island paper =======================
  const ymd = (t) => { const d = new Date(t); return OC.Clock.dayKey(d); };
  function news(now = new Date()) {
    const out = { date: now.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' }), stories: [], deals: [], bdays: [] };
    const wx = OC.Clock.weather(), WX = OC.Clock.WX_ZH[wx] || wx;
    out.weather = { wx, text: { clear: '晴朗，適合出門。風車丘的風箏應該飛得很高。', cloudy: '多雲，散步剛剛好。', rain: '下雨。菜園會自己喝飽水，森林裡的蝸牛會出來。', fog: '有霧。森林和山丘會比較安靜。', snow: '下雪了。記得穿暖一點。' }[wx] || WX };
    // yesterday, from what really happened: each character's most important memory of the previous game day
    const yd = Sim().day() - 1;
    for (const c of OC.Chars.all()) {
      const m = c.life.mem.recent.concat(c.life.mem.long).filter((x) => x.day === yd && x.text).sort((a, b) => b.imp - a.imp)[0];
      if (m) out.stories.push({ who: c, text: m.text, imp: m.imp });
    }
    out.stories.sort((a, b) => b.imp - a.imp); out.stories = out.stories.slice(0, 4);
    // the ledger of the previous calendar day
    const yk = ymd(now.getTime() - 864e5), led = ((S().ledger || {}).log || []).filter((e) => ymd(e.at) === yk);
    out.money = { n: led.length, in: led.reduce((a, e) => a + ((e.get && e.get.coins) || 0), 0), out: led.reduce((a, e) => a + ((e.pay && e.pay.coins) || 0), 0) };
    for (const sh of ['food', 'furniture', 'clothes', 'gift', 'mill']) { const d = OC.Shops.deal(sh); if (d) out.deals.push({ shop: OC.Shops.SHOPS[sh].zh, item: d }); }
    out.bdays = birthdays(now).filter((x) => x.days <= 14);
    /* 15.5: today's festival, last night's dreams, declarations in progress */
    out.fest = OC.Life15 ? OC.Life15.festival(now) : null;
    out.dreams = OC.Life15 ? OC.Chars.all().map((c) => ({ c, d: OC.Life15.st(c).dreams[0] })).filter((x) => x.d && x.d.day >= Sim().day() - 1).slice(0, 3) : [];
    out.decls = OC.Life15 ? OC.Chars.all().map((c) => ({ c, q: OC.Life15.st(c).decl })).filter((x) => x.q && !x.q.done && !x.q.failed) : [];
    out.rating = rating(); out.room = roomScore('home');
    return out;
  }

  // ======================= page =======================
  const { h, toast, haptic } = OC.UI;
  const same = (p, k) => { if (p._sig === k) return true; p._sig = k; return false; };
  const stars = (n) => h('span.news-stars', { 'aria-label': n + ' 顆星' }, ...[1, 2, 3, 4, 5].map((i) => h('i' + (i <= n ? '.on' : ''), null, '★')));
  OC.Pages.define('news', '島報', {
    sub: true,
    build(p, el) { p.box = h('div.news'); el.append(p.box); },
    refresh(p) {
      const N = news(), cl = roomClaimable('home');
      if (same(p, JSON.stringify([N.fest && N.fest.id, N.dreams.map((x) => x.d.text), N.decls.map((x) => x.q.prog), N.date, N.stories.map((s) => s.text), N.money, N.deals.map((d) => d.item), N.bdays.map((b) => b.c.id + b.days), N.rating.stars, Math.round(N.rating.avg * 100), N.room.score, cl, S().coins]))) return;
      const R = N.room, RT = N.rating;
      p.box.replaceChildren(
        h('div.news-mast', null, h('b', null, '晴日島報'), h('span', null, N.date)),
        h('div.card.news-lead', null, h('div.news-kicker', null, '今天的天氣'), h('p', null, N.weather.text)),
        N.fest ? h('div.card.news-fest', null, h('div.news-kicker', null, '今天是節日'), h('p', null, h('b', null, N.fest.zh), '　', N.fest.d)) : null,
        N.decls.length ? h('div.card', null, h('div.news-kicker', null, '宣言進行中'), h('ul.news-list', null, ...N.decls.map((x) => h('li', null, h('b', null, name(x.c)), `　這三天${x.q.zh}（${x.q.prog}/${x.q.n}）`)))) : null,
        N.dreams.length ? h('div.card', null, h('div.news-kicker', null, '昨晚的夢'), h('ul.news-list', null, ...N.dreams.map((x) => h('li', null, h('b', null, name(x.c)), '　' + x.d.text)))) : null,
        N.bdays.length ? h('div.card.news-bday', null, h('div.news-kicker', null, '生日'), ...N.bdays.map((x) => h('p', null, x.today ? `今天是 ${name(x.c)} 的生日！` : `${name(x.c)} 的生日還有 ${x.days} 天（${x.b.m}/${x.b.d}）`))) : null,
        h('div.card', null, h('div.news-kicker', null, '昨天的島上'),
          N.stories.length ? h('ul.news-list', null, ...N.stories.map((s) => h('li', null, h('b', null, name(s.who)), '　', s.text))) : h('p.faint', null, '昨天很安靜，沒有特別的事。'),
          N.money.n ? h('p.faint', null, `帳本：${N.money.n} 筆，收入 ${N.money.in}、支出 ${N.money.out} 星幣`) : null),
        N.deals.length ? h('div.card', null, h('div.news-kicker', null, '今日特價（八折）'), h('div.news-deals', null, ...N.deals.map((d) => { const im = OC.Style.itemImg(d.item); im.style.width = im.style.height = '36px'; return h('div.news-deal', null, im, h('span', null, h('b', null, I(d.item).zh), h('small', null, d.shop))); }))) : null,
        h('div.card.news-rate', null, h('div.news-kicker', null, '小島評價'), h('div.hstack', null, stars(RT.stars), h('span.grow'), h('b.num', null, Math.round(RT.avg * 100) + ' 分')),
          h('div.news-parts', null, ...RT.parts.map((x) => h('div', null, h('small', null, x.zh), h('div.bar', null, h('i', { style: { width: Math.round(x.v * 100) + '%', '--c': 'var(--accent)' } }))))),
          RT.tip ? h('p.faint', null, '想讓評價更高：' + RT.tip) : h('p.faint', null, '每一項都很好。')),
        h('div.card.news-room', null, h('div.news-kicker', null, '我的家・房間評分'), h('div.hstack', null, h('b.num', { style: { fontSize: 'var(--fs-2xl)' } }, R.score), h('span', null, '　' + R.zh), h('span.grow'), R.next ? h('small.faint', null, `下一級 ${R.next}`) : h('small.faint', null, '最高級')),
          h('p.faint', null, `家具 ${R.n} 件、${R.kinds} 種${R.parts.paint ? '、牆壁地板換過' : ''}${R.parts.crowd ? `、太擠了（−${R.parts.crowd}）` : ''}` + (R.missing.length ? `。還少：${R.missing.join('、')}` : '')),
          cl.length ? h('div.vstack', { style: { gap: '6px', marginTop: '8px' } }, ...cl.map((t) => h('button.btn.primary.block', { on: { click: () => { const r = claimRoom('home', t); if (!r.ok) { toast(r.why, 'info'); return; } haptic(); toast(`領取「${TIER_ZH[t]}」：${r.reward.coins} 星幣${Object.keys(r.reward.items).length ? '＋' + Object.keys(r.reward.items).map((k) => I(k).zh).join('、') : ''}`, 'coin'); p._sig = ''; p.refresh(p); } } }, `領取「${TIER_ZH[t]}」的獎勵`))) : null),
      );
    },
  });

  function init() { if (OC.Sim && OC.Sim.onStep) OC.Sim.onStep(() => checkBirthdays()); setTimeout(checkBirthdays, 4000); }
  OC.Island = { roomScore, roomClaimable, claimRoom, TIERS, TIER_ZH, rating, news, birthdays, parseBday, checkBirthdays, init };
})();
