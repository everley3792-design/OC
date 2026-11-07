# 第二階段完成紀錄與測試報告

版本 **0.2.3-alpha（versionCode 5）**（0.2.0–0.2.2 實機無法開啟，見下方「實機回報」）　分支 `claude/oc-shimeji-visual-design-qcc3xy`
標示：✅ 已實作且在本環境驗證　🟡 已實作，但只能在實機驗證（本環境沒有 Android 裝置/模擬器）　🔒 刻意標示「未開放」　⏭ 依指示延後

## 交付物
| 項目 | 位置 |
|---|---|
| 遊戲原始碼（離線網頁，打包進 APK） | `game/` |
| Android 專案 | `android/`（`app` 外殼、`core:*` 純 Kotlin） |
| **Debug APK** | `deliverables/apk/oc-shimeji-0.3.0-alpha-debug.apk`（4.2 MB，SHA-256 見同目錄 `.sha256`） |
| 建置產出位置 | `android/app/build/outputs/apk/debug/oc-shimeji-0.3.0-alpha-debug.apk` |
| 截圖（25 張，2×） | `deliverables/phase2/screens/`、總覽 `deliverables/phase2/screens-contact-sheet.jpg` |
| 文件 | `docs/design-system.md`、`docs/ui-components.md`、`docs/art-guidelines.md`、`docs/android-build.md`、`docs/architecture.md`、`docs/roadmap.md`、`CLAUDE.md` |

安裝：`adb install -r deliverables/apk/oc-shimeji-0.3.0-alpha-debug.apk`（或傳到手機開啟，需允許未知來源）。最低 Android 8.0。

## 一、3D 場景與模型
| 項目 | 狀態 |
|---|---|
| 晴日島：沙灘、草皮、兩層高台（地層斷崖＋柵欄）、石階坡道×2、河流＋瀑布＋木橋、廣場、石板小徑、碼頭＋小船、3 棟房屋（細節：屋瓦、煙囪、門框、窗格、百葉、花箱、門燈）、攤位、長椅、路燈、果樹×7、棕櫚、灌木、岩石、花圃 | ✅ |
| 苔光森林（第二個可探索區域）：杉林、池塘＋睡蓮、樹樁、蘑菇、小徑 | ✅ |
| 柔邊（倒角/車床）、物件登記碰撞、不懸空（地面高度函式） | ✅ |
| 角色往各方向移動、高低層、坡道、遮擋（建築在前會擋住角色並顯示剪影）、陰影、碰撞、A* 導航 | ✅ |
| 鏡頭：跟隨、單指平移、雙指縮放（1.15–3.2×）；**不旋轉**（依第三輪定案的固定視角規則） | ✅ |
| 手機效能預算：~220 draw calls、4.4–5.7 萬三角形；幾何/材質共用 | ✅（數字為實測；手機 fps 🟡） |

## 二、2D Sprite 角色
| 項目 | 狀態 |
|---|---|
| 所有 OC 為 2D（參數化 rig 或玩家圖片/逐格動畫） | ✅ |
| 垂直看板、腳底對齊、接觸陰影、地形高度、縮放補償（不變形） | ✅ |
| 轉身：`face`/`back` 連續平滑，無瞬間翻面；圖片角色以平滑鏡像 | ✅ |
| 被遮擋時 x-ray 剪影（第一版有 z-fighting 條紋，已修正） | ✅ |
| 待機呼吸、眨眼、走路、跳、坐、吃、驚嘆/愛心表情 | ✅ |
| 單向素材簡化顯示（鏡像＋彈跳＋搖擺） | ✅ |
| 紋理只在姿勢改變時更新（無每幀重傳） | ✅ |

## 三、光影與天氣
早晨/中午/黃昏/夜晚（關鍵影格內插，跟隨手機時間或固定）、晴/多雲/雨/霧（依日期每 6 小時自動或固定）。
影響太陽角度、色溫、強度、天光、海色、霧、陰影方向。環境動畫：草（GPU 風）、樹冠/花擺動、海浪紋、浪花圈、河水、瀑布、雲影、雨絲＋地面漣漪、螢火蟲（夜）、花瓣（晴天）、燈光與窗戶夜間發光。
所有變化以 τ≈1.6s 平滑過渡，無閃光、無鏡頭晃動；霧常駐（晴天推遠）所以切天氣不重編著色器。✅（截圖 02–08）

## 四、UI/UX、HUD、Design System
| 項目 | 狀態 |
|---|---|
| HUD：角色膠囊、時間・天氣、金幣、佈置、快速背包（≤6） | ✅ |
| 導覽：小島／角色／工坊／探索／更多 | ✅ |
| 快速背包：可拖曳上移/下拉收起；拖物品到角色＝使用、到居民＝送禮、家具到地上＝放置 | ✅ |
| 頁面：引導、創角、檔案（只看）、編輯（4 分頁）、個性、需求、人際關係＋回憶（對話事件紀錄）、對話事件、背包、商店（買/賣）、工坊、逐格動畫工作室、衣櫥、家具佈置、世界地圖、探索、任務、成就、圖鑑、人生目標、設定、關於 | ✅ |
| 所有按鈕都有真實效果；任務/成就/目標只由實際行為累積；初始只有 2 顆蘋果 + 1 朵花 + 300 金幣 | ✅ |
| 🔒 未開放：星砂海灘、風車丘、雲朵市集（地圖上鎖）、音樂與音效（設定中標示） | 🔒 |
| 瀏覽器中「啟動桌寵」顯示未開放（需要 Android App），不會假裝成功 | ✅ |

## 五、深色模式
淺色/深色/跟隨系統；重新設計的深藍灰色盤；即時切換（只改 `data-theme`，240ms 交叉淡化），重開後保留；開機前決定主題（無白閃）；原生偏好為準（修正過一次「首次啟動被存檔預設值覆蓋」的問題）；與世界晝夜獨立（截圖 23：深色 UI＋黃昏島）。✅　Android 系統主題即時切換 🟡

## 六、動畫
統一緩動 token（ease-out / in-out / pop、140/240/380ms）；頁面建一次、就地更新；減少動態設定。✅　完整工作室與事件演出 ⏭

## 七、Android
| 項目 | 狀態 |
|---|---|
| 套件 `app.ocshimeji`、名稱、圖示（由角色 rig 產生，各密度）、啟動畫面、直向、安全區、淺/深主題、本機資源、生命週期、儲存、權限、離線 | ✅ 建置 / 🟡 執行 |
| 檔案選擇器（匯入圖片/存檔）、系統分享（匯出存檔，`ShareProvider`） | ✅ 建置 / 🟡 執行 |
| 系統級懸浮桌寵：權限流程、前景服務、覆蓋其他 App、拖曳、點擊、雙擊回遊戲、通知收起；外觀由遊戲輸出 192px 影格 | ✅ 建置＋JS 端輸出已測（idle4/walk8/drag2/sit2/sleep2/happy4）/ 🟡 **實機未驗證** |
| Gradle 實際建置 Debug APK、apksigner v2/v3 驗證、zipalign | ✅ |
| Release 簽署流程（環境變數，金鑰不入庫）— 以拋棄式金鑰實跑成功 | ✅ |
| 標準 AGP 路徑 | 🟡（設定已寫，本環境無 Google Maven） |

## 八、效能與觸控
| 項目 | 狀態 |
|---|---|
| 高 / 平衡 / 省電 / 自訂：真的改變像素比、陰影（2048/1024/關）、特效、草密度、fps 上限（60/30）、看板解析度、點光源 | ✅（逐項讀回 renderer 狀態） |
| 世界被頁面完全蓋住時停止渲染；App 背景時暫停迴圈 | ✅ |
| 60fps 目標 | 🟡 無法在本環境量測（SwiftShader 軟體渲染：省電 ~1.4ms/幀、平衡 ~50ms、高 ~77ms，主要是 CPU 光柵化陰影，**不代表手機 GPU**） |
| 手勢不衝突：平移不走路、雙指縮放、長按查看、點擊移動、頁面捲動不動世界 | ✅（CDP 觸控事件測試） |
| 觸控熱區 ≥ 48：測試發現開關只有 50×30，已加大熱區 | ✅ |

## 測試紀錄（本環境）
- Kotlin 核心：`gradle -PcoreOnly=true test` → **18 tests, 0 failures**（MotionTest、LifeSimTest、PetBrainTest）。
- 遊戲（Playwright + Chromium 手機模擬 393×852、360×780、412×780，WebGL/SwiftShader）：
  - 開機→引導→島：無 console error / page error。
  - 互動流程：搖果樹→掉落→撿取（背包增加）、賣出（+40 金幣）、購買椅子、拖花給小空（友情 +4、回憶寫入）、放置家具（找到合法位置、存檔）、工作室畫 2 格並儲存、設為外觀、搭船到森林（每日蘑菇 5 個、成就解鎖）、效能模式切換、重新整理後存檔與深色主題保留。
  - 18 個頁面在 360dp 寬無水平溢出。
  - 模擬 `OCNative`：開機主題、安全區、桌寵影格輸出、啟動桌寵、返回鍵堆疊、生命週期存檔、匯出存檔分享。
  - APK 內的 `assets/game` 與原始碼逐檔一致，解包後的遊戲可無錯誤啟動。
- 測試中找到並修正：x-ray 剪影 z-fighting、草葉觸發剪影、子頁按鈕被導覽列蓋住、托盤收起時露出、對話/佈置與托盤重疊、CSS 自訂屬性未套用（色票/需求色）、佈置幽靈預設在無效位置、取消佈置留下底框、可放置未擁有家具、首次啟動主題來源、APK 管線未宣告輸入導致 APK 過期、開關熱區過小。

## 實機回報 #1（0.2.0-alpha）：「程式無法開啟」→ 0.2.1-alpha

使用者在手機上安裝 0.2.0 後無法開啟。本環境沒有裝置、也拿不到 logcat，因此做了以下調查與處理：

| 檢查 | 結果 |
|---|---|
| Manifest、資源 ID（R.java ↔ resources.arsc）、啟動流程的 API 等級 | 正常 |
| dex 內容 | **發現錯誤**：Kotlin 標準庫與 core 模組含 Java 8 `invokedynamic` lambda，`dx` 原樣輸出為 `invoke-custom` → `LambdaMetafactory`，而 Android 框架沒有這個類別（已用 android-all 確認）→ 執行到相關程式就會閃退 |
| 修正 | 建置流程加入 ProGuard 改寫 lambda（`desugar`），並加 `checkNoIndy` 防止再發生。新 dex：0 個 call site、類別數 1433 → 305 |
| 是否就是「打不開」的原因 | **不確定**。啟動流程直接呼叫的標準庫函式本身不含 lambda，因此這個錯誤可能是在稍後（桌寵、匯出等）才觸發。另外兩個常見原因（WebView 繪圖程序崩潰會帶走整個 App、系統 WebView 太舊）在 0.2.0 都沒有處理 |
| 因此 0.2.1 另外加入 | 閃退紀錄與下次開啟的錯誤畫面、`onRenderProcessGone`、WebView 版本檢查、網頁開機防護與 20 秒看門狗、弱機自動省電（見 `docs/android-build.md` §7）。以 Chromium 模擬：無 WebGL、舊 WebView、啟動例外、逾時、原生交接都會顯示正確說明 |

**下一步需要使用者協助**：安裝 0.2.1。若仍無法開啟，畫面會顯示錯誤資訊（或在下次開啟時顯示），請按「複製錯誤資訊」貼回，即可定位真正原因。

## 實機回報 #2（0.2.1-alpha）：診斷畫面抓到真正原因 → 0.2.2-alpha

0.2.1 的閃退紀錄畫面在使用者手機上正常運作，回傳了確切錯誤：

- 裝置：Samsung SM-S9210，Android 15（API 35），WebView 156.0.8078.47（夠新，不是 WebView 問題）
- 錯誤：`NullPointerException … DecorView.getWindowInsetsController() on a null object reference`
  於 `PhoneWindow.getInsetsController` ← `MainActivity.applySystemBars` ← `MainActivity.onCreate`

**原因**：Android 11 以上，`Window.getInsetsController()` 直接呼叫 `mDecor.getWindowInsetsController()`，沒有判斷 null；
在 `setContentView` 之前 DecorView 還不存在，所以框架內部丟出 NPE。原本的 `window.insetsController?.` 只保護「回傳值為 null」，保護不了框架內部的 null——
先前的靜態檢查錯誤地認為這樣是安全的。0.2.0 也是同一個原因（Android 11+ 的手機開啟就閃退）。

**修正（0.2.2）**：改用 `window.decorView.windowInsetsController`（`getDecorView()` 會先建立 DecorView，且未附加前也能取得控制器）；
系統列樣式與 edge-to-edge 設定包在 `runCatching` 中，外觀設定失敗不再能讓 App 閃退。已在編譯後的 bytecode 確認 `Window.getInsetsController` 呼叫已移除。
（0.2.1 修掉的 lambda 問題仍是真實錯誤，只是不在啟動路徑上。）

仍無法在本環境實機執行；請安裝 0.2.2 回報。

## 實機回報 #3（0.2.2-alpha）：Activity 已能啟動，WebView 載入時閃退 → 0.2.3-alpha

- 錯誤（`Chrome_IOThread`）：`AbstractMethodError: abstract method "int java.util.Map.size()" on receiver kotlin.collections.EmptyMap`，於 WebView 的 `CommonApis.mapToArray`。
- **原因（0.2.1 引入的建置錯誤）**：ProGuard 除了改寫 lambda 也做了「縮減」。框架 jar 不含 `java.*`，ProGuard 看不出 `EmptyMap` 實作 `java.util.Map`，
  把 `size()`／`getSize()` 當成沒用到而刪除（已比對原始 stdlib 與輸出確認）。WebView 讀取 404 回應（例如自動要求的 favicon）的標頭 `emptyMap()` 時就閃退。
- **修正（0.2.3）**：ProGuard 改為 `-dontshrink`（只改寫 lambda，不刪任何東西），並加入 JDK `java.base` 作為函式庫以取得完整類別階層；
  `checkNoIndy` 另外檢查「輸入的每個類別都還在」與 `EmptyMap` 的 bridge 方法存在；`AssetServer` 的標頭改用 `java.util.HashMap`。
- 逐方法比對 1454 個類別：除 kotlinx.serialization 介面的 static/default 方法被依 Java 7 規則搬到輔助類別（呼叫端同步改寫，App 執行期未使用）外，沒有任何方法遺失。

## 尚未驗證（必須在實機確認，不宣稱完成）
1. 安裝與啟動、WebView WebGL 在實機的畫面與 **60fps**、記憶體、發熱。
2. 懸浮桌寵完整驗證清單（`docs/architecture.md`）。
3. 系統深色模式即時切換、返回鍵、檔案選擇器、分享、通知權限（Android 13+）。
4. AGP 建置路徑。
5. localStorage 在 WebView 被清除後由原生備份還原（程式已寫，未在裝置上演練）。

## 已知限制
- 舊的 `android/platform/` 是第一階段骨架，未納入建置（已由 `app/…/overlay` 取代）。
- 音訊未實作（標示未開放）；室內場景、更多地點、完整動畫工作室、生活 AI、經濟/社交/小遊戲依指示延後。
- 玩家作品以 dataURL 存在存檔中，大量作品可能逼近 localStorage 上限（有容量不足提示）；後續可改為檔案儲存。
