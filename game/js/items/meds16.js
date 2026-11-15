/* OC Shimeji 16.11 — medicine and the keepsake (original art, 24-unit box like every item icon).
 * Medicine is an ordinary item: bought at 晴日雜貨攤, used from the bag (drinks are drunk, the plaster and the patch are given).
 * What it does is decided by OC.Health16.treat() from the Progress stream (eat / gift), never here.
 */
(function () {
  'use strict';
  const I = OC.Style.ITEMS, TAU = Math.PI * 2, mix = OC.mix;
  const shade = (col, d = 0.25) => mix(col, '#3a2030', d);
  const fillR = (c, x, y, w, h, r, col) => { c.fillStyle = shade(col); OC.rr(c, x + 0.9, y + 1.1, w, h, r); c.fill(); c.fillStyle = col; OC.rr(c, x, y, w, h, r); c.fill(); };
  const shine = (c, x, y, rx, ry) => { c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
  const ART = {
    medbottle(c, a, b) { fillR(c, 8, 3, 8, 4, 1, b); fillR(c, 5, 7, 14, 14, 3, a); fillR(c, 7.5, 11, 9, 6, 1, '#FFFFFF'); c.fillStyle = '#F26B5B'; c.fillRect(11, 12, 2, 4); c.fillRect(10, 13, 4, 2); shine(c, 8, 9.5, 1.6, 0.8); },
    teacup(c, a, b) { fillR(c, 4, 10, 13, 10, 4, a); c.strokeStyle = shade(a); c.lineWidth = 1.6; c.beginPath(); c.arc(18, 14.5, 3, -1.2, 1.2); c.stroke(); c.fillStyle = b; c.beginPath(); c.ellipse(10.5, 10.5, 5.6, 1.6, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(160,140,120,.7)'; c.lineWidth = 0.9; for (const x of [8, 12]) { c.beginPath(); c.moveTo(x, 8); c.quadraticCurveTo(x - 1.5, 5.5, x, 3); c.stroke(); } },
    plaster(c, a) { c.save(); c.translate(12, 12); c.rotate(-0.6); fillR(c, -10, -3.5, 20, 7, 3.5, a); c.fillStyle = mix(a, '#FFFFFF', 0.45); OC.rr(c, -4, -2.5, 8, 5, 1); c.fill(); c.fillStyle = shade(a, 0.3); for (const [x, y] of [[-7, -1], [-7, 1.5], [6, -1], [6, 1.5]]) c.fillRect(x, y, 0.8, 0.8); c.restore(); },
    patch(c, a, b) { fillR(c, 4, 5, 16, 14, 2, a); c.strokeStyle = b; c.lineWidth = 1; c.setLineDash([1.5, 1.2]); OC.rr(c, 6, 7, 12, 10, 1); c.stroke(); c.setLineDash([]); shine(c, 8, 7.5, 2, 0.7); },
    frame(c, a, b) { fillR(c, 3, 3, 18, 18, 2, a); c.fillStyle = b; OC.rr(c, 6, 6, 12, 12, 1); c.fill(); c.fillStyle = '#F2DCA2'; c.beginPath(); c.arc(12, 11, 2.6, 0, TAU); c.fill(); c.beginPath(); c.ellipse(12, 17, 4, 2.6, 0, Math.PI, TAU); c.fill(); shine(c, 7.5, 7, 1.6, 0.6); },
  };
  Object.assign(OC.ItemArt, ART);
  const F = (zh, kind, o) => Object.assign({ zh, kind, rarity: 1, tags: ['med'], src: ['晴日雜貨攤'] }, o);
  const NEW = {
    coldmed16: F('感冒藥', 'drink', { price: 60, sell: 10, use: { comfort: 4 }, d: '治感冒和發燒。吃了要多休息。', art: { t: 'medbottle', a: '#9BD4F0', b: '#3F7FBF' } }),
    tummymed16: F('胃藥', 'drink', { price: 50, sell: 8, use: { comfort: 4 }, d: '吃壞肚子的時候喝一點。', art: { t: 'medbottle', a: '#F2DCA2', b: '#8A6A4A' } }),
    gingertea16: F('薑茶', 'drink', { price: 40, sell: 8, use: { comfort: 8, food: 4 }, temp: 'hot', flavor: { spicy: 1, sweet: 1 }, d: '暖暖的，感冒、肚子痛、老是咳嗽都舒服一點。', art: { t: 'teacup', a: '#F7EFE2', b: '#D9A26A' } }),
    bandage16: F('OK 繃', 'gift', { price: 25, sell: 5, d: '貼在擦傷上。（送給受傷的角色）', art: { t: 'plaster', a: '#E8B48A' } }),
    patch16: F('痠痛貼布', 'gift', { price: 45, sell: 8, d: '關節痠痛的時候貼一片，舒服一整天。', art: { t: 'patch', a: '#FFFFFF', b: '#7FB89A' } }),
    keepsake16: F('紀念相框', 'gift', { price: 0, sell: 0, rarity: 3, tags: ['keep'], src: ['道別'], d: '告別時留下的相框。裡面的人在「健康」App 的紀念欄。', art: { t: 'frame', a: '#C89A5A', b: '#FFF7EC' } }),
  };
  for (const [id, it] of Object.entries(NEW)) if (!I[id]) I[id] = it;
  const SH = OC.Shops && OC.Shops.SHOPS;
  if (SH && SH.general && SH.general.items) for (const id of ['coldmed16', 'tummymed16', 'gingertea16', 'bandage16', 'patch16']) if (!SH.general.items.includes(id)) SH.general.items.push(id);
  OC.Meds16 = { NEW, ART };
})();
