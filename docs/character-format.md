# 角色資料格式（存檔 schema v2）

程式：`game/js/char/model.js`（`OC.Chars`）。所有頁面（角色列表、檔案、編輯器、動畫工作室、小島、桌寵）都讀同一份 `save.chars[id]`，沒有任何頁面保存自己的副本；編輯器改的是暫存 draft，按「儲存」才寫回。

## 存檔頂層（與角色相關）
```js
{ v: 2,
  chars: { [id]: Character }, roster: [id…], activeId, petId,   // 角色、排序、目前操控、桌寵角色
  animations: { [id]: AnimDoc },                               // 見 animation-system.md
  palette: { recent:[], favorites:[], custom:[] },             // 色環的最近使用 / 收藏 / 調色盤
  imports: [{ at, kind, name, n, ok, msg }] }                  // 匯入紀錄
```
圖片**不在**存檔 JSON 裡：只存素材 id。像素存在 IndexedDB（`oc-assets` 資料庫：`blobs`、`thumbs`、`meta`、`drafts`）。

## Character
```js
{ id, v: 2, created, updated, origin: 'preset'|'custom'|'import'|'mixed',
  profile: { name*, nickname, birthday, age, gender, pronoun, species, height, intro, backstory,
             hobbies:[], likes:[], dislikes:[], habits:[], relationPref, custom:[{k, v}] },
  personality: { pace, energy, social, expression, thinking, speech,   // 0–100 滑桿
                 traits:[traitId…] (≤5, 互斥檢查), customTraits:[{id, name, desc}] },
  quirks: { walk, sit, sleep, eat, greet, habit, face },               // Little Quirks
  speech: { style: casual|polite|cute|cool|energetic|whisper,
            self: '我'|'人家'|'俺'|…,  you: '你'|'妳'|'您'|…,  playerName,       // 8.0 自稱、稱呼你、怎麼叫玩家
            ending, endingRate (0–1，預設 0.35，不是每句都加),
            phrases: [{ text, rate, when: any|happy|sad|greet|<分類>, at: start|end }],   // 多個口頭禪
            pace: slow|normal|fast, moods (心情影響語氣), banned: [詞…], call: { ocId: 專屬稱呼 },
            catchphrase },                                                   // 舊欄位：第一次編輯時轉成 phrases
  tastes: { likeItems:[itemId], dislikeItems:[itemId] },
  look: { 毛色/耳內/眼睛/腮紅/耳型/尾巴/上衣/圖案/配件/髮夾,
          headSize, bodyW, bodyH, legLen, earSize, tailSize,                       // 比例
          eyeStyle, eyeSize, eyeGap, eyeY, eyeRot, browStyle, browY, mouthStyle, mouthY, mouthSize,
          noseStyle, cheekStyle, cheekSize, furPattern, patternCol },
  parts: [Part],                                     // 玩家素材部件
  appearance: { mode: 'rig'|'sprite', scale, refH }, // refH = 角色參考高度（影格 px），所有動作用同一個縮放
  actions: { [action]: { any|front|back|left|right: animId } },
  needs: { food, energy, mood, social, t },          // 每個角色各自的需求
  growth: { suggestions:[{id, type:'trait'|'hobby', value, reason, at}], locked:[value], history:[] },
  status: { onIsland } }
```
`*` 唯一必填欄位。`normalize()` 會為缺少的欄位補預設值（未來新增欄位不需遷移）。

## Part（部件）
```js
{ id, slot, assetId, closedId?,   // closedId：眼睛部件的閉眼圖（選用）
  anchor: head|face|body|tail|earL|earR|handL|handR|feet,
  z: back|body|head|face|front,   // 圖層
  x, y, scale, rot(度), flip, mirror(另一側自動鏡像), opacity, visible }
```
- slot `eyes / mouth / ears / tail / brows` 會**取代**內建形狀；其餘（帽子、服裝、飾品、手持物、背後、花紋）疊加。
- 部件畫在錨點的座標系內（rig 單位），所以跟著頭部晃動、歪頭、轉身、走路，不會漂浮或脫離。
- 圖片角色（sprite 模式）的部件使用動作的 `points.head` 等附著點。

## 性格如何影響行為（`OC.Chars.behavior(c)`）
| 來源 | 影響 |
|---|---|
| pace、勤奮、懶散、走路方式 | 移動速度 |
| energy、走路方式 | 走路彈跳幅度、搖擺、眨眼頻率、發呆間隔、跳躍高度 |
| expression | 表情幅度 |
| social、外向、害羞 | 打招呼方式、被搭話臉紅、是否主動 |
| 懶散 + 低 energy | 發呆時坐下的機率 |
| 習慣動作 | 東張西望、甩尾巴、哼歌（♪）、伸懶腰 |
| 坐姿／睡相／進食速度／招牌表情 | 對應動作的姿勢與時長 |
| speech | `OC.Chars.speak(c, text, {to, emo, cat, rnd})`：自稱／稱呼替換、風格、心情、節奏、句尾（依頻率、不重複）、口頭禪（依條件）、禁用詞、對其他 OC 的專屬稱呼 |
| 特質 | 需求下降速度（開朗、悲觀、害羞、懶散、夜貓子）、互動效果（貪吃、文藝、愛整潔、好奇…） |

## 成長（需要玩家同意）
`OC.Chars.suggest(c, type, value, reason)` 只會**提出**建議（例如摘很多花 → 建議「喜歡自然」）；玩家在角色檔案選「接受／不要／永遠不要」（`resolve`）。被鎖定的值不會再提出。之後的生活模擬只能透過這個介面改變永久特質。

## 遷移
v1（第二階段單一 `oc`）→ v2：`migrateV1()` 同步轉換結構；舊的 dataURL 動畫在開機後由 `migrateLegacyAnims()` 轉成 IndexedDB 素材＋動畫文件，之後存檔中不再有 base64 圖片。
