import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  variant?: "default" | "elevated" | "subtle" | "accent";
  hover?: boolean;
  glow?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ variant = "default", hover = true, glow = false, className, children, ...props }, ref) => {
    const variants = {
      default:  "glass-card rounded-xl",
      elevated: "glass-card rounded-2xl shadow-level-3",
      subtle:   "bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl",
      accent:   "glass-card rounded-xl border-primary/20",
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          variants[variant],
          glow && "teal-glow",
          "relative overflow-hidden",
          className
        )}
        whileHover={hover ? { y: -2, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } } : undefined}
        {...props}
      >
        {variant === "accent" && (
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        )}
        {children}
      </motion.div>
    );
  }
);
GlassCard.displayName = "GlassCard";

interface GlassCardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCardHeader({ children, className }: GlassCardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between px-5 py-4 border-b border-border/50", className)}>
      {children}
    </div>
  );
}

interface GlassCardBodyProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export function GlassCardBody({ children, className, padded = true }: GlassCardBodyProps) {
  return (
    <div className={cn(padded && "px-5 py-4", className)}>
      {children}
    </div>
  );
}

interface GlassCardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCardFooter({ children, className }: GlassCardFooterProps) {
  return (
    <div className={cn("flex items-center justify-between px-5 py-3.5 border-t border-border/50 bg-muted/20", className)}>
      {children}
    </div>
  );
}
