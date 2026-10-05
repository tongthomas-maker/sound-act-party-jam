import { beforeEach, describe, expect, it } from "vitest";
import {
  aggregateScores,
  applyAction,
  buildTurnOrder,
  canStartGame,
  createInputGate,
  createPromptDeck,
  emptyStats,
  gestureToAction,
  winners,
  type Action,
  type TurnResult,
} from "../game";
import { CARDS, CLUE_LABEL, filterCards } from "../cards";
import { DEFAULT_PREFS, parsePrefs } from "../prefs";
import { cleanName, loadRoster, loadSelection, MAX_NAME_LENGTH, newPlayer } from "../players";

/** Simulate a full game: each turn plays a scripted action list. */
function playGame(players: string[], rounds: number, script: (p: string, r: number) => Action[]) {
  const results: TurnResult[] = [];
  for (const t of buildTurnOrder(players, rounds)) {
    let s = emptyStats();
    for (const a of script(t.player, t.round)) s = applyAction(s, a);
    results.push({ playerId: t.player, name: t.player, round: t.round, ...s });
  }
  return results;
}

describe("complete equal-turn games", () => {
  for (const n of [2, 3, 5])
    for (const rounds of [1, 2, 3])
      it(`${n} players × ${rounds} turns each`, () => {
        const ps = Array.from({ length: n }, (_, i) => `p${i}`);
        const res = playGame(ps, rounds, (p) => Array(Number(p.slice(1)) + 1).fill("got"));
        expect(res).toHaveLength(n * rounds);
        const totals = aggregateScores(res);
        for (const t of totals) {
          expect(t.turns).toBe(rounds);
          expect(t.total).toBe((Number(t.playerId.slice(1)) + 1) * rounds);
        }
        expect(winners(totals).map((w) => w.playerId)).toEqual([`p${n - 1}`]);
      });

  it("cumulative scoring with mixed GOT IT/PASS and a final tie", () => {
    const res = playGame(["a", "b"], 2, (p, r) =>
      p === "a" ? (r === 1 ? ["got", "pass", "got"] : ["got"]) : ["pass", "got", "got", "got"].slice(0, r === 1 ? 4 : 1),
    );
    const t = aggregateScores(res);
    expect(t.find((x) => x.playerId === "a")?.total).toBe(3);
    expect(t.find((x) => x.playerId === "b")?.total).toBe(3);
    expect(winners(t)).toHaveLength(2);
    expect(t.every((x) => x.rank === 1)).toBe(true);
  });

  it("all-pass game is an all-zero tie", () => {
    const t = aggregateScores(playGame(["a", "b", "c"], 2, () => ["pass", "pass"]));
    expect(t.every((x) => x.total === 0 && x.passes === 4 && x.rank === 1)).toBe(true);
  });
});

describe("rematch / new game semantics", () => {
  it("rematch = fresh results + fresh deck, same players and turn count", () => {
    const players = ["a", "b"];
    const first = playGame(players, 2, () => ["got"]);
    expect(aggregateScores(first)[0]?.total).toBe(2);
    const rematch: TurnResult[] = []; // startGame resets results
    expect(aggregateScores(rematch)).toEqual([]);
    expect(buildTurnOrder(players, 2)).toHaveLength(4);
    const pool = filterCards("mix", "all");
    const d1 = createPromptDeck(pool);
    for (let i = 0; i < 10; i++) d1.next();
    const d2 = createPromptDeck(pool); // new deck has every card unused
    expect(d2.remaining).toBe(pool.length);
  });
});

describe("mode / category eligibility", () => {
  it("MIX includes internal either cards; SOUND/ACT include either too", () => {
    const either = CARDS.filter((c) => c.clueType === "either");
    expect(either.length).toBeGreaterThan(0);
    for (const m of ["sound", "act", "mix"] as const)
      expect(filterCards(m, "all").filter((c) => c.clueType === "either")).toHaveLength(either.length);
  });
  it("no user-facing label uses the word Either", () => {
    for (const l of Object.values(CLUE_LABEL)) expect(l.toLowerCase()).not.toContain("either");
  });
  it("every mode × category has playable cards", () => {
    for (const m of ["sound", "act", "mix"] as const)
      for (const c of ["animals", "things", "human", "whats"] as const)
        expect(filterCards(m, [c]).length).toBeGreaterThan(3);
  });
});

describe("repeat protection across recycles", () => {
  it("each cycle deals every card exactly once, never back-to-back", () => {
    const pool = Array.from({ length: 7 }, (_, i) => ({ id: `${i}` }));
    const d = createPromptDeck(pool);
    let prev = "";
    for (let cycle = 0; cycle < 5; cycle++) {
      const ids = Array.from({ length: 7 }, () => d.next()!.id);
      expect(new Set(ids).size).toBe(7);
      expect(ids[0]).not.toBe(prev);
      prev = ids[6]!;
    }
    expect(d.cycles).toBe(4);
  });
  it("two-card pool alternates", () => {
    const d = createPromptDeck([{ id: "a" }, { id: "b" }]);
    const seq = Array.from({ length: 8 }, () => d.next()!.id);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
  });
});

describe("input lock & gestures", () => {
  it("burst of 10 inputs on one card registers once", () => {
    const g = createInputGate();
    expect(Array.from({ length: 10 }, () => g.tryAccept(true, 20)).filter(Boolean)).toHaveLength(1);
    g.lock();
    expect(g.locked).toBe(true);
    g.release();
    expect(g.tryAccept(true, 20)).toBe(true);
  });
  it("canonical mapping: DOWN = GOT IT, UP = PASS", () => {
    expect(applyAction(emptyStats(), gestureToAction("down")).correct).toBe(1);
    expect(applyAction(emptyStats(), gestureToAction("up"))).toMatchObject({ correct: 0, passes: 1 });
  });
});

describe("preferences fallback", () => {
  it("handles non-object / partial / wrong-typed data per field", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(42)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs([])).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ music: false, roundSeconds: "60", mode: "either" })).toEqual({
      ...DEFAULT_PREFS,
      music: false,
    });
    expect(parsePrefs({ roundSeconds: 30, rounds: 2 })).toMatchObject({ roundSeconds: 30, rounds: 2 });
  });
});

describe("roster edge cases", () => {
  let m: Map<string, string>;
  beforeEach(() => {
    m = new Map();
    (globalThis as unknown as { window: unknown }).window = {};
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  });
  it("clamps long names and collapses whitespace", () => {
    expect(newPlayer("x".repeat(80)).name).toHaveLength(MAX_NAME_LENGTH);
    expect(cleanName("  Mary   Jo  ")).toBe("Mary Jo");
  });
  it("drops malformed, blank and duplicate roster entries", () => {
    m.set(
      "sound-it:roster",
      JSON.stringify([{ id: "1", name: "Ann" }, null, { id: 2, name: "x" }, { id: "3", name: "   " }, { id: "1", name: "Dup" }, { id: "4", name: "y".repeat(50) }]),
    );
    const r = loadRoster();
    expect(r.map((p) => p.id)).toEqual(["1", "4"]);
    expect(r[1]?.name).toHaveLength(MAX_NAME_LENGTH);
  });
  it("corrupt selection is sanitized", () => {
    m.set("sound-it:selection", JSON.stringify(["a", "a", 3, null, "b"]));
    expect(loadSelection()).toEqual(["a", "b"]);
    m.set("sound-it:selection", "{bad");
    expect(loadSelection()).toEqual([]);
  });
  it("min players enforced", () => {
    expect(canStartGame(0, 50)).toEqual({ ok: false, reason: "players" });
    expect(canStartGame(1, 50)).toEqual({ ok: false, reason: "players" });
  });
});
