/* OC Shimeji 11.0 acceptance (Playwright, real pointer events). node game/tests/v11/run.js [1 2 …]   (http.server on :8765; ~6 min)
 *   1 stroking: a slide over the body is petting (continuous level, body parts, taste, annoyance), not a pick-up or a menu
 *   2 closeness ring + gestures (hug · high-five · poke · hand-hold) release their OC and change real data once
 *   3 animation library: every action renders (no NaN), has a fallback chain, touch layer for every zone
 *   7 world feedback: tap ripple that stays until the OC arrives, shaking trees with leaves + sound, dust puffs, 2 extra draw calls at most, effects follow quality / reduced motion
 *   6 audio: every sound is audible and never clips, character voices differ and follow the mood, stereo placement, music layers, ducking, action/footstep hooks, haptic rhythms, settings
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
    /** no random life event may take the OCs over in the middle of a check (an event holds them with 'event') */
    const quiet = () => page.evaluate(() => { if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; for (const c of OC.Chars.all()) { const b = OC.Brain.get(c.id); if (b) b.holds.delete('event'); } });
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
      for (const z of ['ears', 'belly', 'cheek']) { for (let a = 0; a < 3 && zones[z] !== z; a++) { const [f, o] = FR[z]; await page.mouse.move(g.cx + o * g.h, g.feet - g.h * f); await page.mouse.down(); await rub(g, f, o, 1500, z === 'cheek' ? 5 : 9); zones[z] = (await st()).touch && (await st()).touch.zone; await page.mouse.up(); await settle(); g = await geo(); } }   // the OC may be mid-fidget (its box moves): up to 3 tries per body part
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
      await quiet();
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
      let tgt = false;
      for (let a = 0; a < 3 && !tgt; a++) {   // the hug before may still be finishing; ask again if the hand does not show up
        await quiet(); await page.waitForFunction((id) => !OC.Brain.get(id).holds.has('gesture'), ids.mate, { timeout: 20000 }).catch(() => {});
        await page.evaluate((id) => OC.LifeUI.highfive(id), ids.mate);
        tgt = await page.waitForSelector('.hf-target', { timeout: 20000 }).then(() => true).catch(() => false);
      }
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
      await quiet(); await page.evaluate((id) => { OC.LifeUI.handhold(id); }, ids.mate); await wait(page, 800); const hh2 = await holds(ids.mate);
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
      await quiet();
      // 4: planning, goals, knowing each other, the "想法" sheet
      const mate = await page.evaluate(() => Object.keys(OC.App.mates)[0]);
      await page.evaluate((id) => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 14; S.settings.weather = 'rain'; S.life.settings.autonomy = 'full'; S.life.settings.travel = false; const c = OC.Chars.get(id); c.personality.traits = ['bookworm']; for (const k of Object.keys(c.needs)) c.needs[k] = 75; const b = OC.Brain.get(id); b.holds.clear(); b.queued = null; if (b.st === 'do' || b.st === 'go') OC.Brain.abort(b, 't'); b.st = 'think'; b.thinkAt = 0; b.plan = null; OC.Mind11.st(c).lastPlanAt = -1e9; OC.Mind11.st(c).planStats = {}; }, mate);
      const got = await page.waitForFunction((id) => { const b = OC.Brain.get(id); if (b.st === 'think') b.thinkAt = 0; return b.plan && b.plan.id; }, mate, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => null);
      check('4a 下雨天、愛讀書的 OC 會自己訂出多步驟計畫（例如「雨天窩著」）', !!got, got);
      const ex = await page.evaluate((id) => OC.Mind11.explain(OC.Chars.get(id)), mate);
      check('4b 「想法」資料：目前的原因、計畫步驟、今天的小目標、備選項都有', ex.reason && ex.plan && ex.plan.steps.length >= 2 && ex.goals.length >= 1 && ex.cands.length >= 2, { reason: ex.reason, plan: ex.plan && ex.plan.zh, goals: ex.goals.length, cands: ex.cands.length });
      // the plan advances while the OC lives (simulation minutes)
      await quiet();
      const prog = await page.evaluate(async (id) => { const b = OC.Brain.get(id); let i0 = b.plan ? b.plan.i : -1, maxI = i0; for (let k = 0; k < 200 && b.plan; k++) { OC.Sim.advance(10); await new Promise((r) => setTimeout(r, 250)); if (b.plan) maxI = Math.max(maxI, b.plan.i); if (maxI > i0) break; } /* walking to the next place takes real time (up to ~50 s on a slow machine) */ return { i0, maxI, ended: !b.plan, done: OC.Mind11.st(OC.Chars.get(id)).done, dbg: { holds: [...b.holds], st: b.st, act: b.act, now: Math.round(OC.Sim.now()), until: b.plan && Math.round(b.plan.until), loc: OC.Chars.get(id).life.loc, trip: !!OC.Chars.get(id).life.trip } }; }, mate);
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
      await quiet();
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
    if (want(6)) {
      // 6: audio (a recorder runs on the audio thread: peak, energy, zero-crossing rate ≈ brightness, left/right peaks)
      await page.evaluate(() => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); OC.App.tab('island'); }); await wait(page, 500);
      await page.evaluate(async () => {
        OC.Sound.unlock(); const sc = OC.Store.s.settings.sound = Object.assign({}, OC.Sound.cfg(), { music: 0, amb: 0 }); OC.Sound.apply(); /* the recorder should hear only what each check plays */ const g = OC.Sound._tap(); if (!g) return;
        const code = `class R extends AudioWorkletProcessor { constructor(){ super(); this.r(); this.port.onmessage=(e)=>{ if(e.data==='read'){ this.port.postMessage({pl:this.pl,pr:this.pr,e:this.s/sampleRate,hf:this.d/sampleRate,zcr:this.z/Math.max(1,this.na)*sampleRate/2,n:this.n}); this.r(); } }; } r(){ this.pl=0;this.pr=0;this.s=0;this.n=0;this.na=0;this.z=0;this.prev=0;this.d=0;this.pv=0; } process(inp){ const c0=inp[0]&&inp[0][0], c1=inp[0]&&(inp[0][1]||inp[0][0]); if(c0){ for(let i=0;i<c0.length;i++){ const v=c0[i], w=c1[i]; if(Math.abs(v)>this.pl)this.pl=Math.abs(v); if(Math.abs(w)>this.pr)this.pr=Math.abs(w); this.d+=(v-this.pv)*(v-this.pv); this.pv=v; this.s+=(v*v+w*w)/2; this.n++; if(Math.abs(v)>0.0004){ this.na++; if((v>0)!==(this.prev>0))this.z++; this.prev=v; } } } return true; } } registerProcessor('rec', R);`;
        await g.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
        const node = new AudioWorkletNode(g.ctx, 'rec', { channelCount: 2, channelCountMode: 'explicit' }); g.master.connect(node); const z = g.ctx.createGain(); z.gain.value = 0; node.connect(z); z.connect(g.ctx.destination);
        window.__rec = () => new Promise((res) => { node.port.onmessage = (e) => res(e.data); node.port.postMessage('read'); });
        window.__measure = async (fn, ms) => { await window.__rec(); const ret = fn(); await new Promise((r) => setTimeout(r, ms)); const m = await window.__rec(); m.ret = ret; return m; };
      });
      const state = await page.evaluate(() => ({ ready: OC.Sound.ready, st: OC.Sound.state, rec: typeof window.__rec }));
      check('6a 聲音引擎在第一次觸碰後啟動（AudioContext 運行中），錄音節點接上', state.ready && state.st === 'running' && state.rec === 'function', state);

      // 6b every sound in the library: audible, never clipping, and no voices left hanging
      const lib = await page.evaluate(async () => {
        const bad = [], quiet = [], names = Object.keys(OC.Sound.LIB); let maxPeak = 0;
        for (const n of names) {
          await new Promise((r) => setTimeout(r, 40));
          let m = await window.__measure(() => OC.Sound.play(n, { lv: 0.7 }), 650);
          if (!m.ret) { await new Promise((r) => setTimeout(r, OC.Sound.LIB[n][1] + 80)); m = await window.__measure(() => OC.Sound.play(n, { lv: 0.7 }), 650); }   // the same sound may still be cooling down from a real UI tap
          if (!m.ret) { bad.push(n + ':not-played'); continue; }
          maxPeak = Math.max(maxPeak, m.pl, m.pr);
          if (m.pl > 0.9) bad.push(n + ':clips ' + m.pl.toFixed(2)); if (m.pl < 0.0008 && m.pr < 0.0008) quiet.push(n);
        }
        await new Promise((r) => setTimeout(r, 2500));
        return { count: names.length, bad, quiet, maxPeak: +maxPeak.toFixed(3), voices: OC.Sound.voices };
      });
      check('6b 資料庫裡每個音效都真的發出聲音、不爆音、結束後沒有殘留的發聲體', lib.count >= 60 && !lib.bad.length && !lib.quiet.length && lib.voices <= 2, lib);

      // 6c voices: distinct per OC, the mood shapes speed and brightness, quiet when the slider is 0
      const vo = await page.evaluate(async () => {
        const cs = OC.Chars.all().slice(0, 3), f0 = cs.map((c) => Math.round(OC.Sound.voiceOf(c).f0));
        const tall = JSON.parse(JSON.stringify(cs[0])); tall.profile.height = 1.5; const small = JSON.parse(JSON.stringify(cs[0])); small.profile.height = 0.7;
        const line = '今天天氣真好，一起去散步吧！';
        const run = async (emo) => { await new Promise((r) => setTimeout(r, 260)); return window.__measure(() => OC.Sound.speak(cs[0], line, { emo }), 1900); };
        const ex = await run('excited'), dn = await run('down'), tr = await run('tired');
        const q = await window.__measure(() => OC.Sound.speak(cs[1], '你好嗎？', { emo: 'neutral' }), 1500);
        const cfg = OC.Store.s.settings.sound = Object.assign({}, OC.Sound.cfg()); cfg.voice = 0; OC.Sound.apply(); await new Promise((r) => setTimeout(r, 300));
        const off = OC.Sound.speak(cs[0], line, { emo: 'happy' }); cfg.voice = 0.6; OC.Sound.apply();
        return { f0, tallF: Math.round(OC.Sound.voiceOf(tall).f0), smallF: Math.round(OC.Sound.voiceOf(small).f0), exDur: +ex.ret.toFixed(2), dnDur: +dn.ret.toFixed(2), trDur: +tr.ret.toFixed(2), exPow: +(ex.e / ex.ret * 1e3).toFixed(3), dnPow: +(dn.e / dn.ret * 1e3).toFixed(3), trPow: +(tr.e / tr.ret * 1e3).toFixed(3), exPeak: +ex.pl.toFixed(2), qPeak: +q.pl.toFixed(2), qE: +q.e.toFixed(4), off };
      });
      check('6c 每個 OC 有自己的聲線（音高不同、高個子比較低沉）', new Set(vo.f0).size === 3 && vo.tallF < vo.smallF, vo);
      check('6d 心情會改變說話：興奮比低落／疲倦快、而且比較大聲；說話有聲音但不爆音；滑桿 0 就靜音', vo.exDur < vo.dnDur && vo.dnDur < vo.trDur + 0.01 && vo.exPow > vo.dnPow * 1.5 && vo.exPow > vo.trPow * 1.5 && vo.exPeak > 0.002 && vo.exPeak < 0.9 && vo.qE > 0 && vo.off === 0, vo);

      // 6e placement: left of the screen is panned left, right is panned right, off-screen is silent; real stereo output
      const pn = await page.evaluate(async () => {
        const W = OC.World, py0 = () => OC.App.player.y, mk = (sx) => { let best = null; const py = OC.App.player.y; for (let x = -300; x < 1000; x += 8) { const p = W.project(x, py, 0, 20); if (!best || Math.abs(p.x - sx) < Math.abs(best.p.x - sx)) best = { a: { x, y: py, lvl: 0 }, p }; } return best.a; };
        const L = OC.Sound.placement(mk(40)), R = OC.Sound.placement(mk(350)), off = OC.Sound.placement({ x: -2000, y: py0(), lvl: 0 });
        const ml = await window.__measure(() => OC.Sound.play('clap', { pan: -0.8 }), 500), mr = await window.__measure(() => OC.Sound.play('knock', { pan: 0.8 }), 700);
        return { L: L && +L.pan.toFixed(2), R: R && +R.pan.toFixed(2), off, leftOut: [+ml.pl.toFixed(3), +ml.pr.toFixed(3)], rightOut: [+mr.pl.toFixed(3), +mr.pr.toFixed(3)] };
      });
      check('6e 聲音依畫面位置左右定位（左邊的在左聲道、右邊的在右聲道，畫面外不發聲）', pn.L < -0.1 && pn.R > 0.1 && pn.off === null && pn.leftOut[0] > pn.leftOut[1] * 1.8 && pn.rightOut[1] > pn.rightOut[0] * 1.8, pn);

      // 6f music: mood follows the place, the intensity layer adds a shaker/kick, voices duck the music (checked on the automation calls) and it comes back
      const mu = await page.evaluate(async () => {
        const f = OC.Sound.musicFor; const kinds = { mini: f({ area: 'isle', mini: true }), cozy: f({ area: 'home', phase: 'night' }), indoor: f({ area: 'cafe', phase: 'day' }), day: f({ area: 'isle', phase: 'day' }), rain: f({ area: 'isle', wx: 'rain', phase: 'day' }) };
        const sc = OC.Store.s.settings.sound; sc.music = 0.45; OC.Sound.apply();
        OC.Sound.music('day'); await new Promise((r) => setTimeout(r, 2600));
        OC.Sound.setIntensity(0, 12000); await new Promise((r) => setTimeout(r, 400)); const st0 = Object.assign({}, OC.Sound.stats); const calm = await window.__measure(() => 0, 5000); const st1 = Object.assign({}, OC.Sound.stats);
        OC.Sound.setIntensity(2, 12000); await new Promise((r) => setTimeout(r, 400)); const st2 = Object.assign({}, OC.Sound.stats); const busy = await window.__measure(() => 0, 5000); const st3 = Object.assign({}, OC.Sound.stats);
        OC.Sound.setIntensity(0, 1);
        const g = OC.Sound._tap(), base = OC.Sound.cfg().music, calls = [], o = g.bus.music.gain.setTargetAtTime.bind(g.bus.music.gain); g.bus.music.gain.setTargetAtTime = (v, t, k) => { calls.push({ v: +v.toFixed(3), t: +t.toFixed(2) }); return o(v, t, k); };
        await new Promise((r) => setTimeout(r, 1200)); const mv = OC.Sound.musicVoices, spoke = OC.Sound.speak(OC.Chars.active(), '嗨，早安呀！', { emo: 'happy' }); await new Promise((r) => setTimeout(r, 200)); g.bus.music.gain.setTargetAtTime = o;
        sc.music = 0; OC.Sound.apply();
        return { kinds, mood: OC.Sound.mood, calm: { perc: st1.perc - st0.perc, kick: st1.kick - st0.kick }, busy: { perc: st3.perc - st2.perc, kick: st3.kick - st2.kick }, mv, spoke: +(spoke || 0).toFixed(2), calmHF: +calm.hf.toExponential(3), busyHF: +busy.hf.toExponential(3), base, calls };
      });
      const dk = mu.calls;
      check('6f 音樂依場合選曲（小遊戲、夜晚的家、室內、白天、雨天）', mu.kinds.mini === 'minigame' && mu.kinds.cozy === 'cozy' && mu.kinds.indoor === 'indoor' && mu.kinds.day === 'day' && mu.kinds.rain === 'rain' && mu.mood === 'day', mu.kinds);
      check('6g 音樂強度層真的啟動（強度 0 沒有打擊樂；強度 2 排進沙鈴與輕鼓）；音樂最忙時角色照樣說得出話；說話時音樂先讓位（降到 ~55%）、說完才回來', mu.calm.perc === 0 && mu.calm.kick === 0 && mu.busy.perc >= 8 && mu.busy.kick >= 2 && mu.spoke > 0.3 && dk.length >= 2 && dk[0].v < mu.base * 0.7 && dk[dk.length - 1].v === mu.base && dk[dk.length - 1].t > dk[0].t + 0.5, mu);

      // 6h hooks: a new action makes its sound once, spoken bubbles are voiced (thoughts are not), footsteps by ground, haptic rhythms
      const hk = await page.evaluate(async () => {
        const A = OC.Sound.action, calls = []; OC.Sound.action = (a, n) => { calls.push(n); return A.call(OC.Sound, a, n); };
        const pl = OC.App.player; OC.World.setAction(pl, 'clap', { dur: 1, priority: 6 }); OC.World.setAction(pl, 'clap', { dur: 1, priority: 6 }); OC.World.setAction(pl, 'wave', { dur: 1, priority: 2 });   // wave is blocked by the higher priority
        OC.Sound.action = A;
        const S0 = OC.Sound.speak, say = []; OC.Sound.speak = (c, t, o) => { say.push(o.emo); return S0.call(OC.Sound, c, t, o); };
        OC.App.bubble(pl, '你好呀！', 'x', 1.5, { emo: 'happy' }); OC.App.bubble(pl, '（想想看……）', 'x', 1.5, { thought: true }); OC.Sound.speak = S0;
        const played = []; for (let i = 0; i < 12 && !played[0]; i++) { played[0] = OC.Sound.foot(pl); if (!played[0]) await new Promise((r) => setTimeout(r, 140)); }   // the player may be taking real steps right now (rate limit)
        const vib = []; const nv = navigator.vibrate; navigator.vibrate = (p) => { vib.push(p); return true; }; const S = OC.Store.s; S.settings.haptics = true;
        OC.UI.haptic('purr'); OC.UI.haptic('heartbeat'); OC.UI.haptic('giggle'); OC.UI.haptic('melt'); S.settings.haptics = false; OC.UI.haptic('purr'); S.settings.haptics = true; navigator.vibrate = nv;
        return { calls, say, foot: played, vib, area: OC.World.area.id };
      });
      check('6h 新動作只發一次自己的聲音（被高優先權擋下的不發）；說出的話有聲、心裡想的沒聲；腳步依地面', JSON.stringify(hk.calls) === '["clap"]' && hk.say.length === 1 && hk.say[0] === 'happy' && hk.foot.includes('foot_grass'), hk);
      check('6i 觸覺有節奏（呼嚕、心跳、咯咯笑、融化各有圖案），關閉觸覺就完全不震動', hk.vib.length === 4 && hk.vib.every((p) => Array.isArray(p) && p.length >= 3) && new Set(hk.vib.map((p) => p.join())).size === 4, hk.vib);

      // 6j a real stroke on a liked spot: the purr rhythm is felt while it melts
      const ps = await page.evaluate(() => { const c = OC.Chars.active(); OC.Touch.known(c).taste = { likes: 'belly', dislikes: 'tail', ticklish: false, shy: false }; window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(Array.isArray(p) ? p.join() : String(p)); return true; }; OC.Store.s.settings.haptics = true; return true; });
      let g0 = await geo(); await page.mouse.move(g0.cx, g0.feet - g0.h * 0.5); await page.mouse.down(); { const t0 = Date.now(); let k = 0; while (Date.now() - t0 < 6500 || k < 16) { await page.mouse.move(g0.cx + (k % 2 ? -22 : 22), g0.feet - g0.h * 0.5); await wait(page, 32); k++; } } await page.mouse.up(); await wait(page, 500);
      const sv = await page.evaluate(() => ({ vib: window.__vib, purr: window.__vib.filter((x) => x === '5,90,5,90,5,90,5').length, melt: window.__vib.filter((x) => x === '10,110,10,120,5,125,5').length }));
      check('6j 真的撫摸喜歡的地方：感覺得到呼嚕的節奏（滿足時觸覺）', ps && sv.purr + sv.melt >= 1, sv);

      // 6k the settings page has the voice slider
      const sl = await page.evaluate(async () => { OC.Pages.open('settings'); await new Promise((r) => setTimeout(r, 700)); const el = document.querySelector('input[aria-label="角色說話聲"]'); const r = !!el; OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); return r; });
      check('6k 設定的聲音區有「角色說話聲」滑桿', sl);
    }
    if (want(7)) {
      // 7: touch feedback in the world
      await page.evaluate(() => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); OC.App.tab('island'); OC.App.setCamMode && OC.App.setCamMode('classic'); const S = OC.Store.s; S.settings.perf = 'balanced'; OC.App.applyPerf(); S.settings.motion = 'full'; OC.World.reduce = false; });
      await wait(page, 1500);
      // 7a: ground tap → ripple at the tapped point, dot stays while the OC walks, gone after it arrives
      const gp = await page.evaluate(() => { const a = OC.App.player; for (const [dx, dy] of [[0, 70], [60, 50], [-60, 50], [0, -70], [80, 0], [-80, 0], [70, 80], [-70, 80]]) { const x = a.x + dx, y = a.y + dy; if (!OC.World.walkable(x, y)) continue; const p = OC.World.project(x, y, OC.World.levelAt(x, y), 0); if (OC.World.pick(p.x, p.y).it || OC.World.shakeAt(p.x, p.y)) continue; if (p.y < 130 || p.y > 700) continue; return { x: p.x, y: p.y, dx, dy }; } return null; });
      await page.mouse.click(gp.x, gp.y); await wait(page, 500);
      const r1 = await page.evaluate(() => { const m = document.querySelector('.tap-ripple'); if (!m) return null; const b = m.getBoundingClientRect(); return { on: m.classList.contains('on'), op: m.style.opacity, x: Math.round(b.x), y: Math.round(b.y), rings: m.querySelectorAll('i').length, walking: !!OC.App.player.path }; });
      let gone = false; for (let i = 0; i < 40 && !gone; i++) { await wait(page, 400); gone = await page.evaluate(() => { const m = document.querySelector('.tap-ripple'); return !m || m.style.opacity === '0'; }); }
      check('7a 點地面：出現波紋（兩圈＋一個點）在點的位置，OC 走過去；抵達後消失', r1 && r1.on && r1.op === '1' && r1.rings === 2 && Math.hypot(r1.x - gp.x, r1.y - gp.y) < 40 && gone, { gp, r1, gone });

      // 7b: tap a tree → it shakes, leaves fall, rustle + tick, the OC is not sent walking
      // bring the OC next to a tree first (the camera follows), so there is always one on screen
      await page.evaluate(() => { const pl = OC.App.player, W = OC.World, all = W.swayTargets().filter((t) => W.walkable(t.dx, t.dy + 36) || W.nearestWalkable(t.dx, t.dy + 36, 40)); all.sort((a, b) => Math.hypot(a.dx - pl.x, a.dy - pl.y) - Math.hypot(b.dx - pl.x, b.dy - pl.y)); const t = all[0]; const q = W.nearestWalkable(t.dx, t.dy + 36, 60) || { x: t.dx, y: t.dy + 36 }; pl.path = null; pl.x = q.x; pl.y = q.y; });
      await wait(page, 2500);
      const tg = await page.evaluate(() => { const pl = OC.App.player; const L = OC.World.swayTargets().filter((t) => t.x > 30 && t.x < 330 && t.y > 150 && t.y < 680); return { list: L.slice(0, 40), n: L.length, plx: pl.x, ply: pl.y }; });
      let hit = null; for (const t of tg.list) { const ok = await page.evaluate((t) => { const r = OC.World.pick(t.x, t.y); return !r.it && !!OC.World.shakeAt(t.x, t.y); }, t); if (ok) { hit = t; break; } }
      const sp = await page.evaluate(() => { window.__snd = []; const P = OC.Sound.play; OC.Sound.play = (n, o) => { window.__snd.push(n); return P.call(OC.Sound, n, o); }; window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true; }; OC.Store.s.settings.haptics = true; const a = OC.App.player; return { x: a.x, y: a.y, path: !!a.path }; });
      if (!hit) { check('7b 點樹／灌木：搖晃、落葉、沙沙聲與觸覺；不會讓 OC 跑過去', false, { why: 'no tree on screen', tg: tg.n }); } else {
      await page.mouse.click(hit.x, hit.y); await wait(page, 500);
      const sh = await page.evaluate(() => ({ fx: OC.World.fx, snd: window.__snd, vib: window.__vib, path: !!OC.App.player.path, ripple: (() => { const m = document.querySelector('.tap-ripple'); return !!m && m.style.opacity === '1' && m.classList.contains('on'); })() }));
      check('7b 點樹／灌木：搖晃、落葉、沙沙聲與觸覺；不會讓 OC 跑過去', sh.fx.shaking >= 1 && sh.fx.leaves >= 6 && sh.snd.includes('rustle') && sh.vib.length >= 1 && !sh.path && !sh.ripple, { hit, sh, targets: tg.n }); }
      // 7c: the shake dies down, the leaves land and vanish, nothing stays behind
      let settled = null; for (let i = 0; i < 40; i++) { await wait(page, 500); settled = await page.evaluate(() => OC.World.fx); if (!settled.shaking && !settled.leaves) break; }
      const rot = await page.evaluate(() => Math.max(...OC.World.swayTargets().map(() => 0), 0));
      check('7c 搖晃會慢慢停下，葉子落地後消失（不留殘影、不累積）', settled && !settled.shaking && !settled.leaves, settled);

      // 7d: dust: running makes puffs, a landing makes a cloud; it fades away; at most 2 extra draw calls
      const du = await page.evaluate(async () => {
        const W = OC.World, a = OC.App.player, dust = () => W.fx.puffs;
        await new Promise((r) => setTimeout(r, 1200)); const c0 = W.fx.calls;
        W.puff(a.x, a.y, W.levelAt(a.x, a.y), '#E8E0CC', 5, 1); const n0 = dust();
        await new Promise((r) => setTimeout(r, 300)); const c1 = W.fx.calls;
        let t0 = Date.now(); while (dust() > 0 && Date.now() - t0 < 12000) await new Promise((r) => setTimeout(r, 300));
        const left = dust();
        a.lift = 20; await new Promise((r) => setTimeout(r, 600)); a.lift = 0; await new Promise((r) => setTimeout(r, 900)); const landed = W.fx.puffs;
        return { n0, calls0: c0, calls1: c1, left, landed };
      });
      check('7d 灰塵：會揚起、很快散掉；落地會揚起一小團；多用的繪製呼叫不超過 2 個', du.n0 >= 4 && du.left === 0 && du.landed >= 1 && du.calls1 - du.calls0 <= 2, du);

      // 7e: effects follow the quality setting and reduced motion (the shake itself still shows, softer)
      const lo = await page.evaluate(async () => { const S = OC.Store.s; S.settings.perf = 'saver'; OC.App.applyPerf(); await new Promise((r) => setTimeout(r, 800)); const W = OC.World, t = W.swayTargets().find((q) => q.x > 30 && q.x < 363 && q.y > 150 && q.y < 680); const s = W.shakeAt(t.x, t.y); W.shake(s); const a = OC.App.player; W.puff(a.x, a.y, 0, '#fff', 4, 1); const r = { shaking: W.fx.shaking, leaves: W.fx.leaves, puffs: W.fx.puffs }; S.settings.perf = 'balanced'; OC.App.applyPerf(); return r; });
      const rm = await page.evaluate(async () => { OC.World.reduce = true; await new Promise((r) => setTimeout(r, 300)); const W = OC.World, t = W.swayTargets().find((q) => q.x > 30 && q.x < 363 && q.y > 150 && q.y < 680); const s = W.shakeAt(t.x, t.y); W.shake(s); const r = { shaking: W.fx.shaking, leaves: W.fx.leaves, k: s.shake && s.shake.k }; OC.World.reduce = false; return r; });
      check('7e 省電模式沒有葉子和灰塵粒子（樹仍會晃）；減少動態時晃得很輕、也沒有粒子', lo.shaking >= 1 && lo.leaves === 0 && lo.puffs === 0 && rm.shaking >= 1 && rm.leaves === 0 && rm.k < 0.5, { lo, rm });
    }
    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.message)); }
  await browser.close();
  const n = H.results.filter((r) => r.ok).length; console.log(`\n${n}/${H.results.length} passed`);
})();
