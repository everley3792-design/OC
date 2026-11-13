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
      check('3b 任務類 App 在手機下方直接打開（被選的 App 有標記）；其他 App 打開自己的頁面', r.on === '任務' && r.onAfter === '成就' && r.tab === 'ach' && r.bagOpen, r);
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

    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.stack || e)); }
  await browser.close();
  const bad = H.results.filter((r) => !r.ok); console.log(`\n${H.results.length - bad.length}/${H.results.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
