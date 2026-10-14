import { describe, expect, it } from "vitest";
import {
  HOLD_MS,
  LOCK_MS,
  initialTiltMachine,
  landscapeSign,
  stepTilt,
  type TiltMachine,
} from "../../hooks/use-tilt-controls";
import { applyAction, createInputGate, emptyStats } from "../game";

const ready = (t0 = 0): TiltMachine => {
  let m = stepTilt(initialTiltMachine(), 0, t0).machine;
  m = stepTilt(m, 0, t0 + HOLD_MS).machine;
  return m;
};

describe("rapid repeated tilt (synthetic)", () => {
  it("jittery 10ms samples past threshold fire exactly once per lock window", () => {
    let m = ready();
    let fires = 0;
    for (let t = 1000; t < 1000 + LOCK_MS; t += 10) {
      const r = stepTilt(m, t % 20 === 0 ? 30 : -30, t);
      m = r.machine;
      if (r.fire) fires++;
    }
    expect(fires).toBe(1);
  });

  it("five quick DOWN flicks spaced past the lock score five, never more", () => {
    let m = ready();
    const gate = createInputGate();
    let s = emptyStats();
    let t = 1000;
    for (let i = 0; i < 5; i++) {
      for (let k = 0; k < 3; k++) {
        const r = stepTilt(m, 25, t + k * 5);
        m = r.machine;
        if (r.fire === "correct" && gate.tryAccept(true, 30)) s = applyAction(s, "got");
      }
      gate.release();
      t += LOCK_MS;
      m = stepTilt(m, 0, t).machine; // lock expiry -> READY (caller rebases)
      t += 10;
    }
    expect(s.correct).toBe(5);
    expect(s.passes).toBe(0);
  });

  it("gate blocks a tilt and a button tap landing on the same card", () => {
    const gate = createInputGate();
    let s = emptyStats();
    const r = stepTilt(ready(), 25, 1000);
    if (r.fire && gate.tryAccept(true, 30)) s = applyAction(s, "got");
    if (gate.tryAccept(true, 30)) s = applyAction(s, "pass");
    expect(s).toMatchObject({ correct: 1, passes: 0 });
  });
});

describe("rotation mid-turn (synthetic)", () => {
  it("fresh machine after rotation must hold still before any fire", () => {
    let m = initialTiltMachine(); // hook resets on orientationchange
    const r1 = stepTilt(m, 40, 0); // rotation swing itself
    expect(r1.fire).toBeNull();
    m = stepTilt(r1.machine, 0, 100).machine;
    expect(stepTilt(m, 30, 100 + HOLD_MS - 1).fire).toBeNull();
  });

  it("landscapeSign mirrors gamma: same physical DOWN gives opposite raw gamma per side", () => {
    // Physical DOWN reads +25 gamma at 90°, -25 at 270/-90°; both must project to +25.
    expect(25 * landscapeSign(90)).toBe(25);
    expect(-25 * landscapeSign(270)).toBe(25);
    expect(-25 * landscapeSign(-90)).toBe(25);
    expect(stepTilt(ready(), -25 * landscapeSign(270), 1000).fire).toBe("correct");
    // un-mirrored reading on the 270 side would wrongly PASS
    expect(stepTilt(ready(), -25, 1000).fire).toBe("pass");
  });

});
