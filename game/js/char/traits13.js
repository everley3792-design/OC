/* OC Shimeji 13.0 — many more traits, all data-driven (OC.Traits13).
 * Every trait here changes something you can observe: how fast a need drops, which activities and social moves the character prefers,
 * how strongly it feels an emotion, how fast it walks, how readily it says yes — and it has lines of its own. The engine reads the table
 * through five small hooks (mind.decayMult / mind.sens / brain.actScore / brain.Social.respond / chars.behavior); nothing is hard-coded per trait.
 *   need   { needId: multiplier of the decay }          act  { activityId: score bonus }      soc { socialId: score bonus }
 *   emo    { emotionId: multiplier of the sensitivity }  speed multiplier of the walking speed  accept: bonus to saying yes to invitations
 *   x      traits that contradict this one (made symmetric below); the editor refuses the pair and shows which ones clash
 * Also: random picks (traits / liked things / tastes) that never contain a contradiction and never overwrite what the player locked.
 */
(function () {
  'use strict';
  const Ch = OC.Chars; if (!Ch || !Ch.TRAITS) return;
  const T = (id, zh, g, d, fx, x) => ({ id, zh, g, d, fx: fx || {}, x: x || [] });
  const NEW = [
    // ---- 社交
    T('talkative', '健談', '社交', '常常主動聊天，聊越久越開心', { soc: { chat: 0.3, share: 0.2 }, need: { social: 1.15 } }, ['quiet']),
    T('quiet', '寡言', '社交', '話少，但聽得很仔細；喜歡安靜的活動', { soc: { chat: -0.2 }, act: { read: 0.15, observe: 0.2, daydream: 0.1 }, need: { social: 0.8 } }, ['talkative']),
    T('caring', '愛照顧人', '社交', '看到誰心情不好就會過去安慰、分享食物', { soc: { comfort: 0.45, food: 0.3, gift: 0.15 } }, ['aloof']),
    T('aloof', '我行我素', '社交', '不太在意別人，很少主動找人；被邀請也常婉拒', { soc: { chat: -0.25, greet: -0.2 }, accept: -0.2, need: { social: 0.6 } }, ['caring', 'clingy', 'extrovert']),
    T('clingy', '黏人', '社交', '喜歡跟著親近的人，一個人待太久會寂寞', { soc: { restTogether: 0.3, playTogether: 0.3 }, need: { social: 1.35 }, emo: { lonely: 1.4 }, accept: 0.2 }, ['aloof', 'independent']),
    T('independent', '獨立', '社交', '自己安排自己的事，不太需要陪伴', { need: { social: 0.7 }, emo: { lonely: 0.6 }, act: { explore: 0.15, study: 0.1 } }, ['clingy']),
    T('polite', '有禮貌', '社交', '見面一定打招呼；很少跟人起爭執', { soc: { greet: 0.4, compliment: 0.2, argue: -0.5, prank: -0.4 } }, ['mischievous', 'blunt']),
    T('mischievous', '愛惡作劇', '社交', '喜歡開玩笑和小惡作劇，被抓到會笑', { soc: { prank: 0.55, joke: 0.3 }, emo: { bored: 1.3 } }, ['polite', 'serious']),
    T('blunt', '心直口快', '社交', '有話直說；偶爾惹人不高興，但很快就沒事', { soc: { argue: 0.2, compliment: -0.1 }, emo: { annoyed: 0.8 } }, ['polite', 'tactful']),
    T('tactful', '體貼', '社交', '說話顧慮對方感受；道歉與稱讚都比較有效', { soc: { compliment: 0.35, apologize: 0.3, comfort: 0.2 } }, ['blunt']),
    T('generous', '大方', '社交', '常常送小禮物、分享食物', { soc: { gift: 0.5, food: 0.35 } }, ['stingy']),
    T('stingy', '小氣', '社交', '東西捨不得分人，但收到禮物特別珍惜', { soc: { gift: -0.5, food: -0.4 }, emo: { content: 1.2 } }, ['generous']),
    T('competitive', '好勝', '社交', '喜歡比賽與一起玩；輸了會不服氣', { soc: { playTogether: 0.4 }, act: { play: 0.2 }, emo: { annoyed: 1.2, proud: 1.3 } }, ['easygoing']),
    T('easygoing', '隨和', '社交', '怎樣都好；幾乎不拒絕邀請，也不容易生氣', { accept: 0.25, emo: { annoyed: 0.5 }, soc: { argue: -0.4 } }, ['competitive', 'stubborn', 'perfectionist']),
    // ---- 情緒
    T('calm', '沉穩', '情緒', '情緒起伏小，不容易慌張', { emo: { nervous: 0.5, surprised: 0.6, excited: 0.75, annoyed: 0.7 } }, ['hotheaded', 'timid']),
    T('hotheaded', '急性子', '情緒', '容易煩躁，走路也比較快；氣來得快去得也快', { emo: { annoyed: 1.5 }, speed: 1.12, act: { daydream: -0.2, rest: -0.1 } }, ['calm', 'patient']),
    T('patient', '有耐心', '情緒', '願意慢慢等；釣魚、照顧植物、讀書都更投入', { act: { fish: 0.35, tend: 0.25, study: 0.2 }, emo: { bored: 0.6 } }, ['hotheaded', 'restless']),
    T('timid', '膽小', '情緒', '容易緊張、被嚇到；不太敢去沒去過的地方', { emo: { nervous: 1.5, surprised: 1.4 }, act: { explore: -0.3 } }, ['brave', 'calm', 'adventurous']),
    T('sentimental', '念舊', '情緒', '常常想起以前的事；對回憶特別有感觸', { act: { daydream: 0.2, observe: 0.15 }, emo: { content: 1.2, lonely: 1.15 } }),
    T('moody', '情緒化', '情緒', '心情變化大，開心和低落都很明顯', { emo: { happy: 1.3, down: 1.3, annoyed: 1.2, excited: 1.2 } }, ['calm', 'steady']),
    T('steady', '穩定', '情緒', '心情不太受小事影響', { emo: { down: 0.7, annoyed: 0.75, jealous: 0.6 } }, ['moody']),
    T('proudish', '自尊心強', '情緒', '被稱讚特別開心；不太願意先道歉', { emo: { proud: 1.5 }, soc: { apologize: -0.35 } }, ['humble']),
    T('humble', '謙虛', '情緒', '被稱讚會不好意思；願意先道歉', { emo: { shy: 1.2, proud: 0.7 }, soc: { apologize: 0.35 } }, ['proudish']),
    T('jealousy', '愛吃醋', '情緒', '看到親近的人跟別人要好會在意', { emo: { jealous: 1.8 } }, ['openhearted']),
    T('openhearted', '心胸寬大', '情緒', '不記仇，很少吃醋', { emo: { jealous: 0.4, annoyed: 0.8 }, soc: { apologize: 0.2 } }, ['jealousy']),
    // ---- 生活
    T('restless', '坐不住', '生活', '沒辦法待著不動，常常散步、探索、玩耍', { act: { walk: 0.3, explore: 0.3, play: 0.2, daydream: -0.3, rest: -0.2 }, need: { active: 1.3, fun: 1.15 } }, ['patient', 'lazy', 'homebody']),
    T('homebody', '宅', '生活', '最喜歡待在家；不太主動出門', { act: { rest: 0.2, read: 0.2, tidy: 0.15, explore: -0.3, walk: -0.15 }, need: { comfort: 1.2 } }, ['restless', 'adventurous']),
    T('adventurous', '愛冒險', '生活', '喜歡去新地方、嘗試沒做過的事', { act: { explore: 0.45, forage: 0.2, fish: 0.1 }, emo: { curious: 1.3 } }, ['homebody', 'timid']),
    T('frugal', '節儉', '生活', '不愛逛街，自己動手做（採集、種田、料理）', { act: { browse: -0.3, forage: 0.25, tend: 0.2, cook: 0.2 } }, ['shopaholic']),
    T('shopaholic', '愛逛街', '生活', '有空就想去商店街看看', { act: { browse: 0.5 } }, ['frugal']),
    T('sporty', '愛運動', '生活', '常常伸展、散步、跑來跑去；精力恢復快', { act: { stretch: 0.35, walk: 0.3, play: 0.2 }, need: { energy: 0.85, active: 1.2 }, speed: 1.08 }, ['lazy']),
    T('gourmet', '美食家', '生活', '對食物很講究；喜歡料理，也更容易餓', { act: { cook: 0.45, eat: 0.15 }, need: { food: 1.15 } }),
    T('lightsleeper', '淺眠', '生活', '睡得不沉，睡眠需求掉得快一點', { need: { sleep: 1.2 }, emo: { tired: 1.2 } }, ['sleepy']),
    T('organized', '井井有條', '生活', '喜歡整理與規律的作息', { act: { tidy: 0.45, study: 0.15 } }, ['messy', 'clumsy']),
    T('messy', '隨性', '生活', '不愛整理，但很自在；舒適需求掉得慢', { act: { tidy: -0.5 }, need: { comfort: 0.8 } }, ['organized', 'tidy', 'perfectionist']),
    T('serious', '認真', '生活', '做事專心，讀書與工作類的活動做得久', { act: { study: 0.35, read: 0.2, cook: 0.1, play: -0.15 } }, ['mischievous', 'playful']),
    T('playful', '愛玩', '生活', '玩樂優先；玩的時候特別開心', { act: { play: 0.45 }, soc: { playTogether: 0.35, joke: 0.2 }, need: { fun: 1.25 } }, ['serious']),
    // ---- 興趣
    T('angler', '釣魚迷', '興趣', '有水的地方就想釣魚', { act: { fish: 0.6 } }),
    T('gardener', '綠手指', '興趣', '喜歡照顧植物與菜園', { act: { tend: 0.55, forage: 0.2 } }),
    T('chef', '愛下廚', '興趣', '喜歡做料理給大家吃', { act: { cook: 0.55 }, soc: { food: 0.3 } }),
    T('stargazer', '愛看星星', '興趣', '晚上喜歡看星空，也愛邀人一起看', { act: { observe: 0.3 }, soc: { stargaze: 0.6 } }),
    T('collector', '收藏家', '興趣', '喜歡採集與逛街，找到新東西特別開心', { act: { forage: 0.4, browse: 0.25 }, emo: { curious: 1.2, proud: 1.15 } }),
    T('scholar', '好學', '興趣', '喜歡讀書、研究新知識', { act: { study: 0.5, read: 0.35 }, need: { interest: 1.2 } }),
    T('musical', '愛音樂', '興趣', '常常哼歌；一起玩的時候更開心', { act: { play: 0.15, daydream: 0.1 }, soc: { playTogether: 0.2, share: 0.2 }, emo: { happy: 1.1 } }),
    T('daydreamer', '愛發呆', '興趣', '常常望著遠方什麼都不做，卻很滿足', { act: { daydream: 0.55, observe: 0.3 }, need: { interest: 0.8 } }, ['restless']),
    T('storyteller', '愛說故事', '興趣', '喜歡分享見聞與興趣', { soc: { share: 0.55, chat: 0.2 } }, ['quiet']),
    T('neatfreak', '潔癖', '興趣', '看到亂就想整理；髒亂會不舒服', { act: { tidy: 0.6 }, need: { comfort: 1.25 } }, ['messy']),
    // ---- 16.2 社交（和其他角色怎麼相處；全部有實際效果：社交選擇、接受度、情緒）
    T('slowwarm', '慢熟', '社交', '和不熟的人保持距離；熟了以後很黏', { accept: -0.12, soc: { hello: 0.2, listen16: 0.2, handhold16: -0.2 }, emo: { shy: 1.3 } }, ['outgoing16']),
    T('outgoing16', '自來熟', '社交', '第一次見面就像老朋友；常主動打招呼、聊天', { accept: 0.15, soc: { hello: 0.4, smalltalk: 0.35, askday: 0.25 } }, ['slowwarm']),
    T('jealous16', '愛吃醋', '社交', '在意的人和別人太好會不開心', { emo: { jealous: 1.5, annoyed: 1.15 }, soc: { sulkat: 0.25, complain: 0.15 } }, ['easygoing']),
    T('pleaser', '討好型', '社交', '很難拒絕別人；常常主動關心、送小東西', { accept: 0.25, soc: { askok: 0.3, flower16: 0.25, cheerup: 0.25 }, emo: { nervous: 1.15 } }, ['blunt']),
    T('sharptongue', '毒舌', '社交', '說話很直，會取綽號、抱怨；但沒有惡意', { soc: { teasename: 0.4, complain: 0.25, compliment: -0.2 } }, ['tactful']),
    T('lazysocial', '怕麻煩', '社交', '不太主動找人；被邀請時常說「改天」', { accept: -0.15, soc: { smalltalk: -0.2, chase: -0.3 }, act: { rest: 0.15 } }, ['outgoing16']),
    T('caretaker', '愛照顧人', '社交', '看到別人累或難過就會靠過去', { soc: { askok: 0.45, restplease: 0.4, listen16: 0.3, comfort: 0.3 } }, []),
    T('grudge', '記仇', '社交', '吵過的架不容易忘；和好比較慢', { soc: { forgive16: -0.4, offerhand: -0.3, ignore16: 0.2 }, emo: { annoyed: 1.2 } }, ['easygoing']),
    T('easytocalm', '好哄', '社交', '生氣來得快去得也快，一點點心意就和好', { soc: { forgive16: 0.4, offerhand: 0.25 }, emo: { annoyed: 0.8 }, accept: 0.08 }, ['grudge']),
    T('performer', '愛表演', '社交', '喜歡唱歌、變魔術、逗大家笑', { soc: { sing16: 0.45, magic: 0.4, funnyface: 0.3, drumbeat: 0.25 } }, []),
    T('gossiper', '八卦', '社交', '消息很靈通，什麼事都想分享', { soc: { gossip: 0.45, askaround: 0.35 }, emo: { curious: 1.2 } }, []),
    T('touchy', '愛撒嬌', '社交', '喜歡身體上的親近：蹭蹭、牽手、靠著', { soc: { nuzzle16: 0.35, handhold16: 0.3, leanOn: 0.25, hug: 0.2 } }, ['slowwarm']),
  ];
  // extra contradictions for the traits that already existed
  const EXTRA_X = { lazy: ['sporty', 'restless', 'energetic', 'diligent'], brave: ['timid'], stubborn: ['easygoing'], perfectionist: ['easygoing', 'messy'], tidy: ['messy'], clumsy: ['organized'], extrovert: ['aloof', 'introvert'], sleepy: ['lightsleeper'], shy: ['outgoing', 'talkative'], outgoing: ['shy', 'quiet'], introvert: ['extrovert', 'talkative'], cheerful: ['pessimist'], optimist: ['pessimist'] };
  const have = new Set(Ch.TRAITS.map((t) => t.id));
  for (const t of NEW) if (!have.has(t.id)) { Ch.TRAITS.push(t); have.add(t.id); }
  const byId = {}; for (const t of Ch.TRAITS) { byId[t.id] = t; t.x = (t.x || []).slice(); t.fx = t.fx || {}; }
  for (const [id, xs] of Object.entries(EXTRA_X)) if (byId[id]) for (const x of xs) if (byId[x] && !byId[id].x.includes(x)) byId[id].x.push(x);
  for (const t of Ch.TRAITS) for (const x of t.x.slice()) if (byId[x] && !byId[x].x.includes(t.id)) byId[x].x.push(t.id);   // symmetric
  for (const t of Ch.TRAITS) t.x = t.x.filter((x) => byId[x]);

  // ---- the hooks (cheap: a character has at most 5 traits)
  const list = (c) => (c && c.personality && c.personality.traits) || [];
  /* 16.1: species and life stage carry effects in the same format (OC.People.fxList) and are added to the traits' */
  const extra = (c) => (OC.People && c && c.profile ? OC.People.fxList(c) : []);
  const mult = (c, kind, key) => { let m = 1; for (const id of list(c)) { const f = byId[id] && byId[id].fx[kind]; if (f && f[key] != null) m *= f[key]; } for (const e of extra(c)) { const f = e.fx[kind]; if (f && f[key] != null) m *= f[key]; } return m; };
  const sum = (c, kind, key) => { let s = 0; for (const id of list(c)) { const f = byId[id] && byId[id].fx[kind]; if (f && f[key] != null) s += f[key]; } for (const e of extra(c)) { const f = e.fx[kind]; if (f && f[key] != null) s += f[key]; } return s; };
  const decay = (c, need) => mult(c, 'need', need);
  const sens = (c, emo) => mult(c, 'emo', emo);
  const act = (c, a) => sum(c, 'act', a);
  const soc = (c, k) => sum(c, 'soc', k);
  const speed = (c) => { let m = 1; for (const id of list(c)) if (byId[id] && byId[id].fx.speed) m *= byId[id].fx.speed; for (const e of extra(c)) if (e.fx.speed) m *= e.fx.speed; return m; };
  const accept = (c) => { let s = 0; for (const id of list(c)) if (byId[id] && byId[id].fx.accept) s += byId[id].fx.accept; for (const e of extra(c)) if (e.fx.accept) s += e.fx.accept; return s; };
  /** which of the character's traits explains a preference for this activity / social move (for the "想法" panel) */
  const why = (c, kind, key) => { const t = list(c).map((id) => byId[id]).find((t2) => t2 && t2.fx[kind] && t2.fx[kind][key] > 0); return t ? t.zh : ''; };

  // ---- contradictions
  /** traits that cannot be added to this selection, with the selected trait that blocks each: { id: [blocking ids] } */
  function clashes(selected) { const out = {}; for (const s of selected) for (const x of (byId[s] ? byId[s].x : [])) if (!selected.includes(x)) (out[x] = out[x] || []).push(s); return out; }
  const conflict = (a, b) => !!(byId[a] && byId[a].x.includes(b));
  const valid = (sel) => sel.every((a, i) => sel.every((b, j) => i === j || !conflict(a, b)));

  // ---- random (never a contradiction)
  const rnd = () => Math.random();
  function randomTraits(n) {
    n = n || 3 + Math.floor(rnd() * 3); const pool = Ch.TRAITS.map((t) => t.id), out = []; let guard = 0;
    while (out.length < n && guard++ < 400) { const id = pool[Math.floor(rnd() * pool.length)]; if (out.includes(id) || out.some((o) => conflict(o, id))) continue; out.push(id); }
    return out;
  }
  const LIKE_WORDS = ['雨天', '晴天', '甜點', '星空', '海邊', '森林', '貓', '音樂', '舊書', '下午茶', '散步', '花', '熱湯', '雪', '夕陽', '市集', '安靜的早晨', '手寫信', '毛毯', '風鈴', '煙火', '麵包香', '露營', '圖書館', '釣魚', '拼圖'];
  const DISLIKE_WORDS = ['打雷', '太吵', '早起', '苦的東西', '蟲', '太熱', '太冷', '被催', '排隊', '下雨沒帶傘', '人擠人', '被打擾', '辣', '黏黏的東西', '黑漆漆的地方'];
  const HOBBY_WORDS = ['畫畫', '看書', '釣魚', '園藝', '料理', '唱歌', '散步', '收集貝殼', '觀星', '寫日記', '拼圖', '攝影', '跳舞', '做甜點', '賞鳥', '摺紙', '下棋', '編織'];
  const HABIT_WORDS = ['睡前喝牛奶', '早上伸懶腰', '邊走邊哼歌', '把東西排整齊', '吃飯留最愛的到最後', '下雨天看窗外', '每天寫一句日記', '看到貓就停下來', '午後打個盹', '睡前整理房間'];
  const pickN = (arr, n) => { const a = arr.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };
  /** random liked / disliked things, hobbies, habits, item likes and flavours. Food preferences the player set by hand (tastes.food, locked) are not touched. */
  function randomTastes(c) {
    const P = c.profile, t = c.tastes;
    const put2 = (k, v) => { if (Array.isArray(P[k])) P[k].splice(0, P[k].length, ...v); else P[k] = v; };   // in place: the editor's tag lists hold these arrays
    put2('likes', pickN(LIKE_WORDS, 2 + Math.floor(rnd() * 2))); put2('dislikes', pickN(DISLIKE_WORDS, 1 + Math.floor(rnd() * 2))); put2('hobbies', pickN(HOBBY_WORDS, 2)); put2('habits', pickN(HABIT_WORDS, 1));
    const items = Object.entries(OC.Style.ITEMS).filter(([, it]) => it.kind !== 'clothing').map(([id]) => id), chosen = pickN(items, 5);
    t.likeItems.splice(0, t.likeItems.length, ...chosen.slice(0, 3)); t.dislikeItems.splice(0, t.dislikeItems.length, ...chosen.slice(3, 5));
    const fl = Object.keys((OC.Items && OC.Items.FLAVORS) || { sweet: 1, salty: 1, sour: 1, spicy: 1, bitter: 1, umami: 1, fresh: 1 }), fs = pickN(fl, 3); t.flavor = t.flavor || {};
    t.flavor = {}; t.flavor[fs[0]] = 2; t.flavor[fs[1]] = 1; t.flavor[fs[2]] = -1;   // numbers: OC.Taste adds them to what the food tastes like
    return { likes: P.likes, dislikes: P.dislikes, items: t.likeItems, flavors: fs };
  }

  // ---- lines: each new trait speaks in its own way now and then (data; the dialogue engine picks by the `trait` condition)
  const L = [
    ['talkative', '我跟你說，今天發生了好多事——你有空聽嗎？', '{other}，等一下，我還沒講完。'], ['quiet', '……嗯。我在聽。', '不說話也沒關係吧。這樣坐著就很好。'],
    ['caring', '你有好好吃飯嗎？臉色看起來有點累。', '{other}，有什麼需要就說，不要自己撐著。'], ['aloof', '我有我自己的步調。', '隨你。我等一下還有事。'],
    ['clingy', '你要去哪？我可以跟嗎。', '{other}，再陪我一下下就好。'], ['independent', '我自己來就可以了，謝謝。', '一個人也能把事情做好，這點我還算有把握。'],
    ['polite', '打擾了。今天也請多指教。', '{other}，謝謝你剛才幫忙。'], ['mischievous', '欸，你背後有東西——騙你的。', '{other}，你猜我把什麼藏起來了？'],
    ['blunt', '我直說了：這樣不行。', '{other}，你今天的搭配有點怪。不過人沒問題。'], ['tactful', '如果說錯了請告訴我。我只是覺得，也許可以換個方式。', '{other}，慢慢來，不急。'],
    ['generous', '這個給你。我剛好多一個。', '{other}，喜歡就拿去，別客氣。'], ['stingy', '這個……是我的。看看可以，別拿。', '我可是存了很久才有的。'],
    ['competitive', '再比一次。剛才那局不算。', '{other}，下次我一定贏。'], ['easygoing', '都可以啊。你決定就好。', '沒關係，這種事不用放在心上。'],
    ['calm', '先深呼吸。事情沒有那麼糟。', '慌也沒用。一件一件來。'], ['hotheaded', '快一點啦，我等不下去了。', '啊——算了算了，我自己來！'],
    ['patient', '不急。好東西值得等。', '魚不上鉤的時間，也算是釣魚的一部分。'], ['timid', '那、那邊黑黑的……我們繞路好不好。', '剛才那個聲音是什麼？！'],
    ['sentimental', '這個味道讓我想起以前。', '有些事過了很久，還是記得很清楚。'], ['moody', '剛才還好好的，現在突然有點悶。', '今天心情很好！……大概吧。先這樣。'],
    ['steady', '嗯，沒什麼大不了的。', '日子就是這樣，一天一天過。'], ['proudish', '這種程度，對我來說還好。', '我沒有錯……至少不全是我的錯。'],
    ['humble', '沒有啦，只是運氣好。', '是我不對，先跟你說聲抱歉。'], ['jealousy', '你剛才跟誰聊那麼久？……沒事，隨便問問。', '{other}最近好像比較常找別人。'],
    ['openhearted', '過去的事就讓它過去吧。', '那種小事，我早就忘了。'], ['restless', '我坐不住，出去走走。', '一直待在同一個地方，腳會癢。'],
    ['homebody', '還是家裡最好。', '外面很好，但我想回去了。'], ['adventurous', '那邊我還沒去過。走吧。', '不試試看怎麼知道。'],
    ['frugal', '自己做的比較實在。', '這個價錢……我再想想。'], ['shopaholic', '聽說店裡進了新東西。', '只是看看，不一定買。……大概。'],
    ['sporty', '動一動，腦袋才會清楚。', '要不要一起伸展一下？'], ['gourmet', '火候差一點。不過食材是好的。', '吃東西這件事，不能隨便。'],
    ['lightsleeper', '昨晚又醒了兩次。', '一點聲音我就會醒。'], ['organized', '東西用完要放回原位。', '我把今天要做的事都排好了。'],
    ['messy', '亂一點才找得到東西。', '等一下再收。等一下。'], ['serious', '既然要做，就做好。', '這件事我想認真對待。'],
    ['playful', '先玩再說！', '{other}，來比誰先跑到那棵樹。'], ['angler', '今天的水色不錯，適合下竿。', '上次那條大的跑掉了，我還記得。'],
    ['gardener', '土有點乾，該澆水了。', '植物不會說話，但會用葉子回答你。'], ['chef', '我在想今天的晚餐。', '{other}，等一下來吃，我多做了一份。'],
    ['stargazer', '今晚雲不多，星星應該很清楚。', '看著星星的時候，煩惱會變得很小。'], ['collector', '這個我還沒有。', '把同一種東西排在一起看，就是很滿足。'],
    ['scholar', '我最近在讀一本很有意思的書。', '原來是這樣運作的——又學到一件事。'], ['musical', '（輕輕哼著歌）', '這段旋律一直在腦子裡轉。'],
    ['daydreamer', '……啊，抱歉，我剛剛在想別的事。', '雲在動。我也在動。只是比較慢。'], ['storyteller', '我跟你講一件以前的事。', '{other}，你聽過這個故事嗎？'],
    ['neatfreak', '那邊有灰塵。我受不了。', '擦乾淨了。舒服多了。'],
  ];
  const D = OC.LifeData;
  if (D && D.LINES) L.forEach(([id, a, b], i) => {
    D.LINES.push({ id: 't13_' + i + 'a', cat: 'chat_player', text: a.replace('{other}，', '').replace('{other}', '你'), c: { trait: id }, w: 3, m: true });
    D.LINES.push({ id: 't13_' + i + 'b', cat: 'talk', text: b, c: { trait: id }, w: 3, m: true });
    D.LINES.push({ id: 't13_' + i + 'c', cat: 'desk_idle', text: a.replace('{other}，', '').replace('{other}', '你'), c: { trait: id }, w: 2, m: true });
  });

  OC.Traits13 = { NEW, byId, decay, sens, act, soc, speed, accept, why, clashes, conflict, valid, randomTraits, randomTastes, LIKE_WORDS, DISLIKE_WORDS, HOBBY_WORDS, HABIT_WORDS };
})();
