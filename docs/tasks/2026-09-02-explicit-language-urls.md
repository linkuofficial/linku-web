# TASK: explicit-language-urls
狀態: done
建立: 2026-09-02 ｜ 秘書層: Codex + Claude Opus cross-fire ｜ 實作層: Codex
Repo: web
Base: a2de67c + working-tree audit fixes
Required verification: `node scripts/check.mjs` 全 PASS ＋ proof tests ＋ JS syntax ＋ 本機 HTTP 三語九頁與跨語切換實看
風險等級: 中（三角測量；連動 `vercel.json` CSP）

## 目標

依凜空 2026-09-02 裁決採方案 A：每一個明示語言 URL 永遠忠實載入該語言，不再依 `navigator.languages` 或 `localStorage` 將三個英文入口自動改送繁中／日文。保留現有三語獨立 URL、語言切換器、canonical、hreflang、sitemap、CSP 強度、安全標頭、視覺、互動及內容，不犧牲其他既有行為。

## 驗收條件

- [x] `/`、`/technology/`、`/about/` 在瀏覽器偏好或舊 `linku_lang` 值為 zh／ja 時仍留在原英文 URL，頁面 `lang=en`。
- [x] `/zh/...`、`/ja/...` 仍忠實載入各自語言，九頁 canonical／hreflang／sitemap 完整且不變。
- [x] 三語語言切換器仍以普通連結切換到同一頁型的對應語言，44×44px 觸控區、焦點、View Transition 漸進增強不退化。
- [x] 九頁不含自動語言導向 inline script；移除只服務該導向的 `localStorage.linku_lang` 寫入，不新增提示、cookie、狀態或 JavaScript 路由。
- [x] CSP 保持 `script-src 'self'`、不含 `unsafe-inline`／`unsafe-eval`／寬鬆來源；移除已無 inline executable script 需要的 router hash，其餘安全標頭逐字不變。
- [x] 不改可見文案、Google Fonts `&text=`、頁面結構、Logo／OG 資產、Technology proof、效能門檻或 renderer。
- [x] `node scripts/check.mjs`、proof tests、全部 JavaScript syntax 與 `git diff --check` 通過。
- [x] 本機 HTTP 實看三語 home／technology／about；桌面與窄屏無新增溢位、console 或 CSP 錯誤，首頁靜態品牌場景與內頁動畫／proof 維持現況。

## 邊界（不要動的東西）

- 不動 Vercel route、redirect、rewrites、deployment topology、domain、DNS 或正式部署；`vercel.json` 只移除不再需要的 inline-script hash。
- 不採納 mobile proof 重排或新增成果／可信證據區塊。
- 不改舊 Lighthouse／long-task 門檻；留待凜空後續討論。
- 不新增或修改 Logo、apple-touch-icon、JSON-LD logo、OG 圖或其他品牌設計。
- 不順手整理歷史 task brief 或無關程式。

## Questions（實作層填：卡住或需要決策時）

- 已於 2026-09-02 取得凜空授權，依下列兩個本機 commit 切分：runtime 治理與語言 URL／CSP 分別落地；不 push。

## HANDOFF（實作層完成或卡住後填）

- Branch: codex/optimization-closeout
- Summary: 移除三個英文入口的同步自動語言導向與 `main.js` 中只服務該導向的 `linku_lang` 寫入；語言切換維持普通連結。CSP 移除已失效的 router SHA-256 allowance，保留 `script-src 'self'` 與其他安全政策；`check.mjs` 改為鎖定九頁零 inline executable script、三語同頁型切換與精確 CSP。依 Claude F2／F3 修正為 fail-closed script type 白名單（只准 inline JSON-LD）、§8／§9 雙重 CSP 綁定，並掃描全部 HTML 與 `assets/*.js` 的舊語言導向訊號。
- Verification: `node scripts/check.mjs` 27 PASS／0 FAIL；兩組 proof tests PASS（48／48 收斂）；7 個 JS／MJS／CJS syntax PASS；`git diff --check` PASS。本機 no-cache HTTP 於 390×844 與 1440×900 驗證三語 9 路由（18 個狀態）：path／lang／main／語言連結／scene／proof 正確，無正向水平 overflow；實際操作 Technology `EN → 繁 → 日 → EN` 均切到同頁型；乾淨英文首頁載入 console 無 warning／error，靜態品牌 poster 維持。F2 mutation 注入 `<script type="module">` 後 check 以 §8／§9 共 4 FAIL、exit 1 攔截；F3 mutation 新增 `assets/__mutation-language.js` 後以 1 FAIL、exit 1 攔截；兩者均已移除，`index.html` SHA-256 還原為 packet 的 `48bc74d6…`。自動化跨頁點擊產生的 View Transition `AbortError: Transition was skipped` 亦可在未修改的正式站版本重現，確認非本次回歸。
- Remaining risks: Claude F1 尚待凜空授權兩個本機 commit 的交付切分；目前混合工作樹不可宣稱本 task 能獨立 cherry-pick。尚未部署 Vercel Preview，因此正式 response header 與 CDN 行為仍需部署後驗證；Safari／Firefox／實機未驗。舊 `linku_lang` 值可能留在既有瀏覽器 storage，但新程式完全不再讀寫它，不影響 URL；未主動刪除使用者端資料。

## Review（審查層填；盡量用與實作層不同的模型家族）

- Reviewer: Claude Opus 5（packet-only 交叉審查；packet `linku-explicit-language-xfire-packet.txt`，brief/diff/AGENTS 三 hash 均相符）
- 模式: ②測試互寫 ＋ ③對抗性驗證
- 觸發原因: 強制交叉路徑（改動 `vercel.json` 部署設定 ＋ CSP）
- Verdict: **fix-needed**（語言行為本身找不到反例；問題出在夾帶範圍與回歸保護網）
- Findings:

**F1（阻擋性，已實測）— `check.mjs` 新增的 §10「Render runtime 治理」超出本 brief 邊界，且與 packet 排除的 `render.js`／`proof.js` 硬綁死**
本 diff 在 `scripts/check.mjs` 新增第 10 段，斷言 `assets/render.js`、`assets/proof.js` 的原始碼形狀。這兩個檔在 packet 中被明示排除，屬 `audit-uncontested-fixes`／`home-static-brand-scene` 兩份 brief；本 brief 邊界寫明「不改…renderer」「不順手整理無關程式」。
實測（對 base commit `a2de67c` 的 render.js／proof.js 跑 §10 的五條斷言）：**五條全部 FAIL**（`direct/pipe`、static poster path、`introT` unclamped、`fps` 量測、`aria-pressed` 禁令）。
會壞的狀態：本 brief 若單獨 commit，或 render/proof 的未提交改動被 revert／延後／分開 PR，`node scripts/check.mjs` 立刻 FAIL、CI 紅燈，而語言行為完全正確——驗證門檻會指向錯誤的原因。HANDOFF 的「27 PASS／0 FAIL」是在含被排除改動的髒工作樹上量到的，無法從本 brief 的範圍重現。
建議（擇一，由凜空裁決）：§10 移到 render/proof 那份 brief 的 diff；或明文記載「本 brief 必須與 render/proof 改動同一 commit 落地」。
副項：§10 用逐字 regex 鎖原始碼形狀（`var fps = 1 / Math.max(0.001, rawDt)` 等），純格式改寫（`var`→`const`、換行）即 FAIL，行為卻沒變。

**F2（中高嚴重度，已實測）— 「九頁不含自動語言導向 inline script」的機械保證有洞：帶 `type` 的 inline script 完全不被檢查**
§8／§9 的 regex `<script(?![^>]*\bsrc\s*=)(?![^>]*\btype\s*=)…>` 為了放過 JSON-LD，把**所有**帶 `type` 屬性的 script 一併排除——但 `type="module"` 與 `type="text/javascript"` 都會執行。
實測：在 `index.html` 注入
`<script type="module">if((navigator.languages||[])[0].startsWith("zh"))location.replace("/zh/");</script>`
後 `node scripts/check.mjs` 仍 **27 PASS／0 FAIL**；我的 A1 測試抓到。也就是說本 brief 最核心的驗收條件，回歸保護網擋不住。
第二個同源後果：§9 刪掉舊的 router-hash 計算後，已無任何檢查把「頁面內有 inline script」與「CSP 不含 hash」綁在一起。將來任何人加 inline script，本機 check 全綠、production 被 `script-src 'self'` 靜默擋掉，只能靠瀏覽器發現。
建議：改成白名單語意——`type` 為 `application/ld+json`／`importmap`／`text/template` 才算 data，其餘（含空 type）一律算 executable。

**F3（低中，靜態確認）— `linku_lang` 殘留守門面比驗收條件窄**
§8 的新守門只讀 `assets/main.js`；`render.js`／`proof.js`／未來新增的 JS 重新引入語言偏好或導向不會被抓。建議掃 `assets/*.js`。（附帶查核：全 repo 目前除守門本身外無 `linku_lang`／舊 CSP hash 殘留；`docs/tasks/2026-07-16-optimization-closeout.md` 仍描述舊導向行為，但那是歷史 brief，依邊界不動＝正確。）

**F4（非問題，記錄以說明信心來源）— 語言切換器檢查的循環性已被外部檢查補住**
新的切換器檢查以頁面自身 `alternates` 當期望值，理論上循環。實測把 `/technology/` 的 ja alternate 與 ja 切換連結**一致地**改成 `/ja/`（自洽的錯頁型），`check.mjs` 仍以 6 個 FAIL 抓到（跨頁 reciprocity／sitemap 段補住）。負向控制：拿掉 en 的 `aria-current` → 1 FAIL，新檢查確實會叫。

**我獨立寫的驗收測試（只依 brief 驗收條件與邊界，不看實作邏輯）結果**
A1 九頁 `lang` 正確、零 inline executable、零 `linku_lang`／`navigator.languages`／`location.replace` 殘留 → PASS｜A2 `assets/*.js` 乾淨 → PASS｜A3 九頁 canonical／hreflang／sitemap 完整且本次未觸及 → PASS｜A4 切換器＝純連結、三語齊全、指向同頁型（期望值由 URL 自行推導，不採信頁面 alternates）→ PASS｜A5 `vercel.json` 除移除 router hash 外**逐位元不變**、無 `unsafe-inline`／`unsafe-eval` → PASS｜A6 三個英文頁差異僅為移除導向 script → PASS（我的測試曾誤報「Google Fonts 被改」，實為 regex 打到 CSP 字串內的 `fonts.googleapis.com`；人工確認字型 `<link>` 與 `&text=` 逐字未動）｜A7／A8 → FAIL，即 F1。
測試腳本：`%TEMP%\claude\D--LINKU-web\60e2558e…\scratchpad\xfire-accept.mjs`。F1 重現：對 `git show a2de67c:assets/render.js` 跑 §10 的四條 regex 皆不匹配、且該版本含 `aria-pressed`。F2 重現：如上注入 typed inline script 後跑 `node scripts/check.mjs`。

**信心與範圍聲明**：F1／F2／F4 皆有實測；F3 為靜態閱讀 diff 得出。審查後已把 mutation 用到的 `index.html`／`technology/index.html` 還原，SHA-256 對回 packet（`48bc74d6…`／`2545f608…`），工作樹未被污染。未驗證：Vercel Preview 實際 response header、Safari／Firefox／實機（實作方已列為 remaining risk，我不加碼）。方案 A 的語言行為本身（三個英文入口忠實留在英文、CSP 收緊、切換器與 SEO 未退化）我設法弄壞但找不到反例。
**非方向性分歧，不建議升級模式⑤。**

## 裁決（凜空）

- 決定: 採方案 A，移除自動語言重導，但不得犧牲任何其他既有部分；mobile proof 不採納、效能門檻稍後討論、過渡 Logo 暫不設計。
- 日期: 2026-09-02
