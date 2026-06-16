import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, Zap, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface MomentumData {
  score: number;
  label: string;
  color: string;
  breakdown: {
    attendance: { score: number; max: number; pct: number };
    homework: { score: number; max: number; pct: number };
    assessments: { score: number; max: number; pct: number };
    revision: { score: number; max: number; sessions: number };
    consistency: { score: number; max: number; activeDays: number };
  };
  recommendations: string[];
}

function GaugeArc({ score, color }: { score: number; color: string }) {
  const r = 54;
  const cx = 64;
  const cy = 70;
  const startAngle = -200;
  const endAngle = 20;
  const totalArc = endAngle - startAngle;
  const progress = Math.min(score / 100, 1);
  const filledArc = totalArc * progress;

  function polarToCartesian(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function arcPath(start: number, end: number) {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = Math.abs(end - start) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  return (
    <svg width="128" height="90" viewBox="0 0 128 90">
      <path d={arcPath(startAngle, endAngle)} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
      <motion.path
        d={arcPath(startAngle, startAngle + filledArc)}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: progress }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

export default function MomentumScore({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery<MomentumData>({
    queryKey: ["student-momentum"],
    queryFn: () => apiFetch("/api/student/momentum").then(r => r.json()),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className={`bg-card rounded-2xl border border-border shadow-sm ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-primary/20 animate-pulse" />
          <div className="h-4 w-36 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-24 bg-muted/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const breakdown = data.breakdown || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`bg-card rounded-2xl border border-border shadow-sm ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: data.color }} />
          <h3 className="text-sm font-bold text-foreground">Learning Momentum</h3>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${data.color}18`, color: data.color }}
        >
          {data.label}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div className="relative flex flex-col items-center">
          <GaugeArc score={data.score} color={data.color} />
          <div className="absolute bottom-4 flex flex-col items-center">
            <motion.span
              className="text-2xl font-black tabular-nums"
              style={{ color: data.color }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.3 }}
            >
              {data.score}
            </motion.span>
            <span className="text-[10px] text-muted-foreground -mt-0.5">/ 100</span>
          </div>
        </div>

        {!compact && breakdown.attendance && (
          <div className="flex-1 ml-3 space-y-1.5 pb-1">
            {[
              { label: "Attendance", score: breakdown.attendance.score, max: breakdown.attendance.max, pct: breakdown.attendance.pct },
              { label: "Homework", score: breakdown.homework?.score || 0, max: breakdown.homework?.max || 20, pct: breakdown.homework?.pct || 0 },
              { label: "Exams", score: breakdown.assessments?.score || 0, max: breakdown.assessments?.max || 30, pct: breakdown.assessments?.pct || 0 },
              { label: "Revision", score: breakdown.revision?.score || 0, max: breakdown.revision?.max || 15, pct: Math.round((breakdown.revision?.sessions || 0) / 20 * 100) },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  <span className="text-[10px] font-semibold text-foreground">{item.pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: data.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!compact && data.recommendations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase mb-2">
            Recommendations
          </p>
          <ul className="space-y-1">
            {data.recommendations.slice(0, 2).map((rec, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                <TrendingUp className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: data.color }} />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
