/* OC Shimeji — Phase 4 life UI.
 *   interact(id)   tap an OC: pet · call · feed · gift · play · keep company · chat · schedule · observe · profile
 *   notices()      bell: growth suggestions (accept / no / later / never / mute similar / reasons), confirmations
 *   profile tabs   生活 (emotion & causes, needs, routine, wishes, skills, habits) · 關係 · 回憶 (filters, life story, replay)
 *   pages          lifeset (autonomy & romance settings) · dialogue (editor, import / export) · lifedev (diagnostics)
 * The HUD only shows a summary; details live in the profile. Nothing here invents data: every value
 * shown comes from the simulation state (OC.Mind / OC.Brain / OC.Events).
 */
(function () {
  'use strict';
  const { h, icon, toast, sheet, confirm, seg, toggle, row, haptic } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, M = () => OC.Mind, B = () => OC.Brain, D = () => OC.LifeData, Ch = () => OC.Chars, Pg = () => OC.Pages, A = () => OC.App, Sim = () => OC.Sim;
  const T = (t, small) => h('div.section-title', null, t, small ? h('small', null, small) : null);
  const card = (...k) => h('div.card', null, ...k);
  const bar = (v, c) => h('div.bar', null, h('i', { style: { width: Math.max(0, Math.min(100, Math.round(v))) + '%', '--c': c } }));
  const small = (t) => h('div.faint', { style: { fontSize: 'var(--fs-xs)' } }, t);
  const name = (c) => Ch().name(c);
  const HOLD_ZH = { editor: '換裝中', drag: '被抱著', call: '過來找你', pet: '被摸摸頭', dialogue: '和你聊天', event: '事件中', feed: '吃東西', play: '和你玩', gesture: '和你互動中', menu: '等你選擇' };

  function ago(gm) { const d = Sim().now() - gm; if (d < 2) return '剛剛'; if (d < 60) return `${Math.round(d)} 分鐘前`; if (d < 1440) return `${Math.round(d / 60)} 小時前`; return `${Math.round(d / 1440)} 天前`; }
  function gmLabel(gm) { const d = Sim().day(gm), h = Sim().hourOf(gm); const day0 = S().life.clock.day0; const dd = S().settings.time === 'cycle' && day0 != null ? `第${d - day0 + 1}天` : (() => { const t = new Date((gm * 60000) + new Date().getTimezoneOffset() * 60000); return `${t.getMonth() + 1}/${t.getDate()}`; })(); return `${dd} ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; }

  /** "what is it doing" — short, for HUD / lists */
  function doingText(c) {
    if (!c) return ''; const b = B().get(c.id);
    if (b && b.a) {
      if (b.holds.size) return HOLD_ZH[[...b.holds][0]] || '暫停中';
      if (b.st === 'do' && D().ACTS[b.act]) return D().ACTS[b.act].zh + '中';
      if (b.st === 'go' && D().ACTS[b.act]) return '要去' + D().ACTS[b.act].zh;
      if (b.st === 'social') { const cv = b.conv || (B().convs.find((x) => x.a === b || x.b === b)); const o = cv && Ch().get(cv.a === b ? cv.b.id : cv.a.id); return o ? `和${name(o)}${D().SOCIAL[cv.kind].zh}` : '聊天中'; }
      if (b.st === 'event') return '事件中';
      return '';
    }
    if (!c.status.onIsland) return '不在島上';
    const cur = c.life.cur; return cur && D().ACTS[cur.act] ? `${cur.placeZh ? '在' + cur.placeZh : ''}${D().ACTS[cur.act].zh}` : '';
  }

  // ============================== notices ==============================
  let transient = [], pill = null;
  function noticeCount() { const now = Date.now(); transient = transient.filter((n) => now - n.at < 90000); return M().pending().length + S().life.notices.length + transient.length; }
  function pushNotice(n) {
    if (n.info) { toast(n.text, 'gift'); return; }
    n.at = Date.now(); if (n.watch) transient.push(n);
    showPill(n);
  }
  function showPill(n) {
    if (pill) pill.remove();
    pill = h('div.notice-pill', { role: 'status' }, icon(n.confirm ? 'heart' : 'sparkle', 's'), h('span.grow', null, n.text),
      n.watch ? h('button.btn.s.primary', { on: { click: () => { n.watch(); transient = transient.filter((x) => x !== n); close(); } } }, '看看') : n.confirm ? h('button.btn.s.primary', { on: { click: () => { close(); notices(); } } }, '決定') : null,
      h('button.icon-btn', { 'aria-label': '關閉', on: { click: () => close() } }, icon('close', 's')));
    const el = pill; const close = () => { el.remove(); if (pill === el) pill = null; };
    document.getElementById('app').append(el); setTimeout(close, 12000);
  }
  function suggestionCard(c, s, after) {
    const why = h('div.faint', { hidden: true, style: { fontSize: 'var(--fs-xs)', marginTop: '6px' } }, `原因：${s.reason}`, h('br'), '這只是根據牠真實的生活紀錄提出的建議；你不同意就不會改變。');
    const act = (d, msg) => { M().resolve(c, s.id, d); if (msg) toast(msg, 'check'); after && after(); };
    return card(h('div.hstack', null, h('b.grow', null, `${name(c)}・${({ trait: '新特質', hobby: '新興趣', habit: '新習慣' })[s.type]}「${s.zh}」`), h('button.btn.ghost.s', { on: { click: () => (why.hidden = !why.hidden) } }, '原因')),
      h('div', { style: { marginTop: '6px' } }, s.ask || `${name(c)}好像有了「${s.zh}」，要保留嗎？`), why,
      h('div.hstack', { style: { marginTop: '10px', flexWrap: 'wrap', gap: '6px' } },
        h('button.btn.s.primary', { on: { click: () => act('accept', '已保留') } }, '接受'),
        h('button.btn.s', { on: { click: () => act('reject', '好的，短期內不會再提') } }, '不要'),
        h('button.btn.s', { on: { click: () => act('later', '之後再決定（可在檔案裡找到）') } }, '稍後決定'),
        h('button.btn.s', { on: { click: () => act('lock', '這個不會再提出了') } }, '永遠不要'),
        h('button.btn.s', { on: { click: () => act('mute', `已關閉同類（${({ trait: '特質', hobby: '興趣', habit: '習慣' })[s.type]}）建議`) } }, '關閉同類建議')));
  }
  function notices() {
    sheet('通知', (b, api) => {
      const render = () => {
        const g = M().pending(), n = S().life.notices;
        b.replaceChildren(
          !g.length && !n.length && !transient.length ? h('div.empty', null, '目前沒有需要你決定的事') : null,
          ...transient.map((t) => card(h('div.hstack', null, h('span.grow', null, t.text), h('button.btn.s.primary', { on: { click: () => { t.watch(); transient = transient.filter((x) => x !== t); api.close(); } } }, '看看')))),
          ...n.map((x) => card(h('b', null, x.title), h('p.muted', null, x.body), h('div.hstack', null, h('button.btn.block', { on: { click: () => { OC.Events.decide(x.id, false); toast('維持原本的關係', 'check'); render(); } } }, '不要'), h('button.btn.block.primary', { on: { click: () => { OC.Events.decide(x.id, true); toast('關係改變了', 'heart'); render(); } } }, '同意')))),
          ...g.map(({ c, s }) => suggestionCard(c, s, render)),
          T('最近的事件'), h('div.list', null, ...(S().life.ev.log.slice(0, 6).map((e) => row(null, e.zh, `${[Ch().get(e.a), Ch().get(e.b)].filter(Boolean).map(name).join('、')}・${ago(e.gm)}`))).concat(S().life.ev.log.length ? [] : [row(null, '還沒有發生事件', '大家生活一陣子之後就會有')])));
      };
      render();
    });
  }

  // ============================== interact with an OC ==============================
  function interact(id) {
    const c = Ch().get(id); if (!c) return;
    const self = id === S().activeId, a = A().actorOf(id);
    sheet(null, (b, api) => {
      const cv = h('canvas', { width: 128, height: 128 }); cv.style.cssText = 'width:64px;height:64px;flex:none;border-radius:16px;background:var(--surface-2)';
      A().live(cv, () => ({ char: Ch().get(id), pose: { face: 0.3 } }));
      const go = (fn) => () => { api.close(); setTimeout(fn, 60); };
      const btn = (ic, label, fn, dis) => h('button.act-btn', { disabled: !!dis, 'aria-label': label, on: { click: fn } }, icon(ic), h('span', null, label));
      const asleep = B().get(id) && B().get(id).act === 'sleep' && B().get(id).st === 'do';
      b.append(h('div.hstack', null, cv, h('div.grow', null, h('b', { style: { fontSize: 'var(--fs-l)' } }, name(c)), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, `${M().label(c)}${doingText(c) ? '・' + doingText(c) : ''}`), asleep ? small('正在睡覺：摸摸頭不會吵醒牠，其他互動會叫醒牠') : null)),
        h('div.act-grid', null,
          btn('paw', '摸摸頭', go(() => pet(id)), !a),
          self ? btn('chat', '打招呼', go(() => A().greetFrom(a, c)), !a) : btn('hand', '叫過來', go(() => call(id)), !a),
          btn('apple', '餵食', go(() => feed(id)), !a),
          btn('gift', '送禮', go(() => gift(id)), !a),
          btn('play', '一起玩', go(() => play(id)), !a),
          self ? btn('clock', '安排活動', go(() => schedule(id)), !a) : btn('users', '陪伴', go(() => accompany(id)), !a),
          btn('chat', '聊天', go(() => chat(id)), !a),
          self ? btn('eye', '觀察', go(() => A().observe(id)), !a) : btn('clock', '安排活動', go(() => schedule(id)), !a),
          btn('sparkle', '想法', go(() => think(id)), !a),
          self ? null : btn('eye', '觀察', go(() => A().observe(id)), !a),
          btn('book', '檔案', go(() => Pg().open('profile', { id }))))
      );
    });
  }
  function react(c, a, cat, extra) { const ln = OC.Talk.say(cat, c, null, extra); if (ln && a) A().bubble(a, ln.text, name(c)); return ln; }
  function pet(id) {
    const c = Ch().get(id), a = A().actorOf(id); if (!c || !a) return;
    const asleep = B().get(id) && B().get(id).act === 'sleep' && B().get(id).st === 'do';
    if (asleep) { A().bubble(a, '（呼嚕……）', name(c), 1.6); M().player(c, { aff: 0.5 }); return; }
    B().hold(id, 'pet'); OC.World.setAction(a, 'patted', { dur: 2.2, priority: 7 }); haptic('light'); OC.Sound && OC.Sound.play('purr', { lv: 0.6 });
    const annoyed = M().dominant(c) === 'annoyed';
    if (!annoyed) { M().feel(c, Ch().has(c, 'shy') ? 'shy' : 'happy', 0.35, '被你摸摸頭'); M().needs(c, { social: 6 }); }
    const P = M().player(c); if (!P.petAt || Sim().now() - P.petAt > 10) { M().player(c, { aff: annoyed ? 0 : 1, fam: 1 }); P.petAt = Sim().now(); }
    react(c, a, 'pet'); if (OC.Progress) OC.Progress.emit('pet', { oc: id }); OC.Sound && OC.Sound.play('pickup');
    setTimeout(() => B().unhold(id, 'pet'), 2400);
  }

  // ================= 11.0 closeness gestures (ring menu 親近): hug · high-five · poke · hand-hold =================
  /** the OC faces you; walks to your side first when it is another OC (then `go()`) */
  function toPlayer(id, go) {
    const a = A().actorOf(id), pl = A().player; if (!a || !pl) return false;
    if (a === pl) { go(); return true; }
    const side = a.x < pl.x ? -1 : 1, p = OC.World.nearestWalkable(pl.x + side * 24, pl.y + 2, 24);
    const ok = () => { B().face(a, pl); B().face(pl, a); go(); };
    if (p && Math.hypot(a.x - p.x, a.y - p.y) > 8) { a.run = true; if (!OC.World.walkTo(a, p.x, p.y, () => { a.run = false; ok(); })) { a.run = false; return false; } } else ok();
    return true;
  }
  function gestureGuard(id) {
    const c = Ch().get(id), a = A().actorOf(id); if (!c || !a) return null;
    const b = B().get(id);
    if (b && b.act === 'sleep' && b.st === 'do') { A().bubble(a, '（呼嚕……）', name(c), 1.6); return null; }
    if (b && b.holds.has('event')) { toast(`${name(c)}正在特別的事情中`, 'info'); return null; }
    return { c, a };
  }
  function hug(id) {
    const g = gestureGuard(id); if (!g) return; const { c, a } = g, P = M().player(c);
    B().hold(id, 'gesture'); const pl = A().player;
    const done = () => { B().unhold(id, 'gesture'); if (pl && pl !== a) OC.World.setAction(pl, 'idle'); };
    const ok = toPlayer(id, () => {
      OC.World.setAction(a, 'hugme', { dur: 1.0, priority: 8 }); const l1 = OC.Talk.say('hug_start', c, null); if (l1) A().bubble(a, l1.text, name(c), 1.6);
      setTimeout(() => {
        OC.World.setAction(a, 'hug', { dur: 2.6, priority: 8 }); if (pl && pl !== a) OC.World.setAction(pl, 'hug', { dur: 2.6, priority: 8 });
        haptic('confirm'); OC.Sound && OC.Sound.play('hug'); setTimeout(() => haptic('heartbeat'), 600); setTimeout(() => haptic('heartbeat'), 1500);
        const now = Sim().now(); M().feel(c, Ch().has(c, 'shy') ? 'shy' : 'content', 0.5, '被你抱抱'); M().needs(c, { social: 10, comfort: 8 });
        if (!P.hugAt || now - P.hugAt > 30) { M().player(c, { aff: 1.5, fam: 1 }); P.hugAt = now; M().remember(c, { type: 'player', imp: 0.5, text: '被你抱了一下', key: 'hug:' + Math.floor(now / 120) }); }
        if (OC.Progress) OC.Progress.emit('hug', { oc: id });
        setTimeout(() => { const l2 = OC.Talk.say('hug_end', c, null); if (l2) A().bubble(a, l2.text, name(c)); done(); }, 2700);
      }, 1050);
    });
    if (!ok) { done(); toast('牠過不來', 'info'); }
  }
  function highfive(id) {
    const g = gestureGuard(id); if (!g) return; const { c, a } = g;
    B().hold(id, 'gesture'); const pl = A().player;
    const ok = toPlayer(id, () => {
      OC.World.setAction(a, 'highfive', { dur: 1.1, priority: 8 });
      // the target appears where the raised hand is for a short moment: tap it
      const p = A().screenOf(a), tg = h('button.hf-target', { 'aria-label': '擊掌', style: { left: p.x + 20 + 'px', top: p.y - 6 + 'px' } }, '✋'); let done = false;
      const finish = (hit) => {
        if (done) return; done = true; tg.remove();
        if (hit) { haptic('confirm'); OC.Sound && OC.Sound.play('highfive'); OC.Sound && OC.Sound.play('sparkle'); const l = OC.Talk.say('highfive_ok', c, null); if (l) A().bubble(a, l.text, name(c)); M().feel(c, 'excited', 0.5, '和你擊掌'); M().needs(c, { fun: 6, social: 5 });
          const now = Sim().now(), P = M().player(c); if (!P.hfAt || now - P.hfAt > 20) { M().player(c, { aff: 1, fam: 0.5 }); P.hfAt = now; } if (pl && pl !== a) OC.World.setAction(pl, 'highfive', { dur: 0.9, priority: 8 }); if (OC.Progress) OC.Progress.emit('highfive', { oc: id });
        } else { haptic('error'); const l = OC.Talk.say('highfive_miss', c, null); if (l) A().bubble(a, l.text, name(c)); OC.World.setAction(a, Ch().has(c, 'shy') ? 'shy' : 'shrug', { dur: 1.4, priority: 8 }); M().feel(c, 'shy', 0.2, '擊掌落空'); }
        setTimeout(() => B().unhold(id, 'gesture'), hit ? 1200 : 1500);
      };
      tg.addEventListener('pointerdown', (e) => { e.stopPropagation(); finish(true); });
      document.getElementById('app').append(tg); setTimeout(() => finish(false), 1700);
    });
    if (!ok) { B().unhold(id, 'gesture'); toast('牠過不來', 'info'); }
  }
  const pokes = {};
  function poke(id) {
    const g = gestureGuard(id); if (!g) return; const { c, a } = g;
    const now = performance.now(); (pokes[id] = (pokes[id] || []).filter((x) => now - x < 7000)).push(now);
    const n = pokes[id].length; B().hold(id, 'gesture'); haptic('tick'); OC.Sound && OC.Sound.play('poke');
    if (n >= 4) { OC.World.setAction(a, 'pout', { dur: 2.2, priority: 8 }); M().feel(c, 'annoyed', 0.35, '一直被戳'); const l = OC.Talk.say('pet_dislike', c, null); if (l) A().bubble(a, l.text, name(c)); pokes[id] = []; }
    else { OC.World.setAction(a, 'poked', { dur: 0.9, priority: 8 }); const l = OC.Talk.say('poke', c, null); if (l) A().bubble(a, l.text, name(c), 1.5); M().feel(c, Ch().has(c, 'shy') ? 'shy' : 'happy', 0.2, '被你戳'); if (n === 1) { M().player(c, { fam: 0.5 }); } if (OC.Sound && n >= 2) OC.Sound.play('giggle'); }
    setTimeout(() => B().unhold(id, 'gesture'), n >= 4 ? 2300 : 1000);
  }
  // hand-holding: the OC keeps to your side while you walk (real-time, UI-level follow; ends after a while or when you leave the island view)
  let hand = null;
  function handhold(id) {
    const g = gestureGuard(id); if (!g) return; const { c, a } = g, pl = A().player; if (!pl || a === pl) return;
    if (hand) endHand();
    B().hold(id, 'gesture'); const l = OC.Talk.say('handhold_start', c, null); if (l) A().bubble(a, l.text, name(c), 2);
    const side = a.x < pl.x ? -1 : 1; hand = { id, a, c, pl, side, t: 0, last: { x: -1e9, y: -1e9 }, until: 28 };
    OC.World.setAction(a, 'handhold', { dur: 40, priority: 5, keepMoving: true }); OC.World.setAction(pl, 'handhold', { dur: 40, priority: 5, keepMoving: true });
    M().feel(c, 'content', 0.4, '和你牽手'); haptic('confirm');
  }
  function endHand(quiet) {
    if (!hand) return; const h0 = hand; hand = null; B().unhold(h0.id, 'gesture');
    for (const x of [h0.a, h0.pl]) if (x.act && x.act.action === 'handhold') OC.World.setAction(x, 'idle');
    if (!quiet) { const l = OC.Talk.say('handhold_end', h0.c, null); if (l) A().bubble(h0.a, l.text, name(h0.c), 2); }
    M().player(h0.c, { aff: 1 }); M().needs(h0.c, { social: 8 });
  }
  function tick(dt) {
    if (!hand) return;
    const h0 = hand; h0.t += dt;
    if (A().curTab !== 'island' || h0.a.hidden || h0.t > h0.until || !B().get(h0.id) || !B().get(h0.id).holds.has('gesture')) { endHand(); return; }
    const pl = h0.pl, a = h0.a, tx = pl.x + h0.side * 22, ty = pl.y + 2;
    if (Math.hypot(tx - h0.last.x, ty - h0.last.y) > 14 || (!a.path && Math.hypot(a.x - tx, a.y - ty) > 30)) {
      const q = OC.World.nearestWalkable(tx, ty, 26); if (q) { h0.last = { x: tx, y: ty }; a.run = Math.hypot(a.x - q.x, a.y - q.y) > 70; OC.World.walkTo(a, q.x, q.y, () => { a.run = false; B().face(a, pl); }); }
    }
  }
  /** 11.0 「想法」: what it intends right now and why (plan · goals · top candidates · moods · what it knows about others) */
  function think(id) {
    const c = Ch().get(id); if (!c) return;
    sheet(`${name(c)}的想法`, (b) => {
      const draw = () => {
        const e = OC.Mind11.explain(c), box = h('div');
        box.append(T('現在'), card(h('div', null, e.reason || '正在發呆'), small('這是牠自己決定的；你可以隨時用「更多 › 安排活動」插手。')));
        if (e.plan) box.append(T('計畫', e.plan.why), card(h('div.hstack', { style: { flexWrap: 'wrap', gap: '6px' } }, ...e.plan.steps.map((s, i) => h('span.tag' + (i < e.plan.i ? '.teal' : i === e.plan.i ? '.accent' : ''), null, (i < e.plan.i ? '✓ ' : i === e.plan.i ? '▶ ' : '') + s))), small(`「${e.plan.zh}」`)));
        if (e.goals.length) box.append(T('今天的小目標'), card(...e.goals.map((g) => h('div.hstack', null, h('span.grow', null, g.zh), h('span.tag' + (g.done ? '.teal' : ''), null, g.done ? '完成' : `${g.prog}/${g.n}`)))));
        if (e.moods.length) box.append(T('心情'), card(...e.moods.map((m) => h('div.hstack', null, h('b', null, m.zh), h('span.muted.grow', { style: { fontSize: 'var(--fs-s)' } }, m.why)))));
        if (e.cands.length) box.append(T('其他考慮過的選項', '分數越高越想做'), card(...e.cands.map((x) => h('div', { style: { padding: '3px 0' } }, h('div.hstack', null, h('span.grow', null, x.id), h('span.num.faint', null, x.s.toFixed(2))), small(x.why)))));
        if (e.know.length) box.append(T('牠觀察到的', '平常看著大家'), card(...e.know.map((k) => h('div', { style: { padding: '3px 0' } }, h('b', null, k.name), small([k.fav ? `常${k.fav}` : null, k.mood ? `剛剛有點${k.mood}` : null, `聊過 ${k.talked} 次`].filter(Boolean).join('・'))))));
        b.replaceChildren(box);
      };
      draw(); const iv = setInterval(() => { if (!b.isConnected) { clearInterval(iv); return; } draw(); }, 2500);
    });
  }
  function call(id) {
    const c = Ch().get(id), a = A().actorOf(id), pl = A().player; if (!c || !a || !pl) return;
    const wasAsleep = B().get(id) && B().get(id).act === 'sleep' && B().get(id).st === 'do';
    B().hold(id, 'call'); if (wasAsleep) M().feel(c, 'annoyed', 0.3, '被叫醒');
    const side = a.x < pl.x ? -1 : 1, p = OC.World.nearestWalkable(pl.x + side * 26, pl.y + 2, 20);
    const arrive = () => { B().face(a, pl); B().face(pl, a); react(c, a, 'call'); M().player(c, { fam: 1 }); setTimeout(() => B().unhold(id, 'call'), 4000); };   // 10.1: waits a moment with you, then goes back to its day (7 s felt like being stuck)
    if (p && Math.hypot(a.x - p.x, a.y - p.y) > 8) { a.run = true; if (!OC.World.walkTo(a, p.x, p.y, () => { a.run = false; arrive(); })) { a.run = false; toast('牠過不來', 'info'); B().unhold(id, 'call'); } } else arrive();
  }
  function itemPicker(title, kinds, onPick) {
    const ids = Object.keys(S().inv).filter((i) => OC.Style.ITEMS[i] && kinds.includes(OC.Style.ITEMS[i].kind));
    sheet(title, (b, api) => {
      if (!ids.length) { b.append(h('div.empty', null, '背包裡沒有可以用的東西'), small('可以去搖果樹、摘花或到雜貨攤買。')); return; }
      b.append(h('div.item-grid', null, ...ids.map((i) => { const im = OC.Style.itemImg(i); im.style.width = im.style.height = '44px'; return h('button.item-btn', { on: { click: () => { api.close(); onPick(i); } } }, im, h('span', null, OC.Style.ITEMS[i].zh), h('small.num', null, '×' + St.count(i))); })));
    });
  }
  // feeding / gifts go through OC.Use (p5pages.js): the item is used only after the OC actually finishes
  function feed(id) { const c = Ch().get(id); itemPicker(`餵${name(c)}吃東西`, ['food', 'drink'], (item) => OC.Use.feed(id, item)); }
  function gift(id) { const c = Ch().get(id); itemPicker(`送禮物給${name(c)}`, ['gift', 'material', 'toy', 'sea', 'bug', 'crop'], (item) => (OC.Items.useKind(item) === 'play' ? OC.Use.play(id, item) : OC.Use.give(id, item))); }
  function play(id) {
    const c = Ch().get(id), a = A().actorOf(id); if (!c || !a) return;
    if (c.needs.energy < 15) { react(c, a, 'decline', { need: true }); M().feel(c, 'tired', 0.2, '太累了'); return; }
    B().hold(id, 'play'); OC.World.setAction(a, 'play', { dur: 3, priority: 7 }); OC.World.jump(a); setTimeout(() => OC.World.jump(a), 900);
    M().needs(c, { fun: 25, active: 12, energy: -5, social: 6 }, '和你玩'); M().feel(c, Ch().behavior(c).emoteScale > 1 ? 'excited' : 'happy', 0.5, '和你一起玩');
    M().player(c, { aff: 2, fam: 1 }); M().wishEvent(c, { type: 'played' }, 'player'); M().skill(c, 'sport', 1);
    M().remember(c, { type: 'player', imp: 0.4, text: '和你一起玩', key: 'play:' + Math.floor(Sim().now() / 120) });
    setTimeout(() => { react(c, a, 'played'); B().unhold(id, 'play'); }, 3000);
  }
  function accompany(id) {
    const me = S().activeId, bm = B().get(me), bo = B().get(id);
    if (!bm || !bo || !bo.a) return;
    if (!B().available(bo)) { toast(`${name(Ch().get(id))}現在${doingText(Ch().get(id)) || '在忙'}，晚點再去吧`, 'info'); return; }
    bm.cmdAt = performance.now() / 1000; bm.st = 'think';
    const kind = Ch().get(me).needs.energy < 60 ? 'restTogether' : 'chat';
    if (!B().Social.start(bm, bo, kind)) toast('附近沒有位置可以待在一起', 'info'); else toast(`陪${name(Ch().get(id))}${D().SOCIAL[kind].zh}`, 'users');
  }
  function chat(id) {
    const c = Ch().get(id), a = A().actorOf(id); if (!c) return;
    B().hold(id, 'dialogue'); OC.Store.stat && OC.Store.stat('talks'); if (OC.Progress) OC.Progress.emit('chat', { oc: id });
    const say = (cat, extra) => { const ln = OC.Talk.say(cat, c, null, extra); return ln ? ln.text : null; };
    const recentWith = M().memories(c, { type: 'social' })[0]; const o = recentWith && recentWith.who[0] && Ch().get(recentWith.who[0]);
    const lines = [say('chat_player', o ? { recentWith: true, act: (recentWith.data && recentWith.data.act) || null } : {}), say('chat_player')].filter(Boolean);
    // Phase 6: the OC sometimes brings up a request you helped with (the story continues)
    const helped = c.life.mem.long.concat(c.life.mem.recent).filter((m) => m.data && m.data.req).sort((x, y) => y.gm - x.gm)[0];
    if (helped && Math.random() < 0.5) { const t = say('req_recall', { vars: { memshort: helped.text.replace(/^你幫我實現了/, '').replace(/[「」]/g, '') } }); if (t) lines.splice(1, 0, t); }
    const neg = D().EMOTIONS[M().dominant(c)].v < -0.2, wish = M().activeWishes(c)[0];
    const choices = [
      { label: '稱讚牠', fx: () => { M().feel(c, Ch().has(c, 'shy') ? 'shy' : 'happy', 0.45, '被你稱讚'); M().player(c, { aff: 2 }); return [say('compliment_r')].filter(Boolean); } },
      { label: '問問今天過得如何', fx: () => { M().player(c, { fam: 1 }); const r = M().recall(c); return [r ? `今天……${r.text}。` : say('talk') || '今天很普通呢。']; } },
      neg ? { label: '鼓勵牠', fx: () => { for (const x of c.life.emo.list) if (!x.need && D().EMOTIONS[x.id].v < 0) x.k *= 0.5; M().feel(c, 'calm', 0.4, '你的鼓勵'); M().player(c, { aff: 3 }); return [say('comfort_r')].filter(Boolean); } } : null,
      wish ? { label: '聊聊願望', fx: () => { M().player(c, { aff: 1 }); return [`我想要……${wish.text}。`, '你會幫我嗎？嘿嘿。']; } } : null,
    ].filter(Boolean);
    M().remember(c, { type: 'player', imp: 0.3, text: '和你聊了天', key: 'chat:' + Math.floor(Sim().now() / 60) }); M().needs(c, { social: 10 });
    if (a) { const pl = A().player; if (pl && pl !== a) { B().face(a, pl); B().face(pl, a); } }
    A().showDialogue(name(c), lines.length ? lines : ['……'], choices, () => B().unhold(id, 'dialogue'), true);
  }
  function schedule(id) {
    const c = Ch().get(id);
    sheet(`安排${name(c)}的活動`, (b, api) => {
      b.append(small('牠會照你的安排去做（正在睡覺或吃飯時會先做完）。沒有自訂動畫時使用內建動作。'),
        h('div.act-grid', { style: { marginTop: '10px' } }, ...Object.entries(D().ACTS).map(([k, x]) => {
          const denied = S().life.settings.deny.includes(k);
          return h('button.act-btn', { disabled: denied, on: { click: () => { api.close(); const r = B().command(id, k); toast(r === 'later' ? `${name(c)}做完手上的事就去${x.zh}` : r ? `已安排：${x.zh}` : '現在無法安排', 'clock'); } } }, h('span.emoji', null, x.ic), h('span', null, x.zh));
        })));
    });
  }

  // ============================== profile sections ==============================
  function emoCard(c) {
    const E = D().EMOTIONS, dom = M().dominant(c), k = M().intensity(c, dom), br = B().get(c.id);
    return card(h('div.hstack', null, h('span.emo-big', null, E[dom].e || '・'), h('div.grow', null, h('b', null, `${E[dom].zh}`), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, doingText(c) || '自由時間'), dom !== 'neutral' ? bar(k * 100, 'var(--need-mood)') : null)),
      br && br.dbg.reason ? small('想法：' + br.dbg.reason) : null,
      c.life.emo.list.filter((x) => x.id !== dom && x.k > 0.12).length ? h('div.hstack', { style: { flexWrap: 'wrap', gap: '4px', marginTop: '8px' } }, ...c.life.emo.list.filter((x) => x.id !== dom && x.k > 0.12).map((x) => h('span.tag', null, `${E[x.id].zh} ${Math.round(x.k * 100)}`))) : null,
      h('div.muted', { style: { fontSize: 'var(--fs-s)', marginTop: '10px' } }, '最近的情緒變化'),
      c.life.emo.recent.length ? h('div.vstack', { style: { gap: '4px', marginTop: '4px' } }, ...c.life.emo.recent.slice(0, 6).map((r) => h('div.emo-cause', null, h('span', null, E[r.id].e || '・'), h('span.grow', null, `${E[r.id].zh}・${r.cause || '—'}`), h('span.faint', null, ago(r.gm))))) : small('還沒有'));
  }
  function routineCard(c) {
    const r = M().routine(c), opts = []; for (let x = 18; x <= 27; x += 0.5) opts.push(x); const wopts = []; for (let x = 4; x <= 12; x += 0.5) wopts.push(x);
    const fmt = (x) => `${String(Math.floor(x % 24)).padStart(2, '0')}:${x % 1 ? '30' : '00'}`;
    const sel = (vals, v, on) => h('select.input', { on: { change: (e) => on(+e.target.value) } }, ...vals.map((x) => h('option', { value: x, selected: Math.abs(x - v) < 0.01 }, fmt(x))));
    const set = (k, v) => { c.life.routine[k] = v; Ch().save(c); };
    return card(h('div.routine-grid', null, h('label', null, h('span.muted', null, '睡覺時間'), sel(opts, r.sleep, (v) => set('sleep', v))), h('label', null, h('span.muted', null, '起床時間'), sel(wopts, r.wake, (v) => set('wake', v)))),
      small(r.auto ? `依個性自動決定${r.early ? '（早起型）' : r.late ? '（夜貓子）' : ''}；改了之後牠會照你的設定作息。` : '你設定的作息。'),
      !r.auto ? h('button.btn.ghost.s', { style: { marginTop: '6px' }, on: { click: () => { c.life.routine = { sleep: null, wake: null }; Ch().save(c); } } }, '改回依個性自動') : null);
  }
  function wishCard(c) {
    const W = c.life.wishes, act = W.filter((w) => w.state === 'active'), done = W.filter((w) => w.state === 'done').slice(0, 3);
    const help = (w) => w.type === 'eat_like' ? h('button.btn.s', { on: { click: () => feed(c.id) } }, '餵牠') : w.type === 'play_player' ? h('button.btn.s', { on: { click: () => play(c.id) } }, '陪牠玩') : null;
    const KZ = { short: '短期', mid: '中期', long: '長期' };
    return card(act.length ? h('div.vstack', { style: { gap: '8px' } }, ...act.map((w) => h('div.hstack', null, h('span.tag.' + (w.kind === 'long' ? 'accent' : w.kind === 'mid' ? 'teal' : 'sun'), null, KZ[w.kind]), h('div.grow', null, w.text, w.n ? small(`進度 ${w.prog}/${w.n}`) : null, small(`還有 ${Math.max(0, Math.round((w.until - Sim().now()) / 60))} 小時`)), help(w)))) : h('span.faint', null, '現在沒有特別的願望'),
      done.length ? h('div', { style: { marginTop: '10px' } }, h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, '最近實現'), ...done.map((w) => small(`✓ ${w.text}${w.by === 'player' ? '（你幫的忙）' : ''}`))) : null,
      small('願望會依照個性、需求、關係與經歷自然出現；可以幫忙，也可以不管——不會有懲罰。'));
  }
  function skillCard(c) {
    return card(...Object.entries(M().SKILLS).map(([k, zh]) => { const xp = c.life.skills[k] || 0, lv = M().skillLv(c, k), lo = 15 * lv * lv, hi = 15 * (lv + 1) * (lv + 1); return h('div.need', null, h('span', { style: { width: '44px' } }, zh), bar(((xp - lo) / (hi - lo)) * 100, 'var(--teal)'), h('span.val.num', null, 'Lv.' + lv)); }));
  }
  function habitCard(c, refresh) {
    const H = c.life.habits, pend = c.growth.suggestions;
    return card(H.length ? h('div.vstack', { style: { gap: '8px' } }, ...H.map((x) => h('div.hstack', null, h('div.grow', null, h('b', null, x.zh), small('原因：' + x.why)), h('button.icon-btn', { 'aria-label': '編輯', on: { click: () => editHabit(c, x, refresh) } }, icon('edit', 's')), h('button.icon-btn', { 'aria-label': '移除', on: { click: async () => { if (await confirm('移除習慣', `移除「${x.zh}」？牠之後不會再因為這個習慣而改變行為。`, '移除', true)) { M().removeHabit(c, x.id); refresh(); } } } }, icon('trash', 's'))))) : h('span.faint', null, '還沒有後天養成的習慣'),
      ...pend.map((s) => h('div', { style: { marginTop: '10px' } }, suggestionCard(c, s, refresh))),
      small('習慣與特質只會在你同意後才加上；拒絕的建議短期內不會再出現。'));
  }
  function editHabit(c, x, refresh) {
    sheet('編輯習慣', (b, api) => { const inp = h('input.input', { value: x.zh, maxlength: 20 }); b.append(inp, h('button.btn.primary.block', { style: { marginTop: '12px' }, on: { click: () => { const v = inp.value.trim(); if (!v) { toast('名稱不能是空的', 'info'); return; } M().editHabit(c, x.id, v); api.close(); refresh(); } } }, '儲存')); });
  }
  /** what stroking has revealed about this OC (discovered by playing: the favourite and the spot it dislikes) */
  function touchCard(c) {
    const K = OC.Touch.known(c), Z = OC.Touch.ZONE_ZH, ks = Object.entries(K.known);
    const loves = ks.filter(([, v]) => v > 0).map(([z]) => Z[z]), nos = ks.filter(([, v]) => v < 0).map(([z]) => Z[z]);
    return card(h('div.hstack', { style: { flexWrap: 'wrap' } },
      ...loves.map((z) => h('span.tag.accent', null, '♥ ' + z)), ...nos.map((z) => h('span.tag', null, '✕ ' + z)),
      !ks.length ? h('span.muted', null, '還不知道。慢慢地在身上來回摸，觀察牠的反應吧。') : null),
      small(`摸過 ${K.n} 次・共 ${Math.round(K.total)} 秒${OC.Touch.taste(c).ticklish ? '・好像很怕癢' : ''}`));
  }
  function lifeSection(c, refresh) {
    const g = c.growth;
    return h('div', null,
      T('現在'), emoCard(c),
      T('需求', '依遊戲時間變化'), card(...D().NEEDS.map((n) => h('div.need', null, h('div.dot', { style: { '--c': n.c } }, icon(n.ic, 's')), h('span', null, n.zh), bar(c.needs[n.id], n.c), h('span.val.num', null, Math.round(c.needs[n.id]))))),
      T('作息'), routineCard(c), T('喜歡被摸的地方', '摸摸看就會知道'), touchCard(c),
      T('願望與目標'), wishCard(c),
      T('技能'), skillCard(c),
      T('後天的習慣'), habitCard(c, refresh),
      g.history.length ? h('div', null, T('成長紀錄'), h('div.list', null, ...g.history.slice(0, 8).map((x) => row(null, `${x.value}`, `${{ accept: '接受', reject: '拒絕', lock: '鎖定不再提出', mute: '關閉同類建議' }[x.decision] || x.decision}・${new Date(x.at).toLocaleDateString('zh-TW')}${x.reason ? '・' + x.reason : ''}`)))) : null,
      T('最近的生活'), card(...(B().get(c.id) && B().get(c.id).a ? [] : c.life.log.slice(0, 5).map((l) => h('div.emo-cause', null, h('span.grow', null, l.text), h('span.faint', null, ago(l.gm))))).concat(M().memories(c, { type: 'activity' }).slice(0, 5).map((m) => h('div.emo-cause', null, h('span.grow', null, m.text), h('span.faint', null, ago(m.gm))))), small('記錄來自 OC 真實做過的事。')));
  }
  const REL_SET = [['auto', '自動（依相處決定）'], ['family', '家人'], ['friend', '朋友'], ['bestfriend', '摯友'], ['rival', '對手'], ['partner', '伴侶'], ['lover', '戀人'], ['custom', '自訂…']];
  function relSection(c, refresh) {
    const others = Ch().all().filter((o) => o.id !== c.id), P = c.life.player;
    const metric = (k, zh, v, col) => h('div.need', null, h('span', { style: { width: '40px' } }, zh), bar(v, col), h('span.val.num', null, Math.round(v)));
    return h('div', null,
      T('和你'), card(metric('aff', '好感', P.aff || 0, 'var(--need-mood)'), metric('fam', '熟悉', P.fam || 0, 'var(--teal)'), small('摸摸頭、餵食、一起玩、聊天都會讓牠更親近你。')),
      T('和其他 OC', `${others.length} 位`),
      others.length ? h('div.vstack', null, ...others.map((o) => {
        const r = M().rel(c.id, o.id), back = M().relPeek(o.id, c.id), days = r.since != null ? Sim().day() - r.since : null;
        return card(h('div.hstack', null, h('b.grow', null, name(o)), h('span.tag.' + (r.fixed ? 'accent' : 'teal'), null, M().relLabel(r) + (r.fixed ? '・你設定的' : '')), h('button.btn.ghost.s', { on: { click: () => setRel(c, o, refresh) } }, '設定')),
          metric('fam', '熟悉', r.fam, 'var(--teal)'), metric('aff', '好感', r.aff, 'var(--need-mood)'), metric('trust', '信任', r.trust, 'var(--need-social)'), metric('intim', '親密', r.intim, 'var(--need-fun)'), r.conflict > 1 ? metric('conflict', '衝突', r.conflict, 'var(--danger)') : null,
          small([days != null && days >= 0 ? `認識 ${days} 天` : '還沒說過話', r.shared.length ? `共同興趣：${r.shared.join('、')}` : null, `共同回憶 ${r.mems} 個`, back ? `${name(o)}覺得牠是「${M().relLabel(back)}」` : null].filter(Boolean).join('・')),
          M().romanceOK(c.id, o.id) ? small('（雙方都已允許戀愛相關事件）') : null);
      })) : h('div.empty', null, '島上只有牠一個 OC；建立更多角色，牠們就會互相認識。'),
      small('關係是有方向的：牠怎麼看對方，不一定等於對方怎麼看牠。你設定的關係不會被自動改變。'));
  }
  function setRel(c, o, refresh) {
    sheet(`${name(c)} 和 ${name(o)} 的關係`, (b, api) => {
      const R = S().life.settings.romance, romanceOK = M().romanceOK(c.id, o.id);
      b.append(small('選擇後雙方都會套用，之後不會被自動改變。選「自動」則回到依相處決定。'),
        h('div.list', { style: { marginTop: '8px' } }, ...REL_SET.map(([k, zh]) => {
          const lockedR = (k === 'lover' || k === 'partner') && !romanceOK;
          return row(null, zh, lockedR ? (R.enabled ? '需要在「生活設定 → 戀愛」把兩位都標示為成年並允許' : '戀愛相關功能預設關閉（生活設定 → 戀愛）') : null, lockedR ? h('span.tag', null, icon('lock', 's'), '未允許') : null, lockedR ? null : async () => {
            let custom = '';
            if (k === 'custom') { custom = await new Promise((res) => sheet('自訂關係名稱', (bb, a2) => { const inp = h('input.input', { maxlength: 10, placeholder: '例如：青梅竹馬' }); bb.append(inp, h('button.btn.primary.block', { style: { marginTop: '10px' }, on: { click: () => { res(inp.value.trim()); a2.close(); } } }, '確定')); }, { onClose: () => res('') })); if (!custom) return; }
            if ((k === 'lover' || k === 'partner') && !(await confirm('重大的關係變化', `要讓${name(c)}和${name(o)}成為${M().TYPES[k]}嗎？`, '確定'))) return;
            M().setRelType(c.id, o.id, k, custom); api.close(); toast('已設定關係', 'heart'); refresh();
          });
        })));
    });
  }
  const MEM_TYPES = [['', '全部'], ['milestone', '里程碑'], ['social', '社交'], ['event', '事件'], ['activity', '活動'], ['player', '和你'], ['growth', '成長'], ['wish', '願望'], ['conflict', '衝突'], ['discover', '發現']];
  function memSection(c, p) {
    const f = p.memF || (p.memF = { time: 'all', type: '', who: '' });
    const since = f.time === 'today' ? Sim().now() - 1440 : f.time === 'week' ? Sim().now() - 7 * 1440 : null;
    const list = M().memories(c, { type: f.type || null, who: f.who || null, since });
    const E = D().EMOTIONS;
    const story = c.life.mem.long.concat(c.life.mem.recent).filter((m) => m.type === 'milestone' || m.imp >= 0.8).sort((a, b) => a.gm - b.gm).slice(-12);
    const typeSel = h('select.input', { on: { change: (e) => { f.type = e.target.value; p.refresh(p); } } }, ...MEM_TYPES.map(([v, zh]) => h('option', { value: v, selected: f.type === v }, zh)));
    const whoSel = h('select.input', { on: { change: (e) => { f.who = e.target.value; p.refresh(p); } } }, h('option', { value: '' }, '所有人'), ...Ch().all().filter((o) => o.id !== c.id).map((o) => h('option', { value: o.id, selected: f.who === o.id }, name(o))));
    const timeSeg = seg([['all', '全部'], ['week', '7 天'], ['today', '今天']], f.time, (v) => { f.time = v; p.refresh(p); });
    return h('div', null,
      T('人生故事', '重要的時刻'), story.length ? h('div.timeline', null, ...story.map((m) => h('div.tl-item', null, h('i'), h('div', null, h('b', null, m.text), small(gmLabel(m.gm)))))) : card(h('span.faint', null, '還沒有重要的時刻——生活會慢慢寫下來')),
      T('回憶', `${list.length} 則`), h('div.vstack', { style: { gap: '8px' } }, timeSeg, h('div.hstack', null, typeSel, whoSel)),
      h('div.vstack', { style: { gap: '6px', marginTop: '8px' } }, ...list.slice(0, 60).map((m) => h('div.mem-item', null, h('span.emo', null, (E[m.emo] && E[m.emo].e) || '・'), h('div.grow', null, h('div', null, m.text), small(`${gmLabel(m.gm)}${m.who.length ? '・' + m.who.map((id) => (Ch().get(id) ? name(Ch().get(id)) : '某位朋友')).join('、') : ''}・${'★'.repeat(Math.max(1, Math.round(m.imp * 3)))}`)),
        m.data && m.data.ev ? h('button.btn.ghost.s', { 'aria-label': '回顧', on: { click: () => replay(c, m) } }, '回顧') : null)), list.length ? null : h('div.empty', null, '沒有符合的回憶')),
      small('短期情緒在「生活」頁；最近的事會慢慢整理成長期回憶，最多保留 150 則重要的。回顧只是重看，不會改變任何進度。'));
  }
  /** replay an event's dialogue (read-only: no flags, cooldowns or results) */
  function replay(c, m) {
    const ev = OC.Events.defs().find((e) => e.id === m.data.ev); if (!ev || !ev.steps) { toast('這個回憶沒有可以回顧的對話', 'info'); return; }
    const other = m.who[0] && Ch().get(m.who[0]);
    const saved = JSON.stringify(S().life.said), flags = JSON.stringify(S().life.flags);
    const lines = ev.steps.filter((s) => s[0] === 'say').map((s) => { const sp = s[1] === 'a' ? c : other; if (!sp) return null; const r = OC.Talk.pick(s[2], sp, s[1] === 'a' ? other : c, { days: other ? Sim().day() - (M().rel(c.id, other.id).since || Sim().day()) : null }); return r ? `${name(sp)}：${OC.Chars.speak(sp, r.text)}` : null; }).filter(Boolean);
    S().life.said = JSON.parse(saved); S().life.flags = JSON.parse(flags);
    A().showDialogue(`回顧・${ev.zh}`, lines.length ? lines : ['（想不起來說了什麼……）'], [], null);
  }

  /** pet sync payload (desktop pet / future App-context lines) */
  function petState(app) {
    const c = Ch().get(S().petId) || Ch().active(); if (!c) return {};
    const line = OC.Talk.say(app ? 'app' : 'chat_player', c, null, { app: app || null });
    return { id: c.id, name: name(c), emotion: M().dominant(c), label: M().label(c), doing: doingText(c), needs: Object.fromEntries(M().NEED_IDS.map((k) => [k, Math.round(c.needs[k])])), line: line ? line.text : null, at: Date.now(),
      // phase 5 (read-only for the pet core): where the OC is, favourite foods, the bag's food the pet could ask for
      place: (() => { const pl = OC.Places && OC.Places.get(c.id === S().activeId && OC.World.area ? OC.World.area.id : c.life.loc || 'isle'); return pl ? pl.zh : null; })(),
      favFoods: OC.Taste ? Object.entries(OC.Taste.prefs(c).food).filter(([, p]) => p.lv === 2).map(([id]) => OC.Style.ITEMS[id] ? OC.Style.ITEMS[id].zh : id).slice(0, 5) : [],
      hasFood: Object.keys(S().inv).some((id) => OC.Items && OC.Items.isFood(id) && OC.Store.count(id) > 0),
      // phase 6 (read-only for the pet core): title, current dream, an open request, top skill — same action names as the game
      title: OC.Growth ? OC.Growth.titleOf(c) || null : null,
      dream: c.life.asp && c.life.asp.id && OC.PlayData ? OC.PlayData.ASPIRATIONS[c.life.asp.id].zh : null,
      request: OC.Requests && OC.Requests.ofOC(c.id) ? OC.Requests.ofOC(c.id).text : null,
      action: (() => { const a = OC.App && OC.App.actorOf(c.id); return a && a.act ? a.act.action : 'idle'; })() };
  }

  // ============================== pages ==============================
  Pg().define('lifeset', '生活設定', {
    sub: true,
    refresh(p, el) {
      const st = S().life.settings, set = (k, v) => { st[k] = v; St.touch('life', { set: k }); };
      const auto = seg([['full', '完整'], ['lessSocial', '少社交'], ['fewerEvents', '少事件'], ['restricted', '限制'], ['paused', '暫停']], st.autonomy, (v) => { set('autonomy', v); p.refresh(p); });
      const R = st.romance, chars = Ch().all();
      el.replaceChildren(
        T('對話語氣'), card(seg([['mature', '沉穩'], ['playful', '活潑']], st.tone === 'playful' ? 'playful' : 'mature', (v) => { set('tone', v); p.refresh(p); }), small(st.tone === 'playful' ? '角色們說話比較誇張、愛用語助詞。' : '角色們說話比較克制、具體，少用驚嘆號與語助詞（預設）。')),
        T('自主程度'), card(auto, small({ full: 'OC 會自己生活、社交、遇到事件。', lessSocial: '比較少主動找人聊天。', fewerEvents: '事件間隔拉長很多。', restricted: '只做吃飯、休息、睡覺等基本的事。', paused: '大家停下自主行動（需求仍會變化，你安排的活動仍會執行）。' }[st.autonomy])),
        T('細節'), card(
          h('button.btn.block', { on: { click: () => controlSheet() } }, icon('sparkle', 's'), '各角色的操控模式…'), small('每個角色各自設定：手動（只聽你的；肚子餓、很睏才自己處理）、半自動（預設：自己生活，你一下指令牠就聽你的）、全自動。'),
          h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, 'OC 可以自己去別的地方'), toggle(st.travel !== false, (v) => set('travel', v))), small('關閉時，大家留在目前的地點生活（你仍然可以帶操控中的角色到處走）。'),
          h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, 'OC 會向你提出請求'), toggle(st.requests !== false, (v) => set('requests', v))),
          h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, 'OC 會自己找人生目標'), toggle(st.aspAuto !== false, (v) => set('aspAuto', v))), small('關閉後不會自動產生，你仍然可以在角色檔案「成長」幫牠選。'),
          h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '顯示自言自語泡泡'), toggle(st.bubbles, (v) => set('bubbles', v))),
          h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '成長建議（新習慣／特質）'), toggle(st.growth, (v) => set('growth', v))),
          h('div.hstack', { style: { marginTop: '10px' } }, h('span.grow', null, '鎖定關係的自動變化'), toggle(st.lockRel, (v) => set('lockRel', v)))),
        T('不做的活動', '勾掉的活動不會自動進行'), h('div.chips', null, ...Object.entries(D().ACTS).map(([k, x]) => { const on = !st.deny.includes(k); return h('button.chip-btn' + (on ? '.on' : ''), { on: { click: () => { st.deny = on ? st.deny.concat(k) : st.deny.filter((d) => d !== k); St.touch('life'); p.refresh(p); } } }, `${x.ic} ${x.zh}`); })),
        T('戀愛', '預設關閉'), card(h('div.hstack', null, h('span.grow', null, '允許戀愛相關事件'), toggle(R.enabled, (v) => { R.enabled = v; St.touch('life'); p.refresh(p); })),
          small('只有你標示為「成年」的角色才會參與；成為戀人或伴侶一定要經過你同意。也可以禁止特定配對。'),
          R.enabled ? h('div', { style: { marginTop: '10px' } }, h('div.muted', null, '成年角色'), h('div.chips', null, ...chars.map((c) => h('button.chip-btn' + (R.adult[c.id] ? '.on' : ''), { on: { click: () => { R.adult[c.id] = !R.adult[c.id]; St.touch('life'); p.refresh(p); } } }, name(c) + (c.profile.age ? `（${c.profile.age}）` : ''))))) : null,
          R.enabled && chars.length > 1 ? h('div', { style: { marginTop: '10px' } }, h('div.muted', null, '禁止的配對'), h('div.chips', null, ...pairs(chars).map(([a, b]) => { const k = [a.id, b.id].sort().join('|'), on = R.forbid.includes(k); return h('button.chip-btn' + (on ? '.on' : ''), { on: { click: () => { R.forbid = on ? R.forbid.filter((x) => x !== k) : R.forbid.concat(k); St.touch('life'); p.refresh(p); } } }, `${name(a)} × ${name(b)}`); }))) : null),
        T('內容'), h('div.list', null, row('chat', '對話與事件資料', '自訂台詞、匯入／匯出', null, () => Pg().open('dialogue')), S().settings.dev ? row('target', '開發者診斷', '需求、情緒、候選分數、事件條件', null, () => Pg().open('lifedev')) : null));
    },
  });
  const pairs = (cs) => { const o = []; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) o.push([cs[i], cs[j]]); return o; };

  Pg().define('dialogue', '對話與事件', {
    sub: true,
    refresh(p, el) {
      const L = S().life.dlg, cats = OC.Talk.CATS(); p.cat = p.cat || 'greet';
      const fileIn = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, on: { change: async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const txt = await f.text(); const v = OC.Talk.validate(txt); if (!v.ok) { sheet('無法匯入', (b) => b.append(...v.errors.slice(0, 8).map((x) => h('p', null, '・' + x)))); return; } const mode = await confirm('匯入對話／事件', `${v.lines.length} 句台詞、${v.events.length} 個事件${v.warnings.length ? `（${v.warnings.length} 個提醒）` : ''}。要加到現有內容嗎？（取消＝不匯入）`, '加入'); if (!mode) return; const r = OC.Talk.importData(txt, 'merge'); toast(`已匯入 ${r.added} 句、${r.addedEvents} 個事件`, 'check'); p.refresh(p); } } });
      const preview = (l) => { const c = Ch().active(); const others = Ch().all().filter((o) => o.id !== c.id); const X = OC.Talk.ctx(c, others[0] || null, {}); const t = OC.Talk.fill(l.text, X); toast(t ? `${name(c)}：${OC.Chars.speak(c, t)}` : '缺少變數（例如沒有回憶或願望），這句現在不會被說出', 'chat'); };
      const builtin = D().LINES.filter((l) => l.cat === p.cat);
      el.replaceChildren(
        small('台詞依分類、條件（性格、情緒、需求、關係、時間、天氣…）、權重與冷卻挑選，同一分類在不同 OC 身上會有不同說法。格式見 docs/life-format.md。'),
        h('div.hstack', { style: { marginTop: '10px', flexWrap: 'wrap', gap: '6px' } }, h('button.btn.s.primary', { on: { click: () => editLine(null, p) } }, icon('plus', 's'), '新增台詞'), h('button.btn.s', { on: { click: () => fileIn.click() } }, icon('upload', 's'), '匯入'), h('button.btn.s', { on: { click: () => { OC.IO.deliver(new Blob([OC.Talk.exportData()], { type: 'application/json' }), 'oc-dialogue.json'); } } }, icon('download', 's'), '匯出自訂內容'), h('button.btn.s', { on: { click: () => OC.IO.deliver(new Blob([OC.Talk.exportData({ builtin: true })], { type: 'application/json' }), 'oc-dialogue-all.json') } }, '匯出全部（範本）'), fileIn),
        T('我的台詞', `${L.custom.length} 句`), L.custom.length ? h('div.list', null, ...L.custom.map((l) => row(null, l.text, `${l.cat}${l.char ? '・只有' + name(Ch().get(l.char) || { profile: { name: '?' } }) : ''}${l.c ? '・條件 ' + Object.keys(l.c).join('、') : ''}`, h('div.hstack', { style: { gap: 0 } }, h('button.icon-btn', { 'aria-label': '試說', on: { click: (e) => { e.stopPropagation(); preview(l); } } }, icon('play', 's')), h('button.icon-btn', { 'aria-label': '刪除', on: { click: (e) => { e.stopPropagation(); OC.Talk.removeLine(l.id); p.refresh(p); } } }, icon('trash', 's'))), () => editLine(l, p)))) : card(h('span.faint', null, '還沒有自訂台詞')),
        L.events.length ? h('div', null, T('匯入的事件', `${L.events.length} 個`), h('div.list', null, ...L.events.map((e) => row(null, e.zh || e.id, `觸發：${e.trigger}${e.disabled ? '・已停用' : ''}`, toggle(!e.disabled, (v) => { e.disabled = !v; St.touch('life'); }))))) : null,
        T('內建台詞'), h('select.input', { on: { change: (e) => { p.cat = e.target.value; p.refresh(p); } } }, ...cats.map((k) => h('option', { value: k, selected: k === p.cat }, k))),
        h('div.list', { style: { marginTop: '8px' } }, ...builtin.map((l) => row(null, l.text, l.c ? Object.entries(l.c).map(([k, v]) => `${k}:${JSON.stringify(v)}`).join(' ') : '任何情況', toggle(!L.off.includes(l.id), (v) => OC.Talk.toggleBuiltin(l.id, v))))));
    },
  });
  function editLine(l, p) {
    sheet(l ? '編輯台詞' : '新增台詞', (b, api) => {
      const cat = h('input.input', { value: l ? l.cat : p.cat, list: 'oc-cats' }), dl = h('datalist', { id: 'oc-cats' }, ...OC.Talk.CATS().map((k) => h('option', { value: k })));
      const text = h('textarea.input', { rows: 2, maxlength: 120, placeholder: '例如：{other}，今天也一起玩吧！' }); text.value = l ? l.text : '';
      const who = h('select.input', null, h('option', { value: '' }, '所有角色'), ...Ch().all().map((c) => h('option', { value: c.id, selected: l && l.char === c.id }, name(c))));
      const cond = h('textarea.input', { rows: 3, placeholder: '{"wx":["rain"],"need":{"food":"<40"}}' }); cond.value = l && l.c ? JSON.stringify(l.c) : '';
      const w = h('input.input', { type: 'number', min: 0, step: 0.5, value: l ? l.w || 1 : 1 });
      b.append(h('div.muted', null, '分類'), cat, dl, h('div.muted', { style: { marginTop: '8px' } }, '台詞（變數：{name} {other} {like} {hobby} {place} {wx} {time} {mem} {wish} {act} {item} {days}）'), text,
        h('div.muted', { style: { marginTop: '8px' } }, '誰會說'), who, h('div.muted', { style: { marginTop: '8px' } }, '條件（JSON，可留空）'), cond, small('可用：' + OC.Talk.KNOWN.join('、')), h('div.muted', { style: { marginTop: '8px' } }, '權重'), w,
        h('button.btn.primary.block', { style: { marginTop: '12px' }, on: { click: () => {
          let c = null; if (cond.value.trim()) { try { c = JSON.parse(cond.value); } catch (e) { toast('條件不是有效的 JSON', 'info'); return; } }
          const rec = { cat: cat.value.trim(), text: text.value.trim(), c, w: +w.value || 1, char: who.value || undefined };
          const r = l ? OC.Talk.updateLine(l.id, rec) : OC.Talk.addLine(rec);
          if (r && r.e && r.e.length) { toast(r.e[0], 'info'); return; } if (r && r.w && r.w.length) toast(r.w[0], 'info');
          api.close(); p.refresh(p);
        } } }, '儲存'));
    });
  }

  Pg().define('lifedev', '開發者診斷', {
    sub: true,
    build(p, el) { p.box = h('div'); el.append(small('只在開發者模式顯示（關於頁連點版本號 5 次，或網址加 ?dev=1）。每秒更新。'), p.box); },
    onShow(p) { clearInterval(p.timer); p.timer = setInterval(() => { if (!p.el.classList.contains('open')) { clearInterval(p.timer); return; } render(p); }, 1000); },
    refresh(p) { render(p); },
  });
  function render(p) {
    const L = S().life, E = D().EMOTIONS;
    const sp = seg(Sim().SPEEDS.map((v) => [String(v), '×' + v]), String(Sim().speed()), (v) => { Sim().setSpeed(+v); });
    p.box.replaceChildren(
      T('模擬時鐘'), card(small(`模式 ${Sim().mode()}・遊戲時間 ${gmLabel(Sim().now())}・每現實秒 ${Sim().rate().toFixed(3)} 遊戲分鐘・步數 ${Sim().steps}・離線 ${L.offline ? JSON.stringify(L.offline) : '—'}`), Sim().mode() === 'cycle' ? sp : small('（自動循環模式才有速度）'), h('div.hstack', { style: { marginTop: '8px' } }, h('button.btn.s', { on: { click: () => { Sim().advance(60); render(p); } } }, '快轉 60 分'), h('button.btn.s', { on: { click: () => { OC.Events.update(5); toast('已檢查事件', 'info'); } } }, '檢查事件'))),
      ...Object.values(B().brains).map((b) => { const c = Ch().get(b.id); if (!c) return null; return card(h('b', null, `${name(c)}（${b.manual ? '操控' : '自主'}・${b.st}${b.holds.size ? '・暫停：' + [...b.holds].join(',') : ''}）`),
        small(`活動 ${b.act || '—'}・剩 ${b.until ? Math.round(b.until - Sim().now()) : '—'} 分・位置 ${b.slot ? b.slot.k : '—'}・想法：${b.dbg.reason || '—'}`),
        small('需求 ' + M().NEED_IDS.map((k) => `${k}:${Math.round(c.needs[k])}`).join(' ')),
        small('情緒 ' + (c.life.emo.list.map((x) => `${E[x.id].zh}${x.k.toFixed(2)}${x.need ? '*' : ''}`).join(' ') || '—') + `・主導 ${E[M().dominant(c)].zh}`),
        h('div.dev-table', null, ...(b.dbg.cands || []).map((x) => h('div', null, h('span', null, x.id), h('span.num', null, x.s.toFixed(2)), h('span.faint', null, x.why))))); }),
      T('事件條件', '最近一次檢查'), card(...(OC.Events.diag.slice(0, 16).map((d) => small(`${d.ok ? '✓' : '·'} ${d.id}・${name(Ch().get(d.a) || { profile: { name: '?' } })}${d.b ? '→' + name(Ch().get(d.b) || { profile: { name: '?' } }) : ''}・${d.why || ''}`))).concat(OC.Events.current ? [small(`進行中：${OC.Events.current.ev.id} 第 ${OC.Events.current.i} 步`)] : [])),
      T('最近的變化'), card(...M().changes.slice(0, 20).map((x) => small(`${ago(x.gm)}・${x.who ? name(Ch().get(x.who) || { profile: { name: '?' } }) : '系統'}・${x.kind}・${x.text}`))),
      T('決策紀錄'), card(...B().log.slice(0, 20).map((x) => small(`${ago(x.gm)}・${name(Ch().get(x.who) || { profile: { name: '?' } })}・${x.text}`))),
      T('預約中的位置'), card(small([...B().res.entries()].map(([k, v]) => `${k}→${name(Ch().get(v) || { profile: { name: '?' } })}`).join('、') || '—')));
  }

  // ---------------- 12.0 control modes ----------------
  const CTL = [['manual', '手動', 'move', '只照你說的做；肚子餓、很睏時才自己處理。'], ['semi', '半自動', 'sparkle', '自己生活（計畫、目標、社交都會），你下指令或碰牠時，牠會先聽你的。預設。'], ['auto', '全自動', 'zap', '完全自己生活，只有在你親手帶牠走的時候才停下來。']];
  const ctlZh = (m) => (CTL.find((x) => x[0] === m) || CTL[1])[1];
  /** the quick sheet: every character's mode at a glance, one tap to change (also from the HUD: long-press your avatar) */
  function controlSheet() {
    sheet('操控模式', (b) => {
      const rows = h('div.vstack', { style: { gap: '10px' } });
      const all = seg(CTL.map(([v, zh, ic]) => [v, zh, ic]), '', (v) => { for (const c of Ch().all()) OC.Brain.setControl(c.id, v); build(); });
      const build = () => {
        rows.replaceChildren(...Ch().all().map((c) => { const m = OC.Brain.ctlOf ? (c.life.control || 'semi') : 'semi'; return h('div.ctl-row', null, h('div.hstack', null, avatarOf(c, 36), h('b.grow', null, name(c) + (c.id === S().activeId ? '（操控中）' : '')), h('span.faint', null, ctlZh(m))), seg(CTL.map(([v, zh, ic]) => [v, zh, ic]), m, (v) => { OC.Brain.setControl(c.id, v); build(); })); }));
      };
      build();
      b.append(small('半自動是預設：角色們用完整的 AI 自己生活，你隨時可以改。'), h('div.ctl-help', null, ...CTL.map(([v, zh, , d]) => h('div', null, h('b', null, zh), h('span.faint', null, ' ' + d)))), rows, h('div.muted', { style: { margin: '14px 0 6px' } }, '全部角色一次設定'), all);
    });
  }
  const avatarOf = (c, px) => { const cv = h('canvas', { width: px * 2, height: px * 2 }); cv.style.cssText = `width:${px}px;height:${px}px;border-radius:50%;background:var(--surface-2);flex:none`; A().live(cv, () => ({ char: Ch().get(c.id), pose: { face: 0.2 } })); return cv; };
  OC.LifeUI = { controlSheet, ctlZh, CTL, routineCard, doingText, noticeCount, pushNotice, notices, interact, think, pet, hug, highfive, poke, handhold, endHand, tick, call, feed, gift, play, accompany, chat, schedule, lifeSection, relSection, memSection, suggestionCard, petState, replay, gmLabel, ago };
})();
