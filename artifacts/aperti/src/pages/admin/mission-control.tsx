import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, AlertCircle, Info, Zap, RefreshCw,
  Route, Clock, Activity, ShieldAlert, TrendingUp, CheckCircle2,
} from "lucide-react";
import { useStaggerEntrance } from "@/lib/anime-utils";

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  critical: { label: "Critical", color: "text-red-700", bg: "bg-red-100", icon: ShieldAlert },
  error:    { label: "Error",    color: "text-rose-700", bg: "bg-rose-100", icon: AlertCircle },
  warn:     { label: "Warning",  color: "text-amber-700", bg: "bg-amber-100", icon: AlertTriangle },
  warning:  { label: "Warning",  color: "text-amber-700", bg: "bg-amber-100", icon: AlertTriangle },
  info:     { label: "Info",     color: "text-blue-700", bg: "bg-blue-100", icon: Info },
};

function LevelBadge({ level }: { level: string }) {
  const cfg = LEVEL_CONFIG[level?.toLowerCase()] ?? LEVEL_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, sub, color = "teal", Icon }: {
  label: string; value: number | string; sub?: string; color?: string; Icon: React.ElementType;
}) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <Card className="border border-slate-100 shadow-sm" data-s>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${colorMap[color] ?? colorMap.teal}`}>
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MissionControlPage() {
  const [levelFilter, setLevelFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["mission-control-summary"],
    queryFn: () => apiFetch("/api/admin/mission-control/summary").then(r => r.json()),
    refetchInterval: 15_000,
  });

  const { data: recent, isLoading: recentLoading, refetch: refetchRecent } = useQuery({
    queryKey: ["mission-control-recent", levelFilter],
    queryFn: () => apiFetch(`/api/admin/mission-control/recent?level=${levelFilter}&limit=50`).then(r => r.json()),
    refetchInterval: 15_000,
  });

  useStaggerEntrance(statsRef as React.RefObject<HTMLElement>, { selector: "[data-s]", stagger: 60 });

  const s = summary?.summary ?? {};
  const errors = recent?.errors ?? [];

  function refetchAll() {
    refetchSummary();
    refetchRecent();
  }

  const topRoutes = summary?.topRoutes ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="text-teal-600" size={24} />
            Mission Control
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time error intelligence — auto-refreshes every 15s</p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} className="gap-2">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Errors" value={summaryLoading ? "—" : (s.total ?? 0)} sub="all time" Icon={AlertCircle} color="rose" />
        <StatCard label="Last Hour" value={summaryLoading ? "—" : (s.last1h ?? 0)} Icon={Clock} color="amber" />
        <StatCard label="Last 24h" value={summaryLoading ? "—" : (s.last24h ?? 0)} Icon={TrendingUp} color="blue" />
        <StatCard label="Critical" value={summaryLoading ? "—" : (s.critical24h ?? 0)} sub="24h" Icon={ShieldAlert} color="red" />
        <StatCard label="Errors" value={summaryLoading ? "—" : (s.error24h ?? 0)} sub="24h" Icon={AlertTriangle} color="rose" />
        <StatCard label="Warnings" value={summaryLoading ? "—" : (s.warn24h ?? 0)} sub="24h" Icon={Zap} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-800">Recent Errors</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All levels</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentLoading ? (
                <div className="p-6 text-center text-sm text-slate-400">Loading errors...</div>
              ) : errors.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  <CheckCircle2 className="mx-auto mb-3 text-teal-400" size={32} />
                  <p className="font-medium">No errors found</p>
                  <p className="text-xs mt-1">The system is running clean for the selected filter.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {errors.map((err: any, i: number) => (
                    <motion.div
                      key={err.id ?? i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setExpanded(expanded === err.id ? null : err.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <LevelBadge level={err.level} />
                            {err.route && (
                              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                <Route size={10} />
                                {err.route}
                              </span>
                            )}
                            {err.role && (
                              <Badge variant="outline" className="text-xs h-5">{err.role}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 font-medium truncate">{err.message}</p>
                          <AnimatePresence>
                            {expanded === err.id && err.stack_preview && (
                              <motion.pre
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-2 text-xs bg-slate-900 text-slate-200 p-3 rounded-lg overflow-x-auto"
                              >
                                {err.stack_preview}
                              </motion.pre>
                            )}
                          </AnimatePresence>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                          {new Date(err.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Route size={14} className="text-teal-600" />
                Top Error Routes (24h)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {topRoutes.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No route errors in last 24h</p>
              ) : topRoutes.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-600 truncate flex-1">{r.route}</span>
                  <span className="text-xs font-semibold text-rose-600 shrink-0">{r.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Activity size={14} className="text-teal-600" />
                Errors by Level (7d)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {(summary?.byLevel ?? []).length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No errors in last 7 days</p>
              ) : (summary?.byLevel ?? []).map((row: any) => {
                const cfg = LEVEL_CONFIG[row.level?.toLowerCase()] ?? LEVEL_CONFIG.info;
                return (
                  <div key={row.level} className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${cfg.color}`}>{row.level}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-current rounded-full transition-all" style={{ width: `${Math.min(100, (row.count / Math.max(...(summary?.byLevel ?? []).map((r: any) => r.count), 1)) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 w-8 text-right">{row.count}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
