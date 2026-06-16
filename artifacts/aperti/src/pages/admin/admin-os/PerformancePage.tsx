import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Zap, AlertTriangle, Clock, Activity, Database, RefreshCw, TrendingUp } from "lucide-react";

function MetricCard({ label, value, unit, icon: Icon, status = "ok" }: any) {
  const c = status === "ok" ? "border-green-100 bg-green-50" : status === "warning" ? "border-yellow-100 bg-yellow-50" : "border-red-100 bg-red-50";
  const ic = status === "ok" ? "bg-green-100 text-green-600" : status === "warning" ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border-2 p-5 ${c}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${ic} mb-3`}><Icon className="w-4 h-4" /></div>
      <p className="text-2xl font-bold text-gray-900">{value ?? "—"}<span className="text-sm font-normal text-gray-500 ml-1">{unit}</span></p>
      <p className="text-sm text-gray-600 mt-0.5">{label}</p>
    </motion.div>
  );
}

const STATUS_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6366f1", "#14b8a6"];

export default function PerformancePage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-performance"],
    queryFn: () => fetchJSON("/api/admin/performance/metrics"),
    refetchInterval: 30000,
  });

  const { data: healthSummary } = useQuery({
    queryKey: ["admin-performance-health"],
    queryFn: () => fetchJSON("/api/admin/performance/health-summary"),
    refetchInterval: 60000,
  });

  const { data: founderPerf } = useQuery({
    queryKey: ["founder-performance"],
    queryFn: () => fetchJSON("/api/founder/performance"),
    refetchInterval: 60000,
  });

  const d = data as any;
  const h = healthSummary as any;
  const fp = founderPerf as any;
  const summary = d?.summary ?? {};
  const endpoints = d?.endpoints ?? [];
  const timeline = d?.timeline ?? [];
  const statusCodes = d?.statusCodes ?? [];

  const errorStatus = summary.errorRate > 5 ? "critical" : summary.errorRate > 1 ? "warning" : "ok";
  const speedStatus = summary.avgResponseMs > 500 ? "critical" : summary.avgResponseMs > 200 ? "warning" : "ok";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">API response times, error rates, and system health</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40 text-gray-400">Loading performance data…</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Requests (1h)" value={summary.totalRequests?.toLocaleString()} icon={Activity} />
            <MetricCard label="Avg Response Time" value={summary.avgResponseMs} unit="ms" icon={Clock} status={speedStatus} />
            <MetricCard label="Error Rate" value={`${summary.errorRate}%`} icon={AlertTriangle} status={errorStatus} />
            <MetricCard label="Memory Usage" value={h?.memoryMb} unit="MB" icon={Database} />
          </div>

          {/* DB Health */}
          {h && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm text-gray-500 mb-1">Database Size</p>
                <p className="text-xl font-bold text-gray-900">{h.dbSize ?? "N/A"}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm text-gray-500 mb-1">Process Uptime</p>
                <p className="text-xl font-bold text-gray-900">{Math.floor((h.processUptime ?? 0) / 60)}m {(h.processUptime ?? 0) % 60}s</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm text-gray-500 mb-1">DB Uptime</p>
                <p className="text-xl font-bold text-gray-900 text-sm">{String(h.dbUptime ?? "N/A").split(".")[0]}</p>
              </div>
            </div>
          )}

          {/* Timeline Chart */}
          {timeline.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Request Timeline (last hour)</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="minute" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={(v) => new Date(v).toLocaleTimeString()} />
                  <Area type="monotone" dataKey="requests" stroke="hsl(var(--primary))" fill="url(#primaryGrad)" strokeWidth={2} name="Requests" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Slowest Endpoints */}
          {endpoints.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Endpoint Performance
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      {["Endpoint", "Method", "Requests", "Avg (ms)", "P95 (ms)", "Max (ms)", "Errors"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {endpoints.map((ep: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700 max-w-xs truncate">{ep.endpoint}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">{ep.method}</span></td>
                        <td className="px-4 py-3 text-gray-600">{parseInt(ep.request_count).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${parseInt(ep.avg_ms) > 500 ? "text-red-600" : parseInt(ep.avg_ms) > 200 ? "text-yellow-600" : "text-green-600"}`}>
                            {ep.avg_ms}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{ep.p95_ms}</td>
                        <td className="px-4 py-3 text-gray-600">{ep.max_ms}</td>
                        <td className="px-4 py-3 text-gray-600">{ep.error_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status Code Distribution */}
          {statusCodes.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Status Code Distribution</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusCodes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="status_code" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusCodes.map((_: any, i: number) => (
                      <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Slowest Routes — live from api_metrics + historical */}
          {(fp?.live?.length > 0 || fp?.historical?.length > 0) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" /> Top 10 Slowest Endpoints (p95)
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Routes flagged as slow (&gt;500ms)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      {["Route", "Method", "Hits", "Avg (ms)", "P95 (ms)", "Max (ms)", "Last Slow"].map(col => (
                        <th key={col} className="px-4 py-3 text-left font-medium">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(fp?.live?.length > 0 ? fp.live : fp?.historical ?? []).map((r: any, i: number) => {
                      const p95 = parseInt(r.p95_ms);
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700 max-w-xs truncate">{r.route}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">{r.method}</span></td>
                          <td className="px-4 py-3 text-gray-600">{parseInt(r.hit_count).toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-600">{r.avg_ms}</td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${p95 > 1000 ? "text-red-600" : p95 > 500 ? "text-orange-500" : "text-green-600"}`}>
                              {r.p95_ms}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{r.max_ms}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {r.last_slow_at ? new Date(r.last_slow_at).toLocaleTimeString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {endpoints.length === 0 && timeline.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No performance data yet</p>
              <p className="text-sm mt-1">Data accumulates as API requests are made</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
