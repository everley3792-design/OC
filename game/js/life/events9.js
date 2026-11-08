/* OC Shimeji — 9.0 events & short stories (data only; same format as LifeData.EVENTS / LINES).
 * Small, character-driven moments that come from traits, moods, time, weather, places and relationships:
 * pranks and how the other one takes it, a snack shared, a silly argument and making up, cloud watching,
 * a clumsy trip and who helps, a late-night talk, a joke (you choose how to react), and a three-part story
 * ("秘密基地") that unfolds over several days through flags. Every result goes through the event engine
 * (relationships, feelings, needs, memories with keys) — no rewards are given by events.
 */
(function () {
  'use strict';
  const D = OC.LifeData; if (!D || !D.EVENTS || !D.LINES) return;
  const P = { voice: 'plain' }, B = { voice: 'bright' }, C = { voice: 'calm' }, K = { voice: 'cool' };

  const EV = [
    // ---- pranks: a playful OC startles a friend; how it lands depends on the friend ----
    { id: 'prank', zh: '小小的惡作劇', trigger: 'tick', prio: 2, cd: 1440, chance: 0.35, b: true, c: { trait: ['humorous', 'energetic', 'curious'] }, bc: { aff: '>=20', notrait: ['sensitive'] },
      steps: [['go', 'a', 'b'], ['anim', 'a', 'shy', 0.6], ['say', 'a', 'ev_prank'], ['anim', 'b', 'surprised', 0.9], ['sound', 'bonk'], ['say', 'b', 'ev_prank_r'], ['anim', 'a', 'laugh', 1.2], ['anim', 'b', 'laugh', 1.2]],
      fx: { rel: { ab: { aff: 2, fam: 2 }, ba: { aff: 2, fam: 2 } }, emo: { a: ['happy', 0.5], b: ['happy', 0.4] }, need: { a: { fun: 10 }, b: { fun: 8 } }, mem: { both: { type: 'social', imp: 0.45, text: '和{other}鬧著玩，笑成一團' } } } },
    { id: 'prankBad', zh: '玩笑開過頭', trigger: 'tick', prio: 2, cd: 1440, chance: 0.25, b: true, c: { trait: ['humorous', 'energetic'] }, bc: { aff: '>=10', otrait: ['sensitive', 'shy'] },
      steps: [['go', 'a', 'b'], ['say', 'a', 'ev_prank'], ['anim', 'b', 'surprised', 0.9], ['anim', 'b', 'sad', 1.4], ['say', 'b', 'ev_prank_bad'], ['anim', 'a', 'shy', 1]],
      fx: { rel: { ab: { conflict: 2 }, ba: { conflict: 5, aff: -2 } }, emo: { a: ['nervous', 0.4], b: ['annoyed', 0.5] }, flag: 'needApology', mem: { both: { type: 'social', imp: 0.5, text: '和{other}之間有點尷尬' } } } },
    // ---- making up after a conflict ----
    { id: 'makeUp', zh: '和好', trigger: 'tick', prio: 3, cd: 720, chance: 0.5, b: true, bc: { conflict: '>=6', aff: '>=0' },
      steps: [['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['anim', 'a', 'shy', 1], ['say', 'a', 'ev_sorry'], ['say', 'b', 'ev_sorry_r'], ['anim', 'a', 'happy', 1.2], ['anim', 'b', 'happy', 1.2]],
      fx: { rel: { ab: { conflict: -6, trust: 3, aff: 2 }, ba: { conflict: -6, trust: 3, aff: 2 } }, emo: { a: ['calm', 0.5], b: ['calm', 0.5] }, mem: { both: { type: 'social', imp: 0.7, text: '和{other}和好了' } } } },
    // ---- a silly argument about food (both have strong opinions) ----
    { id: 'tasteFight', zh: '口味之爭', trigger: 'tick', prio: 2, cd: 2880, chance: 0.3, b: true, c: { trait: ['foodie', 'picky', 'stubborn'] }, bc: { fam: '>=10' },
      steps: [['face', 'a', 'b'], ['say', 'a', 'ev_taste_fight'], ['anim', 'b', 'shake', 1], ['say', 'b', 'ev_taste_fight_r'], ['anim', 'a', 'angry', 1], ['emote', 'b', '💢']],
      fx: { rel: { ab: { conflict: 4, fam: 2 }, ba: { conflict: 4, fam: 2 } }, emo: { a: ['annoyed', 0.35], b: ['annoyed', 0.35] }, mem: { both: { type: 'social', imp: 0.4, text: '和{other}為了吃什麼爭了起來' } } } },
    // ---- sharing a snack with a hungry friend ----
    { id: 'shareSnack', zh: '分你一半', trigger: 'tick', prio: 2, cd: 1440, chance: 0.4, b: true, c: { need: { food: '>=60' }, notrait: 'picky' }, bc: { oneed: { food: '<35' }, aff: '>=5' },
      steps: [['go', 'a', 'b'], ['face', 'a', 'b'], ['say', 'a', 'ev_share_snack'], ['anim', 'b', 'eat', 1.4], ['say', 'b', 'ev_share_snack_r'], ['anim', 'b', 'happy', 1]],
      fx: { rel: { ab: { aff: 2 }, ba: { aff: 4, trust: 3 } }, need: { b: { food: 18, mood: 4 }, a: { social: 6 } }, emo: { a: ['content', 0.4], b: ['happy', 0.5] }, mem: { both: { type: 'social', imp: 0.55, text: '和{other}分著吃點心' } } } },
    // ---- clumsy trip: someone nearby helps ----
    { id: 'clumsyTrip', zh: '跌了一跤', trigger: 'tick', prio: 1, cd: 1440, chance: 0.3, c: { trait: 'clumsy' },
      steps: [['anim', 'a', 'hurt', 0.9], ['sound', 'bonk'], ['say', 'a', 'ev_trip'], ['anim', 'a', 'laugh', 1]],
      fx: { emo: { a: ['shy', 0.35] }, mem: { a: { type: 'event', imp: 0.3, text: '在{place}跌了一跤' } } } },
    { id: 'helpUp', zh: '扶一把', trigger: 'tick', prio: 2, cd: 1440, chance: 0.4, b: true, c: { trait: 'clumsy' }, bc: { aff: '>=0' },
      steps: [['anim', 'a', 'hurt', 0.9], ['sound', 'bonk'], ['go', 'b', 'a'], ['face', 'b', 'a'], ['say', 'b', 'ev_help_up'], ['say', 'a', 'ev_help_up_r'], ['anim', 'a', 'shy', 1]],
      fx: { rel: { ab: { trust: 4, aff: 3 }, ba: { aff: 2 } }, emo: { a: ['shy', 0.5], b: ['content', 0.3] }, mem: { both: { type: 'social', imp: 0.5, text: '{other}扶了我一把' } } } },
    // ---- cloud watching (dreamy / creative) ----
    { id: 'cloudShapes', zh: '雲朵像什麼', trigger: 'tick', when: { phase: ['noon', 'morning'], wx: ['cloudy', 'clear'] }, prio: 2, cd: 1440, chance: 0.35, b: true, c: { trait: ['dreamy', 'creative', 'artsy'] }, bc: { aff: '>=10' },
      steps: [['go', 'a', 'b'], ['anim', 'a', 'think', 1.2], ['say', 'a', 'ev_cloud'], ['anim', 'b', 'think', 1], ['say', 'b', 'ev_cloud_r'], ['anim', 'a', 'happy', 1]],
      fx: { rel: { ab: { intim: 2, aff: 2 }, ba: { intim: 2, aff: 2 } }, need: { a: { fun: 8, interest: 10 }, b: { fun: 6 } }, emo: { a: ['content', 0.5], b: ['calm', 0.4] }, mem: { both: { type: 'event', imp: 0.5, text: '和{other}一起猜雲的形狀' } } } },
    // ---- late-night talk between two night owls ----
    { id: 'midnightTalk', zh: '深夜的悄悄話', trigger: 'tick', when: { phase: 'night' }, prio: 3, cd: 2880, chance: 0.35, b: true, c: { trait: ['nightowl', 'dreamy', 'romantic'] }, bc: { aff: '>=30' },
      steps: [['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['say', 'a', 'ev_midnight'], ['say', 'b', 'ev_midnight_r'], ['emote', 'a', '☾']],
      fx: { rel: { ab: { intim: 4, trust: 3 }, ba: { intim: 4, trust: 3 } }, emo: { a: ['calm', 0.6], b: ['calm', 0.6] }, mem: { both: { type: 'event', imp: 0.7, text: '和{other}在深夜說了好多心裡話' } } } },
    // ---- a joke — you decide how to react (watched events show the choice) ----
    { id: 'jokeForYou', zh: '講笑話給你聽', trigger: 'tick', prio: 2, cd: 1440, chance: 0.25, c: { trait: 'humorous', aff_player: '>=5' }, watch: true, ask: '{name}好像想講笑話給你聽',
      steps: [['go', 'a', 'player'], ['face', 'a', 'player'], ['say', 'a', 'ev_joke'],
        ['choice', '要怎麼回應{name}？', [{ label: '哈哈哈！', say: ['a', 'ev_joke_laugh'], fx: { emo: { a: ['excited', 0.5] }, need: { a: { fun: 10 } } } }, { label: '好冷喔……', say: ['a', 'ev_joke_cold'], fx: { emo: { a: ['shy', 0.4] } } }, { label: '再講一個', say: ['a', 'ev_joke_more'], fx: { emo: { a: ['happy', 0.5] } } }]],
        ['anim', 'a', 'laugh', 1.2]],
      fx: { mem: { a: { type: 'player', imp: 0.45, text: '講了笑話給你聽' } } } },
    // ---- tidying (tidy / perfectionist) at home ----
    { id: 'tidyUp', zh: '大掃除', trigger: 'tick', when: { place: ['home'] }, prio: 1, cd: 2880, chance: 0.35, c: { trait: ['tidy', 'perfectionist'] },
      steps: [['anim', 'a', 'tend', 2], ['say', 'a', 'ev_tidy'], ['anim', 'a', 'proud', 1.2]],
      fx: { emo: { a: ['proud', 0.5] }, need: { a: { comfort: 15, mood: 5 } }, mem: { a: { type: 'event', imp: 0.4, text: '把家裡整理得乾乾淨淨' } } } },
    // ---- animal lover meets a small creature ----
    { id: 'birdFriend', zh: '小鳥朋友', trigger: 'tick', when: { phase: ['morning', 'noon'] }, prio: 2, cd: 1440, chance: 0.3, c: { trait: ['animallover', 'nature'] },
      steps: [['anim', 'a', 'surprised', 0.7], ['say', 'a', 'ev_bird'], ['anim', 'a', 'happy', 1.4], ['emote', 'a', '🐦']],
      fx: { emo: { a: ['happy', 0.55] }, need: { a: { interest: 12, mood: 5 } }, mem: { a: { type: 'discover', imp: 0.5, text: '在{place}和一隻小鳥待了一會兒' } } } },
    // ---- a three-part story: the secret base (flags carry it over days) ----
    { id: 'baseFind', zh: '秘密基地（一）發現', trigger: 'tick', when: { place: ['forest'] }, prio: 3, once: 'self', chance: 0.4, c: { trait: ['curious', 'brave', 'nature'], noflag: 'baseFound' }, important: true,
      steps: [['anim', 'a', 'surprised', 0.8], ['say', 'a', 'ev_base1'], ['anim', 'a', 'cheer', 1.2], ['emote', 'a', '✦']],
      fx: { flag: 'baseFound', emo: { a: ['excited', 0.6] }, mem: { a: { type: 'discover', imp: 0.8, text: '在苔光森林發現了一個可以當秘密基地的地方' } } } },
    { id: 'baseInvite', zh: '秘密基地（二）邀請', trigger: 'tick', prio: 3, once: 'self', chance: 0.4, b: true, c: { flag: 'baseFound', noflag: 'baseShared' }, bc: { aff: '>=25' }, important: true, watch: true, ask: '{name}好像有秘密要告訴{other}',
      steps: [['cam', 'a'], ['go', 'a', 'b'], ['face', 'a', 'b'], ['say', 'a', 'ev_base2'], ['anim', 'b', 'surprised', 0.8], ['say', 'b', 'ev_base2_r'], ['anim', 'a', 'happy', 1.2]],
      fx: { flag: 'baseShared', rel: { ab: { trust: 6, intim: 4 }, ba: { trust: 6, intim: 4 } }, emo: { a: ['happy', 0.6], b: ['excited', 0.6] }, mem: { both: { type: 'milestone', imp: 0.85, text: '和{other}約好了秘密基地的事' } } } },
    { id: 'baseBuild', zh: '秘密基地（三）完成', trigger: 'tick', when: { place: ['forest'] }, prio: 4, once: 'self', chance: 0.5, b: true, c: { flag: 'baseShared', noflag: 'baseDone' }, bc: { aff: '>=25' }, important: true, watch: true, ask: '{name}和{other}在森林裡做什麼呢',
      steps: [['cam', 'a'], ['go', 'b', 'a'], ['anim', 'a', 'tend', 1.6], ['anim', 'b', 'tend', 1.6], ['say', 'a', 'ev_base3'], ['say', 'b', 'ev_base3_r'], ['anim', 'a', 'cheer', 1.4], ['anim', 'b', 'cheer', 1.4], ['sound', 'fanfare']],
      fx: { flag: 'baseDone', rel: { ab: { aff: 6, intim: 5 }, ba: { aff: 6, intim: 5 } }, emo: { a: ['proud', 0.7], b: ['proud', 0.7] }, mem: { both: { type: 'milestone', imp: 1, text: '和{other}一起完成了森林裡的秘密基地' } } } },
  ];
  for (const e of EV) if (!D.EVENTS.some((x) => x.id === e.id)) D.EVENTS.push(e);

  const L = [
    ['ev_prank', '嘿——！', B], ['ev_prank', '（躡手躡腳）……哇！', P], ['ev_prank', '{other}，你後面有東西！……騙你的。', { trait: 'humorous' }, 2],
    ['ev_prank_r', '嚇死我了啦！', P], ['ev_prank_r', '哈哈哈，你很無聊耶！', B], ['ev_prank_r', '……幼稚。', K],
    ['ev_prank_bad', '……一點都不好笑。', P], ['ev_prank_bad', '我、我真的被嚇到了……', { trait: 'shy' }, 2],
    ['ev_sorry', '那個……之前對不起。', P], ['ev_sorry', '我想了很久，是我不對。', C], ['ev_sorry', '……抱歉啦。', K], ['ev_sorry', '對不起嘛！我請你吃點心好不好？', B],
    ['ev_sorry_r', '……嗯，我也不好。', P], ['ev_sorry_r', '好啦好啦，原諒你了！', B], ['ev_sorry_r', '我早就不生氣了。', C],
    ['ev_taste_fight', '布丁就是要配焦糖，這是常識！', P], ['ev_taste_fight', '吃鬆餅不淋蜂蜜？你認真的嗎？', B], ['ev_taste_fight', '……那種吃法我無法理解。', K],
    ['ev_taste_fight_r', '才不是，原味最好吃！', P], ['ev_taste_fight_r', '我就喜歡這樣，怎樣！', B], ['ev_taste_fight_r', '各人口味不同。', C],
    ['ev_share_snack', '你肚子在叫喔。這個分你一半。', P], ['ev_share_snack', '來，給你！我剛好吃不完。', B], ['ev_share_snack', '……拿去。', K],
    ['ev_share_snack_r', '謝謝……你人真好。', P], ['ev_share_snack_r', '哇！救星！', B], ['ev_share_snack_r', '……謝謝，我會記得的。', C],
    ['ev_trip', '哎唷！……沒事沒事。', P], ['ev_trip', '這裡怎麼會有石頭啦！', B], ['ev_trip', '……剛剛什麼都沒發生。', K],
    ['ev_help_up', '你沒事吧？來，拉著我。', P], ['ev_help_up', '小心一點啦！', B], ['ev_help_up', '……站得起來嗎？', K],
    ['ev_help_up_r', '謝、謝謝……好丟臉。', P], ['ev_help_up_r', '嘿嘿，又跌倒了。', B],
    ['ev_cloud', '你看，那朵雲像不像一隻在打哈欠的貓？', P], ['ev_cloud', '那朵好像一碗剛煮好的麵！', B], ['ev_cloud', '那一朵……像一艘要出海的船。', C],
    ['ev_cloud_r', '真的耶！還有尾巴。', P], ['ev_cloud_r', '我覺得比較像鬆餅。', { trait: 'foodie' }, 3], ['ev_cloud_r', '……嗯，我看得出來。', K],
    ['ev_midnight', '你也睡不著嗎？', P], ['ev_midnight', '晚上的風，好像比較願意聽人說話。', C], ['ev_midnight', '我跟你說一個秘密，你不能笑喔。', { trait: 'romantic' }, 2],
    ['ev_midnight_r', '嗯，我在聽。', P], ['ev_midnight_r', '我也有一個秘密……', C], ['ev_midnight_r', '……我不會笑的。', K],
    ['ev_joke', '你知道為什麼海很鹹嗎？因為魚一直在哭——太冷了。', P], ['ev_joke', '什麼動物最會寫字？……書蟲！', B], ['ev_joke', '我想到一個笑話，可是講到一半就忘了。', { trait: 'clumsy' }, 2],
    ['ev_joke_laugh', '耶！你笑了！', P], ['ev_joke_laugh', '我就知道我很有天分！', B],
    ['ev_joke_cold', '咦……有那麼冷嗎……', P], ['ev_joke_cold', '……下次我會準備好一點的。', C],
    ['ev_joke_more', '好！那這個呢——', B], ['ev_joke_more', '再一個喔，最後一個。', P],
    ['ev_tidy', '東西都歸位了，看起來舒服多了。', P], ['ev_tidy', '這個角度……不對，再轉一點。', { trait: 'perfectionist' }, 3],
    ['ev_bird', '噓……有小鳥停在旁邊。', P], ['ev_bird', '你好呀，小鳥！', B], ['ev_bird', '……別怕，我不會動。', C],
    ['ev_base1', '這裡……被樹根圍起來，好像一間小房子！', P], ['ev_base1', '發現了！這裡就是我的秘密基地！', B], ['ev_base1', '……沒有人會找到這裡。', C],
    ['ev_base2', '{other}，我跟你說，我在森林裡發現了一個地方。只告訴你喔。', P], ['ev_base2', '我有秘密基地了！要不要一起來？', B],
    ['ev_base2_r', '真的嗎？我要去！', P], ['ev_base2_r', '……我會保守秘密的。', K],
    ['ev_base3', '鋪上葉子、掛上小燈——完成了！', P], ['ev_base3', '這是我們兩個的基地喔！', B],
    ['ev_base3_r', '以後下雨也可以躲在這裡了。', P], ['ev_base3_r', '……好棒的地方。', C],
  ];
  const base = D.LINES.length;
  L.forEach((x, i) => D.LINES.push({ id: 'p9_' + (base + i), cat: x[0], text: x[1], c: x[2] || null, w: x[3] || 1 }));
})();
