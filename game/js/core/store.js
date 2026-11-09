/* OC Shimeji — game state store.
 * One JSON document (schema-versioned) persisted to localStorage, mirrored to the native
 * shell (OCNative.writeBackup) so a cleared WebView cache can be recovered. Every change
 * goes through Store.set/ mutate → emits events → UI patches itself. Nothing here touches
 * the DOM or the renderer.
 */
(function () {
  'use strict';
  const KEY = 'oc.save.v1';
  const NATIVE = typeof window.OCNative !== 'undefined' ? window.OCNative : null;
  const listeners = {};
  const on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); return () => { listeners[ev] = listeners[ev].filter((f) => f !== fn); }; };
  const emit = (ev, data) => { (listeners[ev] || []).forEach((f) => { try { f(data); } catch (e) { console.error('[store]', ev, e); } }); (listeners['*'] || []).forEach((f) => f(ev, data)); };

  function fresh() {
    return {
      v: 7, created: Date.now(), onboarded: false,
      // characters (schema: js/char/model.js) — every page reads these, never a copy
      chars: {}, roster: [], activeId: null, petId: null,
      animations: {},                // animation documents (js/char/anim.js); frames are asset ids
      coins: 300,
      inv: { apple: 2, flower: 1 },  // starter items
      rooms: { isle: [] },           // Phase 5: furniture per place  placeId → [{uid, id, x, y, rot, sc}]
      ledger: { seq: 0, keys: {}, log: [] },   // every coin / item change (OC.Tx) + idempotency keys
      custom: { items: {} },         // workshop products (images in IndexedDB) — registered into the item catalogue
      favs: {},                      // favourite items in the bag
      shops: {},                     // per shop: { day, sold: { id: n } } daily stock
      places: { visited: {}, found: {} },   // place id → first visit; place id → { discoverable id: at }
      garden: {},                    // plot id → { seed, at, water, stage… } (see js/world/places.js)
      stats: { steps: 0, shakes: 0, talks: 0, gifts: 0, placed: 0, anims: 0, eaten: 0, sold: 0, bought: 0, picked: 0, visits: {} },
      quests: { day: '', done: {}, claimed: {} },
      ach: {},                       // id → unlocked timestamp
      // Phase 6: quests (q), character requests (req), claimed achievements, titles, tallies for achievements,
      // special events seen, collection favourites / spotted items, journal favourites
      play: { v: 1, q: { day: '', week: '', list: [], hidden: {}, hprog: {}, chal: {}, n: {} }, req: { list: [], cd: {}, nextAt: 0, n: 0, seq: 0 }, ach: {}, titles: {}, tally: {}, sets: {}, events: {}, spotted: {}, collFav: {}, memFav: {} },
      // Phase 7: desktop pets (js/pet/petsync.js). The native overlay never simulates needs; it only reads a snapshot
      // and sends interactions back (applied once: applied.seq watermark + OC.Tx keys pet:<event id>)
      pet: {
        v: 1, on: [], per: {}, custom: {}, exported: {},
        global: { fps: 30, quality: 'mid', maxPets: 3, pauseScreenOff: true, cacheMB: 24, passthrough: false, bubbles: true, haptics: true },
        app: { enabled: false, useSystem: true, rules: {}, exclude: [], hide: false },
        applied: { seq: 0, day: '', n: {}, log: [] }, syncLog: [],
        tools: { todos: [], notes: [], alarms: [], pomo: { work: 25, brk: 5, auto: true, exact: false, today: 0, day: '', total: 0, active: null }, rest: { on: false, every: 60 } },
      },
      seen: { apple: Date.now(), flower: Date.now() },   // collection: item id → first obtained timestamp (starter items)
      goal: null,                    // life goal id
      world: { trees: {}, shells: { day: '', taken: [] }, mush: { day: '', taken: [] }, lamps: {} },
      // 8.0: first-run & tutorial progress (skip / replay / resume), camera mode
      intro: { seen: false, tutorial: { step: 0, done: false, skipped: false } },
      view: { mode: 'classic', yaw: 0 },
      pos: { area: 'isle', x: 300, y: 470 },
      imports: [],
      // Phase 4: shared life state (js/life/*). Per-OC parts live in chars[id].life
      life: {
        v: 1, clock: { gm: 0 }, lastReal: 0, offline: null,
        rel: {},                     // 'a>b' → directed relationship metrics (OC.Mind.rel)
        flags: {}, said: {},         // story flags; dialogue cooldown memory  charId → lineId → game minute
        ev: { last: {}, once: {}, lastAny: 0, log: [] },   // event engine bookkeeping (no repeats / duplicates)
        dlg: { custom: [], off: [], events: [] },          // player-made dialogue lines / events; disabled built-ins
        notices: [], log: [],
        settings: { autonomy: 'full', travel: true, aspAuto: true, requests: true, playerAuto: false, deny: [], lockRel: false, growth: true, bubbles: true, romance: { enabled: false, adult: {}, forbid: [], fixed: {} } },
      },                   // import log {at, kind, name, n, ok, msg}
      settings: {
        theme: 'system', perf: 'balanced', custom: { fps: 60, shadows: 'low', fx: true, grass: true, scale: 1.5 },
        time: 'real', timeSpeed: 1, weather: 'auto', control: 'tap', haptics: true, showFps: false, reduceMotion: false, petScale: 1,
        sound: { on: true, master: 0.8, ui: 0.6, sfx: 0.8, amb: 0.5, event: 0.8 },
      },
    };
  }

  let S = null, saveTimer = 0, dirty = false;
  function deepMerge(base, over) {
    if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
    const out = Array.isArray(base) ? [] : Object.assign({}, base);
    for (const k of Object.keys(over)) out[k] = (base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null) ? deepMerge(base[k], over[k]) : over[k];
    return out;
  }
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (!raw && NATIVE) { try { raw = NATIVE.readBackup() || null; } catch (e) { /* old shell */ } }
    let data = null;
    if (raw) { try { data = JSON.parse(raw); } catch (e) { console.warn('[store] corrupt save, starting fresh'); } }
    if (data && data.v === 1) data = OC.Chars.migrateV1(data);   // single OC → roster; dataURL anims migrate to assets later
    if (data && data.v === 2) data = migrateV2(data);             // Phase 3 → Phase 4: add life state (additive, nothing removed)
    if (data && data.v === 3) data = migrateV3(data);             // Phase 4 → Phase 5: furniture per place, ledger, workshop products
    if (data && data.v === 4) data = migrateV4(data);             // Phase 5 → Phase 6: quests / requests / achievements (additive)
    if (data && data.v === 5) data = migrateV5(data);             // Phase 6 → Phase 7: desktop pets (additive)
    if (data && data.v === 6) data = migrateV6(data);             // 7 → 8.0: residents opt-in (kept for saves that met them), intro done
    // 12.0: the resident NPCs are gone — their old friendship data and the opt-in flag are dropped on load (every other field is kept)
    if (data && data.v === 7) { delete data.npcs; if (data.world) delete data.world.residents; }
    S = data && data.v === 7 ? deepMerge(fresh(), data) : fresh();
    for (const id of Object.keys(S.chars)) OC.Chars.normalize(S.chars[id]);
    return S;
  }
  /** v2 → v3: life simulation fields. Characters get theirs from OC.Chars.normalize(); old needs keep their values */
  function migrateV2(d) {
    d.v = 3; d.life = d.life || {}; d.life.lastReal = Date.now();   // no offline catch-up across the upgrade
    for (const c of Object.values(d.chars || {})) { if (c.needs) delete c.needs.t; if (c.growth) { c.growth.rejected = c.growth.rejected || {}; c.growth.muted = c.growth.muted || []; } }
    d.migratedV2 = Date.now(); return d;
  }
  /** v3 → v4: island furniture moves into rooms.isle; everything else is additive */
  function migrateV3(d) {
    d.v = 4; d.rooms = d.rooms || {}; d.rooms.isle = (d.rooms.isle || []).concat(d.placed || []); delete d.placed;
    d.migratedV3 = Date.now(); return d;
  }
  /** v4 → v5: play state is added by fresh(); the old daily quest block stays (unused) so nothing is lost */
  function migrateV4(d) { d.v = 5; d.migratedV4 = Date.now(); return d; }
  /** v5 → v6: the single desktop pet (petId + petScale) becomes the first pet of the multi-pet config; the rest comes from fresh() */
  function migrateV5(d) {
    d.v = 6; d.migratedV5 = Date.now();
    if (!d.pet && d.petId) d.pet = { on: [d.petId], per: { [d.petId]: { size: (d.settings && d.settings.petScale) || 1 } } };
    return d;
  }
  /** v6 → v7: (historic) residents were made opt-in here; since 12.0 the resident data is dropped on load. Existing players skip the intro. */
  function migrateV6(d) {
    d.v = 7; d.migratedV6 = Date.now();
    const met = Object.values(d.npcs || {}).some((n) => n && (n.met || n.fr > 0));
    d.world = d.world || {}; if (d.world.residents == null) d.world.residents = met;
    d.intro = d.intro || { seen: !!d.onboarded, tutorial: { step: 99, done: !!d.onboarded, skipped: false } };
    return d;
  }
  function persist() {
    dirty = false; clearTimeout(saveTimer);
    const json = JSON.stringify(S);
    try {
      const prev = localStorage.getItem(KEY); if (prev) localStorage.setItem(KEY + '.prev', prev);   // one-step rollback for crash recovery
      localStorage.setItem(KEY, json);
    } catch (e) { console.warn('[store] localStorage full', e); emit('saveError', e); }
    if (NATIVE) { try { NATIVE.writeBackup(json); } catch (e) { /* ignore */ } }
    emit('saved');
  }
  function touch(ev, data) { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(persist, 600); if (ev) emit(ev, data); }

  // ---------- inventory ----------
  function add(id, n = 1, why) {
    S.inv[id] = (S.inv[id] || 0) + n;
    const first = !S.seen[id]; if (first) S.seen[id] = Date.now();
    touch('inv', { id, n, why, first });
  }
  function take(id, n = 1) {
    if ((S.inv[id] || 0) < n) return false;
    S.inv[id] -= n; if (S.inv[id] <= 0) delete S.inv[id];
    touch('inv', { id, n: -n }); return true;
  }
  const count = (id) => S.inv[id] || 0;
  function coins(d, why) { if (S.coins + d < 0) return false; S.coins += d; touch('coins', { d, why }); return true; }

  // ---------- needs ----------
  const clamp = (v) => Math.max(0, Math.min(100, v));
  /** quiet = mark dirty only (periodic autosave), used for continuous ticks */
  /** needs belong to a character (default: the one being played) */
  function needs(delta, quiet, charId) { const c = S.chars[charId || S.activeId]; if (!c) return; for (const k of Object.keys(delta)) c.needs[k] = clamp(c.needs[k] + delta[k]); if (quiet) { dirty = true; emit('needs', delta); } else touch('needs', delta); }
  function mark() { dirty = true; }
  function stat(k, d = 1) { S.stats[k] = (S.stats[k] || 0) + d; touch('stat', { k, v: S.stats[k] }); }

  function exportJSON() { return JSON.stringify(S); }
  function importJSON(json) {
    let d = JSON.parse(json); if (!d || ![1, 2, 3, 4, 5, 6, 7].includes(d.v)) throw new Error(d && d.v > 7 ? '這個存檔來自較新版本的 App，請先更新' : '不是有效的 OC Shimeji 存檔');
    if (d.v === 1) d = OC.Chars.migrateV1(d);
    if (d.v === 2) d = migrateV2(d);
    if (d.v === 3) d = migrateV3(d);
    if (d.v === 4) d = migrateV4(d);
    if (d.v === 5) d = migrateV5(d);
    if (d.v === 6) d = migrateV6(d);
    delete d.npcs; if (d.world) delete d.world.residents;   // 12.0: no resident NPCs any more
    S = deepMerge(fresh(), d); for (const id of Object.keys(S.chars)) OC.Chars.normalize(S.chars[id]); persist(); emit('reset');
  }
  function reset() { const keepSettings = S.settings; S = fresh(); S.settings = keepSettings; persist(); emit('reset'); }

  OC.Store = {
    load, persist, touch, mark, on, emit, add, take, count, coins, needs, stat, exportJSON, importJSON, reset, fresh,
    get s() { return S; }, get dirty() { return dirty; }, NATIVE,
  };
})();
