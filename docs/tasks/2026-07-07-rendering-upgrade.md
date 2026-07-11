# TASK: rendering-upgrade
狀態: 實作完成，待跨家族審查＋Vercel preview 實機驗收
建立: 2026-07-07 ｜ 秘書層: claude-fable-5 ｜ 實作層: claude-fable-5（2026-07-08）
Repo: web
Base: main @ eba5d42
Required verification: node scripts/check.mjs 全 PASS ＋ 本機 http 實看三語×三頁 ＋ Lighthouse 門檻（見驗收）＋ prefers-reduced-motion 實測
風險等級: 中(三角測量) — 動的是三語九頁共用的 assets/main.js 與 styles.css，但不碰部署設定、SEO 中繼資料、文案

## 目標
把 linku.tech 的視覺渲染從「不錯的動效」升到「頂級」：WebGL 粒子場景成為有敘事的主角（捲動驅動的場景編排＋可讀的結構＋更高的渲染質感）、跨頁導覽有轉場（MPA 不再硬切）、微觀細節（grain、光暈、排版、hover）全面收束——同時維持零依賴、無 build、零文案變動、SEO 與效能不退步。

## 現況基線（2026-07-07 實測，localhost:8080）
已有（品質不差，是升級的地基）：
- 自製 WebGL 粒子球（無依賴）：1800/900 點 Fibonacci 球殼、additive blending、開場凝聚動畫、滑鼠傾斜、捲動視差、reduced-motion→靜態幀、2D canvas fallback、context-lost 恢復、DPR cap 2。
- 自訂游標（dot＋ring、difference 混合）＋磁性 nav/連結；IntersectionObserver 捲動 reveal；hero 遮罩逐行升起；statement 詞組漸現；SVG grain＋徑向藍暈。

差距（頂級 vs 現況，按影響排序）：
1. **粒子場存在感弱**：實際頁面上點小而暗（alpha 0.18–0.6×閃爍），球體結構讀不出來、像背景雜訊；藍色 accent 幾乎不可感知。
2. **場景與捲動無敘事連動**：粒子球全程同一狀態，只有 6% 視差。頂級站的招牌是「捲動＝場景演化」。
3. **跨頁導覽硬切**：/ ↔ /technology/ ↔ /about/ 與語言切換是全黑閃切。
4. **微觀細節**：grain 靜態；resize 整批重建粒子（手機網址列收合會閃跳）；canvas／游標 div 無 aria-hidden；深捲閱讀時 GPU 仍全速渲染。
5. **無機械化效能護欄**：check.mjs 不管資源大小與外部 origin，效能回歸只能靠人眼。

## 方案總覽（五階段，可分段驗收上線）
順序：P0 → P1（核心）→ P2 → P3 → P4，每階段結尾過 P5 驗證門檻、獨立 commit。建議開 branch `feat/rendering-upgrade`，吃 Vercel preview URL 實機手機測過再合 main（production 直接吃 main）。

### P0 護欄與量測（半天）
- 記錄基線：Lighthouse（桌面＋行動模擬）LCP/CLS/INP/總傳輸量；Performance trace 記 hero FPS。數字填入本檔 HANDOFF 區。
- check.mjs 新增兩節（沿用「任一 FAIL → exit 1」慣例，門檻數字實作時可微調但必須存在）：
  - **4. 資源預算**：2026-07-11 改以 Brotli Q11 衡量實際傳輸成本：assets/render.js ≤ 18KB、assets/proof.js ≤ 7KB、assets/main.js ≤ 4KB、assets/styles.css ≤ 10KB，並保留約 20% 維護空間；已上線資產一律 optional:false，檔案消失即 FAIL。
  - **5. 外部 origin 白名單**：所有頁面的 script src／link href 外部 origin 僅允許 fonts.googleapis.com、fonts.gstatic.com；其他一律 FAIL（防手滑引 CDN，守住零依賴）。
- 小修：canvas＋游標 div 加 `aria-hidden="true"`（九頁）；resize 防抖＋高度變化 <80px 不重建粒子（修手機網址列閃跳）。

### P1 WebGL 渲染升級（核心，2–3 個工作階段）
2026-07-07 裁決更新：凜空指定「**非純粒子、更高規格**」——P1 由「粒子系統加強」改為**分層渲染管線**，粒子降為配角。三個候選方向已做成可實看 prototype（`docs/prototypes/`，暫不入版控；選定後刪除或留一份作記錄）。
- **P1a 管線地基（方向無關，可先動工）**：新檔 `assets/render.js` 承載 WebGL 引擎，互動邏輯留在 main.js。
  - 場景分層：L0 背景（極低亮度深空／星點）→ L1 核心主體（依 Q2 選定）→ L2 粒子吸積流（保留「凝聚」品牌語彙，降為配角）。
  - 後處理：半解析度 ping-pong bloom（真 bloom）＋合成 pass（tone map、vignette、dither 抗色帶；grain 可併入此 pass，取代 CSS 靜態 grain）。
  - 解析度治理：DPR cap 1.5–2＋主 buffer 最長邊 cap（≈1600px，發光內容放大無損質感）；FPS 連續偏低自動降 tier：關 bloom → 降內部解析度 → 靜態幀。
  - 能力階梯：WebGL2（half-float）全管線 → WebGL1 無後處理直繪 → reduced-motion／無 GL：靜態幀（沿用現機制）。
  - **Windows/ANGLE 教訓（2026-07-07 prototype 實測）**：程序式噪聲×raymarch 步數會被 ANGLE 展開成巨型 HLSL，FXC 編譯直接卡死整個 GPU process（連帶拖垮單執行緒 dev server）。正式版鐵律：噪聲一律 texture-based、march 步數 ≤48、迴圈內不放大量純 ALU 運算。
- **P1b 核心主體：C 方向・軸環機芯（Gimbal Core）**（2026-07-07 選定，概念細節見 Questions）。
  - C2 素模版因**廉價感**被凜空否決 → C3 攝影棚級重建（`docs/prototypes/c3-gimbal-studio.html`）通過視覺查驗，P1b 以 C3 為品質基準 productionize。
  - **渲染品質原則（C2 檢討後定案，P1b 驗收標準）**：
    1. 光照＝攝影棚環境光（主奶光＋鋼藍補光＋頂部輪廓光的多向柔光梯度）；禁單燈＋fresnel。
    2. 暗部要有遮蔽：SDF 烘焙頂點 AO、接觸暗角、深度霧；禁零遮蔽漂浮感。
    3. 自發光必須過 bloom 管線（亮度門檻＋½/¼/⅛ 多尺度金字塔）；禁貼紙式 emissive。
    4. 幾何要有功能敘事細節（溝槽斷面、一體化軸承座、倒角層級）；禁 primitive 直出、禁三角網格線裝飾。
    5. 影像統一：ACES tone map＋暗部藍移＋grain＋vignette，3D 與排版印在同一張底片上。
    6. 構圖：物件出血裁切壓場或珠寶式留白，與文字有前後交疊；禁「中等大小物件並排文字」剪貼畫構圖。
    7. 運動要有質量：伺服步進＋慣性微過衝；禁勻速旋轉。
- **P1c 捲動編排**：scrollY 驅動場景狀態機（Hero 凝聚 → Statement 舒張 → Pillars 收斂格構 → Contact 匯聚脈衝），全程 lerp 無突變；內頁（about/technology 六頁）不套編排、維持低調 ambient 模式，以 `data-screen-label` feature-detect 分流，render.js 九頁共用一份。
- **效能治理沿用**：分頁隱藏暫停、hero 離開視口 1.5×vh 或閒置 4s 降 30fps、context-lost 恢復、reduced-motion 靜態幀。

### P2 跨頁渲染：View Transitions ＋ prerender（半天）
- styles.css 加 `@view-transition { navigation: auto; }`（共用檔＝九頁自動 opt-in）＋ `::view-transition-old/new(root)` 約 350ms 交叉淡化；brand logo 給 `view-transition-name` 做共享元素。不支援的瀏覽器維持現狀（純漸進增強）。
- main.js 動態注入 `<script type="speculationrules">` prerender 站內連結（moderate）——零 HTML 改動。
- reduced-motion 下停用轉場動畫。
- **已知風險必測**：en 首頁的首訪語言轉址（`location.replace`）在被 prerender 時的行為——清 localStorage 後三語系實測；有怪異行為就棄 prerender、只留 View Transitions（Q4）。

### P3 CSS 渲染細節（半天）
- grain 動起來：steps() transform 迴圈（compositor-only），reduced-motion 停。
- hero 光暈加一層極慢（20s 級）低飽和漂移，維持黑金石的節制，不搶戲。
- 排版渲染：en 頁 Bebas 大標套 `text-box-trim`（漸進增強；CJK 頁實看確認不受影響，必要時只套 en）；pillar-num 用 `font-variant-numeric: tabular-nums`；nav 用 `@starting-style` 首幀淡入。

### P4 微互動收束（半天）
- pillar／tech-item hover 指向光暈（pointermove 寫 CSS 變數 → radial-gradient，`pointer: fine` 才啟用）。
- 統一連結 hover 語彙（底線掃過 pattern 已有，補齊 more-link／contact-mail）。
- 原則：站的語彙是編輯極簡，效果寧少而準，砍掉任何會讓頁面變吵的候選。

### P-proof 證明段 v2：「同樣的硬體，兩種結果」A/B 對比（2026-07-08 重構思）
Clarke–Park 三面板版（含站上語彙重製版 `docs/prototypes/p-proof-clarke-park.html`）被凜空否決：**不夠直觀**——教科書式三步驟敘事需要先備知識，路人與工程師都「沒個所以然」。留檔作日後 /technology/ 深層內容素材，不再是證明段主體。
- **直觀原則（檢討定案，之後所有證明類視覺都要過）**：一眼、一個對比、一個說得出口的結論；熟悉的物理指涉（追目標、抗干擾）優於抽象訊號圖；可玩的因果（操作→立即可見差異）；量化數字佐證。
- **v2 概念**（`docs/prototypes/p2-same-hardware.html`）：兩套**完全相同**的模擬受控體（同馬達模型、同力矩上限、同編碼器雜訊與量化、同目標、同干擾、同一條雜訊序列）並排追同一目標。左＝一般 PD（生訊號微分＋感測延遲）→遲滯、過衝、抖動；右＝估測器＋良好整定→快而穩。游標移動＝目標、點擊＝雙邊同時干擾、誤差 EMA 即時顯示。訊息＝事實底稿核心句「讓整體系統超越同等硬體的一般方案」的可玩證明。
- 誠實護欄：標示「模擬示意，非量測資料」；「一般方案」非稻草人——合理整定的通用控制，差距來自感測延遲與雜訊處理，參數在檔內可審。
- 淘汰替代案：倒單擺（最炫但玩具感、離品牌遠）、無人機/機械臂（過度具體＝策略禁止）、單面板 ON/OFF 切換（需記憶前後狀態，不如並排）。
- 標題「同樣的硬體，兩種結果。」為草稿，文案由凜空定稿。
- **v3 呈現架構（2026-07-08 凜空確認方向後定案：硬邏輯支撐、簡單呈現＝分層揭露）**：
  - L0 圖像層（零互動即成立）：雙環對比＋**誤差時間軌跡帶**（示波器式細線，平＝好；工程 step-response 圖偽裝成直覺）。
  - L1 數字層：RMS（最近 4 秒）＋**安定時間**（每次目標跳躍/干擾後重測，±2° 帶停留 0.3 s）——安定 X.X s vs 安定 — 是主要殺傷數字。
  - L2 互動層：游標＝目標、點擊＝雙邊同時干擾（干擾也重測安定）。
  - L3 工程師層：原生 `<details>` 收合規格表——受控體方程、感測規格（含 50 ms 延遲**兩側一致**）、兩側控制律與參數、common random numbers 公平性、統計定義。表面乾淨、深度可審。
  - 硬邏輯升級：延遲改為兩側一致（我方以估測器前向預測補償＝真實技術，非「對面比較爛」）；一般側整定為會收斂但慢且抖（ζ≈0.29），非稻草人。
  - i18n 設計約束：canvas 只繪數字與符號（°/s），**所有文字在 DOM**——三語化與 `&text=` 子集 SOP 零障礙。
- **頁面配置定案（2026-07-08 凜空指示）**：證明段**只進 /technology/**；首頁與其他頁面維持精密渲染路線（C3 hero 管線＋P1c 編排、內頁 ambient 模式）。首頁不放證明段。
- **v4 商業＋演算法真實性審計（2026-07-08，凜空指示「一側＝真實現狀、一側＝絕對頂級」）**：
  - 商業框架三修正：①右側定位＝「**公開最佳實務的正確部署與整定**」（差距不靠祕密靠工程——誠實且比宣稱私有魔法更可信）；②左側具名「常見作法・固定增益 PID」＝可辨識的真實作法，非稻草人；③新增商業翻譯句「更快安定＝更高節拍；更小誤差＝更便宜的機構與感測就能達標」。
  - 左側（真實現狀）：ZN 風格固定增益 PID＋編碼器差分測速（雜訊直通 D 項）＋粗糙積分限幅（|I|≤0.6·τmax，大步階windup）＋階躍直接餵；原 50 ms 感測延遲對編碼器場景不真實→改兩側各 1 拍。
  - 右側（絕對頂級，皆為可部署於便宜 MCU 的教科書級標配）：穩態卡爾曼估測＋一拍預測＋**線上時間最優軌跡 governor**（a≤0.8·τmax/J）＋**模型前饋**＋**動量式擾動觀測器**＋抗飽和餘裕。頂級的視覺特徵隨之改變：過程誤差幾乎不張開（跟軌跡而非追階躍）、到點即停零過衝、干擾即時抵消——統計（RMS/安定）因此誠實拉開。
  - 全部參數與公平性聲明（common random numbers、同 τmax、同迴路頻率）列於 L3 規格表，可審計。
  - **v4 bugfix（2026-07-08）**：①右側靠近游標抖動＝bang-bang 軌跡在切換面逐拍翻號→改 PTOS（遠 sqrt／近線性終端）；**數值實測驗證**：純 sqrt 在離散下反而 limit-cycle（翻號≈100%），PTOS 三情境翻號≤2、零過衝、精確收斂（教訓：憑數學不夠，要跑數字）。②兩邊突然「重製」＝主迴圈用原始 performance.now，捲動離屏 stop/start 後時鐘跳過暫停時段→autoTarget 立刻觸發跳目標；改用固定步進累積 simT（免疫暫停/捲動）＋互動冷卻期持續延後 lastJump。自動化分頁 IntersectionObserver 節流無法跑 live 迴圈，bug1 以 isolated 數值＋#still 渲染驗證、bug2 以 simT 邏輯確立。

- **v5 可信度重整定＋顯示精簡（2026-07-09，凜空裁決：「左邊太爛，確定不是稻草人？」＋「參數可精簡」）**：
  - 左側由「ZN 生差分 D＋粗限幅」（差距 ~75×、安定 —，工程師一看即稻草人）重建為
    **合理整定的基本 PID**：kp=20、kd=5.8（ζ≈0.65）、ki=12；速度＝6 拍編碼器差分＋
    20 rad/s 一階低通（dirty derivative）；抗飽和＝條件式積分。結構性差距不變
    （無軌跡/前饋/估測器/延遲補償）——差距來自真本事，非把對照組打殘。
  - **數值 sweep 選參**（54 組 × 5 seeds）＋加嚴驗證（12 seeds、96 跳＋60 干擾）：
    左側 never=0、跳靶 2.72s（max 3.18＜6s 窗）vs 右 1.08s＝**2.5×**；
    干擾恢復 3.65s vs 1.92s＝**1.9×**（DOB vs 純積分）。
  - 顯示精簡：每側只留**安定時間**一個數字（RMS 移除，定義併入規格表）；
    規格表「常見作法」行改寫為合理整定版；停格條件改「右已安定、左尚未」。
- **機芯減重（2026-07-09，凜空裁決：後方模型太大太厚重）**：環斷面 0.10×0.30→
  0.065×0.19（外）/0.075×0.16→0.05×0.11（內）＝刀鋒式精密感；相機後拉 ~22%
  （hero cz −3.65→−4.70，全 KF 等比，螢幕位置比例不變）；樞座/芯軸縮小並
  **改霧面不發光**（推翻 C3 的發光樞座外觀——當時的兩塊亮斑即凜空指的 clunky 元兇）；
  內頁已於前一輪改純深空（機芯只留首頁）。

#### （已否決存檔）v1：Clarke–Park 互動視覺（2026-07-08）
凜空提供另一 AI 的 Clarke–Park 變換 demo（三相電流→αβ 空間向量→dq 旋轉座標，「混亂進，秩序出」），指示結合或取捨。裁決方案＝**分層整合**：C3 hero 管感性（品牌工藝），本 demo 管理性（技術可信度），互不取代。
- **沿用**（該 AI 的長處，具名記錄）：數學正確的訊號模型（含 5/7 次諧波→dq 6 次漣波的內行細節）、三面板敘事（波形右緣＝「此刻」流入向量面板、灰色相量首尾相接＝空間向量成因）、reduced-motion 給「播放」鈕的 a11y 模式（優於純靜態幀，正式版 hero 也改採此模式）、IntersectionObserver 離屏暫停。
- **改造**（過品質原則七條）：視覺重製為站上語彙——去圓角卡片、hairline＋大寫字距 label、畫布加大；配色統一：「混亂」＝三相用站上灰藍階，「秩序」＝**hero 核心暖琥珀光色**（棄銅色 #c98a5e，避免第四 accent；琥珀直接取自 C3 核心發光色，上下同一顆「心」）；grain/vignette 與全站一致。
- **放置 v1**：/technology/ 三語頁，掛在「把模型的決策轉為真實世界中可靠的致動與控制」條目下（內容型頁面天然適合互動教具，且為 SEO 加分項）。首頁 compact 版於 P1c 編排完成後再評估——首頁同時擺兩個重型視覺會互搶，hero 優先。
- **深綁（選配，P1c 後評估）**：hero 伺服角 θ 與證明段共用同一訊號模型、環上 d/q 微 HUD——「上下是同一套數學」成為可講的故事；若增加視覺雜訊則捨棄。
- **SOP 成本**：三語文案＋zh/ja `&text=` 同步（canvas 內 d/q/α/β 為拉丁字元不影響子集）；ja 照慣例標機翻待母語校稿；文案措辭最終由凜空定稿。
- 待凜空裁決：①「混亂進，秩序出」是否同步成為首頁 statement 標題（動既有文案）；② compact 版是否上首頁。

### P5 驗證門檻（每階段結尾都跑，最終合併前全過）
見驗收條件。

## 驗收條件
- [ ] `node scripts/check.mjs` 全 PASS（含 P0 新增的資源預算＋origin 白名單）
- [ ] 本機 http 實看三語×三頁（九頁）皆正常，含窄屏（≤520px）
- [ ] Lighthouse：Performance 桌面 ≥95／行動 ≥90，CLS ≤ 0.02，LCP 不劣於 P0 基線
- [ ] hero 桌面 60fps；4× CPU throttle 模擬 ≥40fps；無 >100ms long task
- [ ] prefers-reduced-motion：所有新效果（場景編排、轉場、grain、光暈）完全靜止
- [ ] 零第三方 runtime 依賴、零 build step；文案零變動（&text= 不需動）
- [ ] canonical／hreflang／JSON-LD／OG／sitemap 零變動（check.mjs 既有節保證）
- [ ] Chrome＋Edge＋Firefox 實看；行動裝置經 Vercel preview URL 實機看過

## 邊界（不要動的東西）
- 文案、SEO 中繼資料（canonical/hreflang/OG/JSON-LD）、sitemap.xml、robots.txt
- vercel.json：不存在，也不新建（若未來要動＝另開 brief 強制交叉）
- 字型管線：Google Fonts `&text=` 子集流程與 check.mjs 第 3 節不動
- 不引入框架、build step、第三方 JS／CSS（含 CDN——白名單會直接擋）
- nav 結構與資訊架構、多檔分頁 i18n 架構

## Questions（需凜空裁決後才動工）
2026-07-07 已全數裁決：Q1＝視覺渲染品質 ✓；Q3＝不採用慣性平滑捲動 ✓；Q4＝授權實作層取捨 ✓；Q2＝選 **C 方向（lit mesh）**，並指示「模型是什麼要認真構思、體現專業範圍」。

**Q2 定案概念：軸環機芯（Gimbal Core）**——prototype `docs/prototypes/c2-gimbal-core.html`（加 `#still` 看靜態快照；A/B/C 舊 prototype 留檔比較）。待凜空看過 demo 做最終確認。
- 構成：三軸嵌套精密環架（矩形削角斷面）＋中央發光切面核心＋樞軸座與芯軸。
- 語意對映（體現專業範圍的核心理由）：
  - 中央發光核心＝**Edge Intelligence**（mind in the machine）
  - 軸環以**伺服步進**方式定位轉動（欠阻尼、帶 ~3% 過衝＝控制迴路的個性）＝**Control & Systems**（decision into motion）
  - 整個組件＝**Intelligent Machines**（matter that thinks）
  - 削角稜面上沿環行進的訊號光＝控制迴路中流動的訊號
- 構思時捨棄的選項與理由（記錄供日後參考）：
  - 晶片／電路板：AI 新創陳腔視覺，且 LINKU 不做晶片＝對外宣稱錯誤。
  - 無人機／機械臂／馬達等具體產品：策略上市場未鎖定，具體產品模型＝過度承諾。
  - 抽象球體（原 C）：質感對但無專業訊息量。
- P1c 捲動編排對映：Hero 全組件運轉 → Statement 推近核心 → Pillars **工程分解圖（exploded view）逐支柱點亮** → Contact 收攏鎖定＋脈衝。

## HANDOFF（實作層完成或卡住後填）
- Branch: `feat/rendering-upgrade`（6 commits：docs → P0 → P1 → P2 → P3+P4 → P-proof）
- Summary: P0–P4＋P-proof 全部落地。render.js 承載 C3 productionize 分層管線
  （L0 星點／L1 軸環機芯 studio 光照＋烘焙 AO＋MSAA＋3 級 bloom＋ACES／L2 吸積粒子），
  首頁四章節捲動編排（Hero 運轉→Statement 推近→Pillars 分解逐柱點亮→Contact 鎖定脈衝）、
  內頁 ambient（右上遠景、隨捲動退場）；能力階梯 WebGL2→WebGL1 直繪→2D 靜態；
  View Transitions＋moderate prerender；grain 動化＋光暈漂移＋text-box-trim＋指向光暈＋
  hover 語彙統一；證明段 v4 三語進 /technology/（proof.js 固定步進時鐘＋IO 暫停＋
  reduced-motion 播放鈕）。main.js 14KB→6.4KB。
- Verification（2026-07-08，localhost:8081 threading server＋Chrome 系 preview）:
  - `node scripts/check.mjs` 22 項全 PASS（含新 §4 資源預算＋引用完整性、§5 origin 白名單）
  - 資源（未壓縮）：render.js 47,626B/48K・proof.js 13,323B/14K・main.js 6,353B/16K・styles.css 32,148B/44K
  - zh 首頁 DOMContentLoaded 176ms（本機）；pipe 模式 60fps tier0；CLS 0.0000（全頁捲動實測）
  - 實看：三語×三頁共九頁（#still 快照法）＋首頁四章節＋375×812 窄屏 hero/pillars＋
    #reduce 播放鈕（三語 aria-label）＋intro 凝聚＋語言切換黏性＋首訪轉址（清 storage）
  - 證明段數值審計（Node 無頭 40 sim-s）：6 次自動跳靶，協同側 0.87–1.32s 安定、
    常見側窗內安定 —，6/6 全勝＝v3「主要殺傷數字」成立
  - preview 面板限制：背景分頁 rAF/IO 節流無法看 live 迴圈——照 webgl-verify-pitfalls
    對策改用 #still（視覺）＋Node 數值審計（邏輯）雙路驗證
- Remaining risks:
  - Vercel preview URL 實機手機測試未做（合 main 前必做，brief 原要求）
  - Lighthouse 分數未跑（本機無 runner）；以 CLS 0.0000＋176ms DCL＋60fps 為替代基線，
    建議部署 preview 後跑 PageSpeed Insights 補記
  - Firefox/Safari 未實看（Chrome 系已測）；View Transitions 於 FF＝漸進降級需目視確認
  - 證明段文案＝v4 草稿（含標題「同樣的硬體，兩種結果。」）待凜空定稿；ja 機翻待母語校稿
  - prerender×en 首訪轉址：行為等價已論證＋清 storage 實測正常；真機 hover-prerender 建議抽查
  - 舊 prototype（a/b/c/c2/clarke-park）留本機未入版控，處置待凜空
  - 手機網址列 resize 對策改為 canvas 100lvh＋幾何永不重建（比 brief 原「<80px 門檻」更徹底），
    lvh 不支援的舊瀏覽器回退 100vh（僅 buffer 輕微重配置，無視覺跳動）
  - **工具 bug（跨 repo，非本 branch）**：`D:\LINKU\scripts\cross-fire.mjs` 的 `--auto` 在 Node 24
    Windows 下 `spawnSync codex.cmd EINVAL`——Node 20.12+ 基於安全性不再允許不帶 `shell:true` spawn
    `.cmd/.bat`。修法：spawnSync 加 `shell: true`（或改 `codex`/`codex.cmd` 偵測＋shell）。目前 workaround＝
    產包後手動 `codex exec --sandbox read-only - < packet` 管入，實測可行。建議另開小 task 修 cross-fire.mjs。

## Review（審查層填；盡量用與實作層不同的模型家族）
### 內圈預審（cross-fire §0 步驟 0，2026-07-08，claude-fable-5 自審）
- 8 視角並行 finder（逐行／刪除行為／跨檔追蹤／重用／簡化／效率／深度／規範）
  → 40 候選 → 25 項確認修復（commit 3c4a656），4 真 bug：120Hz 時鐘 2×速、
  閒置半速、demote 用 pipe shader 輸出未調色 HDR、FBO 完整性查錯對象；
  3 項駁回（刻意設計）、2 項延後（portrait 構圖宣告式化、cream 變數化）。
- 修復後全部重驗：check.mjs 22 PASS、數值審計 6/6＋120Hz 1:1、
  瀏覽器矩陣（章節／reduce 鈕／#still／proof）、視覺一致。

### 跨家族交叉（Codex，2026-07-08 實跑）
- Reviewer: Codex GPT-5.5（codex-cli 0.142.5, xhigh, read-only sandbox, 106K tokens）
- 模式: ②測試互寫＋③對抗驗證
- 觸發原因: 路徑觸發（風險等級 中·三角測量）
- 執行方式: cross-fire.mjs 產包後**直接 `codex exec --sandbox read-only -` 管入**（`--auto` 因
  Node 24 Windows `spawnSync .cmd EINVAL` 失敗＝工具 bug，非 sandbox；繞過 node 包裝即成）。
- Verdict: fix-needed → 已處理：2 真 bug 修復、1 邊界還原，3 項升凜空裁決。
- Findings（Codex 提 5 條，逐條處置）：
  1. **[High] robots.txt 被改，違反 brief 邊界** → **已還原**（commit：restore from main）。docs/ 公開存取
     的正解＝部署層排除（vercel.json/.vercelignore），依規則需另開 brief＝**凜空裁決**（見下 #2 同根）。
  2. **[High] docs/prototypes/*.html 入版控會隨 Vercel 公開** → **凜空裁決**。brief P1 有「留一份作記錄」
     背書故保留 c3/p2 兩檔（且含 noindex），但 Codex 正確指出 robots.txt 擋不住公開存取，且 brief .md
     本身也 fetchable。處置選項：(a) 部署排除 /docs/（另開 brief）｜(b) 移出版控只留本機｜(c) 接受公開。
  3. **[High] 三語 /technology/ 發布待定稿 proof 文案** → **已知風險，凜空定稿前不合 main**。與 HANDOFF
     「proof 文案 v4 草稿待定稿、ja 待母語校稿」一致；Codex 獨立確認＝不可視為 Done。
  4. **[Medium] render.js FBO rebuild 洩漏 renderbuffer** → **已修**（真 bug，自審 8 視角漏掉）。texFBO
     回傳 depth rb、delFBO 刪 rb、buildFBOs 追蹤並刪 MSAA msRbC/msRbD。**無頭數值驗證**：21 次 build
     建 42／刪 40／live 恆定 2（修前建 42 刪 0＝洩漏 42）。
  5. **[Medium] 深捲未依「hero 離開視口 1.5×vh」降 30fps，只靠 idle 4s** → **已修**（brief 規格缺口）。
     loop 的 throttle 增 `HOME && scrollY > 1.5×innerHeight` 條件（場景 fixed，捲動深度代表 hero 離場）。
- 信心註記：#4 確定性數值驗證（高信心）；#5 純邏輯（高信心）；#1–3 為邊界/流程，非我可單方裁決。
- 環境備註：preview 分頁卡 hidden（rAF 節流）致 live 截圖不可得；#4/#5 改以無頭審計＋程式碼審查驗證，
  場景本體已於自審批次前充分截圖驗證，本批 4 處編輯狹窄且不動 boot/render 主流程。

## 裁決（凜空）
- 決定: Q1 視覺動畫 ✓；Q3 不加慣性捲動 ✓；Q4 交實作層規劃 ✓；Q2 選 **C 方向**＋概念**軸環機芯**；C2 素模版因廉價感否決 → 重建為 **C3 攝影棚級**（完整 HDR/AO/bloom/ACES 管線），品質原則寫入 P1b 驗收標準，待凜空看 c3 demo 確認。
- 2026-07-08: 凜空提供另一 AI 的 Clarke–Park demo 指示結合或取捨 → 採**分層整合**（hero 感性層＋證明段理性層）；Clarke–Park 版隨後被否決（**不夠直觀**、三面板沒個所以然）→ 推翻重構思為 **v2「同樣的硬體，兩種結果」A/B 對比**（p2 prototype）→ 凜空確認方向 ✓ 並指示「硬邏輯支撐、簡單呈現；只進技術頁，其他頁維持精密渲染」→ v3 分層揭露版完成；待決：標題文案定稿。
- 日期: 2026-07-07～08
