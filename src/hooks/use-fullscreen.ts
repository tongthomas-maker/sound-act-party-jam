import { useCallback, useEffect, useState } from "react";

interface FsElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}
interface FsDocument extends Document {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
}

/** Best-effort screen expansion. Silently no-ops where unsupported (iOS Safari). */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement as FsElement;
    setSupported(
      typeof el.requestFullscreen === "function" ||
        typeof el.webkitRequestFullscreen === "function",
    );
    const sync = () => {
      const d = document as FsDocument;
      setIsFullscreen(Boolean(d.fullscreenElement ?? d.webkitFullscreenElement));
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const expand = useCallback(async () => {
    if (typeof document === "undefined") return false;
    const el = document.documentElement as FsElement;
    try {
      if (typeof el.requestFullscreen === "function") await el.requestFullscreen();
      else if (typeof el.webkitRequestFullscreen === "function") await el.webkitRequestFullscreen();
      else return false;
      return true;
    } catch {
      return false;
    }
  }, []);

  return { supported, isFullscreen, expand };
}

/** True when the viewport is wider than it is tall. */
export function useIsLandscape() {
  const [landscape, setLandscape] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);
  return landscape;
}
