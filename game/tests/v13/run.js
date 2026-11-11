/* OC Shimeji 13.0 acceptance (Playwright, real pointer events). node game/tests/v13/run.js [1 2 …]   (http.server on :8765, or OC_URL)
 *   1 follow: the character you follow leads the way to another place (semi / auto), never in manual; nothing happens behind a page;
 *     an OC you are watching (觀察) leaves → the view goes along and keeps watching
 *   2 picture characters: mirrored by the walking direction, the picture performs every action (motion + marks), own frames win,
 *     framing (zoom / offset / crop / flip / reset), editor controls, animated frames for the desktop pet
 *   3 traits: 80+ data-driven traits with measurable effects and own lines, symmetric contradictions shown in the editor, random traits / tastes
 * (further scenarios are added below as the 13.0 features land)
 */
const fs = require('fs'), path = require('path');
const H = require('../life/harness.js');
const want = (n) => process.argv.length <= 2 || process.argv.slice(2).includes(String(n));
const { check, wait } = H;
const SHOTS = process.env.OC_SHOTS || path.join(__dirname, '..', '..', '..', 'deliverables', 'v13');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
(async () => {
  const { browser, page, errors } = await H.launch();
  try {
    await H.boot(page, { chars: 3, seed: 13, travel: true });
    await page.evaluate(() => { const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = 10; S.settings.weather = 'clear'; if (OC.Events.current) OC.Events.end('t'); S.life.ev.lastAny = Date.now() + 3.6e6; S.play.req.nextAt = 1e12; });
    await wait(page, 800);
    const quiet = () => page.evaluate(() => { if (OC.Events.current) OC.Events.end('t'); OC.Store.s.life.ev.lastAny = Date.now() + 3.6e6; if (OC.Arcs) OC.Arcs.abort(); for (const c of OC.Chars.all()) { const b = OC.Brain.get(c.id); if (!b) continue; b.holds.delete('event'); Object.assign(c.needs, { sleep: 90, energy: 90, food: 85 }); if (b.act === 'sleep' && b.st === 'do') OC.Brain.abort(b, 't'); } });
    const closeAll = () => page.evaluate(() => OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()));
    const go = async (id) => { await page.evaluate((id) => OC.WorldUI.travel(id, { instant: true }), id); await page.waitForFunction((id) => OC.World.area && OC.World.area.id === id, id, { timeout: 40000 }); await wait(page, 1000); };
    const ids = await page.evaluate(() => OC.Chars.all().map((c) => c.id));

    // ================= 1. the view follows =================
    if (want(1)) {
      await quiet(); await closeAll(); await go('home');
      const r1 = await page.evaluate(([me]) => {
        const S = OC.Store.s.life.settings, b = OC.Brain.get(me), c = OC.Chars.get(me); S.autonomy = 'full'; S.travel = true; S.lead = true; b.cmdAt = -1e9; b.ledAt = -1e9;
        Object.assign(c.needs, { fun: 20, interest: 20, social: 30, food: 80, sleep: 90, energy: 90, comfort: 80 });
        const n = (m) => { OC.Brain.setControl(me, m); b.cmdAt = -1e9; return OC.Brain.travelCands(c, b).length; };
        const manual = n('manual'), semi = n('semi'), auto = n('auto');
        OC.App.tab('char'); const behindPage = OC.Brain.travelCands(c, b).length; OC.App.tab('island');
        S.lead = false; const off = OC.Brain.travelCands(c, b).length; S.lead = true;
        return { manual, semi, auto, behindPage, off, isManualBrain: !!b.manual };
      }, ids);
      check('1a 操控中的角色：手動模式不會自己想去別的地方；半自動／全自動會；你在看別的頁面、或把設定關掉時不會', r1.isManualBrain && r1.manual === 0 && r1.semi > 0 && r1.auto > 0 && r1.behindPage === 0 && r1.off === 0, r1);
      // it really goes: the same call the AI makes (startTravel) → walks to the door → the place changes → it does what it had in mind
      const plan = await page.evaluate(([me]) => { OC.Brain.setControl(me, 'semi'); const b = OC.Brain.get(me), c = OC.Chars.get(me); b.cmdAt = -1e9; const t = OC.Brain.travelCands(c, b)[0]; OC.Brain.startTravel(b, t.place, t.act); return { place: t.place, act: t.act, from: OC.World.area.id, leaving: !!b.leaving }; }, ids);
      const moved = await page.waitForFunction((p) => OC.World.area && OC.World.area.id === p, plan.place, { timeout: 90000 }).then(() => true).catch(() => false);
      await wait(page, 1500);
      const r2 = await page.evaluate(([me, plan]) => { const b = OC.Brain.get(me), c = OC.Chars.get(me); return { area: OC.World.area.id, player: OC.App.player && OC.App.player.cid === me, loc: c.life.loc, tab: OC.App.curTab, queuedOrDoing: b.queued === plan.act || b.act === plan.act, again: OC.Brain.travelCands(c, b).length, pos: OC.Store.s.pos && OC.Store.s.pos.area }; }, [ids[0], plan]);
      await shot(page, '1-led-to-' + plan.place);
      check('1b 牠真的走出去：畫面跟著換到那個地點、牠就是你操控的角色、接著去做牠原本想做的事；剛到不會馬上又跑走', plan.leaving && moved && r2.area === plan.place && r2.player && r2.loc === plan.place && r2.pos === plan.place && r2.queuedOrDoing && r2.again === 0, { plan, r2 });
      // watching another OC that leaves → we go along and keep watching
      await quiet(); await go('isle');
      const obs = await page.evaluate(([me, mate]) => { const c = OC.Chars.get(mate); c.life.loc = 'isle'; c.life.trip = null; OC.App.syncPresence(); const b = OC.Brain.get(mate); if (!b || !b.a) return { ok: false }; OC.Brain.setControl(mate, 'auto'); b.holds.clear(); OC.App.observe(mate); OC.Brain.startTravel(b, 'street', 'browse'); return { ok: true, bar: !!document.querySelector('.obs-bar') }; }, ids);
      const followed = await page.waitForFunction(() => OC.World.area && OC.World.area.id === 'street', null, { timeout: 90000 }).then(() => true).catch(() => false);
      await page.waitForFunction(() => !!document.querySelector('.obs-bar'), null, { timeout: 15000 }).catch(() => {});
      const r3 = await page.evaluate(([me, mate]) => ({ area: OC.World.area.id, here: !!OC.App.actorOf(mate), bar: (document.querySelector('.obs-bar') || {}).textContent || '', name: OC.Chars.name(OC.Chars.get(mate)), loc: OC.Chars.get(mate).life.loc, trip: !!OC.Chars.get(mate).life.trip }), ids);
      await shot(page, '1-followed-observed');
      check('1c 正在「觀察」的 OC 自己去了別的地方：畫面跟過去、牠就在那裡、繼續觀察牠', obs.ok && obs.bar && followed && r3.area === 'street' && r3.here && r3.bar.includes(r3.name) && r3.loc === 'street' && !r3.trip, { obs, r3 });
      await page.evaluate(() => OC.App.stopObserve()); await go('isle');
    }

    // ================= 2. picture characters: framing, facing, and the picture performs every action =================
    if (want(2)) {
      await quiet(); await closeAll();
      const r = await page.evaluate(async () => {
        const file = async (n) => new File([await (await fetch('/tests/fixtures/' + n)).blob()], n, { type: 'image/png' });
        const c = OC.Chars.blank('import'); const doc0 = await OC.Library.spriteCharFromFiles(c, [await file('wave.png')]); await OC.Anim.preload(doc0); c.profile.name = '圖圖'; c.status.onIsland = true; OC.Chars.add(c);
        const cv = document.createElement('canvas'); cv.width = cv.height = 260; const x = cv.getContext('2d', { willReadFrequently: true });
        const snap = (pose, t = 1) => { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 260, 260); const res = OC.CharRender.draw(x, c, Object.assign({ action: 'idle', at: 0.4, face: 0.8, dir: 'right', noShadow: true }, pose), 130, 225, 2.2, t); const d = x.getImageData(0, 0, 260, 260).data; let n = 0, sx = 0, x0 = 260, x1 = 0, y0 = 260, y1 = 0, hsh = 0; for (let i = 0, p = 0; i < d.length; i += 4, p++) if (d[i + 3] > 40) { const px = p % 260, py = (p / 260) | 0; n++; sx += px; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; hsh = (hsh * 31 + px * 7 + py * 13 + d[i]) | 0; } return { n, cx: sx / Math.max(1, n), x0, x1, y0, y1, h: y1 - y0, w: x1 - x0, hsh, data: d.slice(0), puppet: res.puppet, mirror: res.mirror }; };
        const mirrorSame = (A, B) => { let same = 0, tot = 0; for (let y = 0; y < 260; y += 2) for (let px = 0; px < 260; px += 2) { const a = A.data[(y * 260 + px) * 4 + 3] > 40, b = B.data[(y * 260 + (259 - px)) * 4 + 3] > 40; if (a || b) { tot++; if (a === b) same++; } } return same / Math.max(1, tot); };
        const same = (A, B) => { let s2 = 0, tot = 0; for (let i = 3; i < A.data.length; i += 8) { const a = A.data[i] > 40, b = B.data[i] > 40; if (a || b) { tot++; if (a === b) s2++; } } return s2 / Math.max(1, tot); };
        const out = { id: c.id, mode: c.appearance.mode };
        // --- facing: one picture, mirrored by the walking direction (default), never when the art is front-facing, flipped when the player says so
        const R = snap({ face: 0.8, dir: 'right' }), L = snap({ face: -0.8, dir: 'left' });
        out.face = { rl: +mirrorSame(R, L).toFixed(3), differ: +same(R, L).toFixed(3), mirR: R.mirror, mirL: L.mirror };
        c.appearance.frame = { faces: 'front' }; const F1 = snap({ face: 0.8 }), F2 = snap({ face: -0.8, dir: 'left' }); out.front = +same(F1, F2).toFixed(3);
        c.appearance.frame = { flip: true }; const FL = snap({ face: 0.8 }); out.flip = +mirrorSame(R, FL).toFixed(3); c.appearance.frame = null;
        // --- the picture performs: every action below changes over time, differs from standing still, and draws its marks outside the picture
        const idle = snap({});
        out.acts = {}; for (const act of ['walk', 'eat', 'sleep', 'happy', 'sad', 'angry', 'surprised', 'talk', 'dance', 'cry', 'hug', 'giggle']) {
          const fr = [0.05, 0.22, 0.41, 0.63, 0.88].map((at, i) => snap(Object.assign({ action: act, at }, act === 'walk' ? { walk: 1, phase: at * 4 } : {}), 1 + at));
          const outside = Math.max(...fr.map((f) => { let n = 0; for (let i = 3, p = 0; i < f.data.length; i += 4, p++) if (f.data[i] > 40) { const py = (p / 260) | 0, px = p % 260; if (py < idle.y0 - 3 || px < idle.x0 - 4 || px > idle.x1 + 4) n++; } return n; }));
          out.acts[act] = { frames: new Set(fr.map((f) => f.hsh)).size, vsIdle: +Math.min(...fr.map((f) => same(f, idle))).toFixed(3), outside, puppet: fr[0].puppet };
        }
        // --- an action the player drew plays as drawn (no puppet), the others still perform
        const walk = []; for (let i = 1; i <= 6; i++) walk.push(await file(`walk_${i}.png`));
        const src = await OC.Library.framesFromFiles(walk), cs = OC.Library.process(src.frames, { trim: true }), made = await OC.Library.makeAnim(cs, { name: '走路', owner: c.id, action: 'walk' }); OC.Anim.assign(c, 'walk', 'any', made.doc.id); await OC.Anim.preload(made.doc);
        out.own = { walk: OC.CharRender.plan(c, { action: 'walk', at: 0.2, walk: 1, phase: 1, face: 0.8 }).puppet, eat: OC.CharRender.plan(c, { action: 'eat', at: 0.2, face: 0.8 }).puppet, run: OC.CharRender.plan(c, { action: 'run', at: 0.2, walk: 1, phase: 1, face: 0.8 }).puppet };
        // --- framing: zoom, offset, crop (the feet stay on the ground), reset
        const base = snap({});
        c.appearance.frame = { zoom: 1.5 }; const Z = snap({}); c.appearance.frame = { dx: 20 }; const DX = snap({}); c.appearance.frame = { dy: -20 }; const DY = snap({});
        c.appearance.frame = { crop: { t: 0.3, l: 0, r: 0, b: 0 } }; const CT = snap({}); c.appearance.frame = { crop: { t: 0, l: 0, r: 0, b: 0.25 } }; const CB = snap({}); c.appearance.frame = { crop: { t: 0, l: 0.3, r: 0, b: 0 } }; const CL = snap({});
        c.appearance.frame = null; const back = snap({});
        out.frame = { zoom: +(Z.h / base.h).toFixed(2), dx: Math.round(DX.cx - base.cx), dy: Math.round(DY.y1 - base.y1), cropTop: CT.y0 - base.y0, cropTopH: +(CT.h / base.h).toFixed(2), cropBottomFeet: CB.y1 - base.y1, cropBottomH: +(CB.h / base.h).toFixed(2), cropLeft: +(CL.w / base.w).toFixed(2), reset: back.hsh === base.hsh, unit: 2.2 * 50 };
        OC.Store.touch('chars'); return out;
      });
      const pic = r.id;
      check('2a 圖片角色的朝向：往左走時整張圖鏡像（往右時是原圖）；關掉「跟著轉向」（正面的圖）就不鏡像；「左右翻轉」會把圖翻過來', r.mode === 'sprite' && r.face.rl > 0.97 && r.face.differ < 0.995 && r.face.mirL === true && r.face.mirR === false && r.front > 0.995 && r.flip > 0.97, { face: r.face, front: r.front, flip: r.flip });
      const acts = Object.entries(r.acts);
      check('2b 只有一張圖也會表演：走路、吃飯、睡覺、開心、難過、生氣、驚訝、說話、跳舞、哭、擁抱、咯咯笑——每個動作都會隨時間變化、和站著不同', acts.every(([, v]) => v.puppet && v.frames >= 3 && v.vsIdle < 0.985), r.acts);
      check('2c 外顯的特效畫在圖片外面：睡覺的 Zzz、開心的星星、吃飯的碎屑、生氣的青筋、驚訝的驚嘆號、哭的眼淚…（至少 8 個動作有）', acts.filter(([, v]) => v.outside > 12).length >= 8, Object.fromEntries(acts.map(([k, v]) => [k, v.outside])));
      check('2d 玩家自己畫了「走路」之後，走路就播畫的影格（不再套木偶動作），沒畫的動作（吃飯）仍然由圖片表演；跑步沿用走路的影格', r.own.walk === false && r.own.eat === true && r.own.run === false, r.own);
      check('2e 調整圖片：放大 150%（高度約 1.5 倍）、水平／垂直位移、裁上方（頭頂往下、變矮）、裁下方（腳仍踩在地上）、裁左邊（變窄）；重設後和原本完全一樣', Math.abs(r.frame.zoom - 1.5) < 0.12 && r.frame.dx > 14 && r.frame.dx < 30 && r.frame.dy < -14 && r.frame.cropTop > 10 && r.frame.cropTopH < 0.8 && Math.abs(r.frame.cropBottomFeet) <= 3 && r.frame.cropBottomH < 0.85 && r.frame.cropLeft < 0.85 && r.frame.reset, r.frame);
      // the editor shows the controls for a picture character (and not for a drawn one)
      await page.evaluate((id) => { OC.Chars.setActive(id); OC.Pages.open('charedit', { id }); }, pic); await wait(page, 900);
      const ui = await page.evaluate(() => { const box = document.querySelector('[data-sec=image]'); if (!box) return { has: false }; const t = box.textContent; const sw = box.querySelector('[role=switch], .toggle, input[type=checkbox]'); sw && sw.click(); return { has: true, flipRow: t.includes('左右翻轉'), turn: t.includes('走路時跟著左右轉向'), zoom: t.includes('放大縮小'), crop: t.includes('裁切'), reset: t.includes('全部重設'), sliders: box.querySelectorAll('input[type=range]').length, clicked: !!sw }; });
      await wait(page, 400);
      const draft = await page.evaluate(() => { const box = document.querySelector('[data-sec=image]'); const p = OC.Pages.current && OC.Pages.current(); const txt = box ? box.textContent : ''; return { txt: txt.length }; });
      await shot(page, '2-picture-adjust');
      check('2f 編輯器裡圖片角色有「調整圖片」：左右翻轉、跟著轉向、放大縮小、水平／垂直位置、四邊裁切、全部重設（7 個滑桿）', ui.has && ui.flipRow && ui.turn && ui.zoom && ui.crop && ui.reset && ui.sliders === 7 && ui.clicked, { ui, draft });
      await closeAll(); await page.evaluate(() => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); OC.App.tab('island'); }); await wait(page, 500);
      // on the desktop too: the exported frames of an action the player did not draw are animated
      const pet = await page.evaluate(async (id) => { const c = OC.Chars.get(id); const pack = await OC.PetSync.renderSprites(c); const a = pack.manifest.anims; const distinct = (k) => new Set(a[k].frames.map((f) => pack.files[f])).size; return { eat: distinct('eat'), sleep: distinct('sleep'), happy: distinct('happy'), walkSrc: a.walk.src, eatSrc: a.eat.src }; }, pic);
      check('2g 桌寵也一樣：輸出到桌面的影格裡，沒畫過的動作（吃飯、睡覺、開心）是會動的（不是同一張圖重複）', pet.eat >= 3 && pet.sleep >= 2 && pet.happy >= 3, pet);
      await page.evaluate(([me]) => OC.Chars.setActive(me), ids); await wait(page, 600);
    }

    // ================= 3. traits: many more, each with a real effect; contradictions shown; random =================
    if (want(3)) {
      await quiet(); await closeAll();
      const r = await page.evaluate(([me, mate]) => {
        const T = OC.Chars.TRAITS, X = OC.Traits13, out = { n: T.length, new: X.NEW.length, groups: [...new Set(T.map((t) => t.g))] };
        out.noFx = X.NEW.filter((t) => !Object.keys(t.fx).length).map((t) => t.id);
        out.asym = T.filter((t) => t.x.some((x) => !X.byId[x].x.includes(t.id))).map((t) => t.id);
        const D = OC.LifeData; out.badAct = []; out.badNeed = []; out.badEmo = []; out.badSoc = [];
        for (const t of X.NEW) { for (const k of Object.keys(t.fx.act || {})) if (!D.ACTS[k]) out.badAct.push(t.id + ':' + k); for (const k of Object.keys(t.fx.need || {})) if (!D.NEEDS.find((n) => n.id === k)) out.badNeed.push(t.id + ':' + k); for (const k of Object.keys(t.fx.emo || {})) if (!D.EMOTIONS[k]) out.badEmo.push(t.id + ':' + k); for (const k of Object.keys(t.fx.soc || {})) if (!D.SOCIAL[k]) out.badSoc.push(t.id + ':' + k); }
        out.noLines = X.NEW.filter((t) => !D.LINES.some((l) => l.c && l.c.trait === t.id)).map((t) => t.id);
        // observable effects through the real engine functions
        const c = OC.Chars.get(me), b = OC.Brain.get(me), keep = c.personality.traits.slice();
        const score = (tr, act) => { c.personality.traits = tr; return OC.Brain.actScore(c, b, act).s; };
        out.fish = +(score(['angler'], 'fish') - score([], 'fish')).toFixed(2); out.tidy = +(score(['messy'], 'tidy') - score([], 'tidy')).toFixed(2);
        const dec = (tr, need) => { c.personality.traits = tr; const n0 = Object.assign({}, c.needs); c.needs[need] = 80; OC.Mind.tickNeeds(c, 60, {}); const d = 80 - c.needs[need]; Object.assign(c.needs, n0); return d; };
        out.social = +(dec(['clingy'], 'social') / dec([], 'social')).toFixed(2); out.social2 = +(dec(['aloof'], 'social') / dec([], 'social')).toFixed(2);
        const feel = (tr) => { c.personality.traits = tr; c.life.emo.list = []; c.life.emo.cd = {}; return OC.Mind.feel(c, 'nervous', 0.4, 't' + Math.random()); };
        out.nervous = [+feel(['timid']).toFixed(2), +feel([]).toFixed(2), +feel(['calm']).toFixed(2)];
        c.personality.traits = ['hotheaded']; const sp1 = OC.Chars.behavior(c).speed; c.personality.traits = []; out.speed = +(sp1 / OC.Chars.behavior(c).speed).toFixed(2);
        // a line of its own
        c.personality.traits = ['angler']; OC.Store.s.life.settings.tone = 'mature'; let own = 0; for (let i = 0; i < 300; i++) { OC.Store.s.life.said = {}; const ln = OC.Talk.pick('chat_player', c, null); if (ln && ln.line.c && ln.line.c.trait === 'angler') own++; } out.ownLines = own;
        c.personality.traits = keep;
        // contradictions + random
        out.clash = X.clashes(['shy', 'lazy']); out.valid = [X.valid(['shy', 'outgoing']), X.valid(['shy', 'quiet', 'patient'])];
        let ok = true, sizes = new Set(); for (let i = 0; i < 300; i++) { const t = X.randomTraits(); sizes.add(t.length); if (!X.valid(t) || new Set(t).size !== t.length || t.length < 3 || t.length > 5) ok = false; } out.random = { ok, sizes: [...sizes].sort() };
        const m = OC.Chars.get(mate); OC.Taste.setPref(m, 'apple', 2); const rt = X.randomTastes(m); out.tastes = { likes: rt.likes.length, items: m.tastes.likeItems.length, dis: m.tastes.dislikeItems.length, flavors: Object.keys(m.tastes.flavor).length, lockedKept: m.tastes.food.apple && m.tastes.food.apple.lv === 2 && m.tastes.food.apple.locked === true, overlap: m.tastes.likeItems.some((i) => m.tastes.dislikeItems.includes(i)) };
        return out;
      }, ids);
      check('3a 特質大量擴充（原本 32 個 → 79 個），新特質每一個都有實際效果與自己的台詞；衝突關係是雙向的；資料沒有指向不存在的活動／需求／情緒', r.n >= 75 && r.new >= 45 && !r.noFx.length && !r.asym.length && !r.badAct.length && !r.badNeed.length && !r.badEmo.length && !r.badSoc.length && !r.noLines.length, { n: r.n, new: r.new, noFx: r.noFx, asym: r.asym, bad: [r.badAct, r.badNeed, r.badEmo, r.badSoc], noLines: r.noLines });
      check('3b 效果量得到：釣魚迷更想釣魚、隨性的不想整理、黏人的社交需求掉得快／我行我素掉得慢、膽小更容易緊張／沉穩不容易、急性子走得快、有自己的台詞', r.fish > 0.4 && r.tidy < -0.3 && r.social > 1.2 && r.social2 < 0.8 && r.nervous[0] > r.nervous[1] && r.nervous[1] > r.nervous[2] && r.speed > 1.08 && r.ownLines >= 8, { fish: r.fish, tidy: r.tidy, social: [r.social, r.social2], nervous: r.nervous, speed: r.speed, ownLines: r.ownLines });
      check('3c 衝突：選了「害羞＋懶散」後，外向／健談／愛運動／坐不住…都標成衝突並說明是被誰擋住；隨機 300 次都沒有矛盾、3–5 個、不重複', r.clash.outgoing && r.clash.outgoing.includes('shy') && r.clash.sporty && r.clash.sporty.includes('lazy') && r.valid[0] === false && r.valid[1] === true && r.random.ok && r.random.sizes.length >= 2, { clash: Object.keys(r.clash), random: r.random });
      check('3d 喜好與口味也能隨機：喜歡／討厭的東西、物品喜好（不重疊）、口味；你親手設定並鎖定的食物喜好不會被改掉', r.tastes.likes >= 2 && r.tastes.items === 3 && r.tastes.dis === 2 && r.tastes.flavors === 3 && r.tastes.lockedKept && !r.tastes.overlap, r.tastes);
      // the editor: pick a trait → the contradicting tiles are marked with the reason; the random buttons work
      await page.evaluate((id) => OC.Pages.open('charedit', { id }), ids[0]); await wait(page, 700);
      await page.evaluate(() => { const t = [...document.querySelectorAll('[role=tab], .seg button, .chip-btn')].find((b) => b.textContent.trim() === '個性'); t && t.click(); }); await wait(page, 600);
      const ui = await page.evaluate(async () => {
        const tile = (id) => document.querySelector(`.tile[data-v="${id}"]`); const p = () => OC.Pages.cur && OC.Pages.cur(); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        if (!tile('shy')) return { has: false };
        for (const b of [...document.querySelectorAll('.tile.on[data-v]')]) b.click(); await sleep(100);
        tile('shy').click(); await sleep(150);
        const out = { has: true, shyOn: tile('shy').classList.contains('on'), outgoingClash: tile('outgoing').classList.contains('clash'), tag: tile('outgoing').querySelector('.clash-tag').textContent, talkClash: tile('talkative').classList.contains('clash'), hint: document.querySelector('.trait-hint').textContent };
        tile('outgoing').click(); await sleep(150); out.refused = !tile('outgoing').classList.contains('on');
        document.querySelector('[data-act=random-traits]').click(); await sleep(200); out.randomOn = document.querySelectorAll('.tile.on[data-v]').length; out.anyOnClash = !!document.querySelector('.tile.on.clash');
        return out;
      });
      await shot(page, '3-traits-clash');
      check('3e 編輯器：選「害羞」後「外向」「健談」變暗並標「和『害羞』衝突」、上方列出不能選的；硬點衝突的會被拒絕；「隨機」一鍵選好 3–5 個', ui.has && ui.shyOn && ui.outgoingClash && ui.tag.includes('害羞') && ui.talkClash && ui.hint.includes('外向') && ui.refused && ui.randomOn >= 3 && ui.randomOn <= 5 && !ui.anyOnClash, ui);
      await closeAll(); await page.evaluate(() => { OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); OC.App.tab('island'); }); await wait(page, 400);
    }

    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.stack || e)); }
  await browser.close();
  const bad = H.results.filter((r) => !r.ok); console.log(`\n${H.results.length - bad.length}/${H.results.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
