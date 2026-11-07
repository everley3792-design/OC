/* OC Shimeji — pages. Each page is built once (structure) and refreshed in place when its
 * data changes. Rule: the profile is for VIEWING, the editor / wardrobe are for EDITING;
 * every page has at most one primary button; features that are not implemented are shown
 * as clearly locked (未開放) instead of fake buttons.
 */
(function () {
  'use strict';
  const { h, icon, toast, sheet, confirm, seg, toggle, row, lockedRow, swatches, haptic } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, Gm = OC.Game, Sty = OC.Style;
  const pages = {};
  const app = () => OC.App;

  function head(title, sub, right) {
    return h('div.page-head', null, h('div.head-bg'), sub ? h('button.icon-btn', { 'aria-label': '返回', on: { click: () => OC.UI.back() } }, icon('back')) : null, h('h1', null, title), right || null);
  }
  function define(id, title, o) { pages[id] = Object.assign({ id, title, sub: !!o.sub, el: null }, o); }
  function ensure(p) {
    if (p.el) return p;
    p.el = h('section.page' + (p.sub ? '.sub' : ''), { 'data-page': p.id, 'aria-label': p.title });
    p.el.append(head(p.title, p.sub, p.headRight && p.headRight(p)));
    p.inner = h('div.page-inner'); p.el.append(p.inner);
    document.getElementById('pages').append(p.el);
    p.build && p.build(p, p.inner);
    return p;
  }
  function open(id, params) {
    const p = ensure(pages[id]); p.params = params || {};
    if (p.sub) {
      if (p.layer) OC.UI.popLayer(p.layer);
      p.layer = { scrim: false, close: () => close(id) }; OC.UI.pushLayer(p.layer);
      p.el.scrollTop = 0;
    }
    p.refresh && p.refresh(p, p.inner);
    requestAnimationFrame(() => p.el.classList.add('open'));
    p.onShow && p.onShow(p);
    return p;
  }
  function close(id) { const p = pages[id]; if (!p || !p.el) return; p.el.classList.remove('open'); if (p.layer) { OC.UI.popLayer(p.layer); p.layer = null; } p.onHide && p.onHide(p); }
  function refreshOpen() { for (const p of Object.values(pages)) if (p.el && p.el.classList.contains('open') && p.refresh) p.refresh(p, p.inner); }

  const card = (...k) => h('div.card', null, ...k);
  const title = (t, small) => h('div.section-title', null, t, small ? h('small', null, small) : null);
  const bar = (v, c) => h('div.bar', null, h('i', { style: { width: Math.round(v) + '%', '--c': c } }));
  const hearts = (fr) => { const l = Gm.friendLevel(fr), el = h('span.hstack', { style: { gap: '2px', color: 'var(--heart)' } }); for (let i = 1; i < Gm.LEVELS.length; i++) el.append(icon(i <= l ? 'heart' : 'heart', 's' + (i <= l ? ' fill' : ''))); el.querySelectorAll('svg').forEach((s, i) => { if (i + 1 <= l) { s.style.fill = 'currentColor'; } else s.style.opacity = 0.35; }); return el; };
  const portraitCanvas = (px = 240) => { const c = h('canvas'); c.width = px; c.height = px; return c; };

  // =====================================================================
  // 角色 (profile — view only)
  // =====================================================================
  define('char', '角色', {
    build(p, el) {
      p.cv = portraitCanvas(300);
      p.name = h('h2'); p.moodL = h('div.muted'); p.traits = h('div.hstack', { style: { flexWrap: 'wrap', gap: '6px', marginTop: '8px' } });
      el.append(card(h('div.hero', null, h('div.portrait', null, p.cv), h('div', null, p.name, p.moodL, p.traits))),
        h('div.hstack', { style: { marginTop: '12px' } }, h('button.btn.primary.block', { on: { click: () => open('editor') } }, icon('edit', 's'), '編輯角色'), h('button.btn.block', { on: { click: () => open('wardrobe') } }, icon('shirt', 's'), '衣櫥')));
      p.needs = h('div.vstack'); el.append(title('需求', '點擊查看如何恢復'), h('div.card', { role: 'button', on: { click: () => open('needs') } }, p.needs));
      p.rel = h('div.list'); el.append(title('人際關係'), p.rel);
      p.goal = h('div'); el.append(title('人生目標'), p.goal);
      p.bio = h('div.card'); el.append(title('關於我'), p.bio);
      app().live(p.cv, () => ({ oc: S().oc, sprite: app().mySprite(), state: Object.assign({ face: 0.15 }, Gm.moodFace()) }));
    },
    refresh(p) {
      const oc = S().oc, mf = Gm.moodFace();
      p.name.textContent = oc.name; p.moodL.textContent = mf.label + (S().appearance.mode === 'sprite' ? '・使用自製外觀' : '');
      p.traits.replaceChildren(...oc.traits.map((t) => h('span.tag.teal', null, (Sty.TRAITS.find((x) => x.id === t) || {}).zh || t)));
      p.needs.replaceChildren(...Gm.NEEDS.map((n) => h('div.need', null, h('div.dot', { style: { '--c': n.c } }, icon(n.ic, 's')), h('span', null, n.zh), bar(S().needs[n.id], n.c), h('span.val.num', null, Math.round(S().needs[n.id])))));
      p.rel.replaceChildren(...Object.values(Gm.NPCS).map((d) => { const n = Gm.npc(d.id); return row(npcAvatar(d.id), d.zh, n.met ? Gm.LEVEL_ZH[Gm.friendLevel(n.fr)] : '還沒見過面', h('div.hstack', null, hearts(n.fr), icon('chev', 'chev')), () => open('npc', { id: d.id })); }));
      const g = Gm.GOALS.find((x) => x.id === S().goal);
      p.goal.replaceChildren(g ? h('div.card', { role: 'button', on: { click: () => open('goals') } }, h('div.hstack', null, icon(g.ic), h('div.grow', null, h('b', null, g.zh), h('div.sub.muted', null, g.d)), h('span.num', null, `${Math.min(g.v(), g.n)}/${g.n}`)), h('div', { style: { marginTop: '10px' } }, bar(100 * Math.min(1, g.v() / g.n), 'var(--teal)'))) : h('div.list', null, row('flag', '還沒有人生目標', '選一個長期目標吧', null, () => open('goals'))));
      p.bio.replaceChildren(h('div', null, oc.bio || h('span.muted', null, '（在「編輯角色 → 名字與個性」寫一段自我介紹）')), oc.birthday ? h('div.muted', { style: { marginTop: '6px' } }, '生日 ', oc.birthday) : null);
    },
  });
  const _npcAv = {};
  function npcAvatar(id) { const c = portraitCanvas(96); c.className = 'avatar'; c.style.width = c.style.height = '40px'; Sty.portrait(c, Sty.PRESETS[Gm.NPCS[id].preset], { scale: 1.5, feet: 1.05, state: { mouth: 'smile' } }); return c; }

  // =====================================================================
  // 編輯角色 (editor — edits a draft; nothing changes until 儲存)
  // =====================================================================
  define('editor', '編輯角色', {
    sub: true,
    build(p, el) {
      p.cv = portraitCanvas(320);
      el.append(h('div.portrait', { style: { height: '200px' } }, p.cv));
      p.tabs = seg([['body', '外觀'], ['color', '顏色'], ['me', '名字與個性'], ['src', '外觀來源']], 'body', (v) => { p.tab = v; renderTab(p); });
      p.body = h('div', { style: { marginTop: '14px' } });
      p.save = h('button.btn.primary.block', { style: { marginTop: '18px' }, on: { click: () => saveDraft(p) } }, icon('check', 's'), '儲存');
      el.append(h('div', { style: { marginTop: '12px' } }, p.tabs), p.body, p.save);
      app().live(p.cv, () => ({ oc: p.draft || S().oc, sprite: p.draftApp && p.draftApp.mode === 'sprite' ? app().spriteOf(p.draftApp.animId) : null, state: { face: Math.sin(performance.now() / 1600) * 0.3, mouth: 'smile' } }));
    },
    refresh(p) { p.draft = JSON.parse(JSON.stringify(S().oc)); p.draftApp = JSON.parse(JSON.stringify(S().appearance)); p.tab = p.tab || 'body'; p.tabs.set(p.tab); renderTab(p); },
  });
  function tiles(list, value, onPick, draw) {
    const g = h('div.grid.c3');
    list.forEach(([v, label]) => { const t = h('button.tile', { 'data-v': v, 'aria-pressed': v === value, on: { click: () => { haptic(); [...g.children].forEach((b) => { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-pressed', b.dataset.v === v); }); onPick(v); } } }, draw ? draw(v) : null, label); t.classList.toggle('on', v === value); g.append(t); });
    return g;
  }
  function miniOC(oc) { const c = portraitCanvas(120); Sty.portrait(c, oc, { scale: 1.1, state: { mouth: 'smile' } }); return c; }
  function renderTab(p) {
    const d = p.draft, b = p.body; b.replaceChildren();
    if (p.tab === 'body') {
      b.append(title('從範本開始'), tiles(Object.entries(Sty.PRESETS).map(([k, v]) => [k, v.name]), null, (k) => { const keep = { name: d.name, traits: d.traits, bio: d.bio, birthday: d.birthday, id: d.id }; Object.assign(d, JSON.parse(JSON.stringify(Sty.PRESETS[k])), keep); renderTab(p); }, (k) => miniOC(Sty.PRESETS[k])));
      b.append(title('耳朵'), tiles(Sty.EARS, d.ears, (v) => (d.ears = v), (v) => miniOC(Object.assign({}, d, { ears: v }))));
      b.append(title('尾巴'), tiles(Sty.TAILS, d.tail, (v) => (d.tail = v)));
    } else if (p.tab === 'color') {
      b.append(title('毛色'), swatches(Sty.FURS, d.fur, (c) => (d.fur = c)), title('眼睛'), swatches(Sty.EYES, d.eye, (c) => (d.eye = c)), title('腮紅'), swatches(Sty.CHEEKS, d.cheek, (c) => (d.cheek = c)), title('耳朵內側'), swatches(['#FFB8B0', '#FFD0B0', '#FFC4DD', '#F7E3A8', '#D9F5F0'], d.inner, (c) => (d.inner = c)));
    } else if (p.tab === 'me') {
      const name = h('input', { value: d.name, maxLength: 10, 'aria-label': '名字', on: { input: (e) => (d.name = e.target.value) } });
      const bio = h('input', { value: d.bio || '', maxLength: 40, placeholder: '一句話介紹自己', 'aria-label': '自我介紹', on: { input: (e) => (d.bio = e.target.value) } });
      const month = h('select', { 'aria-label': '月', on: { change: () => (d.birthday = month.value && day.value ? `${month.value}/${day.value}` : '') } }, h('option', { value: '' }, '月'), ...Array.from({ length: 12 }, (_, i) => h('option', { value: i + 1 }, `${i + 1} 月`)));
      const day = h('select', { 'aria-label': '日', on: { change: () => (d.birthday = month.value && day.value ? `${month.value}/${day.value}` : '') } }, h('option', { value: '' }, '日'), ...Array.from({ length: 31 }, (_, i) => h('option', { value: i + 1 }, `${i + 1} 日`)));
      if (d.birthday) { const [m, dd] = d.birthday.split('/'); month.value = m; day.value = dd; }
      [month, day].forEach((s) => (s.className = 'field')); [month, day].forEach((s) => (s.style.flex = 1));
      const tr = h('div.grid.c2');
      const syncTr = () => [...tr.children].forEach((c) => c.classList.toggle('on', d.traits.includes(c.dataset.v)));
      Sty.TRAITS.forEach((t) => tr.append(h('button.tile', { 'data-v': t.id, style: { aspectRatio: 'auto', minHeight: '64px', padding: '8px' }, on: { click: () => { haptic(); if (d.traits.includes(t.id)) d.traits = d.traits.filter((x) => x !== t.id); else if (d.traits.length < 3) d.traits.push(t.id); else toast('最多選 3 個個性', 'info'); syncTr(); } } }, h('b', { style: { color: 'var(--ink)', fontSize: 'var(--fs-m)' } }, t.zh), t.d)));
      syncTr();
      b.append(title('名字'), h('div.field', null, name), title('自我介紹'), h('div.field', null, bio), title('生日'), h('div.hstack', null, month, day), title('個性', '最多 3 個，會影響需求與互動'), tr);
    } else {
      const A = p.draftApp;
      const list = h('div.vstack');
      const opts = [['rig', '角色骨架', '可在衣櫥換裝，支援四方向轉身']].concat(S().anims.map((a) => [a.id, a.name, `${a.frames.length} 格・${a.frames.length > 1 ? '逐格動畫' : '單張圖片'}（單向素材：以左右翻轉與彈跳呈現）`]));
      const rowsEl = opts.map(([id, nm, sub]) => { const on = (id === 'rig' && A.mode === 'rig') || (A.mode === 'sprite' && A.animId === id); const r = row(id === 'rig' ? 'person' : 'film', nm, sub, on ? icon('check') : null, () => { if (id === 'rig') { A.mode = 'rig'; A.animId = null; } else { A.mode = 'sprite'; A.animId = id; } renderTab(p); }); return r; });
      list.append(h('div.list', null, ...rowsEl));
      b.append(title('角色外觀來源'), list, h('p.muted', { style: { fontSize: 'var(--fs-s)' } }, '想用自己畫的圖或照片？到「工坊」用逐格動畫工作室繪製，或匯入圖片，完成後會出現在這裡。'), h('button.btn.block', { on: { click: () => { close('editor'); app().tab('workshop'); } } }, icon('brush', 's'), '前往工坊'));
    }
  }
  function saveDraft(p) {
    const d = p.draft; d.name = (d.name || '').trim() || '無名氏';
    S().oc = d; S().appearance = p.draftApp; St.touch('oc'); toast('已儲存角色', 'check'); close('editor');
  }

  // =====================================================================
  // 衣櫥 wardrobe (only owned items selectable; others show where to get them)
  // =====================================================================
  define('wardrobe', '衣櫥', {
    sub: true,
    build(p, el) { p.cv = portraitCanvas(320); el.append(h('div.portrait', { style: { height: '200px' } }, p.cv)); p.body = h('div'); el.append(p.body, h('button.btn.primary.block', { style: { marginTop: '18px' }, on: { click: () => { S().oc = p.draft; St.touch('oc'); toast('換好衣服了！', 'shirt'); close('wardrobe'); } } }, icon('check', 's'), '穿上'));
      app().live(p.cv, () => ({ oc: p.draft || S().oc, state: { face: Math.sin(performance.now() / 1400) * 0.5, mouth: 'smile', eyes: 'happy' } })); },
    refresh(p) {
      p.draft = JSON.parse(JSON.stringify(S().oc)); const d = p.draft, b = p.body; b.replaceChildren();
      if (S().appearance.mode === 'sprite') b.append(h('div.card', { style: { marginTop: '10px' } }, h('div.lock-note', null, icon('info', 's'), '目前使用自製外觀（圖片／動畫），換裝只套用在角色骨架上。可在「編輯角色 → 外觀來源」切回。')));
      const owned = (slot) => Gm.wearOptions(slot);
      const opt = (slot, list) => { const g = h('div.grid.c4'); list.forEach(([v, label]) => { const ok = owned(slot).includes(v); const t = h('button.tile' + (ok ? '' : '.locked'), { 'data-v': v, on: { click: () => { if (!ok) { toast('可以在晴日雜貨攤買到', 'cart'); return; } haptic(); d[slot] = v; [...g.children].forEach((c) => c.classList.toggle('on', c.dataset.v === v)); } } }, ok ? null : icon('lock', 's'), label); t.classList.toggle('on', d[slot] === v); g.append(t); }); return g; };
      b.append(title('上衣顏色'), swatches(Sty.SHIRTS, d.shirt, (c) => (d.shirt = c)), title('圖案'), opt('pattern', Sty.PATTERNS), title('配件'), opt('acc', Sty.ACCS), title('配件顏色'), swatches(['#F26B5B', '#3FC1B0', '#FFC93C', '#9B7BE0', '#5BC0EB', '#F48FB1'], d.accCol, (c) => (d.accCol = c)), title('髮夾'), opt('clip', Sty.CLIPS));
    },
  });

  // =====================================================================
  // 需求 needs (real values + how to restore them)
  // =====================================================================
  define('needs', '需求', {
    sub: true,
    refresh(p, el) {
      const r = { food: 0.5, energy: 0.35, mood: Gm.has('cheerful') ? 0.2 : 0.3, social: Gm.has('shy') ? 0.25 : 0.4 };
      el.replaceChildren(...Gm.NEEDS.map((n) => card(h('div.need', null, h('div.dot', { style: { '--c': n.c } }, icon(n.ic, 's')), h('b', null, n.zh), bar(S().needs[n.id], n.c), h('span.val.num', null, Math.round(S().needs[n.id]))), h('div.muted', { style: { fontSize: 'var(--fs-s)', marginTop: '8px' } }, '恢復：', n.how), h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '2px' } }, `每分鐘約下降 ${r[n.id]}；離開遊戲時最多計算 6 小時，且不會低於 15。`))));
    },
  });

  // =====================================================================
  // 居民 NPC detail (relations + memories = dialogue event log)
  // =====================================================================
  define('npc', '居民', {
    sub: true,
    build(p, el) { p.cv = portraitCanvas(260); p.top = h('div'); p.body = h('div'); el.append(card(h('div.hero', null, h('div.portrait', null, p.cv), p.top)), p.body);
      p.go = h('button.btn.primary.block', { style: { marginTop: '16px' }, on: { click: () => { const id = p.params.id; close('npc'); close('char'); app().tab('island'); app().goToNpc(id); } } }, icon('walk', 's'), '去找他'); el.append(p.go);
      app().live(p.cv, () => ({ oc: Sty.PRESETS[Gm.NPCS[p.params.id].preset], state: { face: -0.2, mouth: 'smile' } })); },
    refresh(p) {
      const d = Gm.NPCS[p.params.id], n = Gm.npc(d.id), lv = Gm.friendLevel(n.fr), next = Gm.LEVELS[lv + 1];
      p.el.querySelector('h1').textContent = d.zh;
      p.top.replaceChildren(h('h2', null, d.zh), h('div.muted', null, n.met ? Gm.LEVEL_ZH[lv] : '還沒見過面'), h('div', { style: { margin: '6px 0' } }, hearts(n.fr)), next ? h('div', null, bar(100 * (n.fr - Gm.LEVELS[lv]) / (next - Gm.LEVELS[lv]), 'var(--heart)'), h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '4px' } }, `距離「${Gm.LEVEL_ZH[lv + 1]}」還差 ${next - n.fr}`)) : h('span.tag.accent', null, '已是摯友'));
      const likes = n.liked.length ? n.liked.map((x) => h('span.tag.accent', null, icon('heart', 's'), Sty.ITEMS[x].zh)) : [h('span.muted', null, '多聊天或送禮就會知道')];
      p.body.replaceChildren(title('個性'), card(d.who), title('喜歡的東西'), card(h('div.hstack', { style: { flexWrap: 'wrap' } }, ...likes)), title('回憶', '對話事件紀錄'), n.mem.length ? h('div.list', null, ...n.mem.map((m) => row(null, m.text, new Date(m.t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })))) : card(h('span.muted', null, '還沒有回憶。到島上找他聊天吧！')));
      p.go.hidden = OC.World.area && OC.World.area.id !== 'isle';
    },
  });

  // =====================================================================
  // 人生目標 life goals
  // =====================================================================
  define('goals', '人生目標', {
    sub: true,
    refresh(p, el) {
      el.replaceChildren(h('p.muted', null, '選一個長期目標，進度會依你在島上實際做的事累積。'), ...Gm.GOALS.map((g) => {
        const on = S().goal === g.id, v = Math.min(g.v(), g.n);
        return h('div.card', { style: on ? { boxShadow: '0 0 0 2.5px var(--accent), var(--shadow-1)' } : null }, h('div.hstack', null, icon(g.ic), h('div.grow', null, h('b', null, g.zh), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, g.d)), on ? h('span.tag.accent', null, '進行中') : h('button.btn.s', { on: { click: () => { S().goal = g.id; St.touch('goal'); toast(`人生目標：${g.zh}`, 'flag'); p.refresh(p, el); } } }, '設為目標')), h('div.hstack', { style: { marginTop: '10px' } }, h('div.grow', null, bar(100 * v / g.n, 'var(--teal)')), h('span.num', null, `${v}/${g.n}`)), v >= g.n ? h('div.tag.teal', { style: { marginTop: '8px' } }, icon('check', 's'), '已達成') : null);
      }));
    },
  });

  // =====================================================================
  // 工坊 workshop hub
  // =====================================================================
  define('workshop', '工坊', {
    build(p, el) {
      p.file = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, on: { change: (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) app().importImage(f); } } });
      el.append(p.file,
        card(h('div.hstack', null, h('div.dot', { style: { width: '44px', height: '44px', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' } }, icon('film')), h('div.grow', null, h('b', null, '逐格動畫工作室'), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '畫出自己的 OC，做成會動的角色或桌寵'))), h('button.btn.primary.block', { style: { marginTop: '12px' }, on: { click: () => open('studio', { id: null }) } }, icon('plus', 's'), '開新動畫')),
        h('div.list', { style: { marginTop: '12px' } }, row('image', '匯入圖片', '用手機裡的圖做角色外觀（自動去背可選）', null, () => p.file.click()), row('paw', '桌寵', '讓 OC 出現在手機桌面上', null, () => open('pet'))));
      p.works = h('div'); el.append(title('我的作品'), p.works);
    },
    refresh(p) {
      const list = S().anims;
      if (!list.length) { p.works.replaceChildren(card(h('div.empty', null, '還沒有作品。開一段新動畫或匯入圖片吧！'))); return; }
      p.works.replaceChildren(h('div.grid.c2', null, ...list.map((a) => {
        const img = new Image(); img.src = a.frames[0]; img.style.width = '100%'; img.style.aspectRatio = '1'; img.style.objectFit = 'contain'; img.style.background = '#fff'; img.style.borderRadius = '12px';
        const using = S().appearance.mode === 'sprite' && S().appearance.animId === a.id;
        return h('div.card', { style: { padding: '10px' } }, img, h('div.hstack', { style: { marginTop: '8px' } }, h('b.grow', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, a.name), using ? h('span.tag.teal', null, '使用中') : null), h('div.faint', { style: { fontSize: 'var(--fs-xs)' } }, `${a.frames.length} 格・${a.fps} fps`), h('div.hstack', { style: { marginTop: '8px' } }, h('button.btn.s.block', { on: { click: () => open('studio', { id: a.id }) } }, '編輯'), h('button.btn.s.block', { on: { click: () => workMenu(a) } }, '更多')));
      })));
    },
  });
  function workMenu(a) {
    sheet(a.name, (b, api) => {
      const using = S().appearance.mode === 'sprite' && S().appearance.animId === a.id;
      b.append(h('div.list', null,
        using ? row('person', '改回角色骨架外觀', null, null, () => { S().appearance = { mode: 'rig', animId: null }; St.touch('oc'); toast('已改回角色骨架', 'check'); api.close(); refreshOpen(); }) : row('person', '設為我的角色外觀', '單向素材會以左右翻轉與彈跳呈現', null, () => { S().appearance = { mode: 'sprite', animId: a.id }; St.touch('oc'); toast('已設為角色外觀', 'check'); api.close(); refreshOpen(); }),
        row('copy', '複製一份', null, null, () => { const c = JSON.parse(JSON.stringify(a)); c.id = 'a' + Date.now().toString(36); c.name = a.name + ' 複本'; S().anims.push(c); St.touch('anims'); api.close(); refreshOpen(); }),
        row('trash', '刪除', null, null, async () => { api.close(); if (await confirm('刪除作品', `確定要刪除「${a.name}」嗎？無法復原。`, '刪除', true)) { S().anims = S().anims.filter((x) => x.id !== a.id); if (S().appearance.animId === a.id) S().appearance = { mode: 'rig', animId: null }; St.touch('anims'); refreshOpen(); } })));
    });
  }

  // =====================================================================
  // 桌寵 floating pet (real system overlay on Android; unavailable in a browser)
  // =====================================================================
  define('pet', '桌寵', {
    sub: true,
    build(p, el) {
      p.cv = portraitCanvas(260); p.state = h('div'); p.body = h('div');
      el.append(h('div.portrait', null, p.cv), p.state, p.body);
      app().live(p.cv, () => ({ oc: S().oc, sprite: app().mySprite(), state: { face: 0.3, mouth: 'smile', eyes: 'happy' } }));
    },
    refresh(p) {
      const N = St.NATIVE, b = p.body;
      if (!N) {
        p.state.replaceChildren(card(h('div.lock-note', null, icon('lock', 's'), '桌寵需要 Android App（系統懸浮視窗）。在瀏覽器中無法顯示在其他 App 上方。')));
        b.replaceChildren(h('div.list', { style: { marginTop: '12px' } }, lockedRow('paw', '啟動桌寵', '請安裝 Android 版')));
        return;
      }
      const run = !!N.isPetRunning(), can = !!N.canDrawOverlays();
      p.state.replaceChildren(card(h('div.hstack', null, icon(run ? 'check' : 'paw'), h('div.grow', null, h('b', null, run ? '桌寵正在桌面上' : '桌寵未啟動'), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, can ? '已取得「顯示在其他應用程式上層」權限' : '第一次啟動時會帶你到系統設定開啟「顯示在其他應用程式上層」')))));
      const size = h('input', { type: 'range', min: 0.7, max: 1.5, step: 0.1, value: S().settings.petScale, 'aria-label': '桌寵大小', on: { change: (e) => { S().settings.petScale = +e.target.value; St.touch(); N.setPetScale(+e.target.value); toast('下次啟動桌寵時套用', 'info'); } } });
      b.replaceChildren(
        h('button.btn.primary.block', { style: { marginTop: '14px' }, on: { click: async () => { if (run) { N.stopPet(); } else { toast('正在準備桌寵圖像…', 'paw'); const ok = await app().exportPet(); if (!ok) { toast('桌寵圖像輸出失敗', 'info'); return; } N.startPet(); } setTimeout(() => p.refresh(p), 600); } } }, icon(run ? 'close' : 'paw', 's'), run ? '收起桌寵' : '啟動桌寵'),
        title('設定'), card(h('div', null, '大小'), size),
        title('操作方式'), card(h('div.muted', { style: { fontSize: 'var(--fs-s)', lineHeight: 1.7 } }, '・拖曳：把桌寵拿起來移動，放開會掉到螢幕底部', h('br'), '・點一下：開心跳一下', h('br'), '・點兩下：回到遊戲', h('br'), '・通知列「收起桌寵」可隨時關閉')),
        h('button.btn.block', { style: { marginTop: '12px' }, on: { click: async () => { const ok = await app().exportPet(); toast(ok ? '已更新桌寵外觀' : '更新失敗', ok ? 'check' : 'info'); } } }, icon('refresh', 's'), '用目前外觀更新桌寵'));
    },
  });

  // =====================================================================
  // 探索 explore / world map
  // =====================================================================
  const PLACES = [
    { id: 'isle', zh: '晴日島', d: '你的家。果樹、雜貨攤、居民都在這裡。', x: 0.5, y: 0.62, open: true, finds: ['apple', 'orange', 'peach', 'flower', 'shell'] },
    { id: 'forest', zh: '苔光森林', d: '安靜的森林，可以採到森林蘑菇。夜晚有螢火蟲。', x: 0.26, y: 0.28, open: true, finds: ['mushroom'] },
    { id: 'beach', zh: '星砂海灘', d: '傳說中星砂會發光的海灘。', x: 0.8, y: 0.3, open: false },
    { id: 'hill', zh: '風車丘', d: '風很大的山丘，有一座老風車。', x: 0.18, y: 0.78, open: false },
    { id: 'market', zh: '雲朵市集', d: '每週一次的市集。', x: 0.78, y: 0.82, open: false },
  ];
  define('explore', '探索', {
    build(p, el) {
      p.map = h('div.map-wrap'); const cv = portraitCanvas(720); cv.height = 720; p.map.append(cv); drawMap(cv);
      p.pins = PLACES.map((pl) => { const pin = h('button.map-pin' + (pl.open ? '' : '.locked'), { style: { left: pl.x * 100 + '%', top: pl.y * 100 + '%' }, 'aria-label': pl.zh, on: { click: () => { p.sel = pl.id; p.refresh(p); } } }, h('div.pin', null, icon(pl.open ? (pl.id === 'isle' ? 'home' : 'leaf') : 'lock', 's')), h('label', null, pl.zh)); p.map.append(pin); return pin; });
      p.info = h('div', { style: { marginTop: '12px' } });
      el.append(p.map, p.info);
    },
    refresh(p) {
      const cur = OC.World.area ? OC.World.area.id : 'isle'; p.sel = p.sel || cur;
      PLACES.forEach((pl, i) => p.pins[i].classList.toggle('on', pl.id === p.sel));
      const pl = PLACES.find((x) => x.id === p.sel), here = pl.id === cur;
      const finds = pl.finds ? h('div.hstack', { style: { flexWrap: 'wrap', marginTop: '8px' } }, ...pl.finds.map((f) => { const im = Sty.itemImg(f); im.style.width = im.style.height = '28px'; return h('span.tag', null, S().seen[f] ? im : icon('lock', 's'), S().seen[f] ? Sty.ITEMS[f].zh : '？？？'); })) : null;
      p.info.replaceChildren(card(h('div.hstack', null, h('h2', { style: { margin: 0, flex: 1, fontSize: 'var(--fs-xl)' } }, pl.zh), here ? h('span.tag.teal', null, '你在這裡') : pl.open ? null : h('span.tag', null, icon('lock', 's'), '未開放')), h('p.muted', null, pl.d), finds,
        pl.open && !here ? h('button.btn.primary.block', { style: { marginTop: '12px' }, on: { click: () => app().travel(pl.id) } }, icon('compass', 's'), '出發') : null,
        !pl.open ? h('div.lock-note', { style: { marginTop: '10px' } }, icon('info', 's'), '這個地點會在之後的版本開放。') : null));
    },
  });
  function drawMap(cv) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height;
    x.fillStyle = '#5BC0EB'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; const r = OC.rng(4); for (let i = 0; i < 40; i++) { const px = r() * W, py = r() * H; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 14, py - 6, px + 28, py); x.stroke(); }
    const land = (cx, cy, rx, ry, col, seed) => { x.save(); x.fillStyle = 'rgba(255,255,255,.5)'; OC.V.blob(x, cx, cy + 6, rx + 14, ry + 14, seed); x.fill(); x.fillStyle = '#F7E3A8'; OC.V.blob(x, cx, cy, rx + 8, ry + 8, seed); x.fill(); x.fillStyle = col; OC.V.blob(x, cx, cy, rx, ry, seed); x.fill(); x.restore(); };
    land(W * 0.5, H * 0.62, 150, 120, '#86CF5E', 3); land(W * 0.26, H * 0.28, 110, 90, '#3F9A50', 5); land(W * 0.8, H * 0.3, 80, 60, '#F7E3A8', 2); land(W * 0.18, H * 0.78, 70, 60, '#9ACF6E', 7); land(W * 0.78, H * 0.82, 80, 56, '#B9DA7A', 9);
    x.setLineDash([10, 12]); x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 4; x.beginPath(); x.moveTo(W * 0.5, H * 0.62 + 120); x.quadraticCurveTo(W * 0.1, H * 0.6, W * 0.26, H * 0.28 + 60); x.stroke(); x.setLineDash([]);
  }

  // =====================================================================
  // 更多 more
  // =====================================================================
  define('more', '更多', {
    build(p, el) { p.list = h('div'); el.append(p.list); },
    refresh(p) {
      const claimable = Gm.todayQuests().filter((q) => q.prog >= q.n && !q.claimed).length;
      const achN = Object.keys(S().ach).length, seenN = Object.keys(S().seen).filter((k) => Gm.COLLECTIBLE().includes(k)).length;
      p.list.replaceChildren(
        h('div.list', null,
          row('flag', '今日任務', `${Gm.todayQuests().filter((q) => q.claimed).length}/4 已領取`, h('div.hstack', null, claimable ? h('span.badge', null, claimable) : null, icon('chev', 'chev')), () => open('quests')),
          row('trophy', '成就', `${achN}/${Gm.ACH.length}`, null, () => open('ach')),
          row('book', '圖鑑', `${seenN}/${Gm.COLLECTIBLE().length}`, null, () => open('collection')),
          row('target', '人生目標', (Gm.GOALS.find((g) => g.id === S().goal) || { zh: '尚未選擇' }).zh, null, () => open('goals'))),
        h('div.list', { style: { marginTop: '12px' } },
          row('bag', '背包', `${Object.values(S().inv).reduce((a, b) => a + b, 0)} 件物品`, null, () => open('bag')),
          row('cart', '商店', '也可以在島上的晴日雜貨攤開啟', null, () => open('shop'))),
        h('div.list', { style: { marginTop: '12px' } },
          row('gear', '設定', '主題、效能、時間天氣、操作、資料', null, () => open('settings')),
          row('info', '關於', null, null, () => open('about'))));
    },
  });

  define('quests', '今日任務', {
    sub: true,
    refresh(p, el) {
      const list = Gm.todayQuests();
      el.replaceChildren(h('p.muted', null, '每天換一組任務（依照真實日期）。完成後領取金幣。'), ...list.map((q) => { const done = q.prog >= q.n; return card(h('div.hstack', null, icon(q.ic), h('div.grow', null, h('b', null, q.zh), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, q.d)), q.claimed ? h('span.tag.teal', null, icon('check', 's'), '已領取') : done ? h('button.btn.s.sun', { on: { click: () => { const r = Gm.claim(q.id); if (r) { toast(`獲得 ${r} 金幣`, 'coin'); haptic(); } p.refresh(p, el); } } }, icon('coin', 's'), `領取 ${q.reward}`) : h('span.tag', null, icon('coin', 's'), q.reward)), h('div.hstack', { style: { marginTop: '10px' } }, h('div.grow', null, bar(100 * q.prog / q.n, 'var(--sun)')), h('span.num', null, `${q.prog}/${q.n}`))); }));
    },
  });
  define('ach', '成就', {
    sub: true,
    refresh(p, el) { el.replaceChildren(h('div.grid.c2', null, ...Gm.ACH.map((a) => { const got = S().ach[a.id], v = Math.min(a.v(), a.n); return h('div.card', { style: { padding: '12px', opacity: got ? 1 : 0.75 } }, h('div.hstack', null, h('span', { style: { color: got ? 'var(--sun)' : 'var(--locked)' } }, icon('trophy')), h('b.grow', null, a.zh)), h('div.muted', { style: { fontSize: 'var(--fs-xs)', margin: '4px 0 8px' } }, a.d), got ? h('span.tag.sun', null, new Date(got).toLocaleDateString('zh-TW')) : h('div', null, bar(100 * v / a.n, 'var(--sun)'), h('div.faint.num', { style: { fontSize: 'var(--fs-xs)', marginTop: '4px' } }, `${v}/${a.n}`))); }))); },
  });
  define('collection', '圖鑑', {
    sub: true,
    refresh(p, el) {
      const ids = Gm.COLLECTIBLE();
      el.replaceChildren(h('p.muted', null, `已收集 ${ids.filter((k) => S().seen[k]).length}/${ids.length}`), h('div.grid.c3', null, ...ids.map((k) => { const seen = S().seen[k], it = Sty.ITEMS[k]; const t = h('button.tile' + (seen ? '' : '.locked'), { on: { click: () => seen ? sheet(it.zh, (b) => b.append(h('div.center', null, Sty.itemImg(k)), h('p', null, it.d), h('div.muted', null, `${Sty.KIND_ZH[it.kind]}・第一次取得：${new Date(seen).toLocaleDateString('zh-TW')}`))) : toast('還沒發現這個物品', 'lock') } }, seen ? Sty.itemImg(k) : icon('lock', 'l'), seen ? it.zh : '？？？'); const im = t.querySelector('img'); if (im) { im.style.width = '60%'; } return t; })));
    },
  });

  // =====================================================================
  // 商店 shop (buy / sell with real coins)
  // =====================================================================
  define('shop', '晴日雜貨攤', {
    sub: true,
    build(p, el) { p.coins = h('span.num'); p.mode = 'buy'; p.tabs = seg([['buy', '購買'], ['sell', '賣出']], 'buy', (v) => { p.mode = v; p.refresh(p, el); }); p.body = h('div', { style: { marginTop: '12px' } }); el.append(card(h('div.hstack', null, icon('coin'), h('span.grow', null, '持有金幣'), p.coins)), h('div', { style: { marginTop: '12px' } }, p.tabs), p.body); },
    refresh(p) {
      p.coins.textContent = S().coins.toLocaleString();
      if (p.mode === 'buy') {
        p.body.replaceChildren(h('div.list', null, ...Sty.SHOP.map((id) => { const it = Sty.ITEMS[id], owned = St.count(id), im = Sty.itemImg(id); im.style.width = im.style.height = '40px'; const sold = it.kind === 'clothing' && owned; return row(im, it.zh, `${Sty.KIND_ZH[it.kind]}・${it.d}`, sold ? h('span.tag.teal', null, '已擁有') : h('button.btn.s' + (S().coins >= it.price ? '.sun' : ''), { 'aria-label': `購買 ${it.zh}`, on: { click: () => { const r = Gm.buy(id); toast(r.ok ? `買了 ${it.zh}` : r.why, r.ok ? 'cart' : 'info'); if (r.ok) haptic(); p.refresh(p); } } }, icon('coin', 's'), it.price)); })));
      } else {
        const inv = Object.keys(S().inv).filter((id) => Sty.ITEMS[id] && Sty.ITEMS[id].sell);
        p.body.replaceChildren(inv.length ? h('div.list', null, ...inv.map((id) => { const it = Sty.ITEMS[id], im = Sty.itemImg(id); im.style.width = im.style.height = '40px'; return row(im, `${it.zh} ×${St.count(id)}`, `每個 ${it.sell} 金幣`, h('button.btn.s', { on: { click: () => { const g = Gm.sell(id); if (g) { toast(`賣出 ${it.zh}，獲得 ${g} 金幣`, 'coin'); haptic(); } p.refresh(p); } } }, '賣 1 個')); })) : card(h('div.empty', null, '背包裡沒有可以賣的東西。')));
      }
    },
  });

  // =====================================================================
  // 背包 bag (full)
  // =====================================================================
  define('bag', '背包', {
    sub: true,
    refresh(p, el) {
      const groups = {}; for (const id of Object.keys(S().inv)) { const k = Sty.ITEMS[id] ? Sty.ITEMS[id].kind : 'material'; (groups[k] = groups[k] || []).push(id); }
      const kinds = ['food', 'gift', 'material', 'furniture', 'clothing'].filter((k) => groups[k]);
      if (!kinds.length) { el.replaceChildren(card(h('div.empty', null, '背包是空的。搖搖果樹、到海邊撿貝殼吧！'))); return; }
      el.replaceChildren(...kinds.flatMap((k) => [title(Sty.KIND_ZH[k]), h('div.grid.c4', null, ...groups[k].map((id) => { const t = h('button.tile', { on: { click: () => itemSheet(id, () => p.refresh(p, el)) } }, Sty.itemImg(id), Sty.ITEMS[id].zh, h('span.count', null, '×' + St.count(id))); t.querySelector('img').style.width = '58%'; return t; }))]));
    },
  });
  function itemSheet(id, after) {
    const it = Sty.ITEMS[id];
    sheet(it.zh, (b, api) => {
      const acts = [];
      if (it.use) acts.push(h('button.btn.primary.block', { on: { click: () => { const fx = Gm.eat(id); if (fx) { toast(`${S().oc.name} 吃了${it.zh}`, 'apple'); app().reactEat(); } api.close(); after && after(); } } }, icon('apple', 's'), it.kind === 'food' ? '吃' : '使用'));
      if (it.kind === 'furniture') acts.push(h('button.btn.primary.block', { on: { click: () => { api.close(); OC.UI.stack.slice().reverse().forEach((l) => l.close && l.close()); app().tab('island'); app().startPlacement({ id }); } } }, icon('sofa', 's'), '放到島上'));
      if (it.kind === 'clothing') acts.push(h('button.btn.primary.block', { on: { click: () => { api.close(); open('wardrobe'); } } }, icon('shirt', 's'), '到衣櫥穿上'));
      b.append(h('div.center', null, Sty.itemImg(id)), h('p', null, it.d), h('div.muted', { style: { fontSize: 'var(--fs-s)', marginBottom: '12px' } }, `持有 ${St.count(id)} 個${it.sell ? `・可賣 ${it.sell} 金幣` : ''}${it.use ? '・' + Object.entries(it.use).map(([k, v]) => `${Gm.NEEDS.find((n) => n.id === k).zh}+${v}`).join(' ') : ''}`), h('div.vstack', null, ...acts), it.kind === 'gift' || it.kind === 'food' ? h('div.lock-note', { style: { marginTop: '10px' } }, icon('info', 's'), '想送給居民：在島上打開快速背包，把物品拖到居民身上。') : null);
    });
  }

  // =====================================================================
  // 設定 settings
  // =====================================================================
  define('settings', '設定', {
    sub: true,
    build(p, el) {
      const s = () => S().settings, set = (k, v) => { s()[k] = v; St.touch('settings', { k, v }); };
      p.theme = seg([['light', '淺色', 'sun'], ['dark', '深色', 'moon'], ['system', '跟隨系統', 'phone']], s().theme, (v) => app().setTheme(v));
      p.perf = seg([['high', '高'], ['balanced', '平衡'], ['saver', '省電'], ['custom', '自訂']], s().perf, (v) => { set('perf', v); app().applyPerf(); p.refresh(p); });
      p.custom = h('div.vstack', { style: { marginTop: '10px' } });
      const c = () => s().custom, setC = (k, v) => { c()[k] = v; St.touch('settings'); app().applyPerf(); };
      p.custom.append(
        h('div', null, h('div.muted', null, '幀率上限'), seg([['30', '30 fps'], ['60', '60 fps']], String(c().fps), (v) => setC('fps', +v))),
        h('div', null, h('div.muted', null, '陰影'), seg([['off', '關'], ['low', '低'], ['high', '高']], c().shadows, (v) => setC('shadows', v))),
        h('div.hstack', null, h('span.grow', null, '天氣與環境特效（雨、螢火蟲、雲影）'), toggle(c().fx, (v) => setC('fx', v))),
        h('div.hstack', null, h('span.grow', null, '隨風擺動的草'), toggle(c().grass, (v) => setC('grass', v))),
        h('div', null, h('div.muted', null, '畫面解析度'), h('input', { type: 'range', min: 0.75, max: 2, step: 0.25, value: c().scale, 'aria-label': '畫面解析度', on: { change: (e) => setC('scale', +e.target.value) } })));
      p.time = seg([['real', '現實'], ['morning', '早晨'], ['noon', '中午'], ['dusk', '黃昏'], ['night', '夜晚']], s().time, (v) => set('time', v));
      p.wx = seg([['auto', '自動'], ['clear', '晴'], ['cloudy', '多雲'], ['rain', '雨'], ['fog', '霧']], s().weather, (v) => set('weather', v));
      p.ctrl = seg([['tap', '點擊移動'], ['joy', '虛擬搖桿']], s().control, (v) => { set('control', v); app().applyControl(); });
      const fileIn = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, on: { change: async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const txt = await f.text(); if (await confirm('匯入存檔', '目前的進度會被覆蓋，確定嗎？', '匯入', true)) { St.importJSON(txt); location.reload(); } } catch (err) { toast('匯入失敗：' + err.message, 'info'); } } } });
      el.append(
        title('外觀主題'), card(p.theme, h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '8px' } }, '只影響介面；島上的白天黑夜依照遊戲時間。')),
        title('效能'), card(p.perf, h('div.muted', { style: { fontSize: 'var(--fs-s)', marginTop: '8px' }, 'data-perf-desc': '' }), p.custom, h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '顯示 FPS'), toggle(s().showFps, (v) => { set('showFps', v); app().applyPerf(); }))),
        title('世界'), card(h('div.muted', null, '時間'), p.time, h('div.muted', { style: { marginTop: '10px' } }, '天氣'), p.wx),
        title('操作'), card(h('div.muted', null, '移動方式'), p.ctrl, h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '觸覺回饋'), toggle(s().haptics, (v) => set('haptics', v))), h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '減少動態效果'), toggle(s().reduceMotion, (v) => { set('reduceMotion', v); app().applyMotion(); }))),
        title('聲音'), h('div.list', null, lockedRow('music', '音樂與音效', '音訊系統尚未實作')),
        title('資料'), fileIn, h('div.list', null,
          row('download', '匯出存檔', '存成 JSON 檔備份', null, () => app().exportSave()),
          row('upload', '匯入存檔', '從 JSON 檔還原', null, () => fileIn.click()),
          row('refresh', '重新開始', '刪除進度（保留設定）', null, async () => { if (await confirm('重新開始', '所有角色、物品與進度都會刪除，無法復原。', '刪除並重新開始', true)) { St.reset(); location.reload(); } })),
        h('div.faint', { style: { fontSize: 'var(--fs-xs)', margin: '10px 4px' }, 'data-saved': '' }, ''));
    },
    refresh(p) {
      const s = S().settings; p.theme.set(s.theme); p.perf.set(s.perf); p.time.set(s.time); p.wx.set(s.weather); p.ctrl.set(s.control);
      p.custom.hidden = s.perf !== 'custom';
      const q = app().perfOf(s.perf);
      p.el.querySelector('[data-perf-desc]').textContent = `${q.fps} fps・陰影${q.shadows ? (q.shadows >= 2048 ? '高' : '低') : '關'}・特效${q.fx ? '開' : '關'}・草${q.grass ? '開' : '關'}・解析度 ×${q.ratio}`;
      p.el.querySelector('[data-saved]').textContent = '存檔位置：本機（localStorage' + (St.NATIVE ? ' + App 內部儲存備份' : '') + '）';
    },
  });
  define('about', '關於', {
    sub: true,
    refresh(p, el) {
      const v = St.NATIVE ? St.NATIVE.appVersion() : 'Web 預覽';
      el.replaceChildren(h('div.center', { style: { margin: '20px 0' } }, h('div.logo', null, 'OC ', h('b', null, 'Shimeji')), h('div.muted', null, '原創角色生活模擬＋桌寵')), h('div.list', null, row('info', '版本', v), row('layers', '畫面', '3D 固定視角世界（three.js r158）＋ 2D 角色')), title('授權'), card(h('div.muted', { style: { fontSize: 'var(--fs-s)', lineHeight: 1.7 } }, 'three.js — MIT License', h('br'), 'jf open 粉圓（Huninn）— SIL Open Font License 1.1', h('br'), 'Nunito — SIL Open Font License 1.1', h('br'), '所有角色、場景與介面美術皆為原創。')), title('隱私'), card(h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '遊戲完全離線運作，不連網、不蒐集任何資料；存檔只保存在這台裝置上。')));
    },
  });

  OC.Pages = { pages, define, open, close, ensure, refreshOpen, itemSheet, PLACES };
})();
