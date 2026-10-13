import { afterEach, describe, expect, it, vi } from "vitest";
import { hapticGotIt, hapticSkip, hapticTick, hapticWin, setHapticsEnabled } from "../haptics";
import { __resetAudioForTests, unlockAudio } from "../audio";
import { parsePrefs } from "../prefs";

afterEach(() => {
  vi.unstubAllGlobals();
  setHapticsEnabled(true);
  __resetAudioForTests();
});

describe("haptics + audio feedback", () => {
  it("vibrates a double buzz on CORRECT", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    hapticGotIt();
    expect(vibrate).toHaveBeenCalledWith([100, 30, 100]);
  });

  it("vibrates a long buzz on PASS", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    hapticSkip();
    expect(vibrate).toHaveBeenCalledWith([200]);
  });

  it("resumes a suspended AudioContext on tap", () => {
    const resume = vi.fn(() => Promise.resolve());
    const node = () => ({ connect: vi.fn(), gain: { value: 0, setValueAtTime: vi.fn() } });
    const param = () => ({ setValueAtTime: vi.fn() });
    class FakeAC {
      state = "suspended";
      currentTime = 0;
      destination = {};
      resume = resume;
      createGain = node;
      createDynamicsCompressor = () => ({
        connect: vi.fn(),
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
      });
    }
    vi.stubGlobal("window", { AudioContext: FakeAC });
    unlockAudio();
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("does not crash when vibrate is unsupported, and respects the Vibration toggle", () => {
    vi.stubGlobal("navigator", {});
    expect(() => {
      hapticGotIt();
      hapticSkip();
      hapticTick();
      hapticWin();
    }).not.toThrow();
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    setHapticsEnabled(false);
    hapticGotIt();
    expect(vibrate).not.toHaveBeenCalled();
    expect(parsePrefs({}).volume).toBe(80);
    expect(parsePrefs({}).haptics).toBe(true);
  });
});

import {
  aggregateScores,
  applyAction,
  emptyStats,
  fireBonus,
  isFireMode,
  isQuickCallUnlocked,
  isStreakMilestone,
  recap,
  shareText,
  gestureToAction,
} from "../game";
import { buildPlayPool } from "../playcards";
import { CATEGORIES } from "../cards";

describe("fire mode + recap + unlock", () => {
  it("FIRE MODE starts at a 3 streak", () => {
    expect(isFireMode(2)).toBe(false);
    expect(isFireMode(3)).toBe(true);
  });
  it("GOT IT while in fire mode earns +1 bonus; PASS never does", () => {
    expect(fireBonus(2, "got")).toBe(0);
    expect(fireBonus(3, "got")).toBe(1);
    expect(fireBonus(5, "pass")).toBe(0);
  });
  it("5 correct in a row = 5 + 2 bonus points", () => {
    let s = emptyStats();
    let bonus = 0;
    for (let i = 0; i < 5; i++) {
      bonus += fireBonus(s.streak, "got");
      s = applyAction(s, "got");
    }
    expect(s.correct + bonus).toBe(7);
  });
  it("bonus is included in final totals", () => {
    const t = aggregateScores([
      { playerId: "a", name: "A", round: 1, correct: 5, passes: 0, bestStreak: 5, bonus: 2 },
      { playerId: "b", name: "B", round: 1, correct: 6, passes: 0, bestStreak: 1 },
    ]);
    expect(t[0]?.name).toBe("A");
    expect(t[0]?.total).toBe(7);
  });
  it("confetti burst every 3rd streak", () => {
    expect([1, 2, 3, 4, 5, 6].map(isStreakMilestone)).toEqual([
      false,
      false,
      true,
      false,
      false,
      true,
    ]);
  });
  it("recap splits lists and finds fastest correct", () => {
    const r = recap([
      { prompt: "Dog", action: "got", ms: 4000 },
      { prompt: "Cat", action: "pass", ms: 1000 },
      { prompt: "Cow", action: "got", ms: 1500 },
    ]);
    expect(r.correct.map((e) => e.prompt)).toEqual(["Dog", "Cow"]);
    expect(r.passed.map((e) => e.prompt)).toEqual(["Cat"]);
    expect(r.fastest?.prompt).toBe("Cow");
  });
  it("Quick Call unlocks after 3 completed games", () => {
    expect(isQuickCallUnlocked(2)).toBe(false);
    expect(isQuickCallUnlocked(3)).toBe(true);
  });
  it("share text lists ranks and scores", () => {
    expect(
      shareText(
        aggregateScores([
          { playerId: "a", name: "Ann", round: 1, correct: 4, passes: 0, bestStreak: 2 },
        ]),
      ),
    ).toContain("1. Ann — 4");
  });
  it("gesture mapping unchanged: DOWN = GOT IT, UP = PASS", () => {
    expect(gestureToAction("down")).toBe("got");
    expect(gestureToAction("up")).toBe("pass");
  });
  it("card hints match mode", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(buildPlayPool("sound", ids).every((c) => c.badge === null)).toBe(true);
    expect(buildPlayPool("act", ids)[0]?.hint).toBe("Act it out!");
    expect(buildPlayPool("quick", ids).length).toBeGreaterThan(0);
  });
});
