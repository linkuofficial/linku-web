# linku-web

Linku Tech 官方網站 — linku.tech。靜態多語站，無 build，直接部署至 Vercel。

## 結構
- `index.html`、`about/index.html`、`technology/index.html` — 英文三頁（根語系）
- `zh/`、`ja/` — 繁中與日文各三頁，共九頁
- `assets/styles.css` — 九頁共用樣式、無障礙與漸進增強規則
- `assets/main.js` — 導覽、reveal、游標與低成本微互動
- `assets/render.js` — 首頁 WebGL 機芯／內頁星場；reduced-motion 先顯示零 WebGL poster
- `assets/proof.js` — technology 頁的雙控制器模擬與鍵盤控制
- `sitemap.xml`、`robots.txt` — SEO
- `scripts/check.mjs`、`scripts/proof*.test.cjs` — 機械檢查與 proof 決定性測試
- `scripts/sync-font-text.mjs` — 依三語頁面可見正文同步 CJK Google Fonts 子集

每組三語頁以 `hreflang` 互指並各自 self-canonical；語言切換器為純連結，不依賴 JavaScript。正文預設可見，JavaScript 僅在成功啟動後套用 reveal 與自訂游標。

## 本機預覽
資源用絕對路徑 `/assets/...`，需透過 HTTP server 預覽（不能直接以 `file://` 開啟）：

```bash
python D:\LINKU\nocache_server.py
# 瀏覽 http://localhost:8080/、/about/、/technology/ 及 zh/、ja/ 對應頁
```

## 驗證

```bash
node scripts/proof.test.cjs
node scripts/proof-dynamics.test.cjs
node scripts/check.mjs
```

完成前另需透過本機 HTTP 實看三語 × 三頁及 ≤520px 窄屏。`check.mjs` 會檢查 canonical、hreflang、sitemap、CJK `&text=`、Brotli 資源預算、本地引用與外部 origin 白名單。

## 編輯多語文案
直接修改對應語言與路徑的 HTML 可見文字。

若 `zh/` 或 `ja/` 修改可見文字，執行 `node scripts/sync-font-text.mjs`；它會依各頁 `<body>` 可見文字更新 Noto Sans 的 `&text=` 參數。`check.mjs` 會同時攔截缺字與已不在正文中的過期 CJK 字元。

> 日文文案目前為機械翻譯為底，建議上線前由母語者校稿（見 `ja/index.html` 頂部註解）。
