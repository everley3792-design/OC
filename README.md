# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 1.1.0（R1：地基修復）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-1.1.0-debug.apk`](deliverables/apk/oc-shimeji-1.1.0-debug.apk)
- 依照玩家確認的[全面重構計畫](docs/reboot/overhaul-plan.md)，這是 R1～R8 的第一步：
  - **生活節奏**：不再半夜煮飯、晚上午睡；多了 12 種日常小事；會膩、會想做新的；每個人有自己的作息；
  - **時間**：切回現實時間時不會停在未來；顯示遊戲日期；離開超過 30 天會說明；
  - **回憶**：每件小事有擬聲、旁白、花了多久；可以回放一整天（1～1024×）、收藏名場面；
  - **長的選單可以捲動**；
  - 修掉「你不在的時候」會刪掉收藏的名場面的錯誤。
- **全部都還沒在實機驗證**：請照 [R1 報告](docs/reboot/r1-report.md) 的「請你在手機上試」。
- 紀錄：[R1](docs/reboot/r1-report.md)（之前：[M7 第一批](docs/reboot/m7-1-report.md)、[M6](docs/reboot/m6-report.md)、[M5](docs/reboot/m5-report.md)、[M4](docs/reboot/m4-report.md)、[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
