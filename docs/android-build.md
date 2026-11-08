# Android 建置說明

App：**OC Shimeji**　套件名稱 `app.ocshimeji`　版本 `0.7.0-alpha`（versionCode 10）
minSdk 26（Android 8.0）／**targetSdk 35（Android 15）**／直向／完全離線（遊戲從 APK assets 載入，不需要開發伺服器）
桌寵、通知、提醒、小工具、App 情境對話的原生設計見 [`docs/android-native.md`](android-native.md)，權限見 [`docs/permissions.md`](permissions.md)。

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
0. `buildFwExtras`（第七階段）：`aapt package -x` 把 `android/tools/framework-extras/` 編成一個只含 `android:foregroundServiceType`（公開 id `0x01010599`，以 javap 對照 API 35 的 `android.R$attr` 確認）的框架屬性包，**只當作第二個 `-I`，不會打包進 APK**。
   原因：離線 aapt 連結用的是 API 23 的 platform jar，它的屬性表沒有 Android 10+ 才有的 `foregroundServiceType`；Robolectric 的 API 35 jar 的 `resources.arsc` 太新，aapt/aapt2 都讀不了。
   Manifest 用 `android:foregroundServiceType="@integer/fgs_special_use"`（`res/values/integers.xml`，`0x40000000` = `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`），AGP 與離線管線都能解析，編出來的值和 `"specialUse"` 相同。
1. `genRes`：`aapt` 由 `res/` + Manifest 產生 `R.java`，並產生 `BuildInfo.java`（版本號）。
2. `compileKotlin`：app + `core:pet`/`core:anim`，compileOnly 對 Robolectric android-all（API 35 介面）。JVM 1.8、`-Xlambdas=class`（給 dx 用）。
3. `desugar`：**ProGuard 7.10**（Maven Central）處理 app + 所有執行期 jar：把 Java 8 `invokedynamic` lambda 改寫成一般類別（`-target 1.7`），並移除用不到的 Kotlin 標準庫。規則：`app/proguard-offline.pro`（不混淆、不最佳化、保留 `app.ocshimeji.**` 與 `@JavascriptInterface`）。
   `checkNoIndy`：產物中若還有 `LambdaMetafactory`／`StringConcatFactory` 就**讓建置失敗**。
   原因：`dx` 不會改寫 lambda，會原樣輸出成 `invoke-custom`，但 Android 執行環境沒有 `java.lang.invoke.LambdaMetafactory` → 執行到就閃退（0.2.0 的問題，Kotlin 標準庫本身就含有這種 lambda）。正式的 D8/R8 只在 Google Maven，本環境無法下載。
4. `dex`：`dalvik-exchange --min-sdk-version=26` → `classes.dex`。
5. `syncGame` + `packageRes`：把 `../game`（排除 tests、*.md）放進 `assets/game/`；字型/圖片不壓縮（`-0`）。
6. `addDex` → `zipalign -p 4` → `apksigner`（v2 + v3 簽章）。
7. `verifyDebugApk`：`apksigner verify`，並檢查**編譯後**的 Manifest：targetSdk = 35、`OverlayPetService` 有 `foregroundServiceType`（指向整數 `0x40000000`）、有 `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` 與 `FOREGROUND_SERVICE_SPECIAL_USE`、沒有無障礙服務或 `QUERY_ALL_PACKAGES`。任何一項不符就讓建置失敗。

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
android/app/build/outputs/apk/debug/oc-shimeji-0.7.0-alpha-debug.apk
```
一份副本放在 `deliverables/apk/oc-shimeji-0.7.0-alpha-debug.apk`（含 SHA-256）。

## 4. 安裝

```bash
adb install -r deliverables/apk/oc-shimeji-0.7.0-alpha-debug.apk
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
# → android/app/build/outputs/apk/release/oc-shimeji-0.7.0-alpha-release.apk
```
AGP 路徑（`build.gradle.kts`）讀同樣四個環境變數。
本環境已用一把**拋棄式測試金鑰**（存放在版本庫外、用完即刪）實際跑過 `assembleRelease`，`apksigner verify` 通過。
targetSdk 已是 35；上架 Google Play 還需要 AAB（需要 AGP / bundletool，本環境無法下載）與 Play Console 的 specialUse 前景服務說明（見 `docs/permissions.md`），屬於後續階段。

## 6. 權限

完整說明（用途、何時請求、如何撤銷、刻意**不**使用的權限）：[`docs/permissions.md`](permissions.md)。
摘要：`SYSTEM_ALERT_WINDOW`、`FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE`（Android 14+ 類型 specialUse）、`POST_NOTIFICATIONS`（13+）、
選用的 `PACKAGE_USAGE_STATS`（App 情境對話，只知道前景 App 名稱）、`SCHEDULE_EXACT_ALARM`（只在玩家要「準時提醒」且在系統允許時）、`RECEIVE_BOOT_COMPLETED`（重開機後重新登記玩家設定的提醒，不會自動啟動桌寵）。
不需要網路、儲存空間、相機、無障礙服務或 `QUERY_ALL_PACKAGES`。

## 7. 現場診斷（不需要 adb）

0.2.1 起，App 打不開時會自己說明原因，而不是直接消失：
- 任何閃退都會記錄下來（`OcApp.attachBaseContext` 安裝），**下次開啟時顯示錯誤畫面**，可「複製／分享錯誤資訊」、「重新開啟」、「用省電模式重新開啟」。
- WebView 繪圖程序當掉（GPU/WebGL/記憶體）時不再拖垮整個 App（`onRenderProcessGone`），改顯示錯誤畫面。
- 開啟前檢查系統 WebView：找不到、或版本低於 Chromium 88 → 說明並提供「前往更新 WebView」。
- 網頁端開機防護（舊式 JS，任何 WebView 都能執行）：缺少功能、沒有 WebGL、啟動例外、20 秒未完成啟動 → 交給原生錯誤畫面。
- 弱機（≤3 GB 記憶體或 ≤4 核）首次啟動自動使用省電模式；`?safe=1` 強制省電。

有 adb 時也可以：`adb logcat -s OCDiag OCWeb AndroidRuntime chromium`

## 8. 未在本環境驗證（必須實機確認）

本雲端容器沒有 Android 模擬器或實機，以下**尚未驗證**（完整清單與步驟：[`docs/compat-test-plan.md`](compat-test-plan.md)）：
- 安裝、啟動、WebView 載入、WebGL 在實機 GPU 上的效能與 60fps。
- 第七階段的一切原生行為：懸浮視窗、Shimeji 移動、觸控（點、雙擊、長按、撫摸、拖曳丟出）、觸控穿透、泡泡與選單、通知按鈕、
  Android 14/15 前景服務類型在系統上的實際接受、螢幕旋轉／鎖定／低記憶體／撤銷權限、使用情況存取、鬧鐘、開機重新登記、主畫面小工具。
- AGP 建置路徑。

已驗證：Gradle 建置成功、APK 簽章（v2/v3）、zipalign、編譯後 Manifest（上面第 7 步）、dex 內含全部 App 類別、
APK 內的遊戲檔與原始碼逐位元相同；Kotlin 桌寵核心（Shimeji 行為、手勢、動畫時序、台詞節奏、App 規則、多隻互動）以 JVM 單元測試驗證；
JS↔原生介面以模擬的 `OCNative`（`game/tests/pet/mock-native.js`，與 `NativeBridge.kt` 同一份約定）測試過。
