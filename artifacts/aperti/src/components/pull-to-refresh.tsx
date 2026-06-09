import { RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

interface Props {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function PullToRefresh({ onRefresh, children, className = "", disabled = false }: Props) {
  const { containerRef, isPulling, isRefreshing, pullDistance, progress } =
    usePullToRefresh({ onRefresh, disabled });

  return (
    <div ref={containerRef} className={`relative overflow-y-auto ${className}`} style={{ overscrollBehaviorY: "contain" }}>
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden"
        style={{ height: pullDistance, transition: isRefreshing ? "none" : "height 0.1s" }}
      >
        <motion.div
          animate={{ rotate: isRefreshing ? 360 : progress * 180, scale: Math.max(0.5, progress) }}
          transition={isRefreshing ? { repeat: Infinity, duration: 0.7, ease: "linear" } : { duration: 0.1 }}
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isPulling || isRefreshing ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
        </motion.div>
      </div>
      <div style={{ transform: `translateY(${pullDistance}px)`, transition: isRefreshing ? "none" : "transform 0.15s" }}>
        {children}
      </div>
    </div>
  );
}
