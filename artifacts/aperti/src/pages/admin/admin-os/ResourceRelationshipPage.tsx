import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import {
  Network, BookOpen, FileText, BookMarked, Brain, CheckCircle2,
  AlertTriangle, RefreshCw, Link2, ExternalLink,
} from "lucide-react";

function RelBadge({ count, icon: Icon, label, color }: any) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${count > 0 ? color : "bg-gray-100 text-gray-400"}`}>
      <Icon className="h-2.5 w-2.5" />
      {count} {label}
    </span>
  );
}

export default function ResourceRelationshipPage() {
  const [filter, setFilter] = useState<"all" | "linked" | "orphaned">("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["resource-relationships"],
    queryFn: () => fetchJSON("/api/admin/content-validation/relationships"),
    refetchInterval: 5 * 60_000,
  });

  const allQuestions: any[] = data?.questions ?? [];
  const markSchemes: any[] = data?.markSchemes ?? [];

  const filtered = allQuestions.filter(q => {
    if (filter === "linked") return parseInt(q.mark_scheme_count) > 0 || parseInt(q.relationship_count) > 0;
    if (filter === "orphaned") return parseInt(q.mark_scheme_count) === 0 && parseInt(q.relationship_count) === 0;
    return true;
  });

  const stats = {
    total: allQuestions.length,
    withMarkScheme: allQuestions.filter(q => parseInt(q.mark_scheme_count) > 0).length,
    withRelationships: allQuestions.filter(q => parseInt(q.relationship_count) > 0).length,
    orphaned: allQuestions.filter(q => parseInt(q.mark_scheme_count) === 0 && parseInt(q.relationship_count) === 0).length,
  };

  const linkedPct = stats.total > 0 ? Math.round((stats.withMarkScheme / stats.total) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Network className="h-6 w-6 text-blue-600" />
            Resource Relationship Map
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            See how questions connect to mark schemes, topics, and other resources.
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Questions", value: stats.total, icon: Brain, color: "text-blue-600 bg-blue-50" },
          { label: "With Mark Scheme", value: stats.withMarkScheme, icon: FileText, color: stats.withMarkScheme === stats.total ? "text-green-600 bg-green-50" : "text-amber-600 bg-amber-50" },
          { label: "Mark Schemes", value: markSchemes.length, icon: BookOpen, color: "text-violet-600 bg-violet-50" },
          { label: "Orphaned", value: stats.orphaned, icon: AlertTriangle, color: stats.orphaned > 0 ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50" },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
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

      {/* Linkage progress */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-800">Mark Scheme Coverage</p>
            <span className="text-sm font-bold text-gray-700">{linkedPct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${linkedPct}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
              className={`h-full rounded-full ${linkedPct === 100 ? "bg-green-500" : linkedPct >= 60 ? "bg-primary" : linkedPct >= 30 ? "bg-amber-400" : "bg-red-400"}`}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{stats.withMarkScheme} of {stats.total} questions have a linked mark scheme</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["all", "linked", "orphaned"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {f === "all" ? `All (${stats.total})` : f === "linked" ? `Linked (${stats.withMarkScheme})` : `Orphaned (${stats.orphaned})`}
          </button>
        ))}
      </div>

      {/* Questions table */}
      <div className="space-y-2">
        {filtered.length === 0 && !isLoading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            {filter === "orphaned" ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">No orphaned questions!</p>
                <p className="text-xs text-gray-400 mt-1">All questions are linked to at least one resource.</p>
              </>
            ) : (
              <>
                <Network className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-600">No questions yet</p>
              </>
            )}
          </div>
        ) : (
          filtered.map((q: any, i: number) => {
            const msCount = parseInt(q.mark_scheme_count ?? "0");
            const relCount = parseInt(q.relationship_count ?? "0");
            const isOrphaned = msCount === 0 && relCount === 0;
            return (
              <motion.div key={q.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className={`bg-white rounded-xl border p-4 ${isOrphaned ? "border-red-100" : "border-gray-100"}`}>
                <div className="flex items-start gap-3">
                  <Brain className={`h-4 w-4 mt-0.5 shrink-0 ${isOrphaned ? "text-red-300" : "text-blue-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 line-clamp-2">{q.question_text}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {q.subject_name && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-medium">{q.subject_name}</span>
                      )}
                      {q.topic && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">{q.topic}</span>
                      )}
                      {q.difficulty && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${q.difficulty === "hard" ? "bg-red-50 text-red-600" : q.difficulty === "medium" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>
                          {q.difficulty}
                        </span>
                      )}
                      {q.max_marks > 0 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">{q.max_marks} marks</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <RelBadge count={msCount} icon={FileText} label="mark scheme" color="bg-primary/8 text-primary" />
                      <RelBadge count={relCount} icon={Link2} label="relationships" color="bg-violet-50 text-violet-700" />
                    </div>
                  </div>
                  {isOrphaned && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500 shrink-0">
                      <AlertTriangle className="h-3 w-3" /> Orphaned
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Mark Schemes section */}
      {markSchemes.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-600" /> Mark Schemes in Library
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {markSchemes.slice(0, 12).map((ms: any, i: number) => (
              <motion.div key={ms.id ?? i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-start gap-3">
                <BookMarked className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">{ms.title || `Mark Scheme #${ms.id}`}</p>
                  {ms.linked_question && (
                    <p className="text-[10px] text-gray-400 truncate mt-0.5 flex items-center gap-1">
                      <Link2 className="h-2.5 w-2.5" />
                      {ms.linked_question}
                    </p>
                  )}
                  {ms.source_type && (
                    <span className="mt-1 inline-block px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded text-[9px] font-medium">
                      {ms.source_type}
                    </span>
                  )}
                </div>
                {ms.question_bank_id ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
