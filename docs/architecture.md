# 技術架構

## 第二階段實際架構（目前版本）

第一階段規劃的 libGDX / Filament + Compose 方案，在第二階段改為「**重用已驗證的網頁技術 + 原生外殼**」，理由：方案 G 的 3D 世界與 2D 角色已用 three.js 做出並被選定；同一份程式可在瀏覽器測試，也能完全離線打包進 APK。

```
Android App (app.ocshimeji)
├─ MainActivity ── WebView ──► https://appassets.androidplatform.net/game/index.html （AssetServer：從 APK assets 提供，離線）
│     │                         game/  three.js 3D 世界 + 2D 看板角色 + DOM UI（tokens.css / app.css）
│     ├─ NativeBridge (window.OCNative)：主題、安全區、存檔備份/分享、觸覺、桌寵控制、桌寵影格寫入
│     └─ JS 掛鉤 (window.OCApp)：setInsets / onSystemTheme / lifecycle / back / onPetState
├─ OverlayPetService (前景服務) + TYPE_APPLICATION_OVERLAY 視窗 + PetView（Canvas）
│     └─ core:pet PetBrain（純 Kotlin，有單元測試）← 使用遊戲輸出的 PNG 影格
├─ ShareProvider（匯出存檔）、檔案選擇器（匯入圖片 / 存檔）
└─ core:* 純 Kotlin 模組（anim、sim、pet、model …）
```

| 層 | 技術 | 位置 |
|---|---|---|
| 世界渲染 | three.js r158，正交 50° 固定鏡頭，PCF 柔和陰影 | `game/js/world/` |
| 角色 | 2D 參數化 rig / 玩家 PNG 影格 → CanvasTexture 垂直看板 | `game/js/art/`、`world.js` |
| 遊戲規則 | 純 JS（無 DOM、無渲染） | `game/js/core/game.js` |
| UI | 原生 DOM + CSS 變數（Design Tokens） | `game/css/`、`game/js/ui/` |
| 存檔 | localStorage JSON（schema v1）＋原生檔案備份 | `game/js/core/store.js` |
| 建置 | Gradle：離線管線（aapt/dx/zipalign/apksigner）或 AGP | `docs/android-build.md` |

### 第三階段：角色創作層
```
save.chars ─┬─ OC.Chars (model.js)      資料、性格→行為、成長建議
            ├─ OC.CharRender (render.js) ← OC.Rig（rig.js：骨架＋部件）／OC.Anim（anim.js：影格）
            │        ↑ 世界看板、頭像、編輯器舞台、工作室參考、桌寵輸出
save.animations ─ OC.Anim                 播放、方向/動作 fallback、疊加、事件
IndexedDB oc-assets ─ OC.Assets           圖片 blob、縮圖、草稿、LRU 解碼快取
OC.IO                                     GIF/APNG/WebP/Sprite Sheet/ZIP 解碼、.ocpack 讀寫
UI: creator / charedit / charpages / library / paint / animstudio
```
詳見 `docs/character-format.md`、`docs/animation-system.md`、`docs/asset-io.md`。

### 第四階段：生活模擬層（0.4.0-alpha）
```
OC.Sim (life/sim.js)      唯一的固定步長排程器（0.2 現實秒／步）＋遊戲時鐘（現實／循環 ×1–×10／固定）＋離線補算
  └─ 每步 → OC.Brain.lifeStep
        ├─ OC.Mind (life/mind.js)   需求 9 種、情緒、回憶、生活紀錄、關係（有方向）、願望、技能、作息、成長建議（需同意）
        ├─ OC.Brain (life/brain.js) Utility AI、活動狀態機、可供性與預約、社交編排、分層／離線模擬
        ├─ OC.Talk (life/talk.js)   資料驅動對話（條件、變數、權重、冷卻、匯入匯出）
        └─ OC.Events (life/events.js) 事件生命週期（條件、優先、冷卻、一次性、演出、結果、確認）
OC.LifeData (life/data.js)  需求／情緒／活動／社交／習慣規則／台詞／事件的資料表
UI: ui/lifeui.js（互動選單、通知、檔案「生活／關係／回憶」、生活設定、對話編輯、開發者診斷）
app.js：把現實經過時間交給 OC.Sim.update()；hooks（泡泡、表情、通知、鏡頭、選項）；拖曳 OC；觀察模式
world.js：tickActors（頁面蓋住時仍移動）、focus（鏡頭跟隨）、隱藏室內角色、拖曳手勢
```
詳見 `docs/behavior-engine.md`、`docs/life-format.md`、`docs/event-rules.md`、`docs/memory-model.md`。
桌寵同步：`OCApp.petContext(app)` 回傳桌寵角色的情緒／正在做的事／需求／一句台詞（JSON）；`savePetSprites` 也附帶 `life` 欄位（舊版原生層只讀 frames/fps，不受影響）。

懸浮桌寵的驗證清單（下方）**仍未在實機執行**。

---

## 第一階段規劃（歷史紀錄）


## 技術選型

| 需求 | 選擇 | 理由 |
|---|---|---|
| 語言 | **Kotlin**（全專案） | 遊戲邏輯、UI、Android 原生服務（懸浮桌寵）共用同一語言與同一份核心程式碼 |
| 2.5D 世界渲染 | **libGDX**（只用 2D：SpriteBatch、正交相機、TextureAtlas） | 成熟、輕量、純 2D、批次繪製大量 sprite、Android 原生 |
| 選單 / 頁面 UI | **Jetpack Compose** 疊在世界上方 | 繁中文字排版、輸入法、無障礙、深淺色、動畫都由系統處理；大量表單頁面開發效率高 |
| 繪畫工坊 / 動畫工作室畫布 | Android `Canvas` + 離屏 `Bitmap` 圖層 | 支援壓感、撤銷堆疊、PNG 匯出，與 libGDX 解耦 |
| 懸浮桌寵 | 前景 `Service` + `WindowManager` `TYPE_APPLICATION_OVERLAY` + 軟體 Canvas `View` | 不需 GL context，常駐耗電最低；跟遊戲共用 `core:anim`、`core:sim` |
| 存檔 | 版本化 JSON 快照（kotlinx.serialization）+ 檔案式資產庫 | 可讀、可遷移、可匯出；玩家圖片不塞進資料庫 |
| 測試 | 核心模組為純 JVM，JUnit 可在無 Android SDK 的 CI 執行 | `./gradlew -PcoreOnly=true test` |

> **第三輪更新**：使用者選擇「3D 固定視角世界＋2D 角色」。世界層建議改用 **Filament**（或 Godot 4），角色以 2D 看板放入 3D 場景；UI、懸浮桌寵、繪畫與動畫工坊維持 2D。詳見 `docs/phase1-round3-hybrid3d.md`。以下表格保留純 2D 方案（A–F）的原始選型，供比較。

**純 2D 方案時**：不使用 3D 引擎與 3D 模型；「2.5D」= 斜俯視構圖 + Y 軸深度排序 + 分層 + 斷崖高度 + 陰影。

## 模組圖

```
            ┌─────────────── app (Activity shell, navigation, DI) ───────────────┐
            │                                                                      │
   ui:design (tokens, components)   feature:* (creator, profile, bag, shop,        │
            │                         map, studio, settings…)  ← Phase 2          │
            │                                                                      │
   render:world (libGDX)           platform:overlay (Service, PetBrain, PetView)   │
            │                                   │                                  │
            └──────────────┬────────────────────┘                                  │
                           ▼                                                       │
 core:sim (utility AI, needs, clock) ─ core:anim (motion, rig pose, clips) ─ core:event (bus)
                           │                     │
                 core:assets (.ocpack)     core:save (versioned save)
                           └──────── core:model (data) ────────┘
```
規則：
1. `core:*` **不得依賴 Android**（純 Kotlin/JVM）。
2. 依賴只能向下；`feature` 之間不互相依賴，經由 `core:event` 與導航溝通。
3. 渲染層只「讀」狀態（`RigPose`、`WorldFrame`），永不修改模擬狀態。
4. 懸浮桌寵與遊戲共用 `core:sim` 狀態（同一份存檔），桌寵用較低 tick 率（每 10 秒一次）。

## 執行期資料流
```
輸入（觸控）→ UI/世界命中測試 → 指令（UseItem, Travel, Buy…）→ core:sim 更新
→ GameEvent 發佈 → UI 動畫 / 世界角色反應 / 桌寵反應
→ 每幀：sim 產生 RigPose → 渲染器依方案畫出
```

## 2.5D 世界
- 地圖 = 圖層：地面 → 貼花（路、水坑）→ 斷崖面（高度）→ **Y 排序物件**（角色、樹、屋，排序鍵：高度層 → 腳底 y → x）→ 頂層（樹冠、屋頂）→ 天氣 → 光影。
- 每格 `elevation` 決定可走範圍與斷崖；樓梯 / 坡道是可通行的高度轉換。
- 室內：獨立場景，鏡頭固定，進門時屋頂淡出。
- 光影：A/C 用乘法色調＋加法光源 sprite；B 用調色盤 LUT 量化＋Bayer 抖色（與原型相同演算法）。

## 多角色自主行為
- Utility AI（`core:sim/LifeSim`）：分數 = 需求缺口²×恢復量 + 個性權重 + 少量隨機；行為有持續時間，結束才重新選擇。
- 每分鐘需求衰減、夜晚精神下降更快；角色間互動需要雙方可用。
- 決定性（固定 seed）→ 可重播、可測試。

## 逐幀動畫工坊 & 玩家素材
- 動畫 = `FrameClip(fps, frames[hold, layers, pose])`；`hold=2` 即「一拍二」。
- 玩家素材存為 PNG 圖層 + manifest（見 `asset-format.md`）；匯入時檢查尺寸、錨點、風格標籤。
- 工坊輸出的 clip 可直接套用到角色（世界與桌寵都能播放）。

## 效能模式
| 模式 | FPS | 粒子 | 環境動畫 | 光影 | 其他 |
|---|---|---|---|---|---|
| 高畫質 | 60 | 400 | 開 | 完整 | 高解析 atlas |
| 平衡（預設） | 60 | 150 | 開 | 完整 | |
| 省電 | 30 | 40 | 關（樹/水靜止） | 簡化（只有色調） | 世界以半解析度渲染後放大 |
懸浮桌寵：活動時 30fps、休息/睡覺時 10fps、螢幕關閉時暫停。

## 懸浮桌寵（Android 系統級）
- `OverlayPetService`：前景服務（`specialUse`）、`SYSTEM_ALERT_WINDOW` 權限（引導至系統設定授權）。
- 視窗只有寵物大小（96dp 起），**跟著寵物移動**，不覆蓋全螢幕 → 不攔截其他 App 的觸控。
- 行為（`PetBrain`，純邏輯可測試）：走路、閒置、拖曳擺盪（阻尼彈簧）、放開下落（重力）、落地擠壓、坐下、睡覺。
- **第一階段狀態：程式碼已撰寫，未編譯、未實機驗證。** 驗證清單（第二階段必須全部通過才算完成）：
  1. 授權流程（拒絕 / 允許 / 之後撤銷）正確。
  2. 在桌面與 3 個以上其他 App 上方顯示，觸控穿透正常。
  3. 拖曳、放下、落地在 60/90/120Hz 螢幕皆流暢。
  4. 旋轉螢幕、分割畫面、鎖屏後恢復位置正確。
  5. 前景通知可關閉桌寵；App 被系統回收後可恢復。
  6. 連續 1 小時耗電與記憶體量測（目標：< 2% 電量/小時，< 40MB）。

## 建置
- 完整建置需要 Android SDK 與 Google Maven（`./gradlew :app:assembleDebug`）。
- 核心模組：`./gradlew -PcoreOnly=true test`（不需 Android SDK）。
- 第一階段環境限制：雲端容器封鎖 `dl.google.com`，因此**本階段未產出 APK**。
