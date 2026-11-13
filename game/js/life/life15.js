/* OC Shimeji — 15.5 inner life and the island's calendar (OC.Life15).
 *   dreams         after a real night's sleep a character may remember a dream, built from its own memories, friends, places, wishes and fears;
 *                  it tells you the next time it is near you (once), and keeps the last 12 (c.life.l15.dreams)
 *   declarations   now and then a character announces a small goal of its own ("these three days I'll catch 3 fish"); it is tracked on the
 *                  one progress stream, paid once if done in time (OC.Quests.grant key decl:<oc>:<made>), remembered either way
 *   fears          one or two fears per character (none for the brave), from its id — rain and thunder, dark nights, heights, deep water,
 *                  crowds, bugs. When one is around it gets nervous; petting it there helps, and three times means the fear is gone
 *   life stages    from the age the player wrote (child → teen → young → adult → elder); on a birthday you may let it turn a year older
 *                  (only when you press the button — the age is your story, never changed by itself)
 *   festivals      weekends of each season are a festival: spring flowers, summer fireworks (at night outdoors), autumn harvest, winter lights;
 *                  each festival day brings one gift (key fest:<id>:<date>) and changes a few real things (harvest +1, more petals, fireworks)
 * Everything runs on the game clock (Sim.onStep / onDay) and the progress stream; offline catch-up gives nothing.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, M = () => OC.Mind, Sim = () => OC.Sim, Ch = () => OC.Chars, P = () => OC.Progress;
  const name = (c) => Ch().name(c);
  const st = (c) => c.life.l15 || (c.life.l15 = { dreams: [], decl: null, declDone: 0, fears: null, told: '' });
  const pick = (a, r) => a[Math.floor(r * a.length) % a.length];
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const here = () => (OC.World && OC.World.area ? OC.World.area.id : 'isle');
  const locOf = (c) => (c.id === S().activeId ? here() : c.life.loc || 'isle');

  // ======================= fears =======================
  const FEARS = {
    thunder: { zh: '打雷的雨天', when: (c) => OC.Clock.weather() === 'rain' && !(OC.Places.get(locOf(c)) || {}).interior },
    dark: { zh: '黑漆漆的夜晚', when: (c) => OC.Clock.phase(OC.Clock.hour()) === 'night' && !(OC.Places.get(locOf(c)) || {}).interior },
    heights: { zh: '高的地方', when: (c) => locOf(c) === 'hill' || (OC.Mini && OC.Mini.wheelRiding && OC.Mini.wheelRiding() && c.id === S().activeId) },
    water: { zh: '深深的海', when: (c) => locOf(c) === 'beach' },
    crowds: { zh: '人很多的地方', when: (c) => locOf(c) === 'fair' || Ch().all().filter((o) => o.status.onIsland && locOf(o) === locOf(c)).length >= 4 },
    bugs: { zh: '蟲子', when: (c) => locOf(c) === 'forest' },
  };
  function fears(c) {
    const s = st(c);
    if (!s.fears) {
      const brave = Ch().has(c, 'brave'), timid = Ch().has(c, 'shy') || Ch().has(c, 'sensitive') || Ch().has(c, 'timid');
      const ids = Object.keys(FEARS), n = brave ? 0 : timid ? 2 : hash(c.id + 'f') < 0.7 ? 1 : 2, out = [];
      for (let k = 0; out.length < n && k < 12; k++) { const f = ids[Math.floor(hash(c.id + 'fear' + k) * ids.length)]; if (!out.some((x) => x.id === f)) out.push({ id: f, lv: 3 }); }
      s.fears = out;
    }
    return s.fears;
  }
  const activeFear = (c) => fears(c).find((f) => f.lv > 0 && FEARS[f.id].when(c));

  // ======================= dreams =======================
  const ANIMALS = ['鯨魚', '小鳥', '貓頭鷹', '海龜', '狐狸'];
  const DREAM = {
    mem: ['夢見{mem}——可是後來大家都慢慢飄了起來。', '夢到{mem}，醒來的時候還在笑。', '又夢到{mem}。夢裡的顏色比真的還要亮。'],
    other: ['夢見和{other}一起坐在很高的雲上，整座島就在腳底下。', '夢到{other}變成了一隻很大的{animal}，載著我去旅行。', '夢見{other}一直在叫我的名字，可是我找不到聲音從哪裡來。'],
    place: ['夢見{place}的地上長滿了會發光的花。', '夢到在{place}迷路了，可是一點都不害怕。', '夢見{place}整個漂到海上去了。'],
    wish: ['夢見{wish}，真的實現了。醒來有點失落。', '在夢裡{wish}了，感覺好真實。'],
    fear: ['夢到{fear}……醒來以後心還在跳。', '做了關於{fear}的噩夢，還好是夢。'],
    odd: ['夢見下了一整晚的糖果雨。', '夢到自己聽得懂魚在說什麼。', '夢見月亮掉進菜園，我們把它種了起來。', '夢到島上所有的椅子都在跳舞。'],
  };
  function makeDream(c, r) {
    const s = st(c), mems = c.life.mem.recent.concat(c.life.mem.long).filter((m) => m.text && m.type !== 'dream').slice(0, 12);
    const friends = Ch().all().filter((o) => o.id !== c.id), places = OC.Places.list().filter((p) => OC.Places.open(p) && S().places.visited[p]);
    const wishes = M().activeWishes ? M().activeWishes(c) : [], f = fears(c).filter((x) => x.lv > 0);
    const kinds = [['odd', 1]].concat(mems.length ? [['mem', 3]] : [], friends.length ? [['other', 2]] : [], places.length ? [['place', 1.5]] : [], wishes.length ? [['wish', 1.5]] : [], f.length ? [['fear', 1]] : []);
    let tot = kinds.reduce((a, k) => a + k[1], 0), x = r * tot, kind = 'odd'; for (const [k, w] of kinds) { if ((x -= w) <= 0) { kind = k; break; } }
    const r2 = hash(c.id + Sim().day() + 'd2');
    let text = pick(DREAM[kind], r2);
    text = text.replace('{mem}', kind === 'mem' ? pick(mems, r2).text.replace(/[。！]$/, '') : '').replace('{other}', kind === 'other' ? name(pick(friends, r2)) : '').replace('{animal}', pick(ANIMALS, r2 * 7 % 1))
      .replace('{place}', kind === 'place' ? OC.Places.get(pick(places, r2)).zh : '').replace('{wish}', kind === 'wish' ? pick(wishes, r2).text : '').replace('{fear}', kind === 'fear' ? FEARS[pick(f, r2).id].zh : '');
    const d = { day: Sim().day(), kind, text, told: false, nightmare: kind === 'fear' };
    s.dreams.unshift(d); if (s.dreams.length > 12) s.dreams.length = 12;
    M().remember(c, { type: 'event', imp: 0.35, text: '做了一個夢：' + text, key: `dream:${c.id}:${d.day}` });
    if (d.nightmare) M().feel(c, 'nervous', 0.3, '做了噩夢'); else M().feel(c, 'content', 0.2, '做了個夢');
    St.touch('life', { id: c.id, dream: true });
    return d;
  }

  // ======================= declarations =======================
  const DECL = [
    { id: 'fish', zh: '要釣到 3 條魚', ev: 'fish', n: 3, t: ['curious', 'diligent', 'nature'] },
    { id: 'cook', zh: '要做 2 道料理', ev: 'cook', n: 2, t: ['foodie', 'diligent'] },
    { id: 'forage', zh: '要採集 4 次', ev: 'forage', n: 4, t: ['nature', 'curious'] },
    { id: 'chat', zh: '要和大家聊 3 次天', ev: 'chat', n: 3, t: ['social', 'outgoing', 'shy'] },
    { id: 'stage', zh: '要上台表演一次', ev: 'concert', n: 1, t: ['outgoing', 'cheerful', 'shy'], ok: () => OC.Places.open('fair') },
    { id: 'job', zh: '要去打工一次', ev: 'job', n: 1, t: ['diligent', 'independent'] },
    { id: 'garden', zh: '要種下 2 樣東西', ev: 'plant', n: 2, t: ['nature', 'diligent'] },
  ];
  function declare(c, force) {
    const s = st(c); if (s.decl && !s.decl.done && !s.decl.failed) return null;
    const list = DECL.filter((d) => !d.ok || d.ok()), r = hash(c.id + Sim().day() + 'decl');
    const weighted = list.map((d) => [d, 1 + d.t.filter((t) => Ch().has(c, t)).length * 2]);
    let x = r * weighted.reduce((a, w) => a + w[1], 0), d = list[0]; for (const [q, w] of weighted) { if ((x -= w) <= 0) { d = q; break; } }
    s.decl = { id: d.id, zh: d.zh, ev: d.ev, n: d.n, prog: 0, made: Sim().now(), until: Sim().now() + 3 * 1440, done: false, failed: false };
    M().remember(c, { type: 'event', imp: 0.45, text: `宣言：這三天${d.zh}！`, key: `declm:${c.id}:${s.decl.made}` });
    OC.UI.toast(`${name(c)}宣言：「這三天${d.zh}！」`, 'flag'); say(c, `決定了。這三天${d.zh}。`);
    St.touch('life', { id: c.id, decl: d.id }); void force;
    return s.decl;
  }
  function onProgress(d) {
    for (const c of Ch().all()) {
      const s = c.life.l15; if (!s || !s.decl || s.decl.done || s.decl.failed) continue; const q = s.decl;
      const mine = d.oc === c.id || (Array.isArray(d.ocs) && d.ocs.includes(c.id)) || (q.ev === 'chat' && d.other === c.id);
      if (d.ev !== q.ev || !mine) continue;
      q.prog = Math.min(q.n, q.prog + Math.max(1, d.count || 1));
      if (q.prog >= q.n) {
        q.done = true; s.declDone = (s.declDone || 0) + 1;
        const r = OC.Quests.grant(`decl:${c.id}:${q.made}`, { coins: 50 + q.n * 20 }, `${name(c)}完成宣言：${q.zh}`);
        M().feel(c, 'proud', 0.7, '做到了宣言'); M().remember(c, { type: 'milestone', imp: 0.7, text: `說到做到：${q.zh}`, key: `decld:${c.id}:${q.made}` });
        OC.UI.toast(`${name(c)}做到了宣言「${q.zh}」${r.ok ? `　+${50 + q.n * 20} 星幣` : ''}`, 'trophy'); say(c, '說到做到。');
        P().emit('declare', { oc: c.id, id: q.id });
      }
      St.touch('life', { id: c.id });
    }
  }

  // ======================= life stages =======================
  const STAGES = [[0, 'child', '童年'], [13, 'teen', '少年'], [18, 'young', '青年'], [30, 'adult', '成年'], [60, 'elder', '長者']];
  function stage(c) { const a = parseInt(String(c.profile.age || '').replace(/[^\d]/g, ''), 10); if (!(a >= 0 && a < 1000)) return null; let s = STAGES[0]; for (const x of STAGES) if (a >= x[0]) s = x; return { age: a, id: s[1], zh: s[2] }; }
  /** the player's choice on a birthday: one year older (once per year; key age:<oc>:<year>) */
  function growUp(c) {
    const s0 = stage(c); if (!s0) return { ok: false, why: '還沒有寫年齡' };
    const y = new Date().getFullYear(), k = `age:${c.id}:${y}`; const done = (S().play.aged = S().play.aged || {}); if (done[k]) return { ok: false, why: '今年已經長大過了' };
    c.profile.age = String(s0.age + 1); done[k] = Date.now(); Ch().save(c); const s1 = stage(c);
    M().remember(c, { type: 'milestone', imp: 0.8, text: `${s1.age} 歲了${s1.id !== s0.id ? `，進入${s1.zh}` : ''}`, key: k });
    return { ok: true, from: s0, to: s1 };
  }

  // ======================= festivals =======================
  const FEST = {
    spring: { id: 'flowers', zh: '花之祭', d: '花瓣飄得比平常多，大家都會想去花圃看看。', gift: 'fest_petal' },
    summer: { id: 'fireworks', zh: '夏夜煙火', d: '晚上在戶外抬頭看，會有煙火。', gift: 'fest_sparkler' },
    autumn: { id: 'harvest', zh: '豐收祭', d: '今天收成多一個。', gift: 'fest_pie' },
    winter: { id: 'lights', zh: '燈之祭', d: '島上的燈更亮、更早點起來。', gift: 'fest_cocoa' },
  };
  /** today's festival (weekends: Saturday and Sunday) or null */
  let festMemo = null;
  /** a festival on a date: weekends of each season. Called with no date = today, where ?fest=1 / the chosen season (settings, ?season=) apply;
   *  with a date = the calendar only (month → season, Saturday / Sunday) */
  function festival(d) {
    if (!d) { const k = Math.floor(Date.now() / 30000); if (festMemo && festMemo.k === k) return festMemo.v; const now = new Date(); let force = false; try { force = new URLSearchParams(location.search).get('fest') === '1'; } catch (e) { /* no location */ }
      const w0 = now.getDay(), v = (w0 === 0 || w0 === 6 || force) ? Object.assign({ season: (OC.World && OC.World.season) || OC.Clock.season(now), date: OC.Clock.dayKey(now) }, FEST[(OC.World && OC.World.season) || OC.Clock.season(now)]) : null; festMemo = { k, v }; return v; }
    const w = d.getDay(); if (w !== 0 && w !== 6) return null; const m = d.getMonth() + 1, se = m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
    return Object.assign({ season: se, date: OC.Clock.dayKey(d) }, FEST[se]); }
  function festGift() {
    const f = festival(); if (!f) return null; const k = `fest:${f.id}:${f.date}`;
    if (S().ledger && S().ledger.keys && S().ledger.keys[k]) return null;
    const r = OC.Tx.run(k, { get: { items: { [f.gift]: 1 } } }, `${f.zh}的禮物`); if (!r.ok) return null;
    OC.UI.toast(`今天是${f.zh}！收到了「${OC.Style.ITEMS[f.gift].zh}」`, 'gift'); P().emit('festival', { id: f.id }); return f;
  }

  // ======================= speech in the world =======================
  function say(c, text) { const a = OC.App && OC.App.actorOf && OC.App.actorOf(c.id); if (a && !a.hidden && OC.App.bubble && S().life.settings.bubbles !== false) OC.App.bubble(a, Ch().speak(c, text, { cat: 'l15' }), name(c), 3.2); }

  // ======================= the clock =======================
  let lastHour = -1;
  function step() {
    if (Sim().catching) return;
    const now = Sim().now(), hourKey = Math.floor(now / 30);   /* every 30 game minutes */
    if (hourKey === lastHour) return; lastHour = hourKey;
    for (const c of Ch().all()) {
      if (!c.status.onIsland) continue; const s = st(c);
      /* tell last night's dream once, when it is near you and awake */
      const d0 = s.dreams[0], a = OC.App && OC.App.actorOf && OC.App.actorOf(c.id), b = OC.Brain.get(c.id);
      if (d0 && !d0.told && a && !a.hidden && b && !(b.st === 'do' && b.act === 'sleep')) { d0.told = true; say(c, d0.nightmare ? `我做了噩夢……${d0.text}` : `跟你說，昨晚${d0.text}`); }
      /* fears */
      const f = activeFear(c);
      if (f && (s.fearAt || 0) < now - 120) { s.fearAt = now; s.fearNow = f.id; M().feel(c, 'nervous', 0.12 * f.lv, '怕' + FEARS[f.id].zh); say(c, pick(['……這裡讓我有點不安。', `我不太喜歡${FEARS[f.id].zh}。`, '可以在旁邊陪我一下嗎？'], hash(c.id + now))); }
      else if (!f) s.fearNow = null;
      /* declarations run out */
      if (s.decl && !s.decl.done && !s.decl.failed && now > s.decl.until) { s.decl.failed = true; M().feel(c, 'down', 0.25, '宣言沒做到'); M().remember(c, { type: 'event', imp: 0.4, text: `沒能做到宣言：${s.decl.zh}。下次再來。`, key: `declf:${c.id}:${s.decl.made}` }); }
    }
  }
  function onDay() {
    if (Sim().catching) return;
    for (const c of Ch().all()) {
      if (!c.status.onIsland) continue; const s = st(c), drive = 0.18 + (Ch().has(c, 'diligent') ? 0.15 : 0) + (Ch().has(c, 'competitive') ? 0.15 : 0) + (Ch().has(c, 'lazy') ? -0.1 : 0);
      if ((!s.decl || s.decl.done || s.decl.failed) && hash(c.id + Sim().day() + 'dd') < drive) declare(c);
    }
    festGift();
  }
  /** a night's sleep (60+ game minutes) → maybe a dream (most nights, fewer for heavy sleepers) */
  function onAct(d) {
    if (d.ev === 'act' && d.act === 'sleep' && d.min >= 60) { const c = Ch().get(d.oc); if (c && hash(c.id + Sim().day() + 'dream') < 0.75) makeDream(c, hash(c.id + Sim().day() + 'k')); }
    /* petting a scared character where its fear is: the fear gets smaller; three times and it is gone */
    if ((d.ev === 'pet' || d.ev === 'hug') && d.oc) { const c = Ch().get(d.oc); if (!c) return; const s = st(c), f = s.fearNow && fears(c).find((x) => x.id === s.fearNow && x.lv > 0);
      if (f && (s.calmAt || 0) < Sim().now() - 30) { s.calmAt = Sim().now(); f.lv--; M().feel(c, 'calm', 0.4, '被安慰了'); if (f.lv <= 0) { M().feel(c, 'proud', 0.6, '不再害怕'); M().remember(c, { type: 'milestone', imp: 0.85, text: `因為有你陪著，不再怕${FEARS[f.id].zh}了`, key: `fear:${c.id}:${f.id}` }); OC.UI.toast(`${name(c)}不再怕${FEARS[f.id].zh}了`, 'heart'); P().emit('fearless', { oc: c.id, fear: f.id }); } St.touch('life', { id: c.id }); } }
    onProgress(d);
  }

  /** the harvest bonus on festival days (used by OC.Places.harvest) */
  const harvestBonus = () => (festival() && festival().id === 'harvest' ? 1 : 0);
  function init() { Sim().onStep(step); Sim().onDay(onDay); P().on(onAct); setTimeout(() => { if (!Sim().catching) festGift(); }, 5000); }
  OC.Life15 = { tickNow: () => { lastHour = -1; step(); }, FEARS, DREAM, DECL, STAGES, FEST, fears, activeFear, makeDream, declare, stage, growUp, festival, festGift, harvestBonus, st, init };
})();
