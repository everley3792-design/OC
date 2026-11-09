/* OC Shimeji 12.0 acceptance (Playwright, real pointer events). node game/tests/v12/run.js [1 2 …]   (http.server on :8765)
 *   1 requests: an accepted request can be cancelled (confirm, no reward, the reaction follows the character, cooldown)
 *   2 layout: text-only tiles have no pedestal circle; the routine card's two selects do not overlap their labels
 *   3 skill book: a ring tile per skill with level and next unlock; the sheet shows the ladder
 *   4 map: pins stay inside the chart and clear of the title; the chart is redrawn for the time of day
 *   5 no NPCs: no resident system, page, setting, drop target or daily quest is left; old saves drop the data and keep every character
 *   6 control modes: every character has its own mode (default semi); manual stays put, semi / auto live on their own; status card, HUD long-press sheet, settings
 *   7 minimal HUD: one tools handle, the mood row moved to the status card, a slim quest chip, icon-only bar (label on the active tab), dims when idle
 *   8 voice & look: the grown-up tone is the default (the engine prefers the new lines, the childish ones become rare, 活潑 restores them), refined style is the default and switchable
 *   9 arcs: mood contagion (cool-down, distance), cold war → thaw → make up / drift apart (apology, friend mediation, player), gatherings of three or more (circle, meal, photo, mediation) always release everybody
 *  10 stingers: the short musical phrases are tied to real moments (skill level-up, new collection entry, closer friends, making up, claiming a reward), one cool-down, silent when sound is off
 *  11 3D: contact shadows (one instanced draw), rooms dressed (prints, rugs, window light, fairy lights), remodelled furniture, no cloud shadows indoors, shop street planters
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

    // ================= 9. arcs: contagion, cold war → thaw → make up / drift, gatherings of three or more =================
    if (want(9)) {
      await closeAll(); await quiet();
      const ids = await page.evaluate(() => { OC.Arcs.abort(); OC.Store.s.life.arcs = null; for (const c of OC.Chars.all()) { c.life.control = 'semi'; c.personality.traits = []; } return OC.Chars.all().map((c) => c.id); });
      const [A, B, C] = ids;
      const idle = () => page.evaluate((ids) => { for (const id of ids) { const b = OC.Brain.get(id); if (!b) continue; b.holds.clear(); b.queued = null; b.invited = null; b.leaving = null; if (b.st === 'do' || b.st === 'go' || b.st === 'social' || b.st === 'held' || b.st === 'event') OC.Brain.abort(b, 't'); b.thinkAt = performance.now() / 1000 + 600; } }, ids);   // nobody decides anything by itself while a scripted check runs
      // ---- 9a contagion
      await idle();
      const con = await page.evaluate(([a, b, c]) => {
        const Ch = OC.Chars, A = Ch.get(a), B = Ch.get(b), C_ = Ch.get(c), ba = OC.Brain.get(a), bb = OC.Brain.get(b), bc = OC.Brain.get(c);
        bb.a.x = ba.a.x + 30; bb.a.y = ba.a.y; bc.a.x = ba.a.x + 700; bc.a.y = ba.a.y + 700;   // C is far away
        for (const x of [A, B, C_]) { x.life.emo.list = []; x.life.emo.dom = 'neutral'; }
        A.personality.traits = []; B.personality.traits = ['sensitive']; C_.personality.traits = ['sensitive'];
        OC.Mind.feel(A, 'happy', 0.95, '測試'); A.life.emo.dom = 'happy'; const before = OC.Mind.intensity(B, 'happy'), farBefore = OC.Mind.intensity(C_, 'happy');
        OC.Arcs.contagion(13); const near = OC.Mind.intensity(B, 'happy'), far = OC.Mind.intensity(C_, 'happy'), n1 = OC.Arcs.state.n.contagion;
        OC.Arcs.contagion(13); const again = OC.Mind.intensity(B, 'happy'), n2 = OC.Arcs.state.n.contagion;   // cool-down: the same mood does not stack every 12 minutes
        // a sensitive one catches more than a stubborn one
        const D2 = OC.Chars.fromPreset('kuri'); D2.personality.traits = ['stubborn', 'cool']; const S2 = OC.Chars.fromPreset('sora'); S2.personality.traits = ['sensitive', 'gentle'];
        return { before, near, far, farBefore, n1, again, n2, hyp: [OC.Arcs.explain(A).length] };
      }, ids);
      check('9a 心情會感染：身邊的人被好心情帶動、離得遠的不受影響、同一種心情有冷卻不會疊加', con.near > con.before + 0.04 && con.far <= con.farBefore + 0.001 && con.n1 >= 1 && con.n2 === con.n1 && con.again <= con.near + 0.001, con);
      // ---- 9b rift: start → cold → apology cracks the ice → thaw → make up
      await idle();
      const rf = await page.evaluate(([a, b, c]) => {
        const Ch = OC.Chars, A = Ch.get(a), B = Ch.get(b), S = OC.Store.s.life; S.settings.autonomy = 'restricted'; S.settings.lockRel = false;
        for (const [x, y] of [[a, b], [b, a]]) { const r = OC.Mind.rel(x, y); Object.assign(r, { fam: 40, aff: 45, trust: 40, conflict: 10, type: 'friend', fixed: false }); }
        OC.Arcs.step(31); const none = OC.Arcs.riftOf(a, b);           // calm: no quarrel
        for (const [x, y] of [[a, b], [b, a]]) OC.Mind.rel(x, y).conflict = 55;
        OC.Arcs.step(31); const r = OC.Arcs.riftOf(a, b), stage0 = r && r.stage, notices = OC.Arcs.state.n.rifts;
        const ba = OC.Brain.get(a), bb = OC.Brain.get(b);
        const ans = OC.Brain.Social.respond(bb, ba, 'chat'), ans2 = OC.Brain.Social.respond(bb, ba, 'apologize');
        const list = [{ kind: 'social', social: 'chat', other: b, s: 1, why: [] }, { kind: 'social', social: 'chat', other: c, s: 1, why: [] }, { kind: 'social', social: 'apologize', other: b, s: 0.9, why: [] }, { kind: 'act', act: 'rest', s: 0.5, why: [] }];
        OC.Arcs.shape(A, ba, list); const sc = { chatB: list.find((x) => x.social === 'chat' && x.other === b).s, chatC: list.find((x) => x.social === 'chat' && x.other === c).s, sorry: list.find((x) => x.social === 'apologize').s };
        // an awkward meeting when they pass each other
        ba.a.x = bb.a.x + 20; ba.a.y = bb.a.y; r.lastEnc = 0; OC.Arcs.shape(A, ba, [{ kind: 'act', act: 'rest', s: 0.5, why: [] }]); const enc = r.lastEnc > 0;
        const until0 = r.until; OC.Arcs.onSocial(A, B, 'apologize'); const cracked = r.until < until0 && r.stage === 'cold';   // an apology in the cold stage only cracks the ice
        r.until = OC.Sim.now() - 1; OC.Arcs.step(31); const stage1 = r.stage;                   // time is up: thaw
        const c0 = OC.Mind.rel(a, b).conflict, t0 = OC.Mind.rel(a, b).trust;
        OC.Arcs.onSocial(A, B, 'apologize'); const stage2 = r.stage, c1 = OC.Mind.rel(a, b).conflict, t1 = OC.Mind.rel(a, b).trust;
        const mem = A.life.mem.recent.concat(A.life.mem.long).some((m) => /和好了/.test(m.text));
        return { none: !!none, stage0, notices, ans: ans.ans, ans2: ans2.ans, sc, enc, cracked, stage1, stage2, c0, c1, t0, t1, mem, rec: OC.Arcs.state.n.reconciled, ex: OC.Arcs.explain(A).length };
      }, [A, B, C]);
      check('9b 冷戰：衝突很深才會開始（平靜時不會）；冷戰中邀請被拒、不主動找對方、碰面會尷尬；道歉先敲開一點冰、解凍後再道歉就和好了（衝突大降、信任上升、有回憶）',
        !rf.none && rf.stage0 === 'cold' && rf.notices === 1 && rf.ans === 'no' && rf.sc.chatB < 0.2 && rf.sc.chatC >= 1 && rf.sc.sorry >= 0.8 && rf.enc && rf.cracked && rf.stage1 === 'thaw' && rf.stage2 === 'reconciled' && rf.c1 < rf.c0 - 20 && rf.t1 > rf.t0 + 5 && rf.mem && rf.rec === 1 && rf.ex === 0, rf);
      // ---- 9c rift: a mutual friend steps in; a failure; drifting apart; the player lets them talk; fixed pairs are left alone
      await idle();
      const rf2 = await page.evaluate(([a, b, c]) => {
        const real = OC.Sim.rnd, out = {}; try {
          const mk = () => { delete OC.Store.s.life.arcs.rifts[[a, b].sort().join('|')]; for (const [x, y] of [[a, b], [b, a]]) Object.assign(OC.Mind.rel(x, y), { fam: 40, aff: 45, trust: 40, conflict: 55, type: 'friend', fixed: false }); OC.Store.s.life.arcs.rifts = {}; OC.Arcs.step(31); return OC.Arcs.riftOf(a, b); };
          // drift: no luck three times in a row after the thaw
          let r = mk(); r.stage = 'thaw'; r.thawAt = OC.Sim.now() - 2000; r.tries = 2; const aff0 = OC.Mind.rel(a, b).aff; OC.Sim.rnd = () => 0.99; OC.Arcs.step(31); out.drift = { stage: r.stage, affDown: OC.Mind.rel(a, b).aff < aff0, n: OC.Arcs.state.n.drifted };
          // player mediation: with a lucky roll it ends, with a bad one it takes longer
          r = mk(); OC.Sim.rnd = () => 0.99; const u0 = r.until; const bad = OC.Arcs.mediate(a, b); out.mediateBad = { bad, later: r.until > u0, stage: r.stage }; out.cool = OC.Arcs.mediate(a, b) === false && r.stage === 'cold'; r.medAt = -1e9; OC.Sim.rnd = () => 0.01; out.mediateOk = { ok: OC.Arcs.mediate(a, b), stage: r.stage };
          // fixed pairs never start a rift
          delete OC.Store.s.life.arcs.rifts[[a, b].sort().join('|')]; for (const [x, y] of [[a, b], [b, a]]) Object.assign(OC.Mind.rel(x, y), { conflict: 55, fixed: true }); OC.Store.s.life.arcs.rifts = {}; OC.Arcs.step(31); out.fixed = !OC.Arcs.riftOf(a, b);
          for (const [x, y] of [[a, b], [b, a]]) Object.assign(OC.Mind.rel(x, y), { fixed: false, conflict: 10 }); OC.Mind.relPair(a, b, {}, '');
          // rival / lover pairs are left alone too
        } finally { OC.Sim.rnd = real; } return out;
      }, ids);
      check('9c 冷戰的其他走向：連續沒和好會慢慢疏遠（好感下降）、玩家讓牠們談談（運氣好和好、不好則拖更久；連按有冷卻）、玩家固定的關係不會被捲入冷戰', rf2.drift.stage === 'drifted' && rf2.drift.affDown && rf2.drift.n === 1 && rf2.mediateBad.bad === false && rf2.mediateBad.later && rf2.mediateBad.stage === 'cold' && rf2.cool && rf2.mediateOk.ok === true && rf2.mediateOk.stage === 'reconciled' && rf2.fixed, rf2);
      // ---- 9d gatherings: each kind runs to the end and lets everybody go
      for (const kind of ['circle', 'meal', 'photo']) {
        await idle(); await quiet();
        const started = await page.evaluate(([ids, kind]) => { OC.Store.s.life.settings.autonomy = 'restricted'; const n0 = OC.Arcs.state.n.gathered; window.__g0 = { n0, fam: OC.Mind.rel(ids[0], ids[1]).fam, bub: 0 }; const orig = OC.App.bubble; window.__bub = []; const ok = OC.Arcs.gather(kind, ids); return { ok, running: OC.Arcs.running && OC.Arcs.running.kind, holds: ids.map((i) => [...OC.Brain.get(i).holds]) }; }, [ids, kind]);
        check(`9d-${kind} 三個角色開始${{ circle: '圍坐聊天', meal: '一起用餐', photo: '合照' }[kind]}（都被「團體」保留）`, started.ok && started.running === kind && started.holds.every((h) => h.length === 1 && h[0] === 'group'), started);
        const done = await page.waitForFunction(() => !OC.Arcs.running, null, { timeout: 150000 }).then(() => true).catch(() => false);
        const end = await page.evaluate(([ids, kind]) => ({ holds: ids.map((i) => [...OC.Brain.get(i).holds]), st: ids.map((i) => OC.Brain.get(i).st), n: OC.Arcs.state.n.gathered, n0: window.__g0.n0, fam: OC.Mind.rel(ids[0], ids[1]).fam, fam0: window.__g0.fam, mem: OC.Chars.get(ids[1]).life.mem.recent.some((m) => m.key && m.key.startsWith('group:' + kind)) }), [ids, kind]);
        check(`9d-${kind} 結束：全部放開、熟悉度上升、留下回憶、次數加一`, done && end.holds.every((h) => !h.length) && end.st.every((s) => s !== 'held') && end.n === end.n0 + 1 && end.fam > end.fam0 && end.mem, end);
      }
      // ---- 9e a friend mediates (everyone released, the quarrel ends when it works), cut-offs release everybody
      await idle(); await quiet();
      const med = await page.evaluate(([a, b, c]) => {
        const real = OC.Sim.rnd; OC.Sim.rnd = () => 0.01;
        OC.Store.s.life.arcs.rifts = {}; for (const [x, y] of [[a, b], [b, a]]) Object.assign(OC.Mind.rel(x, y), { fam: 40, aff: 45, trust: 40, conflict: 55, type: 'friend', fixed: false }); for (const x of [a, b]) for (const m of [c]) { OC.Mind.rel(m, x).aff = 50; OC.Mind.rel(x, m).aff = 50; }
        OC.Arcs.step(31); const r = OC.Arcs.riftOf(a, b); r.stage = 'thaw'; r.thawAt = OC.Sim.now();
        const ok = OC.Arcs.gather('mediation', [c, a, b], { rift: r }); OC.Sim.rnd = real; return { ok, stage: r.stage, running: !!OC.Arcs.running };
      }, ids);
      const mdone = await page.waitForFunction(() => !OC.Arcs.running, null, { timeout: 150000 }).then(() => true).catch(() => false);
      const mend = await page.evaluate(([a, b, c]) => ({ stage: OC.Arcs.riftOf(a, b).stage, how: OC.Arcs.riftOf(a, b).how, holds: [a, b, c].map((i) => [...OC.Brain.get(i).holds]) }), ids);
      check('9e 共同的朋友出面調解：一起坐下來談，談得攏就和好（記錄是朋友調解的），所有人都放開', med.ok && med.running && mdone && ['reconciled', 'thaw'].includes(mend.stage) && mend.holds.every((h) => !h.length), { med, mend, mdone });
      await idle(); await quiet();
      const cut = await page.evaluate(([ids]) => {
        const ok = OC.Arcs.gather('circle', ids); const hidden = OC.Brain.get(ids[2]); hidden.a.hidden = true; return new Promise((res) => setTimeout(() => { hidden.a.hidden = false; res({ ok, running: !!OC.Arcs.running, holds: ids.map((i) => [...OC.Brain.get(i).holds]) }); }, 1500));
      }, [ids]);
      check('9f 有人離開畫面（被隱藏／帶走）就取消團體活動，其他人立刻被放開（不會卡住）', cut.ok && !cut.running && cut.holds.every((h) => !h.length), cut);
      // ---- 9g by itself: a cold war keeps a pair out of an invitation; everyone else can still gather
      await idle(); await quiet();
      const auto = await page.evaluate(([a, b, c]) => {
        const real = OC.Sim.rnd; OC.Sim.rnd = () => 0.01; const S = OC.Store.s.life; S.settings.autonomy = 'full'; S.arcs.gcd = 0; OC.Arcs.abort();
        for (const x of [a, b, c]) for (const y of [a, b, c]) if (x !== y) { const r = OC.Mind.rel(x, y); Object.assign(r, { aff: 40, fam: 40, conflict: 0, trust: 40, type: 'friend', fixed: false }); }
        for (const id of [a, b, c]) { const ch = OC.Chars.get(id); ch.needs.social = 30; }
        S.arcs.rifts = { [[a, b].sort().join('|')]: { a, b, stage: 'cold', since: 0, startedAt: OC.Sim.now(), until: OC.Sim.now() + 5000, tries: 0, lastEnc: 0 } };
        OC.Arcs.step(21); const withWar = OC.Arcs.running;
        S.arcs.rifts = {}; S.arcs.gcd = 0; OC.Arcs.step(21); const without = OC.Arcs.running; OC.Arcs.abort(); S.settings.autonomy = 'restricted'; OC.Sim.rnd = real;
        return { withWar: !!withWar, without: without && without.ids.length };
      }, ids);
      check('9g 自己組起來的聚會：冷戰中的兩人不會同時被邀請（人數不夠就不辦）；沒有冷戰時三個人會自己聚起來', !auto.withWar && auto.without === 3, auto);
      // ---- 9h the player sees the cold war and can step in from the profile
      const ui = await page.evaluate(([a, b]) => {
        const real = OC.Sim.rnd; OC.Sim.rnd = () => 0.01; const S = OC.Store.s.life, c = OC.Chars.get(a);
        S.arcs.rifts = { [[a, b].sort().join('|')]: { a, b, stage: 'cold', since: 0, startedAt: OC.Sim.now(), until: OC.Sim.now() + 2880, tries: 0, lastEnc: 0 } };
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:361px;z-index:9999;background:#fff'; document.body.append(host); host.append(OC.LifeUI.relSection(c, () => {}));
        const tag = [...host.querySelectorAll('.tag')].map((t) => t.textContent).filter((t) => /冷戰|緩和/.test(t)), btn = [...host.querySelectorAll('button')].find((x) => x.textContent === '讓牠們談談');
        const stage0 = OC.Arcs.riftOf(a, b).stage; btn && btn.click(); const stage1 = OC.Arcs.riftOf(a, b).stage; host.remove(); OC.Sim.rnd = real; OC.Store.s.life.arcs.rifts = {};
        return { tag, hasBtn: !!btn, stage0, stage1 };
      }, [A, B]);
      check('9h 個人檔案的「關係」頁看得到「冷戰中」，並有「讓牠們談談」；按下去牠們會當面談（這次運氣好，和好了）', ui.tag.length === 1 && ui.hasBtn && ui.stage0 === 'cold' && ui.stage1 === 'reconciled', ui);
      await idle();
    }

    // ================= 10. stingers: the short musical phrases are tied to real moments, with one cool-down =================
    if (want(10)) {
      await closeAll(); await quiet();
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), S = OC.Store.s, cues = () => Object.assign({}, OC.Sound.stats.cues), out = {};
        const until = async (f, ms = 25000) => { const t = performance.now(); while (!f() && performance.now() - t < ms) await sleep(150); };
        OC.Sound.unlock(); S.settings.sound = Object.assign({}, OC.Sound.cfg(), { on: true, music: 0, amb: 0 }); OC.Sound.apply(); await sleep(300);
        const [A, B] = OC.Chars.all(); out.state = OC.Sound.state; out.table = Object.entries(OC.Sound.CUES).map(([k, v]) => [k, v[0]]);
        // a skill level-up (a real game event → the card → the phrase)
        let before = cues(); OC.Mind.skill(A, 'cook', 4000); await until(() => (cues().skill || 0) > (before.skill || 0)); out.skill = (cues().skill || 0) - (before.skill || 0);
        // the same second: another moment does not stack a second phrase on top
        out.stack = OC.Sound.cue('mini'); await sleep(3200);
        // a new entry in the collection
        const id = Object.keys(OC.Style.ITEMS).find((k) => !S.seen[k]); before = cues(); OC.Tx.run('t:disc', { get: { items: { [id]: 1 } } }, 'test'); await sleep(600); out.discover = (cues().discover || 0) - (before.discover || 0); await sleep(3200);
        // two OCs grow closer
        before = cues(); OC.Mind.relPair(A.id, B.id, { fam: 60, aff: 70, trust: 60 }, 't'); await sleep(300); out.relUp = (cues().relUp || 0) - (before.relUp || 0); await sleep(3200);
        // a quarrel ends
        OC.Store.s.life.arcs = null; const k = [A.id, B.id].sort().join('|'); OC.Arcs.state.rifts[k] = { a: A.id, b: B.id, stage: 'thaw', since: 0, startedAt: OC.Sim.now(), until: 0, thawAt: OC.Sim.now(), tries: 0, lastEnc: 0 };
        before = cues(); OC.Arcs.reconcile(OC.Arcs.state.rifts[k], 't'); out.reconcile = (cues().reconcile || 0) - (before.reconcile || 0); await sleep(3200);
        // a card that carries a cue by itself (claiming a reward)
        before = cues(); OC.Stage.card({ kind: 'quest', ic: 'coin', title: '領取：測試', sub: '', sound: 'coin', cue: 'claim' }); await sleep(400); out.claim = (cues().claim || 0) - (before.claim || 0); await sleep(3200);
        // never when the sound is off, and unknown names do nothing
        S.settings.sound.on = false; OC.Sound.apply(); out.off = OC.Sound.cue('skill'); S.settings.sound.on = true; OC.Sound.apply(); out.unknown = OC.Sound.cue('nope');
        out.phrases = Object.assign({}, OC.Sound.stats.sting);
        return out;
      });
      check('10a 小段旋律（stinger）接到真實的事件：技能升級、圖鑑新增、兩個 OC 更親近、冷戰和解、領取獎勵各會響一次；表裡只有 win／warm／wonder', r.skill === 1 && r.discover === 1 && r.relUp === 1 && r.reconcile === 1 && r.claim === 1 && r.table.every(([, k]) => ['win', 'warm', 'wonder'].includes(k)) && r.table.length >= 9, r);
      check('10b 三秒內只會響一次（不會疊在一起）；音效關閉或名稱不存在時不響；實際響過的旋律種類被記錄', r.stack === false && r.off === false && r.unknown === false && Object.keys(r.phrases).length >= 2, { stack: r.stack, off: r.off, unknown: r.unknown, phrases: r.phrases });
    }

    // ================= 11. 3D: contact shadows, rooms dressed, furniture remodelled, no cloud shadows indoors =================
    if (want(11)) {
      await closeAll(); await quiet();
      const go = async (id) => { await page.evaluate((id) => OC.WorldUI.travel(id, { instant: true }), id); await page.waitForFunction((id) => OC.World.area && OC.World.area.id === id, id, { timeout: 40000 }); await wait(page, 1200); };
      await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 13; S.settings.weather = 'clear'; S.settings.perf = 'high'; OC.App.applyPerf && OC.App.applyPerf(); for (const c of OC.Chars.all()) OC.Brain.hold(c.id, 'test'); });
      await go('isle');
      const isle = await page.evaluate(() => ({ blobs: OC.World.contacts, clouds: OC.World.cloudsVisible, inst: (() => { let n = 0; OC.World.root.traverse((o) => { if (o.userData && o.userData.contact && o.isInstancedMesh) n++; }); return n; })() }));
      check('11a 島上每個放在地面的東西（建築、長椅、燈柱、花圃、灌木…）都有柔和的接觸陰影，全部合成一次繪製；島上有雲影', isle.blobs >= 25 && isle.inst === 1 && isle.clouds, isle);
      await go('home');
      const home = await page.evaluate(() => { const names = []; OC.World.root.traverse((o) => { if (o.material && o.material.blending === THREE.AdditiveBlending) names.push('light'); }); return { blobs: OC.World.contacts, clouds: OC.World.cloudsVisible, lights: names.length, op: (() => { let m = null; OC.World.root.traverse((o) => { if (!m && o.material && o.material.blending === THREE.AdditiveBlending) m = o.material; }); return m ? +m.opacity.toFixed(3) : null; })() }; });
      check('11b 房間裡沒有飄過地板的雲影；窗戶下有兩塊柔和的光（白天亮）；家具有接觸陰影（但房間本體沒有一大片）', !home.clouds && home.lights === 2 && home.op > 0.08 && home.blobs >= 3 && home.blobs <= 14, home);
      await page.evaluate(() => { OC.Store.s.settings.fixedHour = 23; }); await wait(page, 5000);
      const dark = await page.evaluate(() => { let m = null; OC.World.root.traverse((o) => { if (!m && o.material && o.material.blending === THREE.AdditiveBlending) m = o.material; }); return +m.opacity.toFixed(3); });
      check('11c 到了夜裡，窗戶的光線退去（不會半夜還有太陽照進來）', dark < 0.06, { dark });
      await page.evaluate(() => { OC.Store.s.settings.fixedHour = 13; });
      const fur = await page.evaluate(() => {
        const out = []; for (const id of ['bed', 'table', 'bookshelf', 'stove', 'sofa', 'desk', 'plant', 'bigpot']) {
          const g = OC.Models.FURN[id](), b = new THREE.Box3().setFromObject(g), it = OC.Style.ITEMS[id] || { fp: [1, 1] }, fp = it.fp || [1, 1]; let meshes = 0; g.traverse((o) => { if (o.isMesh) meshes++; });
          const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z, sy = b.max.y - b.min.y;
          out.push({ id, sx: +sx.toFixed(1), sz: +sz.toFixed(1), sy: +sy.toFixed(1), fp, meshes, ok: [sx, sz, sy].every(Number.isFinite) && b.min.y > -1 && sy > 8 && sy < 72, base: +b.min.y.toFixed(1) });
        } return { out, remodel: OC.Models.furniture12 === true };
      });
      check('11d 重新建模的家具（床、桌、書櫃、爐子、沙發、書桌、盆栽）：站在地上、尺寸合理、不是空的；書櫃的書合併成每種顏色一次繪製（不到 30 個網格）', fur.remodel && fur.out.every((k) => k.ok && k.meshes >= 6) && fur.out.find((k) => k.id === 'bookshelf').meshes < 30 && fur.out.every((k) => k.meshes < 80), fur.out);
      await go('cafe'); const cafe = await page.evaluate(() => ({ clouds: OC.World.cloudsVisible, blobs: OC.World.contacts }));
      await go('isle'); const back = await page.evaluate(() => OC.World.cloudsVisible);
      check('11e 離開房間回到島上，雲影又回來（不是永久關掉）', !cafe.clouds && back === true, { cafe, back });
      await go('street'); const st = await page.evaluate(() => { const shops = OC.World.interacts.filter((i) => i.type === 'shop'), ex = OC.World.interacts.filter((i) => i.type === 'exit'); const reach = (i) => { const p = OC.World.findPath(300, 900, i.at.x, i.at.y); return !!(p && p.length); }; return { blobs: OC.World.contacts, obstacles: OC.World.area.obstacles.length, shops: shops.length, shopsReach: shops.filter(reach).length, exits: ex.length, exitsReach: ex.filter(reach).length }; });
      check('11f 商店街：花圃與木箱登記了碰撞、各有接觸陰影；通道沒被擋住——從入口走得到每一個店家與攤位、咖啡館、圖書館的門', st.blobs >= 20 && st.obstacles >= 20 && st.shops >= 4 && st.shopsReach === st.shops && st.exits >= 2 && st.exitsReach === st.exits, st);
      await go('isle');
    }

    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.message)); }
  await browser.close();
  const n = H.results.filter((r) => r.ok).length; console.log(`\n${n}/${H.results.length} passed`);
})();
