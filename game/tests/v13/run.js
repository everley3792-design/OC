/* OC Shimeji 13.0 acceptance (Playwright, real pointer events). node game/tests/v13/run.js [1 2 …]   (http.server on :8765, or OC_URL)
 *   1 follow: the character you follow leads the way to another place (semi / auto), never in manual; nothing happens behind a page;
 *     an OC you are watching (觀察) leaves → the view goes along and keeps watching
 * (further scenarios are added below as the 13.0 features land)
 */
const fs = require('fs'), path = require('path');
const H = require('../life/harness.js');
const want = (n) => process.argv.length <= 2 || process.argv.slice(2).includes(String(n));
const { check, wait } = H;
const SHOTS = process.env.OC_SHOTS || path.join(__dirname, '..', '..', '..', 'deliverables', 'v13');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
(async () => {
  const { browser, page, errors } = await H.launch();
  try {
    await H.boot(page, { chars: 3, seed: 13, travel: true });
    await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 10; S.settings.weather = 'clear'; if (OC.Events.current) OC.Events.end('t'); S.life.ev.lastAny = Date.now() + 3.6e6; S.play.req.nextAt = 1e12; });
    await wait(page, 800);
    const quiet = () => page.evaluate(() => { if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; if (OC.Arcs) OC.Arcs.abort(); for (const c of OC.Chars.all()) { const b = OC.Brain.get(c.id); if (!b) continue; b.holds.delete('event'); Object.assign(c.needs, { sleep: 90, energy: 90, food: 85 }); if (b.act === 'sleep' && b.st === 'do') OC.Brain.abort(b, 't'); } });
    const closeAll = () => page.evaluate(() => OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()));
    const go = async (id) => { await page.evaluate((id) => OC.WorldUI.travel(id, { instant: true }), id); await page.waitForFunction((id) => OC.World.area && OC.World.area.id === id, id, { timeout: 40000 }); await wait(page, 1000); };
    const ids = await page.evaluate(() => OC.Chars.all().map((c) => c.id));

    // ================= 1. the view follows =================
    if (want(1)) {
      await quiet(); await closeAll(); await go('home');
      const r1 = await page.evaluate(([me]) => {
        const S = OC.Store.s.life.settings, b = OC.Brain.get(me), c = OC.Chars.get(me); S.autonomy = 'full'; S.travel = true; S.lead = true; b.cmdAt = -1e9; b.ledAt = -1e9;
        Object.assign(c.needs, { fun: 20, interest: 20, social: 30, food: 80, sleep: 90, energy: 90, comfort: 80 });
        const n = (m) => { OC.Brain.setControl(me, m); b.cmdAt = -1e9; return OC.Brain.travelCands(c, b).length; };
        const manual = n('manual'), semi = n('semi'), auto = n('auto');
        OC.App.tab('char'); const behindPage = OC.Brain.travelCands(c, b).length; OC.App.tab('island');
        S.lead = false; const off = OC.Brain.travelCands(c, b).length; S.lead = true;
        return { manual, semi, auto, behindPage, off, isManualBrain: !!b.manual };
      }, ids);
      check('1a 操控中的角色：手動模式不會自己想去別的地方；半自動／全自動會；你在看別的頁面、或把設定關掉時不會', r1.isManualBrain && r1.manual === 0 && r1.semi > 0 && r1.auto > 0 && r1.behindPage === 0 && r1.off === 0, r1);
      // it really goes: the same call the AI makes (startTravel) → walks to the door → the place changes → it does what it had in mind
      const plan = await page.evaluate(([me]) => { OC.Brain.setControl(me, 'semi'); const b = OC.Brain.get(me), c = OC.Chars.get(me); b.cmdAt = -1e9; const t = OC.Brain.travelCands(c, b)[0]; OC.Brain.startTravel(b, t.place, t.act); return { place: t.place, act: t.act, from: OC.World.area.id, leaving: !!b.leaving }; }, ids);
      const moved = await page.waitForFunction((p) => OC.World.area && OC.World.area.id === p, plan.place, { timeout: 90000 }).then(() => true).catch(() => false);
      await wait(page, 1500);
      const r2 = await page.evaluate(([me, plan]) => { const b = OC.Brain.get(me), c = OC.Chars.get(me); return { area: OC.World.area.id, player: OC.App.player && OC.App.player.cid === me, loc: c.life.loc, tab: OC.App.curTab, queuedOrDoing: b.queued === plan.act || b.act === plan.act, again: OC.Brain.travelCands(c, b).length, pos: OC.Store.s.pos && OC.Store.s.pos.area }; }, [ids[0], plan]);
      await shot(page, '1-led-to-' + plan.place);
      check('1b 牠真的走出去：畫面跟著換到那個地點、牠就是你操控的角色、接著去做牠原本想做的事；剛到不會馬上又跑走', plan.leaving && moved && r2.area === plan.place && r2.player && r2.loc === plan.place && r2.pos === plan.place && r2.queuedOrDoing && r2.again === 0, { plan, r2 });
      // watching another OC that leaves → we go along and keep watching
      await quiet(); await go('isle');
      const obs = await page.evaluate(([me, mate]) => { const c = OC.Chars.get(mate); c.life.loc = 'isle'; c.life.trip = null; OC.App.syncPresence(); const b = OC.Brain.get(mate); if (!b || !b.a) return { ok: false }; OC.Brain.setControl(mate, 'auto'); b.holds.clear(); OC.App.observe(mate); OC.Brain.startTravel(b, 'street', 'browse'); return { ok: true, bar: !!document.querySelector('.obs-bar') }; }, ids);
      const followed = await page.waitForFunction(() => OC.World.area && OC.World.area.id === 'street', null, { timeout: 90000 }).then(() => true).catch(() => false);
      await page.waitForFunction(() => !!document.querySelector('.obs-bar'), null, { timeout: 15000 }).catch(() => {});
      const r3 = await page.evaluate(([me, mate]) => ({ area: OC.World.area.id, here: !!OC.App.actorOf(mate), bar: (document.querySelector('.obs-bar') || {}).textContent || '', name: OC.Chars.name(OC.Chars.get(mate)), loc: OC.Chars.get(mate).life.loc, trip: !!OC.Chars.get(mate).life.trip }), ids);
      await shot(page, '1-followed-observed');
      check('1c 正在「觀察」的 OC 自己去了別的地方：畫面跟過去、牠就在那裡、繼續觀察牠', obs.ok && obs.bar && followed && r3.area === 'street' && r3.here && r3.bar.includes(r3.name) && r3.loc === 'street' && !r3.trip, { obs, r3 });
      await page.evaluate(() => OC.App.stopObserve()); await go('isle');
    }

    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.stack || e)); }
  await browser.close();
  const bad = H.results.filter((r) => !r.ok); console.log(`\n${H.results.length - bad.length}/${H.results.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
