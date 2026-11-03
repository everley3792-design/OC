# 素材格式規範

## 角色部件包 `.ocpack`
Zip 壓縮檔：
```
manifest.json          # PackManifest（schema：android/core/assets/AssetPack.kt）
parts/<part-id>/<view>/<layer>.png
parts/<part-id>/masks/<channel>.png   # 重新上色用灰階遮罩
clips/<clip-id>.json   # FrameClip
clips/<clip-id>/frame_###_<layer>.png
thumb.png              # 256×256 預覽
```

### manifest.json 範例
```json
{
  "format": "ocpack", "version": 1,
  "id": "user.mochi.ears-bunny", "name": "兔耳", "author": "player",
  "style": "sketch",
  "parts": [{
    "id": "ears.bunny", "slot": "EARS",
    "layers": [
      { "file": "parts/ears.bunny/front/back.png",  "anchorX": 64, "anchorY": 120, "view": "front", "z": -1 },
      { "file": "parts/ears.bunny/front/inner.png", "anchorX": 64, "anchorY": 120, "view": "front", "z": 0 }
    ],
    "tintMasks": { "fur": "parts/ears.bunny/masks/fur.png" },
    "views": ["front", "side", "back"]
  }],
  "clips": ["clips/ear-wave.json"]
}
```

## 圖片規則
| 項目 | A Mallow Mist | B Pixel Grove | C Inkpot Tales |
|---|---|---|---|
| 格式 | PNG-32 sRGB，直通 alpha | PNG-8/32，只用調色盤顏色，alpha 只能 0 或 255 | PNG-32 sRGB |
| 部件畫布 | 256×256（@3x），錨點以 px 記錄 | 原生 32×40（角色）、16×16（物品）、9×9 / 12×12（圖示） | 256×256（@3x） |
| 圖集 | 2048² atlas，padding 4px | 1024² atlas，padding 1px，**禁止過濾縮放** | 2048² atlas；每部件 3 幀 boil |
| 縮放 | 雙線性 | 只能整數倍、最近鄰 | 雙線性 |

## 錨點（Rig sockets，單位 = 角色局部座標，原點在腳底）
`feet(0,0)` · `body(0,-10)` · `neck(0,-17)` · `head(0,-31)` · `earL(-9.5,-40.5)` · `earR(9.5,-40.5)` · `eyeL(-7.2,-29.5)` · `eyeR(7.2,-29.5)` · `mouth(0,-24.4)` · `tail(7,-6)` · `handL(-9,-6)` · `handR(9,-6)` · `hold(4,-49)`

## 動畫 clip（`FrameClip`）
```json
{ "id": "ear-wave", "fps": 8, "loop": true,
  "frames": [ { "layers": ["frame_000_line.png"], "hold": 2 },
              { "layers": ["frame_001_line.png"], "pose": { "earR": 0.6 } } ] }
```
- fps 1–60；`hold` 為整數拍數（2 = 一拍二）。
- 影格可以是手繪圖層、Rig 姿勢覆寫，或兩者疊加。

## 匯入驗證
1. `format`/`version`/`style` 正確（不符則拒絕，並說明原因）。
2. 每張 PNG ≤ 1024×1024、總包 ≤ 20MB。
3. 錨點落在畫布內；B 方案檢查調色盤與 alpha。
4. 名稱、作者文字過濾後才顯示。

## 字體授權
原型使用的字體皆為開放授權：Huninn（OFL）、LXGW WenKai TC（OFL）、Fredoka（OFL）、Silkscreen（OFL）、GNU Unifont（GPLv2+ 含字型例外 / OFL）。見 `prototype/assets/fonts/LICENSES.md`。
