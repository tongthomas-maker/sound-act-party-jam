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
const TRIGGER_DEG = 35; // portrait: |beta delta| beyond this fires
const LANDSCAPE_TRIGGER_DEG = 30; // landscape: |gamma delta| beyond this fires
const DEADZONE_DEG = 10; // within ±10 of baseline is neutral; must return to re-arm
const LOCK_MS = 1200; // ignore all orientation events after a trigger
const CALIBRATE_MS = 1000; // average this long to find the neutral baseline

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

    const handler = (e: DeviceOrientationEvent) => {
      const beta = e.beta;
      const gamma = e.gamma;
      if (beta == null || gamma == null) return;
      const now = Date.now();
      const landscape = isLandscape();
      if (landscape !== wasLandscape) {
        wasLandscape = landscape;
        baseline = null;
        samples = [];
        lockedUntil.current = now + 600;
      }
      const raw = landscape ? gamma : beta;
      const calibrating = baseline === null;
      if (calibrating) {
        samples.push(raw);
        if (now - startedAt >= CALIBRATE_MS || samples.length > 60) {
          baseline = samples.reduce((a, b) => a + b, 0) / samples.length;
        }
      }
      const delta = baseline === null ? 0 : raw - baseline;
      const locked = now < lockedUntil.current;

      if (now - lastDebugAt.current > 100) {
        lastDebugAt.current = now;
        setDebug({
          beta: Math.round(beta),
          gamma: Math.round(gamma),
          landscape,
          delta: Math.round(delta),
          calibrating: baseline === null,
          locked,
        });
      }

      if (baseline === null || locked) return;
      const trigger = landscape ? LANDSCAPE_TRIGGER_DEG : TRIGGER_DEG;
      if (!armed.current) {
        if (Math.abs(delta) < DEADZONE_DEG) armed.current = true;
        return;
      }
      // negative = down (GOT IT!), positive = up (PASS)
      if (delta <= -trigger) {
        armed.current = false;
        lockedUntil.current = now + LOCK_MS;
        cbs.current.onDown();
      } else if (delta >= trigger) {
        armed.current = false;
        lockedUntil.current = now + LOCK_MS;
        cbs.current.onUp();
      }
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
