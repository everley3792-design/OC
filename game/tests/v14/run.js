/* OC Shimeji 14.0 — acceptance: one style, the reworked pages, the pet centre desk, cropping a picture with your fingers,
 * the remodelled / baked world, and the small fixes found while looking at every screen.
 * Usage: node game/tests/v14/run.js [1 2 …]   (http.server on :8765 first, or OC_URL)
 * The visual side is checked by eye with the gallery (node game/tests/v14/shots.js); this file checks what can be measured. */
const path = require('path'), fs = require('fs');
const H = require('../life/harness.js');
const want = (n) => process.argv.length <= 2 || process.argv.slice(2).includes(String(n));
const { check, wait } = H;
const SHOTS = process.env.OC_SHOTS || path.join(__dirname, '..', '..', '..', 'deliverables', 'v14');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
(async () => {
  const { browser, page, errors } = await H.launch();
  try {
    await H.boot(page, { chars: 3, seed: 14 });
    await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 10; S.settings.weather = 'clear'; if (OC.Events.current) OC.Events.end('t'); S.life.ev.lastAny = Date.now() + 3.6e6; S.play.req.nextAt = 1e12; });
    await wait(page, 800);
    const closeAll = () => page.evaluate(() => { for (let k = 0; k < 6 && OC.UI.stack.length; k++) { const l = OC.UI.stack[OC.UI.stack.length - 1]; l.close && l.close(); if (OC.UI.stack[OC.UI.stack.length - 1] === l) OC.UI.stack.pop(); } OC.App.tab('island'); });

    // ================= 1. one style =================
    if (want(1)) {
      const r = await page.evaluate(async () => {
        const root = document.documentElement, cs = (sel, k) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[k] : null; }, v = (k) => getComputedStyle(root).getPropertyValue(k).trim();
        document.getElementById('hud').classList.remove('idle');
        const pal = (t) => { OC.App.setTheme(t); return { bg: v('--bg'), ink: v('--ink'), accent: v('--accent'), rm: v('--r-m'), rl: v('--r-l'), balloon: v('--balloon') }; };
        const out = { attr: root.dataset.style || null, setStyle: typeof OC.App.setStyle, saved: 'style' in OC.Store.s.settings, light: pal('light'), dark: pal('dark') };
        OC.App.setTheme('light'); await new Promise((r2) => setTimeout(r2, 400));
        const blur = (sel) => { const b = cs(sel, 'backdropFilter') || cs(sel, 'webkitBackdropFilter') || 'none'; return b; };
        out.hud = { plate: cs('.hud-plate', 'backgroundColor'), time: cs('.hud-time', 'backgroundColor'), ink: cs('.hud-name', 'color'), blur: ['.hud-plate', '.hud-time', '.tabbar', '.rail-btn'].map(blur) };
        out.tabs = [...document.querySelectorAll('.tab')].map((t) => ({ label: t.querySelector('span:not(.stk)').getBoundingClientRect().height, filter: getComputedStyle(t.querySelector('.stk')).filter, h: t.getBoundingClientRect().height }));
        OC.Pages.open('settings'); await new Promise((r2) => setTimeout(r2, 500));
        out.settingsHasStyle = /介面風格/.test(OC.Pages.pages.settings.el.textContent);
        return out;
      });
      await shot(page, '1-settings'); await closeAll();
      check('1a 只有一種介面風格：沒有 data-style、沒有切換的 API 與設定、設定頁不再有「介面風格」', r.attr === null && r.setStyle === 'undefined' && !r.saved && !r.settingsHasStyle, { attr: r.attr, api: r.setStyle, saved: r.saved, inSettings: r.settingsHasStyle });
      check('1b 白天與夜晚是同一套設計的兩個調色盤：圓角完全相同、字都不是純黑或純白、對話框都是奶油色', r.light.rm === r.dark.rm && r.light.rl === r.dark.rl && r.light.bg !== r.dark.bg && !/^#(000000|ffffff)$/i.test(r.light.ink) && !/^#(000000|ffffff)$/i.test(r.dark.ink) && r.light.balloon === r.dark.balloon, { light: r.light, dark: r.dark });
      check('1c HUD 是有底的小膠囊（看得清楚），而且常駐元件沒有背景模糊', r.hud.plate !== 'rgba(0, 0, 0, 0)' && r.hud.time !== 'rgba(0, 0, 0, 0)' && r.hud.ink !== 'rgb(255, 255, 255)' && r.hud.blur.every((b) => b === 'none'), r.hud);
      check('1d 導覽列：五個分頁都有看得到的文字、貼紙是彩色的（沒有被轉成灰階）、觸控高度 ≥ 48', r.tabs.length === 5 && r.tabs.every((t) => t.label >= 10 && !/grayscale/.test(t.filter) && t.h >= 48), r.tabs);
    }

    // ================= 2. bag as pockets, ledger =================
    if (want(2)) {
      const r = await page.evaluate(async () => {
        const item = Object.keys(OC.Style.ITEMS).find((k) => OC.Items.groupOf && OC.Items.groupOf(k) === 'food') || Object.keys(OC.Style.ITEMS)[0];
        const c0 = OC.Store.s.coins; OC.Tx.run('v14:get', { get: { coins: 120, items: { [item]: 2 } } }, '測試收入'); OC.Tx.run('v14:pay', { pay: { coins: 30 } }, '測試支出');
        OC.Pages.open('bag'); await new Promise((r2) => setTimeout(r2, 600));
        const g = document.querySelector('.grid.pockets'), tiles = [...g.children];
        const out = { item, pockets: tiles.length, filled: tiles.filter((t) => t.tagName === 'BUTTON').length, empty: tiles.filter((t) => t.classList.contains('pocket-empty')).length, emptyInert: tiles.filter((t) => t.classList.contains('pocket-empty')).every((t) => getComputedStyle(t).pointerEvents === 'none'), coinsShown: (document.querySelector('.pocket-coins b') || {}).textContent, coins: OC.Store.s.coins };
        OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close());
        OC.Pages.open('ledger'); await new Promise((r2) => setTimeout(r2, 600));
        const pg = document.querySelector('.ledger-top').closest('.page');
        out.ledger = { bal: pg.querySelector('.ledger-bal b').textContent, day: [...pg.querySelectorAll('.ledger-day b')].map((b) => b.textContent), heads: [...pg.querySelectorAll('.section-title')].map((e) => e.textContent), rows: pg.querySelectorAll('.ledger-row').length, firstRow: pg.querySelector('.ledger-row').textContent, log: OC.Tx.log.length, c0 };
        return out;
      });
      await shot(page, '2-ledger'); await closeAll();
      check('2a 背包是口袋格：有東西的口袋可以點、空口袋也畫出來（至少 16 格、補滿整列）但不能點；顯示的星幣和實際一致', r.filled >= 1 && r.pockets >= 16 && r.pockets % 4 === 0 && r.empty === r.pockets - r.filled && r.emptyInert && r.coinsShown === String(r.coins), r);
      check('2b 交易紀錄：最上面是現在的星幣、今天的收入與支出（由帳本算出），紀錄依日期分組、最新的在最上面', r.ledger.bal === String(r.coins) && /^\+\d+$/.test(r.ledger.day[0]) && +r.ledger.day[0].slice(1) >= 120 && r.ledger.day[1] === '−30' && r.ledger.heads[0] === '今天' && r.ledger.rows === Math.min(120, r.ledger.log) && /測試支出/.test(r.ledger.firstRow), r.ledger);
    }

    // ================= 3. the pet centre desk =================
    if (want(3)) {
      const r = await page.evaluate(async () => {
        const ids = OC.Chars.all().map((c) => c.id), sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
        for (const id of OC.PetSync.on().slice()) OC.PetSync.setOn(id, false);
        OC.Pages.open('petcenter'); await sleep(700);
        const P = OC.Pages.pages.petcenter, desk = () => document.querySelector('.pet-desk');
        const out = { first: [...desk().querySelectorAll('.pet-desk-pet small')].map((e) => e.textContent), active: OC.Chars.name(OC.Chars.active()) };   /* nobody picked yet: the one you play stands there (PetSync's own fallback) */
        OC.PetSync.setOn(ids[0], true); OC.PetSync.setOn(ids[1], true); P._sig = ''; P.refresh(P); await sleep(500);
        const pets = [...desk().querySelectorAll('.pet-desk-pet')];
        out.pets = pets.map((b) => b.querySelector('small').textContent); out.names = [OC.Chars.name(OC.Chars.get(ids[0])), OC.Chars.name(OC.Chars.get(ids[1]))];
        const ink = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n; };
        out.drawn = pets.map((b) => ink(b.querySelector('canvas')) > 200);
        out.tag = desk().querySelector('.pet-desk-sky').textContent; out.target = pets[0].getBoundingClientRect().height;
        pets[0].click(); await sleep(600);
        out.opened = !!(OC.Pages.pages.petone.el && OC.Pages.pages.petone.el.classList.contains('open'));
        return out;
      });
      await page.evaluate(() => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); OC.Pages.open('petcenter'); }); await wait(page, 700); await shot(page, '3-petcenter'); await closeAll();
      check('3a 桌寵中心最上面是「桌面」：還沒選時站著你操控的那一隻；選了兩個就有兩隻站在上面（真的畫出來、標著名字）', r.first.length === 1 && r.first[0] === r.active && r.pets.length === 2 && r.pets[0] === r.names[0] && r.pets[1] === r.names[1] && r.drawn.every(Boolean), r);
      check('3b 瀏覽器裡標示為「預覽」（不假裝桌寵已經在桌面上）；點桌面上的角色會打開牠的桌寵設定；觸控高度 ≥ 48', r.tag === '預覽' && r.opened && r.target >= 48, { tag: r.tag, opened: r.opened, h: r.target });
    }

    // ================= 4. a picture character: crop / move / zoom with fingers =================
    if (want(4)) {
      const id = await page.evaluate(async () => {
        const file = async (n) => new File([await (await fetch('/tests/fixtures/' + n)).blob()], n, { type: 'image/png' });
        const c = OC.Chars.blank('import'); const doc0 = await OC.Library.spriteCharFromFiles(c, [await file('wave.png')]); await OC.Anim.preload(doc0); c.profile.name = '圖圖'; c.status.onIsland = true; OC.Chars.add(c);
        OC.Pages.open('charedit', { id: c.id }); return c.id;
      });
      await wait(page, 900);
      await page.evaluate(() => { const sec = document.querySelector('[data-sec="image"]'); sec && sec.scrollIntoView({ block: 'center' }); }); await wait(page, 500);
      const box = await page.evaluate(() => { const b = document.querySelector('.crop-box'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(), hs = Object.fromEntries(['l', 't', 'r', 'b'].map((k) => { const q = b.querySelector('.crop-h.' + k).getBoundingClientRect(); return [k, { x: q.x + q.width / 2, y: q.y + q.height / 2 }]; })); return { x: r.x, y: r.y, w: r.width, h: r.height, hs }; });
      let res = { box: !!box };
      if (box) {
        const draft = () => page.evaluate(() => { const f = OC.Pages.pages.charedit.draft.appearance.frame || {}; return { crop: Object.assign({ l: 0, t: 0, r: 0, b: 0 }, f.crop), dx: f.dx || 0, dy: f.dy || 0, zoom: f.zoom || 1 }; });
        /* drag the left handle a quarter of the width to the right, with real pointer events */
        await page.mouse.move(box.hs.l.x, box.hs.l.y); await page.mouse.down(); await page.mouse.move(box.hs.l.x + box.w * 0.125, box.hs.l.y, { steps: 4 }); await page.mouse.move(box.hs.l.x + box.w * 0.25, box.hs.l.y, { steps: 4 }); await page.mouse.up(); await wait(page, 500);
        res.afterCrop = await draft();
        /* dragging far beyond the limit stops at 45 % */
        const b2 = await page.evaluate(() => { const b = document.querySelector('.crop-box'); b.scrollIntoView({ block: 'end' }); /* the preview stage stays pinned at the top of this page: bring the top handle below it */ const q = b.querySelector('.crop-h.t').getBoundingClientRect(), r = b.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2, h: r.height, cx: r.x + r.width * 0.62, cy: r.y + r.height * 0.75 }; });
        await page.mouse.move(b2.x, b2.y); await page.mouse.down(); await page.mouse.move(b2.x, b2.y + b2.h * 0.9, { steps: 6 }); await page.mouse.up(); await wait(page, 500);
        res.clamped = await draft();
        /* put the top edge back (a 90 % crop leaves a sliver the middle of which is covered by the handles) */
        { const b4 = await page.evaluate(() => { const b = document.querySelector('.crop-box'); b.scrollIntoView({ block: 'center' }); const q = b.querySelector('.crop-h.t').getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2, h: b.getBoundingClientRect().height }; });
          await page.mouse.move(b4.x, b4.y); await page.mouse.down(); await page.mouse.move(b4.x, b4.y - b4.h * 1.2, { steps: 6 }); await page.mouse.up(); await wait(page, 500); }
        await page.evaluate(() => { const p = OC.Pages.pages.charedit, f = p.draft.appearance.frame; f.crop.t = 0; p.ctx.rebuild(); }); await wait(page, 400);
        /* one finger inside the frame moves the character */
        const b3 = await page.evaluate(() => { const b = document.querySelector('.crop-box'); b.scrollIntoView({ block: 'center' }); const q = b.querySelector('.crop-rect').getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2, h: b.getBoundingClientRect().height }; });
        await page.mouse.move(b3.x, b3.y); await page.mouse.down(); await page.mouse.move(b3.x + 20, b3.y + 10, { steps: 4 }); await page.mouse.up(); await wait(page, 500);
        res.moved = await draft();
        res.saved = await page.evaluate((id) => { const c = OC.Chars.get(id); return { frame: c.appearance.frame || null, dirty: !!OC.Pages.pages.charedit.dirty }; }, id);
        res.original = await page.evaluate(async (id) => { const c = OC.Chars.get(id), r = OC.CharRender.spriteFor(c, { action: 'idle' }); return { w: r.doc.w, h: r.doc.h }; }, id);
      }
      await shot(page, '4-crop');
      await page.evaluate(() => { const p = OC.Pages.pages.charedit; p.dirty = false; }); await closeAll();
      check('4a 圖片角色的編輯頁有裁切框，直接拖左邊的把手就裁掉左邊（約四分之一），其他三邊不變', res.box && Math.abs(res.afterCrop.crop.l - 0.25) < 0.04 && res.afterCrop.crop.t === 0 && res.afterCrop.crop.r === 0 && res.afterCrop.crop.b === 0, res.afterCrop || res);
      check('4b 拖過頭會停在上限（16.0：每邊最多 92% 減去對邊），不會把整張圖裁光', res.box && res.clamped.crop.t > 0.85 && res.clamped.crop.t <= 0.92, res.clamped || res);
      check('4c 在框內單指拖曳＝移動角色的位置（裁切不變）；還沒按儲存前只改草稿，角色本身沒被改動', res.box && res.moved.dx > 1 && res.moved.dy > 0.5 && Math.abs(res.moved.crop.l - res.clamped.crop.l) < 0.001 && res.saved.frame === null && res.saved.dirty, { moved: res.moved, saved: res.saved });
    }

    // ================= 5. the world: remodelled and baked =================
    if (want(5)) {
      await page.evaluate(() => OC.WorldUI.travel('isle', { instant: true })); await page.waitForFunction(() => OC.World.area && OC.World.area.id === 'isle', null, { timeout: 40000 });
      await page.evaluate(() => { const S = OC.Store.s.settings; S.perf = 'high'; OC.App.applyPerf(); }); await wait(page, 3500);
      const r = await page.evaluate(() => {
        const sc = OC.World.scene, M = OC.Models; let meshes = 0; sc.traverse((o) => { if (o.isMesh && o.visible) meshes++; });
        const tree = M.fruitTree('#EE4B4B', 3), crownMeshes = tree.crown.children.filter((c) => c.isMesh).length, fruitsSeparate = tree.fruits.length === 6 && tree.fruits.every((f) => f.parent === tree.crown && f.isMesh);
        const house = M.house({}), hm = []; house.traverse((o) => { if (o.isMesh) hm.push(o); });
        const lit = M.night.windows.filter((m) => hm.some((o) => o.material === m)).length;
        const bed = M.flowerBed(34, 18, 2), bloom = bed.userData.blooms[0]; let bm = 0; bloom.traverse((o) => { if (o.isMesh) bm++; }); let bedMeshes = 0; bed.traverse((o) => { if (o.isMesh) bedMeshes++; });
        const nan = (g) => { let bad = 0; g.traverse((o) => { if (o.isMesh) { const p = o.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 97) if (!Number.isFinite(p[i])) bad++; } }); return bad; };
        return { calls: OC.World.fx.calls, meshes, crownMeshes, fruitsSeparate, houseMeshes: hm.length, lit, bloomMeshes: bm, bedMeshes, blooms: bed.userData.blooms.length, sway: OC.World.swayTargets().filter(Boolean).length, nan: nan(house) + nan(tree.group) + nan(M.cedar(1).group) + nan(M.bush(3).group) + nan(M.rock(1, 2)), size: [house.userData.size, tree.group.userData.size] };
      });
      await shot(page, '5-island');
      check('5a 靜態模型依材質合併：一棟房子從 80 多個零件變成 ≤ 24 個、一整個花圃（含所有的花）≤ 12 個、樹冠的葉子 ≤ 4 個（果實仍然一顆一顆、可以單獨採）', r.houseMeshes <= 24 && r.bloomMeshes <= 8 && r.bedMeshes <= 12 && r.crownMeshes - 6 <= 4 && r.fruitsSeparate, r);
      check('5b 整個小島的繪製呼叫 ≤ 200（14.0 之前約 550、14.0 約 250；含陰影那一遍）', r.calls > 0 && r.calls <= 200, { calls: r.calls, meshes: r.meshes });
      check('5c 合併後功能不變：窗戶的夜間發光材質還接在房子上、花圃的花還是會隨風搖（14.2 起整個花圃一起）、可以搖的樹和草叢都還在、占地不變、沒有壞掉的頂點', r.lit >= 3 && r.blooms >= 1 && r.sway >= 20 && r.nan === 0 && r.size[0].w === 76 && r.size[1].w === 14, { lit: r.lit, blooms: r.blooms, sway: r.sway, nan: r.nan, size: r.size });
    }

    // ================= 6. small things found while looking at every screen =================
    if (want(6)) {
      await closeAll();
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)), out = {};
        OC.App.showDialogue('測試', ['今天的風很舒服。'], [], () => {}, true); await sleep(500);
        out.talking = document.body.classList.contains('talking'); out.questHidden = (() => { const q = document.querySelector('.hud-quest'); return !q || q.hidden || getComputedStyle(q).pointerEvents === 'none'; })();
        OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); await sleep(400);
        out.after = document.body.classList.contains('talking');
        /* a heading with a long note beside it: the heading itself stays on one line */
        OC.Pages.open('profile', { id: OC.Store.s.activeId, tab: 'grow' }); await sleep(700);
        out.heads = [...OC.Pages.pages.profile.el.querySelectorAll('.section-title')].map((e) => { const rg = document.createRange(); rg.setStart(e.firstChild, 0); rg.setEnd(e.firstChild, e.firstChild.textContent.length); return { t: e.firstChild.textContent, lines: rg.getClientRects().length }; }).filter((x) => x.t.trim());
        /* nothing shows an empty coloured pill */
        out.emptyPills = [...document.querySelectorAll('.tag, .chip')].filter((e) => !e.textContent.trim() && !e.children.length && getComputedStyle(e).display !== 'none').length;
        /* tag text is readable on its own background (the 13.0 tags were the same colour as their background) */
        const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
        OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); OC.App.tab('char'); await sleep(600);
        out.tags = [...OC.Pages.pages.char.el.querySelectorAll('.tag')].filter((e) => e.textContent.trim()).map((e) => { const s = getComputedStyle(e); return { t: e.textContent, d: +Math.abs(lum(s.color) - lum(s.backgroundColor)).toFixed(2) }; });
        return out;
      });
      await closeAll();
      check('6a 有人說話時任務膠囊會讓開（不被對話框蓋住一半），說完就回來', r.talking && r.questHidden && !r.after, { talking: r.talking, hidden: r.questHidden, after: r.after });
      check('6b 標題不會從字中間斷行（旁邊的長說明自己換行）', r.heads.length >= 2 && r.heads.every((x) => x.lines <= 1), r.heads);
      check('6c 沒有空白的彩色膠囊；標籤的字和底色分得開（看得到字）', r.emptyPills === 0 && r.tags.length >= 2 && r.tags.every((t) => t.d >= 0.2), { empty: r.emptyPills, tags: r.tags });
    }

    // ================= 7. 14.1 performance: nothing expensive runs every frame in the compositor =================
    if (want(7)) {
      await closeAll();
      await page.evaluate(() => OC.WorldUI.travel('isle', { instant: true })); await page.waitForFunction(() => OC.World.area && OC.World.area.id === 'isle', null, { timeout: 40000 });
      const lights = () => page.evaluate(() => { let n = 0; OC.World.scene.traverse((o) => { if (o.isPointLight && o.visible) n++; }); return n; });
      const set = (hour, perf) => page.evaluate(([hour, perf]) => { const S = OC.Store.s.settings; S.time = 'fixed'; S.fixedHour = hour; S.weather = 'clear'; S.perf = perf; OC.App.applyPerf(); }, [hour, perf]);
      const r = {};
      for (const perf of ['high', 'balanced', 'saver']) { await set(12, perf); await wait(page, 700); r[perf] = await page.evaluate(() => { const cs = (id, k) => getComputedStyle(document.getElementById(id))[k]; return { filter: cs('world', 'filter'), blend: cs('world-glow', 'mixBlendMode'), soft: OC.World.renderer.shadowMap.type === THREE.PCFSoftShadowMap, check: OC.World.renderer.debug.checkShaderErrors }; }); }
      await set(12, 'balanced'); await page.waitForFunction(() => { let n = 0; OC.World.scene.traverse((o) => { if (o.isPointLight && o.visible) n++; }); return n === 0; }, null, { timeout: 60000 }).catch(() => {});
      const day = await lights();
      await set(23, 'balanced'); await page.waitForFunction(() => { let n = 0; OC.World.scene.traverse((o) => { if (o.isPointLight && o.visible) n++; }); return n > 0; }, null, { timeout: 60000 }).catch(() => {});
      const night = await lights();
      await set(23, 'saver'); await wait(page, 1200); const saverNight = await lights();
      await set(12, 'balanced'); await wait(page, 500);
      check('7a 3D 畫布上沒有 CSS 濾鏡、光暈層沒有混合模式（三種效能模式都一樣）——調色改在著色器裡做；不再每次編譯都向驅動要錯誤紀錄', ['high', 'balanced', 'saver'].every((k) => r[k].filter === 'none' && r[k].blend === 'normal' && r[k].check === false) && /ocL/.test(await page.evaluate(() => THREE.ShaderChunk.tonemapping_fragment)), r);
      check('7b 柔邊陰影只在「高」；白天路燈的點光源完全關掉（不是亮度 0），晚上才打開；「省電」晚上也不開', r.high.soft && !r.balanced.soft && !r.saver.soft && day === 0 && night >= 1 && saverNight === 0, { day, night, saverNight });
      /* the frame-rate watcher (it is switched off in automated runs — software rendering is always slow — so its rule is driven by hand) */
      const ad = await page.evaluate(() => {
        const S = OC.Store.s.settings, out = {}; S.perf = 'balanced'; OC.App.applyPerf(); const r0 = OC.World.renderer.getPixelRatio();
        out.good = Array.from({ length: 20 }, () => OC.App.adaptStep(58)).some(Boolean); out.lvGood = OC.App.adaptLevel;
        out.blip = [30, 30, 30, 58, 30, 30, 30, 58].map((f) => OC.App.adaptStep(f)).some(Boolean);   /* a short dip is not a slow device */
        out.slow = Array.from({ length: 6 }, () => OC.App.adaptStep(28)); out.lv1 = OC.App.adaptLevel; out.r1 = OC.World.renderer.getPixelRatio();
        Array.from({ length: 6 }, () => OC.App.adaptStep(28)); out.lv2 = OC.App.adaptLevel; out.r2 = OC.World.renderer.getPixelRatio();
        Array.from({ length: 6 }, () => OC.App.adaptStep(20)); out.lv3 = OC.App.adaptLevel; out.sh3 = OC.World.perfStats().shadows; Array.from({ length: 30 }, () => OC.App.adaptStep(15)); out.lv4 = OC.App.adaptLevel; out.r3 = OC.World.renderer.getPixelRatio();
        S.perf = 'high'; OC.App.applyPerf(); out.high = Array.from({ length: 12 }, () => OC.App.adaptStep(20)).some(Boolean);
        S.perf = 'balanced'; OC.App.applyPerf(); out.reset = OC.App.adaptLevel; out.r0 = r0; out.rBack = OC.World.renderer.getPixelRatio();
        return out;
      });
      check('7c 「平衡」會看自己的幀率：連續三秒跟不上就降一級解析度，最多降三級（第三級關掉陰影與草）、不會一直降；短暫掉幀不算；「高」不會被自動降；重新套用模式會回到原本的解析度', !ad.good && ad.lvGood === 0 && !ad.blip && ad.slow[5] === true && ad.slow.slice(0, 5).every((x) => !x) && ad.lv1 === 1 && ad.r1 <= ad.r0 && ad.lv2 === 2 && ad.r2 <= ad.r1 && ad.r2 >= 1 && ad.lv3 === 3 && ad.sh3 === 0 && ad.lv4 === 3 && ad.r3 >= 1 && !ad.high && ad.reset === 0 && ad.rBack === ad.r0, ad);
    }

    // ================= 8. 14.2: character textures, paint budget, on-screen numbers =================
    if (want(8)) {
      await closeAll();
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)), out = {};
        const S = OC.Store.s.settings; S.perf = 'balanced'; OC.App.applyPerf();
        /* the billboard canvases are CPU-backed (uploading a GPU-backed canvas to a texture needs a read-back) */
        const acts = OC.Chars.all().map((c) => OC.App.actorOf(c.id)).filter(Boolean);
        out.cpuCanvas = acts.map((a) => { const at = a.c.getContext('2d').getContextAttributes ? a.c.getContext('2d').getContextAttributes() : null; return at ? at.willReadFrequently === true : null; });
        /* never more than two repaints in one frame, and the played character is never the one that waits */
        /* the counters that reset belong to the FPS read-out; the running totals are for this */
        const maxPerFrame = async () => { let worst = 0; for (let k = 0; k < 4; k++) { for (const a of acts) a.key = 'stale' + Math.random(); const p0 = OC.World.perfStats(); const t0 = performance.now(); let p1 = p0; while (p1.totalFrames < p0.totalFrames + 1 && performance.now() - t0 < 15000) { await sleep(30); p1 = OC.World.perfStats(); } const fr = p1.totalFrames - p0.totalFrames; if (fr === 1) worst = Math.max(worst, p1.totalPaints - p0.totalPaints); out.frames = (out.frames || 0) + fr; } return worst; };
        out.paintsPerFrame = await maxPerFrame(); { const ps = OC.World.perfStats(); out.keys = ['renderMs', 'calls', 'tris', 'ratio', 'shadows', 'bb'].every((k) => typeof ps[k] === 'number'); }
        out.gpu = typeof OC.World.gpu === 'string' && OC.World.gpu.length > 0;
        S.showFps = true; OC.App.applyPerf(); await sleep(1600); const el = document.querySelector('.fps'); out.fpsText = el.textContent; out.fpsShown = !el.hidden; out.fpsBg = getComputedStyle(el).backgroundColor;
        S.showFps = false; OC.App.applyPerf(); await sleep(100); out.fpsHidden = el.hidden;
        return out;
      });
      check('8a 角色看板的畫布是 CPU 畫布（上傳成貼圖時不用從 GPU 讀回）；一幀最多重畫兩個角色', r.cpuCanvas.length >= 2 && r.cpuCanvas.every((x) => x === true) && r.paintsPerFrame <= 2.01 && r.frames >= 2, { cpu: r.cpuCanvas, perFrame: r.paintsPerFrame, frames: r.frames });
      check('8b 打開「顯示 FPS」會看到一條看得清楚的數字：幀率、每幀時間（其中繪製多少）、角色重畫次數、繪製呼叫、解析度倍率、陰影、降級；關掉就消失', r.fpsShown && /fps｜每幀 [\d.]+ms（繪製 [\d.]+）｜角色重畫 \d+\/秒｜呼叫 \d+｜×[\d.]+｜陰影 \d+｜降級 \d/.test(r.fpsText) && r.fpsBg !== 'rgba(0, 0, 0, 0)' && r.fpsHidden && r.keys && r.gpu, { text: r.fpsText, bg: r.fpsBg });
    }

    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.stack || e)); }
  await browser.close();
  const bad = H.results.filter((r) => !r.ok); console.log(`\n${H.results.length - bad.length}/${H.results.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
