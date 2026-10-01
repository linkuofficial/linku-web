# TASK: home-substance-and-debt
狀態: review
建立: 2026-10-01 ｜ 秘書層: Claude Opus 5.5 ｜ 實作層: Claude Opus 5.5
Repo: web
Base: 52c58c5（origin/main）
Required verification: `node scripts/check.mjs` 全 PASS ＋ proof／UX tests ＋ JS syntax ＋ 本機 HTTP 三語九頁實看（320／390／1440）
風險等級: 中（三語可見文案＋九頁 `<head>` 新增一支 script；未動 `vercel.json`）

## 目標

依凜空 2026-10-01「先做 3 和 4」：
- **3 首頁中段補實**：三支柱各補一行具體能力句；新增「作品」段，把 Neblux 與控制模擬從內頁拉到首頁。
- **4 清收尾債**：320px 英文 About 溢出、View Transition `InvalidStateError`、Lighthouse、方形 logo、日文校稿、跨瀏覽器／實機驗收。

## 驗收條件

- [x] 三語首頁三支柱各有一行能力句，內容只取自 facts sheet 與既有 Technology 文案，不新增對外承諾。
- [x] 三語首頁新增作品段（`#projects`）：Neblux（外連）＋控制模擬（連到該語 `/technology/#proof`），明示「模擬，非實體硬體驗證」。
- [x] 首頁維持無 WebGL／無背景插圖（`window.__scene.mode === 'blank'`），未動 renderer。
- [x] zh／ja `&text=` 以 `scripts/sync-font-text.mjs` 同步，check §3 無缺字、無過期字。
- [x] 320px 英文 About 無水平溢位（修前 scrollWidth 322 → 修後 320）。
- [x] 跨頁 View Transition 在冷載入／revalidate 下實際完成，console 無 `InvalidStateError`。
- [x] `node scripts/check.mjs`、三支 test、全部 JS syntax、`git diff --check` 通過。
- [x] 九頁 × 320／390／1440 無水平溢位、console 乾淨。
- [x] 正式站首頁 Lighthouse 數字（修改前基線，見 HANDOFF）。
- [ ] 部署後重跑 Lighthouse（含技術頁，本次未取得）。
- [x] 凜空確認三語新文案（2026-10-02「就這樣」）。

## 邊界（不要動的東西）

- 不動 `vercel.json`、CSP、快取標頭、route 或任何部署設定。
- 不動 renderer、proof 模型／參數、首頁背景藝術方向（仍待凜空另案決定）。
- 不改 facts sheet 的公司事實、JSON-LD、既有文案；JSON-LD `logo` 不換。
- 不新增依賴、不新增頁面。

## Questions（實作層填：卡住或需要決策時）

1. **文案待確認**（已實作為草稿，未 commit）：
   - 支柱能力句 zh：「推論與決策在裝置端進行，不必依賴雲端往返。」／「以感測、估測與閉環控制，將決策轉為致動。」／「小型、可客製的機器，以軟硬協同設計圍繞明確任務打造。」
   - 作品段標籤：zh「作品」、en「Work」、ja「取り組み」。Neblux 類別 zh「科技普及化」、en「Accessible tech」（沿用各語 About 用字）、ja「公開プロジェクト」。
2. **方形 logo**：2026-09-02 裁決為「過渡 Logo 暫不設計」。本次只把既有 favicon 的 L＋節點原樣點陣化成 512×512 滿版 PNG（`assets/logo-square.png`），沒有新設計、沒有改 JSON-LD `logo`、沒有加 apple-touch-icon。若連點陣化都不要，刪掉該檔即可。
3. **日文**：新增的日文為 AI 草稿，已在 `ja/index.html` 標註；母語校稿仍需真人，本次無法完成。

## HANDOFF（實作層完成或卡住後填）

- Branch: `feat/home-substance-and-debt`（自 52c58c5 分出，未 commit、未 push）
- Summary:
  - **首頁**：三語 `index.html` 的三支柱各加 `.pillar-desc`；新增 `<section class="work" id="projects">`，沿用支柱列的格線（左緣對齊）。`styles.css` 新增 `.pillar-desc`／`.work*` 與對應 CJK 覆寫；`main.js` 的列表游標光暈納入 `.work-item`。`sitemap.xml` 三個首頁 `lastmod` → 2026-10-01。
  - **320px About**：`.about-facts` 的標籤欄固定 150px，320px 時值欄只剩 90px，小於 `info@linku.tech` 的 120px。≤340px 改為 112px＋16px 間距，值欄 136px。
  - **View Transition（根因）**：Chromium 在 parser 插入 `<body>` 當下決定新頁的 `@view-transition` opt-in；`styles.css` 擋 render 不擋 parser，只要樣式表需要抓取或 revalidate，parser 就先到 `<body>`，轉場被跳過並丟 `InvalidStateError: ViewTransition opt-in disabled`。正式站 `Cache-Control: public, max-age=0, must-revalidate`，所以**正式站每一次導覽都被跳過——轉場上線以來實際沒有運作過**（本機只在快取命中時才會動，所以先前沒被發現）。修法：九頁 `<head>` 在 `styles.css` 之後加一支同步的空 script `assets/vt-gate.js`，讓 parser 等樣式表；不需要 inline style，CSP 與 `vercel.json` 不動。`check.mjs` 新增 §11 守住位置與載入方式，並把 `vt-gate.js` 納入資產預算表。
  - **日文**：`ja/technology/` 規格段一處半形 `)` 改全形 `）`。
  - **方形 logo**：`assets/logo-square.png`（512×512，3.2 KB），見 Questions 2。
- Verification:
  - `node scripts/check.mjs` 29 PASS／0 FAIL（原 27 項＋vt-gate 預算＋§11）；§11 mutation：移除 gate、加 `defer` 各 1 FAIL，還原後回 29 PASS。
  - `proof.test.cjs` PASS；`proof-dynamics.test.cjs` PASS（PID 2.90 s、model-based 1.23 s，48 情境）；`ux-interaction.test.cjs` PASS；全部 JS／MJS／CJS `node --check` 通過；`git diff --check` 通過。
  - 無頭 Chrome（raw CDP、停用快取）：九頁 × 320×568／390×844／1440×900 共 27 個狀態，scrollWidth 皆等於視窗寬、無元素超出、console 無訊息。
  - 三語首頁：`__scene.mode = blank`；標題層級 h1→h2 無跳級；支柱標題與作品標題左緣同為 248px（1440 寬）；字型無載入失敗；作品連結目標正確（外連帶 `rel="noopener"`）。
  - View Transition 對照實驗（各 5 次真實點擊導覽）：本機快取開 5/5 完成；本機快取關 0/5（修前）；**正式站 linku.tech 正常快取 0/5**；加 gate 後本機快取關 5/5、無 exception。
  - 首頁作品連結實點：`/zh/technology/#proof` 抵達後 `#proof` 位於視窗頂端。
  - Lighthouse（pagespeed.web.dev，Lighthouse 13.5.0，2026-10-01 19:20，**修改前的正式站** `https://linku.tech/`）：
    - 行動（Moto G Power、Slow 4G）：Performance 95／Accessibility 100／Best Practices 100／SEO 100；FCP 2.4 s、LCP 2.4 s、TBT 0 ms、CLS 0、SI 2.4 s。唯一扣分來源是 render-blocking requests（估計可省 1,610 ms，即 Google Fonts CSS＋`styles.css`）。
    - 桌面：100／100／100／100；FCP 0.6 s、LCP 0.6 s、TBT 0 ms、CLS 0。
    - 對照 2026-07-07 brief 的門檻（桌面 ≥95、行動 ≥90、CLS ≤0.02）：首頁達標。
    - `/zh/technology/` 行動版試了三次，PSI 都沒回傳報告（頁面停在 loading），原因未確定，**技術頁沒有數字**。
- Remaining risks:
  - Lighthouse 數字是修改前的正式站，部署後需重跑；keyless PageSpeed API 當日配額用盡（HTTP 429），所以改走網頁版。技術頁仍缺數字。
  - `vt-gate.js` 是 parser-blocking 資源：多一個同源小請求（Brotli 330 bytes）。它等的樣式表本來就擋 render，預期不影響首次繪製，但 Lighthouse 可能列入 render-blocking 提示，需部署後實測。
  - 轉場修好後，正式站訪客會**第一次真的看到**跨頁淡入與品牌字共享元素動畫（0.35s）。建議在 Vercel preview 實看一次再合 main。
  - Safari／Firefox、iPhone／Android 實機、螢幕閱讀器：本機沒有 Firefox 與 Safari，未驗。
  - 日文母語校稿未做。

## Review（審查層填；盡量用與實作層不同的模型家族）
- Reviewer:
- 模式:
- 觸發原因:
- Verdict:
- Findings:
  -

## 裁決（凜空）
- 決定: 「就這樣」——Questions 1–2 照現況採用（三語文案與標籤用字、方形 logo 點陣檔保留）。commit 並開 PR；合 main 前先看 Vercel preview 的轉場。
- 日期: 2026-10-02
