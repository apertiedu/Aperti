import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database, Cpu, Brain, RefreshCw, Activity, Clock,
  TrendingUp, Server, Zap, DollarSign, CheckCircle2, AlertCircle,
  BarChart3, Users,
} from "lucide-react";
import { useStaggerEntrance } from "@/lib/anime-utils";

type Tab = "database" | "api" | "ai";
type LucideIcon = React.FC<{ size?: number; className?: string }>;

function StatCard({ label, value, sub, color = "teal", Icon }: {
  label: string; value: string | number; sub?: string; color?: string; Icon: LucideIcon;
}) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
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

function TabButton({ tab, current, label, Icon, onClick }: { tab: Tab; current: Tab; label: string; Icon: LucideIcon; onClick: (t: Tab) => void }) {
  return (
    <button
      onClick={() => onClick(tab)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
        tab === current
          ? "bg-teal-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function DatabaseTab({ data, isLoading }: { data: any; isLoading: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useStaggerEntrance(ref as React.RefObject<HTMLElement>, { selector: "[data-s]", stagger: 50 });

  if (isLoading) return <div className="p-8 text-center text-slate-400 text-sm">Loading database metrics...</div>;
  if (!data) return <div className="p-8 text-center text-slate-400 text-sm">No data available</div>;

  const conn = data.connections ?? {};

  return (
    <div ref={ref} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="DB Size" value={data.dbSize ?? "—"} Icon={Database} color="teal" />
        <StatCard label="Total Connections" value={conn.total ?? "—"} sub="pg_stat_activity" Icon={Server} color="blue" />
        <StatCard label="Active" value={conn.active ?? "—"} Icon={Activity} color="amber" />
        <StatCard label="Idle" value={conn.idle ?? "—"} Icon={CheckCircle2} color="teal" />
      </div>

      {data.tables?.length > 0 && (
        <Card className="border border-slate-100 shadow-sm" data-s>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Largest Tables</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Table</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Rows</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Size</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Last Vacuum</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tables.slice(0, 12).map((t: any) => (
                    <tr key={t.table_name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs text-slate-700">{t.table_name}</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-600">{Number(t.row_count ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-600">{t.total_size}</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-400">{t.last_autovacuum ? new Date(t.last_autovacuum).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.slowQueries?.length > 0 && (
        <Card className="border border-amber-100 shadow-sm" data-s>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
              <Clock size={14} />
              Slow Queries (&gt;500ms, last 24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-50">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Endpoint</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Max ms</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Avg ms</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slowQueries.map((q: any, i: number) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-mono text-xs text-slate-700">{q.method} {q.endpoint}</td>
                      <td className="px-4 py-2 text-right text-xs text-amber-700 font-semibold">{q.max_ms}ms</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-600">{q.avg_ms}ms</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-600">{q.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ApiTab() {
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["observability-api"],
    queryFn: () => apiFetch("/api/admin/route-health/overview").then(r => r.json()).catch(() => null),
    refetchInterval: 30_000,
  });
  useStaggerEntrance(ref as React.RefObject<HTMLElement>, { selector: "[data-s]", stagger: 50 });

  if (isLoading) return <div className="p-8 text-center text-slate-400 text-sm">Loading API metrics...</div>;

  const routes = data?.routes ?? data ?? [];
  const routeArr = Array.isArray(routes) ? routes : [];

  const totalHits = routeArr.reduce((s: number, r: any) => s + (r.hit_count || r.requests || 0), 0);
  const avgMs = routeArr.length > 0
    ? Math.round(routeArr.reduce((s: number, r: any) => s + (r.avg_ms || 0), 0) / routeArr.length)
    : 0;

  return (
    <div ref={ref} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Requests" value={totalHits.toLocaleString()} sub="tracked routes" Icon={Activity} color="teal" />
        <StatCard label="Avg Latency" value={`${avgMs}ms`} Icon={Clock} color="blue" />
        <StatCard label="Routes Tracked" value={routeArr.length} Icon={BarChart3} color="violet" />
      </div>

      <Card className="border border-slate-100 shadow-sm" data-s>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Route Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {routeArr.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">No API metrics collected yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Route</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Hits</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Avg</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">P95</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {routeArr.slice(0, 20).map((r: any, i: number) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs text-slate-700">{r.method} {r.route || r.endpoint}</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-600">{(r.hit_count || r.requests || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-600">{r.avg_ms ?? "—"}ms</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-600">{r.p95_ms ?? "—"}ms</td>
                      <td className={`px-4 py-2 text-right text-xs font-semibold ${(r.max_ms ?? 0) > 1000 ? "text-amber-600" : "text-slate-600"}`}>{r.max_ms ?? "—"}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AiTab({ data, isLoading }: { data: any; isLoading: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useStaggerEntrance(ref as React.RefObject<HTMLElement>, { selector: "[data-s]", stagger: 50 });

  if (isLoading) return <div className="p-8 text-center text-slate-400 text-sm">Loading AI metrics...</div>;
  if (!data) return <div className="p-8 text-center text-slate-400 text-sm">No AI usage data available</div>;

  const total = data.total ?? {};

  return (
    <div ref={ref} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Calls" value={(total.calls ?? 0).toLocaleString()} sub="last 30 days" Icon={Brain} color="violet" />
        <StatCard label="Tokens Used" value={(total.tokens ?? 0).toLocaleString()} Icon={Zap} color="amber" />
        <StatCard label="Est. Cost" value={`$${total.estimatedCostUSD ?? "0.00"}`} sub="30-day estimate" Icon={DollarSign} color="teal" />
        <StatCard label="Types Active" value={data.byType?.length ?? 0} Icon={BarChart3} color="blue" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-slate-100 shadow-sm" data-s>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Users size={14} className="text-teal-600" />
              Usage by Role
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {(data.byRole ?? []).length === 0 ? (
              <p className="text-xs text-slate-400">No role data yet</p>
            ) : data.byRole.map((r: any) => {
              const maxCalls = Math.max(...data.byRole.map((x: any) => x.calls), 1);
              return (
                <div key={r.role} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 capitalize">{r.role ?? "unknown"}</span>
                    <span className="text-slate-500">{r.calls} calls</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${(r.calls / maxCalls) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border border-slate-100 shadow-sm" data-s>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Activity size={14} className="text-teal-600" />
              Top Interaction Types
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {(data.byType ?? []).length === 0 ? (
              <p className="text-xs text-slate-400">No interaction data yet</p>
            ) : data.byType.slice(0, 8).map((r: any) => {
              const maxCalls = Math.max(...data.byType.map((x: any) => x.calls), 1);
              return (
                <div key={r.interaction_type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{r.interaction_type ?? "unknown"}</span>
                    <span className="text-slate-500">{r.calls}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-400 rounded-full transition-all" style={{ width: `${(r.calls / maxCalls) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ObservabilityPage() {
  const [tab, setTab] = useState<Tab>("database");

  const { data: dbData, isLoading: dbLoading, refetch: refetchDb } = useQuery({
    queryKey: ["observability-db"],
    queryFn: () => apiFetch("/api/admin/db-health").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: aiData, isLoading: aiLoading, refetch: refetchAi } = useQuery({
    queryKey: ["observability-ai"],
    queryFn: () => apiFetch("/api/admin/ai-usage/summary").then(r => r.json()),
    refetchInterval: 60_000,
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Server className="text-teal-600" size={24} />
            Observability
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Database · API · AI — platform-wide health metrics</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchDb(); refetchAi(); }} className="gap-2">
          <RefreshCw size={14} />
          Refresh All
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 w-fit">
        {([
          { tab: "database", label: "Database", Icon: Database },
          { tab: "api", label: "API", Icon: Activity },
          { tab: "ai", label: "AI Usage", Icon: Brain },
        ] as { tab: Tab; label: string; Icon: React.ElementType }[]).map(({ tab: t, label, Icon }) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-card"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {tab === "database" && <DatabaseTab data={dbData} isLoading={dbLoading} />}
        {tab === "api" && <ApiTab />}
        {tab === "ai" && <AiTab data={aiData} isLoading={aiLoading} />}
      </motion.div>
    </div>
  );
}
