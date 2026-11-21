# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 0.1.0-reboot（M0：地基）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-0.1.0-reboot-debug.apk`](deliverables/apk/oc-shimeji-0.1.0-reboot-debug.apk)
- 這一版能做的：
  - 存檔選單（觀察日誌）：開始新的觀察、繼續、改名、複製、分支、刪除；每天自動備份；
  - 開始新的觀察：選住民（目前只有預設角色肉桂捲）；
  - 進到世界：住民站在房間裡呼吸，點牠會跳一下；
  - 白天／夜晚兩種配色跟隨手機。
- **還沒有**：家與房型、需求與生活（M1）、匯入與角色創建（M2）、桌寵（M3）…依計畫進行。
- 手機上的實際表現（觸控手感、版面、效能）**還沒在實機驗證**。
- 紀錄：[`docs/reboot/m0-report.md`](docs/reboot/m0-report.md)

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
