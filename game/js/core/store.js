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
      v: 1, created: Date.now(), onboarded: false,
      oc: null,                      // the player's original character (see OC.Style.defaultOC)
      appearance: { mode: 'rig', animId: null },
      coins: 300,
      inv: { apple: 2, flower: 1 },  // starter items
      placed: [],                    // furniture placed on the island {uid, id, x, y, rot}
      npcs: {},                      // id → { fr, met, liked:[], mem:[], lastTalk, lastGift }
      needs: { food: 80, energy: 85, mood: 75, social: 60, t: Date.now() },
      stats: { steps: 0, shakes: 0, talks: 0, gifts: 0, placed: 0, anims: 0, eaten: 0, sold: 0, bought: 0, picked: 0, visits: {} },
      quests: { day: '', done: {}, claimed: {} },
      ach: {},                       // id → unlocked timestamp
      seen: { apple: Date.now(), flower: Date.now() },   // collection: item id → first obtained timestamp (starter items)
      goal: null,                    // life goal id
      world: { trees: {}, shells: { day: '', taken: [] }, mush: { day: '', taken: [] }, lamps: {} },
      pos: { area: 'isle', x: 300, y: 470 },
      anims: [],                     // frame animations from the studio {id, name, fps, w, h, frames:[dataURL]}
      settings: {
        theme: 'system', perf: 'balanced', custom: { fps: 60, shadows: 'low', fx: true, grass: true, scale: 1.5 },
        time: 'real', weather: 'auto', control: 'tap', haptics: true, showFps: false, reduceMotion: false, petScale: 1,
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
    S = data && data.v === 1 ? deepMerge(fresh(), data) : fresh();
    return S;
  }
  function persist() {
    dirty = false; clearTimeout(saveTimer);
    const json = JSON.stringify(S);
    try { localStorage.setItem(KEY, json); } catch (e) { console.warn('[store] localStorage full', e); emit('saveError', e); }
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
  function needs(delta, quiet) { for (const k of Object.keys(delta)) S.needs[k] = clamp(S.needs[k] + delta[k]); if (quiet) { dirty = true; emit('needs', delta); } else touch('needs', delta); }
  function mark() { dirty = true; }
  function stat(k, d = 1) { S.stats[k] = (S.stats[k] || 0) + d; touch('stat', { k, v: S.stats[k] }); }

  function exportJSON() { return JSON.stringify(S); }
  function importJSON(json) {
    const d = JSON.parse(json); if (!d || d.v !== 1) throw new Error('不是有效的 OC Shimeji 存檔');
    S = deepMerge(fresh(), d); persist(); emit('reset');
  }
  function reset() { const keepSettings = S.settings; S = fresh(); S.settings = keepSettings; persist(); emit('reset'); }

  OC.Store = {
    load, persist, touch, mark, on, emit, add, take, count, coins, needs, stat, exportJSON, importJSON, reset, fresh,
    get s() { return S; }, get dirty() { return dirty; }, NATIVE,
  };
})();
