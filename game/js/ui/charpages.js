/* OC Shimeji — character pages. One data source (OC.Chars / save.chars) for all of them:
 *   char (tab)   roster manager     cards, reorder, switch, island, pet, duplicate, export, delete
 *   profile      view only          everything about one OC + growth suggestions
 *   charedit     editor             tabs, simple/detailed, live stage, undo/redo, unsaved guard
 *   workshop     hub                studio, paint, library, import, packs, pet
 *   pet          desktop pet        choose OC, start/stop (Android), refresh sprites
 */
(function () {
  'use strict';
  const { h, icon, toast, seg, toggle, haptic, confirm, sheet, row, lockedRow } = OC.UI;
  const Ch = () => OC.Chars, S = () => OC.Store.s, St = OC.Store, Pg = () => OC.Pages;
  const T = (t, small) => h('div.section-title', null, t, small ? h('small', null, small) : null);
  const bar = (v, c) => h('div.bar', null, h('i', { style: { width: Math.round(v) + '%', '--c': c } }));
  const moodOf = (c) => { const n = c.needs, avg = (n.food + n.energy + n.mood + n.social) / 4; return n.energy < 22 ? '好睏' : n.food < 22 ? '肚子餓' : avg > 75 ? '心情超好' : avg > 50 ? '還不錯' : '普普通通'; };
  const statusOf = (c) => [S().activeId === c.id ? ['操控中', 'accent'] : null, c.status.onIsland ? ['在島上', 'teal'] : ['休息中', ''], S().petId === c.id ? ['桌寵', 'sun'] : null].filter(Boolean);
  function thumb(c, px = 112) { const cv = h('canvas', { width: px, height: px }); cv.style.cssText = `width:${px / 2}px;height:${px / 2}px;flex:none;border-radius:16px;background:var(--surface-2)`; OC.Assets.init().then(() => { const preload = Object.values(c.actions.idle || {}).map((id) => OC.Anim.get(id)).filter(Boolean).map((d) => OC.Anim.preload(d)); Promise.all(preload).then(() => OC.CharRender.portrait(cv, c, { pose: { mouth: 'smile' } })); }); OC.CharRender.portrait(cv, c, { pose: { mouth: 'smile' } }); return cv; }

  // ============================== roster ==============================
  Pg().define('char', '角色', {
    headRight: () => h('button.icon-btn', { 'aria-label': '匯入角色包', on: { click: () => OC.Library.importPackFile() } }, icon('download')),
    build(p, el) {
      p.list = h('div.vstack', { style: { gap: '10px' } });
      el.append(h('button.btn.primary.block', { on: { click: async () => { const c = await OC.Creator.start({}); if (c) Pg().open('profile', { id: c.id }); } } }, icon('plus', 's'), '新增角色'), T('我的角色', '長按拖曳可排序'), p.list);
    },
    refresh(p) {
      const all = Ch().all();
      p.list.replaceChildren(...all.map((c) => {
        const tags = statusOf(c).map(([t, k]) => h('span.tag' + (k ? '.' + k : ''), null, t));
        const card = h('div.card.char-card', { 'data-id': c.id, style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '12px' } },
          thumb(c), h('div', { style: { flex: 1, minWidth: 0 } }, h('b', { style: { fontSize: 'var(--fs-l)' } }, Ch().name(c)), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, `${Ch().typeTitle(c)}・${moodOf(c)}`), h('div.hstack', { style: { gap: '4px', marginTop: '6px', flexWrap: 'wrap' } }, ...tags)),
          h('button.icon-btn', { 'aria-label': `${Ch().name(c)} 的選項`, on: { click: (e) => { e.stopPropagation(); menu(c); } } }, icon('more')));
        card.addEventListener('click', (e) => { if (card.dataset.dragged) { delete card.dataset.dragged; return; } if (!e.target.closest('button')) Pg().open('profile', { id: c.id }); });
        dragReorder(card, p);
        return card;
      }));
    },
  });
  function dragReorder(card, p) {
    let timer = 0, y0 = 0, active = false;
    card.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; timer = setTimeout(() => { active = true; card.setPointerCapture(e.pointerId); card.classList.add('drag'); haptic(); }, 420); });
    card.addEventListener('pointermove', (e) => { if (!active) { if (Math.abs(e.clientY - y0) > 8) clearTimeout(timer); return; } card.style.transform = `translateY(${e.clientY - y0}px)`; });
    const end = (e) => { clearTimeout(timer); if (!active) return; active = false; card.classList.remove('drag'); card.style.transform = ''; card.dataset.dragged = '1';
      const ids = [...p.list.children].map((x) => x.dataset.id), from = ids.indexOf(card.dataset.id), hgt = card.offsetHeight + 10, to = Math.max(0, Math.min(ids.length - 1, from + Math.round((e.clientY - y0) / hgt)));
      if (to !== from) { ids.splice(to, 0, ids.splice(from, 1)[0]); Ch().reorder(ids); p.refresh(p); } };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }
  function menu(c) {
    sheet(Ch().name(c), (b, api) => {
      const done = (msg, ic) => { api.close(); if (msg) toast(msg, ic || 'check'); Pg().refreshOpen(); };
      b.append(h('div.list', null,
        S().activeId !== c.id ? row('hand', '設為目前操控角色', '在小島上操控這位 OC', null, () => { Ch().setActive(c.id); done(`現在操控：${Ch().name(c)}`, 'person'); }) : null,
        S().activeId !== c.id ? row('island', c.status.onIsland ? '離開小島' : '加入小島', c.status.onIsland ? '回家休息，不會出現在島上' : '會在島上散步、和你打招呼', null, () => { c.status.onIsland = !c.status.onIsland; Ch().save(c); done(c.status.onIsland ? '加入小島了' : '回家休息了', 'island'); }) : null,
        St.NATIVE ? row('paw', S().petId === c.id ? '取消桌寵' : '設為桌寵角色', '系統懸浮桌寵會使用這位 OC 的外觀與動畫', null, () => { S().petId = S().petId === c.id ? null : c.id; St.touch('chars'); done(S().petId ? '已設為桌寵角色（到「工坊 → 桌寵」更新）' : '已取消', 'paw'); }) : lockedRow('paw', '設為桌寵角色', '需要 Android App'),
        row('edit', '編輯角色', null, null, () => { api.close(); Pg().open('charedit', { id: c.id }); }),
        row('film', '動畫配置', null, null, () => { api.close(); Pg().open('charedit', { id: c.id, tab: 'anims' }); }),
        row('copy', '複製角色', '外觀、個性、動畫設定都會複製', null, () => { const d = Ch().duplicate(c.id); done(`已複製為「${Ch().name(d)}」`, 'copy'); }),
        row('upload', '匯出角色包', '.ocpack（含圖片、動畫、設定）', null, async () => { api.close(); await exportChars([c.id]); }),
        row('trash', '刪除角色', Ch().all().length <= 1 ? '至少要保留一位角色' : '無法復原', null, async () => { if (Ch().all().length <= 1) { toast('至少要保留一位角色', 'info'); return; } api.close(); if (await confirm('刪除角色', `確定刪除「${Ch().name(c)}」？角色專屬的動畫會保留在素材庫，可另外刪除。`, '刪除', true)) { Ch().remove(c.id); Pg().close('profile'); Pg().refreshOpen(); toast('已刪除', 'trash'); } })));
    });
  }
  async function exportChars(ids, progress) {
    try { toast('打包中…', 'upload'); const blob = await OC.IO.exportPack({ chars: ids, progress }); const c = Ch().get(ids[0]); await OC.IO.deliver(blob, ids.length > 1 ? `oc-group-${ids.length}.ocpack` : `${(c.profile.name || 'oc').replace(/[\\/:*?"<>|]/g, '_')}.ocpack`); toast(`已匯出（${(blob.size / 1048576).toFixed(1)} MB）`, 'check'); }
    catch (e) { toast('匯出失敗：' + e.message, 'info'); }
  }

  // ============================== profile (view) ==============================
  Pg().define('profile', '角色檔案', {
    sub: true,
    build(p, el) {
      p.cv = h('canvas', { width: 320, height: 320 }); p.top = h('div'); p.body = h('div');
      el.append(h('div.card', null, h('div.hero', null, h('div.portrait', null, p.cv), p.top)), h('div.hstack', { style: { marginTop: '12px' } }, h('button.btn.primary.block', { on: { click: () => Pg().open('charedit', { id: p.params.id }) } }, icon('edit', 's'), '編輯角色'), h('button.btn.block', { on: { click: () => Pg().open('charedit', { id: p.params.id, tab: 'anims' }) } }, icon('film', 's'), '動畫')), p.body);
      OC.App.live(p.cv, () => ({ char: Ch().get(p.params.id), pose: { face: 0.2 } }));
    },
    refresh(p) {
      const c = Ch().get(p.params.id) || Ch().active(); if (!c) return; p.params.id = c.id;
      const P = c.profile, pers = c.personality;
      p.el.querySelector('h1').textContent = Ch().name(c);
      p.top.replaceChildren(h('h2', null, P.name || '無名氏'), P.nickname ? h('div.muted', null, `暱稱：${P.nickname}`) : null, h('div.tag.teal', { style: { marginTop: '4px' } }, Ch().typeTitle(c)), h('div.muted', { style: { marginTop: '4px', fontSize: 'var(--fs-s)' } }, moodOf(c)), h('div.hstack', { style: { gap: '4px', marginTop: '6px', flexWrap: 'wrap' } }, ...statusOf(c).map(([t, k]) => h('span.tag' + (k ? '.' + k : ''), null, t))));
      const kv = (k, v) => (v ? h('div.hstack', { style: { padding: '6px 0', borderBottom: '1px solid var(--line)' } }, h('span.muted', { style: { width: '72px', flex: 'none' } }, k), h('span', { style: { flex: 1 } }, v)) : null);
      const chips = (arr, k = 'accent') => (arr.length ? h('div.hstack', { style: { flexWrap: 'wrap', gap: '6px' } }, ...arr.map((t) => h('span.tag.' + k, null, t))) : h('span.faint', null, '（未設定）'));
      const traits = pers.traits.map((t) => (Ch().TRAITS.find((q) => q.id === t) || {}).zh).filter(Boolean).concat(pers.customTraits.map((t) => t.name));
      const q = c.quirks, qz = (k) => (Ch().QUIRKS[k].opts.find((o) => o[0] === q[k]) || [0, ''])[1];
      const g = c.growth;
      p.body.replaceChildren(
        g.suggestions.length ? h('div.card', { style: { marginTop: '12px', boxShadow: '0 0 0 2px var(--sun), var(--shadow-1)' } }, h('b', null, '新的發現'), ...g.suggestions.map((s) => h('div', { style: { marginTop: '8px' } }, h('div', null, `${Ch().name(c)}好像${s.type === 'trait' ? '有了新特質' : '發現了新興趣'}：「${s.type === 'trait' ? (Ch().TRAITS.find((t) => t.id === s.value) || { zh: s.value }).zh : s.value}」`), h('div.faint', { style: { fontSize: 'var(--fs-xs)' } }, s.reason),
          h('div.hstack', { style: { marginTop: '6px' } }, h('button.btn.s.primary', { on: { click: () => { Ch().resolve(c, s.id, 'accept'); p.refresh(p); } } }, '接受'), h('button.btn.s', { on: { click: () => { Ch().resolve(c, s.id, 'reject'); p.refresh(p); } } }, '不要'), h('button.btn.s', { on: { click: () => { Ch().resolve(c, s.id, 'lock'); p.refresh(p); toast('之後不會再提出', 'lock'); } } }, '永遠不要'))))) : null,
        T('需求'), h('div.card', null, ...OC.Game.NEEDS.map((n) => h('div.need', null, h('div.dot', { style: { '--c': n.c } }, icon(n.ic, 's')), h('span', null, n.zh), bar(c.needs[n.id], n.c), h('span.val.num', null, Math.round(c.needs[n.id]))))),
        T('基本資料'), h('div.card', null, kv('代稱', P.pronoun), kv('性別', P.gender), kv('年齡', P.age), kv('生日', P.birthday), kv('種族', (Ch().SPECIES.find((s) => s[0] === P.species) || [0, P.species])[1]), kv('介紹', P.intro), ...(P.custom || []).filter((r) => r.k).map((r) => kv(r.k, r.v)), !P.pronoun && !P.gender && !P.age && !P.birthday && !P.intro ? h('span.faint', null, '（可在編輯角色補充）') : null),
        P.backstory ? h('div', null, T('背景故事'), h('div.card', { style: { whiteSpace: 'pre-wrap' } }, P.backstory)) : null,
        T('性格'), h('div.card', null, ...Ch().SLIDERS.map((d) => h('div', { style: { margin: '4px 0' } }, h('div.hstack', { style: { fontSize: 'var(--fs-s)' } }, h('span.grow', null, d.zh), h('span.muted', null, pers[d.id] < 40 ? d.lo : pers[d.id] > 60 ? d.hi : '普通')), bar(pers[d.id], 'var(--teal)')))),
        T('特質'), h('div.card', null, chips(traits, 'teal')),
        T('小怪癖'), h('div.card', { style: { fontSize: 'var(--fs-s)', lineHeight: 1.8 } }, `走路：${qz('walk')}・坐姿：${qz('sit')}・睡相：${qz('sleep')}・吃東西：${qz('eat')}`, h('br'), `打招呼：${qz('greet')}・習慣：${qz('habit')}・招牌表情：${qz('face')}`),
        T('說話'), h('div.card', null, h('div.speech', { style: { position: 'static', transform: 'none', display: 'inline-block', animation: 'none' } }, Ch().speak(c, c.speech.catchphrase || '你好，很高興認識你！'))),
        T('喜好'), h('div.card', null, h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '喜歡'), chips(P.likes), h('div.muted', { style: { fontSize: 'var(--fs-s)', marginTop: '8px' } }, '討厭'), chips(P.dislikes, 'sun'), h('div.muted', { style: { fontSize: 'var(--fs-s)', marginTop: '8px' } }, '興趣'), chips(P.hobbies, 'teal'), h('div.muted', { style: { fontSize: 'var(--fs-s)', marginTop: '8px' } }, '習慣'), chips(P.habits, 'teal'),
          c.tastes.likeItems.length ? h('div', { style: { marginTop: '8px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '喜歡的物品'), chips(c.tastes.likeItems.map((i) => OC.Style.ITEMS[i].zh))) : null),
        T('動畫配置'), h('div.card', null, (() => { const cov = OC.Anim.coverage(c); return cov.length ? chips(cov.map((a) => Ch().ACTION_ZH[a] || a), 'accent') : h('span.faint', null, c.appearance.mode === 'sprite' ? '使用圖片外觀' : '使用內建角色骨架動作'); })()),
        g.history.length ? h('div', null, T('成長紀錄'), h('div.list', null, ...g.history.slice(0, 6).map((x) => row(null, `${x.value}`, `${{ accept: '接受', reject: '拒絕', lock: '鎖定不再提出' }[x.decision]}・${new Date(x.at).toLocaleDateString('zh-TW')}`)))) : null);
    },
  });

  // ============================== editor ==============================
  const TABS = [['look', '外觀'], ['parts', '部件'], ['profile', '資料'], ['personality', '個性'], ['tastes', '喜好'], ['speech', '說話'], ['anims', '動畫']];
  Pg().define('charedit', '編輯角色', {
    sub: true,
    headRight: (p) => h('div.hstack', { style: { gap: 0 } }, h('button.icon-btn', { 'aria-label': '復原', on: { click: () => p.hist && p.hist.undo() && rebuild(p) } }, icon('undo')), h('button.icon-btn', { 'aria-label': '重做', on: { click: () => p.hist && p.hist.redo() && rebuild(p) } }, icon('redo')), h('button.btn.s.primary', { on: { click: () => saveEdit(p) } }, '儲存')),
    build(p, el) {
      p.stage = OC.CharEdit.stage(() => p.draft, { size: 280, onPart: (part, live) => { if (!live) { p.hist.commit(); p.dirty = true; } if (p.ctx.partsRefresh && !live) p.ctx.partsRefresh(); } });

      p.tabs = seg(TABS, 'look', (v) => { p.tab = v; rebuild(p); });
      p.level = seg([['simple', '簡易'], ['detailed', '詳細']], 'simple', (v) => { p.lv = v; rebuild(p); });
      p.body = h('div', { style: { marginTop: '6px' } });
      const tabsWrap = h('div', { style: { overflowX: 'auto', margin: '10px -2px 0', touchAction: 'pan-x' } }, p.tabs); p.tabs.style.minWidth = '520px';
      el.append(h('div.edit-head', null, p.stage.el, tabsWrap), h('div', { style: { marginTop: '8px' } }, p.level), p.body);
    },
    refresh(p) {
      const c = Ch().get(p.params.id) || Ch().active(); p.params.id = c.id;
      if (!p.draft || p.draft.id !== c.id || !p.dirty) { p.draft = Ch().clone(c); p.dirty = false; p.hist = OC.UI.history(() => p.draft, (v) => { p.draft = v; }); }
      p.tab = p.params.tab || p.tab || 'look'; p.params.tab = null; p.lv = p.lv || 'simple'; p.tabs.set(p.tab); p.level.set(p.lv);
      p.el.querySelector('h1').textContent = `編輯・${Ch().name(c)}`;
      rebuild(p); p.stage.restart();
    },
  });
  function rebuild(p) {
    const S_ = OC.CharEdit.sections, c = p.draft;
    p.ctx = { level: p.lv, stage: p.stage, selected: p.ctx && p.ctx.selected, full: true, changed: (kind, react, live) => { c.updated = Date.now(); p.dirty = true; if (!live) p.hist.commit(); if (react) p.stage.react(react, 1.3); }, rebuild: () => rebuild(p) };
    p.stage.select(p.tab === 'parts' ? p.ctx.selected : null);
    p.level.style.display = ['look', 'profile'].includes(p.tab) ? '' : 'none';
    const parts = { look: () => [S_.template(c, p.ctx), p.lv === 'detailed' ? S_.body(c, p.ctx) : null, S_.face(c, p.ctx), S_.earsTail(c, p.ctx), S_.colors(c, p.ctx), S_.outfit(c, p.ctx), S_.expressions(c, p.ctx)],
      parts: () => [S_.parts(c, p.ctx)], profile: () => [S_.profile(c, p.ctx)], personality: () => [S_.personality(c, p.ctx), S_.traits(c, p.ctx), S_.quirks(c, p.ctx)], tastes: () => [S_.tastes(c, p.ctx)], speech: () => [S_.speech(c, p.ctx)], anims: () => [S_.anims(Ch().get(c.id) || c, p.ctx)] };
    p.body.replaceChildren(...parts[p.tab]().filter(Boolean));
  }
  function saveEdit(p) {
    const d = p.draft; if (!d.profile.name.trim()) { toast('角色需要名字', 'edit'); p.tab = 'profile'; p.tabs.set('profile'); rebuild(p); return; }
    const live = Ch().get(d.id); d.actions = live ? live.actions : d.actions;   // animations are owned by the studio
    Ch().save(Ch().clone(d)); p.dirty = false; p.hist.reset(); toast('已儲存', 'check'); haptic();
  }
  // unsaved-change guard for the editor
  const origClose = Pg().close;
  Pg().close = function (id) {
    const p = Pg().pages.charedit;
    if (id === 'charedit' && p && p.dirty && !p.leaving) { p.leaving = true; OC.UI.guardLeave(() => true).then((ok) => { p.leaving = false; if (ok) { p.dirty = false; origClose(id); } }); return; }
    origClose(id);
  };

  // ============================== workshop hub ==============================
  Pg().define('workshop', '工坊', {
    build(p, el) {
      const card = (ic, title, desc, fn, primary) => h('div.card', { style: { marginTop: '10px' } }, h('div.hstack', null, h('span', { style: { width: '44px', height: '44px', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)', flex: 'none' } }, icon(ic)), h('div.grow', null, h('b', null, title), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, desc))), primary ? h('button.btn.primary.block', { style: { marginTop: '10px' }, on: { click: fn } }, icon('plus', 's'), primary) : null);
      p.anims = h('div');
      el.append(card('film', '逐格動畫工作室', '為 OC 做待機、走路、吃飯……任何動作，直接在小島與桌寵播放', () => OC.Studio.open({ charId: Ch().active().id }), '新動畫'),
        h('div.list', { style: { marginTop: '12px' } },
          row('brush', '繪畫工坊', '畫角色、五官、服裝、飾品或動畫影格', null, () => OC.Paint.open({ owner: Ch().active().id })),
          row('image', '素材庫', '管理所有圖片：重新命名、取代、複製、刪除', null, () => Pg().open('library')),
          row('upload', '匯入圖片／動畫', 'PNG、JPEG、WebP、GIF、APNG、多張連續圖、Sprite Sheet、ZIP', null, async () => { await OC.Library.importDialog({ owner: Ch().active().id, purpose: 'anim' }); p.refresh(p); }),
          row('download', '匯入角色／動作包', '.ocpack', null, async () => { await OC.Library.importPackFile(); p.refresh(p); }),
          row('layers', '匯出備份', '選擇要匯出的角色、動作與遊戲進度', null, () => backupSheet()),
          row('paw', '桌寵', '讓 OC 出現在手機桌面上', null, () => Pg().open('pet'))),
        T('動畫作品'), p.anims);
    },
    refresh(p) {
      const list = OC.Anim.list((d) => !String(d.id).startsWith('__'));
      if (!list.length) { p.anims.replaceChildren(h('div.card', null, h('div.empty', null, '還沒有動畫。按「新動畫」開始，或匯入多張連續圖片。'))); return; }
      p.anims.replaceChildren(h('div.grid.c2', null, ...list.map((d) => {
        const cv = h('canvas', { width: 160, height: 160 }); cv.style.cssText = 'width:100%;aspect-ratio:1;border-radius:12px;background:var(--surface-2)';
        OC.Anim.preload(d).then(() => { const f = OC.Anim.composite(d, 0); if (f) { const x = cv.getContext('2d'), s = Math.min(150 / d.w, 150 / d.h); x.drawImage(f, (160 - d.w * s) / 2, (160 - d.h * s) / 2, d.w * s, d.h * s); } });
        const owner = Ch().get(d.owner);
        return h('button.card', { style: { padding: '10px', textAlign: 'left' }, on: { click: () => OC.Studio.open({ charId: d.owner || Ch().active().id, docId: d.id }) } }, cv, h('b', { style: { display: 'block', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, d.name), h('div.faint', { style: { fontSize: 'var(--fs-xs)' } }, `${Ch().ACTION_ZH[d.action] || d.action}・${OC.Anim.count(d)} 格・${owner ? owner.profile.name : '共用'}`));
      })));
    },
  });
  function backupSheet() {
    sheet('匯出備份', (b, api) => {
      const chosen = new Set(Ch().all().map((c) => c.id)); let progress = true;
      b.append(h('div.list', null, ...Ch().all().map((c) => row(null, Ch().name(c), Ch().typeTitle(c), toggle(true, (v) => (v ? chosen.add(c.id) : chosen.delete(c.id)))))),
        h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '包含遊戲進度（金幣、物品、任務…）'), toggle(true, (v) => (progress = v))),
        h('button.btn.primary.block', { style: { marginTop: '14px' }, on: { click: async () => { if (!chosen.size) { toast('至少選一位角色', 'info'); return; } api.close(); await exportChars([...chosen], progress); } } }, icon('upload', 's'), '匯出 .ocpack'));
    });
  }

  // ============================== pet ==============================
  Pg().define('pet', '桌寵', {
    sub: true,
    build(p, el) { p.cv = h('canvas', { width: 260, height: 260 }); p.state = h('div'); p.body = h('div'); el.append(h('div.portrait', null, p.cv), p.state, p.body); OC.App.live(p.cv, () => ({ char: Ch().get(S().petId) || Ch().active(), pose: { face: 0.3, eyes: 'happy' } })); },
    refresh(p) {
      const N = St.NATIVE, c = Ch().get(S().petId) || Ch().active();
      const pick = h('div.list', { style: { marginTop: '12px' } }, ...Ch().all().map((x) => row(null, Ch().name(x), x.id === c.id ? '桌寵角色' : Ch().typeTitle(x), x.id === c.id ? icon('check') : null, () => { S().petId = x.id; St.touch('chars'); p.refresh(p); })));
      if (!N) { p.state.replaceChildren(h('div.card', null, h('div.lock-note', null, icon('lock', 's'), '桌寵需要 Android App（系統懸浮視窗）。在瀏覽器中無法顯示在其他 App 上方。'))); p.body.replaceChildren(T('桌寵角色'), pick, h('div.list', { style: { marginTop: '12px' } }, lockedRow('paw', '啟動桌寵', '請安裝 Android 版'))); return; }
      const run = !!N.isPetRunning(), can = !!N.canDrawOverlays();
      p.state.replaceChildren(h('div.card', null, h('div.hstack', null, icon(run ? 'check' : 'paw'), h('div.grow', null, h('b', null, run ? `${Ch().name(c)}正在桌面上` : '桌寵未啟動'), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, can ? '已取得「顯示在其他應用程式上層」權限' : '第一次啟動會帶你到系統設定開啟權限')))));
      p.body.replaceChildren(
        h('button.btn.primary.block', { style: { marginTop: '14px' }, on: { click: async () => { if (run) N.stopPet(); else { toast('正在準備桌寵圖像…', 'paw'); const ok = await OC.App.exportPet(); if (!ok) { toast('桌寵圖像輸出失敗', 'info'); return; } N.startPet(); } setTimeout(() => p.refresh(p), 600); } } }, icon(run ? 'close' : 'paw', 's'), run ? '收起桌寵' : '啟動桌寵'),
        T('桌寵角色', '使用這位 OC 的外觀與動畫'), pick,
        T('大小'), h('div.card', null, h('input', { type: 'range', min: 0.7, max: 1.5, step: 0.1, value: S().settings.petScale, 'aria-label': '桌寵大小', on: { change: (e) => { S().settings.petScale = +e.target.value; St.touch(); N.setPetScale(+e.target.value); toast('下次啟動桌寵時套用', 'info'); } } })),
        h('button.btn.block', { style: { marginTop: '12px' }, on: { click: async () => { const ok = await OC.App.exportPet(); toast(ok ? '已更新桌寵外觀與動畫' : '更新失敗', ok ? 'check' : 'info'); } } }, icon('refresh', 's'), '用目前外觀更新桌寵'));
    },
  });

  OC.CharPages = { exportChars, menu };
})();
