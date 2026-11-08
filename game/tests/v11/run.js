/* OC Shimeji 11.0 acceptance (Playwright, real pointer events). node game/tests/v11/run.js [1 2 …]   (http.server on :8765; ~6 min)
 *   1 stroking: a slide over the body is petting (continuous level, body parts, taste, annoyance), not a pick-up or a menu
 *   2 closeness ring + gestures (hug · high-five · poke · hand-hold) release their OC and change real data once
 *   3 animation library: every action renders (no NaN), has a fallback chain, touch layer for every zone
 */
const path = require('path');
const H = require('../life/harness.js');
const want = (n) => process.argv.length <= 2 || process.argv.slice(2).includes(String(n));
const { check, wait } = H;
(async () => {
  const { browser, page, errors } = await H.launch();
  try {
    await H.boot(page, { chars: 3, seed: 8 });
    await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 10; S.life.settings.autonomy = 'restricted'; if (OC.Events.current) OC.Events.end('t'); });
    await wait(page, 800);
    const geo = () => page.evaluate(() => { const a = OC.App.player, W = OC.World, lv = a.lvl || 0, gy = a.gy - lv * W.HY, f = W.project(a.x, a.y, lv, gy), h = W.project(a.x, a.y, lv, gy + 62); return { cx: f.x, feet: f.y, h: f.y - h.y }; });
    const taste = () => page.evaluate(() => OC.Touch.taste(OC.Chars.active()));
    const st = () => page.evaluate(() => ({ touch: OC.App.player.touch && { lv: OC.App.player.touch.lv, zone: OC.App.player.touch.zone, annoyed: OC.App.player.touch.annoyed }, petting: !!OC.Touch.petting, holds: [...OC.Brain.get(OC.Store.s.activeId).holds], menu: !!document.querySelector('.radial'), lift: OC.App.player.lift, aff: OC.Chars.active().life.player.aff || 0 }));
    /** rub back and forth at a height (fraction of the body) with a given side offset for `ms` */
    const rub = async (g, frac, off, ms, amp = 12) => { const y = g.feet - g.h * frac, t0 = Date.now(); let k = 0; while (Date.now() - t0 < ms) { await page.mouse.move(g.cx + off * g.h + (k % 2 ? -amp : amp), y); await wait(page, 32); k++; } };
    const FR = { head: [0.7, 0], cheek: [0.62, 0.45], ears: [0.97, 0.28], belly: [0.34, 0] };
    const settle = async () => { await page.evaluate(() => { OC.Touch.cancel(); }); await wait(page, 2200); await page.evaluate(() => { const b = OC.Brain.get(OC.Store.s.activeId); b.holds.clear(); b.st = 'think'; b.thinkAt = 1e9; const a = OC.App.player; a.act = null; a.touch = null; OC.Chars.active().life.player.petAt = 0; }); };

    if (want(1)) {
      const T = await taste(); let g = await geo();
      // 1a: the OC's favourite spot: contentment rises, the OC is held, no menu, aff rises after the release
      const [fl, fo] = FR[T.likes]; const aff0 = (await st()).aff;
      await page.mouse.move(g.cx + fo * g.h, g.feet - g.h * fl); await page.mouse.down(); await rub(g, fl, fo, 6500); const s1 = await st();
      await page.mouse.up(); await wait(page, 800); const s1b = await st();
      check('1a 在喜歡的地方來回滑動＝摸摸：滿足度逐漸上升、角色被留住、不會開選單、也不會被抱起', s1.petting && s1.touch && s1.touch.lv > 0.45 && s1.holds.includes('pet') && !s1.menu && s1.lift === 0, { T, s1 });
      check('1b 放開後好感增加（資料只在這時改一次）', s1b.aff > aff0, { aff0, after: s1b.aff });
      await settle(); g = await geo();
      // 1c: body parts: ears / belly / cheek are told apart
      const zones = {};
      for (const z of ['ears', 'belly', 'cheek']) { const [f, o] = FR[z]; await page.mouse.move(g.cx + o * g.h, g.feet - g.h * f); await page.mouse.down(); await rub(g, f, o, 1500, z === 'cheek' ? 5 : 9); zones[z] = (await st()).touch && (await st()).touch.zone; await page.mouse.up(); await settle(); g = await geo(); }
      check('1c 耳朵、臉頰、肚子會被分辨出來（不同部位不同反應）', zones.ears === 'ears' && zones.belly === 'belly' && zones.cheek === 'cheek', zones);
      // 1d: the spot it dislikes: it gets annoyed (turns away), no affection gain
      const dz = T.dislikes === 'tail' ? 'belly' : T.dislikes; let annoyed = null, aff2 = 0;
      if (T.dislikes !== 'tail') { const [f, o] = FR[dz]; const a0 = (await st()).aff; await page.mouse.move(g.cx + o * g.h, g.feet - g.h * f); await page.mouse.down(); await rub(g, f, o, 6500); annoyed = await st(); await page.mouse.up(); await wait(page, 600); aff2 = (await st()).aff - a0; }
      else { const a0 = (await st()).aff; const tailx = 0.5; await page.mouse.move(g.cx + tailx * g.h, g.feet - g.h * 0.3); await page.mouse.down(); await rub(g, 0.3, tailx, 6500, 4); annoyed = await st(); await page.mouse.up(); await wait(page, 600); aff2 = (await st()).aff - a0; }
      check('1d 摸到不喜歡的地方：會不高興（轉過頭去），而且不會增加好感', annoyed && annoyed.touch && annoyed.touch.annoyed && aff2 <= 0, { dislikes: T.dislikes, annoyed, aff2 });
      await settle(); g = await geo();
      // 1e: dragged out of the body without rubbing = pick up (still works); and leaving the body while stroking does not lift
      await page.mouse.move(g.cx, g.feet - g.h * 0.5); await page.mouse.down(); await page.mouse.move(g.cx + 90, g.feet - g.h * 0.5 - 30, { steps: 6 }); await wait(page, 300); const lifted = await st();
      await page.mouse.up(); await wait(page, 200); await settle(); g = await geo();
      check('1e 沒有摸、直接把角色拖出身體範圍＝抱起來', lifted.holds.includes('drag') && lifted.lift > 10, lifted);
      await page.mouse.move(g.cx, g.feet - g.h * 0.7); await page.mouse.down(); await rub(g, 0.7, 0, 1500, 12); await page.mouse.move(g.cx + 120, g.feet - g.h * 0.7, { steps: 8 }); await wait(page, 300); const off = await st();
      await page.mouse.up(); await settle();
      check('1f 摸到一半手指滑出身體：只是停止撫摸，不會突然把角色抱起來', !off.holds.includes('drag'), off);
      // 1g: a tap is still the ring menu
      g = await geo(); await page.mouse.click(g.cx, g.feet - g.h * 0.5); await wait(page, 700); const menu = await page.evaluate(() => [...document.querySelectorAll('.radial-btn')].map((b) => b.textContent));
      check('1g 點一下角色＝環狀選單（有「親近」）', menu.includes('親近') && (menu.includes('聊天') || menu.includes('打招呼')), menu); await page.evaluate(() => OC.Radial.close(true)); await settle();
    }
    if (want(2)) {
      const ids = await page.evaluate(() => ({ self: OC.Store.s.activeId, mate: Object.keys(OC.App.mates)[0] }));
      const holds = (id) => page.evaluate((id) => [...OC.Brain.get(id).holds], id);
      // the sub ring
      const sub = await page.evaluate(async (id) => { OC.App.menuFor({ type: 'mate', id }, OC.App.screenOf(OC.App.actorOf(id))); await new Promise((r) => setTimeout(r, 400)); [...document.querySelectorAll('.radial-btn')].find((b) => b.textContent === '親近').click(); await new Promise((r) => setTimeout(r, 1400)); const t = [...document.querySelectorAll('.radial-btn')].map((b) => b.textContent); OC.Radial.close(true); return t; }, ids.mate);
      check('2a 「親近」打開第二個環：摸頭、抱抱、擊掌、戳戳、牽手', ['摸頭', '抱抱', '擊掌', '戳戳', '牽手'].every((x) => sub.includes(x)), sub);
      await wait(page, 500);
      // hug
      const a0 = await page.evaluate((id) => OC.Chars.get(id).life.player.aff || 0, ids.mate);
      await page.evaluate((id) => OC.LifeUI.hug(id), ids.mate); await wait(page, 600); const hh = await holds(ids.mate);
      const dn = await page.waitForFunction((id) => !OC.Brain.get(id).holds.has('gesture'), ids.mate, { timeout: 40000 }).then(() => true).catch(() => false);
      const a1 = await page.evaluate((id) => OC.Chars.get(id).life.player.aff || 0, ids.mate);
      check('2b 抱抱：角色走過來、張開手臂、抱緊；結束後放開，好感增加', hh.includes('gesture') && dn && a1 > a0, { hh, dn, a0, a1 });
      // high-five: tap the target
      await page.evaluate((id) => OC.LifeUI.highfive(id), ids.mate);
      const tgt = await page.waitForSelector('.hf-target', { timeout: 40000 }).then(() => true).catch(() => false);
      if (tgt) await page.evaluate(() => document.querySelector('.hf-target').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
      const hdn = await page.waitForFunction((id) => !OC.Brain.get(id).holds.has('gesture'), ids.mate, { timeout: 20000 }).then(() => true).catch(() => false);
      check('2c 擊掌：出現可以點的手，點到＝成功，結束後放開', tgt && hdn, { tgt, hdn });
      await page.evaluate((id) => OC.LifeUI.highfive(id), ids.mate); await page.waitForSelector('.hf-target', { timeout: 40000 }).catch(() => {});
      const miss = await page.waitForFunction((id) => !document.querySelector('.hf-target') && !OC.Brain.get(id).holds.has('gesture'), ids.mate, { timeout: 15000 }).then(() => true).catch(() => false);
      check('2d 擊掌沒點到：會有落空的反應，一樣會放開（不會卡住）', miss, miss);
      // poke ×4 → annoyed pout; always released
      await page.evaluate((id) => { for (let i = 0; i < 4; i++) setTimeout(() => OC.LifeUI.poke(id), i * 400); }, ids.mate); await wait(page, 5200);
      const ph = await holds(ids.mate);
      check('2e 連戳四下：角色會賭氣，之後放開', !ph.includes('gesture'), ph);
      // hand-hold: follows the player, releases
      await page.evaluate((id) => { OC.LifeUI.handhold(id); }, ids.mate); await wait(page, 800); const hh2 = await holds(ids.mate);
      await page.evaluate(() => OC.LifeUI.endHand()); await wait(page, 400); const hh3 = await holds(ids.mate);
      check('2f 牽手：角色跟在身邊；結束後放開', hh2.includes('gesture') && !hh3.includes('gesture'), { hh2, hh3 });
    }
    if (want(3)) {
      const r = await page.evaluate(() => {
        const c = OC.Chars.active(), cv = document.createElement('canvas'); cv.width = cv.height = 160; const x = cv.getContext('2d'), out = { bad: [], n: 0, noFb: [] };
        const names = OC.Anim11.names; out.count = names.length;
        for (const n of names) {
          const chain = OC.Chars.ACTIONS.find((a) => a[0] === n); if (!chain || !chain[3].length) out.noFb.push(n);
          for (const at of [0, 0.2, 0.55, 1.1, 2.7]) { try { const r = OC.CharRender.draw(x, c, { action: n, at, dir: 'front', face: 0.2 }, 80, 140, 1.4, at); const s = r.state; for (const k of Object.keys(s)) if (typeof s[k] === 'number' && !isFinite(s[k])) out.bad.push(n + '.' + k); out.n++; } catch (e) { out.bad.push(n + ':' + e.message); } }
        }
        for (const z of ['head', 'cheek', 'ears', 'belly', 'tail']) for (const lv of [0.1, 0.5, 1]) { try { OC.CharRender.draw(x, c, { action: 'idle', at: 1, dir: 'front', touch: { lv, zone: z, dir: 0.5, ticklish: lv > 0.4, annoyed: lv === 0.5 } }, 80, 140, 1.4, 1); out.n++; } catch (e) { out.bad.push('touch ' + z + ':' + e.message); } }
        return out;
      });
      check('3a 動畫庫的每個動作都能畫（沒有 NaN／例外），也有備用鏈', r.count >= 100 && !r.bad.length && !r.noFb.length, { count: r.count, drawn: r.n, bad: r.bad.slice(0, 5), noFb: r.noFb });
    }
    if (want(4)) {
      // 4: planning, goals, knowing each other, the "想法" sheet
      const mate = await page.evaluate(() => Object.keys(OC.App.mates)[0]);
      await page.evaluate((id) => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 14; S.settings.weather = 'rain'; S.life.settings.autonomy = 'full'; S.life.settings.travel = false; const c = OC.Chars.get(id); c.personality.traits = ['bookworm']; for (const k of Object.keys(c.needs)) c.needs[k] = 75; const b = OC.Brain.get(id); b.holds.clear(); b.queued = null; if (b.st === 'do' || b.st === 'go') OC.Brain.abort(b, 't'); b.st = 'think'; b.thinkAt = 0; b.plan = null; OC.Mind11.st(c).lastPlanAt = -1e9; OC.Mind11.st(c).planStats = {}; }, mate);
      const got = await page.waitForFunction((id) => { const b = OC.Brain.get(id); if (b.st === 'think') b.thinkAt = 0; return b.plan && b.plan.id; }, mate, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => null);
      check('4a 下雨天、愛讀書的 OC 會自己訂出多步驟計畫（例如「雨天窩著」）', !!got, got);
      const ex = await page.evaluate((id) => OC.Mind11.explain(OC.Chars.get(id)), mate);
      check('4b 「想法」資料：目前的原因、計畫步驟、今天的小目標、備選項都有', ex.reason && ex.plan && ex.plan.steps.length >= 2 && ex.goals.length >= 1 && ex.cands.length >= 2, { reason: ex.reason, plan: ex.plan && ex.plan.zh, goals: ex.goals.length, cands: ex.cands.length });
      // the plan advances while the OC lives (simulation minutes)
      const prog = await page.evaluate(async (id) => { const b = OC.Brain.get(id); let i0 = b.plan ? b.plan.i : -1, maxI = i0; for (let k = 0; k < 40 && b.plan; k++) { OC.Sim.advance(10); await new Promise((r) => setTimeout(r, 120)); if (b.plan) maxI = Math.max(maxI, b.plan.i); } return { i0, maxI, ended: !b.plan, done: OC.Mind11.st(OC.Chars.get(id)).done }; }, mate);
      check('4c 計畫會一步一步做下去（做完一個活動就換下一步，最後完成或合理放棄）', prog.maxI > prog.i0 || prog.ended, prog);
      // urgent need drops a plan
      const drop = await page.evaluate(async (id) => { const c = OC.Chars.get(id), b = OC.Brain.get(id); b.holds.clear(); if (!b.plan) { b.plan = { id: 'x', zh: '測試計畫', why: 't', steps: [{ act: 'read' }, { act: 'rest' }], i: 0, until: OC.Sim.now() + 300, miss: 0 }; } c.needs.food = 4; b.st = 'think'; b.thinkAt = 0; for (let i = 0; i < 12 && b.plan; i++) { OC.Sim.advance(2); await new Promise((r) => setTimeout(r, 150)); } return { plan: !!b.plan, log: OC.Brain.log.filter((l) => l.who === id).slice(0, 4).map((l) => l.text) }; }, mate);
      check('4d 肚子太餓等急事來了，計畫會被放下（需求優先）並留下原因', !drop.plan && drop.log.some((t) => /放棄計畫|吃飯|急需/.test(t)), drop);
      // knowing each other
      const kn = await page.evaluate((id) => { const c = OC.Chars.get(id), other = OC.Chars.all().find((x) => x.id !== id); for (let i = 0; i < 6; i++) { OC.Brain.get(other.id).st = 'do'; OC.Brain.get(other.id).act = 'read'; OC.Mind11.learn(c, other); } const k = OC.Mind11.st(c).know[other.id]; return { fav: OC.Mind11.favAct(k), seen: !!k.seen }; }, mate);
      check('4e 牠會觀察身邊的人（記住對方常做的事與心情），之後聊天會提起', kn.fav === 'read' && kn.seen, kn);
      const sh = await page.evaluate(async (id) => { OC.LifeUI.think(id); await new Promise((r) => setTimeout(r, 600)); const t = [...document.querySelectorAll('.sheet')].pop().textContent; while (OC.UI.stack.length) OC.UI.back(); return t.slice(0, 60); }, mate);
      check('4f 「想法」面板可以打開（狀態卡的「想法」、互動選單「更多」）', /想法/.test(sh) && /現在/.test(sh), sh);
      const dia = await page.evaluate((id) => { const c = OC.Chars.get(id), k = OC.Mind11.st(c); k.today = { acts: { read: 3, rest: 1 }, plans: [{ id: 'x', zh: '雨天窩著', ok: true }], goals: [], social: [] }; OC.Mind11.onDay(); return (c.life.mem.recent.concat(c.life.mem.long).find((m) => /^昨天：/.test(m.text)) || {}).text; }, mate);
      check('4g 每天結束時會把「昨天做了什麼」寫成一則日記回憶', !!dia, dia);
    }
    if (want(5)) {
      // 5: every paired interaction runs end to end: both characters perform complementary actions, data changes, nobody stays held
      const ids = await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 15; S.settings.weather = 'clear'; S.life.settings.autonomy = 'full'; S.life.settings.travel = false; const all = OC.Chars.all().filter((c) => OC.Brain.get(c.id) && OC.Brain.get(c.id).a); return all.slice(0, 2).map((c) => c.id); });
      const [A, Bc] = ids; const kinds = await page.evaluate(() => Object.keys(OC.Social11.KINDS));
      const res = [];
      for (const kind of kinds) {
        const r = await page.evaluate(async ([a, b, kind]) => {
          const ca = OC.Chars.get(a), cb = OC.Chars.get(b), ba = OC.Brain.get(a), bb = OC.Brain.get(b);
          for (const c of [ca, cb]) for (const k of Object.keys(c.needs)) c.needs[k] = 70;
          for (const [x, y] of [[a, b], [b, a]]) Object.assign(OC.Mind.rel(x, y), { fam: 50, aff: 55, trust: 45, intim: 20, conflict: 0 });   // absolute (relations are clamped at 100)
          ca.personality.traits = ['cheerful', 'gentle']; cb.personality.traits = ['cheerful'];
          for (const x of [ba, bb]) { x.holds.clear(); x.queued = null; if (OC.Brain.convs.length) OC.Brain.convs.slice().forEach((cv) => OC.Brain.Social.end(cv, 't')); if (x.st === 'do' || x.st === 'go') OC.Brain.abort(x, 't'); x.st = 'think'; x.thinkAt = 1e9; x.plan = null; }
          if (OC.Events.current) OC.Events.end('t');
          const r0 = JSON.parse(JSON.stringify(OC.Mind.rel(a, b))), seen = new Set(), seen2 = new Set();
          const respond0 = OC.Brain.Social.respond; OC.Brain.Social.respond = () => ({ ans: 'yes' });   // deterministic: the invitation is accepted
          const ok = OC.Brain.Social.start(ba, bb, kind); if (!ok) { OC.Brain.Social.respond = respond0; return { kind, started: false }; }
          const t0 = Date.now(); while (Date.now() - t0 < 60000 && OC.Brain.convs.some((cv) => cv.a.id === a)) { const x = OC.App.actorOf(a), y = OC.App.actorOf(b); if (x && x.act) seen.add(x.act.action); if (y && y.act) seen2.add(y.act.action); await new Promise((r) => setTimeout(r, 120)); }
          OC.Brain.Social.respond = respond0; await new Promise((r) => setTimeout(r, 300));
          const r1 = OC.Mind.rel(a, b);
          return { kind, started: true, ended: !OC.Brain.convs.some((cv) => cv.a.id === a), a: [...seen], b: [...seen2], d: { aff: +(r1.aff - r0.aff).toFixed(1), fam: +(r1.fam - r0.fam).toFixed(1), intim: +((r1.intim || 0) - (r0.intim || 0)).toFixed(1) }, holds: [[...ba.holds], [...bb.holds]] };
        }, [A, Bc, kind]);
        res.push(r);
      }
      const bad = res.filter((r) => !r.started || !r.ended || r.holds[0].length || r.holds[1].length);
      check('5a 十種雙人互動都能完整跑完：開始、演出、結束，沒有人被卡住', !bad.length, bad.length ? bad : res.map((r) => r.kind + ' ' + JSON.stringify(r.d)).join(' | ').slice(0, 300));
      const EXP = { hug: ['hugme', 'hug'], highfive: ['highfive'], dance: ['twirl'], selfie: ['selfie'], rps: ['rps'], tickle: ['tickle', 'ticklish'], pat: ['pat', 'patted'], whisper: ['whisper', 'listen'], leanOn: ['lean_on', 'shoulder'], peekaboo: ['peekaboo', 'stunned'] };
      const perf = res.filter((r) => !(EXP[r.kind] || []).every((x) => r.a.includes(x) || r.b.includes(x)));
      check('5b 兩個角色都會做出配對的動作（例如擁抱：張開手臂＋抱緊；搔癢：搔的人＋怕癢的人）', !perf.length, perf.map((r) => r.kind + ' A:' + r.a + ' B:' + r.b));
      const nogain = res.filter((r) => r.d.aff === 0 && r.d.fam === 0 && r.d.intim === 0);
      check('5c 每種互動都會改變關係（好感／熟悉度／親密度，或有負面結果的互動是衝突）', nogain.length === 0, nogain.map((r) => r.kind));
    }
    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.message)); }
  await browser.close();
  const n = H.results.filter((r) => r.ok).length; console.log(`\n${n}/${H.results.length} passed`);
})();
