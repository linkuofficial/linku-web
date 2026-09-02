# TASK: audit-uncontested-fixes
狀態: done
建立: 2026-09-02 ｜ 秘書層: Codex + Claude Opus cross-fire ｜ 實作層: Codex
Repo: web
Base: a2de67c
Required verification: node scripts/check.mjs 全 PASS ＋ proof tests ＋ JS syntax ＋ 本機 http 三語頁面、多尺寸與動畫控制實看
風險等級: 中(三角測量)

## 目標

只落地 2026-09-02 網站深度稽核與跨家族紅隊均無異議的窄修：修正 intro 使用截斷時間造成的實時拖長、讓既有低 FPS 治理不再被不可達條件阻斷、讓內頁 WebGL2 星場所走直接繪製路徑，以及修正兩組 Pause/Play 控制的 ARIA 狀態矛盾。

## 驗收條件

- [x] intro 進度使用未截斷的可見 frame elapsed time；頁面隱藏期間不會燒掉未展示的 intro。
- [x] 既有 FPS 監測可在 intro 期間取得樣本，不再依賴 `introT > 3` 的不可達條件。
- [x] About／Technology 內頁在 WebGL2 可用時直接繪製星場，不再建立 scene FBO／composite；本任務完成時未改首頁，後續依凜空裁決由 `2026-09-02-home-static-brand-scene.md` 改為靜態場景。
- [x] 背景動畫與 proof 的動態 Play/Pause label 不再同時使用 `aria-pressed`。
- [x] `node scripts/check.mjs`、`node scripts/proof.test.cjs`、`node scripts/proof-dynamics.test.cjs` 與全部 JavaScript syntax check 通過。
- [x] 本機 HTTP 實看英文、繁中、日文 home／technology／about；320×568、390×844、1440×900 無新增溢位或破版，控制可正常暫停／播放。

## 邊界（不要動的東西）

- 不改 `vercel.json`、英文入口語言導向、canonical／hreflang／sitemap 或任何部署設定。
- 不決定行動版預設靜態、裝置能力判準或 long-task 門檻；本輪只修既有治理無法運作的 bug。
- 不重排 Technology proof、不增刪公司對外文案、不改三語字型 `&text=`。
- 不新增或重製 logo／OG 圖、不自架字型、不做資產指紋化、Worker／OffscreenCanvas、minify 或新依賴。
- 不改控制模擬的模型、參數或繪圖結果。

## Questions（實作層填：卡住或需要決策時）

- 是否另開強制交叉 brief，移除英文入口的自動語言重導？
- 是否重排 mobile proof 並把既有工作／可信證據前移？涉及可見文案與 `&text=` 同步。
- Lighthouse 的 `no long task >100ms` 是否保留給預設路徑，並另立動畫 opt-in 的實機 FPS／發熱門檻？
- 正方形 logo／JSON-LD `ImageObject`／apple-touch-icon 何時進行？Knowledge Panel 仍需獨立外部來源。

## HANDOFF（實作層完成或卡住後填）

- Branch: codex/optimization-closeout
- Summary: intro 改用未截斷的可見 frame elapsed，既有 FPS EMA 從第一批有效 frame 開始量測；WebGL2 內頁固定走 direct starfield path；背景與 proof 的動態 Play/Pause label 移除衝突的 `aria-pressed`；`check.mjs` 新增 render runtime 治理回歸門檻。
- Verification: `node scripts/check.mjs` 27 PASS／0 FAIL；`proof.test.cjs` PASS；`proof-dynamics.test.cjs` PASS（48/48 收斂）；7 個 JS/MJS/CJS syntax PASS；`git diff --check` PASS。以 no-cache HTTP 在 320×568、390×844、1440×900 巡檢三語九頁；內頁星場、`#reduce` poster，以及兩組 Play/Pause 實際操作均正常，無可實際橫向捲動。首頁目前狀態以後續 `2026-09-02-home-static-brand-scene.md` 的驗證為準。
- Remaining risks: 尚未重新部署或取得修後正式站 Lighthouse；未做 Android／iPhone、Safari／Firefox、NVDA／VoiceOver 實機驗收。語言重導、mobile proof 重排、效能門檻與 square logo 均留待 Questions 裁決，未夾帶實作。

## Review（審查層填；盡量用與實作層不同的模型家族）

- Reviewer:
- 模式:
- 觸發原因:
- Verdict:
- Findings:

## 裁決（凜空）

- 決定: 行動裝置降級策略不另設複雜 heuristic；首頁改採無 WebGL 的靜態品牌場景，另見 `2026-09-02-home-static-brand-scene.md`。其餘 Questions 尚未裁決。
- 日期: 2026-09-02
