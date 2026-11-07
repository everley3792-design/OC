# 生活資料格式（第四階段，存檔 schema v3）

程式：`game/js/life/*.js`。存檔仍是一份 JSON（`localStorage` 的 `oc.save.v1`），圖片仍在 IndexedDB。
v2（第三階段）存檔載入時由 `store.js` 的 `migrateV2()` 自動升級；只新增欄位，不刪除舊資料。舊的 4 種需求數值保留，新需求由 `OC.Chars.normalize()` 補預設值。v1 遷移（`migrateV1`）仍保留。

## 共用：`save.life`
```js
life: {
  v: 1,
  clock: { gm, day0 },            // 遊戲時間（遊戲分鐘）；day0 = 進入「循環」模式時的第一天
  lastReal,                        // 上次模擬的現實時間（ms）→ 離線補算的依據（只補算一次）
  offline: { at, min, simulated, capped, reason },   // 最近一次離線補算的結果
  rel: { 'a>b': Relationship },    // 有方向的關係（見下）
  flags: { name: gm },             // 劇情／對話旗標
  said: { charId: { lineId: gm } },// 對話冷卻記憶
  ev: { last: { 'event|charId': gm }, once: { key: gm }, lastAny: ms, log: [...], items: { day: true } },
  dlg: { custom: [Line], off: [lineId], events: [Event] },   // 玩家自訂內容
  notices: [{ id, kind: 'confirm', ev, a, b, title, body, ok, at }],   // 需要玩家決定的事
  settings: { autonomy: 'full'|'lessSocial'|'fewerEvents'|'restricted'|'paused', playerAuto, deny: [actId], lockRel, growth, bubbles,
              romance: { enabled: false, adult: { id: true }, forbid: ['a|b'], fixed: { a: b } } },
}
settings.time = 'real' | 'cycle' | 'morning' | 'noon' | 'dusk' | 'night'   // 'cycle' 為第四階段新增
settings.timeSpeed = 1 | 2 | 5 | 10                                         // 只用於 cycle
```

## 每個 OC：`char.needs` 與 `char.life`
```js
needs: { food, energy, sleep, fun, social, comfort, interest, active, mood }   // 0–100，100 = 滿足
life: {
  emo: { list: [{ id, k, at, cause, who, need? }], dom, domAt, recent: [{ id, cause, who, gm, k }], cd: { 'emo|cause': gm } },
  mem: { recent: [Memory], long: [Memory], seq },
  rec: { act: { actId: { n, gm, last, ctx: { rain: n, night: n, … }, place: { placeId: n } } },
         seq: { 'eat>rest': n }, place: { id: n }, placeZh: { id: '長椅' }, lastAct, social, nightAwake, visit: { cell: gm } },
  habits: [{ id, rule, zh, why, at, place?, fx, edited? }],      // 經玩家同意的後天習慣
  wishes: [{ id, type, kind: 'short'|'mid'|'long', text, other?, item?, skill?, n?, prog, born, until, state: 'active'|'done'|'expired', by? }],
  skills: { reading, garden, sport, cook, social },               // 經驗值；等級 = floor(√(xp/15))，最高 10
  routine: { sleep: null | 小時, wake: null | 小時 },              // null = 依個性自動
  player: { aff, fam, last, petAt },                              // 和玩家的關係
  cur: { act, slot, place, placeZh, until, t0, abstract? },       // 進行中的活動（重開後繼續）
  pos: { area, x, y },                                            // 島上位置（重開不會跳回原點）
  log: [{ gm, text }],                                            // 不在畫面時的生活紀錄
  socialAt, greetAt, giftAt, apolAt, laterWith: { charId: gm }    // 社交冷卻
}
growth: { suggestions: [Suggestion], locked: [value], history: [...], rejected: { value: 解除時間 gm }, muted: ['trait'|'habit'|'hobby'] }
```

### Memory
`{ id, gm, t, day, place, type, who: [charId], emo, imp (0–1), text, data, key?, pin? }`
類型：`milestone` `social` `event` `activity` `player` `growth` `wish` `conflict` `discover`。
`key` 防止重複寫入（同一個事件、同一次離線摘要只會有一份）。

### Relationship（a 對 b，有方向）
`{ fam, aff, trust, intim, conflict, shared: [興趣], mems, type, fixed, custom, since (遊戲日), last, talks }`
自動類型：陌生 → 認識（fam≥6）→ 朋友（aff≥35、fam≥25）→ 摯友（aff≥70、trust≥55、fam≥50）；對手（conflict≥45、aff<25）。
家人、戀人、伴侶、自訂只能由玩家設定或經玩家確認，`fixed` 之後不會自動改變。

## 台詞 Line（`OC.Talk`）
```js
{ id, cat, text, c: { …條件 }, w: 權重, cd: 冷卻（遊戲分鐘，預設 90）, prio, char: 只有這個 OC 會說, reply, set, unset, once }
```
條件鍵：`voice trait notrait otrait style quirk emo otherEmo phase wx hour need oneed rel aff fam trust intim conflict days aff_player hasMem hasWish hasShared hasRecent hasRecentWith hasHabit busy app item place act char other flag noflag romance chance`
數值比較字串：`'>=40'` `'<30'`。陣列＝任一符合。未知的鍵會被忽略（匯入時提醒）。
變數：`{name} {other} {pron} {opron} {like} {hobby} {shared} {item} {place} {time} {wx} {mem} {wish} {act} {days} {emo} {habit}`；缺少值的台詞這次不會被選中。
`app` 條件給未來的桌寵 App 情境對話使用（`OCApp.petContext(app)`）。

## 匯入／匯出檔
```json
{ "format": "ocshimeji-life", "version": 1, "lines": [Line], "events": [Event], "off": ["b12"] }
```
驗證：格式、版本（較新版本要求更新 App）、每行的分類／台詞／條件型別、事件步驟與觸發條件。錯誤會列出原因，不會「看似成功」。
匯入預設為「加入」（全部換新 id，不覆蓋）。事件格式見 `docs/event-rules.md`。
