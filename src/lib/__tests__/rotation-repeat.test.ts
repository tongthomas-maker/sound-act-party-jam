import { describe, expect, it } from "vitest";
import {
  HOLD_MS,
  LOCK_MS,
  TRIGGER_DEG,
  initialTiltMachine,
  landscapeSign,
  stepTilt,
  type TiltMachine,
} from "../../hooks/use-tilt-controls";
import { applyAction, createInputGate, emptyStats } from "../game";

const ready = (t0 = 0): TiltMachine => {
  const m = stepTilt(initialTiltMachine(), 0, t0).machine;
  return stepTilt(m, 0, t0 + HOLD_MS).machine;
};

describe("mid-turn rotation (synthetic)", () => {
  it("score earned before rotating is kept; rotation swing itself scores nothing", () => {
    const gate = createInputGate();
    let s = emptyStats();
    const r = stepTilt(ready(), 25 * landscapeSign(90) * landscapeSign(90), 1000);
    if (r.fire === "correct" && gate.tryAccept(true, 30)) s = applyAction(s, "got");
    gate.release();
    // rotate 90 -> 270: hook resets machine; the big swing must not fire
    let m = initialTiltMachine();
    for (let t = 2000; t < 2200; t += 20) {
      const x = stepTilt(m, 60, t);
      m = x.machine;
      expect(x.fire).toBeNull();
    }
    expect(s).toMatchObject({ correct: 1, passes: 0 });
  });

  it("after rotating to the other side, DOWN still scores GOT IT! once", () => {
    let m = ready(3000);
    const raw = 25 * landscapeSign(270); // physical DOWN on 270 side
    const r = stepTilt(m, raw * landscapeSign(270), 4000);
    expect(r.fire).toBe("correct");
    m = r.machine;
    expect(stepTilt(m, raw * landscapeSign(270), 4100).fire).toBeNull();
  });
});

describe("repeated tilt scoring (synthetic)", () => {
  it("alternating DOWN/UP flicks after each lock score 3 GOT IT! and 2 PASS", () => {
    let m = ready();
    const gate = createInputGate();
    let s = emptyStats();
    let t = 1000;
    const seq = [25, -25, 25, -25, 25];
    for (const v of seq) {
      const r = stepTilt(m, v, t);
      m = r.machine;
      if (r.fire && gate.tryAccept(true, 30))
        s = applyAction(s, r.fire === "correct" ? "got" : "pass");
      gate.release();
      t += LOCK_MS;
      m = stepTilt(m, 0, t).machine; // lock expiry -> READY
      t += 10;
    }
    expect(s.correct).toBe(3);
    expect(s.passes).toBe(2);
  });

  it("exactly-at-threshold tilt never scores", () => {
    expect(stepTilt(ready(), TRIGGER_DEG, 1000).fire).toBeNull();
    expect(stepTilt(ready(), -TRIGGER_DEG, 1000).fire).toBeNull();
  });

  it("tilt during HOLD (before turn is ready) never scores", () => {
    let m = initialTiltMachine();
    for (let t = 0; t < HOLD_MS; t += 50) {
      const r = stepTilt(m, 40, t);
      m = r.machine;
      expect(r.fire).toBeNull();
    }
  });
});
