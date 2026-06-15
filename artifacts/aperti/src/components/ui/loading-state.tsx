import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const MESSAGES: Record<string, string[]> = {
  default:     ["Loading…", "Almost there…", "Hang tight…"],
  dashboard:   ["Preparing your dashboard…", "Loading your data…", "Getting things ready…"],
  assignments: ["Loading assignments…", "Fetching your work…"],
  attendance:  ["Fetching attendance records…", "Loading session data…"],
  messages:    ["Loading messages…", "Fetching conversations…"],
  grades:      ["Loading grades…", "Fetching results…"],
  students:    ["Loading students…", "Fetching class roster…"],
  analytics:   ["Crunching the numbers…", "Loading analytics…", "Preparing insights…"],
  courses:     ["Loading courses…", "Fetching content…"],
  reports:     ["Generating report…", "Loading data…"],
  exams:       ["Loading exam…", "Preparing questions…"],
  calendar:    ["Loading schedule…", "Fetching events…"],
  profile:     ["Loading profile…", "Fetching account details…"],
};

function pickMessage(context: string): string {
  const list = MESSAGES[context] ?? MESSAGES.default;
  return list[Math.floor(Math.random() * list.length)];
}

interface ContextLoaderProps {
  context?: keyof typeof MESSAGES | string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ContextLoader({ context = "default", className, size = "md" }: ContextLoaderProps) {
  const message = pickMessage(context);

  const spinnerSize = { sm: "w-5 h-5", md: "w-7 h-7", lg: "w-9 h-9" }[size];
  const textSize    = { sm: "text-xs", md: "text-sm", lg: "text-base" }[size];
  const gap         = { sm: "gap-2", md: "gap-3", lg: "gap-4" }[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex flex-col items-center justify-center min-h-[180px]", gap, className)}
    >
      <div className="relative">
        <div className={cn("border-2 border-gray-100 rounded-full", spinnerSize)} />
        <div className={cn("border-2 border-teal-500 border-t-transparent rounded-full animate-spin absolute inset-0", spinnerSize)} />
      </div>
      <p className={cn("text-gray-400 font-medium animate-pulse", textSize)}>{message}</p>
    </motion.div>
  );
}

interface InlineLoaderProps {
  text?: string;
  className?: string;
}

export function InlineLoader({ text = "Loading…", className }: InlineLoaderProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-gray-400", className)}>
      <span className="w-3.5 h-3.5 border border-gray-300 border-t-transparent rounded-full animate-spin" />
      {text}
    </span>
  );
}

interface PageSkeletonProps {
  rows?: number;
  context?: string;
  className?: string;
}

export function PageSkeleton({ rows = 3, context, className }: PageSkeletonProps) {
  const message = context ? pickMessage(context) : undefined;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("space-y-4", className)}>
      {message && (
        <p className="text-xs text-gray-400 font-medium animate-pulse">{message}</p>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"
            style={{ animationDelay: `${i * 0.08}s`, opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    </motion.div>
  );
}

interface DataLoadingWrapperProps {
  isLoading: boolean;
  context?: string;
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}

export function DataLoadingWrapper({ isLoading, context, children, fallback, className }: DataLoadingWrapperProps) {
  if (isLoading) {
    return fallback ? <>{fallback}</> : <ContextLoader context={context} className={className} />;
  }
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>{children}</motion.div>;
}
