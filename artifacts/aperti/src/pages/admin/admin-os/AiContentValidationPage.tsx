import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import {
  ShieldCheck, Flag, AlertTriangle, CheckCircle2, RefreshCw,
  BookOpen, Target, FileText, Hash, Copy, Tag,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function FlagBadge({ reason }: { reason: string }) {
  const labels: Record<string, string> = {
    missing_answer: "No model answer",
    missing_marks: "No marks value",
    missing_topic: "No topic",
    too_short: "Too short",
    missing_difficulty: "No difficulty",
  };
  const colors: Record<string, string> = {
    missing_answer: "bg-red-100 text-red-700",
    missing_marks: "bg-amber-100 text-amber-700",
    missing_topic: "bg-blue-100 text-blue-700",
    too_short: "bg-pink-100 text-pink-700",
    missing_difficulty: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[reason] ?? "bg-gray-100 text-gray-600"}`}>
      <Flag className="h-2.5 w-2.5" />
      {labels[reason] ?? reason}
    </span>
  );
}

export default function AiContentValidationPage() {
  const [tab, setTab] = useState<"overview" | "flagged" | "markschemes" | "dupes">("overview");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["content-validation-summary"],
    queryFn: () => fetchJSON("/api/admin/content-validation/summary"),
    refetchInterval: 2 * 60_000,
  });

  const { data: msData } = useQuery({
    queryKey: ["content-validation-markschemes"],
    queryFn: () => fetchJSON("/api/admin/content-validation/mark-schemes"),
    enabled: tab === "markschemes",
  });

  const stats = data?.stats ?? {};
  const flagged = data?.flaggedQuestions ?? [];
  const bySubject = data?.bySubject ?? [];
  const dupes = data?.possibleDuplicates ?? [];

  const healthScore = stats.totalQuestions
    ? Math.round(100 - ((stats.missingAnswers + stats.missingMarks + stats.missingTopics) / (stats.totalQuestions * 3)) * 100)
    : 100;

  const subjectChartData = bySubject.map((s: any) => ({
    name: s.subject?.split(" ").slice(0, 2).join(" ") ?? "General",
    total: parseInt(s.total),
    flagged: parseInt(s.flagged ?? "0"),
  }));

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "flagged", label: `Flagged (${flagged.length})` },
    { id: "markschemes", label: "Mark Schemes" },
    { id: "dupes", label: `Duplicates (${dupes.length})` },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-violet-600" />
            AI Content Validation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Automatically detect incomplete questions, missing mark schemes, and duplicate content.
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Health Score + Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="relative h-12 w-12 shrink-0">
            <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="4" />
              <circle cx="22" cy="22" r="18" fill="none"
                stroke={healthScore >= 80 ? "#059669" : healthScore >= 60 ? "#d97706" : "#dc2626"}
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(healthScore / 100) * 113} 113`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">{healthScore}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Content Health</p>
            <p className="text-xs text-gray-400">Score out of 100</p>
          </div>
        </motion.div>

        {[
          { label: "Total Questions", value: stats.totalQuestions ?? "—", icon: BookOpen, color: "text-blue-600 bg-blue-50" },
          { label: "Missing Answers", value: stats.missingAnswers ?? "—", icon: AlertTriangle, color: stats.missingAnswers > 0 ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50", urgent: stats.missingAnswers > 0 },
          { label: "Missing Marks", value: stats.missingMarks ?? "—", icon: Hash, color: stats.missingMarks > 0 ? "text-amber-600 bg-amber-50" : "text-green-600 bg-green-50", urgent: stats.missingMarks > 0 },
        ].map(({ label, value, icon: Icon, color, urgent }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3 ${urgent ? "border-red-200" : "border-gray-100"}`}>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Additional flags row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "No Topic", value: stats.missingTopics ?? "—", icon: Tag },
          { label: "No Difficulty", value: stats.missingDifficulty ?? "—", icon: Target },
          { label: "Too Short (<20 chars)", value: stats.tooShort ?? "—", icon: FileText },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-gray-50 rounded-xl border border-gray-100 p-3 flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-800">{value}</p>
              <p className="text-[10px] text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-900 mb-4">Questions by Subject — flagged vs total</p>
          {subjectChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={subjectChartData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#e0e7ff" radius={[0, 4, 4, 0]} name="Total" />
                <Bar dataKey="flagged" fill="#ef4444" radius={[0, 4, 4, 0]} name="Flagged" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No content in question bank yet</p>
            </div>
          )}
        </div>
      )}

      {tab === "flagged" && (
        <div className="space-y-2">
          {flagged.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">All questions look good!</p>
              <p className="text-xs text-gray-400 mt-1">No quality issues detected.</p>
            </div>
          ) : (
            flagged.map((q: any, i: number) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  <Flag className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 line-clamp-2">{q.question_text}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {q.flag_reason && <FlagBadge reason={q.flag_reason} />}
                      {q.subject_name && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-medium">{q.subject_name}</span>
                      )}
                      {q.topic && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">{q.topic}</span>
                      )}
                      {q.max_marks > 0 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">{q.max_marks} marks</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === "markschemes" && (
        <div className="space-y-3">
          <div className="flex gap-4">
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-sm font-semibold text-green-700">{msData?.stats?.withMarkScheme ?? "—"} with mark scheme</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-sm font-semibold text-red-600">{msData?.stats?.withoutMarkScheme ?? "—"} missing mark scheme</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Question</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Subject</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Marks</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Mark Scheme</th>
                </tr>
              </thead>
              <tbody>
                {(msData?.questions ?? []).slice(0, 25).map((q: any, i: number) => (
                  <tr key={q.id ?? i} className="border-b border-gray-50 hover:bg-gray-50/40">
                    <td className="px-4 py-2.5 max-w-[240px]">
                      <p className="text-xs text-gray-700 truncate">{q.question_text}</p>
                      {q.topic && <p className="text-[10px] text-gray-400">{q.topic}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{q.subject_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{q.max_marks ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {q.mark_scheme_id ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Linked
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <AlertTriangle className="h-3 w-3" /> Missing
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "dupes" && (
        <div className="space-y-2">
          {dupes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">No duplicate questions detected</p>
              <p className="text-xs text-gray-400 mt-1">Your question bank content is unique.</p>
            </div>
          ) : (
            dupes.map((d: any, i: number) => (
              <div key={i} className="bg-white rounded-xl border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Copy className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold text-amber-700">
                    {Math.round(parseFloat(d.similarity) * 100)}% similarity
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-400 mb-1">Question #{d.q1_id}</p>
                    <p className="text-xs text-gray-700 line-clamp-3">{d.q1_text}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-400 mb-1">Question #{d.q2_id}</p>
                    <p className="text-xs text-gray-700 line-clamp-3">{d.q2_text}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
