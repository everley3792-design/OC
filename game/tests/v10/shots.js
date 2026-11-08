/* OC Shimeji 1.0 — visual gallery: boots a game and screenshots every main screen (light + dark).
 * Usage: node game/tests/v10/shots.js [outDir] [light|dark|both]   (http.server on :8765 first)
 * Used to check visual consistency of the redesign (deliverables/v10/). */
const path = require('path'), fs = require('fs');
const H = require('../life/harness.js');
const OUT = process.argv[2] || path.join(__dirname, '../../../deliverables/v10');
const MODE = process.argv[3] || 'light';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, errors } = await H.launch();
  await H.boot(page, { chars: 3, seed: 5 });
  await page.evaluate(() => { const S = OC.Store.s.settings; S.time = 'fixed'; S.fixedHour = 15.5; S.weather = 'clear'; S.perf = 'high'; OC.App.applyPerf(); OC.Store.s.coins = 1280; });
  await page.waitForTimeout(2500);
  const close = () => page.evaluate(() => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); OC.App.tab && 0; });
  const themes = MODE === 'both' ? ['light', 'dark'] : [MODE];
  for (const th of themes) {
    await page.evaluate((t) => OC.App.setTheme(t), th);
    const shot = async (n) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, `${th}-${n}.png`) }); };
    await page.evaluate(() => document.querySelector('.tab') && document.querySelector('.tab').click()); await shot('01-island');
    const pages = await page.evaluate(() => Object.keys(OC.Pages.pages));
    const want = ['char', 'profile', 'bag', 'shop', 'workshop', 'explore', 'more', 'collection', 'settings', 'petcenter', 'lifeset', 'ledger'];
    for (const id of want) {
      if (!pages.includes(id)) continue;
      await page.evaluate((id) => { try { const tabs = { char: '角色', workshop: '工坊', explore: '探索', more: '日常' }; if (tabs[id]) document.querySelector(`.tab[aria-label="${tabs[id]}"]`).click(); else { window.OCApp.openPage(id); if (id === 'profile' || id === 'shop') OC.Pages.open(id, id === 'profile' ? { id: OC.Store.s.activeId } : { shop: 'general' }); } } catch (e) { console.error(e); } }, id);
      await shot('p-' + id);
      await page.evaluate(() => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); });
      await page.evaluate(() => { const b = document.querySelector('.tab'); b && b.click(); });
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => OC.App.toggleStatus && OC.App.toggleStatus(true)); await shot('02-status'); await page.evaluate(() => OC.App.toggleStatus && OC.App.toggleStatus(false));
    await page.evaluate(() => OC.App.timePanel && OC.App.timePanel()); await shot('03-time'); await close();
    await page.evaluate(() => { const id = OC.Store.s.activeId; OC.App.menuFor({ type: 'self', id }, OC.App.screenOf(OC.App.player)); }); await shot('04-ring'); await page.evaluate(() => OC.Radial && OC.Radial.close(true));
  }
  console.log('pages:', await page.evaluate(() => Object.keys(OC.Pages.pages).join(' ')));
  console.log('errors:', errors.slice(0, 5));
  await browser.close();
})();
