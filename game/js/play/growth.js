/* OC Shimeji — growth (Phase 6): skills that unlock real things, aspirations (long-term life goals), titles.
 * Skills keep using OC.Mind (xp in c.life.skills, level = OC.Mind.skillLv). This module adds:
 *   - three more skills (explore, art, music) and the unlock table (OC.PlayData.SKILLS)
 *   - has(c, unlockId): systems ask it before applying an effect (recipes, harvest bonus, fishing, new acts…)
 *   - aspirations: one per OC at a time; chosen from personality (the player can change, pause or lock it);
 *     steps advance from OC.Progress events; finishing gives rewards (OC.Tx), a memory, a title and maybe a
 *     growth suggestion (traits still need the player's consent through OC.Mind.suggest)
 *   - titles: unlocked for the island (S.play.titles); each OC can wear one
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, PD = () => OC.PlayData, M = () => OC.Mind, PR = () => OC.Progress;
  const name = (c) => OC.Chars.name(c);

  // ---------------- skills ----------------
  function extendSkills() {
    Object.assign(M().SKILLS, { explore: '探索', art: '藝術', music: '音樂' });
    const A = OC.LifeData.ACTS;
    if (A.explore && !A.explore.sk) A.explore.sk = 'explore';
    if (A.forage && !A.forage.sk) A.forage.sk = 'explore';
    if (A.study) A.study.unlock = 'study';
  }
  /** the level an unlock needs, and which skill */
  function unlockOf(id) { for (const [sk, d] of Object.entries(PD().SKILLS)) for (const [lv, uid, zh] of d.unlocks) if (uid === id) return { sk, lv, zh }; return null; }
  function has(c, id) { if (!c) return false; const u = unlockOf(id); return !!u && M().skillLv(c, u.sk) >= u.lv; }
  const anyHas = (id) => OC.Chars.all().some((c) => c.status.onIsland && has(c, id));
  /** may this OC do an activity yet? (acts with `unlock` need the skill level) */
  function allowed(c, act) { const A = OC.LifeData.ACTS[act]; return !A || !A.unlock || has(c, A.unlock); }
  /** what a skill gives at each level (for the profile) */
  function skillInfo(c, sk) {
    const d = PD().SKILLS[sk], xp = c.life.skills[sk] || 0, lv = M().skillLv(c, sk), cur = 15 * lv * lv, next = 15 * (lv + 1) * (lv + 1);
    return { id: sk, zh: d.zh, ic: d.ic, lv, xp, pct: lv >= 10 ? 100 : Math.round(((xp - cur) / (next - cur)) * 100), unlocks: d.unlocks.map(([l, id, zh]) => ({ lv: l, id, zh, on: lv >= l })) };
  }
  /** a level-up happened (from OC.Mind.skill): tell the player what it unlocked */
  function onSkillUp(e) {
    const c = OC.Chars.get(e.oc); if (!c) return; const d = PD().SKILLS[e.skill]; if (!d) return;
    const now = d.unlocks.filter(([l]) => l === e.lv).map(([, , zh]) => zh);
    if (now.length) M().note(c, 'growth', `${d.zh} Lv.${e.lv}：${now.join('、')}`);
    St.emit('play:skillUp', { oc: c.id, skill: e.skill, lv: e.lv, zh: d.zh, unlocks: now });
  }

  // ---------------- aspirations ----------------
  const ASP = () => PD().ASPIRATIONS;
  function aspOf(c) { return c.life.asp && ASP()[c.life.asp.id] ? c.life.asp : null; }
  /** give an OC an aspiration that fits (only if it has none and the player has not paused it) */
  function ensureAsp(c, force) {
    const a = c.life.asp; if (a && (ASP()[a.id] || a.off) && !force) return a;
    const done = (a && a.done) || [];
    const cands = Object.entries(ASP()).filter(([id]) => !done.includes(id)).map(([id, x]) => [id, Math.max(0, x.fit(c))]);
    const ch = OC.Sim.wpick(cands, (x) => x[1]); if (!ch) return null;
    return setAsp(c, ch[0], 'auto');
  }
  function setAsp(c, id, by = 'player') {
    const prev = c.life.asp || {}; if (prev.locked && by === 'auto') return prev;
    c.life.asp = { id, step: 0, prog: { n: 0 }, started: OC.Sim.now(), by, done: prev.done || [], locked: by === 'player' ? !!prev.locked : false };
    const x = ASP()[id]; M().note(c, 'growth', `新的人生目標：${x.zh}`);
    St.emit('play:aspNew', { oc: c.id, id, by }); St.touch('play', { asp: c.id }); return c.life.asp;
  }
  function pauseAsp(c) { c.life.asp = { off: true, done: (c.life.asp && c.life.asp.done) || [], locked: true }; St.touch('play', { asp: c.id }); }
  function lockAsp(c, v) { if (c.life.asp) c.life.asp.locked = !!v; St.touch('play', { asp: c.id }); }
  /** the life AI likes activities that serve the current aspiration */
  function actBonus(c, act) { const a = aspOf(c); if (!a) return 0; const x = ASP()[a.id]; return x.acts.includes(act) ? 0.22 : 0; }
  function onEventAsp(d) {
    for (const c of OC.Chars.all()) {
      const a = aspOf(c); if (!a) continue; const x = ASP()[a.id], step = x.steps[a.step]; if (!step) continue;
      if (!PR().match(step.goal, d, { oc: c.id })) continue;
      if (!PR().advance(a.prog, step.goal, d) || a.prog.n < step.goal.n) { St.touch('play', { asp: c.id }); continue; }
      a.step++; a.prog = { n: 0 };
      if (a.step < x.steps.length) {
        M().remember(c, { type: 'growth', imp: 0.5, text: `往「${x.zh}」的夢想前進了一步：${step.zh}`, key: `asp:${c.id}:${a.id}:${a.step}` });
        M().feel(c, 'proud', 0.4, `「${x.zh}」有進展`); St.emit('play:aspStep', { oc: c.id, id: a.id, step: a.step, zh: step.zh });
      } else finishAsp(c, a, x);
      St.touch('play', { asp: c.id });
    }
  }
  function finishAsp(c, a, x) {
    const key = `asp:${c.id}:${a.id}`; const g = OC.Quests.grant(key, x.reward, `${name(c)}完成人生目標「${x.zh}」`);
    M().remember(c, { type: 'milestone', imp: 0.95, text: `完成了人生目標「${x.zh}」！`, key: key + ':done' });
    M().feel(c, 'excited', 0.8, `完成「${x.zh}」`); M().player(c, { aff: 4, fam: 2 });
    const suggest = { green_thumb: ['trait', 'nature'], bookworm: ['trait', 'bookworm'], explorer: ['trait', 'curious'], home_chef: ['hobby', '料理'], angler: ['hobby', '釣魚'], social_star: ['trait', 'outgoing'], artist: ['trait', 'artsy'] }[a.id];
    if (suggest) M().suggest(c, suggest[0], suggest[1], `完成了「${x.zh}」`);
    a.done = (a.done || []).concat(a.id); const done = a.done, locked = a.locked;
    c.life.asp = { done, locked: false, next: OC.Sim.now() + 1440, prev: a.id };
    PR().emit('aspiration', { oc: c.id, id: a.id }); St.emit('play:aspDone', { oc: c.id, id: a.id, zh: x.zh, reward: x.reward, dup: g.dup });
    void locked;
  }
  /** called a few times per game day: OCs without an aspiration may find one (after a short rest) */
  function tick() { if (S().life.settings.aspAuto === false) return; for (const c of OC.Chars.all()) { const a = c.life.asp; if (a && (a.id || a.off)) continue; if (a && a.next && OC.Sim.now() < a.next) continue; ensureAsp(c); } }

  // ---------------- skill effects that happen when an activity ends ----------------
  function onFinish(c, act, b, gm) {
    const day = OC.Sim.day();
    if ((act === 'read' || act === 'study') && has(c, 'bookfriend')) M().needs(c, { mood: 6 }, '讀到喜歡的書');
    if (act === 'tend' && has(c, 'sun_seed') && OC.Sim.rnd() < 0.15) { const r = OC.Tx.run(`sunseed:${c.id}:${day}`, { get: { items: { seed_sun: 1 } } }, `${name(c)}帶回了向日葵種子`); if (r.ok) { M().note(c, 'growth', '在花草間找到向日葵種子'); St.emit('play:found', { oc: c.id, item: 'seed_sun' }); } }
    if (act === 'sketch' && has(c, 'gift_art') && OC.Sim.rnd() < 0.25) { const r = OC.Tx.run(`art:${c.id}:${day}`, { get: { items: { painting: 1 } } }, `${name(c)}送你一幅畫`); if (r.ok) { M().remember(c, { type: 'player', imp: 0.55, text: '把畫好的作品送給你', key: `art:${c.id}:${day}` }); St.emit('play:found', { oc: c.id, item: 'painting', gift: true }); } }
    if (act === 'sing' && has(c, 'chorus') && b && b.a) for (const o of Object.values(OC.Brain.brains)) { if (o === b || !o.a) continue; if (Math.hypot(o.a.x - b.a.x, o.a.y - b.a.y) < 140) { const oc = OC.Chars.get(o.id); if (oc) { M().needs(oc, { mood: 6 }, `聽${name(c)}唱歌`); M().feel(oc, 'happy', 0.2, `聽${name(c)}唱歌`, c.id); } } }
    void gm;
  }

  // ---------------- titles ----------------
  function giveTitle(id) { const T = (S().play.titles = S().play.titles || {}); if (T[id] || !PD().TITLES[id]) return false; T[id] = Date.now(); St.emit('play:title', { id, zh: PD().TITLES[id] }); St.touch('play', { title: id }); return true; }
  function titles() { return Object.keys(S().play.titles || {}).map((id) => ({ id, zh: PD().TITLES[id] })).filter((t) => t.zh); }
  function wearTitle(c, id) { c.title = id && (S().play.titles || {})[id] ? id : null; OC.Chars.save(c); }
  const titleOf = (c) => (c && c.title && PD().TITLES[c.title]) || '';

  OC.Growth = { onFinish, extendSkills, unlockOf, has, anyHas, allowed, skillInfo, onSkillUp, aspOf, ensureAsp, setAsp, pauseAsp, lockAsp, actBonus, onEventAsp, tick, giveTitle, titles, wearTitle, titleOf };
})();
