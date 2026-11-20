/* OC Shimeji 17.1 — background life (OC.Away): what the island does while you are not looking, and the story of it.
 *
 *   while away   OC.Sim.awayRun moves a virtual clock through the absence (see sim.js). This module adds what an empty screen
 *                needs: every 30 virtual minutes people at the same place may meet and talk (OC.Aware.meetAway), outings whose
 *                time comes are gone on and settled (OC.Outing16.awayStep); every day boundary starts the next day for everyone
 *                (Mind.dayStart / Mind11.onDay) and closes the day in the timeline. Days spent away are remembered so that work
 *                and school do not count them as missed (no pay either: OC.Progress never emits while catching).
 *   the story    digest() turns the timeline of the absence into the 「你不在的時候」 page: how long, how many big moments, the three
 *                best moments, and for every day its big moments plus one line per person.
 * Nothing here gives coins or items, and nothing is decided by the screen: the same absence always tells the same story.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, Sim = () => OC.Sim, Ch = () => OC.Chars, C = () => OC.Chronicle;
  const st = () => { const L = S().life; if (!L.away17) L.away17 = { days: {}, last: null }; const a = L.away17; a.days = a.days || {}; return a; };
  const on = () => S().life.settings.away17 !== false;
  let meetAcc = 0, cur = null;

  /** every abstract chunk of an absence */
  function chunk(g, o) {
    if (!o || !o.away) return;
    const d = Math.floor(o.at / 1440); st().days[d] = 1;
    meetAcc += g; if (meetAcc >= 30) { meetAcc = 0; if (OC.Aware && OC.Aware.meetAway) OC.Aware.meetAway(o.at + g); }
    if (OC.Outing16 && OC.Outing16.awayStep) OC.Outing16.awayStep(o.at + g);
  }
  /** a day boundary crossed while away */
  function day(d) {
    st().days[d] = 1;
    for (const c of Ch().all()) { try { OC.Mind.dayStart(c); } catch (e) { console.error('[away day]', e); } }
    if (OC.Mind11 && OC.Mind11.onDay) { try { OC.Mind11.onDay(); } catch (e) { console.error('[away m11]', e); } }
    const A = st(); for (const k of Object.keys(A.days)) if (+k < d - 60) delete A.days[k];
  }
  const wasAway = (d) => !!st().days[d];

  // ---------------------------------------------------------------- the story of an absence
  function digest(info) {
    const o = info || st().last; if (!o || o.from == null) return null;
    const g0 = o.from, g1 = o.to, all = C().range(g0, g1), big = all.filter((x) => x.k !== 'act' && x.w >= 0.45);
    const days = [];
    for (let d = Math.floor(g0 / 1440); d <= Math.floor(g1 / 1440); d++) {
      const L = all.filter((x) => x.d === d); if (!L.length) continue;
      const bigs = L.filter((x) => x.k !== 'act' && x.w >= 0.45).sort((a, b) => a.gm - b.gm).slice(0, 6), used = new Set(bigs.map((x) => x.id));
      const people = Ch().all().map((c) => { const mine = L.filter((x) => x.who.includes(c.id) && !used.has(x.id)); const top = mine.filter((x) => x.k !== 'act').sort((a, b) => b.w - a.w)[0] || mine.slice().sort((a, b) => b.w - a.w || b.gm - a.gm)[0]; return top ? { id: c.id, line: top } : null; }).filter(Boolean);
      days.push({ d, label: OC.Clock.cal ? OC.Clock.cal(d).text : '第 ' + d + ' 天', n: L.length, big: bigs, people });
    }
    return { min: o.min, simulated: o.simulated, capped: !!o.capped, from: g0, to: g1, n: all.length, nBig: big.length, best: C().highlights(g0, g1, 3), days };
  }
  /** how long, in words */
  function span(min) { return min >= 1440 * 2 ? `${Math.round(min / 1440)} 天` : min >= 1440 ? `1 天 ${Math.round((min - 1440) / 60)} 小時` : min >= 90 ? `${Math.round(min / 60)} 小時` : `${Math.round(min)} 分鐘`; }

  function init() {
    Sim().onAbstract(chunk);
    if (Sim().onAwayDay) Sim().onAwayDay(day);
    OC.Store.on('away:begin', () => { meetAcc = 0; });
    OC.Store.on('life:offline', (o) => {
      if (!o || !o.away17 || !on()) return;
      st().last = { at: o.at, min: o.min, simulated: o.simulated, from: o.from, to: o.to, capped: o.capped, reason: o.reason };
      if (o.simulated >= 60) OC.Store.emit('away:digest', st().last);
    });
  }
  OC.Away = { init, chunk, day, wasAway, digest, span, st, get last() { return st().last; } };
})();
