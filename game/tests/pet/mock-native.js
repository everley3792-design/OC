/* Test double for window.OCNative (the Android bridge) — injected with page.addInitScript before the game loads.
 * It models only what the bridge promises (android/app/src/main/java/app/ocshimeji/bridge/NativeBridge.kt):
 * config / sprite storage with the same validation, the desktop event queue with monotonic seq + ack,
 * permissions, reminders, widget data and a status object. `window.__mock` lets the test act as the
 * desktop (push interactions) and inspect what the game sent. It does NOT simulate the overlay itself —
 * that is Kotlin (core:pet unit tests) and needs a real device (docs/phase7-report.md).
 */
(function () {
  const M = window.__mock = {
    perms: { overlay: false, notifications: 'denied', usage: false, exactAlarm: 'denied' }, sdk: 35,
    running: false, paused: false, config: null, sprites: {}, events: [], seq: 0, acked: 0, reminders: [], widget: null, avatar: null,
    calls: [], requested: [], tests: [], cleared: 0,
    /** the player did something to a pet on the desktop */
    emit(oc, type, data) { M.seq++; M.events.push({ id: M.inst + '-' + M.seq, inst: M.inst, seq: M.seq, t: Date.now(), oc, type, data: data || {} }); M.keep(); return M.seq; },
    // like SharedPreferences + files: the queue and the counter survive a WebView reload (sessionStorage)
    keep() { try { sessionStorage.setItem('mockNative', JSON.stringify({ inst: M.inst, seq: M.seq, events: M.events })); } catch (e) { /* ignore */ } },
  };
  try { const k = JSON.parse(sessionStorage.getItem('mockNative') || 'null'); if (k) { M.inst = k.inst; M.seq = k.seq; M.events = k.events; } } catch (e) { /* ignore */ }
  M.inst = M.inst || 'mk' + Math.random().toString(36).slice(2, 7);
  const log = (k, a) => { M.calls.push([k, a]); };
  window.OCNative = {
    platform: () => 'android', appVersion: () => '0.7.0-alpha (test)', sdkInt: () => M.sdk, bridgeLevel: () => 7,
    getThemeMode: () => 'system', isSystemDark: () => false, setThemeMode: () => {}, insets: () => '0,0,0,0',
    writeBackup: () => true, readBackup: () => '', haptic: () => {}, bootFailed: (t, m) => log('bootFailed', t + m),
    shareFile: () => true, shareSave: () => {},
    permissions: () => JSON.stringify({ sdk: M.sdk, overlay: M.perms.overlay, notifications: M.perms.notifications, notificationsOn: M.perms.notifications !== 'denied', usage: M.perms.usage, exactAlarm: M.perms.exactAlarm, fgsType: M.sdk >= 34 ? 'specialUse' : 'none' }),
    requestPermission: (k) => { M.requested.push(k); },
    canDrawOverlays: () => M.perms.overlay, isPetRunning: () => M.running,
    startPet: () => { log('startPet'); if (!M.perms.overlay) { M.requested.push('overlay'); return; } M.running = true; M.paused = false; },
    stopPet: () => { log('stopPet'); M.running = false; },
    petPause: (p) => { M.paused = !!p; },
    petTest: (oc, a) => { M.tests.push([oc, a]); },
    setPetScale: () => {},
    petConfig: (json) => { try { const o = JSON.parse(json); if (!o || !Array.isArray(o.pets)) return false; M.config = o; log('petConfig', o.pets.length); return true; } catch (e) { return false; } },
    petSprites: (oc, json) => {
      try {
        const o = JSON.parse(json), files = o.files, man = o.manifest;
        if (!man || !man.anims || !Object.keys(man.anims).length) return false;
        for (const [n, v] of Object.entries(files)) { if (!/^[A-Za-z0-9_\-]+\.png$/.test(n)) return false; if (!String(v).startsWith('data:image/png;base64,')) return false; }
        for (const a of Object.values(man.anims)) for (const f of a.frames) if (!files[f]) return false;
        M.sprites[oc] = { manifest: man, files, n: Object.keys(files).length, bytes: Object.values(files).reduce((s, v) => s + v.length, 0) }; return true;
      } catch (e) { return false; }
    },
    petSpriteIndex: () => JSON.stringify(Object.fromEntries(Object.entries(M.sprites).map(([k, v]) => [k.replace(/[^A-Za-z0-9_\-]/g, '_'), Object.keys(v.manifest.anims).length]))),
    savePetSprites: () => false,
    petStatus: () => JSON.stringify(M.running ? { code: M.paused ? 'paused' : 'running', fps: 30, fpsCap: (M.config && M.config.global.fps) || 30, screenOn: true, pets: ((M.config && M.config.pets) || []).map((p) => ({ id: p.id, name: p.name, state: 'IDLE', anim: 'idle', surface: 'FLOOR', x: 0, y: 0, size: 288, sprites: M.sprites[p.id] ? Object.keys(M.sprites[p.id].manifest.anims).length : 0, draws: 1 })), events: M.events.length, fgsType: 'specialUse', error: '' } : { code: 'stopped', msg: '', pets: [] }),
    petEvents: () => JSON.stringify(M.events),
    petAck: (seq) => { M.acked = Math.max(M.acked, seq); M.events = M.events.filter((e) => e.seq > seq); M.keep(); },
    petClearAll: () => { M.cleared++; M.running = false; M.sprites = {}; M.events = []; M.reminders = []; },
    launchableApps: () => JSON.stringify([{ pkg: 'com.example.game', label: '方塊遊戲', sys: 'game' }, { pkg: 'com.example.music', label: '音樂', sys: 'music' }, { pkg: 'com.example.bank', label: '銀行', sys: null }]),
    reminderSet: (json) => { const r = JSON.parse(json); r.id = r.id || 'r' + Date.now(); r.exactActive = !!r.exact && M.perms.exactAlarm === 'granted'; M.reminders = M.reminders.filter((x) => x.id !== r.id).concat(r); return JSON.stringify(r); },
    reminderCancel: (id) => { M.reminders = M.reminders.filter((x) => x.id !== id); },
    reminders: () => JSON.stringify(M.reminders),
    widgetData: (json, png) => { M.widget = JSON.parse(json); M.avatar = png && png.startsWith('data:image/png') ? png.length : 0; return true; },
  };
})();
