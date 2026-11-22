# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 1.7.0（R7 第一批：角色與社交的故事）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-1.7.0-debug.apk`](deliverables/apk/oc-shimeji-1.7.0-debug.apk)
- 這一版：
  - **角色**：夢想一步一步實現、怕的東西（陪牠就會克服）、生日時由你決定要不要長大、生病與朋友照顧、突然迷上一件事、突發奇想當一天偵探、即興唱歌、每個人的主題旋律、30 題「如果」問答（會記住你的回答）；
  - **社交**：八卦會傳開還會走樣、熟了互取綽號、只有兩人知道的秘密、小圈圈、野餐睡衣派對營火大掃除、好勝的人找人比賽、料理對決、停電夜講鬼故事、驚喜派對、辯論請你當裁判；
  - **戀愛**（只在打開、兩人都成年時）：心動 → 你同意 → 告白；
  - **桌寵補完**：小東西從背包拿（雜貨店有賣）、追手指可以關、專心計時在通知倒數、好朋友靠在一起。
- **全部都還沒在實機驗證**：請照 [1.7.0 報告](docs/reboot/r7-1-report.md) 的「請你在手機上試」。
- 紀錄：[R7 第一批](docs/reboot/r7-1-report.md)（之前：[R6](docs/reboot/r6-report.md)、[1.5.1 補完](docs/reboot/r5-1-report.md)、[R5](docs/reboot/r5-report.md)、[R4](docs/reboot/r4-report.md)、[R3](docs/reboot/r3-report.md)、[R2](docs/reboot/r2-report.md)、[R1](docs/reboot/r1-report.md)、[M7 第一批](docs/reboot/m7-1-report.md)、[M6](docs/reboot/m6-report.md)、[M5](docs/reboot/m5-report.md)、[M4](docs/reboot/m4-report.md)、[M3](docs/reboot/m3-report.md)、[M2](docs/reboot/m2-report.md)、[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
