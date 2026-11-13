/* OC Shimeji — world places (Phase 5).
 * Registry: every place has an id, scene (OC.Areas[area]), type, map position, parent (interiors),
 * activities it offers (AI verbs), facilities, discoverables (exploration progress), unlock state.
 * Also: travel times (game minutes, used by the life AI), the vegetable garden (growth in game
 * time; water per game day; rain waters), daily forage, critter spots and fish tables. All state
 * lives in the save (save.garden, save.world.forage / critters, save.places).
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, Sim = () => OC.Sim;
  const P = {
    isle: { zh: '晴日島', type: 'home', area: 'isle', map: { x: 0.46, y: 0.68 }, icon: 'home', col: '#6CCB5F', decor: true,
      d: '你和 OC 們的家園。住宅、中央廣場、菜園、果樹、花圃與碼頭都在這裡。', facilities: ['我的家（室內）', '中央廣場', '菜園 ×4', '果樹 ×7', '花圃', '雜貨攤', '碼頭釣魚', '長椅'],
      acts: ['eat', 'drink', 'rest', 'nap', 'tend', 'play', 'observe', 'fish', 'walk', 'explore', 'stretch', 'daydream', 'read'], finds: ['apple', 'orange', 'peach', 'flower', 'shell', 'f_sardine', 'f_silver', 'b_butterfly', 'b_ladybug'] },
    home: { zh: '我的家', type: 'home', area: 'home', parent: 'isle', interior: true, icon: 'home', col: '#F2B33D', decor: true,
      d: '可以自由佈置的家。睡覺、做料理、看書、和朋友聚會。', facilities: ['床', '小廚房（料理）', '書櫃', '自由佈置'], acts: ['sleep', 'nap', 'eat', 'rest', 'read', 'study', 'tidy', 'play', 'daydream'], finds: [] },
    street: { zh: '晴日商店街', type: 'street', area: 'street', map: { x: 0.78, y: 0.55 }, icon: 'cart', col: '#F26B5B',
      d: '食品店、服裝店、家具行、禮品屋與每日市場；還有雲朵咖啡館與葉影圖書館。', facilities: ['晴日食品店', '小針線服裝店', '木木家具行', '星星禮品屋', '每日市場', '雲朵咖啡館', '葉影圖書館'], acts: ['browse', 'rest', 'observe', 'walk', 'play'], finds: [] },
    cafe: { zh: '雲朵咖啡館', type: 'cafe', area: 'cafe', parent: 'street', interior: true, icon: 'apple', col: '#8A5A3C',
      d: '點一杯拿鐵、吃鬆餅、和朋友聊天；也可以借廚房做料理。', facilities: ['點餐櫃台', '咖啡館廚房（料理）', '雙人桌 ×3'], acts: ['eat', 'drink', 'rest', 'read'], finds: ['latte', 'pancake'] },
    library: { zh: '葉影圖書館', type: 'library', area: 'library', parent: 'street', interior: true, icon: 'book', col: '#556080',
      d: '安靜的圖書館。在書桌讀書可以提升閱讀技能。', facilities: ['書櫃 ×4', '閱讀書桌 ×2', '懶骨頭'], acts: ['read', 'study', 'rest', 'nap', 'daydream'], finds: [] },
    forest: { zh: '苔光森林', type: 'nature', area: 'forest', map: { x: 0.21, y: 0.42 }, icon: 'leaf', col: '#3F9A40',
      d: '安靜的森林。採集莓果與香草、觀察小生物、在池塘釣魚。夜晚有螢火蟲。', facilities: ['採集點', '池塘釣魚', '小生物觀察'], acts: ['forage', 'explore', 'observe', 'fish', 'walk', 'rest', 'daydream'],
      finds: ['mushroom', 'berry', 'herb', 'acorn', 'f_carp', 'f_koi', 'f_shrimp', 'b_ladybug', 'b_beetle', 'b_butterfly', 'b_firefly', 'b_snail'] },
    beach: { zh: '星砂海灘', type: 'beach', area: 'beach', map: { x: 0.76, y: 0.3 }, icon: 'sparkle', col: '#4FC3E8',
      d: '細細的星砂與長長的碼頭。釣魚、撿貝殼、看海、在沙灘上玩。', facilities: ['碼頭釣魚', '海邊釣魚', '潮池', '沙灘毛巾', '沙堡'], acts: ['fish', 'observe', 'play', 'rest', 'nap', 'walk', 'explore'],
      finds: ['shell', 'shell_star', 'shell_conch', 'sea_glass', 'f_sardine', 'f_rainbow', 'f_puffer', 'f_starbream', 'f_silver', 'f_moonjelly', 'b_crab'] },
    // 15.2: both opened — real scenes with facilities (js/world/areas15.js)
    hill: { zh: '風車丘', type: 'nature', area: 'hill', map: { x: 0.17, y: 0.8 }, icon: 'leaf', col: '#A58BE0',
      d: '風很大的山丘。老風車還在轉，磨坊賣麵粉和麵包；坡上有薰衣草田、野餐墊，天氣好時有人放風箏。', facilities: ['風車磨坊（商店）', '薰衣草田', '野餐墊', '山丘頂', '採集點', '小生物觀察', '長椅'],
      acts: ['observe', 'rest', 'nap', 'play', 'walk', 'explore', 'forage', 'daydream', 'stretch', 'tend'], finds: ['herb', 'berry', 'flower', 'b_butterfly', 'b_ladybug', 'b_hopper', 'pinwheel'] },
    fair: { zh: '彩虹遊樂園', type: 'fun', area: 'fair', map: { x: 0.82, y: 0.87 }, icon: 'star', col: '#F29AB4',
      d: '摩天輪、旋轉木馬、套圈圈、點心攤，還有可以開演唱會的星光舞台。', facilities: ['星光舞台（演唱會）', '摩天輪', '旋轉木馬', '套圈圈', '點心攤', '長椅'],
      acts: ['ride', 'play', 'observe', 'eat', 'drink', 'rest', 'walk'], finds: ['cotton_candy', 'popcorn', 'soda_float', 'prize_bear', 'prize_star'] },
  };
  const TYPES = { home: '住宅', street: '商店街', cafe: '咖啡館', library: '學習場所', nature: '自然探索', beach: '海灘', fun: '娛樂', island: '其他島嶼' };
  const OUTDOOR = ['isle', 'street', 'forest', 'beach', 'hill', 'fair'];
  const top = (id) => (P[id] && P[id].parent) || id;
  /** travel time in game minutes */
  function travelMin(a, b) { if (a === b) return 0; const ta = top(a), tb = top(b); let m = 0; if (a !== ta) m += 3; if (b !== tb) m += 3; if (ta !== tb) m += 20; return m; }
  const open = (id) => P[id] && !P[id].locked;
  const list = () => Object.keys(P);

  // ---------------- discovery / exploration ----------------
  function visit(id) { const v = S().places.visited; const first = !v[id]; if (first) v[id] = Date.now(); St.touch('places', { id, first }); return first; }
  function progress(id) { const p = P[id]; if (!p || !p.finds || !p.finds.length) return { found: S().places.visited[id] ? 1 : 0, total: 1, pct: S().places.visited[id] ? 100 : 0 }; const found = p.finds.filter((f) => S().seen[f]).length; return { found, total: p.finds.length, pct: Math.round((found / p.finds.length) * 100) }; }

  // ---------------- AI: place preferences (personality) ----------------
  function affinity(c, id) {
    const has = (t) => OC.Chars.has(c, t), p = c.personality; let a = 0;
    const T = P[id] && P[id].type;
    if (T === 'nature') a += (has('nature') ? 0.35 : 0) + (has('curious') ? 0.15 : 0);
    if (T === 'beach') a += (has('curious') ? 0.15 : 0) + (p.energy > 60 ? 0.1 : 0) + ((c.profile.likes || []).some((l) => /海|魚|貝/.test(l)) ? 0.35 : 0);
    if (T === 'library') a += (has('bookworm') ? 0.4 : 0) + (has('shy') ? 0.15 : 0) + (p.thinking > 60 ? 0.1 : 0);
    if (T === 'cafe') a += (has('foodie') ? 0.25 : 0) + (p.social > 60 ? 0.1 : 0);
    if (T === 'street') a += (has('outgoing') || has('social') ? 0.2 : 0) - (has('shy') ? 0.15 : 0);
    if (T === 'fun') a += (has('outgoing') || has('social') || has('cheerful') ? 0.25 : 0) + (p.energy > 60 ? 0.1 : 0) - (has('shy') ? 0.1 : 0);
    if (id === 'hill') a += (has('lazy') ? 0.1 : 0) + (has('dreamy') ? 0.15 : 0);
    if (T === 'home') a += (has('lazy') ? 0.15 : 0) + (has('shy') ? 0.05 : 0);
    const mem = OC.Mind && OC.Mind.placeFeel ? OC.Mind.placeFeel(c, 'place:' + id) : 0;
    return a + mem * 0.2;
  }

  // ======================= garden =======================
  const STAGES = ['空地', '發芽', '長葉', '開花', '可以收成'];
  function plot(id) { const g = S().garden; return g[id] || (g[id] = { seed: null, at: 0, growth: 0, last: 0, wateredDay: -1 }); }
  const day = () => Sim().day();
  const wet = (p) => p.wateredDay === day() || OC.Clock.weather() === 'rain';
  function stageOf(p) { if (!p.seed) return 0; if (p.growth >= 1) return 4; return 1 + Math.min(2, Math.floor(p.growth * 3)); }
  /** advance growth with game time (only while watered today) — called by the scheduler */
  function growAll(g) {
    for (const [id, p] of Object.entries(S().garden)) {
      if (!p.seed || p.growth >= 1) continue;
      if (wet(p)) { if (OC.Clock.weather() === 'rain' && p.wateredDay !== day()) p.wateredDay = day(); const it = OC.Style.ITEMS[p.seed]; const days = (it && it.grow && it.grow.days) || 2; const before = stageOf(p); p.growth = Math.min(1, p.growth + (g / (days * 1440)) * (OC.Growth && OC.Growth.anyHas('fast_grow') ? 1.25 : 1)); if (stageOf(p) !== before) St.emit('garden', { id, stage: stageOf(p) }); }
    }
  }
  function plant(id, seed) {
    const p = plot(id), it = OC.Style.ITEMS[seed]; if (p.seed) return { ok: false, why: '這塊菜園已經種了東西' }; if (!it || !it.grow) return { ok: false, why: '這不是種子' };
    const r = OC.Tx.run(OC.Tx.uid('plant'), { pay: { items: { [seed]: 1 } } }, `種下${it.zh}`); if (!r.ok) return { ok: false, why: r.why[0] };
    Object.assign(p, { seed, at: Sim().now(), growth: 0, wateredDay: -1 }); St.touch('garden', { id }); OC.Progress && OC.Progress.emit('plant', { item: seed, plot: id, place: 'isle' }); return { ok: true };
  }
  function water(id, who) { const p = plot(id); if (!p.seed || p.growth >= 1) return false; if (p.wateredDay === day()) return 'already'; p.wateredDay = day(); p.wateredBy = who || 'player'; St.touch('garden', { id, water: true }); OC.Progress && OC.Progress.emit('water', { plot: id, by: who || 'player', oc: who && who !== 'player' ? who : undefined, place: 'isle' }); return true; }
  function harvest(id) {
    const p = plot(id); if (!p.seed || p.growth < 1) return { ok: false, why: '還沒長好' };
    const it = OC.Style.ITEMS[p.seed], g = it.grow, me = OC.Chars.active(), n = g.n[0] + (OC.hash(p.at * 0.0137) * (g.n[1] - g.n[0] + 1) | 0) + (OC.Growth && OC.Growth.has(me, 'harvest_plus') ? 1 : 0);
    const r = OC.Tx.run(`harvest:${id}:${p.at}`, { get: { items: { [g.crop]: n } } }, `收成${OC.Style.ITEMS[g.crop].zh}`);
    if (!r.ok && !r.dup) return { ok: false, why: r.why[0] };
    const crop = g.crop; Object.assign(p, { seed: null, at: 0, growth: 0, wateredDay: -1 }); St.touch('garden', { id, harvested: crop });
    if (r.ok && OC.Progress) { OC.Progress.emit('harvest', { item: crop, count: 1, n, plot: id, place: 'isle', oc: me && me.id }); if (me) OC.Mind.skill(me, 'garden', 3); }
    return { ok: true, crop, n, firsts: r.firsts || [] };
  }

  // ======================= daily forage & critters =======================
  function forageAvail(area, i) { const f = (S().world.forage = S().world.forage || {}); const k = area + ':' + i; return f[k] !== day(); }
  function forage(area, i, kind) {
    const k = `${area}:${i}`, f = (S().world.forage = S().world.forage || {}); if (f[k] === day()) return { ok: false, why: '今天已經採過了，明天再來' };
    const me = OC.Chars.active(), extra = OC.Growth && OC.Growth.has(me, 'keen_eye') && OC.hash(day() * 3.1 + i * 7.7) < 0.5 ? 1 : 0;
    const n = (kind === 'berry' ? 2 : 1) + extra, r = OC.Tx.run(`forage:${k}:${day()}`, { get: { items: { [kind]: n } } }, '採集'); f[k] = day(); St.touch('world');
    if (r.ok && OC.Progress) { OC.Progress.emit('forage', { item: kind, place: area, oc: me && me.id, n }); if (me) OC.Mind.skill(me, 'explore', 1.5); }
    return r.ok ? { ok: true, item: kind, n, extra, firsts: r.firsts } : { ok: false, why: r.why[0] };
  }
  /** a critter spot shows its species when conditions match; once per half game-day */
  function critterAt(area, i) {
    const spots = OC.Areas[area] && OC.Areas[area].critterSpots; if (!spots || !spots[i]) return null; const [, , sp] = spots[i];
    const ph = OC.Clock.phase(OC.Clock.hour()), wx = OC.Clock.weather();
    const ok = { b_butterfly: ph !== 'night' && wx !== 'rain', b_ladybug: ph !== 'night', b_firefly: ph === 'night', b_beetle: true, b_snail: wx === 'rain' || ph === 'dusk', b_crab: true, b_hopper: ph !== 'night' && wx !== 'rain' }[sp];
    if (!ok) return null; const slot = Math.floor(Sim().now() / 720); const c = (S().world.critters = S().world.critters || {}); if (c[area + ':' + i] === slot) return null;
    return { species: sp, slot, key: `critter:${area}:${i}:${slot}` };
  }
  function critterDone(area, i, slot) { (S().world.critters = S().world.critters || {})[area + ':' + i] = slot; St.touch('world'); }

  // ======================= fishing =======================
  const FISH = {
    sea: [['f_sardine', 30], ['f_silver', 22], ['f_puffer', 10, (c) => true], ['f_rainbow', 9, (c) => c.wx === 'clear'], ['f_starbream', 6, (c) => c.ph === 'dusk' || c.ph === 'morning'], ['f_moonjelly', 3, (c) => c.ph === 'night']],
    pond: [['f_carp', 34], ['f_shrimp', 26], ['f_koi', 6, (c) => c.wx === 'rain' || c.ph === 'morning']],
  };
  /** what bites (skill and the OC's luck nudge the rare ones) */
  function fishRoll(water, skillLv = 0) {
    const c = { ph: OC.Clock.phase(OC.Clock.hour()), wx: OC.Clock.weather() };
    const pool = FISH[water].filter((f) => !f[2] || f[2](c)).map(([id, w]) => [id, w * (OC.Style.ITEMS[id].rarity >= 3 ? 1 + skillLv * 0.15 : 1)]);
    return Sim().wpick(pool, (x) => x[1])[0];
  }

  // ======================= starter furniture for rooms =======================
  const STARTER = {
    home: [{ id: 'bed', x: 284, y: 318, rot: 0 }, { id: 'bookshelf', x: 120, y: 276, rot: 0 }, { id: 'stove', x: 200, y: 276, rot: 0 }, { id: 'rug', x: 186, y: 390, rot: 0 }, { id: 'cushion', x: 110, y: 420, rot: 0 }, { id: 'plant', x: 310, y: 440, rot: 0 }, { id: 'lamp', x: 92, y: 330, rot: 0 }],
    cafe: [{ id: 'table', x: 130, y: 400 }, { id: 'table', x: 310, y: 400 }, { id: 'table', x: 220, y: 470 }],
    library: [{ id: 'desk', x: 150, y: 400 }, { id: 'desk', x: 290, y: 400 }, { id: 'cushion', x: 360, y: 470 }, { id: 'cushion', x: 80, y: 470 }],
  };
  /** furniture list of a place (created from the starter set the first time) */
  function room(id) {
    const R = (S().rooms = S().rooms || {});
    if (!R[id]) { R[id] = (STARTER[id] || []).map((f, i) => Object.assign({ uid: `s_${id}_${i}`, rot: 0, sc: 1, fixed: !P[id] || !P[id].decor }, f)); St.touch(); }
    return R[id];
  }

  OC.Places = { P, TYPES, OUTDOOR, top, travelMin, open, list, visit, progress, affinity, STAGES, plot, stageOf, wet, growAll, plant, water, harvest, forageAvail, forage, critterAt, critterDone, FISH, fishRoll, STARTER, room, get: (id) => P[id] || null };
})();
