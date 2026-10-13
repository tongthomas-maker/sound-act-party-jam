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

/* ---- gesture tuning (degrees, single axis) ---- */
const TRIGGER_DEG = 20;
const NEUTRAL_DEG = 10; // must be within this to fire from NEUTRAL
const REARM_DEG = 8; // WAIT_NEUTRAL band
const NEUTRAL_HOLD_MS = 600;
const OPPOSITE_BLOCK_MS = 1500;
const CALIBRATE_MS = 800;
const THROTTLE_MS = 80;

type TiltState = "NEUTRAL" | "LOCKED" | "WAIT_NEUTRAL";
export type TiltDevice = "iPad" | "iPhone" | "other";

export function detectDevice(ua: string): TiltDevice {
  return /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : "other";
}

/** Per-device defaults: sign (+1 => delta>20 = CORRECT) and lock duration. */
export function deviceTiltDefaults(device: TiltDevice): { sign: 1 | -1; lockMs: number } {
  if (device === "iPhone") return { sign: -1, lockMs: 1500 };
  return { sign: 1, lockMs: 1000 };
}

export const swapKey = (device: TiltDevice) => `tiltSwap_${device}`;

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
  const deviceRef = useRef<TiltDevice>("other");
  const swapRef = useRef(1); // per-device user swap on top of device default sign
  const [swapped, setSwapped] = useState(false);
  const [calStep, setCalStep] = useState<"idle" | "down" | "up">("idle");
  const calDown = useRef(0);
  useEffect(() => {
    deviceRef.current = detectDevice(navigator.userAgent);
    try {
      if (localStorage.getItem(swapKey(deviceRef.current)) === "1") {
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

  /* ---- gesture detection: deviceorientation, single axis chosen once ---- */
  const lastRawDelta = useRef(0);
  useEffect(() => {
    recalibrate();
    if (!enabled || !motionOn || permission !== "granted") return;
    const landscape = isLandscape();
    const { sign, lockMs } = deviceTiltDefaults(deviceRef.current);
    let calStart = 0;
    let sum = 0;
    let count = 0;
    let baseline = 0;
    let calibrated = false;
    let state: TiltState = "NEUTRAL";
    let lastEventAt = 0;
    let neutralSince = 0;
    let lastAction: "down" | "up" | null = null;
    let lastActionAt = 0;
    let prevAbs = 0;
    let unlockTimer: ReturnType<typeof setTimeout> | undefined;

    const onOrient = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastEventAt < THROTTLE_MS) return;
      lastEventAt = now;
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      const raw = landscape ? gamma : beta; // never switch axes
      if (!calibrated) {
        if (!calStart) calStart = now;
        sum += raw;
        count++;
        baseline = sum / count;
        if (now - calStart < CALIBRATE_MS) return;
        calibrated = true;
      }
      if (now < lockedUntil.current) return; // rotation guard
      const rawDelta = raw - baseline;
      lastRawDelta.current = rawDelta;
      const delta = rawDelta * sign * swapRef.current; // positive = DOWN = CORRECT
      const abs = Math.abs(delta);
      const wasNeutral = prevAbs < NEUTRAL_DEG;
      prevAbs = abs;

      if (now - lastDebugAt.current >= 100) {
        lastDebugAt.current = now;
        setDebug({
          beta: Math.round(beta),
          gamma: Math.round(gamma),
          landscape,
          delta: Math.round(delta * 10) / 10,
          tiltDeg: Math.round(raw),
          source: "orient",
          calibrating: false,
          locked: state === "LOCKED",
          state: `${state} ${deviceRef.current}`,
        });
      }

      if (state === "LOCKED") return;
      if (state === "WAIT_NEUTRAL") {
        // never fires here — only re-arms
        if (abs < REARM_DEG) {
          if (!neutralSince) neutralSince = now;
          else if (now - neutralSince >= NEUTRAL_HOLD_MS) {
            state = "NEUTRAL";
            neutralSince = 0;
          }
        } else neutralSince = 0;
        return;
      }
      // NEUTRAL: fire only on a crossing from the neutral band past the trigger
      if (!wasNeutral || abs < TRIGGER_DEG) return;
      const kind = delta > 0 ? "down" : "up";
      if (lastAction && kind !== lastAction && now - lastActionAt < OPPOSITE_BLOCK_MS) return;
      state = "LOCKED";
      lastAction = kind;
      lastActionAt = now;
      if (kind === "down") cbs.current.onDown(); // DOWN = GOT IT!
      else cbs.current.onUp(); // UP = PASS
      unlockTimer = setTimeout(() => {
        state = "WAIT_NEUTRAL";
        neutralSince = 0;
      }, lockMs);
    };

    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      if (unlockTimer) clearTimeout(unlockTimer);
    };
  }, [enabled, motionOn, permission, recalibrate]);

  const persistSwap = () => {
    setSwapped(swapRef.current === -1);
    try {
      localStorage.setItem(swapKey(deviceRef.current), swapRef.current === -1 ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  const toggleSwap = useCallback(() => {
    swapRef.current *= -1;
    persistSwap();
  }, []);
  /** Two taps: hold DOWN + tap, then hold UP + tap. Sets this device's swap. */
  const autoCalibrate = useCallback(() => {
    const d = lastRawDelta.current;
    if (calStep !== "down") {
      calDown.current = d;
      setCalStep("down");
      return "need-up" as const;
    }
    setCalStep("idle");
    const diff = calDown.current - d; // down minus up
    if (Math.abs(diff) < 5) return "failed" as const;
    const { sign } = deviceTiltDefaults(deviceRef.current);
    // want (down raw) * sign * swap > 0
    swapRef.current = Math.sign(diff) * sign > 0 ? 1 : -1;
    persistSwap();
    return "done" as const;
  }, [calStep]);

  return {
    supported: permission !== "unsupported",
    permission,
    motionOn,
    toggleMotion,
    recalibrate,
    debug,
    swapped,
    toggleSwap,
    autoCalibrate,
    calStep,
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
