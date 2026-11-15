/* OC Shimeji 16.11 — lines for illness, farewells, making up and the big moments (data). [category, text, conditions] → LifeData.LINES
 *   h16_sick_<cond>  falling ill (cold · fever · tummy · bruise · tired · joints · cough)      h16_well  getting better
 *   fw16_first / fw16_bye / fw16_last   the farewell: the one leaving, each friend ({other} = the one leaving), the last words
 *   fd16_sorry / fd16_ok / fd16_after   making up after a quarrel ({other} = the other one)
 *   th16_birth / th16_grad / th16_date  small scenes for OC.Theatre ({other} = the other one)
 */
(function () {
  'use strict';
  const D = OC.LifeData; if (!D || !D.LINES) return;
  const T = (...t) => ({ trait: t });
  const L = [
    ['h16_sick_cold', '哈啾。……好像感冒了。'], ['h16_sick_cold', '喉嚨有點癢。'], ['h16_sick_cold', '頭重重的。'], ['h16_sick_cold', '今天想早點睡。'],
    ['h16_sick_cold', '沒事，只是小感冒。', T('stubborn', 'tough', 'proud')], ['h16_sick_cold', '……鼻子不通。', T('quiet', 'shy')], ['h16_sick_cold', '別靠太近，會傳染。', T('caring', 'polite')],
    ['h16_sick_fever', '好熱……又好冷。'], ['h16_sick_fever', '我躺一下就好。'], ['h16_sick_fever', '頭好暈。'], ['h16_sick_fever', '……想喝水。'],
    ['h16_sick_tummy', '肚子……不太對勁。'], ['h16_sick_tummy', '剛才那個好像壞掉了。'], ['h16_sick_tummy', '吃太多了，我的錯。'], ['h16_sick_tummy', '暫時什麼都不想吃。'],
    ['h16_sick_bruise', '痛……擦破皮了。'], ['h16_sick_bruise', '沒事，只是擦傷。'], ['h16_sick_bruise', '下次輕一點啦。'], ['h16_sick_bruise', '……我會記住的。', T('stubborn', 'proud')],
    ['h16_sick_tired', '撐不住了，要休息一下。'], ['h16_sick_tired', '最近太拚了。'], ['h16_sick_tired', '眼睛都睜不開了。'], ['h16_sick_tired', '……今天什麼都不想做。'],
    ['h16_sick_joints', '膝蓋又在痛了。'], ['h16_sick_joints', '要變天了，骨頭知道。'], ['h16_sick_joints', '老毛病了，不要緊。'],
    ['h16_sick_cough', '咳、咳……沒事。'], ['h16_sick_cough', '晚上又咳醒了。'], ['h16_sick_cough', '老毛病，習慣了。'],
    ['h16_well', '好多了。'], ['h16_well', '終於舒服了。'], ['h16_well', '身體輕多了。'], ['h16_well', '可以出去走走了。'], ['h16_well', '謝謝照顧。'],
    ['h16_well', '完全復活。', T('cheerful', 'energetic')], ['h16_well', '……好了，別擔心。', T('cool', 'quiet')],

    ['fw16_first', '這些日子，謝謝大家。'], ['fw16_first', '我過得很開心。'], ['fw16_first', '能住在這座島上，真好。'], ['fw16_first', '別難過，好嗎。'],
    ['fw16_first', '……我好像該走了。'], ['fw16_first', '謝謝你一直看著我們。'],
    ['fw16_bye', '{other}，謝謝你。'], ['fw16_bye', '我不會忘記的。'], ['fw16_bye', '一路順風，{other}。'], ['fw16_bye', '……再見。'],
    ['fw16_bye', '你教我的事，我會一直記得。'], ['fw16_bye', '島上的花我會幫你照顧。'], ['fw16_bye', '我會常常想起你。'], ['fw16_bye', '能認識你真好。'],
    ['fw16_bye', '……不想說再見。', T('sensitive', 'clingy')], ['fw16_bye', '笨蛋，誰准你先走的。', T('tsundere', 'hotheaded')], ['fw16_bye', '我會好好過下去的。', T('calm', 'mature')],
    ['fw16_last', '要好好吃飯喔。'], ['fw16_last', '我先走一步了。'], ['fw16_last', '下次見。'], ['fw16_last', '……謝謝。'], ['fw16_last', '天氣真好。'],

    ['fd16_sorry', '{other}，之前是我不對。'], ['fd16_sorry', '……對不起。'], ['fd16_sorry', '我想了很久，是我說得太過分了。'], ['fd16_sorry', '可以重新來過嗎？'],
    ['fd16_sorry', '……我不擅長說這種話，但是對不起。', T('proud', 'stubborn', 'cool')], ['fd16_sorry', '我一直很想跟你說話。', T('sensitive', 'clingy')],
    ['fd16_ok', '我也有不對的地方。'], ['fd16_ok', '嗯，算了。'], ['fd16_ok', '……其實我早就不氣了。'], ['fd16_ok', '那就這樣吧，和好。'],
    ['fd16_ok', '下次不准再這樣。', T('stubborn', 'hotheaded')], ['fd16_ok', '我也一直在等你開口。', T('shy', 'quiet')],
    ['fd16_after', '那，一起去吃點東西？'], ['fd16_after', '感覺輕鬆多了。'], ['fd16_after', '好久沒這樣說話了。'], ['fd16_after', '以後有事直接說吧。'],

    ['th16_birth', '歡迎你來到這裡。'], ['th16_birth', '好小……好可愛。'], ['th16_birth', '從今天起，我們是一家人了。'], ['th16_birth', '要健健康康長大喔。'],
    ['th16_grad', '畢業了。'], ['th16_grad', '這幾年過得好快。'], ['th16_grad', '終於到這一天了。'], ['th16_grad', '恭喜你，{other}。'],
    ['th16_date', '今天很開心。'], ['th16_date', '下次還想再一起來。'], ['th16_date', '……謝謝你約我。'], ['th16_date', '時間過得好快。'],
  ];
  L.forEach((x, i) => D.LINES.push({ id: 'h16_' + i, cat: x[0], text: x[1], c: x[2] || null, w: 1, m: true, cd: 10 }));
  OC.Health16Data = { count: L.length };
})();
