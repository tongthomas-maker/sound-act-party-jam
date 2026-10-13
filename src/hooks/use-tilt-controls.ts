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
const TRIGGER_DEG = 24; // |delta| past this fires
const DEADZONE_DEG = 14; // must be inside this to be NEUTRAL/armed
const REARM_DEG = 12; // WAIT_NEUTRAL: |delta| under this…
const REARM_DWELL_MS = 250; // …held this long re-arms
const LOCK_MS = 1000; // ignore all orientation after a trigger
const CALIBRATE_MS = 800; // average this long to find the neutral baseline
const THROTTLE_MS = 80; // min time between processed orientation events

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

  /* ---- orientation: single-axis gesture detection ---- */
  useEffect(() => {
    if (!enabled || !motionOn || permission !== "granted") {
      recalibrate();
      return;
    }
    recalibrate();
    // Pick ONE axis at start and never switch: gamma in landscape, beta in portrait.
    const landscape = isLandscape();
    const startedAt = Date.now();
    let sum = 0;
    let count = 0;
    let baseline = 0;
    let calibrated = false;
    let state: TiltState = "NEUTRAL";
    let lastEventAt = 0;
    let neutralSince = 0;
    let unlockTimer: ReturnType<typeof setTimeout> | undefined;

    const handler = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastEventAt < THROTTLE_MS) return; // throttle to ~12.5Hz
      lastEventAt = now;
      const raw = (landscape ? e.gamma : e.beta) ?? 0;
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;

      if (!calibrated) {
        sum += raw;
        count++;
        baseline = sum / count;
        if (now - startedAt < CALIBRATE_MS) return;
        calibrated = true;
      }
      if (now < lockedUntil.current && state !== "LOCKED") return; // rotation guard

      const delta = (raw - baseline) * swapRef.current;
      const abs = Math.abs(delta);

      if (now - lastDebugAt.current >= 100) {
        lastDebugAt.current = now;
        setDebug({
          beta: Math.round(beta),
          gamma: Math.round(gamma),
          landscape,
          delta: Math.round(delta),
          calibrating: false,
          locked: state === "LOCKED",
          state,
        });
      }

      switch (state) {
        case "LOCKED":
          return; // hard lock: ignore everything
        case "WAIT_NEUTRAL":
          if (abs < REARM_DEG) {
            if (!neutralSince) neutralSince = now;
            else if (now - neutralSince >= REARM_DWELL_MS) {
              state = "NEUTRAL";
              neutralSince = 0;
            }
          } else {
            neutralSince = 0;
          }
          return;
        case "NEUTRAL":
          if (abs < DEADZONE_DEG) return; // still neutral, stay armed
          if (abs < TRIGGER_DEG) return; // between deadzone and trigger: wait
          // fire exactly once, then lock
          state = "LOCKED";
          neutralSince = 0;
          if (delta < 0) cbs.current.onDown(); // DOWN = GOT IT!
          else cbs.current.onUp(); // UP = PASS
          unlockTimer = setTimeout(() => {
            state = "WAIT_NEUTRAL";
          }, LOCK_MS);
          return;
      }
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
    swapped,
    toggleSwap,
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
