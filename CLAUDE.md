# CLAUDE.md — OC Shimeji

原創角色生活模擬 + Android 系統級懸浮桌寵。直向手機。

**已選定美術方向（第三輪做法 ①，方案 G「晴日島 3D」）**：世界（地形、建築、樹木、道具、家具、光影）是 **3D，鏡頭固定**（正交、俯角 50°，只平移／縮放，不旋轉）；**角色、UI、繪畫工坊、逐格動畫、玩家素材、懸浮桌寵一律 2D**（角色以垂直看板放進 3D 世界）。不要改成全 2D 或全 3D，也不要再提新方案。

## 目前階段
- **第一階段完成**：7 個視覺方案（A–G）的影片、總覽圖、原型（`prototype/`、`deliverables/`）。保留供參考，不再修改。
- **第二階段完成**：可操作的遊戲（`game/`）+ Android 外殼與實際建置的 Debug APK。完成紀錄：`docs/phase2-report.md`。
- **第三階段完成（0.3.0-alpha）**：多角色、完整創角／捏角、自訂部件、個性與小怪癖、素材匯入匯出、繪畫工坊、逐格動畫工作室、`.ocpack`。完成紀錄與未驗證項目：`docs/phase3-report.md`。規格：`docs/character-format.md`、`docs/animation-system.md`、`docs/asset-io.md`。
- 下一步見 `docs/roadmap.md`。使用者明確要求**延後**：大型生活 AI、經濟、社交、小遊戲、完整動畫工作室與事件演出——不要自行開始。
- 參考作品只吸收設計原則，**不得**使用其角色、Logo、介面圖形、地圖或素材。

## 目錄
```
game/                 正式遊戲（離線網頁，打包進 APK assets）。無建置步驟，直接用瀏覽器開 index.html
  css/tokens.css      Design Tokens（淺色/深色）——唯一的顏色/字級/間距/動態來源
  css/app.css         UI 元件
  lib/three.min.js    three.js r158（MIT，UMD，全域 THREE）
  js/core/            oc.js（工具，與 prototype/shared/core.js 相同）store.js（存檔/事件）clock.js（時間/天氣）game.js（需求/居民/任務/成就/目標規則）
  js/art/             vec.js vchar.js（第二階段 rig，NPC 圖示仍用）rig.js（擴充 rig：比例、五官、部件錨點）style.js（物品目錄、預設外觀）
  js/char/            assets.js（IndexedDB 素材）model.js（角色資料 v2、性格→行為、成長）anim.js（動畫文件、播放、fallback）render.js（統一繪製）io.js（解碼、Sprite Sheet、ZIP、.ocpack）
  js/world/           models.js（3D 模型庫）env.js（光照/天氣/特效）world.js（引擎：鏡頭、導航 A*、看板角色、輸入、拾取、佈置）areas.js（晴日島、苔光森林）
  js/ui/              ui.js（DOM/圖示/表單/提示）kit.js（色環、滑桿、標籤、復原）pages.js（一般頁面）charedit.js（編輯區塊＋預覽舞台）creator.js（創角流程）
                      charpages.js（角色列表/檔案/編輯器/工坊/桌寵）library.js（匯入與素材庫）paint.js（繪畫工坊）animstudio.js（動畫工作室）
  tests/fixtures/     匯入測試素材（PNG 序列、GIF、APNG、WebP、Sprite Sheet、ZIP、損壞檔；不打包進 APK）
  js/app.js           外殼：開機、主題、效能模式、HUD、導覽、快速背包、互動、對話、佈置、桌寵輸出、OCApp 原生掛鉤
android/              Gradle 專案。app（WebView 外殼 + bridge + overlay 桌寵）；core:*（純 Kotlin，含 PetBrain）
prototype/            第一階段原型（凍結）
docs/                 phase2-report、roadmap、design-system、ui-components、art-guidelines、android-build、architecture …
deliverables/         apk/（Debug APK + sha256）phase2/（截圖）videos/ overviews/（第一階段）
```

## 指令
```bash
cd game && python3 -m http.server 8765        # 開 http://localhost:8765/index.html（手機尺寸 393×852 檢視）
cd android && gradle -PcoreOnly=true test --max-workers=1          # Kotlin 核心測試（18 個）
cd android && gradle -Poc.build=offline :app:assembleDebug :app:verifyDebugApk --max-workers=1   # 含 ProGuard desugar + checkNoIndy
#   → android/app/build/outputs/apk/debug/oc-shimeji-0.3.0-alpha-debug.apk（複製一份到 deliverables/apk/）
cd android && ./gradlew :app:assembleDebug     # 標準 AGP（需 Android SDK + Google Maven；本環境無法使用）
```
測試素材在 `game/tests/fixtures/`。Playwright 與 Chromium 已預裝（`require('playwright')`）；WebGL 測試加 `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`。軟體渲染很慢，效能數字不代表手機。

## 規則
- **座標**：遊戲邏輯一律用設計座標 (x, y, 層)；3D 由 `X=x, Z=(y+層·24)/sin50°, Y=層·24/cos50°` 對應。點擊螢幕＝設計座標（不用射線）。可行走/層級/地面高度寫成解析函式（`OC.Areas.*`）。
- **角色**是 2D 看板：只在量化姿勢改變時重畫紋理；呼吸/彈跳用網格變換。轉身用連續的 `face`/`back` 平滑趨近，不可瞬間翻轉。
- **UI 只用 tokens**；主題切換只改 `<html data-theme>`，不得重建 DOM、重載材質或重設 3D 場景。UI 主題與世界晝夜獨立。
- 頁面「建一次、就地更新」（`OC.Pages.define`）。每頁最多 1 個主要按鈕；觸控 ≥ 48dp；常駐 HUD ≤ 6 個元件。
- **不得做假功能**：未實作的功能用 `lockedRow` / `.locked` 明確標示「未開放」；任務、成就、目標只能由真實行為累積。
- 天氣/時間變化用指數趨近（τ≈1.6s），不可閃光、不可晃鏡頭；霧永遠開著（晴天推遠），切天氣不重新編譯著色器。
- 效能模式（高/平衡/省電/自訂）必須真的改變：像素比、陰影、特效、草、fps 上限、看板解析度、點光源。
- 3D 模型：倒角/車床柔邊、登記碰撞（`ctx.block`）、共用幾何與材質快取；整島 ≲ 250 draw calls。
- 存檔 schema `v:2`（`store.js` 的 `fresh()`；角色欄位由 `OC.Chars.normalize()` 補預設值）。v1 存檔會自動遷移，**不可移除 `migrateV1` / `migrateLegacyAnims`**。
- **角色資料只有一份**（`save.chars`）：頁面只讀它或編輯 draft 後整筆寫回；不要另存副本。需求、外觀、動作都屬於角色。
- **圖片不可放進存檔 JSON**：一律 `OC.Assets.put()`（IndexedDB）並只存 id；畫面用 `OC.Assets.peek()`（同步、LRU）或 `image()`（非同步）。
- 所有角色繪製走 `OC.CharRender`（世界、頭像、編輯器、桌寵輸出共用）；新動作要在 `OC.Chars.ACTIONS` 加備用鏈，並在 `rigState` 給骨架姿勢，確保沒有自訂影格也能播。
- 圖片角色縮放只用角色的 `appearance.refH`（同一角色所有動作同一比例）；腳底用 `doc.anchor`。
- 性格必須產生可觀察差異：新增特質／怪癖時同步更新 `OC.Chars.behavior()` 或 `speak()`；永久改變特質只能經 `suggest()` → 玩家 `resolve()`。
- 匯入必須驗證並給出原因；損壞或不支援的檔案不可「看似成功」。`.ocpack` 格式見 `docs/asset-io.md`，版本升級要保持向下相容。
- 可編輯工具（工作室、繪畫、編輯器）要有：復原／重做、草稿自動保存、離開未儲存提示。
- `core:*` 模組不得依賴 Android；動畫數值以 `prototype/shared/core.js` 與 `android/core/anim/Motion.kt` 為準（有單元測試）。
- 離線 APK 管線每個 Exec 任務都要宣告 inputs/outputs，否則會產生過期 APK。
- **dx 不會改寫 Java 8 lambda**：APK 必須經過 `desugar`（ProGuard）且 `checkNoIndy` 通過，否則手機上會閃退（0.2.0 的教訓）。不要移除這兩步。
- ProGuard 只能用來改寫 lambda：**必須 `-dontshrink`**（縮減曾刪掉 `EmptyMap.size()`，0.2.2 WebView 閃退）。交給 Android/WebView 的 Map/List 用 `java.util.HashMap`/`ArrayList`。
- **不要在 `setContentView` 之前呼叫 `window.insetsController`**（Android 11+ 框架內部 NPE，0.2.0/0.2.1 實機閃退原因）；用 `window.decorView.windowInsetsController`。純外觀的視窗設定一律 `runCatching`。
- 診斷：App 失敗時要顯示原因（`Diagnostics.kt`、`index.html` 開機防護），不可靜默失敗；改動開機流程後用 `?safe=1`、無 WebGL、舊 WebView 情境測試。
- **懸浮桌寵與實機行為尚未驗證**（無模擬器）。在實機跑完 `docs/architecture.md` 驗證清單前不可宣稱完成。
- 金鑰：release keystore 只能經環境變數 `OC_RELEASE_*` 提供，絕不提交。
- 所有美術為原創；字體皆為開放授權（`game/fonts/LICENSES.md`），新增前先確認授權。

## 環境限制（實測）
- 無法連線 `dl.google.com` / Google Maven → 無法用 AGP / 下載 Android SDK；改用離線管線（`docs/android-build.md`）。
- Maven Central 偶爾 429；`--max-workers=1` 重試。GitHub raw 被封鎖；字體由 Google Fonts 取得。
- 沒有 Android 模擬器或實機：只能驗證到「APK 建置、簽章、內容正確」與「遊戲在 Chromium 手機模擬中正常」。
