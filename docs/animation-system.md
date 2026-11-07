# 逐格動畫系統規格

程式：`game/js/char/anim.js`（資料與播放）、`game/js/char/render.js`（繪製與混合）、`game/js/ui/animstudio.js`（工作室）、`game/js/world/world.js`（場景整合）。

## AnimDoc
```js
{ id, name, owner (角色 id | null 共用), action ('walk' 或任意自訂名稱), category: base|overlay|emote|custom,
  dir: any|front|back|left|right,
  fps, speed, loop: loop|once|pingpong, repeat (0 = 無限),
  w, h,                                               // 影格畫布尺寸
  layers: [{ id, name, visible, opacity, cells:[assetId|null …] }],   // 下 → 上，影格數 = cells.length
  durs: [ms|null …],                                  // 每格時長；null = 1000/fps
  anchor: {x, y},                                     // 腳底點（影格 px）
  offset: {x, y}, hitbox: {x, y, w, h}, points: { head: {x, y} },
  priority (0–10), interruptible, conditions: { when: always|day|night|rain },
  events: [{ frame, type: sound|particle|emote|bubble|use|done|custom, data }],
  overlay: { suppressIn: [action…] } }
```

## 播放
`frameAt(doc, t, speed)`：支援每格時長、FPS、播放速度、循環／一次／來回（ping-pong）、指定循環次數。
已測：`loop 0123012`、`pingpong 012321012`、`once 0123333`、首格 300 ms `0001230`。
`eventsBetween(doc, from, to)` 回傳跨過的影格事件（工作室播放時會顯示；之後提供給生活模擬）。

## 選擇動畫（fallback）
`resolve(char, action, dir)`：
1. **方向**：指定方向 → 對側鏡像（左 ↔ 右）→ `any` → 正面 → 任何方向。
2. **動作**：`OC.Chars.ACTIONS` 的備用鏈（例如 跑步 → 行走 → 待機、睡覺 → 坐下 → 待機），最後是待機。
3. 都沒有 → 使用內建角色骨架（rig）的程序化動作，因此不會出現空白、瞬移或不相干的動作。

## 混合規則
- 主要動作一次一個；`World.setAction(actor, action, {dur, priority})`，低優先級不能打斷高優先級，≥5 的動作會暫停移動。
- 移動時自動切到 `walk`／`run`；坐下、吃飯、睡覺、打招呼等由互動觸發。
- **疊加動畫**（category `overlay`，例如 `blink`）：畫在主動作上方；`suppressIn` 中的狀態（預設睡覺）不疊加。已用像素測試確認待機會疊加、睡覺不疊加。
- 骨架角色：眨眼、呼吸、表情、歪頭在骨架內合成，走路時仍會眨眼與動耳朵，睡覺時固定閉眼並放慢呼吸。

## 與 3D 場景整合
- 角色是垂直看板；每個角色一張畫布，只在「影格／方向／姿勢」改變時重畫（`CharRender.plan` → `key`）。
- **尺寸校正**：每個角色一個參考高度 `appearance.refH`（影格 px，取自待機或第一個動作的內容高度），所有動作共用同一縮放 → 切換動作不會突然變大變小。
- **腳底對齊**：影格以 `anchor` 對準地面點；`offset` 可微調；地形高度、坡道、接觸陰影、遮擋剪影沿用第二階段。
- **四方向**：依移動方向決定 front/back/left/right（含 80 ms 遲滯避免抖動）；左右鏡像時看板做 160 ms 擠壓轉身，不會瞬間翻面。
- 鏡頭固定不旋轉（第三輪定案），所以不需要「視角 → Sprite 方向」的換算。
- 「在小島測試」：用未儲存的工作副本暫時替換目前角色的動作，回到工作室時還原，不寫入存檔。

## 工作室功能
預覽／時間軸／設定三種工作區（小螢幕優先保持預覽大小）；匯入多張圖片（自然排序）、GIF/APNG/WebP、Sprite Sheet；新增空白格、複製、刪除、左右移、長按拖曳排序、反轉、區間選取、複製／貼上區間、每格時長（批次）、替換、在繪畫工坊繪製（附前一格洋蔥皮與其他圖層參考）；圖層（新增、刪除、排序、顯示、透明度、命名）；洋蔥皮前 1–3／後 0–2 格；角色大小參考；預覽鏡像；錨點（點選、拖曳、自動偵測）；碰撞區域與頭部附著點自動偵測；事件；優先級、可否中斷、條件；套用到角色；匯出 `.ocpack` 與 Sprite Sheet PNG；80 步復原／重做；草稿自動保存與當機恢復；離開未儲存提示；共用動作「另存專屬版本」以免改到其他角色。
