/**
 * 戳戳樂（Stamppad）— 介面與互動。
 * 付「代幣」戳開格子看結果，收集到目標數量的獎品完成一輪。
 */
import { newGame, punch, isComplete, remaining, canContinue } from "./game.js";
import { StamppadAudio } from "./audio.js";

const audio = new StamppadAudio();

const els = {
  board: document.getElementById("board"),
  status: document.getElementById("status"),
  statTokens: document.getElementById("stat-tokens"),
  statCollected: document.getElementById("stat-collected"),
  statOpened: document.getElementById("stat-opened"),
  btnNew: document.getElementById("btn-new"),
  btnMusic: document.getElementById("btn-music"),
  statsOpen: document.getElementById("stats-detail"),
};

let game = null;

function newBoard() {
  game = newGame({ cols: 6, rows: 5, tokens: 8, goal: 6, prizePerType: 2, againCount: 4 });
  render();
  setStatus("付一枚代幣戳開一格。集滿 6 個獎品就完成這一輪！");
}

function setStatus(msg, tone = "") {
  els.status.textContent = msg;
  els.status.dataset.tone = tone;
}

function handlePunch(i) {
  if (game.over) return;
  if (game.tokens <= 0) {
    setStatus("沒有代幣了，無法戳開。", "warn");
    return;
  }
  const { state, event } = punch(game, i);
  if (event.kind === "invalid") return;
  game = state;
  audio.punch();
  if (event.result.type === "prize") {
    audio.prize();
    setStatus(`戳中獎品 ${event.prize}！`);
    if (isComplete(game)) {
      audio.win();
      setStatus("🎉 集滿獎品，完成這一輪！", "win");
    }
  } else if (event.result.type === "again") {
    audio.again();
    setStatus("再戳一次！送你一枚代幣。");
  } else {
    audio.bust();
    setStatus("銘謝惠顧。");
  }
  if (!game.over && !canContinue(game)) {
    setStatus("沒有代幣了。換一張戳板重新開始吧。", "warn");
  }
  render();
}

/* ---------- 渲染 ---------- */
function render() {
  els.statTokens.textContent = `${game.tokens} 枚`;
  els.statCollected.textContent = `${game.collected}/${game.goal}`;
  els.statOpened.textContent = `${game.stats.opened}/${game.cells.length}`;
  els.board.innerHTML = "";
  els.board.style.setProperty("--cols", String(game.cols));
  game.cells.forEach((cell, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell";
    if (cell.opened) {
      btn.classList.add("opened");
      if (cell.type === "prize") {
        btn.classList.add("prize");
        btn.textContent = cell.prize;
      } else if (cell.type === "again") {
        btn.classList.add("again");
        btn.textContent = "↻";
      } else {
        btn.classList.add("bust");
        btn.textContent = "謝";
      }
      btn.setAttribute("aria-label", "已戳開的格子");
    } else {
      btn.disabled = game.tokens <= 0 || game.over;
      btn.textContent = "戳";
      btn.setAttribute("aria-label", `戳開第 ${i + 1} 格`);
      btn.addEventListener("click", () => handlePunch(i));
    }
    els.board.appendChild(btn);
  });
  els.statsOpen.textContent = `統計｜獎品 ${game.stats.prizes} · 再戳 ${game.stats.agains} · 銘謝 ${game.stats.busts}`;
}

/* ---------- 事件 ---------- */
function bindEvents() {
  els.btnNew.addEventListener("click", () => {
    audio.unlock();
    newBoard();
  });
  els.btnMusic.addEventListener("click", () => {
    const on = audio.enabled;
    audio.setEnabled(!on);
    els.btnMusic.setAttribute("aria-pressed", String(!on));
    els.btnMusic.textContent = on ? "聲音關" : "聲音開";
  });
}

/* ---------- 啟動 ---------- */
function init() {
  bindEvents();
  newBoard();
}

init();