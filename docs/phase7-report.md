# 第七階段完成紀錄（0.7.0-alpha）— Android 系統懸浮桌寵

> 一句話：**程式完成、APK 建置成功、純邏輯與遊戲端有自動化測試；所有原生行為都還沒有在實機或模擬器上執行過。**
> 雲端開發環境沒有 Android 裝置，也無法下載模擬器（Google 伺服器被封鎖）。下面把每一項分成：
> ✅ 已驗證（在這個環境真的跑過）／📱 需實機（程式寫好，必須在手機上確認）／◐ 部分完成／✗ 未完成。

## 交付
- APK：`deliverables/apk/oc-shimeji-0.7.0-alpha-debug.apk`（＋ `.sha256`）；versionCode 10，minSdk 26，**targetSdk 35**，Debug 簽章（v2＋v3）。
- **不是正式發行版**：Release 只會在你提供 `OC_RELEASE_*` 環境變數時簽署（`docs/android-build.md` §5），金鑰不在版本庫中。
- 截圖：`deliverables/phase7/`（遊戲端的桌寵管理、單隻設定、App 情境、工具、診斷、深色、瀏覽器版）。實機畫面：無。

## 結果總表

| 項目 | 狀態 | 依據 |
|---|---|---|
| **系統懸浮視窗**：TYPE_APPLICATION_OVERLAY、每隻一個只有寵物大小的視窗、泡泡／選單各自是小視窗、FLAG_NOT_FOCUSABLE | 📱 | `OverlayPetService`、`PetWindow`、`PetPopups`；Android 11+ 用 WindowContext 加視窗 |
| **前景服務 Android 14+**：類型 `specialUse`＋`PROPERTY_SPECIAL_USE_FGS_SUBTYPE`＋`FOREGROUND_SERVICE_SPECIAL_USE`；`startForeground(…, TYPE_SPECIAL_USE)` | ✅ 編譯後 Manifest／📱 系統接受 | `verifyDebugApk` 檢查 `aapt dump xmltree`：`foregroundServiceType(0x01010599)=@integer`→`0x40000000` |
| Android 15：先加 overlay 再 startForeground；被拒絕時顯示原因、不重試 | 📱 | |
| 通知：暫停／繼續、觸控穿透切換、收起；點通知開桌寵管理；Android 13 通知權限 | 📱 | 遊戲端顯示與請求 ✅（測試 1） |
| 生命週期：螢幕關閉停止繪製、旋轉／分割重算範圍、onTrimMemory 清快取、撤銷權限偵測、`START_NOT_STICKY`、無 wake lock、收起時清除 callback／receiver | 📱 | |
| **Shimeji 行為**：走、跑、跳、坐、睡、爬左右牆、貼牆、倒吊移動、掉落、偷看、拖曳擺盪、丟出反彈／抓牆 | ✅ 邏輯（JVM）／📱 畫面 | `PetBrainTest` 13 項：不出界、每種表面都會用到、關閉的動作不會出現、安靜模式、深夜疲倦睡更多、旋轉後仍在畫面內、可重現 |
| 個性／需求／時間驅動的簡化決策（與遊戲共用資料） | ✅ 邏輯＋資料 | `PetBrainTest`、`pet/run.js` 3d |
| **觸控**：點、雙擊、長按（下一幀確認）、撫摸、拖曳、丟出；不攔截其他區域；觸控穿透（≤0.8 不透明） | ✅ 手勢分類（JVM）／📱 實際觸控 | `GesturesTest` 5 項 |
| 長按選單：摸摸、餵食（背包食物＋喜好）、送禮、說話、待著／自由、收起這隻、開遊戲 | 📱 | |
| **玩家逐格動畫整合**：21 個桌面動作；順序、每格時長、循環／一次／來回、重複、速度、事件、優先級、腳底點、鏡像、貼牆影格不旋轉；備用鏈；對應到任何動作；在桌面測試 | ✅ 輸出（遊戲端）＋時序（JVM）／📱 桌面畫面 | `pet/run.js` 2a–2h（像素檢查影格順序）；`AnimClipTest` 與遊戲 `frameAt` 同一組序列 |
| 匯入格式（PNG 序列、Sprite Sheet、GIF、APNG、WebP、.ocpack）→ 桌面 | ✅ 間接 | 匯入後都是同一種 AnimDoc（第三階段已測），桌面輸出只讀 AnimDoc |
| **多隻**（≤3，硬上限）、獨立設定、個人空間、依關係碰面 | ✅ 邏輯＋設定／📱 畫面 | `PetSocialTest`、`pet/run.js` 3a–3d |
| **台詞**：遊戲對話引擎依個性／聲線／情緒／回憶／時段產生；自訂台詞；頻率、靜音；預覽不影響遊戲 | ✅ | `pet/run.js` 6a–6c、`PetTalkTest` |
| **App 情境對話**：UsageStatsManager（只取套件名稱）、預設關、規則／排除／隱藏、測試預覽、清除、沒權限時誠實說明 | ✅ 遊戲端＋規則（JVM）／📱 實際偵測 | `pet/run.js` 7a–7e、`PetTalkTest.appContextRulesAndExclusions` |
| **同步**：事件佇列（seq＋安裝 id）、catchUp 之後套用、OC.Tx 固定 key、先存檔再 ack、重送不重複、背包沒有就不扣、每日上限、碰面不計任務 | ✅ | `pet/run.js` 4a–4h、5a–5b、11a |
| 不重複衰減（原生不改需求） | ✅ 設計＋測試 | 5b；原生程式沒有任何寫入需求的路徑 |
| **桌寵管理中心**：真實狀態、權限（使用時才請求）、OC 選擇、互動、效能、App 情境、工具、診斷、清除 | ✅ 遊戲端 | `pet/run.js` 1a–1e、9a–9b、13a；截圖 |
| **工具**：番茄鐘（自動接休息、今日計數）、休息提醒（重複）、鬧鐘（準時需權限，否則標示一般精度）、待辦、筆記；開機重新登記 | ✅ 遊戲端／📱 AlarmManager、通知、開機 | `pet/run.js` 8a–8f |
| **主畫面小工具**（與桌寵分開）：頭像、心情、待辦、下一個提醒、放出／收起；深淺色 | ✅ 資料／📱 顯示 | 8f |
| **效能設定**：60／30 fps、畫質、數量、螢幕關閉暫停、快取；診斷頁 | ✅ 設定送達／📱 實際耗電 | 9a；耗電與記憶體**未量測** |
| 主題（原生泡泡／選單、通知、小工具）與安全區 | ✅ 設定送達／📱 顯示 | 12a |
| **備份**：存檔 v6、v5→v6 遷移、匯出入保留桌寵設定與水位、拒絕較新版本、不含可執行內容 | ✅ | `pet/run.js` 10a–10c；`docs/backup.md` |
| 瀏覽器版：原生功能標示「未開放」並說明 | ✅ | 14a–14b |
| **第一～六階段在 APK 中的完整 QA** | ◐ | APK 內遊戲檔與原始碼逐位元相同 ✅；遊戲在 Chromium 手機模擬中的回歸測試 ✅（見下）；**在手機 WebView 上逐項操作 📱** |
| Android 12–16 相容性測試 | ✗（計畫已寫） | `docs/compat-test-plan.md` 情境 1–17，全部「未執行」 |
| Release APK | ✗（需要你的金鑰） | 流程已存在；未用正式金鑰簽署 |
| AAB／Play 上架（含 specialUse 聲明） | ✗ | 需要 AGP／bundletool 與 Play Console |

## 自動化測試（本環境實際執行）
- Kotlin 核心：`cd android && gradle -PcoreOnly=true test` → **38/38**（新增 26：`PetBrainTest` 13、`GesturesTest` 5、`AnimClipTest` 3、`PetTalkTest` 4、`PetSocialTest` 1；原有 core 測試全過）。
- 第七階段遊戲端：`node game/tests/pet/run.js` → **53/53**（使用 `tests/pet/mock-native.js`，與 `NativeBridge.kt` 同一份約定；它不模擬 overlay 本身）。
- 回歸：第六階段 `tests/play` **67/67**、第五階段 `tests/world` **74/74**、第四階段 `tests/life` **52/52**（存檔版本斷言改為 v6）。
- APK（SHA-256 `d8c8104535b6403a907f48006b704344ce22e4ad6290d20b53ed5852a83dab1f`）：`assembleDebug` + `verifyDebugApk`（簽章、編譯後 Manifest 檢查、無無障礙服務／`QUERY_ALL_PACKAGES`）通過；APK 內 `assets/game` 與 `game/`（排除 tests、*.md）逐位元比對相同（63 個檔案）；dex 內含全部新類別（overlay／tools／widget／core:pet）；`aapt dump badging`：versionCode 10、targetSdk 35、7 個權限。

**回歸測試的修正（測試設計，不是遊戲行為改變）**：第六階段測試第一次跑在凌晨 0–1 點，遊戲的日夜循環從真實時間開始，於是 OC 在睡覺、夜間特殊事件（firstVisit）佔住角色、角色在聊天時柔和演出照設計只顯示卡片——9c、11c、1h、6b 因此失敗。用第六階段的原始程式（c4b6764）在同一時間重跑，9c 也一樣失敗，確認與第七階段無關。修正：測試開始時把遊戲時鐘固定在白天、場景開始前結束進行中的特殊事件、9c 先讓 OC 離開聊天、11c 重複觸發直到 25% 的機率抽中、1h 先把 OC 帶回同一地點、6b 的按鈕在頁面因星幣變動重建時重新取得。

## 這階段修正／決定的事
- **離線建置也能宣告 Android 14 的前景服務類型**：API 23 的屬性表沒有 `foregroundServiceType`、API 35 jar 的 `resources.arsc` 太新讀不了 → 新增 `android/tools/framework-extras/`（`aapt -x` 編出只有這個屬性的框架包，公開 id 以 javap 確認），值用 `@integer/fgs_special_use`。比對過加入前後的資源表（主題 parent 等框架參照不變）。
- targetSdk 33 → 35：edge-to-edge（原本就處理 insets）、registerReceiver 匯出旗標、PendingIntent 一律 IMMUTABLE、通知權限只問一次。
- 桌寵事件 id 加上「安裝 id」：重新安裝後原生 seq 從 1 開始，遊戲自動重設水位（測試中發現）。
- 單隻設定物件改為「永遠同一個物件」（頁面編輯時不會寫到舊副本，測試 2h 發現）。
- 小工具的「放出桌寵」改為先開遊戲輸出外觀再啟動（不會出現沒有圖的桌寵）。
- `.hstack > .grow`：設定列的開關靠右（原本只有 `.row` 內有效）。

## 已知限制／風險（需要實機確認）
- `specialUse` 在 Google Play 需要審查說明；被拒時可能需要改成「只在 App 可見時顯示」之類的設計。
- 從桌寵點兩下開啟 App（背景啟動 Activity）：持有 `SYSTEM_ALERT_WINDOW` 通常豁免，但 Android 15+ 的細節需實機確認；失敗時通知仍可開啟。
- 部分廠商 ROM（小米、OPPO、華為）對懸浮視窗與前景服務有額外限制或另外的權限頁。
- 軟體 Canvas 在 120Hz 高解析螢幕上的耗電、3 隻同時的記憶體尚未量測。
- 使用情況事件在部分 ROM 上延遲或不完整；我們只在有新的前景事件時才說話。

## 剩餘事項（下一階段）
見 `docs/roadmap.md`「第八階段」：實機跑完 `compat-test-plan.md`、量測耗電、AAB 與 Play 前景服務聲明、targetSdk 36、更多桌面動作與內容。
