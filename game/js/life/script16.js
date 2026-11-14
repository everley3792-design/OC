/* OC Shimeji — 16.3 player-made event scripts (OC.Script).
 * A small, data-only scene language (nothing in it can run code): a header that says when the scene may happen and who is in it,
 * then the steps — lines, walking, facing, actions, emotes, the camera, choices that branch, labels / goto / if, flags and
 * variables, relationship / feeling / need changes and memories. Any number of scripts, on a character (they travel in its .ocpack)
 * or on the island (imported). Every script is validated; errors name the line. Spec: docs/oc-script.md.
 * The scene runs through OC.Events (one at a time, holds, gaps, the shared allowance, skip ×2) — Events.update calls step().
 * Rules kept: no items or coins (custom content never gives rewards); relationship numbers only (never a relationship type);
 * intimacy never changes for a minor; memories have fixed keys; skipped scenes still apply their data steps.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, Sim = () => OC.Sim, M = () => OC.Mind, D = () => OC.LifeData, B = () => OC.Brain, Wd = () => OC.World, Ch = () => OC.Chars;
  const nowR = () => performance.now() / 1000;
  const ROLES = ['A', 'B', 'C', 'D', 'E', 'F'];
  const TRIGGERS = { tick: 'tick', 常常: 'tick', day: 'dayStart', dayStart: 'dayStart', 每天: 'dayStart', relup: 'relUp', relUp: 'relUp', weather: 'wxChange', wxChange: 'wxChange', arrive: 'arrive', 抵達: 'arrive', wake: 'wake', 起床: 'wake', meet: 'meet', 相遇: 'meet', actEnd: 'actEnd', pet: 'pet', 撫摸: 'pet', manual: 'manual', 手動: 'manual' };
  const TRIG_ZH = { tick: '隨時（每隔幾秒檢查）', dayStart: '每天開始', relUp: '關係變好', wxChange: '天氣改變', arrive: '抵達地點', wake: '起床', meet: '相遇', actEnd: '做完一件事', pet: '被摸摸', manual: '只在手動播放' };
  const RELK = { aff: '好感', fam: '熟悉', trust: '信任', intim: '親密', conflict: '不合', 好感: 'aff', 熟悉: 'fam', 信任: 'trust', 親密: 'intim', 不合: 'conflict' };
  const EMOTE = { heart: '♡', love: '♡', '!': '!', '?': '?', note: '♪', music: '♪', sweat: '💧', anger: '💢', zz: 'z', '...': '…', star: '★', idea: '💡' };
  const PHASES = ['dawn', 'morning', 'day', 'noon', 'afternoon', 'evening', 'night', 'late'];
  const OPS = ['say', 'think', 'narrate', 'move', 'run', 'face', 'anim', 'pose', 'emote', 'wait', 'cam', 'fade', 'bars', 'sound', 'choice', 'label', 'goto', 'if', 'set', 'unset', 'add', 'rel', 'feel', 'need', 'remember', 'end'];
  const OP_ZH = { say: '說', think: '心想', narrate: '旁白', move: '走到', run: '跑到', face: '面向', anim: '動作', pose: '擺姿勢', emote: '表情符號', wait: '等待', cam: '鏡頭', fade: '淡出／淡入', bars: '電影黑邊', sound: '音效', choice: '選項', label: '標籤', goto: '跳到', if: '如果', set: '設定', unset: '清除', add: '增加', rel: '關係變化', feel: '情緒', need: '需求', remember: '記住', end: '結束' };

  // ------------------------------------------------------------------------- tokenizer
  /** split a line into words; "quoted text" and 「中文引號」 stay whole */
  function words(line) {
    const out = []; let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === ' ' || ch === '\t' || ch === '　') { i++; continue; }
      if (ch === '"' || ch === '「' || ch === '“') {
        const close = ch === '"' ? '"' : ch === '「' ? '」' : '”'; const j = line.indexOf(close, i + 1);
        if (j < 0) return { err: `引號沒有關上（${ch}…${close}）` };
        out.push({ q: true, v: line.slice(i + 1, j) }); i = j + 1; continue;
      }
      let j = i; while (j < line.length && !' \t　"「“'.includes(line[j])) j++;
      out.push({ q: false, v: line.slice(i, j) }); i = j;
    }
    return { w: out };
  }
  const knownAction = (n) => (Array.isArray(OC.Chars.ACTIONS) && OC.Chars.ACTIONS.some((a) => a[0] === n)) || !!(OC.Anim11 && OC.Anim11.has && OC.Anim11.has(n));
  const isRole = (v) => /^[A-F]$/.test(v);
  const num = (v) => (v != null && v !== '' && !isNaN(+v) ? +v : null);

  // ------------------------------------------------------------------------- conditions
  const CMP = ['>=', '<=', '>', '<', '=', '==', '!='];
  /** parse a condition from words → { k, …, line } or { err } */
  function cond(ws) {
    const v = ws.map((x) => x.v); const k0 = v[0]; let neg = false, k = k0;
    if (k && k.startsWith('!')) { neg = true; k = k.slice(1); }
    const opv = (i) => { const op = v[i], n = num(v[i + 1]); if (!CMP.includes(op) || n == null) return null; return { op: op === '==' ? '=' : op, n }; };
    let c = null;
    switch (k) {
      case 'place': case '地點': if (!v[1]) return { err: '地點：要寫地點代號，例如 place isle,cafe' }; c = { k: 'place', list: v[1].split(/[,，]/) }; break;
      case 'time': case '時間': { const m = (v[1] || '').match(/^(\d{1,2})(?::(\d\d))?-(\d{1,2})(?::(\d\d))?$/); if (!m) return { err: '時間：寫成 18:00-21:00' }; c = { k: 'time', a: +m[1] + (+m[2] || 0) / 60, b: +m[3] + (+m[4] || 0) / 60 }; break; }
      case 'phase': case '時段': c = { k: 'phase', list: (v[1] || '').split(/[,，]/) }; if (!c.list[0] || c.list.some((p) => !PHASES.includes(p))) return { err: '時段：' + PHASES.join(' / ') }; break;
      case 'weather': case '天氣': c = { k: 'weather', list: (v[1] || '').split(/[,，]/) }; if (!c.list[0]) return { err: '天氣：例如 weather sunny,rain' }; break;
      case 'season': case '季節': c = { k: 'season', list: (v[1] || '').split(/[,，]/) }; if (!c.list.every((s) => ['spring', 'summer', 'autumn', 'winter'].includes(s))) return { err: '季節：spring / summer / autumn / winter' }; break;
      case 'weekend': case '週末': c = { k: 'weekend' }; break;
      case 'flag': case '旗標': { if (!v[1]) return { err: '旗標：要寫名字' }; c = { k: 'flag', name: v[1] }; break; }
      case 'var': case '變數': { const o = opv(2); if (!v[1] || !o) return { err: '變數：寫成 var 名字 >= 2' }; c = { k: 'var', name: v[1], ...o }; break; }
      case 'rel': case '關係': { if (!isRole(v[1]) || !isRole(v[2])) return { err: '關係：寫成 rel A B aff >= 60' }; if (v[3] === 'is') { if (!v[4]) return { err: '關係類型：rel A B is friend' }; c = { k: 'reltype', a: v[1], b: v[2], list: v[4].split(/[,，]/) }; break; } const f = RELK[v[3]] && RELK[v[3]].length < 9 && !RELK[RELK[v[3]]] ? v[3] : RELK[v[3]]; const fld = ['aff', 'fam', 'trust', 'intim', 'conflict'].includes(v[3]) ? v[3] : f; const o = opv(4); if (!fld || !o) return { err: '關係：欄位 aff / fam / trust / intim / conflict，例如 rel A B aff >= 60' }; c = { k: 'rel', a: v[1], b: v[2], f: fld, ...o }; break; }
      case 'need': case '需求': { const o = opv(3); if (!isRole(v[1]) || !v[2] || !o) return { err: '需求：寫成 need A food < 30' }; c = { k: 'need', r: v[1], n: v[2], ...o }; break; }
      case 'mood': case '心情': if (!isRole(v[1]) || !v[2]) return { err: '心情：寫成 mood A happy,excited' }; c = { k: 'mood', r: v[1], list: v[2].split(/[,，]/) }; break;
      case 'trait': case '特質': if (!isRole(v[1]) || !v[2]) return { err: '特質：寫成 trait A shy' }; c = { k: 'trait', r: v[1], list: v[2].split(/[,，]/) }; break;
      case 'age': case '年齡': { const o = opv(2); if (!isRole(v[1]) || !o) return { err: '年齡：寫成 age A >= 18' }; c = { k: 'age', r: v[1], ...o }; break; }
      case 'adult': case '成年': if (!v.slice(1).length || !v.slice(1).every(isRole)) return { err: '成年：寫成 adult A B' }; c = { k: 'adult', list: v.slice(1) }; break;
      case 'near': case '靠近': { const d = num(v[3]) || 80; if (!isRole(v[1]) || !(isRole(v[2]) || v[2] === 'player')) return { err: '靠近：寫成 near A B 80' }; c = { k: 'near', a: v[1], b: v[2], d }; break; }
      case 'chance': case '機率': { const p = num(v[1]); if (p == null || p < 0 || p > 1) return { err: '機率：0 到 1 之間，例如 chance 0.3' }; c = { k: 'chance', p }; break; }
      case 'seen': case '看過': if (!v[1]) return { err: '看過：寫成 seen 事件代號' }; c = { k: 'seen', id: v[1] }; break;
      case 'choice': case '選了': { const n = num(v[1]); if (n == null) return { err: '選了：寫成 choice 1（上一個選項選了第幾個）' }; c = { k: 'choice', n }; break; }
      default: return { err: `看不懂的條件「${k0 || ''}」` };
    }
    c.neg = neg; return c;
  }
  const cmpN = (x, o) => { switch (o.op) { case '>=': return x >= o.n; case '<=': return x <= o.n; case '>': return x > o.n; case '<': return x < o.n; case '!=': return x !== o.n; default: return x === o.n; } };
  /** does a condition hold for this cast? */
  function holds(c, X) {
    const ch = (r) => X.chars[r], pos = (r) => (r === 'player' ? OC.App && OC.App.player : X.actors[r]);
    let ok;
    switch (c.k) {
      case 'place': ok = c.list.includes(Wd().area && Wd().area.id); break;
      case 'time': { const h = OC.Clock.hour(); ok = c.a <= c.b ? h >= c.a && h < c.b : h >= c.a || h < c.b; break; }
      case 'phase': ok = c.list.includes(OC.Clock.phase(OC.Clock.hour())); break;
      case 'weather': ok = c.list.includes(OC.Clock.weather()); break;
      case 'season': ok = c.list.includes(OC.Clock.season ? OC.Clock.season() : ''); break;
      case 'weekend': ok = !!(OC.Clock.cal && OC.Clock.cal().weekend); break;
      case 'flag': ok = !!S().life.flags[c.name]; break;
      case 'var': ok = cmpN(+(vars()[c.name] || 0), c); break;
      case 'rel': { const a = ch(c.a), b = ch(c.b); const r = a && b ? M().relPeek(a.id, b.id) : null; ok = cmpN(r ? +r[c.f] || 0 : 0, c); break; }
      case 'reltype': { const a = ch(c.a), b = ch(c.b); const r = a && b ? M().relPeek(a.id, b.id) : null; ok = c.list.includes(r ? r.type : 'stranger'); break; }
      case 'need': { const a = ch(c.r); ok = !!a && a.needs[c.n] != null && cmpN(a.needs[c.n], c); break; }
      case 'mood': { const a = ch(c.r); ok = !!a && c.list.includes(M().dominant(a)); break; }
      case 'trait': { const a = ch(c.r); ok = !!a && c.list.some((t) => a.personality.traits.includes(t)); break; }
      case 'age': { const a = ch(c.r); const n = a ? parseInt(a.profile.age, 10) : NaN; ok = !isNaN(n) && cmpN(n, c); break; }
      case 'adult': ok = c.list.every((r) => { const a = ch(r); return a && !(OC.People && OC.People.minor(a)) && parseInt(a.profile.age, 10) >= 18; }); break;
      case 'near': { const a = pos(c.a), b = pos(c.b); ok = !!(a && b) && Math.hypot(a.x - b.x, a.y - b.y) <= c.d; break; }
      case 'chance': ok = Sim().rnd() < c.p; break;
      case 'seen': ok = !!(seen()[c.id]); break;
      case 'choice': ok = X.choice === c.n - 1; break;
      default: ok = false;
    }
    return c.neg ? !ok : ok;
  }
  const vars = () => (S().life.vars16 = S().life.vars16 || {});
  const seen = () => (S().life.ocsSeen = S().life.ocsSeen || {});

  // ------------------------------------------------------------------------- the parser
  /** compile source text → { events: [prog], errors: [{ line, msg }], warns: [{ line, msg }] }. Nothing is executed. */
  function compile(src, o = {}) {
    const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n'), events = [], errors = [], warns = [];
    let ev = null, inBody = false, lastChoice = null;
    const err = (ln, msg) => errors.push({ line: ln, msg, ev: ev && ev.id }), warn = (ln, msg) => warns.push({ line: ln, msg, ev: ev && ev.id });
    const close = () => { if (!ev) return; finishEvent(ev, err, warn); events.push(ev); ev = null; inBody = false; lastChoice = null; };
    for (let i = 0; i < lines.length; i++) {
      const ln = i + 1, raw = lines[i], t = raw.replace(/\s+$/, ''); const s = t.trim();
      if (!s || s.startsWith('#') || s.startsWith('//')) continue;
      const tk = words(s); if (tk.err) { err(ln, tk.err); continue; } const ws = tk.w, v = ws.map((x) => x.v), k = v[0];
      if (k === 'event' || k === '事件') {
        close();
        if (!v[1] || ws[1].q || !/^[\w\-一-鿿]+$/.test(v[1])) { err(ln, '事件要有代號（英文、數字、底線或中文），例如：event sunset_talk "夕陽下的話"'); }
        ev = { id: (v[1] || 'event' + ln).slice(0, 48), zh: ws[2] && ws[2].q ? ws[2].v.slice(0, 40) : v[1] || '自訂事件', trigger: 'tick', cast: [], when: [], chance: null, once: null, cd: 0, prio: 1, watch: null, mode: 'scene', steps: [], labels: {}, line: ln, owner: o.owner || null };
        continue;
      }
      if (!ev) { err(ln, '腳本要先寫「event 代號 "名稱"」'); continue; }
      if (!inBody) {
        if (s === '---' || k === 'steps' || k === '步驟') { inBody = true; continue; }
        switch (k) {
          case 'trigger': case '觸發': if (!TRIGGERS[v[1]]) err(ln, '觸發：' + Object.keys(TRIG_ZH).join(' / ')); else ev.trigger = TRIGGERS[v[1]]; break;
          case 'cast': case '角色': {
            /* cast A = self | any | player | "名字" */
            const r = v[1], eq = v[2] === '=' ? 3 : 2, sel = ws[eq];
            if (!isRole(r)) { err(ln, '角色代號只能是 A 到 F'); break; }
            if (!sel) { err(ln, '角色：寫成 cast B = any（任何人）／self（這個角色）／player（你在玩的角色）／"名字"'); break; }
            if (ev.cast.some((x) => x.role === r)) { err(ln, `角色 ${r} 已經寫過`); break; }
            ev.cast.push({ role: r, sel: sel.q ? { name: sel.v } : ['self', 'any', 'player', '自己', '任何人', '玩家'].includes(sel.v) ? { kind: { 自己: 'self', 任何人: 'any', 玩家: 'player' }[sel.v] || sel.v } : { name: sel.v } }); break;
          }
          case 'when': case '條件': { const c = cond(ws.slice(1)); if (c.err) err(ln, c.err); else { c.line = ln; ev.when.push(c); } break; }
          case 'chance': case '機率': { const p = num(v[1]); if (p == null || p < 0 || p > 1) err(ln, '機率：0 到 1 之間'); else ev.chance = p; break; }
          case 'once': case '一次': ev.once = v[1] === 'pair' || v[1] === '每對' ? 'pair' : v[1] === 'day' || v[1] === '每天' ? 'day' : 'global'; break;
          case 'cooldown': case '冷卻': { const n = num(v[1]); if (n == null || n < 0) err(ln, '冷卻：遊戲分鐘數，例如 cooldown 240'); else ev.cd = n; break; }
          case 'priority': case '優先': { const n = num(v[1]); if (n == null || n < 1 || n > 5) err(ln, '優先：1 到 5'); else ev.prio = n; break; }
          case 'watch': case '詢問': ev.watch = ws[1] && ws[1].q ? ws[1].v : '要來看看嗎？'; break;
          case 'mode': case '模式': if (!['scene', 'cutscene'].includes(v[1])) err(ln, '模式：scene（在世界裡發生）或 cutscene（過場：黑邊、鏡頭跟著、可跳過）'); else ev.mode = v[1]; break;
          default: err(ln, `看不懂的設定「${k}」（設定寫完後用 --- 開始寫步驟）`);
        }
        continue;
      }
      /* body: an option line of the last choice */
      if (ws[0].q && lastChoice && (v[1] === '->' || v[1] === '→')) {
        if (!v[2]) { err(ln, '選項要寫「-> 標籤」'); continue; }
        lastChoice.opts.push({ text: ws[0].v.slice(0, 40), go: v[2], line: ln }); continue;
      }
      const st = parseStep(ws, v, ln, err, warn); if (!st) continue;
      if (st.op === 'label') { if (ev.labels[st.name] != null) err(ln, `標籤「${st.name}」重複了`); ev.labels[st.name] = ev.steps.length; }
      ev.steps.push(st); lastChoice = st.op === 'choice' ? st : null;
    }
    close();
    if (!events.length && !errors.length) errors.push({ line: 1, msg: '沒有找到事件（要以 event 開頭）' });
    return { events, errors, warns };
  }
  function parseStep(ws, v, ln, err, warn) {
    const k = v[0], q = (i) => (ws[i] && ws[i].q ? ws[i].v : null), role = (i, okPlayer) => (isRole(v[i]) || (okPlayer && v[i] === 'player') ? v[i] : null);
    const bad = (m) => { err(ln, m); return null; };
    switch (k) {
      case 'say': case 'think': case '說': case '心想': { const r = role(1); if (!r) return bad('寫成 say A "台詞"'); if (q(2) == null && !(v[2] || '').startsWith('cat:')) return bad('台詞要放在引號裡，例如 say A "你來了。"'); return { op: k === '心想' || k === 'think' ? 'think' : 'say', r, text: q(2), cat: q(2) == null ? v[2].slice(4) : null, line: ln }; }
      case 'narrate': case '旁白': if (q(1) == null) return bad('寫成 narrate "那天傍晚……"'); return { op: 'narrate', text: q(1), line: ln };
      case 'move': case 'run': case '走到': case '跑到': {
        const r = role(1); if (!r) return bad('寫成 move A to 120 80／move A to B／move A to player'); let i = 2; if (v[i] === 'to' || v[i] === '到') i++;
        const nowait = v.includes('nowait') || v.includes('不等'); const run = k === 'run' || k === '跑到';
        if (v[i] === 'by') { const dx = num(v[i + 1]), dy = num(v[i + 2]); if (dx == null || dy == null) return bad('寫成 move A by 30 0'); return { op: 'move', r, by: [dx, dy], run, nowait, line: ln }; }
        if (isRole(v[i]) || v[i] === 'player') return { op: 'move', r, to: v[i], run, nowait, line: ln };
        const x = num(v[i]), y = num(v[i + 1]); if (x == null || y == null) return bad('目的地寫成座標（move A to 120 80）、另一個角色（B）或 player');
        return { op: 'move', r, xy: [x, y], run, nowait, line: ln };
      }
      case 'face': case '面向': { const r = role(1); if (!r || !v[2]) return bad('寫成 face A B／face A player／face A left'); if (!(isRole(v[2]) || ['player', 'left', 'right', 'front', 'back'].includes(v[2]))) return bad('面向：另一個角色、player、left、right、front、back'); return { op: 'face', r, to: v[2], line: ln }; }
      case 'anim': case 'pose': case '動作': case '擺姿勢': {
        const r = role(1); if (!r || !v[2]) return bad('寫成 anim A wave 1.5'); const sec = num(v[3]);
        if (!knownAction(v[2])) warn(ln, `動作「${v[2]}」不在動作庫裡，會用備用動作`);
        return { op: 'anim', r, act: v[2], sec: sec != null ? Math.max(0.2, Math.min(30, sec)) : (k === 'pose' || k === '擺姿勢' ? 30 : 1.4), hold: k === 'pose' || k === '擺姿勢', line: ln };
      }
      case 'emote': case '表情符號': { const r = role(1); if (!r || !v[2]) return bad('寫成 emote A heart（heart ! ? note sweat anger zz … star idea）'); return { op: 'emote', r, e: EMOTE[v[2]] || v[2].slice(0, 2), line: ln }; }
      case 'wait': case '等待': { const n = num(v[1]); if (n == null || n < 0) return bad('寫成 wait 1.5（秒）'); return { op: 'wait', sec: Math.min(20, n), line: ln }; }
      case 'cam': case '鏡頭': { if (v[1] === 'reset' || v[1] === '還原') return { op: 'cam', reset: true, line: ln }; const r = role(1, true); if (!r) return bad('寫成 cam A 2.4（拉近）或 cam reset'); return { op: 'cam', r, zoom: Math.max(1, Math.min(4, num(v[2]) || 2.4)), line: ln }; }
      case 'fade': case '淡出': case '淡入': { const d = k === '淡出' ? 'out' : k === '淡入' ? 'in' : v[1]; if (!['out', 'in'].includes(d)) return bad('寫成 fade out 或 fade in'); return { op: 'fade', dir: d, line: ln }; }
      case 'bars': case '黑邊': { const on = ['on', '開'].includes(v[1]) ? true : ['off', '關'].includes(v[1]) ? false : null; if (on == null) return bad('寫成 bars on 或 bars off'); return { op: 'bars', on, line: ln }; }
      case 'sound': case '音效': if (!v[1]) return bad('寫成 sound chime'); return { op: 'sound', id: v[1], line: ln };
      case 'choice': case '選項': if (q(1) == null) return bad('寫成 choice "要一起去嗎？"，下一行開始每行一個選項："好啊" -> yes'); return { op: 'choice', text: q(1).slice(0, 60), opts: [], line: ln };
      case 'label': case '標籤': if (!v[1]) return bad('寫成 label 名字'); return { op: 'label', name: v[1], line: ln };
      case 'goto': case '跳到': if (!v[1]) return bad('寫成 goto 名字'); return { op: 'goto', to: v[1], line: ln };
      case 'if': case '如果': {
        const ai = v.findIndex((x) => x === '->' || x === '→'); if (ai < 2 || !v[ai + 1]) return bad('寫成 if flag met -> 標籤'); const c = cond(ws.slice(1, ai)); if (c.err) return bad(c.err);
        return { op: 'if', c, to: v[ai + 1], line: ln };
      }
      case 'set': case 'unset': case 'add': case '設定': case '清除': case '增加': {
        const op = { 設定: 'set', 清除: 'unset', 增加: 'add' }[k] || k, kind = v[1], name = v[2];
        if (!['flag', 'var', '旗標', '變數'].includes(kind) || !name || !/^[\w一-鿿]+$/.test(name)) return bad(`寫成 ${op} flag 名字 或 ${op} var 名字 ${op === 'unset' ? '' : '3'}`);
        const isVar = kind === 'var' || kind === '變數'; const n = num(v[3]); if (isVar && op !== 'unset' && n == null) return bad('變數要有數字'); if (op === 'add' && !isVar) return bad('只有變數能 add');
        return { op, kind: isVar ? 'var' : 'flag', name, n: n == null ? 1 : n, line: ln };
      }
      case 'rel': case '關係': {
        /* rel A B aff +5 trust +2   (A 對 B 的看法)   rel A<>B aff +5 （雙方） */
        let a, b, i; const m = (v[1] || '').match(/^([A-F])<>([A-F])$/);
        if (m) { a = m[1]; b = m[2]; i = 2; } else { a = role(1); b = role(2); i = 3; }
        if (!a || !b || a === b) return bad('寫成 rel A B aff +5（A 對 B）或 rel A<>B aff +5（雙方）');
        const d = {}; for (; i < v.length; i += 2) { const f = ['aff', 'fam', 'trust', 'intim', 'conflict'].includes(v[i]) ? v[i] : RELK[v[i]]; const n = num(v[i + 1]); if (!f || !['aff', 'fam', 'trust', 'intim', 'conflict'].includes(f) || n == null) return bad('關係欄位：aff fam trust intim conflict（好感 熟悉 信任 親密 不合）＋數字'); d[f] = Math.max(-20, Math.min(20, n)); if (Math.abs(n) > 20) warn(ln, '一次最多 ±20'); }
        if (!Object.keys(d).length) return bad('至少要改一個欄位');
        return { op: 'rel', a, b, both: !!m, d, line: ln };
      }
      case 'feel': case '情緒': { const r = role(1); const n = num(v[3]); if (!r || !v[2]) return bad('寫成 feel A happy 0.6'); if (!D().EMOTIONS[v[2]]) return bad(`沒有這種情緒「${v[2]}」：${Object.keys(D().EMOTIONS).join(' ')}`); return { op: 'feel', r, emo: v[2], k: Math.max(0.05, Math.min(1, n == null ? 0.5 : n)), line: ln }; }
      case 'need': case '需求': { const r = role(1); const n = num(v[3]); if (!r || !v[2] || n == null) return bad('寫成 need A fun +10'); return { op: 'need', r, n: v[2], d: Math.max(-40, Math.min(40, n)), line: ln }; }
      case 'remember': case '記住': { const r = role(1); if (!r) return bad('寫成 remember A B "一起看了夕陽" 0.6'); const o = role(2); const ti = o ? 3 : 2; if (q(ti) == null) return bad('回憶的文字要放在引號裡'); return { op: 'remember', r, o, text: q(ti).slice(0, 80), imp: Math.max(0.1, Math.min(1, num(v[ti + 1]) || 0.5)), line: ln }; }
      case 'end': case '結束': return { op: 'end', line: ln };
      default: return bad(`看不懂的步驟「${k}」。可以用：${OPS.join(' ')}`);
    }
  }
  function finishEvent(ev, err, warn) {
    if (!ev.cast.length) ev.cast.push({ role: 'A', sel: { kind: ev.owner ? 'self' : 'any' } });
    if (!ev.cast.some((x) => x.role === 'A')) err(ev.line, '一定要有角色 A');
    const roles = new Set(ev.cast.map((x) => x.role));
    const used = (r) => { if (r && isRole(r) && !roles.has(r)) err(ev.lineOf || ev.line, `用到角色 ${r}，但沒有寫 cast ${r} = …`); };
    for (const c of ev.when) for (const r of [c.r, c.a, c.b].concat(c.list && c.k === 'adult' ? c.list : [])) if (r && isRole(r) && !roles.has(r)) err(c.line, `條件用到角色 ${r}，但沒有寫 cast ${r} = …`);
    for (const st of ev.steps) {
      ev.lineOf = st.line;
      for (const r of [st.r, st.a, st.b, st.o, st.to, st.c && st.c.r, st.c && st.c.a, st.c && st.c.b]) used(r);
      if ((st.op === 'goto' || st.op === 'if') && ev.labels[st.to] == null) err(st.line, `找不到標籤「${st.to}」`);
      if (st.op === 'choice') { if (st.opts.length < 2) err(st.line, '選項至少要兩個（下一行起：「"文字" -> 標籤」）'); if (st.opts.length > 4) err(st.line, '選項最多四個'); for (const o of st.opts) if (ev.labels[o.go] == null) err(o.line, `找不到標籤「${o.go}」`); }
    }
    delete ev.lineOf;
    if (!ev.steps.length) warn(ev.line, '這個事件沒有步驟');
    if (ev.trigger === 'tick' && ev.chance == null && !ev.once && !ev.cd) warn(ev.line, '「隨時」觸發又沒有機率／一次／冷卻，會很常發生——建議加 chance 或 cooldown');
  }

  // ------------------------------------------------------------------------- the library (any number of scripts)
  /** island scripts: S().life.scripts16 = [{ id, src, on }]; a character's: c.scripts16 = [{ id, src, on }] */
  const lib = () => (S().life.scripts16 = S().life.scripts16 || []);
  let cache = null, cacheKey = '';
  function sources() { const out = lib().filter((x) => x.on !== false).map((x) => ({ src: x.src, owner: null, sid: x.id })); for (const c of Ch().all()) for (const x of c.scripts16 || []) if (x.on !== false) out.push({ src: x.src, owner: c.id, sid: x.id }); return out; }
  /** all compiled, valid events (re-compiled only when a source changed) */
  function all() {
    const srcs = sources(); const key = srcs.map((s) => s.sid + ':' + s.owner + ':' + s.src.length + ':' + hash(s.src)).join('|');
    if (cache && key === cacheKey) return cache;
    const out = []; for (const s of srcs) { const r = compile(s.src, { owner: s.owner }); if (r.errors.length) continue; for (const e of r.events) { e.sid = s.sid; e.key = (s.owner || 'isle') + ':' + e.id; out.push(e); } }
    cache = out; cacheKey = key; return out;
  }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  const byTrigger = (t) => all().filter((e) => e.trigger === t);

  // ------------------------------------------------------------------------- casting
  const avail = (id) => { const b = B().get(id); return b && b.a && B().available(b) ? b : null; };
  /** who plays each role (only characters that are here and free) → { chars, actors, brains } or null */
  function bind(ev, p = {}) {
    const chars = {}, actors = {}, brains = {}, taken = new Set();
    const pool = () => Ch().all().filter((c) => !taken.has(c.id) && avail(c.id));
    for (const cs of ev.cast) {
      let c = null;
      if (cs.sel.kind === 'self') c = ev.owner ? Ch().get(ev.owner) : null;
      else if (cs.sel.kind === 'player') c = Ch().get(S().activeId);
      else if (cs.sel.name) c = Ch().all().find((x) => Ch().name(x) === cs.sel.name || x.profile.name === cs.sel.name || x.id === cs.sel.name);
      else { /* any: the trigger's character for A, else someone here */ if (cs.role === 'A' && p.a && !taken.has(p.a)) c = Ch().get(p.a); else if (cs.role === 'B' && p.b && !taken.has(p.b)) c = Ch().get(p.b); if (!c || !avail(c.id)) { const l = pool(); c = l.length ? l[Math.floor(Sim().rnd() * l.length)] : null; } }
      if (!c || taken.has(c.id)) return null; const b = avail(c.id); if (!b) return null;
      taken.add(c.id); chars[cs.role] = c; actors[cs.role] = b.a; brains[cs.role] = b;
    }
    return { chars, actors, brains };
  }
  function onceKey(ev, X) { if (!ev.once) return null; if (ev.once === 'pair') return 'ocs:' + ev.key + ':' + Object.values(X.chars).map((c) => c.id).sort().join('|'); if (ev.once === 'day') return 'ocs:' + ev.key + ':' + Sim().day(); return 'ocs:' + ev.key; }
  const E = () => S().life.ev;
  function ready(ev, X, why) {
    const ok = onceKey(ev, X); if (ok && E().once[ok]) { why && why.push('已發生過'); return false; }
    const lk = 'ocs:' + ev.key; if (ev.cd && E().last[lk] && Sim().now() - E().last[lk] < ev.cd) { why && why.push('冷卻中'); return false; }
    for (const c of ev.when) if (!holds(c, X)) { why && why.push('條件（第 ' + c.line + ' 行）'); return false; }
    return true;
  }
  /** a trigger happened (from OC.Events): try the scripts of that trigger */
  function trigger(type, p = {}, o = {}) {
    if (!S() || Sim().catching) return false;
    for (const ev of byTrigger(type).sort((a, b) => b.prio - a.prio)) {
      if (o.only && ev.key !== o.only) continue;
      const X = bind(ev, p); if (!X) continue;
      if (!ready(ev, X)) continue;
      if (ev.chance != null && Sim().rnd() > ev.chance * (type === 'tick' ? 0.25 : 1)) { E().last['ocs:' + ev.key] = Sim().now(); continue; }
      if (OC.Events.beginScript(ev, X)) return true;
    }
    return false;
  }
  /** play one script now (the editor's 「試播」) — conditions are not checked, only the cast */
  function play(ev, o = {}) {
    const X = bind(ev, o.p || {}); if (!X) return { ok: false, why: '演出的角色不在這裡或正在忙' };
    return OC.Events.beginScript(ev, X, { test: true }) ? { ok: true } : { ok: false, why: '現在有別的事件正在進行' };
  }

  // ------------------------------------------------------------------------- the runner (called by OC.Events.update)
  let ovl = null;
  function overlay() { if (!ovl) { ovl = h('div.ocs-ovl', null, h('div.blk'), h('div.cap')); document.getElementById('app').append(ovl); } return ovl; }
  function h(tag, attrs, ...kids) { return OC.UI.h(tag, attrs, ...kids); }
  /** start: called by Events.beginScript after the holds */
  function start(c) {
    c.pc = 0; c.ops = 0; c.vars = {}; c.choice = null;
    if (c.ev.mode === 'cutscene' || c.test) { c.watched = true; c.hooks.cam(c.X.actors.A, true); if (OC.Stage) OC.Stage.controls(true); }
  }
  function fmt(t, c) {
    return String(t).replace(/\{([A-F])\}/g, (m, r) => (c.X.chars[r] ? Ch().name(c.X.chars[r]) : m)).replace(/\{player\}/g, '你').replace(/\{var:(\w+)\}/g, (m, k) => (vars()[k] != null ? vars()[k] : 0)).replace(/\{place\}/g, (OC.Places.get(Wd().area.id) || {}).zh || '這裡');
  }
  /** advance; returns 'done' when finished */
  function step(c, t) {
    if (c.pending || t < c.waitUntil) return null;
    let n = 0;
    while (n++ < 60) {
      if (c.pc >= c.ev.steps.length) return 'done';
      const st = c.ev.steps[c.pc++]; const fast = !!c.fast;
      const ch = (r) => c.X.chars[r], ac = (r) => (r === 'player' ? OC.App && OC.App.player : c.X.actors[r]);
      switch (st.op) {
        case 'label': continue;
        case 'goto': c.pc = c.ev.labels[st.to]; if (++c.ops > 400) return 'done'; continue;
        case 'if': { if (holds(st.c, Object.assign({ choice: c.choice }, c.X))) c.pc = c.ev.labels[st.to]; if (++c.ops > 400) return 'done'; continue; }
        case 'end': return 'done';
        case 'say': case 'think': {
          if (fast) continue; const a = ac(st.r), sp = ch(st.r); if (!a || !sp) continue;
          let text = st.text != null ? fmt(st.text, c) : null; const other = Object.values(c.X.chars).find((x) => x !== sp) || null;
          if (st.cat) { const ln = OC.Talk.say(st.cat, sp, other); text = ln ? ln.text : null; } else if (text && st.op === 'say') text = Ch().speak(sp, text, { to: other ? other.id : 'player', cat: 'script', rnd: Sim().rnd() });
          if (!text) continue;
          if (st.op === 'think') { c.hooks.say(a, '（' + text + '）', Ch().name(sp), null, { event: true, think: true }); c.waitUntil = t + Math.min(5, 1 + text.length * 0.08); return null; }
          Wd().setAction(a, 'talk', { dur: 1.2, priority: 6 }); const d = c.hooks.say(a, text, Ch().name(sp), null, { event: true }); c.waitUntil = t + (d || 1.5) + 0.25; return null;
        }
        case 'narrate': { if (fast) continue; const el = overlay(); el.lastChild.textContent = fmt(st.text, c); el.classList.add('cap'); const d = Math.min(6, 1.4 + st.text.length * 0.09); c.waitUntil = t + d; c.capOff = t + d; return null; }
        case 'move': {
          const a = ac(st.r); if (!a) continue; let x, y;
          if (st.xy) [x, y] = st.xy; else if (st.by) { x = a.x + st.by[0]; y = a.y + st.by[1]; } else { const tg = ac(st.to); if (!tg || tg === a) continue; const side = a.x < tg.x ? -1 : 1; x = tg.x + side * 26; y = tg.y + 2; }
          const q = Wd().nearestWalkable(x, y, 40); if (!q) continue;
          if (fast) { a.path = null; a.x = q.x; a.y = q.y; continue; }
          a.run = !!st.run; if (!Wd().walkTo(a, q.x, q.y)) continue;
          if (st.nowait) continue; c.pending = true; const t0 = nowR(); const w = () => { if (c.dead) return; if (!a.path || nowR() - t0 > 30 || c.fast) { a.run = false; c.pending = false; } else setTimeout(w, 150); }; setTimeout(w, 150); return null;
        }
        case 'face': { const a = ac(st.r); if (!a) continue; if (st.to === 'left' || st.to === 'right') { a.tFace = st.to === 'left' ? -1 : 1; a.tBack = 0; } else if (st.to === 'back') a.tBack = 1; else if (st.to === 'front') { a.tBack = 0; a.tFace = 0.2; } else { const tg = ac(st.to); if (tg && tg !== a) B().face(a, tg); } continue; }
        case 'anim': { const a = ac(st.r); if (!a) continue; Wd().setAction(a, st.act, { dur: fast ? 0.1 : st.sec, priority: 6 }); if (fast || st.hold) continue; c.waitUntil = t + Math.min(st.sec, 3); return null; }
        case 'emote': { const a = ac(st.r); if (a && !fast) { c.hooks.emote(a, st.e); c.waitUntil = t + 0.6; return null; } continue; }
        case 'wait': if (fast) continue; c.waitUntil = t + st.sec; return null;
        case 'cam': if (!c.watched || fast) continue; if (st.reset) { c.hooks.cam(null, false); document.documentElement.classList.add('cinema'); continue; } { const a = ac(st.r); if (a) { if (Wd().camTo) Wd().camTo(a, st.zoom); else c.hooks.cam(a, true); } } continue;
        case 'fade': if (fast || !c.watched) continue; overlay().classList.toggle('dark', st.dir === 'out'); c.waitUntil = t + 0.7; return null;
        case 'bars': if (c.watched && OC.Stage) OC.Stage.controls(st.on || true); if (!st.on) document.documentElement.classList.remove('cinema'); else document.documentElement.classList.add('cinema'); continue;
        case 'sound': if (!fast && OC.Sound && OC.Sound.play) OC.Sound.play(st.id); continue;
        case 'choice': {
          const go = (i) => { const o = st.opts[i] || st.opts[0]; c.choice = st.opts.indexOf(o); c.pc = c.ev.labels[o.go]; };
          if (fast || !c.watched) { go(0); continue; }
          c.pending = true; c.hooks.choice(fmt(st.text, c), st.opts.map((o) => fmt(o.text, c)), (i) => { if (c.dead) return; go(i); c.pending = false; }); return null;
        }
        case 'set': if (st.kind === 'flag') S().life.flags[st.name] = Sim().now(); else vars()[st.name] = st.n; continue;
        case 'unset': if (st.kind === 'flag') delete S().life.flags[st.name]; else delete vars()[st.name]; continue;
        case 'add': vars()[st.name] = (+vars()[st.name] || 0) + st.n; continue;
        case 'rel': {
          const a = ch(st.a), b = ch(st.b); if (!a || !b) continue; const d = Object.assign({}, st.d);
          if (d.intim && OC.People && (OC.People.minor(a) || OC.People.minor(b))) delete d.intim;   /* never for a minor */
          if (Object.keys(d).length) { if (st.both) M().relPair(a.id, b.id, d, c.ev.zh); else M().relChange(a.id, b.id, d, c.ev.zh); }
          continue;
        }
        case 'feel': { const a = ch(st.r); if (a) M().feel(a, st.emo, st.k, c.ev.zh); continue; }
        case 'need': { const a = ch(st.r); if (a && a.needs[st.n] != null) M().needs(a, { [st.n]: st.d }, c.ev.zh); continue; }
        case 'remember': { const a = ch(st.r), o = st.o ? ch(st.o) : null; if (a) M().remember(a, { type: 'event', imp: st.imp, who: o ? [o.id] : [], place: Wd().area.id, text: fmt(st.text, c), key: `ocs:${c.ev.key}:${a.id}:${st.line}:${c.okey || Math.floor(Sim().now() / 60)}` }); continue; }
        default: continue;
      }
    }
    return null;
  }
  /** after the scene (also after a skip / an interruption) */
  function stop(c) {
    c.dead = true; for (const a of Object.values(c.X.actors)) { if (a) a.run = false; }
    if (ovl) { ovl.classList.remove('dark', 'cap'); }
    if (c.watched && OC.Stage) OC.Stage.controls(false);
    const s = seen(); s[c.ev.id] = (s[c.ev.id] || 0) + 1; s[c.ev.key] = (s[c.ev.key] || 0) + 1;
  }
  function tickCaption(c, t) { if (c.capOff && t > c.capOff && ovl) { ovl.classList.remove('cap'); c.capOff = 0; } }
  function mark(ev, X) { E().last['ocs:' + ev.key] = Sim().now(); const ok = onceKey(ev, X); if (ok) E().once[ok] = Sim().now(); return ok; }

  // ------------------------------------------------------------------------- import / export / templates
  /** text (.ocs), or JSON { format: 'ocshimeji-script', scripts: [{ src | script, name }] } → [{ src, errors, warns, events }] */
  function parseFile(text) {
    const s = String(text || '').trim(); if (!s) return { error: '檔案是空的' };
    if (s[0] === '{' || s[0] === '[') {
      let j; try { j = JSON.parse(s); } catch (e) { return { error: 'JSON 格式錯誤：' + e.message }; }
      const list = Array.isArray(j) ? j : j.scripts; if (!Array.isArray(list)) return { error: 'JSON 裡找不到 scripts 陣列' };
      return { items: list.map((x, i) => { const src = typeof x === 'string' ? x : x && (x.src || x.script); if (typeof src !== 'string') return { src: '', errors: [{ line: 0, msg: `第 ${i + 1} 筆沒有 src` }], warns: [], events: [] }; return Object.assign({ src }, compile(src)); }) };
    }
    /* one text file may hold many events: keep it as one script so its labels and comments stay together */
    return { items: [Object.assign({ src: s }, compile(s))] };
  }
  function add(src, owner) {
    const r = compile(src, { owner }); const item = { id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), src: String(src), on: !r.errors.length };
    if (owner) { const c = Ch().get(owner); if (!c) return null; (c.scripts16 = c.scripts16 || []).push(item); Ch().save(c); } else lib().push(item);
    cache = null; OC.Store.touch('life', { scripts: true }); return Object.assign({ item }, r);
  }
  function exportAll() {
    const list = lib().map((x) => ({ src: x.src, on: x.on !== false })).concat(Ch().all().flatMap((c) => (c.scripts16 || []).map((x) => ({ src: x.src, on: x.on !== false, owner: Ch().name(c) }))));
    return JSON.stringify({ format: 'ocshimeji-script', version: 1, app: 'OC Shimeji', created: new Date().toISOString(), scripts: list }, null, 2);
  }
  const TEMPLATE = `# 範例：傍晚在海邊，A 約 B 看夕陽
event sunset_talk "夕陽下的約定"
trigger tick
cast A = self
cast B = any
when place beach
when time 17:00-19:30
when rel A B aff >= 40
chance 0.5
once pair
mode cutscene
---
cam A 2.4
move B to A
face A B
face B A
say A "你也來了。"
emote B heart
choice "要一起看完夕陽嗎？"
  "好啊" -> stay
  "我還有事" -> leave
label stay
anim A sit 3
anim B sit 3
say B "嗯，好安靜。"
rel A<>B aff +4 fam +2
remember A B "和{B}在海邊看完了夕陽" 0.6
set flag sunset_seen
end
label leave
say B "下次吧。"
feel A down 0.3
`;
  function reset() { cache = null; }

  OC.Script = { knownAction, compile, parseFile, add, all, bind, ready, trigger, play, start, step, stop, mark, tickCaption, exportAll, reset, holds, cond, words, OPS, OP_ZH, TRIGGERS, TRIG_ZH, TEMPLATE, ROLES, lib };
})();
