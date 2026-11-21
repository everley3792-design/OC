# OC Shimeji

原創角色（OC）的**自主生活模擬＋ Android 深度桌寵**。匯入或自己畫你的角色，看牠們在家與小鎮自己過日子；也可以讓牠們跳到手機桌面上陪你。

> 這是**重構版**（從零重新開始的 0.1.x）。舊版 0.1–0.17（網頁＋3D）已經整個捨棄，只留在 git 歷史裡（最後一個舊版提交 `d88e849`），舊存檔不會被讀取。

## 目前版本 0.3.0-reboot（M2：角色創建與匯入）

- **可安裝 APK（Debug 簽章，非正式發行版）**：[`deliverables/apk/oc-shimeji-0.3.0-reboot-debug.apk`](deliverables/apk/oc-shimeji-0.3.0-reboot-debug.apk)
- 這一版能做的：
  - **匯入角色**：單張圖（可去背、手指筆刷）、PNG 序列或 ZIP（用檔名分動作）、Sprite Sheet（格子或 JSON 圖集，含 Aseprite 標籤）、GIF、APNG、動態 WebP、`.ocpkg` 角色包；
  - **角色創建**：外觀以外全部可以設定，分 9 個分頁（基本、說話、聲線、個性五軸、特質、怪癖、價值觀、喜好、口味、作息、對你的態度、故事、秘密、能力）；
    - 120 個標籤，每個都會改變行為；
    - 性格問答、隨機（可鎖分頁）、原創範本、情境預覽、相容性提醒、復原與重做；
  - **收藏庫**：編輯、複製、匯出 `.ocpkg`、刪除；
  - **關係**：雙向設定（單戀就是單向）、家人可以和未成年同房；戀愛預設關閉、只限成年；
  - **生活**：
    - 每個設定都會影響生活：作息、喜好、能力、親近度（越親近越常來找你）、最喜歡被摸的地方、口味、生日、秘密、兩個人聊天、20 種專屬活動；
    - 每句台詞依說話方式改變，並有合成的聲線；
  - 自己畫的動畫會在家裡播放；也可以選擇用系統動作、混合或只用自己的。
  - M1 的全部功能：存檔與家、觸碰、你不在的時候、匯出匯入。
- **還沒有**：桌寵（M3）、完整社交（M4）、繪圖工具與動畫工作室（M5）、小鎮（M6）。
- 手機上的實際表現（多選檔案、APNG／WebP 解碼、記憶體、聲線、觸控手感）**還沒在實機驗證**。
- 紀錄：[`docs/reboot/m2-report.md`](docs/reboot/m2-report.md)（之前：[M1](docs/reboot/m1-report.md)、[M0](docs/reboot/m0-report.md)）

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
