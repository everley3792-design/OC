/* OC Shimeji — Phase 6 content (data only; the engines live in progress / quests / requests / growth / achieve).
 * Everything here is declarative so new quests, requests, aspirations, skill unlocks, achievements and titles
 * can be added without touching engine code. Goal format (shared by quests, requests, aspirations, challenges):
 *   { ev: 'fish', n: 3, w: { place: 'beach', rarity: '>=3', kind: ['fish'] }, distinct: 'item' }
 *   ev        a progress event name (see docs/quests.md: eat drink gift play pet chat talk buy sell fish cook forage
 *             harvest plant water critter pick shake place wear visit act social discover skillUp wish request anim…)
 *   w         filters on the event data; array = one of; '>=3' style = numeric compare; 'oc:self' = the OC that owns the goal
 *   distinct  count different values of this field instead of events
 * Requirements (req) are checked before a quest / request is offered, so nothing asks for locked content.
 */
(function () {
  'use strict';
  const I = () => OC.Style.ITEMS;

  // ======================= quests =======================
  // type: daily | weekly | place | event | hidden ; tag spreads daily picks over different kinds of play
  const Q = (id, type, tag, zh, d, goal, reward, o) => Object.assign({ id, type, tag, zh, d, goal, reward, ic: 'flag' }, o || {});
  const QUESTS = [
    // ---- daily (4 a day, different tags) ----
    Q('d_shake', 'daily', 'nature', '果樹的禮物', '搖一搖果樹 3 次', { ev: 'shake', n: 3 }, { coins: 60 }, { ic: 'leaf' }),
    Q('d_forage', 'daily', 'nature', '森林的點心', '在苔光森林採集 2 次', { ev: 'forage', n: 2, w: { place: 'forest' } }, { coins: 70 }, { ic: 'leaf', req: { open: ['forest'] } }),
    Q('d_shell', 'daily', 'nature', '海邊的寶物', '在星砂海灘撿 2 樣東西', { ev: 'pick', n: 2, w: { place: 'beach' } }, { coins: 70 }, { ic: 'sparkle', req: { open: ['beach'] } }),
    Q('d_feed', 'daily', 'care', '好好吃飯', '餵 OC 吃一樣東西', { ev: 'eat', n: 1, w: { by: 'player' } }, { coins: 50 }, { ic: 'apple' }),
    Q('d_fav', 'daily', 'care', '喜歡的味道', '讓一位 OC 吃到「喜歡」以上的食物', { ev: 'eat', n: 1, w: { lv: '>=1', by: 'player' } }, { coins: 80 }, { ic: 'heart' }),
    Q('d_newtaste', 'daily', 'care', '新口味', '讓 OC 嚐一種第一次吃的食物', { ev: 'eat', n: 1, w: { first: true, by: 'player' } }, { coins: 80 }, { ic: 'apple' }),
    Q('d_gift', 'daily', 'social', '一份心意', '送禮物給 OC 或居民', { ev: 'gift', n: 1 }, { coins: 70 }, { ic: 'gift' }),
    Q('d_play', 'daily', 'care', '玩具時間', '陪 OC 玩一次玩具', { ev: 'play', n: 1 }, { coins: 60 }, { ic: 'play', req: { kinds: ['toy'] } }),
    Q('d_pet', 'daily', 'care', '摸摸頭', '摸摸 OC 的頭 2 次', { ev: 'pet', n: 2 }, { coins: 40 }, { ic: 'paw' }),
    Q('d_chat', 'daily', 'social', '聊聊天', '和 OC 聊天 2 次', { ev: 'chat', n: 2 }, { coins: 50 }, { ic: 'chat' }),
    Q('d_talk', 'daily', 'social', '島上的鄰居', '和居民聊天', { ev: 'talk', n: 1 }, { coins: 50 }, { ic: 'chat' }),
    Q('d_fish', 'daily', 'nature', '今天的魚', '釣到 1 條魚', { ev: 'fish', n: 1 }, { coins: 70 }, { ic: 'sparkle' }),
    Q('d_cook', 'daily', 'make', '今天吃什麼', '做一道料理', { ev: 'cook', n: 1 }, { coins: 80 }, { ic: 'apple' }),
    Q('d_garden', 'daily', 'nature', '菜園日記', '在菜園播種或澆水', { ev: ['plant', 'water'], n: 1 }, { coins: 50 }, { ic: 'leaf' }),
    Q('d_street', 'daily', 'shop', '逛街', '在商店街的店裡買一樣東西', { ev: 'buy', n: 1, w: { shop: ['food', 'clothes', 'furniture', 'gift', 'market'] } }, { coins: 50 }, { ic: 'cart', req: { open: ['street'] } }),
    Q('d_sell', 'daily', 'shop', '整理背包', '賣出 2 件東西', { ev: 'sell', n: 2 }, { coins: 40 }, { ic: 'coin' }),
    Q('d_place', 'daily', 'make', '換個擺設', '佈置一件家具', { ev: 'place', n: 1 }, { coins: 60 }, { ic: 'sofa' }),
    Q('d_visit', 'daily', 'explore', '出門走走', '去 2 個不同的地方', { ev: 'visit', n: 2, distinct: 'place' }, { coins: 60 }, { ic: 'compass' }),
    Q('d_critter', 'daily', 'explore', '小小的鄰居', '觀察到一隻小生物', { ev: 'critter', n: 1 }, { coins: 70 }, { ic: 'leaf' }),
    Q('d_read', 'daily', 'growth', '書香', '讓 OC 讀一次書', { ev: 'act', n: 1, w: { act: ['read', 'study'] } }, { coins: 50 }, { ic: 'book' }),
    Q('d_joint', 'daily', 'social', '好朋友', 'OC 之間完成一次聊天或共同活動', { ev: 'social', n: 1 }, { coins: 50 }, { ic: 'users', req: { chars: 2 } }),
    Q('d_wear', 'daily', 'make', '今天穿什麼', '幫 OC 換一件衣服或飾品', { ev: 'wear', n: 1 }, { coins: 50 }, { ic: 'shirt', req: { kinds: ['clothing'] } }),
    Q('d_cafe', 'daily', 'shop', '咖啡時光', '在雲朵咖啡館點一份餐點', { ev: 'buy', n: 1, w: { shop: 'cafe' } }, { coins: 60 }, { ic: 'apple', req: { open: ['cafe'] } }),
    Q('d_anim', 'daily', 'make', '創作時間', '在工坊存一段逐格動畫', { ev: 'anim', n: 1 }, { coins: 100 }, { ic: 'film', weight: 0.4 }),
    // ---- weekly (3 a week) ----
    Q('w_fish', 'weekly', 'nature', '魚類觀察家', '釣到 3 種不同的魚', { ev: 'fish', n: 3, distinct: 'item' }, { coins: 300, items: { seed_straw: 2 } }, { ic: 'sparkle' }),
    Q('w_cook', 'weekly', 'make', '一週食譜', '做出 3 種不同的料理', { ev: 'cook', n: 3, distinct: 'item' }, { coins: 320, items: { honey: 1 } }, { ic: 'apple' }),
    Q('w_places', 'weekly', 'explore', '小旅行', '走訪 4 個不同的地點', { ev: 'visit', n: 4, distinct: 'place' }, { coins: 260 }, { ic: 'compass' }),
    Q('w_gift', 'weekly', 'social', '送禮週', '送出 5 份禮物', { ev: 'gift', n: 5 }, { coins: 280, items: { letter: 1 } }, { ic: 'gift' }),
    Q('w_harvest', 'weekly', 'nature', '豐收', '收成 3 次', { ev: 'harvest', n: 3 }, { coins: 300, items: { seed_sun: 1 } }, { ic: 'leaf' }),
    Q('w_tastes', 'weekly', 'care', '美食家的一週', '讓 OC 們嚐 4 種新食物', { ev: 'eat', n: 4, w: { first: true }, distinct: 'item' }, { coins: 300 }, { ic: 'heart' }),
    Q('w_social', 'weekly', 'social', '熱鬧的一週', 'OC 之間完成 6 次聊天或共同活動', { ev: 'social', n: 6 }, { coins: 240 }, { ic: 'users', req: { chars: 2 } }),
    Q('w_discover', 'weekly', 'explore', '新發現', '新發現 5 種物品', { ev: 'discover', n: 5 }, { coins: 280 }, { ic: 'book' }),
    Q('w_requests', 'weekly', 'care', '貼心的你', '完成 2 個 OC 的請求', { ev: 'request', n: 2 }, { coins: 300 }, { ic: 'heart' }),
    Q('w_star', 'weekly', 'make', '完美的一盤', '做出一道三星料理', { ev: 'cook', n: 1, w: { stars: 3 } }, { coins: 300, items: { sugar: 2 } }, { ic: 'sparkle' }),
    // ---- place quests (one per visited place per day; only places that are open) ----
    Q('p_isle_flower', 'place', 'isle', '花圃的顏色', '在晴日島摘 2 朵花', { ev: 'pick', n: 2, w: { place: 'isle', item: 'flower' } }, { coins: 50 }, { ic: 'leaf', place: 'isle' }),
    Q('p_isle_pier', 'place', 'isle', '碼頭的午後', '在晴日島碼頭釣魚', { ev: 'fish', n: 1, w: { place: 'isle' } }, { coins: 60 }, { ic: 'sparkle', place: 'isle' }),
    Q('p_forest_pond', 'place', 'forest', '池塘的倒影', '在苔光森林的池塘釣魚', { ev: 'fish', n: 1, w: { place: 'forest' } }, { coins: 70 }, { ic: 'sparkle', place: 'forest' }),
    Q('p_forest_bug', 'place', 'forest', '森林的小生命', '在苔光森林觀察小生物', { ev: 'critter', n: 1, w: { place: 'forest' } }, { coins: 70 }, { ic: 'leaf', place: 'forest' }),
    Q('p_beach_fish', 'place', 'beach', '海風與魚線', '在星砂海灘釣 2 條魚', { ev: 'fish', n: 2, w: { place: 'beach' } }, { coins: 80 }, { ic: 'sparkle', place: 'beach' }),
    Q('p_beach_crab', 'place', 'beach', '橫著走的朋友', '在海灘觀察螃蟹', { ev: 'critter', n: 1, w: { place: 'beach' } }, { coins: 70 }, { ic: 'leaf', place: 'beach' }),
    Q('p_street_market', 'place', 'street', '市場的新鮮貨', '在每日市場買一樣東西', { ev: 'buy', n: 1, w: { shop: 'market' } }, { coins: 50 }, { ic: 'cart', place: 'street' }),
    Q('p_street_lib', 'place', 'street', '圖書館之旅', '讓一位 OC 在葉影圖書館讀書', { ev: 'act', n: 1, w: { act: ['read', 'study'], place: 'library' } }, { coins: 80 }, { ic: 'book', place: 'street', req: { open: ['library'] } }),
    Q('p_home_cook', 'place', 'home', '家的味道', '在家裡的小廚房做料理', { ev: 'cook', n: 1, w: { place: 'home' } }, { coins: 70 }, { ic: 'apple', place: 'home' }),
    // ---- event quests (only while the condition holds; gone at the end of the day, no penalty) ----
    Q('e_rain_cafe', 'event', 'weather', '雨天的熱飲', '下雨天在咖啡館點一杯熱飲', { ev: 'buy', n: 1, w: { shop: 'cafe', temp: 'hot' } }, { coins: 90 }, { ic: 'apple', when: { wx: 'rain' }, req: { open: ['cafe'] } }),
    Q('e_rain_snail', 'event', 'weather', '雨中的散步者', '下雨天在森林找到雨天蝸牛', { ev: 'critter', n: 1, w: { item: 'b_snail' } }, { coins: 110 }, { ic: 'leaf', when: { wx: 'rain' } }),
    Q('e_night_jelly', 'event', 'time', '月光下的海', '晚上在海灘釣到月光水母', { ev: 'fish', n: 1, w: { item: 'f_moonjelly' } }, { coins: 160 }, { ic: 'moon', when: { phase: 'night' } }),
    Q('e_night_firefly', 'event', 'time', '螢火蟲之夜', '晚上在森林看到螢火蟲', { ev: 'critter', n: 1, w: { item: 'b_firefly' } }, { coins: 120 }, { ic: 'moon', when: { phase: 'night' } }),
    Q('e_dusk_beach', 'event', 'time', '一起看夕陽', '黃昏時去星砂海灘', { ev: 'visit', n: 1, w: { place: 'beach' } }, { coins: 80 }, { ic: 'sunset', when: { phase: 'dusk' } }),
    // ---- hidden (not listed until found; one time) ----
    Q('h_legend', 'hidden', 'secret', '傳說的魚', '釣到稀有度「珍貴」以上的魚', { ev: 'fish', n: 1, w: { rarity: '>=4' } }, { coins: 400, title: 'angler_legend' }, { ic: 'star', hint: '有些魚只在特別的時間出現…' }),
    Q('h_feast', 'hidden', 'secret', '三人份的幸福', '同一天讓 3 位不同的 OC 吃到最愛的食物', { ev: 'eat', n: 3, w: { lv: 2 }, distinct: 'oc', day: true }, { coins: 300, items: { cake: 2 } }, { ic: 'heart', hint: '大家的最愛都不一樣。', req: { chars: 3 } }),
    Q('h_allplaces', 'hidden', 'secret', '一日環島', '同一天走遍所有開放的地點', { ev: 'visit', n: 7, distinct: 'place', day: true }, { coins: 350, title: 'wanderer' }, { ic: 'compass', hint: '今天走得特別遠…' }),
    Q('h_perfect3', 'hidden', 'secret', '料理之星', '做出 3 道三星料理', { ev: 'cook', n: 3, w: { stars: 3 } }, { coins: 300, items: { souv_ladle: 1 } }, { ic: 'sparkle', hint: '火候是關鍵。' }),
    Q('h_midnight', 'hidden', 'secret', '午夜的海', '在深夜去星砂海灘', { ev: 'visit', n: 1, w: { place: 'beach', hour: '>=23' } }, { coins: 150 }, { ic: 'moon', hint: '大家都睡了以後…' }),
  ];
  // long challenges: tiers unlock one after another (counted from when the tier appears)
  const CHALLENGES = [
    { id: 'c_fish', zh: '釣魚之路', ic: 'sparkle', goal: { ev: 'fish' }, tiers: [[10, { coins: 250 }], [30, { coins: 500, items: { souv_trophy_fish: 1 } }], [80, { coins: 900, title: 'angler' }]] },
    { id: 'c_cook', zh: '料理之路', ic: 'apple', goal: { ev: 'cook' }, tiers: [[5, { coins: 200 }], [20, { coins: 450, items: { souv_ladle: 1 } }], [50, { coins: 900, title: 'chef' }]] },
    { id: 'c_garden', zh: '菜園之路', ic: 'leaf', goal: { ev: 'harvest' }, tiers: [[5, { coins: 220 }], [20, { coins: 480, items: { souv_can: 1 } }], [50, { coins: 900, title: 'gardener' }]] },
    { id: 'c_discover', zh: '發現之路', ic: 'book', goal: { ev: 'discover' }, tiers: [[20, { coins: 250 }], [45, { coins: 500, items: { souv_globe: 1 } }], [80, { coins: 900, title: 'collector' }]] },
    { id: 'c_requests', zh: '貼心之路', ic: 'heart', goal: { ev: 'request' }, tiers: [[3, { coins: 200 }], [10, { coins: 450, items: { souv_frame: 1 } }], [25, { coins: 900, title: 'kindheart' }]] },
    { id: 'c_social', zh: '友情之路', ic: 'users', goal: { ev: 'social' }, tiers: [[10, { coins: 200 }], [40, { coins: 450, items: { souv_badge: 1 } }], [100, { coins: 800, title: 'socialstar' }]] },
  ];

  // ======================= character requests (Tomodachi-style) =======================
  // pick(c) → data or null (null = this request does not fit right now). goal uses 'oc:self'.
  // help: a button the player can press to move things along. after: what happens next time (follow-ups)
  const foods = () => Object.keys(I()).filter((id) => OC.Items.isFood(id) && !I()[id].custom && I()[id].price);
  const owned = (k) => Object.keys(OC.Store.s.inv).filter((id) => I()[id] && I()[id].kind === k && OC.Store.count(id) > 0);
  const REQUESTS = {
    taste: { zh: '想吃{item}', ic: 'apple', w: (c) => (OC.Chars.has(c, 'foodie') ? 2.2 : 1) * (c.needs.food < 60 ? 1.5 : 0.8),
      pick: (c) => { const t = OC.Taste.prefs(c), fav = foods().filter((id) => OC.Taste.pref(c, id).lv >= 1); const fresh = foods().filter((id) => !t.tasted[id]); const pool = fav.length && Math.random() < 0.6 ? fav : fresh.length ? fresh : foods(); return pool.length ? { item: OC.Sim.pick(pool) } : null; },
      goal: { ev: 'eat', n: 1, w: { oc: 'self', item: '{item}', by: 'player' } }, reward: { coins: 70 }, life: 1440, perf: 'taste' },
    sweet: { zh: '想吃點甜的', ic: 'apple', w: (c) => (OC.Taste.prefs(c).flavor.sweet > 0 ? 1.4 : 0.5),
      pick: () => ({}), goal: { ev: 'eat', n: 1, w: { oc: 'self', flavor: 'sweet', by: 'player' } }, reward: { coins: 60 }, life: 1440, perf: 'taste' },
    toy: { zh: '想玩{item}', ic: 'play', w: (c) => (c.personality.energy > 55 ? 1.5 : 0.7) * (c.needs.fun < 50 ? 1.4 : 1),
      pick: (c) => { const toys = Object.keys(I()).filter((id) => I()[id].kind === 'toy' && I()[id].price); const fresh = toys.filter((id) => !(c.life.toyDay && c.life.toyDay[id])); const p = fresh.length ? fresh : toys; return p.length ? { item: OC.Sim.pick(p) } : null; },
      goal: { ev: 'play', n: 1, w: { oc: 'self', item: '{item}' } }, reward: { coins: 60 }, life: 1440, perf: 'play' },
    shell: { zh: '想要海邊的寶物', ic: 'gift', w: (c) => (OC.Chars.has(c, 'curious') || OC.Chars.has(c, 'nature') ? 1.4 : 0.6),
      pick: () => (OC.Places.open('beach') ? {} : null), goal: { ev: 'gift', n: 1, w: { oc: 'self', kind: 'sea' } }, reward: { coins: 80 }, life: 2880, perf: 'gift' },
    flower: { zh: '想要一朵花', ic: 'gift', w: (c) => (OC.Chars.has(c, 'gentle') || OC.Chars.has(c, 'artsy') ? 1.4 : 0.6),
      pick: () => ({}), goal: { ev: 'gift', n: 1, w: { oc: 'self', item: ['flower', 'sunflower'] } }, reward: { coins: 60 }, life: 2880, perf: 'gift' },
    meet: { zh: '想認識{other}', ic: 'users', w: (c) => (c.personality.social > 55 ? 1.5 : OC.Chars.has(c, 'shy') ? 0.9 : 0.8),
      pick: (c) => { const o = OC.Chars.all().filter((x) => x.id !== c.id && x.status.onIsland && OC.Mind.rel(c.id, x.id).fam < 8); return o.length ? { other: OC.Sim.pick(o).id } : null; },
      goal: { ev: 'social', n: 1, w: { oc: 'self', other: '{other}' } }, reward: { coins: 80 }, life: 2880, perf: 'social', help: 'introduce' },
    visit: { zh: '想去{place}看看', ic: 'compass', w: (c) => (OC.Chars.has(c, 'curious') ? 1.8 : 0.8),
      pick: (c) => { const open = OC.Places.list().filter((p) => OC.Places.open(p) && p !== (c.life.loc || 'isle')); const fresh = open.filter((p) => !(c.life.places && c.life.places[p])); const pool = fresh.length ? fresh : open.filter((p) => OC.Places.affinity(c, p) > 0.1); return pool.length ? { place: OC.Sim.pick(pool) } : null; },
      goal: { ev: 'arrive', n: 1, w: { oc: 'self', place: '{place}' } }, reward: { coins: 90 }, life: 2880, perf: 'arrive', help: 'go' },
    learn: { zh: '想學點新東西', ic: 'book', w: (c) => (OC.Chars.has(c, 'bookworm') || c.personality.thinking > 60 ? 1.6 : 0.5),
      pick: () => (OC.Places.open('library') ? { place: 'library' } : null), goal: { ev: 'act', n: 1, w: { oc: 'self', act: ['read', 'study'], place: 'library' } }, reward: { coins: 90 }, life: 2880, perf: 'proud', help: 'go' },
    rest: { zh: '想好好睡個午覺', ic: 'sleep', w: (c) => (c.needs.energy < 40 ? 2 : 0.3) * (OC.Chars.has(c, 'sleepy') || OC.Chars.has(c, 'lazy') ? 1.6 : 1),
      pick: () => ({}), goal: { ev: 'act', n: 1, w: { oc: 'self', act: ['nap', 'sleep'] } }, reward: { coins: 50 }, life: 720, perf: 'rest', help: 'nap' },
    outfit: { zh: '想換個新造型', ic: 'shirt', w: (c) => (OC.Chars.has(c, 'artsy') || OC.Chars.has(c, 'creative') ? 1.5 : 0.5),
      pick: () => (owned('clothing').length || OC.Places.open('street') ? {} : null), goal: { ev: 'wear', n: 1, w: { oc: 'self' } }, reward: { coins: 60 }, life: 2880, perf: 'proud' },
    together: { zh: '想和你一起釣魚', ic: 'sparkle', w: (c) => (OC.Chars.has(c, 'nature') || c.personality.energy < 50 ? 1.2 : 0.6),
      pick: () => ({}), goal: { ev: 'fish', n: 1, w: { near: 'self' } }, reward: { coins: 80 }, life: 2880, perf: 'cheer' },
    lost: { zh: '弄丟了{item}', ic: 'gift', w: () => 0.6,
      pick: () => { const pool = ['acorn', 'shell', 'ball', 'flower', 'berry'].filter((id) => I()[id]); return { item: OC.Sim.pick(pool) }; },
      goal: { ev: 'gift', n: 1, w: { oc: 'self', item: '{item}' } }, reward: { coins: 70 }, life: 2880, perf: 'gift' },
  };
  // follow-ups: after a request is done, sometimes a related one comes back later (story)
  const FOLLOWUPS = { taste: ['sweet', 'together'], meet: ['together'], visit: ['learn', 'shell'], toy: ['meet'], learn: ['learn'], lost: ['shell'] };

  // ======================= skills: what each level actually unlocks =======================
  // Effects are read by the systems through OC.Growth.has(c, unlockId) / OC.Growth.bonus(c, key)
  const SKILLS = {
    reading: { zh: '閱讀', ic: 'book', acts: ['read', 'study'], unlocks: [[1, 'study', '能在書桌專心讀書（讀書活動）'], [2, 'teach', '會把讀到的知識教給朋友（社交「分享知識」）'], [4, 'bookfriend', '讀書時心情更好，聊天會提到書']] },
    garden: { zh: '園藝', ic: 'leaf', acts: ['tend', 'forage'], unlocks: [[1, 'harvest_plus', '收成時多 1 個'], [3, 'fast_grow', '菜園長得快 25%'], [5, 'sun_seed', '偶爾帶回向日葵種子']] },
    sport: { zh: '運動', ic: 'walk', acts: ['play', 'stretch', 'walk'], unlocks: [[1, 'trick', '玩耍時會翻跟斗（新動作）'], [3, 'stamina', '精力下降變慢']] },
    cook: { zh: '料理', ic: 'apple', acts: ['cook'], unlocks: [[1, 'recipe_t1', '學會鬆餅、布丁'], [2, 'recipe_t2', '學會咖哩、水果塔'], [3, 'recipe_t3', '學會烤魚'], [4, 'steady', '料理的刀子變慢、火候區變寬']] },
    social: { zh: '社交', ic: 'users', acts: [], unlocks: [[2, 'charm', '邀請更容易被接受'], [4, 'host', '共同活動時大家更開心']] },
    fishing: { zh: '釣魚', ic: 'sparkle', acts: ['fish'], unlocks: [[1, 'steady_reel', '收線區變寬'], [3, 'rare_bait', '稀有魚機率提升'], [5, 'double', '偶爾一次釣到兩條']] },
    explore: { zh: '探索', ic: 'compass', acts: ['explore', 'forage'], unlocks: [[1, 'keen_eye', '採集時偶爾多找到一個'], [3, 'quiet_steps', '觀察小生物時牠們比較不會警覺']] },
    art: { zh: '藝術', ic: 'brush', acts: ['sketch'], unlocks: [[1, 'sketch', '會在風景好的地方畫素描（新活動）'], [3, 'gift_art', '偶爾把畫好的作品送給你']] },
    music: { zh: '音樂', ic: 'music', acts: ['sing'], unlocks: [[1, 'sing', '心情好時會唱歌（新活動）'], [3, 'chorus', '唱歌時附近的 OC 心情變好']] },
  };

  // ======================= aspirations (long-term life goals of each OC) =======================
  // fit(c) = how much this OC would want it (0 = never). steps are in order; each has a goal.
  const has = (c, t) => OC.Chars.has(c, t);
  const ASPIRATIONS = {
    green_thumb: { zh: '綠手指', d: '想把菜園照顧得很好，種出漂亮的花。', ic: 'leaf', acts: ['tend', 'forage'], fit: (c) => (has(c, 'nature') ? 2 : 0.5) + (has(c, 'diligent') ? 0.5 : 0),
      steps: [{ zh: '照顧菜園或花草 4 次', goal: { ev: 'act', n: 4, w: { oc: 'self', act: 'tend' } } }, { zh: '一起收成 3 次', goal: { ev: 'harvest', n: 3 } }, { zh: '種出向日葵', goal: { ev: 'harvest', n: 1, w: { item: 'sunflower' } } }],
      reward: { coins: 500, items: { souv_can: 1 }, title: 'gardener' } },
    home_chef: { zh: '家常料理人', d: '想學會很多道料理，做出完美的一盤。', ic: 'apple', acts: ['cook', 'eat'], fit: (c) => (has(c, 'foodie') ? 2 : 0.4) + (has(c, 'creative') ? 0.4 : 0),
      steps: [{ zh: '品嚐 5 種不同的食物', goal: { ev: 'eat', n: 5, w: { oc: 'self' }, distinct: 'item' } }, { zh: '做出 3 種不同的料理', goal: { ev: 'cook', n: 3, distinct: 'item' } }, { zh: '做出一道三星料理', goal: { ev: 'cook', n: 1, w: { stars: 3 } } }],
      reward: { coins: 500, items: { souv_ladle: 1 }, title: 'chef' } },
    angler: { zh: '釣魚達人', d: '想釣到各種各樣的魚，甚至是傳說中的那條。', ic: 'sparkle', acts: ['fish'], fit: (c) => (has(c, 'nature') ? 1 : 0.4) + (c.personality.energy < 50 ? 0.6 : 0.2) + (has(c, 'diligent') ? 0.4 : 0),
      steps: [{ zh: '釣到 4 條魚', goal: { ev: 'fish', n: 4 } }, { zh: '釣到 4 種不同的魚', goal: { ev: 'fish', n: 4, distinct: 'item' } }, { zh: '釣到稀有的魚', goal: { ev: 'fish', n: 1, w: { rarity: '>=3' } } }],
      reward: { coins: 600, items: { souv_trophy_fish: 1 }, title: 'angler' } },
    bookworm: { zh: '書蟲', d: '想讀完很多書，成為大家口中的博學小幫手。', ic: 'book', acts: ['read', 'study'], fit: (c) => (has(c, 'bookworm') ? 2.2 : 0.3) + (c.personality.thinking > 60 ? 0.6 : 0),
      steps: [{ zh: '讀書 5 次', goal: { ev: 'act', n: 5, w: { oc: 'self', act: ['read', 'study'] } } }, { zh: '在圖書館讀書 2 次', goal: { ev: 'act', n: 2, w: { oc: 'self', act: ['read', 'study'], place: 'library' } } }, { zh: '閱讀技能到 Lv.3', goal: { ev: 'skillUp', n: 1, w: { oc: 'self', skill: 'reading', lv: '>=3' } } }],
      reward: { coins: 500, items: { souv_globe: 1 }, title: 'scholar' } },
    social_star: { zh: '人氣王', d: '想和島上每個人都成為朋友。', ic: 'users', acts: [], fit: (c) => (c.personality.social > 60 ? 1.8 : 0.3) + (has(c, 'outgoing') || has(c, 'social') ? 0.8 : 0) - (has(c, 'shy') ? 0.2 : 0),
      steps: [{ zh: '和大家聊天或一起玩 6 次', goal: { ev: 'social', n: 6, w: { oc: 'self' } } }, { zh: '交到一位朋友', goal: { ev: 'rel', n: 1, w: { oc: 'self', to: ['friend', 'bestfriend'] } } }, { zh: '交到一位摯友', goal: { ev: 'rel', n: 1, w: { oc: 'self', to: 'bestfriend' } } }],
      reward: { coins: 600, items: { souv_badge: 1 }, title: 'socialstar' } },
    explorer: { zh: '小小探險家', d: '想去所有地方看看，發現沒見過的東西。', ic: 'compass', acts: ['explore', 'forage', 'observe'], fit: (c) => (has(c, 'curious') ? 2 : 0.4) + (c.personality.energy > 60 ? 0.5 : 0),
      steps: [{ zh: '去 3 個不同的地方', goal: { ev: 'arrive', n: 3, w: { oc: 'self' }, distinct: 'place' } }, { zh: '新發現 8 種物品', goal: { ev: 'discover', n: 8 } }, { zh: '走遍所有開放的地點', goal: { ev: 'arrive', n: 7, w: { oc: 'self' }, distinct: 'place' } }],
      reward: { coins: 600, items: { souv_globe: 1 }, title: 'wanderer' } },
    artist: { zh: '生活藝術家', d: '想用畫和歌把每天的美好留下來。', ic: 'brush', acts: ['sketch', 'sing', 'observe'], fit: (c) => (has(c, 'artsy') ? 2 : 0.3) + (has(c, 'creative') ? 1 : 0),
      steps: [{ zh: '畫素描或唱歌 3 次', goal: { ev: 'act', n: 3, w: { oc: 'self', act: ['sketch', 'sing'] } } }, { zh: '看風景 3 次', goal: { ev: 'act', n: 3, w: { oc: 'self', act: 'observe' } } }, { zh: '藝術或音樂技能到 Lv.2', goal: { ev: 'skillUp', n: 1, w: { oc: 'self', skill: ['art', 'music'], lv: '>=2' } } }],
      reward: { coins: 500, items: { souv_frame: 1 }, title: 'artist' } },
  };

  // ======================= titles =======================
  const TITLES = {
    newbie: '島上新鮮人', angler: '釣魚達人', angler_legend: '傳說的釣手', chef: '小廚神', gardener: '綠手指', collector: '收藏家',
    kindheart: '貼心小天使', socialstar: '人氣王', wanderer: '旅行家', scholar: '博學小書蟲', artist: '生活藝術家', designer: '佈置大師', storyteller: '故事收藏家',
  };

  // ======================= achievements =======================
  // cat: life social explore collect skill create special ; v(): current value from real records ; hidden: shown as ？？？ until done
  const C = () => OC.Progress, st = () => OC.Store.s.stats;
  /** best friendship on the resident scale: resident friendship points, or an OC↔OC relationship mapped onto the same levels */
  const friendScore = () => { const L = OC.Game.LEVELS, npc = Math.max(0, ...Object.values(OC.Store.s.npcs).map((n) => n.fr)); let oc = 0; for (const r of Object.values(OC.Store.s.life.rel || {})) { const t = r.type; if (t === 'bestfriend' || t === 'lover' || t === 'partner') oc = Math.max(oc, L[4]); else if (t === 'friend') oc = Math.max(oc, L[2]); } return Math.max(npc, oc); };
  const maxSkill = () => Math.max(0, ...OC.Chars.all().flatMap((c) => Object.keys(SKILLS).map((k) => OC.Mind.skillLv(c, k))));
  const relCount = (t) => Object.values(OC.Store.s.life.rel).filter((r) => [].concat(t).includes(r.type)).length / 2;
  const A = (id, cat, zh, d, v, n, reward, o) => Object.assign({ id, cat, zh, d, v, n, reward: reward || { coins: 150 } }, o || {});
  const ACH = [
    // life (legacy ids kept so old unlocks stay unlocked)
    A('fruit1', 'life', '第一顆果實', '搖果樹 1 次', () => st().shakes, 1, { coins: 50 }),
    A('orchard', 'life', '果園小幫手', '搖果樹 20 次', () => st().shakes, 20),
    A('walker', 'life', '散步達人', '在島上走 3000 步', () => Math.floor(st().steps), 3000),
    A('feed10', 'life', '餵食小幫手', '餵 OC 吃 10 次', () => C().count('eat', { by: 'player' }), 10),
    A('fav5', 'life', '懂你的胃', '讓 OC 吃到最愛的食物 5 次', () => C().count('eat', { lv: 2 }), 5, { coins: 200, items: { cake: 1 } }),
    A('nap10', 'life', '好好休息', 'OC 們睡了 10 次午覺或好覺', () => C().count('act', { act: ['nap', 'sleep'] }), 10),
    // social
    A('chat10', 'social', '話匣子', '和居民聊天 10 次', () => st().talks, 10),
    // 8.0: residents are optional → friendships between the player's own OCs count too (same thresholds)
    A('friend', 'social', '交到朋友', '任兩位 OC（或 OC 和居民）成為「朋友」', () => friendScore(2), OC.Game.LEVELS[2]),
    A('bff', 'social', '摯友', '任兩位 OC（或 OC 和居民）成為「摯友」', () => friendScore(4), OC.Game.LEVELS[4], { coins: 300 }),
    A('gift5', 'social', '送禮高手', '送出 5 份禮物', () => st().gifts, 5),
    A('ocfriends', 'social', '好朋友誕生', '兩位 OC 成為朋友', () => relCount(['friend', 'bestfriend']), 1, { coins: 200, items: { souv_badge: 1 } }),
    A('ocbff', 'social', '最好的朋友', '兩位 OC 成為摯友', () => relCount('bestfriend'), 1, { coins: 400, title: 'socialstar' }),
    A('req1', 'social', '有求必應', '完成第一個 OC 的請求', () => C().count('request'), 1, { coins: 100 }),
    A('req10', 'social', '貼心小天使', '完成 10 個 OC 的請求', () => C().count('request'), 10, { coins: 400, title: 'kindheart' }),
    // explore
    A('forest', 'explore', '森林探險', '造訪苔光森林', () => (st().visits || {}).forest || 0, 1),
    A('allplaces', 'explore', '環島旅行', '造訪所有開放的地點', () => Object.keys(OC.Store.s.places.visited).filter((p) => OC.Places.open(p)).length, 7, { coins: 400, title: 'wanderer' }),
    A('critter10', 'explore', '小生物朋友', '觀察到 10 隻小生物', () => C().count('critter'), 10),
    A('nightbeach', 'explore', '夜晚的海', '晚上去星砂海灘', () => C().count('visit', { place: 'beach', phase: 'night' }), 1, { coins: 120 }, { hidden: true, hint: '月亮出來以後的海邊…' }),
    // collect
    A('collect10', 'collect', '收藏家入門', '圖鑑收集 10 種物品', () => OC.Progress.discovered(), 10),
    A('collect40', 'collect', '收藏家', '圖鑑收集 40 種物品', () => OC.Progress.discovered(), 40, { coins: 400, items: { souv_globe: 1 } }),
    A('fish6', 'collect', '魚類圖鑑', '釣到 6 種不同的魚', () => C().distinct('fish', 'item'), 6, { coins: 300 }),
    A('bug5', 'collect', '昆蟲圖鑑', '觀察到 5 種小生物', () => C().distinct('critter', 'item'), 5, { coins: 300 }),
    A('taste15', 'collect', '美食評論家', 'OC 們品嚐過 15 種食物', () => OC.Progress.tastedAll(), 15, { coins: 300, title: 'collector' }),
    // skill
    A('skill3', 'skill', '小有所成', '任一 OC 的任一技能到 Lv.3', maxSkill, 3, { coins: 300 }),
    A('skill5', 'skill', '專家', '任一 OC 的任一技能到 Lv.5', maxSkill, 5, { coins: 600 }),
    A('cook1', 'skill', '第一盤料理', '做出第一道料理', () => C().count('cook'), 1, { coins: 100 }),
    A('star3', 'skill', '三顆星', '做出三星料理', () => C().count('cook', { stars: 3 }), 1, { coins: 200 }),
    A('harvest1', 'skill', '第一次收成', '在菜園收成', () => C().count('harvest'), 1, { coins: 100 }),
    A('asp1', 'skill', '夢想成真', '一位 OC 完成人生目標', () => C().count('aspiration'), 1, { coins: 500 }),
    // create
    A('anim1', 'create', '第一段動畫', '在工坊存一段逐格動畫', () => st().anims, 1),
    A('decor5', 'create', '島嶼設計師', '佈置家具 5 次', () => st().placed, 5),
    A('decor20', 'create', '佈置大師', '佈置家具 20 次', () => st().placed, 20, { coins: 400, title: 'designer' }),
    A('product1', 'create', '小小工坊', '上架一件工坊商品', () => Object.keys((OC.Store.s.custom || {}).items || {}).length, 1, { coins: 150 }),
    A('shopper', 'create', '常客', '在商店買 5 次東西', () => st().bought, 5),
    // special (hidden)
    A('hate1', 'special', '對不起啦', '讓 OC 吃到討厭的食物', () => C().count('eat', { lv: -2 }), 1, { coins: 50 }, { hidden: true, hint: '不是每個人都喜歡同樣的東西。' }),
    A('rainread', 'special', '雨天的書', 'OC 在下雨天讀書', () => C().count('act', { act: ['read', 'study'], wx: 'rain' }), 1, { coins: 120 }, { hidden: true, hint: '雨聲很適合…' }),
    A('memories30', 'special', '回憶滿滿', 'OC 們累積 30 則重要回憶', () => OC.Chars.all().reduce((n, c) => n + c.life.mem.long.length + c.life.mem.recent.filter((m) => m.imp >= 0.5).length, 0), 30, { coins: 300, title: 'storyteller' }, { hidden: true, hint: '一起生活久了就會…' }),
  ];

  // ======================= souvenirs (rewards only — never sold) =======================
  const SOUV = {
    souv_trophy_fish: ['金魚獎盃', '釣魚之路的紀念獎盃。', { t: 'trophy', a: '#FFC93C', b: '#5BC0EB' }, 4],
    souv_ladle: ['金湯杓', '料理之路的紀念品。擺在廚房很有架勢。', { t: 'ladle', a: '#FFC93C' }, 3],
    souv_can: ['金色澆水壺', '照顧菜園的紀念品。', { t: 'goldcan', a: '#FFC93C' }, 3],
    souv_globe: ['探險地球儀', '走遍各地的紀念品。', { t: 'globe', a: '#5BC0EB', b: '#6CCB5F' }, 3],
    souv_frame: ['回憶相框', '貼心之路的紀念品。可以掛在牆上。', { t: 'frame', a: '#F26B7A' }, 3, true],
    souv_badge: ['友情徽章', '友情之路的紀念品。可以掛在牆上。', { t: 'badge', a: '#9B7BE0', b: '#FFC93C' }, 3, true],
  };
  for (const [id, [zh, d, art, rarity, wall]] of Object.entries(SOUV)) I()[id] = { zh, kind: 'furniture', d, art, rarity, tags: ['souvenir'], src: ['成就與挑戰獎勵'], fp: [1, 1], wall: !!wall, verbs: ['view'], sell: 0, souvenir: true };

  // original icons for the souvenirs (24-unit box)
  const AR = OC.ItemArt, V = OC.V, mix = OC.mix, TAU = Math.PI * 2;
  const Mt = (base) => ({ mode: 'flat', base, shade: mix(base, '#3a2030', 0.25), dx: 1.2, dy: 1.4 });
  const P = (c, fn, col) => V.paint(c, fn, Mt(col));
  Object.assign(AR, {
    trophy(c, a, b) { P(c, (ox, oy) => { c.beginPath(); c.moveTo(6 + ox, 4 + oy); c.lineTo(18 + ox, 4 + oy); c.quadraticCurveTo(18 + ox, 14 + oy, 12 + ox, 14 + oy); c.quadraticCurveTo(6 + ox, 14 + oy, 6 + ox, 4 + oy); }, a); P(c, (ox, oy) => OC.rr(c, 10.5 + ox, 14 + oy, 3, 4, 1), a); P(c, (ox, oy) => OC.rr(c, 7 + ox, 18 + oy, 10, 3, 1.2), '#B07E4B'); c.fillStyle = b; c.beginPath(); c.ellipse(12, 8.5, 2.6, 1.6, 0, 0, TAU); c.fill(); c.strokeStyle = mix(a, '#a07020', 0.3); c.lineWidth = 1.2; c.beginPath(); c.arc(5.5, 8, 2.4, Math.PI * 0.5, Math.PI * 1.5); c.stroke(); c.beginPath(); c.arc(18.5, 8, 2.4, -Math.PI * 0.5, Math.PI * 0.5); c.stroke(); },
    ladle(c, a) { c.strokeStyle = mix(a, '#a07020', 0.25); c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(16, 4); c.lineTo(11, 15); c.stroke(); P(c, (ox, oy) => { c.beginPath(); c.ellipse(9 + ox, 16.5 + oy, 5, 3.6, -0.4, 0, TAU); }, a); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(8, 15.5, 1.6, 0.9, -0.4, 0, TAU); c.fill(); },
    goldcan(c, a) { P(c, (ox, oy) => OC.rr(c, 6 + ox, 9 + oy, 10, 10, 2.5), a); c.strokeStyle = mix(a, '#a07020', 0.3); c.lineWidth = 1.6; c.beginPath(); c.moveTo(16, 12); c.lineTo(21, 7); c.stroke(); c.beginPath(); c.arc(11, 9, 4, Math.PI, 0); c.stroke(); for (let i = 0; i < 3; i++) { c.fillStyle = '#7FC4F5'; c.beginPath(); c.arc(21.5 + i * 0.6, 9 + i * 2.6, 0.8, 0, TAU); c.fill(); } },
    globe(c, a, b) { P(c, (ox, oy) => { c.beginPath(); c.arc(12 + ox, 10 + oy, 7, 0, TAU); }, a); c.fillStyle = b; for (const [x, y, rx, ry] of [[9.5, 8, 2.6, 2], [14, 12, 2.4, 1.8], [13.5, 6.5, 1.4, 1]]) { c.beginPath(); c.ellipse(x, y, rx, ry, 0.4, 0, TAU); c.fill(); } c.strokeStyle = '#B07E4B'; c.lineWidth = 1.2; c.beginPath(); c.arc(12, 10, 8.6, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); P(c, (ox, oy) => OC.rr(c, 8 + ox, 18.5 + oy, 8, 2.6, 1), '#B07E4B'); },
    frame(c, a) { P(c, (ox, oy) => OC.rr(c, 4 + ox, 4 + oy, 16, 16, 2), '#D9A26A'); c.fillStyle = '#FFF7EC'; c.fillRect(6.5, 6.5, 11, 11); c.fillStyle = a; c.beginPath(); c.moveTo(12, 15.5); c.bezierCurveTo(6, 11.5, 8.5, 7, 12, 10); c.bezierCurveTo(15.5, 7, 18, 11.5, 12, 15.5); c.fill(); },
    badge(c, a, b) { c.fillStyle = '#F26B7A'; c.beginPath(); c.moveTo(8, 14); c.lineTo(6, 22); c.lineTo(10, 20); c.lineTo(12, 23); c.lineTo(12, 14); c.fill(); c.fillStyle = '#5BC0EB'; c.beginPath(); c.moveTo(16, 14); c.lineTo(18, 22); c.lineTo(14, 20); c.lineTo(12, 23); c.lineTo(12, 14); c.fill(); P(c, (ox, oy) => { c.beginPath(); c.arc(12 + ox, 10 + oy, 7, 0, TAU); }, a); OC.V.icon(c, 'star', 12, 10, 8, b); },
  });
  // 3D souvenir models (share cached geometry / materials like every other piece of furniture)
  const Mo = OC.Models, { add, rbox, cyl, sphere, lathe, mat } = Mo;
  Object.assign(Mo.FURN, {
    souv_trophy_fish() { const g = new THREE.Group(), gold = mat('#FFC93C'); add(g, rbox(14, 4, 12, 1.2), mat('#B07E4B'), 0, 2, 0); add(g, cyl(1.6, 2, 6, 10), gold, 0, 7, 0); add(g, lathe('trophy', [[0, 0], [2, 0], [6, 4], [7, 10], [6.4, 11], [0, 11]], 18), gold, 0, 10, 0); add(g, sphere(2.2, 10, 8), mat('#5BC0EB'), 0, 25, 0); return g; },
    souv_ladle() { const g = new THREE.Group(), gold = mat('#FFC93C'); add(g, rbox(14, 3, 10, 1), mat('#B07E4B'), 0, 1.5, 0); add(g, cyl(0.9, 0.9, 20, 8), gold, 0, 13, 0); add(g, sphere(4, 12, 8), gold, 0, 4.5, 0); return g; },
    souv_can() { const g = new THREE.Group(), gold = mat('#FFC93C'); add(g, cyl(5, 5.5, 9, 14), gold, 0, 4.5, 0); add(g, cyl(0.9, 1.3, 9, 8), gold, 6, 8, 0).rotation.z = -0.9; add(g, sphere(1.6, 8, 6), mat('#7FC4F5'), 10, 12, 0); return g; },
    souv_globe() { const g = new THREE.Group(); add(g, cyl(5, 6, 2, 14), mat('#B07E4B'), 0, 1, 0); add(g, cyl(0.7, 0.7, 6, 8), mat('#B07E4B'), 0, 5, 0); add(g, sphere(6.5, 16, 12), mat('#5BC0EB'), 0, 14, 0); add(g, sphere(3, 10, 8), mat('#6CCB5F'), 2.6, 15.5, 3.5); return g; },
    souv_frame() { const g = new THREE.Group(); add(g, rbox(22, 22, 2, 1), mat('#D9A26A'), 0, 30, 0); add(g, rbox(17, 17, 2.2, 0.5), mat('#FFF7EC'), 0, 30, 0.2, { cast: false }); add(g, sphere(3.4, 10, 8), mat('#F26B7A'), 0, 30, 1.5); return g; },
    souv_badge() { const g = new THREE.Group(); add(g, rbox(18, 24, 2, 1), mat('#3B2B25'), 0, 30, 0); add(g, cyl(6.5, 6.5, 2, 18), mat('#9B7BE0'), 0, 32, 1.6).rotation.x = Math.PI / 2; add(g, sphere(2.6, 10, 8), mat('#FFC93C'), 0, 32, 3); return g; },
  });

  // ======================= new activities (unlocked by skills) =======================
  const D = OC.LifeData;
  Object.assign(D.ACTS, {
    sketch: { zh: '畫素描', ic: '✏️', verb: 'view', fx: { fun: 30, interest: 35, mood: 10 }, dur: [15, 30], anim: 'sketch', sk: 'art', cat: 'fun', unlock: 'sketch' },
    sing: { zh: '唱歌', ic: '🎵', verb: 'view', fx: { fun: 40, mood: 18, social: 6 }, dur: [6, 12], anim: 'sing', sk: 'music', cat: 'fun', unlock: 'sing' },
  });

  // places where the new activities can also happen while the OC is away (abstract life)
  for (const id of ['isle', 'forest', 'beach']) { const P0 = OC.Places.P[id]; if (P0 && P0.acts) for (const a of ['sketch', 'sing']) if (!P0.acts.includes(a)) P0.acts.push(a); }

  // ======================= dialogue (requests, growth, achievements) =======================
  const Pp = { voice: 'plain' }, B = { voice: 'bright' }, Cc = { voice: 'calm' }, K = { voice: 'cool' };
  const L = [
    ['req_ask', '那個……我{want}。', Pp], ['req_ask', '欸欸！我{want}！可以嗎可以嗎？', B], ['req_ask', '如果你有空的話……我{want}……', Cc], ['req_ask', '……我{want}。不、不是很急啦。', K],
    ['req_ask', '小、小聲說喔……我{want}。', { trait: 'shy' }, 4], ['req_ask', '哼，我才沒有很想……好啦，我{want}。', { trait: 'stubborn' }, 4], ['req_ask', '{want}的話，今天一定會很棒！', { trait: 'optimist' }, 3],
    ['req_ask', '肚子在說……它{want}。', { trait: 'foodie' }, 3], ['req_ask', '我發現一件有趣的事！我{want}！', { trait: 'curious' }, 3],
    ['req_accept', '真的嗎？謝謝你！', Pp], ['req_accept', '太好了——！', B], ['req_accept', '……謝謝。', Cc], ['req_accept', '嗯。就交給你了。', K], ['req_accept', '耶！你最好了！', { trait: 'cheerful' }, 3],
    ['req_later', '好，那我等你。', Pp], ['req_later', '嗯嗯，晚點也可以！', B], ['req_later', '……沒關係，不急。', Cc],
    ['req_decline', '這樣啊……沒關係啦。', Pp], ['req_decline', '嗚……好吧，下次喔！', B], ['req_decline', '嗯，我知道了。', Cc], ['req_decline', '……哼。算了。', { trait: 'stubborn' }, 4], ['req_decline', '沒、沒事的……', { trait: 'sensitive' }, 4],
    ['req_done', '謝謝你！你真的幫了大忙！', Pp], ['req_done', '耶——！最喜歡你了！', B], ['req_done', '……謝謝你。我會記得的。', Cc], ['req_done', '還不錯嘛。謝了。', K], ['req_done', '我、我好開心……', { trait: 'shy' }, 3],
    ['req_cancel', '嗯。那就先不做了，之後有機會再說。', Pp], ['req_cancel', '沒關係，你也有你的安排。', Cc], ['req_cancel', '……知道了。', K], ['req_cancel', '好，那我自己想辦法。', B],
    ['req_cancel', '我還以為……算了，沒事。', { trait: 'sensitive' }, 4], ['req_cancel', '說好的事又收回去。……隨你吧。', { trait: 'stubborn' }, 4],
    ['req_expire', '之前說的那件事……算了，沒關係啦。', Pp], ['req_expire', '那件事我自己想通了！', B],
    ['req_recall', '還記得你幫我{memshort}嗎？我一直記得喔。', Pp], ['req_recall', '上次{memshort}，真的好開心！', B],
    ['skill_up', '我好像變厲害了一點！', Pp], ['skill_up', '看我看我！我學會了！', B], ['skill_up', '……嗯，有進步。', K], ['skill_up', '努力有回報了。', { trait: 'diligent' }, 3],
    ['asp_new', '我有一個夢想……{asp}！', Pp], ['asp_new', '我決定了！我要成為{asp}！', B], ['asp_new', '……我想試試看當{asp}。', Cc],
    ['asp_step', '離{asp}又近了一步！', Pp], ['asp_done', '我做到了！我真的成為{asp}了！', Pp], ['asp_done', '……原來夢想真的會實現。', Cc],
    ['solo_sketch', '這個角度剛剛好……', Pp], ['solo_sketch', '要把這片{wx}天畫下來。', Cc], ['solo_sing', '啦啦啦～♪', Pp], ['solo_sing', '♪ 今天也是好天氣～', B], ['solo_sing', '（小聲哼歌）', { trait: 'shy' }, 3],
    ['react_yum', '好、好好吃——！', Pp], ['react_yum', '這就是天堂的味道嗎！', B], ['react_yum', '……（感動到說不出話）', Cc], ['react_yuck', '嗚哇……這個……', Pp], ['react_yuck', '我、我不行了……', { trait: 'sensitive' }, 3], ['react_yuck', '……下次不要這個。', K],
    ['receive', '這是要給我的嗎？', Pp], ['receive', '哇！禮物！', B], ['receive', '……謝謝。', Cc],
  ];
  const base = D.LINES.length;
  L.forEach((x, i) => D.LINES.push({ id: 'p6_' + (base + i), cat: x[0], text: x[1], c: x[2] || null, w: x[3] || 1 }));

  OC.PlayData = { QUESTS, CHALLENGES, REQUESTS, FOLLOWUPS, SKILLS, ASPIRATIONS, TITLES, ACH, SOUV };
})();
