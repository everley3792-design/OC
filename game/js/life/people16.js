/* OC Shimeji — 16.1 OC.People: species, life stages, age.
 *
 * Species — about twenty, each with a few real effects in the same format as the 13.0 traits (need decay multipliers, activity
 *   preferences, walking speed, emotional sensitivity) so the existing hooks (OC.Traits13.decay / act / speed / sens) pick them up.
 *   The player can make their own species (S().species16: a name, a base species to start from and sliders). A species never
 *   blocks an interaction; it only shifts tendencies.
 * Life stages — 嬰兒 0–1, 幼兒 2–3, 兒童 4–12, 青少年 13–17, 成人 18–39, 中年 40–59, 長者 60+. The age is the player's own number
 *   (profile.age). A stage changes tendencies too, and a few things are simply not possible for the very young (a baby does not
 *   cook or wander off to another place) — see canDo(). Children and teenagers are never part of anything romantic: romanceOK()
 *   asks minor() first, whatever the settings say.
 * Growing up — per character (c.life.age16.grow): 'auto' (a year older on the birthday, by the calendar in use), 'manual' (only
 *   when the player presses 長大一歲 — the 15.5 behaviour and the default for characters from older saves) or 'fixed' (never).
 *   A year passes once: key age16:<oc>:<calendar year> (the same record the 15.5 button uses).
 * Rig-drawn characters are drawn smaller when they are young (heightOf); imported pictures keep the size the player gave them. */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store;

  // ---------------------------------------------------------------- species
  /* [id, 名稱, 說明, fx, ears (rig look when picked in the creator), span (life length, used by the 16.8 life cycle)] */
  const SP = [
    ['human', '人類', '什麼都適應得不錯。', {}, 'none', 1],
    ['cat', '貓', '愛睡、愛曬太陽，好奇心重。', { need: { sleep: 1.15 }, act: { nap: 0.2, observe: 0.15 } }, 'cat', 1],
    ['bunny', '兔', '跳得快、膽子小，喜歡蔬菜。', { speed: 1.1, emo: { nervous: 1.25 }, act: { tend: 0.15 } }, 'bunny', 1],
    ['bear', '熊', '慢條斯理，吃得多，冬天特別想睡。', { speed: 0.92, need: { food: 1.2 }, act: { eat: 0.15, rest: 0.1 } }, 'bear', 1],
    ['dog', '狗', '很黏人，喜歡散步和大家在一起。', { need: { social: 1.25, active: 1.15 }, act: { walk: 0.2, play: 0.15 }, accept: 0.1 }, 'dog', 1],
    ['fox', '狐', '聰明、愛惡作劇、晚上比較有精神。', { act: { prank: 0.2, explore: 0.15 }, emo: { curious: 1.2 } }, 'fox', 1],
    ['bird', '鳥', '愛高處、愛唱歌，起得很早。', { speed: 1.05, act: { stargaze: 0.15, observe: 0.2 }, need: { active: 1.1 } }, 'none', 0.9],
    ['mouse', '鼠', '個子小、手很巧，喜歡收集小東西。', { speed: 1.08, act: { forage: 0.25, tidy: 0.1 }, emo: { nervous: 1.15 } }, 'none', 0.8],
    ['deer', '鹿', '安靜溫和，喜歡森林和花草。', { act: { tend: 0.2, walk: 0.1 }, emo: { calm: 1.2 } }, 'none', 1],
    ['wolf', '狼', '重視夥伴，不輕易親近陌生人。', { need: { social: 1.1 }, accept: -0.1, act: { explore: 0.15 } }, 'dog', 1],
    ['sheep', '羊', '軟綿綿的，很怕冷也很好睡。', { need: { comfort: 1.2, sleep: 1.1 }, act: { rest: 0.15 } }, 'none', 1],
    ['owl', '貓頭鷹', '晚上清醒、白天想睡，書讀得多。', { act: { read: 0.25, study: 0.15, stargaze: 0.2 } }, 'none', 1.2],
    ['fish', '魚', '喜歡水邊，在陸地上比較容易累。', { need: { energy: 1.15 }, act: { fish: -0.3, observe: 0.1 } }, 'none', 0.9],
    ['dragon', '龍', '活很久、很能吃，脾氣來得快去得也快。', { need: { food: 1.3 }, emo: { annoyed: 1.2, proud: 1.2 } }, 'none', 3],
    ['slime', '史萊姆', '不怕髒、吃得少，摔了也沒事。', { need: { food: 0.7, comfort: 0.8 }, speed: 0.9 }, 'none', 1.5],
    ['robot', '機器人', '不用睡，但需要休息充電；對新東西很有興趣。', { need: { sleep: 0.25, energy: 1.2, food: 0.6 }, act: { study: 0.15 }, emo: { curious: 1.2 } }, 'none', 5],
    ['ghost', '幽靈', '輕飄飄、不太餓，喜歡晚上和安靜的地方。', { need: { food: 0.5, active: 0.8 }, act: { stargaze: 0.2, daydream: 0.15 } }, 'none', 10],
    ['plant', '植物系', '喜歡陽光和水，種田特別在行。', { need: { food: 0.8 }, act: { tend: 0.3 }, speed: 0.92 }, 'none', 1.5],
    ['sprite', '小精靈', '輕巧、愛玩、對魔法般的東西著迷。', { speed: 1.1, act: { play: 0.2, explore: 0.1 } }, 'none', 2],
    ['other', '其他', '由你自己決定牠是什麼。', {}, 'none', 1],
  ];
  const BASE = Object.fromEntries(SP.map(([id, zh, d, fx, ears, span]) => [id, { id, zh, d, fx, ears, span, builtin: true }]));
  /** the player's own species: { id: 'u…', zh, base, d, need: {food, sleep, social, energy} multipliers 0.5–1.5, speed 0.8–1.2, span } */
  const custom = () => { const s = S(); if (!s.species16) s.species16 = {}; return s.species16; };
  function get(id) {
    if (BASE[id]) return BASE[id];
    const u = custom()[id]; if (!u) return BASE.other;
    const b = BASE[u.base] || BASE.human, fx = JSON.parse(JSON.stringify(b.fx || {}));
    fx.need = Object.assign({}, fx.need || {}); for (const k of ['food', 'sleep', 'social', 'energy']) if (u.need && u.need[k] != null) fx.need[k] = (fx.need[k] || 1) * u.need[k];
    if (u.speed) fx.speed = (fx.speed || 1) * u.speed;
    return { id, zh: u.zh || '自訂物種', d: u.d || `以${b.zh}為基礎的自訂物種。`, fx, ears: b.ears, span: u.span || b.span, builtin: false, base: b.id };
  }
  const all = () => SP.map((x) => BASE[x[0]]).concat(Object.keys(custom()).map(get));
  function addCustom(o) {
    const id = 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e3).toString(36), zh = String(o.zh || '').trim().slice(0, 10);
    if (!zh) return { ok: false, why: '請幫這個物種取個名字' };
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 1));
    custom()[id] = { zh, base: BASE[o.base] ? o.base : 'human', d: String(o.d || '').slice(0, 60), need: { food: cl(o.food, 0.5, 1.5), sleep: cl(o.sleep, 0.3, 1.5), social: cl(o.social, 0.5, 1.5), energy: cl(o.energy, 0.5, 1.5) }, speed: cl(o.speed, 0.8, 1.2), span: cl(o.span, 0.5, 10) };
    syncList(); St.touch('species'); return { ok: true, id };
  }
  /** keep OC.Chars.SPECIES (the old [id, 名稱] list the editors read) in step with this table */
  function syncList() { const L = OC.Chars && OC.Chars.SPECIES; if (!L) return; L.length = 0; for (const s of all()) L.push([s.id, s.zh]); }

  // ---------------------------------------------------------------- life stages
  /* [id, 名稱, from age, fx, rig height factor] */
  const ST = [
    ['baby', '嬰兒', 0, { need: { sleep: 1.5, food: 1.3, social: 1.3, energy: 1.2 }, speed: 0.45 }, 0.5],
    ['toddler', '幼兒', 2, { need: { sleep: 1.25, food: 1.15, social: 1.2 }, speed: 0.7, act: { play: 0.3 } }, 0.62],
    ['child', '兒童', 4, { need: { active: 1.2, fun: 1.2 }, speed: 0.95, act: { play: 0.25, explore: 0.15 } }, 0.78],
    ['teen', '青少年', 13, { need: { sleep: 1.1, social: 1.1 }, act: { daydream: 0.1 } }, 0.94],
    ['adult', '成人', 18, {}, 1],
    ['middle', '中年', 40, { need: { energy: 1.1 }, act: { rest: 0.1 } }, 1],
    ['elder', '長者', 60, { need: { energy: 1.25, sleep: 1.1 }, speed: 0.82, act: { rest: 0.2, stargaze: 0.1, play: -0.1 } }, 0.97],
  ];
  const STAGE = Object.fromEntries(ST.map(([id, zh, from, fx, h]) => [id, { id, zh, from, fx, h }]));
  const ageOf = (c) => { const a = parseInt(String((c && c.profile && c.profile.age) || '').replace(/[^\d]/g, ''), 10); return a >= 0 && a < 10000 ? a : null; };
  function stage(c) { const a = ageOf(c); if (a == null) return null; let s = ST[0]; for (const x of ST) if (a >= x[2]) s = x; return Object.assign({ age: a }, STAGE[s[0]]); }
  /** under 18 by the age the player wrote — never part of anything romantic */
  const minor = (c) => { const s = stage(typeof c === 'string' ? OC.Chars.get(c) : c); return !!s && s.from < 18; };
  /* what the very young cannot do (everything else is open; tendencies come from fx) */
  const BABY_OK = new Set(['eat', 'drink', 'rest', 'nap', 'sleep', 'play', 'observe', 'daydream', 'greet', 'chat', 'food']);
  const TODDLER_NO = new Set(['cook', 'fish', 'study', 'work', 'forage', 'tend', 'browse', 'argue', 'prank', 'gift', 'ride', 'wheel']);
  const CHILD_NO = new Set(['work']);
  function canDo(c, act) {
    const s = stage(c); if (!s) return true;
    if (s.id === 'baby') return BABY_OK.has(act);
    if (s.id === 'toddler') return !TODDLER_NO.has(act);
    if (s.id === 'child') return !CHILD_NO.has(act);
    return true;
  }
  /** may this character set off for another place on its own? (babies and toddlers stay where they are) */
  const canTravel = (c) => { const s = stage(c); return !s || !['baby', 'toddler'].includes(s.id); };
  const whyNot = (c, act) => { const s = stage(c); return s && !canDo(c, act) ? `${s.zh}還不能做這件事` : ''; };
  /** rig-drawn characters are smaller while they are young */
  function heightOf(c) { const s = stage(c); return s && !(c.appearance && c.appearance.mode === 'sprite') ? s.h : 1; }

  /** the pseudo-traits a character carries (species + stage) — OC.Traits13 adds their fx to the real traits' */
  function fxList(c) { const out = []; const sp = c && c.profile && get(c.profile.species || 'human'); if (sp && sp.fx) out.push({ zh: sp.zh, fx: sp.fx }); const s = stage(c); if (s && s.fx) out.push({ zh: s.zh, fx: s.fx }); return out; }

  // ---------------------------------------------------------------- growing up
  const A16 = (c) => { const l = c.life; if (!l.age16) l.age16 = { grow: 'manual' }; return l.age16; };
  const GROW = [['auto', '生日自動長大'], ['manual', '我按了才長大'], ['fixed', '固定年齡']];
  const yearKey = () => { const cl = OC.Clock.cal(); return cl.mode === 'game' ? 'Y' + cl.year : String(cl.year); };
  /** one year older (once per calendar year). why: 'birthday' | 'player' */
  function growUp(c, why) {
    const a = ageOf(c); if (a == null) return { ok: false, why: '還沒有寫年齡' };
    const k = `age:${c.id}:${yearKey()}`, done = (S().play.aged = S().play.aged || {}); if (done[k]) return { ok: false, why: '今年已經長大過了' };
    const s0 = stage(c); c.profile.age = String(a + 1); done[k] = Date.now(); OC.Chars.save(c); const s1 = stage(c);
    OC.Mind.remember(c, { type: 'milestone', imp: 0.8, text: `${s1.age} 歲了${s1.id !== s0.id ? `，成為${s1.zh}` : ''}`, key: k });
    if (s1.id !== s0.id) { OC.Mind.feel(c, 'proud', 0.6, '長大了'); St.emit('people:stage', { c, from: s0, to: s1, why }); }
    St.touch('chars', { id: c.id }); return { ok: true, from: s0, to: s1 };
  }
  /** called on a character's birthday (OC.Island): 'auto' grows, 'manual' leaves a letter, 'fixed' does nothing */
  function birthday(c) {
    const g = A16(c).grow; if (ageOf(c) == null || g === 'fixed') return null;
    if (g === 'auto') return growUp(c, 'birthday');
    if (OC.Budget) OC.Budget.mail({ kind: 'birthday', oc: c.id, title: `${OC.Chars.name(c)}的生日`, text: `今天是${OC.Chars.name(c)}的生日。要讓${OC.Mind.pron(c)}長大一歲的話，到角色檔案的「心裡的事」按「長大一歲」。`, key: 'bdaymail:' + c.id + ':' + yearKey() });
    return null;
  }
  function setGrow(c, v) { if (!GROW.some((g) => g[0] === v)) return; A16(c).grow = v; OC.Chars.save(c); }

  function init() {
    syncList();
    /* a stage change is a small moment: a card + the cue (the data has already changed — Stage never changes data) */
    St.on('people:stage', (e) => { if (OC.Sim.catching) return; OC.Sound && OC.Sound.cue && OC.Sound.cue('relUp'); OC.UI.toast(`${OC.Chars.name(e.c)}成為${e.to.zh}了（${e.to.age} 歲）`, 'sparkle');
      if (OC.Stage && OC.Stage.card) OC.Stage.card({ kind: 'asp', ic: 'sparkle', title: `${OC.Chars.name(e.c)}成為${e.to.zh}了`, sub: `${e.to.age} 歲` }); });
  }

  OC.People = { SPECIES: SP, STAGES: ST, STAGE, GROW, get, all, addCustom, custom, syncList, ageOf, stage, minor, canDo, canTravel, whyNot, heightOf, fxList, growUp, birthday, setGrow, age16: A16, init };
})();
