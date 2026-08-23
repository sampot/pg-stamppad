# 戳戳樂（`pg-stamppad`）— 遊戲規劃文檔

> **用途：** 本 repo 的遊戲權威規格——coding agent 改動前必讀：這個遊戲是什麼、規則、設計限制、優化方向。
> **整理方式：** 從本 repo 實作反向整理（2026-08-23）。**改玩法先改此檔再改碼**；本檔與程式碼衝突時，以「規則（§3）」描述的設計意圖為準回報差異。
> **上游契約：** [PG-GAME-AGENT-GUIDE.md](https://github.com/sampot/playgrounds/blob/main/docs/PG-GAME-AGENT-GUIDE.md)（唯一必讀；本檔不重複其全文）· 型錄條目 `playgrounds/catalog/entries/pg-stamppad.yaml`

## 1. 一句話

夜市戳戳樂：付一枚代幣戳開 6×5 戳板上的一格，看開出獎品、再戳一次還是銘謝惠顧，集滿 6 個獎品完成一輪的機運小品——致敬夜市戳洞兌獎攤位，非任一商業作品復刻。

## 2. 定案速覽

| 項 | 值 |
| --- | --- |
| catalog id / kind / series | `pg-stamppad` / `game` / `懷舊` |
| status | `unlisted`（待上架驗收） |
| 模式 | 單人單板；無關卡、無對手、無計時 |
| 目標 | 集滿 `goal = 6` 個獎品完成一輪；起始代幣 `tokens = 8` |
| 板面 | 預設 6×5＝30 格；獎品 3 種各 2（共 6）＋「再戳一次」4 格＋銘謝惠顧補滿其餘 20 格 |
| 素材 | Kenney ogg 音效 2 檔＋UI PNG 2 檔（皆 CC0）；中獎等音效 WebAudio 合成；獎品以系統字型字元呈現 |
| 交付形 | 純 HTML＋CSS＋ESM JS；無 build；`npx vitest run` 測試 |

## 3. 完整規則（現行實作）

### 3.1 一輪的流程

- `newBoard()`（app.js 固定參數 `{cols:6, rows:5, tokens:8, goal:6, prizePerType:2, againCount:4}`）生成新板：30 格各藏一項結果，位置經 Fisher–Yates 洗牌（`rand` 可注入，測試用 LCG 重放）。
- 點未開的格子＝付 1 枚代幣戳開，三種結果：
  - **獎品**（`type:'prize'`，三種符號之一）：`collected += 1`；`collected >= goal` 時 `over = true`，本輪完成。
  - **再戳一次**（`type:'again'`）：退回 1 枚代幣（`tokensChanged = 1`，本次戳擊淨耗 0）。
  - **銘謝惠顧**（`type:'bust'`）：無事發生。
- 代幣歸零且未完成即死局（見 3.3 `canContinue`），只能「換一張戳板」整輪重來（代幣與收集進度都重置，不留續關）。
- 注意死局語意：沒代幣時，就算板上還有未開的「再戳一次」格也救不回來——again 的退款要先付代幣才拿得到（`canContinue` 明確回 false）。

### 3.2 獎池組成（`generatePool`）

- `PRIZES` 為三種獎品符號字串（棒棒糖／糖果／泰迪熊三個字元，UI 以 `textContent` 直接呈現）。
- 池內容＝每種獎品 `prizePerType`（預設 2）個＋`againCount`（預設 4）個 again；**超出格數就截斷**（`pool.slice(0, total)`）、**不足則以 bust 補滿**。預設 30 格＝6 獎品＋4 again＋20 銘謝。
- 不變式：預設參數下可開出的獎品數（6）恰等於 `goal`（6），一輪必然可完成（前提是代幣撐得到）；測試有守「pool 獎品數 ≥ goal」。

### 3.3 `punch` 判定與邊界

- 非法操作回 `{kind:'invalid'}`，reason 檢查順序：`over` → `out-of-range` → `already-opened` → `no-tokens`；全部不動 state。
- 合法戳擊回傳新 state（immutable 複製 cells/stats）與 event：`{kind:'punch', result, tokensChanged, prize}`。
- 統計 `stats` 記 `opened / prizes / agains / busts / tokensUsed` 五項，UI 下方常駐顯示前三項。
- 輔助查詢：`isComplete`（over 或 collected ≥ goal）、`remaining`（未開格數）、`canContinue`（未結束且有代幣）。

### 3.4 未接線的保留 API

- `game.js` 另有 `nextRound(state, tokens, goal)`：保留同一板面與累計統計、只清 `collected/over` 並重設代幣——設計意圖是「連戳多輪」，**現行 app.js 未使用**（換板走全新 `newGame`）。改動相關流程時先決定接線或刪除，勿讓它悄悄腐化。

## 4. 操作與畫面

| 輸入 | 動作 |
| --- | --- |
| 點未開的格子 | 付 1 代幣戳開（代幣不足或已結束時按鈕 disabled） |
| 換一張戳板 | 重新生成整輪（非破壞性操作，不需確認） |
| 聲音鈕 | 開/關（僅記憶體，未持久化） |

- HUD：代幣數、獎品 `collected/goal`、已戳 `opened/30`；下方統計列（獎品·再戳·銘謝）與狀態列（`data-tone` 區分 warn/win）。
- 每格按鈕有 `aria-label`（未開：「戳開第 N 格」；已開：「已戳開的格子」）；board 以 `--cols` CSS 變數排版。
- Mobile-first 單欄；禁 `alert`／`confirm`／`prompt`（現行僅用狀態列文字回饋）。

## 5. 持久化（KV 權威）

| key | 內容 | 讀寫時機 |
| --- | --- | --- |
| （無） | 本作目前**完全沒有** KV／localStorage 讀寫 | — |

- `functions.js` 只是預留 stub（回 `"ok"`），其註解寫著「連關以 `/api/kv` 由前端直接讀取」——屬**未實作的意圖**，如實記錄在此。
- 若實作連關數／生涯統計（見 §9），一律走 `/api/kv/pg-stamppad-*` 前綴 key；宿主 KV 無 per-SAM 命名空間，禁止無前綴 key。裸 localStorage 只能當快取，不得當權威。

## 6. 美術／音效／署名

- `assets/sfx/click1.ogg`、`switch1.ogg` — Kenney.nl UI Audio（CC0 1.0）；戳開與再戳音，授權副本 `assets/sfx/License.txt`。
- `assets/ui/button_round_gloss.png`、`button_square_gradient.png` — Kenney.nl UI Pack（CC0 1.0）；**已入庫並列入 `sam-manifest.json`，但現行程式碼未被引用**（未確認是否刻意保留；清理前先確認）。
- 中獎／銘謝／過關音效為 WebAudio 振盪器即時合成（`audio.js`，原創 MIT）；獎品符號為系統字型字元，皆免署名。
- `ATTRIBUTION.md` 已齊（CC0 也照專案慣例署名）。新增素材一律拷進 `assets/`、更新 `ATTRIBUTION.md`、同步 `sam-manifest.json` files。

## 7. 測試（`npx vitest run`）

現有覆蓋（`game.test.js`，17 例，LCG 注入決定性重放）：池組成（格數/獎品倍數/again 數）、洗牌混合、每種獎品預設恰 2 個、`newGame` 初始值（30 格/tokens 8/goal 6/全未開）、池獎品數 ≥ goal、自訂 tokens/goal、戳擊扣代幣並開格記統計、四種 invalid reason 各一例、again 淨耗 0、獎品計入 collected 並於達標時 `over`、多獎品收集至結束、`canContinue` 三態、`remaining` 計數。

UI（app.js DOM）與音效不在測試範圍。改動 §3 任一規則須先補失敗測試。

## 8. 硬約束（不可違反）

1. 僅 HTML＋CSS＋JS（ESM）；**無 build**、不入庫 `node_modules`、不安套件；工具一律 `npx <pkg>` 臨時執行。
2. 禁瀏覽器原生 `alert`／`confirm`／`prompt`；回饋一律頁內狀態列/面板。
3. Mobile-first；主操作不可 hover-only。
4. 新增任何跨局分數/進度必走 `/api/kv/pg-stamppad-{key}`（宿主 KV 無命名空間，前綴必要）；禁止裸 localStorage 當權威（現行無持久化）。
5. 不自行載入 `sdk.js`；宿主注入 `window.PG`（本作未用，vanilla 即可）。
6. 改動可執行邏輯前先寫失敗測試（TDD）；`rand` 注入介面不得移除（決定性測試依賴）。
7. 檔案清單變動須同步 `sam-manifest.json`（下載契約）。
8. 獎池不變式：池總數恆等於 `cols×rows`（超量截斷、不足補 bust），且預設參數下可開獎品數 ≥ `goal`；改動任一參數須同步檢查此不變式並補測試。

## 9. 優化建議（可玩性與樂趣）

依優先級；實作前先在此登記並補測試。原則：強化期待感與跨局動機，不改變「付代幣戳洞開獎」的核心認同。

**高優先**

1. **連關制＋KV 最高紀錄**：目前完成一輪即停、無跨局目標（functions.js 註解顯示原本就想做）。做：完成後以剩餘代幣無縫開下一輪累積「連關數」，`/api/kv/pg-stamppad-best` 存最高連關與總輪數（LS 快取＋KV 回寫，比照 flagquiz 模式）；`game.js` 的 `nextRound` 正好是半成品。為何：給機運遊戲一個「這次能連過幾輪」的追分線。
2. **代幣經濟難度三檔**：8 代幣對 6 獎品的期望偏緊，常「差一格」死局。做：休閒（10 代幣/again 6）、標準（現行 8/4）、硬派（6/2）起局面板三選一；`newGame` 早已參數化，只差 UI 選擇與平衡測試。為何：消除單一參數下的挫敗或無感兩極。

**中優先**

3. **戳洞懸念動畫**：現在點擊即刻顯示結果。做：格子按下後 200–300ms 戳洞縮放，結果揭曉前微延遲；獎品彈跳、銘謝灰階下沉。為何：戳戳樂一半的樂趣在撕開前的懸念；純 CSS keyframes 即可，邏輯不動。
4. **獎品圖鑑收集**：`/api/kv/pg-stamppad-collection` 累計三種符號的歷史取得數，湊滿門檻給稱號徽章。為何：把單輪目標延伸為長期收集線，提高回訪。

**低優先**

5. **音效力度分級**：`audio.js` 的 `tone()` 已參數化——讓中獎音高隨剩餘代幣多寡變化（代幣越少越急促），強化賭注感。
6. **板面季節主題**：theme-color 與 CSS 變數換膚（夜市紅／廟會金），低成本視覺新鮮感。
