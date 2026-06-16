import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "hoverable" | "analytics" | "flat" | "tinted" | "interactive" | "glass";
  padding?: "none" | "sm" | "md" | "lg";
  animate?: boolean;
  highlight?: boolean;
}

const VARIANTS: Record<string, string> = {
  default:
    "bg-card border border-border/40 shadow-sm",
  hoverable:
    "bg-card border border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 cursor-pointer transition-all duration-200",
  analytics:
    "bg-card border border-border/40 shadow-sm hover:shadow-md hover:border-primary/10 transition-all duration-200",
  flat:
    "bg-muted/40 border border-border/20",
  tinted:
    "bg-primary/5 border border-primary/15",
  interactive:
    "bg-card border border-border/40 shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/30",
  glass:
    "bg-background/60 backdrop-blur-md border border-border/30 shadow-sm",
};

const PADDINGS: Record<string, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function AppCard({
  variant = "default",
  padding = "md",
  animate = false,
  highlight = false,
  className,
  children,
  ...props
}: AppCardProps) {
  const base = cn(
    "rounded-xl",
    VARIANTS[variant],
    PADDINGS[padding],
    highlight && "ring-2 ring-primary/30 border-primary/30",
    className,
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={base}
        {...(props as any)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={base} {...props}>
      {children}
    </div>
  );
}

interface AppCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  compact?: boolean;
}

export function AppCardHeader({
  title,
  subtitle,
  action,
  icon,
  compact = false,
  className,
}: AppCardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", compact ? "mb-3" : "mb-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className={cn("font-semibold text-foreground leading-snug truncate", compact ? "text-xs" : "text-sm")}>{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  icon?: React.ReactNode;
  className?: string;
  loading?: boolean;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  delta,
  deltaPositive = true,
  icon,
  className,
  loading = false,
  onClick,
}: StatCardProps) {
  if (loading) {
    return (
      <AppCard className={className}>
        <div className="flex items-start justify-between mb-2">
          <div className="h-2.5 skeleton rounded-full w-20" />
          <div className="h-8 w-8 skeleton rounded-lg" />
        </div>
        <div className="h-7 skeleton rounded-full w-14 mb-1" />
        <div className="h-2 skeleton rounded-full w-24" />
      </AppCard>
    );
  }

  return (
    <AppCard
      className={cn(className, onClick && "cursor-pointer")}
      variant={onClick ? "hoverable" : "default"}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center text-primary shrink-0">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight tabular-nums">{value}</p>
      {delta && (
        <p className={`text-xs mt-1 font-medium flex items-center gap-1 ${deltaPositive ? "text-emerald-600" : "text-destructive"}`}>
          <span>{deltaPositive ? "↑" : "↓"}</span>
          {delta}
        </p>
      )}
    </AppCard>
  );
}
