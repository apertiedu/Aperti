import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Cloud, CloudOff, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

interface AutoSaveIndicatorProps {
  state: SaveState;
  lastSaved?: Date | null;
  className?: string;
  compact?: boolean;
}

export function AutoSaveIndicator({ state, lastSaved, className, compact = false }: AutoSaveIndicatorProps) {
  const formatTime = (d: Date) => d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });

  return (
    <AnimatePresence mode="wait">
      {state === "saving" && (
        <motion.div key="saving"
          initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
          className={cn("inline-flex items-center gap-1.5 text-xs text-gray-400", className)}>
          <RefreshCw className="w-3 h-3 animate-spin" />
          {!compact && "Saving…"}
        </motion.div>
      )}
      {state === "saved" && (
        <motion.div key="saved"
          initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
          className={cn("inline-flex items-center gap-1.5 text-xs text-green-600", className)}>
          <Check className="w-3 h-3" />
          {!compact && (lastSaved ? `Saved at ${formatTime(lastSaved)}` : "Saved")}
        </motion.div>
      )}
      {state === "error" && (
        <motion.div key="error"
          initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
          className={cn("inline-flex items-center gap-1.5 text-xs text-red-500", className)}>
          <CloudOff className="w-3 h-3" />
          {!compact && "Save failed"}
        </motion.div>
      )}
      {state === "idle" && lastSaved && (
        <motion.div key="idle"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className={cn("inline-flex items-center gap-1.5 text-xs text-gray-300", className)}>
          <Cloud className="w-3 h-3" />
          {!compact && `Last saved ${formatTime(lastSaved)}`}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useAutoSave<T>(
  value: T,
  saveFn: (v: T) => Promise<void>,
  debounceMs = 1200,
) {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }

    setState("saving");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await saveFn(value);
        setState("saved");
        setLastSaved(new Date());
        setTimeout(() => setState("idle"), 3000);
      } catch {
        setState("error");
      }
    }, debounceMs);

    return () => clearTimeout(timerRef.current);
  }, [value]);

  return { state, lastSaved };
}

interface SyncStatusProps {
  isSyncing?: boolean;
  isOnline?: boolean;
  lastSync?: Date | null;
  className?: string;
}

export function SyncStatus({ isSyncing, isOnline = true, lastSync, className }: SyncStatusProps) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      {!isOnline ? (
        <span className="flex items-center gap-1 text-amber-600">
          <WifiOff className="w-3 h-3" /> Offline
        </span>
      ) : isSyncing ? (
        <span className="flex items-center gap-1 text-blue-500">
          <RefreshCw className="w-3 h-3 animate-spin" /> Syncing…
        </span>
      ) : (
        <span className="flex items-center gap-1 text-gray-400">
          <Wifi className="w-3 h-3" />
          {lastSync ? `Synced ${lastSync.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}` : "Connected"}
        </span>
      )}
    </div>
  );
}

interface LastUpdatedProps {
  date?: Date | string | null;
  label?: string;
  className?: string;
}

export function LastUpdated({ date, label = "Updated", className }: LastUpdatedProps) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);

  let text: string;
  if (mins < 1)  text = "just now";
  else if (mins < 60) text = `${mins}m ago`;
  else if (hrs < 24)  text = `${hrs}h ago`;
  else text = d.toLocaleDateString("en", { month: "short", day: "numeric" });

  return (
    <span className={cn("text-xs text-gray-400", className)}>
      {label} {text}
    </span>
  );
}

export function SecurePaymentBadge({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 text-xs text-gray-500", className)}>
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-primary fill-current flex-shrink-0">
        <path d="M8 1L2 4v4c0 3.31 2.5 6.41 6 7 3.5-.59 6-3.69 6-7V4L8 1zm-1 9.59L4.41 8 5.83 6.58 7 7.75l3.17-3.17 1.42 1.42L7 10.59z"/>
      </svg>
      256-bit SSL · Payments secured
    </div>
  );
}
