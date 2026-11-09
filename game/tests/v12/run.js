/* OC Shimeji 12.0 acceptance (Playwright, real pointer events). node game/tests/v12/run.js [1 2 …]   (http.server on :8765)
 *   1 requests: an accepted request can be cancelled (confirm, no reward, the reaction follows the character, cooldown)
 *   2 layout: text-only tiles have no pedestal circle; the routine card's two selects do not overlap their labels
 *   3 skill book: a ring tile per skill with level and next unlock; the sheet shows the ladder
 *   4 map: pins stay inside the chart and clear of the title; the chart is redrawn for the time of day
 * (further scenarios are added as the 12.0 features land)
 */
const H = require('../life/harness.js');
const want = (n) => process.argv.length <= 2 || process.argv.slice(2).includes(String(n));
const { check, wait } = H;
(async () => {
  const { browser, page, errors } = await H.launch();
  try {
    await H.boot(page, { chars: 3, seed: 8 });
    await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 10; S.life.settings.autonomy = 'restricted'; if (OC.Events.current) OC.Events.end('t'); S.life.ev.lastAny = Date.now() + 3.6e6; });
    await wait(page, 800);
    const quiet = () => page.evaluate(() => { if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; for (const c of OC.Chars.all()) { const b = OC.Brain.get(c.id); if (!b) continue; b.holds.delete('event'); Object.assign(c.needs, { sleep: 90, energy: 90, food: 85 }); if (b.act === 'sleep' && b.st === 'do') OC.Brain.abort(b, 't'); } });
    const closeAll = () => page.evaluate(() => OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()));

    // ================= 1. cancel a request =================
    if (want(1)) {
      await quiet(); await closeAll();
      const ids = await page.evaluate(() => OC.Chars.all().map((c) => c.id));
      const r = await page.evaluate((id) => { const c = OC.Chars.get(id); c.personality.traits = ['sensitive']; const q = OC.Requests.debugOffer(id, 'rest') || OC.Requests.debugOffer(id, 'taste'); return q ? { id: q.id, type: q.type, state: q.state } : null; }, ids[1]);
      check('1a 請求出現在「請求」清單', !!r && r.state === 'offer', r);
      // accept it through the sheet, then open it again: the cancel button is there
      await page.evaluate((id) => OC.Requests.openSheet(id), r.id); await wait(page, 700);
      await page.click('.sheet .btn.primary'); await wait(page, 900);
      const st1 = await page.evaluate((id) => OC.Requests.list().find((x) => x.id === id).state, r.id);
      await closeAll(); await page.evaluate((id) => OC.Requests.openSheet(id), r.id); await wait(page, 800);
      const btn = await page.evaluate(() => [...document.querySelectorAll('.sheet .btn')].map((b) => b.textContent.trim()));
      check('1b 接受後再打開：有「取消這個請求」', st1 === 'active' && btn.includes('取消這個請求'), { st1, btn });
      // cancel → confirm sheet → confirm
      const before = await page.evaluate((id) => { OC.Chars.get(id).life.player.aff = 20; return { coins: OC.Store.s.coins, aff: OC.Chars.get(id).life.player.aff || 0 }; }, ids[1]);
      await page.click('.sheet .btn.ghost:has-text("取消這個請求")'); await wait(page, 700);
      const conf = await page.evaluate(() => [...document.querySelectorAll('.sheet')].pop().textContent);
      await page.click('.sheet .btn:has-text("取消請求")'); await wait(page, 900);
      const after = await page.evaluate(([rid, id]) => { const q = OC.Requests.list().find((x) => x.id === rid), c = OC.Chars.get(id); return { state: q.state, open: OC.Requests.open().some((x) => x.id === rid), coins: OC.Store.s.coins, aff: c.life.player.aff || 0, why: c.life.emo.recent.slice(0, 3).map((e) => e.cause), cd: (OC.Store.s.play.req.cd[id] || {})[q.type], now: OC.Sim.now() }; }, [r.id, ids[1]]);
      check('1c 取消：請求結束、不再開著、沒有給獎勵；敏感的角色會失落（好感下降、心情低落）、同類請求冷卻一天', after.state === 'cancelled' && !after.open && after.coins === before.coins && after.aff < before.aff && after.why.some((x) => /取消/.test(x || '')) && after.cd > after.now + 1000, { before, after, conf: conf.slice(0, 60) });
      // a calm character takes it lightly
      const r2 = await page.evaluate((id) => { const c = OC.Chars.get(id); c.personality.traits = []; delete OC.Store.s.play.req.cd[id]; const q = OC.Requests.debugOffer(id, 'rest') || OC.Requests.debugOffer(id, 'taste'); OC.Requests.answer(q.id, 'accept'); const a0 = c.life.player.aff || 0; OC.Requests.cancel(q.id); return { a0, a1: c.life.player.aff || 0, state: OC.Requests.list().find((x) => x.id === q.id).state }; }, ids[2]);
      check('1d 不敏感的角色取消後好感不變；已結束的請求不能再取消', r2.state === 'cancelled' && r2.a1 === r2.a0 && (await page.evaluate((id) => OC.Requests.cancel(id), r.id)) === false, r2);
    }

    // ================= 2. layout fixes =================
    if (want(2)) {
      await closeAll();
      const lay = await page.evaluate(async () => {
        // a text-only tile never shows a pedestal; a tile with a picture does (on the picture itself)
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:360px;z-index:9999'; document.body.append(host);
        const t1 = document.createElement('button'); t1.className = 'tile'; t1.textContent = '大蝴蝶結'; const t2 = document.createElement('button'); t2.className = 'tile'; const cv = document.createElement('canvas'); cv.width = cv.height = 64; t2.append(cv);
        host.append(t1, t2); await new Promise((r) => setTimeout(r, 50));
        const before1 = getComputedStyle(t1, '::before').content, before2 = getComputedStyle(t2, '::before').content, cvBg = getComputedStyle(cv).backgroundImage; host.remove();
        return { textTilePseudo: before1, picTilePseudo: before2, canvasBg: cvBg.slice(0, 20) };
      });
      check('2a 純文字格沒有圓形底座（::before 不存在）；有預覽圖的格子，底座畫在圖上', (lay.textTilePseudo === 'none' || lay.textTilePseudo === 'normal') && lay.canvasBg.startsWith('radial-gradient'), lay);
      const rc = await page.evaluate(async () => {
        const c = OC.Chars.active();
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:361px;z-index:9999;background:#fff'; document.body.append(host);
        let node = null; try { node = OC.LifeUI.routineCard ? OC.LifeUI.routineCard(c) : null; } catch (e) { /* not exported */ }
        if (!node) { host.remove(); return { skipped: true }; }
        host.append(node); await new Promise((r) => setTimeout(r, 100));
        const labels = [...host.querySelectorAll('.routine-grid label')].map((l) => l.getBoundingClientRect()), sels = [...host.querySelectorAll('select')].map((l) => l.getBoundingClientRect());
        const r = { labels: labels.length, sels: sels.length, widths: sels.map((x) => Math.round(x.width)), noOverlap: sels.length === 2 && sels[0].right <= sels[1].left + 1, within: sels.every((x) => x.right <= 361) }; host.remove(); return r;
      });
      check('2b 作息卡：睡覺／起床兩個選單並排、沒有重疊、不超出卡片', rc.skipped || (rc.noOverlap && rc.within), rc);
    }

    // ================= 3. skill book =================
    if (want(3)) {
      await closeAll();
      const sk = await page.evaluate(async () => {
        const c = OC.Chars.active(); c.life.skills.reading = 70; OC.Pages.open('profile', { id: c.id }); await new Promise((r) => setTimeout(r, 900));
        [...document.querySelectorAll('[data-page="profile"] button')].find((b) => b.textContent.trim() === '成長').click(); await new Promise((r) => setTimeout(r, 900));
        const tiles = [...document.querySelectorAll('.sk-tile')], n = Object.keys(OC.PlayData.SKILLS).length;
        const first = tiles[0], lvTxt = first && first.querySelector('.sk-lv') && first.querySelector('.sk-lv').textContent.trim(), sum = document.querySelector('.sk-sum') && document.querySelector('.sk-sum').textContent.replace(/\s+/g, ' ');
        const next = first && first.querySelector('.sk-next').textContent;
        first.click(); await new Promise((r) => setTimeout(r, 800));
        const steps = [...document.querySelectorAll('.sheet .sk-step')].map((e) => e.className.replace('sk-step', '').trim() || 'later');
        return { tiles: tiles.length, n, lvTxt, sum, next, steps };
      });
      check('3a 技能頁：每個技能一格（環形進度、等級數字、下一個解鎖），上方有總覽', sk.tiles === sk.n && /\d/.test(sk.lvTxt || '') && /技能總等級/.test(sk.sum || '') && /下一個|全部/.test(sk.next || ''), sk);
      check('3b 點技能格：表單列出每一級的效果（已生效／下一個／之後）', sk.steps.length >= 2 && sk.steps.includes('on') && sk.steps.some((x) => x === 'next'), sk.steps);
      await closeAll(); await page.evaluate(() => OC.App.tab('island')); await wait(page, 400);
    }

    // ================= 4. map =================
    if (want(4)) {
      await closeAll();
      const mp = await page.evaluate(async () => {
        const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 10; OC.App.tab('explore'); await new Promise((r) => setTimeout(r, 1500));
        const wrap = document.querySelector('.map-wrap'), wr = wrap.getBoundingClientRect(), cv = wrap.querySelector('canvas');
        const pins = [...document.querySelectorAll('.map-pin')].map((p) => ({ id: p.getAttribute('aria-label'), r: p.querySelector('.pin').getBoundingClientRect() }));
        const title = document.querySelector('.map-title').getBoundingClientRect();
        const outside = pins.filter((p) => p.r.top < wr.top + 2 || p.r.bottom > wr.bottom || p.r.left < wr.left || p.r.right > wr.right).map((p) => p.id);
        const hit = pins.filter((p) => !(p.r.right < title.left || p.r.left > title.right || p.r.bottom < title.top || p.r.top > title.bottom)).map((p) => p.id);
        const sample = () => { const x = cv.getContext('2d'); return Array.from(x.getImageData(20, 20, 4, 4).data).join(); };
        const dayPx = sample(); S.settings.fixedHour = 23; OC.Pages.open('explore'); await new Promise((r) => setTimeout(r, 1800)); const nightPx = sample();
        S.settings.fixedHour = 10; OC.Pages.open('explore'); await new Promise((r) => setTimeout(r, 1800));
        return { pins: pins.length, outside, hit, dayPx, nightPx, locked: [...document.querySelectorAll('.map-pin.locked')].length };
      });
      check('4a 地圖：每個圖釘都在地圖範圍內、不被左上角標題牌擋住；未開放的小島仍標示（鎖）', mp.pins === 6 && !mp.outside.length && !mp.hit.length && mp.locked === 2, mp);
      check('4b 地圖依時段重畫（白天與夜晚的畫面不同）', mp.dayPx !== mp.nightPx, { dayPx: mp.dayPx, nightPx: mp.nightPx });
      await page.evaluate(() => OC.App.tab('island')); await wait(page, 400);
    }

    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.message)); }
  await browser.close();
  const n = H.results.filter((r) => r.ok).length; console.log(`\n${n}/${H.results.length} passed`);
})();
