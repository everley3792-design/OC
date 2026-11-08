/* OC Shimeji — 11.0 touch dialogue (data only, same format as LifeData.LINES: [cat, text, conditions, weight]).
 * Lines for being stroked on a specific spot, ticklish giggles and "not there!" complaints. Voices/traits make the same
 * moment sound different; the speech system (OC.Chars.speak) adds endings / catchphrases sparingly.
 */
(function () {
  'use strict';
  const D = OC.LifeData; if (!D || !D.LINES) return;
  const L = [
    // ---- ears
    ['pet_ears', '耳朵、耳朵不行啦……癢癢的。', { trait: 'shy' }, 3], ['pet_ears', '欸欸——耳朵很敏感耶！', {}, 2], ['pet_ears', '摸耳朵的話……就一下下喔。', { voice: 'cool' }, 2],
    ['pet_ears', '呼……耳朵被揉得好舒服。', { voice: 'calm' }, 2], ['pet_ears', '嘿嘿，耳朵在動耶！', { voice: 'bright' }, 2],
    // ---- cheek
    ['pet_cheek', '臉頰……軟軟的對吧？', { voice: 'calm' }, 2], ['pet_cheek', '你捏我的臉啦～', { voice: 'bright' }, 2], ['pet_cheek', '臉、臉好燙……', { trait: 'shy' }, 3],
    ['pet_cheek', '……這樣會說不清楚話。', { voice: 'cool' }, 2], ['pet_cheek', '再摸一下下嘛。', { aff_player: '>=30' }, 2],
    // ---- belly
    ['pet_belly', '肚子……肚子是弱點啦！', {}, 2], ['pet_belly', '你在摸我的肚子耶，我可是會當真的。', { voice: 'cool' }, 2], ['pet_belly', '呼嚕呼嚕呼嚕……', { voice: ['calm', 'plain'] }, 2],
    ['pet_belly', '好舒服……整個人都要攤平了。', { emo: ['tired', 'content'] }, 3], ['pet_belly', '剛吃飽的肚子要輕一點喔。', { need: { food: '>70' } }, 3],
    // ---- tail
    ['pet_tail', '哇啊！那裡是尾巴啦！', {}, 3], ['pet_tail', '尾巴不可以隨便碰……', { voice: 'cool' }, 2], ['pet_tail', '嚇我一跳！', { voice: 'bright' }, 2],
    // ---- tickle
    ['pet_tickle', '哈哈哈哈！好癢好癢！', {}, 3], ['pet_tickle', '等、等一下——哈哈哈！', { voice: ['bright', 'plain'] }, 3], ['pet_tickle', '呵、呵呵……不行，我會笑出來……', { voice: ['calm', 'cool'] }, 3],
    ['pet_tickle', '你、你故意的！哈哈！', { aff_player: '>=30' }, 2], ['pet_tickle', '嘻嘻嘻！住手啦～', { trait: 'shy' }, 2],
    // ---- not there / too much
    ['pet_dislike', '那裡……不要摸。', { voice: ['cool', 'plain'] }, 3], ['pet_dislike', '欸，不要啦。', {}, 2], ['pet_dislike', '好了好了，夠了喔。', { voice: ['calm', 'plain'] }, 2],
    ['pet_dislike', '我、我不太喜歡那樣……', { trait: 'shy' }, 3], ['pet_dislike', '哼，摸夠了沒？', { voice: 'cool' }, 2], ['pet_dislike', '（轉過頭去）', { voice: 'cool', aff_player: '<20' }, 2],
    ['pet_dislike', '摸太久了啦，我的毛都亂了！', {}, 2], ['pet_dislike', '你的手有點冰欸……', { wx: ['rain', 'fog'] }, 1],
    // ---- gestures (ring menu 親近)
    ['hug_start', '要、要抱嗎？……好啦。', { trait: 'shy' }, 3], ['hug_start', '來！抱一個！', { voice: 'bright' }, 3], ['hug_start', '嗯……過來吧。', { voice: ['calm', 'cool'] }, 2],
    ['hug_end', '謝謝你。我需要這個。', { voice: ['calm', 'plain'] }, 2], ['hug_end', '嘿嘿，暖暖的。', { voice: 'bright' }, 2], ['hug_end', '……好啦，放開我吧。（沒有真的想放開）', { voice: 'cool' }, 2],
    ['hug_start', '今天辛苦啦，抱一下。', { phase: 'night' }, 2], ['hug_end', '被你抱著，心跳都慢下來了。', { aff_player: '>=50' }, 2],
    ['highfive_ok', '耶！好響！', { voice: 'bright' }, 3], ['highfive_ok', '漂亮。', { voice: ['cool', 'plain'] }, 3], ['highfive_ok', '啪！我們配合得真好。', { aff_player: '>=30' }, 2],
    ['highfive_miss', '欸？你錯過了啦。', {}, 3], ['highfive_miss', '……我的手舉得好尷尬。', { voice: 'cool' }, 2], ['highfive_miss', '再、再來一次！', { voice: 'bright' }, 2],
    ['poke', '哎唷！', {}, 3], ['poke', '戳我幹嘛啦～', { voice: 'bright' }, 2], ['poke', '……嗯？有事嗎。', { voice: 'cool' }, 2], ['poke', '嚇一跳！', { trait: 'shy' }, 2], ['poke', '再戳我就戳回去喔。', { aff_player: '>=30' }, 2],
    ['handhold_start', '好，一起走。', { voice: ['plain', 'cool'] }, 2], ['handhold_start', '牽著走好有安全感喔。', { voice: ['calm', 'bright'] }, 2], ['handhold_start', '手、手牽手……', { trait: 'shy' }, 3],
    ['handhold_end', '好啦，手鬆開了。下次再牽喔。', {}, 2],
  ];
  // ---- 11.0 planning / knowing each other
  L.push(
    ['goal_done', '好，今天想做的事做到了。', { voice: ['plain', 'cool'] }, 2], ['goal_done', '耶，小小的目標達成！', { voice: 'bright' }, 3], ['goal_done', '嗯，這樣就夠了。心裡踏實多了。', { voice: 'calm' }, 2],
    ['know_fav', '你好像很喜歡{favact}耶。我有注意到。', {}, 3], ['know_fav', '{favact}的時候你最有精神了。', { voice: 'bright' }, 2], ['know_fav', '我記得你常常在{favact}。', { voice: ['calm', 'plain'] }, 2],
    ['know_fav', '……你常去{favact}吧。我只是碰巧看到。', { voice: 'cool' }, 2],
    ['know_mood', '你剛剛看起來不太有精神，還好嗎？', {}, 3], ['know_mood', '我剛看到你有點{mood}。要不要聊聊？', { voice: ['calm', 'bright'] }, 2], ['know_mood', '嗯……我注意到你有點{mood}。', { voice: ['cool', 'plain'] }, 2],
  );
  // ---- 11.0 paired interactions (A asks / acts, B answers)
  L.push(
    ['hug_a', '……來，抱一下。', { voice: ['calm', 'cool', 'plain'] }, 3], ['hug_a', '過來過來，我要抱你！', { voice: 'bright' }, 3], ['hug_a', '你看起來需要一個擁抱。', { aff_player: '>=0' }, 2],
    ['hug_b', '……謝謝。我好多了。', { voice: ['calm', 'plain'] }, 3], ['hug_b', '嘿嘿，暖暖的。', { voice: 'bright' }, 3], ['hug_b', '（把臉埋進去）', { trait: 'shy' }, 3], ['hug_b', '……別太用力啦。', { voice: 'cool' }, 2],
    ['hf_a', '來，擊掌！', {}, 3], ['hf_a', '欸，這個要慶祝一下！', { voice: 'bright' }, 2], ['hf_b', '啪！', {}, 3], ['hf_b', '耶～！', { voice: 'bright' }, 3], ['hf_b', '……不錯。', { voice: 'cool' }, 2],
    ['dance_a', '來跳舞吧，轉圈圈！', { voice: 'bright' }, 3], ['dance_a', '有沒有想動一動？', { voice: ['plain', 'calm'] }, 2], ['dance_a', '……跟著我的拍子，別踩到我。', { voice: 'cool' }, 2],
    ['dance_b', '哈哈，頭都暈了！', {}, 3], ['dance_b', '再來一次！', { voice: 'bright' }, 2],
    ['selfie_a', '靠過來一點，我們拍張照。', {}, 3], ['selfie_a', '三、二、一——！', { voice: 'bright' }, 3], ['selfie_b', '比個耶！', { voice: 'bright' }, 3], ['selfie_b', '我表情怪怪的嗎？', { trait: 'shy' }, 2], ['selfie_b', '……拍好看一點喔。', { voice: 'cool' }, 2],
    ['rps_a', '猜拳決定吧！剪刀、石頭——', {}, 3], ['rps_win', '我贏了！', { voice: 'bright' }, 3], ['rps_win', '……嗯，運氣不錯。', { voice: 'cool' }, 2], ['rps_win', '耶！', {}, 2],
    ['tickle_a', '嘿嘿，看招！', { voice: 'bright' }, 3], ['tickle_a', '我知道你的弱點在哪裡～', {}, 2],
    ['tickle_ok', '哈哈哈！好癢！饒了我吧！', {}, 3], ['tickle_ok', '等一下等一下——哈哈！', { voice: ['bright', 'plain'] }, 2], ['tickle_bad', '……不要這樣。', { voice: ['cool', 'plain'] }, 3], ['tickle_bad', '別鬧了，真的很癢。', {}, 2],
    ['pat_a', '乖乖。', { voice: ['calm', 'plain'] }, 2], ['pat_a', '辛苦了，拍拍。', {}, 3], ['pat_a', '拍拍頭，沒事的。', { voice: 'bright' }, 2], ['pat_b', '……幹嘛啦。', { voice: 'cool' }, 2], ['pat_b', '嗯……', { trait: 'shy' }, 3], ['pat_b', '被拍頭的感覺還不錯。', { voice: ['calm', 'plain'] }, 2],
    ['whisper_a', '欸，我告訴你一個祕密，不要跟別人說。', {}, 3], ['whisper_a', '（小聲）我只跟你說喔。', { voice: ['bright', 'calm'] }, 2], ['whisper_b', '……真的假的？我不會說出去的。', {}, 3], ['whisper_b', '嘿嘿，我們有共同的祕密了。', { voice: 'bright' }, 2],
    ['lean_a', '……借我靠一下。', { voice: ['calm', 'cool', 'plain'] }, 3], ['lean_a', '好累喔，讓我靠一下。', { voice: 'bright' }, 2], ['lean_b', '靠吧，我在這裡。', {}, 3], ['lean_b', '（沒有說話，只是坐穩了一點）', { voice: ['calm', 'cool'] }, 2],
    ['peek_a', '（遮著臉）——找不到我！', { voice: 'bright' }, 3], ['peek_a', '看不見我看不見我～', {}, 2], ['peek_b', '哇啊！嚇我一跳！', {}, 3], ['peek_b', '哈哈，你躲在哪裡啦！', { voice: 'bright' }, 2],
  );
  for (const l of L) D.LINES.push(l);
})();
