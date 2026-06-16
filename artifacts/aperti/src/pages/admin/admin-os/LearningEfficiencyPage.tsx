import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import {
  TrendingUp, BookOpen, Brain, Layers, BarChart3, Star,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 5) return (
    <span className="flex items-center gap-0.5 text-green-600 text-xs font-semibold">
      <ArrowUpRight className="h-3 w-3" />+{delta.toFixed(1)}%
    </span>
  );
  if (delta < -5) return (
    <span className="flex items-center gap-0.5 text-red-500 text-xs font-semibold">
      <ArrowDownRight className="h-3 w-3" />{delta.toFixed(1)}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-gray-400 text-xs font-semibold">
      <Minus className="h-3 w-3" />{delta.toFixed(1)}%
    </span>
  );
}

const ACTIVITY_ICONS: Record<string, any> = {
  flashcards: BookOpen,
  practice_questions: Brain,
  revision_packs: Layers,
  assessments: BarChart3,
  live_sessions: Users,
};

const ACTIVITY_LABELS: Record<string, string> = {
  flashcards: "Flashcards",
  practice_questions: "Practice Questions",
  revision_packs: "Revision Packs",
  assessments: "Assessments",
  live_sessions: "Live Sessions",
};

const ACTIVITY_COLORS: Record<string, string> = {
  flashcards: "hsl(var(--primary))",
  practice_questions: "#7C3AED",
  revision_packs: "#2563EB",
  assessments: "#D97706",
  live_sessions: "#059669",
};

export default function LearningEfficiencyPage() {
  const [subject, setSubject] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["learning-efficiency", subject],
    queryFn: () => fetchJSON(`/api/admin/learning-efficiency${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`),
    refetchInterval: 5 * 60_000,
  });

  const activityEfficiency: { type: string; avgImprovement: number; sessions: number; studentsImproved: number }[] =
    data?.activityEfficiency ?? [];

  const topPerformers: { studentName: string; improvement: number; topActivity: string }[] =
    data?.topPerformers ?? [];

  const subjectBreakdown: { subject: string; avgScore: number; studentsActive: number }[] =
    data?.subjectBreakdown ?? [];

  const weeklyTrend: { week: string; flashcards: number; practice_questions: number; assessments: number }[] =
    data?.weeklyTrend ?? [];

  const summary = data?.summary ?? {};

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Learning Efficiency Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Which activities drive the greatest score improvements across your platform.
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Active Students", value: summary.activeStudents ?? "—", icon: Users, color: "text-primary bg-primary/8" },
          { label: "Avg Improvement", value: summary.avgImprovementPct != null ? `${summary.avgImprovementPct.toFixed(1)}%` : "—", icon: TrendingUp, color: "text-green-600 bg-green-50" },
          { label: "Top Activity", value: summary.topActivity ? ACTIVITY_LABELS[summary.topActivity] ?? summary.topActivity : "—", icon: Star, color: "text-violet-600 bg-violet-50" },
          { label: "Sessions This Week", value: summary.sessionsThisWeek ?? "—", icon: BarChart3, color: "text-blue-600 bg-blue-50" },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 leading-none">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activity Efficiency Comparison */}
      {activityEfficiency.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-900 mb-4">Average Score Improvement by Activity Type</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {activityEfficiency.map((a, i) => {
              const Icon = ACTIVITY_ICONS[a.type] ?? Brain;
              const color = ACTIVITY_COLORS[a.type] ?? "#6B7280";
              return (
                <motion.div key={a.type} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/40">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${color}18` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{ACTIVITY_LABELS[a.type] ?? a.type}</p>
                    <DeltaBadge delta={a.avgImprovement} />
                    <p className="text-[10px] text-gray-400 mt-0.5">{a.sessions} sessions · {a.studentsImproved} improved</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {activityEfficiency.length >= 2 && (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={activityEfficiency.map(a => ({
                name: ACTIVITY_LABELS[a.type]?.split(" ")[0] ?? a.type,
                improvement: Math.round(a.avgImprovement * 10) / 10,
              }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip formatter={(v: any) => [`${v}%`, "Avg improvement"]} />
                <Bar dataKey="improvement" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Weekly Trend */}
      {weeklyTrend.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-900 mb-4">Activity Usage · Last 8 Weeks</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="flashcards" stroke="hsl(var(--primary))" dot={false} name="Flashcards" />
              <Line type="monotone" dataKey="practice_questions" stroke="#7C3AED" dot={false} name="Practice Qs" />
              <Line type="monotone" dataKey="assessments" stroke="#D97706" dot={false} name="Assessments" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Top Performers */}
        {topPerformers.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" /> Top Improving Students
            </p>
            <div className="space-y-2">
              {topPerformers.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold w-4 text-gray-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.studentName}</p>
                    <p className="text-[10px] text-gray-400">{ACTIVITY_LABELS[s.topActivity] ?? s.topActivity}</p>
                  </div>
                  <DeltaBadge delta={s.improvement} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subject Breakdown */}
        {subjectBreakdown.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" /> Performance by Subject
            </p>
            <div className="space-y-2.5">
              {subjectBreakdown.slice(0, 8).map((s, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{s.subject}</span>
                    <span className="text-xs text-gray-500">{s.avgScore.toFixed(0)}% avg · {s.studentsActive} students</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(s.avgScore, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!isLoading && activityEfficiency.length === 0 && topPerformers.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <TrendingUp className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">No efficiency data yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            As students complete activities and assessments, this page will show which activities drive the greatest improvement.
          </p>
        </div>
      )}
    </div>
  );
}
