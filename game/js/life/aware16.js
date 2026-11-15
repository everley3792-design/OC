/* OC Shimeji 16.7 — 自主與世界（OC.Aware）
 *
 *   perception   every couple of game minutes each character on screen looks around: someone sad, asleep, eating, being petted,
 *                thrown, a thing on the ground, the rain starting. What it notices depends on distance, novelty and personality
 *                (curious, caring, timid…); the strongest becomes its focus: it looks over, reacts (emote / thought) and the focus
 *                shapes what it does next (comfort the sad one, keep quiet near a sleeper, go and see the thing on the ground).
 *   upkeep       friends it has not talked to for a while are missed: the AI leans towards them, or goes to where they are.
 *   judgement    no dancing next to someone asleep, quiet in the library, no jokes at someone who is down, shelter from the rain.
 *   replanning   a seat taken / a path blocked is remembered for a while; the next choice avoids it and says why it changed plans.
 *   ground       things the player put down or threw away stay where they are (per place, `save.ground16`); characters react to
 *                them by personality and needs: eat food when hungry (not the fussy ones), play with toys, tidy litter back into
 *                your bag, look at the rest. Items only move through OC.Tx (put = pay, picked up / tidied = get, eaten = gone).
 *   elsewhere    characters at other places use that place's facilities (data with capacities, FAC) and meet each other there:
 *                a short conversation with a real topic (OC.Topic) changes the relationship and leaves a memory.
 * Everything only reorders AI candidates (`shape`) or uses existing APIs (Brain.start, Mind.relPair, OC.Tx); nothing bypasses
 * Brain.reserve / hold, manual characters are left alone, offline catch-up does nothing here.
 */
(function () {
  'use strict';
  const D = () => OC.LifeData, M = () => OC.Mind, Sim = () => OC.Sim, B = () => OC.Brain, Ch = () => OC.Chars, S = () => OC.Store.s, St = () => OC.Store, W = () => OC.World;
  const has = (c, t) => !!(c && c.personality.traits.includes(t));
  const any = (c, ts) => ts.some((t) => has(c, t));
  const nowR = () => performance.now() / 1000;
  const on = () => { const s = S().life.settings; return s.aware16 !== false && s.autonomy !== 'paused'; };
  function st(c) { const l = c.life; const a = l.aw16 || (l.aw16 = {}); a.seen = a.seen || {}; a.fail = a.fail || []; a.focus = a.focus || null; return a; }
  const here = () => (W().area ? W().area.id : 'isle');
  const name = (c) => Ch().name(c);

  // ================================================================ data
  /* loud things you do not do next to a sleeper or in the library */
  const LOUD = ['dance', 'play', 'spin', 'workout', 'g16_play', 'g16_music'];
  const LOUD_SOC = ['joke', 'prank', 'playTogether', 'argue', 'tickle16', 'chase', 'tag16'];
  /* outside things a shower spoils */
  const OUTDOOR = ['observe', 'stargaze', 'cloudwatch', 'tend', 'explore', 'walk', 'play', 'forage', 'fish', 'spin', 'dance', 'workout'];
  const QUIET = { library: '圖書館要安靜' };
  /* facilities of each place: [name, how many at once, activities]. Activities not listed share the place itself (8). */
  const FAC = {
    isle: [['長椅', 2, ['rest', 'read', 'nap', 'daydream']], ['菜園', 2, ['tend']], ['碼頭', 2, ['fish']], ['大樹下', 3, ['observe', 'read']]],
    home: [['床', 2, ['sleep', 'nap']], ['小廚房', 1, ['cook']], ['餐桌', 4, ['eat', 'drink']], ['沙發', 3, ['rest', 'read', 'daydream']], ['書桌', 1, ['study', 'diary']]],
    street: [['商店', 6, ['browse']], ['長椅', 2, ['rest', 'daydream']]],
    cafe: [['雙人桌', 6, ['eat', 'drink', 'rest']], ['咖啡館廚房', 1, ['cook']], ['櫃台', 1, ['work']]],
    library: [['閱讀書桌', 4, ['study', 'read']], ['懶骨頭', 2, ['rest', 'nap', 'daydream']]],
    forest: [['採集點', 3, ['forage']], ['池塘', 2, ['fish']]],
    beach: [['碼頭', 3, ['fish']], ['沙灘毛巾', 2, ['rest', 'nap']], ['沙灘', 6, ['play', 'observe', 'walk']]],
    hill: [['野餐墊', 3, ['rest', 'nap', 'eat']], ['薰衣草田', 4, ['observe', 'daydream', 'tend']], ['風車磨坊', 1, ['work']]],
    fair: [['遊樂設施', 6, ['ride', 'play']], ['點心攤', 4, ['eat', 'drink']]],
  };
  function facOf(place, act) { for (const f of FAC[place] || []) if (f[2].includes(act)) return { zh: f[0], cap: f[1] }; return { zh: '', cap: 8 }; }

  /* what a character does with a thing on the ground (by item kind / id); the activity ids are below in ACTS */
  const PLAY_AS = { harmonica: 'g16_music', sketchbook: 'g16_draw', puzzle: 'g16_puzzle', cards: 'g16_puzzle', blocks: 'g16_puzzle' };
  const ACTS = {
    g16_eat: { zh: '吃地上的東西', ic: '🍙', fx: { food: 160, fun: 20 }, dur: [3, 6], anim: 'eat', cat: 'need' },
    g16_play: { zh: '玩地上的玩具', ic: '🪀', fx: { fun: 200, active: 100, energy: -10 }, dur: [4, 8], anim: 'play', cat: 'fun' },
    g16_music: { zh: '吹口琴', ic: '🎵', fx: { fun: 140, interest: 40 }, dur: [4, 8], anim: 'blow', cat: 'fun' },
    g16_draw: { zh: '在素描本上畫畫', ic: '✏️', fx: { fun: 90, interest: 90 }, dur: [6, 10], anim: 'sketch', sed: true, cat: 'fun' },
    g16_puzzle: { zh: '玩地上的拼圖', ic: '🧩', fx: { fun: 90, interest: 110 }, dur: [6, 10], anim: 'think', sed: true, cat: 'fun' },
    g16_tidy: { zh: '收拾地上的東西', ic: '🧺', fx: { comfort: 60, active: 40 }, dur: [2, 3], anim: 'dig', cat: 'chore' },
    g16_look: { zh: '看看地上的東西', ic: '🔍', fx: { interest: 120, fun: 20 }, dur: [2, 3], anim: 'sniff', cat: 'fun' },
  };
  for (const [k, A] of Object.entries(ACTS)) { A.verb = null; A.aw16 = true; D().ACTS[k] = A; }

  // ================================================================ things on the ground
  const MAX_HERE = 12;
  function ground(place) { const g = S().ground16 || (S().ground16 = {}); return g[place || here()] || (g[place || here()] = []); }
  function itemOf(id) { return OC.Style.ITEMS[id]; }
  function cls(g) { const it = itemOf(g.id) || {}; if (g.mode === 'toss') return 'litter'; if (it.kind === 'food' || it.kind === 'drink') return 'food'; if (it.kind === 'toy') return 'toy'; return 'thing'; }
  /** the player puts one `id` from the bag on the ground next to the character they play ('put'), or throws it away ('toss') */
  function put(id, mode = 'put', at) {
    const it = itemOf(id); if (!it) return { ok: false, why: '沒有這個東西' };
    if (it.kind === 'furniture') return { ok: false, why: '家具要用佈置模式放' };
    if (OC.Store.count(id) < 1) return { ok: false, why: '背包裡沒有' };
    const list = ground(); if (list.length >= MAX_HERE) return { ok: false, why: `這裡的地上已經有 ${MAX_HERE} 樣東西了，先撿一些起來` };
    const p0 = at || (OC.App && OC.App.player) || W().camCenter, n = list.length, a = (n * 2.4) % (Math.PI * 2);
    const q = W().nearestWalkable(p0.x + Math.cos(a) * 16, p0.y + 8 + Math.sin(a) * 8, 30) || W().nearestWalkable(p0.x, p0.y, 30); if (!q) return { ok: false, why: '這裡沒有地方放' };
    const uid = 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const r = OC.Tx.run('g16put:' + uid, { pay: { items: { [id]: 1 } } }, mode === 'toss' ? `丟掉${it.zh}` : `把${it.zh}放在地上`); if (!r.ok) return { ok: false, why: r.why || '放不下' };
    const g = { uid, id, x: q.x, y: q.y, lvl: W().levelAt ? W().levelAt(q.x, q.y) : 0, at: Sim().now(), mode, by: 'player' };
    list.push(g); St().touch('ground'); show(g); St().emit('ground:put', { uid, id, mode, place: here() });
    return { ok: true, uid };
  }
  /** gone from the ground (picked up by you, eaten, tidied away, spoiled) */
  function remove(uid, place) { const list = ground(place); const i = list.findIndex((g) => g.uid === uid); if (i < 0) return null; const g = list.splice(i, 1)[0]; const d = (W().drops || []).find((x) => x.g16 === uid); if (d) W().removeDrop(d); St().touch('ground'); return g; }
  /** the player picks it back up (the World's drop handler calls this after its OC.Tx) */
  function picked(uid) { const g = remove(uid); if (g) St().emit('ground:take', { uid, id: g.id }); return g; }
  function take(uid) { const g = ground().find((x) => x.uid === uid); if (!g) return { ok: false }; const r = OC.Tx.run('g16take:' + uid, { get: { items: { [g.id]: 1 } } }, '撿回來'); if (!r.ok) return r; picked(uid); return { ok: true }; }
  function show(g) {
    if (!W().spawnDrop || (W().drops || []).some((x) => x.g16 === g.uid)) return;
    const it = itemOf(g.id) || {}, col = (it.art && it.art.a) || '#F2B33D';
    const d = W().spawnDrop(g.id, g.x, g.y - 12, g.x, g.y, g.lvl || 0, col, { icon: true }); d.g16 = g.uid; d.key = 'g16take:' + g.uid; d.t = 1;
  }
  /** after a place is built (App.loadArea) */
  function spawnGround() { spoil(); for (const g of ground()) show(g); }
  /** food left out goes off after a game day, things thrown away are gone after two; things put down stay */
  function spoil() {
    const now = Sim().now(), all = S().ground16 || {};
    for (const [pl, list] of Object.entries(all)) for (const g of list.slice()) { const k = cls(g); if ((k === 'food' && now - g.at > 1440) || (g.mode === 'toss' && now - g.at > 2880)) remove(g.uid, pl); }
  }

  /** what each character on screen could do with the things on the ground (AI candidates) */
  function groundCands(c, b) {
    const out = [], list = ground(); if (!list.length || !b.a) return out;
    const A = st(c), now = Sim().now(), lazy = has(c, 'lazy');
    for (const g of list) {
      const dd = Math.hypot(g.x - b.a.x, g.y - b.a.y); if (dd > 260) continue;
      if (Object.values(B().brains || {}).some((o) => o !== b && o.dest && o.dest.k === 'g16:' + g.uid && (o.st === 'go' || o.st === 'do'))) continue;   /* someone else is already going there */
      const it = itemOf(g.id) || {}, k = cls(g), seen = A.seen['g:' + g.uid] != null, dist = dd * 0.0015, focus = A.focus && A.focus.key === 'g:' + g.uid ? 0.3 : 0;
      const C = (act, s, why) => out.push({ kind: 'act', act, target: { pt: { x: g.x, y: g.y, k: 'g16:' + g.uid } }, s: s - dist + focus + (Sim().rnd() - 0.5) * 0.06, why: [why, focus ? '注意到了' : null].filter(Boolean), g16: g.uid });
      if (k === 'food') {
        const pref = OC.Taste ? OC.Taste.pref(c, g.id) : null, lv = pref ? pref.lv : 0, hungry = 1 - c.needs.food / 100;
        if (c.needs.food < 60 && lv > -1 && !any(c, ['neatfreak', 'gourmet'])) C('g16_eat', 0.25 + hungry * 1.1 + lv * 0.15 - (has(c, 'polite') ? 0.15 : 0), `肚子餓・地上有${it.zh}`);
        else if (any(c, ['organized', 'tidy', 'neatfreak', 'caretaker']) && now - g.at > 60) C('g16_tidy', 0.45, `${it.zh}放著會壞掉`);
      } else if (k === 'toy') {
        const play = PLAY_AS[g.id] || 'g16_play', last = (A.toy || {})[g.uid] || -1e9;
        if (now - last > 90 && c.needs.fun < 75 && c.needs.energy > 25) C(play, 0.2 + (1 - c.needs.fun / 100) * 0.9 + (any(c, ['playful', 'mischievous']) ? 0.3 : 0) + (play === 'g16_music' && has(c, 'musical') ? 0.4 : 0) + (play === 'g16_draw' && has(c, 'daydreamer') ? 0.2 : 0) - (lazy ? 0.2 : 0), `地上有${it.zh}`);
      } else if (k === 'litter') {
        if (any(c, ['organized', 'tidy', 'neatfreak', 'caretaker', 'caring']) && !has(c, 'messy')) C('g16_tidy', 0.55 + (has(c, 'neatfreak') ? 0.5 : 0) - (lazy ? 0.3 : 0), `有人把${it.zh}丟在地上`);
      }
      if (!seen || (k === 'thing' && !(A.looked || {})[g.uid])) { const cur = has(c, 'curious') || has(c, 'collector') || has(c, 'adventurous'); if (cur || !seen) C('g16_look', 0.1 + (cur ? 0.45 : 0) + (1 - c.needs.interest / 100) * 0.3 - (lazy ? 0.2 : 0), `那是什麼？（${it.zh}）`); }
    }
    return out;
  }
  /** an activity finished (Brain.finish): what it does to the thing on the ground */
  function onFinish(c, act, b, gm) {
    if (!ACTS[act] || !b || !b.dest || !String(b.dest.k || '').startsWith('g16:')) return;
    const uid = b.dest.k.slice(4), g = ground().find((x) => x.uid === uid), A = st(c); if (!g) { say(c, b.a, 'aw16_gone'); return; }
    const it = itemOf(g.id) || {}, by = g.by === 'player';
    if (act === 'g16_eat') {
      remove(uid); const fx = it.use || { food: 18 }; for (const [k, v] of Object.entries(fx)) if (c.needs[k] != null) c.needs[k] = Math.max(0, Math.min(100, c.needs[k] + v));
      const t = OC.Taste ? OC.Taste.taste(c, g.id) : null; M().feel(c, t && t.lv < 0 ? 'annoyed' : 'happy', 0.25, it.zh);
      M().remember(c, { type: 'event', imp: 0.3, text: by ? `吃了你放在地上的${it.zh}` : `吃了掉在地上的${it.zh}`, key: 'g16eat:' + uid });
      if (by) M().player(c, { aff: 1 }); say(c, b.a, 'aw16_ate', { item: it.zh });
    } else if (act === 'g16_tidy') {
      const r = OC.Tx.run('g16back:' + uid, { get: { items: { [g.id]: 1 } } }, `${name(c)}幫你收好`);
      if (r.ok) { remove(uid); M().feel(c, 'content', 0.2, '收拾'); if (g.mode === 'toss') M().remember(c, { type: 'event', imp: 0.25, text: `把丟在地上的${it.zh}收好了`, key: 'g16tidy:' + uid }); say(c, b.a, 'aw16_tidied', { item: it.zh }); if (OC.UI) OC.UI.toast(`${name(c)}把${it.zh}收回你的背包了`, 'bag'); }
    } else if (act === 'g16_look') {
      (A.looked = A.looked || {})[uid] = Sim().now(); say(c, b.a, cls(g) === 'litter' ? (any(c, ['neatfreak', 'organized']) ? 'aw16_litter' : 'aw16_look') : 'aw16_look', { item: it.zh });
      if (cls(g) === 'litter' && has(c, 'neatfreak')) M().feel(c, 'annoyed', 0.15, '地上有垃圾');
    } else {
      (A.toy = A.toy || {})[uid] = Sim().now(); M().feel(c, 'happy', 0.2, it.zh);
      if (!(A.played || (A.played = {}))[g.id]) { A.played[g.id] = 1; M().remember(c, { type: 'activity', imp: 0.3, text: `玩了地上的${it.zh}`, key: 'g16toy:' + c.id + ':' + g.id }); }
      say(c, b.a, 'aw16_played', { item: it.zh });
      if (OC.Progress && by) OC.Progress.emit('play', { oc: c.id, item: g.id, fresh: false, ground: true });
    }
    void gm;
  }

  // ================================================================ perception & attention
  const BASE = { sad: 0.9, thrown: 1.0, petted: 0.55, sleep: 0.35, eat: 0.3, item: 0.6, rain: 0.7, arrive: 0.5 };
  function percepts(c, b) {
    const out = [], a = b.a; if (!a) return out;
    for (const o of Object.values(B().brains || {})) {
      if (o === b || !o.a || o.a.hidden) continue; const oc = B().charOf(o); if (!oc) continue;
      const d = Math.hypot(o.a.x - a.x, o.a.y - a.y); if (d > 200) continue;
      const e = M().dominant(oc), ie = M().intensity(oc, e);
      if ((e === 'down' || e === 'sad' || e === 'lonely') && ie > 0.35) out.push({ kind: 'sad', key: 's:' + oc.id + ':' + e, who: oc.id, d });
      if (o.st === 'do' && o.act === 'sleep') out.push({ kind: 'sleep', key: 'z:' + oc.id, who: oc.id, d });
      if (o.st === 'do' && (o.act === 'eat' || o.act === 'g16_eat')) out.push({ kind: 'eat', key: 'e:' + oc.id + ':' + Math.floor(Sim().now() / 120), who: oc.id, d });
      if (o.a.act === 'drag' || o.a.flying) out.push({ kind: 'thrown', key: 't:' + oc.id + ':' + Math.floor(Sim().now() / 10), who: oc.id, d });
      if (o.holds && o.holds.has('pet')) out.push({ kind: 'petted', key: 'p:' + oc.id + ':' + Math.floor(Sim().now() / 30), who: oc.id, d });
    }
    for (const g of ground()) { const d = Math.hypot(g.x - a.x, g.y - a.y); if (d < 220) out.push({ kind: 'item', key: 'g:' + g.uid, uid: g.uid, d }); }
    const wx = OC.Clock.weather(), P0 = OC.Places && OC.Places.get(here());
    if (wx === 'rain' && P0 && !P0.interior) out.push({ kind: 'rain', key: 'r:' + Sim().day() + ':' + Math.floor(Sim().now() / 240), d: 0 });
    return out;
  }
  function salience(c, p) {
    let s = BASE[p.kind] || 0.3; s *= 1 - Math.min(0.8, p.d / 260);
    if (p.kind === 'sad') { const r = M().relPeek ? M().relPeek(c.id, p.who) : null; s *= 1 + (any(c, ['caring', 'caretaker', 'gentle']) ? 0.6 : 0) + (r ? r.aff / 200 : 0) - (has(c, 'aloof') ? 0.5 : 0); }
    if (p.kind === 'thrown') s *= 1 + (any(c, ['timid', 'caring']) ? 0.4 : 0);
    if (p.kind === 'petted') s *= 1 + (has(c, 'jealousy') || has(c, 'clingy') ? 0.8 : 0);
    if (p.kind === 'item') s *= 1 + (any(c, ['curious', 'collector', 'adventurous']) ? 0.5 : 0) + (any(c, ['neatfreak', 'organized']) ? 0.3 : 0);
    if (p.kind === 'eat') s *= 1 + (1 - c.needs.food / 100) + (has(c, 'gourmet') ? 0.3 : 0);
    if (p.kind === 'sleep') s *= 1 + (1 - c.needs.energy / 100) * 0.8;
    s *= 0.8 + 0.4 * (c.personality.thinking != null ? 1 - Math.abs(c.personality.thinking - 50) / 100 : 0.5);
    return s;
  }
  const EMOTE = { sad: '💧', thrown: '!', petted: '…', sleep: '💤', eat: '🍙', item: '?', rain: '☔', arrive: '!' };
  /** one look around (every ~2 game minutes per character) */
  function look(c, b) {
    const A = st(c), now = Sim().now(); if (b.st === 'do' && b.act === 'sleep') return null;
    const ps = percepts(c, b); let best = null, bs = 0.3;
    for (const p of ps) { const last = A.seen[p.key]; if (last != null && now - last < 60) continue; const s = salience(c, p) * (b.st === 'do' && D().ACTS[b.act] && D().ACTS[b.act].lock ? 0.4 : 1); if (s > bs) { bs = s; best = p; } }
    for (const p of ps) if (A.seen[p.key] == null) A.seen[p.key] = now;   /* everything around has been seen once */
    trimSeen(A, now);
    if (!best) return null;
    A.seen[best.key] = now; A.focus = { kind: best.kind, key: best.key, who: best.who || null, uid: best.uid || null, at: now, until: now + 25, s: +bs.toFixed(2) };
    const a = b.a; let tx = null;
    if (best.who) { const o = B().get(best.who); if (o && o.a) tx = o.a.x; } else if (best.uid) { const g = ground().find((x) => x.uid === best.uid); if (g) tx = g.x; }
    if (tx != null && b.st !== 'social') a.tFace = Math.max(-1, Math.min(1, (tx - a.x) * 0.08)) || 0.4;
    if (OC.App && OC.App.emote && b.st !== 'social') OC.App.emote(a, EMOTE[best.kind] || '!');
    const other = best.who ? Ch().get(best.who) : null, g = best.uid ? ground().find((x) => x.uid === best.uid) : null;
    if (b.st !== 'social' && Sim().rnd() < 0.55) say(c, a, 'aw16_see_' + best.kind, { other, item: g ? (itemOf(g.id) || {}).zh : '' }, true);
    if (best.kind === 'petted' && (has(c, 'jealousy') || has(c, 'clingy'))) M().feel(c, 'jealous', 0.15, `${name(other)}被摸了`);
    if (best.kind === 'thrown') M().feel(c, has(c, 'mischievous') ? 'happy' : 'nervous', 0.12, `${name(other)}被丟了出去`);
    B().dlog && B().dlog(b, `注意到：${ZH[best.kind](other, g)}`);
    return A.focus;
  }
  const ZH = { sad: (o) => `${name(o)}心情不好`, thrown: (o) => `${name(o)}被丟出去`, petted: (o) => `${name(o)}被摸摸`, sleep: (o) => `${name(o)}在睡覺`, eat: (o) => `${name(o)}在吃東西`, item: (o, g) => `地上有${g ? (itemOf(g.id) || {}).zh : '東西'}`, rain: () => '下雨了', arrive: (o) => `${name(o)}來了` };
  function trimSeen(A, now) { const ks = Object.keys(A.seen); if (ks.length > 60) for (const k of ks) if (now - A.seen[k] > 240) delete A.seen[k]; }
  function say(c, a, cat, vars = {}, thought) {
    if (!a || !OC.App || !OC.App.bubble || !S().life.settings.bubbles) return null;
    const ln = OC.Talk.say(cat, c, vars.other || null, { vars: { thing: vars.item || '' } }); if (!ln) return null;
    OC.App.bubble(a, ln.text, thought ? null : name(c), 2.4, thought ? { thought: true } : {}); return ln;
  }

  // ================================================================ shaping the AI's choice
  /** Brain.decide → after Mind11/Arcs: perception, upkeep, judgement, replanning, things on the ground */
  function shape(c, b, list) {
    if (!c || !b || !on() || B().manualMode(b) && !(b.manualOverride > nowR())) return list;
    if (b.queued) return list;   /* a player request is not second-guessed */
    const now = Sim().now(), A = st(c), f = A.focus && A.focus.until > now ? A.focus : null, all = B().brains || {};
    const add = (x, d, why) => { x.s += d; x.why.unshift(why); };
    /* things on the ground */
    if (b.a) list.push(...groundCands(c, b));
    /* who is asleep nearby */
    const sleepers = b.a ? Object.values(all).filter((o) => o !== b && o.a && o.st === 'do' && o.act === 'sleep' && Math.hypot(o.a.x - b.a.x, o.a.y - b.a.y) < 140) : [];
    const quiet = QUIET[here()], P0 = OC.Places && OC.Places.get(here()), wx = OC.Clock.weather(), outside = P0 && !P0.interior;
    for (const x of list) {
      const loud = (x.kind === 'act' && LOUD.includes(x.act)) || (x.kind === 'social' && LOUD_SOC.includes(x.social));
      if (loud && sleepers.length) add(x, has(c, 'mischievous') ? -0.2 : -0.7, `${name(B().charOf(sleepers[0]))}在睡覺`);
      if (loud && quiet) add(x, -0.8, quiet);
      if (x.kind === 'act' && OUTDOOR.includes(x.act) && outside && wx === 'rain' && !has(c, 'adventurous')) add(x, -0.45, '下雨了');
      if (x.kind === 'travel' && wx === 'rain' && outside) { const T = OC.Places.get(x.place); if (T && T.interior) add(x, 0.35, '躲雨'); }
      if (x.kind === 'social' && ['joke', 'prank'].includes(x.social)) { const oc = Ch().get(x.other); const e = oc && M().dominant(oc); if (oc && ['down', 'sad', 'lonely'].includes(e) && M().intensity(oc, e) > 0.3 && !has(c, 'blunt')) add(x, -0.6, `${name(oc)}心情不好`); }
      if (x.kind === 'act' && (x.act === 'nap' || x.act === 'rest') && sleepers.length && c.needs.energy < 55) add(x, 0.25, '看別人睡，自己也想睡');
    }
    /* the focus */
    if (f) for (const x of list) {
      if (f.kind === 'sad' && x.kind === 'social' && x.other === f.who && ['comfort', 'hug16', 'cheerup16', 'pat16'].includes(x.social)) add(x, 0.5 + (any(c, ['caring', 'caretaker']) ? 0.3 : 0), `注意到${name(Ch().get(f.who))}心情不好`);
      if (f.kind === 'eat' && x.kind === 'act' && (x.act === 'eat' || x.act === 'g16_eat') && c.needs.food < 70) add(x, 0.3, '看別人吃，肚子也餓了');
      if (f.kind === 'thrown' && x.kind === 'social' && x.other === f.who && ['comfort', 'chat'].includes(x.social)) add(x, 0.35, '擔心剛才被丟出去的');
      if (f.kind === 'petted' && x.kind === 'social' && x.other === f.who && (has(c, 'jealousy') || has(c, 'clingy'))) add(x, 0.25, '在意');
    }
    /* keeping in touch: friends not talked to for a while */
    upkeep(c, b, list, add);
    /* replanning: what just failed is avoided for a while */
    const t = nowR(); A.fail = A.fail.filter((x) => t - x.t < 120);
    for (const x of list) for (const fl of A.fail) {
      if (x.kind !== 'act' || x.act !== fl.act) continue; const same = fl.slot && x.target && x.target.slot && x.target.slot.k === fl.slot;
      add(x, same || !fl.slot ? -1.2 : -0.3, `剛才${fl.why}`);
    }
    return list.sort((x, y) => y.s - x.s);
  }
  /** friends one has not talked to for a while are missed: lean towards them here, or go to where they are */
  function upkeep(c, b, list, add) {
    const now = Sim().now(), sa = c.life.socialAt || {};
    for (const oc of Ch().all()) {
      if (oc.id === c.id) continue; const r = M().relPeek ? M().relPeek(c.id, oc.id) : null; if (!r || r.aff < 25) continue;
      const close = ['friend', 'bestfriend', 'partner', 'family', 'parent', 'child', 'sibling', 'lover', 'spouse'].includes(r.type) || r.aff >= 45;
      if (!close) continue;
      const last = sa[oc.id]; if (last == null) continue;   /* only real conversations count (the relationship's own clock is not in game minutes) */
      const days = (now - last) / 1440; if (days < 1) continue;
      const miss = Math.min(0.9, (days - 0.6) * 0.3) * (0.6 + c.personality.social / 125) * (has(c, 'aloof') || has(c, 'independent') ? 0.5 : 1) * (has(c, 'clingy') ? 1.4 : 1);
      if (miss < 0.08) continue;
      const why = `好久沒和${name(oc)}說話了（${Math.floor(days)} 天）`;
      let hit = false; for (const x of list) if (x.kind === 'social' && x.other === oc.id && !['argue', 'prank'].includes(x.social)) { add(x, miss, why); hit = true; }
      if (hit) continue;
      const loc = oc.life.loc || 'isle'; if (loc === here() || !OC.Places || !OC.Places.open(loc) || S().life.settings.travel === false || (OC.People && !OC.People.canTravel(c)) || c.life.trip) continue;
      if (miss < 0.3 || (B().manualMode && B().manualMode(b))) continue;
      const acts = (OC.Places.get(loc).acts || []).filter((a) => D().ACTS[a] && !D().ACTS[a].cmdOnly && !D().ACTS[a].aw16 && !['sleep', 'work'].includes(a));
      const act = acts.includes('rest') ? 'rest' : acts[0]; if (!act) continue;
      const tm = OC.Places.travelMin(here(), loc);
      list.push({ kind: 'travel', place: loc, act, s: miss * 0.9 - tm / 90, why: [`想去${OC.Places.get(loc).zh}找${name(oc)}`, why], seek: oc.id });
    }
  }
  /** Brain.decide chose `ch`: if it changed plans because something failed, say so (log + a thought) */
  function chosen(c, b, ch) {
    const A = st(c), t = nowR(), fl = A.fail.find((x) => !x.told && t - x.t < 30); if (!fl || !ch) return;
    fl.told = true; const was = (D().ACTS[fl.act] || {}).zh || fl.act, now = ch.kind === 'act' ? D().ACTS[ch.act].zh : ch.kind === 'travel' ? '去' + OC.Places.get(ch.place).zh : (D().SOCIAL[ch.social] || {}).zh;
    const text = `改變計畫：本來想${was}，但${fl.why}，改成${now}`;
    B().dlog && B().dlog(b, text); b.dbg.replan = text;
    if (!c.life.log) c.life.log = []; c.life.log.unshift({ gm: Sim().now(), text }); if (c.life.log.length > 40) c.life.log.length = 40;
    if (b.a && Sim().rnd() < 0.6) say(c, b.a, 'aw16_replan', { item: was }, true);
    if (ch.seek) b.seek16 = ch.seek;
  }
  /** Brain: starting / doing `act` failed (`why`), maybe at a seat */
  function failed(b, act, why, slot) {
    const c = B().charOf(b); if (!c || !act) return; const A = st(c);
    A.fail.unshift({ act, why: why || '做不了', slot: slot || null, t: nowR() }); if (A.fail.length > 6) A.fail.length = 6;
  }

  // ================================================================ life elsewhere: facilities and meetings
  /** abstractStep: drop activities whose facility at that place is full */
  function absFilter(c, loc, list, now) {
    if (!FAC[loc]) return list;
    const busy = {}; for (const o of Ch().all()) { if (o.id === c.id || (o.life.loc || 'isle') !== loc) continue; const cu = o.life.cur; if (!cu || cu.until <= now || !cu.fac) continue; busy[cu.fac] = (busy[cu.fac] || 0) + 1; }
    return list.filter((x) => { if (x.pl && x.pl !== loc) return true; const f = facOf(loc, x.act); return !f.zh || (busy[f.zh] || 0) < f.cap; });
  }
  /** abstractStep started `cur` at `loc`: which facility */
  function absStart(c, cur) { const loc = String(cur.place || '').replace('place:', ''); const f = facOf(loc, cur.act); if (f.zh) { cur.fac = f.zh; cur.placeZh = (cur.placeZh || '') + (cur.placeZh ? '的' : '') + f.zh; } }
  /** characters away from you, at the same place, awake: sometimes they meet and talk (a real topic, a real relationship change) */
  function meetElsewhere() {
    if (Sim().catching || !on()) return;
    const now = Sim().now(), H = here(), by = {};
    for (const c of Ch().all()) {
      const b = B().get(c.id); if (b && b.a) continue; if (!c.status || !c.status.onIsland) continue;
      const loc = c.life.loc || 'isle'; if (loc === H || c.life.trip || (c.life.cur && c.life.cur.act === 'sleep')) continue;
      if (B().manualMode && b && B().manualMode(b)) continue;
      (by[loc] = by[loc] || []).push(c);
    }
    for (const [loc, cs] of Object.entries(by)) {
      if (cs.length < 2) continue;
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const A = cs[i], Bc = cs[j], sa = A.life.socialAt || {}; if (sa[Bc.id] != null && now - sa[Bc.id] < 90) continue;
        const r = M().relPeek ? M().relPeek(A.id, Bc.id) : null, aff = r ? r.aff : 0, conflict = r ? r.conflict : 0;
        const want = ((100 - A.needs.social) + (100 - Bc.needs.social)) / 200, p = 0.08 + want * 0.35 + aff / 400 - conflict / 200;
        if (Sim().rnd() > p) continue;
        talkAway(A, Bc, loc, now);
      }
    }
  }
  function talkAway(A, Bc, loc, now) {
    const P0 = OC.Places.get(loc), T = OC.Topic, pick = T && T.choose ? T.choose(A, Bc) : null, t = pick ? pick.t : null;
    const sA = t ? T.stance(A, t) : 0, sB = t ? T.stance(Bc, t) : 0, agree = t && Math.sign(sA) === Math.sign(sB) && Math.abs(sA) > 0.15 && Math.abs(sB) > 0.15, clash = t && sA * sB < -0.12;
    for (const [x, y] of [[A, Bc], [Bc, A]]) { (x.life.socialAt = x.life.socialAt || {})[y.id] = now; x.needs.social = Math.min(100, x.needs.social + 14); }
    M().relPair(A.id, Bc.id, { fam: 1, aff: agree ? 1 : 0 }, '在別的地方聊天');
    if (clash && !(has(A, 'gentle') && has(Bc, 'gentle')) && (has(A, 'stubborn') || has(Bc, 'stubborn'))) M().relPair(A.id, Bc.id, { conflict: 1 }, '意見不合');
    if (t && T.st) for (const [x, y, s] of [[A, Bc, sB], [Bc, A, sA]]) { const K = T.st(x); (K.know[y.id] = K.know[y.id] || {})[t.key] = Math.round(s * 100) / 100; (K.talked[y.id] = K.talked[y.id] || {})[t.key] = now; }
    const zh = t ? t.zh : '最近的事', day = Sim().day();
    for (const [x, y] of [[A, Bc], [Bc, A]]) {
      M().remember(x, { type: 'social', imp: 0.25, who: [y.id], place: 'place:' + loc, text: `在${P0.zh}和${name(y)}聊了${zh}${agree ? '，很聊得來' : clash ? '，意見不太一樣' : ''}`, key: `abs16:${x.id}:${y.id}:${day}` });
      if (!x.life.log) x.life.log = []; x.life.log.unshift({ gm: now, text: `在${P0.zh}和${name(y)}聊${zh}` }); if (x.life.log.length > 40) x.life.log.length = 40;
    }
    const log = S().life.convlog || (S().life.convlog = []); log.unshift({ at: Date.now(), gm: now, a: A.id, b: Bc.id, zh, ic: t ? t.ic : '💬', place: loc, lines: [], away: true }); if (log.length > 40) log.length = 40;
    St().emit('aware:met', { a: A.id, b: Bc.id, place: loc, topic: zh, agree: !!agree });
  }

  // ================================================================ the loop
  let lookT = 0, meetT = 0;
  function step(g) {
    if (Sim().catching || !on()) return;
    lookT += g; meetT += g;
    if (lookT >= 2) {
      lookT = 0;
      for (const b of Object.values(B().brains || {})) { if (!b.a || b.holds.size || b.st === 'event') continue; const c = B().charOf(b); if (c) look(c, b); }
    }
    if (meetT >= 10) { meetT = 0; meetElsewhere(); spoil(); }
  }
  function init() {
    Sim().onStep(step);
    /* a thing was put down / thrown away in front of everyone: they all notice it a little sooner */
    St().on && St().on('ground:put', () => { lookT = 2; });
  }

  OC.Aware = { LOUD, OUTDOOR, FAC, ACTS, PLAY_AS, st, ground, put, take, picked, remove, spawnGround, spoil, groundCands, onFinish, percepts, salience, look, shape, upkeep, chosen, failed, absFilter, absStart, meetElsewhere, talkAway, step, init, facOf, cls };
})();
