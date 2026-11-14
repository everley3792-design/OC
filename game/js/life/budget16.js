/* OC Shimeji — 16.0 OC.Budget: one allowance for everything that asks for the player's attention.
 * Requests, visits ("can I talk to you?"), events that put a question to you, suggestions (habits / traits) — each used to keep its own
 * timer, so together they came far too often. Now they all ask here first:
 *   OC.Budget.can('ask')   → may something turn to the player now?   OC.Budget.spend('ask') → it did.
 * Two clocks must both have passed: minutes of actual PLAY (real time with the game open and running — so a fast game clock cannot
 * flood you) and game minutes (so the slow "real time" clock does not either). How much is one setting, 熱鬧程度
 * (life.settings.lively): quiet / normal (default) / lively. 'legacy' is the pre-16 behaviour, used only by the old test suites.
 * What does not need an answer goes to the mailbox instead (OC.Budget.mail → S().life.mail; shown with the bell and in the phone).
 * Nothing here changes the life simulation itself — characters live exactly as before; this only decides when they may turn to you. */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, Sim = () => OC.Sim;
  const LEVELS = {
    quiet:  { zh: '安靜', d: '角色很少主動找你（大約每 40 分鐘最多一次），其餘寫進信箱。', real: 40, gm: 480, open: 1, ev: 2.5 },
    normal: { zh: '普通', d: '偶爾有人來找你（大約每 20 分鐘最多一次）。預設。', real: 20, gm: 240, open: 1, ev: 1.5 },
    lively: { zh: '熱鬧', d: '常常有人來找你（大約每 8 分鐘最多一次）。', real: 8, gm: 120, open: 2, ev: 1 },
    legacy: { zh: '舊版', d: '', real: 0, gm: 0, open: 2, ev: 1 },
  };
  const level = () => { const v = S().life.settings.lively; return LEVELS[v] ? v : 'normal'; };
  const cfg = () => LEVELS[level()];
  const B = () => { const L = S().life; if (!L.budget) L.budget = { play: 0, lastAsk: 0, lastAskGm: Sim().now(), n: 0 }; return L.budget; };
  /** minutes of play are counted by the app loop (not while paused or hidden) */
  function tick(dt) { if (dt > 0 && dt < 5) B().play += dt; }
  function can(kind) {
    const c = cfg(); if (!c.real && !c.gm) return true;
    if (S().life.settings.autonomy === 'paused') return false;
    const b = B(); void kind;
    return b.play - b.lastAsk >= c.real * 60 && Sim().now() - b.lastAskGm >= c.gm;
  }
  function spend(kind) { const b = B(); b.lastAsk = b.play; b.lastAskGm = Sim().now(); b.n++; b.lastKind = kind || 'ask'; St.touch('life'); }
  /** how long until the next one may come, for the settings page / diagnostics */
  function wait() { const c = cfg(), b = B(); return { realMin: Math.max(0, c.real - (b.play - b.lastAsk) / 60), gameMin: Math.max(0, c.gm - (Sim().now() - b.lastAskGm)) }; }
  const maxOpen = () => cfg().open;
  const eventGap = () => cfg().ev;

  // ---------------- mailbox ----------------
  const MAX_MAIL = 40;
  const box = () => { const L = S().life; if (!L.mail) L.mail = []; return L.mail; };
  /** m = { kind, title, text, oc?, key? } — key makes it once-only */
  function mail(m) {
    const list = box(); if (m.key && list.some((x) => x.key === m.key)) return null;
    const it = { id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), at: Date.now(), gm: Sim().now(), kind: m.kind || 'note', title: m.title || '', text: m.text || '', oc: m.oc || null, key: m.key || null, read: false };
    list.unshift(it); if (list.length > MAX_MAIL) list.length = MAX_MAIL; St.touch('life'); St.emit('mail:new', it); return it;
  }
  const unread = () => box().filter((x) => !x.read).length;
  function readAll() { let n = 0; for (const x of box()) if (!x.read) { x.read = true; n++; } if (n) St.touch('life'); return n; }
  function remove(id) { const L = S().life; L.mail = box().filter((x) => x.id !== id); St.touch('life'); }

  OC.Budget = { LEVELS, level, tick, can, spend, wait, maxOpen, eventGap, mail, box, unread, readAll, remove };
})();
