/* OC Shimeji — Phase 7 scenario tests (game side of the desktop pets).
 *   cd game && python3 -m http.server 8765 &      # then, from the repo root:
 *   node game/tests/pet/run.js [scenario numbers…]
 * The real game in Chromium (SwiftShader WebGL), portrait 393×852, touch, with tests/pet/mock-native.js standing in
 * for window.OCNative (same contract as NativeBridge.kt). The overlay itself (windows, touch, Shimeji moves, FGS,
 * notification, widget) is Kotlin: its logic is unit-tested in android/core/pet, the rest needs a device
 * (docs/phase7-report.md). Screenshots → deliverables/phase7/. Exit code 1 if a check fails.
 */
const fs = require('fs'), path = require('path');
const H = require('../life/harness.js');
const { check, wait } = H;
const only = process.argv.slice(2).map(Number).filter(Boolean);
const want = (n) => !only.length || only.includes(n);
const SHOTS = process.env.OC_SHOTS || path.join(__dirname, '..', '..', '..', 'deliverables', 'phase7');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
const MOCK = path.join(__dirname, 'mock-native.js');
const ids = (page) => page.evaluate(() => { const o = {}; for (const c of OC.Chars.all()) o[c.profile.name] = c.id; return o; });
const openPage = async (page, id, params) => { await page.evaluate(([i, p]) => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); OC.Pages.open(i, p); }, [id, params || null]); await wait(page, 500); };

(async () => {
  const { browser, ctx, page, errors } = await H.launch();
  await page.addInitScript({ path: MOCK });
  try {
    await H.boot(page, { chars: 3, seed: 7 });
    const I = await ids(page), names = Object.keys(I), A = I[names[0]], B = I[names[1]], C = I[names[2]];
    await page.evaluate(() => { OC.Store.s.settings.weather = 'clear'; OC.Store.s.play.req.nextAt = 1e12; });

    // ================= 1. truthful status · permissions only on use =================
    if (want(1)) {
      const r0 = await page.evaluate(() => ({ req: __mock.requested.slice(), st: OC.PetSync.status() }));
      check('1a 開啟遊戲不會主動請求任何權限', r0.req.length === 0, r0.req);
      await openPage(page, 'petcenter'); await shot(page, '1-center-stopped');
      const txt0 = await page.$eval('[data-page=petcenter]', (e) => e.innerText);
      check('1b 狀態來自原生（未啟動時顯示「沒有在桌面上」）', r0.st.code === 'stopped' && txt0.includes('桌寵沒有在桌面上'));
      await page.tap('[data-page=petcenter] .btn.primary.block'); await wait(page, 600);
      const r1 = await page.evaluate(() => ({ req: __mock.requested.slice(), run: __mock.running, sprites: Object.keys(__mock.sprites).length }));
      check('1c 沒有懸浮權限 → 按啟動才帶去系統設定，不會假裝啟動', r1.req.includes('overlay') && !r1.run && r1.sprites === 0, r1);
      await page.evaluate(() => { __mock.perms.overlay = true; });
      await page.tap('[data-page=petcenter] .btn.primary.block');
      const ok = await page.waitForFunction(() => __mock.running, null, { timeout: 30000 }).then(() => true).catch(() => false);
      await wait(page, 2600);
      const txt1 = await page.$eval('[data-page=petcenter]', (e) => e.innerText);
      check('1d 取得權限後啟動：先輸出圖像再啟動服務，畫面顯示真實狀態', ok && txt1.includes('桌寵在桌面上'), txt1.slice(0, 60));
      await shot(page, '1-center-running');
      await page.tap('text=暫停（停在原地）'); await wait(page, 2600);
      const txt2 = await page.$eval('[data-page=petcenter]', (e) => e.innerText);
      check('1e 暫停／繼續會送到原生，狀態跟著改', await page.evaluate(() => __mock.paused) && txt2.includes('已暫停'));
      await page.tap('text=繼續自主行動'); await wait(page, 300);
    }

    // ================= 2. the OC's own frame animations reach the desktop faithfully =================
    if (want(2)) {
      const r = await page.evaluate(async (id) => {
        const c = OC.Chars.get(id), cols = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'], cells = [];
        for (const col of cols) { const k = OC.makeCanvas(256, 256), x = k.getContext('2d'); x.fillStyle = col; x.fillRect(48, 40, 160, 176); cells.push((await OC.Assets.put(k, { name: 'test' })).id); }
        const d = OC.Anim.create({ name: '測試走路', owner: id, action: 'walk', cells: [cells], loop: 'pingpong', w: 256, h: 256, anchor: { x: 128, y: 216 } });
        d.durs = [300, 100, 100, 100]; d.events = [{ frame: 2, type: 'bubble', data: '一二！' }]; d.priority = 6; OC.Anim.save(d); OC.Anim.assign(c, 'walk', 'any', d.id);
        const k2 = OC.makeCanvas(256, 256); k2.getContext('2d').fillStyle = '#ff00ff'; k2.getContext('2d').fillRect(60, 30, 140, 190);
        const d2 = OC.Anim.create({ name: '爬牆', owner: id, action: 'climb', cells: [[(await OC.Assets.put(k2, { name: 't2' })).id]], w: 256, h: 256 }); OC.Anim.save(d2); OC.Anim.assign(c, 'climb', 'any', d2.id);
        await OC.PetSync.exportSprites(id, true);
        const S = __mock.sprites[id], m = S.manifest;
        // average colour of the opaque pixels of every exported walk frame (order check)
        const colOf = (url) => new Promise((res) => { const im = new Image(); im.onload = () => { const k = OC.makeCanvas(im.width, im.height), x = k.getContext('2d'); x.drawImage(im, 0, 0); const D = x.getImageData(0, 0, im.width, im.height).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < D.length; i += 4) if (D[i + 3] > 200) { r += D[i]; g += D[i + 1]; b += D[i + 2]; n++; } res(n ? [r / n, g / n, b / n].map((v) => v > 128 ? 1 : 0).join('') : 'empty'); }; im.src = url; });
        const order = []; for (const f of m.anims.walk.frames) order.push(await colOf(S.files[f]));
        return { anims: Object.keys(m.anims), walk: m.anims.walk, run: m.anims.run, climb: m.anims.climb, hang: m.anims.hang, fall: m.anims.fall, idle: m.anims.idle, order, px: m.px, foot: m.foot };
      }, A);
      check('2a 每個桌面動作都有影格組（21 個，含爬牆／吊掛／偷看／掉落）', r.anims.length === 21 && ['climb', 'hang', 'peek', 'fall', 'run', 'jump'].every((k) => r.anims.includes(k)), r.anims.join(','));
      check('2b 玩家影格：順序（紅綠藍黃）與每格時長原樣保留', r.order.join(',') === '100,010,001,110' && r.walk.durs.join() === '300,100,100,100' && r.walk.src === 'player', `${r.order} ${r.walk.durs}`);
      check('2c 循環模式、事件、優先級也帶到桌面', r.walk.loop === 'pingpong' && r.walk.events.length === 1 && r.walk.events[0].data === '一二！' && r.walk.priority === 6, r.walk);
      check('2d 沒畫的動作沿用備用鏈：跑步 → 玩家的走路影格', r.run.src === 'player' && r.run.frames.length === 4, r.run.src);
      check('2e 玩家畫的「攀爬」是為牆面畫的（oriented，不再旋轉）；備用的吊掛會旋轉', r.climb.oriented === true && r.hang.src === 'player' && r.hang.oriented === false, { climb: r.climb.oriented, hang: [r.hang.src, r.hang.oriented] });
      check('2f 完全沒有影格的動作用內建骨架（不會空白）', r.idle.src === 'rig' && r.idle.frames.length >= 2 && r.fall.frames.length >= 2);
      check('2g 同一角色所有影格同一框與腳底點（切換動作不跳動）', r.px === 128 && r.foot.y === Math.round(128 * 0.94));
      // map a desktop move to another action of the OC + test on desktop
      await openPage(page, 'petone', { id: A }); await shot(page, '2-petone');
      const sel = await page.$('select[aria-label="開心 使用的動作"]'); await sel.selectOption('cheer'); await wait(page, 300);
      const mapped = await page.evaluate((id) => OC.PetSync.one(id).map.happy, A);
      await page.tap('button[aria-label="在桌面測試跳躍"]'); await wait(page, 200);
      const tests = await page.evaluate(() => __mock.tests.slice());
      check('2h 動畫設定頁：可把桌面動作對應到任何動作，並「在桌面測試」', mapped === 'cheer' && tests.some((t) => t[1] === 'jump'), { mapped, tests });
      await page.evaluate((id) => { delete OC.PetSync.one(id).map.happy; }, A);
    }

    // ================= 3. several pets, independent settings, relationships =================
    if (want(3)) {
      await page.evaluate(([a, b, c]) => { const R = OC.Mind; R.relChange(a, b, { aff: 60, fam: 30 }); OC.PetSync.setOn(b, true); OC.PetSync.setOn(c, true); OC.PetSync.one(b).size = 1.4; OC.PetSync.one(b).talk = 'often'; OC.PetSync.one(c).climb = false; OC.PetSync.push('t3'); }, [A, B, C]);
      const r = await page.evaluate(([a, b, c]) => { const cf = __mock.config; return { pets: cf.pets.map((p) => [p.id, p.size, p.talk, p.climb]), aff: cf.aff[a + '>' + b], affRev: cf.aff[b + '>' + a], data: Object.keys(cf.data).length, traits: [cf.data[a].traits, cf.data[c].traits], max: OC.PetSync.setOn('nobody', true) }; }, [A, B, C]);
      check('3a 最多 3 隻同時在桌面，每隻有自己的設定', r.pets.length === 3 && r.pets.find((p) => p[0] === B)[1] === 1.4 && r.pets.find((p) => p[0] === B)[2] === 'often' && r.pets.find((p) => p[0] === C)[3] === false, r.pets);
      await page.evaluate(() => { OC.Store.s.pet.global.maxPets = 3; });
      const four = await page.evaluate(() => { const c = OC.Chars.fromPreset('kuri'); c.profile.name = '第四隻'; OC.Chars.add(c); return OC.PetSync.setOn(c.id, true); });
      check('3b 第四隻會被拒絕（數量上限，避免耗電與記憶體）', four === false);
      check('3c 桌寵之間的互動使用遊戲的關係資料（有方向）', r.aff > 0.4 && r.aff !== r.affRev, { aff: r.aff, rev: r.affRev });
      check('3d 個性影響桌面行為（每隻的 traits 不同）', JSON.stringify(r.traits[0]) !== JSON.stringify(r.traits[1]), r.traits);
      await openPage(page, 'petcenter'); await shot(page, '3-center-three');
    }

    // ================= 4. desktop interactions come back to the game exactly once =================
    if (want(4)) {
      const r = await page.evaluate(async ([a, b]) => {
        const c = OC.Chars.get(a), S = OC.Store.s;
        OC.Tx.run('test:p7food', { get: { items: { pudding: 2, apple: 1 } } }, 'test');
        const before = { aff: c.life.player.aff || 0, social: c.needs.social, pud: OC.Store.count('pudding'), apple: OC.Store.count('apple'), mem: c.life.mem.recent.length, eaten: S.stats.eaten };
        const qn = OC.Progress.count ? OC.Progress.count('eat', { by: 'player' }) : 0;
        const s1 = __mock.emit(a, 'pet', { strokes: 3 });
        const s2 = __mock.emit(a, 'feed', { item: 'pudding' });
        const s3 = __mock.emit(a, 'gift', { item: 'apple' });
        const s4 = __mock.emit(a, 'meet', { with: b, kind: 'hug' });
        const r1 = OC.PetSync.pull('test');
        const mid = { aff: c.life.player.aff || 0, social: c.needs.social, pud: OC.Store.count('pudding'), apple: OC.Store.count('apple'), mem: c.life.mem.recent.length, eaten: S.stats.eaten, fed: OC.Tx.done && OC.Tx.done('pet:n' + s2), tasted: !!OC.Taste.prefs(c).tasted.pudding, seq: S.pet.applied.seq, acked: __mock.acked, queue: __mock.events.length };
        const qn2 = OC.Progress.count ? OC.Progress.count('eat', { by: 'player' }) : 0;
        // the same events delivered again (e.g. the native ack was lost) → nothing happens twice
        __mock.events.push({ id: __mock.inst + '-' + s2, inst: __mock.inst, seq: s2, oc: a, type: 'feed', data: { item: 'pudding' } }, { id: __mock.inst + '-' + s1, inst: __mock.inst, seq: s1, oc: a, type: 'pet', data: {} });
        const r2 = OC.PetSync.pull('dup');
        const after = { pud: OC.Store.count('pudding'), aff: c.life.player.aff || 0 };
        // an item that is gone by the time the game opens: not deducted, no effect, the player is told
        const s5 = __mock.emit(a, 'feed', { item: 'cake' }); const r3 = OC.PetSync.pull('gone');
        return { before, mid, after, r1, r2, r3, qn, qn2, log: S.pet.applied.log.slice(0, 6) };
      }, [A, B]);
      check('4a 摸摸頭 → 好感、社交、回憶（第一次在桌面）', r.mid.aff > r.before.aff && r.mid.social > r.before.social && r.mid.mem > r.before.mem, { before: r.before, mid: r.mid });
      check('4b 餵食 → 布丁只扣 1 個（OC.Tx 固定 key）、記錄口味、計入統計', r.mid.pud === r.before.pud - 1 && r.mid.tasted && r.mid.eaten === r.before.eaten + 1, r.mid);
      check('4c 送禮 → 物品扣除；碰面 → 關係小幅變化', r.mid.apple === r.before.apple - 1 && r.r1.out.ok === 4, { r1: r.r1, apple: [r.before.apple, r.mid.apple] });
      check('4d 遊戲行為同樣送出進度事件（任務／成就用的唯一事件流）', r.qn2 >= r.qn + 1 || r.qn2 === undefined, { before: r.qn, after: r.qn2 });
      check('4e 套用後才 ack；原生佇列清空', r.mid.acked === r.mid.seq && r.mid.queue === 0, r.mid);
      check('4f 同一批互動再送一次：不會重複扣物品或加好感', r.r2.n === 0 && r.r2.skipped === 2 && r.after.pud === r.mid.pud && r.after.aff === r.mid.aff, r.r2);
      check('4g 背包裡已經沒有的東西：不扣、沒有效果、會告知', r.r3.out['no-item'] === 1, r.r3);
      const cap = await page.evaluate((a) => { let n = 0; for (let i = 0; i < 20; i++) __mock.emit(a, 'pet', {}); const r = OC.PetSync.pull('cap'); return r.out; }, A);
      check('4h 一直在桌面摸摸頭也有每日上限（不能刷好感）', (cap.capped || 0) >= 8, cap);
      await openPage(page, 'petdiag'); await shot(page, '4-diag');
    }

    // ================= 5. no double simulation: offline catch-up first, then events =================
    if (want(5)) {
      const r = await page.evaluate((a) => {
        const c = OC.Chars.get(a), n0 = JSON.stringify(c.needs);
        const noop = OC.PetSync.pull('none'); const n1 = JSON.stringify(c.needs);   // nothing queued → nothing changes
        const order = []; const cu = OC.Sim.catchUp, pl = OC.PetSync.pull;
        OC.Sim.catchUp = function () { order.push('catchUp'); return cu.apply(this, arguments); };
        OC.PetSync.pull = function () { order.push('pull'); return pl.apply(this, arguments); };
        OC.Store.s.life.lastReal = Date.now() - 2 * 3600e3;
        window.OCApp.lifecycle('pause'); window.OCApp.lifecycle('resume');
        OC.Sim.catchUp = cu; OC.PetSync.pull = pl;
        const cfg = __mock.config;
        return { order, same: n0 === n1, noop, keys: Object.keys(cfg.data[a].mood), hasDecay: JSON.stringify(cfg).includes('decay') };
      }, A);
      check('5a 回到遊戲：先離線補算，再套用桌面互動（順序固定）', r.order.indexOf('catchUp') >= 0 && r.order.indexOf('catchUp') < r.order.indexOf('pull'), r.order);
      check('5b 沒有互動時同步不會改需求（原生不模擬需求 → 不會雙重消耗）', r.same && r.noop.n === 0 && !r.hasDecay, r);
    }

    // ================= 6. dialogue from personality / emotion / memory; settings; editing =================
    if (want(6)) {
      const r = await page.evaluate(([a, b]) => {
        const said0 = JSON.stringify(OC.Store.s.life.said);
        const la = OC.PetSync.renderLines(OC.Chars.get(a), []), lb = OC.PetSync.renderLines(OC.Chars.get(b), []);
        (OC.Store.s.pet.custom[a] = OC.Store.s.pet.custom[a] || {}).tap = ['我自己寫的台詞！'];
        const lc = OC.PetSync.renderLines(OC.Chars.get(a), []);
        OC.PetSync.one(a).mute = true; OC.PetSync.one(a).talk = 'rare'; OC.PetSync.push('t6');
        const p = __mock.config.pets.find((x) => x.id === a);
        return { a: la.tap, b: lb.tap, idleA: la.idle, idleB: lb.idle, cats: Object.keys(la).length, custom: lc.tap.includes('我自己寫的台詞！'), said: said0 === JSON.stringify(OC.Store.s.life.said), mute: p.mute, talk: p.talk };
      }, [A, B]);
      check('6a 台詞由對話引擎依個性／聲線產生（兩隻 OC 說法不同）', JSON.stringify(r.a) !== JSON.stringify(r.b) && r.cats >= 20, { a: r.a, b: r.b });
      check('6b 玩家自訂台詞會加入；預覽不會改動遊戲的對話紀錄', r.custom && r.said);
      check('6c 頻率與靜音設定送到原生', r.mute === true && r.talk === 'rare');
      await openPage(page, 'petone', { id: A }); await page.tap('text=預覽'); await wait(page, 500); await shot(page, '6-lines-preview');
      await page.evaluate(() => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); });
      await page.evaluate((a) => { OC.PetSync.one(a).mute = false; OC.PetSync.one(a).talk = 'normal'; }, A);
    }

    // ================= 7. app-context lines: opt-in, rules, exclusions, honest when unavailable =================
    if (want(7)) {
      const d0 = await page.evaluate(() => ({ en: OC.Store.s.pet.app.enabled, cfg: __mock.config.global.app.enabled }));
      check('7a App 情境對話預設關閉', d0.en === false && d0.cfg === false);
      await openPage(page, 'petapps');
      await page.tap('[data-page=petapps] .switch'); await wait(page, 400);
      const txt = await page.$eval('[data-page=petapps]', (e) => e.innerText);
      check('7b 開啟後若沒有使用情況存取：明確說明，不假裝能偵測', txt.includes('前往允許使用情況存取') && txt.includes('不會讀取畫面'), txt.slice(0, 120));
      await page.tap('text=前往允許使用情況存取'); await wait(page, 200);
      await page.evaluate(() => { __mock.perms.usage = true; }); await page.evaluate(() => { OC.Pages.pages.petapps.refresh(OC.Pages.pages.petapps); }); await wait(page, 300);
      await page.selectOption('select[aria-label="方塊遊戲 的分類"]', 'music'); await page.selectOption('select[aria-label="銀行 的分類"]', 'x'); await wait(page, 300);
      await shot(page, '7-app-rules');
      const r = await page.evaluate(() => ({ req: __mock.requested.includes('usage'), app: __mock.config.global.app }));
      check('7c 規則（App → 分類）與排除清單送到原生', r.req && r.app.enabled && r.app.rules['com.example.game'] === 'music' && r.app.exclude.includes('com.example.bank'), r.app);
      const L = await page.evaluate(() => Object.keys(OC.PetSync.renderLines(OC.Chars.active(), [])).filter((k) => k.startsWith('app_')));
      check('7d 每種 App 分類都有台詞（測試預覽用同一套）', L.length === 10, L);
      await page.evaluate(() => { OC.Store.s.pet.app = { enabled: false, useSystem: true, rules: {}, exclude: [], hide: false }; OC.PetSync.push('t7'); });
      check('7e 可以清除規則並關閉', await page.evaluate(() => !__mock.config.global.app.enabled && !Object.keys(__mock.config.global.app.rules).length));
    }

    // ================= 8. tools: pomodoro, rest, alarm (exact only if granted), to-dos → widget =================
    if (want(8)) {
      await openPage(page, 'pettools'); await shot(page, '8-tools');
      await page.tap('[data-page=pettools] .btn.primary.block'); await wait(page, 300);
      const r1 = await page.evaluate(() => ({ r: __mock.reminders.find((x) => x.id === 'pomo'), act: OC.Store.s.pet.tools.pomo.active }));
      check('8a 番茄鐘用系統鬧鐘排程（25 分鐘後），沒有權限就是一般精度', r1.r && Math.abs(r1.r.at - Date.now() - 25 * 60000) < 5000 && r1.r.exactActive === false && r1.act.phase === 'work', r1);
      const r2 = await page.evaluate(() => { const s = __mock.emit('', 'tool', { kind: 'pomodoro', id: 'pomo', phase: 'work' }); OC.PetSync.pull('tool'); const t = OC.Store.s.pet.tools.pomo; return { today: t.today, next: __mock.reminders.find((x) => x.id === 'pomo'), act: t.active }; });
      check('8b 時間到（原生事件）→ 計入今天的番茄、自動開始休息', r2.today === 1 && r2.next && r2.next.phase === 'break' && r2.act.phase === 'break', r2);
      await page.evaluate(() => OC.Pages.pages.pettools.refresh(OC.Pages.pages.pettools)); await wait(page, 200);
      await page.tap('[data-page=pettools] button:has-text("停止")'); await wait(page, 200);
      check('8c 停止會取消系統鬧鐘', await page.evaluate(() => !__mock.reminders.some((x) => x.id === 'pomo') && !OC.Store.s.pet.tools.pomo.active));
      const r3 = await page.evaluate(() => { const a = OC.PetSync.Tools.alarm({ at: Date.now() + 3600e3, title: '喝水', exact: true }); __mock.perms.exactAlarm = 'granted'; const b = OC.PetSync.Tools.alarm({ at: Date.now() + 7200e3, title: '開會', exact: true }); OC.PetSync.Tools.rest(true, 45); return { a: a.exactActive, b: b.exactActive, rest: __mock.reminders.find((x) => x.id === 'rest') }; });
      check('8d 準時鬧鐘只有在系統允許後才真的準時', r3.a === false && r3.b === true, r3);
      check('8e 休息提醒會重複（每 45 分鐘）', r3.rest && r3.rest.repeatMin === 45);
      await page.evaluate(() => { OC.PetSync.Tools.todo('寫作業'); OC.PetSync.Tools.todo('買牛奶'); OC.PetSync.Tools.note('今天的靈感：桌寵會倒吊'); });
      const w = await page.evaluate(() => ({ w: __mock.widget, av: __mock.avatar, notes: OC.Store.s.pet.tools.notes.length }));
      check('8f 待辦 → 主畫面小工具顯示最上面的未完成項目（含頭像）；筆記存在存檔', w.w.todo === '買牛奶' && w.av > 1000 && w.notes === 1, w);
      await page.evaluate(() => OC.Pages.pages.pettools.refresh(OC.Pages.pages.pettools)); await wait(page, 200); await shot(page, '8-tools-filled');
    }

    // ================= 9. performance & interaction settings reach the service =================
    if (want(9)) {
      await openPage(page, 'petcenter');
      await page.evaluate(() => { const s = [...document.querySelectorAll('[data-page=petcenter] .seg button')].find((b) => b.textContent === '60'); s.click(); });
      await page.evaluate(() => { const s = [...document.querySelectorAll('[data-page=petcenter] .seg button')].find((b) => b.textContent === '48MB'); s.click(); });
      const sw = await page.$$('[data-page=petcenter] .card .switch'); await sw[0].click(); await wait(page, 300);
      const g = await page.evaluate(() => __mock.config.global);
      check('9a 幀率、快取、觸控穿透送到原生（原生依此改變 Choreographer 上限與視窗旗標）', g.fps === 60 && g.cacheMB === 48 && g.passthrough === true, g);
      await page.evaluate(() => { __mock.emit('', 'setting', { passthrough: false }); OC.PetSync.pull('notif'); });
      check('9b 從通知切換穿透 → 遊戲設定同步', await page.evaluate(() => OC.Store.s.pet.global.passthrough === false));
    }

    // ================= 10. backup: v5 → v6 migration, export / import keeps the desktop setup =================
    if (want(10)) {
      const r = await page.evaluate((a) => {
        const s = JSON.parse(OC.Store.exportJSON());
        const v5 = JSON.parse(JSON.stringify(s)); v5.v = 5; delete v5.pet; v5.petId = a; v5.settings.petScale = 1.3;
        const keep = OC.Store.persist; OC.Store.persist = () => {};
        OC.Store.importJSON(JSON.stringify(v5)); const m = { v: OC.Store.s.v, on: OC.Store.s.pet.on, size: OC.PetSync.one(a).size };
        OC.Store.importJSON(JSON.stringify(s)); const back = { v: OC.Store.s.v, todos: OC.Store.s.pet.tools.todos.length, seq: OC.Store.s.pet.applied.seq };
        let bad = null; try { OC.Store.importJSON(JSON.stringify({ v: 9 })); } catch (e) { bad = e.message; }
        OC.Store.persist = keep;
        return { has: !!s.pet && !!s.pet.tools, m, back, bad, script: JSON.stringify(s).includes('<script') };
      }, A);
      check('10a 存檔含桌寵設定、工具、同步水位（備份完整）', r.has && r.back.todos >= 2 && r.back.seq > 0, r.back);
      check('10b 舊存檔（v5，單一桌寵）自動遷移成多桌寵設定', r.m.v === 6 && r.m.on[0] === A && r.m.size === 1.3, r.m);
      check('10c 較新版本的存檔會被拒絕並說明原因', !!r.bad && r.bad.includes('較新版本'), r.bad);
    }

    // ================= 11. reload: nothing re-applied, settings kept =================
    if (want(11)) {
      const before = await page.evaluate(() => { OC.Store.persist = OC.Store.__p || OC.Store.persist; return { seq: OC.Store.s.pet.applied.seq, on: OC.Store.s.pet.on.length }; });
      await page.evaluate(() => { const S = OC.Store.s; localStorage.setItem('oc.save.v1', JSON.stringify(S)); });
      const mockState = await page.evaluate(() => JSON.stringify({ sprites: Object.keys(__mock.sprites) }));
      await page.reload(); await page.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 });
      const r = await page.evaluate((seq) => { __mock.emit(OC.Store.s.pet.on[0], 'pet', {}); __mock.events.unshift({ id: __mock.inst + '-' + seq, inst: __mock.inst, seq, oc: OC.Store.s.pet.on[0], type: 'feed', data: { item: 'apple' } }); const x = OC.PetSync.pull('reload'); return { v: OC.Store.s.v, seq: OC.Store.s.pet.applied.seq, on: OC.Store.s.pet.on.length, x }; }, before.seq);
      check('11a 重開後：存檔 v6、桌寵設定還在、舊互動不會再套用', r.v === 6 && r.on === before.on && r.x.skipped === 1 && r.x.n === 1, { r, before, mockState });
    }

    // ================= 12. theme & screens =================
    if (want(12)) {
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await openPage(page, 'petcenter'); await wait(page, 300); await shot(page, '12-center-dark');
      const cfgTheme = await page.evaluate(() => { OC.Store.s.settings.theme = 'dark'; OC.PetSync.push('theme'); return __mock.config.global.theme; });
      check('12a 主題設定也送到原生（泡泡／選單跟著深淺色）', cfgTheme === 'dark');
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; OC.Store.s.settings.theme = 'system'; });
    }

    // ================= 13. clear data =================
    if (want(13)) {
      await openPage(page, 'petcenter');
      await page.tap('text=清除桌寵資料'); await wait(page, 400); await page.tap('.sheet.open button:has-text("清除")'); await wait(page, 600);
      const r = await page.evaluate(() => ({ c: __mock.cleared, run: __mock.running, exp: Object.keys(OC.Store.s.pet.exported).length }));
      check('13a 清除桌寵資料：收起、刪除圖像與提醒（遊戲存檔不受影響）', r.c === 1 && !r.run && r.exp === 0, r);
    }

    // ================= 14. browser (no Android): honest locked features =================
    if (want(14)) {
      const p2 = await ctx.newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(String(e)));
      await p2.goto(H.URL); await p2.waitForFunction(() => window.__ocReady === true, null, { timeout: 30000 }).catch(() => {});
      const r = await p2.evaluate(async () => { if (!window.OC || !OC.Pages) return { boot: false }; OC.Pages.open('petcenter'); await new Promise((r) => setTimeout(r, 300)); const t = document.querySelector('[data-page=petcenter]').innerText; OC.Pages.open('pettools'); await new Promise((r) => setTimeout(r, 300)); const t2 = document.querySelector('[data-page=pettools]').innerText; return { boot: true, native: OC.PetSync.native(), locked: t.includes('需要安裝 Android App') && t.includes('未開放'), tools: t2.includes('未開放') && t2.includes('待辦') }; });
      await p2.screenshot({ path: path.join(SHOTS, '14-browser-locked.png') });
      check('14a 瀏覽器版：桌寵與鬧鐘標示「未開放」並說明原因，待辦與筆記可用', r.boot && !r.native && r.locked && r.tools, r);
      check('14b 無錯誤', e2.length === 0, e2.slice(0, 3));
      await p2.close();
    }

    check('全程沒有 JavaScript 錯誤', errors.length === 0, errors.slice(0, 5));
  } catch (e) {
    console.error(e); check('執行中斷', false, String(e && e.stack || e));
  } finally {
    fs.writeFileSync(path.join(__dirname, 'last-results.json'), JSON.stringify(H.results, null, 1));
    const bad = H.results.filter((r) => !r.ok);
    console.log(`\n${H.results.length - bad.length}/${H.results.length} passed`);
    await browser.close();
    process.exit(bad.length ? 1 : 0);
  }
})();
