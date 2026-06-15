import { forwardRef } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline" | "success" | "warning";
type Size = "sm" | "md" | "lg";

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  success?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:opacity-90 shadow-sm disabled:opacity-50 hover:shadow-[0_4px_12px_hsl(var(--primary)/0.35)]",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-sm disabled:opacity-50",
  danger:
    "bg-destructive text-destructive-foreground hover:opacity-90 shadow-sm disabled:opacity-50",
  ghost:
    "bg-transparent text-foreground hover:bg-muted disabled:opacity-40",
  outline:
    "bg-card text-foreground border border-border hover:bg-muted shadow-sm disabled:opacity-50 hover:border-primary/30",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50",
  warning:
    "bg-amber-500 text-white hover:bg-amber-600 shadow-sm disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-xl",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
};

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      success = false,
      icon,
      iconRight,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1",
          "select-none cursor-pointer active:scale-[0.98]",
          "disabled:cursor-not-allowed",
          VARIANTS[variant],
          SIZES[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : success ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children}
        {!loading && !success && iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  },
);

AppButton.displayName = "AppButton";
