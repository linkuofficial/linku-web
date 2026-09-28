# TASK: selective-ux-adoption
狀態: done

## 目標
Apply the reviewed A1–A3 and B1–B4 candidate to the working website after Riku explicitly approved all seven proposals with "全部採用" on 2026-09-28. Preserve the original 29ab005 snapshot and comparison package.

## 驗收條件
- [x] Adopt exactly the reviewed nine source/check files and interaction regression test.
- [x] Preserve the old snapshot and ZIP; leave unrelated tracked content unchanged.
- [x] Run site, interaction, simulation, and diff checks against this checkout.
- [x] Verify this checkout over local HTTP in all three languages.
- [x] Record the initial adoption and verification before release authorization.
- [x] Record release authorization and the publication plan; final publication evidence is stored separately in the comparison package's release record.

## 邊界（不要動的東西）
No further visual redesign, production dependencies, architecture changes, company-fact edits, physics/rendering algorithm changes, or CI/deployment/security configuration changes. The local comparison tool stays outside the website. Existing 320px English About overflow and native View Transition warnings stay outside this adoption. On 2026-09-28, Riku authorized committing, pushing, and publishing the approved scope with "可以推上去網站。" Use the existing GitHub/Vercel Production flow.

## Questions（Codex 填）
None. All seven proposals and their publication have explicit owner approval.

## HANDOFF（Codex 完成或卡住後填）
- Branch: codex/adopt-ux-review
- Summary: Applied A1 reduced motion, A2 paused input, A3 control scope/font coverage, B1 press feedback, B2 touch targets, B3 dense-text readability, and B4 idle/time-based cursor. Exact candidate bytes copied; rendering changes are only two button-title assignments.
- Preservation: `C:\Users\Riku\Documents\Codex\2026-09-28\apple-design-skill-1-apple-design\baseline`, `LINKU-original-29ab005.zip`, and comparison tool remain available. `adoption.json` records approval and expected source hashes.
- Verification: Site checks 27 PASS / 0 FAIL; interaction regression PASS; proof statistics PASS; dynamics PASS (48 scenarios); diff checks PASS. SHA-256 verification confirms the 43 expected implementation files, preserved 42-file baseline, and original ZIP. All 128 review variants and HTTP parity checks PASS. Chrome inspected actual Chinese, English, and Japanese technology pages; keyboard Pause disables simulation inputs and shows localized explanations, and Play restores controls. Comparison UI reports seven adopted decisions.
- Browser observations: Two native View Transition InvalidStateError messages (opt-in disabled) occurred during navigation. Pages loaded and controls worked; zero browser errors is not claimed. No transition implementation was changed.
- Release authorization: 2026-09-28, "可以推上去網站。" Before publishing, origin/main still matches baseline 29ab005. The existing GitHub remote is https://github.com/linkuofficial/linku-web.git. Deployment will use the established main branch without changing configuration. Post-release evidence will be recorded in the external comparison package's release record to avoid a documentation-only redeployment.
- Remaining risks: Physical-device/native-Japanese acceptance and known baseline limitations remain separate from the approved scope. Initial local adoption did not commit or deploy; publication is now authorized.
