# 技術架構（初版）

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
