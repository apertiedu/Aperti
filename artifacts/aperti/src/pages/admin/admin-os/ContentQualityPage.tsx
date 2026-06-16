import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON, postJSON } from "@/lib/api";
import {
  BarChart3, RefreshCw, Star, CheckCircle2, XCircle, Flag, Clock,
  ChevronLeft, ChevronRight,
} from "lucide-react";

function QualityBadge({ score }: { score: number }) {
  if (score >= 75) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle2 className="w-3 h-3" /> {score.toFixed(0)}
    </span>
  );
  if (score >= 50) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <Star className="w-3 h-3" /> {score.toFixed(0)}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-600">
      <Flag className="w-3 h-3" /> {score.toFixed(0)}
    </span>
  );
}

export default function ContentQualityPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["content-quality-scores", page, type],
    queryFn: () => fetchJSON(`/api/admin/content-quality/scores?page=${page}&limit=20${type ? `&type=${type}` : ""}`),
  });

  const refreshMut = useMutation({
    mutationFn: () => postJSON("/api/admin/content-quality/refresh", {}),
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ["content-quality-scores"] }), 3000);
    },
  });

  const scores = data?.scores ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20) || 1;

  const avgScore = scores.length > 0
    ? (scores.reduce((s: number, r: any) => s + parseFloat(r.quality_score || 0), 0) / scores.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Quality Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quality scores across all content — questions, lessons, assessments</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => refreshMut.mutate()}
          disabled={refreshMut.isPending}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMut.isPending ? "animate-spin" : ""}`} />
          {refreshMut.isPending ? "Running scan…" : "Recalculate Quality"}
        </motion.button>
      </div>

      {refreshMut.isSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
          Quality scan triggered in background — scores will update in a few moments.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-sm text-gray-500 mt-0.5">Total scored content</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">{avgScore}</p>
          <p className="text-sm text-gray-500 mt-0.5">Average quality score</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {scores.filter((s: any) => parseFloat(s.quality_score) < 50).length}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">Low quality (&lt;50)</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">Filter by type:</span>
        {["", "question", "assessment", "lesson"].map((t) => (
          <button key={t} onClick={() => { setType(t); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              type === t ? "bg-primary text-primary-foreground border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
            }`}>
            {t === "" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-left text-gray-500 font-medium">Content ID</th>
              <th className="px-5 py-3 text-left text-gray-500 font-medium">Type</th>
              <th className="px-5 py-3 text-right text-gray-500 font-medium">Quality</th>
              <th className="px-5 py-3 text-right text-gray-500 font-medium">Usage</th>
              <th className="px-5 py-3 text-right text-gray-500 font-medium">Rating</th>
              <th className="px-5 py-3 text-right text-gray-500 font-medium">Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td colSpan={6} className="px-5 py-3">
                    <div className="animate-pulse bg-gray-100 h-4 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : scores.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                  No quality scores yet — click "Recalculate Quality" to run the scan.
                </td>
              </tr>
            ) : (
              scores.map((s: any) => (
                <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono text-gray-600 text-xs">#{s.content_id}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs capitalize">
                      {s.content_type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <QualityBadge score={parseFloat(s.quality_score)} />
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{s.usage_count ?? 0}</td>
                  <td className="px-5 py-3 text-right text-gray-600">
                    {s.avg_rating ? `${parseFloat(s.avg_rating).toFixed(1)} ★` : "—"}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-400 text-xs">
                    {s.reviewed_at ? new Date(s.reviewed_at).toLocaleDateString() : "—"}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500">Page {page} of {totalPages} ({total} items)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
