/* OC Shimeji — character creation flow (first launch & "new character").
 * Methods: preset | scratch | import (player images / GIF / sprite frames) | mixed (preset → customise).
 * Steps: method → look → profile → personality → traits → quirks → tastes → speech → debut.
 * Only the name is required; every other step can be skipped and edited later.
 */
(function () {
  'use strict';
  const { h, icon, toast, seg, haptic } = OC.UI;
  const Ch = () => OC.Chars, CE = () => OC.CharEdit;

  function start(o = {}) {
    return new Promise((resolve) => {
      let c = Ch().blank('custom'); c.profile.name = '';
      let method = null, step = 0, level = 'simple', finished = false;
      const el = h('div.onb.creator', { role: 'dialog', 'aria-label': '建立角色' });
      const dots = h('div.dots'), stepTitle = h('h2', { style: { margin: '0', flex: 1, fontSize: 'var(--fs-xl)' } });
      const backBtn = h('button.icon-btn', { 'aria-label': '上一步', on: { click: () => go(step - 1) } }, icon('back'));
      const closeBtn = o.first ? null : h('button.icon-btn', { 'aria-label': '取消', on: { click: async () => { if (await OC.UI.confirm('取消建立角色', '目前的設定不會保存。', '取消建立', true)) close(null); } } }, icon('close'));
      const skipBtn = h('button.btn.ghost.s', { on: { click: () => go(step + 1) } }, '略過');
      const stageBox = h('div', { style: { flex: 'none' } });
      const body = h('div', { style: { flex: 1, overflowY: 'auto', touchAction: 'pan-y', padding: '0 2px 16px' } });
      const next = h('button.btn.primary.block', { on: { click: () => onNext() } });
      el.append(h('div.hstack', { style: { gap: '4px' } }, backBtn, stepTitle, skipBtn, closeBtn), dots, stageBox, body, next);
      Object.assign(el.style, { padding: 'calc(var(--sat) + 10px) 16px calc(var(--sab) + 16px)', gap: '6px' });
      document.getElementById('app').append(el);
      const layer = { scrim: false, dismissible: !o.first, close: () => (o.first ? null : close(null)) }; OC.UI.pushLayer(layer);
      const stage = CE().stage(() => c, { size: 260, onPart: () => {} });
      stage.el.style.maxHeight = '30vh'; stage.canvas.style.maxHeight = '28vh'; stage.canvas.style.width = 'auto';
      const ctx = { get level() { return level; }, stage, selected: null, changed: (kind, reactAction) => { c.updated = Date.now(); if (reactAction && typeof reactAction === 'string') stage.react(reactAction, 1.3); }, rebuild: () => render(), full: false };
      const STEPS = [
        { id: 'method', t: '你想怎麼開始？' },
        { id: 'look', t: '外觀' },
        { id: 'profile', t: '名字與資料' },
        { id: 'personality', t: '性格', skip: true },
        { id: 'traits', t: '特質', skip: true },
        { id: 'quirks', t: '小怪癖', skip: true },
        { id: 'tastes', t: '喜好', skip: true },
        { id: 'speech', t: '說話方式', skip: true },
        { id: 'debut', t: '準備登場！' },
      ];
      function go(i) { if (i < 0) return; if (i >= STEPS.length) return; if (i > 2 && !c.profile.name.trim()) { step = 2; render(); toast('請先取個名字', 'edit'); return; } step = i; body.scrollTop = 0; render(); }
      function onNext() {
        const s = STEPS[step].id;
        if (s === 'method') { if (!method) { toast('選一種開始方式', 'info'); return; } }
        if (s === 'profile' && !c.profile.name.trim()) { toast('角色需要一個名字', 'edit'); return; }
        if (s === 'debut') { debut(); return; }
        haptic(); go(step + 1);
      }
      function render() {
        const s = STEPS[step];
        stepTitle.textContent = s.t; backBtn.style.visibility = step ? 'visible' : 'hidden'; skipBtn.style.visibility = s.skip ? 'visible' : 'hidden';
        dots.replaceChildren(...STEPS.map((_, i) => h('i', { class: i === step ? 'on' : '' })));
        next.replaceChildren(s.id === 'debut' ? icon('sparkle', 's') : null, s.id === 'debut' ? '登場！' : '下一步');
        stageBox.replaceChildren(s.id === 'method' ? h('div.center', { style: { margin: '4px 0 8px' } }, h('div.logo', { style: { fontSize: o.first ? '34px' : '24px' } }, 'OC ', h('b', null, 'Shimeji')), o.first ? h('p.muted', { style: { margin: '6px 0 0' } }, '創造你的原創角色，讓他住進小島與手機桌面。') : null) : stage.el);
        stage.restart();
        body.replaceChildren(...build(s.id));
      }
      function card(id, title, desc, ic) {
        return h('button.card', { style: { display: 'flex', gap: '12px', alignItems: 'center', width: '100%', textAlign: 'left', marginTop: '10px', boxShadow: method === id ? '0 0 0 2.5px var(--accent), var(--shadow-1)' : null }, on: { click: () => choose(id) } },
          h('span', { style: { width: '44px', height: '44px', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)', flex: 'none' } }, icon(ic)), h('span', null, h('b', null, title), h('div.muted', { style: { fontSize: 'var(--fs-s)' } }, desc)));
      }
      async function choose(id) {
        method = id; haptic();
        if (id === 'scratch') { c = Ch().blank('custom'); CE().randomize(c, 'simple'); c.look.shirt = 'none'; level = 'detailed'; }
        if (id === 'preset' || id === 'mixed') { c = Ch().fromPreset('mochi'); c.origin = id === 'mixed' ? 'mixed' : 'preset'; if (id === 'mixed') c.profile.name = ''; level = id === 'mixed' ? 'detailed' : 'simple'; }
        if (id === 'import') {
          const files = await OC.Library.chooseFiles({ multiple: true, accept: 'image/*,.gif,.png,.webp,.zip' }); if (!files || !files.length) { method = null; render(); return; }
          c = Ch().blank('import');
          try { await OC.Library.spriteCharFromFiles(c, files); } catch (e) { toast(e.message, 'info'); method = null; render(); return; }
          c.profile.name = files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]?\d+$/, '').slice(0, 12);
        }
        render();
      }
      function build(id) {
        const S_ = CE().sections;
        if (id === 'method') {
          const presets = h('div.grid.c3', { style: { marginTop: '8px' } }, ...Object.entries(OC.Style.PRESETS).map(([k, v]) => { const b = h('button.tile', { 'data-v': k, on: { click: () => { c = Ch().fromPreset(k); method = method === 'mixed' ? 'mixed' : 'preset'; [...presets.children].forEach((x) => x.classList.toggle('on', x.dataset.v === k)); if (method === 'mixed') c.profile.name = ''; render(); } } }, CE().mini(Ch().fromPreset(k)), v.name); return b; }));
          return [card('preset', '使用預設角色', '從原創小夥伴中挑一位，馬上開始', 'person'), method === 'preset' || method === 'mixed' ? presets : null,
            card('scratch', '從零創建', '自由捏臉、調比例、配色與服裝', 'edit'), card('import', '匯入圖片角色', '用自己畫的 PNG／GIF／多張連續圖片／ZIP', 'image'), card('mixed', '預設＋自訂', '以預設角色為底，再改成自己的樣子', 'layers'),
            o.first ? h('p.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '14px' } }, '預設的小貓「麻糬」只是選項之一；之後隨時可以新增更多角色。') : null].filter(Boolean);
        }
        if (id === 'look') {
          const lv = seg([['simple', '簡易'], ['detailed', '詳細']], level, (v) => { level = v; render(); });
          if (c.appearance.mode === 'sprite') return [h('div.card', null, h('b', null, '外觀來自你的圖片'), h('p.muted', { style: { fontSize: 'var(--fs-s)' } }, '之後可以在動畫工作室為不同動作加入更多影格，或在「部件」加上飾品。')), S_.body(c, ctx), S_.parts(c, ctx)];
          const out = [lv, S_.template(c, ctx), S_.earsTail(c, ctx), S_.colors(c, ctx), S_.face(c, ctx), S_.outfit(c, ctx)];
          if (level === 'detailed') out.splice(2, 0, S_.body(c, ctx)), out.push(S_.parts(c, ctx));
          out.push(S_.expressions(c, ctx));
          return out;
        }
        if (id === 'profile') { ctx.full = level === 'detailed'; return [S_.profile(c, Object.assign(ctx, { level }))]; }
        if (id === 'personality') return [S_.personality(c, ctx)];
        if (id === 'traits') return [S_.traits(c, ctx)];
        if (id === 'quirks') return [S_.quirks(c, ctx)];
        if (id === 'tastes') return [S_.tastes(c, ctx)];
        if (id === 'speech') return [S_.speech(c, ctx)];
        if (id === 'debut') {
          const traits = c.personality.traits.map((t) => (Ch().TRAITS.find((q) => q.id === t) || {}).zh).concat(c.personality.customTraits.map((t) => t.name)).filter(Boolean);
          return [h('div.card', null, h('h2', { style: { margin: '0 0 4px' } }, c.profile.name || '（未命名）'), h('div.tag.teal', null, Ch().typeTitle(c)),
            h('div.hstack', { style: { flexWrap: 'wrap', gap: '6px', marginTop: '10px' } }, ...traits.map((t) => h('span.tag.accent', null, t))),
            c.profile.intro ? h('p', null, c.profile.intro) : null,
            h('p.muted', { style: { fontSize: 'var(--fs-s)' } }, `${Ch().QUIRKS.walk.opts.find((q) => q[0] === c.quirks.walk)[1]}地走路・${Ch().QUIRKS.greet.opts.find((q) => q[0] === c.quirks.greet)[1]}打招呼・說話${Ch().SPEECH.find((q) => q[0] === c.speech.style)[1]}`)),
            h('p.faint', { style: { fontSize: 'var(--fs-xs)', marginTop: '12px' } }, '所有設定之後都能在「角色 → 編輯」修改。')];
        }
        return [];
      }
      function debut() {
        const p = c.personality, b = Ch().behavior(c);
        const act = p.energy > 65 ? 'jump' : (c.personality.traits.includes('shy') || p.social < 35) ? 'shy' : p.expression > 65 ? 'surprised' : 'greet';
        next.disabled = true; stage.react(act, 1.6); haptic();
        const line = h('div.speech', { style: { position: 'absolute', left: '50%', top: '8px', transform: 'translateX(-50%)', animation: 'toast-in 300ms both' } }, Ch().speak(c, c.speech.catchphrase || (act === 'shy' ? '請、請多指教…' : '大家好！我是' + c.profile.name + '！')));
        stage.el.append(line);
        if (act === 'surprised') setTimeout(() => stage.react('happy', 1.2), 900);
        setTimeout(() => { line.remove(); finish(); }, 1900 + (b.emoteScale > 1 ? 300 : 0));
      }
      function finish() {
        c.profile.name = c.profile.name.trim(); c.created = c.updated = Date.now();
        const first = !Ch().all().length;
        Ch().add(c, { activate: first || o.activate });
        if (o.first) OC.Store.s.onboarded = true;
        OC.Store.persist(); close(c);
      }
      function close(result) { if (finished) return; finished = true; OC.UI.popLayer(layer); el.style.transition = 'opacity 320ms'; el.style.opacity = 0; setTimeout(() => el.remove(), 340); resolve(result); }
      render();
    });
  }
  OC.Creator = { start };
})();
