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
        notes: ['動態：UI 彈入 outBack(1.2) ≤ 6%；角色參數彈簧 15–28%（1 秒內靜止）', '角色：呼吸 0.36Hz、自然眨眼、耳尾跟隨、滑動式 3/4 轉身', 'UI：漸層霧面膠囊、雙層柔陰影、轉場＝霧化溶接 + 上浮', '效能：中（大量漸層／半透明；省電模式降為平塗＋30fps）'],
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

  // ---- Round 2 (Switch-inspired) ----
  const r2 = (o) => Object.assign({ icons: ['bag', 'map', 'dots', 'coin', 'sun', 'moon', 'heart', 'star', 'brush', 'phone', 'gear', 'paw'] }, o);
  CFG.wild = () => { const W = OC.WS, P = W.P; return r2({
    bg: '#1A2026', panel: '#232B32', ink: '#F6F2E8', sub: '#B9B4A6', accent: P.gold, dark: true, smooth: true,
    title: '方案 D · 風語原野 Windsong Fields', tagline: '賽璐珞彩繪 · 有色線稿 · 風是主角 · 探索式極簡 HUD（白線圖示＋小地圖）',
    hFont: W.ZSERIF(44), bFont: W.SANS(700, 24), sFont: W.SANS(500, 20), nFont: W.SANS(500, 18),
    palette: [['奶油光', P.cream], ['草', P.grass], ['深草', P.grassLo], ['岩', P.rock], ['岩影', P.rockLo], ['河', P.water], ['霧', P.mist], ['木', P.wood], ['布', P.cloth], ['赤', P.red], ['金', P.gold], ['符光', P.glow]],
    type: [['Noto Serif TC＋Cinzel（標題）', W.ZSERIF(34), '苔光森林'], ['Noto Sans TC（介面）', W.SANS(700, 30), 'MAP 10:20']],
    drawIcon: (c, n, x, y) => OC.V.icon(c, n, x, y, 42, P.text, 1.8),
    drawChar: (c, d, s, x, y, k) => W.ch(c, d, s, x, y, k, 1), k: 2.4,
    notes: ['動態：連續 60fps；風陣以波的形式掃過草地、風車、圍巾', '角色：賽璐珞雙色＋暖色邊光＋有色描邊、虹膜大眼', 'UI：深色半透明面板、金色角括號選取、白線圖示、區域標題卡', '效能：中高（草叢逐葉擺動；省電模式改為成組擺動）'],
    pros: ['探索感與「大作」質感最強，最成熟高級', '適合未來擴充更多地點與冒險元素'], cons: ['療癒可愛度略低於 E/F', '深色 UI 對親子／輕度玩家較嚴肅'],
  }); };
  CFG.isle = () => { const I = OC.IS, P = I.P; return r2({
    bg: '#FFF4D8', panel: '#FFFDF6', ink: P.brown, sub: P.brown2, accent: P.coral, smooth: true,
    title: '方案 E · 晴日島嶼 Sunny Isle', tagline: '玩具感平塗 · 無描邊 · 草皮條紋 · 圓潤厚實按鈕 · 手機 App 選單 · 圈形轉場',
    hFont: I.ZH(44), bFont: I.ZH(24), sFont: I.ZH(20), nFont: I.ZH(18),
    palette: [['海', P.sea], ['淺灘', P.shallow], ['沙', P.sand], ['草 A', P.grassA], ['草 B', P.grassB], ['土崖', P.cliff], ['珊瑚', P.coral], ['青綠', P.teal], ['向日葵', P.yellow], ['紫', P.purple], ['奶油', P.cream], ['可可', P.brown]],
    type: [['粉圓 Huninn（中文）', I.ZH(34), '麻糬好開心'], ['Nunito Black（數字）', I.F(900, 34), '10:20 3,240']],
    drawIcon: (c, n, x, y) => I.roundToy(c, x, y, 22, [P.coral, P.teal, P.yellow, P.purple, P.green, P.blue][Math.round(x + y) % 6], n, { is: 22 }),
    drawChar: (c, d, s, x, y, k) => I.ch(c, d, s, x, y, k, 1), k: 2.4,
    notes: ['動態：彈跳回饋（outBack 2.2）、逐字彈出對話、圈形 iris 轉場', '角色：大頭圓臉、點點眼、大腮紅、條紋 T 恤', 'UI：奶油色厚實面板＋下緣唇邊、傾斜名牌、手機 App 選單', '效能：低（平塗、少漸層，最適合常駐桌寵）'],
    pros: ['最療癒親切、最容易被大眾接受', '效能成本最低，懸浮桌寵最省電'], cons: ['與知名島嶼生活遊戲氣質相近，需靠角色與細節建立辨識度', '風格較「標準」，驚喜感略少'],
  }); };
  CFG.quirk = () => { const Q = OC.QK, P = Q.P; return r2({
    bg: '#F4F7FB', panel: '#FFFFFF', ink: P.ink, sub: P.ink2, accent: P.mag, smooth: true,
    title: '方案 F · 奇趣鎮 Quirkville', tagline: '亮面玩具質感 · 幾何臉部參數 · 白色 UI＋彩色標題列 · 心願泡泡 · 喜劇節奏 · 斜條轉場',
    hFont: Q.ZB(900, 42), bFont: Q.ZB(900, 24), sFont: Q.ZB(700, 20), nFont: Q.ZB(700, 18),
    palette: [['洋紅', P.mag], ['橙', P.orange], ['檸檬', P.yellow], ['萊姆', P.lime], ['天空', P.sky], ['藍', P.blue], ['紫', P.purple], ['青', P.teal], ['磚', P.pave], ['草', P.grass], ['海', P.sea], ['墨', P.ink]],
    type: [['Noto Sans TC Black（標題）', Q.ZB(900, 32), '好吃！'], ['Nunito Black（數字）', Q.B(900, 34), '10:20 3,240']],
    drawIcon: (c, n, x, y) => Q.orb(c, x, y, 22, [P.mag, P.orange, P.blue, P.lime, P.purple, P.teal][Math.round(x + y) % 6], n, { is: 22 }),
    drawChar: (c, d, s, x, y, k) => Q.ch(c, d, s, x, y, k, 1), k: 2.2,
    notes: ['動態：喜劇時機（預備→大反應→停頓）、集中線、斜條轉場', '角色：亮面高光、幾何五官可用滑桿調整大小／間距／角度', 'UI：白卡＋彩色標題列、光澤按鈕、居民頭上的心願泡泡', '效能：中（亮面高光與描邊；可預烘）'],
    pros: ['創角自由度與「角色個性」表現最強，最貼近 OC 核心', '心願泡泡讓自主生活一眼看懂，最有趣'], cons: ['城鎮題材較少自然探索感', '白色 UI 需要仔細的層次以免單調'],
  }); };

  CFG.isle3d = () => Object.assign(CFG.isle(), {
    title: '方案 G · 晴日島嶼 3D（混合）', tagline: '3D 固定視角世界（正交 50°・柔和陰影・真實光源・微縮景深）＋ E 的 2D 角色、UI 與所有創作系統',
    notes: ['世界：Blender／程式 3D 模型、擠出黏土地形、日夜光源與陰影方向變化', '角色：2D rig 每幀畫進貼圖，以看板放入 3D，遮擋正確', '座標對齊：2D 版面、手指路徑、UI 錨點完全沿用', '效能：中（固定鏡頭可烘焙光影；角色只是貼圖平面）'],
    pros: ['同時擁有 3D 的立體光影與 2D 的創作自由', '懸浮桌寵、繪畫與動畫工坊完全不受影響'], cons: ['需要 3D 場景美術與 Android 3D 渲染（Filament／Godot）', '開發成本高於純 2D 的 E'],
  });

  async function renderBoard() {
    const id = G.theme.id, c = CFG[id]();
    const B = OC.makeCanvas(2560, 1440), x = B.getContext('2d');
    x.fillStyle = c.bg; x.fillRect(0, 0, 2560, 1440);
    const T = (s, px, py, font, col, align = 'left') => { x.font = font; x.fillStyle = col; x.textAlign = align; x.textBaseline = 'alphabetic'; x.fillText(s, px, py); };
    const panel = (px, py, w, h) => { x.fillStyle = c.panel; OC.rr(x, px, py, w, h, c.dark ? 0 : 28); x.fill(); if (c.dark) { x.strokeStyle = '#5A4A63'; x.lineWidth = 6; x.strokeRect(px, py, w, h); } };
    T(c.title, 60, 92, c.hFont, c.ink);
    T(c.tagline, 62, 140, c.sFont, c.sub);
    // phones
    const times = [5.0, 8.7, 11.3, 21.7, id === 'pixel' ? 26.7 : ['wild', 'isle', 'quirk', 'isle3d'].includes(id) ? 27.1 : 26.0, 37.4];
    const caps = ['小島 · 白天 HUD', '日夜光影', '捏臉 / 創角', '對話 · 特殊反應', '地圖 → 地點', '動畫工坊'];
    const main = document.getElementById('c');
    const pw = 380, ph = 676;
    times.forEach((t, i) => {
      OC.renderFrame(t);
      const px = 60 + i * (pw + 30), py = 176;
      x.save(); OC.rr(x, px - 8, py - 8, pw + 16, ph + 16, 34); x.fillStyle = c.dark ? '#000' : '#2B2228'; x.fill();
      OC.rr(x, px, py, pw, ph, 28); x.clip(); x.imageSmoothingEnabled = c.smooth || !c.dark; x.imageSmoothingQuality = 'high'; x.drawImage(main, px, py, pw, ph); x.restore();
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
