import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, XCircle, Activity, Database,
  Globe, RefreshCw, Clock, Zap, Bug, Shield, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const api = (path: string) =>
  fetch(path, { credentials: "include" }).then(r => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
    )}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function DebugCenterPage() {
  const errQuery = useQuery({
    queryKey: ["debug-errors"],
    queryFn: () => api("/api/admin/error-intelligence/summary"),
    staleTime: 30_000,
    retry: 1,
  });

  const healthQuery = useQuery({
    queryKey: ["debug-health"],
    queryFn: () => api("/api/health"),
    staleTime: 30_000,
    retry: 1,
  });

  const scoreQuery = useQuery({
    queryKey: ["debug-score"],
    queryFn: () => api("/api/founder/platform-health-score"),
    staleTime: 60_000,
    retry: 1,
  });

  const dbQuery = useQuery({
    queryKey: ["debug-db"],
    queryFn: () => api("/api/admin/db-health"),
    staleTime: 30_000,
    retry: 1,
  });

  const errSummary = errQuery.data?.summary;
  const health = healthQuery.data;
  const score = scoreQuery.data;
  const db = dbQuery.data;

  const overallOk =
    (errSummary?.last1h ?? 0) === 0 &&
    health?.status === "ok";

  const refetchAll = () => {
    errQuery.refetch();
    healthQuery.refetch();
    scoreQuery.refetch();
    dbQuery.refetch();
  };

  const loading = errQuery.isLoading || healthQuery.isLoading;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            overallOk ? "bg-emerald-50" : "bg-red-50"
          )}>
            <Bug className={cn("h-5 w-5", overallOk ? "text-emerald-600" : "text-red-500")} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Founder Debug Center</h1>
            <p className="text-sm text-gray-500">Live platform signal — errors, APIs, database, performance</p>
          </div>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={refetchAll}
          disabled={loading}
          className="gap-2 h-8"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </motion.div>

      {/* Top status row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          {
            label: "Errors (1h)",
            value: errSummary?.last1h ?? "—",
            ok: (errSummary?.last1h ?? 1) === 0,
            icon: Bug,
            sub: `${errSummary?.last24h ?? "—"} in 24h`,
          },
          {
            label: "Database",
            value: health?.status === "ok" ? "Healthy" : health?.status ?? "—",
            ok: health?.status === "ok",
            icon: Database,
            sub: health?.dbLatencyMs ? `${health.dbLatencyMs}ms latency` : "Checking…",
          },
          {
            label: "Failed Logins (24h)",
            value: errSummary?.failedLogins24h ?? "—",
            ok: (errSummary?.failedLogins24h ?? 0) < 10,
            icon: Shield,
            sub: `${errSummary?.failedLoginsTotal ?? "—"} total`,
          },
          {
            label: "Health Score",
            value: score?.score != null ? `${score.score}/100` : "—",
            ok: (score?.score ?? 0) >= 70,
            icon: TrendingUp,
            sub: score?.label ?? "Calculating…",
          },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.04 }}
          >
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center",
                    item.ok ? "bg-emerald-50" : "bg-red-50"
                  )}>
                    <item.icon className={cn("h-4 w-4", item.ok ? "text-emerald-600" : "text-red-500")} />
                  </div>
                  <StatusPill ok={item.ok} label={item.ok ? "OK" : "Alert"} />
                </div>
                <p className="text-xl font-bold">{item.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                <p className="text-xs text-gray-300 mt-0.5">{item.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Frontend Errors */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Frontend Errors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y max-h-64 overflow-y-auto">
              {errQuery.isLoading ? (
                <div className="divide-y">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="px-4 py-3 animate-pulse">
                      <div className="h-3 bg-gray-100 rounded w-3/4 mb-1.5" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : errQuery.isError ? (
                <div className="p-6 text-center text-sm text-red-400">Could not load error data</div>
              ) : (errQuery.data?.recentErrors ?? []).length === 0 ? (
                <div className="p-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No recent errors</p>
                </div>
              ) : (
                (errQuery.data?.recentErrors ?? []).slice(0, 10).map((e: {
                  id: number; error_message: string; route: string; user_role: string; created_at: string;
                }) => (
                  <div key={e.id} className="px-4 py-3 hover:bg-gray-50/60">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-red-600 line-clamp-1">{e.error_message}</p>
                      <Badge variant="outline" className="text-xs shrink-0">{e.user_role ?? "unknown"}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{e.route ?? "—"}</p>
                    <p className="text-xs text-gray-300 mt-0.5">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Error Hot Routes */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-amber-500" />
                Error Hot Routes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {errQuery.isLoading ? (
                <div className="divide-y">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                      <div className="h-7 w-7 rounded-lg bg-gray-100 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-gray-100 rounded w-32" />
                        <div className="h-2.5 bg-gray-100 rounded w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (errQuery.data?.topRoutes ?? []).length === 0 ? (
                <div className="p-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No routes flagged</p>
                </div>
              ) : (
                (errQuery.data?.topRoutes ?? []).map((r: { route: string; count: number }, i: number) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/60">
                    <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-gray-700 truncate">{r.route}</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">{r.count} errors</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Database Health */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-500" />
                Database Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {healthQuery.isLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="h-3 bg-gray-100 rounded w-20" />
                      <div className="h-3 bg-gray-100 rounded w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Status</span>
                    <StatusPill ok={health?.status === "ok"} label={health?.status ?? "Unknown"} />
                  </div>
                  {health?.dbLatencyMs != null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Latency</span>
                        <span className={cn(
                          "font-mono text-xs font-semibold",
                          health.dbLatencyMs < 50 ? "text-emerald-600" : health.dbLatencyMs < 200 ? "text-amber-600" : "text-red-500"
                        )}>{health.dbLatencyMs}ms</span>
                      </div>
                      <ScoreBar value={Math.max(0, 100 - health.dbLatencyMs)} max={100} />
                    </div>
                  )}
                  {health?.tableCount != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Tables</span>
                      <span className="font-semibold">{health.tableCount}</span>
                    </div>
                  )}
                  {db?.issues?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-600">Issues</p>
                      {db.issues.map((iss: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {iss}
                        </div>
                      ))}
                    </div>
                  )}
                  {(!db?.issues || db.issues.length === 0) && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      No database issues detected
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* System Memory */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                System Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {healthQuery.isLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2].map(i => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between">
                        <div className="h-3 bg-gray-100 rounded w-16" />
                        <div className="h-3 bg-gray-100 rounded w-24" />
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : health?.memory ? (
                <>
                  {[
                    { label: "Heap Used", value: health.memory.heapUsedMb, max: health.memory.heapTotalMb },
                    { label: "RSS", value: health.memory.rssMb, max: 512 },
                  ].map(m => (
                    <div key={m.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{m.label}</span>
                        <span className="font-mono text-xs font-semibold">{m.value}MB / {m.max}MB</span>
                      </div>
                      <ScoreBar value={m.value} max={m.max} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Uptime</span>
                    <span className="font-mono text-xs">
                      {health.uptimeSeconds ? `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m` : "—"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-400 text-center py-4">Memory data unavailable</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick links */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">Deep Dive</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Route Health", href: "/admin/os/route-health" },
            { label: "Error Intelligence", href: "/admin/os/error-intelligence" },
            { label: "DB Health", href: "/admin/os/db-health" },
            { label: "Stability Score", href: "/admin/os/stability-score" },
            { label: "Slow Queries", href: "/admin/os/slow-queries" },
          ].map(l => (
            <a
              key={l.href}
              href={l.href}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-primary/30 hover:text-primary transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
