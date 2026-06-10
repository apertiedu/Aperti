import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function PageWrapper({ children, className, id }: PageWrapperProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
      transition={{ duration: reducedMotion ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

export function AutoSaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  const map = {
    saving: { text: "Saving…",   cls: "text-muted-foreground" },
    saved:  { text: "Saved ✓",   cls: "text-emerald-600" },
    error:  { text: "Not saved", cls: "text-red-500" },
  };
  const { text, cls } = map[status];
  return (
    <motion.span
      key={status}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className={`text-xs font-medium ${cls}`}
    >
      {text}
    </motion.span>
  );
}
