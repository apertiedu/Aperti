import { ReactNode, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonStatus = "idle" | "loading" | "success" | "error";

interface StatusButtonProps {
  status?: ButtonStatus;
  idleText: ReactNode;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  autoReset?: boolean;
  resetDelay?: number;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary:     "bg-teal-600 text-white hover:bg-teal-700 focus-visible:ring-teal-500",
  secondary:   "bg-gray-100 text-gray-800 hover:bg-gray-200 focus-visible:ring-gray-400",
  destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
  outline:     "border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus-visible:ring-gray-400",
  ghost:       "text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400",
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-xl gap-2",
  lg: "px-5 py-2.5 text-sm rounded-xl gap-2",
};

export function StatusButton({
  status = "idle",
  idleText,
  loadingText = "Saving…",
  successText = "Saved",
  errorText = "Failed",
  onClick,
  disabled,
  className,
  variant = "primary",
  size = "md",
  type = "button",
  autoReset = true,
  resetDelay = 2200,
}: StatusButtonProps) {
  const [internalStatus, setInternalStatus] = useState<ButtonStatus>(status);

  useEffect(() => {
    setInternalStatus(status);
    if (autoReset && (status === "success" || status === "error")) {
      const t = setTimeout(() => setInternalStatus("idle"), resetDelay);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [status, autoReset, resetDelay]);

  const isLoading = internalStatus === "loading";
  const isSuccess = internalStatus === "success";
  const isError   = internalStatus === "error";

  const successCls = "bg-green-600 text-white hover:bg-green-700";
  const errorCls   = "bg-red-600 text-white hover:bg-red-700";

  let variantCls = VARIANT_CLASSES[variant];
  if (isSuccess) variantCls = successCls;
  if (isError)   variantCls = errorCls;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      whileTap={!disabled && !isLoading ? { scale: 0.97 } : undefined}
      className={cn(
        "relative inline-flex items-center justify-center font-semibold",
        "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed select-none",
        SIZE_CLASSES[size],
        variantCls,
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isLoading && (
          <motion.span key="loading" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            className="inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {loadingText}
          </motion.span>
        )}
        {isSuccess && (
          <motion.span key="success" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            {successText}
          </motion.span>
        )}
        {isError && (
          <motion.span key="error" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            className="inline-flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" />
            {errorText}
          </motion.span>
        )}
        {internalStatus === "idle" && (
          <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5">
            {idleText}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function useMutationStatus(isPending: boolean, isSuccess: boolean, isError: boolean): ButtonStatus {
  if (isPending) return "loading";
  if (isSuccess) return "success";
  if (isError)   return "error";
  return "idle";
}
