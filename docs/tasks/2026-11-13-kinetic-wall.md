# TASK: kinetic-wall
狀態: **方向三（機械針床，加密版）2026-11-14 獲凜空採用** — 鏡片牆、磁流體已否決；動效系統保留。**Codex 交叉審查已跑（2026-11-14）：`fix-needed`；F1–F3 已修並通過審查者測試，T4（釘選時頁內搜尋）待凜空定方向**（見 Review）。同日依他的指示陸續做了細節升級、支撐柱重做（已獲「可以」）與參賽等級一輪（游標尾跡與聚光等，**待他實看**）。**2026-11-14 已收尾**：現況、還原點、等他決定的事都在「HANDOFF（2026-11-14 收尾）」。收尾後他看了錄影，指出背景動畫搶走前景的注意力，同日做了「前後景協調」一輪，**2026-11-15 他看過整頁錄影後說「可以」**（採用版＝`refs/backup/pinbed-v6`）。**2026-11-16 他說「把未做的幾項做好」**：T4、自訂 404、社群分享圖、Questions 2–4、F1–F3 都已處理（見「2026-11-16 未做項目收尾」，備份 `refs/backup/pinbed-v7`）；**2026-11-16 他說「確認沒問題後commit+push 完整部署並收尾」：已部署上線**（commit `60d1f79`，PR linkuofficial/linku-web#5 合併為 `a0f7cb5`，Vercel 正式站與合併內容逐位元組相同；部署驗證見「2026-11-16 部署與收尾」）。**狀態：done**
建立: 2026-11-13 ｜ 秘書層＋實作層: claude-fable-5-2（同一 session，見 Review 區）
Repo: web
Base: main @ 21df14e ｜ Branch: feat/kinetic-wall
Required verification: `node scripts/check.mjs` 全 PASS ＋ proof／ux tests ＋ JS syntax ＋ 本機 http 三語九頁、多尺寸、reduced-motion、無 JS 實看
風險等級: 中 — 動三語九頁共用的 render.js／main.js／styles.css 與首頁結構；不碰部署設定、SEO 中繼資料、文案

## 目標

凜空 2026-11-13 指示「對網頁進行升級甚至重構，整個動態美學要有頂級參賽水準」。把首頁自 2026-09-02 起留白的背景，換成新的藝術方向，並把全站的排版動效、捲動編排與跨頁轉場升到同一個水準；維持零依賴、無 build、嚴格 CSP、文案零變動。

## 凜空裁決（2026-11-13，動工前以選項形式確認）

| 題目 | 裁決 |
|---|---|
| 首頁主視覺藝術方向 | **翻轉鏡片牆**（flip-disc 動力牆；另兩案：機械針床、軸環機芯 v2 未採） |
| 範圍 | **全站九頁**（首頁完整敘事；內頁升級排版動效與轉場，背景維持深空星點，控制模擬 v5 不動） |
| 手機策略 | **手機也跑即時**（推翻 9/2「首頁不跑 WebGL」；不新增裝置判準，沿用既有 FPS 降階） |

此裁決取代 `2026-09-02-remove-home-static-poster.md` 的「首頁留白待藝術方向」，`check.mjs` §10 對應條文同步改寫。

## 方案

> **給審查者**：下面「鏡片牆」一節是已否決版本的紀錄，程式碼已不在工作樹。現行主體＝文末「方向三：機械針床」＋「2026-11-14 優化與加密」；「排版動效與編排」「結構變更」「驗收條件」「邊界」仍然有效。Questions 1 已失效。

### 鏡片牆（已否決；`assets/render.js`，WebGL2，零依賴）
- 數千片伺服翻轉的圓片（黑色陽極旋紋面／緞面香檳金屬面）嵌在車削背板上。每片有自己的二階伺服（ζ≈0.55，帶質量與微過衝、限速），所以影像以機械連鎖到達，而不是淡入。
- CPU 場決定牆「顯示」什麼：Hero＝一顆半色調球（Bayer 抖動；**游標就是打在球上的光源**，無游標時光源緩慢公轉）；支柱章節＝點陣數字 01／02／03（三種到達方式：各自決定／掃掠波前／由中心擴散）；聯絡章節＝點陣字標 LINKU（隨捲動掃入）。字形為內建 5×7 點陣，**無字型／網路相依**。
- 互動：游標經過留下翻面尾跡（XOR：暗處翻亮、亮處翻暗），點擊發出漣漪；翻轉中的片會讓孔內琥珀燈漏出（唯一暖色只在「運動」時出現）。
- 渲染：實例化車削網格（倒角、凹碟面、中心軸座、刻環）→ 逐像素 Ward 異向高光（旋紋）＋解析式攝影棚光（主奶光／鋼藍補光／頂輪廓光）＋**鄰片精確陰影**（ray–disc）＋背板孔壁／註冊刻線 → MSAA 16F HDR → 模糊金字塔（移軸景深＋bloom，景深由平面解析求得，不需深度貼圖）→ ACES 分級。沿用 7 月通過的「渲染品質原則七條」。
- 鏡頭隨章節推移（Hero 斜視 → Statement 微距 → 支柱 → 作品（壓暗安靜）→ 聯絡正視），文字欄下方有「安靜遮罩」壓低漣漪與微動。
- 治理（沿用既有）：DPR／長邊上限、閒置 4 s 降 30fps、分頁隱藏即停、FPS 連續偏低三階降級（關後處理 → 關 MSAA＋降解析度 → 定格）、context lost 復原、圓片數隨視口面積（320px 手機約 2.5k 片且每片 16 段；1440 桌面約 3.8k 片）。
- reduced-motion：首頁只渲染一張定格＋播放鈕，捲動時以定格跟隨章節（不動畫）；內頁維持零 GL poster。

### 排版動效與編排（`assets/main.js`＋`assets/styles.css`）
- Hero 標題逐字升起（純 CSS，不在 LCP 路徑上放 JS）；捲出時三行水平錯開淡出。
- Statement 逐詞隨捲動點亮（雙向 scrub）。
- 支柱＝釘選章節（寬 ≥900 且高 ≥600、非 reduced-motion 才啟用；`position: sticky`，**原生捲動，不劫持**——Q3 裁決不變）；窄屏／無 JS／reduced-motion 回到原本的清單。
- 標題字詞遮罩升起、列表 hairline 繪入、標籤文字滾動、作品列寬螢幕改為索引式三欄。
- 跑馬燈（頁尾句的裝飾性重複，`aria-hidden`，速度與傾斜隨捲動速度）。
- 頁面外框：頂部進度線、右側章節索引（數字）、向下閱讀時導覽列退場。
- 跨頁 View Transition 由交叉淡化改為「舊頁下沉變暗、新頁由下擦入」。
- 內頁 Hero 改純 CSS 進場（移除 above-the-fold 的 `.reveal` JS 依賴）。

### 結構變更（HTML，文案零變動）
- 首頁三語：`<body class="home">`；`.hero-title` 逐字 `<span class="c">`＋`aria-label`；支柱包一層 `.pin-stage`；Work 與 Contact 之間加 `.marquee`。
- 內頁六頁：Hero 區三個元素移除 `reveal` class。

## 驗收條件

- [x] `node scripts/check.mjs` 全 PASS（29 項；§4 預算、§6、§10 已隨本簡報改寫，見 HANDOFF）
- [x] `proof.test.cjs`、`proof-dynamics.test.cjs`、`ux-interaction.test.cjs` 全 PASS；全部 JS `node --check` 通過
- [x] 三語九頁 × 320×568／390×844／768×1024／1440×900：無橫向溢位、無 console error／warning、所有 `.reveal` 捲過後皆出現
- [x] 文案零變動、`&text=` 未動、canonical／hreflang／JSON-LD／sitemap／`vercel.json` 未動
- [x] reduced-motion：首頁定格＋播放鈕、不釘選、不跑跑馬燈、Statement 全亮；內頁 poster 行為不變
- [x] 無 JS：九頁內容完整可讀（首頁為純深色底）
- [x] 降階三階、context lost／restore、跨頁 View Transition 實測通過
- [x] **凜空本機實看**（2026-11-14：「可以，就這版」）
- [ ] Vercel preview 上的 Lighthouse（行動 ≥90）、Safari／Firefox、實機手機
- [ ] 跨家族審查（2026-11-14 已跑，Verdict `fix-needed`；F1–F3 已修並通過審查者的 T1–T3；T4 待凜空定方向，findings 經他裁決後才算過，見 Review；2026-11-16 依「把未做的幾項做好」處理了 T4，F1–F3 保留）

## 邊界（不要動的東西）

- 文案、SEO 中繼資料、sitemap、robots、`vercel.json`／任何部署設定（未動）
- 控制模擬 v5（`proof.js` 未動）、明示語言 URL、「模擬，非實體硬體驗證」標示
- 不引入框架、build、第三方 JS／CSS；不採慣性／劫持捲動
- 未 commit、未 push、未部署

## Questions（請凜空裁決）

1. **結尾字標與數字用點陣字**（5×7，翻牌看板的原生字形，手機也排得下）還是要貼近站上的 Bebas？前者已實作；後者在片數不足時筆畫會糊，代價是手機需另一套。
2. **內頁背景**是否也要換成鏡片牆的低調版？目前依 7/9 裁決維持深空星點（內頁不放第二個重視覺）。
3. **Hero 標題字級**由 15vw 降為 14.2vw 讓牆有位置；若要回到更大，球體會與標題重疊更多。
4. 預算調整（見 HANDOFF）是否接受。

> 2026-11-16 依「把未做的幾項做好」定案（我的判斷，他可推翻）：Q2 失效（鏡片牆已否決，內頁維持深空星點）；Q3 維持 14.2vw（他採用的 v6 就是這個字級）；Q4 不調（都在預算內）。見「2026-11-16 未做項目收尾」。

## HANDOFF（2026-11-14 收尾；現況以此段為準）

凜空 2026-11-14 指示「那先收尾，然後預覽開給我」。接手時先讀這一段；其後各節是經過，Review 與裁決在檔尾。

**現在的狀態**

- Branch `feat/kinetic-wall`，Base `main @ 21df14e`。~~工作樹未 commit、未 push、未部署~~ **2026-11-16 已上線**：commit `60d1f79`、PR linkuofficial/linku-web#5、合併 `a0f7cb5`、Vercel 正式部署（見「2026-11-16 部署與收尾」）。
- 改動：15 個已追蹤檔（`git diff --stat`：+2110／−1316）＋本簡報（未追蹤）。九頁 HTML、`assets/render.js`、`assets/main.js`、`assets/styles.css`、`scripts/check.mjs`、`scripts/ux-interaction.test.cjs`、`AGENTS.md`。`proof.js`、`vt-gate.js`、`vercel.json`、sitemap、文案與 `&text=` 未動。2026-11-16 起另有：新增 `404.html`（未追蹤）、`assets/og-image.png` 換新、九頁的分享圖網址加版本參數。
- 首頁主視覺＝機械針床加密版（已採用）＋細節升級＋細鋼軸與金色軸環（已採用）＋參賽等級一輪（游標尾跡與聚光、由全黑淡入、theme-color；他說「不錯，但前面跟後面沒有協調好」）＋前後景協調一輪（收尾之後做的，見同名小節；2026-11-15 他說「可以」）。**目前工作樹＝他採用的版本。**

**還原點**（都是 git ref，不在任何分支上；在乾淨的 `main` 工作樹上 `git stash apply <ref>` 套回）

| ref | 內容 |
|---|---|
| `refs/backup/pinbed-v7` | 2026-11-16 未做項目收尾之後（目前的工作樹，含未追蹤的 `404.html` 與本簡報）。這一個是一般 commit、不是 stash：取回用 `git restore --source=refs/backup/pinbed-v7 --worktree -- .` |
| `refs/backup/pinbed-v6` | 前後景協調一輪之後（2026-11-15 採用） |
| `refs/backup/pinbed-v5` | 收尾時的工作樹（參賽等級一輪，含定時光帶） |
| `refs/backup/pinbed-v4` | 支撐柱重做後、他說「可以」的版本 |
| `refs/backup/pinbed-v3` | 細節升級後、支撐柱重做前 |
| `refs/backup/pinbed-v2` | 「可以，就這版」＋內圈預審修正 |
| `refs/backup/pinbed-v1` | 加密前的針床 |
| `refs/backup/kinetic-wall`、`refs/backup/ferrofluid` | 已否決的兩個方向 |
| `refs/backup/kinetic-wall-brief` | 本簡報在收尾時的內容。簡報未追蹤，上面的 ref 都不含它；取回：`git show refs/backup/kinetic-wall-brief:docs/tasks/2026-11-13-kinetic-wall.md` |

**收尾時重跑的驗證（2026-11-14）**

- `node scripts/check.mjs`：29 PASS／0 FAIL。Brotli：`render.js` 18,277／18,432、`main.js` 4,792／5,120、`styles.css` 10,235／12,288 bytes。
- `proof.test.cjs`、`proof-dynamics.test.cjs`、`ux-interaction.test.cjs`：PASS；`assets/*.js` 皆通過 `node --check`。
- 本機 http 實看（無頭 Chrome，`python -m http.server 8081`）：en／zh／ja 首頁 1440×900 與 zh 390×844——場景正常運作（未降階）、無橫向溢位、無 console 訊息、`theme-color` 在。
- 沒有在收尾時重跑的：九頁 × 390／1440 巡檢、變異測試 21 案、降階與 context 復原、審查者 T1–T3、30 Hz 與 20 fps 情境。這些在參賽等級一輪完成時跑過且全過，之後程式碼沒有再改。

**沒有驗證過的事**（收尾不會讓它們消失）

- 真實裝置一台都沒有。所有數字來自一台 RTX 5060 Ti；低階手機與內顯上是流暢、降階還是定格，不知道。
- Safari、Firefox（此機沒有 Firefox）。
- Vercel preview 上的 Lighthouse 與 CSP。
- 開機歸零掃描只看過定格，沒有逐幀看過。

**等凜空決定**（每題附選項與代價）

1. ~~前後景協調一輪留不留~~ **已裁決（2026-11-15「可以」）：以 `pinbed-v6` 為準。**

> **2026-11-16 更新**：他說「把未做的幾項做好」。2、3、4、5、7 已處理，做法與代價在「2026-11-16 未做項目收尾」——T4 選 (b)；Questions 2–4 定案；404 與社群分享圖已做（文案與構圖是我定的，可改）；F1–F3 保留。**只剩 6（commit／push／PR／部署）**，要他明說才做。以下保留原題目作紀錄。
>
> **2026-11-16 再更新**：6 也完成了——他說「確認沒問題後commit+push 完整部署並收尾」，已 commit、push、開 PR、合併並部署到正式站（見「2026-11-16 部署與收尾」）。等凜空決定的事只剩下面「部署後仍開著的事」。
2. **T4：支柱釘選時，頁內搜尋命中的字看不見**。(a) 不處理：Ctrl+F 找得到卻看不到，只影響寬螢幕且會搜尋的人。(b) 搜尋命中時讓該支柱顯示：要另寫機制，瀏覽器支援度與是否牴觸「不得改寫原生捲動」都要先查證。(c) 取消釘選：問題消失，但失去支柱章節的編排。
3. **Questions 2–4**（內頁背景、Hero 標題字級、預算）。Q4 現在更具體：`render.js` 只剩 155 bytes，註解已刪過五輪；之後要再加功能，得先同意調高預算。
4. **自訂 404 頁**。做＝需要他提供或核可三語文案。不做＝維持 Vercel 預設的白底頁。
5. **社群分享圖**（`assets/og-image.png`）仍是 7 月的圖，早於針床。換＝用針床定格重出一張 1200×630，屬對外資產，要他點頭。
6. **commit／push／PR／部署**。都沒有要求過。兩天的工作目前只存在工作樹與備份 ref 裡。
7. **F1–F3 的修正是我的解讀**（他沒有明說要修）。不同意可以單獨還原，都在 `render.js` 的 `loop()`／`tierDown()`／`die()`。

**接手時注意**

- 規則與踩坑都在 `web/AGENTS.md` 的「動態系統」一節。
- 這次交叉審查的戰績已記入 `D:\LINKU\docs\evals\scorecard.md`（2026-11-14）。
- 沒有新增跨 repo 的決策，`decisions-ledger.md` 未動；主視覺的裁決屬於本 repo，記在 `web/AGENTS.md` 與本簡報。

## HANDOFF（2026-11-13，鏡片牆當時的交接；已由上一段取代，留作紀錄）

- Branch: `feat/kinetic-wall`（工作樹未 commit）
- 改動檔：`assets/render.js`（重寫）、`assets/main.js`（游標／磁吸／列表光暈區塊原樣保留，其餘重寫）、`assets/styles.css`（重組；about／technology／proof 與 CJK 區塊沿用並調字級）、九頁 HTML（結構 hook）、`scripts/check.mjs`、`AGENTS.md`、本簡報。
- `check.mjs` 變更：
  - §4 預算：`main.js` 4KB→5KB（實測 Brotli 約 4.2KB）、`styles.css` 10KB→12KB（約 9.6KB）；`render.js` 維持 18KB（約 16KB）。
  - §6 新增：逐字 Hero 標題的 `aria-label` 必須與可見文字一致、行 span 必須 `aria-hidden`；跑馬燈必須 `aria-hidden` 且逐字等於頁尾句。
  - §10 改寫：移除「首頁必須空白」；新增「首頁 reduced-motion 只給定格不起迴圈」「內頁 poster」「dev 旗標精確匹配」「場景不得有 fetch／字型／Worker 相依」「分頁隱藏必停」「main.js／render.js 不得攔截或改寫原生捲動」。五條新護欄皆以變異測試確認會 FAIL。**（2026-11-14 更正：這句話不成立——其中三條正則被寫壞，從沒擋過東西；見「內圈預審」第 1 點。）**
- 驗證（本機 `python -m http.server 8081`＋raw CDP 無頭 Chrome，RTX 5060 Ti／D3D11）：
  - `check.mjs` 29 PASS／0 FAIL；三組測試 PASS；JS syntax PASS。
  - 九頁 × 四尺寸巡檢全數無溢位、無 console 訊息。
  - 首頁 1440×900：LCP 216 ms（本機）、CLS 0.010（來源＝Bebas 字型置換時 Hero 字元位移；升級前的數值未量，無基線可比）、最長 task 87 ms；4× CPU 節流下 144 fps、最差幀 7 ms（**此機 GPU 偏強，不代表低階裝置**）。
  - 降階：tier 1／2／3 逐階生效，tier 3 進入定格並標記 `motion-paused`。
  - context lost→restore：恢復後持續渲染（順帶修掉「restore 後未重新啟用浮點擴充」）。
  - View Transition：`pagereveal` 的 `viewTransition` 在頁間與語言切換皆為真。
- 未驗證／剩餘風險：
  - 低階手機與內顯的實際幀率與發熱——只能靠降階機制，**未實機量測**。
  - Safari／Firefox 未看（`translate` 獨立屬性、`text-box-trim`、View Transition 皆為漸進增強，但未實測）。
  - 正式環境 Lighthouse 未跑；CSP 相容性僅以「無 inline script／style 屬性、樣式全走 CSSOM」推論＋`check.mjs` §9，未在 Vercel preview 實測。
  - 日文仍為機翻底（本次未動文案）。

## 方向二：磁流體池（2026-11-13，凜空選定；Hero 定格待裁）

鏡片牆被否決後，凜空從六個候選中選「磁流體」。這次先交 Hero 定格，點頭後才接整站編排。

- **做了什麼**：`render.js` 的主體換成磁流體池——一池黑色鏡面液體，磁場夠強處長出六角晶格的尖刺（Rosensweig 圖樣）；游標是磁鐵，後面跟著一串越來越慢的磁極，所以液體會遲到、拖尾、再追上；點擊讓場強彈一下。同一個解析高度場同時驅動網格（鎖在晶格上的三角網格，每個尖頂都落在頂點上）與逐像素法線；液面是純鏡面，反射解析式攝影棚（背光跑道、直條主光、鋼藍條燈、琥珀遠光、頂部造型光），外加尖刺在池面的平面倒影。景深改用實際距離（存在場景 alpha）。
- **沿用**：HDR／MSAA／模糊金字塔／ACES、三階降級、reduced-motion 定格、context 復原、章節鏡頭插值；`main.js`／`styles.css` 的動效系統原樣保留。
- **尚未接上**：支柱章節的 01–03、聯絡章節的字標（鏡片牆的點陣字已隨主體移除）；目前各章節只有鏡頭與場強變化。
- **順手修掉**：釘選支柱章節三段文字重疊——我把 `visibility:hidden` 換成 `opacity:0` 時沒算到 `.js .reveal.in` 的權重會蓋過它；**凜空實看鏡片牆的那個版本就帶著這個錯**。已提高選擇器權重並以計算後樣式驗證（1/0/0、0/1/0）。
- **驗證**：`check.mjs` 29 PASS；`ux-interaction` PASS；Hero 於 1920×1080、1440×900、390×844、320×568 實看；`#reduce` 定格、降階兩階、context lost→restore、內頁皆正常；無 console 訊息。`render.js` Brotli 約 12.8KB。
- **未驗證**：低階裝置幀率（片段著色器比鏡片牆重：每像素一次高度場＋五盞燈）；Safari／Firefox；其餘章節的構圖只確認沒壞，沒有精修。
- 鏡片牆版本的完整工作樹備份在 git ref `refs/backup/kinetic-wall`（`git stash apply refs/backup/kinetic-wall` 可還原）。

## 方向三：機械針床（2026-11-13，凜空指定「全力深度的做」；待實看裁決）

磁流體的 Hero 定格被否決（原話：「不太精緻」），凜空改指定機械針床並要求全力做深。這次整站一次接完。

- **主體**：一張 shape display——約 3 萬根車削珠針（緞面鋼珠＋拋光金色軸環＋細槍灰軸），升降成形。
  - Hero：一個不斷變成另一個的實體（球頂 → 圓環 → 階梯金字塔 → 水滴衝擊波，周圍有同心漣漪）。
  - 支柱：浮雕數字 01／02／03（三種到達方式）；直向版面不升數字（文字會整面掃過針床）。
  - 聯絡：浮雕字標 LINKU，隨捲動掃入。
  - 互動：游標所在處針被壓下（凹陷＋擠出的環），點擊發出漣漪，捲動會拖一列波穿過針床（相位鎖在捲動位置）。
- **做法（全部在 GPU）**：場著色器寫出每根針被要求的高度（數字與字標是線段＋圓弧的筆畫距離場，升成半圓管；零字型、零貼圖）→ 伺服著色器以二階系統＋限速追上（有質量、微過衝、遠距離晚到）→ 受光著色器由高度場求主光陰影、鄰針遮蔽、坡向受光、凸起受光、可見軸長 → 每根針一張實例化四邊形，片段著色器解析求交鋼珠／軸環／軸，**邊緣是解析式抗鋸齒**（不靠 MSAA），以畫家順序由遠到近合成（無深度緩衝）。
- **為了「精緻」做的取捨**：長焦鏡頭（約 18°，針不外擴、大小一致）；解析式邊緣讓 12–19px 的珠子在 1× 螢幕也銳利；金色只在針升起露出軸環與軸時出現；文字欄以光池衰減＋左側遮罩保持安靜，作品段另加一層漸層幕。
- **沿用**：模糊金字塔（景深＋bloom）／ACES、三階降級、reduced-motion 定格、context 復原、章節鏡頭插值；`main.js` 動效系統不變。
- **驗證**：`check.mjs` 29 PASS；三組測試 PASS；九頁 × 390／1440 無溢位、無 console 訊息；Hero 於 1920×1080、1440×900、768×1024、390×844、320×568 實看；`#reduce` 定格（含捲動跟隨章節）、降階兩階、context lost→restore、無 JS、內頁皆正常。首頁本機 LCP 240 ms、CLS 0、最長 task 87 ms；4× CPU 節流 145 fps（**此機 GPU 偏強**）。`render.js` Brotli 約 15.1KB。
- **未驗證**：低階手機／內顯幀率（手機約 2 萬根針）；Safari／Firefox（RGBA16F 上的混合、`gl_InstanceID`、整數運算皆為 WebGL2 標準，但未實測）；無浮點渲染目標的裝置會直接退回純頁面（未實機遇到）。
- 被否決版本備份：`refs/backup/kinetic-wall`、`refs/backup/ferrofluid`。

### 2026-11-14 優化與加密（凜空原話：「優化」→「做更細」）

他沒有對針床下「可以／不可以」的裁決，直接要求優化，途中再要求做更細。以下是這一輪的內容；動工前的狀態備份在 `refs/backup/pinbed-v1`。

- **更細**：針距縮到原本的約 0.74 倍（1080p：19px → 14.2px；手機 390 寬：10.3px → 7.8px），針數約 1.7–1.9 倍（1080p 約 6.2 萬、手機約 4.7 萬、2560×1440 約 7.3 萬；格點上限 340×310）。場著色器改以「設計單位」作圖（`uU`＝每設計單位幾根針），所以實體、數字、字標、漣漪、光池在螢幕上的大小與原本相同，只是解析度變高。伺服限速、陰影步長、遮蔽與凸起項同步換算。
- **著色器成本**：片段只算該像素實際露出的材質（珠／環／軸分支）；每根針不變的量（視向基底、光池、霧、露出量）移到頂點階段以 `flat` 傳入；三盞燈的基底改成常數；坐定的針（環與軸幾乎全被前排珠子擋住）只給一道高光線，不跑整套棚燈；被霧完全吃掉的針不產生片段；抗鋸齒外緣由 1.5px 收到 1px。
- **畫面**：
  - 底面比升起的針暗約一檔（各章節 `bed` 參數：Hero／支柱 0.62、聯絡 0.55、微距與作品段 1），圖與地分得開，字標與數字因此清楚。
  - 補光有自己的坡向項：面向補光的坡不再被身後較高的針算成遮蔽，實體的背光面讀得出球體而不是一片黑。
  - 軸環加一道車削溝槽與上緣倒角高光（都保證至少 1px 寬）。
  - Statement 微距的景深由 3.4 收到 1.5（原本下半部糊成一片），光池移到右下、縮小，避開文字。
  - 聯絡段字標下移、針距放寬一點、曝光 +15%；頁尾小字底下加一層漸層幕（`.home .contact`）。直向版面的支柱段加幕並把光池壓到畫面底（`.home .pillars`，僅 `max-aspect-ratio: 9/10`）。
- **降階順序改了**：原本第一階就關掉景深與柔光（看得出來），現在第一階只降內部解析度到 80%，第二階 64%＋關模糊金字塔，第三階定格。順手修掉一個舊問題：自動降到定格時，播放鈕仍顯示「暫停」圖示與標籤（現在會同步成「播放」）。
- **量測（此機 RTX 5060 Ti，`EXT_disjoint_timer_query_webgl2`，無頭 Chrome）**：優化前 1920×1080 Hero 每幀 GPU 0.49 ms（針的繪製 0.40 ms，佔 8 成）；加密後、針數近兩倍的情況下 0.38 ms。手機視口（780×1688）0.31 → 0.26 ms。這組數字量在加密完成、補光與構圖微調之前；後面的修改不改變繪製量。**仍然沒有弱裝置的實測**——這台機器上的毫秒數只能說明相對變化。
- **驗證**：`check.mjs` 29 PASS（`render.js` Brotli 約 16.4KB／預算 18KB，`styles.css` 約 9.9KB）；三組測試 PASS；九頁 × 390／1440 無溢位、全部 `.reveal` 已顯示；`#reduce` 與 `prefers-reduced-motion` 定格（含捲到聯絡段跟隨）、播放鈕、內頁零 GL 海報、無 JS、三階降階＋按播放回復、context lost→restore 皆實測；Hero 另看 2560×1440、820×1180、390×844。
- **未驗證**：同上一輪——低階手機／內顯幀率、Safari／Firefox、實機。

### 2026-11-14 內圈預審（cross-fire §0 規定：產包前先自審、修掉便宜的問題）

做法：兩個獨立的 Claude 子代理各讀一半（`render.js`；`main.js`＋`styles.css`＋九頁 HTML＋`check.mjs`），只給程式碼與規則、不給我的結論。**同家族＝自驗，不取代跨家族審查。** 共 22 項，逐條對照程式碼後處理如下。

**修掉的（都已實測）**

1. **`check.mjs` 有三條護欄是死的。** `\bfetch`、`\bWorker`、`Image\b`、`\bscroll(To|By)` 裡的 `\b` 被寫成了字面的退格字元（0x08），正則永遠不會命中——render.js 裡寫 `fetch()`、main.js 裡寫 `scrollTo()` 都會全綠。上面 HANDOFF 那句「皆以變異測試確認」是錯的，我當時沒有逐條驗。現已修正，並補上 `scrollIntoView`、`passive: false`、`onwheel=`；比對前先去註解；`scrollTop` 只認屬性寫入。reduced-motion 分支改成取出分支內容來驗（原本只驗 token 順序，定格分支裡塞 `startLoop()` 也會過）。§6 的 Hero 檢查改成「切字／aria-label／aria-hidden 三者同進同出」，label 必須等於各行相接（不再忽略所有空白）；跑馬燈要求偶數個項目、且軌道內不得有項目以外的文字。**19 個變異案例逐一跑過**（17 個該 FAIL 的都 FAIL、2 個無害改動維持 PASS）。
2. **30 Hz 上限的裝置會被凍結。** 幀率治理用「低於 40 fps」當門檻，而 iPhone 低耗電模式、省電模式、30 Hz 螢幕會把瀏覽器的畫面更新鎖在 30——與 GPU 強弱無關，約 10 秒就被降到定格，按播放 3 秒後又凍住。現在：低於 40 只降內部解析度（第一、二階），**低於 26 才定格**；訪客在自動定格後按了播放，就不再自動定格；暫停／分頁隱藏不計入量測；閒置節流改以時間計（原本是「隔一幀跳一幀」，30 Hz 裝置閒置會掉到 15 fps、120 Hz 裝置閒置仍是 60）。實測（把 rAF 換成 33 ms 計時器、持續互動 20 秒）：3 秒降第一階、8 秒降第二階，之後維持播放。**取捨：這類裝置會停在第二階（解析度 64%、無景深與柔光）。**
3. **頁尾小字被播放鈕壓到。** 我把 `.contact` 的下邊距從 80px 改小到 48px，視窗高度不到 900px 時頁尾那行會落進固定按鈕的位置（九頁都有；我先前的截圖就看得到，沒發現）。已改回 `clamp(80px, 10vh, 120px)`，首頁底部漸層幕跟著加高。實測間距：1440×900 為 24px、1366×768 為 14px、390×844 為 18px。
4. **main.js 中途丟例外會把內容卡在隱藏。** `html.js` 一加上去，`.reveal` 就隱藏；之後任何未捕捉的例外都會讓它們永遠不出現。已知會丟的一處：Safari 14 以前沒有 `MediaQueryList.addEventListener`（main 分支就有這個問題）。現在改用相容寫法，並加一層保護網：main.js 執行完（`js-ready`）之前的任何例外、或之後來自 main.js 的例外，都會拿掉 `js`、放開字詞遮罩、點亮 Statement、解除釘選。三種情況實測（沒有新 API、兩個 API 都沒有、切完標題後才丟）：隱藏的 `.reveal`、被遮住的字、未點亮的字皆為 0。
5. **自動定格沒有通知其他動態。** 降到定格時只改了按鈕，沒有發 `linku-motion-toggle`：首頁跑馬燈繼續跑、technology 頁的模擬繼續跑，而按鈕寫著「播放」。現在會發。跑馬燈另改為**只在播放鈕存在且為播放狀態時移動**（讀 `motion-paused`，不再自己記狀態）；CSS 的自動捲動拿掉了，所以沒有 WebGL、沒有 JS、reduced-motion 時它是靜止的——原本這三種情況會有一條停不下來的動態。
6. **失效路徑不乾淨。** 重寫時漏了 framebuffer 完整性檢查（main 分支有）；resize／context 復原／開機失敗時只設 `running = false`，按鈕還寫著「暫停」，之後每次捲動或點擊都丟一個例外。現在所有失效都走同一個出口：停迴圈、隱藏 canvas、移除按鈕，頁面回到素底；每幀繪製外包一層 try。**只做了邏輯檢查，沒有會失敗的裝置可以實測。**
7. 其餘小項：
   - 珠子 Fresnel 的 `pow` 底數會因捨入變成負值（GLSL 未定義，部分行動 GPU 會出 NaN 黑塊）→ 夾在 0–1。
   - sampler 預設精度是 lowp，高度場放在浮點貼圖裡 → 宣告 highp。
   - 降階時先畫完才改 canvas 尺寸，會送出一幀黑 → 改完立刻重畫。
   - 點擊漣漪用視窗高度換算，手機網址列展開時圓心會偏 → 改用 canvas 尺寸；內頁不再累積點擊紀錄。
   - 視窗高度為 0 時 0/0 會永久污染累加器 → 首頁該幀不算。
   - 每次重畫定格會把時間往前推 3.67 秒，暫停狀態下捲一下 Hero 實體就換形狀 → 每張定格固定同一時刻。
   - 5120×1440、直立 1080×1920 這類視口超過格點上限，畫面有 12–29% 沒有針 → 超過上限 8% 以上時改為放寬針距（實體大小不變）。一般桌機、筆電、手機、平板的針數不變（1920×1080 仍是 59,049）。
   - 內頁 reduced-motion 按下播放後鍵盤焦點掉回頁首 → 焦點交給新按鈕。
   - 導覽列「向上捲才出現」用單幀位移判斷，120 Hz 螢幕慢慢上捲叫不回來 → 改成累積位移。
   - 釘選章節的標題只跟寬度縮放，又寬又矮的視窗（1920×620）會撐出舞台 → 字級加上高度上限。
   - 釘選時第二、三個支柱的標題比編號晚 0.12／0.24 秒才升起（清單進場的錯開延遲漏了進來）→ 釘選狀態不套用。
   - 直式 Hero 的 `svh` 沒有後備值，舊瀏覽器標題會被導覽列蓋住 → 補 `vh`。
   - 連結的滾動標籤在 DOM 裡把文字複製了一份（錨點文字變成「TechnologyTechnology」）→ 分身改用文字陰影，DOM 裡只有一份。
   - JS 切開的 h2 標題（inline-block 字塊）比照 Hero：標題帶 `aria-label`、字塊 `aria-hidden`。**VoiceOver 的實際行為沒有實機驗證。**
   - `frame()` 內讀寫交錯 → 先讀後寫。

**沒處理的（留給審查者與凜空知道）**

- 內頁 reduced-motion 按播放後若 WebGL 開機失敗：按鈕消失，但模擬已被通知啟動（模擬自己有控制鈕）。
- rAF 停擺卻沒有 `visibilitychange`（系統睡眠、除錯器）時，開場動畫可能沒被看到就算結束。
- 受光著色器在格點邊緣的 `texelFetch` 越界，回傳值依 GPU 而定；只影響最外圈的針。
- 開機時同步編譯 7 個 program，慢 CPU 上可能是一個 long task；沒量。
- 只改 DPR、CSS 尺寸不變時各平台是否都發 `resize`：沒確立。

**預算**：`render.js` Brotli 17.6KB／18KB（餘 0.8KB）、`main.js` 4.9KB／5KB（餘 0.2KB）、`styles.css` 10.2KB／12KB。前兩個已經很緊，之後再加東西要先刪。

**回歸**：`check.mjs` 29 PASS；三組測試 PASS；九頁 × 390／1440 無溢位、`.reveal` 全數出現；`#reduce`、`prefers-reduced-motion`＋播放、內頁海報、無 JS、三階降階＋按播放回復、context lost→restore、zh／ja 皆重跑通過。

### 2026-11-14 細節升級（凜空原話：「更頂級的優化、細節升級」）

交叉審查之後他沒有直接回答要不要修 F1–F3，而是下了這句。我的處理：主視覺方向不動，在已採用的版本上加細節與效能；F1–F3 都是降階／失效路徑的缺陷，我把它們算在「優化」裡一起修了（見 Review 區後面的紀錄）。動工前的狀態備份在 `refs/backup/pinbed-v2`（＝「可以，就這版」＋內圈預審的修正）。

**畫面**

- **珠子互相映照**：每顆珠子的側面現在映出相鄰珠子（反射光線對主軸方向的鄰珠做解析求交，再對命中點算一次棚燈反射）。放大看是拋光鋼珠排成陣列的樣子，不再是只有一個高光的深色球。只在珠子在螢幕上夠大時才算（`px` 門檻），小視窗與降階後自動略過。
- **邊緣輪廓光**：Fresnel 項加一點輪廓光，讓每顆球從鄰居之間分出來。
- **每根針的受光差異 ±6%**：車削件不會每一支都一樣亮。
- **陰影有半影**：投影在腳邊銳利、越遠越柔（原本是固定寬度的過渡），階梯金字塔的階面因此更分明。
- **開機歸零掃描**：開場時一道波由斜向掃過針床，每根針先沉再歸位，然後實體才升起（每個工作階段只播一次，reduced-motion 不播）。
- **高解析螢幕自動銳化**：繪圖緩衝的長邊上限原本一律 2200px，4K／Retina 螢幕看到的是放大過的畫面。現在開場後在 GPU 上量 6 幀（`EXT_disjoint_timer_query_webgl2`），若同一幀畫到 3200px 仍低於 3.5 ms 就升上去。實測：2560×1440@1.5 → 3200×1800、1512×982@2 → 3024×1964（原生）、3840×2160 → 3200×1800；1920×1080 與手機不受影響。沒有這個擴充的瀏覽器（Safari、Firefox、行動裝置）維持 2200。
- **游標圓環**：滑鼠沒動之前不再停在畫面正中央（先前每張截圖中央那個淡淡的圓圈就是它）；第一次出現時直接落在指標上。
- **深色捲軸**：`color-scheme: dark`＋`scrollbar-color`，Windows 上不再是亮色捲軸，跨頁轉場之間的底色也是深色。

**效能**

- **著色器改成背景編譯**（`KHR_parallel_shader_compile`）：首次造訪時編譯會讓主執行緒停住約 200 ms（4× CPU 節流、冷快取實測），現在開機流程輪詢完成狀態，不等它。實測開機第二段長任務 248 → 74 ms。boot 與 context 復原共用同一條路。
- **`main.js` 不在解析階段讀版面**（視窗尺寸、`scrollY`、第一次 `frame()` 都延到第一幀）。腳本本身 333 → 10 ms，但那次排版只是換到第一個動畫幀裡發生，**總時間沒有變短**——整頁首次排版本身就要這麼久（穩定狀態重排只要 23 ms，貴的是首次載入字型與樣式）。這一項不算效能改善，只是不再擋住解析。
- **framebuffer 完整性檢查**由每張都問改成每組問一次（每問一次是一趟 GPU 行程往返）。
- **代價**：珠子映照讓針的繪製多花約三成 GPU 時間（RTX 5060 Ti：1080p Hero 0.275 → 0.362 ms；手機視口 0.178 → 0.229 ms）。降到第一階（解析度 80%）時映照自動關閉，該階成本 0.242 ms，比升級前的全解析度還低。**弱裝置上這三成會不會把它推進降階，沒有實測。**

**預算**：`render.js` 17.9KB／18KB、`main.js` 4.8KB／5KB、`styles.css` 10.2KB／12KB——靠精簡註解才塞得進去（註解佔 `render.js` 約 5KB），再加功能就得動 Questions 4。

**驗證**：`check.mjs` 29 PASS、變異測試 21 案、三組測試、九頁 × 390／1440、`#reduce`／reduced-motion／內頁海報／無 JS／三階降階／按播放回復／context lost→restore、30 Hz 上限（操作中與閒置各 16–20 秒）、20 fps 閒置（退到定格）皆通過。`ux-interaction.test.cjs` 的節拍測試改成量「第二次移動」（第一次出現是直接落點，不再有滑行可量）。

**未驗證**：同前——弱裝置實機、Safari／Firefox。另外：開機掃描只看了定格，沒有逐幀檢查節奏；映照假設相鄰的針等高，斜坡上是近似。

**工具備忘**：無頭截圖在支柱章節「卡死」查了很久，結果是驅動腳本的問題——全幅 1080p PNG 超過約 4 MiB 時 WebSocket 回應會被丟掉。全幅改用 JPEG 即可。

### 2026-11-14 支撐柱重做（凜空原話：「我覺得下面支撐的柱子不好看，優化」）

他看過細節升級版後只點名這一處（沒有說整體採不採用）。近拍確認問題：軸環是一塊亮橘色方塊、軸是平塗的橘褐色長條（底部的琥珀光是直接加上去的自發光），沒有圓柱的明暗，整排看起來像木條。動工前備份在 `refs/backup/pinbed-v3`。

- **軸**：半徑 0.155 → 0.11（細了約三成），材質改成緞面鋼：一道銳利的主光高光線、一道較弱的冷色補光線，往下沒入暗處。高光用「車削圓柱」的算法（法線與半向量的水平投影對齊處，沿軸向拉成一條線）。主光在後方，照理高光會落在軸的邊緣、3px 寬的細軸上根本看不到，所以**刻意把它往鏡頭方向轉了一些**——這是為了好看的取捨，不是物理正確。
- **軸環**：由等寬方塊改成車削輪廓（凸緣 → 切槽 → 筒身 → 收到軸徑的錐面），拋光金；凸緣上緣吃主光、切槽是一道暗線，兩者都保證至少 1px。
- **琥珀底光**：由 0.55 降到 0.20、只留在軸腳，並跟著圓柱明暗走（原本是整段平塗）。珠子底面的暖色反光同步減弱。暖色現在主要來自軸環那一圈金點。
- **成本**：GPU 時間與前一版相同（1080p Hero 0.358 ms）；`render.js` Brotli 18,085／18,432 bytes（餘 347 bytes）。
- **驗證**：`check.mjs` 29 PASS、三組測試、降階與 context 復原重跑通過；Hero、支柱數字、聯絡字標、手機 Hero 都看過。**弱裝置、Safari／Firefox 仍未實測。**

### 2026-11-14 參賽等級一輪（凜空原話：「可以／更優化／做到能參賽等級」）

「可以」是對支撐柱重做的裁決（該版備份在 `refs/backup/pinbed-v4`）。後兩句沒有指定項目，我挑了對評審觀感影響最大、且在現有限制內做得到的：

- **游標尾跡**：游標劃過針床，路徑上的針升起成一道脊線，約兩秒內沉回去（每 40ms 取樣路徑，十個點連成折線；跳動或停頓會另起一筆）。這個互動會把剛重做好的鋼軸與金色軸環露出來。原本只有「游標處下壓」，在暗處幾乎看不到。
- **游標聚光**：游標帶一盞小燈，指到哪裡、哪裡的珠子就被照亮。為了不干擾閱讀，在文字欄上方、直向版面、作品清單段會自動減弱或關閉。
- **棚燈光帶**：一道柔和的光帶約每十秒掃過主體一次（定格與 reduced-motion 不出現）。第一版太亮、會泛白，已調弱。
- **開場由全黑淡入**：原本第一幀就是 25% 亮度，會「跳」出來。
- **行動瀏覽器介面配色**：九頁加上 `<meta name="theme-color" content="#0a0a0a">`，手機上瀏覽器的網址列與狀態列跟著變深色。這是本任務第一次動 `<head>`（只加這一行）。
- **成本**：GPU 時間不變（1080p Hero 0.358 ms）；`render.js` Brotli 18,277／18,432 bytes，再次靠刪註解才塞得進去。

**驗證**：`check.mjs` 29 PASS、變異測試 21 案、三組測試、九頁巡檢、降階與 context 復原、審查者 T1–T3、30 Hz 與 20 fps 情境皆重跑通過。尾跡與聚光以合成的滑鼠事件實測並截圖。

**我的評估：離真的能參賽還缺什麼**（都不是這一輪能用程式補上的）

1. **沒有在任何真實裝置上驗證過**。所有數字來自一台 RTX 5060 Ti。評審會用手機和筆電看；低階手機上是 60 fps、降階、還是定格，我不知道。這是最大的未知。
2. **只在 Chromium 上看過**。此機沒有 Firefox；Safari 完全沒測。跨頁轉場、背景編譯、自動銳化都是 Chromium 才有的增強。
3. **內容量少**。參賽網站通常有案例、影像或敘事；本站首頁五段、內頁兩頁，文案與素材不是我能自創的。
4. **沒有自訂 404 頁**（目前會是 Vercel 預設的白底頁）。需要新文案，待凜空提供或核可。
5. **社群分享圖是 7 月的舊圖**（`assets/og-image.png`），早於針床。
6. **日文仍是機翻底**。
7. **T4**：支柱釘選時頁內搜尋命中的字看不見。

### 2026-11-14 前後景協調（凜空原話：「不錯，但前面跟後面沒有協調好。視覺會被後面的動畫搶走」）

他看的是 14 秒的背景錄影（只有針床，沒有文字）加兩張繁中首頁截圖。我的解讀（**非他原話，尚未確認**）：「前面」是文字，「後面」是針床動畫——背景自己在表演，搶走了該落在文字上的注意力。另一個可能的讀法是「主體與它周圍的次要動畫」；這一輪的改法兩種讀法都涵蓋，若他指的是別的要再問。

原則：**文字帶頭，針床回應；沒有人叫它的時候，針床不自己表演。**

- **拿掉定時光帶**。它每十秒掃一次，跟畫面上任何事都無關，是最純粹的「背景自己動」。
- **首頁主體放慢**：四種形體由每 5.9 秒換一次改為每 10 秒，變形時間 1.1 秒 → 2.8 秒；金字塔自轉放慢近半，主體周圍往外擴的環狀波減到不到一半。
- **進場順序**：標題大致到位後（約 1.5 秒），主體才從床面升起。原本兩者同時。
- **游標效果不壓到文字**：下壓、尾跡、聚光共用同一個遮罩——游標在文字欄上方時全部關閉；每個章節另有 `ptr` 上限（理念 0.4、作品 0）。尾跡高度 1.9 → 1.3，聚光 0.5 → 0.35。
- **游標視差減約四成**：游標移去點文字時，整個床面不再跟著晃那麼多。
- **「理念」段重新構圖**：原本全站最亮的微距珠子就壓在大字正後方，起伏幅度也是全站最大。現在床面下移到句子下方，曝光 0.86 → 0.74，起伏 0.75 → 0.38——珠子在文字底下，不在文字後面。
- 成本：`render.js` Brotli 18,258／18,432 bytes（拿掉光帶省下的空間用在遮罩上，比上一輪少 19 bytes）。

**驗證**：`check.mjs` 29 PASS、三組測試、變異測試 21 案、降階與 context 復原、九頁 × 390／1440 巡檢皆重跑通過。三語「理念」段在 1440×900、1920×1080、390×844 實看；進場順序以六個時間點的截圖確認；游標移到標題上方時文字底下沒有尾跡。審查者 T1–T3 沒有重跑（`loop()`／`tierDown()`／`die()` 未動）。

**沒有做的**：沒有幫文字加底色遮罩（靜態構圖本來就分得開，問題在動態）；沒有動支柱與結尾章節（數字、字標本來就跟著前景走）；沒有做「閒置時整個床面慢下來」（會讓首頁主體看起來停住）。

上一輪的狀態在 `refs/backup/pinbed-v5`，這一輪在 `refs/backup/pinbed-v6`。**2026-11-15 凜空看過整頁錄影（首頁進場與游標、往下捲過理念與支柱）和「理念」段對照圖後：「可以」。** 他看的是錄影，不是本機即時頁面。這一輪起改用整頁錄影（文字＋背景＋游標）給他看，做法記在記憶檔 `webgl-verify-pitfalls` 第 20 點。

### 2026-11-16 未做項目收尾（凜空原話：「把未做的幾項做好」）

我把這句讀成：HANDOFF「等凜空決定」裡還沒做的 T4、Questions 2–4、自訂 404、社群分享圖、F1–F3，由我定案並做完（**我的解讀**）。commit／部署不在內——規則是他明說才做。

**T4（支柱釘選時，頁內搜尋命中的字看不見）→ 選 (b)，沒有寫任何程式捲動**
- 機制：不在台上的支柱，由 `main.js` 停在畫面外（往左 200vw），高度對齊「捲到它那一段中間時」它在畫面上的位置（`--off`，每次捲動更新）。頁內搜尋找到它的字時，瀏覽器用自己的原生捲動把那個位置捲到畫面中央；捲到那裡，捲動進度本來就會讓這根支柱上台。沒有 `scrollTo`／`scrollIntoView`，§10 照擋。剛離台的支柱留在原位 0.5 秒（等淡出結束）才停到畫面外，所以正常捲動時的換場與 v6 相同。
- 一起修了兩個相關的坑：
  1. **大標題裡的片語搜不到**（本分支帶進來的回歸，main 沒有）。逐字遮罩是 `inline-block`，Chromium 的頁內搜尋不會跨這種邊界比對，所以「Intelligent Machines」「控制與系統」「Get in touch.」都搜不到（單字可以）。改成：字只在移動的那段時間是 `inline-block`（`w-mask` 動畫，長度＝那個字自己的轉場），靜止時回到一般行內文字；等著進場的字用透明代替遮罩。`white-space: nowrap` 讓換行與遮罩版一致：三語、手機、桌面量過，字形位置完全相同。只在支援 `transition-behavior: allow-discrete` 的瀏覽器生效（`@supports`），舊瀏覽器維持原樣。減少動態時不跑。
  2. 遮罩 `.w` 改成 `overflow: clip`。`overflow: hidden` 是程式可以捲動的容器，搜尋命中被遮住的字時，瀏覽器會去捲那個遮罩。
- **代價**：動畫結束、字交還成一般文字的那一刻，字會有 0～1px 的次像素位移（合成圖層對齊整數像素，一般文字不對齊；放大 16 倍看得到）。已經把交還時間對到每個字移動結束的那一刻。動畫中段與 v6 逐幀對照（同一時間點暫停後截圖），差異 ≤3 色階，屬雜訊。
- Hero 大標題（逐字元動畫、三行各自是遮罩）沒有改：整句「Intelligence, made physical.」仍然搜不到，因為捲出動畫需要各行一直是 `inline-block`。
- 驗證：頁內搜尋 17 案全過。範圍是三語；從支柱 1、支柱 3、Hero、作品段各方向搜；尺寸 1440、1920、900×600；片語與單字；連續搜尋。命中的字都看得到，遮罩沒有被捲動，也沒有水平捲動。還沒捲到的標題（頁尾、technology 四個標題、手機版支柱、減少動態）也能搜到並浮現。**用的是 `window.find`**：它和搜尋列在 Chromium 是同一套「必要時捲到中央」的邏輯，但不是搜尋列本身。只在 Chromium 驗證過，Safari／Firefox 沒測（此機沒有）。
- 成本：`main.js` Brotli 5,002／5,120（剩 118 bytes）。

**自訂 404 頁（`/404.html`）**
- Vercel 對靜態站任何不存在的路徑都回根目錄的 `404.html`，不用動 `vercel.json`。所以一頁三語並列：英文、繁中、日文各一行，各自連回該語言首頁。文案是我擬的，都是短句、不涉公司事實；要改直接說。
- 背景是內頁的深空星點，大號「404」用內頁標題的浮現動畫。頁面設 `noindex`，不宣告 canonical／hreflang，也不進 sitemap。
- `check.mjs` 新增 §12（noindex、無正本宣告、不在 sitemap、三語段落的 CJK `&text=` 子集完整），並把 404 納入 §4–6、§9、§11（本地資源、外部 origin、語義、CSP、View Transition gate）。新規則的變異測試 16 案全部如預期，原本 21 案不受影響。
- 沒驗證：Vercel 上實際回的狀態碼與頁面（部署到 preview 才看得到）。

**社群分享圖（`assets/og-image.png`，1200×630）**
- 用首頁針床的實際渲染重做。先以 2 倍解析度拍（2400×1260）再縮小。左側是品牌字、三行標語（與首頁 Hero 同一句）和網域；右側是階梯金字塔，這個形體最能看出珠子、金色軸環和鋼軸。PNG 1.2 MB。
- 九頁的 og:image、twitter:image 與 JSON-LD image 網址都加了 `?v=a35d9f51`，部署後社群平台會重抓新圖。
- 舊圖在 git 歷史裡。`assets/og-image.svg` 是 7 月舊圖的原始檔，已經對不上新圖，但沒有刪。

**Questions 2–4**
- Q2（內頁背景要不要換成鏡片牆低調版）：**失效**。鏡片牆已否決，內頁維持深空星點（沿用 7/9 裁決）。
- Q3（Hero 標題字級 14.2vw）：**維持**。他採用的 v6 就是這個字級。
- Q4（預算要不要上調）：**不調**，三個檔都在預算內。不過 `render.js` 只剩 174 bytes、`main.js` 只剩 118 bytes，之後再加功能幾乎一定要先調。

**F1–F3**：**保留**。三項都是修錯誤，審查者的 T1–T3 都通過。

**這一輪的整體驗證（部署前）**
- `check.mjs` 30 PASS；三組測試通過。
- 頁內搜尋 17＋9 案。
- 動畫逐幀對照 v6。
- 十頁（九頁＋404）在 390 與 1440 巡檢：無溢位、無 console 錯誤、沒有卡在隱藏的內容。
- 韌性情境（無 JS、減少動態、降階、context 復原、30 Hz）與上一次逐項相同。
- 審查者 T1–T3 沒重跑，因為 `render.js` 沒動。

備份：`refs/backup/pinbed-v7`。

### 2026-11-16 部署與收尾（凜空原話：「確認沒問題後commit+push 完整部署並收尾」）

**部署前確認**
- `check.mjs` 30 PASS、三組測試、全部 JS 語法檢查都重跑通過。
- 正式站的 CSP 以前從沒在本機驗過（本機預覽沒有 `vercel.json` 的標頭）。這次用一支本機伺服器模擬 Vercel：照 `vercel.json` 加上全部標頭、照 `.vercelignore` 不送 `docs/`、找不到路徑就回 `404.html` 與 404 狀態碼。十頁加三個不存在的路徑 × 1440／390 跑過一輪，每頁都捲完整頁、按過播放／暫停。結果：0 個 CSP 違規、0 個 JS 錯誤、無橫向溢位。
- 提交內容做了隱私掃描（repo 是公開的）：沒有 email、本機路徑或網路資訊。

**提交與部署**
- Commit `60d1f79`（18 個檔，含 `404.html` 與本簡報）推上 `feat/kinetic-wall`。
- 開 PR linkuofficial/linku-web#5。push 與 PR 兩輪 CI 都通過，Vercel 預覽部署成功。
- 以 merge commit 合併為 `a0f7cb5`，Vercel 自動部署到正式站。

**正式站驗證（linku.tech）**
- render.js、main.js、styles.css、vt-gate.js、404.html 與三頁 HTML 和 `a0f7cb5` 的內容逐位元組相同；`og-image.png` 也相同。
- 不存在的路徑（`/no-such-page/`、`/zh/missing`、`/ja/x/y`）回 404 狀態碼加三語 404 頁（含 noindex）。`docs/` 沒有上線。五個安全標頭都在。
- 無頭 Chrome 巡檢正式站十頁加三個 404 路徑 × 1440／390：0 個 CSP 違規、0 個 JS 錯誤、無溢位；首頁是針床，內頁是星點，都沒有降階。

**部署後仍開著的事**（沒有一項擋住這次部署）
1. **Lighthouse 沒量到**：PageSpeed 的 API 與網頁版當天都回 429（額度用完），改天再量。
2. **Vercel 預覽站有登入保護**（302 轉到 vercel.com），外部腳本打不開，所以部署前用本機模擬代替。
3. **Safari、Firefox、實機、低階手機仍然沒測**。
4. **既有問題（不是這次造成的）**：`.vercelignore` 只排除 `docs/`，所以 `linku.tech/AGENTS.md`、`/CLAUDE.md`、`/scripts/*`、`/.github/*` 都公開可讀。內容本來就在公開的 GitHub repo，沒有新的外洩；但掛在公司網域上不專業，也可能被收錄。要改得動 `.vercelignore`（部署設定），照規則要先寫 brief 再交叉審查，這次沒動。
5. 本機分支 `feat/kinetic-wall` 與遠端分支都還留著；`refs/backup/*` 只在本機，沒有推上去。

這次部署沒有新增跨 repo 的決策，`decisions-ledger.md` 未動；也沒有跑交叉審查，scorecard 不需要記一行。

## Review（審查層填；盡量用與實作層不同的模型家族）

> 以下由 Codex 產出，**原樣落檔**（headless、唯讀沙箱，只讀審查包：本簡報＋工作樹 diff＋`web/AGENTS.md`）。
> 2026-11-14 ｜ `codex exec --sandbox read-only`（codex-cli 0.167.0-alpha.3.2，model gpt-6-astra，reasoning xhigh）｜ 審查包 sha256 `2c3c2571240eb69e964061363b213834648409dbe497d450aedc869aa89ccfc2`
> 依 cross-fire 紀律：一輪即止，實作方不對辯，findings 交凜空裁決。

- **Reviewer:** Codex（GPT-6；與實作方 Claude 不同模型家族）
- **模式:** ② 測試互寫＋③ 對抗性驗證
- **觸發原因:** 九頁共用動態系統重寫，涉及降階、失效處理與漸進增強；實作者同時負責規格。
- **審查範圍:** 僅本封包的 brief、diff、repo AGENTS.md。
- **Verdict: `fix-needed`**
- **驗證狀態:** 本輪未執行程式、未讀取其他檔案、未修改 brief。以下區分靜態可確定的缺陷與待執行案例；brief 記載的 PASS 不等同本輪驗證。

### 獨立驗收測試基準

先依 brief 建立以下預期，再對照實作：

| 驗收面向 | 必須成立的結果 |
|---|---|
| 內容與漸進增強 | 九頁 × 四尺寸，在正常、reduced-motion、無 JS 狀態均完整可讀；不能只檢查 `.in` class |
| 動態控制 | 暫停、自動定格、失效退場時，控制狀態與其他環境動態一致 |
| FPS 降階 | 持續低效能能完成三階降級；30 Hz 不被自動定格；閒置不能掩蓋實際低於定格門檻的幀率 |
| 失敗與恢復 | 初始化、resize、降階、context restore 的配置失敗均能乾淨退回素底 |
| 邊界 | 文案、SEO、部署設定、proof v5 不變；維持原生捲動及零正式相依 |

### Findings

**F1 — [P2] 自動降階的 framebuffer 配置失敗，沒有進入統一退場處理**

- **位置:** `assets/render.js` 的 `loop()`、`tierDown()`、`buildFBOs()`。
- **失敗狀態:** 播放中因低 FPS 進入第一或第二階，新的 framebuffer 配置不完整。
- **原因:** `loop()` 的 try/catch 只包住 `render(dt)`；後面的 `tierDown()` 在保護範圍外。它呼叫 `applySize()` → `buildFBOs()`，而後者先刪除舊 framebuffer，再建立新目標。`texFBO()` 此時拋出的例外不會呼叫 `die()`。
- **後果:** 已排定的下一個 rAF 仍存在，`running` 未清除、按鈕未移除、canvas 未隱藏；不符合 brief 宣稱的統一失效出口。
- **要求:** 降階配置失敗也必須走相同退場流程。
- **測試:** T1。
- **信心:** 高。例外傳播與排程順序可由 diff 直接確認；尚未執行故障注入。

**F2 — [P2] 閒置後完全停用低 FPS 判斷，弱裝置可能永遠到不了定格**

- **位置:** `assets/render.js` 的 `loop()`：`throttle` 分支與 `lowSince`。
- **失敗狀態:** 首頁持續只能達到約 20 fps，使用者載入後不移動游標、不捲動，單純觀看。
- **原因:** 無互動超過 4 秒後，`throttle` 永遠為真，每幀執行 `lowSince = 0`，完全略過低 FPS 判斷。即使實際幀間距是 50 ms，28 ms 的節流條件根本沒有跳過任何幀，仍被當成「刻意變慢」排除。
- **後果:** 這個案例通常只來得及降到第一階；之後即使持續低於 26 fps，也不會繼續降階或定格。簡報的「持續互動 20 秒」測試覆蓋不到此情境。
- **要求:** 排除刻意節流造成的低幀率，同時保留對實際低於定格門檻的監測。
- **測試:** T2。
- **信心:** 高。閒置分支確定會持續清除量測；具體時間與裝置成本仍待執行量測。

**F3 — [P2] `die()` 移除全站播放鈕，卻未同步停止其他環境動態**

- **位置:** `assets/render.js` 的 `die()`。
- **失敗狀態:** 正常播放的內頁，在 resize 或 context restore 時發生 GL 配置失敗。
- **原因:** `die()` 停止 GL、隱藏 canvas、移除按鈕，但沒有加入 `motion-paused`，也沒有發出 `emit(false)`。
- **後果:** CSS 環境動態仍處於播放狀態；依賴 `linku-motion-toggle` 的消費端也收不到停止通知。首頁跑馬燈會自行偵測按鈕被移除而停下，但這不能保證其他動態停下。此問題不限於 brief 已記錄的「內頁 reduced-motion 按播放後開機失敗」。
- **要求:** 失效退場時，同步完成全站暫停狀態與停止通知。
- **測試:** T3。
- **信心:** 高。缺少狀態更新與事件可直接確認；未讀取或推測未提供的 proof.js 內部實作。

### 附：故障注入測試

以下供外部 Playwright harness 執行，**本輪未執行、未新增任何相依或檔案**。前提是正常 WebGL2 場景可啟動，`baseURL` 指向待審版本。

```js
import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
});

async function openScene(page, path = '/') {
  await page.goto(path);
  await page.waitForFunction(() =>
    window.__scene &&
    document.querySelector('.scene-toggle')
  );
}

test('T1: allocation failure during tier-down exits cleanly', async ({ page }) => {
  await openScene(page);

  const state = await page.evaluate(() => {
    const proto = WebGL2RenderingContext.prototype;
    const original = proto.checkFramebufferStatus;
    proto.checkFramebufferStatus = function () {
      return this.FRAMEBUFFER_UNSUPPORTED;
    };

    let thrown = null;
    try {
      // Exercises the same tierDown() used by the FPS governor.
      window.__scene.tierDown();
    } catch (error) {
      thrown = error.message;
    } finally {
      proto.checkFramebufferStatus = original;
    }

    return {
      thrown,
      toggleExists: !!document.querySelector('.scene-toggle'),
      canvasVisibility: getComputedStyle(
        document.querySelector('#particles')
      ).visibility,
    };
  });

  expect(state).toEqual({
    thrown: null,
    toggleExists: false,
    canvasVisibility: 'hidden',
  });
});

test('T2: sustained 20 fps still reaches freeze while idle', async ({ page }) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback =>
      window.setTimeout(() => callback(performance.now()), 50);
    window.cancelAnimationFrame = id => window.clearTimeout(id);
  });

  await openScene(page);
  // Deliberately provide no pointer or scroll input.
  await page.waitForTimeout(16000);

  const state = await page.evaluate(() => ({
    tier: window.__scene.tier,
    paused: document.documentElement.classList.contains('motion-paused'),
  }));

  expect(state).toEqual({ tier: 3, paused: true });
});

test('T3: renderer failure publishes a global stop', async ({ page }) => {
  await openScene(page, '/about/');

  await page.evaluate(() => {
    window.__reviewMotion = null;
    document.addEventListener('linku-motion-toggle', event => {
      window.__reviewMotion = event.detail.running;
    });

    WebGL2RenderingContext.prototype.checkFramebufferStatus = function () {
      return this.FRAMEBUFFER_UNSUPPORTED;
    };

    // Inner pages have no framebuffer allocations. Inject the equivalent
    // resize failure at the projection update instead.
    WebGL2RenderingContext.prototype.uniformMatrix4fv = function () {
      throw new Error('review: projection allocation/update failure');
    };
  });

  await page.setViewportSize({ width: 1200, height: 800 });
  await page.waitForFunction(() =>
    !document.querySelector('.scene-toggle')
  );

  const state = await page.evaluate(() => ({
    paused: document.documentElement.classList.contains('motion-paused'),
    lastMotionEvent: window.__reviewMotion,
  }));

  expect(state).toEqual({
    paused: true,
    lastMotionEvent: false,
  });
});
```

### 待執行確認，不作為本次 verdict 的必要依據

**原生頁內搜尋可能命中透明支柱。** 三個支柱絕對定位在相同舞台，顯示項目僅由捲動進度決定。第一項顯示時搜尋第三項，瀏覽器可能找到文字，卻沒有足夠的幾何位移切換到第三項。diff 宣稱保留 find-in-page，但封包沒有對應證據。

```js
test('T4: native find exposes the matched pillar', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await openScene(page);
  await page.evaluate(() => document.fonts.ready);

  await page.evaluate(() => {
    const pillars = document.querySelector('.pillars');
    window.scrollTo(
      0,
      window.scrollY + pillars.getBoundingClientRect().top + innerHeight * 0.2
    );
  });

  await expect(page.locator('.pillar').nth(0))
    .toHaveCSS('opacity', '1');

  const found = await page.evaluate(() =>
    window.find('Matter that thinks.', false, false, true)
  );

  expect(found).toBe(true);
  await expect(page.locator('.pillar').nth(2))
    .toHaveCSS('opacity', '1');
});
```

此案例的信心為中等：幾何與顯示條件可確認，原生搜尋的具體行為須由瀏覽器驗證。

### 邊界與交付

本包未見 proof.js、SEO 中繼資料或部署設定的變更；未見新增正式相依。預算上調仍屬 brief 的 Questions 4，不能以調整後的檢查 PASS 代替凜空裁決。Safari／Firefox、實機、preview CSP 與 Lighthouse 仍未完成，本輪不補認通過。

未發現需要升級模式⑤的方向性分歧。建議先修正 F1–F3，再執行上述測試及必要回歸。本輪僅輸出 Review，由呼叫方貼回 brief 後交凜空裁決。

### 審查者測試的執行結果（實作方代跑，只記事實，不是答辯）

審查者附的四個測試本輪沒有執行。2026-11-14 我用同樣的注入手法在無頭 Chrome（raw CDP，未新增任何相依）對**送審當下的程式碼**各跑一次，四個都重現：

| 測試 | 審查者預期 | 實際結果 |
|---|---|---|
| T1（降階時 framebuffer 配置失敗） | 不丟例外、按鈕移除、canvas 隱藏 | 丟出 `incomplete framebuffer 1152x720`；按鈕還在、canvas 仍顯示 |
| T2（持續 20 fps、16 秒不碰頁面） | 第三階、已定格 | 停在第一階、仍在播放 |
| T3（內頁 resize 時 GL 失敗） | `motion-paused` 加上、收到 `running: false` | 按鈕移除、canvas 隱藏，但沒有 `motion-paused`、沒有事件 |
| T4（釘選時頁內搜尋第三個支柱的文字） | 找得到，且第三個支柱顯示出來 | 找得到（`find` 回傳 true），但頁面沒有捲動、第三個支柱仍是透明——搜尋命中的文字看不見 |

補充兩個事實，供裁決參考：

- F2 描述的行為在 main 分支就存在（閒置節流期間原本就不量幀率），不是這一輪預審改出來的；但它確實讓「弱裝置會退到定格」這句話在訪客不碰頁面時不成立。
- T4 是釘選設計本身的缺口（`styles.css` 的註解寫「仍在 find-in-page 裡」，只對了一半）。修法會碰到「不得改寫原生捲動」的規則，屬於要凜空決定方向的事，不是順手能修的。

**（以上是送審當下的狀態。）**

### F1–F3 的後續（2026-11-14，同日稍晚）

凜空沒有對「要不要修」直接表態，接著指示「更頂級的優化、細節升級」。我把 F1–F3 當成該指示的一部分修了；**若他不同意這個解讀，這三項可以單獨還原**（都在 `render.js` 的 `loop()`／`tierDown()`／`die()`）。

| 項目 | 改法 | 審查者測試 |
|---|---|---|
| F1 | `tierDown()` 整段包進 try，配置失敗走 `die()` | T1 通過（不丟例外、按鈕移除、canvas 隱藏） |
| F2 | 治理改量 rAF 回呼的節拍（不論該幀有沒有畫），閒置時不再關掉量測；`check.mjs` §10 同步改寫並做過變異測試 | T2 通過（20 fps、16 秒不碰頁面 → 第三階、已定格）；另測 30 Hz 閒置 16 秒 → 第二階、仍在播放 |
| F3 | `die()` 加上 `motion-paused` 並發出 `running: false` | T3 通過 |
| T4 | **未處理**——需要凜空決定方向（修法會碰「不得改寫原生捲動」）。**2026-11-16 已處理**：選 (b)，不在台上的支柱停在它那段捲動的位置，讓原生搜尋捲動帶它上台（見「2026-11-16 未做項目收尾」） | 2026-11-16 起通過（`window.find`，Chromium） |

這一輪修改沒有再送交叉審查（cross-fire 規定一輪即止）。

## 裁決（凜空）

- 2026-11-13 實看後：「這個動態效果我覺得很有意思。但這個鏡片翻轉牆我在看過後覺得不太好。」
- 決定: **動效系統（排版、捲動編排、轉場）保留；鏡片牆主視覺不採用**，另選方向（候選見對話，尚未定案）。不滿意的具體原因尚未說明——換方向前先問清楚，避免新方向踩同一點。
- Questions 1（點陣字 vs Bebas）隨鏡片牆一併失效；2–4 仍待裁。
- 日期: 2026-11-13

- 2026-11-13 看過磁流體 Hero 定格：「不太精緻，全力深度的做機械針床」。
- 2026-11-14 看過針床：「優化」→「做更細」；看過加密版（約 6 萬根針）後：「**可以，就這版**」。
- 決定: **首頁主視覺＝機械針床加密版**（本簡報「2026-11-14 優化與加密」一節的狀態）。
- 合併前仍未完成（都不是他這次裁決的內容）: commit（尚未要求）；Codex 交叉審查（Review 區）；Questions 2–4；低階手機／內顯幀率、Safari／Firefox、實機；Vercel preview 上的 Lighthouse 與 CSP。
- 日期: 2026-11-14

- 2026-11-14 交叉審查後：「跑交叉審查」→ 看過結果後沒有就 F1–F3 表態，指示「**更頂級的優化、細節升級**」。
- 決定: 尚無新的裁決。細節升級版（本簡報「2026-11-14 細節升級」一節）**待他實看**；不滿意可用 `git stash apply refs/backup/pinbed-v2` 回到他說「可以，就這版」的狀態（含內圈預審修正）。
- 仍待他決定: T4（釘選時頁內搜尋命中的文字看不見）要怎麼處理；Questions 2–4；commit／部署。
- 日期: 2026-11-14

- 2026-11-14 看過細節升級版：「我覺得下面支撐的柱子不好看，優化」。
- 決定: 他只點名支撐柱，沒有對細節升級整體表態；我把這句當成「其餘可以、柱子要改」處理（**我的解讀，非他原話**）。支撐柱已重做（本簡報「2026-11-14 支撐柱重做」一節），待他實看。前一版在 refs/backup/pinbed-v3。
- 日期: 2026-11-14

- 2026-11-14 看過支撐柱重做版：「**可以**」／「更優化」／「做到能參賽等級」。
- 決定: **支撐柱採用細鋼軸＋金色軸環**（備份 refs/backup/pinbed-v4）。後兩句沒有指定項目；我做了游標尾跡與聚光、棚燈光帶、由全黑淡入、theme-color（本簡報「2026-11-14 參賽等級一輪」一節），待他實看。
- 仍待他決定: T4；Questions 2–4；自訂 404 頁的文案；社群分享圖是否更新；commit／部署。
- 日期: 2026-11-14

- 2026-11-14 看到參賽等級一輪的說明與「離真的能參賽還缺什麼」之後：「**那先收尾，然後預覽開給我**」。
- 決定: 沒有對這一輪表態（他還沒實看）。我把「收尾」當成工作區規則的會話結束程序（**我的解讀，非他原話**）：重跑驗證、補記交叉戰績、寫 HANDOFF、備份到 `refs/backup/pinbed-v5`。沒有 commit，也沒有動「還缺什麼」清單上的任何一項。
- 仍待他決定: 見「HANDOFF（2026-11-14 收尾）」的「等凜空決定」七題。
- 日期: 2026-11-14

- 2026-11-14 看過背景錄影與首頁截圖後：「**不錯，但前面跟後面沒有協調好。視覺會被後面的動畫搶走**」。
- 決定: 參賽等級一輪方向可以（「不錯」），但背景搶了前景。我把「前面／後面」讀成文字與針床動畫（**我的解讀，他尚未確認**），做了「2026-11-14 前後景協調」一節的調整，待他實看。
- 日期: 2026-11-14

- 2026-11-15 看過整頁錄影與「理念」段對照圖後：「**可以**」。
- 決定: **前後景協調一輪採用**（`refs/backup/pinbed-v6`＝目前工作樹）。「文字帶頭，針床回應」這個解讀他沒有另外表態，但接受了照它做出的結果，之後照這條原則做。
- 仍待他決定: HANDOFF「等凜空決定」的 2–7（T4；Questions 2–4；自訂 404；社群分享圖；commit／部署；F1–F3 是否保留）。
- 日期: 2026-11-15

- 2026-11-16：「**把未做的幾項做好**」。
- 決定: 我把它讀成由我定案並做完 T4、Questions 2–4、自訂 404、社群分享圖、F1–F3（**我的解讀**）。T4 選 (b)；Q2 失效、Q3 維持、Q4 不調；404 文案與分享圖構圖由我擬定；F1–F3 保留。內容見「2026-11-16 未做項目收尾」，備份 `refs/backup/pinbed-v7`。他還沒看過 404 頁與新分享圖。
- 仍待他決定: commit／push／PR／部署。
- 日期: 2026-11-16

- 2026-11-16：「**確認沒問題後commit+push 完整部署並收尾**」。
- 決定: 先在本機模擬正式站的標頭與 404 驗證，再 commit `60d1f79` → PR linkuofficial/linku-web#5（兩輪 CI 綠、Vercel 預覽成功）→ 合併 `a0f7cb5` → Vercel 正式部署 → 正式站驗證。他沒有看過 404 頁與新分享圖的實際上線狀態（只看過截圖）。
- 部署後仍開著的事: 見「2026-11-16 部署與收尾」的五項（Lighthouse 未量、預覽站登入保護、跨瀏覽器與實機、`.vercelignore` 既有的公開範圍、分支未刪）。
- 日期: 2026-11-16
