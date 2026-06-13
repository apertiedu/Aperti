import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "hoverable" | "analytics" | "flat" | "tinted";
  padding?: "none" | "sm" | "md" | "lg";
  animate?: boolean;
}

const VARIANTS: Record<string, string> = {
  default: "bg-card border border-border/40 shadow-sm",
  hoverable:
    "bg-card border border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 cursor-pointer transition-all duration-200",
  analytics:
    "bg-card border border-border/40 shadow-sm hover:shadow-md transition-all duration-200",
  flat: "bg-muted/40 border border-border/20",
  tinted: "bg-primary/5 border border-primary/15",
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
  className,
  children,
  ...props
}: AppCardProps) {
  const base = cn(
    "rounded-xl",
    VARIANTS[variant],
    PADDINGS[padding],
    className,
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={base}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
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
}

export function AppCardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: AppCardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground text-sm leading-snug truncate">{title}</h3>
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
}

export function StatCard({
  label,
  value,
  delta,
  deltaPositive = true,
  icon,
  className,
}: StatCardProps) {
  return (
    <AppCard className={className}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      {delta && (
        <p className={`text-xs mt-1 font-medium ${deltaPositive ? "text-emerald-600" : "text-destructive"}`}>
          {delta}
        </p>
      )}
    </AppCard>
  );
}
