/* OC Shimeji 10.x acceptance: characters never get stuck after an interaction; the ring menu holds and releases its OC.
 * Usage: node game/tests/v10/run.js [1 2 …]   (http.server on :8765 first; ~3 min)
 *   1 ring menu: the OC is held while open, released on every way of closing (outside tap, Back, picking an action)
 *   2 lost finger-up while carrying an OC → the next touch puts it down and releases it
 *   3 a dialogue replaced by another one releases the first OC
 *   4 an event question closed without answering → the event continues (no 90 s freeze)
 *   5 watchdog: an orphaned hold is released; every ring action leaves no hold behind and the OC can move again
 */
const path = require('path');
const H = require('../life/harness.js');
const want = (n) => process.argv.length <= 2 || process.argv.slice(2).includes(String(n));
const { check, wait } = H;
(async () => {
  const { browser, page, errors } = await H.launch();
  try {
    await H.boot(page, { chars: 3, seed: 3 });
    await page.evaluate(() => { const S = OC.Store.s.settings; S.time = 'fixed'; S.fixedHour = 11; if (OC.Events.current) OC.Events.end('t'); });
    const ids = await page.evaluate(() => ({ self: OC.Store.s.activeId, mate: Object.keys(OC.App.mates)[0] }));
    const holds = (id) => page.evaluate((id) => [...OC.Brain.get(id).holds], id);
    const scr = (id) => page.evaluate((id) => { const a = OC.App.actorOf(id); return OC.World.project(a.x, a.y, a.lvl || 0, a.gy - (a.lvl || 0) * OC.World.HY + 30); }, id);

    if (want(1)) {
      const open = () => page.evaluate((id) => { if (OC.Events.current) OC.Events.end('t'); OC.App.menuFor({ type: 'mate', id }, OC.App.screenOf(OC.App.actorOf(id))); }, ids.mate);
      await open(); await wait(page, 300); const h1 = await holds(ids.mate);
      await page.evaluate(() => document.querySelector('.radial').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(page, 400); const h2 = await holds(ids.mate);
      await open(); await wait(page, 300); await page.evaluate(() => OC.UI.back()); await wait(page, 400); const h3 = await holds(ids.mate);
      await open(); await wait(page, 300); await page.evaluate(() => [...document.querySelectorAll('.radial-btn')].find((b) => b.textContent === '檔案').click());
      const prof = await page.waitForFunction(() => !!document.querySelector('[data-page="profile"].open'), null, { timeout: 5000 }).then(() => true).catch(() => false); const h4 = await holds(ids.mate); await page.evaluate(() => OC.UI.back());
      check('1a 打開環狀選單時 OC 會停下來注意你（menu hold）', h1.includes('menu'), h1);
      check('1b 點外面、返回鍵、選擇動作：三種關法都會放開 OC', !h2.includes('menu') && !h3.includes('menu') && !h4.includes('menu') && prof, { h2, h3, h4, prof });
      const anim = await page.evaluate(async (id) => { OC.App.menuFor({ type: 'mate', id }, OC.App.screenOf(OC.App.actorOf(id))); await new Promise((r) => setTimeout(r, 50)); const bs = [...document.querySelectorAll('.radial-btn')]; const d = bs.map((b) => getComputedStyle(b).transitionDelay.split(',')[0]); const halo = !!document.querySelector('.radial-halo'); OC.Radial.close(true); return { d, halo }; }, ids.mate);
      check('1c 選單有依序展開（每個按鈕不同延遲）與光暈', anim.halo && new Set(anim.d).size === anim.d.length, anim);
    }
    if (want(2)) {
      const p = await scr(ids.mate); await page.mouse.move(p.x, p.y); await page.mouse.down(); await wait(page, 1000);
      const lifted = await holds(ids.mate);
      // the finger-up never arrives; the next touch starts somewhere else
      await page.evaluate(() => { const c = document.getElementById('world'); c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, isPrimary: true, clientX: 40, clientY: 640, bubbles: true })); c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, isPrimary: true, clientX: 40, clientY: 640, bubbles: true })); });
      await wait(page, 7000); const after = await page.evaluate((id) => ({ holds: [...OC.Brain.get(id).holds], lift: OC.App.actorOf(id).lift, touch: OC.Touch.active }), ids.mate);
      check('2 抱起 OC 時手指的放開事件遺失 → 下一次觸碰會把牠放下並放開（不會卡在半空）', lifted.includes('drag') && !after.holds.includes('drag') && !after.touch && after.lift === 0, { lifted, after });
      await page.mouse.up();
    }
    if (want(3)) {
      const r = await page.evaluate(async ([a, b]) => { OC.LifeUI.chat(a); await new Promise((r) => setTimeout(r, 200)); const h1 = [...OC.Brain.get(a).holds]; OC.LifeUI.chat(b); await new Promise((r) => setTimeout(r, 200)); const h2 = [...OC.Brain.get(a).holds]; OC.UI.back(); await new Promise((r) => setTimeout(r, 200)); return { h1, h2, b: [...OC.Brain.get(b).holds] }; }, [ids.mate, ids.self]);
      check('3 對話被另一段對話取代時，第一個 OC 會被放開', r.h1.includes('dialogue') && !r.h2.includes('dialogue') && !r.b.includes('dialogue'), r);
    }
    if (want(4)) {
      const r = await page.evaluate(async ([a]) => {
        const c = OC.Chars.get(a); c.personality.traits = ['humorous']; c.life.player.aff = 30;
        const jk = OC.Events.defs().find((e) => e.id === 'jokeForYou'); jk.chance = 1; OC.Store.s.life.ev.lastAny = 0; for (const k of Object.keys(OC.Store.s.life.ev.last)) delete OC.Store.s.life.ev.last[k];
        for (let i = 0; i < 150 && (!OC.Events.current || OC.Events.current.ev.id !== 'jokeForYou'); i++) { if (OC.Events.current) OC.Events.end('t'); const b = OC.Brain.get(a); b.holds.clear(); if (!OC.Brain.available(b)) OC.Brain.abort(b, 't'); OC.Events.update(5); }
        if (!OC.Events.current) return { started: false };
        OC.Events.current.watched = true;   // the player is watching (as when the event card was accepted): the question is asked
        const t0 = Date.now(); let asked = false;
        while (OC.Events.current && Date.now() - t0 < 30000) { OC.Events.update(0.5); const d = document.querySelector('.dlg.open .choices .btn'); if (d && !asked) { asked = true; OC.UI.back(); } else if (document.querySelector('.dlg.open') && !document.querySelector('.dlg.open .choices .btn')) document.querySelector('.dlg.open').click(); await new Promise((r) => setTimeout(r, 150)); }
        return { started: true, asked, ended: !OC.Events.current, ms: Date.now() - t0, holds: [...OC.Brain.get(a).holds] };
      }, [ids.mate]);
      check('4 事件的提問沒回答就關掉 → 事件照樣繼續完成（不會凍結 90 秒）', r.started && r.asked && r.ended && r.ms < 25000 && !r.holds.includes('event'), r);
    }
    if (want(5)) {
      const orphan = await page.evaluate(async (a) => { OC.Brain.hold(a, 'drag'); await new Promise((r) => setTimeout(r, 4200)); return [...OC.Brain.get(a).holds]; }, ids.mate);
      check('5a 沒有擁有者的保留（例如沒在抱的 drag）2 秒後自動放開', !orphan.includes('drag'), orphan);
      const res = [];
      for (const [who, labels] of [['self', ['摸摸', '打招呼', '玩耍', '跟拍']], ['mate', ['摸摸', '聊天', '玩耍', '叫過來']]]) for (const lab of labels) {
        const id = ids[who];
        await page.evaluate(([id, lab, who]) => { if (OC.Events.current) OC.Events.end('t'); OC.App.menuFor({ type: who, id }, OC.App.screenOf(OC.App.actorOf(id))); const b = [...document.querySelectorAll('.radial-btn')].find((x) => x.textContent === lab); b && b.click(); }, [id, lab, who]);
        await wait(page, 1200);
        await page.evaluate(async () => { for (let i = 0; i < 10; i++) { const d = document.querySelector('.dlg.open'); if (!d) break; const c = d.querySelector('.choices .btn'); (c || d).click(); await new Promise((r) => setTimeout(r, 200)); } while (OC.UI.stack.length) OC.UI.back(); OC.App.setCamMode('classic'); });
        await wait(page, lab === '叫過來' ? 14000 : 3500);
        const h = (await holds(id)).filter((x) => x !== 'event');
        const moved = await page.evaluate(async (id) => { const a = OC.App.actorOf(id), x0 = a.x, y0 = a.y; let t = null; for (const [dx, dy] of [[40, 30], [-40, 30], [40, -30], [-40, -30], [0, 60], [60, 0]]) { t = OC.World.nearestWalkable(a.x + dx, a.y + dy, 30); if (t && Math.hypot(t.x - a.x, t.y - a.y) > 20) break; } OC.Brain.hold(id, 'call'); OC.World.walkTo(a, t.x, t.y); await new Promise((r) => setTimeout(r, 2500)); OC.Brain.unhold(id, 'call'); return Math.hypot(a.x - x0, a.y - y0) > 3; }, id);
        res.push({ who, lab, h, moved });
      }
      check('5b 每個環狀選單動作結束後都沒有殘留的保留，角色可以再移動', res.every((r) => !r.h.length && r.moved), res);
    }
    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.message)); }
  await browser.close();
  const n = H.results.filter((r) => r.ok).length; console.log(`\n${n}/${H.results.length} passed`);
})();
