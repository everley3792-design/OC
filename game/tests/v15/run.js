/* OC Shimeji 15.0 — acceptance. Usage: node game/tests/v15/run.js [1 2 …]   (http.server on :8765 first, or OC_URL)
 * 1  tapping is selecting, not doing (real touch events): things in the world, the ring menu, dialogue choices
 * 6  15.2: Windmill Hill and the Rainbow Fair (facilities, concert, ring toss, Ferris wheel, carousel, mill)  7  island paper, room score, rating, birthdays */
const path = require('path'), fs = require('fs');
const H = require('../life/harness.js');
const want = (n) => process.argv.length <= 2 || process.argv.slice(2).includes(String(n));
const { check, wait } = H;
const SHOTS = process.env.OC_SHOTS || path.join(__dirname, '..', '..', '..', 'deliverables', 'v15');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
(async () => {
  const { browser, ctx, page, errors } = await H.launch();
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
        out.before = await page.evaluate(() => { const p = OC.App.player, b = OC.Brain.get(OC.Store.s.activeId); window.__ocInputLog = []; return { path: !!(p && p.path), st: b && b.st, act: b && b.act }; });
        await page.touchscreen.tap(bench.x, bench.y);
        await page.waitForFunction(() => OC.Pick.open_, null, { timeout: 10000 }).catch(() => {});
        out.afterTap = await state(); out.log = await page.evaluate(() => { const b = OC.Brain.get(OC.Store.s.activeId); return { input: window.__ocInputLog, st: b && b.st, act: b && b.act, why: OC.Brain.log.filter((l) => l.who === OC.Store.s.activeId).slice(0, 2).map((l) => l.text) }; }); await wait(page, 1500); out.later = await state();
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
      check('1a 點一下長椅：只出現動作卡（名稱＋「坐下」），角色沒有走過去、沒有坐下；等一下也不會自己開始', out.bench && out.afterTap.pick && /bench/.test(out.afterTap.key) && out.afterTap.verb === '坐下' && !out.afterTap.walking && !out.afterTap.sitting && out.later.pick && !out.later.walking && !out.later.sitting, { tap: out.afterTap, later: out.later, before: out.before, log: out.log });
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

    // ================= 2. the action queue =================
    if (want(2)) {
      await closeAll();
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)), id = OC.Store.s.activeId, out = {};
        OC.Queue.clear(id); const b = OC.Brain.get(id); if (b.st === 'do' || b.st === 'go') OC.Brain.abort(b, 't'); b.queued = null;
        out.adds = [OC.Queue.add(id, 'read'), OC.Queue.add(id, 'stretch'), OC.Queue.add(id, 'rest'), OC.Queue.add(id, 'nap'), OC.Queue.add(id, 'eat'), OC.Queue.add(id, 'stretch')];
        out.unknown = OC.Queue.add(id, 'no-such-act');
        await sleep(1400); out.list = OC.Queue.list(id).map((x) => x.act + ':' + x.state);
        out.chips = [...document.querySelectorAll('.q-chip')].map((e) => e.textContent.trim());
        out.chipH = document.querySelector('.q-chip') ? document.querySelector('.q-chip').getBoundingClientRect().height : 0;
        /* cancel the second waiting one through its chip (a real click on the HUD) */
        const third = [...document.querySelectorAll('.q-chip')][2]; third && third.click(); await sleep(700);
        out.afterCancel = OC.Queue.list(id).map((x) => x.act);
        /* cancel what it is doing / about to do */
        OC.Queue.cancel(id, -1); await sleep(300); out.afterCur = OC.Queue.list(id).map((x) => x.act + ':' + x.state);
        /* the next one is handed to the engine when it is free */
        const t0 = performance.now(); while (performance.now() - t0 < 20000) { OC.Sim.advance(1); await sleep(150); const l = OC.Queue.list(id); if (l.length && l[0].i === -1) break; }
        out.handed = OC.Queue.list(id).map((x) => x.act + ':' + x.state);
        out.saved = JSON.stringify(OC.Chars.get(id).life.q15);
        OC.Queue.clear(id); OC.Queue.cancel(id, -1); await sleep(300);
        out.cleared = OC.Queue.list(id).length; out.hidden = document.querySelector('.hud-queue').hidden;
        return out;
      });
      check('2a 安排的動作會排成清單：第一個馬上開始，後面的依序等候，最多 4 個在等；不存在的動作不能排', r.adds[0] === 'now' && r.adds.slice(1, 5).every((x) => x === 'queued') && r.adds[5] === false && r.unknown === false && r.list.length === 5 && /^read:/.test(r.list[0]) && r.list.slice(1).every((x) => /:waiting$/.test(x)), { adds: r.adds, list: r.list });
      check('2b 清單顯示在左上（目前的那一個標 ▶、其餘標號碼），每一項點一下就取消（膠囊 34 px 高，點擊範圍向外延伸到 48）', r.chips.length === 5 && /^▶/.test(r.chips[0]) && /^2/.test(r.chips[1]) && r.afterCancel.join() === 'read,stretch,nap,eat' && r.chipH >= 30, { chips: r.chips, afterCancel: r.afterCancel, h: r.chipH });
      check('2c 取消正在做的那一個後，清單裡的下一個會在牠有空時自動交給牠（仍經過生活引擎）；清單存在角色身上；清空後 HUD 的清單收起', !r.afterCur.some((x) => /^read:/.test(x)) && /^stretch:(next|going|doing)$/.test(r.handed[0] || '') && r.saved.startsWith('[') && r.cleared === 0 && r.hidden === true, { afterCur: r.afterCur, handed: r.handed, saved: r.saved });
    }

    // ================= 3. the pocket phone =================
    if (want(3)) {
      await closeAll(); await page.evaluate(() => OC.App.tab('more')); await wait(page, 1000);
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)), out = {};
        const apps = [...document.querySelectorAll('.phone-app')]; out.apps = apps.map((b) => b.textContent); out.minH = Math.min(...apps.map((b) => b.getBoundingClientRect().height));
        out.bar = (document.querySelector('.phone-bar') || {}).textContent || ''; out.on = (document.querySelector('.phone-app.on') || {}).textContent;
        apps.find((b) => b.dataset.v === 'ach').click(); await sleep(500); out.onAfter = (document.querySelector('.phone-app.on') || {}).textContent; out.tab = OC.Pages.pages.more.tab;
        apps.find((b) => b.dataset.v === 'bag').click(); await sleep(700); out.bagOpen = OC.Pages.pages.bag.el.classList.contains('open');
        return out;
      });
      await shot(page, '3-phone'); await closeAll();
      check('3a 「日常」是口袋手機：狀態列（時間、星幣）＋ App 方格（任務、請求、成就、圖鑑、拍照、相簿、地圖、背包、商店、帳本…）；App 觸控高度 ≥ 48', r.apps.length >= 14 && ['任務', '請求', '成就', '圖鑑', '拍照', '相簿', '地圖', '背包', '商店', '帳本', '設定'].every((k) => r.apps.some((a) => a.includes(k))) && /\d{1,2}:\d{2}/.test(r.bar) && r.minH >= 48, { apps: r.apps, bar: r.bar, h: r.minH });
      check('3b 任務類 App 在手機下方直接打開（被選的 App 有標記）；其他 App 打開自己的頁面', /任務$/.test(r.on || '') && /成就$/.test(r.onAfter || '') && r.tab === 'ach' && r.bagOpen, r);
    }

    // ================= 4. photo mode and the album =================
    if (want(4)) {
      await closeAll();
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)), vis = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).visibility : null; }, out = {};
        OC.Store.s.photos = []; OC.Photo.open(); await sleep(600);
        out.hud = vis('#hud'); out.tab = vis('.tabbar'); out.bar = !!document.querySelector('.photo-bar');
        [...document.querySelectorAll('.photo-chips .chip-btn')].find((b) => b.textContent === '黑白').click(); await sleep(200);
        out.preview = document.getElementById('world').style.filter;
        await sleep(400); document.querySelector('.photo-shutter').click();
        const t0 = performance.now(); while (!OC.Store.s.photos.length && performance.now() - t0 < 20000) await sleep(100);
        const x = OC.Store.s.photos[0]; out.saved = !!x; out.meta = x && { filter: x.filter, frame: x.frame, place: x.place };
        out.inSave = JSON.stringify(OC.Store.s.photos).length < 400;   /* only ids and labels in the save, never the image */
        if (x) { const img = await OC.Assets.image(x.id); const c = document.createElement('canvas'); c.width = 24; c.height = 24; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 24, 24); const d = g.getImageData(0, 0, 24, 24).data; let grey = 0, n = 0; for (let i = 0; i < d.length; i += 4) { n++; if (Math.abs(d[i] - d[i + 1]) < 6 && Math.abs(d[i + 1] - d[i + 2]) < 6) grey++; } out.greyShare = +(grey / n).toFixed(2); out.size = [img.width, img.height]; }
        OC.Photo.close(); await sleep(300); out.hudBack = vis('#hud'); out.filterGone = document.getElementById('world').style.filter === '';
        OC.Pages.open('album'); await sleep(900); out.cells = document.querySelectorAll('.album-cell').length;
        return out;
      });
      await shot(page, '4-album'); await closeAll();
      check('4a 拍照模式隱藏所有 HUD 與導覽列，下方有濾鏡、相框與快門；選濾鏡時畫面先預覽', r.hud === 'hidden' && r.tab === 'hidden' && r.bar && /grayscale/.test(r.preview), r);
      check('4b 按快門：照片存進素材庫（存檔裡只有 id 與標籤，不放圖片），濾鏡真的畫進照片裡（黑白 → 幾乎全是灰階）；離開後 HUD 回來、畫面上的預覽濾鏡拿掉', r.saved && r.meta.filter === 'mono' && r.inSave && r.greyShare >= 0.95 && r.size[0] > 100 && r.hudBack === 'visible' && r.filterGone, { meta: r.meta, grey: r.greyShare, size: r.size, back: r.hudBack });
      check('4c 相簿頁列出拍過的照片', r.cells === 1, { cells: r.cells });
    }

    // ================= 5. 15.1 pages: apartment, passport, walls & floor, fitting room, settings board, creator =================
    if (want(5)) {
      await closeAll(); await page.evaluate(() => OC.App.tab('char')); await wait(page, 1300);
      const a = await page.evaluate(() => { const rooms = [...document.querySelectorAll('.apt-room')]; return { n: rooms.length, chars: OC.Chars.all().length, names: rooms.filter((r) => !r.classList.contains('vacant')).map((r) => r.querySelector('.apt-plate b').textContent), me: (document.querySelector('.apt-room.me .apt-plate b') || {}).textContent, active: OC.Chars.name(OC.Chars.active()), vacant: !!document.querySelector('.apt-room.vacant'), drawn: [...document.querySelectorAll('.apt-room:not(.vacant) canvas')].every((cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i] > 40) n++; return n > 30; }) }; });
      await shot(page, '5-apartment');
      const pr = await page.evaluate(async () => { document.querySelector('.apt-room:not(.vacant)').click(); await new Promise((r) => setTimeout(r, 900)); const el = OC.Pages.pages.profile.el; return { open: el.classList.contains('open'), strip: (el.querySelector('.pass-strip b') || {}).textContent, no: (el.querySelector('.pass-no') || {}).textContent }; });
      await shot(page, '5-passport'); await closeAll();
      check('5a 角色頁是公寓：每位角色一扇窗（畫出角色、門牌與名字），操控中的那間有標記，最後一間是「空房間」可以新增角色；點窗戶打開護照式檔案', a.n === a.chars + 1 && a.names.length === a.chars && a.me === a.active && a.vacant && a.drawn && pr.open && /島民護照/.test(pr.strip) && /^No\. \d{6}$/.test(pr.no), { a, pr });
      /* walls and floor of the home */
      await page.evaluate(() => OC.WorldUI.travel('home', { instant: true })); await page.waitForFunction(() => OC.World.area && OC.World.area.id === 'home', null, { timeout: 40000 }); await wait(page, 1500);
      const w = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)), roomColors = () => { const cols = new Set(); OC.World.root.traverse((o) => { if (o.isMesh && o.material && o.material.color) cols.add('#' + o.material.color.getHexString(THREE.SRGBColorSpace)); if (o.isMesh && o.material && o.material.userData && o.material.userData.key) cols.add(String(o.material.userData.key).toLowerCase());   /* walls and floors are textures: their key names the colours */ }); return cols; };
        const before = roomColors(); document.querySelector('.rail-btn[aria-label="佈置模式"]').click(); await sleep(500);
        const btn = [...document.querySelectorAll('.deco-bar .btn')].find((b) => b.textContent === '牆壁與地板'); btn.click(); await sleep(600);
        [...document.querySelectorAll('.swatch')].find((b) => b.textContent === '薄荷').click(); await sleep(2200);
        const after = roomColors(), saved = JSON.stringify(OC.Store.s.surfaces);
        [...document.querySelectorAll('.deco-bar .btn')].find((b) => b.textContent === '牆壁與地板').click(); await sleep(600);
        [...document.querySelectorAll('.sheet .btn')].find((b) => b.textContent === '恢復原本的樣子').click(); await sleep(2200);
        const reset = roomColors(); document.querySelector('.rail-btn[aria-label="佈置模式"]').click();
        return { mintBefore: [...before].some((k) => k.includes('#e9f5ef')), mintAfter: [...after].some((k) => k.includes('#e9f5ef')), creamBack: [...reset].some((k) => k.includes('wl#fff1de')), saved, cleared: !OC.Store.s.surfaces.home, area: OC.World.area.id };
      });
      await page.evaluate(() => OC.WorldUI.travel('isle', { instant: true })); await page.waitForFunction(() => OC.World.area && OC.World.area.id === 'isle', null, { timeout: 40000 });
      check('5b 在家裡的佈置模式可以換牆壁與地板（真的重建了房間的顏色、存起來）；「恢復原本的樣子」回到原本的顏色', !w.mintBefore && w.mintAfter && /e9f5ef/i.test(w.saved) && w.creamBack && w.cleared && w.area === 'home', w);
      /* the fitting room */
      await closeAll();
      const f = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)), me = OC.Chars.active(), look0 = JSON.stringify(me.look);
        OC.Pages.open('shop', { shop: 'clothes' }); await sleep(900);
        const item = [...document.querySelectorAll('.shop-item')][0]; item.click(); await sleep(900);
        const st = document.querySelector('.fit-stage'); return { stage: !!st, wear: st && st.classList.contains('wear'), label: st && st.textContent, lookSame: JSON.stringify(OC.Chars.active().look) === look0 };
      });
      await shot(page, '5-fitting'); await closeAll();
      check('5c 服裝店的購買畫面是試衣間：操控中的角色穿著這件衣服（用副本畫，角色本身沒有被改）', f.stage && f.wear && /試穿中/.test(f.label) && f.lookSame, f);
      /* settings board and the creator's first step */
      const g = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
        OC.Pages.open('settings'); await sleep(900); const tiles = [...document.querySelectorAll('.set-tile')].map((b) => b.textContent);
        const pg = OC.Pages.pages.settings.el; pg.scrollTop = 0; [...document.querySelectorAll('.set-tile')].find((b) => b.textContent === '資料').click(); await sleep(1200);
        const head = [...pg.querySelectorAll('.section-title')].find((t) => t.textContent.startsWith('資料')); const top = head.getBoundingClientRect().top;
        OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); await sleep(300);
        OC.Creator.start(); await sleep(1200); const cards = [...document.querySelectorAll('.cr-choice')]; cards[1].click(); await sleep(300);
        const on = document.querySelectorAll('.cr-choice.on').length, hasStk = cards.every((c) => c.querySelector('.cr-ic .stk, .cr-ic svg'));
        return { tiles, scrolled: pg.scrollTop > 200, top, cards: cards.length, on, hasStk };
      });
      await closeAll(); await page.evaluate(() => { const x = document.querySelector('.creator, .creator-flow'); if (x) x.remove(); });
      check('5d 設定最上面是各區的方格（外觀、效能、世界、生活、操作、聲音、資料），點一下就捲到那一區；創角第一步是有貼紙的大卡片、選中的有標記', ['外觀', '效能', '世界', '生活', '操作', '資料'].every((k) => g.tiles.includes(k)) && g.scrolled && g.top < 220 && g.cards === 4 && g.on === 1 && g.hasStk, g);
    }

    // ================= 6. 15.2: Windmill Hill and the Rainbow Fair are real places =================
    if (want(6)) {
      await closeAll();
      const go = async (id) => { await page.evaluate((id) => OC.WorldUI.travel(id), id); await page.waitForFunction((id) => OC.World.area.id === id && !OC.WorldUI.busy, id, { timeout: 90000 }); await wait(page, 800); };
      const info = {};
      for (const id of ['hill', 'fair']) {
        await go(id);
        info[id] = await page.evaluate(() => { const p = OC.App.player, types = OC.World.interacts.map((i) => i.type); return { walk: OC.World.walkable(p.x, p.y), types, calls: OC.World.renderer.info.render.calls, open: OC.Places.open(OC.World.area.id), aff: OC.Brain.dump ? null : null }; });
        await page.evaluate(() => OC.World.camTo(null, 1.15)); await wait(page, 1500); await shot(page, '6-' + id);
      }
      check('6a 風車丘、彩虹遊樂園已開放、可以進入，玩家站在可走的地方；各有真的設施（磨坊商店、花田、野餐墊、採集、小生物／摩天輪、旋轉木馬、舞台、套圈圈、點心攤）',
        info.hill.open && info.fair.open && info.hill.walk && info.fair.walk && ['shop', 'bed', 'towel', 'forage', 'critter', 'exit'].every((t) => info.hill.types.includes(t)) && ['wheel', 'ride', 'stage', 'toss', 'shop', 'exit'].every((t) => info.fair.types.includes(t)), info);
      /* the stage card, then a concert played with real touches on the lanes */
      await closeAll();
      await page.evaluate(() => OC.World.camTo(null, 2)); await page.evaluate(() => Promise.race([new Promise((r) => OC.App.goThen(300, 410, r)), new Promise((r) => setTimeout(r, 60000))])); await wait(page, 1500);
      const stage = await find('stage');
      for (let k = 0; k < 3 && stage; k++) { await page.touchscreen.tap(stage.x, stage.y); const ok = await page.waitForFunction(() => OC.Pick.open_ && OC.Pick.key && OC.Pick.key.startsWith('stage'), null, { timeout: 8000 }).then(() => true).catch(() => false); if (ok) break; await closeAll(); await wait(page, 500); }
      const card = await page.evaluate((st) => ({ at: st, key: OC.Pick.key, title: (document.querySelector('.pick-card b') || {}).textContent, verb: (document.querySelector('.pick-acts .btn') || {}).textContent, mini: OC.Mini.active }), stage);
      await closeAll();
      const coins0 = await page.evaluate(() => { OC.Progress.count('concert'); return OC.Store.s.coins; });
      await page.evaluate(() => OC.Mini.concert(OC.World.interacts.find((i) => i.type === 'stage'))); await wait(page, 300);
      const rect = await page.evaluate(() => OC.Mini.state.rect); const done = new Set(); let taps = 0;
      for (let guard = 0; guard < 400; guard++) {
        const nx = await page.evaluate((done) => { const s = OC.Mini.state; if (!s || s.done) return null; const now = (performance.now() - s.t0) / 1000; const n = s.notes.map((n, i) => Object.assign({ i }, n)).find((n) => !n.st && !done.includes(n.i) && n.t > now - 0.05); return n ? { i: n.i, lane: n.lane, ms: (n.t - now) * 1000 } : { none: true }; }, [...done]);
        if (!nx) break; if (nx.none) { await new Promise((r) => setTimeout(r, 200)); continue; }
        if (nx.ms > 400) { await new Promise((r) => setTimeout(r, nx.ms - 300)); continue; }
        await new Promise((r) => setTimeout(r, Math.max(0, nx.ms - 40)));
        await page.touchscreen.tap(rect.x + rect.width * (nx.lane + 0.5) / 3, rect.y + rect.height / 2); taps++; done.add(nx.i);
      }
      await page.waitForFunction(() => !OC.Mini.active, null, { timeout: 30000 }).catch(() => {});
      const con = await page.evaluate((c0) => ({ coins: OC.Store.s.coins - c0, n: OC.Progress.count('concert'), again: (() => { const k = Object.keys(OC.Store.s.ledger.keys).find((x) => x.startsWith('concert:')); return k; })() }), coins0);
      check('6b 點舞台只出現動作卡（「上台表演」）；演唱會用真的觸控按三條線，結束有星等、演出費（每位角色每天一次，key concert:<角色>:<日>）並送出進度事件', card.title === '星光舞台' && card.verb === '上台表演' && !card.mini && taps >= 20 && con.coins > 0 && con.n === 1 && !!con.again, { card, taps, con });
      /* a second show the same day: still playable, no second fee */
      const sec = await page.evaluate(async () => { const c0 = OC.Store.s.coins; const key = Object.keys(OC.Store.s.ledger.keys).find((x) => x.startsWith('concert:')); const r = OC.Tx.run(key, { get: { coins: 60 } }, 'x'); return { dup: r.dup, diff: OC.Store.s.coins - c0 }; });
      check('6c 同一天第二次演出不會再付錢（交易 key 擋下重複）', sec.dup && sec.diff === 0, sec);
      /* ring toss: pays 20 first; the prize matches the hits */
      const t0 = await page.evaluate(() => ({ coins: OC.Store.s.coins, inv: ['prize_star', 'prize_bear', 'popcorn'].map((k) => OC.Store.count(k)) }));
      await page.evaluate(() => OC.Mini.toss(OC.World.interacts.find((i) => i.type === 'toss'))); await wait(page, 300);
      const r2 = await page.evaluate(() => OC.Mini.state.rect);
      for (let k = 0; k < 3; k++) {
        await page.waitForFunction(() => { const s = OC.Mini.state; return !s || (!s.flying && s.left > 0); }, null, { timeout: 30000 }).catch(() => {});
        await page.touchscreen.tap(r2.x + 30, r2.y + 30); await page.waitForFunction(() => !OC.Mini.state || !OC.Mini.state.flying, null, { timeout: 30000 }).catch(() => {});
      }
      const hits = await page.evaluate(() => OC.Mini.state ? OC.Mini.state.hits : null);
      await page.waitForFunction(() => !OC.Mini.active, null, { timeout: 20000 }).catch(() => {});
      const t1 = await page.evaluate(() => ({ coins: OC.Store.s.coins, inv: ['prize_star', 'prize_bear', 'popcorn'].map((k) => OC.Store.count(k)), n: OC.Progress.log.find ? null : null }));
      const got = t1.inv.map((v, i) => v - t0.inv[i]), expect = hits >= 3 ? [1, 0, 0] : hits === 2 ? [0, 1, 0] : hits === 1 ? [0, 0, 1] : [0, 0, 0];
      check('6d 套圈圈：先付 20 星幣、真的觸控丟 3 個圈，獎品和套中數一致（3＝星星徽章、2＝熊熊、1＝爆米花、0＝沒有）', t0.coins - t1.coins === 20 && hits != null && JSON.stringify(got) === JSON.stringify(expect), { hits, got, paid: t0.coins - t1.coins });
      /* Ferris wheel: the played OC goes up (hidden, one cabin lit) and comes back; travel is refused during the ride */
      const w = await page.evaluate(async () => { const it = OC.World.interacts.find((i) => i.type === 'wheel'); OC.Mini.wheel(it); const up = { hidden: OC.App.player.hidden, lit: OC.World.area.wheel.cabins.filter((c) => c.userData.flag.visible).length }; OC.WorldUI.travel('isle'); await new Promise((r) => setTimeout(r, 1500)); up.stayed = OC.World.area.id === 'fair' && !OC.WorldUI.busy; return up; });
      await page.waitForFunction(() => !OC.Mini.wheelRiding(), null, { timeout: 40000 }).catch(() => {});
      const w2 = await page.evaluate(() => ({ hidden: OC.App.player.hidden, lit: OC.World.area.wheel.cabins.filter((c) => c.userData.flag.visible).length, holds: Object.keys((OC.Brain.get(OC.Store.s.activeId) || {}).holds || {}), walk: OC.World.walkable(OC.App.player.x, OC.App.player.y) }));
      check('6e 摩天輪：角色坐進一節車廂（地上看不到、那一節亮燈），轉一圈回來，保留全部放開；搭乘中不能離開', w.hidden && w.lit === 1 && w.stayed && !w2.hidden && w2.lit === 0 && !w2.holds.length && w2.walk, { w, w2 });
      /* carousel through the action list: the OC sits in a carriage */
      let qr = null, rode = false;
      for (let k = 0; k < 2 && !rode; k++) {
      qr = await page.evaluate(() => OC.Queue.add(OC.Store.s.activeId, 'ride'));
      rode = await page.waitForFunction(() => { const b = OC.Brain.get(OC.Store.s.activeId); if (!(b && b.act === 'ride' && b.st === 'do')) return false; const p = OC.App.player, it = OC.World.interacts.find((i) => i.type === 'ride'), d = Math.min(...it.seats.map(([x, y]) => Math.hypot(p.x - x, p.y - y))); window.__seat = { d, mode: p.mode }; return d < 12; }, null, { timeout: 60000, polling: 'raf' }).then(() => true).catch(() => false);
      }   /* a walk can be abandoned when a friend blocks the way; the player then asks again */
      await shot(page, '6-carousel');
      const seat = await page.evaluate(() => window.__seat || null);
      check('6f 旋轉木馬：排進動作清單後，角色走到馬車座位坐下（活動「坐旋轉木馬」）', rode && seat && seat.d < 12, { qr, seat, log: await page.evaluate(() => OC.Brain.log.filter((l) => l.who === OC.Store.s.activeId).slice(0, 4).map((l) => l.text)) });
      await page.evaluate(() => { const id = OC.Store.s.activeId; OC.Brain.command && OC.Queue.clear && OC.Queue.clear(id); });
      /* a part-time shift at the snack stand: the card offers it, the character works ~30 game minutes, pay arrives once that day */
      /* the scenario runs on a fixed clock hour (game time = real time); a shift needs the day cycle running fast */
      await page.evaluate(() => { const id = OC.Store.s.activeId, st = OC.Store.s.settings; window.__time = [st.time, st.timeSpeed]; st.time = 'cycle'; st.timeSpeed = 10; OC.Queue.clear && OC.Queue.clear(id); OC.Brain.playerAct(id); }); await wait(page, 500);
      const jc = await page.evaluate(() => { const it = OC.World.interacts.find((i) => i.type === 'shop' && i.shop === 'fair'); OC.App.onTapForTest ? null : null; return null; });
      const coinsJ = await page.evaluate(() => OC.Store.s.coins);
      const jq = await page.evaluate(() => OC.Queue.add(OC.Store.s.activeId, 'work'));
      const worked = await page.waitForFunction(() => { const b = OC.Brain.get(OC.Store.s.activeId); return b.act === 'work' && b.st === 'do'; }, null, { timeout: 120000 }).then(() => true).catch(() => false);
      await page.waitForFunction(() => OC.Brain.get(OC.Store.s.activeId).act !== 'work', null, { timeout: 300000 }).catch(() => {}); await wait(page, 600);
      const job = await page.evaluate((c0) => ({ gain: OC.Store.s.coins - c0, keys: Object.keys(OC.Store.s.ledger.keys).filter((k) => k.startsWith('job:')), mem: OC.Chars.active().life.mem.recent.some((m) => /打工|當了一班/.test(m.text)), auto: OC.Chars.all().filter((c) => c.id !== OC.Store.s.activeId).some((c) => OC.Brain.get(c.id) && OC.Brain.get(c.id).act === 'work'), log: OC.Brain.log.filter((l) => l.who === OC.Store.s.activeId).slice(0, 3).map((l) => l.text) }), coinsJ);
      check('6h 打工：玩家安排後角色走到點心攤後面工作一班，結束時入帳一次（key job:<角色>:<地點>:<日>）並留下回憶；其他角色不會自己去打工', jq && worked && job.gain > 0 && job.keys.length === 1 && job.mem && !job.auto, Object.assign({ jq, worked }, job));
      void jc; await page.evaluate(() => { const st = OC.Store.s.settings; [st.time, st.timeSpeed] = window.__time; });
      /* the mill on the hill sells its own things; the map shows no locked pins */
      await go('hill');
      const mill = await page.evaluate(() => ({ stock: OC.Shops.stock('mill'), buy: OC.Shops.buy('mill', 'pinwheel', 1), fair: OC.Shops.stock('fair') }));
      await page.evaluate(() => OC.App.tab('explore')); await wait(page, 900);
      const map = await page.evaluate(() => ({ locked: document.querySelectorAll('.map-pin.locked').length, pins: [...document.querySelectorAll('.map-pin')].map((b) => b.getAttribute('aria-label')) }));
      await shot(page, '6-map'); await page.evaluate(() => OC.App.tab('island')); await wait(page, 500);
      check('6g 風車磨坊賣麵粉、麵包、小風車…（買得到）；點心攤有棉花糖、爆米花；地圖上沒有鎖住的島、兩個新地點都在', mill.buy.ok && mill.stock.includes('pinwheel') && mill.fair.includes('cotton_candy') && map.locked === 0 && map.pins.includes('風車丘') && map.pins.includes('彩虹遊樂園'), { mill, map });
    }

    // ================= 7. 15.2: the island paper, room score, island rating, birthdays =================
    if (want(7)) {
      await closeAll();
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
        const C = OC.Chars.all(), d = new Date(), out = {};
        /* a real memory from yesterday (the paper only prints what happened) */
        const yd = OC.Sim.day() - 1; C[0].life.mem.recent.push({ id: 'mt1', gm: (yd) * 1440 + 600, t: Date.now() - 864e5, day: yd, place: '', type: 'activity', who: [], emo: 'happy', imp: 0.9, text: '在苔光森林釣到了雲紋錦鯉', data: null });
        C[1].profile.birthday = `${d.getMonth() + 1}/${d.getDate()}`;
        const cake0 = OC.Store.count('cake'); OC.Island.checkBirthdays(true); OC.Island.checkBirthdays(true); out.cake = OC.Store.count('cake') - cake0;
        out.bdayMem = C[1].life.mem.recent.concat(C[1].life.mem.long).some((m) => /生日/.test(m.text));
        /* room score: starter room is below tier 1; adding furniture raises it; a tier is claimed once */
        const before = OC.Island.roomScore('home'); out.before = before.score; out.cl0 = OC.Island.roomClaimable('home').length;
        const R = OC.Places.room('home'); ['table', 'sofa', 'clock', 'painting', 'wardrobe', 'toybox'].forEach((id, i) => R.push({ uid: 't15_' + i, id, x: 120 + i * 20, y: 380, rot: 0, sc: 1 }));
        const after = OC.Island.roomScore('home'); out.after = after.score; out.tier = after.tier; out.cl = OC.Island.roomClaimable('home');
        OC.Pages.open('news'); await sleep(1200);
        out.paper = document.querySelector('.news') ? document.querySelector('.news').textContent : '';
        const c0 = OC.Store.s.coins; const b = document.querySelector('.news-room .btn.primary'); if (b) b.click(); await sleep(400); out.gain = OC.Store.s.coins - c0;
        out.again = OC.Island.claimRoom('home', 1); out.cl2 = OC.Island.roomClaimable('home');
        out.rating = OC.Island.rating(); out.parse = ['3/14', '3月14日', '03-14', 'abc'].map((x) => JSON.stringify(OC.Island.parseBday(x)));
        return out;
      });
      await shot(page, '7-news');
      check('7a 島報只寫真的發生的事：昨天的回憶、帳本、天氣、今日特價、生日、小島評價、房間評分', /釣到了雲紋錦鯉/.test(r.paper) && /今天是/.test(r.paper) && /小島評價/.test(r.paper) && /房間評分/.test(r.paper) && /今日特價/.test(r.paper), r.paper.slice(0, 300));
      check('7b 生日：資料裡的生日（例如 3/14、3月14日）當天收到一個蛋糕（一年一次，重複檢查不會再給）並留下回憶', r.cake === 1 && r.bdayMem && r.parse[0] === r.parse[1] && r.parse[1] === r.parse[2] && r.parse[3] === 'null', { cake: r.cake, mem: r.bdayMem, parse: r.parse });
      check('7c 房間評分：新家低於第一級、多擺家具會提高；達到的等級由玩家在島報領取，只能領一次', r.cl0 === 0 && r.after > r.before && r.tier >= 1 && r.cl.length >= 1 && r.gain === 80 && r.again.dup && !r.cl2.includes(1), { before: r.before, after: r.after, tier: r.tier, gain: r.gain });
      check('7d 小島評價 1–5 星，來自六項真實數值（家、探索、收藏、感情、菜園、回憶）並給出最弱一項的建議', r.rating.stars >= 1 && r.rating.stars <= 5 && r.rating.parts.length === 6 && r.rating.parts.every((x) => x.v >= 0 && x.v <= 1) && !!r.rating.tip, r.rating);
      await closeAll();
    }

    // ================= 8. 15.3: seasons, drift, glints, cloud travel, night glow =================
    if (want(8)) {
      await closeAll();
      const go = async (id) => { await page.evaluate((id) => OC.WorldUI.travel(id), id); await page.waitForFunction((id) => OC.World.area.id === id && !OC.WorldUI.busy, id, { timeout: 90000 }); await wait(page, 800); };
      const se = await page.evaluate(() => {
        const S = OC.Store.s.settings, before = S.season; const out = { world: OC.World.season, clock: OC.Clock.season(), chunk: /OC_CHAR/.test(THREE.ShaderChunk.tonemapping_fragment) };
        const a = OC.World.actors.find((x) => x.m && x.m.material); out.charDef = !!(a && a.m.material.defines && 'OC_CHAR' in a.m.material.defines);
        S.season = 'winter'; out.pick = OC.Clock.season(); S.season = 'spring'; out.pick2 = OC.Clock.season(); S.season = before;
        const m = (d) => OC.Clock.season(new Date(2026, d, 15)); out.cal = [m(3), m(6), m(9), m(0)];
        return out; });
      check('8a 季節：依日期（春夏秋冬）或玩家選的季節；世界在開始時套用季節色調，角色的材質不套（OC_CHAR）', se.world === se.clock && se.chunk && se.charDef && se.pick === 'winter' && se.pick2 === 'spring' && JSON.stringify(se.cal) === JSON.stringify(['spring', 'summer', 'autumn', 'winter']), se);
      /* effects on (high), outdoors at the beach: drifting leaves / petals / snow (none in summer) and glints on the sea; none indoors */
      await page.evaluate(() => { const S = OC.Store.s.settings; window.__perf = S.perf; S.perf = 'high'; OC.App.applyPerf(); S.weather = 'clear'; S.fixedHour = 11; });
      await go('beach'); await wait(page, 1500);
      const fx = await page.evaluate(() => ({ drift: OC.Ambient.drift, glints: OC.Ambient.glints, season: OC.World.season }));
      await go('home'); await wait(page, 1200);
      const fxIn = await page.evaluate(() => ({ drift: OC.Ambient.drift, glints: OC.Ambient.glints }));
      check('8b 戶外有飄落的花瓣／落葉／雪（夏天沒有）與海面的閃光；室內沒有', (fx.season === 'summer' ? !fx.drift : fx.drift && fx.drift.count > 0) && fx.glints > 0 && (!fxIn.drift || fxIn.drift.count === 0) && !fxIn.glints, { fx, fxIn });
      /* the cloud transition: nine clouds and the place name while moving; gone afterwards */
      const tr = await page.evaluate(() => { OC.WorldUI.travel('fair'); const f = document.getElementById('fade'); return { clouds: f.querySelectorAll('.travel-clouds i').length, cls: f.className, label: (f.querySelector('.travel-label b') || {}).textContent, stk: !!f.querySelector('.travel-stk') }; });
      await page.waitForFunction(() => OC.World.area.id === 'fair' && !OC.WorldUI.busy, null, { timeout: 90000 });
      /* the clouds go 0.4 s after the move ends (a follow-up move — a character leading you on — starts its own) */
      await page.waitForFunction(() => !OC.WorldUI.busy && !document.getElementById('fade').children.length, null, { timeout: 20000 }).catch(() => {}); await wait(page, 300);
      const tr2 = await page.evaluate(() => { const f = document.getElementById('fade'); return { left: f.children.length, cls: f.className, op: getComputedStyle(f).opacity }; });
      check('8c 換地點時是雲朵轉場（九朵雲＋地點名稱與貼紙），結束後清乾淨', tr.clouds === 9 && /clouds/.test(tr.cls) && tr.label === '彩虹遊樂園' && tr.stk && tr2.left === 0 && !/clouds/.test(tr2.cls), { tr, tr2 });
      /* the fair at night: its bulbs are on the night light rig and glow */
      await page.evaluate(() => { OC.Store.s.settings.fixedHour = 21; }); await page.waitForFunction(() => (OC.World.env || {}).night > 0.8, null, { timeout: 60000 }).catch(() => {}); await wait(page, 600);
      const nightGlow = await page.evaluate(() => { const w = OC.Models.night.windows; const cols = w.map((m) => '#' + m.color.getHexString().toUpperCase()); return { n: w.length, has: ['#FFE08A', '#FFF1B0'].every((c) => cols.includes(c)), lit: w.filter((m) => m.emissiveIntensity > 0.5).length, night: OC.World.env.night }; });
      await shot(page, '8-fair-night');
      await page.evaluate(() => { const S = OC.Store.s.settings; S.fixedHour = 10; S.perf = window.__perf; OC.App.applyPerf(); });
      check('8d 遊樂園的燈泡接在夜晚的燈光上，晚上會亮', nightGlow.has && nightGlow.lit > 0, nightGlow);
      /* the settings have the season row; picking one is stored */
      const st = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); OC.Pages.open('settings'); await sleep(900); const segs = [...document.querySelectorAll('.page .seg button, .seg button')].map((b) => b.textContent); const btn = [...document.querySelectorAll('.seg button')].find((b) => b.textContent === '冬'); if (btn) btn.click(); await sleep(300); const v = OC.Store.s.settings.season; OC.Store.s.settings.season = 'auto'; return { has: ['依日期', '春', '夏', '秋', '冬'].every((t) => segs.includes(t)), v }; });
      await closeAll();
      check('8e 設定的「世界」區有季節選擇（依日期／春夏秋冬），選了會記住', st.has && st.v === 'winter', st);
      await go('isle');
    }

    // ================= 9. 15.4: creator big stage, design kiosk, map route, pet centre tabs =================
    if (want(9)) {
      await closeAll();
      /* creator: the look step is a big stage with a rail of categories, one at a time; tapping a body zone switches the category */
      await page.evaluate(() => { OC.Creator.start(); }); await wait(page, 900);
      await page.evaluate(() => [...document.querySelectorAll('.cr-choice')][1].click()); await wait(page, 500);
      await page.evaluate(() => document.querySelector('.creator > .btn.primary').click()); await wait(page, 1000);
      const cr = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { big: document.querySelector('.creator').classList.contains('cr-big'), cats: [...document.querySelectorAll('.cr-cat')].map((b) => b.dataset.cat), panels: document.querySelectorAll('.cr-panel').length, first: document.querySelector('.cr-panel').dataset.cat };
        document.querySelector('.cr-cat[data-cat="face"]').click(); await sleep(400); out.face = document.querySelector('.cr-panel').dataset.cat; out.on = document.querySelector('.cr-cat.on').dataset.cat;
        const st = document.querySelector('.creator .cr-stage'); out.stageH = st ? Math.round(st.getBoundingClientRect().height) : 0; return out; });
      await shot(page, '9-creator-stage');
      await page.evaluate(() => { const x = document.querySelector('.creator'); if (x) x.remove(); OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); }); await wait(page, 400);
      check('9a 創角的外觀是大舞台＋分類列（範本、耳朵尾巴、顏色、臉、服裝…），一次只顯示一類，點分類就換', cr.big && ['template', 'earsTail', 'colors', 'face', 'outfit', 'expressions'].every((k) => cr.cats.includes(k)) && cr.panels === 1 && cr.first === 'template' && cr.face === 'face' && cr.on === 'face' && cr.stageH > 250, cr);
      /* the design kiosk: draw with a real finger (a stroke across cells), fill, undo / redo, save, wear */
      await page.evaluate(() => { delete OC.Store.s.designDraft; OC.Design.open(); }); await wait(page, 900);
      const g = await page.evaluate(() => { const a = document.querySelectorAll('.dz-cell'); const r0 = a[0].getBoundingClientRect(), r1 = a[143].getBoundingClientRect(); return { x: r0.left, y: r0.top, cw: (r1.right - r0.left) / 12 }; });
      const c2 = (i, j) => [g.x + g.cw * (i + 0.5), g.y + g.cw * (j + 0.5)];
      await page.evaluate(() => [...document.querySelectorAll('.dz-sw')][2].click());
      await page.touchscreen.tap(...c2(0, 0)); await wait(page, 300);
      await page.mouse.move(...c2(1, 5)); await page.mouse.down(); await page.mouse.move(...c2(10, 5), { steps: 3 }); await page.mouse.up(); await wait(page, 400);
      const dz1 = await page.evaluate(() => OC.Design.open_.state);
      await page.evaluate(() => [...document.querySelectorAll('.dz-tools .icon-btn')][0].click()); await wait(page, 200);
      const dzUndo = await page.evaluate(() => OC.Design.open_.state.px);
      await page.evaluate(() => [...document.querySelectorAll('.dz-tools .icon-btn')][1].click()); await wait(page, 200);
      const dzRedo = await page.evaluate(() => OC.Design.open_.state.px);
      await shot(page, '9-design');
      await page.evaluate(() => [...document.querySelectorAll('.onb.design .btn.primary')].pop().click()); await wait(page, 800);
      const dz2 = await page.evaluate(() => ({ pat: OC.Chars.active().look.pattern, designs: Object.keys(OC.Store.s.designs).filter((k) => k !== '__draft'), draft: !!OC.Store.s.designDraft }));
      const row5 = dz1.px.slice(60, 72);
      check('9b 設計亭：手指畫一筆連續的線（快速移動也不會斷）、單點一格；可以復原／重做；儲存後角色穿上（look.pattern＝design:…），草稿清掉', dz1.px[0] === '2' && /^2{10}/.test(row5.slice(1)) && dzUndo.slice(61, 71) === '0000000000' && dzRedo === dz1.px && dz2.designs.length === 1 && dz2.pat === 'design:' + dz2.designs[0] && !dz2.draft, { row5, px0: dz1.px[0], undoRow: dzUndo.slice(60, 72), dz2 });
      /* leaving with unsaved strokes asks; the draft comes back next time */
      await page.touchscreen.tap(...c2(5, 9)); await wait(page, 300);
      const ask = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); document.querySelector('.onb.design .icon-btn').click(); await sleep(500); const d = [...document.querySelectorAll('.sheet')].find((x) => x.textContent.includes('離開設計亭')); return { asked: !!d, text: d ? d.textContent.slice(0, 40) : '' }; });
      await page.evaluate(() => { const b = [...document.querySelectorAll('.sheet .btn')].find((x) => x.textContent === '離開'); if (b) b.click(); }); await wait(page, 500);
      const back = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const gone = !document.querySelector('.onb.design'); OC.Design.open(); await sleep(700); const st = OC.Design.open_.state; return { gone, px: st.px[9 * 12 + 5], draft: !!OC.Store.s.designDraft }; });
      await closeAll(); await page.evaluate(() => { const x = document.querySelector('.onb.design'); if (x) x.remove(); });
      check('9c 沒儲存就離開會先問；草稿自動保存，下次打開還在', ask.asked && back.gone && back.px === '2' && back.draft, { ask, back });
      /* the world shows the design on the shirt */
      const worn = await page.evaluate(() => { const c = OC.Chars.active(), cv = OC.Design.canvasOf(c.look.pattern.slice(7)); return !!cv && cv.width === 12; });
      check('9d 穿上的圖樣由角色繪製使用（12×12，畫在衣服上）', worn, worn);
      /* map: picking a place shows the route from where you are and the travel time on the button */
      await page.evaluate(() => OC.App.tab('explore')); await wait(page, 800);
      await page.tap('.map-pin[aria-label="苔光森林"]'); await wait(page, 600);
      const mp = await page.evaluate(() => ({ on: document.querySelector('.map-route').classList.contains('on'), eta: document.querySelector('.map-eta').textContent, btn: (document.querySelector('[data-page="explore"] .card .btn.primary') || {}).textContent, min: OC.Places.travelMin(OC.World.area.id, 'forest') }));
      await shot(page, '9-map-route'); await page.evaluate(() => OC.App.tab('island'));
      check('9e 地圖：選一個地點會畫出從你所在地出發的路線，並標出路程（和真的移動時間一致）', mp.on && mp.eta === `約 ${mp.min} 分鐘` && mp.btn.includes(`約 ${mp.min} 分鐘`), mp);
      /* closing the kiosk from outside (changing tab) with unsaved strokes: no question, no hang, the draft is kept */
      const ext = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); OC.Design.open(); await sleep(600); const cell = document.querySelectorAll('.dz-cell')[30], r = cell.getBoundingClientRect(); const ev = (t) => cell.parentNode.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 7, clientX: r.x + 3, clientY: r.y + 3 }));
        ev('pointerdown'); ev('pointerup'); await sleep(300); const t0 = performance.now(); for (let k = 0; k < 8 && OC.UI.stack.length; k++) OC.UI.back(); OC.App.tab('char'); await sleep(600); OC.App.tab('island');
        return { ms: Math.round(performance.now() - t0), open: !!document.querySelector('.onb.design') && document.querySelector('.onb.design').style.opacity !== '0', sheets: [...document.querySelectorAll('.sheet')].filter((x) => x.textContent.includes('離開設計亭')).length, draft: !!OC.Store.s.designDraft, stack: OC.UI.stack.length }; });
      check('9g 從外面關掉設計亭（返回鍵、換分頁）時不會反覆詢問、不會卡住，草稿還在', !ext.open && ext.sheets === 0 && ext.draft && ext.ms < 5000, ext);
      /* the pet centre's tabs are checked by the pet suite (it runs with the mock Android app): tests/pet scenario 18 */
    }

    // ================= 10. 15.5: dreams, declarations, fears, life stages, a serial story, festivals =================
    if (want(10)) {
      await closeAll();
      /* a fresh game on a festival day in summer (?fest=1&season=summer previews them) */
      await H.boot(page, { chars: 3, seed: 21, quickTap: false, query: '?fest=1&season=summer' });
      await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 11; S.settings.weather = 'clear'; if (OC.Events.current) OC.Events.end('t'); S.life.ev.lastAny = Date.now() + 3.6e6; S.play.req.nextAt = 1e12; });
      await page.waitForFunction(() => OC.Store.count('fest_sparkler') > 0, null, { timeout: 20000 }).catch(() => {});
      const fe = await page.evaluate(() => { const L = OC.Life15, n0 = OC.Store.count('fest_sparkler'); L.festGift(); L.festGift(); const days = [new Date(2026, 3, 18), new Date(2026, 6, 18), new Date(2026, 9, 17), new Date(2027, 0, 16), new Date(2026, 3, 15)];
        return { today: L.festival() && L.festival().id, gift: OC.Store.count('fest_sparkler'), again: OC.Store.count('fest_sparkler') === n0, ids: days.map((d) => { const f = L.festival(d); return f ? f.id : null; }), harvest: L.harvestBonus() }; });
      check('10a 季節活動：週末是節日（春花之祭、夏夜煙火、秋豐收祭、冬燈之祭；平日不是）；節日當天送一份禮物，只送一次；豐收祭才有收成加成', fe.today === 'fireworks' && fe.gift === 1 && fe.again && JSON.stringify(fe.ids) === JSON.stringify(['flowers', 'fireworks', 'harvest', 'lights', null]) && fe.harvest === 0, fe);
      /* fireworks at night outdoors (effects on) */
      await page.evaluate(() => { const S = OC.Store.s.settings; window.__perf = S.perf; S.perf = 'high'; OC.App.applyPerf(); S.fixedHour = 21; });
      const fw = await page.waitForFunction(() => OC.Ambient.fireworks > 0, null, { timeout: 60000 }).then(() => true).catch(() => false);
      await shot(page, '10-fireworks');
      await page.evaluate(() => { const S = OC.Store.s.settings; S.fixedHour = 11; S.perf = window.__perf; OC.App.applyPerf(); });
      check('10b 夏夜煙火：節日晚上在戶外看得到煙火（特效開著時）', fw, fw);
      /* dreams: a night's sleep → a dream from its own life, remembered, told once when it is near */
      const dr = await page.evaluate(() => { const L = OC.Life15, c = OC.Chars.active(); OC.Mind.remember(c, { type: 'activity', imp: 0.7, text: '在星砂海灘看了一整個下午的海', key: 't15dream' });
        OC.Progress.emit('act', { oc: c.id, act: 'sleep', min: 480 }); let d = L.st(c).dreams[0]; if (!d) d = L.makeDream(c, 0.3); const mem = c.life.mem.recent.some((m) => /做了一個夢/.test(m.text));
        L.tickNow(); return { text: d.text, kind: d.kind, mem, told: L.st(c).dreams[0].told }; });
      check('10c 夢：睡一晚可能做夢，內容來自角色自己的回憶／朋友／地點／願望／怕的東西；記在回憶裡，靠近時會告訴你一次', dr.text && dr.text.length > 4 && dr.mem && dr.told, dr);
      /* declarations: a small goal of its own, tracked on the progress stream, paid once */
      const dc = await page.evaluate(() => { const L = OC.Life15, c = OC.Chars.active(); L.st(c).decl = null; const q = L.declare(c); const ev = { fish: 'fish', cook: 'cook', forage: 'forage', chat: 'chat', stage: 'concert', job: 'job', garden: 'plant' }[q.id];
        const c0 = OC.Store.s.coins; for (let i = 0; i < q.n; i++) OC.Progress.emit(ev, { oc: c.id, item: 'f_sardine', place: 'isle', count: 1 }); const gain = OC.Store.s.coins - c0; OC.Progress.emit(ev, { oc: c.id, count: 1 });
        return { zh: q.zh, done: L.st(c).decl.done, gain, after: OC.Store.s.coins - c0, mem: c.life.mem.recent.concat(c.life.mem.long).some((m) => /說到做到/.test(m.text)) }; });
      check('10d 宣言：角色自己宣布三天內的小目標，做到時入帳一次（key decl:<角色>:<時間>）並留下回憶', dc.done && dc.gain > 0 && dc.after === dc.gain && dc.mem, dc);
      /* fears: brave characters fear nothing; a fear around makes it nervous; petting it there three times and the fear is gone */
      const fr = await page.evaluate(async () => { const L = OC.Life15, all = OC.Chars.all(), c = OC.Chars.active(), S = OC.Store.s; const counts = all.map((x) => L.fears(x).length);
        const br = Object.assign({}, all[1], { id: 'brave_test', personality: Object.assign({}, all[1].personality, { traits: ['brave'] }), life: Object.assign({}, all[1].life, { l15: null }) });
        L.st(c).fears = [{ id: 'thunder', lv: 3 }]; S.settings.weather = 'rain'; await new Promise((r) => setTimeout(r, 2500)); L.tickNow(); const nowFear = L.st(c).fearNow;
        const t0 = OC.Sim.now(); for (let k = 0; k < 3; k++) { L.st(c).calmAt = -1e9; OC.Progress.emit('pet', { oc: c.id }); } S.settings.weather = 'clear';
        return { counts, brave: L.fears(br).length, nowFear, lv: L.st(c).fears[0].lv, mem: c.life.mem.recent.concat(c.life.mem.long).some((m) => /不再怕/.test(m.text)), t0 }; });
      check('10e 怕的東西：每個角色 0–2 個（勇敢的沒有）；在怕的情況會緊張；在那時候摸摸牠三次就不怕了（留下回憶）', fr.counts.every((n) => n >= 0 && n <= 2) && fr.brave === 0 && fr.nowFear === 'thunder' && fr.lv === 0 && fr.mem, fr);
      /* life stages: from the age the player wrote; one year older only by the player's choice, once a year */
      const ls = await page.evaluate(() => { const L = OC.Life15, c = OC.Chars.active(); c.profile.age = '12'; const s0 = L.stage(c); const r1 = L.growUp(c); const r2 = L.growUp(c); c.profile.age = ''; return { s0: s0 && s0.zh, r1: r1.ok && r1.to.zh + r1.to.age, r2: r2.ok, none: L.stage(c) }; });
      check('10f 人生階段：依你寫的年齡（童年→少年→青年→成年→長者）；只有你按下才會長大一歲，一年一次；沒寫年齡就沒有階段', ls.s0 === '童年' && ls.r1 === '少年13' && ls.r2 === false && ls.none === null, ls);
      /* the serial story: three parts carried by flags; part two asks you, and your answer picks the ending */
      const sr = await page.evaluate(() => { const ids = OC.Events.defs().map((e) => e.id); const t2 = OC.Events.defs().find((e) => e.id === 'thank2'); const ch = t2.steps.find((s) => s[0] === 'choice'); const lines = ['ev_thank1', 'ev_thank2', 'ev_thank3', 'ev_thank3_r', 'ev_thank3w'].every((k) => OC.LifeData.LINES.some((l) => l.cat === k));
        return { has: ['thank1', 'thank2', 'thank3', 'thank3w'].every((k) => ids.includes(k)), opts: ch[2].map((o) => o.fx.flag), lines }; });
      check('10g 連續劇「說不出口的話」：三段（一定順序、跨天，用旗標串起來），第二段問你，你的回答決定第三段怎麼收尾', sr.has && JSON.stringify(sr.opts) === JSON.stringify(['thankGo', 'thankLetter', 'thankWait']) && sr.lines, sr);
      /* the profile shows the inner life; the paper shows the festival, dreams and declarations */
      const ui = await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); OC.Pages.open('profile', { id: OC.Store.s.activeId, tab: 'life' }); await sleep(1200); const t = (document.querySelector('[data-page="profile"]') || {}).textContent || '';
        OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); await sleep(300); OC.Pages.open('news'); await sleep(1000); const n = (document.querySelector('.news') || {}).textContent || ''; return { prof: ['心裡的事', '最近的夢', '宣言', '怕的東西'].every((k) => t.includes(k)), news: n.includes('今天是節日') && n.includes('夏夜煙火') && n.includes('昨晚的夢') }; });
      await shot(page, '10-news'); await closeAll();
      check('10h 角色檔案有「心裡的事」（夢、宣言、怕的東西、人生階段）；島報寫出今天的節日與昨晚的夢', ui.prof && ui.news, ui);
    }

    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.stack || e)); }
  await browser.close();
  const bad = H.results.filter((r) => !r.ok); console.log(`\n${H.results.length - bad.length}/${H.results.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
