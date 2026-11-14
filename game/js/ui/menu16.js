/* OC Shimeji 16.4 — what the menus offer (OC.Menu16). The ring around a character keeps its everyday actions (one tap does it);
 * the category entries (親近、互動、餵食、送禮、玩耍、安排、更多) open their items in a panel inside the same menu — never a second ring,
 * never a sheet. Nothing asks "are you sure?": a request goes straight into the character's action list and a toast offers 「復原」.
 * A long press on an item = 「立刻做」 (it goes first). Objects advertise what can be done with them (OC.Menu16.objectActs).
 */
(function () {
  'use strict';
  const Ch = () => OC.Chars, D = () => OC.LifeData, S = () => OC.Store.s, A = () => OC.App, L = () => OC.LifeUI, M = () => OC.Mind, B = () => OC.Brain;
  const name = (c) => Ch().name(c);
  const NIGHT = ['evening', 'night', 'late'];

  /** put a request in the list (or start it) and offer to take it back */
  function request(id, spec, o, text) {
    const c = Ch().get(id); if (!c) return false;
    const r = OC.Queue.add(id, spec, { now: !!(o && o.now) }); if (r === 'young') return false;
    if (r === false) { OC.UI.toast('清單滿了（最多 8 個）——先取消一項', 'info'); return false; }
    const k = OC.Queue.last;
    OC.Radial.undoToast(`${name(c)}：${text}${r === 'queued' ? '（排進清單）' : ''}${o && o.now ? '（立刻）' : ''}`, () => OC.Queue.cancelKey(id, k));
    OC.Store.emit('menu16:request', { id, spec, r });
    return r;
  }

  // ---------------------------------------------------------------- 「安排」: everything it can do, by kind, with where
  const CAT_TABS = [['need', '需求'], ['fun', '玩樂'], ['rest', '休息'], ['body', '運動'], ['chore', '家事'], ['away', '去別處']];
  const CAT_OF = (A0) => (A0.cat === 'need' ? 'need' : A0.cat === 'rest' ? 'rest' : A0.cat === 'body' ? 'body' : A0.cat === 'chore' ? 'chore' : 'fun');
  function slotHere(c, act) { const A0 = D().ACTS[act]; if (!A0.verb || A0.verb === 'wander' || A0.verb === 'explore') return true; return B().aff.some((o) => o.verbs.includes(A0.verb)); }
  function actItems(id, tab) {
    const c = Ch().get(id); if (!c) return [];
    const out = [];
    for (const [act, A0] of Object.entries(D().ACTS)) {
      if (A0.cmdOnly && act !== 'work') continue; if (OC.Growth && !OC.Growth.allowed(c, act)) continue;
      const here = slotHere(c, act), away = !here && OC.Acts16 ? OC.Acts16.placesFor(act).filter((p) => p !== (OC.World.area && OC.World.area.id)) : [];
      const young = OC.People && !OC.People.canDo(c, act) ? OC.People.whyNot(c, act) : null;
      if (tab === 'away') { if (here || !away.length) continue; const pl = away[0], P = OC.Places.get(pl); out.push({ id: act, ic: A0.ic, label: `${A0.zh}・${P.zh}`, off: young, now: true, run: (o) => request(id, { kind: 'act', act, place: pl }, o, `去${P.zh}${A0.zh}`) }); continue; }
      if (CAT_OF(A0) !== tab) continue;
      let off = young; if (!off && !here) off = away.length ? `這裡沒有，可以到「去別處」安排` : '這附近沒有可以' + A0.zh + '的地方';
      if (!off && OC.Acts16 && !OC.Acts16.fits(act)) off = A0.night ? '要等到晚上' : '現在看不到';
      out.push({ id: act, ic: A0.ic, label: A0.zh, off, now: true, run: (o) => request(id, act, o, A0.zh) });
    }
    return out;
  }
  const arrange = (id) => ({ tabs: CAT_TABS, tab: 'need', note: '點一下＝排進清單；長按＝立刻做', items: (tab) => actItems(id, tab), empty: '這一類這裡沒有可以做的' });

  // ---------------------------------------------------------------- the player's own care (data only through Mind APIs)
  const careAt = (c, k) => ((c.life.care16 = c.life.care16 || {})[k] || -1e9);
  function care(id, kind) {
    const c = Ch().get(id), a = A().actorOf(id); if (!c || !a) return;
    const now = OC.Sim.now(), cd = careAt(c, kind) > now - 20, asleep = B().get(id) && B().get(id).act === 'sleep' && B().get(id).st === 'do';
    const say = (cat) => { const ln = OC.Talk.say(cat, c, null); if (ln) A().bubble(a, ln.text, name(c)); };
    if (kind === 'tuck') {
      if (!asleep) { OC.UI.toast(`${name(c)}沒有在睡覺`, 'info'); return; }
      if (!cd) { M().needs(c, { comfort: 10 }); M().player(c, { aff: 0.6 }); M().remember(c, { type: 'player', imp: 0.35, text: '睡覺時你幫我蓋了被子', key: 'tuck:' + c.id + ':' + OC.Sim.day() }); c.life.care16.tuck = now; }
      A().floatText(a, '♡', 'var(--heart)'); OC.UI.haptic('purr'); return;
    }
    if (asleep) { OC.UI.toast(`${name(c)}在睡覺`, 'info'); return; }
    B().hold(id, 'pet'); setTimeout(() => B().unhold(id, 'pet'), 1900);
    if (kind === 'groom') { OC.World.setAction(a, 'nuzzle', { dur: 1.8, priority: 7 }); if (!cd) { M().needs(c, { comfort: 6, social: 3 }); M().player(c, { aff: 0.6 }); M().feel(c, 'content', 0.3, '被你梳毛'); c.life.care16.groom = now; } say('pet'); }
    if (kind === 'cheer') { const low = ['down', 'tired', 'lonely', 'annoyed', 'worried', 'nervous'].includes(M().dominant(c)); OC.World.setAction(a, low ? 'nod' : 'cheer', { dur: 1.6, priority: 7 }); if (!cd) { M().feel(c, low ? 'happy' : 'excited', low ? 0.35 : 0.2, '你幫我打氣'); M().player(c, { aff: low ? 1 : 0.4 }); c.life.care16.cheer = now; } say(low ? 'comfort_r' : 'compliment_r'); }
    OC.Store.emit('touch:pet', { id, peak: 0.5, care: kind });
  }

  // ---------------------------------------------------------------- items from the bag
  function bagItems(kinds, run) {
    const inv = S().inv || {}, out = [];
    for (const [k, n] of Object.entries(inv)) { const it = OC.Style.ITEMS[k]; if (!it || !n || !kinds.includes(OC.Items.kindOf ? OC.Items.kindOf(k) : it.kind)) continue; out.push({ id: k, ic: it.ic || '🎁', label: `${it.zh}${n > 1 ? '×' + n : ''}`, run: () => run(k) }); }
    return out.slice(0, 18);
  }

  // ---------------------------------------------------------------- the ring around a character
  function charRing(id) {
    const c = Ch().get(id), a = A().actorOf(id), me = Ch().get(S().activeId), self = id === S().activeId, b = B().get(id);
    const asleep = b && b.act === 'sleep' && b.st === 'do', sl = asleep ? '正在睡覺' : null, busy = b && b.holds.has('event') ? '正在特別的事情中' : null;
    const closeness = { tab: null, items: [
      { ic: 'paw', label: '摸頭', off: sl, run: () => L().pet(id) },
      { ic: 'heart', label: '抱抱', off: sl || busy, run: () => L().hug(id) },
      { ic: 'hand', label: '擊掌', off: sl || busy, run: () => L().highfive(id) },
      { ic: 'sparkle', label: '戳戳', off: sl || busy, run: () => L().poke(id) },
      self ? null : { ic: 'users', label: '牽手', off: sl || busy, run: () => L().handhold(id) },
      { ic: '🪮', label: '梳毛', off: sl || busy, run: () => care(id, 'groom') },
      { ic: '📣', label: '打氣', off: sl || busy, run: () => care(id, 'cheer') },
      asleep ? { ic: '🛏', label: '蓋被子', run: () => care(id, 'tuck') } : null] };
    const social = () => {
      const tabs = OC.Will.CATS.filter(([k]) => k !== 'own' || Object.values(OC.Will.INTER).some((x) => x.own === me.id)).map(([k, zh]) => [k, zh]);
      return { tabs, tab: (S().life.ui16 && S().life.ui16.cat) || 'talk', note: `${name(me)} 對 ${name(c)}・😊😐🙁 是大概的反應`, items: (tab) => { (S().life.ui16 = S().life.ui16 || {}).cat = tab; return Object.values(OC.Will.INTER).filter((x) => x.cat === tab && (!x.own || x.own === me.id)).map((x) => { const hh = OC.Will.hint(c, me, x.id), lock = hh.face === '🔒' ? (OC.People && (OC.People.minor(me) || OC.People.minor(c)) ? '未成年不會有戀愛相關的互動' : '要在生活設定為兩人打開戀愛功能') : null; return { id: x.id, ic: x.ic, label: x.zh, hint: S().life.settings.willHint !== false && !lock ? hh.face : null, off: lock, now: true, run: (o) => request(me.id, { kind: 'social', other: id, social: x.id, label: `${x.zh}（${name(c)}）`, ic: x.ic }, o, `${x.zh}・${name(c)}`) }; }); } };
    };
    const items = [
      self ? null : { ic: 'users', label: `${name(me)}的互動`, main: true, off: busy, sub: social },
      { ic: 'heart', label: '親近', main: self, sub: () => closeness },
      { ic: 'chat', label: self ? '打招呼' : '聊天', off: sl || busy, run: () => (self ? A().greetFrom(a, c) : L().chat(id)) },
      { ic: 'apple', label: '餵食', off: busy, sub: () => ({ items: bagItems(['food', 'drink'], (k) => OC.Use.feed(id, k)), empty: '背包裡沒有吃的（商店、採集、釣魚、料理都能拿到）' }) },
      { ic: 'gift', label: '送禮', off: busy, sub: () => ({ items: bagItems(['gift', 'material', 'toy', 'sea', 'bug', 'crop'], (k) => (OC.Items.useKind(k) === 'play' ? OC.Use.play(id, k) : OC.Use.give(id, k))), empty: '背包裡沒有可以送的東西' }) },
      { ic: 'dice', label: '玩耍', off: sl || busy, sub: () => ({ items: [{ ic: 'dice', label: '陪牠玩', run: () => L().play(id) }, OC.Fun ? { ic: 'hand', label: '猜拳', run: () => OC.Fun.rps(id) } : null, OC.Fun && !self ? { ic: 'eye', label: '躲貓貓', run: () => OC.Fun.hide(id) } : null] }) },
      { ic: 'clock', label: '安排', sub: () => arrange(id) },
      self ? { ic: 'eye', label: '跟拍', run: () => A().setCamMode('focus', a) } : { ic: 'hand', label: '叫過來', off: busy, run: () => L().call(id) },
      { ic: 'person', label: '檔案', run: () => OC.Pages.open('profile', { id }) },
      { ic: 'more', label: '更多', sub: () => ({ items: [
        { ic: 'sparkle', label: '在想什麼', run: () => L().think(id) },
        { ic: 'eye', label: '觀察', run: () => A().observe(id) },
        self ? null : { ic: 'users', label: '陪伴', run: () => L().accompany(id) },
        self ? null : { ic: 'person', label: '改操控牠', run: () => { Ch().setActive(id); } },
        { ic: 'brush', label: '編輯角色', run: () => OC.Pages.open('charedit', { id }) },
        { ic: 'clock', label: '清空清單', off: OC.Queue.list(id).length ? null : '清單是空的', run: () => { OC.Queue.clear(id); OC.UI.toast('清單已清空', 'info'); } }] }) },
    ];
    return { title: name(c), sub: `${M().label(c)}${L().doingText(c) ? '・' + L().doingText(c) : ''}`, items: items.filter(Boolean) };
  }

  // ---------------------------------------------------------------- the ground: walk, or do something right here
  const HERE = ['dance', 'spin', 'stretch', 'workout', 'daydream', 'meditate', 'diary', 'photo', 'stargaze', 'cloudwatch', 'sweep', 'sing'];
  function groundAt(p) {
    const me = S().activeId, c = Ch().get(me), out = [];
    for (const act of HERE) {
      const A0 = D().ACTS[act]; if (!A0) continue; if (OC.Growth && !OC.Growth.allowed(c, act)) continue;
      const young = OC.People && !OC.People.canDo(c, act) ? OC.People.whyNot(c, act) : null, fits = !OC.Acts16 || OC.Acts16.fits(act);
      out.push({ id: act, ic: A0.ic, label: A0.zh, now: true, off: young || (fits ? null : A0.night ? '要等到晚上' : '現在看不到'), run: (o) => request(me, { kind: 'act', act, pt: { x: p.x, y: p.y } }, o, `在這裡${A0.zh}`) });
    }
    return { note: '走到這裡再做', items: out };
  }

  // ---------------------------------------------------------------- what a thing in the world offers
  const OBJ_EXTRA = { tree: ['treehug', 'photo'], bed: ['smell', 'photo'], bench: ['daydream', 'diary'], fishing: ['photo'], critter: ['photo'], towel: ['cloudwatch', 'stargaze'] };
  function objectActs(it) {
    const me = S().activeId, c = Ch().get(me); if (!c) return [];
    const x = it.at ? it.at.x : it.x, y = it.at ? it.at.y : it.y;
    const o = B().aff.find((q) => q.id === it.id || (Math.abs(q.x - it.x) < 1.5 && Math.abs(q.y - it.y) < 1.5)) || null;
    const out = [];
    if (o) for (const [act, A0] of Object.entries(D().ACTS)) {
      if (!A0.verb || !o.verbs.includes(A0.verb) || A0.cmdOnly) continue; if (OC.Growth && !OC.Growth.allowed(c, act)) continue;
      const slot = o.slots.find((s) => B().free(s, me)); const young = OC.People && !OC.People.canDo(c, act) ? OC.People.whyNot(c, act) : null;
      out.push({ label: `${A0.ic || ''} ${A0.zh}`.trim(), off: young || (slot ? null : '都有人在用'), run: () => request(me, { kind: 'act', act, slot: slot && slot.k, label: `${A0.zh}・${o.zh}`, ic: A0.ic }, null, `${A0.zh}（${o.zh}）`) });
    }
    for (const act of OBJ_EXTRA[it.type] || []) {
      const A0 = D().ACTS[act]; if (!A0) continue; const fits = !OC.Acts16 || OC.Acts16.fits(act);
      out.push({ label: `${A0.ic || ''} ${A0.zh}`.trim(), off: fits ? null : A0.night ? '要等到晚上' : '現在看不到', run: () => request(me, { kind: 'act', act, pt: { x, y: y + 6 }, label: A0.zh, ic: A0.ic }, null, A0.zh) });
    }
    return out;
  }

  OC.Menu16 = { request, charRing, groundAt, objectActs, actItems, care, CAT_TABS };
})();
