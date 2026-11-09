/* OC Shimeji 12.0 acceptance (Playwright, real pointer events). node game/tests/v12/run.js [1 2 …]   (http.server on :8765)
 *   1 requests: an accepted request can be cancelled (confirm, no reward, the reaction follows the character, cooldown)
 *   2 layout: text-only tiles have no pedestal circle; the routine card's two selects do not overlap their labels
 *   3 skill book: a ring tile per skill with level and next unlock; the sheet shows the ladder
 *   4 map: pins stay inside the chart and clear of the title; the chart is redrawn for the time of day
 *   5 no NPCs: no resident system, page, setting, drop target or daily quest is left; old saves drop the data and keep every character
 *   6 control modes: every character has its own mode (default semi); manual stays put, semi / auto live on their own; status card, HUD long-press sheet, settings
 *   7 minimal HUD: one tools handle, the mood row moved to the status card, a slim quest chip, icon-only bar (label on the active tab), dims when idle
 *   8 voice & look: the grown-up tone is the default (the engine prefers the new lines, the childish ones become rare, 活潑 restores them), refined style is the default and switchable
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

    // ================= 5. no NPCs =================
    if (want(5)) {
      await closeAll();
      const r = await page.evaluate(async () => {
        OC.Pages.open('settings'); await new Promise((r) => setTimeout(r, 700));
        const settingsText = (document.querySelector('[data-page="settings"]') || document.body).textContent;
        let npcPage = true; try { OC.Pages.open('npc', { id: 'kuri' }); } catch (e) { npcPage = false; } OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close());
        const qs = OC.Quests.legacyToday ? OC.Quests.legacyToday().map((q) => q.id) : [], pool = Object.values(OC.Game.QUEST_POOL).map((q) => q.id);
        const s = OC.Store.s; const dailies = (s.play.q.list || []).map((q) => q.key);
        return { settingsHasResidents: /居民/.test(settingsText), npcPage, api: ['NPCS', 'npc', 'dialogue', 'talked', 'gift', 'addFriend'].filter((k) => k in OC.Game), appNpcs: 'npcs' in OC.App, store: { npcs: s.npcs, residents: s.world.residents }, poolTalk: pool.includes('talk'), dailiesTalk: dailies.some((k) => /d_talk/.test(k)), friendLevels: OC.Game.LEVELS.length };
      });
      check('5a 沒有居民（NPC）：設定沒有開關、沒有居民頁、沒有相關程式介面、存檔沒有欄位、每日任務沒有「和居民聊天」', !r.settingsHasResidents && !r.api.length && !r.appNpcs && r.store.npcs === undefined && r.store.residents === undefined && !r.poolTalk && !r.dailiesTalk && r.friendLevels === 5, r);
      const w = await page.evaluate(() => { const items = OC.Chars.all().map((c) => c.profile.name); return { n: items.length, mates: Object.keys(OC.App.mates || {}).length }; });
      check('5b 小島上只有玩家自己的角色（沒有任何自動出現的居民）', w.n === 3 && w.mates <= 2, w);
    }

    // ================= 6. control modes =================
    if (want(6)) {
      await closeAll(); await quiet();
      const d = await page.evaluate(() => {
        const c = OC.Chars.blank('custom'); c.profile.name = '新角色'; const fresh = c.life.control;
        const old = OC.Chars.all()[0]; delete old.life.control; OC.Chars.normalize(old);
        return { fresh, migrated: old.life.control };
      });
      check('6a 每個新角色、既有角色的操控模式預設都是「半自動」', d.fresh === 'semi' && d.migrated === 'semi', d);
      // behaviour: a manual character does not start things on its own; a semi / auto one does (the played OC and a mate alike)
      const ids = await page.evaluate(() => OC.Chars.all().map((c) => c.id));
      const run = await page.evaluate(async ([id, mate]) => {
        const out = {}; const S = OC.Store.s;
        for (const mode of ['manual', 'semi', 'auto']) {
          for (const c0 of OC.Chars.all()) { OC.Brain.setControl(c0.id, mode); const b0 = OC.Brain.get(c0.id); b0.holds.clear(); b0.invited = null; }   // everybody in the same mode: nobody invites a manual one
          for (const who of [id, mate]) {
            const c = OC.Chars.get(who), b = OC.Brain.get(who); if (b.st === 'do' || b.st === 'go' || b.st === 'social') OC.Brain.abort(b, 't'); b.cmdAt = 0; b.queued = null; if (b.a) b.a.path = null; b.thinkAt = 0;
            Object.assign(c.needs, { fun: 15, interest: 15, active: 15, social: 20, food: 85, sleep: 90, energy: 90, comfort: 80 });   // bored and restless, but nothing urgent
            for (let i = 0; i < 8; i++) { OC.Sim.advance(3); await new Promise((r) => setTimeout(r, 200)); }   // let leftovers of the previous mode settle
            if (b.st === 'do' || b.st === 'go' || b.st === 'social') OC.Brain.abort(b, 't'); b.thinkAt = 0; let started = 0; const t0 = Date.now();
            while (Date.now() - t0 < 30000 && !started) { OC.Sim.advance(3); Object.assign(c.needs, { fun: 15, interest: 15, active: 15, food: 85, sleep: 90, energy: 90, comfort: 80 }); /* keep it from being urgent: manual still looks after real needs */ await new Promise((r) => setTimeout(r, 200)); started = b.st === 'go' || b.st === 'do' ? 1 : 0; }
            out[(who === id ? 'played-' : 'mate-') + mode] = started > 0; if (mode === 'manual' && started) out['why-' + who] = { st: b.st, act: b.act, reason: b.dbg && b.dbg.reason, log: OC.Brain.log.filter((l) => l.who === who).slice(-3).map((l) => l.text || l.t) };
          }
        }
        return out;
      }, [ids[0], ids[1]]);
      check('6b 手動的角色（操控中的或同伴）不會自己開始新活動；半自動、全自動的會自己生活', !run['played-manual'] && !run['mate-manual'] && run['played-semi'] && run['mate-semi'] && run['played-auto'] && run['mate-auto'], run);
      // UI: status card
      await page.evaluate(() => { OC.Brain.setControl(OC.Store.s.activeId, 'semi'); OC.App.toggleStatus(true); }); await wait(page, 900);
      const sc = await page.evaluate(() => { const bs = [...document.querySelectorAll('.status-card .sc-ctl .seg button')].map((b) => b.textContent.trim()); const on = document.querySelector('.status-card .sc-ctl .seg button.on'); return { bs, on: on && on.textContent.trim(), desc: document.querySelector('.sc-ctld').textContent.slice(0, 20) }; });
      await page.click('.status-card .sc-ctl .seg button[data-v="auto"]'); await wait(page, 500);
      const after = await page.evaluate(() => ({ mode: OC.Chars.active().life.control, pill: !document.querySelector('.hud-ctl').hidden && document.querySelector('.hud-ctl').textContent, desc: document.querySelector('.sc-ctld').textContent.slice(0, 14) }));
      await page.click('.status-card .sc-ctl .seg button[data-v="semi"]'); await wait(page, 500);
      const back = await page.evaluate(() => ({ mode: OC.Chars.active().life.control, pillHidden: document.querySelector('.hud-ctl').hidden }));
      check('6c 狀態卡有操控模式切換（手動／半自動／全自動＋說明）；改成非預設時 HUD 出現小標籤，回到半自動就隱藏', sc.bs.length === 3 && sc.on.includes('半自動') && after.mode === 'auto' && after.pill === '全自動' && back.mode === 'semi' && back.pillHidden, { sc, after, back });
      await page.evaluate(() => OC.App.toggleStatus(false)); await wait(page, 400);
      // UI: long-press the avatar → the quick sheet with every character
      const box = await page.evaluate(() => { const r = document.querySelector('.hud-me').getBoundingClientRect(); return { x: r.x + 30, y: r.y + 30 }; });
      await page.mouse.move(box.x, box.y); await page.mouse.down(); await wait(page, 1400); await page.mouse.up(); await wait(page, 700);
      const sh = await page.evaluate(() => { const s = [...document.querySelectorAll('.sheet')].pop(); return s ? { title: s.textContent.slice(0, 12), rows: s.querySelectorAll('.ctl-row').length, status: !!document.querySelector('.status-card.on') } : null; });
      check('6d 長按 HUD 頭像：出現「操控模式」表單，列出每個角色，可逐一或全部切換（且不會同時打開狀態卡）', sh && /操控模式/.test(sh.title) && sh.rows === 3 && !sh.status, sh);
      await page.click('.sheet .ctl-row:nth-of-type(2) .seg button[data-v="manual"]'); await wait(page, 400);
      const one = await page.evaluate((m) => OC.Chars.get(m).life.control, ids[1]);
      await page.evaluate(() => { const all = [...document.querySelectorAll('.sheet .seg')].pop(); all.querySelector('button[data-v="semi"]').click(); }); await wait(page, 400);
      const allm = await page.evaluate(() => OC.Chars.all().map((c) => c.life.control));
      check('6e 表單可以改單一角色，也可以「全部角色一次設定」', one === 'manual' && allm.every((m) => m === 'semi'), { one, allm });
      await closeAll();
    }

    // ================= 7. minimal HUD =================
    if (want(7)) {
      await closeAll(); await page.evaluate(() => { OC.App.tab('island'); OC.App.rail(false); }); await wait(page, 700);
      const vis = (sel) => `[...document.querySelectorAll('${sel}')].filter((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && !e.hidden; }).length`;
      const hud = await page.evaluate((q) => ({ controls: eval(q), moodRowVisible: [...document.querySelectorAll('.hud-plate .hud-row')].filter((e) => getComputedStyle(e).display !== 'none').length, railOpen: document.querySelector('.hud-rail').classList.contains('open') }), vis('#hud button'));
      check('7a 常駐 HUD 只剩：頭像名牌、時間、一個工具把手（有任務時多一個小膠囊）；心情列移到狀態卡', hud.controls <= 4 && hud.moodRowVisible === 1 && !hud.railOpen, hud);
      await page.evaluate(() => OC.App.rail(true)); await wait(page, 600);
      const open = await page.evaluate((q) => ({ n: eval(q), exp: document.querySelector('.rail-toggle').getAttribute('aria-expanded') }), vis('.hud-rail button'));
      await page.evaluate(() => OC.App.rail(false)); await wait(page, 300);
      const shut = await page.evaluate((q) => eval(q), vis('.hud-rail button'));
      check('7b 點工具把手：展開背包、鏡頭、佈置（共 4 個鈕），再收起只剩把手', open.n === 4 && open.exp === 'true' && shut === 1, { open, shut });
      const tb = await page.evaluate(() => [...document.querySelectorAll('.tab')].map((t) => ({ on: t.classList.contains('on'), label: parseFloat(getComputedStyle(t.querySelector('span:not(.stk)')).opacity), icon: t.querySelector('.stk').getBoundingClientRect().width > 0 })));
      check('7c 導覽列只有圖示；標籤只出現在目前分頁（所有圖示都看得到）', tb.length === 5 && tb.every((t) => t.icon) && tb.filter((t) => t.label > 0.5).length === 1 && tb.find((t) => t.on).label > 0.5, tb);
      await page.evaluate(() => document.getElementById('hud').classList.remove('idle')); await wait(page, 7500);
      const idle = await page.evaluate(() => getComputedStyle(document.querySelector('.hud-me')).opacity);
      await page.mouse.click(196, 500); await wait(page, 700);
      const awake = await page.evaluate(() => getComputedStyle(document.querySelector('.hud-me')).opacity);
      check('7d 安靜幾秒後 HUD 自己淡出（讓出畫面），一碰就回來', +idle < 0.8 && +awake > 0.95, { idle, awake });
    }

    // ================= 8. voice and look =================
    if (want(8)) {
      await closeAll(); await quiet();
      const t = await page.evaluate(() => {
        const S = OC.Store.s, a = OC.Chars.all()[0], b = OC.Chars.all()[1], CH = /[～〜♪♡♥耶啦囉嘿嘿嗚欸]|！{2,}|——！|好好(?:吃|玩|聽|看)|超(?:喜歡|可愛|好玩|開心)|(?:好|太)(?:開心|可愛)了|唷|喲/;
        const sample = (tone) => { S.life.settings.tone = tone; let m = 0, ch = 0, n = 0; const cats = ['greet', 'talk', 'share', 'compliment', 'comfort', 'invite', 'bye', 'chat_player', 'pet', 'call', 'solo_read', 'solo_rest'];
          for (let i = 0; i < 400; i++) { S.life.said = {}; const r = OC.Talk.pick(cats[i % cats.length], a, i % 3 ? b : null); if (!r) continue; n++; if (r.line.m) m++; if (CH.test(r.text)) ch++; } return { n, mature: +(m / n).toFixed(2), childish: +(ch / n).toFixed(2) }; };
        const mature = sample('mature'), playful = sample('playful'); S.life.settings.tone = 'mature';
        const lines = OC.LifeData.LINES.filter((l) => l.m), cats = new Set(lines.map((l) => l.cat));
        const tut = (OC.Tutorial && OC.Tutorial.STEPS ? OC.Tutorial.STEPS : []).map((x) => x.say || '');
        return { mature, playful, newLines: lines.length, cats: cats.size, childishNew: lines.filter((l) => /～|！{2,}/.test(l.text)).length, defaults: S.life.settings.tone, tutBang: tut.filter((x) => /！/.test(x)).length };
      });
      check('8a 預設是沉穩語氣：新台詞（約 300 句、30 多個分類）占大多數，幼稚的用語（～、疊驚嘆號、語助詞）變得很少；切到「活潑」才回到舊的比例', t.newLines >= 280 && t.cats >= 30 && t.mature.mature >= 0.6 && t.mature.childish <= 0.1 && t.playful.childish > t.mature.childish * 2 && t.childishNew === 0 && t.defaults === 'mature', t);
      const st = await page.evaluate(() => { const r = document.documentElement; const refined = r.dataset.style; const rm = getComputedStyle(r).getPropertyValue('--r-m').trim(), font = getComputedStyle(r).getPropertyValue('--font-ui').trim().slice(0, 12); OC.App.setStyle('toy'); const toy = { style: r.dataset.style, rm: getComputedStyle(r).getPropertyValue('--r-m').trim() }; OC.App.setStyle('refined'); const names = OC.Chars.all().map((c) => [c.speech.style, c.speech.ending]); return { refined, rm, font, toy, names, saved: OC.Store.s.settings.style }; });
      check('8b 介面風格預設「雅緻」（小圓角、系統字體），可切到「玩具」再切回；預設範本的口癖不再是「喵～」', st.refined === 'refined' && st.rm === '12px' && st.toy.style === 'toy' && st.toy.rm === '18px' && st.saved === 'refined' && !st.names.some(([s2, e]) => s2 === 'cute' || /～/.test(e || '')), st);
    }

    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.message)); }
  await browser.close();
  const n = H.results.filter((r) => r.ok).length; console.log(`\n${n}/${H.results.length} passed`);
})();
