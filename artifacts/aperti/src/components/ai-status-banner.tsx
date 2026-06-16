import { AlertTriangle, CheckCircle2, Clock, RefreshCw, WifiOff, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

type AIStatus = "available" | "unavailable" | "loading" | "fallback" | "low-confidence" | "budget";

interface AIStatusBannerProps {
  status: AIStatus;
  message?: string;
  onRetry?: () => void;
  onManual?: () => void;
  retrying?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<AIStatus, {
  icon: React.ElementType;
  bg: string;
  border: string;
  iconColor: string;
  title: string;
  defaultMessage: string;
  showRetry: boolean;
  showManual: boolean;
}> = {
  available: {
    icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-800",
    iconColor: "text-emerald-600",
    title: "AI Active",
    defaultMessage: "AI is processing your request.",
    showRetry: false,
    showManual: false,
  },
  loading: {
    icon: Brain,
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    iconColor: "text-blue-600",
    title: "Analyzing...",
    defaultMessage: "AI is analyzing the submission. This usually takes 5–15 seconds.",
    showRetry: false,
    showManual: false,
  },
  unavailable: {
    icon: WifiOff,
    bg: "bg-rose-50 dark:bg-rose-950/20",
    border: "border-rose-200 dark:border-rose-800",
    iconColor: "text-rose-600",
    title: "AI review unavailable",
    defaultMessage: "AI grading is temporarily unavailable. Teacher review mode activated.",
    showRetry: true,
    showManual: true,
  },
  fallback: {
    icon: AlertTriangle,
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800",
    iconColor: "text-amber-600",
    title: "AI processing failed",
    defaultMessage: "AI grading encountered an issue. Manual review is available.",
    showRetry: true,
    showManual: true,
  },
  "low-confidence": {
    icon: AlertTriangle,
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800",
    iconColor: "text-amber-600",
    title: "Teacher review required",
    defaultMessage: "AI confidence is low on this submission. A teacher must review before the grade is finalised.",
    showRetry: false,
    showManual: true,
  },
  budget: {
    icon: Clock,
    bg: "bg-orange-50 dark:bg-orange-950/20",
    border: "border-orange-200 dark:border-orange-800",
    iconColor: "text-orange-600",
    title: "Daily AI budget reached",
    defaultMessage: "AI grading is paused until tomorrow. Manual grading is available now.",
    showRetry: false,
    showManual: true,
  },
};

export function AIStatusBanner({
  status,
  message,
  onRetry,
  onManual,
  retrying = false,
  className = "",
}: AIStatusBannerProps) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.bg} ${cfg.border} ${className}`}>
      <Icon size={18} className={`${cfg.iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{cfg.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {message ?? cfg.defaultMessage}
        </p>
      </div>
      {(cfg.showRetry || cfg.showManual) && (
        <div className="flex items-center gap-2 shrink-0">
          {cfg.showRetry && onRetry && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              onClick={onRetry}
              disabled={retrying}
            >
              <RefreshCw size={11} className={retrying ? "animate-spin" : ""} />
              {retrying ? "Retrying..." : "Retry"}
            </Button>
          )}
          {cfg.showManual && onManual && (
            <Button
              size="sm"
              className="gap-1.5 text-xs h-7 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={onManual}
            >
              Manual Review
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface AILoadingStateProps {
  label?: string;
  subLabel?: string;
}

export function AILoadingState({ label = "Analyzing submission...", subLabel = "Generating feedback" }: AILoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-teal-100 dark:border-teal-900" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-teal-600 border-t-transparent animate-spin" />
        <Brain size={16} className="absolute inset-0 m-auto text-teal-600" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">{subLabel}</p>
      </div>
      <div className="flex gap-1.5">
        {["Extracting text", "Matching mark scheme", "Generating feedback"].map((step, i) => (
          <span
            key={step}
            className="text-xs px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400"
            style={{ animationDelay: `${i * 0.3}s`, opacity: 0.6 + i * 0.2 }}
          >
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

interface ConfidenceBadgeProps {
  confidence: number | null;
  showLabel?: boolean;
}

export function ConfidenceBadge({ confidence, showLabel = true }: ConfidenceBadgeProps) {
  if (confidence === null || confidence === undefined) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-muted-foreground">
        {showLabel && "Confidence: "}N/A
      </span>
    );
  }
  const pct = Math.round(confidence * 100);
  const cls = pct >= 80
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    : pct >= 65
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {showLabel && "Confidence: "}{pct}%
      {pct < 65 && " — review required"}
    </span>
  );
}
