# OC Shimeji

> 我的 OC，住進你的手機。—— 原創角色生活模擬 × Android 懸浮桌寵（3D 固定視角世界 × 2D 角色）

## 目前版本 0.5.0-alpha（第五階段：世界、地點、物品與經濟）

- **可安裝 APK**：[`deliverables/apk/oc-shimeji-0.5.0-alpha-debug.apk`](deliverables/apk/oc-shimeji-0.5.0-alpha-debug.apk)（`adb install -r …`，Android 8.0+，可直接覆蓋 0.4.0，存檔自動升級到 v4）
- 第五階段完成紀錄、測試結果與未完成項目：[`docs/phase5-report.md`](docs/phase5-report.md)；截圖：`deliverables/phase5/`
- 第五階段規格：[世界地圖與地點](docs/world-map.md) · [物品系統](docs/items.md) · [商店與經濟](docs/economy.md)
- 自動化情境測試：`cd game && python3 -m http.server 8765` 後執行 `node game/tests/world/run.js`（第五階段）與 `node game/tests/life/run.js`（第四階段）
- 第四階段：[`docs/phase4-report.md`](docs/phase4-report.md) · [行為引擎](docs/behavior-engine.md) · [生活資料格式](docs/life-format.md) · [事件規則](docs/event-rules.md) · [情緒與回憶](docs/memory-model.md)
- **瀏覽器試玩**：`cd game && python3 -m http.server 8765` → 開 `http://localhost:8765/index.html`（手機尺寸）
- 截圖：[`deliverables/phase2/screens-contact-sheet.jpg`](deliverables/phase2/screens-contact-sheet.jpg)
- 第三階段完成紀錄與測試：[`docs/phase3-report.md`](docs/phase3-report.md)（第二階段：[`docs/phase2-report.md`](docs/phase2-report.md)）
- 規格：[角色資料格式](docs/character-format.md) · [動畫系統](docs/animation-system.md) · [素材匯入匯出](docs/asset-io.md)
- 文件：[Design System](docs/design-system.md) · [UI 元件](docs/ui-components.md) · [美術素材規範](docs/art-guidelines.md) · [Android 建置](docs/android-build.md) · [架構](docs/architecture.md) · [Roadmap](docs/roadmap.md) · [CLAUDE.md](CLAUDE.md)

---

## 第一階段交付物（視覺方向比較，已凍結）

### 第一輪

| 方案 | 影片（45s · 1080×1920 · 30fps） | 視覺總覽 | 原型 |
|---|---|---|---|
| A · 棉霧島 Mallow Mist | [`deliverables/videos/A_mallow-mist.mp4`](deliverables/videos/A_mallow-mist.mp4) | [`A_mallow-mist.png`](deliverables/overviews/A_mallow-mist.png) | `prototype/index.html?theme=mallow` |
| B · 像素森語 Pixel Grove | [`deliverables/videos/B_pixel-grove.mp4`](deliverables/videos/B_pixel-grove.mp4) | [`B_pixel-grove.png`](deliverables/overviews/B_pixel-grove.png) | `prototype/index.html?theme=pixel` |
| C · 手帳繪本 Inkpot Tales | [`deliverables/videos/C_inkpot-tales.mp4`](deliverables/videos/C_inkpot-tales.mp4) | [`C_inkpot-tales.png`](deliverables/overviews/C_inkpot-tales.png) | `prototype/index.html?theme=sketch` |

### 第二輪：Switch 風格參考（同視角）

| 方案 | 影片 | 視覺總覽 | 原型 |
|---|---|---|---|
| D · 風語原野 Windsong Fields | [`D_windsong-fields.mp4`](deliverables/videos/D_windsong-fields.mp4) | [`D_windsong-fields.png`](deliverables/overviews/D_windsong-fields.png) | `prototype/index.html?theme=wild` |
| E · 晴日島嶼 Sunny Isle | [`E_sunny-isle.mp4`](deliverables/videos/E_sunny-isle.mp4) | [`E_sunny-isle.png`](deliverables/overviews/E_sunny-isle.png) | `prototype/index.html?theme=isle` |
| F · 奇趣鎮 Quirkville | [`F_quirkville.mp4`](deliverables/videos/F_quirkville.mp4) | [`F_quirkville.png`](deliverables/overviews/F_quirkville.png) | `prototype/index.html?theme=quirk` |

### 第三輪：3D 固定視角世界 ＋ 2D 角色（混合）

| 方案 | 影片 | 視覺總覽 | 原型 |
|---|---|---|---|
| G · 晴日島嶼 3D | [`G_sunny-isle-3d.mp4`](deliverables/videos/G_sunny-isle-3d.mp4) | [`G_sunny-isle-3d.png`](deliverables/overviews/G_sunny-isle-3d.png) | `prototype/index.html?theme=isle3d` |

說明：[`docs/phase1-round3-hybrid3d.md`](docs/phase1-round3-hybrid3d.md)

**先讀：** [`docs/phase1-round2-comparison.md`](docs/phase1-round2-comparison.md)（第二輪 D/E/F）與 [`docs/phase1-comparison.md`](docs/phase1-comparison.md)（第一輪 A/B/C）。

文件：
- [全系統視覺規劃](docs/visual-plan.md) · [技術架構](docs/architecture.md) · [UI 元件規格](docs/ui-components.md)
- [角色與場景美術規範](docs/art-guidelines.md) · [動畫規範](docs/animation-guidelines.md) · [素材格式規範](docs/asset-format.md)
- [CLAUDE.md](CLAUDE.md)（開發規範與指令）

## 第一階段狀態（已結束）
- ✅ 三輪共 7 支 MP4、7 張總覽圖、7 套動態原型；使用者選定 G（3D 固定視角 + 2D 角色）
- 第二階段的狀態見上方與 `docs/phase2-report.md`
