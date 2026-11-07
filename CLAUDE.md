# CLAUDE.md — OC Shimeji

原創角色生活模擬 + Android 系統級懸浮桌寵。直向手機。

**已選定美術方向（第三輪做法 ①，方案 G「晴日島 3D」）**：世界（地形、建築、樹木、道具、家具、光影）是 **3D，鏡頭固定**（正交、俯角 50°，只平移／縮放，不旋轉）；**角色、UI、繪畫工坊、逐格動畫、玩家素材、懸浮桌寵一律 2D**（角色以垂直看板放進 3D 世界）。不要改成全 2D 或全 3D，也不要再提新方案。

## 目前階段
- **第一階段完成**：7 個視覺方案（A–G）的影片、總覽圖、原型（`prototype/`、`deliverables/`）。保留供參考，不再修改。
- **第二階段完成**：可操作的遊戲（`game/`）+ Android 外殼與實際建置的 Debug APK。完成紀錄：`docs/phase2-report.md`。
- **第三階段完成（0.3.0-alpha）**：多角色、完整創角／捏角、自訂部件、個性與小怪癖、素材匯入匯出、繪畫工坊、逐格動畫工作室、`.ocpack`。完成紀錄與未驗證項目：`docs/phase3-report.md`。規格：`docs/character-format.md`、`docs/animation-system.md`、`docs/asset-io.md`。
- **第四階段完成（0.4.0-alpha）**：深度生活模擬——9 種需求、情緒、Utility AI 活動流程、作息、後天習慣（需同意）、願望／技能、多 OC 自主社交與共同活動、有方向的關係、資料驅動對話（可匯入匯出）、回憶、事件引擎、玩家互動、自主程度、分層／離線模擬、開發者診斷。完成紀錄、測試與未完成項目：`docs/phase4-report.md`。規格：`docs/behavior-engine.md`、`docs/life-format.md`、`docs/event-rules.md`、`docs/memory-model.md`。
- **第五階段完成（0.5.0-alpha）**：世界地圖與 7 個可進入的地點（晴日島、我的家、商店街、咖啡館、圖書館、苔光森林、星砂海灘；風車丘、遊樂園標示未開放）、跨地點 OC 自主生活與跟隨、統一互動設施、每個地點各自的佈置（復原／重做／旋轉／縮放／掛牆／收回）、釣魚／料理／採集／種田／小生物小遊戲、統一物品系統、雙模式背包與拖曳使用、每個 OC 的飲食喜好、工坊商品上架、7 間商店、星幣經濟與交易帳本、地點事件與回憶、圖鑑與探索進度。完成紀錄、測試與未完成項目：`docs/phase5-report.md`。規格：`docs/world-map.md`、`docs/items.md`、`docs/economy.md`。
- 下一步見 `docs/roadmap.md`。「其他島嶼／旅行」、風車丘、遊樂園仍是未開放（`locked`），不要做假入口。
- 參考作品只吸收設計原則，**不得**使用其角色、Logo、介面圖形、地圖或素材。

## 目錄
```
game/                 正式遊戲（離線網頁，打包進 APK assets）。無建置步驟，直接用瀏覽器開 index.html
  css/tokens.css      Design Tokens（淺色/深色）——唯一的顏色/字級/間距/動態來源
  css/app.css         UI 元件
  lib/three.min.js    three.js r158（MIT，UMD，全域 THREE）
  js/core/            oc.js（工具，與 prototype/shared/core.js 相同）store.js（存檔/事件）clock.js（時間/天氣）game.js（居民/任務/成就/目標規則）
  js/life/            data.js（需求/情緒/活動/社交/習慣規則/台詞/事件資料）sim.js（固定步長排程器＋遊戲時鐘＋離線補算）mind.js（需求/情緒/回憶/紀錄/關係/願望/技能/作息/成長）
                      talk.js（對話引擎）brain.js（Utility AI、活動狀態機、可供性/預約、社交編排、分層模擬）events.js（事件生命週期）
  js/art/             vec.js vchar.js（第二階段 rig，NPC 圖示仍用）rig.js（擴充 rig：比例、五官、部件錨點）style.js（物品目錄、預設外觀）
  js/char/            assets.js（IndexedDB 素材）model.js（角色資料 v2、性格→行為、成長）anim.js（動畫文件、播放、fallback）render.js（統一繪製）io.js（解碼、Sprite Sheet、ZIP、.ocpack）
  js/world/           models.js（3D 模型庫）env.js（光照/天氣/特效）world.js（引擎：鏡頭、導航 A*、看板角色、輸入、拾取、佈置）areas.js（晴日島、苔光森林）
  js/items/           art.js（原創程序物品圖示）items.js（OC.Items 物品目錄／搜尋／工坊商品、OC.Taste 飲食喜好）tx.js（OC.Tx 唯一交易流程＋帳本）shops.js（OC.Shops 商店、價格、收入）
  js/world/           models2.js（室內、商店、海灘、菜園等模型）areas2.js（家、咖啡館、圖書館、商店街、海灘＋島/森林的菜園、釣魚、採集、小生物）places.js（OC.Places 地點登記、移動時間、菜園、採集、魚表、每個地點的房間）
  js/ui/              ui.js（DOM/圖示/表單/提示）kit.js（色環、滑桿、標籤、復原）pages.js（一般頁面）charedit.js（編輯區塊＋預覽舞台）creator.js（創角流程）
                      charpages.js（角色列表/檔案/編輯器/工坊/桌寵）library.js（匯入與素材庫）paint.js（繪畫工坊）animstudio.js（動畫工作室）
                      lifeui.js（OC 互動選單、通知、檔案「生活/關係/回憶」、生活設定、對話編輯、開發者診斷）
                      p5pages.js（世界地圖、背包、商店、圖鑑、工坊商品、交易紀錄、OC.Use 使用物品、飲食喜好）worldui.js（OC.WorldUI 移動、抵達、設施點擊）minigames.js（OC.Mini 釣魚、料理、小生物）
  tests/life/         run.js + harness.js：第四階段情境測試 1–13（Playwright；不打包進 APK）
  tests/world/        run.js：第五階段情境測試 1–13＋交易測試 T1–T8（小遊戲由機器人用真實指標事件遊玩；不打包進 APK）
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
node game/tests/life/run.js [1 2 …]           # 第四階段情境測試（先開上面的 http.server；約 15 分鐘；截圖存 deliverables/phase4/）
node game/tests/world/run.js [1 2 …]          # 第五階段情境測試（約 15–20 分鐘；截圖存 deliverables/phase5/）
cd android && gradle -PcoreOnly=true test --max-workers=1          # Kotlin 核心測試（18 個）
cd android && gradle -Poc.build=offline :app:assembleDebug :app:verifyDebugApk --max-workers=1   # 含 ProGuard desugar + checkNoIndy
#   → android/app/build/outputs/apk/debug/oc-shimeji-0.5.0-alpha-debug.apk（複製一份到 deliverables/apk/）
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
- 存檔 schema `v:4`（`store.js` 的 `fresh()`；角色欄位由 `OC.Chars.normalize()` 補預設值）。v1–v3 存檔會自動遷移，**不可移除 `migrateV1` / `migrateV2` / `migrateV3` / `migrateLegacyAnims`**。
- **物品只有一個登記表 `OC.Style.ITEMS`**（`OC.Items` 擴充）；庫存只有 `save.inv`。**星幣與物品數量只能經 `OC.Tx.run(key, {pay, get}, reason)` 改變**（驗證、原子、防重複 key、帳本）；不要直接呼叫 `Store.add/take/coins`。會重複發生的獎勵一定要用固定 key（例如 `forage:<地點>:<點>:<日>`）。
- 生活模擬模式的背包**不能新增或修改物品**；工坊商品只登記並上架，**不產生庫存**。
- 使用物品走 `OC.Use`：吃／喝要等動畫完成、沒被打斷才扣；失敗或取消不扣。家具按「放這裡」才扣。
- 飲食喜好走 `OC.Taste`；玩家設定（`src:'player'`、`locked`）**絕不能**被品嚐改寫。
- 地點：登記在 `OC.Places.P`、場景在 `OC.Areas`；每個地點的家具存在 `save.rooms[地點]`（`OC.Places.room(id)`）。切換地點用 `OC.WorldUI.travel()`，不重建 renderer／UI／AI。不在玩家身邊的 OC 只走 `Brain.abstractStep`（低頻），抵達經 `App.syncPresence()` → `Brain.arrived()`。
- 未開放的地點保持 `locked` 並顯示原因；開放的地點一定要能進入、有可互動設施（測試 1b）。
- 小遊戲（`OC.Mini`）用真實輸入；`OC.Mini.state` 是給測試機器人讀的唯讀狀態，不要讓它影響遊戲。
- 生活設定 `life.settings.travel`（OC 可以自己去別的地方）：第四階段測試 harness 預設關閉（情境假設大家都在島上），第五階段測試傳 `travel: true`。
- 玩家安排的活動（`Brain.command`）不會被邀請或旅行取代；被保留（hold）打斷時會在之後繼續；正在離開的 OC 不能被邀請。
- 頁面只在顯示的資料改變時重建（`same(p, 簽章)`），否則按鈕會在手指下被替換（生活模擬事件很頻繁）。
- 輸入：新的主要指標會清掉殘留指標；長按在下一幀確認（慢幀時避免把點擊誤判成長按）。`window.__ocInputLog` 只給測試追蹤用。
- **生活模擬只有一個時鐘**：所有需求、活動長度、冷卻用 `OC.Sim` 的遊戲分鐘（固定步長，app 迴圈餵現實秒數）；走路效果依距離。不要用 `setInterval`/幀數驅動生活邏輯，否則速度、fps、背景會改變結果。
- 離線／背景只走 `OC.Sim.catchUp()`（以 `life.lastReal` 為準、最多 8 小時、不觸發事件、不給獎勵、摘要回憶有 key）。
- 新活動：加到 `LifeData.ACTS`（效果每遊戲小時、動畫要有備用鏈）並讓某個可供性提供它的 verb；新物件／地點：在區域加 `spots` 或可互動物件，`Brain.rebuild()` 會產生位子。位子一定要經過 `Brain.reserve`。
- 暫停 OC 用 `Brain.hold(id, reason)` / `unhold`，不要直接改 `brain.st`。事件只能經 `OC.Events`（一次一個、間隔、冷卻、once 鍵）；重大關係變化只能產生通知、玩家同意才套用。
- 永久改變（特質、習慣、興趣、戀人）一律 `OC.Mind.suggest` → 玩家 `resolve`（accept/reject/later/lock/mute）；拒絕有 5 天冷卻。玩家設定的關係（`fixed`）與背景故事不可被自動改寫。
- 戀愛預設關閉，只有玩家標示為成年的角色才可能參與。
- 對話新增內容放 `LifeData.LINES`（分類＋條件＋變數），不要在程式裡寫死台詞；不同 OC 要靠 voice/trait/情緒條件產生不同說法。
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
- 改動生活系統後跑 `node game/tests/life/run.js`（至少相關的情境）；新功能要補測試。
- **懸浮桌寵與實機行為尚未驗證**（無模擬器）。在實機跑完 `docs/architecture.md` 驗證清單前不可宣稱完成。
- 金鑰：release keystore 只能經環境變數 `OC_RELEASE_*` 提供，絕不提交。
- 所有美術為原創；字體皆為開放授權（`game/fonts/LICENSES.md`），新增前先確認授權。

## 環境限制（實測）
- 無法連線 `dl.google.com` / Google Maven → 無法用 AGP / 下載 Android SDK；改用離線管線（`docs/android-build.md`）。
- Maven Central 偶爾 429；`--max-workers=1` 重試。GitHub raw 被封鎖；字體由 Google Fonts 取得。
- 沒有 Android 模擬器或實機：只能驗證到「APK 建置、簽章、內容正確」與「遊戲在 Chromium 手機模擬中正常」。
