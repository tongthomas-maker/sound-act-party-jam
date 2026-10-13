/** Progressive-enhancement haptics. Silent no-op where unsupported. */
let hapticsOn = true;

export function setHapticsEnabled(on: boolean) {
  hapticsOn = on;
}
export function isHapticsEnabled() {
  return hapticsOn;
}

function buzz(pattern: number | number[]) {
  if (!hapticsOn) return;
  if (typeof navigator === "undefined") return;
  if (!("vibrate" in navigator)) return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export function hapticsSupported() {
  if (typeof navigator === "undefined") return false;
  return "vibrate" in navigator;
}

/** GOT IT — strong double buzz. */
export function hapticGotIt() {
  buzz([100, 30, 100]);
}

/** PASS (card) — one long buzz. */
export function hapticSkip() {
  buzz([200]);
}

/** Last-10-seconds light tick. */
export function hapticTick() {
  buzz(20);
}

/** Pass to next player — one medium pulse. */
export function hapticPass() {
  buzz(60);
}

/** Game win celebration. */
export function hapticWin() {
  buzz([100, 50, 100, 50, 200]);
}

/** Time's up — strong distinctive pattern, synced with the buzzer. */
export function hapticTimeUp() {
  buzz([120, 70, 120, 70, 220]);
}
