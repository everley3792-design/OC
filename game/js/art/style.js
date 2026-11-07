/* OC Shimeji — Sunny Isle art direction for the game: character style, OC data model,
 * parts lists for the editor/wardrobe, the item / furniture catalogue and their icon art.
 * Everything here is original artwork drawn in code (no external sprites).
 */
(function () {
  'use strict';
  const { TAU, clamp, rr, ellipse, mix, rgba } = OC;
  const V = OC.V;

  // ---- world palette (shared with the 3D world) ----
  const P = {
    sea: '#4FC3E8', seaDeep: '#2FA3D6', shallow: '#8FE3F2', sand: '#F7E3A8', sandLo: '#E9C97E',
    grassA: '#86CF5E', grassB: '#78C553', grassLo: '#5AA842', lip: '#5DB040', cliff: '#D2A56E', cliffLo: '#A97D4C',
    river: '#62CBEF', wood: '#C88B55', woodLo: '#A06A3C', stone: '#CFC7B8', stoneLo: '#A99F8E', path: '#EBD6A0',
    coral: '#F26B5B', teal: '#3FC1B0', yellow: '#FFC93C', purple: '#9B7BE0', pink: '#F48FB1', blue: '#5BC0EB', cream: '#FFF2D8', white: '#FFFFFF',
  };

  // ---- character style (scheme E rig, dot eyes, flat toy shading) ----
  const ST = { mat: 'flat', outline: null, face: 'dot', head: { rx: 17.5, ry: 15.6, y: -30 }, body: { rx: 9.6, ry: 8.8, y: -9.6 }, cheekA: 0.72, shadowA: 0.22, shadowCol: '#2c5a3a', dx: 2, dy: 2.2 };

  const EARS = [['cat', '貓耳'], ['bunny', '兔耳'], ['bear', '熊耳'], ['fold', '摺耳'], ['round', '圓耳'], ['sprout', '小芽']];
  const TAILS = [['cat', '長尾'], ['puff', '毛球尾']];
  const FURS = ['#FFF7EC', '#F6E3C8', '#E7A86A', '#C98E62', '#8E6A54', '#B9B8F0', '#BFE3C8', '#FFD1DC', '#CFE6F5', '#6F6A7E', '#F2C14E', '#FFFFFF'];
  const EYES = ['#3B2B25', '#2E2A44', '#2F4A6B', '#3F6B3A', '#7A3B4F'];
  const CHEEKS = ['#FF9E9E', '#FF8E7A', '#FF9EC4', '#F7B267', '#C9A7F0'];
  const SHIRTS = ['#5BC0EB', '#FFC93C', '#F48FB1', '#3FC1B0', '#F26B5B', '#9B7BE0', '#FFFFFF', '#6CCB5F', '#556080'];
  const PATTERNS = [['none', '素面'], ['stripe', '條紋'], ['star', '星星']];
  const ACCS = [['none', '無'], ['scarf', '圍巾'], ['beanie', '毛帽'], ['hood', '兜帽']];
  const CLIPS = [['none', '無'], ['flower', '小花'], ['leaf', '葉子'], ['star', '星星']];
  const TRAITS = [
    { id: 'cheerful', zh: '開朗', d: '心情下降較慢' }, { id: 'sleepy', zh: '愛睡', d: '休息時恢復更多精力' },
    { id: 'foodie', zh: '貪吃', d: '吃東西時心情也會變好' }, { id: 'social', zh: '社交達人', d: '聊天獲得更多社交' },
    { id: 'curious', zh: '好奇', d: '採集時偶爾多拿一個' }, { id: 'artsy', zh: '文藝', d: '完成動畫時心情大幅提升' },
    { id: 'tidy', zh: '愛整潔', d: '佈置家具時心情提升' }, { id: 'shy', zh: '害羞', d: '社交需求下降較慢' },
  ];
  const PRESETS = {
    mochi: { name: '麻糬', fur: '#FFF7EC', inner: '#FFB8B0', cheek: '#FF9E9E', eye: '#3B2B25', ears: 'cat', tail: 'cat', shirt: '#5BC0EB', pattern: 'stripe', acc: 'none', accCol: '#F26B5B', clip: 'none' },
    kuri: { name: '栗子', fur: '#E7A86A', inner: '#FFD0B0', cheek: '#FF8E7A', eye: '#3B2B25', ears: 'bunny', tail: 'puff', shirt: '#FFC93C', pattern: 'star', acc: 'none', accCol: '#3FC1B0', clip: 'flower' },
    sora: { name: '小空', fur: '#B9B8F0', inner: '#FFC4DD', cheek: '#FF9EC4', eye: '#2E2A44', ears: 'bear', tail: 'puff', shirt: '#F48FB1', pattern: 'none', acc: 'beanie', accCol: '#3FC1B0', clip: 'none' },
  };
  function defaultOC() { return Object.assign({ id: 'me', traits: ['cheerful', 'curious'], bio: '', birthday: '' }, JSON.parse(JSON.stringify(PRESETS.mochi))); }
  /** OC data → rig design (derived colours) */
  function design(oc) {
    return {
      fur: oc.fur, shade: mix(oc.fur, '#7a4a30', 0.17), inner: oc.inner || '#FFB8B0', cheek: oc.cheek, eye: oc.eye, ears: oc.ears, tail: oc.tail,
      shirt: oc.shirt, pattern: oc.pattern === 'none' ? null : oc.pattern, legs: oc.fur,
      acc: oc.acc === 'none' ? null : oc.acc, accCol: oc.accCol || '#F26B5B', clip: oc.clip === 'none' ? null : oc.clip, muzzle: '#FFFFFF',
    };
  }
  const _dcache = new WeakMap();
  function designOf(oc) { let d = _dcache.get(oc); if (!d || d._k !== JSON.stringify(oc)) { d = design(oc); d._k = JSON.stringify(oc); _dcache.set(oc, d); } return d; }
  /** draw an OC with the rig. s = rig state (face, back, walk, phase, blink, eyes, mouth, …) */
  function drawOC(ctx, oc, s, x, y, sc, t) { OC.VC.draw(ctx, designOf(oc), s, x, y, sc, t || 0, ST); }

  // ---- catalogue ----
  // kind: food | material | gift | furniture | clothing
  const ITEMS = {
    apple: { zh: '蜜蘋果', kind: 'food', sell: 40, use: { food: 18, mood: 2 }, d: '果樹搖一搖就會掉下來，又甜又脆。' },
    orange: { zh: '晴日橘', kind: 'food', sell: 40, use: { food: 16, energy: 4 }, d: '陽光味道的橘子。' },
    peach: { zh: '雲朵桃', kind: 'food', sell: 45, use: { food: 18, mood: 4 }, d: '軟綿綿的桃子。' },
    mushroom: { zh: '森林蘑菇', kind: 'food', sell: 55, use: { food: 12, energy: 6 }, d: '苔光森林的小蘑菇，煮湯很香。' },
    cake: { zh: '草莓蛋糕', kind: 'food', price: 120, sell: 50, use: { food: 35, mood: 12 }, d: '特別日子的甜點。' },
    milk: { zh: '鮮奶', kind: 'food', price: 40, sell: 15, use: { food: 10, energy: 12 }, d: '一口氣喝完精神百倍。' },
    flower: { zh: '小雛菊', kind: 'gift', sell: 10, use: { mood: 8 }, d: '花圃裡摘的小花，可以送人。' },
    shell: { zh: '貝殼', kind: 'material', sell: 30, d: '海灘上撿到的漂亮貝殼。' },
    star: { zh: '星星糖', kind: 'gift', price: 60, sell: 20, use: { mood: 12 }, d: '亮晶晶的糖果，很多人都喜歡。' },
    lamp: { zh: '蘑菇檯燈', kind: 'furniture', price: 160, sell: 60, d: '晚上會亮的檯燈，可以點擊開關。', fp: [1, 1] },
    cushion: { zh: '雲朵靠墊', kind: 'furniture', price: 90, sell: 35, d: '可以坐下休息。', fp: [1, 1], sit: true },
    plant: { zh: '小盆栽', kind: 'furniture', price: 60, sell: 25, d: '綠意盎然的盆栽。', fp: [1, 1] },
    rug: { zh: '貓掌地毯', kind: 'furniture', price: 150, sell: 55, d: '圓圓的地毯，可以在上面走。', fp: [2, 2], walk: true },
    chair: { zh: '木頭椅', kind: 'furniture', price: 120, sell: 45, d: '可以坐下休息。', fp: [1, 1], sit: true },
    table: { zh: '野餐圓桌', kind: 'furniture', price: 180, sell: 70, d: '放在戶外的小圓桌。', fp: [2, 2] },
    // clothing unlocks (owned once → available in the wardrobe)
    'acc-scarf': { zh: '暖暖圍巾', kind: 'clothing', price: 140, d: '在衣櫥裡選用。', slot: 'acc', val: 'scarf' },
    'acc-hood': { zh: '小兜帽', kind: 'clothing', price: 160, d: '在衣櫥裡選用。', slot: 'acc', val: 'hood' },
    'clip-star': { zh: '星星髮夾', kind: 'clothing', price: 80, d: '在衣櫥裡選用。', slot: 'clip', val: 'star' },
    'clip-leaf': { zh: '葉子髮夾', kind: 'clothing', price: 50, d: '在衣櫥裡選用。', slot: 'clip', val: 'leaf' },
    'pat-star': { zh: '星星印花', kind: 'clothing', price: 90, d: '在衣櫥裡選用。', slot: 'pattern', val: 'star' },
  };
  // free wardrobe basics
  const FREE_WEAR = { acc: ['none', 'beanie'], clip: ['none', 'flower'], pattern: ['none', 'stripe'] };
  const SHOP = ['milk', 'cake', 'star', 'plant', 'cushion', 'chair', 'lamp', 'rug', 'table', 'clip-leaf', 'clip-star', 'pat-star', 'acc-scarf', 'acc-hood'];
  const KIND_ZH = { food: '食物', material: '素材', gift: '禮物', furniture: '家具', clothing: '服飾' };

  // ---- item icon art (24-unit grid, flat toy shading) ----
  const M = (base, shade) => ({ mode: 'flat', base, shade: shade || mix(base, '#3a2030', 0.25), dx: 1.2, dy: 1.4 });
  function extra(ctx, id) {
    const El = (cx, cy, rx, ry, b, s) => V.paint(ctx, (ox, oy) => ellipse(ctx, cx + ox, cy + oy, rx, ry), M(b, s));
    const Rr = (x, y, w, h, r, b, s) => V.paint(ctx, (ox, oy) => rr(ctx, x + ox, y + oy, w, h, r), M(b, s));
    switch (id) {
      case 'orange': El(12, 13, 7, 6.8, '#FF9A3C'); El(12, 6.6, 1.2, 1, '#6B4F3A'); El(14.6, 5.8, 2.6, 1.2, '#5FBF62'); ctx.fillStyle = 'rgba(255,255,255,.5)'; ellipse(ctx, 9.4, 10.6, 1.4, 1); ctx.fill(); return true;
      case 'peach': El(12, 13.2, 7, 6.6, '#FFB3A7'); ctx.strokeStyle = 'rgba(200,90,90,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, 7.5); ctx.quadraticCurveTo(9.6, 13, 12, 19.4); ctx.stroke(); El(15, 6.4, 2.8, 1.3, '#5FBF62'); return true;
      case 'mushroom': Rr(9.4, 11, 5.2, 8.5, 2.4, '#FFF4DC'); V.paint(ctx, (ox, oy) => { ctx.beginPath(); ctx.ellipse(12 + ox, 11.5 + oy, 8.5, 6.5, 0, Math.PI, TAU); ctx.closePath(); }, M('#F26B5B')); ctx.fillStyle = '#fff'; for (const [a, b, r] of [[8.5, 8.6, 1.3], [13.5, 7, 1.1], [15.5, 10, 0.9]]) { ellipse(ctx, a, b, r, r); ctx.fill(); } return true;
      case 'chair': Rr(6, 4, 12, 9, 3, '#D9A26A'); Rr(5, 12, 14, 4, 2, '#C88B55'); Rr(6, 15, 2.4, 6, 1, '#A06A3C'); Rr(15.6, 15, 2.4, 6, 1, '#A06A3C'); return true;
      case 'table': El(12, 9.5, 9.5, 4.2, '#D9A26A'); Rr(10.6, 10, 2.8, 9.5, 1.2, '#A06A3C'); El(12, 19.6, 4.5, 1.4, '#A06A3C'); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6; ellipse(ctx, 9, 8.5, 3, 1.2); ctx.fill(); ctx.globalAlpha = 1; return true;
      case 'acc-scarf': Rr(4, 8, 16, 5, 2.5, '#F26B5B'); Rr(13, 10, 4.5, 10, 2, '#E0574A'); ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 3; i++) ctx.fillRect(5 + i * 5, 9.2, 2, 2.6); return true;
      case 'acc-hood': V.paint(ctx, (ox, oy) => { ctx.beginPath(); ctx.ellipse(12 + ox, 12 + oy, 8.5, 8, 0, Math.PI * 0.85, Math.PI * 2.15); ctx.quadraticCurveTo(12 + ox, 9 + oy, 4.6 + ox, 15.5 + oy); ctx.closePath(); }, M('#3FC1B0')); return true;
      case 'clip-star': V.icon(ctx, 'star', 12, 12, 18, '#FFD23F'); return true;
      case 'clip-leaf': El(12, 12, 7.5, 3.6, '#7CCB5A'); ctx.strokeStyle = '#4FA35A'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(19, 12); ctx.stroke(); return true;
      case 'pat-star': Rr(5, 6, 14, 14, 4, '#5BC0EB'); V.icon(ctx, 'star', 12, 13, 9, '#fff'); return true;
    }
    return false;
  }
  function drawItem(ctx, id, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12);
    V.shadow(ctx, 12, 20.8, 8, 2.2, 0.18);
    if (!extra(ctx, id)) { ctx.restore(); V.item(ctx, id, x, y, s, { mode: 'flat', noShadow: true }); return; }
    ctx.restore();
  }
  const iconCache = {};
  /** cached item icon canvas (art only — colourful in both UI themes, like stickers) */
  function itemCanvas(id, px = 96) {
    const k = id + '@' + px; if (iconCache[k]) return iconCache[k];
    const c = OC.makeCanvas(px, px), x = c.getContext('2d'); x.scale(px / 24, px / 24); drawItem(x, id, 12, 12, 24); return (iconCache[k] = c);
  }
  function itemImg(id, cls = '') { const c = itemCanvas(id); const img = new Image(); img.src = c.toDataURL(); img.className = cls; img.alt = ITEMS[id] ? ITEMS[id].zh : id; img.draggable = false; return img; }
  const _urls = {}; function itemURL(id) { return _urls[id] || (_urls[id] = itemCanvas(id).toDataURL()); }

  /** portrait canvas of an OC (rig or the player's sprite) */
  function portrait(canvas, oc, opt = {}) {
    const px = canvas.width, x = canvas.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, px, canvas.height);
    const sp = opt.sprite;
    if (sp && sp.img) { const s = Math.min(px / sp.img.width, canvas.height / sp.img.height) * (opt.fill || 0.9); const w = sp.img.width * s, h = sp.img.height * s; x.drawImage(sp.img, (px - w) / 2, canvas.height - h - canvas.height * 0.04, w, h); return; }
    const sc = (opt.scale || 1) * px / 80;
    drawOC(x, oc, Object.assign({ blink: 0, eyes: 'round', mouth: 'smile', noShadow: !opt.shadow }, opt.state || {}), px / 2, canvas.height * (opt.feet || 0.94), sc, opt.t || 0);
  }

  OC.Style = { P, ST, EARS, TAILS, FURS, EYES, CHEEKS, SHIRTS, PATTERNS, ACCS, CLIPS, TRAITS, PRESETS, ITEMS, SHOP, FREE_WEAR, KIND_ZH, defaultOC, design, designOf, drawOC, drawItem, itemCanvas, itemImg, itemURL, portrait };
})();
