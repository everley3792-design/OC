/* OC Shimeji — data-driven dialogue engine (Phase 4).
 * Lines = { id, cat, text, c (conditions), w (weight), cd (cooldown, game min), prio, char (only this OC),
 *           reply (category the listener answers with), set / unset (story flags), once }
 * The same category produces different wording per OC: lines are filtered by the speaker's voice
 * (derived from personality + speech style), traits, emotion, needs, relationship, time, weather,
 * place, memories, wishes… then the speech style (OC.Chars.speak: endings, politeness, catchphrase)
 * is applied. Players can add their own lines / events, disable built-in ones and import / export
 * everything as JSON (format: docs/life-format.md). Fully offline.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, M = () => OC.Mind, Sim = () => OC.Sim, D = () => OC.LifeData;
  const has = (c, t) => c && c.personality.traits.includes(t);
  const FORMAT = 'ocshimeji-life', VERSION = 1;

  /** voice family from personality + speech style */
  function voice(c) {
    const p = c.personality, st = c.speech.style;
    if (st === 'cool' || (p.thinking >= 70 && p.expression < 55)) return 'cool';
    if (st === 'cute' || st === 'energetic' || (p.expression >= 60 && p.energy >= 55)) return 'bright';
    if (st === 'polite' || st === 'whisper' || (p.expression < 42 && p.social < 48)) return 'calm';
    return 'plain';
  }
  function cmp(v, expr) {
    if (Array.isArray(expr)) return expr.includes(v);
    if (typeof expr === 'number') return v === expr;
    const m = String(expr).match(/^(>=|<=|>|<|=)?\s*(-?[\d.]+)$/); if (!m) return false;
    const n = +m[2]; switch (m[1] || '=') { case '>=': return v >= n; case '<=': return v <= n; case '>': return v > n; case '<': return v < n; default: return v === n; }
  }
  const any = (x) => [].concat(x);

  /** evaluation context for a speaker (and optional listener) */
  function ctx(sp, ot, extra = {}) {
    const r = ot && sp && ot.id ? M().relPeek(sp.id, ot.id) : null;
    const sh = ot && ot.profile ? M().sharedInterests(sp, ot) : [];
    const mem = extra.mem !== undefined ? extra.mem : M().recall(sp, ot && ot.id ? ot.id : undefined);
    const wish = M().activeWishes(sp)[0] || null;
    const recent = (sp.life.rec.lastAct && D().ACTS[sp.life.rec.lastAct]) ? sp.life.rec.lastAct : null;
    return Object.assign({ sp, ot, r, sh, mem, wish, recent, phase: OC.Clock.phase(OC.Clock.hour()), wx: OC.Clock.weather() }, extra);
  }
  /** does a condition object hold? returns true/false (why[] filled when given) */
  function test(c, X, why) {
    if (!c) return true;
    const sp = X.sp, ot = X.ot, fail = (k) => { if (why) why.push(k); return false; };
    for (const [k, v] of Object.entries(c)) {
      switch (k) {
        case 'voice': if (!any(v).includes(voice(sp))) return fail(k); break;
        case 'trait': if (!any(v).some((t) => has(sp, t))) return fail(k); break;
        case 'notrait': if (any(v).some((t) => has(sp, t))) return fail(k); break;
        case 'otrait': if (!ot || !ot.personality || !any(v).some((t) => has(ot, t))) return fail(k); break;
        case 'style': if (!any(v).includes(sp.speech.style)) return fail(k); break;
        case 'quirk': for (const [q, val] of Object.entries(v)) if (!any(val).includes(sp.quirks[q])) return fail(k); break;
        case 'emo': if (!any(v).includes(M().dominant(sp))) return fail(k); break;
        case 'otherEmo': if (!ot || !ot.life || !any(v).includes(M().dominant(ot))) return fail(k); break;
        case 'phase': if (!any(v).includes(X.phase)) return fail(k); break;
        case 'wx': if (!any(v).includes(X.wx)) return fail(k); break;
        case 'hour': { const h = OC.Clock.hour(); if (!(h >= v[0] && h < v[1])) return fail(k); break; }
        case 'need': for (const [n, e] of Object.entries(v)) if (!cmp(sp.needs[n], e)) return fail(k); break;
        case 'oneed': for (const [n, e] of Object.entries(v)) if (!ot || !ot.needs || !cmp(ot.needs[n], e)) return fail(k); break;
        case 'rel': if (!any(v).includes(X.r ? X.r.type : 'stranger')) return fail(k); break;
        case 'aff': case 'fam': case 'trust': case 'intim': case 'conflict': if (!cmp(X.r ? X.r[k] : 0, v)) return fail(k); break;
        case 'days': { const d = X.r && X.r.since != null ? Sim().day() - X.r.since : -1; if (!cmp(d, v)) return fail(k); break; }
        case 'aff_player': if (!cmp(sp.life.player.aff || 0, v)) return fail(k); break;
        case 'hasMem': if (!!X.mem !== !!v) return fail(k); break;
        case 'hasWish': if (!!X.wish !== !!v) return fail(k); break;
        case 'hasShared': if ((X.sh.length > 0) !== !!v) return fail(k); break;
        case 'hasRecent': if (!!X.recent !== !!v) return fail(k); break;
        case 'hasRecentWith': if (!!X.recentWith !== !!v) return fail(k); break;
        case 'hasHabit': if ((sp.life.habits.length > 0) !== !!v) return fail(k); break;
        case 'busy': if (!!X.busy !== !!v) return fail(k); break;
        case 'app': if (!X.app || !any(v).includes(X.app)) return fail(k); break;
        case 'item': if (!X.item || !any(v).includes(X.item)) return fail(k); break;
        case 'place': if (!X.place || !any(v).includes(X.place)) return fail(k); break;
        case 'act': if (!X.act || !any(v).includes(X.act)) return fail(k); break;
        case 'char': if (!any(v).includes(sp.id)) return fail(k); break;
        case 'other': if (!ot || !any(v).includes(ot.id)) return fail(k); break;
        case 'flag': if (!any(v).every((f) => S().life.flags[f])) return fail(k); break;
        case 'noflag': if (any(v).some((f) => S().life.flags[f])) return fail(k); break;
        case 'romance': if (!ot || !ot.id || M().romanceOK(sp.id, ot.id) !== !!v) return fail(k); break;
        case 'chance': if (Sim().rnd() > v) return fail(k); break;
        default: break;   // unknown keys are ignored (forward compatible); the validator warns about them
      }
    }
    return true;
  }
  const KNOWN = ['voice', 'trait', 'notrait', 'otrait', 'style', 'quirk', 'emo', 'otherEmo', 'phase', 'wx', 'hour', 'need', 'oneed', 'rel', 'aff', 'fam', 'trust', 'intim', 'conflict', 'days', 'aff_player', 'hasMem', 'hasWish', 'hasShared', 'hasRecent', 'hasRecentWith', 'hasHabit', 'busy', 'app', 'item', 'place', 'act', 'char', 'other', 'flag', 'noflag', 'romance', 'chance'];

  /** variables → text; returns null when a variable has no value (that line is skipped) */
  function fill(text, X) {
    const sp = X.sp, ot = X.ot, P = sp.profile;
    const pick = (a) => (a && a.length ? a[Math.floor(Sim().rnd() * a.length)] : null);
    const itemZh = (i) => (OC.Style.ITEMS[i] ? OC.Style.ITEMS[i].zh : i);
    const likes = P.likes.concat(sp.tastes.likeItems.map(itemZh));
    let ok = true;
    const v = {
      name: () => OC.Chars.name(sp), other: () => (ot ? (ot.profile ? OC.Chars.name(ot) : ot.zh || '你') : '你'), pron: () => M().pron(sp), opron: () => (ot && ot.profile ? M().pron(ot) : '你'),
      like: () => pick(likes) || '好吃的東西', hobby: () => pick(P.hobbies) || pick(likes) || '散步', shared: () => pick(X.sh), item: () => (X.item ? itemZh(X.item) : null),
      place: () => X.placeZh || X.place || '這裡', time: () => OC.Clock.PHASE_ZH[X.phase], wx: () => OC.Clock.WX_ZH[X.wx],
      mem: () => (X.mem ? X.mem.text.replace(/^[和跟]/, '和').replace(/。$/, '') : null), wish: () => (X.wish ? X.wish.text : null),
      act: () => D().ACTS[X.act || X.recent] ? D().ACTS[X.act || X.recent].zh : '散步', days: () => (X.days != null ? X.days : X.r && X.r.since != null ? Sim().day() - X.r.since : null),
      emo: () => D().EMOTIONS[M().dominant(sp)].zh, habit: () => (sp.life.habits[0] ? sp.life.habits[0].zh : null), player: () => '你',
    };
    const out = text.replace(/\{(\w+)\}/g, (m, k) => { const f = v[k]; if (!f) return m; const r = f(); if (r == null || r === '') { ok = false; return ''; } return r; });
    return ok ? out : null;
  }

  // ---------------- line library ----------------
  function lines() {
    const L = S().life.dlg, off = new Set(L.off || []);
    return D().LINES.filter((l) => !off.has(l.id)).concat((L.custom || []).filter((l) => !l.disabled));
  }
  const saidOf = (c) => (S().life.said[c.id] = S().life.said[c.id] || {});
  /** choose a line of a category for speaker (→ listener). → { line, text } | null */
  function pick(cat, sp, ot, extra = {}) {
    const X = ctx(sp, ot, extra), gm = Sim().now(), said = saidOf(sp);
    let pool = lines().filter((l) => l.cat === cat && (!l.char || l.char === sp.id) && !(l.once && said[l.id]) && test(l.c, X));
    if (!pool.length) return null;
    const fresh = pool.filter((l) => !(said[l.id] && gm - said[l.id] < (l.cd != null ? l.cd : 90)));
    if (fresh.length) pool = fresh; else pool = pool.slice().sort((a, b) => (said[a.id] || 0) - (said[b.id] || 0)).slice(0, 2);
    const spec = (l) => 1 + 0.35 * (l.c ? Object.keys(l.c).filter((k) => k !== 'voice').length : 0) + (l.c && l.c.voice ? 0.6 : 0);
    for (let tries = 0; tries < 4 && pool.length; tries++) {
      const l = Sim().wpick(pool, (x) => (x.w || 1) * spec(x) * (x.char ? 4 : 1) * (x.prio || 1));
      const t = fill(l.text, X);
      if (t != null) { said[l.id] = gm; if (l.set) S().life.flags[l.set] = gm; if (l.unset) delete S().life.flags[l.unset]; return { line: l, text: t, X }; }
      pool = pool.filter((x) => x !== l);
    }
    return null;
  }
  /** a styled line (speech style, ending, occasional catchphrase), or null */
  function say(cat, sp, ot, extra) {
    const r = pick(cat, sp, ot, extra); if (!r) return null;
    let t = OC.Chars.speak(sp, r.text);
    if ((cat === 'greet' || cat === 'chat_player') && sp.speech.catchphrase && Sim().rnd() < 0.25) t = sp.speech.catchphrase + ' ' + t;
    return { text: t, line: r.line, reply: r.line.reply || null };
  }

  // ---------------- custom content (player-made) ----------------
  function validateLine(l, i) {
    const e = [], w = [];
    if (!l || typeof l !== 'object') return { e: [`第 ${i + 1} 行不是物件`], w };
    if (!l.cat || typeof l.cat !== 'string') e.push(`第 ${i + 1} 行缺少分類 cat`);
    if (!l.text || typeof l.text !== 'string') e.push(`第 ${i + 1} 行缺少台詞 text`);
    else if (l.text.length > 120) e.push(`第 ${i + 1} 行台詞太長（最多 120 字）`);
    if (l.c != null && (typeof l.c !== 'object' || Array.isArray(l.c))) e.push(`第 ${i + 1} 行的條件 c 必須是物件`);
    else if (l.c) for (const k of Object.keys(l.c)) if (!KNOWN.includes(k)) w.push(`第 ${i + 1} 行有不認得的條件「${k}」（會被忽略）`);
    if (l.w != null && !(l.w >= 0)) e.push(`第 ${i + 1} 行的權重 w 必須是正數`);
    if (l.char && !OC.Chars.get(l.char)) w.push(`第 ${i + 1} 行指定的角色不存在（只有該角色會說）`);
    return { e, w };
  }
  const STEP_TYPES = ['go', 'face', 'say', 'anim', 'emote', 'wait', 'cam', 'sound', 'choice', 'fx'];
  function validateEvent(ev, i) {
    const e = [], w = [];
    if (!ev || !ev.id || !Array.isArray(ev.steps) && !ev.social) e.push(`事件 ${i + 1} 缺少 id 或 steps`);
    else for (const s of ev.steps || []) if (!Array.isArray(s) || !STEP_TYPES.includes(s[0])) e.push(`事件「${ev.id}」有不支援的步驟 ${JSON.stringify(s).slice(0, 40)}`);
    if (ev && !['tick', 'relUp', 'dayStart', 'wake', 'wxChange', 'meet', 'actStart', 'actEnd'].includes(ev.trigger)) e.push(`事件「${ev && ev.id}」的觸發條件 trigger 不正確`);
    if (ev && ev.fx && ev.fx.item) w.push(`事件「${ev.id}」會給玩家物品（每天最多一次）`);
    return { e, w };
  }
  /** parse + validate a dialogue/event pack. → { ok, errors, warnings, lines, events, off } */
  function validate(json) {
    let d; try { d = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return { ok: false, errors: ['不是有效的 JSON：' + e.message], warnings: [] }; }
    if (!d || d.format !== FORMAT) return { ok: false, errors: ['不是 OC Shimeji 對話／事件檔（format 應為 ocshimeji-life）'], warnings: [] };
    if (d.version > VERSION) return { ok: false, errors: [`檔案版本 ${d.version} 比 App 支援的 ${VERSION} 新，請先更新 App`], warnings: [] };
    const errors = [], warnings = [], ls = Array.isArray(d.lines) ? d.lines : [], evs = Array.isArray(d.events) ? d.events : [];
    ls.forEach((l, i) => { const r = validateLine(l, i); errors.push(...r.e); warnings.push(...r.w); });
    evs.forEach((ev, i) => { const r = validateEvent(ev, i); errors.push(...r.e); warnings.push(...r.w); });
    if (!ls.length && !evs.length && !(d.off || []).length) errors.push('檔案裡沒有任何台詞或事件');
    return { ok: !errors.length, errors, warnings, lines: ls, events: evs, off: Array.isArray(d.off) ? d.off : [] };
  }
  function uid() { return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36); }
  /** import: mode 'merge' (add, new ids) or 'replace' (replace all custom content) */
  function importData(json, mode = 'merge') {
    const r = validate(json); if (!r.ok) return r;
    const L = S().life.dlg;
    const ls = r.lines.map((l) => Object.assign({}, l, { id: mode === 'merge' || !l.id ? uid() : l.id, custom: true }));
    const evs = r.events.map((e) => Object.assign({}, e, { id: mode === 'merge' ? 'u_' + e.id + '_' + uid() : e.id, custom: true }));
    if (mode === 'replace') { L.custom = ls; L.events = evs; L.off = r.off.slice(); } else { L.custom = L.custom.concat(ls); L.events = L.events.concat(evs); L.off = Array.from(new Set(L.off.concat(r.off))); }
    OC.Store.touch('life', { dlg: true });
    return Object.assign(r, { added: ls.length, addedEvents: evs.length });
  }
  function exportData(o = {}) {
    const L = S().life.dlg;
    return JSON.stringify({ format: FORMAT, version: VERSION, app: 'OC Shimeji', created: new Date().toISOString(), lines: (o.builtin ? D().LINES : []).concat(L.custom.map(({ custom, ...l }) => l)), events: L.events.map(({ custom, ...e }) => e), off: L.off }, null, 1);
  }
  function addLine(l) { const v = validateLine(l, 0); if (v.e.length) return v; const x = Object.assign({ w: 1 }, l, { id: uid(), custom: true }); S().life.dlg.custom.push(x); OC.Store.touch('life', { dlg: true }); return { e: [], w: v.w, line: x }; }
  function updateLine(id, patch) { const l = S().life.dlg.custom.find((x) => x.id === id); if (!l) return false; const n = Object.assign({}, l, patch); const v = validateLine(n, 0); if (v.e.length) return v; Object.assign(l, patch); OC.Store.touch('life', { dlg: true }); return { e: [], w: v.w }; }
  function removeLine(id) { S().life.dlg.custom = S().life.dlg.custom.filter((x) => x.id !== id); OC.Store.touch('life', { dlg: true }); }
  function toggleBuiltin(id, on) { const L = S().life.dlg; L.off = on ? L.off.filter((x) => x !== id) : Array.from(new Set(L.off.concat(id))); OC.Store.touch('life', { dlg: true }); }
  const CATS = () => Array.from(new Set(D().LINES.map((l) => l.cat)));

  OC.Talk = { FORMAT, VERSION, KNOWN, voice, ctx, test, fill, lines, pick, say, validate, importData, exportData, addLine, updateLine, removeLine, toggleBuiltin, CATS, cmp };
})();
