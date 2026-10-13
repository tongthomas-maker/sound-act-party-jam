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
const TRIGGER_DEG = 30; // |delta| past this fires (hysteresis high)
const REARM_DEG = 12; // must return within this to re-arm (hysteresis low)
const REARM_HOLD_MS = 300; // ...and stay there this long
const DEADZONE_DEG = 20; // last armed sample must be inside this for a fire to count
const LOCK_MS = 1200; // ignore all orientation after a trigger
const CALIBRATE_MS = 800; // average this long to find the neutral baseline
const THROTTLE_MS = 100; // process at most one orientation sample per 100ms

type TiltState = "NEUTRAL" | "TRIGGERED" | "LOCKED" | "WAIT_NEUTRAL";

interface TiltDebug {
  beta: number;
  gamma: number;
  landscape: boolean;
  delta: number;
  calibrating: boolean;
  locked: boolean;
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
      if (typeof O.requestPermission === "function") {
        const res = await O.requestPermission();
        if (res !== "granted") {
          setPermission("denied");
          return false;
        }
      }
      const M = motionCtor();
      if (M && typeof M.requestPermission === "function") {
        try {
          await M.requestPermission();
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
    angleRef.current = screenAngle();
    const startedAt = Date.now();
    let baseline: number | null = null;
    let samples: number[] = [];
    let wasLandscape = isLandscape();
    let state: TiltState = "WAIT_NEUTRAL"; // must settle after calibration before arming
    let neutralSince = 0;
    let lastSampleAt = 0;
    let lastAbs = 0;

    const handler = (e: DeviceOrientationEvent) => {
      const beta = e.beta;
      const gamma = e.gamma;
      if (beta == null || gamma == null) return;
      const now = Date.now();
      // throttle processing to one sample per THROTTLE_MS
      if (now - lastSampleAt < THROTTLE_MS) return;
      lastSampleAt = now;

      const landscape = isLandscape();
      if (landscape !== wasLandscape) {
        wasLandscape = landscape;
        baseline = null;
        samples = [];
        state = "WAIT_NEUTRAL";
        neutralSince = 0;
      }
      const raw = landscape ? gamma : beta;
      if (baseline === null) {
        samples.push(raw);
        if (now - startedAt >= CALIBRATE_MS || samples.length >= 8) {
          baseline = samples.reduce((a, b) => a + b, 0) / samples.length;
        }
      }
      const delta = baseline === null ? 0 : raw - baseline;
      const abs = Math.abs(delta);

      // LOCKED → WAIT_NEUTRAL once lock elapses
      if (state === "LOCKED" && now >= lockedUntil.current) {
        state = "WAIT_NEUTRAL";
        neutralSince = 0;
      }
      if (state === "WAIT_NEUTRAL" && baseline !== null) {
        if (abs < REARM_DEG) {
          if (!neutralSince) neutralSince = now;
          if (now - neutralSince >= REARM_HOLD_MS) state = "NEUTRAL";
        } else neutralSince = 0;
      }

      setDebug({
        beta: Math.round(beta),
        gamma: Math.round(gamma),
        landscape,
        delta: Math.round(delta),
        calibrating: baseline === null,
        locked: state === "LOCKED",
        state,
      });

      // fire only from NEUTRAL, crossing the trigger from a near-neutral position
      if (state === "NEUTRAL" && abs >= TRIGGER_DEG && lastAbs < DEADZONE_DEG) {
        state = "TRIGGERED";
        if (delta < 0) cbs.current.onDown(); // down = GOT IT!
        else cbs.current.onUp(); // up = PASS
        lockedUntil.current = now + LOCK_MS;
        state = "LOCKED";
      } else if (state === "NEUTRAL" && abs >= TRIGGER_DEG) {
        // drifted over slowly without a clean gesture: require re-centre
        state = "WAIT_NEUTRAL";
        neutralSince = 0;
      }
      if (state === "NEUTRAL") lastAbs = abs;
    };

    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, [enabled, motionOn, permission, recalibrate]);

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
