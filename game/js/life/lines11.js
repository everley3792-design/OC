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
  for (const l of L) D.LINES.push(l);
})();
