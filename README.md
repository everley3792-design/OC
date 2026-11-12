# OC Shimeji

> 我的 OC，住進你的手機。—— 原創角色生活模擬 × Android 懸浮桌寵（3D 固定視角世界 × 2D 角色）

## 目前版本 0.14.1-alpha（14.1）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-0.14.1-alpha-debug.apk`](deliverables/apk/oc-shimeji-0.14.1-alpha-debug.apk)
- 14.1：修正卡頓（拿掉每幀的全螢幕合成效果、白天關掉點光源、陰影減半、預先編譯著色器、自動降解析度；**手機上的效果尚未驗證**）、桌寵的群體行為搬進可測試的核心、房屋主體／攤位／橋重新建模、工坊改成工具方格。紀錄：[`docs/v14.1-report.md`](docs/v14.1-report.md)
- 14.0：整個 App 統一成一種風格「島日和」（白天／夜晚兩個調色盤）、HUD／導覽列／環狀選單重做、背包口袋格、交易紀錄、桌寵中心的桌面預覽、圖片角色用手指裁切、樹木與房屋正面重新建模、小島繪製呼叫減半、桌寵行為搬進可測試的核心（原生仍未經實機驗證）。紀錄：[`docs/v14-report.md`](docs/v14-report.md)
- 13.0：畫面跟著角色換地點、圖片角色的調整與自動表演、79 個特質（衝突提示、隨機）、新的預設介面風格、猜拳／躲貓貓／搖樹、角色主動來訪與約定、四章節教學、桌寵作息。**桌寵原生層與各頁面版面沒有整個重寫。**
- 紀錄（含未驗證與沒做的部分）：[`docs/v13-report.md`](docs/v13-report.md)；測試：`node game/tests/v13/run.js`
- ⚠️ 原生功能仍需實機驗證：[`docs/compat-test-plan.md`](docs/compat-test-plan.md)

## 0.12.0-alpha（12.0 修正與成熟化）

- **12.0 新增／修正**：修掉純文字格的灰色圓底座與作息輸入框重疊；請求可取消；技能頁與地圖重新設計；**去除 NPC**；極簡 HUD；**每個角色各自的操控模式（手動／半自動（預設）／全自動），隨時可切**；成熟語氣的新台詞與「雅緻」介面風格；情緒感染、冷戰與和解、三人以上的聚會；桌寵自己的聲音與雙人桌面動作；過場短句接到真實事件；3D 接觸陰影、房間布置與重新建模的家具（**房屋／樹木／岩石的造型沒有重新建模**）。
- 12.0 紀錄（問題→原因→修正→驗證、**未驗證與未完成項目**）：[`docs/v12-report.md`](docs/v12-report.md)；畫面：`deliverables/v12/`
- 測試：`node game/tests/v12/run.js`（12.0 驗收）；Kotlin：`cd android && gradle -PcoreOnly=true test`
- ⚠️ 桌寵（含新的聲音與雙人動作）、小工具、觸覺等原生功能仍需實機驗證：[`docs/compat-test-plan.md`](docs/compat-test-plan.md)

## 0.11.0-alpha（11.0 互動與生命感重做）

- **11.0 新增**：滑動撫摸（依手指速度、身體部位與每個角色的喜好連續累積）、親近環（抱抱／擊掌／戳／牽手）、107 個資料驅動動作與柔和過渡、會計畫與設目標的 AI（可看「想法」）、10 種雙人互動、創角舞台（轉盤、點部位）、角色聲線／立體聲／動作與腳步音效／音樂強度層／觸覺節奏、世界觸控回饋（波紋、搖樹落葉、揚塵）、桌寵多 10 個小動作。
- 11.0 紀錄（做了什麼、發現並修掉的問題、測試、**未驗證與未完成項目**）：[`docs/v11-report.md`](docs/v11-report.md)；畫面：`deliverables/v11/`
- 10.0／10.1 紀錄：[`docs/v10-report.md`](docs/v10-report.md)；規格：[`docs/design-system.md`](docs/design-system.md)；更早：[`docs/v9-report.md`](docs/v9-report.md)、[`docs/v8-report.md`](docs/v8-report.md)
- 測試：`node game/tests/v11/run.js`（11.0 驗收）、`node game/tests/v8/run.js`、`node game/tests/v10/run.js` ＋第四～七階段回歸；Kotlin：`cd android && gradle -PcoreOnly=true test`
- ⚠️ 桌寵、小工具、觸覺等原生功能仍需實機驗證：[`docs/compat-test-plan.md`](docs/compat-test-plan.md)

## 0.7.0-alpha（第七階段：Android 系統懸浮桌寵）

- ⚠️ 桌寵、通知、提醒、小工具等原生功能**尚未在實機上驗證**（開發環境沒有 Android 裝置）——測試計畫：[`docs/compat-test-plan.md`](docs/compat-test-plan.md)
- 第七階段完成紀錄（已驗證／需實機／部分完成／未完成）：[`docs/phase7-report.md`](docs/phase7-report.md)；截圖：`deliverables/phase7/`
- 第七階段規格：[Android 原生層與同步](docs/android-native.md) · [權限與隱私](docs/permissions.md) · [備份](docs/backup.md) · [效能](docs/performance.md) · [Android 建置](docs/android-build.md)
- 自動化測試：`cd game && python3 -m http.server 8765` 後執行 `node game/tests/pet/run.js`（第七階段）、`node game/tests/play/run.js`（第六）、`node game/tests/world/run.js`（第五）、`node game/tests/life/run.js`（第四）；Kotlin：`cd android && gradle -PcoreOnly=true test`
- 第六階段：[`docs/phase6-report.md`](docs/phase6-report.md) · [任務與請求](docs/quests.md) · [技能／目標／成就／圖鑑／日誌](docs/growth.md) · [動畫、演出與音效](docs/animation-performance.md)
- 第五階段：[`docs/phase5-report.md`](docs/phase5-report.md) · [世界地圖與地點](docs/world-map.md) · [物品系統](docs/items.md) · [商店與經濟](docs/economy.md)
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
