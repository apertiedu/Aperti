import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}


export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  const iconSize = size === "sm" ? "w-10 h-10" : size === "lg" ? "w-16 h-16" : "w-12 h-12";
  const iconInner = size === "sm" ? "w-5 h-5" : size === "lg" ? "w-8 h-8" : "w-6 h-6";
  const titleClass = size === "sm" ? "text-sm font-semibold" : size === "lg" ? "text-xl font-bold" : "text-base font-semibold";
  const descClass = size === "sm" ? "text-xs" : "text-sm";
  const padding = size === "sm" ? "py-8" : size === "lg" ? "py-16" : "py-12";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex flex-col items-center justify-center text-center", padding, className)}
    >
      {Icon && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
          className={cn("rounded-2xl flex items-center justify-center mb-4 bg-primary/8", iconSize)}
        >
          <Icon className={cn(iconInner, "text-primary")} />
        </motion.div>
      )}
      <h3 className={cn("text-foreground mb-1", titleClass)}>{title}</h3>
      {description && (
        <p className={cn("text-muted-foreground max-w-xs mb-5", descClass)}>{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {action && (
            <Button
              size={size === "sm" ? "sm" : "default"}
              onClick={action.onClick}
              className="gap-1.5 font-medium"
            >
              {action.icon && <action.icon className="w-3.5 h-3.5" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" size={size === "sm" ? "sm" : "default"} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
