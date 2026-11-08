# 權限與隱私（0.7.0-alpha）

原則：**只在玩家使用某個功能時才請求**；拒絕時功能照實顯示「未允許」並說明影響，不假裝可用；所有權限都能在系統設定撤銷，撤銷後 App 會偵測並調整。遊戲完全離線，不蒐集、不上傳任何資料。

| 權限 | 用途 | 何時請求 | 拒絕／撤銷時 |
|---|---|---|---|
| `SYSTEM_ALERT_WINDOW`（顯示在其他應用程式上層） | 桌寵顯示在桌面與其他 App 上方 | 按「啟動桌寵」或「在桌面測試」時，帶到系統設定 | 不會啟動；執行中被撤銷 → 螢幕亮著時每 2 秒檢查，偵測到就收起並顯示原因 |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE` | 桌寵服務在其他 App 上方持續執行（Android 14+ 類型 `specialUse`） | 安裝時（一般權限） | — |
| `POST_NOTIFICATIONS`（Android 13+） | 桌寵的「暫停／觸控穿透／收起」按鈕、番茄鐘與提醒的通知 | 第一次啟動桌寵時問一次；之後由管理頁按鈕帶到通知設定 | 桌寵照常（系統允許），但看不到通知 → 管理頁與工具頁明確提示 |
| `PACKAGE_USAGE_STATS`（使用情況存取，選用） | App 情境對話：**只**知道前景 App 的套件名稱 | 只有在「App 情境對話」開啟並按「前往允許」時 | 不說情境台詞（不猜）；頁面顯示未允許 |
| `SCHEDULE_EXACT_ALARM`（鬧鐘與提醒，選用） | 玩家要求「準時」的番茄鐘／鬧鐘 | 打開「準時」時帶到系統設定（Android 12+；Android 14 起預設拒絕） | 自動改用一般精度（可能晚幾分鐘），並標示 |
| `RECEIVE_BOOT_COMPLETED` | 重開機／App 更新後**重新登記玩家設定的提醒** | 安裝時（一般權限） | — 不會因此自動啟動桌寵 |

## 為什麼前景服務用 `specialUse`
Android 14 的標準類型（dataSync、mediaPlayback、location、connectedDevice、health、remoteMessaging、shortService、systemExempted…）都不符合「玩家放在桌面上的互動角色」，冒用其中任何一個都違反官方規範。`specialUse` 是官方為此保留的類型，需要：
- Manifest：`android:foregroundServiceType="specialUse"`（本專案以 `@integer/fgs_special_use` = `0x40000000` 表示，原因見 `android-build.md`）、`<property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="…">` 說明用途、`FOREGROUND_SERVICE_SPECIAL_USE` 權限；
- 程式：`startForeground(id, notification, FOREGROUND_SERVICE_TYPE_SPECIAL_USE)`；
- **上架 Google Play 時**：在 Play Console 的前景服務聲明填寫 specialUse 的用途說明與示範影片（尚未進行，見 `phase7-report.md`）。
沒有時間限制的類型限制（Android 15 的 dataSync／mediaProcessing 6 小時上限）不適用 specialUse，但我們仍然：只從前景啟動、`START_NOT_STICKY`、不使用 wake lock、螢幕關閉時停止繪製、通知裡隨時可以收起。

## 刻意**不**使用
- `BIND_ACCESSIBILITY_SERVICE`／無障礙服務：不讀其他 App 的內容（`verifyDebugApk` 會檢查 Manifest 沒有它）。
- `QUERY_ALL_PACKAGES`：App 清單只透過 `<queries>` 的啟動器 intent（同樣由建置檢查）。
- 通知存取、螢幕錄製／`MediaProjection`、截圖、網路、儲存空間、相機、麥克風、位置、`USE_EXACT_ALARM`、`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`。
- 安全畫面：系統隱藏 overlay（`HIDE_OVERLAY_WINDOWS`）時我們不對抗；不擷取畫面內容。

## 撤銷與清除
- 系統設定隨時可撤銷上面任何一項。
- 遊戲「桌寵管理 › 清除桌寵資料」：收起桌寵、刪除桌面用的影格、提醒與尚未同步的互動（不影響遊戲存檔）。
- 「App 情境對話 › 關閉並清除規則」：關閉並刪除每個 App 的分類與排除設定；使用情況存取請到系統設定撤銷（頁面有按鈕）。
