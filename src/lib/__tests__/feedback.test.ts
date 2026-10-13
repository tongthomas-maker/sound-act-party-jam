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
