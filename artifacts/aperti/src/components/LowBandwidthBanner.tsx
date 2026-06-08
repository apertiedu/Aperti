import { useState } from "react";
import { Wifi, WifiOff, Zap, X } from "lucide-react";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";

export default function LowBandwidthBanner() {
  const { quality, liteMode, setLiteMode, isSlowConnection } = useNetworkQuality();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (!isSlowConnection && !liteMode)) return null;

  const isOffline = quality === "offline";

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl shadow-lg border px-4 py-3 flex items-start gap-3 text-sm
        ${isOffline ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {isOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
      </div>
      <div className="flex-1">
        {isOffline ? (
          <>
            <p className="font-semibold">You're offline</p>
            <p className="text-xs mt-0.5 opacity-80">Some features may not be available until you reconnect.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">Slow connection detected</p>
            <p className="text-xs mt-0.5 opacity-80">
              {liteMode ? "Lite mode is on — animations disabled." : "Enable lite mode to improve performance."}
            </p>
            <button
              onClick={() => setLiteMode(!liteMode)}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline"
            >
              <Zap className="w-3 h-3" />
              {liteMode ? "Disable lite mode" : "Enable lite mode"}
            </button>
          </>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
