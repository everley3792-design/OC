# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 1.6.0（R6：桌寵重構）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-1.6.0-debug.apk`](deliverables/apk/oc-shimeji-1.6.0-debug.apk)
- 這一版（[全面重構計畫](docs/reboot/overhaul-plan.md)的第 6 步）把手機桌面上的角色整個重做：
  - **三層行為**：需求與性格 → 有優先級的意圖（反射、照顧、回應你、自己的事、閒晃）→ 照轉移表走的動作（坐下先蹲、倒吊只能放手）；
  - **性格看得出來**：黏人的常走過來看你、獨立的常回窩、好動的常爬牆、害羞的全螢幕時更早躲；
  - **跟著手指**：手指按在牠旁邊拖，牠會追過來；
  - **桌面小東西與窩**：點心（從背包拿，會去吃）、小毯子、小盆栽（會去澆水）、紙條（會去看）、窩（睏了回窩睡）；
  - **多隻互動**：打招呼、追來追去、一起坐著、靠在一起睡，依兩人的關係；都會記成回憶；
  - **陪伴模式**：陪你專心 25 分鐘，時間到提醒你休息；
  - 100 小時模擬沒有卡住。
- **桌寵全部都還沒在實機驗證**：請照 [R6 報告](docs/reboot/r6-report.md) 的「請你在手機上試」。
- 紀錄：[R6](docs/reboot/r6-report.md)（之前：[1.5.1 補完](docs/reboot/r5-1-report.md)、[R5](docs/reboot/r5-report.md)、[R4](docs/reboot/r4-report.md)、[R3](docs/reboot/r3-report.md)、[R2](docs/reboot/r2-report.md)、[R1](docs/reboot/r1-report.md)、[M7 第一批](docs/reboot/m7-1-report.md)、[M6](docs/reboot/m6-report.md)、[M5](docs/reboot/m5-report.md)、[M4](docs/reboot/m4-report.md)、[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
