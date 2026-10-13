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

/* ---- gesture tuning (fixed thresholds) ---- */
const TRIGGER_DEG = 22; // |delta| past this fires
const REARM_DEG = 12; // return within this to re-arm (instant, no dwell)
const LOCK_MS = 700; // ignore all orientation after a trigger
const CALIBRATE_MS = 800; // average this long to find the neutral baseline

type TiltState = "NEUTRAL" | "TRIGGERED" | "LOCKED" | "WAIT_NEUTRAL";

interface TiltDebug {
  beta: number;
  gamma: number;
  landscape: boolean;
  delta: number;
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

function screenAngle(): number {
  if (typeof window === "undefined") return 0;
  const a = window.screen?.orientation?.angle;
  if (typeof a === "number") return a;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
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
  const angleRef = useRef(0);
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

  /* ---- screen orientation changes invalidate arming ---- */
  useEffect(() => {
    if (!motionOn) return;
    angleRef.current = screenAngle();
    const onChange = () => {
      angleRef.current = screenAngle();
      recalibrate();
      lockedUntil.current = Date.now() + 600; // never let the rotation itself fire
    };
    window.addEventListener("orientationchange", onChange);
    window.screen?.orientation?.addEventListener?.("change", onChange);
    return () => {
      window.removeEventListener("orientationchange", onChange);
      window.screen?.orientation?.removeEventListener?.("change", onChange);
    };
  }, [motionOn, recalibrate]);

  /* ---- orientation: primary gesture detection ---- */
  useEffect(() => {
    if (!enabled || !motionOn || permission !== "granted") {
      recalibrate();
      return;
    }
    recalibrate();
    const startedAt = Date.now();
    let bSum = 0;
    let gSum = 0;
    let count = 0;
    let baseB = 0;
    let baseG = 0;
    let calibrated = false;
    let state: TiltState = "NEUTRAL";
    let unlockTimer: ReturnType<typeof setTimeout> | undefined;

    const handler = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      const now = Date.now();
      if (!calibrated) {
        bSum += beta;
        gSum += gamma;
        count++;
        baseB = bSum / count;
        baseG = gSum / count;
        if (now - startedAt < CALIBRATE_MS) return;
        calibrated = true;
      }
      if (now < lockedUntil.current && state !== "LOCKED") return; // rotation guard
      const dB = beta - baseB;
      const dG = gamma - baseG;
      const useG = Math.abs(dG) > Math.abs(dB);
      const delta = (useG ? dG : dB) * swapRef.current;
      const abs = Math.abs(delta);

      if (now - lastDebugAt.current >= 100) {
        lastDebugAt.current = now;
        setDebug({
          beta: Math.round(beta),
          gamma: Math.round(gamma),
          landscape: useG,
          delta: Math.round(delta),
          calibrating: false,
          locked: state === "LOCKED",
          state,
        });
      }

      if (state === "LOCKED") return;
      if (state === "WAIT_NEUTRAL") {
        if (abs < REARM_DEG) state = "NEUTRAL"; // instant re-arm
        return;
      }
      if (abs < TRIGGER_DEG) return;
      state = "LOCKED";
      if (delta < 0) cbs.current.onDown(); // DOWN = GOT IT!
      else cbs.current.onUp(); // UP = PASS
      unlockTimer = setTimeout(() => {
        state = "WAIT_NEUTRAL";
      }, LOCK_MS);
    };

    window.addEventListener("deviceorientation", handler);
    return () => {
      window.removeEventListener("deviceorientation", handler);
      if (unlockTimer) clearTimeout(unlockTimer);
    };
  }, [enabled, motionOn, permission, recalibrate]);

  const toggleSwap = useCallback(() => {
    swapRef.current *= -1;
    setSwapped(swapRef.current === -1);
    try {
      localStorage.setItem("tiltSwap", swapRef.current === -1 ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return {
    supported: permission !== "unsupported",
    permission,
    motionOn,
    toggleMotion,
    recalibrate,
    debug,
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
