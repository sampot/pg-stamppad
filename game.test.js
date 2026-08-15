import { describe, it, expect } from "vitest";
import {
  generatePool,
  newGame,
  punch,
  isComplete,
  canContinue,
  remaining,
  PRIZES,
} from "./game.js";

function lcg(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe("generatePool", () => {
  it("creates rows×cols cells with the right mix", () => {
    const board = generatePool({ cols: 6, rows: 5, prizePerType: 3, againCount: 4, rand: lcg(1) });
    expect(board).toHaveLength(30);
    const prizes = board.filter((r) => r.type === "prize").length;
    const agains = board.filter((r) => r.type === "again").length;
    expect(prizes).toBe(PRIZES.length * 3);
    expect(agains).toBe(4);
  });

  it("pools are shuffled (not all busts grouped)", () => {
    const board = generatePool({ cols: 2, rows: 2, prizePerType: 0, againCount: 1, rand: () => 0.1 });
    const types = board.map((r) => r.type);
    expect(types).toContain("again");
    expect(types).toContain("bust");
  });

  it("every prize type is present twice by default", () => {
    const board = generatePool({ cols: 6, rows: 5, rand: lcg(2) }); // default prizePerType 2
    for (const p of PRIZES) {
      expect(board.filter((r) => r.type === "prize" && r.prize === p).length).toBe(2);
    }
  });
});

describe("newGame", () => {
  it("initializes state", () => {
    const g = newGame({ cols: 6, rows: 5 });
    expect(g.cells).toHaveLength(30);
    expect(g.tokens).toBe(8);
    expect(g.goal).toBe(6);
    expect(g.cells.every((c) => !c.opened)).toBe(true);
    expect(g.collected).toBe(0);
    expect(g.over).toBe(false);
  });

  it("default pool has at least as many prizes as the goal", () => {
    const g = newGame();
    const prizes = g.board.filter((r) => r.type === "prize").length;
    expect(prizes).toBeGreaterThanOrEqual(g.goal);
  });

  it("honors custom tokens & goal", () => {
    const g = newGame({ tokens: 3, goal: 4, prizePerType: 2 });
    expect(g.tokens).toBe(3);
    expect(g.goal).toBe(4);
  });
});

describe("punch", () => {
  it("spends a token to open a cell", () => {
    const g = newGame({ cols: 2, rows: 2, tokens: 5, goal: 3, prizePerType: 2, againCount: 1, rand: () => 0.3 });
    const before = g.tokens;
    const r = punch(g, 0);
    expect(r.event.kind).toBe("punch");
    expect(r.state.tokens).toBe(before - 1);
    expect(r.state.cells[0].opened).toBe(true);
    expect(r.state.stats.opened).toBe(1);
  });

  it("errors without tokens", () => {
    const g = newGame({ cols: 2, rows: 2, tokens: 0, goal: 3 });
    const r = punch(g, 0);
    expect(r.event.kind).toBe("invalid");
    expect(r.event.reason).toBe("no-tokens");
  });

  it("rejects already-opened cell", () => {
    const g = newGame({ cols: 2, rows: 2, tokens: 5, goal: 3 });
    const once = punch(g, 0);
    const twice = punch(once.state, 0);
    expect(twice.event.kind).toBe("invalid");
    expect(twice.event.reason).toBe("already-opened");
  });

  it("rejects out-of-range", () => {
    const g = newGame({ cols: 2, rows: 2, tokens: 5 });
    const r = punch(g, 99);
    expect(r.event.kind).toBe("invalid");
    expect(r.event.reason).toBe("out-of-range");
  });

  it("grants +1 token on 'again' result", () => {
    const g = newGame({ cols: 2, rows: 2, tokens: 5, goal: 10, prizePerType: 0, againCount: 4, rand: () => 0.1 });
    // force: find an index that is an 'again'
    const idx = g.board.findIndex((r) => r.type === "again");
    const r = punch(g, idx);
    expect(r.event.result.type).toBe("again");
    expect(r.event.tokensChanged).toBe(1);
    expect(r.state.tokens).toBe(g.tokens); // spent 1, gained 1
  });

  it("counts prize toward goal and wins at goal", () => {
    const g = newGame({ cols: 2, rows: 1, tokens: 5, goal: 1, prizePerType: 1, againCount: 0, rand: () => 0.5 });
    const prizeIdx = g.board.findIndex((r) => r.type === "prize");
    const r = punch(g, prizeIdx);
    expect(r.event.kind).toBe("punch");
    expect(r.event.prize).toBeTruthy();
    expect(r.state.collected).toBe(1);
    expect(r.state.over).toBe(true);
    expect(isComplete(r.state)).toBe(true);
  });

  it("is over after sufficient prize collection", () => {
    const g = newGame({ cols: 3, rows: 1, tokens: 10, goal: 2, prizePerType: 1, againCount: 0, rand: () => 0.5 });
    const idxs = g.board.map((r, i) => (r.type === "prize" ? i : -1)).filter((i) => i >= 0);
    let s = g;
    for (const i of idxs.slice(0, 2)) s = punch(s, i).state;
    expect(s.collected).toBe(2);
    expect(s.over).toBe(true);
  });
});

describe("canContinue / remaining", () => {
  it("allows continuation with tokens", () => {
    const g = newGame({ cols: 2, rows: 2, tokens: 3 });
    expect(canContinue(g)).toBe(true);
  });

  it("blocks when out of tokens", () => {
    const g = newGame({ cols: 2, rows: 2, tokens: 0 });
    expect(canContinue(g)).toBe(false);
  });

  it("blocks when game over", () => {
    const g = newGame({ cols: 2, rows: 1, tokens: 5, goal: 1, prizePerType: 1, againCount: 0, rand: () => 0.5 });
    const idx = g.board.findIndex((r) => r.type === "prize");
    const s = punch(g, idx).state;
    expect(canContinue(s)).toBe(false);
  });

  it("remaining counts unopened cells", () => {
    const g = newGame({ cols: 3, rows: 2, tokens: 5 });
    const s = punch(g, 0).state;
    expect(remaining(s)).toBe(5);
  });
});