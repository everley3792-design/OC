/* OC Shimeji — 17.0 acceptance: node game/tests/v17/run.js [1 2 …]   (start `cd game && python3 -m http.server 8765` first)
 * 1 the screen guard clears every covering that has no owner (grey scrim, dead layers, letterbox, stage bars, talking, scene)
 * 2 tapping the grey scrim closes the sheet under it even when an invisible layer is on top; a swipe released below the sheet ends
 * 3 the 3D view lost and not restored → a reload card; the guard log in 關於 */
const H = require('../life/harness.js'); const { check } = H;
const only = process.argv.slice(2).map(Number); const want = (n) => !only.length || only.includes(n);
(async () => {
  const { browser, page, errors } = await H.launch({ w: 393, h: 852 });
  try {
    await H.boot(page, { chars: 2, hour: 11 });
    const wait = (fn, ms = 8000) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true).catch(() => false);
    if (want(1)) {
      await page.evaluate(() => { OC.Guard.clear(); if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; OC.Store.s.life.settings.autonomy = 'paused'; const s = OC.UI.sheet('測試', (b) => b.append('x')); window.__s = s; });   /* no event may start and clear the letterbox itself */
      await wait(() => window.__s.el.classList.contains('open'));
      await page.evaluate(() => window.__s.el.remove());   /* someone removed the element without closing the layer */
      const a = await wait(() => !document.getElementById('scrim').classList.contains('on') && !OC.UI.stack.includes(window.__s));
      await page.evaluate(() => { const s = OC.UI.sheet('測試2', (b) => b.append('y')); window.__s2 = s; });
      await wait(() => window.__s2.el.classList.contains('open'));
      await page.evaluate(() => { window.__s2.el.style.transition = 'none'; window.__s2.el.style.transform = 'translateY(2000px)'; });   /* pulled off screen and left there */
      const b = await wait(() => !document.getElementById('scrim').classList.contains('on'));
      await page.evaluate(() => { document.documentElement.classList.add('cinema'); OC.Stage.controls(true); document.body.classList.add('talking'); });
      const c = await wait(() => !document.documentElement.classList.contains('cinema') && !document.querySelector('.stage-ui.on') && !document.body.classList.contains('talking'));
      const log = await page.evaluate(() => OC.Guard.log().map((x) => x.what));
      check('1 安全網：沒有擁有者的遮蓋物 2.5 秒內被清掉（元素被拿掉的視窗、被拉到畫面外的視窗留下的灰色遮罩、上下黑邊、演出黑邊、對話狀態），並寫進紀錄', a && b && c && ['layer-gone', 'scrim-without-sheet', 'cinema-stuck', 'stagebars-stuck', 'talking-stuck'].every((k) => log.includes(k)), { a, b, c, log });
    }
    if (want(2)) {
      const cdp = await page.context().newCDPSession(page);
      const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1 })) });
      await page.evaluate(() => { const s = OC.UI.sheet('測試3', (b) => b.append('z')); window.__s3 = s; window.__inv = { scrim: false, close: () => OC.UI.popLayer(window.__inv) }; OC.UI.pushLayer(window.__inv); });
      await wait(() => window.__s3.el.classList.contains('open')); await page.waitForTimeout(500);
      await T('touchStart', [[196, 120]]); await page.waitForTimeout(60); await T('touchEnd', []);
      const a = await wait(() => window.__s3.closed && !document.getElementById('scrim').classList.contains('on'), 4000);
      /* swipe the sheet down by its grab bar and lift the finger far below it */
      await page.evaluate(() => { const s = OC.UI.sheet('測試4', (b) => b.append('w')); window.__s4 = s; window.__ev4 = []; for (const t of ['pointerdown', 'pointerup', 'pointercancel']) s.el.addEventListener(t, (e) => __ev4.push(t + ':' + Math.round(e.clientY))); });
      await wait(() => { const r = window.__s4.el.querySelector('.grab').getBoundingClientRect(); const ok = r.bottom < innerHeight - 4 && Math.abs(r.top - (window.__gy || 0)) < 0.5; window.__gy = r.top; return ok; }, 10000);   /* settled: the slide-in is slow at software-render frame rates */
      const g = await page.evaluate(() => { const r = window.__s4.el.querySelector('.grab').getBoundingClientRect(); window.__hit = (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) || {}).className; return [r.left + r.width / 2, r.top + r.height / 2]; });
      await T('touchStart', [g]); for (let i = 1; i <= 8; i++) { await T('touchMove', [[g[0], g[1] + i * 40]]); await page.waitForTimeout(16); } await T('touchEnd', []);
      const b = await wait(() => window.__s4.closed && !document.getElementById('scrim').classList.contains('on'), 4000);
      const dbg2 = await page.evaluate((g) => ({ g, rect: JSON.stringify(window.__s4.el.getBoundingClientRect()), hit: String(window.__hit), ev: window.__ev4, c4: window.__s4.closed, scrim: document.getElementById('scrim').classList.contains('on'), stack: OC.UI.stack.map((l) => (l.scrim ? 'S' : '-') + (l.el ? l.el.className : '?')) }), g);
      check('2 點灰色遮罩：就算上面有看不見的層，也會關掉遮罩下的視窗；往下滑把視窗拉走、手指在視窗外放開也會關閉（不會卡在半路留下灰色）', a && b, { a, b, dbg2 });
    }
    if (want(3)) {
      await page.evaluate(() => { OC.World.renderer.getContext().getExtension('WEBGL_lose_context').loseContext(); });
      const a = await wait(() => !!document.querySelector('.guard-card button'), 12000);
      const log = await page.evaluate(() => OC.Guard.log().map((x) => x.what));
      await page.evaluate(() => { const c = document.querySelector('.guard-card'); if (c) c.remove(); window.__ocFail = null; });
      await page.evaluate(() => OC.Pages.open('about')); await page.waitForTimeout(800);
      const about = await page.evaluate(() => !!document.querySelector('.page.open[data-page=about] [data-guardlog]') && /3D 畫面中斷/.test(document.querySelector('.page.open[data-page=about]').textContent));
      check('3 3D 畫面中斷又沒有恢復：出現「重新載入畫面」（先存檔）；「關於」列出安全網紀錄', a && log.includes('webgl-lost') && about, { a, log, about });
    }
    if (want(4)) {
      /* the background-removal sheet (16.3) is a .sheet that never got .open: it sat below the screen with the grey scrim on */
      await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 100; cv.height = 140; const g = cv.getContext('2d'); g.fillStyle = '#0f0'; g.fillRect(0, 0, 100, 140); g.fillStyle = '#f80'; g.fillRect(30, 30, 40, 80);
        window.__cut = 'pending'; OC.Frame16.cutSheet([cv]).then((v) => { window.__cut = v; }); });
      const shown = await wait(() => { const el = document.querySelector('.fr-cut'); if (!el) return false; const r = el.getBoundingClientRect(); const ok = r.bottom <= innerHeight + 1 && r.top < innerHeight - 100 && Math.abs(r.top - (window.__cy || 0)) < 0.5; window.__cy = r.top; return ok; }, 10000);
      await page.waitForTimeout(500);
      const b = await page.evaluate(() => { const btn = [...document.querySelectorAll('.fr-cut button')].find((x) => /套用/.test(x.textContent)); const r = btn.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.touchscreen.tap(b[0], b[1]);
      const applied = await wait(() => window.__cut && window.__cut !== 'pending' && !document.querySelector('.fr-cut') && !document.getElementById('scrim').classList.contains('on'));
      check('4 去背視窗真的出現在畫面上（不是藏在下面只留灰色遮罩），用手指按「套用」會套用並關閉', shown && applied, { shown, applied, b });
    }
    check('沒有未預期的錯誤', errors.filter((e) => !/deprecated|readback|favicon|context lost|CONTEXT_LOST|WebGL/i.test(e)).length === 0, errors.slice(0, 4));
  } finally { await browser.close(); }
  const bad = H.results.filter((x) => !x.ok).length; console.log(`\n${H.results.length - bad}/${H.results.length} 通過`); process.exit(bad ? 1 : 0);
})();
