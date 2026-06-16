import { cn } from "@/lib/utils";

interface AIConfidenceBadgeProps {
  confidence: number;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

function getLevel(confidence: number): {
  label: string;
  color: string;
  bg: string;
  dot: string;
} {
  if (confidence >= 0.85) {
    return { label: "High", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" };
  }
  if (confidence >= 0.65) {
    return { label: "Medium", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500" };
  }
  return { label: "Low", color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-500" };
}

export function AIConfidenceBadge({ confidence, size = "sm", showLabel = true, className }: AIConfidenceBadgeProps) {
  const level = getLevel(confidence);
  const pct = Math.round(confidence * 100);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border rounded-full font-medium",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        level.bg,
        level.color,
        className,
      )}
      title={`AI Confidence: ${pct}%`}
    >
      <span className={cn("rounded-full shrink-0", size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2", level.dot)} />
      {showLabel ? `${level.label} confidence (${pct}%)` : `${pct}%`}
    </span>
  );
}

interface AIConfidenceBarProps {
  confidence: number;
  className?: string;
}

export function AIConfidenceBar({ confidence, className }: AIConfidenceBarProps) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.85 ? "bg-emerald-500" : confidence >= 0.65 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}
