# CLAUDE.md — OC Shimeji

原創角色生活模擬 + Android 系統級懸浮桌寵。直向手機、純 2D / 2.5D（**禁止 3D 模型與 3D 場景**）。

## 目前階段
- **第一階段完成**：三套視覺方案（影片、總覽圖、可執行原型）、技術架構、規範文件、Android 專案骨架。
- **等待使用者選定美術方向**。在使用者明確選擇（或提出混合/修改）之前，**不要開始第二階段**，也不要自行刪除任何方案。
- 方案代號：第一輪 `mallow`（A 棉霧島）、`pixel`（B 像素森語）、`sketch`（C 手帳繪本）；第二輪（Switch 風格參考、同視角）`wild`（D 風語原野）、`isle`（E 晴日島嶼）、`quirk`（F 奇趣鎮）。使用者可能選擇任一方案或混合。
- 參考作品只吸收設計原則，**不得**使用其角色、Logo、介面圖形、地圖或素材（見 `docs/phase1-round2-comparison.md`）。

## 目錄
```
prototype/            動態原型（HTML Canvas，逐幀決定性渲染）
  index.html          ?theme=mallow|pixel|sketch  ；&record=1 給錄影工具用
  shared/core.js      時間軸、緩動、彈簧、眨眼、走路路徑、共用分鏡與資料
  shared/engine.js    鏡頭切換與轉場合成
  shared/board.js     視覺總覽圖產生器
  shared/vec.js       第二輪共用：形狀、擠出地形、材質（cel/flat/gloss）、圖示、物品
  shared/vchar.js     第二輪共用：參數化角色 rig（iris/dot/mii 三種臉部系統、臉部滑桿參數）
  shared/acting.js    第二輪共用：角色表演（走路轉身、驚喜跳、吃東西、桌寵拖放），三方案時間完全一致
  themes/<id>/        kit.js（tokens/圖示/物品/UI 零件）char.js（角色 rig）world.js（2.5D 世界）shots.js（11 個分鏡）
  tools/record.js     錄 MP4（Playwright → PNG → ffmpeg）
  tools/stills.js     輸出單張畫面檢查
  tools/board.js      輸出總覽圖
deliverables/         videos/*.mp4  overviews/*.png
docs/                 phase1-round2-comparison、phase1-comparison（先讀）、visual-plan、architecture、ui-components、art-guidelines、animation-guidelines、asset-format
android/              Gradle 多模組專案（core:* 純 Kotlin；app / platform:overlay / render:world / ui:design 為 Android）
```

## 指令
```bash
# 原型預覽（直接用瀏覽器開啟 prototype/index.html?theme=sketch）
cd prototype && node tools/stills.js sketch /tmp/out 5 10.6 21.4       # 檢查畫面
cd prototype && node tools/record.js sketch ../deliverables/videos/C_inkpot-tales.mp4
cd prototype && node tools/board.js sketch ../deliverables/overviews/C_inkpot-tales.png
# Kotlin 核心（不需 Android SDK）
cd android && gradle -PcoreOnly=true test
# 完整 App（需要 Android SDK + Google Maven）
cd android && ./gradlew :app:assembleDebug
```
Playwright 與 Chromium 已預裝於雲端環境（`require('playwright')`），不要重新安裝。

## 規則
- 原型每一幀必須是時間 `t` 的純函數（不可用 `Math.random()`/`Date`；用 `OC.rng(seed)`、`OC.hash`）。否則錄影會閃爍、無法重現。
- 設計座標：360×640dp（×3 = 1080×1920）。B 方案：世界 270×480（×4）、UI 540×960（×2），只能整數座標與整數縮放。
- 所有方案共用分鏡時間（`OC.SHOTS`）；改時間軸要全部一起改並重錄。
- 第二輪主題的命名空間：`OC.WS`（D）、`OC.IS`（E）、`OC.QK`（F）。不要使用 `OC.W`（那是畫面寬度 1080）。
- 動畫數值以 `prototype/shared/core.js` 與 `android/core/anim/Motion.kt` 為準，兩邊必須同步（有單元測試）。
- `core:*` 模組不得依賴 Android。渲染層只讀狀態不改狀態。
- 新功能不得新增常駐 HUD 元件（上限 6 個），見 `docs/visual-plan.md`。
- 每頁一個主要按鈕；觸控熱區 ≥ 48dp；主要操作放下方拇指區。
- 懸浮桌寵：`platform/overlay` 程式碼**尚未實機驗證**。在 `docs/architecture.md` 驗證清單全部通過前，不可宣稱完成。影片中的桌寵是視覺模擬。
- 所有美術為原創；參考圖只取方向，不得複製既有遊戲的角色、地圖或素材。
- 字體皆為開放授權（見 `prototype/assets/fonts/LICENSES.md`）；新增字體前先確認授權。

## 環境限制（第一階段實測）
- 雲端容器無法連線 `dl.google.com`（Google Maven）→ 無法下載 AGP / Android SDK → 無法建置 APK。
- Maven Central 偶爾回 429；用 `--max-workers=1` 重試，快取填滿後即可離線建置核心模組。
- GitHub raw 下載被封鎖；字體改由 Google Fonts（fonts.gstatic.com）取得。
