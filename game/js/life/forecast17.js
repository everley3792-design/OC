/* OC Shimeji 17.1 — what the island will probably do while the app is closed (OC.Forecast).
 *
 * When the app goes to the background, the next 24 hours are simulated as a dry run (OC.Sim.forecast: the same away simulation,
 * then the save is put back exactly). Because an absence is told from the save alone, the run that happens when you come back
 * tells the same story — so the forecast can honestly become:
 *   notifications   the big moments (relationship changes, falling ill, other milestones) at the time they will happen —
 *                   OFF by default; the player picks the kinds and how many a day; none at night unless asked.
 *   what they do    one line per character per hour ("在雲朵咖啡館吃飯") for the home-screen widget, so it changes while closed.
 * Native code (Android) only schedules what it is given (OCNative.forecastSet) and clears it when the app is back (forecastClear).
 * Nothing here changes the save.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, Sim = () => OC.Sim, Ch = () => OC.Chars;
  const N = () => window.OCNative || null;
  const DEF = { on: false, rel: true, health: true, big: true, max: 3, night: false };
  const set = () => { const L = S().life.settings; L.notify17 = Object.assign({}, DEF, L.notify17 || {}); return L.notify17; };
  const native = () => !!(N() && N().forecastSet);
  const name = (c) => (c ? Ch().name(c) : '');

  /* per-hour notes, written only during a forecast's dry run */
  let doing = null, lastHour = -1;
  function note(g, o) {
    if (!doing || !o || !o.away) return;
    const hr = Math.floor((o.at + g) / 60); if (hr === lastHour) return; lastHour = hr;
    for (const c of Ch().all()) {
      const cur = c.life.cur, A = cur && OC.LifeData.ACTS[cur.act], P = OC.Places.get(c.life.loc || 'isle');
      const trip = c.life.trip && c.life.trip.eta > o.at + g;
      const text = trip ? `在去${(OC.Places.get(c.life.trip.to) || {}).zh || '別處'}的路上` : A ? `${P ? '在' + P.zh : ''}${cur.act === 'sleep' ? '睡覺' : A.zh}` : `${P ? '在' + P.zh : ''}`;
      (doing[c.id] = doing[c.id] || []).push({ gm: hr * 60, text });
    }
  }

  const sickWords = () => Object.values((OC.Health16 && OC.Health16.CONDS) || {}).map((x) => x.zh).filter(Boolean);
  function kindOf(x) {
    if (x.k === 'rel' || (x.k === 'mem' && /鬧得有點僵|和好了|不再像以前那樣親近/.test(x.text))) return 'rel';   /* a type change, a quarrel, making up, drifting apart */
    if (x.k === 'mem' && sickWords().some((w) => new RegExp(w + '了$').test(x.text))) return 'health';
    if (x.k !== 'act' && x.w >= 0.75) return 'big';
    return null;
  }
  /** run the dry forecast: { from, base, items: [{ at, kind, text, who }], doing: { id: [{ at, text }] } } */
  function run(hours = 24) {
    doing = {}; lastHour = -1;
    const res = Sim().forecast(hours, (o, base) => {
      if (!o || o.from == null) return null;
      const ms = (gm) => Math.round(base + (gm - o.from) * 60000);
      const lines = OC.Chronicle.range(o.from, o.to).filter((x) => x.gm > o.from), items = [];   /* only what happens after the app went away */
      for (const x of lines) { const k = kindOf(x); if (k) items.push({ at: ms(x.gm), gm: x.gm, kind: k, text: x.text, who: x.who.slice(), w: x.w }); }
      const dd = {}; for (const [id, L] of Object.entries(doing)) dd[id] = L.map((y) => ({ at: ms(y.gm), text: y.text }));
      return { from: o.from, base, items, doing: dd };
    });
    doing = null; return res;
  }
  /** which ones become notifications: the chosen kinds, the most important first, at most `max`, none at night unless allowed */
  function pick(f, st = set()) {
    if (!f) return [];
    const seen = new Set(), night = (at) => { const h = new Date(at).getHours(); return h >= 22 || h < 8; };
    const ok = f.items.filter((x) => st[x.kind] && (st.night || !night(x.at)) && x.at > f.base).filter((x) => { const k = x.kind + '|' + x.who.slice().sort().join('|') + '|' + Math.round(x.gm / 10); if (seen.has(k)) return false; seen.add(k); return true; });   /* one moment of the same people (both remember it) = one notification */
    return ok.sort((a, b) => b.w - a.w || a.at - b.at).slice(0, Math.max(0, st.max | 0)).sort((a, b) => a.at - b.at)
      .map((x, i) => ({ id: 'fc' + i, at: x.at, kind: x.kind, title: { rel: '關係有了變化', health: '有人不太舒服', big: '島上的大事' }[x.kind] || '晴日島', text: x.text }));
  }
  /** the app goes to the background */
  function onPause() {
    if (!native() || S().life.settings.away17 === false) return null;
    const st = set(), wantDoing = true;
    if (!st.on && !wantDoing) return null;
    let f = null; try { f = run(24); } catch (e) { console.error('[forecast]', e); }
    if (!f) { try { N().forecastClear && N().forecastClear(); } catch (e) { /* old app */ } return null; }
    const pkt = { at: Date.now(), items: st.on ? pick(f, st) : [], doing: f.doing };
    try { N().forecastSet(JSON.stringify(pkt)); } catch (e) { console.error('[forecast native]', e); }
    return pkt;
  }
  /** back in the app: the forecast is spent (what happened is in 「你不在的時候」) */
  function onResume() { try { if (N() && N().forecastClear) N().forecastClear(); } catch (e) { /* old app */ } }

  function init() {
    Sim().onAbstract((g, o) => { if (Sim().dry) note(g, o); });
  }
  OC.Forecast = { init, run, pick, onPause, onResume, set, DEF, native };
})();
