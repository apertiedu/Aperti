import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, CheckCircle2, RefreshCw, XCircle, Brain,
  Clock, Shield, Zap, Activity, Server, Database, TrendingDown,
  AlertCircle, Eye, BarChart2,
} from "lucide-react";

const TEAL = "#0D9488";


async function apiFetch(url: string) {
  const res = await fetch(`/api${url}`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

function MetricCard({ label, value, sub, status, icon: Icon }: {
  label: string; value: number | string; sub?: string;
  status?: "ok" | "warn" | "error" | "neutral"; icon?: any;
}) {
  const colors = {
    ok:      "text-teal-600  bg-teal-50",
    warn:    "text-amber-600 bg-amber-50",
    error:   "text-red-600   bg-red-50",
    neutral: "text-gray-500  bg-gray-100",
  };
  const cls = colors[status ?? "neutral"];
  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        {Icon && (
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs font-medium text-gray-600">{label}</p>
          {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformHealth() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["platform-health-basic", refreshKey],
    queryFn: () => apiFetch("/health"),
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: dbHealth, isLoading: dbLoading } = useQuery({
    queryKey: ["admin-db-health", refreshKey],
    queryFn: () => apiFetch("/admin/db-health"),
    retry: 1,
  });

  const { data: errorIntel, isLoading: errorLoading } = useQuery({
    queryKey: ["admin-error-intel", refreshKey],
    queryFn: () => apiFetch("/admin/error-intelligence"),
    retry: 1,
  });

  const { data: liveCounts } = useQuery({
    queryKey: ["admin-live-counts", refreshKey],
    queryFn: () => apiFetch("/admin/analytics/live-counts"),
    refetchInterval: 60_000,
    retry: 1,
  });

  const { data: failedLogins } = useQuery({
    queryKey: ["admin-failed-logins", refreshKey],
    queryFn: () => apiFetch("/admin/error-intelligence/failed-logins"),
    retry: 1,
  });

  const isLoading = healthLoading || dbLoading || errorLoading;

  const errorCount24h = dbHealth?.errorCount24h ?? (liveCounts?.errors24h ?? 0);
  const aiErrors = liveCounts?.aiCalls24h ?? 0;
  const dbStatus = health?.db === "connected" ? "ok" : "error";
  const latencyMs = health?.latencyMs ?? 0;
  const latencyStatus: "ok" | "warn" | "error" = latencyMs < 100 ? "ok" : latencyMs < 500 ? "warn" : "error";

  const topErrors: any[] = errorIntel?.topErrors ?? errorIntel?.errors ?? [];
  const slowEndpoints: any[] = dbHealth?.slowQueries ?? [];
  const failedLoginsList: any[] = failedLogins?.recentAttempts ?? failedLogins?.attempts ?? [];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${TEAL}15` }}>
              <Activity className="h-5 w-5" style={{ color: TEAL }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Platform Health</h1>
              <p className="text-sm text-gray-500">Real-time observability · last 24 hours</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Overall status banner */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <Card className={`border-0 shadow-sm mb-6 ${errorCount24h === 0 ? "bg-teal-50" : "bg-amber-50"}`}>
          <CardContent className="p-4 flex items-center gap-3">
            {errorCount24h === 0
              ? <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
              : <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            }
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {errorCount24h === 0 ? "All systems operating normally" : `${errorCount24h} error${errorCount24h !== 1 ? "s" : ""} recorded in the last 24 hours`}
              </p>
              <p className="text-xs text-gray-500">
                DB: {health?.db ?? "—"} · Uptime: {Math.floor((health?.uptime ?? 0) / 60)}m · Version: {health?.version ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Metric cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard label="API Errors (24h)" value={errorCount24h} status={errorCount24h === 0 ? "ok" : errorCount24h < 10 ? "warn" : "error"} icon={AlertCircle} sub="from error_logs" />
          <MetricCard label="DB Latency" value={`${latencyMs}ms`} status={latencyStatus} icon={Database} sub="last health check" />
          <MetricCard label="Active Users" value={(liveCounts?.activeStudents ?? 0) + (liveCounts?.activeTeachers ?? 0)} status="neutral" icon={Eye} sub="students + teachers" />
          <MetricCard label="AI Calls (24h)" value={aiErrors} status={aiErrors > 0 ? "warn" : "ok"} icon={Brain} sub="from ai_logs" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top errors */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <CardTitle className="text-base">Top Errors (24h)</CardTitle>
            </div>
            <CardDescription className="text-xs">Most frequent error messages from the backend</CardDescription>
          </CardHeader>
          <CardContent>
            {errorLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
            ) : topErrors.length === 0 ? (
              <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-400">
                <CheckCircle2 className="h-4 w-4 text-teal-500" />
                No errors logged in the last 24 hours
              </div>
            ) : (
              <div className="space-y-2">
                {topErrors.slice(0, 8).map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50/50">
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] shrink-0 min-w-[28px] justify-center">{e.count ?? e.cnt ?? 1}</Badge>
                    <span className="text-xs text-gray-700 truncate">{e.message ?? e.error ?? e.route ?? "Unknown error"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slow endpoints */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base">Slow Endpoints (24h)</CardTitle>
            </div>
            <CardDescription className="text-xs">API calls taking over 500ms</CardDescription>
          </CardHeader>
          <CardContent>
            {dbLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
            ) : slowEndpoints.length === 0 ? (
              <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-400">
                <Zap className="h-4 w-4 text-teal-500" />
                No slow endpoints detected
              </div>
            ) : (
              <div className="space-y-2">
                {slowEndpoints.slice(0, 8).map((e: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/50">
                    <span className="text-xs text-gray-700 truncate flex-1">{e.method ?? "GET"} {e.endpoint ?? e.route ?? "—"}</span>
                    <Badge className={`ml-2 shrink-0 text-[10px] ${(e.max_ms ?? e.avg_ms ?? 0) > 1000 ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                      {e.max_ms ?? e.avg_ms ?? "—"}ms
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failed logins */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              <CardTitle className="text-base">Failed Logins (24h)</CardTitle>
            </div>
            <CardDescription className="text-xs">Authentication failures — possible brute force</CardDescription>
          </CardHeader>
          <CardContent>
            {failedLoginsList.length === 0 ? (
              <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-400">
                <CheckCircle2 className="h-4 w-4 text-teal-500" />
                No failed login attempts
              </div>
            ) : (
              <div className="space-y-2">
                {failedLoginsList.slice(0, 6).map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                    <Shield className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{e.username ?? e.identifier ?? "unknown"}</p>
                      <p className="text-[10px] text-gray-400">IP: {e.ip ?? "—"} · {e.attempted_at ? new Date(e.attempted_at).toLocaleString() : ""}</p>
                    </div>
                    {e.count && <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">×{e.count}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* DB overview */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4" style={{ color: TEAL }} />
              <CardTitle className="text-base">Database Overview</CardTitle>
            </div>
            <CardDescription className="text-xs">Storage, connections, and growth</CardDescription>
          </CardHeader>
          <CardContent>
            {dbLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-6 rounded" />)}</div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total size</span>
                  <span className="font-semibold text-gray-800">{dbHealth?.dbSize ?? "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Connections (total)</span>
                  <span className="font-semibold text-gray-800">{dbHealth?.connections?.total ?? "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Connections (active)</span>
                  <span className="font-semibold text-gray-800">{dbHealth?.connections?.active ?? "—"}</span>
                </div>
                <div className="pt-2 border-t border-gray-50">
                  <p className="text-xs text-gray-500 mb-2">Top tables by size</p>
                  {(dbHealth?.tables ?? []).slice(0, 4).map((t: any, i: number) => (
                    <div key={i} className="flex justify-between text-[11px] py-0.5">
                      <span className="text-gray-700 truncate">{t.table_name}</span>
                      <span className="text-gray-400 ml-2 shrink-0">{t.total_size} · {t.row_count?.toLocaleString()} rows</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending payments / enrollments section */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Pending Enrollments" value={liveCounts?.pendingEnrollments ?? "—"} status={(liveCounts?.pendingEnrollments ?? 0) > 0 ? "warn" : "ok"} icon={TrendingDown} sub="awaiting approval" />
        <MetricCard label="Pending Payments" value={liveCounts?.pendingPayments ?? "—"} status={(liveCounts?.pendingPayments ?? 0) > 0 ? "warn" : "ok"} icon={AlertCircle} sub="awaiting review" />
        <MetricCard label="Active Teachers" value={liveCounts?.activeTeachers ?? "—"} status="neutral" icon={Server} sub="last 30 days" />
        <MetricCard label="Active Students" value={liveCounts?.activeStudents ?? "—"} status="neutral" icon={Eye} sub="last 30 days" />
      </div>
    </div>
  );
}
