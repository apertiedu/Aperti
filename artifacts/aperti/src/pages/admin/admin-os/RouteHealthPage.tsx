import { useState } from "react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Shield,
  Clock, Activity, ChevronDown, ChevronRight as ChevronRightIcon, Filter,
} from "lucide-react";

interface RouteCheck {
  path: string;
  method: string;
  category: string;
  status: "pass" | "fail" | "warn";
  httpCode: number | null;
  isProtected: boolean;
  protectionOk: boolean;
  latencyMs: number | null;
  note: string;
}

interface ReportData {
  summary: { total: number; passed: number; failed: number; warned: number; healthScore: number; avgLatencyMs: number };
  results: RouteCheck[];
  generatedAt: string;
}

const STATUS_ICONS = {
  pass: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  fail: <XCircle className="w-4 h-4 text-red-500" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-500" />,
};

const STATUS_BADGE = {
  pass: "bg-emerald-50 text-emerald-700 border-emerald-100",
  fail: "bg-red-50 text-red-700 border-red-100",
  warn: "bg-amber-50 text-amber-700 border-amber-100",
};

export default function RouteHealthPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pass" | "fail" | "warn">("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Admin", "System"]));

  const runCrawl = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/route-health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReport(data);
      toast({
        title: "Route health check complete",
        description: `${data.summary.passed}/${data.summary.total} routes passed (${data.summary.healthScore}% health score)`,
      });
    } catch (err: any) {
      toast({ title: "Check failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const filtered = report?.results.filter(r => filter === "all" || r.status === filter) ?? [];
  const categories = [...new Set(filtered.map(r => r.category))];

  const scoreColor = !report ? "text-gray-400" :
    report.summary.healthScore >= 90 ? "text-emerald-600" :
    report.summary.healthScore >= 70 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Route Health Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automated crawler — tests every API route for availability and auth protection</p>
        </div>
        <button
          onClick={runCrawl}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Crawling…" : "Run Health Check"}
        </button>
      </div>

      {/* Summary Cards */}
      {report && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Health Score</p>
            <p className={`text-3xl font-black mt-1 ${scoreColor}`}>{report.summary.healthScore}%</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">Passed</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{report.summary.passed}</p>
            <p className="text-xs text-gray-400 mt-0.5">of {report.summary.total} routes</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-red-500 uppercase tracking-wide font-medium">Failed</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{report.summary.failed}</p>
            <p className="text-xs text-gray-400 mt-0.5">critical issues</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Latency</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{report.summary.avgLatencyMs}<span className="text-lg font-normal">ms</span></p>
          </div>
        </motion.div>
      )}

      {/* Filter + Table */}
      {report ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              {(["all", "pass", "fail", "warn"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filter === f ? "bg-teal-50 text-teal-700" : "text-gray-500 hover:bg-gray-50"}`}
                >
                  {f === "all" ? `All (${report.results.length})` :
                   f === "pass" ? `✅ Pass (${report.summary.passed})` :
                   f === "fail" ? `❌ Fail (${report.summary.failed})` :
                   `⚠️ Warn (${report.summary.warned})`}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">Generated {new Date(report.generatedAt).toLocaleTimeString()}</p>
          </div>

          {/* Results by category */}
          <div className="divide-y divide-gray-50">
            {categories.map(cat => {
              const catRoutes = filtered.filter(r => r.category === cat);
              const open = expandedCategories.has(cat);
              const catPassed = catRoutes.filter(r => r.status === "pass").length;
              const catFailed = catRoutes.filter(r => r.status === "fail").length;
              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm font-semibold text-gray-700">{cat}</span>
                      <span className="text-xs text-gray-400">{catRoutes.length} routes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {catFailed > 0 && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">{catFailed} failed</span>}
                      <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{catPassed}/{catRoutes.length}</span>
                    </div>
                  </button>
                  <AnimatePresence>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {catRoutes.map((route, i) => (
                          <div key={i} className="flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50/50 border-t border-gray-50">
                            {STATUS_ICONS[route.status]}
                            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">{route.method}</span>
                            <span className="text-sm font-mono text-gray-800 flex-1 truncate">{route.path}</span>
                            {route.isProtected && (
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Shield className={`w-3 h-3 ${route.protectionOk ? "text-emerald-500" : "text-red-500"}`} />
                                {route.protectionOk ? "Auth OK" : "EXPOSED"}
                              </span>
                            )}
                            {route.latencyMs !== null && (
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Clock className="w-3 h-3" />
                                {route.latencyMs}ms
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[route.status]}`}>
                              {route.httpCode ?? "err"}
                            </span>
                            {route.note && (
                              <span className="text-xs text-gray-400 italic truncate max-w-48" title={route.note}>{route.note}</span>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-16 text-center">
          <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No report generated yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "Run Health Check" to crawl all routes and generate a report.</p>
          <button
            onClick={runCrawl}
            disabled={loading}
            className="mt-4 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-60 transition-colors"
          >
            {loading ? "Crawling…" : "Run Now"}
          </button>
        </div>
      )}
    </div>
  );
}
