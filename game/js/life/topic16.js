/* OC Shimeji 16.6 — OC.Topic: what two characters talk about, and how a conversation moves.
 *
 *   topics      what is around them: something one of them just did, a place, a food, the weather, the season, a friend (gossip),
 *               an interest, a memory they share, a dream, and about sixty everyday subjects (ABSTRACT, in topics16d.js).
 *   stance(c,t) how a character feels about a topic, −1…1 — from its tastes (OC.Taste), traits (OC.Traits13), interests, likes /
 *               dislikes, its relationship with the person talked about, and a stable personal leaning (a hash, so it does not flicker).
 *   script()    a conversation is a chain of behaviours, each one an answer to the line before it:
 *                 raise → agree | disagree | ask | share | joke | meh | switch
 *                 ask → explain · agree → build | share · disagree → defend | concede · joke → laugh | flat · share → react
 *                 switch → the other one raises its own topic · … → wrap
 *               every line is chosen by the dialogue engine (categories t16_<behaviour>, conditions tk = topic kind, ts = tone) so
 *               each voice / trait / mood says it differently; the line knows the topic and the previous line.
 *   resolve()   after the talk: they remember each other's stance (c.life.t16.know), agreeing brings them a little closer, a real
 *               disagreement adds a little friction (never changes the relationship type), gossip nudges how the listener sees the
 *               third person (only when it trusts the speaker; never fixed relations, never with 「鎖定關係」; once a day per pair).
 *   bubbles     a conversation the player is not part of shows keyword bubbles (an emoji and the topic); 偷聽 shows the real lines
 *               (S().life.settings.chatView = 'kw' | 'full'). Everything said is kept in a short log (S().life.convlog, 40), but a
 *               conversation nobody listened to shows only its topic there.
 *   askPlayer() when a character near you has nothing to talk about it may ask you (shared allowance OC.Budget, kind 'ask'):
 *               pick a topic or type anything — an offline keyword dictionary (DICT) finds the topic; the answer is remembered.
 * Nothing here gives items or coins, sends progress events, or runs during offline catch-up.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, M = () => OC.Mind, D = () => OC.LifeData, Sim = () => OC.Sim, Ch = () => OC.Chars;
  const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
  const has = (c, t) => OC.Chars.has(c, t);
  const name = (c) => OC.Chars.name(c);
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
  const lean = (c, key) => hash(c.id + '|' + key) - 0.5;   /* stable personal leaning, −0.5…0.5 */
  const st = (c) => { const L = c.life; if (!L.t16 || typeof L.t16 !== 'object') L.t16 = { know: {}, talked: {}, gos: {}, player: {}, n: 0 }; for (const k of ['know', 'talked', 'gos', 'player']) if (!L.t16[k]) L.t16[k] = {}; return L.t16; };
  const day = () => Math.floor(Sim().now() / 1440);
  const X = () => OC.Topic16Data || { ABSTRACT: [], DICT: [] };

  // ================================================================ topics
  /** a topic: { key, kind, zh, ic, ref } — kind ∈ act place food wx season person hobby mem dream x */
  function topic(key, o = {}) {
    const [kind, ...rest] = key.split(':'), ref = rest.join(':');
    switch (kind) {
      case 'act': { const A = D().ACTS[ref]; return A ? { key, kind, zh: A.zh, ic: A.ic || '✨', ref } : null; }
      case 'place': { const P = OC.Places && OC.Places.get(ref); return P ? { key, kind, zh: P.zh, ic: P.ic || '📍', ref } : null; }
      case 'food': { const it = OC.Style.ITEMS[ref]; return it ? { key, kind, zh: it.zh, ic: it.ic || '🍽', ref } : null; }
      case 'wx': { const w = OC.Clock.weather(); return { key, kind, zh: (OC.Clock.WX_ZH && OC.Clock.WX_ZH[w]) || '天氣', ic: (OC.Clock.WX_ICON && typeof OC.Clock.WX_ICON[w] === 'string' && OC.Clock.WX_ICON[w].length <= 3 ? OC.Clock.WX_ICON[w] : { clear: '☀️', cloudy: '⛅', rain: '🌧', fog: '🌫' }[w]) || '🌤', ref: w }; }
      case 'season': { const s = OC.Clock.season ? OC.Clock.season() : 'spring'; return { key, kind, zh: { spring: '春天', summer: '夏天', autumn: '秋天', winter: '冬天' }[s] || '這個季節', ic: { spring: '🌸', summer: '🌻', autumn: '🍂', winter: '⛄' }[s] || '🍃', ref: s }; }
      case 'person': { const p = Ch().get(ref); return p ? { key, kind, zh: name(p), ic: '🗣', ref } : null; }
      case 'hobby': return ref ? { key, kind, zh: ref, ic: o.ic || '💡', ref } : null;
      case 'mem': return o.zh ? { key, kind, zh: o.zh, ic: '📷', ref } : null;
      case 'dream': return { key, kind, zh: o.zh || '昨晚的夢', ic: '🌙', ref };
      case 'x': { const a = X().ABSTRACT.find((y) => y[0] === ref); return a ? { key, kind, zh: a[1], ic: a[2], ref, depth: a[3] } : null; }
      default: return null;
    }
  }

  /** how c feels about topic t: −1 … 1 */
  function stance(c, t) {
    if (!c || !t) return 0;
    let s = lean(c, t.key) * 0.6;
    const P = c.profile || {}, likes = (P.likes || []).concat(P.hobbies || []), dis = P.dislikes || [];
    const mention = (arr) => arr.some((w) => w && (String(w).includes(t.zh) || t.zh.includes(String(w))));
    switch (t.kind) {
      case 'act': { const v = OC.Traits13 && OC.Traits13.act ? OC.Traits13.act(c, t.ref) : 0; s += clamp(Number(v) || 0, -1, 1) * 0.6; const A = D().ACTS[t.ref] || {}; if (A.fx && A.fx.active > 0) s += (c.personality.energy - 50) / 140; if (A.fx && A.fx.interest > 0) s += (c.personality.thinking - 50) / 160; if (A.fx && A.fx.social > 0) s += (c.personality.social - 50) / 160; break; }
      case 'food': { const t0 = OC.Taste && OC.Taste.prefs ? OC.Taste.prefs(c).food[t.ref] : null; const lv = t0 ? t0.lv : OC.Taste && OC.Taste.derived ? OC.Taste.derived(c, t.ref) : 0; s = s * 0.4 + lv / 2.2; break; }
      case 'person': { const r = M().relPeek ? M().relPeek(c.id, t.ref) : null; if (r) s = s * 0.2 + clamp(((r.aff || 0) - (r.conflict || 0)) / 50); break; }
      case 'wx': { const w = t.ref; if (w === 'clear') s += (c.personality.energy - 45) / 120; if (w === 'rain') s += has(c, 'calm') || has(c, 'bookworm') ? 0.35 : -0.15; if (w === 'fog') s += has(c, 'calm') ? 0.2 : -0.1; break; }
      case 'mem': s = s * 0.3 + 0.35; break;
      case 'dream': s = s * 0.5 + 0.2; break;
      case 'x': { if (t.depth === 'deep') s += (c.personality.thinking - 50) / 110; if (t.depth === 'fun') s += (c.personality.expression - 50) / 110; break; }
      default: break;
    }
    if (mention(likes)) s = 0.6 + Math.max(0, s) * 0.4; else if (mention(dis)) s = -0.6 + Math.min(0, s) * 0.4;   /* its own interests and likes are always clearly liked (a leaning only adds to it) */
    return clamp(s);
  }
  const tone = (s) => (s > 0.22 ? 'pos' : s < -0.22 ? 'neg' : 'neu');

  /** what A might bring up with B — [{ t, w, why }] */
  function candidates(A, B) {
    const out = [], add = (t, w, why) => { if (t && w > 0) out.push({ t, w, why }); };
    const T = st(A), talked = T.talked[B.id] || {}, kn = T.know[B.id] || {};
    const recent = A.life.rec && A.life.rec.lastAct; if (recent) add(topic('act:' + recent), 1.2, '剛做過');
    for (const s of M().sharedInterests ? M().sharedInterests(A, B) : []) add(topic('hobby:' + s), 1.6, '共同興趣');
    for (const s of (A.profile.hobbies || []).slice(0, 4)) add(topic('hobby:' + s), 0.8, '自己的興趣');
    { const m = M().recall ? M().recall(A, B.id) : null; if (m && m.text) add(topic('mem:' + (m.key || m.at || 'm'), { zh: String(m.text).replace(/。$/, '').split(name(B)).join('你').replace(/^(和|跟)你/, '我們') }), 1.3, '一起的回憶');   /* told to the one it is about: 「和小空…」→「我們…」 */ }
    add(topic('wx'), 0.55, '天氣'); add(topic('season'), 0.35, '季節');
    { const here = OC.World && OC.World.area ? OC.World.area.id : null; if (here) add(topic('place:' + here), 0.5, '這裡'); }
    { const tasted = OC.Taste && OC.Taste.prefs ? Object.entries(OC.Taste.prefs(A).tasted || {}).sort((x, y) => (y[1].last || 0) - (x[1].last || 0)).slice(0, 2) : []; for (const [id] of tasted) add(topic('food:' + id), 0.8, '最近吃過'); }
    { const rAB = M().relPeek ? M().relPeek(A.id, B.id) : null; if (rAB && (rAB.trust || 0) >= 20) for (const p of Ch().all()) { if (p.id === A.id || p.id === B.id) continue; const t = topic('person:' + p.id); if (Math.abs(stance(A, t)) > 0.3) add(t, 0.8, '八卦'); } }
    for (const [k, v] of Object.entries(kn)) if (v > 0.4 && !k.startsWith('mem:') && !k.startsWith('person:')) add(topic(k), 1.1, '記得對方喜歡');
    { const l15 = A.life.l15, d = l15 && l15.dreams && l15.dreams[0]; if (d && d.text && Sim().now() - (d.gm || 0) < 1440) add(topic('dream', { zh: '昨晚的夢' }), 0.7, '夢'); }
    { const ab = X().ABSTRACT; for (let i = 0; i < 4 && ab.length; i++) { const a = ab[Math.floor(Sim().rnd() * ab.length)]; add(topic('x:' + a[0]), 0.45, '隨口'); } }
    for (const x of out) { if (talked[x.t.key] && Sim().now() - talked[x.t.key] < 1440) x.w *= 0.15; x.w *= 0.5 + Math.abs(stance(A, x.t)); }
    return out;
  }
  function choose(A, B, not) { const c = candidates(A, B).filter((x) => !not || x.t.key !== not); return c.length ? Sim().wpick(c, (x) => x.w) : null; }

  // ================================================================ a conversation as a chain of behaviours
  const KW = { raise: (t) => `${t.ic} ${t.zh}？`, agree: () => '👍', disagree: () => '🙅', ask: () => '❓', explain: (t) => `${t.ic}…`, share: (t) => `${t.ic}！`, joke: () => '😆', laugh: () => '😂', flat: () => '😶', meh: () => '…', switch: (t) => `💭→${t.ic}`, defend: () => '❗', concede: () => '🤝', build: () => '✨', react: () => '😮', recall: (t) => `💭${t.ic}`, gossip: (t) => `🤫 ${t.zh}`, wrap: () => '👋' };
  const ANIM = { agree: 'nod', disagree: 'shake', ask: 'think', explain: 'talk', share: 'talk', joke: 'laugh', laugh: 'laugh', flat: 'shrug', meh: 'shrug', defend: 'stomp', concede: 'nod', react: 'surprised', switch: 'think', wrap: 'wave', build: 'happy', recall: 'think', gossip: 'talk' };

  /** after `prev` by the other one, what does `c` do? */
  function answer(prev, c, o, t, sMe, sOther, step) {
    const r = Sim().rnd(), p = c.personality;
    switch (prev) {
      case 'raise': case 'gossip': case 'recall': {
        if (Math.abs(sMe) < 0.15 && (has(c, 'curious') || r < 0.45)) return 'ask';
        if (Math.sign(sMe) === Math.sign(sOther) && Math.abs(sMe) >= 0.22) return r < 0.35 ? 'share' : 'agree';
        if (Math.sign(sMe) !== Math.sign(sOther) && Math.abs(sMe) >= 0.3 && Math.abs(sOther) >= 0.2) return 'disagree';
        if (p.expression > 62 && r < 0.3) return 'joke';
        if (Math.abs(sMe) < 0.2 && p.social < 45 && r < 0.5) return 'meh';
        return r < 0.5 ? 'share' : 'agree';
      }
      case 'ask': return 'explain';
      case 'explain': case 'share': return Math.abs(sMe) < 0.2 && r < 0.4 ? 'react' : Math.sign(sMe) === Math.sign(sOther) ? (r < 0.5 ? 'build' : 'agree') : 'react';
      case 'agree': case 'build': return r < 0.45 ? 'build' : 'share';
      case 'disagree': return has(c, 'stubborn') || has(c, 'proud') || (p.thinking > 65 && r < 0.6) ? 'defend' : 'concede';
      case 'defend': return has(c, 'gentle') || has(c, 'shy') || r < 0.55 ? 'concede' : 'disagree';
      case 'joke': { const fun = (p.expression - 30) / 100 + (Sim().rnd() - 0.4) * 0.6; return fun > 0.15 ? 'laugh' : 'flat'; }
      case 'laugh': case 'flat': case 'react': case 'concede': return 'build';
      case 'meh': return 'switch';
      default: return 'agree';
    }
  }

  /** build the lines of a topic conversation (called by Brain.Social.script for chat / share) */
  function script(conv, say, A, B, r) {
    const deep = (A.personality.social + B.personality.social) / 2 > 55 || (r && r.aff > 40);
    const n = Math.min(8, 3 + (deep ? 2 : 0) + ((A.personality.social > 60 && B.personality.social > 60) ? 1 : 0) + (conv.kind === 'share' ? 1 : 0));
    let pick = choose(A, B); if (!pick) return false;
    let t = pick.t; const rec = conv.t16 = { key: t.key, zh: t.zh, ic: t.ic, kind: t.kind, topics: [t.key], zhs: { [t.key]: t.zh }, beh: [], agree: 0, disagree: 0, concede: 0, gossip: null, keys: [t.key] };
    const speakers = [['a', A, B], ['b', B, A]];
    let beh = t.kind === 'person' ? 'gossip' : (st(A).know[B.id] || {})[t.key] > 0.4 ? 'recall' : 'raise';
    if (t.kind === 'person') rec.gossip = t.ref;
    const line = (who, c, o, b, tt) => {
      const s = stance(c, tt);
      say(who, 't16_' + b, { vars: { topic: tt.zh, topicIc: tt.ic }, tk: tt.kind, ts: tone(s), beh: b, kw: (KW[b] || KW.agree)(tt), anim: ANIM[b] || null, dur: 1.5, t16: tt.key });
      rec.beh.push(b); if (b === 'agree' || b === 'build') rec.agree++; if (b === 'disagree') rec.disagree++; if (b === 'concede') rec.concede++;
    };
    line('a', A, B, beh, t);
    for (let i = 1; i < n; i++) {
      const [who, c, o] = speakers[i % 2], next = answer(beh, c, o, t, stance(c, t), stance(o, t), i);
      if (next === 'switch') {
        const np = choose(c, o, t.key); if (!np) break;
        line(who, c, o, 'switch', np.t); t = np.t; rec.topics.push(t.key); rec.keys.push(t.key); rec.zhs[t.key] = t.zh; beh = 'raise';
        if (t.kind === 'person' && !rec.gossip) rec.gossip = t.ref;
        continue;
      }
      line(who, c, o, next, t); beh = next;
    }
    line(speakers[n % 2][0], speakers[n % 2][1], speakers[n % 2][2], 'wrap', t);
    return true;
  }

  /** after an accepted topic conversation: memory of stances, closeness, friction, gossip, log */
  function resolve(conv, A, B) {
    const rec = conv.t16; if (!rec) return;
    const now = Sim().now(), TA = st(A), TB = st(B);
    for (const key of rec.keys) {
      const t = topic(key, { zh: (rec.zhs && rec.zhs[key]) || rec.zh }); if (!t) continue;
      (TA.know[B.id] = TA.know[B.id] || {})[key] = Math.round(stance(B, t) * 100) / 100;
      (TB.know[A.id] = TB.know[A.id] || {})[key] = Math.round(stance(A, t) * 100) / 100;
      (TA.talked[B.id] = TA.talked[B.id] || {})[key] = now; (TB.talked[A.id] = TB.talked[A.id] || {})[key] = now;
    }
    for (const T of [TA, TB]) { T.n = (T.n || 0) + 1; for (const o of Object.keys(T.know)) { const e = Object.entries(T.know[o]); if (e.length > 30) T.know[o] = Object.fromEntries(e.slice(-30)); } for (const o of Object.keys(T.talked)) { const e = Object.entries(T.talked[o]); if (e.length > 30) T.talked[o] = Object.fromEntries(e.slice(-30)); } }
    if (rec.agree >= 2) M().relPair(A.id, B.id, { aff: 1 }, '聊得來');
    if (rec.disagree && !rec.concede && !(has(A, 'gentle') && has(B, 'gentle'))) M().relPair(A.id, B.id, { conflict: 2 }, '意見不合');
    if (rec.disagree && rec.concede) M().relPair(A.id, B.id, { trust: 1 }, '聽進了對方的話');
    /* gossip: the listener's view of the third person moves a little — only when it trusts the speaker */
    if (rec.gossip) {
      const C = Ch().get(rec.gossip), sA = C ? stance(A, topic('person:' + C.id)) : 0, trust = (M().relPeek(B.id, A.id) || {}).trust || 0, rBC = M().relPeek(B.id, C ? C.id : '');
      const k = C ? C.id : null;
      if (C && trust >= 25 && Math.abs(sA) > 0.3 && !(rBC && rBC.fixed) && !S().life.settings.lockRel && TB.gos[k] !== day() && C.id !== B.id) {
        TB.gos[k] = day(); M().relChange(B.id, C.id, { aff: sA > 0 ? 1 : -1 }, `聽${name(A)}說起${name(C)}`);
        rec.gossipFx = sA > 0 ? 1 : -1;
      }
    }
    log(conv, A, B);
    OC.Store.touch('life', { t16: A.id });
  }

  // ================================================================ keyword bubbles, eavesdropping, the log
  function settings() { return S().life.settings; }
  /** show the real words? (your character is in it, you arranged it, you are listening, or the setting says so) */
  function full(conv) { if (!conv) return true; if (settings().chatView === 'full' || conv.byPlayer || conv.heard) return true; const me = S().activeId; return !!(conv.a && conv.a.id === me) || !!(conv.b && conv.b.id === me); }
  const convOf = (id) => OC.Brain.convs.find((x) => (x.a && x.a.id === id) || (x.b && x.b.id === id)) || null;
  function listen(id) {
    const conv = convOf(id); if (!conv) return false;
    conv.heard = true; const L = convlog(), e = L.find((x) => x.conv === conv.id); if (e) e.heard = true; OC.Store.touch('life', { convlog: 1 }); return true;
  }
  const convlog = () => (S().life.convlog = Array.isArray(S().life.convlog) ? S().life.convlog : []);
  /** a spoken line (from Brain's talk loop) */
  function spoke(conv, who, text) {
    if (!conv || !conv.t16) return;
    const L = convlog(); let e = L.find((x) => x.conv === conv.id);
    if (!e) { e = { conv: conv.id, at: Date.now(), gm: Sim().now(), a: conv.a.id, b: conv.b.id, topic: conv.t16.zh, ic: conv.t16.ic, heard: full(conv), lines: [] }; L.unshift(e); if (L.length > 40) L.length = 40; }
    if (full(conv)) e.heard = true;
    e.lines.push({ who: who === 'a' ? conv.a.id : conv.b.id, text });
    if (e.lines.length > 12) e.lines.length = 12;
  }
  function log(conv, A, B) { const e = convlog().find((x) => x.conv === conv.id); if (e) { e.topics = conv.t16.topics.map((k) => (conv.t16.zhs && conv.t16.zhs[k]) || k); e.mood = conv.t16.disagree && !conv.t16.concede ? 'clash' : conv.t16.agree >= 2 ? 'warm' : 'plain'; } }
  function entries(id) { return convlog().filter((e) => !id || e.a === id || e.b === id); }

  function logSheet(id) {
    const { h } = OC.UI, c = id ? Ch().get(id) : null;
    OC.UI.sheet(c ? `${name(c)}最近聊了什麼` : '最近的對話', (b) => {
      const list = entries(id).slice(0, 20);
      if (!list.length) { b.append(h('p.muted', null, '還沒有聊過天。')); return; }
      for (const e of list) {
        const a = Ch().get(e.a), o = Ch().get(e.b); if (!a || !o) continue;
        const head = h('div.hstack', { style: { gap: '6px' } }, h('b', null, `${e.ic || '💬'} ${(e.topics || [e.topic]).join(' → ')}`), h('small.muted', { style: { marginLeft: 'auto' } }, `${name(a)} × ${name(o)}`));
        const body = e.heard ? h('div.t16-lines', null, ...e.lines.map((l) => h('div', null, h('b', null, name(Ch().get(l.who)) + '：'), l.text))) : h('small.muted', null, '（沒有聽到內容——下次可以「偷聽」）');
        b.append(h('div.card.t16-log', { style: { padding: '10px 12px', marginBottom: '8px' } }, head, body));
      }
    });
  }

  // ================================================================ asking the player
  let asking = null;
  /** an offline keyword dictionary: free text → a topic key (or null) */
  function match(text) {
    const s = String(text || '').trim(); if (!s) return null;
    /* the specific catalogues first (longest name wins), the generic dictionary last; a dish also matches by its last two characters (咖哩 → 晴日咖哩) */
    let best = null; const hit = (zh, key, n) => { if (zh && n >= 2 && (!best || n > best.n)) best = { key, n }; };
    for (const [id, it] of Object.entries(OC.Style.ITEMS)) { if (!it.zh || !(OC.Items.isFood && OC.Items.isFood(id)) || /_q[23]$/.test(id)) continue; if (s.includes(it.zh)) hit(it.zh, 'food:' + id, it.zh.length + 1); else if (it.zh.length >= 3 && s.includes(it.zh.slice(-2))) hit(it.zh, 'food:' + id, 2); }
    if (OC.Places) for (const [pid, P] of Object.entries(OC.Places.P || {})) if (P.zh && s.includes(P.zh)) hit(P.zh, 'place:' + pid, P.zh.length + 1);
    for (const c of Ch().all()) { const n = name(c); if (n && s.includes(n)) hit(n, 'person:' + c.id, n.length + 2); }
    for (const [id, A] of Object.entries(D().ACTS)) if (A.zh && A.zh.length >= 2 && s.includes(A.zh)) hit(A.zh, 'act:' + id, A.zh.length);
    if (best) return best.key;
    for (const a of X().ABSTRACT) if ((a[4] || []).concat(a[1]).some((w) => s.includes(w))) return 'x:' + a[0];
    for (const [words, key] of X().DICT) if (words.some((w) => s.includes(w))) return key;
    return null;
  }
  /** may this character ask you now? (Budget, setting, not busy, near you) */
  function canAsk(c) {
    if (!c || settings().askChat === false || settings().lively === 'legacy' || asking) return false;
    if (OC.Sim.catching || (OC.Budget && !OC.Budget.can('ask'))) return false;
    const b = OC.Brain.get(c.id); if (!b || !b.a || b.holds.size || b.st === 'social' || b.st === 'event') return false;
    const T = st(c); if (T.askDay === day()) return false;
    return true;
  }
  /** Sim.onStep: now and then a character with nothing to say asks you */
  function tick() {
    if (asking || settings().askChat === false || settings().lively === 'legacy') return;
    if (Sim().rnd() > 0.02) return;
    const near = Ch().all().filter((c) => canAsk(c) && c.needs.social < 55 && (c.needs.fun < 60 || c.needs.interest < 60));
    if (!near.length) return;
    askPlayer(near[Math.floor(Sim().rnd() * near.length)]);
  }
  function askPlayer(c, o = {}) {
    if (!c || asking) return null;
    const { h } = OC.UI; const T = st(c); T.askDay = day(); if (OC.Budget && !o.force) OC.Budget.spend('ask');
    OC.Brain.hold(c.id, 'menu');
    const opener = OC.Talk.say('t16_askplayer', c, null, {}) || { text: '有空嗎？想聽你說點什麼。' };
    const pool = []; for (const k of ['wx', 'season']) pool.push(topic(k)); { const ab = X().ABSTRACT.slice(); for (let i = 0; i < 3 && ab.length; i++) { const a = ab.splice(Math.floor(Sim().rnd() * ab.length), 1)[0]; pool.push(topic('x:' + a[0])); } }
    const choices = pool.filter(Boolean).slice(0, 4);
    let done = false;
    const finish = (key, typed) => {
      if (done) return; done = true; const res = answerPlayer(c, key, typed); asking && asking.close(); return res;
    };
    asking = OC.UI.sheet(`${name(c)}想跟你聊聊`, (b, api) => {
      b.append(h('p', { style: { margin: '0 0 10px' } }, `「${opener.text}」`));
      const row = h('div.t16-chips', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } }, ...choices.map((t) => h('button.chip-btn', { 'data-t16': t.key, on: { click: () => finish(t.key) } }, `${t.ic} ${t.zh}`)));
      const inp = h('input.input', { placeholder: '或是打字告訴牠…（例如：今天吃了咖哩）', maxlength: 60, style: { flex: 1 } });
      const send = h('button.btn.primary', { 'data-t16send': '1', on: { click: () => finish(match(inp.value), inp.value) } }, '說');
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send.click(); });
      b.append(row, h('div.hstack', { style: { gap: '8px', marginTop: '12px' } }, inp, send), h('button.btn.block', { style: { marginTop: '10px' }, 'data-t16later': '1', on: { click: () => { done = true; api.close(); } } }, '現在不方便'));
      if (OC.Pick && OC.Pick.guard) OC.Pick.guard(b, 200);
    }, { onClose: () => { asking = null; OC.Brain.unhold(c.id, 'menu'); } });
    return asking;
  }
  /** the player's answer → a reply, remembered (never a reward) */
  function answerPlayer(c, key, typed) {
    const t = key ? topic(key, { zh: typed }) : null, T = st(c);
    let cat = 't16_pl_none', s = 0;
    if (t) { s = stance(c, t); cat = s > 0.22 ? 't16_pl_like' : s < -0.22 ? 't16_pl_dislike' : 't16_pl_new'; T.player[t.key] = (T.player[t.key] || 0) + 1; }
    const out = OC.Talk.say(cat, c, null, { vars: { topic: t ? t.zh : '這個' }, tk: t ? t.kind : null });
    const a = OC.App && OC.App.actorOf ? OC.App.actorOf(c.id) : null;
    if (out && a && OC.App.bubble) OC.App.bubble(a, out.text, name(c), null, {});
    M().player(c, { aff: 1 });
    M().remember(c, { type: 'social', imp: 0.25, who: [], text: t ? `和你聊了${t.zh}` : '和你聊了一會兒', key: `t16p:${c.id}:${day()}` });
    if (t && s > 0.22) M().feel(c, 'happy', 0.3, '和你聊天'); else M().feel(c, 'calm', 0.2, '和你聊天');
    OC.Store.touch('life', { t16p: c.id });
    return { key: t ? t.key : null, cat, text: out && out.text };
  }

  if (OC.Sim && OC.Sim.onStep) OC.Sim.onStep(() => { try { tick(); } catch (e) { console.error('[topic ask]', e); } });
  OC.Topic = { convOf, topic, stance, tone, candidates, choose, script, resolve, full, listen, spoke, entries, logSheet, match, canAsk, tick, askPlayer, answerPlayer, KW, st, get asking() { return asking; } };
})();
