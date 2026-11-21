/* OC Shimeji 16.11 — health, illness, the end of a life, and bad relationships (OC.Health16, OC.Feud16)
 *
 *   illness     c.life.h16.conds: { id, since, until, cause, chronic? }. Causes are real things that happened: standing in the rain,
 *               nights without sleep, food that lay on the ground too long, eating three times in two hours, being thrown hard
 *               (touch:land strong), working without rest, catching a cold from someone close by. Elders may get a chronic ache.
 *               The cause is rolled once from a fixed key (no re-rolling). Effects: a slow drain on needs, the Utility AI prefers
 *               rest and skips running about (Brain.decide → shape), friends who care come to look after them, work / school is
 *               skipped (a sick day, not a missed day). Recovery is time — faster while resting — or medicine (OC.Use → eat / gift →
 *               the Progress stream → treat()). Medicine is bought (晴日雜貨攤), never given for free.
 *   life        c.life.h16.mode: 'nodeath' (default: can fall ill, never dies) · 'natural' · 'immortal' (never ill, never dies).
 *               Only when Settings › 生活 › 「壽命與告別」 (settings.death16, default off) is on AND the character is 'natural', an
 *               elder past their life length (species span × 82 years, ± a few, written by the player's own age setting) enters a
 *               twilight: a letter, more rest, wanting to see friends. Seven game days later comes the farewell (OC.Theatre), a
 *               keepsake, the friends grieve for a week. Everything is revocable: switching the mode / the setting ends the twilight;
 *               a character who passed can be brought back from the memorial (the 健康 app). The last character never passes.
 *   feuds       OC.Arcs already has the cold war → thaw → making up / drifting apart, avoidance, refusals (Will: 「還在冷戰」),
 *               mediation by a friend and by the player, apologies. 16.11 adds: why it started (the cause), talking behind someone's
 *               back (to a friend, who may believe it — or think less of the one talking), gifts that soften it, and a 「關係」 view in
 *               the 健康 app where the player can help (let them talk, ask one to apologise, ask a friend to step in).
 * Nothing here gives coins; items only through OC.Tx (the keepsake, key keep16:<id>). Pairs the player fixed are not changed by gossip.
 */
(function () {
  'use strict';
  const M = () => OC.Mind, Sim = () => OC.Sim, B = () => OC.Brain, Ch = () => OC.Chars, S = () => OC.Store.s, St = () => OC.Store, D = () => OC.LifeData;
  const has = (c, t) => !!(c && c.personality.traits.includes(t));
  const any = (c, ts) => ts.some((t) => has(c, t));
  const name = (c) => Ch().name(c);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const hs = (k) => { let x = 2166136261; for (const ch of String(k)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return ((x >>> 0) % 100000) / 100000; };
  const set = () => S().life.settings;
  const H = (c) => { const l = c.life; if (!l.h16) l.h16 = { conds: [], mode: 'nodeath', exp: {}, imm: {}, hist: [] }; const h = l.h16; h.exp = h.exp || {}; h.imm = h.imm || {}; h.hist = h.hist || []; h.conds = h.conds || []; return h; };
  const notice = (text) => { if (OC.LifeUI && OC.LifeUI.pushNotice) OC.LifeUI.pushNotice({ info: true, text }); };

  // ================================================================ illness
  /* drain: per game minute · rest: how much more it wants to rest · active: how much less it wants to run about · home: stays away from work / school */
  const CONDS = {
    cold: { zh: '感冒', ic: '🤧', dur: [1440, 2880], drain: { energy: -0.035, fun: -0.02 }, rest: 1.7, active: 0.45, social: 0.85, emo: 'down', med: ['coldmed16', 'gingertea16'], spread: true, home: true, d: '打噴嚏、沒什麼力氣。' },
    fever: { zh: '發燒', ic: '🌡', dur: [600, 1200], drain: { energy: -0.07, comfort: -0.05 }, rest: 2.6, active: 0.12, social: 0.5, emo: 'down', med: ['coldmed16'], home: true, d: '感冒沒休息好，燒起來了。' },
    tummy: { zh: '肚子痛', ic: '😣', dur: [240, 600], drain: { comfort: -0.07 }, rest: 1.6, active: 0.4, social: 0.8, emo: 'nervous', med: ['tummymed16', 'gingertea16'], noEat: true, d: '吃壞肚子了。' },
    bruise: { zh: '擦傷', ic: '🩹', dur: [480, 1200], drain: { comfort: -0.02 }, rest: 1.1, active: 0.7, social: 1, emo: 'down', med: ['bandage16'], d: '跌得有點重，膝蓋擦破了。' },
    tired: { zh: '過勞', ic: '😮‍💨', dur: [600, 1200], drain: { energy: -0.03, fun: -0.01 }, rest: 2.1, active: 0.4, social: 0.8, emo: 'down', med: [], d: '太久沒有好好休息。' },
    joints: { zh: '關節痠痛', ic: '🦴', chronic: true, drain: { comfort: -0.012 }, rest: 1.3, active: 0.65, social: 1, emo: null, med: ['patch16'], d: '年紀大了，陰天特別明顯。（老毛病，貼布能緩解一天）' },
    cough: { zh: '老是咳嗽', ic: '😷', chronic: true, drain: { energy: -0.01 }, rest: 1.2, active: 0.75, social: 0.9, emo: null, med: ['gingertea16', 'coldmed16'], d: '入夜容易咳。（老毛病，薑茶或感冒藥能緩解一天）' },
  };
  const MODES = [['nodeath', '會生病、不會離開'], ['natural', '自然（壽命到了會告別）'], ['immortal', '不會生病、不會離開']];
  const modeOf = (c) => H(c).mode || 'nodeath';
  const on = () => set().health16 !== false;
  /** current conditions (not the relieved chronic ones) */
  const active = (c) => H(c).conds.filter((x) => !(x.chronic && x.relief > Sim().now()));
  const sick = (c) => on() && !!c && active(c).some((x) => !x.chronic);
  const worst = (c) => { const a = active(c); if (!a.length) return null; const r = (x) => (x.chronic ? 0 : CONDS[x.id].rest); return a.slice().sort((p, q) => r(q) - r(p))[0]; };
  const label = (c) => { const w = worst(c); return w ? CONDS[w.id].zh : null; };
  const staysHome = (c) => on() && !!c && active(c).some((x) => CONDS[x.id].home);
  /** vulnerability: the very young and the old fall ill more easily; some temperaments less */
  function frail(c) {
    let v = 1; const st = OC.People && OC.People.stage(c), from = st ? st.from : 25;
    if (from < 6) v *= 1.4; else if (from >= 60) v *= 1.5;
    if (any(c, ['sporty', 'energetic', 'tough'])) v *= 0.75; if (any(c, ['delicate', 'sensitive'])) v *= 1.2;
    return v;
  }
  /** fall ill (once per key): returns the condition or null */
  function catchIt(c, id, cause, key) {
    if (!on() || !c || modeOf(c) === 'immortal' || !CONDS[id]) return null;
    const h = H(c), now = Sim().now();
    if (h.conds.some((x) => x.id === id)) return null; if ((h.imm[id] || 0) > now) return null;
    if (key) { h.keys = h.keys || {}; if (h.keys[key]) return null; h.keys[key] = now; const ks = Object.keys(h.keys); if (ks.length > 60) delete h.keys[ks[0]]; }
    const C = CONDS[id], dur = C.chronic ? null : Math.round(C.dur[0] + hs((key || id) + c.id) * (C.dur[1] - C.dur[0]));
    const x = { id, since: now, until: C.chronic ? null : now + dur, cause, chronic: !!C.chronic };
    if (id === 'fever') h.conds = h.conds.filter((y) => y.id !== 'cold');   /* the cold became a fever */
    h.conds.push(x); h.hist.unshift({ id, cause, day: Sim().day() }); if (h.hist.length > 20) h.hist.length = 20;
    if (C.emo) M().feel(c, C.emo, 0.35, C.zh);
    M().remember(c, { type: 'event', imp: C.chronic ? 0.45 : 0.4, text: `${cause ? cause + '，' : ''}${C.zh}了`, key: `h16:${c.id}:${id}:${Sim().day()}` });
    const b = B().get(c.id); if (b && b.a && OC.App && OC.App.floatText) OC.App.floatText(b.a, C.ic, 'var(--ink-2)');
    say(c, 'h16_sick_' + id);
    St().touch('life', { health: c.id }); St().emit('health16:sick', { id: c.id, cond: id, cause });
    return x;
  }
  function recover(c, x, how) {
    const h = H(c); h.conds = h.conds.filter((y) => y !== x); h.imm[x.id] = Sim().now() + (x.id === 'cold' || x.id === 'fever' ? 4320 : 720);
    M().feel(c, 'content', 0.3, `${CONDS[x.id].zh}好了`); say(c, 'h16_well');
    if (how === 'med') M().remember(c, { type: 'event', imp: 0.3, text: `吃了藥，${CONDS[x.id].zh}好多了`, key: `h16med:${c.id}:${x.id}:${x.since}` });
    St().touch('life', { health: c.id }); St().emit('health16:well', { id: c.id, cond: x.id, how });
  }
  /** medicine (eaten or given through OC.Use → the Progress stream) */
  function treat(c, item) {
    if (!c || !item) return false; let done = false;
    for (const x of H(c).conds.slice()) {
      const C = CONDS[x.id]; if (!C.med.includes(item)) continue;
      if (x.chronic) { x.relief = Sim().now() + 1440; done = true; continue; }
      const left = x.until - Sim().now(); x.until = Sim().now() + Math.max(30, left * (item === 'gingertea16' ? 0.6 : 0.25)); done = true;
      if (x.until - Sim().now() <= 30) recover(c, x, 'med');
    }
    if (done) { M().feel(c, 'content', 0.25, '吃了藥'); St().touch('life', { health: c.id }); }
    return done;
  }

  // ---------------------------------------------------------------- causes, every ten game minutes
  let acc = 0, aAcc = 0, afAcc = 0;   /* 17.1: separate counters for an absence (reset when it begins, so the same absence gives the same story) */
  const outside = (c) => { const pl = OC.Places.get(c.life.loc || 'isle'); return !(pl && pl.interior); };
  const resting = (c, b) => { const a = b && b.st === 'do' ? b.act : c.life.cur && c.life.cur.until > Sim().now() ? c.life.cur.act : null; return ['sleep', 'nap', 'rest'].includes(a) || (a && D().ACTS[a] && D().ACTS[a].cat === 'rest'); };
  function step(g, o) {
    const away = !!(o && o.away);   /* 17.1: during a simulated absence: read the save only (no brains, no positions) */
    if (!on() || (Sim().catching && !away)) return;
    const now = Sim().now();
    /* effects every minute */
    for (const c of Ch().all()) {
      const h = H(c); if (!h.conds.length) continue; const b = away ? null : B().get(c.id), rest = resting(c, b);
      for (const x of active(c)) {
        const C = CONDS[x.id]; for (const [k, v] of Object.entries(C.drain)) if (c.needs[k] != null) c.needs[k] = clamp(c.needs[k] + v * g * (rest ? 0.4 : 1), 0, 100);
        if (!x.chronic && rest) x.until -= g * 0.8;   /* resting makes it pass faster */
      }
      for (const x of h.conds.slice()) if (!x.chronic && now >= x.until) recover(c, x, 'time');
    }
    let inc = 10; if (away) { aAcc += g; if (aAcc < 10) return; inc = aAcc; aAcc = 0; } else { acc += g; if (acc < 10) return; acc = 0; }
    const wx = OC.Clock.weather(), day = Sim().day(), all = Ch().all();
    for (const c of all) {
      if (modeOf(c) === 'immortal' || c.status.onIsland === false) continue;
      const h = H(c), e = h.exp, b = away ? null : B().get(c.id), fr = frail(c);
      /* rain: an hour and a half outside in it */
      if (wx === 'rain' && outside(c) && !resting(c, b)) e.rain = (e.rain || 0) + inc; else e.rain = Math.max(0, (e.rain || 0) - inc / 2);
      if (e.rain >= 90) { e.rain = 0; if (hs(`rain:${c.id}:${day}:${Math.floor(now / 360)}`) < 0.22 * fr) catchIt(c, 'cold', '淋了雨', `rain:${day}`); }
      /* no sleep: three hours past exhaustion */
      if (c.needs.sleep < 8) e.sleep = (e.sleep || 0) + inc; else e.sleep = Math.max(0, (e.sleep || 0) - inc);
      if (e.sleep >= 240) { e.sleep = 0; if (hs(`ns:${c.id}:${day}`) < 0.25 * fr) catchIt(c, 'cold', '一直沒睡', `nosleep:${day}`); }
      /* worn out: low energy and sleep while still working, for a long time */
      if (c.needs.energy < 10 && c.needs.sleep < 25 && !resting(c, b)) e.tired = (e.tired || 0) + inc; else e.tired = Math.max(0, (e.tired || 0) - inc);
      if (e.tired >= 240) { e.tired = 0; if (hs(`tr:${c.id}:${day}`) < 0.4 * fr) catchIt(c, 'tired', '撐太久了', `tired:${day}`); }
      /* a cold that is not rested becomes a fever */
      const cold = h.conds.find((x) => x.id === 'cold'); if (cold && c.needs.energy < 12 && !resting(c, b) && now - cold.since > 240 && hs(`fv:${c.id}:${cold.since}`) < 0.3) catchIt(c, 'fever', '感冒沒好好休息', `fever:${cold.since}`);
      /* catching it from someone close by (only colds) */
      if (b && b.a && !b.a.hidden) for (const o of all) {
        if (o === c || !active(o).some((x) => CONDS[x.id].spread)) continue; const ob = B().get(o.id); if (!ob || !ob.a || ob.a.hidden) continue;
        if (Math.hypot(b.a.x - ob.a.x, b.a.y - ob.a.y) < 80) { e.germ = (e.germ || 0) + 10; if (e.germ >= 90) { e.germ = 0; if (hs(`germ:${c.id}:${o.id}:${day}`) < 0.12 * fr) catchIt(c, 'cold', `被${name(o)}傳染`, `germ:${day}`); } }
      }
    }
  }
  /** once a game day: the old aches, the twilight, grief passing */
  function dayStep(day, away) {
    if (Sim().catching && !away) return;
    for (const c of Ch().all()) {
      const h = H(c), st = OC.People && OC.People.stage(c);
      if (on() && modeOf(c) !== 'immortal' && st && st.from >= 60 && !h.conds.some((x) => x.chronic) && hs(`chr:${c.id}:${day}`) < 0.05) catchIt(c, hs(`chk:${c.id}`) < 0.5 ? 'joints' : 'cough', '上了年紀', `chronic:${day}`);
      lifeDay(c, day);
      if (h.grief && h.grief.until <= day) delete h.grief;
    }
  }
  /** the Utility AI: rest when ill, look after a friend who is ill, grieve */
  function shape(c, b, list) {
    if (!c || !list || !on()) return list; if (b && b.manual && B().manualMode(b)) return list;
    const w = worst(c), C = w && CONDS[w.id], g = H(c).grief, tw = H(c).twilight;
    for (const x of list) {
      const A = x.kind === 'act' && D().ACTS[x.act];
      if (C) {
        if (A && (['sleep', 'nap', 'rest'].includes(x.act) || A.cat === 'rest')) { x.s *= C.rest; x.why && x.why.unshift(`${C.zh}，想休息`); }
        else if (A && !A.sed && A.cat !== 'need') { x.s *= C.active; x.why && x.why.unshift(`${C.zh}，不想動`); }
        else if (x.kind === 'social') x.s *= C.social;
        if (A && C.noEat && ['eat', 'g16_eat', 'cook16'].includes(x.act)) x.s *= 0.2;
      }
      if (tw && x.kind === 'social') { x.s *= 1.5; x.why && x.why.unshift('想多見見大家'); }
      if (tw && A && A.cat === 'rest') x.s *= 1.3;
      if (g && A && A.cat === 'fun') { x.s *= 0.7; x.why && x.why.unshift('還在難過'); }
      /* a friend who is ill: the caring ones go to look after them */
      if (x.kind === 'social' && x.other) {
        const o = Ch().get(x.other), it = OC.Will && OC.Will.INTER[x.social];
        if (o && sick(o) && it && it.cat === 'care') { const r = M().relPeek(c.id, o.id); if (r && r.aff >= 25) { x.s *= 1.4 + (any(c, ['caring', 'caretaker', 'gentle']) ? 0.4 : 0); x.why && x.why.unshift(`${name(o)}${label(o)}了`); } }
      }
    }
    list.sort((p, q) => q.s - p.s); return list;
  }
  /** before Aware removes it: was the food on the ground spoiled? */
  function onFinish(c, act, b) {
    if (act !== 'g16_eat' || !b || !b.dest || !String(b.dest.k || '').startsWith('g16:')) return;
    const uid = b.dest.k.slice(4), g = ((S().ground16 || {})[c.life.loc || 'isle'] || []).find((x) => x.uid === uid) || Object.values(S().ground16 || {}).flat().find((x) => x.uid === uid);
    if (g && Sim().now() - g.at > 720 && hs('sp:' + uid) < 0.6 * frail(c)) catchIt(c, 'tummy', '吃了放太久的東西', 'spoiled:' + uid);
  }
  /** every eat / gift on the Progress stream: medicine, or eating too much */
  function onProgress(d) {
    const c = d.oc && Ch().get(d.oc); if (!c) return;
    if ((d.ev === 'eat' || d.ev === 'gift') && treat(c, d.item)) return;
    if (d.ev === 'eat' && !d.drink) {
      const h = H(c), now = Sim().now(); h.ate = (h.ate || []).filter((t) => now - t < 120); h.ate.push(now);
      if (h.ate.length >= 3 && c.needs.food >= 95) catchIt(c, 'tummy', '吃太多', 'over:' + Math.floor(now / 120));
    }
  }
  function onLand(e) {
    const c = e && e.strong && Ch().get(e.id); if (!c) return;
    const n = (H(c).thrown = (H(c).thrown || 0) + 1);
    if (hs(`land:${c.id}:${n}`) < 0.35 * frail(c)) catchIt(c, 'bruise', '被丟出去摔到了', 'land:' + n);
  }

  // ================================================================ life length · twilight · farewell
  const lifespan = (c) => { const sp = OC.People && OC.People.get(c.profile.species || 'human'); return Math.round(82 * ((sp && sp.span) || 1)) + Math.round(hs('ls:' + c.id) * 14) - 6; };
  const ageOf = (c) => { const st = OC.People && OC.People.stage(c); return st ? st.age : null; };
  const deathOn = () => set().death16 === true;
  const passed = () => S().life.passed16 || (S().life.passed16 = {});
  function lifeDay(c, day) {
    const h = H(c), a = ageOf(c);
    if (h.twilight && (!deathOn() || modeOf(c) !== 'natural')) { delete h.twilight; St().touch('life', { health: c.id }); return; }
    if (!deathOn() || modeOf(c) !== 'natural' || a == null) return;
    if (!h.twilight && a >= lifespan(c) && Ch().all().length > 1) {
      h.twilight = { since: day };
      M().remember(c, { type: 'milestone', imp: 0.8, text: '最近常常覺得累，想多陪陪大家', key: 'tw16:' + c.id });
      OC.Budget && OC.Budget.mail({ kind: 'life', oc: c.id, title: `${name(c)}最近常常說累`, text: `${name(c)}已經 ${a} 歲了。牠想多和大家在一起。（「健康」App 可以改壽命設定；七天後會道別）`, key: 'tw16:' + c.id + ':' + day });
      St().touch('life', { health: c.id });
    } else if (h.twilight && day - h.twilight.since >= 7 && !Sim().catching) farewell(c);   /* 17.1: a farewell is never decided while you are away — it waits until you are back */
  }
  /** the farewell: the friends say goodbye, a keepsake, then the character is archived (revocable) */
  function farewell(c) {
    if (!c || Ch().all().length <= 1) return false;
    const friends = Ch().all().filter((o) => o.id !== c.id && ((M().relPeek(o.id, c.id) || {}).aff >= 20 || ['parent', 'child', 'sibling', 'family'].includes((M().relPeek(o.id, c.id) || {}).kind16)));
    const lines = [], line = (who, cat, other) => { const ln = OC.Talk.say(cat, who, other); if (ln) lines.push({ who: who.id, text: ln.text }); };
    line(c, 'fw16_first', null);
    for (const o of friends.slice(0, 5)) line(o, 'fw16_bye', c);
    line(c, 'fw16_last', friends[0] || null);
    const day = Sim().day(), cal = OC.Clock.cal ? OC.Clock.cal().text : '第 ' + day + ' 天';
    const r = OC.Tx.run('keep16:' + c.id + ':' + day, { get: { items: { keepsake16: 1 } } }, `${name(c)}留下的紀念相框`);
    passed()[c.id] = { char: JSON.parse(JSON.stringify(c)), day, cal, age: ageOf(c), friends: friends.map((o) => o.id), keepsake: !!(r && r.ok) };
    for (const o of friends) {
      M().feel(o, 'down', 0.75, `${name(c)}離開了`, c.id); H(o).grief = { who: c.id, until: day + 7 };
      M().remember(o, { type: 'milestone', imp: 0.95, who: [c.id], text: `和${name(c)}道別了。牠說的最後一句話，我會一直記得`, key: `fw16:${c.id}:${o.id}` });
    }
    if (OC.Theatre) OC.Theatre.play({ kind: 'farewell', title: `再見，${name(c)}`, sub: `${cal}・${ageOf(c) != null ? ageOf(c) + ' 歲' : ''}`, ocs: [c.id].concat(friends.map((o) => o.id)), lines, key: 'fw16:' + c.id + ':' + day });
    Ch().remove(c.id); OC.App && OC.App.syncPresence && OC.App.syncPresence();
    OC.Budget && OC.Budget.mail({ kind: 'life', title: `${name(c)}離開了`, text: `大家和${name(c)}道別了。「健康」App 的紀念欄裡留著牠的一切；如果你不想要這樣的結局，可以在那裡讓牠回來。`, key: 'fw16:' + c.id + ':' + day });
    St().emit('health16:farewell', { id: c.id }); St().touch('life', { passed: true });
    return true;
  }
  /** bring someone back (the player changes their mind): back in the roster, can no longer pass away */
  function restore(id) {
    const p = passed()[id]; if (!p || S().chars[id]) return false;
    const c = p.char; S().chars[id] = c; S().roster.push(id); H(c).mode = 'nodeath'; delete H(c).twilight;
    for (const o of Ch().all()) if (H(o).grief && H(o).grief.who === id) delete H(o).grief;
    delete passed()[id];
    St().touch('chars', { id, added: true }); St().touch('life', { passed: true }); OC.App && OC.App.syncPresence && OC.App.syncPresence();
    return true;
  }
  function setMode(c, m) { if (!c || !MODES.some((x) => x[0] === m)) return false; H(c).mode = m; if (m === 'immortal') H(c).conds = []; if (m !== 'natural') delete H(c).twilight; St().touch('life', { health: c.id }); return true; }

  // ---------------------------------------------------------------- lines
  function say(c, cat, vars) {
    const b = B().get(c.id); if (!b || !b.a || b.a.hidden || !OC.App || !OC.App.bubble || set().bubbles === false) return;
    const ln = OC.Talk.say(cat, c, null, vars); if (ln) OC.App.bubble(b.a, ln.text, name(c), 2);
  }

  // ================================================================ feuds (on top of OC.Arcs)
  const CAUSES = [
    [['hotheaded', 'competitive'], '一點小事吵起來，誰也不讓誰'], [['stubborn'], '意見不合，都覺得自己是對的'], [['messy', 'lazy'], '生活習慣合不來'],
    [['neatfreak', 'organized'], '受不了對方把東西亂放'], [['jealous', 'sensitive'], '覺得被冷落了'], [['honest', 'blunt'], '說話太直，傷到對方'],
    [['proud', 'cool'], '覺得被看不起'], [['teaser', 'playful'], '玩笑開過頭了'],
  ];
  /** why it started — from the relationship record if it remembers, else from the two temperaments */
  function causeOf(r) {
    const a = Ch().get(r.a), b = Ch().get(r.b); if (!a || !b) return '';
    /* the most recent memory either of them has of something going wrong between the two */
    const RX = /吵|爭|不合|嚇了一跳|放鴿子|沒有出現|摩擦|壞話|結果對方|受不了/;
    for (const [x, y] of [[a, b], [b, a]]) { const mm = x.life.mem, m = mm && mm.recent.concat(mm.long).filter((m) => (m.who || []).includes(y.id) && RX.test(m.text || '')).sort((p, q) => q.gm - p.gm)[0]; if (m) return m.text.replace(/\{other\}/g, name(y)); }
    for (const [ts, text] of CAUSES) if (any(a, ts) || any(b, ts)) return text;
    return ['一點誤會越滾越大', '為了一件小事鬧得不愉快'][Math.floor(hs(r.a + r.b) * 2)];
  }
  const rifts = () => Object.values((OC.Arcs && OC.Arcs.state && OC.Arcs.state.rifts) || {});
  const liveRift = (r) => ['cold', 'thaw'].includes(r.stage);
  let fAcc = 0;
  function feudStep(g, o) {
    const away = !!(o && o.away); if ((Sim().catching && !away) || !OC.Arcs) return;
    if (away) { afAcc += g; if (afAcc < 30) return; afAcc = 0; } else { fAcc += g; if (fAcc < 30) return; fAcc = 0; }
    const day = Sim().day();
    for (const r of rifts()) {
      if (!r.cause16 && liveRift(r)) { r.cause16 = causeOf(r); St().touch('life', { arcs: true }); }
      /* making up is a big moment */
      if (r.stage === 'reconciled' && !r.th16 && Sim().now() - (r.endedAt || 0) < 120) { r.th16 = 1; reconcileScene(r); }
      if (r.stage !== 'cold') continue;
      /* talking behind the other's back — at most once a day per quarrel */
      r.bb16 = r.bb16 || {}; if (r.bb16[day] != null) continue;
      for (const [x, y] of [[r.a, r.b], [r.b, r.a]]) {
        const a = Ch().get(x), b = Ch().get(y); if (!a || !b) continue;
        const p = 0.25 + (any(a, ['gossip', 'hotheaded', 'jealous']) ? 0.25 : 0) - (any(a, ['gentle', 'polite', 'kind', 'honest']) ? 0.18 : 0);
        r.bb16[day] = 0; if (hs(`bb:${x}:${y}:${day}`) >= p) continue;
        const ears = Ch().all().filter((m) => m.id !== x && m.id !== y && (M().relPeek(m.id, x) || {}).aff >= 30); if (!ears.length) continue;
        const m = ears[Math.floor(hs(`bbm:${x}:${day}`) * ears.length)]; backbite(a, b, m, r, day); r.bb16[day] = 1; break;
      }
    }
  }
  function backbite(a, b, m, r, day) {
    const rmb = M().relPeek(m.id, b.id), believe = !(rmb && rmb.trust >= 50) && !any(m, ['honest', 'fair']);
    (r.talk16 = r.talk16 || []).unshift({ day, by: a.id, to: m.id, believe }); if (r.talk16.length > 6) r.talk16.length = 6;
    if (believe) { if (!(rmb && (rmb.fixed || set().lockRel))) M().relChange(m.id, b.id, { aff: -3, trust: -2 }, `聽${name(a)}說了${name(b)}的事`); M().remember(m, { type: 'social', imp: 0.4, who: [a.id, b.id], text: `${name(a)}跟我抱怨${name(b)}`, key: `bb16:${a.id}:${m.id}:${day}` }); }
    else { const rma = M().relPeek(m.id, a.id); if (!(rma && rma.fixed)) M().relChange(m.id, a.id, { aff: -2 }, '在背後說人'); M().remember(m, { type: 'social', imp: 0.4, who: [a.id, b.id], text: `${name(a)}在背後說${name(b)}，我不太喜歡這樣`, key: `bb16:${a.id}:${m.id}:${day}` }); }
    /* it may get back to the one being talked about */
    if (hs(`bbh:${a.id}:${b.id}:${day}`) < 0.35) {
      const rba = M().relPeek(b.id, a.id); if (!(rba && rba.fixed)) M().relChange(b.id, a.id, { conflict: 6, trust: -3 }, '聽說被說壞話');
      M().feel(b, 'annoyed', 0.35, `聽說${name(a)}在背後說我`, a.id); M().remember(b, { type: 'social', imp: 0.5, who: [a.id], text: `聽說${name(a)}在背後說我的壞話`, key: `bbh16:${a.id}:${b.id}:${day}` });
      r.until = (r.until || Sim().now()) + 360;
    }
    St().touch('life', { arcs: true });
  }
  /** a gift between the two of them softens it (the Will engine reports every finished interaction) */
  function onWill(e) {
    if (!e || !e.ok || !OC.Arcs) return; const it = OC.Will && OC.Will.INTER[e.kind]; if (!it || it.cat !== 'gift') return;
    const r = OC.Arcs.riftOf(e.a, e.b); if (!r || !liveRift(r)) return;
    if (r.stage === 'cold') { const now = Sim().now(); r.until = now + Math.max(0, r.until - now) * 0.6; r.gift16 = (r.gift16 || 0) + 1; }
    else if (hs(`gift:${e.a}:${e.b}:${Sim().now()}`) < 0.55) OC.Arcs.reconcile(r, 'gift');
    St().touch('life', { arcs: true });
  }
  function reconcileScene(r) {
    const a = Ch().get(r.a), b = Ch().get(r.b); if (!a || !b || !OC.Theatre) return;
    const lines = []; for (const [x, y, cat] of [[a, b, 'fd16_sorry'], [b, a, 'fd16_ok'], [a, b, 'fd16_after']]) { const ln = OC.Talk.say(cat, x, y); if (ln) lines.push({ who: x.id, text: ln.text }); }
    const HOW = { time: '時間沖淡了一切', player: '你讓牠們好好談了', apology: '一句道歉', mediation: '朋友在中間牽線', gift: '一份小禮物' };
    OC.Theatre.play({ kind: 'reconcile', title: `${name(a)}和${name(b)}和好了`, sub: [r.cause16 ? '起因：' + r.cause16 : '', HOW[r.how] || ''].filter(Boolean).join('・'), ocs: [a.id, b.id], lines, key: `rc16:${r.a}:${r.b}:${r.endedAt}` });
  }
  /** the player asks someone to apologise / asks a friend to step in */
  function askApology(fromId, toId) {
    if (!OC.Queue) return { ok: false, why: '沒有動作清單' };
    const r = OC.Queue.add(fromId, { kind: 'social', other: toId, social: 'apologize' }, { now: true });
    return r && r !== 'young' ? { ok: true } : { ok: false, why: '現在排不進去' };
  }
  function mediators(r) {
    return Ch().all().filter((m) => m.id !== r.a && m.id !== r.b && (M().relPeek(m.id, r.a) || {}).aff >= 30 && (M().relPeek(m.id, r.b) || {}).aff >= 30);
  }
  function askMediator(r, mid) {
    const run = OC.Arcs && OC.Arcs.running; if (run) return { ok: false, why: '大家正在聚會' };
    const ids = [mid, r.a, r.b], bs = ids.map((id) => B().get(id));
    if (bs.some((b) => !b || !b.a || b.a.hidden)) return { ok: false, why: '三個人要在同一個地方' };
    if (bs.some((b) => b.holds.size || b.leaving)) return { ok: false, why: '有人正在忙' };
    OC.Arcs.gather('mediation', ids, { rift: r }); return { ok: true };
  }

  // ================================================================ init
  function init() {
    Sim().onStep((g) => { try { step(g); feudStep(g); } catch (e) { console.error('[health16]', e); } });
    Sim().onDay((d) => { try { dayStep(d); } catch (e) { console.error('[health16 day]', e); } });
    /* 17.1: away too — falling ill, getting better, quarrels talked about behind backs, the old aches */
    Sim().onAbstract((g, o) => { if (!o || !o.away) return; try { step(g, o); feudStep(g, o); } catch (e) { console.error('[health16 away]', e); } });
    if (Sim().onAwayDay) Sim().onAwayDay((d) => { try { dayStep(d, true); } catch (e) { console.error('[health16 away day]', e); } });
    St().on('away:begin', () => { aAcc = 0; afAcc = 0; });
    if (OC.Progress) OC.Progress.on(onProgress);
    St().on('touch:land', onLand); St().on('will:done', onWill);
  }
  OC.Health16 = { on, CONDS, MODES, H, modeOf, setMode, active, sick, worst, label, staysHome, catchIt, recover, treat, step, dayStep, shape, onFinish, frail, lifespan, ageOf, farewell, restore, passed, init };
  OC.Feud16 = { causeOf, rifts, liveRift, backbite, onWill, askApology, mediators, askMediator, feudStep, reconcileScene, CAUSES };
})();
