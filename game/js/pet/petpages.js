/* OC Shimeji — Phase 7 pages: the desktop-pet management center and its tools.
 *   petcenter   real service status (from native, never guessed) · permissions (asked only when used) · which OCs go
 *               out (≤ 3) · interaction & bubble settings · performance · links to app context, tools, diagnostics · clear
 *   petone      one OC on the desktop: size, opacity, autonomy, Shimeji moves, drag, double-tap, dialogue (frequency,
 *               mute, own lines, preview), animations (source of every desktop move, map to any of the OC's actions,
 *               preview here, "在桌面測試")
 *   petapps     app-context lines (opt-in, Usage access, package names only): rules per app, exclusions, test, clear
 *   pettools    pomodoro, rest reminder, alarms (AlarmManager; exact only if granted), to-dos, notes
 *   petdiag     service diagnostics + sync log
 * In a desktop browser (no OCNative) every native feature is shown as 未開放 with the reason.
 */
(function () {
  'use strict';
  const { h, icon, toast, sheet, seg, toggle, row, lockedRow, confirm, haptic } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, Pg = () => OC.Pages, Ch = () => OC.Chars, PS = () => OC.PetSync, M = () => OC.Mind;
  const T = (t, s2) => h('div.section-title', null, t, s2 ? h('small', null, s2) : null);
  const card = (...k) => h('div.card', null, ...k);
  const small = (t) => h('div.faint', { style: { fontSize: 'var(--fs-xs)' } }, t);
  const line = (label, ctl, sub) => h('div', { style: { marginTop: '10px' } }, h('div.hstack', null, h('span.grow', null, label), ctl), sub ? small(sub) : null);
  const same = (p, k) => { if (p._sig === k) return true; p._sig = k; return false; };
  const name = (c) => OC.Chars.name(c);
  const N = () => (PS().native() ? window.OCNative : null);
  const P = () => S().pet;
  const av = (c, px = 40) => { const cv = h('canvas', { width: px * 2, height: px * 2 }); cv.style.cssText = `width:${px}px;height:${px}px;flex:none;border-radius:12px;background:var(--surface-2)`; OC.CharRender.portrait(cv, c, { pose: { mouth: 'smile' } }); return cv; };
  const range = (min, max, step, val, label, fn) => h('input', { type: 'range', min, max, step, value: val, 'aria-label': label, style: { width: '100%' }, on: { change: (e) => fn(+e.target.value) } });
  const changed = (why) => { St.touch('pet', { why }); PS().push(why); };
  const STATUS_ZH = { running: ['桌寵在桌面上', 'check'], paused: ['已暫停（不自己走動）', 'pause'], stopped: ['桌寵沒有在桌面上', 'paw'], revoked: ['權限被關閉，桌寵已收起', 'lock'], blocked: ['系統擋下了啟動', 'info'], 'no-permission': ['缺少懸浮視窗權限', 'lock'] };
  const permTag = (ok, txt) => h('span.tag' + (ok ? '.teal' : ''), null, txt || (ok ? '已允許' : '未允許'));

  // ================================================================== center
  Pg().define('petcenter', '桌寵管理', {
    sub: true,
    build(p, el) { p.desk = h('div.pet-desk', { 'aria-label': '桌面預覽' }); p.top = h('div'); p.body = h('div'); el.append(p.desk, p.top, p.body); },
    onShow(p) { clearInterval(p.timer); p.timer = setInterval(() => { if (p.el.classList.contains('open')) p.refresh(p); }, 2000); clearInterval(p.anim); p.t0 = performance.now(); p.anim = setInterval(() => deskDraw(p), 110); },
    onHide(p) { clearInterval(p.timer); clearInterval(p.anim); },
    refresh(p) {
      const n = N(), st = PS().status(), pm = PS().perms(), G = P().global;
      const ids = PS().on(), sig = JSON.stringify([!!n, st && [st.code, st.msg, (st.pets || []).length, st.paused], pm, ids, G, Ch().all().map((c) => c.id + c.updated), P().app.enabled, P().widget]);
      if (same(p, sig)) return;
      desk(p, st);
      if (!n) {
        p.top.replaceChildren(card(h('div.lock-note', null, icon('lock', 's'), '桌寵是 Android 的系統懸浮視窗：需要安裝 Android App。在瀏覽器裡無法顯示在其他 App 上方。')));
        p.body.replaceChildren(T('桌面上的 OC'), pickList(p, false), h('div.list', { style: { marginTop: '12px' } }, lockedRow('paw', '啟動桌寵', '需要 Android App'), lockedRow('phone', 'App 情境對話', '需要 Android App'), lockedRow('clock', '番茄鐘與提醒', '需要 Android App（待辦與筆記可以在這裡用）')),
          h('div.list', { style: { marginTop: '12px' } }, row('check', '待辦與筆記', `${P().tools.todos.filter((t) => !t.done).length} 件待辦`, null, () => Pg().open('pettools'))));
        return;
      }
      const code = st ? st.code : 'stopped', [label, ic] = STATUS_ZH[code] || [code, 'info'], run = code === 'running' || code === 'paused';
      p.top.replaceChildren(card(
        h('div.hstack', null, icon(ic), h('div.grow', null, h('b', null, label), h('div.muted', { style: { fontSize: 'var(--fs-s)' } },
          run ? `${(st.pets || []).map((x) => x.name).join('、')}・${st.fps || 0} fps（上限 ${st.fpsCap}）${st.screenOn === false ? '・螢幕關閉中（已停止繪製）' : ''}` : (st && st.msg) || '按下面的按鈕讓 OC 出現在手機桌面上'))),
        h('button.btn.primary.block', { style: { marginTop: '12px' }, on: { click: async () => {
          if (run) { PS().stop(); toast('桌寵收起來了', 'paw'); }
          else { toast('正在準備桌寵圖像…', 'paw'); const r = await PS().start(); if (!r.ok && r.why !== 'permission') toast(r.why, 'info'); if (r.why === 'permission') toast('請在系統設定開啟「顯示在其他應用程式上層」，回來後再按一次', 'info'); }
          p._sig = ''; setTimeout(() => p.refresh(p), 700);
        } } }, icon(run ? 'close' : 'paw', 's'), run ? '收起桌寵' : '啟動桌寵'),
        run ? h('button.btn.block', { style: { marginTop: '8px' }, on: { click: () => { n.petPause(code !== 'paused'); p._sig = ''; setTimeout(() => p.refresh(p), 400); } } }, icon(code === 'paused' ? 'play' : 'pause', 's'), code === 'paused' ? '繼續自主行動' : '暫停（停在原地）') : null));
      p.body.replaceChildren(
        T('權限', '只在你使用功能時才會請求'), h('div.list', null,
          row('layers', '顯示在其他應用程式上層', '桌寵必要。Android 設定 › 特殊應用程式存取權', permTag(pm && pm.overlay), () => n.requestPermission('overlay')),
          row('bell', '通知', pm && pm.notifications === 'not-needed' ? 'Android 12 以下不需要' : '桌寵的暫停／收起按鈕、提醒都在通知裡', permTag(pm && (pm.notifications !== 'denied'), pm && pm.notifications === 'not-needed' ? '不需要' : null), () => n.requestPermission('notifications')),
          row('phone', '使用情況存取（選用）', '只給「App 情境對話」用：只知道前景 App 的名稱，看不到內容', permTag(pm && pm.usage, pm && pm.usage ? '已允許' : '未使用'), () => Pg().open('petapps')),
          row('clock', '鬧鐘與提醒（選用）', pm && pm.exactAlarm === 'not-needed' ? '準時提醒不需要額外權限' : '只有「準時提醒」需要；沒有時提醒可能晚幾分鐘', permTag(pm && pm.exactAlarm !== 'denied', pm && pm.exactAlarm === 'denied' ? '一般精度' : null), () => n.requestPermission('exactAlarm'))),
        small(pm ? `Android ${pm.sdk >= 35 ? '15+' : pm.sdk >= 34 ? '14' : pm.sdk >= 33 ? '13' : '12 以下'}（API ${pm.sdk}）・前景服務類型：${pm.fgsType === 'specialUse' ? 'specialUse（桌面互動角色）' : '不需要（Android 14 以下）'}` : ''),
        T('桌面上的 OC', `最多 ${G.maxPets} 隻・點進去調整每一隻`), pickList(p, true),
        T('互動'), card(
          line('觸控穿透', toggle(G.passthrough, (v) => { G.passthrough = v; changed('passthrough'); }), '開啟後手指會穿過桌寵，直接操作下面的 App（桌寵會稍微透明，這是 Android 12 以上的規定）。通知裡也可以切換。'),
          line('對話泡泡', toggle(G.bubbles, (v) => { G.bubbles = v; changed('bubbles'); })),
          line('震動回饋', toggle(G.haptics, (v) => { G.haptics = v; changed('haptics'); })),
          line('生活作息', toggle(G.routines !== false, (v) => { G.routines = v; changed('routines'); }), '依時間、心情和個性做一連串動作：早上伸懶腰、無聊時踱步、想睡時打哈欠找地方坐下、開心時表演…關閉後只做單一的隨機動作。'),
          line('桌面音效', toggle(!!G.sound, (v) => { G.sound = v; changed('sound'); if (v) PS().syncSounds().then((k) => { toast(k ? `已為 ${k} 隻準備好牠們自己的聲音` : '音效還沒準備好（需要 Android App）', k ? 'check' : 'info'); p._sig = ''; p.refresh(p); }); else { p._sig = ''; p.refresh(p); } }),
            '用牠自己的聲音做成的小音效：點一下、被摸、跳、落地、吃東西、遇到別隻桌寵。預設關閉；手機靜音、通話中、螢幕關閉時不會出聲，也不會比你設的音量更大。'),
          G.sound ? line('音量', h('div.hstack', { style: { gap: '8px' } }, seg([['0.3', '小'], ['0.6', '中'], ['0.9', '大']], String(G.soundVol == null ? 0.6 : G.soundVol), (v) => { G.soundVol = +v; changed('soundVol'); }),
            h('button.btn.ghost.s', { on: { click: () => { const c = Ch().get(PS().on()[0]); if (c && OC.PetSound) OC.PetSound.preview(c, 'talk_a'); } } }, '試聽'))) : null),
        h('div.list', { style: { marginTop: '12px' } },
          row('phone', 'App 情境對話', P().app.enabled ? '已開啟' : '關閉（預設）', null, () => Pg().open('petapps')),
          row('clock', '番茄鐘・提醒・待辦・筆記', toolsSub(), null, () => Pg().open('pettools'))),
        T('效能'), card(
          line('動畫幀率', seg([['60', '60'], ['30', '30']], String(G.fps), (v) => { G.fps = +v; changed('fps'); }), '大家都在休息時自動降到 15 fps；螢幕關閉時完全停止繪製。'),
          line('畫質', seg([['low', '省電'], ['mid', '標準'], ['high', '清晰']], G.quality, (v) => { G.quality = v; St.touch('pet'); toast('下次啟動或按「更新外觀」時套用', 'info'); }), '影格解析度 96／128／160 px'),
          line('同時在桌面的數量', seg([['1', '1'], ['2', '2'], ['3', '3']], String(G.maxPets), (v) => { G.maxPets = +v; P().on = P().on.slice(0, G.maxPets); p._sig = ''; changed('maxPets'); p.refresh(p); })),
          line('螢幕關閉時暫停', toggle(G.pauseScreenOff, (v) => { G.pauseScreenOff = v; changed('screenoff'); })),
          line('影格快取', seg([['16', '16MB'], ['24', '24MB'], ['48', '48MB']], String(G.cacheMB), (v) => { G.cacheMB = +v; changed('cache'); }), '記憶體不足時系統通知會自動清掉快取，之後再慢慢載入。')),
        T('主畫面小工具', '和桌寵分開：加到手機桌面上看狀態'), widgetCard(p),
        h('div.list', { style: { marginTop: '12px' } },
          PS().on().length >= 2 ? row('paw', '測試雙人互動', '讓前兩隻桌寵走到一起，做一次擁抱、擊掌、安慰…', null, () => pairSheet()) : null,
          row('target', '診斷', '服務狀態、幀率、快取、同步紀錄', null, () => Pg().open('petdiag')),
          row('trash', '清除桌寵資料', '收起桌寵、刪除桌面用的圖像、提醒與待同步的互動（遊戲存檔不受影響）', null, async () => { if (!(await confirm('清除桌寵資料？', '還沒同步回遊戲的桌面互動也會一起刪除。', '清除', true))) return; n.petClearAll(); P().exported = {}; St.touch('pet'); toast('已清除', 'trash'); p._sig = ''; p.refresh(p); })));
    },
  });
  /* 14.0: the little desk at the top — the OCs you picked stand on it the way they will on the phone (a preview drawn by the game;
   * the real pets are native windows). It shows who goes out, who is out right now, and invites you to pick someone when it is empty. */
  function desk(p, st) {
    const ids = PS().on(), run = !!st && (st.code === 'running' || st.code === 'paused');
    p.deskPets = ids.map((id) => Ch().get(id)).filter(Boolean).map((c, i) => { const cv = h('canvas', { width: 176, height: 176 }); return { c, cv, i }; });
    p.desk.classList.toggle('live', run);
    p.desk.replaceChildren(
      h('div.pet-desk-sky', null, h('span.tag' + (run ? '.teal' : ''), null, run ? (st.code === 'paused' ? '暫停中' : '在桌面上') : (PS().native() ? '還沒出門' : '預覽'))),
      p.deskPets.length ? h('div.pet-desk-row', null, ...p.deskPets.map((d) => h('button.pet-desk-pet', { 'aria-label': name(d.c) + '的桌寵設定', on: { click: () => { haptic('tick'); Pg().open('petone', { id: d.c.id }); } } }, d.cv, h('small', null, name(d.c)))))
        : h('div.pet-desk-empty', null, OC.UI.sticker('paw'), h('b', null, '桌面上還沒有人'), h('span', null, '在下面打開想帶去桌面的角色')),
      h('div.pet-desk-floor'));
    deskDraw(p);
  }
  function deskDraw(p) {
    if (!p.deskPets || !p.el.classList.contains('open')) return;
    const t = (performance.now() - (p.t0 || 0)) / 1000;
    for (const d of p.deskPets) {
      if (!d.cv.isConnected) continue;
      const k = (t + d.i * 2.3) % 9, action = k > 7.6 ? 'greet' : 'idle';
      OC.CharRender.portrait(d.cv, d.c, { pose: { action, at: t, blink: (t + d.i) % 3.4 < 0.14 ? 1 : 0, breath: Math.sin(t * 1.6 + d.i), mouth: 'smile' }, t });
    }
  }
  function widgetCard(p) {
    const W = PS().wcfg(), chars = Ch().all(), NEEDS = OC.LifeData.NEEDS;
    const pushW = () => { St.touch('pet'); PS().widget(); };
    return card(
      h('div.muted', null, '顯示的角色'), h('div.chips', null, ...[[null, '第一隻桌寵']].concat(chars.map((c) => [c.id, name(c)])).map(([id, zh]) => h('button.chip-btn' + ((W.oc || null) === id ? '.on' : ''), { on: { click: () => { W.oc = id; pushW(); p._sig = ''; p.refresh(p); } } }, zh))),
      h('div.muted', { style: { marginTop: '10px' } }, '顯示的需求（選三個）'), h('div.chips', null, ...NEEDS.map((n) => h('button.chip-btn' + (W.needs.includes(n.id) ? '.on' : ''), { on: { click: () => { W.needs = W.needs.includes(n.id) ? W.needs.filter((x) => x !== n.id) : W.needs.concat(n.id).slice(-3); pushW(); p._sig = ''; p.refresh(p); } } }, n.zh))),
      line('顯示需求', toggle(W.showNeeds, (v) => { W.showNeeds = v; pushW(); })), line('顯示待辦', toggle(W.showTodo, (v) => { W.showTodo = v; pushW(); })),
      small('在手機桌面長按空白處 › 小工具 › OC Shimeji 加入。縮小時只顯示角色與心情；角色會眨眼（兩張影格由系統輪播，不會喚醒 App）。內容在你打開遊戲或桌寵執行時更新。'));
  }
  function toolsSub() { const t = P().tools; const a = t.pomo.active; return [a ? `番茄鐘進行中（${a.phase === 'break' ? '休息' : '專注'}）` : null, `${t.todos.filter((x) => !x.done).length} 件待辦`, t.rest.on ? `每 ${t.rest.every} 分鐘提醒休息` : null].filter(Boolean).join('・'); }
  function pickList(p, native) {
    const ids = PS().on(), G = P().global;
    return h('div.list', null, ...Ch().all().map((c) => {
      const onIt = ids.includes(c.id), ex = P().exported[c.id];
      const sw = toggle(onIt, (v) => { if (!PS().setOn(c.id, v)) { toast(`最多 ${G.maxPets} 隻（效能設定可以調整）`, 'info'); p._sig = ''; p.refresh(p); return; } S().petId = PS().on()[0] || null; PS().push('on'); p._sig = ''; setTimeout(() => p.refresh(p), 50); });
      sw.addEventListener('click', (e) => e.stopPropagation());
      return row(av(c), name(c), onIt ? (native ? (ex ? `桌面外觀已準備（${ex.player ? ex.player + ' 個動作用你的動畫' : '內建骨架'}）` : '啟動時會準備桌面外觀') : '已選擇') : Ch().typeTitle(c), sw, () => Pg().open('petone', { id: c.id }));
    }));
  }

  // ================================================================== one OC
  Pg().define('petone', '桌寵設定', {
    sub: true,
    build(p, el) { p.cv = h('canvas', { width: 220, height: 220 }); p.cv.style.cssText = 'width:110px;height:110px;border-radius:20px;background:var(--surface-2);display:block;margin:0 auto'; p.body = h('div'); el.append(p.cv, p.body); },
    refresh(p) {
      const c = Ch().get(p.params.id); if (!c) return;
      const o = PS().one(c.id), n = N();
      p.prev = p.prev || { action: 'idle', t0: performance.now() };
      if (!p.live) { p.live = true; OC.App.live(p.cv, () => ({ char: Ch().get(p.params.id), pose: { action: p.prev.action, face: 0.6, dir: 'right', at: (performance.now() - p.prev.t0) / 1000 } })); }
      const set = (k, v, push = true) => { o[k] = v; St.touch('pet'); if (push) PS().push('one:' + k); };
      p.body.replaceChildren(
        h('div.center', { style: { marginTop: '6px' } }, h('b', null, name(c)), small(PS().on().includes(c.id) ? '在桌面上的成員' : '目前沒有放到桌面（在桌寵管理打開）')),
        T('外觀'), card(
          h('div', null, `大小 ×${o.size.toFixed(1)}`), range(0.6, 1.8, 0.1, o.size, '大小', (v) => { set('size', v); p.refresh(p); }),
          h('div', { style: { marginTop: '10px' } }, `不透明度 ${Math.round(o.opacity * 100)}%`), range(0.4, 1, 0.05, o.opacity, '不透明度', (v) => { set('opacity', v); p.refresh(p); })),
        T('自主行動', '和遊戲共用個性與需求，桌面上用簡化版的決策'), card(
          seg([['-1', '待著'], ['0', '安靜'], ['1', '一般'], ['2', '活潑']], String(o.autonomy), (v) => set('autonomy', +v)),
          line('爬牆', toggle(o.climb, (v) => set('climb', v))), line('倒吊在螢幕上方', toggle(o.ceiling, (v) => set('ceiling', v))),
          line('躲在螢幕邊偷看', toggle(o.peek, (v) => set('peek', v))), line('跑步', toggle(o.run, (v) => set('run', v))), line('跳躍', toggle(o.jump, (v) => set('jump', v)))),
        T('觸控'), card(
          line('可以抓起來丟', toggle(o.drag, (v) => set('drag', v))),
          h('div', { style: { marginTop: '10px' } }, '點兩下'), seg([['open', '回到遊戲'], ['talk', '說說話'], ['none', '不做事']], o.doubleTap, (v) => set('doubleTap', v)),
          small('點一下：反應・長按：選單（摸摸、餵食、送禮、說話、待著、收起）・來回撫摸：摸摸頭')),
        T('對話'), card(
          seg([['off', '不閒聊'], ['rare', '偶爾'], ['normal', '一般'], ['often', '常常']], o.talk, (v) => set('talk', v)),
          line('完全靜音（連反應都不說話）', toggle(o.mute, (v) => set('mute', v))),
          h('div.hstack', { style: { marginTop: '10px', gap: '8px' } }, h('button.btn.grow', { on: { click: () => linesSheet(c) } }, icon('edit', 's'), '自訂台詞'), h('button.btn.grow', { on: { click: () => previewLines(c) } }, icon('chat', 's'), '預覽'))),
        T('動畫', '玩家影格優先；沒有畫的動作沿用備用鏈，最後用內建骨架'), animList(p, c, o, n),
        n ? h('button.btn.block', { style: { marginTop: '12px' }, on: { click: async () => { toast('正在更新桌面外觀…', 'refresh'); const ok = await PS().exportSprites(c.id, true); PS().push('sprites'); toast(ok ? '桌面外觀已更新' : '更新失敗', ok ? 'check' : 'info'); p.refresh(p); } } }, icon('refresh', 's'), '用目前外觀與動畫更新桌面') : h('div.list', { style: { marginTop: '12px' } }, lockedRow('refresh', '更新桌面外觀', '需要 Android App')));
    },
  });
  function animList(p, c, o, n) {
    const acts = [...new Set([...Ch().ACTIONS.map((a) => a[0]), ...Object.keys(c.actions || {})])];
    return h('div.list', null, ...Object.entries(PS().ANIMS).map(([k, def]) => {
      const s = PS().sourceOf(c, k);
      const pick = h('select', { 'aria-label': def.zh + ' 使用的動作', style: { maxWidth: '110px' }, on: { change: (e) => { if (e.target.value === k) delete o.map[k]; else o.map[k] = e.target.value; St.touch('pet'); p.refresh(p); } } },
        ...acts.map((a) => h('option', { value: a, selected: (o.map[k] || k) === a }, (Ch().ACTION_ZH[a] || a) + (c.actions && c.actions[a] ? ' ★' : ''))));
      const test = n ? h('button.icon-btn', { 'aria-label': '在桌面測試' + def.zh, on: { click: (e) => { e.stopPropagation(); n.petTest(c.id, k); toast(n.isPetRunning() ? `在桌面播放「${def.zh}」` : '桌寵啟動後會播放這個動作', 'phone'); } } }, icon('phone', 's')) : null;
      const el = row(null, def.zh, s.label + (def.edge && s.src === 'rig' ? '・會旋轉貼在牆上' : ''), h('div.hstack', { style: { gap: '4px' } }, pick, test), () => { p.prev = { action: s.act, t0: performance.now() }; haptic(); });
      return el;
    }));
  }
  /** 12.0: pick a paired action to try on the desktop */
  function pairSheet() {
    sheet('測試雙人互動', (b, api) => {
      const n = N(); b.append(h('div.faint', { style: { fontSize: 'var(--fs-xs)', marginBottom: '8px' } }, n && n.petTestPair ? '前兩隻桌寵會先走到一起再開始（桌寵要正在桌面上）。這只是試看，不會改變牠們的關係。' : '需要 Android App（桌寵在桌面上才能測試）。'),
        h('div.list', null, ...PS().PAIR_KINDS.map(([k, zh]) => row('paw', zh, null, null, () => { if (PS().testPair(k)) toast('已送出：' + zh, 'check'); else toast('需要桌寵正在桌面上（至少兩隻）', 'info'); api.close(); }))));
    });
  }
  function linesSheet(c) {
    const cust = (P().custom[c.id] = P().custom[c.id] || {});
    let cat = 'tap';
    sheet(`${name(c)}的桌面台詞`, (b) => {
      const body = h('div');
      const draw = () => {
        const list = (cust[cat] = cust[cat] || []);
        const inp = h('input', { type: 'text', maxlength: 60, placeholder: '新增一句（最多 60 字）', style: { width: '100%' } });
        body.replaceChildren(
          h('select', { style: { width: '100%' }, 'aria-label': '情境', on: { change: (e) => { cat = e.target.value; draw(); } } }, ...Object.keys(PS().LINE_CATS).map((k) => h('option', { value: k, selected: k === cat }, PS().CAT_ZH[k] || k))),
          small('內建台詞會依個性、聲線、情緒、回憶自動產生；這裡加的是你自己的版本，會和內建的一起出現。'),
          h('div.list', { style: { marginTop: '8px' } }, ...(list.length ? list.map((t, i) => row(null, t, null, h('button.icon-btn', { 'aria-label': '刪除', on: { click: () => { list.splice(i, 1); St.touch('pet'); PS().push('lines'); draw(); } } }, icon('trash', 's')))) : [small('還沒有自訂台詞')])),
          h('div.hstack', { style: { marginTop: '8px', gap: '8px' } }, inp, h('button.btn.primary', { on: { click: () => { const v = inp.value.trim(); if (!v) return; list.push(v); St.touch('pet'); PS().push('lines'); draw(); } } }, '加入')));
      };
      draw(); b.append(body);
    });
  }
  function previewLines(c) {
    const others = PS().on().filter((x) => x !== c.id).map((x) => Ch().get(x)).filter(Boolean);
    const L = PS().renderLines(c, others, 3);
    sheet(`${name(c)}在桌面上會說`, (b) => b.append(small('依目前的個性、心情、時間與回憶產生（不會影響遊戲裡的對話紀錄）。'),
      h('div.list', { style: { marginTop: '8px' } }, ...Object.entries(L).map(([k, arr]) => row(null, PS().CAT_ZH[k] || k, arr.join('　／　'))))));
  }

  // ================================================================== app context
  Pg().define('petapps', 'App 情境對話', {
    sub: true,
    build(p, el) { p.body = h('div'); el.append(p.body); },
    refresh(p) {
      const n = N(), A = P().app, pm = PS().perms();
      const intro = card(h('b', null, '依你正在用的 App 說一句話（選用）'), small('只會知道「前景 App 的名稱」（Android 使用情況存取），不會讀取畫面、訊息、密碼或輸入內容，也不使用無障礙服務。可以隨時關閉並清除規則。'));
      if (!n) { p.body.replaceChildren(intro, h('div.list', { style: { marginTop: '12px' } }, lockedRow('phone', '開啟 App 情境對話', '需要 Android App'))); return; }
      const granted = !!(pm && pm.usage);
      p.body.replaceChildren(intro,
        card(line('開啟', toggle(A.enabled, (v) => { A.enabled = v; St.touch('pet'); PS().push('app'); p.refresh(p); }), A.enabled && !granted ? '還需要在系統設定允許「使用情況存取」。' : null),
          A.enabled ? h('button.btn.block' + (granted ? '' : '.primary'), { style: { marginTop: '10px' }, on: { click: () => n.requestPermission('usage') } }, icon('phone', 's'), granted ? '系統設定：使用情況存取（可在此撤銷）' : '前往允許使用情況存取') : null,
          A.enabled && granted ? null : A.enabled ? small('偵測不到前景 App 時桌寵不會亂猜，只是不說情境台詞。') : null),
        A.enabled ? card(line('沒有規則時用系統分類', toggle(A.useSystem, (v) => { A.useSystem = v; St.touch('pet'); PS().push('app'); })), line('在排除的 App 上方隱藏桌寵', toggle(A.hide, (v) => { A.hide = v; St.touch('pet'); PS().push('app'); }))) : null,
        A.enabled ? T('測試', '選一種 App，看看桌寵會說什麼') : null,
        A.enabled ? h('div.chips', null, ...Object.entries(PS().APP_CATS).map(([k, zh]) => h('button.chip-btn', { on: { click: () => { const c = Ch().get(PS().on()[0]) || Ch().active(); const L = PS().renderLines(c, [], 3)['app_' + k] || []; toast(L.length ? `${name(c)}：${L[Math.floor(Math.random() * L.length)]}` : '這種 App 沒有台詞', 'chat'); } } }, zh))) : null,
        A.enabled ? T('App 規則', '只列出有桌面圖示的 App') : null, A.enabled ? appList(p, n) : null,
        h('button.btn.block', { style: { marginTop: '12px' }, on: { click: async () => { if (!(await confirm('清除所有 App 規則？', '關閉情境對話並刪除每個 App 的分類與排除設定。', '清除', true))) return; Object.assign(A, { enabled: false, rules: {}, exclude: [], hide: false }); St.touch('pet'); PS().push('app'); p.refresh(p); } } }, icon('trash', 's'), '關閉並清除規則'));
    },
  });
  function appList(p, n) {
    let apps = []; try { apps = JSON.parse(n.launchableApps() || '[]'); } catch (e) { apps = []; }
    if (!apps.length) return card(small('讀不到 App 清單。'));
    const A = P().app, opts = [['', '自動'], ...Object.entries(PS().APP_CATS), ['none', '不說話'], ['x', '排除']];
    return h('div.list', null, ...apps.slice(0, 200).map((a) => {
      const cur = A.exclude.includes(a.pkg) ? 'x' : A.rules[a.pkg] || '';
      const sel = h('select', { 'aria-label': a.label + ' 的分類', on: { change: (e) => { const v = e.target.value; A.exclude = A.exclude.filter((x) => x !== a.pkg); delete A.rules[a.pkg]; if (v === 'x') A.exclude.push(a.pkg); else if (v) A.rules[a.pkg] = v; St.touch('pet'); PS().push('rules'); } } }, ...opts.map(([v, zh]) => h('option', { value: v, selected: v === cur }, zh)));
      return row(null, a.label, a.sys ? `系統分類：${PS().APP_CATS[a.sys] || a.sys}` : a.pkg, sel);
    }));
  }

  // ================================================================== tools
  Pg().define('pettools', '番茄鐘與提醒', {
    sub: true,
    build(p, el) { p.body = h('div'); el.append(p.body); },
    onShow(p) { clearInterval(p.timer); p.timer = setInterval(() => { if (p.el.classList.contains('open') && P().tools.pomo.active) p.refresh(p); }, 1000); },
    onHide(p) { clearInterval(p.timer); },
    refresh(p) {
      const t = P().tools, Tl = PS().Tools, nat = Tl.native(), pm = PS().perms(), a = t.pomo.active;
      if (a && a.at < Date.now() - 5000) { /* fired while we were away: the native event will record it on resume */ }
      const left = a ? Math.max(0, Math.round((a.at - Date.now()) / 1000)) : 0;
      const sig = JSON.stringify([t, nat, pm, Math.floor(left / 1)]); if (same(p, sig)) return;
      const natList = nat ? Tl.list() : [];
      const notifOff = pm && pm.notifications === 'denied';
      p.body.replaceChildren(
        notifOff ? card(h('div.lock-note', null, icon('bell', 's'), '通知權限未開啟：時間到時看不到通知（桌寵仍會說話）。'), h('button.btn.block', { style: { marginTop: '8px' }, on: { click: () => window.OCNative.requestPermission('notifications') } }, '開啟通知')) : null,
        T('番茄鐘', nat ? `今天完成 ${t.pomo.day === OC.Clock.dayKey() ? t.pomo.today : 0} 輪・累計 ${t.pomo.total || 0}` : null),
        nat ? card(
          a ? h('div.center', null, h('div', { style: { fontSize: 'var(--fs-xl)', fontWeight: 700 } }, `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`), small(a.phase === 'break' ? '休息中' : '專注中' + (a.exact ? '・準時' : '・一般精度（可能晚幾分鐘）'))) : null,
          a ? h('button.btn.block', { style: { marginTop: '10px' }, on: { click: () => { Tl.stopPomodoro(); p.refresh(p); } } }, icon('close', 's'), '停止') :
            h('button.btn.primary.block', { on: { click: () => { const r = Tl.pomodoro('work'); toast(r ? `開始 ${t.pomo.work} 分鐘專注` : '無法設定提醒', r ? 'clock' : 'info'); p.refresh(p); } } }, icon('play', 's'), `開始 ${t.pomo.work} 分鐘`),
          h('div', { style: { marginTop: '10px' } }, '專注'), seg([['15', '15'], ['25', '25'], ['45', '45']], String(t.pomo.work), (v) => { t.pomo.work = +v; St.touch('pet'); }),
          h('div', { style: { marginTop: '10px' } }, '休息'), seg([['5', '5'], ['10', '10'], ['15', '15']], String(t.pomo.brk), (v) => { t.pomo.brk = +v; St.touch('pet'); }),
          line('專注結束自動開始休息', toggle(t.pomo.auto, (v) => { t.pomo.auto = v; St.touch('pet'); })),
          line('準時提醒', toggle(t.pomo.exact, (v) => { t.pomo.exact = v; St.touch('pet'); if (v && pm && pm.exactAlarm === 'denied') { toast('需要在系統設定允許「鬧鐘與提醒」', 'info'); window.OCNative.requestPermission('exactAlarm'); } p.refresh(p); }), pm && pm.exactAlarm === 'denied' ? '目前沒有權限：會用一般精度（Android 省電時可能晚幾分鐘）。' : null)) : h('div.list', null, lockedRow('clock', '番茄鐘', '需要 Android App（用系統鬧鐘提醒）')),
        T('休息提醒'), nat ? card(line('定時提醒休息', toggle(t.rest.on, (v) => { Tl.rest(v); p.refresh(p); })), h('div', { style: { marginTop: '10px' } }, '每隔（分鐘）'), seg([['30', '30'], ['45', '45'], ['60', '60'], ['90', '90']], String(t.rest.every), (v) => { Tl.rest(t.rest.on, +v); p.refresh(p); })) : h('div.list', null, lockedRow('bell', '休息提醒', '需要 Android App')),
        T('鬧鐘'), nat ? alarmCard(p, t, pm) : h('div.list', null, lockedRow('clock', '鬧鐘', '需要 Android App')),
        nat && natList.length ? small('系統裡登記中的提醒：' + natList.map((r) => `${new Date(r.at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} ${r.title || r.kind}${r.exactActive ? '（準時）' : ''}`).join('、')) : null,
        T('待辦'), todoCard(p, t), T('筆記'), noteCard(p, t));
    },
  });
  function alarmCard(p, t, pm) {
    const tm = h('input', { type: 'time', 'aria-label': '時間', value: '08:00' }), lb = h('input', { type: 'text', maxlength: 30, placeholder: '要提醒什麼？', style: { flex: 1 } });
    let exact = false;
    return card(...(t.alarms || []).map((a) => row('clock', new Date(a.at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }), a.title + (a.exact ? '・準時' : ''), h('button.icon-btn', { 'aria-label': '刪除鬧鐘', on: { click: () => { PS().Tools.removeAlarm(a.id); p.refresh(p); } } }, icon('trash', 's')))),
      h('div.hstack', { style: { gap: '8px', marginTop: '6px' } }, tm, lb),
      line('準時', toggle(false, (v) => { exact = v; if (v && pm && pm.exactAlarm === 'denied') window.OCNative.requestPermission('exactAlarm'); })),
      h('button.btn.block', { style: { marginTop: '8px' }, on: { click: () => {
        const [hh, mm] = (tm.value || '08:00').split(':').map(Number), d = new Date(); d.setHours(hh, mm, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
        const r = PS().Tools.alarm({ at: d.getTime(), title: lb.value.trim() || '鬧鐘', exact }); toast(r ? `${d.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 提醒${r.exactActive ? '（準時）' : '（一般精度）'}` : '無法設定', r ? 'clock' : 'info'); p.refresh(p);
      } } }, icon('plus', 's'), '新增鬧鐘'));
  }
  function todoCard(p, t) {
    const inp = h('input', { type: 'text', maxlength: 120, placeholder: '新增待辦', style: { flex: 1 } });
    return card(...t.todos.slice(0, 50).map((x) => h('div.hstack', { style: { marginTop: '6px' } },
      h('button.icon-btn', { 'aria-label': x.done ? '標為未完成' : '完成', on: { click: () => { x.done = !x.done; if (x.done) { x.doneAt = Date.now(); OC.Progress && OC.Progress.emit('todo', {}); } St.touch('pet'); PS().widget(); p.refresh(p); } } }, icon(x.done ? 'check' : 'plus', 's')),
      h('span.grow', { style: x.done ? { textDecoration: 'line-through', opacity: 0.6 } : null }, x.text),
      h('button.icon-btn', { 'aria-label': '刪除待辦', on: { click: () => { t.todos = t.todos.filter((y) => y !== x); St.touch('pet'); PS().widget(); p.refresh(p); } } }, icon('trash', 's')))),
    h('div.hstack', { style: { gap: '8px', marginTop: '8px' } }, inp, h('button.btn.primary', { on: { click: () => { if (!inp.value.trim()) return; PS().Tools.todo(inp.value.trim()); p.refresh(p); } } }, '加入')),
    small('最上面的未完成待辦會顯示在主畫面小工具。'));
  }
  function noteCard(p, t) {
    const edit = (n) => sheet(n ? '編輯筆記' : '新增筆記', (b, api) => { const ta = h('textarea', { rows: 8, maxlength: 2000, style: { width: '100%' } }); ta.value = n ? n.text : ''; b.append(ta, h('div.hstack', { style: { gap: '8px', marginTop: '10px' } }, n ? h('button.btn', { on: { click: () => { t.notes = t.notes.filter((x) => x !== n); St.touch('pet'); api.close(); p.refresh(p); } } }, icon('trash', 's'), '刪除') : null, h('button.btn.primary.grow', { on: { click: () => { if (ta.value.trim()) PS().Tools.note(ta.value.trim(), n && n.id); api.close(); p.refresh(p); } } }, '儲存'))); });
    return card(...t.notes.slice(0, 50).map((n) => row(null, n.text.split('\n')[0].slice(0, 40), new Date(n.at).toLocaleString('zh-TW'), null, () => edit(n))), h('button.btn.block', { style: { marginTop: '8px' }, on: { click: () => edit(null) } }, icon('edit', 's'), '新增筆記'));
  }

  // ================================================================== diagnostics
  Pg().define('petdiag', '桌寵診斷', {
    sub: true,
    build(p, el) { p.body = h('div'); el.append(p.body); },
    refresh(p) {
      const n = N(), st = PS().status(), pm = PS().perms(), A = P().applied;
      const kv = (k, v) => h('div.hstack', { style: { fontSize: 'var(--fs-s)', marginTop: '4px' } }, h('span.grow.muted', null, k), h('b', null, String(v)));
      p.body.replaceChildren(
        T('服務'), n && st ? card(kv('狀態', st.code), kv('訊息', st.msg || '—'), kv('幀率', `${st.fps ?? '—'} / 上限 ${st.fpsCap ?? '—'}`), kv('每幀耗時', st.frameMs != null ? st.frameMs + ' ms' : '—'),
          kv('影格快取', st.cacheKB != null ? `${st.cacheKB} / ${st.cacheBudgetKB} KB` : '—'), kv('螢幕', `${st.screen || '—'}・系統列 ${st.insets || '—'}`), kv('螢幕亮著', st.screenOn !== false ? '是' : '否（停止繪製）'),
          kv('待同步互動', st.events ?? '—'), kv('因上限丟棄', st.dropped ?? 0), kv('前景服務類型', st.fgsType || '—'), kv('App 情境', st.app ? `${st.app.enabled ? '開' : '關'}・權限 ${st.app.granted ? '有' : '無'}・${st.app.watching ? '偵測中' : '未偵測'}` : '—'), kv('錯誤', st.error || '無'),
          ...(st.pets || []).map((x) => kv(x.name, `${x.state}/${x.anim}・${x.surface}・(${x.x},${x.y})・${x.size}px・影格組 ${x.sprites}・重畫 ${x.draws}${x.hidden ? '・隱藏' : ''}`))) : card(small(n ? '讀不到服務狀態' : '需要 Android App')),
        T('權限'), card(small(pm ? JSON.stringify(pm) : '—')),
        T('同步', `已套用到第 ${A.seq} 個互動`), card(...(A.log.length ? A.log.slice(0, 15).map((l) => kv(`#${l.seq} ${l.type}${l.oc ? '・' + (Ch().get(l.oc) ? name(Ch().get(l.oc)) : l.oc) : ''}`, l.r)) : [small('還沒有桌面互動')])),
        T('紀錄'), card(...(P().syncLog.length ? P().syncLog.slice(0, 15).map((l) => kv(`${new Date(l.at).toLocaleTimeString('zh-TW')} ${l.kind}`, `${l.msg} ${l.ok ? '✓' : '✗'}`)) : [small('—')])),
        n ? h('button.btn.block', { style: { marginTop: '12px' }, on: { click: () => { const r = PS().pull('manual'); toast(`同步了 ${r.n || 0} 個互動`, 'refresh'); p.refresh(p); } } }, icon('refresh', 's'), '立即同步') : null);
    },
  });

  OC.PetPages = { pickList };
})();
