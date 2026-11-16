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
- **View Transition gate（2026-10-01）**：每頁 `<head>` 的 `styles.css` `<link>` 之後必須緊接同步的 `<script src="/assets/vt-gate.js"></script>`（空檔，用途見檔內註解；check §11 會擋）。新增頁面照抄，不可加 `async`／`defer`。
- **語言切換器**：nav 右側純連結（`/`、`/zh/`、`/ja/`），無 JS。窄屏（≤520px）隱藏 nav-links 只留切換器。
- **CJK 字型（最容易踩的坑）**：Bebas Neue 無 CJK glyph，zh/ja 頁大標題改 Noto Sans TC/JP，以 Google Fonts `&text=` subset 只載該頁實際用字。**改文案必須同步更新該頁 `<link>` 的 `&text=` 參數**（缺字會 fallback 系統 CJK 字型，不破版但字重不同）。CJK 樣式覆寫集中在 `styles.css` 的 `html[lang="zh-Hant"]`/`[lang="ja"]` 區塊。

## 動態系統（2026-11-13 kinetic-wall；簡報 `docs/tasks/2026-11-13-kinetic-wall.md`）
- **首頁背景＝機械針床**（`assets/render.js`，WebGL2；2026-11-13 第三個方向，前兩個——翻轉鏡片牆、磁流體池——同日被否決；2026-11-14 依「優化」「做更細」加密到約 6 萬根針，同日凜空裁決採用：「可以，就這版」）；內頁仍是深空星點。高度場、伺服、受光都在 GPU 上（浮點貼圖）；數字與字標是 shader 內的筆畫距離場，場景**不得依賴字型或網路**（check §10 會擋）。場著色器裡的尺寸一律是「設計單位」（`uU`＝每單位幾根針）：要改針的疏密只動 `layout()` 的 `base`，不要去改各個形狀的常數。被否決版本的完整工作樹留在 git ref `refs/backup/kinetic-wall`、`refs/backup/ferrofluid`；加密前的針床在 `refs/backup/pinbed-v1`；2026-11-14 細節升級（珠子互相映照、半影、開機掃描、高解析自動銳化）之前、凜空說「可以，就這版」的狀態在 `refs/backup/pinbed-v2`；同日他點名「支撐的柱子不好看」，軸與軸環重做成細鋼軸＋車削金色軸環，重做前的狀態在 `refs/backup/pinbed-v3`；他對支撐柱說「可以」，該版在 `refs/backup/pinbed-v4`。其後依「做到能參賽等級」加了游標尾跡與聚光、棚燈光帶（2026-11-14 收尾時的狀態在 `refs/backup/pinbed-v5`）；他看過後說「不錯，但前面跟後面沒有協調好。視覺會被後面的動畫搶走」，同日做了前後景協調一輪，2026-11-15 他看過整頁錄影後說「可以」（採用版在 `refs/backup/pinbed-v6`；待裁事項見簡報的「HANDOFF（2026-11-14 收尾）」）。2026-11-16 依「把未做的幾項做好」處理了 T4、404 頁、社群分享圖與 Questions 2–4（簡報「2026-11-16 未做項目收尾」；備份 `refs/backup/pinbed-v7`，一般 commit，取回用 `git restore --source=<ref> --worktree -- .`）。
- **文字帶頭，針床回應（2026-11-14）**：針床不做跟前景無關的定時動態（定時光帶因此拿掉）；首頁主體在標題到位後才升起、變形放慢。游標的下壓／尾跡／聚光共用 `computeState()` 的 `keep` 遮罩：游標在文字欄上方時關閉，各章節另以 `KF[].ptr` 設上限（理念 0.4、作品 0）。新增章節或改構圖時：亮的、會動的東西放在文字旁邊或下方，不要放在文字正後方（「理念」段就是這樣被改掉的），`ptr` 要一起定。
- **排版動效與捲動編排在 `assets/main.js`**；一律是增強層：無 JS、JS 失敗、reduced-motion 都必須完整可讀。**不得劫持或改寫原生捲動**（check §10 會擋 wheel／scrollTo）。檔案開頭有一個 `error` 保護網（main.js 出錯就拿掉 `html.js`、放開所有遮罩），最後一行的 `js-ready` 是它的判斷依據：**新增區塊一律放在那一行之前**。
- **環境動態一定要停得下來**：播放／暫停鈕（`.scene-toggle`）與 `html.motion-paused` 由 render.js 擁有，其他動態（跑馬燈、technology 頁的模擬）跟著它走。跑馬燈只在按鈕存在且為播放狀態時移動——不要加回 CSS 的自動捲動（沒有 WebGL／JS 時就沒有按鈕可停）。
- **幀率治理（render.js `loop()`）**：量的是 rAF 回呼的節拍（不論該幀有沒有畫，所以閒置節流時照樣在量）；低於 40 fps 只降內部解析度，低於 26 才定格。30 Hz 是合法的畫面更新率（iOS 低耗電模式、省電模式），不是跑不動；不要把定格門檻調回 30 以上。
- **改首頁 Hero 標題文案時**（三語）：`.hero-title` 每個字元各包一個 `<span class="c">`、每行 span 帶 `aria-hidden="true"`、`<h1>` 的 `aria-label` 要同步成整句（check §6 會擋）；CJK 仍要同步 `&text=`。
- **`.marquee` 是頁尾句的裝飾性重複**：文字必須逐字等於該頁 `<footer>` 最後一句，改頁尾句要一起改（check §6 會擋）；不要把新文案放進跑馬燈；項目數必須是偶數（軌道以一半寬度循環）。
- **改 `check.mjs` 的正則後要做變異測試**：故意寫一個違規、確認它 FAIL，再還原。2026-11-14 發現三條護欄的 `\b` 被寫成字面退格字元，從沒擋過東西——用腳本或 heredoc 產生含反斜線的程式碼時特別容易發生，寫完用 `grep -P '[\x00-\x08]'` 掃一次。
- 支柱章節的 `.pin-stage` 只在寬 ≥900／高 ≥600 且非 reduced-motion 時由 main.js 開啟釘選；其餘情況就是一般清單。新增第四個支柱前先讀 main.js 的 `ticks.length === 3` 與 styles.css 的 `/ 03`、`height: 400vh`。
- **頁內搜尋（Ctrl+F）要找得到也看得到（2026-11-16，T4）**：不在台上的支柱由 main.js 停在畫面外（`--off`：往左 200vw，高度對齊它那段捲動的中間），搜尋命中時瀏覽器的原生捲動會把它帶上台——不要改回「疊在舞台上、只靠透明隱藏」，也不要用 `scrollTo`／`scrollIntoView` 去補。逐字遮罩（`.w`／`.wi`）只在字移動時是 `inline-block`（`w-mask` 動畫），靜止時是一般行內文字，因為 Chromium 的搜尋不跨 `inline-block` 比對片語；遮罩用 `overflow: clip`（`hidden` 會被搜尋捲動）。代價是動畫結束時有 0～1px 次像素位移。Hero 大標題整句仍搜不到（捲出動畫需要各行是 `inline-block`）。
- 視覺驗證手法：面板 rAF 會被節流，改用 `web-verify`（8081）＋raw CDP 無頭 Chrome；桌面視口不要用 `deviceScaleFactor: 2` 截全頁（會卡死），用較小視口配 1.6 或局部 clip。全幅 1080p 的截圖用 JPEG：PNG 超過約 4 MiB 時 CDP 的 WebSocket 回應會被丟掉，看起來像頁面卡死（2026-11-14 為此誤判了很久）。

## 本機預覽
```bash
python D:\LINKU\nocache_server.py   # http://localhost:8080，no-cache（刻意放在 repo 外）
```

## 驗證門檻（宣稱完成前）
1. 本機 http 預覽三個語言頁面都實看（絕對路徑資源在 `file://` 下會壞，別誤判）。
2. 改文案後確認該頁 Google Fonts `&text=` 已同步。
3. 動到頁面結構時確認 `hreflang` 互指、canonical、OG tags 未破壞；新增頁面要進 `sitemap.xml`。**例外：`404.html`**（2026-11-16）——Vercel 對任何不存在的路徑都回它，所以一頁三語並列、`noindex`、不宣告 canonical／hreflang、不進 sitemap；中日文段落各自帶 `lang`，字型子集各一條 `&text=`（check §12 會擋）。改它的文案時照改文案 SOP 同步 `&text=`。
4. `node scripts/check.mjs` 全 PASS（2026-07-06 新增：機械化檢查上述 1–3 的 canonical / hreflang / sitemap / `&text=` 子集項目；CI 於 push/PR 亦會執行）。

## 待辦（2026-07-04 現況）
- 日文文案為機械翻譯為底，`ja/index.html` 內已標註，公開前建議母語者校稿。
- ~~og:image 尚未提供正式版~~ 2026-11-16 已換成針床渲染（`assets/og-image.png` 1200×630：以 2× 拍首頁針床的階梯金字塔再縮小，左側品牌字＋標語＋網域）。九頁的分享圖網址帶 `?v=<sha256 前 8 碼>`，**換圖時要一起改**，否則社群平台沿用快取。`assets/og-image.svg` 是 7 月舊圖的原始檔，已不對應。

## 任務簡報
放 `docs/tasks/YYYY-MM-DD-slug.md`（目錄不存在就建）。模板見 `D:\LINKU\docs\tasks\TEMPLATE.md` 或 `~/.codex/AGENTS.md` §13。
