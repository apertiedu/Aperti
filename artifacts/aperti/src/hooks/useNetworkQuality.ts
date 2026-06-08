import { useState, useEffect } from "react";

type NetworkQuality = "fast" | "slow" | "offline";

interface NetworkInfo {
  quality: NetworkQuality;
  effectiveType: string | null;
  isSlowConnection: boolean;
  liteMode: boolean;
  setLiteMode: (v: boolean) => void;
}

const SLOW_TYPES = new Set(["slow-2g", "2g"]);

export function useNetworkQuality(): NetworkInfo {
  const getNav = () => (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection;

  const detect = (): NetworkQuality => {
    if (!navigator.onLine) return "offline";
    const conn = getNav();
    if (!conn) return "fast";
    if (SLOW_TYPES.has(conn.effectiveType)) return "slow";
    if (conn.saveData) return "slow";
    return "fast";
  };

  const [quality, setQuality] = useState<NetworkQuality>(detect);
  const [liteMode, setLiteModeState] = useState<boolean>(() => {
    try { return localStorage.getItem("aperti_lite_mode") === "true"; } catch { return false; }
  });

  useEffect(() => {
    const conn = getNav();
    const update = () => setQuality(detect());

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    conn?.addEventListener("change", update);

    // Auto-enable lite mode on very slow connections
    if (quality === "slow") setLiteModeState(true);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      conn?.removeEventListener("change", update);
    };
  }, [quality]);

  // Apply/remove a CSS class on <html> so animations can be suppressed globally
  useEffect(() => {
    const html = document.documentElement;
    if (liteMode) {
      html.classList.add("lite-mode");
    } else {
      html.classList.remove("lite-mode");
    }
  }, [liteMode]);

  const setLiteMode = (v: boolean) => {
    setLiteModeState(v);
    try { localStorage.setItem("aperti_lite_mode", String(v)); } catch {}
  };

  return {
    quality,
    effectiveType: (getNav()?.effectiveType as string) ?? null,
    isSlowConnection: quality === "slow" || quality === "offline",
    liteMode,
    setLiteMode,
  };
}
