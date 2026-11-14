/* OC Shimeji — 16.1 the opening: who lives on the island, how they know each other, where they live.
 *
 * After the first character is made (OC.Creator, as before) a new game goes through:
 *   1 島民    make up to six islanders (each one through the normal creator) — one is fine too
 *   2 名冊    age (→ life stage), species (20 + your own), how each one grows up
 *   3 關係    (two or more) a map of everyone: tap a pair → family (parent/child, siblings, grandparent), partners, lovers, an ex,
 *             best friends, friends, classmates, coworkers, neighbours, strangers, rivals, enemies. Directions matter (A is B's parent,
 *             B is A's child). Each one can be locked (it never changes on its own) and given one line of story, which both remember.
 *             Romantic kinds need both to be 18 or older; choosing one switches romance on for the two of them.
 *   4 住處    the three houses: 大家庭宅 (4–6, today's 我的家), 雙層連棟屋 (3–4), 小屋 (2). Who lives where is stored now; the two new
 *             houses can be entered from 16.5 — until then their residents sleep in the big house, and the screen says so.
 * Everything here is written through the same APIs as later play (Mind.setRelType / relPair-style fields, Mind.remember, OC.People).
 */
(function () {
  'use strict';
  const S = () => OC.Store.s, St = OC.Store, M = () => OC.Mind, Ch = () => OC.Chars;
  const { h, icon, toast, sheet } = OC.UI;
  const name = (c) => Ch().name(c);

  // ---------------------------------------------------------------- relationship kinds
  /* id: { zh, ab / ba (what A is to B, what B is to A — same when not directional), type, v (starting values), lock, romance } */
  const REL = {
    stranger: { zh: '陌生人', type: 'stranger', v: {}, lock: false, grp: '其他' },
    neighbor: { zh: '鄰居', type: 'acquaintance', v: { fam: 25, aff: 20, trust: 25 }, lock: false, grp: '朋友' },
    classmate: { zh: '同學', type: 'acquaintance', v: { fam: 35, aff: 25, trust: 25 }, lock: false, grp: '朋友' },
    coworker: { zh: '同事', type: 'acquaintance', v: { fam: 35, aff: 20, trust: 30 }, lock: false, grp: '朋友' },
    friend: { zh: '朋友', type: 'friend', v: { fam: 45, aff: 45, trust: 40 }, lock: false, grp: '朋友' },
    bestfriend: { zh: '好友', type: 'bestfriend', v: { fam: 70, aff: 70, trust: 65, intim: 20 }, lock: false, grp: '朋友' },
    parent: { zh: '父母與孩子', ab: '爸媽', ba: '孩子', type: 'family', v: { fam: 85, aff: 70, trust: 70, intim: 35 }, lock: true, grp: '家人', dir: true },
    sibling: { zh: '兄弟姊妹', ab: '兄弟姊妹', type: 'family', v: { fam: 80, aff: 55, trust: 55, intim: 25, conflict: 10 }, lock: true, grp: '家人' },
    grand: { zh: '祖孫', ab: '祖父母', ba: '孫子女', type: 'family', v: { fam: 70, aff: 70, trust: 65, intim: 25 }, lock: true, grp: '家人', dir: true },
    relative: { zh: '親戚', ab: '親戚', type: 'family', v: { fam: 50, aff: 40, trust: 40 }, lock: true, grp: '家人' },
    spouse: { zh: '伴侶（夫妻）', ab: '伴侶', type: 'partner', v: { fam: 85, aff: 80, trust: 75, intim: 70 }, lock: true, grp: '愛情', romance: true },
    lover: { zh: '戀人', ab: '戀人', type: 'lover', v: { fam: 65, aff: 75, trust: 60, intim: 55 }, lock: true, grp: '愛情', romance: true },
    ex: { zh: '前任', ab: '前任', type: 'acquaintance', v: { fam: 55, aff: 20, trust: 15, conflict: 30 }, lock: false, grp: '愛情', romance: true },
    rival: { zh: '競爭對手', type: 'rival', v: { fam: 40, aff: 15, trust: 20, conflict: 40 }, lock: false, grp: '其他' },
    enemy: { zh: '仇人', ab: '仇人', type: 'rival', v: { fam: 40, aff: 0, trust: 0, conflict: 75 }, lock: false, grp: '其他' },
  };
  const GROUPS = ['家人', '愛情', '朋友', '其他'];
  /** why a kind cannot be chosen for these two (or '') */
  function blocked(kind, a, b) {
    const k = REL[kind]; if (!k || !k.romance) return '';
    for (const c of [a, b]) { const s = OC.People.stage(c); if (!s) return '兩人都要先寫年齡（18 歲以上）'; if (s.from < 18) return `${name(c)}未滿 18 歲`; }
    return '';
  }
  /** set where two characters start from. A is the first, B the second; a directional kind reads "A 是 B 的 ab". */
  function setStart(aId, bId, kind, o = {}) {
    const k = REL[kind], a = Ch().get(aId), b = Ch().get(bId); if (!k || !a || !b || aId === bId) return { ok: false, why: '找不到角色' };
    const why = blocked(kind, a, b); if (why) return { ok: false, why };
    const lock = o.lock != null ? !!o.lock : k.lock;
    for (const [x, y, lab] of [[aId, bId, k.ba || k.ab], [bId, aId, k.ab]]) {
      /* x's view of y: y is "lab" to x (A sees B as 孩子 when A is the parent) */
      const r = M().rel(x, y);
      Object.assign(r, { fam: 0, aff: 0, trust: 10, intim: 0, conflict: 0 }, k.v, { since: OC.Sim.now(), last: OC.Sim.now() });
      r.type = k.type; r.fixed = lock; r.label16 = lab || ''; r.kind16 = kind;
    }
    if (k.romance && kind !== 'ex') { const R = S().life.settings.romance; R.enabled = true; R.adult[aId] = true; R.adult[bId] = true; }
    const story = String(o.story || '').trim().slice(0, 60);
    if (story) for (const [c, other] of [[a, b], [b, a]]) M().remember(c, { type: 'bond', imp: 0.75, who: [other.id], text: story, key: `start:${[aId, bId].sort().join(':')}` });
    St.touch('life', { relSet: aId + '>' + bId }); return { ok: true };
  }
  function clearStart(aId, bId) { for (const [x, y] of [[aId, bId], [bId, aId]]) { const R = S().life.rel; delete R[x + '>' + y]; } St.touch('life'); }

  // ---------------------------------------------------------------- houses
  const HOUSES = {
    coral: { zh: '大家庭宅', d: '珊瑚色屋頂（原本的「我的家」）：多個房間、大餐桌、院子。', min: 4, max: 6, place: 'home', open: true },
    purple: { zh: '雙層連棟屋', d: '紫色屋頂：樓上樓下各自的房間，共用客廳與廚房。', min: 3, max: 4, place: null, open: false },
    yellow: { zh: '小屋', d: '黃色屋頂：一廳一臥，最親密的距離。', min: 2, max: 2, place: null, open: false },
  };
  const homeOf = (c) => (c && c.life && c.life.home16) || null;
  const residents = (hid) => Ch().all().filter((c) => homeOf(c) === hid);
  function assign(c, hid) {
    if (hid && !HOUSES[hid]) return { ok: false, why: '沒有這棟房子' };
    if (hid && homeOf(c) !== hid && residents(hid).length >= HOUSES[hid].max) return { ok: false, why: `${HOUSES[hid].zh}最多住 ${HOUSES[hid].max} 人` };
    c.life.home16 = hid || null; Ch().save(c); return { ok: true };
  }
  const Homes = { HOUSES, of: homeOf, residents, assign };

  // ---------------------------------------------------------------- the screens
  const live = [];
  function portrait(c, size = 64) { const cv = h('canvas', { width: size * 2, height: size * 2 }); cv.style.width = cv.style.height = size + 'px'; OC.CharRender.portrait(cv, c, { pose: { mouth: 'smile' } }); return cv; }

  function run() {
    return new Promise((resolve) => {
      const st = { step: 0 }; OC.Opening.state = st;
      const el = h('div.onb.op16', { role: 'dialog', 'aria-label': '建立你的島民' }), head = h('div.op16-head'), body = h('div.op16-body'), foot = h('div.op16-foot');
      el.append(head, body, foot); document.getElementById('app').append(el);
      const layer = { dismissible: false, close: () => {} }; OC.UI.pushLayer(layer);   /* the back key does nothing here (no loop, no confirm); the steps end it */
      const steps = ['people', 'roster', 'rel', 'home'];
      const titles = { people: ['你的島民', '最多 6 位；一位也可以。'], roster: ['島民名冊', '年齡決定人生階段；物種會改變一些習性。'], rel: ['他們的關係', '點兩個人之間的線，決定他們怎麼認識。'], home: ['住在哪裡', '三棟房子，人數上限不同。'] };
      const draw = () => {
        const id = steps[st.step], list = Ch().all();
        if (id === 'rel' && list.length < 2) { st.step++; draw(); return; }
        st.id = id; el.dataset.step = id;
        head.replaceChildren(h('div.dots', null, ...steps.map((s, i) => h('i' + (i === st.step ? '.on' : '')))), h('h2', null, titles[id][0]), h('p.muted', null, titles[id][1]));
        body.replaceChildren(VIEWS[id](list, draw));
        const last = st.step === steps.length - 1;
        foot.replaceChildren(st.step > 0 ? h('button.btn.ghost', { on: { click: () => { st.step--; if (steps[st.step] === 'rel' && list.length < 2) st.step--; draw(); } } }, icon('back', 's'), '上一步') : h('span'),
          h('button.btn.primary', { 'data-op': 'next', on: { click: () => { if (VIEWS[id].check && !VIEWS[id].check(list)) return; if (last) finish(); else { st.step++; draw(); } } } }, last ? '住進晴日島' : '下一步', icon(last ? 'check' : 'next', 's')));
      };
      const finish = () => { OC.UI.popLayer(layer); el.classList.add('out'); setTimeout(() => el.remove(), 320); St.touch('chars'); resolve(true); };
      const VIEWS = {
        people(list, redraw) {
          const grid = h('div.op16-people', null, ...list.map((c) => h('div.op16-person', null, portrait(c, 72), h('b', null, name(c)))));
          const more = list.length < 6 ? h('button.op16-person.add', { 'data-op': 'add', on: { click: async () => { el.style.visibility = 'hidden'; const c = await OC.Creator.start({ many: true }); el.style.visibility = ''; if (c) toast(`${name(c)}加入了`, 'sparkle'); redraw(); } } }, icon('plus'), h('b', null, '再一位')) : null;
          if (more) grid.append(more);
          return h('div', null, grid, h('p.faint', { style: { fontSize: 'var(--fs-xs)' } }, list.length >= 6 ? '已經 6 位了。之後也能在「角色」頁加入新的島民。' : '每一位都用平常的創角流程建立：可以捏、匯入圖片或用範本。'));
        },
        roster(list) {
          return h('div.op16-roster', null, ...list.map((c) => {
            const ageIn = h('input', { type: 'number', min: 0, max: 999, value: OC.People.ageOf(c) == null ? '' : OC.People.ageOf(c), placeholder: '歲', 'aria-label': `${name(c)}的年齡`, 'data-age': c.id, on: { input: (e) => { c.profile.age = e.target.value === '' ? '' : String(Math.max(0, Math.min(999, +e.target.value))); Ch().save(c); stg.textContent = stageText(c); } } });
            const stg = h('small.op16-stage', null, stageText(c));
            const grow = OC.UI.seg(OC.People.GROW, (c.life.age16 || { grow: 'auto' }).grow, (v) => OC.People.setGrow(c, v));
            return h('div.card.op16-row', { 'data-row': c.id }, h('div.hstack', null, portrait(c, 44), h('b.grow', null, name(c)), h('div.field.op16-age', null, ageIn), stg),
              h('div.op16-sub', null, OC.UI.speciesPicker(c.profile.species || 'human', (v) => { c.profile.species = v; Ch().save(c); })), h('div.op16-sub', null, grow));
          }));
          function stageText(c) { const s = OC.People.stage(c); return s ? s.zh : '未寫年齡'; }
        },
        rel(list) {
          const W = 300, R0 = 105, cx = W / 2, cy = 130, pos = list.map((c, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / list.length; return { c, x: cx + R0 * Math.cos(a), y: cy + R0 * Math.sin(a) }; });
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', `0 0 ${W} 260`); svg.classList.add('op16-lines');
          const map = h('div.op16-map', { style: { width: W + 'px', height: '260px' } }, svg);
          const rows = h('div.op16-pairs');
          const lab = (a, b) => { const r = M().relPeek(a.id, b.id); if (!r || !r.kind16) return '陌生人'; const k = REL[r.kind16]; return k ? (k.dir ? `${name(a)}是${name(b)}的${k.ab}` : k.zh) : '陌生人'; };
          const redraw = () => {
            svg.replaceChildren(); rows.replaceChildren();
            for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
              const A = pos[i], B = pos[j], r = M().relPeek(A.c.id, B.c.id), k = r && r.kind16 ? REL[r.kind16] : null;
              const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.setAttribute('x1', A.x); ln.setAttribute('y1', A.y); ln.setAttribute('x2', B.x); ln.setAttribute('y2', B.y);
              ln.setAttribute('class', 'op16-line ' + (k ? 'g-' + GROUPS.indexOf(k.grp) : 'none')); svg.append(ln);
              rows.append(h('button.op16-pair', { 'data-pair': A.c.id + ':' + B.c.id, on: { click: () => pick(A.c, B.c, redraw) } }, h('span.grow', null, `${name(A.c)} — ${name(B.c)}`), h('span.op16-kind' + (k ? '.set' : ''), null, lab(A.c, B.c)), r && r.fixed ? icon('lock', 's') : null, icon('chev', 's')));
            }
          };
          for (const p of pos) { const n = h('div.op16-node', { style: { left: p.x - 26 + 'px', top: p.y - 26 + 'px' } }, portrait(p.c, 52), h('small', null, name(p.c))); map.append(n); }
          redraw();
          return h('div', null, map, rows);
        },
        home(list) {
          const wrap = h('div');
          if (!list.some((c) => homeOf(c))) { let i = 0; for (const c of list) { c.life.home16 = i < 6 ? 'coral' : 'purple'; i++; } }   /* everyone starts in the big house */
          const draw2 = () => {
            wrap.replaceChildren(...Object.entries(HOUSES).map(([hid, H]) => {
              const who = residents(hid);
              return h('div.card.op16-house' + (who.length > H.max ? '.over' : ''), { 'data-house': hid }, h('div.hstack', null, OC.UI.sticker('home', 'm'), h('div.grow', null, h('b', null, H.zh), h('small.muted', { style: { display: 'block' } }, `${H.min === H.max ? H.max : H.min + '–' + H.max} 人・現在 ${who.length} 人`))),
                h('p.muted', { style: { fontSize: 'var(--fs-s)', margin: '6px 0' } }, H.d), H.open ? null : h('p.faint', { style: { fontSize: 'var(--fs-xs)', margin: '0 0 6px' } }, '室內在之後的版本（16.5）開放；在那之前，住這裡的角色晚上會先在大家庭宅過夜。'),
                h('div.op16-residents', null, ...list.map((c) => h('button.chip-btn' + (homeOf(c) === hid ? '.on' : ''), { 'data-move': c.id + ':' + hid, on: { click: () => { const r = assign(c, hid); if (!r.ok) toast(r.why, 'info'); draw2(); } } }, name(c)))));
            }));
          };
          draw2(); return wrap;
        },
      };
      VIEWS.roster.check = () => true;
      draw();
    });
  }
  /** the sheet for one pair */
  function pick(a, b, done) {
    sheet(`${name(a)} 和 ${name(b)}`, (body, api) => {
      const r0 = M().relPeek(a.id, b.id), st = { kind: (r0 && r0.kind16) || 'stranger', lock: r0 ? !!r0.fixed : false, story: '', first: a, second: b };
      const draw = () => {
        const k = REL[st.kind];
        body.replaceChildren(...GROUPS.map((g) => h('div', { style: { marginTop: '8px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, g),
          h('div.species-pick', null, ...Object.entries(REL).filter(([, x]) => x.grp === g).map(([id, x]) => { const why = blocked(id, a, b); return h('button.chip-btn' + (st.kind === id ? '.on' : ''), { 'data-kind': id, disabled: !!why, title: why || null, on: { click: () => { if (why) { toast(why, 'info'); return; } st.kind = id; st.lock = x.lock; draw(); } } }, x.zh); })))),
          k.dir ? h('div', { style: { marginTop: '10px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '誰是誰'), OC.UI.seg([['ab', `${name(a)}是${k.ab}`], ['ba', `${name(b)}是${k.ab}`]], st.first === a ? 'ab' : 'ba', (v) => { st.first = v === 'ab' ? a : b; st.second = v === 'ab' ? b : a; })) : null,
          k.romance && st.kind !== 'ex' ? h('p.faint', { style: { fontSize: 'var(--fs-xs)' } }, '選這個會為他們兩位打開戀愛功能（兩人都已滿 18 歲）。') : null,
          st.kind !== 'stranger' ? h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '鎖定（不會自己改變）'), OC.UI.toggle(st.lock, (v) => { st.lock = v; })) : null,
          st.kind !== 'stranger' ? h('div.field', { style: { marginTop: '10px' } }, h('input', { maxLength: 60, placeholder: '一句背景故事（例如：小時候住在隔壁）', 'aria-label': '背景故事', value: st.story, on: { input: (e) => { st.story = e.target.value; } } })) : null,
          h('button.btn.primary.block', { 'data-op': 'relok', style: { marginTop: '12px' }, on: { click: () => { if (st.kind === 'stranger') clearStart(a.id, b.id); else { const r = setStart(st.first.id, st.second.id, st.kind, { lock: st.lock, story: st.story }); if (!r.ok) { toast(r.why, 'info'); return; } } api.close(); done(); } } }, '決定'));
      };
      draw();
    });
  }

  OC.Opening = { run, REL, GROUPS, blocked, setStart, clearStart, state: null };
  OC.Homes = Homes;
})();
