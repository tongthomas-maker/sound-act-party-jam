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
 * Known behavior: the orientation effect captures `landscapeSign` once when
 * the listener attaches and does not re-run on rotation. After a 180° flip
 * the sign is stale, so a physical DOWN tilt on the new side is currently
 * scored as PASS (and vice versa) until the next turn re-attaches the
 * listener. The rotation swing itself still never scores (600ms lock).
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
void now;

/**
 * PROPOSED-FIX expectations (skipped until the owner approves the fix).
 * Fix: inside the gesture effect, on orientationchange re-read
 * landscapeSign(screenAngle()) and restart the 800ms calibration.
 * Remove `.skip` and the CURRENT BEHAVIOR tests above when applying it.
 */
describe.skip("PROPOSED FIX: mid-card 180° rotation keeps DOWN = GOT IT!", () => {
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
