# TASK: vercelignore-scope
狀態: done（2026-11-16 PR linkuofficial/linku-web#6 合併為 `1bfa7ba`，已部署並在正式站驗證）
建立: 2026-11-16 ｜ 秘書層: claude-opus-5-5 ｜ 實作層: claude-opus-5-5
Repo: web
Base: main @ 5b9c479（未提交工作樹）
Required verification: `node scripts/check.mjs` 全 PASS（含新增的 §13）＋ §13 變異測試 ＋ 本機 Vercel 模擬逐路徑探測；合併時看 PR 的 Vercel 預覽部署狀態，合併後正式站逐路徑探測
風險等級: 高(強制交叉)——`.vercelignore` 屬部署設定＝AGENTS.md 強制交叉路徑；變更本身是減法

## 觸發原因
2026-11-16 部署 kinetic-wall 後驗正式站時發現：`.vercelignore` 只排除 `docs/`，repo 的規則檔與工具檔在 linku.tech 上可以直接讀到。凜空同日回「要」，同意我提的做法：寫 brief、跑交叉審查、改 `.vercelignore`，然後停下等他裁決，不 commit。

## 現況（2026-11-16 正式站實測）
| 路徑 | HTTP |
|---|---|
| `/AGENTS.md`、`/CLAUDE.md` | 200（text/markdown） |
| `/scripts/check.mjs`、`proof.test.cjs`、`proof-dynamics.test.cjs`、`sync-font-text.mjs`、`ux-interaction.test.cjs` | 200 |
| `/.github/workflows/check.yml` | 200 |
| `/README.md`、`/vercel.json`、`/.gitignore`、`/.vercelignore` | 404（Vercel 本身不提供；README 為何 404 不確定） |
| `/docs/...` | 404（既有的 `.vercelignore`） |

這些內容本來就在公開的 GitHub repo 上，沒有新的洩漏。問題在於公司網域上掛著給 AI 代理讀的規則檔和測試腳本：看起來不專業，可能被搜尋引擎收錄，而且規則檔會隨工作區演進，持續把更多內部脈絡放上網域。

## 目標
正式站只提供網站需要的檔案（頁面、`assets/`、站台根檔），規則檔、說明檔、工具與 CI 設定不再上線。並且不讓它默默退化：新增檔案時如果沒決定它該不該公開，check 會擋下。

## 變更
1. **`.vercelignore`** 新增排除 `AGENTS.md`、`CLAUDE.md`、`README.md`、`scripts/`、`.github/`。
   - 只用和既有 `docs/` 同一種寫法（不加前導 `/`、不用萬用字元或否定），因為只有這種寫法在本站的 Vercel 部署上實證過。
   - 這種寫法在任何深度都會比對；目前沒有任何頁面或資源的路徑含這些名稱。
   - `README.md` 現在已經是 404，明列是為了不依賴平台的預設行為。
2. **`scripts/check.mjs` 新增 §13「部署範圍」**：列出 git 追蹤中、以及未追蹤但沒被 `.gitignore` 忽略的檔案，每一個都必須屬於下列三類之一。
   - **公開**：任何 `index.html`、`404.html`、`assets/` 底下的檔案、`favicon.ico`、`apple-touch-icon.png`、`robots.txt`、`sitemap.xml`。
   - **平台設定**：`vercel.json`、`.vercelignore`、`.gitignore`（正式站實測都是 404）。
   - **被 `.vercelignore` 排除**。

   FAIL 的情況：
   - 公開或平台設定的檔案被排除：防止頁面誤排除後 404，或安全標頭設定被排除。
   - 其他檔案沒被排除：防止新檔案默默上線。
   - `.vercelignore` 出現「名稱」「名稱/」以外的寫法：要求先擴充這項檢查，避免檢查和 Vercel 對規則的解讀分岔。
3. **`AGENTS.md`（web）**：把「`.vercelignore` 目前只排除 `docs/`…未處理」改成新規則，並寫明新增檔案時要歸類（§13 會擋）。

## 選擇與理由
- **用黑名單，不用白名單**（白名單＝`/*` 全部排除，再用 `!` 逐項放行）。
  - 白名單把「新檔預設不公開」做在 Vercel 端，但要用否定和前導斜線，這兩種寫法在本站沒有實證過。
  - 白名單下 `vercel.json` 會被 `/*` 涵蓋，排除它之後安全標頭還會不會生效，我不確定。
  - 黑名單只用實證過的寫法；「新檔預設不公開」改由 §13 在 CI 擋下。
- **§13 用 `git ls-files` 列檔**：Vercel 從 Git 部署時，上傳的就是追蹤中的檔案。加上未追蹤、未被忽略的檔案，本機在 commit 之前就會看到 FAIL。

## 驗收條件
- [x] `node scripts/check.mjs` 全 PASS（30 → 31 項）
- [x] §13 變異測試，以下每一種都要 FAIL，全部還原後回到 PASS：
  - 拿掉 `scripts/`
  - 加上 `assets/`
  - 加上 `*.md`
  - 把 `docs/` 改成 `/docs/`
  - 加上 `vercel.json`
  - 新增未追蹤的 `notes.txt`
- [x] `grep -P '[\x00-\x08]' scripts/check.mjs` 沒有命中（正則被工具吃掉反斜線的舊坑）
- [x] 本機 Vercel 模擬：九頁、404 頁、`assets/`、站台根檔回 200；被排除的路徑回 404
- [x] （合併時）PR 的 Vercel 預覽部署成功，代表沒有建置步驟依賴被排除的檔案
- [x] （合併後）正式站逐路徑探測：規則檔與工具檔 404，頁面與資源 200

## 邊界（不動）
- `vercel.json`、所有頁面與資源、`sitemap.xml`、`robots.txt`、CI workflow 的內容。
- `assets/og-image.svg`：舊分享圖的原始檔，沒有頁面引用但仍公開。它不含內部資訊，不在這次範圍。
- 不 commit、不部署，等凜空裁決。

## Questions
1. Vercel 專案在 dashboard 上的建置設定（Build Command、Ignored Build Step）我看不到：本機 Vercel CLI 沒有登入，我沒有替你登入。
   - 如果其中引用了 `scripts/`，排除後部署會失敗；正式站不受影響，因為 Vercel 不會上線失敗的部署。
   - 合併前看 PR 的預覽部署狀態就知道。
   - **已解（2026-11-16）**：PR #6 的 Vercel 預覽部署成功（「Deployment has completed」），所以沒有建置步驟依賴被排除的檔案。
2. 用 CLI 部署（`vercel` 指令）時，Vercel 會上傳本機的未追蹤檔（例如 `.claude/`）。目前一律走 Git 部署，所以這次不處理；之後若改用 CLI 部署再處理。

## HANDOFF
- Branch: main（未提交工作樹；改動：`.vercelignore`、`scripts/check.mjs`、`AGENTS.md`，加上這份簡報）
- Summary: `.vercelignore` 加排除 `scripts/`、`.github/`、`AGENTS.md`、`CLAUDE.md`、`README.md`；check §13 要求 repo 每個檔案都歸類為公開、平台設定或被排除。
- Verification（2026-11-16）：
  - `node scripts/check.mjs`：31 項全 PASS。§13 的結果：54 個檔案，25 個公開、26 個被排除、3 個平台設定。
  - §13 變異測試共 10 種，都 FAIL（exit 1），還原後回到 PASS。除了驗收條件列的 6 種，另加：
    - 加上 `index.html`
    - 加上 `!docs/`
    - 前導空白的 ` scripts/`
    - 沒有 git 可用（PATH 清空）
  - 正則沒有控制字元，`node --check` 通過。
  - CI 的其他步驟在本機都通過：`proof.test.cjs`、`proof-dynamics.test.cjs`，以及全部 JS 的語法檢查。
  - 本機 Vercel 模擬（照 `vercel.json` 加標頭、照 `.vercelignore` 排除、找不到就回 404）共探測 52 條路徑，全部符合預期：
    - 回 200（25 條）：九頁、`/404.html`、`assets/` 底下 11 個檔、4 個站台根檔
    - 回 404（27 條）：3 個規則／說明檔、`scripts/` 5 檔、`.github/` 1 檔、`docs/` 17 檔、一個不存在的路徑
- Remaining risks:
  - 模擬伺服器實作的是我對規則的解讀；Vercel 實際怎麼解讀，要合併後在正式站探測才算數。新規則只用和 `docs/` 同一種實證過的寫法，而且沒有任何頁面或資源的路徑含這些名稱，所以誤排除的空間很小。
  - Vercel 的 dashboard 建置設定看不到（見 Questions 1），PR 的預覽部署狀態會揭曉。
  - §13 把任何位置的 `index.html` 都當成公開頁面。若日後在 `docs/` 底下放 `index.html`，§13 會判成「被排除的公開頁」而 FAIL；這和 §1 原本就把所有 `index.html` 當頁面掃的限制一致。

### 部署（2026-11-16，凜空對「開 PR 並部署」回「要」）
- 流程：commit `dc59acc`（分支 `fix/vercelignore-scope`）→ PR linkuofficial/linku-web#6 → 合併為 `1bfa7ba` → Vercel 自動部署到正式站。
- PR 檢查：
  - CI 兩輪（push、pull_request）都通過；CI 的紀錄裡 §13 實際跑了：54 個檔案都歸類，31 項全 PASS。
  - Vercel 預覽部署成功。
- 正式站驗證（合併後約 15 秒生效）：
  - 用和本機模擬同一組 52 條路徑探測，全部符合預期：九頁、404 頁、`assets/`、站台根檔回 200；`/AGENTS.md`、`/CLAUDE.md`、`/README.md`、`scripts/`、`.github/`、`docs/` 回 404。
  - 五個安全標頭都在。
  - `index.html`、`main.js`、`render.js`、`styles.css`、`404.html` 的線上內容和 `git show 1bfa7ba:` 逐位元組相同。
- 仍成立的限制（審查 Finding 2）：§13 FAIL 只會讓 GitHub CI 變紅，Vercel 的 Git 部署不等 CI，照樣會上線。這是本站所有檢查共通的既有情況，這次沒有改。
- 分支 `fix/vercelignore-scope`（本機與遠端）確認完全併入 main 後已刪。

## Review
- **Reviewer**：Codex（GPT-6 家族；與實作者 Claude 不同家族）
- **模式**：② 獨立驗收測試＋③ 對抗性驗證
- **觸發原因**：`.vercelignore` 屬部署設定，觸發強制交叉審查。
- **Verdict**：**approve**
- **範圍**：僅審查提供的 brief、diff、repo AGENTS.md。未使用工具、未讀取其他檔案、未修改或執行程式。此結論允許交凜空裁決，不代表部署驗收完成。

### Findings

**未發現可由本 packet 證明的阻擋性錯誤。信心：中等。**

依 brief 的分類規則推演，§13 會拒絕未分類檔案、被排除的公開／平台檔案，以及不支援的規則語法。Git 列檔失敗也會累積 FAIL，不會走成功分支。diff 未修改 brief 禁止變更的頁面、資源、`vercel.json` 或 CI workflow。

以下限制仍須保留：

1. **本機模擬無法證明 Vercel 實際部署結果。**  
   若平台的規則解讀或建置設定與模擬不同，本機仍可能通過、預覽部署卻失敗或輸出不同。brief 已揭露此限制，因此不列為新阻擋項；預覽部署成功及正式站逐路徑探測仍未完成。預覽「成功」本身也不證明被排除路徑實際回 404。

2. **§13 的 FAIL 與「阻止部署」是不同的保證。**  
   新增 `notes.txt` 時，此程式會報 FAIL；packet 未提供 CI 與部署之間的阻擋設定，不能據此確認失敗的 CI 一定阻止 Vercel 發布。此處核准的是 brief 明訂的檢查行為，不額外認定發布流程已有此保證。

### 獨立驗收測試

下列預期取自 brief 的分類與 FAIL 條件。**測試已撰寫，未執行**；不將 brief 裡實作者回報的通過結果當成本次親自驗證。

這個記憶體測試器接收 packet 中從 `// ---------- 13. 部署範圍 ----------` 到「總結」之前的原始程式碼作為 `source`，不需要讀取 repo。它驗證 §13 的判定，完整腳本的 exit code 仍須另行驗證。

```js
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

export function reviewSection13(source) {
  const baselineRules = [
    'docs/', 'scripts/', '.github/',
    'AGENTS.md', 'CLAUDE.md', 'README.md',
  ];

  const baselineFiles = [
    'index.html', 'zh/index.html', 'ja/index.html',
    '404.html', 'assets/main.js',
    'favicon.ico', 'apple-touch-icon.png',
    'robots.txt', 'sitemap.xml',
    'vercel.json', '.vercelignore', '.gitignore',
    'AGENTS.md', 'CLAUDE.md', 'README.md',
    'scripts/check.mjs', '.github/workflows/check.yml',
    'docs/tasks/review.md',
  ];

  const cases = [
    { name: 'baseline', ok: true },
    {
      name: 'remove scripts exclusion',
      remove: 'scripts/',
      ok: false,
    },
    ...[
      'assets/', '*.md', 'vercel.json', 'index.html',
      '!docs/', ' scripts/', 'docs/tasks/',
    ].map(rule => ({
      name: `reject rule: ${rule}`,
      addRule: rule,
      ok: false,
    })),
    {
      name: 'reject anchored docs rule',
      remove: 'docs/',
      addRule: '/docs/',
      ok: false,
    },
    {
      name: 'reject unclassified file',
      addFile: 'notes.txt',
      ok: false,
    },
    {
      name: 'reject dirty filename',
      addFile: 'notes\nprivate.txt',
      ok: false,
    },
    {
      name: 'exclude directory at nested depth',
      addFile: 'nested/scripts/helper.js',
      ok: true,
    },
    {
      name: 'directory rule must not exclude same-name file',
      addFile: 'nested/scripts',
      ok: false,
    },
    {
      name: 'exclude plain name at nested depth',
      addFile: 'nested/README.md',
      ok: true,
    },
    {
      name: 'public asset conflicts with plain-name exclusion',
      addFile: 'assets/README.md',
      ok: false,
    },
    {
      name: 'public index conflicts with directory exclusion',
      addFile: 'docs/index.html',
      ok: false,
    },
    {
      name: 'platform exemption applies only at root',
      addFile: 'nested/vercel.json',
      ok: false,
    },
    {
      name: 'git unavailable must fail',
      gitError: true,
      ok: false,
    },
    { name: 'baseline after mutations', ok: true },
  ];

  for (const c of cases) {
    const rules = baselineRules.filter(r => r !== c.remove);
    if (c.addRule) rules.push(c.addRule);

    const files = [...baselineFiles];
    if (c.addFile) files.push(c.addFile);

    const passes = [];
    const failures = [];

    runInNewContext(source, {
      ROOT: '/fixture',
      SITE: 'https://example.test',
      path: { join: (...parts) => parts.join('/') },
      readText: () => rules.join('\n'),
      execFileSync: (command, args, options) => {
        assert.equal(command, 'git');
        assert.deepEqual(Array.from(args), [
          'ls-files', '-z', '--cached',
          '--others', '--exclude-standard',
        ]);
        assert.equal(options.cwd, '/fixture');
        assert.equal(options.encoding, 'utf8');
        if (c.gitError) throw new Error('git unavailable');
        return files.join('\0') + '\0';
      },
      pass: message => passes.push(message),
      fail: message => failures.push(message),
      console: { log() {} },
    });

    assert.equal(passes.length, c.ok ? 1 : 0, c.name);
    assert.equal(failures.length > 0, !c.ok, c.name);
  }

  return `${cases.length} cases passed`;
}
```

另須由實際驗證環境保留以下整合測試：

- **Git 狀態差異**：未追蹤且未忽略的 `notes.txt` 必須 FAIL；被忽略且未追蹤時不納入；強制追蹤後即使符合 `.gitignore` 仍必須 FAIL。
- **完整命令**：每個必要變異使 `node scripts/check.mjs` exit 1，還原後 exit 0；控制字元掃描無命中。
- **部署行為**：公開路徑保持預期回應，規則檔、工具與 CI 路徑回 404。實際平台結果須與本機模擬分別記錄。

### 裁決與交付狀態

沒有方向性分歧，無須升級模式⑤。本輪審查到此為止；由呼叫方將本區塊原樣貼回 brief，再交凜空裁決。尚未落檔，亦未完成預覽或正式站驗收。

### 代跑審查者的測試（實作方，2026-11-16；只記結果，不回應 findings）
- 記憶體測試器：從上面的程式碼區塊原樣取出，套在 `scripts/check.mjs` 的 §13 原始碼上執行，結果 `20 cases passed`。
- 「Git 狀態差異」整合測試：
  - 被 `.gitignore` 忽略的未追蹤檔（`index.legacy.20260605.html`）不納入檢查，§13 PASS，exit 0。
  - 用 `git add -f` 強制追蹤同一個檔案後，§13 FAIL，exit 1。
  - 測完已還原：`git rm --cached` 並刪除該檔，工作樹與測試前相同。
- 「完整命令」與控制字元掃描見 HANDOFF。
- 「部署行為」（Vercel 實際結果）仍未驗：要合併後才能測。

## 裁決（凜空）
- 2026-11-16：「要」——處理規則檔公開的問題（範圍：brief、交叉審查、改 `.vercelignore`，停在等裁決、不 commit）。
- 2026-11-16：「要」——開 PR 並部署（CI 與預覽部署成功後合併，再到正式站逐路徑驗）。
