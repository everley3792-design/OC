/* OC Shimeji — world gameplay layer (Phase 5): travel between places with a soft transition,
 * arrival (first-visit memories, exploration), live visuals for the garden / forage bushes /
 * critters, and what tapping each facility does (shops, café counter, fishing, cooking, garden,
 * forage, critters, bookshelves, desks). No 3D scene is rebuilt for pages / sheets; only travel
 * loads another place (the previous one is disposed by world.js).
 */
(function () {
  'use strict';
  const { h, icon, toast, sheet, haptic } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, Wd = () => OC.World, PL = () => OC.Places, A = () => OC.App, M = () => OC.Mind, Sim = () => OC.Sim;
  const I = (id) => OC.Style.ITEMS[id];
  let critterMeshes = [], forageMeshes = [], plotMeshes = [];

  // ======================= travel =======================
  let busy = false, pending = null;
  /** go to a place. 'map' opens the world map. from = the place we leave (for the door we appear at) */
  function travel(to, o = {}) {
    if (to === 'map') { A().tab('explore'); return; }
    const p = PL().get(to); if (!p || p.locked) { toast(p ? p.why || '尚未開放' : '沒有這個地方', 'lock'); return; }
    const from = Wd().area ? Wd().area.id : null; if (from === to) { A().tab('island'); return; }
    if (busy) { pending = to; return; } busy = true;   // a request during the fade is kept (the last one wins), not dropped
    const f = document.getElementById('fade'), lab = h('div.travel-label', null, h('b', null, p.zh), h('span', null, PL().TYPES[p.type] || ''), h('i.dots', null, h('i'), h('i'), h('i')));
    f.replaceChildren(lab); f.style.opacity = 1; f.style.pointerEvents = 'auto';
    setTimeout(() => {
      try {
        // where do we appear? interior ← parent door / parent ← child door / outdoor ← its spawn
        const area = OC.Areas[p.area]; let pos = null;
        if (from && area.doors && area.doors[from]) pos = Object.assign({}, area.doors[from], { y: area.doors[from].y + 10 });
        else if (area.interior) pos = Object.assign({}, area.spawn);
        A().loadArea(to, pos ? Object.assign({ area: to }, pos) : null, { from });
        A().tab('island');
      } catch (e) { console.error(e); toast('移動時發生錯誤：' + e.message, 'info'); }
      setTimeout(() => { f.style.opacity = 0; f.style.pointerEvents = 'none'; busy = false; setTimeout(() => f.replaceChildren(), 400); if (pending) { const nx = pending; pending = null; if (nx !== (Wd().area && Wd().area.id)) travel(nx); } }, 220);
    }, o.instant ? 0 : 380);
  }
  /** after a place is built: visits, discoveries, visuals */
  function arrived(id, from) {
    const p = PL().get(id), first = PL().visit(id), c = A().me();
    if (c) { c.life.loc = id; c.life.places = c.life.places || {}; const r = c.life.places[id] = c.life.places[id] || { visits: 0, last: 0 }; r.visits++; r.last = Sim().now();
      if (first || r.visits === 1) { M().remember(c, { type: 'discover', imp: 0.6, place: 'place:' + id, text: `第一次來到${p.zh}`, key: 'place:first:' + id + ':' + c.id }); M().feel(c, OC.Chars.has(c, 'shy') && p.type === 'street' ? 'nervous' : 'curious', 0.45, '第一次來到' + p.zh); } }
    if (first) setTimeout(() => toast(`新地點：${p.zh}`, 'compass'), 500);
    if (OC.Events) OC.Events.trigger('arrive', { a: c && c.id, place: id, placeZh: p.zh });
    setupVisuals(id);
    S().stats.visits[id] = (S().stats.visits[id] || 0) + 1; if (from && OC.Game.progress) OC.Game.progress('visit');
  }

  // ======================= live visuals (garden, forage, critters) =======================
  function setupVisuals(id) {
    critterMeshes = []; forageMeshes = []; plotMeshes = [];
    const area = Wd().area, ctx = { V3: Wd().V3 };
    for (const it of Wd().interacts) if (it.type === 'plot') plotMeshes.push(it);
    (area.forageSpots || []).forEach(([x, y, kind], i) => {
      const b = OC.Models.forageBush(kind); b.position.copy(Wd().V3(x, y, 0, 1.5)); Wd().root.add(b); Wd().block(x, y, 16, 9);
      const it = Wd().addInteract({ type: 'forage', area: id, i, kind, x, y: y + 4, hit: { w: 30, h: 30, d: 8 }, at: { x, y: y + 16 }, label: I(kind).zh + '（採集）' }); forageMeshes.push({ it, b });
    });
    (area.critterSpots || []).forEach(([x, y, sp], i) => {
      const m = OC.Models.critter((I(sp).art || {}).a || '#7FD3F7'); m.visible = false; m.position.copy(Wd().V3(x, y, 0, 12)); Wd().root.add(m);
      const it = Wd().addInteract({ type: 'critter', area: id, i, x, y, hit: { w: 28, h: 30, d: 10 }, at: { x, y: y + 18 }, label: '小生物', hidden: true }); critterMeshes.push({ it, m, x, y, i });
    });
    Wd().buildGrid(); refreshVisuals(true); void ctx;
  }
  let visT = 0;
  function refreshVisuals(force) {
    const area = Wd().area; if (!area) return;
    for (const p of plotMeshes) { const st = PL().plot(p.id), stage = PL().stageOf(st), key = stage + '|' + PL().wet(st) + '|' + st.seed; if (force || p._k !== key) { p._k = key; OC.Models.setPlot(p.mesh, stage, st.seed && I(I(st.seed).grow.crop).art ? I(I(st.seed).grow.crop).art.a : '#E8453C', PL().wet(st)); p.label = st.seed ? `${I(st.seed).zh.replace('種子', '')}・${PL().STAGES[stage]}${stage < 4 ? (PL().wet(st) ? '（今天澆過水）' : '（需要澆水）') : ''}` : '菜園（空地）'; } }
    for (const f of forageMeshes) { const ok = PL().forageAvail(area.id, f.it.i); f.b.userData.fruit.visible = ok; f.it.label = I(f.it.kind).zh + (ok ? '（可以採集）' : '（明天再來）'); }
    for (const c of critterMeshes) { const at = PL().critterAt(area.id, c.i); c.m.visible = !!at; c.it.hidden = !at; c.it.critter = at; if (at) c.it.label = I(at.species).zh; }
  }
  function tick(dt, t) {
    visT += dt; if (visT > 1.5) { visT = 0; refreshVisuals(); }
    for (const c of critterMeshes) if (c.m.visible) { c.m.position.copy(Wd().V3(c.x + Math.sin(t * 1.3 + c.i) * 6, c.y + Math.cos(t * 0.9 + c.i) * 3, 0, 12 + Math.abs(Math.sin(t * 4 + c.i)) * 3)); c.m.children.forEach((w, k) => { if (k < 2) w.rotation.z = Math.sin(t * 18 + k * Math.PI) * 0.6; }); }
  }

  // ======================= facilities =======================
  function goThen(it, fn) { A().goThen(it.at.x, it.at.y, fn); }
  function tap(it) {
    switch (it.type) {
      case 'exit': goThen(it, () => travel(it.to)); return true;
      case 'shop': goThen(it, () => OC.Pages.open('shop', { shop: it.shop || 'general' })); return true;
      case 'counter': goThen(it, () => OC.Pages.open('shop', { shop: it.shop || 'cafe' })); return true;
      case 'fishing': goThen(it, () => OC.Mini.fishing(it.water, it)); return true;
      case 'stove': goThen(it, () => OC.Mini.cooking(it)); return true;
      case 'plot': goThen(it, () => gardenSheet(it)); return true;
      case 'forage': goThen(it, () => doForage(it)); return true;
      case 'critter': if (!it.critter) { toast('牠跑掉了…', 'leaf'); return true; } goThen(it, () => OC.Mini.critter(it)); return true;
      case 'bookshelf': goThen(it, () => useBy('read', it)); return true;
      case 'towel': goThen(it, () => useBy('nap', it)); return true;
    }
    if (it.type === 'furn') { const d = I(it.id) || {}; if ((d.verbs || []).includes('cook')) { A().goThen(it.x, it.y + 14, () => OC.Mini.cooking(it)); return true; } if ((d.verbs || []).includes('study')) { A().goThen(it.x, it.y + 14, () => useBy('study', it)); return true; } if ((d.verbs || []).includes('read') && !d.sit) { A().goThen(it.x, it.y + 14, () => useBy('read', it)); return true; } if ((d.verbs || []).includes('play') && !d.sit) { A().goThen(it.x, it.y + 14, () => useBy('play', it)); return true; } if (d.sleep || it.id === 'bed') { A().goThen(it.x + 16, it.y + 6, () => useBy('sleep', it)); return true; } }
    return false;
  }
  /** the played OC uses a facility through the life engine (proper slot, alignment, animation) */
  function useBy(act, it) {
    const id = S().activeId, b = OC.Brain.get(id); if (!b) return;
    const r = OC.Brain.command(id, act); toast(r === 'later' ? '先把手上的事做完' : `${OC.Chars.name(A().me())}：${OC.LifeData.ACTS[act].zh}`, 'sparkle'); void it;
  }
  function doForage(it) {
    const r = PL().forage(it.area, it.i, it.kind); if (!r.ok) { toast(r.why, 'leaf'); return; }
    haptic(); A().floatText(A().player, `+${r.n} ${I(r.item).zh}`); OC.Brain.playerAct(S().activeId); OC.World.setAction(A().player, 'tend', { dur: 1.2, priority: 4 });
    const c = A().me(); M().skill(c, 'garden', 0.6); St.stat('picked'); OC.Game.progress('pick'); if (r.firsts && r.firsts.length) discovered(r.firsts);
    refreshVisuals();
  }
  function gardenSheet(it) {
    const st = PL().plot(it.id), stage = PL().stageOf(st);
    sheet('菜園', (b, api) => {
      const seeds = Object.keys(S().inv).filter((id) => I(id) && I(id).grow);
      if (!st.seed) {
        b.append(h('p.muted', null, '選一包種子種下去。每個遊戲日要澆一次水（下雨天會自動澆水），沒澆水的那天不會長大。'),
          seeds.length ? h('div.item-grid', null, ...seeds.map((sd) => { const im = OC.Style.itemImg(sd); im.style.width = im.style.height = '44px'; return h('button.item-btn', { on: { click: () => { const r = PL().plant(it.id, sd); if (!r.ok) { toast(r.why, 'info'); return; } haptic(); toast(`種下了${I(sd).zh}`, 'leaf'); api.close(); refreshVisuals(true); } } }, im, h('span', null, I(sd).zh), h('small.num', null, `×${St.count(sd)}・約 ${I(sd).grow.days} 天`)); })) : h('div.empty', null, '背包裡沒有種子。可以到每日市場或食品店買。'));
        return;
      }
      const prog = Math.round(st.growth * 100);
      b.append(h('div.hstack', null, OC.Style.itemImg(I(st.seed).grow.crop), h('div.grow', null, h('b', null, I(I(st.seed).grow.crop).zh), h('div.muted', null, `${PL().STAGES[stage]}・成長 ${prog}%`), h('div.bar', null, h('i', { style: { width: prog + '%', '--c': 'var(--need-active)' } })), h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '4px' } }, stage === 4 ? '可以收成了！' : PL().wet(st) ? `今天已經澆過水了${st.wateredBy && st.wateredBy !== 'player' ? `（${OC.Chars.name(OC.Chars.get(st.wateredBy)) || 'OC'}幫忙澆的）` : ''}` : '今天還沒澆水'))),
        h('div.hstack', { style: { marginTop: '12px' } },
          stage === 4 ? h('button.btn.primary.block', { on: { click: () => { const r = PL().harvest(it.id); if (!r.ok) { toast(r.why, 'info'); return; } haptic(); toast(`收成了 ${I(r.crop).zh} ×${r.n}`, 'leaf'); const c = A().me(); M().skill(c, 'garden', 4); M().feel(c, 'proud', 0.5, '收成' + I(r.crop).zh); M().remember(c, { type: 'activity', imp: 0.5, place: 'place:isle', text: `收成了${I(r.crop).zh}`, key: 'harvest:' + it.id + ':' + Date.now() }); if (r.firsts.length) discovered(r.firsts); api.close(); refreshVisuals(true); } } }, icon('leaf', 's'), '收成')
            : h('button.btn.primary.block', { disabled: PL().wet(st), on: { click: () => { const r = PL().water(it.id, 'player'); if (r === true) { haptic(); toast('澆好水了', 'leaf'); OC.World.setAction(A().player, 'tend', { dur: 1.4, priority: 4 }); M().skill(A().me(), 'garden', 1); } api.close(); refreshVisuals(true); } } }, icon('sparkle', 's'), PL().wet(st) ? '今天澆過了' : '澆水')));
    });
  }
  /** first discovery feedback (collection) */
  function discovered(ids) { for (const id of ids) setTimeout(() => toast(`圖鑑新增：${I(id).zh}`, 'book'), 300); }

  OC.WorldUI = { travel, arrived, setupVisuals, refreshVisuals, tick, tap, useBy, gardenSheet, discovered, get busy() { return busy; } };
})();
