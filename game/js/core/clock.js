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
      date: cyc ? `第${gd}天` : `${d.getMonth() + 1}/${d.getDate()}`, week: cyc ? `×${OC.Sim.speed()}` : `週${WEEK[d.getDay()]}`, cycle: !!cyc,
      time: real ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : PHASE_ZH[phase(h)],
      phase: phase(h), phaseZh: PHASE_ZH[phase(h)], wx: weather(), wxZh: WX_ZH[weather()], wxIcon: WX_ICON[weather()],
    };
  }
  /* 15.3: the island's season — from the calendar month (northern hemisphere) unless the player picked one (settings.season).
   * It is read once when the game starts (the world's colours are baked into the shaders), so a change shows after a restart. */
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'], SEASON_ZH = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  function season(d = new Date()) { let q = null; try { q = new URLSearchParams(location.search).get('season'); } catch (e) { /* no location */ } const s = SEASONS.includes(q) ? q : OC.Store.s && OC.Store.s.settings && OC.Store.s.settings.season;   /* ?season=… previews a season (tests, screenshots) */ if (SEASONS.includes(s)) return s; const m = d.getMonth() + 1; return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter'; }
  OC.Clock = { cycleWeather, hour, phase, weather, autoWeather, label, dayKey, season, SEASONS, SEASON_ZH, WEATHERS, WX_ZH, WX_ICON, PHASE_ZH, PRESET_HOUR };
})();
