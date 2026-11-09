/* OC Shimeji 12.0 — OC.Arcs: what happens between more than two characters, and over more than a day.
 *   contagion  a strong mood spreads to whoever is standing close (weighted by closeness, personality; cooldown per pair)
 *   rifts      a quarrel that goes deep becomes a cold war: they avoid each other, meet awkwardly, then thaw — by themselves, through a
 *              mutual friend who steps in, or when the player lets them talk — and either make up or drift apart
 *   gatherings three or four characters meet, sit in a ring / line up for a photo / eat together / sit a quarrel out together
 * Rules: all live logic runs on the game clock (Sim.onStep); the scripted gathering uses real time like the event engine does. Every hold
 * ('group') is released at the end, on a timeout, and by the app's watchdog. Nothing here changes relationship *types* by itself beyond what
 * OC.Mind.relChange already does, nothing is rewarded (no coins, no progress events), and pairs the player fixed (or Settings › lock) are left alone.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, M = () => OC.Mind, B = () => OC.Brain, Sim = () => OC.Sim, Ch = () => OC.Chars, A = () => OC.App;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), has = (c, t) => !!c && c.personality.traits.includes(t);
  const nm = (c) => Ch().name(c), key = (a, b) => [a, b].sort().join('|');
  const st = () => { const L = S().life; return L.arcs = Object.assign({ rifts: {}, cd: {}, gcd: 0, n: { contagion: 0, gathered: 0, rifts: 0, reconciled: 0, drifted: 0 } }, L.arcs || {}); };
  const ensure = () => { const L = S().life; if (!L.arcs) L.arcs = { rifts: {}, cd: {}, gcd: 0, n: { contagion: 0, gathered: 0, rifts: 0, reconciled: 0, drifted: 0 } }; return L.arcs; };
  const live = () => Object.values(B().brains || {}).filter((b) => b.a && !b.a.hidden && Ch().get(b.id));
  const free = (b) => b && !b.holds.size && !b.queued && !b.leaving && b.st !== 'event' && b.st !== 'social' && !(b.invited) && !B().manualMode(b);

  // =============================================================================== emotion contagion
  const CATCH = { happy: ['happy', 0.1], excited: ['excited', 0.1], content: ['content', 0.08], proud: ['happy', 0.06], down: ['down', 0.1], lonely: ['down', 0.06], nervous: ['nervous', 0.08], annoyed: ['nervous', 0.05] };
  const POSITIVE = ['happy', 'excited', 'content', 'proud'];
  function suscept(c) { let x = 1; if (has(c, 'sensitive') || has(c, 'gentle')) x += 0.4; if (has(c, 'cheerful')) x += 0.2; if (has(c, 'stubborn') || has(c, 'cool')) x -= 0.3; return clamp(x, 0.4, 1.7); }
  let cT = 0;
  /** a mood close by rubs off (every ~12 game minutes) */
  function contagion(g) {
    cT += g; if (cT < 12) return; cT = 0;
    const bs = live(), gm = Sim().now(), S_ = ensure();
    for (const sb of bs) {
      const s = Ch().get(sb.id), e = M().dominant(s), cat = CATCH[e]; if (!cat) continue;
      const k = M().intensity(s, e); if (k < 0.45) continue;
      for (const rb of bs) {
        if (rb === sb) continue; const r = Ch().get(rb.id); if (Math.hypot(sb.a.x - rb.a.x, sb.a.y - rb.a.y) > 120) continue;
        const kk = sb.id + '>' + rb.id + ':' + e; if ((S_.cd[kk] || -1e9) > gm - 45) continue;
        const rel = M().relPeek(r.id, s.id), w = clamp(0.35 + (rel ? rel.aff / 160 + rel.fam / 300 : 0), 0.2, 1) * suscept(r) * (M().dominant(r) === cat[0] ? 0.4 : 1) * (cat[0] === 'down' && has(r, 'optimist') ? 0.5 : 1);
        const add = cat[1] * k * w * 3; if (add < 0.05) continue;
        S_.cd[kk] = gm; S_.n.contagion++;
        M().feel(r, cat[0], add, `被${nm(s)}的${POSITIVE.includes(e) ? '好心情' : '情緒'}影響`, s.id);
        if (A() && A().floatText) A().floatText(rb.a, POSITIVE.includes(e) ? '♪' : '…', POSITIVE.includes(e) ? 'var(--sun)' : 'var(--ink-2)');
        B().dlog && B().dlog(rb, `${nm(s)}的${POSITIVE.includes(e) ? '好心情' : '情緒'}感染了牠`);
      }
    }
  }

  // =============================================================================== rifts (cold war → thaw → make up / drift apart)
  const riftOf = (a, b) => ensure().rifts[key(a, b)] || null;
  /** are these two in a cold war right now? (invitations between them are declined, they avoid each other) */
  const cold = (a, b) => { const r = riftOf(a, b); return !!r && r.stage === 'cold'; };
  const notice = (text) => { if (OC.LifeUI && OC.LifeUI.pushNotice) OC.LifeUI.pushNotice({ info: true, text }); };
  let rT = 0, lastCheck = {};
  function stepRifts(g) {
    rT += g; if (rT < 30) return; rT = 0;
    const L = S().life, gm = Sim().now(), day = Sim().day(), all = Ch().all(), S_ = ensure();
    if (L.settings.autonomy === 'paused') return;
    // start
    if (!L.settings.lockRel) for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], k = key(a.id, b.id); if (S_.rifts[k] && ['cold', 'thaw'].includes(S_.rifts[k].stage)) continue;
      const ra = M().relPeek(a.id, b.id), rb = M().relPeek(b.id, a.id); if (!ra || !rb || ra.fixed || rb.fixed) continue;
      if (['rival', 'lover', 'partner', 'custom'].includes(ra.type) || ['rival', 'lover', 'partner', 'custom'].includes(rb.type)) continue;
      if (S_.rifts[k] && gm - (S_.rifts[k].endedAt || 0) < 4320) continue;   // not again right after making up
      const conflict = Math.max(ra.conflict, rb.conflict), fam = Math.min(ra.fam, rb.fam);
      if (conflict >= 38 && fam >= 18) startRift(a, b, conflict);
    }
    // progress
    for (const r of Object.values(S_.rifts)) {
      if (!['cold', 'thaw'].includes(r.stage)) continue; const a = Ch().get(r.a), b = Ch().get(r.b); if (!a || !b) { r.stage = 'gone'; continue; }
      if (r.stage === 'cold' && gm >= r.until) { r.stage = 'thaw'; r.thawAt = gm; }
      if (r.stage !== 'thaw') continue;                                         // a cold war holds the conflict where it is
      M().relPair(a.id, b.id, { conflict: -0.4 }, '');
      // somebody who cares about both may step in
      const ba = live().find((x) => x.id === a.id), bb = live().find((x) => x.id === b.id);
      if (ba && bb && free(ba) && free(bb) && !run && gm - (lastCheck[r.a + r.b] || 0) > 180) {
        lastCheck[r.a + r.b] = gm;
        const med = live().find((m) => m.id !== a.id && m.id !== b.id && free(m) && (M().relPeek(m.id, a.id) || {}).aff >= 30 && (M().relPeek(m.id, b.id) || {}).aff >= 30 && (Ch().get(m.id).personality.social >= 45 || has(Ch().get(m.id), 'gentle')));
        if (med && Sim().rnd() < 0.6) { gather('mediation', [med.id, a.id, b.id], { rift: r }); continue; }
      }
      // otherwise time may do it: they make up (or not) on their own after a day of thaw
      if (gm - r.thawAt > 1440) {
        const p = clamp(0.35 + (has(a, 'gentle') || has(b, 'gentle') ? 0.25 : 0) + (M().relPeek(a.id, b.id).trust || 0) / 220 - (has(a, 'stubborn') && has(b, 'stubborn') ? 0.3 : has(a, 'stubborn') || has(b, 'stubborn') ? 0.15 : 0), 0.1, 0.9);
        if (Sim().rnd() < p) reconcile(r, 'time'); else if (++r.tries >= 3) drift(r); else r.thawAt = gm - 700;
      }
    }
  }
  function startRift(a, b, conflict) {
    const S_ = ensure(), gm = Sim().now(), k = key(a.id, b.id), days = 2 + Math.floor(Sim().rnd() * 3);
    S_.rifts[k] = { a: a.id, b: b.id, stage: 'cold', since: Sim().day(), startedAt: gm, until: gm + days * 1440, tries: 0, lastEnc: 0, why: conflict };
    S_.n.rifts++;
    for (const [x, y] of [[a, b], [b, a]]) { M().feel(x, has(x, 'stubborn') ? 'annoyed' : 'down', 0.25, `和${nm(y)}鬧僵了`, y.id); M().remember(x, { type: 'social', imp: 0.6, text: `和${nm(y)}鬧得有點僵`, key: 'rift:start:' + k + ':' + Sim().day() }); }
    notice(`${nm(a)}和${nm(b)}之間有點僵，這幾天大概會互相避開。`);
    St_touch();
  }
  const St_touch = () => OC.Store.touch('life', { arcs: true });
  /** make up: the quarrel is settled, trust is a little higher than before it */
  function reconcile(r, how) {
    const a = Ch().get(r.a), b = Ch().get(r.b); if (!a || !b || !['cold', 'thaw'].includes(r.stage)) return false;
    r.stage = 'reconciled'; r.endedAt = Sim().now(); r.how = how;
    M().relPair(a.id, b.id, { conflict: -30, trust: 8, aff: 8, intim: 2 }, '和好了');
    for (const [x, y] of [[a, b], [b, a]]) { M().feel(x, 'content', 0.5, `和${nm(y)}和好了`, y.id); M().remember(x, { type: 'milestone', imp: 0.8, text: `和${nm(y)}和好了`, key: 'rift:end:' + key(a.id, b.id) + ':' + Sim().day() }); }
    ensure().n.reconciled++; OC.Sound && OC.Sound.cue && OC.Sound.cue('reconcile'); notice(`${nm(a)}和${nm(b)}和好了。`); St_touch(); return true;
  }
  function drift(r) {
    const a = Ch().get(r.a), b = Ch().get(r.b); if (!a || !b) return; r.stage = 'drifted'; r.endedAt = Sim().now();
    M().relPair(a.id, b.id, { aff: -6, intim: -3 }, '漸行漸遠');
    for (const [x, y] of [[a, b], [b, a]]) M().remember(x, { type: 'social', imp: 0.5, text: `和${nm(y)}不再像以前那樣親近了`, key: 'rift:drift:' + key(a.id, b.id) });
    ensure().n.drifted++; notice(`${nm(a)}和${nm(b)}沒能和好，慢慢疏遠了。`); St_touch();
  }
  /** the player lets them talk it out (success is likely, never certain) */
  function mediate(aId, bId) {
    const r = riftOf(aId, bId); if (!r || !['cold', 'thaw'].includes(r.stage)) return false;
    if (Sim().now() - (r.medAt || -1e9) < 240) { notice('才剛談過，先給牠們一點時間。'); return false; }
    r.medAt = Sim().now();
    const a = Ch().get(r.a), b = Ch().get(r.b), p = clamp(0.7 - (has(a, 'stubborn') ? 0.15 : 0) - (has(b, 'stubborn') ? 0.15 : 0) + (has(a, 'gentle') || has(b, 'gentle') ? 0.15 : 0), 0.3, 0.9);
    if (Sim().rnd() < p) return reconcile(r, 'player'); r.until += 720; r.tries++; notice(`${nm(a)}和${nm(b)}還需要一點時間。`); St_touch(); return false;
  }
  /** an apology that is accepted: in the thaw it ends the quarrel; in the cold stage it only cracks the ice (half the time left) */
  function onSocial(A, Bc, kind) {
    if (kind !== 'apologize') return; const r = riftOf(A.id, Bc.id); if (!r) return;
    if (r.stage === 'thaw') reconcile(r, 'apology'); else if (r.stage === 'cold') { const gm = Sim().now(); r.until = gm + Math.max(0, r.until - gm) * 0.5; if (Sim().now() >= r.until - 1) r.until = gm + 1; St_touch(); }
  }
  /** shaping the Utility AI: a character in a cold war does not go looking for the other one */
  function shape(c, b, list) {
    if (!c || !list) return list; const S_ = ensure(); let any = false;
    for (const x of list) if (x.kind === 'social' && x.other && x.social !== 'apologize' && cold(c.id, x.other)) { x.s *= 0.08; x.why && x.why.unshift('冷戰中，不想見面'); any = true; }
    if (any) list.sort((p, q) => q.s - p.s);
    // an awkward meeting when they pass each other
    const bb = b; if (bb && bb.a && !bb.a.hidden) for (const r of Object.values(S_.rifts)) {
      if (r.stage !== 'cold' || (r.a !== c.id && r.b !== c.id)) continue; const oid = r.a === c.id ? r.b : r.a, ob = B().brains[oid]; if (!ob || !ob.a || ob.a.hidden) continue;
      if (Math.hypot(bb.a.x - ob.a.x, bb.a.y - ob.a.y) < 70 && Sim().now() - r.lastEnc > 240) { r.lastEnc = Sim().now(); awkward(c, Ch().get(oid), bb, ob); }
    }
    return list;
  }
  function awkward(c, o, bc, bo) {
    const ln = OC.Talk.say('rift_cold', c, o); if (ln && A()) A().bubble(bc.a, ln.text, nm(c), 1.8);
    for (const [x, b2] of [[c, bc], [o, bo]]) { M().feel(x, 'nervous', 0.12, `碰到${nm(x === c ? o : c)}有點尷尬`); if (OC.World) OC.World.setAction(b2.a, 'turnaway', { dur: 1.4, priority: 3 }); }
  }

  // =============================================================================== gatherings (three or more)
  const KINDS = {
    circle: { zh: '圍坐聊天', rounds: 5, anim: 'listen' }, photo: { zh: '合照', rounds: 1 }, meal: { zh: '一起用餐', rounds: 4 }, mediation: { zh: '坐下來談談', rounds: 4 },
  };
  let run = null;
  const holding = () => !!run;
  /** start a gathering of the given characters (all must be visible and free; the player's own may join unless set to manual) */
  function gather(kind, ids, o = {}) {
    if (run || !KINDS[kind]) return false;
    const bs = ids.map((id) => B().brains[id]); if (bs.length < 3 || bs.some((b) => !b || !b.a || b.a.hidden || !free(b))) return false;
    const cx = bs.reduce((s, b) => s + b.a.x, 0) / bs.length, cy = bs.reduce((s, b) => s + b.a.y, 0) / bs.length, W = OC.World;
    const c0 = W.nearestWalkable(cx, cy, 90) || { x: cx, y: cy };
    run = { kind, ids: ids.slice(), t: 0, phase: 'walk', c: c0, arrived: new Set(), step: 0, nextAt: 0, rift: o.rift || null, ok: null, speaker: 0 };
    bs.forEach((b, i) => {
      B().hold(b.id, 'group'); b.a.path = null;
      const ang = (i / bs.length) * Math.PI * 2 + (kind === 'photo' ? 0 : 0.4), rad = kind === 'photo' ? 0 : 30;
      const slot = kind === 'photo' ? { x: c0.x + (i - (bs.length - 1) / 2) * 24, y: c0.y } : { x: c0.x + Math.cos(ang) * rad, y: c0.y + Math.sin(ang) * rad * 0.7 };
      const q = W.nearestWalkable(slot.x, slot.y, 30) || c0; run.slots = run.slots || {}; run.slots[b.id] = q;
      const done = () => { if (run) run.arrived.add(b.id); };
      if (Math.hypot(b.a.x - q.x, b.a.y - q.y) < 8 || !W.walkTo(b.a, q.x, q.y, done)) done();
    });
    const names = ids.map((id) => nm(Ch().get(id))).join('、');
    B().dlog && B().dlog(bs[0], `${KINDS[kind].zh}：${names}`);
    return true;
  }
  const say = (id, cat, to, dur) => { const c = Ch().get(id), o = to && Ch().get(to), ln = c && OC.Talk.say(cat, c, o || null); const b = B().brains[id]; if (ln && b && b.a && A()) A().bubble(b.a, ln.text, nm(c), dur || 2.2); return !!ln; };
  const act = (id, action, dur) => { const b = B().brains[id]; if (b && b.a && OC.World) OC.World.setAction(b.a, action, { dur: dur || 1.8, priority: 6 }); };
  function update(dt) {
    if (!run) return; run.t += dt; const W = OC.World;
    // anyone gone / taken over / hidden → call it off
    if (run.ids.some((id) => { const b = B().brains[id]; return !b || !b.a || b.a.hidden || !b.holds.has('group'); }) || run.t > 80) return finish(false);
    if (run.phase === 'walk') {
      if (run.arrived.size >= run.ids.length || run.t > 18) {
        run.phase = 'act'; run.nextAt = run.t + 0.6;
        run.ids.forEach((id) => { const b = B().brains[id]; if (run.kind === 'photo') { b.a.tFace = 0; b.a.tBack = 0; } else B().face(b.a, run.c); });
      } return;
    }
    if (run.t < run.nextAt) return;
    const K = KINDS[run.kind], ids = run.ids, host = ids[0];
    if (run.kind === 'photo') {
      if (run.step === 0) { say(host, 'photo_count', null, 2.4); run.nextAt = run.t + 2.6; }
      else if (run.step === 1) { ids.forEach((id) => act(id, Ch().has(Ch().get(id), 'shy') ? 'shy' : 'peace', 1.8)); OC.Sound && OC.Sound.play('shutter'); run.nextAt = run.t + 1.2; }
      else if (run.step === 2) { say(ids[1], 'photo_done', null, 2); OC.Sound && OC.Sound.cue && OC.Sound.cue('photo'); run.nextAt = run.t + 2; }
      else return finish(true);
    } else if (run.kind === 'mediation') {
      const [m, a, b] = ids, r = run.rift;
      if (run.step === 0) { say(m, 'med_open', null, 2.6); act(m, 'talk', 2.4); run.nextAt = run.t + 3; }
      else if (run.step === 1) { say(a, 'rift_sorry', b, 2.6); act(b, 'listen', 2.4); run.nextAt = run.t + 3; }
      else if (run.step === 2) {
        const p = clamp(0.8 - (has(Ch().get(b), 'stubborn') ? 0.25 : 0) + (has(Ch().get(m), 'gentle') ? 0.1 : 0), 0.35, 0.92); run.ok = Sim().rnd() < p;
        say(b, run.ok ? 'rift_forgive' : 'rift_refuse', a, 2.6); act(b, run.ok ? 'bow' : 'turnaway', 2); act(m, run.ok ? 'clap' : 'sigh', 1.6); run.nextAt = run.t + 3;
      } else if (run.step === 3) { if (run.ok) { act(a, 'hug', 2); act(b, 'hug', 2); } run.nextAt = run.t + 2.4; }
      else return finish(true);
    } else {
      // circle / meal: the speaker rotates; the others react
      if (run.step >= K.rounds) return finish(true);
      const sp = ids[run.step % ids.length], others = ids.filter((x) => x !== sp);
      if (run.step === 0) say(sp, run.kind === 'meal' ? 'meal_open' : 'group_open', null, 2.4); else say(sp, run.kind === 'meal' ? 'meal_talk' : 'group_talk', others[Math.floor(Sim().rnd() * others.length)], 2.6);
      act(sp, run.kind === 'meal' ? 'eat' : 'talk', 2.4);
      others.forEach((id, i) => act(id, run.kind === 'meal' ? 'eat' : i === 0 && Sim().rnd() < 0.4 ? 'giggle' : 'listen', 2.2));
      if (Sim().rnd() < 0.55) setTimeout(() => run && say(others[0], 'group_react', sp, 2), 1100);
      run.nextAt = run.t + 3.2;
    }
    run.step++;
  }
  function finish(ok) {
    if (!run) return false; const r = run; run = null;
    for (const id of r.ids) { const b = B().brains[id]; if (b) B().unhold(id, 'group'); }
    if (!ok) return false;
    const cs = r.ids.map((id) => Ch().get(id)).filter(Boolean), day = Sim().day(), names = cs.map(nm).join('、');
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) if (!(r.kind === 'mediation' && i === 0 && false)) M().relPair(cs[i].id, cs[j].id, r.kind === 'mediation' ? { fam: 1 } : { fam: 3, aff: 2 }, KINDS[r.kind].zh);
    for (const c of cs) {
      M().feel(c, r.kind === 'meal' ? 'content' : 'happy', 0.3, `一起${KINDS[r.kind].zh}`); M().needs(c, { social: 12, fun: 6, food: r.kind === 'meal' ? 25 : 0 });
      M().remember(c, { type: 'social', imp: r.kind === 'photo' ? 0.7 : 0.45, text: r.kind === 'photo' ? `和${cs.filter((x) => x !== c).map(nm).join('、')}一起拍了合照` : `和${cs.filter((x) => x !== c).map(nm).join('、')}一起${KINDS[r.kind].zh}`, key: `group:${r.kind}:${day}` });
    }
    if (r.kind === 'mediation' && r.rift) { if (r.ok) reconcile(r.rift, 'friend'); else { r.rift.until += 720; r.rift.tries++; } }
    ensure().n.gathered++; ensure().gcd = Sim().now() + 240; St_touch(); return true;
  }
  /** now and then the island gathers by itself */
  let gT = 0;
  function stepGather(g) {
    gT += g; if (gT < 20) return; gT = 0;
    const L = S().life, S_ = ensure(); if (run || !L.settings || L.settings.autonomy !== 'full' || Sim().now() < S_.gcd) return;
    const bs = live().filter(free); if (bs.length < 3 || Sim().rnd() > 0.2) return;
    const ph = OC.Clock.phase(OC.Clock.hour()), hungry = bs.reduce((s, b) => s + Ch().get(b.id).needs.food, 0) / bs.length < 65;
    // the host: the most sociable one with the lowest social need; the guests: whoever likes the host and is not in a cold war with anybody present
    bs.sort((p, q) => Ch().get(p.id).needs.social - Ch().get(q.id).needs.social); const host = bs[0], hc = Ch().get(host.id);
    const guests = bs.filter((b) => b !== host && (M().relPeek(b.id, host.id) || { aff: 0 }).aff >= 12 && !bs.some((o) => o !== b && cold(b.id, o.id))).slice(0, 3);
    if (guests.length < 2) return;
    const kind = (ph === 'noon' || ph === 'dusk') && hungry ? 'meal' : Sim().rnd() < 0.18 ? 'photo' : 'circle';
    if (hc.needs.social > 80 && kind === 'circle') return;
    gather(kind, [host.id].concat(guests.map((b) => b.id)));
  }

  function step(g) { try { contagion(g); stepRifts(g); stepGather(g); } catch (e) { console.error('[arcs]', e); } }
  function explain(c) {
    const out = []; for (const r of Object.values(ensure().rifts)) if ((r.a === c.id || r.b === c.id) && ['cold', 'thaw'].includes(r.stage)) { const o = Ch().get(r.a === c.id ? r.b : r.a); if (o) out.push({ other: o.id, zh: nm(o), stage: r.stage, text: r.stage === 'cold' ? `還在和${nm(o)}冷戰` : `和${nm(o)}之間的氣氛慢慢緩和了` }); }
    return out;
  }
  function init() { if (OC.Sim && OC.Sim.onStep) OC.Sim.onStep(step); }
  OC.Arcs = { init, step, update, contagion, shape, onSocial, cold, riftOf, reconcile, mediate, gather, explain, KINDS, get running() { return run ? { kind: run.kind, ids: run.ids.slice(), phase: run.phase } : null; }, get state() { return ensure(); }, abort: () => finish(false), holding };
})();
