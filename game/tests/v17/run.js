/* OC Shimeji — 17.0 acceptance: node game/tests/v17/run.js [1 2 …]   (start `cd game && python3 -m http.server 8765` first)
 * 1 the screen guard clears every covering that has no owner (grey scrim, dead layers, letterbox, stage bars, talking, scene)
 * 2 tapping the grey scrim closes the sheet under it even when an invisible layer is on top; a swipe released below the sheet ends
 * 3 the 3D view lost and not restored → a reload card; the guard log in 關於
 * 4 the background-removal sheet is really on screen and 套用 by touch works
 * 17.1 background life: 5 the same save + the same absence → the same story (30 days, ≤ 10 s, no coins or items) · 6 a clock that went
 *   backwards is not simulated · 7 the game cycle goes on while away (離開時暫停 stops it) · 8 outings happen and are settled while away,
 *   a day away is not a missed work day · 9 「你不在的時候」 and the timeline by real touch (open, long press = 收藏, filters, 繼續觀察)
 *   · 10 the end of a day you watched: a card and the day closed in the timeline · 11 background life off = the old eight hours
 *   · 12 the timeline: 「正在發生」 on top of today, a filter by place
 * 17.3 relationships: 20 settled once a day (two days, fixed untouched) · 21 drifting apart, letting go · 22 crush / mutual (adults,
 *   romance on), commitments only by events with a yes · 23 anniversaries · 24 the affection page and the three layers (real touch)
 * 17.2 observation mode: 16 the switch by real touch (controls hidden, modes made 全自動 and put back, faces, the person card, a tap in the
 *   world follows) · 17 speeds 1×–60× only while watching · 18 the camera goes to what happens; your own pick is kept · 19 the floor plan */
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
        const S0 = OC.Store.s; S0.life.settings.away17 = true; S0.life.settings.travel = true; S0.life.settings.health16 = true; S0.life.settings.daily17 = true; /* 17.3: the daily settlement must tell the same story too */ OC.Sim.lifeSeed();
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
    /* 17.2 observation mode */
    const ctr = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
    const tapSel = async (sel) => { const c = await ctr(sel); if (!c) return false; await page.touchscreen.tap(c[0], c[1]); return true; };
    const calmObs = () => page.evaluate(async () => { if (OC.Observe.on) OC.Observe.leave(); for (const l of OC.UI.stack.slice()) l.close(); OC.App.tab('island'); if (OC.Events.current) OC.Events.end('t'); const S = OC.Store.s; S.life.ev.lastAny = Date.now() + 3.6e6; S.settings.timePaused = false;
      if (OC.World.area.id !== 'isle') { OC.WorldUI.travel('isle', { instant: true }); await new Promise((r) => setTimeout(r, 2500)); }
      for (const c of OC.Chars.all()) { c.life.loc = 'isle'; c.life.trip = null; c.status.onIsland = true; } OC.App.syncPresence(); await new Promise((r) => setTimeout(r, 1200)); });
    if (want(16)) {
      await calmObs();
      const before = await page.evaluate(() => { const S = OC.Store.s, [a, b] = OC.Chars.all(); OC.Brain.setControl(a.id, 'manual'); OC.Brain.setControl(b.id, 'semi'); OC.Chars.setActive(a.id); OC.App.refreshActors(); S.settings.time = 'cycle'; OC.Sim.setSpeed(2);
        return { a: a.id, b: b.id, ctl: OC.Chars.all().map((c) => c.life.control), speed: OC.Sim.speed(), active: S.activeId }; });
      await page.waitForTimeout(600);
      await page.evaluate(() => { for (const l of OC.UI.stack.slice()) l.close(); }); await page.waitForTimeout(400);
      await tapSel('.rail-toggle');
      await wait(() => { const r = document.querySelector('[data-obs17]').getBoundingClientRect(); const ok = r.width >= 44 && Math.abs(r.left - (window.__rl || 0)) < 0.5; window.__rl = r.left; return ok; }, 5000);   /* the rail has finished opening */
      const dbg16 = await page.evaluate(() => { const b = document.querySelector('[data-obs17]'), r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r: [Math.round(r.left), Math.round(r.top), Math.round(r.width)], e: e && (e.tagName + '.' + String(e.className).slice(0, 40)), open: document.querySelector('.hud-rail').classList.contains('open'), stack: OC.UI.stack.length }; });
      const railOk = await tapSel('[data-obs17]');
      const entered = await wait(() => document.documentElement.classList.contains('obs17-on') && !!document.querySelector('.obs17 .obs17-p'));
      const ui = await page.evaluate(() => { const vis = (s) => [...document.querySelectorAll(s)].some((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden'); return { name: vis('.hud-me'), rail: vis('.hud-rail'), tabs: vis('.tabbar'), time: vis('.hud-time'), faces: document.querySelectorAll('.obs17-p').length, ctl: OC.Chars.all().map((c) => c.life.control) }; });
      /* tap the other one's face: the camera follows, the card tells what they are doing, how they are, today and who they are close to */
      await page.waitForTimeout(700);
      await tapSel(`.obs17-p[data-oc="${before.b}"]`);
      const card = await wait(() => { const c = document.querySelector('.obs17-card'); return c && !c.hidden && /現在/.test(c.textContent) && /精力/.test(c.textContent) && /今天/.test(c.textContent) && /和誰/.test(c.textContent); }, 4000);
      const followed = await wait(() => OC.Observe.state.follow === OC.Chars.all()[1].id && !!OC.World.camTarget && OC.World.camTarget === OC.App.actorOf(OC.Chars.all()[1].id), 4000);
      /* tapping a character in the world while watching = the same (nothing is done to it) */
      await tapSel(`.obs17-p[data-oc="${before.b}"]`); const closedCard = await wait(() => { const c = document.querySelector('.obs17-card'); return c.hidden && c.getBoundingClientRect().height === 0; }, 3000);   /* the face again closes the card */
      await page.evaluate((id) => { window.__ocInputLog = []; OC.Store.s.life.settings.autonomy = 'paused'; const bb = OC.Brain.get(id); if (bb.st === 'do') OC.Brain.finish(bb, 't'); if (bb.st === 'go') OC.Brain.abort(bb, 't'); const a = OC.App.actorOf(id), p = OC.World.nearestWalkable(200, 470, 40); if (p) { a.x = p.x; a.y = p.y; a.path = null; } OC.World.setAction(a, 'idle'); }, before.b);   /* standing on open ground (not on a bench) */
      await page.waitForTimeout(1800);   /* the camera is on them: they stand in the middle */
      const pt = await page.evaluate((id) => { const a = OC.App.actorOf(id), p = OC.World.project(a.x, a.y, OC.World.levelAt(a.x, a.y), 16); return [p.x, p.y]; }, before.b);
      await page.touchscreen.tap(pt[0], pt[1]);
      const worldTap = closedCard && await wait(() => OC.Observe.card === OC.Chars.all()[1].id && !document.querySelector('.obs17-card').hidden && !OC.Radial.open_ && !document.querySelector('.pick-card.on'), 4000);
      const dbgTap = await page.evaluate(() => ({ card: OC.Observe.card, follow: OC.Observe.state.follow, ring: !!OC.Radial.open_, log: (window.__ocInputLog || []).slice(-4) }));
      dbgTap.pt = pt; dbgTap.at = await page.evaluate((pt) => document.elementsFromPoint(pt[0], pt[1]).slice(0, 4).map((e) => e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 30)), pt);
      await tapSel('[data-obs="end"]');
      await page.evaluate(() => { OC.Store.s.life.settings.autonomy = 'full'; window.__ocInputLog = null; });
      const left = await wait(() => !document.documentElement.classList.contains('obs17-on') && !document.querySelector('.obs17'));
      const after = await page.evaluate(() => ({ ctl: OC.Chars.all().map((c) => c.life.control), speed: OC.Sim.speed(), active: OC.Store.s.activeId, focus: OC.World.camTarget, tabs: getComputedStyle(document.querySelector('.tabbar')).visibility }));
      check('16 觀察模式（真實觸控）：工具把手 →「觀察」→ 操作按鈕與導覽列收起、只留時間與人物條；你操控的（和手動的）角色改成全自動；點頭像＝鏡頭跟著那個人、人物卡寫現在在做什麼、精力／飽腹／心情、今天的事、和誰；在世界裡點角色也是看他（不會打開選單）；「結束觀察」恢復原本的操控模式、速度與操控的角色',
        railOk && entered && !ui.name && !ui.rail && !ui.tabs && ui.time && ui.faces === 2 && ui.ctl.every((m) => m === 'auto' || m === 'semi') && ui.ctl[0] === 'auto' && card && followed && worldTap && left && JSON.stringify(after.ctl) === JSON.stringify(before.ctl) && after.speed === before.speed && after.active === before.active && !after.focus && after.tabs !== 'hidden',
        { dbg16, before, ui, card, followed, worldTap, dbgTap, after: Object.assign({}, after, { focus: !!after.focus }) });
    }
    if (want(17)) {
      await calmObs();
      const r0 = await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'cycle'; OC.Sim.setSpeed(1); OC.Observe.enter(); return { speed: OC.Sim.speed() }; });
      await page.waitForTimeout(800);
      const segs = await page.evaluate(() => [...document.querySelectorAll('.obs17-speed button')].map((b) => b.textContent));
      await tapSel('.obs17-speed button:last-child');
      const fast = await wait(() => OC.Sim.speed() === 60 && OC.World.walkMul === 2, 3000);
      const g0 = await page.evaluate(() => [OC.Sim.now(), performance.now()]); await page.waitForTimeout(2500);
      const rate = await page.evaluate((g0) => (OC.Sim.now() - g0[0]) / ((performance.now() - g0[1]) / 1000), g0);   /* game minutes per real second */
      const outside = await page.evaluate(() => { OC.Observe.leave(); const back = OC.Sim.speed(), walk = OC.World.walkMul; OC.Sim.setSpeed(60); const no60 = OC.Sim.speed(); OC.Store.s.settings.timeSpeed = 60; const stale = OC.Sim.speed(); OC.Sim.setSpeed(1); return { back, walk, no60, stale }; });
      const real = await page.evaluate(() => { OC.Store.s.settings.time = 'real'; OC.Observe.enter(); return null; });
      await page.waitForTimeout(800);
      const realUi = await page.evaluate(() => ({ seg: !!document.querySelector('.obs17-speed'), btn: !!document.querySelector('[data-obs="time"]') }));
      await page.evaluate(() => { OC.Observe.leave(); OC.Store.s.settings.time = 'cycle'; });
      check('17 觀察時的時間速度：遊戲循環可選 1×、2×、5×、10×、30×、60×（60× ＝ 每秒約 60 遊戲分鐘，走路也快一點）；離開觀察回到原本的速度，30×／60× 在觀察以外不能用；真實時間時改成一個說明按鈕',
        JSON.stringify(segs) === JSON.stringify(['×1', '×2', '×5', '×10', '×30', '×60']) && fast && rate > 35 && rate < 75 && outside.back === 1 && outside.walk === 1 && outside.no60 === 1 && outside.stale === 1 && !realUi.seg && realUi.btn,
        { segs, fast, rate: Math.round(rate), outside, realUi });
    }
    if (want(18)) {
      await calmObs();
      const ids = await page.evaluate(() => { const [a, b] = OC.Chars.all(); for (const c of [a, b]) OC.Brain.setControl(c.id, 'semi'); OC.Store.s.settings.time = 'cycle'; OC.Sim.setSpeed(1); OC.Observe.enter(); OC.Observe.follow(a.id); return [a.id, b.id]; });
      await page.waitForTimeout(700);
      /* something happens between the two: the director goes there by itself */
      const started = await page.evaluate(async (ids) => { const [ba, bb] = ids.map((id) => OC.Brain.get(id)); for (const b of [ba, bb]) { [...b.holds].forEach((x) => OC.Brain.unhold(b.id, x)); if (b.st === 'do') OC.Brain.finish(b, 't'); if (b.st === 'go') OC.Brain.abort(b, 't'); b.st = 'think'; b.thinkAt = 1e9; }
        const ok = OC.Brain.Social.start(bb, ba, 'chat'); return ok; }, ids);
      const talking = await wait(() => OC.Brain.convs.some((c) => c.st === 'talk'), 20000);
      const directed = await wait(() => { const h = OC.Observe.hot(); return h.length && /在/.test(h[0].why) && /在/.test(document.querySelector('.obs17-cap').textContent) && h.some((x) => x.id === OC.Observe.state.follow && /在/.test(x.why)); }, 15000);
      const cap = await page.evaluate(() => document.querySelector('.obs17-cap').textContent);
      /* picking someone yourself: the director leaves them alone */
      await tapSel(`.obs17-p[data-oc="${ids[0]}"]`); const picked = await page.evaluate(() => OC.Observe.state.follow);
      await page.waitForTimeout(7000); const kept = await page.evaluate(() => OC.Observe.state.follow);
      await page.evaluate(() => OC.Observe.leave());
      check('18 自動鏡頭：島上有事（兩個人聊起來；已經在說話也算）鏡頭自己過去、上方寫「誰和誰在聊天」；自己點了某個人之後，自動鏡頭不會馬上把鏡頭搶走',
        (started || talking) && talking && directed && /在/.test(cap) && picked === ids[0] && kept === ids[0], { started, talking, directed, cap, picked, kept });
    }
    if (want(19)) {
      await calmObs();
      const r = await page.evaluate(() => { const [a, b] = OC.Chars.all(); OC.Chars.setActive(a.id); OC.App.refreshActors();
        OC.Homes.assign(b, 'coral'); b.life.loc = 'home'; b.life.trip = null; b.life.pos = { area: 'home', x: 150, y: 400 }; OC.App.syncPresence();
        OC.Observe.enter(); OC.Pages.open('plan17', { place: 'home' }); return { a: a.id, b: b.id, homes: OC.Observe.homes(), dots: OC.Observe.dots('home').map((d) => [d.id, d.exact]) }; });
      await page.waitForTimeout(900);
      const page1 = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('[data-plan]')].map((e) => e.dataset.plan), out: [...document.querySelectorAll('[data-plan-oc]')].map((e) => e.dataset.planOc), drawn: (() => { const cv = document.querySelector('.plan17-cv'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; })() }));
      const dot = await page.evaluate((id) => { const p = OC.Pages.pages.plan17, cv = p.cv.getBoundingClientRect(), hit = p.hits.find((x) => x.id === id); return hit ? [cv.left + hit.x, cv.top + hit.y] : null; }, r.b);
      if (dot) await page.touchscreen.tap(dot[0], dot[1]);
      const went = await wait((id) => OC.World.area && OC.World.area.id === 'home' && !document.documentElement.classList.contains('page-open') && OC.Observe.state.follow === OC.Chars.all()[1].id, 9000);
      const mid = await page.evaluate(() => ({ area: OC.World.area.id, active: OC.Store.s.activeId }));
      await page.evaluate(() => OC.Observe.leave());
      const back = await wait((id) => OC.Store.s.activeId === OC.Chars.all()[0].id && OC.World.area && OC.World.area.id === 'isle', 9000);
      check('19 戶型總覽：住處的 2D 俯瞰圖（每間一個分頁），圓點標出在家的人（沒在畫面上的是空心＝大概位置），不在家的列在下面；點圓點＝關掉頁面、鏡頭去那個人那裡（別的地點就過去）；結束觀察回到原本操控的角色',
        r.homes.includes('home') && r.dots.some((d) => d[0] === r.b && d[1] === false) && page1.tabs.length === r.homes.length && page1.out.includes(r.a) && page1.drawn > 1000 && !!dot && went && back,
        { r, page1, dot: !!dot, went, mid, back });
    }
    /* 17.3 relationships settled once a day */
    const prep173 = () => page.evaluate(() => { if (OC.Observe && OC.Observe.on) OC.Observe.leave(); for (const l of OC.UI.stack.slice()) l.close(); if (OC.Events.current) OC.Events.end('t'); const S = OC.Store.s; S.life.ev.lastAny = Date.now() + 3.6e6; S.life.settings.daily17 = true; S.life.settings.lockRel = false;
      const [a, b] = OC.Chars.all(); for (const c of [a, b]) c.profile.age = '25'; for (const [x, y] of [[a, b], [b, a]]) { const r = OC.Mind.rel(x.id, y.id); Object.assign(r, { type: 'acquaintance', fixed: false, fam: 10, aff: 10, trust: 20, intim: 0, conflict: 0, b17: null, lv17: null, lay17: null, st17: null, since: OC.Sim.day() - 3, last: OC.Sim.now() }); }
      S.life.settings.romance = Object.assign(S.life.settings.romance, { enabled: false, adult: {}, forbid: [], fixed: {} }); OC.Bond17.st().log = []; OC.Bond17.st().anniv = {}; OC.Bond17.st().last = OC.Sim.day(); return [a.id, b.id]; });
    if (want(20)) {
      await prep173();
      const r = await page.evaluate(() => {
        const [a, b] = OC.Chars.all(), M = OC.Mind, Bd = OC.Bond17, d0 = OC.Sim.day(), T = (x, y) => M.rel(x.id, y.id).type;
        M.relPair(a.id, b.id, { fam: 40, aff: 40 }, 't'); const instant = T(a, b);   /* the numbers say 朋友 now — the name waits for the settlement */
        Bd.settle(d0 + 1); const day1 = T(a, b), soon = M.rel(a.id, b.id).b17.n;
        Bd.settle(d0 + 2); const day2 = T(a, b), log = Bd.changesOf(a.id).map((x) => [x.from, x.to, x.kind]);
        /* one bad day in between does not flip it back and forth */
        M.relPair(a.id, b.id, { aff: -12 }, 't'); Bd.settle(d0 + 3); M.relPair(a.id, b.id, { aff: 12 }, 't'); Bd.settle(d0 + 4); const steady = T(a, b);
        /* a fixed relationship never changes by itself */
        for (const x of [M.rel(a.id, b.id), M.rel(b.id, a.id)]) x.fixed = true; M.relPair(a.id, b.id, { aff: 60, trust: 60, fam: 60 }, 't'); Bd.settle(d0 + 5); Bd.settle(d0 + 6); const fixed = T(a, b);
        for (const x of [M.rel(a.id, b.id), M.rel(b.id, a.id)]) x.fixed = false; Bd.settle(d0 + 7); Bd.settle(d0 + 8); const unfixed = T(a, b);
        const twice = Bd.settle(d0 + 8);   /* the same day twice = nothing */
        return { instant, day1, soon, day2, log, steady, fixed, unfixed, twice };
      });
      check('20 關係每天結算：數字一變名稱不會馬上變；連續兩天都這樣說才變（陌生→認識→朋友→好友→知己）並記下來；中間一天變差不會來回跳；玩家固定的不變；同一天不會結算兩次',
        r.instant === 'acquaintance' && r.day1 === 'acquaintance' && r.soon === 1 && r.day2 === 'friend' && r.log.some((x) => x[0] === '認識' && x[1] === '朋友' && x[2] === 'up') && r.steady === 'friend' && r.fixed === 'friend' && ['bestfriend', 'confidant'].includes(r.unfixed) && r.twice === 0, r);
    }
    if (want(21)) {
      await prep173();
      const r = await page.evaluate(() => {
        const [a, b] = OC.Chars.all(), M = OC.Mind, Bd = OC.Bond17, d0 = OC.Sim.day(), now = OC.Sim.now();
        for (const [x, y] of [[a, b], [b, a]]) Object.assign(M.rel(x.id, y.id), { type: 'friend', fam: 26, aff: 36, trust: 30, last: now - 10 * 1440 });
        let d = d0, drift = null; for (let i = 1; i <= 16 && !drift; i++) { d = d0 + i; Bd.settle(d); if (M.rel(a.id, b.id).type !== 'friend') drift = [i, M.rel(a.id, b.id).type]; }
        /* quiet tag: never drifts */
        for (const [x, y] of [[a, b], [b, a]]) Object.assign(M.rel(x.id, y.id), { type: 'friend', fam: 26, aff: 36, last: now - 10 * 1440, b17: null }); Bd.setLayer(a.id, b.id, { tags: ['quiet'] });
        const f0 = M.rel(a.id, b.id).fam; for (let i = 1; i <= 5; i++) Bd.settle(d + i); const quietFam = [f0, M.rel(a.id, b.id).fam, M.rel(a.id, b.id).type]; d += 5; Bd.setLayer(a.id, b.id, { tags: [] });
        /* a rivalry that cools: 釋懷 */
        for (const [x, y] of [[a, b], [b, a]]) Object.assign(M.rel(x.id, y.id), { type: 'rival', conflict: 20, aff: 20, fam: 30, last: now, b17: null });
        Bd.settle(d + 1); Bd.settle(d + 2); const letgo = M.rel(a.id, b.id).type, last = Bd.changesOf(a.id)[0];
        return { drift, quietFam, letgo, last: last && [last.from, last.to, last.kind] };
      });
      check('21 往回走：很久沒見面會慢慢淡掉（朋友 → 認識）；「不說話也自在」不會淡；對手的衝突消了會釋懷（對手 → 認識），都寫進紀錄',
        r.drift && r.drift[1] === 'acquaintance' && r.quietFam[0] === r.quietFam[1] && r.quietFam[2] === 'friend' && r.letgo === 'acquaintance' && r.last && r.last[0] === '對手' && r.last[1] === '認識' && r.last[2] === 'letgo', r);
    }
    if (want(22)) {
      await prep173();
      const r = await page.evaluate(() => {
        const [a, b] = OC.Chars.all(), M = OC.Mind, Bd = OC.Bond17, d0 = OC.Sim.day(), R = OC.Store.s.life.settings.romance, ev = (id) => OC.LifeData.EVENTS.find((e) => e.id === id);
        R.enabled = true; R.adult[a.id] = R.adult[b.id] = true;
        Object.assign(M.rel(a.id, b.id), { aff: 60, intim: 50, fam: 40 }); Object.assign(M.rel(b.id, a.id), { aff: 40, intim: 10, fam: 40 });
        Bd.settle(d0 + 1); Bd.settle(d0 + 2); const crush = [Bd.loveState(a.id, b.id), Bd.loveState(b.id, a.id)];
        Object.assign(M.rel(b.id, a.id), { aff: 60, intim: 50 }); Bd.settle(d0 + 3); Bd.settle(d0 + 4); const mutual = [Bd.loveState(a.id, b.id), Bd.loveState(b.id, a.id)];
        /* under 18: never, whatever the numbers and settings say */
        b.profile.age = '15'; for (const x of [M.rel(a.id, b.id), M.rel(b.id, a.id)]) x.lv17 = null; Bd.settle(d0 + 5); Bd.settle(d0 + 6); const minor = Bd.loveState(a.id, b.id); b.profile.age = '25';
        /* 「可以發展戀情」 off: the same */
        Bd.setLayer(a.id, b.id, { romance: false }); const off = M.romanceOK(a.id, b.id); Bd.setLayer(a.id, b.id, { romance: true });
        /* the commitments are events the player must say yes to */
        M.setRelType(a.id, b.id, 'lover'); const chk = (id) => { const why = []; const ok = OC.Events.check(ev(id), a, b, {}, why); return [ok, why.join()]; };
        const early = chk('propose17'); for (const x of [M.rel(a.id, b.id), M.rel(b.id, a.id)]) { x.st17.day -= 20; Object.assign(x, { aff: 90, intim: 85 }); } const ready = chk('propose17');
        const conf = ['propose17', 'wedding17', 'breakup17', 'reunite17'].map((id) => ev(id) && ev(id).confirm && ev(id).confirm.ok.relType);
        const auto = (() => { Bd.settle(d0 + 30); Bd.settle(d0 + 31); return M.rel(a.id, b.id).type; })();   /* the daily settlement never makes or breaks a couple */
        M.setRelType(a.id, b.id, 'auto'); R.enabled = false;
        return { crush, mutual, minor, off, early, ready, conf, auto, types: [M.TYPES.engaged, M.TYPES.ex, M.TYPES.confidant, M.TYPES.bestfriend] };
      });
      check('22 心動：兩個成年人、打開戀愛時才有；單方面＝單戀，雙方＝曖昧（也要連續兩天）；未滿 18 歲、或「可以發展戀情」關掉就沒有；訂婚、結婚、分手、復合都是要玩家同意的事件（在一起 14 天以上才會求婚）；每日結算不會自己讓兩人在一起或分開',
        r.crush[0] === 'crush' && !r.crush[1] && r.mutual[0] === 'mutual' && r.mutual[1] === 'mutual' && !r.minor && r.off === false && !r.early[0] && /stageDays/.test(r.early[1]) && r.ready[0] && JSON.stringify(r.conf) === JSON.stringify(['engaged', 'partner', 'ex', 'lover']) && r.auto === 'lover' && r.types.join() === '未婚伴侶,前任,知己,好友', r);
    }
    if (want(23)) {
      await prep173();
      const r = await page.evaluate(() => {
        const [a, b] = OC.Chars.all(), M = OC.Mind, Bd = OC.Bond17, d0 = OC.Sim.day(), R = OC.Store.s.life.settings.romance;
        R.enabled = true; R.adult[a.id] = R.adult[b.id] = true; M.setRelType(a.id, b.id, 'lover');
        for (const x of [M.rel(a.id, b.id), M.rel(b.id, a.id)]) x.st17.day = d0 - 6;
        Bd.settle(d0 + 1); const mem = M.memories(a, {}).filter((m) => /在一起第 7 天/.test(m.text)).length + M.memories(b, {}).filter((m) => /在一起第 7 天/.test(m.text)).length;
        const logged = Bd.changesOf(a.id).filter((x) => x.kind === 'anniv').map((x) => x.to);
        Bd.st().last = d0; Bd.settle(d0 + 1); const again = M.memories(a, {}).filter((m) => /在一起第 7 天/.test(m.text)).length;
        const scene = (OC.Store.s.life.theatre16 || []).some((x) => /在一起第 7 天/.test(x.title));
        Bd.settle(d0 + 2); const day8 = Bd.changesOf(a.id).filter((x) => x.kind === 'anniv').length;
        M.setRelType(a.id, b.id, 'auto'); R.enabled = false;
        return { mem, logged, again, scene, day8 };
      });
      check('23 紀念日：在一起第 7 天兩個人都記得、紀錄裡有、有一段小劇場；同一個紀念日不會重複；第 8 天沒有',
        r.mem === 2 && r.logged.includes('在一起第 7 天') && r.again === 1 && r.scene && r.day8 === 1, r);
    }
    if (want(24)) {
      const ids = await prep173();
      await page.evaluate((ids) => { OC.Mind.relPair(ids[0], ids[1], { fam: 50, aff: 50 }, 't'); const d = OC.Sim.day(); OC.Bond17.st().last = d; OC.Bond17.settle(d + 1); OC.Bond17.settle(d + 2); OC.App.tab('island'); OC.Pages.open('bond17', { id: ids[0] }); }, ids);
      await page.waitForTimeout(900);
      const page1 = await page.evaluate(() => ({ who: document.querySelectorAll('[data-b17who]').length, cards: document.querySelectorAll('.b17-card').length, bars: document.querySelectorAll('.b17-card .b17-bar').length, log: [...document.querySelectorAll('.b17-li')].map((x) => x.textContent) }));
      await tapSel(`[data-b17set="${ids[1]}"]`); await wait(() => !!document.querySelector('.sheet.open .b17-lay'), 4000); await page.waitForTimeout(600);
      await tapSel('.sheet.open [data-b17id="roommate"]'); await page.waitForTimeout(300);
      await tapSel('.sheet.open [data-b17tag="care"]'); await page.waitForTimeout(300);
      await tapSel('.sheet.open .seg [data-v="2"]'); await page.waitForTimeout(300);
      const r = await page.evaluate((ids) => {
        const L = OC.Bond17.layerOf(ids[0], ids[1]), back = OC.Bond17.layerOf(ids[1], ids[0]), M = OC.Mind;
        const a0 = M.rel(ids[0], ids[1]).aff; M.relChange(ids[0], ids[1], { aff: 10 }, 't'); const gain = M.rel(ids[0], ids[1]).aff - a0;
        for (const l of OC.UI.stack.slice()) l.close();
        return { L, back, gain: Math.round(gain * 10) / 10 };
      }, ids);
      check('24 好感度頁（真實觸控）：選人、每個人的好感（雙向）與名稱、最近的變化；「設定」裡的身分、相處標籤、合拍度兩個方向都套用；非常合拍時好感漲得比較快（＋10 → ＋14）',
        page1.who === 2 && page1.cards === 1 && page1.bars >= 1 && page1.log.some((x) => /朋友/.test(x)) && r.L.id === 'roommate' && r.L.tags.includes('care') && r.L.fit === 2 && r.back.id === 'roommate' && r.back.fit === 2 && r.gain === 14, { page1, r });
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
