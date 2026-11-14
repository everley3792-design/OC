/* OC Shimeji — 16.2 OC.Will: nothing is locked; whether it goes well depends on the other one.
 *
 * Every interaction one character can direct at another (the player's character or any character on its own) goes through the same
 * willingness model: how B sees A (familiarity, affection, trust, closeness, conflict), how close the interaction is compared with how
 * close they are, B's personality (traits, species and life stage through OC.Traits13.accept, sociability, expression), B's mood and
 * needs, what B is doing, the place (others watching), their history (B turned A down a moment ago, the same thing three times in a
 * row) and a little chance. The answer is not yes / no but a reaction on a spectrum (warm, glad, reluctant, teasing back, shy dodge,
 * frozen, awkward, polite no, annoyed, pushed away, walked off, tears), each with its own animation, line and consequences — too much
 * too soon costs affection and is remembered; the right thing at the right time counts more.
 *
 * Two rules are not part of the model and never bend: romantic interactions need OC.Mind.romanceOK (romance on, both marked adult, both
 * 18 or older); minors are never part of anything romantic or intimate in a romantic sense.
 * A small chance (life.settings.defy, default 6 %, more for stubborn characters) that the character you play will not do what you
 * asked — always with a reason on screen.
 *
 * It plugs into the existing social engine (OC.Brain.Social): respond() for the answer, script() for the performance, resolve() for
 * the consequences; data only below.
 */
(function () {
  'use strict';
  const D = OC.LifeData, S = () => OC.Store.s, M = () => OC.Mind, Ch = () => OC.Chars, Sim = () => OC.Sim, St = OC.Store;
  const has = (c, t) => Ch().has(c, t), name = (c) => Ch().name(c);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- categories
  const CATS = [['greet', '問候', 'wave'], ['talk', '閒聊', 'chat'], ['care', '關心', 'heart'], ['play', '玩鬧', 'dice'], ['prank', '惡作劇', 'sparkle'], ['close', '親近', 'paw'],
    ['talent', '才藝', 'music'], ['gift', '禮物', 'gift'], ['gossip', '八卦', 'eye'], ['fight', '爭執', 'flag'], ['mend', '和解', 'hand'], ['love', '戀愛', 'heart']];

  /* interactions: id: [category, 名稱, emoji, closeness 0–1, tone, A's animation, B's animation when it goes well, rel change on success,
   *   needs on success, memory text ({other}), memory importance]
   * tone: warm · play · tease · neg (hostile: happens whatever B wants, B only decides how to take it) · mend · love (romance rule)
   * Interactions that already existed (chat, hug, argue …) keep their engine code and only get a category, a closeness and a tone. */
  const OLD = {
    chat: ['talk', 0.05, 'warm'], share: ['talk', 0.2, 'warm'], compliment: ['care', 0.2, 'warm'], comfort: ['care', 0.35, 'warm'], joke: ['play', 0.1, 'play'], prank: ['prank', 0.3, 'tease'],
    food: ['gift', 0.25, 'warm'], gift: ['gift', 0.2, 'warm'], argue: ['fight', 0.1, 'neg'], apologize: ['mend', 0.15, 'mend'],
    hug: ['close', 0.55, 'warm'], highfive: ['close', 0.15, 'play'], dance: ['talent', 0.35, 'play'], selfie: ['play', 0.3, 'play'], rps: ['play', 0.05, 'play'], tickle: ['prank', 0.5, 'tease'],
    pat: ['close', 0.4, 'warm'], whisper: ['gossip', 0.45, 'warm'], leanOn: ['close', 0.6, 'warm'], peekaboo: ['play', 0.2, 'play'],
  };
  const NEW = {
    hello: ['greet', '打招呼', '👋', 0, 'warm', 'wave', 'wave', { fam: 2 }, { social: 4 }, '', 0],
    bow16: ['greet', '鞠躬問好', '🙇', 0, 'warm', 'bow', 'bow', { fam: 2, trust: 1 }, { social: 4 }, '', 0],
    wavefar: ['greet', '遠遠揮手', '🙋', 0, 'warm', 'wave_far', 'wave_far', { fam: 1, aff: 1 }, { social: 3 }, '', 0],
    salute: ['greet', '敬禮', '🫡', 0.05, 'play', 'salute', 'salute', { fam: 2, aff: 1 }, { social: 4, fun: 3 }, '', 0],
    smalltalk: ['talk', '聊聊近況', '💬', 0.05, 'warm', 'talk', 'nod', { fam: 4, aff: 2 }, { social: 14 }, '和{other}聊了近況', 0.25],
    weather: ['talk', '聊天氣', '🌤', 0, 'warm', 'lookup', 'nod', { fam: 3, aff: 1 }, { social: 10 }, '', 0],
    askday: ['talk', '問今天過得如何', '🙂', 0.1, 'warm', 'talk', 'happy', { fam: 3, aff: 3, trust: 1 }, { social: 12 }, '{other}問我今天過得好不好', 0.3],
    foodtalk: ['talk', '聊好吃的', '🍰', 0.05, 'warm', 'talk', 'lickips', { fam: 3, aff: 2 }, { social: 10, food: -2 }, '和{other}聊到肚子餓', 0.2],
    hobbytalk: ['talk', '聊興趣', '🎨', 0.15, 'warm', 'point', 'aha', { fam: 4, aff: 3, intim: 1 }, { social: 12, interest: 8 }, '和{other}聊了喜歡的東西', 0.3],
    askok: ['care', '問「還好嗎」', '🤲', 0.2, 'warm', 'worried', 'relieved', { aff: 4, trust: 4 }, { social: 10 }, '{other}問我還好嗎', 0.45],
    cheerup: ['care', '加油打氣', '💪', 0.15, 'warm', 'cheerup', 'determined', { aff: 4, trust: 2 }, { social: 10, mood: 6 }, '{other}幫我打氣', 0.4],
    listen16: ['care', '好好聽對方說', '👂', 0.3, 'warm', 'listen', 'talk', { aff: 4, trust: 6, intim: 2 }, { social: 16 }, '{other}很認真地聽我說話', 0.5],
    restplease: ['care', '叫對方休息一下', '☕', 0.2, 'warm', 'point', 'relieved', { aff: 3, trust: 3 }, { energy: 4, comfort: 6 }, '{other}叫我休息一下', 0.35],
    thumbsup: ['care', '比讚', '👍', 0.05, 'play', 'thumbsup', 'happy', { aff: 2 }, { social: 5, mood: 3 }, '', 0],
    funnyface: ['play', '扮鬼臉', '😜', 0.15, 'play', 'wiggle', 'laugh', { aff: 3, fam: 2 }, { fun: 10, social: 6 }, '{other}對我扮鬼臉', 0.25],
    chase: ['play', '鬼抓人', '🏃', 0.25, 'play', 'chase', 'run', { aff: 3, fam: 3 }, { fun: 16, active: 18, energy: -6 }, '和{other}玩鬼抓人', 0.35],
    clapgame: ['play', '拍手遊戲', '👏', 0.2, 'play', 'clap', 'clap', { aff: 3, fam: 2 }, { fun: 12, social: 8 }, '和{other}玩拍手遊戲', 0.3],
    spinround: ['play', '一起轉圈圈', '🌀', 0.3, 'play', 'spin', 'twirl', { aff: 3, fam: 2 }, { fun: 14, active: 8 }, '和{other}轉圈圈轉到頭暈', 0.3],
    startle: ['prank', '從背後嚇一跳', '👻', 0.3, 'tease', 'jump', 'startle', { aff: 2, fam: 3 }, { fun: 10 }, '被{other}從背後嚇了一跳', 0.35],
    poke16: ['prank', '戳戳臉', '👉', 0.3, 'tease', 'point', 'poked', { aff: 2, fam: 2 }, { fun: 8 }, '{other}一直戳我的臉', 0.3],
    teasename: ['prank', '取綽號', '😏', 0.25, 'tease', 'giggle', 'pout', { aff: 1, fam: 3 }, { fun: 8 }, '{other}幫我取了奇怪的綽號', 0.35],
    handhold16: ['close', '牽手', '🤝', 0.6, 'warm', 'handhold', 'handhold', { aff: 5, intim: 4, trust: 3 }, { social: 12, comfort: 6 }, '和{other}牽了手', 0.55],
    nuzzle16: ['close', '蹭蹭', '🐾', 0.65, 'warm', 'nuzzle', 'melt', { aff: 5, intim: 4 }, { social: 12, comfort: 8 }, '和{other}蹭了蹭', 0.5],
    sidebyside: ['close', '並肩站著', '🧍', 0.3, 'warm', 'sidebyside', 'sidebyside', { aff: 3, fam: 2, intim: 1 }, { social: 8, comfort: 4 }, '和{other}並肩看風景', 0.3],
    sing16: ['talent', '唱歌給對方聽', '🎤', 0.25, 'warm', 'sing', 'clap', { aff: 4, fam: 2 }, { fun: 12, social: 8 }, '{other}唱歌給我聽', 0.45],
    drawfor: ['talent', '畫一張給對方', '🖍', 0.3, 'warm', 'sketch', 'receive', { aff: 5, trust: 2 }, { fun: 8, social: 8 }, '{other}畫了一張畫給我', 0.55],
    magic: ['talent', '變小魔術', '🪄', 0.15, 'play', 'cast', 'surprised', { aff: 4, fam: 2 }, { fun: 14 }, '{other}變了一個小魔術', 0.4],
    drumbeat: ['talent', '打拍子給對方聽', '🥁', 0.1, 'play', 'drum', 'bounce', { aff: 3 }, { fun: 10 }, '和{other}一起打拍子', 0.25],
    note: ['gift', '遞小紙條', '📝', 0.3, 'warm', 'write', 'receive', { aff: 4, trust: 3, intim: 2 }, { social: 8 }, '收到{other}的小紙條', 0.5],
    flower16: ['gift', '摘朵小花送對方', '🌼', 0.35, 'warm', 'receive', 'shy', { aff: 5, intim: 2 }, { social: 8, mood: 4 }, '{other}送了我一朵小花', 0.5],
    gossip: ['gossip', '說別人的八卦', '🗣', 0.35, 'tease', 'whisper', 'listen', { fam: 3, trust: 2, intim: 2 }, { social: 12, interest: 6 }, '和{other}偷偷聊別人的事', 0.4],
    askaround: ['gossip', '打聽消息', '🔎', 0.15, 'warm', 'headscratch', 'talk', { fam: 3 }, { interest: 10, social: 6 }, '向{other}打聽消息', 0.25],
    secret16: ['gossip', '說一個祕密', '🔐', 0.55, 'warm', 'whisper', 'listen', { trust: 8, intim: 6, aff: 3 }, { social: 14 }, '{other}告訴我一個祕密', 0.65],
    complain: ['fight', '抱怨對方', '😤', 0.1, 'neg', 'pout', 'upset', { aff: -4, conflict: 10 }, { social: 2 }, '{other}對我抱怨', 0.45],
    blame: ['fight', '怪罪對方', '👉', 0.15, 'neg', 'point', 'upset', { aff: -6, trust: -4, conflict: 16 }, { social: 0 }, '被{other}怪罪', 0.55],
    sulkat: ['fight', '鬧脾氣', '😒', 0.1, 'neg', 'sulk', 'confused', { aff: -3, conflict: 8 }, { social: 0 }, '{other}對我鬧脾氣', 0.4],
    shove: ['fight', '推一把', '✋', 0.2, 'neg', 'shoo', 'recoil', { aff: -8, trust: -6, conflict: 22 }, { social: 0, comfort: -6 }, '被{other}推了一把', 0.65],
    ignore16: ['fight', '故意不理', '🙄', 0.05, 'neg', 'turnaway', 'sad', { aff: -4, conflict: 10 }, { social: -4 }, '{other}故意不理我', 0.45],
    offerhand: ['mend', '主動伸手和好', '🤝', 0.3, 'mend', 'handhold', 'accept', { conflict: -24, aff: 5, trust: 6 }, { social: 10 }, '和{other}握手和好', 0.65],
    treat16: ['mend', '請對方吃東西賠罪', '🍡', 0.25, 'mend', 'bow', 'yum', { conflict: -18, aff: 6 }, { food: 10, social: 8 }, '{other}請我吃東西賠罪', 0.55],
    forgive16: ['mend', '說「我原諒你」', '🕊', 0.2, 'mend', 'nod', 'relieved', { conflict: -20, trust: 4, aff: 3 }, { social: 8 }, '{other}說原諒我了', 0.6],
    praiselooks: ['love', '誇對方好看', '✨', 0.5, 'love', 'blow', 'embarrassed', { aff: 5, intim: 4 }, { social: 8, mood: 4 }, '{other}說我今天很好看', 0.55],
    sweet: ['love', '說貼心的話', '💗', 0.6, 'love', 'whisper', 'melt', { aff: 6, intim: 6, trust: 3 }, { social: 10 }, '{other}對我說了很溫柔的話', 0.65],
    kisscheek: ['love', '親臉頰', '💋', 0.8, 'love', 'blow', 'melt', { aff: 7, intim: 8 }, { social: 12, mood: 6 }, '{other}親了我的臉頰', 0.8],
    snuggle: ['love', '依偎在一起', '🫂', 0.75, 'love', 'lean_on', 'shoulder', { aff: 6, intim: 7, trust: 3 }, { comfort: 12, social: 12 }, '和{other}依偎在一起', 0.7],
  };
  const INTER = {};
  for (const [id, x] of Object.entries(OLD)) INTER[id] = { id, cat: x[0], intim: x[1], tone: x[2], old: true };
  for (const [id, x] of Object.entries(NEW)) INTER[id] = { id, cat: x[0], zh: x[1], ic: x[2], intim: x[3], tone: x[4], animA: x[5], animB: x[6], rel: x[7], needs: x[8], mem: x[9], imp: x[10] };
  for (const [id, x] of Object.entries(INTER)) { if (!x.old) D.SOCIAL[id] = { zh: x.zh, ic: x.ic, will: true }; x.zh = x.zh || (D.SOCIAL[id] || {}).zh || id; x.ic = x.ic || (D.SOCIAL[id] || {}).ic || '💬'; }
  const has16 = (kind) => !!(INTER[kind] && !INTER[kind].old);   /* performed and resolved here (the old ones keep the engine's code) */

  // ---------------------------------------------------------------- reactions
  /* id: [名稱, goes ahead?, multiplier of the good effects, B's animation, B's feeling, A's feeling] */
  const REACT = {
    warm: ['熱情回應', true, 1.35, 'cheer', 'happy', 'happy'], accept: ['開心接受', true, 1, 'happy', 'content', 'happy'], reluctant: ['勉強配合', true, 0.45, 'shrug', 'confused', 'confused'],
    tease: ['反過來捉弄', true, 0.7, 'giggle', 'happy', 'surprised'], shy: ['害羞閃躲', false, 0, 'embarrassed', 'shy', 'confused'], stunned: ['愣住', false, 0, 'stunned', 'surprised', 'confused'],
    awkward: ['尷尬地笑笑', false, 0, 'headscratch', 'confused', 'shy'], decline: ['婉拒', false, 0, 'shake', 'calm', 'down'], annoyed: ['不耐煩', false, 0, 'stomp', 'annoyed', 'down'],
    push: ['推開', false, 0, 'shoo', 'annoyed', 'down'], flee: ['跑開', false, 0, 'turnaway', 'nervous', 'confused'], cry: ['哭了', false, 0, 'cry', 'down', 'worried'],
  };

  // ---------------------------------------------------------------- the model
  const W = (c) => { const l = c.life; if (!l.w16) l.w16 = { rej: {}, last: {} }; return l.w16; };
  /** how close two are (B's view of A), 0–1 */
  const closeness = (r) => clamp((r.fam * 0.3 + r.aff * 0.5 + (r.intim || 0) * 0.45 + r.trust * 0.15) / 100);
  function crowd(B, A) { const W2 = OC.World; if (!W2 || !W2.actors) return 0; const a = OC.App && OC.App.actorOf && OC.App.actorOf(B.id); if (!a) return 0; return W2.actors.filter((x) => x !== a && (x.mate || x.player) && Math.hypot(x.x - a.x, x.y - a.y) < 90).length - 1; }
  /** B's willingness to go along with A's `kind` (no dice): { p, parts: [[why, ±]] } */
  function willing(B, A, kind) {
    const it = INTER[kind] || { intim: 0.2, tone: 'warm' }, r = M().rel(B.id, A.id), parts = [], add = (why, v) => { if (Math.abs(v) >= 0.005) parts.push([why, v]); return v; };
    let p = 0.58;
    if (it.tone === 'love' && !M().romanceOK(A.id, B.id)) return { p: 0, parts: [['戀愛的條件不成立', -1]], hard: true };
    p += add('好感', (r.aff - 30) / 120); p += add('信任', (r.trust - 10) / 400); p += add('熟悉', r.fam / 500); p -= -add('不合', -r.conflict / 80);
    if (it.intim <= 0.1 && it.tone !== 'neg') p += add('只是很普通的事', (0.12 - it.intim) * 2.2);   /* a hello or a chat about the weather is fine with almost anyone */
    const cl = closeness(r), gap = it.intim - cl;
    if (gap > 0) p += add('太快、太親近', -gap * 1.4 * (has(B, 'shy') ? 1.4 : 1) * (it.tone === 'love' ? 1.2 : 1));
    else if (it.intim > 0.3) p += add('剛剛好的距離', Math.min(0.12, -gap * 0.2));
    if (it.tone === 'tease') { p += add('愛玩', (B.personality.expression - 50) / 150); if (has(B, 'sensitive')) p += add('敏感', -0.25); }
    if (it.tone === 'mend') { p = 0.3 + r.aff / 160 + r.trust / 260 - r.conflict / 220; parts.length = 0; add('想和好的程度', p - 0.3); if (has(B, 'gentle')) p += add('溫和', 0.22); if (has(B, 'stubborn')) p += add('固執', -0.25); }
    if (it.tone === 'love') p += add('親密', (r.intim || 0) / 160);
    p += add('個性', (B.personality.social - 50) / 200 + (OC.Traits13 ? OC.Traits13.accept(B) : 0));
    const emo = M().dominant(B);
    if (emo === 'annoyed') p += add('心情不好', -0.3); else if (emo === 'down') p += add('有點低落', it.cat === 'care' ? 0.18 : -0.12); else if (emo === 'happy' || emo === 'excited') p += add('心情好', 0.12); else if (emo === 'lonely') p += add('寂寞', it.tone === 'warm' ? 0.15 : 0);
    const urg = M().urgent(B); if (urg && urg !== 'social') p += add({ food: '肚子餓', sleep: '很睏', energy: '很累' }[urg] || '不舒服', -0.3);
    const bb = OC.Brain.get(B.id); if (bb && bb.st === 'do' && D.ACTS[bb.act] && D.ACTS[bb.act].lock) p += add('正在' + D.ACTS[bb.act].zh, -0.2);
    const n = crowd(B, A); if (n >= 2 && it.intim >= 0.5) p += add('在大家面前', -0.12 - (has(B, 'shy') ? 0.1 : 0));
    const w = W(B), now = Sim().now(), rej = (w.rej[A.id] || []).filter((t) => now - t < 1440); if (rej.length) p += add('剛拒絕過', -0.08 * Math.min(3, rej.length));
    const lastA = W(A).last[B.id]; if (lastA && lastA.kind === kind && now - lastA.at < 60) p += add('一直做同樣的事', -0.18);
    const rift = OC.Arcs && OC.Arcs.riftOf && OC.Arcs.riftOf(B.id, A.id); if (rift && rift.stage === 'cold' && it.tone !== 'mend') p += add('還在冷戰', -0.45);
    return { p: clamp(p, 0, 0.97), parts };
  }
  const hint = (B, A, kind) => { const w = willing(B, A, kind); return w.hard ? { face: '🔒', p: 0 } : { face: w.p >= 0.62 ? '😊' : w.p >= 0.38 ? '😐' : '🙁', p: w.p }; };
  /** the reaction (deterministic given the roll) */
  function react(B, A, kind, p, roll) {
    const it = INTER[kind] || { intim: 0.2, tone: 'warm' }, r = M().rel(B.id, A.id), gap = it.intim - closeness(r), m = p - roll, emo = M().dominant(B);
    if (it.tone === 'neg') { if (r.conflict > 45 || has(B, 'hotheaded')) return 'push'; if (has(B, 'gentle') || has(B, 'sensitive') || emo === 'down') return 'cry'; if (has(B, 'calm')) return 'stunned'; return roll < 0.5 ? 'annoyed' : 'flee'; }
    if (m > 0) { if (it.tone === 'tease' && B.personality.expression > 60 && roll < 0.35) return 'tease'; return m > 0.35 ? 'warm' : m > 0.12 ? 'accept' : 'reluctant'; }
    if (gap > 0.25) return has(B, 'shy') || B.personality.social < 40 ? 'shy' : r.conflict > 30 ? 'push' : 'stunned';
    if (emo === 'annoyed') return 'annoyed';
    if (emo === 'down' && m < -0.3) return 'cry';
    if (it.tone === 'tease') return B.personality.expression > 60 ? 'tease' : 'annoyed';
    return m > -0.15 ? 'awkward' : 'decline';
  }
  /** the engine asks: B's answer to A's kind (with the dice) */
  function respond(bb, ba, kind) {
    const B = Ch().get(bb.id), A = Ch().get(ba.id), w = willing(B, A, kind), roll = Sim().rnd(), rx = w.hard ? 'stunned' : react(B, A, kind, w.p, roll), ok = !w.hard && REACT[rx][1];
    return { ans: ok ? 'yes' : 'no', why: ok ? '' : REACT[rx][0], react: rx, p: w.p, roll, parts: w.parts };
  }

  // ---------------------------------------------------------------- the player's character may not do it
  /** a small chance the character you play will not do what you asked (stubborn more, an obedient one less) — with the reason */
  function defies(A, B, kind) {
    const base = S().life.settings.defy != null ? +S().life.settings.defy : 0.06; if (!base) return null;
    const it = INTER[kind] || { intim: 0.2, tone: 'warm' }, rAB = M().rel(A.id, B.id), emo = M().dominant(A);
    let p = base * (has(A, 'stubborn') ? 1.8 : 1) * (has(A, 'obedient') || has(A, 'diligent') ? 0.5 : 1) * (emo === 'annoyed' ? 1.5 : 1);
    if (it.tone === 'neg' && rAB.aff > 50) p += 0.25;   /* to be mean to someone it likes */
    if (it.intim - closeness(rAB) > 0.35) p += has(A, 'shy') ? 0.3 : 0.12;   /* too shy to */
    if (Sim().rnd() >= p) return null;
    return it.tone === 'neg' && rAB.aff > 50 ? `${name(A)}不想對${name(B)}這樣` : it.intim - closeness(rAB) > 0.35 ? `${name(A)}有點不好意思` : emo === 'annoyed' ? `${name(A)}現在沒那個心情` : `${name(A)}今天不太想`;
  }

  // ---------------------------------------------------------------- performance and consequences (new interactions)
  function script(conv, say, A, B) {
    const it = INTER[conv.kind], rx = conv.answer.react || (conv.answer.ans === 'yes' ? 'accept' : 'decline'), R = REACT[rx];
    say('a', 'i16_' + conv.kind, { anim: it.animA, dur: 1.4, nudge: it.intim > 0.4 ? 0.5 : 0.2, other: R[1] && it.animB && it.intim >= 0.4 ? it.animB : null });
    say('b', 'r16_' + rx, { anim: R[1] ? (rx === 'warm' || rx === 'accept' ? it.animB || R[3] : R[3]) : R[3], dur: 1.5 });
    if (!R[1] && it.tone !== 'neg') say('a', 'r16_after', { anim: 'headscratch', dur: 1.0 });
  }
  function resolve(conv, A, B) {
    const it = INTER[conv.kind], ans = conv.answer || { react: 'accept' }, rx = ans.react || 'accept', R = REACT[rx], now = Sim().now(), r = M().rel(B.id, A.id), gap = it.intim - closeness(r);
    const scale = (o, k) => Object.fromEntries(Object.entries(o).map(([x, v]) => [x, Math.round(v * k * 10) / 10]));
    const gain = (c, d) => { for (const [k, v] of Object.entries(d)) if (c.needs[k] != null) c.needs[k] = clamp(c.needs[k] + v, 0, 100); };
    const memo = (c, other, text, imp, key) => text && M().remember(c, { type: it.tone === 'neg' ? 'conflict' : 'social', imp, who: [other.id], text: text.replace('{other}', name(other)), key });
    W(A).last[B.id] = { kind: conv.kind, at: now };
    if (it.tone === 'neg') {
      const k = rx === 'push' || rx === 'annoyed' ? 1.3 : rx === 'cry' ? 1.1 : 1;
      M().relPair(A.id, B.id, scale(it.rel, k), it.zh); gain(B, it.needs);
      if (rx === 'cry') M().feel(A, 'worried', 0.4, `${name(B)}哭了`, B.id);
      M().feel(B, R[4], 0.55, `${it.zh}・${name(A)}`, A.id);
      memo(B, A, it.mem, it.imp, conv.id + 'b'); memo(A, B, `對{other}${it.zh}（對方${R[0]}）`, it.imp * 0.8, conv.id + 'a');
    } else if (R[1]) {
      M().relPair(A.id, B.id, scale(it.rel, R[2]), it.zh); gain(A, scale(it.needs, R[2])); gain(B, scale(it.needs, R[2]));
      M().feel(A, R[5], 0.35, `${it.zh}・${name(B)}`, B.id); M().feel(B, R[4], 0.4, `${it.zh}・${name(A)}`, A.id);
      if (it.mem && it.imp) memo(B, A, it.mem, it.imp * (rx === 'warm' ? 1.15 : 1), conv.id + 'b');
      if (it.mem && it.imp >= 0.5) memo(A, B, `和{other}：${it.zh}`, it.imp * 0.8, conv.id + 'a');
      if (OC.Progress) OC.Progress.emit('social', { oc: A.id, other: B.id, ocs: [A.id, B.id], kind: conv.kind, place: OC.World.area && OC.World.area.id });
    } else {
      /* it did not go well: too much too soon is felt and remembered; a turned-down offer stings a little */
      const w = W(B); (w.rej[A.id] = (w.rej[A.id] || []).filter((t) => now - t < 1440)).push(now);
      const hurt = gap > 0.2 ? Math.min(10, gap * 14) : 1;
      M().relChange(B.id, A.id, { aff: -Math.round(hurt), conflict: gap > 0.2 ? Math.round(gap * 12) : 0 }, '太突然');
      M().relChange(A.id, B.id, { aff: has(A, 'sensitive') ? -3 : -1 }, '被拒絕');
      M().feel(A, R[5], has(A, 'sensitive') || has(A, 'pessimist') ? 0.45 : 0.25, `${name(B)}${R[0]}`, B.id); M().feel(B, R[4], 0.35, `${it.zh}・${name(A)}`, A.id);
      if (gap > 0.25) memo(B, A, `{other}突然想${it.zh}，我嚇了一跳`, 0.45, conv.id + 'b');
      if (rx === 'cry' || rx === 'push') memo(A, B, `想和{other}${it.zh}，結果對方${R[0]}`, 0.45, conv.id + 'a');
    }
    (A.life.socialAt = A.life.socialAt || {})[B.id] = now; (B.life.socialAt = B.life.socialAt || {})[A.id] = now;
    if (OC.Mind11) OC.Mind11.onSocial(A, B, conv.kind, !!R[1]);
    if (OC.Arcs) OC.Arcs.onSocial(A, B, it.tone === 'neg' ? 'argue' : conv.kind);
    St.emit('will:done', { a: A.id, b: B.id, kind: conv.kind, react: rx, ok: !!R[1] });
  }

  // ---------------------------------------------------------------- characters choosing these on their own
  const pickable = (it, c, o, r) => !(it.tone === 'love' && !M().romanceOK(c.id, o.id)) && !(it.tone === 'neg' && r.conflict < 30 && M().dominant(c) !== 'annoyed') && !(it.tone === 'mend' && r.conflict < 15) && (!OC.People || OC.People.canDo(c, 'chat'));
  function cands(c, o, r, s0, K) {
    const ids = Object.keys(NEW), n = ids.length;
    for (let i = 0; i < 4; i++) {   /* a few at a time — enough variety without crowding out the everyday ones */
      const id = ids[Math.floor(Sim().rnd() * n)], it = INTER[id]; if (!pickable(it, c, o, r)) continue;
      const fit = 0.12 - Math.max(0, it.intim - closeness(r)) * 0.8 + (it.tone === 'neg' ? r.conflict / 200 : 0) + (it.tone === 'mend' ? r.conflict / 150 : 0) + (OC.Traits13 ? OC.Traits13.soc(c, id) : 0);
      K(id, s0 - 0.3 + fit, it.zh);
    }
  }

  // ---------------------------------------------------------------- doing things together at a place
  /** a joint kind for an activity (sitting on a bench, reading, a ride …) */
  function jointKind(act) {
    const A = D.ACTS[act]; if (!A) return null; const id = 'with_' + act;
    if (!D.SOCIAL[id]) D.SOCIAL[id] = { zh: '一起' + A.zh, ic: A.ic || '🤝', joint: act, dur: [15, 30], with16: true };
    return id;
  }
  /** the player's character asks someone (or the AI does) — starts the real social engine */
  function ask(aId, bId, kind, o = {}) {
    const A = Ch().get(aId), B = Ch().get(bId), ba = OC.Brain.get(aId), bb = OC.Brain.get(bId); if (!A || !B || !ba || !bb) return { ok: false, why: '對方不在這裡' };
    if (INTER[kind] && INTER[kind].tone === 'love' && !M().romanceOK(aId, bId)) return { ok: false, why: OC.People && (OC.People.minor(A) || OC.People.minor(B)) ? '未成年不會有戀愛相關的互動' : '戀愛功能沒有為他們打開（生活設定）' };
    if (OC.People && !OC.People.canDo(A, 'chat')) return { ok: false, why: OC.People.whyNot(A, 'chat') };
    if (o.player) { const no = defies(A, B, kind); if (no) { St.emit('will:defy', { a: aId, b: bId, kind, why: no }); return { ok: false, why: no, defy: true }; } }
    { const ev = OC.Events && OC.Events.current; if (ev && ev.cast && [ev.cast.a, ev.cast.b].some((x) => x && (x.id === aId || x.id === bId))) return { ok: false, why: '他們正在經歷一件特別的事' }; }
    if (bb.holds.size || bb.st === 'event') return { ok: false, why: `${name(B)}在忙` };
    if (ba.st === 'do') OC.Brain.finish(ba, '玩家安排'); else if (ba.st === 'go') OC.Brain.abort(ba, '玩家安排');
    if (ba.st === 'social') return { ok: false, why: `${name(A)}正在和別人說話` };
    ba.st = 'think';
    const ok = OC.Brain.Social.start(ba, bb, kind);
    if (!ok) return { ok: false, why: bb.holds.size ? `${name(B)}在忙` : '走不過去' };
    const conv = OC.Brain.convs.find((x) => x.a === ba); if (conv) { conv.byPlayer = !!o.player; if (o.at) conv.at = o.at; }
    return { ok: true };
  }
  const invite = (aId, bId, act, at) => { const k = jointKind(act); return k ? ask(aId, bId, k, { player: true, at }) : { ok: false, why: '這裡不能一起做' }; };

  function init() { if (S().life.settings.defy == null) S().life.settings.defy = 0.06; if (S().life.settings.willHint == null) S().life.settings.willHint = true; }

  OC.Will = { CATS, INTER, REACT, has: has16, inter: (k) => INTER[k], closeness, willing, hint, react, respond, defies, script, resolve, cands, jointKind, ask, invite, init };
})();
