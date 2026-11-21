# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 1.0.0-beta.2（M7 第一批：補完 M6＋1.0 的第一批）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-1.0.0-beta.2-debug.apk`](deliverables/apk/oc-shimeji-1.0.0-beta.2-debug.apk)
- 這一版新增：
  - **補完 M6**：小鎮的住民是全身的；咖啡館可以請客；佈置時看得到房間的分數和一句個性；同系列加成；牆上貼紙；家具翻面；作品集與評語；季節的聲音（鳥、蟬、蟲、風）；
  - **生活紀錄**：角色日記、夢、稱號、成就（自己領）、圖鑑、這週的統計、本週之星；
  - **會長大的盆栽**、**菜園收成**、**公園撿東西**；
  - **市集日**（每 7 天）、**四季原創節日**（花瓣夜、螢火蟲祭、落葉祭、星燈節）；
  - **無障礙**：大字、減少動態、震動強度；玩一小時有**休息提醒**。
- **還沒有**（1.0 的另外 55 項）：見 [`docs/reboot/m7-1-report.md`](docs/reboot/m7-1-report.md) 第七節。
- **全部都還沒在實機驗證**：請照 [M6 報告](docs/reboot/m6-report.md) 的實機測試清單，加上 [M7 第一批報告](docs/reboot/m7-1-report.md) 第六節試。
- 紀錄：[M7 第一批](docs/reboot/m7-1-report.md)（之前：[M6](docs/reboot/m6-report.md)、[M5](docs/reboot/m5-report.md)、[M4](docs/reboot/m4-report.md)、[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
