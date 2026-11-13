/* OC Shimeji 14.0 — the audit gallery: every screen and overlay of the app, light + dark, as contact sheets.
 * Usage: node game/tests/v14/shots.js [outDir] [light|dark|both]   (http.server on :8765 first, or OC_URL)
 * It is a tool for looking, not a pass/fail test: it prints JavaScript errors and the list of screens it could not open. */
const path = require('path'), fs = require('fs');
const H = require('../life/harness.js');
const OUT = process.argv[2] || path.join(__dirname, '../../../deliverables/v14');
const MODE = process.argv[3] || 'both';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, errors } = await H.launch();
  await H.boot(page, { chars: 3, seed: 5 });
  await page.evaluate(() => { const S = OC.Store.s.settings; S.time = 'fixed'; S.fixedHour = 15.5; S.weather = 'clear'; S.perf = 'high'; OC.App.applyPerf(); OC.Tx.run('shots:seed', { get: { coins: 880, items: { apple: 3, bread: 2, seedTomato: 4 } } }, '截圖用'); });
  await page.waitForTimeout(2500);
  const closeAll = () => page.evaluate(() => { if (OC.Fun && OC.Fun.state) OC.Fun.end('quit'); if (OC.Radial) OC.Radial.close(true); for (let k = 0; k < 6 && OC.UI.stack.length; k++) { const l = OC.UI.stack[OC.UI.stack.length - 1]; l.close && l.close(); if (OC.UI.stack[OC.UI.stack.length - 1] === l) OC.UI.stack.pop(); } OC.App.toggleStatus && OC.App.toggleStatus(false); const b = document.querySelector('.tab'); b && b.click(); });
  const missed = [];
  const SCREENS = [
    ['01-island', () => {}],
    ['02-status', () => OC.App.toggleStatus(true)],
    ['03-time', () => OC.App.timePanel()],
    ['04-ring', () => OC.App.menuFor({ type: 'self', id: OC.Store.s.activeId }, OC.App.screenOf(OC.App.player))],
    ['05-dialogue', () => { const m = OC.Chars.all().find((c) => c.id !== OC.Store.s.activeId); OC.LifeUI.chat(m.id); }],
    ['06-rps', () => { const m = OC.Chars.all().find((c) => c.id !== OC.Store.s.activeId); OC.Fun.rps(m.id); }],
    ['07-camera', () => OC.App.camSheet()],
    ['08-control', () => OC.LifeUI.controlSheet()],
    ['09-notices', () => OC.LifeUI.notices()],
    ['10-toast', () => { OC.UI.toast('收到了：蘋果 ×1', 'check'); }],
    ['20-char', () => OC.App.tab('char')],
    ['21-profile', () => OC.Pages.open('profile', { id: OC.Store.s.activeId })],
    ['22-profile-life', () => OC.Pages.open('profile', { id: OC.Store.s.activeId, tab: 'life' })],
    ['23-profile-grow', () => OC.Pages.open('profile', { id: OC.Store.s.activeId, tab: 'grow' })],
    ['24-profile-rel', () => OC.Pages.open('profile', { id: OC.Store.s.activeId, tab: 'rel' })],
    ['25-charedit', () => OC.Pages.open('charedit', { id: OC.Store.s.activeId })],
    ['30-workshop', () => OC.App.tab('workshop')],
    ['31-library', () => OC.Pages.open('library')],
    ['32-studio', () => OC.Pages.open('studio', { id: OC.Store.s.activeId })],
    ['33-products', () => OC.Pages.open('products')],
    ['40-explore', () => OC.App.tab('explore')],
    ['41-bag', () => OC.Pages.open('bag')],
    ['42-shop', () => OC.Pages.open('shop', { shop: 'general' })],
    ['43-ledger', () => OC.Pages.open('ledger')],
    ['50-more', () => OC.App.tab('more')],
    ['51-requests', () => { OC.App.tab('more'); const P = OC.Pages.pages.more; P.tab = 'req'; P._sig = ''; P.refresh(P); }],
    ['52-ach', () => { OC.App.tab('more'); const P = OC.Pages.pages.more; P.tab = 'ach'; P._sig = ''; P.refresh(P); }],
    ['53-collection', () => OC.Pages.open('collection')],
    ['54-settings', () => OC.Pages.open('settings')],
    ['55-lifeset', () => OC.Pages.open('lifeset')],
    ['56-about', () => OC.Pages.open('about')],
    ['60-petcenter', () => OC.Pages.open('petcenter')],
    ['61-petone', () => OC.Pages.open('petone', { id: OC.Store.s.activeId })],
    ['62-pettools', () => OC.Pages.open('pettools')],
    ['63-petapps', () => OC.Pages.open('petapps')],
    ['57-news', () => OC.Pages.open('news')],
    ['58-album', () => OC.Pages.open('album')],
    ['64-hill', () => OC.WorldUI.travel('hill')],
    ['65-fair', () => OC.WorldUI.travel('fair')],
    ['67-concert', () => OC.Mini.concert(OC.World.interacts.find((i) => i.type === 'stage'))],
    ['68-toss', () => { OC.Mini.close && OC.Mini.close(); OC.Mini.toss(OC.World.interacts.find((i) => i.type === 'toss')); }],
    ['69-isle', () => { OC.Mini.close && OC.Mini.close(); OC.WorldUI.travel('isle'); }],
    ['70-creator', () => { OC.Creator.start(); /* not awaited: it resolves when the flow is closed */ }],
  ];
  const themes = MODE === 'both' ? ['light', 'dark'] : [MODE];
  for (const th of themes) {
    await page.evaluate((t) => OC.App.setTheme(t), th);
    for (const [name, fn] of SCREENS) {
      await closeAll(); await page.waitForTimeout(250);
      const ok = await page.evaluate(`(async () => { try { await (${fn.toString()})(); return true; } catch (e) { return String(e && e.message || e); } })()`);
      if (ok !== true) { missed.push(`${th}/${name}: ${ok}`); continue; }
      await page.waitForTimeout(name.startsWith('0') ? 1300 : 800);
      if (/hill|fair|isle/.test(name)) await page.waitForFunction(() => !OC.WorldUI.busy, null, { timeout: 60000 }).then(() => page.waitForTimeout(1500)).catch(() => {});
      await page.screenshot({ path: path.join(OUT, `${th}-${name}.png`) });
    }
  }
  console.log('missed:', missed.length ? missed.join(' | ') : 'none');
  console.log('errors:', errors.slice(0, 8));
  await browser.close();
})();
