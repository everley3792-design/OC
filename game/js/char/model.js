/* OC Shimeji — character model (save schema v2).
 * One record per OC: profile, personality (6 sliders + traits + custom traits), Little
 * Quirks, speech, tastes, look (rig params), custom parts (asset refs on anchors), action →
 * animation map, needs, growth (discoveries that need the player's consent).
 * `behavior(char)` turns personality + quirks into concrete numbers the world/preview use,
 * so personality is observable (speed, bounce, blink, greetings, idle habits, speech…).
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------------- catalogues (original wording) ----------------
  const SLIDERS = [
    { id: 'pace', zh: '行動節奏', lo: '慢條斯理', hi: '急急忙忙' },
    { id: 'energy', zh: '活力', lo: '悠哉', hi: '精力充沛' },
    { id: 'social', zh: '社交傾向', lo: '內向', hi: '外向' },
    { id: 'expression', zh: '情緒表達', lo: '含蓄', hi: '誇張' },
    { id: 'thinking', zh: '思考方式', lo: '感性', hi: '理性' },
    { id: 'speech', zh: '說話風格', lo: '文靜', hi: '直率' },
  ];
  const TRAITS = [
    // group: 社交 social / 情緒 mood / 生活 life / 興趣 interest
    { id: 'shy', zh: '害羞', g: '社交', d: '社交需求下降較慢；被搭話會臉紅', x: ['outgoing'] },
    { id: 'outgoing', zh: '外向', g: '社交', d: '看到居民會主動打招呼', x: ['shy'] },
    { id: 'gentle', zh: '溫柔', g: '社交', d: '送禮時對方更開心' },
    { id: 'stubborn', zh: '固執', g: '社交', d: '不容易被說服（未來事件）' },
    { id: 'social', zh: '社交達人', g: '社交', d: '聊天獲得更多社交' },
    { id: 'cheerful', zh: '開朗', g: '情緒', d: '心情下降較慢', x: ['pessimist'] },
    { id: 'optimist', zh: '樂觀', g: '情緒', d: '心情低落時恢復較快', x: ['pessimist'] },
    { id: 'pessimist', zh: '悲觀', g: '情緒', d: '心情容易低落，但更珍惜禮物', x: ['optimist', 'cheerful'] },
    { id: 'sensitive', zh: '敏感', g: '情緒', d: '情緒反應比較明顯' },
    { id: 'curious', zh: '好奇', g: '興趣', d: '採集時偶爾多拿一個；常東張西望' },
    { id: 'creative', zh: '富有創意', g: '興趣', d: '完成作品時心情大幅提升' },
    { id: 'artsy', zh: '文藝', g: '興趣', d: '完成動畫時心情大幅提升' },
    { id: 'bookworm', zh: '熱愛閱讀', g: '興趣', d: '坐著休息時心情也會變好' },
    { id: 'nature', zh: '喜歡自然', g: '興趣', d: '在森林與花圃附近心情變好' },
    { id: 'diligent', zh: '勤奮', g: '生活', d: '走路比較快', x: ['lazy'] },
    { id: 'lazy', zh: '懶散', g: '生活', d: '常常坐下發呆，精力下降較慢', x: ['diligent'] },
    { id: 'tidy', zh: '愛乾淨', g: '生活', d: '佈置家具時心情提升' },
    { id: 'foodie', zh: '貪吃', g: '生活', d: '吃東西時心情也會變好', x: ['picky'] },
    { id: 'picky', zh: '挑食', g: '生活', d: '只有喜歡的食物才會開心', x: ['foodie'] },
    { id: 'nightowl', zh: '夜貓子', g: '生活', d: '晚上比較有精神' },
    { id: 'sleepy', zh: '愛睡', g: '生活', d: '休息時恢復更多精力' },
    // 8.0 — every trait changes behaviour (OC.Chars.behavior / OC.Mind / OC.Brain), not just a label
    { id: 'energetic', zh: '活潑', g: '情緒', d: '走得更快、跳得更高，動作幅度大；玩樂需求消耗較快', x: ['lazy'] },
    { id: 'introvert', zh: '內向', g: '社交', d: '獨處就能充電：社交需求下降慢，聊太久會累', x: ['extrovert'] },
    { id: 'extrovert', zh: '愛熱鬧', g: '社交', d: '一個人太久會寂寞，社交需求下降快、常主動找人', x: ['introvert'] },
    { id: 'humorous', zh: '幽默', g: '社交', d: '常常說笑話、大笑；聊天讓對方更開心' },
    { id: 'romantic', zh: '浪漫', g: '情緒', d: '喜歡看夕陽與星空，收到禮物特別感動' },
    { id: 'perfectionist', zh: '完美主義', g: '生活', d: '做事慢一點但更認真；作品完成時特別滿足' },
    { id: 'earlybird', zh: '早起', g: '生活', d: '早睡早起，清晨精神最好', x: ['nightowl'] },
    { id: 'animallover', zh: '喜歡動物', g: '興趣', d: '看到小生物會開心，觀察小生物時不容易嚇跑牠們' },
    { id: 'brave', zh: '勇敢', g: '情緒', d: '被丟高高也不怕，敢去沒去過的地方' },
    { id: 'clumsy', zh: '迷糊', g: '生活', d: '偶爾踉蹌一下、忘東忘西，但很可愛' },
    { id: 'dreamy', zh: '愛幻想', g: '興趣', d: '常常發呆、望著遠方想事情' },
  ];
  const QUIRKS = {
    walk: { zh: '走路方式', opts: [['normal', '一般'], ['bouncy', '蹦蹦跳跳'], ['sway', '左搖右擺'], ['tiptoe', '踮腳尖'], ['stomp', '大步走']] },
    sit: { zh: '坐姿', opts: [['neat', '端正'], ['flop', '癱坐'], ['swing', '晃腳']] },
    sleep: { zh: '睡相', opts: [['neat', '安穩'], ['curl', '縮成一團'], ['snore', '打呼嚕']] },
    eat: { zh: '進食速度', opts: [['normal', '一般'], ['nibble', '小口小口'], ['gobble', '狼吞虎嚥']] },
    greet: { zh: '打招呼', opts: [['wave', '揮手'], ['bow', '鞠躬'], ['jump', '跳起來'], ['shy', '害羞點頭']] },
    habit: { zh: '習慣動作', opts: [['none', '無'], ['lookaround', '東張西望'], ['tailswish', '甩尾巴'], ['hum', '哼歌'], ['stretch', '伸懶腰']] },
    face: { zh: '招牌表情', opts: [['cat', '貓嘴'], ['smile', '微笑'], ['flat', '面無表情'], ['grin', '咧嘴笑'], ['tongue', '吐舌']] },
  };
  const SPEECH = [['casual', '隨性'], ['polite', '有禮'], ['cute', '可愛'], ['cool', '酷酷'], ['energetic', '元氣'], ['whisper', '小小聲']];
  const ACTIONS = [
    // key, zh, loop, fallback chain
    ['idle', '待機', 'loop', []], ['breath', '呼吸', 'loop', ['idle']], ['blink', '眨眼', 'overlay', []],
    ['walk', '行走', 'loop', ['idle']], ['run', '跑步', 'loop', ['walk', 'idle']], ['turn', '轉身', 'once', ['idle']],
    ['jump', '跳躍', 'once', ['happy', 'idle']], ['sit', '坐下', 'loop', ['idle']], ['sleep', '睡覺', 'loop', ['sit', 'idle']],
    ['eat', '吃飯', 'loop', ['happy', 'idle']], ['drink', '喝水', 'loop', ['eat', 'idle']], ['play', '玩耍', 'loop', ['happy', 'idle']],
    ['happy', '開心', 'loop', ['idle']], ['shy', '害羞', 'loop', ['idle']], ['angry', '生氣', 'loop', ['idle']],
    ['sad', '難過', 'loop', ['idle']], ['surprised', '驚訝', 'once', ['idle']], ['hurt', '受傷反應', 'once', ['surprised', 'idle']],
    ['greet', '打招呼', 'once', ['happy', 'idle']], ['pet', '被撫摸', 'loop', ['happy', 'idle']], ['drag', '被拖曳', 'loop', ['surprised', 'idle']],
    ['climb', '攀爬', 'loop', ['walk', 'idle']],
    // Phase 4 life actions (procedural poses in render.js; players can replace them with frames)
    ['read', '閱讀', 'loop', ['sit', 'idle']], ['think', '思考', 'loop', ['idle']], ['stretch', '伸展', 'loop', ['happy', 'idle']],
    ['tend', '照顧植物', 'loop', ['idle']], ['talk', '說話', 'loop', ['idle']], ['dance', '跳舞', 'loop', ['play', 'happy', 'idle']],
    ['cry', '哭泣', 'loop', ['sad', 'idle']], ['laugh', '大笑', 'loop', ['happy', 'idle']],
    // Phase 5 world activities
    ['fish', '釣魚', 'loop', ['sit', 'idle']], ['cook', '做料理', 'loop', ['tend', 'idle']], ['study', '讀書', 'loop', ['read', 'sit', 'idle']],
    ['forage', '採集', 'loop', ['tend', 'idle']], ['browse', '逛街', 'loop', ['idle']],
    // Phase 6 reactions & performances (procedural poses with anticipation / follow-through; frames can replace them)
    ['taste', '品嚐', 'once', ['eat', 'idle']], ['yum', '好吃！', 'loop', ['happy', 'idle']], ['yuck', '難吃…', 'loop', ['sad', 'hurt', 'idle']],
    ['cheer', '歡呼', 'loop', ['happy', 'jump', 'idle']], ['proud', '得意', 'loop', ['happy', 'idle']], ['nod', '點頭', 'once', ['talk', 'idle']],
    ['shake', '搖頭', 'once', ['sad', 'idle']], ['receive', '收下', 'once', ['happy', 'idle']], ['sing', '唱歌', 'loop', ['talk', 'happy', 'idle']],
    ['sketch', '畫素描', 'loop', ['read', 'sit', 'idle']], ['yawn', '打哈欠', 'once', ['stretch', 'idle']],
    // Phase 7 desktop-pet moves (Shimeji): procedural poses in render.js; frames drawn for a wall / ceiling are used as-is
    ['fall', '掉落', 'loop', ['drag', 'surprised', 'idle']], ['hang', '吊掛', 'loop', ['climb', 'drag', 'idle']], ['peek', '偷看', 'loop', ['shy', 'idle']],
  ];
  const ACTION_ZH = Object.fromEntries(ACTIONS.map((a) => [a[0], a[1]]));
  const SPECIES = [['cat', '貓'], ['bunny', '兔'], ['bear', '熊'], ['dog', '狗'], ['fox', '狐'], ['sprite', '小精靈'], ['other', '其他']];

  // ---------------- look (rig) defaults ----------------
  const LOOK_DEFAULT = {
    fur: '#FFF7EC', inner: '#FFB8B0', cheek: '#FF9E9E', eye: '#3B2B25', ears: 'cat', tail: 'cat', shirt: '#5BC0EB', pattern: 'stripe', acc: 'none', accCol: '#F26B5B', clip: 'none',
    // proportions
    headSize: 1, bodyW: 1, bodyH: 1, legLen: 1, earSize: 1, tailSize: 1,
    // face
    eyeStyle: 'dot', eyeSize: 1, eyeGap: 0, eyeY: 0, eyeRot: 0, browStyle: 'none', browY: 0, mouthStyle: 'cat', mouthY: 0, mouthSize: 1, noseStyle: 'dot', cheekStyle: 'round', cheekSize: 1,
    // fur pattern
    furPattern: 'none', patternCol: '#E7A86A',
  };
  /** per-OC life state (emotions, memories, records, habits, wishes, skills, routine, bond with the player) */
  function lifeBlank() {
    return {
      emo: { list: [], dom: 'neutral', domAt: 0, recent: [], cd: {} },
      mem: { recent: [], long: [], seq: 0 },
      rec: { act: {}, seq: {}, place: {}, placeZh: {}, lastAct: null, social: 0, nightAwake: 0 },
      habits: [], wishes: [], skills: {}, routine: { sleep: null, wake: null }, player: { aff: 0, fam: 0, last: 0 }, cur: null, log: [],
      loc: 'isle', trip: null, places: {},   // Phase 5: current place, travelling { to, act, eta }, place id → { visits, last }
    };
  }
  function newId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function blank(origin = 'custom') {
    return {
      id: newId(), v: 2, created: Date.now(), updated: Date.now(), origin,
      profile: { name: '', nickname: '', birthday: '', age: '', gender: '', pronoun: '', species: 'cat', height: 1, intro: '', backstory: '', hobbies: [], likes: [], dislikes: [], habits: [], relationPref: '', custom: [] },
      personality: { pace: 50, energy: 55, social: 50, expression: 55, thinking: 45, speech: 50, traits: [], customTraits: [] },
      quirks: { walk: 'normal', sit: 'neat', sleep: 'neat', eat: 'normal', greet: 'wave', habit: 'none', face: 'cat' },
      // 8.0 speech: pronouns, endings with a rate (not on every line), several catchphrases with conditions, banned words, names for others
      speech: { style: 'casual', catchphrase: '', ending: '', self: '我', you: '你', playerName: '', endingRate: 0.35, phrases: [], banned: [], call: {}, pace: 'normal', moods: true },
      tastes: { likeItems: [], dislikeItems: [], food: {}, flavor: {}, tasted: {} },   // food: id → { lv −2…2, src, locked } (OC.Taste)
      look: clone(LOOK_DEFAULT), parts: [],
      appearance: { mode: 'rig', scale: 1 },
      actions: {},               // action → { any|front|back|left|right: animId }
      needs: { food: 80, energy: 85, sleep: 80, fun: 70, social: 60, comfort: 75, interest: 65, active: 70, mood: 75, t: Date.now() },
      growth: { suggestions: [], locked: [], history: [], rejected: {}, muted: [] },
      status: { onIsland: true },
      life: lifeBlank(),          // Phase 4 inner life (js/life/mind.js); see docs/life-format.md
    };
  }
  /** fill missing fields (schema evolution) */
  function normalize(c) {
    const b = blank(c.origin);
    const merge = (dst, src) => { for (const k of Object.keys(src)) { if (dst[k] === undefined) dst[k] = clone(src[k]); else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && typeof dst[k] === 'object' && !Array.isArray(dst[k])) merge(dst[k], src[k]); } };
    merge(c, b); c.v = 2; return c;
  }
  const PRESET_LOOKS = () => OC.Style.PRESETS;
  function fromPreset(key) {
    const p = PRESET_LOOKS()[key], c = blank('preset');
    Object.assign(c.look, clone(p)); delete c.look.name;
    c.profile.name = p.name; c.profile.species = p.ears === 'bunny' ? 'bunny' : p.ears === 'bear' ? 'bear' : 'cat';
    const P = { mochi: [55, 60, 55, 60, 40, 45, ['cheerful', 'curious'], 'bouncy', 'wave', 'cute', '喵～'], kuri: [70, 80, 80, 85, 30, 75, ['outgoing', 'foodie'], 'bouncy', 'jump', 'energetic', '！'], sora: [30, 35, 25, 30, 70, 30, ['shy', 'bookworm'], 'tiptoe', 'shy', 'whisper', '…'] }[key] || [50, 50, 50, 50, 50, 50, [], 'normal', 'wave', 'casual', ''];
    Object.assign(c.personality, { pace: P[0], energy: P[1], social: P[2], expression: P[3], thinking: P[4], speech: P[5], traits: P[6] });
    c.quirks.walk = P[7]; c.quirks.greet = P[8]; c.speech.style = P[9]; c.speech.ending = P[10]; c.speech.endingRate = 0.3;
    return c;
  }

  // ---------------- roster (single source of truth for every page) ----------------
  const all = () => S().roster.map((id) => S().chars[id]).filter(Boolean);
  const get = (id) => S().chars[id] || null;
  const active = () => S().chars[S().activeId] || all()[0] || null;
  function add(c, opts = {}) {
    normalize(c); S().chars[c.id] = c; if (!S().roster.includes(c.id)) S().roster.push(c.id);
    if (opts.activate || !S().activeId) S().activeId = c.id;
    St.touch('chars', { id: c.id, added: true }); return c;
  }
  function save(c) { c.updated = Date.now(); S().chars[c.id] = c; St.touch('chars', { id: c.id }); return c; }
  function duplicate(id) {
    const src = get(id); if (!src) return null; const c = clone(src); c.id = newId(); c.created = c.updated = Date.now(); c.profile.name = (src.profile.name || '') + ' 2';
    // animations: reference the same docs until edited (copy-on-write in the studio)
    c.status.onIsland = false; c.growth = { suggestions: [], locked: [], history: [], rejected: {}, muted: [] };
    c.life = Object.assign(lifeBlank(), { routine: clone(src.life.routine) });   // a copy is a new OC: no shared memories
    const i = S().roster.indexOf(id); S().chars[c.id] = c; S().roster.splice(i + 1, 0, c.id); St.touch('chars', { id: c.id, added: true }); return c;
  }
  function remove(id) {
    if (S().roster.length <= 1) return false;
    delete S().chars[id]; S().roster = S().roster.filter((x) => x !== id);
    if (S().activeId === id) S().activeId = S().roster[0]; if (S().petId === id) S().petId = null;
    St.touch('chars', { id, removed: true }); return true;
  }
  function setActive(id) { if (!get(id)) return; S().activeId = id; get(id).status.onIsland = true; St.touch('chars', { id, active: true }); }
  function move(id, dir) { const r = S().roster, i = r.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= r.length) return; [r[i], r[j]] = [r[j], r[i]]; St.touch('chars'); }
  function reorder(ids) { S().roster = ids.filter((id) => S().chars[id]); St.touch('chars'); }
  const name = (c) => (c && (c.profile.nickname || c.profile.name)) || '無名氏';

  // ---------------- personality → behaviour (observable) ----------------
  const has = (c, t) => c.personality.traits.includes(t);
  function behavior(c) {
    const p = c.personality, q = c.quirks, k = (v) => (v - 50) / 50; // −1…1
    let speed = 62 * (1 + 0.28 * k(p.pace)) * (has(c, 'diligent') ? 1.1 : 1) * (has(c, 'lazy') ? 0.85 : 1) * (has(c, 'energetic') ? 1.1 : 1) * (has(c, 'perfectionist') ? 0.95 : 1);
    if (q.walk === 'tiptoe') speed *= 0.85; if (q.walk === 'stomp') speed *= 1.08;
    return {
      speed,
      bounce: { normal: 1, bouncy: 2.2, sway: 0.8, tiptoe: 0.5, stomp: 1.4 }[q.walk] * (0.8 + 0.4 * (p.energy / 100)) * (has(c, 'energetic') ? 1.3 : 1),
      sway: q.walk === 'sway' ? 0.12 : q.walk === 'bouncy' ? 0.04 : 0.02,
      blinkEvery: 2.6 + 2.2 * (1 - p.energy / 100),
      fidgetEvery: 5 + 9 * (1 - p.energy / 100) + (has(c, 'lazy') ? 6 : 0),
      emoteScale: 0.6 + 0.8 * (p.expression / 100) + (has(c, 'energetic') ? 0.2 : 0) + (has(c, 'introvert') ? -0.1 : 0),
      lookAround: q.habit === 'lookaround' || has(c, 'curious') || has(c, 'dreamy'),
      clumsy: has(c, 'clumsy'), laughs: has(c, 'humorous'), dreamy: has(c, 'dreamy'),
      greet: q.greet, autoGreet: p.social > 65 || has(c, 'outgoing') || has(c, 'extrovert'), blushOnTalk: has(c, 'shy') || has(c, 'romantic') || p.social < 30,
      sitChance: (has(c, 'lazy') ? 0.35 : 0.08) + (1 - p.energy / 100) * 0.1,
      chew: { normal: 1.6, nibble: 2.6, gobble: 0.9 }[q.eat],
      face: q.face, habit: q.habit, sleep: q.sleep, sit: q.sit,
      jumpHeight: 10 + 8 * (p.energy / 100) + (q.greet === 'jump' ? 4 : 0) + (has(c, 'energetic') ? 4 : 0),
    };
  }
  /** a short original personality title derived from the sliders */
  function typeTitle(c) {
    const p = c.personality;
    const a = p.energy > 60 ? (p.social > 55 ? '元氣滿滿的' : '精力旺盛的') : p.energy < 40 ? (p.social < 45 ? '安安靜靜的' : '悠哉悠哉的') : (p.social > 60 ? '親切的' : '自在的');
    const b = p.thinking > 60 ? (p.speech > 55 ? '分析家' : '思考家') : p.thinking < 40 ? (p.expression > 55 ? '夢想家' : '感受家') : (p.pace > 60 ? '行動派' : '生活家');
    return a + b;
  }
  /** 8.0: turn a neutral line into THIS character's voice.
   *  o.to = 'player' | ocId (who is addressed) · o.emo = dominant emotion · o.cat = dialogue category · o.rnd = 0..1 (tests)
   *  - pronouns (我 → 人家／俺／本小姐…, 你 → 妳／您… when talking to the player; special names for specific OCs)
   *  - endings at the player's chosen rate (default about one line in three) instead of on every line; never doubled
   *  - several catchphrases, each with a rate, a mood / situation condition and a position (start / end)
   *  - style (polite / cute / cool / energetic / whisper), pace (slow adds pauses, fast trims them), mood colouring
   *  - banned words are removed */
  const SELF_PL = { 我: '我們', 俺: '俺們', 人家: '我們', 本小姐: '我們', 本大爺: '我們', 在下: '我們', 咱: '咱們', 偶: '偶們' };
  const POS = ['happy', 'excited', 'calm', 'content', 'proud', 'love'], NEG = ['lonely', 'down', 'sad', 'tired', 'nervous', 'annoyed', 'bored'];
  function speak(c, text, o = {}) {
    const s = c.speech || {}, style = s.style;
    // a seed from the caller (the life sim's RNG → reproducible) expands into independent draws; otherwise Math.random
    let seed = o.rnd != null ? Math.floor(o.rnd * 2147483646) + 1 : 0; const rnd = seed ? () => (seed = (seed * 48271) % 2147483647) / 2147483647 : Math.random;
    let t = String(text);
    const emo = o.emo || (OC.Mind && c.life ? OC.Mind.dominant(c) : 'neutral'), pos = POS.includes(emo), neg = NEG.includes(emo);
    // pronouns
    if (s.self && s.self !== '我') { t = t.replace(/我們/g, '\u0001').replace(/我/g, s.self).replace(/\u0001/g, SELF_PL[s.self] || '我們'); }
    const toOC = o.to && o.to !== 'player' ? o.to : null;
    if (!toOC && s.you && s.you !== '你') t = t.replace(/你們/g, '\u0002').replace(/你/g, s.you).replace(/\u0002/g, s.you === '您' ? '您們' : '你們');
    if (!toOC && s.playerName) t = t.replace(/\{player\}/g, s.playerName); else t = t.replace(/\{player\}/g, s.you || '你');
    if (toOC && s.call && s.call[toOC]) { const other = OC.Chars.get(toOC); if (other) t = t.split(name(other)).join(s.call[toOC]); }
    // style
    if (style === 'polite') t = t.replace(/！/g, '。').replace(/吧？/g, '嗎？');
    if (style === 'cute' && rnd() < 0.5) t = t.replace(/[。！]$/, '～');
    if (style === 'cool') t = t.replace(/[！～]/g, '。').replace(/^哇/, '嗯');
    if (style === 'energetic' && !neg) t = t.replace(/[。～]$/, '！');
    if (style === 'whisper') t = '（小聲）' + t.replace(/！/g, '…');
    // mood colouring (only if the player allows it)
    if (s.moods !== false) { if (neg && style !== 'cool') t = t.replace(/！$/, '…'); else if (emo === 'excited' && rnd() < 0.5) t = t.replace(/。$/, '！'); }
    // pace
    if (s.pace === 'slow' && rnd() < 0.5) t = t.replace(/，/, '……'); else if (s.pace === 'fast') t = t.replace(/……/g, '…');
    // ending: at a rate, never doubled, softer when sad
    const rate = s.endingRate != null ? s.endingRate : 0.35;
    if (s.ending && !t.replace(/[。！？～…\s]+$/, '').endsWith(s.ending.replace(/[～~]+$/, '')) && rnd() < rate * (neg ? 0.5 : 1)) {
      const core = t.replace(/[。！？～…\s]+$/, ''), punct = t.slice(core.length);
      // an ending that carries its own tone (喵～) replaces the full stop; others keep the original punctuation (的說！)
      t = /[～~！!？?…]$/.test(s.ending) ? core + s.ending + (punct.includes('？') ? '？' : '') : core + s.ending + (punct || '。');
    }
    // catchphrases (one at most per line)
    const phrases = (s.phrases && s.phrases.length ? s.phrases : s.catchphrase ? [{ text: s.catchphrase, rate: 0.18, when: 'any', at: 'start' }] : []).filter((p) => p && p.text && (p.when === 'any' || !p.when || (p.when === 'happy' && pos) || (p.when === 'sad' && neg) || (p.when === o.cat) || (p.when === 'greet' && /greet|out|hello/.test(o.cat || ''))));
    for (const p of phrases) { if (rnd() < (p.rate == null ? 0.18 : p.rate) && !t.includes(p.text)) { t = p.at === 'end' ? t.replace(/([。！？～…]*)$/, '，' + p.text + '$1') : p.text + ' ' + t; break; } }
    for (const w of s.banned || []) if (w) t = t.split(w).join('');
    return t.replace(/^\s+|\s+$/g, '') || String(text);
  }

  // ---------------- growth: discoveries need consent ----------------
  /** propose a new trait/hobby; never applied silently */
  function suggest(c, type, value, reason) {
    if (OC.Mind) return OC.Mind.suggest(c, type, value, reason);
    const g = c.growth; if (g.locked.includes(value)) return false;
    if (type === 'trait' && c.personality.traits.includes(value)) return false;
    if (type === 'hobby' && c.profile.hobbies.includes(value)) return false;
    if (g.suggestions.some((x) => x.value === value)) return false;
    g.suggestions.push({ id: 'g' + Date.now().toString(36), type, value, reason, at: Date.now() }); St.touch('growth', { id: c.id }); St.emit('growthSuggest', { c, type, value, reason }); return true;
  }
  function resolve(c, sid, decision) {
    if (OC.Mind) return OC.Mind.resolve(c, sid, decision);
    const g = c.growth, s = g.suggestions.find((x) => x.id === sid); if (!s) return;
    g.suggestions = g.suggestions.filter((x) => x.id !== sid);
    if (decision === 'accept') { if (s.type === 'trait') c.personality.traits.push(s.value); else c.profile.hobbies.push(s.value); }
    if (decision === 'lock') g.locked.push(s.value);
    g.history.unshift({ at: Date.now(), type: s.type, value: s.value, decision }); g.history = g.history.slice(0, 30); save(c);
  }

  // ---------------- migration v1 → v2 ----------------
  function migrateV1(d) {
    const c = blank(d.oc ? 'custom' : 'preset');
    if (d.oc) {
      const o = d.oc; c.profile.name = o.name || ''; c.profile.intro = o.bio || ''; c.profile.birthday = o.birthday || '';
      for (const k of Object.keys(LOOK_DEFAULT)) if (o[k] !== undefined) c.look[k] = o[k];
      c.personality.traits = (o.traits || []).filter((t) => TRAITS.some((x) => x.id === t));
    }
    if (d.needs) c.needs = Object.assign(c.needs, d.needs);
    d.chars = { [c.id]: c }; d.roster = [c.id]; d.activeId = c.id;
    d.legacyAnims = d.anims || []; d.legacyAppearance = d.appearance || null;
    delete d.oc; delete d.needs; delete d.anims; delete d.appearance;
    d.animations = d.animations || {}; d.v = 2;
    return d;
  }
  /** async part: legacy dataURL animations → binary assets + animation documents */
  async function migrateLegacyAnims() {
    const s = S(); if (!s.legacyAnims || !s.legacyAnims.length) return 0;
    let n = 0;
    for (const a of s.legacyAnims) {
      const frames = [];
      for (const src of a.frames) { const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); if (!img) continue; const rec = await OC.Assets.put(img, { kind: 'frame', name: a.name, owner: s.activeId }); frames.push(rec.id); }
      if (!frames.length) continue;
      const doc = OC.Anim.create({ id: a.id, name: a.name, owner: s.activeId, fps: a.fps || 6, cells: [frames] });
      OC.Anim.save(doc); n++;
      if (s.legacyAppearance && s.legacyAppearance.mode === 'sprite' && s.legacyAppearance.animId === a.id) { const c = active(); c.appearance.mode = 'sprite'; c.actions.idle = { any: doc.id }; }
    }
    s.legacyAnims = []; s.legacyAppearance = null; St.persist(); return n;
  }

  OC.Chars = { lifeBlank, SLIDERS, TRAITS, QUIRKS, SPEECH, ACTIONS, ACTION_ZH, SPECIES, LOOK_DEFAULT, blank, normalize, fromPreset, all, get, active, add, save, duplicate, remove, setActive, move, reorder, name, behavior, typeTitle, speak, suggest, resolve, has, migrateV1, migrateLegacyAnims, newId, clone };
})();
