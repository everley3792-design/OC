/* OC Shimeji — life simulation data (Phase 4). Pure data, no logic:
 *   NEEDS       9 needs (rates per GAME hour; 100 = fully satisfied)
 *   EMOTIONS    emotion catalogue (valence, arousal, half-life in game minutes, face, idle action)
 *   ACTS        autonomous activities (affordance verb, effects per game hour, duration, animation)
 *   SOCIAL      social interaction kinds (conditions are evaluated in brain.js)
 *   HABIT_RULES acquired habits / traits detected from real behaviour records (need consent)
 *   LINES       built-in dialogue lines (data-driven; players can add/override, see docs/life-format.md)
 *   EVENTS      built-in life events (lifecycle in events.js)
 * Everything here is original content. Formats are documented in docs/life-format.md.
 */
(function () {
  'use strict';

  const NEEDS = [
    { id: 'food', zh: '飽足', ic: 'apple', c: 'var(--need-food)', decay: 10, how: '在家、攤位或野餐桌吃飯，或把食物拖到牠身上' },
    { id: 'energy', zh: '精力', ic: 'zap', c: 'var(--need-energy)', decay: 6, how: '坐下休息、打盹或睡覺；走很多路會下降' },
    { id: 'sleep', zh: '睡眠', ic: 'sleep', c: 'var(--need-sleep)', decay: 5.5, how: '晚上回家或在小床上睡覺；睡不夠會影響精力與心情' },
    { id: 'fun', zh: '娛樂', ic: 'sparkle', c: 'var(--need-fun)', decay: 7, how: '玩耍、閱讀、看風景、和朋友一起玩' },
    { id: 'social', zh: '社交', ic: 'users', c: 'var(--need-social)', decay: 5, how: '和其他 OC 聊天、一起活動、被你摸摸頭' },
    { id: 'comfort', zh: '舒適', ic: 'sofa', c: 'var(--need-comfort)', decay: 4, how: '坐在長椅、椅子或靠墊上；下雨時下降較快' },
    { id: 'interest', zh: '好奇', ic: 'compass', c: 'var(--need-interest)', decay: 3, how: '探索、閱讀、觀察；一直做同樣的事會下降' },
    { id: 'active', zh: '活動', ic: 'walk', c: 'var(--need-active)', decay: 4, how: '散步、玩耍、伸展；坐太久會下降' },
    { id: 'mood', zh: '心情', ic: 'smile', c: 'var(--need-mood)', how: '由其他需求與情緒慢慢決定；開心的事會讓心情變好' },
  ];

  // face: overrides for the rig; act: idle action while this emotion dominates (only when not busy)
  const EMOTIONS = {
    neutral: { zh: '平靜', e: '', v: 0, a: 0.2, hl: 60, face: {} },
    happy: { zh: '愉快', e: '♪', v: 0.7, a: 0.5, hl: 90, face: { eyes: 'happy', mouth: 'smile' }, act: 'happy' },
    excited: { zh: '興奮', e: '✦', v: 0.8, a: 0.9, hl: 45, face: { eyes: 'sparkle', mouth: 'open' }, act: 'jump', prio: 1.1 },
    calm: { zh: '安心', e: '〜', v: 0.45, a: 0.1, hl: 120, face: { eyes: 'line', mouth: 'smile' } },
    shy: { zh: '害羞', e: '♡', v: 0.1, a: 0.5, hl: 25, face: { blush: 1, mouth: 'wave' }, act: 'shy' },
    nervous: { zh: '緊張', e: '💦', v: -0.3, a: 0.7, hl: 35, face: { sweat: true, mouth: 'wave' } },
    bored: { zh: '無聊', e: '…', v: -0.2, a: 0.1, hl: 60, face: { eyes: 'line', mouth: 'flat' } },
    tired: { zh: '疲倦', e: 'z', v: -0.3, a: 0.05, hl: 40, face: { eyes: 'sleepy', mouth: 'flat' } },
    lonely: { zh: '寂寞', e: '☁', v: -0.5, a: 0.2, hl: 60, face: { mouth: 'frown', lookY: 0.6 }, act: 'sad' },
    down: { zh: '低落', e: '☂', v: -0.7, a: 0.2, hl: 150, face: { brows: 'worry', mouth: 'frown', lookY: 0.8 }, act: 'sad' },
    jealous: { zh: '吃醋', e: '〃', v: -0.4, a: 0.6, hl: 45, face: { mouth: 'frown', brows: 'angry' } },
    confused: { zh: '困惑', e: '?', v: -0.1, a: 0.4, hl: 15, face: { mouth: 'wave' }, act: 'think' },
    curious: { zh: '好奇', e: '!?', v: 0.3, a: 0.6, hl: 40, face: { eyes: 'wide' } },
    surprised: { zh: '驚訝', e: '!', v: 0, a: 0.95, hl: 6, face: { eyes: 'wide', mouth: 'o' }, act: 'surprised', prio: 1.4 },
    annoyed: { zh: '煩躁', e: '💢', v: -0.55, a: 0.7, hl: 50, face: { brows: 'angry', mouth: 'frown' }, act: 'angry', prio: 1.1 },
    content: { zh: '滿足', e: '❀', v: 0.6, a: 0.2, hl: 120, face: { eyes: 'happy', mouth: 'cat' } },
    proud: { zh: '得意', e: '★', v: 0.65, a: 0.6, hl: 60, face: { eyes: 'happy', mouth: 'grin' }, act: 'happy' },
  };

  /* activities. verb: affordance verb to look for (null = in place; 'wander'/'explore' = a walkable point)
   * fx: change per GAME hour while doing; dur: [min,max] game minutes; until: stop early when satisfied
   * seat: uses a seat pose; inside: happens inside a building (actor hidden); lock: cannot be interrupted
   * by ordinary decisions (only by urgent needs/player). sk: skill that gains xp. sed: sedentary. */
  const ACTS = {
    eat: { zh: '吃飯', ic: '🍙', verb: 'eat', fx: { food: 150, comfort: 10 }, dur: [25, 40], anim: 'eat', until: { food: 96 }, lock: true, sed: true, sk: 'cook', cat: 'need' },
    drink: { zh: '喝飲料', ic: '🥤', verb: 'drink', fx: { food: 60, fun: 30 }, dur: [8, 12], anim: 'drink', sed: true, cat: 'need' },
    rest: { zh: '休息', ic: '☕', verb: 'sit', fx: { energy: 40, comfort: 60 }, dur: [20, 45], anim: 'sit', seat: true, sed: true, until: { energy: 98, comfort: 98 }, cat: 'rest' },
    nap: { zh: '打盹', ic: '💤', verb: 'nap', fx: { energy: 45, sleep: 30, comfort: 40 }, dur: [25, 45], anim: 'sleep', seat: true, sed: true, lock: true, cat: 'rest' },
    sleep: { zh: '睡覺', ic: '🌙', verb: 'sleep', fx: { sleep: 14, energy: 10, comfort: 6 }, dur: [300, 600], anim: 'sleep', sed: true, lock: true, clock: true, cat: 'need' },
    stretch: { zh: '伸展', ic: '🙆', verb: null, fx: { active: 300, comfort: 60, energy: 20 }, dur: [4, 7], anim: 'stretch', cat: 'body' },
    daydream: { zh: '發呆', ic: '☁', verb: null, fx: { fun: 40, interest: 20, comfort: 20 }, dur: [10, 20], anim: 'think', sed: true, cat: 'fun' },
    walk: { zh: '散步', ic: '🚶', verb: 'wander', fx: { fun: 30 }, dur: [3, 6], anim: 'idle', cat: 'body' },
    explore: { zh: '探索', ic: '🧭', verb: 'explore', fx: { interest: 120, fun: 30 }, dur: [6, 12], anim: 'idle', look: true, cat: 'fun' },
    read: { zh: '閱讀', ic: '📖', verb: 'read', fx: { fun: 45, interest: 60, comfort: 30 }, dur: [20, 40], anim: 'read', seat: true, sed: true, sk: 'reading', cat: 'fun' },
    play: { zh: '玩耍', ic: '⚽', verb: 'play', fx: { fun: 180, active: 120, energy: -30 }, dur: [10, 18], anim: 'play', sk: 'sport', cat: 'fun' },
    observe: { zh: '看風景', ic: '🌅', verb: 'view', fx: { fun: 40, interest: 45, comfort: 10 }, dur: [10, 20], anim: 'idle', sed: true, look: true, cat: 'fun' },
    tend: { zh: '照顧植物', ic: '🌱', verb: 'tend', fx: { interest: 40, fun: 40, active: 40 }, dur: [10, 20], anim: 'tend', sk: 'garden', cat: 'chore' },
    tidy: { zh: '整理家具', ic: '🧹', verb: 'tidy', fx: { comfort: 60, fun: 15, active: 30 }, dur: [8, 14], anim: 'tend', cat: 'chore' },
    // Phase 5: activities that live at specific places (the AI travels for them)
    fish: { zh: '釣魚', ic: '🎣', verb: 'fish', fx: { fun: 55, interest: 35, comfort: -6 }, dur: [20, 40], anim: 'fish', sed: true, look: true, sk: 'fishing', cat: 'fun' },
    forage: { zh: '採集', ic: '🫐', verb: 'forage', fx: { interest: 60, fun: 30, active: 40 }, dur: [8, 14], anim: 'forage', sk: 'garden', cat: 'fun' },
    study: { zh: '讀書', ic: '✏️', verb: 'study', fx: { interest: 70, fun: 12, energy: -10 }, dur: [30, 50], anim: 'study', seat: true, sed: true, sk: 'reading', cat: 'fun' },
    cook: { zh: '做料理', ic: '🍳', verb: 'cook', fx: { fun: 40, interest: 20, food: 60 }, dur: [15, 25], anim: 'cook', sk: 'cook', cat: 'chore' },
    browse: { zh: '逛街', ic: '🛍️', verb: 'browse', fx: { fun: 60, interest: 40, social: 10 }, dur: [8, 15], anim: 'browse', look: true, cat: 'fun' },
  };
  // walking costs/benefits are per DISTANCE (design units) so time speed never changes them
  const WALK_FX = { active: 0.11, energy: -0.025, comfort: -0.015 };

  /* social kinds. dur: game minutes the pair stays together after the talk (joint activities). */
  const SOCIAL = {
    greet: { zh: '打招呼', ic: '👋', brief: true },
    chat: { zh: '聊天', ic: '💬' },
    share: { zh: '分享興趣', ic: '💡' },
    compliment: { zh: '稱讚', ic: '✨' },
    comfort: { zh: '安慰', ic: '🤍' },
    joke: { zh: '開玩笑', ic: '😆' },
    prank: { zh: '惡作劇', ic: '🎭' },
    food: { zh: '分享食物', ic: '🍪' },
    gift: { zh: '送小禮物', ic: '🎁' },
    restTogether: { zh: '一起休息', ic: '🪑', joint: 'rest', dur: [15, 30] },
    playTogether: { zh: '一起玩', ic: '⚽', joint: 'play', dur: [10, 18], group: true },
    stargaze: { zh: '一起看星星', ic: '🌌', joint: 'observe', dur: [15, 25], group: true },
    argue: { zh: '爭執', ic: '💢' },
    apologize: { zh: '道歉', ic: '🙇' },
  };

  /* acquired habits / traits. Detected from real records (rec.act[act].n / ctx / place / seq).
   * nothing is applied without the player's consent (OC.Mind.suggest → resolve). */
  const HABIT_RULES = [
    { id: 'rainread', type: 'habit', zh: '雨天閱讀', act: 'read', ctx: 'rain', min: 3, ask: '{name}最近總喜歡在雨天找個安靜的地方閱讀……要讓{pron}保留「雨天閱讀」這個習慣嗎？', fx: { act: 'read', wx: 'rain', add: 0.45 } },
    { id: 'earlywalk', type: 'habit', zh: '早晨散步', act: 'walk', ctx: 'morning', min: 4, ask: '{name}好像很喜歡在早上出門散步，要把「早晨散步」記成{pron}的習慣嗎？', fx: { act: 'walk', phase: 'morning', add: 0.4 } },
    { id: 'stargazer', type: 'habit', zh: '夜晚看星星', act: 'observe', ctx: 'night', min: 3, ask: '{name}晚上常常一個人跑去看天空，要保留「夜晚看星星」嗎？', fx: { act: 'observe', phase: 'night', add: 0.45 } },
    { id: 'mealrest', type: 'habit', zh: '飯後休息', seq: 'eat>rest', min: 3, ask: '{name}吃完飯總會找地方坐一下，要把「飯後休息」記下來嗎？', fx: { act: 'rest', after: 'eat', add: 0.5 } },
    { id: 'bedread', type: 'habit', zh: '睡前閱讀', seq: 'read>sleep', min: 3, ask: '{name}睡覺前好像都會先讀一會兒書，要保留「睡前閱讀」嗎？', fx: { act: 'read', phase: 'night', add: 0.35 } },
    { id: 'gardener', type: 'habit', zh: '照顧花圃', act: 'tend', min: 5, ask: '{name}常常去看看花圃和果樹，要讓「照顧花圃」成為{pron}的日常嗎？', fx: { act: 'tend', add: 0.3 } },
    { id: 'favspot', type: 'habit', zh: '固定的老位置', place: true, min: 5, ask: '{name}特別喜歡待在「{place}」，要把那裡記成{pron}最愛的地方嗎？', fx: { place: true, add: 0.35 } },
    { id: 't_bookworm', type: 'trait', value: 'bookworm', act: 'read', min: 8, ask: '{name}讀了好多書，要讓{pron}多一個特質「熱愛閱讀」嗎？' },
    { id: 't_nature', type: 'trait', value: 'nature', act: ['tend', 'observe'], min: 9, ask: '{name}常常待在花草和風景旁邊，要加上特質「喜歡自然」嗎？' },
    { id: 't_social', type: 'trait', value: 'social', act: 'social', min: 12, ask: '{name}最近和大家聊得很開心，要加上特質「社交達人」嗎？' },
    { id: 't_sleepy', type: 'trait', value: 'sleepy', act: 'nap', min: 5, ask: '{name}好常打盹喔……要加上特質「愛睡」嗎？' },
    { id: 't_curious', type: 'trait', value: 'curious', act: 'explore', min: 8, ask: '{name}總是到處探險，要加上特質「好奇」嗎？' },
    { id: 't_tidy', type: 'trait', value: 'tidy', act: 'tidy', min: 6, ask: '{name}很常整理家具，要加上特質「愛乾淨」嗎？' },
    { id: 't_nightowl', type: 'trait', value: 'nightowl', nightAwake: 10, ask: '{name}晚上常常還醒著到處跑，要加上特質「夜貓子」嗎？' },
  ];

  // ======================= dialogue lines =======================
  // [cat, text, cond?, weight?]. Variables: {name} {other} {pron} {opron} {like} {hobby} {shared} {item} {place} {time} {wx} {mem} {wish} {act} {days}
  // voice: bright (lively) / calm (soft, polite) / cool (dry, rational) / plain — derived from personality + speech style
  const B = { voice: 'bright' }, C = { voice: 'calm' }, K = { voice: 'cool' }, P = { voice: 'plain' };
  const L = [
    // ---- greetings ----
    ['greet', '嗨，{other}！', P], ['greet', '{other}～早安！今天也一起加油吧！', Object.assign({ phase: 'morning' }, B)], ['greet', '哇，是{other}！好巧喔！', B], ['greet', '{other}，你好……', C], ['greet', '……嗯，{other}。', K],
    ['greet', '晚上好，{other}。', Object.assign({ phase: 'night' }, C)], ['greet', '{other}！我正想找人說話呢！', Object.assign({ need: { social: '<45' } }, B)], ['greet', '那、那個……你好。', { rel: ['stranger'], trait: 'shy' }, 3],
    ['greet', '初次見面，我是{name}。', { rel: ['stranger'] }, 2], ['greet', '喲，老朋友！', { rel: ['bestfriend', 'family'] }, 3], ['greet', '是你呀～', { rel: ['friend', 'bestfriend'] }, 2], ['greet', '……又是你。', { rel: ['rival'] }, 4],
    ['greet_r', '嗨嗨！', B], ['greet_r', '你好呀。', C], ['greet_r', '嗯。', K], ['greet_r', '喔，{other}！', P], ['greet_r', '你、你好……', { trait: 'shy', rel: ['stranger', 'acquaintance'] }, 3], ['greet_r', '哼。', { rel: ['rival'] }, 4],
    // ---- small talk (topics) ----
    ['talk', '今天的{wx}天氣，你喜歡嗎？', P], ['talk', '你知道嗎？我最近超喜歡{like}！', B], ['talk', '我在想……雲會不會也有自己的名字呢。', Object.assign({}, C)], ['talk', '今天好像很適合{act}。', K],
    ['talk', '下雨的聲音好好聽喔。', { wx: ['rain'] }, 3], ['talk', '霧好濃，感覺會有神秘的事情發生。', { wx: ['fog'] }, 3], ['talk', '晚上的小島好安靜。', { phase: 'night' }, 2], ['talk', '早上的空氣最新鮮了！', { phase: 'morning' }, 2],
    ['talk', '我好餓……你有吃的嗎？', { need: { food: '<35' } }, 3], ['talk', '呼啊……我有點想睡了。', { need: { sleep: '<35' } }, 3], ['talk', '好無聊喔，要不要一起做點什麼？', { need: { fun: '<35' } }, 3],
    ['talk', '還記得{mem}嗎？', { hasMem: true }, 3], ['talk', '我最近有個小願望：{wish}。', { hasWish: true }, 3], ['talk', '你也喜歡{shared}嗎？太好了！', { hasShared: true }, 3],
    ['talk', '最近大家都好嗎？', C], ['talk', '我剛剛{act}，很開心！', { hasRecent: true }, 2], ['talk', '島上的花又開了。', { trait: 'nature' }, 3], ['talk', '我剛讀到一個很有趣的故事。', { trait: 'bookworm' }, 3],
    ['talk_r', '真的嗎？好有趣！', B], ['talk_r', '哇，然後呢？', P], ['talk_r', '嗯？說來聽聽。', P], ['talk_r', '好像在哪裡聽過耶。', P], ['talk_r', '哈哈，我也這樣覺得。', P], ['talk_r', '欸——真的假的！', B],
    ['talk', '你今天做了什麼？', P], ['talk', '我剛剛看到一隻好大的蝴蝶。', P], ['talk', '你覺得明天會下雨嗎？', P], ['talk', '突然好想吃{like}。', P],
    ['greet_r', '嗨～', P], ['greet_r', '你也在這裡呀。', P], ['bye', '下次再聊！', P], ['bye', '我去{act}囉。', P], ['accept', '可以呀！', P], ['decline', '現在不太方便耶……', P], ['talk_r', '嗯嗯，我懂。', C], ['talk_r', '原來如此。', K], ['talk_r', '對呀對呀！', P], ['talk_r', '……嗯。', { rel: ['rival'] }, 3], ['talk_r', '我也是這麼想的！', { aff: '>=40' }, 2], ['talk_r', '哈哈，你好好笑。', { emo: ['happy', 'excited'] }, 2],
    ['talk_r', '我現在不太想說話……', { emo: ['down', 'annoyed'] }, 4], ['talk_r', '（點點頭）', { trait: 'shy' }, 2],
    // ---- interests ----
    ['share', '我最近在研究{hobby}，你要聽聽看嗎？', P], ['share', '跟你說喔，{hobby}真的超好玩！', B], ['share', '關於{hobby}……我有一些小小的想法。', C],
    ['share_r', '我也喜歡{shared}！', { hasShared: true }, 4], ['share_r', '聽起來很不錯，下次教我。', P], ['share_r', '嗯……我還不太懂，但你說得很開心呢。', C],
    // ---- compliments / comfort / jokes ----
    ['compliment', '{other}，你今天看起來好有精神！', P], ['compliment', '你的笑容很溫暖。', C], ['compliment', '欸嘿，你真的超可愛的！', B], ['compliment', '……做得不錯。', K],
    ['compliment_r', '嘿嘿，謝謝你～', P], ['compliment_r', '欸、欸？謝……謝謝。', { trait: 'shy' }, 4], ['compliment_r', '哼，我知道。', K],
    ['comfort', '{other}，你還好嗎？我陪你坐一下。', P], ['comfort', '沒關係的，慢慢來。', C], ['comfort', '別難過啦！我們去做點開心的事！', B], ['comfort', '有什麼需要幫忙的，說一聲。', K],
    ['comfort_r', '……謝謝你，有你在真好。', P], ['comfort_r', '嗯……好多了。', C], ['comfort_r', '我想一個人靜一靜……', { emo: ['annoyed'] }, 3],
    ['joke', '你知道為什麼海很鹹嗎？因為魚都在偷哭！', P], ['joke', '我剛剛把雲朵當成棉花糖，差點咬下去！', B], ['joke', '一隻螃蟹走進咖啡廳，結果橫著出來了。', K],
    ['laugh', '哈哈哈！好好笑！', B], ['laugh', '噗……你真是的。', C], ['laugh', '……（忍住笑）', K], ['flat', '……呃，好冷。', P], ['flat', '我聽不太懂……', C],
    ['prank', '嘿！（從後面嚇你）', P], ['prank', '你頭上有一片葉子……騙你的！', B],
    ['prank_ok', '哇！嚇死我了啦，哈哈！', B], ['prank_ok', '你喔……好啦好啦。', C], ['prank_bad', '一點都不好玩！', P], ['prank_bad', '……我生氣了。', K],
    // ---- food / gifts ----
    ['food', '我這裡有點心，分你一半！', P], ['food', '要不要一起吃？很好吃喔！', B], ['food', '……多的，給你。', K],
    ['food_r', '哇，謝謝！好好吃！', B], ['food_r', '謝謝你，真貼心。', C], ['food_r', '謝了。', K],
    ['gift', '這朵花送你，在路邊看到就想到你了。', P], ['gift', '送你一個小禮物！猜猜是什麼～', B], ['gift', '……這個，給你。', K],
    ['gift_r', '送我的嗎？我會好好珍惜的！', P], ['gift_r', '哇——！謝謝！', B], ['gift_r', '……謝謝，我很喜歡。', K],
    // ---- invitations ----
    ['invite', '要不要一起{act}？', P], ['invite', '我們去{act}吧！走嘛走嘛～', B], ['invite', '如果你有空……要一起{act}嗎？', C], ['invite', '{act}。一起？', K],
    ['accept', '好呀！', B], ['accept', '嗯，好。', C], ['accept', '走吧。', K], ['accept', '好啊，一起去！', P],
    ['decline', '抱歉，我現在有點累……', { need: { energy: '<40' } }, 3], ['decline', '我還在{act}，下次吧。', { busy: true }, 4], ['decline', '……不要。', { rel: ['rival'] }, 4], ['decline', '我現在想一個人待著。', P], ['decline', '不好意思，下次好嗎？', C],
    ['later', '等我一下，等等就去！', P], ['later', '晚一點好嗎？', C],
    ['declined', '這樣啊……好吧。', P], ['declined', '嗚，被拒絕了。', B], ['declined', '……知道了。', K],
    // ---- conflict ----
    ['argue', '你剛剛那樣真的很過分！', P], ['argue', '為什麼每次都這樣啦！', B], ['argue', '我不同意你的做法。', K], ['argue', '我、我有點不開心……', C],
    ['argue_r', '明明是你先的！', P], ['argue_r', '哼，隨便你。', K], ['argue_r', '對不起……我不是故意的。', { trait: 'gentle' }, 4],
    ['apologize', '之前的事……對不起。', P], ['apologize', '我想了很久，是我不對，對不起！', B], ['apologize', '我們和好好嗎？', C], ['apologize', '……抱歉。是我太衝了。', K],
    ['forgive', '嗯，我也有不對的地方。和好吧！', P], ['forgive', '沒關係啦！我們還是好朋友！', B], ['forgive', '好，我原諒你。', K],
    ['refuse', '……我還沒準備好原諒你。', P], ['refuse', '哼，再說吧。', { trait: 'stubborn' }, 4],
    ['bye', '那我先走囉！', P], ['bye', '掰掰～下次見！', B], ['bye', '再見。', C], ['bye', '嗯，走了。', K],
    // ---- solo thoughts while doing activities (shown as small bubbles) ----
    ['solo_read', '嗯……接下來會怎樣呢？', P], ['solo_read', '這一頁好感人……', C], ['solo_read', '原來是這樣，有道理。', K], ['solo_read', '雨聲配書，最棒了。', { wx: ['rain'] }, 4],
    ['solo_eat', '好好吃～', P], ['solo_eat', '嚼嚼嚼……', B], ['solo_eat', '{like}的話會更好吃吧。', { trait: 'picky' }, 3], ['solo_eat', '再一碗！', { trait: 'foodie' }, 3],
    ['solo_observe', '好漂亮……', P], ['solo_observe', '那朵雲像{like}耶！', B], ['solo_observe', '星星好多……', { phase: 'night', wx: ['clear', 'cloudy'] }, 4], ['solo_observe', '海的那邊有什麼呢？', { trait: 'curious' }, 3],
    ['solo_tend', '要長得高高的喔～', P], ['solo_tend', '今天也很有精神呢。', C], ['solo_rest', '呼……真舒服。', P], ['solo_rest', '坐一下下就好……', { trait: 'lazy' }, 2],
    ['solo_play', '嘿！看我的！', B], ['solo_play', '再一次！', P], ['solo_explore', '這裡好像沒來過！', P], ['solo_explore', '咦？這是什麼？', { trait: 'curious' }, 3],
    ['solo_daydream', '如果能飛的話……', P], ['solo_daydream', '……（發呆中）', C], ['solo_walk', '今天走哪條路好呢？', P], ['solo_stretch', '嗯——伸——懶——腰——', P],
    ['solo_sleep', 'zzz……{like}……', P], ['solo_tidy', '整整齊齊的，好舒服。', P],
    ['solo_need', '肚子咕嚕咕嚕叫……', { need: { food: '<25' } }, 5], ['solo_need', '好睏……', { need: { sleep: '<25' } }, 5], ['solo_need', '好想找人說說話。', { need: { social: '<25' } }, 5], ['solo_need', '好無聊……', { need: { fun: '<25' } }, 5],
    // ---- to the player ----
    ['pet', '嘿嘿，好舒服～', P], ['pet', '再、再摸一下也可以……', { trait: 'shy' }, 3], ['pet', '呼嚕呼嚕……', B], ['pet', '……還行。', K], ['pet', '我現在不想被摸啦！', { emo: ['annoyed'] }, 5],
    ['call', '來了來了！', B], ['call', '叫我嗎？', P], ['call', '嗯？有什麼事？', K], ['call', '好……我過去。', C],
    ['fed_like', '是{item}！我最喜歡了！', P], ['fed_ok', '謝謝你的{item}～', P], ['fed_bad', '呃……{item}嗎……謝謝你的心意。', P], ['fed_full', '我吃不下了啦……', P],
    ['played', '好好玩！再來一次！', B], ['played', '嘿嘿，謝謝你陪我玩。', P], ['played', '……還不錯。', K],
    ['chat_player', '你今天過得好嗎？', P], ['chat_player', '跟你說，{other}今天和我{act}喔！', { hasRecentWith: true }, 4], ['chat_player', '剛剛想到一件事，結果你一出現就忘了。', P], ['chat_player', '有你在，我覺得很安心。', { aff_player: '>=1' }, 2],
    ['chat_player', '我想要……{wish}。', { hasWish: true }, 4], ['chat_player', '我最近很常{habit}。', { hasHabit: true }, 3], ['chat_player', '還記得{mem}嗎？', { hasMem: true }, 3],
    ['chat_player', '今天天氣{wx}呢。', P], ['chat_player', '偷偷告訴你，我很喜歡{like}。', P],
    ['wish_done', '願望實現了！謝謝你！', P], ['wish_done', '耶——！好開心！', B], ['wish_done', '……嗯，太好了。', K],
    // ---- event lines ----
    ['ev_meet', '你好，我是{name}，以後請多指教！', P], ['ev_meet_r', '我是{name}，請多指教～', P], ['ev_friend', '我覺得……我們已經是朋友了吧？', P], ['ev_friend_r', '當然！', P],
    ['ev_best', '{other}，你是我最好的朋友！', P], ['ev_best_r', '你也是我最好的朋友！', P], ['ev_anniv', '我們認識{days}天了耶！', P], ['ev_anniv_r', '時間過得好快喔。', P],
    ['ev_stars', '你看，那顆星星好亮。', P], ['ev_stars_r', '真的……好漂亮。', P], ['ev_rain', '下雨了！', B], ['ev_rain', '下雨了……找個地方躲雨吧。', C], ['ev_rain', '雨天最適合讀書了。', { trait: 'bookworm' }, 5],
    ['ev_morning', '早安，小島！今天也是好天氣！', B], ['ev_morning', '早安……', C], ['ev_badsleep', '昨晚沒睡好……', P], ['ev_discover', '咦！這裡有個閃閃發光的東西！', P],
    ['ev_gift_player', '這個送給你！是我剛剛找到的。', P], ['ev_nostalgia', '突然想起{mem}……', P], ['ev_confess', '{other}……我好像，喜歡上你了。', P], ['ev_confess_r', '……我也是。', P],
    ['ev_lonely', '大家都不在……', P], ['ev_cheerup', '好！打起精神來！', B],
    // ---- pet / app context (for the floating pet; conditions on app) ----
    // ---- places (Phase 5) ----
    ['arrive', '這裡就是{place}呀！', P], ['arrive', '哇——{place}！', B], ['arrive', '……{place}，好安靜。', { voice: 'calm', place: ['library'] }, 3], ['arrive', '人好多……', { trait: 'shy', place: ['street'] }, 4],
    ['arrive', '海風好舒服！', { place: ['beach'] }, 3], ['arrive', '咖啡的香味！', { place: ['cafe'] }, 3], ['arrive', '森林的味道……', { place: ['forest'] }, 3], ['arrive', '我回來了～', { place: ['home', 'isle'] }, 2],
    ['solo_fish', '咬鉤吧……', P], ['solo_fish', '今天會釣到什麼呢？', B], ['solo_fish', '（靜靜地等著）', C], ['solo_forage', '這顆莓果好紅！', P], ['solo_forage', '香草的味道……', C],
    ['solo_study', '原來如此……', K], ['solo_study', '再讀一頁就好。', P], ['solo_cook', '加一點點鹽……', P], ['solo_cook', '好香喔！', B], ['solo_browse', '這個好可愛！', B], ['solo_browse', '下次來買這個。', P],
    ['new_furn', '咦？這是新的{item}！', P], ['new_furn', '哇，新家具！我可以坐坐看嗎？', B], ['new_furn', '……多了一件{item}。不錯。', K],
    ['place_date', '一起來咖啡館真好。', P], ['place_date', '這家的拿鐵超好喝！', B], ['place_sunset', '夕陽把海染成橘色了。', P], ['place_sunset', '……好美。', C],
    ['tasted_first', '這是什麼味道……？', P], ['tasted_fav', '好好吃！我最喜歡這個了！', P], ['tasted_fav', '天啊——太好吃了！！', B], ['tasted_like', '嗯，好吃！', P], ['tasted_ok', '還可以。', P], ['tasted_dislike', '呃……不太合我的口味。', P], ['tasted_hate', '嗚……我真的不行……', P], ['tasted_hate', '……（皺眉）', K],
    ['wear', '這件好看嗎？', P], ['wear', '新衣服！轉一圈給你看！', B], ['wear', '……還挺合適的。', K], ['toy', '要玩這個嗎？好呀！', P], ['toy', '這個好好玩！', B],
    ['app', '工作辛苦了，休息一下吧。', { app: ['work'] }], ['app', '在看影片嗎？我也要看！', { app: ['video'] }], ['app', '在跟誰聊天呀？', { app: ['chat'] }], ['app', '很晚了，早點睡喔。', { phase: 'night' }],
  ];
  const LINES = L.map((x, i) => ({ id: 'b' + i, cat: x[0], text: x[1], c: x[2] || null, w: x[3] || 1 }));

  // ======================= life events =======================
  /* trigger: tick | relUp | dayStart | wake | wxChange | meet | discover
   * cast: a = main OC; b = other OC (optional, chosen by `bc` conditions relative to a)
   * c: conditions on a (with b as "other"); steps run in order (see events.js); fx = results */
  const EVENTS = [
    { id: 'firstMeet', zh: '初次見面', trigger: 'meet', prio: 5, once: 'pair', b: true, bc: { rel: ['stranger'] },
      steps: [['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['say', 'a', 'ev_meet'], ['anim', 'b', 'greet', 1.2], ['say', 'b', 'ev_meet_r'], ['emote', 'a', '♪']],
      fx: { rel: { ab: { fam: 8, aff: 4 }, ba: { fam: 8, aff: 4 } }, emo: { a: ['happy', 0.4], b: ['shy', 0.3] }, mem: { both: { type: 'milestone', imp: 0.8, text: '第一次認識了{other}' } } } },
    { id: 'becameFriends', zh: '成為朋友', trigger: 'relUp', when: { to: 'friend' }, prio: 4, once: 'pair', b: true,
      steps: [['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['say', 'a', 'ev_friend'], ['anim', 'b', 'happy', 1.5], ['say', 'b', 'ev_friend_r'], ['anim', 'a', 'jump', 0.6]],
      fx: { rel: { ab: { trust: 6 }, ba: { trust: 6 } }, emo: { a: ['happy', 0.6], b: ['happy', 0.6] }, mem: { both: { type: 'milestone', imp: 0.9, text: '和{other}成為了朋友' } } } },
    { id: 'bestFriends', zh: '最好的朋友', trigger: 'relUp', when: { to: 'bestfriend' }, prio: 5, once: 'pair', b: true, important: true, watch: true,
      steps: [['cam', 'a'], ['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['say', 'a', 'ev_best'], ['anim', 'b', 'shy', 1.2], ['say', 'b', 'ev_best_r'], ['anim', 'a', 'happy', 1.5], ['anim', 'b', 'happy', 1.5], ['sound', 'chime']],
      fx: { rel: { ab: { trust: 8, intim: 6 }, ba: { trust: 8, intim: 6 } }, emo: { a: ['excited', 0.7], b: ['excited', 0.7] }, mem: { both: { type: 'milestone', imp: 1, text: '和{other}成為了最好的朋友' } } } },
    { id: 'anniversary', zh: '認識紀念日', trigger: 'dayStart', prio: 3, b: true, bc: { days: [7, 30, 100, 365], rel: ['friend', 'bestfriend', 'family', 'lover', 'partner'] }, once: 'pairDays',
      steps: [['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['say', 'a', 'ev_anniv'], ['say', 'b', 'ev_anniv_r'], ['anim', 'a', 'happy', 1.2]],
      fx: { rel: { ab: { aff: 4 }, ba: { aff: 4 } }, emo: { a: ['content', 0.5], b: ['content', 0.5] }, mem: { both: { type: 'milestone', imp: 0.85, text: '和{other}認識{days}天的紀念日' } } } },
    { id: 'rainArrives', zh: '下雨了', trigger: 'wxChange', when: { wx: 'rain' }, prio: 2, cd: 240,
      steps: [['anim', 'a', 'surprised', 0.8], ['say', 'a', 'ev_rain']],
      fx: { emo: { a: ['surprised', 0.5] }, react: true } },
    { id: 'rainRead', zh: '雨天的閱讀時光', trigger: 'actStart', when: { act: 'read', wx: 'rain' }, prio: 2, cd: 600, chance: 0.6,
      steps: [['say', 'a', 'solo_read'], ['emote', 'a', '📖']],
      fx: { emo: { a: ['calm', 0.6] }, need: { a: { mood: 4 } }, mem: { a: { type: 'event', imp: 0.55, text: '雨天在{place}安靜地讀書' } } } },
    { id: 'stargaze', zh: '一起看星星', trigger: 'tick', when: { phase: 'night', wx: ['clear', 'cloudy'] }, prio: 3, cd: 1440, chance: 0.35, b: true, bc: { aff: '>=30' }, c: { notrait: 'sleepy', need: { sleep: '>35' } },
      social: 'stargaze', fx: { emo: { a: ['content', 0.6], b: ['content', 0.6] }, rel: { ab: { intim: 3, aff: 3 }, ba: { intim: 3, aff: 3 } }, mem: { both: { type: 'event', imp: 0.75, text: '和{other}一起看了星星' } } } },
    { id: 'morningStretch', zh: '早晨的元氣', trigger: 'wake', when: { phase: 'morning' }, prio: 1, cd: 1200, chance: 0.5, c: { voice: 'bright' },
      steps: [['anim', 'a', 'stretch', 2], ['say', 'a', 'ev_morning']],
      fx: { emo: { a: ['happy', 0.4] }, need: { a: { active: 8 } } } },
    { id: 'badSleep', zh: '沒睡好', trigger: 'wake', prio: 2, cd: 1200, c: { need: { sleep: '<55' } },
      steps: [['anim', 'a', 'sad', 1.5], ['say', 'a', 'ev_badsleep']],
      fx: { emo: { a: ['tired', 0.5] }, mem: { a: { type: 'event', imp: 0.35, text: '昨晚沒有睡好' } } } },
    { id: 'discovery', zh: '小發現', trigger: 'actEnd', when: { act: 'explore' }, prio: 2, cd: 720, chance: 0.3, c: { trait: ['curious', 'nature'] },
      steps: [['anim', 'a', 'surprised', 0.8], ['say', 'a', 'ev_discover'], ['anim', 'a', 'happy', 1.2]],
      fx: { emo: { a: ['excited', 0.6] }, need: { a: { interest: 20 } }, mem: { a: { type: 'discover', imp: 0.6, text: '在{place}發現了閃閃發光的小石頭' } } } },
    { id: 'giftPlayer', zh: '送你的禮物', trigger: 'tick', prio: 3, cd: 2880, chance: 0.15, c: { aff_player: '>=12', emo: ['happy', 'content', 'excited'] }, watch: true, ask: '{name}好像有東西想給你',
      steps: [['go', 'a', 'player'], ['face', 'a', 'player'], ['say', 'a', 'ev_gift_player'], ['anim', 'a', 'greet', 1.2]],
      fx: { item: 'flower', emo: { a: ['happy', 0.5] }, mem: { a: { type: 'player', imp: 0.6, text: '送了一朵花給你' } } } },
    { id: 'nostalgia', zh: '想起從前', trigger: 'tick', prio: 1, cd: 1440, chance: 0.25, c: { hasMem: true, emo: ['calm', 'content', 'neutral', 'bored'] },
      steps: [['anim', 'a', 'think', 2], ['say', 'a', 'ev_nostalgia']],
      fx: { emo: { a: ['content', 0.35] } } },
    { id: 'lonelyMoment', zh: '一個人的時候', trigger: 'tick', prio: 2, cd: 720, chance: 0.4, c: { need: { social: '<25' } },
      steps: [['anim', 'a', 'sad', 1.6], ['say', 'a', 'ev_lonely']],
      fx: { emo: { a: ['lonely', 0.5] }, wish: { a: 'social' } } },
    { id: 'firstVisit', zh: '第一次來到這裡', trigger: 'arrive', prio: 3, once: 'self+place', c: {},
      steps: [['anim', 'a', 'surprised', 0.8], ['say', 'a', 'arrive'], ['emote', 'a', '✦']],
      fx: { emo: { a: ['curious', 0.5] }, mem: { a: { type: 'discover', imp: 0.6, text: '第一次來到{place}' } } } },
    { id: 'cafeDate', zh: '咖啡館時光', trigger: 'tick', when: { place: ['cafe'] }, prio: 3, cd: 1440, chance: 0.5, b: true, bc: { aff: '>=35' },
      steps: [['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['say', 'a', 'place_date'], ['say', 'b', 'talk_r'], ['anim', 'a', 'happy', 1.2]],
      fx: { rel: { ab: { aff: 4, intim: 2 }, ba: { aff: 4, intim: 2 } }, emo: { a: ['content', 0.5], b: ['content', 0.5] }, mem: { both: { type: 'social', imp: 0.65, text: '和{other}在咖啡館度過悠閒時光' } } } },
    { id: 'beachSunset', zh: '海邊的夕陽', trigger: 'tick', when: { place: ['beach'], phase: 'dusk' }, prio: 2, cd: 1440, chance: 0.5,
      steps: [['anim', 'a', 'think', 1.5], ['say', 'a', 'place_sunset']],
      fx: { emo: { a: ['calm', 0.6] }, mem: { a: { type: 'event', imp: 0.55, text: '在星砂海灘看了夕陽' } } } },
    { id: 'confess', zh: '告白', trigger: 'tick', prio: 6, once: 'pair', chance: 0.4, b: true, bc: { romance: true, aff: '>=75', intim: '>=55' }, important: true, watch: true, ask: '{name}好像有重要的話想對{other}說',
      steps: [['cam', 'a'], ['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['anim', 'a', 'shy', 1.5], ['say', 'a', 'ev_confess'], ['say', 'b', 'ev_confess_r']],
      confirm: { title: '要讓{name}和{other}成為戀人嗎？', body: '這是重大的關係變化，需要你同意。拒絕的話，牠們仍然是好朋友。', ok: { relType: 'lover' } },
      fx: { emo: { a: ['shy', 0.8], b: ['shy', 0.8] }, mem: { both: { type: 'milestone', imp: 1, text: '向{other}說出了心意' } } } },
  ];

  OC.LifeData = { NEEDS, EMOTIONS, ACTS, WALK_FX, SOCIAL, HABIT_RULES, LINES, EVENTS };
})();
