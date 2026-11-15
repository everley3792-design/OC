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
        const all = OC.Chars.all(); const act0 = OC.Store.s.activeId; all.forEach((c) => OC.Brain.setControl(c.id, 'manual')); for (const c of all) { const bb = OC.Brain.get(c.id); if (!bb) continue; if (bb.conv) OC.Brain.Social.end(bb.conv, 't'); if (bb.st === 'do') OC.Brain.finish(bb, 't'); else if (bb.st === 'go') OC.Brain.abort(bb, 't'); const a = OC.App.actorOf(c.id); if (a) a.path = null; } await new Promise((r) => setTimeout(r, 600)); all[2].life.loc = 'cafe'; all[2].life.pos = null; OC.App.syncPresence();
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
    if (want(9)) {
      /* 16.1 the opening on a fresh install: three islanders, ages / species, relationships, houses — with real taps */
      const p2 = await browser.newPage({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true }); p2.on('pageerror', (e) => errors.push(String(e.stack || e)));
      await p2.goto(H.URL + '?cal=settings'); await p2.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('oc-assets'); }); await p2.goto(H.URL + '?cal=settings');
      await p2.waitForSelector('.intro-skip', { timeout: 30000 }); await p2.tap('.intro-skip'); await p2.waitForSelector('.intro-welcome.on', { timeout: 10000 }); await p2.waitForTimeout(800);
      await p2.tap('.intro-welcome .btn.primary'); await p2.waitForSelector('.creator .card', { timeout: 10000 });
      const create = async (nm, card) => {
        await p2.click(`.creator .card >> nth=${card}`); await p2.waitForTimeout(300);
        for (let i = 0; i < 14; i++) { if (!(await p2.$('.creator'))) break; await p2.evaluate((n) => { const el = document.querySelector('.creator input[placeholder*="名字"], .creator input[aria-label*="名字"]'); if (el && el.value !== n) { el.value = n; el.dispatchEvent(new Event('input', { bubbles: true })); } }, nm); await p2.click('.creator > .btn.primary', { timeout: 3000 }).catch(() => {}); await p2.waitForTimeout(300); }
      };
      await create('阿海', 1);
      await p2.waitForSelector('.op16[data-step="people"]', { timeout: 15000 });
      for (const nm of ['小葉', '雲雲']) { await p2.tap('.op16 [data-op=add]'); await p2.waitForSelector('.creator .card', { timeout: 10000 }); await create(nm, 1); await p2.waitForSelector('.op16 .op16-person', { timeout: 10000 }); await p2.waitForTimeout(400); }
      const people = await p2.evaluate(() => OC.Chars.all().map((c) => [c.id, c.profile.name]));
      await p2.tap('.op16 [data-op=next]'); await p2.waitForSelector('.op16[data-step="roster"]');
      const [A, B, C] = people.map((x) => x[0]);
      for (const [id, age] of [[A, 35], [B, 8], [C, 34]]) { await p2.fill(`[data-age="${id}"]`, String(age)); }
      await p2.click(`[data-row="${B}"] [data-sp="robot"]`);
      const roster = await p2.evaluate(() => OC.Chars.all().map((c) => [c.profile.age, c.profile.species, OC.People.stage(c) && OC.People.stage(c).id]));
      await p2.tap('.op16 [data-op=next]'); await p2.waitForSelector('.op16[data-step="rel"]');
      const pairSel = (x, y) => `[data-pair="${x}:${y}"]`;
      await p2.click(pairSel(A, B)); await p2.waitForSelector('.sheet [data-kind="parent"]'); await p2.waitForTimeout(450);
      const loverOff = await p2.evaluate(() => document.querySelector('.sheet [data-kind="lover"]').disabled);
      await p2.click('.sheet [data-kind="parent"]'); await p2.waitForTimeout(200); await p2.click('.sheet [data-op="relok"]'); await p2.waitForTimeout(600);
      await p2.click(pairSel(A, C)); await p2.waitForSelector('.sheet [data-kind="spouse"]'); await p2.waitForTimeout(450);
      await p2.click('.sheet [data-kind="spouse"]'); await p2.fill('.sheet input[aria-label="背景故事"]', '在燈塔下第一次見面'); await p2.click('.sheet [data-op="relok"]'); await p2.waitForTimeout(600);
      await p2.click(pairSel(B, C)); await p2.waitForSelector('.sheet [data-kind="parent"]'); await p2.waitForTimeout(450);
      await p2.click('.sheet [data-kind="parent"]'); await p2.waitForTimeout(200); await p2.evaluate(() => { const b = [...document.querySelectorAll('.sheet .seg button, .sheet [role=tab]')]; const t = b.find((x) => x.textContent.startsWith('雲雲是')); if (t) t.click(); }); await p2.waitForTimeout(200); await p2.click('.sheet [data-op="relok"]'); await p2.waitForTimeout(600);
      await p2.screenshot({ path: 'deliverables/v16/9-relmap.png' });
      await p2.tap('.op16 [data-op=next]'); await p2.waitForSelector('.op16[data-step="home"]');
      await p2.click(`[data-move="${A}:yellow"]`); await p2.click(`[data-move="${C}:yellow"]`); await p2.waitForTimeout(200); await p2.click(`[data-move="${B}:yellow"]`); await p2.waitForTimeout(300);
      await p2.screenshot({ path: 'deliverables/v16/9-houses.png' });
      await p2.tap('.op16 [data-op=next]'); await p2.waitForFunction(() => !document.querySelector('.op16:not(.out)') && window.__ocReady === true, null, { timeout: 30000 });
      const r = await p2.evaluate(([a, b, c]) => {
        const M = OC.Mind, rel = (x, y) => M.relPeek(x, y) || {};
        return { ab: [rel(a, b).kind16, M.relLabel(rel(a, b)), rel(a, b).fixed], ba: M.relLabel(rel(b, a)), ac: [rel(a, c).type, rel(a, c).fixed], cb: M.relLabel(rel(c, b)), romance: OC.Mind.romanceOK(a, c), minor: OC.Mind.romanceOK(a, b), en: OC.Store.s.life.settings.romance.enabled,
          story: OC.Mind.memories(OC.Chars.get(c)).some((m) => m.text.includes('燈塔')), homes: [a, b, c].map((id) => OC.Chars.get(id).life.home16), yellow: OC.Homes.residents('yellow').length, grow: OC.Chars.get(a).life.age16 && OC.Chars.get(a).life.age16.grow };
      }, [A, B, C]);
      check('9a 開局可以建立多位島民（三位，每位用一般的創角流程）', people.length === 3, people);
      check('9b 島民名冊：年齡決定人生階段（35＝成人、8＝兒童），物種可選（機器人）；新角色預設生日自動長大', JSON.stringify(roster) === JSON.stringify([['35', 'cat', 'adult'], ['8', 'robot', 'child'], ['34', 'cat', 'adult']].map((x, i) => [x[0], i === 1 ? 'robot' : roster[i][1], x[2]])) && r.grow === 'auto', { roster, grow: r.grow });
      check('9c 關係圖：父母與孩子有方向（阿海看小葉＝孩子、小葉看阿海＝爸媽）、家人預設鎖定；伴侶有背景故事（兩人都記得）；未滿 18 歲的不能選戀人', r.ab[0] === 'parent' && r.ab[1] === '孩子' && r.ab[2] === true && r.ba === '爸媽' && r.cb === '孩子' && r.ac[0] === 'partner' && r.story && loverOff, r);
      check('9d 伴侶會為兩人打開戀愛功能；和小孩之間永遠不行', r.romance && r.en && !r.minor, r);
      check('9e 選房子：小屋最多 2 人（第三個人搬不進去），住處記在角色身上', r.homes[0] === 'yellow' && r.homes[2] === 'yellow' && r.homes[1] === 'coral' && r.yellow === 2, r);
      await p2.close();
    }
    if (want(10)) {
      const r = await page.evaluate(() => {
        const c = OC.Chars.all()[1], T = OC.Traits13, P = OC.People; const old = { sp: c.profile.species, age: c.profile.age };
        c.profile.species = 'human'; c.profile.age = '30'; const f0 = T.decay(c, 'food'), s0 = OC.Chars.behavior(c).speed;
        c.profile.species = 'bear'; const f1 = T.decay(c, 'food'), s1 = OC.Chars.behavior(c).speed;
        const u = P.addCustom({ zh: '雲朵族', base: 'sheep', food: 1.4, speed: 1.2 }); c.profile.species = u.id; const f2 = T.decay(c, 'food'), s2 = OC.Chars.behavior(c).speed, listed = OC.Chars.SPECIES.some((s) => s[0] === u.id);
        c.profile.species = 'human'; c.profile.age = '1'; const baby = { cook: P.canDo(c, 'cook'), eat: P.canDo(c, 'eat'), travel: P.canTravel(c), q: OC.Queue.add(c.id, 'cook'), h: P.heightOf(c) };
        c.profile.age = '15'; const teen = { minor: P.minor(c), work: P.canDo(c, 'work') }; c.profile.age = '70'; const elder = P.stage(c).zh;
        c.profile.species = old.sp; c.profile.age = old.age;
        return { n: P.all().length, f: [f0, f1, f2], s: [Math.round(s0), Math.round(s1), Math.round(s2)], listed, baby, teen, elder, stages: P.STAGES.map((x) => x[1]) };
      });
      check('10a 約 20 種物種＋自訂物種（列在物種清單裡）；物種會真的改變需求與走路速度（熊吃得多走得慢、自訂的照滑桿）', r.n >= 21 && r.listed && r.f[1] > r.f[0] && r.s[1] < r.s[0] && r.f[2] > r.f[0] && r.s[2] > r.s[0], r);
      check('10b 七個人生階段；嬰兒不能煮飯、不能自己去別的地方（玩家安排也會說明原因），可以吃；畫得比較小', r.stages.length === 7 && !r.baby.cook && r.baby.eat && !r.baby.travel && r.baby.q === 'young' && r.baby.h < 0.6, r);
      check('10c 青少年算未成年（不會有戀愛）、可以打工；70 歲是長者', r.teen.minor && r.teen.work && r.elder === '長者', r);
    }
    if (want(11)) {
      const r = await page.evaluate(() => {
        const S = OC.Store.s; S.settings.calendar = 'game'; const c = OC.Chars.all()[0], P = OC.People, today = OC.Clock.cal();
        c.profile.age = '12'; c.profile.birthday = OC.Clock.gameDayText(today.yd); c.life.age16 = { grow: 'auto' };
        (S.play.aged = {}); delete (S.ledger.keys || {})['bday:' + c.id + ':Y' + today.year];
        OC.Island.checkBirthdays(true); const a1 = c.profile.age; OC.Island.checkBirthdays(true); const a2 = c.profile.age;
        const mem = OC.Mind.memories(c).some((m) => m.text.includes('13 歲') && m.text.includes('青少年'));
        const d = OC.Chars.all()[1]; d.profile.age = '20'; d.profile.birthday = OC.Clock.gameDayText(today.yd); d.life.age16 = { grow: 'manual' }; OC.Island.checkBirthdays(true); const m1 = d.profile.age, letter = OC.Budget.box().some((x) => x.kind === 'birthday' && x.oc === d.id);
        const g = P.growUp(d, 'player'), m2 = d.profile.age, again = P.growUp(d, 'player');
        const e = OC.Chars.all()[2]; e.profile.age = '40'; e.profile.birthday = OC.Clock.gameDayText(today.yd); e.life.age16 = { grow: 'fixed' }; OC.Island.checkBirthdays(true);
        const old = JSON.parse(JSON.stringify(c)); delete old.life.age16; old.id = 'oldsave1'; old.profile.name = '舊'; S.chars[old.id] = OC.Chars.normalize(old); const oldGrow = P.age16(S.chars[old.id]).grow; delete S.chars[old.id];
        return { a1, a2, mem, m1, letter, g: g.ok, m2, again: again.ok, e: e.profile.age, oldGrow };
      });
      check('11a 生日自動長大：12 → 13 歲並進入青少年（一年一次，再叫一次不會再長）；留下回憶', r.a1 === '13' && r.a2 === '13' && r.mem, r);
      check('11b 「我按了才長大」：生日只寄一封信，按下才長一歲（一年一次）；「固定年齡」不變', r.m1 === '20' && r.letter && r.g && r.m2 === '21' && !r.again && r.e === '40', r);
      check('11c 舊存檔的角色不會突然自己長大（預設「我按了才長大」）', r.oldGrow === 'manual', r);
    }
    if (want(12)) {
      /* 16.2 the willingness model: nothing is locked, the answer depends on the other one */
      const r = await page.evaluate(() => {
        const fresh16 = (c) => { c.life.emo.list = []; c.life.emo.dom = 'neutral'; c.personality.traits = []; c.personality.social = 55; c.personality.expression = 55; c.profile.species = 'human'; c.profile.age = '25'; Object.assign(c.needs, { food: 90, sleep: 90, energy: 80, fun: 70, social: 60, comfort: 80, interest: 70, active: 70 }); c.life.w16 = { rej: {}, last: {} }; }; const [a, b] = OC.Chars.all(), W = OC.Will, M = OC.Mind; fresh16(a); fresh16(b); a.profile.age = '25'; b.profile.age = '24';
        const set = (v) => { for (const [x, y] of [[a, b], [b, a]]) Object.assign(M.rel(x.id, y.id), { fam: 0, aff: 0, trust: 10, intim: 0, conflict: 0 }, v); };
        set({}); const hugStranger = W.willing(b, a, 'hug').p, helloStranger = W.willing(b, a, 'hello').p;
        set({ fam: 85, aff: 85, trust: 75, intim: 60 }); const hugFriend = W.willing(b, a, 'hug').p;
        const shy0 = b.personality.traits.slice(); b.personality.traits = ['shy']; set({ fam: 30, aff: 30, trust: 30, intim: 5 }); const hugShy = W.willing(b, a, 'hug').p; b.personality.traits = []; const hugNotShy = W.willing(b, a, 'hug').p; b.personality.traits = shy0;
        set({ fam: 30, aff: 25, trust: 20 }); const p0 = W.willing(b, a, 'chat').p; b.life.emo.list = []; OC.Mind.feel(b, 'annoyed', 1, 'test'); b.life.emo.dom = 'annoyed'; const dom = OC.Mind.dominant(b), pAnn = W.willing(b, a, 'chat').p; b.life.emo.dom = 'neutral'; b.life.emo.list = [];
        W.inter('kisscheek'); const R = OC.Store.s.life.settings.romance; R.enabled = true; R.adult[a.id] = R.adult[b.id] = true; set({ fam: 80, aff: 85, trust: 70, intim: 75 }); const kissAdult = W.hint(b, a, 'kisscheek').face;
        b.profile.age = '15'; const kissMinor = W.hint(b, a, 'kisscheek').face, mOK = M.romanceOK(a.id, b.id); b.profile.age = '24'; R.enabled = false; const kissOff = W.hint(b, a, 'kisscheek').face;
        set({ fam: 20, aff: 20, trust: 20 }); a.life.w16 = { rej: {}, last: { [b.id]: { kind: 'hello', at: OC.Sim.now() } } }; const rep = W.willing(b, a, 'hello').p; a.life.w16.last = {}; const fresh = W.willing(b, a, 'hello').p;
        const reacts = new Set(); set({ fam: 30, aff: 20, trust: 20, intim: 0 }); for (let i = 0; i < 200; i++) { const roll = i / 200; reacts.add(W.react(b, a, 'hug', W.willing(b, a, 'hug').p, roll)); reacts.add(W.react(b, a, 'chat', W.willing(b, a, 'chat').p, roll)); reacts.add(W.react(b, a, 'shove', 0.3, roll)); }
        return { dom, n: Object.keys(W.INTER).length, cats: W.CATS.length, hugStranger, helloStranger, hugFriend, hugShy, hugNotShy, p0, pAnn, kissAdult, kissMinor, mOK, kissOff, rep, fresh, reacts: [...reacts] };
      });
      check('12a 60 種互動、12 類（16.3 起多一個「專屬」）；沒有鎖——和陌生人打招呼大概可以、抱陌生人幾乎一定被拒，和好朋友抱抱很樂意', r.n >= 60 && r.cats >= 12 && r.helloStranger > 0.4 && r.hugStranger < 0.1 && r.hugFriend > 0.8, r);
      check('12b 個性與心情會改變反應：害羞的更難接受太親近的事；心情不好時連聊天都不想', r.hugShy < r.hugNotShy && r.pAnn < r.p0 - 0.2, r);
      check('12c 硬規則：戀愛互動要戀愛開啟＋兩人都成年；未滿 18 歲永遠不行（🔒）', r.kissAdult !== '🔒' && r.kissMinor === '🔒' && !r.mOK && r.kissOff === '🔒', r);
      check('12d 一直做同樣的事會比較不想；反應不只接受／拒絕（光譜）', r.rep < r.fresh && r.reacts.length >= 6, r);
    }
    if (want(13)) {
      /* the social sheet with real taps: one that goes well, one that is too much too soon */
      const ids = await page.evaluate(() => { const fresh16 = (c) => { c.life.emo.list = []; c.life.emo.dom = 'neutral'; c.personality.traits = []; c.personality.social = 55; c.personality.expression = 55; c.profile.species = 'human'; c.profile.age = '25'; Object.assign(c.needs, { food: 90, sleep: 90, energy: 80, fun: 70, social: 60, comfort: 80, interest: 70, active: 70 }); c.life.w16 = { rej: {}, last: {} }; }; const all = OC.Chars.all(); all.forEach(fresh16); if (OC.World.area.id !== 'isle') OC.WorldUI.travel('isle', { instant: true }); all.forEach((c) => OC.Brain.setControl(c.id, 'manual')); OC.Store.s.life.settings.defy = 0; window.__done = []; OC.Store.on('will:done', (e) => window.__done.push(e)); OC.Chars.setActive(all[0].id); return all.map((c) => c.id); });
      await page.waitForTimeout(1500);
      const [A, B] = ids;
      const run = async (cat, kind, rel) => {
        await page.evaluate(() => { if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; });
        await page.evaluate(([a, b, v]) => { for (const [x, y] of [[a, b], [b, a]]) Object.assign(OC.Mind.rel(x, y), { fam: 0, aff: 0, trust: 10, intim: 0, conflict: 0 }, v); OC.Chars.get(b).life.emo.list = []; window.__done = []; const bb = OC.Brain.get(b); if (bb.st !== 'think') { bb.st = 'think'; } }, [A, B, rel]);
        await page.evaluate((b) => OC.LifeUI.socialSheet(b), B); await page.waitForSelector(`.sheet [data-cat="${cat}"]`); await page.waitForTimeout(450);
        await page.click(`.sheet [data-cat="${cat}"]`); await page.waitForTimeout(450); await page.click(`.sheet [data-int="${kind}"]`);
        await page.waitForFunction(() => window.__done.length > 0, null, { timeout: 90000 }).catch(() => {});
        return page.evaluate(([a, b]) => ({ done: window.__done[0], ab: OC.Mind.relPeek(b, a), mem: OC.Mind.memories(OC.Chars.get(b)).slice(0, 3).map((m) => m.text) }), [A, B]);
      };
      const good = await run('close', 'handhold16', { fam: 90, aff: 90, trust: 80, intim: 70 });
      const bad = await run('close', 'handhold16', { fam: 5, aff: 5, trust: 10, intim: 0 });
      check('13a 點別的角色 → 互動選單：你的角色走過去做，關係很好時對方開心接受、好感上升、留下回憶', good.done && good.done.ok && good.ab.aff > 90 && good.mem.some((t) => t.includes('牽了手')), good);
      check('13b 太快、太親近：對方拒絕（害羞閃躲／愣住…），好感下降、記住「突然」', bad.done && !bad.done.ok && bad.ab.aff < 5 && bad.mem.some((t) => t.includes('突然')), bad);
      const d = await page.evaluate(([a, b]) => { OC.Store.s.life.settings.defy = 1; const r1 = OC.Will.ask(a, b, 'hello', { player: true }); OC.Store.s.life.settings.defy = 0; return { r1 }; }, [A, B]);
      check('13c 小機率不照你的意思做（這裡設成 100%）：會說出原因，什麼都沒發生', d.r1.ok === false && d.r1.defy && d.r1.why.length > 2, d);
      const ai = await page.evaluate(([a, b]) => { OC.Brain.setControl(b, 'auto'); const bb = OC.Brain.get(b); const kinds = new Set(); for (let i = 0; i < 30; i++) for (const x of OC.Brain.candidates(bb)) if (x.kind === 'social') kinds.add(x.social); OC.Brain.setControl(b, 'manual'); return [...kinds].filter((k) => OC.Will.has(k)).length; }, [A, B]);
      check('13d 角色自己生活時也會選新的互動', ai >= 3, ai);
    }
    if (want(14)) {
      /* inviting someone to a bench (the action card's 「邀請誰一起」) */
      const r = await page.evaluate(async () => {
        if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6;
        const fresh16 = (c) => { c.life.emo.list = []; c.life.emo.dom = 'neutral'; c.personality.traits = []; c.personality.social = 55; c.personality.expression = 55; c.profile.species = 'human'; c.profile.age = '25'; Object.assign(c.needs, { food: 90, sleep: 90, energy: 80, fun: 70, social: 60, comfort: 80, interest: 70, active: 70 }); c.life.w16 = { rej: {}, last: {} }; }; const all = OC.Chars.all(), [a, b] = all; all.forEach(fresh16);
        if (OC.World.area.id !== 'isle') { OC.WorldUI.travel('isle', { instant: true }); await new Promise((res) => setTimeout(res, 2500)); }
        OC.Chars.setActive(a.id); await new Promise((res) => setTimeout(res, 800));
        { const pa = OC.App.player, bm = OC.App.actorOf(b.id); for (const bb of [OC.Brain.get(a.id), OC.Brain.get(b.id)]) { if (bb.st === 'do') OC.Brain.finish(bb, 't'); else if (bb.st === 'go') OC.Brain.abort(bb, 't'); } if (bm) { const q = OC.World.nearestWalkable(pa.x + 40, pa.y, 40); if (q) { bm.path = null; bm.x = q.x; bm.y = q.y; } } } for (const [x, y] of [[a, b], [b, a]]) Object.assign(OC.Mind.rel(x.id, y.id), { fam: 80, aff: 85, trust: 70, intim: 30, conflict: 0 });
        for (const c of [a, b]) Object.assign(c.needs, { energy: 40, comfort: 40, food: 90, sleep: 90 });
        const bench = OC.World.interacts.find((i) => i.type === 'bench'); const d = OC.App.describe(bench);
        const r = OC.Will.invite(a.id, b.id, 'rest', bench.at); const conv = OC.Brain.convs.find((x) => x.kind === 'with_rest');
        const t0 = Date.now(); while (Date.now() - t0 < 150000) { const c2 = OC.Brain.convs.find((x) => x.kind === 'with_rest'); if (c2 && c2.st === 'joint' && c2.started) break; await new Promise((res) => setTimeout(res, 500)); }
        const c3 = OC.Brain.convs.find((x) => x.kind === 'with_rest'), ba = OC.Brain.get(a.id), bb = OC.Brain.get(b.id);
        return { ok: r.ok, extra: d && (d.extra || []).map((e) => e.label), kind: conv && conv.kind, joint: c3 && c3.st, started: c3 && c3.started, slots: [ba.slot && ba.slot.k, bb.slot && bb.slot.k] };
      });
      check('14 設施可以邀請別人一起用：長椅的動作卡有「邀請誰一起」，對方答應後兩人坐在同一張長椅的兩個位子', r.ok && r.kind === 'with_rest' && r.started && r.slots[0] && r.slots[1] && r.slots[0] !== r.slots[1] && r.slots[0].split('#')[0] === r.slots[1].split('#')[0], r);
    }
    if (want(15)) {
      /* 16.2.1 drag freeze: real touch (CDP) — pick up, then set down / toss / throw; afterwards the character must walk again */
      const cdp = await page.context().newCDPSession(page);
      const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 })) });
      await page.evaluate(async () => { if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; if (OC.World.area.id !== 'isle') { OC.WorldUI.travel('isle', { instant: true }); await new Promise((r) => setTimeout(r, 2500)); } const all = OC.Chars.all(); OC.Chars.setActive(all[0].id); all.forEach((c) => OC.Brain.setControl(c.id, 'manual')); OC.UI.stack.slice().forEach(() => OC.UI.popLayer && OC.UI.popLayer()); window.__ocActFix = []; });
      await page.waitForTimeout(1500);
      const where = (id) => page.evaluate((id) => { const a = id ? OC.App.actorOf(id) : OC.App.player; const s = OC.App.screenOf(a); const top = OC.World.project(a.x, a.y, a.lvl || 0, a.gy - (a.lvl || 0) * OC.World.HY + 40 * (a.tk || 1)); return { x: Math.round(top.x), y: Math.round(top.y), s }; }, id);
      async function grabAndRelease(id, kind) {
        const p = await where(id); await T('touchStart', [[p.x, p.y]]);
        await page.waitForFunction((id) => { const a = id ? OC.App.actorOf(id) : OC.App.player; return a.act && a.act.action === 'drag'; }, id, { timeout: 15000 }).catch(() => {});
        if (kind === 'down') { await T('touchMove', [[p.x + 2, p.y + 1]]); await page.waitForTimeout(300); await T('touchEnd', []); }
        else { const n = 6, dx = kind === 'throw' ? 34 : 14; for (let i = 1; i <= n; i++) { await T('touchMove', [[p.x + i * dx, p.y - i * dx * 0.3]]); await page.waitForTimeout(16); } await T('touchEnd', []); }
      }
      const settled = (id) => page.waitForFunction((id) => { const a = id ? OC.App.actorOf(id) : OC.App.player; const b = OC.Brain.get((a.char && a.char().id) || OC.Store.s.activeId); return !OC.Touch.flying && !(a.act && a.act.action === 'drag') && !b.holds.has('drag'); }, id, { timeout: 30000 }).then(() => true).catch(() => false);
      const walks = async () => {
        /* tap the ground near the character (up to 3 spots: the first one may land on a tree or a mate) — it must start walking */
        for (let k = 0; k < 3; k++) {
          const g = await page.evaluate((k) => { const p = OC.App.player; const offs = [[70, 25], [-70, -25], [70, -25], [-70, 25], [0, 60], [0, -60], [40, 0], [-40, 0]]; let q = null, n = 0;
            for (const [dx, dy] of offs) { const c = OC.World.nearestWalkable(p.x + dx, p.y + dy, 30); if (c && Math.hypot(c.x - p.x, c.y - p.y) > 35 && n++ === k) { q = c; break; } }
            if (!q) return null; const s = OC.World.project(q.x, q.y, OC.World.levelAt(q.x, q.y), 0); window.__w0 = { x: p.x, y: p.y }; return { x: s.x, y: s.y }; }, k);
          if (!g) { console.log('  no target', JSON.stringify(await page.evaluate(() => { const p = OC.App.player; let n = 0; for (let dx = -100; dx <= 100; dx += 10) for (let dy = -100; dy <= 100; dy += 10) if (OC.World.walkable(p.x + dx, p.y + dy)) n++; return { x: p.x, y: p.y, w: OC.World.walkable(p.x, p.y), n, lvl: p.lvl, area: OC.World.area.id }; }))); continue; } await page.touchscreen.tap(g.x, g.y);
          const ok = await page.waitForFunction(() => { const p = OC.App.player; return Math.hypot(p.x - window.__w0.x, p.y - window.__w0.y) > 20; }, null, { timeout: 20000 }).then(() => true).catch(() => false);
          if (ok) return true;
          console.log('  walk diag', JSON.stringify(await page.evaluate(() => { const p = OC.App.player, b = OC.Brain.get(OC.Store.s.activeId); return { act: p.act, path: p.path, st: b.st, holds: [...b.holds], ui: OC.UI.stack.length, pick: OC.Pick && OC.Pick.open_ }; })));
          await page.evaluate(() => { OC.Pick && OC.Pick.close && OC.Pick.close(); }); await page.waitForTimeout(500);
        }
        return false; };
      const res = {};
      for (const kind of ['down', 'toss', 'throw']) { await grabAndRelease(null, kind); res[kind] = { settled: await settled(null) }; await page.waitForTimeout(1500); res[kind].walks = await walks(); await page.waitForTimeout(800); }
      check('15a 拖曳後放下、輕拋、用力丟出去：落地後動作結束、不再被保留，點地面就會走（真實觸控）', ['down', 'toss', 'throw'].every((k) => res[k].settled && res[k].walks), res);
      /* throw one, grab another while the first is still in the air */
      const ids = await page.evaluate(() => { const all = OC.Chars.all(); const p = OC.App.player, m = OC.App.actorOf(all[1].id); if (m) { let q = null; for (const [dx, dy] of [[-60, 0], [60, 0], [0, 50], [0, -50], [-45, 30], [45, -30]]) { q = OC.World.nearestWalkable(p.x + dx, p.y + dy, 30); if (q && Math.hypot(q.x - p.x, q.y - p.y) > 35) break; q = null; } if (q) { m.path = null; m.x = q.x; m.y = q.y; } } return [all[0].id, all[1].id]; });
      await page.waitForTimeout(1200);
      await grabAndRelease(null, 'throw'); const p2 = await where(ids[1]); await T('touchStart', [[p2.x, p2.y]]);
      await page.waitForFunction(() => !OC.Touch.flying, null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(600); await T('touchEnd', []);
      const both = (await settled(null)) && (await settled(ids[1]));
      const st = await page.evaluate((ids) => ids.map((id) => { const a = OC.App.actorOf(id); return { act: a.act && a.act.action, holds: [...OC.Brain.get(id).holds] }; }), ids);
      check('15b 丟出一個、它還在空中時抓起另一個：兩個都正常結束（不會結束錯的那個）', both && st.every((s) => s.act !== 'drag' && !s.holds.includes('drag')), st);
      const wd = await page.evaluate(async () => { const a = OC.App.player; OC.World.setAction(a, 'drag', { priority: 9 }); await new Promise((r) => setTimeout(r, 5000)); return { act: a.act && a.act.action, fixed: window.__ocActFix || [] }; });
      check('15c 安全網：沒有擁有者的無限期高優先動作（會擋住走路）2 秒後自動結束', wd.act !== 'drag' && wd.fixed.includes('drag'), wd);
    }
    /* ============================== 16.3 the character studio ============================== */
    const PIC = `(async () => { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 400; const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 300, 400);
      g.fillStyle = '#e8a080'; g.beginPath(); g.ellipse(150, 220, 90, 150, 0, 0, 7); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(120, 180, 16, 0, 7); g.arc(180, 180, 16, 0, 7); g.fill();
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png')); const c = OC.Chars.blank('import'); await OC.Library.spriteCharFromFiles(c, [new File([blob], 'pic.png', { type: 'image/png' })], { cut: false, quiet: true }); c.profile.name = '圖片角色'; c.status.onIsland = true; OC.Chars.add(c); await OC.Anim.preload(OC.Anim.get(c.actions.idle.any)); return c.id; })()`;
    if (want(16)) {
      await page.evaluate(() => { OC.UI.stack.slice().forEach(() => OC.UI.back && OC.UI.back()); });
      const r = await page.evaluate(async () => {
        OC.Pages.open('charedit', { id: OC.Chars.all()[0].id }); await new Promise((res) => setTimeout(res, 1500));
        const pg = document.querySelector('.page.open[data-page=charedit]'), panel = pg.querySelector('.st-panel'), top0 = pg.querySelector('.st-top').getBoundingClientRect().top, tabs0 = pg.querySelector('.st-tabs').getBoundingClientRect().top;
        panel.scrollTop = 1200; await new Promise((res) => setTimeout(res, 400));
        const top1 = pg.querySelector('.st-top').getBoundingClientRect().top, tabs1 = pg.querySelector('.st-tabs').getBoundingClientRect().top;
        const rigTabs = [...pg.querySelectorAll('.st-tab')].map((b) => b.dataset.tab);
        return { pageScroll: pg.scrollTop, fits: pg.scrollHeight <= pg.clientHeight + 1, panelScrolls: panel.scrollTop > 600, top: [top0, top1], tabs: [tabs0, tabs1], rigTabs };
      });
      check('16a 編輯頁分成兩區：角色舞台和分頁固定不動，只有下面的面板捲動（不再跑版）', r.pageScroll === 0 && r.fits && r.panelScrolls && Math.abs(r.top[0] - r.top[1]) < 1 && Math.abs(r.tabs[0] - r.tabs[1]) < 1, r);
      const pid = await page.evaluate(PIC);
      const r2 = await page.evaluate(async (id) => { OC.Pages.open('charedit', { id }); await new Promise((res) => setTimeout(res, 1500)); const pg = document.querySelector('.page.open[data-page=charedit]'); return { tabs: [...pg.querySelectorAll('.st-tab')].map((b) => b.dataset.tab), table: !!pg.querySelector('.fr-table canvas') }; }, pid);
      check('16b 圖片角色有自己的分頁：「圖片」取景台＋動畫，沒有捏臉（外觀／臉／耳朵／顏色）', r2.tabs[0] === 'frame' && r2.tabs.includes('anims') && !r2.tabs.includes('look') && r2.table, r2.tabs);
      /* real touch on the framing table: one finger moves, two fingers zoom */
      const cdp = await page.context().newCDPSession(page);
      const box = await page.evaluate(() => { const r = document.querySelector('.page.open .fr-table canvas').getBoundingClientRect(); const p = OC.Pages.pages.charedit; const g = p.table.geo(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + (g.rect.x0 + g.rect.x1) / 2, cy: r.top + (g.rect.y0 + g.rect.y1) / 2, f0: JSON.parse(JSON.stringify(p.draft.appearance.frame || {})) }; });
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
      await touch('touchStart', [[box.cx, box.cy]]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[box.cx + i * 6, box.cy - i * 3]]); await page.waitForTimeout(16); } await touch('touchEnd', []);
      const mv = await page.evaluate(() => JSON.parse(JSON.stringify(OC.Pages.pages.charedit.draft.appearance.frame)));
      await touch('touchStart', [[box.cx - 30, box.cy], [box.cx + 30, box.cy]]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[box.cx - 30 - i * 8, box.cy], [box.cx + 30 + i * 8, box.cy]]); await page.waitForTimeout(16); } await touch('touchEnd', []);
      const zm = await page.evaluate(() => JSON.parse(JSON.stringify(OC.Pages.pages.charedit.draft.appearance.frame)));
      check('16c 取景台（真實觸控）：單指拖曳移動、兩指撐開放大；只改 frame，不改原圖', mv.dx > 5 && mv.dy < -2 && zm.zoom > 1.3, { mv, zm });
      await page.evaluate(() => { OC.Pages.pages.charedit.dirty = false; OC.UI.back(); });
    }
    if (want(17)) {
      const r = await page.evaluate(async () => {
        /* white page, white eyes inside a body: an edge flood keeps the eyes; the old colour key erased them */
        const cv = document.createElement('canvas'); cv.width = 200; cv.height = 240; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 200, 240); g.fillStyle = '#d08060'; g.beginPath(); g.ellipse(100, 130, 70, 100, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(80, 110, 12, 0, 7); g.arc(120, 110, 12, 0, 7); g.fill();
        const det = OC.Cutout.detect(cv), out = OC.Cutout.remove(cv, {}), A = (k, x, y) => k.getContext('2d').getImageData(x, y, 1, 1).data[3];
        const old = OC.IO.keyOut(OC.Cutout.clone(cv));
        /* a closed gap: a ring with white inside, then the wand clears it */
        const cv2 = document.createElement('canvas'); cv2.width = 120; cv2.height = 120; const g2 = cv2.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, 120, 120); g2.strokeStyle = '#333'; g2.lineWidth = 14; g2.beginPath(); g2.arc(60, 60, 35, 0, 7); g2.stroke();
        const ring = OC.Cutout.remove(cv2, {}), ringW = OC.Cutout.wand(ring, 60, 60, 42);
        return { det: det.has, corner: A(out, 2, 2), eye: A(out, 80, 110), body: A(out, 100, 180), oldEye: A(old, 80, 110), hole: A(ring, 60, 60), holeW: A(ringW, 60, 60), ringKeep: A(ringW, 60, 26) };
      });
      check('17a 去背只去掉跟邊緣相連的背景：角色身上同顏色的眼白留著（舊的顏色鍵會一起去掉）', r.det && r.corner === 0 && r.eye === 255 && r.body === 255 && r.oldEye < 255, r);
      check('17b 圍起來的空隙用「點一下」去掉，線條本身不受影響', r.hole === 255 && r.holeW === 0 && r.ringKeep === 255, r);
      const r2 = await page.evaluate(async (src) => {
        const id = await eval(src), c = OC.Chars.get(id), doc = OC.Anim.get(c.actions.idle.any), before = doc.layers[0].cells.slice();
        const n = await OC.Frame16.applyCut(c, { tol: 42, seeds: [], on: true }); const after = OC.Anim.get(c.actions.idle.any).layers[0].cells.slice();
        await OC.Anim.preload(OC.Anim.get(c.actions.idle.any)); const img = OC.Anim.composite(OC.Anim.get(c.actions.idle.any), 0); const cornerA = img.getContext('2d').getImageData(12, 12, 1, 1).data[3];
        const fit = OC.Frame16.autoFit(c), f = JSON.parse(JSON.stringify(c.appearance.frame));
        const back = OC.Frame16.revertCut(c), reverted = OC.Anim.get(c.actions.idle.any).layers[0].cells.slice();
        return { n, changed: before[0] !== after[0], cornerA, fit, f, back, same: reverted[0] === before[0] };
      }, PIC);
      check('17c 已有的圖片角色：去背處理所有影格（存成新圖），原圖保留，可以「還原原圖」', r2.n >= 1 && r2.changed && r2.cornerA === 0 && r2.back >= 1 && r2.same, r2);
      check('17d 「自動對齊」：可見部分調成標準高度、腳底對齊（設定放大與位移，不裁切）', r2.fit && Math.abs(r2.f.zoom - 1) > 0.02 && r2.f.dy !== 0 && !(r2.f.crop && (r2.f.crop.t || r2.f.crop.b)), r2.f);
      const r3 = await page.evaluate(async () => {
        const c = OC.Chars.all().find((x) => x.profile.name === '圖片角色'), cv = document.createElement('canvas'); cv.width = 80; cv.height = 120; cv.getContext('2d').fillRect(10, 10, 60, 100);
        const { doc } = await OC.Library.makeAnim([cv], { name: '行走', owner: c.id, action: 'walk' }); c.actions.walk = { any: doc.id };
        const R = OC.CharRender, P = OC.Puppet, out = {};
        for (const [k, a16] of [['mixed', { src: 'mixed', preset: {} }], ['mixedForced', { src: 'mixed', preset: { walk: true } }], ['preset', { src: 'preset', preset: {} }], ['custom', { src: 'custom', preset: {} }]]) {
          c.appearance.anim16 = a16; const sw = R.spriteFor(c, { action: 'walk' }), sj = R.spriteFor(c, { action: 'jump' });
          out[k] = { walk: sw.action, jumpPuppet: P.active(c, sj, { action: 'jump' }) };
        }
        c.appearance.anim16 = null; return out;
      });
      check('17e 動畫來源：混合＝有自己的走路就用、沒有的（跳）由圖片表演；單一動作可改回預設；全部預設＝都由圖片表演；全部自己匯入＝不用預設表演', r3.mixed.walk === 'walk' && r3.mixed.jumpPuppet && r3.mixedForced.walk === 'idle' && r3.preset.walk === 'idle' && r3.custom.walk === 'walk' && !r3.custom.jumpPuppet, r3);
      const r4 = await page.evaluate(async () => {
        const c = OC.Chars.all().find((x) => x.profile.name === '圖片角色'); OC.Pages.open('charedit', { id: c.id, tab: 'anims' }); await new Promise((res) => setTimeout(res, 1200));
        const pg = document.querySelector('.page.open[data-page=charedit]'); pg.querySelector('[data-bulk=all]').click(); await new Promise((res) => setTimeout(res, 200));
        pg.querySelector('[data-bulk=preset]').click(); await new Promise((res) => setTimeout(res, 200));
        const d = OC.Pages.pages.charedit.draft, n = Object.keys((d.appearance.anim16 || {}).preset || {}).length, total = OC.Chars.ACTIONS.filter((a) => a[2] !== 'overlay').length;
        const g = OC.Studio16.groupFiles([{ name: 'walk_01.png' }, { name: 'walk_02.png' }, { name: 'jump.gif' }, { name: '行走3.png' }, { name: 'hello.png' }].map((x) => new File([new Uint8Array(4)], x.name)));
        OC.Pages.pages.charedit.dirty = false; OC.UI.back();
        return { n, total, groups: g.map((x) => [x.act, x.files.length]) };
      });
      check('17f 一鍵全選：勾選全部動作 → 「改用預設」一次套用到全部', r4.n === r4.total && r4.total > 20, { n: r4.n, total: r4.total });
      check('17g 批次匯入用檔名對應動作（walk_01、walk_02、行走3 → 走路；jump.gif → 跳；認不出來的另外選）', JSON.stringify(r4.groups) === JSON.stringify([['walk', 3], ['jump', 1], [null, 1]]), r4.groups);
    }
    if (want(18)) {
      const r = await page.evaluate(async () => {
        const [a, b] = OC.Chars.all(); a.lines16 = [{ id: 't1', cat: 'greet', text: '喲，{other}，今天也在。' }]; a.updated = Date.now();
        const said = new Set(); a.lines16mode = { greet: 'only' }; for (let i = 0; i < 12; i++) { OC.Store.s.life.said[a.id] = {}; const l = OC.Talk.say('greet', a, b); if (l) said.add(l.text); }
        a.lines16mode = {}; const mix = new Set(); for (let i = 0; i < 30; i++) { OC.Store.s.life.said[a.id] = {}; const l = OC.Talk.say('greet', a, b); if (l) mix.add(l.text.includes('今天也在') ? 'own' : 'builtin'); }
        const other = new Set(); for (let i = 0; i < 12; i++) { OC.Store.s.life.said[b.id] = {}; const l = OC.Talk.say('greet', b, a); if (l && l.text.includes('今天也在')) other.add('leak'); }
        /* the studio: open 台詞, add a line through the real buttons, save */
        const until = async (fn, ms = 8000) => { const t0 = Date.now(); let v; while (!(v = fn()) && Date.now() - t0 < ms) await new Promise((res) => setTimeout(res, 100)); return v; };
        OC.Pages.open('charedit', { id: b.id, tab: 'lines' }); await new Promise((res) => setTimeout(res, 600)); const pg = document.querySelector('.page.open[data-page=charedit]');
        (await until(() => pg.querySelector('[data-cat=bye]'))).click();
        (await until(() => pg.querySelector('[data-add=bye]'))).click();
        const inp = await until(() => pg.querySelector('.ln16-body .ln16-line input')); inp.value = '我先走囉。'; inp.dispatchEvent(new Event('change')); pg.querySelector('[data-act=save]').click(); await new Promise((res) => setTimeout(res, 300)); OC.UI.back();
        return { only: [...said], mix: [...mix], leak: [...other], saved: (OC.Chars.get(b.id).lines16 || []).map((l) => l.cat + ':' + l.text) };
      });
      check('18a 角色自己的台詞：「只用我寫的」時只說自己的（套用說話方式），混合時兩種都會出現；別的角色不會說', r.only.length >= 1 && r.only.every((t) => t.includes('今天也在')) && r.mix.includes('own') && r.mix.includes('builtin') && !r.leak.length, r);
      check('18b 在工作室「台詞」分頁新增一句（真實按鈕）→ 存到角色身上', r.saved.includes('bye:我先走囉。'), r.saved);
    }
    if (want(19)) {
      const r = await page.evaluate(async () => {
        if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; OC.Store.s.life.settings.defy = 0;
        if (OC.World.area.id !== 'isle') { OC.WorldUI.travel('isle', { instant: true }); await new Promise((res) => setTimeout(res, 2500)); }
        const all = OC.Chars.all().filter((c) => c.appearance.mode !== 'sprite'), a = all[0]; OC.Chars.setActive(a.id); await new Promise((res) => setTimeout(res, 1000));
        const b = all.find((c) => c.id !== a.id && OC.App.actorOf(c.id)) || all[1];
        for (const c of [a, b]) { c.life.emo.list = []; c.life.emo.dom = 'neutral'; c.profile.age = '25'; Object.assign(c.needs, { food: 90, sleep: 90, energy: 80, fun: 70, social: 60, comfort: 80 }); }
        a.inter16 = [{ id: 'heart', zh: '比心', ic: '🫶', tone: 'warm', intim: 0.1, animA: 'wave', animB: 'happy', rel: { aff: 4 }, mem: '{other}對我比了一個心', lines: { ask: ['給你一個心。'], yes: ['收到了，謝謝。'], no: [] } }];
        OC.Chars.save(a); OC.Will.sync(); const kind = OC.Will.customKind(a, a.inter16[0]);
        const notOwner = OC.Will.ask(b.id, a.id, kind, { player: true });
        if (OC.World.area.id !== 'isle') { OC.WorldUI.travel('isle', { instant: true }); await new Promise((res) => setTimeout(res, 2500)); }
        OC.Chars.setActive(a.id); await new Promise((res) => setTimeout(res, 800));
        { const pa = OC.App.actorOf(a.id), bm = OC.App.actorOf(b.id); for (const bb of [OC.Brain.get(a.id), OC.Brain.get(b.id)]) { if (bb.st === 'do') OC.Brain.finish(bb, 't'); else if (bb.st === 'go') OC.Brain.abort(bb, 't'); } if (bm && pa) { const q = OC.World.nearestWalkable(pa.x + 40, pa.y, 40); if (q) { bm.path = null; bm.x = q.x; bm.y = q.y; } } }
        for (const [x, y] of [[a, b], [b, a]]) Object.assign(OC.Mind.rel(x.id, y.id), { fam: 80, aff: 70, trust: 60, intim: 30, conflict: 0 });
        const aff0 = OC.Mind.relPeek(b.id, a.id).aff; const bubbles = []; const ob = new MutationObserver(() => document.querySelectorAll('.speech').forEach((e) => bubbles.push(e.textContent))); ob.observe(document.body, { childList: true, subtree: true, characterData: true });
        let done = null; const off = OC.Store.on('will:done', (e) => { if (e.kind === kind) done = e; });
        if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; for (const id of [a.id, b.id]) { const bb = OC.Brain.get(id); [...bb.holds].forEach((x) => OC.Brain.unhold(id, x)); if (bb.conv) OC.Brain.Social.end(bb.conv, 't'); if (bb.invited && OC.Brain.convs.includes(bb.invited)) OC.Brain.Social.end(bb.invited, 't'); bb.invited = null; bb.queued = null; }
        const aff1 = OC.Mind.relPeek(b.id, a.id).aff;
        let ok = OC.Will.ask(a.id, b.id, kind, { player: true });
        for (let k = 0; k < 6 && !ok.ok && /特別的事|在忙|說話/.test(ok.why || ''); k++) { if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; for (const id of [a.id, b.id]) { const bx = OC.Brain.get(id); [...bx.holds].forEach((x) => OC.Brain.unhold(id, x)); if (bx.conv) OC.Brain.Social.end(bx.conv, 't'); } await new Promise((res) => setTimeout(res, 300)); ok = OC.Will.ask(a.id, b.id, kind, { player: true }); }   /* a built-in event may start in between */
        const t0 = Date.now(); while (!done && Date.now() - t0 < 120000) await new Promise((res) => setTimeout(res, 400)); ob.disconnect();
        return { notOwner, ok, done, kind, inMenu: OC.Will.INTER[kind] && OC.Will.INTER[kind].own === a.id, aff: [aff1, OC.Mind.relPeek(b.id, a.id).aff], said: [...new Set(bubbles)].filter((t) => /心|收到/.test(t)).slice(0, 4) };
      });
      check('19a 專屬互動登記到互動選單（「專屬」），只有擁有者能做', r.inMenu && r.notOwner.ok === false, r.notOwner);
      check('19b 做專屬互動：對方用意願模型回應，用你寫的台詞，答應時關係照設定變化', r.ok.ok && r.done && (r.done.ok ? r.aff[1] > r.aff[0] : true) && r.said.length >= 1, r);
    }
    if (want(20)) {
      const r = await page.evaluate(async () => {
        const bad = OC.Script.compile('event a "x"\nwhen nope 3\n---\nsay A hi\ngoto nowhere\n');
        /* 300 events in one JSON file — no limit */
        const scripts = []; for (let i = 0; i < 300; i++) scripts.push({ src: `event e${i} "第${i}個"\ntrigger manual\ncast A = any\n---\nsay A "第${i}個事件"\n` });
        const pf = OC.Script.parseFile(JSON.stringify({ format: 'ocshimeji-script', scripts }));
        const before = OC.Script.lib().length; for (const it of pf.items) OC.Script.lib().push({ id: 'x' + Math.random(), src: it.src, on: true }); OC.Script.reset();
        const n = OC.Script.all().filter((e) => e.trigger === 'manual').length;
        OC.Script.lib().splice(before); OC.Script.reset();
        /* a tick event that waits for a variable */
        if (OC.Events.current) OC.Events.end('t'); const [a] = OC.Chars.all(); OC.Store.s.life.vars16 = OC.Store.s.life.vars16 || {}; delete OC.Store.s.life.vars16.gate; OC.Store.s.life.ev.lastAny = 0;
        a.scripts16 = [{ id: 'g1', on: true, src: `event gate "門打開了"\ntrigger tick\ncast A = self\nwhen var gate >= 1\nonce\n---\nsay A "好了。"\nset var gate 2\n` }]; OC.Chars.save(a); OC.Script.reset();
        const t0 = Date.now(); while (Date.now() - t0 < 12000) { await new Promise((res) => setTimeout(res, 500)); } const early = OC.Store.s.life.vars16.gate || 0;
        OC.Store.s.life.vars16.gate = 1; OC.Store.s.life.ev.lastAny = 0; OC.Chars.all().forEach((c) => { const bb = OC.Brain.get(c.id); if (bb && bb.holds.size) [...bb.holds].forEach((h) => OC.Brain.unhold(c.id, h)); });
        const t1 = Date.now(); while (Date.now() - t1 < 160000 && OC.Store.s.life.vars16.gate !== 2) { OC.Store.s.life.ev.lastAny = 0; await new Promise((res) => setTimeout(res, 500)); }
        const ran = OC.Store.s.life.vars16.gate;
        const dbg20 = { cur: OC.Events.current && (OC.Events.current.id || OC.Events.current.ev && OC.Events.current.ev.id), st: OC.Brain.get(a.id) && OC.Brain.get(a.id).st, holds: OC.Brain.get(a.id) ? [...OC.Brain.get(a.id).holds] : null, loc: a.life.loc, area: OC.World.area.id, hidden: OC.App.actorOf(a.id) ? OC.App.actorOf(a.id).hidden : 'noactor', budget: OC.Budget && OC.Budget.can && OC.Budget.can('event') };
        /* .ocpack round trip keeps the studio data */
        a.lines16 = [{ id: 'l1', cat: 'greet', text: '喲。' }]; a.inter16 = [{ id: 'x1', zh: '擊拳', lines: { ask: ['來。'] } }]; OC.Chars.save(a);
        const blob = await OC.IO.exportPack({ chars: [a.id] }); const pack = await OC.IO.readPack(await blob.arrayBuffer()); const res = await OC.IO.applyPack(pack, 'new'); const c2 = res.chars[0];
        return { dbg20, bad: bad.errors.map((e) => e.line + ':' + e.msg), n, early, ran, packed: { s: (c2.scripts16 || []).length, l: (c2.lines16 || []).length, i: (c2.inter16 || []).length } };
      });
      check('20a 腳本錯誤會說第幾行、哪裡錯（看不懂的條件、沒有引號、找不到標籤）', r.bad.some((x) => x.startsWith('2:')) && r.bad.some((x) => x.startsWith('4:')) && r.bad.some((x) => x.startsWith('5:')), r.bad);
      check('20b 不限數量：一個檔案匯入 300 個事件，全部可用', r.n >= 300, r.n);
      check('20c 條件成立才發生：變數 gate 還是 0 時不會演，設成 1 之後角色自己演出並把它改成 2', r.early === 0 && r.ran === 2, r);
      check('20d .ocpack 匯出再匯入：角色的事件、台詞、專屬互動都在', r.packed.s === 1 && r.packed.l === 1 && r.packed.i === 1, r.packed);
    }
    if (want(21)) {
      /* the creator's real import path: file chooser → background sheet (applied) → the look step shows the framing table */
      const png = await page.evaluate(async () => { const cv = document.createElement('canvas'); cv.width = 240; cv.height = 300; const g = cv.getContext('2d'); g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 240, 300); g.fillStyle = '#6a8fd0'; g.beginPath(); g.ellipse(120, 170, 70, 110, 0, 0, 7); g.fill(); return cv.toDataURL('image/png').split(',')[1]; });
      const fs = require('fs'), path = require('path'), file = path.join(require('os').tmpdir(), 'oc16-import.png'); fs.writeFileSync(file, Buffer.from(png, 'base64'));
      await page.evaluate(() => { OC.UI.stack.slice().forEach(() => OC.UI.back && OC.UI.back()); window.__cr = OC.Creator.start({}); });
      await page.waitForSelector('.creator .cr-choice', { timeout: 15000 });
      const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.evaluate(() => [...document.querySelectorAll('.creator .cr-choice')].find((b) => b.textContent.includes('匯入圖片')).click())]);
      await fc.setFiles(file);
      const sheet = await page.waitForSelector('.fr-cut', { timeout: 30000 }).then(() => true).catch(() => false);
      await page.screenshot({ path: 'deliverables/v16/21-cut.png' }).catch(() => {});
      if (sheet) await page.evaluate(() => [...document.querySelectorAll('.fr-cut button')].find((b) => b.textContent.includes('套用')).click());
      await page.waitForFunction(() => !document.querySelector('.fr-cut'), null, { timeout: 30000 }).catch(() => {});
      await page.evaluate(() => [...document.querySelectorAll('.creator button')].find((b) => b.textContent.trim() === '下一步').click());
      const look = await page.waitForSelector('.creator .cr-frame .fr-table canvas', { timeout: 20000 }).then(() => true).catch(() => false);
      await page.waitForTimeout(800); await page.screenshot({ path: 'deliverables/v16/21-look.png' }).catch(() => {});
      const st = await page.evaluate(() => { const body = document.querySelector('.creator'); return { acts: [...body.querySelectorAll('.fr-act small')].map((x) => x.textContent), face: /眼睛|耳朵|嘴巴/.test(body.textContent) }; });
      check('21 創角匯入圖片：選檔 → 去背畫面（預覽、容許度、點掉空隙）→ 外觀步驟是取景台＋自動對齊／翻轉／裁切／重設，沒有捏臉選項', sheet && look && st.acts.includes('自動對齊') && !st.face, { sheet, look, st });
      await page.evaluate(() => { const b = document.querySelector('.creator [aria-label=取消]'); if (b) b.click(); }); await page.waitForTimeout(500);
      await page.evaluate(() => { const b = [...document.querySelectorAll('.sheet button')].find((x) => x.textContent.includes('取消建立')); if (b) b.click(); });
    }
    /* ============================== 16.4 menus and the action list ============================== */
    const calm16 = () => page.evaluate(async () => { OC.UI.stack.slice().forEach(() => OC.UI.back && OC.UI.back()); if (OC.Radial.open_) OC.Radial.close(true); if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; if (OC.World.area.id !== 'isle') { OC.WorldUI.travel('isle', { instant: true }); await new Promise((r) => setTimeout(r, 2500)); } const all = OC.Chars.all().filter((c) => c.appearance.mode !== 'sprite'); OC.Chars.setActive(all[0].id); await new Promise((r) => setTimeout(r, 800)); for (const c of all) { OC.Brain.setControl(c.id, 'manual'); OC.Queue.clear(c.id); OC.Queue.cancel(c.id, -1); c.life.q16 = []; const bb = OC.Brain.get(c.id); if (bb) { bb.queued = null; bb.queuedSlot = null; bb.queuedPt = null; } if (bb) { [...bb.holds].forEach((x) => OC.Brain.unhold(c.id, x)); if (bb.st === 'do') OC.Brain.finish(bb, 't'); else if (bb.st === 'go') OC.Brain.abort(bb, 't'); } Object.assign(c.needs, { food: 60, sleep: 70, energy: 70, fun: 50, social: 50, comfort: 60, interest: 50, active: 50 }); } return all.map((c) => c.id); });
    if (want(22)) {
      const ids = await calm16();
      const r = await page.evaluate(async (id) => {
        const Q = OC.Queue, out = {}; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        out.adds = []; for (const a of ['stretch', 'daydream', 'spin', 'dance', 'diary', 'meditate', 'workout', 'photo', 'sweep', 'read']) out.adds.push(Q.add(id, a));
        out.len = Q.list(id).length;
        const before = Q.list(id).map((x) => x.act); out.moved = Q.move(id, 3, 1); out.afterMove = Q.list(id).map((x) => x.act);
        out.loop = Q.loop(id, 2, true); out.looped = Q.list(id).filter((x) => x.loop).map((x) => x.act);
        out.nowOk = Q.now(id, 4); await sleep(30); out.afterNow = Q.list(id).slice(0, 2).map((x) => x.act + ':' + x.state);
        Q.clear(id); Q.cancel(id, -1); await sleep(300);
        /* refusal with a reason, then 強迫 */
        const c = OC.Chars.get(id); c.needs.food = 97; Q.add(id, 'eat'); await sleep(1500); const ref = Q.list(id)[0]; out.refused = ref && ref.state + ':' + ref.why;
        Q.add(id, 'stretch'); const seen = new Set(); for (let i = 0; i < 40; i++) { for (const x of Q.list(id)) seen.add(x.act + ':' + x.state); const b0 = OC.Brain.get(id); if (b0.act === 'stretch') seen.add('stretch:' + b0.st); await sleep(100); } out.notBlocked = [...seen];
        Q.clear(id); Q.cancel(id, -1); OC.Chars.get(id).life.q16 = []; await sleep(300);
        c.needs.food = 97; Q.add(id, 'eat'); let rf = null; for (let i = 0; i < 40 && !rf; i++) { if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; await sleep(100); rf = Q.list(id).find((x) => x.state === 'refused'); }   /* an event that starts here makes the list wait (not refuse) — keep events out of this step */ out.forced = rf ? Q.force(id, rf.n) : false; const b = OC.Brain.get(id); { const seenF = []; for (let i = 0; i < 25; i++) { const s1 = b.act + ':' + b.st; if (!seenF.includes(s1)) seenF.push(s1); if (/^eat:(go|do)$/.test(s1)) break; await sleep(100); } out.forcedAct = seenF.find((x) => /^eat:(go|do)$/.test(x)) || seenF.join(','); }   /* 16.5: watch the whole window — a short meal (or an urgent need, brain.js「急需」) can end it before a single late look */
        Q.clear(id); Q.cancel(id, -1); OC.Chars.get(id).life.q16 = []; { const bq = OC.Brain.get(id); bq.queued = null; if (bq.st === 'do') OC.Brain.finish(bq, 't'); else if (bq.st === 'go') OC.Brain.abort(bq, 't'); } await sleep(300);
        /* this bench, not any bench */
        const benches = OC.Brain.aff.filter((o) => o.kind === 'bench'); const far = benches.sort((a, b2) => Math.hypot(b2.x - OC.App.player.x, b2.y - OC.App.player.y) - Math.hypot(a.x - OC.App.player.x, a.y - OC.App.player.y))[0];
        const want = far.slots.find((s2) => OC.Brain.free(s2, id)) || far.slots[0];
        Q.add(id, { kind: 'act', act: 'rest', slot: want.k }); const t0 = Date.now(); let pr = null; while (Date.now() - t0 < 60000 && !(b.slot && b.st === 'do' && (pr = Q.list(id)[0]) && pr.prog != null)) { await sleep(150); }
        out.slot = [b.slot && b.slot.k.split('#')[0], want.k.split('#')[0]]; out.prog = pr && pr.prog;
        out.saved = Array.isArray(OC.Chars.get(id).life.q16);
        Q.clear(id); Q.cancel(id, -1);
        return out;
      }, ids[0]);
      check('22a 清單最多 8 個在等（第一個馬上開始）；可以拖曳排序、設成循環、「立刻做」插到最前面', r.adds[0] === 'now' && r.adds.slice(1, 9).every((x) => x === 'queued') && r.adds[9] === false && r.len === 9 && r.moved && r.afterMove[1] === 'dance' && r.looped.length === 1 && r.nowOk && /^diary:(next|going|doing)$/.test(r.afterNow[0]), r);
      check('22b 不想做的事會說原因（還不餓），而且不會擋住後面的；按「強迫」就去做', /^refused:還不餓/.test(r.refused || '') && r.notBlocked.some((x) => /^stretch:(next|going|doing|go|do)$/.test(x)) && r.notBlocked.includes('eat:refused') && r.forced && /^eat:(go|do)$/.test(r.forcedAct), r);
      check('22c 安排「這張長椅」就去那一張（不是最近的；那個位子有人就坐同一張的另一邊）；進行中有進度；清單存在角色身上', r.slot[0] === r.slot[1] && r.prog != null && r.saved, { slot: r.slot, prog: r.prog });
    }
    if (want(23)) {
      const ids = await calm16();
      const r = await page.evaluate(async (id) => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), a = OC.App.actorOf(id);
        OC.App.menuFor({ type: 'self' }, OC.App.screenOf(a)); await sleep(500);
        const ring = [...document.querySelectorAll('.radial > .radial-ring > .radial-btn')].map((b) => b.textContent);
        [...document.querySelectorAll('.radial-btn')].find((b) => b.textContent === '安排').click(); await sleep(500);
        const tabs = [...document.querySelectorAll('.rp-tabs .chip-btn')].map((b) => b.textContent);
        document.querySelector('.rp-tabs [data-tab=body]').click(); await sleep(200);
        const items = [...document.querySelectorAll('.radial-panel .ri')].map((b) => b.textContent);
        [...document.querySelectorAll('.radial-panel .ri')].find((b) => b.textContent.includes('伸展')).click(); await sleep(700);
        const after1 = { open: OC.Radial.open_, list: OC.Queue.list(id).map((x) => x.act), toast: (document.querySelector('.undo-toast') || {}).textContent || '' };
        const und = document.querySelector('.undo-toast button'); und && und.click(); await sleep(300);
        const afterUndo = OC.Queue.list(id).map((x) => x.act);
        return { ring, tabs, items, after1, afterUndo, sheets: document.querySelectorAll('.sheet.open').length };
      }, ids[0]);
      check('23a 點角色：一圈常用動作＋分類（親近、餵食、送禮、玩耍、安排、更多…）；分類在同一個選單裡展開（分頁＋項目），不跳出新視窗', ['親近', '安排', '餵食', '檔案', '更多'].every((x) => r.ring.includes(x)) && r.tabs.includes('需求') && r.tabs.includes('去別處') && r.items.some((x) => x.includes('伸展')) && r.sheets === 0, r);
      check('23b 點項目就做（沒有「確定嗎？」）；下方提示可以「復原」', !r.after1.open && r.after1.list.includes('stretch') && /伸展/.test(r.after1.toast) && !r.afterUndo.includes('stretch'), r);
      const lp = await page.evaluate(async (id) => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); window.__r16 = []; OC.Store.on('menu16:request', (e) => window.__r16.push({ spec: typeof e.spec === 'string' ? e.spec : e.spec.act, r: e.r })); OC.Queue.add(id, 'meditate'); OC.Queue.add(id, 'spin');
        OC.App.menuFor({ type: 'self' }, OC.App.screenOf(OC.App.actorOf(id))); await sleep(500); [...document.querySelectorAll('.radial-btn')].find((b) => b.textContent === '安排').click(); await sleep(450); document.querySelector('.rp-tabs [data-tab=body]').click(); await sleep(200);
        const b = [...document.querySelectorAll('.radial-panel .ri')].find((x) => x.textContent.includes('伸展')); const r0 = b.getBoundingClientRect(); return { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
      }, ids[0]);
      await page.mouse.move(lp.x, lp.y); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up(); await page.waitForTimeout(800);
      const first = await page.evaluate((id) => ({ req: window.__r16.slice(-1)[0], list: OC.Queue.list(id).map((x) => x.act + ':' + x.state), b: OC.Brain.get(id).act }), ids[0]);
      check('23c 長按項目＝立刻做（插到最前面、馬上開始；原本在做的換掉，排在後面的還在）', first.req && first.req.spec === 'stretch' && first.req.r === 'now' && first.list.some((x) => x.startsWith('spin')) && !first.list.some((x) => x.startsWith('meditate')), first);
      await page.evaluate((id) => { OC.Queue.clear(id); OC.Queue.cancel(id, -1); }, ids[0]);
    }
    if (want(24)) {
      const ids = await calm16();
      const r = await page.evaluate(async () => {
        const W = OC.World, bench = W.interacts.find((i) => i.type === 'bench'), tree = W.interacts.find((i) => i.type === 'tree');
        const db = OC.App.describe(bench), dt = OC.App.describe(tree);
        return { bench: (db.extra || []).map((e) => e.label), tree: (dt.extra || []).map((e) => e.label) };
      });
      check('24a 東西會告訴你能做什麼：長椅（休息、看書、打盹、發呆…），每個在場的人各有一顆「邀…一起」；樹（抱抱樹、拍照…）', r.bench.some((x) => x.includes('休息')) && r.bench.some((x) => x.includes('打盹')) && r.bench.some((x) => /^邀.+一起/.test(x)) && r.tree.some((x) => x.includes('抱抱樹')), r);
      const g = await page.evaluate(async (id) => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), p = OC.App.player; let q = null; for (const [dx, dy] of [[60, 20], [-60, 20], [0, 50], [50, -30]]) { const c = OC.World.nearestWalkable(p.x + dx, p.y + dy, 20); if (c && Math.hypot(c.x - p.x, c.y - p.y) > 30) { q = c; break; } }
        OC.App.menuFor({ type: 'ground', p: q }, OC.World.project(q.x, q.y, OC.World.levelAt(q.x, q.y), 0)); await sleep(500);
        [...document.querySelectorAll('.radial-btn')].find((b) => b.textContent === '在這裡做').click(); await sleep(450);
        const items = [...document.querySelectorAll('.radial-panel .ri')].map((b) => b.textContent);
        [...document.querySelectorAll('.radial-panel .ri')].find((b) => b.textContent.includes('跳舞')).click(); await sleep(400);
        const b = OC.Brain.get(id); const t0 = Date.now(); while (Date.now() - t0 < 40000 && !(b.act === 'dance' && b.st === 'do')) { OC.Sim.advance(1); await sleep(300); }
        return { items, act: b.act + ':' + b.st, at: [Math.round(p.x - q.x), Math.round(p.y - q.y)] };
      }, ids[0]);
      check('24b 長按地面「在這裡做」：選跳舞 → 走到那裡再跳', g.items.length >= 8 && g.act === 'dance:do' && Math.hypot(g.at[0], g.at[1]) < 20, g);
    }
    if (want(25)) {
      const ids = await calm16();
      const r = await page.evaluate(async (id) => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const c = OC.Chars.get(id);
        const away = OC.Menu16.actItems(id, 'away').map((x) => x.label);
        const pl = OC.Acts16.placesFor('read').find((p) => p !== 'isle'); const r1 = OC.Queue.add(id, { kind: 'act', act: 'read', place: pl });
        await sleep(1500); const b = OC.Brain.get(id); return { away, pl, r1, leaving: b.leaving && b.leaving.to, st: OC.Queue.list(id).map((x) => x.zh + ':' + x.state) };
      }, ids[0]);
      check('25 去別的地方做的事也能排（「去別處」）：角色會自己走出去前往那裡', r.away.length > 0 && r.r1 === 'now' && r.leaving === r.pl, r);
      await page.waitForTimeout(4000); await calm16();
    }
    /* ============================== 16.5 food and cooking ============================== */
    const give = (items) => page.evaluate((items) => OC.Tx.run(OC.Tx.uid('test'), { get: { items } }, '測試補給'), items);
    if (want(26)) {
      const r = await page.evaluate(() => {
        const F = OC.Food16, R = F.RECIPES, methods = new Set(R.map((x) => x.method)), I = OC.Style.ITEMS;
        const bad = R.filter((x) => !I[x.id] || Object.keys(x.need).some((k) => !(k.startsWith('cat:') ? F.CAT_ZH[k.slice(4)] : I[k])));
        const variants = F.DISHES.every((id) => I[id + '_q2'] && I[id + '_q3'] && I[id + '_q3'].variant === id);
        const coll = Object.keys(I).filter((id) => I[id].variant).length;
        return { n: R.length, methods: [...methods], bad: bad.map((x) => x.id), variants, coll, cats: Object.keys(F.CAT_ZH), shop: ['butter', 'tofu', 'noodle'].every((x) => OC.Shops.SHOPS.food.items.includes(x)) };
      });
      check('26a 80 個食譜、七種做法（煮 炒 烤 烘焙 蒸 拌 調飲）；每個材料都存在；食材分類；新食材在食品店買得到', r.n >= 80 && r.methods.length === 7 && !r.bad.length && r.cats.length >= 8 && r.shop, r);
      check('26b 品質 ★1–★3：★★／★★★ 是各自的物品（背包仍是數量），圖鑑把它們算成同一道', r.variants && r.coll > 100, { variants: r.variants, coll: r.coll });
    }
    if (want(27)) {
      await give({ rice: 3, egg: 3, carrot: 2, tomato: 2, potato: 2, onion: 1, flour: 2, sugar: 2 });
      const r = await page.evaluate(() => {
        const F = OC.Food16, c = OC.Chars.active(), n0 = { rice: OC.Store.count('rice'), egg: OC.Store.count('egg') };
        const a = F.cook(c, { recipe: 'fried_rice', score: 0.9 });   /* rice egg cat:veg → ★3 */
        const after = { rice: OC.Store.count('rice'), egg: OC.Store.count('egg'), dish: OC.Store.count('fried_rice_q3') };
        const free1 = F.preview({ potato: 1, carrot: 1, onion: 1 }, 'boil'), free2 = F.preview({ tomato: 1, flour: 1 }, 'drink'), free3 = F.preview({ carrot: 1, tomato: 1 }, 'fry');
        const b = F.cook(c, { recipe: free1.recipe.id, ingr: { potato: 1, carrot: 1, onion: 1 }, score: 0.5, free: true });
        const burnt = F.cook(c, { recipe: 'scrambled', score: 0.05 });
        return { a: { ok: a.ok, out: a.out, n: a.n, q: a.q }, n0, after, free1: free1.recipe && free1.recipe.id, free2: free2.out, free3: free3.recipe ? free3.recipe.id : free3.out, b: { ok: b.ok, discovered: b.discovered, state: F.state('potato_stew') }, burnt: { ok: burnt.ok, eggs: OC.Store.count('egg') }, ledger: ((OC.Store.s.ledger || {}).log || []).slice(-3).map((x) => x.reason || x.why) };
      });
      check('27a 照食譜做：用掉材料（交易紀錄），做出 ★★★ 的料理（完美時多一份）', r.a.ok && r.a.q === 3 && r.a.out === 'fried_rice_q3' && r.after.dish === r.a.n && r.after.rice === r.n0.rice - 1 && r.after.egg === r.n0.egg - 1, r);
      check('27b 自由料理：材料＋做法對上沒做過的食譜＝發現它；對不上＝家常料理或奇妙的料理；燒焦不扣材料', r.free1 === 'potato_stew' && r.b.ok && r.b.discovered && r.b.state === 'made' && r.free2 === 'weird_dish' && /^(stir_veg|home_fry)$/.test(r.free3) && !r.burnt.ok && r.burnt.eggs === r.after.egg - 0, r);
    }
    if (want(28)) {
      const r = await page.evaluate(async () => {
        const F = OC.Food16, all = OC.Chars.all(), c = all[0];
        /* warm food on a cold day */
        OC.Store.s.settings.season = 'winter'; const bf = F.buff(c, 'veg_soup'); OC.Store.s.settings.season = null;
        /* species tendency: a rabbit is less keen on fish dishes than a cat (gentle, never over the player's own setting) */
        const t = { ...c.profile }; c.profile.species = 'cat'; const cat = F.speciesBias(c, 'grill_fish'); c.profile.species = 'rabbit'; const rab = F.speciesBias(c, 'grill_fish'); OC.Taste.setPref(c, 'grill_fish', 2, true); const locked = OC.Taste.pref(c, 'grill_fish').lv; OC.Taste.setPref(c, 'grill_fish', null); c.profile.species = t.species;
        return { bf: bf && bf.why, cat, rab, locked };
      });
      check('28 吃的感覺：冷天吃熱的會暖起來；物種有一點點口味傾向（貓喜歡魚、兔子不太愛）；玩家自己設的喜好不會被改', /暖/.test(r.bf || '') && r.cat === 1 && r.rab === -1 && r.locked === 2, r);
    }
    if (want(29)) {
      await calm16();
      await give({ curry: 2 });
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), F = OC.Food16, all = OC.Chars.all().filter((c) => c.appearance.mode !== 'sprite'), [a, b] = all;
        const s = F.serve('curry', 2, null, a.id); const onTable = F.mealsHere().map((m) => m.id + '×' + m.n), inv = OC.Store.count('curry');
        b.needs.food = 30; const f0 = b.needs.food; const ate = F.eatServing(b, OC.World.area.id); const left = F.mealsHere().reduce((x, m) => x + m.n, 0);
        const mem = b.life.mem.recent.map((m) => m.text).filter((t) => /做的/.test(t)).slice(-2);
        /* leftovers go after a game day */
        F.meals()[0].at -= 2000; F.spoil(); const after = F.mealsHere().length;
        return { ok: s.ok, onTable, inv, ate, f: [f0, b.needs.food], left, mem, after };
      });
      check('29a 端上桌：付一次（背包少了），在這裡的人餓了來吃一份（不用再付），吃了記得是誰做的；剩菜放超過一天就收掉', r.ok && r.onTable[0] === 'curry×2' && r.inv === 0 && r.ate === 'curry' && r.f[1] > r.f[0] && r.left === 1 && r.mem.some((t) => t.includes('做的')) && r.after === 0, r);
      await give({ rice: 2, potato: 2, carrot: 2 });
      const ai = await page.evaluate(async () => { const F = OC.Food16, c = OC.Chars.all()[1]; const r = F.aiCook(c, OC.World.area.id); return { ok: !!r, out: r && r.out, table: F.mealsHere().map((m) => m.id), again: [F.aiCook(c), F.aiCook(c)].filter(Boolean).length }; });
      check('29b 角色自己下廚：用廚房（背包）的食材做一道、端上桌給大家；一天最多兩次', ai.ok && ai.table.some((x) => x.startsWith(ai.out.split('_q')[0])) && ai.again <= 1, ai);
    }
    if (want(30)) {
      await calm16();
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); OC.Tx.run(OC.Tx.uid('t'), { get: { coins: 500, items: { rice: 1, egg: 1, carrot: 1 } } }, '測試');
        /* the kitchen sheet: recipe list with ✓/✗, free cooking preview, fridge view */
        OC.Kitchen.open(null); await sleep(500); const sh = document.querySelector('.sheet.open, .sheet'); const rows = sh.querySelectorAll('[data-cook]').length;
        const segs = [...sh.querySelectorAll('.seg button')]; segs.find((x) => x.textContent === '自由料理').click(); await sleep(300);
        for (const id of ['rice', 'egg', 'carrot']) { const b = sh.querySelector(`[data-ing=${id}]`); b && b.click(); await sleep(120); } const fry = sh.querySelector('[data-method=fry]'); fry && fry.click(); await sleep(150);
        const say = (sh.querySelector('.k16-say') || {}).textContent; [...sh.querySelectorAll('.seg button')].find((x) => x.textContent === '冰箱').click(); await sleep(300); const fridge = sh.querySelectorAll('.k16-fi').length;
        OC.UI.stack.slice().forEach(() => OC.UI.back());
        const c0 = OC.Store.s.coins; const o = OC.Food16.order(OC.Store.s.activeId, 'latte'); await sleep(200);
        return { rows, say, fridge, order: o.ok, paid: c0 - OC.Store.s.coins };
      });
      check('30 廚房：食譜清單（有材料的可以直接做）、自由料理即時告訴你會做出什麼、冰箱就是背包裡的食物；咖啡館點餐＝付錢、拿到、當場吃', r.rows >= 1 && /炒飯|？？？/.test(r.say || '') && r.fridge >= 3 && r.order && r.paid > 0, r);
    }
    /* ============================== 16.6 the dialogue engine ============================== */
    if (want(31)) {
      await calm16();
      const r = await page.evaluate(() => {
        const T = OC.Topic, cs = OC.Chars.all(), A = cs[0], B = cs[1], out = {};
        out.cands = T.candidates(A, B).length; out.abstract = OC.Topic16Data.ABSTRACT.length; out.lines = OC.Topic16Data.count;
        /* stance follows what the character really likes: a food the player marked as a favourite, an interest, a liked person */
        OC.Taste.setPref(A, 'curry', 2, true); out.food = T.stance(A, T.topic('food:curry'));
        OC.Taste.setPref(A, 'tomato', -2, true); out.foodBad = T.stance(A, T.topic('food:tomato'));
        A.profile.hobbies = (A.profile.hobbies || []).concat('觀星'); out.hobby = T.stance(A, T.topic('hobby:觀星'));
        OC.Mind.relChange(A.id, B.id, { aff: 40 }, 't'); out.person = T.stance(A, T.topic('person:' + B.id));
        /* a conversation is a chain: every behaviour answers the previous one; every line is found for every voice */
        const NEXT = { raise: ['agree', 'disagree', 'ask', 'share', 'joke', 'meh', 'switch'], gossip: ['agree', 'disagree', 'ask', 'share', 'joke', 'meh'], recall: ['agree', 'disagree', 'ask', 'share', 'joke', 'meh'], ask: ['explain'], explain: ['react', 'build', 'agree'], share: ['react', 'build', 'agree'], agree: ['build', 'share'], build: ['build', 'share'], disagree: ['defend', 'concede'], defend: ['concede', 'disagree'], joke: ['laugh', 'flat'], laugh: ['build'], flat: ['build'], react: ['build'], concede: ['build'], meh: ['switch'], switch: ['agree', 'disagree', 'ask', 'share', 'joke', 'meh', 'switch'] };
        let chains = 0, bad = [], missing = new Set(), behs = new Set();
        for (let k = 0; k < 200 && !(k >= 60 && behs.size >= 10); k++) {   /* 60 conversations, more if the sample happened to be very agreeable */
          const a = cs[k % cs.length], b = cs[(k + 1) % cs.length], L = [], conv = { kind: k % 3 ? 'chat' : 'share' };
          if (k === 60) for (const x of cs) { x.__p = { e: x.personality.expression, t: x.personality.traits.slice() }; x.personality.expression = 90; if (!x.personality.traits.includes('stubborn')) x.personality.traits.push('stubborn'); }   /* a livelier, more opinionated sample */
          if (!T.script(conv, (who, cat, extra) => L.push({ who, cat, extra }), a, b, OC.Mind.rel(a.id, b.id))) continue; chains++;
          for (let i = 0; i < L.length; i++) { const beh = L[i].cat.slice(4); behs.add(beh); if (i && beh !== 'wrap' && L[i - 1].cat !== 't16_switch') { const pv = L[i - 1].cat.slice(4); if (!(NEXT[pv] || []).includes(beh)) bad.push(pv + '→' + beh); } if (i && L[i].who === L[i - 1].who) bad.push('same speaker');
            const sp = L[i].who === 'a' ? a : b, ot = L[i].who === 'a' ? b : a; if (!OC.Talk.pick(L[i].cat, sp, ot, L[i].extra)) missing.add(L[i].cat + '/' + L[i].extra.tk + '/' + L[i].extra.ts); }
        }
        for (const x of cs) if (x.__p) { x.personality.expression = x.__p.e; x.personality.traits = x.__p.t; delete x.__p; }
        Object.assign(out, { chains, bad: bad.slice(0, 5), missing: [...missing].slice(0, 6), behs: [...behs].sort() });
        /* the typed answer finds a topic offline */
        out.m1 = T.match('今天吃了咖哩'); out.m2 = T.match('我好想去星砂海灘'); out.m3 = T.match('最近都睡不好'); out.m4 = T.match('嗯'); out.m5 = T.match('跟' + OC.Chars.name(B) + '吵架了');
        return out;
      });
      check('31a 話題來自角色身邊的事（剛做的事、共同興趣、回憶、天氣、季節、地點、吃過的東西、朋友、約 60 個日常話題）；立場依真的喜好（最愛的菜、討厭的菜、興趣、喜歡的人）', r.cands >= 6 && r.abstract >= 55 && r.food > 0.5 && r.foodBad < -0.5 && r.hobby > 0.5 && r.person > 0.4, r);
      check('31b 對話是一串回應：每一句都是對上一句的反應（提起→附和／反對／追問／分享／玩笑…），輪流說話，每一種情況都找得到台詞', r.chains >= 55 && !r.bad.length && !r.missing.length && r.behs.length >= 10, r);
      check('31c 打字回答用離線字典找到話題（咖哩→食物、海灘→地點、睡不好→睡覺、名字→那個人；認不出來就是沒有）', r.m1 === 'food:curry' && /^place:beach/.test(r.m2 || '') && r.m3 === 'x:sleep' && r.m4 === null && /^person:/.test(r.m5 || ''), r);
    }
    if (want(32)) {
      const ids = await calm16();
      const r = await page.evaluate(async (ids) => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const me = OC.Store.s.activeId;
        const [A, B] = ids.filter((id) => id !== me).map((id) => OC.Chars.get(id)); for (const c of [A, B]) OC.Brain.setControl(c.id, 'semi'); const ba = OC.Brain.get(A.id), bb = OC.Brain.get(B.id);
        OC.Store.s.life.settings.chatView = 'kw';
        OC.Mind.relPair(A.id, B.id, { fam: 40, aff: 50, trust: 40 }, 't'); B.personality.social = 90; A.needs.social = 20; B.needs.social = 20;
        for (const b of [ba, bb]) { if (b.st === 'do') OC.Brain.finish(b, 't'); if (b.st === 'go') OC.Brain.abort(b, 't'); if (b.st === 'social') OC.Brain.Social.end(OC.Brain.convs.find((x) => x.a === b || x.b === b), 't'); b.st = 'think'; b.thinkAt = 1e9; }
        if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; await sleep(300); for (const b of [ba, bb]) [...b.holds].forEach((x) => OC.Brain.unhold(b.id, x));
        const diag = [ba, bb].map((b) => [b.st, !!b.a, [...b.holds].join('|'), !!b.queued, !!b.leaving, !!b.byPlayer, !!b.invited].join(',')); const okStart = OC.Brain.Social.start(ba, bb, 'chat'); const conv = OC.Brain.convs.find((x) => x.a === ba);
        for (let i = 0; i < 100 && conv && conv.st === 'approach'; i++) await sleep(100);
        const out = { t16: !!(conv && conv.t16), topic: conv && conv.t16 && conv.t16.zh, okStart, diag };
        let kw = 0, words = 0, li = -1; for (let i = 0; i < 120 && conv && OC.Brain.convs.includes(conv); i++) { if (li < 0) kw += document.querySelectorAll('.speech.kw').length ? 1 : 0; if (li < 0 && (kw >= 2 || i === 80)) { out.listen = OC.Topic.listen(A.id); li = i; } if (li >= 0 && i > li + 2) words += document.querySelectorAll('.speech:not(.kw)').length ? 1 : 0; await sleep(250); }
        for (let i = 0; i < 240 && conv && OC.Brain.convs.includes(conv); i++) await sleep(250);
        const e = OC.Topic.entries(A.id)[0] || {}; out.log = { heard: e.heard, lines: (e.lines || []).length, topics: e.topics };
        out.know = Object.keys(OC.Topic.st(A).know[B.id] || {}).length; out.knowB = Object.keys(OC.Topic.st(B).know[A.id] || {}).length; out.still = OC.Brain.convs.includes(conv); out.st = conv && conv.st;
        out.mem = OC.Mind.memories(A, { who: B.id }).map((m) => m.text).slice(0, 3); out.kw = kw; out.words = words;
        for (const c of [A, B]) OC.Brain.setControl(c.id, 'manual');
        return out;
      }, ids);
      check('32a 角色自己聊天：有話題（不是固定的一句「聊天」），回憶寫「和…聊了＜話題＞」，雙方記得對方對話題的立場', r.t16 && r.know >= 1 && r.knowB >= 1 && r.mem.some((t) => /聊了/.test(t)), r);
      check('32b 你沒有參與的對話只顯示關鍵字泡泡（表情＋話題）；「偷聽」之後顯示真的話，對話紀錄也看得到內容', r.kw > 0 && r.listen && r.words > 0 && r.log.heard && r.log.lines >= 3, r);
    }
    if (want(33)) {
      await calm16();
      const r = await page.evaluate(() => {
        const cs = OC.Chars.all(), [A, B, C] = cs, T = OC.Topic, M = OC.Mind, out = {};
        M.relChange(B.id, A.id, { trust: 60 }, 't'); M.relChange(A.id, C.id, { aff: -60, conflict: 30 }, 't'); M.relChange(B.id, C.id, { aff: 10 }, 't');
        const conv = () => ({ id: 'tc' + Math.random(), a: OC.Brain.get(A.id), b: OC.Brain.get(B.id), t16: { key: 'person:' + C.id, zh: OC.Chars.name(C), keys: ['person:' + C.id], topics: ['person:' + C.id], gossip: C.id, agree: 0, disagree: 0, concede: 0, beh: [] } });
        out.stance = T.stance(A, T.topic('person:' + C.id));
        const a0 = M.relPeek(B.id, C.id).aff; T.resolve(conv(), A, B); const a1 = M.relPeek(B.id, C.id).aff; T.resolve(conv(), A, B); const a2 = M.relPeek(B.id, C.id).aff;
        out.first = a1 - a0; out.again = a2 - a1; out.type = M.relPeek(B.id, C.id).type;
        /* a relationship the player fixed is never moved by gossip */
        B.life.t16.gos = {}; M.setRelType(B.id, C.id, 'friend', '', false); const f0 = M.relPeek(B.id, C.id).aff; T.resolve(conv(), A, B); out.fixed = M.relPeek(B.id, C.id).aff - f0;
        /* no trust → no effect */
        M.setRelType(B.id, C.id, 'auto', '', false); B.life.t16.gos = {}; M.relChange(B.id, A.id, { trust: -100 }, 't'); const n0 = M.relPeek(B.id, C.id).aff; T.resolve(conv(), A, B); out.noTrust = M.relPeek(B.id, C.id).aff - n0;
        return out;
      });
      check('33 八卦：說的人討厭第三個人 → 信任說話者的聽眾對那個人好感 −1（一天一次）；玩家固定的關係、不信任說話者時都不受影響；不改關係類型', r.stance < -0.3 && r.first < 0 && r.again === 0 && r.fixed === 0 && r.noTrust === 0, r);
    }
    if (want(34)) {
      await calm16();
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const c = OC.Chars.all().find((x) => x.id !== OC.Store.s.activeId) || OC.Chars.all()[0];
        const out = {}; const sh = OC.Topic.askPlayer(c, { force: true }); await sleep(500);
        const el = document.querySelector('.sheet.open'); out.open = !!el; out.chips = el ? el.querySelectorAll('[data-t16]').length : 0; out.held = OC.Brain.get(c.id).holds.has('menu');
        const inp = el.querySelector('input'); inp.value = '今天吃了咖哩'; el.querySelector('[data-t16send]').click(); await sleep(600);
        out.closed = !document.querySelector('.sheet.open'); out.released = !OC.Brain.get(c.id).holds.has('menu');
        out.mem = OC.Mind.memories(c, {}).map((m) => m.text).find((t) => /和你聊了/.test(t)); out.player = (c.life.t16.player || {})['food:curry'] || 0;
        out.again = OC.Topic.canAsk(c);   /* once a day */
        OC.Store.s.life.settings.askChat = false; out.off = OC.Topic.canAsk(c); OC.Store.s.life.settings.askChat = true;
        return out;
      });
      check('34 沒話題時來問你：可以選話題或打字（離線字典認出「咖哩」），角色回應、記得你說過什麼；問的時候角色停下、關掉就放開；一天一次、可以在生活設定關掉', r.open && r.chips >= 2 && r.held && r.closed && r.released && /咖哩/.test(r.mem || '') && r.player === 1 && r.again === false && r.off === false, r);
    }
    /* ================================================================ 16.7 自主與世界 */
    const prep167 = () => page.evaluate(async () => {
      if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; OC.Store.s.settings.weather = 'clear'; OC.Store.s.life.settings.aware16 = true;
      const all = OC.Chars.all().filter((c) => c.appearance.mode !== 'sprite');
      for (const c of all) { const bb = OC.Brain.get(c.id); if (!bb) continue; if (bb.conv) OC.Brain.Social.end(bb.conv, 't'); [...bb.holds].forEach((x) => OC.Brain.unhold(c.id, x)); if (bb.st === 'do') OC.Brain.finish(bb, 't'); else if (bb.st === 'go') OC.Brain.abort(bb, 't'); bb.queued = null; c.life.emo.list = []; c.life.emo.dom = 'neutral'; Object.assign(c.needs, { food: 80, sleep: 85, energy: 80, fun: 70, social: 60, comfort: 80, interest: 70, active: 70 }); c.life.aw16 = null; }
      for (const g of (OC.Store.s.ground16 || {}).isle || []) OC.Aware.remove(g.uid, 'isle');
      return all.map((c) => c.id);
    });
    if (want(35)) {
      await calm16(); const ids = await prep167();
      const r = await page.evaluate(async (ids) => {
        const [a, b] = ids.map((id) => OC.Chars.get(id)), ba = OC.Brain.get(a.id), bb = OC.Brain.get(b.id);
        OC.Brain.setControl(a.id, 'semi'); ba.manualOverride = 0; if (!a.personality.traits.includes('caring')) a.personality.traits.push('caring');
        const q = OC.World.nearestWalkable(ba.a.x + 30, ba.a.y, 40); bb.a.path = null; bb.a.x = q.x; bb.a.y = q.y;
        Object.assign(OC.Mind.rel(a.id, b.id), { fam: 60, aff: 50, trust: 40 }); OC.Mind.feel(b, 'down', 0.9, '測試'); b.life.emo.dom = 'down'; OC.Aware.st(a).seen = {};
        const f = OC.Aware.look(a, ba) || OC.Aware.st(a).focus; const list = OC.Aware.shape(a, ba, OC.Brain.candidates(ba));
        const com = list.find((x) => x.kind === 'social' && x.other === b.id && x.social === 'comfort');
        /* someone without the caring trait and far away notices it less */
        const s1 = OC.Aware.salience(a, { kind: 'sad', who: b.id, d: 30 }); a.personality.traits = a.personality.traits.filter((t) => t !== 'caring'); a.personality.traits.push('aloof'); const s2 = OC.Aware.salience(a, { kind: 'sad', who: b.id, d: 180 }); a.personality.traits = a.personality.traits.filter((t) => t !== 'aloof');
        b.life.emo.list = []; b.life.emo.dom = 'neutral'; OC.Brain.setControl(a.id, 'manual');
        return { focus: f && f.kind, who: f && f.who === b.id, com: com && com.why.slice(0, 2), rank: com ? list.indexOf(com) : -1, s1, s2, log: OC.Brain.log.slice(0, 6).filter((l) => l.who === a.id).map((l) => l.text) };
      }, ids);
      check('35 感知與注意力：身邊有人心情不好 → 注意到（看過去、成為焦點），「安慰」的分數變高並寫出原因；個性關心別人的、近的更容易注意到', r.focus === 'sad' && r.who && r.com && r.com.some((w) => /注意到/.test(w)) && r.s1 > r.s2 && r.log.some((t) => /注意到/.test(t)), r);
    }
    if (want(36)) {
      await calm16(); const ids = await prep167();
      const r = await page.evaluate(async (ids) => {
        const [a, b] = ids.map((id) => OC.Chars.get(id)), ba = OC.Brain.get(a.id); OC.Brain.setControl(a.id, 'semi'); ba.manualOverride = 0;
        for (const [x, y] of [[a, b], [b, a]]) Object.assign(OC.Mind.rel(x.id, y.id), { fam: 70, aff: 60, trust: 50, conflict: 0, type: 'friend' });
        const now = OC.Sim.now(); (a.life.socialAt = a.life.socialAt || {})[b.id] = now - 3 * 1440;
        const list = OC.Aware.shape(a, ba, OC.Brain.candidates(ba)); const hit = list.filter((x) => x.kind === 'social' && x.other === b.id && x.why.some((w) => /好久沒/.test(w)));
        a.life.socialAt[b.id] = now - 5;   /* just talked → nothing */
        const none = OC.Aware.shape(a, ba, OC.Brain.candidates(ba)).filter((x) => x.why.some((w) => /好久沒/.test(w))).length;
        /* the friend is somewhere else → going there to see them */
        a.life.socialAt[b.id] = now - 4 * 1440; const loc0 = b.life.loc, tr0 = OC.Store.s.life.settings.travel; OC.Store.s.life.settings.travel = true; b.life.loc = 'cafe'; const trip = OC.Aware.shape(a, ba, []).find((x) => x.kind === 'travel' && x.seek === b.id); b.life.loc = loc0; OC.Store.s.life.settings.travel = tr0;
        a.life.socialAt[b.id] = now; OC.Brain.setControl(a.id, 'manual');
        return { n: hit.length, why: hit[0] && hit[0].why[0], none, trip: trip && { place: trip.place, why: trip.why[0] } };
      }, ids);
      check('36 社交維繫：好朋友三天沒說話 → 和他有關的社交分數提高（「好久沒和…說話了」）；剛聊過就沒有；朋友在別的地方 → 想去那裡找他', r.n >= 1 && r.none === 0 && r.trip && r.trip.place === 'cafe' && /找/.test(r.trip.why), r);
    }
    if (want(37)) {
      await calm16(); const ids = await prep167();
      const r = await page.evaluate(async (ids) => {
        const [a, b, c2] = ids.map((id) => OC.Chars.get(id)), ba = OC.Brain.get(a.id), bb = OC.Brain.get(b.id); OC.Brain.setControl(a.id, 'semi'); ba.manualOverride = 0;
        const fake = () => [{ kind: 'act', act: 'dance', s: 1, why: [] }, { kind: 'act', act: 'observe', s: 1, why: [] }, { kind: 'act', act: 'read', s: 1, why: [] }, { kind: 'social', social: 'joke', other: c2.id, s: 1, why: [] }];
        const q = OC.World.nearestWalkable(ba.a.x + 40, ba.a.y, 40); bb.a.path = null; bb.a.x = q.x; bb.a.y = q.y; bb.st = 'do'; bb.act = 'sleep';
        const sl = OC.Aware.shape(a, ba, fake()); bb.st = 'think'; bb.act = null;
        OC.Store.s.settings.weather = 'rain'; const rn = OC.Aware.shape(a, ba, fake()); OC.Store.s.settings.weather = 'clear';
        OC.Mind.feel(c2, 'down', 0.9, '測試'); c2.life.emo.dom = 'down'; const sd = OC.Aware.shape(a, ba, fake()); c2.life.emo.list = []; c2.life.emo.dom = 'neutral';
        const S = (l, k) => { const x = l.find((y) => (y.act || y.social) === k); return { s: +x.s.toFixed(2), why: x.why[0] || '' }; };
        OC.Brain.setControl(a.id, 'manual');
        return { sleepDance: S(sl, 'dance'), sleepRead: S(sl, 'read'), rainObs: S(rn, 'observe'), rainRead: S(rn, 'read'), sadJoke: S(sd, 'joke') };
      }, ids);
      check('37 情境判斷：旁邊有人在睡覺 → 不跳舞（看書不受影響）；下雨的室外 → 不看風景；對方心情不好 → 不開玩笑；都寫出原因', r.sleepDance.s < 0.5 && /睡覺/.test(r.sleepDance.why) && r.sleepRead.s === 1 && r.rainObs.s < 0.7 && /下雨/.test(r.rainObs.why) && r.rainRead.s === 1 && r.sadJoke.s < 0.5 && /心情不好/.test(r.sadJoke.why), r);
    }
    if (want(38)) {
      await calm16(); const ids = await prep167();
      const r = await page.evaluate(async (ids) => {
        const [a, b] = ids.map((id) => OC.Chars.get(id)), ba = OC.Brain.get(a.id);
        const bs = OC.Brain.bestSlot(a, ba, 'sit'); if (!bs) return { noslot: true };
        const s = bs.slot; s.obj.slots.forEach((s2, i) => OC.Brain.reserve(s2, i ? 'x167_' + i : b.id));   /* the bench is taken */
        const ok = OC.Brain.start(ba, 'rest', { slot: s }); const fl = OC.Aware.st(a).fail[0];
        const list = OC.Aware.shape(a, ba, [{ kind: 'act', act: 'rest', target: { slot: s }, s: 1, why: [] }, { kind: 'act', act: 'read', s: 0.8, why: [] }]);
        OC.Brain.setControl(a.id, 'semi'); ba.manualOverride = 0;
        const list2 = OC.Aware.shape(a, ba, [{ kind: 'act', act: 'rest', target: { slot: s }, s: 1, why: [] }, { kind: 'act', act: 'read', s: 0.8, why: [] }]);
        OC.Aware.chosen(a, ba, list2[0]); OC.Brain.release(b.id); s.obj.slots.forEach((s2, i) => i && OC.Brain.release('x167_' + i)); OC.Brain.setControl(a.id, 'manual');
        return { ok, fl: fl && fl.why, top: list2[0].act, restS: +list2.find((x) => x.act === 'rest').s.toFixed(2), log: (a.life.log[0] || {}).text, manualUntouched: list.find((x) => x.act === 'rest').s === 1 };
      }, ids);
      check('38 重新規劃：想坐的長椅被佔走 → 記住原因；接下來避開它改做別的，日誌寫「改變計畫：本來想休息，但…被佔走了，改成…」（手動操控的角色不受影響）', r.ok === false && /被佔走/.test(r.fl || '') && r.top === 'read' && r.restS < 0 && /改變計畫/.test(r.log || '') && r.manualUntouched, r);
    }
    if (want(39)) {
      await calm16(); const ids = await prep167();
      await give({ curry: 1, ball: 2 });
      const r = await page.evaluate(async (ids) => {
        const free = (bx, c) => { if (bx.conv) OC.Brain.Social.end(bx.conv, 't'); if (bx.st === 'do') OC.Brain.finish(bx, 't'); else if (bx.st === 'go') OC.Brain.abort(bx, 't'); Object.assign(c.needs, { sleep: 90, energy: 85, social: 80, comfort: 85 }); };
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), Aw = OC.Aware, [a, b] = ids.map((id) => OC.Chars.get(id)), ba = OC.Brain.get(a.id), bb = OC.Brain.get(b.id), out = {};
        const n0 = OC.Store.count('curry'); const p = Aw.put('curry', 'put'); out.put = p.ok; out.inv = [n0, OC.Store.count('curry')];
        const d = OC.World.drops.find((x) => x.g16 === p.uid); out.sprite = !!(d && d.m.isSprite); out.saved = (OC.Store.s.ground16.isle || []).some((g) => g.uid === p.uid);
        out.desc = OC.App.describe(d.it).sub;
        /* a hungry character goes and eats it */
        a.personality.traits = a.personality.traits.filter((t) => !['neatfreak', 'gourmet', 'lazy'].includes(t)); OC.Taste.setPref(a, 'curry', 1, true); a.needs.food = 25; const c1 = Aw.groundCands(a, ba).find((x) => x.act === 'g16_eat'); out.cand = c1 && c1.why[0]; if (!c1) return out;
        b.personality.traits = b.personality.traits.filter((t) => !['neatfreak', 'gourmet'].includes(t)); 
        free(ba, a); ba.queuedPt = c1.target.pt; OC.Brain.command(a.id, 'g16_eat'); const t0 = Date.now(); while ((OC.Store.s.ground16.isle || []).some((g) => g.uid === p.uid) && Date.now() - t0 < 90000) await sleep(300);
        out.eaten = !(OC.Store.s.ground16.isle || []).some((g) => g.uid === p.uid); out.food = a.needs.food; out.mem = OC.Mind.memories(a, {}).map((m) => m.text).find((t) => /地上的/.test(t)); out.gone = !OC.World.drops.some((x) => x.g16 === p.uid);
        /* litter: a tidy character puts it back in your bag */
        const nb = OC.Store.count('ball'); const t = Aw.put('ball', 'toss'); out.toss = [nb, OC.Store.count('ball')];
        b.personality.traits = b.personality.traits.filter((t) => t !== 'messy'); if (!b.personality.traits.includes('organized')) b.personality.traits.push('organized');
        const c2 = Aw.groundCands(b, bb).find((x) => x.act === 'g16_tidy'); out.tidyCand = c2 && c2.why[0];
        OC.Brain.setControl(b.id, 'semi'); free(bb, b); bb.queuedPt = c2.target.pt; OC.Brain.command(b.id, 'g16_tidy'); const t1 = Date.now(); while ((OC.Store.s.ground16.isle || []).some((g) => g.uid === t.uid) && Date.now() - t1 < 90000) await sleep(300);
        OC.Brain.setControl(b.id, 'manual'); out.back = OC.Store.count('ball'); out.tidyDbg = { st: bb.st, act: bb.act, left: (OC.Store.s.ground16.isle || []).some((g) => g.uid === t.uid), log: OC.Brain.log.filter((l) => l.who === b.id).slice(0, 4).map((l) => l.text), holds: [...bb.holds] };
        /* a toy: someone bored plays with it; you can pick it back up */
        const u = Aw.put('ball', 'put'); a.needs.fun = 20; a.needs.energy = 80; const c3 = Aw.groundCands(a, ba).find((x) => x.act === 'g16_play'); out.play = c3 && c3.why[0];
        free(ba, a); ba.queuedPt = c3.target.pt; OC.Brain.command(a.id, 'g16_play'); const t2 = Date.now(); while (!(Aw.st(a).toy || {})[u.uid] && Date.now() - t2 < 90000) await sleep(300);
        out.played = !!(Aw.st(a).toy || {})[u.uid]; out.playDbg = { st: ba.st, act: ba.act, log: OC.Brain.log.filter((l) => l.who === a.id).slice(0, 5).map((l) => l.text), holds: [...ba.holds] }; out.stays = (OC.Store.s.ground16.isle || []).some((g) => g.uid === u.uid);
        const nb2 = OC.Store.count('ball'); out.take = Aw.take(u.uid).ok; out.took = [nb2, OC.Store.count('ball')];
        /* the same uid cannot be taken twice; a full spot says why */
        out.twice = Aw.take(u.uid).ok;
        return out;
      }, ids);
      check('39a 放在地上：背包少一個（經交易）、地上出現那個東西的圖示、存進存檔、點它會說明', r.put && r.inv[1] === r.inv[0] - 1 && r.sprite && r.saved && /放在地上/.test(r.desc), r);
      check('39b 肚子餓的角色走過去吃掉：地上沒了、飽足增加、記得「吃了你放在地上的…」', r.cand && r.eaten && r.food > 25 && /你放在地上/.test(r.mem || '') && r.gone, r);
      check('39c 丟掉的東西：愛整潔的角色會撿起來放回你的背包（經交易）', r.toss[1] === r.toss[0] - 1 && /丟在地上/.test(r.tidyCand || '') && r.back === r.toss[0], r);
      check('39d 玩具：無聊的角色會去玩（玩完東西還在）；你可以撿回來，同一個不能撿兩次', r.play && r.played && r.stays && r.take && r.took[1] === r.took[0] + 1 && !r.twice, r);
    }
    if (want(40)) {
      await calm16(); const ids = await prep167();
      const r = await page.evaluate(async (ids) => {
        const [a, b, c2, d2] = ids.map((id) => OC.Chars.get(id)), Aw = OC.Aware, now = OC.Sim.now();
        const keep = [c2, d2].map((x) => [x.life.loc, x.life.cur]);
        for (const x of [c2, d2]) { x.life.loc = 'library'; x.life.cur = { act: 'nap', fac: '懶骨頭', until: now + 100, t0: now, place: 'place:library' }; }
        const left = Aw.absFilter(a, 'library', [{ act: 'rest', pl: 'library', s: 1 }, { act: 'study', pl: 'library', s: 1 }, { act: 'fish', pl: 'beach', s: 1 }], now).map((x) => x.act);
        [c2, d2].forEach((x, i) => { x.life.loc = keep[i][0]; x.life.cur = keep[i][1]; });
        const cur = { act: 'study', place: 'place:library', placeZh: '葉影圖書館' }; Aw.absStart(a, cur);
        const f0 = OC.Mind.rel(a.id, b.id).fam; Aw.talkAway(a, b, 'cafe', now);
        const mem = OC.Mind.memories(a, {}).map((m) => m.text).find((t) => /在雲朵咖啡館和/.test(t)), log = (OC.Store.s.life.convlog || [])[0];
        return { left, fac: cur.fac, zh: cur.placeZh, fam: [f0, OC.Mind.relPeek(a.id, b.id).fam], mem, away: log && log.away, sa: a.life.socialAt[b.id] === now };
      }, ids);
      check('40 其他地點：設施有容量（懶骨頭兩個都有人在睡 → 不會選休息，讀書可以）；記下用的是哪個設施；不在身邊的兩個人在同一個地方會聊一個真的話題（關係、回憶、對話紀錄）', JSON.stringify(r.left) === JSON.stringify(['study', 'fish']) && r.fac === '閱讀書桌' && /閱讀書桌/.test(r.zh) && r.fam[1] > r.fam[0] && r.mem && r.away && r.sa, r);
    }
    if (want(41)) {
      const r = await page.evaluate(() => {
        const P = OC.Props16.NEW, ids = Object.keys(P), cv = document.createElement('canvas'), x = cv.getContext('2d');
        const drawn = ids.filter((id) => { x.clearRect(0, 0, 24, 24); return OC.Items.drawArt(x, id) && x.getImageData(0, 0, 24, 24).data.some((v, i) => i % 4 === 3 && v > 0); });
        const sold = ids.filter((id) => Object.keys(OC.Shops.SHOPS).some((s) => OC.Shops.stock(s).includes(id)));
        const anims = new Set(OC.Chars.ACTIONS.map((a) => a[0]).concat(Object.keys((OC.Anim11 && OC.Anim11.LIB) || {})));
        const badAnim = Object.entries(OC.Aware.ACTS).filter(([, A]) => !OC.Chars.ACTIONS.some((a) => a[0] === A.anim) && !(OC.Anim11 && OC.Anim11.has && OC.Anim11.has(A.anim))).map(([k]) => k);
        const [a, b] = OC.Chars.all(); const cats = [...new Set(OC.LifeData.LINES.filter((l) => String(l.cat || '').startsWith('aw16_')).map((l) => l.cat))];
        const missing = cats.filter((cat) => !OC.Talk.pick(cat, a, b, { vars: { thing: '彈彈球' } }));
        const inMenu = OC.Menu16 && OC.Menu16.charRing ? JSON.stringify(OC.Menu16.charRing(a.id)).includes('g16_') : false;
        return { n: ids.length, drawn: drawn.length, sold: sold.length, badAnim, cats: cats.length, missing, inMenu, lines: OC.Aware16Data.count };
      });
      check('41 新道具：12 樣都有原創圖示、都買得到；地上物品的動作都有動畫；每一種反應都找得到台詞；這些動作不會出現在安排選單', r.n === 12 && r.drawn === 12 && r.sold === 12 && !r.badAnim.length && r.cats >= 14 && !r.missing.length && !r.inMenu, r);
    }
    /* ================================================================ 16.8 住處與家庭 */
    const prep168 = () => page.evaluate(async () => {
      if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; OC.UI.stack.slice().forEach(() => OC.UI.back && OC.UI.back());
      if (OC.World.area.id !== 'isle') { OC.WorldUI.travel('isle', { instant: true }); await new Promise((r) => setTimeout(r, 2500)); }
      const all = OC.Chars.all().filter((c) => c.appearance.mode !== 'sprite');
      for (const c of all) { c.life.home16 = null; c.life.h16 = null; c.profile.age = '25'; c.personality.traits = c.personality.traits.filter((t) => !['neatfreak', 'messy', 'homebody', 'aloof', 'independent', 'slowwarm', 'caring', 'easygoing', 'outgoing', 'caretaker', 'organized', 'tidy'].includes(t)); }
      for (const a of all) for (const b of all) if (a !== b) { const r = OC.Mind.rel(a.id, b.id); Object.assign(r, { type: 'stranger', fam: 0, aff: 0, trust: 10, intim: 0, conflict: 0, fixed: false, kind16: '', label16: '' }); }
      OC.Store.s.life.h16 = null; OC.Store.s.life.settings.family16 = false;
      return all.map((c) => c.id);
    });
    if (want(42)) {
      await prep168();
      const r = await page.evaluate(async () => {
        const out = {}; out.doors = OC.World.interacts.filter((i) => i.type === 'home').map((i) => i.to || 'home').sort();
        out.desc = OC.App.describe(OC.World.interacts.find((i) => i.to === 'phouse')).title;
        for (const pl of ['yhouse', 'phouse']) { OC.WorldUI.travel(pl, { instant: true }); await new Promise((r) => setTimeout(r, 2600)); out[pl] = { area: OC.World.area.id, furn: OC.World.furn.map((f) => f.id), beds: OC.Brain.aff.filter((o) => OC.House16.BED[o.kind]).map((o) => o.kind + ':' + o.slots.length), exit: OC.World.interacts.some((i) => i.type === 'exit') }; }
        OC.WorldUI.travel('isle', { instant: true }); await new Promise((r) => setTimeout(r, 2600)); out.back = OC.World.area.id;
        out.shop = ['bed2', 'bunk', 'kidbed', 'crib'].every((id) => OC.Shops.stock('furniture').includes(id));
        out.open = ['coral', 'yellow', 'purple'].map((k) => OC.Homes.HOUSES[k].open && OC.Places.open(OC.Homes.HOUSES[k].place));
        return out;
      });
      check('42 三棟房子都能走進去：黃屋頂小屋（雙人床）、紫屋頂連棟屋（上下舖＋床）和原本的大家庭宅；新床在家具行買得到', JSON.stringify(r.doors) === JSON.stringify(['home', 'phouse', 'yhouse']) && r.yhouse.area === 'yhouse' && r.yhouse.beds.includes('bed2:2') && r.phouse.beds.includes('bunk:2') && r.yhouse.exit && r.back === 'isle' && r.shop && r.open.every(Boolean) && /紫屋頂/.test(r.desc), r);
    }
    if (want(43)) {
      const ids = await prep168();
      const r = await page.evaluate(async (ids) => {
        const H = OC.House16, [a, b, c, d] = ids.map((id) => OC.Chars.get(id)), out = {};
        H.moveIn(a.id, 'yellow', { force: true }); H.moveIn(b.id, 'purple', { force: true });
        out.place = [H.placeOf(a), H.placeOf(b), H.placeOf(c)];
        OC.WorldUI.travel('yhouse', { instant: true }); await new Promise((r) => setTimeout(r, 2600));
        const bed = OC.Brain.aff.find((o) => o.kind === 'bed2'); out.own = H.slotOK(a, bed, bed.slots[0], 'sleep'); out.guest = H.slotOK(b, bed, bed.slots[0], 'sleep'); out.guestNap = H.slotOK(b, bed, bed.slots[0], 'nap');
        /* sharing the double bed depends on the relationship */
        OC.Brain.reserve(bed.slots[0], a.id); H.moveIn(c.id, 'yellow', { force: true });
        out.stranger = H.slotOK(c, bed, bed.slots[1], 'sleep');
        OC.Opening.setStart(a.id, c.id, 'spouse'); out.partner = H.slotOK(c, bed, bed.slots[1], 'sleep');
        c.profile.age = '15'; OC.Mind.rel(a.id, c.id).type = 'friend'; OC.Mind.rel(c.id, a.id).type = 'friend'; out.minor = H.shareOK(c, a);
        c.profile.age = '0'; out.babyBed = H.slotOK(c, bed, bed.slots[1], 'sleep'); c.profile.age = '25';
        OC.Brain.release(a.id);
        OC.WorldUI.travel('isle', { instant: true }); await new Promise((r) => setTimeout(r, 2600));
        /* away from the player, sleep is at your own house */
        const tc = OC.Brain.travelCands ? null : null; void tc;
        out.door = OC.Brain.aff.filter((o) => o.kind === 'home').map((o) => o.place).sort();
        const doorY = OC.Brain.aff.find((o) => o.place === 'yhouse'); out.doorOwn = H.slotOK(a, doorY, doorY.slots[0], 'sleep'); out.doorOther = H.slotOK(b, doorY, doorY.slots[0], 'sleep');
        return out;
      }, ids);
      check('43 每個人回自己的家睡：只有住戶能睡那間房子的床（客人可以打盹）；島上每扇門只給自己家的人進去睡', JSON.stringify(r.place) === JSON.stringify(['yhouse', 'phouse', 'home']) && r.own && !r.guest && r.guestNap && r.doorOwn && !r.doorOther, r);
      check('44 同床共枕看關係：陌生人不睡同一張雙人床，伴侶可以；未成年和不是家人的大人不同床；嬰兒只睡嬰兒床', r.stranger === false && r.partner === true && r.minor === false && r.babyBed === false, r);
    }
    if (want(45)) {
      const ids = await prep168();
      const r = await page.evaluate(async (ids) => {
        const H = OC.House16, [a, b, c] = ids.map((id) => OC.Chars.get(id)), out = {};
        H.moveIn(a.id, 'yellow'); a.personality.traits.push('homebody');
        Object.assign(OC.Mind.rel(a.id, b.id), { aff: -20, conflict: 40, type: 'rival' });
        const r1 = H.moveIn(b.id, 'yellow'); out.r1 = { ok: r1.ok, why: r1.why, can: r1.canForce, re: (r1.reactions || []).map((x) => x.r + ':' + x.why) };
        /* the page: try the move, see the reaction, force it */
        OC.Pages.open('homes16'); await new Promise((res) => setTimeout(res, 700)); const pg = document.querySelector('.page.open[data-page=homes16]');
        pg.querySelector(`[data-res="${b.id}"] .h16-who`).click(); await new Promise((res) => setTimeout(res, 300));
        pg.querySelector(`[data-res="${b.id}"] [data-move=yellow]`).click(); await new Promise((res) => setTimeout(res, 300));
        out.shown = [...pg.querySelectorAll('.h16-react')].map((e) => e.dataset.r); out.dialogs = document.querySelectorAll('.sheet.open, .confirm.open').length;
        const c0 = OC.Mind.relPeek(a.id, b.id).conflict; pg.querySelector('[data-force]').click(); await new Promise((res) => setTimeout(res, 300));
        out.moved = H.houseOf(b); out.conflict = [c0, OC.Mind.relPeek(a.id, b.id).conflict]; out.mem = OC.Mind.memories(a, {}).map((m) => m.text).find((t) => /不顧我的意思/.test(t));
        /* a friendly move is welcomed; a full house says so */
        for (const [x, y] of [[a, c], [c, a]]) Object.assign(OC.Mind.rel(x.id, y.id), { aff: 80, fam: 80, type: 'family' });
        const r3 = H.moveIn(c.id, 'yellow'); out.full = r3.why;
        const r4 = H.moveIn(c.id, 'purple'); out.empty = r4.ok;
        OC.UI.back();
        return out;
      }, ids);
      check('45 入住管理：搬進有人住的房子，原住戶依關係和個性反應（這次「不想」並說原因）；在頁面上看到反應、可以強制入住（不跳確認視窗），之後關係變差、留下回憶；房子滿了會說', !r.r1.ok && r.r1.can && r.r1.re[0].startsWith('refuse') && r.shown.includes('refuse') && r.dialogs === 0 && r.moved === 'yellow' && r.conflict[1] > r.conflict[0] && r.mem && /最多住 2 人/.test(r.full || '') && r.empty, r);
    }
    if (want(46)) {
      const ids = await prep168();
      const r = await page.evaluate(async (ids) => {
        const H = OC.House16, [a, b] = ids.map((id) => OC.Chars.get(id)), out = {}, mail0 = (OC.Store.s.mail || []).length;
        H.moveIn(a.id, 'purple'); H.moveIn(b.id, 'purple'); a.personality.traits.push('neatfreak'); b.personality.traits.push('messy');
        const r0 = Object.assign({}, OC.Mind.relPeek(a.id, b.id)); for (let d = 0; d < 7; d++) H.dayStep(700 + d);
        const r1 = OC.Mind.relPeek(a.id, b.id); out.fam = [r0.fam, r1.fam]; out.conflict = [r0.conflict, r1.conflict];
        out.mail = JSON.stringify(OC.Store.s.mail || OC.Store.s.life.mail || []).includes('紫屋頂連棟屋的這一週') || JSON.stringify(OC.Store.s).includes('連棟屋的這一週');
        out.mem = OC.Mind.memories(a, {}).map((m) => m.text).filter((t) => /亂不亂/.test(t)).length;
        void mail0; return out;
      }, ids);
      check('46 同居日常：住在一起每天更熟；生活習慣不合（潔癖對邋遢）會累積摩擦、有時留下回憶；每週收到一封「這一週」的信', r.fam[1] >= r.fam[0] + 7 && r.conflict[1] > r.conflict[0] && r.mail, r);
    }
    if (want(47)) {
      const ids = await prep168();
      const r = await page.evaluate(async (ids) => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), H = OC.House16, [a, b] = ids.map((id) => OC.Chars.get(id)), ba = OC.Brain.get(a.id), bb = OC.Brain.get(b.id), out = {};
        H.moveIn(a.id, 'coral'); b.profile.age = '0'; H.moveIn(b.id, 'coral', { force: true });
        const q = OC.World.nearestWalkable(ba.a.x + 40, ba.a.y, 40); bb.a.path = null; bb.a.x = q.x; bb.a.y = q.y;
        Object.assign(b.needs, { food: 20, social: 30, comfort: 30 }); OC.Brain.setControl(a.id, 'semi'); ba.manualOverride = 0;
        const cand = H.shape(a, ba, []).find((x) => x.act === 'babycare16'); out.cand = cand && cand.why[0];
        out.notMenu = !JSON.stringify(OC.Menu16.charRing(a.id)).includes('babycare16');
        if (ba.st === 'do') OC.Brain.finish(ba, 't'); else if (ba.st === 'go') OC.Brain.abort(ba, 't');
        ba.queuedPt = cand.target.pt; OC.Brain.command(a.id, 'babycare16');
        const t0 = Date.now(); while (!(H.st(b).cared) && Date.now() - t0 < 90000) await sleep(300);
        out.cared = H.st(b).cared || 0; out.food = b.needs.food;
        /* milestones become memories (after enough days and care) */
        H.st(b).cared = 20; for (let d = 0; d < 21; d++) H.babies(900 + d);
        out.ms = Object.keys(H.st(b).ms || {}); out.mem = OC.Mind.memories(a, {}).map((m) => m.text).filter((t) => t.includes(OC.Chars.name(b))).slice(0, 3);
        b.profile.age = '25'; OC.Brain.setControl(a.id, 'manual');
        return out;
      }, ids);
      check('47 寶寶：同住的大人看到寶寶需要照顧就去照顧（餵、抱、哄；不出現在選單），寶寶的需求回升；翻身、爬、站、走、第一句話會變成全家的回憶', r.cand && r.notMenu && r.cared >= 1 && r.food > 20 && r.ms.length === 5 && r.mem.length >= 1, r);
    }
    if (want(48)) {
      const ids = await prep168();
      const r = await page.evaluate(async (ids) => {
        const H = OC.House16, [a, b, c] = ids.map((id) => OC.Chars.get(id)), out = {}, n0 = OC.Chars.all().length, can0 = OC.Budget.can;
        H.moveIn(a.id, 'purple'); H.moveIn(b.id, 'purple', { force: true }); OC.Opening.setStart(a.id, b.id, 'spouse');
        OC.Budget.can = () => true;
        /* off by default: nothing is asked */
        for (let d = 0; d < 40; d++) H.family(1000 + d); out.offAsk = !!(H.SAVE().asking);
        OC.Store.s.life.settings.family16 = true;
        let d = 1100; while (!H.SAVE().asking && d < 1400) { H.family(d); d += 1; } out.asked = !!H.SAVE().asking;
        await new Promise((res) => setTimeout(res, 400)); out.sheet = !!document.querySelector('.sheet.open [data-h16=yes]');
        if (out.sheet) document.querySelector('.sheet.open [data-h16=yes]').click(); else H.answerChild('yes');
        await new Promise((res) => setTimeout(res, 300)); out.pending = H.SAVE().pending.length;
        H.family(H.SAVE().pending[0].due); const kid = OC.Chars.all().find((x) => !ids.includes(x.id) && x.profile.age === '0');
        out.born = !!kid; out.kidHome = kid && H.houseOf(kid); out.label = kid && OC.Mind.relPeek(a.id, kid.id).label16; out.kidSees = kid && OC.Mind.relPeek(kid.id, a.id).label16;
        /* adoption from a house; a minor cannot adopt */
        H.moveIn(c.id, 'coral'); const ad = H.adopt({ parents: [c.id], stage: 'child', name: '小葵', hid: 'coral' }); out.adopt = ad.ok;
        c.profile.age = '15'; out.minor = H.adopt({ parents: [c.id], stage: 'child', hid: 'coral' }).why; c.profile.age = '25';
        const T = H.tree(); out.gens = T.rows.length; out.n = OC.Chars.all().length - n0;
        OC.Pages.open('homes16'); await new Promise((res) => setTimeout(res, 500)); const pg = document.querySelector('.page.open[data-page=homes16]'); pg.querySelector('[data-tab=tree]').click(); await new Promise((res) => setTimeout(res, 400));
        out.treeGens = pg.querySelectorAll('.h16-gen').length; out.hearts = pg.querySelectorAll('.h16-heart').length; OC.UI.back();
        OC.Budget.can = can0; OC.Store.s.life.settings.family16 = false;
        /* clean up the new characters so later tests keep their cast */
        for (const x of OC.Chars.all()) if (!ids.includes(x.id) && (x.profile.age === '0' || x.profile.name === '小葵')) OC.Chars.remove ? OC.Chars.remove(x.id) : null;
        return out;
      }, ids);
      check('48 家庭（預設關閉，打開才會問）：同住的伴侶想要孩子 → 先問你（三個選項），答應幾天後寶寶出生、住進同一間房、關係是父母與孩子；也可以從房子領養（未成年不行）；家族樹分代、伴侶有 ♥', !r.offAsk && r.asked && r.pending === 1 && r.born && r.kidHome === 'purple' && r.label === '孩子' && r.kidSees === '爸媽' && r.adopt && /成年/.test(r.minor || '') && r.gens >= 2 && r.treeGens >= 2 && r.hearts >= 1 && r.n === 2, r);
    }
    check('沒有未預期的錯誤', errors.filter((e) => !/deprecated|readback|favicon/.test(e)).length === 0, errors.slice(0, 4));
  } finally { await browser.close(); }
  const bad = H.results.filter((x) => !x.ok).length; console.log(`\n${H.results.length - bad}/${H.results.length} 通過`); process.exit(bad ? 1 : 0);
})();
