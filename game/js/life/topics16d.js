/* OC Shimeji 16.6 — topics and conversation lines (data only).
 *   ABSTRACT  [id, 中文, emoji, depth ('light' | 'deep' | 'fun'), keywords for the player's typed answers]
 *   DICT      [[keywords…], topic key] — the offline dictionary for what the player types (checked before the catalogues)
 *   lines     [category, text, conditions] → LifeData.LINES (flag m: the grown-up tone). Conditions: tk = topic kind
 *             (act place food wx season person hobby mem dream x), ts = the speaker's stance (pos neu neg), voice, trait …
 *             {topic} is the topic in words; for gossip it is the person's name. Every category has lines without tk / ts,
 *             so a line is always found.
 */
(function () {
  'use strict';
  const D = OC.LifeData; if (!D || !D.LINES) return;
  const ABSTRACT = [
    ['stars', '星星', '⭐', 'deep', ['星', '星空', '流星']], ['sea', '海', '🌊', 'light', ['海邊', '海浪', '大海']], ['future', '以後的事', '🔭', 'deep', ['未來', '以後', '將來']],
    ['childhood', '小時候', '🧸', 'deep', ['以前', '小時候', '童年']], ['music', '音樂', '🎵', 'fun', ['歌', '音樂', '唱歌']], ['books', '書', '📚', 'deep', ['書', '小說', '閱讀']],
    ['sleep', '睡覺', '😴', 'light', ['睡', '失眠', '做夢']], ['cats', '貓', '🐈', 'fun', ['貓', '喵']], ['dogs', '狗', '🐕', 'fun', ['狗', '汪']],
    ['rainsound', '雨聲', '🌧', 'deep', ['雨聲']], ['cooking', '做菜', '🍳', 'light', ['做菜', '下廚', '料理']], ['sweets', '甜點', '🍰', 'fun', ['甜點', '蛋糕', '甜的']],
    ['coffee', '咖啡', '☕', 'light', ['咖啡', '拿鐵']], ['tea', '茶', '🍵', 'light', ['茶', '紅茶', '綠茶']], ['flowers', '花', '🌷', 'light', ['花', '花園']],
    ['travel', '旅行', '🧳', 'fun', ['旅行', '出遠門', '旅遊']], ['work', '工作', '💼', 'deep', ['工作', '上班', '打工']], ['school', '學校', '🏫', 'light', ['學校', '上課', '考試']],
    ['friends', '朋友', '🤝', 'deep', ['朋友', '友情']], ['family', '家人', '🏠', 'deep', ['家人', '家', '爸媽']], ['secrets', '秘密', '🤫', 'fun', ['秘密']],
    ['ghosts', '鬼故事', '👻', 'fun', ['鬼', '靈異', '恐怖']], ['wind', '風', '🍃', 'deep', ['風']], ['moon', '月亮', '🌙', 'deep', ['月亮', '月光']],
    ['clouds', '雲', '☁️', 'light', ['雲']], ['photos', '拍照', '📷', 'fun', ['照片', '拍照', '相機']], ['games', '遊戲', '🎮', 'fun', ['遊戲', '玩']],
    ['drawing', '畫畫', '🎨', 'light', ['畫', '畫畫', '塗鴉']], ['dance', '跳舞', '💃', 'fun', ['跳舞', '舞']], ['sports', '運動', '⚽', 'light', ['運動', '球', '跑步']],
    ['fashion', '穿搭', '👗', 'fun', ['衣服', '穿搭', '打扮']], ['hair', '髮型', '💇', 'fun', ['頭髮', '髮型']], ['mornings', '早起', '🌅', 'light', ['早起', '早上', '鬧鐘']],
    ['nights', '夜晚', '🌃', 'deep', ['晚上', '半夜', '熬夜']], ['luck', '運氣', '🍀', 'fun', ['運氣', '幸運', '倒楣']], ['habits', '小習慣', '🔁', 'light', ['習慣']],
    ['fears', '害怕的東西', '😨', 'deep', ['害怕', '怕']], ['wishes', '願望', '🌠', 'deep', ['願望', '希望', '想要']], ['memories', '回憶', '📔', 'deep', ['回憶', '記得']],
    ['silence', '安靜', '🤍', 'deep', ['安靜', '一個人']], ['crowds', '人多的地方', '👥', 'light', ['人很多', '熱鬧']], ['money', '錢', '🪙', 'light', ['錢', '存錢', '星幣', '買']],
    ['gifts', '禮物', '🎁', 'fun', ['禮物', '送']], ['birthdays', '生日', '🎂', 'fun', ['生日']], ['festivals', '節日', '🎏', 'fun', ['節日', '祭典', '過節']],
    ['letters', '寫信', '✉️', 'deep', ['信', '寫信']], ['bugs', '蟲', '🐞', 'fun', ['蟲', '蟑螂', '蚊子']], ['fishing', '釣魚', '🎣', 'light', ['釣魚', '魚竿']],
    ['gardening', '種東西', '🌱', 'light', ['種', '菜園', '植物']], ['rain', '下雨天', '☔', 'light', ['下雨', '雨天', '雨傘']], ['heat', '熱天', '🥵', 'light', ['好熱', '流汗']],
    ['cold', '冷天', '🥶', 'light', ['好冷', '冷']], ['snacks', '零食', '🍪', 'fun', ['零食', '餅乾', '點心']], ['hometown', '家鄉', '🏡', 'deep', ['家鄉', '老家']],
    ['names', '名字', '🔤', 'deep', ['名字']], ['change', '改變', '🦋', 'deep', ['改變', '變了']], ['patience', '耐心', '⏳', 'deep', ['耐心', '等']],
    ['laughing', '好笑的事', '😂', 'fun', ['好笑', '笑死', '搞笑']], ['mistakes', '出糗', '🙈', 'fun', ['出糗', '丟臉', '糗']], ['island', '這座島', '🏝', 'light', ['島', '小島']],
  ];
  const DICT = [
    [['開心', '高興', '很棒', '好消息'], 'x:laughing'], [['累', '好睏', '想睡'], 'x:sleep'], [['難過', '傷心', '不開心', '煩'], 'x:silence'],
    [['吃', '餓', '好吃', '飯'], 'x:cooking'], [['下雨', '雨'], 'wx'], [['天氣', '晴', '太陽', '陰天'], 'wx'], [['季節', '春', '夏', '秋', '冬'], 'season'],
  ];

  const P = { voice: 'plain' }, B = { voice: 'bright' }, C = { voice: 'calm' }, K = { voice: 'cool' };
  const w = (o, x) => Object.assign({}, o, x);
  const pos = { ts: 'pos' }, neg = { ts: 'neg' }, neu = { ts: 'neu' };
  const L = [
    // ------------------------------------------------------------ raise: bringing a topic up
    ['t16_raise', '你覺得{topic}怎麼樣？'], ['t16_raise', '突然想到{topic}。'], ['t16_raise', '說到{topic}，你有什麼想法？'], ['t16_raise', '欸，{topic}。', P],
    ['t16_raise', '我最近很喜歡{topic}。', pos], ['t16_raise', '{topic}真的不錯，我一直這麼覺得。', pos], ['t16_raise', '想跟你聊聊{topic}。我滿喜歡的。', w(C, pos)], ['t16_raise', '{topic}。這個話題我可以講很久。', w(B, pos)], ['t16_raise', '承認吧，{topic}很好。', w(K, pos)],
    ['t16_raise', '老實說，我不太喜歡{topic}。', neg], ['t16_raise', '{topic}……我一直沒辦法喜歡。', neg], ['t16_raise', '你會不會覺得{topic}有點麻煩？', w(P, neg)], ['t16_raise', '{topic}這件事，我有點意見。', w(K, neg)], ['t16_raise', '可能只有我這樣——{topic}讓我有點累。', w(C, neg)],
    ['t16_raise', '{topic}，好像沒什麼特別的想法。你呢？', neu], ['t16_raise', '我在想{topic}到底好不好。', neu], ['t16_raise', '你對{topic}熟嗎？我不太懂。', w(C, neu)],
    ['t16_raise', '剛剛在{topic}，感覺還不錯。', { tk: 'act', ts: 'pos' }], ['t16_raise', '剛{topic}完，有點累。', { tk: 'act', ts: 'neg' }], ['t16_raise', '你常{topic}嗎？', { tk: 'act' }], ['t16_raise', '我在想下次要不要再去{topic}。', { tk: 'act' }],
    ['t16_raise', '{topic}這裡，你常來嗎？', { tk: 'place' }], ['t16_raise', '我喜歡{topic}的感覺。', { tk: 'place', ts: 'pos' }], ['t16_raise', '{topic}今天人好像比較多。', { tk: 'place' }],
    ['t16_raise', '你吃過{topic}嗎？', { tk: 'food' }], ['t16_raise', '最近吃了{topic}，一直想著那個味道。', { tk: 'food', ts: 'pos' }], ['t16_raise', '{topic}……那個味道我真的不行。', { tk: 'food', ts: 'neg' }], ['t16_raise', '你喜歡{topic}嗎？我在想要不要再買。', { tk: 'food' }],
    ['t16_raise', '今天是{topic}的天氣。', { tk: 'wx' }], ['t16_raise', '{topic}的日子，我會想待在外面。', { tk: 'wx', ts: 'pos' }], ['t16_raise', '{topic}，衣服都不知道怎麼穿。', { tk: 'wx', ts: 'neg' }], ['t16_raise', '你喜歡這種{topic}的天氣嗎？', { tk: 'wx' }],
    ['t16_raise', '已經{topic}了呢。', { tk: 'season' }], ['t16_raise', '{topic}是我最喜歡的季節。', { tk: 'season', ts: 'pos' }], ['t16_raise', '{topic}總是過得很慢。', { tk: 'season', ts: 'neg' }],
    ['t16_raise', '你也喜歡{topic}嗎？', { tk: 'hobby' }], ['t16_raise', '最近又開始{topic}了。', { tk: 'hobby', ts: 'pos' }], ['t16_raise', '說到{topic}，我有件事想講。', { tk: 'hobby' }],
    ['t16_raise', '還記得{topic}嗎？', { tk: 'mem' }], ['t16_raise', '我常想起{topic}的那天。', { tk: 'mem' }], ['t16_raise', '{topic}，好像才是不久前的事。', w(C, { tk: 'mem' })],
    ['t16_raise', '我昨晚做了一個夢。', { tk: 'dream' }], ['t16_raise', '跟你說，我做了一個很奇怪的夢。', { tk: 'dream' }], ['t16_raise', '夢到一些事，醒來還在想。', w(C, { tk: 'dream' })],
    ['t16_raise', '你有沒有想過{topic}？', { tk: 'x' }], ['t16_raise', '突然很想聊{topic}。', { tk: 'x' }], ['t16_raise', '關於{topic}，你怎麼看？', w(K, { tk: 'x' })],
    // ------------------------------------------------------------ gossip and recall
    ['t16_gossip', '你最近有跟{topic}說話嗎？'], ['t16_gossip', '{topic}最近怎麼樣？'], ['t16_gossip', '我覺得{topic}人很好。', pos], ['t16_gossip', '{topic}很照顧人，你不覺得嗎？', pos], ['t16_gossip', '跟{topic}在一起很輕鬆。', w(C, pos)],
    ['t16_gossip', '{topic}有時候有點難相處。', neg], ['t16_gossip', '小聲說，{topic}昨天好像不太高興。', neg], ['t16_gossip', '我跟{topic}不太合。你別說出去。', w(K, neg)], ['t16_gossip', '{topic}那個人，我還在觀察。', neu],
    ['t16_recall', '你上次說你喜歡{topic}，對吧？'], ['t16_recall', '我記得你喜歡{topic}。'], ['t16_recall', '想到你說過{topic}的事。', C], ['t16_recall', '{topic}——你的最愛，沒記錯吧？', B],
    // ------------------------------------------------------------ agree / build
    ['t16_agree', '對，我也這麼想。'], ['t16_agree', '同意。'], ['t16_agree', '嗯，說得對。', C], ['t16_agree', '真的！我也是。', B], ['t16_agree', '這點我沒意見。', K], ['t16_agree', '就是這樣。'],
    ['t16_agree', '{topic}真的很好，對吧。', pos], ['t16_agree', '我懂，{topic}讓人心情變好。', pos], ['t16_agree', '一樣。{topic}是少數讓我放鬆的事。', w(C, pos)], ['t16_agree', '對對對，{topic}最棒了。', w(B, pos)],
    ['t16_agree', '我也受不了{topic}。', neg], ['t16_agree', '原來不只我這樣想。', neg], ['t16_agree', '嗯，{topic}確實有點……', w(C, neg)],
    ['t16_agree', '好像是這樣沒錯。', neu], ['t16_agree', '你這樣說也對。', neu],
    ['t16_build', '而且啊，{topic}還有一個好處。'], ['t16_build', '我還想到一件事。'], ['t16_build', '下次可以一起試試。', { tk: ['act', 'food', 'hobby', 'x', 'place'] }], ['t16_build', '這樣說起來，好像更有意思了。'], ['t16_build', '我們想法還滿像的。'],
    ['t16_build', '要不要哪天一起{topic}？', { tk: 'act' }], ['t16_build', '下次一起去{topic}吧。', { tk: 'place' }], ['t16_build', '下次分你一點{topic}。', { tk: 'food' }], ['t16_build', '那我們找一天專門聊{topic}。', { tk: 'hobby' }],
    ['t16_build', '我喜歡跟你聊這個。', C], ['t16_build', '好，記下來了。', K], ['t16_build', '越講越想做了。', w(B, { tk: ['act', 'food', 'hobby', 'x', 'place'] })],
    // ------------------------------------------------------------ disagree / defend / concede
    ['t16_disagree', '嗯……我不太這麼覺得。'], ['t16_disagree', '我的想法有點不一樣。'], ['t16_disagree', '這個我不同意。', K], ['t16_disagree', '欸，真的嗎？我覺得還好耶。', B], ['t16_disagree', '我可能看法不太一樣。', C],
    ['t16_disagree', '我其實很喜歡{topic}。', pos], ['t16_disagree', '{topic}沒那麼糟吧？', pos], ['t16_disagree', '我倒是滿喜歡{topic}的。', w(C, pos)],
    ['t16_disagree', '{topic}我真的不行。', neg], ['t16_disagree', '我沒辦法像你那樣喜歡{topic}。', neg], ['t16_disagree', '{topic}？還是算了吧。', w(K, neg)],
    ['t16_disagree', '我比較溫和一點的說法是——不太適合我。', { trait: 'gentle' }], ['t16_disagree', '……我不想說謊，我不喜歡。', { trait: 'honest' }],
    ['t16_defend', '我還是覺得我是對的。'], ['t16_defend', '你聽我說完嘛。'], ['t16_defend', '我有我的理由。', K], ['t16_defend', '好啦，可是我真的這麼覺得。', B], ['t16_defend', '每個人看法不同。我是這樣想的。', C],
    ['t16_defend', '我不會改變想法的。', { trait: 'stubborn' }], ['t16_defend', '這點我很確定。', { trait: 'proud' }],
    ['t16_concede', '好吧，你說的也有道理。'], ['t16_concede', '嗯，我懂你的意思了。'], ['t16_concede', '也許是我想太多了。', C], ['t16_concede', '好啦好啦，你贏了。', B], ['t16_concede', '……行，算你有理。', K], ['t16_concede', '我們就各自喜歡各自的吧。'],
    // ------------------------------------------------------------ ask / explain
    ['t16_ask', '為什麼這麼說？'], ['t16_ask', '怎麼說？'], ['t16_ask', '你可以多說一點嗎？', C], ['t16_ask', '咦，真的嗎？哪裡好？', B], ['t16_ask', '理由？', K], ['t16_ask', '我不太懂，再說一次？'],
    ['t16_ask', '{topic}是什麼感覺？', { tk: 'act' }], ['t16_ask', '{topic}在哪裡？', { tk: 'place' }], ['t16_ask', '{topic}是什麼味道？', { tk: 'food' }], ['t16_ask', '你夢到什麼？', { tk: 'dream' }], ['t16_ask', '你跟{topic}很熟嗎？', { tk: 'person' }],
    ['t16_explain', '就是……說不太上來，但很舒服。', pos], ['t16_explain', '做的時候會忘記時間。', pos], ['t16_explain', '因為每次都有一點不一樣。', pos], ['t16_explain', '它讓我覺得今天沒有白過。', w(C, pos)], ['t16_explain', '就是很好，沒有為什麼。', w(B, pos)],
    ['t16_explain', '就是一直不太習慣。', neg], ['t16_explain', '試過幾次，每次都不太順。', neg], ['t16_explain', '我也說不清楚，就是不喜歡。', w(K, neg)],
    ['t16_explain', '我也還在想。', neu], ['t16_explain', '說不定我只是還不夠了解。', neu],
    ['t16_explain', '味道很溫和，吃完會想再吃一口。', { tk: 'food', ts: 'pos' }], ['t16_explain', '口感有點怪，我吞不太下去。', { tk: 'food', ts: 'neg' }],
    ['t16_explain', '夢到大家一起在一個沒見過的地方。', { tk: 'dream' }], ['t16_explain', '夢到我一直在找東西，最後也沒找到。', { tk: 'dream' }],
    ['t16_explain', '那裡很安靜，待著就很放鬆。', { tk: 'place', ts: 'pos' }], ['t16_explain', '那裡有時候太吵了。', { tk: 'place', ts: 'neg' }],
    ['t16_explain', '那天的天氣也剛剛好。', { tk: 'mem' }], ['t16_explain', '很普通的一天，可是我一直記得。', { tk: 'mem' }],
    // ------------------------------------------------------------ share / react
    ['t16_share', '我上次也有類似的經驗。'], ['t16_share', '跟你說，我之前也是。'], ['t16_share', '我有一個關於{topic}的小故事。'], ['t16_share', '我以前也有一陣子很迷{topic}。', pos], ['t16_share', '我之前因為{topic}出過糗。', neg],
    ['t16_share', '我上次{topic}的時候，差點迷路。', { tk: 'act' }], ['t16_share', '我第一次去{topic}的時候很緊張。', { tk: 'place' }], ['t16_share', '我會在{topic}上面加一點蜂蜜。', { tk: 'food', ts: 'pos' }], ['t16_share', '我記得那天你笑得很開心。', { tk: 'mem' }],
    ['t16_share', '說起來，我小時候也這樣。', C], ['t16_share', '我也是！而且還——算了，下次再說。', B], ['t16_share', '我只跟你說：我其實很在意這件事。', K],
    ['t16_react', '是喔？'], ['t16_react', '原來如此。'], ['t16_react', '我沒想過。', C], ['t16_react', '哇，真的假的。', B], ['t16_react', '有意思。', K], ['t16_react', '這樣啊。'], ['t16_react', '聽起來不錯。', pos], ['t16_react', '好像有點辛苦。', neg],
    // ------------------------------------------------------------ jokes
    ['t16_joke', '說不定{topic}其實在偷偷觀察我們。'], ['t16_joke', '{topic}要是會說話，應該很囉嗦吧。'], ['t16_joke', '我決定以後叫你「{topic}專家」。'], ['t16_joke', '這種話題，我們好像老人在聊天。'], ['t16_joke', '你再說下去，我就要變成{topic}了。', B],
    ['t16_joke', '我只會講冷笑話，你別期待。', K], ['t16_joke', '我覺得{topic}跟我很像——都有點難懂。', C],
    ['t16_laugh', '哈哈，你很奇怪耶。'], ['t16_laugh', '噗，這個好笑。'], ['t16_laugh', '……好，我笑了。', K], ['t16_laugh', '你真的很會講。', C], ['t16_laugh', '哈哈哈，不要啦。', B],
    ['t16_flat', '……'], ['t16_flat', '嗯，好喔。'], ['t16_flat', '這個不好笑。', K], ['t16_flat', '我不太懂笑點在哪。', C], ['t16_flat', '你還是正經一點好了。'],
    // ------------------------------------------------------------ meh / switch
    ['t16_meh', '嗯……還好吧。'], ['t16_meh', '我沒什麼特別的想法。'], ['t16_meh', '這個話題我不太會接。', C], ['t16_meh', '喔。', K], ['t16_meh', '欸，換個話題好不好？', B],
    ['t16_switch', '對了，說到{topic}——'], ['t16_switch', '換個話題，{topic}你覺得呢？'], ['t16_switch', '我想到{topic}了。'], ['t16_switch', '不說這個了，{topic}呢？', B], ['t16_switch', '話說，{topic}。', K], ['t16_switch', '其實我比較想聊{topic}。', C],
    ['t16_switch', '對了，你還記得{topic}嗎？', { tk: 'mem' }], ['t16_switch', '說到這個，我想起{topic}。', { tk: 'mem' }], ['t16_switch', '對了，我昨晚做了個夢。', { tk: 'dream' }], ['t16_switch', '換個話題——{topic}最近好嗎？', { tk: 'person' }], ['t16_switch', '對了，你最近有見到{topic}嗎？', { tk: 'person' }],
    ['t16_agree', '嗯，那天很好。', { tk: 'mem' }], ['t16_agree', '記得。我也常想起來。', { tk: 'mem' }], ['t16_build', '下次再一起吧。', { tk: 'mem' }], ['t16_share', '那天回家以後，我還一直在笑。', { tk: 'mem' }], ['t16_disagree', '……那天其實我有點累。', { tk: 'mem' }],
    ['t16_react', '好奇怪的夢。', { tk: 'dream' }], ['t16_react', '說不定有什麼意思。', w(C, { tk: 'dream' })], ['t16_agree', '有些夢醒來還會記得很久。', { tk: 'dream' }], ['t16_share', '我也常做奇怪的夢。', { tk: 'dream' }],
    ['t16_agree', '{topic}確實是這樣。', { tk: 'person' }], ['t16_disagree', '我覺得{topic}沒有那樣。', { tk: 'person' }], ['t16_share', '我上次也跟{topic}聊過。', { tk: 'person' }], ['t16_build', '下次也找{topic}一起吧。', { tk: 'person', ts: 'pos' }], ['t16_react', '原來{topic}是那樣的人。', { tk: 'person' }],
    // ------------------------------------------------------------ wrap
    ['t16_wrap', '跟你聊天很開心。'], ['t16_wrap', '好，下次再聊。'], ['t16_wrap', '聊得差不多了。'], ['t16_wrap', '先這樣吧。', K], ['t16_wrap', '謝謝你聽我說。', C], ['t16_wrap', '下次再跟你說後續！', B],
    ['t16_wrap', '又多知道你一點了。'], ['t16_wrap', '我會記得的。', C], ['t16_wrap', '嗯，就這樣。'],
    // ------------------------------------------------------------ asking the player, and replies
    ['t16_askplayer', '有空嗎？想聽你說點什麼。'], ['t16_askplayer', '我想不到要做什麼。陪我聊聊？'], ['t16_askplayer', '你今天過得怎麼樣？', C], ['t16_askplayer', '嘿，跟我說說最近的事！', B], ['t16_askplayer', '……想聊天。隨便什麼都好。', K],
    ['t16_askplayer', '在想你會喜歡聊什麼。'], ['t16_askplayer', '一個人有點無聊。你在嗎？'],
    ['t16_pl_like', '{topic}！我也喜歡。'], ['t16_pl_like', '真巧，我最近也在想{topic}。'], ['t16_pl_like', '好啊，{topic}可以聊很久。', C], ['t16_pl_like', '你也懂{topic}？太好了。', B], ['t16_pl_like', '……{topic}，品味不錯。', K],
    ['t16_pl_dislike', '{topic}啊……我不太喜歡，不過你說說看。'], ['t16_pl_dislike', '嗯，{topic}不是我擅長的。'], ['t16_pl_dislike', '我不太懂{topic}的好，你教我？', C], ['t16_pl_dislike', '{topic}？你認真的？', K],
    ['t16_pl_new', '{topic}？我沒想過，好像挺有意思的。'], ['t16_pl_new', '原來你在想{topic}。'], ['t16_pl_new', '{topic}啊，我會記住的。', C], ['t16_pl_new', '喔——{topic}！再多說一點。', B],
    ['t16_pl_none', '嗯，我聽著。'], ['t16_pl_none', '是喔，原來是這樣。'], ['t16_pl_none', '謝謝你跟我說。', C], ['t16_pl_none', '我不太懂，不過聽你說話挺好的。'], ['t16_pl_none', '……嗯。我記下了。', K],
  ];
  /* a line that says {topic} but names no topic kind only fits things (an activity, a food, a place, an interest, an everyday
   * subject, the weather, the season); memories, dreams and people use their own lines or lines without the word. The player's
   * replies (t16_pl_*) can be about a person too. */
  const THINGS = ['act', 'place', 'food', 'wx', 'season', 'hobby', 'x'];
  L.forEach((x, i) => { let c = x[2] || null; if (x[1].includes('{topic}') && !(c && c.tk) && x[0] !== 't16_gossip') c = Object.assign({}, c, { tk: x[0].startsWith('t16_pl_') ? THINGS.concat('person') : THINGS }); D.LINES.push({ id: 't16_' + i, cat: x[0], text: x[1], c, w: 1, m: true, cd: 30 }); });
  OC.Topic16Data = { ABSTRACT, DICT, count: L.length };
})();
