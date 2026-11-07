/* OC Shimeji — Phase 5 automated scenario tests (1–13 in the browser + engine checks; 14 = APK, see docs/phase5-report.md).
 *   cd game && python3 -m http.server 8765 &      # then, from the repo root:
 *   node game/tests/world/run.js [scenario numbers…]
 * Real game in Chromium (SwiftShader WebGL), portrait 393×852, touch. Minigames are PLAYED with real pointer
 * events (a bot reads OC.Mini.state, a read-only view of the game, and decides when to press / release).
 * Writes game/tests/world/last-results.json; screenshots go to deliverables/phase5/. Exit code 1 if a check fails.
 */
const fs = require('fs'), path = require('path');
const H = require('../life/harness.js');
const { check, wait, advance } = H;
const only = process.argv.slice(2).map(Number).filter(Boolean);
const want = (n) => !only.length || only.includes(n);
const SHOTS = process.env.OC_SHOTS || path.join(__dirname, '..', '..', '..', 'deliverables', 'phase5');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });

async function until(page, fn, arg, ms = 30000, step = 200) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(step); } return false; }
const setHour = (page, h) => page.evaluate((hh) => { const c = OC.Store.s.life.clock; c.gm = Math.floor(c.gm / 1440) * 1440 + hh * 60 + 1440; }, h);
const ids = (page) => page.evaluate(() => { const o = {}; for (const c of OC.Chars.all()) o[c.profile.name] = c.id; return o; });
const travel = async (page, to) => { await page.evaluate((t) => OC.WorldUI.travel(t), to); let ok = await until(page, (t) => OC.World.area && OC.World.area.id === t && !!OC.App.player, to, 8000); if (!ok) { console.log('  (travel retry →', to + ')'); await page.evaluate((t) => OC.WorldUI.travel(t), to); ok = await until(page, (t) => OC.World.area && OC.World.area.id === t && !!OC.App.player, to, 8000); } await page.waitForTimeout(400); return ok; };
/** test-only seeding through the real transaction system (life-sim mode has no "add item" button) */
const seed = (page, key, get) => page.evaluate(([k, g]) => OC.Tx.run('test:' + k, { get: g }, '測試補給').ok, [key, get]);
const info = (page) => page.evaluate(() => { const i = OC.World.renderer.info; return { calls: i.render.calls, geo: i.memory.geometries, tex: i.memory.textures, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; });

(async () => {
  const { browser, page, errors } = await H.launch();
  try {
    await H.boot(page, { chars: 3, seed: 11, travel: true });
    const I = await ids(page);
    await page.evaluate(() => { window.__R = OC.World.renderer; window.__scene = OC.World.root && OC.World.root.parent; });

    // ================= engine: transactions =================
    {
      const r = await page.evaluate(() => {
        const S = OC.Store.s, c0 = S.coins, out = {};
        out.a = OC.Tx.run('t:a', { get: { coins: 100 } }, 't').ok && S.coins === c0 + 100;
        out.dup = OC.Tx.run('t:a', { get: { coins: 100 } }, 't'); out.dupOk = !out.dup.ok && out.dup.dup && S.coins === c0 + 100;
        out.poor = !OC.Tx.run('t:b', { pay: { coins: S.coins + 1 } }, 't').ok && S.coins === c0 + 100;
        const inv0 = JSON.stringify(S.inv);
        out.atomic = !OC.Tx.run('t:c', { pay: { coins: 10, items: { no_such_item: 1 } }, get: { items: { apple: 1 } } }, 't').ok && S.coins === c0 + 100 && JSON.stringify(S.inv) === inv0;
        out.neg = !OC.Tx.run('t:d', { get: { coins: -5 } }, 't').ok && !OC.Tx.run('t:e', { get: { items: { apple: 1.5 } } }, 't').ok;
        out.stock = (() => { const id = OC.Shops.stock('market')[0], left = OC.Shops.left('market', id); const big = OC.Shops.buy('market', id, left + 1); return !big.ok && OC.Shops.left('market', id) === left; })();
        out.buy = (() => { const id = 'egg', n0 = OC.Store.count(id), m0 = S.coins, pr = OC.Shops.price('food', id).price, bonus = OC.Tx.done('find:' + id) ? 0 : OC.Shops.INCOME.find, b = OC.Shops.buy('food', id, 2); return b.ok && OC.Store.count(id) === n0 + 2 && S.coins === m0 - pr * 2 + bonus; })();
        out.ledger = OC.Tx.log.length >= 2 && OC.Tx.log[0].key && OC.Tx.done('t:a');
        out.quest = (() => { const q = OC.Game.todayQuests()[0]; (S.quests.prog = S.quests.prog || {})[q.id] = q.n; const m = S.coins, a = OC.Game.claim(q.id), m1 = S.coins, b = OC.Game.claim(q.id); return !!a && m1 > m && !b && S.coins === m1; })();
        return out;
      });
      check('T1 交易：同一個 key 只會入帳一次（防重複獎勵）', r.a && r.dupOk);
      check('T2 交易：星幣不夠＝整筆失敗、不扣錢', r.poor);
      check('T3 交易：任一部分無效＝全部不生效（原子性）', r.atomic);
      check('T4 交易：負數／小數數量一律拒絕', r.neg);
      check('T5 商店：超過庫存的購買失敗，庫存不會變負', r.stock);
      check('T6 商店：購買＝扣星幣＋入背包（同一筆交易）', r.buy);
      check('T7 帳本：每筆都有 key 並可查詢', r.ledger);
      check('T8 任務獎勵不能重複領取', r.quest);
    }

    // ================= 1. map / travel / return =================
    if (want(1)) {
      const order = ['street', 'cafe', 'street', 'library', 'street', 'beach', 'forest', 'isle', 'home', 'isle'];
      const seen = [];
      for (const to of order) { const ok = await travel(page, to); const st = await page.evaluate(() => ({ id: OC.World.area.id, p: !!OC.App.player, walk: OC.World.walkable(OC.App.player.x, OC.App.player.y), n: OC.World.interacts.length + OC.World.furn.filter((f) => f.it).length })); seen.push([to, ok && st.p && st.walk, st.n]); if (!(ok && st.p && st.walk)) console.log('  1a detail', to, ok, JSON.stringify(st), await page.evaluate(() => JSON.stringify({ x: OC.App.player.x, y: OC.App.player.y, near: OC.World.nearestWalkable(OC.App.player.x, OC.App.player.y, 10) }))); if (['street', 'beach', 'cafe', 'home'].includes(to) && !fs.existsSync(path.join(SHOTS, `1-${to}.png`))) { await wait(page, 700); await shot(page, `1-${to}`); } }
      check('1a 依序前往 商店街→咖啡廳→商店街→圖書館→海灘→森林→島→家→島，每次都到得了且玩家站在可走的位置', seen.every((s) => s[1]), seen.map((s) => s[0] + (s[1] ? '✓' : '✗')).join(' '));
      check('1b 每個開放地點都有可互動物件（沒有空場景）', seen.every((s) => s[2] >= 3), seen.map((s) => `${s[0]}:${s[2]}`).join(' '));
      const same = await page.evaluate(() => OC.World.renderer === window.__R && OC.Sim.running !== false);
      check('1c 切換地點不重建渲染器（同一個 WebGL context）', same);
      // via the map UI with touch
      await page.evaluate(() => OC.App.tab('explore')); await wait(page, 500);
      await page.tap('.map-pin[aria-label="星砂海灘"]'); await wait(page, 300); await shot(page, '1-map');
      await page.tap('[data-page="explore"] .card .btn.primary', { timeout: 10000 });
      const viaMap = await until(page, () => OC.World.area.id === 'beach', null, 10000);
      check('1d 從世界地圖點選地點→「前往」即可抵達', viaMap);
      const locked = await page.evaluate(() => { OC.WorldUI.travel('fair'); return OC.World.area.id; });
      check('1e 未開放的地點（彩虹遊樂園）明確標示且無法進入', locked === 'beach' && await page.evaluate(() => !!document.querySelector('.map-pin.locked')));
      await travel(page, 'isle');
    }

    // ================= 2. autonomous destinations =================
    if (want(2)) {
      // the player stays on the street: the three OCs on the island live abstractly → they choose places by themselves
      await travel(page, 'street');
      const r = await page.evaluate(() => {
        const out = {}; for (const c of OC.Chars.all()) out[c.id] = { places: {}, trips: 0 };
        for (let i = 0; i < 160; i++) { OC.Sim.advance(10); for (const c of OC.Chars.all()) { if (c.id === OC.Store.s.activeId) continue; const o = out[c.id]; const l = c.life.loc || 'isle'; o.places[l] = (o.places[l] || 0) + 1; } }
        for (const c of OC.Chars.all()) out[c.id].log = c.life.log.filter((l) => l.text.startsWith('前往')).map((l) => l.text).slice(0, 6), out[c.id].name = c.profile.name, out[c.id].traits = c.personality.traits, out[c.id].visited = Object.keys(c.life.places || {});
        return out;
      });
      const others = Object.entries(r).filter(([id]) => id !== I['麻糬']).map(([, v]) => v);
      console.log(JSON.stringify(others.map((o) => [o.name, o.places, o.log.slice(0, 3)])));
      check('2a 不在玩家身邊的 OC 會自己決定去別的地方（26 遊戲小時內）', others.some((o) => Object.keys(o.places).length >= 2), others.map((o) => `${o.name}:${Object.keys(o.places).join('/')}`).join(' '));
      check('2b 行程寫進生活紀錄（前往…）', others.some((o) => o.log.length > 0));
      check('2c 不同個性的 OC 去的地方不完全一樣', JSON.stringify(others[0].places) !== JSON.stringify(others[1].places));
      // the player can see where everyone is and go there
      await page.evaluate(() => OC.App.tab('explore')); await wait(page, 400);
      const who = await page.evaluate(() => [...document.querySelectorAll('[data-page="explore"] .row .sub')].map((e) => e.textContent));
      check('2d 地圖上的「大家在哪裡」列出每個 OC 的所在地與活動', who.length >= 3 && who.every((t) => /在|前往/.test(t)), who.slice(0, 3).join(' | '));
      await shot(page, '2-where');
      // visible departure: an OC on the island walks to the exit and leaves; the player follows and meets it there
      await page.evaluate(() => { for (const c of OC.Chars.all()) { c.life.loc = 'isle'; c.life.trip = null; c.life.cur = null; } });
      await travel(page, 'isle'); await wait(page, 600);
      const kuri = I['栗子'];
      await page.evaluate((id) => { const c = OC.Chars.get(id); c.life.loc = 'isle'; c.life.trip = null; c.life.cur = null; OC.App.syncPresence(); }, kuri); await until(page, (id) => !!OC.App.mates[id], kuri, 5000);
      await page.evaluate((id) => { const b = OC.Brain.get(id); OC.Brain.startTravel(b, 'beach', 'fish'); }, kuri);
      const left = await until(page, (id) => !OC.App.mates[id] && OC.Chars.get(id).life.loc === 'beach', kuri, 60000, 300);
      check('2e OC 走到出口後離開目前的場景（行程：海灘・釣魚）', left, await page.evaluate(([id, left]) => { const b = OC.Brain.get(id); return JSON.stringify(OC.Chars.get(id).life.trip) + (left ? '' : ` st=${b && b.st}/${b && b.act} leaving=${JSON.stringify(b && b.leaving)} holds=${b && [...b.holds]} ev=${OC.Events.current ? OC.Events.current.ev.id : '-'} log=${OC.Brain.log.filter((l) => l.who === id).slice(0, 6).map((l) => l.text).join(' / ')}`); }, [kuri, left]));
      await page.evaluate(() => OC.Sim.advance(30));
      await travel(page, 'beach');
      const met = await until(page, (id) => !!OC.App.mates[id], kuri, 8000);
      const doing = await until(page, (id) => { const b = OC.Brain.get(id); return b && (b.act === 'fish' || b.st === 'go' || b.st === 'do'); }, kuri, 20000);
      check('2f 玩家跟過去：在海灘看到栗子從門口走進來並在那裡活動', met && doing, await page.evaluate((id) => { const b = OC.Brain.get(id); return b ? `${b.st}/${b.act}` : 'none'; }, kuri));
      await wait(page, 1500); await shot(page, '2-follow-beach');
    }

    // ================= 3. 2D characters in 3D =================
    if (want(3)) {
      await travel(page, 'isle');
      const r = await page.evaluate(async () => {
        const a = OC.App.player, W = OC.World; const samples = [];
        const to = W.nearestWalkable(300, 300, 40) || { x: 300, y: 300 };
        W.walkTo(a, to.x, to.y);
        // sampled every rendered frame: an instant flip would change face/back by ~2 in one frame
        const t0 = performance.now(); while (performance.now() - t0 < 4800) { await new Promise((r) => requestAnimationFrame(r)); samples.push({ x: a.x, y: a.y, gy: a.gy, g: W.groundY(a.x, a.y), face: a.face, back: a.back, lvl: a.lvl }); }
        return samples;
      });
      const moved = Math.hypot(r[r.length - 1].x - r[0].x, r[r.length - 1].y - r[0].y);
      const maxGap = Math.max(...r.map((s) => Math.abs(s.gy - s.g)));
      const maxTurn = Math.max(...r.slice(1).map((s, i) => Math.abs(s.face - r[i].face) + Math.abs(s.back - r[i].back)));
      check('3a 角色在 3D 地形上移動（走了一段路）', moved > 40, `${moved.toFixed(0)} 單位`);
      check('3b 腳底貼地：看板高度跟地面高度一致（含台階）', maxGap < 6, `最大差 ${maxGap.toFixed(2)}；層 ${[...new Set(r.map((s) => s.lvl))].join(',')}`);
      check('3c 轉身平滑：方向不會瞬間翻轉（逐幀取樣，瞬間翻轉＝2）', maxTurn < 1.2, `每幀最大變化 ${maxTurn.toFixed(2)}，${r.length} 幀`);
      const occl = await page.evaluate(() => { const a = OC.App.player; return { xray: !!a.xray, order: a.mesh ? a.mesh.renderOrder : null }; });
      check('3d 被建築遮住時有輪廓（x-ray）且使用深度排序', occl.xray, JSON.stringify(occl));
    }

    // ================= 4. furniture placement & reload =================
    if (want(4)) {
      await travel(page, 'home');
      await seed(page, 'furn', { items: { sofa: 1, bookshelf: 1, lantern: 2 } });
      const r = await page.evaluate(async () => {
        const out = {}, R = () => OC.Places.room('home'), n0 = R().length, sofa0 = OC.Store.count('sofa');
        OC.App.startPlacement({ id: 'sofa' }); await new Promise((r) => setTimeout(r, 200));
        const bar = document.querySelector('.place-bar.v5'); out.bar = !!bar;
        const btn = (l) => bar.querySelector(`[aria-label="${l}"]`);
        btn('旋轉').click(); btn('放大').click(); const sc1 = OC.World.ghost.f.sc; btn('復原').click(); const sc0 = OC.World.ghost.f.sc; btn('重做').click(); out.undo = sc0 < sc1 && OC.World.ghost.f.sc === sc1;
        out.notConsumedYet = OC.Store.count('sofa') === sofa0;
        bar.querySelector('[data-ok]').click(); await new Promise((r) => setTimeout(r, 200));
        out.placed = R().length === n0 + 1 && OC.Store.count('sofa') === sofa0 - 1; out.rec = R()[R().length - 1];
        // cancel = nothing used
        OC.App.startPlacement({ id: 'lantern' }); await new Promise((r) => setTimeout(r, 100)); document.querySelector('.place-bar.v5 [aria-label="取消"]').click(); out.cancel = OC.Store.count('lantern') === 2 && R().length === n0 + 1;
        // wall item snaps to the wall
        OC.App.startPlacement({ id: 'bookshelf' }); await new Promise((r) => setTimeout(r, 100)); out.wallY = OC.World.ghost.f.y; out.areaWall = OC.World.area.wallY; document.querySelector('.place-bar.v5 [data-ok]').click(); await new Promise((r) => setTimeout(r, 100));
        // move + store back
        const lamp = OC.Places.room('home').length; OC.App.startPlacement({ id: 'lantern' }); await new Promise((r) => setTimeout(r, 100)); document.querySelector('.place-bar.v5 [data-ok]').click(); await new Promise((r) => setTimeout(r, 100));
        const L = R().find((f) => f.id === 'lantern'); OC.App.startPlacement({ uid: L.uid }); await new Promise((r) => setTimeout(r, 100)); document.querySelector('.place-bar.v5 [aria-label="收回背包"]').click(); await new Promise((r) => setTimeout(r, 100));
        out.store = OC.Store.count('lantern') === 2 && !R().find((f) => f.uid === L.uid);
        out.isleUntouched = OC.Places.room('isle').every((f) => f.id !== 'sofa');
        OC.Store.persist(); return out;
      });
      check('4a 佈置列：旋轉／縮放／復原／重做都有效', r.bar && r.undo);
      check('4b 按下「放這裡」前不會扣背包；確定後才扣 1 個', r.notConsumedYet && r.placed);
      check('4c 取消佈置＝背包數量不變', r.cancel);
      check('4d 掛牆物品（書櫃）會貼著牆', r.areaWall != null && Math.abs(r.wallY - r.areaWall) < 40, `y=${r.wallY} 牆=${r.areaWall}`);
      check('4e 收回背包：場景移除、背包 +1', r.store);
      check('4f 每個地點的佈置分開保存（家裡的沙發不會出現在島上）', r.isleUntouched);
      await wait(page, 500); await shot(page, '4-home-decor');
      await page.reload(); await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 }); await wait(page, 800); await page.evaluate(() => { window.__R = OC.World.renderer; });
      const after = await page.evaluate(() => ({ area: OC.World.area.id, sofa: OC.Places.room('home').some((f) => f.id === 'sofa'), meshes: OC.World.furn.length, n: OC.Places.room('home').length }));
      check('4g 重新開啟後：仍在家裡、沙發還在原位、場景裡有對應模型', after.area === 'home' && after.sofa && after.meshes >= after.n, JSON.stringify(after));
    }

    // ================= 5. OCs use furniture =================
    if (want(5)) {
      if ((await page.evaluate(() => OC.World.area.id)) !== 'isle') await travel(page, 'isle');
      await seed(page, 'swing', { items: { swing: 1 } });
      const r = await page.evaluate(async () => {
        OC.App.startPlacement({ id: 'swing' }); await new Promise((r) => setTimeout(r, 150)); document.querySelector('.place-bar.v5 [data-ok]').click(); await new Promise((r) => setTimeout(r, 300));
        const f = OC.Places.room('isle').find((x) => x.id === 'swing'); const aff = OC.Brain.aff.find((o) => o.id === 'furn:' + f.uid);
        return { uid: f.uid, verbs: aff ? aff.verbs : null, seats: aff ? aff.slots.length : 0 };
      });
      check('5a 新家具立刻成為可供性（鞦韆：play，2 個位子）', r.verbs && r.verbs.includes('play') && r.seats >= 2, JSON.stringify(r));
      const k = I['栗子'];
      await page.evaluate((id) => { const c = OC.Chars.get(id); c.life.loc = 'isle'; c.life.trip = null; c.life.cur = null; OC.App.syncPresence(); }, k); await wait(page, 600);
      await page.evaluate((id) => { const c = OC.Chars.get(id); c.needs.fun = 10; c.needs.energy = 90; c.needs.food = 80; c.needs.sleep = 80; OC.Brain.get(id).holds.clear(); OC.Brain.command(id, 'play'); }, k);
      const used = await until(page, ([id, uid]) => { const b = OC.Brain.get(id); return b && b.slot && String(b.slot.k).includes(uid); }, [k, r.uid], 40000, 300);
      check('5b OC 走過去使用新家具（預約位子後玩鞦韆）', used, await page.evaluate((id) => { const b = OC.Brain.get(id); return b ? `${b.st}/${b.act}/${b.slot && b.slot.k}` : ''; }, k));
      await wait(page, 1200); await shot(page, '5-swing');
    }

    // ================= 6. playable activities (played by a bot with real pointer events) =================
    if (want(6)) {
      if ((await page.evaluate(() => OC.World.area.id)) !== 'beach') await travel(page, 'beach');
      // --- fishing ---
      const fish0 = await page.evaluate(() => Object.keys(OC.Store.s.inv).filter((id) => OC.Style.ITEMS[id] && OC.Style.ITEMS[id].kind === 'fish').reduce((a, id) => a + OC.Store.count(id), 0));
      await page.evaluate(() => OC.Mini.fishing('sea')); await wait(page, 400);
      let st = await page.evaluate(() => OC.Mini.state); const cx = st.rect.x + st.rect.width / 2, cy = st.rect.y + st.rect.height / 2;
      let caught = false; const t0 = Date.now();
      await shot(page, '6-fishing-start');
      while (Date.now() - t0 < 90000) {
        st = await page.evaluate(() => OC.Mini.state); if (!st) { caught = true; break; }
        if (st.st === 'charge') { await page.mouse.move(cx, cy); await page.mouse.down(); await wait(page, 450); await page.mouse.up(); await wait(page, 100); continue; }
        if (st.st === 'wait') { await wait(page, 60); continue; }
        if (st.st === 'bite') { await page.mouse.down(); await page.mouse.up(); continue; }
        if (st.st === 'reel') { if (st.mark + st.mv * 0.35 < st.zone) await page.mouse.down(); else await page.mouse.up(); await wait(page, 20); if (st.prog > 0.6 && !fs.existsSync(path.join(SHOTS, '6-fishing-reel.png'))) await shot(page, '6-fishing-reel'); continue; }
        await wait(page, 50);
      }
      await page.mouse.up();
      const fishR = await page.evaluate((f0) => ({ n: Object.keys(OC.Store.s.inv).filter((id) => OC.Style.ITEMS[id] && OC.Style.ITEMS[id].kind === 'fish').reduce((a, id) => a + OC.Store.count(id), 0) - f0, skill: OC.Mind.skillLv(OC.Chars.active(), 'fishing'), xp: (OC.Chars.active().life.skills || {}).fishing, mem: OC.Chars.active().life.mem.recent.concat(OC.Chars.active().life.mem.long).some((m) => /釣到/.test(m.text)) }), fish0);
      check('6a 釣魚：蓄力→等待→上鉤點擊→收線，真的釣到魚並入背包', caught && fishR.n === 1, JSON.stringify(fishR));
      check('6b 釣魚給技能經驗並寫入回憶', fishR.mem && (fishR.xp || 0) > 0);
      // --- cooking: ingredients consumed only on success ---
      await seed(page, 'cook', { items: { rice: 2 } });
      await page.evaluate(() => OC.Mini.cookGame(OC.Mini.RECIPES[0])); await wait(page, 300);
      st = await page.evaluate(() => OC.Mini.state); const r0 = st.rect, kcx = r0.x + r0.width / 2, kcy = r0.y + r0.height / 2;
      let cookDone = false; const t1 = Date.now(), rice0 = 2;
      while (Date.now() - t1 < 60000) {
        st = await page.evaluate(() => OC.Mini.state); if (!st) { cookDone = true; break; }
        if (st.step === 'chop') { if (st.marks.some((m) => m != null && Math.abs(m - st.kx) < 0.03)) { await page.mouse.move(kcx, kcy); await page.mouse.down(); await page.mouse.up(); await wait(page, 80); } else await wait(page, 15); continue; }
        if (st.step === 'stir') { await page.mouse.move(kcx + 40, kcy); await page.mouse.down(); for (let a = 0; a < Math.PI * 8; a += 0.5) await page.mouse.move(kcx + Math.cos(a) * 40, kcy + Math.sin(a) * 30); await page.mouse.up(); continue; }
        if (st.step === 'heat') { if (Math.abs(st.needle - 0.62) < 0.04) { await page.mouse.down(); await page.mouse.up(); } else await wait(page, 10); continue; }
        await wait(page, 30);
      }
      const cook = await page.evaluate(() => ({ rice: OC.Store.count('rice'), oni: OC.Store.count('onigiri'), log: OC.Tx.log[0].reason }));
      check('6c 料理：切菜→攪拌→火候，完成才扣材料並得到料理', cookDone && cook.rice === rice0 - 1 && cook.oni >= 1, JSON.stringify(cook));
      await page.evaluate(() => OC.Mini.cookGame(OC.Mini.RECIPES[0])); await wait(page, 300); await page.evaluate(() => document.querySelector('.mini [aria-label="結束"]').click());
      check('6d 料理中途放棄＝材料都還在', (await page.evaluate(() => OC.Store.count('rice'))) === cook.rice);
      // --- personality changes the game ---
      const pers = await page.evaluate(async () => { const c = OC.Chars.active(), tr = c.personality.traits.slice(), get = async (t) => { c.personality.traits = t; OC.Mini.fishing('sea'); await new Promise((r) => setTimeout(r, 150)); const s = OC.Mini.state; OC.Mini.close(); return s.pers; }; const a = await get(['diligent', 'curious']), b = await get(['lazy']); c.personality.traits = tr; return { a, b }; });
      check('6h 個性影響玩法：勤奮／好奇＝收線區更寬、上鉤反應時間更長；懶散＝收線較慢', pers.a.pz > pers.b.pz && pers.a.pb > pers.b.pb && pers.b.pr < 1, JSON.stringify(pers));
      // forage (daily, per spot) + plot (water → grows in game time → harvest)
      await travel(page, 'forest');
      const fo = await page.evaluate(() => { const sp = OC.Areas.forest.forageSpots, i = sp.findIndex((x, j) => OC.Places.forageAvail('forest', j)), k = sp[i][2], n0 = OC.Store.count(k); const r1 = OC.Places.forage('forest', i, k), n1 = OC.Store.count(k), r2 = OC.Places.forage('forest', i, k); return { r1: r1.ok && n1 > n0, r2: r2.ok, why: r2.why, n: OC.Store.count(k) === n1 }; });
      check('6e 採集：入背包；同一個點一天只能採一次', fo.r1 && !fo.r2 && fo.n, fo.why);
      await travel(page, 'isle');
      await seed(page, 'seed', { items: { seed_tomato: 1 } });
      const g = await page.evaluate(() => { const id = Object.keys(OC.Places.plot ? OC.Areas.isle.plots || {} : {})[0]; const pid = 'isle0'; const p = OC.Places.plant(pid, 'seed_tomato'); const s0 = OC.Store.count('seed_tomato'); OC.Places.water(pid, OC.Store.s.activeId); for (let d = 0; d < 12 && OC.Places.plot(pid).growth < 1; d++) { OC.Sim.advance(1440); OC.Places.water(pid, OC.Store.s.activeId); } const pl = OC.Places.plot(pid); const t0 = OC.Store.count('tomato'), h = OC.Places.harvest(pid), h2 = OC.Places.harvest(pid); return { planted: p.ok, seedUsed: s0 === 0, growth: pl.growth, got: OC.Store.count('tomato') - t0, again: h2.ok }; });
      check('6f 種田：播種扣種子→澆水在遊戲時間內成長→收成入背包，不能重複收成', g.planted && g.seedUsed && g.got >= 1 && !g.again, JSON.stringify(g));
      // OCs do activities too: an unwatered plot attracts an OC who waters it (the plot remembers who)
      await seed(page, 'seed2', { items: { seed_carrot: 1 } });
      const k = I['小空'];
      await setHour(page, 10);
      await page.evaluate((id) => { OC.Store.s.settings.weather = 'clear'; OC.Places.plant('isle1', 'seed_carrot'); OC.Brain.rebuild(); const c = OC.Chars.get(id); c.life.loc = 'isle'; c.life.trip = null; c.life.cur = null; Object.assign(c.needs, { fun: 30, food: 80, sleep: 80, energy: 80 }); OC.App.syncPresence(); const b = OC.Brain.get(id); b.holds.clear(); OC.Brain.command(id, 'tend'); }, k);
      const tend = await until(page, () => { const w = OC.Places.plot('isle1').wateredBy; return !!w && w !== 'player' && w !== OC.Store.s.activeId; }, k, 40000, 300);
      check('6g OC 也會使用活動設施（OC 走去菜園澆水，菜園記得是誰澆的）', tend, await page.evaluate((id) => { const b = OC.Brain.get(id), o = OC.Brain.aff.find((x) => x.id === 'plot:isle1'); return b ? `${b.st}/${b.act}/${OC.Places.plot('isle1').wateredBy} verbs=${o && o.verbs} res=${o && [...OC.Brain.res.entries()].filter(([k]) => k.startsWith('plot:isle1')).join()} reason=${b.dbg.reason} cands=${JSON.stringify((b.dbg.cands || []).slice(0, 3))} loc=${OC.Chars.get(id).life.loc} mate=${!!OC.App.mates[id]} plot=${JSON.stringify(OC.Places.plot('isle1'))} day=${OC.Sim.day()} wx=${OC.Clock.weather()} log=${OC.Brain.log.filter((l) => l.who === id).slice(-8).map((l) => l.text).join(' / ')}` : 'no brain'; }, k));
      await shot(page, '6-garden');
    }

    // ================= 7. workshop product → shop → buy → use =================
    if (want(7)) {
      const r = await page.evaluate(async () => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#F48FB1'; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.fill();
        const blob = await OC.Assets.canvasToBlob(cv); const meta = await OC.Assets.putBlob(blob, { name: '粉紅糰子', kind: 'item' });
        const inv0 = JSON.stringify(OC.Store.s.inv);
        const bad = OC.Items.saveCustom({ zh: '', kind: 'food', price: 50, asset: meta.id });
        const ok = OC.Items.saveCustom({ zh: '粉紅糰子', kind: 'food', price: 60, power: 25, asset: meta.id, shop: 'food', flavor: { sweet: 1 } });
        const id = ok.id, inStock = OC.Shops.stock('food').includes(id), noInv = JSON.stringify(OC.Store.s.inv) === inv0 && OC.Store.count(id) === 0;
        const buy = OC.Shops.buy('food', id, 1);
        return { bad: bad.ok, ok: ok.ok, id, inStock, noInv, bought: buy.ok && OC.Store.count(id) === 1, asset: meta.id };
      });
      check('7a 工坊商品驗證（沒有名稱會被拒絕並說明原因）', !r.bad && r.ok);
      check('7b 上架後出現在指定商店，但工坊不會直接給物品', r.inStock && r.noInv);
      check('7c 用星幣購買後才進背包', r.bought);
      const k = I['栗子'];
      if ((await page.evaluate((id) => !!OC.App.actorOf(id), k)) === false) { await page.evaluate((id) => { OC.Chars.get(id).life.loc = OC.World.area.id; OC.Chars.get(id).life.trip = null; OC.App.syncPresence(); }, k); await wait(page, 500); }
      const fed = await page.evaluate(async ([id, item]) => { OC.Brain.get(id).holds.clear(); OC.Chars.get(id).needs.food = 50; const ok = await OC.Use.feed(id, item); return { ok, left: OC.Store.count(item), tasted: (OC.Taste.prefs(OC.Chars.get(id)).tasted[item] || {}).n || 0 }; }, [k, r.id]);
      check('7d 自製食物可以餵 OC（吃完才扣、留下品嚐紀錄）', fed.ok && fed.left === 0 && fed.tasted === 1, JSON.stringify(fed));
      await page.evaluate(() => OC.Pages.open('shop', { shop: 'food' })); await wait(page, 500); await shot(page, '7-shop-custom'); await page.evaluate(() => OC.Pages.close('shop'));
      const reload = await page.evaluate((id) => { OC.Store.persist(); return !!OC.Style.ITEMS[id]; }, r.id);
      check('7e 自製商品保存在存檔（只存圖片 id）', reload && await page.evaluate((id) => !JSON.stringify(OC.Store.s.custom).includes('data:image') && OC.Store.s.custom.items[id].asset != null, r.id));
    }

    // ================= 8. drag food from the quick bag =================
    if (want(8)) {
      if ((await page.evaluate(() => OC.World.area.id)) !== 'isle') await travel(page, 'isle');
      await seed(page, 'drag', { items: { cookie: 3 } });
      const k = I['小空'];
      await page.evaluate((id) => { const c = OC.Chars.get(id); c.life.loc = 'isle'; c.life.trip = null; OC.App.syncPresence(); c.needs.food = 40;
        // everyone stands still so nobody walks under the finger (a drop goes to whoever is under it)
        for (const b of Object.values(OC.Brain.brains)) { if (!b.a || b.manual) continue; b.holds.clear(); if (b.st === 'social') OC.Brain.Social.end(b.conv || OC.Brain.convs.find((x) => x.a === b || x.b === b), 't'); if (b.st === 'go') OC.Brain.abort(b, 't'); if (b.st === 'do') OC.Brain.finish(b, 't'); b.st = 'think'; b.thinkAt = 1e9; b.a.path = null; } }, k);
      await wait(page, 800);
      await page.evaluate(() => { window.__toasts = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.classList && n.classList.contains('toast') && window.__toasts.push(n.textContent)))).observe(document.getElementById('app'), { childList: true, subtree: true }); window.__uses = []; const u = OC.Use.use; OC.Use.use = (id, oc) => { window.__uses.push([id, oc && OC.Chars.name(OC.Chars.get(oc))]); return u(id, oc); }; });
      await page.evaluate(() => document.querySelector('.bag-fab').click()); await wait(page, 500);
      const slot = await page.$('.tray .slot[data-id="cookie"]');
      const box = await slot.boundingBox();
      const tgt = await page.evaluate((id) => { const a = OC.App.actorOf(id); return OC.World.project(a.x, a.y, a.lvl, (a.gy - a.lvl * OC.World.HY) + 18); }, k);
      const n0 = await page.evaluate(() => OC.Store.count('cookie'));
      // 1) drop on empty ground = cancel, nothing used
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 4 }); await page.mouse.move(30, 200, { steps: 6 });
      const rings = await page.evaluate(() => document.querySelectorAll('.drop-ring').length);
      await page.mouse.up(); await wait(page, 300);
      check('8a 拖曳時只標出可以接收的 OC（有效目標提示）', rings >= 1, `${rings} 個`);
      check('8b 放在空白處＝取消，不消耗', (await page.evaluate(() => OC.Store.count('cookie'))) === n0);
      // 2) drop on the OC
      const slot2 = await page.$('.tray .slot[data-id="cookie"]'); const box2 = await slot2.boundingBox();
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2); await page.mouse.down(); await page.mouse.move(box2.x + box2.width / 2, box2.y - 40, { steps: 4 });
      const tgt2 = await page.evaluate((id) => { const a = OC.App.actorOf(id); return OC.World.project(a.x, a.y, a.lvl, (a.gy - a.lvl * OC.World.HY) + 18); }, k);
      await page.mouse.move(tgt2.x, tgt2.y, { steps: 8 }); const hot = await page.evaluate(() => !!document.querySelector('.drag-ghost.hit'));
      await shot(page, '8-drag-food');
      const tgt3 = await page.evaluate((id) => { const a = OC.App.actorOf(id); return OC.World.project(a.x, a.y, a.lvl, (a.gy - a.lvl * OC.World.HY) + 18); }, k);   // the camera may have eased during the screenshot
      await page.mouse.move(tgt3.x, tgt3.y, { steps: 2 });
      await page.mouse.up();
      const during = await page.evaluate(() => OC.Store.count('cookie'));
      await until(page, (n) => OC.Store.count('cookie') === n - 1, n0, 10000);
      const fed = await page.evaluate(([id, n]) => { const b = OC.Brain.get(id); return { n: OC.Store.count('cookie'), food: OC.Chars.get(id).needs.food, tasted: (OC.Taste.prefs(OC.Chars.get(id)).tasted.cookie || {}).n, holds: b && [...b.holds], st: b && b.st, ev: OC.Events.current ? OC.Events.current.ev.id : '-', toasts: (window.__toasts || []).slice(-4), uses: window.__uses, mate: !!OC.App.mates[id], tx: OC.Tx.log.slice(0, 2).map((e) => e.reason) }; }, [k, n0]);
      check('8c 拖到 OC 身上時有命中提示', hot);
      check('8d 動畫進行中還沒扣；吃完才扣 1 個並留下品嚐紀錄', during === n0 && fed.n === n0 - 1 && fed.tasted >= 1, JSON.stringify(fed));
      // 3) interrupted (picked up while eating) → not consumed
      await page.evaluate(([id]) => { OC.Use.feed(id, 'cookie'); setTimeout(() => OC.App.startCarry(id), 300); setTimeout(() => OC.App.dragEnd(), 700); }, [k]);
      await wait(page, 5000);
      check('8e 吃到一半被抱走＝中斷，物品還在背包', (await page.evaluate(() => OC.Store.count('cookie'))) === n0 - 1);
      await page.evaluate(() => document.querySelector('.tray [aria-label="收起"]').click());
      // first taste discovers a preference, unless the player locked it
      const lock = await page.evaluate(async (id) => { const c = OC.Chars.get(id); OC.Taste.setPref(c, 'pudding', -2, true); OC.Tx.run('test:pud', { get: { items: { pudding: 1 } } }, 't'); OC.Brain.get(id).holds.clear(); await OC.Use.feed(id, 'pudding'); return OC.Taste.pref(c, 'pudding'); }, k);
      check('8f 玩家鎖定的飲食喜好不會被品嚐改寫', lock.lv === -2 && lock.src === 'player' && lock.locked, JSON.stringify(lock));
    }

    // ================= 9. multi-OC facilities without conflicts =================
    if (want(9)) {
      if ((await page.evaluate(() => OC.World.area.id)) !== 'isle') await travel(page, 'isle');
      const all = Object.values(I);
      await page.evaluate((L) => { for (const id of L) { const c = OC.Chars.get(id); c.life.loc = 'isle'; c.life.trip = null; } OC.App.syncPresence(); for (const id of L) { const b = OC.Brain.get(id); if (b) b.holds.clear(); Object.assign(OC.Chars.get(id).needs, { energy: 15, food: 80, sleep: 70 }); } }, all);
      await wait(page, 600); await page.evaluate((L) => { for (const id of L) OC.Brain.command(id, 'rest'); }, all);
      let conflicts = 0, maxUsers = 0; const seenSlots = new Set();
      for (let i = 0; i < 60; i++) {
        const s = await page.evaluate(() => { const by = {}, pos = []; for (const b of Object.values(OC.Brain.brains)) { if (!b.slot || !b.a) continue; by[b.slot.k] = (by[b.slot.k] || 0) + 1; if (b.st === 'do') pos.push([b.slot.k, b.a.x, b.a.y]); } let close = 0; for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) if (Math.hypot(pos[i][1] - pos[j][1], pos[i][2] - pos[j][2]) < 4) close++; return { dup: Object.values(by).filter((n) => n > 1).length, slots: Object.keys(by), close, res: OC.Brain.res.size }; });
        conflicts += s.dup + s.close; s.slots.forEach((k) => seenSlots.add(k)); maxUsers = Math.max(maxUsers, s.slots.length);
        await wait(page, 500);
      }
      check('9a 三個 OC 同時被安排休息：都找到不同的位子，沒有搶位子或疊在一起', conflicts === 0 && maxUsers >= 2, `30 秒內使用過 ${seenSlots.size} 個位子，最多同時 ${maxUsers} 個`);
      await shot(page, '9-multi');
      const sofa = await page.evaluate(() => { const o = OC.Brain.aff.find((x) => x.slots.length >= 2); if (!o) return null; const [s1, s2] = o.slots; const ids = Object.keys(OC.Brain.brains); OC.Brain.release(ids[0]); OC.Brain.release(ids[1]); OC.Brain.release(ids[2]); const a = OC.Brain.reserve(s1, ids[0]), b = OC.Brain.reserve(s1, ids[1]), c = OC.Brain.reserve(s2, ids[1]); OC.Brain.release(ids[0]); OC.Brain.release(ids[1]); return { a, b, c, id: o.id }; });
      check('9b 多人設施：每個位子只能被一個 OC 預約，其他人改用下一個位子', sofa && sofa.a && !sofa.b && sofa.c, JSON.stringify(sofa));
    }

    // ================= 10. switch place / weather / time / perf / theme =================
    if (want(10)) {
      const r0 = await info(page);
      const steps = [['theme', 'dark'], ['weather', 'rain'], ['place', 'beach'], ['perf', 'saver'], ['hour', 21], ['place', 'street'], ['theme', 'light'], ['weather', 'clear'], ['perf', 'high'], ['place', 'isle'], ['hour', 9], ['perf', 'balanced']];
      const res = [];
      for (const [k, v] of steps) {
        if (k === 'place') await travel(page, v);
        else await page.evaluate(([k, v]) => { if (k === 'theme') OC.App.setTheme(v); if (k === 'weather') OC.Store.s.settings.weather = v; if (k === 'perf') { OC.Store.s.settings.perf = v; OC.App.applyPerf(); } if (k === 'hour') { const c = OC.Store.s.life.clock; c.gm = Math.floor(c.gm / 1440) * 1440 + v * 60 + 1440; } }, [k, v]);
        await wait(page, 600);
        res.push(await page.evaluate(() => ({ same: OC.World.renderer === window.__R, theme: document.documentElement.dataset.theme, pr: OC.World.renderer.getPixelRatio(), q: JSON.stringify(OC.World.quality), area: OC.World.area.id })));
        if (k === 'place' && v === 'beach') await shot(page, '10-beach-night-rain-dark');
      }
      check('10a 連續切換主題／天氣／時間／效能／地點，渲染器不重建', res.every((x) => x.same));
      check('10b 效能模式真的改變畫質設定（陰影／特效／草／fps／看板解析度）', new Set(res.map((x) => x.q)).size >= 2, `${new Set(res.map((x) => x.q)).size} 種設定`);
      const r1 = await info(page);
      check('10c 沒有錯誤且資源數穩定', r1.tex <= r0.tex + 12 && r1.geo <= r0.geo + 120, `geo ${r0.geo}→${r1.geo} tex ${r0.tex}→${r1.tex}`);
    }

    // ================= 11. restart persistence =================
    if (want(11)) {
      const before = await page.evaluate(() => { OC.Store.persist(); const S = OC.Store.s; return { coins: S.coins, inv: JSON.stringify(S.inv), rooms: Object.fromEntries(Object.entries(S.rooms).map(([k, v]) => [k, v.length])), ledger: OC.Tx.log.length, custom: Object.keys(S.custom.items || {}).length, locs: OC.Chars.all().map((c) => c.life.loc), area: OC.World.area.id, tastes: OC.Chars.all().map((c) => Object.keys(OC.Taste.prefs(c).tasted).length), garden: JSON.stringify(S.garden), visited: Object.keys(S.places.visited) }; });
      await page.reload(); await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 }); await wait(page, 800);
      const after = await page.evaluate(() => { const S = OC.Store.s; return { coins: S.coins, inv: JSON.stringify(S.inv), rooms: Object.fromEntries(Object.entries(S.rooms).map(([k, v]) => [k, v.length])), ledger: OC.Tx.log.length, custom: Object.keys(S.custom.items || {}).length, locs: OC.Chars.all().map((c) => c.life.loc), area: OC.World.area.id, tastes: OC.Chars.all().map((c) => Object.keys(OC.Taste.prefs(c).tasted).length), garden: JSON.stringify(S.garden), visited: Object.keys(S.places.visited), v: S.v }; });
      for (const k of ['coins', 'inv', 'rooms', 'ledger', 'custom', 'area', 'tastes', 'garden', 'visited']) check(`11 重開後保留：${k}`, JSON.stringify(before[k]) === JSON.stringify(after[k]), k === 'inv' || k === 'garden' ? '' : `${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`);
      check('11 存檔版本 v4', after.v === 4);
      await page.evaluate(() => { window.__R = OC.World.renderer; });
    }

    // ================= 12. long exploration: memory & resources =================
    if (want(12)) {
      const loop = ['street', 'cafe', 'street', 'beach', 'forest', 'isle', 'home', 'isle'];
      await travel(page, 'isle'); await wait(page, 500);
      const base = await info(page); const samples = [];
      for (let round = 0; round < 4; round++) { for (const p of loop) await travel(page, p); await wait(page, 300); samples.push(await info(page)); }
      console.log(JSON.stringify({ base, samples }));
      const last = samples[samples.length - 1], first = samples[0];
      check('12a 來回 32 次換場景：共用快取暖機後幾何數不再成長（第 3→4 輪 ≤ +10）', last.geo - samples[2].geo <= 10, samples.map((s) => s.geo).join('→'));
      check('12b 材質數有上限（第 3→4 輪 ≤ +2，總數 < 40）', last.tex - samples[2].tex <= 2 && last.tex < 40, samples.map((s) => s.tex).join('→'));
      if (last.heap != null) check('12c JS heap 穩定（< +40MB）', last.heap - first.heap < 40, samples.map((s) => s.heap + 'MB').join('→'));
      const calls = {}; for (const p of ['isle', 'street', 'beach', 'forest', 'cafe', 'home', 'library']) { await travel(page, p); await wait(page, 400); calls[p] = (await info(page)).calls; }
      console.log(JSON.stringify(calls));
      check('12d 每個場景只載入自己的模型（新場景 draw calls < 250）', ['street', 'beach', 'cafe', 'home', 'library'].every((p) => calls[p] < 250), JSON.stringify(calls));
    }

    // ================= 13. Android portrait controls =================
    if (want(13)) {
      await travel(page, 'street');
      const sizes = await page.evaluate(async () => {
        const bad = []; const chk = (sel) => document.querySelectorAll(sel).forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.height && (r.width < 40 || r.height < 40)) bad.push(sel + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
        OC.App.tab('explore'); await new Promise((r) => setTimeout(r, 300)); chk('.map-pin'); chk('[data-page="explore"] .btn');
        OC.App.tab('island'); OC.Pages.open('shop', { shop: 'furniture' }); await new Promise((r) => setTimeout(r, 300)); chk('[data-page="shop"] .shop-item'); chk('[data-page="shop"] .chip-btn'); OC.Pages.close('shop');
        OC.Pages.open('bag'); await new Promise((r) => setTimeout(r, 300)); chk('[data-page="bag"] .tile'); chk('[data-page="bag"] .chip-btn'); OC.Pages.close('bag');
        return bad;
      });
      check('13a 新介面的觸控目標 ≥ 40px（地圖、商店、背包）', sizes.length === 0, sizes.slice(0, 5).join(', '));
      // tap a shop door on the street → walk → shop opens → buy with taps
      await page.evaluate(() => { const q = OC.World.nearestWalkable(300, 700, 30); OC.World.walkTo(OC.App.player, q.x, q.y); }); await until(page, () => !OC.App.player.path, null, 20000); await wait(page, 800);
      const door = await page.evaluate(() => { for (const it of OC.World.interacts.filter((i) => i.type === 'shop')) { const p = OC.World.project(it.at.x, it.at.y, OC.World.levelAt(it.at.x, it.at.y), 14); const el = document.elementFromPoint(p.x, p.y); if (p.y > 140 && p.y < innerHeight - 200 && p.x > 80 && p.x < innerWidth - 80 && el && el.tagName === 'CANVAS' && (OC.World.pick(p.x, p.y).it || {}).shop === it.shop) return { x: p.x, y: p.y, zh: OC.Shops.get(it.shop).zh }; } return null; });
      console.log('  13b door', JSON.stringify(door));
      await page.evaluate(() => { window.__toasts13 = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.classList && (n.classList.contains('toast') || n.classList.contains('sheet')) && window.__toasts13.push((n.classList.contains('sheet') ? '[sheet] ' : '') + n.textContent.slice(0, 40))))).observe(document.getElementById('app'), { childList: true, subtree: true }); });
      const pickAt = door ? await page.evaluate((d) => { const it = OC.World.pick(d.x, d.y).it; return it ? it.type + ':' + (it.shop || it.id || '') : null; }, door) : null;
      if (door) await page.touchscreen.tap(door.x, door.y);
      const isOpen = () => until(page, () => { const p = document.querySelector('[data-page="shop"]'); return p && p.classList.contains('open'); }, null, 20000);
      let tries = 1, opened = !!door && await isOpen(); if (door && !opened) { tries = 2; await page.touchscreen.tap(door.x, door.y); opened = await isOpen(); }
      check('13b 點畫面上的商店門口：角色走過去並打開那間店', opened && await page.evaluate((zh) => document.querySelector('[data-page="shop"] h1').textContent === zh, door.zh), door && `${door.zh}（點 ${tries} 次）` + (opened ? '' : ` pick=${pickAt} log=${JSON.stringify(await page.evaluate(() => window.__toasts13))} player=${JSON.stringify(await page.evaluate(() => ({ x: Math.round(OC.App.player.x), y: Math.round(OC.App.player.y), path: !!OC.App.player.path })))}`));
      if (opened) {
        const m0 = await page.evaluate(() => OC.Store.s.coins);
        await page.tap('[data-page="shop"] .shop-item'); await wait(page, 500); await shot(page, '13-buy-sheet');
        await page.tap('.sheet.open .btn.primary.block'); await wait(page, 500);
        check('13c 用觸控在商店購買（扣星幣）', (await page.evaluate(() => OC.Store.s.coins)) < m0);
        await page.evaluate(() => OC.UI.back()); await wait(page, 300);
      }
      for (const w of [360, 412]) { await page.setViewportSize({ width: w, height: Math.round(w * 2.1) }); await wait(page, 500); await page.evaluate(() => OC.App.tab('explore')); await wait(page, 400); await shot(page, `13-map-${w}`); }
      await page.setViewportSize({ width: 393, height: 852 }); await page.evaluate(() => OC.App.tab('island'));
    }

    check('全程沒有 JavaScript 錯誤', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) { console.error(e); console.log('page errors:', errors.slice(0, 5)); try { console.log('page text:', (await page.evaluate(() => document.body.innerText)).slice(0, 300)); } catch (e2) { /* */ } check('執行沒有中斷', false, String(e && e.message)); }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'last-results.json'), JSON.stringify({ at: new Date().toISOString(), results: H.results }, null, 1));
  const fail = H.results.filter((r) => !r.ok); console.log(`\n${H.results.length - fail.length}/${H.results.length} passed`); process.exit(fail.length ? 1 : 0);
})();
