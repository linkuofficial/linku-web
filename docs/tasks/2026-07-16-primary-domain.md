# TASK: primary-domain
狀態: done

## 目標

將 `https://linku.tech` 設為唯一正式主網址，讓 `https://www.linku.tech` 永久導向 apex，消除正式回應網址與 canonical／hreflang／OG／JSON-LD／sitemap 的矛盾。

## 驗收條件

- [x] `https://linku.tech/` 直接回應 200，不再導向 `www`。
- [x] `https://www.linku.tech/` 以 301 或 308 永久導向 `https://linku.tech/`。
- [x] 代表性子路徑能保留路徑與 query string 導向 apex。
- [x] HTTP 版本最終只收斂到相同的 HTTPS apex 主網址。
- [x] 九頁 canonical／hreflang／OG／JSON-LD 與 `sitemap.xml` 維持 apex，`node scripts/check.mjs` 全 PASS。

## 邊界（不要動的東西）

- 不修改 DNS registrar、nameserver、憑證、CI/CD、Production branch 或其他部署設定。
- 不新增 `vercel.json`；網域層轉址優先使用 Vercel 既有 Domains 設定。
- 不修改頁面文案、公司 facts、版面、控制模擬或無關檔案。
- 若 Vercel 介面要求刪除／重加網域、改 DNS 或出現不可逆影響，停止並交凜空裁決。

## Questions（Codex 填）

- 已裁決（2026-07-16）：凜空指定 `https://linku.tech` 為正式主站。

## HANDOFF（Codex 完成或卡住後填）

- Branch: `codex/optimization-closeout`
- Summary: 在 Vercel `linku-web` Domains 設定中，將 `linku.tech` 由 307 redirect 改為 Production，並將 `www.linku.tech` 由 Production 改為 308 redirect 至 `linku.tech`；未修改 DNS、憑證、Production branch、`vercel.json` 或頁面內容。
- Verification: Vercel 顯示 `linku.tech` 為 Valid Configuration / Production、`www.linku.tech` 為 Valid Configuration / 308 / `linku.tech`。外部 curl 驗證 apex HTTPS 200；www HTTPS 308；`/zh/about/?utm_source=domain-test` 與 `/ja/technology/?ref=domain-test` 均保留 path/query 並以一次轉址抵達 apex 200；兩個 HTTP origin 最終都收斂到 HTTPS apex。`node scripts/check.mjs` 25 PASS / 0 FAIL；`node scripts/proof.test.cjs`、`node scripts/proof-dynamics.test.cjs`、`git diff --check` PASS。
- Remaining risks: `http://www.linku.tech` 依序經過 HTTP→HTTPS www 與 www→HTTPS apex 兩次 308，屬正常協定升級流程；既有外部快取可能在短時間內仍保留舊 307，但目前 Vercel 香港 edge 已回傳新設定。
