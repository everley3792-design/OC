/* OC Shimeji 16.5 — food and cooking (OC.Food16).
 * Everything stays on the one item registry (OC.Style.ITEMS) and the one inventory (save.inv); every change of items or coins
 * goes through OC.Tx with a fixed key. Parts:
 *   ingredients   a category for every ingredient (grain, veg, fruit, fish, dairy, sweet, fungus, herb) + ten new ones in the shops
 *   recipes       80 recipes over seven ways of cooking (煮 炒 烤 烘焙 蒸 拌 調飲); a need is an item id or "cat:<category>"
 *   quality       ★1–3. A dish of ★2 / ★3 is its own item (<id>_q2 / <id>_q3, `variant` = the base), so the inventory stays counts
 *   discovery     free cooking: pick 1–4 ingredients and a way → the recipe they make (new ones are discovered), a home-style dish, or
 *                 「奇妙的料理」; the recipe book (S().recipes16) records what is known / made / the best ★
 *   eating        warm food on cold days and cool food on hot days feel better; small species tendencies (OC.Taste.derived)
 *   tables        「端上桌」 puts servings on a table at this place (S().meals16); anyone hungry here eats one (no second payment);
 *                 leftovers are thrown away after a game day
 *   AI cooks      a character that finishes cooking on its own makes a dish from what is in the kitchen (setting, default on) and
 *                 shares it on the table — key aicook:<oc>:<game day>:<n>, at most twice a day per character
 *   café          order one item and eat it there (pay → get → eat, through OC.Tx and OC.Use)
 */
(function () {
  'use strict';
  const I = OC.Style.ITEMS, S = () => OC.Store.s, St = OC.Store;
  const F = (zh, kind, o) => Object.assign({ zh, kind, rarity: 1, tags: [], src: [] }, o);

  // ---------------------------------------------------------------- new ingredients (in the food shop / the market)
  const ING = {
    butter: F('奶油', 'material', { price: 35, sell: 12, tags: ['ingredient'], cat: 'dairy', d: '香濃的奶油，烤點心少不了。', src: ['食品店'], art: { t: 'cheese', a: '#FFE9A8' } }),
    cream: F('鮮奶油', 'material', { price: 40, sell: 14, tags: ['ingredient'], cat: 'dairy', d: '打發後軟綿綿的鮮奶油。', src: ['食品店'], art: { t: 'jar', a: '#FFF8EC' } }),
    onion: F('洋蔥', 'crop', { price: 20, sell: 10, use: { food: 4 }, tags: ['ingredient'], cat: 'veg', flavor: { sweet: 1 }, d: '炒過會變甜的洋蔥。', src: ['食品店', '每日市場'], art: { t: 'potato', a: '#E8C08A' } }),
    cabbage: F('高麗菜', 'crop', { price: 30, sell: 14, use: { food: 6 }, tags: ['ingredient'], cat: 'veg', flavor: { fresh: 1, sweet: 1 }, texture: 'crunchy', d: '一層一層的高麗菜。', src: ['食品店', '每日市場'], art: { t: 'tomato', a: '#9FD07A' } }),
    lemon: F('檸檬', 'food', { price: 30, sell: 12, use: { food: 2 }, tags: ['ingredient'], cat: 'fruit', flavor: { sour: 2, fresh: 1 }, d: '酸酸的檸檬。', src: ['食品店', '每日市場'], art: { t: 'tomato', a: '#F5DC4A' } }),
    chocolate: F('巧克力', 'food', { price: 45, sell: 18, use: { food: 6, mood: 6 }, tags: ['ingredient'], cat: 'sweet', flavor: { sweet: 2, bitter: 1 }, d: '微苦又香甜。', src: ['食品店'], art: { t: 'cheese', a: '#7A4A2A' } }),
    noodle: F('麵條', 'material', { price: 30, sell: 10, tags: ['ingredient'], cat: 'grain', d: '一把乾麵條。', src: ['食品店'], art: { t: 'sack', a: '#F5E2B0', b: '#E0A84A' } }),
    tofu: F('豆腐', 'material', { price: 25, sell: 10, tags: ['ingredient'], cat: 'veg', d: '嫩嫩的豆腐。', src: ['食品店'], art: { t: 'cheese', a: '#FFFDF2' } }),
    chili: F('辣椒', 'material', { price: 15, sell: 6, tags: ['ingredient'], cat: 'herb', flavor: { spicy: 2 }, d: '一點點就很辣。', src: ['每日市場'], art: { t: 'carrot', a: '#E8452E' } }),
    tea_leaf: F('茶葉', 'material', { price: 35, sell: 12, tags: ['ingredient'], cat: 'herb', d: '泡茶用的茶葉。', src: ['食品店', '風車磨坊'], art: { t: 'herb', a: '#6FA75A' } }),
  };
  for (const [id, x] of Object.entries(ING)) if (!I[id]) I[id] = x;
  const CAT_OF = { rice: 'grain', flour: 'grain', noodle: 'grain', bread: 'grain', tomato: 'veg', carrot: 'veg', potato: 'veg', onion: 'veg', cabbage: 'veg', tofu: 'veg',
    apple: 'fruit', orange: 'fruit', peach: 'fruit', berry: 'fruit', strawberry: 'fruit', lemon: 'fruit', milk: 'dairy', cheese: 'dairy', butter: 'dairy', cream: 'dairy', egg: 'dairy',
    sugar: 'sweet', honey: 'sweet', chocolate: 'sweet', mushroom: 'fungus', herb: 'herb', chili: 'herb', tea_leaf: 'herb', lavender: 'herb', flower: 'flower' };
  const CAT_ZH = { grain: '穀物', veg: '蔬菜', fruit: '水果', fish: '魚', dairy: '奶蛋', sweet: '甜味', fungus: '菇類', herb: '香草香料', flower: '花' };
  const catOf = (id) => (I[id] && I[id].cookAs === 'fish' ? 'fish' : CAT_OF[id] || null);
  const isIngredient = (id) => !!catOf(id);

  // ---------------------------------------------------------------- the seven ways of cooking
  const METHODS = { boil: ['煮', 'stove', 'hot'], fry: ['炒', 'stove', 'hot'], grill: ['烤', 'stove', 'hot'], bake: ['烘焙', 'stove', 'warm'], steam: ['蒸', 'stove', 'hot'], mix: ['拌', 'none', 'cold'], drink: ['調飲', 'none', 'cold'] };

  // ---------------------------------------------------------------- 80 recipes  [id, 名稱, 方法, 需要, 份數, 效果, 風味, 溫度, 圖, 技能等級]
  const N = (s) => Object.fromEntries(s.split(' ').map((x) => { const [k, n] = x.split('*'); return [k, +(n || 1)]; }));
  const R = [
    ['soup_mush', '蘑菇濃湯', 'boil', 'mushroom*2 herb', 2], ['curry', '晴日咖哩', 'boil', 'rice potato carrot', 3], ['veg_soup', '蔬菜湯', 'boil', 'cat:veg*2', 2, { food: 22, comfort: 8 }, { fresh: 1, umami: 1 }, 'hot', ['dish', '#E8B04A']],
    ['tomato_soup', '番茄湯', 'boil', 'tomato*2', 2, { food: 20, comfort: 6 }, { sour: 1, umami: 1 }, 'hot', ['dish', '#E8573E']], ['potato_stew', '馬鈴薯燉菜', 'boil', 'potato carrot onion', 3, { food: 34, comfort: 10 }, { umami: 2 }, 'hot', ['dish', '#D9A26A'], 1],
    ['fish_soup', '鮮魚湯', 'boil', 'cat:fish herb', 2, { food: 28, comfort: 8 }, { umami: 2, salty: 1 }, 'hot', ['dish', '#E6E2D6'], 1], ['congee', '白粥', 'boil', 'rice', 2, { food: 18, comfort: 10 }, { salty: 1 }, 'hot', ['dish', '#F8F3E6']],
    ['noodle_soup', '湯麵', 'boil', 'noodle cat:veg', 2, { food: 30, comfort: 6 }, { salty: 1, umami: 1 }, 'hot', ['dish', '#F2D28B']], ['tofu_soup', '豆腐湯', 'boil', 'tofu herb', 2, { food: 16, comfort: 8 }, { umami: 1 }, 'hot', ['dish', '#F3EEDB']],
    ['milk_stew', '奶油燉菜', 'boil', 'milk potato carrot', 3, { food: 34, comfort: 12 }, { sweet: 1, umami: 1 }, 'hot', ['dish', '#FFF3DE'], 2], ['egg_drop', '蛋花湯', 'boil', 'egg tomato', 2, { food: 16, comfort: 6 }, { umami: 1 }, 'hot', ['dish', '#F5D25A']],
    ['hotpot', '小火鍋', 'boil', 'cat:veg*2 tofu mushroom', 4, { food: 36, comfort: 12, social: 4 }, { umami: 2, spicy: 1 }, 'hot', ['dish', '#C8473A'], 3], ['jam', '莓果果醬', 'boil', 'berry*2 sugar', 2, { food: 8, mood: 8 }, { sweet: 2, sour: 1 }, 'cold', ['jar', '#B83A5E'], 1],
    ['cocoa', '熱可可', 'drink', 'milk chocolate', 1], ['tea', '花草茶', 'drink', 'tea_leaf', 1],
    ['fried_rice', '炒飯', 'fry', 'rice egg cat:veg', 2, { food: 32 }, { salty: 1, umami: 1 }, 'hot', ['dish', '#F2C14E']], ['omurice', '蛋包飯', 'fry', 'rice egg*2 tomato', 2, { food: 36, mood: 6 }, { sweet: 1, umami: 1 }, 'hot', ['dish', '#F5C93C'], 2],
    ['stir_veg', '炒時蔬', 'fry', 'cat:veg*2', 2, { food: 20, energy: 4 }, { fresh: 1, salty: 1 }, 'hot', ['salad', '#6FBF5A']], ['fried_noodle', '炒麵', 'fry', 'noodle cabbage onion', 2, { food: 32 }, { salty: 1, umami: 1 }, 'hot', ['dish', '#C98A4A'], 1],
    ['scrambled', '炒蛋', 'fry', 'egg*2', 1, { food: 16 }, { umami: 1 }, 'hot', ['dish', '#F7D84A']], ['mapo', '麻婆豆腐', 'fry', 'tofu chili', 2, { food: 24, energy: 4 }, { spicy: 2, umami: 1 }, 'hot', ['dish', '#C8473A'], 2],
    ['butter_mush', '奶油炒菇', 'fry', 'mushroom butter', 1, { food: 18, comfort: 4 }, { umami: 2 }, 'hot', ['dish', '#C9A46A']], ['potato_fry', '煎馬鈴薯', 'fry', 'potato butter', 2, { food: 22 }, { salty: 1 }, 'hot', ['snack', '#E8B04A']],
    ['pancake', '雲朵鬆餅', 'fry', 'flour egg honey', 2], ['crepe', '可麗餅', 'fry', 'flour egg milk cat:fruit', 2, { food: 20, mood: 10 }, { sweet: 2 }, 'warm', ['dessert', '#F5D9A6'], 2],
    ['fish_fry', '煎魚排', 'fry', 'cat:fish flour', 2, { food: 30 }, { umami: 1, salty: 1 }, 'hot', ['seafood', '#E8B04A'], 1], ['tempura', '野菜天婦羅', 'fry', 'flour cat:veg*2', 2, { food: 26, mood: 4 }, { salty: 1 }, 'hot', ['snack', '#F2D28B'], 2],
    ['fried_egg', '荷包蛋', 'fry', 'egg', 1, { food: 12 }, { salty: 1 }, 'hot', ['dish', '#FFFDF2']],
    ['grill_fish', '鹽烤魚', 'grill', 'cat:fish herb', 1], ['roast_potato', '烤馬鈴薯', 'grill', 'potato', 1, { food: 16 }, { umami: 1 }, 'hot', ['snack', '#C9925A']],
    ['veg_skewer', '烤蔬菜串', 'grill', 'cat:veg*2 herb', 2, { food: 20, energy: 4 }, { fresh: 1, salty: 1 }, 'hot', ['snack', '#7FB85A'], 1], ['grill_mush', '烤香菇', 'grill', 'mushroom*2', 1, { food: 16 }, { umami: 2 }, 'hot', ['snack', '#9A6A3A']],
    ['toast', '奶油吐司', 'grill', 'bread butter', 1, { food: 18, mood: 4 }, { sweet: 1 }, 'warm', ['bread', '#E8B04A']], ['cheese_toast', '起司吐司', 'grill', 'bread cheese', 1, { food: 22 }, { salty: 1, umami: 1 }, 'warm', ['bread', '#F5C93C']],
    ['grill_apple', '烤蘋果', 'grill', 'apple honey', 1, { food: 14, mood: 8 }, { sweet: 2 }, 'warm', ['dessert', '#D9563A'], 1], ['yaki_onigiri', '烤飯糰', 'grill', 'rice herb', 2, { food: 22 }, { salty: 1 }, 'warm', ['snack', '#C98A4A']],
    ['fish_skewer', '烤魚串', 'grill', 'cat:fish*2', 2, { food: 28 }, { salty: 1, umami: 1 }, 'hot', ['seafood', '#C9925A'], 1],
    ['cookie', '奶油餅乾', 'bake', 'flour sugar', 3], ['fruit_tart', '水果塔', 'bake', 'flour sugar strawberry', 2], ['bread', '晨光麵包', 'bake', 'flour*2', 2], ['cake', '草莓蛋糕', 'bake', 'flour egg sugar strawberry', 4],
    ['choco_cookie', '巧克力餅乾', 'bake', 'flour sugar chocolate', 3, { food: 10, mood: 8 }, { sweet: 2, bitter: 1 }, 'warm', ['cookie', '#7A4A2A'], 1], ['muffin', '莓果瑪芬', 'bake', 'flour egg berry', 2, { food: 16, mood: 8 }, { sweet: 1, sour: 1 }, 'warm', ['dessert', '#B85A7A'], 1],
    ['apple_pie', '蘋果派', 'bake', 'flour butter apple*2', 4, { food: 22, mood: 10 }, { sweet: 2 }, 'warm', ['tart', '#D9A26A'], 2], ['quiche', '鹹派', 'bake', 'flour egg cheese cat:veg', 3, { food: 28 }, { salty: 1, umami: 1 }, 'warm', ['tart', '#F2D28B'], 2],
    ['baked_potato', '焗烤馬鈴薯', 'bake', 'potato cheese milk', 2, { food: 30, comfort: 6 }, { salty: 1, umami: 1 }, 'hot', ['dish', '#F5C93C'], 1], ['gratin', '焗烤蔬菜', 'bake', 'cat:veg*2 cheese milk', 3, { food: 30, comfort: 8 }, { umami: 2 }, 'hot', ['dish', '#E8B04A'], 2],
    ['scone', '司康', 'bake', 'flour butter milk', 3, { food: 16, mood: 6 }, { sweet: 1 }, 'warm', ['bread', '#E3C08A'], 1], ['pizza', '小披薩', 'bake', 'flour tomato cheese', 3, { food: 30, mood: 6, social: 3 }, { salty: 1, umami: 1 }, 'hot', ['tart', '#E8573E'], 2],
    ['cheesecake', '起司蛋糕', 'bake', 'cheese egg sugar flour', 4, { food: 20, mood: 12 }, { sweet: 2 }, 'cold', ['dessert', '#FFF0C8'], 3], ['honey_cake', '蜂蜜蛋糕', 'bake', 'flour egg honey', 3, { food: 18, mood: 10 }, { sweet: 2 }, 'warm', ['dessert', '#E8A93A'], 2],
    ['lemon_tart', '檸檬塔', 'bake', 'flour lemon sugar egg', 3, { food: 18, mood: 10 }, { sour: 1, sweet: 1 }, 'cold', ['tart', '#F5DC4A'], 3],
    ['pudding', '雲朵布丁', 'steam', 'egg milk sugar', 2], ['chawanmushi', '茶碗蒸', 'steam', 'egg*2 mushroom', 2, { food: 16, comfort: 8 }, { umami: 2 }, 'hot', ['dish', '#F7E5A6'], 1],
    ['mantou', '小饅頭', 'steam', 'flour milk', 3, { food: 18 }, { sweet: 1 }, 'warm', ['bread', '#FFF8EC']], ['steam_fish', '清蒸魚', 'steam', 'cat:fish herb onion', 2, { food: 30, comfort: 4 }, { umami: 2, fresh: 1 }, 'hot', ['seafood', '#E6E2D6'], 2],
    ['dumpling', '蒸餃', 'steam', 'flour cabbage onion', 3, { food: 28 }, { umami: 1, salty: 1 }, 'hot', ['snack', '#F8F0DC'], 2], ['rice_cake', '甜米糕', 'steam', 'rice sugar honey', 3, { food: 18, mood: 6 }, { sweet: 2 }, 'warm', ['dessert', '#F3E2B8'], 1],
    ['onigiri', '飯糰', 'mix', 'rice', 2], ['salad', '田園沙拉', 'mix', 'tomato carrot', 2], ['fruit_salad', '水果沙拉', 'mix', 'cat:fruit*2', 2, { food: 14, mood: 6, energy: 4 }, { sweet: 1, fresh: 1 }, 'cold', ['salad', '#F26B7A']],
    ['potato_salad', '馬鈴薯沙拉', 'mix', 'potato egg onion', 3, { food: 22 }, { umami: 1 }, 'cold', ['salad', '#F5E2B0'], 1], ['sandwich', '三明治', 'mix', 'bread cheese tomato', 2, { food: 26 }, { salty: 1, fresh: 1 }, 'cold', ['bread', '#F2D28B']],
    ['cold_tofu', '涼拌豆腐', 'mix', 'tofu herb', 1, { food: 12, comfort: 4 }, { fresh: 1 }, 'cold', ['dish', '#FFFDF2']], ['yogurt_cup', '優格水果杯', 'mix', 'milk cat:fruit honey', 1, { food: 14, mood: 8 }, { sweet: 1, sour: 1 }, 'cold', ['glass', '#F8D2DE'], 1],
    ['slaw', '涼拌高麗菜', 'mix', 'cabbage carrot', 2, { food: 14, energy: 4 }, { fresh: 2 }, 'cold', ['salad', '#9FD07A']], ['handroll', '小手捲', 'mix', 'rice cat:fish', 2, { food: 26, mood: 4 }, { umami: 1, fresh: 1 }, 'cold', ['seafood', '#3A4A3A'], 2],
    ['parfait', '莓果聖代', 'mix', 'cream berry sugar', 1, { food: 12, mood: 14 }, { sweet: 2 }, 'cold', ['glass', '#E06A8A'], 2],
    ['juice', '綜合果汁', 'drink', 'cat:fruit*2', 1], ['lemonade', '檸檬汽水', 'drink', 'lemon sugar', 1], ['milk_tea', '奶茶', 'drink', 'tea_leaf milk sugar', 1, { food: 6, energy: 8, mood: 4 }, { sweet: 1, bitter: 1 }, 'cold', ['glass', '#D9B48A'], 1],
    ['smoothie', '莓果奶昔', 'drink', 'berry milk', 1, { food: 8, mood: 6 }, { sweet: 1, sour: 1 }, 'cold', ['glass', '#C85A8A']], ['honey_lemon', '蜂蜜檸檬', 'drink', 'lemon honey', 1, { comfort: 6, energy: 4 }, { sweet: 1, sour: 1 }, 'warm', ['mug', '#F5DC4A']],
    ['lavender_tea', '薰衣草茶', 'drink', 'lavender', 1, { comfort: 10, energy: 2 }, { fresh: 1 }, 'hot', ['mug', '#A88AE0']], ['hot_milk', '熱牛奶', 'drink', 'milk honey', 1, { food: 6, comfort: 10, sleep: 4 }, { sweet: 1 }, 'hot', ['mug', '#FFF8EC']],
    ['choco_milk', '巧克力牛奶', 'drink', 'milk chocolate sugar', 1, { food: 6, mood: 8 }, { sweet: 2 }, 'cold', ['glass', '#8A5A3A'], 1], ['peach_soda', '桃子氣泡飲', 'drink', 'peach sugar', 1, { fun: 6, mood: 4 }, { sweet: 1, fresh: 1 }, 'cold', ['glass', '#F8B8A8']],
    ['orange_juice', '柳橙汁', 'drink', 'orange*2', 1, { food: 6, energy: 6 }, { sweet: 1, sour: 1 }, 'cold', ['glass', '#F5A33A']], ['tomato_juice', '番茄汁', 'drink', 'tomato*2', 1, { food: 6, energy: 4 }, { sour: 1, fresh: 1 }, 'cold', ['glass', '#E8573E']],
    ['straw_milk', '草莓牛奶', 'drink', 'strawberry milk', 1, { food: 6, mood: 8 }, { sweet: 2 }, 'cold', ['glass', '#F8B8C8'], 1],
  ];
  const RECIPES = R.map(([id, zh, method, need, serv, use, flavor, temp, art, lv]) => ({ id, zh, method, need: N(need), serv: serv || 1, use, flavor, temp, art, lv: lv || 0, old: !use }));
  const BY = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
  /* register the new dishes (the ten old ones keep their item definitions) */
  for (const r of RECIPES) {
    if (I[r.id]) { I[r.id].method16 = r.method; if (!I[r.id].temp && METHODS[r.method][2] !== 'cold') I[r.id].temp = METHODS[r.method][2]; continue; }
    const n = Object.values(r.need).reduce((a, b) => a + b, 0), drink = r.method === 'drink';
    I[r.id] = F(r.zh, drink ? 'drink' : 'food', { sell: 15 + n * 14, use: r.use, flavor: r.flavor, temp: r.temp, cat: drink ? 'drink' : ['bake'].includes(r.method) ? 'bakery' : 'dish', rarity: r.lv >= 2 ? 2 : 1, method16: r.method, d: `${METHODS[r.method][0]}出來的${r.zh}。`, src: ['料理'], art: { t: r.art[0], a: r.art[1] } });
  }
  /* home-style dishes (free cooking that is not a recipe) and the odd one */
  const HOME = { boil: ['home_boil', '家常湯', ['dish', '#D9B48A']], fry: ['home_fry', '家常炒菜', ['dish', '#C9A46A']], grill: ['home_grill', '烤物拼盤', ['snack', '#B07E4B']], bake: ['home_bake', '樸素烤點心', ['cookie', '#D9A26A']], steam: ['home_steam', '蒸物小盤', ['dish', '#F3E2B8']], mix: ['home_mix', '涼拌小菜', ['salad', '#9FD07A']], drink: ['home_drink', '自製飲料', ['glass', '#E8D2A8']] };
  for (const [m, [id, zh, art]] of Object.entries(HOME)) if (!I[id]) I[id] = F(zh, m === 'drink' ? 'drink' : 'food', { sell: 30, use: m === 'drink' ? { food: 4, mood: 2 } : { food: 18 }, flavor: { umami: 1 }, temp: METHODS[m][2], cat: m === 'drink' ? 'drink' : 'dish', method16: m, d: '沒有食譜、照感覺做的一道。', src: ['料理'], art: { t: art[0], a: art[1] } });
  if (!I.weird_dish) I.weird_dish = F('奇妙的料理', 'food', { sell: 5, use: { food: 8, mood: -2 }, flavor: { bitter: 1 }, cat: 'dish', d: '……顏色有點特別，能吃。', src: ['料理'], art: { t: 'dish', a: '#8A7AA8' } });
  /* ★2 / ★3 variants of every dish */
  const DISHES = RECIPES.map((r) => r.id).concat(Object.values(HOME).map((h) => h[0]));
  for (const id of DISHES) for (const q of [2, 3]) {
    const b = I[id], vid = id + '_q' + q; if (!b || I[vid]) continue; const k = q === 2 ? 1.25 : 1.5;
    I[vid] = Object.assign({}, b, { zh: `${b.zh}${q === 2 ? '★★' : '★★★'}`, variant: id, q, sell: Math.round((b.sell || 20) * (q === 2 ? 1.3 : 1.7)), price: undefined, use: Object.fromEntries(Object.entries(b.use || { food: 10 }).map(([n, v]) => [n, v > 0 ? Math.round(v * k) : v])), src: ['料理'] });
  }
  const baseOf = (id) => (I[id] && I[id].variant) || id;
  const qOf = (id) => (I[id] && I[id].q) || 1;
  /* the new ingredients in the shops */
  if (OC.Shops && OC.Shops.SHOPS) { const add = (sh, ids) => { const s = OC.Shops.SHOPS[sh]; if (!s) return; const L = s.items || s.rotate; if (L) for (const x of ids) if (!L.includes(x)) L.push(x); };
    add('food', ['butter', 'cream', 'onion', 'cabbage', 'lemon', 'chocolate', 'noodle', 'tofu', 'tea_leaf']); add('market', ['chili', 'lemon', 'onion', 'cabbage']); add('mill', ['tea_leaf']); }

  // ---------------------------------------------------------------- the recipe book
  const book = () => (S().recipes16 = S().recipes16 || {});
  const OLD = ['onigiri', 'salad', 'cookie', 'soup_mush', 'pancake', 'pudding', 'curry', 'fruit_tart', 'grill_fish', 'juice'];
  /** known: the old ten (as before), anything found or made, and the recipes at or below the cooking level of anyone */
  function known(id) { const b = book()[id]; if (b) return true; if (OLD.includes(id)) return true; const r = BY[id]; if (!r) return false; return r.lv <= 0; }
  function state(id) { const b = book()[id]; return b && b.made ? 'made' : known(id) ? 'known' : 'unknown'; }
  function learn(id, how) { const b = book(); if (!b[id]) { b[id] = { found: OC.Sim.day(), how, made: 0, best: 0 }; St.touch('recipes16', { id }); return true; } return false; }

  // ---------------------------------------------------------------- matching ingredients
  const count = (id) => St.count(id);
  /** concrete items from the bag for a recipe → { id: n } or null */
  function pick(r, from) {
    const have = Object.assign({}, from || S().inv), out = {};
    const take = (id, n) => { if ((have[id] || 0) < n) return false; have[id] -= n; out[id] = (out[id] || 0) + n; return true; };
    for (const [k, n] of Object.entries(r.need).sort((a, b) => (a[0].startsWith('cat:') ? 1 : -1))) {
      if (!k.startsWith('cat:')) { if (!take(k, n)) return null; continue; }
      const cat = k.slice(4); let left = n;
      for (const id of Object.keys(have).filter((x) => catOf(x) === cat).sort((a, b) => (have[b] || 0) - (have[a] || 0))) { const t = Math.min(left, have[id] || 0); if (t > 0) { take(id, t); left -= t; } if (!left) break; }
      if (left) return null;
    }
    return out;
  }
  /** free cooking: which recipe do these ingredients make with this way? (exact match, by item or category) */
  function match(chosen, method) {
    const total = Object.values(chosen).reduce((a, b) => a + b, 0);
    for (const r of RECIPES.filter((x) => x.method === method)) {
      const n = Object.values(r.need).reduce((a, b) => a + b, 0); if (n !== total) continue;
      if (pick(r, chosen)) return r;
    }
    return null;
  }
  /** what free cooking would give: { recipe, out, why } */
  function preview(chosen, method) {
    const r = match(chosen, method); if (r) return { recipe: r, out: r.id, serv: r.serv };
    const cats = Object.keys(chosen).map(catOf), odd = (cats.includes('fish') && cats.includes('sweet')) || (method === 'drink' && cats.some((x) => ['fish', 'fungus', 'grain'].includes(x))) || (method === 'bake' && !cats.includes('grain'));
    return { recipe: null, out: odd ? 'weird_dish' : HOME[method][0], serv: 1 };
  }

  // ---------------------------------------------------------------- quality and cooking (data only; the UI calls these)
  function stars(c, score, ingr) {
    const lv = OC.Mind.skillLv(c, 'cook'), rare = Object.keys(ingr || {}).reduce((s, id) => s + ((I[id] || {}).rarity || 1), 0) / Math.max(1, Object.keys(ingr || {}).length);
    const auto = score == null; let s = auto ? Math.min(0.62 + (lv >= 6 ? 0.2 : 0), 0.3 + lv * 0.06) : score;
    s += rare >= 2 ? 0.08 : 0; s += Math.min(0.1, lv * 0.012);
    return s >= 0.78 ? 3 : s >= 0.45 ? 2 : s >= 0.12 ? 1 : 0;
  }
  /** cook: pay the ingredients, get the dish (★ variant) × servings. Returns { ok, out, n, q, discovered } */
  function cook(c, o) {
    const r = o.recipe ? BY[o.recipe] : null, ingr = o.ingr || (r && pick(r)); if (!ingr) return { ok: false, why: '材料不夠' };
    const q = o.q != null ? o.q : stars(c, o.score, ingr); if (!q) return { ok: false, why: '燒焦了……材料都還在', burnt: true };
    const base = r ? r.id : o.out, id = q > 1 && I[base + '_q' + q] ? base + '_q' + q : base, n = (r ? r.serv : 1) + (q === 3 && r && r.serv < 4 ? 1 : 0);
    const tx = OC.Tx.run(o.key || OC.Tx.uid('cook16'), { pay: { items: ingr }, get: { items: { [id]: n } } }, `${o.by || ''}料理 ${I[base].zh}（${'★'.repeat(q)}）`, { stars: q, oc: c.id });
    if (!tx.ok) return { ok: false, why: tx.why[0] };
    let discovered = false; if (r) { discovered = learn(r.id, o.free ? 'free' : 'cook'); const b = book()[r.id]; b.made = (b.made || 0) + 1; b.best = Math.max(b.best || 0, q); St.touch('recipes16', { id: r.id }); }
    if (OC.Progress && !o.ai) OC.Progress.emit('cook', { item: base, stars: q, oc: c.id, count: 1 });
    return { ok: true, out: id, base, n, q, discovered, firsts: tx.firsts || [] };
  }

  // ---------------------------------------------------------------- eating: temperature and the day, species tendencies
  function hotDay() { const s = OC.Clock.season ? OC.Clock.season() : '', wx = OC.Clock.weather(); return s === 'summer' && ['clear', 'sunny'].includes(wx); }
  function coldDay() { const s = OC.Clock.season ? OC.Clock.season() : '', wx = OC.Clock.weather(); return s === 'winter' || ['rain', 'storm', 'snow'].includes(wx); }
  /** extra effects when eating (called by OC.Use.feed and table meals) → { fx, why } */
  function buff(c, id) {
    const it = I[id]; if (!it) return null; const t = it.temp;
    if ((t === 'hot' || t === 'warm') && coldDay()) return { fx: { comfort: 8 }, emo: ['content', 0.3], why: '冷天吃熱的，暖起來了' };
    if (t === 'cold' && hotDay()) return { fx: { fun: 6, comfort: 4 }, emo: ['happy', 0.3], why: '熱天吃冰的，好舒服' };
    return null;
  }
  const SPECIES = { cat: { fish: 1 }, bear: { fish: 1, sweet: 1 }, fox: { fish: 1 }, rabbit: { veg: 1, fish: -1 }, deer: { veg: 1, fish: -1 }, sheep: { veg: 1 }, bird: { grain: 1, fruit: 1 }, mouse: { dairy: 1 }, dog: { fish: 1 }, owl: { fish: 1 }, plant: { fish: -1 } };
  /** a gentle species tendency for a dish (−1…+1) from its main ingredient categories */
  function speciesBias(c, id) {
    const sp = SPECIES[c.profile && c.profile.species]; if (!sp) return 0; const r = BY[baseOf(id)]; const cats = r ? Object.keys(r.need).map((k) => (k.startsWith('cat:') ? k.slice(4) : catOf(k))) : [catOf(id)];
    let v = 0; for (const k of cats) if (sp[k]) v += sp[k]; return Math.max(-1, Math.min(1, v));
  }
  /* hook the species tendency into the derived taste (never the player's settings: those win in OC.Taste.pref) */
  if (OC.Taste && OC.Taste.derived) { const d0 = OC.Taste.derived; OC.Taste.derived = (c, id) => Math.max(-2, Math.min(2, d0(c, baseOf(id)) + speciesBias(c, id))); }

  // ---------------------------------------------------------------- dishes on a table (shared meals, leftovers)
  const meals = () => (S().meals16 = S().meals16 || []);
  const here = () => (OC.World && OC.World.area ? OC.World.area.id : null);
  function mealsHere(place) { const p = place || here(); return meals().filter((m) => m.place === p && m.n > 0); }
  /** put n servings of a dish on a table at this place (paid now; eating it later is free) */
  function serve(id, n, at, by) {
    n = Math.max(1, Math.min(n || 1, count(id))); if (!n) return { ok: false, why: '背包裡沒有' };
    const key = OC.Tx.uid('serve'), tx = OC.Tx.run(key, { pay: { items: { [id]: n } } }, `端上桌：${I[id].zh}×${n}`, {}); if (!tx.ok) return { ok: false, why: tx.why[0] };
    const m = { uid: key, id, n, place: here(), x: at ? at.x : 0, y: at ? at.y : 0, at: OC.Sim.now(), by: by || null }; meals().push(m); St.touch('meals16', {}); St.emit('meal:served', m); return { ok: true, meal: m };
  }
  /** someone here eats a serving (after a finished 'eat' activity) */
  function eatServing(c, place) {
    const m = mealsHere(place).sort((a, b) => a.at - b.at)[0]; if (!m) return null;
    m.n--; const it = I[m.id]; OC.Mind.needs(c, Object.assign({}, it.use || { food: 12 }), it.zh);
    const t = OC.Taste.taste(c, m.id), bf = buff(c, m.id); if (bf) { OC.Mind.needs(c, bf.fx, bf.why); OC.Mind.feel(c, bf.emo[0], bf.emo[1], bf.why); }
    const cook = m.by && OC.Chars.get(m.by);
    OC.Mind.feel(c, t.lv >= 1 ? 'happy' : t.lv <= -1 ? 'confused' : 'content', 0.3, `吃了${it.zh}`);
    OC.Mind.remember(c, { type: 'event', imp: t.lv >= 1 ? 0.4 : 0.25, who: cook && cook.id !== c.id ? [cook.id] : [], text: cook && cook.id !== c.id ? `吃了${OC.Chars.name(cook)}做的${it.zh}` : `吃了桌上的${it.zh}`, key: `meal:${m.uid}:${c.id}` });
    if (cook && cook.id !== c.id) OC.Mind.relChange(c.id, cook.id, { aff: t.lv >= 1 ? 2 : 1, fam: 1 }, '吃了做的菜');
    if (m.n <= 0) S().meals16 = meals().filter((x) => x !== m); St.touch('meals16', {}); St.emit('meal:eaten', { id: c.id, item: m.id });
    return m.id;
  }
  function spoil() { const now = OC.Sim.now(), before = meals().length; S().meals16 = meals().filter((m) => m.n > 0 && now - m.at < 1440); if (S().meals16.length !== before) St.touch('meals16', {}); }

  // ---------------------------------------------------------------- characters who cook on their own
  function aiCook(c, place) {
    if (S().life.settings.aiCook === false) return null;
    const day = OC.Sim.day(), k = (c.life.cook16 = c.life.cook16 || {}); if (k.day !== day) { k.day = day; k.n = 0; } if (k.n >= 2) return null;
    const lv = OC.Mind.skillLv(c, 'cook');
    const can = RECIPES.filter((r) => r.method !== 'drink' && r.lv <= lv && known(r.id) && pick(r)).sort((a, b) => b.serv - a.serv || Object.keys(b.need).length - Object.keys(a.need).length);
    const r = can[0]; if (!r) return null;
    const res = cook(c, { recipe: r.id, score: null, key: `aicook:${c.id}:${day}:${k.n}`, by: OC.Chars.name(c) + ' ', ai: true });
    if (!res.ok) return null; k.n++;
    const sv = serve(res.out, res.n, null, c.id); if (sv.ok) sv.meal.place = place || here();
    OC.Mind.remember(c, { type: 'event', imp: 0.35, text: `做了${I[res.base].zh}給大家`, key: `aicook:${c.id}:${day}:${k.n}` });
    St.emit('food16:aicook', { id: c.id, out: res.out, n: res.n });
    return res;
  }

  // ---------------------------------------------------------------- the café: order one, eat it there
  function order(ocId, id) {
    const it = I[id], price = OC.Shops && OC.Shops.price ? OC.Shops.price('cafe', id) : it && it.price; if (!it || !price) return { ok: false, why: '這裡沒有賣' };
    const tx = OC.Tx.run(OC.Tx.uid('order'), { pay: { coins: price }, get: { items: { [id]: 1 } } }, `咖啡館點餐：${it.zh}`, {}); if (!tx.ok) return { ok: false, why: tx.why[0] };
    OC.Use && OC.Use.feed(ocId, id); return { ok: true, price };
  }

  // ---------------------------------------------------------------- wiring
  function init() {
    if (S().life && S().life.settings.aiCook == null) S().life.settings.aiCook = true;
    if (OC.Progress && OC.Progress.on) OC.Progress.on((d) => {
      if (!d || d.ev !== 'act' || !d.oc) return; const c = OC.Chars.get(d.oc); if (!c) return;
      if (d.act === 'eat' && d.min >= 5) eatServing(c, d.place);
      if (d.act === 'cook' && d.min >= 5) { const b = OC.Brain.get(c.id); if (!(b && b.byPlayer)) aiCook(c, d.place); }
    });
    if (OC.Sim.onDay) OC.Sim.onDay(() => spoil());
  }

  OC.Food16 = { ING, CAT_OF, CAT_ZH, catOf, isIngredient, METHODS, RECIPES, BY, HOME, DISHES, baseOf, qOf, known, state, learn, book, pick, match, preview, stars, cook, buff, speciesBias, meals, mealsHere, serve, eatServing, spoil, aiCook, order, init, hotDay, coldDay };
})();
