import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON } from "@/lib/api";
import {
  AlertTriangle, ShieldAlert, Activity, RefreshCw, Play,
  CheckCircle2, XCircle, Clock, Route, Bug, TrendingUp,
  ChevronDown, ChevronUp, Wifi,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

function StatCard({ label, value, sub, icon: Icon, color = "teal", urgent = false }: any) {
  const colors: Record<string, string> = {
    teal: "bg-teal-50 text-teal-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl border shadow-sm p-4 ${urgent ? "border-red-200" : "border-gray-100"}`}>
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </motion.div>
  );
}

function ErrorRow({ err, idx }: { err: any; idx: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
      className="border border-gray-100 rounded-xl bg-white overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-3 flex items-start gap-3 hover:bg-gray-50/50 transition-colors">
        <Bug className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{err.error_message || "Unknown error"}</p>
          <div className="flex gap-3 mt-0.5 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><Route className="h-2.5 w-2.5" />{err.route || "—"}</span>
            <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{err.created_at ? new Date(err.created_at).toLocaleString() : "—"}</span>
            {err.user_role && <span className="px-1 py-0.5 bg-gray-100 rounded text-[9px] font-medium">{err.user_role}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-gray-100">
            <div className="p-3 bg-gray-50/50 space-y-2">
              {err.error_stack && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Stack Trace</p>
                  <pre className="text-[10px] text-gray-600 overflow-x-auto whitespace-pre-wrap font-mono bg-white rounded-lg p-2 border border-gray-100 max-h-32 overflow-y-auto">
                    {err.error_stack}
                  </pre>
                </div>
              )}
              {err.component_stack && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Component Stack</p>
                  <pre className="text-[10px] text-gray-600 overflow-x-auto whitespace-pre-wrap font-mono bg-white rounded-lg p-2 border border-gray-100 max-h-20 overflow-y-auto">
                    {err.component_stack}
                  </pre>
                </div>
              )}
              {err.browser_info && (
                <p className="text-[10px] text-gray-400">Browser: {err.browser_info}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RouteTestResult({ result }: { result: any }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-xl border text-sm ${result.ok ? "bg-green-50/50 border-green-100" : "bg-red-50/50 border-red-200"}`}>
      {result.ok
        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        : <XCircle className="h-4 w-4 text-red-500 shrink-0" />
      }
      <span className="font-mono text-xs flex-1 truncate text-gray-700">{result.method} {result.path}</span>
      <span className={`text-xs font-bold ${result.ok ? "text-green-600" : "text-red-600"}`}>
        {result.status || "ERR"}
      </span>
      <span className={`text-xs ${result.latencyMs > 500 ? "text-amber-600" : "text-gray-400"}`}>
        {result.latencyMs}ms
      </span>
    </div>
  );
}

export default function ErrorIntelligencePage() {
  const [tab, setTab] = useState<"overview" | "errors" | "logins" | "routes" | "test">("overview");
  const [testResults, setTestResults] = useState<any>(null);

  const { data: summary, refetch, isFetching } = useQuery({
    queryKey: ["error-intelligence-summary"],
    queryFn: () => fetchJSON("/api/admin/error-intelligence/summary"),
    refetchInterval: 60_000,
  });

  const { data: trendsData } = useQuery({
    queryKey: ["error-intelligence-trends"],
    queryFn: () => fetchJSON("/api/admin/error-intelligence/trends"),
    refetchInterval: 5 * 60_000,
    enabled: tab === "overview",
  });

  const { data: failedLogins } = useQuery({
    queryKey: ["error-intelligence-failed-logins"],
    queryFn: () => fetchJSON("/api/admin/error-intelligence/failed-logins"),
    enabled: tab === "logins",
  });

  const { data: routeErrors } = useQuery({
    queryKey: ["error-intelligence-route-errors"],
    queryFn: () => fetchJSON("/api/admin/error-intelligence/route-errors"),
    enabled: tab === "routes",
  });

  const runTests = useMutation({
    mutationFn: () => postJSON("/api/admin/error-intelligence/run-route-test", {}),
    onSuccess: (data) => setTestResults(data),
  });

  const stats = summary?.summary ?? {};
  const trendHours = (trendsData?.trends ?? []).map((t: any) => ({
    time: new Date(t.hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    errors: parseInt(t.errors),
  }));

  const topRoutes = (summary?.topRoutes ?? []).map((r: any) => ({
    route: r.route?.split("/").slice(-2).join("/") || r.route,
    count: parseInt(r.count),
  }));

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "errors", label: `Errors ${stats.last24h > 0 ? `(${stats.last24h})` : ""}` },
    { id: "logins", label: `Failed Logins ${stats.failedLogins24h > 0 ? `(${stats.failedLogins24h})` : ""}` },
    { id: "routes", label: "Route Errors" },
    { id: "test", label: "Route Tester" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-500" />
            Error Intelligence Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track errors, failed logins, broken routes, and deployment health in real time.</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Errors (last 1h)" value={stats.last1h ?? "—"} icon={Bug} color={stats.last1h > 0 ? "red" : "green"} urgent={stats.last1h > 5} />
        <StatCard label="Errors (24h)" value={stats.last24h ?? "—"} icon={AlertTriangle} color="amber" />
        <StatCard label="Failed Logins (24h)" value={stats.failedLogins24h ?? "—"} icon={ShieldAlert} color={stats.failedLogins24h > 10 ? "red" : "teal"} urgent={stats.failedLogins24h > 20} />
        <StatCard label="Total Errors Logged" value={stats.totalErrors ?? "—"} icon={Activity} color="teal" />
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
        <div className="space-y-6">
          {trendHours.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-600" /> Error trend · last 48h
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={trendHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="#fee2e2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">No errors in the last 48 hours</p>
              <p className="text-xs text-gray-400 mt-1">Everything looks healthy!</p>
            </div>
          )}
          {topRoutes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Route className="h-4 w-4 text-amber-500" /> Top error routes
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={topRoutes} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="route" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {tab === "errors" && (
        <div className="space-y-2">
          {(summary?.recentErrors ?? []).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">No recent errors</p>
            </div>
          ) : (
            (summary?.recentErrors ?? []).map((err: any, i: number) => (
              <ErrorRow key={err.id} err={err} idx={i} />
            ))
          )}
        </div>
      )}

      {tab === "logins" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {(failedLogins?.failedLogins ?? []).length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">No failed login attempts in the last 7 days</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">IP Address</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Attempts</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Last Attempt</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Identifiers</th>
                </tr>
              </thead>
              <tbody>
                {(failedLogins?.failedLogins ?? []).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{row.ip_address || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-bold text-sm ${parseInt(row.attempts) > 10 ? "text-red-600" : "text-amber-600"}`}>
                        {row.attempts}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {row.last_attempt ? new Date(row.last_attempt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[160px] truncate">
                      {(row.identifiers || []).slice(0, 3).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "routes" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {(routeErrors?.routeErrors ?? []).length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">No route errors in the last 7 days</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Route</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Errors</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Users Affected</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {(routeErrors?.routeErrors ?? []).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{row.route}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-sm text-red-600">{row.errors}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{row.affected_users}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {row.last_seen ? new Date(row.last_seen).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "test" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-900 mb-1">Automated Route Health Check</p>
            <p className="text-xs text-gray-500 mb-4">Hits every critical API route and reports status codes and latency. Use before deployments.</p>
            <button
              onClick={() => runTests.mutate()}
              disabled={runTests.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              {runTests.isPending ? "Running tests…" : "Run Route Test"}
            </button>
          </div>
          {testResults && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${testResults.summary.failed === 0 ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-sm font-semibold">
                    {testResults.summary.passed}/{testResults.summary.total} passed
                  </span>
                </div>
                <span className="text-xs text-gray-400">Avg {testResults.summary.avgLatencyMs}ms</span>
                <span className="text-xs text-gray-400">Ran at {new Date(testResults.summary.ranAt).toLocaleTimeString()}</span>
              </div>
              <div className="space-y-2">
                {testResults.results.map((r: any, i: number) => <RouteTestResult key={i} result={r} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
