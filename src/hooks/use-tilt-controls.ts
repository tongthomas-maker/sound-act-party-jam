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

/* ---- v15 gesture tuning: orientation angle only ---- */
export const TRIGGER_DEG = 18;
export const REARM_DEG = 8;
export const LOCK_MS = 1200;
export const HOLD_MS = 800;
export const RETURN_MS = 600;
const CALIBRATE_MS = 800;
const CAL_HOLD_MS = 500;

export type TiltPhase = "HOLD" | "READY" | "LOCKED" | "WAIT_FOR_RETURN";
export interface TiltMachine {
  phase: TiltPhase;
  /** HOLD/WAIT: when stillness began (0 = not still); LOCKED: when lock began. */
  since: number | null;
}
export const initialTiltMachine = (): TiltMachine => ({ phase: "HOLD", since: null });

/**
 * Pure tilt state machine. `v` = signed delta from baseline, positive = DOWN.
 * Fires at most once per READY -> LOCKED transition.
 */
export function stepTilt(
  m: TiltMachine,
  v: number,
  now: number,
): { machine: TiltMachine; fire: "correct" | "pass" | null } {
  const near = Math.abs(v) < REARM_DEG;
  switch (m.phase) {
    case "HOLD":
    case "WAIT_FOR_RETURN": {
      const need = m.phase === "HOLD" ? HOLD_MS : RETURN_MS;
      if (!near) return { machine: { phase: m.phase, since: null }, fire: null };
      const since = m.since ?? now;
      if (now - since >= need) return { machine: { phase: "READY", since: null }, fire: null };
      return { machine: { phase: m.phase, since }, fire: null };
    }
    case "READY":
      if (v > TRIGGER_DEG) return { machine: { phase: "LOCKED", since: now }, fire: "correct" };
      if (v < -TRIGGER_DEG) return { machine: { phase: "LOCKED", since: now }, fire: "pass" };
      return { machine: m, fire: null };
    case "LOCKED":
      if (now - (m.since ?? now) >= LOCK_MS)
        return stepTilt({ phase: "WAIT_FOR_RETURN", since: null }, v, now);
      return { machine: m, fire: null };
  }
}
export type TiltDevice = "iPad" | "iPhone" | "other";

export function detectDevice(ua: string): TiltDevice {
  return /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : "other";
}

/** Per-device defaults: sign (+1 => delta>20 = CORRECT) and lock duration. */
export function deviceTiltDefaults(device: TiltDevice): { sign: 1 | -1; lockMs: number } {
  if (device === "iPhone") return { sign: -1, lockMs: LOCK_MS };
  return { sign: 1, lockMs: LOCK_MS };
}

export const swapKey = (device: TiltDevice) => `tiltDir_${device}`;

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
  device?: string;
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
  const dirRef = useRef<1 | -1>(1); // per-device CORRECT direction (tiltDir_<device>)
  const [swapped, setSwapped] = useState(false);
  const [calStep, setCalStep] = useState<"idle" | "armed">("idle");
  const calArmed = useRef(false);
  useEffect(() => {
    deviceRef.current = detectDevice(navigator.userAgent);
    try {
      const def = deviceTiltDefaults(deviceRef.current).sign;
      const saved = localStorage.getItem(swapKey(deviceRef.current));
      dirRef.current = saved === "1" ? 1 : saved === "-1" ? -1 : def;
      setSwapped(dirRef.current !== def);
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

  /* ---- v15 gesture detection: orientation angle only, single axis ---- */
  useEffect(() => {
    recalibrate();
    if (!enabled || !motionOn || permission !== "granted") return;
    const landscape = isLandscape();
    let calStart = 0,
      sum = 0,
      count = 0,
      baseline = 0,
      calibrated = false;
    let beta = 0,
      gamma = 0,
      delta = 0,
      lastRaw: number | null = null,
      lastAt = 0,
      flick = 0;
    let m: TiltMachine = initialTiltMachine();
    let calSince = 0,
      calSign = 0;

    const show = (now: number) => {
      if (now - lastDebugAt.current < 100) return;
      lastDebugAt.current = now;
      setDebug({
        beta: Math.round(beta),
        gamma: Math.round(gamma),
        landscape,
        delta: Math.round(delta),
        tiltDeg: Math.round(flick),
        source: "orient",
        calibrating: !calibrated,
        locked: m.phase === "LOCKED",
        state: calibrated ? m.phase : "CALIBRATING",
        device: deviceRef.current,
      });
    };

    const onOrient = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      beta = e.beta ?? 0;
      gamma = e.gamma ?? 0;
      const raw = landscape ? gamma : beta; // single axis, never switch
      if (lastRaw !== null && now > lastAt) flick = ((raw - lastRaw) * 1000) / (now - lastAt);
      lastRaw = raw;
      lastAt = now;
      if (!calibrated) {
        if (!calStart) calStart = now;
        sum += raw;
        count++;
        baseline = sum / count;
        if (now - calStart >= CALIBRATE_MS) calibrated = true;
        show(now);
        return;
      }
      delta = raw - baseline;
      show(now);
      if (now < lockedUntil.current) return;

      if (calArmed.current) {
        // AUTO CALIBRATE: hold DOWN past trigger for 500ms -> that side = CORRECT
        const s = Math.abs(delta) > TRIGGER_DEG ? Math.sign(delta) : 0;
        if (s && s === calSign) {
          if (now - calSince >= CAL_HOLD_MS) {
            calArmed.current = false;
            setCalStep("idle");
            dirRef.current = s as 1 | -1;
            persistDir();
            m = { phase: "LOCKED", since: now };
          }
        } else {
          calSign = s;
          calSince = now;
        }
        return;
      }

      const r = stepTilt(m, delta * dirRef.current, now);
      m = r.machine;
      if (r.fire === "correct") cbs.current.onDown(); // DOWN = GOT IT!
      else if (r.fire === "pass") cbs.current.onUp(); // UP = PASS
    };

    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [enabled, motionOn, permission, recalibrate]);

  const persistDir = () => {
    const def = deviceTiltDefaults(deviceRef.current).sign;
    setSwapped(dirRef.current !== def);
    try {
      localStorage.setItem(swapKey(deviceRef.current), String(dirRef.current));
    } catch {
      /* ignore */
    }
  };
  const toggleSwap = useCallback(() => {
    dirRef.current = dirRef.current === 1 ? -1 : 1;
    persistDir();
  }, []);
  /** Arm: hold the phone DOWN for 500ms to record that side as CORRECT. */
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
