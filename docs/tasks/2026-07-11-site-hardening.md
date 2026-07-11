# TASK: site-hardening
狀態: review

## 目標

依 2026-07-11 跨模型審查結果，修正互動證明的統計事件錯誤，並完成全站無障礙、no-JS 韌性、內頁初始化效能、維護文件與社群分享圖的收尾，使既有 rendering-upgrade 可安全進入 preview 驗收。

## 驗收條件

- [x] 游標／觸控改變 proof 目標時會重設安定時間統計，並有決定性測試覆蓋。
- [x] proof 提供鍵盤可操作的「新目標／干擾／暫停」控制；背景動畫對所有使用者提供全域暫停。
- [x] 九頁具 skip link、`main` landmark 與不跳級的標題層級；手機導覽具足夠觸控高度。
- [x] JavaScript 未執行或 IntersectionObserver 不可用時，正文與系統游標仍可使用。
- [x] 內頁不建構／烘焙／上傳首頁機芯幾何，reduced-motion 首幀不初始化 WebGL。
- [x] `node scripts/proof.test.cjs` 與 `node scripts/check.mjs` 全 PASS。
- [x] 本機 HTTP 實看三語×三頁與窄屏皆正常。

## 邊界（不要動的東西）

- 不動 `vercel.json`、`.vercelignore`、CI/CD、正式部署、網域或 DNS。
- 不引入框架、build step 或 production dependency。
- 不擅自決定 demo 的新對外定位、Founded／成立／設立的替代用字，或能力化文案的最終尺度。
- 保留既有未追蹤 prototype；不刪除、不移動、不納入本次修改。

## Questions（Codex 填）

- Demo 定位、成立年份標籤與 technology 四段能力化文案仍屬對外定位裁決；本次只記錄，不猜測措辭。

## HANDOFF（Codex 完成或卡住後填）

- Branch: `feat/rendering-upgrade`
- Summary: 修正 proof 目標事件統計；新增 seeded RNG hook 與純函式測試；三語 proof 常駐鍵盤控制；全域動畫暫停；九頁 main／skip link／h2；no-JS gates；手機雙列 nav；內頁跳過機芯幾何、AO、mesh shader/upload、MSAA/bloom FBO；reduced-motion 改零 WebGL poster；更新 OG 圖、README、sitemap、Brotli 預算與日文 Neblux facts 一致性。
- Verification: `node scripts/proof.test.cjs` PASS；`node scripts/check.mjs` 23 PASS；`git diff --check` PASS；no-cache HTTP 九頁皆 200；瀏覽器實看三語×三頁桌面與 390×844 窄屏，九頁無水平 overflow；proof 新目標／全域暫停實際操作成功；`#reduce` 驗證 canvas 保持 300px 預設尺寸且使用 data-SVG poster（未初始化 WebGL）。
- Remaining risks: Vercel preview 的 `/docs/*` 404、手機實機、Firefox／Safari 與 Lighthouse 尚需 preview 環境驗收。Demo 定位、Founded／成立／設立替代用字、technology 能力化文案仍待凜空裁決，本次未猜測。

## Review（2026-07-11）

- 內圈自審：程式語法、決定性測試、23 項靜態檢查、空白 diff 與九頁 HTTP／視覺驗證均通過。
- 結語：本輪把 rendering-upgrade 從視覺完成推進到可維護、可操作、可退化的交付狀態；剩餘項目皆需要 preview 或凜空的對外文案裁決，未超出本次授權猜測處理。
