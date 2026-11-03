/* Visual style overview board (2560x1440) composed from live prototype frames +
 * each scheme's own primitives (palette, type, icons, character turnaround). */
(function (G) {
  'use strict';
  const OC = G.OC;

  const CFG = {
    mallow: () => {
      const { P, FONT, ZH, icon } = OC.M;
      return {
        bg: '#FBF3EE', panel: '#FFFFFF', ink: P.ink, sub: P.ink2, accent: P.coral,
        title: '方案 A · 棉霧島 Mallow Mist', tagline: '柔霧黏土質感 · 無描邊 · 漂浮式極簡 HUD · 慢節奏彈簧動畫',
        hFont: ZH(46), bFont: ZH(24), sFont: ZH(20), nFont: ZH(18), latin: FONT(600, 22),
        palette: [['奶霜', P.paper], ['蜜桃', P.peach], ['珊瑚', P.coral], ['薰衣草', P.lav], ['天空', P.sky], ['薄荷', P.mint], ['奶油', P.butter], ['玫瑰', P.rose], ['草地', P.grass], ['泥土', P.earth], ['水面', P.water], ['墨梅', P.ink]],
        type: [['Huninn 粉圓（中文）', ZH(34), '麻糬今天好開心'], ['Fredoka（數字 / 拉丁）', FONT(600, 34), 'OC Shimeji 3,240']],
        icons: ['bag', 'map', 'dots', 'coin', 'sun', 'moon', 'heart', 'star', 'brush', 'onion', 'gear', 'paw'],
        drawIcon: (c, n, x, y) => icon(c, n, x, y, 44, P.ink, 2),
        drawChar: (c, d, s, x, y, k) => OC.M.CHAR.draw(c, d, s, x, y, k, 1),
        k: 2.6,
        notes: ['動態：彈簧阻尼 (freq 2.2 / damp 6)，overshoot ≤ 8%', '角色：呼吸 0.36Hz、自然眨眼、耳尾跟隨、滑動式 3/4 轉身', 'UI：漸層霧面膠囊、雙層柔陰影、轉場＝霧化溶接 + 上浮', '效能：中（大量漸層／半透明；省電模式降為平塗＋30fps）'],
        pros: ['最療癒、最接近參考圖 1 的商業感', '易讀性高、親和力強、適合大眾'], cons: ['風格較常見，辨識度需靠角色設計', '漸層與透明層較多，低階機需降級'],
      };
    },
    pixel: () => {
      const X = OC.X, P = X.P;
      return {
        bg: '#1B1726', panel: '#2E2638', ink: '#F6E9CF', sub: '#C4C0C2', accent: P.r3, dark: true,
        title: '方案 B · 像素森語 Pixel Grove', tagline: '高位元像素 · 世界 270×480 ×4 / UI 540×960 ×2 · 調色盤量化光影 · 逐格節奏',
        hFont: '48px Unifont', bFont: '32px Unifont', sFont: '32px Unifont', nFont: '21px "WenQuanYi Zen Hei"', latin: '32px Silkscreen',
        palette: [['墨黑', P.k1], ['深林', P.g1], ['苔綠', P.g3], ['嫩芽', P.g5], ['泥土', P.e2], ['木頭', P.e4], ['石頭', P.s2], ['湖水', P.w2], ['淺水', P.w4], ['莓紅', P.r2], ['陽光', P.r4], ['紫羅蘭', P.p2]],
        type: [['Unifont 16px（中文像素）', '32px Unifont', '麻糬今天好開心'], ['Silkscreen 8px（數字 / 標籤）', '32px Silkscreen', 'OC 3,240']],
        icons: ['bag', 'map', 'menu', 'coin', 'sun', 'moon', 'heart', 'star', 'pencil', 'onion', 'gear', 'paw'],
        drawIcon: (c, n, x, y) => { c.imageSmoothingEnabled = false; X.icon(c, n, x, y, 5, P.c0, P.e3, P.r4); },
        drawChar: (c, d, s, x, y, k) => { c.imageSmoothingEnabled = false; X.CHAR.draw(c, d, s, x, y, Math.round(k * 2), 1); },
        k: 2.5,
        notes: ['動態：角色 8–12fps 逐格；轉身 5 個角度；呼吸 1px', '光影：多重色調 → 調色盤量化 + 4×4 Bayer 抖色', 'UI：9-slice 像素框、◀▶ 選擇列、手套游標、抖色溶接轉場', '效能：最低（整數縮放、可做 sprite atlas、易做省電）'],
        pros: ['辨識度與「遊戲感」最強，動畫成本最可控', '玩家自製素材（像素畫）門檻最低'], cons: ['表情細節受像素數限制', '中文像素字選擇少，需嚴格網格規範'],
      };
    },
    sketch: () => {
      const S = OC.S, P = S.P;
      return {
        bg: '#F1E6CF', panel: '#FBF6EA', ink: P.ink, sub: P.ink2, accent: P.terra, grain: true,
        title: '方案 C · 手帳繪本 Inkpot Tales', tagline: '手繪墨線抖動 · 錯版印刷填色 · 剪貼手帳 UI · 一拍二繪本節奏',
        hFont: S.F(46, 700), bFont: S.F(26), sFont: S.F(22), nFont: S.F(19), latin: S.F(24, 700),
        palette: [['紙', P.paper], ['墨', P.ink], ['芥末', P.mustard], ['陶土', P.terra], ['玫瑰', P.rose], ['青綠', P.teal], ['水', P.water], ['草', P.grass], ['森林', P.forest], ['沙', P.sand], ['木', P.wood], ['梅紫', P.plum]],
        type: [['霞鶩文楷 TC（手寫感）', S.F(34, 700), '麻糬今天好開心'], ['同字族拉丁', S.F(34, 400), 'OC Shimeji 3,240']],
        icons: ['bag', 'map', 'menu', 'coin', 'sun', 'moon', 'heart', 'star', 'pencil', 'onion', 'gear', 'paw'],
        drawIcon: (c, n, x, y) => S.icon(c, n, x, y, 44),
        drawChar: (c, d, s, x, y, k) => S.CHAR.draw(c, d, s, x, y, k, 1),
        k: 2.4,
        notes: ['動態：角色一拍二 (12fps)、誇張擠壓伸展、漫畫狀聲詞', '線條：8fps boiling；陰影＝排線；填色偏移 0.9px', 'UI：毛邊紙卡、紙膠帶、印章按鈕、翻頁轉場', '效能：中高（向量描邊多；可預烘 boil 3 幀成 atlas）'],
        pros: ['最具作者性與話題性，與 OC 創作文化契合', '翻頁 / 貼紙 / 手帳隱喻自然延伸到所有系統'], cons: ['製作規範最嚴，素材一致性難度最高', '線條密度高時在小螢幕需控管'],
      };
    },
  };

  async function renderBoard() {
    const id = G.theme.id, c = CFG[id]();
    const B = OC.makeCanvas(2560, 1440), x = B.getContext('2d');
    x.fillStyle = c.bg; x.fillRect(0, 0, 2560, 1440);
    const T = (s, px, py, font, col, align = 'left') => { x.font = font; x.fillStyle = col; x.textAlign = align; x.textBaseline = 'alphabetic'; x.fillText(s, px, py); };
    const panel = (px, py, w, h) => { x.fillStyle = c.panel; OC.rr(x, px, py, w, h, c.dark ? 0 : 28); x.fill(); if (c.dark) { x.strokeStyle = '#5A4A63'; x.lineWidth = 6; x.strokeRect(px, py, w, h); } };
    T(c.title, 60, 92, c.hFont, c.ink);
    T(c.tagline, 62, 140, c.sFont, c.sub);
    // phones
    const times = [5.0, 8.7, 11.3, 21.7, id === 'pixel' ? 26.7 : 26.0, 37.4];
    const caps = ['小島 · 白天 HUD', '日夜光影', '捏臉 / 創角', '對話 · 特殊反應', '地圖 → 地點', '動畫工坊'];
    const main = document.getElementById('c');
    const pw = 380, ph = 676;
    times.forEach((t, i) => {
      OC.renderFrame(t);
      const px = 60 + i * (pw + 30), py = 176;
      x.save(); OC.rr(x, px - 8, py - 8, pw + 16, ph + 16, 34); x.fillStyle = c.dark ? '#000' : '#2B2228'; x.fill();
      OC.rr(x, px, py, pw, ph, 28); x.clip(); x.imageSmoothingEnabled = !c.dark; x.imageSmoothingQuality = 'high'; x.drawImage(main, px, py, pw, ph); x.restore();
      T(caps[i], px + pw / 2, py + ph + 46, c.sFont, c.sub, 'center');
    });
    // bottom row
    const by = 932, bh = 488;
    panel(60, by, 600, bh);
    T('主色盤 Palette', 90, by + 56, c.bFont, c.ink);
    c.palette.forEach(([n, col], i) => {
      const px = 90 + (i % 6) * 92, py = by + 76 + Math.floor(i / 6) * 132;
      x.fillStyle = col; if (c.dark) x.fillRect(px + 6, py, 60, 60); else { x.beginPath(); x.arc(px + 36, py + 30, 30, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 2; x.stroke(); }
      T(n, px + 36, py + 88, c.nFont || c.sFont, c.sub, 'center');
      T(col.toUpperCase(), px + 36, py + 110, '15px monospace', c.sub, 'center');
    });
    T('字體 Type', 90, by + 372, c.bFont, c.ink);
    c.type.forEach(([n, f, sample], i) => { T(sample, 90 + i * 270, by + 428, f, c.ink); T(n, 90 + i * 270, by + 456, '16px sans-serif', c.sub); });
    panel(690, by, 520, bh);
    T('圖示 Icons', 720, by + 56, c.bFont, c.ink);
    c.icons.forEach((n, i) => { const px = 760 + (i % 4) * 116, py = by + 130 + Math.floor(i / 4) * 110; c.drawIcon(x, n, px, py); });
    panel(1240, by, 860, bh);
    T('角色轉面 · 表情 Turnaround & Expressions', 1270, by + 56, c.bFont, c.ink);
    const faces = [[0, 0], [0.55, 0], [1, 0], [0, 1]];
    faces.forEach(([f, b], i) => c.drawChar(x, 'mochi', { face: f, back: b, eyes: 'round' }, 1340 + i * 150, by + 260, c.k));
    c.drawChar(x, 'kuri', { face: -0.4 }, 1935, by + 260, c.k * 0.85);
    c.drawChar(x, 'sora', { face: -0.4, eyes: 'sleepy' }, 2040, by + 260, c.k * 0.85);
    const ex = [['round', 'cat'], ['sparkle', 'o'], ['happy', 'smile'], ['sleepy', 'flat'], ['wide', 'o'], ['happy', 'open']];
    ex.forEach(([e, m], i) => c.drawChar(x, 'mochi', { eyes: e, mouth: m, blush: i === 5 ? 1 : 0, noShadow: true }, 1320 + i * 130, by + 440, c.k * 0.72));
    panel(2130, by, 370, bh);
    T('動畫 · 優缺點', 2160, by + 56, c.bFont, c.ink);
    let ny = by + 96;
    const NF = c.nFont || c.sFont;
    for (const n of c.notes) { wrap(x, '• ' + n, 2160, ny, 330, 25, NF, c.sub).forEach(() => (ny += 25)); ny += 4; }
        for (const p of c.pros) { wrap(x, '＋ ' + p, 2160, ny, 330, 25, NF, c.accent).forEach(() => (ny += 25)); }
    for (const p of c.cons) { wrap(x, '－ ' + p, 2160, ny, 330, 25, NF, c.sub).forEach(() => (ny += 25)); }
    if (c.grain) { x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.5; x.drawImage(OC.S.grain(), 0, 0, 2560, 1440); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
    return B.toDataURL('image/png').split(',')[1];
  }
  function wrap(x, s, px, py, w, lh, font, col) {
    x.font = font; x.fillStyle = col; x.textAlign = 'left';
    const lines = []; let cur = '';
    for (const ch of Array.from(s)) { if (x.measureText(cur + ch).width > w) { lines.push(cur); cur = ch; } else cur += ch; }
    if (cur) lines.push(cur);
    lines.forEach((l, i) => x.fillText(l, px, py + i * lh));
    return lines;
  }
  G.renderBoard = renderBoard;
})(window);
