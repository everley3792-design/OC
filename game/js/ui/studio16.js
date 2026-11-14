/* OC Shimeji — 16.3 the character studio (replaces the old 「編輯角色」 page).
 * Layout: two regions. The stage (or, for a picture character's 「圖片」 tab, the framing table) stays fixed at the top with the
 * tab row under it; ONLY the panel below scrolls (the old page scrolled as a whole under a sticky stage whose offset assumed a
 * header that scrolls away — the "跑版" when sliding).
 * Tabs follow the kind of character:
 *   drawn   外觀 部件 資料 個性 喜好 說話 台詞 互動 事件 動畫
 *   picture 圖片 動畫 飾品 資料 個性 喜好 說話 台詞 互動 事件      (no face / ears / colours / outfit — they do not apply to a picture)
 * New editors: 台詞 (c.lines16, per situation, 「只用我寫的」, 試說), 互動 (c.inter16 → OC.Will), 事件 (c.scripts16 → OC.Script,
 * blocks ⇄ source, import any number of scripts), 動畫 for pictures (source preset / mixed / custom, per-action checkboxes with
 * 全選 / 全不選 / 反選 and bulk actions, batch import mapped by file name). Everything lives on the character → its .ocpack.
 */
(function () {
  'use strict';
  const U = () => OC.UI, h = (...a) => OC.UI.h(...a), icon = (...a) => OC.UI.icon(...a), toast = (...a) => OC.UI.toast(...a);
  const haptic = (k) => OC.UI.haptic && OC.UI.haptic(k || 'tick'), Ch = () => OC.Chars, Pg = () => OC.Pages;
  const T = (t, small) => h('div.section-title', null, t, small ? h('small', null, small) : null);
  const isImg = (c) => c && c.appearance && c.appearance.mode === 'sprite';
  const stk = (k) => (OC.UI.stickerOr ? OC.UI.stickerOr(k) : icon(k));
  const uid = () => Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1296).toString(36);

  const TABS_RIG = [['look', '外觀', 'sparkle'], ['parts', '部件', 'star'], ['profile', '資料', 'person'], ['personality', '個性', 'heart'], ['tastes', '喜好', 'apple'], ['speech', '說話', 'chat'], ['lines', '台詞', 'chat'], ['inter', '互動', 'paw'], ['events', '事件', 'film'], ['anims', '動畫', 'film']];
  const TABS_IMG = [['frame', '圖片', 'camera'], ['anims', '動畫', 'film'], ['parts', '飾品', 'star'], ['profile', '資料', 'person'], ['personality', '個性', 'heart'], ['tastes', '喜好', 'apple'], ['speech', '說話', 'chat'], ['lines', '台詞', 'chat'], ['inter', '互動', 'paw'], ['events', '事件', 'film']];
  const PREVIEW = [['idle', '待機'], ['walk', '走路'], ['happy', '開心'], ['jump', '跳'], ['wave', '揮手'], ['sit', '坐下'], ['sleep', '睡覺'], ['sad', '難過']];

  // ===================================================================== the page
  Pg().define('charedit', '編輯角色', {
    sub: true, fixed: true,
    headRight: (p) => h('div.hstack', { style: { gap: 0 } },
      h('button.icon-btn', { 'aria-label': '復原', on: { click: () => p.hist && p.hist.undo() && layout(p, true) } }, icon('undo')),
      h('button.icon-btn', { 'aria-label': '重做', on: { click: () => p.hist && p.hist.redo() && layout(p, true) } }, icon('redo')),
      h('button.btn.s.primary', { 'data-act': 'save', on: { click: () => saveEdit(p) } }, '儲存')),
    build(p, el) {
      p.stage = OC.CharEdit.stage(() => p.draft, { size: 260, onPart: (part, live) => { if (!live) { p.hist.commit(); p.dirty = true; } if (p.ctx && p.ctx.partsRefresh && !live) p.ctx.partsRefresh(); } });
      p.table = OC.Frame16.table(() => p.draft, { onChange: (live) => { p.dirty = true; if (p.draft) p.draft.updated = Date.now(); if (!live) p.hist.commit(); } });
      p.say = h('div.st-say', { 'aria-live': 'polite' });
      p.view = h('div.st-view'); p.strip = h('div.st-strip', { role: 'toolbar', 'aria-label': '預覽動作' });
      p.top = h('div.st-top', null, p.view, p.say, p.strip);
      p.tabsEl = h('div.st-tabs', { role: 'tablist', 'aria-label': '編輯分類' });
      p.panel = h('div.st-panel');
      el.append(p.top, p.tabsEl, p.panel);
    },
    refresh(p) {
      const c = Ch().get(p.params.id) || Ch().active(); p.params.id = c.id;
      if (p.draft && p.draft.id !== c.id) p.tab = null;   /* another character: start at its first tab */
      if (!p.draft || p.draft.id !== c.id || !p.dirty) { p.draft = Ch().clone(c); p.dirty = false; p.hist = U().history(() => p.draft, (v) => { p.draft = v; }); }
      p.tab = p.params.tab || (p.draft && p.tab && tabsOf(p.draft).some((t) => t[0] === p.tab) ? p.tab : null) || tabsOf(p.draft)[0][0]; p.params.tab = null; p.lv = p.lv || 'simple';
      p.el.querySelector('h1').textContent = `編輯・${Ch().name(c)}`;
      layout(p); p.stage.restart();
    },
  });
  const tabsOf = (c) => (isImg(c) ? TABS_IMG : TABS_RIG);

  function layout(p, keepScroll) {
    const c = p.draft, tabs = tabsOf(c); if (!tabs.some((t) => t[0] === p.tab)) p.tab = tabs[0][0];
    const frame = p.tab === 'frame';
    const was = p.view.firstChild; p.view.replaceChildren(frame ? p.table.el : p.stage.el); p.table.pause(!frame); p.top.classList.toggle('framing', frame);
    if (!frame && was !== p.stage.el) p.stage.restart();   /* the stage stops while detached: start it again (else it shows the last frame it drew) */
    p.strip.replaceChildren(...(frame ? [] : PREVIEW.map(([a, zh]) => h('button.chip-btn', { 'data-prev': a, on: { click: () => { haptic(); p.stage.react(a, 1.8); } } }, zh))));
    p.tabsEl.replaceChildren(...tabs.map(([k, zh, s]) => h('button.st-tab' + (k === p.tab ? '.on' : ''), { role: 'tab', 'aria-selected': String(k === p.tab), 'data-tab': k, on: { click: () => { if (p.tab === k) return; haptic(); p.tab = k; layout(p); } } }, h('span.st-tab-ic', null, stk(s)), h('small', null, zh))));
    rebuild(p, keepScroll);
    { const on = p.tabsEl.querySelector('.on'); if (on) { const L = on.offsetLeft - 8, R = on.offsetLeft + on.offsetWidth + 8; if (L < p.tabsEl.scrollLeft) p.tabsEl.scrollLeft = L; else if (R > p.tabsEl.scrollLeft + p.tabsEl.clientWidth) p.tabsEl.scrollLeft = R - p.tabsEl.clientWidth; } }
    if (frame) requestAnimationFrame(() => p.table.redraw());
  }
  function rebuild(p, keepScroll) {
    const S_ = OC.CharEdit.sections, c = p.draft, top = p.panel.scrollTop;
    p.ctx = { level: p.lv, stage: p.stage, selected: p.ctx && p.ctx.selected, full: true, rebuild: () => rebuild(p, true),
      changed: (kind, react, live) => { c.updated = Date.now(); p.dirty = true; if (!live) p.hist.commit(); if (react) p.stage.react(react, 1.3); if (p.tab === 'frame') p.table.redraw(); },
      say: (text) => sayOnStage(p, text) };
    p.stage.select(p.tab === 'parts' ? p.ctx.selected : null);
    const lv = () => h('div.st-level', null, U().seg([['simple', '簡易'], ['detailed', '詳細']], p.lv, (v) => { p.lv = v; rebuild(p, true); }));
    const parts = {
      look: () => [lv(), S_.template(c, p.ctx), p.lv === 'detailed' ? S_.body(c, p.ctx) : null, S_.face(c, p.ctx), S_.earsTail(c, p.ctx), S_.colors(c, p.ctx), S_.outfit(c, p.ctx), S_.expressions(c, p.ctx)],
      frame: () => [OC.Frame16.panel(c, p.ctx, p.table)],
      parts: () => [S_.parts(c, p.ctx)], profile: () => [lv(), S_.profile(c, p.ctx)],
      personality: () => [S_.personality(c, p.ctx), S_.traits(c, p.ctx), S_.quirks(c, p.ctx)], tastes: () => [S_.tastes(c, p.ctx)], speech: () => [S_.speech(c, p.ctx)],
      lines: () => [linesPanel(c, p.ctx)], inter: () => [interPanel(c, p.ctx)], events: () => [eventsPanel(c, p.ctx, p)],
      anims: () => [isImg(c) ? animsPanel(c, p.ctx, p) : S_.anims(Ch().get(c.id) || c, p.ctx)],
    };
    p.panel.replaceChildren(...(parts[p.tab] || parts.profile)().filter(Boolean));
    p.panel.scrollTop = keepScroll ? top : 0;
  }
  function sayOnStage(p, text) { p.say.textContent = text; p.say.classList.remove('on'); void p.say.offsetWidth; p.say.classList.add('on'); clearTimeout(p.sayT); p.sayT = setTimeout(() => p.say.classList.remove('on'), 2600); p.stage.react('talk', 1.6); }
  function saveEdit(p) {
    const d = p.draft; if (!d.profile.name.trim()) { toast('角色需要名字', 'edit'); p.tab = 'profile'; layout(p); return; }
    const live = Ch().get(d.id); d.actions = live ? live.actions : d.actions;   // animations are owned by the studio
    Ch().save(Ch().clone(d)); p.dirty = false; p.hist.reset(); toast('已儲存', 'check'); haptic('confirm');
    if (OC.Will && OC.Will.sync) OC.Will.sync(); if (OC.Script) OC.Script.reset();
  }

  // ===================================================================== 動畫 (pictures): source, checkboxes, batch import
  const ACTS = () => Ch().ACTIONS.filter((a) => a[2] !== 'overlay');
  function animsPanel(c, x, p) {
    const live = () => Ch().get(c.id) || c;
    const A16 = () => (c.appearance.anim16 = Object.assign({ src: 'mixed', preset: {} }, c.appearance.anim16 || {}));
    const sel = p.sel16 || (p.sel16 = new Set());
    const box = h('div.an16');
    const own = (a) => { const m = live().actions[a]; return !!(m && Object.values(m).some((id) => OC.Anim.get(id))); };
    const draw = () => {
      const a16 = A16(), src = a16.src;
      const choose = (v, t, d) => h('button.an16-src' + (src === v ? '.on' : ''), { 'data-src': v, role: 'radio', 'aria-checked': String(src === v), on: { click: () => { haptic(); A16().src = v; x.changed('look', 'happy'); draw(); } } }, h('b', null, t), h('small', null, d));
      const rows = h('div.an16-list'), more = p.an16more;
      const COMMON = ['idle', 'walk', 'run', 'jump', 'sit', 'sleep', 'happy', 'sad', 'angry', 'surprised', 'shy', 'eat', 'drink', 'wave', 'talk', 'cheer', 'cry', 'think', 'read', 'dance', 'hug', 'pat', 'nod', 'bow'];
      const listA = ACTS().filter(([a]) => more || COMMON.includes(a) || own(a));
      for (const [a, zh] of listA) {
        const has = own(a), forced = a16.preset[a] && a !== 'idle', uses = src === 'preset' ? (a === 'idle' && has ? '用你的圖' : '預設表演') : src === 'custom' ? (has ? '你的動畫' : '用最接近的自訂動作') : has && !forced ? '你的動畫' : '預設表演';
        const cb = h('input', { type: 'checkbox', checked: sel.has(a), 'aria-label': '選取' + zh, on: { change: (e) => { if (e.target.checked) sel.add(a); else sel.delete(a); count.textContent = sel.size ? `已選 ${sel.size} 個` : ''; } } });
        rows.append(h('label.an16-row' + (has ? '.has' : ''), { 'data-act': a }, cb, h('span.grow', null, h('b', null, zh), h('small', null, uses)),
          h('button.btn.s.ghost', { on: { click: (e) => { e.preventDefault(); OC.Studio.open({ charId: c.id, action: a, docId: has ? Object.values(live().actions[a])[0] : null }); } } }, has ? '編輯' : '製作')));
      }
      const count = h('small.faint', null, sel.size ? `已選 ${sel.size} 個` : '');
      const all = () => { for (const [a] of ACTS()) sel.add(a); draw(); }, none = () => { sel.clear(); draw(); }, inv = () => { for (const [a] of ACTS()) { if (sel.has(a)) sel.delete(a); else sel.add(a); } draw(); };
      const bulk = (fn, msg) => () => { if (!sel.size) { toast('先勾選動作（可以按「全選」）', 'info'); return; } fn([...sel]); x.changed('look', 'happy'); toast(msg, 'check'); draw(); };
      box.replaceChildren(
        T('動作從哪裡來', '可以隨時切換'),
        h('div.an16-srcs', { role: 'radiogroup' }, choose('preset', '全部用預設', '只用你的圖片，所有動作由它自己表演（搖擺、彈跳、特效）'), choose('mixed', '混合（建議）', '有自己做的動作就用你的，沒有的用預設表演'), choose('custom', '全部自己匯入', '只播你做的動畫，像動畫工作室；沒做的動作用最接近的自訂動作')),
        T('各動作', '勾選後可以一次處理'),
        h('div.an16-bar', null, h('button.btn.s', { 'data-bulk': 'all', on: { click: all } }, '全選'), h('button.btn.s.ghost', { on: { click: none } }, '全不選'), h('button.btn.s.ghost', { on: { click: inv } }, '反選'), count),
        h('div.an16-bulk', null,
          h('button.btn.s', { 'data-bulk': 'preset', on: { click: bulk((l) => l.forEach((a) => { A16().preset[a] = true; }), '已改用預設表演') } }, '改用預設'),
          h('button.btn.s', { 'data-bulk': 'own', on: { click: bulk((l) => l.forEach((a) => { delete A16().preset[a]; }), '有自己動畫的就用自己的') } }, '改用我的'),
          h('button.btn.s', { 'data-bulk': 'import', on: { click: () => { if (!sel.size) { toast('先勾選動作', 'info'); return; } batchImport(c, x, [...sel], () => draw()); } } }, icon('plus', 's'), '匯入到選取的'),
          h('button.btn.s.ghost', { 'data-bulk': 'clear', on: { click: async () => { if (!sel.size) { toast('先勾選動作', 'info'); return; } if (!(await U().confirm('清除選取的動畫', `會移除 ${sel.size} 個動作的自訂動畫（圖片仍在素材庫）。`, '清除', true))) return; const L = live(); for (const a of sel) { if (a === 'idle') continue; delete L.actions[a]; delete c.actions[a]; } Ch().save(L); x.changed('look', 'idle'); draw(); } } }, '清除選取的')),
        rows,
        h('button.btn.s.ghost.block', { style: { marginTop: '6px' }, on: { click: () => { p.an16more = !p.an16more; draw(); } } }, more ? '只顯示常用的動作' : `顯示全部 ${ACTS().length} 個動作（全選一直包含全部）`),
        T('一次匯入很多動作', '用檔名對應動作'),
        h('p.faint', { style: { fontSize: 'var(--fs-xs)', margin: '0 0 6px' } }, '例如 walk_01.png、walk_02.png、jump.gif、走路1.png、開心.webp：同一個名字的檔案會變成同一個動作的影格。認不出來的會讓你選。'),
        h('button.btn.block', { 'data-act': 'batch', on: { click: () => batchImport(c, x, null, () => draw()) } }, icon('plus', 's'), '選擇檔案…'));
    };
    draw(); return box;
  }
  /** files → groups by name → actions; then frames → animation docs (with the same background removal as the character) */
  function groupFiles(files) {
    const ACT = ACTS(), byKey = new Map(ACT.map(([a, zh]) => [a.toLowerCase(), a])), byZh = new Map(ACT.map(([a, zh]) => [zh, a]));
    const g = new Map();
    for (const f of files) {
      const stem = f.name.replace(/\.[^.]+$/, '').trim(), base = stem.replace(/[\s_\-.#]*\(?\d+\)?$/, '').trim(), k = base.toLowerCase();
      const act = byKey.get(k) || byZh.get(base) || ACT.find(([a, zh]) => k.startsWith(a.toLowerCase() + '_') || base.startsWith(zh))?.[0] || null;
      const key = act || base || stem; if (!g.has(key)) g.set(key, { name: base || stem, act, files: [] }); g.get(key).files.push(f);
    }
    return [...g.values()];
  }
  async function batchImport(c, x, onlyActs, done) {
    const files = await OC.Library.chooseFiles({ multiple: true, accept: 'image/*,.gif,.png,.webp,.zip' }); if (!files || !files.length) return;
    let groups = groupFiles(files);
    if (onlyActs && onlyActs.length) {
      /* importing into the checked actions: one group per checked action, in order (or all files to the only one checked) */
      if (onlyActs.length === 1) groups = [{ name: onlyActs[0], act: onlyActs[0], files: [...files] }];
      else groups = groups.map((gq, i) => Object.assign(gq, { act: gq.act && onlyActs.includes(gq.act) ? gq.act : onlyActs[i] || null }));
    }
    const unknown = groups.filter((gq) => !gq.act);
    if (unknown.length) { const ok = await mapSheet(unknown); if (!ok) return; }
    const live = Ch().get(c.id) || c; const cut = OC.Frame16.docsOf(live).find((d) => d.cut16); let n = 0;
    for (const gq of groups) {
      if (!gq.act || gq.act === '__skip') continue;
      try {
        const { frames } = await OC.Library.framesFromFiles(gq.files);
        let cs = frames.map((f) => f.canvas);
        cs = cs.map((k) => (cut && cut.cut16.on !== false ? OC.Cutout.remove(k, { tol: cut.cut16.tol }) : OC.Cutout.detect(k).has ? OC.Cutout.remove(k, {}) : k));
        cs = OC.IO.normalizeFrames(cs.map((k) => OC.IO.trim(k)));
        const { doc } = await OC.Library.makeAnim(cs, { name: (Ch().ACTION_ZH && Ch().ACTION_ZH[gq.act]) || gq.act, owner: c.id, action: gq.act, delays: frames.map((f) => f.delay) });
        live.actions[gq.act] = { any: doc.id }; c.actions[gq.act] = { any: doc.id }; if (c.appearance.anim16 && c.appearance.anim16.preset) delete c.appearance.anim16.preset[gq.act]; n++;
      } catch (e) { toast(`${gq.name}：${e.message}`, 'info'); }
    }
    if (n) { Ch().save(live); toast(`已匯入 ${n} 個動作`, 'check'); x.changed('look', 'happy'); }
    done && done();
  }
  /** the names we could not read: pick an action for each (or skip) — one sheet, no chain of popups */
  function mapSheet(groups) {
    return new Promise((res) => {
      let ok = false;
      U().sheet('這些檔案是哪個動作？', (b, api) => {
        const opts = [['__skip', '略過']].concat(ACTS().map(([a, zh]) => [a, zh]));
        for (const gq of groups) b.append(h('div.hstack', { style: { margin: '6px 0', gap: '8px' } }, h('span.grow', null, h('b', null, gq.name), h('small.faint', null, ` ${gq.files.length} 張`)),
          h('select', { 'aria-label': gq.name + '的動作', on: { change: (e) => { gq.act = e.target.value; } } }, h('option', { value: '' }, '選擇…'), ...opts.map(([v, l]) => h('option', { value: v }, l)))));
        b.append(h('button.btn.primary.block', { style: { marginTop: '10px' }, on: { click: () => { if (groups.some((gq) => !gq.act)) { toast('每一組都要選（或略過）', 'info'); return; } ok = true; api.close(); } } }, '匯入'));
        if (OC.Pick) OC.Pick.guard(b);
      }, { onClose: () => res(ok) });
    });
  }

  // ===================================================================== 台詞
  const SITS = [
    ['打招呼', [['greet', '遇到別人時打招呼'], ['greet_r', '回應別人的招呼'], ['bye', '道別'], ['arrive', '到了一個地方']]],
    ['聊天', [['talk', '開一個話題'], ['talk_r', '回應閒聊'], ['chat_player', '對你說的話'], ['share', '分享一件事'], ['share_r', '聽別人分享'], ['joke', '說笑話'], ['laugh', '被逗笑'], ['compliment', '稱讚別人'], ['compliment_r', '被稱讚']]],
    ['和你', [['pet', '被你摸摸'], ['pet_dislike', '被摸到不喜歡的地方'], ['call', '被你叫過來'], ['prank_ok', '被丟高高（喜歡）'], ['prank_bad', '被丟出去（不喜歡）'], ['receive', '收到東西']]],
    ['吃東西', [['fed_like', '吃到喜歡的'], ['fed_ok', '吃到普通的'], ['fed_bad', '吃到不喜歡的'], ['react_yum', '好吃'], ['react_yuck', '難吃']]],
    ['一個人時', [['solo_rest', '休息時'], ['solo_read', '看書時'], ['solo_daydream', '發呆時'], ['solo_walk', '散步時'], ['solo_eat', '吃東西時'], ['solo_need', '需要什麼時']]],
    ['邀約', [['invite', '邀請別人'], ['accept', '答應邀請'], ['decline', '拒絕邀請'], ['declined', '被拒絕之後']]],
    ['關係', [['comfort', '安慰別人'], ['comfort_r', '被安慰'], ['argue', '吵架'], ['argue_r', '被吵'], ['apologize', '道歉'], ['forgive', '原諒']]],
    ['桌寵', [['desk_idle', '在桌面上閒晃'], ['desk_tap', '在桌面上被點'], ['desk_drag', '在桌面上被抓起來'], ['desk_wake', '在桌面上被叫醒']]],
  ];
  const EMO_OPTS = () => [['', '任何心情']].concat(Object.entries(OC.LifeData.EMOTIONS).map(([k, v]) => [k, v.zh]));
  const PHASE_OPTS = [['', '任何時候'], ['morning', '早上'], ['day', '白天'], ['evening', '傍晚'], ['night', '晚上']];
  function linesPanel(c, x) {
    const L = () => (c.lines16 = c.lines16 || []), mode = () => (c.lines16mode = c.lines16mode || {});
    const open = x.open16 || (x.open16 = new Set());
    const box = h('div.ln16');
    const sel = (opts, v, fn, label) => h('select', { 'aria-label': label, on: { change: (e) => fn(e.target.value) } }, ...opts.map(([k, zh]) => h('option', { value: k, selected: k === (v || '') }, zh)));
    const draw = () => {
      box.replaceChildren(T('角色自己的台詞', '寫在這裡的話只有這個角色會說；會套用說話方式（自稱、句尾、口頭禪）'));
      box.append(h('div.ln16-try', null, h('input', { placeholder: '打一句話，按「試說」聽聽看', maxLength: 60, 'aria-label': '試說的句子', id: 'ln16-try-in' }),
        h('button.btn.s', { on: { click: () => { const v = box.querySelector('#ln16-try-in').value.trim(); if (!v) return; x.say(Ch().speak(c, v, { to: 'player', cat: 'try', rnd: Math.random() })); } } }, '試說')));
      for (const [grp, list] of SITS) {
        box.append(h('div.ln16-grp', null, grp));
        for (const [cat, zh] of list) {
          const mine = L().filter((l) => l.cat === cat), isOpen = open.has(cat);
          const head = h('button.ln16-head' + (isOpen ? '.open' : ''), { 'data-cat': cat, 'aria-expanded': String(isOpen), on: { click: () => { if (isOpen) open.delete(cat); else open.add(cat); draw(); } } }, h('span.grow', null, zh), mine.length ? h('span.tag.accent', null, mine.length + ' 句') : null, mode()[cat] === 'only' ? h('span.tag', null, '只用我的') : null, icon(isOpen ? 'up' : 'down', 's'));
          box.append(head);
          if (!isOpen) continue;
          const body = h('div.ln16-body');
          for (const l of mine) {
            const inp = h('input', { value: l.text, maxLength: 80, 'aria-label': zh + '的台詞', on: { change: (e) => { l.text = e.target.value.slice(0, 80); x.changed('lines'); } } });
            body.append(h('div.ln16-line', null, inp,
              h('div.ln16-cond', null, sel(EMO_OPTS(), l.c && l.c.emo, (v) => { l.c = Object.assign({}, l.c || {}); if (v) l.c.emo = v; else delete l.c.emo; if (!Object.keys(l.c).length) l.c = null; x.changed('lines'); }, '心情'),
                sel(PHASE_OPTS, l.c && l.c.phase, (v) => { l.c = Object.assign({}, l.c || {}); if (v) l.c.phase = v; else delete l.c.phase; if (!Object.keys(l.c).length) l.c = null; x.changed('lines'); }, '時段'),
                h('button.icon-btn', { 'aria-label': '試說這句', on: { click: () => x.say(Ch().speak(c, (l.text || '').replace(/\{other\}/g, '朋友').replace(/\{name\}/g, Ch().name(c)), { to: 'player', cat, rnd: Math.random() })) } }, icon('play', 's')),
                h('button.icon-btn', { 'aria-label': '刪除這句', on: { click: () => { c.lines16 = L().filter((q) => q !== l); x.changed('lines'); draw(); } } }, icon('trash', 's')))));
          }
          body.append(h('div.hstack', { style: { gap: '8px', marginTop: '6px', flexWrap: 'wrap' } },
            h('button.btn.s', { 'data-add': cat, on: { click: () => { L().push({ id: uid(), cat, text: '', c: null }); x.changed('lines'); draw(); setTimeout(() => { const ins = box.querySelectorAll(`.ln16-body .ln16-line input`); ins.length && ins[ins.length - 1].focus(); }, 30); } } }, icon('plus', 's'), '新增一句'),
            h('label.hstack', { style: { gap: '6px' } }, U().toggle(mode()[cat] === 'only', (v) => { if (v) mode()[cat] = 'only'; else delete mode()[cat]; x.changed('lines'); draw(); }), h('small', null, '只用我寫的（不混內建的）'))),
            h('small.faint', null, '可以用 {other}（對方的名字）、{name}（自己的名字）、{place}（地點）。'));
          box.append(body);
        }
      }
    };
    draw(); return box;
  }

  // ===================================================================== 互動
  const TONE_OPTS = [['warm', '溫暖'], ['play', '玩鬧'], ['care', '關心'], ['tease', '捉弄'], ['love', '戀愛（只限成年）'], ['neg', '不友善'], ['mend', '和好']];
  function interPanel(c, x) {
    const I = () => (c.inter16 = c.inter16 || []);
    const box = h('div.in16'), open = x.openI || (x.openI = new Set());
    const actOpts = () => Ch().ACTIONS.map((a) => [a[0], a[1]]).concat(OC.Anim11 && OC.Anim11.names ? OC.Anim11.names.filter((n) => !Ch().ACTIONS.some((a) => a[0] === n)).map((n) => [n, n]) : []);
    const sel = (opts, v, fn, label) => h('select', { 'aria-label': label, on: { change: (e) => fn(e.target.value) } }, ...opts.map(([k, zh]) => h('option', { value: k, selected: k === v }, zh)));
    const ta = (label, arr, fn) => h('label.in16-ta', null, h('small', null, label), h('textarea', { rows: 2, placeholder: '一行一句', on: { change: (e) => fn(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 12)) } }, (arr || []).join('\n')));
    const draw = () => {
      box.replaceChildren(T('專屬互動', '只有這個角色會做；對方用意願模型決定反應（可能答應、害羞、拒絕…）'));
      for (const it of I()) {
        const isOpen = open.has(it.id);
        box.append(h('button.ln16-head' + (isOpen ? '.open' : ''), { 'data-inter': it.id, on: { click: () => { if (isOpen) open.delete(it.id); else open.add(it.id); draw(); } } }, h('span', null, it.ic || '✨'), h('span.grow', null, it.zh || '（未命名）'), it.off ? h('span.tag', null, '停用') : null, icon(isOpen ? 'up' : 'down', 's')));
        if (!isOpen) continue;
        const ch = () => x.changed('inter');
        const relS = (k, zh) => OC.UI.slider({ zh }, (it.rel || {})[k] || 0, (v) => { it.rel = Object.assign({}, it.rel || {}); it.rel[k] = Math.round(v); ch(); }, { min: -10, max: 10, step: 1, fmt: (v) => (v > 0 ? '+' : '') + Math.round(v) });
        box.append(h('div.in16-body', null,
          h('div.hstack', { style: { gap: '8px' } }, h('input', { value: it.ic || '✨', maxLength: 2, style: { width: '52px', textAlign: 'center' }, 'aria-label': '圖示', on: { change: (e) => { it.ic = e.target.value || '✨'; ch(); } } }), h('input.grow', { value: it.zh || '', maxLength: 14, placeholder: '名稱，例如：比心', 'aria-label': '名稱', on: { change: (e) => { it.zh = e.target.value.trim(); ch(); draw(); } } })),
          h('div.in16-grid', null, h('label', null, h('small', null, '性質'), sel(TONE_OPTS, it.tone || 'warm', (v) => { it.tone = v; ch(); }, '性質')),
            h('label', null, h('small', null, '自己的動作'), sel(actOpts(), it.animA || 'talk', (v) => { it.animA = v; ch(); }, '自己的動作')),
            h('label', null, h('small', null, '對方答應時的動作'), sel(actOpts(), it.animB || 'nod', (v) => { it.animB = v; ch(); }, '對方的動作'))),
          OC.UI.slider({ zh: '親密程度（越高越需要熟）' }, Math.round((it.intim == null ? 0.2 : it.intim) * 100), (v) => { it.intim = Math.round(v) / 100; ch(); }, { min: 0, max: 100, step: 5, fmt: (v) => Math.round(v) }),
          T('對方答應時，關係的變化'), relS('aff', '好感'), relS('fam', '熟悉'), relS('trust', '信任'),
          h('input', { value: it.mem || '', maxLength: 60, placeholder: '對方會記住的回憶（可留空），例如：{other}對我比了一個心', 'aria-label': '回憶', on: { change: (e) => { it.mem = e.target.value.trim(); ch(); } } }),
          T('台詞'), ta('自己說的', (it.lines || {}).ask, (v) => { it.lines = Object.assign({}, it.lines || {}); it.lines.ask = v; ch(); }), ta('對方答應時說的', (it.lines || {}).yes, (v) => { it.lines = Object.assign({}, it.lines || {}); it.lines.yes = v; ch(); }), ta('對方拒絕時說的（留空＝用內建的反應）', (it.lines || {}).no, (v) => { it.lines = Object.assign({}, it.lines || {}); it.lines.no = v; ch(); }),
          h('div.hstack', { style: { gap: '8px', marginTop: '8px', flexWrap: 'wrap' } },
            h('label.hstack', { style: { gap: '6px' } }, U().toggle(!it.off, (v) => { it.off = !v; ch(); }), h('small', null, '啟用')),
            h('div.grow'), h('button.btn.s.ghost', { on: { click: async () => { if (!(await U().confirm('刪除這個互動', it.zh || '', '刪除', true))) return; c.inter16 = I().filter((q) => q !== it); ch(); draw(); } } }, icon('trash', 's'), '刪除')),
          h('small.faint', null, '按右上角「儲存」後，點別的角色的選單裡會出現在「專屬」。')));
      }
      box.append(h('button.btn.block', { 'data-act': 'add-inter', style: { marginTop: '10px' }, on: { click: () => { const it = { id: uid(), zh: '', ic: '✨', tone: 'warm', intim: 0.2, animA: 'wave', animB: 'happy', rel: { aff: 3, fam: 2 }, lines: { ask: [], yes: [], no: [] } }; I().push(it); open.add(it.id); x.changed('inter'); draw(); } } }, icon('plus', 's'), '新增專屬互動'));
    };
    draw(); return box;
  }

  // ===================================================================== 事件
  function eventsPanel(c, x, p) {
    const box = h('div.ev16');
    const list = () => (c.scripts16 = c.scripts16 || []);
    const draw = () => {
      box.replaceChildren(T('自訂事件', '條件成立時角色會自己演；不限數量；可以匯入腳本'));
      box.append(h('div.ev16-bar', null,
        h('button.btn.s.primary', { 'data-act': 'new-ev', on: { click: () => editor({ src: blankSrc(c), owner: c.id }, (src) => { list().push({ id: 's' + uid(), src, on: true }); x.changed('events'); draw(); }) } }, icon('plus', 's'), '新增'),
        h('button.btn.s', { on: { click: () => editor({ src: OC.Script.TEMPLATE, owner: c.id }, (src) => { list().push({ id: 's' + uid(), src, on: true }); x.changed('events'); draw(); }) } }, '從範例開始'),
        h('button.btn.s', { 'data-act': 'import-ev', on: { click: () => importScripts((items) => { for (const it of items) list().push({ id: 's' + uid(), src: it.src, on: !it.errors.length }); x.changed('events'); draw(); }) } }, '匯入腳本'),
        h('button.btn.s.ghost', { on: { click: () => exportScripts(c) } }, '匯出')));
      if (!list().length) box.append(h('div.empty', null, '還沒有事件。按「新增」用積木做一個，或「匯入腳本」。'));
      for (const s of list()) {
        const r = OC.Script.compile(s.src, { owner: c.id }), evs = r.events;
        box.append(h('div.ev16-item' + (r.errors.length ? '.bad' : ''), { 'data-sid': s.id },
          h('div.grow', null, h('b', null, evs.map((e) => e.zh).join('、') || '（沒有事件）'), h('small', null, r.errors.length ? `⚠ ${r.errors.length} 個錯誤（第 ${r.errors[0].line} 行：${r.errors[0].msg}）` : evs.map((e) => OC.Script.TRIG_ZH[e.trigger]).join('、') + (r.warns.length ? `・${r.warns.length} 個提醒` : ''))),
          U().toggle(s.on !== false && !r.errors.length, (v) => { if (v && r.errors.length) { toast('有錯誤，修好才能啟用', 'info'); draw(); return; } s.on = v; x.changed('events'); }),
          h('button.btn.s.ghost', { on: { click: () => editor({ src: s.src, owner: c.id }, (src) => { s.src = src; s.on = !OC.Script.compile(src).errors.length; x.changed('events'); draw(); }, async () => { c.scripts16 = list().filter((q) => q !== s); x.changed('events'); draw(); }) } }, '編輯')));
      }
      const isle = OC.Script.lib();
      box.append(T('全島的事件', `${isle.length} 個（匯入時沒指定角色的）`));
      for (const s of isle) { const r = OC.Script.compile(s.src); box.append(h('div.ev16-item' + (r.errors.length ? '.bad' : ''), null, h('div.grow', null, h('b', null, r.events.map((e) => e.zh).join('、') || '（沒有事件）'), h('small', null, r.errors.length ? `⚠ ${r.errors.length} 個錯誤` : '全島')), U().toggle(s.on !== false && !r.errors.length, (v) => { s.on = v; OC.Script.reset(); OC.Store.touch('life', { scripts: true }); }), h('button.btn.s.ghost', { on: { click: () => editor({ src: s.src }, (src) => { s.src = src; OC.Script.reset(); OC.Store.touch('life', { scripts: true }); draw(); }, async () => { const L = OC.Script.lib(); L.splice(L.indexOf(s), 1); OC.Script.reset(); OC.Store.touch('life', { scripts: true }); draw(); }) } }, '編輯'))); }
      box.append(h('button.btn.s.ghost', { style: { marginTop: '6px' }, on: { click: () => importScripts((items) => { for (const it of items) OC.Script.lib().push({ id: 's' + uid(), src: it.src, on: !it.errors.length }); OC.Script.reset(); OC.Store.touch('life', { scripts: true }); draw(); }) } }, '匯入到全島'),
        h('p.faint', { style: { fontSize: 'var(--fs-xs)' } }, '腳本是純文字資料，不能執行程式碼；匯入時每一行都會檢查，有錯會告訴你第幾行。格式說明：docs/oc-script.md。'));
    };
    draw(); return box;
  }
  function blankSrc(c) { return `event my_event_${uid()} "新的事件"\ntrigger tick\ncast A = self\ncast B = any\nwhen near A B 120\nchance 0.3\ncooldown 240\n---\nface A B\nsay A "嗨，{B}。"\nsay B "嗨。"\n`; }
  async function importScripts(onOk) {
    const files = await OC.Library.chooseFiles({ multiple: true, accept: '.ocs,.txt,.json,text/plain,application/json' }); if (!files || !files.length) return;
    const items = []; const report = [];
    for (const f of files) { const text = await f.text(); const r = OC.Script.parseFile(text); if (r.error) { report.push(`${f.name}：${r.error}`); continue; } for (const it of r.items) { items.push(it); if (it.errors.length) report.push(`${f.name}：${it.errors.slice(0, 3).map((e) => `第 ${e.line} 行 ${e.msg}`).join('；')}`); } }
    if (!items.length) { U().sheet('沒有匯入', (b) => b.append(...report.map((t) => h('p', null, t)))); return; }
    onOk(items);
    const good = items.filter((i) => !i.errors.length).length, nEv = items.reduce((s, i) => s + i.events.length, 0);
    if (report.length) U().sheet('匯入結果', (b) => b.append(h('p', null, `匯入 ${items.length} 個腳本（${nEv} 個事件），${good} 個沒有錯誤；有錯的先停用，修好再開。`), ...report.map((t) => h('p.faint', null, t))));
    else toast(`已匯入 ${items.length} 個腳本、${nEv} 個事件`, 'check');
  }
  function exportScripts(c) {
    const data = JSON.stringify({ format: 'ocshimeji-script', version: 1, app: 'OC Shimeji', created: new Date().toISOString(), scripts: (c.scripts16 || []).map((s) => ({ src: s.src, on: s.on !== false })) }, null, 2);
    if (OC.IO && OC.IO.deliver) OC.IO.deliver(new Blob([data], { type: 'application/json' }), `${Ch().name(c)}-事件.json`); else toast('無法匯出', 'info');
  }

  // ---------------------------------------------------------------- the script editor: blocks ⇄ source
  /* one full-screen tool (an advanced feature: the only place in the studio that opens over the page). Its own back button asks
   * before throwing away changes; a close from outside (layer.close) never asks (see 15.4: a confirm there loops). */
  const BLOCKS = [
    ['say', '說', [['r', 'role'], ['text', 'text']]], ['think', '心想', [['r', 'role'], ['text', 'text']]], ['narrate', '旁白', [['text', 'text']]],
    ['move', '走到', [['r', 'role'], ['to', 'target']]], ['run', '跑到', [['r', 'role'], ['to', 'target']]], ['face', '面向', [['r', 'role'], ['to', 'facing']]],
    ['anim', '動作', [['r', 'role'], ['act', 'action'], ['sec', 'num']]], ['emote', '表情符號', [['r', 'role'], ['e', 'emote']]], ['wait', '等待', [['sec', 'num']]],
    ['cam', '鏡頭', [['r', 'camrole'], ['zoom', 'num']]], ['fade', '淡出／淡入', [['dir', 'fade']]], ['bars', '電影黑邊', [['on', 'onoff']]],
    ['choice', '選項', [['text', 'text'], ['opts', 'opts']]], ['label', '標籤', [['name', 'word']]], ['goto', '跳到', [['to', 'word']]], ['if', '如果', [['cond', 'line'], ['to', 'word']]],
    ['set', '設定', [['kind', 'fv'], ['name', 'word'], ['n', 'num']]], ['add', '增加變數', [['name', 'word'], ['n', 'num']]],
    ['rel', '關係變化', [['a', 'role'], ['b', 'role'], ['d', 'line']]], ['feel', '情緒', [['r', 'role'], ['emo', 'emotion'], ['k', 'num']]],
    ['remember', '記住', [['r', 'role'], ['o', 'role'], ['text', 'text']]], ['end', '結束', []], ['raw', '其他（原文）', [['line', 'line']]],
  ];
  const BZH = Object.fromEntries(BLOCKS.map((b) => [b[0], b[1]]));
  const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '”') + '"';
  /** source → { head: [lines], blocks: [{ op, …fields }] } (round trip; unknown lines become 'raw') */
  function toBlocks(src) {
    const lines = String(src).replace(/\r/g, '').split('\n'); const i = lines.findIndex((l) => l.trim() === '---' || l.trim() === 'steps' || l.trim() === '步驟');
    const head = (i < 0 ? lines : lines.slice(0, i)).filter((l) => l.trim()); const body = i < 0 ? [] : lines.slice(i + 1); const blocks = [];
    for (const raw of body) {
      const s = raw.trim(); if (!s) continue; const tk = OC.Script.words(s); if (tk.err) { blocks.push({ op: 'raw', line: s }); continue; }
      const w = tk.w, v = w.map((x) => x.v), k = v[0];
      if (w[0].q && (v[1] === '->' || v[1] === '→') && blocks.length && blocks[blocks.length - 1].op === 'choice') { blocks[blocks.length - 1].opts.push({ text: v[0], go: v[2] || '' }); continue; }
      const tq = (j) => (w[j] && w[j].q ? w[j].v : null);
      if ((k === 'say' || k === 'think') && /^[A-F]$/.test(v[1]) && tq(2) != null && v.length === 3) blocks.push({ op: k, r: v[1], text: tq(2) });
      else if (k === 'narrate' && tq(1) != null) blocks.push({ op: 'narrate', text: tq(1) });
      else if ((k === 'move' || k === 'run') && /^[A-F]$/.test(v[1])) blocks.push({ op: k, r: v[1], to: v.slice(v[2] === 'to' ? 3 : 2).join(' ') });
      else if (k === 'face' && v.length === 3) blocks.push({ op: 'face', r: v[1], to: v[2] });
      else if (k === 'anim' && v.length >= 3) blocks.push({ op: 'anim', r: v[1], act: v[2], sec: v[3] || '' });
      else if (k === 'emote' && v.length === 3) blocks.push({ op: 'emote', r: v[1], e: v[2] });
      else if (k === 'wait' && v.length === 2) blocks.push({ op: 'wait', sec: v[1] });
      else if (k === 'cam') blocks.push({ op: 'cam', r: v[1], zoom: v[2] || '' });
      else if (k === 'fade' && v.length === 2) blocks.push({ op: 'fade', dir: v[1] });
      else if (k === 'bars' && v.length === 2) blocks.push({ op: 'bars', on: v[1] });
      else if (k === 'choice' && tq(1) != null) blocks.push({ op: 'choice', text: tq(1), opts: [] });
      else if ((k === 'label' || k === 'goto') && v.length === 2) blocks.push(k === 'label' ? { op: 'label', name: v[1] } : { op: 'goto', to: v[1] });
      else if (k === 'if') { const ai = v.findIndex((t) => t === '->' || t === '→'); if (ai > 1) blocks.push({ op: 'if', cond: w.slice(1, ai).map((t) => (t.q ? q(t.v) : t.v)).join(' '), to: v[ai + 1] || '' }); else blocks.push({ op: 'raw', line: s }); }
      else if ((k === 'set' || k === 'unset') && v.length >= 3) blocks.push({ op: 'set', kind: (k === 'unset' ? 'unset ' : '') + v[1], name: v[2], n: v[3] || '' });
      else if (k === 'add' && v[1] === 'var') blocks.push({ op: 'add', name: v[2], n: v[3] || '1' });
      else if (k === 'rel' && v.length >= 4) { const m = (v[1] || '').match(/^([A-F])<>([A-F])$/); blocks.push(m ? { op: 'rel', a: m[1], b: m[2], both: true, d: v.slice(2).join(' ') } : { op: 'rel', a: v[1], b: v[2], d: v.slice(3).join(' ') }); }
      else if (k === 'feel' && v.length >= 3) blocks.push({ op: 'feel', r: v[1], emo: v[2], k: v[3] || '' });
      else if (k === 'remember' && /^[A-F]$/.test(v[1])) { const o = /^[A-F]$/.test(v[2]) ? v[2] : ''; const ti = o ? 3 : 2; blocks.push({ op: 'remember', r: v[1], o, text: tq(ti) || '', imp: v[ti + 1] || '' }); }
      else if (k === 'end') blocks.push({ op: 'end' });
      else blocks.push({ op: 'raw', line: s });
    }
    return { head, blocks };
  }
  function toSrc(m) {
    const out = m.head.slice(); out.push('---');
    for (const b of m.blocks) {
      switch (b.op) {
        case 'say': case 'think': out.push(`${b.op} ${b.r || 'A'} ${q(b.text)}`); break;
        case 'narrate': out.push(`narrate ${q(b.text)}`); break;
        case 'move': case 'run': out.push(`${b.op} ${b.r || 'A'} to ${b.to || 'B'}`); break;
        case 'face': out.push(`face ${b.r || 'A'} ${b.to || 'B'}`); break;
        case 'anim': out.push(`anim ${b.r || 'A'} ${b.act || 'wave'}${b.sec ? ' ' + b.sec : ''}`); break;
        case 'emote': out.push(`emote ${b.r || 'A'} ${b.e || 'heart'}`); break;
        case 'wait': out.push(`wait ${b.sec || 1}`); break;
        case 'cam': out.push(b.r === 'reset' ? 'cam reset' : `cam ${b.r || 'A'}${b.zoom ? ' ' + b.zoom : ''}`); break;
        case 'fade': out.push(`fade ${b.dir || 'out'}`); break;
        case 'bars': out.push(`bars ${b.on || 'on'}`); break;
        case 'choice': out.push(`choice ${q(b.text)}`); for (const o of b.opts || []) out.push(`  ${q(o.text)} -> ${o.go || 'end'}`); break;
        case 'label': out.push(`label ${b.name || 'here'}`); break;
        case 'goto': out.push(`goto ${b.to || 'here'}`); break;
        case 'if': out.push(`if ${b.cond || 'flag x'} -> ${b.to || 'here'}`); break;
        case 'set': { const un = String(b.kind || 'flag').startsWith('unset'); const kind = String(b.kind || 'flag').replace('unset ', ''); out.push(`${un ? 'unset' : 'set'} ${kind} ${b.name || 'x'}${!un && kind === 'var' ? ' ' + (b.n || 1) : ''}`); break; }
        case 'add': out.push(`add var ${b.name || 'x'} ${b.n || 1}`); break;
        case 'rel': out.push(`rel ${b.both ? b.a + '<>' + b.b : (b.a || 'A') + ' ' + (b.b || 'B')} ${b.d || 'aff +3'}`); break;
        case 'feel': out.push(`feel ${b.r || 'A'} ${b.emo || 'happy'}${b.k ? ' ' + b.k : ''}`); break;
        case 'remember': out.push(`remember ${b.r || 'A'}${b.o ? ' ' + b.o : ''} ${q(b.text)}${b.imp ? ' ' + b.imp : ''}`); break;
        case 'end': out.push('end'); break;
        default: out.push(b.line || '');
      }
    }
    return out.join('\n') + '\n';
  }
  function editor(o, onSave, onDelete) {
    let src = o.src, mode = 'blocks', model = toBlocks(src), dirty = false, closed = false;
    const el = h('div.ev16-ed', { role: 'dialog', 'aria-label': '事件編輯器' });
    const errs = h('div.ev16-errs'), body = h('div.ev16-ed-body');
    const close = () => { if (closed) return; closed = true; U().popLayer(layer); el.remove(); };
    const layer = { scrim: false, close };
    const sync = () => { if (mode === 'blocks') src = toSrc(model); check(); };
    const check = () => { const r = OC.Script.compile(src, { owner: o.owner }); errs.replaceChildren(...(r.errors.length ? r.errors.slice(0, 6).map((e) => h('button.ev16-err', { on: { click: () => goLine(e.line) } }, `第 ${e.line} 行：${e.msg}`)) : [h('div.ev16-ok', null, `✓ ${r.events.length} 個事件，沒有錯誤${r.warns.length ? `（${r.warns.length} 個提醒：${r.warns[0].msg}）` : ''}`)])); return r; };
    const goLine = (n) => { if (mode !== 'source') { mode = 'source'; draw(); } const ta = body.querySelector('textarea'); if (!ta) return; const pos = src.split('\n').slice(0, n - 1).join('\n').length + (n > 1 ? 1 : 0); ta.focus(); ta.setSelectionRange(pos, pos + (src.split('\n')[n - 1] || '').length); };
    const roleSel = (v, fn, extra) => h('select', { on: { change: (e) => fn(e.target.value) } }, ...(extra || []).concat(OC.Script.ROLES).map((r) => h('option', { value: r, selected: r === v }, r)));
    const field = (b, k, type) => {
      const set = (v) => { b[k] = v; dirty = true; sync(); };
      switch (type) {
        case 'role': return roleSel(b[k] || 'A', set);
        case 'camrole': return roleSel(b[k] || 'A', set, ['reset']);
        case 'text': return h('input.grow', { value: b[k] || '', maxLength: 80, placeholder: '文字（可用 {A} {B}）', on: { input: (e) => set(e.target.value) } });
        case 'num': return h('input', { value: b[k] || '', inputmode: 'decimal', style: { width: '64px' }, placeholder: '秒／數字', on: { input: (e) => set(e.target.value.replace(/[^\d.\-+]/g, '')) } });
        case 'word': return h('input', { value: b[k] || '', style: { width: '110px' }, placeholder: '名字', on: { input: (e) => set(e.target.value.replace(/\s/g, '')) } });
        case 'line': return h('input.grow', { value: b[k] || '', placeholder: k === 'd' ? 'aff +5 trust +2' : k === 'cond' ? 'flag met / var x >= 2 / rel A B aff >= 60' : '', on: { input: (e) => set(e.target.value) } });
        case 'target': return h('input', { value: b[k] || '', style: { width: '110px' }, placeholder: 'B／player／120 80', on: { input: (e) => set(e.target.value) } });
        case 'facing': return h('select', { on: { change: (e) => set(e.target.value) } }, ...OC.Script.ROLES.concat(['player', 'left', 'right', 'front', 'back']).map((r) => h('option', { value: r, selected: r === b[k] }, r)));
        case 'action': return h('select', { on: { change: (e) => set(e.target.value) } }, ...Ch().ACTIONS.map((a) => h('option', { value: a[0], selected: a[0] === b[k] }, a[1])));
        case 'emotion': return h('select', { on: { change: (e) => set(e.target.value) } }, ...Object.entries(OC.LifeData.EMOTIONS).map(([k2, v]) => h('option', { value: k2, selected: k2 === b[k] }, v.zh)));
        case 'emote': return h('select', { on: { change: (e) => set(e.target.value) } }, ...['heart', '!', '?', 'note', 'sweat', 'anger', 'zz', '...', 'star', 'idea'].map((x2) => h('option', { value: x2, selected: x2 === b[k] }, x2)));
        case 'fade': return h('select', { on: { change: (e) => set(e.target.value) } }, h('option', { value: 'out', selected: b[k] !== 'in' }, '淡出（變黑）'), h('option', { value: 'in', selected: b[k] === 'in' }, '淡入'));
        case 'onoff': return h('select', { on: { change: (e) => set(e.target.value) } }, h('option', { value: 'on', selected: b[k] !== 'off' }, '開'), h('option', { value: 'off', selected: b[k] === 'off' }, '關'));
        case 'fv': return h('select', { on: { change: (e) => set(e.target.value) } }, ...[['flag', '旗標'], ['var', '變數'], ['unset flag', '清除旗標'], ['unset var', '清除變數']].map(([v, l]) => h('option', { value: v, selected: v === (b[k] || 'flag') }, l)));
        case 'opts': { const box = h('div.ev16-opts'); const drawO = () => { box.replaceChildren(...(b.opts || []).map((op, i) => h('div.hstack', { style: { gap: '6px' } }, h('input.grow', { value: op.text, placeholder: '選項文字', on: { input: (e) => { op.text = e.target.value; dirty = true; sync(); } } }), h('span', null, '→'), h('input', { value: op.go, style: { width: '90px' }, placeholder: '標籤', on: { input: (e) => { op.go = e.target.value.replace(/\s/g, ''); dirty = true; sync(); } } }), h('button.icon-btn', { 'aria-label': '刪除選項', on: { click: () => { b.opts.splice(i, 1); dirty = true; sync(); drawO(); } } }, icon('close', 's')))), (b.opts || []).length < 4 ? h('button.btn.s.ghost', { on: { click: () => { (b.opts = b.opts || []).push({ text: '', go: '' }); dirty = true; sync(); drawO(); } } }, '＋ 選項') : null); }; drawO(); return box; }
        default: return null;
      }
    };
    const draw = () => {
      body.replaceChildren();
      if (mode === 'source') { const ta = h('textarea.ev16-src', { spellcheck: false, 'aria-label': '腳本原始碼', on: { input: (e) => { src = e.target.value; dirty = true; check(); } } }); ta.value = src; body.append(ta); check(); return; }
      model = toBlocks(src);
      const hd = h('textarea.ev16-hd', { spellcheck: false, rows: Math.min(10, model.head.length + 1), 'aria-label': '事件設定', on: { input: (e) => { model.head = e.target.value.split('\n'); dirty = true; src = toSrc(model); check(); } } }); hd.value = model.head.join('\n');
      body.append(h('div.ev16-head', null, h('small', null, '設定：什麼時候（trigger、when、chance、once、cooldown）、誰（cast A = self／any／player／"名字"）、mode cutscene（過場）'), hd));
      model.blocks.forEach((b, i) => {
        const def = BLOCKS.find((x2) => x2[0] === b.op) || BLOCKS[BLOCKS.length - 1];
        body.append(h('div.ev16-blk', { 'data-op': b.op }, h('span.ev16-op', null, BZH[b.op] || b.op), h('div.ev16-fields', null, ...def[2].map(([k, t]) => field(b, k, t)).filter(Boolean)),
          h('div.ev16-mv', null, h('button.icon-btn', { 'aria-label': '上移', disabled: !i, on: { click: () => { model.blocks.splice(i - 1, 0, model.blocks.splice(i, 1)[0]); dirty = true; src = toSrc(model); draw(); } } }, icon('up', 's')), h('button.icon-btn', { 'aria-label': '下移', disabled: i === model.blocks.length - 1, on: { click: () => { model.blocks.splice(i + 1, 0, model.blocks.splice(i, 1)[0]); dirty = true; src = toSrc(model); draw(); } } }, icon('down', 's')), h('button.icon-btn', { 'aria-label': '刪除', on: { click: () => { model.blocks.splice(i, 1); dirty = true; src = toSrc(model); draw(); } } }, icon('close', 's')))));
      });
      const add = h('select.ev16-add', { 'aria-label': '加一個步驟', on: { change: (e) => { const op = e.target.value; if (!op) return; const nb = { op }; if (op === 'choice') nb.opts = [{ text: '好', go: 'yes' }, { text: '不要', go: 'no' }]; model.blocks.push(nb); dirty = true; src = toSrc(model); draw(); body.scrollTop = body.scrollHeight; } } }, h('option', { value: '' }, '＋ 加一個步驟…'), ...BLOCKS.filter((b) => b[0] !== 'raw').map((b) => h('option', { value: b[0] }, b[1])));
      body.append(add); check();
    };
    const seg = U().seg([['blocks', '積木'], ['source', '原始碼']], mode, (v) => { if (mode === 'blocks') src = toSrc(model); mode = v; draw(); });
    el.append(h('div.ev16-ed-top', null,
      h('button.icon-btn', { 'aria-label': '返回', on: { click: async () => { if (dirty && !(await U().confirm('放棄修改？', '這個事件的修改還沒存。', '放棄', true))) return; close(); } } }, icon('back')),
      h('b.grow', null, '事件'), seg,
      h('button.btn.s', { 'data-act': 'try-ev', on: { click: () => { const r = check(); if (r.errors.length) { toast('先修好錯誤', 'info'); return; } if (!o.owner || !Ch().get(o.owner)) { toast('先儲存角色', 'info'); return; } const ev = r.events[0]; ev.key = 'try:' + ev.id; close(); OC.UI.back && Pg().close && Pg().close('charedit'); setTimeout(() => { const res = OC.Script.play(ev); if (!res.ok) toast(res.why, 'info'); }, 400); } } }, '試播'),
      h('button.btn.s.primary', { 'data-act': 'save-ev', on: { click: () => { if (mode === 'blocks') src = toSrc(model); const r = check(); onSave(src); close(); toast(r.errors.length ? '已存（有錯誤，先停用）' : '已存', r.errors.length ? 'info' : 'check'); } } }, '存')),
      errs, body,
      onDelete ? h('button.btn.s.ghost', { style: { margin: '6px 0' }, on: { click: async () => { if (!(await U().confirm('刪除這個事件', '刪除後不能復原。', '刪除', true))) return; await onDelete(); close(); } } }, icon('trash', 's'), '刪除這個事件') : null);
    document.getElementById('app').append(el); U().pushLayer(layer); draw();
  }

  OC.Studio16 = { toBlocks, toSrc, groupFiles, SITS, layout };
})();
