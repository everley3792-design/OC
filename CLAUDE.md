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
- **M0（0.1.0-reboot）地基——完成**（`docs/reboot/m0-report.md`）。
- **M1（0.2.0-reboot）存檔與家——完成**（`docs/reboot/m1-report.md`）：
  - `core:sim`：房型（3 種、房客規則）、家具、需求、心情小卡、效用 AI（附理由）、作息、30 種小動作、格子尋路、觸碰（摸／抱／丟／餵）、搬家日、補算（確定性、最多 30 天）；
  - `core:save`：`createWorld`、M0 世界升級、單張圖匯入角色、`.ocsave` 匯出匯入、旗標；
  - `ui`：開場四步、家的 2.5D 場景（`HouseView`）、程序姿勢動畫（`Actors`）、人物卡、你不在的時候、時間切換；
  - `app`：系統檔案選擇器（選圖／匯出／匯入）、合成音效、兩指縮放、降幀。
- **M2（0.3.0-reboot）角色創建與匯入——完成**（`docs/reboot/m2-report.md`）：
  - `core:sim/chars`：`CharSpec`（外觀以外的全部設定）、`Catalog`（120 標籤／32 特質／15 怪癖／8 價值觀，每個都是效果組合）、`Speech`（說話方式、情境預覽）、`Builder`（範本、問答、隨機、規則、相容性提醒）、`Rel`／`Relations`（雙向關係與規則）；
  - `LifeSim`：設定接進生活（作息、技能、親近度 A-13、摸部位 E-01、口味、生日、秘密、兩人聊天、20 種專屬活動）；
  - `core:save/media`：匯入管線（單張、序列、Sprite Sheet、JSON 圖集、GIF、APNG、動態 WebP、`.ocpkg`、去背、取景）；存檔格式 v2；
  - `ui`：角色創建（9 分頁）、匯入工作室、收藏庫、關係圖、動畫播放（`Look`）。
- **M3（0.4.0-reboot）桌寵——完成**（`docs/reboot/m3-report.md`；手機上的部分全部待實機驗證）：
  - `core:sim/desk`：`DeskPet`（走跑坐睡、爬牆、倒吊、探頭、掉落、拋擲反彈、討食、充電、低電量、夜深、提醒、全螢幕躲起來）、`DeskGestures`；
  - `LifeSim`：桌上的人（`desk`、`toDesk/fromDesk/deskLift/deskLand/deskRest/deskSay`）；存檔格式 v3；
  - `ui`：`WorldHost`（App 與服務共用一個模擬）、`DeskStage`、`DeskMenuScreen`、`DeskSheet`、`DeskPermissionSheet`；
  - `app`：`DeskService`（specialUse、小懸浮窗、通知、電量／螢幕、穿透模式）、`OcRuntime`、`tools/framework-extras`。
- **M4（0.5.0-reboot）自主生活與社交——完成**（`docs/reboot/m4-report.md`；節奏與手感待實機驗證）：
  - `core:sim/social`：`SocialActs`（44 種社交行為＋反應光譜）、`Will`（意願）、`Topics`（概念與碰撞句型）、`Scenes`（化學反應 30、衝突火花 15、日常事件 20、連續劇）、`Games`（猜拳、躲貓貓）、`Narrate`、`State`（記憶帳本、配對統計、冷戰、煩惱、心願、請求、信箱、一天結束卡、共用的鍋）；
  - `life/Society`：社交與事件的整合（選行為、演場景、後果、每日結算與風味標籤、煩惱與打擾預算、建議／操控、和你聊天、小遊戲、做飯與家務、情境判斷）；存檔格式 v4；
  - `ui`：觀察模式（自動鏡頭、人物條、30×／60×、快轉）、煩惱泡泡與處理、大頭特寫、誇張特效、人物卡新增、`SocialUi`（WorrySheet／RpsSheet／TalkSheet／SuggestSheet／DayCardSheet／MemorySheet／TimelineScreen）。
- **M5（0.6.0-reboot）創作套件——完成**（`docs/reboot/m5-report.md`；畫畫手感、筆壓、聲音播放待實機驗證）：
  - `core:save/paint`：`PaintDoc`（圖層、8 種筆刷、筆壓、防手震、對稱、選取變形、填色、漸層、滴管、色票、復原 100 步、範本、無縫拼接）、`Draft`（無損草稿）；
  - `core:save/Studio`：草稿、手繪角色與表情、動畫（停留時間、循環／一次／來回、腳底、影格事件、鏡像、複製、批次匯入、狀態機）、自訂物品＋`.ocitem`、聲音匯入、標籤、劇本＋`.ocmod`、`syncWorld`、空間使用；`Items`、`Sounds`；
  - `core:sim`：`script/Script`（劇本：積木資料、文字格式互轉、驗證）、`chars/CustomTag`、`Life.items/decor/tags/scripts/music`；`Society` 演出劇本（含先問你）；存檔格式 v5；
  - `render`：`Gfx.imageMesh`（網格變形）、`Assets.pixels`；`ui`：`PaintUi`、`AnimStudio`、`ItemEditor`、`ScriptUi`、`CreateUi`（創作中心、各列表頁、標籤編輯、空間使用）、`DecorSheet`、`Warp`。
- **M6（1.0.0-beta）小鎮、佈置、工坊＝MVP 測試版——完成**（`docs/reboot/m6-report.md`，含實機測試清單；全部待實機驗證）：
  - `core:sim/town`：`Weather`（天氣、季節、彩虹）、`Goods`（商店與換貨）、`Town`（5 個地點、13 種活動、25 個小鎮事件）、`TownState`、`Tx`、`Job`、`Outing`、`Goal`、`PieceRec`；
  - `life/Economy`（星幣、背包、帳本，`consistent()`）、`life/TownLife`（出門、小鎮事件、天氣事件、每日小目標、新聞、商店、攤位、公共角落、工坊、環境分數、房間請求）、`life/Decorate`（擺放、檢查、復原、搬家）；
  - `house`：庭院平房、共居宿舍、家族大宅；家具 `actsAs`、自訂家具註冊；存檔格式 v6；
  - `ui`：`TownUi`（`Wx` 天氣畫面、`TownScreen`、`MoveSheet`、`BoardSheet`、`LedgerPage`、`Placing`、錢包）、`WorldScreen` 佈置模式、`HouseView` 新家具與房間；
  - `app`：`Sounds.bgm`（依時段的原創合成音樂）。
- **M7 第一批（1.0.0-beta.2）——完成**（`docs/reboot/m7-1-report.md`；全部待實機驗證）：
  - 補完 M6：小鎮的全身住民、咖啡館請客、房間分數與個性、系列加成、牆上貼紙、翻面、作品集與評語、季節的聲音；
  - 1.0 第一批 19 項：`life/Journal`（次數、日記 A-12、夢 A-06、稱號 A-15、成就 I-08、圖鑑 I-07、統計 K-07、本週之星 Q-13、植物 G-09、菜園 G-10、房間個性 P-10、佈置反應 G-05）、採集 I-04、市集日 H-03、節日 H-04、無障礙 O-04（大字、減少動態、震動）、休息提醒 O-05；存檔格式 v7；
  - `ui`：`JournalUi`（JournalHub、DiaryPage、TitlesPage、AchievementsPage、BookPage、StatsPage、PortfolioPage、A11ySheet）。
- **第十四節：全面重構與品質升級計畫——已確認**（`docs/reboot/overhaul-plan.md`）：
  - D1 不捏臉，外觀＝匯入／畫／預設＋配件表情貼紙層；
  - D2 玩家給的截圖是《角色觀察屋》，參考其系統與功能，畫面文字仍原創；
  - D3 底部 5 入口（家、小鎮、住民、收納、紀錄）；
  - D4 手動改時間天氣季節＝存檔紀錄；
  - 排程 R1～R8，M7 第二批的 55 項併入 R7。
- **R1（1.1.0）地基修復——完成**（`docs/reboot/r1-report.md`）：
  - 生活節奏：一次一鍋、活動時段、12 種日常小事、會膩、個人作息；
  - 時間：T1 世界等手機、T3 遊戲日期、T4 超過 30 天跳過並說明；
  - 回憶：擬聲＋旁白＋多久、`MemoryScreen` 回放 1～1024×、名場面；
  - 底單可捲動；存檔格式 v8。
- **R2（1.2.0）導覽與彈窗——完成**（`docs/reboot/r2-report.md`）：
  - 底部 5 入口 `Nav`（家、小鎮、住民、收納、紀錄）；家的上方只剩時間／天氣膠囊；
  - 環境面板 `EnvSheet`＋`life/Env`：暫停、撥時刻、選天氣含特殊天象、鎖季節，全部記在 `Life.env`；
  - 收納 `StoragePage`＋`ItemArt`＋`ItemSheet`；住民 `ResidentsPage`；
  - 畫面轉場；存檔格式 v9。
- **R3（1.3.0）環狀選單與操控——完成**（`docs/reboot/r3-report.md`）：
  - `core:sim/act/Interactions`：互動登錄表（138 種：社交 44、活動 52、你能做的 42），`forPerson/forPiece/forFloor/forSky` 回傳可不可以做與原因；
  - 指定的指令：`act:<id>@<家具>`、`act:<id>@t<x>,<y>`（`LifeSim.candidateAt/candidateOn/anyWay/pieceProblem`）；
  - 指令佇列 `Person.queue`（`Society.pending/cancelOrder/stopNow/orderLabel`，最多 5 件）；存檔格式 v10；
  - `ui`：`PieMenu`（環狀選單，最多 8 格、分組、更多、灰色附原因）、`WorldScreen` 觀看／操控、選取光圈、佇列列、拖曳擺放；`PersonCard` 三頁（現在／關係／紀錄）。
- **R4（1.4.0）創角與說話——完成**（`docs/reboot/r4-report.md`）：
  - `chars/Spec`：`Address`（叫你三段 `callFor`、叫別人 `others`＋態度、心情換風格 `moods`、口頭禪位置與頻率）、`Habit`（自訂事件）；`Catalog.groupOf/opposites/LIKE_GROUPS`；`Builder.cycleLike`（三態）；
  - `Speech.say(…, to, mood)`：自稱 → 稱謂 → 禁用詞 → 態度 → 風格 → 語尾 → 口頭禪；`Society.nickBy/callTo/autoNick`；`LifeSim.moodOf`、自訂事件；存檔格式 v11；
  - `ui`：`CharacterEditor` 7 步（即時反應、試聽、四色互斥、三態、稱謂、自訂事件）；`TitleScreen` 編輯世界／編輯角色（`WorldHost.edit`、`SaveSystem.backupNow`）。
- **R5（1.5.0）美術與細節——完成**（`docs/reboot/r5-report.md`；效能待實機驗證）：
  - `LifeSim.stateOf/pieceKey`（8 種家具的狀態）、`Life.things`（會留下來的狀態）、`Life.litter`（地上的東西，整理房間收掉）；存檔格式 v12；
  - `HouseView`：物件狀態的畫法、四層光（天色、窗光、燈光、夜色）、木紋布紋、時鐘、窗簾、雨痕、地上的東西；`WorldScreen`：雲、遠山、四季的樹、路燈、水窪、季節落物；`Actors`：翻頁、熱氣；
  - 沒做：家具點陣圖快取、小鎮 2.5D 場景、新圖示（移到 R7）。
- **1.5.1 R1～R5 補完——完成**（`docs/reboot/r5-1-report.md`；全部待實機驗證）：
  - 生活：6 種新活動、`Flavor.forLine`（每行回憶都有擬聲／旁白）、口頭禪傳染（`Person.borrowed`）、`youSet/youPickUp`、`zoneShift`（時區）、`Decorate.addResident/removeResident`；存檔格式 v13；
  - 畫面：小鎮 2.5D 場景（平移縮放）、`PieceCache`（`Gfx.offscreen/pxPerDp`，64 MB）、吐司在上方、拖曳給東西、數字滾動與飛進收納、佇列排序、拖滑桿、配件 `Sticker`、職業時代、30 個圖示、開始畫面搬家與搬進搬出；UI 測試 30 個情境。
- **R6（1.6.0）桌寵重構——完成**（`docs/reboot/r6-report.md`；全部待實機驗證）：
  - `core:sim/desk/DeskData`：`Lv`（5 反射／4 照顧／3 回應你／2 自己的事／1 閒晃）、`DeskActs`（動作表：樣子、時間、誰能打斷、`via` 先做、`next` 能接什麼、`hop` 找路）、`DeskIntents`、`DeskProps`、`DeskTogethers`、`DeskPersona`（`Catalog` 的 `desk:*` 效果）；
  - `DeskPet`：驅動 → 意圖（高優先級才打斷）→ 動作（只沿轉移表）；F-04 `follow`、F-05／F-06 桌面東西與窩、F-07 `invited/declined`、F-08 陪伴（`DeskContext.focus`）；100 小時測試；
  - `LifeSim.deskPut/deskTake/deskUse/deskTogether/deskFocus`、`Life.deskProps`；存檔格式 v14；
  - `ui`：`DeskStage`（性格、其他桌寵、東西視窗、手指追、專心計時）、新選單；`app`：`DeskService` 東西的小視窗。
- **R7 第一批（1.7.0）角色與社交——完成**（`docs/reboot/r7-1-report.md`；全部待實機驗證）：
  - R6 補完：桌面小東西經背包（雜貨店 `Goods.DESK`）、追手指可關、專心計時存在設定並在通知倒數、一起時互相靠、自訂事件上桌面；
  - `life/Drama`＋`social/DramaData`：夢想 A-08、怕的東西 A-11、長大一歲 A-14、生病 B-09、熱潮 B-13、突發奇想 D-02、誤會劇場 D-03、辯論 D-04、即興歌 D-05、如果問答 D-08、主題旋律 N-04、八卦 C-05、綽號 C-07、共同秘密 C-08、小圈圈 C-09、團體活動 C-10、比賽 C-13、戀愛演出 C-14、料理對決 Q-08、停電夜 Q-09、驚喜派對 Q-14；
  - 你的決定（`Decision`：辯論、長大、告白）＋「有 N 件事等你決定」；`Platform.melody`；存檔格式 v15。
- **R7 第二批（1.8.0）和你——完成**（`docs/reboot/r7-2-report.md`；全部待實機驗證）：
  - `life/WithYou`＋`social/YouData`：訊息 E-07、照片 E-09（存內容不存像素）、接點心 L-03、翻牌 L-04（`CatchGame`／`FlipGame` 純 Kotlin）、觀察筆記 P-03、時光膠囊 P-04、情境開局 P-05（`Scenarios`）、家規 P-11（`appealK`）、換房間 P-13（`Decision` kind "room"）；`CharSpec.lines`（M-04 自己的台詞）；
  - `SaveSystem.saveGrown`（P-14）、`Studio.exportPack/importPackParts`（P-15，`.ocmod` v2）；存檔格式 v16；
  - `Gfx.offscreenPixels`（畫面外繪製並讀回像素：照片濾鏡、PNG 匯出）；`ui/YouUi`（YouHub、MessagesPage、PhotoStudio、AlbumPage、CatchScreen、FlipScreen、CardsPage、NameCardSheet、CapsulePage、RulesPage、NotesPage）、`CreateUi.PackPage`、開場情境、創角自己的台詞。
- **R7 第三批（1.9.0）家與小鎮——完成**（`docs/reboot/r7-3-report.md`；全部待實機驗證）：
  - `life/Days`＋`social/DaysData`：食譜 I-03（`Recipes`、`Dish.recipe`、`Society.cooked` 用材料）、紀念日與約會 J-04、小鎮動態 Q-01、神明的小道具 Q-02、一日小旅行 Q-03（`Outing.stage == "trip"`）、收藏櫃 Q-11、回憶相框 G-08（家具 `frame`、活動 `framelook`）、住民挪家具 G-05、桌面日記 F-12；夜晚的小鎮 H-07（`TownAct.night`）；存檔格式 v17；
  - `ui/DaysUi`（RecipesPage、FeedPage、TripPage、toolsSheet、CabinetSheet、WidgetLines）、廣場照片板 Q-13、色弱配色 O-04（`Theme.colorSafe`、旗標 `a11y:cb`）；
  - `app/OcWidget`：主畫面小工具 F-13（只顯示看到的，不在背景跑世界）。
- **R8 第一步（2.0.0-rc.1）正式版候選——完成**（`docs/reboot/r8-report.md`）：
  - 效能分級 O-02：`ui/Perf`（`Tier` 省電／標準／高畫質；`Platform.deviceClass()` 選起始等級；只在真的手機上依每幀時間自動升降；收藏庫旗標 `perf:low/mid/high`＝自己選）；影響雨雪粒子（`Wx.amount`）、雲、`PieceCache.maxBytes`、幀數上限；
  - 戀愛線補完：`Drama` 的 `breakup`／`reunion` 決定（只在戀愛打開且兩人成年，你同意才改變）；
  - `assembleRelease` 沒有金鑰時清楚停止；實機測試清單 `docs/reboot/device-checklist.md`（49 項）。
- **第十五節：擴充計畫（整合版 50 項）**（`docs/reboot/expansion-plan.md`，8 個階段 2.1.0～2.8.0）：
  - 未成年只有友情劇情（不做暗戀、初戀、牽手）；3D＝在 `Gfx` 上自己做投影，角色維持 2D；店員沒有生活模擬。
- **擴充第一階段（2.1.0）——完成**（`docs/reboot/p1-report.md`）：
  - `social/Content`（`ContentEvent`／`When`／`Who`／`RelWhen`、`Content.ok` 不擲骰子、`Content.problems` 驗證器）、`social/DailyContent`（23 個日常事件的 JSON）；格式說明 `docs/reboot/content-format.md`；
  - 長文字換行（`Widgets.wrap` 避頭、`toastStay`、`ListSheet` 可變列高）；移除玩家啟動的四個小遊戲；`Society.topicsFor`；
  - `SettingsPage`、`SoundSheet`（`Platform.volumes`）、`ui:theme`；存檔格式不變（v17）。
- 下一步：擴充第二階段（2.2.0）角色模擬核心；正式 2.0.0 仍等實機回報與金鑰。

## 目錄
```
settings.gradle.kts  build.gradle.kts  gradle.properties（版本號 oc.versionName／oc.versionCode）  gradle/libs.versions.toml
core/sim/      純 Kotlin：act/（Interactions＝互動登錄表）；script/（Script＝玩家劇本）；social/（SocialActs＝社交行為、Will＝意願與反應、Topics＝話題碰撞、Scenes＝化學反應／火花／事件、Games＝猜拳躲貓貓、Narrate＝敘事描寫、State＝社交存檔資料）；desk/（DeskData＝動作表／意圖／東西／性格、DeskPet＝三層行為與物理、DeskGestures＝手勢）；Rng（SplitMix64，唯一的亂數）、GameClock；house/（Furniture、HouseTypes＝房型與房客規則）；life/（Drama＝夢想怕的東西生病熱潮八卦綽號秘密小圈圈團體活動比賽戀愛與你的決定、Data＝需求／活動／心情小卡／小動作／台詞、Flavor＝回憶的擬聲與旁白、Env＝你對天氣季節時間的調整、State＝存檔資料 Life／Person、Grid＝尋路、LifeSim＝生活本體、Society＝社交與事件、Economy＝星幣背包帳本、TownLife＝小鎮與每日、Decorate＝佈置與搬家、Journal＝次數日記夢稱號成就圖鑑統計植物、WithYou＝和你、Days＝家與小鎮）；town/（Town＝天氣季節、商店、地點、小鎮事件、小鎮存檔資料）；
               chars/（Spec＝CharSpec／Address 稱謂／Habit 自訂事件／Voice／Rel／Relations、Catalog＝標籤特質怪癖價值觀的效果、Speech＝說話方式與情境預覽、Builder＝範本問答隨機規則）
core/save/     純 Kotlin：paint/（Paint＝繪圖引擎、Draft＝草稿）、Studio（創作套件的收藏庫端：動畫、物品、聲音、標籤、劇本、.ocitem／.ocmod、空間）；Storage（FileStorage 原子寫入＋.bak、MemStorage）、SaveSystem（收藏庫、存檔、備份、複製、分支）、Model（LibChar、SlotMeta、World）、Migrate、Presets（肉桂捲）、ImageCheck（透明背景、腳的位置）；.ocsave 匯出匯入；
               media/（Raster＝像素／縮放／PNG 編碼／去背／檔頭、Formats＝GIF／APNG／WebP／格子、Importer＝格式判斷、限制、序列、圖集、.ocpkg、動作與備用鏈、prepare）
render/api/    Gfx 介面（dp 為單位、ARGB 顏色）、Img、Assets、Colors
render/jvm/    Java2D 後端（只給測試：把畫面畫成 PNG；不進 APK）
ui/            純 Kotlin 的整個介面：WorldHost（共用的世界）、Desk（DeskStage／DeskMenuScreen／DeskSheet／DeskPermissionSheet）、Theme（tokens）、Dim、Spring、UiApp（畫面堆疊、點擊區、覆蓋層、返回鍵）、Widgets、TitleScreen、Opening（開場四步、ImportSheet、Scroller）、HouseView（房子的 2.5D 繪製）、Actors（姿勢動畫）、WorldScreen（家、觸控、AwaySheet）、PersonCard、Form（設定表單）、CharacterEditor（角色創建＋TagSheet／QuizSheet／DiceSheet／MarksSheet）、ImportStudio、Library（收藏庫、RelationsScreen、PairSheet）、PaintUi（繪圖工坊、ColorSheet、LayerSheet）、AnimStudio、ItemEditor、ScriptUi（ScriptsPage、ScriptEditor）、CreateUi（Page、CreateHub、DraftsPage、ItemsPage、SoundsPage、TagsPage、TagEditor、SpacePage）、SocialUi（Fx 特效、Portrait 特寫、WorrySheet、RpsSheet、TalkSheet、SuggestSheet、DayCardSheet、MemorySheet、TimelineScreen）、TownUi（Wx、TownScreen、MoveSheet、BoardSheet、LedgerPage、Placing）、JournalUi（JournalHub、各紀錄頁、A11ySheet）、YouUi（和你：訊息、拍照、相簿、小遊戲、角色卡、膠囊、家規、筆記）、DaysUi（食譜、動態牆、旅行、小道具、收藏櫃、小工具文字）、Perf（效能分級）、ListSheet、Confirm
               PieUi（PieMenu 環狀選單）、MemoryUi（MemoryScreen：回憶回放與收藏）、NavUi（Nav 底部導覽、EnvSheet 環境面板、ItemArt 物品圖、StoragePage／ItemSheet 收納、ResidentsPage 住民）
               src/test：UiTest（用點擊區模擬手指＋截圖比對 resources/golden）
app/           Android 外殼：OcRuntime（共用存檔／圖片／世界）、DeskService（桌寵前景服務與懸浮窗）、OcWidget（主畫面小工具）、tools/framework-extras（離線 aapt 的新屬性）、MainActivity（全螢幕單一 GameView、insets、深色模式、返回鍵、輸入框）、AndroidGfx（Canvas 後端）、AndroidAssets、Sounds（合成音效）；選圖／匯出／匯入用系統檔案選擇器；build.gradle.kts＝離線管線
art/           原創美術與字型（fonts/*.ttf、chars/cinnamon/original.png 與 idle.png）
docs/reboot/   計畫書、各里程碑報告、肉桂捲原圖
deliverables/  apk/（Debug APK＋sha256）、m0/～m7/、r1/～r6/、r5-1/、r7-1/、r7-2/、r7-3/、r8/、p1/（截圖）
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
- 生活畫面只看不改：觸碰經 `LifeSim` 的 `pet/petEnd/lift/hold/drop/feed`；畫面效果（泡泡、愛心、聲音）來自 `sim.events`。畫面自己的裝飾亂數不得影響模擬。
- **角色的個性只經過 `CharSpec` 與 `Catalog`**：新的標籤、特質、怪癖就是新的一筆 `Effect` 資料；不要在 `LifeSim` 寫「如果名字是…」。新設定欄位要在 `SpecEffectsTest` 補一項「看得到的效果」。
- **事件是資料**（2.1.0）：新的事件寫成 `ContentEvent`（JSON），條件只用欄位，必須通過 `Content.problems`；戀愛分類只在兩位成年角色且戀愛打開時成立（`Content.ok`）。介面文字一律用 `Widgets.wrap` 換行並讓高度跟著長，不要切成「…」。
- **社交只經 `Society`**：新的社交行為、事件、化學反應、衝突火花都是 `core:sim/social` 裡的一筆資料（`Scenes` 的腳本 `A:句子@POSE#特效 / B:…`）；關係的每一次改變都經 `Society.relUpdate`（內部再過 `Relations.problem`），不得直接改 `life.rels`。需要玩家回應的事（煩惱、請求）一律經打擾預算，一次只顯示一個泡泡。
- 場景只由開始的人推進（`Society.play`）；另一方只聽。場景不存檔，後果在場景結束時一次套用；補算時直接套用、不演。
- **錢和東西只經 `Economy`**（`earn/buy/spend/move/sale`）：每一次都是帳本的一行；不得直接改 `life.wallet`／`life.bag`。測試用 `consistent()` 檢查錢包＝帳本總和、背包＝帳本件數。
- **家具擺放只經 `Decorate`**：先 `problem()` 檢查（房間、門口、重疊、走得到、床夠不夠），再寫 `life.layout` 並 `relayout()`；固定的東西（窗、浴缸、冰箱、爐子、鏡子）不能動。
- **小鎮只經 `TownLife`**：出門的人 `Person.out` 不為 null，不在家裡畫面、不參與家裡的活動與社交；`step(live)` 在即時與補算都跑，補算用 `Rng.of(seed, "town:…")`。
- **天氣、季節、暫停只經 `Env`**（`LifeSim.env`）：生活用 `sim.weather()`（特殊天象換算成一般天氣），畫面用 `sim.sky()`；你的每個改變記在 `Life.env.changes`。
- **互動只經 `Interactions`**（R3）：選單上的每一格都來自登錄表；新的社交行為或活動加進自己的表就會出現在選單。做不到的要給原因（灰色），不要藏起來；戀愛互動對未成年或戀愛關閉時**不顯示**。你給住民的事一律經 `Society.suggest(…, queue = true)`（意願照算），排在 `Person.queue`，最多 5 件、每件可取消。
- **家具的樣子只來自 `LifeSim.stateOf(piece)`**（R5）：畫面不自己猜；會留下來的狀態寫在 `Life.things`（key＝`kind@x,y`），地上的東西在 `Life.litter`，都由活動結束時的 `things()` 改變（用 `Rng.of(seed, "things:…")`）。新的家具狀態＝在 `stateOf` 加一種、在 `HouseView` 畫出來、在 `ThingsTest` 補一項。
- **導覽**：世界裡的頁面在底部畫 `Nav`，點擊先交給 `Nav.tap`（先回到家再推入新頁）；`Page` 設 `nav` 就會畫導覽列。
- **次數與紀錄只經 `Journal`**（`did(who, what)`）：稱號、成就、統計、本週之星都從次數算；成就只由玩家領取（`claim`），星幣經帳本。圖鑑只由真實發生的事更新。無障礙設定是收藏庫旗標 `a11y:big`／`a11y:calm`／`a11y:vib0`／`a11y:vib1`。
- **創作只經 `Studio`**（`core:save`）：草稿、動畫、物品、聲音、標籤、劇本都寫在收藏庫；世界打開時由 `Studio.syncWorld` 複製一份進 `Life`（世界自己存，確定性不受收藏庫影響）。劇本沒有可執行的程式，只有資料；戀愛相關的劇本只配對兩位成年角色且戀愛打開（`Society.scriptOk`）。
- 繪圖引擎是純 Kotlin（`PaintDoc`）：一筆＝一個復原步驟；改像素要讓 `Layer.rev` 增加（畫面只重送改過的圖層）。有未存變更的編輯畫面，返回鍵一律先問（存草稿／不要了）。
- 長的 `ListSheet` 會在底單裡捲動（R1）：覆蓋層可以覆寫 `drag/release` 接收拖曳；捲動區裡登記點擊區前設 `app.zoneDy`。
- **每件做完的小事都是一行回憶**（`LifeSim.memory`）：擬聲與旁白只來自 `Flavor`（原創、用世界的 `Rng` 選）；時間線最多 `LOG_MAX` 行，收藏永遠不刪，只經 `trimLog()` 修剪。
- **時間**：現實模式下世界比手機快時 `LifeSim.hold`＝等待（`WorldHost.drive` 設定），不得把時鐘往回撥；補算最多過 30 天，其餘跳過並寫進摘要。
- **每一句台詞都經過 `Speech.say`**（`LifeSim.say()`）；寫台詞時用「我」「你」，由說話方式改寫。對住民說的話傳 `to`（`LifeSim.say(p, text, to = q)`），台詞裡的別人用 `Society.nickBy(說話的人, 對象)`；新的稱謂、心情、態度設定要能通過 `SpeechTest` 的全組合。
- **改世界不進去**只經 `WorldHost.edit(slotId) { sim -> … }`（先備份；沒打開的世界時鐘不動）。
- **關係規則只在 `Relations.problem()`**：戀愛預設關閉、只限兩位成年角色；編輯器、開場、生活都呼叫它。
- 匯入只經 `Importer`：用檔頭判斷格式；每個拒絕都要有原因（`MediaTest` 有壞檔集）；解碼一律經 `Codec.safe`；工作圖用 `Png.encode`（無損、各平台同位元組）。
- **世界只經 `WorldHost` 打開**（`acquire/release/drive/save`）：家的畫面與桌寵共用同一個 `LifeSim`；`drive(o, dt, "desk")` 在家的畫面看得見時不推動時間；事件經 `listeners` 發給每個觀看者。
- 桌寵的行為與手勢只在 `DeskPet`／`DeskGestures`（純 Kotlin、有測試）；`DeskService` 只放視窗、回報手機狀態。桌面上的觸碰一律經 `LifeSim` 的同一組函式。
- **桌寵三層**（R6）：新行為＝在 `DeskData` 加一筆（動作、意圖、東西、一起做的事）；動作只能沿 `DeskActs` 的 `next` 走（`enter` 會用 `hop` 找路），`DeskTest` 檢查每個動作都回得到閒晃、100 小時 `illegal == 0`、`rescues == 0`。性格只經 `Catalog` 的 `desk:cling/nest/climb/hide/social`。桌面上的東西存在 `Life.deskProps`，點心經 `Economy`（`deskPut/deskTake`）；兩隻一起做的事經 `Society.relUpdate`。
- **效能分級只改畫面**（2.0.0）：`app.perf.tier` 決定粒子、雲、快取、幀數上限；生活與存檔絕不看它。自動調整只在 `Platform.deviceClass()` 有值時（真的手機）才啟動，測試與截圖不受影響；畫面上不要顯示會隨機器變的數字（除非 `perf.adaptive`）。
- **家與小鎮只經 `Days`**（1.9.0）：食譜、紀念日、動態牆、小道具、旅行、收藏櫃、相框、挪家具、桌面日記都在 `life/Days`；一律用 `Rng.of(seed, "days:…")`；旅行中的人 `out.stage == "trip"`，`TownLife` 不處理、小鎮畫面不顯示；住民挪家具一樣經 `Decorate.move`；主畫面小工具只讀已經打開的世界（`WidgetLines`），不自己推動時間。
- **和你只經 `WithYou`**（1.8.0）：訊息、照片、筆記、膠囊、家規、換房間、小遊戲獎勵都在 `life/WithYou`（資料在 `social/YouData`）；一律用 `Rng.of(seed, "you:…")`，不得從 `sim.rng` 抽；照片只存「裡面有什麼」，由 `PhotoArt` 重畫；小遊戲的星幣經 `Economy.earn`。
- **故事只經 `Drama`**（1.7.0）：夢想、怕的東西、生病、熱潮、八卦、綽號、秘密、小圈圈、團體活動、比賽、戀愛演出都在 `life/Drama`（資料在 `social/DramaData`）；**一律用自己的 `Rng.of(seed, "drama:…")`，不得從 `sim.rng` 抽**（會打亂其他生活）。需要玩家決定的事寫成 `Decision`（`ask`／`decide`），你不在時一直等，你在看時 6 小時沒選才用溫和的預設；戀愛告白只在 `romance` 打開且兩人成年。
- **家具快取**（1.5.1）：不會動的家具經 `HouseView.cached` → `PieceCache`（依 `g.pxPerDp()` 每 0.5 倍一張，LRU 64 MB）；有動畫或有人在用的不進快取。新的家具畫法若和時間有關，不要放進 `still` 清單。
- 場景以 base dp 繪製（`HouseView` 的 T 固定 32），縮放交給 `g.scale`；高度數值都是 base dp。
- 圖示一律用 `Widgets.icon()` 畫的形狀，**不要**用字型裡的符號（`⋯ ✓ ‹` 在 Nunito 裡沒有，會變成方框）。
- `FontKind.NUM`（Nunito）沒有中文字：只用在純數字／英文上（「第 1 天」要用 UI 字型）。

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
