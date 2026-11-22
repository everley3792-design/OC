# 擴充第一階段（2.1.0）報告：盤點與基礎修復

依據：`docs/reboot/expansion-plan.md`（第十五節）第一階段。存檔格式沒有改，仍然是 v17。

## 做到的
### 1. 盤點與計畫
- `expansion-plan.md` 收錄了整合版 50 項的完整盤點。每一項都寫了現在的狀態、和已確認方向的衝突、我的處理方式。
- 計畫分 8 個階段，每個階段都有驗收標準。

### 2. 長文字不再被切掉（#05）
- `Widgets.wrap` 遵守避頭規則：「）」「。」「，」這類標點不會出現在行首。
- 下面這些地方都改成自動換行，高度跟著內容長：
  - 清單列（`Page` 的列）；
  - 底單（`ListSheet`，每列的高度可以不同）；
  - 確認框（`Confirm`）；
  - 吐司（字越多停越久：`toastStay`）；
  - 頭上的泡泡（長句停久一點）；
  - 聊天底單（`TalkSheet`）；
  - 人物卡的紀錄與描寫；
  - `A11ySheet` 的說明。
- 測試 `UiTest.longTextIsNeverCut` 把很長的文字放進每一種元件，檢查沒有任何一行被「…」切掉。截圖都看過了。

### 3. 移除玩家啟動的小遊戲（#07）
- 猜拳、躲貓貓、接點心、翻牌已經從以下地方拿掉：
  - 環狀選單；
  - 人物卡；
  - 「和你」頁；
  - 每日小目標（「猜拳」換成「拍一張照片」）。
- 拿掉的程式：`RpsSheet`、`CatchScreen`、`FlipScreen`、`HideSeek`、`CatchGame`、`FlipGame`。
- 住民之間自己玩的猜拳保留，那是生活的一部分（`SocialTest.rockPaperScissorsHabitsAndNoGamesWithYou`）。
- 舊存檔裡的最高分沒有刪，只是不再顯示。

### 4. 聊天話題跟著當下（#07）
- `Society.topicsFor(id)` 會依當下情況給話題。考慮的有：
  - 心情、煩惱；
  - 今天發生的事、你們的關係；
  - 共同的朋友、喜歡的東西、夢想；
  - 天氣、深夜；
  - 他記得的事、秘密（要夠熟）；
  - 電視。
- 每個話題都有自己的回答和效果（`youChat`）。
- 測試 `YouTest.r21TopicsFollowTheMoment`：同一個角色在不同情境下，拿到的話題不同。

### 5. 統一內容格式（第一版）
- 新增 `social/Content.kt`：
  - 資料：`ContentEvent`／`When`／`Who`／`RelWhen`；
  - `Content.ok`：只檢查條件，不擲骰子；
  - `Content.problems`：驗證器。
- 格式說明：`docs/reboot/content-format.md`。
- 內建的 23 個日常事件搬進 `DailyContent`（JSON），`Events.DAILY` 從資料產生。
- 新功能：
  - 冷卻天數；
  - 只發生一次（`repeatable`）；
  - 後續事件：同一對隔幾天後，接上的機率是 4 倍。
- 戀愛分類的規則寫在 `Content.ok` 裡，永遠成立：兩位成年角色，而且戀愛打開。
- 測試 `ContentTest`：
  - 資料都合法；
  - 寫出去再讀回來完全一樣；
  - 驗證器抓得到 15 種錯誤；
  - 條件都是欄位；
  - 6 天的模擬裡事件照樣發生。

### 6. 設定整合（#20）
- 開始畫面 →「設定」（`SettingsPage`），有三類：
  - **畫面與操作**：畫面品質、大字、減少動態、色弱配色、震動。說明會換行，不再被切掉。
  - **淺色與深色**：跟著手機、一直淺色、一直深色。偏好存在 `ui:theme`。
  - **聲音**（`SoundSheet`）：靜音，以及音樂、音效、環境、角色四個音量（0／25／50／75／100）。設定經 `Platform.volumes` 傳到 `Sounds`，App 和桌寵服務都會套用。
- 測試會實際按下每一項，檢查值確實改了，而且傳到了平台（`lastVolumes`）。

## 和計畫不一樣的地方
- 計畫寫設定分「畫面、聲音、遊戲、資料」四類，這次只做了前面三類：
  - **遊戲**：時間流速、熱鬧程度是每個世界各自的設定，仍在世界裡調整（時間膠囊、時間線與信箱）。設定頁上有寫明去哪裡調。
  - **資料**：匯出、匯入、備份仍在每個存檔卡上。
  - 我沒有做「看起來能按、其實只是跳轉」的重複入口。

## 改了的檔案
- `core:sim`：
  - 新增：`social/Content.kt`、`social/DailyContent.kt`；
  - 修改：`social/Scenes.kt`、`social/Games.kt`、`social/YouData.kt`、`social/Acts.kt`、`act/Interactions.kt`、`life/Society.kt`、`life/TownLife.kt`、`life/WithYou.kt`、`life/LifeSim.kt`。
- `ui`：`Widgets`、`UiApp`、`Sheets`、`CreateUi`、`SocialUi`、`PersonCard`、`WorldScreen`、`YouUi`、`JournalUi`（`SettingsPage`、`SoundSheet`、`A11ySheet`）、`TitleScreen`、`CharacterEditor`、`DaysUi`、`Desk`、`Form`、`ItemEditor`、`ScriptUi`、`TownUi`。
- `app`：`Sounds`（四個音量）、`MainActivity`、`DeskService`（`volumes`）。
- 測試：
  - 新增 `ContentTest`；
  - 修改 `YouTest`、`SocialTest`、`UiTest`；
  - 刪掉 4 張已經沒有畫面的 golden，重新記錄其餘的 golden。
- 文件：`expansion-plan.md`、`content-format.md`、這份報告。

## 架構的改變
- **事件是資料**：條件是欄位，由 `Content.ok` 解讀，沒有可執行的內容。第三階段的內容庫和玩家的事件包會用同一套格式和驗證器。
- **文字一律換行**：元件不再假設一行。新元件應該用 `Widgets.wrap` 算高度。
- **音量**：介面只存偏好；`Platform.volumes()` 是唯一的出口，Android 端再套用。

## 測試
- 全部通過：229 個。
  - `core:sim` 147；
  - `core:save` 45；
  - `ui` 37，含截圖比對。
- 截圖在 `deliverables/p1/`：設定、聲音、畫面與操作、聊天話題、長文字的泡泡／底單／確認框／吐司／聊天、人物卡、和你。

## 只能在手機上驗證的
- 四個音量和靜音在手機上聽起來對不對，包括桌寵服務裡的聲音。
- 「一直淺色／一直深色」切換時的閃爍。
- 長文字換行後，在不同字型大小和螢幕寬度下好不好讀。
- `device-checklist.md` 的 49 項仍然有效。

## 沒解決的
- 2.0.0 正式版仍在等你的實機回報與金鑰。
- 互動（選單上的）還寫在 Kotlin 裡，第三階段才會搬進內容格式。

## 下一步：第二階段（2.2.0）角色模擬核心
- 性格 20 維度與情境問答；
- 特質擴到 80 個以上；
- 新需求（獨處、安全感、創造欲、成就感、歸屬感、好奇心、想念某人）；
- 記憶的重要程度、淡化、看到東西想起某人；
- 化學反應（第一印象、默契、嫉妒）；
- 習慣的形成與改變；
- 所有權；
- 目標層；
- 說話風格參數（#39）；
- 角色影響（#45）；
- 約定（#47）；
- 羈絆（#49）；
- 個人年表（#40）。

## 整體進度
8 個階段完成 1 個（約 12%）。50 項裡有實質進展的是 #05、#07、#20 和內容格式的基礎。
