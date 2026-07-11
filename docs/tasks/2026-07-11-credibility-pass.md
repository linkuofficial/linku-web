# TASK: credibility-pass
狀態: done

## 目標

收斂 LINKU 官網的對外承諾與技術展示：將控制器比較明確定位為模擬研究，改寫未經實體量測支持的絕對敘述，並補上可重現測試與字型子集維護工具。

## 驗收條件

- [x] 公司 facts 先更新，再同步三語 About 與 Technology 文案
- [x] Founded／成立／設立改為不暗示法人登記的活動起始用字
- [x] proof 明示同一模擬 plant 的控制策略比較，且不宣稱為實體硬體證明
- [x] About 三語頁可見 GitHub 連結
- [x] proof 動態有 seeded、決定性的迴歸測試
- [x] CJK Google Fonts `&text=` 可自動同步，檢查會攔截缺字與過期字元
- [x] `node scripts/check.mjs` 與 proof tests 全部通過
- [x] 本機 HTTP 實看三語 Technology／About 桌面與手機版

## 邊界（不要動的東西）

- 不改部署設定、網域、分析工具或 CI/CD
- 不增加 production dependency 或新頁面
- 不把控制模擬包裝成實體量測、產品規格或商業成果

## Questions（Codex 填）

- 無。Riku 已於本 task 明確同意依審查建議執行文案定位與維護性修正。

## HANDOFF（Codex 完成或卡住後填）

- Branch: `feat/rendering-upgrade`
- Summary: 收斂三語對外承諾；將 proof 重定位為控制模擬；About 使用活動起始用字並增加 GitHub；抽出共用動態核心、加入 seeded 迴歸測試與字型子集同步工具；手機 proof 畫布由 420px 上限降至 330px。
- Verification: `node scripts/proof.test.cjs`; `node scripts/proof-dynamics.test.cjs`（PID 2.90 s、model-based 1.23 s）; `node scripts/check.mjs`（24 PASS / 0 FAIL）; `git diff --check`; 本機 HTTP 以 1440×900 與 390×844 實看 EN/ZH/JA Technology/About，無水平溢位、控制鈕高度皆 44px、console 無 error/warning。
- Remaining risks: 日文仍以 AI 翻譯為底；正式公開或進行日文市場溝通前，建議由母語者校稿。控制模擬不是實機量測，頁面已明示此限制。
