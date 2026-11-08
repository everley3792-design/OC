# Android 原生層：系統懸浮桌寵、同步、工具與小工具（第七階段，0.7.0-alpha）

> 狀態：程式碼完成、APK 建置成功、純邏輯有單元測試、遊戲端以模擬橋接測試。**所有原生行為都還沒有在實機或模擬器上跑過**
> （雲端容器沒有 Android 裝置）——驗證步驟見 [`compat-test-plan.md`](compat-test-plan.md)，結果分類見 [`phase7-report.md`](phase7-report.md)。

## 1. 元件

```
game (WebView)                                 native (android/app/src/main/java/app/ocshimeji/…)
─────────────────────────────                  ─────────────────────────────────────────────────────────────
OC.PetSync (js/pet/petsync.js) ──petConfig──►  PetFiles  filesDir/pet/config.json
                                ──petSprites─►           filesDir/pet/oc/<ocId>/manifest.json + PNG
                                ◄─petEvents──            filesDir/pet/events.jsonl  (append-only, seq + install id)
                                ──petAck────►
                                ◄─petStatus──  OverlayPetService.diag() / status.json
OC.PetSync.Tools ─reminderSet──►  tools/Reminders (AlarmManager) ─► ReminderReceiver ─► 通知 + 桌寵說話 + tool 事件
                 ─widgetData───►  widget/PetWidget (AppWidgetProvider, RemoteViews)
petapps 頁 ──launchableApps───►  overlay/UsageWatcher (UsageStatsManager，只取套件名稱)

OverlayPetService (前景服務 specialUse)
 ├─ PetWindow × ≤3   每隻一個 TYPE_APPLICATION_OVERLAY 小視窗（只有寵物大小）
 │    ├─ PetBrain     (core:pet) Shimeji 行為：地板／左右牆／天花板
 │    ├─ Gestures     (core:pet) 點、雙擊、長按、撫摸、拖曳、丟出
 │    ├─ AnimClip     (core:pet) 玩家影格的時序（與 OC.Anim.frameAt 相同）
 │    ├─ PetTalk      (core:pet) 何時說哪一句（台詞由遊戲產生）
 │    ├─ PetView      軟體 Canvas 繪製：影格、陰影、鏡像、擠壓、擺盪、貼牆旋轉
 │    ├─ Bubble       泡泡（獨立的小視窗）
 │    └─ PetMenu      長按選單（獨立的小視窗，點外面就關）
 ├─ PetSocial    (core:pet) 多隻之間：個人空間、依關係碰面
 ├─ AppContext   (core:pet) App → 分類 → 台詞分類（玩家規則／排除）
 └─ Choreographer 迴圈（60/30 fps 上限、休息 15、暫停 10、螢幕關閉時完全停止）
```

`core:pet` 是純 Kotlin（不依賴 Android），所以行為、手勢、動畫時序、台詞節奏、App 規則、多隻互動都能在 JVM 上測試（`gradle -PcoreOnly=true test`）。

## 2. 視窗與觸控（不攔截其他 App）
- **每隻寵物一個視窗，大小 = 寵物**（96dp × 大小倍率），跟著寵物移動；泡泡與選單是另外的小視窗，只有內容那麼大。沒有全螢幕透明層，手指碰不到寵物的地方永遠交給下面的 App。
- 全部 `FLAG_NOT_FOCUSABLE` → 不搶鍵盤焦點、不影響輸入法與系統返回鍵。
- **觸控穿透**（設定或通知按鈕）：寵物視窗加 `FLAG_NOT_TOUCHABLE`，並把不透明度限制在 ≤ 80%——Android 12 起，穿過「其他 App 的不可觸控 overlay」的觸控只有在該視窗 ≤ 0.8 不透明時才會送到下面（否則系統會擋下觸控）。泡泡在穿透模式下同樣處理。
- 系統在敏感畫面（例如銀行 App 使用 `HIDE_OVERLAY_WINDOWS`）會隱藏我們的 overlay——我們不對抗它，也不截圖、不讀畫面。玩家也可以設定「在排除的 App 上方隱藏桌寵」。

| 手勢 | 判斷（`Gestures`） | 效果 |
|---|---|---|
| 點一下 | 短、幾乎沒移動 | 跳一下／被叫醒（台詞 tap / wake） |
| 點兩下 | 320 ms 內第二下 | 預設回到遊戲的桌寵管理（可改成「說說話」或不做事） |
| 長按 | 520 ms 不動（在下一幀確認，慢幀不會把點擊誤判） | 選單：摸摸頭、餵食、送禮、說說話、待在這裡／自由活動、收起這一隻、開啟遊戲 |
| 撫摸 | 手指來回（≥2 次反向）但沒有離開原處 | 被撫摸動畫＋台詞；一次撫摸送一個 `pet` 事件（15 秒最多一次） |
| 拖曳 | 明顯移開（或長按後移動） | 抓起來、身體像鐘擺擺動 |
| 放開 | 依手指速度 | 掉落／丟出（撞牆反彈，力道夠且允許爬牆時會抓住牆） |

## 3. Shimeji 行為（`PetBrain`）
狀態：IDLE、WALK、RUN、SIT、SLEEP、JUMP、FALL、LAND、CLIMB、WALL（貼在牆上）、HANG（倒吊在螢幕上方移動）、PEEK（躲到螢幕邊只露出一半）、DRAG、THROWN、REACT（一次性反應）。
可用範圍＝螢幕扣掉狀態列與導覽列（`WindowMetrics` insets）；旋轉、分割畫面後重新計算並讓寵物掉回新的地板。

**簡化版決策**（不是第四階段的 Utility AI，但用同一份資料）：
- 個性（`traits`：活力、社交、好奇、害羞、步調，由遊戲依角色個性換算）；
- 需求快照（`mood`：精力、玩樂、飽足、社交、主要情緒）；
- 時間（深夜／疲倦 → 坐下、睡覺）；
- 自主程度：待著（-1）／安靜（0，不跑不跳不爬）／一般／活潑；每個動作（爬牆、天花板、偷看、跑、跳）都可以單獨關閉。
**原生不改變任何需求**——遊戲是唯一的生活模擬（見 §6）。

## 4. 玩家動畫（完整整合）
遊戲把每位 OC 的 21 個桌面動作輸出成 PNG 影格（`OC.PetSync.renderSprites`）：
`idle walk run sit sleep jump fall climb hang peek drag happy pet eat surprised talk greet sad yawn shy cheer`

- 來源順序：桌寵設定頁的對應（可把任何桌面動作改用 OC 的任何動作，含自訂名稱）→ `OC.Anim.resolve`（方向 + `OC.Chars.ACTIONS` 備用鏈）→ 內建骨架（`rigState`，第七階段新增 `fall`/`hang`/`peek` 分段姿勢）。
- 玩家的逐格動畫（PNG 序列、Sprite Sheet、GIF、APNG、WebP、.ocpack 匯入的都一樣，因為匯入後都是 AnimDoc）**逐格輸出**，保留：影格順序、**每格時長**、循環／一次／來回、重複次數、速度、優先級、可否中斷、**影格事件**（bubble／emote 在桌面顯示成泡泡，sound 變成輕微震動）。
- 所有影格用同一框與腳底點（`appearance.refH` + `anchor`），切換動作不會跳動；左右用鏡像；玩家為牆面／天花板畫的 `climb`／`hang`／`peek` 標記 `oriented`，不再旋轉，其他（例如用走路代替的爬牆）旋轉貼在牆上。
- 原生 `AnimClip.at()` 與遊戲 `OC.Anim.frameAt()` 結果相同（同一組測試序列：`0123012`、`012321012`、`0123333`、`0001230`）。
- 「在桌面測試」：設定頁每個動作旁的按鈕 → `OCNative.petTest(oc, 動作)`（服務沒開時會帶權限流程啟動）。
- 解析度依畫質：96／128／160 px；解碼後的點陣圖放在全部寵物共用、以位元組計的 LRU（16／24／48 MB）。

## 5. 多隻桌寵
- 最多 3 隻（硬上限 `MAX_PETS`，玩家可設 1–3），每隻有自己的大小、不透明度、自主程度、動作開關、拖曳、雙擊、台詞頻率、靜音、動畫對應。
- `PetSocial`：在地板上靠近時——走路的會轉身（不重疊），休息時重疊太多，比較不喜歡對方的那隻走開；空閒時依**遊戲的關係資料**（有方向的 aff − conflict）碰面：很好 → 開心、一般 → 聊天、不合 → 害羞／難過；同一對 90 秒冷卻。
- 碰面送 `meet` 事件，遊戲端每對每天最多套用一次小幅關係變化（不計入任務／成就，因為不是玩家的行為）。

## 6. 同步協定（不重複衰減、不重複獎勵）
- **遊戲 → 原生**（`config.json`，`OC.PetSync.config()`）：`global`（fps、畫質、數量、螢幕關閉暫停、快取、穿透、泡泡、震動、主題、`app` 規則）、`pets[]`（每隻設定）、`data[ocId]`（traits、mood、**預先產生的台詞池**、背包裡的食物與可送的東西、稱號）、`aff`（成對關係）。
  時機：啟動、設定變更、App 切到背景前、App 在前景且桌寵執行時每 60 秒、套用互動後。
- **原生 → 遊戲**（`events.jsonl`）：`{id, inst, seq, t, oc, type, data}`，type = `pet`／`feed`／`gift`／`meet`／`tool`／`setting`。上限 400 筆（超過丟最舊的並計數，診斷頁可見）。
- **套用**（`OC.PetSync.pull()`）：只在 `OC.Sim.catchUp()` 之後（App 回到前景），依 seq 排序；`seq ≤ 水位` 的略過；餵食／送禮走 `OC.Tx.run('pet:' + id)`（固定 key → 不會重複扣物品）；**先存檔、再 ack**，所以當機不會重複也不會遺失。安裝 id（`inst`）改變（重新安裝）時水位歸零。
- 效果和遊戲內相同的資料路徑（感受、需求、好感、口味、回憶、`OC.Progress.emit`），但**沒有動畫**；摸摸頭每隻每天最多 12 次有效，不能刷好感。背包裡已經沒有的東西：不扣、沒有效果、通知玩家。
- 原生只顯示快照，**不模擬需求**；App 沒開的這段時間由遊戲的離線補算（最多 8 小時、不給獎勵）處理 → 不會雙重消耗。

## 7. 台詞
- 內容一律由遊戲的對話引擎產生（`LifeData.LINES`，第七階段新增 `desk_*` 分類），依聲線、特質、情緒、回憶、願望、天氣、時段；每個分類預先產生最多 5 句＋玩家在「桌寵設定 › 自訂台詞」加的句子。產生時保存／還原對話冷卻紀錄 → 預覽不影響遊戲。
- 原生 `PetTalk` 只決定時機：閒聊間隔（偶爾 240s／一般 90s／常常 40s，±30%）、每分類冷卻、不連續重複、靜音（連反應都不說）、睡覺時不閒聊。

## 8. App 情境對話（選用）
- 只用 `UsageStatsManager.queryEvents` 取得**前景 App 的套件名稱**（每 4 秒以上一次，只在桌寵執行、螢幕亮著時）。不使用無障礙服務、不讀畫面、通知、訊息、密碼或輸入內容。
- 分類：玩家規則（App → 遊戲／音樂／影片／閱讀／聊天／工作／瀏覽器／地圖／相片／購物／不說話／排除）＞系統分類（`ApplicationInfo.category`，可關閉）。排除的 App 不會被提到，可選擇在其上方隱藏桌寵。
- 沒有使用情況存取權限時：設定頁明確說明，桌寵不說情境台詞（不猜）。App 清單只透過 `<queries>` 的啟動器 intent，不使用 `QUERY_ALL_PACKAGES`。

## 9. 生命週期
- 只能從前景操作啟動（App 內按鈕、小工具按鈕會先開 App、通知按鈕只控制已在執行的服務）。`START_NOT_STICKY`：系統回收後不會自己復活（不做非正規保活）；沒有 wake lock。
- Android 14+：`startForeground(id, n, FOREGROUND_SERVICE_TYPE_SPECIAL_USE)`；Manifest 宣告類型與 `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`。
- Android 15：持有 `SYSTEM_ALERT_WINDOW` 的 App 只有在有可見 overlay 時才能從背景啟動前景服務 → 我們**先加視窗再 startForeground**；仍被系統拒絕時顯示原因並停止（`blocked`），不重試。
- 螢幕關閉：停止 Choreographer（設定可關）；旋轉／分割畫面：重新計算可用範圍；`onTrimMemory`：清空影格快取；螢幕亮著時每 2 秒檢查懸浮權限，被撤銷就收起並記錄原因（`revoked`；新增視窗失敗時也會立刻檢查）；收起時移除所有視窗、callback、receiver，沒有殘留計時器。
- 通知：低重要度頻道「桌寵」，按鈕「暫停／繼續」「觸控穿透／恢復觸控」「收起」，點通知開啟桌寵管理。Android 13+ 沒有通知權限時服務照常（系統允許），但看不到通知 → 管理頁明確顯示。

## 10. 工具與小工具
- 番茄鐘（專注 15/25/45、休息 5/10/15、自動接休息）、休息提醒（每 30/45/60/90 分鐘重複）、鬧鐘：`AlarmManager`，預設 `setAndAllowWhileIdle`（不需特別權限，省電時可能晚幾分鐘），玩家開「準時」且系統允許 `SCHEDULE_EXACT_ALARM` 才用 `setExactAndAllowWhileIdle`；頁面顯示實際精度。提醒存在 `filesDir/pet/reminders.json`，重開機／更新後由 `ReminderReceiver` 重新登記。
- 時間到：通知（頻道「番茄鐘與提醒」）＋桌寵說話（若在桌面）＋`tool` 事件（遊戲記錄完成的番茄數，可接續休息）。
- 待辦與筆記存在遊戲存檔（`S.pet.tools`），瀏覽器版也能用。
- 主畫面小工具 `PetWidget`（和桌寵是不同的東西）：OC 頭像、心情與一句話、最上面的待辦、下一個提醒；「放出／收起桌寵」。顏色用 `values` / `values-night` → 跟著系統深淺色。內容由遊戲寫入，小工具不跑模擬。

## 11. 主題與安全區
泡泡、選單用 `PetTheme`（依遊戲主題設定：淺／深／跟隨系統），通知用系統樣式，小工具用 night 資源；寵物活動範圍避開狀態列、導覽列與瀏海（`displayCutout`）。

## 12. 診斷
遊戲「桌寵管理 › 診斷」：服務狀態與原因、實測 fps 與上限、每幀耗時、影格快取用量、螢幕與 insets、待同步互動與被丟棄數、前景服務類型、App 情境狀態、每隻的狀態／動畫／表面／位置／重畫次數，以及同步紀錄（每個互動的套用結果）。
