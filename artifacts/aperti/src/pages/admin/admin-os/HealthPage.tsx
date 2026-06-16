import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, Database, Cpu, HardDrive, Wifi, Clock, RefreshCw, CheckCircle, AlertTriangle, XCircle, BarChart2 } from "lucide-react";
import { fetchJSON } from "@/lib/api";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function MetricCard({ label, value, subtitle, icon: Icon, status }: any) {
  const statusColors: Record<string, string> = { ok: "border-green-200 bg-green-50", warning: "border-yellow-200 bg-yellow-50", critical: "border-red-200 bg-red-50" };
  const iconColors: Record<string, string> = { ok: "text-green-600 bg-green-100", warning: "text-yellow-600 bg-yellow-100", critical: "text-red-600 bg-red-100" };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border-2 p-5 ${statusColors[status] || "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColors[status] || "text-gray-600 bg-gray-100"}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status === "ok" ? "bg-green-100 text-green-700" : status === "warning" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{status}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </motion.div>
  );
}

export default function HealthPage() {
  const { data: health, refetch, isFetching } = useQuery({
    queryKey: ["admin-health-live"],
    queryFn: () => fetchJSON("/api/admin/health"),
    refetchInterval: 30000,
  });

  const { data: history } = useQuery({
    queryKey: ["admin-health-history"],
    queryFn: () => fetchJSON("/api/admin/health/history"),
    refetchInterval: 60000,
  });

  const { data: scaling } = useQuery({
    queryKey: ["admin-scaling"],
    queryFn: () => fetchJSON("/api/admin/health/scaling/metrics"),
  });

  const h = health as any;
  const getStatus = (val: number, warn: number, crit: number) => val < warn ? "ok" : val < crit ? "warning" : "critical";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500">Live platform monitoring</p>
        </div>
        <button onClick={() => refetch()} className={`flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors ${isFetching ? "opacity-50" : ""}`}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {h && (
        <>
          {/* Overall status banner */}
          <div className={`rounded-xl p-4 flex items-center gap-3 ${h.status === "healthy" ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
            {h.status === "healthy" ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-yellow-600" />}
            <div>
              <p className="text-sm font-semibold text-gray-900">System is {h.status === "healthy" ? "operating normally" : "experiencing issues"}</p>
              <p className="text-xs text-gray-500">Last checked: {new Date(h.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="API Latency" value={`${h.apiLatency}ms`} subtitle="Response time" icon={Wifi} status={getStatus(h.apiLatency, 200, 500)} />
            <MetricCard label="DB Latency" value={`${h.dbLatency}ms`} subtitle="Query time" icon={Database} status={getStatus(h.dbLatency, 100, 300)} />
            <MetricCard label="Memory" value={`${h.memory?.percent}%`} subtitle={`${h.memory?.used}MB / ${h.memory?.total}MB`} icon={HardDrive} status={getStatus(h.memory?.percent, 70, 90)} />
            <MetricCard label="CPU Load" value={`${h.cpu?.percent}%`} subtitle={`Avg: ${h.cpu?.loadAvg?.toFixed(2)}`} icon={Cpu} status={getStatus(h.cpu?.percent, 70, 90)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard label="DB Connections" value={`${h.dbConnections?.active}/${h.dbConnections?.total}`} subtitle="Active / Total" icon={Database} status="ok" />
            <MetricCard label="Uptime" value={`${Math.floor(h.uptime / 3600)}h ${Math.floor((h.uptime % 3600) / 60)}m`} subtitle="Since last restart" icon={Clock} status="ok" />
            <MetricCard label="Platform Status" value={h.status === "healthy" ? "All Systems Go" : "Degraded"} subtitle="Overall health" icon={Activity} status={h.status === "healthy" ? "ok" : "warning"} />
          </div>
        </>
      )}

      {/* User growth chart */}
      {scaling?.userGrowth && scaling.userGrowth.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">User Growth Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={scaling.userGrowth.map((d: any) => ({ month: d.month?.slice(0, 7), users: d.users }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="#ccfbf1" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* DB size */}
      {scaling?.storage && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Storage</h3>
          <p className="text-3xl font-bold text-primary">{scaling.storage.db_size}</p>
          <p className="text-sm text-gray-500 mt-1">PostgreSQL database size</p>
        </div>
      )}
    </div>
  );
}
