/* OC Shimeji — world clock & weather.
 * Default: the island follows the device's real time (cosy-life convention). Settings can
 * pin the time of day or the weather. Weather is deterministic per 6-hour block of each
 * real day (hash of the date) so it is stable across restarts and the same on every launch.
 */
(function () {
  'use strict';
  const PRESET_HOUR = { morning: 7.5, noon: 12.5, dusk: 17.8, night: 21.5 };
  const WEATHERS = ['clear', 'cloudy', 'rain', 'fog'];
  const WX_ZH = { clear: '晴朗', cloudy: '多雲', rain: '下雨', fog: '起霧' };
  const WX_ICON = { clear: 'sun', cloudy: 'cloud', rain: 'rain', fog: 'fog' };
  const PHASE_ZH = { morning: '早晨', noon: '中午', dusk: '黃昏', night: '夜晚' };
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  function dayKey(d = new Date()) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  /** fractional hour 0..24 the world should show */
  function hour() {
    const s = OC.Store.s.settings;
    if (s.time === 'cycle' && OC.Sim) return OC.Sim.hourOf();          // Phase 4 auto day cycle (game clock)
    if (s.time === 'fixed') return s.fixedHour == null ? 12 : s.fixedHour;   // 8.0: any hour the player picked
    if (s.time !== 'real' && PRESET_HOUR[s.time] != null) return PRESET_HOUR[s.time];
    const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }
  function phase(h = hour()) { return h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 16 ? 'noon' : h >= 16 && h < 19.5 ? 'dusk' : 'night'; }
  function autoWeather(d = new Date()) {
    const block = Math.floor(d.getHours() / 6);
    const r = OC.hash((d.getFullYear() % 100) * 500 + (d.getMonth() + 1) * 40 + d.getDate() + block * 0.173);
    // fog only makes sense in the early blocks
    if (block <= 1 && r > 0.88) return 'fog';
    return r < 0.52 ? 'clear' : r < 0.78 ? 'cloudy' : r < 0.95 ? 'rain' : 'cloudy';
  }
  /** weather for a game day / 6-hour block (auto cycle mode): same hash, keyed by the game day */
  function cycleWeather() { const gm = OC.Sim.now(), d = Math.floor(gm / 1440), block = Math.floor((gm % 1440) / 360); const r = OC.hash(d * 3.17 + block * 0.173 + 11); if (block <= 1 && r > 0.88) return 'fog'; return r < 0.52 ? 'clear' : r < 0.78 ? 'cloudy' : r < 0.95 ? 'rain' : 'cloudy'; }
  function weather() { const s = OC.Store.s.settings; return WEATHERS.includes(s.weather) ? s.weather : s.time === 'cycle' && OC.Sim ? cycleWeather() : autoWeather(); }
  function label() {
    const d = new Date(), h = hour(), mode = OC.Store.s.settings.time, real = mode === 'real' || mode === 'cycle' || mode === 'fixed';   // 10.0: a fixed hour shows its clock time too
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60), cyc = mode === 'cycle' && OC.Sim;
    const gd = cyc ? OC.Sim.day() - (OC.Store.s.life.clock.day0 != null ? OC.Store.s.life.clock.day0 : OC.Sim.day()) + 1 : 0;
    return {
      date: calMode() === 'game' && OC.Sim ? cal().text : cyc ? `第${gd}天` : `${d.getMonth() + 1}/${d.getDate()}`, week: cyc ? `×${OC.Sim.speed()}` : calMode() === 'game' && OC.Sim ? `週${WEEK[(cal().weekday + 1) % 7]}` : `週${WEEK[d.getDay()]}`, cycle: !!cyc,
      time: real ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : PHASE_ZH[phase(h)],
      phase: phase(h), phaseZh: PHASE_ZH[phase(h)], wx: weather(), wxZh: WX_ZH[weather()], wxIcon: WX_ICON[weather()],
    };
  }
  /* 15.3: the island's season — from the calendar month (northern hemisphere) unless the player picked one (settings.season).
   * It is read once when the game starts (the world's colours are baked into the shaders), so a change shows after a restart. */
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'], SEASON_ZH = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  function season(d0) { const d = d0 || new Date(); let q = null; try { q = new URLSearchParams(location.search).get('season'); } catch (e) { /* no location */ } const s = SEASONS.includes(q) ? q : OC.Store.s && OC.Store.s.settings && OC.Store.s.settings.season;   /* ?season=… previews a season (tests, screenshots) */ if (SEASONS.includes(s)) return s; if (!d0 && calMode() === 'game' && OC.Sim && OC.Store.s.life) return cal().season; return monthSeason(d.getMonth() + 1); }
  /* 16.0 — the calendar. Two kinds (settings.calendar):
   *   'game' (default): a year is four seasons of 28 days = 112 game days. A game day is one day of the life clock (OC.Sim.day()) — in
   *                     real-time / fixed-hour mode that is one real day, in the cycle mode it passes as fast as the speed you chose.
   *                     life.clock.cal0 is the day that counts as spring 1 of year 1 (set when the game or the upgrade first asks).
   *                     A week is 7 days; days 6 and 7 are the weekend (festivals).
   *   'real':           the device's date — 12 months, seasons by month, real weekends; birthdays on their real dates.
   * cal(day) → { mode, year, season, day, weekday (0 = first day of the week), weekend, text, key } for a life-clock day (default: today). */
  const calMode = () => { let q = null; try { q = new URLSearchParams(location.search).get('cal'); } catch (e) { /* no location */ } return q === 'real' || q === 'game' ? q : OC.Store.s.settings.calendar === 'real' ? 'real' : 'game'; };   /* ?cal=real|game previews / tests */
  const monthSeason = (m) => (m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter');
  const YEAR = 112, SEASON_DAYS = 28;
  function cal(day) {
    if (calMode() === 'real' || !OC.Sim) { const d = new Date(), w = d.getDay(); return { mode: 'real', year: d.getFullYear(), season: monthSeason(d.getMonth() + 1), month: d.getMonth() + 1, day: d.getDate(), weekday: (w + 6) % 7, weekend: w === 0 || w === 6, text: `${d.getMonth() + 1}/${d.getDate()}`, key: dayKey(d) }; }
    const c = OC.Store.s.life.clock, today = OC.Sim.day(); if (c.cal0 == null) { c.cal0 = today - (c.cal0pending || 0); delete c.cal0pending; }
    const gd = Math.max(0, (day == null ? today : day) - c.cal0), yd = gd % YEAR, si = Math.floor(yd / SEASON_DAYS), dd = yd % SEASON_DAYS + 1, wd = gd % 7, yr = 1 + Math.floor(gd / YEAR);
    return { mode: 'game', year: yr, season: SEASONS[si], day: dd, yd, gd, weekday: wd, weekend: wd >= 5, text: `${SEASON_ZH[SEASONS[si]]} ${dd} 日`, key: `Y${yr}-${SEASONS[si]}-${dd}` };
  }
  /** a real month / day as a day of the game year (0…111): the month picks the season and the third of it, the day the place inside */
  function toGameDay(m, d) { const mi = (m - 3 + 12) % 12, dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; return Math.min(YEAR - 1, Math.floor((mi + (Math.min(d, dim) - 1) / dim) / 12 * YEAR)); }
  const gameDayText = (yd) => `${SEASON_ZH[SEASONS[Math.floor(yd / SEASON_DAYS)]]} ${yd % SEASON_DAYS + 1} 日`;
  OC.Clock = { cal, calMode, toGameDay, gameDayText, YEAR, SEASON_DAYS, cycleWeather, hour, phase, weather, autoWeather, label, dayKey, season, SEASONS, SEASON_ZH, WEATHERS, WX_ZH, WX_ICON, PHASE_ZH, PRESET_HOUR };
})();
