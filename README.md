# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 0.5.0-reboot（M4：自主生活與社交）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-0.5.0-reboot-debug.apk`](deliverables/apk/oc-shimeji-0.5.0-reboot-debug.apk)
- 這一版新增：
  - **牠們會自己社交**：44 種社交行為，反應有熱情、開心、普通、敷衍、婉拒、生氣、哭了，每一種都有後果；
  - 話題碰撞（「御劍算不算一種通勤？」）、化學反應 30 組、衝突火花 15 組（摩擦 → 衝突 → 立家規或疏遠）；
  - 送禮、還人情、記仇與可愛的報復、吵架冷戰與和好；關係每天結算（連續兩天才升階、不見面會淡掉），還有死黨、飯友、相愛相殺這類風味標籤；
  - 煩惱泡泡：點一下聽牠說，選建議，或**自己寫一句話讓牠說**；
  - 今日狀態、心願、每天的計畫、做飯給大家、搶最後一塊、家務摩擦、浴室排隊、有人睡覺時小聲；
  - 20 種日常事件、一部 5 集的連續劇「消失的布丁」、每天的「三件事」卡片、信箱與時間線（可篩選、收藏）；
  - 觀察模式：鏡頭自己跟著有事的人，30×、60× 與快轉；大頭特寫與誇張特效；
  - 和牠聊天、給建議或直接操控、猜拳、躲貓貓。
  - 戀愛依然預設關閉、只限兩位成年角色，告白要你決定；**未成年絕不涉及**（有測試掃描）。
  - M0–M3 的全部功能：存檔與家、角色創建與匯入、關係、觸碰、桌寵。
- **還沒有**：創作套件（M5）、小鎮與佈置、商店（M6）。
- **節奏、特寫、觀察模式在手機上的感覺，以及 M3 的桌寵，都還沒在實機驗證**。
- 紀錄：[`docs/reboot/m4-report.md`](docs/reboot/m4-report.md)（之前：[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
