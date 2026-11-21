/* OC Shimeji — 17.0 acceptance: node game/tests/v17/run.js [1 2 …]   (start `cd game && python3 -m http.server 8765` first)
 * 1 the screen guard clears every covering that has no owner (grey scrim, dead layers, letterbox, stage bars, talking, scene)
 * 2 tapping the grey scrim closes the sheet under it even when an invisible layer is on top; a swipe released below the sheet ends
 * 3 the 3D view lost and not restored → a reload card; the guard log in 關於
 * 4 the background-removal sheet is really on screen and 套用 by touch works
 * 17.1 background life: 5 the same save + the same absence → the same story (30 days, ≤ 10 s, no coins or items) · 6 a clock that went
 *   backwards is not simulated · 7 the game cycle goes on while away (離開時暫停 stops it) · 8 outings happen and are settled while away,
 *   a day away is not a missed work day · 9 「你不在的時候」 and the timeline by real touch (open, long press = 收藏, filters, 繼續觀察)
 *   · 10 the end of a day you watched: a card and the day closed in the timeline · 11 background life off = the old eight hours
 *   · 12 the timeline: 「正在發生」 on top of today, a filter by place */
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
    if (want(4)) {
      /* the background-removal sheet (16.3) is a .sheet that never got .open: it sat below the screen with the grey scrim on */
      const openCut = () => page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 100; cv.height = 140; const g = cv.getContext('2d'); g.fillStyle = '#0f0'; g.fillRect(0, 0, 100, 140); g.fillStyle = '#f80'; g.fillRect(30, 30, 40, 80);
        window.__cut = 'pending'; window.__cy = 0; OC.Frame16.cutSheet([cv]).then((v) => { window.__cut = v; }); });
      const isShown = () => wait(() => { const el = document.querySelector('.fr-cut'); if (!el) return false; const r = el.getBoundingClientRect(); const ok = r.bottom <= innerHeight + 1 && r.top < innerHeight - 100 && Math.abs(r.top - (window.__cy || 0)) < 0.5; window.__cy = r.top; return ok; }, 10000);
      await openCut(); let shown = await isShown(); let retried = false;
      if (!shown && !(await page.evaluate(() => !!document.querySelector('.fr-cut')))) { retried = true; await openCut(); shown = await isShown(); }   /* something on the island (an event) closed it before it settled: once more */
      await page.waitForTimeout(500);
      const b = await page.evaluate(() => { const btn = [...document.querySelectorAll('.fr-cut button')].find((x) => /套用/.test(x.textContent)); const r = btn.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.touchscreen.tap(b[0], b[1]);
      const applied = await wait(() => window.__cut && window.__cut !== 'pending' && !document.querySelector('.fr-cut') && !document.getElementById('scrim').classList.contains('on'));
      check('4 去背視窗真的出現在畫面上（不是藏在下面只留灰色遮罩），用手指按「套用」會套用並關閉', shown && applied, { shown, applied, b, retried });
    }

    /* ------------------------------------------------------------------ 17.1 background life */
    const away = (ms, o = {}) => page.evaluate(({ ms, o }) => { const S = OC.Store.s; S.life.settings.away17 = true; if (o.pause != null) S.life.settings.awayPause = o.pause; const T = Date.now(); S.life.lastReal = T - ms; const g = OC.Sim.awayRun(o.reason || 'test', T); return { g, off: S.life.offline }; }, { ms, o });
    await page.evaluate(() => { OC.Store.s.life.settings.autonomy = 'full'; });   /* test 1 paused it */
    if (want(5)) {
      const r = await page.evaluate(() => {
        const S0 = OC.Store.s; S0.life.settings.away17 = true; S0.life.settings.travel = true; S0.life.settings.health16 = true; OC.Sim.lifeSeed();
        const snap = JSON.stringify(S0), T = Date.now(), coins = S0.coins, inv = JSON.stringify(S0.inv);
        const run = () => { OC.Store.s.life.lastReal = T - 30 * 864e5; const t0 = performance.now(); OC.Sim.awayRun('test', T); const ms = performance.now() - t0; const o = OC.Store.s.life.offline;
          return { ms, ch: OC.Chronicle.range(o.from, o.to).map((x) => x.gm + ' ' + x.text), rel: JSON.stringify(OC.Store.s.life.rel), needs: JSON.stringify(OC.Chars.all().map((c) => [c.life.loc, c.needs, c.life.skills])), coins: OC.Store.s.coins, inv: JSON.stringify(OC.Store.s.inv), sim: o.simulated, days: Object.keys(OC.Store.s.life.away17.days).length }; };
        const a = run(); OC.Store.importJSON(snap); const b = run();
        let diff = -1; for (let i = 0; i < Math.max(a.ch.length, b.ch.length); i++) if (a.ch[i] !== b.ch[i]) { diff = i; break; }
        const kinds = new Set(a.ch.map((x) => /關係：/.test(x) ? 'rel' : /：/.test(x) ? 'mem' : 'act'));
        return { ms: [Math.round(a.ms), Math.round(b.ms)], n: [a.ch.length, b.ch.length], diff, rel: a.rel === b.rel, needs: a.needs === b.needs, coins: [coins, a.coins, b.coins], inv: inv === a.inv && inv === b.inv, sim: a.sim, days: a.days, kinds: [...kinds], places: new Set(a.ch.map((x) => (x.match(/在(.+?)(的|[^的]{1,4}（)/) || [])[1]).filter(Boolean)).size };
      });
      check('5 背景生活：同一個存檔、同一段離開 → 兩次結果完全相同（時間線、關係、需求、技能）；30 天在 10 秒內；不給星幣或物品', r.diff === -1 && r.n[0] > 300 && r.rel && r.needs && r.ms.every((x) => x <= 10000) && r.coins.every((x) => x === r.coins[0]) && r.inv && r.sim === 43200 && r.days >= 30 && r.kinds.length >= 2, r);
    }
    if (want(6)) {
      const r = await page.evaluate(() => { const S = OC.Store.s; S.life.settings.away17 = true; const gm = S.life.clock.gm, n = OC.Chronicle.range(gm - 1, gm + 1e6).length; S.life.lastReal = Date.now() + 3600e3; const g = OC.Sim.awayRun('test'); return { g, back: S.life.offline.backward, same: Math.abs(S.life.clock.gm - gm) < 1, n2: OC.Chronicle.range(gm - 1, gm + 1e6).length - n }; });
      const toast = await wait(() => [...document.querySelectorAll('.toast')].some((t) => /時間比上次早/.test(t.textContent)), 5000);
      check('6 手機的時間往回調：不推算、時鐘不倒退、沒有時間線，並提示原因', r.g === 0 && r.back >= 59 && r.same && r.n2 === 0 && toast, Object.assign(r, { toast }));
    }
    if (want(7)) {
      const r = await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'cycle'; const c = S.life.clock;
        const g0 = c.gm; S.life.settings.away17 = true; S.life.settings.awayPause = false; S.life.lastReal = Date.now() - 5 * 3600e3; OC.Sim.awayRun('test'); const d1 = c.gm - g0;
        const g1 = c.gm; S.life.settings.awayPause = true; S.life.lastReal = Date.now() - 5 * 3600e3; OC.Sim.awayRun('test'); const d2 = c.gm - g1; S.life.settings.awayPause = false; return { d1: Math.round(d1), d2: Math.round(d2) }; });
      check('7 遊戲循環：離開 5 小時＝島上也過了 5 小時；打開「離開時暫停」就不前進', Math.abs(r.d1 - 300) <= 2 && r.d2 === 0, r);
    }
    if (want(8)) {
      const r = await page.evaluate(() => {
        const S = OC.Store.s, cs = OC.Chars.all(), [a, b] = cs; S.life.settings.away17 = true; S.life.settings.travel = true; S.settings.calendar = 'game';
        const day = OC.Sim.day() + 1, res = OC.Outing16.invite({ host: a.id, guests: [b.id], place: 'beach', day, hour: 15 });
        if (res.ok) { res.plan.rsvp[b.id] = { yes: true, why: 'test' }; res.plan.status = 'planned'; }
        const why = OC.Career16.canTake(b, 'barista'); if (!why) OC.Career16.takeJob(b.id, 'barista'); const j = OC.Career16.st(b).job; if (j) j.since = OC.Sim.day() - 5;
        S.life.lastReal = Date.now() - 3 * 864e5; OC.Sim.awayRun('test');
        const p = res.ok ? OC.Outing16.plans().find((x) => x.id === res.plan.id) : null;
        let checked = 0; const t = OC.Sim.day(); for (let d = t - 2; d <= t; d++) { if (OC.Away.wasAway(d - 1) && !OC.Clock.cal(d - 1).weekend) { OC.Career16.dayStep(d); checked++; } }
        return { ok: res.ok, why: res.why, status: p && p.status, away: p && p.away, mem: OC.Chronicle.range(day * 1440, day * 1440 + 1440).filter((x) => x.who.includes(a.id) && /星砂海灘/.test(x.text)).length, job: j && { miss: j.miss, awayDays: j.awayDays || 0 }, checked, jobWhy: why };
      });
      check('8 離開時約好的出遊照樣出發並結算（不用你在場）；離開的日子不算上班缺勤（也沒有薪水）', r.ok && r.status === 'done' && r.away && r.mem >= 1 && r.job && r.job.miss === 0 && (r.checked === 0 || r.job.awayDays >= 1), r);
    }
    if (want(9)) {
      const cdp = await page.context().newCDPSession(page);
      const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1 })) });
      const center = (sel) => page.evaluate((sel) => { const e = typeof sel === 'string' ? document.querySelector(sel) : null; if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
      await page.waitForTimeout(1000); await page.evaluate(() => { for (const l of OC.UI.stack.slice()) l.close(); }); await page.waitForTimeout(400);   /* a page left by an earlier absence */
      await away(2.2 * 864e5, { reason: 'resume' });
      const shown = await wait(() => !!document.querySelector('.aw17.on') && !!document.querySelector('.aw17-card[data-day]'), 8000);
      const info = await page.evaluate(() => ({ head: document.querySelector('.aw17-head').textContent, days: document.querySelectorAll('.aw17-card[data-day]').length, people: document.querySelectorAll('.aw17-person').length, best: document.querySelectorAll('.aw17-best').length }));
      await page.waitForTimeout(500);   /* the 0.35 s guard against a stray tap */
      let c = await center('[data-aw17=timeline]'); await page.touchscreen.tap(c[0], c[1]);
      const tl = await wait(() => document.querySelector('.page.open[data-page=chron17]') && !document.querySelector('.aw17') && document.querySelectorAll('.ch17-list .aw17-line').length > 3);
      await page.waitForTimeout(600);
      const row = await page.evaluate(() => { const e = document.querySelectorAll('.ch17-list .aw17-line')[1]; const r = e.getBoundingClientRect(); return { id: e.dataset.h, p: [r.left + 60, r.top + r.height / 2] }; });
      await T('touchStart', [row.p]); await page.waitForTimeout(800); await T('touchEnd', []);
      const fav = await wait(() => OC.Chronicle.favs().length === 1);
      c = await center('.ch17-top [data-tab=fav]'); await page.touchscreen.tap(c[0], c[1]);
      const favTab = await wait((id) => document.querySelectorAll('.ch17-list .aw17-line').length === 1, 4000);
      c = await center('.ch17-top [data-tab=day]'); await page.touchscreen.tap(c[0], c[1]); await page.waitForTimeout(400);
      const who = await page.evaluate(() => OC.Chars.all()[1].id);
      c = await center(`.ch17-top [data-who="${who}"]`); await page.touchscreen.tap(c[0], c[1]); await page.waitForTimeout(500);
      const filt = await page.evaluate((who) => { const ids = [...document.querySelectorAll('.ch17-list .aw17-line')].map((e) => e.dataset.h); const all = OC.Chronicle.days().flatMap((d) => OC.Chronicle.day(d)).concat(OC.Chronicle.favs()); return ids.length > 0 && ids.every((id) => (all.find((x) => x.id === id) || { who: [] }).who.includes(who)); }, who);
      const lab0 = await page.evaluate(() => document.querySelector('.ch17-nav b').textContent);
      c = await center('[data-nav=older]'); await page.touchscreen.tap(c[0], c[1]); await page.waitForTimeout(400);
      const older = await page.evaluate((l0) => document.querySelector('.ch17-nav b').textContent !== l0, lab0);
      await page.evaluate(() => OC.UI.back()); await page.waitForTimeout(400);
      /* a second absence: 繼續觀察 closes it and leaves nothing on the screen */
      await away(3 * 3600e3, { reason: 'resume' });
      const shown2 = await wait(() => !!document.querySelector('.aw17.on'), 8000); await page.waitForTimeout(500);
      c = await center('[data-aw17=continue]'); await page.touchscreen.tap(c[0], c[1]);
      const closed = await wait(() => !document.querySelector('.aw17') && !OC.UI.stack.some((l) => l.el && l.el.classList.contains('aw17')) && !OC.UI.stack.length && !document.getElementById('scrim').classList.contains('on'));
      check('9 「你不在的時候」：離開 2 天回來出現（離開多久、名場面、每天的大事與每個人一句）；用手指點「看完整時間線」、長按一條＝收藏、收藏分頁、只看某人、前一天；「繼續觀察」關掉後畫面乾淨', shown && /2 天/.test(info.head) && info.days >= 2 && info.people >= 2 && tl && fav && favTab && filt && older && shown2 && closed, { shown, info, tl, fav, favTab, filt, older, shown2, closed });
    }
    if (want(10)) {
      const r = await page.evaluate(() => { const S = OC.Store.s; S.life.settings.away17 = true; S.settings.time = 'cycle'; const cards = []; const cd = OC.Stage.card; OC.Stage.card = (o) => { cards.push(o.title); return cd(o); };
        const c = S.life.clock, d0 = Math.floor(c.gm / 1440); OC.Chronicle.log({ k: 'mem', who: [OC.Chars.all()[0].id], text: '測試：一件小事', w: 0.2 }); c.gm = d0 * 1440 + 1439.5; OC.Sim.advance(3); OC.Stage.card = cd;
        return { cards, end: OC.Chronicle.ends()[d0] || null }; });
      check('10 看著的那天結束：出現「… 結束了」卡片，那一天在時間線裡結算', r.cards.some((t) => /結束了/.test(t)) && r.end && r.end.n >= 1, r);
    }
    if (want(11)) {
      const r = await page.evaluate(() => { const S = OC.Store.s; S.life.settings.away17 = false; S.settings.time = 'real'; S.life.lastReal = Date.now() - 10 * 3600e3; const g = OC.Sim.catchUp('test'); const o = S.life.offline; S.life.settings.away17 = true; S.settings.time = 'cycle'; return { g, capped: o.capped, away17: !!o.away17 }; });
      check('11 關掉背景生活：回到舊的方式（最多 8 小時、只有需求變化）', r.g === 480 && r.capped && !r.away17, r);
    }
    if (want(12)) {
      await page.evaluate(() => { for (const l of OC.UI.stack.slice()) l.close(); const id = OC.Chars.all()[0].id; OC.Chronicle.log({ k: 'mem', who: [id], place: 'place:beach', text: '測試：在海灘', w: 0.3 }); OC.Chronicle.log({ k: 'mem', who: [id], place: 'place:cafe', text: '測試：在咖啡館', w: 0.3 }); OC.Pages.open('chron17'); });
      const now = await wait(() => document.querySelectorAll('.ch17-now [data-now]').length === OC.Chars.all().length);
      const pl = await page.evaluate(() => { const b = document.querySelector('.ch17-top [data-place]:not([data-place=""])'); if (!b) return { none: true }; const id = b.dataset.place; b.click(); return { id }; });
      await page.waitForTimeout(300);
      const ok = pl.none || await page.evaluate((id) => { const all = OC.Chronicle.days().flatMap((d) => OC.Chronicle.day(d)); const ids = [...document.querySelectorAll('.ch17-list .aw17-line')].map((e) => e.dataset.h); return ids.length > 0 && ids.every((h) => String((all.find((x) => x.id === h) || {}).place).replace('place:', '') === id); }, pl.id);
      await page.evaluate(() => OC.UI.back());
      check('12 時間線：今天最上面是「正在發生」（每個人現在在做什麼、在哪裡）；可以只看某個地點', now && !pl.none && ok, { now, pl, ok });
    }
    if (want(13)) {
      const r = await page.evaluate(() => {
        const S = OC.Store.s, [a, b] = OC.Chars.all(), c = b; S.life.settings.away17 = true; S.life.settings.health16 = true; S.life.settings.travel = true; S.life.settings.autonomy = 'full';
        /* a cold that should pass, a quarrel that should start and run its course, friends who may plan outings */
        OC.Health16.catchIt(c, 'cold', '測試', 'test17:cold');
        const k = [a.id, b.id]; for (const [x, y] of [k, k.slice().reverse()]) { const rr = OC.Mind.rel(x, y); OC.Mind.relChange(x, y, { fam: 40 - (rr.fam || 0), conflict: 60 - (rr.conflict || 0), aff: 45 - (rr.aff || 0) }, 'test'); rr.fixed = false; }
        const n0 = (S.life.chron17 ? Object.values(S.life.chron17.days).flat().length : 0), coins = S.coins, inv = JSON.stringify(S.inv);
        S.life.lastReal = Date.now() - 12 * 864e5; OC.Sim.awayRun('test');
        const rift = OC.Arcs.riftOf(a.id, b.id), ill = OC.Health16.H(c), all = Object.values(S.life.chron17.days).flat();
        return { coldGone: !ill.conds.some((x) => x.id === 'cold'), hist: ill.hist.map((x) => x.id), rift: rift && rift.stage, riftLines: all.filter((x) => /鬧得有點僵|和好了|不再像以前/.test(x.text)).length, aiPlans: OC.Outing16.plans().filter((p) => p.by === 'ai').map((p) => p.status), coins: S.coins === coins, inv: inv === JSON.stringify(S.inv) };
      });
      check('13 離開時也會：感冒會好、冷戰會開始並走完（和好或疏遠）、朋友自己約出遊並結算；仍然不給星幣物品', r.coldGone && r.rift && r.rift !== 'cold' && r.riftLines >= 2 && r.coins && r.inv, r);
    }
    if (want(14)) {
      const center = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
      await page.evaluate(() => { for (const l of OC.UI.stack.slice()) l.close(); const S = OC.Store.s; S.life.settings.away17 = true; if (!OC.Chronicle.day(OC.Sim.day()).length) { S.life.lastReal = Date.now() - 1.5 * 864e5; OC.Sim.awayRun('test'); } });
      await page.waitForTimeout(1200); await page.evaluate(() => { for (const l of OC.UI.stack.slice()) l.close(); });
      await page.evaluate(() => OC.App.tab('island')); await page.waitForTimeout(800);   /* the first look at the island writes 「第一次來到」 — not the replay's doing */
      const before = await page.evaluate(() => { OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; OC.Store.s.life.settings.autonomy = 'paused'; if (OC.Events.current) OC.Events.end('t'); OC.Store.s.settings.time = 'cycle'; OC.Store.s.settings.timePaused = true; /* the island clock stands still: only the replay could change anything */ const d = OC.Chronicle.days()[0]; OC.Pages.open('chron17', { day: d }); return { d, sig: JSON.stringify([OC.Store.s.life.chron17, OC.Store.s.life.rel, OC.Chars.all().map((c) => c.needs)]) }; });
      await page.waitForTimeout(800);
      let c = await center('[data-replay]'); await page.touchscreen.tap(c[0], c[1]);
      const opened = await wait(() => !!document.querySelector('.rp17.on'));
      await page.waitForTimeout(500);
      c = await center('.rp17 [data-speed="1024"]'); await page.touchscreen.tap(c[0], c[1]);
      const played = await wait(() => { const s = OC.AwayUI.Replay.state; return s && s.i >= Math.min(5, s.n); }, 8000);
      c = await center('.rp17 [data-rp=play]'); await page.touchscreen.tap(c[0], c[1]);
      const paused = await wait(() => OC.AwayUI.Replay.state && !OC.AwayUI.Replay.state.playing, 3000);
      await page.evaluate(() => OC.AwayUI.Replay.jump(600)); const jumped = await page.evaluate(() => { const s = OC.AwayUI.Replay.state; return Math.round(s.t) === 600 && document.querySelectorAll('.rp17-feed .aw17-line').length === Math.min(60, s.i); });
      c = await center('.rp17 [data-rp=island]'); await page.touchscreen.tap(c[0], c[1]); await page.waitForTimeout(600);
      const island = await page.evaluate(() => { const s = OC.AwayUI.Replay.state; return !!s && s.island && OC.App.curTab === 'island' && document.querySelector('.rp17').classList.contains('mini') && s.speed <= 64 && ![...document.querySelectorAll('.rp17 [data-speed]')].some((e) => +e.dataset.speed > 64); });
      await page.evaluate(() => { OC.AwayUI.Replay.jump(0); }); c = await center('.rp17 [data-speed="64"]'); await page.touchscreen.tap(c[0], c[1]); await page.waitForTimeout(2500);
      c = await center('.rp17 [data-rp=close]') || null; await page.evaluate(() => OC.UI.back()); 
      const closed = await wait(() => !document.querySelector('.rp17') && !document.documentElement.classList.contains('rp17-island'));
      const same = await page.evaluate((sig) => JSON.stringify([OC.Store.s.life.chron17, OC.Store.s.life.rel, OC.Chars.all().map((c) => c.needs)]) === sig || (() => { const o = JSON.parse(sig), n = [OC.Store.s.life.chron17, OC.Store.s.life.rel, OC.Chars.all().map((c) => c.needs)]; const A0 = o[0], A1 = n[0]; const nd = Object.keys(A1.days).filter((d) => JSON.stringify(A0.days[d]) !== JSON.stringify(A1.days[d])); const added = nd.flatMap((d) => (A1.days[d] || []).filter((x) => !(A0.days[d] || []).some((y) => y.id === x.id)).map((x) => x.text)); return ['chron', 'rel', 'needs'].filter((k, i) => JSON.stringify(o[i]) !== JSON.stringify(n[i])).join(',') + ' days:' + nd + ' added:' + added.slice(0, 4).join('/') + ' ends:' + (JSON.stringify(A0.ends) !== JSON.stringify(A1.ends)) + ' seq:' + A0.seq + '>' + A1.seq; })(), before.sig);
      await page.evaluate(() => { OC.Store.s.settings.timePaused = false; OC.Store.s.life.settings.autonomy = 'full'; });
      check('14 回放一天（真實觸控）：播放、1024×、暫停、跳到某個時間、在島上看（最快 64×）、返回鍵關閉；回放不改任何資料（時間線、關係）', opened && played && paused && jumped && island && closed && same === true, { opened, played, paused, jumped, island, closed, same });
    }
    if (want(15)) {
      const r = await page.evaluate(() => {
        const S = OC.Store.s, [a, b] = OC.Chars.all(); S.life.settings.away17 = true; S.life.settings.travel = true; S.life.settings.health16 = true; S.life.settings.autonomy = 'full'; OC.Sim.lifeSeed();
        /* something that will surely happen: a cold war to thaw, a relation about to change */
        const k = [a.id, b.id]; for (const [x, y] of [k, k.slice().reverse()]) { const rr = OC.Mind.rel(x, y); OC.Mind.relChange(x, y, { fam: 40 - (rr.fam || 0), conflict: 60 - (rr.conflict || 0), aff: 45 - (rr.aff || 0) }, 'test'); }
        S.life.lastReal = Date.now(); OC.Store.persist = () => {};
        const before = OC.Store.exportJSON(), st0 = OC.Chars.all().map((c) => { const bb = OC.Brain.get(c.id); return bb && bb.st; }).join();
        let sent = null, cleared = 0; window.OCNative = { forecastSet: (j) => { sent = JSON.parse(j); return true; }, forecastClear: () => { cleared++; } };
        const f = OC.Forecast.run(24), same = OC.Store.exportJSON() === before, st1 = OC.Chars.all().map((c) => { const bb = OC.Brain.get(c.id); return bb && bb.st; }).join();
        const off = OC.Forecast.pick(f, Object.assign({}, OC.Forecast.DEF)).length;
        const on = OC.Forecast.pick(f, Object.assign({}, OC.Forecast.DEF, { on: true, max: 3, night: true }));
        OC.Forecast.set().on = false; const pkt1 = OC.Forecast.onPause(); OC.Forecast.set().on = true; OC.Forecast.set().night = true; const pkt2 = OC.Forecast.onPause(); OC.Forecast.onResume();
        /* now really live those 24 hours: the forecast's moments happen, at the same game minutes */
        S.life.lastReal = f.base; OC.Sim.awayRun('test', f.base + 24 * 3600e3);
        const real = OC.Chronicle.range(f.from, f.from + 1440).map((x) => x.gm + '|' + x.text), hit = f.items.filter((x) => real.includes(x.gm + '|' + x.text)).length;
        delete window.OCNative;
        return { list: f.items.map((x) => [x.kind, x.at - f.base, x.text]), same, brains: st0 === st1, items: f.items.length, hit, off, on: on.length, onOk: on.every((x) => x.at > f.base && x.title && x.text), doing: Object.values(f.doing).map((L) => L.length), pkt1: pkt1 && pkt1.items.length, pkt2: pkt2 && pkt2.items.length, sent: !!sent, cleared };
      });
      check('15 背景預測：App 進入背景時先算好接下來 24 小時（算完存檔完全還原、畫面上的角色不受影響）；之後真的過這 24 小時，預測的大事在同一個時間發生；通知預設關閉、打開後最多 N 則；小工具每小時一句「大概在做什麼」；回到 App 就清掉', r.same && r.brains && r.items > 0 && r.hit === r.items && r.off === 0 && r.on > 0 && r.on <= 3 && r.onOk && r.doing.every((n) => n >= 20) && r.pkt1 === 0 && r.pkt2 > 0 && r.sent && r.cleared >= 1, r);
    }
    /* last: it takes the 3D view down for good */
    if (want(3)) {
      await page.evaluate(() => { OC.World.renderer.getContext().getExtension('WEBGL_lose_context').loseContext(); });
      const a = await wait(() => !!document.querySelector('.guard-card button'), 12000);
      const log = await page.evaluate(() => OC.Guard.log().map((x) => x.what));
      await page.evaluate(() => { const c = document.querySelector('.guard-card'); if (c) c.remove(); window.__ocFail = null; });
      await page.evaluate(() => OC.Pages.open('about')); await page.waitForTimeout(800);
      const about = await page.evaluate(() => !!document.querySelector('.page.open[data-page=about] [data-guardlog]') && /3D 畫面中斷/.test(document.querySelector('.page.open[data-page=about]').textContent));
      check('3 3D 畫面中斷又沒有恢復：出現「重新載入畫面」（先存檔）；「關於」列出安全網紀錄', a && log.includes('webgl-lost') && about, { a, log, about });
    }
    check('沒有未預期的錯誤', errors.filter((e) => !/deprecated|readback|favicon|context lost|CONTEXT_LOST|WebGL/i.test(e)).length === 0, errors.slice(0, 4));
  } finally { await browser.close(); }
  const bad = H.results.filter((x) => !x.ok).length; console.log(`\n${H.results.length - bad}/${H.results.length} 通過`); process.exit(bad ? 1 : 0);
})();
