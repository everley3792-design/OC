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
  await page.evaluate(({ n, speed, seed, travel }) => { const o = { travel };
    const S = OC.Store.s; const keys = ['kuri', 'sora', 'mochi'];
    for (let i = 1; i < n; i++) { const c = OC.Chars.fromPreset(keys[(i - 1) % 3]); if (i >= 3) c.profile.name += i; c.status.onIsland = true; OC.Chars.add(c); }
    for (const c of OC.Chars.all()) c.life.control = 'manual';   // the legacy suites assume the played OC only moves when told to (12.0 default is 'semi'; tests/v12 covers it)
    S.onboarded = true; OC.Sim.setMode('cycle'); OC.Sim.setSpeed(speed); OC.Sim.seed(seed);
    S.life.settings.bubbles = true; S.life.settings.travel = o.travel === true; S.life.settings.aspAuto = S.life.settings.requests = o.travel === true;   // phase 6 extras only in phase 5/6 runs (phase 4 scenarios predate them) OC.Store.persist();   // phase 4 scenarios run on the island (phase 5 tests turn travel on)
  }, { n: o.chars || 3, speed: o.speed || 10, seed: o.seed || 42, travel: !!o.travel });
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
