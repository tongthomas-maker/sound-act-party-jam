// @vitest-environment jsdom
/**
 * Realistic synthetic coverage: drives the real useTiltControls hook with
 * dispatched `deviceorientation` events (raw beta/gamma, wall-clock time),
 * instead of feeding pre-computed deltas into the pure state machine.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTiltControls } from "../../hooks/use-tilt-controls";

type Perm = "granted" | "denied" | undefined;

function setup({
  angle = 90,
  ua = "Mozilla/5.0 (X11)",
  perm,
}: { angle?: number; ua?: string; perm?: Perm } = {}) {
  Object.defineProperty(window, "orientation", { value: angle, configurable: true });
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
  class FakeOrientationEvent extends Event {}
  if (perm) {
    (FakeOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission =
      () => Promise.resolve(perm);
  }
  (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent =
    FakeOrientationEvent;
  const onDown = vi.fn();
  const onUp = vi.fn();
  const hook = renderHook(() => useTiltControls({ enabled: true, onDown, onUp, preferOn: true }));
  return { onDown, onUp, hook };
}

let now = 0;
function emit(at: number, gamma: number, beta = 0) {
  now = at;
  vi.setSystemTime(at);
  const e = new Event("deviceorientation") as Event & { beta: number; gamma: number };
  Object.assign(e, { beta, gamma });
  act(() => {
    window.dispatchEvent(e);
  });
}
/** Realistic resting hand: 60Hz samples with ±2° jitter around `rest`. */
function rest(from: number, to: number, restDeg: number) {
  for (let t = from; t <= to; t += 16) emit(t, restDeg + ((t / 16) % 5) - 2);
}
/** Smooth flick from `a` to `b` degrees over `ms`, 60Hz. */
function sweep(from: number, ms: number, a: number, b: number) {
  for (let t = 0; t <= ms; t += 16) emit(from + t, a + ((b - a) * t) / ms);
  return from + ms;
}
/** Calibrate (800ms) + hold still (800ms) => READY, at a natural 10° hand angle. */
function arm(restDeg = 10) {
  rest(0, 1800, restDeg);
  return 1800;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useTiltControls with dispatched deviceorientation events", () => {
  it("landscape 90°: physical DOWN (gamma rising) = one GOT IT!, no PASS", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    const t = arm(10);
    sweep(t + 16, 200, 10, 45);
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
  });

  it("landscape 90°: physical UP (gamma falling) = one PASS, no GOT IT!", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    const t = arm(10);
    sweep(t + 16, 200, 10, -25);
    expect(onUp).toHaveBeenCalledTimes(1);
    expect(onDown).not.toHaveBeenCalled();
  });

  it("landscape -90° (other side): raw gamma is mirrored, same physical DOWN still = GOT IT!", () => {
    const { onDown, onUp } = setup({ angle: -90 });
    const t = arm(-10);
    sweep(t + 16, 200, -10, -45); // gamma falls on this side for physical DOWN
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
  });

  it("baseline is the resting angle, not zero: a 15° resting offset never fires", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    rest(0, 4000, 30); // resting at 30° — far past 18° from zero
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
  });

  it("hand jitter below the trigger (±12° wobble) scores nothing", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    const t = arm(10);
    for (let i = 1; i <= 120; i++) emit(t + i * 16, 10 + (i % 2 ? 12 : -12));
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
  });

  it("holding DOWN for 3s scores exactly one GOT IT!", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    let t = arm(10);
    t = sweep(t + 16, 150, 10, 45);
    rest(t + 16, t + 3000, 45);
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
  });

  it("stay down after a GOT IT!, then flick further down: rebased baseline scores a second GOT IT!", () => {
    const { onDown } = setup({ angle: 90 });
    let t = arm(10);
    t = sweep(t + 16, 150, 10, 40);
    rest(t + 16, t + 700, 40); // lock (600ms) expires while held down -> rebase at ~40°
    t += 700;
    sweep(t + 16, 150, 40, 70);
    expect(onDown).toHaveBeenCalledTimes(2);
  });

  it("flick inside the 600ms lock is ignored", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    let t = arm(10);
    t = sweep(t + 16, 100, 10, 40);
    t = sweep(t + 16, 100, 40, -20); // back up hard within lock
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
  });

  it("rotation event: the rotation swing itself (within 600ms) does not score", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    const t = arm(10);
    act(() => {
      window.dispatchEvent(new Event("orientationchange"));
    });
    sweep(t + 16, 400, 10, 80);
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
  });

  it("calibration window: big movement in the first 800ms never scores", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    sweep(0, 780, -40, 60);
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
  });

  it("missing beta/gamma (null readings) do not score or throw", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    for (let t = 0; t < 3000; t += 16) {
      now = t;
      vi.setSystemTime(t);
      const e = Object.assign(new Event("deviceorientation"), { beta: null, gamma: null });
      act(() => {
        window.dispatchEvent(e);
      });
    }
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
  });

  it("iPhone default direction (-1) is applied: same raw rise maps to PASS on iPhone", () => {
    const { onDown, onUp } = setup({ angle: 90, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" });
    const t = arm(10);
    sweep(t + 16, 200, 10, 45);
    expect(onUp).toHaveBeenCalledTimes(1);
    expect(onDown).not.toHaveBeenCalled();
  });

  it("iOS permission prompt: not listening until granted", async () => {
    const { onDown, hook } = setup({ angle: 90, perm: "granted" });
    expect(hook.result.current.permission).toBe("needs-permission");
    let t = arm(10);
    sweep(t + 16, 200, 10, 45);
    expect(onDown).not.toHaveBeenCalled();
    await act(async () => {
      await hook.result.current.toggleMotion(); // Flip Controls ON -> iOS prompt
    });
    expect(hook.result.current.permission).toBe("granted");
    t = 10_000;
    rest(t, t + 1800, 10);
    sweep(t + 1816, 200, 10, 45);
    expect(onDown).toHaveBeenCalledTimes(1);
  });

  it("iOS permission denied: state is 'denied', tilt never scores", async () => {
    const { onDown, onUp, hook } = setup({ angle: 90, perm: "denied" });
    await act(async () => {
      await hook.result.current.toggleMotion(); // Flip Controls ON -> user taps Don't Allow
    });
    expect(hook.result.current.motionOn).toBe(false);
    expect(hook.result.current.permission).toBe("denied");
    const t = arm(10);
    sweep(t + 16, 200, 10, 45);
    sweep(t + 400, 200, 10, -25);
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
  });
});

/**
 * Mid-card 180° landscape rotation (flip the phone to the other side without
 * a new turn). These tests DOCUMENT current behavior; they must not be
 * "fixed" by changing scoring without owner approval.
 *
 * Fixed behavior: on orientationchange the hook re-reads `landscapeSign` and
 * restarts calibration, so DOWN stays GOT IT! on the new side. The rotation
 * swing itself still never scores (600ms lock + recalibration).
 */
describe("mid-card 180° landscape rotation (documents current behavior)", () => {
  function rotateTo(angle: number) {
    Object.defineProperty(window, "orientation", { value: angle, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("orientationchange"));
    });
  }

  it("the rotation swing itself never scores after a 180° flip", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    const t = arm(10);
    rotateTo(-90);
    // big gamma swing while turning the phone end-over-end, within the 600ms lock
    sweep(t + 16, 400, 10, -70);
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
  });


  it("a fresh turn after rotation scores correctly again (listener re-attaches with the new side)", () => {
    const first = setup({ angle: 90 });
    const t = arm(10);
    rotateTo(-90);
    sweep(t + 16, 400, 10, -70);
    first.hook.unmount(); // turn ends -> listener removed
    const second = setup({ angle: -90 }); // next turn: fresh listener, fresh sign
    const t2 = arm(-10);
    sweep(t2 + 16, 200, -10, -45); // physical DOWN on -90 side
    expect(second.onDown).toHaveBeenCalledTimes(1);
    expect(second.onUp).not.toHaveBeenCalled();
  });
});
/**
 * Edge cases: permission lifecycle, rapid repeated 180° flips, and
 * rearm/debounce behavior. These document and lock in current behavior;
 * scoring rules (18° trigger, DOWN = GOT IT!, UP = PASS) are unchanged.
 */
describe("edge cases: permission, rapid flips, rearm/debounce", () => {
  function rotateTo(angle: number) {
    Object.defineProperty(window, "orientation", { value: angle, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("orientationchange"));
    });
  }

  it("permission granted mid-session: tilt only scores after grant, not before", async () => {
    const { onDown, onUp, hook } = setup({ angle: 90, perm: "granted" });
    // before grant: full flick is ignored
    const t0 = arm(10);
    sweep(t0 + 16, 200, 10, 45);
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
    await act(async () => {
      await hook.result.current.toggleMotion();
    });
    expect(hook.result.current.permission).toBe("granted");
    // after grant: fresh calibration, then DOWN scores once
    const t = 20_000;
    rest(t, t + 1800, 10);
    sweep(t + 1816, 200, 10, 45);
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
  });

  it("Flip Controls toggled OFF mid-turn: tilt stops scoring immediately", async () => {
    const { onDown, onUp, hook } = setup({ angle: 90, perm: "granted" });
    await act(async () => {
      await hook.result.current.toggleMotion(); // ON
    });
    const t = 30_000;
    rest(t, t + 1800, 10);
    sweep(t + 1816, 200, 10, 45);
    expect(onDown).toHaveBeenCalledTimes(1);
    await act(async () => {
      await hook.result.current.toggleMotion(); // OFF
    });
    expect(hook.result.current.motionOn).toBe(false);
    const t2 = t + 5000;
    sweep(t2, 200, 10, 45);
    sweep(t2 + 400, 200, 10, -25);
    expect(onDown).toHaveBeenCalledTimes(1); // no new score
    expect(onUp).not.toHaveBeenCalled();
  });

  it("rapid 180° flips (90 -> -90 -> 90 within 1s): no swing scores, direction correct after settling", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    let t = arm(10);
    rotateTo(-90);
    sweep(t + 16, 300, 10, -60); // flip swing
    rotateTo(90);
    sweep(t + 332, 300, -60, 20); // flip back swing
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
    // settle on the original side, then DOWN scores again
    rest(t + 700, t + 2500, 10);
    t += 2500;
    sweep(t + 16, 200, 10, 45);
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
  });

  it("rearm/debounce: flicks inside the 600ms lock are ignored; after lock + rebase, opposite flick scores from the new baseline", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    let t = arm(10);
    t = sweep(t + 16, 150, 10, 40); // GOT IT! #1, LOCKED 600ms
    // flick back up INSIDE the lock: ignored
    sweep(t + 100, 150, 40, 5);
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
    // hold still through lock expiry: baseline rebases to the current angle
    rest(t + 300, t + 1200, 5);
    // after the lock, an UP flick from the rebased baseline scores once
    sweep(t + 1216, 200, 5, -30);
    expect(onUp).toHaveBeenCalledTimes(1);
    expect(onDown).toHaveBeenCalledTimes(1);
  });

  it("debounce: a single fast DOWN flick produces exactly one GOT IT! even with 60Hz samples past trigger", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    const t = arm(10);
    // fast flick: many consecutive samples above 18° within ~130ms
    sweep(t + 16, 130, 10, 60);
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
  });
});
/**
 * Second edge-case batch: permission fallback paths and orientation rearm
 * gaps not covered above. Deterministic, offline; no scoring changes.
 */
describe("edge cases batch 2: permission fallback + orientation rearm", () => {
  function rotateTo(angle: number) {
    Object.defineProperty(window, "orientation", { value: angle, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("orientationchange"));
    });
  }

  it("permission denied, then Flip Controls toggled again: still denied, tilt never scores", async () => {
    const { onDown, onUp, hook } = setup({ angle: 90, perm: "denied" });
    await act(async () => {
      await hook.result.current.toggleMotion();
    });
    expect(hook.result.current.permission).toBe("denied");
    await act(async () => {
      await hook.result.current.toggleMotion(); // retry -> denied again
    });
    expect(hook.result.current.permission).toBe("denied");
    expect(hook.result.current.motionOn).toBe(false);
    const t = arm(10);
    sweep(t + 16, 200, 10, 45);
    sweep(t + 400, 200, 10, -25);
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
  });

  it("Flip Controls OFF then ON again: listener re-attaches and recalibrates before scoring", async () => {
    const { onDown, onUp, hook } = setup({ angle: 90, perm: "granted" });
    await act(async () => {
      await hook.result.current.toggleMotion(); // ON
    });
    let t = 40_000;
    rest(t, t + 1800, 10);
    await act(async () => {
      await hook.result.current.toggleMotion(); // OFF
    });
    await act(async () => {
      await hook.result.current.toggleMotion(); // ON again
    });
    // movement during the fresh 800ms calibration window must not score
    sweep(t + 2000, 400, 10, 50);
    expect(onDown).not.toHaveBeenCalled();
    // after recalibrating at the new rest angle, DOWN scores once
    t += 2500;
    rest(t, t + 1800, 12);
    sweep(t + 1816, 200, 12, 47);
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
  });

  it("rotation during the 600ms LOCKED phase: lock still suppresses the swing, rearm works after", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    let t = arm(10);
    t = sweep(t + 16, 150, 10, 40); // GOT IT!, LOCKED
    rotateTo(-90); // rotation arrives while locked
    sweep(t + 16, 300, 40, -50); // big swing inside lock window
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
    // settle on the new side; DOWN on -90 side scores again
    rest(t + 400, t + 2200, -10);
    t += 2200;
    sweep(t + 16, 200, -10, -45);
    expect(onDown).toHaveBeenCalledTimes(2);
    expect(onUp).not.toHaveBeenCalled();
  });

  it("portrait (angle 0): beta axis drives scoring, gamma-only waggle scores nothing", () => {
    // jsdom defaults to 1024x768 (landscape); force portrait dimensions
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
    const { onDown, onUp } = setup({ angle: 0 });
    // calibrate + hold with beta rest 10, gamma 0
    for (let t = 0; t <= 1800; t += 16) emit(t, 0, 10);
    // waggle gamma hard (wrong axis in portrait): nothing scores
    for (let t = 1816; t <= 2400; t += 16) emit(t, (t / 16) % 2 ? 40 : -40, 10);
    expect(onDown).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
    // beta DOWN flick scores once
    let t = 2416;
    for (let i = 0; i <= 12; i++) emit(t + i * 16, 0, 10 + (35 * i) / 12);
    t += 12 * 16;
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
  });
});
void now;

/**
 * EXPECTED-BEHAVIOR tests for the applied fix: on orientationchange the
 * gesture effect re-reads landscapeSign(screenAngle()) and restarts the
 * 800ms calibration, so mid-card 180° rotation keeps DOWN = GOT IT!.
 */
describe("mid-card 180° rotation keeps DOWN = GOT IT! (fix applied)", () => {
  function rotateTo(angle: number) {
    Object.defineProperty(window, "orientation", { value: angle, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("orientationchange"));
    });
  }
  it("90° -> -90°: physical DOWN on new side = GOT IT!", () => {
    const { onDown, onUp } = setup({ angle: 90 });
    let t = arm(10);
    rotateTo(-90);
    rest(t + 16, t + 1800, -10); // recalibrate + hold on the new side
    t += 1800;
    sweep(t + 16, 200, -10, -45);
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
  });
  it("-90° -> 90°: physical UP on new side = PASS", () => {
    const { onDown, onUp } = setup({ angle: -90 });
    let t = arm(-10);
    rotateTo(90);
    rest(t + 16, t + 1800, 10);
    t += 1800;
    sweep(t + 16, 200, 10, -25);
    expect(onUp).toHaveBeenCalledTimes(1);
    expect(onDown).not.toHaveBeenCalled();
  });
});

describe("portrait -> landscape rotation mid-turn (axis re-evaluation)", () => {
  it("after rotating from portrait to landscape, DOWN on gamma scores GOT IT!", () => {
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
    const { onDown, onUp } = setup({ angle: 0 });
    rest(0, 400, 0);
    Object.defineProperty(window, "orientation", { value: 90, configurable: true });
    Object.defineProperty(window, "innerWidth", { value: 844, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 390, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("orientationchange"));
    });
    rest(1000, 2800, 10);
    sweep(2816, 200, 10, 45);
    expect(onDown).toHaveBeenCalledTimes(1);
    expect(onUp).not.toHaveBeenCalled();
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
  });
});
