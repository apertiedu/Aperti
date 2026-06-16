import { motion } from "framer-motion";
import { RefreshCw, AlertCircle } from "lucide-react";

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function InlineError({
  message = "We hit a small snag. Please try again.",
  onRetry,
  className = "",
  compact = false,
}: InlineErrorProps) {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
        <span className="flex-1 text-xs">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 flex items-center gap-1 text-xs text-primary font-medium hover:opacity-80 transition-opacity"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center justify-center p-8 text-center min-h-[180px] ${className}`}
    >
      <div className="w-11 h-11 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5 text-amber-500" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">We hit a small snag</p>
      <p className="text-xs text-muted-foreground mb-4 max-w-xs leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}
    </motion.div>
  );
}
