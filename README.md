# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 1.4.0（R4：創角與說話）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-1.4.0-debug.apk`](deliverables/apk/oc-shimeji-1.4.0-debug.apk)
- 這一版（[全面重構計畫](docs/reboot/overhaul-plan.md)的第 4 步）：
  - **創角 7 步**：外觀、基本、聲音、個性、性格、喜好、說話；每改一個地方，角色馬上用自己的口吻反應，聲音改了就說給你聽；
  - **互斥性格**用 × 連起來、分四色；**喜歡／不喜歡三態**（點一下喜歡、再點不喜歡、再點取消）；
  - **稱謂系統**：叫你分三段（還不熟、熟了、很親）、怎麼叫每一位室友與對他的態度、熟了會自己取綽號、心情不同時換說話方式、口頭禪的位置與頻率；
  - **自訂事件**：一句話＋多久一次＋頭上的圖示；
  - **開始畫面直接編輯**世界與角色，改之前先備份。
- **全部都還沒在實機驗證**：請照 [R4 報告](docs/reboot/r4-report.md) 的「請你在手機上試」。
- 紀錄：[R4](docs/reboot/r4-report.md)（之前：[R3](docs/reboot/r3-report.md)、[R2](docs/reboot/r2-report.md)、[R1](docs/reboot/r1-report.md)、[M7 第一批](docs/reboot/m7-1-report.md)、[M6](docs/reboot/m6-report.md)、[M5](docs/reboot/m5-report.md)、[M4](docs/reboot/m4-report.md)、[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
