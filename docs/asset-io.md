# 素材匯入／匯出規範

程式：`game/js/char/io.js`（解碼、ZIP、素材包）、`game/js/char/assets.js`（儲存）、`game/js/ui/library.js`（介面）。

## 支援格式
| 格式 | 處理 | 備註 |
|---|---|---|
| PNG / JPEG / WebP | 靜態圖 | 依檔頭判斷格式（不只看副檔名） |
| GIF（動態） | `ImageDecoder`（WebCodecs）；沒有時用內建 GIF 解碼器（LZW、透明色、disposal、interlace） | 保留每格時長 |
| APNG | `ImageDecoder` | 系統不支援時明確提示「只讀取到第一格」 |
| 動態 WebP | `ImageDecoder` | 同上 |
| 多張連續圖片 | 多選匯入，依檔名**自然排序**（1, 2, 10） | 可反轉順序 |
| Sprite Sheet | 欄／列或格寬高、邊界、間距、橫向／縱向順序、略過空白格；預設以正方形格推算 | 即時預覽 |
| ZIP | 讀取其中所有圖片（store / deflate），自然排序 | 略過 `__MACOSX`、隱藏檔 |
| `.ocpack` | OC Shimeji 素材包 | 見下方 |
損壞或不支援的檔案會顯示原因（例如「圖片已損壞或無法解碼」、「ZIP 檔已損壞」、「不是 OC Shimeji 角色包」），不會假裝匯入成功。

## 匯入選項
去除背景（角落顏色）、裁掉透明留白、縮放、旋轉 90°、左右鏡像；匯入成「個別素材」「動畫影格」或「角色部件」。所有影格放到同一尺寸的畫布、底部置中，維持一致的腳底線。

## 限制（手機記憶體）
單檔 40 MB、單次 240 格、單張最長邊 1024 px（超過會等比縮小，原始比例不變）、PNG 8 MB；解碼後的圖片 LRU 快取上限約 6400 萬像素，超過自動釋放。

## 儲存
IndexedDB `oc-assets`：`blobs`（PNG）、`thumbs`（96 px 縮圖）、`meta`（id、種類、名稱、尺寸、大小、擁有者 owners[]、時間）、`drafts`（繪圖／動畫自動保存）。
擁有者為空 = 共用素材；角色專屬素材以角色 id 標示。素材庫提供：重新命名、取代（所有引用處一起更新）、複製、改為共用／專屬、匯出 PNG、刪除（顯示仍被哪些角色或動作使用）、遺失素材檢查與清除引用、容量統計。

## `.ocpack`
ZIP（store）：
```
manifest.json   { format:'ocshimeji-pack', version:1, app, kind: character|characters|animation|backup, created,
                  chars:[Character], animations:[AnimDoc], assets:[{id, file, w, h, kind, name, size}], progress? }
assets/<id>.png
```
- 匯出：單一角色、多角色群組、單一動作、自選備份（角色＋可選遊戲進度）。會自動收集角色用到的所有動作與圖片；有遺失素材時拒絕匯出並說明。另可匯出單張 PNG 與 Sprite Sheet PNG。
- 匯入前檢查：格式、版本（較新版本會要求更新 App）、manifest 解析、每個素材檔是否存在、動作引用的圖片是否都在。
- 匯入方式：**另存新角色**（全部換新 id，永不覆蓋）、**合併**（已存在的略過）、**取代**（同 id 覆蓋，需再次確認）。重名時加註「（匯入）」。
- Android：匯出經原生 `shareFile`（存在 cache/share，透過 `ShareProvider` 分享，不需儲存權限；一小時後清理）；匯入使用系統檔案選擇器（支援多選、ZIP/ocpack）。取消、失敗、容量不足、重複檔案都會提示。
