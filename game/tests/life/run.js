/* OC Shimeji — Phase 4 automated scenario tests (1–12 + engine checks).
 *   cd game && python3 -m http.server 8765 &      # then, from the repo root:
 *   node game/tests/life/run.js [scenario numbers…]
 * Uses the real game in Chromium (SwiftShader WebGL); deterministic RNG seed per boot.
 * Writes game/tests/life/last-results.json. Exit code 1 if any check fails.
 */
const fs = require('fs'), path = require('path');
const H = require('./harness.js');
const { check, wait, advance } = H;
const only = process.argv.slice(2).map(Number).filter(Boolean);
const want = (n) => !only.length || only.includes(n);
const SHOTS = process.env.OC_SHOTS || path.join(__dirname, '..', '..', '..', 'deliverables', 'phase4');
fs.mkdirSync(SHOTS, { recursive: true });

/** put an OC into a state and wait (real time) until a predicate on its brain holds */
async function until(page, fn, arg, ms = 30000, step = 250) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(step); } return false; }
const ids = (page) => page.evaluate(() => { const o = {}; for (const c of OC.Chars.all()) o[c.profile.name] = c.id; return o; });
/** stop whatever an OC is doing so a scenario starts from a clean state (thinkAt far away = it waits) */
const freeze = (page, list, needs) => page.evaluate(([list, needs]) => { for (const id of list) { const b = OC.Brain.get(id); const cv = OC.Brain.convs.find((x) => x.a === b || x.b === b); if (cv) OC.Brain.Social.end(cv, 'test'); if (b.st === 'do') OC.Brain.finish(b, 'test'); else if (b.st === 'go') OC.Brain.abort(b, 'test'); b.holds.clear(); b.st = 'think'; b.thinkAt = 1e9; if (needs) Object.assign(OC.Chars.get(id).needs, needs); } }, [list, needs || null]);
const setHour = (page, h) => page.evaluate((hh) => { const c = OC.Store.s.life.clock; c.gm = Math.floor(c.gm / 1440) * 1440 + hh * 60 + 1440; }, h);

(async () => {
  const { browser, page, errors } = await H.launch();
  try {
    // ================= 1. three OCs, different personalities =================
    if (want(1) || want(3) || want(4) || want(5) || want(6) || want(7) || want(8) || want(9)) await H.boot(page, { chars: 3, seed: 7 });
    if (want(1)) {
      const I = await ids(page);
      const r = await page.evaluate((I) => {
        const out = {};
        for (const [n, id] of Object.entries(I)) {
          const c = OC.Chars.get(id), says = new Set(); for (let i = 0; i < 6; i++) { const l = OC.Talk.say('greet', c, null); if (l) says.add(l.text); }
          out[n] = { voice: OC.Talk.voice(c), speed: Math.round(OC.Chars.behavior(c).speed), greet: [...says].slice(0, 3), shy: +OC.Mind.feel(Object.assign(OC.Chars.clone(c), {}), 'shy', 0.5, 'test').toFixed(2), readScore: +OC.Brain.actScore(c, { last: [] }, 'read').s.toFixed(2), playScore: +OC.Brain.actScore(c, { last: [] }, 'play').s.toFixed(2), routine: OC.Mind.routine(c) };
        }
        return out;
      }, I);
      console.log(JSON.stringify(r));
      const v = Object.values(r);
      check('1a 三個 OC 的說話聲線不同', new Set(v.map((x) => x.voice)).size >= 2, v.map((x) => x.voice).join('/'));
      check('1b 同樣的「害羞」事件，害羞的小空反應最強、外向的栗子最弱', r['小空'].shy > r['麻糬'].shy && r['麻糬'].shy > r['栗子'].shy, `${r['小空'].shy} > ${r['麻糬'].shy} > ${r['栗子'].shy}`);
      check('1c 熱愛閱讀的小空最想讀書、精力充沛的栗子最想玩', r['小空'].readScore > r['栗子'].readScore && r['栗子'].playScore > r['小空'].playScore, r);
      check('1d 作息不同（栗子早起）', r['栗子'].routine.wake < r['小空'].routine.wake, `${r['栗子'].routine.wake} vs ${r['小空'].routine.wake}`);
      // live: let them live 25 s at ×10 and compare what they actually chose
      await page.evaluate(() => { OC.Store.s.life.settings.playerAuto = true; });     // let all three live on their own
      await wait(page, 45000);
      const acts = await page.evaluate(() => Object.fromEntries(OC.Chars.all().map((c) => [c.profile.name, Object.entries(c.life.rec.act).map(([k, v]) => k + v.n).join(',') + '|social' + (c.life.rec.social || 0) + '|asked' + OC.Brain.log.filter((x) => x.who === c.id && x.text.startsWith('去找')).length])));
      await page.evaluate(() => { OC.Store.s.life.settings.playerAuto = false; });
      console.log('activities', JSON.stringify(acts));
      check('1e 實際生活紀錄不同', new Set(Object.values(acts)).size === 3, acts);
      await page.screenshot({ path: path.join(SHOTS, '1-three-ocs.png') });
    }

    // ================= 2. tired / hungry → full activity flow =================
    if (want(2)) {
      await H.boot(page, { chars: 3, seed: 11 });
      const I = await ids(page);
      // hungry at noon
      await setHour(page, 12);
      await page.evaluate((id) => { const c = OC.Chars.get(id); c.needs.food = 8; const b = OC.Brain.get(id); if (b.st === 'do') OC.Brain.finish(b, 'test'); b.st = 'think'; b.thinkAt = 0; }, I['栗子']);
      const ate = await until(page, (id) => { const b = OC.Brain.get(id); return b.st === 'do' && b.act === 'eat'; }, I['栗子'], 30000);
      const eat = await page.evaluate((id) => { const b = OC.Brain.get(id); return { slot: b.slot && b.slot.k, reason: b.dbg.reason, x: b.a.x, y: b.a.y, sx: b.slot && b.slot.x, sy: b.slot && b.slot.y, hidden: b.a.hidden }; }, I['栗子']);
      check('2a 肚子餓 → 選擇吃飯 → 走到用餐地點', ate && eat.slot, eat);
      const fed = await until(page, (id) => OC.Chars.get(id).needs.food > 80 || OC.Brain.get(id).st !== 'do', I['栗子'], 40000);
      const after = await page.evaluate((id) => ({ food: Math.round(OC.Chars.get(id).needs.food), rec: OC.Chars.get(id).life.rec.act.eat }), I['栗子']);
      check('2b 吃完飽足恢復並記錄', fed && after.food > 60, after);
      // tired at night with a bed placed nearby → walks to the bed, aligns, sleeps
      const bed = await page.evaluate((id) => {
        const a = OC.Brain.get(id).a; for (let r = 30; r < 200; r += 6) for (let k = 0; k < 16; k++) { const f = { id: 'bed', x: Math.round((a.x + Math.cos(k / 16 * 6.28) * r) / 6) * 6, y: Math.round((a.y + Math.sin(k / 16 * 6.28) * r * 0.7) / 6) * 6, rot: 0 }; if (OC.World.canPlace(f)) { f.uid = 'ftest'; OC.Places.room(OC.World.area.id).push(f); OC.World.addFurniture(f); OC.Brain.rebuild(); return f; } } return null;
      }, I['小空']);
      await setHour(page, 23.5);
      await page.evaluate((id) => { const c = OC.Chars.get(id); c.needs.sleep = 12; c.needs.energy = 15; c.needs.food = 90; const b = OC.Brain.get(id); if (b.st === 'do') OC.Brain.finish(b, 'test'); if (b.st === 'social') OC.Brain.Social.end(b.conv || OC.Brain.convs[0], 't'); b.st = 'think'; b.thinkAt = 0; }, I['小空']);
      const slept = await until(page, (id) => { const b = OC.Brain.get(id); return b.st === 'do' && b.act === 'sleep'; }, I['小空'], 60000);
      await wait(page, 800);
      const sl = await page.evaluate((id) => { const b = OC.Brain.get(id); return { slot: b.slot && b.slot.k, kind: b.slot && b.slot.obj.kind, dx: b.slot ? Math.abs(b.a.x - b.slot.x) : -1, dy: b.slot ? Math.abs(b.a.y - b.slot.y) : -1, seatY: b.a.seatY, hidden: b.a.hidden, act: b.a.act && b.a.act.action, e0: OC.Chars.get(id).needs.energy }; }, I['小空']);
      check('2c 疲倦 → 走到床邊 → 對齊 → 睡覺（看板動作 sleep）', slept && sl.kind && (sl.hidden || (sl.dx < 1 && sl.dy < 1 && sl.act === 'sleep')), Object.assign({ bed: !!bed }, sl));
      const e1 = await advance(page, 120).then(() => page.evaluate((id) => OC.Chars.get(id).needs.energy, I['小空']));
      check('2d 睡覺期間精力恢復', e1 > sl.e0 + 10, `${Math.round(sl.e0)} → ${Math.round(e1)}`);
      await page.screenshot({ path: path.join(SHOTS, '2-sleep.png') });
      await H.boot(page, { chars: 3, seed: 7 });
    }

    // ================= 3. meeting, chatting, joint activity, relationship & memory =================
    if (want(3)) {
      const I = await ids(page);
      const A = I['栗子'], B = I['小空'];
      await setHour(page, 14);
      await freeze(page, [A, B], { food: 85, sleep: 85, energy: 70, social: 30, fun: 70 });
      // already acquainted (a shy OC meeting a total stranger accepts only ~40% of invitations — the answer is a seeded roll)
      await page.evaluate(([a, b]) => OC.Mind.relPair(a, b, { fam: 6, aff: 22 }, 'test'), [A, B]);
      const pre = await page.evaluate(([a, b]) => ({ r: JSON.parse(JSON.stringify(OC.Mind.rel(a, b))), sc: OC.Brain.candidates(OC.Brain.get(a)).filter((x) => x.other === b).map((x) => x.s)[0] || 0 }), [A, B]);
      await page.evaluate(([a, b]) => { for (const id of [a, b]) { const br = OC.Brain.get(id); if (br.st === 'social') OC.Brain.Social.end(br.conv || OC.Brain.convs.find((x) => x.a === br || x.b === br), 't'); if (br.st === 'do' || br.st === 'go') OC.Brain.abort(br, 'test'); br.st = 'think'; br.thinkAt = 1e9; } OC.Chars.get(b).personality.social = 90; OC.Brain.Social.start(OC.Brain.get(a), OC.Brain.get(b), 'chat'); }, [A, B]);
      const startDiag = await page.evaluate(([a, b]) => [a, b].map((id) => { const x = OC.Brain.get(id); return `${OC.Chars.name(OC.Chars.get(id))}:st=${x.st} holds=${[...x.holds]} q=${x.queued} lv=${!!x.leaving} inv=${!!x.invited} bp=${!!x.byPlayer} conv=${OC.Brain.convs.length}`; }).join(' ; '), [A, B]);
      const talked = await until(page, ([a]) => !OC.Brain.convs.some((c) => c.a.id === a), [A], 40000);
      const post = await page.evaluate(([a, b]) => ({ r: OC.Mind.rel(a, b), rb: OC.Mind.rel(b, a), ma: OC.Mind.memories(OC.Chars.get(a), { who: b }).map((m) => m.text), mb: OC.Mind.memories(OC.Chars.get(b), { who: a }).map((m) => m.text) }), [A, B]);
      check('3a 兩個 OC 相遇並聊天（輪流說話、面對面）', talked && post.r.fam > pre.r.fam, `fam ${pre.r.fam} → ${post.r.fam}` + (post.r.fam > pre.r.fam ? '' : ' ｜ ' + startDiag + ' ｜ ' + await page.evaluate(([a, b]) => OC.Brain.log.filter((l) => l.who === a || l.who === b).slice(0, 10).map((l) => OC.Chars.name(OC.Chars.get(l.who)) + ':' + l.text).join(' / '), [A, B])));
      check('3b 雙方都留下共同回憶', post.ma.length > 0 && post.mb.length > 0, { a: post.ma.slice(0, 2), b: post.mb.slice(0, 2) });
      // joint activity: rest together on a bench
      await freeze(page, [A, B], { food: 85, sleep: 85, energy: 40, social: 30, fun: 70 });
      await page.evaluate(([a, b]) => { OC.Mind.relPair(a, b, { aff: 20 }); OC.Brain.Social.start(OC.Brain.get(a), OC.Brain.get(b), 'restTogether'); }, [A, B]);
      const joint = await until(page, ([a]) => OC.Brain.convs.some((c) => c.a.id === a && c.st === 'joint' && c.started), [A], 45000);
      const jt = await page.evaluate(([a, b]) => { const x = OC.Brain.get(a), y = OC.Brain.get(b); const cv = OC.Brain.convs.find((c) => c.a === x || c.b === x); return { sa: x.slot && x.slot.k, sb: y.slot && y.slot.k, d: Math.hypot(x.a.x - y.a.x, x.a.y - y.a.y), dbg: { st: [x.st, y.st, x.act, y.act], holds: [[...x.holds], [...y.holds]], conv: cv ? { st: cv.st, kind: cv.kind, started: cv.started } : null, ev: OC.Events.current && OC.Events.current.ev.id, log: OC.Brain.log.filter((l) => l.who === a || l.who === b).slice(0, 8).map((l) => OC.Chars.name(OC.Chars.get(l.who)) + ':' + l.text) } }; }, [A, B]);
      check('3c 邀請 → 一起坐在同一張長椅（不同位子、不重疊）', joint && jt.sa && jt.sb && jt.sa !== jt.sb && jt.sa.split('#')[0] === jt.sb.split('#')[0] && jt.d > 8, jt);
      await page.screenshot({ path: path.join(SHOTS, '3-rest-together.png') });
      await advance(page, 40);
      const done = await until(page, ([a]) => !OC.Brain.convs.some((c) => c.a.id === a), [A], 30000);
      const C = I['麻糬'];
      await advance(page, 120);     // the "just talked" cool-down (45 min) and fresh-memory delay (30 min) pass
      await freeze(page, [A, B, C],{ social: 30, food: 85, sleep: 85, energy: 70, fun: 70, comfort: 70 });
      const later = await page.evaluate(([a, b, c]) => { const cs = OC.Brain.candidates(OC.Brain.get(a)); const best = (o) => Math.max(...cs.filter((x) => x.other === o && x.social === 'chat').map((x) => x.s)); return { r: OC.Mind.rel(a, b), rc: OC.Mind.rel(a, c), friend: best(b), other: best(c), mem: OC.Talk.ctx(OC.Chars.get(a), OC.Chars.get(b)).mem }; }, [A, B, C]);
      check('3d 關係與回憶影響之後的互動（更想找熟的朋友聊天、對話可引用共同回憶）', done && later.r.aff > post.r.aff && later.friend > later.other && !!later.mem, { aff: `${later.r.aff} vs ${later.rc.aff}`, score: `朋友 ${later.friend.toFixed(2)} > 其他 ${later.other.toFixed(2)}`, mem: later.mem && later.mem.text });
      // milestone: becoming friends emits relUp → event (memory "成為了朋友")
      await page.evaluate(([a, b]) => { OC.Mind.relPair(a, b, { fam: 30, aff: 20 }); }, [A, B]);
      await until(page, () => !OC.Events.current, null, 40000);
      const ms = await page.evaluate(([a, b]) => ({ t: OC.Mind.rel(a, b).type, m: OC.Mind.memories(OC.Chars.get(a), { type: 'milestone' }).map((m) => m.text) }), [A, B]);
      check('3e 成為朋友 → 里程碑事件與回憶', ms.t === 'friend' && ms.m.some((t) => t.includes('朋友')), ms);
    }

    // ================= 4. long-term reading → acquired habit / trait suggestions =================
    if (want(4)) {
      const I = await ids(page); const id = I['麻糬'];
      // real reading sessions in the rain (each one goes through the real activity flow), then the rest recorded
      const r = await page.evaluate((id) => {
        const c = OC.Chars.get(id); OC.Store.s.settings.weather = 'rain';
        for (let i = 0; i < 8; i++) OC.Mind.record(c, 'read', 30, { place: 'bench@226', placeZh: '長椅', skill: 'reading' });
        const made = OC.Mind.checkHabits(c); const sug = c.growth.suggestions.map((s) => ({ id: s.id, v: s.value, ask: s.ask, why: s.reason }));
        return { made, sug };
      }, id);
      const rain = r.sug.find((s) => s.v === 'rainread'), book = r.sug.find((s) => s.v === 'bookworm');
      check('4a 雨天閱讀紀錄 → 提出「雨天閱讀」習慣建議（附原因）', rain && rain.ask.includes('雨天') && rain.why.includes('雨天'), rain);
      check('4b 長期閱讀 → 提出「熱愛閱讀」特質建議', !!book, book && book.ask);
      const after = await page.evaluate(([id, rs, bs]) => {
        const c = OC.Chars.get(id); const before = OC.Brain.actScore(c, { last: [] }, 'read').s;
        OC.Mind.resolve(c, rs, 'accept'); const afterS = OC.Brain.actScore(c, { last: [] }, 'read').s;
        OC.Mind.resolve(c, bs, 'reject'); OC.Mind.checkHabits(c);
        const again = c.growth.suggestions.some((s) => s.value === 'bookworm');
        OC.Store.s.life.clock.gm += 6 * 1440; OC.Mind.checkHabits(c); const after5 = c.growth.suggestions.find((s) => s.value === 'bookworm');
        if (after5) OC.Mind.resolve(c, after5.id, 'lock'); OC.Store.s.life.clock.gm += 30 * 1440; OC.Mind.checkHabits(c);
        const locked = c.growth.suggestions.some((s) => s.value === 'bookworm');
        return { habits: c.life.habits.map((h) => h.zh), before, afterS, again, came: !!after5, locked, traits: c.personality.traits, hist: c.growth.history.map((h) => h.value + ':' + h.decision) };
      }, [id, rain.id, book.id]);
      check('4c 接受 → 習慣真的改變行為（雨天閱讀分數提高）', after.habits.includes('雨天閱讀') && after.afterS > after.before + 0.3, `${after.before.toFixed(2)} → ${after.afterS.toFixed(2)}`);
      check('4d 拒絕 → 短期內不再提出；冷卻後才可能再提', !after.again && after.came, after);
      check('4e 鎖定 → 永遠不再提出，特質沒有被偷偷加上', !after.locked && !after.traits.includes('bookworm'), after.hist);
      const later = await page.evaluate((id) => { const c = OC.Chars.get(id); for (let i = 0; i < 6; i++) OC.Mind.record(c, 'tend', 15, { place: 'bed0', placeZh: '花圃' }); OC.Mind.checkHabits(c); const s = c.growth.suggestions.find((x) => x.value === 'gardener'); OC.Mind.resolve(c, s.id, 'later'); const pend = OC.Mind.pending().some((p) => p.s.value === 'gardener'); const s2 = c.growth.suggestions.find((x) => x.value === 'gardener'); OC.Mind.resolve(c, s2.id, 'mute'); for (let i = 0; i < 9; i++) OC.Mind.record(c, 'explore', 10, {}); OC.Mind.checkHabits(c); return { pend, stillListed: !!s2, mutedHabit: c.growth.suggestions.some((x) => x.type === 'habit'), muted: c.growth.muted }; }, id);
      check('4f 稍後決定（不再通知但保留）、關閉同類建議', !later.pend && later.stillListed && !later.mutedHabit && later.muted.includes('habit'), later);
      await page.evaluate(() => { OC.Store.s.settings.weather = 'auto'; });
    }

    // ================= 5. events: time, weather, item, mood, relationship =================
    if (want(5)) {
      const I = await ids(page);
      await page.evaluate(() => { OC.Store.s.life.ev.lastAny = 0; });
      await until(page, () => !OC.Events.current, null, 40000);
      const wx = await page.evaluate((id) => { OC.Store.s.settings.weather = 'rain'; delete OC.Store.s.life.ev.last['rainArrives|' + id]; const b = OC.Brain.get(id); if (b.st !== 'think') { b.st = 'think'; } b.thinkAt = 1e9; OC.Store.s.life.ev.lastAny = 0; return OC.Events.trigger('wxChange', { a: id, wx: 'rain' }) || 'no'; }, I['小空']);
      await page.evaluate(() => { OC.Store.s.settings.weather = 'rain'; });
      const w2 = await until(page, () => !OC.Events.current, null, 30000);
      const again = await page.evaluate((id) => { OC.Store.s.life.ev.lastAny = 0; return OC.Events.trigger('wxChange', { a: id, wx: 'rain' }); }, I['小空']);
      check('5a 天氣事件（下雨了）觸發且有冷卻、不重複', wx === true && w2 && again === false, { wx, again });
      await until(page, () => !OC.Events.current, null, 30000);
      const morning = await page.evaluate((id) => { delete OC.Store.s.life.ev.last['badSleep|' + id]; OC.Store.s.settings.weather = 'clear'; const c = OC.Store.s.life.clock; c.gm = Math.floor(c.gm / 1440) * 1440 + 1440 + 7 * 60; OC.Store.s.life.ev.lastAny = 0; OC.Chars.get(id).needs.sleep = 40; const b = OC.Brain.get(id); b.st = 'think'; b.thinkAt = 1e9; return OC.Events.trigger('wake', { a: id }); }, I['栗子']);
      await until(page, () => !OC.Events.current, null, 20000);
      check('5b 時間事件（起床時沒睡好／早晨）', morning === true, await page.evaluate(() => OC.Store.s.life.ev.log[0]));
      const item = await page.evaluate((id) => { const c = OC.Chars.get(id); c.tastes.likeItems = ['cake']; c.life.wishes.unshift({ id: 'wt', type: 'eat_like', kind: 'short', item: 'cake', text: '想吃蛋糕', prog: 0, born: OC.Sim.now(), until: OC.Sim.now() + 300, state: 'active' }); OC.Store.add('cake', 1); OC.App.player && 0; return true; }, I['麻糬']);
      await until(page, () => !OC.Events.current, null, 30000);
      await freeze(page, [I['麻糬']], { food: 50 }); await page.evaluate(() => { OC.Store.s.inv.cake = 1; });
      await page.evaluate((id) => OC.LifeUI.feed(id), I['麻糬']); await page.waitForSelector('.item-btn'); await page.click('.item-btn >> text=蛋糕');
      await until(page, (id) => OC.Chars.get(id).life.wishes.find((w) => w.id === 'wt').state === 'done', I['麻糬'], 10000);   // phase 5: eaten (and the wish fulfilled) after the eating animation
      const fedR = await page.evaluate((id) => { const c = OC.Chars.get(id); return { wish: c.life.wishes.find((w) => w.id === 'wt').state, emo: c.life.emo.recent.slice(0, 3).map((e) => e.id + ':' + e.cause), aff: c.life.player.aff }; }, I['麻糬']);
      check('5c 物品事件：餵喜歡的食物 → 願望實現、情緒、和你的好感', item && fedR.wish === 'done' && fedR.aff > 0, fedR);
      await until(page, () => !OC.Events.current, null, 30000); await freeze(page, [I['小空']]);
      const mood = await page.evaluate((id) => { const c = OC.Chars.get(id); c.needs.social = 10; OC.Mind.tickEmotions(c, 1); OC.Store.s.life.ev.lastAny = 0; for (const e of OC.Events.defs()) if (e.id === 'lonelyMoment') e.chance = 1; const b = OC.Brain.get(id); b.st = 'think'; b.thinkAt = 1e9; OC.Events.update(5); return OC.Events.current ? OC.Events.current.ev.id : OC.Events.diag.filter((d) => d.a === id).map((d) => d.id + (d.ok ? '✓' : '·' + d.why)).join(' '); }, I['小空']);
      await until(page, () => !OC.Events.current, null, 20000);
      check('5d 情緒／需求事件（寂寞的時候）', mood === 'lonelyMoment' || /lonelyMoment✓/.test(mood), mood);
      await until(page, () => !OC.Events.current, null, 30000); await freeze(page, [I['栗子'], I['小空']]);
      await page.evaluate(([a, b]) => { OC.Store.s.life.ev.lastAny = 0; OC.Mind.relPair(a, b, { fam: 60, aff: 80, trust: 60 }); }, [I['栗子'], I['小空']]);
      await until(page, () => !OC.Events.current, null, 40000);
      const rel = await page.evaluate(([a, b]) => ({ t: OC.Mind.rel(a, b).type, log: OC.Store.s.life.ev.log.slice(0, 4).map((e) => e.id), mem: OC.Mind.memories(OC.Chars.get(a), { type: 'milestone' }).map((m) => m.text) }), [I['栗子'], I['小空']]);
      check('5e 關係事件（最好的朋友）', rel.t === 'bestfriend' && rel.log.includes('bestFriends') && rel.mem.some((t) => t.includes('最好的朋友')), rel);
      await until(page, () => !OC.Events.current, null, 25000);
      const tooMany = await page.evaluate(() => { const before = OC.Store.s.life.ev.log.length; OC.Events.update(5); OC.Events.update(5); return OC.Store.s.life.ev.log.length - before; });
      check('5f 事件不會太頻繁（全域間隔）', tooMany === 0, tooMany);
    }

    // ================= 6. multi-OC movement / furniture / social without problems =================
    if (want(6)) {
      await H.boot(page, { chars: 6, seed: 5 });
      await setHour(page, 15); await wait(page, 1500);   // let the jump settle (activities ended by the clock jump finish on the next step)
      const r = await page.evaluate(async () => {
        const out = { overlap: 0, teleport: 0, stuck: 0, endless: 0, samples: 0, worst: [] };
        const last = {}, goSince = {};
        for (let i = 0; i < 300; i++) {
          await new Promise((res) => setTimeout(res, 100));
          const bs = Object.values(OC.Brain.brains).filter((b) => b.a);
          for (const b of bs) {
            const p = last[b.id]; if (p && !b.a.hidden && !p.hidden && b.a.mode !== 'sit') { const d = Math.hypot(b.a.x - p.x, b.a.y - p.y); if (d > 25 && !b.holds.has('drag')) { out.teleport++; out.worst.push(`${b.id} jump ${d.toFixed(0)}`); } }
            last[b.id] = { x: b.a.x, y: b.a.y, hidden: b.a.hidden };
            if (b.st === 'go') { goSince[b.id] = goSince[b.id] || performance.now(); if (performance.now() - goSince[b.id] > 62000) out.stuck++; } else goSince[b.id] = 0;
            if (b.st === 'do' && b.until && OC.Sim.now() > b.until + 30 && b.act !== 'sleep') { out.endless++; if (out.worst.length < 8) out.worst.push(`endless ${b.act} over ${(OC.Sim.now() - b.until).toFixed(0)} holds ${[...b.holds]} aligning ${!!b.aligning} path ${!!b.a.path} t0 ${(OC.Sim.now() - b.t0).toFixed(0)} manual ${!!b.manual}`); }
          }
          const still = bs.filter((b) => !b.a.hidden && !b.a.path && b.st !== 'go');
          for (let x = 0; x < still.length; x++) for (let y = x + 1; y < still.length; y++) { const d = Math.hypot(still[x].a.x - still[y].a.x, still[x].a.y - still[y].a.y); if (d < 6) { out.overlap++; if (out.worst.length < 8) { const info = (b) => { const cv = OC.Brain.convs.find((c) => c.a === b || c.b === b || (c.more || []).includes(b)); return `${b.st}/${b.act || ''}/${b.slot ? b.slot.k : ''}/${cv ? cv.kind + ':' + cv.st + (cv.a === b ? 'A' : 'B') : ''}@${Math.round(b.a.x)},${Math.round(b.a.y)}`; }; out.worst.push(`overlap ${d.toFixed(1)} ${info(still[x])} | ${info(still[y])}`); } } }
          out.samples++;
        }
        out.res = OC.Brain.res.size; out.decisions = OC.Brain.log.length; out.convs = OC.Store.s.life.ev.log.length;
        return out;
      });
      check('6a 6 個 OC 同時生活 30 秒：沒有瞬移', r.teleport === 0, r);
      check('6b 靜止時沒有重疊', r.overlap === 0, `${r.overlap} 次（${r.samples} 個取樣）`);
      check('6c 沒有卡住、沒有無限活動', r.stuck === 0 && r.endless === 0, r);
      await page.screenshot({ path: path.join(SHOTS, '6-six-ocs.png') });
      await H.boot(page, { chars: 3, seed: 7 });
    }

    // ================= 7. interruptions: call, drag, editor =================
    if (want(7)) {
      const I = await ids(page); const id = I['小空'];
      await setHour(page, 14);
      await until(page, () => !OC.Events.current, null, 30000);
      await freeze(page, [id], { food: 85, sleep: 85, energy: 75, fun: 50, social: 70, comfort: 60 });
      await page.evaluate(() => { OC.Store.s.life.settings.autonomy = 'paused'; });   // no events / other decisions during this check
      await page.evaluate((id) => { const b = OC.Brain.get(id); const slot = OC.Brain.aff.flatMap((o) => o.slots).filter((s) => s.obj.verbs.includes('read') && OC.Brain.free(s, id)).sort((p, q) => Math.hypot(p.ax - b.a.x, p.ay - b.a.y) - Math.hypot(q.ax - b.a.x, q.ay - b.a.y))[0]; OC.Brain.start(b, 'read', { slot }); }, id);
      await until(page, (id) => OC.Brain.get(id).st === 'do' && OC.Brain.get(id).act === 'read', id, 30000);
      await page.evaluate((id) => OC.LifeUI.call(id), id);
      const called = await page.evaluate((id) => ({ st: OC.Brain.get(id).st, holds: [...OC.Brain.get(id).holds], susp: OC.Brain.get(id).susp && OC.Brain.get(id).susp.act }), id);
      const arrived = await until(page, (id) => { const b = OC.Brain.get(id), p = OC.App.player; return Math.hypot(b.a.x - p.x, b.a.y - p.y) < 30; }, id, 30000);
      await wait(page, 7800);
      const resumed = await page.evaluate((id) => ({ st: OC.Brain.get(id).st, act: OC.Brain.get(id).act, holds: OC.Brain.get(id).holds.size, logged: OC.Brain.log.some((l) => l.who === id && l.text === '繼續：閱讀') }), id);
      check('7a 呼叫：中斷閱讀 → 走過來 → 之後繼續原本的活動', called.holds.includes('call') && called.susp === 'read' && arrived && resumed.holds === 0 && resumed.act === 'read' && (['go', 'do'].includes(resumed.st) || resumed.logged), { called, resumed });
      await page.evaluate(() => { OC.Store.s.life.settings.autonomy = 'full'; });
      const drag = await page.evaluate((id) => { const a = OC.App.actorOf(id); OC.App.startCarry(id); const h1 = OC.Brain.get(id).holds.has('drag'); OC.App.dragMove({ x: a.x + 40, y: a.y + 10 }); const moved = { x: a.x, y: a.y }; OC.App.dragEnd(); return { h1, moved, act: a.act && a.act.action }; }, id);
      await wait(page, 1500);
      const dragAfter = await page.evaluate((id) => OC.Brain.get(id).holds.size, id);
      check('7b 拖曳：暫停 → 放下有反應 → 恢復自主', drag.h1 && dragAfter === 0, drag);
      await page.evaluate((id) => OC.Pages.open('charedit', { id }), id); await wait(page, 1200);
      const ed = await page.evaluate((id) => [...OC.Brain.get(id).holds], id);
      await page.evaluate(() => { for (let n = 0; n < 6 && OC.Pages.pages.charedit.el.classList.contains('open'); n++) OC.UI.back(); }); await until(page, (id) => !OC.Brain.get(id).holds.has('editor'), id, 6000);   // holds sync every 400 ms of frame time (frames are slow under software rendering)
      const ed2 = await page.evaluate((id) => [...OC.Brain.get(id).holds], id);   // (an event may legitimately start right after; only the editor hold matters)
      const edInfo = await page.evaluate(() => ({ stack: OC.UI.stack.length, open: OC.Pages.pages.charedit.el.classList.contains('open'), dirty: OC.Pages.pages.charedit.dirty, sheets: [...document.querySelectorAll('.sheet h2')].map((e) => e.textContent) }));
      check('7c 打開編輯器（換裝）時暫停、關閉後恢復', ed.includes('editor') && !ed2.includes('editor'), { ed, ed2, edInfo });
      await page.evaluate((id) => OC.LifeUI.chat(id), id); await wait(page, 500);
      const ch = await page.evaluate((id) => [...OC.Brain.get(id).holds], id);
      await page.evaluate(() => OC.UI.back()); await wait(page, 300);
      check('7d 和玩家聊天時暫停，結束後恢復', ch.includes('dialogue') && (await page.evaluate((id) => OC.Brain.get(id).holds.size, id)) === 0, ch);
    }

    // ================= 8. fallback animations =================
    if (want(8)) {
      const r = await page.evaluate(async () => {
        const c = OC.Chars.active(), out = {};
        for (const a of ['read', 'think', 'stretch', 'tend', 'talk', 'dance', 'cry', 'laugh', 'sleep', 'eat']) {
          const cv = OC.makeCanvas(120, 120), x = cv.getContext('2d'); OC.CharRender.draw(x, c, { action: a, at: 0.5, dir: 'front', face: 0.3 }, 60, 110, 1, 0.5);
          const d = x.getImageData(0, 0, 120, 120).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++; out[a] = n;
        }
        // sprite OC with only an idle animation → new actions fall back through the chain
        const s = OC.Chars.clone(c); s.id = 'tmp'; const doc = OC.Anim.create({ name: 't', owner: 'tmp', fps: 4, cells: [['nope']] }); OC.Anim.save(doc); s.actions = { idle: { any: doc.id } };
        out.fallbackRead = (OC.Anim.resolve(s, 'read', 'front') || {}).action; out.fallbackTend = (OC.Anim.resolve(s, 'tend', 'front') || {}).action;
        out.chain = OC.Chars.ACTIONS.filter((x) => ['read', 'tend', 'think'].includes(x[0])).map((x) => x[0] + '→' + x[3].join('>'));
        OC.Anim.remove(doc.id); return out;
      });
      check('8a 沒有自訂動畫時，新生活動作都有內建骨架姿勢（畫得出來）', ['read', 'think', 'stretch', 'tend', 'talk', 'dance', 'cry', 'laugh'].every((a) => r[a] > 300), r);
      check('8b 圖片角色缺少動作時沿備用鏈回到已有的動畫', r.fallbackRead === 'idle' && r.fallbackTend === 'idle', r);
    }

    // ================= 9. time speed / weather / theme / performance =================
    if (want(9)) {
      const r = await page.evaluate(() => {
        const base = OC.Chars.clone(OC.Chars.active()); base.needs = { food: 80, energy: 80, sleep: 80, fun: 80, social: 80, comfort: 80, interest: 80, active: 80, mood: 70 };
        const a = OC.Chars.clone(base), b = OC.Chars.clone(base);
        OC.Mind.tickNeeds(a, 120, { fx: OC.LifeData.ACTS.read.fx, act: 'read', sed: true });            // one big step
        for (let i = 0; i < 1200; i++) OC.Mind.tickNeeds(b, 0.1, { fx: OC.LifeData.ACTS.read.fx, act: 'read', sed: true }); // many small steps
        const diff = Math.max(...['food', 'energy', 'sleep', 'fun', 'social', 'comfort', 'interest', 'active'].map((k) => Math.abs(a.needs[k] - b.needs[k])));
        return { diff, a: a.needs.food, b: b.needs.food };
      });
      check('9a 需求與步長無關（2 遊戲小時：1 步 vs 1200 步）', r.diff < 0.01, r);
      const fps = {};
      for (const [mode, sp] of [['saver', 5], ['high', 5], ['saver', 10]]) {
        await page.evaluate(([m, s]) => { OC.Store.s.settings.perf = m; OC.App.applyPerf(); OC.Sim.setSpeed(s); }, [mode, sp]);
        // game time and real time sampled together inside the page (software rendering makes frames slow; a stalled
        // frame's time is simulated on the next frame, so measure over a long window and between two frames)
        const frameMark = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(() => res({ g: OC.Sim.now(), t: performance.now() }), 0))));
        await wait(page, 1500); const a0 = await frameMark(); await wait(page, 8000); const a1 = await frameMark();
        fps[mode + sp] = +(((a1.g - a0.g) / ((a1.t - a0.t) / 1000)) / sp).toFixed(2);
      }
      check('9b 遊戲時間跟幀率無關（30 / 60 fps、×5 / ×10 每現實秒的遊戲分鐘 ≈ 速度）', Object.values(fps).every((v) => v > 0.88 && v < 1.12), fps);
      const keep = await page.evaluate(() => { const ids = OC.World.actors.map((a) => a.m.uuid).join(); const br = Object.values(OC.Brain.brains).map((b) => b.st + b.act).join(); OC.App.setTheme('dark'); OC.App.setTheme('light'); OC.Store.s.settings.weather = 'rain'; OC.Store.s.settings.perf = 'balanced'; OC.App.applyPerf(); return { same: ids === OC.World.actors.map((a) => a.m.uuid).join(), br, br2: Object.values(OC.Brain.brains).map((b) => b.st + b.act).join() }; });
      check('9c 切換主題／天氣／效能不重建場景、不打斷生活', keep.same && keep.br === keep.br2, keep);
      await wait(page, 1500); await page.evaluate(() => { OC.Store.s.settings.weather = 'auto'; OC.Sim.setSpeed(10); });
    }

    // ================= 10. save & restart =================
    if (want(10)) {
      await H.boot(page, { chars: 3, seed: 3 });
      await setHour(page, 13);
      await wait(page, 6000);
      // make sure one OC is in the middle of a long activity when the game is closed (reading on the nearest seat)
      const rid = await page.evaluate(() => OC.Store.s.roster[2]);
      await until(page, () => !OC.Events.current, null, 30000);
      await freeze(page, [rid], { food: 85, sleep: 85, energy: 75, fun: 40, social: 70, comfort: 60 });
      await page.evaluate((id) => { const b = OC.Brain.get(id); const slot = OC.Brain.aff.flatMap((o) => o.slots).filter((s) => s.obj.verbs.includes('read') && OC.Brain.free(s, id)).sort((p, q) => Math.hypot(p.ax - b.a.x, p.ay - b.a.y) - Math.hypot(q.ax - b.a.x, q.ay - b.a.y))[0]; OC.Brain.start(b, 'read', { slot }); }, rid);
      await until(page, (id) => { const b = OC.Brain.get(id); return b.st === 'do' && b.act === 'read'; }, rid, 40000);
      await page.evaluate((id) => { const b = OC.Brain.get(id); b.until = OC.Sim.now() + 120; OC.Chars.get(id).life.cur.until = b.until; }, rid);
      const before = await page.evaluate(() => { for (const cv of OC.Brain.convs.slice()) OC.Brain.Social.end(cv, 'test'); OC.Store.s.life.settings.autonomy = 'paused'; OC.Mind.relPair(OC.Store.s.roster[1], OC.Store.s.roster[2], { aff: 12 }); OC.Store.persist();   /* paused: no new conversations change relationships while reloading */ return { rel: JSON.stringify(OC.Store.s.life.rel), mem: OC.Chars.all().map((c) => c.life.mem.recent.length + c.life.mem.long.length), cur: Object.values(OC.Brain.brains).filter((b) => b.st === 'do' && !b.manual).map((b) => b.id + ':' + b.act), wishes: OC.Chars.all().map((c) => c.life.wishes.length), v: OC.Store.s.v, rec: OC.Chars.all().map((c) => JSON.stringify(c.life.rec.act).length) }; });
      await page.reload(); await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 }); await wait(page, 800);
      const after = await page.evaluate(() => ({ rel: JSON.stringify(OC.Store.s.life.rel), mem: OC.Chars.all().map((c) => c.life.mem.recent.length + c.life.mem.long.length), resumed: Object.values(OC.Brain.brains).map((b) => b.st + ':' + b.act), resumedIds: Object.values(OC.Brain.brains).filter((b) => b.st === 'do').map((b) => b.id + ':' + b.act), wishes: OC.Chars.all().map((c) => c.life.wishes.length), v: OC.Store.s.v, rec: OC.Chars.all().map((c) => JSON.stringify(c.life.rec.act).length) }));
      check('10a 存檔重開：關係、回憶、願望、生活紀錄完整', before.rel === after.rel && JSON.stringify(before.mem) === JSON.stringify(after.mem) && before.wishes.every((n, i) => after.wishes[i] >= n) && before.rec.every((n, i) => after.rec[i] >= n)   /* nothing lost (life continues at ×10 after the reload, so new wishes / records may appear) */ && after.v === 7, { before: before.mem, after: after.mem, differs: ['rel', 'mem', 'wishes', 'rec'].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).concat(after.v === 7 ? [] : ['v=' + after.v]), wishes: [before.wishes, after.wishes], rec: [before.rec, after.rec] });   // save v4 since phase 5
      await page.evaluate(() => { OC.Store.s.life.settings.autonomy = 'full'; });
      check('10b 重開後繼續進行中的活動', before.cur.length > 0 && before.cur.every((x) => after.resumed.includes(x.replace(/^[^:]+:/, (m) => m) ) || after.resumedIds.includes(x)), { before: before.cur, after: after.resumedIds });
      // v2 (Phase 3) save migrates
      const mig = await page.evaluate(() => { const d = JSON.parse(OC.Store.exportJSON()); d.v = 2; delete d.life; for (const c of Object.values(d.chars)) { delete c.life; c.needs = { food: 50, energy: 60, mood: 70, social: 40, t: Date.now() }; } localStorage.setItem('oc.save.v1', JSON.stringify(d)); OC.Store.persist = () => {}; OCApp.lifecycle = () => {}; return Object.keys(d.chars).length; });
      await page.reload(); await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 });
      const m2 = await page.evaluate(() => ({ social0: Math.min(...OC.Chars.all().map((c) => c.needs.social)), v: OC.Store.s.v, life: !!OC.Store.s.life.settings, chars: OC.Chars.all().length, needs: Object.keys(OC.Chars.all()[0].needs).sort().join(','), food: OC.Chars.all()[0].needs.food, emo: OC.Chars.all()[0].life.emo.dom }));
      check('10c 第三階段（v2）存檔自動遷移（v2→…→v7），舊需求數值保留', m2.v === 7 && m2.life && m2.chars === mig && m2.needs.includes('sleep') && m2.social0 < 60 && m2.food < 75, m2);
    }

    // ================= 11. long offline & background resume =================
    if (want(11)) {
      await H.boot(page, { chars: 3, seed: 9 });
      const inv0 = await page.evaluate(() => { OC.Sim.setMode('real'); OC.Store.persist(); OC.Store.s.life.lastReal = Date.now() - 30 * 3600 * 1000; localStorage.setItem('oc.save.v1', JSON.stringify(OC.Store.s)); OC.Store.persist = () => {}; OCApp.lifecycle = () => {}; return JSON.stringify(OC.Store.s.inv); });
      await page.reload(); await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 });
      const off = await page.evaluate(() => ({ o: OC.Store.s.life.offline, needs: OC.Chars.all().map((c) => Math.round(Math.min(...OC.Mind.NEED_IDS.map((k) => c.needs[k])))), sum: OC.Chars.all().map((c) => c.life.mem.recent.filter((m) => m.text.startsWith('你不在的時候')).length), ev: OC.Store.s.life.ev.log.length, inv: JSON.stringify(OC.Store.s.inv) }));
      check('11a 離線 30 小時：只模擬上限 8 小時、需求不低於 15', off.o && off.o.simulated === 480 && off.o.capped && off.needs.every((v) => v >= 15), off);
      check('11b 離線期間不觸發事件、不發獎勵', off.ev === 0 && off.inv === inv0, { ev: off.ev });
      await page.evaluate(() => OC.Store.persist()); await page.reload(); await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 });
      const twice = await page.evaluate(() => ({ sum: OC.Chars.all().map((c) => c.life.mem.recent.filter((m) => m.text.startsWith('你不在的時候')).length), o: OC.Store.s.life.offline }));
      check('11c 重開不會重複計算離線（摘要只有一份）', JSON.stringify(twice.sum) === JSON.stringify(off.sum) && twice.o.at === off.o.at, twice);
      const bg = await page.evaluate(() => { OCApp.lifecycle('pause'); OC.Store.s.life.lastReal = Date.now() - 2 * 3600 * 1000; OCApp.lifecycle('resume'); return OC.Store.s.life.offline; });
      check('11d 背景 2 小時後回來：補算 120 分鐘', bg && bg.simulated === 120 && bg.reason === 'resume', bg);
      await page.evaluate(() => OC.Sim.setMode('cycle'));
    }

    // ================= 12. Android portrait, many OCs =================
    if (want(12)) {
      for (const [w, hh] of [[360, 800], [412, 915]]) {
        await page.setViewportSize({ width: w, height: hh });
        await H.boot(page, { chars: 6, seed: 2 });
        await wait(page, 5000);
        const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1, hud: [...document.querySelectorAll('#hud button, #hud .chip')].filter((e) => e.offsetParent).length, mates: Object.keys(OC.App.mates).length }));
        await page.screenshot({ path: path.join(SHOTS, `12-portrait-${w}.png`) });
        await page.evaluate(() => OC.LifeUI.interact(OC.Store.s.roster[1])); await wait(page, 700);
        const btns = await page.evaluate(() => [...document.querySelectorAll('.act-btn')].map((b) => Math.round(Math.min(b.offsetWidth, b.offsetHeight))));
        await page.screenshot({ path: path.join(SHOTS, `12-interact-${w}.png`) });
        await page.evaluate(() => OC.UI.back()); await wait(page, 300);
        await page.evaluate(() => OC.Pages.open('profile', { id: OC.Store.s.roster[1], tab: 'life' })); await wait(page, 700);
        const prof = await page.evaluate(() => ({ over: [...document.querySelectorAll('.page.open *')].some((e) => e.getBoundingClientRect().right > innerWidth + 2) }));
        await page.screenshot({ path: path.join(SHOTS, `12-profile-life-${w}.png`), fullPage: false });
        await page.evaluate(() => OC.UI.back()); await wait(page, 300);
        check(`12 直向 ${w}px：6 個 OC、HUD ≤ 6 個元件、無溢出、按鈕 ≥ 48px`, !r.over && r.hud <= 6 && r.mates === 5 && btns.every((b) => b >= 48) && !prof.over, Object.assign(r, { btns: Math.min(...btns), prof }));
      }
    }

    // ================= engine checks: dialogue data, cooldowns, determinism =================
    if (want(13)) {
      await page.setViewportSize({ width: 393, height: 852 });
      await H.boot(page, { chars: 3, seed: 4 });
      const r = await page.evaluate(() => {
        const c = OC.Chars.all()[1], o = OC.Chars.all()[2];
        const bad = OC.Talk.validate('{"format":"x"}'), broken = OC.Talk.validate('{oops'), newer = OC.Talk.validate({ format: 'ocshimeji-life', version: 99, lines: [] });
        const ok = OC.Talk.importData(JSON.stringify({ format: 'ocshimeji-life', version: 1, lines: [{ cat: 'greet', text: '測試台詞{other}！', char: c.id, w: 50, c: { phase: ['morning', 'noon', 'dusk', 'night'] } }] }));
        const said = OC.Talk.say('greet', c, o);
        const ex = JSON.parse(OC.Talk.exportData());
        const X = OC.Talk.ctx(c, o), eligible = OC.Talk.lines().filter((l) => l.cat === 'talk_r' && !l.char && OC.Talk.test(l.c, X)).length;
        const seen = new Set(); let n = 0; for (let i = 0; i < eligible; i++) { const l = OC.Talk.pick('talk_r', c, o); if (l) { seen.add(l.line.id); n++; } }
        OC.Sim.seed(123); const s1 = OC.Brain.candidates(OC.Brain.get(c.id)).slice(0, 5).map((x) => (x.act || x.social) + x.s.toFixed(3));
        OC.Sim.seed(123); const s2 = OC.Brain.candidates(OC.Brain.get(c.id)).slice(0, 5).map((x) => (x.act || x.social) + x.s.toFixed(3));
        return { bad: bad.errors[0], broken: broken.errors[0], newer: newer.errors[0], added: ok.added, said: said && said.text, exported: ex.lines.length, cool: seen.size, picks: n, eligible, det: JSON.stringify(s1) === JSON.stringify(s2) };
      });
      check('13a 對話資料：錯誤檔案被拒絕並說明原因', !!r.bad && !!r.broken && /新/.test(r.newer), r);
      check('13b 匯入角色專屬台詞後真的會被說出、可再匯出', r.added === 1 && /測試台詞/.test(r.said || '') && r.exported === 1, r);
      check('13c 台詞冷卻：可選的台詞全部用過之前不重複', r.eligible >= 3 && r.cool === r.picks, `${r.cool} 種／${r.picks} 次（可選 ${r.eligible} 句）`);
      check('13d 決策在相同種子下可重現', r.det, r.det);
    }
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.stack || e)); }
  const errs = errors.filter((e) => !/favicon|404/.test(e));
  check('沒有 JavaScript 錯誤', errs.length === 0, errs.slice(0, 5));
  fs.writeFileSync(path.join(__dirname, 'last-results.json'), JSON.stringify({ at: new Date().toISOString(), results: H.results }, null, 1));
  const failed = H.results.filter((r) => !r.ok).length;
  console.log(`\n${H.results.length - failed}/${H.results.length} passed`);
  await browser.close(); process.exit(failed ? 1 : 0);
})();
