# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 2.1.0（擴充計畫第一階段）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-2.1.0-debug.apk`](deliverables/apk/oc-shimeji-2.1.0-debug.apk)
- 依[擴充計畫](docs/reboot/expansion-plan.md)（50 項，8 個階段）做的第一階段：
  - **長文字不再被切掉**：清單、底單、確認框、吐司、泡泡、聊天、人物卡都會換行；
  - **拿掉玩家啟動的小遊戲**（猜拳、躲貓貓、接點心、翻牌）；住民之間自己玩的保留；
  - **聊天話題跟著當下**：心情、煩惱、今天的事、共同朋友、天氣、深夜、回憶、秘密；
  - **統一的內容格式**（[說明](docs/reboot/content-format.md)）：日常事件改成資料，有驗證器、冷卻、後續事件；
  - **設定頁**：畫面與操作、淺色深色、四個音量與靜音。
- **正式 2.0.0 仍然需要你**：實機回報（[清單](docs/reboot/device-checklist.md)），以及用你自己的金鑰簽章（`OC_RELEASE_*` 環境變數）。
- 紀錄：[擴充第一階段](docs/reboot/p1-report.md)（之前：[R8 正式版候選](docs/reboot/r8-report.md)、[R7 第三批](docs/reboot/r7-3-report.md)、[R7 第二批](docs/reboot/r7-2-report.md)、[R7 第一批](docs/reboot/r7-1-report.md)、[R6](docs/reboot/r6-report.md)、[1.5.1 補完](docs/reboot/r5-1-report.md)、[R5](docs/reboot/r5-report.md)、[R4](docs/reboot/r4-report.md)、[R3](docs/reboot/r3-report.md)、[R2](docs/reboot/r2-report.md)、[R1](docs/reboot/r1-report.md)、[M7 第一批](docs/reboot/m7-1-report.md)、[M6](docs/reboot/m6-report.md)、[M5](docs/reboot/m5-report.md)、[M4](docs/reboot/m4-report.md)、[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
