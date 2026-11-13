/* OC Shimeji 15.0 — OC.Photo: photo mode and the album.
 * Photo mode hides every piece of HUD, lets you move / zoom / turn the camera with your fingers as usual, pick a filter and a frame, and
 * take the picture. A photo is the 3D view (with the characters in it) plus the frame, kept in the asset store (IndexedDB, never in the
 * save JSON) and listed in the album (S().photos = [{ id, at, place, filter, frame }], newest first, at most MAX).
 * The filter is drawn into the photo itself. While photo mode is open the same filter previews on the view — that is the one place a
 * CSS filter sits on the 3D canvas, and only for as long as you are framing a picture.
 */
(function () {
  'use strict';
  const { h, toast, haptic, icon } = OC.UI;
  const S = () => OC.Store.s, St = OC.Store, W = () => OC.World;
  const MAX = 40;
  const FILTERS = [['none', '原色', 'none'], ['warm', '暖陽', 'sepia(.22) saturate(1.25) brightness(1.04)'], ['dusk', '黃昏', 'sepia(.35) hue-rotate(-12deg) saturate(1.3) contrast(1.05)'],
    ['film', '底片', 'contrast(.92) saturate(.82) brightness(1.06) sepia(.12)'], ['cool', '清晨', 'hue-rotate(10deg) saturate(.9) brightness(1.06)'], ['mono', '黑白', 'grayscale(1) contrast(1.08)']];
  const FRAMES = [['none', '無'], ['polaroid', '拍立得'], ['stamp', '郵票'], ['round', '圓角']];
  let cur = null;
  const photos = () => (S().photos = Array.isArray(S().photos) ? S().photos : []);

  function open() {
    if (cur) return; if (OC.App && OC.App.tab) OC.App.tab('island');
    const st = { filter: 'none', frame: 'none' };
    const bar = h('div.photo-bar', { role: 'toolbar', 'aria-label': '拍照' });
    const filt = h('div.photo-chips'), frm = h('div.photo-chips');
    const draw = () => {
      filt.replaceChildren(...FILTERS.map(([k, zh]) => h('button.chip-btn' + (st.filter === k ? '.on' : ''), { on: { click: () => { haptic('tick'); st.filter = k; draw(); } } }, zh)));
      frm.replaceChildren(...FRAMES.map(([k, zh]) => h('button.chip-btn' + (st.frame === k ? '.on' : ''), { on: { click: () => { haptic('tick'); st.frame = k; draw(); } } }, zh)));
      document.getElementById('world').style.filter = (FILTERS.find((f) => f[0] === st.filter) || FILTERS[0])[2];
      el.dataset.frame = st.frame;
    };
    const shutter = h('button.photo-shutter', { 'aria-label': '拍照', on: { click: () => take(st) } }, h('i'));
    bar.append(h('div.photo-row', null, h('small', null, '濾鏡'), filt), h('div.photo-row', null, h('small', null, '相框'), frm),
      h('div.photo-act', null, h('button.btn.s', { on: { click: () => { close(); OC.Pages.open('album'); } } }, OC.UI.sticker('book', 's'), '相簿'), shutter, h('button.btn.s', { on: { click: () => close() } }, icon('close', 's'), '離開')));
    const el = h('div.photo-mode', null, h('div.photo-frame', { 'aria-hidden': 'true' }), h('div.photo-flash', { 'aria-hidden': 'true' }), bar);
    document.getElementById('app').append(el); document.body.classList.add('photo');
    const layer = { scrim: false, close: () => close() }; OC.UI.pushLayer(layer);
    cur = { el, layer, st }; draw(); OC.Pick && OC.Pick.guard(bar);
    St.emit('photo:open', {}); toast('用手指移動、縮放鏡頭，找好角度再按快門', 'camera');
  }
  function close() {
    if (!cur) return; const c = cur; cur = null;
    OC.UI.popLayer(c.layer); c.el.remove(); document.body.classList.remove('photo'); document.getElementById('world').style.filter = '';
    St.emit('photo:close', {});
  }

  /** compose the picture: the view, the filter baked in, the frame, a small date stamp */
  function compose(st) {
    const src = W().snapshot(), w = src.width, hh = src.height, pad = st.frame === 'polaroid' ? Math.round(w * 0.05) : st.frame === 'stamp' ? Math.round(w * 0.04) : 0;
    const foot = st.frame === 'polaroid' ? Math.round(w * 0.16) : pad;
    const c = OC.makeCanvas(w + pad * 2, hh + pad + foot), x = c.getContext('2d');
    x.fillStyle = st.frame === 'stamp' ? '#FFF9E3' : '#FFFCF4'; x.fillRect(0, 0, c.width, c.height);
    x.save(); if (st.frame === 'round') { const r = Math.round(w * 0.06); x.beginPath(); x.roundRect(0, 0, w, hh, r); x.clip(); }
    x.filter = (FILTERS.find((f) => f[0] === st.filter) || FILTERS[0])[2]; x.drawImage(src, pad, pad); x.filter = 'none'; x.restore();
    if (st.frame === 'stamp') { x.fillStyle = 'rgba(0,0,0,0)'; const r = pad * 0.45; x.globalCompositeOperation = 'destination-out'; for (let i = r * 1.4; i < c.width; i += r * 2.6) { x.beginPath(); x.arc(i, 0, r, 0, 7); x.arc(i, c.height, r, 0, 7); x.fill(); } for (let i = r * 1.4; i < c.height; i += r * 2.6) { x.beginPath(); x.arc(0, i, r, 0, 7); x.arc(c.width, i, r, 0, 7); x.fill(); } x.globalCompositeOperation = 'source-over'; }
    const place = OC.Places && W().area && OC.Places.get(W().area.id) ? OC.Places.get(W().area.id).zh : '';
    const label = `${new Date().toLocaleDateString('zh-TW')}  ${place}`;
    if (st.frame === 'polaroid') { x.fillStyle = '#6F5438'; x.font = `${Math.round(foot * 0.26)}px Huninn, sans-serif`; x.textAlign = 'center'; x.fillText(label, c.width / 2, hh + pad + foot * 0.58); }
    else { x.font = `${Math.round(w * 0.032)}px Nunito, sans-serif`; x.textAlign = 'right'; x.fillStyle = 'rgba(255,190,90,.95)'; x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 3; x.fillText(new Date().toLocaleDateString('zh-TW'), c.width - pad - w * 0.04, hh + pad - w * 0.04); }
    return { canvas: c, place: W().area ? W().area.id : null };
  }

  async function take(st) {
    if (!cur || cur.busy) return; cur.busy = true; haptic('confirm'); OC.Sound && OC.Sound.play('tap');
    const fl = cur.el.querySelector('.photo-flash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
    try {
      const { canvas, place } = compose(st);
      const rec = await OC.Assets.put(canvas, { kind: 'photo', name: '照片', owner: null, tags: ['photo'] });
      const list = photos(); list.unshift({ id: rec.id, at: Date.now(), place, filter: st.filter, frame: st.frame });
      while (list.length > MAX) { const old = list.pop(); OC.Assets.remove && OC.Assets.remove(old.id).catch(() => {}); }
      St.touch('photos'); St.emit('photo:taken', { id: rec.id }); OC.Progress && OC.Progress.emit('photo', { place });
      toast(`拍好了，收進相簿（${list.length}/${MAX}）`, 'camera');
    } catch (e) { console.error(e); toast('拍照失敗：' + (e && e.message || e), 'info'); }
    if (cur) cur.busy = false;
  }

  /* ---- the album (a page) ---- */
  OC.Pages.define('album', '相簿', {
    sub: true,
    build(p, el) { p.box = h('div'); el.append(p.box); },
    refresh(p) {
      const L = photos(), sig = L.map((x) => x.id).join(','); if (p._sig === sig) return; p._sig = sig;
      if (!L.length) { p.box.replaceChildren(h('div.empty', null, '還沒有照片。在「口袋手機 › 拍照」找好角度按下快門，照片就會收進這裡。'), h('button.btn.primary.block', { on: { click: () => open() } }, OC.UI.sticker('camera', 's'), '去拍照')); return; }
      p.box.replaceChildren(h('div.muted', { style: { margin: '0 4px 10px', fontSize: 'var(--fs-s)' } }, `${L.length} 張（最多 ${MAX} 張，太多時最舊的會被移除）`),
        h('div.album-grid', null, ...L.map((x) => { const im = h('img', { alt: '照片', loading: 'lazy' }); OC.Assets.thumbURL(x.id).then((u) => { if (u) im.src = u; }).catch(() => {}); return h('button.album-cell', { 'aria-label': '照片 ' + new Date(x.at).toLocaleString('zh-TW'), on: { click: () => view(x) } }, im); })));
    },
  });
  function view(x) {
    const im = h('img.album-big', { alt: '照片' }); OC.Assets.dataURL(x.id).then((u) => { if (u) im.src = u; }).catch(() => {});
    const place = x.place && OC.Places.get(x.place) ? OC.Places.get(x.place).zh : '';
    OC.UI.sheet(new Date(x.at).toLocaleString('zh-TW'), (b, api) => b.append(h('div', null, im, h('div.muted', { style: { margin: '8px 2px', fontSize: 'var(--fs-s)' } }, place),
      h('div.hstack', { style: { gap: '8px' } }, h('button.btn.primary.grow', { on: { click: async () => { const b = await OC.Assets.blob(x.id); if (b) await OC.IO.deliver(b, `oc-photo-${new Date(x.at).toISOString().slice(0, 10)}-${x.id.slice(-4)}.png`); } } }, '儲存／分享'),
        h('button.btn', { on: { click: async () => { if (!(await OC.UI.confirm('刪除這張照片？', '刪除後無法復原。', '刪除', true))) return; const L = photos(), i = L.findIndex((y) => y.id === x.id); if (i >= 0) L.splice(i, 1); OC.Assets.remove && OC.Assets.remove(x.id).catch(() => {}); St.touch('photos'); api.close(); } } }, '刪除')))));
  }

  OC.Photo = { open, close, take: () => cur && take(cur.st), compose, FILTERS, FRAMES, MAX, get open_() { return !!cur; }, get state() { return cur ? Object.assign({}, cur.st) : null; } };
})();
