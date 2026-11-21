# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 0.6.0-reboot（M5：創作套件）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-0.6.0-reboot-debug.apk`](deliverables/apk/oc-shimeji-0.6.0-reboot-debug.apk)
- 這一版新增（收藏庫右上的「創作」）：
  - **繪圖工坊**：圖層、8 種筆刷、觸控筆筆壓、防手震、對稱、選取變形、填色、漸層、滴管、色票、復原 100 步；角色、物品、無縫壁紙與地板等範本；自動存草稿，離開前會問；畫完可以存成角色、表情、物品或壁紙；
  - **動畫工作室**：時間軸、每格停留時間、循環／播一次／來回、洋蔥皮、每格腳底、影格事件（腳步聲、音效、特效）、鏡像、從別的動作複製、批次匯入、狀態機檢視、程序動作層開關；
  - **自訂物品**：食物、飲料、禮物、壁紙、地板、家具等 11 種，存檔前會檢查；食物能拿來餵，禮物會被角色互送，壁紙地板能貼在家裡；`.ocitem` 匯出匯入；
  - **聲音**：匯入角色的聲音、音效、家裡的音樂；
  - **劇本**：積木或文字都能寫的事件（可以先問你、用旗標串成故事），`.ocmod` 劇本包；
  - **標籤編輯器**、**網格變形**（標了耳朵、尾巴、頭的單張圖角色會動）、**空間使用**；
  - M0–M4 的全部功能：存檔與家、角色創建與匯入、關係、觸碰、桌寵、自主生活與社交。
- **還沒有**：小鎮、家具擺放、商店與工坊（M6）。
- **畫畫的手感與速度、筆壓、聲音播放，以及之前的桌寵與社交節奏，都還沒在實機驗證**。
- 紀錄：[`docs/reboot/m5-report.md`](docs/reboot/m5-report.md)（之前：[M4](docs/reboot/m4-report.md)、[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
