/* OC Shimeji 12.0 — a quieter, more grown-up voice (data only).
 * Each line is [category, text, conditions, weight] like LifeData.LINES; they are flagged `m` so the dialogue engine prefers them while the
 * tone setting is "沉穩" (the default) and plays the older, more exuberant lines only now and then. Short, concrete, a little dry; feelings
 * are implied rather than announced; no tildes, no stacked exclamation marks. "活潑" (Settings › 生活設定) brings the old voice back in full.
 * Variables: {other} {name} {wx} {time} {like} {hobby} {shared} {mem} {wish} {act} {item} {habit} {days} {place}
 */
(function () {
  'use strict';
  const D = OC.LifeData; if (!D || !D.LINES) return;
  const P = { voice: 'plain' }, B = { voice: 'bright' }, C = { voice: 'calm' }, K = { voice: 'cool' };
  const with_ = (o, x) => Object.assign({}, o, x);
  const L = [
    // ---------------------------------------------------------------- meeting
    ['greet', '早，{other}。', with_(P, { phase: 'morning' })], ['greet', '早安。睡得還好嗎？', with_(C, { phase: 'morning' })], ['greet', '這個時間遇到你，今天應該不會太糟。', with_(K, { phase: 'morning' })],
    ['greet', '午安，{other}。', { phase: 'noon' }], ['greet', '你也在這裡。正好，我剛閒下來。', with_(P, { phase: 'noon' })],
    ['greet', '傍晚了。你今天過得怎麼樣？', with_(C, { phase: 'dusk' })], ['greet', '快天黑了，{other}。', { phase: 'dusk' }],
    ['greet', '這麼晚還沒睡嗎。', with_(P, { phase: 'night' })], ['greet', '夜裡比較安靜，我喜歡這個時候遇見人。', with_(C, { phase: 'night' })],
    ['greet', '好久不見，{other}。最近還順利嗎？', { days: '>=3', rel: ['friend', 'bestfriend', 'family'] }, 3], ['greet', '你來了。我剛才還在想你會不會經過這裡。', { rel: ['bestfriend', 'family', 'lover', 'partner'] }, 3],
    ['greet', '初次見面，我是{name}。', { rel: ['stranger'] }, 3], ['greet', '嗯？我們好像還沒好好說過話。', with_(K, { rel: ['stranger'] }), 2],
    ['greet', '……。', with_(K, { rel: ['rival'] }), 3], ['greet', '又是你。', with_(K, { rel: ['rival'] }), 3],
    ['greet_r', '嗯，你好。', P], ['greet_r', '你好，{other}。', C], ['greet_r', '來了。', K], ['greet_r', '早。', with_(P, { phase: 'morning' })], ['greet_r', '你也是。', P], ['greet_r', '好久沒看到你了，進來坐吧。', with_(B, { rel: ['friend', 'bestfriend', 'family'] }), 2],

    // ---------------------------------------------------------------- small talk
    ['talk', '今天是{wx}天。不趕時間的話，適合慢慢走。', P], ['talk', '{wx}的日子，連呼吸都慢了一點。', C], ['talk', '{wx}。我多半會在這種天氣裡想起舊事。', K],
    ['talk', '雨一直下。我不討厭，只是衣服乾得慢。', { wx: ['rain'] }, 4], ['talk', '雨聲蓋過了其他聲音。難得這麼安靜。', with_(C, { wx: ['rain'] }), 4], ['talk', '霧這麼濃，連自己的腳步聲都變得陌生。', { wx: ['fog'] }, 4],
    ['talk', '天氣好的時候，反而不知道該做什麼才不浪費。', { wx: ['clear'] }, 3], ['talk', '這種亮度，拍照一定很好看。', { wx: ['clear'] }, 2],
    ['talk', '黃昏是一天裡我最想坐下來的時間。', with_(C, { phase: 'dusk' }), 3], ['talk', '夜裡的島有另一種秩序。燈亮著的地方，就是有人在。', { phase: 'night' }, 3], ['talk', '早晨的空氣比較誠實。', with_(P, { phase: 'morning' }), 3],
    ['talk', '有點餓了。你呢？', { need: { food: '<40' } }, 4], ['talk', '我需要睡一覺，不然下一句話會講錯。', { need: { sleep: '<35' } }, 4], ['talk', '今天比平常累。不是壞事，就是累。', { need: { energy: '<35' } }, 3],
    ['talk', '最近有點悶。不是難過，只是缺少一件值得期待的事。', with_(P, { need: { fun: '<35' } }), 3], ['talk', '說出來比較好。我今天其實有點想找個人聊聊。', { need: { social: '<40' } }, 4],
    ['talk', '還記得{mem}嗎？那件事我後來想了很多次。', { hasMem: true }, 4], ['talk', '{mem}。現在回頭看，感覺不太一樣了。', with_(C, { hasMem: true }), 3],
    ['talk', '我最近在想{wish}。還不確定，但不想放著不管。', { hasWish: true }, 4], ['talk', '你有沒有那種，一直想做卻一直沒開始的事？我有一件：{wish}。', { hasWish: true }, 3],
    ['talk', '你也喜歡{shared}。這樣的人不多。', { hasShared: true }, 4], ['talk', '提到{shared}，我可以講上很久。你確定要問嗎。', with_(B, { hasShared: true }), 3],
    ['talk', '{hobby}這件事，越做越覺得自己知道得太少。', P], ['talk', '我最近有在碰{hobby}。談不上擅長，但安靜的時候很需要它。', C],
    ['talk', '剛才{act}的時候，我發現自己其實並不趕。', { hasRecent: true }, 3], ['talk', '我這幾天習慣{habit}了。也不知道算不算好習慣。', { hasHabit: true }, 3],
    ['talk', '你有注意到嗎，島上的光線每個季節都不一樣。', P], ['talk', '有時候我會想，這座島是我們選的，還是它收留了我們。', with_(C, { phase: 'night' }), 3], ['talk', '我不太擅長說自己的事。但你如果想聽，我可以試試。', with_(K, { rel: ['friend', 'bestfriend'] }), 2],
    ['talk_r', '嗯，我在聽。', P], ['talk_r', '這樣啊。你繼續說。', C], ['talk_r', '有意思。', K], ['talk_r', '我沒想過這個角度。', P], ['talk_r', '你說得對，至少我是這麼覺得。', C], ['talk_r', '嗯。我有類似的感覺。', P],
    ['talk_r', '現在不太想聊。晚點好嗎。', { emo: ['down', 'annoyed', 'tired'] }, 5], ['talk_r', '（點了點頭）', with_(P, { trait: 'shy' }), 2],

    // ---------------------------------------------------------------- sharing / praise / comfort
    ['share', '我最近在研究{hobby}。講起來有點長，你願意聽嗎。', P], ['share', '關於{hobby}，我有個還不成熟的想法，想聽聽你的意見。', C], ['share', '你不用附和。我只是想把{hobby}的事說出來。', K],
    ['share_r', '說吧，我有時間。', P], ['share_r', '我也有類似的經驗。', { hasShared: true }, 4], ['share_r', '不太懂，但聽你說很有意思。', C], ['share_r', '下次也教我一點。', P], ['share_r', '嗯。繼續。', K],
    ['compliment', '你處理事情的方式，我一直很欣賞。', C], ['compliment', '今天的你看起來很穩。', P], ['compliment', '說實話，你比自己以為的更可靠。', K], ['compliment', '你笑起來的時候，周圍會安靜下來。', with_(C, { rel: ['friend', 'bestfriend', 'lover', 'partner'] }), 2],
    ['compliment_r', '謝謝。我會記得的。', P], ['compliment_r', '……突然這樣說，我有點不知道怎麼接。', with_(P, { trait: 'shy' }), 4], ['compliment_r', '我知道。不過聽你說出來，感覺不一樣。', K], ['compliment_r', '你也是。我是認真的。', C],
    ['comfort', '你還好嗎。不想說也沒關係，我陪你坐一下。', C], ['comfort', '先休息。事情不會因為你多睡一小時而跑掉。', P], ['comfort', '難過的時候不用裝作沒事。這裡只有我。', C], ['comfort', '我沒有答案，但我在。', K], ['comfort', '慢慢來。這種事急不得。', P], ['comfort', '你已經做得夠多了。', C],
    ['comfort_r', '……謝謝。這樣就夠了。', P], ['comfort_r', '嗯。好一點了。', C], ['comfort_r', '我想一個人待一下。不是你的問題。', K], ['comfort_r', '你在這裡，我就沒那麼慌了。', P],
    ['joke', '我今天發現一件事：影子比我早起。', P], ['joke', '我剛才認真考慮要不要把雲當成枕頭。結論是不行，太貴。', B], ['joke', '據我觀察，這座島的魚比我更會排程。', K],
    ['laugh', '哈。你這個人。', P], ['laugh', '噗。……抱歉，真的好笑。', C], ['laugh', '……（嘴角動了一下）', K], ['flat', '……這個梗，我先收下。', P], ['flat', '嗯，需要一點時間消化。', C],
    ['prank', '（輕輕拍了你的肩）回頭。', P], ['prank_ok', '你真是……下次我會先看背後。', C], ['prank_ok', '哈，這次算你贏。', B], ['prank_bad', '這樣不太好。我不喜歡。', P], ['prank_bad', '……我現在沒有心情。', K],

    // ---------------------------------------------------------------- food / gifts / invitations
    ['food', '我多帶了一份。不吃的話會浪費。', P], ['food', '一起吃吧。我不想一個人面對這麼多。', C], ['food', '……給你。別客氣。', K],
    ['food_r', '謝謝。正好餓了。', P], ['food_r', '你怎麼知道我現在想吃這個。', C], ['food_r', '收下了。', K],
    ['gift', '路上看到這個，想到你。就這樣。', P], ['gift', '不是什麼貴重的東西，但我希望你留著。', C], ['gift', '給你。我挑了一陣子。', B], ['gift', '……這個。拿去。', K], ['gift', '看到的時候我就知道是你的。', with_(C, { rel: ['friend', 'bestfriend', 'lover', 'partner', 'family'] }), 2],
    ['gift_r', '謝謝你。我會好好放著。', P], ['gift_r', '……我很喜歡。真的。', C], ['gift_r', '你總是在我沒預期的時候做這種事。', B], ['gift_r', '收到了。謝謝。', K], ['gift_r', '這個我會一直帶著。', { rel: ['bestfriend', 'lover', 'partner', 'family'] }, 2],
    ['invite', '要不要一起{act}？不趕時間。', P], ['invite', '我正打算去{act}。你若有空，一起吧。', C], ['invite', '一個人{act}也行，但有人在比較好。', with_(P, { need: { social: '<50' } }), 3], ['invite', '走吧，去{act}。', K], ['invite', '我想了一下，這種時候最適合{act}。', B],
    ['accept', '好，一起。', P], ['accept', '可以。我正好沒事。', C], ['accept', '走吧。', K], ['accept', '好啊。我也在想要不要出門。', B], ['accept', '我很樂意。', C],
    ['decline', '抱歉，我現在需要休息。', with_(C, { need: { energy: '<45' } }), 4], ['decline', '我手上的事還沒完，下次吧。', { busy: true }, 4], ['decline', '今天不太想。不是你的問題。', K], ['decline', '改天好嗎。我會主動找你。', P], ['decline', '謝謝你想到我，但我想一個人待著。', C],
    ['later', '再等我一會兒，做完就過去。', P], ['later', '稍後。我記得這件事。', C], ['later', '一會兒。', K],
    ['declined', '好。那就下次。', P], ['declined', '嗯，沒關係。', C], ['declined', '……知道了。', K], ['declined', '被拒絕了。不過我理解。', B],

    // ---------------------------------------------------------------- friction and repair
    ['argue', '你剛才那樣說，我不能當作沒聽到。', P], ['argue', '我們得談談。現在。', K], ['argue', '我不是要吵。但這件事你確實做得不對。', C], ['argue', '你每次都這樣。我已經不知道該怎麼說了。', with_(P, { emo: ['annoyed'] }), 3], ['argue', '我同意你的出發點，不同意你的做法。', K],
    ['argue_r', '那你先說清楚，我哪裡讓你這麼想。', P], ['argue_r', '隨你怎麼想。', K], ['argue_r', '……對不起。我沒想到會讓你這樣。', with_(C, { trait: 'gentle' }), 4], ['argue_r', '我們都冷靜一下，好嗎。', C],
    ['apologize', '之前的事，是我不對。對不起。', P], ['apologize', '我想了很久。我不該那樣對你。', C], ['apologize', '我不求你立刻原諒，只是想讓你知道我很抱歉。', C], ['apologize', '……抱歉。就這一句，我說得很不熟練。', K], ['apologize', '我們別再這樣僵著了，好嗎。', with_(P, { rel: ['friend', 'bestfriend', 'lover', 'partner'] }), 2],
    ['forgive', '我也有不對的地方。就到這裡吧。', P], ['forgive', '嗯，我收到了。謝謝你肯說。', C], ['forgive', '好。我原諒你。', K], ['forgive', '說開了就好。我不想再為這件事難受。', P],
    ['refuse', '我還沒準備好。再給我一點時間。', P], ['refuse', '話我聽到了，但現在說不出「沒事」。', C], ['refuse', '再說吧。', with_(K, { trait: 'stubborn' }), 4],
    ['bye', '我先去忙了。晚點見。', P], ['bye', '今天謝謝你。', C], ['bye', '走了。', K], ['bye', '下次再聊。路上小心。', P], ['bye', '我得去{act}了。改天再說。', B], ['bye', '保重。', C],

    // ---------------------------------------------------------------- alone (small bubbles)
    ['solo_read', '再讀一頁。就一頁。', P], ['solo_read', '這句我要記下來。', C], ['solo_read', '作者其實什麼都沒解釋，這樣反而好。', K], ['solo_read', '有些書是為了讀完而讀，有些是為了不要讀完。', with_(C, { trait: 'bookworm' }), 3],
    ['solo_eat', '嗯。味道剛好。', P], ['solo_eat', '慢慢吃，比較能嘗出差別。', C], ['solo_eat', '{like}的話會更對味。', with_(P, { trait: 'picky' }), 3],
    ['solo_observe', '光線在這個角度最好看。', P], ['solo_observe', '站久了才看得出細節。', C], ['solo_observe', '星星比昨天多。大概是我的錯覺。', with_(C, { phase: 'night', wx: ['clear', 'cloudy'] }), 3], ['solo_observe', '雲的影子在水面上走得比雲還快。', P],
    ['solo_tend', '再長一點。我不催你。', P], ['solo_tend', '今天的土比較乾，記得澆多一些。', C], ['solo_tend', '植物很誠實，你怎麼待牠，牠就怎麼回你。', C],
    ['solo_rest', '就坐一會兒。', P], ['solo_rest', '什麼都不想，也是一種休息。', C], ['solo_rest', '腿還在抱怨，我先聽牠的。', B],
    ['solo_play', '再來一次。這次我知道訣竅了。', B], ['solo_play', '輸贏不重要。……大概。', P],
    ['solo_explore', '這條路我沒走過。', P], ['solo_explore', '有點意思。我再往前看看。', C], ['solo_explore', '地圖上沒有的地方，通常最值得走。', B],
    ['solo_daydream', '……我剛才想到哪裡了。', P], ['solo_daydream', '如果當初選了另一條路，現在會怎樣。算了，沒有如果。', C], ['solo_daydream', '（望著遠處發呆）', C],
    ['solo_walk', '走一走，腦袋比較清楚。', P], ['solo_walk', '沒有目的地，也不錯。', C], ['solo_walk', '今天繞遠路。', K],
    ['solo_stretch', '骨頭都在抗議。', P], ['solo_stretch', '好了，繼續。', K], ['solo_sleep', 'zzz……', P], ['solo_sleep', '……再五分鐘。', K], ['solo_tidy', '整理好了，心裡也順了一點。', P], ['solo_tidy', '每樣東西都有位置，這樣就夠了。', C],
    ['solo_need', '肚子在抗議了。', with_(P, { need: { food: '<25' } }), 5], ['solo_need', '再撐下去不行，得睡了。', with_(P, { need: { sleep: '<25' } }), 5], ['solo_need', '有點孤單。不嚴重，但存在。', with_(C, { need: { social: '<25' } }), 5], ['solo_need', '太久沒好好休息了。', with_(P, { need: { energy: '<25' } }), 4],

    // ---------------------------------------------------------------- to the player
    ['pet', '嗯。這樣很舒服。', P], ['pet', '你的手很暖。', C], ['pet', '……再一下下。', with_(P, { trait: 'shy' }), 3], ['pet', '還行。別停。', K], ['pet', '我今天需要這個。', C], ['pet', '好像有點上癮。', B],
    ['call', '我在。', P], ['call', '嗯，怎麼了？', C], ['call', '來了。', K], ['call', '你叫我，我就會出現。', B],
    ['fed_like', '{item}。你記得我喜歡這個。', P], ['fed_like', '剛好是我想要的，謝謝。', C], ['fed_like', '……謝謝。我很開心。', K], ['fed_ok', '謝謝你的{item}。', P], ['fed_ok', '味道不錯，我會吃完。', C], ['fed_ok', '收下了。', K], ['fed_bad', '{item}……我不太習慣。不過謝謝你。', P], ['fed_bad', '這個我吃不太下，抱歉。心意我收到了。', C],
    ['played', '剛才那局不錯。', P], ['played', '謝謝你陪我。', C], ['played', '……還可以。再來一局也行。', K], ['played', '好久沒這樣專心玩了。', B],
    ['chat_player', '你今天過得怎麼樣？', P], ['chat_player', '今天{wx}。你看得到窗外嗎。', C], ['chat_player', '我剛想到一件事，還不確定要不要說。', with_(C, { rel: ['friend', 'bestfriend'] }), 2],
    ['chat_player', '{other}今天和我一起{act}了。意外地自在。', { hasRecentWith: true }, 4], ['chat_player', '我想要{wish}。講出來之後，反而比較確定了。', { hasWish: true }, 4], ['chat_player', '我最近常常{habit}。你覺得這樣好嗎。', { hasHabit: true }, 3],
    ['chat_player', '還記得{mem}嗎。我偶爾還是會想起。', { hasMem: true }, 4], ['chat_player', '有時候我覺得你比我更清楚我想要什麼。', with_(C, { rel: ['friend', 'bestfriend'] }), 1],
    ['chat_player', '我其實滿喜歡{like}的。你問起的話，我才好意思說。', P], ['chat_player', '最近有點睡不好。不嚴重。', with_(P, { need: { sleep: '<55' } }), 3], ['chat_player', '今天天氣不錯，要不要出去走走。', { wx: ['clear'] }, 3], ['chat_player', '下雨了。你需要的話，我陪你待在屋裡。', with_(C, { wx: ['rain'] }), 3],
    ['chat_player', '我想把剩下的時間用在有意義的事上。你覺得什麼算有意義？', with_(C, { phase: 'night' }), 2], ['chat_player', '你有沒有一個地方，想起來就覺得安心？我有，就是這座島。', C],

    // ---------------------------------------------------------------- 11.0 touch & closeness
    ['pet_ears', '耳朵比較敏感。……不過你的力道剛好。', P], ['pet_ears', '那裡……輕一點。', with_(P, { trait: 'shy' }), 3], ['pet_ears', '嗯。就是那裡。', K],
    ['pet_cheek', '臉頰有點燙，是你的手還是我？', P], ['pet_cheek', '這樣……可以。', C], ['pet_cheek', '別笑我。', with_(P, { trait: 'shy' }), 3],
    ['pet_belly', '肚子比較沒防備。你是故意的嗎。', B], ['pet_belly', '……放鬆下來了。', C], ['pet_belly', '好，這次我信任你。', K],
    ['pet_tail', '尾巴不是隨便碰的。……算了，是你就好。', P], ['pet_tail', '那裡有點癢。', P], ['pet_tail', '你知道自己在做什麼吧。', K],
    ['pet_tickle', '等、等一下。哈……真的不行。', P], ['pet_tickle', '你這樣……我沒辦法正經說話。', B], ['pet_tickle', '停。好，不要停。算了，停。', P],
    ['pet_dislike', '那裡不要。請你換個地方。', P], ['pet_dislike', '我現在不想被碰。', K], ['pet_dislike', '抱歉，這樣我會不舒服。', C],
    ['hug_start', '過來吧。', P], ['hug_start', '我正需要這個。', C], ['hug_start', '……好。', K],
    ['highfive_ok', '漂亮。', P], ['highfive_ok', '默契不錯。', C], ['highfive_ok', '哼，算你快。', K], ['highfive_miss', '……失手了。再來一次？', P], ['highfive_miss', '沒關係，下次。', C],
    ['handhold_start', '走吧。別放開。', P], ['handhold_start', '這樣走，比較不容易迷路。', C], ['handhold_start', '……嗯。', K],

    // ---------------------------------------------------------------- the desktop pet
    ['desk_out', '我出來透透氣。你繼續忙，我不吵你。', P], ['desk_out', '桌面比我想像的大。我先到處看看。', C], ['desk_out', '陪你一會兒。', K], ['desk_out', '今天也請多指教。', P],
    ['desk_tap', '嗯？', P], ['desk_tap', '需要我的話，儘管說。', C], ['desk_tap', '別戳。……好吧，稍微可以。', K], ['desk_tap', '我在。', P],
    ['desk_wake', '……我睡著了嗎。幾點了。', P], ['desk_wake', '嗯。醒了。', K], ['desk_wake', '剛好夢到一半。算了。', C],
    ['desk_drag', '好，我自己會站穩。', P], ['desk_drag', '你要帶我去哪裡。', C], ['desk_drag', '……放我下來。', K], ['desk_drop', '落地。還行。', P], ['desk_drop', '下次輕一點。', K],
    ['desk_idle', '你已經盯著螢幕很久了，要不要站起來走一走。', C], ['desk_idle', '工作不是永遠做得完的。休息一下也算數。', P], ['desk_idle', '我在這裡。想說話的時候再說。', C], ['desk_idle', '小島上的{wx}天，不知道是什麼樣子。', P], ['desk_idle', '我剛才在想{mem}。', { hasMem: true }, 3],
    ['desk_sleepy', '有點睏。別熬太晚。', P], ['desk_sleepy', '你也該睡了。', with_(C, { phase: 'night' }), 3], ['desk_hungry', '我餓了。不急，你忙完再說。', P], ['desk_hungry', '有沒有什麼可以吃的。', K],
    ['desk_lonely', '你很久沒跟我說話了。沒關係，我知道你很忙。', C], ['desk_lonely', '陪我一下就好，不用說什麼。', P],
    ['desk_morning', '早。今天的事不用一次做完。', with_(P, { phase: 'morning' })], ['desk_morning', '早安。先喝點水。', with_(C, { phase: 'morning' })], ['desk_evening', '今天辛苦了。', C], ['desk_evening', '差不多該收尾了，剩下的明天再說。', P],
    ['desk_friend', '{other}來過了。牠說你最近氣色不錯。', { hasRecentWith: true }, 2],

    // ---------------------------------------------------------------- requests
    ['req_ask', '有件事想拜託你：{want}。若不方便，直接說。', P], ['req_ask', '不知道你有沒有空。我想{want}。', C], ['req_ask', '我想{want}。……這不是命令，只是想讓你知道。', K], ['req_ask', '如果可以，我想{want}。', with_(P, { trait: 'shy' }), 3],
    ['req_accept', '謝謝。我會記得的。', P], ['req_accept', '……謝謝你。', C], ['req_accept', '好。那就麻煩你了。', K],
    ['req_later', '好，我等你。不急。', P], ['req_later', '沒關係，找個適合的時間就好。', C], ['req_later', '嗯。', K],
    ['req_decline', '這樣啊。沒關係。', P], ['req_decline', '我明白，你也有你的事。', C], ['req_decline', '……好。', K],
    ['req_done', '謝謝你。我真的很需要這個。', P], ['req_done', '你做到了。我不會忘記。', C], ['req_done', '……謝了。', K],
    ['req_expire', '之前說的事，我自己想通了。你不用放在心上。', P], ['req_expire', '那件事，算了吧。', K],
    ['req_cancel', '嗯。那就先不做了，之後有機會再說。', P], ['req_cancel', '沒關係，你也有你的安排。', C], ['req_cancel', '……知道了。', K],
  ];
  L.forEach((x, i) => D.LINES.push({ id: 'm12_' + i, cat: x[0], text: x[1], c: x[2] || null, w: x[3] || 1, m: true }));
})();
