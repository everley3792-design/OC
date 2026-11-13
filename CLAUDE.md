# CLAUDE.md — OC Shimeji

原創角色生活模擬 + Android 系統級懸浮桌寵。直向手機。

**已選定美術方向（第三輪做法 ①，方案 G「晴日島 3D」）**：世界（地形、建築、樹木、道具、家具、光影）是 **3D**（正交、俯角 50°）；8.0 起鏡頭有模式：經典 2.5D（固定、不旋轉，預設）、跟隨、特寫、自由（可兩指旋轉 ±52°）、電影（腳本鏡頭）；**角色、UI、繪畫工坊、逐格動畫、玩家素材、懸浮桌寵一律 2D**（角色以垂直看板放進 3D 世界）。不要改成全 2D 或全 3D，也不要再提新方案。

## 目前階段
- **第一階段完成**：7 個視覺方案（A–G）的影片、總覽圖、原型（`prototype/`、`deliverables/`）。保留供參考，不再修改。
- **第二階段完成**：可操作的遊戲（`game/`）+ Android 外殼與實際建置的 Debug APK。完成紀錄：`docs/phase2-report.md`。
- **第三階段完成（0.3.0-alpha）**：多角色、完整創角／捏角、自訂部件、個性與小怪癖、素材匯入匯出、繪畫工坊、逐格動畫工作室、`.ocpack`。完成紀錄與未驗證項目：`docs/phase3-report.md`。規格：`docs/character-format.md`、`docs/animation-system.md`、`docs/asset-io.md`。
- **第四階段完成（0.4.0-alpha）**：深度生活模擬——9 種需求、情緒、Utility AI 活動流程、作息、後天習慣（需同意）、願望／技能、多 OC 自主社交與共同活動、有方向的關係、資料驅動對話（可匯入匯出）、回憶、事件引擎、玩家互動、自主程度、分層／離線模擬、開發者診斷。完成紀錄、測試與未完成項目：`docs/phase4-report.md`。規格：`docs/behavior-engine.md`、`docs/life-format.md`、`docs/event-rules.md`、`docs/memory-model.md`。
- **第五階段完成（0.5.0-alpha）**：世界地圖與 7 個可進入的地點（晴日島、我的家、商店街、咖啡館、圖書館、苔光森林、星砂海灘；風車丘、遊樂園標示未開放）、跨地點 OC 自主生活與跟隨、統一互動設施、每個地點各自的佈置（復原／重做／旋轉／縮放／掛牆／收回）、釣魚／料理／採集／種田／小生物小遊戲、統一物品系統、雙模式背包與拖曳使用、每個 OC 的飲食喜好、工坊商品上架、7 間商店、星幣經濟與交易帳本、地點事件與回憶、圖鑑與探索進度。完成紀錄、測試與未完成項目：`docs/phase5-report.md`。規格：`docs/world-map.md`、`docs/items.md`、`docs/economy.md`。
- **第六階段完成（0.6.0-alpha）**：統一進度事件、任務（每日／每週／地點／限時／隱藏／長期挑戰）、角色請求（依個性、可接受／稍後／婉拒、後續發展）、人生目標、技能解鎖（每級都有實際效果）、稱號、37 個成就（玩家領取）、統一圖鑑（物品＋地點＋活動＋事件，四種狀態）、生活日誌與回憶卡片、動畫全面提升（分段姿勢、次級動態、個性差異、新動作）、可重用的特殊演出（跳過／×2）、即時合成的原創音效與環境音、「日常」中心。完成紀錄、測試與未完成項目：`docs/phase6-report.md`。規格：`docs/quests.md`、`docs/growth.md`、`docs/animation-performance.md`。
- **第七階段（0.7.0-alpha，程式完成、未經實機驗證）**：真正的 Android 系統懸浮桌寵——多隻（≤3）、每隻獨立小視窗、Shimeji 行為（走／跑／跳／坐／睡／爬牆／倒吊／掉落／偷看）、觸控（點、雙擊、長按選單、撫摸、拖曳丟出、觸控穿透）、玩家逐格動畫完整輸出到桌面、依個性／情緒／回憶的台詞、桌寵之間依關係互動、與遊戲的事件同步（不重複衰減、不重複獎勵）、App 情境對話（使用情況存取，只知道套件名稱）、番茄鐘／休息提醒／鬧鐘／待辦／筆記、主畫面小工具、桌寵管理中心與診斷；targetSdk 35、前景服務類型 specialUse。完成紀錄（已驗證／需實機／部分／未完成）：`docs/phase7-report.md`。規格：`docs/android-native.md`、`docs/permissions.md`、`docs/backup.md`、`docs/performance.md`、`docs/compat-test-plan.md`。
- **8.0（0.8.0-alpha）全面重構**：居民改為選用（新遊戲只有玩家自己的 OC）、Logo＋真 3D 開場＋歡迎＋登場＋OC 帶的教學、說話系統（自稱、稱呼、句尾頻率、多口頭禪、禁用詞、專屬稱呼）、11 種新特質、匯入原圖保留與依顯示大小的角色貼圖、四種鏡頭模式與旋轉、環狀情境選單、直接撫摸／抱起／甩動角色、狀態卡、時間面板、分級觸覺、原創即時生成音樂、台詞改寫、響應式主畫面小工具。紀錄（問題→原因→修正→驗證）：`docs/v8-report.md`。
- **0.9.0-alpha（打磨）**：15 個新的角色事件（含三段跨天小故事「秘密基地」，以旗標串接）、創角的 5 題性格問答與隨機性格、3D 環境生物（蝴蝶、鳥群、跳魚）、事件選項改寫共用定義的錯誤、重複圖鑑通知、設定的時間區塊改用時間面板。紀錄：`docs/v9-report.md`。
- **10.0（0.10.0-alpha）美術與體驗重構**：「晴空玩具」Design System（白瓷玩具表面、長春花紫強調、珊瑚紅點、星空深色主題、計算出的彈簧動態）、原創貼紙圖示（`OC.UI.sticker`）、依參考圖重排的 HUD（頭像名牌、天氣膠囊、系統鍵、右側工具列、任務卡、互動鈕、白色大導覽列）、頁首雲邊天空、分類貼紙鈕、世界調色（暖主光／冷天光、金色午後、光暈、景深）、角色玩具光影、跳躍預備／回彈。規格：`docs/design-system.md`；紀錄：`docs/v10-report.md`。
- **10.1（0.10.1-alpha）**：修正「互動後角色卡住」（遺失的放開手勢、被取代的對話、沒回答的事件提問，加上保留的安全網）、環狀選單改成連續動作、多面體植物、逐頁打磨。驗收：`node game/tests/v10/run.js`。紀錄：`docs/v10-report.md` 後半。
- **11.0（0.11.0-alpha）互動與生命感重做**：真正的滑動撫摸（依手指速度／身體部位／個體喜好連續累積，不是點一下）、親近環（抱抱、擊掌、戳、牽手）、`OC.Anim11` 107 個資料驅動動作（姿勢間 0.2 秒柔和過渡、情緒小動作、觸摸層）、`OC.Mind11` 多步計畫／每日目標／對他人的認知／可解釋的「想法」、`OC.Social11` 10 種雙人互動（各有互補動畫）、創角舞台（轉盤、點部位）與誕生演出、角色聲線（每個 OC 一種、隨心情改變）／立體聲定位／動作與腳步音效／音樂強度層／分層觸覺節奏、世界觸控回饋（點地面波紋、點樹搖晃落葉、跑步揚塵）、桌寵多 10 個小動作。驗收：`node game/tests/v11/run.js`。紀錄與未驗證項目：`docs/v11-report.md`。
- **12.0（0.12.0-alpha）修正與成熟化**：修掉純文字格的灰色圓底座與作息輸入框重疊、請求可取消、技能頁與地圖重新設計、**去除 NPC（只用玩家自己的角色）**、極簡 HUD（工具把手＋小膠囊、導覽列只有圖示、閒置淡出）、**每個角色各自的操控模式（手動／半自動（預設）／全自動），狀態卡、長按 HUD 頭像、生活設定都能切換**、成熟語氣（`lines12.js` 約 480 句、預設「沉穩」；「活潑」回到舊的）與預設「雅緻」介面風格、`OC.Arcs`（情緒感染、冷戰→解凍→和解／疏遠、三人以上的聚會）、桌寵自己的聲音（`OC.PetSound` ＋ 原生 `PetSounds` ＋ core `PetSound`）與雙人桌面動作（`PetSocial.KINDS`）、`OC.Sound.cue`（過場短句接到真實事件）、3D 的接觸陰影／房間布置（`OC.Dress`）／重新建模的家具（`models12.js`）。**3D 只做了一部分：房屋、樹木、岩石的造型沒有重新建模。** 驗收：`node game/tests/v12/run.js`。紀錄（問題→原因→修正→驗證＋未驗證項目）：`docs/v12-report.md`。
- **13.0（0.13.0-alpha）**：操控／觀察中的角色自己換地點時畫面跟過去、圖片角色的調整（翻轉／轉向／縮放／位移／裁切，繪製時套用）與 `OC.Puppet`（單張圖片自己表演所有動作＋特效）、79 個資料驅動特質（`traits13.js`，衝突提示、隨機）、新的預設介面風格（`data-style="play"`：世界裡無框、選單依主題紙感／石板、奶油色對話框）、`OC.Fun`（猜拳、躲貓貓、搖樹掉落、角色主動來訪與約定）、四章節教學、桌寵作息（`core/pet/PetRoutine`）。**桌寵原生層與各頁面版面沒有整個重寫。** 驗收：`node game/tests/v13/run.js`。紀錄：`docs/v13-report.md`。
- **14.0（0.14.0-alpha）統一風格與打磨**：整個 App **只有一種介面風格**「島日和」（奶油紙、暖棕字、薄荷綠＝可按、陽光黃＝已選；白天／夜晚是同一套設計的兩個調色盤；風格切換已移除）、HUD 小膠囊、彩色導覽列、背包口袋格、交易紀錄（餘額／今日／分日）、桌寵中心的「桌面」預覽、圖片角色用手指直接裁切／移動／縮放、樹／杉樹／灌木／岩石／房屋正面重新建模、**靜態模型依材質合併（`Models.fuse`，小島繪製呼叫 557 → 約 250）**、**桌寵行為全部搬進 `core/pet/PetActor`（純 Kotlin、有單元測試），原生視窗只負責顯示**、新增「去睡一下／叫醒」。**原生層仍未經實機驗證。** 驗收：`node game/tests/v14/run.js`；逐頁檢視：`node game/tests/v14/shots.js`。紀錄：`docs/v14-report.md`。
- **14.1（0.14.1-alpha）修正卡頓**：調色從「畫布上的 CSS 濾鏡」改到著色器、光暈層不用混合模式、白天關掉路燈點光源、陰影每兩幀更新且只有「高」用柔邊、載入地點時預先編譯著色器、「平衡」會自動降解析度、HUD／泡泡只在改變時寫 DOM；`core/pet/PetStage`（多隻桌寵一起做的事）；房屋主體／攤位／橋重新建模；工坊改成工具方格。**手機上是否還卡沒有驗證。** 紀錄：`docs/v14.1-report.md`。
- **14.2（0.14.2-alpha）**：玩家回報平均約 20 fps。角色看板改用 CPU 畫布（上傳貼圖不用從 GPU 讀回）、一幀最多重畫兩個角色、待機每秒重畫 2 次、花圃的花合成一叢（小島繪製呼叫約 250 → 約 140）、自動降級多一級（關陰影與草）、「顯示 FPS」顯示每幀時間／繪製時間／角色重畫／呼叫數／解析度／降級、拿掉 14.1 加的 WebView 硬體圖層。**手機上是否改善仍未驗證。** 紀錄：`docs/v14.1-report.md` 的「一之二」。
- **15.0（0.15.0-alpha）互動模型與介面骨架**（計畫 15.0–15.3，保留 2D 角色）：**點選 ≠ 執行**（`OC.Pick`：點物件只出現動作卡，按了才做；卡片／環狀選單／對話選項剛出現 0.35 秒不接受按壓；設定「點一下就做」可回到舊行為）、動作清單（`OC.Queue`，左上可逐項取消）、操控標記、「日常」改成口袋手機（App 主畫面）、拍照模式與相簿（`OC.Photo`）。紀錄：`docs/v15-report.md`。
- **15.1（0.15.1-alpha）逐頁重新設計（第一批）**：角色頁＝晴日公寓（每人一間房、空房間＝新增）、檔案＝島民護照、家裡的牆壁與地板（`S().surfaces`，佈置模式）、商店購買畫面＝試衣間（用副本試穿）、設定的區塊方格、創角第一步的大卡片；修正 15.0 防誤觸擋住「點外面關閉」。地圖、桌寵中心、設計亭、創角大舞台還沒做。紀錄：`docs/v15.1-report.md`。
- **15.2（0.15.2-alpha）兩個新地點與島上生活**：開放**風車丘**（風車磨坊商店、薰衣草田、野餐墊、草原蚱蜢）與**彩虹遊樂園**（星光舞台演唱會小遊戲、摩天輪、旋轉木馬、套圈圈、點心攤）（`js/world/areas15.js`）；打工（`OC.Jobs`）、島報／房間評分／小島評價／生日（`OC.Island`）。夢境、宣言、連續劇、願望與恐懼、人生階段、季節活動未做。紀錄：`docs/v15.2-report.md`。
- **15.3（0.15.3-alpha）視覺與動態打磨**：季節（`OC.Clock.season()`；色調烤進著色器、角色不套；`OC.Ambient` 的花瓣／落葉／雪與海面閃光）、雲朵轉場、遊樂園燈泡接夜晚燈光、遊樂園音樂盒與風車聲、逐頁檢查。地圖、桌寵中心、設計亭、創角大舞台、季節活動未做。紀錄：`docs/v15.3-report.md`。
- 下一步見 `docs/roadmap.md`。「其他島嶼／旅行」仍未開放，不要做假入口（15.2 起地圖上沒有鎖住的島）。
- 參考作品只吸收設計原則，**不得**使用其角色、Logo、介面圖形、地圖或素材。

## 目錄
```
game/                 正式遊戲（離線網頁，打包進 APK assets）。無建置步驟，直接用瀏覽器開 index.html
  css/tokens.css      Design Tokens（淺色/深色）——唯一的顏色/字級/間距/動態來源
  css/app.css         UI 元件
  js/world/areas15.js 15.2 風車丘（hill）與彩虹遊樂園（fair）  js/play/island15.js OC.Island（島報、房間評分、小島評價、生日）  js/play/jobs15.js OC.Jobs（打工）
  js/ui/pick15.js     OC.Pick（15.0：點選的動作卡、guard 防誤觸）  js/life/queue15.js OC.Queue（動作清單）  js/ui/photo15.js OC.Photo（拍照模式＋相簿頁 album）
  css/island.css      14.0「島日和」：唯一的介面風格（最後載入；HUD、導覽列、環狀選單、口袋格、帳本、桌寵桌面、裁切框）
  lib/three.min.js    three.js r158（MIT，UMD，全域 THREE）
  js/core/            oc.js（工具，與 prototype/shared/core.js 相同）store.js（存檔/事件）clock.js（時間/天氣）game.js（任務/成就/目標規則；12.0 起沒有居民）
  js/life/            data.js（需求/情緒/活動/社交/習慣規則/台詞/事件資料）sim.js（固定步長排程器＋遊戲時鐘＋離線補算）mind.js（需求/情緒/回憶/紀錄/關係/願望/技能/作息/成長）
                      talk.js（對話引擎）brain.js（Utility AI、活動狀態機、可供性/預約、社交編排、分層模擬）events.js（事件生命週期）
  js/art/             vec.js vchar.js（第二階段 rig，NPC 圖示仍用）rig.js（擴充 rig：比例、五官、部件錨點）style.js（物品目錄、預設外觀）
  js/char/            assets.js（IndexedDB 素材）model.js（角色資料 v2、性格→行為、成長）anim.js（動畫文件、播放、fallback）render.js（統一繪製）io.js（解碼、Sprite Sheet、ZIP、.ocpack）
  js/world/           models.js（3D 模型庫）env.js（光照/天氣/特效）world.js（引擎：鏡頭、導航 A*、看板角色、輸入、拾取、佈置）areas.js（晴日島、苔光森林）
  js/items/           art.js（原創程序物品圖示）items.js（OC.Items 物品目錄／搜尋／工坊商品、OC.Taste 飲食喜好）tx.js（OC.Tx 唯一交易流程＋帳本）shops.js（OC.Shops 商店、價格、收入）
  js/world/           models2.js（室內、商店、海灘、菜園等模型）areas2.js（家、咖啡館、圖書館、商店街、海灘＋島/森林的菜園、釣魚、採集、小生物）places.js（OC.Places 地點登記、移動時間、菜園、採集、魚表、每個地點的房間）
  js/ui/              ui.js（DOM/圖示/表單/提示）stickers.js（OC.UI.sticker 彩色貼紙圖示、stickerOr）kit.js（色環、滑桿、標籤、復原）pages.js（一般頁面）charedit.js（編輯區塊＋預覽舞台）creator.js（創角流程）
                      charpages.js（角色列表/檔案/編輯器/工坊/桌寵）library.js（匯入與素材庫）paint.js（繪畫工坊）animstudio.js（動畫工作室）
                      lifeui.js（OC 互動選單、通知、檔案「生活/關係/回憶」、生活設定、對話編輯、開發者診斷）
                      p5pages.js（世界地圖、背包、商店、工坊商品、交易紀錄、OC.Use 使用物品、飲食喜好）worldui.js（OC.WorldUI 移動、抵達、設施點擊）minigames.js（OC.Mini 釣魚、料理、小生物）
                      p6pages.js（「日常」中心、成就、統一圖鑑、角色檔案「成長」「日誌」、聲音設定、請求橫幅、遊玩系統診斷）
  js/pet/             petsync.js（OC.PetSync：桌寵設定／快照／台詞池／影格輸出／桌面互動套用／工具）petpages.js（桌寵管理、單隻設定、App 情境、番茄鐘與提醒、診斷）
  js/ui/intro.js      OC.Intro（Logo、開場拍攝、歡迎、登場）tutorial.js（OC.Tutorial）radial.js（OC.Radial 環狀選單）touch.js（OC.Touch 撫摸／抱起／甩動）
  js/life/lines8.js   8.0 台詞（資料）  events9.js（0.9 事件與台詞，資料）
  js/world/ambient.js OC.Ambient（蝴蝶、鳥群、跳魚；純視覺）
  js/char/anim11.js   OC.Anim11（11.0 資料驅動動作庫、觸摸層、情緒小動作 fidget；render.js 的預設分支呼叫它）
  js/life/lines12.js  12.0 成熟語氣台詞（資料，`m:true`；約 480 句／141 分類）  arcs12.js（OC.Arcs：情緒感染、冷戰、三人以上聚會）
  js/world/models12.js 重新建模的家具（同 id、同占地；書依顏色合併）  dress12.js（OC.Dress：畫框、地毯、窗光、小燈串、商店街花圃；純視覺）
  js/pet/petsound.js  OC.PetSound（用角色自己的聲線離線合成 14 個 WAV，交給原生）
  js/life/mind11.js   OC.Mind11（計畫、每日目標、對他人的認知、想法說明）  social11.js（OC.Social11 雙人互動種類）  lines11.js（11.0 台詞，資料）
  js/play/            content.js（OC.PlayData：任務、挑戰、請求、技能解鎖、人生目標、稱號、成就、紀念品、新台詞）progress.js（OC.Progress 唯一進度事件）
                      quests.js（OC.Quests）achieve.js（OC.Achieve）growth.js（OC.Growth 技能解鎖／人生目標／稱號）requests.js（OC.Requests 角色請求）
                      stage.js（OC.Stage 特殊演出＋回饋卡片）sound.js（OC.Sound 即時合成音效與環境音）
  tests/life/         run.js + harness.js：第四階段情境測試 1–13（Playwright；不打包進 APK）
  tests/world/        run.js：第五階段情境測試 1–13＋交易測試 T1–T8（小遊戲由機器人用真實指標事件遊玩；不打包進 APK）
  tests/play/         run.js：第六階段情境測試 1–14（請求、任務、技能、目標、圖鑑、成就、檔案、演出、跳過、切換、洩漏、重開）
  tests/v8/           run.js：8.0 驗收（首次遊玩、開場／教學、說話與特質、畫質、鏡頭、選單、觸碰、時間、狀態卡、演出、主題／小螢幕、長時間、遷移）
  tests/v15/          run.js：15.x 驗收 1–8（點選≠執行〔真實觸控〕、動作清單、口袋手機、拍照與相簿、15.1 的頁面、15.2 新地點、島報與生日、15.3 季節與轉場）
  tests/v14/          run.js：14.x 驗收 1–8（單一風格、背包與帳本、桌寵桌面、手指裁切、合併後的世界、小修正、14.1 效能、14.2 角色貼圖與效能數字）；shots.js：逐頁截圖（淺色＋深色，檢視用）
  tests/v13/          run.js：13.0 驗收 1–7（跟隨換地點、圖片角色、特質、小遊戲、來訪與約定、介面風格、教學）
  tests/v12/          run.js：12.0 驗收 1–11（請求取消、版面、技能頁、地圖、無 NPC、操控模式、極簡 HUD、語氣與風格、情緒感染／冷戰／聚會、過場短句、3D）
  tests/v11/          run.js：11.0 驗收 1–7（撫摸、親近環、動作庫、AI 計畫、雙人互動、音訊、世界觸控回饋；音訊用音訊執行緒上的錄音節點量測）
  tests/pet/          run.js + mock-native.js：第七階段（桌寵的遊戲端：狀態、權限、影格輸出、多隻、同步、台詞、App 情境、工具、備份、重開、瀏覽器版）
  tests/fixtures/     匯入測試素材（PNG 序列、GIF、APNG、WebP、Sprite Sheet、ZIP、損壞檔；不打包進 APK）
  js/app.js           外殼：開機、主題、效能模式、HUD、導覽、快速背包、互動、對話、佈置、桌寵輸出、OCApp 原生掛鉤
android/              Gradle 專案。app（WebView 外殼 + bridge + overlay/ 多隻桌寵 + tools/ 提醒 + widget/ 小工具）；core:*（純 Kotlin；core:pet = PetActor（14.0：一隻桌寵的全部行為）、PetBrain、Gestures、AnimClip、PetTalk、AppContext、PetSocial、PetSound、PetRoutine）
  tools/framework-extras/  離線 aapt 用的框架屬性包（只有 foregroundServiceType；不打包進 APK）
prototype/            第一階段原型（凍結）
docs/                 phase2-report、roadmap、design-system、ui-components、art-guidelines、android-build、architecture …
deliverables/         apk/（Debug APK + sha256）phase2/（截圖）videos/ overviews/（第一階段）
```

## 指令
```bash
cd game && python3 -m http.server 8765        # 開 http://localhost:8765/index.html（手機尺寸 393×852 檢視）
node game/tests/life/run.js [1 2 …]           # 第四階段情境測試（先開上面的 http.server；約 15 分鐘；截圖存 deliverables/phase4/）
node game/tests/world/run.js [1 2 …]          # 第五階段情境測試（約 15–20 分鐘；截圖存 deliverables/phase5/）
node game/tests/play/run.js [1 2 …]           # 第六階段情境測試（約 15 分鐘；截圖存 deliverables/phase6/）
node game/tests/v8/run.js [1 2 …]             # 8.0 驗收（約 6 分鐘；截圖存 deliverables/v8/）
node game/tests/v10/run.js [1 2 …]            # 10.x 驗收：角色不會卡住、環狀選單（約 3 分鐘）
node game/tests/v15/run.js [1 2 …]            # 15.0 驗收（約 4 分鐘）
node game/tests/v14/run.js [1 2 …]            # 14.0 驗收（約 3 分鐘）
node game/tests/v14/shots.js <輸出目錄> both   # 逐頁截圖（淺色＋深色；用眼睛檢查用）
node game/tests/v13/run.js [1 2 …]            # 13.0 驗收（約 12 分鐘；可用 OC_URL 指向別的連接埠）
node game/tests/v12/run.js [1 2 …]            # 12.0 驗收：修正、無 NPC、操控模式、極簡 HUD、成熟語氣、冷戰與聚會、過場短句、3D（約 25 分鐘）
node game/tests/v11/run.js [1 2 …]            # 11.0 驗收：撫摸、親近環、動作庫、AI、雙人互動、音訊、世界觸控回饋（約 15 分鐘）
node game/tests/v10/shots.js deliverables/v10 both   # 視覺一致性圖庫（淺色＋深色）
node game/tests/pet/run.js [1 2 …]            # 第七階段（桌寵遊戲端，模擬 OCNative；約 3 分鐘；截圖存 deliverables/phase7/）
cd android && gradle -PcoreOnly=true test --max-workers=1          # Kotlin 核心測試（75 個，含桌寵 Shimeji／手勢／動畫時序／台詞／App 規則／多隻）
cd android && gradle -Poc.build=offline :app:assembleDebug :app:verifyDebugApk --max-workers=1   # 含 ProGuard desugar + checkNoIndy
#   → android/app/build/outputs/apk/debug/oc-shimeji-0.15.3-alpha-debug.apk（複製一份到 deliverables/apk/）；verifyDebugApk 也檢查編譯後的 Manifest
cd android && ./gradlew :app:assembleDebug     # 標準 AGP（需 Android SDK + Google Maven；本環境無法使用）
```
測試素材在 `game/tests/fixtures/`。Playwright 與 Chromium 已預裝（`require('playwright')`）；WebGL 測試加 `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`。軟體渲染很慢，效能數字不代表手機。

## 規則
- **座標**：遊戲邏輯一律用設計座標 (x, y, 層)；3D 由 `X=x, Z=(y+層·24)/sin50°, Y=層·24/cos50°` 對應。點擊螢幕＝設計座標（不用射線），一律經 `World.screenToDesign` / `screenDelta`（含鏡頭旋轉的反算）；碰撞框是「螢幕上直立」的。看板角色 `rotation.y = yaw` 面向鏡頭。可行走/層級/地面高度寫成解析函式（`OC.Areas.*`）。
- **角色**是 2D 看板：只在量化姿勢改變時重畫紋理；呼吸/彈跳用網格變換。轉身用連續的 `face`/`back` 平滑趨近，不可瞬間翻轉。
- **UI 只用 tokens**；主題切換只改 `<html data-theme>`，不得重建 DOM、重載材質或重設 3D 場景。UI 主題與世界晝夜獨立。
- **14.0 Design System「島日和」**（`docs/design-system.md`、`css/tokens.css` 開頭）：**只有一種風格**，不要再加 `data-style` 或風格選項；白天／夜晚兩個調色盤的圓角、形狀、元件必須相同。表面＝奶油紙＋下緣薄邊（`--hl` + `0 3px 0 var(--lip)` + 陰影）；`--accent`（薄荷綠）＝可按，`--sun`（陽光黃）＝已選取／星幣／獎勵，`--alert`＝紅點／新東西；字一律用 `--ink*`（暖棕／奶油，不用純黑純白）；對話、提示、教學卡用 `--balloon*`；標題前的小葉子用 `--leaf`。新的全域外觀寫在 `css/island.css`（最後載入）。按下用 `--t-press` 下沉、放開用 `--spring`；地點／工具／導覽／大清單圖示用 `OC.UI.sticker`，小的行內符號才用線條 `OC.UI.icon`。新元件不得寫死色碼（貼紙、物品圖、世界除外）。常駐在畫面上的元件**不得**用 `backdrop-filter`（每幀成本）。HUD 是有底的小膠囊（看得清楚），不蓋住畫面中間。參考作品只取原則，不得使用其素材。
- **不得在 3D 畫布（`#world`）或蓋住整個畫面的常駐元素上用 CSS `filter`、`mix-blend-mode`、`backdrop-filter`**（每一幀一次全螢幕離屏合成，手機 WebView 上非常慢——14.1 的教訓）。世界調色寫在著色器裡（`world.js` 對 `THREE.ShaderChunk.tonemapping_fragment` 的補丁，所有模式都有）；`html.grade` 只控制光暈層（一般半透明層）；`html.dof` 的景深是唯一的例外，只在「高」。景深只模糊 3D 畫布，不可模糊 HUD 或泡泡。角色「玩具光影」只加在程式繪製的角色，**匯入／手繪的角色圖保持原樣**。
- 頁面「建一次、就地更新」（`OC.Pages.define`）。每頁最多 1 個主要按鈕；觸控 ≥ 48dp；常駐 HUD ≤ 6 個操作元件（名牌、天氣時間、右側工具列 3 個、任務卡；通知鈴只在有通知時出現；導覽列另計），不要在 HUD 重複已有的入口（設定在「日常」、互動＝點你的 OC）。頁首貼紙在 `pages.js` 的 `PAGE_STK`。
- **新遊戲不得自動加入玩家沒選的角色**：角色只由玩家建立、匯入或明確加入（12.0 起連居民／NPC 系統都已移除）。
- 開場／教學：自動化測試設 `localStorage['oc.skipIntro']='1'`（harness 預設）；`OC.Intro`、`OC.Tutorial` 的進度存在 `S.intro`。教學步驟必須由真實事件完成（`St.emit('menu:open' | 'touch:pet' | 'touch:land' | 'status:open' | 'time:panel' | 'cam:*')`）。
- 角色觸碰走 `OC.Touch`（World 的 claim 掛鉤）：手指落在角色上就屬於角色，不移動鏡頭；放開後一定落在可走地面；資料變化只經既有 API（`LifeUI.pet`、`Brain.hold`、`Mind.feel`）。
- 說話一律經 `OC.Chars.speak(c, text, {to, emo, cat, rnd})`；不要在程式裡直接加口癖或口頭禪。
- 匯入圖片：原圖保留（`Assets.original(id)`），工作圖 ≤ 2048；不要再把角色固定畫在小貼圖上（`World.bbRes` 依顯示大小）。
- **不得做假功能**：未實作的功能用 `lockedRow` / `.locked` 明確標示「未開放」；任務、成就、目標只能由真實行為累積。
- 天氣/時間變化用指數趨近（τ≈1.6s），不可閃光、不可晃鏡頭；霧永遠開著（晴天推遠），切天氣不重新編譯著色器。
- 效能模式（高/平衡/省電/自訂）必須真的改變：像素比、陰影、特效、草、fps 上限、看板解析度、點光源。
- 3D 模型：倒角/車床柔邊、登記碰撞（`ctx.block`）、共用幾何與材質快取；整島 ≲ 250 draw calls。
- 存檔 schema `v:7`（`store.js` 的 `fresh()`；角色欄位由 `OC.Chars.normalize()` 補預設值）。v1–v6 存檔會自動遷移，**不可移除 `migrateV1` … `migrateV6` / `migrateLegacyAnims`**。
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
- **玩法只有一個進度事件流**：任何遊戲行為用 `OC.Progress.emit(事件, 資料)` 回報一次；任務、請求、人生目標、挑戰、成就都只聽它。不要為某個任務另寫計時器或判斷。離線補算時不會送出（不給離線獎勵）。
- 任務／請求／目標／成就／挑戰的獎勵一律 `OC.Quests.grant(key, reward)`（內部 `OC.Tx`），key 固定：`q:<實例>`、`chal:<id>:<階>`、`req:<id>`、`asp:<oc>:<id>`、`ach:<id>`。成就由玩家領取，不自動入帳。
- 任務提供前一定檢查 `req`（地點開放、買得到、OC 數量），不可要求未解鎖或不存在的內容。新任務／請求／目標／成就／技能解鎖只改 `js/play/content.js` 的資料。
- 技能升級一定要有實際效果：系統用 `OC.Growth.has(c, 解鎖id)` 判斷；有 `unlock` 的活動要經 `OC.Growth.allowed()`。
- 特殊演出走 `OC.Stage.perform()`；**演出不改資料**（先用 Tx 等完成資料，再演），跳過／中斷不會遺失或重複獎勵。演出期間角色 `hold('stage')`。新動作同時加 `rigState` 分段姿勢與 `OC.Chars.ACTIONS` 備用鏈。
- 音效只用 `OC.Sound`（即時合成、原創）；不要加入其他遊戲的音效或音樂。
- **生活模擬只有一個時鐘**：所有需求、活動長度、冷卻用 `OC.Sim` 的遊戲分鐘（固定步長，app 迴圈餵現實秒數）；走路效果依距離。不要用 `setInterval`/幀數驅動生活邏輯，否則速度、fps、背景會改變結果。
- 離線／背景只走 `OC.Sim.catchUp()`（以 `life.lastReal` 為準、最多 8 小時、不觸發事件、不給獎勵、摘要回憶有 key）。
- 新活動：加到 `LifeData.ACTS`（效果每遊戲小時、動畫要有備用鏈）並讓某個可供性提供它的 verb；新物件／地點：在區域加 `spots` 或可互動物件，`Brain.rebuild()` 會產生位子。位子一定要經過 `Brain.reserve`。
- 事件每次播放都複製自己的步驟（`cur.steps`），選項只能改這份複本，不可改 `ev.steps`。
- 暫停 OC 用 `Brain.hold(id, reason)` / `unhold`，不要直接改 `brain.st`。每個 hold 都要有保證會執行的 unhold（關閉回呼、計時器）；app 的 `holdWatchdog` 會放開沒有擁有者的 drag/dialogue/menu，並限制 call/pet/play/feed 的最長時間——新的互動保留要加進去。事件只能經 `OC.Events`（一次一個、間隔、冷卻、once 鍵）；重大關係變化只能產生通知、玩家同意才套用。
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
- **懸浮桌寵與實機行為尚未驗證**（無模擬器）。在實機跑完 `docs/compat-test-plan.md` 前不可宣稱完成。
- **桌寵（第七階段）**：遊戲是唯一的生活模擬——原生只讀快照（`config.json`）、**絕不改需求**；桌面互動只經 `events.jsonl`（seq＋安裝 id）回到遊戲，由 `OC.PetSync.pull()` 在 `OC.Sim.catchUp()` 之後套用一次（物品走 `OC.Tx` key `pet:<事件 id>`、先存檔再 ack）。自動發生的事（桌寵碰面）不計入任務／成就。
- 桌寵視窗只能有寵物（或泡泡／選單）那麼大，**不得**加全螢幕透明層；觸控穿透必須 `FLAG_NOT_TOUCHABLE` 且不透明度 ≤ 0.8（Android 12 規定）；所有視窗 `FLAG_NOT_FOCUSABLE`。
- 前景服務類型只能是 `specialUse`（含 `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`）；不得改用其他類型規避限制；`START_NOT_STICKY`、不使用 wake lock、只從前景啟動。Android 15：先加 overlay 視窗再 `startForeground`。
- 權限只在玩家使用功能時請求（`OCNative.requestPermission`）；**不得**使用無障礙服務、`QUERY_ALL_PACKAGES`、讀取其他 App 內容；App 情境只用 `UsageStatsManager` 的套件名稱，且預設關閉。
- 桌面台詞內容只能由遊戲的對話引擎產生（`LifeData.LINES` 的 `desk_*` 等分類）；原生只決定時機。新增桌面動作：`PetBrain.ANIMS` ＋ `OC.PetSync.ANIMS` ＋ `OC.Chars.ACTIONS` 備用鏈 ＋ `rigState` 姿勢。
- 離線 aapt 不認得的新框架屬性：加到 `android/tools/framework-extras/`（需以 javap 確認真正的公開 id），值用資源參照。
- 金鑰：release keystore 只能經環境變數 `OC_RELEASE_*` 提供，絕不提交。
- 所有美術為原創；字體皆為開放授權（`game/fonts/LICENSES.md`），新增前先確認授權。

- **11.0 撫摸（`OC.Touch`）**：手指落在角色上＝角色的；連續撫摸以「撫摸秒數」`pend` 累積（每個事件最多算 0.2 秒、停手不給分），滿足度 `lv` 依手指速度（30–900 px/s 有效）、身體部位（耳／臉頰／肚子／尾巴／腳）、個體喜好（`c.life.touch.taste`：likes／dislikes／ticklish／shy）改變；**資料只在一次撫摸結束時改一次**（`petEffects`，好感冷卻 10 遊戲分鐘），中途只有姿勢、愛心、聲音、觸覺。拉走（沒有來回摩擦）＝抱起；撫摸變抱起時要先 `endStroke` 並清 `engaged`，否則放開會被吃掉（0.11 的教訓）。玩家設定的 `taste` 絕不被自動改寫。
- **11.0 動作庫**：新動作只在 `anim11.js` 用 `def()` 加資料（姿勢軌道＋備用鏈），同時要在 `OC.Chars.ACTIONS` 有備用鏈；測試 3 會對全部動作檢查不出現 NaN。動作切換在 `render.js` 以 0.2 秒柔和過渡；雙人互動的「靠向對方」只用 `a.nudge`（位移），不改座標。
- **11.0 AI**：`OC.Mind11.shape()` 只調整 Utility AI 的候選分數，不繞過 `Brain.reserve/hold`；計畫、目標、認知存在 `c.life.m11`，永久改變仍走 `Mind.suggest`。雙人互動種類登記在 `Social11.KINDS`，每種都要有雙方的動畫、資料變化、結束時全部 `unhold`（測試 5 逐一檢查）。
- **11.0 音訊**：角色說話一律經 `app.js` 的 `bubble()` → `OC.Sound.speak(c, text, {emo, pan, vol})`（想法氣泡不發聲）；聲線由角色 id／身高／能量／說話步調決定，心情只改速度、音高走向、響度、明暗。發聲體數量以**音訊時鐘的結束時間**計算（`hold()/nv()`），不用 `onended`（慢幀會讓計數卡住）。動作音效掛在 `World.setAction`（只在動作真的開始時發一次，被高優先權擋下的不發）；腳步在 `updateActor` 的步伐交界；聲音依螢幕位置左右定位，畫面外不發聲。音樂強度用 `Sound.setIntensity(i, holdMs)`，`holdMs` 會擋住 app 自己的心情更新。新聲音：只用 `tone()/noise()`，不得加外部音檔。
- **11.0 觸覺**：節奏用 `OC.UI.haptic('purr'|'heartbeat'|'giggle'|'melt')`（Android 上拆成連續的系統回饋常數，仍受系統觸覺設定控制；網頁版是單一 vibrate 圖案）。關閉觸覺設定＝完全不震動。
- **11.0 世界回饋**：點樹／灌木／花叢（`ctx.sway` 登記的物件）＝搖晃＋落葉（`World.shakeAt/shake`），不會讓 OC 走過去；粒子（葉、灰塵）只用兩個池化的 InstancedMesh（多 2 個 draw call），省電模式／減少動態時不產生粒子；點地面的波紋在點下去的當下就定位（不等下一幀）。
- **測試期間不得修改 `game/`**：測試頁面重載時會讀到半途改動的檔案，結果會被污染（0.11 的教訓）；軟體渲染約 2 fps，條件用「等到成立」而不是固定等待。

- **12.0 無 NPC**：沒有居民系統；所有社交、關係、請求都只涉及玩家自己建立／匯入的角色。存檔載入／匯入時刪除 `npcs`，不要再加回來。
- **12.0 操控模式**：每個角色一個 `c.life.control`（`manual`／`semi`（預設）／`auto`），只經 `OC.Brain.setControl(id, mode)` 改；`Brain.manualMode(b)` 為真時 AI 不挑活動、不被邀請（`Mind11.shape`、`Arcs` 的聚會也跳過）。新的互動保留要能在切換模式時被放開。測試 harness 預設把角色設成手動。
- **12.0 語氣**：新台詞只加到 `lines12.js`（資料，短、具體、不用波浪號與疊驚嘆號；`m:true`），由 `Talk.toneW` 依 `life.settings.tone`（`mature` 預設／`playful`）加權。（介面風格切換在 14.0 移除。）
- **12.0 OC.Arcs**：所有邏輯跑在 `Sim.onStep`（遊戲分鐘）；聚會的保留用 `'group'`，結束／被打斷／超時／看門狗（`MAX_AGE.group`）都要放開所有人；冷戰只影響 AI 分數與邀請回應，**不自動改關係類型**；玩家固定（`fixed`）的關係與 `lockRel` 不被捲入；沒有獎勵、不送進度事件。`Mind.relPair` 是唯一改關係的入口。
- **12.0 過場短句**：只用 `OC.Sound.cue(名稱)`（`Sound.CUES` 一張表、3 秒冷卻、離線補算與音效關閉時不響）；新事件加進表，不要直接呼叫 `stinger`。
- **12.0 桌寵聲音**：遊戲只負責「做出這個角色自己的 14 個 WAV」（`OC.PetSound.CLIPS` 必須和 `core/pet/PetSound.kt` 的 `CLIPS` 完全一致，pet 測試 16a 會讀 Kotlin 檔比對）；播哪一個、何時播由 `PetSound`（純 Kotlin、單元測試）決定；預設關閉；原生只用 `SoundPool`，靜音／通話／螢幕關閉不出聲；不得加外部音檔。
- **12.0 雙人桌面動作**：新的種類加在 `PetSocial.KINDS`（每個動畫必須在 `PetBrain.ANIMS` 與 `OC.PetSync.ANIMS`，台詞分類在 `LINE_CATS`）；兩隻都在地板上才開始、被抓起／跳起就取消；效果只經遊戲的 `meet` 處理（每對每天一次、不計入任務）。
- **12.0 3D**：放在地面的東西經 `OC.Areas._h.place`（自動接觸陰影，一個地點一個 InstancedMesh；不要讓房間外殼有接觸陰影：`userData.noContact`）；純視覺的布置寫在 `OC.Dress`（不得蓋住可走區域，角落物件要 `ctx.block`）；重新建模的家具在 `models12.js`，**同 id、同占地**，大量小件要合併（`boxes()`）；雲影只在室外。

- **13.0 跟隨**：操控中的角色（`b.manual`）在非手動模式可以自己換地點，但只經 `hooks.canLead()`（`App.canLead`：只有單純看著世界時）與 `hooks.lead()`（`WorldUI.travel`）；新的全螢幕互動（面板、小遊戲、演出）要加進 `canLead` 的條件。
- **13.0 圖片角色**：取景存在 `c.appearance.frame`（flip／zoom／dx／dy／crop／faces），只在 `CharRender.draw` 套用，**不得改寫原圖或另存加工後的圖**；`OC.Puppet.active()` 決定是否由圖片表演（玩家畫了該動作就不套）；新動作不需要為圖片另外寫——沿用 `rigState` 的身體動態，必要時在 `puppet13.js` 的 `MOVES`／`OWN` 補資料。快取 key 要包含會改變畫面的時間量化。
- **13.0 特質**：新特質只加在 `traits13.js` 的資料表（`fx.need／act／soc／emo／speed／accept` 至少一項＋台詞），鍵必須是存在的需求／活動／社交／情緒 id（v13 測試 3a 會檢查）；衝突寫一邊即可（會自動補成雙向）。
- **13.0 OC.Fun**：小遊戲與來訪的保留用 `'game'`（`MAX_AGE.game`），每條離開路徑都要 `end()`／`leave()`；獎勵 key 固定為 `fun:<遊戲>:<oc>:<日>`、`visitgift:<oc>:<日>`、`shake:<地點>:<座標>:<日>`（結果由 key 的雜湊決定，不能靠重試改變）；台詞放 `LINES`，自訂變數經 `extra.vars`。行內註解一律用 `/* */`，不要在一行多敘述的程式後面用 `//`（已三次吃掉後半行）。
- **13.0 桌寵作息**：新的連續動作只加在 `PetRoutine.ROUTINES`（動畫必須在 `PetBrain.ANIMS`）；導演只在寵物空閒時下指令，不改需求。

## 環境限制（實測）
- 無法連線 `dl.google.com` / Google Maven → 無法用 AGP / 下載 Android SDK；改用離線管線（`docs/android-build.md`）。
- Maven Central 偶爾 429；`--max-workers=1` 重試。GitHub raw 被封鎖；字體由 Google Fonts 取得。
- 沒有 Android 模擬器或實機：只能驗證到「APK 建置、簽章、內容正確」與「遊戲在 Chromium 手機模擬中正常」。

- **14.0 靜態模型合併**：沒有東西會在裡面動的模型（房屋、攤位、長椅、柵欄、燈柱、橋）在建好後 `return fuse(g)`（依材質＋陰影旗標合併成少數幾個 mesh）；會單獨動或單獨顯示的子物件要標 `userData.keep`（例如果實），有貼圖（`material.map`）的不合併（合併只保留位置與法線）。花是每朵各自 `fuse`（仍然一朵一朵搖）。新增大量同材質的小零件時，放進一個 Group 再 `Mo.fuse()`（例如露台欄杆）。v14 測試 5 會檢查零件數、繪製呼叫 ≤ 330、夜間窗戶材質仍接在房子上。
- **14.0 桌寵架構**：一隻桌寵「決定做什麼」的邏輯只寫在 `core/pet/PetActor.kt`（輸入：指標樣本、每幀 tick、選單 key；輸出：`Out` 指令），並補單元測試；`overlay/PetWindow.kt` 只把設定 JSON 轉成 actor 的屬性、執行 `Out`（泡泡、音效、觸覺、事件、選單、收起、開啟遊戲），**不得**在視窗層再寫行為判斷。選單項目加在 `PetActor.mainMenu()`／`menu(key)`。原生泡泡與選單的顏色在 `PetTheme.of()`，要和 tokens 的白天／夜晚一致。
- **14.0 圖片裁切框**（`charedit.js` 的 `cropBox`）：只改 `c.appearance.frame`（草稿），四邊上限 45%；拖曳中 `x.changed('look', null)`、放開才記入復原紀錄。
- **14.1 效能規則**：(1) 亮度 0 的光仍然要算——不用的光設 `visible = false`（路燈：`lampsLit`，白天關）；改變「看得見的光的數量」會換著色器，所以兩種狀態都在 `loadArea` 結尾用 `R.compile` 先編好。(2) `R.debug.checkShaderErrors = false`，不要打開。(3) 陰影貼圖只有 `quality.soft`（「高」）每幀更新＋柔邊，其餘每兩幀＋硬邊。(4) 主迴圈裡每幀執行的東西不得無條件寫 DOM 或組長字串：先比對再寫（HUD 每 200 ms、泡泡位置變了才寫）。(5) 「平衡」的自動降解析度在 `app.js` 的 `adaptStep`（只降不升、最多兩級、自動化執行時關閉）；新的效能模式欄位要同時在 `perfOf` 與這裡處理。v14 測試 7 檢查這些。
- **14.1 桌寵**：多隻一起做的事（幀率節流、雙人動作、測試雙人、App 情境、提醒播報）只寫在 `core/pet/PetStage.kt` 並補單元測試；`OverlayPetService` 只呼叫 `stage.frameCap/step/appContext/announce/testPair` 並把回傳的 `Cmd` 交給對應的 `PetWindow.carry()`。
- **14.2 效能規則**：(1) 會被上傳成 WebGL 貼圖的 2D 畫布，第一次 `getContext('2d')` 就要帶 `{ willReadFrequently: true }`（CPU 畫布；GPU 畫布上傳時要讀回，手機上很慢）。(2) `paintActor` 一幀最多兩次（`paintsLeft`），操控中的角色與正在被摸的不受限。(3) 會各自擺動的小東西不要每個一組網格——同一叢合成一個再擺（花圃：`flowerBed` 的 `cluster`）；v14 測試 5 要求整個小島 ≤ 200 個繪製呼叫。(4) 不要對 WebView 設 `setLayerType`。(5) `World.perfStats()` 的可重設計數器只給 FPS 讀數用，測試用 `totalPaints／totalFrames`。(6) `adaptStep` 有三級，第三級關陰影、草、點光源。

- **15.0 點選 ≠ 執行**：世界裡的東西被點一下時，`onTap` 只呼叫 `describe(it)` 取得名稱與動作，交給 `OC.Pick.show()` 顯示動作卡；**不得**再讓單點直接走過去執行（設定 `quickTap` 開啟時例外）。新的可互動物件類型要在 `describe()` 加一筆（名稱、說明、動詞、`run`）。任何新出現在手指下的選單（卡片、環、選項、表單）都要 `OC.Pick.guard(el)`，按鈕處理要先檢查 `OC.Pick.armed(el)`。舊的測試套件經 harness 預設 `quickTap: true`；新預設由 v15 測試（真實觸控）。
- **15.0 動作清單**：玩家安排的活動一律 `OC.Queue.add(id, act)`（不要直接 `Brain.command`，否則會跳過清單）；清單存在 `c.life.q15`，最多 4 個等候；交給引擎只在 `Sim.onStep` 且角色沒有被保留、沒有玩家安排的事時。
- **15.0 拍照**：照片一律 `OC.Assets.put`（kind `photo`），`S().photos` 只放 id／時間／地點／濾鏡／相框；拍照模式是唯一允許在 `#world` 上用 CSS `filter` 的地方（只在模式開著時，`close()` 一定要清掉）。
- **15.1 牆壁與地板**：可佈置的室內地點（`interior({ decor: true })`）讀 `S().surfaces[id] = { wall, stripe, floor, tile }` 覆蓋原本的顏色；只是外觀，不經 `OC.Tx`、不是物品；改了之後用 `loadArea(id, 目前位置)` 在淡出淡入中重建（不重建 renderer）。房間材質的 `userData.key` 標出是哪一張紋理（測試用）。
- **15.1 試衣間**：預覽服裝一律畫在角色的**淺拷貝**上（`Object.assign({}, c, { look: … })`），絕不改 `save.chars`；真正穿上仍走 `OC.Use` 的 `wear`。
- **15.0 防誤觸的範圍**：`OC.Pick.guard` 只擋選單**裡面的按鈕**；選單外面的新手指一律立刻關閉選單（不要再加 armed 檢查）。
- **15.2 新地點**：風車丘、彩虹遊樂園和其他地點一樣登記在 `OC.Places.P`、場景在 `OC.Areas`（`areas15.js`）。會自己動的部分（風車葉片、旋轉木馬的轉盤與木馬、摩天輪與車廂、氣球）各自是一個已合併的群組；其餘 `fuse()`。新的設施類型（`ride`／`wheel`／`stage`／`toss`）在 `describe()`、`WorldUI.tap`、`Brain.rebuild` 各有一筆。摩天輪搭乘中 `OC.Mini.wheelRiding()` 為真：`travel()` 會拒絕、`canLead` 為假。
- **15.2 遊樂園小遊戲**（`OC.Mini.concert／toss／wheel`）：真實輸入；演唱會在按下的瞬間用 `performance.now()` 判定（不用上一幀的時間）；演出費 key `concert:<角色>:<日>`；套圈圈先付 `TOSS_COST`、獎品 key `toss:<付款 key>`。
- **15.2 只有玩家安排才做的活動**：`ACTS.x.cmdOnly = true`（例如 `work` 打工）——`Brain.candidates` 只在 `b.queued === act` 時提供，離線抽象生活不會選。打工工資只在 `Progress` 的 `act` 事件（`min >= 20`）時入帳，key `job:<角色>:<地點>:<日>`。
- **15.2 島報**只能寫真的資料（回憶、帳本、天氣、特價、生日、評價）；房間評分的等級獎勵由玩家在島報領取（key `room:<地點>:<級>`）；生日蛋糕 key `bday:<角色>:<年>`；小島評價只讀資料，**不得**呼叫 `Mind.rel()`（會建立新的關係紀錄）。
- **15.3 季節**：`OC.Clock.season()`（`settings.season` 或日期；`?season=` 可預覽）只在 `World.init` 讀一次，色調寫進 `tonemapping_fragment`（`#ifndef OC_CHAR`）；**不要在遊戲中途改 ShaderChunk**（內建材質的程式快取不會跟著換）。看板角色的材質一定要有 `defines.OC_CHAR`。飄落物與海面閃光在 `OC.Ambient`（各一個 InstancedMesh，特效關閉／室內／減少動態時不顯示）。
- **15.3 轉場**：`WorldUI.travel` 的雲朵只在轉場期間存在（不是常駐元素），結束時移除；減少動態時用原本的淡出淡入。夜晚會亮的材質一律放進 `OC.Models.night.windows`（每次載入地點都會清空，要在建場景時重新加入）。
