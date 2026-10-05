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
const CALIBRATE_MS = 450; // settle time before the neutral zone is trusted
const TRIGGER_DEG = 34; // deliberate tilt away from neutral
const REARM_DEG = 14; // must come back this close to neutral
const CONFIRM_SAMPLES = 3; // consecutive samples agreeing on direction
const SAMPLE_MIN_DEG = 12; // per-sample minimum offset to count toward a gesture
const MIN_RATE = 26; // deg/sec — gesture must be travelling, not drifting
const LOCK_MS = 650; // input lock after a trigger
const NEUTRAL_DRIFT = 0.012; // slow neutral follow while resting

interface OrientationCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}
interface MotionCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}

function orientationCtor(): OrientationCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { DeviceOrientationEvent?: OrientationCtor })
    .DeviceOrientationEvent;
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
function tiltForOrientation(beta: number, gamma: number, angle: number): number {
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

  const cbs = useRef({ onUp, onDown });
  cbs.current = { onUp, onDown };

  // gesture state
  const neutral = useRef<number | null>(null);
  const calibratedAt = useRef(0);
  const armed = useRef(true);
  const lockedUntil = useRef(0);
  const streakDir = useRef(0);
  const streakCount = useRef(0);
  const lastTilt = useRef<number | null>(null);
  const lastTime = useRef(0);
  const accelDir = useRef(0); // -1 / 0 / 1 from devicemotion
  const accelAt = useRef(0);
  const angleRef = useRef(0);

  const recalibrate = useCallback(() => {
    neutral.current = null;
    calibratedAt.current = 0;
    armed.current = true;
    lockedUntil.current = 0;
    streakDir.current = 0;
    streakCount.current = 0;
    lastTilt.current = null;
    accelDir.current = 0;
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

  /* ---- screen orientation changes invalidate calibration ---- */
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

  /* ---- devicemotion: confirms deliberate movement direction ---- */
  useEffect(() => {
    if (!enabled || !motionOn || permission !== "granted") return;
    if (!motionCtor()) return;
    const handler = (e: DeviceMotionEvent) => {
      const rate = e.rotationRate;
      if (!rate) return;
      const angle = angleRef.current;
      const raw =
        angle === 90
          ? -(rate.gamma ?? 0)
          : angle === -90 || angle === 270
            ? (rate.gamma ?? 0)
            : angle === 180
              ? -(rate.beta ?? 0)
              : (rate.beta ?? 0);
      if (Math.abs(raw) < 25) return;
      accelDir.current = raw > 0 ? 1 : -1;
      accelAt.current = Date.now();
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [enabled, motionOn, permission]);

  /* ---- orientation: primary gesture detection ---- */
  useEffect(() => {
    if (!enabled || !motionOn || permission !== "granted") {
      recalibrate();
      return;
    }
    recalibrate();
    angleRef.current = screenAngle();

    const handler = (e: DeviceOrientationEvent) => {
      const beta = e.beta;
      const gamma = e.gamma;
      if (beta === null || beta === undefined || gamma === null || gamma === undefined)
        return;

      const now = Date.now();
      const tilt = tiltForOrientation(beta, gamma, angleRef.current);

      if (neutral.current === null) {
        neutral.current = tilt;
        calibratedAt.current = now;
        lastTilt.current = tilt;
        lastTime.current = now;
        return;
      }

      const delta = tilt - neutral.current;
      const dt = Math.max((now - lastTime.current) / 1000, 0.001);
      const rate = ((lastTilt.current ?? tilt) - tilt) / dt; // deg/sec magnitude source
      const velocity = (tilt - (lastTilt.current ?? tilt)) / dt;
      void rate;
      lastTilt.current = tilt;
      lastTime.current = now;

      // still settling into the resting position
      if (now - calibratedAt.current < CALIBRATE_MS) {
        neutral.current = neutral.current * 0.7 + tilt * 0.3;
        return;
      }

      // re-arming: wait until back near neutral
      if (!armed.current) {
        streakDir.current = 0;
        streakCount.current = 0;
        if (Math.abs(delta) < REARM_DEG && now > lockedUntil.current) {
          armed.current = true;
          neutral.current = neutral.current * 0.8 + tilt * 0.2;
        }
        return;
      }

      if (now < lockedUntil.current) return;

      // resting: let neutral follow slow grip drift
      if (Math.abs(delta) < SAMPLE_MIN_DEG) {
        neutral.current += (tilt - neutral.current) * NEUTRAL_DRIFT;
        streakDir.current = 0;
        streakCount.current = 0;
        return;
      }

      const dir = delta > 0 ? 1 : -1;
      const moving = Math.abs(velocity) > MIN_RATE || Math.abs(delta) > TRIGGER_DEG;
      if (!moving) return;

      if (streakDir.current === dir) streakCount.current += 1;
      else {
        streakDir.current = dir;
        streakCount.current = 1;
      }

      if (streakCount.current < CONFIRM_SAMPLES) return;
      if (Math.abs(delta) < TRIGGER_DEG) return;

      // if devicemotion is available and recent, it must agree on direction
      const accelFresh = now - accelAt.current < 500;
      if (accelFresh && accelDir.current !== 0 && accelDir.current !== dir) return;

      armed.current = false;
      lockedUntil.current = now + LOCK_MS;
      streakDir.current = 0;
      streakCount.current = 0;
      accelDir.current = 0;

      if (dir > 0) cbs.current.onUp();
      else cbs.current.onDown();
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
  };
}
