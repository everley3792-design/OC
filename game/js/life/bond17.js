/* OC Shimeji 17.3 — relationships settled once a day (OC.Bond17).
 *
 * Until 17.2 a relationship's name (stranger / acquaintance / friend …) changed the instant a number crossed a line, so one good
 * chat could make two people "friends" and one quarrel undo it. Now the numbers still move with everything they do together, but
 * the NAME is settled once a game day (also while you are away), and only when the numbers have said the same thing two days in a row:
 *   friendship   陌生 → 認識 → 朋友 → 好友 → 知己   (and back: 淡了 when they stop seeing each other, 釋懷 when a rivalry cools)
 *   feelings     單戀 (one way) → 曖昧 (both ways) — only between two adults with romance allowed (OC.Mind.romanceOK), never minors
 *   commitments  在一起 / 訂婚 / 結婚 / 分手 / 復合 are events the player must say yes to (events in this file + the 9.0 告白);
 *                the daily settlement never makes or breaks a couple by itself.
 * The day a name changes, the two of them have a small moment if you can see them (a line each) and a card; away, it goes to the
 * timeline (「你不在的時候」). Anniversaries (7, 30, 100 days and every year) of 在一起 / 訂婚 / 結婚 / 知己 get a scene and a memory.
 * Each pair also has three layers the player may set: an identity (室友, 同學…), getting-along tags (愛拌嘴, 互相照顧…), 合拍度 and
 * 「可以發展戀情」. They have small, real effects (multipliers on how the numbers move, a little each day they meet).
 * Fixed relationships (`fixed`) and the global lockRel are never changed. No coins, no items, no progress events.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = () => OC.Store, Sim = () => OC.Sim, M = () => OC.Mind, Ch = () => OC.Chars, D = () => OC.LifeData;
  const name = (c) => Ch().name(c);
  const on = () => S().life.settings.daily17 !== false;
  const HOLD = 2;   /* the numbers must say the same thing on this many settlements in a row */
  const AUTO = ['stranger', 'acquaintance', 'friend', 'bestfriend', 'confidant', 'rival'];
  const RANK = { stranger: 0, rival: 0, acquaintance: 1, friend: 2, bestfriend: 3, confidant: 4 };
  const COUPLE = ['lover', 'engaged', 'partner'];
  const LOVE_ZH = { crush: '單戀', mutual: '曖昧' };
  /** identities: a label for what they are to each other (+ a little familiarity each day they meet) */
  const IDS = { roommate: '室友', classmate: '同學', coworker: '同事', neighbor: '鄰居', childhood: '青梅竹馬', mentor: '師徒', club: '社團夥伴', penpal: '筆友' };
  /** getting-along tags: each one changes how the numbers move between them (k = multiplier on gains of that number; day = each day they met) */
  const TAGS = {
    bicker: { zh: '愛拌嘴', d: '吵吵鬧鬧不傷感情：衝突只算一半，見面的日子熟悉多一點', k: { conflict: 0.5 }, day: { fam: 0.5 } },
    care: { zh: '互相照顧', d: '見面的日子信任多一點', day: { trust: 1 } },
    rivalry: { zh: '良性競爭', d: '衝突少算一些、彼此更熟', k: { conflict: 0.7 }, day: { fam: 0.5 } },
    quiet: { zh: '不說話也自在', d: '很久沒見也不會淡掉', still: true },
    tease: { zh: '愛捉弄', d: '好感漲得慢一點，熟悉漲得快一點', k: { aff: 0.9, fam: 1.2 } },
    rely: { zh: '互相依靠', d: '信任漲得快', k: { trust: 1.3 } },
    awkward: { zh: '有點尷尬', d: '熟悉漲得慢', k: { fam: 0.7 } },
    admire: { zh: '崇拜', d: '好感漲得快', k: { aff: 1.15 } },
  };
  const MAX_TAGS = 3;

  function st() { const L = S().life; L.bond17 = L.bond17 || { log: [], anniv: {}, last: -1 }; return L.bond17; }
  const pairKey = (a, b) => [a, b].sort().join('|');
  const dayStartGm = (day) => day * 1440;

  /* ---------------- what the numbers say ---------------- */
  /** the friendship stage the numbers point at today; going DOWN needs a clear margin (no flapping around a line) */
  function targetOf(r) {
    const cur = r.type, m = (lvl) => (RANK[cur] || 0) > lvl ? 8 : 0;   /* margin only when it would mean a step down from the current one */
    if ((r.conflict || 0) >= 45 && (r.aff || 0) < 25) return 'rival';
    if (cur === 'rival' && (r.conflict || 0) >= 30) return 'rival';     /* a rivalry cools (釋懷) only when the conflict has really gone down */
    if (r.aff >= 85 - m(3) && r.trust >= 75 - m(3) && r.fam >= 75 - m(3)) return 'confidant';
    if (r.aff >= 70 - m(2) && r.trust >= 55 - m(2) && r.fam >= 50 - m(2)) return 'bestfriend';
    if (r.aff >= 35 - m(1) && r.fam >= 25 - m(1)) return 'friend';
    if (r.fam >= 6 || cur !== 'stranger') return 'acquaintance';      /* once you know someone you do not become strangers again */
    return 'stranger';
  }
  function loveOf(a, b) {   /* feelings: only between two adults with romance allowed */
    if (!M().romanceOK(a, b)) return null;
    const r = M().relPeek(a, b), q = M().relPeek(b, a); if (!r) return null;
    const mine = (r.intim || 0) >= 40 && (r.aff || 0) >= 50, theirs = q && (q.intim || 0) >= 40 && (q.aff || 0) >= 50;
    return mine ? (theirs ? 'mutual' : 'crush') : null;
  }
  const layers = (r) => (r && r.lay17) || {};
  /** gains of a number between a and b are multiplied by this (合拍度 and the tags); losses are never softened except conflict by tags */
  function mult(a, b, k, v) {
    const r = M().relPeek(a, b); if (!r) return 1; const L = layers(r); let x = 1;
    if (v > 0 && (k === 'aff' || k === 'intim') && L.fit) x *= 1 + 0.2 * Math.max(-2, Math.min(2, L.fit));
    if (v > 0) for (const t of L.tags || []) { const T = TAGS[t]; if (T && T.k && T.k[k] != null) x *= T.k[k]; }
    return x;
  }

  /* ---------------- the daily settlement ---------------- */
  function settle(day, o = {}) {
    if (!on()) return 0;
    const B = st(); if (B.last >= day) return 0; B.last = day;
    const R = S().life.rel, lock = S().life.settings.lockRel; let changed = 0;
    const met = (r) => (r.last || 0) >= dayStartGm(day - 1);   /* they did something together yesterday (the day that just ended) */
    for (const key of Object.keys(R).sort()) {   /* sorted: the same order every time (an absence must tell the same story) */
      const r = R[key], [a, b] = key.split('>'); const A = Ch().get(a), Bc = Ch().get(b); if (!A || !Bc) continue;
      const L = layers(r);
      /* a little each day they met: identities and tags */
      if (met(r)) { const d = {}; if (L.id && IDS[L.id]) d.fam = (d.fam || 0) + 0.5; for (const t of L.tags || []) { const T = TAGS[t]; if (T && T.day) for (const [k, v] of Object.entries(T.day)) d[k] = (d[k] || 0) + v; } for (const [k, v] of Object.entries(d)) r[k] = Math.max(0, Math.min(100, (r[k] || 0) + v)); }
      /* drifting apart: four days without anything together, a little less familiar and fond each day (淡了) */
      const quiet = (L.tags || []).some((t) => TAGS[t] && TAGS[t].still);
      if (!quiet && !r.fixed && r.type !== 'family' && r.last != null && dayStartGm(day) - (r.last || 0) > 4 * 1440 && r.since != null) { r.fam = Math.max(0, r.fam - 1); r.aff = Math.max(0, r.aff - 0.5); }
      if (r.fixed || lock || !AUTO.includes(r.type)) { r.b17 = null; continue; }
      const t = targetOf(r), h = r.b17 = r.b17 || { want: r.type, n: 0 };
      if (t === r.type) { h.want = t; h.n = 0; }
      else { if (h.want === t) h.n++; else { h.want = t; h.n = 1; } if (h.n >= HOLD) { apply(a, b, r, t, day, o); changed++; } }
      /* feelings, with the same two-day rule */
      const lv = loveOf(a, b), f = r.lv17 = r.lv17 || { st: null, want: null, n: 0 };
      if (lv === f.st) { f.want = lv; f.n = 0; }
      else { if (f.want === lv) f.n++; else { f.want = lv; f.n = 1; } if (f.n >= HOLD) { const from = f.st; f.st = lv; f.n = 0; log(a, b, from ? LOVE_ZH[from] : '', lv ? LOVE_ZH[lv] : '', day, 'love'); } }
    }
    anniversaries(day, o);
    if (changed || o.force) St().touch('life', { bond17: day });
    return changed;
  }
  function log(a, b, from, to, day, kind) {
    const B = st(); B.log.unshift({ day, a, b, from, to, kind, away: !!Sim().catching }); if (B.log.length > 400) B.log.length = 400;
  }
  function apply(a, b, r, t, day, o) {
    const from = r.type; r.type = t; r.st17 = { type: t, day }; r.b17 = { want: t, n: 0 };
    const T = M().TYPES, up = from !== 'rival' && (RANK[t] || 0) > (RANK[from] || 0); log(a, b, T[from] || from, T[t] || t, day, from === 'rival' ? 'letgo' : up ? 'up' : 'down');
    St().emit('life:relType', { a, b, from, to: t, daily: true });
    if (up) St().emit('life:relUp', { a, b, from, to: t });
    moment(a, b, from, t);
  }
  /** the day it changes: if you can see them, a line each and a card (once per pair and day); away → only the timeline */
  const shown = new Set();
  function moment(a, b, from, to) {
    if (Sim().catching) return;
    const A = Ch().get(a), Bc = Ch().get(b), k = pairKey(a, b) + ':' + Sim().day(); if (shown.has(k)) return; shown.add(k); if (shown.size > 200) shown.clear();
    const up = from !== 'rival' && (RANK[to] || 0) > (RANK[from] || 0), T = M().TYPES, cat = from === 'rival' ? 'b17_letgo' : up ? 'b17_up' : to === 'rival' ? 'b17_rival' : 'b17_down';
    const aa = OC.App && OC.App.actorOf && OC.App.actorOf(a), ab = OC.App && OC.App.actorOf && OC.App.actorOf(b);
    if (aa && ab && OC.Talk) {
      const l1 = OC.Talk.say(cat, A, Bc, { to: T[to] }), l2 = OC.Talk.say(cat + '_r', Bc, A, { to: T[to] });
      if (l1) OC.App.bubble(aa, l1.text, name(A)); if (l2) setTimeout(() => { const x = OC.App.actorOf(b); if (x) OC.App.bubble(x, l2.text, name(Bc)); }, 1600);
      if (OC.World && OC.Brain) { try { OC.Brain.face(aa, ab); OC.Brain.face(ab, aa); } catch (e) { /* busy */ } }
    }
    if (OC.Stage && OC.Stage.card) OC.Stage.card({ kind: 'rel', ic: up ? 'heart' : 'users', title: `${name(A)}和${name(Bc)}`, sub: `${T[from] || from} → ${T[to] || to}${from === 'rival' ? '（釋懷了）' : up ? '' : to === 'rival' ? '（最近處得不好）' : '（最近比較少見面）'}` });
  }

  /* ---------------- anniversaries ---------------- */
  const ANNIV_TYPES = { lover: '在一起', engaged: '訂婚', partner: '結婚', confidant: '成為知己' };
  const yearLen = () => (OC.Clock.calMode && OC.Clock.calMode() === 'game' ? (OC.Clock.YEAR || 112) : 365);
  function anniversaries(day, o) {
    const B = st(), seen = new Set();
    for (const [key, r] of Object.entries(S().life.rel).sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
      const [a, b] = key.split('>'), pk = pairKey(a, b); if (seen.has(pk) || !ANNIV_TYPES[r.type] || !r.st17 || r.st17.type !== r.type) continue; seen.add(pk);
      const A = Ch().get(a), Bc = Ch().get(b); if (!A || !Bc) continue;
      const n = day - r.st17.day, Y = yearLen(); if (n <= 0 || !([7, 30, 100].includes(n) || n % Y === 0)) continue;
      const k = `anniv17:${pk}:${r.type}:${n}`; if (B.anniv[k] != null) continue; B.anniv[k] = day;
      const what = ANNIV_TYPES[r.type], span = n % Y === 0 ? `${n / Y} 週年` : `第 ${n} 天`;
      for (const [x, y] of [[A, Bc], [Bc, A]]) M().remember(x, { type: 'milestone', imp: 0.9, who: [y.id], text: `和${name(y)}${what}${span}`, key: `${k}:${x.id}` });
      log(a, b, '', `${what}${span}`, day, 'anniv');
      if (!Sim().catching && OC.Theatre && OC.Theatre.play) {
        const l1 = OC.Talk && OC.Talk.say('b17_anniv', A, Bc, { days: n }), l2 = OC.Talk && OC.Talk.say('b17_anniv_r', Bc, A, { days: n });
        OC.Theatre.play({ kind: 'anniv', title: `${name(A)}和${name(Bc)}${what}${span}`, sub: '紀念日', ocs: [a, b], lines: [l1 && { who: a, text: l1.text }, l2 && { who: b, text: l2.text }].filter(Boolean), key: k });
      }
    }
  }

  /* ---------------- the three layers (player settings) ---------------- */
  function setLayer(a, b, patch) {
    for (const [x, y] of [[a, b], [b, a]]) {
      const r = M().rel(x, y), L = Object.assign({}, r.lay17 || {});
      if ('id' in patch) L.id = IDS[patch.id] ? patch.id : null;
      if ('tags' in patch) L.tags = (patch.tags || []).filter((t) => TAGS[t]).slice(0, MAX_TAGS);
      if ('fit' in patch) L.fit = Math.max(-2, Math.min(2, patch.fit | 0));
      r.lay17 = L;
    }
    if ('romance' in patch) {   /* 「可以發展戀情」: the old forbid list of the romance settings (romanceOK reads it) */
      const R = S().life.settings.romance, k = pairKey(a, b); R.forbid = (R.forbid || []).filter((x) => x !== k); if (patch.romance === false) R.forbid.push(k);
    }
    St().touch('life', { lay17: pairKey(a, b) });
  }
  const layerOf = (a, b) => Object.assign({ id: null, tags: [], fit: 0 }, layers(M().relPeek(a, b)), { romance: !(S().life.settings.romance.forbid || []).includes(pairKey(a, b)) });
  const loveState = (a, b) => { const r = M().relPeek(a, b); return (r && r.lv17 && r.lv17.st) || null; };
  /** for the affection page: everything that changed for one character, newest first */
  const changesOf = (id, n = 12) => st().log.filter((x) => x.a === id || x.b === id).slice(0, n);

  /* ---------------- events (data): the commitments, each one needs the player's yes ---------------- */
  function addData() {
    const DD = D(); if (!DD || DD._b17) return; DD._b17 = true;
    const P = { voice: 'plain' };
    DD.EVENTS.push(
      { id: 'propose17', zh: '求婚', trigger: 'tick', prio: 6, once: 'pair', chance: 0.35, b: true, bc: { romance: true, rel: 'lover', stageDays: '>=14', aff: '>=80', intim: '>=75' }, important: true, watch: true, ask: '{name}好像準備了很久的話要對{other}說',
        steps: [['cam', 'a'], ['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['anim', 'a', 'shy', 1.5], ['say', 'a', 'ev_propose17'], ['anim', 'b', 'surprised', 1.0], ['say', 'b', 'ev_propose17_r']],
        confirm: { title: '要讓{name}和{other}訂婚嗎？', body: '這是重大的關係變化，需要你同意。拒絕的話，牠們仍然在一起。', ok: { relType: 'engaged' } },
        fx: { emo: { a: ['nervous', 0.6], b: ['excited', 0.8] }, mem: { both: { type: 'milestone', imp: 1, text: '和{other}說了想一直在一起' } } } },
      { id: 'wedding17', zh: '婚禮', trigger: 'tick', prio: 6, once: 'pair', chance: 0.35, b: true, bc: { romance: true, rel: 'engaged', stageDays: '>=7' }, important: true, watch: true, ask: '{name}和{other}有件大事想告訴你',
        steps: [['cam', 'a'], ['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['say', 'a', 'ev_wedding17'], ['say', 'b', 'ev_wedding17_r'], ['anim', 'a', 'happy', 1.4], ['anim', 'b', 'happy', 1.4], ['sound', 'chime']],
        confirm: { title: '要讓{name}和{other}結婚嗎？', body: '這是重大的關係變化，需要你同意。拒絕的話，牠們維持訂婚。', ok: { relType: 'partner' } },
        fx: { emo: { a: ['happy', 0.9], b: ['happy', 0.9] }, mem: { both: { type: 'milestone', imp: 1, text: '和{other}結婚了' } } } },
      { id: 'breakup17', zh: '分手', trigger: 'tick', prio: 5, once: 'pair', chance: 0.3, b: true, bc: { rel: ['lover', 'engaged'], conflict: '>=60', aff: '<=30' }, important: true, watch: true, ask: '{name}和{other}之間好像出了問題',
        steps: [['cam', 'a'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['anim', 'a', 'sigh', 1.4], ['say', 'a', 'ev_breakup17'], ['say', 'b', 'ev_breakup17_r']],
        confirm: { title: '{name}和{other}要分手嗎？', body: '這是重大的關係變化，需要你同意。拒絕的話，牠們會試著再好好談談。', ok: { relType: 'ex' } },
        fx: { emo: { a: ['down', 0.8], b: ['down', 0.8] }, mem: { both: { type: 'milestone', imp: 0.9, text: '和{other}好好地談了以後的事' } } } },
      { id: 'reunite17', zh: '復合', trigger: 'tick', prio: 5, once: 'pair', chance: 0.3, b: true, bc: { romance: true, rel: 'ex', aff: '>=70', intim: '>=60' }, important: true, watch: true, ask: '{name}想再跟{other}說一次心裡的話',
        steps: [['cam', 'a'], ['go', 'a', 'b'], ['face', 'a', 'b'], ['face', 'b', 'a'], ['anim', 'a', 'shy', 1.2], ['say', 'a', 'ev_reunite17'], ['say', 'b', 'ev_reunite17_r']],
        confirm: { title: '要讓{name}和{other}重新在一起嗎？', body: '這是重大的關係變化，需要你同意。', ok: { relType: 'lover' } },
        fx: { emo: { a: ['shy', 0.7], b: ['content', 0.7] }, mem: { both: { type: 'milestone', imp: 1, text: '和{other}重新開始' } } } });
    const L = [
      ['ev_propose17', '{other}，我想了很久。以後的日子，也想跟你一起過。', P], ['ev_propose17_r', '……好。我也是這樣想的。', P],
      ['ev_wedding17', '我們決定了。就在這座島上。', P], ['ev_wedding17_r', '以後請多指教。', P],
      ['ev_breakup17', '我們最近，好像一直在讓對方難過。', P], ['ev_breakup17_r', '嗯。也許該停下來想一想。', P],
      ['ev_reunite17', '分開以後，還是常常想到你。', P], ['ev_reunite17_r', '我也是。這次慢慢來吧。', P],
      ['b17_up', '最近跟你在一起很自在。', null], ['b17_up', '{other}，下次也一起吧。', null], ['b17_up', '不知不覺，跟你說的話變多了。', null], ['b17_up', '有你在，日子好像比較好過。', null],
      ['b17_up_r', '我也這麼覺得。', null], ['b17_up_r', '嗯，再約。', null], ['b17_up_r', '你這樣說，我會不好意思。', null],
      ['b17_down', '好一陣子沒好好聊了。', null], ['b17_down', '最近都沒怎麼見到你。', null], ['b17_down_r', '是啊，大家都忙。', null], ['b17_down_r', '……改天再聊。', null],
      ['b17_rival', '你就是這樣，每次都這樣。', null], ['b17_rival_r', '彼此彼此。', null],
      ['b17_letgo', '之前的事，我不放在心上了。', null], ['b17_letgo_r', '……嗯，我也是。', null],
      ['b17_anniv', '{days}天了。謝謝你一直在。', null], ['b17_anniv', '今天是我們的日子，記得嗎？', null], ['b17_anniv', '時間過得真快，已經{days}天了。', null],
      ['b17_anniv_r', '當然記得。', null], ['b17_anniv_r', '以後也一起吧。', null], ['b17_anniv_r', '嗯。往後也請多指教。', null],
    ];
    L.forEach((x, i) => DD.LINES.push({ id: 'b17_' + i, cat: x[0], text: x[1], c: x[2] || null, w: 1, m: true }));
  }

  function init() {
    addData();
    Sim().onDay((d) => { try { settle(d); } catch (e) { console.error('[bond17]', e); } });
    if (Sim().onAwayDay) Sim().onAwayDay((d) => { try { settle(d, { away: true }); } catch (e) { console.error('[bond17 away]', e); } });
  }
  addData();   /* the events and lines exist before the event engine first reads them */
  OC.Bond17 = { init, settle, targetOf, loveOf, loveState, mult, setLayer, layerOf, changesOf, st, on, IDS, TAGS, MAX_TAGS, HOLD, ANNIV_TYPES, LOVE_ZH, COUPLE };
})();
