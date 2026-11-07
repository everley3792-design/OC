/* OC Shimeji — unified item system (Phase 5).
 * ONE registry: OC.Style.ITEMS (every page, the bag, shops, workshop products, furniture and
 * the life AI read it). This module extends it with the full catalogue — food, drinks, crops,
 * seeds, fish, critters, sea finds, materials, gifts, toys, furniture, clothing — and with the
 * player's workshop products (save.custom.items, images in IndexedDB). It also owns item art
 * (original procedural icons), search / filter / sort, and per-OC food preferences (OC.Taste).
 * Item fields: zh kind d price sell rarity(1–5) tags[] src[] use{need:Δ} flavor{} texture temp
 *              ingredients[] art{} fp/sit/sleep/verbs (furniture) slot/val (clothing) custom asset
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store;
  const ITEMS = OC.Style.ITEMS;

  const KINDS = {
    food: { zh: '食物', ic: 'apple' }, drink: { zh: '飲料', ic: 'apple' }, crop: { zh: '作物', ic: 'leaf' }, seed: { zh: '種子', ic: 'leaf' },
    fish: { zh: '魚類', ic: 'sparkle' }, bug: { zh: '小生物', ic: 'leaf' }, sea: { zh: '海洋收藏', ic: 'sparkle' }, material: { zh: '材料', ic: 'layers' },
    gift: { zh: '禮物', ic: 'gift' }, toy: { zh: '玩具', ic: 'play' }, furniture: { zh: '家具', ic: 'sofa' }, clothing: { zh: '服飾', ic: 'shirt' },
  };
  const GROUPS = [['eat', '吃喝', ['food', 'drink']], ['grow', '種植', ['crop', 'seed']], ['nature', '生物與收藏', ['fish', 'bug', 'sea']], ['make', '材料', ['material']], ['give', '禮物與玩具', ['gift', 'toy']], ['home', '家具', ['furniture']], ['wear', '服飾', ['clothing']]];
  const RARITY = ['', '常見', '少見', '稀有', '珍貴', '傳說'];
  const FLAVORS = { sweet: '甜', salty: '鹹', sour: '酸', spicy: '辣', bitter: '苦', umami: '鮮', fresh: '清爽' };
  const TEXTURES = { soft: '軟綿', crunchy: '酥脆', creamy: '滑順', chewy: 'Q 彈', juicy: '多汁', crispy: '清脆' };

  // ---------------- catalogue (original names & descriptions) ----------------
  const F = (zh, kind, o) => Object.assign({ zh, kind, rarity: 1, tags: [], src: [] }, o);
  const food = (zh, o) => F(zh, 'food', o), drink = (zh, o) => F(zh, 'drink', o);
  const NEW = {
    // ---- ingredients & produce ----
    berry: food('林間莓', { sell: 25, use: { food: 8, fun: 3 }, flavor: { sweet: 1, sour: 1 }, texture: 'juicy', cat: 'fruit', d: '森林裡一串串的小莓果。', src: ['苔光森林採集'], art: { t: 'berry', a: '#C2385B' } }),
    herb: F('香草葉', 'material', { sell: 15, tags: ['ingredient'], d: '清香的葉子，料理時加一點會更香。', src: ['苔光森林採集'], art: { t: 'herb', a: '#5FBF62' } }),
    acorn: F('橡實', 'material', { sell: 12, d: '圓滾滾的橡實，可以做小玩具。', src: ['苔光森林採集'], art: { t: 'acorn', a: '#B07E4B' } }),
    flour: F('麵粉', 'material', { price: 30, sell: 10, tags: ['ingredient'], d: '烘焙用的麵粉。', src: ['食品店'], art: { t: 'sack', a: '#F2E6CF', b: '#C9A46A' } }),
    sugar: F('砂糖', 'material', { price: 25, sell: 8, tags: ['ingredient'], d: '甜點不可少。', src: ['食品店'], art: { t: 'sack', a: '#FFFFFF', b: '#F48FB1' } }),
    egg: F('雞蛋', 'material', { price: 20, sell: 8, tags: ['ingredient'], d: '新鮮雞蛋。', src: ['食品店'], art: { t: 'egg', a: '#FFF3DE' } }),
    rice: F('白米', 'material', { price: 30, sell: 10, tags: ['ingredient'], d: '香 Q 的白米。', src: ['食品店'], art: { t: 'sack', a: '#FFFFFF', b: '#8BC2E8' } }),
    cheese: food('起司', { price: 50, sell: 18, use: { food: 10 }, flavor: { salty: 1, umami: 1 }, texture: 'creamy', cat: 'dairy', tags: ['ingredient'], d: '濃郁的起司。', src: ['食品店'], art: { t: 'cheese', a: '#FFD45C' } }),
    honey: food('蜂蜜', { price: 60, sell: 22, use: { food: 6, mood: 4 }, flavor: { sweet: 2 }, texture: 'creamy', cat: 'sweet', tags: ['ingredient'], d: '金黃色的蜂蜜。', src: ['食品店', '每日市場'], art: { t: 'jar', a: '#FFB627' } }),
    tomato: F('番茄', 'crop', { price: 40, sell: 30, use: { food: 8 }, flavor: { sour: 1, fresh: 1 }, texture: 'juicy', cat: 'veg', tags: ['ingredient'], d: '紅通通的番茄。', src: ['菜園收成', '每日市場'], art: { t: 'tomato', a: '#E8453C' } }),
    carrot: F('胡蘿蔔', 'crop', { price: 35, sell: 26, use: { food: 7 }, flavor: { sweet: 1, fresh: 1 }, texture: 'crunchy', cat: 'veg', tags: ['ingredient'], d: '脆脆的胡蘿蔔。', src: ['菜園收成', '每日市場'], art: { t: 'carrot', a: '#FF8A2A' } }),
    potato: F('馬鈴薯', 'crop', { price: 30, sell: 22, use: { food: 9 }, flavor: { umami: 1 }, texture: 'soft', cat: 'veg', tags: ['ingredient'], d: '鬆鬆軟軟的馬鈴薯。', src: ['菜園收成', '每日市場'], art: { t: 'potato', a: '#C99A5B' } }),
    strawberry: F('草莓', 'crop', { price: 55, sell: 40, use: { food: 7, mood: 4 }, flavor: { sweet: 2, sour: 1 }, texture: 'juicy', cat: 'fruit', tags: ['ingredient'], rarity: 2, d: '酸甜的草莓。', src: ['菜園收成'], art: { t: 'strawberry', a: '#F24B5E' } }),
    sunflower: F('向日葵', 'gift', { sell: 45, use: { mood: 10 }, tags: ['flower'], rarity: 2, d: '大大的向日葵，送人會讓對方很開心。', src: ['菜園收成'], art: { t: 'sunflower', a: '#FFC93C' } }),
    // ---- seeds ----
    seed_tomato: F('番茄種子', 'seed', { price: 30, sell: 8, grow: { crop: 'tomato', days: 2, n: [2, 3] }, d: '種在菜園裡，大約 2 天收成。', src: ['每日市場', '食品店'], art: { t: 'seed', a: '#E8453C' } }),
    seed_carrot: F('胡蘿蔔種子', 'seed', { price: 25, sell: 6, grow: { crop: 'carrot', days: 2, n: [2, 3] }, d: '種在菜園裡，大約 2 天收成。', src: ['每日市場', '食品店'], art: { t: 'seed', a: '#FF8A2A' } }),
    seed_potato: F('馬鈴薯種子', 'seed', { price: 20, sell: 5, grow: { crop: 'potato', days: 1.5, n: [2, 4] }, d: '好種又好收，大約 1.5 天收成。', src: ['每日市場', '食品店'], art: { t: 'seed', a: '#C99A5B' } }),
    seed_straw: F('草莓種子', 'seed', { price: 60, sell: 15, grow: { crop: 'strawberry', days: 3, n: [2, 3] }, rarity: 2, d: '需要耐心照顧，大約 3 天收成。', src: ['每日市場'], art: { t: 'seed', a: '#F24B5E' } }),
    seed_sun: F('向日葵種子', 'seed', { price: 40, sell: 10, grow: { crop: 'sunflower', days: 2.5, n: [1, 2] }, d: '會長出大大的向日葵。', src: ['每日市場'], art: { t: 'seed', a: '#FFC93C' } }),
    // ---- dishes (cooking results / café) ----
    soup_mush: food('蘑菇濃湯', { price: 160, sell: 90, use: { food: 30, comfort: 8, mood: 4 }, flavor: { umami: 2, salty: 1 }, texture: 'creamy', temp: 'hot', cat: 'dish', rarity: 2, ingredients: ['mushroom', 'herb'], d: '暖呼呼的濃湯。', src: ['料理', '咖啡館'], art: { t: 'bowl', a: '#D8B48A' } }),
    pancake: food('雲朵鬆餅', { price: 150, sell: 80, use: { food: 28, mood: 8 }, flavor: { sweet: 2 }, texture: 'soft', temp: 'hot', cat: 'dessert', rarity: 2, ingredients: ['flour', 'egg', 'honey'], d: '淋上蜂蜜的厚鬆餅。', src: ['料理', '咖啡館'], art: { t: 'pancake', a: '#F2C36B' } }),
    fruit_tart: food('水果塔', { price: 220, sell: 120, use: { food: 24, mood: 14 }, flavor: { sweet: 2, sour: 1 }, texture: 'crunchy', cat: 'dessert', rarity: 3, ingredients: ['flour', 'sugar', 'strawberry'], d: '亮晶晶的水果塔。', src: ['料理'], art: { t: 'tart', a: '#F24B5E' } }),
    curry: food('晴日咖哩', { price: 180, sell: 100, use: { food: 40, energy: 6 }, flavor: { spicy: 2, umami: 1 }, texture: 'soft', temp: 'hot', cat: 'dish', rarity: 2, ingredients: ['rice', 'potato', 'carrot'], d: '有點辣的招牌咖哩。', src: ['料理', '咖啡館'], art: { t: 'curry', a: '#E8A33A' } }),
    onigiri: food('飯糰', { price: 70, sell: 35, use: { food: 22 }, flavor: { salty: 1 }, texture: 'chewy', cat: 'dish', ingredients: ['rice'], d: '野餐必備的飯糰。', src: ['料理', '食品店'], art: { t: 'onigiri', a: '#FFFFFF' } }),
    salad: food('田園沙拉', { price: 110, sell: 60, use: { food: 18, energy: 4 }, flavor: { fresh: 2, sour: 1 }, texture: 'crispy', temp: 'cold', cat: 'dish', ingredients: ['tomato', 'carrot'], d: '清爽的蔬菜沙拉。', src: ['料理', '咖啡館'], art: { t: 'salad', a: '#6CCB5F' } }),
    cookie: food('奶油餅乾', { price: 60, sell: 30, use: { food: 10, mood: 6 }, flavor: { sweet: 1 }, texture: 'crunchy', cat: 'dessert', ingredients: ['flour', 'sugar'], d: '香香脆脆的小餅乾。', src: ['料理', '食品店'], art: { t: 'cookie', a: '#E2B66F' } }),
    pudding: food('雲朵布丁', { price: 90, sell: 45, use: { food: 14, mood: 8 }, flavor: { sweet: 2 }, texture: 'creamy', temp: 'cold', cat: 'dessert', rarity: 2, ingredients: ['egg', 'milk', 'sugar'], d: '搖搖晃晃的布丁。', src: ['料理', '咖啡館'], art: { t: 'pudding', a: '#FFD45C' } }),
    grill_fish: food('鹽烤魚', { price: 140, sell: 75, use: { food: 30, energy: 4 }, flavor: { salty: 1, umami: 2 }, texture: 'soft', temp: 'hot', cat: 'seafood', rarity: 2, ingredients: ['fish', 'herb'], d: '外皮香脆的烤魚。', src: ['料理'], art: { t: 'grill', a: '#7FB2D9' } }),
    bread: food('晨光麵包', { price: 55, sell: 25, use: { food: 16 }, flavor: { sweet: 1 }, texture: 'soft', cat: 'bakery', d: '剛出爐的小麵包。', src: ['食品店', '咖啡館'], art: { t: 'bread', a: '#E2A65A' } }),
    // ---- drinks ----
    cocoa: drink('熱可可', { price: 70, sell: 30, use: { food: 6, comfort: 10, mood: 4 }, flavor: { sweet: 2 }, texture: 'creamy', temp: 'hot', cat: 'drink', d: '雨天最適合的一杯。', src: ['咖啡館', '食品店'], art: { t: 'mug', a: '#8A5A3C' } }),
    lemonade: drink('檸檬汽水', { price: 60, sell: 25, use: { food: 4, fun: 6, energy: 4 }, flavor: { sour: 1, sweet: 1, fresh: 1 }, temp: 'cold', cat: 'drink', d: '咕嘟咕嘟冒泡泡。', src: ['咖啡館', '食品店'], art: { t: 'glass', a: '#FFE066' } }),
    tea: drink('花草茶', { price: 50, sell: 20, use: { comfort: 8, mood: 4 }, flavor: { fresh: 1, bitter: 1 }, temp: 'hot', cat: 'drink', d: '香香的花草茶。', src: ['咖啡館'], art: { t: 'cup', a: '#C9E39B' } }),
    latte: drink('雲朵拿鐵', { price: 80, sell: 32, use: { energy: 12, mood: 4 }, flavor: { bitter: 1, sweet: 1 }, texture: 'creamy', temp: 'hot', cat: 'drink', d: '上面有雲朵拉花。', src: ['咖啡館'], art: { t: 'mug', a: '#E9D2B0' } }),
    juice: drink('綜合果汁', { price: 65, sell: 28, use: { food: 6, energy: 6 }, flavor: { sweet: 1, sour: 1 }, temp: 'cold', cat: 'drink', d: '新鮮水果打的果汁。', src: ['咖啡館', '每日市場'], art: { t: 'glass', a: '#FF9A3C' } }),
    // ---- fish ----
    f_sardine: F('晴空沙丁魚', 'fish', { sell: 40, rarity: 1, habitat: 'sea', d: '成群游動的小魚。', src: ['海灘釣魚'], art: { t: 'fish', a: '#8FB8D9', b: '#5A86B0' }, cookAs: 'fish' }),
    f_rainbow: F('彩虹小魚', 'fish', { sell: 90, rarity: 2, habitat: 'sea', d: '鱗片會隨光線變色。', src: ['海灘釣魚（晴天）'], art: { t: 'fish', a: '#7FD3F7', b: '#F48FB1' }, cookAs: 'fish' }),
    f_puffer: F('圓圓河豚', 'fish', { sell: 120, rarity: 2, habitat: 'sea', d: '一緊張就鼓起來。', src: ['海灘釣魚'], art: { t: 'puffer', a: '#F2D28B' } }),
    f_starbream: F('星斑鯛', 'fish', { sell: 180, rarity: 3, habitat: 'sea', d: '身上有星星斑點的漂亮魚。', src: ['海灘釣魚（傍晚）'], art: { t: 'fish', a: '#F26B5B', b: '#FFD23F' }, cookAs: 'fish' }),
    f_silver: F('銀刀魚', 'fish', { sell: 70, rarity: 1, habitat: 'sea', d: '細長閃亮的魚。', src: ['海灘釣魚'], art: { t: 'fish', a: '#C7D3DE', b: '#8A9BAD' }, cookAs: 'fish' }),
    f_moonjelly: F('月光水母', 'fish', { sell: 400, rarity: 4, habitat: 'sea', d: '只在夜晚出現，會發出淡淡的光。', src: ['海灘釣魚（夜晚）'], art: { t: 'jelly', a: '#B7A3F0' } }),
    f_carp: F('苔池鯉', 'fish', { sell: 60, rarity: 1, habitat: 'pond', d: '森林池塘裡悠閒的鯉魚。', src: ['森林池塘釣魚'], art: { t: 'fish', a: '#9AA86A', b: '#6E7A44' }, cookAs: 'fish' }),
    f_koi: F('雲紋錦鯉', 'fish', { sell: 300, rarity: 3, habitat: 'pond', d: '像雲朵花紋的錦鯉，據說會帶來好運。', src: ['森林池塘釣魚（雨天）'], art: { t: 'fish', a: '#FFFFFF', b: '#F26B5B' } }),
    f_shrimp: F('小溪蝦', 'fish', { sell: 35, rarity: 1, habitat: 'pond', d: '透明的小蝦。', src: ['森林池塘釣魚'], art: { t: 'shrimp', a: '#F2A28B' } }),
    // ---- critters ----
    b_butterfly: F('晴蝶', 'bug', { sell: 50, rarity: 1, d: '翅膀像天空一樣藍。', src: ['觀察捕捉（白天）'], art: { t: 'butterfly', a: '#7FD3F7' } }),
    b_ladybug: F('小瓢蟲', 'bug', { sell: 30, rarity: 1, d: '紅色背上有黑點點。', src: ['觀察捕捉'], art: { t: 'ladybug', a: '#E8453C' } }),
    b_firefly: F('螢火蟲', 'bug', { sell: 120, rarity: 2, d: '夜晚森林的小燈。', src: ['觀察捕捉（夜晚）'], art: { t: 'firefly', a: '#E5F27A' } }),
    b_beetle: F('角角甲蟲', 'bug', { sell: 150, rarity: 3, d: '頭上有帥氣的角。', src: ['觀察捕捉（森林）'], art: { t: 'beetle', a: '#4B3A6B' } }),
    b_snail: F('雨天蝸牛', 'bug', { sell: 60, rarity: 2, d: '下雨天才出來散步。', src: ['觀察捕捉（雨天）'], art: { t: 'snail', a: '#E2B66F' } }),
    b_crab: F('寄居小蟹', 'bug', { sell: 70, rarity: 1, d: '背著小房子的螃蟹。', src: ['觀察捕捉（海灘）'], art: { t: 'crab', a: '#F26B5B' } }),
    // ---- sea finds ----
    shell_star: F('小海星', 'sea', { sell: 60, rarity: 2, d: '退潮時留在沙灘上的海星。', src: ['星砂海灘'], art: { t: 'starfish', a: '#FF9A6B' } }),
    shell_conch: F('螺旋貝', 'sea', { sell: 80, rarity: 2, d: '貼近耳朵能聽到海浪聲。', src: ['星砂海灘'], art: { t: 'conch', a: '#F7D1B5' } }),
    sea_glass: F('海玻璃', 'sea', { sell: 110, rarity: 3, d: '被海浪磨圓的玻璃，像寶石一樣。', src: ['星砂海灘'], art: { t: 'gem', a: '#7FD3C4' } }),
    // ---- toys & gifts ----
    ball: F('彈彈球', 'toy', { price: 80, sell: 30, use: { fun: 20, active: 10 }, d: '丟給 OC 一起玩。', src: ['禮品店'], art: { t: 'ball', a: '#F26B5B', b: '#FFFFFF' } }),
    yoyo: F('星星溜溜球', 'toy', { price: 90, sell: 35, use: { fun: 18, interest: 6 }, d: '轉呀轉。', src: ['禮品店'], art: { t: 'yoyo', a: '#9B7BE0' } }),
    kite: F('風箏', 'toy', { price: 150, sell: 60, use: { fun: 26, active: 14 }, rarity: 2, d: '有風的日子最好玩。', src: ['禮品店'], art: { t: 'kite', a: '#3FC1B0', b: '#FFC93C' } }),
    blocks: F('木頭積木', 'toy', { price: 120, sell: 45, use: { fun: 16, interest: 12 }, d: '可以堆成小城堡。', src: ['禮品店'], art: { t: 'blocks', a: '#F26B5B' } }),
    plush: F('小熊布偶', 'gift', { price: 200, sell: 70, use: { mood: 14, comfort: 6 }, rarity: 2, tags: ['cute'], d: '抱起來軟綿綿的布偶。', src: ['禮品店'], art: { t: 'plush', a: '#C9A46A' } }),
    giftbox: F('緞帶禮盒', 'gift', { price: 120, sell: 40, use: { mood: 12 }, d: '裝著小驚喜的禮盒。', src: ['禮品店'], art: { t: 'giftbox', a: '#F48FB1', b: '#FFC93C' } }),
    letter: F('手寫信紙', 'gift', { price: 30, sell: 10, use: { mood: 8, social: 6 }, d: '寫下想說的話送給朋友。', src: ['禮品店'], art: { t: 'letter', a: '#FFF7EC', b: '#F26B5B' } }),
    // ---- furniture ----
    sofa: F('雲朵沙發', 'furniture', { price: 420, sell: 150, fp: [2, 1], sit: true, seats: 2, d: '兩個人可以一起坐的沙發。', src: ['家具店'], art: { t: 'sofa', a: '#9FD3FF' } }),
    desk: F('小書桌', 'furniture', { price: 320, sell: 110, fp: [2, 1], verbs: ['study', 'read'], d: 'OC 會在這裡讀書、寫字。', src: ['家具店'], art: { t: 'desk', a: '#D9A26A' } }),
    bookshelf: F('書櫃', 'furniture', { price: 360, sell: 120, fp: [2, 1], wall: true, verbs: ['read', 'tidy'], d: '擺滿故事書的書櫃。愛看書的 OC 會很喜歡。', src: ['家具店'], art: { t: 'bookshelf', a: '#B07E4B' } }),
    toybox: F('玩具箱', 'furniture', { price: 200, sell: 70, fp: [1, 1], verbs: ['play', 'tidy'], d: '裝滿玩具的箱子，OC 會來玩。', src: ['家具店'], art: { t: 'toybox', a: '#FFC93C', b: '#F26B5B' } }),
    stove: F('小廚房', 'furniture', { price: 480, sell: 160, fp: [2, 1], wall: true, verbs: ['cook'], d: '可以做料理的廚房台。', src: ['家具店'], art: { t: 'stove', a: '#FFFFFF', b: '#3FC1B0' } }),
    wardrobe: F('衣櫃', 'furniture', { price: 380, sell: 130, fp: [2, 1], wall: true, verbs: ['tidy'], d: '收納衣服的衣櫃。', src: ['家具店'], art: { t: 'wardrobe', a: '#E7C9A4' } }),
    painting: F('海景掛畫', 'furniture', { price: 180, sell: 60, fp: [1, 1], wall: true, walk: false, verbs: ['view'], d: '掛在牆上的海景畫。', src: ['家具店'], art: { t: 'painting', a: '#5BC0EB' } }),
    clock: F('落地鐘', 'furniture', { price: 260, sell: 90, fp: [1, 1], wall: true, d: '滴答滴答。', src: ['家具店'], art: { t: 'clock', a: '#B07E4B' } }),
    bigpot: F('大花盆', 'furniture', { price: 140, sell: 50, fp: [1, 1], verbs: ['tend'], d: 'OC 會來澆水的大盆栽。', src: ['家具店'], art: { t: 'bigpot', a: '#E2895A' } }),
    campfire: F('營火', 'furniture', { price: 300, sell: 100, fp: [1, 1], outdoor: true, verbs: ['view'], seats: 0, d: '大家會圍在旁邊聊天取暖。', src: ['家具店'], art: { t: 'campfire', a: '#FF9A3C' } }),
    swing: F('雙人鞦韆', 'furniture', { price: 400, sell: 140, fp: [2, 1], outdoor: true, sit: true, seats: 2, verbs: ['play'], d: '可以兩個人一起盪的鞦韆。', src: ['家具店'], art: { t: 'swing', a: '#D9A26A' } }),
    lantern: F('紙燈籠', 'furniture', { price: 120, sell: 40, fp: [1, 1], d: '晚上會發出暖暖的光。', src: ['家具店'], art: { t: 'lantern', a: '#FFC93C' } }),
    // ---- clothing (unlocks a look value; not consumed when worn) ----
    'acc-crown': F('花冠', 'clothing', { price: 180, slot: 'acc', val: 'crown', d: '小花編成的花冠。', src: ['服裝店'], art: { t: 'crown' } }),
    'acc-bow': F('大蝴蝶結', 'clothing', { price: 120, slot: 'acc', val: 'bow', d: '頭上的大蝴蝶結。', src: ['服裝店'], art: { t: 'bow', a: '#F26B7A' } }),
    'acc-sunhat': F('草帽', 'clothing', { price: 160, slot: 'acc', val: 'sunhat', d: '海邊必備。', src: ['服裝店'], art: { t: 'sunhat', a: '#F2D28B' } }),
    'acc-glasses': F('圓眼鏡', 'clothing', { price: 140, slot: 'acc', val: 'glasses', d: '看起來很聰明。', src: ['服裝店'], art: { t: 'glasses' } }),
    'pat-dots': F('圓點印花', 'clothing', { price: 90, slot: 'pattern', val: 'dots', d: '可愛的圓點。', src: ['服裝店'], art: { t: 'shirtpat', a: '#5BC0EB', b: 'dots' } }),
    'pat-heart': F('愛心印花', 'clothing', { price: 110, slot: 'pattern', val: 'heart', d: '胸口的愛心。', src: ['服裝店'], art: { t: 'shirtpat', a: '#F48FB1', b: 'heart' } }),
    'shirt-sun': F('向陽上衣', 'clothing', { price: 120, slot: 'shirt', val: '#FFC93C', d: '陽光黃的上衣。', src: ['服裝店'], art: { t: 'shirt', a: '#FFC93C' } }),
    'shirt-mint': F('薄荷上衣', 'clothing', { price: 120, slot: 'shirt', val: '#3FC1B0', d: '清爽的薄荷綠。', src: ['服裝店'], art: { t: 'shirt', a: '#3FC1B0' } }),
    'shirt-berry': F('莓果上衣', 'clothing', { price: 120, slot: 'shirt', val: '#F26B7A', d: '甜甜的莓果紅。', src: ['服裝店'], art: { t: 'shirt', a: '#F26B7A' } }),
  };
  // enrich existing (Phase 2) items with the new fields, without changing their ids or effects
  const PATCH = {
    apple: { rarity: 1, flavor: { sweet: 1, fresh: 1 }, texture: 'crispy', cat: 'fruit', src: ['晴日島果樹'], tags: ['ingredient'] },
    orange: { rarity: 1, flavor: { sweet: 1, sour: 1 }, texture: 'juicy', cat: 'fruit', src: ['晴日島果樹'], tags: ['ingredient'] },
    peach: { rarity: 1, flavor: { sweet: 2 }, texture: 'juicy', cat: 'fruit', src: ['晴日島果樹'], tags: ['ingredient'] },
    mushroom: { rarity: 1, flavor: { umami: 2 }, texture: 'chewy', cat: 'fungus', src: ['苔光森林採集'], tags: ['ingredient'] },
    cake: { rarity: 2, flavor: { sweet: 2 }, texture: 'soft', cat: 'dessert', src: ['食品店'] },
    milk: { kind: 'drink', rarity: 1, flavor: { sweet: 1 }, texture: 'creamy', temp: 'cold', cat: 'drink', src: ['食品店'], tags: ['ingredient'] },
    flower: { rarity: 1, tags: ['flower'], src: ['晴日島花圃'] },
    shell: { kind: 'sea', rarity: 1, src: ['晴日島海邊', '星砂海灘'] },
    star: { rarity: 2, flavor: { sweet: 2 }, src: ['禮品店'] },
    lamp: { src: ['家具店'] }, cushion: { src: ['家具店'] }, plant: { src: ['家具店'], verbs: ['tend'] }, rug: { src: ['家具店'] }, chair: { src: ['家具店'] }, table: { src: ['家具店'], seats: 2 }, bed: { src: ['家具店'] },
    'acc-scarf': { src: ['服裝店'] }, 'acc-hood': { src: ['服裝店'] }, 'clip-star': { src: ['服裝店'] }, 'clip-leaf': { src: ['服裝店'] }, 'pat-star': { src: ['服裝店'] },
  };
  for (const [id, p] of Object.entries(PATCH)) if (ITEMS[id]) { for (const [k, v] of Object.entries(p)) ITEMS[id][k] = v; }
  for (const [id, d] of Object.entries(NEW)) ITEMS[id] = d;
  for (const it of Object.values(ITEMS)) { it.tags = it.tags || []; it.src = it.src || []; it.rarity = it.rarity || 1; }

  // ---------------- workshop products (player-made items; images live in IndexedDB) ----------------
  const CUSTOM_KINDS = ['food', 'drink', 'toy', 'gift', 'furniture', 'clothing', 'material'];
  function registerCustom() {
    const C = (S().custom = S().custom || { items: {} }).items;
    for (const id of Object.keys(ITEMS)) if (ITEMS[id].custom && !C[id]) delete ITEMS[id];
    for (const [id, d] of Object.entries(C)) ITEMS[id] = Object.assign({ tags: [], src: ['工坊商品'], rarity: 1 }, d, { custom: true, art: { img: d.asset } });
  }
  /** validate + save a workshop product. It is NOT added to the inventory (only shops / rewards give items) */
  function saveCustom(def) {
    const e = [];
    if (!def.zh || !def.zh.trim()) e.push('請輸入商品名稱'); if (def.zh && def.zh.length > 16) e.push('名稱最多 16 個字');
    if (!CUSTOM_KINDS.includes(def.kind)) e.push('請選擇商品類別'); if (!def.asset) e.push('請選擇商品圖片');
    if (!(def.price >= 10 && def.price <= 5000)) e.push('價格需在 10–5000 星幣之間');
    if (def.kind === 'clothing' && !def.anchor) e.push('服飾要選擇穿戴位置');
    if (e.length) return { ok: false, errors: e };
    const C = (S().custom = S().custom || { items: {} }).items;
    const id = def.id && C[def.id] ? def.id : 'u_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const use = def.kind === 'food' ? { food: def.power || 20, mood: 4 } : def.kind === 'drink' ? { food: 6, energy: def.power || 10 } : def.kind === 'toy' ? { fun: def.power || 20 } : def.kind === 'gift' ? { mood: def.power || 10 } : null;
    C[id] = { id, zh: def.zh.trim(), kind: def.kind, d: (def.d || '').slice(0, 80) || '工坊做的原創商品。', price: Math.round(def.price), sell: Math.max(1, Math.round(def.price * 0.35)), tags: (def.tags || []).slice(0, 6), asset: def.asset, shop: def.shop || defaultShop(def.kind), use, flavor: def.flavor || null, temp: def.temp || null,
      anchor: def.anchor || null, fp: def.kind === 'furniture' ? [1, 1] : undefined, sit: def.kind === 'furniture' && !!def.sit, verbs: def.kind === 'furniture' ? (def.sit ? ['sit'] : ['view']) : undefined, reaction: def.reaction || '', anim: def.anim || '', created: C[id] ? C[id].created : Date.now(), updated: Date.now() };
    if (OC.Assets && OC.Assets.update) OC.Assets.update(def.asset, { kind: 'product' }).catch(() => {});
    registerCustom(); delete iconCache[id]; St.touch('items', { id }); return { ok: true, id };
  }
  function removeCustom(id) { const C = S().custom.items; if (!C[id]) return false; if (St.count(id)) return false; delete C[id]; registerCustom(); St.touch('items', { id, removed: true }); return true; }
  function defaultShop(kind) { return { food: 'food', drink: 'cafe', furniture: 'furniture', clothing: 'clothes', toy: 'gift', gift: 'gift', material: 'market' }[kind] || 'general'; }

  // ---------------- art ----------------
  const iconCache = {};
  /** draw the icon for items that have an `art` descriptor (24-unit box). true = drawn */
  function drawArt(ctx, id) {
    const it = ITEMS[id]; if (!it || !it.art) return false; const a = it.art;
    if (a.img) { const im = OC.Assets && OC.Assets.peek(a.img); if (im) { const s = Math.min(22 / im.width, 22 / im.height); ctx.drawImage(im, 12 - im.width * s / 2, 12 - im.height * s / 2, im.width * s, im.height * s); } else { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.fill(); if (OC.Assets) OC.Assets.image(a.img).then(() => { for (const k of Object.keys(iconCache)) if (k.startsWith(id + '@')) delete iconCache[k]; OC.Style.dropIcon && OC.Style.dropIcon(id); St.emit('items', { id, art: true }); }).catch(() => {}); } return true; }
    const P = OC.ItemArt[a.t]; if (!P) return false; P(ctx, a.a || '#F26B5B', a.b || '#FFFFFF'); return true;
  }

  // ---------------- queries ----------------
  const get = (id) => ITEMS[id] || null;
  const all = () => Object.keys(ITEMS);
  function groupOf(id) { const k = ITEMS[id] && ITEMS[id].kind; const g = GROUPS.find((x) => x[2].includes(k)); return g ? g[0] : 'make'; }
  /** search + filter + sort for the bag / shops / collection. o = { q, group, kind, tag, owned, fav, sort } */
  function query(ids, o = {}) {
    const q = (o.q || '').trim().toLowerCase(), fav = S().favs || {};
    let r = ids.filter((id) => ITEMS[id]);
    if (q) r = r.filter((id) => { const it = ITEMS[id]; return (it.zh + ' ' + (it.d || '') + ' ' + it.tags.join(' ') + ' ' + (KINDS[it.kind] || {}).zh + ' ' + it.src.join(' ')).toLowerCase().includes(q); });
    if (o.group && o.group !== 'all') r = r.filter((id) => groupOf(id) === o.group);
    if (o.kind) r = r.filter((id) => ITEMS[id].kind === o.kind);
    if (o.fav) r = r.filter((id) => fav[id]);
    const by = { name: (a, b) => ITEMS[a].zh.localeCompare(ITEMS[b].zh, 'zh-Hant'), count: (a, b) => St.count(b) - St.count(a), rarity: (a, b) => ITEMS[b].rarity - ITEMS[a].rarity || ITEMS[a].zh.localeCompare(ITEMS[b].zh, 'zh-Hant'), price: (a, b) => (ITEMS[a].price || ITEMS[a].sell || 0) - (ITEMS[b].price || ITEMS[b].sell || 0), kind: (a, b) => GROUPS.findIndex((g) => g[0] === groupOf(a)) - GROUPS.findIndex((g) => g[0] === groupOf(b)) || ITEMS[a].zh.localeCompare(ITEMS[b].zh, 'zh-Hant') }[o.sort || 'kind'];
    return r.sort(by);
  }
  function toggleFav(id) { const f = (S().favs = S().favs || {}); if (f[id]) delete f[id]; else f[id] = Date.now(); St.touch('inv', { fav: id }); return !!f[id]; }
  const isFood = (id) => ITEMS[id] && (ITEMS[id].kind === 'food' || ITEMS[id].kind === 'drink' || (ITEMS[id].kind === 'crop' && ITEMS[id].use));
  /** what dropping this item on an OC does */
  function useKind(id) { const it = ITEMS[id]; if (!it) return null; if (isFood(id)) return it.kind === 'drink' ? 'drink' : 'eat'; if (it.kind === 'toy') return 'play'; if (it.kind === 'clothing') return 'wear'; if (it.kind === 'furniture') return 'place'; if (it.kind === 'gift' || it.kind === 'sea' || it.kind === 'bug' || it.kind === 'fish' || it.kind === 'material' || it.kind === 'crop') return 'gift'; return null; }

  // ======================= OC.Taste: per-OC food preferences =======================
  // levels: 2 最愛 · 1 喜歡 · 0 普通 · -1 討厭 · -2 最討厭. Sources: player (locked), discovered (first taste), derived (not yet tasted)
  const LV = { 2: '最愛', 1: '喜歡', 0: '普通', '-1': '討厭', '-2': '最討厭' };
  function prefs(c) { const t = c.tastes; t.food = t.food || {}; t.flavor = t.flavor || {}; t.tasted = t.tasted || {}; return t; }
  /** personality-derived level for an item the OC has not formed an opinion on (deterministic per OC × item) */
  function derived(c, id) {
    const it = ITEMS[id], t = prefs(c); if (!it) return 0;
    let v = 0; const fl = it.flavor || {};
    for (const [k, w] of Object.entries(fl)) v += (t.flavor[k] || 0) * w * 0.5;
    if (c.tastes.likeItems.includes(id)) v += 2; if (c.tastes.dislikeItems.includes(id)) v -= 2;
    if ((c.profile.likes || []).some((l) => l && it.zh.includes(l))) v += 1.5; if ((c.profile.dislikes || []).some((l) => l && it.zh.includes(l))) v -= 1.5;
    if (OC.Chars.has(c, 'foodie')) v += 0.4; if (OC.Chars.has(c, 'picky')) v -= 0.6;
    if (it.temp === 'hot' && OC.Chars.has(c, 'sensitive')) v -= 0.2;
    v += (OC.hash(OC.hash(c.id.length * 13.7 + c.id.charCodeAt(c.id.length - 1)) * 97 + id.length * 3.1 + id.charCodeAt(0) * 0.37) - 0.5) * 1.6;   // a little individual surprise
    return Math.max(-2, Math.min(2, Math.round(v)));
  }
  /** → { lv, src: 'player'|'discovered'|'unknown', locked } */
  function pref(c, id) { const p = prefs(c).food[id]; if (p) return { lv: p.lv, src: p.src, locked: !!p.locked }; return { lv: derived(c, id), src: 'unknown', locked: false }; }
  /** player sets a level (and optionally locks it so tasting never overrides it) */
  function setPref(c, id, lv, locked) { const t = prefs(c); if (lv == null) delete t.food[id]; else t.food[id] = { lv: Math.max(-2, Math.min(2, lv)), src: 'player', locked: locked !== false }; }
  /** the OC tastes an item → reaction (first taste discovers the preference unless the player locked one) */
  function taste(c, id) {
    const t = prefs(c), rec = t.tasted[id] || (t.tasted[id] = { n: 0, first: null, last: null });
    const first = !rec.n; rec.n++; rec.last = Date.now(); if (first) rec.first = Date.now();
    let p = t.food[id];
    if (!p) { p = t.food[id] = { lv: derived(c, id), src: 'discovered', at: Date.now() }; }
    const lv = p.lv, cat = lv >= 2 ? 'fav' : lv === 1 ? 'like' : lv === 0 ? 'ok' : lv === -1 ? 'dislike' : 'hate';
    if (first) rec.reaction = cat;
    return { lv, cat, first, n: rec.n, discovered: first && p.src === 'discovered' };
  }

  OC.Items = { KINDS, GROUPS, RARITY, FLAVORS, TEXTURES, CUSTOM_KINDS, get, all, query, groupOf, toggleFav, isFood, useKind, registerCustom, saveCustom, removeCustom, defaultShop, drawArt, iconCache };
  OC.Taste = { LV, pref, setPref, taste, derived, prefs };
})();
