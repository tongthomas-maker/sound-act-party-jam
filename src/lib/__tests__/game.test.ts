import { describe, expect, it } from "vitest";
import {
  aggregateScores,
  applyAction,
  buildTurnOrder,
  canStartGame,
  createInputGate,
  createPromptDeck,
  emptyStats,
  formatClock,
  gestureToAction,
  isRoundLength,
  ROUND_LENGTHS,
  DEFAULT_ROUND_LENGTH,
  DEFAULT_ROUND_COUNT,
  winners,
  type TurnResult,
} from "../game";
import { CARDS, filterCards } from "../cards";
import { DEFAULT_PREFS, loadPrefs, parsePrefs, savePrefs, PREFS_KEY } from "../prefs";

const seeded =
  (seed = 1) =>
  () =>
    ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const memStore = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    m,
  };
};
const r = (playerId: string, round: number, correct: number, passes = 0): TurnResult => ({
  playerId,
  name: playerId.toUpperCase(),
  round,
  correct,
  passes,
  bestStreak: correct,
});

describe("turn order / equal turns", () => {
  it("gives every player exactly one turn per round in stable order", () => {
    const t = buildTurnOrder(["a", "b", "c"], 3);
    expect(t).toHaveLength(9);
    expect(t.map((x) => x.player).join("")).toBe("abcabcabc");
    expect(t.map((x) => x.round)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    for (const p of ["a", "b", "c"]) expect(t.filter((x) => x.player === p)).toHaveLength(3);
  });
  it("clamps invalid round counts to at least 1", () => {
    expect(buildTurnOrder(["a", "b"], 0)).toHaveLength(2);
    expect(buildTurnOrder([], 2)).toHaveLength(0);
  });
});

describe("scoring: GOT IT / PASS", () => {
  it("GOT IT adds a point and builds streak; PASS adds none and resets streak", () => {
    let s = emptyStats();
    s = applyAction(s, "got");
    s = applyAction(s, "got");
    s = applyAction(s, "got");
    expect(s).toEqual({ correct: 3, passes: 0, streak: 3, bestStreak: 3 });
    s = applyAction(s, "pass");
    expect(s).toEqual({ correct: 3, passes: 1, streak: 0, bestStreak: 3 });
    s = applyAction(s, "got");
    expect(s.correct).toBe(4);
    expect(s.bestStreak).toBe(3);
  });
  it("input gate accepts one action per card, none when time is up or inactive", () => {
    const g = createInputGate();
    expect(g.tryAccept(true, 30)).toBe(true);
    expect(g.tryAccept(true, 30)).toBe(false); // double tap / double gesture
    g.release();
    expect(g.tryAccept(true, 0)).toBe(false);
    expect(g.tryAccept(false, 10)).toBe(false);
    expect(g.tryAccept(true, 1)).toBe(true);
  });
});

describe("gesture direction", () => {
  it("flip DOWN = GOT IT, flip UP = PASS", () => {
    expect(gestureToAction("down")).toBe("got");
    expect(gestureToAction("up")).toBe("pass");
  });
});

describe("timer config", () => {
  it("offers 30/60/90 with 60 default and 1 round default", () => {
    expect([...ROUND_LENGTHS]).toEqual([30, 60, 90]);
    expect(DEFAULT_ROUND_LENGTH).toBe(60);
    expect(DEFAULT_ROUND_COUNT).toBe(1);
    expect(isRoundLength(45)).toBe(false);
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("game end, winners, ties", () => {
  it("aggregates across turns and ranks a single winner", () => {
    const t = aggregateScores([r("a", 1, 3), r("b", 1, 5), r("a", 2, 4, 2), r("b", 2, 1)]);
    expect(t.map((x) => [x.playerId, x.total, x.turns, x.rank])).toEqual([
      ["a", 7, 2, 1],
      ["b", 6, 2, 2],
    ]);
    expect(t[0]?.passes).toBe(2);
    expect(winners(t).map((x) => x.playerId)).toEqual(["a"]);
  });
  it("represents ties with shared rank", () => {
    const t = aggregateScores([r("a", 1, 4), r("b", 1, 4), r("c", 1, 2)]);
    expect(
      winners(t)
        .map((x) => x.playerId)
        .sort(),
    ).toEqual(["a", "b"]);
    expect(t.find((x) => x.playerId === "c")?.rank).toBe(3);
  });
  it("all-zero game is a full tie", () => {
    expect(winners(aggregateScores([r("a", 1, 0), r("b", 1, 0)]))).toHaveLength(2);
  });
  it("empty results produce empty board", () => {
    expect(aggregateScores([])).toEqual([]);
  });
});

describe("prompt repeat protection", () => {
  it("deals every prompt once before any repeat, then recycles without back-to-back repeat", () => {
    const pool = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}` }));
    const deck = createPromptDeck(pool, seeded(7));
    const first = Array.from({ length: 20 }, () => deck.next()!.id);
    expect(new Set(first).size).toBe(20);
    const next = deck.next()!.id;
    expect(next).not.toBe(first[19]);
    expect(deck.cycles).toBe(1);
  });
  it("handles empty and single-card pools without looping", () => {
    expect(createPromptDeck([]).next()).toBeNull();
    const one = createPromptDeck([{ id: "x" }]);
    expect(one.next()?.id).toBe("x");
    expect(one.next()?.id).toBe("x");
  });
});

describe("mode / category filtering", () => {
  it("SOUND IT excludes act-only, ACT IT excludes sound-only, MIX has all", () => {
    expect(filterCards("sound", "all").every((c) => c.clueType !== "act")).toBe(true);
    expect(filterCards("act", "all").every((c) => c.clueType !== "sound")).toBe(true);
    expect(filterCards("mix", "all")).toHaveLength(CARDS.length);
  });
  it("category filter limits domain", () => {
    expect(filterCards("mix", ["animals"]).every((c) => c.category === "animals")).toBe(true);
    expect(filterCards("mix", []).length).toBe(0);
  });
  it("card ids are unique", () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
});

describe("start validation", () => {
  it("requires 2 players and at least one card", () => {
    expect(canStartGame(1, 10).ok).toBe(false);
    expect(canStartGame(2, 0)).toEqual({ ok: false, reason: "cards" });
    expect(canStartGame(2, 10).ok).toBe(true);
  });
});

describe("preference persistence", () => {
  it("round-trips through storage", () => {
    const s = memStore();
    savePrefs(
      { ...DEFAULT_PREFS, music: false, flip: true, roundSeconds: 90, rounds: 3, mode: "act" },
      s,
    );
    expect(loadPrefs(s)).toEqual({
      ...DEFAULT_PREFS,
      music: false,
      flip: true,
      roundSeconds: 90,
      rounds: 3,
      mode: "act",
    });
  });
  it("falls back to defaults on missing/corrupt/invalid data", () => {
    const s = memStore();
    expect(loadPrefs(s)).toEqual(DEFAULT_PREFS);
    s.m.set(PREFS_KEY, "{not json");
    expect(loadPrefs(s)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ roundSeconds: 45, rounds: 9, mode: "quickcall", sfx: "yes" })).toEqual(
      DEFAULT_PREFS,
    );
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
  });
});
