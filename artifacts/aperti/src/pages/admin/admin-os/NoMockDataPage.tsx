import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import {
  DatabaseZap, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Loader2, ShieldCheck,
} from "lucide-react";

function AuditItem({ check, index }: { check: any; index: number }) {
  const statusMap: Record<string, { icon: any; color: string; bg: string; border: string; label: string }> = {
    pass: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50", border: "border-green-100", label: "Real Data" },
    fail: { icon: XCircle,      color: "text-red-500",   bg: "bg-red-50",   border: "border-red-100",   label: "Issue"     },
    warn: { icon: AlertTriangle,color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-100", label: "Warning"   },
  };
  const cfg = statusMap[check.status as string] || { icon: Loader2, color: "text-gray-400", bg: "bg-gray-50", border: "border-gray-100", label: "…" };
  const Icon = cfg.icon;
  const sourceColors: Record<string, string> = {
    database: "bg-primary/8 text-primary",
    demo_preview: "bg-blue-50 text-blue-600",
    unknown: "bg-gray-100 text-gray-500",
    error: "bg-red-50 text-red-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.border} ${cfg.bg}`}
    >
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="text-sm font-semibold text-gray-900">{check.label}</p>
          {check.source && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sourceColors[check.source] ?? "bg-gray-100 text-gray-500"}`}>
              {check.source === "demo_preview" ? "demo preview" : check.source}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{check.detail}</p>
      </div>
      <span className={`text-[10px] font-bold flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
    </motion.div>
  );
}

export default function NoMockDataPage() {
  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery<any>({
    queryKey: ["no-mock-data-audit"],
    queryFn: () => fetchJSON("/api/founder/no-mock-data-audit"),
    refetchInterval: 120000,
    staleTime: 60000,
    retry: false,
  });

  const checks: any[] = data?.checks || [];
  const certified: boolean = data?.certified ?? false;
  const allReal: boolean = data?.allDataReal ?? false;
  const failCount: number = data?.failCount ?? 0;
  const warnCount: number = data?.warnCount ?? 0;
  const passCount = checks.filter(c => c.status === "pass").length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DatabaseZap className="w-6 h-6 text-primary" />
            No Mock Data Certification
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Every number displayed to users must come from the database or be labelled as a demo preview
          </p>
        </div>
        <button
          onClick={() => { qc.invalidateQueries({ queryKey: ["no-mock-data-audit"] }); refetch(); }}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/80 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Auditing…" : "Run Audit"}
        </button>
      </div>

      {/* What this checks */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1.5">What this audit verifies:</p>
        <ul className="space-y-1 text-xs text-blue-700">
          <li>• Landing page stats (student/teacher/course counts) come from the database</li>
          <li>• Testimonials are stored in and served from the CMS database</li>
          <li>• Pricing plans are pulled from the subscription_plans table</li>
          <li>• All admin analytics charts query live database tables</li>
          <li>• Revenue figures are computed from real payment transactions</li>
          <li>• Product demo previews are explicitly labelled as illustrative</li>
        </ul>
      </div>

      {/* Status banner */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="h-32 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Auditing data sources…</p>
            </div>
          </motion.div>
        ) : allReal && failCount === 0 ? (
          <motion.div key="certified"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r bg-primary/5 from-primary/5 to-emerald-50 border-2 border-primary/25"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-lg font-black text-foreground">Certified — No Mock Data ✅</p>
              <p className="text-sm text-primary mt-0.5">{data?.summary}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="issues"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-4 p-5 rounded-2xl bg-amber-50 border-2 border-amber-200"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-black text-amber-800">
                {failCount > 0 ? `${failCount} issue${failCount !== 1 ? "s" : ""} found` : `${warnCount} warning${warnCount !== 1 ? "s" : ""}`}
              </p>
              <p className="text-sm text-amber-700 mt-0.5">{data?.summary ?? "Review items below."}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress */}
      {!isLoading && checks.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data Sources Verified</p>
            <p className="text-sm font-bold text-gray-700">{passCount} / {checks.length}</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(passCount / checks.length) * 100}%` }}
              transition={{ duration: 0.8 }}
              className={`h-full rounded-full ${failCount === 0 ? "bg-primary" : "bg-amber-500"}`}
            />
          </div>
        </div>
      )}

      {/* Audit items */}
      {!isLoading && checks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 px-1">Audit Results</p>
          {checks.map((c: any, i: number) => <AuditItem key={c.id} check={c} index={i} />)}
        </div>
      )}

      {!isLoading && checks.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <DatabaseZap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Click "Run Audit" to verify data origins.</p>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 pb-2">
        Queries live database tables · Auto-refreshes every 2 minutes
      </p>
    </div>
  );
}
