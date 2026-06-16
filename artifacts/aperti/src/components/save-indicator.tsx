import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, AlertCircle, Clock } from "lucide-react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveIndicatorProps {
  status: SaveStatus;
  className?: string;
  showIdle?: boolean;
}

const CONFIG: Record<SaveStatus, { label: string; color: string; icon: any }> = {
  idle:   { label: "Unsaved changes", color: "text-amber-500",  icon: Clock },
  saving: { label: "Saving…",         color: "text-muted-foreground",   icon: Loader2 },
  saved:  { label: "Saved",           color: "text-primary",            icon: CheckCircle2 },
  error:  { label: "Save failed",     color: "text-red-500",    icon: AlertCircle },
};

export function SaveIndicator({ status, className = "", showIdle = false }: SaveIndicatorProps) {
  if (status === "idle" && !showIdle) return null;

  const { label, color, icon: Icon } = CONFIG[status];

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${color} ${className}`}
      >
        <Icon className={`h-3.5 w-3.5 ${status === "saving" ? "animate-spin" : ""}`} />
        {label}
      </motion.span>
    </AnimatePresence>
  );
}
