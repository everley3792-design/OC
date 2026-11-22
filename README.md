# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 1.3.0（R3：環狀選單與操控）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-1.3.0-debug.apk`](deliverables/apk/oc-shimeji-1.3.0-debug.apk)
- 這一版（[全面重構計畫](docs/reboot/overhaul-plan.md)的第 3 步）：
  - **點任何東西都有環狀選單**：住民、家具、地板、窗戶、天空；做不到的選項會變灰，點了會說原因；
  - **觀看／操控**：操控時先點一位住民，再點別人、家具或地板，事情就排進他的行程；
  - **指令佇列**：最多 5 件，看得到、每一件都能取消；可以指定「哪一件家具」「地板上的哪裡」；
  - **互動登錄表**：138 種互動（44 種社交、52 種活動、42 種你能做的事），選單、測試、報告都用同一份；
  - **人物卡三頁**：現在、關係、紀錄；
  - **拖曳擺放**：佈置時把背包裡的家具拖到地板上。
- **全部都還沒在實機驗證**：請照 [R3 報告](docs/reboot/r3-report.md) 的「請你在手機上試」。
- 紀錄：[R3](docs/reboot/r3-report.md)（之前：[R2](docs/reboot/r2-report.md)、[R1](docs/reboot/r1-report.md)、[M7 第一批](docs/reboot/m7-1-report.md)、[M6](docs/reboot/m6-report.md)、[M5](docs/reboot/m5-report.md)、[M4](docs/reboot/m4-report.md)、[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
