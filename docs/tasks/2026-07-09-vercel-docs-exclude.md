# TASK: vercel-docs-exclude
狀態: 實作完成，待合併
建立: 2026-07-09 ｜ 秘書層: claude-fable-5 ｜ 實作層: claude-fable-5
Repo: web
Base: feat/rendering-upgrade（接續 rendering-upgrade）
Required verification: node scripts/check.mjs 全 PASS ＋ 確認無部署頁面引用 /docs/ ＋ 合併後 preview 實測 GET /docs/... 應 404
風險等級: 低（純減法：只把 docs/ 排出部署，不動任何路由/header/重寫）

## 觸發原因
部署設定變更＝AGENTS.md 強制交叉路徑，動之前必須有 brief。凜空 2026-07-09 裁決採方案 (a)
（部署層排除 /docs/）。此 brief 記錄該變更。

## 背景
web 為無 build 靜態站，整個 repo 直接部署 Vercel。rendering-upgrade branch 把兩份選定 prototype
（`docs/prototypes/c3-gimbal-studio.html`、`p2-same-hardware.html`）與任務簡報（`docs/tasks/*.md`）
入版控作記錄。Codex 交叉指出：這些檔案會隨部署變成 `linku.tech/docs/...` 公開可存取——
prototype 雖有 `noindex`，但簡報 `.md`（含內部策略脈絡）攤在外面。robots.txt 只擋爬蟲索引、
擋不住直接存取，且 robots.txt 是 rendering-upgrade brief 的邊界檔（已還原）。

## 變更
- 新增 `.vercelignore`（repo 根），內容排除整個 `docs/`。
- Vercel 部署時不上傳 docs/ → `linku.tech/docs/*` 回 404，內部簡報與 prototype 不再公開。
- 檔案仍留在 git repo（`.vercelignore` 只影響部署上傳，不影響版控）。

## 邊界（不動）
- 不新建 vercel.json（不需要——`.vercelignore` 即可達成）。
- 不動任何頁面、資產、SEO 中繼、sitemap、robots.txt、路由。
- 不影響 check.mjs（其 findIndexHtml 只掃 index.html，docs/ 下無 index.html）。

## 驗收條件
- [x] `node scripts/check.mjs` 全 PASS（不受影響，仍 22 項）
- [x] 全站 grep 確認無部署頁面引用 /docs/（html/xml/txt/css/js 皆無命中）
- [ ] 合併後於 Vercel preview 實測：`GET /docs/prototypes/c3-gimbal-studio.html` 應為 404、
      站內九頁與 /assets/ 一切正常（合併前無法測，preview 才有真實 Vercel 部署）

## Questions
無——方案 (a) 已由凜空裁決。

## HANDOFF
- Branch: `feat/rendering-upgrade`（與 rendering-upgrade 同 branch，獨立 commit）
- Summary: 新增 `.vercelignore` 排除 docs/；純減法、零頁面/路由變動。
- Verification: check.mjs 22 PASS；grep 全站零 /docs/ 引用；vercel.json 不存在亦不新建。
  合併後待 preview 實測 404。

## Review
### 內圈自審（claude-fable-5）
- 變更僅一個 `.vercelignore` 檔、一行有效內容（`docs/`），subtractive；風險面＝
  (1) 誤排除到會部署的檔？→ docs/ 下只有 prototype 與簡報，無 index.html/asset，grep 確認零引用。
  (2) `.vercelignore` 語法？→ 同 .gitignore 語法，`docs/` 排除整個目錄。
- 無正確性風險；SEO 不退步（本就不該索引 docs/）。
### 跨家族交叉（Codex）
- 觸發：部署設定＝強制交叉路徑。變更極小（單行減法、無路由/header/重寫）。
- Reviewer / Verdict: <待跑或凜空判斷是否對單行 .vercelignore 豁免>

## 裁決（凜空）
- 2026-07-09: 採方案 (a) 部署層排除 /docs/。
