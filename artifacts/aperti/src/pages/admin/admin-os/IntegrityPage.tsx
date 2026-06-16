import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { fetchJSON } from "@/lib/api";

function CheckRow({ check, index }: { check: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0 ${check.pass ? "" : "bg-red-50/30"}`}
    >
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${check.pass ? "bg-green-100" : "bg-red-100"}`}>
        {check.pass ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${check.pass ? "text-gray-900" : "text-red-800"}`}>{check.name}</p>
        {!check.pass && <p className="text-xs text-red-500 mt-0.5">{check.details}</p>}
      </div>
      {check.pass && <span className="text-xs text-green-600 font-medium">✓ Pass</span>}
      {!check.pass && <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded">{check.details}</span>}
    </motion.div>
  );
}

export default function IntegrityPage() {
  const [runKey, setRunKey] = useState(0);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["gov-integrity", runKey],
    queryFn: () => fetchJSON("/api/admin/governance/integrity"),
  });

  const result: any = data || {};
  const checks: any[] = result.checks || [];
  const score: number = result.score || 0;
  const passed: number = result.passed || 0;
  const total: number = result.total || 0;
  const loading = isLoading || isFetching;

  const scoreColor = score >= 90 ? "text-green-600" : score >= 70 ? "text-yellow-600" : "text-red-600";
  const scoreRing = score >= 90 ? "stroke-green-500" : score >= 70 ? "stroke-yellow-500" : "stroke-red-500";

  const failed = checks.filter(c => !c.pass);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrity Validation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full platform governance health check</p>
        </div>
        <button onClick={() => setRunKey(k => k + 1)} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors shadow-sm disabled:opacity-70">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Validating..." : "Re-run Validation"}
        </button>
      </div>

      {loading && checks.length === 0 ? (
        <div className="text-center py-20">
          <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Running integrity checks...</p>
        </div>
      ) : (
        <>
          {/* Score Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-8">
              {/* Circular score */}
              <div className="relative w-28 h-28 flex-shrink-0">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                  <circle cx="60" cy="60" r="50" fill="none" className={scoreRing} strokeWidth="12"
                    strokeDasharray={`${(score / 100) * 314} 314`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className={`text-3xl font-bold ${scoreColor}`}>{score}</p>
                  <p className="text-xs text-gray-400">/ 100</p>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className={`w-6 h-6 ${scoreColor}`} />
                  <p className={`text-xl font-bold ${scoreColor}`}>
                    {score >= 90 ? "Excellent" : score >= 70 ? "Needs Attention" : "Critical Issues"}
                  </p>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  {passed} of {total} checks passed · {failed.length} issue(s) require attention
                </p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-600">{passed} passed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-gray-600">{failed.length} failed</span>
                  </div>
                </div>
              </div>
              {result.timestamp && (
                <div className="text-xs text-gray-400 flex-shrink-0">
                  Last run:<br />
                  {new Date(result.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Failed checks first */}
          {failed.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-red-100 bg-red-50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <p className="font-semibold text-red-800 text-sm">{failed.length} Failed Check(s)</p>
              </div>
              {failed.map((c, i) => <CheckRow key={c.name} check={c} index={i} />)}
            </div>
          )}

          {/* All checks */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <p className="font-semibold text-gray-900 text-sm">All Checks ({total})</p>
            </div>
            {checks.map((c, i) => <CheckRow key={c.name} check={c} index={i} />)}
          </div>
        </>
      )}
    </div>
  );
}
