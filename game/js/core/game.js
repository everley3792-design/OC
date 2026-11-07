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

  // ---------------- residents ----------------
  const NPCS = {
    kuri: { id: 'kuri', zh: '栗子', preset: 'kuri', who: '開朗的兔子，喜歡花和甜點。', likes: ['flower', 'cake', 'peach'], dislikes: ['shell'] },
    sora: { id: 'sora', zh: '小空', preset: 'sora', who: '安靜的熊，喜歡星星和海邊的東西。', likes: ['star', 'shell', 'milk'], dislikes: ['mushroom'] },
  };
  function npc(id) { const s = S(); if (!s.npcs[id]) s.npcs[id] = { fr: 0, met: false, liked: [], mem: [], lastTalk: 0, lastGift: '' }; return s.npcs[id]; }
  const LEVELS = [0, 20, 45, 75, 110];
  function friendLevel(fr) { let l = 0; for (let i = 0; i < LEVELS.length; i++) if (fr >= LEVELS[i]) l = i; return l; }
  const LEVEL_ZH = ['初次見面', '認識', '朋友', '好朋友', '摯友'];
  function addFriend(id, d, why) {
    const n = npc(id), before = friendLevel(n.fr); n.fr = Math.max(0, Math.min(150, n.fr + d));
    const after = friendLevel(n.fr);
    if (after > before) { memory(id, `友情升到「${LEVEL_ZH[after]}」`); St.emit('friendUp', { id, level: after }); }
    St.touch('npc', { id, d, why });
  }
  function memory(id, text) { const n = npc(id); n.mem.unshift({ t: Date.now(), text }); n.mem = n.mem.slice(0, 20); }

  /** build a dialogue for talking to a resident: { lines:[..], choices:[{label, fx}] } */
  function dialogue(id) {
    const n = npc(id), d = NPCS[id], myName = OC.Chars.name(me()), ph = OC.Clock.phase(), wx = OC.Clock.weather();
    const now = Date.now(), fresh = now - n.lastTalk > 30 * 60000;
    if (!n.met) {
      return { event: 'meet', lines: [`你好！你就是新搬來的${myName}吧？`, `我是${d.zh}。${d.who.replace('。', '')}，請多指教！`], choices: [
        { label: '請多指教！', fx: () => { n.met = true; memory(id, '第一次見面'); addFriend(id, 6, 'meet'); } },
        { label: '你的衣服好可愛', fx: () => { n.met = true; memory(id, '第一次見面，稱讚了衣服'); addFriend(id, 9, 'meet'); } },
      ] };
    }
    const lv = friendLevel(n.fr);
    const pool = {
      morning: ['早安～今天也要元氣滿滿！', '早上的空氣最好聞了。'],
      noon: ['中午了，要不要去攤位看看？', '太陽好大，記得休息喔。'],
      dusk: ['黃昏的海好漂亮…', '一天過得好快呀。'],
      night: ['晚安前我都會看一下星星。', '燈亮起來的小島好溫暖。'],
    }[ph];
    const wxLine = { rain: '下雨了，聽雨聲好舒服。', fog: '霧好濃，小心別迷路喔。', cloudy: '雲好多，好像棉花糖。', clear: null }[wx];
    const like = ITEMS()[d.likes[(lv + new Date().getDate()) % d.likes.length]].zh;
    const lines = [pool[(new Date().getHours() + lv) % pool.length]];
    if (wxLine) lines.push(wxLine);
    if (lv >= 1 && !n.liked.length) lines.push(`對了，我最近很想要${like}耶…`);
    if (lv >= 2) lines.push(`${myName}，有你在島上真好！`);
    if (!fresh) return { lines: [['又見面啦！', '嘿嘿～', '今天過得怎樣？'][now % 3]], choices: [] };
    return { lines, choices: [
      { label: '聊聊今天的事', fx: () => { addFriend(id, 3, 'talk'); } },
      { label: lv >= 2 ? '一起散步吧！' : '你喜歡什麼？', fx: () => { addFriend(id, lv >= 2 ? 4 : 2, 'talk'); if (lv < 2 && !n.liked.includes(d.likes[0])) { n.liked.push(d.likes[0]); memory(id, `知道了 ${d.zh} 喜歡${ITEMS()[d.likes[0]].zh}`); } } },
    ] };
  }
  function talked(id) {
    const n = npc(id), fresh = Date.now() - n.lastTalk > 30 * 60000; n.lastTalk = Date.now();
    St.stat('talks'); progress('talk');
    if (fresh) St.needs({ social: has('social') ? 22 : 15, mood: 3 });
  }
  /** give an item → reaction */
  function gift(id, item) {
    if (!St.take(item)) return null;
    const n = npc(id), d = NPCS[id], today = OC.Clock.dayKey();
    if (!n.met) { n.met = true; memory(id, '第一次見面（收到了禮物）'); }
    const repeat = n.lastGift === today + item; n.lastGift = today + item;
    let r;
    if (d.likes.includes(item)) { r = { mood: 'love', line: `哇！是${ITEMS()[item].zh}！我最喜歡了！`, fr: repeat ? 3 : 10 }; if (!n.liked.includes(item)) n.liked.push(item); memory(id, `收到了最喜歡的${ITEMS()[item].zh}`); }
    else if (d.dislikes.includes(item)) r = { mood: 'meh', line: `呃…${ITEMS()[item].zh}嗎？謝謝你的心意…`, fr: 1 };
    else r = { mood: 'ok', line: `謝謝你的${ITEMS()[item].zh}！`, fr: repeat ? 1 : 4 };
    addFriend(id, r.fr, 'gift'); St.stat('gifts'); progress('gift'); St.needs({ social: 8, mood: 4 });
    return r;
  }

  // ---------------- items ----------------
  function eat(id) {
    const it = ITEMS()[id]; if (!it || !it.use) return false;
    if (!St.take(id)) return false;
    const fx = Object.assign({}, it.use); if (has('foodie') && it.kind === 'food') fx.mood = (fx.mood || 0) + 6;
    St.needs(fx); St.stat('eaten'); progress('eat');
    return fx;
  }
  function sell(id, n = 1) { const it = ITEMS()[id]; if (!it || !it.sell || St.count(id) < n) return false; St.take(id, n); St.coins(it.sell * n, 'sell'); St.stat('sold', n); progress('sell', n); return it.sell * n; }
  function buy(id) {
    const it = ITEMS()[id]; if (!it || !it.price) return { ok: false, why: '無法購買' };
    if (it.kind === 'clothing' && St.count(id)) return { ok: false, why: '已經擁有' };
    if (S().coins < it.price) return { ok: false, why: '金幣不夠' };
    St.coins(-it.price, 'buy'); St.add(id, 1, 'buy'); St.stat('bought'); progress('buy');
    return { ok: true };
  }
  function wearOptions(slot) { const base = OC.Style.FREE_WEAR[slot].slice(); for (const [id, it] of Object.entries(ITEMS())) if (it.kind === 'clothing' && it.slot === slot && St.count(id)) base.push(it.val); return base; }

  // ---------------- daily quests ----------------
  const QUEST_POOL = [
    { id: 'shake', zh: '搖果樹', d: '搖一搖島上的果樹', n: 3, reward: 120, ic: 'leaf' },
    { id: 'talk', zh: '和居民聊天', d: '去找栗子或小空說說話', n: 2, reward: 100, ic: 'chat' },
    { id: 'pick', zh: '採集', d: '撿貝殼、摘花或採蘑菇', n: 3, reward: 90, ic: 'sparkle' },
    { id: 'eat', zh: '好好吃飯', d: '吃一樣東西', n: 1, reward: 50, ic: 'apple' },
    { id: 'gift', zh: '送禮物', d: '把東西拖到居民身上送給他', n: 1, reward: 100, ic: 'gift' },
    { id: 'sell', zh: '去攤位賣東西', d: '在晴日雜貨攤賣出物品', n: 2, reward: 60, ic: 'coin' },
    { id: 'place', zh: '佈置小島', d: '放置或移動一件家具', n: 1, reward: 80, ic: 'sofa' },
    { id: 'anim', zh: '創作時間', d: '在工坊存一段逐格動畫', n: 1, reward: 150, ic: 'film' },
    { id: 'visit', zh: '出門走走', d: '搭渡船去苔光森林', n: 1, reward: 100, ic: 'compass' },
  ];
  function todayQuests() {
    const q = S().quests, day = OC.Clock.dayKey();
    if (q.day !== day) { q.day = day; q.done = {}; q.claimed = {}; q.prog = {}; St.touch(); }
    const d = new Date(), seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
    const ids = QUEST_POOL.map((x, i) => [OC.hash(seed + i * 0.37), x]).sort((a, b) => a[0] - b[0]).slice(0, 4).map((x) => x[1]);
    return ids.map((x) => Object.assign({}, x, { prog: Math.min(x.n, (q.prog || {})[x.id] || 0), claimed: !!q.claimed[x.id] }));
  }
  function progress(key, n = 1) {
    const q = S().quests; todayQuests(); q.prog = q.prog || {}; q.prog[key] = (q.prog[key] || 0) + n;
    const def = todayQuests().find((x) => x.id === key);
    if (def && def.prog >= def.n && !q.done[key]) { q.done[key] = 1; St.emit('questDone', def); }
    St.touch('quest'); checkAch();
  }
  function claim(id) {
    const q = S().quests, def = todayQuests().find((x) => x.id === id);
    if (!def || def.prog < def.n || q.claimed[id]) return false;
    q.claimed[id] = 1; St.coins(def.reward, 'quest'); return def.reward;
  }

  // ---------------- achievements ----------------
  const st = () => S().stats;
  const totalFr = () => Object.values(S().npcs).reduce((a, n) => a + n.fr, 0);
  const maxFr = () => Math.max(0, ...Object.values(S().npcs).map((n) => n.fr));
  const COLLECTIBLE = () => Object.keys(ITEMS()).filter((k) => ITEMS()[k].kind !== 'clothing');
  const ACH = [
    { id: 'fruit1', zh: '第一顆果實', d: '搖果樹 1 次', v: () => st().shakes, n: 1 },
    { id: 'orchard', zh: '果園小幫手', d: '搖果樹 20 次', v: () => st().shakes, n: 20 },
    { id: 'chat10', zh: '話匣子', d: '聊天 10 次', v: () => st().talks, n: 10 },
    { id: 'friend', zh: '交到朋友', d: '和任一居民成為「朋友」', v: () => maxFr(), n: LEVELS[2] },
    { id: 'bff', zh: '摯友', d: '和任一居民成為「摯友」', v: () => maxFr(), n: LEVELS[4] },
    { id: 'decor5', zh: '島嶼設計師', d: '佈置家具 5 次', v: () => st().placed, n: 5 },
    { id: 'anim1', zh: '第一段動畫', d: '在工坊存一段逐格動畫', v: () => st().anims, n: 1 },
    { id: 'collect10', zh: '收藏家入門', d: '圖鑑收集 10 種物品', v: () => Object.keys(S().seen).filter((k) => COLLECTIBLE().includes(k)).length, n: 10 },
    { id: 'forest', zh: '森林探險', d: '造訪苔光森林', v: () => (st().visits || {}).forest || 0, n: 1 },
    { id: 'walker', zh: '散步達人', d: '在島上走 3000 步', v: () => Math.floor(st().steps), n: 3000 },
    { id: 'shopper', zh: '常客', d: '在攤位買 5 次東西', v: () => st().bought, n: 5 },
    { id: 'gift5', zh: '送禮高手', d: '送出 5 份禮物', v: () => st().gifts, n: 5 },
  ];
  function checkAch() {
    const a = S().ach;
    for (const x of ACH) if (!a[x.id] && x.v() >= x.n) { a[x.id] = Date.now(); St.touch('ach', x); St.emit('achUnlocked', x); }
  }

  // ---------------- life goals ----------------
  const GOALS = [
    { id: 'designer', zh: '夢想小島', d: '在島上擺放 8 件家具', ic: 'sofa', v: () => S().placed.length, n: 8 },
    { id: 'popular', zh: '島上人氣王', d: '和所有居民的友情合計達到 200', ic: 'heart', v: () => totalFr(), n: 200 },
    { id: 'collector', zh: '圖鑑大師', d: '收集圖鑑中的所有物品', ic: 'book', v: () => Object.keys(S().seen).filter((k) => COLLECTIBLE().includes(k)).length, n: COLLECTIBLE().length },
    { id: 'artist', zh: '動畫創作者', d: '在工坊完成 5 段逐格動畫', ic: 'film', v: () => st().anims, n: 5 },
  ];

  OC.Game = { NEEDS, tickNeeds, moodFace, NPCS, npc, friendLevel, LEVELS, LEVEL_ZH, addFriend, memory, dialogue, talked, gift, eat, sell, buy, wearOptions, QUEST_POOL, todayQuests, progress, claim, ACH, checkAch, GOALS, COLLECTIBLE, has };
})();
