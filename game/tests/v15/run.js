/* OC Shimeji 15.0 — acceptance. Usage: node game/tests/v15/run.js [1 2 …]   (http.server on :8765 first, or OC_URL)
 * 1  tapping is selecting, not doing (real touch events): things in the world, the ring menu, dialogue choices */
const path = require('path'), fs = require('fs');
const H = require('../life/harness.js');
const want = (n) => process.argv.length <= 2 || process.argv.slice(2).includes(String(n));
const { check, wait } = H;
const SHOTS = process.env.OC_SHOTS || path.join(__dirname, '..', '..', '..', 'deliverables', 'v15');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
(async () => {
  const { browser, page, errors } = await H.launch();
  try {
    await H.boot(page, { chars: 3, seed: 15, quickTap: false });
    await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 10; S.settings.weather = 'clear'; if (OC.Events.current) OC.Events.end('t'); S.life.ev.lastAny = Date.now() + 3.6e6; S.play.req.nextAt = 1e12; });
    await wait(page, 1200);
    const closeAll = () => page.evaluate(() => { if (OC.Pick) OC.Pick.close(); if (OC.Radial) OC.Radial.close(true); for (let k = 0; k < 6 && OC.UI.stack.length; k++) { const l = OC.UI.stack[OC.UI.stack.length - 1]; l.close && l.close(); if (OC.UI.stack[OC.UI.stack.length - 1] === l) OC.UI.stack.pop(); } OC.App.tab('island'); });
    /* where things are on screen right now (from the game's own pick list), away from the HUD */
    const find = (type) => page.evaluate((type) => { const its = OC.World.interacts || []; for (const it of its) { if (it.type !== type) continue; const at = it.at || it; const p = OC.World.project(it.x != null ? it.x : at.x, it.y != null ? it.y : at.y, OC.World.levelAt(at.x, at.y), 10); if (p.x > 50 && p.x < innerWidth - 50 && p.y > 200 && p.y < innerHeight - 200) return { x: p.x, y: p.y, label: it.label || null }; } return null; }, type);
    const state = () => page.evaluate(() => { const p = OC.App.player; return { pick: OC.Pick.open_, key: OC.Pick.key, card: (document.querySelector('.pick-card b') || {}).textContent || null, verb: (document.querySelector('.pick-acts .btn') || {}).textContent || null, walking: !!(p && p.path), sitting: !!(p && p.mode === 'sit'), area: OC.World.area.id, stack: OC.UI.stack.length, ring: OC.Radial.open_ }; });

    // ================= 1. tapping is selecting, not doing =================
    if (want(1)) {
      await closeAll();
      const bench = await find('bench'), out = { bench: !!bench };
      if (bench) {
        await page.touchscreen.tap(bench.x, bench.y);
        await page.waitForFunction(() => OC.Pick.open_, null, { timeout: 10000 }).catch(() => {});
        out.afterTap = await state(); await wait(page, 1500); out.later = await state();
        await shot(page, '1-pick-card');
        /* a second, immediate tap on the same spot (the classic accidental double tap) lands where the card's button is not yet armed */
        const btn = await page.evaluate(() => { const b = document.querySelector('.pick-acts .btn'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height }; });
        out.btn = btn;
        /* tap outside: the card goes away and nothing happened */
        await page.touchscreen.tap(30, 430); await wait(page, 500); out.dismissed = await state();
        /* open again, and this time press the button → now it walks over and sits */
        await page.touchscreen.tap(bench.x, bench.y); await page.waitForFunction(() => OC.Pick.open_, null, { timeout: 10000 }).catch(() => {});
        /* pressing at once (inside the 350 ms window) does nothing */
        const b2 = await page.evaluate(() => { const b = document.querySelector('.pick-acts .btn'); const r = b.getBoundingClientRect(); const armed = OC.Pick.armed(document.querySelector('.pick-card')); b.click(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, armedAtClick: armed, stillOpen: OC.Pick.open_ }; });
        out.early = b2;
        await wait(page, 600); await page.touchscreen.tap(b2.x, b2.y);
        await page.waitForFunction(() => { const p = OC.App.player; return p && (p.path || p.mode === 'sit'); }, null, { timeout: 10000 }).catch(() => {});
        out.afterPress = await state();
      }
      check('1a 點一下長椅：只出現動作卡（名稱＋「坐下」），角色沒有走過去、沒有坐下；等一下也不會自己開始', out.bench && out.afterTap.pick && /bench/.test(out.afterTap.key) && out.afterTap.verb === '坐下' && !out.afterTap.walking && !out.afterTap.sitting && out.later.pick && !out.later.walking && !out.later.sitting, { tap: out.afterTap, later: out.later });
      check('1b 點別的地方：動作卡收起來，什麼都沒發生（也不會因為這一下而走過去）', out.bench && !out.dismissed.pick && !out.dismissed.sitting && out.dismissed.stack === 0, out.dismissed);
      check('1c 卡片剛出現的 0.35 秒內按鈕不接受按壓（防止同一根手指誤觸）；之後按「坐下」才真的走過去坐；按鈕高度 ≥ 48', out.bench && out.early.armedAtClick === false && out.early.stillOpen === true && (out.afterPress.walking || out.afterPress.sitting) && !out.afterPress.pick && out.btn && out.btn.h >= 48, { early: out.early, after: out.afterPress, btn: out.btn });

      /* the things that used to take you away with one tap: the door of your home */
      await closeAll(); await page.evaluate(() => { const p = OC.App.player; if (p.mode === 'sit') { p.mode = 'idle'; p.seatY = 0; } p.path = null; }); await wait(page, 400);
      /* walk the view over to the house first (it is at the top of the island, outside the first screen) */
      await page.evaluate(() => { const it = (OC.World.interacts || []).find((x) => x.type === 'home'); if (!it) return; const t = OC.World.nearestWalkable(it.at.x, it.at.y + 46, 60) || it.at; const p = OC.App.player; p.x = t.x; p.y = t.y; p.path = null; });
      await page.waitForFunction(() => { const it = (OC.World.interacts || []).find((x) => x.type === 'home'); if (!it) return true; const p = OC.World.project(it.at.x, it.at.y, OC.World.levelAt(it.at.x, it.at.y), 10); return p.y > 200 && p.y < innerHeight - 200 && p.x > 50 && p.x < innerWidth - 50; }, null, { timeout: 20000 }).catch(() => {});
      await wait(page, 800);
      const home = await find('home'); const h2 = { home: !!home };
      if (home) { await page.touchscreen.tap(home.x, home.y); await page.waitForFunction(() => OC.Pick.open_, null, { timeout: 10000 }).catch(() => {}); await wait(page, 2500); h2.s = await state(); }
      check('1d 點到「我的家」的門不會直接換地點：先出現「進去」的動作卡，人還在原地', !!home && h2.s.pick && h2.s.verb === '進去' && h2.s.area === 'isle' && !h2.s.walking, h2);

      /* the ring menu of a character: the finger that opened it cannot pick from it */
      await closeAll();
      const r = await page.evaluate(async () => {
        const ids = OC.Chars.all().map((c) => c.id), a = OC.App.actorOf(ids[1]) || OC.App.player, p = OC.App.screenOf(a), ran = [];
        const open0 = OC.Radial.open; OC.Radial.open = function (cfg) { cfg.items = cfg.items.map((it) => it && Object.assign({}, it, { run: () => ran.push(it.label) })); return open0.call(this, cfg); };
        OC.App.menuFor(a === OC.App.player ? { type: 'self' } : { type: 'mate', id: ids[1] }, p);
        const btns = [...document.querySelectorAll('.radial-btn:not(.off)')]; const el = document.querySelector('.radial');
        const armed0 = OC.Pick.armed(el); btns[0].click(); const early = ran.length;
        await new Promise((r2) => setTimeout(r2, 500)); const armed1 = OC.Pick.armed(el); btns[0].click(); await new Promise((r2) => setTimeout(r2, 400));
        OC.Radial.open = open0; return { n: btns.length, armed0, early, armed1, late: ran.length };
      });
      check('1e 環狀選單剛打開時按鈕不接受按壓（不會「自己選了一個互動」）；0.35 秒後才可以選', r.n >= 3 && r.armed0 === false && r.early === 0 && r.armed1 === true && r.late === 1, r);

      /* a question in a dialogue: the tap that advanced the text cannot answer it */
      await closeAll();
      const d = await page.evaluate(async () => {
        let picked = null; OC.App.showDialogue('測試', ['要不要一起去？'], [{ label: '好啊', fx: () => { picked = 'yes'; return []; } }, { label: '下次吧', fx: () => { picked = 'no'; return []; } }], () => {}, true);
        await new Promise((r2) => setTimeout(r2, 60)); const line = document.querySelector('.dlg .line'); document.querySelector('.dlg').click();   /* finishes the typewriter → choices appear */
        await new Promise((r2) => setTimeout(r2, 80)); const b = document.querySelector('.dlg .choices .btn'); const pe0 = b ? getComputedStyle(b).pointerEvents : null;
        await new Promise((r2) => setTimeout(r2, 500)); const pe1 = b ? getComputedStyle(b).pointerEvents : null; b && b.click(); await new Promise((r2) => setTimeout(r2, 200));
        return { has: !!b, pe0, pe1, picked, text: line && line.textContent };
      });
      await closeAll();
      check('1f 對話的選項剛出現時點不到（讓文字跳完的那一下不會順便回答問題），之後才可以選', d.has && d.pe0 === 'none' && d.pe1 !== 'none' && d.picked === 'yes', d);

      /* the setting for people who want one tap */
      const q = await page.evaluate(async () => { OC.Store.s.settings.quickTap = true; return true; });
      const bench2 = await find('bench'); let qs = null;
      if (bench2) { await page.evaluate(() => { const p = OC.App.player; if (p.mode === 'sit') { p.mode = 'idle'; p.seatY = 0; } p.path = null; }); await page.touchscreen.tap(bench2.x, bench2.y); await page.waitForFunction(() => { const p = OC.App.player; return p && (p.path || p.mode === 'sit'); }, null, { timeout: 10000 }).catch(() => {}); qs = await state(); }
      await page.evaluate(() => { OC.Store.s.settings.quickTap = false; });
      check('1g 設定「點一下就做」打開後回到一點就做（沒有動作卡）；預設是關的', q && (!bench2 || (!qs.pick && (qs.walking || qs.sitting))), qs);
    }

    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.stack || e)); }
  await browser.close();
  const bad = H.results.filter((r) => !r.ok); console.log(`\n${H.results.length - bad.length}/${H.results.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
