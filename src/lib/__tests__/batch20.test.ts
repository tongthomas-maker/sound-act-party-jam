import { describe, expect, it } from "vitest";
import { aggregateScores, ROUND_LENGTHS, stepRoundClock, winners } from "../game";

describe("every round length expires exactly once at 0", () => {
  for (const len of ROUND_LENGTHS)
    it(`${len}s round`, () => {
      let left: number = len;
      let expiries = 0;
      let ticks = 0;
      while (left > 0) {
        const r = stepRoundClock(left);
        left = r.left;
        ticks++;
        if (r.expired) expiries++;
      }
      expect(ticks).toBe(len);
      expect(stepRoundClock(left)).toEqual({ left: 0, expired: false });
      expect(expiries).toBe(1);
    });
});

describe("FIRE bonus counts toward final ranking", () => {
  it("bonus breaks what would otherwise be a tie", () => {
    const t = aggregateScores([
      { playerId: "a", name: "A", round: 1, correct: 5, passes: 0, bestStreak: 5, bonus: 2 },
      { playerId: "b", name: "B", round: 1, correct: 6, passes: 0, bestStreak: 2 },
    ]);
    expect(t[0]).toMatchObject({ playerId: "a", total: 7, rank: 1 });
    expect(winners(t)).toHaveLength(1);
  });
});
