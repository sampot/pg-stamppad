/**
 * 戳戳樂（Stamppad / Punch Box）— 純邏輯：獎池分配、戳開判定、代幣管理、勝負。
 * 純函式設計，方便單元測試（不碰 DOM）。
 *
 * 玩法：一張戳板（默認 6×5＝30 格），每格藏一項結果（獎品／銘謝惠顧／再戳一次）。
 * 玩家付「代幣」戳開格子（沒代幣不能戳）。收集到一定數量的獎品即完成一輪。
 */

/** 獎品符號定義（供 UI 顯示）。 */
export const PRIZES = ["🍭", "🍬", "🧸"];

/** Fisher–Yates 洗牌，回傳新陣列。 */
export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 建立一個格子池：dozens 種獎品各若干、再戳一次、銘謝惠顧。
 * @param {object} opts
 *   cols, rows           板面格數（默認 6×5）
 *   prizePerType         每種獎品數量（默當 1）
 *   againCount           再戳一次數量（默當 3）
 *   bustFill             銘謝惠顧填滿剩餘格
 * 回傳一個「已洗牌」的格子結果陣列（每格 one of: {type:'prize',prize:'🍭'} / {type:'again'} / {type:'bust'}）。
 */
export function generatePool(opts = {}) {
  const cols = opts.cols ?? 6;
  const rows = opts.rows ?? 5;
  const total = cols * rows;
  const prizePerType = opts.prizePerType ?? 1;
  const againCount = opts.againCount ?? 3;
  const rand = opts.rand ?? Math.random;

  const pool = [];
  for (const p of PRIZES) {
    for (let i = 0; i < prizePerType; i++) pool.push({ type: "prize", prize: p });
  }
  for (let i = 0; i < againCount; i++) pool.push({ type: "again" });
  // 上限＝格數：超過就截斷；不足則以「銘謝惠顧」填滿。
  const board = pool.slice(0, total);
  while (board.length < total) board.push({ type: "bust" });
  return shuffle(board, rand);
}

/**
 * 新一局。
 * @param {object} opts
 *   cols, rows      板面
 *   tokens          起始代幣
 *   goal            完成目標（收集到的獎品數；預設 6）
 *   prizePerType    每種獎品數量（配池用；預設 1）
 *   againCount      再戳一次數量
 * 回傳 state：{ board(格子結果), cells(每格狀態), tokens, goal, collected, over, stats }
 */
export function newGame(opts = {}) {
  const cols = opts.cols ?? 6;
  const rows = opts.rows ?? 5;
  const tokens = opts.tokens ?? 8;
  const goal = opts.goal ?? 6;
  const board = generatePool(opts);
  return {
    cols,
    rows,
    tokens,
    goal,
    board,
    cells: board.map((r) => ({ ...r, opened: false })),
    collected: 0,
    over: false,
    stats: {
      opened: 0,
      prizes: 0,
      agains: 0,
      busts: 0,
      tokensUsed: 0,
    },
  };
}

/**
 * 戳開一格。需有代幣，且格未戳開、遊戲未結束。
 * 回傳 { state, event }：
 *  - event.kind: 'punch' 戳開成功（內含 {result, prize?, tokensChanged}）
 *  - event.kind: 'invalid'（reason: 'no-tokens' | 'already-opened' | 'over' | 'out-of-range'）
 */
export function punch(state, i) {
  if (state.over) return { state, event: { kind: "invalid", reason: "over" } };
  if (i < 0 || i >= state.cells.length) {
    return { state, event: { kind: "invalid", reason: "out-of-range" } };
  }
  if (state.cells[i].opened) {
    return { state, event: { kind: "invalid", reason: "already-opened" } };
  }
  if (state.tokens <= 0) {
    return { state, event: { kind: "invalid", reason: "no-tokens" } };
  }

  const result = state.board[i];
  const s = {
    ...state,
    cells: state.cells.map((c) => ({ ...c })),
    stats: { ...state.stats },
    tokens: state.tokens - 1,
  };
  s.cells[i] = { ...result, opened: true };
  s.stats.opened += 1;
  s.stats.tokensUsed += 1;

  let tokensChanged = 0;
  if (result.type === "again") {
    s.tokens += 1;
    tokensChanged = 1;
    s.stats.agains += 1;
  } else if (result.type === "prize") {
    s.collected += 1;
    s.stats.prizes += 1;
    if (s.collected >= s.goal) s.over = true;
  } else {
    s.stats.busts += 1;
  }

  return {
    state: s,
    event: { kind: "punch", result, tokensChanged, prize: result.type === "prize" ? result.prize : null },
  };
}

/** 是否完成目標。 */
export function isComplete(state) {
  return state.over || state.collected >= state.goal;
}

/** 是否因「沒代幣且已無再戳機會」而無法繼續（無法再戳任何為開的格）。 */
export function canContinue(state) {
  if (state.over) return false;
  if (state.tokens > 0) return true;
  // 沒有代幣；若有未開的「again」格也無法利用（但可戳才能 again），所以無法繼續。
  return false;
}

/** 剩餘未開格數。 */
export function remaining(state) {
  return state.cells.filter((c) => !c.opened).length;
}

/** 重置：保留板面與累計統計（連戳多輪時用），重新開始收集。 */
export function nextRound(state, tokens, goal) {
  const still = state.cells.map((c) => ({ ...c }));
  return {
    ...state,
    tokens,
    goal: goal ?? state.goal,
    cells: still,
    collected: 0,
    over: false,
  };
}