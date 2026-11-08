/* OC Shimeji — 8.0 dialogue pass (data only, same format as LifeData.LINES: [cat, text, conditions, weight]).
 * Goals: sound like a person, not a status report. Short, situational, different per voice / trait / mood,
 * no forced cuteness or lecturing; most lines say something ABOUT the moment (time, weather, a need, a memory,
 * the relationship) instead of announcing "I feel X". Endings, catchphrases and pronouns are added by OC.Chars.speak.
 */
(function () {
  'use strict';
  const D = OC.LifeData; if (!D || !D.LINES) return;
  const P = { voice: 'plain' }, B = { voice: 'bright' }, C = { voice: 'calm' }, K = { voice: 'cool' };
  const L = [
    // ---- to the player, everyday ----
    ['chat_player', '早。你醒得比我想的還早。', { phase: 'morning', voice: 'cool' }, 2], ['chat_player', '早安！我已經起來好一陣子了！', { phase: 'morning', voice: 'bright' }, 2],
    ['chat_player', '早上的光照在水面上，一閃一閃的。', { phase: 'morning', voice: 'calm' }, 2],
    ['chat_player', '中午了耶，你吃飯了沒？', { phase: 'noon' }, 2], ['chat_player', '太陽好大，我想找個陰影坐一下。', { phase: 'noon', wx: 'clear' }, 2],
    ['chat_player', '天色開始變橘了。', { phase: 'dusk', voice: 'calm' }, 2], ['chat_player', '黃昏的時候，影子會變得好長。', { phase: 'dusk' }, 2],
    ['chat_player', '這麼晚了，你還不睡？', { phase: 'night' }, 2], ['chat_player', '晚上好安靜，連海浪都變小聲了。', { phase: 'night', voice: 'calm' }, 2],
    ['chat_player', '下雨天最適合待在屋簷下發呆了。', { wx: 'rain' }, 2], ['chat_player', '你聽，雨打在葉子上的聲音。', { wx: 'rain', voice: 'calm' }, 2],
    ['chat_player', '霧好濃，我差點走錯路。', { wx: 'fog' }, 2], ['chat_player', '今天的雲走得好快。', { wx: 'cloudy' }, 2],
    ['chat_player', '欸，你有沒有覺得今天特別順？', { emo: ['happy', 'excited'] }, 2], ['chat_player', '沒事啦，只是有點提不起勁。', { emo: ['down', 'lonely'] }, 3],
    ['chat_player', '……陪我坐一下就好。', { emo: ['down', 'lonely'], voice: ['calm', 'cool'] }, 3], ['chat_player', '我剛剛差點睡著。', { emo: 'tired' }, 3],
    ['chat_player', '肚子在抗議了。', { need: { food: '<30' } }, 3], ['chat_player', '眼睛快張不開了……', { need: { sleep: '<25' } }, 3],
    ['chat_player', '好想找誰聊聊天。', { need: { social: '<30' } }, 3], ['chat_player', '有沒有什麼好玩的事？我快悶壞了。', { need: { fun: '<30' } }, 3],
    ['chat_player', '你來啦。', { aff_player: '>=30', voice: ['cool', 'calm'] }, 2], ['chat_player', '每次看到你，我就會忍不住笑出來。', { aff_player: '>=40', voice: 'bright' }, 2],
    ['chat_player', '跟你在一起的時候，時間過得特別快。', { aff_player: '>=60' }, 2], ['chat_player', '我們好像還不太熟……不過沒關係。', { aff_player: '<10' }, 2],
    ['chat_player', '我剛剛{recent}，下次要不要一起？', { hasRecent: true }, 3], ['chat_player', '我一直在想{mem}的事。', { hasMem: true }, 2],
    ['chat_player', '你知道{like}嗎？我最近超迷的。', { voice: 'bright' }, 1], ['chat_player', '要是有{like}就好了。', P, 1],
    ['chat_player', '其實……我有點想要{wish}。', { hasWish: true, trait: 'shy' }, 3], ['chat_player', '我決定了，我要{wish}！', { hasWish: true, voice: 'bright' }, 2],
    ['chat_player', '我剛剛想了一個笑話，可是講出來就不好笑了。', { trait: 'humorous' }, 3], ['chat_player', '你看那朵雲，像不像一隻打哈欠的貓？', { trait: ['dreamy', 'creative'] }, 3],
    ['chat_player', '我剛把東西排整齊了，你別弄亂喔。', { trait: ['tidy', 'perfectionist'] }, 3], ['chat_player', '夕陽……好適合說心事。', { trait: 'romantic', phase: 'dusk' }, 4],
    ['chat_player', '咦，我剛剛要做什麼來著？', { trait: 'clumsy' }, 3], ['chat_player', '今天想去沒去過的地方看看。', { trait: ['brave', 'curious'] }, 3],
    ['chat_player', '剛才有隻小鳥停在我旁邊！', { trait: 'animallover' }, 3], ['chat_player', '我一個人待著也很自在，不用擔心我。', { trait: 'introvert' }, 3],
    ['chat_player', '大家都去哪了？好想熱鬧一點。', { trait: 'extrovert', need: { social: '<50' } }, 3], ['chat_player', '早起的人可以獨佔整個早晨。', { trait: 'earlybird', phase: 'morning' }, 4],
    ['chat_player', '晚上才是我的時間。', { trait: 'nightowl', phase: 'night' }, 4],
    // ---- being petted / touched (8.0 direct touch) ----
    ['pet', '……嗯，再一下下。', { voice: 'calm' }, 2], ['pet', '嘿嘿嘿。', { voice: 'bright' }, 2], ['pet', '頭髮要被你弄亂了啦。', { voice: 'cool' }, 2],
    ['pet', '你的手好溫暖。', { aff_player: '>=30' }, 2], ['pet', '欸、欸——好癢！', { trait: ['sensitive', 'energetic'] }, 3], ['pet', '……不、不要一直摸啦。', { trait: 'shy' }, 3],
    ['pet', '我還在生氣喔……好啦，摸一下下可以。', { emo: 'annoyed' }, 4], ['pet', '好想就這樣睡著。', { emo: 'tired' }, 3],
    ['prank_ok', '再一次！再高一點！', { trait: ['brave', 'energetic'] }, 3], ['prank_ok', '哇——！好刺激！', B, 2], ['prank_ok', '……下次先說一聲。', K, 2],
    ['prank_bad', '頭好暈……', P, 2], ['prank_bad', '嚇死我了……', { trait: 'shy' }, 3], ['prank_bad', '不要再丟我了啦！', { voice: 'bright' }, 2], ['prank_bad', '……你很開心嘛。', K, 2],
    // ---- to other OCs ----
    ['talk', '你頭上沾到葉子了。', P, 1], ['talk', '我剛剛在想，如果島會說話，它會說什麼？', { trait: ['dreamy', 'curious'] }, 2],
    ['talk', '欸你聽我說，剛才超好笑的——', { trait: 'humorous' }, 2], ['talk', '你今天看起來心情不錯。', P, 1], ['talk', '等一下要不要一起去散步？', { voice: 'bright' }, 1],
    ['talk', '……我不太會聊天，但跟你說話不累。', { trait: ['introvert', 'shy'] }, 3], ['talk', '你上次說的事，後來怎麼樣了？', { hasMem: true }, 2],
    ['talk_r', '真的嗎？', P, 1], ['talk_r', '哈哈，你很奇怪耶。', B, 1], ['talk_r', '嗯，我懂。', C, 1], ['talk_r', '……也是。', K, 1],
    ['solo_need', '先吃點東西好了。', { need: { food: '<30' } }, 2], ['solo_need', '眼皮好重。', { need: { sleep: '<25' } }, 2],
    ['solo_rest', '就這樣坐著看海，也不錯。', C, 2], ['solo_rest', '休息一下，等等再繼續。', P, 1],
  ];
  const base = D.LINES.length;
  L.forEach((x, i) => D.LINES.push({ id: 'p8_' + (base + i), cat: x[0], text: x[1], c: x[2] || null, w: x[3] || 1 }));
})();
