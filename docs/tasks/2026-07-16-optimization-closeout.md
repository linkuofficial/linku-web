# TASK: optimization-closeout
狀態: done

## 目標

接續 2026-07-16 深度健檢與 `26b3520` 的第一輪修正，補齊可在 repo 內安全完成的回歸護欄、控制模擬邊界測試、觸控細節與遺留死碼；把需要正式部署裁決的網域、HTTP 安全標頭與快取策略明確留待凜空決定。

## 驗收條件

- [x] 語言自動導向的 query/hash 保留行為有機械化回歸檢查，三個英文入口不得漂移。
- [x] 九頁的 title、description、OG/Twitter 圖片替代文字、重複 ID、外連安全與語言切換 accessible name 有機械化檢查。
- [x] proof dynamics 除既有公開情境外，涵蓋正負干擾、不同目標與多 seed；所有案例不得出現未收斂或非有限狀態。
- [x] 手機品牌與語言切換具 44×44px 觸控區，鍵盤焦點清楚。
- [x] 移除第一輪後仍殘留、且九頁與 JS 均未使用的 CSS selector／token。
- [x] `node scripts/proof.test.cjs`、`node scripts/proof-dynamics.test.cjs`、`node scripts/check.mjs`、JS syntax check 與 `git diff --check` 全 PASS。
- [x] 本機 HTTP 實看三語×三頁桌面與 390px 窄屏，無明顯破版或水平溢位。

## 邊界（不要動的東西）

- 不直接修改 Vercel、DNS、正式網域、CI/CD 外部設定或部署。
- 未取得下列 Questions 裁決前，不新增 `vercel.json`，不決定 CSP／快取 header，不批次改寫 canonical origin。
- 不引入 production dependency、框架或 build step。
- 不更動公司 facts、公開技術定位、控制器參數或日文文案內容。

## Questions（Codex 填）

- 已裁決（2026-07-16）：`https://linku.tech` 為正式 primary origin；網域層修正另見 `docs/tasks/2026-07-16-primary-domain.md`。
- 已裁決（2026-07-17）：授權另開 deployment hardening；CSP 與安全標頭已由 `docs/tasks/2026-07-17-site-security-headers.md` 完成驗證與 Production 部署。資產快取 header 未納入該次變更。
- 日文仍以 AI 翻譯為底；母語校稿需要外部人工確認，無法由本次程式修改取代。

## HANDOFF（Codex 完成或卡住後填）

- Branch: `codex/optimization-closeout`
- Summary: 補上九頁 metadata／重複 ID／外連／i18n 與三個英文入口語言導向的機械化回歸檢查；手機品牌與語言切換完成 44×44px 觸控區並統一 focus-visible；移除第一輪遺留的 `.more`、`.pillar-desc`、`.project-meta`、`.badge` 與未使用 token；proof dynamics 擴充為 48 組多 seed、目標與正負干擾矩陣，困難邊界只要求穩定收斂、不製造「每次必勝」的假承諾。
- Verification: `node scripts/proof.test.cjs` PASS；`node scripts/proof-dynamics.test.cjs` PASS（公開情境 PID 2.90 s、model-based 1.23 s；48/48 收斂，46 組 model-based 較快）；`node scripts/check.mjs` 26 PASS / 0 FAIL；7 個 JS/MJS/CJS `node --check` PASS；`git diff --check` PASS；隔離 HTTP server 九頁 9/9 回應 200；Chrome 以 1440×900 與 390×844 產生 18 張三語×三頁首屏截圖並檢視，無明顯破版或水平溢位。Primary origin 與安全標頭的 Production 驗證分別記錄於同目錄的 `primary-domain` 與 `site-security-headers` task brief。
- Remaining risks: 資產快取策略仍維持 Vercel 預設，未另行設定；日文需母語者校稿；Safari／Firefox、實機、螢幕閱讀器與 Lighthouse 尚待實機驗收。
