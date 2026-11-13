/* OC Shimeji — 15.5 a serial story in three parts (data only; same format as LifeData.EVENTS / LINES, like the 0.9 「秘密基地」).
 * 「說不出口的話」: a character wants to thank a friend properly but cannot find the words. Part two comes to you for advice, and your
 * answer decides how part three goes (flags carry it over days). Results go through the event engine (relationships, feelings,
 * memories with keys) — events give no rewards. Every line is original. */
(function () {
  'use strict';
  const D = OC.LifeData; if (!D || !D.EVENTS || !D.LINES) return;
  const P = { voice: 'plain' }, B = { voice: 'bright' }, C = { voice: 'calm' }, K = { voice: 'cool' };
  const EV = [
    { id: 'thank1', zh: '說不出口的話（一）', trigger: 'tick', prio: 3, once: 'self', chance: 0.35, b: true, c: { noflag: 'thankStart' }, bc: { aff: '>=30' }, important: true,
      steps: [['face', 'a', 'b'], ['anim', 'a', 'shy', 1.2], ['say', 'a', 'ev_thank1'], ['anim', 'a', 'sigh', 1.0]],
      fx: { flag: 'thankStart', emo: { a: ['nervous', 0.4] }, mem: { a: { type: 'event', imp: 0.55, text: '有些話想跟{other}說，可是說不出口' } } } },
    { id: 'thank2', zh: '說不出口的話（二）', trigger: 'tick', prio: 3, once: 'self', chance: 0.4, c: { flag: 'thankStart', noflag: 'thankAsk' }, important: true, watch: true, ask: '{name}好像有事想問你',
      steps: [['go', 'a', 'player'], ['face', 'a', 'player'], ['say', 'a', 'ev_thank2'],
        ['choice', '要怎麼回答{name}？', [{ label: '直接說出來吧', say: ['a', 'ev_thank2_go'], fx: { flag: 'thankGo', emo: { a: ['happy', 0.4] } } }, { label: '寫一封信給對方', say: ['a', 'ev_thank2_letter'], fx: { flag: 'thankLetter', emo: { a: ['calm', 0.4] } } }, { label: '再等等也沒關係', say: ['a', 'ev_thank2_wait'], fx: { flag: 'thankWait', emo: { a: ['calm', 0.3] } } }]]],
      fx: { flag: 'thankAsk', mem: { a: { type: 'social', imp: 0.5, text: '問了你該怎麼開口' } } } },
    { id: 'thank3', zh: '說不出口的話（三）說出來了', trigger: 'tick', prio: 4, once: 'self', chance: 0.5, b: true, c: { flag: 'thankAsk', noflag: ['thankDone', 'thankWait'] }, bc: { aff: '>=25' }, important: true, watch: true, ask: '{name}走向{other}',
      steps: [['cam', 'a'], ['go', 'a', 'b'], ['face', 'a', 'b'], ['anim', 'a', 'shy', 0.8], ['say', 'a', 'ev_thank3'], ['anim', 'b', 'surprised', 0.8], ['say', 'b', 'ev_thank3_r'], ['anim', 'a', 'happy', 1.2], ['anim', 'b', 'hug', 1.4], ['sound', 'fanfare']],
      fx: { flag: 'thankDone', rel: { ab: { aff: 8, trust: 8, intim: 5 }, ba: { aff: 8, trust: 6, intim: 5 } }, emo: { a: ['proud', 0.7], b: ['happy', 0.8] }, mem: { both: { type: 'milestone', imp: 0.95, text: '和{other}說了一直想說的謝謝' } } } },
    { id: 'thank3w', zh: '說不出口的話（三）慢慢來', trigger: 'tick', prio: 3, once: 'self', chance: 0.25, b: true, c: { flag: 'thankWait', noflag: 'thankDone' }, bc: { aff: '>=25' }, important: true,
      steps: [['go', 'a', 'b'], ['face', 'a', 'b'], ['say', 'a', 'ev_thank3w'], ['say', 'b', 'ev_thank3w_r'], ['anim', 'a', 'happy', 1.2]],
      fx: { flag: 'thankDone', rel: { ab: { aff: 5, trust: 5 }, ba: { aff: 5, trust: 4 } }, emo: { a: ['content', 0.6], b: ['happy', 0.5] }, mem: { both: { type: 'milestone', imp: 0.8, text: '過了幾天，終於跟{other}說了謝謝' } } } },
  ];
  const L = [
    ['ev_thank1', '……要怎麼跟{other}說才好呢。', P], ['ev_thank1', '明明只是一句謝謝而已。', C], ['ev_thank1', '算了，下次再說……不對，這次一定要說。', K],
    ['ev_thank2', '我想好好謝謝{other}，可是每次話到嘴邊就吞回去了。你覺得呢？', P], ['ev_thank2', '欸，你可以聽我說一件事嗎？是關於{other}的。', B], ['ev_thank2', '……我有話想對{other}說，但不知道怎麼開口。', K],
    ['ev_thank2_go', '對，直接說就好了。我試試看。', P], ['ev_thank2_go', '好！我現在就去！', B],
    ['ev_thank2_letter', '寫信……這樣我就不會說不好了。', P], ['ev_thank2_letter', '好主意。我字很醜就是了。', K],
    ['ev_thank2_wait', '嗯，也是。等我準備好。', C], ['ev_thank2_wait', '……謝謝你沒有催我。', K],
    ['ev_thank3', '{other}，那個……一直以來，謝謝你。', P], ['ev_thank3', '我一直想說——有你在真的太好了！', B], ['ev_thank3', '……謝謝。就這樣。', K], ['ev_thank3', '我寫了一封信，可是還是想親口說：謝謝你。', C],
    ['ev_thank3_r', '……突然這樣，我會不好意思啦。也謝謝你。', P], ['ev_thank3_r', '欸欸？我也是！我也很謝謝你！', B], ['ev_thank3_r', '……嗯。我知道。', K],
    ['ev_thank3w', '那個……其實我一直想跟你說謝謝。', P], ['ev_thank3w', '拖了好幾天，但還是想說：謝謝你。', C],
    ['ev_thank3w_r', '原來是這件事。不用謝啦。', P], ['ev_thank3w_r', '……你還記得啊。', K],
  ];
  for (const e of EV) if (!D.EVENTS.some((x) => x.id === e.id)) D.EVENTS.push(e);
  const base = D.LINES.length;
  L.forEach((x, i) => D.LINES.push({ id: 'p15_' + (base + i), cat: x[0], text: x[1], c: x[2] || null, w: 1 }));
})();
