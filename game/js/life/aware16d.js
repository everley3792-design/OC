/* OC Shimeji 16.7 — lines for OC.Aware (data). [category, text, conditions] → LifeData.LINES (m: the grown-up tone).
 *   aw16_see_<kind>  noticing something (a thought): sad · thrown · petted · sleep · eat · item · rain
 *   aw16_ate / played / tidied / look / litter / gone   what happened with a thing on the ground ({thing})
 *   aw16_replan      changing plans ({thing} = what it wanted to do)
 */
(function () {
  'use strict';
  const D = OC.LifeData; if (!D || !D.LINES) return;
  const T = (...t) => ({ trait: t });
  const L = [
    ['aw16_see_sad', '{other}看起來不太好。'], ['aw16_see_sad', '……{other}怎麼了？'], ['aw16_see_sad', '要不要過去問問{other}。'],
    ['aw16_see_sad', '{other}一個人坐在那裡，有點擔心。', T('caring', 'caretaker', 'gentle')], ['aw16_see_sad', '{other}的臉色不對。我去看看。', T('caring', 'caretaker')],
    ['aw16_see_sad', '有人心情不好。不過那不關我的事吧。', T('aloof', 'independent')], ['aw16_see_sad', '……{other}在嘆氣。', T('quiet', 'shy')],
    ['aw16_see_thrown', '哇，{other}飛出去了。'], ['aw16_see_thrown', '{other}沒事吧？'], ['aw16_see_thrown', '剛才那一下，看了都覺得痛。', T('timid', 'caring')],
    ['aw16_see_thrown', '哈哈，再一次。', T('mischievous', 'playful')], ['aw16_see_thrown', '……那樣丟真的好嗎。', T('serious', 'polite')],
    ['aw16_see_petted', '……{other}被摸摸了。'], ['aw16_see_petted', '好好喔。', T('jealousy', 'clingy')], ['aw16_see_petted', '我也想要。', T('clingy', 'touchy')],
    ['aw16_see_petted', '{other}看起來很舒服。'], ['aw16_see_petted', '哼，我又沒有很想要。', T('proudish', 'jealousy')],
    ['aw16_see_sleep', '{other}睡著了。小聲一點。'], ['aw16_see_sleep', '噓——{other}在睡覺。'], ['aw16_see_sleep', '看{other}睡，我也有點睏。', { need: { energy: '<55' } }],
    ['aw16_see_sleep', '睡得真熟。', T('calm', 'steady')], ['aw16_see_sleep', '要不要在旁邊放點聲音……算了。', T('mischievous')],
    ['aw16_see_eat', '{other}在吃什麼？聞起來很香。'], ['aw16_see_eat', '……肚子叫了。', { need: { food: '<55' } }], ['aw16_see_eat', '那個看起來好吃。', T('gourmet', 'chef')],
    ['aw16_see_eat', '看別人吃東西，自己也餓了。'],
    ['aw16_see_item', '地上那是{thing}？'], ['aw16_see_item', '誰把{thing}放在那裡？'], ['aw16_see_item', '咦，有{thing}。'], ['aw16_see_item', '那個{thing}……我去看看。', T('curious', 'adventurous')],
    ['aw16_see_item', '{thing}放在地上，等一下會有人踩到。', T('organized', 'neatfreak', 'tidy')], ['aw16_see_item', '{thing}！我還沒有這個。', T('collector')], ['aw16_see_item', '嗯？{thing}。', T('quiet', 'aloof')],
    ['aw16_see_rain', '下雨了。'], ['aw16_see_rain', '雨變大了，找個地方躲一下。'], ['aw16_see_rain', '雨聲其實滿好聽的。', T('calm', 'daydreamer', 'sentimental')],
    ['aw16_see_rain', '淋雨也沒關係啦。', T('adventurous', 'playful')], ['aw16_see_rain', '啊，衣服要濕了。'],
    ['aw16_ate', '吃掉了。謝謝你的{thing}。'], ['aw16_ate', '{thing}，剛好肚子餓。'], ['aw16_ate', '地上的{thing}……還好，沒有很髒。'], ['aw16_ate', '好吃。下次直接給我也可以。', T('blunt', 'sharptongue')],
    ['aw16_ate', '這個{thing}不錯。', T('gourmet', 'chef')], ['aw16_ate', '吃飽了。'],
    ['aw16_played', '{thing}好好玩。'], ['aw16_played', '再玩一下就好。'], ['aw16_played', '原來{thing}是這樣玩的。', T('curious', 'scholar')], ['aw16_played', '我玩得比較好吧？', T('competitive', 'proudish')],
    ['aw16_played', '玩完了，放回原位。', T('organized', 'tidy')], ['aw16_played', '（玩得很開心）'], ['aw16_played', '還想再玩。', T('playful', 'restless')],
    ['aw16_tidied', '{thing}我幫你收好了。'], ['aw16_tidied', '東西不要亂丟喔。', T('organized', 'neatfreak')], ['aw16_tidied', '收好了。放回你的背包。'], ['aw16_tidied', '順手而已。', T('humble', 'easygoing')],
    ['aw16_tidied', '地上乾淨多了。'],
    ['aw16_look', '原來是{thing}。'], ['aw16_look', '{thing}啊。'], ['aw16_look', '嗯，{thing}。誰的呢？'], ['aw16_look', '{thing}……看起來還能用。', T('frugal', 'collector')], ['aw16_look', '原來是這個。', T('quiet', 'aloof')],
    ['aw16_litter', '誰把{thing}丟在這裡。'], ['aw16_litter', '亂丟東西不好。'], ['aw16_litter', '……我受不了。', T('neatfreak')],
    ['aw16_gone', '咦，剛才明明在這裡。'], ['aw16_gone', '被拿走了啊。'], ['aw16_gone', '晚了一步。'],
    ['aw16_replan', '本來想{thing}的，算了，做別的。'], ['aw16_replan', '那就換個計畫。'], ['aw16_replan', '……好吧，晚點再{thing}。'], ['aw16_replan', '不行的話就不勉強。', T('easygoing', 'calm')],
    ['aw16_replan', '可惡，再找別的。', T('hotheaded', 'competitive')], ['aw16_replan', '換一個也好。'],
  ];
  L.forEach((x, i) => D.LINES.push({ id: 'aw16_' + i, cat: x[0], text: x[1], c: x[2] || null, w: 1, m: true, cd: 20 }));
  OC.Aware16Data = { count: L.length };
})();
