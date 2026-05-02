import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Award, TrendingUp, TrendingDown, Minus } from "lucide-react";

type ExamResult = {
  examId: number;
  examName: string;
  examDate: string | null;
  scored: number;
  max: number;
  percentage: number;
};

function gradeFromPct(pct: number) {
  if (pct >= 90) return { grade: "A*", color: "text-emerald-600", bg: "bg-emerald-100" };
  if (pct >= 80) return { grade: "A", color: "text-emerald-500", bg: "bg-emerald-50" };
  if (pct >= 70) return { grade: "B", color: "text-blue-600", bg: "bg-blue-100" };
  if (pct >= 60) return { grade: "C", color: "text-indigo-600", bg: "bg-indigo-100" };
  if (pct >= 50) return { grade: "D", color: "text-amber-600", bg: "bg-amber-100" };
  if (pct >= 40) return { grade: "E", color: "text-orange-600", bg: "bg-orange-100" };
  return { grade: "U", color: "text-red-600", bg: "bg-red-100" };
}

function progressBar(pct: number) {
  const color = pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-blue-400" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <motion.div className={`h-2 rounded-full ${color}`} style={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut", delay: 0.2 }} />
      </div>
      <span className="text-sm font-bold text-gray-700 w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function MyExams() {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/exams", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  const avg = results.length > 0
    ? Math.round(results.reduce((a, r) => a + r.percentage, 0) / results.length)
    : null;

  const best = results.length > 0 ? Math.max(...results.map(r => r.percentage)) : null;
  const recent = results.length > 0 ? results[results.length - 1] : null;

  const trend = results.length >= 2
    ? results[results.length - 1].percentage - results[results.length - 2].percentage
    : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-white/80 animate-pulse rounded-2xl w-52" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/80 animate-pulse rounded-2xl" />)}</div>
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white/80 animate-pulse rounded-2xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Award className="h-6 w-6 text-indigo-500" />My Exam Results
        </h1>
        <p className="text-gray-500 text-sm mt-1">Track your academic performance across all exams.</p>
      </motion.div>

      {/* Summary cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Average", value: avg !== null ? `${avg}%` : "—", ...(avg !== null ? gradeFromPct(avg) : { color: "text-gray-500", bg: "bg-gray-50", grade: "" }) },
            { label: "Best Score", value: best !== null ? `${best}%` : "—", ...(best !== null ? gradeFromPct(best) : { color: "text-gray-500", bg: "bg-gray-50", grade: "" }) },
            { label: "Trend", value: trend !== null ? `${trend > 0 ? "+" : ""}${trend}%` : "—", color: trend !== null ? (trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-gray-500") : "text-gray-500", bg: trend !== null ? (trend > 0 ? "bg-emerald-50" : trend < 0 ? "bg-red-50" : "bg-gray-50") : "bg-gray-50", grade: "" },
          ].map((s, i) => (
            <motion.div key={s.label} custom={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={`${s.bg} rounded-2xl p-4 border border-white/80 shadow-sm`}>
              <p className="text-xs text-gray-400 font-medium">{s.label}</p>
              <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Exam list */}
      {results.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-indigo-50">
          <Award className="h-12 w-12 text-indigo-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No exam results yet</p>
          <p className="text-gray-300 text-sm mt-1">Your scores will appear here once your teacher marks your exams</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...results].reverse().map((result, i) => {
            const { grade, color, bg } = gradeFromPct(result.percentage);
            return (
              <motion.div key={result.examId} custom={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-50">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{result.examName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {result.examDate ? new Date(result.examDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "No date"} · {result.scored}/{result.max} marks
                    </p>
                  </div>
                  <div className={`${bg} px-3 py-1.5 rounded-xl text-center flex-shrink-0`}>
                    <p className={`text-xl font-black ${color}`}>{grade}</p>
                    <p className="text-[10px] text-gray-400">{result.percentage}%</p>
                  </div>
                </div>
                {progressBar(result.percentage)}
                <p className={`text-xs mt-2 font-medium ${result.percentage >= 80 ? "text-emerald-600" : result.percentage >= 60 ? "text-blue-600" : result.percentage >= 40 ? "text-amber-600" : "text-red-600"}`}>
                  {result.percentage >= 90 ? "🌟 Outstanding performance!" : result.percentage >= 80 ? "⭐ Excellent work" : result.percentage >= 70 ? "👍 Good result" : result.percentage >= 60 ? "📚 Keep working" : result.percentage >= 40 ? "⚠️ Needs improvement" : "🔄 Requires urgent revision"}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
