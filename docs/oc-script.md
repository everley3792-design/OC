# 事件腳本格式（OC Script，16.3）

自訂事件是**純文字資料**：寫什麼時候發生、誰參與，然後一步一步寫劇情。腳本**不能執行程式碼**，只能用下面列出的指令；匯入時每一行都會檢查，有錯會說第幾行。

- 存放：角色身上（`c.scripts16`，跟著 `.ocpack` 走；`cast A = self` 就是這個角色）或全島（`save.life.scripts16`）。
- 數量：**不限**。一個檔案可以有很多個事件（每個以 `event` 開頭）。
- 檔案：`.ocs`／`.txt`（純文字）或 JSON：`{ "format": "ocshimeji-script", "scripts": [ { "src": "…" }, … ] }`。
- 遊戲裡：角色工作室 →「事件」分頁：「新增」（積木）、「從範例開始」、「匯入腳本」、「匯出」；積木與原始碼可以隨時切換。
- 執行：和內建事件同一個引擎（`OC.Events`）——一次一個、事件間隔、打擾預算、角色被保留（hold）、可以「跳過」或 ×2；跳過時資料步驟（關係、旗標、回憶…）仍然會做完。

## 範例

```
# 傍晚在海邊，A 約 B 看夕陽
event sunset_talk "夕陽下的約定"
trigger tick
cast A = self
cast B = any
when place beach
when time 17:00-19:30
when rel A B aff >= 40
chance 0.5
once pair
mode cutscene
---
cam A 2.4
move B to A
face A B
face B A
say A "你也來了。"
emote B heart
choice "要一起看完夕陽嗎？"
  "好啊" -> stay
  "我還有事" -> leave
label stay
anim A sit 3
rel A<>B aff +4 fam +2
remember A B "和{B}在海邊看完了夕陽" 0.6
set flag sunset_seen
end
label leave
say B "下次吧。"
feel A down 0.3
```

## 設定（`---` 之前）

| 指令 | 說明 |
|---|---|
| `event 代號 "名稱"` | 開始一個事件（代號：英數、底線、中文） |
| `trigger 種類` | `tick`（隨時，每隔幾秒檢查）、`day`（每天開始）、`relup`（關係變好）、`weather`（天氣改變）、`arrive`（抵達地點）、`wake`（起床）、`meet`（相遇）、`actEnd`（做完一件事）、`pet`（被摸摸）、`manual`（只在試播／手動） |
| `cast A = self｜any｜player｜"名字"` | 角色代號 A–F；`self`＝擁有這個腳本的角色，`any`＝在場、有空的任何人（A 會先用觸發的那位），`player`＝你在操控的角色 |
| `when 條件` | 可以寫很多行（全部成立才發生），條件見下表 |
| `chance 0.3` | 機率（`tick` 觸發時再打 1/4，避免太頻繁） |
| `once`／`once pair`／`once day` | 只發生一次／每一對一次／每天一次 |
| `cooldown 240` | 冷卻（遊戲分鐘） |
| `priority 1–5` | 同一個觸發有多個事件時誰先 |
| `watch "要來看看嗎？"` | 先問你要不要看（不看就在世界裡照常發生） |
| `mode cutscene` | 過場：黑邊、鏡頭跟著、可跳過／×2 |

### 條件（`when` 與 `if` 共用；前面加 `!` 表示「不是」）

`place isle,cafe`・`time 18:00-21:00`・`phase morning,evening`・`weather sunny,rain`・`season spring`・`weekend`・`flag 名字`・`var 名字 >= 2`・`rel A B aff >= 60`（aff fam trust intim conflict）・`rel A B is friend`・`need A food < 30`・`mood A happy,excited`・`trait A shy`・`age A >= 18`・`adult A B`・`near A B 80`・`chance 0.3`・`seen 事件代號`・`choice 1`（上一個選項選了第幾個）

## 步驟（`---` 之後）

| 指令 | 說明 |
|---|---|
| `say A "台詞"` | 說話（會套用該角色的說話方式：自稱、句尾、口頭禪）；`say A cat:greet` 用台詞庫的分類 |
| `think A "…"` | 心裡想（不出聲） |
| `narrate "那天傍晚……"` | 旁白字幕 |
| `move A to 120 80`／`move A to B`／`move A to player`／`move A by 30 0` | 走過去（等走到；後面加 `nowait` 不等）。`run` 用跑的 |
| `face A B｜player｜left｜right｜front｜back` | 面向 |
| `anim A wave 1.5`／`pose A sit` | 動作（秒數）／擺著不動直到下一個動作；不在動作庫的名字會用備用鏈 |
| `emote A heart` | 表情符號：heart ! ? note sweat anger zz … star idea |
| `wait 1.5` | 等待（秒，最多 20） |
| `cam A 2.4`／`cam reset` | 鏡頭（只在觀看中） |
| `fade out`／`fade in`、`bars on`／`bars off` | 淡出淡入、電影黑邊 |
| `sound chime` | 音效（遊戲內建的合成音效名稱） |
| `choice "問題"` 下一行起 `"選項" -> 標籤` | 2–4 個選項；沒在看的時候選第一個 |
| `label 名字`／`goto 名字`／`if 條件 -> 名字` | 分支與跳躍（迴圈有上限，不會卡死） |
| `set flag 名字`／`unset flag 名字`／`set var 名字 3`／`add var 名字 1` | 旗標與變數（全島共用，其他事件的 `when` 讀得到） |
| `rel A B aff +5 trust +2`／`rel A<>B aff +5` | 關係數值（A 對 B／雙方），一次最多 ±20；**只改數值，不改關係類型**；未成年不改親密 |
| `feel A happy 0.6`、`need A fun +10` | 情緒、需求 |
| `remember A B "一起看了夕陽" 0.6` | 回憶（固定 key，不會重複寫入） |
| `end` | 結束 |

文字裡可以用 `{A}`…`{F}`（角色名字）、`{player}`（你）、`{place}`（地點）、`{var:名字}`（變數值）。

## 規則與限制

- 不能給物品或星幣（自訂內容不產生獎勵）。
- 不能改關係類型（成為戀人等仍然只能經玩家同意）。
- 一個事件最長 5 分鐘；任何參與者離開場景就結束；試播不受條件限制、不記錄「已發生」。
- 匯入時有錯的腳本會先停用，修好才能啟用；只有警告（例如動作名不在動作庫）不影響使用。
