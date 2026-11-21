/* OC Shimeji 17.3 — the affection page (頁面 bond17) and the three layers of a relationship (OC.Bond17UI).
 *   page    pick a character: everyone else with 好感 (both ways), 心動 (only where romance is allowed), the name of the relationship,
 *           單戀／曖昧, identity and tags, what is about to change (the daily settlement needs two days), and the latest changes.
 *   layers  身分, 相處標籤 (≤ 3), 合拍度, 可以發展戀情, 固定 — set from this page or from the character's 關係 tab; every one of them
 *           has a small real effect (OC.Bond17). Nothing here writes numbers directly.
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = () => OC.Store, Ch = () => OC.Chars, M = () => OC.Mind, Bd = () => OC.Bond17, Sim = () => OC.Sim;
  const h = (...a) => OC.UI.h(...a), name = (c) => Ch().name(c), haptic = (k) => OC.UI.haptic && OC.UI.haptic(k);
  const dayTxt = (d) => (OC.Clock.cal ? OC.Clock.cal(d).text : `第 ${d} 天`);
  const FIT = [['-2', '很不合'], ['-1', '不太合'], ['0', '普通'], ['1', '合拍'], ['2', '非常合拍']];
  const minor = (c) => !!(OC.People && OC.People.minor && OC.People.minor(c));

  /** the layers of a and b, editable in place (used by the page and by the 關係 tab's 設定 sheet) */
  function layerBox(a, b, refresh) {
    const box = h('div.b17-lay');
    const draw = () => {
      const L = Bd().layerOf(a.id, b.id), r = M().rel(a.id, b.id), q = M().rel(b.id, a.id);
      const chip = (on, label, fn, attrs = {}) => h('button.chip-btn' + (on ? '.on' : ''), Object.assign({ 'aria-pressed': on ? 'true' : 'false', on: { click: () => { haptic('tick'); fn(); draw(); refresh && refresh(); } } }, attrs), label);
      const ids = [chip(!L.id, '沒有', () => Bd().setLayer(a.id, b.id, { id: null }), { 'data-b17id': '' })].concat(Object.entries(Bd().IDS).map(([k, zh]) => chip(L.id === k, zh, () => Bd().setLayer(a.id, b.id, { id: L.id === k ? null : k }), { 'data-b17id': k })));
      const tags = Object.entries(Bd().TAGS).map(([k, T]) => { const onT = L.tags.includes(k), full = !onT && L.tags.length >= Bd().MAX_TAGS; return chip(onT, T.zh, () => { if (full) { OC.UI.toast(`最多 ${Bd().MAX_TAGS} 個相處標籤`, 'info'); return; } Bd().setLayer(a.id, b.id, { tags: onT ? L.tags.filter((x) => x !== k) : L.tags.concat(k) }); }, { 'data-b17tag': k, disabled: full ? true : null }); });
      const fit = OC.UI.seg(FIT, String(L.fit || 0), (v) => { Bd().setLayer(a.id, b.id, { fit: +v }); draw(); refresh && refresh(); });
      const R = S().life.settings.romance, young = minor(a) || minor(b);
      const love = young ? h('span.tag', null, '未滿 18 歲，不涉及戀愛') : !R.enabled ? h('span.tag', null, '戀愛功能關閉中（生活設定 › 戀愛）') : OC.UI.toggle(L.romance, (v) => { Bd().setLayer(a.id, b.id, { romance: v }); draw(); refresh && refresh(); });
      const fixedT = OC.UI.toggle(!!(r.fixed && q.fixed), (v) => { for (const x of [r, q]) x.fixed = !!v; St().touch('life', { relFix: a.id }); draw(); refresh && refresh(); });
      const notes = L.tags.map((k) => Bd().TAGS[k]).filter(Boolean).map((T) => `${T.zh}：${T.d}`);
      box.replaceChildren(
        h('div.b17-sec', null, h('b', null, '身分'), h('div.chips.b17-chips', null, ...ids)),
        h('div.b17-sec', null, h('b', null, '相處標籤'), h('small.muted', null, ` 最多 ${Bd().MAX_TAGS} 個`), h('div.chips.b17-chips', null, ...tags), notes.length ? h('div.muted.b17-note', null, notes.join('；')) : null),
        h('div.b17-sec', null, h('b', null, '合拍度'), h('div', { style: { marginTop: '6px' } }, fit), h('div.muted.b17-note', null, '合拍的兩個人，好感與心動漲得比較快；不合的比較慢。')),
        h('div.b17-row', null, h('span.grow', null, '可以發展戀情'), love),
        h('div.b17-row', null, h('span.grow', null, '固定這段關係（不會自動改變）'), fixedT),
        h('div.muted.b17-note', null, '這些設定兩個方向都套用。關係的名稱（朋友、家人…）在角色檔案的「關係」裡設定。'));
    };
    draw(); return box;
  }
  function layerSheet(a, b, after) {
    OC.UI.sheet(`${name(a)} 和 ${name(b)}`, (body) => { body.append(layerBox(a, b, after)); });
  }

  /* ---------------- the page ---------------- */
  const bar = (v, cls) => h('i.b17-bar' + (cls ? '.' + cls : ''), { style: { '--v': Math.max(0, Math.min(100, v || 0)) + '%' } });
  function soon(r) {
    const hh = r && r.b17; if (!hh || !hh.n || hh.want === r.type) return null;
    return `再一天沒變，就會成為「${M().TYPES[hh.want] || hh.want}」`;
  }
  OC.Pages && OC.Pages.define('bond17', '好感度', {
    sub: true,
    build(p, el) { p.who = h('div.chips.b17-who', { role: 'tablist' }); p.list = h('div.vstack.b17-list'); p.log = h('div.b17-log'); el.append(p.who, p.list, h('h3.b17-h', null, '最近的變化'), p.log); },
    refresh(p) {
      const arg = p.params; p.params = null; const all = Ch().all(); if (!all.length) return;
      if (arg && arg.id && Ch().get(arg.id)) p.id = arg.id; if (!p.id || !Ch().get(p.id)) p.id = S().activeId || all[0].id;
      const c = Ch().get(p.id), others = all.filter((o) => o.id !== c.id), ch = Bd().changesOf(c.id, 15);
      const sig = JSON.stringify([p.id, all.map((x) => x.id), others.map((o) => { const r = M().relPeek(c.id, o.id), q = M().relPeek(o.id, c.id); return [r && [r.type, Math.round(r.aff), Math.round(r.intim), r.b17, r.lv17 && r.lv17.st, r.lay17, r.fixed], q && [Math.round(q.aff), Math.round(q.intim)]]; }), ch.length, ch[0], S().life.settings.romance]);
      if (p._sig === sig) return; p._sig = sig;
      p.who.replaceChildren(...all.map((x) => h('button.chip-btn' + (x.id === c.id ? '.on' : ''), { role: 'tab', 'data-b17who': x.id, 'aria-selected': x.id === c.id ? 'true' : 'false', on: { click: () => { haptic('tick'); p.id = x.id; p._sig = ''; OC.Pages.pages.bond17.refresh(p); } } }, name(x))));
      p.list.replaceChildren(...(others.length ? others.map((o) => {
        const r = M().relPeek(c.id, o.id), q = M().relPeek(o.id, c.id), L = Bd().layerOf(c.id, o.id), love = OC.UI && M().romanceOK(c.id, o.id), lv = Bd().loveState(c.id, o.id), s = soon(r);
        return h('div.card.b17-card', { 'data-b17oc': o.id },
          h('div.hstack', null, h('b.grow', null, name(o)), h('span.tag' + (r && r.fixed ? '.accent' : '.teal'), null, r ? M().relLabel(r) : '陌生'), lv ? h('span.tag.b17-love', null, Bd().LOVE_ZH[lv]) : null,
            h('button.btn.ghost.s', { 'data-b17set': o.id, on: { click: () => layerSheet(c, o, () => { p._sig = ''; OC.Pages.pages.bond17.refresh(p); }) } }, '設定')),
          h('div.b17-m', null, h('span', null, '好感'), bar(r ? r.aff : 0), h('small.num', null, String(Math.round(r ? r.aff : 0))), h('small.muted', null, `對方 ${Math.round(q ? q.aff : 0)}`)),
          love ? h('div.b17-m', null, h('span', null, '心動'), bar(r ? r.intim : 0, 'love'), h('small.num', null, String(Math.round(r ? r.intim : 0))), h('small.muted', null, `對方 ${Math.round(q ? q.intim : 0)}`)) : null,
          (L.id || L.tags.length || L.fit) ? h('div.b17-tags', null, L.id ? h('span.tag', null, Bd().IDS[L.id]) : null, ...L.tags.map((k) => h('span.tag', null, Bd().TAGS[k].zh)), L.fit ? h('span.tag', null, FIT.find((x) => +x[0] === L.fit)[1]) : null) : null,
          s ? h('small.muted', null, s) : null);
      }) : [h('div.empty', null, '島上只有一個人。')]));
      p.log.replaceChildren(...(ch.length ? ch.map((x) => { const other = Ch().get(x.a === c.id ? x.b : x.a); return h('div.b17-li', null, h('small.num.muted', null, dayTxt(x.day)), h('span', null, `${x.a === c.id ? '對' : ''}${other ? name(other) : '某人'}${x.a === c.id ? '' : '對牠'}：${x.kind === 'anniv' ? x.to : `${x.from || '—'} → ${x.to || '—'}`}`), x.away ? h('small.muted', null, '（你不在的時候）') : null); }) : [h('div.empty', null, '還沒有變化。關係每天結算一次，數字連續兩天都這樣說才會改變。')]));
    },
  });

  OC.Bond17UI = { layerBox, layerSheet };
})();
