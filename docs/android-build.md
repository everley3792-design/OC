# Android 建置說明（第二階段）

App：**OC Shimeji**　套件名稱 `app.ocshimeji`　版本 `0.2.3-alpha`（versionCode 5）
minSdk 26（Android 8.0）／targetSdk 33／直向／完全離線（遊戲從 APK assets 載入，不需要開發伺服器）

## 1. 架構一句話

原生 `MainActivity`（Activity + WebView）把 `game/` 整包當作 APK assets，經 `AssetServer` 以
`https://appassets.androidplatform.net/game/index.html` 提供給 WebView（安全的 https 來源，localStorage 可用）。
原生層負責：系統列與安全區、深淺主題、生命週期、返回鍵、檔案選擇器、存檔備份與分享、**系統級懸浮桌寵**（`OverlayPetService`）。
JS ↔ 原生介面見 `android/app/src/main/java/app/ocshimeji/bridge/NativeBridge.kt`（`window.OCNative`）與 `game/js/app.js` 的 `window.OCApp`。

## 2. 兩種建置方式

| 方式 | 指令 | 需要 | 狀態 |
|---|---|---|---|
| **離線管線**（本雲端環境實際使用） | `cd android && gradle -Poc.build=offline :app:assembleDebug` | JDK 17、Gradle 8、`aapt`、`dalvik-exchange`(dx)、`zipalign`、`apksigner`（Ubuntu 套件）、Robolectric android-all API 35 jar、API 23 platform jar | **已實際建置並驗證** |
| 標準 AGP | `cd android && ./gradlew :app:assembleDebug` | Android SDK（compileSdk 35）+ Google Maven | 設定檔已寫好，**本環境無法連線 dl.google.com，未實際執行** |

`settings.gradle.kts` 會自動選擇：設定了 `ANDROID_HOME` 時用 AGP，否則可用 `-Poc.build=offline` 強制離線管線。

### 離線管線步驟（`android/app/build.offline.gradle.kts`）
1. `genRes`：`aapt` 由 `res/` + Manifest 產生 `R.java`，並產生 `BuildInfo.java`（版本號）。
2. `compileKotlin`：app + `core:pet`/`core:anim`，compileOnly 對 Robolectric android-all（API 35 介面）。JVM 1.8、`-Xlambdas=class`（給 dx 用）。
3. `desugar`：**ProGuard 7.10**（Maven Central）處理 app + 所有執行期 jar：把 Java 8 `invokedynamic` lambda 改寫成一般類別（`-target 1.7`），並移除用不到的 Kotlin 標準庫。規則：`app/proguard-offline.pro`（不混淆、不最佳化、保留 `app.ocshimeji.**` 與 `@JavascriptInterface`）。
   `checkNoIndy`：產物中若還有 `LambdaMetafactory`／`StringConcatFactory` 就**讓建置失敗**。
   原因：`dx` 不會改寫 lambda，會原樣輸出成 `invoke-custom`，但 Android 執行環境沒有 `java.lang.invoke.LambdaMetafactory` → 執行到就閃退（0.2.0 的問題，Kotlin 標準庫本身就含有這種 lambda）。正式的 D8/R8 只在 Google Maven，本環境無法下載。
4. `dex`：`dalvik-exchange --min-sdk-version=26` → `classes.dex`。
5. `syncGame` + `packageRes`：把 `../game`（排除 tests、*.md）放進 `assets/game/`；字型/圖片不壓縮（`-0`）。
6. `addDex` → `zipalign -p 4` → `apksigner`（v2 + v3 簽章）。
7. `verifyDebugApk`：`apksigner verify`。

每一步都有宣告 inputs/outputs，修改遊戲檔案後一定會重新打包（第二階段修正過一次「APK 沒更新」的問題）。

### 環境初始化（一次）
```bash
sudo apt-get install -y aapt dalvik-exchange zipalign apksigner android-sdk-platform-23
# Robolectric android-all（Maven Central）放到 /opt/oc-android/：
#   org.robolectric:android-all-instrumented 或 android-all:15-robolectric-14663667
```
路徑可用 `-Poc.compileJar=…`、`-Poc.resJar=…` 或環境變數 `OC_COMPILE_JAR`、`OC_RES_JAR` 覆寫。

## 3. 產出

```
android/app/build/outputs/apk/debug/oc-shimeji-0.2.3-alpha-debug.apk
```
一份副本放在 `deliverables/apk/oc-shimeji-0.2.3-alpha-debug.apk`（含 SHA-256）。

## 4. 安裝

```bash
adb install -r deliverables/apk/oc-shimeji-0.2.3-alpha-debug.apk
```
或把 APK 傳到手機，用檔案管理員開啟（需允許「安裝不明來源的應用程式」）。
Debug 版使用本機自動產生的 debug keystore（`~/.android/debug.keystore`，不在版本庫中）簽署；
不同電腦建出的 debug APK 簽章不同，覆蓋安裝前需先解除安裝舊版。

## 5. 正式版（Release）簽署流程

金鑰**絕不放進版本庫**（`.gitignore` 已排除 `*.jks`、`*.keystore`、`keystore.properties`）。

```bash
# 只做一次：產生正式金鑰，妥善備份（遺失就無法更新已上架的 App）
keytool -genkeypair -keystore ~/secure/oc-release.jks -alias oc -keyalg RSA -keysize 4096 -validity 10000

# 每次建置：用環境變數提供
export OC_RELEASE_KEYSTORE=~/secure/oc-release.jks
export OC_RELEASE_KEY_ALIAS=oc
export OC_RELEASE_STORE_PASSWORD=…   # 建議由 CI 的 secret 注入
export OC_RELEASE_KEY_PASSWORD=…
cd android && gradle -Poc.build=offline :app:assembleRelease
# → android/app/build/outputs/apk/release/oc-shimeji-0.2.3-alpha-release.apk
```
AGP 路徑（`build.gradle.kts`）讀同樣四個環境變數。
本環境已用一把**拋棄式測試金鑰**（存放在版本庫外、用完即刪）實際跑過 `assembleRelease`，`apksigner verify` 通過。
上架 Google Play 需要 AAB 與 targetSdk 34+，屬於後續階段（見 `docs/roadmap.md`）。

## 6. 權限

| 權限 | 用途 | 何時要求 |
|---|---|---|
| `SYSTEM_ALERT_WINDOW` | 桌寵顯示在其他 App 上方 | 第一次按「啟動桌寵」時導向系統設定頁 |
| `FOREGROUND_SERVICE` | 桌寵服務在背景持續 | 自動 |
| `POST_NOTIFICATIONS`（13+） | 前景服務通知裡的「收起桌寵」 | 啟動桌寵時詢問；拒絕也能用 |

不需要網路、儲存空間或相機權限；匯入圖片／存檔使用系統檔案選擇器，匯出存檔使用系統分享（`ShareProvider`）。

## 7. 現場診斷（不需要 adb）

0.2.1 起，App 打不開時會自己說明原因，而不是直接消失：
- 任何閃退都會記錄下來（`OcApp.attachBaseContext` 安裝），**下次開啟時顯示錯誤畫面**，可「複製／分享錯誤資訊」、「重新開啟」、「用省電模式重新開啟」。
- WebView 繪圖程序當掉（GPU/WebGL/記憶體）時不再拖垮整個 App（`onRenderProcessGone`），改顯示錯誤畫面。
- 開啟前檢查系統 WebView：找不到、或版本低於 Chromium 88 → 說明並提供「前往更新 WebView」。
- 網頁端開機防護（舊式 JS，任何 WebView 都能執行）：缺少功能、沒有 WebGL、啟動例外、20 秒未完成啟動 → 交給原生錯誤畫面。
- 弱機（≤3 GB 記憶體或 ≤4 核）首次啟動自動使用省電模式；`?safe=1` 強制省電。

有 adb 時也可以：`adb logcat -s OCDiag OCWeb AndroidRuntime chromium`

## 8. 未在本環境驗證（必須實機確認）

本雲端容器沒有 Android 模擬器或實機，以下**尚未驗證**：
- 安裝、啟動、WebView 載入、WebGL 在實機 GPU 上的效能與 60fps。
- 懸浮桌寵：權限流程、顯示在其他 App 上方、拖曳、點擊、雙擊回到遊戲、通知列收起（`docs/architecture.md` 驗證清單）。
- 系統深色模式切換時的即時反應、返回鍵、檔案選擇器、分享存檔。
- AGP 建置路徑。

已驗證：Gradle 建置成功、APK 簽章（v2/v3）、zipalign、套件資訊（`aapt dump badging`）、dex 內含全部 App 類別、
APK 內的遊戲檔與原始碼逐位元相同，且解包後的遊戲在 Chromium 中無錯誤啟動；JS↔原生介面以模擬的 `OCNative` 測試過。
