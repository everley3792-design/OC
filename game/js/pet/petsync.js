/* OC Shimeji — Phase 7: desktop pets ↔ game sync (OC.PetSync).
 *
 * The game is the ONLY life simulation. The native overlay (android/…/overlay) shows the OCs on the
 * desktop with a simplified Shimeji brain and never changes needs, so there is no double decay:
 *   game → native   config (which OCs, per-pet settings, performance, app-context rules), a snapshot per OC
 *                   (personality, needs/emotion, bag foods & gifts, pre-rendered lines), and the OC's real
 *                   animations rendered to PNG frames (player frames keep order, per-frame time, loop mode,
 *                   repeat, events, priority; missing actions use the OC.Chars.ACTIONS fallback chain → rig)
 *   native → game   interactions on the desktop as an event queue (pet / feed / gift / meet / tool / setting)
 *                   with monotonic seq ids. pull() runs after OC.Sim.catchUp (lifecycle resume), applies each
 *                   event ONCE (seq watermark + OC.Tx fixed keys `pet:<id>`), emits OC.Progress like the
 *                   in-game action, then acks. Rewards are never given for offline time or for throwing.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, M = () => OC.Mind, Ch = () => OC.Chars, I = (id) => OC.Style.ITEMS[id];
  const N = () => (typeof window.OCNative !== 'undefined' && window.OCNative && window.OCNative.petConfig ? window.OCNative : null);
  const name = (c) => OC.Chars.name(c);

  // ------------------------------------------------------------------ data
  /** every animation the desktop brain can ask for (core/pet/PetBrain.ANIMS) with rig sampling when no frames exist */
  const ANIMS = {
    idle: { zh: '待機', n: 4, fps: 4 }, walk: { zh: '行走', n: 8, fps: 8, walk: 1 }, run: { zh: '跑步', n: 8, fps: 12, walk: 1 },
    sit: { zh: '坐下', n: 2, fps: 3 }, sleep: { zh: '睡覺', n: 2, fps: 2 }, jump: { zh: '跳躍', n: 6, fps: 10, loop: 'once' },
    fall: { zh: '掉落', n: 2, fps: 6 }, climb: { zh: '攀爬（牆壁）', n: 4, fps: 6, edge: true }, hang: { zh: '吊掛（天花板）', n: 4, fps: 4, edge: true },
    peek: { zh: '偷看（螢幕邊緣）', n: 2, fps: 3, edge: true }, drag: { zh: '被拖曳', n: 2, fps: 6 }, happy: { zh: '開心', n: 4, fps: 8 },
    pet: { zh: '被撫摸', n: 4, fps: 6 }, eat: { zh: '吃東西', n: 6, fps: 8 }, surprised: { zh: '驚訝', n: 4, fps: 8, loop: 'once' },
    talk: { zh: '說話', n: 4, fps: 8 }, greet: { zh: '打招呼', n: 6, fps: 8, loop: 'once' }, sad: { zh: '難過', n: 2, fps: 2 },
    yawn: { zh: '打哈欠', n: 6, fps: 6, loop: 'once' }, shy: { zh: '害羞', n: 2, fps: 3 }, cheer: { zh: '歡呼', n: 6, fps: 10 },
  };
  // 11.0: richer little moments for the desktop pet, taken from the game's action library (OC.Anim11) — the clip length decides the frame count
  for (const [k, zh] of [['wave', '揮手'], ['clap', '拍手'], ['giggle', '咯咯笑'], ['sigh', '嘆氣'], ['sneeze', '打噴嚏'], ['hiccup', '打嗝'], ['aha', '靈光一閃'], ['bow', '鞠躬'], ['spin', '轉圈圈'], ['wiggle', '扭一扭']]) {
    const d = OC.Anim11 && OC.Anim11.LIB && OC.Anim11.LIB[k], dur = d && d.dur ? d.dur : 1.2, n = Math.max(4, Math.min(10, Math.round(dur * 7)));
    ANIMS[k] = { zh, n, fps: Math.round((n / dur) * 10) / 10, loop: 'once' };
  }
  /** desktop line categories → game dialogue categories (LifeData.LINES, variables & conditions apply) */
  const LINE_CATS = {
    greet: ['desk_out'], tap: ['desk_tap'], double: ['chat_player'], wake: ['desk_wake'], pet: ['pet'], drag: ['desk_drag'], drop: ['desk_drop'],
    eat_yum: ['tasted_fav', 'tasted_like'], eat_ok: ['tasted_ok'], eat_no: ['tasted_dislike', 'tasted_hate'], gift: ['receive'],
    idle: ['desk_idle', 'chat_player'], sleepy: ['desk_sleepy'], hungry: ['desk_hungry'], lonely: ['desk_lonely'],
    morning: [['desk_morning', { phase: 'morning' }], ['ev_morning', { phase: 'morning' }]], evening: [['desk_evening', { phase: 'evening' }]],
    memory: ['ev_nostalgia', 'desk_memory'], friend: ['desk_friend'],
    timer_start: ['desk_timer_start'], timer_done: ['desk_timer_done'], rest: ['desk_rest'], remind: ['desk_remind'],
  };
  const APP_CATS = { game: '遊戲', music: '音樂', video: '影片', read: '閱讀・新聞', social: '聊天・社群', work: '工作・文書', browse: '瀏覽器', map: '地圖', photo: '相片', shop: '購物' };
  const CAT_ZH = { greet: '出現在桌面', tap: '點一下', double: '點兩下', wake: '被叫醒', pet: '被摸摸', drag: '被抓起來', drop: '被放下', eat_yum: '吃到喜歡的', eat_ok: '吃到普通的', eat_no: '吃到不喜歡的', gift: '收到禮物', idle: '閒聊', sleepy: '想睡', hungry: '肚子餓', lonely: '寂寞', morning: '早上', evening: '晚上', memory: '想起回憶', friend: '遇到其他 OC', timer_start: '番茄鐘開始', timer_done: '時間到', rest: '提醒休息', remind: '提醒事項' };
  for (const k of Object.keys(APP_CATS)) { LINE_CATS['app_' + k] = [['app', { app: k === 'social' ? 'chat' : k }], ['desk_app', { app: k }]]; CAT_ZH['app_' + k] = '正在用：' + APP_CATS[k]; }

  // new dialogue (data, same format as LifeData.LINES: [cat, text, conditions, weight])
  (function lines() {
    const D = OC.LifeData; if (!D || !D.LINES) return;
    const P = { voice: 'plain' }, B = { voice: 'bright' }, C = { voice: 'calm' }, K = { voice: 'cool' };
    const L = [
      ['desk_out', '我來陪你了！', P], ['desk_out', '桌面好大喔——我要去探險！', B], ['desk_out', '……我就在旁邊，有事叫我。', C], ['desk_out', '嗯，來了。', K], ['desk_out', '那、那個……我可以待在這裡嗎？', { trait: 'shy' }, 3],
      ['desk_tap', '嗯？', P], ['desk_tap', '嘿嘿，找我嗎？', B], ['desk_tap', '……怎麼了？', C], ['desk_tap', '別戳啦。', K], ['desk_tap', '呀！嚇我一跳……', { trait: 'shy' }, 2],
      ['desk_wake', '唔……我醒了……', P], ['desk_wake', '早安！……現在是早上嗎？', B], ['desk_wake', '……再讓我睡五分鐘。', K],
      ['desk_drag', '哇啊——要去哪裡？', P], ['desk_drag', '飛起來了！', B], ['desk_drag', '……放我下來。', K], ['desk_drag', '好、好高……', { trait: 'shy' }, 2],
      ['desk_drop', '安全著地！', P], ['desk_drop', '再一次再一次！', B], ['desk_drop', '……下次輕一點。', C],
      ['desk_idle', '你在忙什麼呀？', P], ['desk_idle', '今天也要加油喔！', B], ['desk_idle', '……我在這裡看著你。', C], ['desk_idle', '無聊的話可以戳我。', K],
      ['desk_idle', '小島上的{wx}天不知道怎麼樣了。', P], ['desk_idle', '我剛剛在想{recent}的事。', { hasRecent: true }, 2], ['desk_idle', '我想要{wish}……', { hasWish: true }, 2],
      ['desk_sleepy', '好睏……', P], ['desk_sleepy', '眼皮好重……', C], ['desk_sleepy', '你也早點睡喔……', { phase: 'night' }, 2],
      ['desk_hungry', '肚子咕嚕咕嚕叫了……', P], ['desk_hungry', '有沒有點心呀？', B], ['desk_hungry', '……想吃東西。', K],
      ['desk_lonely', '陪我說說話好不好……', P], ['desk_lonely', '大家都在忙嗎……', C],
      ['desk_morning', '早安！今天也一起加油！', P], ['desk_morning', '早——安——！', B], ['desk_morning', '……早。', K],
      ['desk_evening', '今天辛苦了。', P], ['desk_evening', '晚上了，記得休息喔。', C], ['desk_evening', '晚餐吃什麼呀？', B],
      ['desk_memory', '還記得{mem}嗎？', { hasMem: true }], ['desk_memory', '我常常想起{mem}。', { hasMem: true, voice: 'calm' }, 2],
      ['desk_friend', '是你呀！', P], ['desk_friend', '一起玩吧！', B], ['desk_friend', '……嗯，你也在。', K],
      ['desk_timer_start', '專心時間開始！我會安靜的。', P], ['desk_timer_start', '加油加油！', B], ['desk_timer_start', '……我陪你。', C],
      ['desk_timer_done', '時間到！休息一下吧！', P], ['desk_timer_done', '做得好！好厲害！', B], ['desk_timer_done', '……辛苦了。', C],
      ['desk_rest', '站起來伸展一下吧～', P], ['desk_rest', '眼睛也要休息喔。', C], ['desk_rest', '喝口水吧！', B],
      ['desk_remind', '提醒你一下喔！', P], ['desk_remind', '別忘了這件事！', B],
      ['desk_app', '打電動嗎？我幫你加油！', { app: ['game'] }], ['desk_app', '這首歌好好聽～', { app: ['music'] }], ['desk_app', '在看什麼影片？', { app: ['video'] }],
      ['desk_app', '在讀什麼呀？', { app: ['read'] }], ['desk_app', '工作辛苦了，我不吵你。', { app: ['work'] }], ['desk_app', '要去哪裡呀？', { app: ['map'] }],
      ['desk_app', '這張照片好可愛！', { app: ['photo'] }], ['desk_app', '要買什麼？我也想看！', { app: ['shop'] }], ['desk_app', '在找什麼資料嗎？', { app: ['browse'] }],
    ];
    const base = D.LINES.length;
    L.forEach((x, i) => D.LINES.push({ id: 'p7_' + (base + i), cat: x[0], text: x[1], c: x[2] || null, w: x[3] || 1 }));
  })();

  // ------------------------------------------------------------------ settings (save: S.pet)
  const DEF_ONE = { size: 1, opacity: 1, autonomy: 1, climb: true, ceiling: true, peek: true, run: true, jump: true, drag: true, doubleTap: 'open', talk: 'normal', mute: false, map: {} };
  function P() { return S().pet; }
  /** per-OC desktop settings — always the SAME object (pages keep a reference while editing) */
  function one(id) { const p = P(), o = (p.per[id] = p.per[id] || {}); for (const [k, v] of Object.entries(DEF_ONE)) if (o[k] === undefined) o[k] = k === 'map' ? {} : v; return o; }
  function on() { const p = P(); p.on = p.on.filter((id) => Ch().get(id)); if (!p.on.length) { const c = Ch().get(S().petId) || Ch().active(); if (c) p.on = [c.id]; } return p.on.slice(0, p.global.maxPets); }
  function setOn(id, v) { const p = P(); if (v) { if (!p.on.includes(id)) { if (p.on.length >= p.global.maxPets) return false; p.on.push(id); } } else p.on = p.on.filter((x) => x !== id); St.touch('pet'); return true; }
  function save(why) { St.touch('pet', { why }); }

  // ------------------------------------------------------------------ snapshot → native
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  function traits(c) {
    const pp = c.personality, has = (t) => Ch().has(c, t);
    return { energy: clamp01(pp.energy / 100 + (has('energetic') ? 0.15 : 0) - (has('lazy') ? 0.15 : 0)), social: clamp01(pp.social / 100), curious: clamp01((has('curious') ? 0.8 : 0.4) + (pp.thinking - 50) / 250), shy: clamp01(has('shy') ? 0.8 : 0.45 - pp.expression / 250), pace: clamp01(pp.pace / 100) };
  }
  function mood(c) { const n = c.needs; return { energy: clamp01(Math.min(n.energy, n.sleep) / 100), play: clamp01(n.fun / 100), hunger: clamp01(n.food / 100), social: clamp01(n.social / 100), emotion: M().dominant(c) }; }

  /** pre-render up to `max` different lines per category with the dialogue engine; restores its cooldown memory */
  function renderLines(c, others, max = 5) {
    const life = S().life, said = JSON.stringify(life.said), flags = JSON.stringify(life.flags), out = {};
    try {
      for (const [cat, srcs] of Object.entries(LINE_CATS)) {
        const set = new Set();
        for (let k = 0; k < max * 3 && set.size < max; k++) {
          for (const s of srcs) {
            const [gc, extra] = Array.isArray(s) ? s : [s, {}];
            const ot = gc === 'desk_friend' ? others[k % Math.max(1, others.length)] || null : null;
            const r = OC.Talk.say(gc, c, ot, Object.assign({}, extra));
            if (r && r.text) set.add(r.text);
            if (set.size >= max) break;
          }
        }
        const custom = ((P().custom[c.id] || {})[cat] || []).filter((t) => t && t.trim());
        if (set.size || custom.length) out[cat] = [...set, ...custom].slice(0, max + custom.length);
      }
    } finally { life.said = JSON.parse(said); life.flags = JSON.parse(flags); }
    return out;
  }

  function bagFor(c) {
    const foods = [], gifts = [];
    for (const [id, n] of Object.entries(S().inv)) {
      if (n <= 0 || !I(id)) continue;
      const k = OC.Items.useKind(id);
      if (k === 'eat' || k === 'drink') { const pr = OC.Taste.pref(c, id); foods.push({ id, zh: I(id).zh, n, lv: pr.src === 'unknown' ? 0 : pr.lv, known: pr.src !== 'unknown' }); }
      else if (k === 'gift') gifts.push({ id, zh: I(id).zh, n });
    }
    foods.sort((a, b) => b.lv - a.lv || b.n - a.n); gifts.sort((a, b) => b.n - a.n);
    return { foods: foods.slice(0, 12), gifts: gifts.slice(0, 12) };
  }

  function config() {
    const p = P(), ids = on(), data = {}, aff = {};
    for (const id of ids) {
      const c = Ch().get(id), others = ids.filter((x) => x !== id).map((x) => Ch().get(x)).filter(Boolean);
      data[id] = Object.assign({ name: name(c), traits: traits(c), mood: mood(c), lines: renderLines(c, others), title: OC.Growth ? OC.Growth.titleOf(c) || null : null, at: Date.now() }, bagFor(c));
      for (const o of others) { const r = M().relPeek(id, o.id); aff[`${id}>${o.id}`] = r ? Math.max(-1, Math.min(1, (r.aff - r.conflict) / 100)) : 0; }
    }
    return {
      v: 1, at: Date.now(), theme: S().settings.theme,
      global: Object.assign({}, p.global, { theme: S().settings.theme, app: Object.assign({}, p.app) }),
      pets: ids.map((id) => Object.assign({ id, name: name(Ch().get(id)) }, one(id), { map: undefined })),
      data, aff,
    };
  }

  /** push config + snapshot (cheap, a few KB) */
  function push(why) {
    const n = N(); if (!n) return false;
    try { const ok = !!n.petConfig(JSON.stringify(config())); log('push', why || '', ok); return ok; } catch (e) { log('push', 'error ' + e.message, false); return false; }
  }

  // ------------------------------------------------------------------ sprites → native
  const QPX = { low: 96, mid: 128, high: 160 };
  function sourceOf(c, anim) {
    const act = one(c.id).map[anim] || anim;
    const r = OC.Anim.resolve(c, act, 'right');
    const own = r && r.doc && c.actions[r.action];
    return { act, r: own ? r : null, src: own ? 'player' : 'rig', label: own ? `${r.doc.name || Ch().ACTION_ZH[r.action] || r.action}（${OC.Anim.count(r.doc)} 格${r.action !== act ? '・備用：' + (Ch().ACTION_ZH[r.action] || r.action) : ''}）` : '內建骨架' + (act !== anim ? `（${Ch().ACTION_ZH[act] || act}）` : '') };
  }
  function sig(c) {
    const docs = Object.values(c.actions || {}).flatMap((m) => Object.values(m)).map((id) => { const d = OC.Anim.get(id); return d ? d.id + ':' + d.updated : ''; });
    return [c.updated, JSON.stringify(c.look), JSON.stringify(one(c.id).map), P().global.quality, docs.join(','), Object.keys(ANIMS).join(',')].join('|');
  }
  /** render one OC's desktop animations to PNG frames (same box & foot point for every frame) */
  async function renderSprites(c) {
    for (const id of Object.values(c.actions || {}).flatMap((m) => Object.values(m))) { const d = OC.Anim.get(id); if (d) await OC.Anim.preload(d); }
    const px = QPX[P().global.quality] || 128, files = {}, anims = {};
    let k = OC.makeCanvas(px, px), x = k.getContext('2d');
    const shot = (act, at, extra) => { x.clearRect(0, 0, px, px); OC.CharRender.draw(x, c, Object.assign({ action: act, at, dir: 'right', face: 0.6, noShadow: true }, extra || {}), px / 2, px * 0.94, px / 74, at); return k.toDataURL('image/png'); };
    for (const [anim, def] of Object.entries(ANIMS)) {
      const s = sourceOf(c, anim), names = [], durs = [];
      if (s.r) {
        const d = s.r.doc, n = Math.min(48, OC.Anim.count(d)); let t = 0;
        for (let i = 0; i < n; i++) { const nm = `${anim}_${i}.png`; files[nm] = shot(s.act, (t + 1) / 1000 / ((d.speed || 1))); names.push(nm); durs.push(Math.round(OC.Anim.dur(d, i))); t += OC.Anim.dur(d, i); }
        anims[anim] = { frames: names, durs, loop: d.loop || 'loop', repeat: d.repeat || 0, speed: d.speed || 1, priority: d.priority || 0, interruptible: d.interruptible !== false, events: (d.events || []).filter((e) => e.frame < n).map((e) => ({ frame: e.frame, type: e.type, data: typeof e.data === 'string' ? e.data : e.data && e.data.text ? e.data.text : '' })), oriented: !!def.edge && s.r.action === s.act && s.act === anim, src: 'player', doc: d.id };
      } else {
        for (let i = 0; i < def.n; i++) {
          const at = i / def.fps, nm = `${anim}_${i}.png`;
          files[nm] = shot(s.act, at, def.walk ? { walk: 1, phase: i / (def.n / 2) } : anim === 'idle' ? { breath: Math.sin((i / def.n) * Math.PI * 2), blink: i === def.n - 1 ? 1 : 0 } : null);
          names.push(nm); durs.push(Math.round(1000 / def.fps));
        }
        anims[anim] = { frames: names, durs, loop: def.loop || 'loop', repeat: 0, speed: 1, priority: 0, interruptible: true, events: [], oriented: false, src: 'rig' };
      }
    }
    return { manifest: { v: 2, oc: c.id, name: name(c), px, foot: { x: px / 2, y: Math.round(px * 0.94) }, anims, at: Date.now() }, files };
  }
  async function exportSprites(id, force) {
    const n = N(), c = Ch().get(id); if (!n || !c) return false;
    const s = sig(c), was = P().exported[id];
    let idx = {}; try { idx = JSON.parse(n.petSpriteIndex() || '{}'); } catch (e) { /* old shell */ }
    if (!force && was && was.sig === s && idx[id.replace(/[^A-Za-z0-9_-]/g, '_')]) return true;
    const pack = await renderSprites(c);
    let ok = false; try { ok = !!n.petSprites(id, JSON.stringify(pack)); } catch (e) { ok = false; }
    if (ok) { P().exported[id] = { sig: s, at: Date.now(), n: Object.keys(pack.files).length, player: Object.values(pack.manifest.anims).filter((a) => a.src === 'player').length }; save('export'); }
    log('sprites', `${name(c)} ${Object.keys(pack.files).length} 張`, ok);
    return ok;
  }

  /** everything the desktop needs, then start the service (from the pet center button) */
  async function start() {
    const n = N(); if (!n) return { ok: false, why: '需要 Android App' };
    if (!n.canDrawOverlays()) { n.requestPermission ? n.requestPermission('overlay') : n.startPet(); return { ok: false, why: 'permission' }; }
    for (const id of on()) if (!(await exportSprites(id))) return { ok: false, why: '桌寵圖像輸出失敗' };
    push('start'); widget(); n.startPet();
    return { ok: true };
  }
  function stop() { const n = N(); if (n) n.stopPet(); }
  function status() { const n = N(); if (!n || !n.petStatus) return null; try { return JSON.parse(n.petStatus()); } catch (e) { return null; } }
  function perms() { const n = N(); if (!n || !n.permissions) return null; try { return JSON.parse(n.permissions()); } catch (e) { return null; } }

  // ------------------------------------------------------------------ events ← native
  const today = () => OC.Clock.dayKey();
  function capOk(kind, oc, max) {
    const a = P().applied, d = today(); if (a.day !== d) { a.day = d; a.n = {}; }
    const k = kind + ':' + oc; a.n[k] = (a.n[k] || 0) + 1; return a.n[k] <= max;
  }
  const HANDLERS = {
    /** petting on the desktop: same feelings as in-game, affection at most every 10 game minutes, 12 effective per OC per day */
    pet(ev, c) {
      if (!c) return 'no-oc';
      if (!capOk('pet', c.id, 12)) return 'capped';
      const annoyed = M().dominant(c) === 'annoyed';
      if (!annoyed) { M().feel(c, Ch().has(c, 'shy') ? 'shy' : 'happy', 0.3, '在桌面上被你摸摸頭'); M().needs(c, { social: 5 }); }
      const PL = M().player(c); if (!PL.petAt || OC.Sim.now() - PL.petAt > 10) { M().player(c, { aff: annoyed ? 0 : 1, fam: 1 }); PL.petAt = OC.Sim.now(); }
      if (!c.life.deskFirst) { c.life.deskFirst = Date.now(); M().remember(c, { type: 'player', imp: 0.5, text: '第一次在你的手機桌面上被摸摸頭', key: 'desk:first:' + c.id }); }
      OC.Progress && OC.Progress.emit('pet', { oc: c.id, where: 'desktop' });
      return 'ok';
    },
    /** eating on the desktop: the item is used only here, once (OC.Tx key pet:<event id>) */
    feed(ev, c) {
      const id = ev.data && ev.data.item, it = I(id); if (!c || !it) return 'bad';
      const r = OC.Tx.run('pet:' + ev.id, { pay: { items: { [id]: 1 } } }, `${name(c)}在桌面上吃了${it.zh}`, { oc: c.id });
      if (!r.ok) return r.dup ? 'dup' : 'no-item';
      const t = OC.Taste.taste(c, id), fx = Object.assign({}, it.use || { food: 10 });
      if (t.lv >= 2) fx.mood = (fx.mood || 0) + 10; if (t.lv === 1) fx.mood = (fx.mood || 0) + 4; if (t.lv <= -1) { fx.mood = (fx.mood || 0) - (t.lv === -2 ? 10 : 4); if (fx.food) fx.food = Math.round(fx.food * 0.7); }
      M().needs(c, fx, it.zh);
      const emo = { 2: ['excited', 0.6], 1: ['happy', 0.45], 0: ['content', 0.2], '-1': ['confused', 0.3], '-2': ['annoyed', 0.45] }[t.lv];
      M().feel(c, emo[0], emo[1], `在桌面上吃了${it.zh}`); M().player(c, { aff: t.lv >= 1 ? 3 : t.lv === 0 ? 1 : 0, fam: 1 }); M().wishEvent(c, { type: 'fed', item: id }, 'player');
      if (t.first || t.lv === 2 || t.lv === -2) M().remember(c, { type: 'player', imp: t.lv === 2 ? 0.65 : 0.5, text: `在桌面上${t.first ? '第一次吃' : '吃了'}你給的${it.zh}，${OC.Taste.LV[t.lv]}${t.lv >= 1 ? '！' : '…'}`, data: { item: id, lv: t.lv }, key: r.entry.key });
      OC.Progress && OC.Progress.emit('eat', { oc: c.id, item: id, lv: t.lv, first: !!t.first, by: 'player', drink: it.kind === 'drink', where: 'desktop' });
      St.stat('eaten');
      return 'ok';
    },
    gift(ev, c) {
      const id = ev.data && ev.data.item, it = I(id); if (!c || !it) return 'bad';
      const r = OC.Tx.run('pet:' + ev.id, { pay: { items: { [id]: 1 } } }, `在桌面上送給${name(c)}：${it.zh}`); if (!r.ok) return r.dup ? 'dup' : 'no-item';
      const likes = c.tastes.likeItems.includes(id) || (c.profile.likes || []).some((l) => l && it.zh.includes(l)), dis = c.tastes.dislikeItems.includes(id);
      M().feel(c, likes ? 'excited' : dis ? 'confused' : 'happy', likes ? 0.6 : 0.3, `收到你送的${it.zh}`); M().player(c, { aff: likes ? 4 : dis ? 0 : 2, fam: 1 }); M().needs(c, Object.assign({ social: 6 }, it.use || {}));
      M().remember(c, { type: 'player', imp: likes ? 0.6 : 0.4, text: `在桌面上收到你送的${it.zh}`, data: { item: id }, key: r.entry.key });
      OC.Progress && OC.Progress.emit('gift', { oc: c.id, item: id, likes, dis, where: 'desktop' }); St.stat('gifts');
      return 'ok';
    },
    /** two pets met on the desktop: a small, capped relationship step (once per pair per day) */
    meet(ev, c) {
      const o = Ch().get(ev.data && ev.data.with); if (!c || !o) return 'no-oc';
      const k = [c.id, o.id].sort().join('|'); if (!capOk('meet', k, 1)) return 'capped';
      const kind = ev.data.kind, d = kind === 'huff' ? { fam: 1, conflict: 1 } : { fam: 2, aff: kind === 'hug' ? 2 : 1 };
      M().relChange(c.id, o.id, d, '在桌面上碰面'); M().relChange(o.id, c.id, d, '在桌面上碰面');
      M().needs(c, { social: 4 }); M().needs(o, { social: 4 });
      M().remember(c, { type: 'social', imp: 0.3, text: `在桌面上遇到${name(o)}`, who: [o.id], key: `desk:meet:${k}:${today()}` });
      // automatic meetings are not player actions → no quest / achievement progress
      return 'ok';
    },
    /** a reminder / pomodoro fired natively */
    tool(ev) {
      const t = P().tools, d = ev.data || {};
      if (d.kind === 'pomodoro' && d.phase !== 'break') {
        if (t.pomo.day !== today()) { t.pomo.day = today(); t.pomo.today = 0; }
        t.pomo.today++; t.pomo.total = (t.pomo.total || 0) + 1;
        OC.Progress && OC.Progress.emit('pomodoro', { n: t.pomo.today });
        if (t.pomo.auto && t.pomo.brk > 0) Tools.pomodoro('break');
        else t.pomo.active = null;
      } else if (d.kind === 'pomodoro') t.pomo.active = null;
      return 'ok';
    },
    setting(ev) { if (ev.data && 'passthrough' in ev.data) P().global.passthrough = !!ev.data.passthrough; return 'ok'; },
  };

  /** apply desktop events once (after OC.Sim.catchUp) and ack them natively */
  function pull(why) {
    const n = N(); if (!n || !n.petEvents) return { n: 0 };
    let list = []; try { list = JSON.parse(n.petEvents() || '[]'); } catch (e) { return { n: 0, err: e.message }; }
    const a = P().applied, res = { n: 0, skipped: 0, out: {} };
    // seq numbers are per native install: a reinstalled app (new install id) starts again from 1
    const inst = list.length && list[0].inst; if (inst && a.inst !== inst) { a.inst = inst; a.seq = 0; }
    let maxSeq = a.seq || 0;
    for (const ev of list.sort((x, y) => x.seq - y.seq)) {
      if (!ev || typeof ev.seq !== 'number' || ev.seq <= (a.seq || 0)) { res.skipped++; continue; }
      const fn = HANDLERS[ev.type]; let r = 'unknown';
      try { r = fn ? fn(ev, Ch().get(ev.oc)) : 'unknown'; } catch (e) { r = 'error ' + e.message; }
      res.out[r] = (res.out[r] || 0) + 1; res.n++;
      if (r === 'no-item') OC.LifeUI && OC.LifeUI.pushNotice && OC.LifeUI.pushNotice({ info: true, text: `桌面上給的${(I(ev.data && ev.data.item) || { zh: '東西' }).zh}已經不在背包裡，沒有扣除也沒有效果` });
      a.log.unshift({ at: Date.now(), seq: ev.seq, type: ev.type, oc: ev.oc, r }); a.log.length = Math.min(a.log.length, 40);
      maxSeq = Math.max(maxSeq, ev.seq);
    }
    if (maxSeq > (a.seq || 0)) { a.seq = maxSeq; save('pull'); St.persist(); }   // persist BEFORE ack → a crash can never re-apply or lose
    if (list.length) try { n.petAck(maxSeq); } catch (e) { /* old shell */ }
    if (res.n) { log('pull', `${why || ''} ${res.n} 個互動`, true); push('after-pull'); }
    return res;
  }

  // ------------------------------------------------------------------ widget
  /** 8.0 home-screen widget: the chosen OC (or the first desktop pet), two idle frames (open eyes / blink) for the
   *  launcher's ViewFlipper, three chosen needs, the top to-do. The widget never runs the simulation. */
  function wcfg() { const p = P(); return (p.widget = Object.assign({ oc: null, needs: ['food', 'energy', 'mood'], showNeeds: true, showTodo: true }, p.widget || {})); }
  function widget() {
    const n = N(); if (!n || !n.widgetData) return false;
    const W = wcfg(), c = Ch().get(W.oc) || Ch().get(on()[0]) || Ch().active(); if (!c) return false;
    const todo = (P().tools.todos || []).find((t) => !t.done);
    const frame = (blink) => { const cv = OC.makeCanvas(128, 128); OC.CharRender.portrait(cv, c, { pose: { mouth: 'smile', blink: blink ? 1 : 0 } }); return cv.toDataURL('image/png'); };
    const line = (() => { const life = S().life, said = JSON.stringify(life.said); try { const r = OC.Talk.say('desk_idle', c, null); return r ? r.text : ''; } finally { life.said = JSON.parse(said); } })();
    const NZ = Object.fromEntries(OC.LifeData.NEEDS.map((x) => [x.id, x.zh]));
    const emo = (OC.LifeData.EMOTIONS[M().dominant(c)] || {}).e || '';
    try { return !!n.widgetData(JSON.stringify({ name: name(c), mood: `${M().label(c)}${line ? '・' + line : ''}`, moodShort: `${emo ? emo + ' ' : ''}${M().label(c)}`, todo: todo ? todo.text : '', needs: W.needs.slice(0, 3).map((k) => ({ id: k, zh: NZ[k] || k, v: Math.round(c.needs[k] || 0) })), showNeeds: W.showNeeds, showTodo: W.showTodo, avatar2Data: frame(true), at: Date.now() }), frame(false)); } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ tools (pomodoro / rest / alarms; to-dos & notes live in the save)
  const Tools = {
    native: () => !!(N() && N().reminderSet),
    list() { const n = N(); if (!n || !n.reminders) return []; try { return JSON.parse(n.reminders() || '[]'); } catch (e) { return []; } },
    set(r) { const n = N(); if (!n || !n.reminderSet) return null; try { const s = n.reminderSet(JSON.stringify(r)); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    cancel(id) { const n = N(); if (n && n.reminderCancel) n.reminderCancel(id); },
    pomodoro(phase) {
      const t = P().tools.pomo, min = phase === 'break' ? t.brk : t.work;
      const r = Tools.set({ id: 'pomo', kind: 'pomodoro', phase, at: Date.now() + min * 60000, title: phase === 'break' ? '休息結束' : '專注時間結束', text: phase === 'break' ? '準備好再開始下一輪吧' : `完成 ${min} 分鐘專注！`, exact: !!t.exact });
      t.active = r ? { phase, at: r.at, exact: !!r.exactActive } : null; save('pomo');
      if (r) OC.Progress && OC.Progress.emit('pomodoro_start', { phase });
      return r;
    },
    stopPomodoro() { Tools.cancel('pomo'); P().tools.pomo.active = null; save('pomo'); },
    rest(on, every) { const t = P().tools.rest; t.on = on; if (every) t.every = every; if (on) Tools.set({ id: 'rest', kind: 'rest', at: Date.now() + t.every * 60000, repeatMin: t.every, title: '休息一下', text: '站起來動一動、看看遠方吧' }); else Tools.cancel('rest'); save('rest'); },
    alarm(o) { const r = Tools.set(Object.assign({ kind: 'alarm' }, o)); if (r) { P().tools.alarms = (P().tools.alarms || []).filter((a) => a.id !== r.id).concat({ id: r.id, at: r.at, title: r.title, exact: !!r.exact }); save('alarm'); } return r; },
    removeAlarm(id) { Tools.cancel(id); P().tools.alarms = (P().tools.alarms || []).filter((a) => a.id !== id); save('alarm'); },
    todo(text) { const t = P().tools; t.todos.unshift({ id: 't' + Date.now().toString(36), text: String(text).slice(0, 120), done: false, at: Date.now() }); save('todo'); widget(); },
    note(text, id) { const t = P().tools; if (id) { const n = t.notes.find((x) => x.id === id); if (n) { n.text = String(text).slice(0, 2000); n.at = Date.now(); } } else t.notes.unshift({ id: 'n' + Date.now().toString(36), text: String(text).slice(0, 2000), at: Date.now() }); save('note'); },
  };

  // ------------------------------------------------------------------ diagnostics log
  function log(kind, msg, ok) { const L = P().syncLog; L.unshift({ at: Date.now(), kind, msg, ok }); L.length = Math.min(L.length, 30); }

  // ------------------------------------------------------------------ lifecycle
  let tickT = 0;
  function tick(dt) {
    if (!N()) return;
    tickT += dt; if (tickT < 60) return; tickT = 0;
    if (N().isPetRunning()) { pull('tick'); push('tick'); }
  }
  function onPause() { if (!N()) return; if (N().isPetRunning()) push('pause'); widget(); }   // the widget shows the latest state even when the pets are not out
  function onResume() { if (!N()) return; OC.PetSync.pull('resume'); if (N().isPetRunning()) push('resume'); }

  OC.PetSync = { ANIMS, LINE_CATS, CAT_ZH, APP_CATS, DEF_ONE, one, on, setOn, config, push, renderLines, renderSprites, exportSprites, sourceOf, start, stop, status, perms, pull, HANDLERS, widget, wcfg, Tools, tick, onPause, onResume, native: () => !!N(), log };
})();
