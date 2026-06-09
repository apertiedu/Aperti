import { motion } from "framer-motion";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { TrendingUp, Zap } from "lucide-react";
import { useLocation } from "wouter";

interface PlanUsageBarProps {
  resource: string;
  label?: string;
}

export default function PlanUsageBar({ resource, label }: PlanUsageBarProps) {
  const { planUsage, isLoading, getUsagePercent, getRemaining, isAtLimit } = usePlanLimits();
  const [, navigate] = useLocation();

  if (isLoading || !planUsage) return null;

  const limit = planUsage.limits[resource];
  if (limit === undefined || limit <= 0) return null;

  const used = planUsage.usage[resource] ?? 0;
  const pct = getUsagePercent(resource);
  const remaining = getRemaining(resource);
  const atLimit = isAtLimit(resource);
  const isWarning = pct >= 75;

  const barColor = atLimit
    ? "#EF4444"
    : isWarning
    ? "#F59E0B"
    : "#0D9488";

  const bgColor = atLimit
    ? "bg-red-50 border-red-100"
    : isWarning
    ? "bg-amber-50 border-amber-100"
    : "bg-teal-50/60 border-teal-100/60";

  const textColor = atLimit
    ? "text-red-700"
    : isWarning
    ? "text-amber-700"
    : "text-teal-700";

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border px-4 py-3 flex items-center gap-4 ${bgColor}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-semibold ${textColor}`}>
            {label ?? resource} — {used} / {limit} used
          </span>
          <span className={`text-xs font-bold ${textColor}`}>{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/70 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: barColor }}
          />
        </div>
        {atLimit ? (
          <p className="text-[11px] mt-1.5 font-medium text-red-600">
            Limit reached — upgrade your plan to add more.
          </p>
        ) : isWarning ? (
          <p className="text-[11px] mt-1.5 font-medium text-amber-600">
            {remaining} remaining — consider upgrading soon.
          </p>
        ) : (
          <p className="text-[11px] mt-1.5 text-teal-600">
            {remaining} slot{remaining !== 1 ? "s" : ""} remaining on your current plan.
          </p>
        )}
      </div>
      <button
        onClick={() => navigate("/pricing")}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: barColor }}
      >
        {atLimit ? <Zap className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
        {atLimit ? "Upgrade" : "Plans"}
      </button>
    </motion.div>
  );
}
