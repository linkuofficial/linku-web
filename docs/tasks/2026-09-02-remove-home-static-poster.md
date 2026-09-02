# TASK: remove-home-static-poster
狀態: done
建立: 2026-09-02 ｜ 實作層: Codex
Repo: web
Base: a81f08c
Required verification: `node scripts/check.mjs` 全 PASS ＋ proof tests ＋ JS syntax ＋ Preview 首頁實看
風險等級: 低（移除首頁背景插圖；不動內容、路由或部署設定）

## 目標

依凜空 2026-09-02 回饋，移除首頁簡化的靜態 gimbal SVG 海報。首頁在新視覺方向核定前僅保留既有深色底與共用環境層，不渲染任何 gimbal、星點或替代品牌插圖；不恢復舊 WebGL 動畫。

## 驗收條件

- [x] 三語首頁不呼叫 `staticPoster()`、不建立 WebGL context、沒有 `.scene-toggle`，且 `window.__scene.mode` 為 `blank`。
- [x] About／Technology 的 direct starfield 與 reduced-motion poster／Play 行為不變；Technology proof 不受影響。
- [x] `node scripts/check.mjs`、proof tests、全部 JavaScript syntax 與 `git diff --check` 通過。
- [x] Preview 首頁實看無簡化 gimbal／星點 SVG，內容可讀、無新增 overflow 或 console error。

## 邊界（不要動的東西）

- 不新增新圖、Logo、動畫、文案、依賴或部署設定。
- 不推進 Production；僅更新既有 branch Preview 供凜空確認。

## Questions（實作層填）

- 新首頁背景的藝術方向留待凜空另行決定。

## HANDOFF（實作層完成或卡住後填）

- Branch: codex/optimization-closeout
- Summary: 首頁移除簡化 SVG poster，維持無 WebGL、無背景控制的深色底；內頁 reduced-motion poster 與動畫行為不變。
- Verification: `node scripts/check.mjs` 27 PASS；兩組 proof tests PASS；全部 JavaScript syntax 與 `git diff --check` PASS。Preview 與 Production 的英文首頁均確認 canvas background 為 `none`、無 toggle、無 overflow 或 console error。
- Remaining risks: 新首頁視覺方向仍待凜空另立任務決定；未新增任何替代品牌圖。
