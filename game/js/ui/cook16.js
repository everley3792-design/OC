/* OC Shimeji 16.5 — the kitchen (OC.Kitchen): 食譜 · 自由料理 · 冰箱, one sheet at the stove (an advanced tool, so a sheet is fine).
 *   食譜     all 80 recipes by way of cooking; what you have ✓ / lack ✗ for each; unknown ones show a hint; locked by cooking level
 *   自由料理  tap ingredients from the bag (up to 4) and a way of cooking → what it would make (a new recipe is discovered)
 *   冰箱     a view of the food in the one inventory (not a second storage); 「端上桌」 puts servings on a table here
 * 「自動做」 skips the minigame (quality from the cooking level only: up to ★★, ★★★ from level 6). Data only via OC.Food16 / OC.Tx.
 */
(function () {
  'use strict';
  const h = (...a) => OC.UI.h(...a), toast = (...a) => OC.UI.toast(...a), icon = (...a) => OC.UI.icon(...a), haptic = (k) => OC.UI.haptic && OC.UI.haptic(k || 'tick');
  const F = () => OC.Food16, I = (id) => OC.Style.ITEMS[id], S = () => OC.Store.s;
  const me = () => OC.Chars.active();
  const needZh = (k, n) => `${k.startsWith('cat:') ? '任何' + F().CAT_ZH[k.slice(4)] : (I(k) || { zh: k }).zh}${n > 1 ? '×' + n : ''}`;
  const haveFor = (k, n) => (k.startsWith('cat:') ? Object.keys(S().inv).filter((id) => F().catOf(id) === k.slice(4)).reduce((s, id) => s + OC.Store.count(id), 0) : OC.Store.count(k)) >= n;
  const img = (id, px = 40) => { const im = OC.Style.itemImg(id); im.style.width = im.style.height = px + 'px'; return im; };

  function open(spot) {
    const c = me(); if (!c) return;
    const st = { tab: 'book', m: 'all', pick: {}, method: 'boil' };
    OC.UI.sheet('廚房', (b, api) => {
      const lv = OC.Mind.skillLv(c, 'cook');
      const draw = () => {
        const auto = !!S().settings.autoCook;
        const tabs = OC.UI.seg([['book', '食譜'], ['free', '自由料理'], ['fridge', '冰箱']], st.tab, (v) => { st.tab = v; draw(); });
        const head = h('div.k16-head', null, h('small.muted', null, `${OC.Chars.name(c)}・料理 Lv.${lv}`), h('label.hstack', { style: { gap: '6px', marginLeft: 'auto' } }, h('small', null, '自動做'), OC.UI.toggle(auto, (v) => { S().settings.autoCook = v; OC.Store.touch('settings'); })));
        b.replaceChildren(tabs, head, st.tab === 'book' ? bookTab() : st.tab === 'free' ? freeTab() : fridgeTab());
        if (OC.Pick) OC.Pick.guard(b, 200);
      };
      const ME = [['all', '全部']].concat(Object.entries(F().METHODS).map(([k, v]) => [k, v[0]]));
      function bookTab() {
        const rows = h('div.list');
        for (const r of F().RECIPES.filter((x) => st.m === 'all' || x.method === st.m)) {
          const state = F().state(r.id), locked = r.lv > lv, bk = F().book()[r.id] || {};
          const need = Object.entries(r.need).map(([k, n]) => h('span.k16-need' + (haveFor(k, n) ? '.ok' : '.no'), null, (haveFor(k, n) ? '✓' : '✗') + needZh(k, n)));
          const ing = !locked && state !== 'unknown' ? F().pick(r) : null;
          if (state === 'unknown') { rows.append(OC.UI.row(h('span.k16-q', null, '？'), '？？？', `${F().METHODS[r.method][0]}・用到${needZh(Object.keys(r.need)[0], 1)}…（自由料理時發現${r.lv > lv ? '・料理 Lv.' + r.lv + ' 起' : ''}）`, null)); continue; }
          rows.append(OC.UI.row(img(r.id), `${r.zh}${bk.best ? ' ' + '★'.repeat(bk.best) : ''}`, h('span.k16-needs', null, h('small', null, `${F().METHODS[r.method][0]}・${r.serv} 份　`), ...need),
            locked ? h('span.tag', null, icon('lock', 's'), `Lv.${r.lv}`) : ing ? h('button.btn.s.primary', { 'data-cook': r.id, on: { click: () => { api.close(); start(c, { recipe: r.id }); } } }, '做') : h('span.tag', null, '材料不足')));
        }
        return h('div', null, h('div.k16-methods', null, ...ME.map(([k, zh]) => h('button.chip-btn' + (st.m === k ? '.on' : ''), { on: { click: () => { st.m = k; draw(); } } }, zh))), rows);
      }
      function freeTab() {
        const have = Object.keys(S().inv).filter((id) => F().isIngredient(id) && OC.Store.count(id) > 0);
        const total = Object.values(st.pick).reduce((a, b2) => a + b2, 0);
        const chips = have.map((id) => { const used = st.pick[id] || 0, left = OC.Store.count(id) - used; return h('button.k16-ing' + (used ? '.on' : ''), { 'data-ing': id, disabled: left <= 0 || total >= 4, on: { click: () => { st.pick[id] = used + 1; haptic(); draw(); } } }, img(id, 28), h('small', null, `${I(id).zh}${used ? ' ×' + used : ''}`)); });
        const tray = Object.entries(st.pick).map(([id, n]) => h('button.chip-btn.on', { on: { click: () => { if (--st.pick[id] <= 0) delete st.pick[id]; draw(); } } }, `${I(id).zh}×${n} ✕`));
        const pv = total ? F().preview(st.pick, st.method) : null;
        const known = pv && pv.recipe && F().state(pv.recipe.id) !== 'unknown';
        const say = !pv ? '先選材料（最多 4 個）' : pv.recipe ? (known ? `會做出：${pv.recipe.zh}` : '會做出……？？？（新的料理！）') : pv.out === 'weird_dish' ? '這個組合……結果很難說' : `沒有這個食譜：會是一道「${I(pv.out).zh}」`;
        return h('div', null,
          h('div.k16-methods', null, ...Object.entries(F().METHODS).map(([k, v]) => h('button.chip-btn' + (st.method === k ? '.on' : ''), { 'data-method': k, on: { click: () => { st.method = k; draw(); } } }, v[0]))),
          h('div.k16-tray', null, tray.length ? tray : h('small.muted', null, '點下面的材料放進鍋裡')),
          h('div.k16-say', null, say),
          h('button.btn.primary.block', { 'data-act': 'free-cook', disabled: !total, on: { click: () => { const pick = Object.assign({}, st.pick); api.close(); start(c, { free: pick, method: st.method }); } } }, '下鍋'),
          h('div.k16-ings', null, ...(chips.length ? chips : [h('small.muted', null, '背包裡沒有食材（食品店、市場、菜園、採集、釣魚）')])));
      }
      function fridgeTab() {
        const ids = Object.keys(S().inv).filter((id) => OC.Store.count(id) > 0 && I(id) && (['food', 'drink'].includes(I(id).kind) || F().isIngredient(id)));
        const dish = (id) => !F().isIngredient(id) || (I(id).method16);
        return h('div', null, h('p.faint', { style: { fontSize: 'var(--fs-xs)', margin: '4px 0 8px' } }, '冰箱就是背包裡的食物（同一份，不是另外存）。'),
          ids.length ? h('div.k16-fridge', null, ...ids.map((id) => h('div.k16-fi', null, img(id, 34), h('small', null, `${I(id).zh}×${OC.Store.count(id)}`),
            dish(id) && F().meals ? h('button.btn.s', { 'data-serve': id, on: { click: () => { const r = F().serve(id, Math.min(4, OC.Store.count(id)), spot && spot.at ? spot.at : null, c.id); toast(r.ok ? `端上桌：${I(id).zh}×${r.meal.n}（大家餓了會來吃）` : r.why, r.ok ? 'apple' : 'info'); draw(); } } }, '端上桌') : null))) : h('div.empty', null, '冰箱是空的'));
      }
      draw();
    });
  }

  /** cook one: the minigame (or 自動), then OC.Food16.cook does the transaction */
  function start(c, o) {
    let recipe = o.recipe ? F().BY[o.recipe] : null, ingr = null, out = null, free = false;
    if (o.free) { const pv = F().preview(o.free, o.method); free = true; ingr = o.free; if (pv.recipe) recipe = pv.recipe; else out = pv.out; }
    else ingr = recipe && F().pick(recipe);
    if (!ingr) { toast('材料不夠', 'info'); return; }
    const done = (score) => {
      const r = F().cook(c, { recipe: recipe && recipe.id, out, ingr, score, free, by: OC.Chars.name(c) + ' ' });
      if (!r.ok) { toast(r.why, 'info'); if (r.burnt) OC.Mind.feel(c, 'confused', 0.3, '料理失敗'); return; }
      OC.Mind.skill(c, 'cook', 2 + r.q * 2); OC.Mind.feel(c, r.q === 3 ? 'proud' : 'happy', 0.3 + r.q * 0.1, '做了' + I(r.base).zh);
      OC.Mind.remember(c, { type: 'event', imp: r.discovered ? 0.6 : 0.35, text: `${r.discovered ? '第一次做出' : '做了'}${I(r.base).zh}（${'★'.repeat(r.q)}）`, key: 'cook16:' + r.out + ':' + OC.Sim.day() + ':' + c.id });
      const P = OC.App.player; if (P) OC.World.setAction(P, 'happy', { dur: 1.4, priority: 6 }); OC.Sound && OC.Sound.play(r.discovered ? 'fanfare' : 'chime'); haptic('confirm');
      if (r.firsts && r.firsts.length && OC.WorldUI.discovered) OC.WorldUI.discovered(r.firsts);
      OC.Radial.undoToast(`${r.discovered ? '發現新食譜！' : ''}完成 ${I(r.out).zh}×${r.n}`, () => { const s = F().serve(r.out, r.n, null, c.id); toast(s.ok ? '端上桌了，大家餓了會來吃' : s.why, s.ok ? 'apple' : 'info'); }, 6000, '端上桌');
      OC.Store.emit('food16:cooked', r);
    };
    if (S().settings.autoCook) { done(null); return; }
    const zh = recipe ? recipe.zh : I(out).zh;
    OC.Mini.cookGame({ out: recipe ? recipe.id : out, zh, onScore: (sc) => done(sc) }, null);
  }

  OC.Kitchen = { open, start };
})();
