/* OC Shimeji — Phase 4 test harness (Playwright + Chromium, SwiftShader WebGL).
 * Usage: node game/tests/life/run.js   (serves nothing itself: start `cd game && python3 -m http.server 8765` first)
 * boot(): fresh save → three preset OCs with different personalities (mochi / kuri / sora) on the island,
 * auto-cycle clock, deterministic RNG seed. Everything else is driven through the real game code.
 */
const { chromium } = require('playwright');
const URL = process.env.OC_URL || 'http://localhost:8765/index.html';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];

async function launch(o = {}) {
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext({ viewport: { width: o.w || 393, height: o.h || 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { browser, ctx, page, errors };
}
/** fresh game with N preset OCs (first one played) */
async function boot(page, o = {}) {
  const q = o.query || '';
  if (!page.url().startsWith('http')) await page.goto(URL + q);
  await page.evaluate((o) => { if (window.OC && OC.Store) OC.Store.persist = () => {}; window.OCApp && (window.OCApp.lifecycle = () => {}); localStorage.clear(); if (!o.intro) localStorage.setItem('oc.skipIntro', '1'); indexedDB.deleteDatabase('oc-assets'); }, o);
  await page.goto(URL + q);
  await page.waitForSelector('.creator .card', { timeout: 30000 });
  await page.click('.creator .card >> nth=0');
  for (let i = 0; i < 9; i++) { const b = await page.$('.creator > .btn.primary'); if (!b) break; await b.click(); await page.waitForTimeout(150); }
  await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 });
  await page.evaluate(({ n, speed, seed, travel, hour, quickTap }) => { const o = { travel, quickTap };
    const S = OC.Store.s; const keys = ['kuri', 'sora', 'mochi'];
    for (let i = 1; i < n; i++) { const c = OC.Chars.fromPreset(keys[(i - 1) % 3]); if (i >= 3) c.profile.name += i; c.status.onIsland = true; OC.Chars.add(c); }
    for (const c of OC.Chars.all()) c.life.control = c.id === S.activeId ? 'manual' : 'auto';   // the legacy suites assume the played OC only moves when told to (12.0 default is 'semi'; tests/v12 covers it)
    S.onboarded = true; OC.Sim.setMode('cycle'); OC.Sim.setSpeed(speed); OC.Sim.seed(seed);
    /* the cycle clock starts from the device's time of day: a run in the evening found everyone eating or asleep and failed where a morning run passed.
     * A suite that depends on the hour passes { hour } and starts at that hour of the next game day (the clock never goes backwards).
     * It is opt-in: moving to a new day makes the daily systems start over, which the other suites do not expect. */
    if (hour != null) { const c = S.life.clock; c.gm = (Math.floor((c.gm || 0) / 1440) + 1) * 1440 + hour * 60; }
    S.settings.quickTap = o.quickTap !== false;   /* 15.0: tapping a thing selects it and a button does it; the suites written before that drive the game with one tap (the setting players can still switch on). tests/v15 covers the new default. */
    S.settings.calendar = 'real'; /* 16.0: the game calendar (four seasons of 28 days) is the default; the older suites assume the device's date (birthdays, festivals). */ S.life.settings.lively = 'legacy'; /* 16.0: the shared allowance for things that turn to the player (OC.Budget) spaces requests, visits and questions by minutes of real play; the suites written before it expect the old cadence. tests/v16 covers the default. */ S.life.settings.bubbles = true; S.life.settings.visits = o.visits === true; /* 13.0: characters dropping by on their own would hold them ('game') and open a dialogue in the middle of a scenario */ S.life.settings.travel = o.travel === true; S.life.settings.aspAuto = S.life.settings.requests = o.travel === true;   // phase 6 extras only in phase 5/6 runs (phase 4 scenarios predate them) OC.Store.persist();   // phase 4 scenarios run on the island (phase 5 tests turn travel on)
  }, { n: o.chars || 3, speed: o.speed || 10, seed: o.seed || 42, travel: !!o.travel, hour: o.hour == null ? null : o.hour, quickTap: o.quickTap });
  await page.waitForTimeout(400);
  return page;
}
/** advance the simulation headlessly by game minutes (same code path as real time) */
async function advance(page, gm) { return page.evaluate((g) => { OC.Sim.advance(g); return OC.Sim.now(); }, gm); }
/** let real time pass (movement is real time) */
const wait = (page, ms) => page.waitForTimeout(ms);
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); return !!ok; }
module.exports = { launch, boot, advance, wait, check, results, URL };
