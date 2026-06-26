import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  iconColor?: string;
  iconBg?: string;
  trend?: "up" | "down" | "neutral";
  suffix?: string;
  prefix?: string;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  iconColor = "hsl(var(--primary))",
  iconBg = "hsl(var(--primary) / 0.1)",
  trend,
  suffix,
  prefix,
  loading = false,
  className,
  onClick,
}: StatCardProps) {
  const resolvedTrend = trend ?? (delta !== undefined ? (delta > 0 ? "up" : delta < 0 ? "down" : "neutral") : undefined);

  const trendConfig = {
    up:      { icon: TrendingUp,   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
    down:    { icon: TrendingDown, color: "text-red-500 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-950/30" },
    neutral: { icon: Minus,        color: "text-muted-foreground",                  bg: "bg-muted/50" },
  };

  const tc = resolvedTrend ? trendConfig[resolvedTrend] : null;

  if (loading) {
    return (
      <div className={cn("stat-card", className)}>
        <div className="h-4 w-24 skeleton-premium rounded mb-3" />
        <div className="h-8 w-20 skeleton-premium rounded mb-2" />
        <div className="h-3 w-28 skeleton-premium rounded" />
      </div>
    );
  }

  return (
    <motion.div
      className={cn("stat-card", onClick && "cursor-pointer", className)}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.01 } : undefined}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-label text-muted-foreground truncate">{label}</p>
        {Icon && (
          <div
            className="icon-bg icon-bg-sm shrink-0"
            style={{ backgroundColor: iconBg, color: iconColor }}
          >
            <Icon size={14} />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <p className="stat-number text-2xl font-bold text-foreground tracking-tight">
          {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
        </p>
        {tc && delta !== undefined && (
          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold mb-0.5", tc.bg, tc.color)}>
            <tc.icon size={11} />
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      {deltaLabel && (
        <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{deltaLabel}</p>
      )}
    </motion.div>
  );
}

interface StatGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

export function StatGrid({ children, cols = 4, className }: StatGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  };
  return (
    <div className={cn("grid gap-4", gridCols[cols], className)}>
      {children}
    </div>
  );
}
