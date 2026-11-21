# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 1.0.0-beta（M6：小鎮、佈置、工坊＝MVP 測試版）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-1.0.0-beta-debug.apk`](deliverables/apk/oc-shimeji-1.0.0-beta-debug.apk)
- 這一版新增：
  - **小鎮**：廣場、雜貨店、家具店、咖啡館、公園；住民自己出門、自己回家，在小鎮遇到時會發生 25 種事件；
  - **星幣、背包、帳本**：每一筆都記下來；每日 3 個小目標；
  - **商店**：雜貨店每天換貨，家具店每週換貨；
  - **布告欄**：新聞和小目標；
  - **佈置**：擺放、移動、收起、復原，放不下會說原因；自己畫的家具也能擺；
  - **房間請求**、環境分數；
  - **工坊**：委託住民做你設計的物品；**市集攤位**、**公共角落**；
  - **新房型**：庭院平房、共居宿舍、家族大宅（要先有 5 位住民的家）；**搬家**前大家會說想法；
  - **天氣與季節**：晴、陰、雨、霧、雪；彩虹、初雪；
  - **依時段的音樂**（App 自己合成，原創）；
  - M0–M5 的全部功能：存檔與家、角色創建與匯入、關係、觸碰、桌寵、自主生活與社交、創作套件。
- **還沒有**（M7 → 1.0）：系列加成、貼紙、可以走進去的小鎮場景、更多內容與打磨。
- **全部都還沒在實機驗證**：請照 [`docs/reboot/m6-report.md`](docs/reboot/m6-report.md) 最後的「實機測試清單」試。
- 紀錄：[M6](docs/reboot/m6-report.md)（之前：[M5](docs/reboot/m5-report.md)、[M4](docs/reboot/m4-report.md)、[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

## 計畫
完整的重構計畫（玩家已確認）：[`docs/reboot/reboot-plan.md`](docs/reboot/reboot-plan.md)
- 第一～九節：核心循環、技術架構、匯入與動畫、AI 與事件、場景、UI、路線圖、風險；
- 第十節：已確認的決定；
- 第十一～十三節：完整遊戲系統總表與修訂後的路線圖（M0–M6＝MVP，之後 1.0）。

## 建置
```bash
gradle -PcoreOnly=true test --max-workers=1
gradle :app:assembleDebug :app:verifyDebugApk --max-workers=1
```
需要 JDK 17、Gradle 8、Ubuntu 的 `aapt`、`dalvik-exchange`、`zipalign`、`apksigner`、`android-sdk-platform-23`，以及 Robolectric android-all（API 35）放在 `/opt/oc-android/`。詳見 `CLAUDE.md`。

## 授權與素材
所有美術與聲音為原創；預設角色「肉桂捲」的圖由玩家提供。字型為 SIL Open Font License（`art/fonts/LICENSES.md`）。
