/* OC Shimeji — Phase 5 UI screenshots (bag, shop, collection, products, ledger, food preferences, cooking, places).
 *   node game/tests/world/screens.js     → deliverables/phase5/ui-*.png
 * Items are given through the real transaction system with test keys (life-sim mode has no "add item" UI).
 */
const fs = require('fs'), path = require('path');
const H = require('../life/harness.js');
const OUT = path.join(__dirname, '..', '..', '..', 'deliverables', 'phase5');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { browser, page, errors } = await H.launch(); await H.boot(page, { chars: 3, seed: 5, travel: true });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `ui-${n}.png`) });
  const go = async (to) => { await page.evaluate((t) => OC.WorldUI.travel(t), to); await page.waitForFunction((t) => OC.World.area && OC.World.area.id === t, to, { timeout: 15000 }); await page.waitForTimeout(1600); };
  await page.evaluate(() => { OC.Tx.run('shots:seed', { get: { coins: 3000, items: { pancake: 2, cocoa: 2, cookie: 3, f_rainbow: 1, f_koi: 1, b_ladybug: 1, shell_star: 1, berry: 4, tomato: 2, rice: 2, sofa: 1, ball: 1, plush: 1, 'acc-crown': 1, seed_carrot: 2 } } }, 'screens'); OC.Items.toggleFav('pancake'); });
  for (const p of ['street', 'cafe', 'library', 'forest', 'beach']) { await go(p); await shot(`place-${p}`); }
  await go('isle');
  await page.evaluate(() => OC.Pages.open('bag')); await page.waitForTimeout(600); await shot('bag');
  await page.evaluate(() => OC.Pages.itemSheet('pancake')); await page.waitForTimeout(600); await shot('item-sheet'); await page.evaluate(() => OC.UI.back()); await page.evaluate(() => OC.Pages.close('bag'));
  await page.evaluate(() => OC.Pages.open('shop', { shop: 'furniture' })); await page.waitForTimeout(600); await shot('shop-furniture'); await page.evaluate(() => OC.Pages.close('shop'));
  await page.evaluate(() => OC.Pages.open('shop', { shop: 'market' })); await page.waitForTimeout(600); await shot('shop-market'); await page.evaluate(() => OC.Pages.close('shop'));
  await page.evaluate(() => OC.Pages.open('collection')); await page.waitForTimeout(600); await shot('collection'); await page.evaluate(() => OC.Pages.close('collection'));
  await page.evaluate(() => OC.Pages.open('products')); await page.waitForTimeout(400); await page.evaluate(() => OC.P5UI.editProduct(null)); await page.waitForTimeout(600); await shot('product-editor'); await page.evaluate(() => { OC.UI.back(); OC.Pages.close('products'); });
  await page.evaluate(() => OC.Pages.open('ledger')); await page.waitForTimeout(500); await shot('ledger'); await page.evaluate(() => OC.Pages.close('ledger'));
  await page.evaluate(() => OC.App.tab('more')); await page.waitForTimeout(500); await shot('more');
  await page.evaluate(() => { OC.App.tab('island'); OC.Pages.open('charedit', { id: OC.Store.s.activeId }); }); await page.waitForTimeout(800);
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-page="charedit"] .seg button')].find((x) => x.textContent === '喜好'); if (b) b.click(); }); await page.waitForTimeout(700);
  await page.evaluate(() => { const el = document.querySelector('[data-page="charedit"] .food-row'); if (el) el.scrollIntoView({ block: 'center' }); }); await page.waitForTimeout(300); await shot('food-prefs');
  await page.evaluate(() => OC.UI.back()); await page.waitForTimeout(400);
  await page.evaluate(() => OC.Mini.cookGame(OC.Mini.RECIPES[0])); await page.waitForTimeout(800); await shot('cooking'); await page.evaluate(() => OC.Mini.close());
  await page.evaluate(() => OC.App.setTheme('dark')); await page.evaluate(() => OC.App.tab('explore')); await page.waitForTimeout(700); await shot('map-dark');
  await page.evaluate(() => { OC.App.tab('island'); OC.Pages.open('shop', { shop: 'cafe' }); }); await page.waitForTimeout(600); await shot('shop-cafe-dark');
  console.log('errors', errors.slice(0, 5)); await browser.close();
})();
