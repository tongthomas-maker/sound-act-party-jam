import { useCallback, useEffect, useRef, useState } from "react";

type Permission = "unsupported" | "needs-permission" | "granted" | "denied";

interface Options {
  /** Only listen while true (active gameplay). */
  enabled: boolean;
  onUp: () => void;
  onDown: () => void;
}

const TRIGGER = 42; // degrees away from neutral for a deliberate gesture
const REARM = 18; // must come back this close to neutral before firing again
const LOCK_MS = 700; // debounce after a trigger

interface OrientationCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}

function ctor(): OrientationCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { DeviceOrientationEvent?: OrientationCtor })
    .DeviceOrientationEvent;
}

export function useTiltControls({ enabled, onUp, onDown }: Options) {
  const [permission, setPermission] = useState<Permission>("unsupported");
  const [motionOn, setMotionOn] = useState(false);

  const neutral = useRef<number | null>(null);
  const armed = useRef(true);
  const lockedUntil = useRef(0);
  const cbs = useRef({ onUp, onDown });
  cbs.current = { onUp, onDown };

  useEffect(() => {
    const C = ctor();
    if (!C) return setPermission("unsupported");
    if (typeof C.requestPermission === "function") setPermission("needs-permission");
    else setPermission("granted");
  }, []);

  const requestPermission = useCallback(async () => {
    const C = ctor();
    if (!C) return false;
    if (typeof C.requestPermission === "function") {
      try {
        const res = await C.requestPermission();
        setPermission(res === "granted" ? "granted" : "denied");
        if (res !== "granted") return false;
      } catch {
        setPermission("denied");
        return false;
      }
    }
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

  /** Recalibrate the resting orientation (call when a round starts). */
  const recalibrate = useCallback(() => {
    neutral.current = null;
    armed.current = true;
    lockedUntil.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled || !motionOn || permission !== "granted") return;
    recalibrate();

    const handler = (e: DeviceOrientationEvent) => {
      const beta = e.beta;
      if (beta === null || beta === undefined) return;
      if (neutral.current === null) {
        neutral.current = beta;
        return;
      }
      const delta = beta - neutral.current;
      const now = Date.now();

      if (!armed.current) {
        if (Math.abs(delta) < REARM && now > lockedUntil.current) armed.current = true;
        return;
      }
      if (now < lockedUntil.current) return;
      if (Math.abs(delta) < TRIGGER) return;

      armed.current = false;
      lockedUntil.current = now + LOCK_MS;
      if (delta > 0) cbs.current.onUp();
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
