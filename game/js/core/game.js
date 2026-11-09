/* OC Shimeji — game rules (pure logic on top of the Store; no DOM, no renderer).
 * Needs decay in real time, quests / achievements / life goals are evaluated from the
 * stats the actions really increment. Nothing is pre-filled or simulated.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store;
  const ITEMS = () => OC.Style.ITEMS;
  const me = () => OC.Chars.active();
  const has = (t) => { const c = me(); return !!c && c.personality.traits.includes(t); };

  // ---------------- needs (Phase 4: 9 needs simulated in game time by js/life/*) ----------------
  const NEEDS = OC.LifeData.NEEDS;
  /** per game hour, for the needs page (personality multipliers are applied by OC.Mind) */
  function decayRates(c = me()) { const o = {}; for (const n of NEEDS) if (n.decay) o[n.id] = n.decay; return o; }
  /** kept for older callers: absences are simulated by OC.Sim.catchUp (capped, idempotent) */
  function tickNeeds() { if (OC.Sim) OC.Sim.catchUp('tick'); }
  /** face + label of the played OC from its dominant emotion (OC.Mind) */
  function moodFace() {
    const c = me(); if (!c) return { eyes: 'round', mouth: 'cat', label: '' };
    const f = OC.Mind.face(c);
    return { eyes: f.eyes || 'round', mouth: f.mouth || 'cat', brows: f.brows, blush: f.blush, sweat: f.sweat, lookY: f.lookY, label: OC.Mind.label(c) };
  }

  // ---------------- friendship scale ----------------
  // (12.0: there are no resident NPCs any more — every character on the island is one the player made or imported.
  //  OC ↔ OC and OC ↔ player relationships map onto these levels.)
  const LEVELS = [0, 20, 45, 75, 110];
  function friendLevel(fr) { let l = 0; for (let i = 0; i < LEVELS.length; i++) if (fr >= LEVELS[i]) l = i; return l; }
  const LEVEL_ZH = ['初次見面', '認識', '朋友', '好朋友', '摯友'];

  // ---------------- items ----------------
  function eat(id) {
    const it = ITEMS()[id]; if (!it || !it.use) return false;
    if (!OC.Tx.run(null, { pay: { items: { [id]: 1 } } }, '吃掉').ok) return false;
    const fx = Object.assign({}, it.use); if (has('foodie') && it.kind === 'food') fx.mood = (fx.mood || 0) + 6;
    St.needs(fx); St.stat('eaten'); progress('eat', 1, { oc: S().activeId, item: id, by: 'player' });
    return fx;
  }
  function sell(id, n = 1) { const it = ITEMS()[id]; if (!it || !it.sell || St.count(id) < n) return false; if (!OC.Tx.run(OC.Tx.uid('sell'), { pay: { items: { [id]: n } }, get: { coins: it.sell * n } }, `賣出 ${it.zh} ×${n}`).ok) return false; progress('sell', n, { item: id }); St.stat('sold', n); progress('sell', n); return it.sell * n; }
  function buy(id) {
    const it = ITEMS()[id]; if (!it || !it.price) return { ok: false, why: '無法購買' };
    if (it.kind === 'clothing' && St.count(id)) return { ok: false, why: '已經擁有' };
    const r = OC.Tx.run(OC.Tx.uid('buy'), { pay: { coins: it.price }, get: { items: { [id]: 1 } } }, `購買 ${it.zh}`);
    if (!r.ok) return { ok: false, why: r.why[0] };
    St.stat('bought'); progress('buy', 1, { shop: 'general', item: id });
    return { ok: true };
  }
  function wearOptions(slot) { const base = OC.Style.FREE_WEAR[slot].slice(); for (const [id, it] of Object.entries(ITEMS())) if (it.kind === 'clothing' && it.slot === slot && St.count(id)) base.push(it.val); return base; }

  // ---------------- daily quests ----------------
  const QUEST_POOL = [
    { id: 'shake', zh: '搖果樹', d: '搖一搖島上的果樹', n: 3, reward: 120, ic: 'leaf' },
    { id: 'chat', zh: '和 OC 聊天', d: '點一下你的 OC，說說話', n: 2, reward: 100, ic: 'chat' },
    { id: 'pick', zh: '採集', d: '撿貝殼、摘花或採蘑菇', n: 3, reward: 90, ic: 'sparkle' },
    { id: 'eat', zh: '好好吃飯', d: '吃一樣東西', n: 1, reward: 50, ic: 'apple' },
    { id: 'gift', zh: '送禮物', d: '把東西拖到 OC 身上送給牠', n: 1, reward: 100, ic: 'gift' },
    { id: 'sell', zh: '去攤位賣東西', d: '在晴日雜貨攤賣出物品', n: 2, reward: 60, ic: 'coin' },
    { id: 'place', zh: '佈置小島', d: '放置或移動一件家具', n: 1, reward: 80, ic: 'sofa' },
    { id: 'anim', zh: '創作時間', d: '在工坊存一段逐格動畫', n: 1, reward: 150, ic: 'film' },
    { id: 'visit', zh: '出門走走', d: '搭渡船去苔光森林', n: 1, reward: 100, ic: 'compass' },
  ];
  // Phase 6: daily quests live in OC.Quests (js/play/quests.js); these keep the old API working
  const PROGRESS_EV = { shake: 'shake', chat: 'chat', pick: 'pick', eat: 'eat', gift: 'gift', sell: 'sell', place: 'place', anim: 'anim', buy: 'buy' };
  function progress(key, n = 1, data) { if (OC.Progress && PROGRESS_EV[key]) OC.Progress.emit(PROGRESS_EV[key], Object.assign({ count: n }, data || {})); }
  function todayQuests() { return OC.Quests ? OC.Quests.legacyToday() : legacyTodayQuests(); }
  function claim(id) { return OC.Quests ? OC.Quests.legacyClaim(id) : false; }
  function legacyTodayQuests() {
    const q = S().quests, day = OC.Clock.dayKey();
    if (q.day !== day) { q.day = day; q.done = {}; q.claimed = {}; q.prog = {}; St.touch(); }
    const d = new Date(), seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
    const ids = QUEST_POOL.map((x, i) => [OC.hash(seed + i * 0.37), x]).sort((a, b) => a[0] - b[0]).slice(0, 4).map((x) => x[1]);
    return ids.map((x) => Object.assign({}, x, { prog: Math.min(x.n, (q.prog || {})[x.id] || 0), claimed: !!q.claimed[x.id] }));
  }
  // ---------------- achievements ----------------
  const st = () => S().stats;
  const totalFr = () => OC.Chars.all().reduce((a, c) => a + ((c.life && c.life.player && c.life.player.aff) || 0), 0);
  const COLLECTIBLE = () => Object.keys(ITEMS()).filter((k) => ITEMS()[k].kind !== 'clothing');
  // Phase 6: achievements are defined in OC.PlayData.ACH and checked by OC.Achieve (js/play/achieve.js)
  function checkAch() { if (OC.Achieve) OC.Achieve.check(); }
  // ---------------- life goals ----------------
  const GOALS = [
    { id: 'designer', zh: '夢想小島', d: '擺放 8 件家具', ic: 'sofa', v: () => Object.values(S().rooms || {}).reduce((a, r) => a + r.length, 0), n: 8 },
    { id: 'popular', zh: '島上人氣王', d: '和自己所有 OC 的好感合計達到 200', ic: 'heart', v: () => totalFr(), n: 200 },
    { id: 'collector', zh: '圖鑑大師', d: '收集圖鑑中的所有物品', ic: 'book', v: () => Object.keys(S().seen).filter((k) => COLLECTIBLE().includes(k)).length, n: COLLECTIBLE().length },
    { id: 'artist', zh: '動畫創作者', d: '在工坊完成 5 段逐格動畫', ic: 'film', v: () => st().anims, n: 5 },
  ];

  OC.Game = { NEEDS, tickNeeds, moodFace, friendLevel, LEVELS, LEVEL_ZH, eat, sell, buy, wearOptions, QUEST_POOL, todayQuests, progress, claim, get ACH() { return OC.PlayData ? OC.PlayData.ACH : []; }, checkAch, GOALS, COLLECTIBLE, has };
})();
