# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 0.4.0-reboot（M3：桌寵）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-0.4.0-reboot-debug.apk`](deliverables/apk/oc-shimeji-0.4.0-reboot-debug.apk)
- 這一版新增：
  - **桌寵**：從人物卡把角色帶到手機桌面上（最多 3 位）。
    - 牠會走、跑、坐、睡、爬牆、倒吊、從邊緣探頭；
    - 點、雙擊、長按選單、來回滑摸摸、拎起、甩出去會撞牆反彈；
    - 餓了討食、累了睡、充電時開心、電量低時打瞌睡、夜深提醒你早點睡；
    - 可以設定探頭提醒喝水、休息；看影片、玩遊戲時會躲起來；
    - 偶爾說一句家裡剛發生的事。
  - 桌面上的牠和家裡是**同一份生活**：需求、心情、親近度都連在一起；收回後從門口走回家。
  - 常駐通知可以收回，或讓手指穿過；權限只在第一次帶到桌面時，先說明再請你開。
  - M0–M2 的全部功能：存檔與家、角色創建與匯入、關係、觸碰、你不在的時候。
- **還沒有**：完整社交（M4）、繪圖工具與動畫工作室（M5）、小鎮（M6）。
- **手機上的桌寵（權限流程、手感、耗電、全螢幕偵測、各廠牌的穩定度）還沒在實機驗證**。
- 紀錄：[`docs/reboot/m3-report.md`](docs/reboot/m3-report.md)（之前：[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
