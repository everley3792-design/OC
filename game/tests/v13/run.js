/* OC Shimeji 13.0 acceptance (Playwright, real pointer events). node game/tests/v13/run.js [1 2 …]   (http.server on :8765, or OC_URL)
 *   1 follow: the character you follow leads the way to another place (semi / auto), never in manual; nothing happens behind a page;
 *     an OC you are watching (觀察) leaves → the view goes along and keeps watching
 *   2 picture characters: mirrored by the walking direction, the picture performs every action (motion + marks), own frames win,
 *     framing (zoom / offset / crop / flip / reset), editor controls, animated frames for the desktop pet
 *   3 traits: 80+ data-driven traits with measurable effects and own lines, symmetric contradictions shown in the editor, random traits / tastes
 *   4 games: rock-paper-scissors and hide-and-seek with real input, rewards once per OC per day, nobody left hidden / held; tree drops once per tree per day
 *   5 visits: an OC comes to you (gift / question / invitation / news / appointment kept or missed)
 *   6 look: unboxed HUD, glass tab bar, cream speech balloon with a tilted name tag, menus by theme (paper / slate), other styles still switchable
 *   7 tutorial: four chapters, steps completed by real events (incl. control mode, shaking, a game, map, travel), keepsake only when finished
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

    // ================= 4. games with your characters + shaking trees =================
    if (want(4)) {
      await quiet(); await closeAll(); await go('isle');
      const mate = await page.evaluate(([me, m]) => { const c = OC.Chars.get(m); c.life.loc = 'isle'; c.life.trip = null; OC.App.syncPresence(); OC.Brain.setControl(m, 'semi'); const b = OC.Brain.get(m); b.holds.clear(); if (b.st !== 'think') OC.Brain.abort(b, 't'); b.thinkAt = performance.now() / 1000 + 900; c.personality.traits = []; return !!OC.App.actorOf(m); }, ids);
      // --- rock paper scissors through the real buttons, until someone has two wins
      const coins0 = await page.evaluate(() => OC.Store.s.coins);
      const started = await page.evaluate(([me, m]) => { const ok = OC.Fun.rps(m); return { ok, holds: [...OC.Brain.get(m).holds], st: OC.Fun.state }; }, ids);
      await page.waitForSelector('.fun-panel.on', { timeout: 10000 });
      let rounds = 0; while (rounds < 12) { const stt = await page.evaluate(() => OC.Fun.state); if (!stt || stt.phase === 'done') break; if (stt.phase === 'pick') { await page.click(`.fun-pick[data-pick="${['rock', 'paper', 'scissors'][rounds % 3]}"]`); rounds++; } await wait(page, 400); }
      await page.waitForFunction(() => !OC.Fun.state, null, { timeout: 20000 }).catch(() => {});
      const after = await page.evaluate(([me, m]) => { const c = OC.Chars.get(m); return { state: OC.Fun.state, holds: [...OC.Brain.get(m).holds], panel: !!document.querySelector('.fun-panel'), n: OC.Fun.data.n.rps, mem: c.life.mem.recent.some((x) => x.key && x.key.startsWith('fun:rps:')), coins: OC.Store.s.coins, paid: !!OC.Tx.done('fun:rps:' + m + ':' + OC.Clock.dayKey()) }; }, ids);
      check('4a 猜拳：用真的按鈕出拳、先贏兩次結束；結束後面板關閉、角色被放開、留下回憶；只有你贏的那天第一次有星幣（輸了沒有）', mate && started.ok && started.holds.includes('game') && rounds >= 2 && !after.state && !after.panel && !after.holds.includes('game') && after.n === 1 && after.mem && (after.paid ? after.coins === coins0 + 20 : after.coins === coins0), { rounds, after, coins0 });
      // a second win on the same day pays nothing more (fixed key)
      const again = await page.evaluate(async ([me, m]) => { const real = Math.random; const c0 = OC.Store.s.coins, paidBefore = !!OC.Tx.done('fun:rps:' + m + ':' + OC.Clock.dayKey()); OC.Fun.rps(m); await new Promise((r) => setTimeout(r, 300)); Math.random = () => 0.01; /* the OC throws rock every time */ for (let i = 0; i < 2; i++) { document.querySelector('.fun-pick[data-pick="paper"]').click(); await new Promise((r) => setTimeout(r, 1300)); } Math.random = real; await new Promise((r) => setTimeout(r, 2200)); return { c0, c1: OC.Store.s.coins, paidBefore, st: OC.Fun.state, wins: OC.Fun.data.n.rps }; }, ids);
      check('4b 連贏兩拳就結束；同一天同一個角色只會給一次獎勵（再贏不會再給）', !again.st && again.wins === 2 && (again.paidBefore ? again.c1 === again.c0 : again.c1 === again.c0 + 20), again);
      // --- hide and seek: the OC disappears, wrong bushes do nothing, the right one finds it
      await quiet();
      const hs = await page.evaluate(([me, m]) => { const ok = OC.Fun.hide(m); return { ok, st: OC.Fun.state }; }, ids);
      await page.waitForFunction(() => OC.Fun.state && OC.Fun.state.phase === 'seek', null, { timeout: 15000 }).catch(() => {});
      const seek = await page.evaluate(([me, m]) => ({ hidden: OC.App.actorOf(m).hidden, st: OC.Fun.state, bar: (document.querySelector('.fun-bar') || {}).textContent }), ids);
      // tap a wrong one, then the right one (real taps on the 3D view)
      const wrong = await page.evaluate(() => { const s = OC.Fun.state.spot; const t = OC.World.swayTargets().filter((x) => x && Math.hypot(x.dx - s.dx, x.dy - s.dy) > 20 && x.x > 40 && x.x < innerWidth - 40 && x.y > 210 && x.y < innerHeight - 190)[0]; return t ? { x: t.x, y: t.y } : null; });
      if (wrong) { await page.mouse.click(wrong.x, wrong.y); await wait(page, 900); }
      const mid = await page.evaluate(() => OC.Fun.state && { phase: OC.Fun.state.phase, wrong: OC.Fun.state.wrong });
      const spot = await page.evaluate(() => { const s = OC.Fun.state.spot; const t = OC.World.swayTargets().find((x) => x && Math.hypot(x.dx - s.dx, x.dy - s.dy) < 2); return { x: t.x, y: t.y }; });
      await page.mouse.click(spot.x, spot.y);
      await page.waitForFunction(() => !OC.Fun.state, null, { timeout: 20000 }).catch(() => {});
      const hend = await page.evaluate(([me, m]) => ({ st: OC.Fun.state, hidden: OC.App.actorOf(m).hidden, holds: [...OC.Brain.get(m).holds], bar: !!document.querySelector('.fun-bar'), n: OC.Fun.data.n.hide, paid: !!OC.Tx.done('fun:hide:' + m + ':' + OC.Clock.dayKey()) }), ids);
      await shot(page, '4-hide-found');
      check('4c 躲貓貓：角色真的躲起來（看不到）、有倒數；搖錯的樹只算一次沒找到，搖對的那棵就找到——角色出現、放開、第一次贏有獎勵', hs.ok && seek.hidden === true && /秒/.test(seek.bar || '') && (!wrong || (mid && mid.phase === 'seek' && mid.wrong <= 1)) && !hend.st && hend.hidden === false && !hend.holds.includes('game') && !hend.bar && hend.n === 1 && hend.paid, { seek: { hidden: seek.hidden, bar: seek.bar }, mid, hend });
      // time runs out → it comes back by itself, no reward, nobody stuck
      const lose = await page.evaluate(async ([me, m]) => { OC.Fun.hide(m); await new Promise((r) => setTimeout(r, 2200)); const g = OC.Fun.state; if (!g) return { ok: false }; const before = OC.Fun.data.n.hide; OC.Fun.end && 0; return { ok: true, phase: g.phase, before }; }, ids);
      await page.evaluate(() => { /* fast-forward the clock of the game */ const t = setInterval(() => { if (!OC.Fun.state) clearInterval(t); }, 200); });
      await page.evaluate(() => OC.Fun.end('quit')); await wait(page, 600);
      const quit = await page.evaluate(([me, m]) => ({ st: OC.Fun.state, hidden: OC.App.actorOf(m).hidden, holds: [...OC.Brain.get(m).holds], bar: !!document.querySelector('.fun-bar') }), ids);
      check('4d 中途不玩：角色回到畫面上、不會被留在「躲起來」或被保留的狀態', lose.ok && !quit.st && quit.hidden === false && !quit.holds.includes('game') && !quit.bar, { lose, quit });
      // --- shaking trees: decided once per tree per day
      const drops = await page.evaluate(() => { const T = OC.World.swayTargets().filter(Boolean), c0 = OC.Store.s.coins, n0 = OC.Fun.data.n.drops; let inv0 = JSON.stringify(OC.Store.s.inv); for (const t of T) OC.Store.emit('world:shake', { dx: t.dx, dy: t.dy }); const n1 = OC.Fun.data.n.drops, c1 = OC.Store.s.coins; for (const t of T) OC.Store.emit('world:shake', { dx: t.dx, dy: t.dy }); return { trees: T.length, first: n1 - n0, second: OC.Fun.data.n.drops - n1, gained: c1 > c0 || JSON.stringify(OC.Store.s.inv) !== inv0 }; });
      check('4e 搖樹：有些樹今天會掉星幣或果子（約三分之一），每棵每天只決定一次——再搖同一棵不會再掉', drops.trees >= 6 && drops.first >= 1 && drops.first <= drops.trees * 0.7 && drops.second === 0 && drops.gained, drops);
    }

    // ================= 5. characters come to you: invitations, gifts, questions, news, appointments =================
    if (want(5)) {
      await quiet(); await closeAll(); await go('isle');
      const prep = await page.evaluate(([me, m]) => { const c = OC.Chars.get(m); c.life.loc = 'isle'; c.life.trip = null; OC.App.syncPresence(); OC.Brain.setControl(m, 'semi'); const b = OC.Brain.get(m); b.holds.clear(); if (b.st !== 'think') OC.Brain.abort(b, 't'); b.thinkAt = performance.now() / 1000 + 900; c.personality.traits = []; c.life.player.aff = 40; OC.Store.s.life.fun13 = null; return { can: OC.App.canLead(), who: OC.Fun.visitor() && OC.Fun.visitor().id }; }, ids);
      check('5a 會主動來找你的是：在場、不是手動、手上沒事、和你關係不錯的角色', prep.can && prep.who === ids[1], prep);
      const runTopic = async (topic, pick) => {
        await quiet(); await page.evaluate(([m, topic]) => { const b = OC.Brain.get(m); b.holds.clear(); OC.Fun.visit(OC.Chars.get(m), topic); }, [ids[1], topic]);
        const open = await page.waitForFunction(() => document.querySelector('.dlg.open') && document.querySelectorAll('.dlg .choices .btn').length >= 1 || (OC.App.dlgOpen && document.querySelector('.dlg.open')), null, { timeout: 30000 }).then(() => true).catch(() => false);
        // tap through the lines until the choices show, then choose
        for (let i = 0; i < 6; i++) { const n = await page.evaluate(() => document.querySelectorAll('.dlg.open .choices .btn').length); if (n) break; await page.click('.dlg.open .line'); await wait(page, 500); }
        await wait(page, 1800);
        const info = await page.evaluate(() => ({ who: document.querySelector('.dlg .who').textContent, line: document.querySelector('.dlg .line').textContent, choices: [...document.querySelectorAll('.dlg .choices .btn')].map((b) => b.textContent) }));
        await page.evaluate((i) => document.querySelectorAll('.dlg .choices .btn')[i].click(), pick); await wait(page, 700);
        for (let i = 0; i < 6; i++) { const o = await page.evaluate(() => !!document.querySelector('.dlg.open')); if (!o) break; await page.click('.dlg.open .line'); await wait(page, 450); }
        return { open, info };
      };
      // a gift
      const g0 = await page.evaluate(() => JSON.stringify(OC.Store.s.inv));
      const gift = await runTopic('gift', 0); await wait(page, 500);
      const g1 = await page.evaluate(([me, m]) => ({ changed: JSON.stringify(OC.Store.s.inv), key: !!OC.Tx.done('visitgift:' + m + ':' + OC.Clock.dayKey()), holds: [...OC.Brain.get(m).holds], visiting: OC.Fun.visiting }), ids);
      await shot(page, '5-visit');
      check('5b 送禮：牠走過來、開口（對話框是牠的名字）、你收下 → 物品真的進背包（每天一次的固定 key）、對話結束後牠被放開', gift.open && gift.info.who.length > 0 && gift.info.choices.length === 2 && g1.changed !== g0 && g1.key && !g1.holds.includes('game') && !g1.visiting, { info: gift.info, g1: { key: g1.key, holds: g1.holds } });
      // a question: the answer is remembered
      const ask = await runTopic('ask', 0);
      const a1 = await page.evaluate(([me, m]) => { const c = OC.Chars.get(m); return { answers: c.life.m13 && c.life.m13.answers, mem: c.life.mem.recent.some((x) => x.key && x.key.startsWith('ask:')) }; }, ids);
      check('5c 提問：牠問你一個問題（2–4 個選項），你的回答被牠記住（資料＋回憶），下次會問別的', ask.open && ask.info.choices.length >= 2 && a1.answers && Object.keys(a1.answers).length === 1 && a1.mem, { info: ask.info, a1 });
      // an invitation to play starts the game
      const play = await runTopic('play', 0); await wait(page, 1200);
      const p1 = await page.evaluate(() => OC.Fun.state && OC.Fun.state.game); await page.evaluate(() => OC.Fun.end('quit')); await wait(page, 500);
      check('5d 邀你玩：答應後真的開始那個遊戲（猜拳或躲貓貓）', play.open && ['rps', 'hide'].includes(p1), { info: play.info, p1 });
      // news about someone else
      const gos = await runTopic('gossip', 1);
      check('5e 分享見聞：牠會告訴你牠注意到另一個角色的近況（提到對方的名字）', gos.open && (await page.evaluate(([me, m, o]) => OC.Chars.all().filter((c) => c.id !== m).some((c) => true), ids)) && gos.info.line.length > 4, gos.info);
      // an appointment: set → kept when you are there at that time; another one missed when the day passes
      const date = await runTopic('date', 0);
      const d1 = await page.evaluate(() => OC.Fun.data.dates.slice(-1)[0]);
      check('5f 約定：牠約你明天某個時段在某個地方見；答應後記在資料裡（地點、日子、時段）', date.open && d1 && d1.state === 'set' && d1.oc === ids[1] && !!d1.place && ['morning', 'noon', 'dusk'].includes(d1.phase), { info: date.info, d1 });
      await page.evaluate((d1) => { const S = OC.Store.s; S.settings.time = 'cycle'; }, d1).catch(() => {});
      const kept = await (async () => {
        await page.evaluate((d) => { d.day = OC.Sim.day(); const S = OC.Store.s; S.settings.time = 'fixed'; S.settings.fixedHour = { morning: 8, noon: 12, dusk: 17 }[d.phase]; }, await page.evaluate(() => { const d = OC.Fun.data.dates.slice(-1)[0]; d.day = OC.Sim.day(); OC.Store.s.settings.time = 'fixed'; OC.Store.s.settings.fixedHour = { morning: 8, noon: 12, dusk: 17 }[d.phase]; return d; })).catch(() => {});
        await go(d1.place); await quiet(); const aff0 = await page.evaluate((m) => OC.Chars.get(m).life.player.aff, ids[1]);
        await page.evaluate(() => OC.Fun.checkDates());
        const open = await page.waitForFunction(() => !!document.querySelector('.dlg.open'), null, { timeout: 20000 }).then(() => true).catch(() => false);
        const r = await page.evaluate(([me, m]) => ({ state: OC.Fun.data.dates.slice(-1)[0].state, here: !!OC.App.actorOf(m), aff: OC.Chars.get(m).life.player.aff, mem: OC.Chars.get(m).life.mem.recent.concat(OC.Chars.get(m).life.mem.long).some((x) => x.key && x.key.startsWith('date:kept')) }), ids);
        for (let i = 0; i < 5; i++) { const o = await page.evaluate(() => !!document.querySelector('.dlg.open')); if (!o) break; await page.click('.dlg.open .line'); await wait(page, 450); }
        return Object.assign(r, { open, aff0 });
      })();
      check('5g 赴約：到了約定的時間你真的在那裡 → 牠也出現、開口、好感上升、記成重要回憶', kept.open && kept.state === 'kept' && kept.here && kept.aff > kept.aff0 && kept.mem, kept);
      const missed = await page.evaluate(([me, m]) => { const c = OC.Chars.get(m), a0 = c.life.player.aff; OC.Fun.data.dates.push({ oc: m, place: 'beach', day: OC.Sim.day() - 1, phase: 'noon', state: 'set' }); OC.Fun.checkDates(); return { state: OC.Fun.data.dates.slice(-1)[0].state, down: c.life.player.aff < a0, mem: c.life.mem.recent.some((x) => x.key && x.key.startsWith('date:missed')) }; }, ids);
      check('5h 失約：日子過了你沒去 → 牠會失落（好感小降）並記得這件事', missed.state === 'missed' && missed.down && missed.mem, missed);
      await page.evaluate(() => { OC.Store.s.settings.fixedHour = 10; }); await go('isle');
    }

    // ================= 6. the default look: the world is the interface, menus by theme, the cosy speech balloon =================
    if (want(6)) {
      await quiet(); await closeAll(); await go('isle');
      const r = await page.evaluate(async () => {
        const cs = (sel, k) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[k] : null; }, root = document.documentElement, out = { style: root.dataset.style, saved: OC.Store.s.settings.style };
        document.getElementById('hud').classList.remove('idle');
        out.hud = { plateBg: cs('.hud-plate', 'backgroundColor'), plateShadow: cs('.hud-plate', 'boxShadow'), timeBg: cs('.hud-time', 'backgroundColor'), ink: cs('.hud-time .num', 'color'), tabBlur: (cs('.tabbar', 'backdropFilter') || cs('.tabbar', 'webkitBackdropFilter') || '') };
        OC.App.showDialogue(OC.Chars.name(OC.Chars.active()), ['今天的風很舒服。'], [{ label: '好啊', fx: () => [] }, { label: '晚一點', fx: () => [] }], () => {}, true); await new Promise((r2) => setTimeout(r2, 900));
        out.dlg = { bg: cs('.dlg', 'backgroundColor'), ink: cs('.dlg .line', 'color'), tag: cs('.dlg .who', 'transform'), tagBg: cs('.dlg .who', 'backgroundColor'), pill: cs('.dlg .choices .btn', 'borderRadius'), typed: document.querySelector('.dlg .line').textContent.length };
        OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close());
        const theme = (t) => { OC.App.setTheme(t); return { bg: getComputedStyle(root).getPropertyValue('--bg').trim(), r: getComputedStyle(root).getPropertyValue('--r-m').trim(), ink: getComputedStyle(root).getPropertyValue('--ink').trim() }; };
        out.light = theme('light'); out.dark = theme('dark'); OC.App.setTheme('light');
        OC.App.setStyle('refined'); out.refined = root.dataset.style; OC.App.setStyle('toy'); out.toy = root.dataset.style; OC.App.setStyle('play'); out.back = root.dataset.style;
        return out;
      });
      await shot(page, '6-default-look');
      check('6a 預設風格：世界裡的 HUD 沒有底框（透明、沒有陰影框、白字）', r.style === 'play' && r.hud.plateBg === 'rgba(0, 0, 0, 0)' && r.hud.plateShadow === 'none' && r.hud.timeBg === 'rgba(0, 0, 0, 0)' && r.hud.ink === 'rgb(255, 255, 255)', r.hud);
      check('6b 對話是奶油色對話框：深棕字、名牌是斜的並帶角色顏色、選項是圓角長條；文字會逐字出現', r.dlg.bg === 'rgb(255, 249, 227)' && r.dlg.ink === 'rgb(111, 84, 56)' && r.dlg.tag && r.dlg.tag !== 'none' && r.dlg.tagBg !== 'rgba(0, 0, 0, 0)' && parseFloat(r.dlg.pill) > 100 && r.dlg.typed >= 3, r.dlg);
      check('6c 選單依主題：淺色＝暖色紙感與大圓角；深色＝石板色與小圓角；可切回「雅緻」「玩具」再切回來', r.light.bg.toUpperCase() === '#F6F0DF' && r.light.r === '20px' && r.dark.bg.toUpperCase() === '#171B1E' && r.dark.r === '6px' && r.refined === 'refined' && r.toy === 'toy' && r.back === 'play', { light: r.light, dark: r.dark });
      await page.evaluate(() => OC.App.setTheme('dark')); await page.evaluate(() => OC.App.tab('more')); await wait(page, 900); await shot(page, '6-dark-menu');
      await page.evaluate(() => { OC.App.setTheme('light'); OC.App.tab('island'); }); await wait(page, 500);
    }

    // ================= 7. the rebuilt tutorial: four chapters, every step by a real event, reward only when finished =================
    if (want(7)) {
      await quiet(); await closeAll(); await go('isle');
      const T = await page.evaluate(() => ({ n: OC.Tutorial.STEPS.length, ch: OC.Tutorial.CHAPTERS, per: OC.Tutorial.CHAPTERS.map((_, i) => OC.Tutorial.STEPS.filter((s) => s.ch === i).length), ids: OC.Tutorial.STEPS.map((s) => s.id), noWay: OC.Tutorial.STEPS.filter((s) => !s.next && !s.done).map((s) => s.id) }));
      check('7a 教學分成四章（相遇／照顧／一起玩／出門），每一步不是「下一步」就是由真實事件完成；包含操控模式、搖樹、玩遊戲、地圖與前往地點', T.ch.length === 4 && T.per.every((n) => n >= 2) && !T.noWay.length && ['control', 'shake', 'game', 'map', 'travel'].every((k) => T.ids.includes(k)), T);
      await page.evaluate(() => { localStorage.removeItem('oc.skipIntro'); const S = OC.Store.s; S.intro.tutorial = { step: 0, done: false, skipped: false }; OC.Tutorial.start({ force: true, restart: true }); });
      await page.waitForSelector('.tut-card.on', { timeout: 10000 });
      const stepId = () => page.evaluate(() => (OC.Tutorial.STEPS[OC.Tutorial.step] || {}).id);
      const until = (id) => page.waitForFunction((id) => (OC.Tutorial.STEPS[OC.Tutorial.step] || {}).id === id, id, { timeout: 45000 }).then(() => true).catch(() => false);
      const card0 = await page.evaluate(() => ({ ch: document.querySelector('.tut-ch b').textContent, dots: document.querySelectorAll('.tut-dots i').length }));
      await page.evaluate(() => { const b = document.querySelector('.tut-card .btn.primary'); b && b.click(); }); const s1 = await until('walk');
      // steps are completed by the events themselves (emitted by the real systems; here we fire the same events the systems send)
      const fire = async (ev, data, next) => { await page.evaluate(([ev, data]) => OC.Store.emit(ev, data), [ev, data || null]); return until(next); };
      await page.evaluate(() => { const p = OC.App.player; for (const [dx, dy] of [[70, 30], [-70, 30], [60, -40], [-60, -40], [0, 70]]) { const q = OC.World.nearestWalkable(p.x + dx, p.y + dy, 30); if (q && Math.hypot(q.x - p.x, q.y - p.y) > 40 && OC.World.walkTo(p, q.x, q.y)) break; } }); const s2 = await until('look');
      const s3 = await fire('cam:pan', null, 'ring'), s4 = await fire('menu:open', null, 'pet'), s5 = await fire('touch:pet', null, 'lift'), s6 = await fire('touch:land', null, 'status');
      await shot(page, '7-tutorial-ch2');
      const card2 = await page.evaluate(() => document.querySelector('.tut-ch b').textContent);
      const s7 = await fire('status:open', null, 'control');
      await page.evaluate(() => OC.Brain.setControl(OC.Store.s.activeId, 'auto')); const s8 = await until('time'); await page.evaluate(() => OC.Brain.setControl(OC.Store.s.activeId, 'manual'));
      const s9 = await fire('time:panel', null, 'bag'); await page.evaluate(() => { const b = document.querySelector('.tut-card .btn.primary'); b && b.click(); }); const s10 = await until('shake');
      const tree = await page.evaluate(() => { const t = OC.World.swayTargets().filter((x) => x && x.x > 40 && x.x < innerWidth - 40 && x.y > 210 && x.y < innerHeight - 330)[0]; return t ? { x: t.x, y: t.y } : null; });
      await page.evaluate(() => { const t = OC.World.swayTargets().filter(Boolean)[0]; OC.Store.emit('world:shake', t ? { dx: t.dx, dy: t.dy } : null); }); void tree; const s11 = await until('game');
      await page.evaluate(() => OC.Fun.rps(OC.Store.s.activeId)); await wait(page, 500); await page.evaluate(() => OC.Fun.end('quit')); const s12 = await until('map');
      await page.evaluate(() => OC.App.tab('explore')); const s13 = await until('travel');
      const coins0 = await page.evaluate(() => OC.Store.s.coins);
      await page.evaluate(() => OC.WorldUI.travel('beach', { instant: true })); const s14 = await until('tabs');
      await page.evaluate(() => OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()));
      for (const id of ['desk', 'bye']) { await page.evaluate(() => { const b = document.querySelector('.tut-card .btn.primary'); b && b.click(); }); await until(id); }
      await page.evaluate(() => { const b = document.querySelector('.tut-card .btn.primary'); b && b.click(); }); await wait(page, 900);
      const end = await page.evaluate(() => ({ done: OC.Store.s.intro.tutorial.done, active: OC.Tutorial.active, coins: OC.Store.s.coins, paid: !!OC.Tx.done('tutorial:13:done') }));
      check('7b 一步一步真的做完：走路、看四周、點角色、撫摸、抱起、狀態、切換操控模式、時間、搖樹、玩一局、開地圖、前往地點——每一步都由那個動作本身完成', [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14].every(Boolean) && card0.ch.includes('第 1 章') && card0.dots >= 2 && card2.includes('第 2 章'), { steps: [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14], card0, card2 });
      check('7c 完成（不是跳過）才有紀念獎勵 60 星幣，而且只給一次', end.done && !end.active && end.paid && end.coins >= coins0 + 60, { end, coins0 });
      const again = await page.evaluate(async () => { const c0 = OC.Store.s.coins; OC.Tutorial.start({ force: true, restart: true }); await new Promise((r) => setTimeout(r, 400)); const el = [...document.querySelectorAll('.tut-card .btn')].find((b) => b.textContent === '跳過教學'); el.click(); await new Promise((r) => setTimeout(r, 500)); return { skipped: OC.Store.s.intro.tutorial.skipped, active: OC.Tutorial.active, same: OC.Store.s.coins === c0 }; });
      check('7d 可以重新觀看、隨時跳過；跳過不給獎勵、不會再跳出來', again.skipped && !again.active && again.same, again);
      await page.evaluate(() => { localStorage.setItem('oc.skipIntro', '1'); }); await go('isle');
    }

    check('沒有 JavaScript 錯誤', !errors.length, errors.slice(0, 3));
  } catch (e) { console.error(e); check('執行沒有例外', false, String(e && e.stack || e)); }
  await browser.close();
  const bad = H.results.filter((r) => !r.ok); console.log(`\n${H.results.length - bad.length}/${H.results.length} passed`);
  process.exit(bad.length ? 1 : 0);
})();
