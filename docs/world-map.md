# 世界地圖與地點資料架構（第五階段）

原則：**地點提供活動、活動影響角色、角色累積記憶、記憶改變未來生活。**

## 1. 三層資料
| 層 | 檔案 | 內容 |
|---|---|---|
| 地點登記 | `game/js/world/places.js`（`OC.Places.P`） | id、中文名、類型、地圖座標、父地點（室內）、可裝潢、設施清單、AI 可做的活動、可發現物（探索進度）、鎖定原因 |
| 場景 | `game/js/world/areas.js`、`areas2.js`（`OC.Areas[id]`） | 3D 模型組裝 `build(ctx)`、可走範圍 `walk(x,y)`、層級／高度解析函式、出入口 `exits`／`doors`、可互動物件、`spots`、採集點、小生物點、釣魚點、室內牆線 `wallY` |
| 存檔 | `save.places`、`save.rooms`、`save.garden`、`save.world` | 造訪紀錄、每個地點各自的家具配置、菜園、每日採集與小生物狀態 |

場景只在進入時建立（`OC.World.loadArea`），離開時釋放幾何、材質、看板紋理（`disposeTree`，共用快取除外）；**不會一次載入所有地圖**。

## 2. 地點一覽（0.5.0-alpha）
| id | 名稱 | 類型 | 室內 | 可裝潢 | 主要設施／活動 |
|---|---|---|---|---|---|
| `isle` | 晴日島 | 住宅 | | ✔ | 我的家門口、中央廣場、菜園 ×4、果樹 ×7、花圃、雜貨攤、碼頭釣魚、長椅、蝴蝶 |
| `home` | 我的家 | 住宅 | ✔（父：isle） | ✔ | 床、小廚房（料理）、書櫃、自由佈置（含掛牆物品） |
| `street` | 晴日商店街 | 商店街 | | | 食品店、服裝店、家具行、禮品屋、每日市場（2 攤）、咖啡館門口、圖書館門口、長椅 |
| `cafe` | 雲朵咖啡館 | 咖啡館 | ✔（父：street） | | 點餐櫃台（可內用）、廚房（料理）、雙人桌 |
| `library` | 葉影圖書館 | 學習場所 | ✔（父：street） | | 書櫃 ×4（閱讀）、書桌（讀書，提升閱讀技能） |
| `forest` | 苔光森林 | 自然探索 | | | 採集點 ×6（莓果、香草、橡實）、池塘釣魚、小生物（瓢蟲、甲蟲、螢火蟲、蝸牛、蝴蝶） |
| `beach` | 星砂海灘 | 海灘 | | | 碼頭與海邊釣魚、潮池、撿貝殼（每日）、沙灘毛巾、沙堡、螃蟹 |
| `hill` | 風車丘 | 自然 | | | **未開放**（地圖上以鎖頭標示，無法進入） |
| `fair` | 彩虹遊樂園 | 娛樂 | | | **未開放** |

使用者要求延後的「其他島嶼／旅行」仍以「未開放」顯示，不做假入口。

## 3. 地點登記欄位
```js
beach: {
  zh: '星砂海灘', type: 'beach', area: 'beach',          // OC.Areas 的 key
  map: { x: 0.78, y: 0.17 }, icon: 'sparkle', col: '#4FC3E8',   // 世界地圖（原創手繪 canvas）
  parent: undefined, interior: false, decor: false,      // 室內地點有 parent；decor＝可佈置
  d: '…', facilities: ['碼頭釣魚', …],                   // 地圖卡片顯示
  acts: ['fish', 'observe', 'play', …],                  // AI 在這裡可以做的活動（跨地點選擇用）
  finds: ['shell', 'f_rainbow', …],                      // 探索進度＝其中已發現（save.seen）的比例
  locked: false, why: null,
}
```
`OC.Places`：`get / list / open / top / travelMin / visit / progress / affinity / room / plot / plant / water / harvest / forage / critterAt / fishRoll`。

## 4. 場景（Areas）欄位
- `exits`：可互動 `{ type:'exit', to:'map'|'<place>' }`；室內門 `to: parent`。
- `doors: { <from>: {x,y} }`：從某地點過來時出現的位置（例如從咖啡館出來會在商店街的咖啡館門口）。
- 室內模板 `interior(o)`（`areas2.js`）：房間矩形、牆、窗、門、`wallY`（掛牆物品吸附）、點光源（夜間變亮）、`decor` 可佈置範圍。
- 互動物件類型：`exit / shop / counter / fishing / stove / plot / forage / critter / bookshelf / towel / bench / furn`，以及第二階段的 `tree / home / npcHome / travel`。
- 生活引擎使用：`Brain.rebuild()` 從互動物件與家具產生「可供性」（含位子、容量、動詞）；新地點只要加物件就會被 OC 使用。

## 5. 移動與轉場
- `OC.WorldUI.travel(to)`：淡出 → 顯示地點名稱 → `OC.App.loadArea(to, 門口位置)` → 淡入。**同一個 WebGL renderer**，不重建 UI、AI、動畫系統（測試 1c、10a、12）。
- 出現位置：`area.doors[from]` → 室內 `spawn` → 場景預設。
- 世界地圖（探索頁）：地點卡片（類型、探索進度、設施、今日特色、在場 OC）、「前往」按鈕、「大家在哪裡」列表（每個 OC 的所在地與活動，可直接前往）。

## 6. 跨地點的 OC
- 每個 OC：`life.loc`（所在地點）、`life.trip { from, to, act, eta }`（路上）、`life.cur`（抽象活動）、`life.places { id: { visits, last } }`、`life.log`（「前往…」紀錄）。
- 在玩家身邊：完整 Utility AI（`brain.js`）；`travelCands()` 依需求、個性、興趣、作息、地點偏好（`Places.affinity`：個性＋該地點的回憶感受）、路程成本產生「去別處做某事」的選項 → 走到出口 → `depart()`。
- 不在玩家身邊：`abstractStep()` 低頻模擬，同樣的評分加上地點列表；到達時 `noteArrival()` 第一次來會寫回憶。
- 玩家走進 OC 所在的地點：`syncPresence()` 每秒同步；路上的 OC 在 `eta` 後從門口走進來並繼續原本的活動（測試 2e/2f）。
- 離線補算仍只走 `OC.Sim.catchUp()`（不觸發事件、不給獎勵）。

## 7. 地點事件與回憶
- 事件觸發 `arrive`（含 `when.place`）、`once: 'self+place'`；內建：第一次造訪、咖啡館約會、海邊夕陽（`LifeData.EVENTS`）。
- 地點回憶：`remember({ place: 'place:<id>' })`；`Mind.placeFeel()` 回饋到 `Places.affinity()` → 喜歡的地方更常去。

## 8. 新增一個地點
1. `areas2.js`：建一個 `OC.Areas.<id>`（或用 `interior()`），登記碰撞、出口、可互動物件。
2. `places.js`：在 `P` 加登記（`acts`、`finds`、`facilities`、`map`）。
3. 若有新活動：`LifeData.ACTS` 加活動（效果、動畫備用鏈）並在 `brain.js` 的可供性提供 verb。
4. 跑 `node game/tests/world/run.js 1 2 12`。
