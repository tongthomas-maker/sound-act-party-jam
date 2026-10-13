import { describe, expect, it } from "vitest";
import {
  aggregateScores,
  applyAction,
  buildTurnOrder,
  canStartGame,
  createInputGate,
  createPromptDeck,
  emptyStats,
  gestureToAction,
  stepCountdown,
  stepRoundClock,
  winners,
} from "../game";
import { filterCards } from "../cards";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "../prefs";
import { tiltForOrientation } from "../../hooks/use-tilt-controls";

describe("countdown → active boundary", () => {
  it("5-sec countdown reaches done exactly once after 5 steps, never negative", () => {
    let v = 5;
    const seen: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      const s = stepCountdown(v);
      v = s.value;
      seen.push(s.done);
    }
    expect(seen).toEqual([false, false, false, false, true]);
    expect(stepCountdown(0)).toEqual({ value: 0, done: true });
  });
});

describe("master timer zero boundary", () => {
  for (const len of [30, 60, 90])
    it(`${len}s round expires exactly once`, () => {
      let left = len;
      let expiries = 0;
      for (let i = 0; i < len + 5; i++) {
        const s = stepRoundClock(left);
        left = s.left;
        if (s.expired) expiries++;
      }
      expect(left).toBe(0);
      expect(expiries).toBe(1);
    });
  it("actions at or after zero are rejected; at 1s accepted", () => {
    const g = createInputGate();
    expect(g.tryAccept(true, 0)).toBe(false);
    expect(g.tryAccept(true, -1)).toBe(false);
    expect(g.tryAccept(true, 1)).toBe(true);
  });
  it("pause/resume preserves remaining time (resume continues from same value)", () => {
    let left = 60;
    for (let i = 0; i < 10; i++) left = stepRoundClock(left).left;
    const pausedAt = left; // no steps while paused
    for (let i = 0; i < 3; i++) left = stepRoundClock(left).left;
    expect(pausedAt).toBe(50);
    expect(left).toBe(47);
  });
});

describe("rapid mixed button + gesture events", () => {
  it("interleaved taps and gestures on one card score once until release", () => {
    const g = createInputGate();
    let s = emptyStats();
    const events: ("got" | "pass")[] = [
      "got",
      gestureToAction("down"),
      "pass",
      gestureToAction("up"),
    ];
    for (const e of events) if (g.tryAccept(true, 20)) s = applyAction(s, e);
    expect(s).toMatchObject({ correct: 1, passes: 0 });
    g.release(); // next card
    if (g.tryAccept(true, 20)) s = applyAction(s, gestureToAction("up"));
    expect(s).toMatchObject({ correct: 1, passes: 1, streak: 0 });
  });
  it("a lock held at time-up stays locked (no leaked release scoring)", () => {
    const g = createInputGate();
    g.tryAccept(true, 1);
    g.lock(); // time-up
    expect(g.tryAccept(true, 0)).toBe(false);
  });
});

describe("round boundaries and final turn", () => {
  it("last turn index maps to final scoreboard; rounds are contiguous blocks", () => {
    const t = buildTurnOrder(["a", "b"], 3);
    expect(t.at(-1)).toEqual({ player: "b", round: 3 });
    expect(t.findIndex((x) => x.round === 2)).toBe(2);
  });
});

describe("Play Again / New Game deck reset", () => {
  it("fresh deck deals full unused pool even after previous exhaustion", () => {
    const pool = filterCards("sound", ["animals"]);
    const d1 = createPromptDeck(pool);
    for (let i = 0; i < pool.length + 3; i++) d1.next();
    expect(d1.cycles).toBe(1);
    const d2 = createPromptDeck(pool);
    const ids = Array.from({ length: pool.length }, () => d2.next()!.id);
    expect(new Set(ids).size).toBe(pool.length);
    expect(d2.cycles).toBe(0);
  });
  it("results from previous game don't carry over", () => {
    expect(winners(aggregateScores([]))).toEqual([]);
  });
});

describe("empty filtering & tiny decks", () => {
  it("no categories → cannot start; never loops", () => {
    const pool = filterCards("act", []);
    expect(canStartGame(3, pool.length).ok).toBe(false);
    const d = createPromptDeck(pool);
    for (let i = 0; i < 100; i++) expect(d.next()).toBeNull();
  });
  it("single-card deck repeats safely", () => {
    const d = createPromptDeck([{ id: "only" }]);
    for (let i = 0; i < 50; i++) expect(d.next()?.id).toBe("only");
  });
});

describe("storage failure handling", () => {
  it("throwing getItem/setItem never crash and fall back to defaults", () => {
    const bad = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(loadPrefs(bad)).toEqual(DEFAULT_PREFS);
    expect(() => savePrefs(DEFAULT_PREFS, bad)).not.toThrow();
  });
});

describe("orientation-aware tilt axis", () => {
  it("maps the physical up/down axis per screen rotation", () => {
    expect(tiltForOrientation(30, 5, 0)).toBe(30);
    expect(tiltForOrientation(30, 5, 180)).toBe(-30);
    expect(tiltForOrientation(30, 20, 90)).toBe(-20);
    expect(tiltForOrientation(30, 20, 270)).toBe(20);
    expect(tiltForOrientation(30, 20, -90)).toBe(20);
  });
});

import { detectDevice, deviceTiltDefaults, swapKey } from "../../hooks/use-tilt-controls";
describe("per-device tilt defaults", () => {
  it("detects iPad/iPhone/other and stores swap per device", () => {
    expect(detectDevice("Mozilla (iPad; CPU OS 17)")).toBe("iPad");
    expect(detectDevice("Mozilla (iPhone; CPU iPhone OS 17)")).toBe("iPhone");
    expect(detectDevice("Android")).toBe("other");
    expect(swapKey("iPhone")).toBe("tiltDir_iPhone");
  });
  it("iPhone defaults to -1, iPad +1, both lock 600ms", () => {
    expect(deviceTiltDefaults("iPhone")).toEqual({ sign: -1, lockMs: 600 });
    expect(deviceTiltDefaults("iPad")).toEqual({ sign: 1, lockMs: 600 });
  });
});

import { stepTilt, initialTiltMachine, type TiltMachine } from "../../hooks/use-tilt-controls";
describe("v16 tilt state machine (no WAIT_FOR_RETURN, rebase after lock)", () => {
  const run = (m: TiltMachine, v: number, t: number) => stepTilt(m, v, t);
  const ready = (): TiltMachine => {
    let m = run(initialTiltMachine(), 0, 0).machine;
    m = run(m, 3, 800).machine;
    return m;
  };
  it("needs 0.8s still within 15 deg before READY", () => {
    let m = run(initialTiltMachine(), 0, 0).machine;
    expect(run(m, 0, 799).machine.phase).toBe("HOLD");
    m = run(m, 16, 400).machine; // moved -> restart
    expect(run(m, 0, 1000).machine.phase).toBe("HOLD");
    expect(ready().phase).toBe("READY");
  });
  it("delta > 18 = CORRECT once, delta < -18 = PASS once", () => {
    const c = run(ready(), 19, 900);
    expect(c.fire).toBe("correct");
    expect(run(c.machine, 40, 950).fire).toBeNull();
    expect(run(ready(), -19, 900).fire).toBe("pass");
    expect(run(ready(), 18, 900).fire).toBeNull();
  });
  it("locks 600ms then goes directly to READY (no return-to-zero needed)", () => {
    let m = run(ready(), 25, 1000).machine;
    expect(run(m, -30, 1500).machine.phase).toBe("LOCKED");
    const r = run(m, 40, 1600); // lock over, still held down
    expect(r.fire).toBeNull();
    expect(r.machine.phase).toBe("READY");
  });
  it("after rebase to current angle, next flick from the held position fires again", () => {
    // fire, stay down; caller rebases so delta returns to ~0 at lock expiry
    let m = run(ready(), 25, 1000).machine;
    m = run(m, 40, 1600).machine; // lock expires -> READY, held delta rebased to 0
    expect(m.phase).toBe("READY");
    expect(run(m, 2, 1700).fire).toBeNull(); // small drift: no fire
    const next = run(m, 20, 1750); // fresh flick DOWN from new baseline
    expect(next.fire).toBe("correct");
    expect(run(next.machine, 40, 1800).fire).toBeNull(); // still locked
  });
  it("never fires during LOCKED even on wild swings", () => {
    let m = run(ready(), 25, 1000).machine;
    expect(run(m, -45, 1200).fire).toBeNull();
    expect(run(m, 45, 1300).fire).toBeNull();
    expect(run(m, -45, 1599).fire).toBeNull();
  });
});
