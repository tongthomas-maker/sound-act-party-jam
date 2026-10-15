import { describe, expect, it } from "vitest";
import {
  applyAction,
  createInputGate,
  emptyStats,
  fireBonus,
  stepRoundClock,
  aggregateScores,
} from "../game";

describe("scoring once per valid GOT IT!", () => {
  it("ten GOT IT! cards give exactly 10 points, plus 7 FIRE bonuses", () => {
    let s = emptyStats();
    let bonus = 0;
    for (let i = 0; i < 10; i++) {
      bonus += fireBonus(s.streak, "got");
      s = applyAction(s, "got");
    }
    expect(s.correct).toBe(10);
    expect(bonus).toBe(7);
  });

  it("duplicate inputs on one card (gate held) never add a second point", () => {
    const gate = createInputGate();
    let s = emptyStats();
    for (let i = 0; i < 5; i++) if (gate.tryAccept(true, 10)) s = applyAction(s, "got");
    expect(s.correct).toBe(1);
  });
});

describe("PASS never scores", () => {
  it("PASS adds no point, no bonus, and ends FIRE mode", () => {
    let s = emptyStats();
    for (let i = 0; i < 4; i++) s = applyAction(s, "got");
    expect(fireBonus(s.streak, "pass")).toBe(0);
    s = applyAction(s, "pass");
    expect(s).toMatchObject({ correct: 4, passes: 1, streak: 0, bestStreak: 4 });
  });
});

describe("round timer boundaries", () => {
  it("60s round expires exactly once after 60 ticks and stays at 0", () => {
    let left = 60;
    let expiries = 0;
    for (let i = 0; i < 65; i++) {
      const r = stepRoundClock(left);
      left = r.left;
      if (r.expired) expiries++;
      if (i === 58) expect(left).toBe(1);
    }
    expect(left).toBe(0);
    expect(expiries).toBe(1);
  });

  it("no input is accepted once the clock hits 0", () => {
    const gate = createInputGate();
    expect(gate.tryAccept(true, 0)).toBe(false);
    expect(gate.tryAccept(true, 1)).toBe(true);
  });
});
