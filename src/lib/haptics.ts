/** Progressive-enhancement haptics. Silent no-op where unsupported. */
function buzz(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
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
  return typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === "function";
}

/** GOT IT — one crisp positive pulse. */
export function hapticGotIt() {
  buzz(28);
}

/** SKIP — two short light pulses. */
export function hapticSkip() {
  buzz([14, 60, 14]);
}

/** Pass to next player — one medium pulse. */
export function hapticPass() {
  buzz(60);
}

/** Time's up — strong distinctive pattern, synced with the buzzer. */
export function hapticTimeUp() {
  buzz([120, 70, 120, 70, 220]);
}
