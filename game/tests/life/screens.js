/* Phase 4 UI screenshots → deliverables/phase4/ (after some life has happened). node game/tests/life/screens.js */
const path = require('path');
const H = require('./harness.js');
const OUT = path.join(__dirname, '..', '..', '..', 'deliverables', 'phase4');
(async () => {
  const { browser, page, errors } = await H.launch();
  await H.boot(page, { chars: 4, seed: 21 });
  await page.evaluate(() => { OC.Store.s.life.settings.playerAuto = true; OC.Store.s.settings.dev = true; });
  await H.wait(page, 40000);
  await page.evaluate(() => { const c = OC.Chars.all()[2]; for (let i = 0; i < 6; i++) OC.Mind.record(c, 'read', 25, { place: 'bench@356', placeZh: '長椅' }); OC.Store.s.settings.weather = 'rain'; for (let i = 0; i < 3; i++) OC.Mind.record(c, 'read', 25, { place: 'bench@356', placeZh: '長椅' }); OC.Store.s.settings.weather = 'auto'; OC.Mind.checkHabits(c); OC.Mind.maybeWish(c, true); OC.Store.s.life.settings.playerAuto = false; });
  await page.screenshot({ path: path.join(OUT, 'ui-island.png') });
  const shots = [
    ['ui-interact', () => OC.LifeUI.interact(OC.Store.s.roster[1])],
    ['ui-notices', () => OC.LifeUI.notices()],
    ['ui-profile-life', () => OC.Pages.open('profile', { id: OC.Store.s.roster[2], tab: 'life' })],
    ['ui-profile-rel', () => OC.Pages.open('profile', { id: OC.Store.s.roster[1], tab: 'rel' })],
    ['ui-profile-mem', () => OC.Pages.open('profile', { id: OC.Store.s.roster[1], tab: 'mem' })],
    ['ui-lifeset', () => OC.Pages.open('lifeset')],
    ['ui-dialogue', () => OC.Pages.open('dialogue')],
    ['ui-lifedev', () => OC.Pages.open('lifedev')],
  ];
  for (const [n, fn] of shots) { await page.evaluate(fn); await H.wait(page, 900); await page.screenshot({ path: path.join(OUT, n + '.png') }); await page.evaluate(() => { while (OC.UI.stack.length) OC.UI.back(); }); await H.wait(page, 400); }
  await page.evaluate(() => OC.App.observe(OC.Store.s.roster[1])); await H.wait(page, 1500); await page.screenshot({ path: path.join(OUT, 'ui-observe.png') }); await page.evaluate(() => OC.App.stopObserve());
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; OC.LifeUI.interact(OC.Store.s.roster[1]); }); await H.wait(page, 900); await page.screenshot({ path: path.join(OUT, 'ui-interact-dark.png') });
  console.log('errors', errors);
  await browser.close();
})();
