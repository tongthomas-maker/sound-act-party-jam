// @refresh reset
import { useCallback, useEffect, useRef, useState } from "react";

type Permission = "unsupported" | "needs-permission" | "granted" | "denied";

interface Options {
  /** Only listen while true (active gameplay, card not transitioning). */
  enabled: boolean;
  onUp: () => void;
  onDown: () => void;
  /** Saved Flip Controls preference; applied once permission state is known. */
  preferOn?: boolean;
}

/* ---- gesture tuning ---- */
const M_TRIGGER = 3.5; // m/s² on gravity Y (~20°)
const M_REARM = 1.5; // m/s² neutral band
const TRIGGER_DEG = 20; // orientation fallback
const REARM_DEG = 10; // orientation fallback neutral band
const NEUTRAL_HOLD_MS = 400; // WAIT_NEUTRAL dwell before re-arming
const OPPOSITE_BLOCK_MS = 500; // after re-arm, opposite gesture blocked this long
const LOCK_MS = 1200; // ignore everything after a trigger
const CALIBRATE_MS = 800; // baseline averaging window
const THROTTLE_MS = 100; // min time between processed events

type TiltState = "NEUTRAL" | "TRIGGERED" | "LOCKED" | "WAIT_NEUTRAL";

interface TiltDebug {
  beta: number;
  gamma: number;
  landscape: boolean;
  delta: number;
  tiltDeg: number;
  source: "motion" | "orient";
  calibrating: boolean;
  locked: boolean;
  state: string;
}

interface OrientationCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}
interface MotionCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}

function orientationCtor(): OrientationCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
}
function motionCtor(): MotionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { DeviceMotionEvent?: MotionCtor }).DeviceMotionEvent;
}

/**
 * Project beta (front-back tilt) and gamma (left-right tilt) onto the axis that
 * is physically "up/down" for how the screen is currently rotated.
 */
export function tiltForOrientation(beta: number, gamma: number, angle: number): number {
  switch (angle) {
    case 90:
      return -gamma;
    case -90:
    case 270:
      return gamma;
    case 180:
      return -beta;
    default:
      return beta;
  }
}

export function useTiltControls({ enabled, onUp, onDown, preferOn = false }: Options) {
  const [permission, setPermission] = useState<Permission>("unsupported");
  const [motionOn, setMotionOn] = useState(false);
  const [debug, setDebug] = useState<TiltDebug | null>(null);

  const cbs = useRef({ onUp, onDown });
  cbs.current = { onUp, onDown };

  // gesture state
  const armed = useRef(true);
  const lockedUntil = useRef(0);
  const lastDebugAt = useRef(0);
  const swapRef = useRef(1);
  const [swapped, setSwapped] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("tiltSwap") === "1") {
        swapRef.current = -1;
        setSwapped(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const recalibrate = useCallback(() => {
    armed.current = true;
    lockedUntil.current = 0;
  }, []);

  useEffect(() => {
    const C = orientationCtor();
    if (!C) return setPermission("unsupported");
    if (typeof C.requestPermission === "function") setPermission("needs-permission");
    else setPermission("granted");
  }, []);

  // honour the saved preference where no explicit permission prompt is needed
  useEffect(() => {
    if (permission === "granted") setMotionOn(preferOn);
    else if (!preferOn) setMotionOn(false);
  }, [preferOn, permission]);

  const requestPermission = useCallback(async () => {
    const O = orientationCtor();
    if (!O) return false;
    try {
      const M = motionCtor();
      if (M && typeof M.requestPermission === "function") {
        try {
          await M.requestPermission();
        } catch {
          /* motion is optional */
        }
      }
      if (typeof O.requestPermission === "function") {
        const res = await O.requestPermission();
        if (res !== "granted") {
          setPermission("denied");
          return false;
        }
      }
      {
        try {
          /* noop */
        } catch {
          /* motion is an optional confirmation signal */
        }
      }
    } catch {
      setPermission("denied");
      return false;
    }
    setPermission("granted");
    setMotionOn(true);
    return true;
  }, []);

  const toggleMotion = useCallback(async () => {
    if (motionOn) {
      setMotionOn(false);
      return;
    }
    if (permission === "needs-permission" || permission === "denied") {
      await requestPermission();
      return;
    }
    if (permission === "granted") setMotionOn(true);
  }, [motionOn, permission, requestPermission]);

  /* ---- screen rotation: recalibrate, never let the rotation itself fire ---- */
  useEffect(() => {
    if (!motionOn) return;
    const onChange = () => {
      recalibrate();
      lockedUntil.current = Date.now() + 600;
    };
    window.addEventListener("orientationchange", onChange);
    window.screen?.orientation?.addEventListener?.("change", onChange);
    return () => {
      window.removeEventListener("orientationchange", onChange);
      window.screen?.orientation?.removeEventListener?.("change", onChange);
    };
  }, [motionOn, recalibrate]);

  /* ---- gesture detection: devicemotion gravity Y (fallback: orientation gamma/beta) ---- */
  const lastRawDelta = useRef(0); // unswapped delta, for "Set DOWN as CORRECT"
  useEffect(() => {
    if (!enabled || !motionOn || permission !== "granted") {
      recalibrate();
      return;
    }
    recalibrate();
    const landscape = isLandscape();
    let source: "motion" | "orientation" | null = null;
    const startedAt = Date.now();
    let calStart = 0;
    let sum = 0;
    let count = 0;
    let baseline = 0;
    let calibrated = false;
    let state: TiltState = "NEUTRAL";
    let lastEventAt = 0;
    let neutralSince = 0;
    let neutralAt = 0; // when we last re-armed
    let lastAction: "down" | "up" | null = null;
    let unlockTimer: ReturnType<typeof setTimeout> | undefined;

    const process = (raw: number, tiltDeg: number, beta: number, gamma: number, unit: "m" | "d") => {
      const now = Date.now();
      if (now - lastEventAt < THROTTLE_MS) return;
      lastEventAt = now;
      const trigger = unit === "m" ? M_TRIGGER : TRIGGER_DEG;
      const rearm = unit === "m" ? M_REARM : REARM_DEG;
      if (!calibrated) {
        if (!calStart) calStart = now;
        sum += raw;
        count++;
        baseline = sum / count;
        if (now - calStart < CALIBRATE_MS) return;
        calibrated = true;
        neutralAt = now;
      }
      if (now < lockedUntil.current && state !== "LOCKED") return; // rotation guard
      const rawDelta = raw - baseline;
      lastRawDelta.current = rawDelta;
      const delta = rawDelta * swapRef.current;
      const abs = Math.abs(delta);

      if (now - lastDebugAt.current >= 100) {
        lastDebugAt.current = now;
        setDebug({
          beta: Math.round(beta),
          gamma: Math.round(gamma),
          landscape,
          delta: Math.round(delta * 10) / 10,
          tiltDeg: Math.round(tiltDeg),
          source: unit === "m" ? "motion" : "orient",
          calibrating: false,
          locked: state === "LOCKED",
          state,
        });
      }

      switch (state) {
        case "LOCKED":
          return;
        case "WAIT_NEUTRAL":
          if (abs < rearm) {
            if (!neutralSince) neutralSince = now;
            else if (now - neutralSince >= NEUTRAL_HOLD_MS) {
              state = "NEUTRAL";
              neutralSince = 0;
              neutralAt = now;
            }
          } else neutralSince = 0;
          return;
        case "NEUTRAL": {
          if (abs < trigger) return;
          const kind = delta < 0 ? "down" : "up";
          // block the opposite gesture until neutral + 500ms (bounce-back guard)
          if (lastAction && kind !== lastAction && now - neutralAt < OPPOSITE_BLOCK_MS) return;
          state = "LOCKED";
          neutralSince = 0;
          lastAction = kind;
          if (kind === "down") cbs.current.onDown(); // DOWN = GOT IT!
          else cbs.current.onUp(); // UP = PASS
          unlockTimer = setTimeout(() => {
            state = "WAIT_NEUTRAL";
          }, LOCK_MS);
          return;
        }
      }
    };

    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.y == null || g.z == null) return;
      if (source === "orientation") return;
      source = "motion";
      const gy = g.y;
      const gz = g.z;
      process(gy, (Math.atan2(gy, gz) * 180) / Math.PI, 0, 0, "m");
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (source !== "orientation") return;
      const raw = (landscape ? e.gamma : e.beta) ?? 0;
      process(raw, raw, e.beta ?? 0, e.gamma ?? 0, "d");
    };
    // fall back to orientation if no usable motion data shows up within 1s
    const fallbackTimer = setTimeout(() => {
      if (source === null && Date.now() - startedAt >= 1000) {
        source = "orientation";
        window.addEventListener("deviceorientation", onOrient);
      }
    }, 1000);

    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrient);
      clearTimeout(fallbackTimer);
      if (unlockTimer) clearTimeout(unlockTimer);
    };
  }, [enabled, motionOn, permission, recalibrate]);

  const persistSwap = () => {
    setSwapped(swapRef.current === -1);
    try {
      localStorage.setItem("tiltSwap", swapRef.current === -1 ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  const toggleSwap = useCallback(() => {
    swapRef.current *= -1;
    persistSwap();
  }, []);
  /** Player holds the phone tilted DOWN and taps: make that direction = GOT IT!. */
  const setDownAsCorrect = useCallback(() => {
    const d = lastRawDelta.current;
    if (Math.abs(d) < 0.5) return false;
    swapRef.current = d < 0 ? 1 : -1;
    persistSwap();
    return true;
  }, []);

  return {
    supported: permission !== "unsupported",
    permission,
    motionOn,
    toggleMotion,
    recalibrate,
    debug,
    swapped,
    toggleSwap,
    setDownAsCorrect,
    debugTilt: debug ? debug.delta : null,
  };
}

function isLandscape(): boolean {
  if (typeof window === "undefined") return false;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  if (legacy === 90 || legacy === -90) return true;
  const a = window.screen?.orientation?.angle;
  if (a === 90 || a === 270) return true;
  return window.innerWidth > window.innerHeight;
}

// Dev only: hook shape changes can't be hot-swapped into a mounted game, so reload fully.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}
