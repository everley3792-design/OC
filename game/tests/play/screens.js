/* OC Shimeji — Phase 6 UI screenshots → deliverables/phase6/ui-*.png  (node game/tests/play/screens.js) */
const fs = require('fs'), path = require('path');
const H = require('../life/harness.js');
const OUT = path.join(__dirname, '..', '..', '..', 'deliverables', 'phase6'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { browser, page, errors } = await H.launch(); await H.boot(page, { chars: 3, seed: 9, travel: true });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `ui-${n}.png`) });
  await page.evaluate(() => { OC.Store.s.settings.weather = 'clear'; OC.Sim.setSpeed(1); const c = OC.Chars.active(); OC.Mind.skill(c, 'cook', 70); OC.Mind.skill(c, 'fishing', 30); OC.Growth.setAsp(c, 'angler', 'player'); for (let i = 0; i < 5; i++) OC.Progress.emit('fish', { item: 'f_sardine', oc: c.id }); OC.Progress.emit('shake', {}); OC.Progress.emit('shake', {}); OC.Progress.emit('shake', {}); OC.Mind.remember(c, { type: 'milestone', imp: 0.9, text: '第一次和大家一起看海', key: 's1' }); OC.Achieve.check(); });
  await page.waitForTimeout(4000);
  await page.evaluate(() => OC.App.tab('more')); await page.waitForTimeout(900); await shot('hub-quests');
  for (const t of ['req', 'ach', 'coll']) { await page.evaluate((t) => { const P = OC.Pages.pages.more; P.tab = t; P._sig = ''; P.refresh(P); }, t); await page.waitForTimeout(500); await shot('hub-' + t); }
  await page.evaluate(() => { OC.App.tab('island'); OC.Pages.open('profile', { id: OC.Store.s.activeId, tab: 'grow' }); }); await page.waitForTimeout(900); await shot('profile-growth');
  await page.evaluate(() => { OC.Pages.close('profile'); OC.Pages.open('profile', { id: OC.Store.s.activeId, tab: 'mem' }); }); await page.waitForTimeout(900); await shot('profile-journal');
  await page.evaluate(() => { OC.Pages.close('profile'); OC.Pages.open('collection'); }); await page.waitForTimeout(900); await shot('collection');
  await page.evaluate(() => { OC.Pages.close('collection'); OC.Pages.open('settings'); }); await page.waitForTimeout(600); await page.evaluate(() => { const t = [...document.querySelectorAll('[data-page="settings"] .section-title')].find((e) => e.textContent.includes('聲音')); if (t) t.scrollIntoView(); }); await page.waitForTimeout(400); await shot('settings-sound');
  await page.evaluate(() => { OC.Pages.close('settings'); OC.App.setTheme('dark'); OC.App.tab('more'); }); await page.waitForTimeout(800); await shot('hub-dark');
  await page.evaluate(() => { OC.App.setTheme('light'); OC.App.tab('island'); OC.WorldUI.travel('beach'); }); await page.waitForTimeout(2500); await shot('beach-entrance');
  console.log('errors', errors.slice(0, 4)); await browser.close();
})();
