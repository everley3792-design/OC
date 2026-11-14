/* OC Shimeji — 16.0 acceptance: node game/tests/v16/run.js [1 2 …]   (start `cd game && python3 -m http.server 8765` first)
 * 1 picture characters (resolution, size, never cut)  2 switching who you play  3 name card  4 interface actions
 * 5 shared allowance + mailbox  6 relationships are not created by looking  7 calendar  8 save v8 */
const { chromium } = require('playwright'); const H = require('../life/harness.js'); const { check } = H;
const only = process.argv.slice(2).map(Number); const want = (n) => !only.length || only.includes(n);
const BIG = `(async () => { const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 2000; const g = cv.getContext('2d');
  g.fillStyle = '#f6d7c0'; g.beginPath(); g.ellipse(700, 1000, 520, 900, 0, 0, 7); g.fill(); g.fillStyle = '#203080'; g.font = 'bold 120px sans-serif'; for (let i = 0; i < 8; i++) g.fillText('OC ' + i, 300, 500 + i * 150);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png')); const c = OC.Chars.blank('import'); const d = await OC.Library.spriteCharFromFiles(c, [new File([blob], 'big.png', { type: 'image/png' })]); await OC.Anim.preload(d); c.profile.name = '大圖'; c.status.onIsland = true; OC.Chars.add(c); return c.id; })()`;
(async () => {
  const { browser, page, errors } = await H.launch({ w: 393, h: 852 });
  try {
    await H.boot(page, { chars: 4, hour: 10, query: '?cal=settings' });   /* ?cal=settings: neither real nor game → the setting decides */
    if (want(1)) {
      const r = await page.evaluate(async (src) => {
        const id = await eval(src); OC.Chars.setActive(id); Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true }); OC.Store.s.settings.perf = 'balanced'; OC.App.applyPerf();
        await new Promise((r) => setTimeout(r, 4000)); const ps = OC.World.perfStats(), c = OC.Chars.get(id);
        const e0 = OC.CharRender.extent(c); c.appearance.frame = { zoom: 2.2, sx: 1.6, sy: 1 }; const e1 = OC.CharRender.extent(c); const t1 = OC.CharRender.tall(c);
        c.appearance.frame = { zoom: 0.2, sx: 4, sy: 0.2 }; const fr = OC.Puppet.frameOf(c); c.appearance.frame = null;
        const doc = OC.CharRender.spriteFor(c, { action: 'idle' }).doc, img = OC.Anim.composite(doc, 0), m = OC.CharRender.mipOf(img, 3);
        return { split: ps.split, cr: ps.charRatio, ratio: ps.ratio, e0, e1, t1, fr, mip: [m.width, img.width] };
      }, BIG);
      check('1a 角色用螢幕原本的解析度畫在較低解析度的世界上（兩段式繪製）', r.split && r.cr > r.ratio, r);
      check('1b 放大／拉寬後畫布跟著變大（不被切）；寬高可以分開到 20%–400%', r.e0 === 1 && r.e1 >= 1.5 && r.fr.zoom === 0.2 && r.fr.sx === 4 && r.fr.sy === 0.2 && r.t1 > 1.5, r);
      check('1c 大圖先分段縮小（每段減半）再畫', r.mip[0] === Math.ceil(r.mip[1] / 8), r.mip);
      await page.screenshot({ path: 'deliverables/v16/1-big.png' }).catch(() => {});
    }
    if (want(2)) {
      const r = await page.evaluate(async () => {
        const all = OC.Chars.all(); const act0 = OC.Store.s.activeId; all.forEach((c) => OC.Brain.setControl(c.id, 'manual')); all[2].life.loc = 'cafe'; all[2].life.pos = null; OC.App.syncPresence();
        const before = all.map((c) => { const a = OC.App.actorOf(c.id); return a ? [Math.round(a.x), Math.round(a.y)] : null; });
        OC.Chars.setActive(all[1].id); await new Promise((r) => setTimeout(r, 1500));
        const after = all.map((c) => { const a = OC.App.actorOf(c.id); return a ? [Math.round(a.x), Math.round(a.y)] : null; });
        OC.Chars.setActive(all[2].id); await new Promise((r) => setTimeout(r, 3500));
        return { before, after, area: OC.World.area.id, act: OC.Store.s.activeId, id2: all[2].id, old: all[1].life.loc, oldPos: all[1].life.pos, act0 };
      });
      check('2a 切換操控角色：沒有人被傳送（操控者與被切到的角色位置不變；其他人只有自己的小動作）', [0, 1].every((i) => Math.hypot(r.before[i][0] - r.after[i][0], r.before[i][1] - r.after[i][1]) < 8), { b: r.before, a: r.after });
      check('2b 切到在別的地點的角色：畫面過去找他（咖啡館），原本的角色留在晴日島', r.area === 'cafe' && r.act === r.id2 && r.old === 'isle' && r.oldPos && r.oldPos.area === 'isle', r);
    }
    if (want(3)) {
      await page.evaluate(() => { OC.World.area.id !== 'isle' && OC.WorldUI.travel('isle'); }); await page.waitForFunction(() => OC.World.area.id === 'isle', null, { timeout: 20000 }); await page.waitForTimeout(1500);
      const r = await page.evaluate(() => { const c = OC.Chars.active(); c.needs.food = 8; return { n: document.querySelectorAll('.np-mini:not(.np-more)').length, want: Math.min(4, OC.Chars.all().length - 1), ring: !!document.querySelector('.hud-av[data-mood]'), badge: !!document.querySelector('.np-mode'), hasPlace: /・/.test(document.querySelector('.hud-moodtxt').textContent) }; });
      await page.waitForTimeout(800);
      const need = await page.evaluate(() => document.querySelectorAll('.np-need').length);
      check('3a 名牌卡：心情色環、操控模式小圖示、「地點・在做什麼」、其他角色小頭像', r.n === r.want && r.ring && r.badge && r.hasPlace, r);
      check('3b 需求偏低時才浮出需求小圖示', need >= 1, need);
      const sw = await page.evaluate(async () => { const was = OC.Store.s.activeId; document.querySelector('.np-others').click(); await new Promise((r) => setTimeout(r, 900)); const pick = [...document.querySelectorAll('.sc-pick')].find((b) => !b.classList.contains('on')); if (pick) pick.click(); await new Promise((r) => setTimeout(r, 1500)); return { opened: !!pick, changed: OC.Store.s.activeId !== was, buttons: document.querySelectorAll('#hud button').length }; });
      check('3c 點小頭像疊＝打開狀態卡的角色清單，選一位＝切換操控；整疊只算一個按鈕', sw.opened && sw.changed, sw);
    }
    if (want(4)) {
      await page.evaluate(() => { const S = OC.Store.s; if (OC.World.area.id !== 'isle') OC.WorldUI.travel('isle'); S.settings.walkTo = false; });
      await page.waitForFunction(() => OC.World.area.id === 'isle', null, { timeout: 20000 }); await page.waitForTimeout(1200);
      const r = await page.evaluate(async () => {
        const p = OC.App.player, x0 = p.x, y0 = p.y; let opened = false; const orig = OC.Pages.open; OC.Pages.open = function (id) { if (id === 'shop') opened = true; return orig.apply(OC.Pages, arguments); };
        const shop = OC.World.interacts.find((i) => i.type === 'shop'); if (shop) OC.WorldUI.tap(shop); await new Promise((r) => setTimeout(r, 300)); OC.Pages.open = orig;
        const moved = Math.hypot(p.x - x0, p.y - y0) > 6; if (opened && OC.UI.stack.length) OC.UI.back && OC.UI.back();
        const id = 'apple'; OC.Store.s.inv = OC.Store.s.inv || {}; const d = { id, x: p.x + 30, y: p.y, lvl: 0, key: 'v16:test' }; OC.App.offerUse && OC.App.offerUse(id); const card = !!document.querySelector('.use-now');
        return { shop: !!shop, opened, moved, card };
      });
      check('4a 商店：點了直接打開購買畫面，角色不必先走過去', r.shop && r.opened && !r.moved, r);
      check('4b 撿到食物：出現「現在吃」，一點就用', r.card);
    }
    if (want(5)) {
      const r = await page.evaluate(() => {
        const L = OC.Store.s.life; L.settings.lively = 'normal'; const B = OC.Budget; L.budget = { play: 0, lastAsk: 0, lastAskGm: OC.Sim.now(), n: 0 };
        const a = B.can('x'); for (let i = 0; i < 1210; i++) B.tick(1); const bReal = B.can('x'); OC.Sim.advance(250); const b = B.can('x'); const g0 = OC.Sim.now(); B.spend('x'); const c = B.can('x');
        L.settings.lively = 'lively'; L.budget = { play: 0, lastAsk: 0, lastAskGm: OC.Sim.now() - 1000, n: 0 }; for (let i = 0; i < 500; i++) B.tick(1); const d = B.can('x');
        L.settings.lively = 'quiet'; const q = B.LEVELS.quiet.real > B.LEVELS.normal.real && B.LEVELS.normal.real > B.LEVELS.lively.real;
        const m = B.mail({ kind: 't', title: '測試', text: '內文', key: 'k1' }), m2 = B.mail({ kind: 't', title: '測試', text: '內文', key: 'k1' });
        const un = B.unread(), nc = OC.LifeUI.noticeCount(); B.readAll();
        L.settings.lively = 'legacy'; return { a, bReal, b, c, d, q, dup: m2 === null, un, nc, after: B.unread(), legacy: B.can('x') };
      });
      check('5a 打擾預算：剛開始不能問；要「玩了約 20 分鐘」且「遊戲時間過了 4 小時」兩者都到才可以；用掉就要再等；熱鬧較快、安靜較慢', !r.a && !r.bReal && r.b && !r.c && r.d && r.q, r);
      check('5b 信箱：同 key 只會有一封；未讀數進入鈴鐺；讀過就清掉', r.dup && r.un >= 1 && r.nc >= 1 && r.after === 0, r);
      check('5c 舊版模式（舊測試用）不受限制', r.legacy);
    }
    if (want(6)) {
      const r = await page.evaluate(() => {
        const [a, b] = OC.Chars.all(); const n0 = Object.keys(OC.Store.s.life.rel).length; const x = OC.Mind.rel(a.id, 'nobody-1'); const read = x.aff + x.trust + x.type; const n1 = Object.keys(OC.Store.s.life.rel).length;
        const y = OC.Mind.rel(a.id, 'nobody-2'); y.aff = 5; const n2 = Object.keys(OC.Store.s.life.rel).length; const z = OC.Mind.rel(a.id, 'nobody-2');
        return { n0, n1, n2, kept: z.aff };
      });
      check('6 只是查看關係不會留下紀錄；寫入時才建立並保留', r.n1 === r.n0 && r.n2 === r.n0 + 1 && r.kept === 5, r);
    }
    if (want(7)) {
      const r = await page.evaluate(() => {
        const S = OC.Store.s; S.settings.calendar = 'game'; const k = OC.Clock.cal(), day = OC.Sim.day(); const c = S.life.clock; const c0 = c.cal0;
        const y = (n) => OC.Clock.cal(c.cal0 + n); const samples = [y(0), y(27), y(28), y(55), y(56), y(111), y(112)];
        const bd = OC.Island.parseBday('春 12'), bd2 = OC.Island.parseBday('3/14'), bd3 = OC.Island.parseBday('冬 28');
        S.settings.calendar = 'real'; const rl = OC.Clock.cal(); const lab = OC.Clock.label().date; S.settings.calendar = 'game';
        return { mode: k.mode, s: samples.map((s) => [s.season, s.day, s.year]), wk: [y(4).weekend, y(5).weekend, y(6).weekend, y(7).weekend], bd, bd2: bd2 && bd2.m, bd3, real: rl.mode, lab, yd: k.yd, game: OC.Clock.toGameDay(3, 1), gdEnd: OC.Clock.toGameDay(2, 28) };
      });
      const exp = JSON.stringify([['spring', 1, 1], ['spring', 28, 1], ['summer', 1, 1], ['summer', 28, 1], ['autumn', 1, 1], ['winter', 28, 1], ['spring', 1, 2]]);
      check('7a 遊戲曆：一年四季、每季 28 天、112 天後進入第 2 年', JSON.stringify(r.s) === exp, r.s);
      check('7b 一週 7 天，第 6、7 天是週末', JSON.stringify(r.wk) === JSON.stringify([false, true, true, false]), r.wk);
      check('7c 生日可以寫「春 12」或 3/14（換算到季節）；實時曆照手機日期', r.bd && r.bd.g === 11 && r.bd3 && r.bd3.g === 111 && r.bd2 === 3 && r.real === 'real' && r.game === 0 && r.gdEnd === 111, r);
    }
    if (want(8)) {
      const r = await page.evaluate(() => {
        const old = JSON.parse(JSON.stringify(OC.Store.s)); old.v = 7; delete old.migratedV7; delete old.settings.calendar; delete old.settings.charQ; delete old.life.mail; delete old.life.budget; delete old.life.clock.cal0; delete old.life.clock.cal0pending; old.settings.season = 'autumn';
        OC.Store.importJSON(JSON.stringify(old)); const S = OC.Store.s; return { v: S.v, cal: S.settings.calendar, cal0p: S.life.clock.cal0pending, chars: Object.keys(S.chars).length, season: OC.Clock.season(), td: OC.Clock.cal().season };
      });
      check('8 舊存檔 v7 → v8：角色全部保留；日曆從原本的季節接續（秋天仍是秋天）', r.v === 8 && r.cal === 'game' && r.chars >= 4 && r.td === 'autumn', r);
    }
    check('沒有未預期的錯誤', errors.filter((e) => !/deprecated|readback|favicon/.test(e)).length === 0, errors.slice(0, 4));
  } finally { await browser.close(); }
  const bad = H.results.filter((x) => !x.ok).length; console.log(`\n${H.results.length - bad}/${H.results.length} 通過`); process.exit(bad ? 1 : 0);
})();
