/* OC Shimeji 16.10 — 邀約、約會與出遊（OC.Outing16）＋手機「行程」App
 *
 *   plans      save.life.plans16: { id, kind: 'outing'|'date', host, guests, place, day, hour, rsvp, status }. You make one in
 *              the 行程 app (who, with whom, where, when); the guests answer at once through the willingness model (OC.Will.willing
 *              with their relationship, mood, personality) — yes, or no with a reason (busy at work / school, does not like the
 *              host, prefers staying home…). A date needs both adults and romance switched on (Mind.romanceOK).
 *   the day    half an hour before, everyone who said yes sets off to the place (Brain.goPlace on screen, a trip in the
 *              abstract life). An hour after the start it is settled: the ones who came grow closer and remember the outing;
 *              anyone who said yes but did not come stood the others up — they are disappointed (affection / trust down, a
 *              memory, a letter). Who flakes is decided once, from personality, when they say yes (not by re-rolling).
 *   by itself  friends sometimes plan an outing on their own (a letter tells you; it shows in the 行程 app).
 *   the app    upcoming plans with everyone's answer, today's work and school (OC.Career16), and the form for a new invitation.
 * Nothing here gives items or coins; relationships change only through Mind.relPair / relChange.
 */
(function () {
  'use strict';
  const M = () => OC.Mind, Sim = () => OC.Sim, B = () => OC.Brain, Ch = () => OC.Chars, S = () => OC.Store.s, St = () => OC.Store;
  const has = (c, t) => !!(c && c.personality.traits.includes(t));
  const any = (c, ts) => ts.some((t) => has(c, t));
  const name = (c) => Ch().name(c);
  const hs = (k) => { let x = 2166136261; for (const ch of String(k)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return ((x >>> 0) % 100000) / 100000; };
  const plans = () => S().life.plans16 || (S().life.plans16 = []);
  const PZ = (pl) => (OC.Places.get(pl) || {}).zh || pl;
  const HOURS = [10, 14, 18];
  const OUT_ACT = { fair: 'fairride16', beach: 'observe', forest: 'explore', hill: 'observe', cafe: 'drink', library: 'read', street: 'browse', isle: 'walk' };

  /** will `g` come? → { yes, why, flake } (decided once) */
  function answer(p, g) {
    const host = Ch().get(p.host), cal = OC.Clock.cal ? OC.Clock.cal(p.day) : { weekend: false };
    if (!g) return { yes: false, why: '找不到' };
    if (OC.People && !OC.People.canTravel(g)) return { yes: false, why: '年紀太小，不能自己出門' };
    if (p.kind === 'date' && !M().romanceOK(p.host, g.id)) return { yes: false, why: '不是可以約會的關係' };
    const j = OC.Career16 && OC.Career16.jobOf(g);
    if (j && OC.Career16.LINE[j.line].type === 'emp' && !cal.weekend && p.hour < OC.Career16.WORK_H[1] && p.hour >= OC.Career16.WORK_H[0] - 1) return { yes: false, why: '那時候要上班' };
    const sc = OC.Career16 && OC.Career16.schoolOf(g);
    if (sc && sc.status === 'enrolled' && sc.level && !cal.weekend && p.hour < OC.Career16.SCHOOL_H[1]) return { yes: false, why: '那時候要上學' };
    const w = OC.Will ? OC.Will.willing(g, host, p.kind === 'date' ? 'handhold16' : 'chat') : { p: 0.6, parts: [] };
    let pr = w.p + (has(g, 'homebody') ? -0.2 : 0) + (any(g, ['adventurous', 'outgoing']) ? 0.15 : 0) + (p.place === 'fair' && any(g, ['playful']) ? 0.1 : 0);
    const yes = hs(p.id + ':' + g.id) < pr;
    const why = yes ? (pr > 0.8 ? '好啊，期待' : '可以') : (w.parts || []).filter((x) => x[1] < 0).sort((a, b) => a[1] - b[1]).map((x) => x[0])[0] || (has(g, 'homebody') ? '想待在家' : '那天不太方便');
    const flake = yes ? Math.max(0.02, 0.07 + (any(g, ['lazy', 'moody', 'restless']) ? 0.15 : 0) - (any(g, ['organized', 'serious', 'polite', 'caring']) ? 0.05 : 0)) : 0;
    return { yes, why, flake: yes && hs('flake:' + p.id + ':' + g.id) < flake };
  }
  /** make a plan. o = { host, guests, place, day, hour, kind } */
  function invite(o) {
    const host = Ch().get(o.host); if (!host) return { ok: false, why: '找不到發起的人' };
    const guests = [...new Set(o.guests || [])].filter((id) => id !== o.host && Ch().get(id)); if (!guests.length) return { ok: false, why: '至少要邀一個人' };
    if (!OC.Places.get(o.place) || !OC.Places.open(o.place)) return { ok: false, why: '這個地方去不了' };
    if (o.kind === 'date' && guests.length !== 1) return { ok: false, why: '約會只能兩個人' };
    if (o.kind === 'date' && !M().romanceOK(o.host, guests[0])) return { ok: false, why: '他們不是可以約會的關係（戀愛要兩人都成年、生活設定打開）' };
    if (OC.People && !OC.People.canTravel(host)) return { ok: false, why: '年紀太小，不能自己出門' };
    const day = o.day != null ? o.day : Sim().day(), hour = o.hour || 14;
    if (day === Sim().day() && hour <= OC.Clock.hour()) return { ok: false, why: '這個時間已經過了' };
    const p = { id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), kind: o.kind || 'outing', host: o.host, guests, place: o.place, day, hour, rsvp: {}, status: 'planned', by: o.by || 'player', at: Sim().now() };
    for (const id of guests) p.rsvp[id] = answer(p, Ch().get(id));
    if (!guests.some((id) => p.rsvp[id].yes)) p.status = 'declined';
    plans().unshift(p); if (plans().length > 30) plans().length = 30;
    St().touch('life', { plans: true }); St().emit('outing:new', { id: p.id });
    return { ok: true, plan: p };
  }
  function cancel(id) {
    const p = plans().find((x) => x.id === id); if (!p || p.status !== 'planned') return false; p.status = 'cancelled';
    if (p.day === Sim().day()) for (const g of p.guests) if (p.rsvp[g] && p.rsvp[g].yes) { const c = Ch().get(g); if (c) M().feel(c, 'down', 0.15, `${name(Ch().get(p.host))}取消了約定`); }
    St().touch('life', { plans: true }); return true;
  }
  const going = (p) => [p.host].concat(p.guests.filter((g) => p.rsvp[g] && p.rsvp[g].yes));
  /** every game minute: set off half an hour before; settle an hour after the start */
  function step() {
    if (Sim().catching) return; const day = Sim().day(), h = OC.Clock.hour();
    for (const p of plans()) {
      if (p.status === 'planned' && day === p.day && h >= p.hour - 0.5) { p.status = 'going'; for (const id of going(p)) setOff(p, id); }
      if (p.status === 'going' && (day > p.day || (day === p.day && h >= p.hour + 1))) settle(p);
      if (p.status === 'planned' && day > p.day) { p.status = 'going'; settle(p); }
    }
  }
  function setOff(p, id) {
    const c = Ch().get(id); if (!c) return; if (id !== p.host && p.rsvp[id] && p.rsvp[id].flake) return;   /* stays away */
    if ((c.life.loc || 'isle') === p.place) return;
    if (id === S().activeId) { OC.UI && OC.UI.toast(`${name(c)}該出發去${PZ(p.place)}了（${p.hour}:00 的約）`, 'clock'); return; }   /* the one you play goes when you take it there */
    const b = B().get(id), act = OUT_ACT[p.place] || 'walk';
    if (b && b.a) { if (!B().goPlace(id, p.place, act)) c.life.loc = p.place; }
    else { const tm = OC.Places.travelMin(c.life.loc || 'isle', p.place); c.life.trip = { from: c.life.loc || 'isle', to: p.place, act, eta: Sim().now() + tm }; c.life.loc = p.place; c.life.cur = null; }
  }
  function settle(p) {
    p.status = 'done'; const day = Sim().day();
    const came = going(p).filter((id) => { const c = Ch().get(id), b = B().get(id); return c && (c.life.loc === p.place || (c.life.trip && c.life.trip.to === p.place) || (b && b.leaving && b.leaving.to === p.place)) && !(id !== p.host && p.rsvp[id].flake); });   /* there, or on the way */
    const noShow = going(p).filter((id) => !came.includes(id));
    p.came = came; p.noShow = noShow;
    const zh = PZ(p.place), what = p.kind === 'date' ? '約會' : '出去玩';
    for (let i = 0; i < came.length; i++) for (let j = i + 1; j < came.length; j++) {
      const a = came[i], b = came[j]; M().relPair(a, b, { fam: 3, aff: 2, trust: 1 }, p.kind === 'date' ? '約會' : '一起出遊');
      if (p.kind === 'date' && M().romanceOK(a, b)) M().relPair(a, b, { intim: 2 }, '約會');
    }
    for (const id of came) { const c = Ch().get(id), others = came.filter((x) => x !== id); if (!others.length) continue; M().feel(c, 'happy', 0.4, what); M().remember(c, { type: 'bond', imp: 0.55, who: others, place: 'place:' + p.place, text: `和${others.map((x) => name(Ch().get(x))).join('、')}在${zh}${what}`, key: `out:${p.id}:${id}` }); }
    for (const id of noShow) {
      const c = Ch().get(id); if (!c) continue;
      for (const w of came) { const r = M().relPeek(w, id); if (!(r && r.fixed)) M().relChange(w, id, { aff: -5, trust: -4 }, '放鴿子'); const cw = Ch().get(w); M().feel(cw, 'down', 0.35, `${name(c)}沒有來`); M().remember(cw, { type: 'event', imp: 0.5, who: [id], text: `在${zh}等了很久，${name(c)}一直沒有出現`, key: `stood:${p.id}:${w}` }); }
      M().remember(c, { type: 'event', imp: 0.4, who: came, text: `忘了和${came.map((x) => name(Ch().get(x))).join('、')}的約`, key: `flaked:${p.id}:${id}` });
    }
    if (noShow.length && came.length && OC.Budget) OC.Budget.mail({ kind: 'outing', title: `${noShow.map((x) => name(Ch().get(x))).join('、')}放了鴿子`, text: `${came.map((x) => name(Ch().get(x))).join('、')}在${zh}等了很久。`, key: `stood:${p.id}` });
    if (came.length >= 2 && OC.Progress) OC.Progress.emit('outing', { oc: p.host, ocs: came, place: p.place, kind: p.kind });
    St().touch('life', { plans: true }); St().emit('outing:done', { id: p.id, came, noShow });
  }
  /** once a game day: friends sometimes plan an outing by themselves */
  function dayStep(day) {
    if (Sim().catching || S().life.settings.outing16 === false) return;
    const cs = Ch().all(); if (cs.length < 2 || plans().some((p) => p.status === 'planned' && p.by === 'ai')) return;
    for (const a of cs) {
      if (hs('ai:' + a.id + ':' + day) > 0.12 || (OC.People && !OC.People.canTravel(a))) continue;
      const friends = cs.filter((b) => b.id !== a.id && (M().relPeek(a.id, b.id) || {}).aff >= 40); if (!friends.length) continue;
      const b = friends[Math.floor(hs('aif:' + a.id + day) * friends.length)], places = ['fair', 'beach', 'cafe', 'hill', 'forest'].filter((x) => OC.Places.open(x)); if (!places.length) continue;
      const place = places[Math.floor(hs('aip:' + a.id + day) * places.length)];
      const r = invite({ host: a.id, guests: [b.id], place, day: day + 1, hour: 14, kind: 'outing', by: 'ai' });
      if (r.ok && r.plan.status === 'planned' && OC.Budget) OC.Budget.mail({ kind: 'outing', title: `${name(a)}約了${name(b)}`, text: `明天 14:00 一起去${PZ(place)}。（「行程」看得到）`, key: `aiout:${r.plan.id}` });
      return;
    }
  }

  // ================================================================ the 行程 app
  const h = (...a) => OC.UI.h(...a);
  OC.Pages.define('plan16', '行程', {
    sub: true,
    build(p, el) { p.box = h('div.p16'); el.append(p.box); p.f = { host: null, guests: new Set(), place: 'fair', when: 1, hour: 14, kind: 'outing' }; },
    refresh(p) {
      const cs = Ch().all(); if (!p.f.host || !Ch().get(p.f.host)) p.f.host = S().activeId || (cs[0] && cs[0].id);
      const sig = JSON.stringify([plans().slice(0, 12), cs.map((c) => [c.id, name(c)]), p.f.host, [...p.f.guests], p.f.place, p.f.when, p.f.hour, p.f.kind, p.msg, Sim().day()]); if (p._sig === sig) return; p._sig = sig;
      p.box.replaceChildren(todayCard(), formCard(p), listCard(p));
    },
  });
  const re = (p) => { p._sig = ''; p.refresh(p); };
  const dayText = (d) => { const t = Sim().day(); return d === t ? '今天' : d === t + 1 ? '明天' : d === t + 2 ? '後天' : (OC.Clock.cal ? OC.Clock.cal(d).text : '第 ' + d + ' 天'); };
  function todayCard() {
    const rows = [], cal = OC.Clock.cal ? OC.Clock.cal() : { weekend: false };
    if (OC.Career16 && !cal.weekend) for (const c of Ch().all()) {
      const j = OC.Career16.jobOf(c); if (j && OC.Career16.LINE[j.line].type === 'emp') rows.push([OC.Career16.WORK_H[0], `${name(c)} 上班（${OC.Career16.title(c)}）`]);
      const sc = OC.Career16.schoolOf(c); if (sc.status === 'enrolled' && sc.level) rows.push([OC.Career16.SCHOOL_H[0], `${name(c)} 上學（${OC.Career16.LEVELS[sc.level].zh}）`]);
    }
    for (const pl of plans()) if (pl.status === 'planned' && pl.day === Sim().day()) rows.push([pl.hour, `${name(Ch().get(pl.host))}${pl.kind === 'date' ? '的約會' : '的出遊'}：${PZ(pl.place)}`]);
    rows.sort((a, b) => a[0] - b[0]);
    return h('div.card.p16-card', { 'data-card': 'today' }, h('div.hstack', null, OC.UI.sticker('clock'), h('b.grow', null, `今天（${cal.weekend ? '週末' : '平日'}）`)),
      ...(rows.length ? rows.map(([hr, t]) => h('div.p16-row', null, h('b.num', null, `${String(hr).padStart(2, '0')}:00`), h('span', null, t))) : [h('div.muted', null, '今天沒有排定的事。')]));
  }
  function formCard(p) {
    const f = p.f, cs = Ch().all(), host = Ch().get(f.host), places = Object.keys(OC.Places.P).filter((k) => OC.Places.open(k) && !OC.Places.get(k).interior || ['cafe', 'library'].includes(k));
    const chip = (on, label, attrs, fn, dis) => h('button.chip' + (on ? '.on' : '') + (dis ? '.locked' : ''), Object.assign({ disabled: !!dis, title: dis || '', on: { click: fn } }, attrs), label);
    const dateOK = f.guests.size === 1 && M().romanceOK(f.host, [...f.guests][0]);
    if (f.kind === 'date' && !dateOK) f.kind = 'outing';
    return h('div.card.p16-card', { 'data-card': 'form' }, h('div.hstack', null, OC.UI.sticker('heart'), h('b.grow', null, '新的邀約')),
      h('div.muted', null, '誰發起'), h('div.chips', null, ...cs.map((c) => chip(c.id === f.host, name(c), { 'data-host': c.id }, () => { f.host = c.id; f.guests.delete(c.id); re(p); }))),
      h('div.muted', null, '邀誰'), h('div.chips', null, ...cs.filter((c) => c.id !== f.host).map((c) => chip(f.guests.has(c.id), name(c), { 'data-guest': c.id }, () => { if (f.guests.has(c.id)) f.guests.delete(c.id); else f.guests.add(c.id); re(p); }))),
      h('div.muted', null, '去哪裡'), h('div.chips', null, ...places.map((k) => chip(f.place === k, PZ(k), { 'data-place': k }, () => { f.place = k; re(p); }))),
      h('div.muted', null, '什麼時候'), h('div.chips', null, ...[0, 1, 2].map((d) => chip(f.when === d, dayText(Sim().day() + d), { 'data-when': d }, () => { f.when = d; re(p); })), ...HOURS.map((hr) => chip(f.hour === hr, `${hr}:00`, { 'data-hour': hr }, () => { f.hour = hr; re(p); }))),
      h('div.chips', null, chip(f.kind === 'outing', '出遊', { 'data-kind': 'outing' }, () => { f.kind = 'outing'; re(p); }), chip(f.kind === 'date', '約會', { 'data-kind': 'date' }, () => { f.kind = 'date'; re(p); }, dateOK ? null : '約會：只邀一個人、兩人都成年且打開戀愛')),
      p.msg ? h('div.p16-msg', { role: 'status' }, p.msg) : null,
      h('button.btn.primary.block', { 'data-p16': 'send', on: { click: () => { const r = invite({ host: f.host, guests: [...f.guests], place: f.place, day: Sim().day() + f.when, hour: f.hour, kind: f.kind });
        p.msg = r.ok ? `${name(host)}送出了邀請。` + r.plan.guests.map((g) => `${name(Ch().get(g))}：${r.plan.rsvp[g].yes ? '😊 ' : '🙁 '}${r.plan.rsvp[g].why}`).join('　') : r.why; if (r.ok) f.guests.clear(); re(p); } } }, '送出邀請'));
  }
  function listCard(p) {
    const L = plans().filter((x) => ['planned', 'going', 'done', 'declined'].includes(x.status)).slice(0, 10);
    return h('div.card.p16-card', { 'data-card': 'list' }, h('div.hstack', null, OC.UI.sticker('flag'), h('b.grow', null, '約定')),
      ...(L.length ? L.map((x) => h('div.p16-plan', { 'data-plan': x.id, 'data-st': x.status },
        h('div', null, h('b', null, `${dayText(x.day)} ${x.hour}:00・${PZ(x.place)}`), h('small.muted', null, `　${x.kind === 'date' ? '約會' : '出遊'}・${name(Ch().get(x.host))}發起${x.by === 'ai' ? '（自己約的）' : ''}`)),
        h('div.p16-rsvp', null, ...x.guests.map((g) => h('span.tag', null, `${name(Ch().get(g))} ${x.rsvp[g].yes ? '😊' : '🙁'}${x.rsvp[g].yes ? '' : '（' + x.rsvp[g].why + '）'}`))),
        x.status === 'done' ? h('div.muted', null, (x.came || []).length >= 2 ? `去了：${x.came.map((g) => name(Ch().get(g))).join('、')}` + ((x.noShow || []).length ? `；放鴿子：${x.noShow.map((g) => name(Ch().get(g))).join('、')}` : '') : '沒有成行') : null,
        x.status === 'declined' ? h('div.muted', null, '大家都不能去') : null,
        x.status === 'planned' ? h('button.btn.s.ghost', { 'data-cancel': x.id, on: { click: () => { cancel(x.id); re(p); } } }, '取消') : null)) : [h('div.muted', null, '還沒有約定。')]));
  }
  function init() { Sim().onStep(step); Sim().onDay((d) => dayStep(d)); }
  OC.Outing16 = { plans, answer, invite, cancel, step, settle, dayStep, init, HOURS };
})();
