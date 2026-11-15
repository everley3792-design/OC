/* OC Shimeji 16.7 — new props: toys and things to leave on the ground (original art, 24-unit box like every item icon).
 * Each is a normal item in OC.Style.ITEMS (bought in a shop, used from the bag like any toy); put on the ground, characters
 * play with it in their own way (OC.Aware.PLAY_AS: harmonica → music, sketchbook → drawing, puzzle / cards → puzzling).
 */
(function () {
  'use strict';
  const I = OC.Style.ITEMS, TAU = Math.PI * 2, mix = OC.mix;
  const shade = (c, col, d = 0.25) => mix(col, '#3a2030', d);
  const fillE = (c, x, y, rx, ry, col, rot = 0) => { c.fillStyle = shade(c, col); c.beginPath(); c.ellipse(x + 0.9, y + 1.1, rx, ry, rot, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); };
  const fillR = (c, x, y, w, h, r, col) => { c.fillStyle = shade(c, col); OC.rr(c, x + 0.9, y + 1.1, w, h, r); c.fill(); c.fillStyle = col; OC.rr(c, x, y, w, h, r); c.fill(); };
  const line = (c, pts, col, w = 1) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); };
  const shine = (c, x, y, rx, ry) => { c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
  const ART = {
    disc(c, a, b) { fillE(c, 12, 13, 9.5, 5.5, a); c.strokeStyle = b; c.lineWidth = 1.2; c.beginPath(); c.ellipse(12, 12.6, 6, 3.2, 0, 0, TAU); c.stroke(); shine(c, 8.5, 11, 2, 0.9); },
    bubbles(c, a) { fillR(c, 4, 13, 6, 8, 1.6, a); line(c, [[7, 13], [10, 6]], '#8A6A4A', 1); c.strokeStyle = '#8A6A4A'; c.lineWidth = 1; c.beginPath(); c.arc(11, 5, 2, 0, TAU); c.stroke();
      for (const [x, y, r] of [[16, 8, 3.4], [19.5, 14, 2.2], [14.5, 15.5, 1.6]]) { c.fillStyle = 'rgba(190,230,255,.5)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(120,170,220,.9)'; c.lineWidth = 0.7; c.stroke(); shine(c, x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.2); } },
    rope(c, a, b) { line(c, [[6, 7], [5, 13], [8, 19], [12, 20.5], [16, 19], [19, 13], [18, 7]], a, 1.4); for (const x of [6, 18]) fillR(c, x - 1.8, 3, 3.6, 6, 1.4, b); },
    plane(c, a) { c.fillStyle = shade(c, a, 0.15); c.beginPath(); c.moveTo(3, 13); c.lineTo(21, 6); c.lineTo(12, 18); c.closePath(); c.fill(); c.fillStyle = a; c.beginPath(); c.moveTo(3, 13); c.lineTo(21, 6); c.lineTo(11, 13.5); c.closePath(); c.fill(); line(c, [[11, 13.5], [12, 18]], shade(c, a, 0.3), 0.7); },
    top(c, a, b) { c.fillStyle = shade(c, a); c.beginPath(); c.moveTo(4.5, 10); c.quadraticCurveTo(12, 6, 19.5, 10); c.lineTo(12.5, 21); c.lineTo(11.5, 21); c.closePath(); c.fill(); c.fillStyle = a; c.beginPath(); c.moveTo(4.5, 10); c.quadraticCurveTo(12, 6, 19.5, 10); c.lineTo(12, 19); c.closePath(); c.fill();
      c.fillStyle = b; c.beginPath(); c.moveTo(7, 11); c.lineTo(17, 11); c.lineTo(15.5, 13); c.lineTo(8.5, 13); c.closePath(); c.fill(); fillR(c, 11, 3, 2, 5, 0.8, '#8A6A4A'); },
    marbles(c, a, b) { for (const [x, y, col] of [[8, 14, a], [15, 15, b], [11.5, 9, '#FFD23F'], [17, 9.5, '#5FBF62']]) { fillE(c, x, y, 3.6, 3.6, col); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x + 0.5, y + 0.4, 1.8, 0.8, 0.6, 0, TAU); c.fill(); shine(c, x - 1.2, y - 1.3, 0.9, 0.6); } },
    harmonica(c, a) { fillR(c, 3, 9, 18, 7, 2, '#D8DDE6'); c.fillStyle = a; c.fillRect(3, 11, 18, 3); for (let i = 0; i < 7; i++) { c.fillStyle = '#3B2B25'; c.fillRect(4.6 + i * 2.3, 11.8, 1.2, 1.4); } shine(c, 7, 10, 3, 0.6); },
    puzzle(c, a, b) { const P = [[4, 4, a], [12, 4, b], [4, 12, '#FFC93C'], [12, 12, '#3FC1B0']]; for (const [x, y, col] of P) fillR(c, x, y, 7.6, 7.6, 1, col); for (const [x, y] of [[11.6, 7.8], [7.8, 11.6], [15.8, 11.6], [11.6, 15.8]]) { c.fillStyle = '#FFF7EC'; c.beginPath(); c.arc(x, y, 1.4, 0, TAU); c.fill(); } },
    cards(c, a, b) { for (const [x, r, col] of [[6, -0.3, b], [10, 0, '#FFFFFF'], [14, 0.3, b]]) { c.save(); c.translate(x + 2.5, 18); c.rotate(r); fillR(c, -4, -13, 8, 12, 1.4, col); c.restore(); } c.fillStyle = a; c.font = 'bold 6px sans-serif'; c.fillText('♥', 9.6, 12.5); },
    sketch(c, a) { fillR(c, 4, 4, 15, 17, 1.6, a); fillR(c, 6, 6, 11, 13, 0.8, '#FFFFFF'); line(c, [[8, 15], [10, 11], [12, 14], [14, 9], [15.5, 12]], '#3FA7D6', 0.9); for (let i = 0; i < 5; i++) line(c, [[5 + i * 3, 3.2], [5 + i * 3, 5]], '#8A6A4A', 0.8); line(c, [[17, 21], [21, 13]], '#F2B33D', 1.6); },
    bucket(c, a, b) { c.fillStyle = shade(c, a); c.beginPath(); c.moveTo(5, 9); c.lineTo(19, 9); c.lineTo(17, 21); c.lineTo(7, 21); c.closePath(); c.fill(); c.fillStyle = a; c.beginPath(); c.moveTo(5, 9); c.lineTo(19, 9); c.lineTo(17.3, 20); c.lineTo(7.2, 20); c.closePath(); c.fill();
      fillE(c, 12, 9, 7, 2.2, '#F2DCA2'); c.strokeStyle = shade(c, a, 0.4); c.lineWidth = 1; c.beginPath(); c.arc(12, 9, 6.5, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); fillR(c, 16, 3, 2, 8, 1, b); },
    basket(c, a, b) { c.fillStyle = shade(c, a); c.beginPath(); c.moveTo(3.5, 11); c.lineTo(20.5, 11); c.lineTo(18.5, 21); c.lineTo(5.5, 21); c.closePath(); c.fill(); c.fillStyle = a; c.beginPath(); c.moveTo(3.5, 11); c.lineTo(20.5, 11); c.lineTo(18.7, 20); c.lineTo(5.3, 20); c.closePath(); c.fill();
      for (let i = 0; i < 4; i++) line(c, [[5 + i * 0.5, 13 + i * 2], [19 - i * 0.5, 13 + i * 2]], shade(c, a, 0.35), 0.6); c.fillStyle = b; c.fillRect(6, 9.5, 12, 2.6); for (let i = 0; i < 4; i++) { c.fillStyle = '#FFFFFF'; c.fillRect(6 + i * 3, 9.5, 1.5, 1.3); c.fillRect(7.5 + i * 3, 10.8, 1.5, 1.3); }
      c.strokeStyle = shade(c, a, 0.3); c.lineWidth = 1.3; c.beginPath(); c.arc(12, 11, 6, Math.PI, TAU); c.stroke(); },
  };
  Object.assign(OC.ItemArt, ART);
  const F = (zh, kind, o) => Object.assign({ zh, kind, rarity: 1, tags: [], src: [] }, o);
  const NEW = {
    frisbee: F('飛盤', 'toy', { price: 90, sell: 30, use: { fun: 22, active: 14 }, d: '放在草地上，總有人會想丟一下。', src: ['禮品店'], art: { t: 'disc', a: '#3FC1B0', b: '#FFFFFF' } }),
    bubbles: F('泡泡水', 'toy', { price: 50, sell: 15, use: { fun: 16, mood: 3 }, d: '吹出來的泡泡會飄很遠。', src: ['禮品店'], art: { t: 'bubbles', a: '#F28DB2' } }),
    jumprope: F('跳繩', 'toy', { price: 70, sell: 25, use: { fun: 14, active: 22 }, d: '跳一百下比想像中難。', src: ['禮品店'], art: { t: 'rope', a: '#F26B5B', b: '#FFC93C' } }),
    paperplane: F('紙飛機', 'toy', { price: 20, sell: 5, use: { fun: 10, interest: 4 }, d: '摺好的紙飛機。順風的時候飛最遠。', src: ['禮品店'], art: { t: 'plane', a: '#FFFFFF' } }),
    spintop: F('木頭陀螺', 'toy', { price: 80, sell: 30, use: { fun: 16, interest: 6 }, d: '轉得好的話可以轉一分鐘。', src: ['禮品店'], art: { t: 'top', a: '#E0884A', b: '#FFF7EC' } }),
    marbles: F('彈珠', 'toy', { price: 60, sell: 20, use: { fun: 14, interest: 8 }, d: '一袋玻璃彈珠，對著光看很漂亮。', src: ['禮品店'], art: { t: 'marbles', a: '#5A9BE0', b: '#F26B5B' } }),
    harmonica: F('口琴', 'toy', { price: 160, sell: 60, rarity: 2, use: { fun: 18, interest: 12 }, d: '吹得好不好不重要。', src: ['禮品店'], art: { t: 'harmonica', a: '#9B7BE0' } }),
    puzzle: F('小拼圖', 'toy', { price: 110, sell: 40, use: { fun: 12, interest: 18 }, d: '一百片。缺一片的話會很在意。', src: ['禮品店'], art: { t: 'puzzle', a: '#F26B5B', b: '#9B7BE0' } }),
    cards: F('紙牌', 'toy', { price: 60, sell: 20, use: { fun: 16, interest: 10 }, d: '一副紙牌，一個人也能玩。', src: ['禮品店'], art: { t: 'cards', a: '#F26B5B', b: '#F2DCA2' } }),
    sketchbook: F('素描本', 'toy', { price: 120, sell: 45, use: { fun: 12, interest: 18 }, d: '空白的本子和一支色鉛筆。', src: ['禮品店'], art: { t: 'sketch', a: '#8A5A3C' } }),
    sandbucket: F('沙灘水桶', 'toy', { price: 70, sell: 25, use: { fun: 18, active: 10 }, d: '堆沙堡用的。', src: ['禮品店'], art: { t: 'bucket', a: '#FFC93C', b: '#3FC1B0' } }),
    picnic: F('野餐籃', 'food', { price: 140, sell: 50, use: { food: 26, fun: 10, social: 6 }, flavor: { sweet: 1, umami: 1 }, temp: 'cold', d: '三明治和水果。放在地上大家都能吃。', src: ['食品店', '風車磨坊'], art: { t: 'basket', a: '#D9A26A', b: '#F26B5B' } }),
  };
  for (const [id, it] of Object.entries(NEW)) if (!I[id]) I[id] = it;
  const SH = OC.Shops && OC.Shops.SHOPS;
  if (SH) {
    const addTo = (shop, ids) => { const s = SH[shop]; if (s && s.items) for (const id of ids) if (!s.items.includes(id)) s.items.push(id); };
    addTo('gift', ['frisbee', 'bubbles', 'jumprope', 'paperplane', 'spintop', 'marbles', 'harmonica', 'puzzle', 'cards', 'sketchbook', 'sandbucket']);
    addTo('food', ['picnic']); addTo('mill', ['picnic']);
  }
  OC.Props16 = { NEW, ART };
})();
