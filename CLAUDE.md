# CLAUDE.md — OC Shimeji（重構版）

原創角色（OC）的**自主生活模擬（觀察系）＋ Android 深度桌寵**。直向手機。
玩家匯入或自己畫角色，看牠們在家與小鎮自己過日子；角色也能跳到手機桌面上陪玩家。

**唯一的計畫書**：`docs/reboot/reboot-plan.md`（玩家已確認第十節的全部決定；第十一～十三節是系統總表與修訂路線圖 12.11、13.9）。
舊版（0.1–0.17，WebView＋three.js）已**整個捨棄**：程式只留在 git 歷史（最後一個舊版提交 `d88e849`）。不讀舊存檔、不沿用舊程式，也不要再參考舊的規則。

## 已確認的方向（不要再提新方案）
- **全部原生 Kotlin**，不依賴 AndroidX／Compose（本環境連不上 Google Maven）。
- **畫面**：2.5D 分層插畫（2D 場景、斜俯視固定鏡頭、可平移縮放）；角色、UI、桌寵都是 2D。
- **沒有捏臉**：外觀只來自匯入、內建繪圖工具或預設角色；外觀以外全部深度自訂（計畫第十二節）。
- **肉桂捲**（`art/chars/cinnamon/`，玩家提供的原圖）只是開新觀察時可以選的預設角色，**不是引導員**；教學用情境提示卡。
- **時間**：預設現實時間，另有可加速的遊戲時間（觀察時最快 60×）。
- **戀愛**：預設關閉、只限兩個成年角色、重大改變要玩家同意；未成年絕不涉及。
- 參考作品（角色觀察屋、Tomodachi Life、The Sims 4、inZOI、動物森友會、任天堂）只取設計原則，**不得**使用其文字、角色、介面圖形、地圖、音效或素材。所有美術與聲音都是原創；字型只用開放授權（`art/fonts/LICENSES.md`）。

## 目前階段
- **M0（0.1.0-reboot）地基——完成**：
  - 新專案骨架與離線 APK 管線；
  - `core:sim`（確定性亂數、時鐘）、`core:save`（收藏庫＋存檔兩層、原子寫入、每日備份、複製／分支）；
  - `render:api` ＋ Android Canvas 後端 ＋ Java2D 後端（截圖測試）；
  - `ui`（設計 tokens、彈簧、元件、存檔選單、開始新的觀察、M0 的世界畫面）。
  - 紀錄：`docs/reboot/m0-report.md`。
- 下一步：**M1 存檔與家**（計畫 12.11：開場流程與房型、需求、效用 AI、作息、觸碰、人物卡、補算）。

## 目錄
```
settings.gradle.kts  build.gradle.kts  gradle.properties（版本號 oc.versionName／oc.versionCode）  gradle/libs.versions.toml
core/sim/      純 Kotlin：Rng（SplitMix64，唯一的亂數）、GameClock（REAL／GAME）
core/save/     純 Kotlin：Storage（FileStorage 原子寫入＋.bak、MemStorage）、SaveSystem（收藏庫、存檔、備份、複製、分支）、Model（LibChar、SlotMeta、World）、Migrate、Presets（肉桂捲）
render/api/    Gfx 介面（dp 為單位、ARGB 顏色）、Img、Assets、Colors
render/jvm/    Java2D 後端（只給測試：把畫面畫成 PNG；不進 APK）
ui/            純 Kotlin 的整個介面：Theme（tokens）、Dim、Spring、UiApp（畫面堆疊、點擊區、覆蓋層、返回鍵）、Widgets、TitleScreen、NewObservationSheet、WorldScreen、ListSheet、Confirm
               src/test：UiTest（用點擊區模擬手指＋截圖比對 resources/golden）
app/           Android 外殼：MainActivity（全螢幕單一 GameView、insets、深色模式、返回鍵、輸入框）、AndroidGfx（Canvas 後端）、AndroidAssets；build.gradle.kts＝離線管線
art/           原創美術與字型（fonts/*.ttf、chars/cinnamon/original.png 與 idle.png）
docs/reboot/   計畫書、各里程碑報告、肉桂捲原圖
deliverables/  apk/（Debug APK＋sha256）、m0/（截圖）
```

## 指令
```bash
gradle -PcoreOnly=true test --max-workers=1                       # 所有純模組的測試（含 UI 截圖比對）
gradle -PcoreOnly=true :ui:test -Precord=true --max-workers=1     # 介面改了、截圖確認沒問題後，重新記錄 golden
gradle :app:assembleDebug :app:verifyDebugApk --max-workers=1     # Debug APK → app/build/outputs/apk/debug/oc-shimeji-<版本>-debug.apk（複製到 deliverables/apk/ 並更新 sha256）
pkill -f GradleDaemon                                             # 建完釋放記憶體
```
截圖輸出在 `ui/build/shots/`（每次測試都會產生，用眼睛檢查）。

## 規則
### 架構
- **一個模擬、一個時鐘**：生活只由 `core:sim` 推進；畫面、桌寵、背景補算都只是觀看者。模擬裡的亂數**只能**用 `Rng`（存檔種子＋用途 key：`Rng.of(seed, "weather")`），不得用 `kotlin.random`、`Math.random`、目前時間；同一個存檔、同一段時間結果必須相同（測試會比對）。
- **純 Kotlin 優先**：`core:*`、`render:api`、`ui` 不得依賴 Android；Android 只在 `app/`。新功能的邏輯寫在純模組並補 JVM 測試。
- **所有畫面都畫在 `Gfx` 上**（同一份程式在手機上用 Canvas、在測試裡用 Java2D）；不要在 `app/` 另寫畫面。
- UI 是即時模式：每幀畫自己並用 `app.zone(id, …)` 登記點擊區；`Screen.tap(id)` 處理。捲動區裡登記點擊區前設 `app.zoneDy`。覆蓋層（`Overlay`）出現後 `Dim.GUARD`（0.3 秒）內不接受點擊；點覆蓋層外面＝關閉；返回鍵先關覆蓋層。
- 圖示一律用 `Widgets.icon()` 畫的形狀，**不要**用字型裡的符號（`⋯ ✓ ‹` 在 Nunito 裡沒有，會變成方框）。

### 存檔
- 兩層：`library/`（收藏庫：跨存檔共用的角色原版與素材）與 `saves/<id>/`（一個世界）。只經 `SaveSystem` 讀寫；預設角色（`Presets`）永遠在收藏庫、不能刪；還住在某個存檔裡的角色不能從收藏庫刪。
- 每次寫入都是原子的（`.new` → `.bak` → 正式檔）；讀取壞掉時退回前一版。每個存檔每天第一次儲存時做備份，保留最近 3 天。
- 格式從 `v: 1` 開始。改格式＝在 `Migrate` 加一步（`from → from+1`）＋一份舊格式的測試檔；**不得移除舊的步驟**。比 App 新的存檔要拒絕並說原因。
- 圖片不放進 JSON：只存路徑或 id（`asset:` 開頭＝App 內建）。

### 設計（計畫第六節）
- 顏色、尺寸、動態只來自 `Theme` 與 `Dim`；白天／夜晚是同一套設計的兩個調色盤。字用 `ink*`（暖棕／奶油），不用純黑純白。
- 可以按的東西有下緣厚度（lip），按下時下沉；動態用 `Spring`。觸控區 ≥ 48dp；常用操作放在下方 40%；每個畫面最多一個主要按鈕；只有刪除這類無法復原的事才確認。
- **不得做假功能**：還沒做的就寫明「在 M? 製作」，不要放看起來能按、其實沒用的東西。

### Android
- 版本號在 `gradle.properties`，`AndroidManifest.xml` 必須一致（`genRes` 會檢查）；改版後確認 APK 內的 versionCode（`verifyDebugApk` 會檢查）。
- 離線管線：**ProGuard 只用來改寫 lambda，必須 `-dontshrink`**；`checkNoIndy` 不可移除（dx 不會改寫 lambda，手機上會閃退）。每個 Exec 任務都要宣告 inputs／outputs。
- 離線 aapt 只認得 API 23 的屬性：更新的屬性（例如 `resizeableActivity`、`configChanges` 的 `density`、`foregroundServiceType`）不能直接寫；需要時用資源參照或框架屬性包（舊版做法在 git 歷史 `android/tools/framework-extras/`）。
- **不要在 `setContentView` 之前呼叫 insets controller**；純外觀的視窗設定一律 `runCatching`。
- 存檔在 App 私有目錄（`filesDir`），不需要儲存權限；權限只在玩家使用功能時請求。不得使用無障礙服務、`QUERY_ALL_PACKAGES`、讀取其他 App 的內容或玩家輸入的文字。
- 桌寵（M3）：前景服務類型只用 `specialUse`、先加懸浮視窗再 `startForeground`、`START_NOT_STICKY`、不用 wake lock、不加全螢幕透明層、觸控穿透要 `FLAG_NOT_TOUCHABLE` 且不透明度 ≤ 0.8、所有視窗 `FLAG_NOT_FOCUSABLE`。
- 金鑰：release keystore 只能經 `OC_RELEASE_*` 環境變數提供，絕不提交；Debug APK 不可當成正式版。

### 流程
- 每個里程碑：APK → 全部測試 → 報告（`docs/reboot/m?-report.md`：做到的、沒做到的、**只能在手機上驗證的**）→ CLAUDE.md／README → 提交並推送到 `claude/oc-shimeji-visual-design-qcc3xy`。
- 沒有模擬器或實機：觸控手感、懸浮窗、耗電、各廠牌手機一律寫成「需要玩家在手機上驗證」，不可宣稱完成。
- 行內註解用 `/* */`（在一行多敘述的程式後面用 `//` 曾吃掉後半行）。

## 環境限制（實測）
- 連不上 `dl.google.com`／Google Maven：沒有 AGP、AndroidX、Compose、Android SDK 下載；用 Ubuntu 的 aapt／dx／zipalign／apksigner＋Robolectric android-all（`/opt/oc-android/`）＋API 23 platform jar。
- Maven Central、Gradle Plugin Portal、PyPI 可用；GitHub raw 被封鎖。git 推送只能推到工作分支（標籤推不上去）。
- 沒有 Android 模擬器或實機。
