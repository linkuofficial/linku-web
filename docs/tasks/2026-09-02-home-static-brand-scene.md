# TASK: home-static-brand-scene
狀態: done
建立: 2026-09-02 ｜ 秘書層: Codex + Claude Opus cross-fire ｜ 實作層: Codex
Repo: web
Base: a2de67c + working-tree audit fixes
Required verification: node scripts/check.mjs 全 PASS ＋ proof tests ＋ JS syntax ＋ 本機 http 三語首頁／內頁、多尺寸與控制實看
風險等級: 中(三角測量)

## 目標

依凜空 2026-09-02 裁決採用方案 1：英文、繁中、日文首頁不再啟動動態 WebGL 模型或顯示播放／暫停控制，保留既有低對比靜態 gimbal 輪廓、星點與光暈作為品牌背景。Technology／About 的既有輕量星場及 Technology 控制模擬維持不變。

## 驗收條件

- [x] 三語首頁只走 `staticPoster()`，不呼叫 `boot()`、不建立 WebGL context、不顯示 `.scene-toggle`。
- [x] 三語首頁保留靜態 gimbal 輪廓、星點與光暈，桌面與行動構圖無破版。
- [x] About／Technology 仍啟動 direct starfield，背景控制可正常 Play／Pause；Technology proof 不受影響。
- [x] `#reduce`／`#still` 在首頁保持無動畫、無控制；內頁既有 reduced-motion 行為不變。
- [x] `node scripts/check.mjs`、proof tests、全部 JavaScript syntax 與 `git diff --check` 通過。
- [x] 本機 HTTP 實看英文、繁中、日文 home／technology／about；320×568、390×844、1440×900 無可實際橫向捲動或新增破版。

## 邊界（不要動的東西）

- 不改首頁或三語可見文案、Google Fonts `&text=`、HTML 結構、canonical／hreflang／sitemap。
- 不改 `vercel.json`、CSP、正式部署、語言重導。
- 不刪除仍供內頁使用的星場 renderer，不重寫 Technology proof。
- 不新增圖片、字型、依賴、build step、資產指紋化或監控。
- 不在本輪決定 mobile proof 重排、首頁成果區塊、square logo 或日文文案。

## Questions（實作層填：卡住或需要決策時）

- 無；首頁靜態方案已由凜空裁決。

## HANDOFF（實作層完成或卡住後填）

- Branch: codex/optimization-closeout
- Summary: 三語首頁固定使用既有靜態 gimbal／星點／光暈 poster，不再啟動 WebGL 或建立播放控制；內頁 direct starfield、reduced-motion opt-in 與 Technology proof 保持可用；新增機械化回歸檢查固定此邊界。
- Verification: `node scripts/check.mjs` 27 PASS／0 FAIL；`node scripts/proof.test.cjs` PASS；`node scripts/proof-dynamics.test.cjs` 48／48 收斂；7 個 JS／MJS／CJS 檔案 `node --check` 全通過；`git diff --check` 通過。本機 no-cache HTTP 實看三語 9 路由 × 320×568、390×844、1440×900，均無橫向捲動；首頁無 toggle 且 canvas 維持靜態 300×150 backing size，內頁 canvas 按 viewport 啟動；另驗證首頁 `#reduce` 無控制、內頁 reduced-motion 可手動播放／暫停，乾淨載入 console 無 error／warning。
- Remaining risks: 尚未做部署後 Lighthouse、Safari／Firefox 與實機測量；靜態品牌圖沿用既有簡化輪廓，未另做視覺重設計；正式站未部署、未變更。

## Review（審查層填；盡量用與實作層不同的模型家族）

- Reviewer:
- 模式:
- 觸發原因:
- Verdict:
- Findings:

## 裁決（凜空）

- 決定: 採方案 1；首頁移除動態 WebGL 與播放控制，保留靜態品牌輪廓／光暈。
- 日期: 2026-09-02
