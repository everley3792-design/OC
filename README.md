# OC Shimeji

> 我的 OC，住進你的手機。—— 原創角色生活模擬 × Android 懸浮桌寵（純 2D / 2.5D）

## 第一階段交付物

| 方案 | 影片（45s · 1080×1920 · 30fps） | 視覺總覽 | 原型 |
|---|---|---|---|
| A · 棉霧島 Mallow Mist | [`deliverables/videos/A_mallow-mist.mp4`](deliverables/videos/A_mallow-mist.mp4) | [`A_mallow-mist.png`](deliverables/overviews/A_mallow-mist.png) | `prototype/index.html?theme=mallow` |
| B · 像素森語 Pixel Grove | [`deliverables/videos/B_pixel-grove.mp4`](deliverables/videos/B_pixel-grove.mp4) | [`B_pixel-grove.png`](deliverables/overviews/B_pixel-grove.png) | `prototype/index.html?theme=pixel` |
| C · 手帳繪本 Inkpot Tales | [`deliverables/videos/C_inkpot-tales.mp4`](deliverables/videos/C_inkpot-tales.mp4) | [`C_inkpot-tales.png`](deliverables/overviews/C_inkpot-tales.png) | `prototype/index.html?theme=sketch` |

**先讀：** [`docs/phase1-comparison.md`](docs/phase1-comparison.md) — 三方案差異、優缺點、效能成本與建議。

文件：
- [全系統視覺規劃](docs/visual-plan.md) · [技術架構](docs/architecture.md) · [UI 元件規格](docs/ui-components.md)
- [角色與場景美術規範](docs/art-guidelines.md) · [動畫規範](docs/animation-guidelines.md) · [素材格式規範](docs/asset-format.md)
- [CLAUDE.md](CLAUDE.md)（開發規範與指令）

## 狀態
- ✅ 三支 MP4、三張總覽圖、三套可執行動態原型（含播放器與錄影腳本）
- ✅ 技術架構與規範文件、Android 多模組專案骨架、純 Kotlin 核心（生活模擬、動畫、存檔、素材包）
- ⏳ APK：此雲端環境無法存取 Google Maven，尚未建置
- ⏳ Android 懸浮桌寵：原生程式碼已撰寫（`android/platform/overlay`），**尚未編譯與實機驗證**；影片中為視覺模擬
- ⏸ 第二階段：等待選定美術方向
