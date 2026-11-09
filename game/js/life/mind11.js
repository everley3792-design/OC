/* OC Shimeji 11.0 — OC.Mind11: planning, daily goals, knowing each other, and "why am I doing this".
 *
 * The 4.0 Utility AI picks the best single activity. This layer sits on top of it (brain.js calls shape() / onFinish() / onSocial()):
 *   plans    multi-step intentions from data (PLANS): "rainy day: read → rest → cook → eat", "cheer up a sad friend: bring food → chat",
 *            "make amends", "garden day"… A plan is adopted only when it beats the best single act, keeps its next step boosted, is
 *            dropped (with a logged reason) when a need becomes urgent / the step is impossible / it is interrupted for long, and
 *            gives a small pride when completed. Plans never override needs: urgent needs, sleeping time and player commands win.
 *   goals    1–2 personal goals each morning from personality, wishes, mood, relationships (read a book · see a friend · tend plants…)
 *            that gently bias scores while open; finished goals leave memories. Autonomous only — they never grant rewards.
 *   know     what each OC has observed about the others (mood, favourite activity, who is sad): used to pick whom to comfort, what a
 *            friend might like, what to say ("我記得你喜歡…"). Observation is local (same place, nearby) and cheap.
 *   diary    each night a one-line summary becomes a memory.
 *   explain  OC.Mind11.explain(c) → what it intends, the plan, goals, top candidates and why (the "想法" sheet).
 * Everything is simulation-clock based (OC.Sim minutes); nothing here runs in offline catch-up.
 */
(function () {
  'use strict';
  const M = () => OC.Mind, B = () => OC.Brain, D = () => OC.LifeData, Sim = () => OC.Sim, Ch = () => OC.Chars;
  const has = (c, t) => Ch().has(c, t);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const nm = (c) => (c ? Ch().name(c) : '');

  /** per-OC state (saved with the character; small) */
  function st(c) {
    const L = c.life; if (!L.m11) L.m11 = { goals: [], know: {}, today: { acts: {}, plans: [], goals: [], social: [] }, goalDay: -1, planStats: {}, done: 0 };
    return L.m11;
  }

  // ------------------------------------------------------------------ plans (data)
  /** when(ctx) → 0..1.6 desire (0 = not applicable). steps: { act } | { social: kind, who: 'sad' | 'fav' | 'conflict' | 'any' } */
  const PLANS = [
    { id: 'rainyCozy', zh: '雨天窩著', why: '下雨了，想待在室內', steps: [{ act: 'read' }, { act: 'rest' }, { act: 'cook' }, { act: 'eat' }],
      when: (x) => (x.wx === 'rain' ? 0.75 + (x.has('bookworm') ? 0.35 : 0) + (x.has('lazy') ? 0.15 : 0) : 0) },
    { id: 'gardenDay', zh: '園藝日', why: '天氣不錯，來照顧植物', steps: [{ act: 'tend' }, { act: 'tend' }, { act: 'eat' }],
      when: (x) => (x.wx !== 'rain' && x.phase !== 'night' ? 0.5 + (x.has('nature') ? 0.45 : 0) + (x.has('diligent') ? 0.2 : 0) + x.wish('tend_n') * 0.5 : 0) },
    { id: 'morningWalk', zh: '晨間活動', why: '早上精神好，先動一動', steps: [{ act: 'stretch' }, { act: 'walk' }, { act: 'eat' }],
      when: (x) => (x.phase === 'morning' ? 0.55 + (x.early ? 0.4 : 0) + (x.has('energetic') ? 0.25 : 0) : 0) },
    { id: 'nightRead', zh: '睡前讀書', why: '睡前想安靜地讀一點', steps: [{ act: 'read' }, { act: 'daydream' }],
      when: (x) => (x.phase === 'night' && x.sleepy && x.needs.sleep > 25 ? 0.5 + (x.has('bookworm') ? 0.5 : 0) : 0) },
    { id: 'starNight', zh: '夜晚看星星', why: '夜空很晴朗', steps: [{ act: 'walk' }, { act: 'observe' }, { act: 'daydream' }],
      when: (x) => (x.phase === 'night' && x.wx === 'clear' ? 0.45 + (x.has('nightowl') ? 0.4 : 0) + (x.has('curious') ? 0.15 : 0) + x.wish('stars') * 0.6 : 0) },
    { id: 'selfCare', zh: '好好照顧自己', why: '有點累了，趁還沒撐不住先休息', steps: [{ act: 'rest' }, { act: 'eat' }, { act: 'nap' }],
      when: (x) => (x.needs.energy < 52 || x.needs.food < 48 ? 0.5 + (60 - Math.min(x.needs.energy, x.needs.food)) / 60 : 0) },
    { id: 'explorerDay', zh: '探險日', why: '好想去沒去過的地方', steps: [{ act: 'explore' }, { act: 'forage' }, { act: 'read' }],
      when: (x) => (x.wx !== 'rain' && x.phase !== 'night' ? 0.3 + (x.has('curious') ? 0.55 : 0) + x.needs.def('interest') * 0.5 + x.wish('explore') * 0.5 : 0) },
    { id: 'tidyHome', zh: '大掃除', why: '整理一下環境心情會好', steps: [{ act: 'tidy' }, { act: 'tidy' }, { act: 'rest' }],
      when: (x) => 0.2 + (x.has('tidy') ? 0.65 : 0) + (x.has('diligent') ? 0.25 : 0) + x.needs.def('comfort') * 0.4 },
    { id: 'fishAndCook', zh: '釣魚做魚料理', why: '想釣條魚回來煮', steps: [{ act: 'fish' }, { act: 'cook' }, { act: 'eat' }],
      when: (x) => (x.wx !== 'rain' && x.phase !== 'night' ? 0.3 + x.skill('fishing') * 0.05 + x.needs.def('food') * 0.5 : 0) },
    { id: 'shopCook', zh: '買菜回家煮', why: '想自己煮點好吃的', steps: [{ act: 'browse' }, { act: 'cook' }, { act: 'eat' }],
      when: (x) => (x.phase !== 'night' ? 0.25 + (x.has('foodie') ? 0.5 : 0) + x.needs.def('food') * 0.4 : 0) },
    { id: 'makeAmends', zh: '去和好', why: '一直惦記著那件事', steps: [{ social: 'apologize', who: 'conflict' }, { act: 'rest' }],
      when: (x) => (x.conflictWith ? 0.9 + x.conflictWith.r.conflict / 150 + (x.has('gentle') ? 0.3 : 0) - (x.has('stubborn') ? 0.4 : 0) : 0) },
    { id: 'cheerFriend', zh: '去陪低落的朋友', why: '聽說朋友心情不太好', steps: [{ social: 'food', who: 'sad' }, { social: 'comfort', who: 'sad' }],
      when: (x) => (x.sadFriend ? 0.8 + (x.has('gentle') ? 0.4 : 0) + x.sadFriend.r.aff / 200 : 0) },
    { id: 'meetFriend', zh: '找好朋友玩', why: '好久沒和朋友相處了', steps: [{ social: 'playTogether', who: 'fav' }, { act: 'eat' }],
      when: (x) => (x.phase !== 'night' && x.wx !== 'rain' && x.favFriend && x.needs.def('social') > 0.3 ? 0.4 + x.needs.def('social') * 0.7 + (x.has('outgoing') ? 0.3 : 0) : 0) },
    { id: 'giftFriend', zh: '送朋友小禮物', why: '想讓朋友開心一下', steps: [{ act: 'forage' }, { social: 'gift', who: 'fav' }],
      when: (x) => (x.favFriend && x.favFriend.r.aff >= 40 && x.giftReady ? 0.55 + (x.has('gentle') ? 0.2 : 0) : 0) },
  ];

  // ------------------------------------------------------------------ goals (data)
  const GOALS = [
    { id: 'readBook', zh: '今天想讀點書', n: 2, acts: ['read', 'study'], when: (x) => 0.3 + (x.has('bookworm') ? 0.6 : 0) + x.wish('read_n') * 0.5 },
    { id: 'tendPlants', zh: '想好好照顧植物', n: 2, acts: ['tend'], when: (x) => 0.2 + (x.has('nature') ? 0.5 : 0) + (x.has('diligent') ? 0.2 : 0) + x.wish('tend_n') * 0.5 },
    { id: 'moveBody', zh: '想動一動身體', n: 2, acts: ['walk', 'play', 'stretch', 'explore'], when: (x) => 0.2 + (x.has('energetic') ? 0.5 : 0) + x.needs.def('active') * 0.6 },
    { id: 'restWell', zh: '今天要好好休息', n: 2, acts: ['rest', 'nap', 'daydream'], when: (x) => 0.1 + (x.has('lazy') ? 0.5 : 0) + x.needs.def('energy') * 0.8 },
    { id: 'treatSelf', zh: '想吃點好吃的', n: 1, acts: ['eat', 'cook', 'drink'], when: (x) => 0.2 + (x.has('foodie') ? 0.7 : 0) + x.needs.def('food') * 0.4 },
    { id: 'tryNew', zh: '想試試沒做過的事', n: 1, acts: ['explore', 'forage', 'fish', 'browse'], when: (x) => 0.15 + (x.has('curious') ? 0.6 : 0) + x.needs.def('interest') * 0.5 },
    { id: 'seeFriend', zh: '想和{other}多聊聊', n: 1, social: true, when: (x) => (x.favFriend ? 0.2 + x.needs.def('social') * 0.7 + (x.has('outgoing') ? 0.3 : 0) : 0) },
    { id: 'makeUpGoal', zh: '想和{other}和好', n: 1, social: 'apologize', when: (x) => (x.conflictWith ? 0.9 + x.conflictWith.r.conflict / 120 : 0) },
  ];

  // ------------------------------------------------------------------ context (cheap snapshot used by the data above)
  function ctxOf(c, b) {
    const k = st(c), needs = c.needs, h = OC.Clock.hour(), wishes = M().activeWishes(c);
    const ctx = {
      c, b, wx: OC.Clock.weather(), phase: OC.Clock.phase(h), hour: h, needs: Object.assign(Object.create({ def: (id) => clamp((100 - c.needs[id]) / 100) }), needs),
      has: (t) => has(c, t), early: !!M().routine(c).early, sleepy: M().sleepTime(c, h), skill: (id) => Math.min(10, Math.floor(Math.sqrt(((c.life.skills || {})[id] || 0) / 15))),
      wish: (type) => (wishes.some((w) => w.type === type) ? 1 : 0), favFriend: null, sadFriend: null, conflictWith: null, giftReady: !c.life.giftAt || Sim().now() - c.life.giftAt > 1440,
    };
    const others = Ch().all().filter((o) => o.id !== c.id && B().get(o.id) && B().get(o.id).a);
    let bestAff = -1; for (const o of others) {
      const r = M().rel(c.id, o.id), kn = k.know[o.id];
      if (r.aff > bestAff && r.aff >= 20) { bestAff = r.aff; ctx.favFriend = { o, r }; }
      if (r.conflict >= 20 && (!ctx.conflictWith || r.conflict > ctx.conflictWith.r.conflict)) ctx.conflictWith = { o, r };
      if (kn && kn.mood && ['down', 'lonely', 'tired', 'annoyed'].includes(kn.mood) && Sim().now() - (kn.moodAt || 0) < 360 && r.aff >= 15 && (!ctx.sadFriend || r.aff > ctx.sadFriend.r.aff)) ctx.sadFriend = { o, r };
    }
    return ctx;
  }
  const targetOf = (ctx, who) => (who === 'sad' ? ctx.sadFriend : who === 'conflict' ? ctx.conflictWith : who === 'fav' ? ctx.favFriend : ctx.favFriend) && (who === 'sad' ? ctx.sadFriend : who === 'conflict' ? ctx.conflictWith : ctx.favFriend).o;

  // ------------------------------------------------------------------ shaping the decision (called from brain.decide)
  /** boost / inject according to the current plan, goals and knowledge; may adopt a new plan. list is re-sorted. */
  function shape(c, b, list) {
    if (!c || !b || b.queued || OC.Brain.manualMode(b)) return list;
    const k = st(c), s = OC.Store.s.life.settings; if (s.autonomy === 'paused' || s.autonomy === 'restricted') return list;
    const ctx = ctxOf(c, b); ensureGoals(c, ctx);
    const urgent = M().urgent(c);
    if (urgent && b.plan) drop(c, b, `${urgent === 'food' ? '肚子太餓' : urgent === 'sleep' ? '太睏' : '需要休息'}，先顧好自己`);
    // 1) follow the current plan
    if (b.plan) {
      const step = b.plan.steps[b.plan.i];
      if (!step || Sim().now() > b.plan.until) drop(c, b, '時間到了');
      else {
        const match = list.filter((x) => (step.act && x.kind === 'act' && x.act === step.act) || (step.social && x.kind === 'social' && x.social === step.social && (!b.plan.target || x.other === b.plan.target)));
        if (!match.length && b.plan.miss++ >= 1) drop(c, b, step.act ? `沒辦法${D().ACTS[step.act].zh}` : '找不到人');
        else for (const x of match) { x.s += 1.7; x.why.unshift(`計畫「${b.plan.zh}」第${b.plan.i + 1}步`); }
      }
    }
    // 2) maybe adopt a plan (not while urgent, not too often)
    if (!b.plan && !urgent && Sim().now() - (k.lastPlanAt || -1e9) > 40 && list.length) {
      const best = list[0].s, cands = [];
      for (const P of PLANS) {
        const d = P.when(ctx); if (d <= 0.2) continue;
        const first = P.steps[0], target = first.social ? targetOf(ctx, first.who) : null;
        if (first.social && !target) continue;
        const ok = first.act ? list.find((x) => x.kind === 'act' && x.act === first.act) : list.find((x) => x.kind === 'social' && x.social === first.social && x.other === target.id);
        if (!ok && !first.social) continue;                                    // the first step must be possible right now
        const val = d - (k.planStats[P.id] && Sim().now() - k.planStats[P.id] < 360 ? 0.5 : 0) + Sim().rnd() * 0.25;
        cands.push({ P, val, target });
      }
      cands.sort((x, y) => y.val - x.val); const top = cands[0];
      if (top && top.val > 0.75 + Math.max(0, best) * 0.35) {
        const P = top.P; b.plan = { id: P.id, zh: P.zh, why: P.why, steps: P.steps, i: 0, until: Sim().now() + 360, miss: 0, target: top.target && top.target.id };
        k.lastPlanAt = Sim().now(); k.planStats[P.id] = Sim().now();
        B().dlog && B().dlog(b, `想法：${P.why} → 計畫「${P.zh}」（${P.steps.map((x) => (x.act ? D().ACTS[x.act].zh : D().SOCIAL[x.social].zh)).join(' → ')}）`);
        const first = P.steps[0];
        for (const x of list) if ((first.act && x.kind === 'act' && x.act === first.act) || (first.social && x.kind === 'social' && x.social === first.social && x.other === top.target.id)) { x.s += 1.7; x.why.unshift(`計畫「${P.zh}」第1步`); }
      }
    }
    // 3) open goals: a gentle pull toward matching activities / people
    for (const g of k.goals) {
      if (g.done || g.day !== Sim().day()) continue;
      for (const x of list) {
        if (g.acts && x.kind === 'act' && g.acts.includes(x.act)) { x.s += 0.32; x.why.push(`目標：${g.zh}`); }
        if (g.social && x.kind === 'social' && (g.other ? x.other === g.other : true) && (g.social === true || g.social === x.social)) { x.s += 0.4; x.why.push(`目標：${g.zh}`); }
      }
    }
    // 4) knowledge: invite people to what they like, and look after those known to be down
    for (const x of list) {
      if (x.kind !== 'social') continue; const kn = k.know[x.other]; if (!kn) continue;
      const ofav = favAct(kn);
      if (['playTogether', 'restTogether', 'stargaze'].includes(x.social)) { const j = D().SOCIAL[x.social].joint; if (ofav && ofav === j) { x.s += 0.22; x.why.push(`記得${nm(Ch().get(x.other))}喜歡${D().ACTS[j].zh}`); } }
      if (x.social === 'comfort' && kn.mood && ['down', 'lonely', 'tired', 'annoyed'].includes(kn.mood) && Sim().now() - (kn.moodAt || 0) < 360) { x.s += 0.25; x.why.push('剛才看到對方心情不好'); }
    }
    return list.sort((x, y) => y.s - x.s);
  }
  function drop(c, b, why) { if (!b.plan) return; B().dlog && B().dlog(b, `放棄計畫「${b.plan.zh}」：${why}`); st(c).today.plans.push({ id: b.plan.id, zh: b.plan.zh, ok: false }); b.plan = null; }

  /** an activity finished (called from brain.finish) */
  function onFinish(b, act, why, gm) {
    const c = Ch().get(b.id); if (!c) return; const k = st(c);
    k.today.acts[act] = (k.today.acts[act] || 0) + 1;
    // goals
    for (const g of k.goals) if (!g.done && g.day === Sim().day() && g.acts && g.acts.includes(act) && (gm > 3 || why === 'done')) progress(c, b, g);
    // plan
    if (b.plan) {
      const step = b.plan.steps[b.plan.i];
      if (step && step.act === act && (why === 'done' || gm > 4)) advance(c, b);
      else if (!why.startsWith('急需') && step && step.act !== act) { /* unrelated interruption: keep the plan for now */ }
      else if (why.startsWith('急需')) drop(c, b, '先處理急事');
    }
  }
  function advance(c, b) {
    b.plan.i++; b.plan.miss = 0;
    if (b.plan.i >= b.plan.steps.length) {
      const P = b.plan; st(c).today.plans.push({ id: P.id, zh: P.zh, ok: true }); st(c).done++;
      M().feel(c, 'content', 0.3, `照著計畫「${P.zh}」過了一段時光`);
      if (Sim().rnd() < 0.35) M().remember(c, { type: 'activity', imp: 0.3, text: `完成了「${P.zh}」`, key: 'plan:' + P.id + ':' + Sim().day() });
      B().dlog && B().dlog(b, `完成計畫「${P.zh}」`); b.plan = null;
    }
  }
  /** a conversation finished (called from Social.resolve) */
  function onSocial(A, Bc, kind, ok) {
    for (const [x, y] of [[A, Bc], [Bc, A]]) {
      const k = st(x); k.today.social.push({ other: y.id, kind });
      for (const g of k.goals) if (!g.done && g.day === Sim().day() && g.social && (g.social === true || g.social === kind) && (!g.other || g.other === y.id)) progress(x, B().get(x.id), g);
      learn(x, y, { talked: true });
    }
    const bA = B().get(A.id);
    if (bA && bA.plan) { const step = bA.plan.steps[bA.plan.i]; if (step && step.social === kind) advance(A, bA); }
  }
  function progress(c, b, g) {
    g.prog++; if (g.prog < g.n) return; g.done = true; st(c).today.goals.push(g.zh);
    M().feel(c, 'proud', 0.4, `做到了：${g.zh.replace('{other}', g.otherName || '')}`);
    M().remember(c, { type: 'activity', imp: 0.4, text: `完成了今天的小目標：${g.zh.replace('{other}', g.otherName || '')}`, key: 'goal:' + g.id + ':' + g.day });
    M().needs(c, { fun: 6 }); if (b && b.a && OC.App && OC.App.bubble && OC.Store.s.life.settings.bubbles) { const ln = OC.Talk.say('goal_done', c, null); if (ln) OC.App.bubble(b.a, ln.text, nm(c)); }
  }

  // ------------------------------------------------------------------ daily goals
  function ensureGoals(c, ctx) {
    const k = st(c), day = Sim().day(); if (k.goalDay === day) return; k.goalDay = day;
    k.goals = k.goals.filter((g) => g.day === day);   // yesterday's are gone (no guilt)
    const cand = GOALS.map((G) => ({ G, v: G.when(ctx) + Sim().rnd() * 0.3 })).filter((x) => x.v > 0.35).sort((a, b) => b.v - a.v);
    for (const { G } of cand.slice(0, 2)) {
      const g = { id: G.id, zh: G.zh, n: G.n, prog: 0, day, done: false, acts: G.acts || null, social: G.social || null };
      if (G.social) { const o = G.id === 'makeUpGoal' ? ctx.conflictWith && ctx.conflictWith.o : ctx.favFriend && ctx.favFriend.o; if (!o) continue; g.other = o.id; g.otherName = nm(o); g.zh = G.zh.replace('{other}', nm(o)); }
      k.goals.push(g);
    }
  }

  // ------------------------------------------------------------------ knowing each other
  const favAct = (kn) => { let best = null, n = 0; for (const [a, v] of Object.entries(kn.acts || {})) if (v > n) { n = v; best = a; } return n >= 3 ? best : null; };
  function learn(c, o, o2) {
    const k = st(c), kn = k.know[o.id] || (k.know[o.id] = { acts: {}, mood: null, moodAt: 0, seen: 0, talked: 0 });
    kn.seen = Sim().now(); if (o2 && o2.talked) kn.talked++;
    const bo = B().get(o.id); if (bo && bo.a) {
      if (bo.st === 'do' && bo.act && !['sleep'].includes(bo.act)) { kn.acts[bo.act] = (kn.acts[bo.act] || 0) + 1; kn.lastAct = bo.act; }
      const e = M().dominant(o); if (e && M().intensity(o, e) > 0.25) { kn.mood = e; kn.moodAt = Sim().now(); }
    }
  }
  let obsT = 0;
  /** called every frame by the app loop (cheap; real-time sampling, never during catch-up) */
  function update(dt) {
    obsT -= dt; if (obsT > 0) return; obsT = 5 + Math.random() * 2;
    const bs = Object.values(B().brains).filter((b) => b.a && !b.a.hidden);
    for (const b of bs) for (const o of bs) { if (b === o) continue; if (Math.hypot(b.a.x - o.a.x, b.a.y - o.a.y) > 190) continue; const c = Ch().get(b.id), oc = Ch().get(o.id); if (c && oc) learn(c, oc); }
  }

  // ------------------------------------------------------------------ the day boundary: diary
  function onDay() {
    for (const c of Ch().all()) {
      const k = st(c), T = k.today, acts = Object.entries(T.acts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([a]) => D().ACTS[a] && D().ACTS[a].zh).filter(Boolean);
      const bits = []; if (acts.length) bits.push(acts.join('、')); const soc = T.social.filter((s) => s.kind !== 'greet'); if (soc.length) { const o = Ch().get(soc[soc.length - 1].other); if (o) bits.push(`和${nm(o)}${D().SOCIAL[soc[soc.length - 1].kind].zh}`); }
      const pl = T.plans.filter((p) => p.ok).map((p) => `完成了「${p.zh}」`); if (pl.length) bits.push(pl[0]); if (T.goals.length) bits.push(`做到了「${T.goals[0].replace('{other}', '')}」`);
      if (bits.length >= 2) M().remember(c, { type: 'activity', imp: 0.25, text: '昨天：' + bits.join('，') + '。', key: 'diary:' + (Sim().day() - 1) });
      k.today = { acts: {}, plans: [], goals: [], social: [] };
    }
  }

  // ------------------------------------------------------------------ the "想法" sheet data
  function explain(c) {
    const b = B().get(c.id), k = st(c), now = Sim().now();
    const emo = (c.life.emo.list || []).filter((x) => !x.need).slice(0, 4).map((x) => ({ zh: D().EMOTIONS[x.id] ? D().EMOTIONS[x.id].zh : x.id, why: x.cause || '' }));
    const know = Object.entries(k.know).map(([id, kn]) => { const o = Ch().get(id); if (!o) return null; const fav = favAct(kn); return { name: nm(o), mood: kn.mood && Sim().now() - kn.moodAt < 600 ? D().EMOTIONS[kn.mood].zh : null, fav: fav ? D().ACTS[fav].zh : null, talked: kn.talked }; }).filter(Boolean);
    return {
      reason: b && b.dbg && b.dbg.reason || '', plan: b && b.plan ? { zh: b.plan.zh, why: b.plan.why, i: b.plan.i, steps: b.plan.steps.map((s) => (s.act ? D().ACTS[s.act].zh : D().SOCIAL[s.social].zh)) } : null,
      goals: k.goals.filter((g) => g.day === Sim().day()).map((g) => ({ zh: g.zh, prog: g.prog, n: g.n, done: g.done })),
      cands: (b && b.dbg && b.dbg.cands || []).slice(0, 5), moods: emo, know, done: k.done, now,
    };
  }

  OC.Mind11 = { shape, onFinish, onSocial, update, onDay, explain, st, PLANS, GOALS, learn, favAct };
})();
