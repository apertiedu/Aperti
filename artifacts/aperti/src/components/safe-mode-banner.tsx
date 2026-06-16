import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface SafeModeStatus {
  safe_mode: boolean;
}

export function SafeModeBanner() {
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery<SafeModeStatus>({
    queryKey: ["safe-mode-status"],
    queryFn: () => apiFetch("/api/system/production-metrics").then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!data?.safe_mode || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Platform is running in <strong>Safe Mode</strong> — some AI features are reduced. Core functionality remains available.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 hover:bg-amber-600 rounded transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
