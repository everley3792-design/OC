# 任務、角色請求與進度事件（第六階段）

核心循環：**生活活動產生成長、成長帶來新體驗、體驗累積收藏與回憶、回憶影響未來生活。**
任務只是靈感，不是工作：沒有連續登入獎勵、沒有過期懲罰；完成但還沒領的任務會一直保留。

## 1. 單一進度事件 `OC.Progress`（`game/js/play/progress.js`）
所有玩法只回報**一個**事件；任務、角色請求、人生目標、長期挑戰、成就都聽同一個事件流，不需要各自的計時器。

```js
OC.Progress.emit('fish', { item: 'f_koi', oc: '<ocId>', water: 'pond', near: ['<ocId>', …] })
```
自動補上：`place`（目前地點）、`hour`、`phase`、`wx`、`day`、`dayKey`；有 `item` 時再補 `kind`、`rarity`、`temp`、`flavor`、`tags`。
離線補算（`OC.Sim.catchUp`）期間**不會**送出事件 → 離線時間不給任何任務進度或獎勵。

| 事件 | 來源 | 主要欄位 |
|---|---|---|
| `eat` | `OC.Use.feed`（玩家餵）、`Game.eat` | oc, item, lv（−2..2）, first, by:'player', drink |
| `gift` `play` `wear` `pet` `chat` | `OC.Use` / 互動選單 | oc, item |
| `buy` `sell` | `OC.Shops.buy`、`Game.sell` | shop, item, count |
| `fish` `cook` `critter` | 小遊戲 | item, stars, water, near |
| `forage` `pick` `shake` | 採集、撿拾、搖樹 | item, place |
| `plant` `water` `harvest` | 菜園 | item, plot, by |
| `place` | 佈置（按「放這裡」） | item, place |
| `visit` | 玩家抵達地點 | place, first, fresh |
| `arrive` | 任何 OC 抵達地點（包含不在身邊的） | oc, place |
| `act` | 活動結束（`OC.Mind.record`，含抽象模擬） | oc, act, place, min |
| `social` | 社交結果、共同活動結束 | oc, other, ocs, kind, joint |
| `discover` | 第一次取得物品（`OC.Tx` 的 first） | item |
| `skillUp` `rel` `event` | 技能升級、關係升級、事件完成 | oc, skill, lv / other, to / id |
| `request` `quest` `aspiration` `achieve` | 本階段的系統 | … |

## 2. 目標格式（任務、請求、人生目標、挑戰共用）
```js
{ ev: 'fish', n: 3, w: { place: 'beach', rarity: '>=3', item: ['f_koi', 'f_carp'], oc: 'self' }, distinct: 'item', day: true }
```
- `ev` 可以是陣列；`w` 的值：字串＝相等、陣列＝其中之一、`'>=3'`＝數字比較、`'self'`＝擁有這個目標的 OC。
- 特殊鍵：`oc`（也比對 `ocs`）、`other`、`near`（事件發生時在場的 OC）、`flavor`（食物口味 > 0）、`tag`。
- `distinct`：計算不同的值（例如 3 種不同的魚）；`day`：同一天內完成。

## 3. 任務 `OC.Quests`（`game/js/play/quests.js`，資料在 `OC.PlayData.QUESTS / CHALLENGES`）
| 類型 | 數量與節奏 | 說明 |
|---|---|---|
| 每日 daily | 每天 4 個，依標籤分散（自然、照顧、社交、商店、探索、創作、成長） | 依真實日期更換；完成但未領的保留 |
| 每週 weekly | 每週 3 個（ISO 週） | 鼓勵嘗試不同玩法（不同種類計數） |
| 地點 place | 每個去過的地點每天 1 個（最多 3 個） | 給探索不同場所的理由 |
| 事件 event | 天氣／時段成立時才出現 | 雨天熱飲、月光水母、螢火蟲、黃昏海邊；條件結束就消失，無懲罰 |
| 隱藏 hidden | 不列出，只有提示 | 玩出來才「發現」並可領取 |
| 長期挑戰 | 累計三階（例：釣魚 10／30／80） | 下一階在領取後開放；最後一階給稱號 |

- 提供前先檢查 `req`：`open`（地點開放）、`kinds`（擁有或商店買得到）、`chars`（OC 數量）→ **不會要求未解鎖或不存在的內容**。
- 領取：`OC.Quests.claim(key)` → `OC.Tx` key `q:<id>@<日期>`（挑戰 `chal:<id>:<階>`）→ 重開、連點、事件重播都不會重複入帳。
- 相容：`OC.Game.todayQuests()/claim()/progress()` 仍可用（轉到新系統）。

## 4. 角色請求 `OC.Requests`（`game/js/play/requests.js`，資料在 `OC.PlayData.REQUESTS`）
流程：OC 在玩家附近、沒在忙／睡覺時，依個性、需求、口味、關係、近期經歷產生想法 → 頭上出現 💭 泡泡 → 點泡泡（或互動選單頂端）→ OC 用自己的聲線說出來（害羞的小聲、活潑的興奮、固執的不肯承認…）→ **好啊／等一下／這次不行**。

| 類型 | 依據 | 完成方式 | 協助按鈕 |
|---|---|---|---|
| taste 想吃某樣東西 | 喜歡的或沒吃過的食物、肚子 | 餵牠那樣食物 | — |
| sweet 想吃甜的 | 口味傾向 | 任何甜的食物 | — |
| toy 想玩玩具 | 活力、娛樂需求 | 陪牠玩那個玩具 | — |
| shell / flower / lost | 好奇、自然、溫柔… | 送牠指定種類的東西 | — |
| meet 想認識誰 | 社交、和對方不熟 | 兩人聊天或一起活動 | 幫忙介紹 |
| visit 想去某地 | 好奇、沒去過或喜歡的地方 | 牠抵達那裡 | 帶牠去 |
| learn 想學東西 | 熱愛閱讀、思考 | 在圖書館讀書 | 帶牠去 |
| rest 想睡午覺 | 精力低、愛睡 | 午睡或睡覺 | 安排午睡 |
| outfit 想換造型 | 文藝、創意 | 穿上衣服或飾品 | — |
| together 想一起釣魚 | 自然、悠哉 | 在牠身邊釣到魚 | — |

- 接受：OC 依個性做出反應（演出）；進行中可在「日常 › 請求」查看怎麼幫。
- 等一下：泡泡暫時收起。婉拒：符合個性的小反應、同類請求 1 天冷卻，**不扣好感**。
- 完成：演出（走到你身邊、鏡頭拉近、角色專屬的動作與台詞）→ 獎勵（`req:<id>`，一次）→ 好感、情緒、回憶（`data.req`）→ 有時附上謝禮。
- 後續：完成後有機會在之後提出相關的請求（`FOLLOWUPS`），聊天時會提起你幫過的事；同一類請求完成 3 次會「提議」新興趣（玩家同意才套用）。
- 過期：沒接的請求 6 遊戲小時後消失；進行中的 1–2 遊戲天後 OC 說「沒關係了」——都沒有懲罰。

## 5. 擴充
- 新任務：在 `QUESTS` 加一筆（`id type tag zh d goal reward req when`）。
- 新請求：在 `REQUESTS` 加 `w(c)`（多想要）、`pick(c)`（具體內容或 null）、`goal`（用 `{item}` 等變數）、`reward`、`life`、`perf`、`help`。
- 新事件：在遊戲行為處呼叫 `OC.Progress.emit(名稱, 資料)`，所有系統就能用。
