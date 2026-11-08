# 備份、匯出與匯入（0.7.0-alpha）

## 存檔（`localStorage` 的 `oc.save.v1`，原生另存一份 `filesDir/save/save.json`）
一份 JSON（schema `v: 6`）：角色、動畫文件、物品、星幣與帳本、地點佈置、生活模擬、任務／請求／成就、設定，以及第七階段的 `pet`：

```js
pet: { v, on: [ocId…],                 // 在桌面上的 OC（最多 maxPets）
  per: { ocId: { size, opacity, autonomy, climb, ceiling, peek, run, jump, drag, doubleTap, talk, mute, map: { 桌面動作: 遊戲動作 } } },
  custom: { ocId: { 分類: [自訂台詞…] } }, exported: { ocId: { sig, at, n, player } },
  global: { fps, quality, maxPets, pauseScreenOff, cacheMB, passthrough, bubbles, haptics },
  app: { enabled, useSystem, rules: { 套件: 分類 }, exclude: [套件], hide },
  applied: { inst, seq, day, n, log },  // 桌面互動的套用水位（防重複）
  syncLog, tools: { todos, notes, alarms, pomo, rest } }
```
- 圖片不在 JSON 裡：角色部件與動畫影格存在 IndexedDB（`OC.Assets`），JSON 只存 id。
- 版本遷移：v1 → v2 → v3 → v4 → v5 → v6 依序自動執行（`migrateV1`…`migrateV5`，都保留）。v5 → v6 把舊的單一桌寵（`petId`、`settings.petScale`）變成多桌寵設定的第一隻。比目前更新的存檔會被拒絕並說明「來自較新版本」。

## 匯出／匯入
| 方式 | 內容 | 圖片 | 位置 |
|---|---|---|---|
| 設定 › 資料 › 匯出存檔（JSON） | 整份存檔（含桌寵設定、工具、待辦、筆記） | **不含**（只有 id） | 系統分享 |
| 角色清單 › 匯出備份（`.ocpack`） | 選擇的角色＋可選的遊戲進度 | **含**（角色用到的所有素材與動畫影格） | 系統分享 |
| 匯入 `.ocpack` | 驗證格式、版本、檔案大小、圖片解碼；有問題的條目列出原因、不會「看似成功」 | 含 | 系統檔案選擇器 |

`.ocpack` 是 ZIP：`pack.json`（資料）＋ `assets/*.png`。**只接受資料與圖片**，不含也不執行任何程式碼（沒有 eval／script；HTML 不會被載入）。格式與相容性見 [`asset-io.md`](asset-io.md)。

## 不在備份裡的東西（會自動重建）
- 桌面用的影格（`filesDir/pet/oc/…`）：由遊戲重新輸出（啟動桌寵或「更新桌面外觀」）。
- 原生的提醒登記（`reminders.json`）與待同步的桌面互動：屬於這台裝置；換手機時，提醒請在工具頁重新設定（待辦與筆記在存檔裡）。
- 原生的安裝 id 會不同 → 遊戲自動重設桌面互動的水位，新裝置的互動照常套用。

## 測試
`game/tests/pet/run.js` 情境 10（v5 → v6 遷移、匯出再匯入保留桌寵設定與水位、拒絕較新版本）、11（重開後不重複套用）；第三～六階段的匯入／遷移測試在各自的測試檔。
