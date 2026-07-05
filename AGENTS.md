# AGENTS.md — web（linku.tech 公司首頁）

> 靜態多語站（無 build），直接部署至 Vercel。Linku Tech 的**次要資產**：維護狀態、不擴張；可由 AI 完整生成程式碼。
> 本機工作區容器脈絡：`D:\LINKU\AGENTS.md`；**公司對外事實（文案、成立年、創辦人、描述）只改 `D:\LINKU\linku-company-facts.md` 再引用**，勿在頁面裡自創版本。
> 全域規則：Codex 讀 `~/.codex/AGENTS.md`、Claude 讀 `~/.claude/CLAUDE.md`。雲端/其他環境讀不到上述檔案時，以本檔自足。

## ⚡ 30 秒硬規則（先讀這裡）（2026-07-06）
- **驗證命令**：`node scripts/check.mjs`（機械化檢查 canonical / hreflang / sitemap / `&text=` 子集，任一 FAIL 即 exit 1，CI 同步跑）＋ 本機 http 實看三語頁面（`python D:\LINKU\nocache_server.py` → http://localhost:8080）。
- **改文案 SOP**（逐項勾完才算完成）：
  - [ ] 改 HTML 可見文字
  - [ ] 同步該頁 Google Fonts `<link>` 的 `&text=` 參數
  - [ ] 跑 `node scripts/check.mjs` 至全 PASS
  - [ ] 本機 http 實看該頁（連帶確認另兩語頁面未破版）
- **`vercel.json`／任何部署設定＝強制交叉路徑**：動之前必須有 brief（`docs/tasks/`），無 brief 不動手。
- **不確定 → 停**：寫進 brief 的 Questions 區交凜空裁決，禁止猜。

## 結構與 i18n（2026-06-16 多語升級）
- **多檔分頁**：`index.html`（en，根）+ `zh/index.html`（zh-Hant）+ `ja/index.html`（ja）。各頁 `<html lang>` + 互指 `hreflang`（en/zh-Hant/ja/x-default）+ self canonical + Open Graph。`sitemap.xml`、`robots.txt` 為 SEO。
- **共用資源外置**：CSS/JS 抽成 `assets/styles.css` + `assets/main.js`，三頁共用，皆以**絕對路徑** `/assets/...` 引用（Vercel 正確；本機預覽必須走 http server，不能 `file://`）。
- **語言切換器**：nav 右側純連結（`/`、`/zh/`、`/ja/`），無 JS。窄屏（≤520px）隱藏 nav-links 只留切換器。
- **CJK 字型（最容易踩的坑）**：Bebas Neue 無 CJK glyph，zh/ja 頁大標題改 Noto Sans TC/JP，以 Google Fonts `&text=` subset 只載該頁實際用字。**改文案必須同步更新該頁 `<link>` 的 `&text=` 參數**（缺字會 fallback 系統 CJK 字型，不破版但字重不同）。CJK 樣式覆寫集中在 `styles.css` 的 `html[lang="zh-Hant"]`/`[lang="ja"]` 區塊。

## 本機預覽
```bash
python D:\LINKU\nocache_server.py   # http://localhost:8080，no-cache（刻意放在 repo 外）
```

## 驗證門檻（宣稱完成前）
1. 本機 http 預覽三個語言頁面都實看（絕對路徑資源在 `file://` 下會壞，別誤判）。
2. 改文案後確認該頁 Google Fonts `&text=` 已同步。
3. 動到頁面結構時確認 `hreflang` 互指、canonical、OG tags 未破壞；新增頁面要進 `sitemap.xml`。
4. `node scripts/check.mjs` 全 PASS（2026-07-06 新增：機械化檢查上述 1–3 的 canonical / hreflang / sitemap / `&text=` 子集項目；CI 於 push/PR 亦會執行）。

## 待辦（2026-07-04 現況）
- 日文文案為機械翻譯為底，`ja/index.html` 內已標註，公開前建議母語者校稿。
- og:image 尚未提供正式版（facts sheet 記為 `assets/og-image.png` 1200×630）。

## 任務簡報
放 `docs/tasks/YYYY-MM-DD-slug.md`（目錄不存在就建）。模板見 `D:\LINKU\docs\tasks\TEMPLATE.md` 或 `~/.codex/AGENTS.md` §13。
