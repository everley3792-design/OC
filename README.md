# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 1.5.1（R1～R5 補完）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-1.5.1-debug.apk`](deliverables/apk/oc-shimeji-1.5.1-debug.apk)
- 這一版把 R1～R5 報告裡「沒做」的都補上：
  - **小鎮**：可以拖曳、兩指縮放的 2.5D 場景（商店有厚度、招牌、店員剪影、晚上亮燈、路燈、四季的樹）；
  - **家具快取**：不會動的家具依縮放畫成圖重複使用（上限 64 MB），放大不會糊；
  - **開始畫面**：搬家、有人搬進來、有人搬出去，不用進世界；
  - **操作**：拖食物給住民、佇列提前延後、滑桿用手指拖、吐司在上方可以點掉、星幣數字滾動、東西飛進收納、操控時鏡頭跟著；
  - **你的手**：開關燈、拉窗簾、鋪床、放書、撿東西；
  - **生活**：6 種新的日常活動、口頭禪會互相傳染、每一行回憶都有擬聲或旁白、換時區不會亂；
  - **創角**：8 種配件、職業分現代／古風／奇幻／自訂；
  - 30 個新圖示、空列表插圖、UI 測試 30 個情境。
- **全部都還沒在實機驗證**（尤其是效能）：請照 [1.5.1 報告](docs/reboot/r5-1-report.md) 的「請你在手機上試」。
- 紀錄：[1.5.1 補完](docs/reboot/r5-1-report.md)（之前：[R5](docs/reboot/r5-report.md)、[R4](docs/reboot/r4-report.md)、[R3](docs/reboot/r3-report.md)、[R2](docs/reboot/r2-report.md)、[R1](docs/reboot/r1-report.md)、[M7 第一批](docs/reboot/m7-1-report.md)、[M6](docs/reboot/m6-report.md)、[M5](docs/reboot/m5-report.md)、[M4](docs/reboot/m4-report.md)、[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
