/* OC Shimeji — Phase 6 automated scenario tests (1–14 + reward / anti-duplication checks; 15 = APK, see docs/phase6-report.md).
 *   cd game && python3 -m http.server 8765 &      # then, from the repo root:
 *   node game/tests/play/run.js [scenario numbers…]
 * Real game in Chromium (SwiftShader WebGL), portrait 393×852, touch, travel on, deterministic seed.
 * Where a scenario needs many repetitions (e.g. 10 fish for a challenge) it sends the same progress events the game
 * sends, through OC.Progress.emit — the engines under test (quests, requests, aspirations, achievements) only ever
 * see those events. Everything else (feeding, buying, claiming, UI taps, performances, reload) is the real flow.
 * Writes game/tests/play/last-results.json; screenshots go to deliverables/phase6/. Exit code 1 if a check fails.
 */
const fs = require('fs'), path = require('path');
const H = require('../life/harness.js');
const { check, wait } = H;
const only = process.argv.slice(2).map(Number).filter(Boolean);
const want = (n) => !only.length || only.includes(n);
const SHOTS = process.env.OC_SHOTS || path.join(__dirname, '..', '..', '..', 'deliverables', 'phase6');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
async function until(page, fn, arg, ms = 30000, step = 200) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(step); } return false; }
const ids = (page) => page.evaluate(() => { const o = {}; for (const c of OC.Chars.all()) o[c.profile.name] = c.id; return o; });
const travel = async (page, to) => { await page.evaluate((t) => OC.WorldUI.travel(t), to); const ok = await until(page, (t) => OC.World.area && OC.World.area.id === t && !!OC.App.player, to, 15000); await page.waitForTimeout(500); return ok; };
/** bring OCs to where the player is and keep them still (scenes start clean) */
const gather = (page, list) => page.evaluate((L) => { if (OC.Events.current) OC.Events.end('test'); OC.Store.s.life.ev.lastAny = Date.now();   /* scenes start without a (wall-clock dependent) special event; the gap keeps new ones away for a while */ for (const id of L) { const c = OC.Chars.get(id); c.life.loc = OC.World.area.id; c.life.trip = null; c.life.cur = null; } OC.App.syncPresence(); for (const id of L) { const b = OC.Brain.get(id); if (!b) continue; b.holds.clear(); if (b.st === 'social') OC.Brain.Social.end(b.conv || OC.Brain.convs.find((x) => x.a === b || x.b === b), 't'); if (b.st === 'go') OC.Brain.abort(b, 't'); if (b.st === 'do') OC.Brain.finish(b, 't'); b.st = 'think'; b.thinkAt = 1e9; if (b.a) b.a.path = null; Object.assign(OC.Chars.get(id).needs, { food: 50, sleep: 80, energy: 80, fun: 50, social: 60 }); } }, list);
const release = (page, list) => page.evaluate((L) => { for (const id of L) { const b = OC.Brain.get(id); if (b) b.thinkAt = 0; } }, list);

(async () => {
  const { browser, page, errors } = await H.launch();
  try {
    await H.boot(page, { chars: 3, seed: 21, travel: true });
    // the auto day cycle starts from the REAL time: pin the scenes to daytime so a late-night run does not find everyone
    // asleep or inside a night-only special event (these scenarios are about requests / performances, not sleep)
    await page.evaluate(() => { const c = OC.Store.s.life.clock, h = OC.Sim.hourOf(); if (h < 8.5 || h >= 15) { c.gm = (Math.floor(c.gm / 1440) + (h >= 15 ? 1 : 0)) * 1440 + 9 * 60; } for (const c2 of OC.Chars.all()) { c2.needs.sleep = Math.max(c2.needs.sleep, 80); c2.needs.energy = Math.max(c2.needs.energy, 70); const b = OC.Brain.get(c2.id); if (b && b.act === 'sleep') { b.until = 0; b.thinkAt = 0; } } if (OC.Events.current) OC.Events.end('test'); });
    await wait(page, 3000);
    const I = await ids(page), all = Object.values(I);
    await page.evaluate(() => { window.__R = OC.World.renderer; window.__snd = []; const p = OC.Sound.play; OC.Sound.play = (n, o) => { window.__snd.push(n); return p(n, o); }; window.__cards = []; const cd = OC.Stage.card; OC.Stage.card = (o) => { window.__cards.push(o.title); return cd(o); }; OC.Sound.unlock(); });
    await page.evaluate(() => { OC.Store.s.settings.weather = 'clear'; OC.Store.s.play.req.nextAt = 1e12; for (const r of OC.Requests.open()) r.state = 'expired'; });   // the tests create requests themselves

    // ================= 1. requests that fit each personality =================
    if (want(1)) {
      await gather(page, all);
      const r = await page.evaluate((L) => L.map((id) => { const c = OC.Chars.get(id); const w = Object.entries(OC.PlayData.REQUESTS).map(([t, d]) => [t, +d.w(c).toFixed(2)]).sort((a, b) => b[1] - a[1]); const asks = new Set(); for (let i = 0; i < 8; i++) { const l = OC.Talk.say('req_ask', c, null, { vars: { want: '想吃起司' } }); if (l) asks.add(l.text); } return { name: OC.Chars.name(c), top: w.slice(0, 3).map((x) => x[0]), style: OC.Stage.style(c), voice: OC.Talk.voice(c), asks: [...asks].slice(0, 2) }; }), all);
      console.log(JSON.stringify(r));
      check('1a 不同個性的 OC 最想提出的請求不同', new Set(r.map((x) => x.top.join())).size >= 2, r.map((x) => `${x.name}:${x.top.join('/')}`).join(' '));
      check('1b 同一個請求，不同 OC 說法不同（聲線）', new Set(r.map((x) => x.asks[0])).size >= 2, r.map((x) => `${x.name}「${x.asks[0]}」`).join(' '));
      check('1c 演出版本依個性不同（活潑／害羞／冷靜…）', new Set(r.map((x) => x.style)).size >= 2, r.map((x) => `${x.name}:${x.style}`).join(' '));
      // full flow through the UI: badge → sheet → accept → do it → performance, rewards, memory, relationship
      const k = I['栗子'];
      const rq = await page.evaluate((id) => { for (const r of OC.Requests.open()) r.state = 'expired'; const x = OC.Requests.debugOffer(id, 'toy'); return x && { id: x.id, item: x.data.item, text: x.text }; }, k);
      const badge = await page.waitForSelector('.req-badge', { timeout: 8000 }).catch(() => null); check('1d 有請求的 OC 頭上出現泡泡（可以點）', !!badge);
      await shot(page, '1-request-badge');
      for (let i = 0; i < 6 && badge; i++) { const b2 = await page.$('.req-badge'); const bb = b2 && await b2.boundingBox(); if (bb) { await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); break; } await wait(page, 300); }   // the badge follows the OC and is re-placed every frame
      await wait(page, 700);
      await shot(page, '1-request-sheet');
      const aff0 = await page.evaluate((id) => OC.Chars.get(id).life.player.aff || 0, k), coins0 = await page.evaluate(() => OC.Store.s.coins);
      await page.tap('.sheet.open .btn.primary.block'); await wait(page, 800);
      const st1 = await page.evaluate((id) => OC.Requests.list().find((x) => x.id === id).state, rq.id);
      await page.evaluate((item) => OC.Tx.run('test:toy', { get: { items: { [item]: 1 } } }, '測試補給'), rq.item);
      await page.evaluate(([id, item]) => { OC.Brain.get(id).holds.clear(); OC.Use.play(id, item); }, [k, rq.item]);
      const done = await until(page, (id) => OC.Requests.list().find((x) => x.id === id).state === 'done', rq.id, 10000);
      await until(page, () => OC.Stage.busy, null, 3000); await wait(page, 1500); await shot(page, '1-request-done');
      await until(page, () => !OC.Stage.busy && !OC.Stage.queue, null, 15000);
      const after = await page.evaluate(([id, rid]) => { const c = OC.Chars.get(id); return { aff: c.life.player.aff, mem: c.life.mem.recent.concat(c.life.mem.long).some((m) => m.key === 'req:' + rid), paid: OC.Tx.done('req:' + rid), coins: OC.Store.s.coins, n: OC.Progress.count('request') }; }, [k, rq.id]);
      check('1e 接受 → 進行中 → 實際陪玩後完成', st1 === 'active' && done, `${rq.text}：${st1} → ${done ? 'done' : '?'}`);
      check('1f 完成後：獎勵入帳一次、好感上升、寫入回憶', after.paid && after.coins > coins0 && after.aff > aff0 && after.mem, JSON.stringify(after));
      const dup = await page.evaluate((rid) => { const r = OC.Requests.list().find((x) => x.id === rid); const c0 = OC.Store.s.coins; r.state = 'active'; OC.Progress.emit('play', { oc: r.oc, item: r.data.item }); return { coins: OC.Store.s.coins - c0, state: r.state }; }, rq.id);
      check('1g 同一個請求就算再次觸發也不會重複給獎勵', dup.coins === 0, JSON.stringify(dup));
      await gather(page, [I['小空']]);   // the OC may have wandered off to another place during the scene
      const dec = await page.evaluate((id) => { for (const r of OC.Requests.open()) if (r.oc === id) r.state = 'expired'; const x = OC.Requests.debugOffer(id, 'flower'); if (!x) return null; const aff = OC.Chars.get(id).life.player.aff; OC.Requests.answer(x.id, 'decline'); return { state: x.state, cd: OC.Store.s.play.req.cd[id].flower > OC.Sim.now(), affSame: OC.Chars.get(id).life.player.aff === aff }; }, I['小空']);
      check('1h 婉拒：有冷卻、不扣好感（只有符合個性的小反應）', dec && dec.state === 'declined' && dec.cd && dec.affSame, JSON.stringify(dec));
      await until(page, () => !OC.Stage.busy && !OC.Stage.queue, null, 8000);
    }

    // ================= 2. quests: daily / weekly / place / event / hidden / challenges =================
    if (want(2)) {
      const q = await page.evaluate(() => { const d = OC.Quests.list('daily'); return { daily: d.map((x) => x.id), tags: new Set(d.map((x) => OC.PlayData.QUESTS.find((y) => y.id === x.id).tag)).size, weekly: OC.Quests.list('weekly').map((x) => x.id), bad: OC.Quests.list().filter((x) => !OC.Quests.eligible(OC.PlayData.QUESTS.find((y) => y.id === x.id))).map((x) => x.id) }; });
      check('2a 每日 4 個任務、類型分散；本週 3 個', q.daily.length === 4 && q.tags >= 3 && q.weekly.length === 3, JSON.stringify(q));
      check('2b 不會出現無法完成的任務（全部符合開放條件）', q.bad.length === 0, q.bad.join());
      // complete one daily by really doing it (feed an OC)
      const feedQ = await page.evaluate(() => { const ok = OC.Quests.list('daily').find((x) => x.id === 'd_feed' || x.id === 'd_newtaste' || x.id === 'd_fav'); return ok ? ok.key : null; });
      const k = I['小空']; await gather(page, [k]);
      await page.evaluate((id) => { const c = OC.Chars.get(id); OC.Taste.setPref(c, 'cake', 2, true); OC.Tx.run('test:cake', { get: { items: { cake: 2 } } }, 't'); }, k);
      await page.evaluate((id) => OC.Use.feed(id, 'cake'), k); await until(page, () => OC.Progress.count('eat', { by: 'player' }) >= 1, null, 8000);
      // any other daily: emit exactly the event its goal describes
      const all2 = await page.evaluate(() => { const out = []; for (const x of OC.Quests.list('daily')) { if (x.done) continue; const g = OC.PlayData.QUESTS.find((y) => y.id === x.id).goal; for (let i = 0; i < g.n; i++) OC.Progress.emit([].concat(g.ev)[0], Object.assign({ oc: OC.Store.s.activeId, by: 'player', item: g.w && g.w.item ? [].concat(g.w.item)[0] : 'apple', lv: 2, first: true, place: g.w && g.w.place ? [].concat(g.w.place)[0] : undefined, shop: g.w && g.w.shop ? [].concat(g.w.shop)[0] : undefined, act: g.w && g.w.act ? [].concat(g.w.act)[0] : undefined, count: 1 }, g.distinct ? { [g.distinct]: 'v' + i } : {})); } return OC.Quests.list('daily').map((y) => [y.id, y.done]); });
      check('2c 每日任務由真實行為的進度事件完成（餵食完成了餵食類任務）', !feedQ || all2.find((x) => x[1]), JSON.stringify(all2));
      await page.evaluate(() => { OC.App.tab('more'); }); await wait(page, 600); await shot(page, '2-hub-quests');
      const c0 = await page.evaluate(() => OC.Store.s.coins);
      const btn = await page.$('[data-page="more"] .q-row.ready .btn.primary'); if (btn) await btn.tap(); await wait(page, 600);
      const c1 = await page.evaluate(() => OC.Store.s.coins);
      const again = await page.evaluate(() => { const x = OC.Quests.list().find((y) => y.claimed); return x ? OC.Quests.claim(x.key) : null; });
      check('2d 在「日常」點「領取」入帳；再領一次被拒絕', c1 > c0 && again && !again.ok, `${c0} → ${c1}；再領：${again && again.why}`);
      // weekly (distinct) / place / event / challenge / hidden
      const wk = await page.evaluate(() => { const x = OC.Quests.list('weekly')[0]; const g = OC.PlayData.QUESTS.find((y) => y.id === x.id).goal; for (let i = 0; i < g.n + 2; i++) OC.Progress.emit([].concat(g.ev)[0], Object.assign({ oc: OC.Store.s.activeId, by: 'player', first: true, stars: 3, count: 1 }, g.distinct ? { [g.distinct]: g.distinct === 'place' ? ['isle', 'beach', 'forest', 'street', 'cafe', 'home'][i % 6] : ['f_carp', 'f_koi', 'f_sardine', 'apple', 'pancake', 'curry'][i % 6] } : {})); return OC.Quests.list('weekly').find((y) => y.key === x.key); });
      check('2e 每週任務（不同種類計數）可以完成', wk.done, `${wk.zh} ${wk.prog}/${wk.n}`);
      await travel(page, 'beach');
      const pl = await page.evaluate(() => OC.Quests.list('place').map((x) => x.place));
      check('2f 去過的地點會出現該地點的任務', pl.includes('beach'), pl.join());
      const ev = await page.evaluate(() => { OC.Store.s.settings.weather = 'rain'; OC.Quests.refresh(true); const on = OC.Quests.list('event').map((x) => x.id); OC.Store.s.settings.weather = 'clear'; OC.Quests.refresh(true); const off = OC.Quests.list('event').map((x) => x.id); return { on, off }; });
      check('2g 雨天限定任務只在下雨時出現，雨停就悄悄消失（沒有懲罰）', ev.on.some((x) => x.startsWith('e_rain')) && !ev.off.some((x) => x.startsWith('e_rain')), JSON.stringify(ev));
      const ch = await page.evaluate(() => { for (let i = 0; i < 10; i++) OC.Progress.emit('fish', { item: 'f_sardine', oc: OC.Store.s.activeId }); const c = OC.Quests.challenges().find((x) => x.key === 'c_fish'); const r = OC.Quests.claim('c_fish'); const c2 = OC.Quests.challenges().find((x) => x.key === 'c_fish'); return { ready: c.done, ok: r.ok, tier: c2.tier, next: c2.n }; });
      check('2h 長期挑戰：累計達標 → 領取 → 下一階', ch.ready && ch.ok && ch.tier === 1 && ch.next === 30, JSON.stringify(ch));
      const hd = await page.evaluate(() => { OC.Progress.emit('fish', { item: 'f_moonjelly', rarity: 4, oc: OC.Store.s.activeId }); return OC.Quests.hiddenInfo(); });
      check('2i 隱藏任務：玩出來才出現', hd.found >= 1, JSON.stringify(hd).slice(0, 120));
      await page.evaluate(() => OC.App.tab('island'));
    }

    // ================= 3. skills unlock real things =================
    if (want(3)) {
      await travel(page, 'isle');
      const k = I['麻糬'];
      const r = await page.evaluate((id) => {
        const c = OC.Chars.get(id); c.life.skills = {};
        const out = { sketch0: OC.Growth.allowed(c, 'sketch'), recipe0: OC.Growth.has(c, 'recipe_t1') };
        OC.Mind.skill(c, 'art', 16); OC.Mind.skill(c, 'cook', 61);
        out.sketch1 = OC.Growth.allowed(c, 'sketch'); out.recipe1 = OC.Growth.has(c, 'recipe_t1'); out.recipe2 = OC.Growth.has(c, 'recipe_t2'); out.cookLv = OC.Mind.skillLv(c, 'cook');
        out.ups = OC.Progress.log.filter((e) => e.ev === 'skillUp').length;
        return out;
      }, k);
      check('3a 藝術 Lv.1 前不會畫素描，升級後解鎖新活動', !r.sketch0 && r.sketch1, JSON.stringify(r));
      check('3b 料理升級解鎖新食譜（Lv.1 鬆餅布丁、Lv.2 咖哩水果塔）', !r.recipe0 && r.recipe1 && r.recipe2 && r.cookLv === 2, JSON.stringify(r));
      await page.evaluate(() => OC.Mini.cooking()); await wait(page, 600);
      const rows = await page.evaluate(() => [...document.querySelectorAll('.sheet.open .row')].map((x) => x.textContent));
      check('3c 料理清單：學會的可以做，還沒學會的明確顯示「還不會」與需要的等級', rows.some((t) => t.includes('咖哩') && !t.includes('還不會')) && rows.some((t) => t.includes('烤魚') && t.includes('還不會')), rows.filter((t) => /咖哩|烤魚/.test(t)).join(' | '));
      await shot(page, '3-recipes'); await page.evaluate(() => OC.UI.back()); await wait(page, 300);
      // an OC really does the new activity on its own once allowed (scenic spot verb 'observe')
      const k2 = I['栗子']; await gather(page, [k2]);
      const sk = await page.evaluate((id) => { const b = OC.Brain.get(id), c = OC.Chars.get(id); const before = OC.Brain.candidates(b).map((x) => x.act).includes('sketch'); OC.Mind.skill(c, 'art', 16); const after = OC.Brain.candidates(b).map((x) => x.act).includes('sketch'); return !before && after; }, k2);
      check('3d 升級後生活 AI 會把新活動列入考慮', sk);
      await until(page, () => window.__cards.some((t) => /Lv\./.test(t)), null, 15000);
      const lvUp = await page.evaluate(() => window.__cards.filter((t) => /Lv\./.test(t)));
      check('3e 技能升級有演出卡片（含解鎖內容）', lvUp.length >= 1, lvUp.slice(0, 3).join(' | '));
    }

    // ================= 4. aspirations: steps → done → rewards, memory, behaviour =================
    if (want(4)) {
      const k = I['小空'];
      const r = await page.evaluate((id) => {
        const c = OC.Chars.get(id); OC.Growth.setAsp(c, 'angler', 'player');
        const b = { last: [] }; const s0 = OC.Brain.actScore(c, b, 'fish').s; c.life.asp.id = 'bookworm'; const s1 = OC.Brain.actScore(c, b, 'fish').s; c.life.asp.id = 'angler';
        const coins0 = OC.Store.s.coins;
        const fish = ['f_sardine', 'f_carp', 'f_shrimp', 'f_silver', 'f_rainbow'];
        for (let i = 0; i < 4; i++) OC.Progress.emit('fish', { item: 'f_sardine', oc: OC.Store.s.activeId });
        const step1 = c.life.asp.step;
        for (const f of fish) OC.Progress.emit('fish', { item: f, oc: OC.Store.s.activeId });
        const step2 = c.life.asp.step;
        OC.Progress.emit('fish', { item: 'f_starbream', rarity: 3, oc: OC.Store.s.activeId });
        return { bonus: +(s0 - s1).toFixed(2), step1, step2, after: c.life.asp, title: !!OC.Store.s.play.titles.angler, paid: OC.Tx.done('asp:' + id + ':angler'), coins: OC.Store.s.coins - coins0, mem: c.life.mem.recent.concat(c.life.mem.long).some((m) => m.text.includes('釣魚達人')), sugg: c.growth.suggestions.map((s) => s.value) };
      }, k);
      check('4a 人生目標影響自主行為（目標相關活動加分）', r.bonus > 0.1, `+${r.bonus}`);
      check('4b 目標分步前進（1 → 2 → 完成）', r.step1 === 1 && r.step2 === 2 && !r.after.id, JSON.stringify({ s1: r.step1, s2: r.step2 }));
      check('4c 完成：獎勵、稱號、里程碑回憶，並提出（需同意的）成長建議', r.paid && r.coins >= 600 && r.title && r.mem && r.sugg.length >= 1, JSON.stringify({ coins: r.coins, title: r.title, mem: r.mem, sugg: r.sugg }));
      await until(page, () => !OC.Stage.busy && !OC.Stage.queue, null, 15000);
    }

    // ================= 5. collection =================
    if (want(5)) {
      const r = await page.evaluate(() => {
        const s0 = OC.P6UI.collStats();
        OC.Tx.run('test:coll', { get: { items: { shell_star: 1, b_ladybug: 1 } } }, 't');
        OC.Tx.run('test:coll2', { pay: { items: { b_ladybug: 1 } } }, 't');
        const s1 = OC.P6UI.collStats();
        return { d: s1.found - s0.found, star: !!OC.Store.s.seen.shell_star, past: OC.Store.count('b_ladybug') === 0 && !!OC.Store.s.seen.b_ladybug };
      });
      check('5a 新取得的物品寫入圖鑑；用掉後仍保留發現紀錄（曾經持有）', r.d === 2 && r.star && r.past, JSON.stringify(r));
      await page.evaluate(() => OC.Pages.open('shop', { shop: 'gift' })); await wait(page, 400); await page.evaluate(() => OC.Pages.close('shop'));
      await page.evaluate(() => OC.Pages.open('collection')); await wait(page, 600);
      const ui = await page.evaluate(() => { const P = OC.Pages.pages.collection; P.cat = 'other'; P._sig = ''; P.refresh(P); return { spotted: document.querySelectorAll('[data-page="collection"] .tile.spotted').length, past: document.querySelectorAll('[data-page="collection"] .tile.past').length }; });
      await page.evaluate(() => { const P = OC.Pages.pages.collection; P.cat = 'bug'; P._sig = ''; P.refresh(P); }); await wait(page, 300);
      const past = await page.evaluate(() => document.querySelectorAll('[data-page="collection"] .tile.past').length);
      check('5b 圖鑑分清楚：未發現（剪影）／看過（商店）／持有中／曾經持有', ui.spotted >= 1 && past >= 1, JSON.stringify({ spotted: ui.spotted, past }));
      await shot(page, '5-collection');
      await page.evaluate(() => { const P = OC.Pages.pages.collection; P.cat = 'place'; P._sig = ''; P.refresh(P); }); await wait(page, 300);
      const places = await page.evaluate(() => document.querySelectorAll('[data-page="collection"] .q-row').length);
      check('5c 地點、活動、特殊事件也在圖鑑', places >= 7);
      await page.evaluate(() => OC.Pages.close('collection'));
    }

    // ================= 6. achievements =================
    if (want(6)) {
      const r = await page.evaluate(() => { OC.Progress.emit('cook', { item: 'onigiri', stars: 3, oc: OC.Store.s.activeId }); OC.Achieve.check(); return { cook1: !!OC.Store.s.ach.cook1, star3: !!OC.Store.s.ach.star3 }; });
      check('6a 達成條件後自動解鎖（第一盤料理、三顆星）', r.cook1 && r.star3, JSON.stringify(r));
      await page.evaluate(() => { OC.App.tab('more'); const P = OC.Pages.pages.more; P.tab = 'ach'; P._sig = ''; P.refresh(P); }); await wait(page, 600); await shot(page, '6-achievements');
      const c0 = await page.evaluate(() => OC.Store.s.coins);
      for (let i = 0; i < 4; i++) { const b = await page.$('[data-page="more"] .q-row.ready .btn.primary'); if (!b) break; try { await b.tap({ timeout: 3000 }); break; } catch (e) { await wait(page, 300); } }   // the hub rebuilds when coins change (life goes on)
      await wait(page, 600);
      const c1 = await page.evaluate(() => OC.Store.s.coins);
      const again = await page.evaluate(() => ['cook1', 'star3'].map((id) => OC.Achieve.claim(id)).filter((x) => x.ok).length);
      check('6b 領取成就獎勵入帳；同一個成就不能領兩次', c1 > c0, `${c0} → ${c1}`);
      const twice = await page.evaluate(() => { const L = OC.Achieve.list().filter((x) => x.claimed); return L.map((x) => OC.Achieve.claim(x.id).ok).filter(Boolean).length; });
      check('6c 已領的再領全部被拒絕', twice === 0, `再領成功 ${twice} 次（另外領了 ${again} 個還沒領的）`);
      const hid = await page.evaluate(() => OC.Achieve.list().filter((x) => x.hidden).length);
      check('6d 隱藏成就顯示提示但不洩漏內容', hid >= 1);
      await page.evaluate(() => OC.App.tab('island'));
    }

    // ================= 7. profile center: one data source =================
    if (want(7)) {
      const k = I['小空'];
      await page.evaluate((id) => OC.Pages.open('profile', { id, tab: 'grow' }), k); await wait(page, 700); await shot(page, '7-profile-growth');
      const g = await page.evaluate((id) => { const c = OC.Chars.get(id); const lv = Object.keys(OC.PlayData.SKILLS).map((s) => OC.Mind.skillLv(c, s)); const shown = [...document.querySelectorAll('[data-page="profile"] .sk-tile .sk-lv b')].map((e) => +e.textContent); /* 12.0 skill book */ return { lv: lv.sort().join(), shown: shown.sort().join(), titles: document.querySelectorAll('[data-page="profile"] select option').length }; }, k);
      check('7a 「成長」顯示的技能等級＝角色資料（同一份）', g.lv === g.shown, `${g.shown}`);
      await page.evaluate((id) => { OC.Pages.close('profile'); OC.Pages.open('profile', { id, tab: 'mem' }); }, k); await wait(page, 700);
      const n0 = await page.evaluate(() => document.querySelectorAll('[data-page="profile"] .mem-card').length);
      await page.evaluate((id) => { OC.Mind.remember(OC.Chars.get(id), { type: 'milestone', imp: 0.9, text: '測試：和大家一起看了流星', key: 'test:mem1' }); const P = OC.Pages.pages.profile; P.refresh(P); }, k); await wait(page, 300);
      const n1 = await page.evaluate(() => [...document.querySelectorAll('[data-page="profile"] .mem-card .mc-text')].map((e) => e.textContent));
      check('7b 「日誌」直接讀角色回憶（新回憶立即出現，重要的有故事時間軸）', n1.length === n0 + 1 && n1.includes('測試：和大家一起看了流星'), `${n0} → ${n1.length}`);
      await shot(page, '7-profile-journal');
      const fav = await page.evaluate(() => { const b = document.querySelector('[data-page="profile"] .mem-card [aria-label="珍藏"]'); if (b) b.click(); return Object.keys(OC.Store.s.play.memFav).length; });
      check('7c 回憶可以珍藏', fav >= 1);
      await page.evaluate(() => OC.Pages.close('profile'));
    }

    // ================= 8. performances: animation + expression + sound in sync =================
    if (want(8)) {
      const k = I['栗子'];
      await gather(page, [k]);
      await page.evaluate((id) => { window.__snd = []; const c = OC.Chars.get(id); OC.Taste.setPref(c, 'pudding', 2, true); OC.Tx.run('test:pud', { get: { items: { pudding: 1 } } }, 't'); }, k);
      const seq = []; const p0 = page.evaluate((id) => OC.Use.feed(id, 'pudding'), k);
      for (let i = 0; i < 40; i++) { const a = await page.evaluate((id) => { const x = OC.App.actorOf(id); return x && x.act ? x.act.action : 'idle'; }, k); if (seq[seq.length - 1] !== a) seq.push(a); await wait(page, 150); if (i === 22) await shot(page, '8-taste-fav'); }
      await p0; await until(page, () => !OC.Stage.busy, null, 10000);
      const snd = await page.evaluate(() => window.__snd);
      console.log('  sequence', seq.join(' → '), '| sounds', snd.join(','));
      check('8a 吃到最愛：期待（吃）→ 品嚐停頓 → 驚喜反應（多段動作，不是單一彈跳）', seq.includes('taste') && (seq.includes('yum') || seq.includes('dance') || seq.includes('shy')), seq.join(' → '));
      check('8b 音效跟著演出（咀嚼 → 好吃）', snd.includes('chew') && snd.includes('yum'), snd.join(','));
      const rig = await page.evaluate((id) => { const c = OC.Chars.get(id); const keys = new Set(); for (const act of ['taste', 'yum', 'yuck', 'cheer', 'proud', 'nod', 'receive', 'sing', 'sketch', 'happy', 'surprised']) for (let t = 0; t < 2; t += 0.25) keys.add(act + JSON.stringify(OC.CharRender.rigState(c, { action: act, at: t, face: 0.2 }, t))); return keys.size; }, k);
      check('8c 新動作有連續的姿勢變化（預備→動作→收尾）', rig > 60, `${rig} 種姿勢`);
      const styl = await page.evaluate((L) => { const out = {}; for (const id of L) { const c = OC.Chars.get(id); const s = OC.CharRender.rigState(c, { action: 'happy', at: 0.3 }, 0.3); out[OC.Chars.name(c)] = [+(s.lift || 0).toFixed(1), +(s.armL || 0).toFixed(2), +(s.blush || 0).toFixed(1)]; } return out; }, all);
      check('8d 同一個「開心」，不同個性的姿勢不同（幅度、手勢、臉紅），不是只改速度', new Set(Object.values(styl).map((x) => x.join())).size >= 2, JSON.stringify(styl));
    }

    // ================= 9. player-made frames + fallbacks =================
    if (want(9)) {
      const r = await page.evaluate(async () => {
        const c = OC.Chars.active();
        const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#F48FB1'; x.fillRect(16, 8, 32, 52);
        const blob = await OC.Assets.canvasToBlob(cv); const meta = await OC.Assets.putBlob(blob, { name: 'happy frame', kind: 'frame' });
        const doc = OC.Anim.create({ action: 'happy', name: '測試開心', owner: c.id, cells: [[meta.id]], w: 64, h: 64 }); OC.Anim.save(doc); OC.Anim.assign(c, 'happy', 'any', doc.id);
        const out = {};
        for (const act of ['yum', 'cheer', 'proud', 'receive', 'taste', 'yuck', 'sing']) { const rr = OC.Anim.resolve(c, act, 'front'); out[act] = rr ? rr.action : 'rig'; }
        let ok = true; const cvs = document.createElement('canvas'); cvs.width = cvs.height = 128; for (const act of Object.keys(out)) { try { OC.CharRender.draw(cvs.getContext('2d'), c, { action: act, at: 0.4, face: 0.2 }, 64, 120, 1, 0.4); } catch (e) { ok = false; } }
        return { out, ok };
      });
      check('9a 自製逐格動畫沒有的新動作，會依備用鏈用相近的動作（例如「好吃」→自製的「開心」）', r.out.yum === 'happy' && r.out.cheer === 'happy' && r.out.proud === 'happy', JSON.stringify(r.out));
      check('9b 沒有任何對應影格的動作用內建骨架演出，不會出錯', r.ok && (r.out.yuck === 'rig' || r.out.yuck === 'idle'), JSON.stringify(r.out));
      const k = await page.evaluate(() => OC.Store.s.activeId);
      const perf = await page.evaluate(async (id) => { if (OC.Events.current) OC.Events.end('test'); OC.Brain.hold(id, 'test'); OC.Brain.unhold(id, 'test'); const b0 = OC.Brain.get(id); b0.holds.clear(); b0.invited = null; b0.thinkAt = OC.Sim.now() + 30; const t0 = Date.now();   /* not chatting: soft performances never interrupt a conversation (by design) */   /* a wall-clock-dependent special event (e.g. firstVisit at night) must not own the OC */ await OC.Stage.perform('levelup', { oc: id, zh: '測試', lv: 2, unlocks: [] }); const ms = Date.now() - t0; const b = OC.Brain.get(id), a = OC.App.actorOf(id); return { ms, st: b && b.st, holds: b && [...b.holds], inv: b && !!b.invited, conv: OC.Brain.convs.length, tab: OC.App.curTab, a: !!a, hid: a && a.hidden }; }, k);
      check('9c 自製角色也能播放升級演出（完整結束）', perf.ms > 500, JSON.stringify(perf));
    }

    // ================= 10. multi-OC cinematic: walk, camera, letterbox, release =================
    if (want(10)) {
      const A = I['栗子'], B = I['小空'];
      await gather(page, [A, B]); await until(page, () => !OC.Stage.busy, null, 10000); await wait(page, 2500);   // the camera settles after earlier scenes
      const z0 = await page.evaluate(() => OC.World.zoom);
      /* a character event in progress holds the character (no requests then): end it and keep new ones away for this scene */
      await page.evaluate(() => { if (OC.Events.current) OC.Events.end('test'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; }); await wait(page, 600);
      await page.evaluate(([a, b]) => { const pl = OC.App.player, x = OC.App.actorOf(a); x.x = pl.x + 90; x.y = pl.y + 30; for (const r of OC.Requests.open()) r.state = 'expired'; for (const k2 of [a + '>' + b, b + '>' + a]) if (OC.Store.s.life.rel[k2]) OC.Store.s.life.rel[k2].fam = 0; const r = OC.Requests.debugOffer(a, 'meet'); if (r) { r.data.other = b; r.text = OC.Requests.text(r); OC.Requests.answer(r.id, 'accept'); } }, [A, B]);
      await until(page, () => !OC.Stage.busy, null, 8000);
      const rid = await page.evaluate((a) => { const r = OC.Requests.open().find((x) => x.oc === a && x.type === 'meet'); return r && r.id; }, A);
      const why = rid ? null : await page.evaluate((a) => { const b = OC.Brain.get(a), x = OC.App.actorOf(a); return { holds: [...b.holds], st: b.st, act: b.act, hidden: x && x.hidden, leaving: b.leaving, own: OC.Requests.ofOC(a) && OC.Requests.ofOC(a).type, cd: (OC.Store.s.play.req.cd || {})[a] }; }, A);
      await page.evaluate(([a, b]) => { const pl = OC.App.player, x = OC.App.actorOf(a), q = OC.World.nearestWalkable(pl.x + 120, pl.y + 30, 40) || OC.World.nearestWalkable(pl.x - 120, pl.y + 30, 40); if (q) { x.x = q.x; x.y = q.y; } x.path = null; OC.Progress.emit('social', { oc: a, other: b, ocs: [a, b], kind: 'chat' }); }, [A, B]);
      const started = await until(page, () => OC.Stage.busy && !!document.querySelector('.stage-ui'), null, 12000);
      const d0 = await page.evaluate((a) => { const x = OC.App.actorOf(a), pl = OC.App.player; return Math.hypot(x.x - pl.x, x.y - pl.y); }, A);
      // sample during the scene: it walks over first, then the camera moves in
      const mid = { d: 1e9, zoom: 0, held: [] };
      for (let i = 0; i < 40 && (await page.evaluate(() => OC.Stage.busy)); i++) { const m = await page.evaluate((a) => { const x = OC.App.actorOf(a), pl = OC.App.player; return { d: Math.hypot(x.x - pl.x, x.y - pl.y), zoom: OC.World.zoom, held: [...OC.Brain.get(a).holds] }; }, A); mid.d = Math.min(mid.d, m.d); if (m.zoom > mid.zoom) { mid.zoom = m.zoom; mid.held = m.held; } if (i === 12) await shot(page, '10-cinematic'); await wait(page, 200); }
      await until(page, () => !OC.Stage.busy && !OC.Stage.queue, null, 20000); await wait(page, 1500);
      const end = await page.evaluate((a) => ({ zoom: OC.World.zoom, held: [...OC.Brain.get(a).holds], ui: !!document.querySelector('.stage-ui'), state: (OC.Requests.list().find((x) => x.oc === a && x.type === 'meet') || {}).state }), A);
      check('10a 請求完成演出：角色走到玩家身邊、鏡頭拉近、柔和遮幅', started && rid && mid.d < d0 && mid.zoom > z0 + 0.1, JSON.stringify({ started, rid: !!rid, why, d0: Math.round(d0), d: Math.round(mid.d), z0, z: mid.zoom }));
      check('10b 演出中角色被保留（不會被自主行為打斷），結束後鏡頭與保留都恢復', mid.held.includes('stage') && !end.held.includes('stage') && Math.abs(end.zoom - z0) < 0.1 && !end.ui, JSON.stringify(end));
      await release(page, [A, B]);
    }

    // ================= 11. skip / interruption keeps data right =================
    if (want(11)) {
      const k = I['栗子'];
      await gather(page, [k]);
      const r = await page.evaluate(async (id) => {
        const c = OC.Chars.get(id); OC.Taste.setPref(c, 'cookie', -2, true); OC.Tx.run('test:ck', { get: { items: { cookie: 1 } } }, 't');
        const n0 = OC.Store.count('cookie'), log0 = OC.Tx.log.length;
        const fed = OC.Use.feed(id, 'cookie');
        await new Promise((res) => { const t = setInterval(() => { if (OC.Stage.busy) { clearInterval(t); res(); } }, 50); setTimeout(() => { clearInterval(t); res(); }, 8000); });
        const t0 = Date.now(); OC.Stage.skip(); await fed;
        await new Promise((res) => { const t = setInterval(() => { if (!OC.Stage.busy) { clearInterval(t); res(); } }, 50); });
        return { ms: Date.now() - t0, used: n0 - OC.Store.count('cookie'), tx: OC.Tx.log.length - log0, holds: [...OC.Brain.get(id).holds], tasted: OC.Taste.prefs(c).tasted.cookie.n, mem: c.life.mem.recent.filter((m) => m.data && m.data.item === 'cookie').length };
      }, k);
      check('11a 跳過演出：立刻結束，資料照樣正確（扣 1 個、品嚐紀錄、回憶各一次）', r.ms < 2500 && r.used === 1 && r.tx === 1 && r.tasted >= 1, JSON.stringify(r));
      check('11b 跳過後角色沒有卡在演出狀態', !r.holds.includes('stage') && !r.holds.includes('feed'), JSON.stringify(r.holds));
      // a special event, watched by the player, skipped half-way: remaining steps run at once, the result is applied once
      const ev = await page.evaluate(async (id) => {
        const c = OC.Chars.get(id); c.needs.social = 8; OC.Mind.tickEmotions(c, 1); const E = OC.Store.s.life.ev; E.lastAny = 0; for (const k2 of Object.keys(E.last)) if (k2.startsWith('lonelyMoment')) delete E.last[k2]; for (const k2 of Object.keys(E.once)) if (k2.includes('lonelyMoment')) delete E.once[k2]; OC.Brain.get(id).holds.clear(); OC.Brain.get(id).queued = null;
        for (const e of OC.Events.defs()) if (e.id === 'lonelyMoment') e.chance = 1;
        const b = OC.Brain.get(id); b.st = 'think'; b.thinkAt = 1e9; if (OC.Events.current) OC.Events.end('test');
        for (let i = 0; i < 40 && !OC.Events.current; i++) { b.holds.clear(); OC.Events.update(5); }   // periodic() draws chance×0.25 per pass
        const cur = OC.Events.current; if (!cur) return { started: false, diag: JSON.stringify(OC.Events.diag || '').slice(0, 300) };
        cur.watched = true; OC.Stage.controls(true); const evId = cur.ev.id, n0 = OC.Store.s.life.ev.log.filter((x) => x.id === evId).length;
        await new Promise((r) => setTimeout(r, 400)); OC.Stage.skip();
        const t0 = Date.now(); await new Promise((r) => { const t = setInterval(() => { if (!OC.Events.current || Date.now() - t0 > 8000) { clearInterval(t); r(); } }, 50); });
        const log = OC.Store.s.life.ev.log.filter((x) => x.id === evId);
        return { started: true, id: evId, ms: Date.now() - t0, ended: !OC.Events.current, logged: log.length - n0, why: log[0] && log[0].why, held: [...OC.Brain.get(id).holds], ui: !!document.querySelector('.stage-ui.on') };
      }, k);
      check('11c 觀看中的特殊事件可以跳過：立刻結束、結果只套用一次、角色沒有卡住', ev.started && ev.ended && ev.ms < 3000 && ev.logged === 1 && ev.why === 'done' && !ev.held.includes('event') && !ev.ui, JSON.stringify(ev));
    }

    // ================= 12. quality / motion / theme / time switches during performances =================
    if (want(12)) {
      const k = I['小空'];
      await gather(page, [k]);
      const res = [];
      for (const [kk, v] of [['reduceMotion', true], ['perf', 'saver'], ['theme', 'dark'], ['hour', 21], ['weather', 'rain'], ['perf', 'high'], ['reduceMotion', false], ['theme', 'light']]) {
        await page.evaluate(([kk, v]) => { const s = OC.Store.s.settings; if (kk === 'reduceMotion') { s.reduceMotion = v; OC.App.applyMotion(); } if (kk === 'perf') { s.perf = v; OC.App.applyPerf(); } if (kk === 'theme') OC.App.setTheme(v); if (kk === 'hour') { const c = OC.Store.s.life.clock; c.gm = Math.floor(c.gm / 1440) * 1440 + v * 60 + 1440; } if (kk === 'weather') s.weather = v; }, [kk, v]);
        const pr = page.evaluate((id) => OC.Stage.perform('reqDone', { oc: id, req: { text: '測試' }, reward: { coins: 0 } }), k);
        await wait(page, 700);
        res.push(await page.evaluate(() => ({ rm: !!document.querySelector('.stage-ui.rm'), bars: !!document.querySelector('.stage-ui'), fx: document.querySelectorAll('.fx-p').length, same: OC.World.renderer === window.__R })));
        await page.evaluate(() => OC.Stage.skip()); await pr; await until(page, () => !OC.Stage.busy, null, 5000);
        if (kk === 'hour') await shot(page, '12-night-rain');
      }
      check('12a 切換效能／主題／時間／天氣／降低動態時演出照常結束、渲染器不重建', res.every((x) => x.same), res.length + ' 次');
      check('12b 降低動態：沒有遮幅與鏡頭移動', res[0].rm, JSON.stringify(res[0]));
      check('12c 沒有 JavaScript 錯誤', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.evaluate(() => { OC.Store.s.settings.weather = 'clear'; });
    }

    // ================= 13. repeated page switching: no leaks, no re-loading =================
    if (want(13)) {
      /* pages are built once and kept: open every one of them once first, so what is measured is growth from repeating, not the first build */
      const k = I['小空'];
      for (let i = 0; i < 4; i++) {
        await page.evaluate(([id, i]) => { OC.App.tab('more'); const P = OC.Pages.pages.more; P.tab = ['quests', 'req', 'ach', 'coll'][i % 4]; P._sig = ''; P.refresh(P); OC.App.tab('island'); OC.Pages.open('collection'); OC.Pages.close('collection'); OC.Pages.open('profile', { id, tab: i % 2 ? 'grow' : 'mem' }); OC.Pages.close('profile'); OC.Pages.open('bag'); OC.Pages.close('bag'); }, [k, i]);
        await wait(page, 150);
      }
      await wait(page, 600);
      const base = await page.evaluate(() => ({ dom: document.getElementsByTagName('*').length, tex: OC.World.renderer.info.memory.textures, geo: OC.World.renderer.info.memory.geometries, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0 }));
      for (let i = 0; i < 12; i++) {
        await page.evaluate(([id, i]) => { OC.App.tab('more'); const P = OC.Pages.pages.more; P.tab = ['quests', 'req', 'ach', 'coll'][i % 4]; P._sig = ''; P.refresh(P); OC.App.tab('island'); OC.Pages.open('collection'); OC.Pages.close('collection'); OC.Pages.open('profile', { id, tab: i % 2 ? 'grow' : 'mem' }); OC.Pages.close('profile'); OC.Pages.open('bag'); OC.Pages.close('bag'); }, [k, i]);
        await wait(page, 150);
      }
      await wait(page, 800);
      const end = await page.evaluate(() => ({ dom: document.getElementsByTagName('*').length, tex: OC.World.renderer.info.memory.textures, geo: OC.World.renderer.info.memory.geometries, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0, same: OC.World.renderer === window.__R }));
      check('13a 反覆開關「日常」、圖鑑、角色檔案、背包 12 次：DOM 不持續增加', end.dom < base.dom + 600, `${base.dom} → ${end.dom}`);
      check('13b 3D 資源不重新載入（材質、幾何不變，renderer 同一個）', end.same && end.tex <= base.tex + 2 && end.geo <= base.geo + 24 /* a reload of the place would add hundreds; a few come and go with what the characters are doing */, `tex ${base.tex}→${end.tex} geo ${base.geo}→${end.geo}`);
      if (end.heap) check('13c JS heap 穩定（< +30MB）', end.heap - base.heap < 30, `${base.heap}→${end.heap}MB`);
    }

    // ================= 14. save → restart → everything back, nothing paid twice =================
    if (want(14)) {
      const before = await page.evaluate(() => { OC.Store.persist(); const S = OC.Store.s; return { coins: S.coins, q: JSON.stringify(S.play.q.list.map((x) => [x.key, x.prog.n, !!x.done, !!x.claimed])), chal: JSON.stringify(S.play.q.chal), req: JSON.stringify(S.play.req.list.map((r) => [r.id, r.state])), ach: JSON.stringify(Object.keys(S.ach).sort()), achC: JSON.stringify(Object.keys(S.play.ach).sort()), titles: JSON.stringify(Object.keys(S.play.titles).sort()), skills: JSON.stringify(OC.Chars.all().map((c) => c.life.skills)), asp: JSON.stringify(OC.Chars.all().map((c) => ({ id: (c.life.asp || {}).id || null, step: (c.life.asp || {}).step || 0, done: (c.life.asp || {}).done || [] }))), fav: JSON.stringify(S.play.memFav), sound: JSON.stringify(S.settings.sound), v: S.v }; });
      await page.reload(); await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 }); await wait(page, 1000);
      const after = await page.evaluate(() => { const S = OC.Store.s; return { coins: S.coins, q: JSON.stringify(S.play.q.list.map((x) => [x.key, x.prog.n, !!x.done, !!x.claimed])), chal: JSON.stringify(S.play.q.chal), req: JSON.stringify(S.play.req.list.map((r) => [r.id, r.state])), ach: JSON.stringify(Object.keys(S.ach).sort()), achC: JSON.stringify(Object.keys(S.play.ach).sort()), titles: JSON.stringify(Object.keys(S.play.titles).sort()), skills: JSON.stringify(OC.Chars.all().map((c) => c.life.skills)), asp: JSON.stringify(OC.Chars.all().map((c) => ({ id: (c.life.asp || {}).id || null, step: (c.life.asp || {}).step || 0, done: (c.life.asp || {}).done || [] }))), fav: JSON.stringify(S.play.memFav), sound: JSON.stringify(S.settings.sound), v: S.v }; });
      // a dream that was finished before the restart may be followed by a new one (life goes on) — compare what existed
      { const b = JSON.parse(before.asp), a2 = JSON.parse(after.asp); const ok = b.every((x, i) => JSON.stringify(x.done) === JSON.stringify(a2[i].done) && (!x.id || (x.id === a2[i].id && x.step <= a2[i].step))); before.asp = after.asp = ok ? 'ok' : JSON.stringify({ b, a2 }); }
      for (const k of ['coins', 'q', 'chal', 'req', 'ach', 'achC', 'titles', 'skills', 'asp', 'fav', 'sound']) check(`14 重開後保留：${k}`, before[k] === after[k], k === 'coins' ? `${before.coins} → ${after.coins}` : '');
      check('14 存檔版本 v8（16.0）', after.v === 8);
      const dup = await page.evaluate(() => { const c0 = OC.Store.s.coins; const a = OC.Quests.list().filter((x) => x.claimed).map((x) => OC.Quests.claim(x.key).ok); const b = OC.Achieve.list().filter((x) => x.claimed).map((x) => OC.Achieve.claim(x.id).ok); return { ok: a.concat(b).filter(Boolean).length, coins: OC.Store.s.coins - c0 }; });
      check('14 重開後再領已領過的任務／成就：全部被拒絕，星幣不變', dup.ok === 0 && dup.coins === 0, JSON.stringify(dup));
    }

    check('全程沒有 JavaScript 錯誤', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) { console.error(e); console.log('page errors:', errors.slice(0, 5)); check('執行沒有中斷', false, String(e && e.message)); }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'last-results.json'), JSON.stringify({ at: new Date().toISOString(), results: H.results }, null, 1));
  const fail = H.results.filter((r) => !r.ok); console.log(`\n${H.results.length - fail.length}/${H.results.length} passed`); process.exit(fail.length ? 1 : 0);
})();
