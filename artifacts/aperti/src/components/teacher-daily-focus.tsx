import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle, BookOpen, CheckCircle2, Clock, GraduationCap,
  MessageSquare, UserCheck, UserX, Zap, ChevronRight, TrendingDown,
} from "lucide-react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";

const TEAL = "#0D9488";

interface FocusData {
  dayOfWeek: string;
  priorityScore: number;
  ungradedSubmissions: number;
  atRiskStudents: { id: number; display_name: string; pct: number }[];
  upcomingExams: { id: number; name: string; exam_date: string; course_name: string }[];
  pendingEnrollments: number;
  unreadParentMessages: number;
  todaySessions: { id: number; lesson_number: number; start_time: string; subject_name: string; course_name: string }[];
  ungradedHomework: number;
}

function FocusItem({
  icon: Icon,
  label,
  value,
  href,
  urgency = "normal",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  href: string;
  urgency?: "high" | "normal" | "low";
}) {
  const colors = {
    high: { bg: "bg-red-50", border: "border-red-100", text: "text-red-600", icon: "text-red-500" },
    normal: { bg: "bg-teal-50", border: "border-teal-100", text: "text-teal-700", icon: "text-teal-500" },
    low: { bg: "bg-slate-50", border: "border-slate-100", text: "text-slate-600", icon: "text-slate-400" },
  };
  const c = colors[urgency];

  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.02, y: -1 }}
        transition={{ duration: 0.15 }}
        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${c.bg} ${c.border} hover:opacity-90`}
      >
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0">
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-sm font-semibold ${c.text}`}>{value}</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
      </motion.div>
    </Link>
  );
}

export default function TeacherDailyFocus() {
  const { data, isLoading, error } = useQuery<FocusData>({
    queryKey: ["teacher-daily-focus"],
    queryFn: () => apiFetch("/api/teacher/daily-focus").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-full bg-teal-100 animate-pulse" />
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  const hasItems =
    data.ungradedSubmissions > 0 ||
    data.atRiskStudents.length > 0 ||
    data.pendingEnrollments > 0 ||
    data.unreadParentMessages > 0 ||
    data.ungradedHomework > 0 ||
    data.upcomingExams.length > 0;

  const getTimeGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-2xl border border-border p-5 shadow-sm"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Zap className="w-4 h-4" style={{ color: TEAL }} />
            <h2 className="text-sm font-bold text-foreground">Daily Focus</h2>
            {data.priorityScore > 10 && (
              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                {data.priorityScore > 25 ? "High Priority" : "Action Needed"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{getTimeGreeting()} — {data.dayOfWeek}</p>
        </div>
        <Link href="/analytics">
          <span className="text-xs text-teal-600 hover:underline cursor-pointer">Full report →</span>
        </Link>
      </div>

      {!hasItems ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-4"
        >
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: TEAL }} />
          <p className="text-sm font-semibold text-foreground">All clear for today!</p>
          <p className="text-xs text-muted-foreground mt-0.5">No urgent items require your attention.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {data.ungradedSubmissions > 0 && (
            <FocusItem
              icon={BookOpen}
              label="Ungraded"
              value={`${data.ungradedSubmissions} exam${data.ungradedSubmissions !== 1 ? "s" : ""}`}
              href="/exams"
              urgency="high"
            />
          )}
          {data.ungradedHomework > 0 && (
            <FocusItem
              icon={CheckCircle2}
              label="Homework"
              value={`${data.ungradedHomework} to grade`}
              href="/my-homework"
              urgency="high"
            />
          )}
          {data.atRiskStudents.length > 0 && (
            <FocusItem
              icon={UserX}
              label="At-Risk Students"
              value={`${data.atRiskStudents.length} student${data.atRiskStudents.length !== 1 ? "s" : ""}`}
              href="/students"
              urgency="high"
            />
          )}
          {data.pendingEnrollments > 0 && (
            <FocusItem
              icon={UserCheck}
              label="Enrollments"
              value={`${data.pendingEnrollments} pending`}
              href="/my-courses"
              urgency="normal"
            />
          )}
          {data.unreadParentMessages > 0 && (
            <FocusItem
              icon={MessageSquare}
              label="Parent Messages"
              value={`${data.unreadParentMessages} unread`}
              href="/messages"
              urgency="normal"
            />
          )}
          {data.upcomingExams.length > 0 && (
            <FocusItem
              icon={Clock}
              label="Upcoming Exams"
              value={`${data.upcomingExams.length} this week`}
              href="/exams"
              urgency="low"
            />
          )}
          {data.todaySessions.length > 0 && (
            <FocusItem
              icon={GraduationCap}
              label="Today's Sessions"
              value={`${data.todaySessions.length} session${data.todaySessions.length !== 1 ? "s" : ""}`}
              href="/attendance"
              urgency="low"
            />
          )}
        </div>
      )}

      {data.atRiskStudents.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase mb-2 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-500" /> At-Risk Students
          </p>
          <div className="space-y-1">
            {data.atRiskStudents.slice(0, 3).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{s.display_name}</span>
                <span className="text-red-500 font-semibold">{s.pct}% attendance</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
