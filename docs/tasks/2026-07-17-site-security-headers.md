# TASK: site-security-headers
狀態: done

## 目標

為 LINKU 靜態多語網站加入與現有語言導向、Google Fonts、WebGL／Canvas 及結構化資料相容的嚴格瀏覽器安全標頭，並以機械化檢查防止政策與頁面實作漂移。

## 驗收條件

- [x] 新增 `vercel.json`，全站提供 CSP、`X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options` 與最小化 `Permissions-Policy`。
- [x] CSP 不含 `unsafe-inline`、`unsafe-eval` 或寬鬆萬用來源。
- [x] 三個英文入口的同步語言導向 script 由單一 SHA-256 hash 精確允許，且 hash 由檢查程式驗證。
- [x] 移除會在嚴格 CSP 下產生違規的動態 speculation rules；不新增實驗性預載設定。
- [x] `#still` 與 reduced-motion 路徑不依賴 `style.cssText`。
- [x] `node scripts/check.mjs`、proof 測試與 JS syntax check 全 PASS。
- [x] 本機 HTTP 實看三語首頁、內頁、`#still` 與 reduced-motion，無 CSP 違規且主要互動正常。

## 邊界（不要動的東西）

- 不修改 GitHub Actions、CI/CD、網域、DNS、Vercel Dashboard、帳號權限或驗證設定；正式部署僅在凜空於 2026-07-17 明確同意後執行。
- 不新增 production dependency、框架、build step、後端、CSP 回報端點或第三方監測服務。
- 不加入 HSTS `includeSubDomains`／preload、COOP、COEP 或 CORP。
- 保留既有未提交的 optimization-closeout 變更，不重寫其測試或視覺調整。

## Questions（Codex 填）

- 無。凜空已於 2026-07-17 同意依完成交叉驗證後的修正版方案實作。

## HANDOFF（Codex 完成或卡住後填）

- Branch: `codex/optimization-closeout`
- Summary: 新增全站 Vercel 安全標頭與嚴格 CSP；以單一 SHA-256 hash 精確允許三個英文入口的同步語言導向；移除動態 speculation rules；proof `#still` 改用 CSS class；刪除未使用的 scene snapshot 死碼；`check.mjs` 新增安全設定、hash 漂移與 CSP 相容性檢查。
- Verification: `node scripts/check.mjs` 26 PASS；`proof.test.cjs` PASS；`proof-dynamics.test.cjs` 48 scenarios PASS；全 JS `node --check` PASS；`git diff --check` PASS；本機安全預覽套用與 `vercel.json` 相同 CSP，九頁 main／JSON-LD／proof／overflow 正常，三語首頁入場完成後可見，三語 technology `#still` 快照 1208×540，`#reduce` 海報保持零 WebGL 並可切回 1600×768 動畫；CSP report 與瀏覽器 CSP log 均為空陣列。Vercel Preview `https://linku-9sb00ygoz-linku-s-projects.vercel.app` READY：未登入請求受 Vercel Authentication 302／`noindex` 保護；authenticated CDN 首頁與 technology 200、`docs/` 404，五項自訂安全標頭與 CSP 皆正確；Chrome 九頁、`#still`、`#reduce` 與 WebGL 啟動正常，CSP log 為空。Production deployment `dpl_2xMpGAAGnoBh6yu8buVshYyaqY1m` READY，部署網址 `https://linku-ftykcx92z-linku-s-projects.vercel.app` 已 alias 至 `https://linku.tech`；公開根目錄、technology、zh、ja 均為 200，`docs/` 為 404，`https://www.linku.tech/` 以 308 導向主網域；CSP、`nosniff`、Referrer Policy、X-Frame-Options、Permissions Policy 與 Vercel HSTS 均已生效。Production 瀏覽器九頁 main／JSON-LD／proof／overflow 全正常，`#still` 靜態圖與 `#reduce` 暫停／播放互動通過，中文 technology 完整頁面視覺檢查無破版。
- Remaining risks: Firefox／Safari 尚未完成瀏覽器驗收。GitHub Actions 權限／SHA pin、帳號 MFA 與 branch protection 依邊界未修改；Preview Protection 已確認啟用，但未變更其 Dashboard 設定。本次變更已納入 `codex/optimization-closeout` 並推送至 `origin`，避免後續 Git 部署退回舊版設定。
