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

/* ---- gesture tuning: flick velocity, single axis ---- */
const FLICK_DPS = 120; // rotationRate spike that fires
const LOW_DPS = 20; // "still" velocity
const NEUTRAL_DEG = 10; // angle from baseline required for NEUTRAL
const FALLBACK_DPS = 80; // orientation-derived speed fallback
const FALLBACK_DEG = 15;
const STILL_HOLD_MS = 800;
const CALIBRATE_MS = 800;

type TiltState = "ARMING" | "NEUTRAL" | "LOCKED" | "WAIT";
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
  const [calStep, setCalStep] = useState<"idle" | "armed">("idle");
  const calArmed = useRef(false);
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

  /* ---- gesture detection: devicemotion rotationRate flick (fallback: orientation speed) ---- */
  useEffect(() => {
    recalibrate();
    if (!enabled || !motionOn || permission !== "granted") return;
    const landscape = isLandscape();
    const { sign, lockMs } = deviceTiltDefaults(deviceRef.current);
    let calStart = 0,
      sum = 0,
      count = 0,
      baseline = 0,
      calibrated = false;
    let angleDelta = 0,
      lastAngle: number | null = null,
      lastAngleAt = 0;
    let beta = 0,
      gamma = 0;
    let hasRate = false;
    let state: TiltState = "ARMING";
    let stillSince = 0;
    let unlockTimer: ReturnType<typeof setTimeout> | undefined;

    const show = (vel: number) => {
      const now = Date.now();
      if (now - lastDebugAt.current < 100) return;
      lastDebugAt.current = now;
      setDebug({
        beta: Math.round(beta),
        gamma: Math.round(gamma),
        landscape,
        delta: Math.round(angleDelta),
        tiltDeg: Math.round(vel),
        source: hasRate ? "motion" : "orient",
        calibrating: !calibrated,
        locked: state === "LOCKED",
        state: `${state} ${deviceRef.current}`,
      });
    };

    const handle = (vel: number, fallback: boolean) => {
      const now = Date.now();
      if (!calibrated || now < lockedUntil.current) return;
      show(vel);
      const absV = Math.abs(vel);
      if (state === "LOCKED") return;
      if (state === "WAIT" || state === "ARMING") {
        // never fires here — waits for sustained stillness near center
        const still = absV < LOW_DPS && Math.abs(angleDelta) < NEUTRAL_DEG;
        if (still) {
          if (!stillSince) stillSince = now;
          else if (now - stillSince >= STILL_HOLD_MS) {
            state = "NEUTRAL";
            stillSince = 0;
          }
        } else stillSince = 0;
        return;
      }
      // NEUTRAL: fire only on a velocity spike
      const spike = fallback
        ? absV > FALLBACK_DPS && Math.abs(angleDelta) > FALLBACK_DEG
        : absV > FLICK_DPS;
      if (!spike) return;
      if (calArmed.current) {
        // record this flick as CORRECT for this device
        calArmed.current = false;
        setCalStep("idle");
        swapRef.current = Math.sign(vel) * sign > 0 ? 1 : -1;
        persistSwap();
        state = "WAIT";
        return;
      }
      const v = vel * sign * swapRef.current; // positive = DOWN = CORRECT
      state = "LOCKED";
      if (v > 0)
        cbs.current.onDown(); // DOWN = GOT IT!
      else cbs.current.onUp(); // UP = PASS
      unlockTimer = setTimeout(() => {
        state = "WAIT";
        stillSince = 0;
      }, lockMs);
    };

    const onOrient = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      beta = e.beta ?? 0;
      gamma = e.gamma ?? 0;
      const raw = landscape ? gamma : beta; // single axis, never switch
      if (!calibrated) {
        if (!calStart) calStart = now;
        sum += raw;
        count++;
        baseline = sum / count;
        if (now - calStart >= CALIBRATE_MS) calibrated = true;
        lastAngle = raw;
        lastAngleAt = now;
        return;
      }
      angleDelta = raw - baseline;
      if (!hasRate && lastAngle !== null && now > lastAngleAt) {
        const speed = ((raw - lastAngle) * 1000) / (now - lastAngleAt);
        handle(speed, true);
      }
      lastAngle = raw;
      lastAngleAt = now;
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const r = e.rotationRate;
      const vel = r ? (landscape ? r.gamma : r.beta) : null;
      if (vel == null) return;
      hasRate = true;
      handle(vel, false);
    };

    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("devicemotion", onMotion);
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
  /** Arm: the next flick is recorded as CORRECT for this device. */
  const autoCalibrate = useCallback(() => {
    calArmed.current = !calArmed.current;
    setCalStep(calArmed.current ? "armed" : "idle");
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
