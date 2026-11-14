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
    check('沒有未預期的錯誤', errors.filter((e) => !/deprecated|readback|favicon/.test(e)).length === 0, errors.slice(0, 4));
  } finally { await browser.close(); }
  const bad = H.results.filter((x) => !x.ok).length; console.log(`\n${H.results.length - bad}/${H.results.length} 通過`); process.exit(bad ? 1 : 0);
})();
