/* OC Shimeji — stage: short cinematic performances + feedback cards (Phase 6).
 *   OC.Stage.perform(kind, opts)  plays a script from STAGES[kind] (declarative steps, a variant per temperament)
 *   steps: ['cam', who, zoom] ['face', who, 'player'|'b'] ['walk', who, 'player'] ['anim', who, action, sec]
 *          ['jump', who] ['say', who, category] ['fx', who, kind] ['sfx', name] ['prop', who, item, sec]
 *          ['wait', sec] ['card', kind] ['emote', who, text]
 *   Performances never change game data: callers apply results first (inside OC.Tx etc.), so skipping (or an
 *   interruption) can never lose or duplicate a reward. The cast is held (Brain.hold 'stage') so autonomous life
 *   does not walk away mid-scene; important ones get a soft letterbox, a skip button and ×2.
 *   OC.Stage.card(o) shows a small card (quest / achievement / discovery / level up / title) — queued, never stacked high.
 * Reduce motion (settings) → no camera moves, no letterbox, fewer particles.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, A = () => OC.App, W = () => OC.World, B = () => OC.Brain, $ = (s) => document.querySelector(s);
  const { h, icon } = OC.UI;
  const reduce = () => !!(S().settings.reduceMotion);

  // ---------------- temperament → variant ----------------
  function style(c) {
    if (!c) return 'plain';
    if (OC.Chars.has(c, 'shy') || (OC.Talk.voice(c) === 'calm' && c.personality.expression < 45)) return 'shy';
    if (OC.Talk.voice(c) === 'cool') return 'cool';
    if (OC.Talk.voice(c) === 'bright' || OC.Chars.has(c, 'cheerful') || c.personality.energy >= 65) return 'bright';
    if (c.needs.energy < 25) return 'tired';
    return 'plain';
  }
  // ---------------- scripts (data) ----------------
  const STAGES = {
    taste_fav: { important: true, steps: {
      plain: [['cam', 'a', 2.5], ['face', 'a', 'player'], ['anim', 'a', 'taste', 1.1], ['sfx', 'chew'], ['wait', 1.0], ['anim', 'a', 'yum', 2.6], ['sfx', 'yum'], ['fx', 'a', 'hearts'], ['say', 'a', 'react_yum'], ['wait', 2.0]],
      bright: [['cam', 'a', 2.5], ['face', 'a', 'player'], ['anim', 'a', 'taste', 0.9], ['sfx', 'chew'], ['wait', 0.8], ['anim', 'a', 'surprised', 0.6], ['wait', 0.5], ['jump', 'a'], ['sfx', 'jump'], ['anim', 'a', 'yum', 1.4], ['sfx', 'yum'], ['fx', 'a', 'hearts'], ['wait', 1.2], ['anim', 'a', 'dance', 2.0], ['fx', 'a', 'notes'], ['say', 'a', 'react_yum'], ['wait', 1.8]],
      shy: [['cam', 'a', 2.6], ['face', 'a', 'player'], ['anim', 'a', 'taste', 1.3], ['sfx', 'chew'], ['wait', 1.2], ['anim', 'a', 'shy', 1.6], ['fx', 'a', 'blush'], ['wait', 1.0], ['anim', 'a', 'yum', 1.8], ['sfx', 'yum'], ['fx', 'a', 'hearts'], ['say', 'a', 'react_yum'], ['wait', 1.8]],
      cool: [['cam', 'a', 2.4], ['face', 'a', 'player'], ['anim', 'a', 'taste', 1.4], ['sfx', 'chew'], ['wait', 1.4], ['anim', 'a', 'nod', 1.0], ['wait', 0.6], ['anim', 'a', 'yum', 1.6], ['fx', 'a', 'sparkle'], ['sfx', 'yum'], ['say', 'a', 'react_yum'], ['wait', 1.6]],
    } },
    taste_hate: { important: true, steps: {
      plain: [['cam', 'a', 2.5], ['face', 'a', 'player'], ['anim', 'a', 'taste', 1.1], ['sfx', 'chew'], ['wait', 1.0], ['anim', 'a', 'yuck', 2.4], ['sfx', 'yuck'], ['fx', 'a', 'gloom'], ['say', 'a', 'react_yuck'], ['wait', 1.8]],
      bright: [['cam', 'a', 2.5], ['face', 'a', 'player'], ['anim', 'a', 'taste', 0.8], ['wait', 0.6], ['anim', 'a', 'surprised', 0.5], ['sfx', 'bonk'], ['wait', 0.4], ['anim', 'a', 'yuck', 2.2], ['sfx', 'yuck'], ['fx', 'a', 'sweat'], ['say', 'a', 'react_yuck'], ['wait', 1.6]],
      shy: [['cam', 'a', 2.6], ['face', 'a', 'player'], ['anim', 'a', 'taste', 1.2], ['wait', 1.2], ['anim', 'a', 'cry', 2.2], ['sfx', 'yuck'], ['fx', 'a', 'gloom'], ['say', 'a', 'react_yuck'], ['wait', 1.8]],
      cool: [['cam', 'a', 2.4], ['face', 'a', 'player'], ['anim', 'a', 'taste', 1.2], ['wait', 1.4], ['anim', 'a', 'shake', 1.2], ['sfx', 'bonk'], ['fx', 'a', 'sweat'], ['say', 'a', 'react_yuck'], ['wait', 1.4]],
    } },
    taste_like: { steps: { plain: [['face', 'a', 'player'], ['anim', 'a', 'taste', 0.8], ['wait', 0.7], ['anim', 'a', 'happy', 1.6], ['sfx', 'chime'], ['fx', 'a', 'sparkle']], bright: [['face', 'a', 'player'], ['anim', 'a', 'taste', 0.6], ['wait', 0.5], ['jump', 'a'], ['anim', 'a', 'happy', 1.6], ['sfx', 'chime'], ['fx', 'a', 'sparkle']], shy: [['face', 'a', 'player'], ['anim', 'a', 'taste', 0.9], ['wait', 0.7], ['anim', 'a', 'shy', 1.6], ['sfx', 'chime'], ['fx', 'a', 'blush']], cool: [['face', 'a', 'player'], ['anim', 'a', 'taste', 1], ['wait', 0.8], ['anim', 'a', 'nod', 1.0], ['sfx', 'chime']] } },
    taste_ok: { steps: { plain: [['face', 'a', 'player'], ['anim', 'a', 'taste', 0.8], ['wait', 0.6], ['anim', 'a', 'nod', 1.0]] } },
    taste_dislike: { steps: { plain: [['face', 'a', 'player'], ['anim', 'a', 'taste', 0.8], ['wait', 0.8], ['anim', 'a', 'sad', 1.6], ['sfx', 'bonk'], ['fx', 'a', 'sweat']], cool: [['face', 'a', 'player'], ['anim', 'a', 'taste', 1], ['wait', 0.8], ['anim', 'a', 'shake', 1.0], ['fx', 'a', 'sweat']] } },
    gift: { steps: {
      plain: [['face', 'a', 'player'], ['prop', 'a', '{item}', 2.2], ['anim', 'a', 'receive', 1.2], ['say', 'a', 'receive'], ['wait', 1.0], ['anim', 'a', '{react}', 1.6], ['sfx', 'gift'], ['fx', 'a', '{fx}']],
      bright: [['face', 'a', 'player'], ['prop', 'a', '{item}', 2.2], ['anim', 'a', 'receive', 0.9], ['say', 'a', 'receive'], ['wait', 0.7], ['jump', 'a'], ['anim', 'a', '{react}', 1.6], ['sfx', 'gift'], ['fx', 'a', '{fx}']],
      shy: [['face', 'a', 'player'], ['prop', 'a', '{item}', 2.6], ['anim', 'a', 'receive', 1.4], ['fx', 'a', 'blush'], ['wait', 1.0], ['anim', 'a', 'shy', 1.6], ['sfx', 'gift'], ['fx', 'a', '{fx}']],
    } },
    accept: { steps: { plain: [['face', 'a', 'player'], ['anim', 'a', 'happy', 1.4], ['say', 'a', 'req_accept']], bright: [['face', 'a', 'player'], ['jump', 'a'], ['sfx', 'jump'], ['anim', 'a', 'cheer', 1.4], ['say', 'a', 'req_accept']], shy: [['face', 'a', 'player'], ['anim', 'a', 'shy', 1.4], ['fx', 'a', 'blush'], ['say', 'a', 'req_accept']], cool: [['face', 'a', 'player'], ['anim', 'a', 'nod', 1.0], ['say', 'a', 'req_accept']] } },
    decline: { steps: { plain: [['face', 'a', 'player'], ['anim', 'a', 'sad', 1.2], ['say', 'a', 'req_decline']], bright: [['face', 'a', 'player'], ['anim', 'a', 'surprised', 0.5], ['wait', 0.4], ['anim', 'a', 'sad', 1.0], ['say', 'a', 'req_decline']], cool: [['face', 'a', 'player'], ['anim', 'a', 'shake', 0.8], ['say', 'a', 'req_decline']] } },
    reqDone: { important: true, steps: {
      plain: [['walk', 'a', 'player'], ['face', 'a', 'player'], ['cam', 'a', 2.3], ['anim', 'a', 'surprised', 0.6], ['wait', 0.4], ['anim', 'a', 'cheer', 1.6], ['sfx', 'chime'], ['fx', 'a', 'hearts'], ['say', 'a', 'req_done'], ['wait', 1.4], ['card', 'req'], ['wait', 0.8]],
      bright: [['walk', 'a', 'player'], ['face', 'a', 'player'], ['cam', 'a', 2.3], ['jump', 'a'], ['sfx', 'jump'], ['anim', 'a', 'cheer', 1.2], ['fx', 'a', 'confetti'], ['sfx', 'chime'], ['wait', 0.6], ['anim', 'a', 'dance', 1.8], ['say', 'a', 'req_done'], ['wait', 1.2], ['card', 'req'], ['wait', 0.8]],
      shy: [['walk', 'a', 'player'], ['face', 'a', 'player'], ['cam', 'a', 2.4], ['anim', 'a', 'shy', 1.6], ['fx', 'a', 'blush'], ['wait', 0.8], ['anim', 'a', 'happy', 1.4], ['sfx', 'chime'], ['fx', 'a', 'hearts'], ['say', 'a', 'req_done'], ['wait', 1.4], ['card', 'req'], ['wait', 0.8]],
      cool: [['walk', 'a', 'player'], ['face', 'a', 'player'], ['cam', 'a', 2.2], ['anim', 'a', 'nod', 1.0], ['wait', 0.5], ['anim', 'a', 'proud', 1.4], ['sfx', 'chime'], ['fx', 'a', 'sparkle'], ['say', 'a', 'req_done'], ['wait', 1.2], ['card', 'req'], ['wait', 0.8]],
    } },
    levelup: { steps: { plain: [['anim', 'a', 'proud', 1.8], ['sfx', 'levelup'], ['fx', 'a', 'sparkle'], ['say', 'a', 'skill_up'], ['card', 'skill']], bright: [['jump', 'a'], ['anim', 'a', 'cheer', 1.8], ['sfx', 'levelup'], ['fx', 'a', 'confetti'], ['say', 'a', 'skill_up'], ['card', 'skill']], shy: [['anim', 'a', 'shy', 1.2], ['sfx', 'levelup'], ['fx', 'a', 'sparkle'], ['wait', 0.6], ['anim', 'a', 'proud', 1.2], ['card', 'skill']] } },
    aspDone: { important: true, steps: { plain: [['walk', 'a', 'player'], ['face', 'a', 'player'], ['cam', 'a', 2.3], ['anim', 'a', 'cheer', 2.0], ['sfx', 'fanfare'], ['fx', 'a', 'confetti'], ['say', 'a', 'asp_done'], ['wait', 1.6], ['card', 'asp'], ['wait', 1.0]] } },
    aspStep: { steps: { plain: [['anim', 'a', 'proud', 1.4], ['sfx', 'chime'], ['fx', 'a', 'sparkle'], ['say', 'a', 'asp_step'], ['card', 'aspstep']] } },
    aspNew: { steps: { plain: [['anim', 'a', 'think', 1.4], ['wait', 0.8], ['anim', 'a', 'happy', 1.2], ['say', 'a', 'asp_new'], ['card', 'aspnew']] } },
  };

  // ---------------- runner ----------------
  let cur = null; const queue = [];
  let ui = null;
  function controls(show) {
    if (show && !ui) {
      ui = h('div.stage-ui', null, h('div.bar.top'), h('div.bar.bot'), h('div.stage-btns', null,
        h('button.btn.s', { 'aria-label': '加速', on: { click: (e) => { if (!cur) return; cur.speed = cur.speed === 1 ? 2 : 1; e.currentTarget.textContent = cur.speed === 1 ? '×2' : '×1'; } } }, '×2'),
        h('button.btn.s', { 'aria-label': '跳過', on: { click: () => skip() } }, '跳過 ›')));
      document.getElementById('app').append(ui); requestAnimationFrame(() => ui && ui.classList.add('on'));
      if (reduce()) ui.classList.add('rm');
    } else if (!show && ui) { const el = ui; ui = null; el.classList.remove('on'); setTimeout(() => el.remove(), 400); }
  }
  function skip() { if (cur) { cur.skip = true; cur.wake && cur.wake(); } if (OC.Events && OC.Events.current) OC.Events.current.fast = true; }
  const sleep = (sec) => new Promise((res) => { if (!cur || cur.skip) return res(); const t = setTimeout(res, (sec * 1000) / cur.speed); cur.wake = () => { clearTimeout(t); res(); }; });

  function sub(v, vars) { return typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : v; }
  async function runSteps(steps, cast, vars) {
    for (const st0 of steps) {
      if (!cur) return; const st = st0.map((x) => sub(x, vars));
      const [k, who] = st, a = who && cast[who] ? cast[who].a : null, c = who && cast[who] ? cast[who].c : null;
      if (who && cast[who] && !cast[who].a) continue;
      switch (k) {
        case 'cam': if (!cur.skip && !reduce() && a && W().camTo) W().camTo(a, st[2]); break;
        case 'face': if (a) { const t = st[2] === 'player' ? A().player : cast[st[2]] && cast[st[2]].a; if (t && t !== a) B().face(a, t); } break;
        case 'walk': if (a && !cur.skip) await walkNear(a); break;
        case 'anim': if (a) W().setAction(a, st[2], { dur: (st[3] || 1.4) / (cur.skip ? 4 : 1), priority: 9 }); if (!cur.skip) await sleep(Math.min(st[3] || 1.4, 0.9) * 0.7); break;
        case 'jump': if (a && !cur.skip) W().jump(a); break;
        case 'say': if (a && c && !cur.skip) { const ln = OC.Talk.say(st[2], c, cast.b ? cast.b.c : null, { vars, item: vars.item }); if (ln) A().bubble(a, ln.text, OC.Chars.name(c)); } break;
        case 'fx': if (a && !cur.skip) fx(a, st[2]); break;
        case 'sfx': if (!cur.skip && OC.Sound) OC.Sound.play(st[1]); break;
        case 'prop': if (a) { a.overrides = Object.assign({}, a.overrides || {}, { held: st[2] }); a.key = ''; const aa = a; setTimeout(() => { if (aa.overrides) { delete aa.overrides.held; aa.key = ''; } }, ((st[3] || 2) * 1000) / (cur ? cur.speed : 1)); } break;
        case 'emote': if (a && !cur.skip) A().floatText(a, st[2]); break;
        case 'wait': await sleep(st[1]); break;
        case 'card': if (cur.card) OC.Stage.card(cur.card); break;
      }
    }
  }
  function walkNear(a) {
    const pl = A().player; if (!pl || pl === a) return Promise.resolve();
    if (Math.hypot(a.x - pl.x, a.y - pl.y) < 40) return Promise.resolve();
    const side = a.x < pl.x ? -1 : 1, p = W().nearestWalkable(pl.x + side * 26, pl.y + 2, 20); if (!p) return Promise.resolve();
    return new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; a.run = false; res(); } }; a.run = true; if (!W().walkTo(a, p.x, p.y, fin)) fin(); setTimeout(fin, 4500); if (cur) cur.wake = fin; });
  }
  /** play a performance; resolves when done (or skipped). Never changes data. */
  function perform(kind, o = {}) {
    return new Promise((resolve) => { queue.push({ kind, o, resolve }); if (!cur) next(); });
  }
  async function next() {
    const job = queue.shift(); if (!job) return;
    const { kind, o } = job, def = STAGES[kind], c = o.oc && OC.Chars.get(o.oc), a = o.oc && A().actorOf(o.oc);
    // no actor on screen → only the card (if any)
    const cardData = makeCard(kind, o);
    if (!def || !a || a.hidden || A().curTab !== 'island') { if (cardData) OC.Stage.card(cardData); job.resolve(false); next(); return; }
    const variant = def.steps[style(c)] || def.steps.plain;
    cur = { kind, skip: false, speed: 1, card: cardData };
    const cast = { a: { a, c } }; if (o.other && A().actorOf(o.other)) cast.b = { a: A().actorOf(o.other), c: OC.Chars.get(o.other) };
    const vars = Object.assign({ item: o.item || '', react: o.react || 'happy', fx: o.fx || 'sparkle' }, o.vars || {});
    const ids = Object.values(cast).map((x) => x.c && x.c.id).filter(Boolean);
    for (const id of ids) B().hold(id, 'stage');
    const important = !!def.important && !o.small;
    const zoom0 = W().zoom;
    if (important) controls(true);
    try { await runSteps(variant, cast, vars); }
    catch (e) { console.error('[stage]', kind, e); }
    finally {
      if (important) controls(false);
      if (W().camTo && W().camTarget) W().camTo(null, zoom0);
      for (const id of ids) B().unhold(id, 'stage');
      for (const x of Object.values(cast)) if (x.a && x.a.overrides) { delete x.a.overrides.held; x.a.key = ''; }
      const was = cur; cur = null; job.resolve(!was.skip);
      setTimeout(next, 120);
    }
  }

  // ---------------- particles (DOM, follow the actor) ----------------
  const FX = { hearts: ['♥', 'var(--heart)', 6], sparkle: ['✦', 'var(--sun)', 7], notes: ['♪', 'var(--purple)', 5], gloom: ['┃', 'rgba(110,120,150,.8)', 4], sweat: ['💧', null, 2], blush: ['〃', 'var(--pink)', 2], confetti: ['■', null, 14] };
  const parts = [];
  function fx(a, kind) {
    const f = FX[kind]; if (!f) return; const ov = document.getElementById('overlays'); if (!ov) return;
    const n = reduce() ? Math.min(2, f[2]) : f[2], cols = ['#F26B5B', '#FFC93C', '#3FC1B0', '#9B7BE0', '#5BC0EB', '#F48FB1'];
    for (let i = 0; i < n; i++) {
      const el = h('span.fx-p.' + kind, { style: { color: f[1] || cols[i % cols.length], '--dx': ((Math.random() - 0.5) * (kind === 'confetti' ? 90 : 50)).toFixed(0) + 'px', '--dy': (-(30 + Math.random() * 40)).toFixed(0) + 'px', '--r': ((Math.random() - 0.5) * 360).toFixed(0) + 'deg', animationDelay: (i * (kind === 'confetti' ? 0.02 : 0.09)).toFixed(2) + 's' } }, f[0]);
      if (reduce()) el.classList.add('rm'); ov.append(el); parts.push({ el, a, t: 0, up: kind === 'gloom' ? 44 : 50 });
    }
  }
  function tick(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt; if (p.t > 1.8 || !p.a || p.a.hidden) { p.el.remove(); parts.splice(i, 1); continue; }
      const q = W().project(p.a.x, p.a.y, p.a.lvl, (p.a.gy - p.a.lvl * W().HY) + p.up); p.el.style.left = q.x + 'px'; p.el.style.top = q.y + 'px';
    }
  }

  // ---------------- feedback cards ----------------
  const cards = []; let showing = 0;
  function makeCard(kind, o) {
    const c = o.oc && OC.Chars.get(o.oc), nm = c ? OC.Chars.name(c) : '';
    switch (kind) {
      case 'reqDone': return { kind: 'req', ic: 'heart', title: '完成請求', sub: `${nm}：${o.req ? o.req.text : ''}`, reward: o.reward, thanks: o.thanks };
      case 'levelup': return { kind: 'skill', ic: 'sparkle', title: `${nm}的${o.zh} Lv.${o.lv}`, sub: (o.unlocks || []).length ? '解鎖：' + o.unlocks.join('、') : '技能變熟練了' };
      case 'aspDone': return { kind: 'asp', ic: 'star', title: `${nm}實現了夢想！`, sub: `「${o.zh}」`, reward: o.reward };
      case 'aspStep': return { kind: 'asp', ic: 'flag', title: `${nm}的夢想有進展`, sub: o.zh };
      case 'aspNew': return { kind: 'asp', ic: 'flag', title: `${nm}有了新夢想`, sub: `「${o.zh}」` };
      default: return null;
    }
  }
  function card(o) { cards.push(o); pump(); }
  function pump() {
    if (showing >= 2 || !cards.length) return; const o = cards.shift(); showing++;
    let wrap = document.querySelector('.p6-cards'); if (!wrap) { wrap = h('div.p6-cards', { 'aria-live': 'polite' }); document.getElementById('app').append(wrap); }
    const art = o.item ? (() => { const im = OC.Style.itemImg(o.item); im.style.width = im.style.height = '40px'; return im; })() : h('div.card-ic.' + (o.kind || ''), null, icon(o.ic || 'sparkle'));
    const rw = o.reward ? [o.reward.coins ? `+${o.reward.coins} 星幣` : null, ...Object.entries(o.reward.items || {}).map(([id, n]) => `${(OC.Style.ITEMS[id] || { zh: id }).zh}×${n}`), o.reward.title ? `稱號「${OC.PlayData.TITLES[o.reward.title]}」` : null, o.thanks ? `謝禮：${(OC.Style.ITEMS[o.thanks] || { zh: o.thanks }).zh}` : null].filter(Boolean).join('　') : '';
    const el = h('div.p6-card.' + (o.kind || ''), { role: 'status', on: { click: () => close() } }, art, h('div.grow', null, h('b', null, o.title), o.sub ? h('div.sub', null, o.sub) : null, rw ? h('div.rw', null, rw) : null));
    wrap.append(el); requestAnimationFrame(() => el.classList.add('on'));
    if (OC.Sound) OC.Sound.play(o.sound || { quest: 'chime', ach: 'fanfare', discover: 'sparkle', skill: 'levelup', title: 'fanfare', req: 'card', asp: 'card' }[o.kind] || 'card');
    let closed = false; const close = () => { if (closed) return; closed = true; el.classList.remove('on'); setTimeout(() => { el.remove(); showing--; pump(); }, 320); };
    setTimeout(close, o.ms || 3000);
  }

  OC.Stage = { perform, card, fx, tick, skip, style, STAGES, controls, get busy() { return !!cur; }, get queue() { return queue.length; } };
})();
