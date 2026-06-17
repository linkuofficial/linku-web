# linku-web

Linku Tech 官方網站 — linku.tech。靜態多語站，無 build，直接部署至 Vercel。

## 結構
- `index.html` — 英文（根 `/`，預設語言）
- `zh/index.html` — 繁體中文（`/zh/`）
- `ja/index.html` — 日本語（`/ja/`）
- `assets/styles.css`、`assets/main.js` — 三語共用的樣式與腳本（CSS/JS 已外置，改一處三頁生效）
- `sitemap.xml`、`robots.txt` — SEO

三頁以 `hreflang` 互指、各自 self-canonical；nav 右側語言切換器為純連結（`/`、`/zh/`、`/ja/`），無需 JS。

## 本機預覽
資源用絕對路徑 `/assets/...`，需透過 HTTP server 預覽（不能直接以 `file://` 開啟）：

```bash
python -m http.server 8080
# 瀏覽 http://localhost:8080/ 、 /zh/ 、 /ja/
```

## 編輯多語文案
各語言一個 HTML 檔，直接改對應檔的可見文字即可。

若 `zh/` 或 `ja/` 新增中文／日文字元，需同步更新該頁 `<head>` 內 Noto Sans 字型連結的 `&text=` 參數（只載入頁面實際用到的字以縮小體積；缺字會自動 fallback 至系統 CJK 字型，不會破版）。

> 日文文案目前為機械翻譯為底，建議上線前由母語者校稿（見 `ja/index.html` 頂部註解）。
