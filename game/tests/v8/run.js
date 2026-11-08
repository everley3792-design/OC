/* OC Shimeji — 8.0 acceptance tests (the browser-testable parts of scenarios 1–17; 13/14/17 on a device: docs/v8-report.md).
 *   cd game && python3 -m http.server 8765 &      # then, from the repo root:
 *   node game/tests/v8/run.js [scenario numbers…]
 * Real game in Chromium (SwiftShader WebGL), portrait 393×852 (and 360×640 for 12), touch-capable, pointer input.
 * Screenshots → deliverables/v8/. Exit code 1 if a check fails.
 */
const fs = require('fs'), path = require('path');
const H = require('../life/harness.js');
const { check, wait } = H;
const only = process.argv.slice(2).map(Number).filter(Boolean);
const want = (n) => !only.length || only.includes(n);
const SHOTS = process.env.OC_SHOTS || path.join(__dirname, '..', '..', '..', 'deliverables', 'v8');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
const body = (page, id) => page.evaluate((i) => { const a = i ? OC.App.actorOf(i) : OC.App.player; return OC.World.project(a.x, a.y, a.lvl || 0, a.gy - (a.lvl || 0) * OC.World.HY + 30); }, id || null);

(async () => {
  const { browser, ctx, page, errors } = await H.launch();
  try {
    // ================= 1 + 2. fresh install: logo → opening → welcome → creator; no NPC before / after =================
    if (want(1) || want(2)) {
      await page.goto(H.URL); await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('oc-assets'); }); await page.goto(H.URL);
      await page.waitForSelector('.intro-logo', { timeout: 20000 }); await shot(page, '1-logo');
      await page.waitForSelector('.intro-film', { timeout: 20000 }); await wait(page, 1500); await shot(page, '2-opening');
      // the film runs on real time (16.5 s): sample while it plays (a slow screenshot must not make the test miss it)
      const yaws = [], subs = []; for (let i = 0; i < 5; i++) { const r = await page.evaluate(() => { const s = document.querySelector('.intro-subtitle'); return [OC.World.yaw, s ? s.textContent : '']; }); yaws.push(r[0]); subs.push(r[1]); await wait(page, 500); }
      const mid = await page.evaluate(([y, ss]) => ({ chars: OC.Chars.all().length, npcs: Object.keys(OC.App.npcs || {}).length, yaw: Math.max(...y) - Math.min(...y), sub: ss.reduce((a, b) => (b.length > a.length ? b : a), '') }), [yaws, subs]);
      check('1a 全新安裝：開場期間沒有任何角色或居民（小島是空的）', mid.chars === 0 && mid.npcs === 0, mid);
      check('2a 開場是真的 3D 鏡頭運動（旋轉的視角＋字幕），不是圖片輪播', mid.yaw > 0.05 && mid.sub.length > 4, mid);
      const t0 = Date.now(); await page.tap('.intro-skip'); await page.waitForSelector('.intro-welcome.on', { timeout: 8000 });
      check('2b 開場可以跳過（立刻到歡迎畫面），並記住看過了', Date.now() - t0 < 4000 && await page.evaluate(() => OC.Store.s.intro.seen), Date.now() - t0);
      await shot(page, '2-welcome');
      await page.tap('.intro-welcome .btn.ghost'); await page.waitForSelector('.intro-film', { timeout: 8000 });
      check('2c 歡迎畫面可以重新觀看開場', true);
      await page.tap('.intro-skip'); await page.waitForSelector('.intro-welcome.on', { timeout: 8000 });
      await page.tap('.intro-welcome .btn.primary'); await page.waitForSelector('.creator .card', { timeout: 10000 });
      check('1b 「開始新遊戲」直接進入創角（玩家先建立自己的 OC）', await page.evaluate(() => OC.Chars.all().length === 0));
      await page.click('.creator .card >> nth=1'); await wait(page, 300);   // 從零創建
      for (let i = 0; i < 14; i++) {
        if (!(await page.$('.creator'))) break;
        await page.evaluate(() => { const nm = document.querySelector('.creator input[placeholder*="名字"], .creator input[aria-label*="名字"]'); if (nm && !nm.value) { nm.value = '小苔'; nm.dispatchEvent(new Event('input', { bubbles: true })); } });
        await page.click('.creator > .btn.primary', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300);
      }
      await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 });
      await wait(page, 1200); await shot(page, '2-debut');
      const r = await page.evaluate(() => ({ chars: OC.Chars.all().map((c) => c.profile.name), npcs: Object.keys(OC.App.npcs).length, residents: OC.Store.s.world.residents, v: OC.Store.s.v }));
      check('1c 創角後只有玩家自己的 OC，居民不會自動出現（設定可開啟）', r.chars.length === 1 && r.npcs === 0 && r.residents === false && r.v === 7, r);
      await page.waitForSelector('.tut-card.on', { timeout: 15000 }).catch(() => null);
      const tut = await page.evaluate(() => ({ active: OC.Tutorial.active, step: OC.Tutorial.step }));
      check('2d 角色登場後，由這位 OC 開始新手教學', tut.active && tut.step === 0, tut);
      await shot(page, '2-tutorial');
      await page.tap('.tut-card .btn.primary'); await wait(page, 900);
      await page.reload(); await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 }); await page.waitForSelector('.intro-welcome.on', { timeout: 15000 }); await page.tap('.intro-welcome .btn.primary'); await wait(page, 2500);
      const res = await page.evaluate(() => ({ active: OC.Tutorial.active, step: OC.Tutorial.step, saved: OC.Store.s.intro.tutorial.step, chars: OC.Chars.all().length }));
      check('2e 重開 App：不用重新創角，教學從上次的步驟繼續', res.chars === 1 && res.active && res.step >= 1, res);
      await page.tap('.tut-card .btn.ghost'); await wait(page, 500);
      check('2f 教學可以跳過並記住', await page.evaluate(() => OC.Store.s.intro.tutorial.skipped && !OC.Tutorial.active));
    }

    // ---- the rest uses the standard harness (intro skipped, preset OCs added like a player would) ----
    await H.boot(page, { chars: 3, seed: 8 });
    await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 10; S.settings.perf = 'balanced'; OC.App.applyPerf(); S.life.settings.autonomy = 'restricted'; });
    await wait(page, 1500);
    const ids = await page.evaluate(() => OC.Chars.all().map((c) => c.id));

    // ================= 3 + 10. personality, traits, speech → real differences =================
    if (want(3) || want(10)) {
      const r = await page.evaluate(([a, b]) => {
        const A = OC.Chars.get(a), B = OC.Chars.get(b);
        Object.assign(A.speech, { style: 'energetic', self: '俺', you: '你', ending: '啦', endingRate: 0.6, phrases: [{ text: '好耶', rate: 0.5, when: 'happy', at: 'start' }] });
        Object.assign(B.speech, { style: 'polite', self: '我', you: '您', ending: '', endingRate: 0, phrases: [], banned: ['超'] });
        const line = '我超喜歡你送的禮物！';
        const sa = new Set(), sb = new Set(); for (let i = 0; i < 20; i++) { sa.add(OC.Chars.speak(A, line, { emo: 'happy', to: 'player' })); sb.add(OC.Chars.speak(B, line, { emo: 'happy', to: 'player' })); }
        const end = [...Array(200)].map(() => OC.Chars.speak(A, '今天天氣很好。', { emo: 'calm' })).filter((t) => t.includes('啦')).length / 200;
        A.personality.traits = ['energetic']; B.personality.traits = ['lazy', 'introvert'];
        const ba = OC.Chars.behavior(A), bb = OC.Chars.behavior(B);
        A.personality.traits = ['earlybird']; B.personality.traits = ['nightowl'];
        const ra = OC.Mind.routine(A), rb = OC.Mind.routine(B);
        // same situation, each OC's own dialogue (voice / traits / mood) — chat_player pool sampled
        const la = new Set(), lb = new Set(); const S0 = JSON.stringify(OC.Store.s.life.said);
        for (let i = 0; i < 15; i++) { const x = OC.Talk.say('chat_player', A, null); const y = OC.Talk.say('chat_player', B, null); if (x) la.add(x.text); if (y) lb.add(y.text); }
        OC.Store.s.life.said = JSON.parse(S0);
        return { a: [...sa].slice(0, 3), b: [...sb].slice(0, 3), self: [...sa].some((t) => t.includes('俺')), you: [...sb].every((t) => t.includes('您') && !t.includes('超')), end, speed: [ba.speed, bb.speed], bounce: [ba.bounce, bb.bounce], wake: [ra.wake, rb.wake], overlap: [...la].filter((t) => lb.has(t)).length, la: la.size, lb: lb.size };
      }, ids);
      check('3a 自稱／稱呼你／禁用詞真的出現在台詞裡', r.self && r.you, { a: r.a, b: r.b });
      check('3b 句尾口癖依頻率出現（不是每句都加）', r.end > 0.35 && r.end < 0.85, r.end);
      check('3c 特質改變行為：活潑走得快、跳得高；懶散內向較慢', r.speed[0] > r.speed[1] && r.bounce[0] > r.bounce[1], { speed: r.speed, bounce: r.bounce });
      check('3d 特質改變作息：早起型比夜貓子早醒', r.wake[0] < r.wake[1], r.wake);
      check('10a 相同情境下不同 OC 說的話不同（重複很少）', r.overlap <= Math.min(r.la, r.lb) / 2, { overlap: r.overlap, la: r.la, lb: r.lb });
    }

    // ================= 4. import quality: originals kept, transparency kept, texture follows zoom =================
    if (want(4)) {
      const r = await page.evaluate(async () => {
        const k = OC.makeCanvas(2400, 2400), x = k.getContext('2d'); x.fillStyle = '#3b8'; x.beginPath(); x.arc(1200, 1200, 900, 0, 7); x.fill();
        const blob = await new Promise((res) => k.toBlob(res, 'image/png')); const rec = await OC.Assets.putBlob(blob, { name: 'hi-res' });
        const orig = await createImageBitmap(await OC.Assets.original(rec.id)), work = await OC.Assets.image(rec.id);
        const c2 = OC.makeCanvas(work.width, work.height), x2 = c2.getContext('2d'); x2.drawImage(work, 0, 0); const corner = x2.getImageData(2, 2, 1, 1).data[3], centre = x2.getImageData(work.width / 2, work.height / 2, 1, 1).data[3];
        OC.World.setMode('classic', { zoom: 1.2 }); await new Promise((r) => setTimeout(r, 2200)); const bbLow = OC.World.bbRes;
        OC.World.setMode('focus', { zoom: 3.2 }); await new Promise((r) => setTimeout(r, 2500)); const bbHigh = OC.World.bbRes;
        OC.App.setCamMode('classic');
        return { orig: [orig.width, orig.height], work: [work.width, work.height], corner, centre, bbLow, bbHigh };
      });
      check('4a 高解析透明 PNG：原圖完整保留（2400 px），遊戲用的工作圖 ≤ 2048 px', r.orig[0] === 2400 && r.work[0] === 2048, r);
      check('4b 透明背景保留（角落透明、主體不透明）', r.corner === 0 && r.centre === 255, r);
      check('4c 場景中角色貼圖解析度跟著實際顯示大小調整（拉近變清晰）', r.bbHigh > r.bbLow, { low: r.bbLow, high: r.bbHigh });
    }

    // ================= 5. camera modes =================
    if (want(5)) {
      const r = await page.evaluate(async () => {
        const out = [], P = () => { const a = OC.App.player; return OC.World.project(a.x, a.y, a.lvl || 0, 20); };
        for (const m of ['follow', 'focus', 'free', 'classic']) { const p0 = P(); OC.App.setCamMode(m); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const p1 = P(); out.push({ m, jump: Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y)), mode: OC.World.mode }); await new Promise((r) => setTimeout(r, 900)); }
        OC.App.setCamMode('free'); OC.World.rotateTo(0.7); await new Promise((r) => setTimeout(r, 2200)); const yaw = OC.World.yaw;
        return { out, yaw, saved: OC.Store.s.view.mode };
      });
      check('5a 四種鏡頭模式即時切換，切換當下畫面不會跳動', r.out.every((x) => x.mode === x.m && x.jump < 40), r.out);
      check('5b 自由鏡頭可以旋轉視角（有角度限制），模式會記住', Math.abs(r.yaw - 0.7) < 0.05 && r.saved === 'free', r);
      await shot(page, '5-rotated');
      const P = await body(page); await page.mouse.click(P.x, P.y); await wait(page, 500);
      check('5c 旋轉後點角色仍然點得到（互動選單出現）', await page.evaluate(() => !!document.querySelector('.radial.on')));
      await page.evaluate(() => { OC.Radial.close(true); OC.App.setCamMode('classic'); }); await wait(page, 1500);
    }

    // ================= 6. context menus =================
    if (want(6)) {
      const P = await body(page); await page.mouse.click(P.x, P.y); await wait(page, 600); await shot(page, '6-ring-oc');
      const oc = await page.evaluate(() => [...document.querySelectorAll('.radial-btn')].map((b) => b.textContent));
      await page.tap('.radial-btn:has-text("檔案")'); await wait(page, 700);
      const prof = await page.evaluate(() => !!document.querySelector('[data-page="profile"].open'));
      await page.evaluate(() => OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close())); await wait(page, 400);
      const furn = await page.evaluate(() => { OC.App.menuFor({ type: 'furn', id: 'chair', uid: 'test', x: 300, y: 650 }, { x: 200, y: 420 }); const t = [...document.querySelectorAll('.radial-btn')].map((b) => b.textContent); OC.Radial.close(true); return t; });
      await page.evaluate(() => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); OC.App.tab('island'); }); await wait(page, 600);
      const G = await page.evaluate(() => { const a = OC.App.player; for (const [dx, dy] of [[0, 60], [50, 40], [-50, 40], [0, -60], [70, 0], [-70, 0], [60, 70], [-60, 70]]) { const x = a.x + dx, y = a.y + dy; if (!OC.World.walkable(x, y)) continue; const p = OC.World.project(x, y, OC.World.levelAt(x, y), 0); if (OC.World.pick(p.x, p.y).it) continue; return p; } return { x: 196, y: 600 }; });
      await page.evaluate(() => { window.__ocInputLog = []; });
      await page.mouse.move(G.x, G.y); await page.mouse.down(); await wait(page, 1800); await page.mouse.up(); await wait(page, 500);   // software rendering: frames can take ~0.4 s here
      const lg = await page.evaluate(() => ({ log: window.__ocInputLog, stack: OC.UI.stack.length, tab: OC.App.curTab, top: (document.elementFromPoint(200, 400) || {}).tagName }));
      const ground = await page.evaluate(() => [...document.querySelectorAll('.radial-btn')].map((b) => b.textContent)); await shot(page, '6-ring-ground');
      await page.evaluate(() => OC.Radial.close(true));
      check('6a 點 OC：環狀選單（摸摸、聊天、餵食、送禮、玩耍、檔案、更多…）', ['摸摸', '餵食', '送禮', '檔案', '更多'].every((x) => oc.includes(x)), oc);
      check('6b 選單項目真的執行（檔案頁打開）', prof);
      check('6c 家具與地面也有各自的情境選單', ['使用', '移動', '收回'].every((x) => furn.includes(x)) && ground.includes('走過去'), { furn, ground, lg, G });
    }

    // ================= 7. direct touch: stroke, lift, swing, throw =================
    if (want(7)) {
      await wait(page, 1500);
      const aff0 = await page.evaluate(() => OC.Chars.active().life.player.aff || 0);
      let P = await body(page); await page.mouse.move(P.x, P.y); await page.mouse.down(); for (let i = 0; i < 8; i++) await page.mouse.move(P.x + (i % 2 ? -14 : 14), P.y + 1, { steps: 3 }); await page.mouse.up(); await wait(page, 500);
      const pet = await page.evaluate(() => ({ aff: OC.Chars.active().life.player.aff || 0, menu: !!document.querySelector('.radial.on') }));
      await wait(page, 2700); P = await body(page);
      await page.evaluate(() => OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close())); P = await body(page);
      const pan0 = await page.evaluate(() => { const v = OC.World.saveView(); return { panX: v.panX, panY: v.panY }; });
      await page.mouse.move(P.x, P.y); await page.mouse.down(); await page.mouse.move(P.x, P.y - 70, { steps: 6 }); await page.mouse.move(P.x + 60, P.y - 70, { steps: 4 }); await wait(page, 120);
      const pan1 = await page.evaluate(() => { const v = OC.World.saveView(); return { panX: v.panX, panY: v.panY }; });
      const held = await page.evaluate(() => ({ lift: OC.App.player.lift, swing: OC.App.player.swing || 0, hold: [...OC.Brain.get(OC.Store.s.activeId).holds], touch: OC.Touch.active, stack: OC.UI.stack.length, top: document.elementFromPoint(innerWidth / 2, innerHeight / 2).className }));
      await shot(page, '7-held');
      await page.mouse.move(P.x + 240, P.y - 120, { steps: 2 }); await page.mouse.up();
      for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !OC.Touch.flying && !OC.Brain.get(OC.Store.s.activeId).holds.has('drag'))) break; await wait(page, 250); }
      const after = await page.evaluate(() => { const a = OC.App.player; return { lift: a.lift, walk: OC.World.walkable(a.x, a.y), flying: OC.Touch.flying, hold: [...OC.Brain.get(OC.Store.s.activeId).holds] }; });
      check('7a 在 OC 身上來回撫摸＝摸摸頭（好感增加，不會誤開選單）', pet.aff > aff0 && !pet.menu, { aff0, pet });
      check('7b 拖曳＝抱起：懸空、像鐘擺擺動，角色被暫停自主行動', held.lift > 10 && Math.abs(held.swing) > 0.005 && held.hold.includes('drag'), held);
      check('7c 甩出去：彈跳後落在可走的地面、恢復自主（不會卡在空中或掉出地圖）', after.lift === 0 && after.walk && after.flying === 0 && !after.hold.includes('drag'), after);
      check('7d 手勢優先順序：手指落在角色上拖曳＝抱起角色，不會拖動鏡頭', Math.abs(pan1.panX - pan0.panX) < 3 && Math.abs(pan1.panY - pan0.panY) < 3, { pan0, pan1 });
    }

    // ================= 8. time panel =================
    if (want(8)) {
      await page.evaluate(() => OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close())); await wait(page, 300);
      await page.click('.hud-time', { timeout: 8000 }); await wait(page, 600); await shot(page, '8-time');
      await page.tap('.time-chips .chip-btn:has-text("深夜")'); await wait(page, 400);
      const r1 = await page.evaluate(() => ({ h: OC.Clock.hour(), phase: OC.Clock.phase(), wd: OC.World.hourFn(), sleepy: OC.Mind.sleepTime(OC.Chars.active()) }));
      await page.tap('.seg button:has-text("遊戲循環")'); await wait(page, 300);
      const r2 = await page.evaluate(() => { const c = OC.Chars.active(), f0 = c.needs.food, coins = OC.Store.s.coins, gm0 = OC.Sim.now(); const h0 = OC.Sim.hourOf(); const skipped = OC.Sim.skipTo((h0 + 3) % 24); return { skipped: Math.round(skipped), dh: Math.round(((OC.Sim.now() - gm0) / 60) * 10) / 10, foodDown: c.needs.food < f0, coins: OC.Store.s.coins === coins }; });
      await page.evaluate(() => { OC.Store.s.settings.timePaused = true; }); const gmA = await page.evaluate(() => OC.Sim.now()); await wait(page, 1500); const gmB = await page.evaluate(() => OC.Sim.now());
      await page.evaluate(() => { const S = OC.Store.s.settings; S.timePaused = false; S.time = 'fixed'; S.fixedHour = 10; OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); });
      check('8a 點右上角時間 → 選「深夜」：時間、天空光影（世界時鐘）與角色作息一起改變', r1.h === 23 && r1.phase === 'night' && r1.wd === 23 && r1.sleepy, r1);
      check('8b 遊戲循環可快轉：跳過的時間照常模擬（需求下降），不給獎勵', r2.skipped === 180 && r2.foodDown && r2.coins, r2);
      check('8c 可以暫停時間（遊戲時鐘不前進）', gmA === gmB, { gmA, gmB });
    }

    // ================= 9. status card =================
    if (want(9)) {
      await page.tap('.hud-me'); await wait(page, 600); await shot(page, '9-status');
      const r = await page.evaluate(() => { const el = document.querySelector('.status-card.on'); return { open: !!el, bars: el ? el.querySelectorAll('.sc-need').length : 0, name: el && el.querySelector('b').textContent, picks: el ? el.querySelectorAll('.sc-pick').length : 0 }; });
      const t0 = await page.evaluate(() => { const el = document.querySelector('.status-card'); window.__mut = 0; const mo = new MutationObserver((m) => { window.__mut += m.filter((x) => x.type === 'childList').length; }); mo.observe(el, { childList: true, subtree: true }); return 1; });
      await wait(page, 2500); const churn = await page.evaluate(() => window.__mut);
      await page.tap('.sc-pick >> nth=1'); await wait(page, 500);
      const sw = await page.evaluate(() => OC.Store.s.activeId);
      await page.tap('.sc-actions .btn.primary'); await wait(page, 700);
      const prof = await page.evaluate(() => !!document.querySelector('[data-page="profile"].open'));
      await page.evaluate(() => OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()));
      check('9a 點左上角頭像：即時狀態卡（心情、9 種需求、可切換角色）', r.open && r.bars === 9 && r.picks === 3, r);
      check('9b 卡片就地更新，不會一直重建（不閃爍）', churn <= 2, churn);
      check('9c 可以直接切換操控的角色，並進入完整檔案', sw === ids[1] && prof, { sw, prof });
      await page.evaluate((id) => OC.Chars.setActive(id), ids[0]); await wait(page, 600);
    }

    // ================= 11. important event: performance, then the camera comes back =================
    if (want(11)) {
      const r = await page.evaluate(async () => {
        OC.App.setCamMode('follow'); await new Promise((r) => setTimeout(r, 800));
        const id = OC.Store.s.activeId, b = OC.Brain.get(id); OC.Brain.hold(id, 't'); OC.Brain.unhold(id, 't'); b.invited = null; b.holds.clear();
        const t0 = Date.now(); await OC.Stage.perform('levelup', { oc: id, zh: '測試', lv: 2, unlocks: [] }); await new Promise((r) => setTimeout(r, 1500));
        return { ms: Date.now() - t0, mode: OC.World.mode, holds: [...OC.Brain.get(id).holds] };
      });
      check('11a 重要演出完整播放，結束後回到玩家原本的鏡頭模式、角色沒有卡住', r.ms > 800 && r.mode === 'follow' && !r.holds.includes('stage'), r);
      await page.evaluate(() => OC.App.setCamMode('classic'));
    }

    // ================= 12. themes and small screens =================
    if (want(12)) {
      const p2 = await ctx.newPage(); await p2.setViewportSize({ width: 360, height: 640 }); const e2 = []; p2.on('pageerror', (e) => e2.push(String(e)));
      await p2.goto(H.URL); await p2.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 });
      await p2.waitForSelector('.intro-welcome.on', { timeout: 15000 }).catch(() => null); const w = await p2.$('.intro-welcome .btn.primary'); if (w) await w.tap(); await p2.waitForTimeout(800);
      const res = [];
      for (const theme of ['light', 'dark']) {
        await p2.evaluate((t) => OC.App.setTheme(t), theme); await p2.waitForTimeout(300);
        for (const pg of ['char', 'workshop', 'explore', 'more']) { await p2.evaluate((x) => OC.App.tab(x), pg); await p2.waitForTimeout(450); res.push({ theme, pg, over: await p2.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) }); }
        await p2.evaluate(() => OC.App.tab('island')); await p2.waitForTimeout(300);
        const dbg = await p2.evaluate(() => { const b = document.querySelector('.hud-time').getBoundingClientRect(), e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { open: [...document.querySelectorAll('.page.open')].map((x) => x.dataset.page), hit: e && e.className, page: e && e.closest('.page') && e.closest('.page').dataset.page, stack: OC.UI.stack.length }; }); if (dbg.page) console.log('DBG', JSON.stringify(dbg));
        await p2.tap('.hud-time', { timeout: 5000 }).catch((e) => { throw new Error('hud-time blocked ' + JSON.stringify(dbg)); }); await p2.waitForTimeout(500); await p2.screenshot({ path: path.join(SHOTS, `12-time-${theme}-360.png`) }); await p2.evaluate(() => OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()));
        await p2.tap('.hud-me'); await p2.waitForTimeout(400); await p2.screenshot({ path: path.join(SHOTS, `12-status-${theme}-360.png`) }); await p2.mouse.click(180, 560); await p2.waitForTimeout(300);
      }
      check('12a 淺色／深色、360×640 小螢幕：主要頁面與 HUD 面板沒有超出畫面', res.every((x) => !x.over), res.filter((x) => x.over));
      check('12b 無錯誤', e2.length === 0, e2.slice(0, 3));
      await p2.close();
    }

    // ================= 15. long session: pages, places, panels — no growth, no errors =================
    if (want(15)) {
      const r = await page.evaluate(async () => {
        const mem = () => (performance.memory ? performance.memory.usedJSHeapSize : 0), actors0 = OC.World.actors ? OC.World.actors.length : 0;
        const m0 = mem(); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < 12; i++) {
          for (const t of ['char', 'more', 'island']) { OC.App.tab(t); await sleep(120); }
          OC.App.menuFor({ type: 'ground', p: { x: 300, y: 650 } }, { x: 200, y: 400 }); await sleep(80); OC.Radial.close(true);
          OC.App.setCamMode(['follow', 'free', 'classic'][i % 3]);
          if (i % 4 === 0) { OC.WorldUI.travel(i % 8 === 0 ? 'beach' : 'isle'); await sleep(1500); }
        }
        OC.WorldUI.travel('isle'); await sleep(2000);
        if (window.gc) window.gc(); await sleep(500);
        return { m0, m1: mem(), radials: document.querySelectorAll('.radial').length, status: document.querySelectorAll('.status-card').length };
      });
      check('15a 反覆切換頁面、地點、鏡頭、選單：沒有殘留的選單元件，記憶體沒有持續大幅成長', r.radials === 0 && (r.m0 === 0 || r.m1 < r.m0 * 1.8), r);
    }

    // ================= 16. migration: a 0.7 (v6) save =================
    if (want(16)) {
      const r = await page.evaluate(() => {
        const s = JSON.parse(OC.Store.exportJSON()), keep = OC.Store.persist; OC.Store.persist = () => {};
        const v6 = JSON.parse(JSON.stringify(s)); v6.v = 6; delete v6.intro; delete v6.view; v6.world.residents = undefined; v6.npcs = { kuri: { fr: 30, met: true, liked: [], mem: [], lastTalk: 0, lastGift: '' } };
        OC.Store.importJSON(JSON.stringify(v6)); const a = { v: OC.Store.s.v, residents: OC.Store.s.world.residents, intro: OC.Store.s.intro.seen, chars: OC.Chars.all().length, tut: OC.Store.s.intro.tutorial.done };
        const v6b = JSON.parse(JSON.stringify(v6)); v6b.npcs = {}; OC.Store.importJSON(JSON.stringify(v6b)); const b = { residents: OC.Store.s.world.residents };
        OC.Store.importJSON(JSON.stringify(s)); OC.Store.persist = keep;
        return { a, b };
      });
      check('16a 0.7 存檔升級到 v7：已經認識的居民保留、角色不重建、已玩過的玩家不再播教學', r.a.v === 7 && r.a.residents === true && r.a.intro && r.a.chars === 3 && r.a.tut, r.a);
      check('16b 沒見過居民的舊存檔：居民改為不出現（資料保留，可在設定開啟）', r.b.residents === false, r.b);
    }

    // ================= 17. 9.0 polish: new events, choices, quiz, ambient life, notices, settings =================
    if (want(17)) {
      const r = await page.evaluate(async (ids) => {
        const [a, b] = ids.map((i) => OC.Chars.get(i)), out = {};
        // a humorous OC and a friend → the prank event is eligible and runs to the end with its results
        a.personality.traits = ['humorous']; b.personality.traits = []; OC.Mind.relChange(a.id, b.id, { aff: 40, fam: 30 }); OC.Mind.relChange(b.id, a.id, { aff: 40, fam: 30 });
        const ev = OC.Events.defs().find((e) => e.id === 'prank'), why = [];
        out.eligible = OC.Events.check(ev, a, b, {}, why); out.why = why;
        out.count = OC.Events.defs().filter((e) => ['prank', 'prankBad', 'makeUp', 'tasteFight', 'shareSnack', 'clumsyTrip', 'helpUp', 'cloudShapes', 'midnightTalk', 'jokeForYou', 'tidyUp', 'birdFriend', 'baseFind', 'baseInvite', 'baseBuild'].includes(e.id)).length;
        // the choice step must not grow the shared definition (bug: replies were spliced into ev.steps)
        const jk = OC.Events.defs().find((e) => e.id === 'jokeForYou'), n0 = jk.steps.length;
        const memBefore = a.life.mem.recent.length;
        if (OC.Events.current) OC.Events.end('t');
        a.personality.traits = ['humorous']; a.life.player.aff = 20;
        OC.Store.s.life.ev.lastAny = 0; for (const k of Object.keys(OC.Store.s.life.ev.last)) delete OC.Store.s.life.ev.last[k];
        jk.chance = 1; OC.Events.trigger && 0;
        // run it directly through the engine's periodic picker
        for (let i = 0; i < 60 && (!OC.Events.current || OC.Events.current.ev.id !== 'jokeForYou'); i++) { if (OC.Events.current) OC.Events.end('t'); OC.Brain.get(a.id).holds.clear(); OC.Events.update(5); }
        out.started = OC.Events.current && OC.Events.current.ev.id;
        const t0 = Date.now(); while (OC.Events.current && Date.now() - t0 < 25000) { const d = document.querySelector('.sheet.open .btn'); if (d && /哈哈|好冷|再講/.test(d.textContent)) d.click(); OC.Events.update(0.5); await new Promise((r) => setTimeout(r, 120)); }
        out.after = jk.steps.length === n0; out.mem = a.life.mem.recent.length > memBefore;
        return out;
      }, ids.slice(0, 2));
      check('17a 新增 15 個角色事件與短篇故事（惡作劇、和好、口味之爭、分點心、跌倒、看雲、深夜談心、講笑話、秘密基地三部曲…）', r.count === 15 && r.eligible, r);
      check('17b 有選項的事件跑完後，事件定義不會被改動（修正：回應被插進共用資料）', !!r.started && r.after && r.mem, r);
      await page.evaluate(() => OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()));
      const q = await page.evaluate(async () => {
        const c = OC.Chars.blank('custom'); c.profile.name = '問答'; const p0 = JSON.stringify(c.personality);
        const box = document.createElement('div'); document.body.append(box);
        const ctx = { level: 'simple', stage: { react() {}, walk: false }, changed() {}, rebuild() {} };
        box.append(OC.CharEdit.sections.personality(c, ctx)); [...box.querySelectorAll('button')].find((b) => b.textContent.includes('5 個小問題')).click();
        const sh = () => [...document.querySelectorAll('.sheet')].pop();
        for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 350)); const btns = [...sh().querySelectorAll('.btn.block')]; btns[0].click(); }
        await new Promise((r) => setTimeout(r, 350)); const add = sh().querySelector('.btn.primary'); const txt = add && add.parentNode.textContent; add && add.click();
        box.remove();
        return { changed: JSON.stringify(c.personality) !== p0, traits: c.personality.traits, energy: c.personality.energy, txt: (txt || '').slice(0, 60) };
      });
      check('17c 創角的性格問答：5 題改變滑桿並建議特質', q.changed && q.traits.length >= 1, q);
      const amb = await page.evaluate(async () => { const S = OC.Store.s.settings; S.time = 'fixed'; S.fixedHour = 10; S.weather = 'clear'; S.perf = 'high'; OC.App.applyPerf(); await new Promise((r) => setTimeout(r, 9000)); let n = 0; OC.World.root.traverse((o) => { if (o.isGroup && o.visible && o.children.length === 2 && o.children[0].geometry && o.children[0].geometry.attributes.position.count === 3) n++; }); return n; });
      await shot(page, '17-ambient');
      check('17d 白天晴天時場景裡有蝴蝶等環境生物（效果開啟時）', amb >= 1, amb);
      const notes = await page.evaluate(async () => { const n0 = document.querySelectorAll('.toast').length; OC.Tx.run('t:newitem9', { get: { items: { shell: 1 } } }, 't'); await new Promise((r) => setTimeout(r, 400)); return { toasts: [...document.querySelectorAll('.toast')].filter((t) => t.textContent.includes('圖鑑新增')).length }; });
      check('17e 新發現只出現一張卡片（不再同時跳出提示＋卡片）', notes.toasts === 0, notes);
      await page.evaluate(() => { OC.Store.s.settings.time = 'cycle'; OC.Pages.open('settings'); }); await wait(page, 600);
      const set = await page.evaluate(() => document.querySelector('[data-time-desc]') && document.querySelector('[data-time-desc]').textContent);
      await page.tap('[data-page="settings"] button:has-text("時間與天氣")'); await wait(page, 600);
      const tp = await page.evaluate(() => !!document.querySelector('.time-big'));
      check('17f 設定頁的時間與時間面板一致（顯示目前模式，按鈕開啟同一個面板）', /遊戲循環/.test(set || '') && tp, { set, tp });
      await page.evaluate(() => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); OC.Store.s.settings.time = 'fixed'; OC.Store.s.settings.fixedHour = 10; });
    }

    check('全程沒有 JavaScript 錯誤', errors.length === 0, errors.slice(0, 5));
  } catch (e) {
    console.error(e); check('執行中斷', false, String(e && e.stack || e));
  } finally {
    fs.writeFileSync(path.join(__dirname, 'last-results.json'), JSON.stringify({ at: new Date().toISOString(), results: H.results }, null, 1));
    const bad = H.results.filter((r) => !r.ok);
    console.log(`\n${H.results.length - bad.length}/${H.results.length} passed`);
    await browser.close();
    process.exit(bad.length ? 1 : 0);
  }
})();
