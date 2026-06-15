import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Flame, BarChart3, BookOpen, Clock } from "lucide-react";

interface ChildData {
  attendanceRate: number;
  avgGrade: number;
  revisionCompleted: number;
  revisionTotal: number;
  todayAttendance: string;
  ascend?: { streak: number; level: number; rank: string } | null;
  interventionAlerts: any[];
  upcomingDeadlines: any[];
}

function Metric({ icon: Icon, label, value, color, alert }: {
  icon: any; label: string; value: string; color: string; alert?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex-1 min-w-0 rounded-xl p-3 border ${alert ? "bg-red-50 border-red-100" : "bg-card border-border"} shadow-sm`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className={`text-base font-black leading-none ${alert ? "text-red-700" : "text-gray-900"}`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 font-medium leading-tight">{label}</p>
    </motion.div>
  );
}

function getGradeLabel(pct: number): string {
  if (pct >= 90) return "A*";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return pct > 0 ? "E" : "—";
}

export default function ParentSnapshot({ child }: { child: ChildData }) {
  const revPct = child.revisionTotal > 0
    ? Math.round((child.revisionCompleted / child.revisionTotal) * 100)
    : 0;

  const attendanceLow = child.attendanceRate < 75;
  const gradeLow = child.avgGrade > 0 && child.avgGrade < 50;
  const hasAlerts = child.interventionAlerts.length > 0;
  const hasDue = child.upcomingDeadlines.length > 0;

  return (
    <div className="mb-5">
      {/* ── At-a-glance metrics ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Metric
          icon={CheckCircle2}
          label="Attendance"
          value={`${child.attendanceRate}%`}
          color={attendanceLow ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}
          alert={attendanceLow}
        />
        <Metric
          icon={BarChart3}
          label="Avg Grade"
          value={getGradeLabel(child.avgGrade)}
          color={gradeLow ? "bg-red-100 text-red-600" : "bg-teal-100 text-teal-600"}
          alert={gradeLow}
        />
        <Metric
          icon={BookOpen}
          label="Revision"
          value={`${revPct}%`}
          color="bg-violet-100 text-violet-600"
        />
        {child.ascend && (
          <Metric
            icon={Flame}
            label="Streak"
            value={`${child.ascend.streak}d`}
            color="bg-orange-100 text-orange-600"
          />
        )}
        {hasDue && (
          <Metric
            icon={Clock}
            label="Due soon"
            value={`${child.upcomingDeadlines.length}`}
            color="bg-amber-100 text-amber-600"
            alert={child.upcomingDeadlines.length >= 3}
          />
        )}
      </div>

      {/* ── Alert strip ── */}
      {hasAlerts && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-red-800">
              {child.interventionAlerts.length} attention alert{child.interventionAlerts.length > 1 ? "s" : ""}
            </p>
            <p className="text-[11px] text-red-600 mt-0.5 leading-snug line-clamp-2">
              {child.interventionAlerts[0]?.message}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
