/* OC Shimeji 16.8 — 住處與家庭（OC.House16）
 *
 *   houses     three homes on the island: the big family house (珊瑚屋頂, the old 「我的家」, place 'home'), the two-storey
 *              terrace (紫屋頂, 'phouse', 3–4) and the little house (黃屋頂, 'yhouse', 2). Each is a real interior you can walk into
 *              and decorate; characters sleep in their own house (Brain asks placeOf) and only residents sleep in its beds.
 *   moving in  moveIn(id, house): the people already living there react through their relationship and personality
 *              (warm · ok · reluctant · refuse, each with a reason). A refusal stops it unless the player forces it — then the move
 *              happens with consequences (a little resentment, a memory, a week of friction). No confirmation dialogs.
 *   together   every game day, people sharing a house get a little closer (familiarity); clashing habits rub (tidy vs messy, light
 *              sleeper vs noisy), caring ones look after the others. A weekly letter sums it up (OC.Budget.mail).
 *              Sharing a double bed / bunk is decided by the relationship (partners, family, close friends) — not a fixed rule.
 *   babies     a baby cannot look after itself: adult or teenage housemates in the same place come and look after it (feed, hold,
 *              settle) when its needs drop; milestones (rolling over … the first word) become memories.
 *   family     off by default (life settings). A couple living together may wish for a child (asks you through OC.Budget);
 *              if you agree a baby arrives a few days later. Adoption is a button on a house. Every new character is created only
 *              because the player said yes. Romance and children stay with adults (People.minor / Mind.romanceOK).
 *   tree       the family tree is drawn from the relationships (parent → child, partners), page 「住處與家人」.
 */
(function () {
  'use strict';
  const D = () => OC.LifeData, M = () => OC.Mind, Sim = () => OC.Sim, B = () => OC.Brain, Ch = () => OC.Chars, S = () => OC.Store.s, St = () => OC.Store, W = () => OC.World;
  const has = (c, t) => !!(c && c.personality.traits.includes(t));
  const any = (c, ts) => ts.some((t) => has(c, t));
  const name = (c) => Ch().name(c);
  const H = () => OC.Homes;

  // ================================================================ furniture, places, interiors
  const I = OC.Style.ITEMS;
  Object.assign(I, {
    bed2: { zh: '雙人床', kind: 'furniture', price: 380, sell: 140, d: '兩個人睡也很寬。誰和誰睡在一起，看他們自己的關係。', fp: [2, 2] },
    bunk: { zh: '上下舖', kind: 'furniture', price: 320, sell: 120, d: '上舖和下舖。適合兄弟姊妹或室友。', fp: [1, 2] },
    kidbed: { zh: '兒童床', kind: 'furniture', price: 200, sell: 70, d: '小小的床，給幼兒和小孩睡。', fp: [1, 2] },
    crib: { zh: '嬰兒床', kind: 'furniture', price: 240, sell: 90, d: '有欄杆的小床，寶寶在這裡睡覺。', fp: [1, 1] },
  });
  { const s = OC.Shops && OC.Shops.SHOPS && OC.Shops.SHOPS.furniture; if (s) for (const id of ['bed2', 'bunk', 'kidbed', 'crib']) if (!s.items.includes(id)) s.items.push(id); }
  /** which beds fit which life stage */
  const BED = { bed: { n: 1 }, bed2: { n: 2 }, bunk: { n: 2, up: [0, 22] }, kidbed: { n: 1, ages: ['toddler', 'child'] }, crib: { n: 1, ages: ['baby'] } };

  const P = OC.Places.P, homeActs = ['sleep', 'nap', 'eat', 'rest', 'read', 'study', 'tidy', 'play', 'daydream', 'cook', 'diary', 'meditate', 'sweep'];
  P.yhouse = P.yhouse || { zh: '黃屋頂小屋', type: 'home', area: 'yhouse', parent: 'isle', interior: true, icon: 'home', col: '#FFC93C', decor: true,
    d: '一廳一臥的小屋，最多住兩個人。', facilities: ['雙人床', '小餐桌', '小廚房'], acts: homeActs.slice(), finds: [] };
  P.phouse = P.phouse || { zh: '紫屋頂連棟屋', type: 'home', area: 'phouse', parent: 'isle', interior: true, icon: 'home', col: '#9B7BE0', decor: true,
    d: '樓上樓下各自的房間，共用客廳和廚房，住三到四個人。', facilities: ['上下舖', '床', '餐桌', '廚房', '書櫃'], acts: homeActs.slice(), finds: [] };
  Object.assign(OC.Places.STARTER, {
    yhouse: [{ id: 'bed2', x: 228, y: 320 }, { id: 'table', x: 150, y: 380 }, { id: 'chair', x: 118, y: 380 }, { id: 'stove', x: 140, y: 312 }, { id: 'rug', x: 200, y: 410 }, { id: 'plant', x: 272, y: 420 }],
    phouse: [{ id: 'bunk', x: 96, y: 300 }, { id: 'bed', x: 300, y: 300 }, { id: 'bookshelf', x: 196, y: 274 }, { id: 'table', x: 200, y: 400 }, { id: 'chair', x: 160, y: 404 }, { id: 'chair', x: 240, y: 404 }, { id: 'stove', x: 320, y: 420 }, { id: 'rug', x: 110, y: 430 }],
  });
  const AR = OC.Areas;
  if (AR._interior) {
    const Mo = OC.Models;
    AR.yhouse = AR._interior({ id: 'yhouse', zh: '黃屋頂小屋', parent: 'isle', exitZh: '回到島上', decor: true, room: { x0: 100, y0: 290, x1: 300, y1: 450 }, floor: '#E8C48A', wall: '#FFF6E0', stripe: '#FCE9B8', curtain: '#FFC93C', windows: [-50, 50], lights: [[200, 360]],
      build(ctx) { const rug = new THREE.Mesh(new THREE.CircleGeometry(20, 28), Mo.mat('#FFE9A8')); rug.rotation.x = -Math.PI / 2; rug.position.copy(ctx.V3(200, 438, 0, 0.3)); ctx.root.add(rug); } });
    AR.phouse = AR._interior({ id: 'phouse', zh: '紫屋頂連棟屋', parent: 'isle', exitZh: '回到島上', decor: true, room: { x0: 70, y0: 260, x1: 350, y1: 470 }, floor: '#C9A27A', wall: '#F7F1FF', stripe: '#E9DEFA', curtain: '#9B7BE0', windows: [-90, 0, 90], lights: [[140, 340], [280, 400]],
      build(ctx) { const st = new THREE.Group(); for (let i = 0; i < 5; i++) Mo.add(st, Mo.rbox(26, 4, 10, 1), Mo.mat('#B88A5C'), 0, 2 + i * 4, -i * 6); OC.Areas._h.place(ctx, st, 330, 300, 0, 0); ctx.block(330, 300, 30, 30); } });
    /* the two front doors on the island */
    const prevIsle = AR.isleExtra;
    AR.isleExtra = (ctx) => {
      prevIsle && prevIsle(ctx);
      ctx.interact({ type: 'home', to: 'yhouse', x: 116, y: 662, hit: { w: 60, h: 80, d: 6 }, at: { x: 116, y: 676 }, label: '黃屋頂小屋' });
      ctx.interact({ type: 'home', to: 'phouse', x: 500, y: 528, hit: { w: 60, h: 80, d: 6 }, at: { x: 500, y: 542 }, label: '紫屋頂連棟屋' });
    };
    AR.isle.doors = Object.assign(AR.isle.doors || {}, { yhouse: { x: 116, y: 680 }, phouse: { x: 500, y: 546 } });
    AR.isle.exits = (AR.isle.exits || []).concat([{ to: 'yhouse', x: 116, y: 676, label: '黃屋頂小屋' }, { to: 'phouse', x: 500, y: 542, label: '紫屋頂連棟屋' }]);
  }
  /* the houses are open now */
  if (H()) { const HS = H().HOUSES; HS.yellow.place = 'yhouse'; HS.yellow.open = true; HS.purple.place = 'phouse'; HS.purple.open = true; }

  // ================================================================ where do you live
  const PLACE_OF = { coral: 'home', yellow: 'yhouse', purple: 'phouse' }, HOUSE_OF = { home: 'coral', yhouse: 'yellow', phouse: 'purple' };
  const HOME_PLACES = ['home', 'yhouse', 'phouse'];
  function houseOf(c) { return (c && H() && H().of(c)) || null; }
  /** the place a character goes home to (no house chosen → the big house, as before) */
  function placeOf(c) { return PLACE_OF[houseOf(c) || 'coral'] || 'home'; }
  const isHome = (pl) => HOME_PLACES.includes(pl);
  function residents(hid) { return H() ? H().residents(hid) : []; }
  function housemates(c) { const hid = houseOf(c); return hid ? residents(hid).filter((x) => x.id !== c.id) : []; }
  const stageOf = (c) => (OC.People && OC.People.stage(c) ? OC.People.stage(c).id : 'adult');
  const young = (c) => ['baby', 'toddler', 'child'].includes(stageOf(c));

  /** may `c` share a bed with `o`? (partners, family, very close friends; never an adult with a minor who is not family) */
  function shareOK(c, o) {
    if (!o) return true; const r = M().relPeek ? M().relPeek(c.id, o.id) : null; if (!r) return false;
    const fam = r.type === 'family' || r.kind16 === 'parent' || r.kind16 === 'sibling';
    if (OC.People && (OC.People.minor(c) !== OC.People.minor(o)) && !fam) return false;
    if (['partner', 'engaged', 'lover'].includes(r.type)) return true;
    if (fam) return r.conflict < 40;
    return r.aff >= 70 && r.trust >= 50 && r.conflict < 20 && !any(c, ['aloof', 'independent', 'slowwarm']);
  }
  /** Brain.bestSlot asks: may `c` use slot `s` of object `o` for `verb`? */
  function slotOK(c, o, s, verb) {
    const bed = o.kind && BED[o.kind]; const here = W().area ? W().area.id : '';
    if (isHome(here) && (verb === 'sleep') && placeOf(c) !== here) return false;   /* you sleep in your own house */
    if (o.kind === 'home' && o.place && o.place !== placeOf(c)) return false;   /* the island door of someone else's house */
    if (!bed) return verb !== 'sleep' || !young(c) || stageOf(c) !== 'baby' || o.kind === 'home';
    const st = stageOf(c);
    if (bed.ages && !bed.ages.includes(st)) return false;
    if (st === 'baby' && o.kind !== 'crib') return false;
    if (bed.n > 1) { for (const s2 of o.slots) { if (s2 === s) continue; const who = B().res.get(s2.k); if (who && who !== c.id && !shareOK(c, Ch().get(who))) return false; } }
    return true;
  }
  /** Brain.rebuild: beds become slots (one per sleeper) */
  function bedSlots(f) {
    const b = BED[f.id]; if (!b) return null; const sc = f.sc || 1;
    if (f.id === 'bunk') return [0, 1].map((i) => ({ i, x: f.x, y: f.y + 2, ax: f.x + 16 * sc, ay: f.y + 6, seatY: 6 + b.up[i], fx: 0, back: 0, lie: true }));
    if (b.n === 2) return [-1, 1].map((s2, i) => ({ i, x: f.x + s2 * 9 * sc, y: f.y + 2, ax: f.x + s2 * 26 * sc, ay: f.y + 8, seatY: 6, fx: 0, back: 0, lie: true }));
    return [{ i: 0, x: f.x, y: f.y + 2, ax: f.x + 14 * sc, ay: f.y + 6, seatY: f.id === 'crib' ? 9 : 5, fx: 0, back: 0, lie: true }];
  }

  // ================================================================ moving in
  function reaction(R, mover, hid, after) {
    const r = M().relPeek ? M().relPeek(R.id, mover.id) : null, why = [];
    let s = r ? (r.aff - r.conflict) / 50 + r.fam / 200 : -0.1;
    if (r && (r.type === 'family' || r.type === 'partner' || r.type === 'engaged' || r.type === 'lover')) { s += 1; why.push(r.type === 'family' ? '是家人' : '是另一半'); }
    else if (r && r.aff >= 45) why.push('感情不錯');
    else if (!r || r.type === 'stranger') why.push('還不熟');
    if (r && r.conflict >= 30) why.push('之前有過摩擦');
    if (r && r.type === 'rival') { s -= 0.6; why.push('是對手'); }
    if (any(R, ['homebody', 'aloof', 'independent', 'slowwarm'])) { s -= 0.35; why.push('喜歡自己的空間'); }
    if (any(R, ['caring', 'easygoing', 'outgoing', 'caretaker'])) s += 0.3;
    if (after > (H().HOUSES[hid].min || 2)) { s -= 0.2; why.push('家裡會變擠'); }
    if (young(mover) && r && r.type === 'family') s += 0.5;
    const k = s >= 1.2 ? 'warm' : s >= 0.4 ? 'ok' : s >= -0.3 ? 'reluctant' : 'refuse';
    return { id: R.id, r: k, s: +s.toFixed(2), why: why.slice(0, 2).join('、') || (k === 'warm' ? '很歡迎' : '沒什麼意見') };
  }
  const RE = { warm: ['😊', '很歡迎'], ok: ['🙂', '可以'], reluctant: ['😐', '有點勉強'], refuse: ['🙁', '不想'] };
  function reactions(id, hid) { const c = Ch().get(id); const list = residents(hid).filter((x) => x.id !== id); return list.map((R) => reaction(R, c, hid, list.length + 1)); }
  /** move a character into a house. { force: true } moves in against a refusal (with consequences). */
  function moveIn(id, hid, o = {}) {
    const c = Ch().get(id); if (!c) return { ok: false, why: '找不到角色' };
    if (hid && !H().HOUSES[hid]) return { ok: false, why: '沒有這棟房子' };
    if (hid && houseOf(c) === hid) return { ok: false, why: `${name(c)}已經住在這裡` };
    if (hid && residents(hid).filter((x) => x.id !== id).length >= H().HOUSES[hid].max) return { ok: false, why: `${H().HOUSES[hid].zh}最多住 ${H().HOUSES[hid].max} 人`, full: true };
    const rs = hid ? reactions(id, hid) : [], no = rs.filter((x) => x.r === 'refuse');
    if (no.length && !o.force) return { ok: false, why: `${no.map((x) => name(Ch().get(x.id))).join('、')}不想和${name(c)}住`, reactions: rs, canForce: true };
    const r = H().assign(c, hid); if (!r || r.ok === false) return { ok: false, why: (r && r.why) || '搬不進去' };
    const zh = hid ? H().HOUSES[hid].zh : '', day = Sim().day();
    if (hid) M().remember(c, { type: 'event', imp: 0.5, text: `搬進了${zh}`, key: `move:${id}:${hid}:${day}` });
    for (const x of rs) {
      const R = Ch().get(x.id); if (!R) continue;
      if (x.r === 'refuse') {
        const rel = M().relPeek(R.id, id); if (!(rel && rel.fixed)) M().relChange(R.id, id, { aff: -6, conflict: 10 }, '被硬塞了室友');
        M().feel(R, 'annoyed', 0.45, `${name(c)}硬是搬進來`); M().remember(R, { type: 'event', imp: 0.45, who: [id], text: `${name(c)}不顧我的意思搬進來了`, key: `forced:${R.id}:${id}:${day}` });
        const h = st(R); h.forced = h.forced || {}; h.forced[id] = day;
      } else if (x.r === 'warm') { M().feel(R, 'happy', 0.25, `${name(c)}搬來了`); M().relPair(R.id, id, { fam: 3 }, '成為室友'); }
      else M().relPair(R.id, id, { fam: 2 }, '成為室友');
    }
    if (o.force && no.length) M().feel(c, 'nervous', 0.3, '硬搬進去');
    St().touch('life', { home: id }); St().emit('home16:move', { id, hid, forced: !!(o.force && no.length) });
    return { ok: true, reactions: rs, forced: !!(o.force && no.length) };
  }
  function st(c) { const l = c.life; return l.h16 || (l.h16 = {}); }

  // ================================================================ living together (every game day)
  const SAVE = () => { const L = S().life; return L.h16 || (L.h16 = { week: {}, asked: {}, pending: [] }); };
  function dayStep(day) {
    if (Sim().catching) return;
    const G = SAVE(), wk = Math.floor(day / 7);
    for (const hid of Object.keys(H().HOUSES)) {
      const rs = residents(hid).filter((c) => c.status && c.status.onIsland !== false); if (rs.length < 2) continue;
      const W0 = (G.week[hid] = G.week[hid] && G.week[hid].wk === wk ? G.week[hid] : { wk, close: 0, rub: [], care: [] });
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j]; M().relPair(a.id, b.id, { fam: 1 }, '同住'); W0.close++;
        const rub = (x, y, why, n) => { const r = M().relPeek(x.id, y.id); if (r && r.fixed) return; M().relChange(x.id, y.id, { conflict: n }, why); W0.rub.push(`${name(x)}：${why}`); if (Sim().rnd() < 0.35) M().remember(x, { type: 'event', imp: 0.25, who: [y.id], text: `和${name(y)}${why}`, key: `rub:${x.id}:${y.id}:${day}` }); };
        for (const [x, y] of [[a, b], [b, a]]) {
          if (any(x, ['neatfreak', 'organized', 'tidy']) && has(y, 'messy')) rub(x, y, '為了家裡亂不亂有點摩擦', 2);
          if (has(x, 'lightsleeper') && any(y, ['musical', 'restless', 'playful', 'performer'])) rub(x, y, '嫌晚上太吵', 1);
          const f = st(x).forced; if (f && f[y.id] != null && day - f[y.id] <= 7) rub(x, y, '還沒習慣多一個室友', 2);
          else if (f && f[y.id] != null && day - f[y.id] === 8) { M().remember(x, { type: 'event', imp: 0.3, who: [y.id], text: `漸漸習慣和${name(y)}一起住了`, key: `used:${x.id}:${y.id}` }); delete f[y.id]; }
          if (any(x, ['caring', 'caretaker'])) { M().relChange(y.id, x.id, { aff: 1 }, '被照顧'); W0.care.push(name(x)); }
        }
      }
      if (day % 7 === 6 && OC.Budget && OC.Budget.mail) {
        const zh = H().HOUSES[hid].zh, rubs = [...new Set(W0.rub)].slice(0, 3), cares = [...new Set(W0.care)];
        OC.Budget.mail({ kind: 'home', title: `${zh}的這一週`, text: `${rs.map(name).join('、')}一起住了一週。` + (rubs.length ? `小摩擦：${rubs.join('；')}。` : '沒有什麼摩擦。') + (cares.length ? `${cares.join('、')}很照顧大家。` : ''), key: `h16:${hid}:${wk}` });
      }
    }
    babies(day);
    family(day);
  }

  // ================================================================ babies
  const MILES = [[2, 'roll', '第一次翻身'], [5, 'crawl', '會爬了'], [9, 'stand', '扶著東西站起來了'], [14, 'walk', '走出了第一步'], [20, 'word', '說出了第一句話']];
  function babies(day) {
    for (const c of Ch().all()) {
      if (stageOf(c) !== 'baby') continue; const h = st(c); h.days = (h.days || 0) + 1; h.ms = h.ms || {};
      for (const [d, k, zh] of MILES) {
        if (h.ms[k] || h.days < d || (h.cared || 0) < Math.ceil(d / 2)) continue; h.ms[k] = day;
        const fam = Ch().all().filter((o) => o.id !== c.id && (housemates(c).includes(o) || ((M().relPeek(o.id, c.id) || {}).kind16 === 'parent')));
        for (const o of [c].concat(fam)) M().remember(o, { type: 'event', imp: 0.7, who: o === c ? [] : [c.id], text: o === c ? zh : `${name(c)}${zh}`, key: `ms:${c.id}:${k}:${o.id}` });
        if (OC.Budget && OC.Budget.mail) OC.Budget.mail({ kind: 'family', title: `${name(c)}${zh}`, text: `${name(c)}${zh}！${fam.length ? fam.map(name).join('、') + '都看到了。' : ''}`, key: `ms:${c.id}:${k}` });
        break;
      }
    }
  }
  const CARE = { zh: '照顧寶寶', ic: '🍼', fx: { comfort: 30, energy: -25 }, dur: [4, 8], anim: 'carry', cat: 'chore', verb: null, aw16: true };
  D().ACTS.babycare16 = CARE;
  /** candidates: look after the baby you live with when it needs something */
  function shape(c, b, list) {
    if (!b || !b.a || b.queued || (B().manualMode(b) && !(b.manualOverride > performance.now() / 1000))) return list;
    if (young(c)) return list;
    const now = Sim().now(), ph = OC.Clock.phase();
    for (const o of housemates(c)) {
      const ob = B().get(o.id); if (!ob || !ob.a) continue;
      const d = Math.hypot(ob.a.x - b.a.x, ob.a.y - b.a.y);
      if (stageOf(o) === 'baby') {
        const need = Math.min(o.needs.food, o.needs.social, o.needs.comfort);
        if (need < 55 && !Object.values(B().brains).some((x) => x !== b && x.dest && x.dest.k === 'baby:' + o.id && (x.st === 'go' || x.st === 'do'))) {
          const q = W().nearestWalkable(ob.a.x + 14, ob.a.y + 4, 24) || { x: ob.a.x, y: ob.a.y };
          list.push({ kind: 'act', act: 'babycare16', target: { pt: { x: q.x, y: q.y, k: 'baby:' + o.id } }, s: 0.5 + (55 - need) / 40 + (any(c, ['caring', 'caretaker']) ? 0.3 : 0) - d * 0.001, why: [`${name(o)}需要照顧`] });
        }
        continue;
      }
      /* good morning / back home: housemates greet and chat a little more */
      if (d < 220 && ['morning', 'evening'].includes(ph)) for (const x of list) if (x.kind === 'social' && x.other === o.id && ['chat', 'greet'].includes(x.social)) { x.s += 0.2; x.why.unshift(ph === 'morning' ? '早安（住在一起）' : '回到家（住在一起）'); }
    }
    void now; return list;
  }
  function onFinish(c, act, b) {
    if (act !== 'babycare16' || !b || !b.dest || !String(b.dest.k || '').startsWith('baby:')) return;
    const o = Ch().get(b.dest.k.slice(5)); if (!o) return;
    for (const [k, v] of [['food', 40], ['social', 40], ['comfort', 30], ['sleep', 10]]) if (o.needs[k] != null) o.needs[k] = Math.min(100, o.needs[k] + v);
    const h = st(o); h.cared = (h.cared || 0) + 1;
    M().feel(o, 'happy', 0.3, `${name(c)}抱抱`); M().feel(c, c.needs.energy < 30 ? 'tired' : 'content', 0.2, `照顧${name(o)}`);
    M().relPair(c.id, o.id, { fam: 1, aff: 1 }, '照顧');
    if (h.cared === 1 || Sim().rnd() < 0.1) M().remember(c, { type: 'event', imp: 0.35, who: [o.id], text: `照顧了${name(o)}`, key: `care:${c.id}:${o.id}:${Sim().day()}` });
    if (OC.App && OC.App.bubble && S().life.settings.bubbles) { const ln = OC.Talk.say('h16_care', c, o); if (ln) OC.App.bubble(b.a, ln.text, name(c), 2.2); }
  }

  // ================================================================ family: children and adoption (off by default; always with your consent)
  const famOn = () => !!S().life.settings.family16;
  const isCouple = (a, b) => { const r = M().relPeek(a.id, b.id); return r && ['partner', 'engaged', 'lover'].includes(r.type); };
  const adult = (c) => !(OC.People && OC.People.minor(c)) && !young(c) && stageOf(c) !== 'teen';
  function couples() {
    const out = [];
    for (const hid of Object.keys(H().HOUSES)) { const rs = residents(hid); for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (isCouple(rs[i], rs[j]) && adult(rs[i]) && adult(rs[j])) out.push([rs[i], rs[j], hid]); }
    return out;
  }
  function family(day) {
    if (!famOn()) return; const G = SAVE();
    for (const p of G.pending.slice()) if (day >= p.due) { G.pending.splice(G.pending.indexOf(p), 1); const a = Ch().get(p.a), b = Ch().get(p.b); if (a && b) birth(a, b); }
    if (G.asking) return;
    for (const [a, b, hid] of couples()) {
      const key = [a.id, b.id].sort().join(':'), last = G.asked[key] || -1e9; if (day - last < 28) continue;
      if (!(M().romanceOK && M().romanceOK(a.id, b.id))) continue;
      const r = M().relPeek(a.id, b.id); if (!r || r.aff < 60) continue;
      if (G.pending.some((p) => [p.a, p.b].sort().join(':') === key)) continue;
      if (residents(hid).length >= H().HOUSES[hid].max) continue;
      if (Sim().rnd() > 0.2) continue;
      if (OC.Budget && !OC.Budget.can('ask')) return;
      OC.Budget && OC.Budget.spend('ask'); G.asked[key] = day; G.asking = { a: a.id, b: b.id, hid, day };
      setTimeout(() => askChild(), 0); return;
    }
  }
  /** the couple asks you (a sheet with three answers; closing it = later) */
  function askChild() {
    const G = SAVE(), q = G.asking; if (!q || !OC.UI || !OC.UI.sheet) return;
    const a = Ch().get(q.a), b = Ch().get(q.b); if (!a || !b) { G.asking = null; return; }
    let done = false; const h = OC.h || OC.UI.h;
    OC.UI.sheet(`${name(a)}和${name(b)}想迎接一個孩子`, (box, api) => {
      box.append(h('p', null, `兩個人住在${H().HOUSES[q.hid].zh}，感情很好。他們想問你的意見。答應的話，幾天後會有一個寶寶加入你的島。`),
        h('div.vstack', { style: { gap: '8px', marginTop: '10px' } },
          h('button.btn.primary.block', { 'data-h16': 'yes', on: { click: () => { done = true; answerChild('yes'); api.close(); } } }, '好啊，期待寶寶'),
          h('button.btn.block', { 'data-h16': 'later', on: { click: () => { done = true; answerChild('later'); api.close(); } } }, '再等等'),
          h('button.btn.ghost.block', { 'data-h16': 'no', on: { click: () => { done = true; answerChild('no'); api.close(); } } }, '現在不要')));
      if (OC.Pick) OC.Pick.guard(box);
    }, { onClose: () => { if (!done) answerChild('later'); } });
  }
  function answerChild(ans) {
    const G = SAVE(), q = G.asking; if (!q) return; G.asking = null; const a = Ch().get(q.a), b = Ch().get(q.b), day = Sim().day();
    if (!a || !b) return;
    if (ans === 'yes') { G.pending.push({ a: a.id, b: b.id, due: day + 3, hid: q.hid }); for (const [x, y] of [[a, b], [b, a]]) { M().feel(x, 'happy', 0.5, '要有寶寶了'); M().remember(x, { type: 'bond', imp: 0.6, who: [y.id], text: `和${name(y)}決定迎接一個孩子`, key: `wish:${x.id}:${day}` }); } }
    else if (ans === 'no') { G.asked[[a.id, b.id].sort().join(':')] = day + 56; for (const x of [a, b]) M().feel(x, 'down', 0.15, '還不是時候'); }
    else G.asked[[a.id, b.id].sort().join(':')] = day - 21;   /* ask again in about a week */
    St().touch('life');
  }
  const STAGE_AGE = { baby: '0', toddler: '2', child: '6' };
  /** create a child (born to a couple or adopted). Only called after the player said yes. */
  function makeChild(o) {
    const parents = (o.parents || []).map((id) => Ch().get(id)).filter(Boolean), p0 = parents[0];
    const c = Ch().blank('custom'); c.profile.name = String(o.name || '').trim().slice(0, 12) || (p0 ? name(p0).slice(0, 1) + '寶' : '寶寶');
    c.profile.age = STAGE_AGE[o.stage || 'baby'] || '0';   /* the life stage scales the body (People) */
    if (p0) c.profile.species = p0.profile.species;
    const rig = parents.find((p) => p.appearance && p.appearance.mode !== 'sprite');
    if (rig && !o.adopt) { c.appearance = JSON.parse(JSON.stringify(rig.appearance)); }
    c.profile.intro = o.adopt ? `被${parents.map(name).join('和')}領養的孩子。` : `${parents.map(name).join('和')}的孩子。`;
    Ch().add(c); const nc = Ch().get(c.id) || c;
    for (const p of parents) OC.Opening && OC.Opening.setStart(p.id, nc.id, 'parent', { lock: true });
    for (const sib of Ch().all()) { if (sib.id === nc.id) continue; if (parents.some((p) => ((M().relPeek(p.id, sib.id) || {}).kind16 === 'parent' && (M().relPeek(p.id, sib.id) || {}).label16 === '孩子'))) OC.Opening && OC.Opening.setStart(nc.id, sib.id, 'sibling', { lock: true }); }
    const hid = o.hid || (p0 && houseOf(p0)); if (hid && residents(hid).length < H().HOUSES[hid].max) H().assign(nc, hid);
    nc.status = nc.status || {}; nc.status.onIsland = true; nc.life.loc = (p0 && p0.life.loc) || 'isle';
    for (const p of parents) { M().feel(p, 'happy', 0.7, name(nc)); M().remember(p, { type: 'bond', imp: 0.9, who: [nc.id], text: o.adopt ? `領養了${name(nc)}` : `${name(nc)}出生了`, key: `child:${p.id}:${nc.id}` }); }
    M().remember(nc, { type: 'bond', imp: 0.8, who: parents.map((p) => p.id), text: o.adopt ? `來到了新的家` : `出生了`, key: `born:${nc.id}` });
    if (OC.Budget && OC.Budget.mail) OC.Budget.mail({ kind: 'family', title: o.adopt ? `${name(nc)}來到了家裡` : `${name(nc)}出生了`, text: `${parents.map(name).join('和')}${o.adopt ? '領養了' : '迎接了'}${name(nc)}。${hid ? '住在' + H().HOUSES[hid].zh + '。' : '家裡已經滿了，還沒有住處。'}`, key: `child:${nc.id}` });
    OC.App && OC.App.syncPresence && setTimeout(() => OC.App.syncPresence(), 0);
    St().touch('chars'); St().emit('home16:child', { id: nc.id, adopt: !!o.adopt, parents: parents.map((p) => p.id) });
    return nc;
  }
  function birth(a, b) { return makeChild({ parents: [a.id, b.id], stage: 'baby' }); }
  /** adoption from the 住處與家人 page */
  function adopt(o) {
    if (!famOn()) return { ok: false, why: '在生活設定打開「伴侶、子女與領養」' };
    const ps = (o.parents || []).map((id) => Ch().get(id)).filter(Boolean); if (!ps.length) return { ok: false, why: '選一位要領養的大人' };
    if (ps.some((p) => !adult(p))) return { ok: false, why: '只有成年的角色可以領養' };
    const hid = o.hid || houseOf(ps[0]); if (hid && residents(hid).length >= H().HOUSES[hid].max) return { ok: false, why: `${H().HOUSES[hid].zh}已經住滿了` };
    const c = makeChild({ parents: ps.map((p) => p.id), stage: o.stage || 'child', name: o.name, adopt: true, hid });
    return { ok: true, id: c.id };
  }

  // ================================================================ the family tree
  function tree() {
    const all = Ch().all(), parentsOf = {}, partners = {};
    for (const a of all) for (const b of all) {
      if (a === b) continue; const r = M().relPeek(a.id, b.id); if (!r) continue;
      if (r.kind16 === 'parent' && r.label16 === '孩子') (parentsOf[b.id] = parentsOf[b.id] || new Set()).add(a.id);
      if (['partner', 'engaged', 'lover'].includes(r.type)) (partners[a.id] = partners[a.id] || new Set()).add(b.id);
    }
    const depth = {}; const dOf = (id, seen = new Set()) => { if (depth[id] != null) return depth[id]; if (seen.has(id)) return 0; seen.add(id); const ps = [...(parentsOf[id] || [])]; return (depth[id] = ps.length ? 1 + Math.max(...ps.map((p) => dOf(p, seen))) : 0); };
    for (const c of all) dOf(c.id);
    /* partners sit on the same row */
    for (let k = 0; k < 3; k++) for (const [a, set] of Object.entries(partners)) for (const b of set) { const m = Math.max(depth[a], depth[b]); depth[a] = m; depth[b] = m; }
    const rows = []; for (const c of all) (rows[depth[c.id]] = rows[depth[c.id]] || []).push(c.id);
    return { rows: rows.filter(Boolean), parentsOf: Object.fromEntries(Object.entries(parentsOf).map(([k, v]) => [k, [...v]])), partners: Object.fromEntries(Object.entries(partners).map(([k, v]) => [k, [...v]])) };
  }

  // ================================================================ the page 「住處與家人」
  const h = (...a) => OC.UI.h(...a), ic = (n, s) => OC.UI.icon(n, s);
  OC.Pages.define('homes16', '住處與家人', {
    sub: true,
    build(p, el) { p.tabs = h('div.seg.h16-tabs', { role: 'tablist' }); p.box = h('div.h16'); el.append(p.tabs, p.box); p.tab = 'homes'; },
    refresh(p) {
      const sig = JSON.stringify([p.tab, Ch().all().map((c) => [c.id, c.updated, houseOf(c), name(c)]), p.open, p.res && p.res.why, famOn(), (SAVE().pending || []).length]);
      if (p._sig === sig) return; p._sig = sig;
      p.tabs.replaceChildren(...[['homes', '住處'], ['tree', '家族樹']].map(([k, zh]) => h('button' + (p.tab === k ? '.on' : ''), { role: 'tab', 'aria-selected': String(p.tab === k), 'data-tab': k, on: { click: () => { p.tab = k; p._sig = ''; p.refresh(p); } } }, zh)));
      p.box.replaceChildren(...(p.tab === 'tree' ? treeView(p) : homesView(p)));
    },
  });
  const av = (c) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; cv.className = 'h16-av'; try { OC.CharRender.portrait(cv, c); } catch (e) { /* the face is decoration */ } return cv; };
  function homesView(p) {
    const out = [];
    for (const [hid, HS] of Object.entries(H().HOUSES)) {
      const rs = residents(hid);
      const card = h('div.card.h16-house', { 'data-house': hid },
        h('div.hstack', null, OC.UI.sticker('home'), h('div.grow', null, h('b', null, HS.zh), h('div.muted', null, HS.d)), h('span.tag' + (rs.length >= HS.max ? '.full' : ''), null, `${rs.length}/${HS.max}`)),
        h('div.h16-res', null, ...(rs.length ? rs.map((c) => resident(p, c, hid)) : [h('div.muted', null, '還沒有人住。')])));
      if (p.open && p.open.house === hid && p.res) card.append(resultBox(p));
      if (famOn() && rs.some(adult)) card.append(adoptBox(p, hid, rs));
      out.push(card);
    }
    const none = Ch().all().filter((c) => !houseOf(c));
    if (none.length) out.push(h('div.card.h16-house', { 'data-house': 'none' }, h('b', null, '還沒有住處'), h('div.h16-res', null, ...none.map((c) => resident(p, c, null)))));
    out.push(h('div.muted.h16-note', null, famOn() ? '伴侶、子女與領養已打開（生活設定）。' : '伴侶、子女與領養預設關閉，可以在「生活設定」打開。'));
    return out;
  }
  function resident(p, c, hid) {
    const open = p.open && p.open.id === c.id && !p.res;
    const row = h('div.h16-row', { 'data-res': c.id }, h('button.h16-who', { on: { click: () => { p.open = open ? null : { id: c.id, house: hid }; p.res = null; p._sig = ''; p.refresh(p); } } }, av(c), h('span', null, name(c)), h('small.muted', null, OC.People && OC.People.stage(c) ? OC.People.stage(c).zh : '')));
    if (open) row.append(h('div.h16-moves', null, ...Object.entries(H().HOUSES).filter(([k]) => k !== hid).map(([k, HS]) => h('button.btn.s', { 'data-move': k, on: { click: () => doMove(p, c.id, k) } }, `搬到${HS.zh}`)),
      hid ? h('button.btn.s.ghost', { 'data-move': 'none', on: { click: () => doMove(p, c.id, null) } }, '搬出去') : null));
    return row;
  }
  function doMove(p, id, hid, force) {
    const r = moveIn(id, hid, { force }); p.open = { id, house: hid }; p.res = r.ok ? null : Object.assign({ id, hid }, r);
    if (r.ok) { p.open = null; const c = Ch().get(id); const warm = (r.reactions || []).map((x) => RE[x.r][0] + name(Ch().get(x.id))).join(' ');
      OC.UI.toast(`${name(c)}${hid ? '搬進了' + H().HOUSES[hid].zh : '搬出去了'}${r.forced ? '（硬搬進去，室友不太高興）' : ''}${warm ? '　' + warm : ''}`, 'home'); }
    p._sig = ''; p.refresh(p);
  }
  function resultBox(p) {
    const r = p.res, c = Ch().get(r.id);
    return h('div.h16-result', { role: 'status' }, h('div', null, r.why),
      ...(r.reactions || []).map((x) => h('div.h16-react', { 'data-r': x.r }, h('span', null, RE[x.r][0]), h('b', null, name(Ch().get(x.id))), h('span.muted', null, `${RE[x.r][1]}・${x.why}`))),
      r.canForce ? h('div.hstack', { style: { gap: '8px', marginTop: '8px' } },
        h('button.btn.s', { 'data-force': '1', on: { click: () => doMove(p, r.id, r.hid, true) } }, '強制入住（室友會不高興一陣子）'),
        h('button.btn.s.ghost', { on: { click: () => { p.res = null; p.open = null; p._sig = ''; p.refresh(p); } } }, '算了')) : null,
      c ? null : null);
  }
  function adoptBox(p, hid, rs) {
    const ad = rs.filter(adult); const pick = new Set([ad[0].id]); let stage = 'child';
    const nameIn = h('input', { placeholder: '名字（可以之後再改）', maxLength: 12, 'aria-label': '孩子的名字' });
    return h('details.h16-adopt', null, h('summary', null, '領養一個孩子'),
      h('div.chips', null, ...ad.map((c) => { const b = h('button.chip' + (pick.has(c.id) ? '.on' : ''), { 'data-parent': c.id, on: { click: () => { if (pick.has(c.id)) pick.delete(c.id); else pick.add(c.id); b.classList.toggle('on', pick.has(c.id)); } } }, name(c)); return b; })),
      h('div.chips', null, ...[['baby', '嬰兒'], ['toddler', '幼兒'], ['child', '兒童']].map(([k, zh]) => { const b = h('button.chip' + (k === stage ? '.on' : ''), { 'data-stage': k, on: { click: (e) => { stage = k; e.target.parentNode.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); } } }, zh); return b; })),
      nameIn,
      h('button.btn.block', { 'data-adopt': hid, on: { click: () => { const r = adopt({ parents: [...pick], stage, name: nameIn.value, hid }); OC.UI.toast(r.ok ? `${name(Ch().get(r.id))}來到了${H().HOUSES[hid].zh}` : r.why, r.ok ? 'heart' : 'info'); p._sig = ''; p.refresh(p); } } }, '領養'));
  }
  function treeView() {
    const T = tree(), out = [];
    if (!Object.keys(T.parentsOf).length && !Object.keys(T.partners).length) out.push(h('div.empty', null, '還沒有家人關係。可以在開局的關係圖或角色的「關係」裡設定父母、孩子與伴侶。'));
    T.rows.forEach((row, i) => {
      const done = new Set(), cells = [];
      for (const id of row) {
        if (done.has(id)) continue; done.add(id); const c = Ch().get(id), ps = (T.partners[id] || []).filter((x) => row.includes(x) && !done.has(x));
        const group = [c].concat(ps.map((x) => Ch().get(x))); ps.forEach((x) => done.add(x));
        const kids = (T.parentsOf[id] ? T.parentsOf[id] : []).map((x) => name(Ch().get(x)));
        cells.push(h('div.h16-node', { 'data-node': id }, ...group.flatMap((g, k) => [k ? h('span.h16-heart', null, '♥') : null, h('span.h16-person', null, av(g), h('span', null, name(g)))]).filter(Boolean),
          kids.length ? h('small.muted', null, `${kids.join('和')}的孩子`) : null));
      }
      out.push(h('div.h16-gen', { 'data-gen': i }, h('div.muted.h16-genlab', null, i === 0 ? '第一代' : `第 ${i + 1} 代`), h('div.h16-genrow', null, ...cells)));
    });
    return out;
  }

  // ================================================================ lines (data)
  { const T = (...t) => ({ trait: t }); const L = [
    ['h16_care', '乖，不哭了。'], ['h16_care', '肚子餓了嗎？來。'], ['h16_care', '抱抱。'], ['h16_care', '好啦好啦，我在這裡。'], ['h16_care', '睡吧，我陪你。'],
    ['h16_care', '（輕輕拍著）', T('quiet', 'calm')], ['h16_care', '你今天也很努力喔。', T('caring', 'caretaker')], ['h16_care', '……要怎麼抱才對？', T('timid', 'clumsy')], ['h16_care', '來，看這邊。笑一個。', T('playful', 'cheerful')],
  ]; L.forEach((x, i) => D().LINES.push({ id: 'h16_' + i, cat: x[0], text: x[1], c: x[2] || null, w: 1, m: true, cd: 10 })); }

  // ================================================================ init
  function init() {
    Sim().onDay((d) => dayStep(d));
    if (SAVE().asking) setTimeout(() => askChild(), 1500);
  }
  OC.House16 = { BED, PLACE_OF, HOUSE_OF, HOME_PLACES, houseOf, placeOf, isHome, residents, housemates, shareOK, slotOK, bedSlots, reaction, reactions, moveIn, dayStep, babies, shape, onFinish, couples, family, askChild, answerChild, makeChild, birth, adopt, tree, init, st, SAVE, MILES };
})();
