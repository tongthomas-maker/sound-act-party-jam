// @vitest-environment jsdom
/**
 * Batch 48 deterministic harness: real useTiltControls hook -> real input gate
 * -> real scoring -> real round clock. Mirrors how the play screen wires them,
 * so a tilt or button event travels the same path to the score as in the app.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTiltControls } from "../../hooks/use-tilt-controls";
import {
  applyAction,
  createInputGate,
  emptyStats,
  stepRoundClock,
  type Action,
  type TurnStats,
} from "../game";

type Perm = "granted" | "denied" | undefined;

function harness({ perm, secondsLeft = 30 }: { perm?: Perm; secondsLeft?: number } = {}) {
  Object.defineProperty(window, "orientation", { value: 90, configurable: true });
  Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (X11)", configurable: true });
  class FakeOrientationEvent extends Event {}
  if (perm)
    (
      FakeOrientationEvent as unknown as { requestPermission: () => Promise<string> }
    ).requestPermission = () => Promise.resolve(perm);
  (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent =
    FakeOrientationEvent;

  const round = {
    left: secondsLeft,
    stats: emptyStats() as TurnStats,
    log: [] as Action[],
    buzzers: 0,
  };
  const gate = createInputGate();
  const score = (a: Action) => {
    if (!gate.tryAccept(true, round.left)) return false;
    round.stats = applyAction(round.stats, a);
    round.log.push(a);
    return true;
  };
  const hook = renderHook(() =>
    useTiltControls({
      enabled: true,
      onDown: () => score("got"),
      onUp: () => score("pass"),
      preferOn: true,
    }),
  );
  const nextCard = () => gate.release();
  const tickSecond = () => {
    const s = stepRoundClock(round.left);
    round.left = s.left;
    if (s.expired) {
      round.buzzers++;
      gate.lock(); // buzzer cutoff: no input after time-up
    }
  };
  return { round, hook, score, nextCard, tickSecond };
}

function emit(at: number, gamma: number) {
  vi.setSystemTime(at);
  const e = new Event("deviceorientation") as Event & { beta: number; gamma: number };
  Object.assign(e, { beta: 0, gamma });
  act(() => {
    window.dispatchEvent(e);
  });
}
function hold(from: number, to: number, deg: number) {
  for (let t = from; t <= to; t += 16) emit(t, deg);
  return to;
}
const arm = () => hold(0, 1800, 0); // calibrate 800ms + hold-still 800ms

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  Object.defineProperty(window, "innerWidth", { value: 800, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 400, configurable: true });
});
afterEach(() => vi.useRealTimers());

describe("tilt round harness", () => {
  it("flip DOWN scores exactly one GOT IT", () => {
    const h = harness();
    arm();
    hold(1816, 2000, 30);
    expect(h.round.stats).toMatchObject({ correct: 1, passes: 0, streak: 1 });
  });

  it("flip UP records one PASS and no point", () => {
    const h = harness();
    arm();
    hold(1816, 2000, -30);
    expect(h.round.stats).toMatchObject({ correct: 0, passes: 1, streak: 0 });
  });

  it("repeated sensor events while held down never double score", () => {
    const h = harness();
    arm();
    hold(1816, 4000, 35); // 2+ seconds of identical DOWN samples
    expect(h.round.log).toEqual(["got"]);
  });

  it("return to neutral then flip again scores the next card once", () => {
    const h = harness();
    let t = arm();
    t = hold(t + 16, t + 200, 30);
    h.nextCard();
    t = hold(t + 16, t + 1000, 0); // back to neutral past the 600ms lock
    hold(t + 16, t + 200, -30);
    expect(h.round.log).toEqual(["got", "pass"]);
  });

  it("debounce: tilt and button on the same card score once", () => {
    const h = harness();
    arm();
    hold(1816, 1900, 30);
    expect(h.score("got")).toBe(false);
    expect(h.score("pass")).toBe(false);
    expect(h.round.log).toEqual(["got"]);
  });

  it("buzzer cutoff: tilts and taps after time-up never score, buzzer fires once", () => {
    const h = harness({ secondsLeft: 2 });
    const t = arm();
    h.tickSecond();
    h.tickSecond();
    h.tickSecond();
    expect(h.round.buzzers).toBe(1);
    h.nextCard();
    hold(t + 16, t + 300, 30);
    expect(h.score("got")).toBe(false);
    expect(h.round.stats.correct).toBe(0);
  });

  it("permission denied: tilt is inert, buttons stay reliable card after card", async () => {
    const h = harness({ perm: "denied" });
    await act(async () => {
      await h.hook.result.current.toggleMotion();
    });
    expect(h.hook.result.current.permission).toBe("denied");
    expect(h.hook.result.current.motionOn).toBe(false);
    hold(0, 3000, 40);
    expect(h.round.log).toEqual([]);
    for (const a of ["got", "pass", "got"] as Action[]) {
      expect(h.score(a)).toBe(true);
      expect(h.score(a)).toBe(false); // double tap ignored
      h.nextCard();
    }
    expect(h.round.stats).toMatchObject({ correct: 2, passes: 1 });
  });
});
