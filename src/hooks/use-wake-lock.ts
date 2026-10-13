import { useEffect } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

/** Keeps the screen awake while `active`, where the Screen Wake Lock API exists. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const wl = (
      navigator as Navigator & {
        wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
      }
    ).wakeLock;
    if (!wl) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = () => {
      wl.request("screen")
        .then((s) => {
          if (cancelled) void s.release();
          else sentinel = s;
        })
        .catch(() => {});
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
