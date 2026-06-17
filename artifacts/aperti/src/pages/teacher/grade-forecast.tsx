import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart2,
  Users, Target, CheckCircle2, ChevronDown, ChevronUp,
  BookOpen, Activity, Info, Download,
} from "lucide-react";
import { useState } from "react";
import { useUxGuard } from "@/hooks/use-ux-guard";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface StudentPrediction {
  student_id: number;
  student_name: string;
  student_code: string;
  predicted_range: [number, number];
  predicted_midpoint: number;
  pass_probability: number;
  risk_level: "high" | "medium" | "low";
  trend: "improving" | "stable" | "declining";
  confidence: "high" | "medium" | "low";
  recent_avg: number;
  overall_avg: number;
  attendance_rate: number | null;
  data_points: number;
  exam_count: number;
  top_weak_topic: string | null;
  weak_topic_count: number;
  topic_breakdown: { topic: string; pct: number; weak: boolean }[];
  key_factors: string[];
}

interface ClassForecast {
  students: StudentPrediction[];
  distribution: { label: string; min: number; max: number; count: number; students: string[] }[];
  class_stats: {
    mean: number; median: number; pass_rate: number;
    at_risk_count: number; borderline_count: number; on_track_count: number;
    total_students: number; improving_count: number; declining_count: number;
  };
  subject?: { name: string; board: string; level: string };
  exam?: { name: string; exam_date: string; total_marks: string };
  disclaimer: string;
}

/* ── Risk config ────────────────────────────────────────────────────────── */
const RISK = {
  high:   { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200",    label: "At Risk",    icon: AlertTriangle },
  medium: { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200",  label: "Borderline", icon: Activity },
  low:    { bg: "bg-emerald-100",text: "text-emerald-700",border: "border-emerald-200",label: "On Track",   icon: CheckCircle2 },
};

const TREND_ICON: Record<string, any> = {
  improving: TrendingUp,
  declining: TrendingDown,
  stable: Minus,
};
const TREND_COLOR: Record<string, string> = {
  improving: "text-emerald-600",
  declining: "text-red-500",
  stable: "text-gray-400",
};

/* ── Sub-components ─────────────────────────────────────────────────────── */
function RiskBadge({ risk }: { risk: "high" | "medium" | "low" }) {
  const cfg = RISK[risk];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

function ScoreBar({ value, max = 100, color = "bg-teal-500" }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function DistributionChart({ data }: { data: ClassForecast["distribution"] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const BUCKET_COLORS = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-emerald-500",
    "bg-teal-600",
  ];
  return (
    <div className="flex items-end gap-2 h-28 pt-2">
      {data.map((bucket, i) => {
        const pct = Math.max(4, Math.round((bucket.count / max) * 100));
        return (
          <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2 py-1 rounded-lg
              opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {bucket.count} student{bucket.count !== 1 ? "s" : ""}
              {bucket.students.length > 0 && `: ${bucket.students.slice(0, 3).join(", ")}${bucket.students.length > 3 ? `…` : ""}`}
            </div>
            <motion.div
              className={`w-full rounded-t-lg ${BUCKET_COLORS[i]} relative`}
              style={{ height: `${pct}%`, minHeight: 4, maxHeight: "100%" }}
              initial={{ scaleY: 0, originY: "100%" }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
            >
              {bucket.count > 0 && (
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700">
                  {bucket.count}
                </span>
              )}
            </motion.div>
            <p className="text-[9px] text-gray-500 font-semibold">{bucket.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function StudentCard({ student, expanded, onToggle }: {
  student: StudentPrediction;
  expanded: boolean;
  onToggle: () => void;
}) {
  const riskCfg = RISK[student.risk_level];
  const TrendIcon = TREND_ICON[student.trend] ?? Minus;
  const trendColor = TREND_COLOR[student.trend] ?? "text-gray-400";

  const scoreColor =
    student.predicted_midpoint < 45 ? "bg-red-500" :
    student.predicted_midpoint < 62 ? "bg-amber-500" :
    student.predicted_midpoint < 80 ? "bg-teal-500" :
    "bg-emerald-600";

  return (
    <div className={`border-2 rounded-xl overflow-hidden transition-all ${riskCfg.border}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
      >
        {/* Score indicator */}
        <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white ${scoreColor}`}>
          <span className="text-base font-black leading-none">{student.predicted_midpoint}</span>
          <span className="text-[8px] font-semibold opacity-80">pred.</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900 truncate">{student.student_name}</p>
            <RiskBadge risk={student.risk_level} />
            <TrendIcon className={`h-3.5 w-3.5 ${trendColor} flex-shrink-0`} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
            <span>Range: {student.predicted_range[0]}–{student.predicted_range[1]}</span>
            <span>Pass: {Math.round(student.pass_probability * 100)}%</span>
            {student.top_weak_topic && (
              <span className="text-red-500 font-semibold truncate">Weak: {student.top_weak_topic}</span>
            )}
          </div>
          <div className="mt-1.5">
            <ScoreBar value={student.predicted_midpoint} color={scoreColor} />
          </div>
        </div>

        <div className="flex-shrink-0 text-gray-300">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="px-3 pb-4 pt-1 border-t border-gray-100 bg-gray-50/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {[
                  { label: "Recent Avg",    value: `${student.recent_avg}%`,         color: "text-blue-600" },
                  { label: "Overall Avg",   value: `${student.overall_avg}%`,        color: "text-gray-700" },
                  { label: "Attendance",    value: student.attendance_rate != null ? `${student.attendance_rate}%` : "—", color: student.attendance_rate != null && student.attendance_rate < 75 ? "text-red-600" : "text-gray-700" },
                  { label: "Data Points",   value: `${student.data_points} marks`,   color: "text-gray-500" },
                ].map((s) => (
                  <div key={s.label} className="text-center p-2 bg-white rounded-lg border border-gray-100">
                    <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[9px] text-gray-400 font-semibold">{s.label}</p>
                  </div>
                ))}
              </div>

              {student.topic_breakdown.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Topic Breakdown</p>
                  <div className="space-y-1.5">
                    {student.topic_breakdown.map((t) => (
                      <div key={t.topic}>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className={`font-semibold ${t.weak ? "text-red-600" : "text-gray-600"}`}>
                            {t.topic}{t.weak ? " ⚠" : ""}
                          </span>
                          <span className={t.weak ? "text-red-500 font-bold" : "text-gray-400"}>{t.pct}%</span>
                        </div>
                        <ScoreBar
                          value={t.pct}
                          color={t.pct < 45 ? "bg-red-400" : t.pct < 65 ? "bg-amber-400" : "bg-teal-500"}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {student.key_factors.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Key Factors</p>
                  <div className="space-y-0.5">
                    {student.key_factors.map((f, i) => (
                      <p key={i} className="text-[11px] text-gray-600 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-teal-400 flex-shrink-0" />{f}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                <Info className="h-3 w-3 flex-shrink-0" />
                Confidence: <span className="font-semibold capitalize">{student.confidence}</span>
                &nbsp;·&nbsp;{student.exam_count} exam{student.exam_count !== 1 ? "s" : ""} used
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function GradeForecast() {
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [selectedExam, setSelectedExam] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"risk" | "score" | "name">("risk");
  const [filterRisk, setFilterRisk] = useState<"all" | "high" | "medium" | "low">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useUxGuard({
    route: "/teacher/grade-forecast",
    hasLoadingState: true,
    hasErrorState: true,
    hasData: true,
  });

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery<any>({
    queryKey: ["grade-forecast-subjects"],
    queryFn: async () => {
      const r = await fetch("/api/grade-prediction/teacher-subjects", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: examsData } = useQuery<any>({
    queryKey: ["grade-forecast-exams", selectedSubject],
    queryFn: async () => {
      if (!selectedSubject) return { exams: [] };
      const r = await fetch(`/api/grade-prediction/subject-exams/${selectedSubject}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedSubject,
  });

  const { data: forecast, isLoading: forecastLoading } = useQuery<ClassForecast>({
    queryKey: ["grade-forecast-class", selectedSubject, selectedExam],
    queryFn: async () => {
      const qs = selectedExam
        ? `?examId=${selectedExam}`
        : `?subjectId=${selectedSubject}`;
      const r = await fetch(`/api/grade-prediction/class-forecast${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!(selectedSubject || selectedExam),
  });

  const subjects: any[] = subjectsData?.subjects ?? [];
  const exams: any[] = examsData?.exams ?? [];
  const stats = forecast?.class_stats;

  let students = forecast?.students ?? [];
  if (filterRisk !== "all") students = students.filter((s) => s.risk_level === filterRisk);
  students = [...students].sort((a, b) => {
    if (sortBy === "risk") {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3) || a.predicted_midpoint - b.predicted_midpoint;
    }
    if (sortBy === "score") return a.predicted_midpoint - b.predicted_midpoint;
    return a.student_name.localeCompare(b.student_name);
  });

  const atRiskStudents = (forecast?.students ?? []).filter((s) => s.risk_level === "high");
  const borderlineStudents = (forecast?.students ?? []).filter((s) => s.risk_level === "medium");

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-4 sm:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-start justify-between gap-4 flex-wrap"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
            <BarChart2 className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Grade Forecast Engine</h1>
            <p className="text-xs text-gray-400">
              Predicted score distribution across your class · Statistical model only
            </p>
          </div>
        </div>

        {forecast && (
          <a
            href={`/api/grade-prediction/forecast-pdf${selectedSubject ? `?subjectId=${selectedSubject}` : ""}${selectedExam ? `&examId=${selectedExam}` : ""}`}
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </a>
        )}
      </motion.div>

      {/* Selectors */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedSubject ?? ""}
          onChange={(e) => {
            setSelectedSubject(e.target.value ? parseInt(e.target.value) : null);
            setSelectedExam(null);
          }}
          className="border border-gray-200 bg-white rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:border-teal-400 min-w-[200px]"
        >
          <option value="">Select a subject…</option>
          {subjects.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.student_count} students)
            </option>
          ))}
        </select>

        {selectedSubject && exams.length > 0 && (
          <select
            value={selectedExam ?? ""}
            onChange={(e) => setSelectedExam(e.target.value ? parseInt(e.target.value) : null)}
            className="border border-gray-200 bg-white rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:border-teal-400 min-w-[200px]"
          >
            <option value="">All exams in subject</option>
            {exams.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.students_with_data} students)
                {e.exam_date ? ` · ${new Date(e.exam_date).toLocaleDateString()}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Empty state */}
      {!selectedSubject && !forecastLoading && (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-semibold">Select a subject to generate a class forecast</p>
          <p className="text-xs mt-1">You need at least one graded exam with student marks</p>
        </div>
      )}

      {subjectsLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white animate-pulse rounded-xl" />)}
        </div>
      )}

      {forecastLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-white animate-pulse rounded-xl" />)}
          </div>
          <div className="h-48 bg-white animate-pulse rounded-xl" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-white animate-pulse rounded-xl" />)}
          </div>
        </div>
      )}

      {forecast && !forecastLoading && (
        <AnimatePresence mode="wait">
          <motion.div key={`${selectedSubject}-${selectedExam}`}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

            {/* Subject / Exam banner */}
            {(forecast.subject || forecast.exam) && (
              <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 mb-5 flex flex-wrap gap-3 items-center">
                {forecast.subject && (
                  <div>
                    <p className="text-sm font-black text-teal-800">{forecast.subject.name}</p>
                    <p className="text-xs text-teal-600">{forecast.subject.board} · {forecast.subject.level}</p>
                  </div>
                )}
                {forecast.exam && (
                  <div className="border-l border-teal-200 pl-3">
                    <p className="text-sm font-bold text-teal-800">{forecast.exam.name}</p>
                    {forecast.exam.exam_date && (
                      <p className="text-xs text-teal-600">
                        {new Date(forecast.exam.exam_date).toLocaleDateString()}
                        {forecast.exam.total_marks ? ` · ${forecast.exam.total_marks} marks` : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {stats && stats.total_students === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm font-semibold">No student data found for this selection</p>
              </div>
            ) : (
              <>
                {/* Class KPI strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                  {[
                    { label: "Class Mean",    value: `${stats?.mean ?? 0}%`,             color: "text-teal-700",    bg: "bg-teal-50" },
                    { label: "Predicted Pass Rate", value: `${stats?.pass_rate ?? 0}%`, color: "text-emerald-700", bg: "bg-emerald-50" },
                    { label: "At Risk",       value: stats?.at_risk_count ?? 0,          color: "text-red-700",     bg: "bg-red-50" },
                    { label: "Borderline",    value: stats?.borderline_count ?? 0,       color: "text-amber-700",   bg: "bg-amber-50" },
                    { label: "On Track",      value: stats?.on_track_count ?? 0,         color: "text-emerald-700", bg: "bg-emerald-50" },
                  ].map((k) => (
                    <div key={k.label} className={`p-3 rounded-xl text-center ${k.bg}`}>
                      <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                      <p className={`text-[10px] font-semibold ${k.color} opacity-80`}>{k.label}</p>
                    </div>
                  ))}
                </div>

                {/* Trend strip */}
                <div className="flex gap-3 mb-5 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="font-semibold text-emerald-700">{stats?.improving_count ?? 0} improving</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    <span className="font-semibold text-red-700">{stats?.declining_count ?? 0} declining</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                    <Target className="h-3.5 w-3.5 text-gray-400" />
                    <span className="font-semibold text-gray-600">Class median: {stats?.median ?? 0}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                    <Users className="h-3.5 w-3.5 text-blue-400" />
                    <span className="font-semibold text-blue-700">{stats?.total_students ?? 0} students</span>
                  </div>
                </div>

                {/* Distribution */}
                <Card className="border-0 shadow-sm mb-5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-teal-500" />
                      Score Distribution (Predicted)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {forecast.distribution && <DistributionChart data={forecast.distribution} />}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {forecast.distribution?.map((b, i) => {
                        const colors = ["bg-red-500","bg-orange-500","bg-amber-500","bg-yellow-500","bg-emerald-500","bg-teal-600"];
                        return (
                          <span key={b.label} className="flex items-center gap-1 text-[10px] text-gray-500">
                            <span className={`h-2.5 w-2.5 rounded-sm inline-block ${colors[i]}`} />
                            {b.label}
                          </span>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* At-risk alert panel */}
                {atRiskStudents.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                    className="mb-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <h2 className="text-sm font-bold text-red-700">At-Risk Students ({atRiskStudents.length})</h2>
                      <span className="text-[10px] text-gray-400">Predicted below 45% — needs immediate attention</span>
                    </div>
                    <div className="space-y-2">
                      {atRiskStudents.map((s) => (
                        <StudentCard
                          key={s.student_id}
                          student={s}
                          expanded={expandedId === s.student_id}
                          onToggle={() => setExpandedId(expandedId === s.student_id ? null : s.student_id)}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Borderline panel */}
                {borderlineStudents.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
                    className="mb-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-4 w-4 text-amber-600" />
                      <h2 className="text-sm font-bold text-amber-700">Borderline Students ({borderlineStudents.length})</h2>
                      <span className="text-[10px] text-gray-400">Predicted 45–62% — targeted intervention recommended</span>
                    </div>
                    <div className="space-y-2">
                      {borderlineStudents.slice(0, 5).map((s) => (
                        <StudentCard
                          key={s.student_id}
                          student={s}
                          expanded={expandedId === s.student_id}
                          onToggle={() => setExpandedId(expandedId === s.student_id ? null : s.student_id)}
                        />
                      ))}
                      {borderlineStudents.length > 5 && (
                        <p className="text-xs text-gray-400 text-center py-1">
                          +{borderlineStudents.length - 5} more borderline students in the full list below
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Full class list */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      Full Class ({forecast.students.length} students)
                    </h2>
                    <div className="flex gap-2 flex-wrap">
                      {/* Risk filter */}
                      {(["all","high","medium","low"] as const).map((r) => (
                        <button key={r}
                          onClick={() => setFilterRisk(r)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                            filterRisk === r
                              ? "bg-teal-600 text-white border-teal-600"
                              : "bg-white text-gray-500 border-gray-200 hover:border-teal-300"
                          }`}
                        >
                          {r === "all" ? "All" : RISK[r].label}
                        </button>
                      ))}
                      <span className="w-px bg-gray-200 self-stretch" />
                      {/* Sort */}
                      {(["risk","score","name"] as const).map((s) => (
                        <button key={s}
                          onClick={() => setSortBy(s)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                            sortBy === s
                              ? "bg-gray-800 text-white border-gray-800"
                              : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          {s === "risk" ? "By Risk" : s === "score" ? "By Score" : "By Name"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {students.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">No students in this filter</div>
                    ) : (
                      students.map((s) => (
                        <StudentCard
                          key={s.student_id}
                          student={s}
                          expanded={expandedId === s.student_id}
                          onToggle={() => setExpandedId(expandedId === s.student_id ? null : s.student_id)}
                        />
                      ))
                    )}
                  </div>
                </motion.div>

                {/* Disclaimer */}
                <div className="mt-6 flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <Info className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-gray-400">{forecast.disclaimer}</p>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
