/* OC Shimeji — the inner life of each OC (Phase 4). Pure state logic, no world / DOM.
 *   needs      9 needs with personality-dependent rates and cross-effects (game time)
 *   emotions   cause · intensity · half-life decay · stacking · cooldown · dominant with hysteresis
 *   memory     short-term (emotion causes) / recent events / long-term (consolidated, capped)
 *   records    real behaviour statistics → acquired habits & traits (suggested, never forced)
 *   relations  directed pair metrics (familiarity, affection, trust, intimacy, conflict…)
 *   wishes     short / mid / long-term wishes that arise naturally; skills with xp
 *   routine    personal sleep / wake hours (auto from personality, editable)
 * "personality → behaviour → experience → memory → future choices"
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, D = () => OC.LifeData, Sim = () => OC.Sim;
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  const has = (c, t) => c.personality.traits.includes(t);
  const k01 = (v) => (v - 50) / 50;
  const NEED_IDS = ['food', 'energy', 'sleep', 'fun', 'social', 'comfort', 'interest', 'active', 'mood'];
  const name = (c) => OC.Chars.name(c);
  const pron = (c) => (c && c.profile.pronoun) || '牠';
  let changes = [];                        // recent-changes ring for diagnostics
  function note(c, kind, text) { changes.unshift({ at: Date.now(), gm: Sim().now(), who: c ? c.id : null, kind, text }); if (changes.length > 60) changes.length = 60; }

  function lifeOf(c) { return c.life; }
  const phase = () => OC.Clock.phase(OC.Clock.hour());
  const wx = () => OC.Clock.weather();

  // ======================= needs =======================
  function decayMult(c, id, ctx) {
    const p = c.personality, n = c.needs; let m = 1;
    const sleeping = ctx.act === 'sleep' || ctx.act === 'nap';
    switch (id) {
      case 'food': m = (has(c, 'foodie') ? 1.15 : 1) * (sleeping ? 0.5 : 1); break;
      case 'energy': m = (has(c, 'lazy') ? 0.85 : 1) * (OC.Growth && OC.Growth.has(c, 'stamina') ? 0.85 : 1) * (n.sleep < 25 ? 1.6 : 1) * (n.food < 15 ? 1.3 : 1) * (ctx.sed ? 0.6 : 1) * (sleeping ? 0 : 1); break;
      case 'sleep': m = (has(c, 'nightowl') && phase() === 'night' ? 0.7 : 1) * (has(c, 'sleepy') ? 1.25 : 1) * (sleeping ? 0 : 1); break;
      case 'fun': m = (has(c, 'curious') ? 1.1 : 1) * (has(c, 'lazy') ? 0.9 : 1) * (has(c, 'energetic') ? 1.15 : 1) * (0.8 + 0.4 * p.energy / 100) * (sleeping ? 0.2 : 1); break;
      case 'social': m = (has(c, 'shy') || has(c, 'introvert') ? 0.6 : 1) * (has(c, 'outgoing') || has(c, 'social') || has(c, 'extrovert') ? 1.3 : 1) * (0.6 + 0.8 * p.social / 100) * (sleeping ? 0.3 : 1); break;
      case 'comfort': m = (wx() === 'rain' && !ctx.inside ? 2 : 1) * (ctx.sed ? 0.5 : 1) * (sleeping ? 0 : 1); break;
      case 'interest': m = (has(c, 'curious') ? 1.4 : 1) * (ctx.repeat ? 1.5 : 1) * (sleeping ? 0 : 1); break;
      case 'active': m = (ctx.sed ? 1.5 : 1) * (0.6 + 0.9 * p.energy / 100) * (sleeping ? 0 : 1); break;
    }
    if (OC.Traits13) m *= OC.Traits13.decay(c, id);   // 13.0: data-driven traits
    return m;
  }
  /** personality flavour on activity gains (e.g. a bookworm enjoys reading more) */
  function gainMult(c, act, id) {
    let m = 1;
    if (act === 'read' && has(c, 'bookworm') && (id === 'fun' || id === 'interest')) m *= 1.35;
    if ((act === 'tend' || act === 'observe') && has(c, 'nature')) m *= 1.3;
    if ((act === 'sleep' || act === 'nap' || act === 'rest') && has(c, 'sleepy') && (id === 'energy' || id === 'sleep')) m *= 1.25;
    if (act === 'play' && id === 'fun') m *= 0.8 + 0.4 * c.personality.energy / 100;
    if (act === 'tidy' && has(c, 'tidy')) m *= 1.5;
    return m;
  }
  /** ctx: { act, fx (per hour), sed, inside, repeat, offline } ; g = game minutes */
  function tickNeeds(c, g, ctx = {}) {
    const n = c.needs, h = g / 60, floor = ctx.offline ? 15 : 3;
    for (const d of D().NEEDS) {
      if (d.id === 'mood') continue;
      const dec = d.decay * decayMult(c, d.id, ctx), gain = ((ctx.fx && ctx.fx[d.id]) || 0) * gainMult(c, ctx.act, d.id);
      const v0 = n[d.id] == null ? 70 : n[d.id], delta = (gain - dec) * h;
      n[d.id] = delta < 0 ? Math.max(Math.min(v0, floor), v0 + delta) : clamp(v0 + delta);
      if (n[d.id] > 100) n[d.id] = 100;
    }
    // mood drifts (τ ≈ 90 game min) toward a target from the other needs + emotions + temperament
    const others = NEED_IDS.filter((x) => x !== 'mood'), avg = others.reduce((a, k) => a + n[k], 0) / others.length;
    const val = emoValence(c), base = (has(c, 'cheerful') ? 6 : 0) + (has(c, 'optimist') ? 4 : 0) - (has(c, 'pessimist') ? 6 : 0);
    const target = clamp(22 + 0.55 * avg + 25 * val + base);
    n.mood = clamp(n.mood + (target - n.mood) * (1 - Math.exp(-g / 90)));
    if (ctx.offline && n.mood < 15) n.mood = Math.max(n.mood, 15);
  }
  /** instant change (eating an item, being petted…) */
  function needs(c, delta, why) { for (const k of Object.keys(delta)) if (c.needs[k] != null) c.needs[k] = clamp(c.needs[k] + delta[k]); if (why) note(c, 'need', `${why}：${Object.entries(delta).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${Math.round(v)}`).join(' ')}`); St.touch('needs', { id: c.id }); }
  function urgent(c) { let best = null; for (const k of ['food', 'sleep', 'energy', 'social', 'fun', 'comfort']) if (c.needs[k] < 15 && (!best || c.needs[k] < c.needs[best])) best = k; return best; }

  // ======================= emotions =======================
  const E = () => D().EMOTIONS;
  function sens(c, id) {
    const p = c.personality, e = E()[id]; let m = 0.6 + 0.8 * p.expression / 100;
    if (has(c, 'sensitive')) m *= 1.3;
    if (e.v < 0) { if (has(c, 'optimist')) m *= 0.7; if (has(c, 'cheerful')) m *= 0.8; if (has(c, 'pessimist')) m *= 1.3; }
    if (e.v > 0) { if (has(c, 'pessimist')) m *= 0.85; if (has(c, 'cheerful')) m *= 1.15; }
    if (id === 'shy') m *= has(c, 'shy') ? 1.6 : has(c, 'outgoing') ? 0.4 : 1;
    if (id === 'annoyed') m *= (has(c, 'stubborn') ? 1.2 : 1) * (has(c, 'gentle') ? 0.6 : 1);
    if (id === 'curious') m *= has(c, 'curious') ? 1.4 : 1;
    if (id === 'nervous') m *= 1 - 0.4 * k01(p.social);
    if (OC.Traits13) m *= OC.Traits13.sens(c, id);
    return m;
  }
  /** add/stack an emotion. Same emotion + same cause within 20 game min only adds 30% (cooldown) */
  function feel(c, id, k, cause, who) {
    const e = E()[id]; if (!e || !c.life) return 0;
    const L_ = c.life.emo, gm = Sim().now(), key = id + '|' + (cause || '');
    const recent = L_.cd[key] && gm - L_.cd[key] < 20; L_.cd[key] = gm;
    const add = clamp(k * sens(c, id) * (recent ? 0.3 : 1), 0, 1);
    let cur = L_.list.find((x) => x.id === id && !x.need);
    if (cur) { cur.k = Math.min(1, 1 - (1 - cur.k) * (1 - add)); cur.at = gm; cur.cause = cause || cur.cause; cur.who = who || cur.who; }
    else { cur = { id, k: add, at: gm, cause: cause || '', who: who || null }; L_.list.push(cur); }
    if (add > 0.12 && !recent) { L_.recent.unshift({ id, cause: cause || '', who: who || null, gm, t: Date.now(), k: +add.toFixed(2) }); if (L_.recent.length > 14) L_.recent.length = 14; }
    note(c, 'emo', `${E()[id].zh} ${add.toFixed(2)}${cause ? '（' + cause + '）' : ''}`);
    return add;
  }
  function tickEmotions(c, g) {
    const L_ = c.life.emo, n = c.needs, opt = has(c, 'optimist');
    for (const x of L_.list) if (!x.need) { const e = E()[x.id]; const hl = e.hl * (e.v < 0 && opt ? 0.7 : 1); x.k *= Math.pow(0.5, g / hl); }
    L_.list = L_.list.filter((x) => x.need || x.k > 0.06);
    // need-driven (sustained) emotions — recomputed each tick, never stacked
    const sus = {};
    if (n.sleep < 25 || n.energy < 18) sus.tired = Math.max((25 - n.sleep) / 25, (18 - n.energy) / 18) * 0.9;
    if (n.social < (has(c, 'shy') ? 14 : 25)) sus.lonely = (25 - n.social) / 25 * 0.8;
    if (n.fun < 22) sus.bored = (22 - n.fun) / 22 * 0.7;
    if (n.food < 14 && !has(c, 'gentle')) sus.annoyed = (14 - n.food) / 14 * 0.6;
    if (NEED_IDS.every((k) => n[k] > 70)) sus.content = 0.3;
    L_.list = L_.list.filter((x) => !x.need);
    for (const [id, k] of Object.entries(sus)) if (k > 0.05) L_.list.push({ id, k: clamp(k, 0, 1), need: true, cause: '需求', at: Sim().now() });
    // dominant with hysteresis: switch only on a clear margin and after a short hold
    const score = (x) => x.k * (E()[x.id].prio || 1);
    let best = null; for (const x of L_.list) if (!best || score(x) > score(best)) best = x;
    const cur = L_.list.find((x) => x.id === L_.dom), now = Date.now();
    const curS = cur ? score(cur) : 0, bestS = best ? score(best) : 0;
    let next = L_.dom;
    if (!best || bestS < 0.16) { if (!cur || curS < 0.12) next = 'neutral'; }
    else if (best.id !== L_.dom && (bestS > curS + 0.12 || !cur || curS < 0.12) && (now - (L_.domAt || 0) > 2500 || best.id === 'surprised')) next = best.id;
    if (next !== L_.dom) { L_.dom = next; L_.domAt = now; St.emit('life:emotion', { id: c.id, emo: next }); }
  }
  function dominant(c) { return (c.life && c.life.emo.dom) || 'neutral'; }
  function intensity(c, id) { const x = c.life && c.life.emo.list.find((y) => y.id === id); return x ? x.k : 0; }
  function emoValence(c) { if (!c.life) return 0; let v = 0; for (const x of c.life.emo.list) v += E()[x.id].v * x.k; return Math.max(-1, Math.min(1, v)); }
  /** rig overrides for the dominant emotion (blended into the pose when the OC is not acting) */
  function face(c) { const id = dominant(c), e = E()[id], x = c.life && c.life.emo.list.find((y) => y.id === id); return x && x.k > 0.22 ? e.face : (E().neutral.face); }
  function label(c) {
    const id = dominant(c), n = c.needs;
    if (id === 'neutral') { if (n.food < 25) return '肚子餓了'; if (n.sleep < 25) return '好睏…'; const avg = (n.mood + n.fun + n.social) / 3; return avg > 70 ? '心情不錯' : avg > 45 ? '平靜' : '有點悶'; }
    return E()[id].zh;
  }

  // ======================= memory =======================
  const CAP_RECENT = 80, CAP_LONG = 150;
  function remember(c, m) {
    const M = c.life.mem, gm = Sim().now();
    const item = Object.assign({ id: 'm' + (++M.seq).toString(36) + Math.floor(gm).toString(36), gm, t: Date.now(), day: Sim().day(gm), place: '', type: 'event', who: [], emo: dominant(c), imp: 0.4, text: '', data: null }, m);
    if (item.key && (M.recent.some((x) => x.key === item.key) || M.long.some((x) => x.key === item.key))) return null;   // no duplicates
    M.recent.unshift(item); if (M.recent.length > CAP_RECENT) consolidate(c, true);
    note(c, 'mem', item.text);
    St.touch('life', { id: c.id, mem: item.id }); return item;
  }
  /** move important recent memories into long-term; forget unimportant old ones; cap long-term */
  function consolidate(c, overflow) {
    const M = c.life.mem, today = Sim().day();
    const keep = [], promote = [];
    M.recent.forEach((m, i) => { const old = today - m.day >= 2 || (overflow && i >= CAP_RECENT - 10); if (!old) keep.push(m); else if (m.imp >= 0.55 || m.type === 'milestone' || m.pin) promote.push(m); });
    M.recent = keep.slice(0, CAP_RECENT);
    for (const m of promote) if (!M.long.some((x) => x.id === m.id)) M.long.unshift(m);
    if (M.long.length > CAP_LONG) {
      const w = (m) => (m.pin || m.type === 'milestone' ? 99 : m.imp - (today - m.day) * 0.01);
      M.long = M.long.slice().sort((a, b) => w(b) - w(a)).slice(0, CAP_LONG).sort((a, b) => b.gm - a.gm);
    }
  }
  function memories(c, f = {}) {
    const all = c.life.mem.recent.concat(c.life.mem.long).sort((a, b) => b.gm - a.gm);
    return all.filter((m) => (!f.type || m.type === f.type) && (!f.who || m.who.includes(f.who)) && (!f.since || m.gm >= f.since) && (!f.place || m.place === f.place) && (f.minImp == null || m.imp >= f.minImp));
  }
  /** a memory worth mentioning (optionally about someone) */
  function recall(c, who) { const ms = memories(c, { who, minImp: 0.5 }).filter((m) => Sim().now() - m.gm > 30); return ms.length ? Sim().pick(ms.slice(0, 8)) : null; }
  /** how the OC feels about a place from its memories (−1…1) */
  function placeFeel(c, place) { let v = 0, n = 0; for (const m of memories(c, { place })) { v += (E()[m.emo] ? E()[m.emo].v : 0) * m.imp; n++; } return n ? Math.max(-1, Math.min(1, v / Math.max(2, n) * 1.5)) : 0; }

  // ======================= records (real behaviour statistics) =======================
  function record(c, act, gmDur, o = {}) {
    const R = c.life.rec, r = R.act[act] || (R.act[act] = { n: 0, gm: 0, last: 0, ctx: {}, place: {} });
    r.n++; r.gm += gmDur; r.last = Sim().now();
    const ctx = [phase(), wx()]; for (const k of ctx) r.ctx[k] = (r.ctx[k] || 0) + 1;
    if (o.place) { r.place[o.place] = (r.place[o.place] || 0) + 1; R.place[o.place] = (R.place[o.place] || 0) + 1; R.placeZh[o.place] = o.placeZh || o.place; }
    if (R.lastAct) { const k = R.lastAct + '>' + act; R.seq[k] = (R.seq[k] || 0) + 1; }
    R.lastAct = act;
    if (phase() === 'night' && act !== 'sleep') R.nightAwake = (R.nightAwake || 0) + 1;
    if (o.skill) skill(c, o.skill, gmDur / 6);
    // Phase 6: one progress event per finished activity (quests, requests, aspirations…)
    if (OC.Progress && gmDur >= 1) { const pl = o.place && String(o.place).startsWith('place:') ? String(o.place).slice(6) : (c.life.loc && c.id !== S().activeId && c.life.loc !== (OC.World.area && OC.World.area.id) ? c.life.loc : OC.World.area ? OC.World.area.id : null); OC.Progress.emit('act', { oc: c.id, act, place: pl, min: Math.round(gmDur) }); }
  }
  // ======================= skills =======================
  const SKILLS = { reading: '閱讀', garden: '園藝', sport: '運動', cook: '料理', social: '社交', fishing: '釣魚' };
  function skill(c, id, xp) { const s = c.life.skills; const before = skillLv(c, id); s[id] = (s[id] || 0) + xp; const after = skillLv(c, id); if (after > before) { feel(c, 'proud', 0.5, `${SKILLS[id]}升到 Lv.${after}`); remember(c, { type: 'growth', imp: 0.6, text: `${SKILLS[id]}技能升到 Lv.${after}` }); St.emit('life:skillUp', { id: c.id, skill: id, lv: after }); } }
  const skillLv = (c, id) => Math.min(10, Math.floor(Math.sqrt((c.life.skills[id] || 0) / 15)));

  // ======================= relationships (directed) =======================
  const TYPES = { stranger: '陌生', acquaintance: '認識', friend: '朋友', bestfriend: '摯友', family: '家人', rival: '對手', lover: '戀人', partner: '伴侶', custom: '自訂' };
  function rel(a, b) {
    const R = S().life.rel, key = a + '>' + b;
    if (R[key]) return R[key];
    /* 16.0: looking at a relationship no longer creates it. Every score check between two characters who never met used to leave an empty
     * record behind (N × N of them, saved forever). The blank one is handed out as a stand-in and is only stored the first time something
     * is written to it (or its list of shared interests is touched). */
    const blank = { fam: 0, aff: 0, trust: 10, intim: 0, conflict: 0, shared: [], mems: 0, type: 'stranger', fixed: false, custom: '', since: null, last: 0, talks: 0 };
    if (typeof Proxy !== 'function') return (R[key] = blank);
    /* the same stand-in is handed out for the same pair until something is written, so two readers of one pair never see different records */
    const hit = standIn.get(key); if (hit && hit.rel === R) return hit.p;
    const keep = () => { const R2 = S().life.rel; if (!R2[key]) R2[key] = blank; standIn.delete(key); };
    const p = new Proxy(blank, { set(t, k, v) { t[k] = v; keep(); return true; }, get(t, k) { if (k === 'shared') keep(); return t[k]; }, deleteProperty(t, k) { delete t[k]; keep(); return true; } });
    standIn.set(key, { rel: R, p }); if (standIn.size > 200) standIn.clear();
    return p;
  }
  const standIn = new Map();
  function relPeek(a, b) { return S().life.rel[a + '>' + b] || null; }
  function autoType(r) {
    if (r.fixed || ['lover', 'partner', 'family', 'custom'].includes(r.type)) return r.type;
    if (r.conflict >= 45 && r.aff < 25) return 'rival';
    if (r.aff >= 70 && r.trust >= 55 && r.fam >= 50) return 'bestfriend';
    if (r.aff >= 35 && r.fam >= 25) return 'friend';
    if (r.fam >= 6) return 'acquaintance';
    return 'stranger';
  }
  const RANK = { stranger: 0, rival: 0, acquaintance: 1, friend: 2, bestfriend: 3 };
  /** change a→b metrics (personality multipliers on the receiver side), update the type, emit milestones */
  function relChange(a, b, d, why) {
    if (!a || !b || a === b) return null;
    const r = rel(a, b), A = OC.Chars.get(a), before = r.type;
    if (r.since == null && (d.fam || 0) > 0) r.since = Sim().day();
    const mult = (k) => (k === 'fam' && A && has(A, 'shy') ? 0.8 : 1) * (k === 'aff' && A && has(A, 'gentle') ? 1.1 : 1) * (k === 'conflict' && A && has(A, 'stubborn') ? 1.2 : 1) * (k === 'conflict' && A && has(A, 'gentle') ? 0.7 : 1);
    for (const k of ['fam', 'aff', 'trust', 'intim', 'conflict']) if (d[k]) r[k] = clamp(r[k] + d[k] * (d[k] > 0 ? mult(k) : 1));
    r.last = Sim().now();
    if (!S().life.settings.lockRel) { const t = autoType(r); if (t !== r.type) { r.type = t; St.emit('life:relType', { a, b, from: before, to: t }); if ((RANK[t] || 0) > (RANK[before] || 0)) St.emit('life:relUp', { a, b, from: before, to: t }); note(A, 'rel', `對${name(OC.Chars.get(b))}：${TYPES[before]} → ${TYPES[t]}`); } }
    if (why) note(A, 'rel', `${why}：${Object.entries(d).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`).join(' ')}`);
    St.touch('life', { rel: a + '>' + b });
    return r;
  }
  function relPair(a, b, d, why) { relChange(a, b, d, why); relChange(b, a, d, why); }
  /** the player sets a type (never changed automatically afterwards) */
  function setRelType(a, b, type, custom, both = true) {
    for (const [x, y] of both ? [[a, b], [b, a]] : [[a, b]]) { const r = rel(x, y); r.type = type; r.fixed = type !== 'auto'; r.custom = custom || ''; if (type === 'auto') { r.fixed = false; r.type = autoType(Object.assign({}, r, { type: 'stranger' })); } }
    St.touch('life', { relSet: a + '>' + b });
  }
  function relLabel(r) { return r ? (r.type === 'custom' && r.custom ? r.custom : TYPES[r.type]) : TYPES.stranger; }
  function romanceOK(a, b) {
    const R = S().life.settings.romance; if (!R.enabled || !R.adult[a] || !R.adult[b]) return false;
    if (R.forbid.includes([a, b].sort().join('|'))) return false;
    const fa = R.fixed[a], fb = R.fixed[b]; if ((fa && fa !== b) || (fb && fb !== a)) return false;
    return true;
  }
  function sharedInterests(a, b) { const x = (c) => (c.profile.hobbies || []).concat(c.profile.likes || []).map((s) => String(s).trim()).filter(Boolean); const B = new Set(x(b)); return x(a).filter((s) => B.has(s)); }
  // relationship with the player
  function player(c, d) { const P = c.life.player; if (d) { for (const k of Object.keys(d)) P[k] = clamp((P[k] || 0) + d[k]); P.last = Sim().now(); } return P; }

  // ======================= routine =======================
  function routine(c) {
    const r = c.life.routine || {}, p = c.personality;
    let sleep = 23, wake = 7.5;
    if (has(c, 'nightowl')) { sleep = 25.5; wake = 9.5; } else if (has(c, 'earlybird')) { sleep = 21.5; wake = 5.5; } else if (p.energy >= 65 || has(c, 'diligent')) { sleep = 22; wake = 6.5; }
    if (has(c, 'lazy')) wake += 1; if (has(c, 'sleepy')) { sleep -= 0.5; wake += 0.5; }
    return { sleep: r.sleep != null ? r.sleep : sleep, wake: r.wake != null ? r.wake : wake, auto: r.sleep == null && r.wake == null, early: wake <= 6.6, late: sleep >= 25 };
  }
  /** is hour h inside the sleep window? */
  function sleepTime(c, h = OC.Clock.hour()) { const { sleep, wake } = routine(c); const s = sleep % 24; return s > wake ? (h >= s || h < wake) : (h >= s && h < wake); }
  function hoursToBed(c, h = OC.Clock.hour()) { const s = routine(c).sleep % 24; let d = s - h; if (d < -12) d += 24; if (d > 12) d -= 24; return d; }

  // ======================= wishes =======================
  const WISH = {
    eat_like: { kind: 'short', zh: '想吃{item}', life: 360 },
    chat_with: { kind: 'short', zh: '想和{other}聊聊天', life: 360 },
    play_player: { kind: 'short', zh: '想要你陪{pron}玩', life: 300 },
    stars: { kind: 'short', zh: '想在晚上看星星', life: 720 },
    social: { kind: 'short', zh: '想找人說說話', life: 240 },
    read_n: { kind: 'mid', zh: '這幾天想讀 {n} 次書', life: 4 * 1440, n: 3 },
    tend_n: { kind: 'mid', zh: '想把花草照顧好（{n} 次）', life: 4 * 1440, n: 3 },
    befriend: { kind: 'long', zh: '想和{other}成為朋友', life: 20 * 1440 },
    bestfriend: { kind: 'long', zh: '想和{other}成為最好的朋友', life: 30 * 1440 },
    skill: { kind: 'long', zh: '想讓{skill}更厲害（Lv.{n}）', life: 20 * 1440 },
  };
  const CAPS = { short: 2, mid: 1, long: 1 };
  function wishText(c, w) { const o = w.other && OC.Chars.get(w.other); return WISH[w.type].zh.replace('{item}', w.item ? (OC.Style.ITEMS[w.item] || { zh: w.item }).zh : '').replace('{other}', o ? name(o) : '朋友').replace('{pron}', pron(c)).replace('{skill}', SKILLS[w.skill] || '').replace('{n}', w.n || ''); }
  function activeWishes(c) { return c.life.wishes.filter((w) => w.state === 'active'); }
  /** maybe a new wish arises (called a few times per game day) */
  function maybeWish(c, force) {
    const gm = Sim().now(), act = activeWishes(c);
    for (const w of act) if (gm > w.until) { w.state = 'expired'; if (has(c, 'sensitive')) feel(c, 'down', 0.2, '願望沒有實現'); }
    if (!force && Sim().rnd() > 0.35) return null;
    const others = OC.Chars.all().filter((o) => o.id !== c.id && o.status.onIsland);
    const cand = [];
    const add = (type, w, extra) => { const k = WISH[type].kind; if (activeWishes(c).filter((x) => WISH[x.type].kind === k).length >= CAPS[k]) return; if (activeWishes(c).some((x) => x.type === type)) return; cand.push(Object.assign({ type, w }, extra)); };
    const foods = Object.keys(OC.Style.ITEMS).filter((i) => OC.Style.ITEMS[i].kind === 'food');
    const likes = c.tastes.likeItems.filter((i) => foods.includes(i));
    add('eat_like', (has(c, 'foodie') ? 2 : 0.8) * (c.needs.food < 60 ? 1.5 : 1), { item: likes.length ? Sim().pick(likes) : Sim().pick(foods) });
    if (others.length) { const o = others.slice().sort((x, y) => rel(c.id, y.id).aff - rel(c.id, x.id).aff)[0]; add('chat_with', (0.5 + c.personality.social / 100) * (c.needs.social < 50 ? 1.6 : 1), { other: o.id }); }
    add('play_player', 0.4 + (player(c).aff > 10 ? 0.6 : 0));
    if (['dusk', 'night'].includes(phase())) add('stars', has(c, 'curious') || has(c, 'nature') ? 1.4 : 0.5);
    add('read_n', has(c, 'bookworm') ? 1.6 : 0.4, { n: 3 }); add('tend_n', has(c, 'nature') ? 1.6 : 0.4, { n: 3 });
    for (const o of others) { const r = rel(c.id, o.id); if (RANK[r.type] <= 1 && r.fam > 0) add('befriend', 0.6 + c.personality.social / 100, { other: o.id }); else if (r.type === 'friend') add('bestfriend', 0.7, { other: o.id }); }
    const sk = Object.keys(SKILLS).sort((a, b) => (c.life.skills[b] || 0) - (c.life.skills[a] || 0))[0]; add('skill', 0.5, { skill: sk, n: skillLv(c, sk) + 1 });
    const ch = Sim().wpick(cand, (x) => x.w); if (!ch) return null;
    const def = WISH[ch.type]; const w = { id: 'w' + Math.floor(gm).toString(36) + Math.floor(Sim().rnd() * 1e4).toString(36), type: ch.type, kind: def.kind, other: ch.other || null, item: ch.item || null, skill: ch.skill || null, n: ch.n || def.n || null, prog: 0, born: gm, until: gm + def.life, state: 'active' };
    w.text = wishText(c, w); c.life.wishes.unshift(w); if (c.life.wishes.length > 30) c.life.wishes.length = 30;
    note(c, 'wish', '新願望：' + w.text); St.touch('life', { id: c.id, wish: w.id }); return w;
  }
  /** something happened → progress / fulfil matching wishes. ev = { type, other, item, act, night } */
  function wishEvent(c, ev, by = 'self') {
    let done = null;
    for (const w of activeWishes(c)) {
      let hit = false;
      if (w.type === 'eat_like' && ev.type === 'fed' && ev.item === w.item) hit = true;
      if ((w.type === 'chat_with' && ev.type === 'social' && ev.other === w.other) || (w.type === 'social' && ev.type === 'social')) hit = true;
      if (w.type === 'play_player' && ev.type === 'played') hit = true;
      if (w.type === 'stars' && ev.type === 'act' && ev.act === 'observe' && phase() === 'night') hit = true;
      if ((w.type === 'read_n' && ev.type === 'act' && ev.act === 'read') || (w.type === 'tend_n' && ev.type === 'act' && ev.act === 'tend')) { w.prog++; hit = w.prog >= w.n; }
      if ((w.type === 'befriend' || w.type === 'bestfriend') && ev.type === 'rel' && ev.other === w.other && RANK[ev.to] >= (w.type === 'befriend' ? 2 : 3)) hit = true;
      if (w.type === 'skill' && ev.type === 'skill' && ev.skill === w.skill && ev.lv >= w.n) hit = true;
      if (hit) { w.state = 'done'; w.doneAt = Sim().now(); w.by = by; done = w; if (by === 'player' && OC.Tx && OC.Tx.run(`wish:${c.id}:${w.id}`, { get: { coins: 60 } }, `完成${OC.Chars.name(c)}的心願`).ok) OC.Store.emit('reward', { coins: 60, why: '完成心願' }); feel(c, by === 'player' ? 'happy' : 'proud', 0.6, '願望實現：' + w.text); needs(c, { mood: 8 }); remember(c, { type: 'wish', imp: 0.65, text: `願望實現了：${w.text}${by === 'player' ? '（是你幫的忙）' : ''}`, who: w.other ? [w.other] : [], key: 'wish:' + w.id }); if (by === 'player') player(c, { aff: 4 }); St.emit('life:wishDone', { id: c.id, wish: w }); }
    }
    return done;
  }

  // ======================= acquired habits & traits (consent required) =======================
  function evidence(c, rule) {
    const R = c.life.rec, A = (a) => R.act[a] || { n: 0, gm: 0, ctx: {}, place: {} };
    if (rule.act === 'social') return { n: R.social || 0, text: `最近和大家互動了 ${R.social || 0} 次` };
    if (rule.nightAwake) return { n: R.nightAwake || 0, text: `晚上醒著活動了 ${R.nightAwake || 0} 次` };
    if (rule.seq) { const [x, y] = rule.seq.split('>'); return { n: R.seq[rule.seq] || 0, text: `「${D().ACTS[x].zh}」之後接著「${D().ACTS[y].zh}」${R.seq[rule.seq] || 0} 次` }; }
    if (rule.place) { let best = null; for (const [p, n] of Object.entries(R.place)) if (!best || n > best.n) best = { n, place: p }; return best ? { n: best.n, place: best.place, placeZh: R.placeZh[best.place], text: `在「${R.placeZh[best.place]}」待了 ${best.n} 次` } : { n: 0 }; }
    const acts = [].concat(rule.act), n = acts.reduce((s, a) => s + A(a).n, 0), gm = acts.reduce((s, a) => s + A(a).gm, 0);
    if (rule.ctx) { const k = acts.reduce((s, a) => s + (A(a).ctx[rule.ctx] || 0), 0); const ctxZh = { rain: '雨天', morning: '早上', night: '晚上', noon: '中午', dusk: '黃昏' }[rule.ctx] || rule.ctx; return { n: k, share: n ? k / n : 0, text: `最近 ${n} 次「${acts.map((a) => D().ACTS[a].zh).join('／')}」中有 ${k} 次是在${ctxZh}（共約 ${Math.round(gm / 6) / 10} 小時）` }; }
    return { n, text: `做了 ${n} 次「${acts.map((a) => D().ACTS[a].zh).join('／')}」，共約 ${Math.round(gm / 6) / 10} 小時` };
  }
  function checkHabits(c) {
    if (!S().life.settings.growth) return [];
    const out = [];
    for (const rule of D().HABIT_RULES) {
      const value = rule.type === 'trait' ? rule.value : rule.id;
      if (rule.type === 'trait' && has(c, value)) continue;
      if (rule.type === 'habit' && c.life.habits.some((h) => h.rule === rule.id)) continue;
      const ev = evidence(c, rule); if (ev.n < rule.min || (rule.nightAwake && ev.n < rule.nightAwake)) continue;
      if (rule.ctx && ev.share < 0.4) continue;
      const ask = rule.ask.replace(/\{name\}/g, name(c)).replace(/\{pron\}/g, pron(c)).replace('{place}', ev.placeZh || '');
      const zh = rule.type === 'trait' ? (OC.Chars.TRAITS.find((t) => t.id === value) || { zh: value }).zh : rule.zh + (rule.place && ev.placeZh ? `：${ev.placeZh}` : '');
      if (suggest(c, rule.type, value, ev.text, { zh, ask, rule: rule.id, place: ev.place || null, placeZh: ev.placeZh || null })) out.push(value);
    }
    return out;
  }
  /** propose a growth change. Respects locks, mutes, rejection cool-down; never applies anything */
  function suggest(c, type, value, reason, o = {}) {
    const g = c.growth; if (!S().life.settings.growth) return false;
    if (g.locked.includes(value) || g.muted.includes(type)) return false;
    if (type === 'trait' && c.personality.traits.includes(value)) return false;
    if (type === 'hobby' && c.profile.hobbies.includes(value)) return false;
    if (g.suggestions.some((x) => x.value === value)) return false;
    if (g.rejected[value] && Sim().now() < g.rejected[value]) return false;
    if (type === 'trait') { const t = OC.Chars.TRAITS.find((x) => x.id === value); if (t && t.x && t.x.some((x) => c.personality.traits.includes(x))) return false; }
    const s = { id: 'g' + Date.now().toString(36) + Math.floor(Sim().rnd() * 1e4).toString(36), type, value, zh: o.zh || (type === 'trait' ? (OC.Chars.TRAITS.find((t) => t.id === value) || { zh: value }).zh : value), reason, ask: o.ask || '', rule: o.rule || null, place: o.place || null, at: Date.now(), gm: Sim().now(), snooze: 0 };
    g.suggestions.push(s); note(c, 'growth', `建議：${s.zh}（${reason}）`);
    St.touch('growth', { id: c.id }); St.emit('growthSuggest', { c, type, value, reason, s }); return true;
  }
  const REJECT_COOLDOWN = 5 * 1440;
  /** decision: accept | reject | later | lock | mute */
  function resolve(c, sid, decision) {
    const g = c.growth, s = g.suggestions.find((x) => x.id === sid); if (!s) return false;
    if (decision === 'later') { s.snooze = Sim().now() + 1440; St.touch('growth', { id: c.id }); return true; }
    g.suggestions = g.suggestions.filter((x) => x.id !== sid);
    if (decision === 'accept') {
      if (s.type === 'trait') { if (!c.personality.traits.includes(s.value)) c.personality.traits.push(s.value); }
      else if (s.type === 'hobby') c.profile.hobbies.push(s.value);
      else if (s.type === 'habit') { const rule = D().HABIT_RULES.find((r) => r.id === s.rule) || {}; c.life.habits.push({ id: 'h' + Date.now().toString(36), rule: s.rule, zh: s.zh, why: s.reason, at: Date.now(), place: s.place, fx: rule.fx || null }); }
      feel(c, 'happy', 0.3, '有了新的' + ({ trait: '特質', hobby: '興趣', habit: '習慣' }[s.type]));
      remember(c, { type: 'growth', imp: 0.7, text: `多了新的${{ trait: '特質', hobby: '興趣', habit: '習慣' }[s.type]}「${s.zh}」`, key: 'growth:' + s.value });
    }
    if (decision === 'reject') g.rejected[s.value] = Sim().now() + REJECT_COOLDOWN;
    if (decision === 'lock') g.locked.push(s.value);
    if (decision === 'mute') {
      if (!g.muted.includes(s.type)) g.muted.push(s.type); g.rejected[s.value] = Sim().now() + REJECT_COOLDOWN;
      for (const o of g.suggestions.filter((x) => x.type === s.type)) { g.history.unshift({ at: Date.now(), type: o.type, value: o.zh || o.value, decision: 'mute', reason: o.reason }); g.rejected[o.value] = Sim().now() + REJECT_COOLDOWN; }
      g.suggestions = g.suggestions.filter((x) => x.type !== s.type);
    }
    g.history.unshift({ at: Date.now(), type: s.type, value: s.zh || s.value, decision, reason: s.reason }); g.history = g.history.slice(0, 40);
    OC.Chars.save(c); return true;
  }
  function removeHabit(c, hid) { c.life.habits = c.life.habits.filter((h) => h.id !== hid); OC.Chars.save(c); }
  function editHabit(c, hid, zh) { const h = c.life.habits.find((x) => x.id === hid); if (h) { h.zh = zh; h.edited = true; OC.Chars.save(c); } }
  /** utility bonus from accepted habits for (act, place) */
  function habitBonus(c, act, place) {
    let b = 0; const ph = phase(), w = wx(), last = c.life.rec.lastAct;
    for (const h of c.life.habits) { const f = h.fx; if (!f) continue; if (f.place) { if (place && place === h.place) b += f.add; continue; } if (f.act !== act) continue; if (f.wx && f.wx !== w) continue; if (f.phase && f.phase !== ph) continue; if (f.after && f.after !== last) continue; b += f.add; }
    return b;
  }
  /** pending (not snoozed) suggestions across all OCs, for the HUD notice */
  function pending() { const gm = Sim().now(); const out = []; for (const c of OC.Chars.all()) for (const s of c.growth.suggestions) if (!s.snooze || s.snooze < gm) out.push({ c, s }); return out; }

  // ======================= per-step / day hooks =======================
  function tick(c, g, ctx) { tickNeeds(c, g, ctx); tickEmotions(c, g); }
  /* 16.0: habits are watched quietly and looked at once a week (every 7th game day per character) — the findings arrive together as one
   * letter in the mailbox instead of a notice each morning. 'legacy' (old suites) keeps the daily check. */
  function dayStart(c) {
    consolidate(c); maybeWish(c);
    const legacy = !OC.Budget || OC.Budget.level() === 'legacy', day = Math.floor(Sim().now() / 1440), R = c.life.rec;
    if (legacy) { checkHabits(c); return; }
    if (R.habitDay == null) R.habitDay = day; if (day - R.habitDay < 7) return; R.habitDay = day;
    const found = checkHabits(c); if (found.length) { const zh = c.growth.suggestions.filter((s) => found.includes(s.value)).map((s) => `「${s.zh}」`).join('、'); OC.Budget.mail({ kind: 'growth', oc: c.id, title: `這週觀察到的${name(c)}`, text: `${name(c)}最近好像有了新的樣子：${zh}。要不要讓它成為${pron(c)}的一部分，由你決定（在下面的「等你決定」）。`, key: 'habit:' + c.id + ':' + day }); }
  }

  OC.Mind = {
    NEED_IDS, TYPES, SKILLS, WISH, RANK, tick, tickNeeds, tickEmotions, needs, urgent, feel, dominant, intensity, emoValence, face, label,
    remember, consolidate, memories, recall, placeFeel, record, skill, skillLv,
    rel, relPeek, relChange, relPair, setRelType, relLabel, autoType, romanceOK, sharedInterests, player,
    routine, sleepTime, hoursToBed, maybeWish, wishEvent, activeWishes, wishText,
    evidence, checkHabits, suggest, resolve, removeHabit, editHabit, habitBonus, pending, dayStart, note, pron,
    get changes() { return changes; }, lifeOf,
  };
})();
