# 內容格式（2.1.0 第一版）

事件、互動、劇情都用同一種資料格式（JSON）。內建的 23 個日常事件已經是這個格式（`core/sim/.../social/DailyContent.kt`），之後的內容庫（第三階段）和你自己做的事件包也會用它。

裡面只有資料，沒有可以執行的程式。每一筆都要通過驗證器（`Content.problems`）才會被使用。

## 一筆事件
```json
{
  "id": "sunset",
  "name": "一起看夕陽",
  "category": "daily",
  "description": "",
  "hours": [17, 19],
  "script": "A:{對方}，你看，夕陽。@LOOK / B:好漂亮……@LOOK / A:每天都看得到，可是每天都不一樣。#sparkle",
  "like": 3,
  "fun": 10,
  "closeup": false,
  "when": { "furniture": ["window"] },
  "next": "",
  "nextAfterDays": 1,
  "cooldownDays": 1,
  "repeatable": true,
  "enabled": true
}
```

| 欄位 | 意思 |
|---|---|
| `id` | 唯一的名字（英數字） |
| `name` | 顯示的名字 |
| `category` | `daily`、`special`、`romance`、`group`、`town`、`custom` |
| `hours` | 遊戲時間 `[開始, 結束)`，可以跨過半夜（例：`[21, 2]`） |
| `script` | 對話：用「 / 」分句，每句以 `A:` 或 `B:` 開頭；`@POSE` 是動作，`#特效` 是頭上的效果；`{對方}`、`{物}`、`{第三人}` 會換成名字或東西 |
| `like` | 兩人好感的變化（-10～10） |
| `fun` | 樂趣增加多少 |
| `closeup` | 要不要大頭特寫 |
| `when` | 條件（見下面），全部都要成立 |
| `next`、`nextAfterDays` | 之後可能接著發生的事件，至少隔幾天；同一對才會接上 |
| `cooldownDays` | 同一個事件隔多久才能再發生 |
| `repeatable` | `false`：只發生一次 |
| `enabled` | `false`：先停用 |

### 條件 `when`
| 欄位 | 意思 |
|---|---|
| `weather`、`season` | 天氣（`sunny`、`cloudy`、`rain`、`snow`、`storm`、`fog`）、季節（`spring`…`winter`） |
| `furniture` | 家裡要有其中一種家具 |
| `furnitureCount` | 某種家具剛好幾件（例：`{"tub": 1}`） |
| `minPeople`、`maxPeople` | 家裡的人數 |
| `a`、`b` | 兩個角色各自的條件（見下面） |
| `rel` | A 對 B 的關係：`minLike`／`maxLike`、`minFamiliar`／`maxFamiliar`、`minConflict`、`kinds`（關係種類）、`minStage`（熟悉階段 0～4） |
| `after`、`notAfter` | 某個事件發生過／還沒發生過 |
| `item` | 收納裡要有某樣東西 |

角色條件（`a`、`b`）：
- `traits`／`notTraits`：特質；
- `tags`：標籤；
- `axisMin`／`axisMax`：性格軸 `OUTGOING`、`ACTIVE`、`DILIGENT`、`FRANK`、`GENTLE`；
- `moodMin`／`moodMax`、`hasMood`：心情；
- `needBelow`：需求低於多少（`FOOD`、`ENERGY`…）；
- `skillMin`：技能；
- `cryMin`：愛哭程度；
- `adult`：是否成年；
- `likesFood`：很愛吃。

**規則（永遠成立）**：`category` 是 `romance` 的事件，只會發生在兩位成年角色之間，而且那個世界要打開戀愛。

## 驗證器會擋下的
- 沒有 id、id 重複、沒有名字；
- 不認得的分類、天氣、季節、家具、特質、性格軸、需求；
- 時間不是兩個 0～24 的數字；
- 對話讀不出來，或有不是 `A:`／`B:` 開頭的句子；
- 好感變化超出 -10～10；
- 互相矛盾：最少人數比最多還多、最低好感比最高還高、同一個特質「要有」又「不能有」；
- 指到不存在的後續事件或前置事件。
